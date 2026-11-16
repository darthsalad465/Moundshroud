// OWASP Juice Shop: a deliberately vulnerable web app, run locally as a safe, legal target to practice the cyber
// tools and ARTEX against. Moundshroud starts it on 3017 and shows it inside the Cyber tab through a small proxy on
// 3018 that strips the X-Frame-Options header (Juice Shop sends SAMEORIGIN, which would otherwise block the frame).
const cp = require('child_process'), path = require('path'), fs = require('fs'), net = require('net'), http = require('http');
const RT = path.join(__dirname, '..', 'runtime'), PORT = 3017, FRAME = 3018;
function appDir() {
  try {
    const base = path.join(RT, 'juiceshop');
    if (fs.existsSync(path.join(base, 'build', 'app.js'))) return base;
    for (const d of fs.readdirSync(base)) { const p = path.join(base, d); try { if (fs.statSync(p).isDirectory() && fs.existsSync(path.join(p, 'build', 'app.js'))) return p; } catch (e) { } }
  } catch (e) { }
  return '';
}
let proc = null, starting = false, proxy = null;
const delay = ms => new Promise(r => setTimeout(r, ms));
const portUp = port => new Promise(r => { const s = net.connect({ host: '127.0.0.1', port }, () => { s.destroy(); r(true); }); s.on('error', () => r(false)); s.setTimeout(700, () => { s.destroy(); r(false); }); });
const installed = () => !!appDir();
function killTree(pid) { try { cp.spawnSync('taskkill', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true }); } catch (e) { } }
function pidOnPort(port) { try { const out = cp.execSync('netstat -ano -p tcp', { windowsHide: true }).toString(); for (const ln of out.split('\n')) { const m = ln.match(/^\s*TCP\s+\S+:(\d+)\s+\S+\s+LISTENING\s+(\d+)/); if (m && +m[1] === port) return +m[2]; } } catch (e) { } return 0; }

/* the frame proxy: forwards 3018 -> Juice Shop on 3017, dropping headers that forbid being shown in a frame */
function startProxy() {
  if (proxy) return;
  proxy = http.createServer((req, res) => {
    const pr = http.request({ host: '127.0.0.1', port: PORT, path: req.url, method: req.method, headers: req.headers }, r => {
      const h = Object.assign({}, r.headers); delete h['x-frame-options']; delete h['content-security-policy']; delete h['content-security-policy-report-only'];
      res.writeHead(r.statusCode, h); r.pipe(res);
    });
    pr.on('error', () => { try { res.writeHead(502); res.end('Juice Shop is still starting.'); } catch (e) { } });
    req.pipe(pr);
  });
  proxy.on('upgrade', (req, socket, head) => {               // socket.io websocket for the live score board
    const pr = http.request({ host: '127.0.0.1', port: PORT, path: req.url, method: req.method, headers: req.headers });
    pr.on('upgrade', (prr, psock, phead) => {
      socket.write('HTTP/1.1 101 ' + (prr.statusMessage || 'Switching Protocols') + '\r\n' + Object.keys(prr.headers).map(k => k + ': ' + prr.headers[k]).join('\r\n') + '\r\n\r\n');
      if (phead && phead.length) psock.unshift(phead); psock.pipe(socket); socket.pipe(psock);
    });
    pr.on('error', () => socket.destroy()); pr.end();
  });
  proxy.on('error', () => { });
  proxy.listen(FRAME, '127.0.0.1');
}
function stopProxy() { if (proxy) { try { proxy.close(); } catch (e) { } proxy = null; } }

async function status() { const up = await portUp(PORT); return { installed: installed(), up, starting, port: FRAME, url: 'http://127.0.0.1:' + FRAME }; }
async function start() {
  const dir = appDir(); if (!dir) return { ok: false, error: 'Juice Shop is not installed in the runtime folder.', ...(await status()) };
  if (starting) return status();
  if (await portUp(PORT)) { startProxy(); return status(); }
  starting = true;
  try {
    const log = fs.openSync(path.join(RT, 'juiceshop.log'), 'w');
    proc = cp.spawn(process.execPath, ['build/app.js'], { cwd: dir, windowsHide: true, stdio: ['ignore', log, log], env: { ...process.env, PORT: String(PORT), NODE_ENV: 'unsafe' } });
    proc.unref();
    for (let i = 0; i < 120 && !(await portUp(PORT)); i++) await delay(500);   // first boot builds its database
    startProxy();
  } catch (e) { starting = false; return { ok: false, error: String(e && e.message || e), ...(await status()) }; }
  starting = false; return status();
}
async function stop() { stopProxy(); const pid = (proc && proc.pid) || pidOnPort(PORT); if (pid) killTree(pid); proc = null; return status(); }
function stopAll() { stopProxy(); const pid = (proc && proc.pid) || pidOnPort(PORT); if (pid) killTree(pid); proc = null; }
module.exports = { status, start, stop, stopAll, installed, PORT, FRAME };

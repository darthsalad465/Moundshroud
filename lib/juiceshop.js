// OWASP Juice Shop: a deliberately vulnerable web app, run locally as a safe, legal target to practice the cyber
// tools and ARTEX against. Moundshroud starts it on demand on port 3017 and shows it inside the Cyber tab.
const cp = require('child_process'), path = require('path'), fs = require('fs'), net = require('net');
const RT = path.join(__dirname, '..', 'runtime'), PORT = 3017;
function appDir() {
  try {
    const base = path.join(RT, 'juiceshop');
    if (fs.existsSync(path.join(base, 'build', 'app.js'))) return base;
    for (const d of fs.readdirSync(base)) { const p = path.join(base, d); try { if (fs.statSync(p).isDirectory() && fs.existsSync(path.join(p, 'build', 'app.js'))) return p; } catch (e) { } }
  } catch (e) { }
  return '';
}
let proc = null, starting = false;
const delay = ms => new Promise(r => setTimeout(r, ms));
const portUp = () => new Promise(r => { const s = net.connect({ host: '127.0.0.1', port: PORT }, () => { s.destroy(); r(true); }); s.on('error', () => r(false)); s.setTimeout(700, () => { s.destroy(); r(false); }); });
const installed = () => !!appDir();
function killTree(pid) { try { cp.spawnSync('taskkill', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true }); } catch (e) { } }
function pidOnPort() { try { const out = cp.execSync('netstat -ano -p tcp', { windowsHide: true }).toString(); for (const ln of out.split('\n')) { const m = ln.match(/^\s*TCP\s+\S+:(\d+)\s+\S+\s+LISTENING\s+(\d+)/); if (m && +m[1] === PORT) return +m[2]; } } catch (e) { } return 0; }

async function status() { const up = await portUp(); return { installed: installed(), up, starting, port: PORT, url: 'http://127.0.0.1:' + PORT }; }
async function start() {
  const dir = appDir(); if (!dir) return { ok: false, error: 'Juice Shop is not installed in the runtime folder.', ...(await status()) };
  if (starting || await portUp()) return status();
  starting = true;
  try {
    const log = fs.openSync(path.join(RT, 'juiceshop.log'), 'w');
    proc = cp.spawn(process.execPath, ['build/app.js'], { cwd: dir, windowsHide: true, stdio: ['ignore', log, log], env: { ...process.env, PORT: String(PORT), NODE_ENV: 'unsafe' } });
    proc.unref();
    for (let i = 0; i < 90 && !(await portUp()); i++) await delay(500);   // first boot builds its database, up to ~45s
  } catch (e) { starting = false; return { ok: false, error: String(e && e.message || e), ...(await status()) }; }
  starting = false; return status();
}
async function stop() { const pid = (proc && proc.pid) || pidOnPort(); if (pid) killTree(pid); proc = null; return status(); }
function stopAll() { const pid = (proc && proc.pid) || pidOnPort(); if (pid) killTree(pid); proc = null; }
module.exports = { status, start, stop, stopAll, installed, PORT };

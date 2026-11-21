// ARTEX: the AI autonomous penetration-testing system, run on this PC and driven by the local models.
// Moundshroud owns its lifecycle: a private PostgreSQL (runtime/pgsql on port 5433) and artex.exe (port 8787),
// both started on demand and pointed at the local Ollama server. Nothing here reaches the internet by itself.
const cp = require('child_process'), path = require('path'), fs = require('fs'), net = require('net'), http = require('http'), os = require('os'), crypto = require('crypto');
const RT = path.join(__dirname, '..', 'runtime');
const PG = { bin: path.join(RT, 'pgsql', 'bin'), data: path.join(RT, 'pgdata'), port: 5433 };
const AX = { dir: path.join(RT, 'artex'), exe: path.join(RT, 'artex', 'artex.exe'), port: 8787, out: path.join(RT, 'artex', 'artex.log'), err: path.join(RT, 'artex', 'artex.err') };
/* the build Moundshroud installs when the program is missing: the official Windows release, pinned by version and
   checked against the SHA-256 the project publishes beside it, so a tampered or half-finished download is refused */
const RELEASE = {
  version: '0.3.30',
  asset: 'artex-0.3.30-windows-amd64.zip',
  url: 'https://github.com/RuoJi6/ARTEX/releases/download/v0.3.30/artex-0.3.30-windows-amd64.zip',
  sha256: '8a67064179adecbfb9d1602a1ef167cb7c2e2b79fe20ee083a969c9163339427'
};
const DSN = 'postgres://artex:artex@127.0.0.1:' + PG.port + '/artex?sslmode=disable';
const OLLAMA = 'http://127.0.0.1:11434/v1';
let model = '', pgProc = null, axProc = null, starting = false;
/* ARTEX starts in Chinese and remembers the language it last used in localStorage, per page origin. Its screens are
   served from 127.0.0.1:8787, so Moundshroud cannot set that from its own page. A tiny pass-through proxy on the next
   port serves the same app on a second origin and pre-sets the language before the app boots, which is what makes the
   frame English. Everything else — paths, assets, its API, its WebSocket — is forwarded untouched. */
const PROXY_PORT = AX.port + 1;
const LOCALE = '<script>try{if(!localStorage.getItem("artex_locale"))localStorage.setItem("artex_locale","en")}catch(e){}</script>';
let proxy = null;
function ensureProxy() {
  if (proxy) return proxy;
  const upHeaders = req => {
    const h = Object.assign({}, req.headers);
    delete h['accept-encoding'];               /* plain text, so the HTML can be edited */
    h.host = '127.0.0.1:' + AX.port;
    if (h.origin) h.origin = 'http://127.0.0.1:' + AX.port;
    if (h.referer) h.referer = String(h.referer).replace(':' + PROXY_PORT, ':' + AX.port);
    return h;
  };
  proxy = http.createServer((req, res) => {
    const up = http.request({ host: '127.0.0.1', port: AX.port, method: req.method, path: req.url, headers: upHeaders(req) }, answer => {
      const headers = Object.assign({}, answer.headers);
      if (typeof headers.location === 'string' && headers.location.includes('127.0.0.1:' + AX.port)) {
        headers.location = headers.location.replace('http://127.0.0.1:' + AX.port, 'http://127.0.0.1:' + PROXY_PORT);
      }
      delete headers['content-encoding'];
      delete headers['transfer-encoding'];
      if (/text\/html/i.test(String(headers['content-type'] || ''))) {
        let body = '';
        answer.setEncoding('utf8');
        answer.on('data', d => { body += d; });
        answer.on('end', () => {
          body = body.replace(/<head([^>]*)>/i, '<head$1>' + LOCALE);
          delete headers['content-length'];
          res.writeHead(answer.statusCode || 200, headers);
          res.end(body);
        });
        return;
      }
      delete headers['content-length'];
      res.writeHead(answer.statusCode || 200, headers);
      answer.pipe(res);
    });
    up.on('error', e => { try { res.writeHead(502, { 'content-type': 'text/plain; charset=utf-8' }); res.end('ARTEX is not answering on port ' + AX.port + ': ' + e.message); } catch (x) { } });
    req.pipe(up);
  });
  proxy.on('upgrade', (req, socket, head) => {
    const up = net.connect(AX.port, '127.0.0.1', () => {
      let raw = req.method + ' ' + req.url + ' HTTP/1.1\r\n';
      for (let i = 0; i < req.rawHeaders.length; i += 2) {
        const k = req.rawHeaders[i], v = req.rawHeaders[i + 1];
        if (/^host$/i.test(k)) raw += 'Host: 127.0.0.1:' + AX.port + '\r\n';
        else if (/^origin$/i.test(k)) raw += 'Origin: http://127.0.0.1:' + AX.port + '\r\n';
        else raw += k + ': ' + v + '\r\n';
      }
      up.write(raw + '\r\n');
      if (head && head.length) up.write(head);
      socket.pipe(up); up.pipe(socket);
    });
    up.on('error', () => { try { socket.destroy(); } catch (e) { } });
    socket.on('error', () => { try { up.destroy(); } catch (e) { } });
  });
  proxy.on('error', () => { proxy = null; });
  try { proxy.listen(PROXY_PORT, '127.0.0.1'); proxy.unref(); } catch (e) { proxy = null; }
  return proxy;
}

const delay = ms => new Promise(r => setTimeout(r, ms));
const portUp = port => new Promise(r => { const s = net.connect({ host: '127.0.0.1', port }, () => { s.destroy(); r(true); }); s.on('error', () => r(false)); s.setTimeout(700, () => { s.destroy(); r(false); }); });
/* what is actually on disk, part by part, so the page can say what is missing instead of "not set up" */
function diagnose() {
  const missing = [];
  const has = p => { try { return fs.existsSync(p); } catch (e) { return false; } };
  if (!has(AX.exe)) missing.push({ key: 'exe', label: 'the ARTEX program (artex.exe)' });
  if (!has(path.join(PG.bin, 'pg_ctl.exe'))) missing.push({ key: 'pg', label: 'its PostgreSQL program files' });
  if (!has(path.join(PG.data, 'PG_VERSION'))) missing.push({ key: 'pgdata', label: 'its PostgreSQL data folder' });
  return { installed: !missing.length, missing };
}
const installed = () => diagnose().installed;
/* a pentest tool is a classic antivirus target: Defender quietly quarantines artex.exe and then the app looks "not set
   up". Check its own detection log (slow, so cached) to tell the two apart. */
let avChecked = 0, avFound = false;
function quarantined() {
  if (!installed() && Date.now() - avChecked < 60000) return avFound;
  avChecked = Date.now(); avFound = false;
  try {
    const out = cp.execFileSync('powershell', ['-NoProfile', '-NonInteractive', '-Command', "(Get-MpThreatDetection | Where-Object { $_.Resources -match 'artex' } | Select-Object -First 1).Resources"], { windowsHide: true, timeout: 8000 }).toString();
    avFound = /artex/i.test(out);
  } catch (e) { }
  return avFound;
}
/* the one-time setup token artex prints while no admin password is set; blank once a password exists */
function setupToken() { try { const m = /Setup token for the \/setup page:\s*([0-9a-f]+)/i.exec(fs.readFileSync(AX.err, 'utf8')); return m ? m[1] : ''; } catch (e) { return ''; } }
function killTree(pid) { try { cp.spawnSync('taskkill', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true }); } catch (e) { } }
/* the pid listening on a local TCP port, from netstat (so a reused server, started earlier, can still be stopped) */
function pidOnPort(port) { try { const out = cp.execSync('netstat -ano -p tcp', { windowsHide: true }).toString(); for (const ln of out.split('\n')) { const m = ln.match(/^\s*TCP\s+\S+:(\d+)\s+\S+\s+LISTENING\s+(\d+)/); if (m && +m[1] === port) return +m[2]; } } catch (e) { } return 0; }

/* the model actually used: the app's current chat model when Ollama has it, otherwise the first model Ollama has (a
   hardcoded name goes stale as soon as a model is renamed or removed, and ARTEX then sits idle) */
async function resolveModel(want) {
  let list = [];
  try { const r = await fetch('http://127.0.0.1:11434/api/tags'); list = ((await r.json()).models || []).map(m => m.name); } catch (e) { }
  if (want && (!list.length || list.includes(want))) return want;
  if (list.length) return list.includes('bonsai27b-agent:latest') ? 'bonsai27b-agent:latest' : list[0];
  return want || 'bonsai27b-agent:latest';
}
async function status() {
  const pg = await portUp(PG.port), ax = await portUp(AX.port), d = diagnose();
  if (ax) ensureProxy();
  return {
    installed: d.installed, missing: d.missing, quarantined: d.installed ? false : quarantined(), version: d.installed ? RELEASE.version : '', dir: AX.dir,
    pg, artex: ax, up: pg && ax, starting, port: AX.port, proxy: PROXY_PORT, direct: 'http://127.0.0.1:' + AX.port,
    /* the proxy port only when it is really listening: a frame pointed at a taken port is a blank page */
    url: 'http://127.0.0.1:' + (ax && proxy && proxy.listening ? PROXY_PORT : AX.port), model, setupToken: ax ? setupToken() : '',
  };
}
async function start(opts) {
  model = await resolveModel(opts && opts.model ? String(opts.model) : model);
  if (!installed()) {
    const d = diagnose(), av = quarantined();
    const error = av && d.missing.some(m => m.key === 'exe')
      ? 'Windows Defender (or another antivirus) removed artex.exe, so ARTEX cannot start. Install it again, then add the ARTEX folder as an exclusion.'
      : 'ARTEX is not installed yet: ' + (d.missing.map(m => m.label).join(', ') || 'something is missing') + ' is missing.';
    return { ok: false, error, ...(await status()) };
  }
  if (starting) return status();
  starting = true;
  try {
    if (!await portUp(PG.port)) {
      const log = fs.openSync(path.join(RT, 'pg.log'), 'a');
      pgProc = cp.spawn(path.join(PG.bin, 'postgres.exe'), ['-D', PG.data, '-p', String(PG.port), '-c', 'listen_addresses=127.0.0.1'], { stdio: ['ignore', log, log], windowsHide: true });
      pgProc.unref();
      for (let i = 0; i < 25 && !(await portUp(PG.port)); i++) await delay(400);
    }
    for (let i = 0; i < 40 && !pgReady(); i++) await delay(500);
    if (!await portUp(AX.port)) {
      const out = fs.openSync(AX.out, 'w'), err = fs.openSync(AX.err, 'w');
      axProc = cp.spawn(AX.exe, ['-addr', '127.0.0.1:' + AX.port, '-proxy='], { cwd: AX.dir, windowsHide: true, stdio: ['ignore', out, err], env: { ...process.env, ARTEX_LLM_PROVIDER: 'openai', ARTEX_LLM_BASE_URL: OLLAMA, ARTEX_LLM_MODEL: model, OPENAI_API_KEY: 'ollama-local', ARTEX_PG_DSN: DSN } });   // Ollama speaks the OpenAI API on /v1; provider 'openai' + this base URL keeps every call on this PC ('ollama' is not a provider ARTEX knows, and it silently idles)
      axProc.unref();
      for (let i = 0; i < 45 && !(await portUp(AX.port)); i++) await delay(400);
    }
  } catch (e) { starting = false; return { ok: false, error: String(e && e.message || e), ...(await status()) }; }
  starting = false;
  if (!await portUp(AX.port)) { const why = logTail(AX.err) || logTail(AX.out); return { ok: false, error: 'ARTEX did not finish starting' + (why ? ': ' + why : '.'), ...(await status()) }; }
  return status();
}
/* Install ARTEX's own program: download the pinned official release, check its published SHA-256, and unpack artex.exe
   into runtime/artex. Its data, skills and settings are left alone. */
async function install() {
  if (installed()) return { ok: true, ...(await status()) };
  try { fs.mkdirSync(AX.dir, { recursive: true }); fs.mkdirSync(path.join(RT, 'dl'), { recursive: true }); } catch (e) { }
  const zip = path.join(RT, 'dl', RELEASE.asset);
  try {
    const res = await fetch(RELEASE.url, { redirect: 'follow' });
    if (!res.ok) throw new Error('the download failed (HTTP ' + res.status + ')');
    const buf = Buffer.from(await res.arrayBuffer());
    if (crypto.createHash('sha256').update(buf).digest('hex') !== RELEASE.sha256) throw new Error('the download did not match its published checksum, so nothing was installed');
    fs.writeFileSync(zip, buf);
  } catch (e) {
    return { ok: false, error: 'Could not get the ARTEX program from its release: ' + String(e && e.message || e) + '.', ...(await status()) };
  }
  let tmp = '';
  try {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'artex-'));
    let r = cp.spawnSync('tar', ['-xf', zip, '-C', tmp], { windowsHide: true, timeout: 60000 });
    if (r.status !== 0) r = cp.spawnSync('powershell', ['-NoProfile', '-NonInteractive', '-Command', 'Expand-Archive -LiteralPath ' + JSON.stringify(zip) + ' -DestinationPath ' + JSON.stringify(tmp) + ' -Force'], { windowsHide: true, timeout: 120000 });
    const exe = findExe(tmp);
    if (!exe) throw new Error('the archive did not contain artex.exe');
    fs.copyFileSync(exe, AX.exe);
  } catch (e) {
    return { ok: false, error: 'Could not unpack the ARTEX program: ' + String(e && e.message || e) + '.', ...(await status()) };
  } finally { try { if (tmp) fs.rmSync(tmp, { recursive: true, force: true }); } catch (e) { } }
  try { fs.unlinkSync(zip); } catch (e) { }
  if (!fs.existsSync(AX.exe)) {
    avChecked = 0;
    return { ok: false, error: 'Windows Defender (or another antivirus) deleted artex.exe as soon as it was installed, because pentest tools look like hacking software to it. Add the folder below as an exclusion in Windows Security, then install again.', blocked: true, ...(await status()) };
  }
  avChecked = 0;
  return { ok: true, version: RELEASE.version, ...(await status()) };
}
/* the installed program, wherever the archive keeps it */
function findExe(dir) {
  let hit = '';
  const walk = d => {
    if (hit) return;
    let ents = []; try { ents = fs.readdirSync(d, { withFileTypes: true }); } catch (e) { return; }
    for (const e of ents) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (!hit && /^artex\.exe$/i.test(e.name)) hit = p;
      if (hit) return;
    }
  };
  walk(dir); return hit;
}

/* an open port is not the same as a database that answers: ARTEX exits at once with "the database system is starting
   up" if it connects too early, so wait for PostgreSQL's own readiness check before starting it */
function pgReady() {
  try { return cp.spawnSync(path.join(PG.bin, 'pg_isready.exe'), ['-h', '127.0.0.1', '-p', String(PG.port), '-d', 'artex'], { windowsHide: true, timeout: 5000 }).status === 0; } catch (e) { return false; }
}
function logTail(file) {
  try { const t = fs.readFileSync(file, 'utf8').trim().split('\n').filter(Boolean); const bad = t.filter(l => /FATAL|error|failed|panic/i.test(l)); return String((bad.length ? bad[bad.length - 1] : t[t.length - 1]) || '').slice(0, 300); } catch (e) { return ''; }
}

/* Stop just ARTEX (its database keeps running so the next open is quick). */
async function stop() { const pid = (axProc && axProc.pid) || pidOnPort(AX.port); if (pid) killTree(pid); axProc = null; return status(); }
/* Stop ARTEX and its database, for when Moundshroud itself closes. */
function stopAll() {
  const ap = (axProc && axProc.pid) || pidOnPort(AX.port); if (ap) killTree(ap);
  try { cp.spawnSync(path.join(PG.bin, 'pg_ctl.exe'), ['-D', PG.data, 'stop', '-m', 'fast'], { stdio: 'ignore', windowsHide: true, timeout: 9000 }); } catch (e) { }
  const pp = pidOnPort(PG.port); if (pp) killTree(pp);
  axProc = null; pgProc = null;
}
module.exports = { status, start, stop, stopAll, install, diagnose, installed, RELEASE, PORT: AX.port, PROXY_PORT, ensureProxy };

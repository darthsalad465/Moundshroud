// Phone access: a small, separate web server so your phone can talk to Moundshroud's AI and agents.
// It is OFF until you switch it on in Settings › Phone access. It listens only on the addresses you choose:
//   - Home Wi-Fi: this PC's address on your home network (the adapter that has a router), reachable at home only.
//   - Tailscale: this PC's Tailscale address (100.x.y.z), reachable from anywhere through your own private Tailscale network.
// It never listens on every address, never on the VirtualBox or Hyper-V adapters, and it serves only the phone page and a
// short list of actions (chat with a local model, the agent, routines, pictures). Everything else answers 404.
// A PIN you choose unlocks it (stored as a scrypt hash); each phone then gets a long random key in a cookie (stored hashed).
// 5 wrong PINs from one address lock that address out for 15 minutes. Requests must carry the X-MS header, so another
// web page cannot send them for you, and the Host header must be this PC's address (blocks DNS rebinding).
const fs = require('fs'), path = require('path'), http = require('http'), os = require('os'), crypto = require('crypto'), cp = require('child_process');

const DEF = { mode: 'off', port: 47240, pin: null, tokens: [] };
const MODES = ['off', 'lan', 'tailscale', 'both'];
const TS_EXE = 'C:\\Program Files\\Tailscale\\tailscale.exe';
const isTs = ip => /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(ip);            // 100.64.0.0/10
const isPrivate = ip => /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(ip);
const sha = s => crypto.createHash('sha256').update(String(s)).digest('hex');

/* this PC's home-network address: the address of the adapter the default route (the router) goes through, read from
   `route print` in the background (fast, and it never holds the server up); the lowest metric wins */
let lanCache = { at: 0, ip: '', busy: false };
function lanRefresh(done) {
  if (lanCache.busy) return; lanCache.busy = true;
  cp.execFile('route.exe', ['print', '-4', '0.0.0.0'], { windowsHide: true, timeout: 5000 }, (e, out) => {
    lanCache.busy = false; let best = null;
    for (const l of String(out || '').split(/\r?\n/)) { const m = /^\s*0\.0\.0\.0\s+0\.0\.0\.0\s+(\d+\.\d+\.\d+\.\d+)\s+(\d+\.\d+\.\d+\.\d+)\s+(\d+)/.exec(l); if (m && isPrivate(m[2]) && !isTs(m[2]) && (!best || +m[3] < best.metric)) best = { ip: m[2], metric: +m[3] }; }
    const was = lanCache.ip; lanCache.ip = best ? best.ip : ''; lanCache.at = Date.now();
    if (done && was !== lanCache.ip) done();
  });
}
function lanIp() { if (Date.now() - lanCache.at > 60000) lanRefresh(); return lanCache.ip; }
const lanIpNow = () => new Promise(r => { if (lanCache.at) return r(lanCache.ip); lanRefresh(); const t = setInterval(() => { if (lanCache.at) { clearInterval(t); r(lanCache.ip); } }, 50); setTimeout(() => { clearInterval(t); r(lanCache.ip); }, 5500); });
function tsIp() {
  for (const list of Object.values(os.networkInterfaces())) for (const a of list || []) if (a.family === 'IPv4' && isTs(a.address)) return a.address;
  return '';
}
const tsInstalled = () => fs.existsSync(TS_EXE);

function create(deps) {
  const file = path.join(deps.dataDir, 'remote.json'), flag = path.join(deps.dataDir, 'remote-on');
  let C = load(), servers = [], fails = {};
  function load() { try { return Object.assign({}, DEF, JSON.parse(fs.readFileSync(file, 'utf8'))); } catch (e) { return Object.assign({}, DEF); } }
  function save() { const t = file + '.tmp'; fs.writeFileSync(t, JSON.stringify(C, null, 1)); fs.renameSync(t, file); try { if (C.mode !== 'off' && C.pin) fs.writeFileSync(flag, '1'); else fs.unlinkSync(flag); } catch (e) { } }

  /* ---- PIN and phone keys ---- */
  const hashPin = (pin, salt) => crypto.scryptSync(String(pin), salt, 32).toString('hex');
  function setPin(pin) {
    pin = String(pin || '').trim(); if (!/^\d{6,12}$/.test(pin)) return { ok: false, error: 'Use 6 to 12 digits.' };
    const salt = crypto.randomBytes(16).toString('hex'); C.pin = { salt, hash: hashPin(pin, salt) }; C.tokens = []; save(); restart(); return { ok: true };
  }
  function checkPin(pin) { if (!C.pin) return false; const h = hashPin(String(pin || ''), C.pin.salt); return h.length === C.pin.hash.length && crypto.timingSafeEqual(Buffer.from(h), Buffer.from(C.pin.hash)); }
  function newToken(ua) { const t = crypto.randomBytes(32).toString('hex'); C.tokens = [{ h: sha(t), at: Date.now(), seen: Date.now(), ua: String(ua || '').slice(0, 120) }].concat(C.tokens).slice(0, 10); save(); return t; }
  function tokenOk(req) {
    const m = /(?:^|;\s*)ms_r=([0-9a-f]{64})/.exec(req.headers.cookie || ''); if (!m) return false;
    const h = sha(m[1]), t = C.tokens.find(x => x.h === h); if (!t) return false;
    if (Date.now() - t.at > 60 * 86400000) return false;                         // a phone key lasts 60 days
    if (Date.now() - t.seen > 3600000) { t.seen = Date.now(); save(); }
    return true;
  }

  /* ---- the addresses it listens on ---- */
  function wanted() {
    const out = [];
    if (C.mode === 'off' || !C.pin) return out;
    if (deps.loopback) return [{ kind: 'test', ip: '127.0.0.1' }];      // tests only: this PC alone, so no firewall question appears
    if (C.mode === 'lan' || C.mode === 'both') { const ip = lanIp(); if (ip) out.push({ kind: 'lan', ip }); }
    if (C.mode === 'tailscale' || C.mode === 'both') { const ip = tsIp(); if (ip) out.push({ kind: 'tailscale', ip }); }
    return out;
  }
  function restart() {
    servers.forEach(s => { try { s.srv.close(); } catch (e) { } }); servers = [];
    for (const w of wanted()) {
      const srv = http.createServer((req, res) => handle(req, res, w).catch(e => { try { if (!res.headersSent) send(res, 500, { error: 'Something went wrong.' }); else res.end(); } catch (x) { } }));
      srv.on('error', e => { w.error = e.message; });
      srv.listen(C.port, w.ip); servers.push({ srv, w });
    }
  }
  /* Tailscale can come up after Moundshroud: look again every minute */
  const watch = setInterval(() => { if (!started) return; const now = wanted().map(w => w.ip).join(','), on = servers.map(s => s.w.ip).join(','); if (now !== on) restart(); }, 60000);
  if (watch.unref) watch.unref();

  /* ---- requests ---- */
  const SEC = { 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'X-Frame-Options': 'DENY', 'Cache-Control': 'no-store',
    'Content-Security-Policy': "default-src 'self'; img-src 'self' blob: data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'" };
  const send = (res, code, obj) => { res.writeHead(code, Object.assign({ 'Content-Type': 'application/json; charset=utf-8' }, SEC)); res.end(JSON.stringify(obj)); };
  const body = (req, limit) => new Promise((ok, no) => { let n = 0; const ch = []; req.on('data', d => { n += d.length; if (n > limit) { no(new Error('too big')); req.destroy(); } else ch.push(d); }); req.on('end', () => { try { ok(JSON.parse(Buffer.concat(ch).toString('utf8') || '{}')); } catch (e) { ok({}); } }); req.on('error', no); });
  const STATIC = { '/': ['phone.html', 'text/html; charset=utf-8'], '/phone.js': ['phone.js', 'text/javascript; charset=utf-8'], '/phone.css': ['phone.css', 'text/css; charset=utf-8'], '/manifest.json': ['phone-manifest.json', 'application/manifest+json'], '/icon.png': ['logo-256.png', 'image/png'] };

  async function handle(req, res, w) {
    const host = String(req.headers.host || '');
    if (host !== w.ip + ':' + C.port && host !== w.ip) { res.writeHead(421); return res.end(); }        // only this PC's own address
    const u = new URL(req.url, 'http://x'), p = u.pathname, ip = req.socket.remoteAddress || '';
    if (req.method === 'GET' && STATIC[p]) {
      const [f, type] = STATIC[p];
      return fs.readFile(path.join(deps.webDir, f), (e, buf) => { if (e) { res.writeHead(404, SEC); return res.end(); } res.writeHead(200, Object.assign({}, SEC, { 'Content-Type': type, 'Cache-Control': 'no-cache' })); res.end(buf); });
    }
    if (!p.startsWith('/r/')) { res.writeHead(404, SEC); return res.end(); }
    if (req.method !== 'GET' && req.method !== 'POST') { res.writeHead(405, SEC); return res.end(); }
    if (req.headers['x-ms'] !== '1') return send(res, 403, { error: 'missing header' });
    if (p === '/r/login' && req.method === 'POST') {
      const f = fails[ip] || { n: 0, until: 0 };
      if (f.until > Date.now()) return send(res, 429, { error: 'Too many wrong PINs. Try again in ' + Math.ceil((f.until - Date.now()) / 60000) + ' minutes.' });
      const b = await body(req, 1e3);
      if (!checkPin(b.pin)) { f.n++; if (f.n >= 5) { f.until = Date.now() + 15 * 60000; f.n = 0; } fails[ip] = f; return send(res, 401, { error: 'Wrong PIN.' }); }
      delete fails[ip]; const t = newToken(req.headers['user-agent']);
      res.writeHead(200, Object.assign({ 'Content-Type': 'application/json', 'Set-Cookie': 'ms_r=' + t + '; Path=/; HttpOnly; SameSite=Strict; Max-Age=' + 60 * 86400 }, SEC));
      return res.end(JSON.stringify({ ok: true }));
    }
    if (!tokenOk(req)) return send(res, 401, { error: 'locked', locked: true });
    if (p === '/r/logout' && req.method === 'POST') { const m = /ms_r=([0-9a-f]{64})/.exec(req.headers.cookie || ''); if (m) { C.tokens = C.tokens.filter(x => x.h !== sha(m[1])); save(); } return send(res, 200, { ok: true }); }
    /* the actions the phone may use; each is a function the main server handed over */
    const R = deps.routes, q = Object.fromEntries(u.searchParams), key = req.method + ' ' + p.slice(2);
    const fn = R[key]; if (!fn) return send(res, 404, { error: 'not here' });
    const b = req.method === 'POST' ? await body(req, 2e6) : {};
    return fn({ q, b, res, send: (code, obj) => send(res, code, obj), sec: SEC });
  }

  function status() {
    const ts = tsIp(), lan = lanIp();
    /* the network adapters with their hardware (MAC) address, for Wake-on-LAN apps; the virtual ones are left out */
    const adapters = []; for (const [name, list] of Object.entries(os.networkInterfaces())) for (const a of list || []) if (a.family === 'IPv4' && !a.internal && !/vEthernet|VirtualBox|VMware|Loopback|Tailscale/i.test(name) && !/^192\.168\.56\./.test(a.address) && !isTs(a.address)) adapters.push({ name, ip: a.address, mac: a.mac });
    return { mode: C.mode, port: C.port, hasPin: !!C.pin, phones: C.tokens.length, lan: { ip: lan }, tailscale: { installed: tsInstalled(), ip: ts }, adapters,
      listening: servers.map(s => ({ kind: s.w.kind, url: 'http://' + s.w.ip + ':' + C.port, error: s.w.error || '' })) };
  }
  function config(o) {
    if (o.mode != null) { if (!MODES.includes(o.mode)) return { ok: false, error: 'Unknown mode.' }; if (o.mode !== 'off' && !C.pin) return { ok: false, error: 'Set a PIN first.' }; C.mode = o.mode; }
    if (o.port != null) { const n = Math.round(+o.port); if (!(n >= 1024 && n <= 65535) || n === deps.mainPort) return { ok: false, error: 'Pick a port from 1024 to 65535.' }; C.port = n; }
    save(); restart(); return Object.assign({ ok: true }, status());
  }
  function forgetPhones() { C.tokens = []; save(); return { ok: true }; }
  const on = () => C.mode !== 'off' && !!C.pin;
  /* the home address is known in a moment; listen once it is. The server starts this only after it owns its own address
     (deps.deferStart), so a second copy of Moundshroud never opens the phone address. */
  let started = false; const start = () => { if (started) return; started = true; lanIpNow().then(restart); };
  if (!deps.deferStart) start();
  return { status, config, setPin, forgetPhones, on, start, stop: () => { clearInterval(watch); servers.forEach(s => { try { s.srv.close(); } catch (e) { } }); servers = []; }, _t: { checkPin, isTs, isPrivate } };
}

module.exports = { create, isTs, isPrivate, lanIpNow };

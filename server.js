// Offline assistant suite - local server. Talks only to Ollama and Kiwix on this PC. No outside connections.
// Lifecycle: started by the hotkey listener when you open the window; shuts itself (and everything it started) down when the window closes.
const http = require('http'), fs = require('fs'), path = require('path'), cp = require('child_process');
const U = require('./lib/util'), docs = require('./lib/docs'), kiwix = require('./lib/kiwix'), websearch = require('./lib/websearch'), voice = require('./lib/voice'), store = require('./lib/store'), extra = require('./lib/extra'), thesaurus = require('./lib/thesaurus'), rhyme = require('./lib/rhyme'), pcmod = require('./lib/pc'), office = require('./lib/office'), prep = require('./lib/prep'), appfiles = require('./lib/appfiles');

const safe = require('./lib/safe');
const problems = require('./lib/problems');
const cloud = require('./lib/cloud');
const net = require('./lib/net');
const news = require('./lib/news');
const privacy = require('./lib/privacy');
const markets = require('./lib/markets');
const inventory = require('./lib/inventory');
const vault = require('./lib/vault');
const photos = require('./lib/photos');
const mail = require('./lib/mail');
const lichess = require('./lib/lichess');
const appmap = require('./lib/appmap');
const update = require('./lib/update');
const ROOT = __dirname, DATA = path.join(ROOT, 'data'), WEB = path.join(ROOT, 'web'), CHEF = path.join(ROOT, 'nomad', 'cyberchef');
fs.mkdirSync(DATA, { recursive: true });
const PORT = +process.env.MOUNDSHROUD_PORT || +process.env.ATLAS_PORT || 47231, OLLAMA = { host: '127.0.0.1', port: 11434 };
const LIBPORT = PORT + 9;                       // the offline library's own address (see the end of this file); the window works it out the same way
try { require('./lib/migrate').run(); } catch (e) { }                      // one-time tidy-ups left over from the rename
const OLLAMA_EXE =path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Ollama', 'ollama.exe');
const CHATS = path.join(DATA, 'chats.json');
const started = Date.now();
let kiwixWarm = false, incoming = null, spawnedOllama = null, lastPing = 0, seen = false, closingAt = 0, down = false;

function killTree(pid) { try { cp.spawnSync('taskkill', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true }); } catch (e) {} }
function cleanup() {
  if (spawnedOllama && spawnedOllama.pid) { killTree(spawnedOllama.pid); spawnedOllama = null; }
  kiwix.stop(); voice.stop(); docs.close(); try { office.stop(); } catch (e) {}
}
try { require('./lib/chess-sf').setActive(() => Date.now() - lastPing < 90000); } catch (e) { }
function shutdown() { if (down) return; down = true; cleanup(); setTimeout(() => process.exit(0), 200); }
process.on('exit', cleanup); process.on('SIGINT', shutdown); process.on('SIGTERM', shutdown);
/* Nothing should be able to take the app down without a trace. A stray throw in a callback used to end the server (the window
   then showed "page not found", with no clue why and no way to see it). Now it is written to data\problems.log and the app keeps
   serving; if it keeps happening in a burst, the log says so and the page can offer a restart. */
let crashBurst = [];
function caught(kind, e) {
  const row = problems.note(kind, problems.errText(e));
  try { console.error('[' + row.kind + '] ' + row.text); } catch (x) { }
  const now = Date.now(); crashBurst = crashBurst.filter(t => now - t < 60000); crashBurst.push(now);
  if (crashBurst.length === 12) problems.note('crash', 'Twelve failures in a minute: something is badly wrong, restart Moundshroud from the tray.');
}
process.on('uncaughtException', e => caught('crash', e));
process.on('unhandledRejection', e => caught('promise', e));
problems.note('start', 'Moundshroud started (pid ' + process.pid + ')');

/* a crash or a force-stop can leave model processes behind that hold the graphics memory and stop the next model from loading.
   At start-up, if the AI engine itself is not running but its model runners are, they are orphans: clear them. */
setTimeout(() => { const probe = http.get({ ...OLLAMA, path: '/api/version', timeout: 1200 }, r => r.resume()); probe.on('error', () => { try { cp.spawnSync('taskkill', ['/IM', 'llama-server.exe', '/F'], { stdio: 'ignore', windowsHide: true }); } catch (e) {} }); probe.on('timeout', () => probe.destroy()); }, 400);

/* ---------------- Ollama ---------------- */
function ollamaUp(cb) {
  let done = false; const fin = v => { if (!done) { done = true; cb(v); } };
  const r = http.get({ ...OLLAMA, path: '/api/version', timeout: 1500 }, res => { res.resume(); fin(true); });
  r.on('error', () => fin(false)); r.on('timeout', () => { r.destroy(); fin(false); });
}
let starting = null;
function ensureOllama(cb) {
  ollamaUp(up => {
    if (up) return cb(true);
    if (!starting) {
      starting = new Promise(resolve => {
        try { spawnedOllama = cp.spawn(OLLAMA_EXE, ['serve'], { stdio: 'ignore', windowsHide: true, env: { ...process.env, OLLAMA_KEEP_ALIVE: '3m' } }); spawnedOllama.on('exit', () => { spawnedOllama = null; }); }
        catch (e) { return resolve(false); }
        let n = 0; const t = setInterval(() => ollamaUp(u => { if (u || ++n > 80) { clearInterval(t); resolve(u); } }), 500);
      }).finally(() => { starting = null; });
    }
    starting.then(cb);
  });
}
/* the local model used when a request needs the app's own tools (the AI buttons in chat) or when Claude is not chosen */
const SMALL_RE = /qwen3\.[0-9]:(2|0\.8)b|:(0\.\d|[1-3](\.\d)?)b\b/i;
function localModelName() {
  const c = cloud.cfg(); if (c.local && !cloud.isCloud(c.local)) return Promise.resolve(c.local);
  return new Promise(resolve => {
    const r = http.get({ ...OLLAMA, path: '/api/tags', timeout: 2500 }, x => {
      let b = ''; x.on('data', d => b += d);
      x.on('end', () => {
        try {
          const ms = (JSON.parse(b).models || []).filter(m => m && m.name);
          const big = ms.filter(m => !SMALL_RE.test(m.name)).sort((a, z) => (z.size || 0) - (a.size || 0));
          resolve((big[0] || ms[0] || {}).name || '');
        } catch (e) { resolve(''); }
      });
    });
    r.on('error', () => resolve('')); r.on('timeout', () => { r.destroy(); resolve(''); });
  });
}
/* the local engine, straight through: the streaming shape the whole app reads */
function ollamaChat(payload, res) {
  return ensureOllama(up => {
    if (!up) return json(res, 503, { error: 'Ollama could not be started' });
    const pr = http.request({ ...OLLAMA, path: '/api/chat', method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } }, r => { res.writeHead(r.statusCode, { 'Content-Type': 'application/x-ndjson', 'Cache-Control': 'no-store' }); r.pipe(res); });
    pr.on('error', e => { if (!res.headersSent) json(res, 502, { error: String(e.message) }); else res.end(); });
    res.on('close', () => pr.destroy()); pr.end(payload);
  });
}

/* ---------------- helpers ---------------- */
function bodyBuf(req, limit = 8e6) {
  return new Promise((res, rej) => { const ch = []; let n = 0; req.on('data', c => { n += c.length; if (n > limit) { rej(new Error('too large')); req.destroy(); } else ch.push(c); }); req.on('end', () => res(Buffer.concat(ch))); req.on('error', rej); });
}
const body = async (req, limit) => (await bodyBuf(req, limit)).toString('utf8');
const jbody = async (req, limit) => { const t = await body(req, limit); return t ? JSON.parse(t) : {}; };
function json(res, code, obj) { res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(obj)); }
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.wasm': 'application/wasm', '.txt': 'text/plain; charset=utf-8', '.map': 'application/json', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.ogg': 'audio/ogg', '.mp3': 'audio/mpeg' };
const CHESSBOOKS = path.join(__dirname, 'nomad', 'chessbooks');
/* the picture model: the compact ready-made q8 copy (3.9 GB) when it is there, else the original (6.5 GB, made compact in memory each time) */
const SD_EXE = path.join(__dirname, 'imggen', 'bin', 'sd-cli.exe'), SD_Q8 = path.join(__dirname, 'imggen', 'models', 'sd_xl_turbo_1.0_q8_0.gguf'), SD_FULL = path.join(__dirname, 'imggen', 'models', 'sd_xl_turbo_1.0_fp16.safetensors'); let sdBusy = false;
const sdModel = () => { try { if (fs.existsSync(SD_Q8)) return { file: SD_Q8, args: [] }; } catch (e) { } return { file: SD_FULL, args: ['--type', 'q8_0'] }; };
const MG_PY = path.join(__dirname, 'musicgen', 'venv', 'Scripts', 'python.exe'), MG_GEN = path.join(__dirname, 'musicgen', 'gen.py'), MG_MODEL = path.join(__dirname, 'musicgen', 'models', 'musicgen-small', 'config.json'); let mgBusy = false;
const mgReady = () => { try { return fs.existsSync(MG_PY) && fs.existsSync(MG_GEN) && fs.existsSync(MG_MODEL); } catch (e) { return false; } };
const sdReady = () => { try { return fs.existsSync(SD_EXE) && fs.existsSync(sdModel().file); } catch (e) { return false; } };
/* the picture model needs the graphics card's memory, so ask Ollama to let go of any model it is holding (it reloads by itself the next time you chat) */
const sdUnloadOllama = () => new Promise(done => { let fin = false; const end = () => { if (!fin) { fin = true; done(); } }; const q = http.request({ ...OLLAMA, path: '/api/ps', method: 'GET' }, r => { let t = ''; r.on('data', c => t += c); r.on('end', () => { try { const ms = (JSON.parse(t).models || []).map(m => m.name); let n = ms.length; if (!n) return end(); ms.forEach(name => { const p = JSON.stringify({ model: name, keep_alive: 0 }); const g = http.request({ ...OLLAMA, path: '/api/generate', method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(p) } }, x => { x.resume(); x.on('end', () => { if (!--n) setTimeout(end, 600); }); }); g.on('error', () => { if (!--n) end(); }); g.end(p); }); } catch (e) { end(); } }); }); q.on('error', end); q.setTimeout(3000, () => { q.destroy(); end(); }); q.end(); });
function serveFile(res, root, rel, req) {
  const f = path.normalize(path.join(root, rel)), inside = path.relative(root, f);          // must really be inside the folder (not just share its first letters)
  if (String(rel).includes('\0') || inside.startsWith('..') || path.isAbsolute(inside) || !fs.existsSync(f) || !fs.statSync(f).isFile()) { res.writeHead(404); return res.end('not found'); }
  const type = MIME[path.extname(f).toLowerCase()] || 'application/octet-stream', size = fs.statSync(f).size, h = { 'Content-Type': type, 'Cache-Control': 'no-store', 'Accept-Ranges': 'bytes' };
  // byte ranges, so audio can show its length and be seeked
  const m = req && req.headers && req.headers.range ? /^bytes=(\d*)-(\d*)$/.exec(req.headers.range) : null;
  if (m && (m[1] !== '' || m[2] !== '')) {
    let a = m[1] === '' ? Math.max(0, size - +m[2]) : +m[1], b = m[1] === '' || m[2] === '' ? size - 1 : Math.min(+m[2], size - 1);
    if (a > b || a >= size) { res.writeHead(416, { 'Content-Range': 'bytes */' + size }); return res.end(); }
    res.writeHead(206, Object.assign(h, { 'Content-Range': 'bytes ' + a + '-' + b + '/' + size, 'Content-Length': b - a + 1 }));
    return fs.createReadStream(f, { start: a, end: b }).pipe(res);
  }
  h['Content-Length'] = size; res.writeHead(200, h);
  fs.createReadStream(f).pipe(res);
}
function chatsSearch(q) {
  const toks = (q.toLowerCase().match(/[\p{L}\p{N}]+/gu) || []).filter(t => t.length > 2).slice(0, 8); if (!toks.length) return [];
  let chats = []; try { chats = JSON.parse(fs.readFileSync(CHATS, 'utf8')); } catch (e) {}
  const out = [];
  for (const c of chats) {
    let best = null, score = 0;
    for (const m of c.messages || []) { const t = (m.display || m.content || '').toLowerCase(); let s = 0; for (const k of toks) if (t.includes(k)) s++; if (s > score) { score = s; best = m; } }
    if (score > 0) { const t = (best.display || best.content || '').replace(/\s+/g, ' '); const i = Math.max(0, t.toLowerCase().indexOf(toks.find(k => t.toLowerCase().includes(k)))); out.push({ id: c.id, title: c.title, snippet: t.slice(Math.max(0, i - 40), i + 140), score }); }
  }
  return out.sort((a, b) => b.score - a.score).slice(0, 5);
}
/* read the text in a picture with the OCR engine built into Windows (ocr.ps1) */
const ocrImage = buf => new Promise(resolve => {
  if (!buf || buf.length < 100) return resolve({ error: 'No image received.' });
  const f = path.join(require('os').tmpdir(), 'moundshroud-ocr-' + Date.now() + '.png');
  fs.writeFile(f, buf, err => {
    if (err) return resolve({ error: 'Could not store the image.' });
    cp.execFile('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.join(ROOT, 'ocr.ps1'), f], { timeout: 40000, windowsHide: true, maxBuffer: 8e6 }, (e, out, errOut) => { fs.unlink(f, () => { }); if (e) return resolve({ error: String(errOut || e.message || 'OCR failed').slice(0, 200) }); resolve({ text: String(out || '').trim() }); });
  });
});
const officeEdit = require('./lib/office-edit');
const within = (p, r) => { const a = path.normalize(p).toLowerCase(), b = path.normalize(r).replace(/[\\/]+$/, '').toLowerCase(); return a === b || a.startsWith(b + path.sep); };   // inside the folder, not merely sharing its first letters
const allowedPath = p => { p = path.normalize(String(p || '')); if (p.includes('\0')) return false; const roots = [...docs.sources(), store.NOTES, office.OUT, office.PREV]; return (roots.some(r => within(p, r)) || officeEdit.allowed(p)) && fs.existsSync(p); };

/* ---- who may talk to this server ----
   Only the Moundshroud window. A web page open in your browser can send requests to localhost too, so every request must name this server in
   its Host header (blocks DNS rebinding), and any Origin / Sec-Fetch-Site the browser adds must say "this same site" (blocks cross-site
   requests). The tray helper and scripts send neither header and are unaffected. */
const SELF = new Set(['127.0.0.1:' + PORT, 'localhost:' + PORT]), SELF_ORIGIN = new Set(['http://127.0.0.1:' + PORT, 'http://localhost:' + PORT]);
const CSP = "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' blob: data:; worker-src 'self' blob:; frame-src 'self' blob: data: http://127.0.0.1:" + LIBPORT + " http://localhost:" + LIBPORT + "; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'self'";
function allowedCaller(req) {
  const h = req.headers, host = String(h.host || '').toLowerCase(), org = h.origin, sfs = h['sec-fetch-site'];
  return SELF.has(host) && (!org || SELF_ORIGIN.has(String(org).toLowerCase())) && (!sfs || sfs === 'same-origin' || sfs === 'none');
}
const mainServer = http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://127.0.0.1'); const url = u.pathname, q = u.searchParams;
  if (!allowedCaller(req)) { res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' }); return res.end('Blocked: this request did not come from the Moundshroud window.'); }
  res.setHeader('X-Content-Type-Options', 'nosniff'); res.setHeader('Referrer-Policy', 'no-referrer'); res.setHeader('X-Frame-Options', 'SAMEORIGIN'); res.setHeader('Cross-Origin-Resource-Policy', 'same-origin'); res.setHeader('Content-Security-Policy', CSP);
  try {
    /* ---- pages & static files ---- */
    if (req.method === 'GET' && (url === '/' || url === '/index.html')) return serveFile(res, WEB, 'index.html', req);
    if (req.method === 'GET' && url.startsWith('/web/')) return serveFile(res, WEB, url.slice(5), req);
    if (req.method === 'GET' && url.startsWith('/chessbooks/')) { let rel = ''; try { rel = decodeURIComponent(url.slice(12)); } catch (e) { res.writeHead(400); return res.end('bad path'); } return serveFile(res, CHESSBOOKS, rel, req); }
    if (req.method === 'GET' && url.startsWith('/cyberchef')) {
      let rel = url.slice('/cyberchef'.length).replace(/^\//, '');
      if (!rel) { const h = fs.existsSync(CHEF) ? fs.readdirSync(CHEF).find(f => /^CyberChef_v.*\.html$/.test(f)) : null; if (!h) { res.writeHead(404); return res.end('CyberChef is not installed'); } rel = h; }
      return serveFile(res, CHEF, decodeURIComponent(rel));
    }
    /* ---- offline library pages are served by Kiwix under /wiki so the window stays same-origin ---- */
    if (url === '/wiki' || url.startsWith('/wiki/')) {
      return kiwix.ensure(ok => {
        if (!ok) { res.writeHead(503, { 'Content-Type': 'text/plain' }); return res.end('The offline library is not installed'); }
        const h = { ...req.headers }; delete h.host;
        /* a library page opened on the app's own address could reach the app: there it is shown without scripts and walled off (pages belong on the library's address) */
        const pr = http.request({ host: '127.0.0.1', port: kiwix.PORT, path: req.url, method: req.method, headers: h }, r => { const hd = Object.assign({}, r.headers); if (/text\/html/i.test(String(hd['content-type'] || ''))) hd['content-security-policy'] = "sandbox; default-src 'none'; img-src 'self' data:; style-src 'self' 'unsafe-inline'"; res.writeHead(r.statusCode, hd); r.pipe(res); });
        pr.on('error', () => { if (!res.headersSent) res.writeHead(502); res.end(); });
        res.on('close', () => pr.destroy()); req.pipe(pr);
      });
    }
    /* ---- lifecycle ---- */
    if (url === '/api/status') return ollamaUp(up => json(res, 200, { ok: true, ollama: up, lib: kiwix.available(), voice: voice.available(), chef: fs.existsSync(CHEF) }));
    if (url === '/api/ping') { lastPing = Date.now(); seen = true; closingAt = 0; if (!kiwixWarm && kiwix.available()) { kiwixWarm = true; setTimeout(() => kiwix.ensureP().catch(() => {}), 2500); } return json(res, 200, { ok: true }); }     // start the library in the background so the first lookup is instant
    if (url === '/api/closing') { closingAt = Date.now() + 6000; return json(res, 200, { ok: true }); }
    if (url === '/api/shutdown') { json(res, 200, { ok: true }); return setTimeout(shutdown, 50); }
    if (url === '/api/warm' && req.method === 'POST') {
      const m = (await jbody(req, 1e5)).model || ''; json(res, 200, { ok: true }); if (!m) return;
      return ensureOllama(up => { if (!up) return; const p = JSON.stringify({ model: m, prompt: '', stream: false, keep_alive: '3m' });
        const r = http.request({ ...OLLAMA, path: '/api/generate', method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(p) } }, x => x.resume()); r.on('error', () => {}); r.end(p); });
    }
    /* ---- AI ---- */
    /* the model list the picker shows: Claude models first when a key is saved, then the local ones */
    if (url === '/api/models') {
      const cs = cloud.status();
      const cloudList = cs.on ? cs.models.map(m => ({ name: m.id, size: 0, cloud: true, label: '☁ ' + m.name + (m.note ? ' - ' + m.note : '') })) : [];
      return ensureOllama(up => {
        if (!up) return json(res, 200, { ollama: false, cloud: cs.on, models: cloudList });
        http.get({ ...OLLAMA, path: '/api/tags' }, r => { let b = ''; r.on('data', c => b += c); r.on('end', () => { try { const j = JSON.parse(b); json(res, 200, { ollama: true, cloud: cs.on, models: cloudList.concat((j.models || []).map(m => ({ name: m.name, size: m.size }))) }); } catch (e) { json(res, 200, { ollama: true, cloud: cs.on, models: cloudList }); } }); })
          .on('error', () => json(res, 200, { ollama: false, cloud: cs.on, models: cloudList }));
      });
    }
    /* AI: a local model, or Claude when the user has saved a key and picked a Claude model. Both answer in the same shape,
       so every feature in the app (chat, the buddy, quizzes, documents, the chess coach) works with either. */
    if (url === '/api/chat' && req.method === 'POST') {
      const payload = await body(req);
      let b = null; try { b = JSON.parse(payload); } catch (e) { b = null; }
      const cc = cloud.cfg();
      const isCloud = !!(b && cloud.isCloud(b.model) && cc.key);
      /* pressing buttons in the app needs the local model: Anthropic tool schemas are a different shape, and an action
         that quietly did nothing would be worse than answering locally. The model name is swapped so it still works. */
      if (isCloud && b.tools) {
        const local = await localModelName();
        if (local) { b.model = local; cloud.set({ local }); return ollamaChat(JSON.stringify(b), res); }
        delete b.tools;
      }
      if (isCloud) {
        if (b.stream) return cloud.streamTo(b, res);
        return cloud.once(b, r => json(res, 200, r));
      }
      if (b && b.model && !cloud.isCloud(b.model) && b.model !== cc.local) cloud.set({ local: String(b.model) });   // remember it for the tool case above
      return ollamaChat(payload, res);
    }
    /* ---- Claude (Anthropic) and internet access: settings, a live check, and the two web calls ---- */
    if (url === '/api/cloud') {
      if (req.method === 'GET') return json(res, 200, cloud.status());
      const b = await jbody(req, 2e5);
      if (b.forget) return json(res, 200, cloud.set({ key: '', model: '' }));
      const patch = {};
      if (typeof b.key === 'string') { const k = b.key.trim(); const bad = cloud.keyProblem(k); if (bad) return json(res, 400, { error: bad }); patch.key = k; }
      if (typeof b.model === 'string') patch.model = b.model.trim();
      if (typeof b.web === 'boolean') patch.web = b.web;
      let st = cloud.set(patch);
      /* a new key: read the live model list straight away and pick a sensible model, so nothing has to be chosen by hand */
      if (patch.key && !patch.model) {
        const r = await cloud.refreshModels().catch(() => null);
        const first = r && r.models && r.models.length ? r.models[0].id : '';
        if (first && !cloud.cfg().model) st = cloud.set({ model: first });
      }
      return json(res, 200, st);
    }
    if (url === '/api/cloud/models') { const r = await cloud.refreshModels(); return json(res, 200, Object.assign({ status: cloud.status() }, r)); }
    if (url === '/api/cloud/test' && req.method === 'POST') return json(res, 200, await cloud.test());
    if (url === '/api/net/search' && req.method === 'POST') { const b = await jbody(req, 1e5); return json(res, 200, await net.search(b.q, b.n)); }
    if (url === '/api/net/page' && req.method === 'POST') { const b = await jbody(req, 1e5); return json(res, 200, await net.page(b.url)); }
    /* ---- News: the last edition (readable offline), a refresh (only with internet access on), and the source list ---- */
    /* ---- Privacy: what can leave this PC, and the window's own settings ---- */
    if (url === '/api/privacy') {
      if (req.method === 'POST') { const b = await jbody(req, 1e4); if (typeof b.signout === 'boolean') privacy.setChoice({ signout: b.signout }); }
      const cs = cloud.status(), np = news.prefsPublic();
      return json(res, 200, privacy.status({ internet: net.on(), claude: !!(cs && cs.on), news: np }));
    }
    if (url === '/api/news') return json(res, 200, news.snapshot());
    if (url === '/api/news/forget' && req.method === 'POST') return json(res, 200, news.forget());
    if (url === '/api/news/access' && req.method === 'POST') { const b = await jbody(req, 1e4); return json(res, 200, await news.checkAccess(!!b.force)); }
    /* ---- Markets (quotes, charts, filings, statements, rates); nothing is fetched while internet access is off ---- */
    if (url === '/api/mk/quotes') return json(res, 200, await markets.quotes(q.get('s')));
    if (url === '/api/mk/chart') return json(res, 200, await markets.chart(q.get('s'), q.get('r')));
    if (url === '/api/mk/search') return json(res, 200, await markets.search(q.get('q')));
    if (url === '/api/mk/filings') return json(res, 200, await markets.filings(q.get('s')));
    if (url === '/api/mk/facts') return json(res, 200, await markets.facts(q.get('s')));
    if (url === '/api/mk/geocode') return json(res, 200, await markets.geocode(q.get('q')));
    if (url === '/api/mk/weather') return json(res, 200, await markets.weather(q.get('lat'), q.get('lon'), q.get('u')));
    if (url === '/api/mk/macro') return json(res, 200, await markets.macro());
    if (url === '/api/news/research' && req.method === 'POST') { const b = await jbody(req, 1e4); return json(res, 200, await news.research(b.q)); }
    if (url === '/api/news/search') return json(res, 200, news.search(q.get('q') || ''));
    if (url === '/api/news/img') return news.image(new URL(req.url, 'http://x').searchParams.get('u') || '', res);
    if (url === '/api/news/refresh' && req.method === 'POST') { const b = await jbody(req, 1e4); const r = await news.refresh(!!b.force); return json(res, 200, r); }
    if (url === '/api/news/sources' && req.method === 'POST') { const b = await jbody(req, 2e5); news.savePrefs(b || {}); return json(res, 200, news.snapshot()); }
    if (url === '/api/net/lookup' && req.method === 'POST') { const b = await jbody(req, 1e5); return json(res, 200, await net.lookup(b.q, b.n)); }
    if (url === '/api/chats') {
      if (req.method === 'GET') return json(res, 200, U.readJson(CHATS, []));
      if (req.method === 'POST') { const v = await jbody(req); U.writeJson(CHATS, v.slice(0, 200)); return json(res, 200, { ok: true }); }
    }
    if (url === '/api/incoming') {
      if (req.method === 'POST') { incoming = await jbody(req, 2e6); return json(res, 200, { ok: true }); }
      const v = incoming; incoming = null; return json(res, 200, v || {});
    }
    /* ---- offline library ---- */
    if (url === '/api/lib/classics') return kiwix.classics().then(d => json(res, 200, d)).catch(e => json(res, 200, { shelves: [], items: [], error: String(e.message || e) }));
    if (url === '/api/lib/books') return json(res, 200, { available: kiwix.available(), books: kiwix.books() });
    if (url === '/api/lib/context' && req.method === 'POST') {
      const { q: qq, only, n } = await jbody(req, 1e5);
      try { return json(res, 200, { sources: await kiwix.context(String(qq || ''), n || 4, only) }); } catch (e) { return json(res, 200, { sources: [] }); }
    }
    if (url === '/api/lib/text' && req.method === 'POST') {
      const { link } = await jbody(req, 1e5); if (!/^\/wiki\//.test(link || '')) return json(res, 200, { text: '' });
      if (!(await kiwix.ensureP())) return json(res, 200, { text: '' });
      try { return json(res, 200, { text: await kiwix.text(link, 14000) }); } catch (e) { return json(res, 200, { text: '' }); }
    }
    /* ---- your documents ---- */
    if (url === '/api/docs/sources') {
      if (req.method === 'POST') { const b = await jbody(req, 1e5); if (b.add) docs.addSource(String(b.add)); if (b.remove) docs.removeSource(String(b.remove)); }
      return json(res, 200, { sources: docs.sources(), stats: docs.stats(), status: docs.status });
    }
    if (url === '/api/docs/reindex' && req.method === 'POST') { docs.reindex().catch(() => {}); return json(res, 200, { ok: true }); }
    if (url === '/api/docs/cancel' && req.method === 'POST') { docs.cancelIndex(); return json(res, 200, { ok: true }); }
    if (url === '/api/docs/search' && req.method === 'POST') { const b = await jbody(req, 1e5); return json(res, 200, { results: docs.search(String(b.q || ''), b.n || 6, b.kinds || ['doc', 'note']) }); }
    /* ---- Moundshroud's own code, so the AI can answer questions about the app from the real files ---- */
    if (url === '/api/app/search' && req.method === 'POST') { const b = await jbody(req, 1e5), s = String(b.q || ''); return json(res, 200, { results: appfiles.search(s, b.n || 14), context: appfiles.context(s, b.files || 4) }); }
    if (url === '/api/app/file' && req.method === 'POST') { const b = await jbody(req, 1e5), f = appfiles.read(String(b.path || ''), b.max); return f ? json(res, 200, f) : json(res, 404, { error: 'no such file' }); }
    if (url === '/api/app/list') return json(res, 200, { files: appfiles.list(q.get('dir') || '') });
    /* offline picture making: stable-diffusion.cpp with the SD-Turbo model, both kept in the imggen folder */
    if (url === '/api/art/status') return json(res, 200, { sd: sdReady(), busy: sdBusy });
    if (url === '/api/art/sd' && req.method === 'POST') {
      const b = await jbody(req, 2e4); if (!sdReady()) return json(res, 404, { error: 'The image model is not installed. Run install-art-model.ps1 (or use the Qwen drawing option).' }); if (sdBusy) return json(res, 429, { error: 'A picture is already being made. Wait for it to finish.' });
      const clean = (s, n) => String(s || '').replace(/[\r\n\0]+/g, ' ').trim().slice(0, n), prompt = clean(b.prompt, 400), neg = clean(b.neg, 200); if (!prompt) return json(res, 400, { error: 'Type what to draw.' });
      const dim = v => Math.max(256, Math.min(768, Math.round((+v || 512) / 64) * 64)), W = dim(b.w), H = dim(b.h), steps = Math.max(1, Math.min(6, Math.round(+b.steps || 2))), seed = Number.isFinite(+b.seed) && +b.seed >= 0 ? Math.floor(+b.seed) % 2147483647 : Math.floor(Math.random() * 2147483647);
      sdBusy = true; const out = path.join(require('os').tmpdir(), 'moundshroud-art-' + process.pid + '-' + Date.now() + '.png'); let ok = false;
      try {
        await sdUnloadOllama();
        const M = sdModel(), args = ['-m', M.file, ...M.args, '-p', prompt, '--steps', String(steps), '--cfg-scale', '1.0', '-W', String(W), '-H', String(H), '-s', String(seed), '--sampling-method', 'euler_a', '--vae-tiling', '-o', out]; if (neg) args.push('-n', neg);
        const run = extra => new Promise(done => { const pr = cp.spawn(SD_EXE, args.concat(extra), { cwd: path.dirname(SD_EXE), windowsHide: true, stdio: 'ignore' }); const k = setTimeout(() => { try { pr.kill(); } catch (e) { } }, 240000); pr.on('error', () => { clearTimeout(k); done(false); }); pr.on('close', code => { clearTimeout(k); done(code === 0 && fs.existsSync(out)); }); });
        ok = await run([]); if (!ok) { await sdUnloadOllama(); ok = await run([]); } if (!ok) ok = await run(['--backend', 'cpu']);
      } catch (e) { ok = false; } finally { sdBusy = false; }
      if (!ok) { fs.unlink(out, () => { }); return json(res, 500, { error: 'The picture could not be made. Close other heavy programs (games, VMs) and try again.' }); }
      fs.readFile(out, (err, buf) => { fs.unlink(out, () => { }); if (err) return json(res, 500, { error: 'The picture could not be read.' }); res.writeHead(200, { 'Content-Type': 'image/png', 'Cache-Control': 'no-store', 'X-Seed': String(seed) }); res.end(buf); });
      return;
    }
    /* offline AI music: MusicGen-small run by musicgen/gen.py in its own Python environment (installed by install-music-model.ps1) */
    if (url === '/api/music/status') return json(res, 200, { model: mgReady(), busy: mgBusy });
    if (url === '/api/music/gen' && req.method === 'POST') {
      const b = await jbody(req, 2e4); if (!mgReady()) return json(res, 404, { error: 'The AI music model is not installed. Run install-music-model.ps1 (Qwen can write the song instead).' }); if (mgBusy) return json(res, 429, { error: 'Music is already being made. Wait for it to finish.' });
      const prompt = String(b.prompt || '').replace(/[\r\n\0]+/g, ' ').trim().slice(0, 300); if (!prompt) return json(res, 400, { error: 'Describe the music first.' });
      const secs = Math.max(5, Math.min(30, Math.round(+b.seconds || 15))), seed = Number.isFinite(+b.seed) && +b.seed >= 0 ? Math.floor(+b.seed) % 2147483647 : Math.floor(Math.random() * 2147483647);
      mgBusy = true; const out = path.join(require('os').tmpdir(), 'moundshroud-music-' + process.pid + '-' + Date.now() + '.wav'); let ok = false;
      try {
        await sdUnloadOllama();
        const run = extra => new Promise(done => { const pr = cp.spawn(MG_PY, [MG_GEN, '--prompt', prompt, '--seconds', String(secs), '--seed', String(seed), '--out', out].concat(extra), { cwd: path.dirname(MG_GEN), windowsHide: true, stdio: ['ignore', 'ignore', fs.openSync(path.join(path.dirname(MG_GEN), 'last-error.log'), 'w')] }); const k = setTimeout(() => { try { pr.kill(); } catch (e) { } }, 600000); pr.on('error', () => { clearTimeout(k); done(false); }); pr.on('close', code => { clearTimeout(k); done(code === 0 && fs.existsSync(out)); }); });
        ok = await run([]); if (!ok) ok = await run(['--cpu']);
      } catch (e) { ok = false; } finally { mgBusy = false; }
      if (!ok) { fs.unlink(out, () => { }); return json(res, 500, { error: 'The AI music model could not make that clip.' }); }
      fs.readFile(out, (err, buf) => { fs.unlink(out, () => { }); if (err) return json(res, 500, { error: 'The clip could not be read.' }); res.writeHead(200, { 'Content-Type': 'audio/wav', 'Cache-Control': 'no-store', 'X-Seed': String(seed) }); res.end(buf); });
      return;
    }
    /* natural offline voices (Piper): the voice files live in piper/voices, the engine in piper/bin */
    if (url === '/api/tts/voices') { const vd = path.join(ROOT, 'piper', 'voices'); let list = []; try { if (fs.existsSync(path.join(ROOT, 'piper', 'bin', 'piper.exe'))) list = fs.readdirSync(vd).filter(f => /\.onnx$/.test(f) && fs.existsSync(path.join(vd, f + '.json'))).map(f => f.replace(/\.onnx$/, '')); } catch (e) { } return json(res, 200, { voices: list }); }
    if (url === '/api/tts' && req.method === 'POST') {
      const b = await jbody(req, 2e5), name = String(b.voice || ''), model = path.join(ROOT, 'piper', 'voices', name + '.onnx'), exe = path.join(ROOT, 'piper', 'bin', 'piper.exe');
      if (!/^[\w.-]+$/.test(name) || !fs.existsSync(model) || !fs.existsSync(exe)) return json(res, 404, { error: 'no such voice' });
      const text = String(b.text || '').slice(0, 1500).replace(/\s+/g, ' ').trim(); if (!text) return json(res, 400, { error: 'no text' });
      const ls = Math.min(2.5, Math.max(0.4, +b.length || 1)), out = path.join(require('os').tmpdir(), 'moundshroud-tts-' + process.pid + '-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7) + '.wav');
      const pr = cp.spawn(exe, ['--model', model, '--output_file', out, '--length_scale', String(ls)], { cwd: path.dirname(exe), stdio: ['pipe', 'ignore', 'ignore'], windowsHide: true });
      const kill = setTimeout(() => { try { pr.kill(); } catch (e) { } }, 30000);
      pr.on('error', () => { clearTimeout(kill); json(res, 500, { error: 'voice engine failed' }); });
      pr.on('close', () => { clearTimeout(kill); fs.readFile(out, (err, buf) => { fs.unlink(out, () => { }); if (err) return json(res, 500, { error: 'voice engine failed' }); res.writeHead(200, { 'Content-Type': 'audio/wav', 'Cache-Control': 'no-store' }); res.end(buf); }); });
      pr.stdin.on('error', () => { }); pr.stdin.end(text + '\n'); return;
    }
    if (url === '/api/docs/open' && req.method === 'POST') { const b = await jbody(req, 1e5); if (!allowedPath(b.path)) return json(res, 403, { error: 'not allowed' }); cp.spawn('explorer.exe', [b.path], { detached: true, stdio: 'ignore' }).unref(); return json(res, 200, { ok: true }); }
    if (url === '/api/pick-folder' && req.method === 'POST') {
      const ps = "Add-Type -AssemblyName System.Windows.Forms; $f=New-Object System.Windows.Forms.FolderBrowserDialog; $f.Description='Choose a folder for your assistant to read'; $f.ShowNewFolderButton=$false; if($f.ShowDialog() -eq 'OK'){ [Console]::Out.Write($f.SelectedPath) }";
      return cp.execFile('powershell.exe', ['-NoProfile', '-STA', '-Command', ps], { windowsHide: false, timeout: 300000 }, (e, out) => json(res, 200, { path: String(out || '').trim() }));
    }
    /* ---- notes ---- */
    if (url === '/api/notes') return json(res, 200, { folder: store.NOTES, notes: store.notesList() });
    if (url === '/api/notes/get') { const n = store.noteGet(q.get('id') || ''); return n ? json(res, 200, n) : json(res, 404, { error: 'not found' }); }
    if (url === '/api/notes/save' && req.method === 'POST') return json(res, 200, store.noteSave(await jbody(req, 4e6)));
    if (url === '/api/notes/delete' && req.method === 'POST') return json(res, 200, { ok: store.noteDelete((await jbody(req, 1e5)).id) });
    /* ---- prompts, flashcards, reminders, briefing ---- */
    if (url === '/api/prompts') { if (req.method === 'POST') store.promptsSet(await jbody(req, 2e6)); return json(res, 200, store.promptsGet()); }
    if (url === '/api/cards') { if (req.method === 'POST') store.cardsSet(await jbody(req, 8e6)); return json(res, 200, store.cardsGet()); }
    if (url === '/api/reminders') {
      if (req.method === 'POST') { const b = await jbody(req, 1e5); if (b.text && (b.at || b.rule)) store.remAdd(b.text, b.at, b.rule, { until: b.until, count: b.count }); }
      return json(res, 200, store.remList());
    }
    if (url === '/api/verse/schedule' && req.method === 'POST') return json(res, 200, store.verseSet(await jbody(req, 2e6)));
    if (url === '/api/verse/status') return json(res, 200, store.verseStatus());
    if (url === '/api/verse/test' && req.method === 'POST') { const b = await jbody(req, 1e5); return json(res, 200, store.verseTest(b.ref, b.text)); }
    if (url === '/api/reminders/edit' && req.method === 'POST') { const b = await jbody(req, 1e5); store.remEdit(b.id, b); return json(res, 200, store.remList()); }
    if (url === '/api/reminders/delete' && req.method === 'POST') { store.remDelete((await jbody(req, 1e5)).id); return json(res, 200, store.remList()); }
    if (url === '/api/briefing') return json(res, 200, store.briefing());
    /* ---- voice input ---- */
    if (url === '/api/ocr' && req.method === 'POST') return json(res, 200, await ocrImage(await bodyBuf(req, 25e6)));
    if (url === '/api/transcribe' && req.method === 'POST') return json(res, 200, await voice.transcribe(await bodyBuf(req, 40e6)));
    /* ---- extras: quick capture, system stats, dropped files, backup ---- */
    if (url === '/api/quick' && req.method === 'POST') return json(res, 200, extra.quick((await jbody(req, 1e5)).text));
    if (url === '/api/sys') return ollamaUp(up => extra.sysinfo({ ollama: up, uptimeApp: Math.round((Date.now() - started) / 60000) }).then(v => json(res, 200, v)));
    if (url === '/api/extract' && req.method === 'POST') return json(res, 200, await extra.extract(q.get('name') || 'file.txt', await bodyBuf(req, 25e6)));
    if (url === '/api/backup') {
      const z = await extra.backup(); if (!z) return json(res, 500, { error: 'backup failed' }); prep.noteBackup();
      res.writeHead(200, { 'Content-Type': 'application/zip', 'Content-Disposition': 'attachment; filename="' + path.basename(z) + '"', 'Content-Length': fs.statSync(z).size });
      return fs.createReadStream(z).on('close', () => extra.rm(z)).pipe(res);
    }
    /* no engine help of any kind while a real Lichess game is being played (Lichess forbids it) */
    if (lichess.live() && (url === '/api/sf/go' || url === '/api/sf/ana' || url === '/api/study/book')) return json(res, 200, { error: 'Chess engines are locked while your Lichess game is being played.', locked: true });
    if (url.startsWith('/api/sf/') || url.startsWith('/api/study/')) return require('./lib/chess-sf').handle(url, q, req, res, { json, jbody });
    if (url === '/api/storage') return json(res, 200, await require('./lib/storage').report(q.get('force') === '1'));
    if (url === '/api/storage/clean' && req.method === 'POST') { const b = await jbody(req, 1e4); return json(res, 200, await require('./lib/storage').clean(b.what, b.keep)); }
    if (url === '/api/restore' && req.method === 'POST') return json(res, 200, await extra.restore(await bodyBuf(req, 400e6)));
    /* progress safety: the dated copies kept outside the app folder */
    /* what this copy is, and whether a newer one has been unzipped into releases\ (Moundshroud never goes online to ask) */
    if (url === '/api/about') {
      let ver = '0', built = '';
      try { ver = fs.readFileSync(path.join(ROOT, 'VERSION'), 'utf8').trim(); built = fs.statSync(path.join(ROOT, 'VERSION')).mtime.toISOString().slice(0, 10); } catch (e) { }
      const num = v => String(v).split(/[^0-9]+/).filter(Boolean).map(Number);
      const newer = (a, b) => { const x = num(a), y = num(b); for (let i = 0; i < Math.max(x.length, y.length); i++) { const d = (x[i] || 0) - (y[i] || 0); if (d) return d > 0; } return false; };
      const offers = [];
      try { for (const f of fs.readdirSync(path.join(ROOT, 'releases'))) { const m = /^Moundshroud-(.+?)-part1-program\.zip$/i.exec(f); if (m && newer(m[1], ver)) offers.push({ file: f, version: m[1] }); } } catch (e) { }
      return json(res, 200, { version: ver, built, offers, started: new Date(started).toISOString().slice(0, 10), folder: ROOT });
    }
    /* updates: is there a newer version (asked online only with internet access on), and install it when the user says so */
    if (url === '/api/update/status') return json(res, 200, update.status());
    if (url === '/api/update/check' && req.method === 'POST') return json(res, 200, await update.check(false));
    if (url === '/api/update/install' && req.method === 'POST') return json(res, 200, await update.install(shutdown, PORT));
    if (url === '/api/update/seen' && req.method === 'POST') { try { fs.unlinkSync(path.join(DATA, 'update-result.json')); } catch (e) { } return json(res, 200, { ok: true }); }
    /* problems: the page posts what it caught, and both sides can read the list or the log */
    if (url === '/api/problems') {
      if (req.method === 'POST') { const b = await jbody(req, 2e5); problems.note(b.kind || 'page', b.text, b.where); return json(res, 200, { ok: true }); }
      if (q.get('tail')) return json(res, 200, { tail: problems.tail(+q.get('tail') || 200) });
      return json(res, 200, { recent: problems.recent(), file: path.relative(ROOT, problems.file), tail: problems.tail(40) });
    }
    if (url === '/api/problems/open' && req.method === 'POST') { try { cp.spawn('notepad.exe', [problems.file], { detached: true, stdio: 'ignore' }).unref(); } catch (e) { } return json(res, 200, { ok: true }); }
    if (url === '/api/safe') return json(res, 200, safe.status());
    if (url === '/api/safe/place' && req.method === 'POST') return json(res, 200, safe.setPlace(String((await jbody(req, 1e3)).place)));
    if (url === '/api/safe/now' && req.method === 'POST') { const r = await safe.run(true); if (r.ok) { try { prep.noteBackup(); } catch (e) { } } return json(res, 200, Object.assign({ status: safe.status() }, r)); }
    if (url.startsWith('/api/clip')) {                 // clipboard history: written by the tray helper, only when you turned it on
      const CF = path.join(DATA, 'clipboard.jsonl'), ON = path.join(DATA, 'clip-on');
      const read = () => { try { return fs.readFileSync(CF, 'utf8').split('\n').filter(Boolean).map(l => { try { return JSON.parse(l); } catch (e) { return null; } }).filter(Boolean); } catch (e) { return []; } };
      const write = list => U.atomicWrite(CF, list.map(x => JSON.stringify(x)).join('\n') + (list.length ? '\n' : ''));
      if (url === '/api/clip') return json(res, 200, { on: fs.existsSync(ON), items: read().reverse().slice(0, 100) });
      /* changes only on purpose: a plain visit to one of these addresses must never erase or switch anything */
      if (req.method !== 'POST') return json(res, 405, { error: 'use POST' });
      const b = await jbody(req, 1e4);
      if (url === '/api/clip/toggle') { if (b.on) fs.writeFileSync(ON, '1'); else { try { fs.unlinkSync(ON); } catch (e) {} } return json(res, 200, { on: fs.existsSync(ON) }); }
      if (url === '/api/clip/delete') { write(read().filter(x => x.id !== String(b.id))); return json(res, 200, { ok: true }); }
      if (url === '/api/clip/clear') { write([]); return json(res, 200, { ok: true }); }
    }
    if (url === '/api/kv') {                           // small named JSON stores (saved quizzes, study guides)
      const name = q.get('name') || ''; if (!['quizzes', 'guides', 'memory'].includes(name)) return json(res, 400, { error: 'unknown store' });
      const f = path.join(DATA, name + '.json');
      if (req.method === 'POST') { const v = await jbody(req, 8e6); U.writeJson(f, Array.isArray(v) ? v.slice(0, 300) : []); return json(res, 200, { ok: true }); }
      return json(res, 200, U.readJson(f, []));
    }
    /* ---- preparedness ---- */
    if (url === '/api/prep') { if (req.method === 'POST') return json(res, 200, { ok: prep.save(await jbody(req, 4e6)) }); return json(res, 200, prep.load()); }
    if (url === '/api/prep/health') {
      return ollamaUp(up => {
        const finish = models => prep.health({ ollama: up, models, books: kiwix.books().map(b => ({ category: b.category, title: b.title, sizeMB: b.sizeMB })), office: office.available(), voice: voice.available(), chef: fs.existsSync(CHEF), safety: safe.status() }).then(v => json(res, 200, v));
        if (!up) return finish([]);
        http.get({ ...OLLAMA, path: '/api/tags' }, r => { let b = ''; r.on('data', c => b += c); r.on('end', () => { try { finish((JSON.parse(b).models || []).map(m => m.name)); } catch (e) { finish([]); } }); }).on('error', () => finish([]));
      });
    }
    if (url === '/api/prep/stock') {
      const s = await prep.stock(); if (s.added) kiwix.stop();
      return ollamaUp(up => { const done = models => json(res, 200, Object.assign(s, { models })); if (!up) return done([]); http.get({ ...OLLAMA, path: '/api/tags' }, r => { let b = ''; r.on('data', c => b += c); r.on('end', () => { try { done((JSON.parse(b).models || []).map(m => m.name)); } catch (e) { done([]); } }); }).on('error', () => done([])); });
    }
    if (url === '/api/prep/stock/get' && req.method === 'POST') return json(res, 200, await prep.getStock((await jbody(req, 1e4)).id));
    /* ---- everything downloaded: the list, removing (the page asks first) and getting things (back) ---- */
    if (url === '/api/appmap') return json(res, 200, await appmap.build(PORT));
    if (url === '/api/inv') return json(res, 200, await inventory.list());
    if (url === '/api/inv/voices') { try { return json(res, 200, { voices: await inventory.voiceCatalog() }); } catch (e) { return json(res, 200, { error: e.message, voices: [] }); } }
    if (url === '/api/inv/remove' && req.method === 'POST') { const b = await jbody(req, 1e4); const r = await inventory.remove(b.id); try { if (/^zim:|^kiwix/.test(String(b.id))) kiwix.stop(); } catch (e) { } return json(res, 200, r); }
    if (url === '/api/inv/get' && req.method === 'POST') { const b = await jbody(req, 1e4); return json(res, 200, await inventory.get(b.id)); }
    /* ---- Tor Browser (installed from Stock up, opened from the Browser tab) ---- */
    if (url === '/api/tor') return json(res, 200, inventory.torStatus());
    /* ---- password vault: stores only the encrypted vault ---- */
    if (url === '/api/vault') return json(res, 200, vault.get());
    if (url === '/api/vault/save' && req.method === 'POST') return json(res, 200, vault.save(await jbody(req, 32e6)));
    if (url === '/api/vault/versions') return json(res, 200, { versions: vault.versions() });
    if (url === '/api/vault/older' && req.method === 'POST') return json(res, 200, vault.older((await jbody(req, 1e3)).n));
    if (url === '/api/vault/scrub' && req.method === 'POST') return json(res, 200, vault.scrubClipboard((await jbody(req, 1e3)).hash));
    /* ---- Lichess: real games on lichess.org; the token stays here, the window only sees the games ---- */
    if (url.startsWith('/api/lichess/')) {
      const m = url.slice(13);
      if (m === 'status') return json(res, 200, { connected: lichess.connected(), user: lichess.user(), live: lichess.live(), internet: net.on() });
      if (!net.on() && m !== 'disconnect') return json(res, 200, { error: 'Internet access is off (Settings › AI & power), so Lichess cannot be reached.', offline: true });
      if (m === 'account') return json(res, 200, await lichess.account());
      if (m === 'events') return lichess.events(res);
      if (m === 'game') return lichess.game(q.get('id'), res);
      if (req.method !== 'POST') return json(res, 405, { error: 'use POST' });
      const b = await jbody(req, 1e4);
      if (m === 'connect') return json(res, 200, await lichess.connect(b.token));
      if (m === 'disconnect') return json(res, 200, lichess.disconnect());
      if (m === 'seek') return lichess.seek(b, res);
      if (lichess.act[m]) { try { return json(res, 200, Object.assign({ ok: true }, await lichess.act[m](b))); } catch (e) { return json(res, 200, { error: e.message }); } }
      return json(res, 404, { error: 'not found' });
    }
    /* ---- mail: IMAP to your own provider; nothing is ever sent, drafts go to your Drafts folder ---- */
    if (url.startsWith('/api/mail/')) {
      const m = url.slice(10), ok = f => f.then(r => json(res, 200, r)).catch(e => json(res, 200, { error: String(e && e.message || e) }));
      if (m === 'accounts') return json(res, 200, mail.accounts());
      if (m === 'drafts') return json(res, 200, mail.localDrafts());
      if (m === 'att') return mail.attachment(String(q.get('a')), String(q.get('f')), q.get('u'), q.get('i'), res);
      if (req.method !== 'POST') return json(res, 405, { error: 'use POST' });
      const b = await jbody(req, 4e5);
      if (!net.on() && !['account/remove', 'cached', 'draft/local', 'draft/drop'].includes(m)) {
        const a = mail.accounts().accounts.find(x => x.id === b.acct || x.id === b.id);
        if (!(a && /^(127\.0\.0\.1|localhost)$/.test(a.host)) && !(m === 'account/add' && /^(127\.0\.0\.1|localhost)$/.test(String(b.host)))) return json(res, 200, { error: 'Internet access is off (Settings › AI & power), so Mail cannot reach your provider. Mail you already opened can still be read.', offline: true });
      }
      if (m === 'account/add') return ok(mail.addAccount(b));
      if (m === 'account/remove') return json(res, 200, mail.removeAccount(String(b.id)));
      if (m === 'folders') return ok(mail.folders(String(b.acct)));
      if (m === 'list') return ok(mail.list(String(b.acct), b.folder, b.before));
      if (m === 'cached') return json(res, 200, mail.cached(String(b.acct), String(b.folder || 'INBOX')) || { items: [] });
      if (m === 'message') return ok(mail.message(String(b.acct), b.folder, b.uid, !!b.read));
      if (m === 'flag') return ok(mail.flag(String(b.acct), b.folder, b.uid, b.what, !!b.on));
      if (m === 'move') return ok(mail.move(String(b.acct), b.folder, b.uid, String(b.to)));
      if (m === 'search') return ok(mail.search(String(b.acct), b.folder, b.q));
      if (m === 'draft/save') return ok(mail.saveDraft(String(b.acct), b));
      if (m === 'draft/local') return json(res, 200, mail.saveLocal(b));
      if (m === 'draft/drop') return json(res, 200, mail.dropLocal(String(b.id)));
      return json(res, 404, { error: 'not found' });
    }
    if (url === '/api/mail-img') {                       // pictures in an email, only when you choose to show them: fetched without cookies
      const u = String(q.get('u') || ''), s = await net.safeUrl(u); if (s.error) { res.writeHead(404); return res.end(); }
      return news.image(u, res, true);
    }
    /* ---- photos: an index over folders you chose; files are only ever read, never moved or changed ---- */
    if (url === '/api/photos') return json(res, 200, photos.list());
    if (url === '/api/photos/stats') return json(res, 200, photos.stats());
    if (url === '/api/photos/file') return photos.file(q.get('id'), res);
    if (url === '/api/photos/thumb') return photos.thumb(q.get('id'), res);
    if (url === '/api/photos/thumb/save' && req.method === 'POST') return json(res, 200, photos.saveThumb(q.get('id'), await bodyBuf(req, 5e5)));
    if (url === '/api/photos/scan' && req.method === 'POST') return json(res, 200, await photos.scan());
    if (url === '/api/photos/folders' && req.method === 'POST') return json(res, 200, photos.setFolders((await jbody(req, 1e5)).folders));
    if (url === '/api/photos/fav' && req.method === 'POST') { const b = await jbody(req, 1e3); return json(res, 200, photos.fav(String(b.id), !!b.on)); }
    if (url === '/api/photos/hide' && req.method === 'POST') return json(res, 200, photos.hide(String((await jbody(req, 1e3)).id)));
    if (url === '/api/photos/caption' && req.method === 'POST') { const b = await jbody(req, 1e5); return json(res, 200, photos.caption(String(b.id), b.text, b.tags, b.model)); }
    if (url === '/api/photos/forget' && req.method === 'POST') { const b = await jbody(req, 1e3); return json(res, 200, b.what === 'thumbs' ? photos.clearThumbs() : photos.forgetCaptions()); }
    if (url === '/api/photos/reveal' && req.method === 'POST') { const p = photos.where(String((await jbody(req, 1e3)).id)); if (!p) return json(res, 404, { error: 'not found' }); cp.spawn('explorer.exe', ['/select,', p], { detached: true, stdio: 'ignore' }).unref(); return json(res, 200, { ok: true }); }
    if (url === '/api/tor/open' && req.method === 'POST') { const b = await jbody(req, 1e4); return json(res, 200, inventory.openTor(b.url)); }
    if (url === '/api/inv/pull' && req.method === 'POST') { const m = (await jbody(req, 1e4)).model; return ensureOllama(up => json(res, 200, up ? inventory.pullModel(OLLAMA, m) : { error: 'The AI engine could not be started' })); }
    if (url === '/api/prep/models') return json(res, 200, { models: prep.MODELS, pull: prep.pullStatus() });
    if (url === '/api/prep/pull' && req.method === 'POST') { const m = (await jbody(req, 1e4)).model; return ensureOllama(up => json(res, 200, up ? prep.startPull(OLLAMA, m) : { error: 'The AI engine could not be started' })); }
    if (url === '/api/prep/fix' && req.method === 'POST') {      // clears leftover model processes that hold graphics memory; the AI engine restarts the next time it is needed
      if (spawnedOllama && spawnedOllama.pid) { killTree(spawnedOllama.pid); spawnedOllama = null; }
      cp.spawnSync('taskkill', ['/IM', 'llama-server.exe', '/F'], { stdio: 'ignore', windowsHide: true }); cp.spawnSync('taskkill', ['/IM', 'ollama.exe', '/F'], { stdio: 'ignore', windowsHide: true });
      return json(res, 200, { ok: true });
    }
    /* ---- LibreOffice documents ---- */
    if (url === '/api/office/status') return json(res, 200, { available: office.available(), outDir: office.OUT });
    if (url === '/api/office/list') return json(res, 200, { files: office.list() });
    if (url === '/api/office/create' && req.method === 'POST') { const b = await jbody(req, 4e6); return json(res, 200, await office.create({ kind: b.kind, title: b.title, content: b.content })); }
    if (url === '/api/office/convert' && req.method === 'POST') return json(res, 200, await office.convertUpload(q.get('name') || 'file', await bodyBuf(req, 80e6), q.get('to') || 'pdf'));
    /* ---- edit documents, spreadsheets and presentations through LibreOffice ---- */
    if (url === '/api/office/files') return json(res, 200, { available: officeEdit.available(), files: officeEdit.list(q.get('force') === '1'), roots: officeEdit.roots(), sources: docs.sources() });
    if (url === '/api/office/stat') { const p = String(q.get('path') || ''); if (!officeEdit.allowed(p)) return json(res, 403, { error: 'not allowed' }); return json(res, 200, officeEdit.stat(p) || { error: 'missing' }); }
    if (url === '/api/office/read' && req.method === 'POST') { const b = await jbody(req, 1e5); try { return json(res, 200, await officeEdit.read(String(b.path))); } catch (e) { return json(res, 200, { error: String(e.message || e) }); } }
    if (url === '/api/office/save' && req.method === 'POST') { const b = await jbody(req, 16e6); try { return json(res, 200, await officeEdit.save(String(b.path), b)); } catch (e) { return json(res, 200, { error: String(e.message || e) }); } }
    if (url === '/api/office/new' && req.method === 'POST') { const b = await jbody(req, 1e5); try { return json(res, 200, await officeEdit.create(String(b.kind), String(b.title || ''), b.ext)); } catch (e) { return json(res, 200, { error: String(e.message || e) }); } }
    if (url === '/api/office/versions') { const p = String(q.get('path') || ''); if (!officeEdit.allowed(p)) return json(res, 403, { error: 'not allowed' }); return json(res, 200, { versions: officeEdit.versions(p) }); }
    if (url === '/api/office/restore' && req.method === 'POST') { const b = await jbody(req, 1e5); if (!officeEdit.allowed(String(b.path))) return json(res, 403, { error: 'not allowed' }); try { return json(res, 200, Object.assign({ ok: true }, officeEdit.restore(String(b.path), String(b.id)))); } catch (e) { return json(res, 200, { error: String(e.message || e) }); } }
    if (url === '/api/office/export' && req.method === 'POST') { const b = await jbody(req, 1e5); if (!officeEdit.allowed(String(b.path))) return json(res, 403, { error: 'not allowed' }); try { const out = await office.convert(String(b.path), String(b.to || 'pdf'), office.OUT); return json(res, 200, out ? { path: out, name: require('path').basename(out) } : { error: 'LibreOffice could not export it' }); } catch (e) { return json(res, 200, { error: String(e.message || e) }); } }
    if (url === '/api/office/open' && req.method === 'POST') {
      const b = await jbody(req, 1e4); if (!allowedPath(b.path)) return json(res, 403, { error: 'not allowed' });
      if (b.app === 'folder') cp.spawn('explorer.exe', ['/select,', b.path], { detached: true, stdio: 'ignore' }).unref();
      else if (b.app === 'lo' && office.available()) office.openIn(b.path); else cp.spawn('explorer.exe', [b.path], { detached: true, stdio: 'ignore' }).unref();
      return json(res, 200, { ok: true });
    }
    if (url === '/api/pc/find') return json(res, 200, { matches: await pcmod.find(q.get('name')) });
    if (url === '/api/pc' && req.method === 'POST') {
      const b = await jbody(req, 1e4);
      if (b.do === 'open') return json(res, 200, await pcmod.openApp(String(b.id || '')));
      if (b.do === 'volume') return json(res, 200, await pcmod.volume(b.mode, b.value));
      if (b.do === 'lock') return json(res, 200, pcmod.lock());
      return json(res, 400, { error: 'unknown command' });
    }
    if (url === '/api/modelcaps') {
      const name = q.get('name') || ''; if (!/^[\w.:\-\/]+$/.test(name)) return json(res, 200, { vision: false });
      return ensureOllama(up => {
        if (!up) return json(res, 200, { vision: false });
        const p = JSON.stringify({ model: name });
        const r2 = http.request({ ...OLLAMA, path: '/api/show', method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(p) } }, x => { let b = ''; x.on('data', c => b += c); x.on('end', () => { try { const caps = JSON.parse(b).capabilities || []; json(res, 200, { vision: caps.includes('vision'), caps }); } catch (e) { json(res, 200, { vision: false }); } }); });
        r2.on('error', () => json(res, 200, { vision: false })); r2.end(p);
      });
    }
    if (url === '/api/file') {       // serve a file you chose to index (or a note), so PDFs can open inside the app at the right page
      const p = q.get('path') || ''; if (!allowedPath(p)) return json(res, 403, { error: 'not allowed' });
      const ext = path.extname(p).toLowerCase(), types = { '.pdf': 'application/pdf', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.txt': 'text/plain; charset=utf-8', '.md': 'text/plain; charset=utf-8', '.html': 'text/html; charset=utf-8', '.htm': 'text/html; charset=utf-8' };
      const type = types[ext]; if (!type) return json(res, 415, { error: 'unsupported' });
      res.writeHead(200, { 'Content-Type': type, 'Content-Length': fs.statSync(p).size, 'Content-Disposition': 'inline', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
      return fs.createReadStream(p).pipe(res);
    }
    if (url === '/api/rhyme') { try { return json(res, 200, rhyme.lookup(q.get('word'))); } catch (e) { return json(res, 200, { error: String(e.message) }); } }
    if (url === '/api/thesaurus') { try { return json(res, 200, await thesaurus.lookup(q.get('word'))); } catch (e) { return json(res, 200, { error: String(e.message) }); } }
    /* ---- one search for everything ---- */
    if (url === '/api/search' && req.method === 'POST') {
      const qq = String((await jbody(req, 1e5)).q || '').trim(); if (!qq) return json(res, 200, { notes: [], docs: [], chats: [], library: [] });
      const d = docs.search(qq, 8, ['doc', 'note']);
      let lib = [];
      if (kiwix.available() && await kiwix.ensureP()) {
        const bl = kiwix.books().slice(0, 8);
        const rs = await Promise.all(bl.map(async b => { try { return (await Promise.race([kiwix.search(b.name, qq, 2), new Promise((_, rj) => setTimeout(() => rj(new Error('slow')), 4000))])).map(i => ({ title: i.title, url: i.link, book: b.title })); } catch (e) { return []; } }));
        lib = rs.flat().slice(0, 12);
      }
      return json(res, 200, { notes: d.filter(x => x.kind === 'note'), docs: d.filter(x => x.kind === 'doc'), chats: chatsSearch(qq), library: lib });
    }
    /* ---- Search tab: one question across every library, your documents and notes ---- */
    if (url === '/api/web/search' && req.method === 'POST') {
      const b = await jbody(req, 1e5), qq = String(b.q || '').trim(); if (!qq) return json(res, 200, { items: [], counts: {}, files: { notes: [], docs: [] } });
      const [r, fl] = await Promise.all([websearch.search(qq, { scope: b.scope, n: b.n }), Promise.resolve().then(() => { try { return docs.search(qq, 8, ['doc', 'note']); } catch (e) { return []; } })]);
      r.panel = b.scope && b.scope !== 'all' ? null : await websearch.panel(qq, r.items || []).catch(() => null); r.files = { notes: fl.filter(x => x.kind === 'note'), docs: fl.filter(x => x.kind === 'doc') };
      return json(res, 200, r);
    }
    if (url === '/api/web/passages' && req.method === 'POST') { const b = await jbody(req, 2e5); return json(res, 200, { sources: await websearch.passages(Array.isArray(b.links) ? b.links : [], b.max || 1800) }); }
    if (url === '/api/web/suggest') { const q2 = new URL(req.url, 'http://x').searchParams.get('q') || ''; return json(res, 200, { suggestions: await websearch.suggest(q2) }); }
    json(res, 404, { error: 'not found' });
  } catch (e) { if (!res.headersSent) json(res, 500, { error: String(e.message) }); else res.end(); }
}).listen(PORT, '127.0.0.1', () => {
  console.log('assistant on http://127.0.0.1:' + PORT);
  update.start();                                 // the once-a-day update question (only with internet access on)
  try { const r = privacy.edgePrefs(); if (r.note) console.log('privacy: ' + r.note); } catch (e) { }   // lock the window's own settings down, while it is closed
  setTimeout(() => { try { store.notesSync(); } catch (e) {} }, 1500);
  /* a copy of the user's progress in Documents, once a day, a little after start-up so nothing is delayed.
     Never allowed to take the app down with it: any failure is swallowed and reported on the Ready page. */
  setTimeout(() => { safe.run().then(r => { if (r && r.ok && !r.skipped) { try { prep.noteBackup(); } catch (e) { } console.log('progress backed up to ' + r.folder); } }).catch(() => { }); }, 20000);
});
mainServer.keepAliveTimeout = 75000; mainServer.headersTimeout = 80000;        // idle connections stay open longer than the browser reuses them (avoids sporadic 'Failed to fetch')

/* ---- the offline library on its own address ----
   Library pages (Wikipedia, Stack Exchange, books...) come from downloaded files and carry their own scripts. Served
   from a separate address, those scripts cannot reach Moundshroud's data or controls: the app's server refuses requests
   from here, the window cannot be read from here, and pages may only talk to this address. A small helper
   (web/lib-bridge.js) is added to each page so the Browser tab can still do find, zoom, print, bookmarks and the rest. */
const LIBSELF = new Set(['127.0.0.1:' + LIBPORT, 'localhost:' + LIBPORT]);
const libCsp = app => "default-src 'self' data: blob:; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; media-src 'self' data: blob:; connect-src 'self'; frame-src 'self'; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors " + app;
const libServer = http.createServer((req, res) => {
  const host = String(req.headers.host || '').toLowerCase();
  if (!LIBSELF.has(host) || !/^(GET|HEAD)$/.test(req.method)) { res.writeHead(403, { 'Content-Type': 'text/plain' }); return res.end('not allowed'); }
  const app = 'http://' + host.split(':')[0] + ':' + PORT, url = req.url.split('#')[0];
  const sec = { 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'Cross-Origin-Resource-Policy': 'same-origin', 'Content-Security-Policy': libCsp(app), 'Cache-Control': 'no-cache' };
  if (url === '/__bridge.js') { return fs.readFile(path.join(WEB, 'lib-bridge.js'), (e, b) => { if (e) { res.writeHead(404); return res.end(); } res.writeHead(200, Object.assign({ 'Content-Type': 'application/javascript; charset=utf-8' }, sec)); res.end(b); }); }
  if (!url.startsWith('/wiki/')) { res.writeHead(404, sec); return res.end(); }
  kiwix.ensure(ok => {
    if (!ok) { res.writeHead(503, Object.assign({ 'Content-Type': 'text/plain' }, sec)); return res.end('The offline library is not installed'); }
    const h = { ...req.headers }; delete h.host; delete h['accept-encoding']; delete h.cookie; delete h.origin; delete h.referer;
    const pr = http.request({ host: '127.0.0.1', port: kiwix.PORT, path: url, method: req.method, headers: h }, r => {
      const hd = Object.assign({}, r.headers); delete hd['content-security-policy']; delete hd['set-cookie'];
      if (!/text\/html/i.test(String(hd['content-type'] || '')) || req.method === 'HEAD') { res.writeHead(r.statusCode, Object.assign(hd, sec)); return r.pipe(res); }
      const parts = []; r.on('data', c => parts.push(c));
      r.on('end', () => {
        let html = Buffer.concat(parts).toString('utf8');
        const tag = '<script src="/__bridge.js" data-app="' + app + '"></script>';
        html = /<head[^>]*>/i.test(html) ? html.replace(/<head[^>]*>/i, m => m + tag) : tag + html;     // first, before the page's own scripts
        const b = Buffer.from(html, 'utf8'); delete hd['content-length']; delete hd['transfer-encoding'];
        res.writeHead(r.statusCode, Object.assign(hd, sec, { 'Content-Length': b.length })); res.end(b);
      });
    });
    pr.on('error', () => { if (!res.headersSent) res.writeHead(502, sec); res.end(); });
    pr.end();
  });
});
libServer.on('error', e => console.log('library address ' + LIBPORT + ' unavailable: ' + e.message));
libServer.listen(LIBPORT, '127.0.0.1');

setInterval(() => {
  const now = Date.now();
  if (closingAt && now > closingAt) shutdown();
  else if (seen && now - lastPing > 180000) shutdown();
  else if (!seen && now - started > 120000) shutdown();
}, 2000);

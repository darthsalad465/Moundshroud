// Edit your real documents, spreadsheets and presentations from Moundshroud, through LibreOffice itself.
// A headless LibreOffice (Moundshroud's own private profile, the same one used for conversions) listens on a local socket; py/lo_uno.py opens a file in it,
// reads or changes it, and saves it back in the file's own format. Because LibreOffice does the saving, styles, images, charts and
// everything Moundshroud does not touch survive. Every save keeps a backup of the previous version.
const fs = require('fs'), path = require('path'), os = require('os'), cp = require('child_process'), net = require('net'), crypto = require('crypto');
const office = require('./office'), docs = require('./docs');
const ROOT = path.join(__dirname, '..'), DATA = path.join(ROOT, 'data'), TMP = path.join(DATA, 'tmp'), BAK = path.join(DATA, 'office-backups');
const PORT = 2083, HELPER = path.join(ROOT, 'py', 'lo_uno.py'), ORDER = path.join(ROOT, 'py', 'pptx_order.py');
const SO = office.SO, LOPY = SO ? path.join(path.dirname(SO), 'python.exe') : '';
const KINDS = { writer: ['.docx', '.doc', '.docm', '.dotx', '.odt', '.rtf'], calc: ['.xlsx', '.xls', '.xlsm', '.ods', '.csv'], impress: ['.pptx', '.ppt', '.pptm', '.odp', '.pps', '.ppsx'] };
const KIND_OF = {}; Object.keys(KINDS).forEach(k => KINDS[k].forEach(e => { KIND_OF[e] = k; }));
const kindOf = f => KIND_OF[path.extname(String(f)).toLowerCase()] || null;
const available = () => !!(SO && LOPY && fs.existsSync(LOPY) && fs.existsSync(HELPER));

/* ---------- where your documents live ---------- */
function roots() {
  const h = os.homedir(), out = [], add = p => { if (p && fs.existsSync(p) && !out.some(x => x.toLowerCase() === p.toLowerCase())) out.push(p); };
  add(path.dirname(office.OUT)); add(office.OUT);
  for (const b of ['OneDrive', '']) { add(path.join(h, b, 'Desktop')); add(path.join(h, b, 'Downloads')); add(path.join(h, b, 'Documents')); }
  try { docs.sources().forEach(add); } catch (e) { }
  // keep only the outermost folders
  return out.filter(p => !out.some(q => q !== p && p.toLowerCase().startsWith(q.toLowerCase() + path.sep)));
}
const inside = (p, r) => { const a = path.resolve(p).toLowerCase(), b = path.resolve(r).toLowerCase(); return a === b || a.startsWith(b + path.sep); };
const allowed = p => { try { p = path.resolve(String(p || '')); return !!kindOf(p) && roots().some(r => inside(p, r)) && fs.existsSync(p); } catch (e) { return false; } };
const SKIP = /^(\.|node_modules$|appdata$|\$recycle|my (music|pictures|videos)$|moundshroud-?old$)/i;
let cache = { t: 0, files: [] };
function list(force) {
  if (!force && Date.now() - cache.t < 8000) return cache.files; const files = [], seen = new Set();
  const walk = (d, depth) => {
    if (files.length >= 800) return; let ents; try { ents = fs.readdirSync(d, { withFileTypes: true }); } catch (e) { return; }
    for (const e of ents) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) { if (depth < 4 && !SKIP.test(e.name)) walk(p, depth + 1); }
      else if (kindOf(e.name) && !/^~\$|^\.~lock/.test(e.name)) { const k = p.toLowerCase(); if (seen.has(k)) continue; seen.add(k); try { const s = fs.statSync(p); files.push({ name: e.name, path: p, dir: d, kind: kindOf(e.name), ext: path.extname(e.name).slice(1).toLowerCase(), size: s.size, mtime: Math.floor(s.mtimeMs) }); } catch (er) { } }
    }
  };
  roots().forEach(r => walk(r, 0)); files.sort((a, b) => b.mtime - a.mtime); cache = { t: Date.now(), files }; return files;
}
const lockFile = p => path.join(path.dirname(p), '.~lock.' + path.basename(p) + '#');
const stat = p => { try { const s = fs.statSync(p); return { mtime: Math.floor(s.mtimeMs), size: s.size, locked: fs.existsSync(lockFile(p)) }; } catch (e) { return null; } };

/* ---------- the LibreOffice listener and the helper ---------- */
const portOpen = () => new Promise(res => { const s = net.connect({ host: '127.0.0.1', port: PORT }); const done = v => { try { s.destroy(); } catch (e) { } res(v); }; s.once('connect', () => done(true)); s.once('error', () => done(false)); s.setTimeout(500, () => done(false)); });
let starting = null;
async function ensure() {
  if (!available()) throw new Error('LibreOffice is not installed on this PC.');
  if (await portOpen()) return; if (!starting) {
    starting = (async () => {
      office.markUsed();
      const prof = 'file:///' + path.join(DATA, 'lo-profile').replace(/\\/g, '/');
      const p = cp.spawn(SO, ['-env:UserInstallation=' + prof, '--headless', '--norestore', '--nolockcheck', '--accept=socket,host=127.0.0.1,port=' + PORT + ';urp;StarOffice.ComponentContext'], { windowsHide: true, stdio: 'ignore' }); p.unref();
      for (let i = 0; i < 60; i++) { if (await portOpen()) return; await new Promise(r => setTimeout(r, 500)); }
      throw new Error('LibreOffice did not start');
    })().finally(() => { starting = null; });
  }
  return starting;
}
let chain = Promise.resolve();
function run(req) {
  const job = chain.then(async () => {
    await ensure(); fs.mkdirSync(TMP, { recursive: true }); const id = Date.now() + '-' + Math.random().toString(36).slice(2, 6), rq = path.join(TMP, 'ofe-' + id + '.json'), rs = path.join(TMP, 'ofe-' + id + '.out.json');
    fs.writeFileSync(rq, JSON.stringify(req), 'utf8');
    try {
      await new Promise((res, rej) => cp.execFile(LOPY, [HELPER, String(PORT), rq, rs], { timeout: 120000, windowsHide: true, maxBuffer: 64e6 }, (e, so, se) => e && !fs.existsSync(rs) ? rej(new Error(String(se || e.message).slice(-300))) : res()));
      const r = JSON.parse(fs.readFileSync(rs, 'utf8')); return r;
    } catch (e) { try { office.stop(); } catch (er) { } throw new Error('LibreOffice did not answer, so Moundshroud restarted it. Please try again. (' + String(e.message || e).slice(0, 120) + ')'); }
    finally { try { fs.unlinkSync(rq); } catch (e) { } try { fs.unlinkSync(rs); } catch (e) { } }
  });
  chain = job.catch(() => { }); return job;
}

/* ---------- backups ---------- */
const bakDir = p => path.join(BAK, crypto.createHash('sha1').update(path.resolve(p).toLowerCase()).digest('hex').slice(0, 16));
function backup(p) {
  try { const d = bakDir(p); fs.mkdirSync(d, { recursive: true }); fs.writeFileSync(path.join(d, 'name.txt'), p, 'utf8'); const f = path.join(d, Date.now() + '__' + path.basename(p)); fs.copyFileSync(p, f);
    const all = fs.readdirSync(d).filter(x => /^\d+__/.test(x)).sort(); while (all.length > 12) fs.unlinkSync(path.join(d, all.shift())); return path.basename(f); } catch (e) { return null; }
}
function versions(p) { try { const d = bakDir(p); return fs.readdirSync(d).filter(x => /^\d+__/.test(x)).sort().reverse().map(n => ({ id: n, at: +n.split('__')[0], size: fs.statSync(path.join(d, n)).size })); } catch (e) { return []; } }
function restore(p, id) {
  if (!/^\d+__[^\\/]+$/.test(String(id))) throw new Error('bad version'); const f = path.join(bakDir(p), id); if (!fs.existsSync(f)) throw new Error('that version is gone');
  if (fs.existsSync(lockFile(p))) throw new Error('This file is open in LibreOffice. Close it there first.'); backup(p); fs.copyFileSync(f, p); cache.t = 0; return stat(p);
}

/* ---------- the operations ---------- */
async function read(p) {
  if (!allowed(p)) throw new Error('That file is not in one of your document folders.'); const st = stat(p), r = await run({ op: 'read', path: p });
  if (!r.ok) throw new Error(r.error || 'could not read the file'); r.mtime = st.mtime; r.size = st.size; r.locked = st.locked; r.name = path.basename(p); return r;
}
async function save(p, body) {
  if (!allowed(p)) throw new Error('That file is not in one of your document folders.'); if (fs.existsSync(lockFile(p))) throw new Error('This file is open in LibreOffice. Save and close it there first, or reload it here.');
  const kind = kindOf(p), ext = path.extname(p).toLowerCase(); const bk = backup(p); const req = { op: 'write', path: p };
  if (kind === 'writer') req.blocks = body.blocks || []; else if (kind === 'calc') req.edits = body.edits || []; else req.slides = body.slides || [];
  const r = await run(req); if (!r.ok) throw new Error(r.error || 'LibreOffice could not save the file');
  if (kind === 'impress' && Array.isArray(r.perm) && r.perm.some((v, i) => v !== i)) {
    if (ext === '.pptx' || ext === '.pptm') { const py = office.PY; if (py && fs.existsSync(py)) await new Promise(res => cp.execFile(py, ['-I', ORDER, p, JSON.stringify(r.perm)], { timeout: 60000, windowsHide: true }, e => { if (e) r.orderError = String(e.message).slice(0, 120); res(); })); else r.orderError = 'python-pptx is missing'; }
    else r.orderError = 'Slide order can only be changed in .pptx files here. Everything else was saved.';
  }
  cache.t = 0; const st = stat(p); return { ok: true, mtime: st.mtime, backup: bk, orderError: r.orderError || '' };
}
async function create(kind, title, ext) {
  if (!KINDS[kind]) throw new Error('unknown kind'); ext = ext || { writer: '.docx', calc: '.xlsx', impress: '.pptx' }[kind]; if (!KINDS[kind].includes(ext)) ext = KINDS[kind][0];
  fs.mkdirSync(office.OUT, { recursive: true }); const stem = String(title || 'Untitled').replace(/[\\/:*?"<>|\r\n\t]+/g, ' ').trim().slice(0, 60) || 'Untitled'; let p = path.join(office.OUT, stem + ext), n = 2; while (fs.existsSync(p)) p = path.join(office.OUT, stem + ' (' + n++ + ')' + ext);
  const r = await run({ op: 'new', kind, title: stem, path: p }); if (!r.ok) throw new Error(r.error || 'could not create the file'); cache.t = 0; return { path: p, name: path.basename(p) };
}
const stopListener = () => { /* office.stop() ends the private LibreOffice, which includes this listener */ };
module.exports = { available, roots, allowed, list, stat, read, save, create, versions, restore, kindOf, KINDS, stopListener };

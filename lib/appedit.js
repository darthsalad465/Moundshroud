// Editing the app's own files from inside the app. The page never names a path that is used as-is: every path is
// resolved here, refused unless it is one of the app's source folders, and every save keeps the previous version in
// data\app-edits first. JavaScript is syntax-checked with node --check before it is written, so a stray bracket cannot
// leave a tab that will not open. Nothing outside web\, lib\, tests\ and scripts\ (plus server.js) can be touched.
const fs = require('fs'), path = require('path'), cp = require('child_process'), crypto = require('crypto');

const ROOT = path.join(__dirname, '..'), DATA = path.join(ROOT, 'data'), BACK = path.join(DATA, 'app-edits');
const INDEX = path.join(BACK, 'index.json');
const MAXREAD = 700 * 1024, KEEP = 20;
const OK_EXT = /\.(js|mjs|css|html|json|md|txt|ps1|bat|cmd|svg)$/i;
/* the folder itself counts as well (^web$), or the top of the tree could not be opened from the editor */
const ALLOW = [/^web(\/|$)/i, /^lib(\/|$)/i, /^tests(\/|$)/i, /^scripts(\/|$)/i, /^server\.js$/i, /^[A-Za-z0-9._-]+\.(md|json|ps1|bat|cmd)$/i];
const DENY = [/^web\/vendor\//i, /\.min\.(js|css)$/i, /\/fixtures\//i];
const SKIP = /^(node_modules|\.git|data|engines|edge-profile|\.claude|web\/vendor)$/i;

const clean = s => String(s || '').replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/+$/, '');
function abs(rel) {
  const r = clean(rel);
  if (!r || r.includes('\0')) return null;
  const p = path.resolve(ROOT, r);
  if (p === ROOT || !p.toLowerCase().startsWith(ROOT.toLowerCase() + path.sep)) return null;
  if (!ALLOW.some(re => re.test(r)) || DENY.some(re => re.test(r))) return null;
  return p;
}
const ok = rel => !!abs(rel);
const relOf = p => path.relative(ROOT, p).split(path.sep).join('/');

/* what the editor shows: folders to walk into, and the files it is allowed to open */
function list(dir) {
  const rel = clean(dir);
  const base = rel ? abs(rel) : ROOT;
  if (!base) return { error: 'That folder cannot be edited.' };
  let real = base; try { real = fs.realpathSync(base); } catch (e) { return { error: 'There is no such folder.' }; }
  if (!fs.statSync(real).isDirectory()) return { error: 'That is a file, not a folder.' };
  let ents = []; try { ents = fs.readdirSync(real, { withFileTypes: true }); } catch (e) { return { error: 'That folder could not be read.' }; }
  const dirs = [], files = [], TOP = ['web', 'lib', 'tests', 'scripts'];
  for (const e of ents.sort((a, b) => a.name.localeCompare(b.name))) {
    const childRel = rel ? rel + '/' + e.name : e.name;
    if (e.isDirectory()) {
      if (SKIP.test(childRel) || SKIP.test(e.name) || e.name.startsWith('.')) continue;
      /* at the very top only the folders that hold source: the rest of the app's folders are not editable anyway */
      if (!rel && !TOP.includes(e.name)) continue;
      dirs.push(childRel); continue;
    }
    if (!ok(childRel) || !OK_EXT.test(e.name)) continue;
    let st; try { st = fs.statSync(path.join(real, e.name)); } catch (e) { continue; }
    files.push({ rel: childRel, name: e.name, size: st.size, at: st.mtimeMs });
  }
  return { dir: rel, dirs, files, roots: ['web', 'lib', 'tests', 'scripts'] };
}

function read(rel) {
  const p = abs(rel); if (!p) return { error: 'That file cannot be opened here.' };
  let st; try { st = fs.statSync(p); } catch (e) { return { error: 'There is no such file.' }; }
  if (st.size > MAXREAD) return { error: 'That file is too big to edit here (' + Math.round(st.size / 1024) + ' KB). Use another editor for it.' };
  let text = ''; try { text = fs.readFileSync(p, 'utf8'); } catch (e) { return { error: String(e.message) }; }
  return { rel: clean(rel), text, size: st.size, at: st.mtimeMs };
}

/* node --check on a scratch copy: a syntax error is reported before anything is written */
function check(rel, text) {
  const r = clean(rel);
  if (!/\.(js|mjs)$/i.test(r)) return { ok: true, checked: false };
  const tmp = path.join(require('os').tmpdir(), 'mnd-check-' + Date.now() + '-' + process.pid + (r.endsWith('.mjs') ? '.mjs' : '.js'));
  try { fs.writeFileSync(tmp, String(text == null ? '' : text)); } catch (e) { return { ok: false, error: 'Could not write the scratch file.' }; }
  const out = cp.spawnSync(process.execPath, ['--check', tmp], { encoding: 'utf8', windowsHide: true, timeout: 20000 });
  try { fs.unlinkSync(tmp); } catch (e) { }
  if (out.status === 0) return { ok: true, checked: true };
  /* node prints the scratch file's name and a caret line; neither helps someone reading the message */
  const lines = String((out.stderr || '') + (out.stdout || '')).split(/\r?\n/).map(s => s.trim());
  const where = lines.find(l => /:\d+$/.test(l)) || '';
  const line = (where.match(/:([0-9]+)$/) || [])[1] || '';
  const msg = lines.filter(l => l && !/^\^+$/.test(l) && !/:\d+$/.test(l) && !/^\s*$/.test(l) && !/^at\s/.test(l) && !/^Node\.js\s/.test(l)).slice(0, 3).join('. ');
  return { ok: false, checked: true, error: (line ? 'Line ' + line + ': ' : '') + (msg || 'That JavaScript has a syntax error.') };
}

/* the versions kept for a file: newest first */
function versions(rel) {
  const r = clean(rel), all = readIndex()[r];
  return Array.isArray(all) ? all.slice().sort((a, b) => b.at - a.at) : [];
}
function readIndex() { try { const j = JSON.parse(fs.readFileSync(INDEX, 'utf8')); return j && typeof j === 'object' ? j : {}; } catch (e) { return {}; } }
function writeIndex(j) { try { fs.mkdirSync(BACK, { recursive: true }); const tmp = INDEX + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(j)); fs.renameSync(tmp, INDEX); } catch (e) { } }
const idOf = rel => crypto.createHash('sha1').update(clean(rel)).digest('hex').slice(0, 12);

function backup(rel, text) {
  const r = clean(rel), at = Date.now(), dir = path.join(BACK, idOf(r));
  try {
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, at + '-' + path.basename(r));
    fs.writeFileSync(file, text);
    const idx = readIndex();
    (idx[r] = Array.isArray(idx[r]) ? idx[r] : []).push({ at, file: path.basename(file), bytes: Buffer.byteLength(text) });
    idx[r].sort((a, b) => b.at - a.at);
    for (const old of idx[r].slice(KEEP)) { try { fs.unlinkSync(path.join(dir, old.file)); } catch (e) { } }
    idx[r] = idx[r].slice(0, KEEP);
    writeIndex(idx);
    return at;
  } catch (e) { return 0; }
}

function save(rel, text) {
  const r = clean(rel), p = abs(r);
  if (!p) return { error: 'That file cannot be saved from here.' };
  if (!OK_EXT.test(r)) return { error: 'Files like that are not edited here.' };
  const body = String(text == null ? '' : text);
  if (body.length > MAXREAD) return { error: 'That is too much text to save here.' };
  let was = ''; try { was = fs.readFileSync(p, 'utf8'); } catch (e) { was = ''; }
  const chk = check(r, body);
  if (!chk.ok) return { error: chk.error, syntax: true, checked: chk.checked };
  const at = backup(r, was);
  try {
    const tmp = p + '.mnd-tmp';
    fs.writeFileSync(tmp, body);
    fs.renameSync(tmp, p);
  } catch (e) { return { error: 'It could not be written: ' + String(e.message || e) }; }
  return { ok: true, rel: r, at, bytes: Buffer.byteLength(body), hadBackup: !!at, checked: chk.checked, needsRestart: !/^web\//i.test(r) };
}

function create(rel, text) {
  const r = clean(rel), p = abs(r);
  if (!p || !OK_EXT.test(r)) return { error: 'Choose a file inside an editable app folder.' };
  if (!fs.existsSync(path.dirname(p)) || fs.existsSync(p)) return { error: fs.existsSync(p) ? 'A file with that name already exists.' : 'That folder does not exist.' };
  const body = String(text == null ? '' : text);
  if (body.length > MAXREAD) return { error: 'That is too much text to save here.' };
  const chk = check(r, body); if (!chk.ok) return { error: chk.error, syntax: true };
  try { fs.writeFileSync(p, body, { flag: 'wx' }); return { ok: true, rel: r, bytes: Buffer.byteLength(body) }; }
  catch (e) { return { error: 'The file could not be created: ' + String(e.message || e) }; }
}

function createFolder(rel) {
  const r = clean(rel), p = abs(r);
  if (!p) return { error: 'Choose a folder name inside web, lib, tests, or scripts.' };
  if (!fs.existsSync(path.dirname(p))) return { error: 'The parent folder does not exist.' };
  try { fs.mkdirSync(p); return { ok: true, rel: r }; }
  catch (e) { return { error: e.code === 'EEXIST' ? 'That folder already exists.' : 'The folder could not be created: ' + String(e.message || e) }; }
}

function remove(rel) {
  const r = clean(rel), p = abs(r);
  if (!p || !OK_EXT.test(r)) return { error: 'That file cannot be removed here.' };
  let text; try { text = fs.readFileSync(p, 'utf8'); } catch (e) { return { error: 'That file could not be read.' }; }
  const at = backup(r, text);
  try { fs.unlinkSync(p); return { ok: true, rel: r, backedUp: !!at }; }
  catch (e) { return { error: 'The file could not be removed: ' + String(e.message || e) }; }
}

function move(rel, to) {
  const from = clean(rel), dest = clean(to), src = abs(from), dst = abs(dest);
  if (!src || !dst || !OK_EXT.test(from) || !OK_EXT.test(dest)) return { error: 'Choose source and destination files inside editable app folders.' };
  if (src === dst) return { error: 'Choose a different folder or name.' };
  if (!fs.existsSync(src)) return { error: 'The source file no longer exists.' };
  if (!fs.existsSync(path.dirname(dst))) return { error: 'The destination folder does not exist.' };
  if (fs.existsSync(dst)) return { error: 'A file with that name already exists in the destination.' };
  try { fs.renameSync(src, dst); return { ok: true, rel: dest, previous: from }; }
  catch (e) { return { error: 'The file could not be moved: ' + String(e.message || e) }; }
}

function revert(rel, at) {
  const r = clean(rel), p = abs(r);
  if (!p) return { error: 'That file cannot be restored from here.' };
  const list = versions(r);
  if (!list.length) return { error: 'There is no earlier version of that file.' };
  const pick = at ? list.find(v => v.at === +at) : list[0];
  if (!pick) return { error: 'That version is gone.' };
  const src = path.join(BACK, idOf(r), pick.file);
  let text; try { text = fs.readFileSync(src, 'utf8'); } catch (e) { return { error: 'That version could not be read.' }; }
  const chk = check(r, text);
  if (!chk.ok) return { error: 'That version no longer passes the syntax check: ' + chk.error, syntax: true };
  backup(r, fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '');
  try { fs.writeFileSync(p, text); } catch (e) { return { error: String(e.message || e) }; }
  return { ok: true, rel: r, text, bytes: Buffer.byteLength(text), needsRestart: !/^web\//i.test(r) };
}

/* which files have been edited here, newest first, with how many versions are kept */
function edited() {
  const idx = readIndex(), out = [];
  for (const rel of Object.keys(idx)) {
    const v = versions(rel); if (!v.length) continue;
    let size = 0; try { size = fs.statSync(abs(rel)).size; } catch (e) { }
    out.push({ rel, at: v[0].at, versions: v.length, size, was: v[0].bytes });
  }
  return out.sort((a, b) => b.at - a.at);
}

/* 📊 the numbers under the editor. Only the folders this page can edit are walked, so the totals always match the file
   tree. The walk stops after a few seconds; a result is kept for eight seconds so switching folders stays quick. */
const codeStats = require('./code-stats');
const STAT_TTL = 8000, statCache = new Map();
const statDirOk = rel => /^(web|lib|tests|scripts)(\/|$)/i.test(rel) && !/^web\/vendor(\/|$)/i.test(rel);
function stats(dir, deep, force) {
  const rel = clean(dir), key = rel + '|' + (deep ? 'deep' : 'top');
  const hit = statCache.get(key);
  if (!force && hit && Date.now() - hit.at < STAT_TTL) return Promise.resolve(hit.value);
  const base = rel ? abs(rel) : ROOT;
  if (!base) return Promise.resolve({ error: 'That folder cannot be measured.' });
  /* the walk hands each child its path relative to `base`, so it is made app-relative here before the rules see it */
  const full = child => rel ? rel + '/' + child : child;
  return codeStats.walk(base, {
    deep: !!deep,
    allowDir: child => statDirOk(full(child)),
    allowFile: child => { const r = full(child); return !!abs(r) && OK_EXT.test(r); }
  }).then(value => {
    value.dir = rel;
    statCache.set(key, { at: Date.now(), value });
    return value;
  }, e => ({ error: 'That folder could not be measured: ' + String((e && e.message) || e) }));
}

/* ---- the app-scoped shell's disk -------------------------------------------------------------------------------
   The shell shows everything the app is made of: the page, the server, the tests and scripts, the Electron desktop
   shell, and the third-party libraries the page loads from web/vendor. The list of paths is cheap; contents are read
   only when the shell asks for them, a batch at a time, so opening the shell stays instant even though the app carries
   tens of megabytes of vendor code. Nothing is ever refused for being large: a big file simply arrives in its own
   request. A file that is not text (a picture, font, model weight) comes back as a one-line marker, never an error. */
const SHELL_ROOTS = ['web', 'lib', 'tests', 'scripts', 'desktop', 'docs', 'agent'];
const SHELL_SKIP_DIR = /^(node_modules|\.git|data|engines|edge-profile|desktop-profile|runtime|imggen|musicgen|piper|pyenv|nomad|releases|_snapshots|tor-browser|voice|\.venv|__pycache__|\.cache|\.next|\.claude|\.dev|\.freebuff)/i;
const BINARY_EXT = /\.(png|jpe?g|gif|webp|ico|bmp|tiff?|woff2?|ttf|otf|eot|mp[34]|wav|ogg|flac|webm|mov|avi|zip|gz|tgz|bz2|xz|7z|rar|pdf|exe|dll|so|dylib|node|bin|wasm|whl|jar|pyc|h5|hdf5|onnx|gguf|safetensors|pt|pth|ckpt|pkl|npy|npz|parquet|db|sqlite3?|asar|msi|iso|dmg)$/i;
const fmtBytes = n => n < 1024 ? n + ' B' : n < 1048576 ? Math.round(n / 1024) + ' KB' : (n / 1048576).toFixed(n < 10485760 ? 1 : 0) + ' MB';
/* a shell path: inside one of the app's source folders, or a file at the very top of the app */
function shellAbs(rel) {
  const r = clean(rel);
  if (!r || r.includes('\0') || r.split('/').some(part => part === '..' || part === '.')) return null;
  const inRoot = SHELL_ROOTS.some(d => r === d || r.startsWith(d + '/'));
  if (!inRoot && !/^[A-Za-z0-9._-]+$/.test(r)) return null;
  const p = path.resolve(ROOT, r);
  if (!p.toLowerCase().startsWith(ROOT.toLowerCase() + path.sep)) return null;
  return p;
}
const isBinaryName = rel => BINARY_EXT.test(rel);
function looksBinary(buf) {
  const head = buf.subarray(0, Math.min(buf.length, 8192));
  for (let i = 0; i < head.length; i++) if (head[i] === 0) return true;
  return false;
}
/* the whole app, as paths with sizes (optional `brief`: only a change signature, for cheap polling) */
function shellTree(brief) {
  const entries = [], queue = SHELL_ROOTS.slice(), seen = new Set();
  let total = 0, sig = 0, prefix = 0;
  while (queue.length) {
    const dir = queue.shift();
    if (seen.has(dir)) continue;
    seen.add(dir);
    let ents = [];
    try { ents = fs.readdirSync(path.resolve(ROOT, dir), { withFileTypes: true }); } catch (e) { continue; }
    for (const e of ents) {
      if (e.name.startsWith('.')) continue;
      const rel = dir + '/' + e.name;
      if (e.isDirectory()) { if (!SHELL_SKIP_DIR.test(e.name)) queue.push(rel); continue; }
      let st; try { st = fs.statSync(path.resolve(ROOT, rel)); } catch (e) { continue; }
      entries.push({ rel, size: st.size, at: Math.floor(st.mtimeMs), text: !isBinaryName(rel) });
      total += st.size;
      sig = (sig * 31 + rel.length + st.size + Math.floor(st.mtimeMs)) % 2147483647; prefix++;
    }
  }
  /* the app's own top-level files (server.js, the docs, install scripts …) */
  let top = []; try { top = fs.readdirSync(ROOT, { withFileTypes: true }); } catch (e) { top = []; }
  for (const e of top) {
    if (!e.isFile() || e.name.startsWith('.')) continue;
    let st; try { st = fs.statSync(path.resolve(ROOT, e.name)); } catch (e) { continue; }
    entries.push({ rel: e.name, size: st.size, at: Math.floor(st.mtimeMs), text: !isBinaryName(e.name) });
    total += st.size;
    sig = (sig * 31 + e.name.length + st.size + Math.floor(st.mtimeMs)) % 2147483647; prefix++;
  }
  return { entries: entries.sort((a, b) => a.rel.localeCompare(b.rel)), bytes: total, sig: sig + ':' + prefix + ':' + entries.length };
}
/* contents for the named files: any size, text as text, everything else as a marker line */
function shellRead(rels) {
  const files = {}, binary = [];
  for (const raw of (Array.isArray(rels) ? rels : []).slice(0, 500)) {
    const r = clean(raw), p = shellAbs(r);
    if (!p) continue;
    let st; try { st = fs.statSync(p); } catch (e) { continue; }
    if (!st.isFile()) continue;
    let buf; try { buf = fs.readFileSync(p); } catch (e) { continue; }
    if (isBinaryName(r) || looksBinary(buf)) {
      files[r] = '[binary file · ' + fmtBytes(st.size) + ']';
      binary.push(r);
      continue;
    }
    files[r] = buf.toString('utf8');
  }
  return { files, binary, count: Object.keys(files).length };
}
/* shell({ brief }) → { sig, count, bytes } · shell({ meta }) → every path · shell({ files: [...] }) → their text */
function shell(opts) {
  const o = opts || {};
  if (Array.isArray(o.files)) return shellRead(o.files);
  const tree = shellTree(!!o.brief);
  if (o.brief) return { sig: tree.sig, count: tree.entries.length, bytes: tree.bytes, root: 'app', brief: true };
  return { files: tree.entries, count: tree.entries.length, bytes: tree.bytes, root: 'app', meta: true };
}

/* ---- writes from the mound shell -----------------------------------------------------------------------------
   The shell's /app is this app, so a write is accepted only for a path the shell itself can see: inside web, lib,
   tests, scripts, desktop, docs or agent, or one of the app's own top-level files. ".." and absolute paths are
   refused, nothing outside the app is ever touched, and every file replaced or removed is backed up first (into
   data/app-edits, the same versions the editor keeps). */
const SHELL_WRITE_MAX = 4 * 1024 * 1024;
function shellTarget(rel) {
  const r = clean(rel);
  if (!r || r.includes('\0') || r.split('/').some(part => !part || part === '.' || part === '..')) return { error: 'not a path inside the app' };
  const p = shellAbs(r);
  if (!p) return { error: 'outside the app' };
  return { rel: r, path: p };
}
function shellWrite(opts) {
  const o = opts || {}, out = { saved: [], created: [], removed: [], folders: [], refused: [], at: {}, sig: '' };
  const no = (rel, why) => out.refused.push({ rel: clean(rel), why: why || 'it could not be written' });
  for (const raw of (Array.isArray(o.mkdir) ? o.mkdir : []).slice(0, 200)) {
    const t = shellTarget(raw);
    if (t.error || !SHELL_ROOTS.some(d => t.rel === d || t.rel.startsWith(d + '/'))) { no(raw, t.error || 'outside the app'); continue; }
    try { fs.mkdirSync(t.path, { recursive: true }); out.folders.push(t.rel); }
    catch (e) { no(raw, 'it could not be created'); }
  }
  for (const raw of (Array.isArray(o.remove) ? o.remove : []).slice(0, 500)) {
    const t = shellTarget(raw);
    if (t.error) { no(raw, t.error); continue; }
    let st; try { st = fs.statSync(t.path); } catch (e) { no(raw, 'no such file'); continue; }
    if (!st.isFile()) { no(raw, 'not a file'); continue; }
    let was = ''; try { was = fs.readFileSync(t.path, 'utf8'); } catch (e) { was = ''; }
    try { backup(t.rel, was); } catch (e) { }
    try { fs.unlinkSync(t.path); out.removed.push(t.rel); delete out.at[t.rel]; }
    catch (e) { no(raw, 'it could not be removed'); }
  }
  for (const f of (Array.isArray(o.save) ? o.save : []).slice(0, 500)) {
    const t = shellTarget(f && f.rel);
    if (t.error) { no(f && f.rel, t.error); continue; }
    if (isBinaryName(t.rel)) { no(t.rel, 'a binary file'); continue; }
    const body = String(!f || f.text == null ? '' : f.text);
    if (body.length > SHELL_WRITE_MAX) { no(t.rel, 'too much text to write here'); continue; }
    if (!fs.existsSync(path.dirname(t.path))) { no(t.rel, 'no such directory'); continue; }
    let existed = false, was = '';
    try { const st = fs.statSync(t.path); existed = st.isFile(); if (existed) was = fs.readFileSync(t.path, 'utf8'); } catch (e) { existed = false; }
    if (existed) { try { backup(t.rel, was); } catch (e) { } }
    try { const tmp = t.path + '.mnd-tmp'; fs.writeFileSync(tmp, body); fs.renameSync(tmp, t.path); }
    catch (e) { try { fs.unlinkSync(t.path + '.mnd-tmp'); } catch (e2) { } no(t.rel, 'it could not be written'); continue; }
    try { out.at[t.rel] = Math.floor(fs.statSync(t.path).mtimeMs); } catch (e) { }
    out.saved.push(t.rel);
    if (!existed) out.created.push(t.rel);
  }
  /* the shell keeps a signature of the app on disk to notice changes made elsewhere: hand it the fresh one */
  try { out.sig = shellTree(true).sig; } catch (e) { out.sig = ''; }
  return out;
}

module.exports = { list, read, save, create, createFolder, remove, move, check, versions, revert, edited, stats, shell, shellWrite, abs, MAXREAD };

// Your own documents + notes: folder indexing and full-text search (SQLite FTS5, runs locally).
const fs = require('fs'), path = require('path'), cp = require('child_process'), crypto = require('crypto');
const { DatabaseSync } = require('node:sqlite');
const U = require('./util');

const ROOT = path.join(__dirname, '..'), DATA = path.join(ROOT, 'data');
const SRC = path.join(DATA, 'docs-sources.json'), DB = path.join(DATA, 'index.db');
const PY = path.join(ROOT, 'pyenv', 'Scripts', 'python.exe'), PDFW = path.join(ROOT, 'py', 'pdfworker.py');
const TEXT_EXT = new Set(['.txt', '.md', '.markdown', '.csv', '.log', '.json', '.tsv', '.rtf']);
const HTML_EXT = new Set(['.html', '.htm']);
const OFFICE_EXT = new Set(['.docx', '.pptx', '.xlsx']);
const LEGACY_EXT = new Set(['.doc', '.dot', '.odt', '.rtf', '.wpd', '.xls', '.ods', '.ppt', '.pps', '.odp']);     // read through LibreOffice
let officeMod = null; const officeLib = () => officeMod || (officeMod = require('./office'));
const SKIP_DIR = /^(node_modules|\.git|\.svn|\$recycle\.bin|system volume information|appdata|windows|program files.*|__pycache__|\.cache|\.venv|venv|pyenv)$/i;
const MAX_FILE = 40 * 1048576;

let db = null, vecExtLoaded = false;
function open() {
  if (db) return db;
  fs.mkdirSync(DATA, { recursive: true });
  db = new DatabaseSync(DB, { allowExtension: true });
  vecExtLoaded = false;
  try {
    const vp = require('./microtools').vecPath();
    if (vp) { db.loadExtension(vp); vecExtLoaded = true; }
  } catch (e) { vecExtLoaded = false; }
  db.exec("PRAGMA journal_mode=WAL; PRAGMA synchronous=NORMAL;");
  db.exec("CREATE TABLE IF NOT EXISTS files(path TEXT PRIMARY KEY, kind TEXT, mtime INTEGER, size INTEGER, chunks INTEGER)");
  db.exec("CREATE VIRTUAL TABLE IF NOT EXISTS docs USING fts5(path UNINDEXED, kind UNINDEXED, title, body, page UNINDEXED, tokenize='porter unicode61')");
  /* vectors: the same passages, as numbers, so a question in your own words still finds the right page (lib/embed.js makes them) */
  db.exec("CREATE TABLE IF NOT EXISTS vec(hash TEXT PRIMARY KEY, path TEXT, kind TEXT, title TEXT, page INTEGER, body TEXT, dim INTEGER, v BLOB)");
  return db;
}
function close() { try { if (db) { db.close(); db = null; } } catch (e) {} if (pdf) { try { pdf.kill(); } catch (e) {} pdf = null; } }

/* ---- sources (folders you chose) ---- */
const sources = () => U.readJson(SRC, []).filter(p => { try { return typeof p === 'string' && fs.existsSync(p); } catch (e) { return false; } });
function addSource(p) { const s = sources(); if (!s.includes(p)) { s.push(p); U.writeJson(SRC, s); } return s; }
function removeSource(p) {
  const s = sources().filter(x => x !== p); U.writeJson(SRC, s);
  const d = open(); const rows = d.prepare("SELECT path FROM files WHERE kind='doc'").all();
  const keep = s.map(x => x.toLowerCase());
  for (const r of rows) if (!keep.some(k => r.path.toLowerCase().startsWith(k))) removePath(r.path);
  return s;
}

/* ---- chunks ---- */
function chunk(text) {
  const out = []; const paras = text.replace(/\r/g, '').split(/\n{2,}|\n(?=\s*[-*•\d]+[.)]?\s)/);
  let cur = '';
  for (let p of paras) {
    p = p.replace(/[ \t]+/g, ' ').trim(); if (!p) continue;
    while (p.length > 1400) { const cut = p.lastIndexOf(' ', 1000); const k = cut > 400 ? cut : 1000; if (cur) { out.push(cur); cur = ''; } out.push(p.slice(0, k)); p = p.slice(k).trim(); }
    if (cur.length + p.length > 900) { if (cur) out.push(cur); cur = p; } else cur = cur ? cur + '\n' + p : p;
  }
  if (cur) out.push(cur);
  return out;
}
function putChunks(p, kind, title, pages, mtime, size, existing = true) {
  const d = open(); let n = 0;
  d.exec('BEGIN IMMEDIATE');
  try {
    // FTS5 cannot index the path filter. Avoid scanning every passage for a new file.
    if (existing || d.prepare("SELECT 1 FROM files WHERE path=?").get(p)) {
      d.prepare("DELETE FROM docs WHERE path=?").run(p);
    }
    const ins = d.prepare("INSERT INTO docs(path,kind,title,body,page) VALUES (?,?,?,?,?)");
    for (const pg of pages) for (const c of chunk(pg.text)) { ins.run(p, kind, title, c, pg.page || 0); n++; }
    d.prepare("INSERT OR REPLACE INTO files(path,kind,mtime,size,chunks) VALUES (?,?,?,?,?)").run(p, kind, mtime, size, n);
    d.exec('COMMIT');
  } catch (e) { d.exec('ROLLBACK'); throw e; }
  return n;
}
function removePath(p) { const d = open(); d.prepare("DELETE FROM docs WHERE path=?").run(p); d.prepare("DELETE FROM files WHERE path=?").run(p); }

/* ---- pdf worker ---- */
let pdf = null, pdfQ = [], pdfBuf = '';
function pdfStart() {
  if (pdf || !fs.existsSync(PY)) return !!pdf;
  pdf = cp.spawn(PY, [PDFW], { stdio: ['pipe', 'pipe', 'ignore'], windowsHide: true, env: { ...process.env, PYTHONIOENCODING: 'utf-8' } });
  pdf.stdout.setEncoding('utf8');
  pdf.stdout.on('data', d => { pdfBuf += d; let i; while ((i = pdfBuf.indexOf('\n')) >= 0) { const line = pdfBuf.slice(0, i); pdfBuf = pdfBuf.slice(i + 1); const w = pdfQ.shift(); if (w) { try { w.res(JSON.parse(line)); } catch (e) { w.res({ error: 'bad output' }); } } } });
  pdf.on('exit', () => { pdf = null; for (const w of pdfQ.splice(0)) w.res({ error: 'worker stopped' }); });
  return true;
}
function pdfExtract(file) {
  return new Promise(res => {
    if (!pdfStart()) return res({ error: 'PDF reader not installed' });
    const t = setTimeout(() => { try { pdf.kill(); } catch (e) {} }, 120000);
    pdfQ.push({ res: v => { clearTimeout(t); res(v); } });
    pdf.stdin.write(file + '\n');
  });
}

/* ---- walking + indexing ---- */
function* walk(dir, depth = 0) {
  let ents; try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return; }
  for (const e of ents) {
    if (e.name.startsWith('.') || e.name.startsWith('~$')) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      // Reference collections such as tldr use "windows" for their Windows documentation.
      const referencePlatform = e.name.toLowerCase() === 'windows' && p.startsWith(path.join(DATA, 'refs') + path.sep);
      if (depth < 12 && (referencePlatform || !SKIP_DIR.test(e.name))) yield* walk(p, depth + 1);
    }
    else if (e.isFile()) {
      const ext = path.extname(e.name).toLowerCase();
      if (TEXT_EXT.has(ext) || HTML_EXT.has(ext) || OFFICE_EXT.has(ext) || ext === '.pdf' || (LEGACY_EXT.has(ext) && officeLib().available())) yield p;
    }
  }
}
const status = { running: false, total: 0, done: 0, current: '', added: 0, skipped: 0, errors: 0, startedAt: 0, finishedAt: 0, lastError: '' };
let cancel = false;
async function reindex() {
  if (status.running) return status;
  Object.assign(status, { running: true, total: 0, done: 0, current: '', added: 0, skipped: 0, errors: 0, startedAt: Date.now(), finishedAt: 0, lastError: '' }); cancel = false;
  const d = open(); const known = new Map(d.prepare("SELECT path,mtime,size FROM files WHERE kind='doc'").all().map(r => [r.path, r]));
  // Older versions could leave passages without file metadata after an interrupted write.
  const orphans = new Set(d.prepare("SELECT DISTINCT path FROM docs WHERE path NOT IN (SELECT path FROM files)").all().map(r => r.path));
  const files = []; for (const s of sources()) { for (const p of walk(s)) files.push(p); }
  status.total = files.length; const seen = new Set(files);
  for (const p of files) {
    if (cancel) break;
    status.current = path.basename(p);
    try {
      const st = fs.statSync(p); const k = known.get(p);
      if (st.size > MAX_FILE) { status.skipped++; }
      else if (k && k.mtime === Math.floor(st.mtimeMs) && k.size === st.size) { status.skipped++; }
      else {
        const ext = path.extname(p).toLowerCase(); let pages = [];
        if (LEGACY_EXT.has(ext)) pages = await officeLib().readLegacy(p);
        else if (TEXT_EXT.has(ext)) pages = [{ page: 0, text: fs.readFileSync(p, 'utf8') }];
        else if (HTML_EXT.has(ext)) pages = [{ page: 0, text: U.htmlToTextKeepTables(fs.readFileSync(p, 'utf8')) }];
        else if (OFFICE_EXT.has(ext)) pages = U.extractOffice(p, ext);
        else if (ext === '.pdf') { const r = await pdfExtract(p); if (r.error) throw new Error(r.error); pages = r.pages || []; }
        putChunks(p, 'doc', path.basename(p), pages, Math.floor(st.mtimeMs), st.size, !!k || orphans.has(p));
        status.added++;
      }
    } catch (e) { status.errors++; status.lastError = path.basename(p) + ': ' + String(e.message).slice(0, 120); }
    status.done++;
    if (status.done % 5 === 0) await new Promise(r => setImmediate(r));
  }
  if (!cancel) for (const [p] of known) if (!seen.has(p)) removePath(p);      // files that disappeared
  status.running = false; status.finishedAt = Date.now(); status.current = '';
  return status;
}
function cancelIndex() { cancel = true; }
function stats() {
  const d = open();
  const f = d.prepare("SELECT COUNT(*) n, COALESCE(SUM(chunks),0) c FROM files WHERE kind='doc'").get();
  const n = d.prepare("SELECT COUNT(*) n FROM files WHERE kind='note'").get();
  return { files: f.n, chunks: f.c, notes: n.n };
}

/* ---- notes in the index ---- */
function indexNote(p, title, text, mtime) {
  const m = Number.isFinite(mtime) ? Math.floor(mtime) : Date.now();
  putChunks(p, 'note', title, [{ page: 0, text: title + '\n' + text }], m, text.length, false);
}
function noteNeedsIndex(p, mtime, size) {
  try {
    const row = open().prepare("SELECT mtime, size FROM files WHERE path=? AND kind='note'").get(p);
    if (row && row.mtime >= Math.floor(mtime) && row.size === size) return false;
  } catch (e) { }
  return true;
}

/* ---- vectors (semantic search) ---- */
const embed = require('./embed');
const vecStatus = { running: false, model: '', done: 0, total: 0, added: 0, error: '', startedAt: 0, finishedAt: 0 };
const sha = s => crypto.createHash('sha1').update(String(s)).digest('hex');
/* the hash covers the model and its prefixes too, so changing either rebuilds the vectors instead of mixing them */
const vecKey = (body, model) => sha(body + '\u0000' + model + '\u0000' + (embed.prefix(model).doc ? 'prefixed' : ''));
function vecCount() { try { return open().prepare('SELECT COUNT(*) n FROM vec').get().n; } catch (e) { return 0; } }
async function vectorize() {
  if (vecStatus.running) return vecStatus;
  Object.assign(vecStatus, { running: true, model: '', done: 0, total: 0, added: 0, error: '', startedAt: Date.now(), finishedAt: 0 });
  try {
    const model = await embed.pickModel(true);
    if (!model) throw new Error('No embedding model is installed yet. Download one first (about 275 MB, it stays on this PC).');
    vecStatus.model = model;
    const d = open(), rows = d.prepare('SELECT path, kind, title, page, body FROM docs').all();
    const have = new Set(d.prepare('SELECT hash FROM vec').all().map(r => r.hash));
    vecStatus.total = rows.length;
    const ins = d.prepare('INSERT OR REPLACE INTO vec(hash, path, kind, title, page, body, dim, v) VALUES (?,?,?,?,?,?,?,?)');
    const live = new Set(); let batch = [];
    const flush = async () => {
      if (!batch.length) return;
      const list = batch.slice(); batch = [];
      const pf = embed.prefix(model);
      const vs = await embed.embed(list.map(b => pf.doc + (b.r.title ? b.r.title + '\n' : '') + b.r.body), model);
      d.exec('BEGIN');
      try {
        list.forEach((b, i) => { const arr = vs[i] || []; if (!arr.length) return; const f = new Float32Array(arr); ins.run(b.h, b.r.path, b.r.kind, b.r.title || '', b.r.page || 0, b.r.body, f.length, Buffer.from(f.buffer)); vecStatus.added++; });
        d.exec('COMMIT');
      } catch (e) { d.exec('ROLLBACK'); throw e; }
    };
    for (const r of rows) {
      const h = vecKey(r.body, model); live.add(h); vecStatus.done++;
      if (!have.has(h)) { batch.push({ r, h }); if (batch.length >= 12) await flush(); }
      if (vecStatus.done % 200 === 0) await new Promise(res => setImmediate(res));
    }
    await flush();
    const keep = d.prepare('SELECT hash FROM vec').all();                                  // drop vectors for text that has gone
    const del = d.prepare('DELETE FROM vec WHERE hash=?');
    for (const k of keep) if (!live.has(k.hash)) del.run(k.hash);
  } catch (e) { vecStatus.error = String((e && e.message) || e).slice(0, 220); }
  vecStatus.running = false; vecStatus.finishedAt = Date.now();
  return vecStatus;
}
const qcache = new Map();
async function vecSearch(q, n) {
  const model = await embed.pickModel(); if (!model) return [];
  const d = open(); if (!d.prepare('SELECT COUNT(*) n FROM vec').get().n) return [];
  let qv = qcache.get(q);
  if (!qv) {
    const [v] = await embed.embed([embed.prefix(model).q + q], model); if (!v || !v.length) return [];
    qv = new Float32Array(v); let k = 0; for (let i = 0; i < qv.length; i++) k += qv[i] * qv[i];
    k = Math.sqrt(k) || 1; for (let i = 0; i < qv.length; i++) qv[i] /= k;
    qcache.set(q, qv); if (qcache.size > 60) qcache.delete(qcache.keys().next().value);
  }
  if (vecExtLoaded) {
    try {
      const qbuf = Buffer.from(qv.buffer, qv.byteOffset, qv.byteLength);
      const rows = d.prepare('SELECT path, kind, title, page, body, (1.0 - vec_distance_cosine(v, ?)) AS score FROM vec WHERE dim = ? ORDER BY vec_distance_cosine(v, ?) ASC LIMIT ?').all(qbuf, qv.length, qbuf, n);
      return rows.map(r => ({ path: r.path, kind: r.kind, title: r.title || path.basename(r.path), page: r.page || 0, text: r.body, score: Number(r.score) || 0 }));
    } catch (e) { /* fall back to JS cosine below */ }
  }
  const out = [];
  for (const r of d.prepare('SELECT path, kind, title, page, body, dim, v FROM vec').all()) {
    let v; try { v = new Float32Array(r.v.buffer.slice(r.v.byteOffset, r.v.byteOffset + r.dim * 4)); } catch (e) { continue; }
    if (v.length !== qv.length) continue;
    let dot = 0, norm = 0;
    for (let i = 0; i < v.length; i++) { dot += v[i] * qv[i]; norm += v[i] * v[i]; }
    out.push({ path: r.path, kind: r.kind, title: r.title || path.basename(r.path), page: r.page || 0, text: r.body, score: dot / (Math.sqrt(norm) + 1e-9) });
  }
  out.sort((a, b) => b.score - a.score);
  return out.slice(0, n);
}

/* ---- searching ---- */
const STOP = new Set('a an and are as at be but by for from has have how i in is it its of on or that the their this to was what when where which who why will with you your do does did can could should would about into than then there these those them they we our not no if so such also any all more most some very just tell me please explain give show find list'.split(' '));
function ftsQuery(q, join) {
  const toks = (q.toLowerCase().match(/[\p{L}\p{N}]+/gu) || []).filter(t => t.length > 1 && !STOP.has(t));
  const uniq = [...new Set(toks)].slice(0, 14);
  return uniq.length ? uniq.map(t => '"' + t.replace(/"/g, '') + '"').join(' ' + (join || 'OR') + ' ') : null;
}
function search(q, n = 6, kinds = ['doc', 'note']) {
  const d = open(); const ph = kinds.map(() => '?').join(',');
  const SQL = "SELECT path, kind, title, page, body, snippet(docs,3,'<mark>','</mark>',' ... ',14) snip, bm25(docs,0,0,6,1,0) rank FROM docs WHERE docs MATCH ? AND kind IN (" + ph + ") ORDER BY rank LIMIT ?";
  const rowsFor = (q2, limit) => { if (!q2) return []; try { return d.prepare(SQL).all(q2, ...kinds, limit); } catch (e) { return []; } };
  /* every word first: a page carrying all the words answers the question, while one that merely repeats a common word
     ("the", "how", a file name) does not crowd it out. A question no page answers in full falls back to any of them. */
  let rows = rowsFor(ftsQuery(q, 'AND'), n * 2);
  if (!rows.length) rows = rowsFor(ftsQuery(q, 'OR'), n * 4);
  const out = [], per = {};
  for (const r of rows) { per[r.path] = (per[r.path] || 0) + 1; if (per[r.path] > 2) continue; out.push({ path: r.path, kind: r.kind, title: r.title, page: r.page, text: r.body, snippet: r.snip }); if (out.length >= n) break; }
  return out;
}

/* one-off reading of a single file (for files dropped into the chat) */
async function extractFile(p) {
  const ext = path.extname(p).toLowerCase();
  if (LEGACY_EXT.has(ext)) return officeLib().readLegacy(p);
  if (TEXT_EXT.has(ext)) return [{ page: 0, text: fs.readFileSync(p, 'utf8') }];
  if (HTML_EXT.has(ext)) return [{ page: 0, text: U.htmlToTextKeepTables(fs.readFileSync(p, 'utf8')) }];
  if (OFFICE_EXT.has(ext)) return U.extractOffice(p, ext);
  if (ext === '.pdf') { const r = await pdfExtract(p); if (r.error) throw new Error(r.error); return r.pages || []; }
  throw new Error('unsupported');
}

/* keyword hits and meaning hits together: a question in your own words still lands on the right page */
async function searchSmart(q, n = 6, kinds = ['doc', 'note']) {
  const fts = search(q, n, kinds);
  let vec = [];
  try { vec = await vecSearch(q, n * 3); } catch (e) { vec = []; }
  if (!vec.length) return fts;
  const key = r => r.path + '|' + String(r.text || r.body || '').slice(0, 60);
  /* reciprocal rank fusion: two lists with different scales, judged by where each puts a passage. A page both lists
     like wins; a page only the meaning search finds still gets in. */
  const K = 60, by = new Map();
  const add = (r, weight, rank) => {
    if (!kinds.includes(r.kind)) return;
    const k = key(r), bump = weight / (K + rank);
    const had = by.get(k);
    if (had) had.score += bump;
    else by.set(k, { path: r.path, kind: r.kind, title: r.title, page: r.page, text: r.text || r.body || r.snippet || '', snippet: r.snippet || String(r.text || r.body || '').slice(0, 240), score: bump });
  };
  /* a passage the meaning search is sure about is worth more than one that merely shares a word */
  fts.forEach((r, i) => add({ path: r.path, kind: r.kind, title: r.title, page: r.page, text: r.body, snippet: r.snippet }, 1, i + 1));
  vec.forEach((r, i) => add(r, 1.6, i + 1));
  const out = [], per = {};
  for (const r of [...by.values()].sort((a, b) => b.score - a.score)) { per[r.path] = (per[r.path] || 0) + 1; if (per[r.path] > 2) continue; out.push(r); if (out.length >= n) break; }
  return out;
}

function indexNewTextFile(file, text) {
  const st = fs.statSync(file);
  return putChunks(file, 'doc', path.basename(file), [{ page:0, text }], Math.floor(st.mtimeMs), st.size, false);
}
module.exports = { extractFile, sources, addSource, removeSource, reindex, cancelIndex, status, stats, search, searchSmart, vectorize, vecStatus, vecCount, indexNote, noteNeedsIndex, indexNewTextFile, removePath, close, open };

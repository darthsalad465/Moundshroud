// Your own documents + notes: folder indexing and full-text search (SQLite FTS5, runs locally).
const fs = require('fs'), path = require('path'), cp = require('child_process');
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

let db = null;
function open() {
  if (db) return db;
  fs.mkdirSync(DATA, { recursive: true });
  db = new DatabaseSync(DB);
  db.exec("PRAGMA journal_mode=WAL; PRAGMA synchronous=NORMAL;");
  db.exec("CREATE TABLE IF NOT EXISTS files(path TEXT PRIMARY KEY, kind TEXT, mtime INTEGER, size INTEGER, chunks INTEGER)");
  db.exec("CREATE VIRTUAL TABLE IF NOT EXISTS docs USING fts5(path UNINDEXED, kind UNINDEXED, title, body, page UNINDEXED, tokenize='porter unicode61')");
  return db;
}
function close() { try { if (db) { db.close(); db = null; } } catch (e) {} if (pdf) { try { pdf.kill(); } catch (e) {} pdf = null; } }

/* ---- sources (folders you chose) ---- */
const sources = () => U.readJson(SRC, []);
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
function putChunks(p, kind, title, pages) {
  const d = open(); let n = 0;
  d.exec('BEGIN');
  try {
    d.prepare("DELETE FROM docs WHERE path=?").run(p);
    const ins = d.prepare("INSERT INTO docs(path,kind,title,body,page) VALUES (?,?,?,?,?)");
    for (const pg of pages) for (const c of chunk(pg.text)) { ins.run(p, kind, title, c, pg.page || 0); n++; }
    d.exec('COMMIT');
  } catch (e) { d.exec('ROLLBACK'); throw e; }
  return n;
}
function removePath(p) { const d = open(); d.prepare("DELETE FROM docs WHERE path=?").run(p); d.prepare("DELETE FROM files WHERE path=?").run(p); }

/* ---- pdf worker ---- */
let pdf = null, pdfQ = [], pdfBuf = '';
function pdfStart() {
  if (pdf || !fs.existsSync(PY)) return !!pdf;
  pdf = cp.spawn(PY, [PDFW], { stdio: ['pipe', 'pipe', 'ignore'], windowsHide: true });
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
    if (e.isDirectory()) { if (depth < 12 && !SKIP_DIR.test(e.name)) yield* walk(p, depth + 1); }
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
        const n = putChunks(p, 'doc', path.basename(p), pages);
        d.prepare("INSERT OR REPLACE INTO files(path,kind,mtime,size,chunks) VALUES (?,?,?,?,?)").run(p, 'doc', Math.floor(st.mtimeMs), st.size, n);
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
function indexNote(p, title, text) {
  const n = putChunks(p, 'note', title, [{ page: 0, text: title + '\n' + text }]);
  open().prepare("INSERT OR REPLACE INTO files(path,kind,mtime,size,chunks) VALUES (?,?,?,?,?)").run(p, 'note', Date.now(), text.length, n);
}

/* ---- searching ---- */
const STOP = new Set('a an and are as at be but by for from has have how i in is it its of on or that the their this to was what when where which who why will with you your do does did can could should would about into than then there these those them they we our not no if so such also any all more most some very just tell me please explain give show find list'.split(' '));
function ftsQuery(q) {
  const toks = (q.toLowerCase().match(/[\p{L}\p{N}]+/gu) || []).filter(t => t.length > 1 && !STOP.has(t));
  const uniq = [...new Set(toks)].slice(0, 14);
  return uniq.length ? uniq.map(t => '"' + t.replace(/"/g, '') + '"').join(' OR ') : null;
}
function search(q, n = 6, kinds = ['doc', 'note']) {
  const fq = ftsQuery(q); if (!fq) return [];
  const d = open(); const ph = kinds.map(() => '?').join(',');
  let rows = [];
  try { rows = d.prepare("SELECT path, kind, title, page, body, snippet(docs,3,'<mark>','</mark>',' ... ',14) snip, bm25(docs,0,0,6,1,0) rank FROM docs WHERE docs MATCH ? AND kind IN (" + ph + ") ORDER BY rank LIMIT ?").all(fq, ...kinds, n * 4); }
  catch (e) { return []; }
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

module.exports = { extractFile, sources, addSource, removeSource, reindex, cancelIndex, status, stats, search, indexNote, removePath, close, open };

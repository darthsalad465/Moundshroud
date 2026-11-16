// Bible Expert library (Spiritual > Bible Expert): finds the passages of the Bible, the Catechism, the Church Fathers, the
// Catholic Encyclopedia and the other Christian texts that match a question, so the model quotes real text instead of its memory.
// Texts: the ones built into the app (web\data), the free texts downloaded to data\christian-texts\ (lib/bible-texts.js) and
// your own plain .txt or .md files in data\bible\ (add or remove files there; the index follows by itself).
// Search is BM25 over passages of about 900 characters in a SQLite full-text index on disk (data\bible-index.db), so hundreds of
// megabytes of text cost no memory; nothing leaves this PC.
const fs = require('fs'), path = require('path');
const { DatabaseSync } = require('node:sqlite');
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');

const STOP = new Set('a an and are as at be but by for from had has have he her his i in is it its me my of on or our she so than that the their them then there these they this to us was we were what when where which who whom why will with you your do does did not no yes if how can could would should shall may might been being into about over under also very more most some any all each than too out up down off'.split(' '));
const words = s => String(s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').match(/[a-z][a-z']+|\d+/g) || [];
/* a light stemmer so "loved", "loves" and "loveth" meet */
const stem = w => w.length > 4 ? w.replace(/(ingly|ing|eth|ed|es|ly|s)$/, '') : w;
const terms = s => words(s).map(w => w.replace(/'s$/, '')).filter(w => w.length > 1 && !STOP.has(w)).map(stem);

/* the Project Gutenberg licence text around a book is not part of the book */
function strip(t) {
  const a = t.search(/\*\*\* ?START OF (THE|THIS) PROJECT GUTENBERG[^\n]*\n/i), b = t.search(/\*\*\* ?END OF (THE|THIS) PROJECT GUTENBERG/i);
  if (a >= 0) t = t.slice(t.indexOf('\n', a) + 1);
  const e = b >= 0 && a >= 0 ? t.search(/\*\*\* ?END OF (THE|THIS) PROJECT GUTENBERG/i) : -1;
  return e >= 0 ? t.slice(0, e) : t;
}
const titleOf = (t, file) => { const m = t.match(/^\s*Title:\s*(.+)$/mi); return (m ? m[1].trim() : path.basename(file).replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ')).slice(0, 120); };
/* "Gen 1:1", "John 3:16", "1 Cor. 13:4" at the start of a line: the passage cites the first and last verse it holds */
const VERSE = /^\s*((?:[1-3]\s?)?[A-Z][A-Za-z]{1,14}\.?(?:\s[A-Z][a-z]+)?\s\d{1,3}:\d{1,3})/;

function chunk(text, title) {
  const out = [], lines = strip(text).replace(/\r/g, '').split('\n'); let buf = [], len = 0, ref = '', last = '', head = '';
  const flush = () => { const t = buf.join(' ').replace(/\s+/g, ' ').trim(); if (t.length > 60) out.push({ title, where: ref ? (last && last !== ref ? ref + ' to ' + last : ref) : head || title, text: t }); buf = []; len = 0; ref = ''; last = ''; };
  for (const raw of lines) {
    const ln = raw.trim();
    if (!ln) { if (len > 500) flush(); continue; }
    if (/^(CHAPTER|BOOK|PART|ARTICLE|QUESTION|LECTURE|SECTION)\b[^\n]{0,70}$/i.test(ln) || (ln.length < 60 && ln === ln.toUpperCase() && /[A-Z]{3}/.test(ln))) { if (len > 200) flush(); head = title + ', ' + ln.replace(/\s+/g, ' ').slice(0, 60); }
    const m = VERSE.exec(ln); if (m) { const r = m[1].replace(/\s+/g, ' '); if (!ref) ref = r; last = r; }
    buf.push(ln); len += ln.length + 1;
    if (len > 800) flush();
  }
  flush();
  return out;
}

/* the texts that ship inside the app (web\data): the Douay-Rheims Bible with Challoner's notes and the devotional library */
const readJson = p => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { return null; } };
function douay(file) {
  const j = readJson(file); if (!j || !Array.isArray(j.books)) return null;
  const title = 'Douay-Rheims Bible (Challoner)', ch = [];
  for (const b of j.books) {
    if (b.i && b.i.length > 60) ch.push({ title, where: b.n + ', introduction', text: b.n + ' (introduction): ' + String(b.i).replace(/\s+/g, ' ').trim() });
    (b.ch || []).forEach((c, ci) => {
      const vs = c.v || [], notes = c.n || {};
      for (let a = 0; a < vs.length; a += 6) {
        const z = Math.min(vs.length, a + 6); let t = a === 0 && c.s ? c.s + ' ' : '';
        for (let k = a; k < z; k++) t += (k + 1) + ' ' + String(vs[k]).replace(/\s+/g, ' ').trim() + ' ';
        for (let k = a; k < z; k++) if (notes[k]) t += '[Challoner on v' + (k + 1) + ': ' + String(notes[k]).replace(/\s+/g, ' ').trim().slice(0, 500) + '] ';
        ch.push({ title, where: b.n + ' ' + (ci + 1) + ':' + (a + 1) + (z > a + 1 ? '-' + z : ''), text: t.trim() });
      }
    });
  }
  return { title, group: 'Bible', chunks: ch };
}
function devotional(file) {
  const j = readJson(file); if (!j || !Array.isArray(j.paras)) return null;
  const title = (j.title || 'Text') + (j.author ? ' (' + j.author + ')' : ''), ch = []; let head = '', buf = [], len = 0;
  const flush = () => { const t = buf.join(' ').replace(/\s+/g, ' ').trim(); if (t.length > 60) ch.push({ title, where: j.title + (head ? ', ' + head : ''), text: t }); buf = []; len = 0; };
  for (const p of j.paras) {
    if (p && typeof p === 'object') { if (p.h) { if (len > 200) flush(); head = String(p.h).replace(/\s+/g, ' ').slice(0, 60); } continue; }
    const s = String(p || '').trim(); if (!s) continue;
    buf.push(s); len += s.length + 1; if (len > 800) flush();
  }
  flush();
  return { title, group: 'Built in', chunks: ch };
}

/* every text the index covers, with a signature that changes when the file does */
function sources(dataDir, webData) {
  const out = [], st = p => { try { const x = fs.statSync(p); return { size: x.size, mtime: Math.round(x.mtimeMs) }; } catch (e) { return null; } };
  if (webData) {
    const d = path.join(webData, 'bible-dr.json'), x = st(d); if (x) out.push({ name: 'builtin:douay', sig: x.size + ':' + x.mtime, mb: 0, builtIn: true, read: () => douay(d) });
    let ids = []; try { ids = fs.readdirSync(path.join(webData, 'spiritual')).filter(f => /\.json$/.test(f) && f !== 'index.json').sort(); } catch (e) { }
    for (const f of ids) { const p = path.join(webData, 'spiritual', f), y = st(p); if (y) out.push({ name: 'builtin:' + f, sig: y.size + ':' + y.mtime, mb: 0, builtIn: true, read: () => devotional(p) }); }
  }
  for (const folder of ['christian-texts', 'bible']) {
    const dir = path.join(dataDir, folder); let fl = []; try { fl = fs.readdirSync(dir).filter(f => /\.(txt|md)$/i.test(f) && f[0] !== '_').sort(); } catch (e) { }
    for (const f of fl) {
      const p = path.join(dir, f), x = st(p); if (!x) continue;
      out.push({ name: folder + '/' + f, sig: x.size + ':' + x.mtime, mb: +(x.size / 1048576).toFixed(2), bytes: x.size, read: () => {
        const t = fs.readFileSync(p, 'utf8'), title = titleOf(t, f), g = /^Group:\s*(.+)$/m.exec(t.slice(0, 800));
        return { title, group: g ? g[1].trim() : '', chunks: chunk(t, title) };
      } });
    }
  }
  return out;
}

const SCHEMA = 2;
function openDb(dataDir) {
  try { fs.mkdirSync(dataDir, { recursive: true }); } catch (e) { }
  const db = new DatabaseSync(path.join(dataDir, 'bible-index.db'));
  db.exec('PRAGMA busy_timeout=8000; PRAGMA journal_mode=WAL; PRAGMA synchronous=NORMAL;');
  if (db.prepare('PRAGMA user_version').get().user_version !== SCHEMA) db.exec('DROP TABLE IF EXISTS fts; DROP TABLE IF EXISTS pas; DROP TABLE IF EXISTS src; PRAGMA user_version=' + SCHEMA);
  db.exec('CREATE TABLE IF NOT EXISTS src(name TEXT PRIMARY KEY, sig TEXT, title TEXT, grp TEXT, passages INTEGER, mb REAL, built INTEGER);' +
    'CREATE TABLE IF NOT EXISTS pas(id INTEGER PRIMARY KEY, src TEXT, title TEXT, whr TEXT, body TEXT);' +
    'CREATE INDEX IF NOT EXISTS pas_src ON pas(src);' +
    "CREATE VIRTUAL TABLE IF NOT EXISTS fts USING fts5(body, content='pas', content_rowid='id', tokenize='porter unicode61 remove_diacritics 2');" +
    "CREATE VIRTUAL TABLE IF NOT EXISTS fts_v USING fts5vocab(fts, 'row')");
  return db;
}
/* how many passages hold a word: the word is stemmed by the index's own tokenizer (a scratch table), then looked up in the index's vocabulary */
let scratch = null; const stemCache = new Map();
function stemOf(w) {
  if (stemCache.has(w)) return stemCache.get(w);
  if (!scratch) { scratch = new DatabaseSync(':memory:'); scratch.exec("CREATE VIRTUAL TABLE t USING fts5(x, tokenize='porter unicode61 remove_diacritics 2'); CREATE VIRTUAL TABLE tv USING fts5vocab(t, 'row')"); }
  scratch.exec('DELETE FROM t'); scratch.prepare('INSERT INTO t(x) VALUES (?)').run(w);
  const r = scratch.prepare('SELECT term FROM tv').get(), s = r ? r.term : w; stemCache.set(w, s); return s;
}
const docFreq = (d, w) => { const r = d.prepare('SELECT doc FROM fts_v WHERE term=?').get(stemOf(w)); return r ? r.doc : 0; };
/* one text in, in one transaction: its old passages leave the index first (they were indexed from the same rows, so the index can drop them) */
function indexOne(d, s) {
  const had = d.prepare('SELECT sig FROM src WHERE name=?').get(s.name);
  if (had && had.sig === s.sig) return;
  let x; try { x = s.read(); } catch (e) { return; }
  if (!x) return;
  d.exec('BEGIN IMMEDIATE');
  try {
    const again = d.prepare('SELECT sig FROM src WHERE name=?').get(s.name); if (again && again.sig === s.sig) { d.exec('COMMIT'); return; }      /* another copy of the app did it while this one waited */
    d.prepare("INSERT INTO fts(fts, rowid, body) SELECT 'delete', id, body FROM pas WHERE src=?").run(s.name); d.prepare('DELETE FROM pas WHERE src=?').run(s.name);
    const ins = d.prepare('INSERT INTO pas(src,title,whr,body) VALUES(?,?,?,?)'); for (const c of x.chunks) ins.run(s.name, c.title, c.where, c.text);
    d.prepare('INSERT INTO fts(rowid, body) SELECT id, body FROM pas WHERE src=?').run(s.name);
    d.prepare('INSERT OR REPLACE INTO src(name,sig,title,grp,passages,mb,built) VALUES(?,?,?,?,?,?,?)').run(s.name, s.sig, x.title, x.group || '', x.chunks.length, s.mb || 0, s.builtIn ? 1 : 0);
    d.exec('COMMIT');
  } catch (e) { try { d.exec('ROLLBACK'); } catch (z) { } throw e; }
}
function forgetOne(d, name) {
  d.exec('BEGIN IMMEDIATE');
  try { d.prepare("INSERT INTO fts(fts, rowid, body) SELECT 'delete', id, body FROM pas WHERE src=?").run(name); d.prepare('DELETE FROM pas WHERE src=?').run(name); d.prepare('DELETE FROM src WHERE name=?').run(name); d.exec('COMMIT'); } catch (e) { try { d.exec('ROLLBACK'); } catch (z) { } }
}

function create(dataDir, webData) {
  const DIR = path.join(dataDir, 'bible');
  let db = null, bg = null, prog = null, checkedAt = 0, dirSig = '', pending = [];
  const open = () => db || (db = openDb(dataDir));
  const dirsNow = () => ['christian-texts', 'bible'].map(f => { try { return Math.round(fs.statSync(path.join(dataDir, f)).mtimeMs); } catch (e) { return 0; } }).join(',');
  /* which texts still need indexing; a text that disappeared leaves the index at once. A few small files are indexed before the answer is looked
     for; a big batch (the first start with all the downloaded texts) is indexed by a worker thread, so the app stays quick meanwhile. */
  function check(force) {
    const now = Date.now(), ds = dirsNow(); if (!force && ds === dirSig && now - checkedAt < 3000) return; checkedAt = now; dirSig = ds;      /* a file added or removed shows at once; a file changed in place within 3 seconds */
    const d = open(), all = sources(dataDir, webData), have = new Map(d.prepare('SELECT name, sig FROM src').all().map(r => [r.name, r.sig])), names = new Set(all.map(s => s.name));
    for (const n of have.keys()) if (!names.has(n)) forgetOne(d, n);
    pending = all.filter(s => have.get(s.name) !== s.sig);
    if (!pending.length || bg) { if (!pending.length && !bg) prog = null; return; }
    const bytes = pending.reduce((a, s) => a + (s.bytes || 3e6), 0);
    if (bytes <= 3e6) { for (const s of pending) { try { indexOne(d, s); } catch (e) { } } pending = []; prog = null; return; }
    prog = { done: 0, total: pending.length, now: '' };
    const end = () => { bg = null; prog = null; checkedAt = 0; };
    try { bg = new Worker(__filename, { workerData: { bibleIndex: true, dataDir, webData } }); bg.on('message', m => { if (m && m.total != null) prog = m; }); bg.on('error', end); bg.on('exit', end); } catch (e) { end(); }
  }
  const SEL = 'SELECT pas.title AS title, pas.whr AS whr, pas.body AS body, bm25(fts) AS s FROM fts JOIN pas ON pas.id = fts.rowid WHERE fts MATCH ? ORDER BY s LIMIT ';
  function search(q, n = 6) {
    check(false);
    const ws = [...new Set(words(q).map(w => w.replace(/'s$/, '').replace(/'/g, '')).filter(w => w.length > 1 && !STOP.has(w)))].slice(0, 24); if (!ws.length) return [];
    let rows = [], keep = [];
    try {
      const d = open(), N = Math.max(1, d.prepare('SELECT COALESCE(SUM(passages), 0) AS n FROM src').get().n);
      /* the commonest words of the library (church, God, Christ...) cost a long scan and say little: the rarer words of the question lead.
         A passage with all of those words comes first, then passages with some of them. */
      const df = ws.map(w => ({ w, df: docFreq(d, w) })).filter(x => x.df > 0).sort((a, b) => a.df - b.df); if (!df.length) return [];
      keep = df.filter(x => x.df < N * 0.12); if (keep.length < 2) keep = df.slice(0, 3);
      const term = x => '"' + x.w + '"', seen0 = new Set();
      if (keep.length > 1 && keep.length <= 5) for (const r of d.prepare(SEL + 40).all(keep.map(term).join(' AND '))) { seen0.add(r.body.slice(0, 80)); rows.push(r); }
      for (const r of d.prepare(SEL + 80).all(keep.map(term).join(' OR '))) if (!seen0.has(r.body.slice(0, 80))) rows.push(r);
    } catch (e) { return []; }
    const pref = keep.map(x => x.w.length > 5 ? x.w.slice(0, x.w.length - 2) : x.w);
    /* a quoted phrase beats scattered words: three words of the question in a row, found in a passage, add to its score */
    const qw = words(q), tri = []; for (let i = 0; i + 2 < qw.length; i++) tri.push(qw[i] + ' ' + qw[i + 1] + ' ' + qw[i + 2]);
    /* the Catechism and the councils outrank a commentary on them; pages of numbers (indexes, footnote lists) rank lower */
    const prime = t => /^Catechism of the Catholic Church/.test(t) ? 1.3 : /^(Douay-Rheims|The Catechism of the Council|Documents of the Second Vatican|Dogmatic Canons|The Canons and Decrees)/.test(t) ? 1.15 : 1;
    const scored = rows.map(r => { const low0 = r.body.toLowerCase(), cov = pref.length ? pref.filter(p => low0.includes(p)).length / pref.length : 1; let s = -r.s * prime(r.title) * (0.55 + 0.9 * cov); if (((r.body.match(/\d/g) || []).length / r.body.length) > 0.1) s *= 0.7; if (tri.length) { const low = r.body.toLowerCase().replace(/[^a-z' ]+/g, ' ').replace(/ +/g, ' '); for (const g of tri) if (low.includes(g)) s += 12; } return { r, s }; }).sort((x, y) => y.s - x.s);
    /* no one work fills the answer alone: at most three passages from one work, unless there are too few others */
    const seen = new Set(), per = new Map(), out = [], later = [];
    for (const { r, s } of scored) {
      const key = r.body.slice(0, 80); if (seen.has(key)) continue; seen.add(key);
      const item = { title: r.title, where: r.whr, text: r.body.slice(0, 1400), score: +s.toFixed(2) };
      if ((per.get(r.title) || 0) >= 3) { later.push(item); continue; }
      per.set(r.title, (per.get(r.title) || 0) + 1); out.push(item); if (out.length >= n) break;
    }
    for (const it of later) { if (out.length >= n) break; out.push(it); }
    return out;
  }
  function status() {
    check(false); const d = open();
    const books = d.prepare('SELECT name, title, grp, passages, mb, built FROM src ORDER BY built DESC, grp, title').all().map(r => ({ file: r.built ? '(built in)' : r.name.replace(/^[^/]*\//, ''), title: r.title, group: r.grp || (r.built ? 'Built in' : 'Your files'), passages: r.passages, mb: r.mb, builtIn: !!r.built }));
    return { dir: DIR, books, passages: books.reduce((a, b) => a + b.passages, 0), indexing: prog ? { done: prog.done, total: prog.total, now: prog.now } : null };
  }
  function close() { try { if (bg) bg.terminate(); } catch (e) { } bg = null; try { if (db) db.close(); } catch (e) { } db = null; }
  return { search, status, close, DIR };
}

/* the worker: indexes every text that is new or changed, reports its place, and ends */
if (!isMainThread && workerData && workerData.bibleIndex) {
  const d = openDb(workerData.dataDir), all = sources(workerData.dataDir, workerData.webData), have = new Map(d.prepare('SELECT name, sig FROM src').all().map(r => [r.name, r.sig]));
  const todo = all.filter(s => have.get(s.name) !== s.sig); let done = 0;
  for (const s of todo) { parentPort.postMessage({ done, total: todo.length, now: s.name }); try { indexOne(d, s); } catch (e) { } done++; }
  try { d.exec('PRAGMA wal_checkpoint(TRUNCATE)'); d.close(); } catch (e) { }
}
module.exports = { create, chunk, terms, sources };

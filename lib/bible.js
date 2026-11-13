// Bible Expert library (Chat > Bible): finds the passages of your own Bible, Catechism and Church-history texts
// that match a question, so the model quotes real text instead of its memory.
// Texts are plain .txt or .md files in data\bible\ (add or remove files there; the index rebuilds by itself).
// Search is BM25 over passages of about 900 characters, all in memory; nothing leaves this PC.
const fs = require('fs'), path = require('path');

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
const titleOf = (t, file) => { const m = t.match(/^\s*Title:\s*(.+)$/mi); return (m ? m[1].trim() : path.basename(file).replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ')).slice(0, 80); };
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
  return { title, chunks: ch };
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
  return { title, chunks: ch };
}
function builtIn(webData) {
  if (!webData) return [];
  const out = [], d = douay(path.join(webData, 'bible-dr.json')); if (d) out.push(d);
  let ids = []; try { ids = fs.readdirSync(path.join(webData, 'spiritual')).filter(f => /\.json$/.test(f) && f !== 'index.json'); } catch (e) { }
  for (const f of ids) { const x = devotional(path.join(webData, 'spiritual', f)); if (x && x.chunks.length) out.push(x); }
  return out;
}

function create(dataDir, webData) {
  const DIR = path.join(dataDir, 'bible');
  let idx = null, sig = '';
  const files = () => { try { return fs.readdirSync(DIR).filter(f => /\.(txt|md)$/i.test(f)).map(f => { const p = path.join(DIR, f), st = fs.statSync(p); return { f, p, size: st.size, mtime: st.mtimeMs }; }); } catch (e) { return []; } };
  function load() {
    const fl = files(), s = fl.map(x => x.f + ':' + x.size + ':' + x.mtime).join('|');
    if (idx && s === sig) return idx;
    const docs = [], books = [];
    for (const b of builtIn(webData)) { books.push({ file: '(built in)', title: b.title, passages: b.chunks.length, mb: 0, builtIn: true }); docs.push(...b.chunks); }
    for (const x of fl) {
      let t = ''; try { t = fs.readFileSync(x.p, 'utf8'); } catch (e) { continue; }
      const title = titleOf(t, x.f), ch = chunk(t, title); books.push({ file: x.f, title, passages: ch.length, mb: +(x.size / 1048576).toFixed(2) }); docs.push(...ch);
    }
    const df = new Map(); let total = 0;
    docs.forEach(d => { d.tf = new Map(); const ts = terms(d.text); d.len = ts.length || 1; total += d.len; ts.forEach(w => d.tf.set(w, (d.tf.get(w) || 0) + 1)); d.tf.forEach((_, w) => df.set(w, (df.get(w) || 0) + 1)); });
    idx = { docs, df, avg: total / (docs.length || 1), books }; sig = s; return idx;
  }
  function search(q, n = 6) {
    const I = load(); if (!I.docs.length) return [];
    const qt = [...new Set(terms(q))]; if (!qt.length) return [];
    const N = I.docs.length, k1 = 1.4, b = .75, scored = [];
    for (const d of I.docs) {
      let s = 0;
      for (const w of qt) { const f = d.tf.get(w); if (!f) continue; const dfw = I.df.get(w) || 0, idf = Math.log(1 + (N - dfw + .5) / (dfw + .5)); s += idf * (f * (k1 + 1)) / (f + k1 * (1 - b + b * d.len / I.avg)); }
      if (s > 0) scored.push({ d, s });
    }
    scored.sort((x, y) => y.s - x.s);
    /* a quoted phrase beats scattered words: three words of the question in a row, found in a passage, add to its score */
    const qw = words(q), tri = []; for (let i = 0; i + 2 < qw.length; i++) tri.push(qw[i] + ' ' + qw[i + 1] + ' ' + qw[i + 2]);
    if (tri.length) { for (const x of scored.slice(0, 3000)) { const low = x.d.text.toLowerCase().replace(/[^a-z' ]+/g, ' ').replace(/ +/g, ' '); for (const g of tri) if (low.includes(g)) x.s += 12; } scored.sort((x, y) => y.s - x.s); }
    const seen = new Set(), out = [];
    for (const { d, s } of scored) { const key = d.text.slice(0, 80); if (seen.has(key)) continue; seen.add(key); out.push({ title: d.title, where: d.where, text: d.text.slice(0, 1400), score: +s.toFixed(2) }); if (out.length >= n) break; }
    return out;
  }
  const status = () => { const I = load(); return { dir: DIR, books: I.books, passages: I.docs.length }; };
  return { search, status, DIR };
}
module.exports = { create, chunk, terms };

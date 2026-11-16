// Build web/data/bible-kjv.json from the King James text and its Apocrypha, both already on this PC.
// The app's Bible reader expects 73 books in the Catholic order; the KJV's 66 books are mapped into that
// order, and the deuterocanonical books come from the KJV Apocrypha. Public domain (Project Gutenberg).
const fs = require('fs'), path = require('path');

const ROOT = path.join(__dirname, '..');
const KJV_FILE = path.join(ROOT, 'data', 'christian-texts', 'pg-10.txt');
const APO_FILE = path.join(ROOT, 'data', 'christian-texts', 'pg-124.txt');
const DR_FILE = path.join(ROOT, 'web', 'data', 'bible-dr.json');
const OUT = path.join(ROOT, 'web', 'data', 'bible-kjv.json');

function body(t) {
  const a = t.search(/\*\*\* ?START OF (THE|THIS) PROJECT GUTENBERG[^\n]*\n/i);
  if (a >= 0) t = t.slice(t.indexOf('\n', a) + 1);
  const e = t.search(/\*\*\* ?END OF (THE|THIS) PROJECT GUTENBERG/i);
  if (e >= 0) t = t.slice(0, e);
  return t.replace(/\r/g, '');
}

function clean(s) {
  return String(s || '')
    .replace(/_/g, '')
    .replace(/\s+/g, ' ')
    .replace(/^[\s.,;:]+|[\s]+$/g, '')
    .trim();
}

function blankChapter() { return { v: [] }; }

/* Parse a section that uses chapter:verse markers, e.g. "1:1 In the beginning..." */
function parseVerses(lines, opts) {
  opts = opts || {};
  const chapters = [];
  let cur = null, intro = [];
  const put = (c, v, text) => {
    text = clean(text); if (!text) return;
    while (chapters.length < c) chapters.push(blankChapter());
    const arr = chapters[c - 1].v;
    while (arr.length < v - 1) arr.push('');
    arr[v - 1] = arr[v - 1] ? arr[v - 1] + ' ' + text : text;
    cur = { c, v };
  };
  for (const raw of lines) {
    const line = raw.trim(); if (!line) continue;
    if (/^\[/.test(line) && /\]$/.test(line)) continue;                 // editorial headings such as [The Wisdom...]
    if (/^(CHAPTER|BOOK|PART)\b/i.test(line) && line.length < 70) continue;
    const starts = [];
    const re = /\b(\d{1,3}):(\d{1,3})\b/g;
    let m;
    while ((m = re.exec(line))) starts.push({ c: +m[1], v: +m[2], at: m.index, end: re.lastIndex });
    if (starts.length) {
      for (let k = 0; k < starts.length; k++) {
        const s = starts[k], e = k + 1 < starts.length ? starts[k + 1].at : line.length;
        const text = line.slice(s.end, e).trim();
        if (s.c >= 1 && s.c <= 200 && s.v >= 1 && s.v <= 300) put(s.c, s.v, text);
      }
      continue;
    }
    /* the Song of the Three uses plain verse numbers ("1 And they walked...") */
    const plain = opts.plainNumbers && /^(\d{1,3})\s+(.+)$/.exec(line);
    if (plain) { put(1, +plain[1], plain[2]); continue; }
    if (cur) put(cur.c, cur.v, line); else intro.push(line);
  }
  return { chapters, intro };
}

/* Parse the 66-book KJV body. Book headings are the known Gutenberg titles, in order. */
const KJV_TITLES = [
  'The First Book of Moses: Called Genesis', 'The Second Book of Moses: Called Exodus', 'The Third Book of Moses: Called Leviticus',
  'The Fourth Book of Moses: Called Numbers', 'The Fifth Book of Moses: Called Deuteronomy', 'The Book of Joshua', 'The Book of Judges',
  'The Book of Ruth', 'The First Book of the Kings', 'The Second Book of the Kings', 'The Third Book of the Kings',
  'The Fourth Book of the Kings', 'The First Book of the Chronicles', 'The Second Book of the Chronicles', 'Ezra',
  'The Book of Nehemiah', 'The Book of Esther', 'The Book of Job', 'The Book of Psalms', 'The Proverbs', 'The Preacher',
  'The Song of Solomon', 'The Book of the Prophet Isaiah', 'The Book of the Prophet Jeremiah', 'The Lamentations of Jeremiah',
  'The Book of the Prophet Ezekiel', 'The Book of Daniel', 'Hosea', 'Joel', 'Amos', 'Obadiah', 'Jonah', 'Micah', 'Nahum',
  'Habakkuk', 'Zephaniah', 'Haggai', 'Zechariah', 'Malachi', 'The Gospel According to Saint Matthew',
  'The Gospel According to Saint Mark', 'The Gospel According to Saint Luke', 'The Gospel According to Saint John',
  'The Acts of the Apostles', 'The Epistle of Paul the Apostle to the Romans', 'The First Epistle of Paul the Apostle to the Corinthians',
  'The Second Epistle of Paul the Apostle to the Corinthians', 'The Epistle of Paul the Apostle to the Galatians',
  'The Epistle of Paul the Apostle to the Ephesians', 'The Epistle of Paul the Apostle to the Philippians',
  'The Epistle of Paul the Apostle to the Colossians', 'The First Epistle of Paul the Apostle to the Thessalonians',
  'The Second Epistle of Paul the Apostle to the Thessalonians', 'The First Epistle of Paul the Apostle to Timothy',
  'The Second Epistle of Paul the Apostle to Timothy', 'The Epistle of Paul the Apostle to Titus',
  'The Epistle of Paul the Apostle to Philemon', 'The Epistle of Paul the Apostle to the Hebrews', 'The General Epistle of James',
  'The First Epistle General of Peter', 'The Second General Epistle of Peter', 'The First Epistle General of John',
  'The Second Epistle General of John', 'The Third Epistle General of John', 'The General Epistle of Jude',
  'The Revelation of Saint John the Divine'
];

function parseKjv() {
  const lines = body(fs.readFileSync(KJV_FILE, 'utf8')).split('\n');
  const out = [];
  /* skip the list of book titles at the top: the body starts after the second Old Testament heading */
  const marker = 'The Old Testament of the King James Version of the Bible';
  const first = lines.findIndex(l => l.trim() === marker);
  const second = lines.findIndex((l, i) => i > first && l.trim() === marker);
  let i = second >= 0 ? second + 1 : 0;
  for (let b = 0; b < KJV_TITLES.length; b++) {
    const title = KJV_TITLES[b];
    while (i < lines.length && lines[i].trim() !== title) i++;
    if (i >= lines.length) throw new Error('KJV heading not found: ' + title);
    i++;
    const next = b + 1 < KJV_TITLES.length ? KJV_TITLES[b + 1] : null;
    const sec = [];
    while (i < lines.length && (!next || lines[i].trim() !== next)) { sec.push(lines[i]); i++; }
    const parsed = parseVerses(sec);
    out.push({ title, chapters: parsed.chapters });
  }
  return out;
}

/* Parse the Apocrypha into named sections. */
const APO_SECTIONS = [
  ['esdras1', /^The First Book of Esdras$/],
  ['esdras2', /^The Second Book of Esdras/],
  ['tobit', /^The Book of Tobit$/],
  ['judith', /^The Book of Judith$/],
  ['estherAdd', /^The Greek Additions to Esther$/],
  ['wisdom', /^\[The Wisdom of Solomon\]$/],
  ['sirach', /^The Book of Sirach/],
  ['baruch', /^The Book of Baruch$/],
  ['jeremiah', /^The Epistle \[or Letter\] of Jeremiah/],
  ['song', /^The Song of the Three Holy Children$/],
  ['susanna', /^The Book of Susanna/],
  ['bel', /^The History of the Destruction of$/],
  ['manasses', /^The Prayer of Manasses$/],
  ['macc1', /^The First Book of the Maccabees$/],
  ['macc2', /^The Second Book of the Maccabees$/]
];

function parseApocrypha() {
  const lines = body(fs.readFileSync(APO_FILE, 'utf8')).split('\n');
  const starts = [];
  for (let i = 0; i < lines.length; i++) {
    /* the table of contents is indented by one space; the real headings start at the left margin */
    if (/^\s/.test(lines[i])) continue;
    const line = lines[i].trim();
    for (const [key, re] of APO_SECTIONS) if (re.test(line)) { starts.push({ key, i }); break; }
  }
  /* keep the first occurrence of each section after the table of contents */
  const seen = new Set(), use = [];
  for (const s of starts) { if (seen.has(s.key)) continue; seen.add(s.key); use.push(s); }
  const out = {};
  for (let k = 0; k < use.length; k++) {
    const from = use[k].i + 1, to = k + 1 < use.length ? use[k + 1].i : lines.length;
    const sec = lines.slice(from, to);
    if (use[k].key === 'bel') { /* skip the continuation line "Bel and the Dragon" and "Cut off from the end of Daniel." */ }
    const parsed = parseVerses(sec, { plainNumbers: use[k].key === 'song' });
    out[use[k].key] = parsed;
  }
  return out;
}

/* The KJV book order mapped to the app's 73-book Catholic order. */
const KJV_TO_DR = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 18, 19, 20, 21, 22, 23, 26, 27, 28, 30, 31,
  32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62,
  63, 64, 65, 66, 67, 68, 69, 70, 71, 72];

function make() {
  const dr = JSON.parse(fs.readFileSync(DR_FILE, 'utf8'));
  if (!dr || !Array.isArray(dr.books) || dr.books.length !== 73) throw new Error('The Douay-Rheims book list is needed as the shape of the Bible.');
  const kjv = parseKjv();
  if (kjv.length !== 66) throw new Error('Expected 66 KJV books, found ' + kjv.length);
  const apo = parseApocrypha();

  const books = dr.books.map(b => ({ id: b.id, n: b.n, d: b.d, a: b.a, t: b.t, dc: b.dc, i: b.i, ch: [] }));
  const set = (i, chapters) => { books[i].ch = chapters; };

  /* the 66 books shared with the Catholic canon */
  KJV_TO_DR.forEach((drIx, k) => set(drIx, kjv[k].chapters));

  /* the deuterocanonical books from the KJV Apocrypha */
  set(16, apo.tobit.chapters);
  set(17, apo.judith.chapters);
  set(24, apo.wisdom.chapters);
  set(25, apo.sirach.chapters);

  /* Baruch 1-5 + the Letter of Jeremiah as Baruch 6 (its text starts at 6:1, so the earlier slots are empty) */
  const bar = apo.baruch.chapters.slice();
  const letter = apo.jeremiah.chapters.find(c => c && c.v.length);
  if (letter) bar.push(letter);
  set(29, bar);

  set(44, apo.macc1.chapters);
  set(45, apo.macc2.chapters);

  /* Esther: the KJV's 10 chapters + the Greek additions (10:4-16:24) */
  const est = kjv[16].chapters.slice();
  const add = apo.estherAdd.chapters;
  const est10 = est[9] || blankChapter();
  const add10 = add[9] || blankChapter();
  /* KJV Esther 10:1-3, then the additions from 10:4 onward */
  const merged10 = { v: est10.v.slice(0, 3) };
  for (let v = 4; v <= add10.v.length; v++) merged10.v[v - 1] = add10.v[v - 1] || '';
  est[9] = merged10;
  for (let c = 10; c < add.length; c++) if (add[c] && add[c].v.length) est.push(add[c]);
  set(18, est);

  /* Daniel: the KJV's 12 chapters + the Song of the Three (after verse 23), Susanna (13), Bel (14) */
  const dan = kjv[26].chapters.slice();
  const song = apo.song.chapters[0] || blankChapter();
  const d3 = dan[2] || blankChapter();
  const merged3 = { v: d3.v.slice(0, 23).concat(song.v, d3.v.slice(23)) };
  merged3.s = 'The Song of the Three Holy Children, from the KJV Apocrypha, follows verse 23.';
  dan[2] = merged3;
  if (apo.susanna.chapters[0]) dan.push(apo.susanna.chapters[0]);
  if (apo.bel.chapters[0]) dan.push(apo.bel.chapters[0]);
  set(31, dan);

  /* tidy: every chapter is an object with a non-empty verse array */
  const cleanBook = b => {
    b.ch = (b.ch || []).map(c => {
      const v = (c && c.v ? c.v : []).map(x => clean(x)).filter(Boolean);
      const o = { v };
      if (c && c.s) o.s = clean(c.s);
      return o;
    });
    while (b.ch.length && !b.ch[b.ch.length - 1].v.length) b.ch.pop();
    return b;
  };
  books.forEach(cleanBook);

  const missing = books.map((b, i) => b.ch.length ? null : i + ':' + b.d).filter(Boolean);
  if (missing.length) throw new Error('These books have no chapters: ' + missing.join(', '));

  return {
    title: 'King James Version (with the Apocrypha)',
    source: 'The King James Version of the Bible and the Apocrypha, Project Gutenberg #10 and #124 (public domain)',
    books
  };
}

if (require.main === module) {
  const out = make();
  fs.writeFileSync(OUT, JSON.stringify(out));
  const chapters = out.books.reduce((a, b) => a + b.ch.length, 0);
  const verses = out.books.reduce((a, b) => a + b.ch.reduce((x, c) => x + c.v.length, 0), 0);
  console.log('Wrote ' + OUT);
  console.log(out.books.length + ' books, ' + chapters + ' chapters, ' + verses + ' verses, ' + (fs.statSync(OUT).size / 1048576).toFixed(1) + ' MB');
}

module.exports = { make, parseVerses, parseKjv, parseApocrypha };

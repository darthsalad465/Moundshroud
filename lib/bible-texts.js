// Free Christian texts for the Bible Expert (Spiritual › Bible Expert).
// Downloads public-domain and freely published texts as plain .txt files into data\christian-texts\, where the Bible Expert
// finds them by itself (your own files go in data\bible\ and are read too). Sources: the Christian Classics Ethereal Library (CCEL: Church Fathers, Aquinas, Calvin,
// creeds, Church history), Project Gutenberg, the Internet Archive (1907 to 1913 Catholic Encyclopedia and other
// scans that are out of copyright) and vatican.va (the Catechism, Vatican II and the papal encyclicals, which the Holy See
// publishes free to read; they are kept here for private study only).
// Run it with:  node lib\bible-texts.js [data folder]      (or install-christian-texts.ps1). It can be run again at any time:
// a text that is already there is skipped, so an interrupted run carries on where it stopped.
const fs = require('fs'), path = require('path');

const UA = 'Moundshroud personal offline library (one-time download of free texts)';
const RIGHTS = { ccel: 'Public domain (Christian Classics Ethereal Library)', pg: 'Public domain (Project Gutenberg)', ia: 'Public domain (Internet Archive scan, OCR text)', vatican: 'Copyright Libreria Editrice Vaticana, published free to read by the Holy See; kept for private study only' };

/* ---------------- what to fetch ---------------- */
const num = (n, w) => String(n).padStart(w, '0');
const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
const CCEL = [
  ...range(1, 10).map(n => ['schaff/anf' + num(n, 2), 'Church Fathers']),
  ...range(1, 14).map(n => ['schaff/npnf1' + num(n, 2), 'Church Fathers']),
  ...range(1, 14).map(n => ['schaff/npnf2' + num(n, 2), 'Church Fathers']),
  ...range(1, 8).map(n => ['schaff/hcc' + n, 'Church history']),
  ...range(1, 3).map(n => ['schaff/creeds' + n, 'Creeds and confessions']),
  ...range(1, 13).map(n => ['schaff/encyc' + num(n, 2), 'Reference']),
  ['aquinas/summa', 'Catholic theology'], ['aquinas/catena1', 'Catholic theology'], ['aquinas/catena2', 'Catholic theology'],
  ['calvin/institutes', 'Protestant theology'], ['luther/bondage', 'Protestant theology'], ['wesley/sermons', 'Protestant theology'],
  ...range(1, 6).map(n => ['henry/mhc' + n, 'Bible commentary']), ['jamieson/jfb', 'Bible commentary'],
  ['john_cross/dark_night', 'Spiritual classics'], ['desales/devout_life', 'Spiritual classics'], ['bernard/loving_god', 'Spiritual classics'],
];
/* [Project Gutenberg number, title, group] */
const PG = [
  [19690, 'Apologia pro Vita Sua (John Henry Newman)', 'Catholic theology'], [34022, 'An Essay in Aid of a Grammar of Assent (John Henry Newman)', 'Catholic theology'], [35110, 'An Essay on the Development of Christian Doctrine (John Henry Newman)', 'Catholic theology'],
  [16769, 'Orthodoxy (G. K. Chesterton)', 'Catholic theology'], [470, 'Heretics (G. K. Chesterton)', 'Catholic theology'], [65688, 'The Everlasting Man (G. K. Chesterton)', 'Catholic theology'], [63084, 'St. Francis of Assisi (G. K. Chesterton)', 'Catholic theology'],
  [27435, 'The Faith of Our Fathers (Cardinal Gibbons)', 'Catholic theology'], [16772, 'The Story of a Soul (Therese of Lisieux)', 'Spiritual classics'], [52958, 'Revelations of Divine Love (Julian of Norwich)', 'Spiritual classics'], [72411, 'The Glories of Mary (Alphonsus Liguori)', 'Spiritual classics'],
  [20450, 'Lives of the Fathers, Martyrs and Other Principal Saints, January to March (Alban Butler)', 'Saints'], [49604, 'Lives of the Fathers, Martyrs and Other Principal Saints, July (Alban Butler)', 'Saints'],
  [46947, 'The Lives of the Saints, January (Baring-Gould)', 'Saints'], [45604, 'The Lives of the Saints, February (Baring-Gould)', 'Saints'], [48395, 'The Lives of the Saints, March (Baring-Gould)', 'Saints'],
  [2396, 'History of the Catholic Church from the Renaissance to the French Revolution, vol. 1 (MacCaffrey)', 'Church history'], [2455, 'History of the Catholic Church from the Renaissance to the French Revolution, vol. 2 (MacCaffrey)', 'Church history'],
  [7343, 'The Church and the Empire (Medley)', 'Church history'], [22366, 'The Church and the Barbarians (Hutton)', 'Church history'],
  [1722, 'Martin Luther\'s Large Catechism', 'Protestant theology'], [1911, 'Concerning Christian Liberty (Martin Luther)', 'Protestant theology'], [9841, 'Table Talk (Martin Luther)', 'Protestant theology'], [274, 'The Ninety-Five Theses on Indulgences (Martin Luther)', 'Protestant theology'], [1549, 'Commentary on Galatians (Martin Luther)', 'Bible commentary'],
  [275, 'The Augsburg Confession', 'Creeds and confessions'], [6744, 'The Apology of the Augsburg Confession', 'Creeds and confessions'],
  [44035, 'Systematic Theology, vol. 1 (Augustus H. Strong)', 'Protestant theology'], [44555, 'Systematic Theology, vol. 2 (Augustus H. Strong)', 'Protestant theology'], [45283, 'Systematic Theology, vol. 3 (Augustus H. Strong)', 'Protestant theology'],
  /* Other religions' own scriptures, so the Bible Expert can compare and defend the faith. Public-domain translations, ids verified. */
  [2800, 'The Koran (Qur’an), tr. J. M. Rodwell', 'World religions'], [7440, 'The Koran (Qur’an), tr. George Sale', 'World religions'],
  [2388, 'The Bhagavad Gita (The Song Celestial), tr. Edwin Arnold', 'World religions'], [216, 'Tao Te Ching (The Tao Teh King), tr. James Legge', 'World religions'],
  [2017, 'The Dhammapada, tr. Max Müller', 'World religions'], [3283, 'The Upanishads, tr. Max Müller', 'World religions'],
  [4094, 'The Analects of Confucius, tr. James Legge', 'World religions'], [17, 'The Book of Mormon', 'World religions'],
  [53346, 'The Analogy of Religion (Joseph Butler)', 'Apologetics'], [14780, 'A View of the Evidences of Christianity (William Paley)', 'Apologetics'],
  [34632, 'Selected Sermons of Jonathan Edwards', 'Protestant theology'], [131, 'The Pilgrim\'s Progress (John Bunyan)', 'Spiritual classics'], [29622, 'The Book of Common Prayer and the Scottish Liturgy', 'Prayer and liturgy'],
  [34981, 'Orthodox Daily Prayers', 'Prayer and liturgy'], [71513, 'Book of Needs of the Holy Orthodox Church', 'Prayer and liturgy'], [36415, 'Great Lent: A School of Repentance (Alexander Schmemann)', 'Orthodox'],
  [10, 'The King James Version of the Bible', 'Bible'], [124, 'The Apocrypha, King James Version (Deuterocanonical Books)', 'Bible'], [77935, 'The Book of Enoch (R. H. Charles)', 'Bible background'],
  [2848, 'Antiquities of the Jews (Josephus)', 'Bible background'], [2850, 'The Wars of the Jews (Josephus)', 'Bible background'], [2846, 'The Life of Flavius Josephus', 'Bible background'],
];
/* [Internet Archive item, title, group]: the 15 volumes of the Catholic Encyclopedia (1907 to 1914), the Catechism of the Council of Trent and more */
const IA = [
  ...range(1, 15).filter(n => n !== 9).map(n => ['catholicencyclop' + num(n, 2) + 'herbuoft', 'The Catholic Encyclopedia, vol. ' + n + ' (1907 to 1914)', 'Catholic reference']),
  ['07470918.9.emory.edu', 'The Catholic Encyclopedia, vol. 9 (1907 to 1914)', 'Catholic reference', '07470918_9_djvu.txt'],      /* the Toronto scan of volume 9 is withheld by the Archive: this is the Emory scan */
  ['thecatechismofth00donouoft', 'The Catechism of the Council of Trent (Roman Catechism)', 'Catholic theology'],
  ['thecanonsanddecr00unknuoft', 'The Canons and Decrees of the Council of Trent', 'Catholic theology'],
  ['dogmaticcanonsan00unknuoft', 'Dogmatic Canons and Decrees (Trent and the First Vatican Council)', 'Catholic theology'],
  ['catholicdiction00addiuoft', 'A Catholic Dictionary (Addis and Arnold, 1887)', 'Catholic reference'],
  ['bookofsaintsdict00stau', 'The Book of Saints: a dictionary of canonized saints (1921)', 'Saints'],
  /* apologetics and world scriptures that are not on Project Gutenberg */
  ['testimonyofevang0000simo', 'The Testimony of the Evangelists (Simon Greenleaf)', 'Apologetics'],
  ['cu31924101085557', 'The Babylonian Talmud, tr. Michael Rodkinson', 'World religions'],
  ['chaptersofcoming03budg', 'The Egyptian Book of the Dead, tr. E. A. Wallis Budge', 'World religions'],
];
const POPES = ['leo-xiii', 'pius-x', 'benedict-xv', 'pius-xi', 'pius-xii', 'john-xxiii', 'paul-vi', 'john-paul-ii', 'benedict-xvi', 'francesco', 'leo-xiv'];      /* vatican.va files Pope Francis under his Italian name */
const POPE_NAME = s => s === 'francesco' ? 'Francis' : s.split('-').map(w => /^[ivx]+$/.test(w) ? w.toUpperCase() : w[0].toUpperCase() + w.slice(1)).join(' ');
const KINDS = [['encyclicals', 'Encyclicals', 'letters', 'encyclicals'], ['apost_exhortations', 'Apostolic exhortations', 'documents', 'exhortations']];      /* [vatican.va folder, title, unit, file name part] */

/* ---------------- helpers ---------------- */
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function get(url, tries = 3) {
  let last = null;
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': UA, 'Accept': '*/*' }, signal: AbortSignal.timeout(180000), redirect: 'follow' });
      if (r.status === 404) return { status: 404, buf: Buffer.alloc(0) };
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return { status: 200, buf: Buffer.from(await r.arrayBuffer()), type: r.headers.get('content-type') || '' };
    } catch (e) { last = e; await sleep(1500 * (i + 1)); }
  }
  throw last || new Error('failed');
}
const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: '\'', nbsp: ' ', ndash: '-', mdash: ' - ', lsquo: '\'', rsquo: '\'', ldquo: '"', rdquo: '"', hellip: '...', eacute: 'e', egrave: 'e', agrave: 'a', ccedil: 'c', ouml: 'o', uuml: 'u', auml: 'a', iuml: 'i', ecirc: 'e', acirc: 'a', ocirc: 'o', ucirc: 'u', sect: 'section ', para: '', copy: '(c)', deg: ' degrees', laquo: '"', raquo: '"', middot: '.', bull: '*', oelig: 'oe', aelig: 'ae' };
function htmlToText(html) {
  let h = String(html);
  const doc = h.search(/<div[^>]+class="documento"[^>]*>/i); if (doc >= 0) h = h.slice(doc);      // vatican.va: the document itself, without the menus
  h = h.replace(/<!--[\s\S]*?-->/g, ' ').replace(/<(script|style|head|noscript|nav|footer)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<\/(p|div|h[1-6]|li|tr|table|blockquote|center)\s*>/gi, '\n').replace(/<(br|hr)\s*\/?>/gi, '\n').replace(/<(p|h[1-6]|li|tr)\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&#(\d+);/g, (m, n) => { const c = +n; return c === 160 ? ' ' : c < 128 ? String.fromCharCode(c) : String.fromCharCode(c); })
    .replace(/&#x([0-9a-f]+);/gi, (m, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, n) => ENT[n.toLowerCase()] != null ? ENT[n.toLowerCase()] : ' ');
  return h.split('\n').map(l => l.replace(/[ \t ]+/g, ' ').trim()).filter((l, i, a) => l || (a[i - 1] && a[i - 1] !== '')).join('\n').replace(/\n{3,}/g, '\n\n').trim();
}
const titleOfHtml = h => { const m = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(h); return m ? htmlToText(m[1]).replace(/\s+/g, ' ').replace(/\s*[|-]\s*[^|-]*$/, '').trim() : ''; };
const slug = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);

/* CCEL's own header names the volume: "ANF01. The Apostolic Fathers with Justin Martyr and Irenaeus" */
function ccelTitle(body, id) {
  const m = /^\s*Title:\s*(.+)$/mi.exec(body); let t = m ? m[1].trim() : id;
  t = t.replace(/^ANF\s?0?(\d+)\.\s*/i, 'Ante-Nicene Fathers, vol. $1: ').replace(/^NPNF1-?0?(\d+)\.\s*/i, 'Nicene and Post-Nicene Fathers, series 1, vol. $1: ').replace(/^NPNF2-?0?(\d+)\.\s*/i, 'Nicene and Post-Nicene Fathers, series 2, vol. $1: ').replace(/^HCC\s?0?(\d+)\.\s*/i, 'History of the Christian Church, vol. $1: ');
  return t.replace(/\s+/g, ' ').slice(0, 120);
}

/* ---------------- the run ---------------- */
async function run(dataDir, o) {
  o = o || {}; const log = o.log || (() => { }), only = o.only ? new Set(o.only) : null;
  const dir = path.join(dataDir, 'christian-texts'); fs.mkdirSync(dir, { recursive: true });
  const ledgerFile = path.join(dir, '_sources.json'); let ledger = []; try { ledger = JSON.parse(fs.readFileSync(ledgerFile, 'utf8')); } catch (e) { }
  const saveLedger = () => fs.writeFileSync(ledgerFile, JSON.stringify(ledger, null, 1));
  const have = f => { try { return fs.statSync(path.join(dir, f)).size > 2048; } catch (e) { return false; } };
  const out = { added: 0, skipped: 0, failed: [], bytes: 0 };
  async function put(file, title, group, kind, url, body) {
    const head = 'Title: ' + title + '\nSource: ' + url + '\nGroup: ' + group + '\nRights: ' + RIGHTS[kind] + '\n\n';
    fs.writeFileSync(path.join(dir, file), head + body); out.added++; out.bytes += body.length;
    ledger = ledger.filter(x => x.file !== file); ledger.push({ file, title, group, url, rights: RIGHTS[kind], bytes: body.length, when: new Date().toISOString().slice(0, 10) }); saveLedger();
    log('  ok   ' + (body.length / 1048576).toFixed(1).padStart(5) + ' MB  ' + title);
  }
  const want = g => !only || only.has(g);
  const fail = (what, e) => { out.failed.push(what + ': ' + (e && e.message || e)); log('  FAIL ' + what + ' (' + (e && e.message || e) + ')'); };

  if (want('ccel')) for (const [id, group] of CCEL) {
    const file = 'ccel-' + id.replace('/', '-') + '.txt'; if (have(file)) { out.skipped++; continue; }
    try { const url = 'https://ccel.org/ccel/' + id + '/cache/' + id.split('/')[1] + '.txt', r = await get(url); if (r.status !== 200 || r.buf.length < 20000 || /^\s*<!DOCTYPE/i.test(r.buf.slice(0, 80).toString())) { fail(id, 'not available'); continue; } const body = r.buf.toString('utf8'); await put(file, ccelTitle(body, id), group, 'ccel', 'https://ccel.org/ccel/' + id, body); } catch (e) { fail(id, e); }
    await sleep(500);
  }
  if (want('pg')) for (const [n, title, group] of PG) {
    const file = 'pg-' + n + '.txt'; if (have(file)) { out.skipped++; continue; }
    try { let r = await get('https://www.gutenberg.org/cache/epub/' + n + '/pg' + n + '.txt'); if (r.status !== 200) r = await get('https://www.gutenberg.org/files/' + n + '/' + n + '-0.txt'); if (r.status !== 200 || r.buf.length < 8000) { fail('PG ' + n, 'not available'); continue; } await put(file, title, group, 'pg', 'https://www.gutenberg.org/ebooks/' + n, r.buf.toString('utf8')); } catch (e) { fail('PG ' + n, e); }
    await sleep(700);
  }
  if (want('ia')) for (const [id, title, group, fname] of IA) {
    const file = 'ia-' + id + '.txt'; if (have(file)) { out.skipped++; continue; }
    try { const r = await get('https://archive.org/download/' + id + '/' + (fname || id + '_djvu.txt')); if (r.status !== 200 || r.buf.length < 100000) { fail('IA ' + id, 'not available'); continue; } await put(file, title, group, 'ia', 'https://archive.org/details/' + id, r.buf.toString('utf8')); } catch (e) { fail('IA ' + id, e); }
    await sleep(800);
  }
  if (want('vatican')) {
    /* the Catechism of the Catholic Church: the numbered paragraphs, page by page (IntraText, Latin-1) */
    const file = 'vatican-catechism-of-the-catholic-church.txt';
    if (have(file)) out.skipped++; else try {
      const base = 'https://www.vatican.va/archive/ENG0015/', ix = await get(base + '_INDEX.HTM'), ixh = ix.buf.toString('latin1');
      const pages = [...new Set([...ixh.matchAll(/HREF=["']?(_[A-Z0-9_]+\.HTM)/gi)].map(m => m[1]))].filter(p => !/^_INDEX/i.test(p)); let body = '', n = 0;
      for (const p of pages) { const r = await get(base + p); if (r.status !== 200) continue; const t = htmlToText(r.buf.toString('latin1')); if (t.length > 40) { body += '\n' + t + '\n'; n++; } await sleep(250); }
      if (body.length < 500000) fail('Catechism of the Catholic Church', 'only ' + n + ' pages'); else await put(file, 'Catechism of the Catholic Church', 'Catholic theology', 'vatican', base + '_INDEX.HTM', body);
    } catch (e) { fail('Catechism of the Catholic Church', e); }
    /* the sixteen documents of the Second Vatican Council */
    const f2 = 'vatican-second-vatican-council.txt';
    if (have(f2)) out.skipped++; else try {
      const base = 'https://www.vatican.va/archive/hist_councils/ii_vatican_council/', ix = await get(base + 'index.htm'), ixh = ix.buf.toString('utf8');
      const links = [...new Set([...ixh.matchAll(/href="(documents\/vat-ii_[^"]+_en\.html)"/gi)].map(m => m[1]))]; let body = '', n = 0;
      for (const l of links) { const r = await get(base + l); if (r.status !== 200) continue; const h = r.buf.toString('utf8'), t = htmlToText(h); if (t.length > 2000) { body += '\nPART: ' + (titleOfHtml(h) || l).slice(0, 60) + '\n\n' + t + '\n'; n++; } await sleep(300); }
      if (n < 12) fail('Second Vatican Council', 'only ' + n + ' documents'); else await put(f2, 'Documents of the Second Vatican Council', 'Catholic theology', 'vatican', base + 'index.htm', body);
    } catch (e) { fail('Second Vatican Council', e); }
    /* the encyclicals of each pope, one file per pope */
    for (const [dirName, label, unit, part] of KINDS) for (const pope of POPES) {
      const f = 'vatican-' + part + '-' + pope + '.txt', what = label + ' of ' + POPE_NAME(pope); if (have(f)) { out.skipped++; continue; }
      try {
        const idx = 'https://www.vatican.va/content/' + pope + '/en/' + dirName + '.index.html', ix = await get(idx);
        const ixh = ix.status === 200 ? ix.buf.toString('utf8') : '', re = new RegExp('href="(/content/[^"]*/en/' + dirName + '/documents/[^"#?]+[.]html)"', 'gi');
        const links = [...new Set([...ixh.matchAll(re)].map(m => m[1]))];
        if (!links.length) { if (dirName === 'encyclicals') fail(what, 'no list found'); continue; }
        let body = '', n = 0;
        for (const l of links) { const r = await get('https://www.vatican.va' + l); if (r.status !== 200) continue; const h = r.buf.toString('utf8'), t = htmlToText(h); if (t.length > 3000) { body += '\nPART: ' + (titleOfHtml(h) || l.split('/').pop()).slice(0, 60) + '\n\n' + t + '\n'; n++; } await sleep(250); }
        if (n) await put(f, what + ' (' + n + ' ' + unit + ')', 'Papal teaching', 'vatican', idx, body); else fail(what, 'nothing read');
      } catch (e) { fail(what, e); }
    }
  }
  return out;
}

module.exports = { run, htmlToText, SOURCES: { CCEL, PG, IA, POPES } };
if (require.main === module) {
  const data = process.argv[2] || path.join(__dirname, '..', 'data');
  run(data, { log: s => console.log(s), only: process.argv[3] ? process.argv[3].split(',') : null }).then(r => { console.log('\nAdded ' + r.added + ', already there ' + r.skipped + ', failed ' + r.failed.length + ', ' + (r.bytes / 1048576).toFixed(0) + ' MB of new text.'); r.failed.forEach(f => console.log('  failed: ' + f)); }).catch(e => { console.error(e); process.exit(1); });
}

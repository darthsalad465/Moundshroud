// Offline libraries (Kiwix): serves every .zim in nomad\library, searches across them, and picks sensible ones per question.
const http = require('http'), fs = require('fs'), path = require('path'), cp = require('child_process');
const U = require('./util');

const ROOT = path.join(__dirname, '..'), NOMAD = path.join(ROOT, 'nomad');
const KEXE = path.join(NOMAD, 'kiwix-tools', 'kiwix-serve.exe'), LIBDIR = process.env.MOUNDSHROUD_LIBDIR || process.env.ATLAS_LIBDIR || path.join(NOMAD, 'library'), PORT = +process.env.MOUNDSHROUD_KIWIX_PORT || +process.env.ATLAS_KIWIX_PORT || 47232;
let proc = null, starting = null;

const META = [
  [/^wikipedia_/, 'Wikipedia', 'Wikipedia'],
  [/^wiktionary_/, 'Dictionary', 'Dictionary (Wiktionary)'],
  [/^mdwiki_/, 'Medical', 'MDWiki (medical encyclopedia)'],
  [/^wikem_/, 'Medical', 'WikEM (emergency medicine)'],
  [/^unix\.stackexchange/, 'Tech help', 'Unix & Linux Q&A'],
  [/^superuser\.com/, 'Tech help', 'Super User Q&A'],
  [/^archlinux_/, 'Tech help', 'Arch Linux wiki'],
  [/^cooking\.stackexchange/, 'Cooking & DIY', 'Cooking Q&A'],
  [/^diy\.stackexchange/, 'Cooking & DIY', 'DIY & home repair Q&A'],
  [/^zimgit-medicine/, 'Medical', 'Field medicine guides'],
  [/^zimgit-post-disaster/, 'Survival & prep', 'Post-disaster rebuilding'],
  [/^zimgit-water/, 'Survival & prep', 'Water purification'],
  [/^zimgit-food-preparation/, 'Survival & prep', 'Food preparation'],
  [/^zimgit-knots/, 'Survival & prep', 'Knots'],
  [/^appropedia_/, 'Survival & prep', 'Appropedia (low-tech solutions)'],
  [/^trueprepper/, 'Survival & prep', 'TruePrepper'],
  [/^outdoors\.stackexchange/, 'Survival & prep', 'Outdoors Q&A'],
  [/^gardening\.stackexchange/, 'Survival & prep', 'Gardening Q&A'],
  [/^ham\.stackexchange/, 'Tech help', 'Ham radio Q&A'],
  [/^electronics\.stackexchange/, 'Tech help', 'Electronics Q&A'],
  [/^ifixit_/, 'Tech help', 'iFixit repair guides'],
  [/^mechanics\.stackexchange/, 'Cooking & DIY', 'Car repair Q&A'],
  [/^gutenberg_en_lcc-r/, 'Books', 'Gutenberg: Medicine'],
  [/^gutenberg_en_lcc-s/, 'Books', 'Gutenberg: Agriculture, hunting, fishing'],
  [/^gutenberg_en_lcc-t/, 'Books', 'Gutenberg: Technology'],
  [/^gutenberg_en_lcc-u/, 'Books', 'Gutenberg: Military science'],
  [/^gutenberg_en_lcc-v/, 'Books', 'Gutenberg: Naval science'],
  [/^gutenberg_en_lcc-g/, 'Books', 'Gutenberg: Geography and recreation'],
  [/^gutenberg_en_lcc-p$/, 'Literature', 'Gutenberg: Literature (general)'],
  [/^gutenberg_en_lcc-pg/, 'Literature', 'Gutenberg: Russian literature'],
  [/^gutenberg_en_lcc-pt/, 'Literature', 'Gutenberg: German literature'],
  [/^gutenberg_en_lcc-pa/, 'Literature', 'Gutenberg: Greek and Latin classics'],
  [/^gutenberg_en_lcc-pq/, 'Literature', 'Gutenberg: French, Italian, Spanish literature'],
  [/^gutenberg_en_lcc-pn/, 'Literature', 'Gutenberg: Poetry, drama, story collections'],
  [/^gutenberg_en_lcc-pr/, 'Literature', 'Gutenberg: English literature'],
  [/^gutenberg_en_lcc-ps/, 'Literature', 'Gutenberg: American literature'],
  [/^gutenberg_en_lcc-pz/, 'Literature', 'Gutenberg: Fiction and juvenile'],
  [/^gutenberg_/, 'Books', 'Project Gutenberg'],
  [/^wikivoyage_/, 'Travel', 'Wikivoyage (travel guides)'],
  [/^wikibooks_/, 'Books', 'Wikibooks'],
  [/^wikiquote_/, 'Quotes', 'Wikiquote'],
  [/^wikiversity_/, 'Books', 'Wikiversity (courses)'],
  [/^freecodecamp_/, 'Tech help', 'freeCodeCamp'],
  [/^devdocs_en_/, 'Tech help', 'Developer docs'],
  [/^wikisource_/, 'Books', 'Wikisource'],
];
const bookName = f => f.replace(/\.zim$/i, '').replace(/_\d{4}-\d{2}$/, '');
const SE_TITLES = { security: 'Information Security Q&A', crypto: 'Cryptography Q&A', networkengineering: 'Network Engineering Q&A', reverseengineering: 'Reverse Engineering Q&A', 'serverfault.com': 'Server Fault (sysadmin) Q&A', softwareengineering: 'Software Engineering Q&A', cs: 'Computer Science Q&A', datascience: 'Data Science Q&A', webmasters: 'Webmasters Q&A', raspberrypi: 'Raspberry Pi Q&A', arduino: 'Arduino Q&A', engineering: 'Engineering Q&A', history: 'History Q&A', law: 'Law Q&A', money: 'Personal Finance Q&A', travel: 'Travel Q&A', fitness: 'Fitness Q&A', biology: 'Biology Q&A', chemistry: 'Chemistry Q&A', astronomy: 'Astronomy Q&A', space: 'Space Exploration Q&A', earthscience: 'Earth Science Q&A', philosophy: 'Philosophy Q&A', economics: 'Economics Q&A', skeptics: 'Skeptics Q&A', academia: 'Academia Q&A', workplace: 'Workplace Q&A', linguistics: 'Linguistics Q&A', lifehacks: 'Life Hacks Q&A', interpersonal: 'Interpersonal Skills Q&A', parenting: 'Parenting Q&A', pets: 'Pets Q&A', politics: 'Politics Q&A', 'askubuntu.com': 'Ask Ubuntu Q&A' };
const WP_TITLES = { all_mini: 'Wikipedia (every article, intro)', top_nopic: 'Wikipedia (top articles)', history_nopic: 'Wikipedia: History', geography_nopic: 'Wikipedia: Geography', mathematics_nopic: 'Wikipedia: Mathematics', physics_nopic: 'Wikipedia: Physics', chemistry_nopic: 'Wikipedia: Chemistry', astronomy_nopic: 'Wikipedia: Astronomy', computer_nopic: 'Wikipedia: Computing', 'climate-change_nopic': 'Wikipedia: Climate change', molcell_nopic: 'Wikipedia: Biology', medicine_nopic: 'Wikipedia: Medicine' };
function books() {
  let fl = []; try { fl = fs.readdirSync(LIBDIR).filter(f => /\.zim$/i.test(f)); } catch (e) {}
  return fl.map(f => {
    const name = bookName(f), m = META.find(x => x[0].test(name)), size = fs.statSync(path.join(LIBDIR, f)).size;
    let title = m ? m[2] : name; { const se = /^([\w.]+?)(?:\.stackexchange\.com)?_en_all/.exec(name); if (!m && se && SE_TITLES[se[1]]) title = SE_TITLES[se[1]]; const wp = /^wikipedia_en_(.+)$/.exec(name); if (wp && WP_TITLES[wp[1]]) title = WP_TITLES[wp[1]]; const dd = /^devdocs_en_(.+)$/.exec(name); if (dd) title = 'Docs: ' + dd[1]; }
    if (m && m[1] === 'Wikipedia' && !/^wikipedia_en_(\w|-)+_(nopic|mini)$/.test(name)) title = /top_nopic/.test(name) ? 'Wikipedia (top articles)' : /all_nopic/.test(name) ? 'Wikipedia (full text)' : /mini/.test(name) ? 'Wikipedia (intros)' : 'Wikipedia';
    const cat = m ? m[1] : /stackexchange|askubuntu|serverfault/.test(name) ? 'Tech help' : 'Other';
    return { name, file: f, sizeMB: Math.round(size / 1048576), category: cat, title, group: groupOf(name, cat) };
  }).sort((a, b) => (a.category === 'Wikipedia' ? -1 : 0) - (b.category === 'Wikipedia' ? -1 : 0) || b.sizeMB - a.sizeMB);
}
/* which kind of source a book is (the Search tab filters on this) */
function groupOf(name, cat) { if (/^wikipedia_/.test(name)) return 'wiki'; if (/^wiktionary_/.test(name)) return 'dict'; if (/^(mdwiki|wikem|zimgit-medicine)/.test(name)) return 'medical'; if (/stackexchange|^superuser\.com|^askubuntu|^serverfault|^stackoverflow/.test(name)) return 'qa'; if (/^gutenberg_/.test(name)) return 'books'; if (/^(zimgit|appropedia|trueprepper|ifixit)/.test(name) || cat === 'Survival & prep') return 'survival'; return 'ref'; }
const available = () => fs.existsSync(KEXE) && books().length > 0;

function up(cb) {
  const r = http.get({ host: '127.0.0.1', port: PORT, path: '/wiki/catalog/v2/root.xml', timeout: 1500 }, res => { res.resume(); cb(res.statusCode === 200); });
  r.on('error', () => cb(false)); r.on('timeout', () => { r.destroy(); cb(false); });
}
function ensure(cb) {
  const bl = books();
  if (!bl.length || !fs.existsSync(KEXE)) return cb(false);
  up(isUp => {
    if (isUp) return cb(true);
    if (!starting) {
      starting = new Promise(resolve => {
        const args = ['--address=127.0.0.1', '--port=' + PORT, '--urlRootLocation=/wiki', '--nodatealiases', '--nolibrarybutton', '--nosearchbar', '--blockexternal',
          '--threads=4', '--attachToProcess=' + process.pid, ...bl.map(b => path.join(LIBDIR, b.file))];
        try { proc = cp.spawn(KEXE, args, { stdio: 'ignore', windowsHide: true }); proc.on('exit', () => { proc = null; }); } catch (e) { return resolve(false); }
        let n = 0; const t = setInterval(() => up(u => { if (u || ++n > 120) { clearInterval(t); resolve(u); } }), 250);
      }).finally(() => { starting = null; });
    }
    starting.then(cb);
  });
}
const ensureP = () => new Promise(r => ensure(r));
function stop() { if (proc && proc.pid) { try { cp.spawnSync('taskkill', ['/PID', String(proc.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true }); } catch (e) {} proc = null; } }

function get(p) {
  return new Promise((resolve, reject) => {
    const r = http.get({ host: '127.0.0.1', port: PORT, path: p, timeout: 25000 }, res => { const ch = []; res.on('data', c => ch.push(c)); res.on('end', () => resolve(Buffer.concat(ch).toString('utf8'))); });
    r.on('error', reject); r.on('timeout', () => { r.destroy(); reject(new Error('timeout')); });
  });
}
async function search(book, q, n) {
  const xml = await get('/wiki/search?content=' + encodeURIComponent(book) + '&pattern=' + encodeURIComponent(q) + '&pageLength=' + n + '&format=xml');
  const items = [], re = /<item>([\s\S]*?)<\/item>/g; let m;
  while ((m = re.exec(xml))) {
    const t = (m[1].match(/<title>([\s\S]*?)<\/title>/) || [])[1], l = (m[1].match(/<link>([\s\S]*?)<\/link>/) || [])[1];
    if (t && l) items.push({ title: U.ent(t), link: U.ent(l) });
  }
  return items;
}
/* one query across many books at once (kiwix merges the rankings); returns snippets and which book each hit came from */
async function searchMulti(q, names, n) {
  if (!names.length) return [];
  const xml = await get('/wiki/search?' + names.map(x => 'books.name=' + encodeURIComponent(x)).join('&') + '&pattern=' + encodeURIComponent(q) + '&pageLength=' + n + '&format=xml');
  const bl = books(), items = [], re = /<item>([\s\S]*?)<\/item>/g; let m;
  while ((m = re.exec(xml))) {
    const it = m[1], title = (it.match(/<title>([\s\S]*?)<\/title>/) || [])[1], link = (it.match(/<link>([\s\S]*?)<\/link>/) || [])[1]; if (!title || !link) continue;
    const desc = (it.match(/<description>([\s\S]*?)<\/description>/) || [])[1] || '', words = +(((it.match(/<wordCount>([\d,]+)<\/wordCount>/) || [])[1] || '0').replace(/,/g, ''));
    const file = (link.split('/')[3] || ''), b = bl.find(x => x.file.replace(/\.zim$/i, '') === file);
    const snippet = U.ent(U.ent(desc)).replace(/<(?!\/?b>)[^>]*>/g, '').replace(/\s+/g, ' ').trim();
    items.push({ title: U.ent(title), link: U.ent(link), snippet, words, book: b ? b.name : file, bookTitle: b ? b.title : file, group: b ? b.group : 'ref', cat: b ? b.category : '' });
  }
  return items;
}
async function text(link, max) {
  const html = await get(link.startsWith('/wiki/') ? link : '/wiki/' + link.replace(/^\//, ''));
  const t = U.htmlToText(html);
  return t.length > max ? t.slice(0, max) : t;
}
async function suggest(book, term) { try { return JSON.parse(await get('/wiki/suggest?content=' + encodeURIComponent(book) + '&term=' + encodeURIComponent(term))); } catch (e) { return []; } }

/* dictionary questions: look the bare word up by title instead of full-text searching the sentence */
const dictTerm = q => q.replace(/^\s*(please\s+)?(what('s| is) the )?(define|definition of|meaning of|synonyms? (for|of)|etymology of|pronounce|how do you spell)\s+/i, '').replace(/^what does\s+/i, '').replace(/\s+mean\??\s*$/i, '').replace(/["?]/g, '').trim();
async function dictItems(bookName, q, n) {
  const term = dictTerm(q).slice(0, 80), s = await suggest(bookName, term);
  const dec = x => U.ent(String(x || ''));
  const items = (s || []).filter(x => x.path).map(x => ({ title: dec(x.value || x.label), link: '/wiki/content/' + bookName + '/' + x.path }));
  items.sort((a, b) => (b.title.toLowerCase() === term.toLowerCase()) - (a.title.toLowerCase() === term.toLowerCase()));
  return items.slice(0, n);
}

/* which libraries to ask for a given question */
const RX = {
  Medical: /\b(symptom|disease|medic|drug|dose|dosage|pain|fever|infect|wound|bleed|burn|cpr|chok|allerg|anaphyla|poison|overdose|fractur|stroke|heart attack|diabet|blood pressure|first aid|emergency|injur|rash|vomit|asthma|antibiotic|vaccin|pregnan|cancer|nausea|headache|sprain|hypotherm|dehydrat|diagnos|syndrome|disorder|therap|surger|clinical|chronic|hospital|doctor|ibuprofen|paracetamol|acetaminophen|aspirin|insulin|seizure|concussion|migraine|treat(ment|ing)? (a|an|for|the)\b)/i,
  'Tech help': /\b(linux|ubuntu|windows|bash|shell|terminal|command|script|install|driver|kernel|ssh|python|server|network|wifi|router|registry|powershell|computer|software|bug|error|usb|bios|arch|boot|disk|partition|permission|firewall|dns|git|radio|antenna|ham|frequency|transceiver|battery|circuit|voltage|solder)\b/i,
  'Cooking & DIY': /\b(cook|recipe|bake|boil|fry|oven|ingredient|meal|dough|sauce|season|marinad|repair|plumb|wiring|paint|drywall|tile|leak|drill|saw|screw|carpent|diy|garden|furnace|outlet|breaker|caulk|grout|roast|simmer|knead|engine|brake|alternator|transmission|spark plug|oil change|jump.?start|tire|starter motor|car\b|vehicle|truck|dead battery|won'?t start|will not start)/i,
  'Survival & prep': /\b(blackout|power (outage|cut|failure|out)|(power|electricity|water|heat|internet)\W+(has\W+|have\W+|is\W+|was\W+|went\W+|been\W+)*(out|off|down|cut)|without (power|electricity|water|heat|internet)|no (power|electricity|running water|heat|internet)|drinking water|safe to drink|stored (food|water)|long.?term (food|storage)|when the (grid|power|internet)|disaster|surviv|storm|hurricane|tornado|flood|earthquake|wildfire|evacuat|purif|boil(ing)? water|water (source|storage|filter|safe)|generator|shelter|frostbite|heat ?stroke|prepper|bug.?out|go.?bag|grid.?down|off.?grid|signal (fire|mirror)|compass|navigat|knot|forag|canning|preserv(e|ing)|ferment|root cellar|solar (panel|power|oven)|lost in the|campfire|fire.?start|tourniquet|rationing|stockpil|prepared(ness)?)/i,
  Literature: /\b(novel|poem|poetry|poet|short stor(y|ies)|fairy tale|folk ?tale|author|wrote|written by|playwright|tragedy|sonnet|epic|shakespeare|dickens|austen|tolstoy|dostoevsk\w*|chekhov|poe|twain|melville|hawthorne|homer|odyssey|iliad|dante|cervantes|hugo|dumas|kafka|goethe|wilde|bronte|doyle|sherlock|hamlet|macbeth|literature|classic (book|novel|literature)|gutenberg)\b/i,
  Dictionary: /(^|\s)(define|definition of|meaning of|what does .{1,40} mean|synonym|etymology|pronounce|how do you spell|word for)\b/i,
};
function pickCategories(q) { if (/^\s*(please\s+)?(define|definition of|meaning of|what does .{1,40} mean)\b/i.test(q)) return ['Dictionary']; const c = ['Wikipedia']; for (const k of Object.keys(RX)) if (RX[k].test(q)) c.push(k); return c; }
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/* full sentences search badly; reduce a question to its key words (keeps order, drops filler) */
const STOPQ = new Set('the a an and or of to in on for with how what when where why who which should would could shall may might must my our we i you your us me is are was were be been being has have had do does did can will about from this that these those there then than if so it its at by as tell please explain give show need want know get make take over under into out up down very just also any all some more most much many two three four five six seven eight nine ten days day week weeks'.split(' '));
const keywords = q => { const t = (q.toLowerCase().match(/[\p{L}\p{N}]+/gu) || []).filter(w => w.length > 2 && !STOPQ.has(w)); const u = [...new Set(t)].slice(0, 8); return u.length >= 2 ? u.join(' ') : q.slice(0, 300); };
async function context(q, nTotal = 4, only) {
  if (!(await ensureP())) return [];
  const bl = books(), cats = only && only.length ? only : pickCategories(q), plan = [];
  for (const c of cats) { const b = bl.filter(x => x.category === c); if (b.length) plan.push({ cat: c, books: b.slice(0, c === 'Survival & prep' ? 5 : c === 'Medical' ? 3 : c === 'Literature' ? 4 : 2) }); }
  const found = [], kq = keywords(q), surv = cats.includes('Survival & prep') && plan.some(p => p.cat === 'Survival & prep');
  await Promise.all(plan.map(async p => {
    const per = p.cat === 'Wikipedia' ? 3 : p.cat === 'Survival & prep' ? 1 : 2;
    for (const b of p.books) { try { const items = p.cat === 'Dictionary' ? await dictItems(b.name, q, per) : await search(b.name, kq, per); items.slice(0, per).forEach((it, i) => found.push({ ...it, book: b.name, cat: p.cat, bookTitle: b.title, rank: i + (p.cat === 'Wikipedia' ? (surv ? 1.2 : 0) : 0.5) })); } catch (e) {} }
  }));
  found.sort((a, b) => a.rank - b.rank);
  const pick = []; const seen = new Set();
  for (const f of found) { if (seen.has(f.link)) continue; seen.add(f.link); pick.push(f); if (pick.length >= nTotal) break; }
  const out = [];
  await Promise.all(pick.map(async it => { try { let t = await text(it.link, 2600); t = t.replace(new RegExp('^' + esc(it.title) + '\\s*', 'i'), ''); out.push({ title: it.title, url: it.link, book: it.bookTitle, category: it.cat, text: t.slice(0, 1800), rank: it.rank }); } catch (e) {} }));
  out.sort((a, b) => a.rank - b.rank);
  return out;
}

/* Classics catalogue: every book in the Literature collections (title, author, id, cover). Read from each Gutenberg ZIM's own index, cached on disk. */
const CLS = path.join(ROOT, 'data', 'classics-index.json');
async function classics(fetcher) {
  const bl = books().filter(b => b.category === 'Literature'), sig = bl.map(b => b.file + ':' + b.sizeMB).join('|');
  const cached = U.readJson(CLS, null); if (cached && cached.sig === sig && cached.items && cached.items.length) return cached;
  if (!bl.length) return { sig, shelves: [], items: [] };
  if (!fetcher && !(await ensureP())) return { sig, shelves: [], items: [] };
  const g = fetcher || get, items = [], seen = new Set(), shelves = []; let failed = 0;
  for (const b of bl) {
    const shelf = b.title.replace(/^Gutenberg:\s*/, ''); let n = 0;
    try {
      const txt = await g('/wiki/content/' + b.name + '/full_by_title.js'), m = txt.match(/json_data\s*=\s*(\[[\s\S]*\])\s*;?/); if (!m) throw new Error('no index');
      const rows = JSON.parse(m[1]), rank = {};
      try { const pm = (await g('/wiki/content/' + b.name + '/full_by_popularity.js')).match(/json_data\s*=\s*(\[[\s\S]*\])\s*;?/); if (pm) { const pr = JSON.parse(pm[1]); pr.forEach((r, i) => { rank[r[3]] = Math.round(i / pr.length * 1000) / 1000; }); } } catch (e) {}
      for (const r of rows) { const id = r[3]; if (seen.has(id)) continue; seen.add(id); n++; items.push({ t: String(r[0]), a: String(r[1] || ''), id, f: String(r[2] || ''), b: b.name, s: shelf, r: rank[id] === undefined ? 1 : rank[id] }); }
    } catch (e) { failed++; }
    if (n) shelves.push({ name: shelf, n });
  }
  const out = { sig, shelves, items };
  if (!failed && items.length) { try { U.writeJson(CLS, out); } catch (e) {} }
  return out;
}

module.exports = { searchMulti, keywords, get, groupOf, bookName, dictItems, books, available, ensure, ensureP, stop, search, text, suggest, context, pickCategories, classics, PORT, up };

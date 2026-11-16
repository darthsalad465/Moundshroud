// Search tab back end: one question across every offline library (Wikipedia, Q&A sites, references, medical, survival, dictionary, books),
// ranked by what the question looks like, with snippets, a knowledge-panel card and passages for the AI to answer from.
const kiwix = require('./kiwix'), U = require('./util');

const GROUPS = ['wiki', 'qa', 'ref', 'medical', 'survival', 'dict', 'books'];
const NAMES = { wiki: 'Encyclopedia', qa: 'Q&A', ref: 'Guides & reference', medical: 'Medical', survival: 'Survival & prep', dict: 'Dictionary', books: 'Books' };
const race = (p, ms) => Promise.race([p, new Promise((_, rj) => setTimeout(() => rj(new Error('slow')), ms))]);
const norm = s => String(s || '').toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();

/* what kind of question is it? (gives each source type a weight; sources that do not fit the question are kept small) */
const TECH = /\b(error|exception|fix|install|configure|setup|set up|command|script|not working|doesn'?t work|won'?t (start|boot|work)|permission|bug|crash|stack ?trace|syntax|compile|regex|query|code|coding|password|hack|exploit|vulnerab|encrypt|decrypt|cipher|hash|firewall|vpn|router|wifi|bios|driver|windows|linux|ubuntu|debian|python|javascript|java|html|css|sql|git|docker|api|server|network|database|terminal|bash|powershell|chmod|ssh|ssl|tls|dns|ip address|port|malware|phishing|cyber|software|app|programming|function|variable|array|loop)\b/i;
function intent(q) {
  const w = { wiki: 1, qa: .8, ref: .9, medical: .35, survival: .4, dict: .5, books: .3 }, t = q.toLowerCase();
  if (TECH.test(t)) { w.qa = 1.7; w.wiki = .85; w.ref = 1.1; }
  if (/\b(how (do|does|did|are|is) .{2,60}(work|form|happen|occur|start|begin|get made|made|come about)|who (is|was|were|invented|discovered|wrote|founded)|what (is|was|are|were)|when (did|was|is)|where (is|was|are)|history of|capital of|population of|biography|born|died|invented|discovered|meaning of|explain|why (do|does|is|are|did)|difference between|compare)\b/.test(t) && !TECH.test(t)) { w.wiki = 1.6; w.qa = .65; }
  if (/\b(symptom|disease|medic|drug|dose|pain|fever|infect|wound|bleed|burn|allerg|poison|fractur|stroke|diabet|blood pressure|first aid|cancer|nausea|headache|treatment|syndrome|disorder|vaccin|antibiotic|pregnan|anxiety|depress|injur|rash|virus|bacteria)/.test(t)) { w.medical = 1.9; w.wiki = 1.1; w.qa = .6; }
  if (/\b(visit|travel|trip|itinerary|things to do|where to stay|tourist|flight|visa|best time to)\b/.test(t)) { w.ref = 1.7; w.qa = 1.0; }
  if (/\b(blackout|power (outage|cut)|disaster|surviv|storm|flood|earthquake|evacuat|purif|generator|shelter|prepper|go.?bag|off.?grid|canning|forag|fire.?start|water (filter|storage)|stockpil)/.test(t)) { w.survival = 1.8; }
  if (/\b(define|definition of|synonym|antonym|etymology|pronounc|what does .{1,30} mean|word for)\b/.test(t)) { w.dict = 2; w.wiki = .7; }
  if (/\b(novel|poem|poet|short story|author|wrote|chapter|quote|shakespeare|dickens|tolstoy|austen|twain|poe|literature)\b/.test(t)) { w.books = 1.4; w.ref = 1.1; }
  if (/\b(recipe|cook|bake|garden|plant|repair|plumb|wiring|paint|engine|brake|car\b)/.test(t)) { w.qa = 1.5; }
  return w;
}
const stem = w => w.length > 3 ? (w.endsWith('ies') ? w.slice(0, -3) + 'y' : w.endsWith('ss') ? w : w.endsWith('s') ? w.slice(0, -1) : w) : w;
const toks = s => norm(s).split(' ').filter(w => w.length > 1).map(stem);
const JUNK_T = /^(portal|wikipedia|category|template|help|draft|user|talk|file|module|mediawiki):/i;
const JUNK = /(^|\/)(questions\/tagged|tags|users|unanswered)(\/|$)|_page=\d|^questions\/tagged/i;
const stripLead = q => q.replace(/^\s*(please\s+)?(what('s| is| are| was| were)( an?| the)?|who('s| is| was| were)( an?| the)?|tell me about|explain|define|how does|how do|how did|why does|why do|why is|when did|where is|history of)\s+/i, '').replace(/[?!.]+$/, '').trim();

/* the thing the question is about ("who was napoleon" -> Napoleon, "difference between a virus and a bacterium" -> virus, bacterium) */
function entities(q) {
  const base = stripLead(q).replace(/^(best|top|good|cheap|famous)\s+/i, ''), c = new Set([base]); let m;
  if ((m = /(?:things to do|to do|to see|visit(?:ing)?|travel(?:l?ing)? to|trip to|holiday in|vacation in|weather in|attractions in|what to see in|guide to|where to stay in|best time to visit)\s+(?:in|to|at)?\s*(.+)$/i.exec(base)) || (m = /\b(?:history|capital|population|biography|culture|geography|economy|climate|flag|language|president|origin|etymology|meaning)\s+(?:of|in)\s+(.+)$/i.exec(base))) c.add(m[1].replace(/^(in|of|about|on|for|to|at)\s+/i, ''));
  base.replace(/^difference between\s+/i, '').replace(/\s+compared to\s+/i, ' vs ').split(/\s+(?:and|vs\.?|versus|or|between)\s+/i).forEach(x => c.add(x));
  return [...c].map(x => x.replace(/^(a|an|the)\s+/i, '').replace(/[?!.,]+$/g, '').replace(/\s+(works?|working|forms?|happens?|means?|do|does|is|are|made|invented|discovered|born|die|died)$/i, '').trim()).filter(x => x.length > 1 && x.split(' ').length <= 5).slice(0, 4);
}
async function entityHits(q, by, iw) {
  const ents = entities(q), books = [...(by.wiki || []).filter(b => /all_mini|top_nopic/.test(b.name)).slice(0, 2), ...((iw.ref || 0) >= 1.2 ? (by.ref || []).filter(b => /wikivoyage/.test(b.name)) : [])], out = [];
  await Promise.all(ents.flatMap(e => books.map(async b => { try { const r = await race(kiwix.suggest(b.name, e), 2500); (r || []).slice(0, 4).forEach((x, i) => { const title = U.ent(String(x.value || x.label || '').replace(/<[^>]+>/g, '')); if (!x.path || !title || JUNK_T.test(title) || /[a-z][A-Z]/.test(title) || (title.length > 4 && title === title.toUpperCase())) return; const same = norm(title) === norm(e) || norm(title) === norm(e).replace(/s$/, '') || norm(title).replace(/s$/, '') === norm(e); if (same || (i === 0 && norm(title).startsWith(norm(e)) && title.length < e.length + 14)) out.push({ title, link: '/wiki/content/' + b.file.replace(/\.zim$/i, '') + '/' + x.path, snippet: '', words: 6000, book: b.name, bookTitle: b.title, group: b.group, cat: b.category, rank: 0, ent: true, same }); }); } catch (e) { } })));
  return out;
}
async function search(q, o = {}) {
  q = String(q || '').trim(); const t0 = Date.now(); if (!q) return { items: [], counts: {}, took: 0 };
  if (!(await kiwix.ensureP())) return { items: [], counts: {}, took: 0, error: 'Offline libraries are not available.' };
  const bl = kiwix.books(), by = {}; bl.forEach(b => (by[b.group] = by[b.group] || []).push(b));
  const scope = GROUPS.includes(o.scope) ? o.scope : 'all', iw = intent(q), kq = kiwix.keywords(q), lit = iw.books > 1;
  const plan = scope === 'all' ? GROUPS.filter(g => g !== 'books' || lit) : [scope], per = scope === 'all' ? 8 : 25;
  const lists = await Promise.all(plan.map(async g => {
    const names = (by[g] || []).map(b => b.name); if (!names.length) return [];
    try { const items = g === 'dict' ? await race(dictList(by.dict, q, 4), 4000) : await race(kiwix.searchMulti(kq, names, per), 9000); return items.map((it, i) => ({ ...it, group: g, rank: i })); } catch (e) { return []; }
  }));
  let ent = []; if (scope === 'all' || scope === 'wiki' || scope === 'ref') ent = await entityHits(q, by, iw).catch(() => []);
  const counts = {}; let all = ent.slice();
  lists.forEach((l, i) => { counts[plan[i]] = l.length; all = all.concat(l); });
  // the same article often exists in several Wikipedia editions: keep the fullest one
  const seen = new Map(); for (const it of all) { const k = it.group + '|' + norm(it.title); const prev = seen.get(k); if (!prev || (it.words || 0) > (prev.words || 0) + 400) seen.set(k, prev ? { ...it, rank: Math.min(it.rank, prev.rank) } : it); }
  all = [...seen.values()];
  all = all.filter(it => !JUNK.test(it.url || it.link || '') && !JUNK.test(it.title) && !JUNK_T.test(it.title));
  const qn = norm(stripLead(q)), qs = toks(stripLead(q)), kt = [...new Set(toks(kq))];
  all.forEach(it => {
    const tn = norm(it.title), ts = toks(it.title), tset = new Set(ts), hay = new Set(toks(it.title + ' ' + (it.snippet || '').replace(/<[^>]+>/g, ' ')));
    let s = (iw[it.group] || .6) / (1 + it.rank * .32);
    const cov = kt.length ? kt.filter(w => hay.has(w)).length / kt.length : 1; s += (cov - .55) * .9;                         // how many of the question's words appear
    if (tn === qn) s += 1.8;
    else if (ts.length && ts.every(w => qs.includes(w)) && it.group !== 'qa') s += 1.2 + Math.min(.4, ts.length * .1);        // the article's whole title is in the question ("Black hole")
    else if (qs.length && qs.every(w => tset.has(w))) s += .8; else if (qn && tn.startsWith(qn)) s += .5;
    if (it.group === 'wiki' && it.words > 2500) s += .08; if (it.group === 'wiki' && /\(disambiguation\)|^list of |^index of /i.test(it.title)) s -= .5;
    if (it.ent) s += it.same ? 1.6 : .8;
    it.score = s; it.cov = cov;
  });
  all.sort((a, b) => b.score - a.score);
  if (scope === 'all') { const seenG = {}; all = all.filter(it => { const lim = (iw[it.group] || 0) < .6 ? 2 : (iw[it.group] || 0) < .9 ? 6 : 30; seenG[it.group] = (seenG[it.group] || 0) + 1; return seenG[it.group] <= lim; }); }
  const items = all.slice(0, o.n || 30).map(it => ({ title: it.title, url: it.link, snippet: it.snippet, book: it.bookTitle, group: it.group, cat: it.cat, words: it.words, score: Math.round(it.score * 100) / 100 }));
  return { items, counts, names: NAMES, took: Date.now() - t0, kq };
}
async function dictList(books, q, n) {
  const out = []; for (const b of books.slice(0, 1)) { try { (await kiwix.dictItems(b.name, q, n)).forEach(x => out.push({ title: x.title, link: x.link, snippet: '', words: 0, book: b.name, bookTitle: b.title, group: 'dict', cat: 'Dictionary' })); } catch (e) { } }
  return out;
}

/* the best single encyclopedia match, shown as a card with its opening paragraph */
async function panel(q, items) {
  const qn = norm(stripLead(q)); if (!qn) return null;
  const qs = toks(stripLead(q)), cand = items.slice(0, 4).filter(i => i.group === 'wiki').find(i => { const ts = toks(i.title); return norm(i.title) === qn || (ts.length && ts.every(w => qs.includes(w)) && !/^list of /i.test(i.title)); });
  if (!cand) return null;
  try { let t = await race(kiwix.text(cand.url, 1800), 5000); t = t.replace(new RegExp('^' + cand.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*', 'i'), '').replace(/\[\d+\]/g, '').replace(/\s+/g, ' ').trim(); const esc = cand.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); for (let k = 0; k < 3; k++) { t = t.replace(new RegExp('^' + esc + '\\s*', 'i'), '').replace(/^(For other uses|For other meanings|This article is about|Not to be confused with|"[^"]{1,60}" redirects here|See also)[^.]*\.\s*/i, '').replace(/^\(?disambiguation\)?\s*\.?\s*/i, '').trim(); } const para = t.slice(0, 900); const cut = para.lastIndexOf('. '); if (para.length < 60) return null; return { title: cand.title, url: cand.url, book: cand.book, text: cut > 300 ? para.slice(0, cut + 1) : para }; } catch (e) { return null; }
}

/* passages the AI answers from: the opening of the best pages, trimmed */
async function passages(links, max = 1800) {
  const out = []; await Promise.all((links || []).slice(0, 6).map(async (it, i) => {
    if (!/^\/wiki\//.test(it.url || '')) return; try { let t = await race(kiwix.text(it.url, max + 600), 7000); t = t.replace(new RegExp('^' + String(it.title || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*', 'i'), '').replace(/\[\d+\]/g, '').replace(/\s+/g, ' ').trim(); if (t.length > 60) out[i] = { title: it.title, url: it.url, book: it.book, text: t.slice(0, max) }; } catch (e) { }
  }));
  return out.filter(Boolean);
}

/* autocomplete from article titles */
async function suggest(term) {
  term = String(term || '').trim(); if (term.length < 2 || !(await kiwix.ensureP())) return [];
  const bl = kiwix.books().filter(b => b.group === 'wiki'), pick = bl.find(b => /all_mini/.test(b.name)) || bl.find(b => /top/.test(b.name)) || bl[0]; if (!pick) return [];
  try { const r = await race(kiwix.suggest(pick.name, term), 2500); const seen = new Set(); return (r || []).filter(x => x.value || x.label).map(x => U.ent(String(x.value || x.label).replace(/<[^>]+>/g, ''))).filter(x => !seen.has(x.toLowerCase()) && seen.add(x.toLowerCase())).slice(0, 8); } catch (e) { return []; }
}
module.exports = { search, panel, passages, suggest, GROUPS, NAMES };

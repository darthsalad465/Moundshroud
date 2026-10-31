// Offline thesaurus built from the Wiktionary library: its "Thesaurus:" pages (grouped by meaning), with the word's own synonym lines as a fallback.
const http = require('http');
const kiwix = require('./kiwix'), U = require('./util');

const cache = new Map();
function get(p) {
  return new Promise((resolve, reject) => {
    const r = http.get({ host: '127.0.0.1', port: kiwix.PORT, path: p, timeout: 20000 }, res => {
      if (res.statusCode !== 200) { res.resume(); return resolve(null); }
      const ch = []; res.on('data', c => ch.push(c)); res.on('end', () => resolve(Buffer.concat(ch).toString('utf8')));
    });
    r.on('error', reject); r.on('timeout', () => { r.destroy(); reject(new Error('timeout')); });
  });
}
const txt = h => U.ent(h.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
const englishOnly = h => { const i = h.search(/<h2[^>]*id="English"/i); if (i < 0) return ''; const rest = h.slice(i + 10), j = rest.search(/<h2[\s>]/i); return j < 0 ? rest : rest.slice(0, j); };

function parseThesaurus(h, head) {
  h = englishOnly(h); if (!h) return [];
  const out = []; let pos = '', sense = '', type = '', cur = null;
  const re = /<h([3-6])[^>]*>([\s\S]*?)<\/h\1>|<li[^>]*>([\s\S]*?)<\/li>/gi; let m;
  while ((m = re.exec(h))) {
    if (m[1]) {
      const t = txt(m[2]); const lv = +m[1];
      if (lv === 3) { pos = t; sense = ''; type = ''; cur = null; }
      else if (lv === 4) { sense = t.replace(/^Sense:\s*/i, ''); type = ''; cur = null; }
      else { type = t; cur = { pos, sense, type, words: [] }; out.push(cur); }
    } else if (cur) {
      const a = m[3].match(/<a [^>]*>([\s\S]*?)<\/a>/i); if (!a) continue;
      const w = txt(a[1]); if (!w || /^[^\p{L}]*$/u.test(w) || w.toLowerCase() === head || /[\/*{}\u21d2\u2192]|https?:/.test(w) || w.toLowerCase() === 'thesaurus' || w.length > 40) continue;
      const rest = txt(m[3].replace(a[0], '')).replace(/^[\s()]+|[\s()]+$/g, '');
      cur.words.push({ w, note: /[\/*{}\u21d2]|https?:/.test(rest) ? '' : rest.slice(0, 40) });
    }
  }
  return out.filter(g => g.words.length);
}
function parseEntry(h) {
  h = englishOnly(h); if (!h) return [];
  const out = []; const re = /<span class="nyms (synonym|antonym)">([\s\S]*?)<\/dd>/gi; let m;
  const seen = { synonym: new Set(), antonym: new Set() }, groups = { synonym: { pos: '', sense: '', type: 'Synonyms', words: [] }, antonym: { pos: '', sense: '', type: 'Antonyms', words: [] } };
  while ((m = re.exec(h))) {
    const kind = m[1]; const links = m[2].match(/<a [^>]*title="[^"]*"[^>]*>[\s\S]*?<\/a>/gi) || [];
    for (const l of links) { const w = txt(l); if (w && !seen[kind].has(w.toLowerCase()) && !/^[^\p{L}]*$/u.test(w)) { seen[kind].add(w.toLowerCase()); groups[kind].words.push({ w, note: '' }); } }
  }
  /* entries that list synonyms in their own "Synonyms" / "Antonyms" sections: grouped by the sense in brackets, e.g. "(inclined to adventure): daring, bold" */
  const hre = /<h([3-6])[^>]*id="(Synonyms|Antonyms)"[^>]*>[\s\S]*?<\/h\1>\s*<\/div>\s*([\s\S]*?)(?=<div class="mw-heading|$)/gi; let hm; const secs = [];
  while ((hm = hre.exec(h))) {
    const kind = /anton/i.test(hm[2]) ? 'Antonyms' : 'Synonyms', lis = hm[3].match(/<li[^>]*>[\s\S]*?<\/li>/gi) || [];
    for (const li of lis.slice(0, 12)) {
      const sm = li.match(/<span class="ib-content qualifier-content">([\s\S]*?)<\/span>/i), sense = sm ? txt(sm[1]) : '', ws = [], sn = new Set();
      for (const l of (li.match(/<a [^>]*title="[^"]*"[^>]*>[\s\S]*?<\/a>/gi) || [])) { const w = txt(l); if (w && w.length < 40 && !sn.has(w.toLowerCase()) && !/^[^\p{L}]*$/u.test(w) && !/[\/*{}]|https?:/.test(w)) { sn.add(w.toLowerCase()); ws.push({ w, note: '' }); } }
      if (ws.length) secs.push({ pos: '', sense, type: kind, words: ws });
    }
  }
  if (secs.length) return secs.concat(out.length ? [] : []);
  for (const k of ['synonym', 'antonym']) if (groups[k].words.length) out.push(groups[k]);
  return out;
}

async function lookup(word) {
  word = String(word || '').trim().replace(/\s+/g, ' ').slice(0, 60); if (!word) return { error: 'empty' };
  const key = word.toLowerCase(); if (cache.has(key)) return cache.get(key);
  if (!(await kiwix.ensureP())) return { error: 'The library is not available.' };
  const book = (kiwix.books().find(b => b.category === 'Dictionary') || {}).name; if (!book) return { error: 'The dictionary book is not installed.' };
  const enc = s => s.split('/').map(encodeURIComponent).join('/');
  let groups = [], source = '';
  for (const w of [...new Set([key, word])]) {
    const t = await get('/wiki/content/' + book + '/' + enc('Thesaurus:' + w)); if (t) { groups = parseThesaurus(t, key); if (groups.length) { source = 'Wiktionary Thesaurus'; break; } }
  }
  if (!groups.length) {
    for (const w of [...new Set([key, word])]) { const e = await get('/wiki/content/' + book + '/' + enc(w)); if (e) { groups = parseEntry(e); if (groups.length) { source = 'Wiktionary entry'; break; } } }
  }
  const res = groups.length ? { word, source, groups } : { word, source: '', groups: [], none: true };
  if (cache.size > 200) cache.clear(); cache.set(key, res); return res;
}

module.exports = { lookup };

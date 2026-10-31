// Offline rhyming dictionary built on the CMU Pronouncing Dictionary (data/cmudict.dict, about 135,000 English words).
const fs = require('fs'), path = require('path');
const FILE = path.join(__dirname, '..', 'data', 'cmudict.dict');
let db = null;

const IPA = { AA: 'ɑ', AE: 'æ', AH: 'ʌ', AO: 'ɔ', AW: 'aʊ', AY: 'aɪ', B: 'b', CH: 'tʃ', D: 'd', DH: 'ð', EH: 'ɛ', ER: 'ɝ', EY: 'eɪ', F: 'f', G: 'ɡ', HH: 'h', IH: 'ɪ', IY: 'i', JH: 'dʒ', K: 'k', L: 'l', M: 'm', N: 'n', NG: 'ŋ', OW: 'oʊ', OY: 'ɔɪ', P: 'p', R: 'ɹ', S: 's', SH: 'ʃ', T: 't', TH: 'θ', UH: 'ʊ', UW: 'u', V: 'v', W: 'w', Y: 'j', Z: 'z', ZH: 'ʒ' };
/* voiced/unvoiced pairs and the nasals sound alike at the end of a word, which is what makes a "near" rhyme (cat / bad / cap) */
const CLS = { P: 'P', B: 'P', T: 'T', D: 'T', K: 'K', G: 'K', F: 'F', V: 'F', TH: 'H', DH: 'H', S: 'S', Z: 'S', SH: 'X', ZH: 'X', CH: 'C', JH: 'C', M: 'N', N: 'N', NG: 'N', L: 'L', R: 'R', W: 'W', Y: 'Y', HH: 'h' };
const isV = p => 'AEIOU'.includes(p[0]);
const base = p => p.replace(/\d/, '');

function load() {
  if (db) return db;
  if (!fs.existsSync(FILE)) return (db = { missing: true });
  const words = new Map(), perfect = new Map(), near = new Map(), ending = new Map(), assonance = new Map();
  const add = (m, k, w) => { let s = m.get(k); if (!s) m.set(k, s = new Set()); s.add(w); };
  for (const line of fs.readFileSync(FILE, 'utf8').split('\n')) {
    const i = line.indexOf(' '); if (i < 1) continue; const w = line.slice(0, i).replace(/\(\d+\)$/, ''), ph = line.slice(i + 1).trim().split(' ');
    if (!/^[a-z][a-z'-]*$/.test(w) || !ph.length) continue;
    (words.get(w) || words.set(w, []).get(w)).push(ph);
    const k = keys(ph); add(perfect, k.perfect, w); add(near, k.near, w); add(ending, k.ending, w); add(assonance, k.vowel + '|' + k.syll, w);
  }
  return (db = { words, perfect, near, ending, assonance, missing: false });
}
function vowelIdx(ph) { const v = []; ph.forEach((p, i) => { if (isV(p)) v.push(i); }); return v; }
function keys(ph) {
  const v = vowelIdx(ph); let s = -1;
  for (let j = v.length - 1; j >= 0; j--) if (/[12]$/.test(ph[v[j]])) { s = v[j]; break; }
  if (s < 0) s = v.length ? v[v.length - 1] : 0;
  const tail = ph.slice(s).map(base), last = v.length ? v[v.length - 1] : 0;
  return { perfect: tail.join(' '), near: base(ph[s]) + '|' + tail.slice(1).map(p => CLS[p] || p).join(''), ending: ph.slice(last).map(base).join(' '), vowel: base(ph[s] || ''), syll: v.length, stressAt: s, onset: s > 0 ? base(ph[s - 1]) : '' };
}
function ipa(ph) {
  const v = vowelIdx(ph); let s = -1; for (let j = v.length - 1; j >= 0; j--) if (/1$/.test(ph[v[j]])) { s = v[j]; break; } if (s < 0) for (let j = v.length - 1; j >= 0; j--) if (/2$/.test(ph[v[j]])) { s = v[j]; break; }
  let out = '', mark = -1; if (s >= 0 && v.length > 1) { mark = s; while (mark > 0 && !isV(ph[mark - 1])) mark--; }
  ph.forEach((p, i) => { if (i === mark) out += 'ˈ'; const b = base(p); out += b === 'AH' && p.endsWith('0') ? 'ə' : b === 'ER' && p.endsWith('0') ? 'ɚ' : (IPA[b] || b.toLowerCase()); });
  return out;
}
const sy = w => { const d = load(), p = d.words.get(w); return p ? vowelIdx(p[0]).length : 0; };
/* everyday English words from the spell-checker that ships with LibreOffice: lets us put real words ahead of names and oddities */
function everyday() {
  const set = new Set(), files = ['C:\\Program Files\\LibreOffice\\share\\extensions\\dict-en\\en_US.dic', 'C:\\Program Files (x86)\\LibreOffice\\share\\extensions\\dict-en\\en_US.dic'];
  const f = files.find(x => fs.existsSync(x)); if (!f) return null;
  const vow = c => 'aeiou'.includes(c);
  for (const line of fs.readFileSync(f, 'utf8').split(/\r?\n/).slice(1)) {
    const m = /^([a-z][a-z'-]*)(?:\/(\S*))?/.exec(line); if (!m) continue; const w = m[1], fl = m[2] || ''; set.add(w);
    const last = w.slice(-1), cy = last === 'y' && !vow(w.slice(-2, -1)), ce = last === 'e';
    for (const c of fl) {
      if (c === 'S') set.add(cy ? w.slice(0, -1) + 'ies' : /(s|x|z|ch|sh)$/.test(w) ? w + 'es' : w + 's');
      else if (c === 'D') set.add(ce ? w + 'd' : cy ? w.slice(0, -1) + 'ied' : w + 'ed');
      else if (c === 'G') set.add(ce ? w.slice(0, -1) + 'ing' : w + 'ing');
      else if (c === 'R') set.add(ce ? w + 'r' : cy ? w.slice(0, -1) + 'ier' : w + 'er');
      else if (c === 'Z') set.add(ce ? w + 'rs' : cy ? w.slice(0, -1) + 'iers' : w + 'ers');
      else if (c === 'T') set.add(ce ? w + 'st' : cy ? w.slice(0, -1) + 'iest' : w + 'est');
      else if (c === 'Y') set.add(cy ? w.slice(0, -1) + 'ily' : /le$/.test(w) ? w.slice(0, -1) + 'y' : w + 'ly');
      else if (c === 'P') set.add(cy ? w.slice(0, -1) + 'iness' : w + 'ness');
      else if (c === 'N') set.add(ce ? w.slice(0, -1) + 'ion' : w + 'ion');
      else if (c === 'X') set.add(ce ? w.slice(0, -1) + 'ions' : w + 'ions');
      else if (c === 'H') set.add(cy ? w.slice(0, -1) + 'ieth' : w + 'th');
      else if (c === 'J') set.add(ce ? w.slice(0, -1) + 'ings' : w + 'ings');
      else if (c === 'V') set.add(ce ? w.slice(0, -1) + 'ive' : w + 'ive');
      else if (c === 'A') set.add('re' + w);
      else if (c === 'E') set.add('un' + w);
    }
  }
  return set;
}
let real = undefined;
function group(set, skip, cap) {
  if (real === undefined) { try { real = everyday(); } catch (e) { real = null; } }
  const g = { 1: { c: [], r: [] }, 2: { c: [], r: [] }, 3: { c: [], r: [] }, 4: { c: [], r: [] } }; let common = 0, rare = 0;
  for (const w of set) { if (skip.has(w)) continue; const n = Math.min(4, Math.max(1, sy(w))), isReal = !real || real.has(w); (isReal ? g[n].c : g[n].r).push(w); isReal ? common++ : rare++; }
  for (const k of Object.keys(g)) { g[k].c.sort(); g[k].r.sort(); g[k].c = g[k].c.slice(0, cap); g[k].r = g[k].r.slice(0, Math.floor(cap / 2)); }
  return { g, total: common + rare, common };
}
/* how alike two word endings sound: length of the shared run of consonant classes, counted from the end */
function endScore(w, key) { const p = (load().words.get(w) || [[]])[0].map(x => CLS[base(x)] || base(x)), k = key; let n = 0; while (n < p.length && n < k.length && p[p.length - 1 - n] === k[k.length - 1 - n]) n++; return n; }
function lookup(word, opt) {
  const d = load(); if (d.missing) return { error: 'The pronunciation list (data/cmudict.dict) is missing.' };
  word = String(word || '').toLowerCase().trim().replace(/[^a-z'-]/g, ''); if (!word) return { error: 'Type a word first.' };
  const cap = (opt && opt.cap) || 400; let prons = d.words.get(word), guess = false, guessNote = '';
  if (!prons) { // not in the list: borrow the sound of words that end with the same letters
    for (let n = Math.min(5, word.length - 1); n >= 2 && !prons; n--) {
      const suf = word.slice(-n), tally = new Map(); let found = 0;
      for (const [w, p] of d.words) { if (w.length > n && w.endsWith(suf)) { const k = keys(p[0]).perfect; const t = tally.get(k) || { n: 0, ph: p[0] }; t.n++; tally.set(k, t); found++; } }
      if (found >= 6) { const best = [...tally.values()].sort((a, b) => b.n - a.n)[0]; prons = [best.ph]; guess = true; guessNote = 'I do not have "' + word + '" in the pronunciation list, so these rhymes are a guess based on words that end with "-' + suf + '".'; }
    }
    if (!prons) return { word, none: true };
  }
  const skip = new Set([word]), P = new Set(), N = new Set(), E = new Set(), A = new Set();
  for (const ph of prons) {
    const k = keys(ph); (d.perfect.get(k.perfect) || []).forEach(w => P.add(w)); (d.near.get(k.near) || []).forEach(w => N.add(w)); (d.ending.get(k.ending) || []).forEach(w => E.add(w)); (d.assonance.get(k.vowel + '|' + k.syll) || []).forEach(w => A.add(w));
  }
  for (const w of P) { N.delete(w); }
  for (const w of P) { E.delete(w); } for (const w of N) A.delete(w); for (const w of P) A.delete(w);
  let nearSet = N;
  if (N.size < 40) { // few slant rhymes: add words with the same stressed vowel and a similar ending, best matches first
    const k0 = prons.map(p => keys(p)), cls = prons[0].map(p => CLS[base(p)] || base(p)); const cand = [...A].map(w => [w, endScore(w, cls)]).filter(x => x[1] >= 1).sort((a, b) => b[1] - a[1] || a[0].length - b[0].length).slice(0, 250).map(x => x[0]); nearSet = new Set([...N, ...cand]);
  }
  const perfect = group(P, skip, cap), nearG = group(nearSet, skip, cap), ending = group(E, skip, cap);
  return { word, guess, note: guessNote, syllables: vowelIdx(prons[0]).length, prons: prons.slice(0, 3).map(p => ({ arpa: p.join(' '), ipa: ipa(p) })), perfect: perfect.g, perfectN: perfect.common, near: nearG.g, nearN: nearG.common, ending: ending.g, endingN: ending.common };
}
module.exports = { lookup, available: () => fs.existsSync(FILE) };

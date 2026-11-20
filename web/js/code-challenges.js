// Coding › Playground › 🧩 Challenges and 🌀 Code Labyrinth: seeded coding puzzles at four levels (Easy, Medium, Hard,
// Insane) in four categories (numbers, text, lists, sequences). Each puzzle asks for one exact printed answer, so any
// language that runs can solve it; the harder ones need real computation. The Labyrinth is an endless descent: each
// floor is a puzzle whose level rises with depth, some floors lock the language, and every 4th floor is an esoteric gate.
// Used by web/js/code-lessons.js and the tests. Answers are computed here, never stored.
(function (root) {
  'use strict';
  const DIFFS = [
    { id: 'easy', label: 'Easy', ic: '🟢', pts: 10, note: 'Small numbers. Doable by hand, quicker in code.' },
    { id: 'medium', label: 'Medium', ic: '🟡', pts: 25, note: 'Loops and conditions over a few thousand values.' },
    { id: 'hard', label: 'Hard', ic: '🟠', pts: 50, note: 'Needs an efficient loop or a sieve.' },
    { id: 'insane', label: 'Insane', ic: '🔴', pts: 100, note: 'Big numbers, generated data and real algorithms.' },
  ];
  const CATS = [['num', '🔢 Numbers'], ['text', '🔤 Text'], ['list', '📋 Lists'], ['seq', '🔁 Sequences']];
  const rnd = seed => { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
  const int = (r, a, b) => a + Math.floor(r() * (b - a + 1));
  const pick = (r, xs) => xs[Math.floor(r() * xs.length)];
const S = (x, sc, cap) => Math.min(cap, Math.round(x * sc)); /* a size grown by the Labyrinth's scale, never past cap */
  const WORDS = ['lantern', 'harbor', 'copper', 'meadow', 'falcon', 'quartz', 'ember', 'willow', 'signal', 'orbit', 'pepper', 'canyon', 'velvet', 'thunder', 'marble', 'river', 'cobalt', 'saffron', 'glacier', 'puzzle', 'moss', 'cipher', 'beacon', 'tundra'];
  const sieve = n => { const s = new Uint8Array(n + 1); const out = []; for (let i = 2; i <= n; i++) { if (!s[i]) { out.push(i); for (let j = i * i; j <= n; j += i) s[j] = 1; } } return out; };
  const isPal = s => s === [...s].reverse().join('');
  const digitSum = x => [...String(x)].reduce((a, c) => a + +c, 0);
  const lcg = (s, n, mod) => { const out = []; let a = s; for (let i = 0; i < n; i++) { out.push(a % mod); a = (a * 1103515245 + 12345) % 2147483648; } return out; };
  const LCG_TEXT = (s, n, mod) => 'Build the list yourself: a(0) = ' + s + ', and a(i+1) = (a(i) × 1103515245 + 12345) mod 2147483648. Use the values a(i) mod ' + mod + ' for i = 0 to ' + (n - 1) + '. (Use 64-bit or big integers for the multiplication.)';

  /* each generator: (r, sc) => {cat, t (title), task, ans}; sc (1 or more) grows the puzzle size on deep Labyrinth floors */
  const GEN = {
    easy: [
      r => { const n = int(r, 50, 500); return { cat: 'num', t: 'Sum to ' + n, task: 'Print the sum of all whole numbers from 1 to ' + n + '.', ans: String(n * (n + 1) / 2) }; },
      r => { const w = Array.from({ length: 4 }, () => pick(r, WORDS)).join(' '); return { cat: 'text', t: 'Count the vowels', task: 'Print how many vowels (a, e, i, o, u) are in this text:\n' + w, ans: String((w.match(/[aeiou]/g) || []).length) }; },
      r => { const w = pick(r, WORDS) + pick(r, WORDS); return { cat: 'text', t: 'Backwards', task: 'Print this word backwards:\n' + w, ans: [...w].reverse().join('') }; },
      r => { const xs = Array.from({ length: 8 }, () => int(r, 1, 99)); return { cat: 'list', t: 'Biggest and smallest', task: 'Print the largest number, a space, then the smallest, from this list:\n' + xs.join(', '), ans: Math.max(...xs) + ' ' + Math.min(...xs) }; },
      r => { const n = int(r, 3, 12); return { cat: 'seq', t: 'Times table of ' + n, task: 'Print ' + n + ' × 1 up to ' + n + ' × 5, one result per line (just the numbers).', ans: [1, 2, 3, 4, 5].map(k => n * k).join('\n') }; },
      r => { const n = int(r, 6, 12); let f = 1; for (let i = 2; i <= n; i++) f *= i; return { cat: 'num', t: n + ' factorial', task: 'Print ' + n + '! (that is 1 × 2 × ... × ' + n + ').', ans: String(f) }; },
    ],
    medium: [
      (r, sc) => { const a = int(r, 3, 5), b = int(r, 6, 9), x = pick(r, ['Zip', 'Fizz', 'Ping']), y = pick(r, ['Zap', 'Buzz', 'Pong']), lo = int(r, 1, 20), hi = lo + S(14, sc, 60); const out = []; for (let i = lo; i <= hi; i++) out.push((i % a ? '' : x) + (i % b ? '' : y) || String(i)); return { cat: 'seq', t: x + y, task: 'For each number from ' + lo + ' to ' + hi + ', print one line: "' + x + '" if it divides by ' + a + ', "' + y + '" if it divides by ' + b + ', "' + x + y + '" if both, otherwise the number.', ans: out.join('\n') }; },
      (r, sc) => { const n = S(int(r, 10, 50) * 100, sc, 1e6); return { cat: 'num', t: 'Primes below ' + n, task: 'Print how many prime numbers are smaller than ' + n + '.', ans: String(sieve(n - 1).length) }; },
      (r, sc) => { const k = S(int(r, 60, 160), sc, 5000); return { cat: 'num', t: 'Digits of 2^' + k, task: 'Print the sum of the decimal digits of 2 to the power ' + k + '.', ans: String(digitSum(2n ** BigInt(k))) }; },
      (r, sc) => { const k = int(r, 3, 23), plain = Array.from({ length: S(3, sc, 12) }, () => pick(r, WORDS)).join(' '); const enc = plain.replace(/[a-z]/g, c => String.fromCharCode((c.charCodeAt(0) - 97 + k) % 26 + 97)); return { cat: 'text', t: 'Caesar shift ' + k, task: 'Each letter of this text was moved ' + k + ' places forward in the alphabet (z wraps to a). Print the original text:\n' + enc, ans: plain }; },
      (r, sc) => { const n = S(int(r, 40, 90), sc, 3000); let a = 0n, b = 1n; for (let i = 0; i < n; i++) [a, b] = [b, a + b]; return { cat: 'seq', t: 'Fibonacci ' + n, task: 'F(0) = 0, F(1) = 1, F(n) = F(n-1) + F(n-2). Print F(' + n + ').', ans: String(a) }; },
      (r, sc) => { const xs = Array.from({ length: S(12, sc, 60) }, () => int(r, 1, 60)); const ev = xs.filter(x => x % 2 === 0); return { cat: 'list', t: 'Even ones, sorted', task: 'Print the even numbers from this list in increasing order, separated by spaces:\n' + xs.join(', '), ans: ev.sort((a, b) => a - b).join(' ') }; },
    ],
    hard: [
      (r, sc) => { const n = S(int(r, 10, 60) * 1000, sc, 1e6); let best = 1, bestLen = 1; const len = new Int32Array(n); len[1] = 1; for (let st = 2; st < n; st++) { let x = st, steps = 0; while (x >= n || len[x] === 0) { x = x % 2 ? 3 * x + 1 : x / 2; steps++; } len[st] = steps + len[x]; if (len[st] > bestLen) { bestLen = len[st]; best = st; } } return { cat: 'seq', t: 'Longest Collatz chain', task: 'Collatz: if n is even, n becomes n/2, otherwise 3n+1, until n is 1. Which starting number below ' + n + ' makes the longest chain? Print that number.', ans: String(best) }; },
      (r, sc) => { const n = S(int(r, 50, 300) * 1000, sc, 5e6); return { cat: 'num', t: 'Sum of primes', task: 'Print the sum of all primes below ' + n + '.', ans: String(sieve(n - 1).reduce((a, b) => a + b, 0)) }; },
      (r, sc) => { const a = int(r, 1000, 9000), b = a + S(int(r, 20000, 90000), sc, 1e6); let c = 0; for (let i = a; i <= b; i++) if (isPal(String(i)) && isPal(i.toString(2))) c++; return { cat: 'num', t: 'Double palindromes', task: 'How many numbers from ' + a + ' to ' + b + ' read the same backwards in decimal AND in binary? Print the count.', ans: String(c) }; },
      (r, sc) => { const s = int(r, 1, 99999), n = S(500, sc, 20000); const xs = lcg(s, n, 1000); return { cat: 'list', t: 'Most common value', task: LCG_TEXT(s, n, 1000) + '\nPrint the value that appears most often (if tied, the smallest one).', ans: (() => { const m = new Map(); xs.forEach(x => m.set(x, (m.get(x) || 0) + 1)); let bv = Infinity, bc = 0; m.forEach((c, v) => { if (c > bc || (c === bc && v < bv)) { bc = c; bv = v; } }); return String(bv); })() }; },
      (r, sc) => { const w = Array.from({ length: S(30, sc, 400) }, () => pick(r, WORDS)); const m = new Map(); w.forEach(x => m.set(x, (m.get(x) || 0) + 1)); const top = [...m].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).slice(0, 3); return { cat: 'text', t: 'Top three words', task: 'Print the three most frequent words in this text, most frequent first (ties in alphabetical order), each as "word count" on its own line:\n' + w.join(' '), ans: top.map(([k, v]) => k + ' ' + v).join('\n') }; },
    ],
    insane: [
      (r, sc) => { const n = S(int(r, 120, 400), sc, 4000); let f = 1n; for (let i = 2n; i <= BigInt(n); i++) f *= i; return { cat: 'num', t: 'Digits of ' + n + '!', task: 'Print the sum of the decimal digits of ' + n + '! (' + n + ' factorial).', ans: String(digitSum(f)) }; },
      (r, sc) => { const s = int(r, 1, 99999), n = S(2000, sc, 100000); const xs = lcg(s, n, 1000); const tails = []; xs.forEach(x => { let lo = 0, hi = tails.length; while (lo < hi) { const m = (lo + hi) >> 1; if (tails[m] < x) lo = m + 1; else hi = m; } tails[lo] = x; }); return { cat: 'list', t: 'Longest rising run', task: LCG_TEXT(s, n, 1000) + '\nPrint the length of the longest strictly increasing subsequence (the values need not be next to each other).', ans: String(tails.length) }; },
      (r, sc) => { const n = S(int(r, 15, 22), Math.sqrt(sc), 60), blocked = new Set(); for (let k = 0; k < n * Math.ceil(Math.sqrt(sc)); k++) blocked.add(int(r, 1, n - 1) + ',' + int(r, 1, n - 1)); const ways = Array.from({ length: n + 1 }, () => new Array(n + 1).fill(0n)); ways[0][0] = 1n; for (let y = 0; y <= n; y++) for (let x = 0; x <= n; x++) { if (blocked.has(x + ',' + y)) { ways[y][x] = 0n; continue; } if (x) ways[y][x] += ways[y][x - 1]; if (y) ways[y][x] += ways[y - 1][x]; } return { cat: 'seq', t: 'Grid paths', task: 'On a grid of points from (0,0) to (' + n + ',' + n + '), move only right (x+1) or up (y+1). These points are blocked: ' + [...blocked].map(p => '(' + p + ')').join(' ') + '\nPrint how many paths go from (0,0) to (' + n + ',' + n + ').', ans: String(ways[n][n]) }; },
      (r, sc) => { const n = S(int(r, 2, 9) * 100000, sc, 1e7); const ps = sieve(n); let c = 0; for (let i = 1; i < ps.length; i++) if (ps[i] - ps[i - 1] === 2) c++; return { cat: 'num', t: 'Twin primes', task: 'Twin primes are two primes that differ by 2, like 11 and 13. Print how many twin-prime pairs have both primes at most ' + n + '.', ans: String(c) }; },
      (r, sc) => { const words = Array.from({ length: S(40, sc, 200) }, () => pick(r, WORDS)); const key = int(r, 1, 25); const enc = words.map(w => w.replace(/[a-z]/g, c => String.fromCharCode((c.charCodeAt(0) - 97 + key) % 26 + 97))).join(' '); const best = [...new Set(words)].sort((a, b) => b.length - a.length || (a < b ? -1 : 1))[0]; return { cat: 'text', t: 'Unknown shift', task: 'This text is a list of English words, each letter moved forward by the same secret amount (1 to 25). Find the amount, decode it, and print the longest decoded word (if tied, the first alphabetically):\n' + enc, ans: best }; },
    ],
  };
  /* answers are cached, because big floors take up to a few hundred milliseconds to work out */
  const memo = new Map(), remember = (k, f) => { if (memo.has(k)) return memo.get(k); const v = f(); memo.set(k, v); if (memo.size > 40) memo.delete(memo.keys().next().value); return v; };
  function make(diff, cats, seed, sc) {
    sc = Math.max(1, sc || 1);
    const d = GEN[diff] ? diff : 'easy';
    return Object.assign({}, remember('m:' + d + ':' + (cats || []).join() + ':' + seed + ':' + sc, () => {
      const r = rnd((seed >>> 0) ^ 0x9e3779b9), pool = GEN[d].map((g, i) => ({ g, i }));
      const want = Array.isArray(cats) && cats.length ? cats : CATS.map(c => c[0]);
      for (let tries = 0; ; tries++) { const k = pool[Math.floor(r() * pool.length)], c = k.g(rnd((seed >>> 0) + k.i * 7919), sc); if (want.includes(c.cat) || tries > 40) return Object.assign(c, { diff: d, seed: seed >>> 0, pts: DIFFS.find(x => x.id === d).pts }); }
    }));
  }
  /* Labyrinth floors. Depth sets four things, all growing smoothly so no single floor jumps in difficulty:
     level (Easy 1-3, Medium 4-7, Hard 8-12, Insane after), size (puzzle numbers grow from floor 13, capped so answers stay
     computable), parts (2 puzzles from floor 25, 3 from 75, 4 from 150, 5 from 250) and twists (reversed order from 100,
     lengths added from 200). Every 4th floor is an esoteric gate whose key grows longer, with harder languages from 40. */
  const GATE_LANGS = ['bf', 'befunge93', 'fish', 'false', 'underload', 'slashes', 'lolcode', 'arnoldc', 'rockstar', 'emojicode', 'thue', 'whenever', 'chef', 'unlambda', 'forth', 'basic', 'scheme', 'prolog'];
  const GATE_HARD = ['ook', 'cow', 'whitespace', 'intercal', 'spl', 'chicken', 'funge98', 'brainflak'];
  const KEYS = ['OPEN', 'GATE', 'KEY', 'DOOR', 'LIGHT', 'DEEPER', 'ONWARD', 'DESCEND', 'TORCH', 'RUNE'];
  const PRACTICAL = ['python', 'javascript', 'c', 'cpp', 'rust', 'csharp', 'fsharp', 'vbnet', 'typescript', 'nodejs', 'powershell', 'bash', 'perl', 'awk', 'scheme', 'prolog', 'forth', 'basic', 'lua', 'ruby', 'go', 'java'];
  const TIERS = [[1, 'The Antechamber'], [13, 'The Deep'], [50, 'The Abyss'], [100, 'The Core'], [200, 'The Void'], [350, 'Beyond']];
  const tierOf = depth => TIERS.reduce((a, t) => depth >= t[0] ? t[1] : a, TIERS[0][1]);
  const scaleOf = depth => depth <= 12 ? 1 : +(1 + (depth - 12) / 25).toFixed(2);
  const partsOf = depth => depth >= 250 ? 5 : depth >= 150 ? 4 : depth >= 75 ? 3 : depth >= 25 ? 2 : 1;
  function floor(depth, seed, runnable) {
    depth = Math.max(1, Math.floor(depth)); seed >>>= 0;
    const r = rnd((seed ^ Math.imul(depth, 2654435761)) >>> 0), ok = id => !runnable || runnable.includes(id);
    const base = { seed, tier: tierOf(depth), scale: scaleOf(depth), key: 'lab:' + seed + ':' + depth };
    if (depth % 4 === 0) {
      const pool = GATE_LANGS.concat(depth >= 40 ? GATE_HARD : []).filter(ok), lang = pick(r, pool.length ? pool : ['python']);
      const words = Math.min(5, 1 + Math.floor(depth / 60)), key = Array.from({ length: words }, () => pick(r, KEYS)).join('-') + '-' + depth;
      return Object.assign(base, { gate: true, lang, diff: depth >= 12 ? 'hard' : depth >= 8 ? 'medium' : 'easy', t: 'Esoteric gate', task: 'The gate only opens to ' + lang + '. Print exactly:\n' + key, ans: key, pts: 20 + depth * 5, cat: 'gate' });
    }
    const diff = depth <= 3 ? 'easy' : depth <= 7 ? 'medium' : depth <= 12 ? 'hard' : 'insane', n = partsOf(depth), sc = scaleOf(depth);
    let c;
    if (n === 1) c = make(diff, null, (seed + depth * 104729) >>> 0, sc);
    else {
      /* several puzzles in one floor: mixed levels, one-line answers only */
      const parts = [];
      for (let k = 0; parts.length < n && k < 60; k++) {
        const lv = k % 3 === 2 ? 'hard' : 'insane', p = make(lv, null, (seed + depth * 104729 + k * 15485863) >>> 0, sc);
        if (!String(p.ans).includes('\n') && !parts.some(q => q.t === p.t)) parts.push(p);
      }
      const reverse = depth >= 100, withLen = depth >= 200;
      const rule = 'Print the ' + parts.length + ' answers one per line' + (reverse ? ', in REVERSE order (last part first)' : ', in order') + (withLen ? ', each followed by a space and the number of characters in that answer' : '') + '.';
      const lines = parts.map(p => String(p.ans) + (withLen ? ' ' + String(p.ans).length : ''));
      c = { cat: 'multi', diff: 'insane', t: parts.length + '-part vault', task: rule + '\n\n' + parts.map((p, i) => 'Part ' + (i + 1) + ': ' + p.task).join('\n\n'), ans: (reverse ? lines.reverse() : lines).join('\n'), pts: parts.reduce((a, p) => a + p.pts, 0) };
    }
    c = Object.assign(base, c, { key: base.key });
    const lockChance = depth < 6 ? 0 : Math.min(0.85, 0.5 + depth / 400);
    if (r() < lockChance) { const prac = PRACTICAL.filter(ok); if (prac.length) c.lang = pick(r, prac); }
    c.pts = c.pts + depth * 5;
    return c;
  }
  /* compare printed output with the answer: line ends, trailing spaces and a final line break do not matter */
  const norm = s => String(s == null ? '' : s).replace(/\r\n?/g, '\n').split('\n').map(l => l.replace(/\s+$/, '')).join('\n').replace(/\n+$/, '').replace(/^\n+/, '');
  const check = (out, ans) => norm(out) === norm(ans);
  const api = { DIFFS, CATS, make, floor, check, norm, GATE_LANGS, GATE_HARD, TIERS, tierOf, scaleOf, partsOf };
  root.CodeChallenges = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);

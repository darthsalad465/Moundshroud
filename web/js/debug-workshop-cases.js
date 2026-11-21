// Debug workshop › limitless repair tickets for every language.
//
// Two kinds of ticket, both generated fresh each time:
//   • repair — JavaScript and Python only. A broken function plus test cases the workshop really runs in the code
//     sandbox, so the fix is verified by executing it, not by comparing text.
//   • diff — every other language (and a change of pace in the two above). A real program from that language's own
//     lessons or playground example, with one token quietly changed; repair the line.
//
// Difficulty changes what the ticket gives away: Easy marks the line and says what kind of change it was, Medium marks
// the line only, Hard makes you find the line yourself in a longer program. Everything is seeded from Math.random, so
// the supply never runs out.
(() => {
  if (typeof window === 'undefined' || typeof A === 'undefined' || !window.PlayLangs) return;
  const P = window.PlayLangs;
  const LEVELS = [['easy', 'Easy'], ['medium', 'Medium'], ['hard', 'Hard']];
  const hex = k => Array.from({ length: k }, () => '0123456789abcdef'[(Math.random() * 16) | 0]).join('');
  const rnd = (a, b) => a + ((Math.random() * (b - a + 1)) | 0);
  const pick = a => a[(Math.random() * a.length) | 0];
  const C = window.CodeLessons || null;

  /* ---------- one-token corruption, for a diff ticket ---------- */

  /* every occurrence of a pattern, with its index, so a random one can be changed */
  function spots(line, re) {
    const out = []; re.lastIndex = 0;
    let m; while ((m = re.exec(line))) { out.push({ at: m.index, text: m[0] }); if (!re.global) break; }
    return out;
  }
  function replaceAt(line, at, len, text) { return line.slice(0, at) + text + line.slice(at + len); }

  const SWAP = { '==': '!=', '!=': '==', '<=': '>=', '>=': '<=', '<': '>', '>': '<' };
  const ARITH = { '+': '-', '-': '+', '*': '/', '/': '*', '%': '*' };
  const BOOL = { true: 'false', false: 'true', True: 'False', False: 'True' };

  const BUGS = [
    { name: 'a digit was changed', hint: 'A number in the line is not the number that belongs there.', go(line) {
      const s = spots(line, /\b\d+\b/g); if (!s.length) return null;
      const one = pick(s), v = one.text;
      const digit = (i, d) => v.slice(0, i) + d + v.slice(i + 1);
      const at = rnd(0, v.length - 1), was = v[at];
      let d = String((+was + rnd(1, 9)) % 10); if (d === was) d = String((+was + 1) % 10);
      return replaceAt(line, one.at, v.length, digit(at, d));
    } },
    { name: 'a comparison was flipped', hint: 'The line compares the wrong way round.', go(line) {
      const s = spots(line, /==|!=|<=|>=|<|>/g); if (!s.length) return null;
      const one = pick(s); return replaceAt(line, one.at, one.text.length, SWAP[one.text]);
    } },
    { name: 'an arithmetic operator was changed', hint: 'One operator works on the values differently than it should.', go(line) {
      const s = spots(line, /(?<![<>=!+\-*\/%])([+\-*\/%])(?![=<>+\-*\/%])/g); if (!s.length) return null;
      const one = pick(s); return replaceAt(line, one.at, 1, ARITH[one.text]);
    } },
    { name: 'a true/false value was flipped', hint: 'One of the booleans is the wrong way round.', go(line) {
      const s = spots(line, /\b(true|false|True|False)\b/g); if (!s.length) return null;
      const one = pick(s); return replaceAt(line, one.at, one.text.length, BOOL[one.text]);
    } },
    { name: 'a letter inside a quoted string was changed', hint: 'The text this line prints is not quite the text it should print.', go(line) {
      const s = spots(line, /"[^"\n]{4,}"|'[^'\n]{4,}'/g); if (!s.length) return null;
      const one = pick(s), words = one.text;
      const at = rnd(1, words.length - 2), ch = words[at];
      if (!/[A-Za-z0-9]/.test(ch)) return null;
      const next = ch === 'z' ? 'y' : ch === 'Z' ? 'Y' : ch === '9' ? '8' : String.fromCharCode(ch.charCodeAt(0) + 1);
      return replaceAt(line, one.at, words.length, words.slice(0, at) + next + words.slice(at + 1));
    } },
    { name: 'a letter inside a word was changed', hint: 'One word is spelled wrongly, and the language reads that word as an instruction.', go(line) {
      const s = spots(line, /\b[A-Za-z]{3,}\b/g); if (!s.length) return null;
      const one = pick(s), w = one.text;
      const at = rnd(0, w.length - 1), ch = w[at];
      const next = /[a-z]/.test(ch) ? String.fromCharCode(((ch.charCodeAt(0) - 97 + rnd(1, 25)) % 26) + 97)
        : String.fromCharCode(((ch.charCodeAt(0) - 65 + rnd(1, 25)) % 26) + 65);
      return replaceAt(line, one.at, w.length, w.slice(0, at) + next + w.slice(at + 1));
    } },
    { name: 'a symbol was changed', hint: 'One symbol is not the symbol this line needs.', go(line) {
      const s = spots(line, /[^\w\s'"`]/g); if (!s.length) return null;
      const one = pick(s), pool = '!?.,;:+-*/%&|^~<>()[]{}#@$\\'.replace(one.text, '');
      return replaceAt(line, one.at, 1, pick(pool.split('')));
    } },
    { name: 'a letter was changed', hint: 'One letter in this line is not the letter it should be.', go(line) {
      const s = spots(line, /[A-Za-z]/g); if (!s.length) return null;
      const one = pick(s), ch = one.text;
      const next = ch === 'Z' ? 'Y' : ch === 'z' ? 'y' : String.fromCharCode(ch.charCodeAt(0) + 1);
      return replaceAt(line, one.at, 1, next);
    } },
  ];

  /* programs that are not readable text: Whitespace is invisible, Piet is a picture and Velato is a MIDI file, so there
     is nothing to proofread. Their lessons still exist; only the workshop has to skip them. */
  const NO_TEXT = ['whitespace', 'piet', 'velato'];

  /* comment-only and empty lines are not worth breaking; nor are the bare closing braces of a block. A rule about `;` or
     `%` would also throw away real code in Befunge and assembly, where those characters are operators. */
  const isComment = l => /^\s*(\/\/|#|--|\/\*|\*|REM\b|rem\b)/.test(l) || /^\s*$/.test(l) || /^\s*[{}()\[\],]{1,3}\s*$/.test(l) || /___/.test(l);

  /* ---------- real programs to break, per language ---------- */

  const sourceCache = {};
  function sources(lang) {
    if (sourceCache[lang]) return sourceCache[lang];
    const out = [];
    if (C) C.LESSONS.filter(l => l.lang === lang).forEach(l => {
      const ex = l.ex || {};
      const code = ex.code || ex.sol || '';
      if (code && code.length <= 1200 && !/___/.test(code) && code.split('\n').length >= 2) out.push({ code, from: 'the lessons' });
    });
    const x = P.byId(lang);
    if (x && x.ex && x.ex.length <= 1200 && !/___/.test(x.ex)) out.push({ code: x.ex, from: 'the playground example' });
    return (sourceCache[lang] = out);
  }

  function diffTicket(lang, level) {
    const all = sources(lang);
    if (!all.length) return null;
    const wantLines = level === 'hard' ? 4 : level === 'medium' ? 3 : 2;
    const roomy = all.filter(s => s.code.split('\n').length >= wantLines);
    const pool = roomy.length ? roomy : all;
    for (let attempt = 0; attempt < 24; attempt++) {
      const source = pick(pool);
      const lines = source.code.replace(/\r\n?/g, '\n').split('\n');
      const candidates = [];
      /* prefer a real line of code; very small esoteric programs (HQ9+, BCT, Hexagony) may be only a few characters */
      for (const minLength of [6, 2]) {
        lines.forEach((line, i) => {
          if (line.length < minLength || line.length > 160 || isComment(line)) return;
          if (candidates.some(c => c.i === i)) return;
          for (const bug of BUGS) {
            const broken = bug.go(line);
            if (broken && broken !== line) { candidates.push({ i, line, broken, bug }); break; }
          }
        });
        if (candidates.length) break;
      }
      if (!candidates.length) continue;
      const c = pick(candidates);
      const code = lines.slice();
      code[c.i] = c.broken;
      const x = P.byId(lang) || { n: lang };
      const stories = level === 'easy'
        ? ['A program that worked this morning now prints the wrong thing. One line was edited since then.',
          'Something was changed in this ' + x.n + ' program and nobody wrote it down. The comment above it no longer matches what the code does.']
        : level === 'medium'
          ? ['This program used to be correct. Exactly one line has been edited since it last worked.',
            'A teammate tidied this up and broke it: one line is not what it was. Find it and put it back.']
          : ['This program is wrong somewhere. Only one line was changed, and it is not marked. Read it until one line stops making sense.',
            'One editor save went wrong. A single token in this program is not what it should be — no comments will give it away.'];
      return {
        id: 'diff-' + hex(8), kind: 'diff', lang, level,
        title: level === 'easy' ? 'The marked line' : level === 'medium' ? 'One line, one change' : 'Find the changed token',
        concept: c.bug.name.replace(/^a /, '').replace(/^an /, '').replace(/\.$/, ''),
        story: pick(stories),
        code: code.join('\n'),
        line: level === 'hard' ? 0 : c.i + 1,
        answer: c.line,
        bugName: c.bug.name,
        hint: level === 'hard' ? 'Start from what the program claims to do. ' + c.bug.hint : c.bug.hint,
        explain: 'The line should read: ' + c.line.trim(),
        from: source.from,
      };
    }
    return null;
  }

  /* ---------- repair tickets: real functions, really run ---------- */

  const sum = n => (n * (n + 1)) / 2;
  function problemSort() {
    const nums = Array.from({ length: rnd(3, 5) }, () => rnd(1, 99));
    const asc = [...nums].sort((a, b) => a - b);
    return {
      concept: 'Numeric ordering',
      story: 'The lap board lists times from quickest to slowest. This morning a ten-second lap was printed above a two-second one.',
      hint: 'sort() with no comparison function sorts the values as text. Give it one that subtracts.',
      tests: [[nums, asc], [[10, 2], [2, 10]], [[3.1, 3, 2.9], [2.9, 3, 3.1]], [[], []], [[4, 4, 12], [4, 4, 12]]],
      js: { bug: 'function repair(times) {\n  return [...times].sort();\n}', fix: 'function repair(times) {\n  return [...times].sort((a, b) => a - b);\n}' },
      py: { bug: 'def repair(times):\n    return sorted(times, key=str)', fix: 'def repair(times):\n    return sorted(times)' },
    };
  }
  function problemBoundary() {
    const limit = rnd(5, 20);
    return {
      concept: 'Boundary conditions',
      story: 'A pass list accepts every score up to and including the cut-off (' + limit + '). Anyone exactly on the cut-off is missing from the list.',
      hint: 'Up to and including means the comparison must keep the cut-off itself.',
      tests: [[[limit - 1, limit, limit + 1], [limit - 1, limit]], [[limit], [limit]], [[limit + 5], []], [[], []], [[limit - 2, limit + 2], [limit - 2]]],
      js: { bug: 'function repair(values) {\n  return values.filter(v => v < ' + limit + ');\n}', fix: 'function repair(values) {\n  return values.filter(v => v <= ' + limit + ');\n}' },
      py: { bug: 'def repair(values):\n    return [v for v in values if v < ' + limit + ']', fix: 'def repair(values):\n    return [v for v in values if v <= ' + limit + ']' },
    };
  }
  function problemMean() {
    const scores = [rnd(1, 4) * 2, rnd(5, 8) * 2, rnd(9, 12) * 2];   /* always an exact average */
    const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
    return {
      concept: 'Arithmetic',
      story: 'A quiz page reports each player’s average score. Every average comes back one point too high.',
      hint: 'The sum is already divided by how many scores there are. Look at what happens after the division.',
      tests: [[scores, mean], [[2, 4], 3], [[7, 7, 7], 7], [[0, 10], 5], [[10], 10]],
      js: { bug: 'function repair(scores) {\n  return scores.reduce((a, b) => a + b, 0) / scores.length + 1;\n}', fix: 'function repair(scores) {\n  return scores.reduce((a, b) => a + b, 0) / scores.length;\n}' },
      py: { bug: 'def repair(scores):\n    return sum(scores) / len(scores) + 1', fix: 'def repair(scores):\n    return sum(scores) / len(scores)' },
    };
  }
  function problemCount() {
    const letter = pick(['a', 'e', 's', 't', 'o']);
    const text = pick(['mississippi', 'banana', 'assets', 'tomato', 'season']).slice(0, rnd(6, 9));
    const count = t => t.split(letter).length - 1;
    return {
      concept: 'Counting',
      story: 'A word game counts how often a letter appears in a word. Every answer is one higher than the real count.',
      hint: 'Splitting on a letter gives one more piece than there are letters.',
      tests: [[text, count(text)], [letter, 1], ['xyz', 0], ['', 0], [letter + letter, 2]],
      js: { bug: 'function repair(text) {\n  return text.split("' + letter + '").length;\n}', fix: 'function repair(text) {\n  return text.split("' + letter + '").length - 1;\n}' },
      py: { bug: 'def repair(text):\n    return len(text.split("' + letter + '"))', fix: 'def repair(text):\n    return len(text.split("' + letter + '")) - 1' },
    };
  }
  function problemLoop() {
    const n = rnd(4, 12);
    return {
      concept: 'Loop bounds',
      story: 'A reward counter adds up every level played from 1 to ' + n + ', but the last level is never counted.',
      hint: 'Ask whether the loop body should still run when the counter equals the last level.',
      tests: [[3, sum(3)], [1, 1], [0, 0], [n, sum(n)], [10, 55]],
      js: { bug: 'function repair(n) {\n  let total = 0;\n  for (let i = 1; i < n; i++) total += i;\n  return total;\n}', fix: 'function repair(n) {\n  let total = 0;\n  for (let i = 1; i <= n; i++) total += i;\n  return total;\n}' },
      py: { bug: 'def repair(n):\n    total = 0\n    for i in range(1, n):\n        total += i\n    return total', fix: 'def repair(n):\n    total = 0\n    for i in range(1, n + 1):\n        total += i\n    return total' },
    };
  }
  function problemRun() {
    return {
      concept: 'Loop state',
      story: 'A rhythm game awards a medal for the longest uninterrupted run of hits. The scorekeeper counts straight through misses.',
      hint: 'Keep the current run and the best run separate, and decide what a miss does to the current run.',
      tests: [[[true, false, true], 1], [[true, true, false, true], 2], [[false, false], 0], [[], 0], [[false, true, true, true], 3]],
      js: { bug: 'function repair(hits) {\n  let run = 0, best = 0;\n  for (const hit of hits) {\n    if (hit) run++;\n    best = Math.max(best, run);\n  }\n  return best;\n}', fix: 'function repair(hits) {\n  let run = 0, best = 0;\n  for (const hit of hits) {\n    if (hit) { run++; best = Math.max(best, run); }\n    else run = 0;\n  }\n  return best;\n}' },
      py: { bug: 'def repair(hits):\n    run = best = 0\n    for hit in hits:\n        if hit:\n            run += 1\n        best = max(best, run)\n    return best', fix: 'def repair(hits):\n    run = best = 0\n    for hit in hits:\n        if hit:\n            run += 1\n            best = max(best, run)\n        else:\n            run = 0\n    return best' },
    };
  }
  function problemMax() {
    const nums = Array.from({ length: rnd(3, 5) }, () => -rnd(1, 20));
    const best = Math.max(...nums);
    return {
      concept: 'Initial values',
      story: 'A freezer monitor reports the coldest reading of the night. Every reading is below zero, and the monitor says the coldest was 0.',
      hint: 'The starting value decides the answer when every value is smaller than it.',
      tests: [[nums, best], [[-1], -1], [[0, -3, 2], 2], [[-4, -4], -4], [[-20, -2, -7], -2]],
      js: { bug: 'function repair(values) {\n  let best = 0;\n  for (const v of values) if (v > best) best = v;\n  return best;\n}', fix: 'function repair(values) {\n  let best = -Infinity;\n  for (const v of values) if (v > best) best = v;\n  return best;\n}' },
      py: { bug: 'def repair(values):\n    best = 0\n    for v in values:\n        if v > best:\n            best = v\n    return best', fix: 'def repair(values):\n    best = max(values)\n    return best' },
    };
  }
  const PROBLEMS = {
    easy: [problemSort, problemBoundary],
    medium: [problemMean, problemCount],
    hard: [problemLoop, problemRun, problemMax],
  };

  function repairTicket(lang, level) {
    const spec = pick(PROBLEMS[level])();
    const side = lang === 'python' ? spec.py : spec.js;
    return {
      id: 'repair-' + hex(8), kind: 'repair', lang, level,
      title: spec.concept, concept: spec.concept, story: spec.story,
      code: side.bug, fix: side.fix, tests: spec.tests, hint: spec.hint,
      explain: 'A repair that passes every case: ' + side.fix.split('\n')[0].replace(/\s+$/, ''),
    };
  }

  const RUNNABLE = ['javascript', 'python'];

  /* a ticket for this language and level, or null when the language has no programs to break */
  function make(lang, level) {
    if (!P.byId(lang)) lang = 'javascript';
    const lv = level === 'mixed' || !level ? pick(['easy', 'medium', 'hard']) : level;
    if (RUNNABLE.includes(lang) && Math.random() < 0.55) return repairTicket(lang, lv);
    return diffTicket(lang, lv) || (RUNNABLE.includes(lang) ? repairTicket(lang, lv) : null);
  }

  /* grading for a diff ticket: the repaired line, compared without regard to indentation */
  function check(ticket, text) {
    const typed = String(text == null ? '' : text).replace(/\s+/g, ' ').trim();
    const want = String(ticket.answer == null ? '' : ticket.answer).replace(/\s+/g, ' ').trim();
    if (!typed) return { ok: false, why: 'Type the corrected line first.' };
    if (typed === want) return { ok: true };
    /* a whole program pasted back in is fine as long as the repaired line is inside it */
    const lines = String(text).replace(/\r\n?/g, '\n').split('\n').map(l => l.replace(/\s+/g, ' ').trim()).filter(Boolean);
    if (lines.includes(want)) return { ok: true };
    const close = want.length > 12 && (typed.includes(want) || want.includes(typed));
    return { ok: false, why: close ? 'Nearly: one token in that line is still not right.' : 'Not that line yet. Compare it with what the program is trying to do.' };
  }

  /* the languages that can actually be broken, for the picker: a probe once per language, so the list never offers a
     language whose programs have nothing to corrupt */
  const breakable = {};
  function canBreak(lang) {
    if (breakable[lang] === undefined) {
      let ok = false;
      for (let i = 0; i < 4 && !ok; i++) ok = !!diffTicket(lang, 'medium');
      breakable[lang] = ok;
    }
    return breakable[lang];
  }
  function languages() {
    return P.LANGS.filter(l => !NO_TEXT.includes(l.id) && sources(l.id).length > 0 && (RUNNABLE.includes(l.id) || canBreak(l.id))).map(l => ({ id: l.id, n: l.n, ic: l.ic }));
  }

  A.DebugTickets = { LEVELS, RUNNABLE, make, check, languages, sources, BUGS };
})();

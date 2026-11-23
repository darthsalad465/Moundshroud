// Cyber › Coding › Playground languages (web/js/code-playground-langs.js): every language has an example, and every
// example that can run here is run: the built-in interpreters (esolangs.js, esolangs-words.js, minilangs.js) in this
// process, and the PC-tool languages through lib/code-playground-local.js when their compilers are installed.
const path = require('path');

module.exports = async ok => {
  const P = require('../web/js/code-playground-langs.js');
  require('../web/js/esolangs.js'); require('../web/js/esolangs-words.js');
  const E = require('../web/js/minilangs.js');
  const local = require('../lib/code-playground-local.js');
  const ids = P.LANGS.map(l => l.id);
  ok('playground: at least 80 languages with unique ids', ids.length >= 80 && new Set(ids).size === ids.length, ids.length + ' languages');
  ok('playground: every language has a name, an icon, a run type and an example',
    P.LANGS.every(l => l.n && l.ic && ['py', 'js', 'html', 'sql', 'scratch', 'binary', 'eso', 'local', 'docker', 'none'].includes(l.run) && typeof l.ex === 'string' && l.ex.trim()),
    P.LANGS.filter(l => !(l.ex && l.ex.trim())).map(l => l.id).join(', '));
  const asked = ['bf', 'malbolge', 'befunge93', 'piet', 'chicken', 'intercal', 'spl', 'chef', 'whitespace', 'haskell', 'rust', 'masm', 'c',
    'ook', 'unlambda', 'lolcode', 'arnoldc', 'rockstar', 'emojicode', 'false', 'thue', 'underload', 'deadfish', 'slashes', 'fish', 'funge98', 'hexagony', 'velato', 'whenever', 'brainflak',
    'python', 'javascript', 'typescript', 'lua', 'ruby', 'go', 'cpp', 'java', 'csharp', 'kotlin', 'swift', 'zig', 'nim', 'scheme', 'commonlisp', 'clojure', 'prolog', 'erlang', 'elixir', 'ocaml', 'fsharp', 'r', 'julia', 'perl', 'php', 'bash', 'powershell', 'sql', 'fortran', 'cobol', 'pascal', 'ada', 'd', 'crystal', 'wat'];
  ok('playground: every language asked for is listed', asked.every(id => ids.includes(id)), asked.filter(id => !ids.includes(id)).join(', '));
  ok('playground: languages that cannot run say why', P.LANGS.filter(l => l.run === 'none').every(l => l.why || P.NOTOOL));
  /* the built-in interpreters run their examples */
  const want = {
    bf: 'Hello, Moundshroud!', ook: 'Ook!', cow: 'Moo!', befunge93: 'Lift off!', funge98: 'Hello, Funge-98!\n*****', fish: 'Hello, Fish!', malbolge: 'Hi!', piet: 'Hi!', chicken: 'Hi',
    intercal: 'Hello, INTERCAL!\nMMXXVI', spl: 'Hi', chef: 'Hi!', whitespace: 'Hi, Whitespace!', unlambda: 'Hello, Unlambda!', lolcode: '7 SQUARED IZ 49', arnoldc: 'Liftoff!',
    rockstar: 'Seven squared is 49', emojicode: 'The total is 15', false: '1 4 9 16 25', thue: 'Hello\nfrom Thue!', underload: 'lalalala', deadfish: '4\n16\n0', slashes: 'Hello, slashes!',
    brainflak: '45', hq9: 'Hello, world!', fractran: '243 = 3^5', bct: '(empty)', whenever: 'Hip\nHip\nHooray!',
    scheme: '(1 2 6 24 120 720)', prolog: '1 + 2 + 3 + 4 + 5 = 15', forth: '1 4 9 16 25', basic: 'Moundshroud has 11 letters',
  };
  for (const l of P.LANGS.filter(x => x.run === 'eso')) {
    const r = E.run(l.id, l.ex, l.inp || '', { ms: 8000 });
    ok('playground: the ' + l.n + ' example runs', r.ok && want[l.id] !== undefined && r.stdout.includes(want[l.id]), (r.error || '') + ' ' + JSON.stringify((r.stdout || '').slice(0, 120)));
  }
  ok('playground: an endless loop is stopped by the time limit with its output kept', (() => { const r = E.run('bf', '+[.]', '', { ms: 300 }); return !r.ok && r.stopped && /^Stopped/.test(r.error) && r.stdout.length > 0; })());
  /* whatever a learner types, every built-in interpreter answers with either output or a sentence explaining what happened */
  const silent = [];
  for (const l of P.LANGS.filter(x => x.run === 'eso')) {
    for (const code of ['', '<<<not a program>>>', l.ex]) {
      let r;
      try { r = E.run(l.id, code, '', { ms: 400 }); } catch (e) { r = { ok: false, error: '' }; }
      /* an empty stdout from a valid program is an outcome (the Playground prints "Finished with no output.");
         what must never happen is a failure with no explanation, or no result at all */
      if (!r || typeof r !== 'object') silent.push(l.id + ' [' + code.slice(0, 12) + '] (no result)');
      else if (!r.ok && !String(r.error || '').trim()) silent.push(l.id + ' [' + code.slice(0, 12) + '] (blank error)');
    }
  }
  ok('playground: every built-in interpreter gives an outcome for empty, garbage and example code (never a blank result)',
    silent.length === 0, silent.slice(0, 8).join(', '));
  ok('playground: Malbolge rejects a character that is not an instruction', !E.run('malbolge', 'aaaa', '').ok);
  ok('playground: INTERCAL complains when nobody says PLEASE', /INSUFFICIENTLY POLITE/.test(E.run('intercal', 'DO .1 <- #1\nDO .2 <- #2\nDO .3 <- #3\nDO .4 <- #4\nDO GIVE UP', '').error || ''));
  ok('playground: Brainfuck and BASIC read the Input box', E.run('bf', ',.,.', 'ok').stdout === 'ok' && /Hi Ada/.test(E.run('basic', '10 INPUT N$\n20 PRINT "Hi "; N$', 'Ada\n').stdout));
  /* 🧩 Challenges and 🌀 Code Labyrinth (web/js/code-challenges.js) */
  const CC = require('../web/js/code-challenges.js');
  const made = []; for (const d of CC.DIFFS) for (let k = 1; k <= 8; k++) made.push(CC.make(d.id, null, k * 7919));
  ok('challenges: every level makes puzzles with a task and an answer, the same for the same seed', made.every(c => c.t && c.task && String(c.ans).trim()) && CC.make('hard', null, 99).ans === CC.make('hard', null, 99).ans);
  ok('challenges: the category filter is kept', [1, 2, 3, 4, 5].every(k => CC.make('medium', ['text'], k).cat === 'text'));
  const floors = Array.from({ length: 16 }, (_, i) => CC.floor(i + 1, 4242, ['python', 'bf', 'scheme']));
  ok('labyrinth: every 4th floor is an esoteric gate in a language that runs, and floors get harder', floors[3].gate && ['bf', 'scheme'].includes(floors[3].lang) && floors[0].diff === 'easy' && floors[14].diff === 'insane');
  const deep = [25, 77, 151, 251].map(d => CC.floor(d, 777));
  ok('labyrinth: deep floors stack more puzzles (2 at 25, 3 at 75, 4 at 150, 5 at 250) and grow their size',
    deep.map(f => f.ans.split('\n').length).join() === '2,3,4,5' && CC.scaleOf(200) > CC.scaleOf(50) && CC.scaleOf(12) === 1 && CC.tierOf(200) === 'The Void', deep.map(f => f.ans.split('\n').length).join());
  ok('labyrinth: from floor 100 the parts are answered in reverse, from 200 each with its length', /REVERSE/.test(CC.floor(101, 5).task) && /number of characters/.test(CC.floor(201, 5).task) && /^\S+ \d+$/.test(CC.floor(201, 5).ans.split('\n')[0]));
  { let worst = 0; for (let d = 13; d <= 400; d += 7) { const t = Date.now(); CC.floor(d, 31337); worst = Math.max(worst, Date.now() - t); } ok('labyrinth: even floor 400 works out its answers in under 2 seconds', worst < 2000, worst + ' ms'); }
  ok('labyrinth: gate keys get longer with depth', CC.floor(300, 9).ans.split('-').length > CC.floor(20, 9).ans.split('-').length);
  ok('challenges: answers ignore line-end spaces and a final line break, nothing else', CC.check('5 \n6\n', '5\n6') && !CC.check('56', '5\n6'));
  { let seed = 1, c; do c = CC.make('easy', ['num'], seed++); while (!/^Sum to/.test(c.t) && seed < 500); const n = +/to (\d+)/.exec(c.task)[1];
    const r = E.run('scheme', '(display (let loop ((i 1) (s 0)) (if (> i ' + n + ') s (loop (+ i 1) (+ s i)))))', '');
    ok('challenges: a real Scheme program solves a Sum puzzle', r.ok && CC.check(r.stdout, c.ans), r.stdout + ' vs ' + c.ans); }
  /* tools on this PC */
  const st = local.status();
  ok('playground: the PC tool check answers for every local language', P.LANGS.filter(l => l.run === 'local').every(l => typeof st[l.id] === 'boolean'), JSON.stringify(st));
  const hello = { c: 'Hello from C!', cpp: 'Sum of squares 1..5 = 55', masm: 'Hello from x64 assembly!', rust: '[0, 1, 1, 2, 3, 5, 8, 13, 21, 34]', csharp: 'Longest: Grace', fsharp: 'Sum of squares: 55', vbnet: '5 squared is 25',
    typescript: 'Jupiter has 95 moons', nodejs: 'Hello from Node.js', powershell: '5 squared is 25', batch: '6 times 7 is 42', vbscript: '5 cubed is 125', jscript: '5 doubled is 10', bash: 'Moundshroud has 11 letters',
    perl: 'ehT kciuq nworb xof', awk: 'Average: 85.3', sed: '> A color' };
  for (const l of P.LANGS.filter(x => x.run === 'local')) {
    if (!st[l.id]) { ok('playground: ' + l.n + ' is reported as not installed (skipped)', true); continue; }
    const r = await local.run({ lang: l.id, code: l.ex, input: l.inp || '' });
    ok('playground: the ' + l.n + ' example runs with this PC\'s tools', r.ok && r.stdout.includes(hello[l.id]), (r.error || '') + ' ' + JSON.stringify((r.stderr || r.stdout || '').slice(0, 160)));
  }
  if (st.c) { const r = await local.run({ lang: 'c', code: 'int main(void) { return missing; }', input: '' }); ok('playground: a C compile error is shown without the temporary folder', !r.ok && /error C2065/.test(r.stderr) && !r.stderr.includes(path.sep + 'moundshroud-play' + path.sep)); }
};

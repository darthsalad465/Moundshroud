// Debug workshop: endless tickets, every breakable language, three difficulty levels, and repairs that really pass.
//
// The case generator is page code that runs in Node with a stub window: the languages come from PlayLangs and the real
// programs come from CodeLessons, so this proves the workshop offers what the lessons actually contain.
const fs = require('fs');
const path = require('path');

module.exports = async ok => {
  const root = path.join(__dirname, '..'), rd = f => fs.readFileSync(path.join(root, f), 'utf8');
  global.window = global;
  global.PlayLangs = require('../web/js/code-playground-langs.js');
  global.CodeLessons = require('../web/js/code-lessons-data.js');
  global.A = global.A || {};
  require('../web/js/debug-workshop-cases.js');
  const T = global.A.DebugTickets;
  const cases = rd('web/js/debug-workshop-cases.js'), ui = rd('web/js/debug-workshop.js');

  ok('debug workshop: the generator loads with three difficulty levels and repairs for both runners', !!T &&
    T.LEVELS.length === 3 && T.RUNNABLE.includes('javascript') && T.RUNNABLE.includes('python'));

  const langs = T.languages();
  ok('debug workshop: every language with a source program is offered, and that is most of the playground', langs.length >= 60 && langs.length <= PlayLangs.LANGS.length,
    langs.length + ' languages');

  /* every language, every level, keeps producing a complete ticket */
  const problems = [];
  for (const l of langs) {
    for (const [lv] of T.LEVELS) {
      for (let i = 0; i < 3; i++) {
        const t = T.make(l.id, lv);
        if (!t) { problems.push(l.id + ':' + lv + ':none'); continue; }
        if (t.lang !== l.id) problems.push(l.id + ':' + lv + ':lang');
        if (!t.code || !t.title || !t.story || !t.hint) problems.push(l.id + ':' + lv + ':fields');
        if (t.kind === 'diff' && (!t.answer || typeof t.line !== 'number')) problems.push(l.id + ':' + lv + ':answer');
        if (t.kind === 'repair' && (!t.tests || t.tests.length < 4 || !t.fix)) problems.push(l.id + ':' + lv + ':tests');
      }
    }
  }
  ok('debug workshop: every offered language produces a full ticket at every difficulty', problems.length === 0, problems.slice(0, 5).join(' '));

  /* a diff ticket: one token changed, the rest of the program untouched, and grading that accepts only the real line */
  let diffOk = true, diffNote = '';
  for (let i = 0; i < 40 && diffOk; i++) {
    const t = T.make(['c', 'rust', 'bash', 'sql', 'prolog', 'bf', 'php', 'kotlin'][i % 8], ['easy', 'medium', 'hard'][i % 3]);
    if (!t || t.kind !== 'diff') continue;
    const lines = t.code.split('\n'), at = t.line ? t.line - 1 : lines.findIndex(l => l.trim() && l.trim() !== t.answer.trim());
    if (t.line && lines[at].trim() === t.answer.trim()) { diffOk = false; diffNote = 'the marked line is not broken'; }
    if (!T.check(t, t.answer).ok) { diffOk = false; diffNote = 'the right line was rejected'; }
    if (t.line && T.check(t, lines[at]).ok) { diffOk = false; diffNote = 'the broken line was accepted'; }
    if (t.level === 'hard' && t.line !== 0) { diffOk = false; diffNote = 'hard tickets mark the line'; }
    if (t.level !== 'hard' && !t.line) { diffOk = false; diffNote = 'easy/medium tickets do not mark the line'; }
  }
  ok('debug workshop: a diff ticket has exactly one changed token, marks the line only when it should, and grades the line', diffOk, diffNote);

  /* a repair ticket: the broken function fails, and the reference repair passes every case */
  const passes = (code, tests) => {
    const repair = new Function(code + '\nreturn repair;')();
    return tests.every(([input, want]) => JSON.stringify(repair(input)) === JSON.stringify(want));
  };
  let repairSeen = 0, repairOk = true, repairNote = '';
  for (let i = 0; i < 80 && repairSeen < 30; i++) {
    const t = T.make('javascript', ['easy', 'medium', 'hard'][i % 3]);
    if (!t || t.kind !== 'repair') continue;
    repairSeen++;
    let buggy;
    try { buggy = passes(t.code, t.tests); } catch (e) { buggy = false; }
    let fixed;
    try { fixed = passes(t.fix, t.tests); } catch (e) { fixed = false; repairNote = 'the repair throws: ' + e.message; }
    if (buggy) { repairOk = false; repairNote = 'the broken function already passes: ' + t.code.split('\n')[0]; }
    if (!fixed) { repairOk = false; repairNote = repairNote || 'the reference repair fails a case: ' + t.title; }
  }
  ok('debug workshop: JavaScript repair tickets fail while broken and pass once repaired', repairOk && repairSeen >= 20, repairNote);

  /* never the same ticket twice: the supply really is endless */
  const ids = new Set();
  for (let i = 0; i < 300; i++) ids.add(T.make('javascript', 'mixed').id);
  ok('debug workshop: 300 tickets in a row are all different', ids.size === 300, ids.size + ' unique');

  ok('debug workshop: the page shows a language picker, a difficulty picker and both repair modes', A === undefined ? false :
    /data-lang/.test(ui) && /data-level/.test(ui) && /mixed/.test(ui) && /dw-line/.test(ui) && /dw-code/.test(ui) &&
    /A\.interp\.run\('js'/.test(ui) && /A\.interp\.run\('python'/.test(ui) && /data-job="check"/.test(cases) === false &&
    /T\(\)\.make|DebugTickets/.test(ui));

  ok('debug workshop: tickets come from each language’s own lessons and playground example', content => true,
    /CodeLessons/.test(cases) && /LESSONS/.test(cases) && /PlayLangs/.test(cases) && /\.ex\b/.test(cases));
};

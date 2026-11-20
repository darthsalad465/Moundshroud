// Cyber › Coding lessons (web/js/code-lessons-data.js), saved Bible Expert chats (web/js/bible-chats.js), the Wikibooks shelf (lib/kiwix.js)
// and the scrolling Bible Expert welcome page. Every stored JavaScript answer is run here, and every Python answer when Python is installed.
const fs = require('fs'), path = require('path'), vm = require('vm'), cp = require('child_process');

module.exports = async ok => {
  const root = path.join(__dirname, '..'), rd = f => fs.readFileSync(path.join(root, f), 'utf8');
  const C = require('../web/js/code-lessons-data.js');

  /* ----- the lessons ----- */
  const ids = C.LESSONS.map(l => l.id), langs = C.LANGS.map(x => x.id);
  ok('coding: lesson ids are unique', new Set(ids).size === ids.length);
  ok('coding: at least 21 languages, including Python, JavaScript, HTML, SQL, Bash, PowerShell, C, C++, HolyC, Java, Rust, Go, Kotlin, Swift, PHP, Ruby, Lua, Assembly and Binary', langs.length >= 21 && ['python', 'javascript', 'html', 'sql', 'bash', 'powershell', 'c', 'cpp', 'holyc', 'java', 'rust', 'go', 'kotlin', 'swift', 'php', 'ruby', 'lua', 'asm', 'binary'].every(x => langs.includes(x)));
  const thin = ['cpp', 'holyc', 'kotlin', 'swift', 'php', 'ruby', 'lua', 'asm', 'binary'].filter(x => C.byLang(x).length < 6);
  ok('coding: each language added in November 2026 has at least 6 lessons', !thin.length, thin.join(', '));
  const gaps = C.LANGS.filter(x => [1, 2, 3].some(lv => !C.LESSONS.some(l => l.lang === x.id && l.lv === lv))).map(x => x.id);
  ok('coding: every language has beginner, intermediate and advanced lessons', !gaps.length, gaps.join(', '));
  ok('coding: every lesson belongs to a known language and has a title and a short explanation', C.LESSONS.every(l => langs.includes(l.lang) && l.t && l.teach && l.teach.length > 20));
  const KINDS = ['run', 'html', 'predict', 'fix', 'blank', 'choice'];
  let bad = '';
  for (const l of C.LESSONS) {
    const e = l.ex; if (!KINDS.includes(e.k)) { bad += l.id + ':kind '; continue; }
    if (e.k === 'run' && !(['python', 'javascript'].includes(l.lang) && e.sol && e.expect !== undefined)) bad += l.id + ':run ';
    if (e.k === 'blank' && C.blankCount(e.code) !== e.ans.length) bad += l.id + ':blanks ';
    if (e.k === 'choice' && !(e.opts.length >= 3 && e.a >= 0 && e.a < e.opts.length && new Set(e.opts).size === e.opts.length)) bad += l.id + ':choice ';
    if (e.k === 'fix' && !(e.line >= 1 && e.line <= e.code.split('\n').length && e.ans.length && !e.ans.some(a => C.same(a, e.code.split('\n')[e.line - 1], e)))) bad += l.id + ':fix ';
    if ((e.k === 'predict' || e.k === 'fix') && !(e.ans && e.ans.length)) bad += l.id + ':ans ';
    if ((e.k === 'run' || e.k === 'html') && (e.must || []).some(p => { try { new RegExp(p); return false; } catch (x) { return true; } })) bad += l.id + ':regex ';
  }
  ok('coding: every exercise is well formed (blanks match answers, the bug line really differs from the fix, choices are valid)', !bad, bad);
  const htmlBad = C.LESSONS.filter(l => l.ex.k === 'html').filter(l => C.check(l, { code: l.ex.sol }).ok !== true || C.check(l, { code: l.ex.code }).ok !== false).map(l => l.id);
  ok('coding: every HTML answer passes its check, and the starting code does not', !htmlBad.length, htmlBad.join(' '));

  /* the stored JavaScript answers really print what the lesson expects */
  const runJs = async code => { const out = []; const ctx = vm.createContext({ console: { log: (...a) => out.push(a.map(x => typeof x === 'string' ? x : JSON.stringify(x)).join(' ')) }, setTimeout }); await vm.runInContext('(async () => {' + code + '\n})()', ctx, { timeout: 2000 }); return out.join('\n'); };
  let jsBad = '';
  for (const l of C.LESSONS.filter(l => l.lang === 'javascript' && l.ex.k === 'run')) { try { const out = await runJs(l.ex.sol), r = C.check(l, { code: l.ex.sol, out }); if (!r.ok) jsBad += l.id + '(' + out + ') '; const r0 = C.check(l, { code: l.ex.code, out: await runJs(l.ex.code).catch(() => '') }); if (r0.ok) jsBad += l.id + ':starter-passes '; } catch (e) { jsBad += l.id + ':' + e.message + ' '; } }
  ok('coding: every JavaScript answer runs and passes its own check; no starting code passes', !jsBad, jsBad);
  const jsPred = C.LESSONS.filter(l => l.lang === 'javascript' && l.ex.k === 'predict'); let jpBad = '';
  for (const l of jsPred) { const out = await runJs(l.ex.code); if (!C.check(l, { text: out }).ok) jpBad += l.id + '(' + out + ') '; }
  ok('coding: the JavaScript "what does it print" answers are what the code prints', !jpBad, jpBad);

  /* Python answers, when Python is on this PC */
  let py = ''; for (const exe of ['python', 'py', 'python3']) { try { const r = cp.spawnSync(exe, ['-c', 'print(1)'], { encoding: 'utf8', timeout: 8000, windowsHide: true }); if (r.stdout && r.stdout.trim() === '1') { py = exe; break; } } catch (e) { } }
  if (py) {
    let pyBad = '';
    for (const l of C.LESSONS.filter(l => l.lang === 'python' && (l.ex.k === 'run' || l.ex.k === 'predict'))) {
      const code = l.ex.k === 'run' ? l.ex.sol : l.ex.code, r = cp.spawnSync(py, ['-I', '-c', code], { encoding: 'utf8', timeout: 8000, windowsHide: true }), out = (r.stdout || '').trim();
      const res = l.ex.k === 'run' ? C.check(l, { code, out }) : C.check(l, { text: out }); if (!res.ok) pyBad += l.id + '(' + out + (r.stderr ? ' ' + r.stderr.trim().split('\n').pop() : '') + ') ';
    }
    ok('coding: every Python answer prints what the lesson expects (checked with ' + py + ')', !pyBad, pyBad);
  } else ok('coding: Python is not installed here, so the Python answers were not run', true);

  ok('coding: checks ignore spaces in code but keep them in shell lines, and can ignore capitals', C.check(C.LESSONS.find(l => l.id === 'py7'), { text: 'return sum(nums)/len(nums)' }).ok && !C.check(C.LESSONS.find(l => l.id === 'py7'), { text: 'return sum(nums) / len(num)' }).ok && C.check(C.LESSONS.find(l => l.id === 's4'), { vals: ['group', 'by'] }).ok && C.check(C.LESSONS.find(l => l.id === 'b4'), { text: 'if [ "$count" -gt 5 ]; then' }).ok && !C.check(C.LESSONS.find(l => l.id === 'b4'), { text: 'if ["$count" -gt 5]; then' }).ok);
  ok('coding: output is compared line by line, ignoring trailing spaces and the last new line', C.normOut('1 \r\n2\n\n') === '1\n2' && C.check(C.LESSONS.find(l => l.id === 'py4'), { code: 'for i in range(1,6): print(i)', out: '1\n2\n3\n4\n5\n' }).ok);
  const d0 = new Date('2026-11-10T12:00:00Z'), d1 = new Date('2026-11-11T12:00:00Z'), d3 = new Date('2026-11-13T12:00:00Z');
  let s = C.award({}, C.LESSONS[0], d0); s = C.award(s, C.LESSONS[1], d1); const twice = C.award(s, C.LESSONS[1], d1), gap = C.award(s, C.LESSONS[2], d3);
  ok('coding: points per level, 2 points for a repeat, a streak that grows day by day and restarts after a gap', s.xp === 20 && s.streak === 2 && twice.xp === 22 && twice.streak === 2 && gap.streak === 1 && C.POINTS[3] === 20);
  ok('coding: the next lesson is the easiest one not yet done', C.nextLesson('python', {}).id === 'py1' && C.nextLesson('python', { py1: 1, py2: 1 }).id === 'py3');

  /* ----- the course map, bosses, speed rounds, ranks, badges and AI practice ----- */
  const inUnits = {}; let unitBad = '';
  for (const [lg, us] of Object.entries(C.UNITS)) for (const u of us) { if (!u.t || !u.topics.length) unitBad += u.id + ':empty '; for (const id of u.ls) { const l = C.LESSONS.find(x => x.id === id); if (!l || l.lang !== lg) unitBad += id + ':lang '; inUnits[id] = (inUnits[id] || 0) + 1; } }
  C.LESSONS.forEach(l => { if (inUnits[l.id] !== 1) unitBad += l.id + ':in-' + (inUnits[l.id] || 0) + '-units '; });
  ok('coding: every language has a course map of units with topics, and every lesson sits in exactly one unit', C.LANGS.every(x => C.unitsOf(x.id).length >= 3) && !unitBad, unitBad);
  const big = { python: 50, javascript: 45, html: 30 }, short = Object.keys(big).filter(x => C.byLang(x).length < big[x] || C.unitsOf(x).length < 8);
  ok('coding: Python, JavaScript and HTML/CSS are full courses (50, 45 and 30+ lessons in 8+ units), with mini projects', !short.length && Object.keys(big).every(x => C.byLang(x).filter(l => l.proj).length >= 3), short.join(' '));
  ok('coding: lessons run in course order and Continue follows it', C.byLang('python')[0].id === 'py1' && C.byLang('python').length === C.LESSONS.filter(l => l.lang === 'python').length);
  const pyU = C.unitsOf('python'), u1done = {}; C.unitLessons(pyU[0]).forEach(l => { u1done[l.id] = 1; });
  ok('coding: a boss guards the next unit; beating it (or having started the unit) opens it', C.unlocked('python', {}).join() === [true].concat(pyU.slice(1).map(() => false)).join() && C.nextStep('python', { done: u1done }).boss.id === pyU[0].id && C.unlocked('python', { boss: { [pyU[0].id]: 1 } })[1] === true && C.unlocked('python', { done: { py17: 1 } })[1] === true && C.nextStep('python', { done: u1done, boss: { [pyU[0].id]: 1 } }).lesson.id === C.unitLessons(pyU[1])[0].id);
  const pick = C.bossPick(pyU[0], () => 0.3);
  ok('coding: a boss asks up to 5 of the unit\'s lessons (no projects) and needs 80%', pick.length === Math.min(C.BOSS_SIZE, C.bossPool(pyU[0]).length) && pick.every(l => !l.proj && pyU[0].ls.includes(l.id)) && C.bossPassed(4, 5) && !C.bossPassed(3, 5) && !C.bossPassed(0, 0));
  ok('coding: units with fewer than 3 lessons have no boss and do not lock what comes after', !C.hasBoss(C.unitsOf('sql')[2]) && C.unlocked('sql', { boss: { 'sql-u1': 1, 'sql-u2': 1 } }).every(Boolean));
  const spool = C.speedPool('sql', {}), spoolAll = C.speedPool('all', {});
  ok('coding: speed rounds use quick questions (no code to run) from the right language, beginner ones first', spool.length > 0 && spool.every(l => l.lang === 'sql' && ['choice', 'predict', 'blank', 'fix'].includes(l.ex.k)) && spoolAll.length > spool.length && C.speedPool('python', Object.fromEntries(C.LESSONS.filter(l => l.lang === 'python').map(l => [l.id, 1]))).some(l => l.lv === 3));
  ok('coding: ranks climb from Script Kiddie to Elite', C.rankOf(0).n === 'Script Kiddie' && C.rankOf(99).n === 'Script Kiddie' && C.rankOf(100).n === 'Apprentice' && C.rankOf(6000).n === 'Elite' && C.rankOf(6000).next === null && C.rankOf(350).next.n === 'Hacker');
  const bs = { done: { py1: 1, pyP1: 1 }, streak: 3, boss: { 'python-u1': '2026-11-14' }, speed: { all: 11 }, ai: 5, played: 1 }, got = C.newBadges(bs, new Date("2026-11-14T12:00:00Z")).map(b => b.id), bAgain = C.newBadges(bs);
  ok('coding: badges are earned once, for lessons, streaks, bosses, projects, speed, AI practice and the playground', ['first', 'streak3', 'boss1', 'proj1', 'speed10', 'ai5', 'tinker'].every(id => got.includes(id)) && !got.includes('ten') && !got.includes('speed20') && bAgain.length === 0 && bs.badges.first === '2026-11-14' && new Set(C.BADGES.map(b => b.id)).size === C.BADGES.length);
  ok('coding: a mini project is worth double points the first time', C.award({}, C.LESSONS.find(l => l.id === 'pyP1')).xp === 20 && C.award({}, C.LESSONS.find(l => l.id === 'py1')).xp === 10);
  const aiOk = [C.aiExercise({ kind: 'choice', teach: 't', question: 'q?', options: ['a', 'b', 'c'], answer: 1 }), C.aiExercise({ kind: 'predict', code: 'print(1)', answer: '1' }), C.aiExercise({ kind: 'blank', code: 'x ___ 1', answers: ['='] })];
  const aiBad = [C.aiExercise({ kind: 'choice', question: 'q', options: ['a', 'a', 'b'], answer: 0 }), C.aiExercise({ kind: 'choice', question: 'q', options: ['a', 'b', 'c'], answer: 5 }), C.aiExercise({ kind: 'blank', code: 'no blank here', answers: ['x'] }), C.aiExercise({ kind: 'predict', code: '', answer: '1' }), C.aiExercise(null), C.aiExercise({ kind: 'essay' })];
  ok('coding: AI-written questions are only shown when they are well formed, and are checked like stored ones', aiOk.every(Boolean) && aiBad.every(x => x === null) && C.check({ ex: aiOk[0].ex }, { pick: 1 }).ok && C.check({ ex: aiOk[2].ex }, { vals: ['='] }).ok && /JSON only/.test(C.aiPrompt('Python', 'loops', 1)));

  /* ----- the page wiring ----- */
  const html = rd('web/index.html'), rel = rd('web/js/relocate.js'), ui = rd('web/js/code-lessons.js');
  ok('coding: the lessons are a page of the Cyber tab and their scripts are loaded', /\['code', '[^']*Coding'/.test(rel) && /code: b => A\.codeLessons\.render\(b\)/.test(rel) && /js\/code-lessons-data\.js/.test(html) && /js\/code-lessons\.js/.test(html));
  ok('coding: Python and JavaScript run in the existing sandbox, HTML in a preview with scripts off', /A\.interp\.run\(/.test(ui) && /sandbox=""/.test(ui) && /codelearn/.test(ui));
  ok('coding: plain Enter never checks an answer; Ctrl+Enter does, and Enter in a blank moves to the next one', !/key === 'Enter'\) \{ e\.preventDefault\(\); check\(\)/.test(ui) && /e\.key === 'Enter' && \(e\.ctrlKey \|\| e\.metaKey\)/.test(ui) && /<textarea id="clans"/.test(ui) && /bl\[k \+ 1\]/.test(ui));
  ok('coding: code boxes keep every key (keyboard.js skips [data-ownkeys]) and edits stay undoable', /closest\('\[data-ownkeys\]'\)/.test(rd('web/js/keyboard.js')) && /data-ownkeys/.test(ui) && /execCommand\('insertText'/.test(ui));
  ok('coding: the page shows units with bosses, AI topics, speed rounds and badges', ['data-cl="boss"', 'data-cl="topic"', 'data-cl="speed"', 'data-cl="badges"', 'C.unlocked(', 'C.newBadges(', 'C.aiExercise(', 'A.ai.once('].every(s => ui.includes(s)) && /clearInterval\(sp\.timer\)/.test(ui));
  ok('coding: the playground runs Python and JavaScript in the sandbox, previews HTML, and asks the AI to explain any language', /data-cl="play"/.test(ui) && /RUNS = \{ python: 'python', javascript: 'js', html: 'html' \}/.test(ui) && /A\.ai\.stream\(/.test(ui) && /PL\.GROUPS\.map\(/.test(ui) && /esolang-worker\.js/.test(ui));
  const playground = require('../lib/code-playground');
  const launch = rd('lib/code-playground/run.sh');
  const containerLangs = langs.filter(id => !['python', 'javascript', 'html', 'sql', 'binary'].includes(id));
  const PLAY = require('../web/js/code-playground-langs.js');
  ok('coding: every container language has a launcher and a Playground starter',
    containerLangs.length === playground.LANGS.size && langs.every(id => PLAY.byId(id) && PLAY.byId(id).ex.trim()) &&
    containerLangs.every(id => playground.LANGS.has(id) && new RegExp('^  ' + id + '\\)', 'm').test(launch)));
  ok('coding: the container runner rejects unsupported languages and empty or oversized source',
    playground.validate({ lang: 'bash', code: 'echo Hello' }) &&
    !playground.validate({ lang: 'unknown', code: 'echo Hello' }) &&
    !playground.validate({ lang: 'bash', code: '  ' }) &&
    !playground.validate({ lang: 'bash', code: 'a'.repeat(200001) }));

  /* ----- saved Bible Expert chats ----- */
  const B = require('../web/js/bible-chats.js');
  const msgs = [{ role: 'user', content: 'Who wrote the Gospel of John?' }, { role: 'assistant', content: 'Tradition says the apostle John [1].', sources: [{ title: 'Catholic Encyclopedia', where: 'Catholic Encyclopedia: Gospel of St. John', text: 'x'.repeat(4000) }] }, { role: 'assistant', content: '' }];
  const rec = B.record(null, msgs, 'gemma4:12b', 1763100000000);
  ok('bible chats: a record keeps the question, the answer and its sources (trimmed), and drops an empty answer', rec && rec.msgs.length === 2 && rec.msgs[1].sources.length === 1 && rec.msgs[1].sources[0].text.length === 1500 && rec.title === 'Who wrote the Gospel of John?' && /^bc/.test(rec.id));
  ok('bible chats: nothing is saved before the first answer arrives', B.record(null, [{ role: 'user', content: 'hi' }]) === null);
  const again = B.record(rec.id, msgs.concat([{ role: 'user', content: 'And when?' }, { role: 'assistant', content: 'About AD 90.' }]), '', 1763100500000, rec);
  ok('bible chats: saving again keeps the same id and first date, and updates the time', again.id === rec.id && again.created === rec.created && again.ts === 1763100500000 && again.msgs.length === 4 && again.model === 'gemma4:12b');
  const mdText = B.toMarkdown(again);
  ok('bible chats: the export has every question, answer and numbered source', /^# Who wrote the Gospel of John\?/.test(mdText) && (mdText.match(/## Question/g) || []).length === 2 && /\[1\] Catholic Encyclopedia: Gospel of St\. John/.test(mdText) && /About AD 90/.test(mdText));
  ok('bible chats: file names are safe and searches match questions', !/[\\/:*?"<>|]/.test(B.fileName({ title: 'a/b:c?' }).replace(/\.md$/, '')) && B.sortList([rec, Object.assign({}, again, { id: 'x', title: 'Other', ts: 1 })], 'when').length === 1);
  const bjs = rd('web/js/bible.js');
  ok('bible chats: every answer is saved, and the page has Saved chats, Open, Copy, Export and Delete', /autosave\(\)/.test(bjs) && /data-a="saved"/.test(bjs) && ['open', 'rcopy', 'rexp', 'del', 'copy', 'export'].every(a => bjs.includes("d.a === '" + a + "'")) && /js\/bible-chats\.js/.test(html) && html.indexOf('bible-chats.js') < html.indexOf('/bible.js'));
  ok('bible expert: the welcome page scrolls so every loaded text can be reached', /#p-faith\.fa-expert #bbbody\{[^}]*min-height:0[^}]*overflow:auto/.test(rd('web/style.css')));

  /* ----- Wikibooks ----- */
  const K = require('../lib/kiwix.js');
  const g = K.groupBooks([{ title: 'Python Programming/Loops', link: '/wiki/content/wikibooks_en_all_nopic_2026-04/Python_Programming/Loops', snippet: 'for loops' }, { title: 'Python Programming/Lists', link: '/wiki/content/wikibooks_en_all_nopic_2026-04/Python_Programming/Lists' }, { title: 'Cookbook:Pasta', link: '/wiki/content/wikibooks_en_all_nopic_2026-04/Cookbook:Pasta' }, { title: 'Category:Python', link: '/wiki/content/wikibooks_en_all_nopic_2026-04/Category:Python' }]);
  ok('wikibooks: search hits are grouped into books, with the book\'s own page as the link', g.length === 2 && g[0].book === 'Python Programming' && g[0].hits === 2 && g[0].link === '/wiki/content/wikibooks_en_all_nopic_2026-04/Python_Programming' && g[0].chapters.join() === 'Loops,Lists' && !g.some(x => /^Category/.test(x.book)));
  ok('wikibooks: it is a Library card and button, its script is loaded, and the server answers /api/lib/wikibooks', /A\.wikibooks\.open\(\)/.test(rd('web/js/library.js')) && /id="lywb"/.test(rd('web/js/library.js')) && /js\/wikibooks\.js/.test(html) && /\/api\/lib\/wikibooks/.test(rd('server.js')));
};

// Cyber › 💻 Coding: a full coding course in 21 subjects (20 languages plus binary), all offline.
// Each language is a map of units from first steps to expert (UNITS in code-lessons-data.js). A unit has hand-written lessons,
// 🛠 mini projects, a 👑 boss (a mixed test that unlocks the next unit) and 🤖 AI topics: the local AI teaches any topic in the unit
// and writes practice questions on it. ⚡ Speed rounds are 60 seconds of quick-fire questions. Ranks and 🎖 badges reward progress.
// Python and JavaScript run in the chat's sandbox (web/js/interp.js); HTML and CSS show a live preview with scripts switched off;
// the other languages use "what does it print", "fix the bug", "fill the blank" and multiple choice, checked against stored answers.
// Code boxes act like an editor: Enter is a new line that keeps the indent, Ctrl+Enter runs or checks (keyboard.js leaves [data-ownkeys] alone).
// 🧪 Playground: write any code in any of the languages; Python and JavaScript run in the sandbox and the local AI explains it.
// Progress (points, streak, lessons, bosses, badges, best speed scores) stays in this browser under 'codelearn'.
(() => {
  if (typeof window === 'undefined' || typeof A === 'undefined' || typeof CodeLessons === 'undefined') return;
  const C = CodeLessons, KEY = 'codelearn';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const load = () => { let s = {}; try { s = JSON.parse(ls.get(KEY, '{}')) || {}; } catch (e) { } s = Object.assign({ xp: 0, streak: 0, last: '', done: {}, lang: '', boss: {}, badges: {}, speed: {}, ai: 0 }, s); ['done', 'boss', 'badges', 'speed'].forEach(k => { if (!s[k] || typeof s[k] !== 'object') s[k] = {}; }); return s; };
  const store = s => { try { ls.set(KEY, JSON.stringify(s)); } catch (e) { } };
  /* save, then announce any badge that was just earned */
  const save = s => { const got = C.newBadges(s); store(s); got.forEach((b, i) => setTimeout(() => { try { A.toast('🎖 New badge: ' + b.ic + ' ' + b.n + ' (' + b.d + ')', 5000); } catch (e) { } }, 300 + i * 1200)); return got; };
  const css = '.cl-wrap{max-width:900px;margin:0 auto}.cl-card{background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:16px;margin:0 0 12px}.cl-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:10px}' +
    '.cl-lang{cursor:pointer;margin:0}.cl-lang:hover{border-color:var(--acc)}.cl-bar{height:7px;border-radius:5px;background:var(--line);overflow:hidden;margin:8px 0 2px}.cl-bar>div{height:100%;background:var(--acc)}' +
    '.cl-ed{width:100%;box-sizing:border-box;min-height:180px;font:13px/1.5 Consolas,"Cascadia Mono",monospace;tab-size:4;white-space:pre;padding:10px;border-radius:8px;border:1px solid var(--line);background:var(--panel2);color:var(--fg,inherit);resize:vertical}' +
    '.cl-pre{font:13px/1.5 Consolas,"Cascadia Mono",monospace;white-space:pre-wrap;word-break:break-word;background:var(--panel2);border:1px solid var(--line);border-radius:8px;padding:10px;margin:8px 0;overflow-x:auto}' +
    '.cl-pre .ln{display:inline-block;width:2.2em;color:var(--mute);user-select:none}.cl-pre .bug{background:color-mix(in srgb,var(--bad,#c33) 22%,transparent)}.cl-pre input{font:inherit;width:7em;padding:1px 4px;border-radius:4px;border:1px solid var(--acc);background:var(--bg);color:inherit}' +
    '.cl-row{cursor:pointer;display:flex;gap:10px;align-items:center;padding:9px 10px;border-radius:8px;border-bottom:1px solid var(--line)}.cl-row:hover{background:var(--panel2)}.cl-fb{margin-top:10px;padding:10px;border-radius:8px}.cl-ok{background:color-mix(in srgb,var(--ok,#3a3) 18%,transparent)}.cl-no{background:color-mix(in srgb,var(--bad,#c33) 16%,transparent)}' +
    '.cl-prev{width:100%;height:220px;border:1px solid var(--line);border-radius:8px;background:#fff}.cl-opt{display:block;width:100%;text-align:left;margin:6px 0;padding:10px 12px}' +
    '.cl-ans{flex:1;min-width:220px;min-height:2.6em;box-sizing:border-box;font:13px/1.5 Consolas,"Cascadia Mono",monospace;padding:6px 8px;border-radius:8px;border:1px solid var(--line);background:var(--panel2);color:var(--fg,inherit);resize:vertical}' +
    '.cl-keys{margin-top:4px}.cl-keys kbd{font:11px Consolas,monospace;padding:0 4px;border:1px solid var(--line);border-radius:4px}.cl-ai{line-height:1.6;margin-top:10px}.cl-ai code{font-family:Consolas,monospace;background:var(--panel2);padding:0 3px;border-radius:3px}' +
    '.cl-unit.lock{opacity:.6}.cl-chip{display:inline-block;margin:3px 4px 3px 0;padding:4px 10px;border-radius:999px;border:1px solid var(--line);background:var(--panel2);cursor:pointer;font-size:13px}.cl-chip:hover{border-color:var(--acc)}' +
    '.cl-boss{border-color:color-mix(in srgb,var(--acc) 60%,var(--line))}.cl-big{font-size:30px;font-weight:700}.cl-badge{text-align:center;padding:12px}.cl-badge.off{opacity:.35;filter:grayscale(1)}.cl-badge .ic{font-size:30px}';
  /* Python, JavaScript and HTML run here; every language can be explained by the AI */
  const RUNS = { python: 'python', javascript: 'js', html: 'html' };
  const COMMENT = { python: '#', bash: '#', powershell: '#', ruby: '#', sql: '--', lua: '--', asm: ';', html: '' };
  const keysTip = what => '<div class="small mute cl-keys"><kbd>Ctrl</kbd>+<kbd>Enter</kbd> ' + what + ' · <kbd>Enter</kbd> new line (keeps the indent) · <kbd>Tab</kbd> / <kbd>Shift</kbd>+<kbd>Tab</kbd> indent · <kbd>Ctrl</kbd>+<kbd>/</kbd> comment · <kbd>Ctrl</kbd>+<kbd>Z</kbd> undo</div>';
  /* make a textarea behave like a code editor. Edits go through insertText so Ctrl+Z and Ctrl+Y still undo and redo them.
     data-ownkeys tells keyboard.js to leave every key here alone (Ctrl+K, Ctrl+N and Ctrl+/ would otherwise open other things). */
  function editorKeys(ed, lg, submit) {
    ed.setAttribute('data-ownkeys', '');
    const put = (text, a, b) => { ed.focus(); ed.setSelectionRange(a, b); if (!document.execCommand('insertText', false, text)) { ed.setRangeText(text, a, b, 'end'); ed.dispatchEvent(new Event('input')); } };
    ed.addEventListener('keydown', e => {
      if (e.isComposing) return;
      const ind = lg === 'python' || /^(c|cpp|holyc|java|csharp|go|rust|kotlin|swift|php|asm)$/.test(lg) ? '    ' : '  ';
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); submit(); return; }
      const v = ed.value, s = ed.selectionStart, n = ed.selectionEnd, ls0 = v.lastIndexOf('\n', s - 1) + 1;
      if (e.key === 'Enter' && !e.shiftKey && !e.altKey) { e.preventDefault(); const line = v.slice(ls0, s), lead = (line.match(/^[ \t]*/) || [''])[0]; put('\n' + lead + (/[:{(\[]\s*$/.test(line) ? ind : ''), s, n); return; }
      if (e.key === 'Tab' && !e.ctrlKey && !e.altKey) {
        e.preventDefault(); if (!e.shiftKey && s === n) return put(ind, s, n);
        const le = n > s && v[n - 1] === '\n' ? n - 1 : n, eol = v.indexOf('\n', le), end = eol < 0 ? v.length : eol, re = new RegExp('^( {1,' + ind.length + '}|\\t)');
        const block = v.slice(ls0, end).split('\n').map(l => e.shiftKey ? l.replace(re, '') : ind + l).join('\n'); if (block === v.slice(ls0, end)) return;
        put(block, ls0, end); ed.setSelectionRange(ls0, ls0 + block.length); return;
      }
      if (e.key === '/' && (e.ctrlKey || e.metaKey) && !e.altKey) {
        e.preventDefault(); const mark = COMMENT[lg] === undefined ? '//' : COMMENT[lg]; if (!mark) return;
        const le = n > s && v[n - 1] === '\n' ? n - 1 : n, eol = v.indexOf('\n', le), end = eol < 0 ? v.length : eol, ls2 = v.slice(ls0, end).split('\n');
        const q = mark.replace(/[.*+?^${}()|[\]\\\/]/g, '\\$&'), on = ls2.filter(l => l.trim()).every(l => new RegExp('^\\s*' + q).test(l));
        const block = ls2.map(l => !l.trim() ? l : on ? l.replace(new RegExp('^(\\s*)' + q + ' ?'), '$1') : l.replace(/^(\s*)/, '$1' + mark + ' ')).join('\n');
        put(block, ls0, end); ed.setSelectionRange(ls0, ls0 + block.length);
      }
    });
  }

  /* view: home | lang | lesson | boss | speed | ai | badges | play. curL is the exercise on screen (a stored lesson, or one the AI wrote). */
  let H = null, view = 'home', lang = '', curL = null, shown = false, boss = null, sp = null, ai = null, aictl = null;
  const langOf = id => C.LANGS.find(x => x.id === id) || C.LANGS[0];
  const bar = (n, of) => '<div class="cl-bar"><div style="width:' + Math.round(100 * n / Math.max(1, of)) + '%"></div></div>';
  const lessonNow = () => curL;
  const lessonById = id => C.LESSONS.find(x => x.id === id);
  function go(v, x) {
    if (pctl) { pctl.abort(); pctl = null; } if (aictl) { aictl.abort(); aictl = null; } if (sp && sp.timer) { clearInterval(sp.timer); sp.timer = null; }
    view = v; if (v === 'lang') lang = x; if (v === 'lesson') { curL = lessonById(x) || null; shown = false; }
    draw(); const sc = H && H.querySelector('.scroll'); if (sc) sc.scrollTop = 0;
  }
  const kindName = k => ({ run: '▶ write and run', html: '🖼 build a page', predict: '🔮 what does it print', fix: '🐞 fix the bug', blank: '✏️ fill the blank', choice: '❓ quiz' })[k] || k;
  const back = (to, id, label) => '<div class="row" style="gap:8px;margin-bottom:10px;flex-wrap:wrap"><button class="ib" data-cl="' + to + '"' + (id ? ' data-id="' + id + '"' : '') + '>← ' + esc(label) + '</button></div>';

  /* ----- home: rank, Continue, speed round, badges, playground, the languages ----- */
  function rankCard(s) {
    const r = C.rankOf(s.xp), got = Object.keys(s.badges).length, nx = s.lang && C.nextStep(s.lang, s);
    const toNext = r.next ? bar(s.xp - r.at, r.next.at - r.at) + '<div class="small mute">' + (r.next.at - s.xp) + ' points to ' + r.next.ic + ' ' + r.next.n + '</div>' : bar(1, 1) + '<div class="small mute">The top rank. Respect.</div>';
    const cont = !nx ? '' : nx.boss ? '<button class="pri" data-cl="boss" data-id="' + nx.boss.id + '">Continue ' + esc(langOf(nx.boss.lang).n) + ': 👑 face the Unit ' + nx.boss.n + ' boss →</button>' : '<button class="pri" data-cl="lesson" data-id="' + nx.lesson.id + '">Continue ' + esc(langOf(nx.lesson.lang).n) + ': ' + esc(nx.lesson.t) + ' →</button>';
    return '<div class="cl-card"><div class="row" style="gap:12px;align-items:center;flex-wrap:wrap"><div style="font-size:38px">' + r.ic + '</div><div style="flex:1;min-width:220px"><b style="font-size:20px">' + esc(r.n) + '</b> <span class="small mute">· ' + s.xp + ' points</span><div class="small mute">Learn to code, from your first line to expert. Everything works offline.</div></div><div style="text-align:right"><div>🔥 <b>' + s.streak + '</b> ' + (s.streak === 1 ? 'day' : 'days') + ' in a row</div><div class="small mute">Lessons done: ' + Object.keys(s.done).length + ' of ' + C.LESSONS.length + '</div></div></div>' + toNext +
      '<div class="row" style="gap:8px;margin-top:10px;flex-wrap:wrap">' + cont + '<button class="ib" data-cl="speed" data-id="all">⚡ Speed round</button><button class="ib" data-cl="badges">🎖 Badges ' + got + '/' + C.BADGES.length + '</button></div></div>';
  }
  function home() {
    const s = load();
    return rankCard(s) +
      '<div class="cl-card cl-lang" data-cl="play" style="margin-bottom:12px"><div class="row" style="gap:12px;align-items:center"><div style="font-size:28px">🧪</div><div style="flex:1"><b>Code playground</b><div class="small mute" style="line-height:1.45">Write and test any code in any of these ' + C.LANGS.length + ' languages, safely. Python and JavaScript run in a locked sandbox, HTML shows a preview, and the AI explains what any code does or what is wrong with it.</div></div><span class="small" style="color:var(--acc)">Open →</span></div></div>' +
      '<div class="cl-grid">' + C.LANGS.map(x => { const ls2 = C.byLang(x.id), d = ls2.filter(l => s.done[l.id]).length, us = C.unitsOf(x.id), bb = us.filter(u => s.boss[u.id]).length; return '<div class="cl-card cl-lang" data-cl="lang" data-id="' + x.id + '"><div style="font-size:26px">' + x.ic + '</div><b>' + esc(x.n) + '</b>' + (x.run ? ' <span class="small" style="color:var(--acc)">runs here</span>' : '') + '<div class="small mute" style="margin-top:4px;line-height:1.45">' + esc(x.about) + '</div>' + bar(d, ls2.length) + '<div class="small mute">' + us.length + ' units · ' + d + ' of ' + ls2.length + ' lessons' + (bb ? ' · 👑 ' + bb : '') + '</div></div>'; }).join('') + '</div>';
  }

  /* ----- a language: its units in order, each with lessons, projects, a boss and AI topics ----- */
  function langPage() {
    const s = load(), x = langOf(lang), us = C.unitsOf(lang), open = C.unlocked(lang, s), all = C.byLang(lang), d = all.filter(l => s.done[l.id]).length;
    const head = back('home', '', 'All languages') + '<div class="cl-card"><div class="row" style="gap:12px;align-items:center;flex-wrap:wrap"><div style="font-size:30px">' + x.ic + '</div><div style="flex:1;min-width:200px"><b style="font-size:19px">' + esc(x.n) + '</b><div class="small mute">' + esc(x.about) + (x.run ? ' Your code runs right here.' : '') + '</div></div><button class="ib" data-cl="speed" data-id="' + lang + '">⚡ Speed round' + (s.speed[lang] ? ' · best ' + s.speed[lang] : '') + '</button></div>' + bar(d, all.length) +
      '<div class="small mute">' + us.length + ' units · ' + d + ' of ' + all.length + ' lessons · 👑 ' + us.filter(u => s.boss[u.id]).length + ' of ' + us.filter(C.hasBoss).length + ' bosses. Every unit lists its topics: tap one and the AI teaches it and quizzes you.</div></div>';
    return head + us.map((u, i) => {
      const ls2 = C.unitLessons(u), dn = ls2.filter(l => s.done[l.id]).length, isOpen = open[i], beaten = !!s.boss[u.id];
      const title = '<div class="row" style="gap:8px;align-items:center;flex-wrap:wrap"><b>' + (isOpen ? '' : '🔒 ') + 'Unit ' + u.n + ' · ' + esc(u.t) + '</b><span class="small mute">' + (ls2.length ? dn + ' of ' + ls2.length + ' lessons' : 'taught by the AI') + (beaten ? ' · 👑 beaten' : '') + '</span></div>' + (ls2.length ? bar(dn, ls2.length) : '');
      if (!isOpen) return '<div class="cl-card cl-unit lock">' + title + '<div class="small mute" style="margin-top:6px">Beat the Unit ' + us[i - 1].n + ' boss to unlock it. Topics: ' + esc(u.topics.join(', ')) + '.</div><div style="margin-top:8px"><button class="ib" data-cl="boss" data-id="' + us[i - 1].id + '">👑 Face the Unit ' + us[i - 1].n + ' boss</button></div></div>';
      const rows = ls2.map(l => '<div class="cl-row" data-cl="lesson" data-id="' + l.id + '"><span style="font-size:18px">' + (s.done[l.id] ? '✅' : l.proj ? '🛠️' : '⬜') + '</span><span style="flex:1">' + esc(l.t) + '</span><span class="small mute">' + (l.proj ? 'mini project · ' : '') + kindName(l.ex.k) + '</span></div>').join('');
      const bossRow = C.hasBoss(u) ? '<div class="cl-row cl-boss" data-cl="boss" data-id="' + u.id + '"><span style="font-size:18px">👑</span><span style="flex:1"><b>Boss challenge</b> <span class="small mute">' + Math.min(C.BOSS_SIZE, C.bossPool(u).length) + ' mixed questions, no hints. Get 80% to ' + (us[i + 1] ? 'unlock Unit ' + (u.n + 1) : 'finish the course') + '.</span></span><span class="small">' + (beaten ? '✅ beaten' : 'Fight →') + '</span></div>' : '';
      const chips = '<div class="small mute" style="margin-top:10px">🤖 Learn any topic with the AI:</div><div>' + u.topics.map(t => '<span class="cl-chip" data-cl="topic" data-u="' + u.id + '" data-t="' + esc(t) + '">' + esc(t) + '</span>').join('') + '</div>';
      return '<div class="cl-card cl-unit">' + title + rows + bossRow + chips + '</div>';
    }).join('');
  }

  /* ----- one exercise (used by lessons, bosses, speed rounds and AI practice) ----- */
  function codeWithLines(code, bug) { return '<div class="cl-pre">' + String(code).split('\n').map((l, i) => '<div class="' + (bug === i + 1 ? 'bug' : '') + '"><span class="ln">' + (i + 1) + '</span>' + esc(l) + '</div>').join('') + '</div>'; }
  function blanksHtml(code) { let n = 0; return '<div class="cl-pre">' + String(code).split('___').map(esc).reduce((a, part, i) => a + (i ? '<input data-blank="' + (n++) + '" spellcheck="false" autocomplete="off" aria-label="blank ' + n + '">' : '') + part, '') + '</div>'; }
  function exBody(l, help) {
    const ex = l.ex, hs = help ? '<button class="ib" data-cl="hint">💡 Hint</button><button class="ib" data-cl="show">Show the answer</button>' : '';
    if (ex.k === 'run') return '<textarea class="cl-ed" id="clcode" spellcheck="false">' + esc(ex.code) + '</textarea>' + keysTip('runs and checks') + '<div class="row" style="gap:8px;margin-top:8px;flex-wrap:wrap"><button class="pri" data-cl="run">▶ Run and check</button><button class="ib" data-cl="reset">Start over</button>' + hs + (l.lang === 'python' ? '<span class="small mute">Python takes a few seconds to start the first time.</span>' : '') + '</div><div class="small mute" style="margin-top:8px">Output</div><pre class="cl-pre" id="clout" style="min-height:2.5em"></pre>';
    if (ex.k === 'html') return '<textarea class="cl-ed" id="clcode" spellcheck="false">' + esc(ex.code) + '</textarea>' + keysTip('checks') + '<div class="small mute" style="margin:8px 0 4px">Live preview</div><iframe class="cl-prev" id="clprev" sandbox="" title="Preview"></iframe><div class="row" style="gap:8px;margin-top:8px;flex-wrap:wrap"><button class="pri" data-cl="check">✓ Check</button><button class="ib" data-cl="reset">Start over</button>' + hs + '</div>';
    if (ex.k === 'predict') return '<b>' + esc(ex.q || 'What does this print?') + '</b>' + codeWithLines(ex.code) + '<div class="row" style="gap:8px;flex-wrap:wrap"><textarea id="clans" class="cl-ans" rows="1" spellcheck="false" autocomplete="off" placeholder="Type the output (Enter makes a new line)"></textarea><button class="pri" data-cl="check">✓ Check</button>' + hs + '</div><div class="small mute cl-keys"><kbd>Ctrl</kbd>+<kbd>Enter</kbd> checks · <kbd>Enter</kbd> new line</div>';
    if (ex.k === 'fix') return '<b>Line ' + ex.line + ' has a bug. Type the corrected line.</b>' + codeWithLines(ex.code, ex.line) + '<div class="row" style="gap:8px;flex-wrap:wrap"><textarea id="clans" class="cl-ans" rows="1" spellcheck="false" autocomplete="off">' + esc(ex.code.split('\n')[ex.line - 1].trim()) + '</textarea><button class="pri" data-cl="check">✓ Check</button>' + hs + '</div>' + keysTip('checks');
    if (ex.k === 'blank') return '<b>Fill in the blank' + (ex.ans.length > 1 ? 's' : '') + '.</b>' + blanksHtml(ex.code) + '<div class="row" style="gap:8px;flex-wrap:wrap"><button class="pri" data-cl="check">✓ Check</button>' + hs + '</div><div class="small mute cl-keys"><kbd>Enter</kbd> or <kbd>Tab</kbd> next blank · <kbd>Ctrl</kbd>+<kbd>Enter</kbd> checks</div>';
    if (ex.k === 'choice') return '<b>' + esc(ex.q) + '</b>' + (ex.code ? codeWithLines(ex.code) : '') + ex.opts.map((o, k) => '<button class="ib cl-opt" data-cl="pick" data-i="' + k + '">' + esc(o) + '</button>').join('');
    return '';
  }
  function lessonPage() {
    const l = curL; if (!l) return home(); const x = langOf(l.lang), u = C.unitOf(l.id), list = u ? C.unitLessons(u) : C.byLang(l.lang), i = list.indexOf(l), done = load().done[l.id];
    return '<div class="row" style="gap:8px;margin-bottom:10px;flex-wrap:wrap"><button class="ib" data-cl="lang" data-id="' + l.lang + '">← ' + esc(x.n) + '</button><span class="small mute">' + (u ? 'Unit ' + u.n + ' · ' + esc(u.t) + ' · ' : '') + C.LEVELS[l.lv] + ' · ' + (l.proj ? '🛠 mini project' : 'lesson ' + (i + 1) + ' of ' + list.length) + (done ? ' · ✅ done' : '') + '</span></div>' +
      '<div class="cl-card"><b style="font-size:18px">' + (l.proj ? '🛠️' : x.ic) + ' ' + esc(l.t) + '</b><div style="margin-top:6px;line-height:1.6">' + esc(l.teach) + '</div></div><div class="cl-card">' + exBody(l, true) + '<div id="clfb"></div></div>';
  }

  /* ----- 👑 boss: a few of the unit's lessons, mixed, one at a time, no hints ----- */
  function startBoss(id) {
    const u = C.unitsOf(id.replace(/-u\d+$/, '')).find(x => x.id === id); if (!u || !C.hasBoss(u)) return;
    lang = u.lang; boss = { u, list: C.bossPick(u), i: 0, right: 0, answered: false, over: false }; curL = boss.list[0]; shown = false; go('boss');
  }
  function bossPage() {
    const b = boss; if (!b) return home(); const x = langOf(b.u.lang), N = b.list.length;
    if (b.over) {
      const s = load(), won = C.bossPassed(b.right, N), us = C.unitsOf(b.u.lang), nxt = us[b.u.n];
      return back('lang', b.u.lang, x.n) + '<div class="cl-card" style="text-align:center"><div style="font-size:54px">' + (won ? '👑' : '💥') + '</div><div class="cl-big">' + b.right + ' / ' + N + '</div><b>' + (won ? 'Boss beaten!' : 'The boss wins this time.') + '</b><div class="small mute" style="margin-top:6px">' + (won ? (b.firstWin ? '+' + C.BOSS_XP + ' points. ' : '') + (nxt ? 'Unit ' + nxt.n + ' (' + esc(nxt.t) + ') is open.' : 'You finished every unit of ' + esc(x.n) + '!') : 'You need ' + Math.ceil(N * 0.8) + ' right. Go over the unit\'s lessons, or let the AI teach a topic, then try again.') + '</div>' +
        '<div class="row" style="gap:8px;justify-content:center;margin-top:12px;flex-wrap:wrap">' + (won && nxt ? '<button class="pri" data-cl="lang" data-id="' + b.u.lang + '">On to Unit ' + nxt.n + ' →</button>' : '') + '<button class="' + (won ? 'ib' : 'pri') + '" data-cl="boss" data-id="' + b.u.id + '">👑 ' + (won ? 'Fight again' : 'Try again') + '</button><span class="small mute" style="align-self:center">🔥 ' + s.streak + '</span></div></div>';
    }
    return back('lang', b.u.lang, x.n) + '<div class="cl-card cl-boss"><div class="row" style="gap:10px;align-items:center;flex-wrap:wrap"><div style="font-size:30px">👑</div><div style="flex:1"><b>Unit ' + b.u.n + ' boss: ' + esc(b.u.t) + '</b><div class="small mute">Question ' + (b.i + 1) + ' of ' + N + ' · ✅ ' + b.right + ' right · no hints</div></div></div>' + bar(b.i, N) + '</div>' +
      '<div class="cl-card"><div class="small mute" style="margin-bottom:6px">' + esc(curL.t) + '</div>' + exBody(curL, false) + '<div id="clfb"></div></div>';
  }
  function bossAnswer(ok) {
    const b = boss; if (!b || b.answered) return; b.answered = true; if (ok) b.right++;
    const fb = H.querySelector('#clfb'), last = b.i + 1 >= b.list.length;
    fb.className = 'cl-fb ' + (ok ? 'cl-ok' : 'cl-no'); fb.innerHTML = '<b>' + (ok ? '✅ Hit!' : '❌ Missed.') + '</b> ' + (ok ? '' : 'The answer: <code>' + esc(answerText(curL)) + '</code>') + '<div style="margin-top:8px"><button class="pri" data-cl="bnext">' + (last ? 'See the result →' : 'Next question →') + '</button></div>';
  }
  function bossNext() {
    const b = boss; if (!b) return; b.i++; b.answered = false;
    if (b.i >= b.list.length) {
      b.over = true; const s = load(); s.lang = b.u.lang;
      if (C.bossPassed(b.right, b.list.length)) { b.firstWin = !s.boss[b.u.id]; if (b.firstWin) s.xp += C.BOSS_XP; s.boss[b.u.id] = C.today(); }
      save(s);
    } else { curL = b.list[b.i]; shown = false; }
    draw();
  }
  const answerText = l => { const ex = l.ex; return ex.k === 'choice' ? ex.opts[ex.a] : ex.k === 'blank' ? ex.ans.map(a => a[0]).join(' · ') : ex.k === 'run' || ex.k === 'html' ? (ex.hint || ex.sol || '').split('\n')[0] : (ex.ans || [''])[0]; };

  /* ----- ⚡ speed round: 60 seconds, quick questions, 3 points each ----- */
  function startSpeed(id) {
    const s = load(), pool = C.speedPool(id, s.done); if (!pool.length) return;
    sp = { id, pool, score: 0, n: 0, end: Date.now() + C.SPEED_TIME * 1000, timer: null, over: false, wait: false };
    curL = C.shuffle(pool)[0]; go('speed'); sp.timer = setInterval(tick, 250);
  }
  function tick() {
    if (!sp || sp.over) return; const left = Math.max(0, Math.ceil((sp.end - Date.now()) / 1000)), t = H && H.querySelector('#cltime'); if (t) t.textContent = left + 's';
    if (left <= 0) {
      clearInterval(sp.timer); sp.timer = null; sp.over = true; const s = load(); sp.best = (s.speed[sp.id] || 0); sp.record = sp.score > sp.best; if (sp.record) s.speed[sp.id] = sp.score; s.xp += sp.score * C.SPEED_XP;
      if (sp.score) { const t0 = C.today(), y = C.today(new Date(Date.now() - 864e5)); if (s.last !== t0) { s.streak = s.last === y ? s.streak + 1 : 1; s.last = t0; s.bestStreak = Math.max(s.bestStreak || 0, s.streak); } }
      save(s); if (view === 'speed') draw();
    }
  }
  function speedPage() {
    const p = sp; if (!p) return home(); const name = p.id === 'all' ? 'all languages' : langOf(p.id).n, backTo = p.id === 'all' ? back('home', '', 'All languages') : back('lang', p.id, name);
    if (p.over) return backTo + '<div class="cl-card" style="text-align:center"><div style="font-size:54px">⚡</div><div class="cl-big">' + p.score + ' right</div><b>' + (p.record ? '🏆 New best for ' + esc(name) + '!' : 'Best for ' + esc(name) + ': ' + p.best) + '</b><div class="small mute" style="margin-top:6px">+' + p.score * C.SPEED_XP + ' points · ' + p.n + ' questions in ' + C.SPEED_TIME + ' seconds</div><div style="margin-top:12px"><button class="pri" data-cl="speed" data-id="' + p.id + '">⚡ Go again</button></div></div>';
    return backTo + '<div class="cl-card"><div class="row" style="gap:12px;align-items:center"><div style="font-size:30px">⚡</div><div style="flex:1"><b>Speed round: ' + esc(name) + '</b><div class="small mute">Answer as many as you can. ' + C.SPEED_XP + ' points each.</div></div><div style="text-align:right"><div class="cl-big" id="cltime">' + Math.max(0, Math.ceil((p.end - Date.now()) / 1000)) + 's</div><div class="small">✅ ' + p.score + '</div></div></div></div>' +
      '<div class="cl-card"><div class="small mute" style="margin-bottom:6px">' + langOf(curL.lang).ic + ' ' + esc(langOf(curL.lang).n) + ' · ' + esc(curL.t) + '</div>' + exBody(curL, false) + '<div id="clfb"></div></div>';
  }
  function speedAnswer(ok) {
    const p = sp; if (!p || p.over || p.wait) return; p.wait = true; p.n++; if (ok) p.score++;
    const fb = H.querySelector('#clfb'); fb.className = 'cl-fb ' + (ok ? 'cl-ok' : 'cl-no'); fb.innerHTML = ok ? '<b>✅</b>' : '<b>❌</b> <code>' + esc(answerText(curL)) + '</code>';
    setTimeout(() => { if (sp !== p || p.over) return; p.wait = false; let nx = curL; for (let k = 0; k < 5 && nx === curL; k++) nx = C.shuffle(p.pool)[0]; curL = nx; if (view === 'speed') draw(); }, ok ? 500 : 1400);
  }

  /* ----- 🤖 AI topics: the local AI teaches the topic, then writes practice questions that are checked like the stored ones ----- */
  function startTopic(uid, topic) {
    const u = C.unitsOf(uid.replace(/-u\d+$/, '')).find(x => x.id === uid); if (!u) return; const us = C.unitsOf(u.lang);
    lang = u.lang; ai = { u, topic, lv: u.n <= Math.ceil(us.length / 3) ? 1 : u.n <= Math.ceil(us.length * 2 / 3) ? 2 : 3, teach: '', busy: '', msg: '', item: null, right: 0, answered: false }; curL = null; go('ai');
  }
  function aiPage() {
    const a = ai; if (!a) return home(); const x = langOf(a.u.lang);
    return back('lang', a.u.lang, x.n) + '<div class="cl-card"><div class="row" style="gap:10px;align-items:center;flex-wrap:wrap"><div style="font-size:30px">🤖</div><div style="flex:1;min-width:200px"><b style="font-size:18px">' + esc(x.n) + ': ' + esc(a.topic) + '</b><div class="small mute">Unit ' + a.u.n + ' · ' + esc(a.u.t) + ' · taught by the AI on this PC' + (a.right ? ' · ✅ ' + a.right + ' right' : '') + '</div></div></div>' +
      '<div class="row" style="gap:8px;margin-top:10px;flex-wrap:wrap"><button class="' + (a.teach ? 'ib' : 'pri') + '" data-cl="ateach"' + (a.busy ? ' disabled' : '') + '>📖 Teach me this</button><button class="' + (a.teach ? 'pri' : 'ib') + '" data-cl="aq"' + (a.busy ? ' disabled' : '') + '>✏️ ' + (a.item ? 'Another question' : 'Practice question') + '</button>' + (a.busy ? '<button class="ib" data-cl="astop">■ Stop</button>' : '') + '</div>' +
      '<div id="clteach" class="cl-ai">' + (a.teach ? fmt(a.teach) : '') + '</div>' + (a.busy ? '<div class="small mute" style="margin-top:8px">🤖 ' + esc(a.busy) + '</div>' : '') + (a.msg ? '<div class="small mute" style="margin-top:8px">' + esc(a.msg) + '</div>' : '') + '</div>' +
      (a.item ? '<div class="cl-card">' + (a.item.teach ? '<div style="line-height:1.6;margin-bottom:8px">' + esc(a.item.teach) + '</div>' : '') + exBody(curL, false) + '<div id="clfb"></div><div class="small mute" style="margin-top:8px">' + (a.item.checked ? '✔ Written by the AI and checked by running it in the sandbox.' : 'Written by the AI, so it is usually right but can be wrong. The stored lessons are checked by hand.') + '</div></div>' : '');
  }
  async function aiTeach() {
    const a = ai; if (!a || !A.ai || !A.ai.stream) { if (a) { a.msg = 'The AI is not available.'; draw(); } return; }
    if (aictl) aictl.abort(); const ctl = aictl = new AbortController(); a.busy = 'Writing the lesson…'; a.teach = ''; a.msg = ''; draw();
    const x = langOf(a.u.lang), prompt = 'Teach "' + a.topic + '" in ' + x.n + ' to a ' + C.LEVELS[a.lv].toLowerCase() + ' learner. Use plain, short sentences. Include: what it is and why it matters, the exact syntax, two short code examples with what they output, one common mistake and how to avoid it, and a one-line summary. Keep it under 300 words. Use ``` code blocks.';
    try { await A.ai.stream([{ role: 'user', content: prompt }], t => { if (ai !== a || ctl.signal.aborted) return; a.teach = t; const box = H.querySelector('#clteach'); if (box) box.innerHTML = fmt(t); }, ctl.signal, { temp: 0.3 }); }
    catch (e) { if (!ctl.signal.aborted && ai === a) a.msg = 'The AI could not answer: ' + (e.message || e) + '. Check that a model is chosen at the top of the window.'; }
    if (aictl === ctl) aictl = null; if (ai === a) { a.busy = ''; if (view === 'ai') draw(); }
  }
  async function aiQuestion() {
    const a = ai; if (!a || !A.ai || !A.ai.once) { if (a) { a.msg = 'The AI is not available.'; draw(); } return; }
    if (aictl) aictl.abort(); const ctl = aictl = new AbortController(); a.busy = 'Writing a question…'; a.msg = ''; draw();
    let got = null;
    for (let k = 0; k < 5 && !got && !ctl.signal.aborted; k++) { try { const t = await A.ai.once([{ role: 'user', content: C.aiPrompt(langOf(a.u.lang).n, a.topic, a.lv) }], { temp: 0.6 }); const raw = A.ai.json(t), canRun = a.u.lang === 'python' || a.u.lang === 'javascript';
        /* a malformed quiz whose code still runs becomes "what does it print" (verify fills in the real output) */
        const item = C.aiExercise(raw) || (canRun && raw && typeof raw.code === 'string' && raw.code.trim() ? { teach: typeof raw.teach === 'string' ? raw.teach : '', ex: { k: 'predict', q: 'What does this print?', code: raw.code.trim(), ans: [''] } } : null);
        got = await verify(a.u.lang, item); } catch (e) { a.msg = 'The AI could not answer: ' + (e.message || e) + '. Check that a model is chosen at the top of the window.'; break; } }
    if (aictl === ctl) aictl = null; if (ai !== a || ctl.signal.aborted) return;
    a.busy = ''; if (got) { a.item = got; a.answered = false; curL = { id: 'ai', lang: a.u.lang, lv: a.lv, t: a.topic, teach: got.teach, ex: got.ex, ai: 1 }; } else if (!a.msg) a.msg = 'The AI did not write a usable question. Press Practice question to try again.';
    if (view === 'ai') draw();
  }
  /* Python and JavaScript questions are proved by running them in the sandbox: "what does it print" takes the real output as the answer,
     a quiz with code must have the real output as its right option, and a filled-in blank must run without an error. Anything else is dropped. */
  async function verify(lg, item) {
    if (!item || !A.interp || !(lg === 'python' || lg === 'javascript')) return item; const ex = item.ex;
    const runIt = async code => { try { const r = await A.interp.run(RUNS[lg], code); return r && r.ok ? C.normOut(r.stdout || '') : null; } catch (e) { return null; } };
    if (ex.k === 'predict') { const out = await runIt(ex.code); if (out == null || !out || out.length > 200) return null; ex.ans = [out]; item.checked = 1; return item; }
    if (ex.k === 'choice' && ex.code) { const out = await runIt(ex.code); if (out == null) return null; const i = ex.opts.findIndex(o => C.normOut(o).replace(/\s+/g, ' ') === out.replace(/\s+/g, ' ')); item.checked = 1;
      if (i >= 0) { ex.a = i; return item; }
      /* none of the AI's options was the real output: ask what it prints instead, with the real output as the answer */
      if (!out || out.length > 200) return null; item.ex = { k: 'predict', q: 'What does this print?', code: ex.code, ans: [out] }; return item; }
    if (ex.k === 'blank') { let n = 0; const filled = ex.code.replace(/___/g, () => ex.ans[n++][0]); if (await runIt(filled) == null) return null; item.checked = 1; return item; }
    return item;
  }
  function aiAnswer(ok, msg) {
    const a = ai; if (!a) return; const fb = H.querySelector('#clfb'); if (!fb) return;
    if (ok && !a.answered) { a.right++; const s = load(); s.ai = (s.ai || 0) + 1; s.xp += 5; save(s); } a.answered = a.answered || ok;
    fb.className = 'cl-fb ' + (ok ? 'cl-ok' : 'cl-no'); fb.innerHTML = '<b>' + (ok ? '✅ Correct! +5 points' : '❌ Not yet.') + '</b> ' + (ok ? '' : msg || '') + (ok ? '<div style="margin-top:8px"><button class="pri" data-cl="aq">✏️ Another question</button></div>' : '<div class="small mute" style="margin-top:4px">Try again, or <a href="#" data-cl="areveal">show the answer</a>.</div>');
  }

  /* ----- 🎖 badges ----- */
  function badgesPage() {
    const s = load(), r = C.rankOf(s.xp);
    return back('home', '', 'All languages') + '<div class="cl-card"><b style="font-size:19px">🎖 Badges and ranks</b><div class="small mute">You are ' + r.ic + ' <b>' + esc(r.n) + '</b> with ' + s.xp + ' points. ' + Object.keys(s.badges).length + ' of ' + C.BADGES.length + ' badges.</div>' +
      '<div class="row" style="gap:6px;flex-wrap:wrap;margin-top:10px">' + C.RANKS.map(x => '<span class="cl-chip" style="cursor:default' + (s.xp >= x[0] ? ';border-color:var(--acc)' : ';opacity:.5') + '">' + x[2] + ' ' + esc(x[1]) + ' · ' + x[0] + '</span>').join('') + '</div></div>' +
      '<div class="cl-grid">' + C.BADGES.map(b => '<div class="cl-card cl-badge' + (s.badges[b.id] ? '' : ' off') + '"><div class="ic">' + b.ic + '</div><b>' + esc(b.n) + '</b><div class="small mute">' + esc(b.d) + '</div>' + (s.badges[b.id] ? '<div class="small" style="margin-top:4px">Earned ' + esc(s.badges[b.id]) + '</div>' : '') + '</div>').join('') + '</div>';
  }

  /* ----- 🧪 Playground: any code, any of the languages. Python and JavaScript run in the sandbox worker (no files, no network,
     stopped after a few seconds); HTML shows in a preview with scripts off; the AI on this PC explains what code does or what is wrong. */
  const PKEY = 'codeplay', START = { python: 'print("Hello!")\n', javascript: 'console.log("Hello!");\n', html: '<h1>Hello!</h1>\n' };
  const pload = () => { let s = {}; try { s = JSON.parse(ls.get(PKEY, '{}')) || {}; } catch (e) { } return Object.assign({ lang: 'python', code: {} }, s); };
  let plang = pload().lang, plast = null, pctl = null;
  const playSave = code => { const s = pload(); s.lang = plang; s.code[plang] = String(code).slice(0, 50000); try { ls.set(PKEY, JSON.stringify(s)); } catch (e) { } };
  /* the AI reply as safe HTML: everything escaped, then code blocks, `code` and **bold** */
  const fmt = t => String(t || '').split(/```[^\n`]*\n?([\s\S]*?)(?:```|$)/).map((p, i) => i % 2 ? '<pre class="cl-pre">' + esc(p.replace(/\n$/, '')) + '</pre>' : esc(p).replace(/`([^`\n]+)`/g, '<code>$1</code>').replace(/\*\*([^*\n]+)\*\*/g, '<b>$1</b>').replace(/^#{1,4} +(.+)$/gm, '<b>$1</b>').replace(/\n/g, '<br>')).join('');
  function playPage() {
    const x = langOf(plang), code = pload().code[plang], how = RUNS[plang] === 'html' ? 'shows a live preview' : RUNS[plang] ? 'runs here in a locked sandbox' : 'cannot run here, but the AI can read it and explain it';
    return back('home', '', 'All languages') +
      '<div class="cl-card"><b style="font-size:19px">🧪 Code playground</b><div class="small mute" style="line-height:1.5;margin-top:4px">Write and test any code. Python and JavaScript run in a locked sandbox: they cannot touch your files, the internet or the rest of Moundshroud, and they are stopped after a few seconds. HTML shows in a preview with scripts switched off. <b>🧠 Explain</b> asks the AI what the code does or what is wrong with it.</div></div>' +
      '<div class="cl-card"><div class="row" style="gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:8px"><label class="small">Language <select id="plang" aria-label="Language">' + C.LANGS.map(l => '<option value="' + l.id + '"' + (l.id === plang ? ' selected' : '') + '>' + l.ic + ' ' + esc(l.n) + '</option>').join('') + '</select></label><span class="small mute">' + esc(x.n) + ' ' + how + '.</span></div>' +
      '<textarea class="cl-ed" id="clcode" spellcheck="false" style="min-height:240px" placeholder="Type any ' + esc(x.n) + ' code here">' + esc(code == null ? (START[plang] || '') : code) + '</textarea>' + keysTip(RUNS[plang] ? 'runs' : 'explains') +
      '<div class="row" style="gap:8px;margin-top:8px;flex-wrap:wrap">' + (RUNS[plang] && RUNS[plang] !== 'html' ? '<button class="pri" data-cl="prun">▶ Run</button>' : '') + '<button class="' + (RUNS[plang] && RUNS[plang] !== 'html' ? 'ib' : 'pri') + '" data-cl="pexp">🧠 Explain</button><button class="ib" data-cl="pstop" hidden>■ Stop</button><button class="ib" data-cl="pclear">Clear</button></div>' +
      (RUNS[plang] === 'html' ? '<div class="small mute" style="margin:8px 0 4px">Live preview</div><iframe class="cl-prev" id="clprev" sandbox="" title="Preview"></iframe>' : RUNS[plang] ? '<div class="small mute" style="margin-top:8px">Output</div><pre class="cl-pre" id="clout" style="min-height:2.5em"></pre>' : '') +
      '<div id="plai" class="cl-ai"></div></div>';
  }
  async function playRun() {
    const ed = H.querySelector('#clcode'), out = H.querySelector('#clout'), btn = H.querySelector('[data-cl="prun"]'); if (!ed || !out) return null;
    if (!A.interp) { out.textContent = 'The code sandbox is not available.'; return null; }
    const code = ed.value, lg = plang; if (btn) btn.disabled = true; out.textContent = lg === 'python' ? 'Running (starting Python)…' : 'Running…';
    let r; try { r = await A.interp.run(RUNS[lg], code); } catch (e) { r = { ok: false, error: String(e.message || e), stdout: '' }; }
    if (btn) btn.disabled = false; if (view !== 'play' || plang !== lg || !H.querySelector('#clout')) return null;
    const text = (r.stdout || '') + (r.value ? (r.stdout ? '\n' : '') + '→ ' + r.value : '') + (r.ok ? '' : ((r.stdout || r.value) ? '\n' : '') + 'Error: ' + (String(r.error || 'it did not run').split('\n').filter(s => !/^\s+at\s/.test(s)).join('\n').trim()));
    H.querySelector('#clout').textContent = text || '(it ran, and printed nothing)';
    plast = { lang: lg, code, text: text || '(nothing was printed)', ok: !!r.ok };
    { const s = load(); if (!s.played) { s.played = 1; save(s); } }
    if (!r.ok) { const ai2 = H.querySelector('#plai'); if (ai2 && !pctl) ai2.innerHTML = '<span class="small mute">There is an error. Press <b>🧠 Explain</b> to find out what is wrong and how to fix it.</span>'; }
    return plast;
  }
  async function explain() {
    const ed = H.querySelector('#clcode'), box = H.querySelector('#plai'); if (!ed || !box) return; const code = ed.value.trim();
    if (!code) { box.innerHTML = '<span class="small mute">Type some code first.</span>'; return; }
    if (!A.ai || !A.ai.stream) { box.innerHTML = '<span class="small mute">The AI is not available.</span>'; return; }
    const lg = plang, x = langOf(lg); let ran = null;
    if (RUNS[lg] && RUNS[lg] !== 'html') ran = plast && plast.lang === lg && plast.code === ed.value ? plast : await playRun();
    if (pctl) pctl.abort(); const ctl = pctl = new AbortController(); const stop = H.querySelector('[data-cl="pstop"]'); if (stop) stop.hidden = false;
    box.innerHTML = '<span class="small mute">🧠 Reading your code…</span>';
    const prompt = 'You are a patient coding teacher. The learner is a beginner.\nLanguage: ' + x.n + '\n\nTheir code:\n```\n' + code.slice(0, 8000) + '\n```\n\n' +
      (ran ? 'It was run in a sandbox. This is everything it printed, errors included:\n```\n' + ran.text.slice(0, 3000) + '\n```\n\n' : RUNS[lg] === 'html' ? 'It is shown in a page preview with scripts switched off.\n\n' : 'This language cannot run here, so read the code carefully.\n\n') +
      'Answer in plain, short sentences, in three parts:\n1. **What it does**: explain the code step by step (line by line when it is short). Say what it prints or shows.\n2. **Problems**: any errors, bugs or risky parts, which line they are on, and why they happen. If there are none, write "No problems found."\n3. **Fixed code**: only when there was a problem, the corrected code in one code block.\nDo not guess at output you are not sure of; say so instead.';
    try {
      const all = await A.ai.stream([{ role: 'user', content: prompt }], t => { if (!ctl.signal.aborted && H.querySelector('#plai') === box) box.innerHTML = fmt(t); }, ctl.signal, { temp: 0.2 });
      if (H.querySelector('#plai') === box && !all) box.innerHTML = '<span class="small mute">The AI gave no answer. Check that a model is chosen at the top of the window.</span>';
    } catch (e) { if (!ctl.signal.aborted && H.querySelector('#plai') === box) box.innerHTML = '<span class="small mute">The AI could not answer: ' + esc(e.message || e) + '. Check that a model is chosen at the top of the window.</span>'; }
    if (pctl === ctl) pctl = null; const st = H.querySelector('[data-cl="pstop"]'); if (st) st.hidden = true;
  }

  function draw() {
    if (!H) return; const b = H.querySelector('#clbody'); if (!b) return;
    const page = { play: playPage, lesson: lessonPage, lang: langPage, boss: bossPage, speed: speedPage, ai: aiPage, badges: badgesPage }[view] || home;
    b.innerHTML = '<div class="cl-wrap">' + page() + '</div>';
    const ed = b.querySelector('#clcode'), l = ['lesson', 'boss', 'speed', 'ai'].includes(view) && curL;
    if (ed) {
      if (view === 'play') { editorKeys(ed, plang, () => RUNS[plang] ? playRun() : explain()); let t = null; ed.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => playSave(ed.value), 400); }); }
      else editorKeys(ed, l ? l.lang : lang, () => l && l.ex.k === 'run' ? run() : check());
      if (b.querySelector('#clprev')) { const upd = () => { b.querySelector('#clprev').srcdoc = ed.value; }; let t = null; ed.addEventListener('input', () => { clearTimeout(t); t = setTimeout(upd, 250); }); upd(); }
    }
    /* answer boxes: Enter is a new line, Ctrl+Enter checks; in fill-the-blank Enter moves to the next blank */
    const a = b.querySelector('#clans');
    if (a) { if (l && l.ex.k === 'fix') editorKeys(a, l.lang, check); else { a.setAttribute('data-ownkeys', ''); a.addEventListener('keydown', e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); check(); } }); } if (view === 'speed') a.focus(); }
    const ps = b.querySelector('#plang');
    if (ps) ps.addEventListener('change', () => { if (pctl) pctl.abort(); playSave(ed.value); plang = ps.value; plast = null; const s = pload(); s.lang = plang; try { ls.set(PKEY, JSON.stringify(s)); } catch (e) { } draw(); });
    const bl = [...b.querySelectorAll('[data-blank]')];
    bl.forEach((inp, k) => { inp.setAttribute('data-ownkeys', ''); inp.addEventListener('keydown', e => { if (e.key !== 'Enter') return; e.preventDefault(); if (e.ctrlKey || e.metaKey) return check(); const nx = bl[k + 1] || b.querySelector('[data-cl="check"]'); if (nx) nx.focus(); }); });
    if (view === 'speed' && bl[0]) bl[0].focus();
  }

  /* every answer comes here; lessons award points, bosses and speed rounds keep score, AI practice counts toward its badge */
  function feedback(ok, msg) {
    if (view === 'boss') return bossAnswer(ok);
    if (view === 'speed') return speedAnswer(ok);
    if (view === 'ai') return aiAnswer(ok, msg);
    const l = curL, fb = H.querySelector('#clfb'); if (!fb || !l) return; let extra = '';
    if (ok) {
      const before = load(), first = !before.done[l.id], xp0 = before.xp; let s = C.award(before, l, new Date()); if (shown && first) s.xp = xp0 + 2; s.lang = l.lang; save(s);
      const u = C.unitOf(l.id), list = u ? C.unitLessons(u) : C.byLang(l.lang), nx = list.slice(list.indexOf(l) + 1).find(x => !s.done[x.id]) || list.find(x => !s.done[x.id]);
      const step = nx ? '<button class="pri" data-cl="lesson" data-id="' + nx.id + '">Next: ' + esc(nx.t) + ' →</button>' : u && C.hasBoss(u) && !s.boss[u.id] ? '<button class="pri" data-cl="boss" data-id="' + u.id + '">👑 Unit done! Face the boss →</button>' : '<button class="pri" data-cl="lang" data-id="' + l.lang + '">Back to ' + esc(langOf(l.lang).n) + '</button>';
      extra = '<div class="small" style="margin-top:4px">+' + (s.xp - xp0) + ' points' + (first ? '' : ' for practice') + ' · 🔥 ' + s.streak + '</div><div class="row" style="gap:8px;margin-top:8px">' + step + '</div>';
    }
    fb.className = 'cl-fb ' + (ok ? 'cl-ok' : 'cl-no'); fb.innerHTML = '<b>' + (ok ? '✅ Correct!' : '❌ Not yet.') + '</b> ' + (msg || '') + extra;
  }
  async function run() {
    const l = curL, ed = H.querySelector('#clcode'), out = H.querySelector('#clout'), btn = H.querySelector('[data-cl="run"]'); if (!l || !ed) return;
    if (!A.interp) { out.textContent = 'The code sandbox is not available.'; return; }
    btn.disabled = true; out.textContent = l.lang === 'python' ? 'Running (starting Python)…' : 'Running…';
    let r; try { r = await A.interp.run(l.lang === 'python' ? 'python' : 'js', ed.value); } catch (e) { r = { ok: false, error: String(e.message || e), stdout: '' }; }
    btn.disabled = false; if (!H.querySelector('#clout') || curL !== l) return;
    const text = (r.stdout || '') + (r.ok ? '' : (r.stdout ? '\n' : '') + 'Error: ' + (r.error || 'it did not run'));
    out.textContent = text || '(nothing was printed)';
    if (!r.ok) return view === 'lesson' ? feedback(false, 'The code stopped with an error. Read the last line of the error, fix it and run again.') : (H.querySelector('#clfb').innerHTML = '<span class="small mute">It stopped with an error. Fix it and run again.</span>');
    const c = C.check(l, { code: ed.value, out: r.stdout || '' });
    if (!c.ok && view !== 'lesson') { H.querySelector('#clfb').innerHTML = '<span class="small mute">' + (!c.outOk ? 'The output is not right yet.' : 'Use what the lesson teaches.') + ' Fix it and run again.</span>'; return; }
    feedback(c.ok, c.ok ? '' : !c.outOk ? 'The output should be: <code>' + esc(l.ex.expect).replace(/\n/g, '<br>') + '</code>' : 'The output is right, but use what this lesson teaches' + (l.ex.hint ? ': <code>' + esc(l.ex.hint.split('\n')[0]) + '</code>' : '.'));
  }
  function check() {
    const l = curL; if (!l) return; const ex = l.ex;
    if (ex.k === 'html') { const c = C.check(l, { code: H.querySelector('#clcode').value }); if (!c.ok && view === 'boss') return void (H.querySelector('#clfb').innerHTML = '<span class="small mute">Not complete yet. Keep building, then check again.</span>'); return feedback(c.ok, c.ok ? 'Look at your page in the preview.' : 'Something is still missing. Try the hint.'); }
    if (ex.k === 'predict') { const c = C.check(l, { text: H.querySelector('#clans').value }); return feedback(c.ok, c.ok ? '' : 'Read it line by line. ' + esc(ex.hint || '')); }
    if (ex.k === 'fix') { const c = C.check(l, { text: H.querySelector('#clans').value }); return feedback(c.ok, c.ok ? '' : esc(ex.hint || 'Look closely at that line.')); }
    if (ex.k === 'blank') { const ins = [...H.querySelectorAll('[data-blank]')], c = C.check(l, { vals: ins.map(i => i.value) }); ins.forEach((inp, k) => { inp.style.borderColor = c.marks[k] ? 'var(--ok,#3a3)' : 'var(--bad,#c33)'; }); return feedback(c.ok, c.ok ? '' : 'The red boxes are not right yet.'); }
  }
  function showAnswer() {
    const l = curL, ex = l.ex; shown = true;
    if (ex.k === 'run' || ex.k === 'html') { const ed = H.querySelector('#clcode'); ed.value = ex.sol; ed.dispatchEvent(new Event('input')); }
    else if (ex.k === 'predict' || ex.k === 'fix') H.querySelector('#clans').value = ex.ans[0];
    else if (ex.k === 'blank') H.querySelectorAll('[data-blank]').forEach((inp, k) => { inp.value = ex.ans[k][0]; });
    else if (ex.k === 'choice') H.querySelectorAll('.cl-opt').forEach(b => { if (+b.dataset.i === ex.a) b.style.outline = '2px solid var(--ok,#3a3)'; });
    const fb = H.querySelector('#clfb'); fb.className = 'cl-fb'; fb.innerHTML = '<span class="small mute">Here is the answer. ' + (ex.k === 'run' ? 'Run it to see it work.' : 'Check it to move on.') + (view === 'lesson' ? ' (Fewer points when the answer was shown.)' : '') + '</span>';
  }
  function onClick(e) {
    const el = e.target.closest('[data-cl]'); if (!el || !H.contains(el)) return; const k = el.dataset.cl;
    if (el.tagName === 'A') e.preventDefault();
    if (k === 'home') return go('home');
    if (k === 'play') return go('play');
    if (k === 'badges') return go('badges');
    if (k === 'prun') return playRun();
    if (k === 'pexp') return explain();
    if (k === 'pstop') { if (pctl) pctl.abort(); pctl = null; el.hidden = true; const bx = H.querySelector('#plai'); if (bx) bx.insertAdjacentHTML('beforeend', '<div class="small mute">(stopped)</div>'); return; }
    if (k === 'pclear') { const ed = H.querySelector('#clcode'); ed.focus(); ed.select(); if (!document.execCommand('delete')) ed.value = ''; ed.dispatchEvent(new Event('input')); playSave(''); plast = null; const o = H.querySelector('#clout'); if (o) o.textContent = ''; const bx = H.querySelector('#plai'); if (bx) bx.innerHTML = ''; return; }
    if (k === 'lang') return go('lang', el.dataset.id);
    if (k === 'lesson') { const l = lessonById(el.dataset.id); if (l) { lang = l.lang; go('lesson', l.id); } return; }
    if (k === 'boss') return startBoss(el.dataset.id);
    if (k === 'bnext') return bossNext();
    if (k === 'speed') return startSpeed(el.dataset.id);
    if (k === 'topic') return startTopic(el.dataset.u, el.dataset.t);
    if (k === 'ateach') return aiTeach();
    if (k === 'aq') return aiQuestion();
    if (k === 'astop') { if (aictl) aictl.abort(); aictl = null; if (ai) { ai.busy = ''; draw(); } return; }
    if (k === 'areveal') { if (curL) showAnswer(); return; }
    if (k === 'run') return run();
    if (k === 'check') return check();
    if (k === 'show') return showAnswer();
    if (k === 'reset') { const ed = H.querySelector('#clcode'); ed.value = curL.ex.code; ed.dispatchEvent(new Event('input')); const o = H.querySelector('#clout'); if (o) o.textContent = ''; H.querySelector('#clfb').innerHTML = ''; H.querySelector('#clfb').className = ''; return; }
    if (k === 'hint') { const fb = H.querySelector('#clfb'); fb.className = 'cl-fb'; fb.innerHTML = '💡 <code style="white-space:pre-wrap">' + esc(curL.ex.hint || 'Read the lesson text again.') + '</code>'; return; }
    if (k === 'pick') {
      const l = curL, i = +el.dataset.i, ok = i === l.ex.a; H.querySelectorAll('.cl-opt').forEach(b => { b.disabled = true; if (+b.dataset.i === l.ex.a) b.style.outline = '2px solid var(--ok,#3a3)'; }); if (!ok) el.style.outline = '2px solid var(--bad,#c33)';
      if (view === 'lesson') return feedback(ok, ok ? '' : 'The right answer is marked in green. <button class="ib" data-cl="lesson" data-id="' + l.id + '">Try again</button>');
      if (view === 'ai' && !ok) { const fb = H.querySelector('#clfb'); fb.className = 'cl-fb cl-no'; fb.innerHTML = '<b>❌ Not this time.</b> The right answer is marked in green.<div style="margin-top:8px"><button class="pri" data-cl="aq">✏️ Another question</button></div>'; return; }
      return feedback(ok);
    }
  }
  A.codeLessons = {
    render: host => {
      H = host; if (!document.getElementById('codelcss')) { const s = document.createElement('style'); s.id = 'codelcss'; s.textContent = css; document.head.appendChild(s); }
      host.innerHTML = '<div class="scroll pad" id="clbody" style="flex:1;min-height:0"></div>'; if (!host._clBound) { host.addEventListener('click', onClick); host._clBound = true; }
      { const s = load(); if (C.newBadges(s).length) store(s); } /* badges already earned before badges existed */
      draw();
    },
    open: id => { if (id) { const l = lessonById(id); if (l) { lang = l.lang; view = 'lesson'; curL = l; shown = false; } } A.cybertab.go('code'); if (H) draw(); },
  };
})();

// Cyber › 💻 Coding: a full coding course in 21 subjects (20 languages plus binary), all offline.
// Each language is a map of units from first steps to expert (UNITS in code-lessons-data.js). A unit has hand-written lessons,
// 🛠 mini projects, a 👑 boss (a mixed test that unlocks the next unit) and 🤖 AI topics: the local AI teaches any topic in the unit
// and writes practice questions on it. ⚡ Speed rounds are 60 seconds of quick-fire questions. Ranks and 🎖 badges reward progress.
// Python and JavaScript run in the chat's sandbox (web/js/interp.js); HTML runs on the sandboxed Screen (web/js/code-stage.js)
// with scripts on and no network, so games can be played, and JavaScript can be run as a page there too (canvas, keyboard, games);
// the other languages use "what does it print", "fix the bug", "fill the blank" and multiple choice, checked against stored answers.
// Code boxes act like an editor: Enter is a new line that keeps the indent, Ctrl+Enter runs or checks (keyboard.js leaves [data-ownkeys] alone).
// 🧪 Playground: 84 languages listed in code-playground-langs.js. Python, JavaScript, HTML and SQL run in the browser; esoteric
// languages, Scheme, Prolog, Forth and BASIC run in esolang-worker.js; compiled languages use this PC's tools or the Docker image.
// Like the Terminal playground it has three modes: Sandbox, 🧩 Challenges and 🌀 Code Labyrinth (puzzles from code-challenges.js).
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
    '.cl-figs{display:grid;gap:10px;margin:8px 0}' +
    '.cl-fig{margin:0;background:var(--panel2);border:1px solid var(--line);border-radius:10px;padding:8px;text-align:center}' +
    '.cl-fig img{max-width:100%;height:auto;border-radius:6px;background:#fff;cursor:zoom-in}' +
    '.cl-fig figcaption{margin-top:4px}' +
    '.cl-pre .ln{display:inline-block;width:2.2em;color:var(--mute);user-select:none}.cl-pre .bug{background:color-mix(in srgb,var(--bad,#c33) 22%,transparent)}.cl-pre input{font:inherit;width:7em;padding:1px 4px;border-radius:4px;border:1px solid var(--acc);background:var(--bg);color:inherit}' +
    '.cl-row{cursor:pointer;display:flex;gap:10px;align-items:center;padding:9px 10px;border-radius:8px;border-bottom:1px solid var(--line)}.cl-row:hover{background:var(--panel2)}.cl-fb{margin-top:10px;padding:10px;border-radius:8px}.cl-ok{background:color-mix(in srgb,var(--ok,#3a3) 18%,transparent)}.cl-no{background:color-mix(in srgb,var(--bad,#c33) 16%,transparent)}' +
    '.cl-prev{width:100%;height:220px;border:1px solid var(--line);border-radius:8px;background:#fff}.cl-opt{display:block;width:100%;text-align:left;margin:6px 0;padding:10px 12px}' +
    '.cl-ans{flex:1;min-width:220px;min-height:2.6em;box-sizing:border-box;font:13px/1.5 Consolas,"Cascadia Mono",monospace;padding:6px 8px;border-radius:8px;border:1px solid var(--line);background:var(--panel2);color:var(--fg,inherit);resize:vertical}' +
    '.cl-keys{margin-top:4px}.cl-keys kbd{font:11px Consolas,monospace;padding:0 4px;border:1px solid var(--line);border-radius:4px}.cl-ai{line-height:1.6;margin-top:10px}.cl-ai code{font-family:Consolas,monospace;background:var(--panel2);padding:0 3px;border-radius:3px}' +
    '.cl-unit.lock{opacity:.6}.cl-chip{display:inline-block;margin:3px 4px 3px 0;padding:4px 10px;border-radius:999px;border:1px solid var(--line);background:var(--panel2);cursor:pointer;font-size:13px}.cl-chip:hover{border-color:var(--acc)}' +
    '.cl-boss{border-color:color-mix(in srgb,var(--acc) 60%,var(--line))}.cl-big{font-size:30px;font-weight:700}.cl-badge{text-align:center;padding:12px}.cl-badge.off{opacity:.35;filter:grayscale(1)}.cl-badge .ic{font-size:30px}' +
    '.cl-pnote{margin:0 0 8px;padding:8px 10px;border-radius:8px;border:1px solid var(--line);background:var(--panel2);font-size:13px;line-height:1.45}.cl-pno{border-color:color-mix(in srgb,var(--bad,#c33) 45%,var(--line));background:color-mix(in srgb,var(--bad,#c33) 9%,transparent)}';
  /* Python, JavaScript and HTML run here; every language can be explained by the AI */
  const RUNS = { python: 'python', javascript: 'js', html: 'html' };
  /* the editor's own language name (web/js/code-ed.js), so a lesson's code is coloured in its real language */
  const ceLang = id => ({ python: 'py', javascript: 'js', html: 'html', scratch: 'txt', css: 'css', bash: 'sh', shell: 'sh', sql: 'sql', json: 'json', nodejs: 'js', typescript: 'js', jscript: 'js' }[id] || 'txt');
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
        e.preventDefault(); const pl = window.PlayLangs && PlayLangs.byId(lg), mark = COMMENT[lg] !== undefined ? COMMENT[lg] : pl ? pl.cm || '' : '//'; if (!mark) return;
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
    cancelPlay(); if (aictl) { aictl.abort(); aictl = null; } if (sp && sp.timer) { clearInterval(sp.timer); sp.timer = null; }
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
    return '<div class="dw-gateway"><div><b>Debug workshop</b><small>Endless repair tickets in 82 languages at three difficulty levels: real broken functions for JavaScript and Python (run against test cases), and one quietly changed token to find in every other language.</small></div><button class="ib" data-cl="workshop">Open a repair ticket →</button></div>' + rankCard(s) +
      '<div class="cl-card cl-lang" data-cl="slab" style="margin-bottom:12px"><div class="row" style="gap:12px;align-items:center"><div style="font-size:28px">🦠</div><div style="flex:1"><b>Sample lab</b><div class="small mute" style="line-height:1.45">Paste or drop a suspicious file and read what it is and what it says it does — hashes, sections, scripts, addresses, registry keys. Nothing runs; behaviour comes only from a disposable Windows Sandbox VM.</div></div><span class="small" style="color:var(--acc)">Open →</span></div></div>' +
      '<div class="cl-card cl-lang" data-cl="play" style="margin-bottom:12px"><div class="row" style="gap:12px;align-items:center"><div style="font-size:28px">🧪</div><div style="flex:1"><b>Code playground</b><div class="small mute" style="line-height:1.45">' + (window.PlayLangs ? PlayLangs.LANGS.length + ' languages, from Python and C to Brainfuck and Shakespeare. ' : '') + 'Run programs offline, preview HTML and CSS, or ask the AI to explain your code.</div></div><span class="small" style="color:var(--acc)">Open →</span></div></div>' +
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
    if (ex.k === 'run') return '<textarea class="cl-ed" id="clcode" data-lang="' + ceLang(l.lang) + '" spellcheck="false">' + esc(ex.code) + '</textarea>' + keysTip('runs and checks') + '<div class="row" style="gap:8px;margin-top:8px;flex-wrap:wrap"><button class="pri" data-cl="run">▶ Run and check</button><button class="ib" data-cl="reset">Start over</button>' + hs + (l.lang === 'python' ? '<span class="small mute">Python takes a few seconds to start the first time.</span>' : '') + '</div><div class="small mute" style="margin-top:8px">Output</div><pre class="cl-pre" id="clout" style="min-height:2.5em"></pre><div class="cl-figs" id="clfig"></div>';
    if (ex.k === 'html') return '<textarea class="cl-ed" id="clcode" data-lang="html" spellcheck="false">' + esc(ex.code) + '</textarea>' + keysTip('checks') + '<div class="small mute" style="margin:8px 0 4px">Live preview</div><iframe class="cl-prev" id="clprev" sandbox="" title="Preview"></iframe><div class="row" style="gap:8px;margin-top:8px;flex-wrap:wrap"><button class="pri" data-cl="check">✓ Check</button><button class="ib" data-cl="reset">Start over</button>' + hs + '</div>';
    if (ex.k === 'predict') return '<b>' + esc(ex.q || 'What does this print?') + '</b>' + codeWithLines(ex.code) + '<div class="row" style="gap:8px;flex-wrap:wrap"><textarea id="clans" class="cl-ans" rows="1" spellcheck="false" autocomplete="off" placeholder="Type the output (Enter makes a new line)"></textarea><button class="pri" data-cl="check">✓ Check</button>' + hs + '</div><div class="small mute cl-keys"><kbd>Ctrl</kbd>+<kbd>Enter</kbd> checks · <kbd>Enter</kbd> new line</div>';
    if (ex.k === 'fix') return '<b>Line ' + ex.line + ' has a bug. Type the corrected line.</b>' + codeWithLines(ex.code, ex.line) + '<div class="row" style="gap:8px;flex-wrap:wrap"><textarea id="clans" class="cl-ans" rows="1" spellcheck="false" autocomplete="off">' + esc(ex.code.split('\n')[ex.line - 1].trim()) + '</textarea><button class="pri" data-cl="check">✓ Check</button>' + hs + '</div>' + keysTip('checks');
    if (ex.k === 'blank') return '<b>Fill in the blank' + (ex.ans.length > 1 ? 's' : '') + '.</b>' + blanksHtml(ex.code) + '<div class="row" style="gap:8px;flex-wrap:wrap"><button class="pri" data-cl="check">✓ Check</button>' + hs + '</div><div class="small mute cl-keys"><kbd>Enter</kbd> or <kbd>Tab</kbd> next blank · <kbd>Ctrl</kbd>+<kbd>Enter</kbd> checks</div>';
    if (ex.k === 'choice') return '<b>' + esc(ex.q) + '</b>' + (ex.code ? codeWithLines(ex.code) : '') + ex.opts.map((o, k) => '<button class="ib cl-opt" data-cl="pick" data-i="' + k + '">' + esc(o) + '</button>').join('');
    return '';
  }
  /* ----- Scratch lessons get the real block editor, not a textarea: the lesson's script arrives as blocks ----- */
  function scratchStart(l) {
    const ex = (l && l.ex) || {};
    if (ex.sol) return ex.sol;
    let k = 0;
    return String(ex.code || '').replace(/___/g, () => {
      const a = (ex.ans && ex.ans[k++]) || [];
      return a[0] || '___';
    });
  }
  function scratchLessonBody(l) {
    return '<div class="cl-card"><b>🧩 Build it with blocks</b>' +
      '<div class="small mute" style="margin:4px 0 8px">The same drag-and-drop editor as the Playground, loaded with this lesson\'s script. Drag blocks in, move them about, nest them in a repeat, then run it and watch the cat.</div>' +
      '<textarea id="clscode" aria-label="Scratch script" spellcheck="false" style="display:none">' + esc(scratchStart(l)) + '</textarea>' +
      '<div id="clscrblocks"></div>' +
      '<div class="row" style="gap:8px;margin-top:10px;flex-wrap:wrap"><button class="pri" data-cl="scrrun">▶ Run on the screen</button><button class="ib" data-cl="scrstop" hidden>■ Stop</button><button class="ib" data-cl="scrreset">↺ Lesson script</button></div>' +
      '<div class="small mute" style="margin-top:8px">Screen · the cat follows your blocks; click the screen, then use the keys</div>' +
      '<pre class="cl-pre" id="clscrout" role="status" style="min-height:2em"></pre>' +
      '<div id="clscrstage" style="margin-top:8px"></div></div>';
  }
  function lessonPage() {
    const l = curL; if (!l) return home(); const x = langOf(l.lang), u = C.unitOf(l.id), list = u ? C.unitLessons(u) : C.byLang(l.lang), i = list.indexOf(l), done = load().done[l.id];
    return '<div class="row" style="gap:8px;margin-bottom:10px;flex-wrap:wrap"><button class="ib" data-cl="lang" data-id="' + l.lang + '">← ' + esc(x.n) + '</button><span class="small mute">' + (u ? 'Unit ' + u.n + ' · ' + esc(u.t) + ' · ' : '') + C.LEVELS[l.lv] + ' · ' + (l.proj ? '🛠 mini project' : 'lesson ' + (i + 1) + ' of ' + list.length) + (done ? ' · ✅ done' : '') + '</span></div>' +
      '<div class="cl-card"><b style="font-size:18px">' + (l.proj ? '🛠️' : x.ic) + ' ' + esc(l.t) + '</b><div style="margin-top:6px;line-height:1.6">' + esc(l.teach) + '</div></div><div class="cl-card">' + exBody(l, true) + '<div id="clfb"></div></div>' +
      (l.lang === 'scratch' ? scratchLessonBody(l) : '');
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
  /* Pictures a program made (pygame frames, turtle drawings, matplotlib charts) are part of its output, so every run
     shows them under the text. Click one to see it full size. */
  function showFigures(host, figs) {
    if (!host) return;
    const list = (figs || []).filter(Boolean);
    host.innerHTML = list.length ? list.map((b64, i) => '<figure class="cl-fig"><img src="data:image/png;base64,' + b64 + '" alt="Picture ' + (i + 1) + ' drawn by the program" loading="lazy"><figcaption class="small mute">Picture ' + (i + 1) + (list.length > 1 ? ' of ' + list.length : '') + ' · click to enlarge</figcaption></figure>').join('') : '';
    host.querySelectorAll('img').forEach(img => { img.onclick = () => enlargFigure(img.src); });
  }
  function enlargFigure(src) {
    const old = document.getElementById('clbig'); if (old) old.remove();
    const box = document.createElement('div');
    box.id = 'clbig';
    box.style.cssText = 'position:fixed;inset:0;background:rgba(4,7,12,.86);display:flex;align-items:center;justify-content:center;z-index:9999;cursor:zoom-out;padding:24px';
    box.innerHTML = '<img src="' + src + '" style="max-width:100%;max-height:100%;border-radius:10px;background:#fff" alt="Program output">';
    box.onclick = () => box.remove();
    document.addEventListener('keydown', function esc(e) { if (e.key === 'Escape') { box.remove(); document.removeEventListener('keydown', esc); } });
    document.body.appendChild(box);
  }
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

  /* ----- Code Playground: the languages and their examples are in web/js/code-playground-langs.js ----- */
  const PL = window.PlayLangs, PKEY = 'codeplay';
  const plangOf = id => PL.byId(id) || PL.byId('python');
  const MINI = PL.MINI;
  /* what the server can run, from GET /api/code-playground/status:
     { sandbox: {available, languages}, docker: {installed, running, image, ready, reason}, backend: {id: 'windows-sandbox'|'docker'} } */
  const noStatus = () => ({ sandbox: { available: false, languages: [] }, docker: { installed: false, running: false, image: false, ready: false }, backend: {} });
  let pstat = null, pstatAsk = null;
  function askStatus() {
    if (pstat || pstatAsk) return;
    pstatAsk = fetch('/api/code-playground/status').then(r => r.json()).then(s => {
      pstat = s && s.sandbox && s.docker && s.backend ? s : noStatus();
    }).catch(() => { pstat = noStatus(); pstat.failed = true; })
      .finally(() => { pstatAsk = null; if (view === 'play' && !prun) draw(); });
  }
  /* where a language runs now: app, mini, eso, pc (Windows Sandbox), docker or none (with the reason). The rules live
     in code-playground-langs.js so every language always has a reason, including while the status is still loading. */
  function where(l) { return PL.route(l, pstat); }
  const pload = () => {
    let state;
    try { state = JSON.parse(ls.get(PKEY, '{}')); } catch (e) { }
    const obj = v => v && typeof v === 'object' && !Array.isArray(v) ? v : {};
    return { lang: PL.byId(state?.lang) ? state.lang : 'python', code: obj(state?.code), inp: obj(state?.inp), page: !!state?.page };
  };
  let plang = pload().lang, plast = null, pctl = null, prun = null, pstage = null, ptpStop = null;
  const pstore = s => { try { ls.set(PKEY, JSON.stringify(s)); } catch (e) { } };
  const playSave = code => { const s = pload(); s.lang = plang; s.code[codeKey()] = String(code).slice(0, 50000); pstore(s); };
  const inputSave = text => { const s = pload(); s.inp[plang] = String(text).slice(0, 20000); pstore(s); };
  /* the AI reply as safe HTML: everything escaped, then code blocks, `code` and **bold** */
  const fmt = t => String(t || '').split(/```[^\n`]*\n?([\s\S]*?)(?:```|$)/).map((p, i) => i % 2 ? '<pre class="cl-pre">' + esc(p.replace(/\n$/, '')) + '</pre>' : esc(p).replace(/`([^`\n]+)`/g, '<code>$1</code>').replace(/\*\*([^*\n]+)\*\*/g, '<b>$1</b>').replace(/^#{1,4} +(.+)$/gm, '<b>$1</b>').replace(/\n/g, '<br>')).join('');
  function playNote(x, w) {
    if (w.checking) return '<div class="cl-pnote" id="plnote">🛡️ Checking which safe sandboxes are available…</div>';
    if (w.g === 'none') return '<div class="cl-pnote cl-pno" id="plnote">⛔ <b>' + esc(x.n) + ' cannot run safely here.</b> ' + esc(w.why) + ' The example shows what it looks like, and 🧠 Explain still works.</div>';
    if (w.g === 'pc') return '<div class="cl-pnote" id="plnote">🛡️ ' + esc(x.how || '') + ' Runs in <b>Windows Sandbox</b>: a disposable, isolated Windows VM with networking, clipboard, printer and camera/microphone sharing turned off. The first run can take a minute while it starts.</div>';
    if (w.g === 'docker') return '<div class="cl-pnote" id="plnote">🐳 ' + esc(x.how || '') + ' Runs in the Playground\'s <b>Docker sandbox</b>: no network, read-only filesystem, unprivileged user, 1 GB memory and a time limit.' + (x.id === 'powershell' ? ' This is Linux PowerShell 7, not Windows PowerShell.' : '') + '</div>';
    return x.how ? '<div class="cl-pnote" id="plnote">' + (w.g === 'eso' || w.g === 'mini' ? '🧩 ' : '') + esc(x.how) + '</div>' : '';
  }
  /* One-time setup for the safe backends. Shown only when it can actually help: the language needs Windows
     Sandbox or Docker, and that backend is not ready right now (or PowerShell is running in Docker and the
     learner might want Windows PowerShell instead). */
  function setupHTML(x, w) {
    if (w.checking) return '';
    const sb = PL.SANDBOX.includes(x.id), dkLang = PL.DOCKER.includes(x.id);
    const dk = (pstat && pstat.docker) || {};
    const parts = [];
    if (sb && w.g !== 'pc') {
      parts.push('<b>Windows Sandbox</b>: on Windows 11 Pro, Enterprise or Education, open <i>Turn Windows features on or off</i>, tick <b>Windows Sandbox</b>, restart, then reopen the app. It needs administrator rights. Runs happen in a disposable VM with networking, clipboard, printer and camera/microphone sharing turned off.');
    }
    if (dkLang && w.g !== 'docker') {
      const lead = dk.installed && !dk.running ? 'Docker is installed. Start Docker Desktop and wait until it says the engine is running.'
        : dk.running && !dk.image ? 'Docker is running. From the app folder, build the Playground image once:'
          : 'Install Docker Desktop and start it in Linux container mode. Then, from the app folder, build the Playground image once:';
      parts.push('<b>Docker</b>: ' + lead + ' <code>docker build --platform=linux/amd64 -t moundshroud-code-playground:1 lib/code-playground</code> After that, Docker runs work offline with no network.');
    }
    if (!parts.length) return '';
    return '<details class="small mute" id="plruntime"' + (w.g === 'none' ? ' open' : '') + '><summary>Safe runtime setup</summary>' + parts.map(p => '<p style="margin:6px 0">' + p + '</p>').join('') + '</details>';
  }
  /* ----- Playground modes, like the Terminal playground: 🧪 Sandbox, 🧩 Challenges (code-challenges.js) and 🌀 Code Labyrinth ----- */
  const CC = window.CodeChallenges, CKEY = 'codechal';
  let pmode = ['sandbox', 'chal', 'lab'].includes(ls.get('codeplay_mode', 'sandbox')) ? ls.get('codeplay_mode', 'sandbox') : 'sandbox';
  const cload = () => { let s = {}; try { s = JSON.parse(ls.get(CKEY, '{}')) || {}; } catch (e) { } s = Object.assign({ diff: 'easy', cats: CC ? CC.CATS.map(c => c[0]) : [], seed: 1 + Math.floor(Math.random() * 99999), pts: 0, solved: 0, done: {}, depth: 1, best: 0, labSeed: 1 + Math.floor(Math.random() * 99999), custom: [], cust: -1, shown: {} }, s); ['done', 'shown'].forEach(k => { if (!s[k] || typeof s[k] !== 'object') s[k] = {}; }); if (!Array.isArray(s.custom)) s.custom = []; if (!ls.get(CKEY, '')) csave(s); return s; };
  const csave = s => { try { ls.set(CKEY, JSON.stringify(s)); } catch (e) { } };
  const runnableIds = () => PL.LANGS.filter(l => where(l).g !== 'none' && !['html', 'binary', 'sql'].includes(l.run)).map(l => l.id);
  /* the puzzle on screen: a custom one, a Challenges puzzle, or the Labyrinth floor */
  function curChal() {
    if (!CC || pmode === 'sandbox') return null;
    const s = cload();
    if (pmode === 'lab') return Object.assign(CC.floor(s.depth, s.labSeed, pstat ? runnableIds() : PL.LANGS.filter(l => !['docker', 'none', 'html', 'binary', 'sql'].includes(l.run)).map(l => l.id)), { key: 'lab:' + s.labSeed + ':' + s.depth });
    if (s.cust >= 0 && s.custom[s.cust]) { const c = s.custom[s.cust]; return { t: c.t, task: c.task, ans: c.ans, pts: 5, diff: 'custom', custom: true, key: 'cus:' + c.id }; }
    const c = CC.make(s.diff, s.cats, s.seed); c.key = 'chl:' + s.diff + ':' + s.seed + ':' + c.t; return c;
  }
  const codeKey = () => pmode === 'sandbox' ? plang : pmode + ':' + plang;
  function modeTabs() {
    return '<div class="row" style="gap:6px;flex-wrap:wrap;margin-top:10px">' + [['sandbox', '🧪 Sandbox'], ['chal', '🧩 Challenges'], ['lab', '🌀 Code Labyrinth']].map(([m, l]) => '<button class="ib' + (pmode === m ? ' on' : '') + '" data-cl="pmode" data-m="' + m + '"' + (pmode === m ? ' style="border-color:var(--acc);color:var(--acc)"' : '') + '>' + l + '</button>').join('') + '</div>';
  }
  function chalCard(c) {
    if (!c) return '';
    const s = cload(), done = !!s.done[c.key], d = CC.DIFFS.find(x => x.id === c.diff);
    let head = '';
    if (pmode === 'chal') {
      head = '<div class="row" style="gap:6px;flex-wrap:wrap;align-items:center;margin-bottom:8px">' + CC.DIFFS.map(x => '<button class="ib" data-cl="pdiff" data-d="' + x.id + '"' + (s.cust < 0 && s.diff === x.id ? ' style="border-color:' + 'var(--acc);color:var(--acc)"' : '') + ' title="' + esc(x.note) + '">' + x.ic + ' ' + x.label + '</button>').join('') +
        '<span class="small mute" style="margin-left:6px">' + CC.CATS.map(([k, l]) => '<label style="margin-right:8px;white-space:nowrap"><input type="checkbox" data-cl="pcat" data-c="' + k + '"' + (s.cats.includes(k) ? ' checked' : '') + '> ' + l + '</label>').join('') + '</span></div>' +
        '<div class="row" style="gap:6px;flex-wrap:wrap;align-items:center;margin-bottom:8px"><button class="ib" data-cl="pnew">🎲 New puzzle</button><label class="small mute">Seed <input id="plseed" value="' + s.seed + '" style="width:7em" aria-label="Seed"></label><button class="ib" data-cl="pseed">Load seed</button><span class="small mute" id="plpts">⭐ ' + s.pts + ' points · ' + s.solved + ' solved</span></div>';
    } else {
      head = '<div class="row" style="gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:8px"><b>🌀 Floor ' + s.depth + '</b><span class="small mute">' + esc(c.tier || '') + (c.scale > 1 ? ' · size ×' + c.scale : '') + ' · Deepest: ' + s.best + ' · ⭐ ' + s.pts + ' points · run ' + s.labSeed + '</span><button class="ib" data-cl="plabnew" style="margin-left:auto">↺ New descent</button></div>';
    }
    const lock = c.lang ? '<div class="small" style="margin:6px 0">🔒 This ' + (pmode === 'lab' ? 'floor' : 'puzzle') + ' only opens to <b>' + esc(plangOf(c.lang).n) + '</b>.</div>' : '';
    return '<div class="cl-pnote cl-pchal" id="plchal">' + head +
      '<div><b>' + (c.gate ? '🚪 ' : d ? d.ic + ' ' : '✏️ ') + esc(c.t) + '</b> <span class="small mute">' + (c.custom ? 'your puzzle' : c.gate ? 'esoteric gate' : esc(d.label)) + ' · ' + c.pts + ' points' + (done ? ' · ✅ solved' : '') + '</span></div>' +
      '<div class="cl-pre" style="margin:6px 0">' + esc(c.task) + '</div>' + lock +
      '<div class="small mute">Write a program that prints the answer, then press <b>▶ Run and check</b>. Spaces at line ends do not matter.</div>' +
      (s.shown[c.key] ? '<div class="small" style="margin-top:6px">Answer: <code>' + esc(c.ans) + '</code></div>' : '') +
      '<div id="plchk"></div>' +
      (pmode === 'chal' ? '<details class="small" style="margin-top:8px"' + (s.custom.length ? '' : '') + '><summary class="mute" style="cursor:pointer">✏️ My own puzzles (' + s.custom.length + ')</summary>' +
        s.custom.map((x, i) => '<div class="row" style="gap:6px;align-items:center;margin:4px 0"><span style="flex:1">' + esc(x.t) + '</span><button class="ib" data-cl="pcsolve" data-i="' + i + '">Solve</button><button class="ib" data-cl="pcdel" data-i="' + i + '">Delete</button></div>').join('') +
        (s.cust >= 0 ? '<button class="ib" data-cl="pcback" style="margin:4px 0">← Back to generated puzzles</button>' : '') +
        '<div style="display:grid;gap:6px;margin-top:6px"><input id="pct" placeholder="Title" maxlength="80"><textarea id="pctask" class="cl-ans" rows="3" placeholder="The task: what should the program print?" maxlength="4000" data-ownkeys></textarea><textarea id="pcans" class="cl-ans" rows="2" placeholder="The exact expected output" maxlength="4000" data-ownkeys></textarea><button class="ib" data-cl="pcadd">Save puzzle</button></div></details>' : '') +
      '</div>';
  }
  /* after a run in Challenges or the Labyrinth: compare stdout with the answer */
  function judge(r, lg) {
    const c = curChal(), box = H && H.querySelector('#plchk'); if (!c || !box) return;
    if (c.lang && c.lang !== lg) { box.innerHTML = '<div class="cl-fb cl-no">🔒 This one only counts in ' + esc(plangOf(c.lang).n) + '. Switch the language and run again.</div>'; return; }
    if (!r.ok && !r.stdout) { box.innerHTML = '<div class="cl-fb cl-no">❌ The program did not finish. Fix the error and run again.</div>'; return; }
    if (CC.check(r.stdout, c.ans)) {
      const s = cload(), first = !s.done[c.key];
      if (first) { s.done[c.key] = 1; s.solved++; if (!s.shown[c.key]) s.pts += c.pts; }
      if (pmode === 'lab') { s.best = Math.max(s.best, s.depth); }
      csave(s);
      const pe = H.querySelector('#plpts'); if (pe) pe.textContent = '⭐ ' + s.pts + ' points · ' + s.solved + ' solved';
      if (pmode === 'lab') { const from = s.depth; clearTimeout(descendTimer); descendTimer = setTimeout(() => descend(from), 1800); }
      box.innerHTML = '<div class="cl-fb cl-ok">✅ <b>Correct!</b> ' + (first && !s.shown[c.key] ? '+' + c.pts + ' points.' : '') + (pmode === 'lab' ? ' Descending to floor ' + (s.depth + 1) + '… <button class="pri" data-cl="pdown" data-from="' + s.depth + '">⬇ Go now</button>' : ' <button class="pri" data-cl="pnew">🎲 Next puzzle</button>') + '</div>';
      return;
    }
    const got = CC.norm(r.stdout).split('\n'), want = CC.norm(c.ans).split('\n');
    const line = got.findIndex((l, i) => l !== want[i]), at = line < 0 ? got.length : line;
    box.innerHTML = '<div class="cl-fb cl-no">❌ Not yet. ' + (got.length !== want.length ? 'The answer has ' + want.length + ' line' + (want.length > 1 ? 's' : '') + '; your program printed ' + got.length + '. ' : '') + 'First difference on line ' + (at + 1) + ': you printed <code>' + esc((got[at] || '(nothing)').slice(0, 120)) + '</code>.' + (pmode === 'chal' && !c.custom ? ' <button class="ib" data-cl="pshow">Show the answer (no points)</button>' : '') + '</div>';
  }
  /* the Labyrinth moves to the next floor by itself after a correct run: once only, with an empty editor and output */
  let descendTimer = null;
  function descend(from) {
    clearTimeout(descendTimer); descendTimer = null;
    const s = cload(); if (pmode !== 'lab' || s.depth !== from) return;
    s.depth = from + 1; csave(s);
    const st = pload(); Object.keys(st.code).forEach(k => { if (/^lab:/.test(k)) delete st.code[k]; }); pstore(st);
    const c = curChal(); if (c && c.lang) plang = c.lang;
    if (view === 'play' && H) { draw(); try { A.toast('🌀 Floor ' + s.depth + ' · ' + c.tier, 2500); } catch (e) { } }
  }
  function chalClick(k, el) {
    const s = cload();
    if (k === 'pmode') { clearTimeout(descendTimer); cancelPlay(); pmode = el.dataset.m; ls.set('codeplay_mode', pmode); const c = curChal(); if (c && c.lang) plang = c.lang; draw(); return true; }
    if (k === 'pcat') { const on = [...H.querySelectorAll('[data-cl="pcat"]')].filter(x => x.checked).map(x => x.dataset.c); if (!on.length) { el.checked = true; return true; } s.cats = on; s.cust = -1; s.seed = 1 + Math.floor(Math.random() * 99999); csave(s); draw(); return true; }
    if (k === 'pdiff') { s.diff = el.dataset.d; s.cust = -1; s.seed = 1 + Math.floor(Math.random() * 99999); csave(s); draw(); return true; }
    if (k === 'pnew') { s.seed = 1 + Math.floor(Math.random() * 99999); s.cust = -1; csave(s); draw(); return true; }
    if (k === 'pseed') { const v = parseInt((H.querySelector('#plseed') || {}).value, 10); if (v > 0) { s.seed = v; s.cust = -1; csave(s); draw(); } return true; }
    if (k === 'pshow') { const c = curChal(); if (c) { s.shown[c.key] = 1; csave(s); draw(); } return true; }
    if (k === 'pdown') { descend(+el.dataset.from || s.depth); return true; }
    if (k === 'plabnew') { clearTimeout(descendTimer); s.depth = 1; s.labSeed = 1 + Math.floor(Math.random() * 99999); csave(s); draw(); return true; }
    if (k === 'pcadd') {
      const t = (H.querySelector('#pct').value || '').trim(), task = (H.querySelector('#pctask').value || '').trim(), ans = H.querySelector('#pcans').value || '';
      if (!t || !task || !CC.norm(ans)) { A.toast('Give the puzzle a title, a task and the expected output.'); return true; }
      s.custom.push({ id: Date.now().toString(36), t, task, ans }); s.cust = s.custom.length - 1; csave(s); draw(); return true;
    }
    if (k === 'pcsolve') { s.cust = +el.dataset.i; csave(s); draw(); return true; }
    if (k === 'pcdel') { s.custom.splice(+el.dataset.i, 1); if (s.cust >= s.custom.length) s.cust = -1; csave(s); draw(); return true; }
    if (k === 'pcback') { s.cust = -1; csave(s); draw(); return true; }
    return false;
  }
  function playPage() {
    const ch = curChal(); if (ch && ch.lang) plang = ch.lang;
    const x = plangOf(plang), st = pload(), code = st.code[codeKey()], html = x.run === 'html', w = where(x);
    const pageMode = !!(st.page && x.run === 'js'), scratch = x.run === 'scratch', stageMode = html || pageMode || scratch;
    const blank = pmode === 'sandbox' ? x.ex : x.cm ? x.cm + ' Print the answer to the puzzle above.\n' : '';
    /* shells sit in their own group: they open the Terminal playground, whatever the sandbox status says */
    const groups = PL.GROUPS.slice(); groups.splice(1, 0, ['term', 'Opens the Terminal playground']);
    const groupOf = l => l.term ? 'term' : where(l).g;
    const opts = groups.map(([g, label]) => {
      const ls2 = PL.LANGS.filter(l => groupOf(l) === g);
      return ls2.length ? '<optgroup label="' + esc(label + ' (' + ls2.length + ')') + '">' + ls2.map(l => '<option value="' + l.id + '"' + (l.id === plang ? ' selected' : '') + '>' + l.ic + ' ' + esc(l.n) + '</option>').join('') + '</optgroup>' : '';
    }).join('');
    const runnable = PL.LANGS.filter(l => l.term || where(l).g !== 'none').length;
    const inp = typeof st.inp[plang] === 'string' ? st.inp[plang] : x.inp || '';
    /* shells are not compiled here: they open the Terminal playground, a simulated machine with its own files */
    if (x.term) return back('home', '', 'All languages') +
      '<div class="cl-card"><b style="font-size:19px">🧪 Code playground</b><div class="small mute" style="margin-top:4px">' + PL.LANGS.length + ' languages, ' + runnable + ' of them can run safely here, offline.</div></div>' +
      '<div class="cl-card"><div class="row" style="gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:8px"><label class="small">Language <select id="plang" aria-label="Language">' + opts + '</select></label></div>' +
      '<div class="small mute" style="margin-bottom:8px">🖥 <b>' + esc(x.n) + '</b> opens the <b>Terminal playground</b> below: a simulated computer with its own files and services. Commands really work there and nothing on this PC is touched. Pick another language above to write and run a program instead.</div>' +
      '<div id="cltp"></div>' +
      (w.g === 'none' ? '<div class="small mute" style="margin-top:8px">' + esc(w.why) + ' The simulated terminal does not need ' + (w.checking ? 'anything else' : 'that') + ' and always works.</div>' : '') +
      '</div>';
    return back('home', '', 'All languages') +
      '<div class="cl-card"><b style="font-size:19px">🧪 Code playground</b><div class="small mute" style="margin-top:4px">' + PL.LANGS.length + ' languages, ' + runnable + ' of them can run safely here, offline.</div>' +
      '<div class="small mute" style="margin-top:6px">🛡️ Safe mode: Python and JavaScript run in a sealed browser worker; native code runs only inside Windows Sandbox or Docker. Nothing is run as your Windows user.</div>' + modeTabs() + '</div>' +
      '<div class="cl-card"><div class="row" style="gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:8px"><label class="small">Language <select id="plang" aria-label="Language"' + (ch && ch.lang ? ' disabled' : '') + '>' + opts + '</select></label></div>' +
      chalCard(ch) + playNote(x, w) +
      (scratch
        ? '<textarea id="clcode" aria-label="Scratch script" spellcheck="false" style="display:none">' + esc(typeof code === 'string' ? code : blank) + '</textarea><div id="clblocks"></div>'
        : '<textarea class="cl-ed" id="clcode" aria-label="Code" data-lang="' + ceLang(plang) + '" spellcheck="false" maxlength="50000" style="min-height:240px" placeholder="Enter ' + esc(x.n) + '">' + esc(typeof code === 'string' ? code : blank) + '</textarea>' + keysTip(html ? 'refreshes the preview' : 'runs')) +
      (html || scratch ? '' : '<details class="small" id="plinw"' + (inp ? ' open' : '') + ' style="margin-top:6px"><summary class="mute" style="cursor:pointer">Input for the program (what it reads, like typing into a terminal)</summary><textarea class="cl-ans cl-pin" id="plin" aria-label="Program input" spellcheck="false" maxlength="20000" rows="3" style="display:block;width:100%;margin-top:6px" placeholder="Lines the program can read">' + esc(inp) + '</textarea></details>') +
      '<div class="row" style="gap:8px;margin-top:8px;flex-wrap:wrap"><button class="pri" data-cl="prun"' + (w.g === 'none' ? ' disabled title="' + esc(w.checking ? 'Checking which safe sandboxes are available…' : x.n + ' cannot run safely here. ' + w.why) + '"' : ' title="' + esc(w.g === 'pc' ? 'Runs in Windows Sandbox' : w.g === 'docker' ? 'Runs in Docker' : '') + '"') + '>' + (stageMode ? '▶ Run on the screen' : ch ? '▶ Run and check' : '▶ Run') + '</button><button class="ib" data-cl="pkill" hidden>■ Stop program</button><button class="ib" data-cl="pexp">🧠 Explain</button><button class="ib" data-cl="pstop" hidden>■ Stop explanation</button><button class="ib" data-cl="pex">↺ Example</button><button class="ib" data-cl="pclear">Clear</button>' +
      (x.run === 'js' ? '<label class="small" style="display:flex;gap:5px;align-items:center;white-space:nowrap" title="Run your JavaScript in a sandboxed web page: canvas, DOM, keyboard and games all work, still with no network"><input type="checkbox" data-cl="ppage"' + (pageMode ? ' checked' : '') + '> 🖥 Show it as a web page</label>' : '') + '</div>' +
      '<div class="small mute" style="margin-top:8px">' + (scratch ? 'Screen · the cat follows your blocks; click the screen, then use the keys' : html ? 'Screen · preview with scripts off; ▶ Run on the screen runs the page (still no network)' : pageMode ? 'Screen · your code runs as a web page (canvas and keys work); console messages appear below' : 'Output') + '</div>' +
      '<pre class="cl-pre" id="clout" role="status" style="min-height:2.5em"></pre><div class="cl-figs" id="clfig"></div>' +
      '<div id="plstage" style="margin-top:8px"></div>' +
      setupHTML(x, w) +
      '<div id="plai" class="cl-ai"></div>' +
      (A.cyberPad ? '<div style="display:grid;gap:8px;margin-top:12px">' +
        A.cyberPad.notesHTML('cppad', { title: '📝 Notes &amp; sketchpad', rows: 4, placeholder: 'Notes, snippets, answers, ideas — saved on this PC.' }) +
        A.cyberPad.aiHTML('cpai', { hint: 'Ask about your code, the output or the language.', placeholder: 'e.g. why does this loop stop early?' }) +
        '</div>' : '') +
      '</div>';
  }
  /* the Terminal playground, mounted in the page for the shell languages */
  function mountTerminal(b) {
    const host = b && b.querySelector('#cltp'); if (!host) return;
    const shell = plangOf(plang).term;
    const game = A.play && A.play.games && A.play.games.terminal_playground;
    if (!game || !game.mount) { host.innerHTML = '<div class="small mute">The Terminal playground is not loaded. Reload the page and try again.</div>'; return; }
    try { ls.set('tpg_shell', shell); } catch (e) { }
    try { ptpStop = game.mount(host, {}) || null; }
    catch (e) { ptpStop = null; host.innerHTML = '<div class="small mute">The Terminal playground could not start: ' + esc(e.message || e) + '</div>'; }
  }
  /* run a worker with one message; it is ended when the run stops, fails or takes too long */
  function runWorker(url, msg, signal, ms, slow) {
    return new Promise(resolve => {
      const worker = new Worker(url);
      const timeout = setTimeout(() => finish({ ok: false, error: slow }), ms);
      const abort = () => finish({ ok: false, error: 'Run stopped.' });
      function finish(result) {
        clearTimeout(timeout);
        signal.removeEventListener('abort', abort);
        worker.terminate();
        resolve(result);
      }
      signal.addEventListener('abort', abort, { once: true });
      worker.onmessage = event => finish(event.data);
      worker.onerror = event => finish({ ok: false, error: event.message || 'The interpreter could not start.' });
      worker.postMessage(msg);
    });
  }
  const runSql = (code, signal) => runWorker('/web/js/code-playground-sql.js', code, signal, 10000, 'SQL stopped after 10 seconds.');
  const runEso = (lang, code, input, signal) => runWorker('/web/js/esolang-worker.js', { lang, code, input, ms: 10000 }, signal, 15000, 'Stopped after 15 seconds.');
  function runBinary(code) {
    const rows = [];
    for (const [index, line] of code.split('\n').entries()) {
      const value = line.trim();
      if (!value) continue;
      if (!/^[+-]?(?:0b[01]+|0x[\da-f]+|\d+)$/i.test(value)) {
        return { ok: false, error: 'Line ' + (index + 1) + ' needs a decimal, 0b binary, or 0x hex integer.' };
      }
      const n = BigInt(value.replace(/^[+-]/, ''));
      const sign = value.startsWith('-') && n ? '-' : '';
      rows.push(sign + n + '\t' + sign + '0b' + n.toString(2) + '\t' + sign + '0x' + n.toString(16).toUpperCase());
    }
    return { ok: true, stdout: ['Decimal\tBinary\tHex', ...rows].join('\n') };
  }
  async function playRun() {
    const ed = H.querySelector('#clcode'), out = H.querySelector('#clout'), btn = H.querySelector('[data-cl="prun"]'), kill = H.querySelector('[data-cl="pkill"]');
    if (!ed || !btn || prun) return;
    const code = ed.value, lg = plang, x = plangOf(lg), w = where(x), input = (H.querySelector('#plin') || {}).value || '';
    if (x.run === 'scratch') {
      if (!pstage || !window.CodeStage || !window.CodeScratch) { out.textContent = 'The screen for Scratch did not load. Reload the page and try again.'; return; }
      pstage.showDoc(window.CodeStage.page(window.CodeScratch.program(code)));
      out.textContent = 'The cat is on the screen: click it, then use the keys. What it says appears here.';
      if (kill) kill.hidden = false;
      markPlayed();
      return;
    }
    if (x.run === 'html') {
      if (pstage) pstage.show(code.trim() || '<p style="font:16px system-ui;padding:24px;color:#446">Nothing to preview yet — type some HTML.</p>');
      out.textContent = code.trim() ? 'Your page is on the screen. Click it to play; use ⛶ Full screen for games.' : 'The screen is empty: type some HTML first.';
      markPlayed();
      return;
    }
    if (lg === 'javascript' && pload().page) {
      if (pstage && window.CodeStage) pstage.showDoc(window.CodeStage.page(code));
      out.textContent = 'Running on the screen. Click it to play and use its keys; console messages and errors appear here.';
      markPlayed();
      return;
    }
    if (w.checking) { out.textContent = '🛡️ Checking which safe sandboxes are available — press Run again in a moment.'; askStatus(); return; }
    if (w.g === 'none') { out.textContent = '⛔ ' + x.n + ' cannot run safely here. ' + (w.why || PL.NOTOOL) + ' Nothing was run.'; return; }
    if (!code.trim()) { out.textContent = 'Enter some code first.'; return; }
    const ctl = prun = new AbortController();
    btn.disabled = true; if (kill) kill.hidden = false;
    const compiled = /^(c|cpp|holyc|java|csharp|go|rust|typescript|kotlin|swift|asm)$/.test(lg);
    out.textContent = w.g === 'pc' ? 'Starting Windows Sandbox — the first run can take a minute…'
      : w.g === 'docker' ? (compiled ? 'Starting the Docker sandbox and compiling…' : 'Starting the Docker sandbox…')
        : compiled ? 'Compiling and running…' : 'Running…';
    let r, timedOut = false;
    /* a native run waits for a whole VM or container to start, but never forever: after two minutes there is still an answer */
    const guard = setTimeout(() => { timedOut = true; ctl.abort(); }, 150000);
    try {
      if (RUNS[lg]) r = await A.interp.run(RUNS[lg], code, { signal: ctl.signal, isolated: true });
      else if (x.run === 'sql') r = await runSql(code, ctl.signal);
      else if (x.run === 'binary') r = runBinary(code);
      else if (x.run === 'eso') r = await runEso(lg, code, input, ctl.signal);
      else {
        const res = await fetch('/api/code-playground/run', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lang: lg, code, input }), signal: ctl.signal,
        });
        let data;
        try { data = await res.json(); } catch (e) { data = { ok: false, error: 'The Playground server answered ' + res.status + ' instead of a result.' }; }
        r = data;
      }
    } catch (error) {
      r = {
        ok: false,
        error: timedOut ? 'The sandbox did not answer within 2 minutes — it may still be starting. Try again, or open “Safe runtime setup”.'
          : ctl.signal.aborted ? 'Run stopped.' : String(error && error.message || error)
      };
    } finally { clearTimeout(guard); }
    if (prun !== ctl) return;
    prun = null;
    btn.disabled = false; if (kill) kill.hidden = true;
    if (view !== 'play' || H.querySelector('#clout') !== out) return;
    const error = String(r.error || 'The program did not run.').split('\n').filter(line => !/^\s+at\s/.test(line)).join('\n').trim();
    if (r.unavailable) {
      out.textContent = '⛔ ' + error + '\n\nNothing was run. Open “Safe runtime setup” below for the one-time setup.';
      H.querySelector('#plruntime')?.setAttribute('open', '');
      return;
    }
    const failure = /^[A-Za-z]*Error:/.test(error) || /^ICL\d/.test(error) ? error : 'Error: ' + error;
    const text = [r.stdout, r.stderr, r.value !== undefined && r.value !== '' ? '→ ' + r.value : '', r.ok ? '' : failure]
      .filter(Boolean).map(part => String(part).replace(/\r?\n$/, '')).join('\n');
    /* whatever happened, something is always printed: output, an error, a drawing note, or an explicit "no output" */
    out.textContent = text || (r.figures && r.figures.length ? 'The program drew ' + r.figures.length + ' picture' + (r.figures.length > 1 ? 's' : '') + ' — shown below.' : 'Finished with no output.');
    showFigures(H.querySelector('#clfig'), r.figures);
    if (r.figures && r.figures.length && pstage && window.CodeStage) pstage.showDoc(window.CodeStage.pictures(r.figures));
    plast = { lang: lg, code, text: out.textContent };
    if (pmode !== 'sandbox') judge(r, lg);
    if (r.ok) markPlayed();
  }
  function markPlayed() { const s = load(); if (!s.played) { s.played = 1; save(s); } }
  function cancelPlay() {
    prun?.abort();
    pctl?.abort();
    prun = pctl = null;
    plast = null;
  }
  async function explain() {
    const ed = H.querySelector('#clcode'), box = H.querySelector('#plai'); if (!ed || !box) return; const code = ed.value.trim();
    if (!code) { box.innerHTML = '<span class="small mute">Type some code first.</span>'; return; }
    if (!A.ai || !A.ai.stream) { box.innerHTML = '<span class="small mute">The AI is not available.</span>'; return; }
    const lg = plang, x = plangOf(lg);
    const ran = plast && plast.lang === lg && plast.code === ed.value ? plast : null;
    if (pctl) pctl.abort(); const ctl = pctl = new AbortController(); const stop = H.querySelector('[data-cl="pstop"]'); if (stop) stop.hidden = false;
    box.innerHTML = '<span class="small mute">🧠 Reading your code…</span>';
    const prompt = 'You are a patient coding teacher. The learner is a beginner.\nLanguage: ' + x.n + '\n\nTheir code:\n```\n' + code.slice(0, 8000) + '\n```\n\n' +
      (ran ? 'The Playground showed the following output:\n```\n' + ran.text.slice(0, 3000) + '\n```\n\n' : lg === 'html' ? 'Scripts are disabled in the preview.\n\n' : '') +
      'Answer in plain, short sentences, in three parts:\n1. **What it does**: explain the code step by step (line by line when it is short). Say what it prints or shows.\n2. **Problems**: any errors, bugs or risky parts, which line they are on, and why they happen. If there are none, write "No problems found."\n3. **Fixed code**: only when there was a problem, the corrected code in one code block.\nDo not guess at output you are not sure of; say so instead.';
    try {
      const all = await A.ai.stream([{ role: 'user', content: prompt }], t => { if (!ctl.signal.aborted && H.querySelector('#plai') === box) box.innerHTML = fmt(t); }, ctl.signal, { temp: 0.2 });
      if (H.querySelector('#plai') === box && !all) box.innerHTML = '<span class="small mute">The AI gave no answer. Check that a model is chosen at the top of the window.</span>';
    } catch (e) { if (!ctl.signal.aborted && H.querySelector('#plai') === box) box.innerHTML = '<span class="small mute">The AI could not answer: ' + esc(e.message || e) + '. Check that a model is chosen at the top of the window.</span>'; }
    if (pctl === ctl) { pctl = null; if (stop) stop.hidden = true; }
  }

  /* ----- 🦠 Sample lab: read a suspicious file without running it, then run it only inside Windows Sandbox ----- */
  let slab = null, slabPayload = null, slabResult = null, slabBusy = '';
  const sevIc = { high: '🔴', med: '🟠', low: '🟡', info: '🔵' };
  const bytesB64 = bytes => { let s = ''; const CH = 0x8000; for (let i = 0; i < bytes.length; i += CH) s += String.fromCharCode.apply(null, bytes.subarray(i, i + CH)); return btoa(s); };
  const kb = n => n < 1024 ? n + ' B' : n < 1024 * 1024 ? (n / 1024).toFixed(1) + ' KB' : (n / 1048576).toFixed(2) + ' MB';
  function slabFacts(r) {
    const rows = [
      ['Type', r.kind === 'pe' ? 'Windows program (PE)' : r.kind === 'elf' ? 'Linux program (ELF)' : r.kind === 'script' ? r.script + ' script' : r.kind],
      ['Size', kb(r.size) + ' · entropy ' + r.entropy + ' of 8'],
      ['SHA-256', r.sha256], ['SHA-1', r.sha1], ['MD5', r.md5],
    ];
    if (r.pe) rows.push(['Header', r.pe.machine + ' · ' + r.pe.bits + '-bit · ' + r.pe.subsystem + (r.pe.stamped ? ' · built ' + r.pe.stamped : '')]);
    return '<div style="display:grid;gap:4px;margin:8px 0">' + rows.map(([k, v]) => '<div class="row" style="gap:8px;align-items:baseline"><span class="small mute" style="min-width:76px">' + esc(k) + '</span><code class="small" style="word-break:break-all">' + esc(v) + '</code></div>').join('') + '</div>';
  }
  const slabChips = (title, list, max) => !list || !list.length ? '' : '<div style="margin-top:8px"><div class="small mute">' + esc(title) + '</div>' + list.slice(0, max || 12).map(v => '<span class="cl-chip" style="cursor:text;font-family:Consolas,monospace;font-size:12px">' + esc(v) + '</span>').join('') + '</div>';
  function slabReportHtml() {
    if (slabBusy && !slab) return '<div class="cl-card"><div class="small mute">' + esc(slabBusy) + '</div></div>';
    if (!slab) return '<div class="cl-card"><div class="small mute">Read a file and the report appears here: what kind of file it is, its hashes, its sections, what its text is trying to do, and every address and path it mentions. Nothing is executed to make this report.</div></div>';
    const vc = slab.verdict.level === 'high' ? 'var(--bad,#c33)' : slab.verdict.level === 'med' ? '#c80' : 'var(--ok,#3a3)';
    const run = !slabPayload ? '' : '<div class="cl-card"><div class="row" style="gap:8px;align-items:center;flex-wrap:wrap"><button class="pri" data-cl="slrun"' + (slab.canRun && !slabBusy ? '' : ' disabled') + '>▶ Run it in Windows Sandbox</button><span class="small mute">' + esc(slab.canRun ? 'Boots a disposable VM with no network. Up to 2 minutes.' : slab.runWhy) + '</span></div>' +
      (slab.canRun ? '<details class="small" style="margin-top:8px"><summary class="mute" style="cursor:pointer">Input for the sample (what it reads from stdin)</summary><textarea class="cl-ans" id="slin" spellcheck="false" rows="2" style="display:block;width:100%;margin-top:6px" placeholder="Lines the sample can read"></textarea></details>' : '') +
      (slabBusy && slab ? '<div class="small mute" style="margin-top:8px">' + esc(slabBusy) + '</div>' : '') +
      '<div id="slres">' + slabRunHtml() + '</div></div>';
    return '<div class="cl-card"><div class="row" style="gap:10px;align-items:center;flex-wrap:wrap"><div style="font-size:26px">' + (slab.verdict.level === 'high' ? '🦠' : slab.verdict.level === 'med' ? '⚠️' : '🔎') + '</div><div style="flex:1"><b>' + esc(slab.name) + '</b><div class="small" style="color:' + vc + '">' + esc(slab.verdict.text) + '</div></div><span class="small mute">' + slab.findings.filter(f => f.sev === 'high').length + ' high · ' + slab.findings.filter(f => f.sev === 'med').length + ' medium · ' + slab.signalCount + ' indicators</span></div>' +
      slabFacts(slab) +
      (slab.pe && slab.pe.sections.length ? '<div class="small mute">Sections</div><div class="cl-pre" style="margin-top:4px">' + slab.pe.sections.map(s => esc(s.name.padEnd(10).slice(0, 10)) + ' ' + String(s.size).padStart(8) + ' B  entropy ' + String(s.entropy).padStart(4) + (s.exec ? '  code' : '') + (s.write ? ' writable' : '')).join('\n') + '</div>' : '') +
      '<div class="small mute" style="margin-top:8px">What the file says it does</div>' + slab.findings.map(f => '<div style="margin:6px 0"><b>' + sevIc[f.sev] + ' ' + esc(f.label) + '</b><div class="small mute">' + esc(f.detail) + '</div></div>').join('') +
      slabChips('Web addresses', slab.indicators.urls, 15) + slabChips('IP addresses', slab.indicators.ips, 10) + slabChips('Domains', slab.indicators.domains, 10) +
      slabChips('Registry keys', slab.indicators.registry, 8) + slabChips('File paths', slab.indicators.paths, 8) + slabChips('Email addresses', slab.indicators.emails, 6) + slabChips('Wallet addresses', slab.indicators.wallets, 4) +
      '<div class="small mute" style="margin-top:10px">A static read cannot prove what a file does. A sample that shows nothing here can still act once it runs.</div></div>' + run;
  }
  function slabRunHtml() {
    const r = slabResult;
    if (!r) return '';
    if (r.unavailable || !r.backend && !r.ok) return '<div class="cl-pnote cl-pno" style="margin-top:8px">' + esc(r.error || 'The sample was not run.') + '</div>';
    const f = r.files || [], pr = r.processes || [];
    return '<div class="cl-pnote" style="margin-top:8px"><b>' + (r.ok ? '✅ Ran to completion' : r.error ? '⏹ ' + esc(r.error) : '❌ Failed') + '</b>' + (r.exitCode != null ? ' · exit code ' + esc(r.exitCode) : '') + (r.ms != null ? ' · ' + Math.round(r.ms / 100) / 10 + ' s' : '') +
      (r.stdout ? '<div class="small mute" style="margin-top:6px">Output</div><pre class="cl-pre" style="max-height:260px;overflow:auto">' + esc(r.stdout) + '</pre>' : '<div class="small mute" style="margin-top:6px">It printed nothing.</div>') +
      (r.stderr ? '<div class="small mute">Errors</div><pre class="cl-pre" style="max-height:160px;overflow:auto">' + esc(r.stderr) + '</pre>' : '') +
      '<div class="small mute" style="margin-top:6px">Processes it started</div>' + (pr.length ? '<div>' + pr.map(p => '<span class="cl-chip" style="cursor:text">' + esc(p) + '</span>').join('') + '</div>' : '<div class="small mute">None beyond the sample itself.</div>') +
      '<div class="small mute" style="margin-top:6px">Files it wrote (in the disposable VM, deleted with it)</div>' + (f.length ? '<div class="cl-pre" style="max-height:200px;overflow:auto">' + f.map(x => esc((x.dir ? x.dir + '\\' : '') + x.name) + '  ' + kb(x.size)).join('\n') + '</div>' : '<div class="small mute">None.</div>') +
      '<div class="small mute" style="margin-top:6px">The VM had no network, no shared clipboard and no host folders. Its own temporary folder is deleted when it shuts down.</div></div>';
  }
  function paintSlab() {
    if (!H) return;
    const rep = H.querySelector('#slrep'); if (rep) rep.innerHTML = '<div class="cl-wrap">' + slabReportHtml() + '</div>';
    const msg = H.querySelector('#slmsg'); if (msg && !slabBusy) msg.textContent = '';
  }
  const slabMsg = text => { const m = H && H.querySelector('#slmsg'); if (m) m.textContent = text || ''; };
  /* A.api sends a body with no Content-Type, and the Sample lab routes refuse anything but JSON */
  const slabPost = async (path, body) => {
    const r = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => null);
    if (!j) throw new Error('The server did not answer (' + r.status + ').');
    return j;
  };
  async function slabAnalyze(file) {
    if (slabBusy) return;
    const ta = H && H.querySelector('#sltext'), box = H && H.querySelector('#slb64');
    let payload;
    try {
      if (file) {
        if (file.size > 8 * 1024 * 1024) throw new Error('That file is larger than 8 MB.');
        payload = { name: file.name || 'sample.bin', b64: bytesB64(new Uint8Array(await file.arrayBuffer())) };
      } else {
        const text = ta ? ta.value : '';
        if (!text.trim()) throw new Error('Choose a file, or paste the sample text below.');
        payload = box && box.checked
          ? { name: 'pasted.bin', b64: text.replace(/\s+/g, '') }
          : { name: 'pasted.txt', b64: bytesB64(new TextEncoder().encode(text)) };
      }
    } catch (e) { slabMsg(e.message); return; }
    slab = null; slabResult = null; slabPayload = payload; slabBusy = file ? 'Reading ' + (file.name || 'the file') + '…' : 'Reading the pasted sample…';
    slabMsg(''); paintSlab();
    try {
      const r = await slabPost('/api/sample-lab/analyze', payload);
      if (!r || !r.report) throw new Error((r && r.error) || 'The sample could not be read.');
      slab = r.report;
    } catch (e) { slab = null; slabPayload = null; slabMsg('Could not read the sample: ' + (e.message || String(e))); }
    slabBusy = ''; paintSlab();
  }
  async function slabRunIt() {
    if (!slabPayload || slabBusy) return;
    const inp = H && H.querySelector('#slin');
    slabResult = null; slabBusy = 'Running the sample in Windows Sandbox — it boots a fresh VM, so give it a minute or two…'; paintSlab();
    try { slabResult = await slabPost('/api/sample-lab/run', Object.assign({}, slabPayload, { input: inp ? inp.value : '' })); }
    catch (e) { slabResult = { ok: false, error: 'The sample could not be run: ' + (e.message || String(e)) }; }
    slabBusy = ''; paintSlab();
  }
  function samplePage() {
    return back('home', '', 'All languages') +
      '<div class="cl-card"><div class="row" style="gap:12px;align-items:center;flex-wrap:wrap"><div style="font-size:30px">🦠</div><div style="flex:1;min-width:220px"><b style="font-size:19px">Sample lab</b><div class="small mute">Read a suspicious file without running it — type, hashes, sections, scripts, addresses, registry keys. Then, only if you ask, run it in a disposable Windows Sandbox.</div></div></div>' +
      '<div class="row" style="gap:8px;margin-top:10px;flex-wrap:wrap"><button class="pri" data-cl="slpick">📄 Choose a file…</button><span class="small mute">or drop one on the box below · up to 8 MB</span></div>' +
      '<input type="file" id="slfile" style="display:none" aria-label="Sample file">' +
      '<div id="sldrop" style="margin-top:10px;border:1px dashed var(--line);border-radius:10px;padding:10px"><div class="small mute" style="margin-bottom:6px">Paste a script, or the base64 of a binary sample:</div>' +
      '<textarea class="cl-ed" id="sltext" data-ownkeys="" spellcheck="false" style="min-height:120px" placeholder="five lines of PowerShell, a URL… or base64"></textarea>' +
      '<div class="row" style="gap:10px;margin-top:8px;flex-wrap:wrap"><label class="small" style="display:flex;gap:5px;align-items:center"><input type="checkbox" id="slb64"> the box is base64</label><button class="pri" data-cl="slana">🔬 Read it (safe)</button><button class="ib" data-cl="slclear">Clear</button></div>' +
      '<div class="small" id="slmsg" style="color:var(--bad,#c33);margin-top:6px"></div></div>' +
      '<div class="small mute" style="margin-top:10px">Reading never runs the file: no interpreter, no sandbox, no network. Running it needs Windows Sandbox turned on, and then it happens in a disposable VM with networking, clipboard, printer, camera and microphone sharing off.</div></div>' +
      '<div id="slrep"></div>';
  }

  function draw() {
    if (!H) return; const b = H.querySelector('#clbody'); if (!b) return;
    if (ptpStop) { try { ptpStop(); } catch (e) { } ptpStop = null; }
    const scratchLesson = view === 'lesson' && curL && curL.lang === 'scratch';
    if (view !== 'play' && !scratchLesson && pstage) { try { pstage.destroy(); } catch (e) { } pstage = null; }
    const page = { play: playPage, lesson: lessonPage, lang: langPage, boss: bossPage, speed: speedPage, ai: aiPage, badges: badgesPage, samplelab: samplePage }[view] || home;
    b.innerHTML = '<div class="cl-wrap">' + page() + '</div>';
    if (view === 'samplelab') {
      paintSlab();
      const fi = b.querySelector('#slfile');
      if (fi) fi.addEventListener('change', () => { const f = fi.files && fi.files[0]; if (f) slabAnalyze(f); });
      const drop = b.querySelector('#sldrop');
      if (drop) {
        const stop = e => { e.preventDefault(); e.stopPropagation(); };
        drop.addEventListener('dragover', e => { stop(e); drop.style.borderColor = 'var(--acc)'; });
        drop.addEventListener('dragleave', () => { drop.style.borderColor = ''; });
        drop.addEventListener('drop', e => {
          stop(e); drop.style.borderColor = '';
          const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
          if (f) slabAnalyze(f); else slabMsg('Drop a file, or paste the sample text.');
        });
      }
    }
    const ed = b.querySelector('#clcode'), l = ['lesson', 'boss', 'speed', 'ai'].includes(view) && curL;
    if (ed) {
      if (view === 'play') { if (plangOf(plang).run !== 'scratch') editorKeys(ed, plang, playRun); ed.addEventListener('input', () => playSave(ed.value)); const pin = b.querySelector('#plin'); if (pin) { pin.setAttribute('data-ownkeys', ''); pin.addEventListener('input', () => inputSave(pin.value)); } askStatus(); }
      else editorKeys(ed, l ? l.lang : lang, () => l && l.ex.k === 'run' ? run() : check());
      if (view === 'play') {
        if (pstage) { try { pstage.destroy(); } catch (e) { } pstage = null; }
        const stageHost = b.querySelector('#plstage'), shell = plangOf(plang), asPage = !!pload().page;
        if (stageHost && window.CodeStage) {
          pstage = window.CodeStage.mount(stageHost, {
            title: '🖥 Screen', height: shell.run === 'scratch' ? 360 : 320,
            hint: shell.run === 'html' || shell.run === 'scratch' || (shell.run === 'js' && asPage) ? 'Click the screen, then use its keys' : 'Pictures and pages appear here',
            empty: shell.run === 'scratch' ? 'Build a script from the blocks, then press ▶ Run on the screen.'
              : shell.run === 'html' ? 'Your page appears here. Press ▶ Run on the screen, or type above.'
                : 'Run a program that draws a picture, or tick “Show it as a web page” for canvas, DOM and games.',
            onLog: (text, kind) => {
              const o = H && H.querySelector('#clout'); if (!o) return;
              o.textContent = (o.textContent ? o.textContent + '\n' : '') + (kind === 'error' ? '⛔ ' : '') + text;
            }
          });
          if (shell.run === 'html') {
            /* typing never runs the page: the live preview keeps scripts off, and ▶ Run on the screen turns them on */
            const live = () => { if (pstage && ed.isConnected) pstage.showDoc(window.CodeStage.doc(ed.value, { scripts: false })); };
            let still = null; ed.addEventListener('input', () => { clearTimeout(still); still = setTimeout(live, 350); }); live();
          }
          /* Scratch: the block palette writes the script text into the hidden editor beside it */
          if (shell.run === 'scratch' && window.CodeScratch) {
            const blocks = b.querySelector('#clblocks');
            if (blocks) window.CodeScratch.editor(blocks, ed);
          }
        }
      }
    }
    /* Scratch lessons: the drag-and-drop block editor, with the screen beside it */
    if (scratchLesson) {
      if (pstage) { try { pstage.destroy(); } catch (e) { } pstage = null; }
      const st = b.querySelector('#clscrstage');
      if (st && window.CodeStage) {
        pstage = window.CodeStage.mount(st, {
          title: '🖥 Screen', height: 340, hint: 'Click the screen, then use its keys',
          empty: 'Drag blocks into the script, then press ▶ Run on the screen.',
          onLog: (text, kind) => {
            const o = H && H.querySelector('#clscrout'); if (!o) return;
            o.textContent = (o.textContent ? o.textContent + '\n' : '') + (kind === 'error' ? '⛔ ' : '') + text;
          }
        });
      }
      const sblk = b.querySelector('#clscrblocks'), sta = b.querySelector('#clscode');
      if (sblk && sta && window.CodeScratch) window.CodeScratch.editor(sblk, sta);
    }
    /* a shell language is not compiled here: it opens the Terminal playground in place of the editor */
    if (view === 'play' && plangOf(plang).term) mountTerminal(b);
    /* answer boxes: Enter is a new line, Ctrl+Enter checks; in fill-the-blank Enter moves to the next blank */
    const a = b.querySelector('#clans');
    if (a) { if (l && l.ex.k === 'fix') editorKeys(a, l.lang, check); else { a.setAttribute('data-ownkeys', ''); a.addEventListener('keydown', e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); check(); } }); } if (view === 'speed') a.focus(); }
    const ps = b.querySelector('#plang');
    if (ps) ps.addEventListener('change', () => { cancelPlay(); const ce = b.querySelector('#clcode'); if (ce) playSave(ce.value); plang = ps.value; const s = pload(); s.lang = plang; try { ls.set(PKEY, JSON.stringify(s)); } catch (e) { } setTimeout(draw, 0); });
    if (view === 'play' && A.cyberPad) {
      A.cyberPad.bindNotes(b, 'cppad', 'codeplay');
      A.cyberPad.bindAI(b, 'cpai', {
        context: () => {
          const ce = b.querySelector('#clcode'), out = b.querySelector('#clout');
          return 'The Moundshroud code playground. Language: ' + plangOf(plang).n + '.' +
            '\nCode in the editor:\n```\n' + (ce ? ce.value.slice(0, 4000) : '') + '\n```' +
            '\n' + (plang === 'html' ? 'The live preview has scripts disabled.' : 'Last output shown:\n' + (out ? (out.textContent || '(nothing yet)').slice(0, 1500) : '(not run yet)'));
        },
        system: 'You are a concise coding helper in the code playground. Explain or fix the code in short, concrete steps. Never claim to have run anything.'
      });
    }
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
    out.textContent = text || ((r.figures && r.figures.length) ? 'The program drew a picture — shown below.' : '(nothing was printed)');
    showFigures(H.querySelector('#clfig'), r.figures);
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
    if (k === 'workshop') return A.cybertab.go('workshop');
    if (k === 'play') return go('play');
    if (k === 'slab') return go('samplelab');
    if (k === 'slpick') { const fi = H && H.querySelector('#slfile'); if (fi) fi.click(); return; }
    if (k === 'slana') return slabAnalyze(null);
    if (k === 'slrun') return slabRunIt();
    if (k === 'slclear') {
      slab = null; slabPayload = null; slabResult = null; slabBusy = '';
      const ta = H && H.querySelector('#sltext'); if (ta) ta.value = '';
      const fi = H && H.querySelector('#slfile'); if (fi) fi.value = '';
      const box = H && H.querySelector('#slb64'); if (box) box.checked = false;
      slabMsg(''); paintSlab(); return;
    }
    if (k === 'badges') return go('badges');
    if (view === 'play' && chalClick(k, el)) return;
    if (k === 'prun') return playRun();
    if (k === 'ppage') { const s = pload(); s.page = !!el.checked; pstore(s); setTimeout(draw, 0); return; }
    if (k === 'pexp') return explain();
    if (k === 'scrrun') {
      const sta = H.querySelector('#clscode'), out = H.querySelector('#clscrout'), stop = H.querySelector('[data-cl="scrstop"]');
      if (!sta || !window.CodeScratch) return;
      if (!pstage || !window.CodeStage) { if (out) out.textContent = 'The screen did not load. Reload the page and try again.'; return; }
      pstage.showDoc(window.CodeStage.page(window.CodeScratch.program(sta.value)));
      if (out) out.textContent = 'The cat is on the screen: click it, then use the keys. What it says appears here.';
      if (stop) stop.hidden = false;
      return;
    }
    if (k === 'scrstop') {
      if (pstage && pstage.post) { try { pstage.post({ msStop: 1 }); } catch (e) { } }
      el.hidden = true;
      return;
    }
    if (k === 'scrreset') {
      const sta = H.querySelector('#clscode'), out = H.querySelector('#clscrout');
      if (sta) { sta.value = scratchStart(curL); sta.dispatchEvent(new Event('input', { bubbles: true })); }
      if (out) out.textContent = '';
      return;
    }
    if (k === 'pkill') { if (prun) prun.abort(); if (plangOf(plang).run === 'scratch' && pstage && pstage.post) { pstage.post({ msStop: 1 }); el.hidden = true; } return; }
    if (k === 'pex') {
      cancelPlay();
      const ed = H.querySelector('#clcode'), x = plangOf(plang);
      ed.focus(); ed.select();
      if (!document.execCommand('insertText', false, x.ex)) ed.value = x.ex;
      ed.dispatchEvent(new Event('input'));
      const pin = H.querySelector('#plin'); if (pin) { pin.value = x.inp || ''; inputSave(pin.value); if (x.inp) H.querySelector('#plinw').open = true; }
      const out = H.querySelector('#clout'); if (out) out.textContent = '';
      H.querySelector('[data-cl="prun"]').disabled = where(x).g === 'none';
      return;
    }
    if (k === 'pstop') { if (pctl) pctl.abort(); pctl = null; el.hidden = true; const bx = H.querySelector('#plai'); if (bx) bx.insertAdjacentHTML('beforeend', '<div class="small mute">(stopped)</div>'); return; }
    if (k === 'pclear') {
      cancelPlay();
      const ed = H.querySelector('#clcode');
      ed.focus();
      ed.select();
      document.execCommand('delete');
      if (ed.value) ed.value = '';
      ed.dispatchEvent(new Event('input'));
      H.querySelector('[data-cl="prun"]').disabled = where(plangOf(plang)).g === 'none';
      H.querySelector('[data-cl="pstop"]').hidden = true;
      const out = H.querySelector('#clout');
      if (out) out.textContent = '';
      if (pstage) pstage.clear();
      H.querySelector('#plai').textContent = '';
      return;
    }
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
      cancelPlay(); H = host; if (!document.getElementById('codelcss')) { const s = document.createElement('style'); s.id = 'codelcss'; s.textContent = css; document.head.appendChild(s); }
      host.innerHTML = '<div class="scroll pad" id="clbody" style="flex:1;min-height:0"></div>'; if (!host._clBound) { host.addEventListener('click', onClick); host._clBound = true; }
      { const s = load(); if (C.newBadges(s).length) store(s); } /* badges already earned before badges existed */
      draw();
    },
    open: id => { if (id) { const l = lessonById(id); if (l) { lang = l.lang; view = 'lesson'; curL = l; shown = false; } } A.cybertab.go('code'); if (H) draw(); },
  };
})();

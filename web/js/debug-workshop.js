// Debug workshop: endless repair tickets, in every language, at three difficulty levels.
//
// JavaScript and Python tickets are real functions with test cases the workshop runs in the code sandbox, so a fix is
// proved by its behaviour. Tickets in the other languages (and some here) are real programs from that language's own
// lessons with one token changed; the fix is the corrected line. Tickets come from debug-workshop-cases.js.
(function () {
  if (typeof window === 'undefined' || typeof A === 'undefined') return;
  const T = () => A.DebugTickets;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const show = v => JSON.stringify(v);
  const langName = id => { const x = window.PlayLangs && PlayLangs.byId(id); return x ? x.n : id; };
  const langIcon = id => { const x = window.PlayLangs && PlayLangs.byId(id); return x ? x.ic : '🧩'; };
  const langOf = () => { const id = ls.get('dw_lang', 'javascript'); return T().languages().some(l => l.id === id) ? id : 'javascript'; };
  const levelOf = () => { const v = ls.get('dw_level', 'mixed'); return v === 'mixed' || T().LEVELS.some(([id]) => id === v) ? v : 'mixed'; };
  const norm = s => { try { return JSON.stringify(JSON.parse(s)); } catch (e) { return String(s); } };
  const solved = () => +(ls.get('dw_solved', '0') || 0);
  const solvedIn = id => +(ls.get('dw_lang_solved_' + id, '0') || 0);

  function render(host) {
    let lang = langOf(), level = levelOf(), ticket = null, hint = false, answered = false, message = '', rows = null, draft = '', typed = '';
    let version = 0;

    const newTicket = () => {
      ticket = T().make(lang, level);
      hint = false; answered = false; message = ''; rows = null; typed = ''; draft = ticket ? ticket.code : '';
      if (!ticket) message = 'This language has no programs to break yet. Pick another one.';
      version++;
      draw();
    };

    function draw() {
      const langs = T().languages();
      const langOpts = langs.map(l => `<option value="${l.id}" ${l.id === lang ? 'selected' : ''}>${l.ic} ${esc(l.n)}</option>`).join('');
      const lvlOpts = T().LEVELS.map(([id, n]) => `<option value="${id}" ${id === level ? 'selected' : ''}>${n}</option>`).join('') + `<option value="mixed" ${level === 'mixed' ? 'selected' : ''}>Mixed</option>`;
      const diff = ticket && ticket.kind === 'diff';
      const t = ticket;
      host.innerHTML = `<div class="dw-shell"><main class="dw-wrap"><header class="dw-head" style="flex-wrap:wrap;gap:12px"><div><p class="sy-kicker">${langIcon(lang)} ${esc(langName(lang))} · ${level === 'mixed' ? 'mixed difficulty' : level} · ${solved()} repaired</p><h2>Debug workshop</h2></div>
        <label style="margin-right:8px">Language <select data-lang>${langOpts}</select></label><label>Difficulty <select data-level>${lvlOpts}</select></label></header>
        ${!t ? `<p>${esc(message)}</p><button class="dw-primary" data-job="another">🎲 Another ticket →</button>` : `
        <h3>${esc(t.title)}</h3><p>${esc(t.story)}</p>
        <div class="dw-layout"><section class="dw-panel"><h4>${diff ? '🔧 Repair the line that was changed' : '🔧 Repair the function'}</h4>
          ${diff ? codeBlock(t) : `<textarea class="dw-editor" id="dw-code" spellcheck="false" autocapitalize="off" style="min-height:180px"></textarea>`}
          ${diff ? `<label style="display:block;margin-top:10px" class="sy-kicker">Corrected ${t.line ? 'line ' + t.line : 'line'}</label><input class="dw-editor" id="dw-line" aria-label="Corrected line" spellcheck="false" autocapitalize="off" style="height:2.6em;padding:6px 8px" placeholder="type the line as it should be" value="${esc(typed || (t.line ? t.code.split('\n')[t.line - 1].trim() : ''))}">` : ''}
          <div class="dw-controls"><button class="dw-primary" data-job="${diff ? 'check' : 'run'}">${diff ? '✓ Check the line' : 'Run ' + t.tests.length + ' cases →'}</button>
            <button class="dw-link" data-job="hint" aria-expanded="${hint}">Hint</button>
            <button class="dw-link" data-job="answer">Show the answer</button>
            <button class="dw-link" data-job="another">🎲 Another ticket</button><button class="dw-link" data-job="lessons">📚 Coding lessons</button></div>
          ${hint ? `<p>💡 ${esc(t.hint)}</p>` : ''}${answered ? `<p class="cl-pnote" style="padding:8px;border:1px solid #39494d;border-radius:6px">${esc(t.explain)}</p>` : ''}
        </section><section class="dw-panel"><p class="sy-kicker">${esc(t.concept)}</p>
          ${diff ? `<h4>Where this came from</h4><p>${esc(t.from)}. One ${esc(t.bugName)} in the program; the rest is exactly as it was written.</p><p class="small" style="color:#8fa3a5">Difficulty: ${t.level === 'easy' ? 'the line is marked and the hint says what changed.' : t.level === 'medium' ? 'the line is marked; work out what changed.' : 'nothing is marked: read the program and find the one token that does not belong.'}</p>`
            : `<h4>The first case</h4><p>Input <code style="color:#ff987c">${esc(show(t.tests[0][0]))}</code><br>Expected <code style="color:#77dbda">${esc(show(t.tests[0][1]))}</code></p><p class="small" style="color:#8fa3a5">Your repair is executed against every case in the sandbox — there is no answer to compare against, only behaviour.</p>`}
          <p class="small" style="color:#8fa3a5">Repaired in ${esc(langName(lang))}: ${solvedIn(lang)}</p>
        </section></div>
        <div class="dw-results" aria-live="polite"></div></main></div>`}`;
      if (t && !diff) { const ed = host.querySelector('#dw-code'); ed.value = draft; ed.addEventListener('input', () => { draft = ed.value; rows = null; message = ''; results(); }); }
      results();
      if (t && diff) {
        const inp = host.querySelector('#dw-line');
        if (inp) { inp.addEventListener('input', () => { typed = inp.value; }); inp.focus({ preventScroll: true }); }
      }
    }

    function codeBlock(t) {
      const lines = t.code.split('\n');
      return `<pre class="dw-code" style="margin:8px 0;padding:10px;border:1px solid #39494d;border-radius:6px;overflow:auto;max-height:340px;font:13px/1.55 Consolas,ui-monospace,monospace;color:#f5f0df;background:#0b1114">` +
        lines.map((l, i) => {
          const mark = t.line === i + 1;
          return `<div style="${mark ? 'background:#2a2018;box-shadow:inset 3px 0 0 #ff987c' : ''}"><span style="display:inline-block;width:2.6em;color:#5c6f72;user-select:none">${i + 1}</span>${esc(l) || ' '}</div>`;
        }).join('') + '</pre>';
    }

    function results() {
      const out = host.querySelector('.dw-results');
      if (!out) return;
      out.innerHTML = `<div class="dw-summary">${esc(message)}</div>` + (rows || []).map((r, i) => `<div class="dw-result ${r.ok ? 'pass' : 'fail'}"><b>${r.ok ? 'Pass' : 'Fail'} · ${esc(show(ticket.tests[i][0]))}</b><small>Expected ${esc(show(ticket.tests[i][1]))} · Returned ${esc(r.actual)}</small></div>`).join('');
      if (rows && rows.every(r => r.ok)) out.insertAdjacentHTML('beforeend', `<button class="dw-primary" data-job="next">Next ticket →</button><div class="small">Every case passes. The workshop has another one ready.</div>`);
    }

    function passed() {
      ls.set('dw_solved', String(solved() + 1));
      ls.set('dw_lang_solved_' + lang, String(solvedIn(lang) + 1));
    }

    async function checkLine() {
      const inp = host.querySelector('#dw-line');
      typed = inp ? inp.value : typed;
      const r = T().check(ticket, typed);
      if (r.ok) {
        passed(); message = '✅ That is the line. ' + ticket.explain; answered = true; hint = false;
      } else { message = '❌ ' + (r.why || 'Not right yet.'); }
      draw();
      const again = host.querySelector('#dw-line'); if (again) { again.focus({ preventScroll: true }); again.select(); }
    }

    async function run() {
      const token = ++version, ed = host.querySelector('#dw-code'), btn = host.querySelector('[data-job="run"]');
      const tests = ticket.tests, inputs = tests.map(t => t[0]);
      btn.disabled = true; rows = null; message = 'Running the cases…'; results();
      try {
        let values;
        if (ticket.lang === 'python') {
          const code = ed.value + '\nimport json as _dwj\n_dwi = _dwj.loads(' + JSON.stringify(JSON.stringify(inputs)) + ')\n_dwo = []\nfor _dwv in _dwi:\n    try:\n        _r = repair(_dwv)\n        if isinstance(_r, float) and _r.is_integer():\n            _r = int(_r)\n        _dwo.append({"v": _dwj.dumps(_r)})\n    except Exception as _dwe:\n        _dwo.append({"e": str(_dwe)})\nprint("__DW__" + _dwj.dumps(_dwo))\n';
          const r = await A.interp.run('python', code);
          if (token !== version) return;
          if (!r.ok) throw Error(r.error || 'The code stopped.');
          const line = String(r.stdout || '').split('\n').filter(l => l.startsWith('__DW__')).pop();
          if (!line) throw Error('Keep the repair function and let the workshop call it for each input.');
          values = JSON.parse(line.slice(6));
        } else {
          const code = ed.value + '\nreturn ' + JSON.stringify(inputs) + '.map(input => { try { return { v: JSON.stringify(repair(input)) }; } catch (e) { return { e: String(e.message || e) }; } });';
          const r = await A.interp.run('js', code);
          if (token !== version) return;
          if (!r.ok) throw Error(r.error || 'The code stopped.');
          values = JSON.parse(r.value);
        }
        if (!Array.isArray(values) || values.length !== tests.length) throw Error('Keep the repair function and let the workshop call it for each input.');
        rows = values.map((v, i) => ({ ok: !v.e && norm(v.v) === norm(show(tests[i][1])), actual: v.e ? 'Error · ' + v.e : String(v.v) }));
        const n = rows.filter(x => x.ok).length;
        if (n === rows.length) { passed(); message = '✅ Repair verified · ' + n + ' of ' + n + ' cases passed.'; }
        else message = n + ' of ' + rows.length + ' passed. Compare a failing return with its expected value.';
      } catch (err) { if (token !== version) return; message = err.message || String(err); }
      if (token === version) { draw(); const b = host.querySelector('[data-job="run"]'); if (b) b.focus({ preventScroll: true }); }
    }

    host.onchange = e => {
      if (e.target.matches('[data-lang]')) { lang = e.target.value; ls.set('dw_lang', lang); newTicket(); e.target.focus(); }
      else if (e.target.matches('[data-level]')) { level = e.target.value; ls.set('dw_level', level); newTicket(); e.target.focus(); }
    };
    host.onkeydown = e => {
      if (e.target.matches('#dw-line') && e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); checkLine(); }
    };
    host.onclick = e => {
      const action = e.target.closest('[data-job]')?.dataset.job;
      if (!action) return;
      if (action === 'run') return void run();
      if (action === 'check') return void checkLine();
      if (action === 'another' || action === 'next') return newTicket();
      if (action === 'hint') { hint = !hint; draw(); const b = host.querySelector('[data-job="hint"]'); if (b) b.focus({ preventScroll: true }); return; }
      if (action === 'answer') {
        answered = true; hint = false;
        message = ticket.kind === 'diff' ? 'Answer: ' + ticket.answer : 'A working repair is in the editor. Run it to see every case pass.';
        if (ticket.kind === 'repair') draft = ticket.fix;
        draw(); const b = host.querySelector('[data-job="answer"]'); if (b) b.focus({ preventScroll: true });
        return;
      }
      if (action === 'lessons') return A.cybertab.go('code');
    };
    newTicket();
  }

  A.debugWorkshop = { render };
})();

// Cyber > 🕶️ Cyber games > Terminal ops.
// The terminal is the game: everything from the first scan to the submitted record happens by
// typing commands. Four difficulty levels, endless seeded estates, and a checklist of objectives
// the shell itself completes as the evidence appears on screen. Nothing here touches a network.
(() => {
  const P = A.play = A.play || { games: {} };
  const L = P.logic = P.logic || {};
  const TO = typeof TerminalOps !== 'undefined' ? TerminalOps : null;
  if (TO) L.terminalOps = TO;

  let stage = null;
  const $ = id => stage && stage.querySelector('#' + id);
  const esc = t => String(t == null ? '' : t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const mono = 'font-family:Consolas,"Cascadia Mono",monospace';
  const box = 'border:1px solid var(--line);background:var(--panel2);border-radius:10px;padding:10px 12px';
  const pill = (t, col) => '<span style="display:inline-block;padding:2px 8px;border-radius:999px;font-size:11.5px;border:1px solid ' + (col || 'var(--line)') + ';color:' + (col || 'var(--mute)') + ';background:rgba(255,255,255,.03)">' + esc(t) + '</span>';
  const bar = (pct, col) => '<div style="height:6px;border-radius:999px;background:rgba(255,255,255,.09);overflow:hidden"><div style="height:100%;width:' + Math.max(0, Math.min(100, pct)) + '%;background:' + col + '"></div></div>';

  const MANUAL = [
    ['Everything is a command', 'There are no multiple-choice questions here. Scan, decode, connect, escalate, pivot and submit — all from the prompt. The checklist on screen ticks itself when the evidence actually appears in the output.'],
    ['Recon', 'nmap -sV -Pn <ip> shows the exposed surface. Read the version and the extra script lines: they say where the leak is (a public repo, a readable /backup directory, anonymous FTP).'],
    ['The leaked credential', 'The entry lead is stored encoded, not encrypted: Base64, hex, or hex over Base64. Pipe it through the right decoder — base64 -d, xxd -r, or both — and read USER and PASSWORD.'],
    ['Getting a shell', 'ssh <user>@<ip>. The password is only useful once you have actually seen it; guessing counts as a failed attempt.'],
    ['Privilege escalation', 'Enumerate first: sudo -l, id, find / -perm -4000. Then use the one policy that is wrong. A NOPASSWD binary that can run commands is a root shell (find -exec, vim :!, awk system, docker -v /:/mnt, an old SUID nmap).'],
    ['Encodings are not encryption', 'The application config is Base64 or hex. cat it, decode it, grep DB_PASSWORD. The same is true of the leaked notes and of most logs you will meet in real work.'],
    ['Lateral movement', 'The database is only reachable from inside the estate. Once you have the database password, ssh to db01 from web01 — not from your own box.'],
    ['The objective', 'The record list on db01 contains the target record and decoys. Find the right id, then submit <id>. Wrong ids count as failed attempts.'],
    ['Scoring', '100 points, minus the hint cost for your difficulty, minus 6 for every failed ssh or wrong submission. Grade A is a clean run with no hints. Ratings use the same Elo scale as the other cyber games.']
  ];

  function mount(el, api) {
    if (!TO) {
      el.innerHTML = '<p style="padding:12px">The terminal engine did not load. Check web/js/terminal-ops-rules.js.</p>';
      return () => { };
    }
    const rating = L.makeRating ? L.makeRating('tops') : null;
    let pref = {};
    try { pref = JSON.parse(ls.get('tops_prefs', '{}')) || {}; } catch (e) { pref = {}; }
    const cfg = {
      level: TO.levels[pref.level] ? pref.level : 'analyst',
      manual: !!pref.manual
    };
    let S = null;
    let view = 'missions', lesson = 0, academyInput = '', academyLines = [];
    let practice = TO.training.session();
    const completed = new Set();
    try {
      for (const index of JSON.parse(ls.get('tops_lessons', '[]'))) {
        if (Number.isInteger(index) && TO.training.lessons[index]) completed.add(index);
      }
    } catch (e) { /* Start with an empty record if saved progress is unreadable. */ }
    const savePref = () => ls.set('tops_prefs', JSON.stringify(cfg));
    const tabs = () => '<nav class="row" aria-label="Terminal Ops" style="gap:8px;margin-bottom:10px">' +
      ['missions', 'academy'].map(tab => '<button class="' + (view === tab ? 'pri' : 'ib') + '" data-act="tab" data-tab="' + tab +
        '" aria-pressed="' + (view === tab) + '">' + (tab === 'missions' ? 'Missions' : 'Academy') + '</button>').join('') + '</nav>';

    const seed = () => {
      try { return crypto.getRandomValues(new Uint32Array(1))[0] >>> 0; }
      catch (e) { return (Math.random() * 4294967295) >>> 0; }
    };
    const missionNo = () => {
      const n = (parseInt(ls.get('tops_n', '0'), 10) || 0) + 1;
      ls.set('tops_n', String(n));
      return n;
    };

    function hud() {
      if (!api || !api.hud) return;
      api.hud('⌨ Terminal ops' + (view === 'academy' ? '   Academy' : (rating ? '   ★ ' + rating.rating : '') + (S ? '   mission ' + S.n : '')));
    }

    function begin() {
      const m = TO.generate(seed(), cfg.level);
      S = {
        n: missionNo(), m, ses: TO.session(m),
        lines: [], hist: [], hi: 0, input: '',
        done: false, score: 100, grade: 'A', delta: null, fs: false
      };
      S.lines.push({ k: 'info', t: 'TerminalOps 3.2 — offline training shell · nothing here is a real network' });
      S.lines.push({ k: 'info', t: 'mission ' + S.n + ' · ' + TO.levels[cfg.level].name + ' · ' + m.org.name + ' (' + m.targetIp + ')' });
      S.lines.push({ k: 'out', t: m.briefText });
      S.lines.push({ k: 'info', t: "type 'help' for commands · 'objectives' for the checklist · 'hint' if you stall" });
      draw();
    }

    /* ------------------------------------------------ terminal */
    function lineHTML(l) {
      if (l.k === 'cmd') return '<span style="color:#7fd1ff">' + esc(l.t) + '</span>';
      if (l.k === 'info') return '<span style="color:#8496a8">' + esc(l.t) + '</span>';
      return String(l.t).split('\n').map(x => {
        const col = /^✓/.test(x) ? '#6ee7a0' : /^✗/.test(x) ? '#ff9b9b' : /^—/.test(x) ? '#94a7bb' : '#cfe9d6';
        return '<span style="color:' + col + '">' + esc(x) + '</span>';
      }).join('\n');
    }

    function drawLobby() {
      if (S && S.fs && A.termFS) A.termFS.exit();
      S = null;
      const lv = TO.levels[cfg.level];
      el.innerHTML = '<div style="width:min(860px,100%);padding-bottom:18px">' +
        tabs() +
        '<div style="' + box + ';margin-bottom:10px">' +
          '<div class="small mute" style="letter-spacing:.08em">SIMULATED INTRUSION · OFFLINE · UNLIMITED MISSIONS</div>' +
          '<h2 style="margin:2px 0 4px">Terminal ops</h2>' +
          '<p class="small" style="margin:0;line-height:1.55">A hacking game played entirely from a shell. Scan the target, decode the leaked credential, land a session, escalate, pull the database password out of an encoded config, pivot and submit the record — every step typed, none of them multiple choice. Each mission invents its own estate, hosts, accounts, passwords, paths, escalation flaw and record id, so the work never runs out. Nothing leaves this page.</p>' +
        '</div>' +
        '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:8px;margin-bottom:10px">' +
          Object.entries(TO.levels).map(([k, v]) => '<button data-level="' + k + '" style="text-align:left;cursor:pointer;padding:10px 12px;border-radius:10px;border:1px solid ' + (k === cfg.level ? 'var(--acc)' : 'var(--line)') + ';background:' + (k === cfg.level ? 'rgba(90,160,255,.09)' : 'var(--panel2)') + ';color:inherit">' +
            '<b>' + esc(v.name) + '</b><div class="small mute" style="margin-top:3px;line-height:1.45">' + esc(v.note) + '</div></button>').join('') +
        '</div>' +
        '<div class="row" style="gap:10px;flex-wrap:wrap;align-items:center;margin-bottom:10px">' +
          '<span class="small mute">' + esc(lv.note) + '</span>' +
          '<span style="flex:1"></span>' +
          (rating ? '<span class="small mute">★ ' + rating.rating + ' · ✓ ' + rating.solved + ' missions</span>' : '') +
          '<button class="pri" data-act="start">Start hacking →</button>' +
        '</div>' +
        '<div style="' + box + ';margin-bottom:8px">' +
          '<div class="row" style="gap:8px;align-items:center"><b class="small">How it works</b><span style="flex:1"></span><button class="ib" data-act="manual">' + (cfg.manual ? 'Hide' : 'Show') + ' guide</button></div>' +
          (cfg.manual ? '<div class="small" style="margin-top:8px;line-height:1.6">' + MANUAL.map(x => '<div style="margin-bottom:7px"><b>' + esc(x[0]) + '</b><div class="mute" style="margin-top:2px">' + esc(x[1]) + '</div></div>').join('') +
            '<div style="margin-top:6px;background:rgba(0,0,0,.3);border:1px solid var(--line);border-radius:8px;padding:8px 10px;' + mono + ';font-size:11.5px;line-height:1.6;white-space:pre-wrap">nmap -sV -Pn 203.0.113.42\ncat ~/loot/atlas-leak.txt | base64 -d\nssh svc_deploy@203.0.113.42\nsudo -l\ncat /var/www/app/.env.b64 | base64 -d | grep DB_PASSWORD\nssh svc_billing@db01.atlas.internal\nsubmit REC-1234-ATLA</div></div>' : '') +
        '</div>' +
        '<div class="small mute">Missions are generated from a seed and never repeat. Hints and failed attempts cost points; difficulty changes the encodings, the escalation flaw and the number of decoys.</div>' +
        '</div>';
      hud();
    }

    function drawPlay() {
      const m = S.m, objs = S.ses.objectives();
      const doneCount = objs.filter(o => o.done).length;
      const chips = objs.map(o => '<span style="display:inline-block;padding:3px 9px;border-radius:999px;font-size:11.5px;border:1px solid ' + (o.done ? 'rgba(110,231,160,.5)' : 'var(--line)') + ';color:' + (o.done ? '#6ee7a0' : 'var(--mute)') + ';background:' + (o.done ? 'rgba(110,231,160,.08)' : 'rgba(255,255,255,.02)') + ';margin:0 4px 4px 0">' + (o.done ? '✓ ' : '○ ') + esc(o.label) + '</span>').join('');
      const summary = S.done ? '<div style="' + box + ';margin-bottom:8px">' +
        '<div class="row" style="gap:8px;align-items:center;flex-wrap:wrap">' + pill('Grade ' + S.grade, 'var(--acc)') + pill(S.score + '/100') + pill('mission ' + S.n) +
          (S.delta != null ? pill((S.delta >= 0 ? '+' : '') + S.delta + ' rating') : '') +
          '<span style="flex:1"></span><button class="pri" data-act="next">New mission →</button><button class="ib" data-act="leave">Missions</button></div>' +
        '<div class="small mute" style="margin-top:4px">' + (S.score >= 92 ? 'Clean run: no hints, no failed attempts.' : 'Replay on the same difficulty for a cleaner estate — or move up a level.') + ' You can keep typing in the shell above.</div>' +
        '</div>' : '';
      el.innerHTML = '<div style="width:min(900px,100%);display:flex;flex-direction:column;gap:8px;padding-bottom:16px">' +
        tabs() +
        '<div class="row" style="gap:6px;flex-wrap:wrap;align-items:center">' +
          '<b>⌨ Terminal ops</b>' + pill('mission ' + S.n) + pill(TO.levels[m.level].name, 'var(--acc)') + pill(m.org.name) +
          '<span style="flex:1"></span>' +
          (rating ? '<span class="small mute">★ ' + rating.rating + '</span>' : '') +
          '<button class="ib" data-act="cmd" data-cmd="brief">Brief</button>' +
          '<button class="ib" data-act="cmd" data-cmd="objectives">Objectives</button>' +
          '<button class="ib" data-act="cmd" data-cmd="hint">Hint</button>' +
          '<button class="ib" data-act="leave">Leave</button>' +
        '</div>' +
        '<div style="' + box + ';padding:8px 10px">' +
          '<div class="row" style="gap:8px;align-items:center;margin-bottom:5px"><span class="small mute">' + doneCount + '/' + objs.length + ' objectives · ' + esc(m.targetIp) + ' · db01.' + esc(m.domain) + '</span><span style="flex:1"></span><span class="small mute">' + (S.done ? 'complete' : 'type commands below') + '</span></div>' +
          bar(doneCount / objs.length * 100, '#5fbf7f') +
          '<div style="margin-top:6px">' + chips + '</div>' +
        '</div>' +
        summary +
        '<div id="tobox" class="term-fs-box" style="background:#05070b;border:1px solid var(--line);border-radius:10px;padding:10px 12px">' +
          '<div class="row" style="gap:6px;align-items:center;margin-bottom:6px"><b class="small">⌨ ' + esc(m.org.name) + '</b><span class="small mute">' + esc(m.targetIp) + ' · ' + doneCount + '/' + objs.length + ' objectives</span><span style="flex:1"></span><button class="ib" data-act="cmd" data-cmd="clear" title="Clear screen">Clear</button><button class="ib" id="tofs" data-act="fs" title="Fullscreen terminal (Esc to exit)">⛶ Fullscreen</button></div>' +
          '<pre id="toout" class="term-fs-out" style="margin:0;height:min(46vh,380px);overflow:auto;' + mono + ';font-size:12.5px;line-height:1.55;white-space:pre-wrap;word-break:break-word;user-select:text;-webkit-user-select:text;cursor:text">' + S.lines.map(lineHTML).join('\n') + '</pre>' +
          '<div class="row term-fs-prompt-row" style="gap:6px;align-items:center;margin-top:8px;border-top:1px solid rgba(255,255,255,.06);padding-top:8px">' +
            '<span id="toprompt" style="' + mono + ';font-size:12.5px;color:#6ee7a0;white-space:nowrap">' + esc(S.ses.prompt()) + '</span>' +
            '<input id="toin" autocomplete="off" autocapitalize="off" spellcheck="false" style="flex:1;min-width:80px;background:transparent;border:0;color:#fff;' + mono + ';font-size:12.5px;outline:none" placeholder="type a command, help for the list">' +
          '</div>' +
        '</div>' +
        '<div class="small mute" style="' + mono + '">help · nmap -sV &lt;ip&gt; · cat | base64 -d · ssh user@host · sudo -l · submit &lt;record id&gt; &nbsp;|&nbsp; ↑ history · Ctrl+L clears</div>' +
        '</div>';

      const out = $('toout');
      if (out) out.scrollTop = out.scrollHeight;
      const inp = $('toin');
      if (inp) {
        inp.value = S.input;
        inp.oninput = e => { S.input = inp.value; };
        inp.onkeydown = e => {
          if (e.key === 'Enter') { e.preventDefault(); exec(inp.value); }
          else if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (S.hi > 0) { S.hi--; S.input = S.hist[S.hi] || ''; inp.value = S.input; }
          } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (S.hi < S.hist.length) { S.hi++; S.input = S.hist[S.hi] || ''; inp.value = S.input; }
          } else if (e.key === 'l' && e.ctrlKey) {
            e.preventDefault();
            S.lines = []; S.input = ''; draw();
          }
        };
        try { inp.focus({ preventScroll: true }); } catch (e) { inp.focus(); }
      }
      /* the click that opened the mission may take focus back after the handler, so focus on the next tick too */
      setTimeout(() => {
        const i2 = $('toin');
        if (i2 && document.activeElement !== i2) { try { i2.focus({ preventScroll: true }); } catch (e) { } }
      }, 0);
      if (S.fs && A.termFS) A.termFS.apply($('tobox'), true, $('tofs'), () => { if (S) S.fs = false; });
      hud();
    }

    function exec(line) {
      if (!S) return;
      const cmd = String(line == null ? '' : line).trim();
      if (!cmd) return;
      S.input = '';
      if (/^(clear|cls)$/i.test(cmd)) {
        S.lines = []; S.hist.push(cmd); S.hi = S.hist.length;
        return draw();
      }
      S.lines.push({ k: 'cmd', t: S.ses.prompt() + cmd });
      let out = '';
      try { out = S.ses.run(cmd); }
      catch (e) { out = '✗ shell error: ' + (e && e.message ? e.message : e); }
      if (out) S.lines.push({ k: 'out', t: out });
      S.hist.push(cmd);
      S.hi = S.hist.length;
      if (S.lines.length > 600) S.lines = S.lines.slice(-600);
      if (S.ses.done() && !S.done) {
        S.done = true;
        S.score = S.ses.score();
        S.grade = S.ses.grade();
        if (rating) S.delta = rating.update(true, TO.levels[S.m.level].diff, S.ses.hintCount() > 0);
      }
      draw();
    }

    function drawAcademy(focus = false) {
      const lessons = TO.training.lessons;
      const current = lessons[lesson];
      el.innerHTML = '<div style="width:min(900px,100%);padding-bottom:18px">' + tabs() +
        '<div style="' + box + ';margin-bottom:10px"><h2 style="margin:0 0 5px">Terminal Ops Academy</h2>' +
        '<p class="small mute" style="margin:0">Practice Linux commands and defensive workflows on bundled offline evidence. ' + completed.size + '/' + lessons.length + ' lessons complete.</p></div>' +
        '<div class="row" style="gap:6px;flex-wrap:wrap;margin-bottom:10px" aria-label="Lessons">' + lessons.map((item, index) =>
          '<button class="' + (index === lesson ? 'pri' : 'ib') + '" data-act="lesson" data-index="' + index + '" aria-pressed="' + (index === lesson) + '">' +
          (completed.has(index) ? '✓ ' : '') + esc(item.title) + '</button>').join('') + '</div>' +
        '<section style="' + box + ';margin-bottom:10px"><h3 style="margin:0 0 6px">' + esc(current.title) + '</h3>' +
        '<p class="small" style="margin:0 0 8px;line-height:1.55">' + esc(current.detail) + '</p>' +
        '<div class="row" style="gap:6px;flex-wrap:wrap;margin-bottom:8px">' + current.commands.map(command =>
          '<button class="ib" style="' + mono + '" data-act="practice-command" data-cmd="' + esc(command) + '">' + esc(command) + '</button>').join('') + '</div>' +
        '<a class="small" href="' + esc(current.source[1]) + '" target="_blank" rel="noopener noreferrer">' + esc(current.source[0]) + '</a></section>' +
        '<div style="' + box + ';background:#05070b"><div class="row" style="align-items:center;gap:8px;margin-bottom:6px"><b class="small">Practice terminal</b>' +
        '<span style="flex:1"></span><button class="ib" data-act="practice-reset">Reset session</button></div>' +
        '<pre id="toaout" role="log" aria-label="Practice terminal output" style="margin:0;min-height:130px;max-height:32vh;overflow:auto;white-space:pre-wrap;overflow-wrap:anywhere;color:#cfe9d6;' + mono + '">' +
        (academyLines.length ? academyLines.map(lineHTML).join('\n') : 'Type a command, or select one above and press Enter.') + '</pre>' +
        '<form id="toaform" class="row" style="gap:8px;margin-top:10px;align-items:center">' +
        '<span aria-hidden="true" style="color:#6ee7a0;' + mono + '">analyst@training:~$</span>' +
        '<input id="toain" aria-label="Practice command" style="flex:1;min-width:50px;' + mono + '" autocomplete="off" autocapitalize="off" spellcheck="false">' +
        '<button class="ib" type="submit">Run</button></form></div></div>';
      const output = $('toaout');
      output.scrollTop = output.scrollHeight;
      const input = $('toain');
      input.value = academyInput;
      input.oninput = () => { academyInput = input.value; };
      $('toaform').onsubmit = event => {
        event.preventDefault();
        const line = input.value.trim();
        if (!line) return;
        const result = practice.run(line);
        academyLines.push({ k: 'cmd', t: 'analyst@training:~$ ' + line });
        if (result.out) academyLines.push({ k: result.err ? 'info' : 'out', t: result.out });
        for (const index of result.completed) {
          if (completed.has(index)) continue;
          completed.add(index);
          academyLines.push({ k: 'out', t: '✓ Lesson complete — ' + lessons[index].title });
        }
        ls.set('tops_lessons', JSON.stringify([...completed]));
        academyLines = academyLines.slice(-120);
        academyInput = '';
        drawAcademy(true);
      };
      if (focus) input.focus();
      hud();
    }

    function draw() { if (view === 'academy') drawAcademy(); else if (S) drawPlay(); else drawLobby(); }

    el.onclick = e => {
      const b = e.target.closest('button');
      if (!b) {
        /* never steal focus (or a text selection) from the terminal output so highlighting & copying works cleanly */
        if (e.target.closest('#toout')) return;
        const sel = window.getSelection ? String(window.getSelection()) : '';
        if (e.target.closest('#toprompt') && !sel) { const inp = $('toin'); if (inp) { try { inp.focus({ preventScroll: true }); } catch (e2) { inp.focus(); } } }
        return;
      }
      if (b.dataset.level) { cfg.level = b.dataset.level; savePref(); return drawLobby(); }
      switch (b.dataset.act) {
        case 'tab':
          if (S && S.fs && A.termFS) { S.fs = false; A.termFS.exit(); }
          view = b.dataset.tab;
          return draw();
        case 'lesson': lesson = Number(b.dataset.index); return drawAcademy();
        case 'practice-command': {
          const input = $('toain');
          academyInput = input.value = b.dataset.cmd;
          input.focus();
          return;
        }
        case 'practice-reset':
          practice = TO.training.session(); academyLines = []; academyInput = '';
          return drawAcademy(true);
        case 'start': return begin();
        case 'manual': cfg.manual = !cfg.manual; savePref(); return drawLobby();
        case 'cmd': return exec(b.dataset.cmd || 'help');
        case 'fs':
          if (!S) return;
          S.fs = !S.fs;
          if (A.termFS) A.termFS.apply($('tobox'), S.fs, $('tofs'), () => { if (S) S.fs = false; });
          { const inp = $('toin'); if (inp) { try { inp.focus({ preventScroll: true }); } catch (e2) { inp.focus(); } } }
          return;
        case 'next': return begin();
        case 'leave': return drawLobby();
        default: return;
      }
    };

    drawLobby();
    return () => { if (S && S.fs && A.termFS) { S.fs = false; A.termFS.exit(); } };
  }

  P.games.terminal_ops = {
    name: 'Terminal ops · full intrusion',
    icon: '⌨️',
    desc: 'Play the whole intrusion from a shell: scan, decode the leak, get in, escalate, pivot, submit. Four difficulties, endless seeded estates, every step typed.',
    cat: 'cyber',
    mount: (el, api) => { stage = el; return mount(el, api); }
  };
})();

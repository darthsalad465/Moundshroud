// Cyber > 🕶️ Cyber games > Red / Blue · Remote access.
// A simulated engagement, not a real network: a seeded kill chain you work through as the operator
// (scan → access → foothold → escalation → credentials → lateral → objective), the defensive
// response to the same chain (triage → scope → contain → eradicate → recover), or both in one
// sitting. Three estates back to back make the campaign. Every stage is assessed.
(() => {
  const RA = typeof RemoteAccess !== 'undefined' ? RemoteAccess : null;
  const P = A.play = A.play || { games: {} };
  const L = P.logic = P.logic || {};
  if (RA) L.remoteAccess = RA;

  let stage = null;
  const $ = id => stage && stage.querySelector('#' + id);
  const esc = t => String(t == null ? '' : t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const box = 'border:1px solid var(--line);background:var(--panel2);border-radius:10px;padding:10px 12px';
  const mono = 'font-family:Consolas,"Cascadia Mono",monospace';
  const pill = (t, col) => '<span style="display:inline-block;padding:2px 8px;border-radius:999px;font-size:11.5px;border:1px solid ' + (col || 'var(--line)') + ';color:' + (col || 'var(--mute)') + ';background:rgba(255,255,255,.03)">' + esc(t) + '</span>';
  const bar = (pct, col) => '<div style="height:6px;border-radius:999px;background:rgba(255,255,255,.09);overflow:hidden"><div style="height:100%;width:' + Math.max(0, Math.min(100, pct)) + '%;background:' + col + '"></div></div>';

  const MODES = {
    red: { name: 'Red team', icon: '↗', side: 'red', desc: 'Plan and run one intrusion end to end, quietly. Scan, get in, escalate, pivot, deliver.' },
    blue: { name: 'Blue team', icon: '◇', side: 'blue', desc: 'Walk into a generated incident. Detect it, scope it, contain it, fix the cause, recover.' },
    full: { name: 'Full engagement', icon: '⇄', side: 'both', desc: 'Attack one estate, then defend the exact chain you just ran — the report is your own.' },
    campaign: { name: 'Campaign', icon: '▤', side: 'both', desc: 'Three different estates back to back on one noise budget. Mixed findings, no hand-holding.' }
  };

  const MANUAL = [
    ['Shell and encodings', 'Every case runs a real shell over the estate: ls, cd, cat, grep -r, find -name, chmod, pipes, sudo -l, ssh, plus base64 -d, xxd -r, rot13 and rev. Encodings are decoded, not guessed — that is how keys and evidence actually travel.'],
    ['Reconnaissance', 'Read the exposed surface before touching anything. Version, state and purpose decide what is worth trying; filtered ports and current builds are noise.'],
    ['Initial access', 'Match the technique to the exposure: default or reused credentials for a login, an admin function for an open management interface, a known-vulnerable build for a version you confirmed. Blind exploits crash services.'],
    ['Foothold', 'A session only matters if traffic can leave and return. Egress policy and the proxy pick your channel, not the payload.'],
    ['Privilege escalation', 'Enumerate first: sudo rules, SUID binaries, group membership, writable scheduled jobs, readable configs. A kernel exploit is the last resort, not the first.'],
    ['Credential access', 'Secrets live in .env files, config maps, backups, git history and shell history. Read them; do not guess them. Placeholders like CHANGEME are not credentials.'],
    ['Lateral movement', 'Pivot toward the objective you were scoped to, with a credential you already hold, over a channel you already use. Sweeping the network is how you get caught.'],
    ['Objective', 'Minimum necessary data, a channel you control, cleanup, and a report you can defend. Destructive actions and public drop sites turn a test into an incident.'],
    ['Blue · Triage', 'Detect the earliest unexplained event. The successful login is the consequence; the scan is the first chance you had.'],
    ['Blue · Scoping', 'Establish which identity and which hosts are involved before you change anything, or you lock out the wrong people.'],
    ['Blue · Containment', 'Isolate at the network layer, revoke sessions, rotate the credentials that were reachable — and preserve disk and memory. Rebooting destroys the evidence you need.'],
    ['Blue · Eradication', 'Remove the root cause and everything it produced. A WAF rule in front of an open service is theatre.'],
    ['Blue · Recovery', 'Restore from a known-good state, verify integrity, then write the timeline and notify. Notification deadlines are part of the job.']
  ];

  function mount(el, api) {
    stage = el;
    const rating = L.makeRating ? L.makeRating('rasim') : null;
    let pref = {};
    try { pref = JSON.parse(ls.get('rasim_prefs', '{}')) || {}; } catch (e) { pref = {}; }
    const cfg = {
      mode: MODES[pref.mode] ? pref.mode : 'red',
      level: RA && RA.levels[pref.level] ? pref.level : 'analyst',
      manual: !!pref.manual
    };
    let S = null;

    const savePref = () => ls.set('rasim_prefs', JSON.stringify(cfg));

    if (!RA) {
      el.innerHTML = '<p style="padding:12px">The remote-access engine did not load. Check web/js/remote-access-rules.js.</p>';
      return () => { };
    }

    /* ------------------------------------------------ helpers over the running state */
    const curCase = () => S.cases[S.ci];
    const curStages = () => S.phase === 'red' ? curCase().red : curCase().blue;
    const curStage = () => curStages()[S.si];

    /* Hidden: typing mcode in the shell opens the Terminal Playground's mcode (web/js/terminal-playground-mcode.js) on this estate.
       Its /code and /swarm only run read-only commands in this simulated shell and code in the sealed interpreter. */
    let mc = null;
    const paintShell = () => {
      const out = $('shout');
      if (out && S) { out.textContent = S.sh.join('\n'); out.scrollTop = out.scrollHeight; }
      const prompt = $('shprompt');
      if (prompt && S) prompt.textContent = mc?.open() ? mc.prompt() : curCase().shell.prompt();
    };
    function mcode() {
      const TPG = window.TerminalPlayground;
      if (!TPG?.mcode) return null;
      if (!mc) mc = TPG.mcode.create({
        ai: () => A.ai,
        models: async signal => {
          const response = await fetch('/api/models', { signal });
          if (!response.ok) throw new Error('Models unavailable');
          const { models = [] } = await response.json();
          return models.filter(model => !model.cloud).map(model => model.name).filter(Boolean);
        },
        interp: A.interp ? (lang, code, signal) => A.interp.run(lang, code, { isolated: true, collectFigures: false, signal }).then(A.interp.asText) : null,
        context: () => {
          const st = S && !S.done ? curStage() : null, host = S ? curCase().shell.host : 'shell';
          const brief = st ? (S.phase === 'red' ? 'Red' : 'Blue') + ' team · ' + st.phase + '\n' + String(st.prompt || '') : 'No stage is open.';
          return { key: S ? S.ci + ':' + S.phase + ':' + S.si : 'none', location: 'Remote access / ' + host, shellName: 'Linux shell on ' + host, shellId: 'bash',
            chat: brief, plan: brief + '\nAnswer the stage in the box above the shell.', task: st ? brief + '\nFind the answer with the shell. The player enters it.' : '', submit: '' };
        },
        recent: () => (S ? S.sh.slice(-40) : []),
        write: text => {
          if (!S) return null;
          const at = S.sh.push(text) - 1, sh = S.sh;
          paintShell();
          return { get t() { return sh[at]; }, set t(value) { sh[at] = value; } };
        },
        shell: command => {
          const sh = curCase().shell;
          S.sh.push(sh.prompt() + command);
          const out = sh.run(command);
          if (out) S.sh.push(out);
          paintShell();
          return out;
        },
        visible: () => !!S && S.shOpen && !S.done && stage === el,
        whipCursor: A.mcodeWhip ? { on: onCrack => A.mcodeWhip.on({ onCrack, target: () => $('shout') }), off: () => A.mcodeWhip.off() } : null,
        refresh: paintShell
      });
      return mc;
    }

    function seed() {
      try { return crypto.getRandomValues(new Uint32Array(1))[0] >>> 0; } catch (e) { return (Math.random() * 4294967295) >>> 0; }
    }

    function begin(retry) {
      const seeds = retry ? S.seeds.slice() : (cfg.mode === 'campaign' ? [seed(), seed(), seed()] : [seed()]);
      const cases = seeds.map(s => RA.generate(s, cfg.mode, cfg.level));
      const firstPhase = cfg.mode === 'blue' ? 'blue' : 'red';
      const expected = cases.reduce((n, c) => n + (firstPhase === 'blue' ? c.blue.length : c.red.length), 0) +
        (cfg.mode === 'full' ? cases[0].blue.length : 0);
      S = { mode: cfg.mode, level: cfg.level, seeds, cases, ci: 0, phase: firstPhase, si: 0, risk: 0, res: [], log: [], fb: null, done: false, win: false, expected, usedHint: false, hintOpen: false, rated: false, delta: null, sh: [], shHist: [], shIdx: 0, shOpen: false, shFocus: false, shFs: false };
      draw();
    }

    function hud() {
      if (!api || !api.hud) return;
      if (!S || S.done) { api.hud('🎯 Remote access' + (rating ? '   ★ ' + rating.rating : '')); return; }
      const st = curStage();
      api.hud('🎯 ' + (S.mode === 'campaign' ? 'Campaign ' + (S.ci + 1) + '/' + S.cases.length + '   ' : '') +
        (S.phase === 'red' ? 'Red' : 'Blue') + ' · ' + (st ? st.phase : '—') +
        '   ' + (S.phase === 'red' ? 'risk' : 'missteps') + ' ' + Math.round(S.risk) + '%' +
        (rating ? '   ★ ' + rating.rating : ''));
    }

    /* ------------------------------------------------ lobby */
    function drawLobby() {
      if (S && S.shFs && A.termFS) A.termFS.exit();
      S = null;
      const lv = RA.levels[cfg.level];
      el.innerHTML = '<div style="width:min(840px,100%);padding-bottom:18px">' +
        '<div style="' + box + ';margin-bottom:10px">' +
          '<div class="small mute" style="letter-spacing:.08em">SIMULATED ENGAGEMENT · OFFLINE · SEEDED</div>' +
          '<h2 style="margin:2px 0 4px">Remote access</h2>' +
          '<p class="small" style="margin:0;line-height:1.5">Run a complete intrusion against a generated estate, then walk the same estate as the defender. Every case invents its own exposure, hosts, accounts and rules of engagement, so nothing repeats. A working shell reads the estate and decodes what the chain hides — Base64, hex, rot13 — so you are using commands, not guessing. Nothing here touches a real network.</p>' +
        '</div>' +
        '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:8px;margin-bottom:10px">' +
          Object.entries(MODES).map(([id, m]) => '<button data-mode="' + id + '" style="text-align:left;cursor:pointer;padding:10px 12px;border-radius:10px;border:1px solid ' + (id === cfg.mode ? 'var(--acc)' : 'var(--line)') + ';background:' + (id === cfg.mode ? 'rgba(90,160,255,.09)' : 'var(--panel2)') + ';color:inherit">' +
            '<div style="font-size:18px">' + m.icon + '</div><b>' + esc(m.name) + '</b><div class="small mute" style="margin-top:3px;line-height:1.45">' + esc(m.desc) + '</div></button>').join('') +
        '</div>' +
        '<div class="row" style="gap:10px;flex-wrap:wrap;align-items:center;margin-bottom:10px">' +
          '<label class="small">Difficulty <select id="ralevel" class="ib" style="padding:4px 8px">' + Object.entries(RA.levels).map(([k, v]) => '<option value="' + k + '"' + (k === cfg.level ? ' selected' : '') + '>' + esc(v.name) + '</option>').join('') + '</select></label>' +
          '<span class="small mute">' + esc(lv.note) + '</span>' +
          '<span class="sp" style="flex:1"></span>' +
          (rating ? '<span class="small mute">★ ' + rating.rating + ' · ✓ ' + rating.solved + ' ops</span>' : '') +
          '<button class="pri" data-act="start">Start ' + esc(MODES[cfg.mode].name) + ' →</button>' +
        '</div>' +
        '<div style="' + box + '"><div class="row" style="gap:8px;align-items:center"><b class="small">📖 Field manual</b><span class="sp" style="flex:1"></span><button class="ib" data-act="manual">' + (cfg.manual ? 'Hide' : 'Read') + '</button></div>' +
          (cfg.manual ? '<div style="margin-top:8px;display:grid;gap:6px">' + MANUAL.map(([t, d]) => '<div class="small"><b>' + esc(t) + '.</b> <span class="mute">' + esc(d) + '</span></div>').join('') + '</div>' : '<div class="small mute" style="margin-top:4px">The eight phases of an intrusion and the five steps of the response, with what actually matters in each.</div>') +
        '</div></div>';
      hud();
    }

    /* ------------------------------------------------ play */
    function drawPlay() {
      const c = curCase(), list = curStages(), st = list[S.si];
      if (!st) return finish();
      const total = list.length;
      const consoleText = S.log.length ? S.log.map(l => '[' + l.t + '] ' + l.text).join('\n') : 'session console idle — the first action you take is logged here.';
      const ops = S.cases.length > 1 ? '<span class="small mute">estate ' + (S.ci + 1) + '/' + S.cases.length + '</span>' : '';
      const fb = S.fb;
      const opts = st.options ? '<div style="display:grid;gap:6px;margin-top:8px">' + st.options.map((o, i) =>
        '<button data-o="' + i + '"' + (fb && fb.kind === 'ok' ? ' disabled' : '') + ' style="text-align:left;cursor:pointer;padding:9px 11px;border-radius:8px;border:1px solid var(--line);background:rgba(255,255,255,.02);color:inherit;line-height:1.45;font-size:13px">' +
        '<b style="color:var(--acc)">' + String.fromCharCode(65 + i) + '</b> ' + esc(o.label) + '</button>').join('') + '</div>' : '';
      const input = st.input ? '<div class="row" style="gap:8px;margin-top:8px"><input id="rain" class="ib" style="flex:1;padding:7px 9px;' + mono + '" placeholder="' + esc(st.input.placeholder || 'Type your answer') + '" autocomplete="off" spellcheck="false"' + (fb && fb.kind === 'ok' ? ' disabled' : '') + '><button class="pri" data-act="submit">Check</button></div>' : '';
      el.innerHTML = '<div style="width:min(880px,100%);padding-bottom:16px">' +
        '<div class="row" style="gap:6px;flex-wrap:wrap;align-items:center;margin-bottom:8px">' +
          '<b>🎯 Remote access</b>' + pill(MODES[S.mode].name) + pill(S.phase === 'red' ? 'Red team' : 'Blue team', S.phase === 'red' ? '#f0806b' : '#6fb3f0') + ops +
          '<span class="sp" style="flex:1"></span>' +
          '<button class="ib" data-act="shell">🖥 Shell</button>' +
          '<button class="ib" data-act="abort">Case selection</button>' +
        '</div>' +
        '<div style="' + box + ';margin-bottom:8px">' +
          '<div class="row" style="gap:8px;align-items:center;margin-bottom:4px"><span class="small mute">' + esc(c.scenario.name) + ' · ' + esc(c.scenario.asset) + '</span><span class="sp" style="flex:1"></span><span class="small mute">' + (S.phase === 'red' ? 'detection risk' : 'investigation missteps') + ' ' + Math.round(S.risk) + '%</span></div>' +
          bar(S.risk, S.risk > 70 ? '#e05555' : S.risk > 35 ? '#e0a84a' : '#5fbf7f') +
        '</div>' +
        '<pre style="margin:0 0 8px;max-height:150px;overflow:auto;background:#07090c;border:1px solid var(--line);border-radius:8px;padding:8px 10px;' + mono + ';font-size:11.5px;line-height:1.55;color:#9fd6a8;white-space:pre-wrap">' + esc(consoleText) + '</pre>' +
        '<div style="' + box + '">' +
          '<div class="row" style="gap:6px;flex-wrap:wrap;align-items:center;margin-bottom:6px">' + pill(st.phase, 'var(--acc)') + pill('Stage ' + (S.si + 1) + '/' + total) + (st.skill !== st.phase ? pill(st.skill) : '') + '<span class="sp" style="flex:1"></span><button class="ib" data-act="hint">Hint</button></div>' +
          '<b>' + esc(st.title) + '</b>' +
          '<div class="small" style="margin:3px 0 8px;line-height:1.5">' + esc(st.brief) + '</div>' +
          '<div style="background:rgba(0,0,0,.28);border:1px solid var(--line);border-radius:8px;padding:8px 10px">' +
            '<div class="small mute" style="' + mono + ';margin-bottom:4px">' + esc(st.artifact.label) + '</div>' +
            '<pre style="margin:0;' + mono + ';font-size:11.5px;line-height:1.55;white-space:pre-wrap;color:#c9d6e2">' + esc(st.artifact.text) + '</pre>' +
          '</div>' +
          '<div style="margin-top:9px"><b class="small">' + esc(st.prompt) + '</b></div>' +
          opts + input +
          (S.hintOpen && !(fb && fb.kind === 'ok') ? '<div class="small" style="margin-top:8px;color:var(--warn)">Hint: ' + esc(st.hint) + '</div>' : '') +
          (fb ? '<div style="margin-top:9px;border-top:1px solid var(--line);padding-top:8px" role="status">' +
            (fb.kind === 'ok'
              ? '<div style="color:var(--ok);font-weight:600">✓ ' + (fb.tries === 1 ? 'Correct, first time.' : 'Correct.') + '</div><div class="small" style="margin-top:3px;line-height:1.5">' + esc(fb.text) + '</div>' +
                '<button class="pri" style="margin-top:7px" data-act="cont">' + (lastStage() ? 'See the report →' : 'Continue →') + '</button>'
              : '<div style="color:var(--bad);font-weight:600">That is not the move.</div><div class="small" style="margin-top:3px;line-height:1.5">' + esc(fb.text) + '</div>' +
                (S.risk >= 100 ? '<div class="small" style="margin-top:6px;color:var(--bad)"><b>Detection risk is at 100%: the operation is burned.</b></div><button class="pri" style="margin-top:7px" data-act="burn">Read the report →</button>' : '<div class="small mute" style="margin-top:5px">Risk +' + (st.penalty || 14) + '%. Try again.</div>')) +
          '</div>' : '') +
        '</div>' + shellPanel() + '</div>';
      const inp = $('rain');
      if (inp) { inp.value = ''; if (!S.shOpen) inp.focus({ preventScroll: true }); inp.onkeydown = e => { if (e.key === 'Enter') submitInput(); }; }
      const shin = $('shin');
      if (shin) {
        shin.onkeydown = e => {
          if (mc?.picking?.() && (/^Arrow|^Escape$/.test(e.key) || /^(?:Enter|Delete|Backspace)$/.test(e.key) && !shin.value) && mc.key(e.key)) { e.preventDefault(); e.stopPropagation(); paintShell(); return; }
          if (e.key?.toLowerCase() === 'c' && e.ctrlKey && (mc?.whipping?.() || mc?.busy?.()) && shin.selectionStart === shin.selectionEnd && !String(window.getSelection?.() || '')) { e.preventDefault(); mc.interrupt(); paintShell(); return; }
          if (e.key === 'Enter') { e.preventDefault(); runShell(); }
          else if (e.key === 'ArrowUp') { e.preventDefault(); if (S.shIdx > 0) { S.shIdx--; shin.value = S.shHist[S.shIdx] || ''; } }
          else if (e.key === 'ArrowDown') { e.preventDefault(); if (S.shIdx < S.shHist.length) { S.shIdx++; shin.value = S.shHist[S.shIdx] || ''; } }
        };
        if (S.shFocus) { shin.focus({ preventScroll: true }); S.shFocus = false; }
      }
      const pre = el.querySelector('pre');
      if (pre && S.log.length) pre.scrollTop = pre.scrollHeight;
      const shOut = $('shout');
      if (shOut) shOut.scrollTop = shOut.scrollHeight;
      if (S.shOpen && S.shFs && A.termFS) A.termFS.apply($('shbox'), true, $('shfs'), () => { if (S) S.shFs = false; });
      hud();
    }

    function shellPanel() {
      if (!S || !S.shOpen) return '';
      const sh = curCase().shell;
      const scr = S.sh.length ? S.sh.join('\n') : 'help · ls -la · cat /var/www/app/.env.b64 | base64 -d · xxd -r /tmp/loot.hex · sudo -l · grep -r ' + esc(curCase().meta.account) + ' /var/log';
      return '<div id="shbox" class="term-fs-box" style="' + box + ';margin-top:8px">' +
        '<div class="row" style="gap:6px;align-items:center;margin-bottom:4px"><b class="small">🖥 shell</b><span class="small mute">' + esc(sh.host) + ' · real commands, seeded files</span><span class="sp" style="flex:1"></span><button class="ib" id="shfs" data-act="shfs" title="Fullscreen terminal (Esc to exit)">⛶ Fullscreen</button><button class="ib" data-act="shell">Hide</button></div>' +
        '<pre id="shout" class="term-fs-out" style="margin:0;max-height:220px;overflow:auto;background:#05070b;border:1px solid var(--line);border-radius:8px;padding:8px 10px;' + mono + ';font-size:11.5px;line-height:1.55;color:#c9f5d4;white-space:pre-wrap;user-select:text;-webkit-user-select:text;cursor:text">' + esc(scr) + '</pre>' +
        '<div class="row term-fs-prompt-row" style="gap:6px;align-items:center;margin-top:6px;background:#05070b;border:1px solid var(--line);border-radius:8px;padding:5px 9px"><span id="shprompt" style="' + mono + ';font-size:12px;color:#6cf;white-space:nowrap">' + esc(mc?.open() ? mc.prompt() : sh.prompt()) + '</span><input id="shin" autocomplete="off" spellcheck="false" style="flex:1;min-width:80px;background:transparent;border:0;color:#fff;' + mono + ';font-size:12.5px;outline:none" placeholder="type a command, or help"></div>' +
        '</div>';
    }

    function runShell() {
      const inp = $('shin');
      if (!inp || !S) return;
      const line = inp.value;
      if (!line.trim()) return;
      const sh = curCase().shell;
      const harness = mcode();
      if (harness?.accepts(line)) {
        S.sh.push((harness.open() ? harness.prompt() : sh.prompt()) + line);
        S.shHist.push(line); S.shIdx = S.shHist.length;
        harness.run(line);
        S.shFocus = true;
        draw();
        return;
      }
      S.sh.push(sh.prompt() + line);
      const out = sh.run(line);
      if (line.trim() === 'clear' || line.trim() === 'cls') S.sh = [];
      else if (out) S.sh.push(out);
      S.shHist.push(line); S.shIdx = S.shHist.length;
      S.shFocus = true;
      draw();
    }

    const lastStage = () => {
      if (S.phase === 'red' && S.mode === 'full') return false;
      if (S.ci + 1 < S.cases.length) return false;
      return S.si + 1 >= curStages().length;
    };

    /* ------------------------------------------------ answers */
    function solve(st, tries) {
      S.fb = { kind: 'ok', tries, text: st.teach };
      S.res.push({ phase: st.phase, skill: st.skill, tries });
      (st.log || []).forEach(l => { if (!S.log.some(x => x.t === l.t && x.text === l.text)) S.log.push(l); });
      draw();
    }

    function wrong(st, tries, text) {
      S.risk = Math.min(100, S.risk + (st.penalty || 14));
      S.fb = { kind: 'bad', tries, text };
      if (S.risk >= 100) S.win = false;
      draw();
    }

    function choose(i) {
      const st = curStage();
      if (!st || !st.options || S.done) return;
      if (S.fb && S.fb.kind === 'ok') return;
      const o = st.options[i];
      if (!o) return;
      const tries = (S.fb && S.fb.tries || 0) + 1;
      if (o.ok) solve(st, tries); else wrong(st, tries, o.why);
    }

    function submitInput() {
      const st = curStage(), inp = $('rain');
      if (!st || !st.input || !inp || S.done || (S.fb && S.fb.kind === 'ok')) return;
      const v = inp.value.trim();
      if (!v) return;
      const tries = (S.fb && S.fb.tries || 0) + 1;
      const answers = [].concat(st.input.answer || []);
      if (answers.some(a => RA.norm(a) === RA.norm(v))) solve(st, tries);
      else wrong(st, tries, 'Not that value. Read the output above again — the answer is in it.');
    }

    function advance() {
      S.fb = null; S.hintOpen = false; S.si++;
      if (S.si < curStages().length) return draw();
      if (S.phase === 'red' && S.mode === 'full') {
        S.phase = 'blue'; S.si = 0;
        S.log.push({ t: '--:--', text: '— shift handover: the client calls. Same estate, defensive side. —' });
        return draw();
      }
      if (S.ci + 1 < S.cases.length) {
        S.ci++; S.phase = 'red'; S.si = 0;
        S.log.push({ t: '--:--', text: '— next engagement —' });
        S.sh = []; S.shHist = []; S.shIdx = 0; S.shFocus = false;
        return draw();
      }
      finish();
    }

    /* ------------------------------------------------ debrief */
    function finish() {
      S.done = true;
      S.win = S.risk < 100 && S.res.length >= S.expected;
      if (rating && !S.rated) { S.delta = rating.update(S.win, 3, S.usedHint); S.rated = true; }
      draw();
    }

    function drawDebrief() {
      if (S && S.shFs && A.termFS) { S.shFs = false; A.termFS.exit(); }
      const pct = S.expected ? S.res.reduce((n, r) => n + (r.tries === 1 ? 1 : 0.4), 0) / S.expected : 0;
      const firsts = S.res.filter(r => r.tries === 1).length;
      const grade = pct >= 0.9 ? 'A' : pct >= 0.75 ? 'B' : pct >= 0.6 ? 'C' : pct >= 0.4 ? 'D' : 'F';
      const groups = {};
      S.res.forEach(r => { const g = groups[r.skill] || (groups[r.skill] = { n: 0, ok: 0 }); g.n++; if (r.tries === 1) g.ok++; });
      const missed = S.res.filter(r => r.tries > 1);
      const skipped = S.expected - S.res.length;
      el.innerHTML = '<div style="width:min(820px,100%);padding-bottom:16px">' +
        '<div style="' + box + ';margin-bottom:8px">' +
          '<div class="row" style="gap:6px;align-items:center"><span class="small mute">ENGAGEMENT REPORT</span><span class="sp" style="flex:1"></span>' + pill(grade, 'var(--acc)') + '</div>' +
          '<h2 style="margin:3px 0 4px">' + (S.win ? (S.mode === 'blue' ? 'Incident handled' : S.mode === 'red' ? 'Access achieved, quietly' : 'Engagement complete') : 'Operation burned') + '</h2>' +
          '<div class="small" style="line-height:1.5">' + (S.win
            ? 'You finished all ' + S.expected + ' decision points with detection risk at ' + Math.round(S.risk) + '%. ' + firsts + ' of them first time.'
            : S.risk >= 100
              ? 'Detection risk reached 100% before the objective: in a real engagement that is a phone call to the client and an early end to the test.'
              : 'The chain stopped early, so the report covers ' + S.res.length + ' of ' + S.expected + ' decision points.') + '</div>' +
          '<div style="margin-top:8px">' + bar(pct * 100, pct >= 0.6 ? '#5fbf7f' : '#e0a84a') + '<div class="small mute" style="margin-top:3px">' + Math.round(pct * 100) + '% weighted score · ' + firsts + ' first-time answers' + (skipped > 0 ? ' · ' + skipped + ' not reached' : '') + (S.shHist.length ? ' · ' + S.shHist.length + ' shell commands' : '') + (S.delta != null ? ' · rating ' + (S.delta >= 0 ? '+' : '') + S.delta : '') + '</div></div>' +
        '</div>' +
        '<div style="' + box + ';margin-bottom:8px"><b class="small">Skill assessment</b><div style="display:grid;gap:5px;margin-top:6px">' +
          Object.entries(groups).map(([k, g]) => '<div class="row" style="gap:8px;align-items:center"><span class="small" style="flex:1">' + esc(k) + '</span><span class="small mute">' + g.ok + '/' + g.n + ' first time</span><div style="width:110px">' + bar(g.n ? g.ok / g.n * 100 : 0, g.ok === g.n ? '#5fbf7f' : g.ok ? '#e0a84a' : '#e05555') + '</div></div>').join('') +
        '</div></div>' +
        (missed.length ? '<div style="' + box + ';margin-bottom:8px"><b class="small">Revisit</b><div class="small mute" style="margin-top:4px;line-height:1.6">' + missed.map(r => '• ' + esc(r.phase) + ' — needed ' + r.tries + ' attempts').join('<br>') + '</div></div>' : '') +
        (S.mode !== 'blue' ? '<div style="' + box + ';margin-bottom:8px"><b class="small">What the defenders saw</b><div class="small" style="margin-top:4px;line-height:1.6">' + S.cases.map(c => esc(c.scenario.name) + ': ' + esc(c.finding.name) + ' on port ' + c.finding.port + ', reached as <b>' + esc(c.meta.account) + '</b>' + (S.mode === 'red' && c.meta.exfil ? ', ' + esc(c.scenario.objective) + ' exported' : '')).join('<br>') + '</div></div>' : '') +
        '<div class="row" style="gap:8px;flex-wrap:wrap">' +
          '<button class="pri" data-act="again">New engagement →</button>' +
          '<button class="ib" data-act="retry">Replay these seeds</button>' +
          '<button class="ib" data-act="lobby">Case selection</button>' +
        '</div></div>';
      hud();
    }

    function draw() {
      if (!S) return drawLobby();
      if (S.done) return drawDebrief();
      drawPlay();
    }

    /* ------------------------------------------------ events */
    el.onclick = e => {
      const b = e.target.closest('button');
      if (!b) return;
      if (b.dataset.mode) { cfg.mode = b.dataset.mode; savePref(); return drawLobby(); }
      if (b.dataset.o != null) return choose(+b.dataset.o);
      switch (b.dataset.act) {
        case 'start': return begin(false);
        case 'manual': cfg.manual = !cfg.manual; savePref(); return drawLobby();
        case 'hint': S.usedHint = true; S.hintOpen = !S.hintOpen; return draw();
        case 'submit': return submitInput();
        case 'shell': S.shOpen = !S.shOpen; if (!S.shOpen && S.shFs) { S.shFs = false; if (A.termFS) A.termFS.exit(); } S.shFocus = S.shOpen; return draw();
        case 'shfs':
          if (!S || !S.shOpen) return;
          S.shFs = !S.shFs;
          if (A.termFS) A.termFS.apply($('shbox'), S.shFs, $('shfs'), () => { if (S) S.shFs = false; });
          { const shin = $('shin'); if (shin) { try { shin.focus({ preventScroll: true }); } catch (e2) { shin.focus(); } } }
          return;
        case 'cont': return advance();
        case 'burn': return finish();
        case 'abort': return drawLobby();
        case 'again': return begin(false);
        case 'retry': return begin(true);
        case 'lobby': return drawLobby();
        default: return;
      }
    };
    el.onchange = e => {
      if (e.target.id === 'ralevel') { cfg.level = e.target.value; savePref(); drawLobby(); }
    };

    drawLobby();
    return () => { mc?.close(); if (S && S.shFs && A.termFS) { S.shFs = false; A.termFS.exit(); } };
  }

  P.games.remote_access = {
    name: 'Red / Blue · Remote access',
    icon: '🎯',
    desc: 'A full simulated intrusion — scan, access, foothold, escalation, credentials, lateral movement, objective — then defend the same chain. Endless seeded estates, every decision assessed.',
    cat: 'cyber',
    mount: (el, api) => { stage = el; return mount(el, api); }
  };
})();

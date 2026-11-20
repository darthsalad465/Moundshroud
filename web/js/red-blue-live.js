// Cyber > 🕶️ Cyber games > Live fire arena.
// Pick a side and an opponent, then work the estate in real time: the bot moves on a clock,
// your trace or its intrusion moves with every command, and the terminal is the whole game.
(() => {
  const P = A.play = A.play || { games: {} };
  const L = P.logic = P.logic || {};
  const LO = typeof LiveOps !== 'undefined' ? LiveOps : null;
  if (LO) L.liveOps = LO;

  let stage = null;
  const $ = id => stage && stage.querySelector('#' + id);
  const esc = t => String(t == null ? '' : t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const mono = 'font-family:Consolas,"Cascadia Mono",monospace';
  const box = 'border:1px solid var(--line);background:var(--panel2);border-radius:10px;padding:10px 12px';
  const pill = (t, col) => '<span style="display:inline-block;margin:0 4px 4px 0;padding:2px 8px;border-radius:999px;font-size:11.5px;border:1px solid ' + (col || 'var(--line)') + ';color:' + (col || 'var(--mute)') + ';background:rgba(255,255,255,.03)">' + esc(t) + '</span>';
  const bar = (pct, col) => '<div style="height:7px;border-radius:999px;background:rgba(255,255,255,.09);overflow:hidden"><div style="height:100%;width:' + Math.max(0, Math.min(100, pct)) + '%;background:' + col + ';transition:width .25s linear"></div></div>';

  const PACES = { calm: 1500, live: 900, blitz: 550 };
  const ROLE = {
    red: { name: 'Red team', head: 'Break in', tag: 'Offence', col: '#ff7b7b', desc: 'You are the intruder. Scan, decode the leak, land a shell, escalate and exfiltrate the record while the Blue bot watches the wire and reacts to your trace.' },
    blue: { name: 'Blue team', head: 'Hold the line', tag: 'Defence', col: '#6fb4ff', desc: 'You are the SOC. The Red bot is already moving: scan, spray, escalate, pivot, stage the export. Hunt it down and contain it before the data leaves.' }
  };

  const GUIDE = [
    ['It runs on a clock', 'The engagement advances one second at a time even while you think. The bot acts on its own schedule. You can pause with the Pause button, but the clock is the pressure.'],
    ['Red team: your trace', 'Every command raises trace. At set thresholds the defender rotates credentials, patches the escalation flaw, kills your session or null-routes your address. cover, wipe and spoof are your countermeasures — they cost time.'],
    ['Red team: the estate', 'The leak is encoded, not encrypted. Decode it, ssh in, enumerate sudo, escalate, read the app config for the database password, pivot to db01 and exfil the right record. A wrong id is a failed exfiltration.'],
    ['Blue team: the intrusion bar', 'It climbs every second the attacker is unopposed. Killing a session, blocking its source, rotating a credential, patching the vector or isolating a host pushes it back. Isolation also costs business downtime.'],
    ['Blue team: hunting', 'Alerts are clues, not answers. netstat, ps aux, last and auth.log show you the real pid and source address. Trace a pid to confirm the egress, then block it — blocking a clean address is a false positive.'],
    ['Scoring', 'Clean, fast containment scores highest. False positives and downtime cost you. Ratings use the Elo scale shared with the other cyber games.']
  ];

  function mount(el, api) {
    if (!LO) {
      el.innerHTML = '<p style="padding:12px">The arena engine did not load. Check web/js/arena-rules.js.</p>';
      return () => { };
    }
    const rating = L.makeRating ? L.makeRating('lfo') : null;
    let pref = {};
    try { pref = JSON.parse(ls.get('lfo_prefs', '{}')) || {}; } catch (e) { pref = {}; }
    const cfg = {
      role: pref.role === 'blue' ? 'blue' : 'red',
      bot: LO.BOTS[pref.bot] ? pref.bot : 'warden',
      level: (typeof TerminalOps !== 'undefined' && TerminalOps.levels[pref.level]) ? pref.level : 'analyst',
      pace: PACES[pref.pace] ? pref.pace : 'live',
      guide: !!pref.guide
    };
    const savePref = () => ls.set('lfo_prefs', JSON.stringify(cfg));
    const seed = () => {
      try { return crypto.getRandomValues(new Uint32Array(1))[0] >>> 0; }
      catch (e) { return (Math.random() * 4294967295) >>> 0; }
    };
    let S = null, timer = 0, paused = false;

    const hud = () => {
      if (!api || !api.hud) return;
      api.hud('⚔ Live fire' + (rating ? '   ★ ' + rating.rating : '') + (S ? '   ' + (S.role === 'red' ? 'RED' : 'BLUE') + ' vs ' + LO.getBot(S.bot).name : ''));
    };

    /* ------------------------------------------------ lines */
    function push(k, t) { if (t !== '' && t != null) S.lines.push({ k, t }); }
    function lineHTML(l) {
      const col = l.k === 'cmd' ? '#7fd1ff' : l.k === 'dim' ? '#8496a8'
        : l.k === 'bad' ? '#ff8f8f' : l.k === 'ok' ? '#6ee7a0'
        : l.k === 'blue' ? '#8fb9ff' : l.k === 'alert' ? '#ffc46b' : '#cfe9d6';
      const pre = l.k === 'alert' ? '' : '';
      return '<span style="color:' + col + '">' + pre + String(l.t).split('\n').map(esc).join('\n') + '</span>';
    }
    function paintOut() {
      const out = $('lfoout');
      if (!out) return;
      out.innerHTML = S.lines.map(lineHTML).join('\n');
      out.scrollTop = out.scrollHeight;
    }

    /* ------------------------------------------------ lobby */
    function drawLobby() {
      S = null;
      const role = ROLE[cfg.role], bot = LO.getBot(cfg.bot);
      const levels = (typeof TerminalOps !== 'undefined') ? TerminalOps.levels : null;
      el.innerHTML = '<div style="width:min(940px,100%);padding-bottom:18px">' +
        '<div style="' + box + ';margin-bottom:10px">' +
          '<div class="small mute" style="letter-spacing:.08em">SIMULATED ADVERSARY · LIVE CLOCK · OFFLINE</div>' +
          '<h2 style="margin:2px 0 4px">⚔ Live fire arena</h2>' +
          '<p class="small" style="margin:0;line-height:1.55">A red/blue engagement against an opponent you choose. Take the offence and break into a defended estate, or take the SOC and stop a bot that is already inside. Nothing is multiple choice: the whole engagement is typed into a terminal while the clock runs and the other side reacts. Every run builds a new estate.</p>' +
        '</div>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px">' +
          ['red', 'blue'].map(k => {
            const r = ROLE[k], on = cfg.role === k;
            return '<button data-role="' + k + '" style="text-align:left;cursor:pointer;padding:11px 13px;border-radius:10px;border:1px solid ' + (on ? r.col : 'var(--line)') + ';background:' + (on ? 'rgba(255,255,255,.055)' : 'var(--panel2)') + ';color:inherit">' +
              '<div class="row" style="gap:6px;align-items:center"><b>' + r.name + ' · ' + r.head + '</b><span style="flex:1"></span>' + (on ? pill('selected', r.col) : '') + '</div>' +
              '<div class="small mute" style="margin-top:5px;line-height:1.5">' + esc(r.desc) + '</div></button>';
          }).join('') +
        '</div>' +
        '<div style="' + box + ';margin-bottom:10px">' +
          '<div class="row" style="gap:8px;align-items:center;margin-bottom:8px"><b class="small">' + (cfg.role === 'red' ? 'Choose the Blue bot defending the estate' : 'Choose the Red bot attacking the estate') + '</b><span style="flex:1"></span><span class="small mute">' + (rating ? '★ ' + rating.rating + ' · ✓ ' + rating.solved + ' engagements' : '') + '</span></div>' +
          '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:8px">' +
          LO.bots().map(b => {
            const on = b.id === cfg.bot;
            return '<button data-bot="' + b.id + '" style="text-align:left;cursor:pointer;padding:9px 11px;border-radius:10px;border:1px solid ' + (on ? 'var(--acc)' : 'var(--line)') + ';background:' + (on ? 'rgba(90,160,255,.09)' : 'var(--panel2)') + ';color:inherit">' +
              '<div class="row" style="gap:7px;align-items:center"><span style="font-size:17px">' + b.glyph + '</span><b>' + esc(b.name) + '</b><span style="flex:1"></span><span class="small mute">' + '●'.repeat(b.rank) + '○'.repeat(6 - b.rank) + '</span></div>' +
              '<div class="small mute" style="margin-top:3px">' + esc(b.style) + ' · ' + esc(b.tag) + '</div>' +
              '</button>';
          }).join('') + '</div>' +
          '<div class="small" style="margin-top:8px;line-height:1.5"><b>' + esc(bot.name) + '</b> <span class="mute">' + esc(bot.note) + '</span></div>' +
        '</div>' +
        '<div class="row" style="gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:10px">' +
          (levels ? '<span class="small mute">Estate</span><select id="lfolevel" style="font-size:12px">' +
            Object.entries(levels).map(([k, v]) => '<option value="' + k + '"' + (k === cfg.level ? ' selected' : '') + '>' + esc(v.name) + '</option>').join('') + '</select>' : '') +
          '<span class="small mute">Clock</span><select id="lfopace" style="font-size:12px">' +
            Object.entries({ calm: 'Calm · 1.5s', live: 'Live · 0.9s', blitz: 'Blitz · 0.55s' }).map(([k, v]) => '<option value="' + k + '"' + (k === cfg.pace ? ' selected' : '') + '>' + v + '</option>').join('') + '</select>' +
          '<span style="flex:1"></span>' +
          '<button class="pri" data-act="start">Deploy as ' + (cfg.role === 'red' ? 'Red' : 'Blue') + ' →</button>' +
        '</div>' +
        '<div style="' + box + ';margin-bottom:8px">' +
          '<div class="row" style="gap:8px;align-items:center"><b class="small">How the arena works</b><span style="flex:1"></span><button class="ib" data-act="guide">' + (cfg.guide ? 'Hide' : 'Show') + ' brief</button></div>' +
          (cfg.guide ? '<div class="small" style="margin-top:8px;line-height:1.6">' + GUIDE.map(x => '<div style="margin-bottom:7px"><b>' + esc(x[0]) + '</b><div class="mute" style="margin-top:2px">' + esc(x[1]) + '</div></div>').join('') +
            '<div style="margin-top:6px;background:rgba(0,0,0,.3);border:1px solid var(--line);border-radius:8px;padding:8px 10px;' + mono + ';font-size:11.5px;line-height:1.6;white-space:pre-wrap">red  › nmap -sV -Pn &lt;ip&gt; · cat ~/loot/*.txt | base64 -d · ssh user@ip\n       sudo -l · sudo find . -exec /bin/sh -p \\; -quit\n       cat /var/www/app/.env.b64 | base64 -d | grep DB_PASSWORD\n       ssh svc_*@db01.&lt;domain&gt; · exfil &lt;record id&gt; · cover · wipe · spoof\n\nblue › alerts · netstat · ps aux · last · grep -c "Failed password" auth.log\n       kill &lt;pid&gt; · block &lt;ip&gt; · rotate &lt;user&gt; · patch sudo\n       isolate db01 · restore db01 · trace &lt;pid&gt; · report</div></div>' : '') +
        '</div>' +
        '<div class="small mute">Scores come from trace, time and failed attempts (red) or containment speed, downtime and false positives (blue). Each bot reacts on its own thresholds, so the same estate plays very differently.</div>' +
        '</div>';
      hud();
    }

    /* ------------------------------------------------ play */
    const PACE_LABEL = { calm: 'calm', live: 'live', blitz: 'blitz' };
    function drawPlay() {
      const b = LO.getBot(S.bot), r = ROLE[S.role];
      const blue = S.role === 'blue';
      el.innerHTML = '<div style="width:min(1060px,100%);display:flex;flex-direction:column;gap:8px;padding-bottom:16px">' +
        '<div class="row" style="gap:6px;flex-wrap:wrap;align-items:center">' +
          '<b>⚔ Live fire</b>' + pill(r.name + ' · ' + r.head, r.col) + pill(b.glyph + ' ' + b.name) + pill(S.m.org.name) +
          '<span style="flex:1"></span>' +
          '<span id="lfoclock" style="' + mono + ';font-size:12px" class="mute">00:00</span>' +
          '<button class="ib" id="lfopause">Pause</button>' +
          '<button class="ib" data-act="leave">Leave</button>' +
        '</div>' +
        '<div style="display:grid;grid-template-columns:1fr 240px;gap:8px;align-items:start" id="lfogrid">' +
          '<div style="display:flex;flex-direction:column;gap:8px;min-width:0">' +
            '<div style="' + box + ';padding:8px 10px">' +
              '<div class="row" style="gap:8px;align-items:center;margin-bottom:5px">' +
                '<span class="small mute" id="lfobarLabel">' + (blue ? 'Intrusion' : 'SOC trace') + '</span>' +
                '<span style="flex:1"></span>' +
                '<span class="small" id="lfobarVal" style="' + mono + '">0%</span>' +
              '</div>' +
              '<div id="lfobar">' + bar(0, blue ? '#ff9b6b' : '#ff7b7b') + '</div>' +
              '<div class="row" style="gap:6px;flex-wrap:wrap;margin-top:7px;align-items:center" id="lfostatus"></div>' +
            '</div>' +
            '<div id="lfobox" class="term-fs-box" style="background:#05070b;border:1px solid var(--line);border-radius:10px;padding:10px 12px">' +
              '<div class="row" style="gap:6px;align-items:center;margin-bottom:6px"><b class="small">⚔ ' + esc(S.m.org.name) + '</b><span class="small mute" id="lfofsmeta" style="' + mono + ';font-size:11.5px"></span><span style="flex:1"></span><button class="ib" id="lfofs" title="Fullscreen terminal (Esc to exit)">⛶ Fullscreen</button></div>' +
              '<pre id="lfoout" class="term-fs-out" style="margin:0;height:min(42vh,340px);overflow:auto;' + mono + ';font-size:12.5px;line-height:1.55;white-space:pre-wrap;word-break:break-word;user-select:text;-webkit-user-select:text;cursor:text"></pre>' +
              '<div class="row term-fs-prompt-row" style="gap:6px;align-items:center;margin-top:8px;border-top:1px solid rgba(255,255,255,.06);padding-top:8px">' +
                '<span id="lfoprompt" style="' + mono + ';font-size:12.5px;color:#6ee7a0;white-space:nowrap">' + esc(S.eng.prompt()) + '</span>' +
                '<input id="lfoin" autocomplete="off" autocapitalize="off" spellcheck="false" style="flex:1;min-width:80px;background:transparent;border:0;color:#fff;' + mono + ';font-size:12.5px;outline:none" placeholder="' + (blue ? 'alerts · ps aux · kill <pid> · block <ip>' : 'nmap -sV <ip> · help for the list') + '">' +
              '</div>' +
            '</div>' +
            '<div class="row" style="gap:6px;flex-wrap:wrap">' +
              (blue
                ? '<button class="ib" data-act="cmd" data-cmd="alerts">Alerts</button><button class="ib" data-act="cmd" data-cmd="netstat">netstat</button><button class="ib" data-act="cmd" data-cmd="ps aux">ps aux</button><button class="ib" data-act="cmd" data-cmd="brief">Brief</button>'
                : '<button class="ib" data-act="cmd" data-cmd="heat">Trace</button><button class="ib" data-act="cmd" data-cmd="brief">Brief</button><button class="ib" data-act="cmd" data-cmd="cover">cover</button><button class="ib" data-act="cmd" data-cmd="spoof">spoof</button>') +
              '<span style="flex:1"></span>' +
              '<button class="ib" id="lfohint">Hint</button>' +
            '</div>' +
          '</div>' +
          '<div style="' + box + ';padding:8px 10px;min-height:120px">' +
            '<div class="row" style="gap:6px;align-items:center;margin-bottom:6px"><b class="small">' + (blue ? 'Alert feed' : 'SOC feed') + '</b><span style="flex:1"></span><span class="small mute" id="lfofeedn"></span></div>' +
            '<div id="lfofeed" class="small" style="max-height:min(58vh,520px);overflow:auto;line-height:1.5"></div>' +
          '</div>' +
        '</div>' +
        '<div class="small mute" style="' + mono + '">' + (blue
          ? 'alerts · alert 3 · netstat · ps aux · last · grep -c "Failed password" auth.log · trace &lt;pid&gt; · kill &lt;pid&gt; · block &lt;ip&gt; · rotate &lt;user&gt; · patch sudo · isolate db01 · report'
          : 'help · nmap -sV &lt;ip&gt; · cat &lt;leak&gt; | base64 -d · ssh user@host · sudo -l · cat env | xxd -r · exfil &lt;id&gt; · cover · wipe · spoof · sleep 5') + '</div>' +
        '<div id="lfoend"></div>' +
        '</div>';

      paintOut();
      paintHud();
      paintFeed();
      const inp = $('lfoin');
      if (inp) {
        inp.onkeydown = e => {
          if (e.key === 'Enter') { e.preventDefault(); exec(inp.value); }
          else if (e.key === 'ArrowUp') { e.preventDefault(); if (S.hi > 0) { S.hi--; inp.value = S.hist[S.hi] || ''; } }
          else if (e.key === 'ArrowDown') { e.preventDefault(); if (S.hi < S.hist.length) { S.hi++; inp.value = S.hist[S.hi] || ''; } }
        };
        try { inp.focus({ preventScroll: true }); } catch (e) { inp.focus(); }
      }
      setTimeout(() => { const i2 = $('lfoin'); if (i2 && document.activeElement !== i2) { try { i2.focus({ preventScroll: true }); } catch (e) { } } }, 0);
      hud();
    }

    function paintHud() {
      if (!S) return;
      const b = LO.getBot(S.bot), blue = S.role === 'blue';
      const ps = S.eng.publicState();
      const pct = blue ? ps.intrusion : ps.heat;
      const barEl = $('lfobar');
      if (barEl) barEl.innerHTML = bar(pct, blue ? (pct > 78 ? '#ff6b6b' : pct > 50 ? '#ffb35c' : '#ff9b6b') : (pct > 78 ? '#ff6b6b' : pct > 55 ? '#ffb35c' : '#ff7b7b'));
      const val = $('lfobarVal');
      if (val) val.textContent = Math.round(pct) + '%';
      const clk = $('lfoclock');
      if (clk) clk.textContent = 'T+' + String(Math.floor(ps.tick / 60)).padStart(2, '0') + ':' + String(ps.tick % 60).padStart(2, '0') + ' · ' + PACE_LABEL[S.pace];
      const fsm = $('lfofsmeta');
      if (fsm) fsm.textContent = 'T+' + String(Math.floor(ps.tick / 60)).padStart(2, '0') + ':' + String(ps.tick % 60).padStart(2, '0') + ' · ' + (blue ? 'Intrusion ' : 'Trace ') + Math.round(pct) + '%';
      const stEl = $('lfostatus');
      if (stEl) {
        stEl.innerHTML = blue
          ? [
            pill('stage ' + ps.stage, ps.stage === 'exfil' ? '#ff7b7b' : 'var(--line)'),
            pill('sessions ' + ps.sessions),
            pill('evictions ' + ps.kills),
            pill('downtime ' + ps.downtime + 's', ps.downtime > 20 ? '#ffb35c' : 'var(--line)'),
            pill('false positives ' + ps.falsePos, ps.falsePos ? '#ffb35c' : 'var(--line)'),
            ps.patched.sudo || ps.patched.docker || ps.patched.suid ? pill('patched') : '',
            ps.isolated.web || ps.isolated.db ? pill('isolated', '#8fb9ff') : '',
            ps.intrusion < 30 ? pill('contained · report to close', '#6ee7a0') : ''
          ].join('')
          : [
            pill('host ' + (ps.host === 'ops' ? 'workstation' : ps.host === 'web' ? 'web01' : 'db01')),
            ps.root ? pill('root', '#6ee7a0') : '',
            ps.blocked ? pill('source blocked', '#ff8f8f') : '',
            ps.status.rotate ? pill('creds rotated', '#ffb35c') : '',
            ps.status.patch ? pill('flaw patched', '#ffb35c') : '',
            pill('failed ' + ps.fails, ps.fails ? '#ffb35c' : 'var(--line)')
          ].join('');
      }
      const pr = $('lfoprompt');
      if (pr) pr.textContent = S.eng.prompt();
      const hb = $('lfohint');
      if (hb) hb.textContent = 'Hint';
      const end = $('lfoend');
      if (end && S.done && !end.dataset.shown) {
        end.dataset.shown = '1';
        end.innerHTML = '<div style="' + box + ';margin-top:2px">' +
          '<div class="row" style="gap:8px;align-items:center;flex-wrap:wrap">' +
            pill(S.win ? '✓ ' + (blue ? 'Contained' : 'Exfiltrated') : '✗ ' + (blue ? 'Data loss' : 'Locked out'), S.win ? '#6ee7a0' : '#ff8f8f') +
            pill('Grade ' + S.grade, 'var(--acc)') + pill(S.score + '/100') + pill('vs ' + b.name) +
            (S.delta != null ? pill((S.delta >= 0 ? '+' : '') + S.delta + ' rating') : '') +
            '<span style="flex:1"></span><button class="pri" data-act="next">New engagement →</button><button class="ib" data-act="leave">Arena</button></div>' +
          '<div class="small mute" style="margin-top:4px">' + (S.win
            ? (blue ? 'Containment worked. Replay the same bot and try to be faster with less downtime.' : 'Clean intrusion. Replay to beat your own time, or move up a bot.')
            : (blue ? 'The data left the estate. Watch the escalation stage next time — patching the vector beats chasing the shell.' : 'You were evicted. cover earlier, wipe before the first sudo, and exfil before the trace peaks.')) + '</div>' +
          '</div>';
      }
    }

    function paintFeed() {
      const el2 = $('lfofeed');
      if (!el2 || !S) return;
      const items = S.feed.slice(-30).reverse();
      el2.innerHTML = items.map(f => {
        const col = f.k === 'bad' ? '#ff8f8f' : f.k === 'ok' ? '#6ee7a0' : f.k === 'blue' ? '#8fb9ff' : f.k === 'alert' ? '#ffc46b' : '#9fb0c0';
        return '<div style="margin-bottom:6px;color:' + col + ';white-space:pre-wrap;word-break:break-word"><span class="mute" style="font-size:10.5px">t+' + f.tick + 's </span>' + esc(f.t) + '</div>';
      }).join('') || '<div class="mute">quiet so far…</div>';
      const n = $('lfofeedn');
      if (n) n.textContent = S.feed.length ? S.feed.length + ' events' : '';
    }

    function addEvents(events) {
      if (!events || !events.length) return;
      for (const e of events) {
        push(e.k === 'bad' ? 'bad' : e.k === 'ok' ? 'ok' : e.k === 'blue' ? 'blue' : e.k === 'alert' ? 'alert' : 'out', e.t);
        S.feed.push(e);
      }
      paintFeed();
    }

    function exec(line) {
      if (!S || S.done) return;
      const cmd = String(line == null ? '' : line).trim();
      if (!cmd) return;
      if (/^clear$/i.test(cmd)) { S.lines = []; S.hist.push(cmd); S.hi = S.hist.length; paintOut(); return; }
      push('cmd', S.eng.prompt() + cmd);
      let res;
      try { res = S.eng.run(cmd); } catch (e) { res = { out: 'shell error: ' + (e && e.message || e), events: [] }; }
      push('out', res.out || '');
      S.hist.push(cmd); S.hi = S.hist.length;
      addEvents(res.events);
      if (S.lines.length > 700) S.lines = S.lines.slice(-700);
      paintOut();
      paintHud();
      checkDone();
      const inp = $('lfoin');
      if (inp) { inp.value = ''; try { inp.focus({ preventScroll: true }); } catch (e) { } }
    }

    function checkDone() {
      const ps = S.eng.publicState();
      if (!ps.over || S.done) return;
      S.done = true;
      S.win = !!ps.win;
      S.score = S.eng.score();
      S.grade = S.eng.grade();
      if (rating) S.delta = rating.update(S.win, LO.getBot(S.bot).rank, S.eng.state.hints > 0);
      if (timer) { clearInterval(timer); timer = 0; }
      paintHud();
      hud();
    }

    function tickOnce() {
      if (!S || S.done || paused) return;
      const events = S.eng.tick(1);
      if (events.length) { addEvents(events); paintHud(); }
      else {
        const v = $('lfobarVal');
        const ps = S.eng.publicState();
        if (v) v.textContent = (S.role === 'blue' ? ps.intrusion : ps.heat) + '%';
        const barEl = $('lfobar');
        const pct = S.role === 'blue' ? ps.intrusion : ps.heat;
        if (barEl) barEl.innerHTML = bar(pct, S.role === 'blue' ? (pct > 78 ? '#ff6b6b' : pct > 50 ? '#ffb35c' : '#ff9b6b') : (pct > 78 ? '#ff6b6b' : pct > 55 ? '#ffb35c' : '#ff7b7b'));
        const clk = $('lfoclock');
        if (clk) clk.textContent = 'T+' + String(Math.floor(ps.tick / 60)).padStart(2, '0') + ':' + String(ps.tick % 60).padStart(2, '0') + ' · ' + PACE_LABEL[S.pace];
        const fsm = $('lfofsmeta');
        if (fsm) fsm.textContent = 'T+' + String(Math.floor(ps.tick / 60)).padStart(2, '0') + ':' + String(ps.tick % 60).padStart(2, '0') + ' · ' + (S.role === 'blue' ? 'Intrusion ' : 'Trace ') + Math.round(pct) + '%';
      }
      checkDone();
    }

    function begin() {
      const eng = LO.begin({ seed: seed(), bot: cfg.bot, role: cfg.role, level: cfg.level });
      if (!eng) { A.toast('The arena engine is not available.', 3000); return; }
      const m = eng.mission;
      S = {
        eng, role: cfg.role, bot: cfg.bot, pace: cfg.pace, m,
        lines: [], feed: eng.feed ? [] : [], hist: [], hi: 0,
        done: false, win: false, score: 0, grade: 'D', delta: null
      };
      push('dim', 'Live fire · ' + (cfg.role === 'red' ? 'red team' : 'blue team') + ' · opponent ' + LO.getBot(cfg.bot).name + ' · ' + LO.getBot(cfg.bot).style);
      push('dim', (typeof TerminalOps !== 'undefined' ? TerminalOps.levels[cfg.level].name : cfg.level) + ' estate · ' + m.org.name + ' · ' + m.targetIp + ' · clock ' + PACE_LABEL[cfg.pace]);
      push('out', cfg.role === 'red' ? m.briefText : [
        'INCIDENT   ' + m.org.name + ' — suspected intrusion, ' + m.asset,
        'ESTATE     web01.' + m.domain + ' (10.40.12.20) · db01.' + m.domain + ' (10.40.8.11)',
        'ADVERSARY  ' + LO.getBot(cfg.bot).name + ' — ' + LO.getBot(cfg.bot).tag,
        'SCOPE      contain the intrusion and protect ' + m.asset + '. Downtime counts against you.'
      ].join('\n'));
      push('dim', cfg.role === 'red' ? "type 'help' for commands · 'heat' for your trace · 'cover' when it climbs" : "type 'help' for commands · 'alerts' to triage · 'ps aux' to hunt");
      paused = false;
      drawPlay();
      if (timer) clearInterval(timer);
      timer = setInterval(tickOnce, PACES[cfg.pace]);
      hud();
    }

    function stop() { if (timer) { clearInterval(timer); timer = 0; } if (A.termFS) A.termFS.exit(); }

    function draw() { if (S) drawPlay(); else drawLobby(); }

    el.onclick = e => {
      const b = e.target.closest('button');
      if (!b) {
        /* never steal focus (or a text selection) from the scrollback: clicking there is how you copy output */
        if (e.target.closest('#lfoout')) return;
        const sel = window.getSelection ? window.getSelection() : null;
        const hasSel = !!(sel && sel.rangeCount && !sel.isCollapsed);
        if (e.target.closest('#lfoprompt') && !hasSel) { const i = $('lfoin'); if (i) { try { i.focus({ preventScroll: true }); } catch (e2) { i.focus(); } } }
        return;
      }
      if (b.dataset.role) { cfg.role = b.dataset.role; savePref(); return drawLobby(); }
      if (b.dataset.bot) { cfg.bot = b.dataset.bot; savePref(); return drawLobby(); }
      switch (b.dataset.act) {
        case 'start': return begin();
        case 'next': return begin();
        case 'leave': stop(); return drawLobby();
        case 'guide': cfg.guide = !cfg.guide; savePref(); return drawLobby();
        case 'cmd': return exec(b.dataset.cmd || 'help');
        default:
          if (b.id === 'lfopause') {
            paused = !paused;
            b.textContent = paused ? 'Resume' : 'Pause';
            if (paused) push('dim', '· clock paused');
            return;
          }
          if (b.id === 'lfohint') { if (S && !S.done) { push('cmd', S.eng.prompt() + 'hint'); push('out', S.eng.hint()); paintOut(); } return; }
          if (b.id === 'lfofs') { if (A.termFS) A.termFS.toggle($('lfobox'), b); const i = $('lfoin'); if (i) { try { i.focus({ preventScroll: true }); } catch (e2) { i.focus(); } } return; }
          return;
      }
    };
    const sel = el.querySelector('#lfolevel');
    if (sel) sel.onchange = () => { cfg.level = sel.value; savePref(); };
    const pace = el.querySelector('#lfopace');
    if (pace) pace.onchange = () => { cfg.pace = pace.value; savePref(); };

    el.onchange = e => {
      if (e.target.id === 'lfolevel') { cfg.level = e.target.value; savePref(); }
      if (e.target.id === 'lfopace') { cfg.pace = e.target.value; savePref(); }
    };

    drawLobby();
    return stop;
  }

  P.games.live_fire = {
    name: 'Live fire · red vs blue arena',
    icon: '⚔️',
    desc: 'Play a real-time red/blue engagement against a bot you pick: break into a defended estate, or run the SOC against a live intruder. Trace, credential rotation, session kills, false positives, containment — all in a terminal.',
    cat: 'cyber',
    mount: (el, api) => { stage = el; return mount(el, api); }
  };
})();

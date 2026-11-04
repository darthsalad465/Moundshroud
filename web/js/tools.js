// Tools tab: System and the file Converter. The other tools that started here now have their own tabs (Office menu:
// Documents, Office files, Calculator, Scanner, Meeting notes, Reminders & timers, Clipboard; Cyber: Passwords; Games:
// Puzzle maker; Languages: Translate; Prepare: Prompts). Their code stays here and is shown there through A.tools.show().
(() => {
  const root = $('p-tools');
  let sub = 'sys', chefLoaded = false;
  root.innerHTML = '<div class="row" style="padding:8px 12px;gap:6px;border-bottom:1px solid var(--line);flex-wrap:wrap" id="tsub"></div><div id="tbody" style="flex:1;min-height:0;display:flex;flex-direction:column"></div>';
  const SUBS = [['sys', 'System'], ['conv', '🔄 Converter'], ['agent', '🤖 Agent']];
  /* a tool is still running only while the page it was opened in is the one on screen */
  const live = b => !!(b && b.isConnected && b.closest('.panel.on'));
  function tabs() { $('tsub').innerHTML = SUBS.filter(s => s[0] !== 'chef' || A.caps.chef).map(s => '<button class="ib' + (sub === s[0] ? ' on' : '') + '" data-s="' + s[0] + '">' + s[1] + '</button>').join(''); }
  $('tsub').onclick = e => { const b = e.target.closest('[data-s]'); if (b) go(b.dataset.s); };
  let tok = 0;
  const RENDER = () => ({ docs: (x, my) => A.docs.render(x, my), office: x => A.officeEdit.render(x), sys, calc, rem, trans, clip, prm, conv: x => A.converter.render(x), agent: x => A.agent.render(x), scan: x => A.scanner.render(x), meet: x => A.meetings.render(x), vault: x => A.vault.render(x), puzz: x => A.puzzlemaker.render(x), chef });
  function go(s) { if (!SUBS.some(x => x[0] === s)) s = 'sys'; sub = s; tabs(); const b = $('tbody'); if (b._cleanup) { try { b._cleanup(); } catch (e) { } b._cleanup = null; } b.innerHTML = ''; ({ docs: (x, my) => A.docs.render(x, my), office: x => A.officeEdit.render(x), sys, calc, rem, trans, clip, prm, cyber: x => A.cyber.render(x), codes: x => A.cbLab.render(x), course: x => A.cybercourse.render(x), conv: x => A.converter.render(x), scan: x => A.scanner.render(x), meet: x => A.meetings.render(x), vault: x => A.vault.render(x), puzz: x => A.puzzlemaker.render(x), journal: x => A.journal.render(x), storage: x => A.storage.render(x), agent: x => A.agent.render(x), chef })[s](b, ++tok); }

  /* ---- system dashboard ---- */
  function sys(b, my) {
    b.innerHTML = '<div class="scroll pad" style="flex:1"><h2>System</h2><div class="mute small" id="sysnote">Live view of this PC. Updates every 2 seconds while this page is open.</div><div class="rings" id="srings" style="margin:12px 0"></div><div id="sdet"></div></div>';
    const ring = (label, p, text, c) => '<div class="card ringc"><div class="ring" style="--p:' + Math.max(0, Math.min(100, p)) + ';--c:' + c + '"><span>' + text + '</span></div><div class="small mute">' + label + '</div></div>';
    const col = p => p > 85 ? 'var(--bad)' : p > 65 ? 'var(--warn)' : 'var(--ok)';
    const upd = async () => {
      if (my !== tok || !$('srings')) return; let s; try { s = await A.api('/api/sys'); } catch (e) { return; } if (my !== tok || !$('srings')) return;
      const rp = Math.round(s.ram.usedGB / s.ram.totalGB * 100), dp = s.disk ? Math.round((1 - s.disk.freeGB / s.disk.totalGB) * 100) : 0;
      $('srings').innerHTML = ring('Processor', s.cpu, s.cpu + '%', col(s.cpu)) + ring('Memory', rp, rp + '%', col(rp)) + (s.disk ? ring('Disk C:', dp, s.disk.freeGB + ' GB<br>free'.replace('<br>', ' '), dp > 90 ? 'var(--bad)' : dp > 85 ? 'var(--warn)' : 'var(--ok)') : '') + (s.battery ? ring('Battery' + (s.battery.charging ? ' (charging)' : ''), s.battery.pct, s.battery.pct + '%', s.battery.pct < 20 ? 'var(--bad)' : 'var(--ok)') : '');
      const h = s.health;
      $('sdet').innerHTML = '<div class="card"><b>Right now</b><div class="small mute" style="margin-top:4px">' + esc(s.cpuName || '') + '<br>Memory ' + s.ram.usedGB + ' of ' + s.ram.totalGB + ' GB used &middot; PC on for ' + s.uptimeH + ' h<br>AI engine: <span class="' + (s.ollama ? 'ok' : 'mute') + '">' + (s.ollama ? 'running' : 'asleep (starts when needed)') + '</span> &middot; Moundshroud has been open ' + s.uptimeApp + ' min</div></div>' +
        (s.procs && s.procs.length ? '<div class="card"><b>Using the most memory</b>' + s.procs.map(p => '<div class="row small" style="padding:3px 0"><span style="flex:1">' + esc(p.name) + '</span><span class="mute">' + p.mb + ' MB</span></div>').join('') + '</div>' : '') +
        (h ? '<div class="card"><b>Latest health check</b> <span class="mute small">' + esc(h.date) + '</span><div style="margin-top:4px"><span class="' + (/attention|warn|issue/i.test(h.verdict) ? 'warn' : 'ok') + '">' + esc(h.verdict) + '</span></div>' + (h.issues || []).map(x => '<div class="small mute">&bull; ' + esc(x) + '</div>').join('') + '</div>' : '');
    };
    upd(); const t = setInterval(() => { if (my !== tok || !live(b)) return clearInterval(t); upd(); }, 2000);
  }
  /* ---- translate (the local model does the work) ---- */
  const LANGS = ['English', 'Spanish', 'French', 'German', 'Italian', 'Portuguese', 'Dutch', 'Russian', 'Ukrainian', 'Polish', 'Turkish', 'Arabic', 'Hebrew', 'Hindi', 'Bengali', 'Urdu', 'Chinese (Simplified)', 'Chinese (Traditional)', 'Japanese', 'Korean', 'Vietnamese', 'Thai', 'Indonesian', 'Swahili', 'Greek', 'Swedish', 'Norwegian', 'Danish', 'Finnish', 'Czech'];
  function trans(b, my) {
    const opts = (sel) => LANGS.map(l => '<option' + (l === sel ? ' selected' : '') + '>' + l + '</option>').join('');
    b.innerHTML = '<div class="scroll pad" style="flex:1"><h2>Translate</h2><div class="mute small">Private translation by your local AI model. Quality is best for common languages; double-check anything important.</div>' +
      '<div class="row" style="margin:10px 0"><select id="tfrom"><option>Detect language</option>' + opts('') + '</select><button class="ib" id="tswap" title="Swap">&#8644;</button><select id="tto">' + opts(ls.get('tlang', 'Spanish')) + '</select></div>' +
      '<textarea id="tin" rows="5" placeholder="Type or paste text..."></textarea><div class="row" style="margin:8px 0"><button class="pri" id="tgo">Translate</button><span class="small mute" id="tst"></span></div>' +
      '<div class="card" id="tout" style="min-height:80px;white-space:pre-wrap"></div><div class="row"><button class="ib" id="tcp">Copy</button><button class="ib" id="tls">Listen</button></div></div>';
    $('tto').onchange = () => ls.set('tlang', $('tto').value);
    $('tswap').onclick = () => { const f = $('tfrom').value === 'Detect language' ? 'English' : $('tfrom').value, o = $('tout').textContent; $('tfrom').value = $('tto').value; $('tto').value = f; if (o.trim()) { $('tin').value = o; $('tout').textContent = ''; } };
    $('tcp').onclick = () => A.copy($('tout').textContent); $('tls').onclick = function () { A.speech.speak($('tout').textContent, this); };
    const go = async () => {
      const text = $('tin').value.trim(); if (!text) return; const to = $('tto').value, from = $('tfrom').value; $('tst').textContent = 'translating...'; $('tgo').disabled = true; $('tout').textContent = '';
      const prompt = 'Translate the text below ' + (from === 'Detect language' ? '' : 'from ' + from + ' ') + 'into ' + to + '. Reply with ONLY the translation, no notes, no quotes.\n\n' + text.slice(0, 6000);
      try {
        const r = await fetch('/api/chat', { method: 'POST', body: JSON.stringify({ model: $('model').value, stream: true, think: false, keep_alive: '3m', messages: [{ role: 'user', content: prompt }] }) });
        const rd = r.body.getReader(), dec = new TextDecoder(); let buf = '';
        for (;;) { const { value, done } = await rd.read(); if (done) break; buf += dec.decode(value, { stream: true }); let i; while ((i = buf.indexOf('\n')) >= 0) { const ln = buf.slice(0, i).trim(); buf = buf.slice(i + 1); if (!ln) continue; try { const j = JSON.parse(ln); if (j.message && j.message.content && $('tout')) $('tout').textContent += j.message.content; } catch (e) {} } }
      } catch (e) { A.toast('The AI engine did not answer'); }
      if ($('tst')) { $('tst').textContent = ''; $('tgo').disabled = false; }
    };
    $('tgo').onclick = go; $('tin').onkeydown = e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) go(); };
  }

  /* ---- clipboard history (opt-in; kept only on this PC) ---- */
  async function clip(b, my) {
    const draw = async () => {
      const r = await A.api('/api/clip'); if (my !== tok || !$('clist')) return; const q = ($('cq').value || '').toLowerCase();
      $('cstate').innerHTML = r.on ? '<span class="ok">ON</span> - remembering text you copy (last 100)' : '<span class="mute">OFF</span> - nothing is being remembered'; $('ctog').textContent = r.on ? 'Turn off' : 'Turn on';
      const items = (r.items || []).filter(x => !q || x.text.toLowerCase().includes(q));
      $('clist').innerHTML = items.length ? items.map(x => '<div class="card" style="padding:8px 12px"><div style="white-space:pre-wrap;max-height:4.8em;overflow:hidden;overflow-wrap:anywhere">' + esc(x.text.slice(0, 400)) + '</div><div class="row small mute" style="margin-top:6px"><span style="flex:1">' + esc(A.fmtAgo(x.at)) + ' &middot; ' + x.text.length + ' chars</span><span class="ib" data-a="copy" data-id="' + x.id + '" style="cursor:pointer">Copy</span><span class="ib" data-a="ask" data-id="' + x.id + '" style="cursor:pointer">Ask AI</span><span class="ib dang" data-a="del" data-id="' + x.id + '" style="cursor:pointer">Delete</span></div></div>').join('') : '<div class="mute small">' + (r.on ? 'Nothing yet - copy some text.' : 'Turn it on to start.') + '</div>';
      $('clist').onclick = e => {
        const a = e.target.closest('[data-a]'); if (!a) return; const it = (r.items || []).find(x => x.id === a.dataset.id); if (!it) return;
        if (a.dataset.a === 'copy') A.copy(it.text); else if (a.dataset.a === 'del') A.api('/api/clip/delete', { id: it.id }).then(draw);
        else { const p = A.pop(a, ['Summarize', 'Fix grammar', 'Explain', 'Reply to this', 'Translate to English'].map(x => '<div class="hit"><b>' + x + '</b></div>').join('')); p.onclick = ev => { const h = ev.target.closest('.hit'); if (!h) return; A.closePop(); const P = { Summarize: 'Summarize this:\n\n', 'Fix grammar': 'Fix the spelling and grammar. Reply with only the corrected text:\n\n', Explain: 'Explain this clearly:\n\n', 'Reply to this': 'Write a friendly, natural reply to this:\n\n', 'Translate to English': 'Translate this into English:\n\n' }; A.chat.ask(P[h.textContent] + it.text, { noLocal: true, sources: [] }); }; a.dataset.pop = '1'; }
      };
    };
    b.innerHTML = '<div class="scroll pad" style="flex:1"><h2>Clipboard history</h2><div class="mute small">Remembers the text you copy so you can find it again. It is <b>off by default</b>, stays on this PC, skips things that look like passwords or card numbers, and ignores password managers that ask not to be recorded. Hotkey: <kbd>Ctrl+Alt+C</kbd>.</div>' +
      '<div class="row" style="margin:10px 0"><span id="cstate" style="flex:1"></span><button class="ib" id="ctog">Turn on</button><button class="ib dang" id="cclr">Clear all</button></div><input id="cq" type="text" placeholder="Search what you copied..." style="margin-bottom:8px"><div id="clist"></div></div>';
    $('ctog').onclick = async () => { const r = await A.api('/api/clip'); await A.api('/api/clip/toggle', { on: !r.on }); draw(); };
    $('cclr').onclick = async () => { if (!confirm('Delete the whole clipboard history?')) return; await A.api('/api/clip/clear', {}); draw(); };
    $('cq').oninput = draw; draw(); const t = setInterval(() => { if (my !== tok || !live(b)) return clearInterval(t); if (document.activeElement !== $('cq')) draw(); }, 4000);
  }
  /* ---- calculator ---- */
  function calc(b) {
    if (A.calcUI) return A.calcUI(b);
    b.innerHTML = '<div class="scroll pad" style="flex:1"><h2>Quick calculator</h2><div class="mute small">Type anything. It answers instantly, with no AI and no waiting.</div>' +
      '<input id="cin" type="text" placeholder="e.g.  (12.5 + 7) * 3     18% of 240     5 miles to km     3pm New York to London" style="margin:10px 0;font-size:16px"><div id="cout" class="card" style="font-size:22px;min-height:54px"></div>' +
      '<div class="chips" id="cex"></div><h3>History</h3><div id="chist" class="small mute"></div></div>';
    const ex = ['2^10', '15% tip on 84.50', '72 f to c', '10 km to miles', '2 cups to ml', '9am Tokyo to New York', 'days until december 25', 'sqrt(144)+5', '8 lb to kg', 'time in Sydney'];
    $('cex').innerHTML = ex.map(x => '<span class="chip">' + esc(x) + '</span>').join('');
    $('cex').onclick = e => { const c = e.target.closest('.chip'); if (c) { $('cin').value = c.textContent; upd(); } };
    const hist = JSON.parse(ls.get('chist', '[]')); const drawH = () => { $('chist').innerHTML = hist.length ? hist.map(h => '<div>' + esc(h) + '</div>').join('') : 'Nothing yet.'; }; drawH();
    function upd() { const c = A.calc.try($('cin').value); $('cout').innerHTML = c ? esc(c.label) + ' <span class="ib" id="ccp" style="cursor:pointer;font-size:12px">Copy</span>' : '<span class="mute" style="font-size:14px">' + ($('cin').value ? 'Not something I can calculate - try the Chat tab.' : 'Answer shows here.') + '</span>'; if (c) $('ccp').onclick = () => A.copy(c.copy); return c; }
    $('cin').oninput = upd;
    $('cin').onkeydown = e => { if (e.key === 'Enter') { const c = upd(); if (c) { hist.unshift($('cin').value + '  ->  ' + c.label); hist.splice(12); ls.set('chist', JSON.stringify(hist)); drawH(); } } };
    $('cin').focus();
  }

  /* ---- reminders ---- */
  async function rem(b) {
    b.innerHTML = '<div class="scroll pad" style="flex:1"><h2>Reminders &amp; timers</h2><div class="mute small">You get a Windows notification at the right time, even if this window is closed (the small tray helper does that). Reminders can repeat: try "remind me every Monday at 9am to ...".</div>' +
      '<div class="row" style="margin:10px 0"><input id="rin" type="text" placeholder="remind me to call Sam tomorrow at 9am   /   every day at 8pm   /   timer 25 min"><button class="pri" id="rgo">Add</button></div><div class="chips" style="margin:-4px 0 8px" id="rquick"></div>' +
      '<details id="rrep" class="card" style="padding:8px 12px"><summary style="cursor:pointer"><b>🔁 Repeat options</b> <span class="small mute">choose when it repeats, then press Add above</span></summary><div class="row" style="gap:8px;flex-wrap:wrap;margin-top:8px;align-items:center"><select id="rtype"><option value="">Does not repeat</option><option value="daily">Every day</option><option value="weekdays">Weekdays</option><option value="weekly">Weekly on...</option><option value="monthly">Monthly</option><option value="yearly">Yearly</option><option value="hours">Every few hours</option></select><label class="small mute" id="revl">every <input id="rev" type="number" min="1" max="99" value="1" style="width:60px"> <span id="revu">days</span></label><label class="small mute" id="rtl">at <input id="rtod" type="time" value="09:00"></label><span id="rdays" style="display:none">' + ['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => '<label class="chk small"><input type="checkbox" data-wd="' + i + '"' + (i === 1 ? ' checked' : '') + '>' + d + '</label>').join(' ') + '</span></div><div class="row" style="gap:8px;margin-top:8px;align-items:center"><span class="small mute">Ends</span><select id="rend"><option value="">never</option><option value="count">after a number of times</option><option value="date">on a date</option></select><input id="rcount" type="number" min="1" max="500" value="10" style="width:70px;display:none"><input id="rdate" type="date" style="display:none"></div></details>' +
      '<div id="rlist"><div class="mute small">Loading...</div></div></div>';
    const quick = [['In 10 min', 'timer 10 min'], ['In 30 min', 'timer 30 min'], ['In 1 hour', 'timer 60 min'], ['Tomorrow 9am', 'remind me to check in tomorrow at 9am'], ['Every day 8am', 'remind me every day at 8am to '], ['Weekdays 7:30', 'remind me on weekdays at 7:30 to '], ['Every Monday', 'remind me every Monday at 9am to '], ['Test pop-up (10 s)', '__test']];
    $('rquick').innerHTML = quick.map((q, i) => '<span class="chip" data-q="' + i + '">' + q[0] + '</span>').join('');
    const sync = () => { const ty = $('rtype').value; $('rdays').style.display = ty === 'weekly' ? '' : 'none'; $('revl').style.display = ty && ty !== 'weekdays' ? '' : 'none'; $('rtl').style.display = ty === 'hours' ? 'none' : ''; $('revu').textContent = { daily: 'days', weekly: 'weeks', monthly: 'months', yearly: 'years', hours: 'hours' }[ty] || ''; const en = $('rend').value; $('rcount').style.display = en === 'count' ? '' : 'none'; $('rdate').style.display = en === 'date' ? '' : 'none'; };
    $('rtype').onchange = $('rend').onchange = sync; sync();
    $('rquick').onclick = async e => {
      const c = e.target.closest('.chip'); if (!c) return; const q = quick[+c.dataset.q];
      if (q[1] === '__test') { await A.api('/api/reminders', { text: 'This is a test reminder from MOUNDSHROUD', at: Date.now() + 10000 }); A.toast('A pop-up will appear in about 10 seconds'); return draw(); }
      if (/ to $/.test(q[1])) { $('rin').value = q[1]; $('rin').focus(); return; }
      const t = $('rin').value.trim(); const p = A.remind.parse(q[1]); if (!p) return;
      if (t && q[1].startsWith('timer')) p.text = t.charAt(0).toUpperCase() + t.slice(1);
      await A.api('/api/reminders', { text: p.text, at: p.at, rule: p.rule }); $('rin').value = ''; A.toast('Set for ' + A.remind.when(p.at)); draw();
    };
    const when = r => r.rule ? A.remind.describe(r.rule) + (r.until ? ', until ' + new Date(r.until).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) : '') : A.remind.when(r.at);
    const draw = async () => {
      const l = await A.api('/api/reminders'); if (!$('rlist')) return; const up = l.filter(r => !r.done), done = l.filter(r => r.done);
      $('rlist').innerHTML = (up.length ? up.map(r => '<div class="card row" style="align-items:flex-start;' + (r.paused ? 'opacity:.6' : '') + '"><div style="flex:1;min-width:0"><b>' + (r.rule ? '🔁 ' : '') + esc(r.text) + '</b>' + (r.paused ? ' <span class="badge">paused</span>' : '') + '<div class="small mute">' + esc(when(r)) + '</div>' + (r.rule && !r.paused && r.nextList && r.nextList.length ? '<div class="small mute">Next: ' + r.nextList.map(x => esc(new Date(x).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }))).join(' · ') + '</div>' : '') + '</div>' +
        (r.rule ? '<span class="ib" data-sk="' + r.id + '" style="cursor:pointer" title="Skip the next one">Skip next</span><span class="ib" data-pa="' + r.id + '" data-p="' + (r.paused ? 0 : 1) + '" style="cursor:pointer">' + (r.paused ? 'Resume' : 'Pause') + '</span>' : '') + '<span class="ib" data-ed="' + r.id + '" data-t="' + esc(r.text) + '" style="cursor:pointer">Edit</span><span class="ib dang" data-d="' + r.id + '" style="cursor:pointer">Delete</span></div>').join('') : '<div class="mute">Nothing scheduled.</div>') +
        (done.length ? '<h3>Recently fired</h3>' + done.slice(0, 8).map(r => '<div class="small mute">&check; ' + esc(r.text) + ' - ' + A.fmtDate(r.at) + '</div>').join('') : '');
    };
    const ruleFromForm = () => {
      const ty = $('rtype').value; if (!ty) return null; const [hh, mm] = ($('rtod').value || '09:00').split(':').map(Number), ev = Math.max(1, +$('rev').value || 1), tod = hh * 60 + mm;
      if (ty === 'weekdays') return { type: 'weekly', every: 1, days: [1, 2, 3, 4, 5], tod };
      if (ty === 'weekly') { const d = [...document.querySelectorAll('[data-wd]')].filter(x => x.checked).map(x => +x.dataset.wd); return { type: 'weekly', every: ev, days: d.length ? d : [new Date().getDay()], tod }; }
      if (ty === 'hours') return { type: 'hours', every: ev };
      return { type: ty, every: ev, tod, dom: ty === 'monthly' || ty === 'yearly' ? new Date().getDate() : 0, month: ty === 'yearly' ? new Date().getMonth() : null };
    };
    const add = async () => {
      let t = $('rin').value.trim(); if (!t) return; const form = ruleFromForm();
      const p = A.remind.parse(/remind|timer|alarm/i.test(t) ? t : 'remind me ' + t);
      let body;
      if (form) { const txt = p && p.text ? p.text : t.charAt(0).toUpperCase() + t.slice(1); body = { text: txt, rule: form, at: Date.now() }; const en = $('rend').value; if (en === 'count') body.count = +$('rcount').value || 10; else if (en === 'date' && $('rdate').value) body.until = new Date($('rdate').value + 'T23:59:59').getTime(); }
      else if (p) body = { text: p.text, at: p.at, rule: p.rule }; else return A.toast('Try: "remind me to ... tomorrow at 9am", "every day at 8am" or "timer 10 min"', 4000);
      await A.api('/api/reminders', body); $('rin').value = ''; A.toast(body.rule ? 'Repeating ' + A.remind.describe(body.rule) : 'Set for ' + A.remind.when(body.at)); draw(); A.emit('reminders');
    };
    const tick = setInterval(() => { if (!$('rlist') || !live(b)) return clearInterval(tick); draw(); }, 5000);
    $('rgo').onclick = add; $('rin').onkeydown = e => { e.stopPropagation(); if (e.key === 'Enter') add(); };
    $('rlist').onclick = async e => {
      const d = e.target.closest('[data-d]'), s = e.target.closest('[data-sk]'), pz = e.target.closest('[data-pa]'), ed = e.target.closest('[data-ed]');
      if (d) { await A.api('/api/reminders/delete', { id: d.dataset.d }); } else if (s) { await A.api('/api/reminders/edit', { id: s.dataset.sk, skip: true }); A.toast('Skipped the next one'); } else if (pz) { await A.api('/api/reminders/edit', { id: pz.dataset.pa, paused: pz.dataset.p === '1' }); } else if (ed) { const n = prompt('Reminder text', ed.dataset.t); if (n && n.trim()) await A.api('/api/reminders/edit', { id: ed.dataset.ed, text: n.trim() }); } else return;
      draw(); A.emit('reminders');
    };
    draw();
  }

  /* ---- prompts ---- */
  async function prm(b, my) {
    let list = await A.api('/api/prompts'); if (my !== tok) return;
    const draw = () => {
      b.innerHTML = '<div class="scroll pad" style="flex:1"><h2>Prompt library</h2><div class="mute small">Reusable instructions. Use <kbd>{text}</kbd> where your text should go. In Chat, type or select text, then click Prompts.</div>' +
        list.map((p, i) => '<div class="card"><div class="row"><input data-n="' + i + '" value="' + esc(p.name) + '" style="font-weight:600"><span class="ib dang" data-d="' + i + '" style="cursor:pointer">Delete</span></div><textarea data-t="' + i + '" rows="3" style="margin-top:6px">' + esc(p.text) + '</textarea></div>').join('') +
        '<div class="row"><button class="ib" id="padd">+ New prompt</button><button class="ib" id="preset">Restore defaults</button></div></div>';
      b.querySelectorAll('[data-n]').forEach(x => x.oninput = () => { list[+x.dataset.n].name = x.value; sv(); });
      b.querySelectorAll('[data-t]').forEach(x => x.oninput = () => { list[+x.dataset.t].text = x.value; sv(); });
      b.querySelectorAll('[data-d]').forEach(x => x.onclick = () => { list.splice(+x.dataset.d, 1); sv(); draw(); });
      $('padd').onclick = () => { list.push({ id: 'p' + Date.now(), name: 'New prompt', text: 'Do something useful with this:\n\n{text}' }); sv(); draw(); };
      $('preset').onclick = async () => { if (!confirm('Replace all prompts with the defaults?')) return; await A.api('/api/prompts', null); list = await A.api('/api/prompts'); draw(); };
    };
    let t; const sv = () => { clearTimeout(t); t = setTimeout(() => A.api('/api/prompts', list), 500); };
    draw();
  }

  /* ---- CyberChef ---- */
  function chef(b) {
    b.innerHTML = '<div class="small mute" style="padding:6px 12px">CyberChef - the "cyber swiss-army knife": encode, decode, hash, convert and analyse data. Runs fully offline.</div><iframe src="/cyberchef/" style="flex:1;border:0;width:100%;background:#fff"></iframe>';
  }

  /* pages that moved out of Tools: old shortcuts still land in the right place */
  const MOVED = { journal: () => A.showTab('journal'), storage: () => A.settings.open('data'), codes: () => A.cybertab.go('codes'), course: () => A.cybertab.go('course'), cyber: () => A.cybertab.go('cyber'), chef: () => A.cybertab.go('chef'),
    docs: () => A.showTab('docs'), office: () => A.showTab('offed'), calc: () => A.showTab('calc'), scan: () => A.showTab('scan'), meet: () => A.showTab('meet'), rem: () => A.showTab('rem'), clip: () => A.showTab('clip'),
    vault: () => A.cybertab.go('vault'), puzz: () => A.play.open('puzz'), trans: () => A.lang.translate(), prm: () => A.prep.open('prm') };
  /* show one of these tools inside another page (its new home): the same code, a fresh start each time it is opened */
  const show = (s, b) => { const f = RENDER()[s]; if (!f) return; if (b._cleanup) { try { b._cleanup(); } catch (e) { } b._cleanup = null; } b.innerHTML = ''; f(b, ++tok); };
  A.tools = { subs: SUBS, show, managePrompts() { A.prep.open('prm'); }, go: s => { const m = MOVED[s]; if (m) return m(); sub = s; A.showTab('tools'); } };
  A.registerTab('tools', 'Tools', () => go(sub));
})();

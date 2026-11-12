// Agent (Chat > Agent): the second tab of the Chat page. It opens the free coding agent that runs on this PC, a window of
// its own where you type what you want built or fixed. It is Claude Code's tools driven by a model in Ollama, so nothing
// leaves this PC. This page checks that it is set up, lets you pick the model, the folder and how far it may reach, and
// opens it; the agent itself runs in its own window.
(() => {
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const lsGet = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : v; } catch (e) { return d; } };
  const lsPut = (k, v) => { try { if (v) localStorage.setItem(k, v); else localStorage.removeItem(k); } catch (e) { } };
  const KEY = 'agentdir', MKEY = 'agentmodel', GKEY = 'agentguard', CKEY = 'agentctx';
  const get = () => lsGet(KEY, ''), put = v => lsPut(KEY, v);
  const gb = n => n ? (n / 1073741824).toFixed(1) + ' GB' : '';

  function render(b) {
    let alive = true, st = null; b._cleanup = () => { alive = false; };
    /* the page: a bar of buttons, then either the conversation with its message box, or the settings */
    b.innerHTML = '<div style="flex:1;min-height:0;display:flex;flex-direction:column">' +
      '<div class="row" style="padding:8px 12px;gap:6px;flex-wrap:wrap;align-items:center;border-bottom:1px solid var(--line);flex:none">' +
      '<button class="ib on" id="hnew" title="Start a fresh conversation with the model and folder chosen in Settings">▶ New session</button>' +
      '<button class="ib" id="hcont" style="display:none" title="Pick this conversation up where it stopped">Continue</button>' +
      '<button class="ib dang" id="hstop" style="display:none">■ Stop</button>' +
      '<button class="ib" id="hset">⚙ Settings</button><button class="ib" id="hhist">🕘 Earlier</button>' +
      '<span class="small mute" id="hline" style="flex:1;min-width:120px;word-break:break-all"></span></div>' +
      '<div id="hconv" class="scroll pad" style="flex:1;min-height:0"><div id="hmsgs" style="max-width:860px"></div></div>' +
      '<div class="composer" id="hcomp" style="flex:none"><div style="display:flex;gap:8px;align-items:flex-end"><textarea id="hin" rows="2" style="flex:1" placeholder="Tell the agent what to build or fix...  (Enter to send, Shift+Enter for a new line)"></textarea><button class="pri" id="hsend">Send</button></div></div>' +
      '<div id="agset" class="scroll pad" style="flex:1;min-height:0;display:none"><div style="max-width:760px">' +
      '<h2>🤖 Agent settings</h2>' +
      '<div class="mute small" style="margin:2px 0 14px">A free coding helper that runs on this PC. Tell it what to build or fix; it reads, writes and edits files and runs commands. It uses a model in Ollama, so nothing leaves this PC. These choices are used by the next session you start.</div>' +
      '<div class="card" id="agst"><div class="mute small">Checking...</div></div>' +
      '<div class="card" style="margin-top:10px"><div style="font-weight:600;margin-bottom:6px">Model</div>' +
      '<select id="agmodel" style="max-width:100%"></select><div class="small mute" id="agmnote" style="margin-top:6px"></div>' +
      '<div style="font-weight:600;margin:12px 0 6px">Memory</div><select id="agctx"></select>' +
      '<div class="small mute" style="margin-top:6px">How much of a session the model holds at once. A larger memory lets it work on bigger projects before it fills up, and it uses more of this PC\'s memory and runs slower. With the largest size the agent also tidies a long session by itself and keeps going.</div></div>' +
      '<div class="card" style="margin-top:10px"><div style="font-weight:600;margin-bottom:6px">Folder it works in</div>' +
      '<div class="small mute" id="agdir" style="word-break:break-all;margin-bottom:8px"></div>' +
      '<div class="row" style="gap:6px;flex-wrap:wrap"><button class="ib" id="agpick">Choose a folder...</button><button class="ib" id="agreset">Use its own workspace</button></div></div>' +
      '<div class="card" style="margin-top:10px"><div style="font-weight:600;margin-bottom:6px">How far it may reach</div>' +
      '<label class="chk" style="display:flex;gap:8px;align-items:flex-start"><input type="checkbox" id="agguard" style="margin-top:3px"><span><b>Whole PC, guarded</b><div class="small mute">Off: it works in its folder and asks before every command.<br>On: it reads files anywhere on this PC and runs harmless commands (listing files, git status, checking a script for mistakes) unasked. It asks before running a program, deleting, moving, installing, downloading or editing outside its folder. Disk formatting, boot changes and deleting Windows or Program Files are always refused.</div></span></label></div>' +
      '<div class="row" style="gap:8px;margin:14px 0;align-items:center"><button class="ib on" id="hback" style="padding:9px 18px">← Back to the conversation</button><button class="ib" id="aggo" style="padding:9px 18px" title="The same agent in a console window of its own, with the same model, memory, folder and reach">🖥 Open in a terminal window instead</button><span class="small mute" id="agmsg"></span></div>' +
      '<div class="card"><div style="font-weight:600;margin-bottom:6px">Good to know</div><ul class="small" style="margin:0;padding-left:18px;line-height:1.6">' +
      '<li><b>Good for:</b> small scripts, single-file projects and games, simple edits, explaining code.</li>' +
      '<li><b>Not good for:</b> big projects, careful debugging or long jobs left running unattended. These are small models: they can be confidently wrong and they forget after about 32,000 tokens.</li>' +
      '<li><b>Approvals:</b> read each command before you approve it. The guard catches known harmful commands; it cannot judge a command it has never seen, so those reach you as a question.</li>' +
      '<li><b>Safety:</b> point it at a folder you have backed up, not at your documents or this app.</li>' +
      '<li><b>First run:</b> the first start with a model makes a copy of it with the chosen memory, which takes a minute. The terminal window also asks you to pick a text style once.</li>' +
      '<li><b>Here or in a terminal:</b> the conversation on this page and the terminal window are the same agent with the same rules. On this page, a command that needs your say shows Allow and Refuse buttons; in the terminal you answer with the keyboard.</li>' +
      '</ul></div></div></div>';
    const $ = id => b.querySelector('#' + id);
    const dirLine = () => { const d = get(); $('agdir').textContent = d || 'Its own workspace folder (inside the agent folder).'; $('agreset').style.display = d ? '' : 'none'; };
    dirLine();
    $('agguard').checked = lsGet(GKEY, '') === '1';
    $('agguard').onchange = () => lsPut(GKEY, $('agguard').checked ? '1' : '');

    const chosen = () => { const s = $('agmodel'); return s && s.value ? (st && st.models || []).find(m => m.name === s.value) : null; };
    function modelNote() {
      const m = chosen(), n = $('agmnote'); if (!n) return;
      if (!m) { n.textContent = st && st.ollama ? '' : 'The list appears once Ollama is running. The agent starts Ollama when it opens.'; return; }
      fillCtx(m);
      const made = +$('agctx').value === st.ctxDefault ? m.ready : (m.readyCtx || []).includes(+$('agctx').value);
      /* measured on this PC: Gemma 4 (6.1 GB) fits on the 8 GB graphics card even at 128k; Bonsai 2 27b at 128k needed 17 GB, more than the PC has */
      const heavy = (m.size > 6.6 * 1073741824 && +$('agctx').value > 32768) || (m.size > 6.2 * 1073741824 && +$('agctx').value > 65536) ? ' Warning: this model with this memory size needs more memory than this PC has free, so it will run very slowly. Gemma 4 (e4b) is the one that handles a large memory well here.' : '';
      n.textContent = (!m.tools ? 'This model cannot use tools, so it cannot drive the agent.' : made ? 'Ready to use.' : 'First start makes a copy of this model with this memory size (about a minute, no download).') + heavy;
      $('aggo').disabled = !st || !st.installed || !st.claude || !m.tools;
    }
    /* the memory sizes this model supports; the last choice is kept when the model allows it */
    function fillCtx(m) {
      const sel = $('agctx'), sizes = ((st && st.ctx) || [32768]).filter(c => !m || c <= (m.maxCtx || 32768)), want = +sel.value || +lsGet(CKEY, '') || (m && /^gemma4:e4b/.test(m.name) ? 131072 : 0) || (st && st.ctxDefault) || 32768;   // Gemma 4 was measured at 128k on this PC's 8 GB card: it fits
      const label = c => Math.round(c / 1024) + 'k tokens' + (c === 32768 ? ' (standard, fastest)' : c === 65536 ? ' (longer sessions)' : ' (longest sessions, tidies itself, slowest)');
      sel.innerHTML = sizes.map(c => '<option value="' + c + '">' + esc(label(c)) + '</option>').join('');
      sel.value = String(sizes.includes(want) ? want : sizes[0]);
    }
    function fillModels() {
      const sel = $('agmodel'), list = (st && st.models) || [];
      if (!list.length) { sel.innerHTML = '<option value="">' + esc(st && st.base || 'gemma4:e4b') + ' (default)</option>'; sel.disabled = true; modelNote(); return; }
      sel.disabled = false;
      sel.innerHTML = list.map(m => '<option value="' + esc(m.name) + '"' + (m.tools ? '' : ' disabled') + '>' + esc(m.name.replace(/:latest$/, '')) + (m.size ? '  ·  ' + gb(m.size) : '') + (m.tools ? '' : '  ·  cannot use tools') + '</option>').join('');
      const saved = lsGet(MKEY, ''), ok = n => list.some(m => m.name === n && m.tools);
      sel.value = ok(saved) ? saved : ok(st.base) ? st.base : ((list.find(m => m.tools) || {}).name || '');
      modelNote();
    }
    $('agmodel').onchange = () => { lsPut(MKEY, $('agmodel').value); modelNote(); };
    $('agctx').onchange = () => { lsPut(CKEY, $('agctx').value); modelNote(); };

    const row = (ok, text, hint) => '<div style="display:flex;gap:8px;align-items:baseline;margin:3px 0"><span style="width:18px">' + (ok ? '✅' : '⚠️') + '</span><div>' + esc(text) + (hint ? '<div class="small mute">' + esc(hint) + '</div>' : '') + '</div></div>';
    async function check() {
      let s; try { s = await A.api('/api/agent/status'); } catch (e) { s = null; }
      if (!alive) return; const box = $('agst'); if (!box) return;
      if (!s) { box.innerHTML = row(false, 'Could not check the agent', 'Moundshroud could not reach its own server.'); $('aggo').disabled = true; return; }
      st = s; const can = (s.models || []).filter(m => m.tools).length;
      box.innerHTML = row(s.installed, s.installed ? 'The agent is installed' : 'The agent is not installed on this PC', s.installed ? '' : 'Expected its launcher in ' + s.dir)
        + row(s.claude, s.claude ? 'Claude Code (its tools) is installed' : 'Claude Code is not installed', s.claude ? '' : 'The agent borrows its file and command tools.')
        + row(s.ollama, s.ollama ? 'Ollama is running' : 'Ollama is not running', s.ollama ? '' : 'The agent starts it for you when it opens.')
        + (s.ollama ? row(can > 0, can + ' of ' + (s.models || []).length + ' models can drive the agent', can ? '' : 'The first start downloads Gemma 4 (about 6.6 GB).') : '');
      $('aggo').disabled = !s.installed || !s.claude;
      fillModels();
    }
    check();

    $('agpick').onclick = async () => {
      $('agmsg').textContent = 'Choose a folder in the window that opened...';
      let r; try { r = await A.api('/api/pick-folder', {}); } catch (e) { r = null; }
      if (!alive) return; $('agmsg').textContent = '';
      if (r && r.path) { put(r.path); dirLine(); }
    };
    $('agreset').onclick = () => { put(''); dirLine(); };
    $('aggo').onclick = async () => {
      const btn = $('aggo'); btn.disabled = true; $('agmsg').textContent = 'Opening...';
      let r; try { r = await A.api('/api/agent/launch', { dir: get(), model: $('agmodel').value || '', guard: $('agguard').checked, ctx: +$('agctx').value || undefined }); } catch (e) { r = { ok: false, error: String(e.message || e) }; }
      if (!alive) return; btn.disabled = false;
      if (r && r.ok) { $('agmsg').textContent = ''; A.toast('Opened the agent in a new window'); }
      else { $('agmsg').textContent = ''; A.toast('Could not open the agent: ' + String((r && r.error) || 'unknown problem')); }
      check();
    };

    /* ---- the conversation: the agent runs hidden in the server (lib/harness.js) and this page shows what it does ---- */
    let seq = 0, H = null, timer = 0, starting = false, shown = 'conv';
    const stopPoll = () => { clearInterval(timer); timer = 0; };
    b._cleanup = () => { alive = false; stopPoll(); };
    const view = v => { shown = v; $('agset').style.display = v === 'set' ? '' : 'none'; $('hconv').style.display = $('hcomp').style.display = v === 'conv' ? '' : 'none'; $('hset').classList.toggle('on', v === 'set'); };
    $('hset').onclick = () => view(shown === 'set' ? 'conv' : 'set'); $('hback').onclick = () => view('conv');
    const post = async (u, body) => { try { return await A.api(u, body || {}); } catch (e) { return { ok: false, error: String(e.message || e) }; } };
    const nearEnd = () => { const c = $('hconv'); return c.scrollHeight - c.scrollTop - c.clientHeight < 140; };
    const toEnd = () => { const c = $('hconv'); c.scrollTop = c.scrollHeight; };
    /* a short name for what a tool was asked to do */
    const what = (name, i) => { i = i || {}; return name === 'Bash' ? String(i.command || '') : i.file_path ? String(i.file_path) : i.pattern ? String(i.pattern) + (i.path ? '  in ' + i.path : '') : JSON.stringify(i).slice(0, 200); };
    const ICON = { Bash: '⌨️ Run', Write: '📝 Write', Edit: '✏️ Edit', Read: '📖 Read', Glob: '🔎 Find files', Grep: '🔎 Search' };
    const note = t => '<div class="small mute" style="margin:8px 0;text-align:center">' + esc(t) + '</div>';
    function draw(e) {
      const box = $('hmsgs'), el = document.createElement('div'); el.dataset.seq = e.seq;
      if (e.kind === 'user') el.innerHTML = '<div style="display:flex;justify-content:flex-end;margin:10px 0"><div class="card" style="margin:0;max-width:80%;white-space:pre-wrap;word-break:break-word;background:var(--acc-soft,rgba(125,79,230,.18))">' + esc(e.text) + '</div></div>';
      else if (e.kind === 'text') el.innerHTML = '<div class="card" style="margin:10px 0;white-space:pre-wrap;word-break:break-word">' + esc(e.text) + '</div>';
      else if (e.kind === 'tool') { el.dataset.tool = e.toolId || ''; el.innerHTML = '<div style="margin:6px 0 6px 10px;border-left:3px solid var(--line);padding-left:10px"><div class="small"><b>' + esc(ICON[e.name] || e.name) + '</b> <span style="word-break:break-all">' + esc(what(e.name, e.input).slice(0, 600)) + '</span></div>' + (e.name === 'Write' && e.input && e.input.content ? '<details class="small"><summary class="mute">What it wrote</summary><pre style="white-space:pre-wrap;word-break:break-word;max-height:260px;overflow:auto;margin:4px 0">' + esc(e.input.content) + '</pre></details>' : '') + '<div data-res></div></div>'; }
      else if (e.kind === 'result') {
        const host = [...box.querySelectorAll('[data-tool]')].reverse().find(x => x.dataset.tool === String(e.toolId || '')), t = String(e.text || '').trim();
        const html = t ? '<details class="small"' + (e.isError ? ' open' : '') + '><summary class="' + (e.isError ? 'bad' : 'mute') + '">' + (e.isError ? 'It did not work' : 'What came back') + '</summary><pre style="white-space:pre-wrap;word-break:break-word;max-height:220px;overflow:auto;margin:4px 0">' + esc(t) + '</pre></details>' : '';
        if (host && host.querySelector('[data-res]')) { host.querySelector('[data-res]').innerHTML = html; return; }
        el.innerHTML = '<div style="margin:0 0 6px 23px">' + html + '</div>';
      }
      else if (e.kind === 'ask') { el.dataset.ask = e.id; el.innerHTML = '<div class="card" style="margin:10px 0;border:1px solid var(--warn)"><div style="font-weight:600;margin-bottom:4px">The agent wants your say before it does this</div><div class="small"><b>' + esc(ICON[e.tool] || e.tool) + '</b></div><pre style="white-space:pre-wrap;word-break:break-word;margin:6px 0;max-height:200px;overflow:auto">' + esc(what(e.tool, e.input)) + '</pre><div class="row" style="gap:8px;align-items:center"><button class="pri" data-allow="' + esc(e.id) + '">Allow</button><button class="ib dang" data-refuse="' + esc(e.id) + '">Refuse</button><span class="small mute" data-askmsg>Read it first. With no answer in 5 minutes it is refused.</span></div></div>'; }
      else if (e.kind === 'answer') { const card = box.querySelector('[data-ask="' + String(e.id).replace(/"/g, '') + '"]'); if (card) { card.querySelectorAll('button').forEach(x => x.remove()); const m = card.querySelector('[data-askmsg]'); if (m) { m.textContent = e.allow ? '✅ You allowed it.' : e.late ? '🛑 Nobody answered in time, so it was refused.' : '🛑 You refused it.'; } } return; }
      else if (e.kind === 'started') el.innerHTML = note((e.resumed ? 'Picked up again' : 'New session') + ' · ' + String(e.model || '').replace(/:latest$/, '') + ' · ' + Math.round((e.ctx || 0) / 1024) + 'k memory · ' + (e.guard ? 'whole PC, guarded' : 'this folder only') + ' · ' + (e.dir || ''));
      else if (e.kind === 'stopped') el.innerHTML = note('Stopped. Press Continue to pick it up again.');
      else if (e.kind === 'error') el.innerHTML = '<div class="small bad" style="margin:8px 0">' + esc(e.text) + '</div>';
      else if (e.kind === 'done') { if (e.ok || !e.text) return; el.innerHTML = '<div class="small bad" style="margin:8px 0">' + esc(e.text) + '</div>'; }
      else return;
      box.appendChild(el);
    }
    $('hmsgs').addEventListener('click', async ev => {
      const a = ev.target.closest('[data-allow],[data-refuse]'); if (!a) return;
      const id = a.dataset.allow || a.dataset.refuse; a.parentElement.querySelectorAll('button').forEach(x => { x.disabled = true; });
      const r = await post('/api/harness/answer', { id, allow: !!a.dataset.allow }); if (!r.ok) A.toast(r.error || 'That question is no longer open.'); tick();
    });
    function bar() {
      const s = H || {}, has = !!s.sessionId || (s.seq > 0);
      $('hstop').style.display = s.running ? '' : 'none';
      $('hcont').style.display = !s.running && s.sessionId && !starting ? '' : 'none';
      $('hnew').disabled = starting || !!s.preparing; $('hsend').disabled = starting || !!s.busy || !!s.preparing;
      $('hline').textContent = starting || s.preparing ? 'Getting the model ready (the first time with a model takes a minute)...' : s.running ? (s.pending && s.pending.length ? 'Waiting for your answer above.' : s.busy ? (s.thinking ? 'Thinking...' : 'Working...') : 'Ready. ' + String(s.model || '').replace(/:latest$/, '')) : has ? 'Not running.' : 'No session yet. Type below, or press New session.';
      let live = $('hmsgs').querySelector('[data-live]');
      if (s.live) { if (!live) { live = document.createElement('div'); live.dataset.live = '1'; live.className = 'card'; live.style.cssText = 'margin:10px 0;white-space:pre-wrap;word-break:break-word;opacity:.8'; } $('hmsgs').appendChild(live); live.textContent = s.live; }
      else if (live) live.remove();
    }
    async function tick() {
      let s; try { s = await A.api('/api/harness/state?since=' + seq); } catch (e) { return; }
      if (!alive || !s) return;
      if (s.seq < seq) { seq = 0; $('hmsgs').innerHTML = ''; return tick(); }      // the server began a new conversation
      const stick = nearEnd(); H = s; (s.events || []).forEach(draw); seq = s.seq; bar(); if (stick) toEnd();
      if (!$('hmsgs').children.length) $('hmsgs').innerHTML = '';
    }
    const begin = async resume => {
      if (starting) return false; starting = true; bar();
      if (!resume) { seq = 0; $('hmsgs').innerHTML = ''; }
      const r = await post('/api/harness/start', { model: $('agmodel').value || '', ctx: +$('agctx').value || undefined, guard: $('agguard').checked, dir: get(), resume: resume || undefined });
      starting = false; if (!alive) return false;
      if (!r.ok) { A.toast('Could not start the agent: ' + (r.error || 'unknown problem')); bar(); return false; }
      if (!resume) seq = 0; await tick(); return true;
    };
    $('hnew').onclick = () => { view('conv'); begin(''); };
    $('hcont').onclick = () => { view('conv'); begin(H && H.sessionId); };
    $('hstop').onclick = async () => { await post('/api/harness/stop'); tick(); };
    async function sendNow() {
      const t = $('hin').value.trim(); if (!t || starting) return;
      if (!H || !H.running) { if (!(await begin(H && H.sessionId ? H.sessionId : ''))) return; }
      const r = await post('/api/harness/send', { text: t });
      if (!r.ok) { A.toast(r.error || 'The message was not sent.'); return; }
      $('hin').value = ''; await tick(); toEnd();
    }
    $('hsend').onclick = sendNow;
    $('hin').addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); sendNow(); } });
    $('hhist').onclick = async function () {
      let r; try { r = await A.api('/api/harness/sessions'); } catch (e) { r = null; }
      const list = (r && r.sessions) || [];
      const pp = A.pop(this, '<div class="grp" style="margin-top:0">Earlier conversations</div>' + (list.length ? list.map(s => '<div class="hit" data-id="' + esc(s.id) + '"><b>' + esc(s.title || 'Untitled') + '</b><div class="small mute">' + esc(new Date(s.at).toLocaleString()) + ' · ' + esc(String(s.model || '').replace(/:latest$/, '')) + '</div></div>').join('') : '<div class="small mute" style="padding:6px 10px">None yet. A conversation is kept once the agent has answered.</div>'));
      pp.onclick = async e => { const h = e.target.closest('[data-id]'); if (!h) return; A.closePop(); const x = await post('/api/harness/show', { id: h.dataset.id }); if (!x.ok) { A.toast(x.error || 'Could not open that conversation.'); return; } seq = 0; $('hmsgs').innerHTML = ''; view('conv'); await tick(); toEnd(); };
    };
    $('hhist').dataset.pop = '1';
    timer = setInterval(tick, 700); tick().then(toEnd);
  }

  /* ---- the two tabs of the Chat page: the normal chat, and the agent ---- */
  /* the tabs of the Chat page: the normal chat, the agent, and the swarm (web/js/swarm.js) */
  const panel = document.getElementById('p-chat'), bar = document.getElementById('chattabs');
  const PANES = { agent: { el: document.getElementById('agentpane'), draw: p => render(p) }, swarm: { el: document.getElementById('swarmpane'), draw: p => A.swarm && A.swarm.render(p) } };
  let mode = 'chat';
  function tab(m) {
    if (!panel || !bar) return;
    /* a page with unsaved work (the swarm's teams and workflows) is asked about before it is closed */
    const open = PANES[mode] && PANES[mode].el;
    if (open && m !== mode && typeof open._dirty === 'function' && open._dirty() && !confirm('Your changes to teams and workflows are not saved yet. Leave without saving?')) return;
    mode = PANES[m] && PANES[m].el ? m : 'chat';
    Object.keys(PANES).forEach(k => {
      const p = PANES[k].el; if (!p) return;
      panel.classList.toggle('mode-' + k, mode === k);
      if (p._cleanup) { try { p._cleanup(); } catch (e) { } p._cleanup = null; }
      p._dirty = null; p.innerHTML = '';
    });
    bar.querySelectorAll('[data-ct]').forEach(x => x.classList.toggle('on', x.dataset.ct === mode));
    if (PANES[mode]) PANES[mode].draw(PANES[mode].el);
  }
  if (bar) bar.onclick = e => { const x = e.target.closest('[data-ct]'); if (x) tab(x.dataset.ct); };
  /* a new chat always lands on the normal chat */
  const newc = document.getElementById('newc'); if (newc) newc.addEventListener('click', () => { if (mode !== 'chat') tab('chat'); });
  const open = () => { A.showTab('chat'); tab('agent'); };

  A.agent = { render, tab, open, mode: () => mode };
  if (A.cmd && A.cmd.reg) A.cmd.reg({ title: 'Open the coding agent', sub: 'A free helper that builds and fixes code on this PC', icon: '🤖', group: 'Go to', tags: 'agent coding code program gemma qwen assistant developer build game', run: open });
})();

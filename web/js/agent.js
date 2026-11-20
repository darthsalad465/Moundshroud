// Agent (Chat > Agent): the second tab of the Chat page, with Moundshroud's own visual style. A list of sessions on
// the left (switch between them, search, forget), the conversation in the middle with each tool step as a short line, and
// a message box with the folder, model and reach underneath. The agent is Claude Code's tools driven by a model in Ollama
// (lib/harness.js), so nothing leaves this PC. One session runs at a time, because the graphics card holds one model:
// looking at an earlier session never stops the running one; typing in it does, after asking.
// Routines (lib/routines.js) live here too: the agent does a task on a schedule and leaves the result in an inbox.
(() => {
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const lsGet = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : v; } catch (e) { return d; } };
  const lsPut = (k, v) => { try { if (v) localStorage.setItem(k, v); else localStorage.removeItem(k); } catch (e) { } };
  const KEY = 'agentdir', MKEY = 'agentmodel', GKEY = 'agentguard', CKEY = 'agentctx', SKEY = 'agentside';
  const get = () => lsGet(KEY, ''), put = v => lsPut(KEY, v);
  const gb = n => n ? (n / 1073741824).toFixed(1) + ' GB' : '';
  const bare = m => String(m || '').replace(/:latest$/, '');
  const base = p => String(p || '').split(/[\\/]/).filter(Boolean).pop() || String(p || '');
  const plain = t => String(t || '').replace(/[*`#_>]+/g, '').replace(/\s+/g, ' ').trim();      // a title without markdown marks
  const mdx = t => typeof md === 'function' ? md(String(t || '')) : esc(t).replace(/\n/g, '<br>');
  const ago = t => { const s = (Date.now() - t) / 1000; return s < 60 ? 'just now' : s < 3600 ? Math.round(s / 60) + ' min ago' : s < 86400 ? Math.round(s / 3600) + ' h ago' : new Date(t).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }); };
  const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  let wantView = '';      // A.agent.open('routines') asks for a page before the tab is drawn

  function render(b) {
    let alive = true, st = null, H = null;
    b.innerHTML = '<div class="agx" id="agx">' +
      /* ---- the session list ---- */
      '<aside class="agside" id="agside"><div class="agsidetop"><button class="agnew" id="hnew" title="Start a fresh conversation">✎ New session</button>' +
      '<input id="agsq" type="search" placeholder="Search sessions" autocomplete="off"></div>' +
      '<button class="agnavr" id="agrbtn" title="Tasks the agent does by itself on a schedule">⏱ Routines<span class="agbadge" id="agrbadge"></span></button>' +
      '<div class="agslist" id="aglist"></div>' +
      '<div class="agsidefoot"><button class="agnavr" id="hset">⚙ Agent settings</button></div></aside>' +
      /* ---- the main column ---- */
      '<section class="agmain"><div class="aghead"><button class="ib agtog" id="agtog" title="Show or hide the session list">☰</button>' +
      '<div class="aghtitle"><b id="agtitle">New session</b><span class="small mute" id="agsub"></span></div>' +
      '<span class="agstat" id="hline"></span><button class="ib" id="hcont" style="display:none" title="Pick this conversation up where it stopped">↻ Continue</button><button class="ib dang" id="hstop" style="display:none">■ Stop</button></div>' +
      '<div id="hconv" class="scroll agconv"><div id="hmsgs" class="agtx"></div></div>' +
      '<div class="agcomp" id="hcomp"><div class="agshot" id="agshot" style="display:none"><img id="agshotimg" alt=""><span id="agshotname"></span><button class="agshotx" id="agshotx" title="Remove the picture">✕</button></div><div class="agbox"><textarea id="hin" rows="2" placeholder="Tell the agent what to build or fix…"></textarea>' +
      '<input type="file" id="agfile" accept="image/*" style="display:none">' +
      '<div class="agchips"><button class="agchip" id="agphoto" title="Give it a picture to look at or work from — you can also paste one straight into the box">📎 Picture</button><button class="agchip" id="agcdir"></button><select class="agchip" id="agcmod" aria-label="Model" title="Every AI model on this PC, grouped by what it does: chat and agent models drive the session; the others make pictures, video, speech or music, search by meaning, or turn speech into text"></select><button class="agchip" id="agmic" style="display:none" title="Talk: the chosen speech-to-text model writes it in the box">🎙 Talk</button><button class="agchip" id="agcreach"></button><button class="agchip" id="agceng" title="The engine running the agent. Click to switch."></button><span style="flex:1"></span><span class="small mute agkeys">Enter to send · Shift+Enter new line</span><button class="agsend" id="hsend" title="Send (Enter)">↑</button></div></div></div>' +
      '<div id="agrout" class="scroll pad" style="flex:1;min-height:0;display:none"></div>' +
      '<div id="agset" class="scroll pad" style="flex:1;min-height:0;display:none"><div style="max-width:760px">' +
      '<h2>⚙ Agent settings</h2>' +
      '<div class="mute small" style="margin:2px 0 14px">A free coding helper that runs on this PC. Tell it what to build or fix; it reads, writes and edits files and runs commands. It uses a model in Ollama, so nothing leaves this PC. These choices are used by the next session you start, and are also under the message box.</div>' +
      '<div class="card" id="ageng"><div style="font-weight:600;margin-bottom:6px">Agent engine</div><div class="small mute" style="margin-bottom:8px">The program that runs the agent. Every session in this tab uses the one picked here. Switching stops a session that is running.</div><div class="ageng" id="agengs"></div></div>' +
      '<div class="card" id="agst" style="margin-top:10px"><div class="mute small">Checking...</div></div>' +
      '<div class="card" style="margin-top:10px"><div style="font-weight:600;margin-bottom:6px">Model</div>' +
      '<select id="agmodel" style="max-width:100%"></select><div class="small mute" id="agmnote" style="margin-top:6px"></div>' +
      '<div style="font-weight:600;margin:12px 0 6px">Memory</div><select id="agctx"></select>' +
      '<div class="small mute" style="margin-top:6px">How much of a session the model holds at once. A larger memory lets it work on bigger projects before it fills up, and it uses more of this PC\'s memory and runs slower. With the largest size the agent also tidies a long session by itself and keeps going.</div></div>' +
      '<div class="card" style="margin-top:10px"><div style="font-weight:600;margin-bottom:6px">Folder it works in</div>' +
      '<div class="small mute" id="agdir" style="word-break:break-all;margin-bottom:8px"></div>' +
      '<div class="row" style="gap:6px;flex-wrap:wrap"><button class="ib" id="agpick">Choose a folder...</button><button class="ib" id="agreset">Use its own workspace</button></div></div>' +
      '<div class="card" style="margin-top:10px"><div style="font-weight:600;margin-bottom:6px">How far it may reach</div>' +
      '<label class="chk" style="display:flex;gap:8px;align-items:flex-start"><input type="checkbox" id="agguard" style="margin-top:3px"><span><b>Whole PC, guarded</b><div class="small mute">Off: it works in its folder and asks before every command.<br>On: it reads files anywhere on this PC and runs harmless commands (listing files, git status, checking a script for mistakes) unasked. It asks before running a program, deleting, moving, installing, downloading or editing outside its folder. Disk formatting, boot changes and deleting Windows or Program Files are always refused.</div></span></label></div>' +
      '<div class="row" style="gap:8px;margin:14px 0;align-items:center"><button class="ib on" id="hback" style="padding:9px 18px">← Back to the conversation</button><button class="ib" id="aggo" style="padding:9px 18px" title="The same agent in a console window of its own, with the same harness, model, memory, folder and reach chosen here">🖥 Open in a terminal window instead</button><span class="small mute" id="agmsg"></span></div>' +
      '<div class="card"><div style="font-weight:600;margin-bottom:6px">Good to know</div><ul class="small" style="margin:0;padding-left:18px;line-height:1.6">' +
      '<li><b>Good for:</b> small scripts, single-file projects and games, simple edits, explaining code.</li>' +
      '<li><b>Not good for:</b> big projects, careful debugging or long jobs left running unattended. These are small models: they can be confidently wrong and they forget after about 32,000 tokens.</li>' +
      '<li><b>Approvals:</b> read each command before you approve it. The guard catches known harmful commands; it cannot judge a command it has never seen, so those reach you as a question.</li>' +
      '<li><b>Sessions:</b> the list on the left keeps your last 60 conversations. Click one to read it; type in it to pick it up again. Only one runs at a time.</li>' +
      '<li><b>Safety:</b> point it at a folder you have backed up, not at your documents or this app.</li>' +
      '<li><b>First run:</b> the first start with a model makes a copy of it with the chosen memory, which takes a minute. The terminal window also asks you to pick a text style once.</li>' +
      '</ul></div></div></div></section></div>';
    const $ = id => b.querySelector('#' + id);
    const post = async (u, body) => { try { return await A.api(u, body || {}); } catch (e) { return { ok: false, error: String(e.message || e) }; } };
    /* a line of the conversation that is the agent talking to you about itself, not the model talking */
    const say = html => { const d = document.createElement('div'); d.className = 'agnote'; d.innerHTML = html; $('hmsgs').appendChild(d); toEnd(); };

    /* ---------- settings (also shown as the chips under the message box) ---------- */
    const dirLine = () => { const d = get(); $('agdir').textContent = d || 'Its own workspace folder (inside the agent folder).'; $('agreset').style.display = d ? '' : 'none'; chips(); };
    $('agguard').checked = lsGet(GKEY, '') === '1';
    $('agguard').onchange = () => { lsPut(GKEY, $('agguard').checked ? '1' : ''); chips(); };
    const isNative = () => (st && st.harness === 'native') || (H && H.harness === 'native');
    const chosen = () => { const s = $('agmodel'); return s && s.value ? (st && st.models || []).find(m => m.name === s.value) : null; };
    function modelNote() {
      const m = chosen(), n = $('agmnote'); if (!n) return;
      if (!m) { n.textContent = st && st.ollama ? '' : 'The list appears once Ollama is running. The agent starts Ollama when it opens.'; $('aggo').disabled = isNative() ? false : (!st || !st.installed || !(st.claude || st.jcode)); chips(); return; }
      fillCtx(m);
      const made = +$('agctx').value === st.ctxDefault ? m.ready : (m.readyCtx || []).includes(+$('agctx').value);
      /* measured on this PC: Gemma 4 (6.1 GB) fits on the 8 GB graphics card even at 128k; Bonsai 2 27b at 128k needed 17 GB, more than the PC has */
      const heavy = (m.size > 6.6 * 1073741824 && +$('agctx').value > 32768) || (m.size > 6.2 * 1073741824 && +$('agctx').value > 65536) ? ' Warning: this model with this memory size needs more memory than this PC has free, so it will run very slowly. Gemma 4 (e4b) is the one that handles a large memory well here.' : '';
      n.textContent = (!m.tools ? (isNative() ? 'Chat-only model: Moundshroud Code runs it in chat mode.' : 'This model cannot use tools, so it cannot drive the agent.') : made ? 'Ready to use.' : 'First start makes a copy of this model with this memory size (about a minute, no download).') + heavy;
      $('aggo').disabled = isNative() ? false : (!st || !st.installed || !(st.claude || st.jcode) || !m.tools);
      chips();
    }
    /* the memory sizes this model supports; the last choice is kept when the model allows it */
    function fillCtx(m) {
      const sel = $('agctx'), sizes = ((st && st.ctx) || [32768]).filter(c => !m || c <= (m.maxCtx || 32768)), want = +sel.value || +lsGet(CKEY, '') || (m && /^gemma4:e4b/.test(m.name) ? 131072 : 0) || (st && st.ctxDefault) || 32768;   // Gemma 4 was measured at 128k on this PC's 8 GB card: it fits
      const label = c => Math.round(c / 1024) + 'k tokens' + (c === 32768 ? ' (standard, fastest)' : c === 65536 ? ' (longer sessions)' : ' (longest sessions, tidies itself, slowest)');
      sel.innerHTML = sizes.map(c => '<option value="' + c + '">' + esc(label(c)) + '</option>').join('');
      sel.value = String(sizes.includes(want) ? want : sizes[0]);
    }
    const sortedModels = () => A.modelOrder ? A.modelOrder.sort((st && st.models) || []) : ((st && st.models) || []);
    const toolModels = () => sortedModels().filter(m => m.tools);
    function fillModels(preferDefault) {
      const sel = $('agmodel'), barSel = $('agcmod'), list = sortedModels(), nat = isNative();
      if (!list.length) {
        const emptyOpt = '<option value="">' + esc((st && st.base) || 'free-agent') + ' (default)</option>';
        sel.innerHTML = emptyOpt; sel.disabled = !nat;
        if (barSel) { barSel.innerHTML = '<option value="">🧠 No models yet</option>'; barSel.disabled = true; }
        modelNote(); return;
      }
      sel.disabled = false;
      const optLabel = m => A.modelOrder ? A.modelOrder.label(m, { toolsNote: true }) : ((m.free ? (m.label || '✦ Free frontier (free, no key)') : bare(m.name)) + (!m.free && m.size ? '  ·  ' + gb(m.size) : '') + (m.tools ? '' : '  ·  cannot use tools'));
      const optHtml = list.filter(m => !m.embedding).map(m => '<option value="' + esc(m.name) + '"' + (m.tools || nat ? '' : ' disabled') + '>' + esc(optLabel(m)) + '</option>').join('');
      sel.innerHTML = optHtml;
      const canUse = m => m && (m.tools || nat);
      const saved = lsGet(MKEY, ''), ok = n => list.some(m => m.name === n && canUse(m));
      const def = A.modelOrder ? A.modelOrder.get() : '';
      const defHit = def && list.find(m => A.modelOrder.matches(m, def) && canUse(m));
      const picked = (preferDefault && defHit) ? defHit.name : ok(saved) ? saved : defHit ? defHit.name : ((list.find(m => m.tools) || list.find(canUse) || list[0] || {}).name || '');
      sel.value = picked;
      if (barSel) {
        barSel.disabled = false;
        barSel.innerHTML = list.filter(m => !m.embedding).map(m => '<option value="' + esc(m.name) + '"' + (m.tools || nat ? '' : ' disabled') + '>🧠 ' + esc(optLabel(m)) + '</option>').join('');
        barSel.value = picked;
        addAnyModels();
      }
      modelNote();
    }
    /* every other AI model on this PC joins the chip under the box, grouped by what it does (web/js/anymodel.js) */
    const AKEY = 'agentany';
    async function addAnyModels() {
      const barSel = $('agcmod'); if (!A.anyModel || !barSel) return;
      const cat = await A.anyModel.list(); if (!alive || !cat.models || !cat.models.length) return;
      barSel.querySelectorAll('optgroup[data-any]').forEach(g => g.remove());
      if (!barSel.querySelector('optgroup')) barSel.innerHTML = '<optgroup label="💬 Chat and agent">' + barSel.innerHTML + '</optgroup>';
      barSel.insertAdjacentHTML('beforeend', A.anyModel.extraOptionsHTML(cat.models).replace(/<optgroup /g, '<optgroup data-any="1" '));
      const want = lsGet(AKEY, '');
      if (want && [...barSel.options].some(o => o.value === want)) barSel.value = want;
      anyHint();
    }
    const anyChosen = () => { const v = $('agcmod') ? $('agcmod').value : ''; return A.anyModel && A.anyModel.isAny(v) ? v : ''; };
    /* the box and the mic say what the chosen model does when it is not the one driving the agent */
    function anyHint() {
      const v = anyChosen(), m = v && A.anyModel.entry(v), mic = $('agmic');
      if (mic) mic.style.display = m && m.use === 'listen' ? '' : 'none';
      const box = $('hin'); if (!box) return;
      if (!box.dataset.ph0) box.dataset.ph0 = box.placeholder;
      if (v) { box.placeholder = A.anyModel.hint(v) || box.dataset.ph0; return; }
      box.placeholder = box.dataset.ph0;
    }
    /* sending while such a model is chosen runs it at its job; the result lands in this conversation, and a made file
       is also saved in the session folder */
    async function anyRun(v, text) {
      const m = A.anyModel.entry(v);
      if (!m) { A.toast('That model is not in the list any more.'); return; }
      $('hin').value = '';
      say('<b>' + esc(A.anyModel.ICON[m.use] || '') + ' ' + esc(m.name) + '</b> · ' + esc(text || '(no words)'));
      /* the session's folder, else the folder chosen for new sessions, else the agent's own workspace */
      let dir = (H && H.dir) || get() || (st && st.dir ? st.dir + '\\workspace' : '');
      if (m.use === 'find' && !dir) { const r = await post('/api/pick-folder', {}); dir = (r && (r.path || r.dir)) || ''; if (!dir) { say('No folder was chosen, so nothing was searched.'); return; } }
      const live = document.createElement('div'); live.className = 'agnote'; live.textContent = '⏳ Working…'; $('hmsgs').appendChild(live); toEnd();
      const t0 = Date.now(), tick2 = setInterval(() => { live.textContent = live.textContent.replace(/ \d+s$/, '') + ' ' + Math.round((Date.now() - t0) / 1000) + 's'; }, 1000);
      let r;
      try { r = await A.anyModel.act(v, text, { dir, onNote: t => { live.textContent = t; } }); } catch (e) { r = { ok: false, html: esc(e.message || 'It did not finish.') }; }
      clearInterval(tick2); live.remove();
      say(r.html || (r.ok ? 'Done.' : 'It did not finish.'));
      /* an imported model is chosen straight away: a language model drives the agent, an embedding model searches */
      if (r.imported) {
        const isIt = n => n === r.imported || n === r.imported + ':latest';
        lsPut(AKEY, ''); await check(); await addAnyModels();
        const opts = [...$('agcmod').options];
        if (r.use === 'talk') { const o = opts.find(x => isIt(x.value)); if (o) pickModel(o.value); }
        else { const o = opts.find(x => { const e = A.anyModel.entry(x.value); return e && e.use === 'find' && isIt(e.ollama); }); if (o) pickModel(o.value); }
      }
    }
    async function pickModel(name) {
      if (A.anyModel && A.anyModel.isAny(name)) { lsPut(AKEY, name); if ($('agcmod')) $('agcmod').value = name; anyHint(); const m = A.anyModel.entry(name); if (m) A.toast(A.anyModel.ICON[m.use] + ' ' + m.name + ' · ' + m.useLabel + (m.use === 'info' ? '' : '. Type in the box and send.'), 4000); return; }
      lsPut(AKEY, ''); anyHint();
      $('agmodel').value = name;
      if ($('agcmod')) $('agcmod').value = name;
      lsPut(MKEY, name);
      modelNote();
      if (H && H.running) {
        if (isNative() && !H.busy && !H.preparing) {
          const r = await post('/api/harness/control', { cmd: 'model', value: name });
          if (r && r.ok) { A.toast('Switched model to ' + bare(r.model || name) + (r.chat ? ' (chat mode)' : '')); tick(); }
          else A.toast((r && r.error) || 'Could not switch model.');
        } else later();
      }
    }
    $('agmodel').onchange = () => pickModel($('agmodel').value);
    $('agcmod').onchange = () => pickModel($('agcmod').value);
    /* 🎙 Talk: the chosen speech-to-text model writes what you say into the box */
    $('agmic').onclick = () => {
      if (!A.voice || !A.voice.available()) { A.toast('Microphone input is not available in this window.'); return; }
      if (A.voice.rec) { A.voice.stop(); return; }
      const m = A.anyModel && A.anyModel.entry(anyChosen());
      A.voice.start(t => { const box = $('hin'); box.value = (box.value ? box.value + ' ' : '') + t; box.focus(); }, (st, s) => {
        $('agmic').textContent = st === 'rec' ? '■ Stop · ' + Math.floor(s || 0) + 's' : st === 'busy' ? '✍ Writing…' : '🎙 Talk';
      }, { model: m && m.use === 'listen' ? m.id : '' });
    };
    $('agctx').onchange = () => { lsPut(CKEY, $('agctx').value); modelNote(); };
    const modelNow = () => bare($('agmodel').value || (sortedModels().find(m => m.tools) || sortedModels()[0] || {}).name || (st && st.base) || 'free-agent');
    function chips() {
      $('agcdir').textContent = '📁 ' + (get() ? base(get()) : 'workspace'); $('agcdir').title = 'Folder for the next new session: ' + (get() || 'its own workspace folder') + '. Click to change.';
      if ($('agcmod') && !anyChosen() && $('agcmod').value !== $('agmodel').value && $('agmodel').value) $('agcmod').value = $('agmodel').value;
      $('agcreach').textContent = $('agguard').checked ? '🔓 Whole PC, guarded' : '🔒 This folder only'; $('agcreach').title = 'Click to switch. Used by the next new session.';
    }

    const row = (ok, text, hint) => '<div style="display:flex;gap:8px;align-items:baseline;margin:3px 0"><span style="width:18px">' + (ok ? '✅' : '⚠️') + '</span><div>' + esc(text) + (hint ? '<div class="small mute">' + esc(hint) + '</div>' : '') + '</div></div>';
    async function check() {
      let s; try { s = await A.api('/api/agent/status'); } catch (e) { s = null; }
      if (!alive) return; const box = $('agst'); if (!box) return;
      if (!s) { box.innerHTML = row(false, 'Could not check the agent', 'Moundshroud could not reach its own server.'); $('aggo').disabled = true; return; }
      st = s; if (A.modelOrder && typeof s.defaultModel === 'string') A.modelOrder.sync(s.defaultModel);
      const can = (s.models || []).filter(m => m.tools).length, nat = s.harness === 'native';
      box.innerHTML = (nat
          ? row(true, 'Moundshroud Code is built in and ready', 'Works with any model you have downloaded — no outside program needed.')
          : row(s.installed, s.installed ? 'The agent is installed' : 'The agent is not installed on this PC', s.installed ? '' : 'Expected its launcher in ' + s.dir)
            + row(s.claude, s.claude ? 'Claude Code (its tools) is installed' : 'Claude Code is not installed', s.claude ? '' : 'The agent borrows its file and command tools.'))
        + row(s.ollama, s.ollama ? 'Ollama is running' : 'Ollama is not running', s.ollama ? '' : 'The agent starts it for you when it opens.')
        + (s.ollama ? row(can > 0, can + ' of ' + (s.models || []).length + ' models can drive the agent', can ? '' : 'Pick any model from the dropdown, or pull one in Models.') : '');
      $('aggo').disabled = nat ? false : (!s.installed || !(s.claude || s.jcode));
      fillModels(); drawEngines(); if (view === 'routines') drawRoutines();
    }
    /* ---------- the three engines: Moundshroud Code (built in), Claude Code and jcode ---------- */
    const ENGINES = [
      { k: 'native', icon: '🏔', name: 'Moundshroud Code', what: 'Built into this app. Drives the agent with any model on this PC, and every other model has a job here too: pictures, voices, music, search by meaning and more, from the model chip under the box.', need: s => ({ ok: true, why: 'Ready: it is part of Moundshroud.' }) },
      { k: 'claude', icon: '✳', name: 'Claude Code', what: 'Claude Code\'s file and command tools, driven by a model in Ollama on this PC through the gemma-agent launcher.', need: s => (s.claude && s.installed) ? { ok: true, why: 'Ready: Claude Code and its launcher are installed.' } : { ok: false, why: !s.claude ? 'Claude Code is not installed on this PC.' : 'The launcher is missing from ' + (s.dir || 'the agent folder') + '.' } },
      { k: 'jcode', icon: '◆', name: 'jcode', what: 'The jcode agent (runtime\\jcode), driven by a model in Ollama on this PC.', need: s => s.jcode ? { ok: true, why: 'Ready: jcode is installed.' } : { ok: false, why: 'jcode is not installed in runtime\\jcode.' } }
    ];
    const engName = k => (ENGINES.find(e => e.k === k) || ENGINES[0]).name;
    function drawEngines() {
      const box = $('agengs'), kind = (st && st.harness) || 'claude'; if (!box) return;
      box.innerHTML = ENGINES.map(e => { const n = e.need(st || {}); return '<label class="agengo' + (e.k === kind ? ' on' : '') + (n.ok ? '' : ' off') + '"><input type="radio" name="ageng" value="' + e.k + '"' + (e.k === kind ? ' checked' : '') + (n.ok ? '' : ' disabled') + '><span><b>' + e.icon + ' ' + esc(e.name) + '</b>' + (e.k === kind ? ' <span class="agengnow">in use</span>' : '') + '<div class="small mute">' + esc(e.what) + '</div><div class="small ' + (n.ok ? 'ok' : 'bad') + '">' + esc(n.why) + '</div></span></label>'; }).join('');
      box.querySelectorAll('input[name="ageng"]').forEach(r => { r.onchange = () => switchEngine(r.value); });
      const chip = $('agceng'); if (chip) chip.textContent = (ENGINES.find(e => e.k === kind) || ENGINES[0]).icon + ' ' + engName(kind);
    }
    async function switchEngine(k) {
      const kind = (st && st.harness) || 'claude';
      if (k === kind) return;
      if (H && H.running && !(await A.confirm('Switch the agent to ' + engName(k) + '?\n\nThe session that is running stops. You can pick it up again later from the list.'))) { drawEngines(); return; }
      const r = await post('/api/harness/kind', { kind: k });
      if (!r || !r.ok) { A.toast((r && r.error) || 'Could not switch.'); drawEngines(); return; }
      A.toast('Agent engine: ' + engName(k));
      await check(); try { await tick(); } catch (e) { }
      say('Agent engine · <b>' + esc(engName(k)) + '</b>' + (k === 'native' ? ' — every model on this PC is in the chip under the box.' : '.'));
    }
    $('agceng').onclick = () => show('set');
    dirLine(); check();
    async function pickFolder() {
      $('agmsg').textContent = 'Choose a folder in the window that opened...'; A.toast('Choose a folder in the window that opened');
      let r; try { r = await A.api('/api/pick-folder', {}); } catch (e) { r = null; }
      if (!alive) return ''; $('agmsg').textContent = '';
      return r && r.path ? r.path : '';
    }
    $('agpick').onclick = async () => { const p = await pickFolder(); if (p) { put(p); dirLine(); } };
    $('agreset').onclick = () => { put(''); dirLine(); };
    $('aggo').onclick = async () => {
      const btn = $('aggo'); btn.disabled = true; $('agmsg').textContent = 'Opening...';
      let r; try { r = await A.api('/api/agent/launch', { dir: get(), model: $('agmodel').value || '', guard: $('agguard').checked, ctx: +$('agctx').value || undefined }); } catch (e) { r = { ok: false, error: String(e.message || e) }; }
      if (!alive) return; btn.disabled = false; $('agmsg').textContent = '';
      if (r && r.ok) A.toast('Opened the agent in a new window'); else A.toast('Could not open the agent: ' + String((r && r.error) || 'unknown problem'));
      check();
    };
    /* the chips: same settings, one click away */
    const later = () => { if (H && H.running) A.toast('Used by the next new session. The one running now keeps its own.'); };
    $('agcdir').dataset.pop = '1';
    $('agcdir').onclick = function () {
      const pp = A.pop(this, '<div class="grp" style="margin-top:0">Folder for new sessions</div><div class="small mute" style="padding:2px 10px 6px;max-width:320px;word-break:break-all">' + esc(get() || 'Its own workspace folder') + '</div><div class="hit" data-f="pick">📂 Choose a folder…</div>' + (get() ? '<div class="hit" data-f="ws">🏠 Use its own workspace</div>' : ''));
      pp.onclick = async e => { const h = e.target.closest('[data-f]'); if (!h) return; A.closePop(); if (h.dataset.f === 'ws') put(''); else { const p = await pickFolder(); if (!p) return; put(p); } dirLine(); later(); };
    };
    $('agcreach').onclick = () => { $('agguard').checked = !$('agguard').checked; lsPut(GKEY, $('agguard').checked ? '1' : ''); chips(); later(); };

    /* ---------- a reference picture: paste one into the box, or pick one ----------
       It travels with the message and is kept in the session folder, so the agent can look at it (a model that can
       see pictures) and use the file itself (any model). It is shrunk to 1400 px so a phone photo is not 40 MB. */
    let shot = null;
    const shotEnd = () => { if (shot && shot.url) URL.revokeObjectURL(shot.url); shot = null; const box = $('agshot'), f = $('agfile'); if (box) box.style.display = 'none'; if (f) f.value = ''; };
    function shotShow() {
      const box = $('agshot'); if (!box || !shot) return;
      $('agshotimg').src = shot.url; $('agshotname').textContent = shot.name + ' · ' + Math.max(1, Math.round(shot.bytes / 1024)) + ' KB';
      box.style.display = 'flex';
    }
    function shotTake(file) {
      if (!file) return;
      if (!/^image\//.test(String(file.type || ''))) { A.toast('That is not a picture.'); return; }
      if (file.size > 24 * 1048576) { A.toast('That picture is too large (24 MB at most).'); return; }
      const img = new Image(), url = URL.createObjectURL(file);
      img.onload = () => {
        const max = 1400, sc = Math.min(1, max / Math.max(img.width || 1, img.height || 1));
        const w = Math.max(1, Math.round((img.width || 1) * sc)), h = Math.max(1, Math.round((img.height || 1) * sc));
        let out = '';
        try {
          const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
          const cx = cv.getContext('2d'); cx.fillStyle = '#fff'; cx.fillRect(0, 0, w, h); cx.drawImage(img, 0, 0, w, h);   // a PNG's see-through parts become white, not black
          out = cv.toDataURL('image/jpeg', 0.86);
        } catch (e) { out = ''; }
        URL.revokeObjectURL(url);
        if (!out) { A.toast('That picture could not be read.'); return; }
        if (shot && shot.url) URL.revokeObjectURL(shot.url);
        shot = { name: String(file.name || 'picture').replace(/\.[^.]+$/, '') + '.jpg', mime: 'image/jpeg', data: out.split(',')[1] || '', url: out, bytes: Math.round(out.length * 0.75) };
        if (!shot.data) { shot = null; A.toast('That picture could not be read.'); return; }
        shotShow(); if ($('hin')) $('hin').focus();
      };
      img.onerror = () => { URL.revokeObjectURL(url); A.toast('That picture could not be read.'); };
      img.src = url;
    }
    $('agphoto').onclick = () => $('agfile').click();
    $('agfile').onchange = e => shotTake(e.target.files && e.target.files[0]);
    $('agshotx').onclick = e => { e.preventDefault(); shotEnd(); };
    $('hin').addEventListener('paste', e => {
      const items = (e.clipboardData && e.clipboardData.items) || [];
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        if (it.kind === 'file' && /^image\//.test(String(it.type || ''))) {
          const f = it.getAsFile(); if (!f) continue;
          e.preventDefault(); shotTake(f); return;
        }
      }
    });
    $('hcomp').addEventListener('dragover', e => { const t2 = e.dataTransfer && e.dataTransfer.types; if (t2 && [...t2].indexOf('Files') >= 0) e.preventDefault(); });
    $('hcomp').addEventListener('drop', e => {
      const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]; if (!f) return;
      if (!/^image\//.test(String(f.type || ''))) return;
      e.preventDefault(); shotTake(f);
    });

    /* ---------- the pages of the main column: the live conversation, an earlier one, a routine running, routines, settings ---------- */
    let seq = 0, starting = false, view = 'live', recId = '', rec = null, rseq = 0, SESS = [], RT = null, rform = null, NS = 0;
    const timers = [];
    b._cleanup = () => { alive = false; timers.forEach(clearInterval); ro && ro.disconnect(); if (shot && shot.url) URL.revokeObjectURL(shot.url); };
    function show(v, opts) {
      view = v; opts = opts || {};
      const conv = v === 'live' || v === 'rec' || v === 'rlive';
      $('hconv').style.display = conv ? '' : 'none'; $('hcomp').style.display = v === 'live' || v === 'rec' ? '' : 'none';
      $('agset').style.display = v === 'set' ? '' : 'none'; $('agrout').style.display = v === 'routines' ? '' : 'none';
      $('hset').classList.toggle('on', v === 'set'); $('agrbtn').classList.toggle('on', v === 'routines');
      if (v === 'routines') { drawRoutines(); post('/api/routines/seen', {}).then(loadRoutines); }
      if (!opts.keep && conv) $('hmsgs').innerHTML = '';
      if (narrow()) $('agx').classList.remove('sideopen');
      head(); drawList();
    }
    $('hset').onclick = () => show(view === 'set' ? 'live' : 'set'); $('hback').onclick = () => show('live');
    $('agrbtn').onclick = () => show('routines');
    const nearEnd = () => { const c = $('hconv'); return c.scrollHeight - c.scrollTop - c.clientHeight < 140; };
    const toEnd = () => { const c = $('hconv'); c.scrollTop = c.scrollHeight; };

    /* ---------- one event of an agent conversation ---------- */
    const arg = (name, i) => {
      i = i || {};
      if (name === 'Bash' || name === 'run_command') return String(i.command || (i.why ? i.why : ''));
      const at = i.file_path || i.path || i.from;
      if (at) return String(at) + (i.to ? '  →  ' + String(i.to) : '');
      if (i.pattern) return String(i.pattern) + (i.path ? '  in ' + i.path : '');
      if (i.url) return String(i.url);
      if (i.command) return String(i.command);
      return JSON.stringify(i).slice(0, 4000);
    };
    const PLAIN = { Bash: 'It wants to run this command on your PC:', Write: 'It wants to create this file, or replace it if it exists:', Edit: 'It wants to change this file:', Read: 'It wants to read this file:', Glob: 'It wants to look for files named like this:', Grep: 'It wants to search inside files for this:' };
    const note = t => '<div class="agnote">' + esc(t) + '</div>';
    function draw(e, box, ro2) {
      const el = document.createElement('div'); el.dataset.seq = e.seq;
      if (e.kind === 'user') el.innerHTML = '<div class="aguser">' + esc(e.text) + '</div>' + (e.photo ? '<div class="agshotline">🖼 ' + esc(e.photo) + '</div>' : '');
      else if (e.kind === 'text') el.innerHTML = '<div class="agtext">' + mdx(e.text) + '</div>';
      /* a step the agent took: one line to read the gist, click it to open the whole command, file and answer, click again to put it away */
      else if (e.kind === 'tool') {
        el.dataset.tool = e.toolId || ''; el.className = 'agtool';
        const a = arg(e.name, e.input), flat = a.replace(/\s+/g, ' ').trim(), short = flat.length > 110 ? flat.slice(0, 110) + '…' : flat;
        const whole = a.length > short.replace(/…$/, '').length || /\n/.test(a);       // there is more than the one line shows
        const wrote = (e.name === 'Write' || e.name === 'write_file') && e.input && e.input.content ? String(e.input.content) : '';
        const inp = e.input || {};
        const diff = inp.old_string || inp.new_string || inp.find || inp.replace ? { del: String(inp.old_string || inp.find || ''), add: String(inp.new_string || inp.replace || '') } : null;
        const many = Array.isArray(inp.edits) && inp.edits.length ? inp.edits : null;
        el.innerHTML = '<details class="agstep"><summary class="agth" title="Click to read the whole step"><span class="agdot"></span><b>' + esc(e.name) + '</b>' +
          (short ? '<span class="agarg">(' + esc(short) + ')</span>' : '') + '<span class="agpeek"></span></summary>' +
          '<div class="agbody">' +
            (whole ? '<pre class="agfull">' + esc(a) + '</pre>' : '') +
            (wrote ? '<div class="small mute">Wrote ' + wrote.split('\n').length + ' lines:</div><pre>' + esc(wrote) + '</pre>' : '') +
            (diff ? '<pre class="agdiff"><span class="del">' + esc(diff.del.split('\n').map(l => '- ' + l).join('\n')) + '</span>\n<span class="add">' + esc(diff.add.split('\n').map(l => '+ ' + l).join('\n')) + '</span></pre>' : '') +
            (many ? '<div class="small mute">' + many.length + ' changes:</div><pre class="agdiff">' + many.map(x => '<span class="del">' + esc(String((x && x.find) || '').split('\n').map(l => '- ' + l).join('\n')) + '</span>\n<span class="add">' + esc(String((x && x.replace) || '').split('\n').map(l => '+ ' + l).join('\n')) + '</span>').join('\n') + '</pre>' : '') +
            '<div data-res></div>' +
          '</div></details>';
      }
      else if (e.kind === 'result') {
        const host = [...box.querySelectorAll('[data-tool]')].reverse().find(x => x.dataset.tool === String(e.toolId || '')), t = String(e.text || '').trim();
        const lines = t ? t.split('\n') : [], first = lines[0] || '';
        const html = '<div class="agres">' + (t ? '<pre>' + esc(t) + '</pre>' : '<div class="mute">⎿  (no output)</div>') + '</div>';
        if (host) {
          host.classList.add(e.isError ? 'bad' : 'ok');
          const r = host.querySelector('[data-res]'); if (r) r.innerHTML = html;
          /* the closed line still says what came back, and a failure opens itself so it is not missed */
          const pk = host.querySelector('.agpeek');
          if (pk) pk.textContent = '⎿  ' + ((first.length > 80 ? first.slice(0, 80) + '…' : first) || 'nothing') + (lines.length > 1 ? '  (+' + (lines.length - 1) + ' lines)' : '');
          if (e.isError) { const d = host.querySelector('details.agstep'); if (d) d.open = true; }
          return;
        }
        el.innerHTML = html;
      }
      /* the permission question: what will happen in plain words, the exact command or file, and Refuse as the highlighted, safe choice */
      else if (e.kind === 'ask') {
        el.dataset.ask = e.id;
        el.innerHTML = '<div class="agask"><div class="agaskh">✋ Allow <b>' + esc(e.tool) + '</b>?</div><div>' + esc(PLAIN[e.tool] || ('It wants to use the tool “' + e.tool + '”:')) + '</div><pre>' + esc(arg(e.tool, e.input)) + '</pre>' +
          (ro2 ? '<div class="small mute" data-askmsg>Waiting for an answer.</div>' : '<div class="row" style="gap:8px;align-items:center;flex-wrap:wrap"><button class="pri" data-refuse="' + esc(e.id) + '" title="Nothing is changed. The agent is told no and carries on another way.">Refuse (safe choice)</button><button class="ib askallow" data-allow="' + esc(e.id) + '" title="The agent does this one thing. It asks again for the next one.">Allow this once</button><span class="small mute" data-askmsg style="flex:1;min-width:200px">Not sure? Refuse. Nothing is changed, and you can ask the agent what the command does. No answer in 30 minutes counts as Refuse.</span></div>') + '</div>';
      }
      else if (e.kind === 'answer') {
        const card = box.querySelector('[data-ask="' + String(e.id).replace(/"/g, '') + '"]');
        if (card) { card.querySelectorAll('button').forEach(x => x.remove()); const m = card.querySelector('[data-askmsg]'); if (m) m.textContent = e.allow ? '✅ You allowed it.' : e.unattended ? '🛑 Refused by itself: nobody was at the PC (a routine).' : e.late ? '🛑 Nobody answered in time, so it was refused.' : '🛑 You refused it.'; }
        return;
      }
      else if (e.kind === 'started') el.innerHTML = note((e.resumed ? 'Picked up again' : 'Session started') + ' · ' + bare(e.model) + ' · ' + Math.round((e.ctx || 0) / 1024) + 'k memory · ' + (e.guard ? 'whole PC, guarded' : 'this folder only') + ' · ' + (e.dir || ''));
      /* Moundshroud Code's own notes: a fresh start before the memory fills, a long job still going, a slower fallback */
      else if (e.kind === 'note') el.innerHTML = note('ℹ ' + String(e.text || ''));
      else if (e.kind === 'stopped') el.innerHTML = note('Stopped. Type a message, or press Continue, to pick it up again.');
      else if (e.kind === 'error') el.innerHTML = '<div class="agerr">' + esc(e.text) + '</div>';
      else if (e.kind === 'done') { if (e.ok || !e.text) return; el.innerHTML = '<div class="agerr">' + esc(e.text) + '</div>'; }
      else return;
      box.appendChild(el);
    }
    /* what is happening right now, at the foot of the conversation: the words as they arrive, then a spinner */
    const SPIN = ['✻', '✶', '✳', '✢', '·', '✢', '✳', '✶']; let spinI = 0;
    function liveFoot(s, box) {
      let live = box.querySelector('[data-live]'), sp = box.querySelector('[data-spin]');
      if (s && s.live) { if (!live) { live = document.createElement('div'); live.dataset.live = '1'; live.className = 'agtext aglive'; } box.appendChild(live); live.innerHTML = mdx(s.live); }
      else if (live) live.remove();
      const working = s && s.running && (s.busy || s.preparing) && !(s.pending && s.pending.length);
      if (working || (s && s.preparing)) { if (!sp) { sp = document.createElement('div'); sp.dataset.spin = '1'; sp.className = 'agspin'; } box.appendChild(sp); sp.textContent = SPIN[spinI++ % SPIN.length] + ' ' + (s.preparing ? 'Getting the model ready (the first time with a model takes a minute)…' : s.thinking ? 'Thinking…' : 'Working…'); }
      else if (sp) sp.remove();
    }
    function welcome() {
      return '<div class="agwel" data-welcome="1"><div class="aglogo">✻</div><h2>What should we build?</h2>' +
        '<div class="mute">The agent writes files and runs commands in one folder on this PC, and asks you before anything risky. Nothing leaves this PC.</div>' +
        '<div class="agex">' + EX.map(x => '<span class="chip" data-ex="' + esc(x) + '">' + esc(x) + '</span>').join('') + '</div>' +
        '<div class="small mute">Want it to do something by itself every day? <a href="#" data-goroutines="1">Set up a routine →</a></div></div>';
    }
    const EX = ['Make a snake game in one file called snake.html', 'Write a script that sorts the files in this folder by type', 'Read the files in this folder and explain what they do'];

    $('hmsgs').addEventListener('click', async ev => {
      const ex = ev.target.closest('[data-ex]'); if (ex) { $('hin').value = ex.dataset.ex; $('hin').focus(); return; }
      if (ev.target.closest('[data-goroutines]')) { ev.preventDefault(); show('routines'); return; }
      const a = ev.target.closest('[data-allow],[data-refuse]'); if (!a) return;
      const id = a.dataset.allow || a.dataset.refuse; a.parentElement.querySelectorAll('button').forEach(x => { x.disabled = true; });
      const r = await post('/api/harness/answer', { id, allow: !!a.dataset.allow }); if (!r.ok) A.toast(r.error || 'That question is no longer open.'); tick();
    });

    /* ---------- the header: which conversation this is, and what it is doing ---------- */
    function head() {
      const s = H || {}, T = $('agtitle'), sub = $('agsub'), line = $('hline');
      let title = 'New session', info = '', stat = '', k = '';
      if (view === 'live') {
        title = s.title || (s.sessionId ? 'Untitled session' : 'New session');
        info = s.sessionId || s.running ? [base(s.dir), bare(s.model), s.guard ? 'whole PC, guarded' : 'this folder only'].filter(Boolean).join(' · ') : 'Starts with: ' + [get() ? base(get()) : 'workspace', modelNow()].join(' · ');
        if (starting || s.preparing) { stat = 'Starting'; k = 'busy'; } else if (s.running) { stat = s.pending && s.pending.length ? 'Needs your answer' : s.busy ? (s.thinking ? 'Thinking' : 'Working') : 'Ready'; k = s.pending && s.pending.length ? 'ask' : s.busy ? 'busy' : 'ok'; } else if (s.sessionId) { stat = 'Not running'; k = 'off'; }
      } else if (view === 'rec' && rec) {
        title = rec.title || 'Untitled session'; info = [rec.routine ? '⏱ routine' : '', base(rec.dir), bare(rec.model), new Date(rec.at).toLocaleString()].filter(Boolean).join(' · ');
        stat = H && H.running && H.busy ? 'Another session is working' : 'Saved'; k = 'off';
      } else if (view === 'rlive') { const r = RT && RT.running; title = '⏱ ' + (r ? r.name : 'Routine'); info = 'Running by itself. Questions are refused automatically.'; stat = r ? 'Running' : 'Finished'; k = r ? 'busy' : 'off'; }
      else if (view === 'routines') { title = '⏱ Routines'; info = 'Tasks the agent does by itself on a schedule'; }
      else if (view === 'set') { title = '⚙ Agent settings'; }
      T.textContent = plain(title) || title; sub.textContent = info; line.textContent = stat; line.dataset.k = k;
      $('hstop').style.display = (view === 'live' && s.running) || (view === 'rlive' && RT && RT.running) ? '' : 'none';
      $('hcont').style.display = view === 'live' && !s.running && s.sessionId && !starting ? '' : 'none';
      $('hsend').disabled = view === 'live' && (starting || !!s.busy || !!s.preparing);
      $('hin').placeholder = view === 'rec' ? 'Type to pick this session up again…' : s.running ? 'Reply to the agent…' : 'Tell the agent what to build or fix…';
      $('hin').dataset.ph0 = $('hin').placeholder; anyHint();
    }

    /* ---------- the session list ---------- */
    async function loadList() { let r; try { r = await A.api('/api/harness/sessions'); } catch (e) { r = null; } if (!alive) return; SESS = (r && r.sessions) || []; drawList(); }
    async function loadRoutines() { let r; try { r = await A.api('/api/routines'); } catch (e) { r = null; } if (!alive || !r) return; const was = RT && RT.running; RT = r; $('agrbadge').textContent = r.unread ? String(r.unread) : ''; $('agrbadge').style.display = r.unread ? '' : 'none'; if (was && !r.running) loadList(); drawList(); if (view === 'routines' && !rform) drawRoutines(); if (view === 'rlive') head(); }
    function drawList() {
      const q = $('agsq').value.trim().toLowerCase(), box = $('aglist'), s = H || {};
      const rows = SESS.filter(x => !q || (String(x.title || '') + ' ' + (x.dir || '') + ' ' + (x.routine ? x.routine.name : '')).toLowerCase().includes(q));
      const liveListed = s.sessionId && SESS.some(x => x.id === s.sessionId);
      let html = '';
      if (RT && RT.running) html += '<div class="agrow' + (view === 'rlive' ? ' on' : '') + '" data-rlive="1"><div class="agrt"><span class="agdotlive"></span>⏱ ' + esc(RT.running.name) + '</div><div class="agrm">routine running now</div></div>';
      if (!liveListed && (s.running || s.title || (view === 'live' && !q))) html += '<div class="agrow' + (view === 'live' ? ' on' : '') + '" data-live="1"><div class="agrt">' + (s.running ? '<span class="agdotlive"></span>' : '') + esc(plain(s.title) || 'New session') + '</div><div class="agrm">' + esc(s.running ? 'running · ' + base(s.dir) : 'not started yet') + '</div></div>';
      const groups = [['Today', 0], ['Yesterday', 1], ['Previous 7 days', 7], ['Older', 1e9]], day0 = new Date(); day0.setHours(0, 0, 0, 0);
      const gOf = t => t >= day0.getTime() ? 0 : t >= day0.getTime() - 86400000 ? 1 : t >= day0.getTime() - 7 * 86400000 ? 2 : 3;
      groups.forEach((g, gi) => {
        const list = rows.filter(x => gOf(x.at) === gi); if (!list.length) return;
        html += '<div class="aggrp">' + g[0] + '</div>' + list.map(x => {
          const isLive = x.id === s.sessionId, on = (view === 'live' && isLive) || (view === 'rec' && recId === x.id);
          return '<div class="agrow' + (on ? ' on' : '') + '" data-sid="' + esc(x.id) + '" title="' + esc((x.title || '') + '\n' + (x.dir || '')) + '"><div class="agrt">' + (isLive && s.running ? '<span class="agdotlive"></span>' : '') + (x.routine ? '⏱ ' : '') + esc(plain(x.title) || 'Untitled') + '</div><div class="agrm">' + esc(base(x.dir)) + ' · ' + esc(ago(x.at)) + '</div><button class="agfx" data-forget="' + esc(x.id) + '" title="Forget this conversation">✕</button></div>';
        }).join('');
      });
      if (!html) html = '<div class="small mute" style="padding:10px">' + (q ? 'Nothing matches.' : 'No conversations yet. They are kept here once the agent has answered.') + '</div>';
      box.innerHTML = html;
    }
    $('agsq').oninput = drawList;
    $('aglist').onclick = async e => {
      const f = e.target.closest('[data-forget]');
      if (f) { e.stopPropagation(); if (f.dataset.forget === (H && H.sessionId) && H.running) return A.toast('That session is running. Stop it first.'); if (!(await A.confirm('Forget this conversation? It is removed from this list. Files it made are not touched.'))) return; await post('/api/harness/forget', { id: f.dataset.forget }); if (view === 'rec' && recId === f.dataset.forget) show('live'); loadList(); return; }
      const r = e.target.closest('.agrow'); if (!r) return;
      if (r.dataset.live) return openLive();
      if (r.dataset.rlive) return openRoutineLive();
      if (r.dataset.sid) return openRec(r.dataset.sid);
    };
    function openLive() { seq = 0; show('live'); tick().then(toEnd); }
    async function openRec(id) {
      if (H && id === H.sessionId) return openLive();
      let x; try { x = await A.api('/api/harness/record?id=' + encodeURIComponent(id)); } catch (e) { x = null; }
      if (!x || !x.ok) { A.toast((x && x.error) || 'Could not open that conversation.'); return loadList(); }
      rec = x.record; recId = id; show('rec');
      const box = $('hmsgs'); (rec.events || []).forEach(ev => draw(ev, box, true)); toEnd();
    }
    function openRoutineLive() { rseq = 0; show('rlive'); rtick().then(toEnd); }

    b._integrate = async request => {
      const current = await A.api('/api/harness/state').catch(() => null);
      if (!current) return { ok: false, error: 'Could not check whether the Agent is already working.' };
      if (current.running || current.preparing) return { ok: false, error: 'The Agent already has a conversation open. Finish or stop it first so this request does not interrupt that work.' };
      if (view !== 'live') show('live');
      await check();
      const ranked = toolModels().filter(m => !m.free), preferred = A.modelOrder && A.modelOrder.get();
      const m = (preferred && A.modelOrder ? ranked.find(x => A.modelOrder.matches(x, preferred)) : null) || ranked[0];
      if (!m) return { ok: false, error: 'There is no installed local model with tool support. Download one in Models, then try again. Repository contents are not sent to an online model.' };
      const cap = m.maxCtx || (st && st.ctxDefault) || 32768, contexts = ((st && st.ctx) || [32768]).filter(c => c <= cap);
      const ctx = contexts.includes(32768) ? 32768 : contexts[0] || (st && st.ctxDefault) || 32768;
      const r = await A.api('/api/refs/integrate', { slug: request.slug, target: request.target || '', notes: request.notes || '', model: m.name, ctx });
      if (r && r.ok) { seq = 0; H = null; await tick(); toEnd(); }
      return r || { ok: false, error: 'The integration did not start.' };
    };

    /* ---------- polling: the live session always (so the list and header stay right), a running routine when it is on screen ---------- */
    async function tick() {
      let s; try { s = await A.api('/api/harness/state?since=' + (view === 'live' ? seq : 1e12)); } catch (e) { return; }
      if (!alive || !s) return;
      const was = H; H = s;
      if (view === 'live') {
        if (s.seq < seq) { seq = 0; $('hmsgs').innerHTML = ''; return tick(); }      // the server began a new conversation
        const stick = nearEnd(), box = $('hmsgs');
        (s.events || []).forEach(e => draw(e, box, false)); seq = s.seq;
        const wel = box.querySelector('[data-welcome]'), blank = !s.sessionId && !s.running && !starting && !s.preparing && ![...box.children].some(c => !c.dataset.welcome);
        if (blank && !wel) box.insertAdjacentHTML('afterbegin', welcome()); else if (!blank && wel) wel.remove();
        liveFoot(s, box); if (stick) toEnd();
      }
      head();
      if (frame++ % 3 === 0) notesTick();      // a pull finishing, a craft run: lines that arrive after the command answered
      if (!was || was.sessionId !== s.sessionId || was.running !== s.running || was.title !== s.title || (was.busy && !s.busy)) loadList();
    }
    /* the lines a long command leaves behind once it has answered */
    let frame = 0;
    async function notesTick() {
      let r; try { r = await A.api('/api/harness/notes?since=' + NS); } catch (e) { return; }
      if (!alive || !r || !r.notes || !r.notes.length) return;
      r.notes.forEach(n => { NS = Math.max(NS, n.seq); say('<span class="mute">' + esc(n.text) + '</span>'); });
    }
    async function rtick() {
      if (view !== 'rlive') return;
      let s; try { s = await A.api('/api/routines/live?since=' + rseq); } catch (e) { return; }
      if (!alive || view !== 'rlive') return;
      const box = $('hmsgs');
      if (!s || s.none) { liveFoot(null, box); if (!box.querySelector('[data-rdone]')) box.insertAdjacentHTML('beforeend', '<div class="agnote" data-rdone="1">The routine has finished. Its conversation is in the list on the left, and its result is under Routines.</div>'); head(); return; }
      if (s.seq < rseq) { rseq = 0; box.innerHTML = ''; }
      const fin = box.querySelector('[data-rdone]'); if (fin) fin.remove();
      const stick = nearEnd(); (s.events || []).forEach(e => draw(e, box, true)); rseq = s.seq; liveFoot(s, box); if (stick) toEnd();
    }
    const begin = async resume => {
      if (starting) return false; starting = true; head();
      if (!resume) { seq = 0; $('hmsgs').innerHTML = ''; }
      const r = await post('/api/harness/start', { model: $('agmodel').value || '', ctx: +$('agctx').value || undefined, guard: $('agguard').checked, dir: get(), resume: resume || undefined });
      starting = false; if (!alive) return false;
      if (!r.ok) { A.toast('Could not start the agent: ' + (r.error || 'unknown problem')); head(); return false; }
      if (r.switched) await engineMoved(r.switched);
      if (!resume) seq = 0; await tick(); return true;
    };
    /* an old conversation made by another engine goes on in that engine, since only it can load the conversation */
    async function engineMoved(k) {
      A.toast('This conversation was made with ' + engName(k) + ', so it carries on there');
      await check();
    }
    const busyElsewhere = () => H && H.running && (H.busy || (H.pending && H.pending.length));
    $('hnew').onclick = async () => {
      if (busyElsewhere() && !(await A.confirm('The agent is still working on “' + (H.title || 'a session') + '”. Stop it and start a new session?'))) return;
      if (H && (H.running || H.sessionId || H.seq)) await post('/api/harness/clear');
      seq = 0; show('live'); await tick(); $('hin').focus();
    };
    $('hcont').onclick = () => { show('live', { keep: true }); begin(H && H.sessionId); };
    $('hstop').onclick = async () => { if (view === 'rlive') { await post('/api/routines/stop'); loadRoutines(); return; } await post('/api/harness/stop'); tick(); };
    async function sendNow() {
      const t = $('hin').value.trim(); if ((!t && !shot) || starting) return;
      if (t.startsWith('/')) { $('hin').value = ''; await cmd(t); return; }      // a command acts here, and is never sent to the model
      if (anyChosen()) return anyRun(anyChosen(), t);                             // a picture, voice, music, search or import model does its own job
      if (view === 'rec') {
        if (busyElsewhere() && !(await A.confirm('The agent is working on “' + (H.title || 'another session') + '”. Stop it and pick this one up instead?'))) return;
        const x = await post('/api/harness/show', { id: recId }); if (!x.ok) { A.toast(x.error || 'Could not open that conversation.'); return; }
        if (x.switched) await engineMoved(x.switched);
        seq = 0; show('live'); await tick();
        if (!(await begin(recId))) return;
      } else if (!H || !H.running) { if (!(await begin(H && H.sessionId ? H.sessionId : ''))) return; }
      const body = { text: t || 'Use this picture as the reference for this task.' };
      if (shot) body.photo = { name: shot.name, mime: shot.mime, data: shot.data };
      const r = await post('/api/harness/send', body);
      if (!r.ok) { A.toast(r.error || 'The message was not sent.'); return; }
      $('hin').value = ''; shotEnd(); await tick(); toEnd();
    }
    /* ---------- the commands the terminal window has, in this box ----------
       Everything that acts on the agent is here: /model, /chat, /code, /autonomy, /reach, /net, /think, /pull,
       /craft, /stats, /new, /stop, /dir, /help. They are answered here and never sent to the model. The terminal's
       own cosmetics (/theme, /color, /anim, /music) belong to the console and say so.                          */
    const CMD_HELP = [
      ['/model', 'the models this PC has · /model qwen switches'],
      ['/chat', 'talk only: it answers, it changes nothing'],
      ['/code', 'the coding agent, with its tools'],
      ['/autonomy', 'how strictly it asks · careful · normal · auto'],
      ['/pull', 'one GGUF model from Hugging Face · /pull user/repo[:Q4_K_M]'],
      ['/think', 'what the model works out, above its answer · on · off'],
      ['/net', 'internet access for it · /net on · /net off'],
      ['/reach', 'this folder only, or the whole PC · /reach pc'],
      ['/craft', 'study a website, app or game and rebuild it · Craft Anything'],
      ['/stats', 'what this session has done, and what it is driving'],
      ['/new', 'a fresh conversation'],
      ['/stop', 'stop the turn that is running'],
      ['/dir', 'the folder it works in · /dir C:\\work changes it'],
      ['/harness', 'the engine · /harness moundshroud · claude · jcode'],
      ['/scan', 'look on every drive for AI models, and list them by what they do'],
      ['/import', 'bring a model file into Ollama · /import qwen'],
      ['/find', 'search the folder by meaning with an embedding model · /find login check'],
      ['/help', 'this list'],
    ];
    async function cmd(line) {
      const parts = line.trim().split(/\s+/), c = String(parts.shift() || '').toLowerCase(), arg = parts.join(' ').trim();
      const on = !(arg === 'off' || arg === 'no' || arg === '0');
      const ctl = (what, value) => post('/api/harness/control', { cmd: what, value });
      const live = () => { const s = H || {}; return !!(s.running || s.sessionId); };
      const folder = () => (H && H.dir) || get() || 'its own workspace';

      if (c === '/help' || c === '?') {
        say('<b>Commands</b><div class="small" style="margin-top:4px">' + CMD_HELP.map(([k, d]) => '<div><b>' + esc(k) + '</b> <span class="mute">' + esc(d) + '</span></div>').join('') + '</div>' +
          '<div class="small mute" style="margin-top:6px">The terminal window also has /theme, /color, /anim and /music, which only change how the console itself is drawn.</div>');
        return;
      }
      if (c === '/model' || c === '/models') {
        const list = (st && st.models) || [];
        if (!list.length) { say('Ollama is not running, so there is no list to show.'); return; }
        if (!arg) {
          say('<b>Models on this PC</b><div class="small" style="margin-top:4px">' + list.map(m => (bare(m.name) === modelNow() ? '▸ ' : '· ') + esc(bare(m.name)) + (m.tools ? '' : ' <span class="mute">(chat only)</span>')).join('<br>') + '</div>' +
            '<div class="small mute" style="margin-top:6px">/model qwen switches. A session that is already running keeps the model it started with.</div>');
          return;
        }
        const want = arg.toLowerCase(), nat = isNative();
        const hit = list.filter(m => (m.tools || nat) && (bare(m.name).toLowerCase().includes(want) || m.name.toLowerCase() === want))[0];
        if (!hit) { say('There is no model like “' + esc(arg) + '” on this PC' + (nat ? '.' : ' that can use tools.') + ' /model lists them.'); return; }
        await pickModel(hit.name);
        say('Driving <b>' + esc(bare(hit.name)) + '</b>' + (live() && !nat ? ' — from the next session you start. The one running keeps its own until you stop it.' : '.'));
        return;
      }
      if (c === '/chat' || c === '/code') {
        const r = await ctl('mode', c === '/chat' ? 'chat' : 'code');
        say(r.ok ? (c === '/chat' ? 'Chat mode — it talks, and changes nothing.' : 'Code mode — the full agent, with its tools.') : esc(r.error || 'That did not work.'));
        return;
      }
      if (c === '/autonomy' || c === '/strict' || c === '/trust') {
        if (!arg) { say('Autonomy · ' + esc((H && H.autonomy) || 'normal') + ' — /autonomy careful · normal · auto'); return; }
        const lvl = arg.toLowerCase();
        if (!['careful', 'normal', 'auto'].includes(lvl)) { say('Use careful, normal or auto.'); return; }
        const r = await ctl('autonomy', lvl);
        say(r.ok ? 'Autonomy · ' + lvl + (lvl === 'careful' ? ' — it asks before every change.' : lvl === 'normal' ? ' — it asks before commands that change the PC.' : ' — it only asks when something is forbidden, and still never does the forbidden things.') : esc(r.error || 'That did not work.'));
        return;
      }
      if (c === '/net' || c === '/web') {
        if (!arg) { say('Internet · ' + ((H && H.web) ? 'on — it may read public pages and APIs' : 'off — nothing it does leaves this PC') + '   —   /net on · /net off'); return; }
        const r = await ctl('web', on);
        say(r.ok ? (on ? 'Internet on — it may read public pages and APIs, and still nothing on this PC.' : 'Internet off — nothing leaves this PC.') : esc(r.error || 'That did not work.'));
        return;
      }
      if (c === '/think' || c === '/thoughts') {
        if (!arg) { say('Thinking · ' + ((H && H.think) ? 'shown' : 'hidden') + '   —   /think on · /think off'); return; }
        const r = await ctl('think', on);
        say(r.ok ? (on ? 'Thinking shown — what it works out comes above its answer.' : 'Thinking hidden — only the answer is shown.') : esc(r.error || 'That did not work.'));
        return;
      }
      if (c === '/reach') {
        if (!arg) { say('Reach · ' + ($('agguard').checked ? 'the whole PC, still guarded' : 'this folder only') + '   —   /reach pc · /reach folder'); return; }
        const whole = /^(pc|whole|all|on|yes)$/.test(arg.toLowerCase());
        $('agguard').checked = whole; lsPut(GKEY, whole ? '1' : ''); chips();
        const r = live() ? await ctl('reach', whole) : { ok: true };
        say((whole ? 'Whole PC — it may read anywhere, and Windows, this app and your keys stay shut.' : 'This folder only — ' + esc(folder()) + '.') + (live() && r.ok ? ' In force now.' : live() && !r.ok ? ' ' + esc(r.error || '') : ' Used by the next session you start.'));
        return;
      }
      if (c === '/dir') {
        if (!arg) { say('Folder · ' + esc(folder()) + (get() ? '   (next session: ' + esc(get()) + ')' : '   (its own workspace)')); return; }
        put(arg); dirLine();
        say('Folder for the next session · ' + esc(arg) + (live() ? '. The one running keeps its own until you stop it.' : '.'));
        return;
      }
      if (c === '/new') { await $('hnew').onclick(); return; }
      if (c === '/stop') {
        if ($('hstop').style.display === 'none') { say('Nothing is running.'); return; }
        await $('hstop').onclick();
        return;
      }
      if (c === '/harness' || c === '/engine') {
        const want = arg.toLowerCase(), k = /moun|native|mcode|built/.test(want) ? 'native' : /claude/.test(want) ? 'claude' : /jcode/.test(want) ? 'jcode' : '';
        if (!k) { say('Engine · <b>' + esc(engName((st && st.harness) || 'claude')) + '</b>   —   /harness moundshroud · /harness claude · /harness jcode'); return; }
        await switchEngine(k); return;
      }
      if (c === '/scan') {
        if (!A.anyModel) { say('The model list is not loaded.'); return; }
        say('Looking on every drive for AI models · it takes up to half a minute…');
        const cat = await A.anyModel.list(true); await addAnyModels();
        const by = {}; (cat.models || []).forEach(m => { by[m.useLabel] = (by[m.useLabel] || 0) + 1; });
        say('<b>' + (cat.models || []).length + ' AI models on this PC</b><div class="small" style="margin-top:4px">' + Object.keys(by).map(k => '<div>' + esc(k) + ' · ' + by[k] + '</div>').join('') + '</div><div class="small mute" style="margin-top:6px">Every one is in the model chip under the box.</div>');
        return;
      }
      if (c === '/import' || c === '/find') {
        if (!A.anyModel) { say('The model list is not loaded.'); return; }
        const cat = await A.anyModel.list();
        if (c === '/import') {
          const files = (cat.models || []).filter(m => m.use === 'import');
          if (!arg) { say(files.length ? '<b>Model files Ollama can take</b><div class="small" style="margin-top:4px">' + files.map(m => '<div>· ' + esc(m.name) + ' <span class="mute">' + esc(m.source || '') + '</span></div>').join('') + '</div><div class="small mute" style="margin-top:6px">/import qwen brings one in.</div>' : 'There are no model files left for Ollama to take. /scan looks again.'); return; }
          const hit = files.find(m => m.name.toLowerCase().includes(arg.toLowerCase()));
          if (!hit) { say('There is no model file like “' + esc(arg) + '”. /import lists them.'); return; }
          return anyRun(A.anyModel.valueOf(hit), arg);
        }
        if (!arg) { say('Search the folder by meaning · /find where the settings are saved'); return; }
        const cur = anyChosen() && A.anyModel.entry(anyChosen()), em = cur && cur.use === 'find' ? cur : (cat.models || []).find(m => m.use === 'find');
        if (!em) { say('There is no embedding model in Ollama. /import lists the files Ollama can take, or /pull nomic-ai/nomic-embed-text-v1.5-GGUF gets one.'); return; }
        return anyRun(A.anyModel.valueOf(em), arg);
      }
      if (c === '/pull' || c === '/hf') {
        if (!arg) { say('Pull a GGUF model from Hugging Face · /pull user/repo  ·  /pull user/repo:Q4_K_M  ·  add :smallest for the littlest file'); return; }
        const r = await post('/api/harness/pull', { spec: arg });
        say(esc(r.note || r.error || 'Started.'));
        return;
      }
      if (c === '/craft' || c === '/craft-anything') {
        say(arg ? '<span class="mute">craft anything · ' + esc(arg) + ' — running…</span>' : '<span class="mute">craft anything — checking the install…</span>');
        const r = await post('/api/harness/craft', { args: arg });
        if (!r.ok && !r.text) { say(esc(r.error || 'Craft Anything did not run.')); return; }
        const body = String(r.text || '').split('\n').slice(0, 24).join('\n');
        say('<b>craft anything' + (arg ? ' · ' + esc(arg) : '') + '</b>' + (body ? '<pre style="white-space:pre-wrap;margin:6px 0 0;max-height:340px;overflow:auto">' + esc(body) + '</pre>' : ''));
        return;
      }
      if (c === '/stats' || c === '/usage' || c === '/about') {
        const s = H || {}, tools = {};
        [...$('hmsgs').querySelectorAll('.agtool b')].forEach(b => { const n = b.textContent || '?'; tools[n] = (tools[n] || 0) + 1; });
        const calls = Object.values(tools).reduce((a, b) => a + b, 0);
        say('<b>This session</b><div class="small" style="margin-top:4px">' +
          esc(s.sessionId ? 'id ' + s.sessionId : 'not started yet') + '<br>' +
          'driving ' + esc(bare(s.model || modelNow())) + ' · ' + Math.round((s.ctx || 0) / 1024) + 'k memory · ' + (s.guard ? 'whole PC, guarded' : 'this folder only') + '<br>' +
          calls + ' tool call' + (calls === 1 ? '' : 's') + (calls ? ' · ' + esc(Object.entries(tools).map(([k, v]) => k + ' ' + v).join(', ')) : '') + '<br>' +
          'folder ' + esc(folder()) + '</div>');
        return;
      }
      if (['/theme', '/color', '/colour', '/anim', '/ui', '/music', '/quit', '/exit'].includes(c)) {
        say('<b>' + esc(c) + '</b> is the terminal window’s own — the palette, the glow and the music belong to that console. ' +
          (c === '/quit' || c === '/exit' ? 'There is nothing to quit here: the session keeps running until you stop it or start a new one.' : '/help lists the commands that work here.'));
        return;
      }
      say('No such command. /help lists them.');
    }

    $('hsend').onclick = sendNow;
    $('hin').addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); sendNow(); } });

    /* ---------- routines ---------- */
    const hm = s => String(s.h).padStart(2, '0') + ':' + String(s.m).padStart(2, '0');
    function drawRoutines() {
      const box = $('agrout'); if (!box) return;
      if (!RT) { box.innerHTML = '<div class="mute small">Loading…</div>'; return; }
      if (rform) return drawForm();
      const R = RT, runs = (R.runs || []).slice(0, 15);
      let h = '<div class="agrwrap"><div class="row" style="align-items:center;gap:8px;margin-bottom:6px"><h2 style="margin:0;flex:1">⏱ Routines</h2><button class="pri" data-rnew="1">＋ New routine</button></div>' +
        '<div class="small mute" style="margin-bottom:12px">The agent does a task by itself at the times you choose, then leaves a short result here and on Today. Nobody is there to approve anything, so a routine can only do what needs no approval: read, search, list, check, and write in its own folder. Anything risky is refused automatically. If Moundshroud is closed at that time, the tray helper opens it in the background for the routine.</div>';
      if (R.running) h += '<div class="card agrrun"><span class="agdotlive"></span><b>' + esc(R.running.name) + '</b> is running now (' + esc(ago(R.running.at)) + ') <span style="flex:1"></span><button class="ib" data-rwatch="1">Watch</button><button class="ib dang" data-rstop="1">■ Stop</button></div>';
      h += '<h3 class="agrh">Results</h3>' + (runs.length ? runs.map(x => '<div class="card agrres' + (x.seen ? '' : ' new') + '"><div class="row" style="gap:8px;align-items:baseline"><span>' + (x.skipped ? '⏭' : x.ok ? '✅' : '⚠️') + '</span><b style="flex:1">' + esc(x.name) + '</b><span class="small mute">' + esc(new Date(x.at).toLocaleString()) + (x.why === 'manual' ? ' · run by you' : '') + '</span></div><div class="agrsum small">' + mdx(x.summary || '') + '</div>' + (x.session ? '<button class="ib" data-ropen="' + esc(x.session) + '">Open the conversation</button>' : '') + '</div>').join('') : '<div class="small mute">Nothing yet. Results appear here after a routine runs.</div>');
      h += '<h3 class="agrh">Your routines</h3>' + (R.routines.length ? R.routines.map(r => '<div class="card agrcard"><div class="row" style="gap:8px;align-items:center;flex-wrap:wrap"><b style="flex:1;min-width:160px">' + esc(r.name) + '</b><label class="chk small"><input type="checkbox" data-ron="' + esc(r.id) + '"' + (r.on ? ' checked' : '') + '> On</label><button class="ib" data-rrun="' + esc(r.id) + '"' + (R.running ? ' disabled' : '') + '>▶ Run now</button><button class="ib" data-redit="' + esc(r.id) + '">Edit</button><button class="ib" data-rdel="' + esc(r.id) + '">Delete</button></div>' +
        '<div class="small mute" style="margin-top:4px">' + esc(r.when) + ' · 📁 ' + esc(r.dir ? base(r.dir) : 'workspace') + ' · 🧠 ' + esc(bare(r.model) || 'default model') + (r.on && r.next ? ' · next ' + esc(new Date(r.next).toLocaleString(undefined, { weekday: 'short', hour: '2-digit', minute: '2-digit' })) : r.on ? '' : ' · off') + '</div><div class="small agrprompt">' + esc(r.prompt) + '</div></div>').join('') : '<div class="small mute">None yet. Start from a suggestion below, or make your own.</div>');
      h += '<h3 class="agrh">Suggestions</h3><div class="agrsug">' + (R.suggestions || []).map(s => '<div class="card"><div style="font-size:22px">' + s.icon + '</div><b>' + esc(s.name) + '</b><div class="small mute" style="margin:4px 0">' + esc(s.why) + '</div><div class="small">' + esc(s.when) + '</div><button class="ib" data-rsug="' + esc(s.key) + '" style="margin-top:8px">＋ Add</button></div>').join('') + '</div></div>';
      box.innerHTML = h;
    }
    function drawForm() {
      const f = rform, s = f.sched, box = $('agrout'), list = toolModels();
      const kindSel = '<select id="rfk">' + [['daily', 'Every day'], ['weekdays', 'Weekdays (Mon to Fri)'], ['weekly', 'Once a week'], ['hours', 'Every few hours']].map(k => '<option value="' + k[0] + '"' + (s.kind === k[0] ? ' selected' : '') + '>' + k[1] + '</option>').join('') + '</select>';
      box.innerHTML = '<div class="agrwrap"><h2 style="margin:0 0 10px">' + (f.id ? 'Edit routine' : 'New routine') + '</h2><div class="card agrform">' +
        '<label>Name<input id="rfn" maxlength="80" value="' + esc(f.name) + '" placeholder="Check my scripts"></label>' +
        '<label>What should it do?<textarea id="rfp" rows="5" maxlength="4000" placeholder="Describe the task as you would tell the agent. It runs on its own, so ask it to write its findings to a file or end with a summary.">' + esc(f.prompt) + '</textarea></label>' +
        '<div class="row" style="gap:10px;flex-wrap:wrap;align-items:flex-end"><label>When' + kindSel + '</label>' +
        '<label id="rfdayw"' + (s.kind === 'weekly' ? '' : ' style="display:none"') + '>Day<select id="rfd">' + DAYS.map((d, i) => '<option value="' + i + '"' + (s.day === i ? ' selected' : '') + '>' + d + '</option>').join('') + '</select></label>' +
        '<label id="rfevw"' + (s.kind === 'hours' ? '' : ' style="display:none"') + '>Every<select id="rfe">' + [1, 2, 3, 4, 6, 8, 12].map(n => '<option value="' + n + '"' + (s.every === n ? ' selected' : '') + '>' + n + (n === 1 ? ' hour' : ' hours') + '</option>').join('') + '</select></label>' +
        '<label id="rftw">' + (s.kind === 'hours' ? 'Minute past' : 'Time') + '<input id="rft" type="time" value="' + hm(s) + '"></label></div>' +
        '<label>Folder it works in<div class="row" style="gap:6px"><input id="rfdir" value="' + esc(f.dir) + '" placeholder="Empty = the agent\'s own workspace folder" style="flex:1"><button class="ib" id="rfpick" type="button">Choose…</button></div></label>' +
        '<label>Model<select id="rfm">' + (list.length ? list.map(m => '<option value="' + esc(m.name) + '"' + ((f.model || $('agmodel').value) === m.name ? ' selected' : '') + '>' + esc(A.modelOrder ? A.modelOrder.label(m) : bare(m.name)) + '</option>').join('') : '<option value="">Default (' + esc(modelNow()) + ')</option>') + '</select></label>' +
        '<label class="chk" style="display:flex;gap:8px;align-items:flex-start"><input type="checkbox" id="rfg"' + (f.guard !== false ? ' checked' : '') + ' style="margin-top:3px"><span><b>Whole PC, guarded</b><div class="small mute">On (best for routines): it may read anywhere and run harmless commands such as listing files, git status and syntax checks. Off: it stays in its folder and cannot run any command, because nobody is there to approve one.</div></span></label>' +
        '<label class="chk"><input type="checkbox" id="rfon"' + (f.on !== false ? ' checked' : '') + '> Switched on</label>' +
        '<div class="row" style="gap:8px;margin-top:6px"><button class="pri" id="rfsave">Save routine</button><button class="ib" id="rfcancel">Cancel</button><span class="small mute" id="rfmsg"></span></div></div></div>';
      const q = id => box.querySelector('#' + id);
      q('rfk').onchange = () => { const k = q('rfk').value; q('rfdayw').style.display = k === 'weekly' ? '' : 'none'; q('rfevw').style.display = k === 'hours' ? '' : 'none'; q('rftw').firstChild.textContent = k === 'hours' ? 'Minute past' : 'Time'; };
      q('rfpick').onclick = async () => { const p = await pickFolder(); if (p) q('rfdir').value = p; };
      q('rfcancel').onclick = () => { rform = null; drawRoutines(); };
      q('rfsave').onclick = async () => {
        const [hh, mm] = String(q('rft').value || '08:00').split(':').map(Number);
        const r = { id: f.id || undefined, name: q('rfn').value.trim() || 'Routine', prompt: q('rfp').value.trim(), dir: q('rfdir').value.trim(), model: q('rfm').value, guard: q('rfg').checked, on: q('rfon').checked, sched: { kind: q('rfk').value, h: hh || 0, m: mm || 0, day: +q('rfd').value, every: +q('rfe').value } };
        if (!r.prompt) { q('rfmsg').textContent = 'Say what the routine should do.'; q('rfp').focus(); return; }
        const x = await post('/api/routines/save', { routine: r });
        if (!x.ok) { q('rfmsg').textContent = x.error || 'Could not save it.'; return; }
        rform = null; A.toast('Routine saved'); await loadRoutines(); drawRoutines();
      };
      q('rfn').focus();
    }
    $('agrout').addEventListener('click', async e => {
      const t = e.target.closest('button,input[data-ron]'); if (!t) return; const d = t.dataset;
      const findR = async id => RT.routines.find(r => r.id === id);
      if (d.rnew) { rform = { name: '', prompt: '', dir: get(), model: $('agmodel').value, guard: true, on: true, sched: { kind: 'daily', h: 8, m: 0, day: 1, every: 4 } }; drawRoutines(); }
      else if (d.rsug) { const s = RT.suggestions.find(x => x.key === d.rsug); rform = { name: s.name, prompt: s.prompt, dir: s.dir || get(), model: $('agmodel').value, guard: s.guard, on: true, sched: Object.assign({ day: 1, every: 4 }, s.sched) }; drawRoutines(); }
      else if (d.redit) { const r = findR(d.redit); if (r) { rform = JSON.parse(JSON.stringify(r)); drawRoutines(); } }
      else if (d.rdel) { const r = findR(d.rdel); if (r && (await A.confirm('Delete the routine “' + r.name + '”? Its past results stay in the list.'))) { await post('/api/routines/delete', { id: r.id }); loadRoutines(); } }
      else if (d.rrun) { const x = await post('/api/routines/run', { id: d.rrun }); if (!x.ok) A.toast(x.error || 'Could not start it.'); else { A.toast('Routine started'); await loadRoutines(); openRoutineLive(); } }
      else if (d.ron) { const r = findR(d.ron); if (r) { await post('/api/routines/save', { routine: Object.assign({}, r, { on: t.checked }) }); loadRoutines(); } }
      else if (d.rwatch) openRoutineLive();
      else if (d.rstop) { await post('/api/routines/stop'); loadRoutines(); }
      else if (d.ropen) openRec(d.ropen);
    });

    /* ---------- a narrow window: the session list slides over the conversation ---------- */
    const narrow = () => b.clientWidth < 760;
    $('agx').classList.add('sidehide'); // start collapsed by default when opening the app
    $('agtog').onclick = () => { if (narrow()) $('agx').classList.toggle('sideopen'); else $('agx').classList.toggle('sidehide'); };
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => $('agx').classList.toggle('narrow', narrow())) : null;
    if (ro) ro.observe(b); $('agx').classList.toggle('narrow', narrow());

    timers.push(setInterval(tick, 700), setInterval(() => { if (view === 'rlive') rtick(); }, 900), setInterval(loadRoutines, 5000), setInterval(loadList, 15000));
    loadList(); loadRoutines();
    if (A.on) A.on('default-model', () => { if (!alive || !b.isConnected) return; fillModels(true); if (view === 'routines') drawRoutines(); });
    if (wantView === 'routines') { wantView = ''; show('routines'); } else { show('live'); tick().then(toEnd); }
    b._onShow = () => { check(); if (wantView === 'routines') { wantView = ''; show('routines'); } };      // refresh models & harness whenever the Agent tab is opened
  }

  /* ---- the tabs of the Chat page: the normal chat, the agent, and the swarm (web/js/swarm.js) ---- */
  const panel = document.getElementById('p-chat'), bar = document.getElementById('chattabs');
  const PANES = { agent: { el: document.getElementById('agentpane'), draw: p => render(p) }, swarm: { el: document.getElementById('swarmpane'), draw: p => A.swarm && A.swarm.render(p) }, olympics: { el: document.getElementById('olympane'), draw: p => A.olympics && A.olympics.render(p) }, debate: { el: document.getElementById('debatepane'), draw: p => A.debate && A.debate.render(p) } };
  let mode = 'chat';
  /* the panes are made once and kept (like A.keep): switching between Chat, Agent and Swarm never loses a conversation,
     a running swarm or teams being edited */
  function tab(m) {
    if (!panel || !bar) return;
    mode = PANES[m] && PANES[m].el ? m : 'chat';
    Object.keys(PANES).forEach(k => { if (PANES[k].el) panel.classList.toggle('mode-' + k, mode === k); });
    bar.querySelectorAll('[data-ct]').forEach(x => x.classList.toggle('on', x.dataset.ct === mode));
    const P = PANES[mode]; if (!P || !P.el) return;
    if (!P.el._drawn || !P.el.firstChild) { P.el._drawn = true; P.draw(P.el); }
    else if (P.el._onShow) { try { P.el._onShow(); } catch (e) { } }
  }
  if (bar) bar.onclick = e => { const x = e.target.closest('[data-ct]'); if (x) tab(x.dataset.ct); };
  /* a new chat always lands on the normal chat */
  const newc = document.getElementById('newc'); if (newc) newc.addEventListener('click', () => { if (mode !== 'chat') tab('chat'); });
  const open = page => { wantView = page === 'routines' ? 'routines' : ''; A.showTab('chat'); tab('agent'); };

  const integrate = async request => { open(); const pane = PANES.agent.el; return pane && pane._integrate ? pane._integrate(request || {}) : { ok: false, error: 'The Agent could not open.' }; };
  A.agent = { render, tab, open, integrate, mode: () => mode };
  if (A.cmd && A.cmd.reg) A.cmd.reg([
    { title: 'Open the coding agent', sub: 'A free helper that builds and fixes code on this PC', icon: '🤖', group: 'Go to', tags: 'agent coding code program gemma qwen assistant developer build game', run: () => open() },
    { title: 'Agent routines', sub: 'Tasks the agent does by itself on a schedule, and their results', icon: '⏱', group: 'Go to', tags: 'agent routine schedule automatic daily task cron', run: () => open('routines') },
  ]);
})();

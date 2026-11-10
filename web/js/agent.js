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
    b.innerHTML = '<div class="scroll pad" style="flex:1"><div style="max-width:760px">' +
      '<h2>🤖 Agent</h2>' +
      '<div class="mute small" style="margin:2px 0 14px">A free coding helper that runs on this PC. Tell it what to build or fix; it reads, writes and edits files and runs commands. It uses a model in Ollama, so nothing leaves this PC.</div>' +
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
      '<div class="row" style="gap:8px;margin:14px 0;align-items:center"><button class="ib on" id="aggo" style="padding:9px 18px">Open the agent</button><span class="small mute" id="agmsg"></span></div>' +
      '<div class="card"><div style="font-weight:600;margin-bottom:6px">Good to know</div><ul class="small" style="margin:0;padding-left:18px;line-height:1.6">' +
      '<li><b>Good for:</b> small scripts, single-file projects and games, simple edits, explaining code.</li>' +
      '<li><b>Not good for:</b> big projects, careful debugging or long jobs left running unattended. These are small models: they can be confidently wrong and they forget after about 32,000 tokens.</li>' +
      '<li><b>Approvals:</b> read each command before you approve it. The guard catches known harmful commands; it cannot judge a command it has never seen, so those reach you as a question.</li>' +
      '<li><b>Safety:</b> point it at a folder you have backed up, not at your documents or this app.</li>' +
      '<li><b>First run:</b> its window asks you to pick a text style once. The first start with a model makes a copy of it with a longer memory, which takes a minute.</li>' +
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

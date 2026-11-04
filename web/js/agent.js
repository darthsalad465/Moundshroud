// Agent (Tools > Agent): opens the free coding agent that runs on this PC, a window of its own where you type what you want built or fixed.
// It is Claude Code's tools driven by the Gemma 4 model in Ollama, so nothing leaves this PC. This page only checks that it is
// set up, lets you pick the folder it works in, and opens it; the agent itself runs in its own window.
(() => {
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const KEY = 'agentdir';
  const get = () => { try { return localStorage.getItem(KEY) || ''; } catch (e) { return ''; } };
  const put = v => { try { if (v) localStorage.setItem(KEY, v); else localStorage.removeItem(KEY); } catch (e) { } };

  function render(b) {
    let alive = true; b._cleanup = () => { alive = false; };
    b.innerHTML = '<div class="scroll pad" style="flex:1"><div style="max-width:760px">' +
      '<h2>🤖 Agent</h2>' +
      '<div class="mute small" style="margin:2px 0 14px">A free coding helper that runs on this PC. Tell it what to build or fix; it reads, writes and edits files in one folder and runs commands that you approve. It uses the Gemma 4 model in Ollama, so nothing leaves this PC.</div>' +
      '<div class="card" id="agst"><div class="mute small">Checking...</div></div>' +
      '<div class="card" style="margin-top:10px"><div style="font-weight:600;margin-bottom:6px">Folder it works in</div>' +
      '<div class="small mute" id="agdir" style="word-break:break-all;margin-bottom:8px"></div>' +
      '<div class="row" style="gap:6px;flex-wrap:wrap"><button class="ib" id="agpick">Choose a folder...</button><button class="ib" id="agreset">Use its own workspace</button></div></div>' +
      '<div class="row" style="gap:8px;margin:14px 0;align-items:center"><button class="ib on" id="aggo" style="padding:9px 18px">Open the agent</button><span class="small mute" id="agmsg"></span></div>' +
      '<div class="card"><div style="font-weight:600;margin-bottom:6px">Good to know</div><ul class="small" style="margin:0;padding-left:18px;line-height:1.6">' +
      '<li><b>Good for:</b> small scripts, single-file projects and games, simple edits, explaining code.</li>' +
      '<li><b>Not good for:</b> big projects, careful debugging or long jobs left running unattended. It is a small model: it can be confidently wrong and it forgets after about 32,000 tokens.</li>' +
      '<li><b>Approvals:</b> it saves file edits on its own in its folder but asks before it runs a command. Read each command before you approve it.</li>' +
      '<li><b>Safety:</b> point it at a folder you have backed up, not at your documents or this app.</li>' +
      '<li><b>First run:</b> its window asks you to pick a text style once. If the model has never been made on this PC, the first start downloads it (about 6.6 GB).</li>' +
      '</ul></div></div></div>';
    const $ = id => b.querySelector('#' + id);
    const dirLine = () => { const d = get(); $('agdir').textContent = d || 'Its own workspace folder (inside the agent folder).'; $('agreset').style.display = d ? '' : 'none'; };
    dirLine();

    const row = (ok, text, hint) => '<div style="display:flex;gap:8px;align-items:baseline;margin:3px 0"><span style="width:18px">' + (ok ? '✅' : '⚠️') + '</span><div>' + esc(text) + (hint ? '<div class="small mute">' + esc(hint) + '</div>' : '') + '</div></div>';
    async function check() {
      let s; try { s = await A.api('/api/agent/status'); } catch (e) { s = null; }
      if (!alive) return; const box = $('agst'); if (!box) return;
      if (!s) { box.innerHTML = row(false, 'Could not check the agent', 'Moundshroud could not reach its own server.'); $('aggo').disabled = true; return; }
      box.innerHTML = row(s.installed, s.installed ? 'The agent is installed' : 'The agent is not installed on this PC', s.installed ? '' : 'Expected its launcher in ' + s.dir)
        + row(s.claude, s.claude ? 'Claude Code (its tools) is installed' : 'Claude Code is not installed', s.claude ? '' : 'The agent borrows its file and command tools.')
        + row(s.ollama, s.ollama ? 'Ollama is running' : 'Ollama is not running', s.ollama ? '' : 'The agent starts it for you when it opens.')
        + row(s.model, s.model ? 'The agent model is ready' : 'The agent model has not been made yet', s.model ? '' : 'The first start makes it, and downloads Gemma 4 (about 6.6 GB) if needed.');
      $('aggo').disabled = !s.installed || !s.claude;
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
      let r; try { r = await A.api('/api/agent/launch', { dir: get() }); } catch (e) { r = { ok: false, error: String(e.message || e) }; }
      if (!alive) return; btn.disabled = false;
      if (r && r.ok) { $('agmsg').textContent = ''; A.toast('Opened the agent in a new window'); }
      else { $('agmsg').textContent = ''; A.toast('Could not open the agent: ' + String((r && r.error) || 'unknown problem')); }
      check();
    };
  }

  A.agent = { render };
  if (A.cmd && A.cmd.reg) A.cmd.reg({ title: 'Open the coding agent', sub: 'A free helper that builds and fixes code on this PC', icon: '🤖', group: 'Go to', tags: 'agent coding code program gemma assistant developer build game', run: () => A.tools.go('agent') });
})();

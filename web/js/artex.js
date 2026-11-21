// Cyber > ARTEX: the AI autonomous penetration-testing system, shown inside Moundshroud. It runs on this PC
// (its own PostgreSQL + server) and thinks with your local Ollama models. This page starts it, shows its own
// screen in a frame, and stops it. ARTEX only tests systems you own or are authorised to test.
(() => {
  const esc = t => String(t == null ? '' : t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  let pollT = 0;

  function bar(st) {
    return '<div class="row" style="padding:7px 12px;gap:10px;border-bottom:1px solid var(--line);align-items:center;flex-wrap:wrap">' +
      '<b>🤖 ARTEX</b><span class="small mute">AI autonomous pentester, on this PC, using <b>' + esc(st.model || 'your local model') + '</b></span>' +
      (st.setupToken ? '<span class="small" style="color:var(--warn,#f5a524)">First time: open <b>Setup</b> in the frame and enter <code>' + esc(st.setupToken) + '</code> to set a password.</span>' : '') +
      '<span class="sp" style="flex:1"></span><button class="ib" id="axstop">■ Stop ARTEX</button></div>';
  }
  function frame(st) { return '<iframe id="axframe" src="' + esc(st.url) + '" style="flex:1;border:0;width:100%;background:#0b0e14" allow="clipboard-read; clipboard-write"></iframe>'; }

  function showRunning(wrap, st) {
    const have = wrap.querySelector('#axframe');
    if (!have) { wrap.innerHTML = bar(st) + frame(st); wrap.querySelector('#axstop').onclick = () => stop(wrap); }
    else { const b = wrap.querySelector('.row'); if (b) b.outerHTML = bar(st); const s = wrap.querySelector('#axstop'); if (s) s.onclick = () => stop(wrap); }
  }
  function starting(wrap) {
    wrap.innerHTML = '<div class="pad" style="margin:auto;max-width:460px;text-align:center"><div style="font-size:40px">🤖</div><h3>Starting ARTEX…</h3><p class="mute small">Bringing up its database and server on this PC. This takes a few seconds the first time.</p><div class="gmk-track" style="max-width:220px;margin:10px auto"><div style="width:40%;animation:none"></div></div></div>';
  }
  /* not installed: say exactly what is missing, offer to install it, and name antivirus as the culprit when it is one */
  function setup(st) {
    const missing = (st.missing || []).map(m => '<li>' + esc(m.label) + '</li>').join('');
    return (st.lastError ? '<div class="gmk-msg gmk-warn" style="margin:14px 0"><b>⚠ ' + esc(st.lastError) + '</b></div>' : '') +
      '<div class="gmk-msg gmk-warn" style="margin:14px 0">' +
      '<b>ARTEX is not installed on this PC yet.</b>' +
      (missing ? '<div class="small" style="margin-top:6px">Missing from <span class="mono">' + esc(st.dir || 'runtime/artex') + '</span>:<ul style="margin:4px 0 0 18px">' + missing + '</ul></div>' : '') +
      (st.quarantined ? '<div class="small" style="margin-top:8px"><b>Antivirus took artex.exe.</b> Windows Defender treats penetration-testing tools as hacking software and quarantines the file. Install it again, then add this folder as an exclusion in Windows Security → Virus &amp; threat protection → Manage settings → Exclusions, or run this in PowerShell as administrator:<div class="mono small" style="margin-top:4px;word-break:break-all">Add-MpPreference -ExclusionPath &quot;' + esc(st.dir || '') + '&quot;</div></div>' : '') +
      '<div class="small" style="margin-top:8px">Installing downloads the official ARTEX release, checks it against its published SHA-256, and unpacks it here. Your settings, skills and task history stay as they are.</div>' +
      '</div>' +
      '<div style="margin:12px 0"><button class="pri" id="axinstall" style="font-size:15px;padding:10px 18px">⬇ Install ARTEX</button> <span class="small mute" id="axnote">about 15 MB, one time</span></div>';
  }
  async function install(wrap) {
    const b = wrap.querySelector('#axinstall'), note = wrap.querySelector('#axnote');
    if (b) { b.disabled = true; b.textContent = '⬇ Installing…'; }
    if (note) note.textContent = 'downloading and checking…';
    let r = {};
    try { r = await A.api('/api/artex/install', {}); } catch (e) { r = { error: 'The install request failed: ' + e.message }; }
    const st = await A.api('/api/artex/status').catch(() => ({}));
    if (st && st.installed) { A.toast('ARTEX is installed. Press Start ARTEX.'); return idle(wrap, st); }
    idle(wrap, Object.assign(st || {}, { lastError: r.error || 'The install did not finish.' }));
  }
  function idle(wrap, st) {
    wrap.innerHTML = '<div class="scroll pad" style="flex:1"><div style="max-width:720px;margin:0 auto">' +
      '<h2 style="margin:4px 0">🤖 ARTEX</h2>' +
      '<p class="mute" style="line-height:1.55">ARTEX is an <b>AI autonomous penetration-testing system</b>. You give it a target you own or are allowed to test; it plans, runs real security tools, follows what it finds, and writes up the holes, all by itself. It runs entirely on this PC and thinks with your local models (now <b>' + esc(st.model || 'your local model') + '</b>).</p>' +
      (st.installed === false ? setup(st) :
        '<div style="margin:14px 0"><button class="pri" id="axgo" style="font-size:15px;padding:10px 18px">▶ Start ARTEX</button></div>') +
      '<div class="gmk-msg gmk-warn" style="margin-top:8px"><b>⚖ Only your own targets.</b> Scanning or attacking computers, sites or networks you do not own or have <b>written permission</b> to test is a crime in most countries. Practise on your own machines, your own lab, or authorised bug-bounty targets within their rules.</div>' +
      '</div></div>';
    const go = wrap.querySelector('#axgo'); if (go) go.onclick = async () => { starting(wrap); try { const currentModel = ls.get('model', ''); await A.api('/api/artex/start', { model: currentModel }); } catch (e) { } poll(wrap, 60); };
    const inst = wrap.querySelector('#axinstall'); if (inst) inst.onclick = () => install(wrap);
  }
  async function stop(wrap) { try { await A.api('/api/artex/stop', {}); } catch (e) { } const st = await A.api('/api/artex/status').catch(() => ({})); idle(wrap, st); }
  async function poll(wrap, tries) {
    clearTimeout(pollT);
    const st = await A.api('/api/artex/status').catch(() => ({}));
    if (st.up) return showRunning(wrap, st);
    if (tries <= 0) { idle(wrap, st); A.toast('ARTEX did not come up in time. Try Start again.'); return; }
    pollT = setTimeout(() => poll(wrap, tries - 1), 1200);
  }
  async function tick(el) {
    const wrap = el.querySelector('#axwrap'); if (!wrap) return;
    const st = await A.api('/api/artex/status').catch(() => ({}));
    if (st.up) showRunning(wrap, st); else if (st.starting) { starting(wrap); poll(wrap, 60); } else idle(wrap, st);
  }
  function render(el) {
    el.innerHTML = '<div id="axwrap" style="flex:1;min-height:0;display:flex;flex-direction:column"></div>';
    el._onShow = () => { const w = el.querySelector('#axwrap'); if (w && !w.querySelector('#axframe')) tick(el); };   // refresh only when ARTEX is not already showing, so its frame is not reloaded
    el._cleanup = () => clearTimeout(pollT);
    tick(el);
  }
  A.artex = { render, open: () => { try { A.cybertab.go('artex'); } catch (e) { } } };
})();

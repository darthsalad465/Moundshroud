// Cyber > ARTEX: the AI autonomous penetration-testing system, shown inside Moundshroud. It runs on this PC
// (its own PostgreSQL + server) and thinks with your local Ollama models. This page starts it, shows its own
// screen in a frame, and stops it. ARTEX only tests systems you own or are authorised to test.
(() => {
  const esc = t => String(t == null ? '' : t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  let pollT = 0;

  /* the frame is given the whole page, with a dark backdrop and a message until its page answers, so a slow or blank
     ARTEX screen is never just a white page with nothing on it */
  function css() {
    if (document.getElementById('axcss')) return;
    const s = document.createElement('style'); s.id = 'axcss';
    s.textContent = '#axwrap{flex:1;min-height:0;display:flex;flex-direction:column;position:relative}' +
      '#axpage{flex:1;min-height:0;display:flex;position:relative;background:#0b0e14}' +
      '#axframe{flex:1;width:100%;min-height:0;border:0;display:block;background:#0b0e14}' +
      '#axload{position:absolute;inset:0;z-index:2;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;padding:20px;text-align:center;background:#0b0e14;color:#9aa6c8;font:13px/1.5 system-ui,sans-serif}' +
      '#axload b{color:#e6ebff;font-size:15px}#axload.gone{display:none}' +
      '#axload .gmk-track{width:220px;max-width:60%}';
    document.head.appendChild(s);
  }
  function bar(st) {
    return '<div class="row" style="padding:7px 12px;gap:10px;border-bottom:1px solid var(--line);align-items:center;flex-wrap:wrap">' +
      '<b>🤖 ARTEX</b><span class="small mute">AI autonomous pentester, on this PC, using <b>' + esc(st.model || 'your local model') + '</b></span>' +
      (st.setupToken ? '<span class="small" style="color:var(--warn,#f5a524)">First time: open <b>Setup</b> in the frame and enter <code>' + esc(st.setupToken) + '</code> to set a password.</span>' : '') +
      '<span class="small mute" id="axhint" style="flex:1"></span>' +
      '<button class="ib" id="axreload" title="Load the ARTEX page again">⟳ Reload</button>' +
      '<button class="ib" id="axopen" title="Open ARTEX in its own browser window">↗ Open in a window</button>' +
      '<button class="ib" id="axstop">■ Stop ARTEX</button></div>';
  }
  function frame(st) {
    return '<div id="axpage">' +
      '<iframe id="axframe" src="' + esc(st.url) + '" allow="clipboard-read; clipboard-write" referrerpolicy="no-referrer"></iframe>' +
      '<div id="axload"><b>Opening ARTEX…</b><span>Its own screens are loading in the frame.</span><div class="gmk-track"><div style="width:40%;animation:none"></div></div></div>' +
      '</div>';
  }
  /* wire the bar and the frame for this run */
  function wire(wrap, st) {
    const fr = wrap.querySelector('#axframe'), load = wrap.querySelector('#axload'), hint = wrap.querySelector('#axhint');
    const say = t => { if (hint) hint.textContent = t; };
    /* wire each frame once: a load event fires even when the request failed, which is how a dead port became a white page */
    if (fr && !fr._axWired) {
      fr._axWired = true;
      let done = false;
      const ready = () => { done = true; if (load) load.classList.add('gone'); say(''); };
      fr.addEventListener('load', async () => {
        const s = await A.api('/api/artex/status').catch(() => null);
        if (s && !s.up) {
          if (load) {
            load.classList.remove('gone');
            load.innerHTML = '<b>ARTEX is not answering</b><span>Its port is closed, so this frame would stay blank. Press ⟳ Reload to start it again.</span>';
          }
          say('ARTEX stopped answering. Press ⟳ Reload.');
          return;
        }
        ready();
      });
      fr.addEventListener('error', () => say('The ARTEX page did not load. Press ⟳ Reload, or open it in its own window.'));
      setTimeout(() => {
        if (done) return;
        if (load) load.innerHTML = '<b>ARTEX is taking a while</b><span>If nothing appears, press ⟳ Reload or ↗ Open in a window. Its screen is a web app and may still be starting.</span>';
        say('ARTEX has not answered yet. Reload, or open it in its own window.');
      }, 20000);
    }
    const stopBtn = wrap.querySelector('#axstop'); if (stopBtn) stopBtn.onclick = () => stop(wrap);
    const re = wrap.querySelector('#axreload'); if (re) re.onclick = async () => {
      const s = await A.api('/api/artex/status').catch(() => null);
      if (s && !s.up) {   /* reload means "bring it back", not "reload a dead page" */
        if (load) load.innerHTML = '<b>Starting ARTEX again…</b><span>Its port was closed; the database and server are coming back up.</span>';
        await A.api('/api/artex/start', { model: ls.get('model', '') }).catch(() => null);
      }
      if (!fr) { const w = wrap.querySelector('#axwrap') || wrap; return; }
      if (load) { load.classList.remove('gone'); }
      fr.src = st.url;
      setTimeout(() => { if (fr && load && !load.classList.contains('gone')) say('Still nothing? Open it in its own window with ↗.'); }, 15000);
    };
    const op = wrap.querySelector('#axopen'); if (op) op.onclick = () => { try { const w = window.open(st.url, 'artex', 'noopener,width=1200,height=860'); if (!w) say('This browser blocked the window. Allow pop-ups for Moundshroud, or open ' + st.url + ' yourself.'); } catch (e) { say('Could not open a window: ' + e.message); } };
  }

  function showRunning(wrap, st) {
    css();
    const have = wrap.querySelector('#axframe');
    if (!have) { wrap.innerHTML = bar(st) + frame(st); }
    else { const b = wrap.querySelector('.row'); if (b) b.outerHTML = bar(st); }
    wire(wrap, st);
  }
  function starting(wrap) {
    wrap.innerHTML = '<div class="pad" style="margin:auto;max-width:460px;text-align:center"><div style="font-size:40px">🤖</div><h3>Starting ARTEX…</h3><p class="mute small">Bringing up its database and server on this PC. This takes a few seconds, and longer the first time.</p><div class="gmk-track" style="max-width:220px;margin:10px auto"><div style="width:40%;animation:none"></div></div><p class="mute small" style="margin-top:10px">If it does not come up, the reason will be shown here with its own log line.</p></div>';
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
    /* a start that fails says why instead of spinning for a minute and then going quiet */
    const go = wrap.querySelector('#axgo');
    if (go) go.onclick = async () => {
      starting(wrap);
      let r = {};
      try { r = await A.api('/api/artex/start', { model: ls.get('model', '') }); } catch (e) { r = { error: 'Moundshroud could not be reached: ' + e.message }; }
      if (r && (r.error || r.ok === false)) {
        const st2 = await A.api('/api/artex/status').catch(() => ({}));
        return idle(wrap, Object.assign(st2 || {}, { lastError: r.error || 'ARTEX did not start.' }));
      }
      poll(wrap, 60);
    };
    const inst = wrap.querySelector('#axinstall'); if (inst) inst.onclick = () => install(wrap);
  }
  async function stop(wrap) { try { await A.api('/api/artex/stop', {}); } catch (e) { } const st = await A.api('/api/artex/status').catch(() => ({})); idle(wrap, st); }
  async function poll(wrap, tries) {
    clearTimeout(pollT);
    const st = await A.api('/api/artex/status').catch(() => ({}));
    if (st.up) return showRunning(wrap, st);
    if (tries <= 0) { idle(wrap, Object.assign(st || {}, { lastError: (st && st.lastError) || 'ARTEX did not come up in time. Press Start again, or check its log in runtime/artex/artex.err.' })); return; }
    pollT = setTimeout(() => poll(wrap, tries - 1), 1200);
  }
  async function tick(el) {
    const wrap = el.querySelector('#axwrap'); if (!wrap) return;
    const st = await A.api('/api/artex/status').catch(() => ({}));
    if (st.up) return showRunning(wrap, st);
    if (st.starting) { starting(wrap); return poll(wrap, 60); }
    /* opening the page starts ARTEX: an iframe pointed at a port that is not listening is just a white screen */
    if (st.installed && !el._axAuto) {
      el._axAuto = true;
      starting(wrap);
      const r = await A.api('/api/artex/start', { model: ls.get('model', '') }).catch(e => ({ error: 'Moundshroud could not be reached: ' + e.message }));
      if (r && (r.error || r.ok === false)) { el._axAuto = false; return idle(wrap, Object.assign({}, st, { lastError: r.error || 'ARTEX did not start.' })); }
      return poll(wrap, 60);
    }
    idle(wrap, Object.assign({}, st, { lastError: st.installed ? (st.lastError || 'ARTEX is not running. Press Start ARTEX.') : st.lastError }));
  }
  function render(el) {
    css();
    el.innerHTML = '<div id="axwrap"></div>';
    el._onShow = () => { el._axAuto = false; tick(el); };   // check every time the page is shown: a stopped ARTEX is started, a live one keeps its frame
    el._cleanup = () => clearTimeout(pollT);
    tick(el);
  }
  A.artex = { render, open: () => { try { A.cybertab.go('artex'); } catch (e) { } } };
})();

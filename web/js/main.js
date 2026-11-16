// Start-up and global wiring.
(() => {
  /* tabs in the order shown */
  ['chat', 'lib', 'files', 'notes', 'study', 'lang', 'tools', 'health', 'guide'].forEach(n => { if (!A.tabs[n]) return; });
  const wanted = ['home', 'news', 'chat', 'web', 'cal', 'lib', 'files', 'notes', 'mail', 'docs', 'offed', 'calc', 'scan', 'meet', 'rem', 'clip', 'study', 'lang', 'writing', 'practice', 'teach', 'sky', 'lab', 'studio', 'cyber', 'tools', 'health', 'kitchen', 'garden', 'money', 'journal', 'albums', 'play', 'music', 'radio', 'tv', 'photos', 'faith', 'map', 'guide', 'appedit'];
  A.order = wanted.filter(n => A.tabs[n]);
  A.buildNav(); A.showTab('home');                       // Moundshroud opens on Today
  /* the logo in the top left corner goes to Today (the home page) */
  const logoMark = document.querySelector('header svg.mark'); if (logoMark) { logoMark.style.cursor = 'pointer'; logoMark.setAttribute('role', 'button'); logoMark.setAttribute('tabindex', '0'); logoMark.setAttribute('title', 'Go to Today'); logoMark.addEventListener('click', () => A.showTab('home')); logoMark.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); A.showTab('home'); } }); }
  /* coming back from the Godot editor page (web/godot-editor.html): straight to Studio with that game open */
  try { const gp = new URLSearchParams(location.search); if (gp.get('go') === 'studio-godot' && A.studio) { A.studio.reopenGodot = (gp.get('p') || '').slice(0, 80); history.replaceState(null, '', '/'); A.studio.go('godot'); } } catch (e) { }

  /* history popover */
  const hb = document.createElement('button'); hb.className = 'ib'; hb.id = 'hist'; hb.innerHTML = '&#128340;'; hb.title = 'Chat history'; hb.dataset.pop = '1';
  $('newc').parentNode.insertBefore(hb, $('newc'));
  hb.onclick = () => {
    const l = A.chat.history();
    const p = A.pop(hb, l.length ? '<div class="grp" style="margin-top:0">Recent chats</div>' + l.slice(0, 30).map(c => '<div class="hit row" data-id="' + esc(c.id) + '"><span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(c.title) + '</span><span class="mute small" data-rm="1" title="Delete">&times;</span></div>').join('') : '<div class="mute small">No saved chats yet.</div>');
    p.onclick = e => { const h = e.target.closest('.hit'); if (!h) return; if (e.target.dataset.rm) { A.chat.remove(h.dataset.id); A.closePop(); } else { A.closePop(); A.chat.load(h.dataset.id); } };
  };

  /* settings */
  $('cog').onclick = () => {
    const vs = ('speechSynthesis' in window ? speechSynthesis.getVoices() : []).filter(v => /^en/i.test(v.lang));
    const TH = window.OA_THEMES, cur = TH.get(), curStyle = TH.getStyle ? TH.getStyle() : 'modern';
    const styleHtml = TH.styles ? '<h3>Interface style</h3><div class="small mute" style="margin-bottom:6px">How the app is shaped and animated. Works with any colour theme.</div><div id="sst" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px">' + TH.styles.map(s => '<button class="stl" data-s="' + s.id + '" title="' + esc(s.note) + '" style="text-align:left;padding:10px;border-radius:12px;border:2px solid ' + (s.id === curStyle ? 'var(--acc)' : 'var(--line)') + ';background:var(--panel2);color:var(--text)"><span style="font-size:22px;display:block;margin-bottom:2px">' + esc(s.icon) + '</span><b style="font-size:13px">' + esc(s.name) + '</b><span class="small mute" style="display:block;font-size:11px;line-height:1.3">' + esc(s.note) + '</span></button>').join('') + '</div>' : '';
    const themeHtml = '<h3>Colours</h3><div id="sth" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(128px,1fr));gap:8px">' + TH.list.map(t => '<button class="thm" data-t="' + t.id + '" title="' + esc(t.note) + '" style="text-align:left;padding:8px;border-radius:12px;border:2px solid ' + (t.id === cur ? 'var(--acc)' : 'var(--line)') + ';background:var(--panel2);color:var(--text)"><span style="display:flex;height:34px;border-radius:8px;overflow:hidden;margin-bottom:6px"><i style="flex:2;background:' + t.sw[0] + '"></i><i style="flex:1;background:' + t.sw[1] + '"></i><i style="flex:1;background:' + t.sw[2] + '"></i></span><b style="font-size:13px">' + esc(t.name) + '</b><span class="small mute" style="display:block;font-size:11px;line-height:1.3">' + esc(t.note) + '</span></button>').join('') + '</div>';
    A.dlg('<div class="hd"><b>Settings</b></div><div class="bd"><div class="card" style="display:flex;align-items:center;gap:10px"><div style="flex:1"><b>🎨 Customize appearance</b><div class="small mute">Fonts, text size, spacing, corners, accent colour, contrast and more.</div></div><button class="pri" id="scust">Open</button></div>' + styleHtml + themeHtml + '<h3>Read-aloud voice</h3><select id="sv" style="max-width:100%;width:100%">' + vs.map(v => '<option' + (ls.get('voice', '') === v.name ? ' selected' : '') + '>' + esc(v.name) + '</option>').join('') + '</select>' +
      '<div class="row" style="margin-top:8px"><span class="small mute">Speed</span><input type="range" id="sr2" min="0.7" max="1.5" step="0.1" value="' + ls.get('rate', '1') + '" style="flex:1"><button class="ib" id="stest">Test</button></div>' +
      '<h3>Chat</h3><button class="ib dang" id="sclr">Delete all chat history</button>' +
      '<h3>Power</h3><label class="chk" style="white-space:normal"><input type="checkbox" id="slp"> Low-power mode: smaller AI model, no animations, shorter model memory. Good on battery.</label>' +
      '<h3>Backup</h3><div class="small mute" style="margin-bottom:6px">One zip with your notes, flashcards, chats, prompts and reminders.</div><div class="row"><a class="ib" href="/api/backup" download style="text-decoration:none">Back up everything</a><button class="ib" id="srs">Restore from backup</button></div><h3>Help</h3><div class="row"><button class="ib" id="sg">Open the guide</button><button class="ib" id="st">Replay the tour</button></div>' +
      '<div class="small mute" style="margin-top:14px">Right-click the tray icon (bottom-right) to start the assistant with Windows. Everything runs on this PC.</div><div class="row" style="margin-top:12px"><span class="sp"></span><button class="pri" id="sx">Done</button></div></div>');
    $('scust').onclick = () => A.custom && A.custom.open();
    if ($('sst')) $('sst').onclick = e => { const b = e.target.closest('.stl'); if (!b) return; TH.applyStyle(b.dataset.s); $('sst').querySelectorAll('.stl').forEach(x => { x.style.borderColor = x === b ? 'var(--acc)' : 'var(--line)'; }); };
    $('sth').onclick = e => { const b = e.target.closest('.thm'); if (!b) return; TH.apply(b.dataset.t); $('sth').querySelectorAll('.thm').forEach(x => { x.style.borderColor = x === b ? 'var(--acc)' : 'var(--line)'; }); };
    $('slp').checked = A.power.on; $('slp').onchange = () => A.power.toggle($('slp').checked);
    $('sv').onchange = () => ls.set('voice', $('sv').value); $('sr2').oninput = () => ls.set('rate', $('sr2').value);
    $('stest').onclick = () => { A.speech.stop(); A.speech.speak('Hello. This is how I sound when reading to you.'); };
    $('sclr').onclick = async () => { if (!confirm('Delete every saved chat?')) return; await A.api('/api/chats', []); A.closeDlg(); location.reload(); };
    $('srs').onclick = () => { const f = document.createElement('input'); f.type = 'file'; f.accept = '.zip'; f.onchange = async () => { if (!f.files[0]) return; if (!confirm('Restore from this backup? Notes with the same name and your current flashcards, chats, prompts and reminders will be replaced.')) return; A.toast('Restoring...', 4000); const r = await (await fetch('/api/restore', { method: 'POST', body: await f.files[0].arrayBuffer() })).json(); if (r.error) return A.toast(r.error, 5000); A.toast('Restored ' + r.notes + ' notes and ' + r.files + ' data files'); setTimeout(() => location.reload(), 1200); }; f.click(); };
    $('sg').onclick = () => { A.closeDlg(); A.showTab('guide'); }; $('st').onclick = () => { A.closeDlg(); A.guide.tour(0); }; $('sx').onclick = A.closeDlg;
  };

  /* keys */
  A.escape = () => {
    if (A.vm && A.vm.on) return A.vm.end();
    if (A.tv && A.cur === 'tv' && A.tv.escape && A.tv.escape()) return;          // TV: leave full screen, then close the player
    if (A.godotPlayer && A.cur === 'studio' && A.godotPlayer.escape()) return;    // a Godot game playing in Studio: leave full screen, then close it
    if (A.play && A.cur === 'play' && A.play.active()) return A.play.exit();
    if (A.library && A.cur === 'lib' && A.library.reading()) return A.library.home();
    if (A.classics && A.cur === 'lib' && A.classics.isOpen()) return A.classics.close();
    if (A.chessbooks && A.cur === 'lib' && A.chessbooks.isOpen()) return A.chessbooks.close();
    if (A.viewer && A.viewer.on) return A.viewer.close();
    if ($('ov').classList.contains('on')) return A.closeDlg();
    if ($('pop').style.display === 'block') return A.closePop();
    if ($('sel').style.display === 'block') { $('sel').style.display = 'none'; return; }
    if (A.cur === 'chat' && A.chat && A.chat.busy && A.chat.busy()) return A.chat.stop();      // Esc stops a reply that is being written, before it does anything else on the Chat page
    const ae = document.activeElement;
    if (ae && /INPUT|TEXTAREA/.test(ae.tagName) && ae.value) { ae.blur(); return; }
    if (A.cur !== 'home') { A.showTab('home'); return; }
    window.close();
  };
  /* Escape is the one key that is not in the shortcut registry: it has to look at what is open and step back one thing
     at a time. Every other shortcut lives in keyboard.js, which is also what the shortcut sheet reads. */
  document.addEventListener('keydown', e => { if (e.key === 'Escape') A.escape(); });

  /* lifetime: tell the server we are alive; tell it when we go */
  let pingFails = 0;           // if the server went away (for example after a long sleep), the tray helper restarts it and this page reloads itself
  let staleTold = false;       // the server says when the code on the disk is newer than the copy that is running: new parts answer "not found" until it is restarted
  const ping = () => fetch('/api/ping').then(r => r.json().catch(() => ({}))).then(j => { if (pingFails >= 2) location.reload(); pingFails = 0; if (j && j.stale && !staleTold) { staleTold = true; A.notify('info', 'Moundshroud was updated while it was open. Close it and open it again so the new parts work.', 20000); } }).catch(() => { if (++pingFails === 2) A.toast('Reconnecting...', 4000); });
  ping(); setInterval(ping, 4000);
  addEventListener('pagehide', () => { try { navigator.sendBeacon('/api/closing', new Blob(['{}'], { type: 'application/json' })); } catch (e) {} });

  /* text arriving from the hotkeys */
  let busyIn = false;
  async function incoming() {
    if (busyIn) return; busyIn = true;
    try {
      const v = await A.api('/api/incoming'); const t = (v.text || '').trim();
      if (v.mode === 'voice') A.vm.start();
      else if (v.mode === 'clip') A.tools.go('clip');
      else if (v.mode === 'emergency') A.prep.open('people');
      else if (v.mode === 'verse') A.showTab('home');
      else if (t) {
        if (v.mode === 'voice') A.vm.start(); else if (v.mode === 'wiki') A.lib.search(t.slice(0, 120));
        else if (v.mode === 'define') A.lib.define(t.split(/\s+/)[0].replace(/[^\p{L}'-]/gu, ''));
        else A.chat.showSel(t, v.mode === 'ocr' ? 'Text from your screen (copied to clipboard)' : 'Selected text');
      }
    } catch (e) {} busyIn = false;
  }
  setInterval(incoming, 1200); addEventListener('focus', incoming);

  /* capabilities, then every module's start-up, then the tour on first run */
  (async () => {
    try { const s = await A.api('/api/status'); A.caps = { lib: s.lib, voice: s.voice, chef: s.chef }; } catch (e) {}
    if (!A.caps.voice || !A.voice.available()) $('mic').style.display = 'none';
    for (const f of A.ready) { try { await f(); } catch (e) { console.error(e); } }
    incoming(); A.guide.firstRun();
  })();
})();

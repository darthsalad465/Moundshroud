// Radio: live internet stations by kind (news, talk, music, weather, and the few public police and fire scanner feeds),
// search by name, favourites, recently played, and stations added by hand from a stream address. TV has its own tab
// (web/js/tv.js). The server
// (lib/radio.js) finds stations in the free Radio Browser directory and passes the sound through, because the page may
// only load sound from this PC. Nothing is fetched unless internet access is switched on. The sound keeps playing while
// other tabs are open; the bar at the bottom of this tab stops it.
(() => {
  const root = document.getElementById('p-radio'); if (!root) return;
  const OWN = [['fav', '⭐ Favorites'], ['recent', '🕘 Recent']], ADD = ['add', '➕ Add a station'];
  const guessCc = () => { const m = /-([A-Za-z]{2})$/.exec(navigator.language || ''); return m ? m[1].toUpperCase() : 'US'; };
  let S = null, list = [], loading = false, err = '', cur = null, state = 'stopped', title = '', why = '', poll = 0, seq = 0, typing = 0, hooked = false;
  const st = { cat: ls.get('rd_cat', 'popular'), cc: ls.get('rd_cc', guessCc()), q: '' };
  const au = new Audio(); au.preload = 'none'; au.volume = Math.max(0, Math.min(1, +ls.get('rd_vol', '0.8') || 0.8));
  const q$ = s => root.querySelector(s);
  const isFav = id => !!(S && S.fav.some(s => s.id === id));

  /* ---------- playing ---------- */
  const setState = (s, w) => { state = s; why = w || ''; drawBar(); markRows(); };
  au.addEventListener('playing', () => setState('playing'));
  au.addEventListener('waiting', () => { if (cur && state !== 'stopped') setState('connecting'); });
  au.addEventListener('stalled', () => { if (cur && state === 'playing') setState('connecting'); });
  au.addEventListener('ended', () => { if (cur) setState('error', 'The station stopped sending sound.'); });
  au.addEventListener('error', async () => {
    if (!cur || state === 'stopped') return;
    /* the player only says "failed"; asking the server once more gets the reason in words */
    const mine = seq; let msg = 'This station could not be played.';
    try { const c = new AbortController(), r = await fetch('/api/radio/stream?id=' + encodeURIComponent(cur.id), { signal: c.signal }); if (!r.ok) msg = (await r.text()).slice(0, 200) || msg; else { c.abort(); msg = 'This station sends a kind of sound this player cannot play.'; } } catch (e) { }
    if (mine === seq) setState('error', msg);
  });
  function stop() { seq++; clearInterval(poll); try { au.pause(); au.removeAttribute('src'); au.load(); } catch (e) { } title = ''; setState('stopped'); }
  function play(s) {
    if (!s) return;
    if (S && !S.internet) return A.notify('warn', 'Internet access is off. Turn it on at the top of the Radio tab to listen.');
    try { if (A.tv && A.tv.stop) A.tv.stop(); } catch (e) { }
    seq++; cur = s; title = ''; setState('connecting');
    /* one thing plays at a time: the music library and game music pause for the radio, and the radio stops for them */
    try { if (A.musicLib && A.musicLib.audio) { if (!A.musicLib.audio.paused) A.musicLib.pause(); if (!hooked) { hooked = true; A.musicLib.audio.addEventListener('play', () => { if (state !== 'stopped') stop(); }); } } } catch (e) { }
    try { if (A.music && A.music.stop) A.music.stop(); } catch (e) { }
    au.src = '/api/radio/stream?id=' + encodeURIComponent(s.id) + '&t=' + Date.now();
    const p = au.play(); if (p && p.catch) p.catch(() => { });
    A.api('/api/radio/recent', { id: s.id }).then(r => { if (r && r.recent && S) { S.recent = r.recent; if (st.cat === 'recent' && !st.q) { list = S.recent; drawList(); } } }).catch(() => { });
    clearInterval(poll);
    const mine = seq;
    poll = setInterval(async () => { if (mine !== seq || state !== 'playing') return; try { const r = await A.api('/api/radio/now?id=' + encodeURIComponent(s.id)); if (mine === seq && r && r.title !== title) { title = r.title || ''; drawBar(); } } catch (e) { } }, 8000);
  }

  /* ---------- data ---------- */
  async function load() { try { S = await A.api('/api/radio'); } catch (e) { S = S || { internet: false, fav: [], recent: [], custom: [], cats: [], countries: [['', 'Any country']] }; } }
  async function fetchList() {
    err = '';
    if (!st.q && st.cat === 'fav') { list = S.fav; return drawList(); }
    if (!st.q && st.cat === 'recent') { list = S.recent; return drawList(); }
    if (!st.q && st.cat === 'add') { list = S.custom; return drawList(); }
    if (!S.internet) { list = []; return drawList(); }
    const mine = ++typing; loading = true; drawList();
    let r; try { r = await A.api('/api/radio/search?cat=' + encodeURIComponent(st.q ? '' : st.cat) + '&cc=' + encodeURIComponent(st.cc) + '&q=' + encodeURIComponent(st.q)); } catch (e) { r = { stations: [], error: 'The station list could not be loaded: ' + e.message }; }
    if (mine !== typing) return;
    loading = false; list = (r && r.stations) || []; err = (r && r.error) || ''; drawList();
  }

  /* ---------- drawing ---------- */
  function shell() {
    root.innerHTML = '<div class="rd-top"><h2>📻 Radio</h2><input id="rdq" type="search" placeholder="Search stations by name or kind: BBC, jazz, police scanner..." autocomplete="off"><select id="rdcc" title="Country"></select></div>' +
      '<div id="rdban"></div><div class="rd-cats" id="rdcats"></div><div class="scroll pad" style="flex:1;min-height:0" id="rdlist"></div>' +
      '<div class="rd-bar" id="rdbar"></div>';
    q$('#rdq').oninput = e => { st.q = e.target.value.trim(); clearTimeout(shell.t); shell.t = setTimeout(() => { drawCats(); fetchList(); }, 450); };
    q$('#rdq').onkeydown = e => { if (e.key === 'Enter') { clearTimeout(shell.t); st.q = e.target.value.trim(); drawCats(); fetchList(); } };
    q$('#rdcc').onchange = e => { st.cc = e.target.value; ls.set('rd_cc', st.cc); fetchList(); };
    root.onclick = onClick;
  }
  function drawTop() {
    q$('#rdcc').innerHTML = (S.countries || []).map(c => '<option value="' + esc(c[0]) + '"' + (c[0] === st.cc ? ' selected' : '') + '>' + esc(c[1]) + '</option>').join('');
    if (q$('#rdcc').value !== st.cc) { st.cc = ''; q$('#rdcc').value = ''; }
    q$('#rdban').innerHTML = S.internet ? '' : '<div class="rd-banner"><span style="flex:1;min-width:200px">🔌 <b>Internet access is off.</b> Radio stations come over the internet, so nothing can play until it is on. Your favorites stay listed.</span><button class="pri" data-a="neton">Turn on internet access</button></div>';
  }
  function drawCats() {
    const cats = OWN.concat(S.cats || [], [ADD]);
    if (!cats.some(c => c[0] === st.cat)) st.cat = 'popular';
    q$('#rdcats').innerHTML = cats.map(c => '<button class="ib' + (!st.q && c[0] === st.cat ? ' on' : '') + '" data-c="' + esc(c[0]) + '">' + esc(c[1]) + '</button>').join('');
  }
  const sub = s => [s.cc, s.state, (s.tags || []).slice(0, 4).join(', '), s.codec ? s.codec + (s.kbps ? ' ' + s.kbps + 'k' : '') : ''].filter(Boolean).map(esc).join(' · ');
  function row(s) {
    const on = cur && cur.id === s.id && state !== 'stopped', f = isFav(s.id);
    return '<div class="rd-st' + (on ? ' on' : '') + '" data-id="' + esc(s.id) + '"><button class="rd-play" data-a="play" title="' + (on ? 'Stop' : 'Play') + '">' + (on ? '⏹' : '▶') + '</button>' +
      '<div class="rd-meta"><b>' + esc(s.name) + '</b><div class="small mute">' + sub(s) + '</div></div>' +
      '<button class="ib" data-a="fav" title="' + (f ? 'Remove from favorites' : 'Add to favorites') + '">' + (f ? '★' : '☆') + '</button>' +
      (s.mine ? '<button class="ib" data-a="rm" title="Remove this station">✕</button>' : '') + '</div>';
  }
  function drawList() {
    const el = q$('#rdlist'); if (!el) return;
    let h = '';
    if (!st.q && st.cat === 'add') h += '<div class="card"><b>➕ Add a station</b><div class="small mute" style="margin:4px 0 8px">Paste the address of any internet stream: a local station, or a scanner feed whose address you have. It is kept on this PC.</div>' +
      '<div class="row" style="flex-wrap:wrap"><input id="rdan" placeholder="Name" style="flex:1;min-width:140px" maxlength="90"><input id="rdau" placeholder="https://example.com/stream" style="flex:2;min-width:220px" maxlength="600"><button class="pri" data-a="add">Add</button></div></div>';
    if (!st.q && st.cat === 'scanner') h += '<div class="small mute" style="margin-bottom:8px">Only a few police and fire feeds are public on the internet. Most police radio is not streamed, and many departments encrypt it. If you have a feed’s address, use ➕ Add a station.</div>';
    if (loading) h += '<div class="rd-empty">⏳ Finding stations…</div>';
    else if (err) h += '<div class="rd-empty">' + esc(err) + '</div>';
    else if (!list.length) h += '<div class="rd-empty">' + (st.q ? 'No station matches “' + esc(st.q) + '”. Try a shorter name, or Any country.' : st.cat === 'fav' ? 'No favorites yet. Press ☆ on a station to keep it here.' : st.cat === 'recent' ? 'Nothing played yet.' : st.cat === 'add' ? 'No stations added by you yet.' : !S.internet ? 'Turn on internet access above to see stations.' : 'No stations found here. Try Any country.') + '</div>';
    else h += list.map(row).join('') + (st.q || !['fav', 'recent', 'add'].includes(st.cat) ? '<div class="small mute" style="margin:10px 2px">Stations come from the free Radio Browser directory, most-played first.</div>' : '');
    el.innerHTML = h;
  }
  function markRows() { root.querySelectorAll('.rd-st').forEach(r => { const on = cur && r.dataset.id === cur.id && state !== 'stopped', b = r.querySelector('.rd-play'); r.classList.toggle('on', !!on); if (b) { b.textContent = on ? '⏹' : '▶'; b.title = on ? 'Stop' : 'Play'; } }); }
  function drawBar() {
    const el = q$('#rdbar'); if (!el) return;
    const live = cur && state !== 'stopped';
    const line = !cur ? 'Pick a station to listen.' : state === 'connecting' ? 'Connecting…' : state === 'playing' ? (title || 'Live') : state === 'error' ? why : 'Stopped';
    const had = el.querySelector('#rdvol');
    if (had) {          // keep the volume slider itself (redrawing it mid-drag would drop the drag)
      el.querySelector('#rdtog').textContent = live ? '⏹' : '▶'; el.querySelector('#rdtog').title = live ? 'Stop' : 'Play'; el.querySelector('#rdtog').disabled = !cur;
      el.querySelector('#rdname').textContent = cur ? cur.name : 'Radio'; const ln = el.querySelector('#rdline'); ln.textContent = line; ln.className = 'small ' + (state === 'error' ? 'rd-bad' : 'mute');
      return;
    }
    el.innerHTML = '<button class="rd-play" id="rdtog" data-a="toggle" title="' + (live ? 'Stop' : 'Play') + '"' + (cur ? '' : ' disabled') + '>' + (live ? '⏹' : '▶') + '</button>' +
      '<div class="rd-now"><b id="rdname">' + esc(cur ? cur.name : 'Radio') + '</b><span id="rdline" class="small ' + (state === 'error' ? 'rd-bad' : 'mute') + '">' + esc(line) + '</span></div>' +
      '<span title="Volume">🔈</span><input type="range" id="rdvol" min="0" max="1" step="0.02" value="' + au.volume + '" style="width:120px" title="Volume">';
    el.querySelector('#rdvol').oninput = e => { au.volume = +e.target.value; ls.set('rd_vol', String(au.volume)); };
  }
  function draw() { drawTop(); drawCats(); drawBar(); fetchList(); }

  /* ---------- clicks ---------- */
  async function onClick(e) {
    const c = e.target.closest('[data-c]');
    if (c) { st.cat = c.dataset.c; ls.set('rd_cat', st.cat); st.q = ''; q$('#rdq').value = ''; drawCats(); return fetchList(); }
    const b = e.target.closest('[data-a]'); if (!b) return;
    const a = b.dataset.a, r = b.closest('.rd-st'), s = r ? list.find(x => x.id === r.dataset.id) : null;
    if (a === 'play' && s) return cur && cur.id === s.id && state !== 'stopped' ? stop() : play(s);
    if (a === 'toggle') return cur && state !== 'stopped' ? stop() : play(cur);
    if (a === 'fav' && s) {
      const on = !isFav(s.id); let res; try { res = await A.api('/api/radio/fav', { id: s.id, on }); } catch (x) { return A.notify('err', 'Could not save that: ' + x.message); }
      if (res.error) return A.notify('err', res.error);
      S = res; if (!st.q && st.cat === 'fav') list = S.fav; return drawList();
    }
    if (a === 'rm' && s) {
      if (!(await A.confirm('Remove “' + s.name + '” from your stations?'))) return;
      if (cur && cur.id === s.id) stop();
      try { S = await A.api('/api/radio/custom', { remove: s.id }); } catch (x) { return A.notify('err', 'Could not remove it: ' + x.message); }
      if (!st.q && st.cat === 'add') list = S.custom; else list = list.filter(x => x.id !== s.id); return drawList();
    }
    if (a === 'add') {
      const name = q$('#rdan').value.trim(), url = q$('#rdau').value.trim();
      if (!name || !url) return A.notify('warn', 'Type a name and the stream’s address.');
      let res; try { res = await A.api('/api/radio/custom', { name, url }); } catch (x) { return A.notify('err', 'Could not add it: ' + x.message); }
      if (res.error) return A.notify('err', res.error);
      S = res; list = S.custom; drawList(); return A.notify('ok', 'Added “' + name + '”. Press ▶ to listen.');
    }
    if (a === 'neton') {
      try { await A.api('/api/cloud', { web: true }); if (A.net) A.net.refresh(); } catch (x) { return A.notify('err', 'Could not switch it on: ' + x.message); }
      await load(); draw();
    }
  }

  A.registerTab('radio', 'Radio', async () => {
    const first = !q$('#rdlist');
    if (first) shell();
    const was = S && S.internet;
    await load();
    if (first || was !== S.internet) draw(); else { drawTop(); drawBar(); }
  });
  A.radio = { play, stop, state: () => ({ station: cur, state, title }), open: cat => { A.showTab('radio'); if (cat) setTimeout(() => { const b = root.querySelector('[data-c="' + cat + '"]'); if (b) b.click(); }, 150); } };
})();

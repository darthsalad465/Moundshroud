// TV: live channels and YouTube, watched inside Moundshroud. 📡 My channels keeps live video links (imported from VLC,
// pasted by hand, or saved from a channel list) with their real names, categories and logos (lib/tv.js); ▶ YouTube
// searches YouTube and plays in YouTube's privacy-enhanced player (lib/youtube.js). Everything plays in the player at
// the top of the tab, which has its own ⛶ Full screen. Nothing opens another program or window. Nothing is fetched
// unless internet access is switched on. Leaving the tab stops the picture. 📥 Downloads saves YouTube videos with the
// user's yt-dlp (whole, picture and sound apart, sound only, picture only) and sorts them into folders.
(() => {
  const root = document.getElementById('p-tv'); if (!root) return;
  const q$ = s => root.querySelector(s);
  const TOPICS = [['🔴 Live news', 'live news'], ['🌍 World news', 'world news today'], ['🛰 NASA live', 'nasa live'], ['🎵 Music', 'music playlist'], ['🏅 Sports highlights', 'sports highlights'], ['🎬 Movie trailers', 'official trailer'], ['📚 Documentaries', 'full documentary'], ['😂 Comedy', 'stand up comedy'], ['🍳 Cooking', 'cooking recipes'], ['✝ Mass and prayer', 'catholic mass today'], ['🧒 Kids', 'kids cartoons'], ['🌲 Nature', 'nature 4k relaxing'], ['🔧 How to', 'how to fix']];
  let S = null, view = ls.get('tv_view', 'mine'), more = false, found = null, findT = 0, list = null, cat = '', filter = '', yt = { q: '', res: null, busy: false, err: '', seq: 0 }, busy = '', addOpen = false;
  /* 🌍 Cameras: a hand-checked list of public 24/7 webcams (lib/cams.js), with YouTube search for fresh ones */
  let CAM = null, camCat = ls.get('tv_camcat', ''), camFound = null, camBusy = '', camList = [], camShown = 90;
  const P = { kind: '', item: null, state: '', why: '', seq: 0 };          // what the player shows: '' | 'video' | 'yt'

  /* ---------- the player ---------- */
  const box = () => q$('#tvp');
  function drawPlayer() {
    const b = box(); if (!b) return;
    if (!P.kind) { b.style.display = 'none'; b.innerHTML = ''; return; }
    b.style.display = '';
    const line = P.kind === 'yt' ? (P.item.channel || 'YouTube') : P.state === 'connecting' ? (P.item.file ? 'Opening…' : 'Connecting… live TV takes a few seconds to start.') : P.state === 'error' ? P.why : P.item.file ? '📥 From your downloads' : 'Live';
    if (!b.querySelector('.tv-stage')) {
      b.innerHTML = '<div class="tv-phead"><b id="tvpn"></b><span id="tvpl" class="small"></span><span style="flex:1"></span><button class="ib" data-a="prev" id="tvpvp" title="Previous camera (←)">◀</button><button class="ib" data-a="next" id="tvpvn" title="Next camera (→)">▶</button><button class="ib" data-a="dlcur" id="tvdlb" title="Save this video on this PC">⬇ Download</button><button class="ib" data-a="fs" title="Full screen (F)">⛶ Full screen</button><button class="ib" data-a="close" title="Stop and close">✕ Close</button></div><div class="tv-stage" id="tvstage"></div>';
    }
    b.querySelector('#tvpn').textContent = P.kind === 'yt' ? P.item.title : P.item.name;
    const db = b.querySelector('#tvdlb'); if (db) db.style.display = P.kind === 'yt' && S && S.dl && S.dl.tool.found ? '' : 'none';
    /* ◀ ▶ only make sense while you are flipping through the cameras */
    const flipping = view === 'cams' && P.kind === 'yt' && camList.length > 1;
    for (const id of ['#tvpvp', '#tvpvn']) { const bb = b.querySelector(id); if (bb) bb.style.display = flipping ? '' : 'none'; }
    const l = b.querySelector('#tvpl'); l.textContent = line; l.className = 'small ' + (P.state === 'error' ? 'rd-bad' : 'mute');
  }
  function stop() {
    P.seq++; const st = q$('#tvstage');
    if (st) { const v = st.querySelector('video'); if (v) { try { v.pause(); v.removeAttribute('src'); v.load(); } catch (e) { } } st.innerHTML = ''; }
    exitFs();
    P.kind = ''; P.item = null; drawPlayer(); mark();
  }
  function quiet() {         /* one sound at a time: the radio, the music library and game music stop for TV */
    try { if (A.radio && A.radio.stop) A.radio.stop(); } catch (e) { }
    try { if (A.musicLib && A.musicLib.audio && !A.musicLib.audio.paused) A.musicLib.pause(); if (A.music && A.music.stop) A.music.stop(); } catch (e) { }
  }
  function playChannel(item, src) {
    if (!src && S && !S.internet) return A.notify('warn', 'Internet access is off. Turn it on at the top of the TV tab to watch.');
    if (!src && S && !S.video) return A.notify('warn', 'Live TV needs ffmpeg, which is not installed. Run install-song-tools.ps1 once.');
    stop(); quiet();
    P.kind = 'video'; P.item = item; P.state = 'connecting'; drawPlayer(); mark();
    const mine = P.seq, v = document.createElement('video');
    v.controls = true; v.autoplay = true; v.playsInline = true; v.volume = +ls.get('tv_vol', '0.9') || 0.9;
    v.addEventListener('volumechange', () => ls.set('tv_vol', String(v.volume)));
    v.addEventListener('playing', () => { if (mine === P.seq) { P.state = 'playing'; drawPlayer(); } });
    v.addEventListener('waiting', () => { if (mine === P.seq && P.state !== 'error') { P.state = 'connecting'; drawPlayer(); } });
    v.addEventListener('ended', () => { if (mine === P.seq && !src) { P.state = 'error'; P.why = 'The channel stopped sending.'; drawPlayer(); } });
    v.addEventListener('dblclick', toggleFs);
    v.addEventListener('error', async () => {
      if (mine !== P.seq) return;
      let msg = 'This channel could not be played.';
      if (src) { P.state = 'error'; P.why = 'This file could not be played here. ⬇ Save it and open it from your Videos folder.'; return drawPlayer(); }
      try { const c = new AbortController(), r = await fetch('/api/tv/video?id=' + encodeURIComponent(item.id), { signal: c.signal }); if (!r.ok) msg = (await r.text()).slice(0, 200) || msg; else { c.abort(); msg = 'This channel sends a kind of picture this player cannot show.'; } } catch (e) { }
      if (mine === P.seq) { P.state = 'error'; P.why = msg; drawPlayer(); }
    });
    v.src = src || '/api/tv/video?id=' + encodeURIComponent(item.id) + '&t=' + Date.now();
    q$('#tvstage').appendChild(v);
    const p = v.play(); if (p && p.catch) p.catch(() => { });
    box().scrollIntoView({ block: 'nearest' });
  }
  function playYt(vd) {
    if (S && !S.internet) return A.notify('warn', 'Internet access is off. Turn it on at the top of the TV tab to watch.');
    stop(); quiet();
    P.kind = 'yt'; P.item = vd; P.state = 'playing'; drawPlayer(); mark();
    const f = document.createElement('iframe');
    /* YouTube's own player, the privacy-enhanced address; it needs to be told which page it sits in, hence the referrer */
    f.src = 'https://www.youtube-nocookie.com/embed/' + encodeURIComponent(vd.id) + '?autoplay=1&rel=0&modestbranding=1&playsinline=1';
    f.allow = 'autoplay; encrypted-media; fullscreen; picture-in-picture'; f.allowFullscreen = true; f.referrerPolicy = 'strict-origin-when-cross-origin'; f.title = vd.title;
    q$('#tvstage').appendChild(f);
    box().scrollIntoView({ block: 'nearest' });
  }
  /* Full screen stays inside Moundshroud: the player first fills the whole app window, then asks the screen for real
     full screen. If the screen says no, the player still fills the window. Esc, F or the button bring it back. */
  let realFs = false;
  const filled = () => { const b = box(); return !!b && b.classList.contains('fs'); };
  function setFill(on) { const b = box(); if (!b) return; b.classList.toggle('fs', on); document.documentElement.classList.toggle('tv-filled', on); const fb = b.querySelector('[data-a="fs"]'); if (fb) fb.textContent = on ? '🗗 Exit full screen' : '⛶ Full screen'; }
  function exitFs() { setFill(false); if (document.fullscreenElement) document.exitFullscreen().catch(() => { }); realFs = false; }
  function toggleFs() {
    const b = box(); if (!b || !P.kind) return;
    if (filled()) return exitFs();
    setFill(true);
    if (b.requestFullscreen) b.requestFullscreen().then(() => { realFs = true; }, () => { realFs = false; });
  }
  document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement && realFs) { realFs = false; setFill(false); } });
  document.addEventListener('keydown', e => {
    if (A.cur !== 'tv' || /^(INPUT|TEXTAREA|SELECT)$/.test((e.target || {}).tagName || '')) return;
    if (!P.kind) return;
    if ((e.key === 'ArrowRight' || e.key === 'ArrowLeft') && view === 'cams' && P.kind === 'yt') { e.preventDefault(); return flip(e.key === 'ArrowRight' ? 1 : -1); }
    if (e.key === 'f' || e.key === 'F') { e.preventDefault(); toggleFs(); }
  });

  /* ---------- data ---------- */
  async function load() { const keep = S && S.dl; try { S = await A.api('/api/tv'); S.dl = keep; await loadDl(); pollDl(); return; } catch (e) { S = S || { internet: false, video: false, vlc: {}, links: [], index: {} }; } }
  const flag = cc => cc && /^[A-Z]{2}$/.test(cc) ? String.fromCodePoint(...[...cc].map(c => 0x1f1a5 + c.charCodeAt(0))) + ' ' : '';
  const sub = c => [c.group, c.cc ? flag(c.cc) + c.cc : '', c.q, c.yt ? '▶ YouTube' : ''].filter(Boolean).join(' · ') + (c.geo ? ' · may only work in some countries' : '') + (c.part ? ' · not on all day' : '');
  const initials = n => esc(String(n || '?').replace(/[^\p{L}\p{N} ]/gu, '').split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '📺');
  const logo = c => c.logo ? '<img loading="lazy" src="/api/tv/logo?id=' + encodeURIComponent(c.id) + '" alt="" onerror="this.replaceWith(Object.assign(document.createElement(\'span\'),{className:\'tv-ini\',textContent:this.dataset.i}))" data-i="' + initials(c.name) + '">' : '<span class="tv-ini">' + initials(c.name) + '</span>';
  function tile(c, opts) {
    const on = P.kind === 'video' && P.item && P.item.id === c.id;
    return '<div class="tv-tile' + (on ? ' on' : '') + '" data-id="' + esc(c.id) + '" data-a="play" title="Play ' + esc(c.name) + '"><div class="tv-logo">' + logo(c) + '</div><div class="tv-tm"><b>' + esc(c.name) + '</b><span class="small mute">' + esc(sub(c) || c.host || 'Channel') + (c.guess ? ' · name read from its address' : '') + '</span></div>' +
      '<div class="tv-acts">' + (opts.save ? '<button class="ib" data-a="save" title="Save to My channels">☆</button>' : '') + (opts.edit ? '<button class="ib" data-a="ren" title="Rename">✎</button><button class="ib" data-a="rm" title="Remove">✕</button>' : '') + '</div></div>';
  }
  const mark = () => {
    root.querySelectorAll('.tv-tile[data-id], .yt-card[data-id]').forEach(t => t.classList.toggle('on', !!P.item && P.item.id === t.dataset.id));
    root.querySelectorAll('.cam-card[data-cam]').forEach(t => t.classList.toggle('on', !!P.item && P.item.id === t.dataset.cam));
  };

  /* ---------- drawing ---------- */
  function shell() {
    root.innerHTML = '<div class="rd-top"><h2>📺 TV</h2><div class="tv-seg"><button class="ib" data-v="mine">📡 My channels</button><button class="ib" data-v="cams">🌍 Cameras</button><button class="ib" data-v="yt">▶ YouTube</button><button class="ib" data-v="dl">📥 Downloads</button></div>' +
      '<input id="tvq" type="search" autocomplete="off"></div><div id="tvban"></div><div class="tv-player" id="tvp" style="display:none"></div><div class="scroll pad" id="tvbody" style="flex:1;min-height:0"></div>';
    root.onclick = onClick;
    q$('#tvq').addEventListener('input', e => { if (view === 'dl') { dlq = e.target.value.trim(); return drawBody(); } if (view !== 'yt') { filter = e.target.value.trim(); found = null; camShown = 90; drawBody(); clearTimeout(findT); if (!list && !more && filter.length > 1) findT = setTimeout(findAll, 350); } });
    root.addEventListener('change', async e => { const m = e.target.closest('[data-dmv]'); if (!m) return; const r = await post('/api/tv/dl/move', { id: m.dataset.dmv, folder: m.value }); if (r) { S.dl = r; drawBody(); } });
    q$('#tvq').addEventListener('keydown', e => { if (e.key === 'Enter' && view === 'yt') ytSearch(e.target.value); });
  }
  function drawTop() {
    root.querySelectorAll('[data-v]').forEach(b => b.classList.toggle('on', b.dataset.v === view));
    const qi = q$('#tvq');     qi.placeholder = view === 'dl' ? 'Find a download by name...' : view === 'cams' ? 'Filter the cameras: a place, a kind...  (← and → flip through them)' : view === 'yt' ? 'Search YouTube, or paste a YouTube link, then press Enter' : list ? 'Filter these channels: a name, news, sports...' : 'Find a channel by name or kind...';
    qi.value = view === 'dl' ? dlq : view === 'yt' ? yt.q : filter;
    q$('#tvban').innerHTML = S.internet ? '' : '<div class="rd-banner"><span style="flex:1;min-width:200px">🔌 <b>Internet access is off.</b> TV and YouTube come over the internet, so nothing can play until it is on.</span><button class="pri" data-a="neton">Turn on internet access</button></div>';
  }
  function drawBody() {
    const el = q$('#tvbody'); if (!el) return;
    if (busy) { el.innerHTML = '<div class="rd-empty">⏳ ' + esc(busy) + '</div>'; return; }
    el.innerHTML = view === 'dl' ? drawDl() : view === 'cams' ? drawCams() : view === 'yt' ? drawYt() : list ? drawList() : more ? drawMore() : drawMine();
    mark();
  }
  function drawMine() {
    const f = filter.toLowerCase(), links = S.links.filter(x => !f || (x.name + ' ' + x.group + ' ' + x.host).toLowerCase().includes(f));
    const lists = links.filter(x => x.list), chans = links.filter(x => !x.list), n = S.vlc && S.vlc.links || 0;
    let h = '<div class="row" style="flex-wrap:wrap;margin-bottom:10px">' + (n ? '<button class="pri" data-a="import">Import ' + n + ' link' + (n === 1 ? '' : 's') + ' from VLC</button>' : '') + '<button class="ib" data-a="addtog">➕ Add a link</button>' + '<button class="ib" data-a="more">🌐 More channels</button>' + (S.links.some(x => x.guess) ? '<button class="ib" data-a="names" title="Look the names up again in the free channel index">🔄 Look up names</button>' : '') + '</div>';
    if (addOpen) h += '<div class="card"><b>➕ Add a link</b><div class="small mute" style="margin:4px 0 8px">Paste a live video address (.m3u8), a channel list (.m3u) or a plain video address.</div><div class="row" style="flex-wrap:wrap"><input id="tvan" placeholder="Name (optional)" style="flex:1;min-width:140px" maxlength="90"><input id="tvau" placeholder="https://example.com/live/index.m3u8" style="flex:2;min-width:220px" maxlength="600"><button class="pri" data-a="add">Add</button></div></div>';
    if (!S.video) h += '<div class="card small rd-bad">Live TV needs ffmpeg, which is not installed. Run install-song-tools.ps1 once. YouTube works without it.</div>';
    if (filter.length > 1) h += '<h3 class="tv-h">🔎 Every free channel matching “' + esc(filter) + '” <span class="small mute">' + (found ? found.total.toLocaleString() + ' of ' + (found.index || 0).toLocaleString() : 'searching…') + '</span></h3>' + (found && found.channels.length ? '<div class="tv-grid">' + found.channels.map(c => tile(c, { save: 1 })).join('') + '</div>' + (found.total > found.channels.length ? '<div class="small mute" style="margin:6px 2px">Showing the best ' + found.channels.length + '. Add a word to narrow it.</div>' : '') : found ? '<div class="small mute" style="margin:4px 2px">No channel in the free index has that name.</div>' : '') + '<h3 class="tv-h">📡 In My channels</h3>';
    if (!S.links.length) return h + '<div class="rd-empty">No channels yet.' + (n ? ' Press <b>Import from VLC</b> to bring in your VLC links.' : ' Add a link above, or try ▶ YouTube.') + '</div>';
    if (lists.length) h += '<h3 class="tv-h">☰ Channel lists</h3><div class="tv-lists">' + lists.map(x => '<div class="tv-list" data-id="' + esc(x.id) + '" data-a="openlist"><span class="tv-big">☰</span><div class="tv-tm"><b>' + esc(x.name) + '</b><span class="small mute">' + (x.count ? x.count.toLocaleString() + ' channels' : 'Open to see its channels') + ' · ' + esc(x.host) + '</span></div><div class="tv-acts"><button class="ib" data-a="ren" title="Rename">✎</button><button class="ib" data-a="rm" title="Remove">✕</button></div></div>').join('') + '</div>';
    const groups = {}; chans.forEach(c => { const g = c.group || 'Other'; (groups[g] = groups[g] || []).push(c); });
    Object.keys(groups).sort((a, b) => (a === 'Other') - (b === 'Other') || a.localeCompare(b)).forEach(g => { h += '<h3 class="tv-h">' + esc(g) + ' <span class="small mute">' + groups[g].length + '</span></h3><div class="tv-grid">' + groups[g].map(c => tile(c, { edit: 1 })).join('') + '</div>'; });
    if (!lists.length && !chans.length) h += '<div class="rd-empty">Nothing matches “' + esc(filter) + '”.</div>';
    return h;
  }
  /* every channel in the free index whose name matches what is typed */
  async function findAll() {
    const q = filter; let r; try { r = await A.api('/api/tv/find?q=' + encodeURIComponent(q)); } catch (e) { return; }
    if (q !== filter || view !== 'mine' || list || more) return;
    found = r; drawBody();
  }
  function drawMore() {
    const src = S.sources || [], left = src.filter(x => !x.added).length;
    return '<div class="row" style="flex-wrap:wrap;margin-bottom:8px"><button class="ib" data-a="back">← My channels</button><b style="flex:1;min-width:160px">🌐 More channels</b>' + (left ? '<button class="pri" data-a="srcall">＋ Add all ' + left + '</button>' : '') + '</div>' +
      '<div class="small mute" style="margin-bottom:10px">Free channel lists, checked by hand on 15 November 2026. Each one opens into its channels, grouped by kind, with a filter box. Most channels are free, ad-supported services (Pluto TV, Samsung TV Plus, public broadcasters). Some stop working over time; the lists are kept up to date by their volunteers.</div>' +
      '<div class="tv-lists">' + src.map(x => '<div class="tv-list" data-src="' + esc(x.id) + '"><div class="tv-tm"><b>' + esc(x.name) + '</b><span class="small mute" style="white-space:normal">' + esc(x.about) + '</span></div><div class="tv-acts">' + (x.added ? '<span class="small" style="color:var(--ok)">✓ Added</span>' : '<button class="ib" data-a="srcadd">＋ Add</button>') + '</div></div>').join('') + '</div>' +
      '<div class="small mute" style="margin:12px 2px">Sources: iptv-org (github.com/iptv-org/iptv) and Free-TV (github.com/Free-TV/IPTV), both open lists of publicly available streams.</div>';
  }
  /* ---------- 🌍 Cameras: public 24/7 webcams, one shelf at a time, flipped with ← and → ---------- */
  async function loadCams() { if (CAM) return CAM; try { CAM = await A.api('/api/tv/cams'); } catch (e) { CAM = { cams: [], cats: [] }; } if (!CAM || !CAM.cams) CAM = { cams: [], cats: [] }; return CAM; }
  const camCard = c => {
    const on = P.kind === 'yt' && P.item && P.item.id === c.id;
    return '<div class="cam-card' + (on ? ' on' : '') + '" data-cam="' + esc(c.id) + '" data-a="camplay" title="Watch ' + esc(c.name) + '"><div class="cam-th"><img loading="lazy" src="/api/tv/yt/thumb?id=' + encodeURIComponent(c.id) + '" alt="" onerror="this.style.display=\'none\'"><span class="yt-live">LIVE</span></div><b>' + esc(c.name) + '</b><span class="small mute">' + esc(c.ch) + '</span></div>';
  };
  function drawCams() {
    if (!CAM) return '<div class="rd-empty">⏳ Loading the cameras…</div>';
    const cats = CAM.cats || [], f = filter.toLowerCase();
    const all = CAM.cams.filter(c => (!camCat || c.cat === camCat) && (!f || (c.name + ' ' + c.ch).toLowerCase().includes(f)));
    /* all 317 pictures at once would hammer the machine: ninety at a time, with a button for the rest */
    camList = all.slice(0, camShown);
    let h = '<div class="row" style="flex-wrap:wrap;margin-bottom:8px"><b style="flex:1;min-width:180px">🌍 Live cameras <span class="small mute">· ' + CAM.cams.length.toLocaleString() + ' public webcams, always on</span></b><button class="ib" data-a="camfind"' + (camBusy ? ' disabled' : '') + '>🔎 Find more on YouTube</button></div>' +
      '<div class="small mute" style="margin-bottom:8px">Public 24/7 streams, found on YouTube and checked on 16 November 2026. Press a camera to watch it, then flip with ← and → (or ◀ ▶ in the player). A stream stops when its owner stops sending; 🔎 finds new ones.</div>' +
      '<div class="rd-cats" style="padding:0 0 10px"><button class="ib' + (!camCat ? ' on' : '') + '" data-camcat="">All <span class="mute">' + CAM.cams.length + '</span></button>' + cats.map(c => { const n = CAM.cams.filter(x => x.cat === c[0]).length; return n ? '<button class="ib' + (camCat === c[0] ? ' on' : '') + '" data-camcat="' + esc(c[0]) + '">' + esc(c[1]) + ' <span class="mute">' + n + '</span></button>' : ''; }).join('') + '</div>';
    if (camBusy) return h + '<div class="rd-empty">⏳ ' + esc(camBusy) + '</div>';
    if (camFound && camFound.length) h += '<h3 class="tv-h">🔎 Found just now <span class="small mute">' + camFound.length + '</span></h3><div class="cam-grid">' + camFound.map(camCard).join('') + '</div><h3 class="tv-h">📷 The shelves</h3>';
    if (!camList.length) return h + '<div class="rd-empty">' + (f ? 'No camera matches “' + esc(filter) + '”.' : 'Nothing here yet.') + '</div>';
    return h + '<div class="cam-grid">' + camList.map(camCard).join('') + '</div>' +
      (all.length > camList.length ? '<div class="row" style="justify-content:center;margin:12px 0"><button class="ib" data-a="cammore">Show more cameras <span class="mute">' + (all.length - camList.length) + '</span></button></div>' : '');
  }
  function playCam(c) {
    if (!c) return;
    if (S && !S.internet) return A.notify('warn', 'Internet access is off. Turn it on at the top of the TV tab.');
    playYt({ id: c.id, title: c.name, channel: c.ch, cam: 1 });
  }
  /* flipping: the next (or previous) camera on the shelf you are looking at, wrapping round at the end */
  function flip(d) {
    if (!camList.length) return;
    const at = P.item ? camList.findIndex(c => c.id === P.item.id) : -1;
    playCam(camList[at < 0 ? 0 : (at + d + camList.length) % camList.length]);
  }
  /* fresh cameras from YouTube's live results, for when a stream has gone quiet */
  async function findCams() {
    if (S && !S.internet) return A.notify('warn', 'Internet access is off. Turn it on at the top of the TV tab.');
    const label = (CAM.cats.find(c => c[0] === camCat) || [])[1] || '';
    const q = ((filter || label.replace(/[^\p{L}\p{N} ]/gu, '')).trim() || 'world') + ' live webcam';
    camBusy = 'Asking YouTube for live cameras matching “' + q + '”…'; drawBody();
    let r = null; try { r = await A.api('/api/tv/yt/search?q=' + encodeURIComponent(q)); } catch (e) { }
    camBusy = '';
    if (r && r.error) A.notify('warn', r.error);
    const have = new Set((CAM.cams || []).concat(camFound || []).map(c => c.id));
    const fresh = ((r && r.videos) || []).filter(v => v.live && !have.has(v.id)).map(v => ({ id: v.id, name: v.title.replace(/\s+/g, ' ').slice(0, 80), ch: v.channel || 'YouTube', cat: camCat || 'found' }));
    if (!fresh.length) A.notify('warn', 'No new live cameras came back for that. Try another shelf or another word.');
    else { camFound = (camFound || []).concat(fresh).slice(0, 60); A.notify('ok', 'Found ' + fresh.length + ' more live camera' + (fresh.length === 1 ? '' : 's') + '.'); }
    drawBody();
  }
  function drawList() {
    const counts = {}; list.channels.forEach(c => { const g = c.group || 'Other'; counts[g] = (counts[g] || 0) + 1; });
    const f = filter.toLowerCase(), hit = list.channels.filter(c => (!cat || (c.group || 'Other') === cat) && (!f || (c.name + ' ' + c.group + ' ' + c.cc).toLowerCase().includes(f)));
    const cats = Object.keys(counts).sort((a, b) => counts[b] - counts[a]);
    return '<div class="row" style="flex-wrap:wrap;margin-bottom:8px"><button class="ib" data-a="back">← My channels</button><b style="flex:1;min-width:160px">' + esc(list.name) + ' <span class="small mute">· ' + list.channels.length.toLocaleString() + ' channels</span></b></div>' +
      '<div class="rd-cats" style="padding:0 0 10px"><button class="ib' + (!cat ? ' on' : '') + '" data-cat="">All</button>' + cats.map(g => '<button class="ib' + (cat === g ? ' on' : '') + '" data-cat="' + esc(g) + '">' + esc(g) + ' <span class="mute">' + counts[g] + '</span></button>').join('') + '</div>' +
      (hit.length ? '<div class="tv-grid">' + hit.slice(0, 240).map(c => tile(c, { save: 1 })).join('') + '</div>' + (hit.length > 240 ? '<div class="small mute" style="margin:10px 2px">Showing 240 of ' + hit.length.toLocaleString() + '. Pick a category or type in the box above to narrow it.</div>' : '') : '<div class="rd-empty">No channel matches.</div>') +
      '<div class="small mute" style="margin:10px 2px">Press ☆ to keep a channel in My channels. Channels marked “may only work in some countries” often refuse to play here.</div>';
  }
  function drawYt() {
    let h = '<div class="rd-cats" style="padding:0 0 10px">' + TOPICS.map(t => '<button class="ib' + (yt.q === t[1] ? ' on' : '') + '" data-yt="' + esc(t[1]) + '">' + esc(t[0]) + '</button>').join('') + '</div>';
    if (yt.busy) return h + '<div class="rd-empty">⏳ Searching YouTube…</div>';
    if (yt.err) return h + '<div class="rd-empty">' + esc(yt.err) + '</div>';
    if (!yt.res) return h + '<div class="rd-empty">Search above, or pick a topic. Videos play right here, with ⛶ Full screen.</div>';
    if (!yt.res.length) return h + '<div class="rd-empty">Nothing found for “' + esc(yt.q) + '”.</div>';
    return h + '<div class="yt-grid">' + yt.res.map(v => '<div class="yt-card" data-id="' + esc(v.id) + '" data-a="yt" title="' + esc(v.title) + '"><div class="yt-th">' + (S.dl && S.dl.tool.found ? '<button class="yt-dl" data-a="ytdl" title="Download this video">⬇</button>' : '') + '<img loading="lazy" src="/api/tv/yt/thumb?id=' + encodeURIComponent(v.id) + '" alt="">' + (v.live ? '<span class="yt-live">LIVE</span>' : v.len ? '<span class="yt-len">' + esc(v.len) + '</span>' : '') + '</div><b>' + esc(v.title) + '</b><span class="small mute">' + esc([v.channel, v.views, v.when].filter(Boolean).join(' · ')) + '</span></div>').join('') + '</div>' +
      '<div class="small mute" style="margin:10px 2px">Videos play in YouTube’s privacy-enhanced player, with no account or sign-in. Some videos are not allowed to play outside youtube.com; they say so in the player.</div>';
  }
  async function ytSearch(q) {
    q = String(q || '').trim(); if (!q) return;
    yt.q = q; if (q$('#tvq')) q$('#tvq').value = q;
    const id = idFromLink(q); if (id) return playYt({ id, title: 'YouTube video', channel: 'YouTube' });
    if (!S.internet) return A.notify('warn', 'Internet access is off. Turn it on at the top of the TV tab.');
    yt.busy = true; yt.err = ''; drawBody();
    const mine = ++yt.seq;
    let r; try { const c = new AbortController(), timer = setTimeout(() => c.abort(), 22000); r = await (await fetch('/api/tv/yt/search?q=' + encodeURIComponent(q), { signal: c.signal })).json(); clearTimeout(timer); } catch (e) { r = { error: e.name === 'AbortError' ? 'YouTube is taking too long. Press a topic or search again.' : 'The search failed: ' + e.message }; }
    if (mine !== yt.seq) return;          // a newer search started: ignore this answer
    yt.busy = false; yt.res = r.videos || []; yt.err = r.error || ''; drawBody();
  }
  function idFromLink(s) {
    if (/^[A-Za-z0-9_-]{11}$/.test(s) && /[0-9_-]/.test(s) && /[A-Z]/.test(s)) return s;
    try { const u = new URL(s); if (!/(^|\.)(youtube\.com|youtu\.be|youtube-nocookie\.com)$/i.test(u.hostname)) return ''; if (/youtu\.be$/i.test(u.hostname)) return u.pathname.slice(1, 12); const v = u.searchParams.get('v'); if (v) return v.slice(0, 11); const m = /\/(embed|shorts|live)\/([A-Za-z0-9_-]{11})/.exec(u.pathname); return m ? m[2] : ''; } catch (e) { return ''; }
  }
  /* ---------- downloads: yt-dlp saves videos into Videos\\Moundshroud Downloads, sorted into folders (lib/ytdl.js) ---------- */
  let dlq = '', dlF = ls.get('tv_dlf', ''), dlTimer = 0;
  const KINDS = [['both', '🎬 Whole video', 'One file with picture and sound (MP4).'], ['split', '🎞 Picture and sound separately', 'Two files: the picture (MP4, no sound) and the sound (M4A).'], ['audio', '🎵 Sound only', 'An MP3, for music, talks and podcasts.'], ['video', '🖼 Picture only', 'The picture with no sound (MP4).']];
  const fsz = n => n > 1e9 ? (n / 1e9).toFixed(1) + ' GB' : n > 1e6 ? Math.round(n / 1e6) + ' MB' : Math.max(1, Math.round(n / 1e3)) + ' KB';
  async function loadDl() { try { S.dl = await A.api('/api/tv/dl'); } catch (e) { } }
  function pollDl() { clearTimeout(dlTimer); if (!S.dl || !S.dl.jobs.some(j => j.state === 'running')) return; dlTimer = setTimeout(async () => { const before = S.dl.items.length; await loadDl(); if (view === 'dl') drawBody(); if (S.dl.items.length > before) A.notify('ok', '📥 Download finished: ' + S.dl.items[0].title); pollDl(); }, 1200); }
  function askDownload(v) {
    if (!S.dl || !S.dl.tool.found) return A.notify('warn', 'yt-dlp was not found on this PC.');
    if (!S.internet) return A.notify('warn', 'Internet access is off. Turn it on at the top of the TV tab.');
    const pick = ls.get('tv_dlk', 'both');
    A.dlg('<div class="hd"><b>⬇ Download</b></div><div class="bd"><div style="margin-bottom:10px"><b>' + esc(v.title) + '</b>' + (v.channel ? '<div class="small mute">' + esc(v.channel) + '</div>' : '') + '</div>' +
      KINDS.map(k => '<label class="tv-dlopt"><input type="radio" name="tvdlk" value="' + k[0] + '"' + (k[0] === pick ? ' checked' : '') + '><span><b>' + k[1] + '</b><span class="small mute" style="display:block">' + k[2] + '</span></span></label>').join('') +
      '<div class="row" style="margin-top:10px;gap:8px;flex-wrap:wrap"><span class="small">Put it in</span><select id="tvdlfold"><option value="">Downloads (no folder)</option>' + S.dl.folders.map(f => '<option value="' + esc(f.id) + '"' + (f.id === dlF ? ' selected' : '') + '>📁 ' + esc(f.name) + '</option>').join('') + '</select></div>' +
      '<div class="small mute" style="margin-top:8px">Saved in ' + esc(S.dl.home) + '. Only download videos you have the right to keep.</div>' +
      '<div class="row" style="margin-top:12px"><span class="sp"></span><button class="ib" id="tvdlno">Cancel</button><button class="pri" id="tvdlgo">⬇ Download</button></div></div>');
    document.getElementById('tvdlno').onclick = () => A.closeDlg();
    document.getElementById('tvdlgo').onclick = async () => {
      const kind = (document.querySelector('input[name="tvdlk"]:checked') || {}).value || 'both', folder = document.getElementById('tvdlfold').value; ls.set('tv_dlk', kind); A.closeDlg();
      const r = await post('/api/tv/dl/start', { vid: v.id, title: v.title, channel: v.channel || '', kind, folder }); if (!r) return;
      await loadDl(); pollDl(); A.notify('ok', '⬇ Downloading “' + v.title + '”. Watch it in 📥 Downloads.'); if (view === 'dl') drawBody();
    };
  }
  function drawDl() {
    const D = S.dl; if (!D) return '<div class="rd-empty">⏳ Loading…</div>';
    if (!D.tool.found) return '<div class="rd-empty">yt-dlp was not found. Put yt-dlp.exe in one of these places, then come back:<br>' + D.tool.places.map(p => '<code>' + esc(p) + '</code>').join('<br>') + '</div>';
    if (dlF && !D.folders.some(f => f.id === dlF)) dlF = '';
    const ql = dlq.toLowerCase(), inF = it => !dlF || (dlF === '-' ? !it.folder : it.folder === dlF), shown = D.items.filter(it => inF(it) && (!ql || (it.title + ' ' + it.channel).toLowerCase().includes(ql)));
    const cnt = f => D.items.filter(it => f === '-' ? !it.folder : it.folder === f).length, cur = D.folders.find(f => f.id === dlF);
    const jobs = D.jobs.filter(j => j.state !== 'done');
    const fsel = it => '<select data-dmv="' + esc(it.id) + '" title="Move to a folder" style="max-width:150px"><option value="">No folder</option>' + D.folders.map(f => '<option value="' + esc(f.id) + '"' + (it.folder === f.id ? ' selected' : '') + '>📁 ' + esc(f.name) + '</option>').join('') + '</select>';
    const ICONS = { video: '🎬', picture: '🖼', audio: '🎵' }, NAMES = { video: 'Video', picture: 'Picture', audio: 'Sound' };
    return '<div class="small mute" style="margin-bottom:8px">Videos you download from ▶ YouTube (press ⬇ on any video). They are saved in <b>' + esc(D.home) + '</b>, one folder on disk per folder here. yt-dlp ' + esc(D.tool.version || '') + '.</div>' +
      (jobs.length ? '<div class="card" style="margin-bottom:10px"><b>⬇ Downloading</b>' + jobs.map(j => '<div class="row" style="gap:8px;padding:6px 0;flex-wrap:wrap" data-job="' + esc(j.id) + '"><span style="flex:1;min-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(j.title) + '</span>' + (j.state === 'running' ? '<span class="tv-bar"><i style="width:' + j.pct + '%"></i></span><span class="small mute" style="min-width:150px">' + Math.round(j.pct) + '% ' + esc(j.speed || '') + (j.eta && j.eta !== 'NA' ? ' · ' + esc(j.eta) + ' left' : '') + '</span><button class="ib" data-a="dlstop">■ Stop</button>' : j.state === 'failed' ? '<span class="small rd-bad">' + esc(j.error) + '</span>' : '<span class="small mute">Stopped</span>') + '</div>').join('') + '</div>' : '') +
      '<div class="rd-cats" style="padding:0 0 8px"><button class="ib' + (!dlF ? ' on' : '') + '" data-dlf="">All <span class="mute">' + D.items.length + '</span></button><button class="ib' + (dlF === '-' ? ' on' : '') + '" data-dlf="-">Not in a folder <span class="mute">' + cnt('-') + '</span></button>' + D.folders.map(f => '<button class="ib' + (dlF === f.id ? ' on' : '') + '" data-dlf="' + esc(f.id) + '">📁 ' + esc(f.name) + ' <span class="mute">' + cnt(f.id) + '</span></button>').join('') + '<button class="ib" data-a="dlnewf">➕ New folder</button>' + (cur ? '<button class="ib" data-a="dlrenf">✎ Rename folder</button><button class="ib" data-a="dldelf">🗑 Remove folder</button>' : '') + '</div>' +
      (shown.length ? shown.map(it => '<div class="card tv-dlitem" data-did="' + esc(it.id) + '" style="margin-bottom:8px"><div class="row" style="gap:10px;align-items:flex-start;flex-wrap:wrap"><img class="tv-dlth" loading="lazy" src="/api/tv/yt/thumb?id=' + encodeURIComponent(it.vid) + '" alt=""><div style="flex:1;min-width:200px"><b>' + esc(it.title) + '</b><div class="small mute">' + esc([it.channel, it.label, new Date(it.at).toLocaleDateString()].filter(Boolean).join(' · ')) + '</div>' +
        it.files.map(f => '<div class="row small" style="gap:6px;margin-top:6px;flex-wrap:wrap" data-n="' + f.n + '"><span style="min-width:90px">' + ICONS[f.kind] + ' ' + NAMES[f.kind] + '</span>' + (f.there ? '<button class="ib" data-a="dlplay">▶ Play</button><a class="ib" style="text-decoration:none" href="/api/tv/dl/file?id=' + encodeURIComponent(it.id) + '&n=' + f.n + '&dl=1" download>⬇ Save a copy</a><span class="mute">' + fsz(f.size) + '</span>' : '<span class="rd-bad">missing from the folder</span>') + '</div>').join('') +
        '</div><div class="row" style="gap:6px;flex-wrap:wrap"><button class="ib" data-a="dlren" title="Rename">✎</button>' + fsel(it) + '<button class="ib" data-a="dldel" title="Delete the files">🗑</button></div></div></div>').join('') :
        '<div class="rd-empty">' + (D.items.length ? 'Nothing here.' : 'No downloads yet. Open ▶ YouTube and press ⬇ on a video.') + '</div>');
  }
  async function dlClick(a, b) {
    const card = b.closest('[data-did]'), it = card && S.dl ? S.dl.items.find(x => x.id === card.dataset.did) : null;
    if (a === 'dlnewf') { const n = prompt('Name of the new folder:'); if (!n) return; const r = await post('/api/tv/dl/folder', { name: n }); if (r) { S.dl = r; dlF = r.created; ls.set('tv_dlf', dlF); drawBody(); } return; }
    if (a === 'dlrenf') { const f = S.dl.folders.find(x => x.id === dlF), n = prompt('New name for this folder:', f ? f.name : ''); if (!n) return; const r = await post('/api/tv/dl/folder', { rename: dlF, name: n }); if (r) { S.dl = r; drawBody(); } return; }
    if (a === 'dldelf') { if (!confirm('Remove this folder? Its downloads stay, under "Not in a folder".')) return; const r = await post('/api/tv/dl/folder', { remove: dlF }); if (r) { S.dl = r; dlF = ''; drawBody(); } return; }
    if (a === 'dlstop') { const j = b.closest('[data-job]'); const r = await post('/api/tv/dl/cancel', { id: j.dataset.job }); if (r) { S.dl = r; drawBody(); } return; }
    if (!it) return;
    if (a === 'dlplay') { const n = +b.closest('[data-n]').dataset.n, f = it.files[n]; playChannel({ id: it.id + ':' + n, name: it.title + (it.files.length > 1 ? ' · ' + (f.kind === 'audio' ? 'sound' : 'picture') : ''), file: 1 }, '/api/tv/dl/file?id=' + encodeURIComponent(it.id) + '&n=' + n); return; }
    if (a === 'dlren') { const n = prompt('New name:', it.title); if (!n || n === it.title) return; const r = await post('/api/tv/dl/rename', { id: it.id, title: n }); if (r) { S.dl = r; drawBody(); } return; }
    if (a === 'dldel') { if (!confirm('Delete “' + it.title + '”? Its file' + (it.files.length > 1 ? 's are' : ' is') + ' removed from ' + S.dl.home + '. This cannot be undone.')) return; if (P.item && String(P.item.id).startsWith(it.id + ':')) stop(); const r = await post('/api/tv/dl/remove', { id: it.id }); if (r) { S.dl = r; drawBody(); } return; }
  }
  function draw() { drawTop(); drawPlayer(); drawBody(); }

  /* ---------- clicks ---------- */
  async function post(path, body) { try { const r = await A.api(path, body); if (r && r.error) { A.notify('err', r.error); return null; } return r; } catch (e) { A.notify('err', 'That did not work: ' + e.message); return null; } }
  async function onClick(e) {
    const v = e.target.closest('[data-v]'); if (v) { view = v.dataset.v; ls.set('tv_view', view); filter = ''; found = null; if (view === 'dl') { await loadDl(); pollDl(); } if (view === 'cams') await loadCams(); return draw(); }
    const cc = e.target.closest('[data-camcat]'); if (cc) { camCat = cc.dataset.camcat; ls.set('tv_camcat', camCat); filter = ''; camShown = 90; return draw(); }
    const tp = e.target.closest('[data-yt]'); if (tp) return ytSearch(tp.dataset.yt);
    const df = e.target.closest('[data-dlf]'); if (df) { dlF = df.dataset.dlf; ls.set('tv_dlf', dlF); return drawBody(); }
    const db0 = e.target.closest('[data-a]'); if (db0 && /^dl(?!cur)/.test(db0.dataset.a)) return dlClick(db0.dataset.a, db0);
    if (db0 && db0.dataset.a === 'dlcur') return P.kind === 'yt' && askDownload(P.item);
    if (db0 && db0.dataset.a === 'ytdl') { e.stopPropagation(); const v0 = (yt.res || []).find(x => x.id === db0.closest('[data-id]').dataset.id); return v0 && askDownload(v0); }
    const ct = e.target.closest('[data-cat]'); if (ct) { cat = ct.dataset.cat; return drawBody(); }
    const b = e.target.closest('[data-a]'); if (!b) return;
    const a = b.dataset.a, holder = b.closest('[data-id]'), id = holder ? holder.dataset.id : '';
    const item = id ? ((list && list.channels.find(c => c.id === id)) || (found && found.channels.find(c => c.id === id)) || S.links.find(x => x.id === id) || (yt.res || []).find(x => x.id === id)) : null;
    if (a === 'prev') return flip(-1);
    if (a === 'next') return flip(1);
    if (a === 'camfind') return findCams();
    if (a === 'cammore') { camShown += 90; return drawBody(); }
    if (a === 'camplay') { const cid = b.closest('[data-cam]'); if (!cid) return; const id2 = cid.dataset.cam; return playCam((CAM && CAM.cams.find(x => x.id === id2)) || (camFound || []).find(x => x.id === id2)); }
    if (a === 'fs') return toggleFs();
    if (a === 'close') return stop();
    if (a === 'neton') { if (await post('/api/cloud', { web: true })) { if (A.net) A.net.refresh(); await load(); draw(); } return; }
    if (a === 'back') { list = null; more = false; cat = ''; filter = ''; found = null; return draw(); }
    if (a === 'more') { more = true; filter = ''; found = null; try { S.sources = (await A.api('/api/tv/sources')).sources; } catch (x) { } return draw(); }
    if (a === 'srcadd' || a === 'srcall') { const sid = a === 'srcall' ? 'all' : (b.closest('[data-src]') || {}).dataset.src; const r = await post('/api/tv/sources/add', { id: sid }); if (r) { S = r; S.sources = r.sources; drawBody(); A.notify('ok', a === 'srcall' ? 'Added every list to My channels.' : 'Added to My channels.'); } return; }
    if (a === 'addtog') { addOpen = !addOpen; return drawBody(); }
    if (a === 'import') { const r = await post('/api/tv/import', {}); if (r) { S = r; drawBody(); A.notify('ok', 'Imported ' + r.imported + ' link' + (r.imported === 1 ? '' : 's') + ' from VLC.'); } return; }
    if (a === 'names') { busy = 'Looking the names up in the free channel index…'; drawBody(); const r = await post('/api/tv/names', {}); busy = ''; if (r) { S = r; A.notify('ok', r.renamed ? 'Updated ' + r.renamed + ' name' + (r.renamed === 1 ? '' : 's') + '.' : 'No new names found.'); } return drawBody(); }
    if (a === 'add') { const url = q$('#tvau').value.trim(), name = q$('#tvan').value.trim(); if (!url) return A.notify('warn', 'Paste the link’s address.'); const r = await post('/api/tv/add', { url, name }); if (r) { S = r; addOpen = false; drawBody(); A.notify('ok', 'Added.'); } return; }
    if (!item) return;
    if (a === 'yt') return playYt(item);
    if (a === 'save') { e.stopPropagation(); const r = await post('/api/tv/add', { channel: item.id }); if (r) { S = r; A.notify('ok', 'Saved “' + item.name + '” to My channels.'); } return; }
    if (a === 'ren') { e.stopPropagation(); const n = prompt('New name for this channel:', item.name); if (n == null) return; const r = await post('/api/tv/rename', { id: item.id, name: n }); if (r) { S = r; drawBody(); } return; }
    if (a === 'rm') { e.stopPropagation(); if (!confirm('Remove “' + item.name + '” from My channels?')) return; if (P.item && P.item.id === item.id) stop(); const r = await post('/api/tv/remove', { id: item.id }); if (r) { S = r; drawBody(); } return; }
    if (a === 'openlist' || (a === 'play' && item.list)) {
      if (!S.internet) return A.notify('warn', 'Internet access is off. Turn it on at the top of the TV tab.');
      busy = 'Opening “' + item.name + '”…'; drawBody();
      const r = await post('/api/tv/open', { id: item.id }); busy = '';
      if (!r) return drawBody();
      if (r.links) S.links = r.links;
      if (r.kind === 'list') { list = { name: r.name, channels: r.channels || [] }; cat = ''; filter = ''; return draw(); }
      drawBody(); return playChannel(item);
    }
    if (a === 'play' && item.yt) {
      if (!S.internet) return A.notify('warn', 'Internet access is off. Turn it on at the top of the TV tab.');
      const r = await post('/api/tv/yt/live?id=' + encodeURIComponent(item.id)); if (!r) return; return playYt({ id: r.id, title: item.name, channel: 'Live on YouTube' });
    }
    if (a === 'play') return P.kind === 'video' && P.item && P.item.id === item.id ? stop() : playChannel(item);
  }

  /* leaving the tab stops the picture (a video playing out of sight only uses the connection) */
  const show = A.showTab; A.showTab = function (name) { if (name !== 'tv' && A.cur === 'tv' && P.kind) stop(); return show.apply(this, arguments); };
  A.registerTab('tv', 'TV', async () => {
    const first = !q$('#tvbody'); if (first) shell();
    more = false;
    if (view === 'cams') await loadCams();
    await load(); draw();
  });
  A.tv = { stop, escape: () => { if (filled()) { exitFs(); return true; } if (P.kind) { stop(); return true; } return false; }, playing: () => P.kind ? { kind: P.kind, name: P.kind === 'yt' ? P.item.title : P.item.name } : null, search: q => { A.showTab('tv'); view = 'yt'; setTimeout(() => { draw(); ytSearch(q); }, 100); } };
})();

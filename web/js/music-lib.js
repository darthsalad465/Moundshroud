// Music tab: a Spotify-style library of freely licensed music stored on this PC (web/music/*, described by web/music/catalog.json).
// Home with daily mixes, browse by genre / mood / artist / album, search, playlists, liked songs, queue, sleep timer, history. Playback continues across tabs.
// Game music (A.music) and this player take turns: starting one pauses the other.
(() => {
  const P = document.getElementById('p-music'); if (!P) return;
  const esc2 = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const rd = (k, d) => { try { return JSON.parse(ls.get(k, JSON.stringify(d))); } catch (e) { return d; } };
  const wr = (k, v) => { try { ls.set(k, JSON.stringify(v)); } catch (e) { } };
  const fmt = s => { if (!isFinite(s) || s < 0) return '0:00'; s = Math.floor(s); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
  const ns = n => n + (n === 1 ? ' song' : ' songs');
  const fmtLong = s => { const h = Math.floor(s / 3600), m = Math.round(s % 3600 / 60); return h ? h + ' hr ' + m + ' min' : m + ' min'; };

  /* ---------- look ---------- */
  const GI = { Rock: '🎸', Electronic: '🎛️', Jazz: '🎷', Cinematic: '🎬', 'Chill & Contemporary': '🌊', 'Ambient & Experimental': '🌌', World: '🌍', Funk: '🕺', Pop: '🎤', Reggae: '🌴', Blues: '🎺', Disco: '🪩', Latin: '💃', Modern: '🏙️', 'Dark & Horror': '🦇', 'Silent Film': '🎞️', Classical: '🎻', Holiday: '🎄', Polka: '🪗', Ska: '🎺', 'Hip-Hop & Urban': '🎧' };
  const MOODS = { chill: ['Chill', '🌿'], focus: ['Focus', '🎯'], happy: ['Feel Good', '☀️'], energy: ['Energy', '⚡'], epic: ['Epic', '🏔️'], dark: ['Dark & Moody', '🌑'], sad: ['Melancholy', '🌧️'], romantic: ['Romance', '💞'], sleep: ['Sleep', '😴'] };
  const hue = s => { let h = 7; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h % 360; };
  const cv = (key, icon, cls) => { const h = hue(key); return '<div class="ml-cv ' + (cls || '') + '" style="background:linear-gradient(135deg,hsl(' + h + ' 62% 46%),hsl(' + (h + 48) % 360 + ' 68% 26%))"><span>' + icon + '</span></div>'; };
  const css = '.ml-wrap{display:grid;grid-template-columns:218px 1fr;flex:1;min-height:0}.ml-side{padding:12px 10px;border-right:1px solid var(--line);overflow:auto;display:flex;flex-direction:column;gap:2px}.ml-side h4{margin:12px 8px 4px;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--mute)}.ml-nav{display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:9px;cursor:pointer;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.ml-nav:hover{background:var(--panel2)}.ml-nav.on{background:var(--panel2);color:var(--acc);font-weight:600}.ml-main{overflow:auto;padding:16px 22px 24px;min-width:0}' +
    '.ml-cv{aspect-ratio:1;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:44px;color:#fff;box-shadow:0 6px 18px rgba(0,0,0,.35);overflow:hidden}.ml-cv.s{width:40px;height:40px;font-size:19px;border-radius:7px;box-shadow:none;flex:none}.ml-cv.m{width:52px;height:52px;font-size:24px;border-radius:8px;box-shadow:none;flex:none}' +
    '.ml-shelf{display:grid;grid-auto-flow:column;grid-auto-columns:158px;gap:14px;overflow-x:auto;padding:4px 2px 12px}.ml-card{cursor:pointer;padding:10px;border-radius:12px;background:var(--panel);border:1px solid var(--line);transition:transform .15s,background .15s}.ml-card:hover{transform:translateY(-3px);background:var(--panel2)}.ml-card b{display:block;margin-top:8px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.ml-card .small{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:block}' +
    '.ml-tiles{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:10px;margin-bottom:14px}.ml-tile{display:flex;align-items:center;gap:10px;background:var(--panel);border:1px solid var(--line);border-radius:10px;cursor:pointer;overflow:hidden;padding-right:10px}.ml-tile:hover{background:var(--panel2)}.ml-tile b{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
    '.ml-hero{display:flex;gap:18px;align-items:flex-end;padding:20px;border-radius:16px;margin-bottom:14px;color:#fff;min-height:150px}.ml-hero .ml-cv{width:130px;flex:none;font-size:56px}.ml-hero h1{margin:2px 0 6px;font-size:30px;line-height:1.1}.ml-row{display:grid;grid-template-columns:34px minmax(0,1fr) minmax(0,.7fr) 34px 52px 30px;gap:10px;align-items:center;padding:6px 8px;border-radius:9px;cursor:pointer}.ml-row:hover{background:var(--panel2)}.ml-row.on{background:var(--panel2)}.ml-row .tt{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.ml-row .num{text-align:center;color:var(--mute)}.ml-row.on .tt b{color:var(--acc)}.ml-btn{background:none;border:0;color:var(--mute);cursor:pointer;font-size:16px;padding:2px 4px;border-radius:6px}.ml-btn:hover{color:var(--text);background:var(--panel2)}.ml-btn.liked{color:var(--bad)}' +
    '.ml-chip{display:inline-flex;align-items:center;gap:6px;padding:6px 12px;border-radius:999px;background:var(--panel);border:1px solid var(--line);cursor:pointer;margin:0 6px 6px 0}.ml-chip:hover{background:var(--panel2)}.ml-bar{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.5fr) minmax(0,1fr);gap:14px;align-items:center;padding:10px 16px;border-top:1px solid var(--line);background:var(--panel)}.ml-bar .mid{display:flex;flex-direction:column;gap:4px;align-items:center}.ml-bar input[type=range]{accent-color:var(--acc)}.ml-play{width:42px;height:42px;border-radius:50%;border:0;background:var(--text);color:var(--bg,#000);font-size:18px;cursor:pointer}' +
    '.ml-queue{position:absolute;right:0;top:0;bottom:0;width:340px;max-width:92%;background:var(--panel);border-left:1px solid var(--line);box-shadow:-10px 0 30px rgba(0,0,0,.4);padding:14px;overflow:auto;z-index:20}.ml-menu{position:fixed;z-index:60;min-width:200px;max-width:280px;background:var(--panel);border:1px solid var(--line);border-radius:12px;box-shadow:0 14px 40px rgba(0,0,0,.5);padding:6px}.ml-menu div{padding:7px 10px;border-radius:8px;cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.ml-menu div:hover{background:var(--panel2)}.ml-menu hr{border:0;border-top:1px solid var(--line);margin:4px 0}' +
    '@media(max-width:860px){.ml-wrap{grid-template-columns:1fr;grid-template-rows:auto 1fr}.ml-side{flex-direction:row;border-right:0;border-bottom:1px solid var(--line);overflow-x:auto;padding:8px}.ml-side h4{display:none}.ml-nav span{display:none}.ml-nav{padding:8px 12px;font-size:17px}.ml-row{grid-template-columns:30px minmax(0,1fr) 34px 46px 28px}.ml-row .alb{display:none}.ml-bar{grid-template-columns:1fr;gap:6px}.ml-hero{flex-direction:column;align-items:flex-start}}';
  if (!document.getElementById('mlcss')) { const st = document.createElement('style'); st.id = 'mlcss'; st.textContent = css; document.head.appendChild(st); }

  /* ---------- data ---------- */
  let CAT = [], BY = {}, GEN = {}, MOOD = {}, ART = {}, ALB = {}, DEC = {}, base = [], mine = [], loaded = null, built = false;
  const rec = window.MLMine ? MLMine.rec : { state: 'idle' };
  let likes = new Set(rd('mlfav', []).map(k => String(k).replace('/web/music/', ''))), pls = rd('mlpl', []), recent = rd('mlrecent', []), stats = rd('mlstats', {}), dcache = rd('mldur', {});
  const saveLikes = () => wr('mlfav', [...likes]), savePl = () => wr('mlpl', pls);
  const reindex = () => { BY = {}; GEN = {}; MOOD = {}; ART = {}; ALB = {}; DEC = {}; CAT.forEach(t => { BY[t.i] = t; if (!t.d && dcache[t.i]) t.d = dcache[t.i]; (GEN[t.g] = GEN[t.g] || []).push(t); (t.m || []).forEach(m => (MOOD[m] = MOOD[m] || []).push(t)); (ART[t.a] = ART[t.a] || []).push(t); if (t.al) (ALB[t.al] = ALB[t.al] || []).push(t); if (t.y) { const d = Math.floor(t.y / 10) * 10; (DEC[d] = DEC[d] || []).push(t); } }); Object.keys(ALB).forEach(k => { if (ALB[k].length < 2 && !ALB[k][0].my) delete ALB[k]; }); };
  /* your own songs come from the browser's storage, which can stall; never let that hold up the whole library */
  const mineList = () => Promise.race([window.MLMine ? MLMine.list() : Promise.resolve([]), new Promise(r => setTimeout(() => r([]), 3000))]).then(a => a.map((t, k) => Object.assign(t, { n: 1e6 + k })));
  const refreshMine = async () => { mine = await mineList(); CAT = base.concat(mine); reindex(); };
  const load = () => loaded || (loaded = fetch('/web/music/catalog.json').then(r => r.json()).catch(() => []).then(async c => { base = c; await refreshMine(); return CAT; }));
  const ids2t = ids => ids.map(i => BY[i]).filter(Boolean), dur = l => l.reduce((a, t) => a + (t.d || 0), 0);
  const mulberry = a => () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const shuf = (arr, rnd) => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor((rnd || Math.random)() * (i + 1));[a[i], a[j]] = [a[j], a[i]]; } return a; };
  const daySeed = () => { const d = new Date(); return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate(); };
  const MIXES = [
    ['Rock Out', '🎸', t => t.g === 'Rock'], ['Chill Vibes', '🌿', t => (t.m || []).includes('chill') && t.g !== 'Classical' && !(t.m || []).includes('dark')], ['Focus Flow', '🎯', t => (t.m || []).includes('focus')], ['Feel Good', '☀️', t => (t.m || []).includes('happy')],
    ['Epic & Cinematic', '🏔️', t => t.g === 'Cinematic' || (t.m || []).includes('epic')], ['Jazz Lounge', '🎷', t => t.g === 'Jazz' || t.g === 'Blues'], ['Electronic Night', '🎛️', t => t.g === 'Electronic'], ['World Tour', '🌍', t => ['World', 'Reggae', 'Latin', 'Funk', 'Disco', 'Ska', 'Pop'].includes(t.g)],
    ['Classical Calm', '🎻', t => t.g === 'Classical' && (t.m || []).includes('chill')], ['Late Night', '🌙', t => (t.m || []).includes('sleep') || (t.m || []).includes('dark')]];
  const mixTracks = (i, n) => { const m = MIXES[i], r = mulberry(daySeed() + i * 977); return shuf(CAT.filter(m[2]), r).slice(0, n || 40); };

  /* ---------- playback ---------- */
  const au = new Audio(); au.preload = 'metadata'; au.volume = Math.max(0, Math.min(1, +ls.get('mlvol', '70') / 100));
  let cur = null, ctx = { ids: [], name: '', order: [], pos: -1 }, uq = [], shuffle = ls.get('mlshuf', '0') === '1', rep = ls.get('mlrep', 'all'), tok = 0, sleepAt = 0, sleepEnd = false, sleepT = 0, view = { t: 'home' }, hist = [], reg = {}, lid = 0, showQ = false;
  /* A song from the Music tab outranks a game's music. gameArgs remembers the game's music while a song plays, so it comes back once the song is paused. */
  let gameArgs = null, innerStop = false;
  const stopGame = () => { try { if (A.music && A.music.stop) { innerStop = true; A.music.stop(true); } } catch (e) { } innerStop = false; };
  let curUrl = '';
  const srcOf = t => t.my ? MLMine.blob(t.i).then(bl => { if (!bl) throw new Error('missing'); if (curUrl) { try { URL.revokeObjectURL(curUrl); } catch (e) { } } curUrl = URL.createObjectURL(bl); return curUrl; }) : Promise.resolve('/web/music/' + t.i);
  const mkOrder = (n, keep) => { const a = Array.from({ length: n }, (_, i) => i); if (!shuffle) return a; const r = shuf(a.filter(i => i !== keep)); return keep >= 0 ? [keep].concat(r) : r; };
  const playCtx = (ids, start, name) => { ids = ids.filter(i => BY[i]); if (!ids.length) return; ctx = { ids, name: name || '', order: [], pos: 0 }; ctx.order = mkOrder(ids.length, start); if (!shuffle) ctx.pos = start; playTrack(BY[ids[ctx.order[ctx.pos]]]); };
  const playTrack = t => {
    if (!t) return; stopGame(); cur = t; const my = ++tok; srcOf(t).then(u => { if (my !== tok) return; au.src = u; const pr = au.play(); if (pr && pr.catch) pr.catch(() => { if (my === tok) A.toast('Could not start that track.'); }); }).catch(() => A.toast('That song could not be loaded.'));
    recent = [t.i].concat(recent.filter(x => x !== t.i)).slice(0, 80); wr('mlrecent', recent); const s = stats[t.i] || { n: 0 }; s.n++; s.t = Date.now(); stats[t.i] = s; wr('mlstats', stats);
    meta(); paintBar(); markPlaying(); try { if (sleepEnd && false) { } } catch (e) { }
  };
  const nextTrack = (dir, auto) => {
    if (uq.length && dir !== -1) { const id = uq.shift(); const t = BY[id]; if (t) { playTrack(t); if (showQ) paintQ(); return; } }
    if (!ctx.ids.length) return; if (auto && sleepEnd) { sleepEnd = false; sleepAt = 0; au.pause(); paintBar(); return; }
    if (auto && rep === 'one') { au.currentTime = 0; au.play(); return; }
    let p = ctx.pos + (dir === -1 ? -1 : 1); if (p >= ctx.order.length) { if (rep === 'off' && auto) { au.pause(); paintBar(); return; } ctx.order = mkOrder(ctx.ids.length, -1); p = 0; } if (p < 0) p = ctx.order.length - 1; ctx.pos = p; playTrack(BY[ctx.ids[ctx.order[p]]]); if (showQ) paintQ();
  };
  const toggle = () => { if (!cur) { const l = (CAT.length ? mixTracks(0, 40) : []).map(t => t.i); if (l.length) playCtx(l, 0, 'Rock Out'); return; } if (au.paused) { stopGame(); au.play().catch(() => { }); } else au.pause(); };
  au.addEventListener('ended', () => nextTrack(1, true)); au.addEventListener('play', () => { paintBar(); markPlaying(); meta(); }); au.addEventListener('pause', () => { paintBar(); markPlaying(); });
  au.addEventListener('loadedmetadata', () => { if (cur && isFinite(au.duration) && !cur.d) { cur.d = Math.round(au.duration); dcache[cur.i] = cur.d; wr('mldur', dcache); } });
  au.addEventListener('timeupdate', () => { const s = document.getElementById('mlseek'), tt = document.getElementById('mltime'); if (s && tt) { if (!s.dataset.drag) { s.max = isFinite(au.duration) ? au.duration : (cur && cur.d) || 0; s.value = au.currentTime; } tt.textContent = fmt(au.currentTime); const te = document.getElementById('mltot'); if (te) te.textContent = fmt(isFinite(au.duration) ? au.duration : (cur && cur.d) || 0); } if (sleepAt && Date.now() >= sleepAt) { sleepAt = 0; fadeStop(); } });
  au.addEventListener('error', () => { if (cur) A.toast('That track could not be played.'); });
  const fadeStop = () => { const v0 = au.volume, t0 = Date.now(); const iv = setInterval(() => { const k = (Date.now() - t0) / 3000; au.volume = Math.max(0, v0 * (1 - k)); if (k >= 1) { clearInterval(iv); au.pause(); au.volume = v0; paintBar(); A.toast('Sleep timer: music stopped.'); } }, 100); };
  function meta() { try { if ('mediaSession' in navigator && cur) { navigator.mediaSession.metadata = new MediaMetadata({ title: cur.t, artist: cur.a, album: cur.al || cur.g }); navigator.mediaSession.setActionHandler('play', toggle); navigator.mediaSession.setActionHandler('pause', toggle); navigator.mediaSession.setActionHandler('nexttrack', () => nextTrack(1)); navigator.mediaSession.setActionHandler('previoustrack', () => prevTrack()); } } catch (e) { } }
  const prevTrack = () => { if (au.currentTime > 4) au.currentTime = 0; else nextTrack(-1); };
  try {
    if (A.music && A.music.play) {
      const op = A.music.play, os = A.music.stop;
      A.music.play = function () { gameArgs = [...arguments]; if (!au.paused) return; return op.apply(this, arguments); };   // a song is playing: the game stays quiet
      A.music.stop = function () { if (!innerStop) gameArgs = null; return os.apply(this, arguments); };                   // the game closed: forget its music
      window.msSongOn = () => !au.paused;   // games in a frame (Middlewatch, Rome) ask this and keep their music silent while a song plays
      au.addEventListener('pause', () => setTimeout(() => { if (au.paused && gameArgs && !sleepEnd) { try { op.apply(A.music, gameArgs); } catch (e) { } } }, 1500));
    }
  } catch (e) { }

  /* ---------- building blocks ---------- */
  const L = (ids, name) => { const k = 'l' + (++lid); reg[k] = { ids: ids.map(t => typeof t === 'string' ? t : t.i), name }; return k; };
  const icoFor = t => GI[t.g] || '🎵', coverFor = (t, cls) => t.cv ? '<div class="ml-cv ' + (cls || '') + '" style="background:#222 url(\'' + t.cv + '\') center/cover"></div>' : cv(t.al || t.g || t.a, icoFor(t), cls);
  const row = (t, i, k, o) => { o = o || {}; const on = cur && cur.i === t.i, lk = likes.has(t.i); return '<div class="ml-row' + (on ? ' on' : '') + '" data-id="' + esc2(t.i) + '" data-l="' + k + '" data-n="' + i + '"><span class="num">' + (on && !au.paused ? '♫' : (i + 1)) + '</span><div class="tt" style="display:flex;gap:10px;align-items:center;min-width:0">' + coverFor(t, 's') + '<div style="min-width:0"><b class="tt" style="display:block">' + esc2(t.t) + '</b><span class="small mute tt" style="display:block"><span class="goart" data-ar="' + esc2(t.a) + '">' + esc2(t.a) + '</span></span></div></div><span class="small mute tt alb">' + esc2(t.al || t.g) + '</span><button class="ml-btn' + (lk ? ' liked' : '') + '" data-lk="' + esc2(t.i) + '" title="' + (lk ? 'Remove from Liked Songs' : 'Add to Liked Songs') + '">' + (lk ? '♥' : '♡') + '</button><span class="small mute">' + (t.d ? fmt(t.d) : '') + '</span><button class="ml-btn" data-mn="' + esc2(t.i) + '" title="More">⋯</button></div>'; };
  const rows = (list, name, opt) => { opt = opt || {}; const k = L(list, name), lim = opt.all ? list.length : 150; return '<div>' + list.slice(0, lim).map((t, i) => row(t, i, k)).join('') + (list.length > lim ? '<div class="small mute" style="padding:10px"><button class="ib" data-more="' + k + '">Show all ' + ns(list.length) + '</button></div>' : '') + '</div>'; };
  const hero = (o) => { const h = hue(o.key || o.title); return '<div class="ml-hero" style="background:linear-gradient(135deg,hsl(' + h + ' 55% 34%),hsl(' + (h + 50) % 360 + ' 60% 14%))">' + cv(o.key || o.title, o.icon || '🎵') + '<div style="min-width:0"><div class="small" style="opacity:.8;text-transform:uppercase;letter-spacing:.08em">' + esc2(o.kind) + '</div><h1>' + esc2(o.title) + '</h1><div style="opacity:.85">' + esc2(o.sub || '') + '</div></div></div>'; };
  const actions = (list, name, extra) => { const k = L(list, name); return '<div class="row" style="gap:10px;margin:0 0 12px;flex-wrap:wrap;align-items:center"><button class="pri" data-playl="' + k + '" style="padding:9px 22px">▶ Play</button><button class="ib" data-shufl="' + k + '">🔀 Shuffle</button>' + (extra || '') + '</div>'; };
  const card = (o) => '<div class="ml-card" data-go="' + esc2(o.go) + '"' + (o.play ? ' data-cplay="' + o.play + '"' : '') + '>' + cv(o.key || o.title, o.icon || '🎵') + '<b>' + esc2(o.title) + '</b><span class="small mute">' + esc2(o.sub || '') + '</span></div>';
  const shelf = (title, cards, more) => '<div class="row" style="align-items:baseline;margin:14px 0 4px"><h3 style="margin:0">' + esc2(title) + '</h3><span class="sp"></span>' + (more ? '<a data-go="' + more + '" style="cursor:pointer;color:var(--mute)" class="small">Show all</a>' : '') + '</div><div class="ml-shelf">' + cards.join('') + '</div>';
  const trackCard = t => '<div class="ml-card" data-tplay="' + esc2(t.i) + '">' + coverFor(t) + '<b>' + esc2(t.t) + '</b><span class="small mute">' + esc2(t.a) + '</span></div>';
  const mixCard = i => { const m = MIXES[i], l = mixTracks(i, 40); return '<div class="ml-card" data-go="mix:' + i + '">' + cv(m[0], m[1]) + '<b>' + esc2(m[0]) + '</b><span class="small mute">' + ns(l.length) + ' · refreshed daily</span></div>'; };
  const topGenres = () => ls.get('alpha', '1') === '0' ? Object.keys(GEN).sort((a, b) => GEN[b].length - GEN[a].length) : A.az(Object.keys(GEN));
  const albumCard = k => { const l = ALB[k]; return card({ go: 'album:' + k, key: k, icon: icoFor(l[0]), title: k, sub: l[0].a + ' · ' + ns(l.length) + '' }); };
  const genreCard = g => card({ go: 'genre:' + g, key: g, icon: GI[g] || '🎵', title: g, sub: ns(GEN[g].length) + '' });
  const moodCard = m => card({ go: 'mood:' + m, key: m, icon: MOODS[m][1], title: MOODS[m][0], sub: ns((MOOD[m] || []).length) + '' });
  const artistCard = a => card({ go: 'artist:' + a, key: a, icon: (GI[ART[a][0].g] || '🎵'), title: a, sub: ns(ART[a].length) + '' });

  /* ---------- views ---------- */
  const V = {
    home() {
      const h = new Date().getHours(), gr = h < 5 ? 'Good night' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening', rec = ids2t(recent).slice(0, 12), day = daySeed();
      const tiles = [['❤️', 'Liked Songs', ns(likes.size) + '', 'liked'], ['🕒', 'Recently played', ns(rec.length) + '', 'recent']].concat([0, 1, 2, 3].map(j => { const i = (day + j * 3) % MIXES.length; return [MIXES[i][1], MIXES[i][0], 'Daily mix', 'mix:' + i]; }));
      let h2 = '<h2 style="margin:0 0 12px">' + gr + '</h2><div class="ml-tiles">' + tiles.map(([ic, ti, su, go]) => '<div class="ml-tile" data-go="' + go + '">' + cv(ti, ic, 'm') + '<div style="min-width:0"><b>' + esc2(ti) + '</b><div class="small mute">' + esc2(su) + '</div></div></div>').join('') + '</div>';
      if (rec.length) h2 += shelf('Jump back in', rec.map(trackCard), 'recent');
      h2 += shelf('Made for you', Array.from({ length: MIXES.length }, (_, i) => (i + day) % MIXES.length).map(mixCard), '');
      const top = Object.entries(stats).sort((a, b) => b[1].n - a[1].n).slice(0, 12).map(([i]) => BY[i]).filter(Boolean); if (top.length >= 4) h2 += shelf('Your top tracks', top.map(trackCard), 'most');
      if (mine.length) h2 += shelf('Your music', mine.slice().reverse().slice(0, 14).map(trackCard), 'mine');
      h2 += shelf('Moods', Object.keys(MOODS).filter(m => MOOD[m]).map(moodCard), 'moods') + shelf('Genres', topGenres().map(genreCard), 'genres');
      h2 += shelf('Rock Out', shuf((GEN.Rock || []), mulberry(day)).slice(0, 14).map(trackCard), 'genre:Rock');
      h2 += shelf('Albums', shuf(Object.keys(ALB), mulberry(day + 5)).slice(0, 16).map(albumCard), 'albums');
      const classical = (GEN.Classical || []); if (classical.length) h2 += shelf('Classical corner', shuf(classical, mulberry(day + 9)).slice(0, 14).map(trackCard), 'genre:Classical');
      return h2;
    },
    search() {
      const q = (view.q || '').trim().toLowerCase(); let h2 = '<div style="margin-bottom:12px"><input type="text" id="mlq" value="' + esc2(view.q || '') + '" placeholder="What do you want to listen to?  Try rock, piano, jazz, relaxing, 120 bpm..." style="width:100%;max-width:560px;padding:11px 16px;border-radius:999px;font-size:15px" autocomplete="off"></div>';
      if (!q) return h2 + '<h3>Browse all</h3><div>' + topGenres().map(g => '<span class="ml-chip" data-go="genre:' + esc2(g) + '">' + (GI[g] || '🎵') + ' ' + esc2(g) + '</span>').join('') + Object.keys(MOODS).filter(m => MOOD[m]).map(m => '<span class="ml-chip" data-go="mood:' + m + '">' + MOODS[m][1] + ' ' + MOODS[m][0] + '</span>').join('') + '</div>';
      const toks = q.split(/\s+/).filter(Boolean), score = t => { const hay = (t.t + ' ' + t.a + ' ' + (t.al || '') + ' ' + t.g + ' ' + (t.m || []).map(m => MOODS[m] ? MOODS[m][0] : m).join(' ') + ' ' + (t.ins || '') + ' ' + (t.ds || '') + ' ' + (t.ft || []).join(' ') + ' ' + (t.e || '') + ' ' + (t.bpm ? t.bpm + ' bpm' : '') + ' ' + (t.y ? t.y + ' ' + Math.floor(t.y / 10) * 10 + 's ' + String(Math.floor(t.y / 10) % 10) + '0s' : '') + (t.my ? ' my own imported' : '')).toLowerCase(); let s = 0; for (const w of toks) { if (!hay.includes(w)) return 0; s += t.t.toLowerCase().includes(w) ? 3 : 1; if (t.g.toLowerCase() === w) s += 2; } return s; };
      const res = CAT.map(t => [score(t), t]).filter(x => x[0]).sort((a, b) => b[0] - a[0]).map(x => x[1]);
      const arts = Object.keys(ART).filter(a => a.toLowerCase().includes(q)), albs = Object.keys(ALB).filter(a => a.toLowerCase().includes(q)), gens = Object.keys(GEN).filter(g => g.toLowerCase().includes(q)), mds = Object.keys(MOODS).filter(m => MOOD[m] && MOODS[m][0].toLowerCase().includes(q));
      if (!res.length && !arts.length) return h2 + '<div class="mute" style="padding:20px">No results for "' + esc2(view.q) + '". Try a genre (rock, jazz), a mood (chill, epic) or an instrument (piano, guitar).</div>';
      if (gens.length || mds.length) h2 += '<div style="margin:6px 0">' + gens.map(g => '<span class="ml-chip" data-go="genre:' + esc2(g) + '">' + (GI[g] || '🎵') + ' ' + esc2(g) + '</span>').join('') + mds.map(m => '<span class="ml-chip" data-go="mood:' + m + '">' + MOODS[m][1] + ' ' + MOODS[m][0] + '</span>').join('') + '</div>';
      if (arts.length) h2 += shelf('Artists', arts.slice(0, 12).map(artistCard)); if (albs.length) h2 += shelf('Albums', albs.slice(0, 16).map(albumCard));
      return h2 + '<h3 style="margin:14px 0 6px">Songs <span class="mute small">' + res.length + '</span></h3>' + actions(res.slice(0, 200), 'Search: ' + view.q) + rows(res, 'Search: ' + view.q);
    },
    genre(g) { const l = GEN[g] || []; const alb = [...new Set(l.map(t => t.al).filter(a => a && ALB[a] && ALB[a].filter(x => x.g === g).length * 2 >= ALB[a].length))]; return hero({ kind: 'Genre', title: g, icon: GI[g] || '🎵', sub: ns(l.length) + ' · ' + fmtLong(dur(l)) }) + actions(l, g) + (alb.length > 1 ? shelf('Albums in ' + g, alb.slice(0, 16).map(albumCard)) : '') + '<h3 style="margin:12px 0 4px">Songs</h3>' + rows(l, g); },
    mood(m) { const l = MOOD[m] || [], gs = {}; l.forEach(t => { gs[t.g] = (gs[t.g] || 0) + 1; }); return hero({ kind: 'Mood', title: MOODS[m][0], icon: MOODS[m][1], key: m, sub: ns(l.length) + ' · ' + Object.entries(gs).sort((a, b) => b[1] - a[1]).slice(0, 4).map(x => x[0]).join(', ') }) + actions(l, MOODS[m][0]) + rows(shuf(l, mulberry(daySeed() + hue(m))), MOODS[m][0]); },
    artist(a) { const l = ART[a] || [], pop = l.slice().sort((x, y) => ((stats[y.i] || {}).n || 0) - ((stats[x.i] || {}).n || 0) || (x.n - y.n)), als = [...new Set(l.map(t => t.al).filter(k => k && ALB[k]))]; return hero({ kind: 'Artist', title: a, icon: GI[l[0].g] || '🎵', sub: ns(l.length) + ' · ' + [...new Set(l.map(t => t.g))].slice(0, 4).join(', ') }) + actions(pop, a) + (als.length ? shelf('Albums', als.map(albumCard)) : '') + '<h3 style="margin:12px 0 4px">Songs</h3>' + rows(pop, a); },
    album(k) { const l = ALB[k] || []; return hero({ kind: 'Album', title: k, icon: icoFor(l[0]), sub: l[0].a + (l[0].p ? ' · ' + l[0].p : '') + ' · ' + ns(l.length) + ' · ' + fmtLong(dur(l)) }) + actions(l, k) + rows(l, k); },
    mix(i) { const m = MIXES[+i], l = mixTracks(+i, 40); return hero({ kind: 'Made for you', title: m[0], icon: m[1], sub: ns(l.length) + ' · ' + fmtLong(dur(l)) + ' · a new selection every day' }) + actions(l, m[0], '<button class="ib" data-savemix="' + i + '">＋ Save as playlist</button>') + rows(l, m[0]); },
    liked() { const l = ids2t([...likes]); return hero({ kind: 'Playlist', title: 'Liked Songs', icon: '❤️', sub: ns(l.length) + '' }) + (l.length ? actions(l, 'Liked Songs') + rows(l, 'Liked Songs') : '<div class="mute" style="padding:16px">Press the heart ♡ next to any song and it will appear here.</div>'); },
    recent() { const l = ids2t(recent); return hero({ kind: 'History', title: 'Recently played', icon: '🕒', sub: ns(l.length) + '' }) + (l.length ? actions(l, 'Recently played') + rows(l, 'Recently played') : '<div class="mute" style="padding:16px">Nothing played yet.</div>'); },
    most() { const l = Object.entries(stats).sort((a, b) => b[1].n - a[1].n).map(([i]) => BY[i]).filter(Boolean).slice(0, 50); return hero({ kind: 'Stats', title: 'Most played', icon: '📈', sub: ns(l.length) + '' }) + (l.length ? actions(l, 'Most played') + rows(l, 'Most played') : '<div class="mute" style="padding:16px">Play some music and your favourites will appear here.</div>'); },
    genres() { return '<h2 style="margin:0 0 10px">Genres</h2><div class="ml-shelf" style="grid-auto-flow:row;grid-template-columns:repeat(auto-fill,158px)">' + topGenres().map(genreCard).join('') + '</div>'; },
    moods() { return '<h2 style="margin:0 0 10px">Moods</h2><div class="ml-shelf" style="grid-auto-flow:row;grid-template-columns:repeat(auto-fill,158px)">' + Object.keys(MOODS).filter(m => MOOD[m]).map(moodCard).join('') + '</div>'; },
    artists() { return '<h2 style="margin:0 0 10px">Artists and composers</h2><div class="ml-shelf" style="grid-auto-flow:row;grid-template-columns:repeat(auto-fill,158px)">' + Object.keys(ART).sort((a, b) => ART[b].length - ART[a].length).map(artistCard).join('') + '</div>'; },
    albums() { return '<h2 style="margin:0 0 10px">Albums</h2><div class="ml-shelf" style="grid-auto-flow:row;grid-template-columns:repeat(auto-fill,158px)">' + Object.keys(ALB).sort().map(albumCard).join('') + '</div>'; },
    songs() { return hero({ kind: 'Library', title: 'All songs', icon: '🎧', sub: ns(CAT.length) + ' · ' + fmtLong(dur(CAT)) }) + actions(CAT, 'All songs') + rows(CAT.slice().sort((a, b) => a.t.localeCompare(b.t)), 'All songs'); },
    playlist(id) {
      const p = pls.find(x => x.id === id); if (!p) return '<div class="mute">That playlist no longer exists.</div>'; const l = ids2t(p.ids), k = L(l, p.name);
      return hero({ kind: 'Playlist', title: p.name, icon: '🎶', sub: ns(l.length) + ' · ' + fmtLong(dur(l)) }) + '<div class="row" style="gap:10px;margin:0 0 12px;flex-wrap:wrap"><button class="pri" data-playl="' + k + '" style="padding:9px 22px">▶ Play</button><button class="ib" data-shufl="' + k + '">🔀 Shuffle</button><button class="ib" data-plren="' + id + '">✏️ Rename</button><button class="ib dang" data-pldel="' + id + '">🗑 Delete</button></div>' +
        (l.length ? '<div>' + l.map((t, i) => row(t, i, k) + '').join('') + '</div><div class="small mute" style="margin-top:8px">Use the ⋯ menu on a song to remove it or move it up or down.</div>' : '<div class="mute" style="padding:16px">This playlist is empty. Open the ⋯ menu on any song and choose <b>Add to playlist</b>.</div>');
    },
    mine() {
      const l = mine.slice().reverse();
      return hero({ kind: 'Your library', title: 'My songs', icon: '📁', sub: ns(l.length) + (l.length ? ' · ' + fmtLong(dur(l)) : '') }) +
        '<div class="card" id="mldrop" style="margin:0 0 14px;max-width:780px;border-style:dashed"><div class="row" style="gap:10px;flex-wrap:wrap;align-items:center"><div style="flex:1;min-width:230px"><b>Add your own music</b><div class="small mute" style="line-height:1.5">Drop audio files or a whole folder here (MP3, M4A, FLAC, OGG, OPUS, WAV). Moundshroud reads the title, artist, album, year and cover art from each file. Songs are copied into Moundshroud\'s storage on this PC and never uploaded.</div></div><button class="pri" id="mlimpf">＋ Add songs</button><button class="ib" id="mlimpd">📁 Add a folder</button><button class="ib" id="mltvimp">📥 From TV downloads</button><button class="ib" data-go="record">🎙️ Record</button></div><div class="small" id="mlimpst" style="margin-top:8px"></div></div>' +
        (l.length ? actions(l, 'My songs') + rows(l, 'My songs') + '<div class="small mute" style="margin-top:14px" id="mlstore"></div><div style="margin-top:6px"><button class="ib dang" data-clrmine="1">Remove all my music</button></div>' : '<div class="mute" style="padding:14px 4px">Nothing here yet. Add songs you own, or record something.</div>');
    },
    record() {
      let h2 = '<h2 style="margin:0 0 6px">🎙️ Record</h2><div class="small mute" style="max-width:640px;margin-bottom:14px;line-height:1.5">Record with your microphone: a song, an instrument, a voice memo. Saved recordings join your library under <b>My Recordings</b>, stay on this PC, and can be played, added to playlists and downloaded. Music playing in Moundshroud pauses while you record.</div>';
      if (rec.err) h2 += '<div class="acmsg" style="margin-bottom:10px;max-width:640px;border-color:var(--bad)">' + esc2(rec.err) + '</div>';
      if (rec.state === 'rec') return h2 + '<div class="card" style="max-width:640px;text-align:center;padding:26px"><div style="font-size:54px">🔴</div><div id="mlrectime" style="font:700 34px Consolas,monospace">0:00</div><div style="height:12px;border-radius:6px;background:var(--panel2);overflow:hidden;margin:12px auto;max-width:360px"><div id="mlrecmeter" style="height:100%;width:0;background:linear-gradient(90deg,#3fae4b,#f0a020,#e53935)"></div></div><button class="pri" id="mlrecstop" style="padding:12px 30px;font-size:16px">■ Stop</button></div>';
      if (rec.state === 'review') return h2 + '<div class="card" style="max-width:640px"><b>Your recording</b> <span class="small mute">' + fmt(rec.secs) + '</span><audio controls src="' + rec.url + '" style="width:100%;margin:10px 0"></audio><div class="row" style="gap:8px;flex-wrap:wrap"><input type="text" id="mlrtitle" placeholder="Title" value="Recording ' + esc2(new Date().toLocaleDateString()) + '" style="flex:2;min-width:180px"><input type="text" id="mlrartist" placeholder="Artist" value="' + esc2(ls.get('chprofname', 'Me')) + '" style="flex:1;min-width:120px"></div><div class="row" style="gap:8px;margin-top:10px;flex-wrap:wrap"><button class="pri" id="mlrecsave">Save to my library</button><button class="ib" id="mlrecdl">⬇ Download</button><button class="ib" id="mlrecagain">● Record again</button><button class="ib dang" id="mlrecdis">Discard</button></div></div>';
      return h2 + '<div class="card" style="max-width:640px;text-align:center;padding:26px"><div style="font-size:54px">🎙️</div><div style="margin:8px 0 14px">Ready when you are</div><button class="pri" id="mlrecgo" style="padding:12px 30px;font-size:16px">● Start recording</button></div>';
    },
    decades() { const ks = Object.keys(DEC).sort(); return '<h2 style="margin:0 0 10px">Decades</h2>' + (ks.length ? '<div class="ml-shelf" style="grid-auto-flow:row;grid-template-columns:repeat(auto-fill,158px)">' + ks.map(d => card({ go: 'decade:' + d, key: 'd' + d, icon: '📅', title: d + 's', sub: ns(DEC[d].length) })).join('') + '</div>' : '<div class="mute" style="padding:16px">Songs that have a release year are grouped here by decade. Add your own music (with year tags) to fill this in, then search <i>1970s</i>, <i>80s</i> and so on.</div>'); },
    decade(d) { const l = (DEC[d] || []).slice().sort((x, y) => (x.y || 0) - (y.y || 0)); return hero({ kind: 'Decade', title: d + 's', icon: '📅', sub: ns(l.length) }) + actions(l, d + 's') + rows(l, d + 's'); },
    credits() {
      const lic = {}; CAT.forEach(t => { const k = t.lic.split(' (')[0]; lic[k] = (lic[k] || 0) + 1; });
      return '<h2 style="margin:0 0 8px">Credits and licences</h2><div class="small mute" style="max-width:760px;line-height:1.6">Every recording here is free to use. The files live on this PC in <i>web/music</i>. Licences in this library: ' + Object.entries(lic).sort((a, b) => b[1] - a[1]).map(([k, n]) => '<b>' + esc2(k) + '</b> (' + n + ')').join(', ') + '.</div>' +
        '<div class="card" style="margin:14px 0;max-width:760px"><b>Kevin MacLeod (incompetech.com)</b><div class="small mute" style="margin-top:4px;line-height:1.6">Rock, electronic, jazz, cinematic, world, ambient and more (' + (ART['Kevin MacLeod'] || []).length + ' tracks). Licensed under Creative Commons: By Attribution 4.0 (creativecommons.org/licenses/by/4.0). If you reuse any of it, give credit like this: <i>"Music: [Title] by Kevin MacLeod (incompetech.com), Licensed under Creative Commons: By Attribution 4.0 License"</i>.</div></div>' +
        '<div class="card" style="margin:14px 0;max-width:760px"><b>Classical recordings</b><div class="small mute" style="margin-top:4px;line-height:1.6">Kimiko Ishizaka: The Open Goldberg Variations (CC0) and The Open Well-Tempered Clavier (public domain). Musopen: orchestral, chamber and piano recordings released to the public domain or CC0 (via Wikimedia Commons). The Pandora Music repository (ibiblio.org) and Bernd Krueger (piano-midi.de): Creative Commons BY-SA. A 1937 Schnabel recording of Mozart\'s Piano Concerto No. 21 from archive.org: marked public domain, but a 1937 recording may still be protected in the US until 2033.</div></div>' +
        '<div class="small mute" style="max-width:760px">Open the ⋯ menu on any song and choose <b>Track info</b> to see its own credit and licence.</div>';
    },
  };
  /* ---------- your own songs: import, record, delete ---------- */
  const pickFiles = dir => { const inp = document.createElement('input'); inp.type = 'file'; inp.multiple = true; if (dir) inp.webkitdirectory = true; else inp.accept = 'audio/*,.mp3,.m4a,.aac,.flac,.ogg,.oga,.opus,.wav,.webm'; inp.onchange = () => { if (view.t !== 'mine') go('mine'); importFiles(inp.files); }; inp.click(); };
  const importFiles = async files => {
    files = [...files].filter(MLMine.isAudio); if (!files.length) { A.toast('No audio files found (MP3, M4A, FLAC, OGG, OPUS, WAV).'); return { ok: 0, dup: 0, bad: 0 }; }
    MLMine.persist(); const have = new Set(mine.map(t => t.sig)); let ok = 0, dup = 0, bad = 0; const st = txt => { const e = document.getElementById('mlimpst'); if (e) e.textContent = txt; };
    for (let k = 0; k < files.length; k++) { st('Importing ' + (k + 1) + ' of ' + files.length + ': ' + files[k].name); try { const r = await MLMine.add(files[k], have); if (r.dup) dup++; else if (r.bad) bad++; else ok++; } catch (e) { bad++; } }
    await refreshMine(); const msg = 'Added ' + ok + (ok === 1 ? ' song' : ' songs') + (dup ? ', skipped ' + dup + ' already in your library' : '') + (bad ? ', ' + bad + ' could not be read' : '') + '.'; A.toast(msg, 5000);
    if (view.t === 'mine' || view.t === 'home') { view.keepScroll = true; render(); } else paintSide(); st(msg); return { ok, dup, bad };
  };
  /* ---------- bringing the sound files over from TV > Downloads ---------- */
  const TV_AUDIO = /\.(mp3|m4a|aac|flac|ogg|oga|opus|wav|weba|webm)$/i;
  const tvAudio = async () => {
    const r = await fetch('/api/tv/dl').then(x => x.json()).catch(() => null);
    if (!r) return null;
    const folds = {}; (r.folders || []).forEach(f => { folds[f.id] = f.name; });
    const out = [];
    (r.items || []).forEach(it => (it.files || []).forEach(f => { if (f.there && TV_AUDIO.test(f.name)) out.push({ id: it.id, n: f.n, name: f.name, size: f.size || 0, title: it.title, channel: it.channel || '', folder: folds[it.folder] || '', at: it.at || 0 }); }));
    out.sort((a, b) => b.at - a.at);
    return { home: r.home || 'the TV downloads folder', files: out };
  };
  const importTv = async sel => {
    MLMine.persist(); const have = new Set(mine.map(t => t.sig)); let ok = 0, dup = 0, bad = 0;
    for (let k = 0; k < sel.length; k++) {
      const f = sel[k], st = document.getElementById('mltvst');
      if (st) st.textContent = 'Copying ' + (k + 1) + ' of ' + sel.length + ': ' + f.name;
      try {
        const r = await fetch('/api/tv/dl/file?id=' + encodeURIComponent(f.id) + '&n=' + f.n);
        if (!r.ok) { bad++; continue; }
        const bl = await r.blob(), file = new File([bl], f.name, { type: bl.type || 'audio/mpeg' }), res = await MLMine.add(file, have);
        if (res.dup) { dup++; continue; } if (res.bad) { bad++; continue; }
        /* a folder you made in TV becomes the album, so the same folder keeps its songs together in Music */
        if (res.meta) {
          const patch = { c: 'Copied from TV downloads' + (f.folder ? ' (' + f.folder + ')' : '') };
          const tidy = String(res.meta.t || '').replace(/\s*\[[A-Za-z0-9_-]{11}\]\s*/g, ' ').replace(/\s+/g, ' ').trim();   // drop the [youtube id] left in the file name
          if (tidy && tidy !== res.meta.t) patch.t = tidy;
          const chan = String(f.channel || '').replace(/\s*[-–]\s*Topic\s*$/i, '').replace(/VEVO$/i, '').trim();
          if (chan && (!res.meta.a || res.meta.a === 'Unknown artist')) patch.a = chan.slice(0, 80);   /* the TV item knows the channel */
          if (f.folder && !res.meta.al) patch.al = f.folder;                          /* a TV folder becomes the album */
          await MLMine.update(res.meta.i, patch);
        }
        ok++;
      } catch (e) { bad++; }
    }
    await refreshMine(); if (view.t === 'mine' || view.t === 'home') { view.keepScroll = true; render(); } else paintSide();
    return { ok, dup, bad };
  };
  const openTvImport = async () => {
    A.dlg('<h3 style="margin-top:0">📥 From TV › Downloads</h3><div class="small mute" style="padding:14px 0">Looking in the TV downloads folder…</div>', true);
    const d = await tvAudio(), box = document.getElementById('dlg'); if (!box) return;
    const head = '<h3 style="margin-top:0">📥 From TV › Downloads</h3>', shut = '<div class="row" style="margin-top:12px;justify-content:flex-end"><button class="ib" onclick="A.closeDlg()">Close</button></div>';
    if (!d) return void (box.innerHTML = head + '<div class="small" style="color:var(--bad);padding:6px 0">The TV downloads list could not be read. Open Entertainment › TV once, then try again.</div>' + shut);
    const intro = '<div class="small mute" style="line-height:1.5;margin-bottom:10px">Pick the sound files to copy into <b>My songs</b>. They are copied, so the originals stay in <b>' + esc2(d.home) + '</b>. A TV folder becomes the album here, so your folders stay together.</div>';
    if (!d.files.length) return void (box.innerHTML = head + intro + '<div class="small mute">Nothing to bring over yet. In TV › ▶ YouTube press ⬇ on a video and choose <b>Sound only (MP3)</b>; that file will be waiting here.</div>' + shut);
    const mb = n => n >= 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB', byFold = {};
    d.files.forEach(f => { const g = f.folder || ''; (byFold[g] = byFold[g] || []).push(f); });
    let list = '';
    Object.keys(byFold).sort((a, b) => (a ? 1 : 0) - (b ? 1 : 0) || a.localeCompare(b)).forEach(g => {
      list += '<div class="small" style="margin:10px 0 2px;font-weight:600">' + (g ? '📁 ' + esc2(g) : '📥 Downloads (no folder)') + ' <span class="mute">' + byFold[g].length + '</span></div>';
      list += byFold[g].map(f => '<label class="row small" style="gap:8px;padding:5px 0;cursor:pointer;align-items:flex-start"><input type="checkbox" data-tvf="' + esc2(f.id) + '|' + f.n + '" checked style="margin-top:3px"><span style="min-width:0;flex:1"><b>' + esc2(f.title || f.name) + '</b><br><span class="mute">' + esc2(f.name) + ' · ' + mb(f.size) + (f.channel ? ' · ' + esc2(f.channel) : '') + '</span></span></label>').join('');
    });
    box.innerHTML = head + intro + '<div style="max-height:44vh;overflow:auto;border:1px solid var(--line);border-radius:10px;padding:6px 12px">' + list + '</div>' +
      '<div class="row" style="gap:8px;margin-top:10px;flex-wrap:wrap;align-items:center"><button class="ib" id="mltvall">Select all</button><button class="ib" id="mltvnil">Select none</button><span class="sp"></span><button class="pri" id="mltvgo">Add to my music</button><button class="ib" onclick="A.closeDlg()">Close</button></div><div class="small mute" id="mltvst" style="margin-top:8px"></div>';
    const q2 = s => box.querySelector(s), all = () => [...box.querySelectorAll('[data-tvf]')];
    q2('#mltvall').onclick = () => all().forEach(c => { c.checked = true; });
    q2('#mltvnil').onclick = () => all().forEach(c => { c.checked = false; });
    q2('#mltvgo').onclick = async () => {
      const sel = all().filter(c => c.checked).map(c => { const p = c.dataset.tvf.split('|'); return d.files.find(f => f.id === p[0] && f.n === +p[1]); }).filter(Boolean);
      if (!sel.length) return void A.toast('Tick at least one file first.');
      const go = q2('#mltvgo'); go.disabled = true; go.textContent = 'Adding…';
      const r = await importTv(sel), msg = 'Added ' + r.ok + (r.ok === 1 ? ' song' : ' songs') + (r.dup ? ', skipped ' + r.dup + ' already in your music' : '') + (r.bad ? ', ' + r.bad + ' could not be read' : '') + '.';
      go.disabled = false; go.textContent = 'Add to my music'; q2('#mltvst').textContent = msg; A.toast(msg, 6000);
    };
  };
  const delMine = async ids => {
    for (const id of ids) { if (cur && cur.i === id) { au.pause(); cur = null; ++tok; } await MLMine.remove(id); likes.delete(id); uq = uq.filter(x => x !== id); recent = recent.filter(x => x !== id); delete stats[id]; pls.forEach(p => { p.ids = p.ids.filter(x => x !== id); }); }
    saveLikes(); savePl(); wr('mlrecent', recent); wr('mlstats', stats); await refreshMine(); view.keepScroll = true; render(); paintBar(); A.toast('Removed.');
  };
  const saveRec = () => { const ti = (document.getElementById('mlrtitle') || {}).value, ar = (document.getElementById('mlrartist') || {}).value; if (!rec.blob) return; MLMine.saveRecording(rec.blob, rec.secs, { title: ti, artist: ar }).then(async () => { rec.discard(); await refreshMine(); go('mine'); A.toast('Saved to My songs.'); }).catch(() => A.toast('Could not save the recording.')); };
  const dlRec = () => { if (!rec.url) return; const a = document.createElement('a'); a.href = rec.url; a.download = ((document.getElementById('mlrtitle') || {}).value || 'recording').replace(/[^\w .-]+/g, '_') + (/ogg/.test(rec.blob.type) ? '.ogg' : '.webm'); document.body.appendChild(a); a.click(); a.remove(); };
  const showStore = async () => { const e = document.getElementById('mlstore'); if (!e) return; const own = mine.reduce((a, t) => a + (t.sz || 0), 0), est = await MLMine.estimate(); e.textContent = 'Your songs use ' + (own / 1048576).toFixed(own > 1e8 ? 0 : 1) + ' MB of Moundshroud storage' + (est.quota ? ' (the browser allows about ' + Math.round(est.quota / 1073741824) + ' GB in total)' : '') + '.'; };
  let recShown = ''; if (window.MLMine) MLMine.rec.onchange = () => { if (rec.state !== recShown) { recShown = rec.state; if (view.t === 'record') render(); paintSide(); } else { const tm = document.getElementById('mlrectime'), mt = document.getElementById('mlrecmeter'); if (tm) tm.textContent = fmt(rec.secs); if (mt) mt.style.width = Math.round((rec.level || 0) * 100) + '%'; } };
  const route = r => { const [t, ...rest] = String(r).split(':'); return { t, a: rest.join(':') }; };
  const render = () => {
    const m = document.getElementById('mlmain'); if (!m) return; reg = {}; lid = 0; const keep = m.scrollTop; let h2 = '';
    try { const v = view; h2 = (V[v.t] || V.home)(v.a); } catch (e) { h2 = '<div class="mute">Could not show this page (' + esc2(e.message) + ').</div>'; }
    m.innerHTML = h2; if (view.keepScroll) m.scrollTop = keep; else m.scrollTop = 0; view.keepScroll = false; paintSide(); markPlaying(); if (view.t === 'mine') showStore();
    const q = document.getElementById('mlq'); if (q && view.t === 'search') { q.focus(); q.setSelectionRange(q.value.length, q.value.length); }
  };
  const go = (t, a, noHist) => { if (!noHist) hist.push({ t: view.t, a: view.a, q: view.q }); view = { t, a, q: t === 'search' ? (a || '') : undefined }; if (t === 'search') view.a = undefined; render(); };
  const goStr = s => { const r = route(s); go(r.t, r.a); };
  function paintSide() {
    const s = document.getElementById('mlside'); if (!s) return; const on = (t, a) => view.t === t && (a === undefined || view.a === a) ? ' on' : '', nav = (ic, tx, go2, ac) => '<div class="ml-nav' + ac + '" data-go="' + go2 + '" title="' + esc2(tx) + '">' + ic + ' <span>' + esc2(tx) + '</span></div>';
    s.innerHTML = nav('🏠', 'Home', 'home', on('home')) + nav('🔎', 'Search', 'search', on('search')) + '<h4>Browse</h4>' + nav('🎧', 'All songs', 'songs', on('songs')) + nav('🎼', 'Genres', 'genres', on('genres')) + nav('🌈', 'Moods', 'moods', on('moods')) + nav('🎤', 'Artists', 'artists', on('artists')) + nav('💿', 'Albums', 'albums', on('albums')) + (Object.keys(DEC).length ? nav('📅', 'Decades', 'decades', on('decades')) : '') +
      '<h4>Your library</h4>' + nav('❤️', 'Liked Songs', 'liked', on('liked')) + nav('🕒', 'Recently played', 'recent', on('recent')) + nav('📈', 'Most played', 'most', on('most')) + pls.map(p => nav('🎶', p.name, 'playlist:' + p.id, on('playlist', p.id))).join('') + '<div class="ml-nav" data-newpl="1">➕ <span>New playlist</span></div><h4>My music</h4>' + nav('📁', 'My songs', 'mine', on('mine')) + nav(rec.state === 'rec' ? '🔴' : '🎙️', rec.state === 'rec' ? 'Recording...' : 'Record', 'record', on('record')) + '<h4>About</h4>' + nav('ℹ️', 'Credits & licences', 'credits', on('credits'));
  }
  function markPlaying() { document.querySelectorAll('#mlmain .ml-row').forEach(r => { const on = cur && r.dataset.id === cur.i; r.classList.toggle('on', !!on); const n = r.querySelector('.num'); if (n) n.textContent = on && !au.paused ? '♫' : (+r.dataset.n + 1); }); }
  function paintBar() {
    const b = document.getElementById('mlbar'); if (!b) return; const playing = !au.paused && cur, lk = cur && likes.has(cur.i);
    b.innerHTML = '<div style="display:flex;gap:12px;align-items:center;min-width:0">' + (cur ? coverFor(cur, 'm') + '<div style="min-width:0"><div style="font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc2(cur.t) + '</div><div class="small mute goart" data-ar="' + esc2(cur.a) + '" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;cursor:pointer">' + esc2(cur.a) + '</div></div><button class="ml-btn' + (lk ? ' liked' : '') + '" data-lk="' + esc2(cur.i) + '" style="font-size:18px">' + (lk ? '♥' : '♡') + '</button>' : '<div class="small mute">Pick something to play, or press ▶ for a mix.</div>') + '</div>' +
      '<div class="mid"><div class="row" style="gap:8px;align-items:center"><button class="ml-btn" id="mlshuf" title="Shuffle" style="' + (shuffle ? 'color:var(--acc)' : '') + '">🔀</button><button class="ml-btn" id="mlprev" title="Previous" style="font-size:20px">⏮</button><button class="ml-play" id="mlplay">' + (playing ? '⏸' : '▶') + '</button><button class="ml-btn" id="mlnext" title="Next" style="font-size:20px">⏭</button><button class="ml-btn" id="mlrep" title="Repeat: ' + rep + '" style="' + (rep !== 'off' ? 'color:var(--acc)' : '') + '">' + (rep === 'one' ? '🔂' : '🔁') + '</button></div>' +
      '<div class="row" style="gap:8px;align-items:center;width:100%"><span class="small mute" id="mltime" style="min-width:36px;text-align:right">0:00</span><input type="range" id="mlseek" min="0" max="' + (isFinite(au.duration) ? au.duration : (cur && cur.d) || 0) + '" step="1" value="' + au.currentTime + '" style="flex:1"><span class="small mute" id="mltot" style="min-width:36px">' + fmt(isFinite(au.duration) ? au.duration : (cur && cur.d) || 0) + '</span></div></div>' +
      '<div class="row" style="gap:8px;align-items:center;justify-content:flex-end"><button class="ml-btn" id="mlq-btn" title="Queue" style="' + (showQ ? 'color:var(--acc)' : '') + '">📃' + (uq.length ? '<span class="small">' + uq.length + '</span>' : '') + '</button><button class="ml-btn" id="mlsleep" title="Sleep timer" style="' + (sleepAt || sleepEnd ? 'color:var(--acc)' : '') + '">🌙' + (sleepAt ? '<span class="small"> ' + Math.max(1, Math.round((sleepAt - Date.now()) / 60000)) + 'm</span>' : sleepEnd ? '<span class="small"> end</span>' : '') + '</button><span>🔊</span><input type="range" id="mlvol" min="0" max="100" value="' + Math.round(au.volume * 100) + '" style="width:88px"></div>';
  }
  function paintQ() {
    let q = document.getElementById('mlqueue'); if (!showQ) { if (q) q.remove(); return; } if (!q) { q = document.createElement('div'); q.id = 'mlqueue'; q.className = 'ml-queue'; document.getElementById('mlwrap').appendChild(q); }
    const upcoming = ctx.order.slice(ctx.pos + 1, ctx.pos + 31).map(i => BY[ctx.ids[i]]).filter(Boolean), item = (t, rm) => '<div class="ml-row" style="grid-template-columns:44px minmax(0,1fr) 30px" data-tplay="' + esc2(t.i) + '">' + coverFor(t, 's') + '<div class="tt"><b class="tt" style="display:block">' + esc2(t.t) + '</b><span class="small mute">' + esc2(t.a) + '</span></div>' + (rm !== undefined ? '<button class="ml-btn" data-qrm="' + rm + '">✕</button>' : '<span></span>') + '</div>';
    q.innerHTML = '<div class="row" style="margin-bottom:8px"><b style="font-size:16px">Queue</b><span class="sp"></span><button class="ml-btn" id="mlqx">✕</button></div>' + (cur ? '<div class="small mute">Now playing</div>' + item(cur) : '') + (uq.length ? '<div class="row" style="margin:10px 0 2px"><span class="small mute">Next in queue</span><span class="sp"></span><button class="ib" id="mlqclr">Clear</button></div>' + uq.map((i, n) => BY[i] ? item(BY[i], n) : '').join('') : '') + '<div class="small mute" style="margin:10px 0 2px">Next from ' + esc2(ctx.name || 'your selection') + '</div>' + (upcoming.length ? upcoming.map(t => item(t)).join('') : '<div class="small mute">Nothing else queued.</div>');
  }

  /* ---------- menus and dialogs ---------- */
  const closeMenu = () => { const m = document.getElementById('mlmenu'); if (m) m.remove(); };
  const openMenu = (html, x, y) => { closeMenu(); const m = document.createElement('div'); m.id = 'mlmenu'; m.className = 'ml-menu'; m.innerHTML = html; m.onclick = ev => { const it = ev.target.closest('[data-m]'); if (it) menuAct(it, ev); }; document.body.appendChild(m); const w = m.offsetWidth, h = m.offsetHeight; m.style.left = Math.max(8, Math.min(x, innerWidth - w - 8)) + 'px'; m.style.top = Math.max(8, Math.min(y, innerHeight - h - 8)) + 'px'; };
  const trackMenu = (id, x, y, inPl) => {
    const t = BY[id]; if (!t) return; const lk = likes.has(id);
    openMenu('<div data-m="next" data-id="' + esc2(id) + '">▶ Play next</div><div data-m="queue" data-id="' + esc2(id) + '">➕ Add to queue</div><div data-m="like" data-id="' + esc2(id) + '">' + (lk ? '♥ Remove from Liked Songs' : '♡ Add to Liked Songs') + '</div><hr><div data-m="addpl" data-id="' + esc2(id) + '">🎶 Add to playlist ▸</div>' + (inPl ? '<div data-m="plrm" data-id="' + esc2(id) + '">➖ Remove from this playlist</div><div data-m="plup" data-id="' + esc2(id) + '">⬆ Move up</div><div data-m="pldn" data-id="' + esc2(id) + '">⬇ Move down</div>' : '') + '<hr><div data-m="art" data-id="' + esc2(id) + '">🎤 Go to ' + esc2(t.a) + '</div>' + (t.al && ALB[t.al] ? '<div data-m="alb" data-id="' + esc2(id) + '">💿 Go to album</div>' : '') + '<div data-m="gen" data-id="' + esc2(id) + '">🎼 More ' + esc2(t.g) + '</div><div data-m="info" data-id="' + esc2(id) + '">ℹ️ Track info</div>' + (t.my ? '<hr><div data-m="edit" data-id="' + esc2(id) + '">✏️ Edit info</div><div data-m="delmine" data-id="' + esc2(id) + '">🗑 Delete from my music</div>' : ''), x, y);
  };
  const plMenu = (id, x, y) => openMenu('<div class="small mute" style="cursor:default">Add to playlist</div>' + pls.map(p => '<div data-m="pladd" data-pl="' + p.id + '" data-id="' + esc2(id) + '">' + (p.ids.includes(id) ? '✓ ' : '') + esc2(p.name) + '</div>').join('') + '<hr><div data-m="plnew" data-id="' + esc2(id) + '">➕ New playlist...</div>', x, y);
  const newPlaylist = (addId) => { const name = (prompt('Name your playlist', 'My playlist ' + (pls.length + 1)) || '').trim(); if (!name) return null; const p = { id: 'p' + Date.now().toString(36), name: name.slice(0, 60), ids: addId ? [addId] : [] }; pls.push(p); savePl(); paintSide(); return p; };
  const info = id => { const t = BY[id]; if (!t) return; const attr = t.a === 'Kevin MacLeod' ? 'Music: ' + t.t + ' by Kevin MacLeod (incompetech.com), Licensed under Creative Commons: By Attribution 4.0 License' : ''; A.dlg('<h3 style="margin-top:0">' + esc2(t.t) + '</h3><table class="small" style="width:100%">' + [['Artist', t.a], t.p ? ['Performer', t.p] : null, t.al ? ['Album', t.al] : null, ['Genre', t.g], t.e ? ['Era', t.e] : null, ['Moods', (t.m || []).map(m => MOODS[m] ? MOODS[m][0] : m).join(', ')], t.ins ? ['Instruments', t.ins] : null, t.bpm ? ['Tempo', t.bpm + ' bpm'] : null, ['Length', t.d ? fmt(t.d) : 'unknown'], ['Source', t.c], ['Licence', t.lic], ['File', t.my ? 'Stored in Moundshroud (on this PC)' : 'web/music/' + t.i]].filter(Boolean).map(([k, v]) => '<tr><td class="mute" style="padding:3px 10px 3px 0;white-space:nowrap">' + k + '</td><td>' + esc2(v) + '</td></tr>').join('') + '</table>' + (t.ds ? '<p class="small mute" style="margin:8px 0">' + esc2(t.ds) + '</p>' : '') + (attr ? '<div class="small" style="margin-top:8px"><b>To credit it:</b> ' + esc2(attr) + '</div>' : '') + '<div class="row" style="margin-top:12px"><span class="sp"></span><button class="ib" onclick="A.closeDlg&&A.closeDlg();document.getElementById(\'ov\').classList.remove(\'on\')">Close</button></div>'); };
  const sleepMenu = (x, y) => openMenu('<div class="small mute" style="cursor:default">Sleep timer</div>' + [15, 30, 45, 60, 90].map(m => '<div data-m="sleep" data-min="' + m + '">' + m + ' minutes</div>').join('') + '<div data-m="sleep" data-min="end">End of this track</div>' + (sleepAt || sleepEnd ? '<hr><div data-m="sleep" data-min="0">Turn off</div>' : ''), x, y);

  /* ---------- events ---------- */
  const listOf = el => { const k = el.dataset.l; return reg[k] ? reg[k] : null; };
  const build = () => {
    P.innerHTML = '<div class="ml-wrap" id="mlwrap" style="position:relative"><div class="ml-side" id="mlside"></div><div class="ml-main" id="mlmain"></div></div><div class="ml-bar" id="mlbar"></div>'; built = true;
    P.onclick = e => {
      const T = e.target, c = sel => T.closest(sel);
      if (!c('.ml-menu')) closeMenu();
      let el;
      if ((el = c('[data-lk]'))) { const id = el.dataset.lk; likes.has(id) ? likes.delete(id) : likes.add(id); saveLikes(); document.querySelectorAll('[data-lk="' + CSS.escape(id) + '"]').forEach(b => { const on = likes.has(id); b.textContent = on ? '♥' : '♡'; b.classList.toggle('liked', on); }); if (view.t === 'liked') { view.keepScroll = true; render(); } e.stopPropagation(); return; }
      if ((el = c('[data-mn]'))) { const r = el.getBoundingClientRect(), row2 = c('.ml-row'), inPl = view.t === 'playlist'; trackMenu(el.dataset.mn, r.left - 170, r.bottom + 4, inPl); e.stopPropagation(); return; }
      if ((el = c('.ml-menu [data-m]'))) { menuAct(el, e); return; }
      if ((el = c('#mlqx'))) { showQ = false; paintQ(); paintBar(); return; } if (c('#mlqclr')) { uq = []; paintQ(); paintBar(); return; } if ((el = c('[data-qrm]'))) { uq.splice(+el.dataset.qrm, 1); paintQ(); paintBar(); return; }
      if ((el = c('.ml-queue [data-tplay]'))) { const t = BY[el.dataset.tplay]; if (t) playTrack(t); return; }
      if ((el = c('[data-more]'))) { const l = reg[el.dataset.more]; if (l) { const cont = el.parentElement.parentElement; cont.innerHTML = l.ids.map((i, n) => row(BY[i], n, el.dataset.more)).join(''); } return; }
      if ((el = c('[data-playl]'))) { const l = reg[el.dataset.playl]; if (l) { const sh = shuffle; shuffle = false; playCtx(l.ids, 0, l.name); shuffle = sh; if (sh) { ctx.order = mkOrder(ctx.ids.length, 0); ctx.pos = 0; } } return; }
      if ((el = c('[data-shufl]'))) { const l = reg[el.dataset.shufl]; if (l) { shuffle = true; ls.set('mlshuf', '1'); playCtx(l.ids, Math.floor(Math.random() * l.ids.length), l.name); } return; }
      if ((el = c('[data-savemix]'))) { const i = +el.dataset.savemix, p = { id: 'p' + Date.now().toString(36), name: MIXES[i][0] + ' ' + new Date().toLocaleDateString(), ids: mixTracks(i, 40).map(t => t.i) }; pls.push(p); savePl(); paintSide(); A.toast('Saved as a playlist.'); return; }
      if ((el = c('[data-plren]'))) { const p = pls.find(x => x.id === el.dataset.plren), n = p && (prompt('Rename playlist', p.name) || '').trim(); if (n) { p.name = n.slice(0, 60); savePl(); render(); } return; }
      if ((el = c('[data-pldel]'))) { if (confirm('Delete this playlist?')) { pls = pls.filter(x => x.id !== el.dataset.pldel); savePl(); go('home'); } return; }
      if ((el = c('[data-clrmine]'))) { if (confirm('Remove ALL the songs you imported or recorded from Moundshroud? This cannot be undone.')) delMine(mine.map(x => x.i)); return; }
      if (c('[data-newpl]')) { const p = newPlaylist(); if (p) go('playlist', p.id); return; }
      if ((el = c('[data-cplay]'))) { /* card play button reserved */ }
      if ((el = c('[data-tplay]'))) { const t = BY[el.dataset.tplay]; const l = c('.ml-shelf') ? [...c('.ml-shelf').querySelectorAll('[data-tplay]')].map(x => x.dataset.tplay) : [t.i]; playCtx(l, Math.max(0, l.indexOf(t.i)), 'Selection'); return; }
      if ((el = c('.goart'))) { go('artist', el.dataset.ar); e.stopPropagation(); return; }
      if ((el = c('[data-go]'))) { goStr(el.dataset.go); return; }
      if ((el = c('.ml-row[data-l]'))) { const l = reg[el.dataset.l]; if (l) { const n = +el.dataset.n; if (cur && cur.i === l.ids[n] && ctx.name === l.name) { toggle(); return; } playCtx(l.ids, n, l.name); } return; }
      const id = T.closest('button') && T.closest('button').id;
      if (id === 'mlimpf') pickFiles(false); else if (id === 'mlimpd') pickFiles(true); else if (id === 'mltvimp') openTvImport(); else if (id === 'mlrecgo' || id === 'mlrecagain') { au.pause(); stopGame(); if (id === 'mlrecagain') rec.discard(); rec.start(); } else if (id === 'mlrecstop') rec.stop(); else if (id === 'mlrecdis') rec.discard(); else if (id === 'mlrecsave') saveRec(); else if (id === 'mlrecdl') dlRec();
      else if (id === 'mlplay') toggle(); else if (id === 'mlnext') nextTrack(1); else if (id === 'mlprev') prevTrack(); else if (id === 'mlshuf') { shuffle = !shuffle; ls.set('mlshuf', shuffle ? '1' : '0'); if (ctx.ids.length) { const keep = ctx.order[ctx.pos]; ctx.order = mkOrder(ctx.ids.length, keep); ctx.pos = shuffle ? 0 : keep; } paintBar(); if (showQ) paintQ(); } else if (id === 'mlrep') { rep = rep === 'all' ? 'one' : rep === 'one' ? 'off' : 'all'; ls.set('mlrep', rep); paintBar(); }
      else if (id === 'mlq-btn') { showQ = !showQ; paintQ(); paintBar(); } else if (id === 'mlsleep') { const r = T.closest('button').getBoundingClientRect(); sleepMenu(r.left - 100, r.top - 190); e.stopPropagation(); }
    };
    P.oninput = e => {
      if (e.target.id === 'mlq') { view.q = e.target.value; clearTimeout(P._qt); P._qt = setTimeout(() => { view.keepScroll = true; render(); }, 160); }
      else if (e.target.id === 'mlvol') { au.volume = +e.target.value / 100; ls.set('mlvol', e.target.value); } else if (e.target.id === 'mlseek') e.target.dataset.drag = '1';
    };
    const hasFiles = e => e.dataTransfer && [...(e.dataTransfer.types || [])].includes('Files');
    P.addEventListener('dragover', e => { if (hasFiles(e)) e.preventDefault(); });
    P.addEventListener('drop', e => { if (!hasFiles(e)) return; e.preventDefault(); const p = MLMine.filesFromDrop(e.dataTransfer); if (view.t !== 'mine') go('mine'); p.then(importFiles); });
    P.onchange = e => { if (e.target.id === 'mlseek') { au.currentTime = +e.target.value; delete e.target.dataset.drag; } };
    P.addEventListener('contextmenu', e => { const r = e.target.closest('.ml-row[data-id]'); if (r) { e.preventDefault(); trackMenu(r.dataset.id, e.clientX, e.clientY, view.t === 'playlist'); } });
    P.addEventListener('keydown', e => { if (e.target.id === 'mlq') e.stopPropagation(); }, true);
    document.addEventListener('click', e => { if (!e.target.closest('.ml-menu') && !e.target.closest('[data-mn]') && !e.target.closest('#mlsleep')) closeMenu(); }, true);
    document.addEventListener('keydown', e => { if (A.cur !== 'music' || /INPUT|TEXTAREA|SELECT/.test((e.target.tagName || ''))) return; if (e.code === 'Space') { e.preventDefault(); toggle(); } else if (e.shiftKey && e.key === 'ArrowRight') nextTrack(1); else if (e.shiftKey && e.key === 'ArrowLeft') prevTrack(); });
    setInterval(() => { if (sleepAt) paintBar(); }, 30000);
  };
  const menuAct = (el, e) => {
    const m = el.dataset.m, id = el.dataset.id, t = BY[id], r = el.getBoundingClientRect(); e.stopPropagation();
    if (m === 'next') { uq.unshift(id); A.toast('Playing next: ' + t.t); closeMenu(); } else if (m === 'queue') { uq.push(id); A.toast('Added to queue'); closeMenu(); } else if (m === 'like') { likes.has(id) ? likes.delete(id) : likes.add(id); saveLikes(); closeMenu(); view.keepScroll = true; render(); paintBar(); }
    else if (m === 'addpl') plMenu(id, r.left, r.top); else if (m === 'pladd') { const p = pls.find(x => x.id === el.dataset.pl); if (p) { if (!p.ids.includes(id)) p.ids.push(id); savePl(); A.toast('Added to ' + p.name); } closeMenu(); } else if (m === 'plnew') { closeMenu(); const p = newPlaylist(id); if (p) A.toast('Added to ' + p.name); }
    else if (m === 'plrm' || m === 'plup' || m === 'pldn') { const p = pls.find(x => x.id === view.a); if (p) { const i = p.ids.indexOf(id); if (m === 'plrm') p.ids.splice(i, 1); else { const j = m === 'plup' ? i - 1 : i + 1; if (j >= 0 && j < p.ids.length) { [p.ids[i], p.ids[j]] = [p.ids[j], p.ids[i]]; } } savePl(); } closeMenu(); view.keepScroll = true; render(); }
    else if (m === 'art') { closeMenu(); go('artist', t.a); } else if (m === 'alb') { closeMenu(); go('album', t.al); } else if (m === 'gen') { closeMenu(); go('genre', t.g); } else if (m === 'info') { closeMenu(); info(id); }
    else if (m === 'edit') { closeMenu(); const ti = prompt('Title', t.t); if (ti === null) return; const ar = prompt('Artist', t.a); if (ar === null) return; const al = prompt('Album (optional)', t.al || ''); if (al === null) return; const ge = prompt('Genre', t.g); if (ge === null) return; const yr = prompt('Year (optional)', t.y || ''); MLMine.update(id, { t: ti.trim() || t.t, a: ar.trim() || t.a, al: (al || '').trim(), g: (ge || '').trim() || t.g, y: +yr || undefined }).then(async () => { await refreshMine(); if (cur && cur.i === id) cur = BY[id]; view.keepScroll = true; render(); paintBar(); }); }
    else if (m === 'delmine') { closeMenu(); if (confirm('Delete "' + t.t + '" from your music?')) delMine([id]); }
    else if (m === 'sleep') { const v = el.dataset.min; closeMenu(); sleepAt = 0; sleepEnd = false; if (v === 'end') sleepEnd = true; else if (+v) sleepAt = Date.now() + (+v) * 60000; paintBar(); A.toast(+v ? 'Sleep timer set for ' + v + ' minutes.' : v === 'end' ? 'Music will stop after this track.' : 'Sleep timer off.'); }
  };
  A.musicLib = { ensure: async () => { if (!built) build(); await load(); return CAT; }, play: id => { const t = BY[id]; if (t) playCtx([id], 0, ''); }, toggle, next: () => nextTrack(1), pause: () => au.pause(), audio: au, catalog: () => CAT, importFiles, refreshMine, mine: () => mine, state: () => ({ cur, ctx, uq, view, likes: [...likes], pls }), go };
  A.registerTab('music', 'Music', async () => { if (!built) build(); if (!loaded) { document.getElementById('mlmain').innerHTML = '<div class="mute" style="padding:30px">Loading your library...</div>'; } await load(); if (!CAT.length) {       /* a new install: the music library is not in the download, so offer what works without it */
      const m = document.getElementById('mlmain'); m.innerHTML = '<div style="padding:30px;max-width:560px;line-height:1.6"><h2 style="margin:0 0 6px">🎼 No music on this PC yet</h2><div class="mute">The free music library is not part of the Moundshroud download, to keep it small. You can bring in your own songs (MP3, M4A, FLAC, Ogg, WAV): they stay on this PC. You can also record, or make music in Studio.</div><div class="row" style="margin-top:12px;gap:6px;flex-wrap:wrap"><button class="pri" id="mlefiles">Add music files…</button><button class="ib" id="mlefolder">Add a whole folder…</button><button class="ib" id="mlerec">🎙️ Record</button><button class="ib" id="mlestudio">🎨 Studio</button></div></div>';
      m.querySelector('#mlefiles').onclick = () => pickFiles(false); m.querySelector('#mlefolder').onclick = () => pickFiles(true);
      m.querySelector('#mlerec').onclick = () => go('record'); m.querySelector('#mlestudio').onclick = () => A.showTab('studio');
      return;
    } if (!document.getElementById('mlmain').firstChild || document.getElementById('mlmain').textContent.startsWith('Loading')) render(); else markPlaying(); paintSide(); paintBar(); });
})();

// Play: offline games, AI storyteller, trivia, character chat, ambient sounds and a focus timer. Everything works with no internet.
// Games register themselves in A.play.games (see play-g1.js and play-g2.js).
(() => {
  const root = $('p-play');
  const SUBS = [['arcade', '🕹️ Arcade'], ['sounds', '🔊 Sounds'], ['story', '📖 Storyteller'], ['trivia', '❓ Trivia'], ['fun', '🎭 Fun with Moundshroud'], ['calm', '🎧 Ambience']];
  let sub = ls.get('playsub', 'arcade'), tok = 0, cur = null; if (sub === 'cyber') sub = 'arcade';
  const P = A.play = { games: {}, active: () => !!cur, exit: () => leave(), diffs: {} };
  /* difficulty: games listed in P.diffs (play-levels.js) get an Easy / Normal / Hard bar and read api.level (0, 1 or 2) when they start. Saved per game (pd_<id>). */
  P.level = id => { const v = +ls.get('pd_' + id, '1'); return v === 0 || v === 2 ? v : 1; };
  root.innerHTML = '<div class="row" id="plsub" style="padding:8px 12px;gap:6px;border-bottom:1px solid var(--line);flex-wrap:wrap"></div><div id="plbody" style="flex:1;min-height:0;display:flex;flex-direction:column"></div>';
  const bar = () => { $('plsub').innerHTML = SUBS.map(s => '<button class="ib' + (sub === s[0] ? ' on' : '') + '" data-s="' + s[0] + '">' + s[1] + '</button>').join(''); };
  $('plsub').onclick = e => { const b = e.target.closest('[data-s]'); if (b) { leave(true); sub = b.dataset.s; ls.set('playsub', sub); render(); } };
  P.open = (id, game) => { if (id === 'cyber') return A.cybertab.go('games', game);      /* the cyber games live in the Cyber tab now */ A.showTab('play'); leave(true); sub = id; ls.set('playsub', id); render(); if (game) setTimeout(() => P.start(game), 50); };
  function render() { const my = ++tok; if (A.music && !cur) A.music.stop(); bar(); const b = $('plbody'); b.innerHTML = ''; b.onclick = null; (SEC[sub] || SEC.arcade)(b, my); }
  A.registerTab('play', 'Games', () => { if (!cur) render(); else if (A.music) A.music.play(cur.id); });
  /* a game in progress is a live thing with its own clock: switching tabs never resumes it from a snapshot */
  if (A.state) A.state.ephemeral('play', () => !!cur);

  /* ---------- high scores ---------- */
  const hsKey = id => 'hs_' + id;
  P.best = id => { const v = ls.get(hsKey(id), ''); return v === '' ? null : +v; };
  P.submit = (id, score, lower) => { const b = P.best(id); const better = b === null || (lower ? score < b : score > b); if (better) ls.set(hsKey(id), String(score)); return better; };

  /* ---------- running a game ---------- */
  P.start = id => {
    const g = P.games[id]; if (!g) return; leave(true); const b = $('plbody'); b.onclick = null; b.onkeydown = null;
    b.innerHTML = '<div class="row" style="padding:8px 12px;border-bottom:1px solid var(--line)"><button class="ib" id="plx">&larr; Games</button><b style="flex:1">' + g.icon + ' ' + esc(g.name) + '</b><button class="ib" id="plmus" title="Theme music on or off"></button><button class="ib" id="plsnd" title="Sound effects on or off"></button><span class="small mute" id="plhud"></span><span class="small mute" id="plbest"></span></div><div id="plstage" class="scroll" style="flex:1;display:flex;flex-direction:column;align-items:center;padding:12px;outline:none" tabindex="0"></div>';
    $('plx').onclick = () => leave();
    const snd = () => { const b = $('plsnd'); if (b) b.textContent = A.sfx && A.sfx.on ? '🔊' : '🔇'; }; snd(); $('plsnd').onclick = () => { if (A.sfx) { A.sfx.on = !A.sfx.on; snd(); if (A.sfx.on) A.sfx.play('good'); } };
    const mus = () => { const b = $('plmus'); if (b) { b.textContent = A.music && A.music.on ? '🎵' : '🎶'; b.style.opacity = A.music && A.music.on ? 1 : .5; } }; mus(); $('plmus').onclick = () => { if (A.music) { A.music.on = !A.music.on; mus(); if (A.music.on) A.music.play(id); } };
    const api = { hud: t => { const h = $('plhud'); if (h) h.textContent = t; }, submit: (s, lower) => { const nb = P.submit(id, s, lower); showBest(id); return nb; }, id, level: P.level(id) };
    { const fb = document.createElement('button'); fb.className = 'ib'; fb.id = 'plfocus'; fb.title = 'Focus mode: hide the app bars and enlarge the game to fit the window'; fb.textContent = '⤢ Focus'; $('plmus').parentNode.insertBefore(fb, $('plmus')); fb.onclick = () => { const on = !document.documentElement.classList.contains('pfocus'); ls.set('play_focus', on ? '1' : '0'); P.focus(on); };
      if (id === 'chess') { const mb = document.createElement('button'); mb.className = 'ib'; mb.id = 'plcmenu'; mb.title = 'Show or hide the chess menu (Play, Analysis, Puzzles, Courses...) while in focus mode'; mb.textContent = '☰ Chess menu'; fb.parentNode.insertBefore(mb, fb); mb.onclick = () => { document.documentElement.classList.toggle('pmenu'); mb.classList.toggle('on'); setTimeout(P.fit, 60); }; } }
    const df = P.diffs[id]; if (df) { const sg = document.createElement('span'); sg.id = 'pldiff'; sg.title = df.tip || 'Difficulty'; sg.style.cssText = 'display:inline-flex;gap:2px;align-items:center'; sg.innerHTML = '<span class="small mute" style="margin-right:4px">Difficulty</span>' + (df.labels || ['Easy', 'Normal', 'Hard']).map((l, i) => '<button class="ib' + (i === api.level ? ' on' : '') + '" data-lv="' + i + '" style="padding:3px 9px">' + l + '</button>').join(''); const hud = $('plhud'); hud.parentNode.insertBefore(sg, $('plmus')); sg.onclick = e => { const b = e.target.closest('[data-lv]'); if (!b || +b.dataset.lv === api.level) return; ls.set('pd_' + id, b.dataset.lv); P.start(id); }; }
    const showBest = gid => { const v = P.best(gid), e = $('plbest'); if (e) e.textContent = v === null ? '' : ' Best: ' + v; }; showBest(id);
    cur = { id, stop: null, off: null }; try { cur.off = A.sfx ? A.sfx.attach(id, $('plstage'), api) : null; } catch (e) { } try { if (A.music) A.music.play(id); } catch (e) { } try { cur.stop = g.mount($('plstage'), api) || null; } catch (e) { A.toast('That game hit a problem: ' + e.message, 4000); leave(); } $('plstage').focus();
    if (cur) P.focus(ls.get('play_focus', '1') !== '0');
  };
  /* ---------- focus mode ---------- */
  // Hides the title bar, tab bar and sub-tabs so the whole game is visible, then enlarges the game itself (CSS zoom on whatever the game drew, sized from its
  // board or canvas) so it fills the window. On by default; the button remembers your choice. Leaving the game or the tab switches it off.
  let fz = { obs: null, t: 0, iv: 0 };
  const FIT = ['#rmcv', '#mbd', '#cb', '#ob2', '#sb', '#lb2', '#be', '#wg', '#tt', '#sn', '#bo', '#fc', '#pc', '#sip', 'canvas', 'iframe'];
  /* what to size the window around: for chess the whole board column (player bars with captured pieces, the board, the voice dock), for other games their board or canvas */
  const fitEl = st => {
    const b = st.querySelector('.acbw');
    if (b) { let c = b; for (let i = 0; i < 4 && c.parentElement && c.parentElement !== st && !c.parentElement.classList.contains('acw'); i++) c = c.parentElement; return c; }      // up to the board column, but never as far as the whole hub page
    if (st.querySelector('#acbody')) return null;          // a chess hub page without a board (lists, courses...): nothing to size around
    for (const s of FIT) { const e = st.querySelector(s); if (e && e.offsetWidth > 60) return e; }
    return null;
  };
  /* The zoom is worked out from the target's natural size (what it measures now divided by the zoom it already has), so measuring never changes anything, and it is only changed
     when that size really changed. Nothing else on the page (a wide table, an opened panel) can shrink the game. */
  P.fit = () => {
    const st = $('plstage'); if (!st || !st.firstElementChild) return; const kids = [...st.children], z0 = parseFloat(kids[0].style.zoom) || 1;
    if (!document.documentElement.classList.contains('pfocus')) { if (z0 !== 1) kids.forEach(k => { k.style.zoom = ''; }); return; }
    if (st.querySelector('#acbody') && !st.querySelector('.acbw')) { if (z0 !== 1) kids.forEach(k => { k.style.zoom = ''; }); return; }      // a chess page without a board (lists, courses, profile...): normal size, it just scrolls
    const tg = fitEl(st), sr = st.getBoundingClientRect(); let r;
    if (tg) r = tg.getBoundingClientRect(); else { let l = 1e9, tp = 1e9, rr = -1e9, bb = -1e9; st.querySelectorAll('*').forEach((e, i) => { if (i > 900) return; const q = e.getBoundingClientRect(); if (q.width > 2 && q.height > 2) { l = Math.min(l, q.left); tp = Math.min(tp, q.top); rr = Math.max(rr, q.right); bb = Math.max(bb, q.bottom); } }); r = { width: rr - l, height: bb - tp, top: tp }; }
    if (!(r.width > 0) || !(r.height > 0)) return;
    const w = r.width / z0, h = r.height / z0, above = Math.max(0, (r.top - sr.top + st.scrollTop) / z0), aw = st.clientWidth - 28, ah = window.innerHeight - sr.top - 14;
    let z = Math.min(aw / w, ah / (above + h)); if (tg && tg.tagName === 'IFRAME') z = 1; /* a long list page with no board just scrolls: never shrink it to fit */ if (!tg && above + h > ah * 1.6) z = 1; z = Math.max(.6, Math.min(2.6, z)); if (z < 1.06 && z > .94) z = 1; z = Math.round(z * 100) / 100;
    if (Math.abs(z - z0) / z0 < .02) return; kids.forEach(k => { k.style.zoom = z === 1 ? '' : String(z); }); st.scrollTop = 0;
  };
  const fitSoon = () => { clearTimeout(fz.t); fz.t = setTimeout(P.fit, 220); };
  P.focus = on => {
    const h = document.documentElement; h.classList.toggle('pfocus', !!on); if (!on) h.classList.remove('pmenu'); let x = document.getElementById('pfx');
    if (on) {
      if (!x) { x = document.createElement('button'); x.id = 'pfx'; x.className = 'ib'; x.textContent = '⤡ Exit focus'; x.title = 'Bring back the app bars so you can move around the app'; x.onclick = () => { ls.set('play_focus', '0'); P.focus(false); }; document.body.appendChild(x); }
      const st = $('plstage'); if (st && !fz.obs) { fz.obs = new MutationObserver(fitSoon); fz.obs.observe(st, { childList: true }); window.addEventListener('resize', fitSoon); st.addEventListener('click', fitSoon); }
      if (!fz.iv) { let n = 0; fz.iv = setInterval(() => { if (!cur || A.cur !== 'play') { P.focus(false); return; } if (++n % 2 === 0 && !document.hidden) P.fit(); }, 400); }
      setTimeout(P.fit, 60); setTimeout(P.fit, 500); setTimeout(P.fit, 1500);
    } else {
      if (x) x.remove(); if (fz.obs) { fz.obs.disconnect(); fz.obs = null; window.removeEventListener('resize', fitSoon); const st = $('plstage'); if (st) st.removeEventListener('click', fitSoon); } clearInterval(fz.iv); fz.iv = 0; P.fit();
    }
    const b = $('plfocus'); if (b) b.classList.toggle('on', !!on);
  };
  function leave(silent) { if (cur) { try { cur.stop && cur.stop(); } catch (e) {} try { cur.off && cur.off(); } catch (e) { } cur = null; if (A.music) A.music.stop(); P.focus(false); } if (!silent) render(); }
  addEventListener('keydown', e => { if (cur && A.cur === 'play' && /^(Arrow|Space| )/.test(e.key + (e.code || '')) && !/INPUT|TEXTAREA|SELECT/.test((e.target || {}).tagName || '')) e.preventDefault(); }, true);

  const SEC = {};
  P.addSub = (id, label, fn) => { if (!SUBS.some(s => s[0] === id)) SUBS.push([id, label]); SEC[id] = (b, my) => fn(b, my); };
  /* ---------------- SOUNDS ---------------- */
  SEC.sounds = b => {
    const on = () => A.sfx.on, vol = () => A.sfx.vol, vox = A.sfx.VOICES, names = Object.entries(P.games).map(([id, g]) => [id, g.name, g.icon]);
    const NICE = { tick: 'Tick', click: 'Click', select: 'Select', pop: 'Pop', pop2: 'Pop (reply)', clack: 'Clack', flip: 'Flip', drop: 'Drop', thud: 'Thud', slide: 'Slide', switch: 'Switch', key: 'Key', tile: 'Tile', enter: 'Enter', pencil: 'Pencil', peg: 'Peg', blip: 'Blip', coin: 'Coin', good: 'Good', bad: 'Bad', error: 'Error', win: 'Win', lose: 'Lose', draw: 'Draw', levelup: 'Level up', line: 'Line', bounce: 'Bounce', ping: 'Ping', flap: 'Flap', splash: 'Splash', boom: 'Boom', bonk: 'Bonk', beep: 'Beep', rotate: 'Rotate', whoosh: 'Whoosh', flag: 'Flag', sniff: 'Sad end' };
    const CNICE = { c_move: 'Your move', c_move_o: 'Opponent move', c_capture: 'Your capture', c_capture_o: 'Opponent capture', c_castle: 'Castle', c_check: 'Check', c_mate: 'Checkmate', c_promote: 'Promotion', c_start: 'Game start', c_win: 'You win', c_lose: 'You lose', c_draw: 'Draw', c_illegal: 'Illegal move', c_low: 'Low clock' };
    b.innerHTML = '<div class="scroll pad" style="flex:1"><h2>🔊 Sounds</h2><div class="mute small">Every game has its own sounds: moves, captures, scores, wins and losses. They are made on the spot, so there is nothing to download and nothing leaves this PC.</div>' +
      '<div class="card" style="margin-top:10px"><div class="row" style="gap:12px;flex-wrap:wrap"><label class="chk"><input type="checkbox" id="sfxon"' + (on() ? ' checked' : '') + '> Game sounds on</label><span class="small mute">Volume</span><input type="range" id="sfxvol" min="0" max="100" step="5" value="' + vol() + '" style="flex:1;min-width:140px"><b id="sfxvolv">' + vol() + '%</b></div><div class="small mute" style="margin-top:6px">There is also a speaker button at the top of every game. Chess has its own extras (piece sounds, volume) under Chess &gt; Board settings.</div></div>' +
      '<div class="card" style="margin-top:10px"><b>🎵 Theme songs</b><div class="small mute" style="margin:2px 0 8px">By default the games play <b>classical piano</b>: Kimiko Ishizaka\'s recordings of Bach\'s Goldberg Variations and Well-Tempered Clavier, released into the public domain (free to use, from archive.org) and stored on this PC. Each game has its own playlist that carries on where it left off. You can switch to the games\' own synthesised themes instead.</div><div class="row" style="gap:10px;flex-wrap:wrap;margin-bottom:8px"><span class="small mute">Music</span><select id="mxsrc"><option value="piano"' + (A.music.src === 'piano' ? ' selected' : '') + '>Classical piano (recordings)</option><option value="synth"' + (A.music.src === 'synth' ? ' selected' : '') + '>Game themes (synthesised)</option></select><button class="ib" id="mxskip" title="Next piece">⏭ Next piece</button><span class="small mute" id="mxnow"></span></div><div class="row" style="gap:12px;flex-wrap:wrap"><label class="chk"><input type="checkbox" id="mxon"' + (A.music.on ? ' checked' : '') + '> Theme music on</label><span class="small mute">Volume</span><input type="range" id="mxvol" min="0" max="100" step="5" value="' + A.music.vol + '" style="flex:1;min-width:140px"><b id="mxvolv">' + A.music.vol + '%</b></div><div class="small mute" style="margin:10px 0 4px">Click a game theme to hear the synthesised version:</div><div class="row" style="gap:6px;flex-wrap:wrap" id="mxlist">' + Object.entries(A.music.TRACKS).map(([id, t]) => '<button class="ib" data-m="' + id + '" title="' + t.key + ' ' + t.sc + ', ' + t.bpm + ' bpm">' + ((P.games[id] && P.games[id].icon) || '🎵') + ' ' + esc(t.name) + '</button>').join('') + '<button class="ib dang" id="mxstop">■ Stop</button></div></div>' +
      '<h3>Chess</h3><div class="row" style="gap:6px;flex-wrap:wrap" id="sfxch">' + A.sfx.CHESS.map(n => '<button class="ib" data-c="' + n.slice(2) + '">' + (CNICE[n] || n) + '</button>').join('') + '<button class="ib" data-c="capture" data-o="1">Opponent capture</button><button class="ib" data-c="move" data-o="1">Opponent move</button></div>' +
      '<h3>Sound library</h3><div class="row" style="gap:6px;flex-wrap:wrap" id="sfxlib">' + A.sfx.NAMES.map(n => '<button class="ib" data-n="' + n + '">' + (NICE[n] || n) + '</button>').join('') + '</div>' +
      '<h3>What each game uses</h3><div class="small mute" style="margin-bottom:6px">Click a game to hear its main sound.</div><div class="mode" id="sfxgames">' + names.map(([id, n, ic]) => { const v = Object.assign({}, vox.default, vox[id] || {}), main = v.click || v.key || v.score || null; return '<div class="card" data-g="' + id + '" style="cursor:pointer;margin:0"><b>' + ic + ' ' + esc(n) + '</b><div class="small mute">' + (id === 'chess' ? 'Wood knocks, captures, checks, start and end' : ([v.click && 'tap: ' + v.click, v.key && 'keys: ' + v.key, v.opp && 'reply: ' + v.opp, v.score && 'points: ' + v.score].filter(Boolean).join(' · ') || 'own tones') + ' · wins and losses') + '</div></div>'; }).join('') + '</div></div>';
    const hear = n => { const was = A.sfx.on; A.sfx.on = true; A.sfx.play(n); A.sfx.on = was; };
    $('sfxon').onchange = () => { A.sfx.on = $('sfxon').checked; if (A.sfx.on) A.sfx.play('good'); };
    $('sfxvol').oninput = () => { A.sfx.vol = +$('sfxvol').value; $('sfxvolv').textContent = $('sfxvol').value + '%'; };
    $('sfxvol').onchange = () => hear('pop');
    $('mxon').onchange = () => { A.music.on = $('mxon').checked; };
    $('mxvol').oninput = () => { A.music.vol = +$('mxvol').value; $('mxvolv').textContent = $('mxvol').value + '%'; };
    $('mxlist').onclick = e => { const m = e.target.closest('[data-m]'); if (m) { const was = A.music.on; A.music.on = true; A.music.play(m.dataset.m, true); } };
    const now = () => { const t = A.music.nowPlaying && A.music.nowPlaying(), e = $('mxnow'); if (e) e.textContent = t ? '♪ ' + t.w + ': ' + t.t + (t.lic ? ' (' + t.c + '; ' + t.lic + ')' : '') : ''; }; now(); const nt = setInterval(() => { if (!$('mxnow')) clearInterval(nt); else now(); }, 1500);
    $('mxsrc').onchange = () => { A.music.src = $('mxsrc').value; setTimeout(now, 600); };
    $('mxskip').onclick = () => { if (A.music.skip) A.music.skip(); setTimeout(now, 400); };
    $('mxstop').onclick = () => A.music.stop();
    $('sfxch').onclick = e => { const c = e.target.closest('[data-c]'); if (!c) return; const was = A.sfx.on; A.sfx.on = true; A.sfx.chess(c.dataset.c, !!c.dataset.o, 1); A.sfx.on = was; };
    $('sfxlib').onclick = e => { const c = e.target.closest('[data-n]'); if (c) hear(c.dataset.n); };
    $('sfxgames').onclick = e => { const c = e.target.closest('[data-g]'); if (!c) return; const v = Object.assign({}, vox.default, vox[c.dataset.g] || {}); if (c.dataset.g === 'chess') { const was = A.sfx.on; A.sfx.on = true; A.sfx.chess('capture', false, 1); A.sfx.on = was; return; } const n = v.click || v.key || v.score; if (n && n !== 'tetris') hear(n); else hear('line'); };
  };
  /* ---------------- CYBER GAMES ---------------- */
  SEC.cyber = b => {
    const gs = A.az(Object.entries(P.games).filter(([, g]) => g.cat === 'cyber'), x => x[1].name);
    b.innerHTML = '<div class="scroll pad" style="flex:1"><h2>Cyber games</h2><div class="mute small">Hacker-style puzzles that teach how attacks and defences really work. Everything is a safe sandbox with pretend files, a pretend database and made-up emails. For the guides behind them, open <b>Cyber &gt; Cyber Lab</b>.</div><div class="mode" style="margin-top:12px">' +
      gs.map(([id, g]) => { const hs = P.best(id); return '<div class="card" data-g="' + id + '"><b>' + g.icon + ' ' + esc(g.name) + '</b><div class="small mute">' + esc(g.desc) + '</div>' + (hs !== null ? '<div class="small" style="margin-top:4px;color:var(--acc2)">Best: ' + hs + '</div>' : '') + '</div>'; }).join('') + '</div></div>';
    b.onclick = e => { const c = e.target.closest('[data-g]'); if (c) P.start(c.dataset.g); };
  };
  /* ---------------- ARCADE ---------------- */
  SEC.arcade = b => {
    const gs = A.az(Object.entries(P.games).filter(([id, g]) => !g.cat && id !== 'chess' && id !== 'middlewatch'), x => x[1].name), ch = P.games.chess, mw = P.games.middlewatch;
    const feat = ch ? '<div class="feat" data-g="chess" role="button" tabindex="0" aria-label="Play Chess, the featured game"><div class="feat-board" aria-hidden="true">♞</div><div class="feat-body"><div class="feat-tag">⭐ Featured · the best game in Moundshroud</div><h2 class="feat-title">♟️ Chess</h2><div class="feat-desc">A whole chess site built in: play Stockfish at any strength, online and daily games, tournaments, clubs and a living community, a full career mode, coach, puzzles, courses, variants and voice moves for blindfold play.</div><div class="feat-chips"><span>⚡ Stockfish</span><span>🏆 Career</span><span>🗣 Community</span><span>🎙 Voice moves</span><span>🧩 Puzzles</span><span>🎓 Coach</span></div><button class="pri feat-go">Play chess</button></div></div>' : '';
    const feat2 = mw ? '<div class="feat feat2" data-g="middlewatch" role="button" tabindex="0" aria-label="Play Middle Watch, also featured"><div class="feat-board" aria-hidden="true">🕯️</div><div class="feat-body"><div class="feat-tag">⭐ Also featured · an original adventure</div><h2 class="feat-title">Middle Watch</h2><div class="feat-desc">A pixel-art fantasy adventure in four chapters: explore, talk, trade, make allies, and fight or calm your way through. Your progress is saved.</div><div class="feat-chips"><span>🗺 4 chapters</span><span>👾 Pixel art</span><span>💾 Saves progress</span></div><button class="pri feat-go">Play Middle Watch</button></div></div>' : '';
    b.innerHTML = '<div class="scroll pad" style="flex:1"><h2>Arcade</h2><div class="mute small">Classic games, ready to play with no internet. Your best scores are saved on this PC. Press <kbd>Esc</kbd> to leave a game.</div>' + feat + feat2 + '<div class="mode" style="margin-top:12px">' +
      gs.map(([id, g]) => { const hs = P.best(id); return '<div class="card" data-g="' + id + '"><b>' + g.icon + ' ' + esc(g.name) + '</b><div class="small mute">' + esc(g.desc) + '</div>' + (hs !== null ? '<div class="small" style="margin-top:4px;color:var(--acc2)">Best: ' + hs + '</div>' : '') + '</div>'; }).join('') + '</div></div>';
    b.onclick = e => { const c = e.target.closest('[data-g]'); if (c) P.start(c.dataset.g); };
    b.onkeydown = e => { const c = e.target.closest && e.target.closest('.feat'); if (c && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); P.start(c.dataset.g); } };
  };

  /* ---------------- STORYTELLER (AI) ---------------- */
  const GENRES = [['Fantasy quest', 'a classic fantasy adventure with magic, ruins and strange creatures'], ['Mystery', 'a cosy detective mystery with clues, suspects and a twist'], ['Sci-fi', 'a space adventure on a ship or distant planet'], ['Survival', 'a wilderness or post-storm survival story where clever choices matter'], ['Pirates', 'a swashbuckling pirate adventure on the high seas'], ['Spooky', 'a spooky (not too scary) ghost story in an old house'], ['Bedtime', 'a gentle, calming bedtime story for a child, with no danger and a soft ending']];
  SEC.story = (b, my) => {
    let st = null; try { st = JSON.parse(ls.get('story', 'null')); } catch (e) {}
    const save = () => ls.set('story', JSON.stringify(st));
    const draw = () => {
      if (!st) {
        b.innerHTML = '<div class="scroll pad" style="flex:1"><h2>Storyteller</h2><div class="mute small">Moundshroud runs an interactive story. Pick a genre, then choose what happens next - or type your own idea. It is written by your local AI, so every story is different.</div><div class="mode" style="margin-top:12px">' + GENRES.map((g, i) => '<div class="card" data-gn="' + i + '"><b>' + g[0] + '</b></div>').join('') + '</div><label class="small mute" style="display:block;margin-top:10px">Your character\'s name (optional)<br><input id="stn" type="text" placeholder="e.g. Sam" value="' + esc(ls.get('storyname', '')) + '" style="max-width:260px"></label></div>';
        b.onclick = e => { const c = e.target.closest('[data-gn]'); if (!c) return; const g = GENRES[+c.dataset.gn]; ls.set('storyname', $('stn').value.trim()); st = { genre: g[0], desc: g[1], name: $('stn').value.trim() || 'the traveller', turns: [] }; save(); turn('Begin the story. Set the scene and give me my first choices.'); };
        return;
      }
      b.innerHTML = '<div class="row" style="padding:8px 12px;border-bottom:1px solid var(--line);flex-wrap:wrap"><b style="flex:1">📖 ' + esc(st.genre) + '</b><label class="chk small mute"><input type="checkbox" id="stl"' + (ls.get('storyread', '0') === '1' ? ' checked' : '') + '> Read aloud</label><button class="ib" id="stn2">New story</button></div><div id="stlog" style="flex:1;overflow:auto;padding:12px 14px"></div><div class="composer"><div id="stopt" class="chips" style="margin:0 0 6px"></div><div class="row"><input id="sti" type="text" placeholder="Or type what you do next..."><button class="pri" id="stg">Go</button></div></div>';
      $('stlog').innerHTML = st.turns.map(t => t.role === 'user' ? '<div class="m u" style="max-width:85%">' + esc(t.text) + '</div>' : '<div class="m a" style="max-width:94%">' + md(t.text) + '</div>').join('');
      $('stlog').scrollTop = $('stlog').scrollHeight; options();
      $('stl').onchange = () => ls.set('storyread', $('stl').checked ? '1' : '0'); $('stn2').onclick = async () => { if (!st.turns.length || (await A.confirm('Start a new story? This one is saved only until you do.'))) { st = null; ls.set('story', 'null'); draw(); } };
      const go = () => { const v = $('sti').value.trim(); if (v) { $('sti').value = ''; turn(v); } }; $('stg').onclick = go; $('sti').onkeydown = e => { if (e.key === 'Enter') go(); };
      $('stopt').onclick = e => { const c = e.target.closest('[data-o]'); if (c) turn(c.dataset.o); };
    };
    const options = () => { const last = st.turns.length ? st.turns[st.turns.length - 1] : null; const o = $('stopt'); if (!o || !last || last.role !== 'ai') return; const opts = [...last.text.matchAll(/^\s*(?:\*\*)?\s*(?:[1-4])[.)]\s*(.+?)\s*$/gm)].map(m => m[1].replace(/\*+/g, '').trim()).filter(x => x.length > 2).slice(0, 4); o.innerHTML = opts.map(x => '<span class="chip" data-o="' + esc(x) + '">' + esc(x.length > 70 ? x.slice(0, 68) + '...' : x) + '</span>').join(''); };
    let busy = false;
    async function turn(text) {
      if (busy) return; busy = true; st.turns.push({ role: 'user', text }); draw(); const log = $('stlog'); log.insertAdjacentHTML('beforeend', '<div class="m a" id="stnow" style="max-width:94%"><span class="dots"></span></div>'); log.scrollTop = log.scrollHeight;
      const sys = 'You are the narrator of an interactive ' + st.genre + ' story: ' + st.desc + '. The player is ' + st.name + '. Write in second person, vivid but concise (about 120-180 words per turn). Keep continuity with earlier turns. Never end the story unless the player reaches a natural ending; keep it fun and age-appropriate. ALWAYS finish each turn with exactly three numbered options on their own lines (1. 2. 3.) for what the player could do next, and nothing after them.';
      const msgs = [{ role: 'system', content: sys }, ...st.turns.slice(-14).map(t => ({ role: t.role === 'user' ? 'user' : 'assistant', content: t.text }))];
      let out = ''; try {
        const r = await fetch('/api/chat', { method: 'POST', body: JSON.stringify({ model: $('model').value, stream: true, think: false, keep_alive: '3m', options: { temperature: 0.9 }, messages: msgs }) });
        if (!r.ok) throw new Error('The AI engine did not answer'); const rd = r.body.getReader(), dec = new TextDecoder(); let buf = '';
        for (;;) { const { value, done } = await rd.read(); if (done) break; buf += dec.decode(value, { stream: true }); let i; while ((i = buf.indexOf('\n')) >= 0) { const ln = buf.slice(0, i).trim(); buf = buf.slice(i + 1); if (!ln) continue; try { const j = JSON.parse(ln); if (j.message && j.message.content) { out += j.message.content; const n = $('stnow'); if (n) { n.innerHTML = md(out); $('stlog').scrollTop = $('stlog').scrollHeight; } } } catch (e) {} } }
      } catch (e) { out = out || '*The storyteller lost the thread (' + e.message + '). Try again.*'; }
      st.turns.push({ role: 'ai', text: out.trim() }); save(); busy = false; if (tok === my && $('stlog')) { draw(); if (ls.get('storyread', '0') === '1') A.speech.speak(out.replace(/^\s*[1-4][.)].*$/gm, '')); }
    }
    draw();
  };

  /* ---------------- TRIVIA (reuses the quiz engine) ---------------- */
  SEC.trivia = b => {
    const CATS = [['General knowledge', 'general knowledge'], ['Science and nature', 'science and nature'], ['History', 'world history'], ['Geography', 'world geography'], ['Space', 'astronomy and space exploration'], ['Animals', 'animals and wildlife'], ['Food and cooking', 'food, cooking and cuisines'], ['Movies and music', 'movies and music'], ['Technology', 'technology and computing'], ['Survival and outdoors', 'outdoor skills, first aid and survival']];
    b.innerHTML = '<div class="scroll pad" style="flex:1"><h2>Trivia</h2><div class="mute small">Moundshroud writes a fresh set of questions every time, then scores you with explanations. Pick a topic and difficulty.</div><div class="row" style="margin:10px 0;flex-wrap:wrap;gap:10px"><label class="small mute">Level <select id="tvl"><option value="easy">Easy</option><option value="medium" selected>Medium</option><option value="hard">Hard</option></select></label><label class="small mute">Questions <select id="tvn"><option>5</option><option selected>10</option><option>15</option></select></label></div><div class="mode">' + CATS.map((c, i) => '<div class="card" data-c="' + i + '"><b>' + esc(c[0]) + '</b></div>').join('') + '</div><div class="row" style="margin-top:10px"><input id="tvc" type="text" placeholder="...or any topic, e.g. 80s cartoons, dinosaurs, chess"><button class="pri" id="tvg">Play</button></div></div>';
    const go = topic => { A.quiz.auto({ title: 'Trivia: ' + topic.slice(0, 30), topic: topic + ' trivia: fun, surprising, accurate questions a quiz-night host would ask', text: '' }, { count: +$('tvn').value, level: $('tvl').value, types: ['mc', 'tf', 'mc'] }); };
    b.onclick = e => { const c = e.target.closest('[data-c]'); if (c) go(CATS[+c.dataset.c][1]); }; $('tvg').onclick = () => { const v = $('tvc').value.trim(); if (v) go(v); else A.toast('Type a topic first'); };
  };

  /* ---------------- FUN WITH MOUNDSHROUD (character chat and prompts) ---------------- */
  SEC.fun = b => {
    const ACTS = [['😂 Tell me a joke', 'Tell me a clean, genuinely funny joke. Then, if I ask, another.'], ['🧩 Give me a riddle', 'Give me a clever riddle. Do NOT reveal the answer until I guess or ask for it.'], ['🤔 Would you rather', 'Ask me a fun "would you rather" question with two interesting options, then react to my choice.'], ['🔮 20 Questions (I guess)', 'Let us play 20 Questions. Think of a common object, animal or place but keep it secret. I will ask yes/no questions; answer truthfully and count them. Say "Ready" to start.'], ['🧠 20 Questions (you guess)', 'Let us play 20 Questions where YOU guess. I am thinking of something. Ask me one yes/no question at a time and keep count. Start with your first question.'], ['🌟 Surprising fact', 'Tell me one surprising, true fact I probably do not know, in two sentences.'], ['🎲 Make a tabletop character', 'Create a fun fantasy role-playing character for me with a name, class, backstory, quirk and three signature items.'], ['🍳 What can I cook?', 'I will list ingredients I have. Suggest three easy meals and ask me what I have first.']];
    const CHARS = [['🏴‍☠️ Pirate captain', 'a boisterous pirate captain'], ['🧙 Wise wizard', 'a wise, slightly forgetful wizard'], ['🕵️ Noir detective', 'a world-weary 1940s noir detective'], ['👵 Cheerful grandma', 'a warm, funny grandmother who gives great advice'], ['🤖 Dramatic robot', 'an over-dramatic robot butler'], ['🧑‍🚀 Space captain', 'a calm starship captain'], ['🎤 Stand-up comic', 'a quick-witted stand-up comedian']];
    b.innerHTML = '<div class="scroll pad" style="flex:1"><h2>Fun with Moundshroud</h2><div class="mute small">Quick games and silly ideas. These open in Chat so you can keep going.</div><div class="mode" style="margin-top:12px">' + ACTS.map((a, i) => '<div class="card" data-a="' + i + '"><b>' + esc(a[0]) + '</b></div>').join('') + '</div><h3>Chat with a character</h3><div class="chips">' + CHARS.map((c, i) => '<span class="chip" data-c="' + i + '">' + esc(c[0]) + '</span>').join('') + '</div><h3>Write something</h3><div class="row" style="flex-wrap:wrap;gap:8px"><select id="fwk"><option>poem</option><option>limerick</option><option>short story</option><option>song</option><option>haiku</option><option>speech</option></select><input id="fwt" type="text" placeholder="about..." style="flex:1;min-width:180px"><button class="pri" id="fwg">Write it</button></div><h3>Wander</h3><div class="row" style="gap:8px;flex-wrap:wrap"><button class="ib" id="fwr">Surprise me: random article</button></div></div>';
    b.onclick = e => {
      const a = e.target.closest('[data-a]'), c = e.target.closest('[data-c]');
      if (a) { A.chat.newChat(); A.chat.ask(ACTS[+a.dataset.a][1], { noLocal: true, sources: [] }); }
      else if (c) { const ch = CHARS[+c.dataset.c]; A.chat.newChat(); A.chat.ask('Let us role-play. From now on you are ' + ch[1] + '. Stay in character for the whole conversation, keep replies short and entertaining, and greet me in character.', { noLocal: true, sources: [] }); }
    };
    $('fwg').onclick = () => { const t = $('fwt').value.trim(); if (!t) return A.toast('What should it be about?'); A.chat.newChat(); A.chat.ask('Write a ' + $('fwk').value + ' about ' + t + '. Make it vivid and a little witty.', { noLocal: true, sources: [] }); };
    $('fwr').onclick = async () => { await A.lib.init(); A.showTab('web'); const bk = (await A.api('/api/lib/books')).books.find(x => x.category === 'Wikipedia'); if (bk) A.lib.openUrl('/wiki/random?content=' + encodeURIComponent(bk.name), ''); };
  };

  /* ---------------- AMBIENCE (generated sound, no files) ---------------- */
  let ac = null, master = null, layers = {}, sleepT = null;
  const noiseBuf = (type) => { const n = ac.sampleRate * 4, buf = ac.createBuffer(1, n, ac.sampleRate), d = buf.getChannelData(0); let b0 = 0, b1 = 0, b2 = 0, last = 0; for (let i = 0; i < n; i++) { const w = Math.random() * 2 - 1; if (type === 'brown') { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; } else if (type === 'pink') { b0 = 0.99765 * b0 + w * 0.099046; b1 = 0.963 * b1 + w * 0.2965164; b2 = 0.57 * b2 + w * 1.0526913; d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.2; } else d[i] = w * 0.5; } return buf; };
  const src = (type) => { const s = ac.createBufferSource(); s.buffer = noiseBuf(type); s.loop = true; return s; };
  const LAYERS = {
    rain: { name: '🌧️ Rain', build() { const s = src('pink'), f = ac.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 900; const g = ac.createGain(); g.gain.value = 0.55; s.connect(f); f.connect(g); s.start(); return { out: g, stop: () => s.stop() }; } },
    ocean: { name: '🌊 Ocean', build() { const s = src('brown'), f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 700; const g = ac.createGain(), lfo = ac.createOscillator(), lg = ac.createGain(); lfo.frequency.value = 0.1; lg.gain.value = 0.35; g.gain.value = 0.5; lfo.connect(lg); lg.connect(g.gain); s.connect(f); f.connect(g); s.start(); lfo.start(); return { out: g, stop: () => { s.stop(); lfo.stop(); } }; } },
    wind: { name: '🌬️ Wind', build() { const s = src('pink'), f = ac.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 0.8; f.frequency.value = 450; const l = ac.createOscillator(), lg = ac.createGain(); l.frequency.value = 0.15; lg.gain.value = 250; l.connect(lg); lg.connect(f.frequency); const g = ac.createGain(); g.gain.value = 0.6; s.connect(f); f.connect(g); s.start(); l.start(); return { out: g, stop: () => { s.stop(); l.stop(); } }; } },
    fire: { name: '🔥 Fireplace', build() { const s = src('brown'), f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 400; const g = ac.createGain(); g.gain.value = 0.45; s.connect(f); f.connect(g); s.start(); const tm = setInterval(() => { if (!ac) return; const o = ac.createBufferSource(); o.buffer = noiseBuf('white'); const bf = ac.createBiquadFilter(); bf.type = 'highpass'; bf.frequency.value = 2500 + Math.random() * 2500; const eg = ac.createGain(); eg.gain.setValueAtTime(0.5 * Math.random(), ac.currentTime); eg.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.04 + Math.random() * 0.08); o.connect(bf); bf.connect(eg); eg.connect(g); o.start(ac.currentTime, Math.random() * 3, 0.15); }, 160); return { out: g, stop: () => { s.stop(); clearInterval(tm); } }; } },
    night: { name: '🦗 Summer night', build() { const g = ac.createGain(); g.gain.value = 0.25; const o = ac.createOscillator(); o.frequency.value = 4300; const m = ac.createGain(); m.gain.value = 0; const l = ac.createOscillator(); l.type = 'square'; l.frequency.value = 18; const lg = ac.createGain(); lg.gain.value = 0.5; l.connect(lg); lg.connect(m.gain); const wob = ac.createOscillator(), wg = ac.createGain(); wob.frequency.value = 0.4; wg.gain.value = 0.3; wob.connect(wg); wg.connect(m.gain); o.connect(m); m.connect(g); o.start(); l.start(); wob.start(); return { out: g, stop: () => { o.stop(); l.stop(); wob.stop(); } }; } },
    brown: { name: '🟤 Brown noise (focus)', build() { const s = src('brown'), g = ac.createGain(); g.gain.value = 0.7; s.connect(g); s.start(); return { out: g, stop: () => s.stop() }; } },
    pad: { name: '🎹 Calm pad', build() { const g = ac.createGain(); g.gain.value = 0.18; const oscs = [130.81, 164.81, 196, 246.94].map((f, i) => { const o = ac.createOscillator(); o.type = 'sine'; o.frequency.value = f; const og = ac.createGain(); og.gain.value = 0.25; const l = ac.createOscillator(), lg = ac.createGain(); l.frequency.value = 0.05 + i * 0.03; lg.gain.value = 0.12; l.connect(lg); lg.connect(og.gain); o.connect(og); og.connect(g); o.start(); l.start(); return [o, l]; }); return { out: g, stop: () => oscs.forEach(a => a.forEach(x => x.stop())) }; } }
  };
  const ensureAudio = async () => { if (!ac) { ac = new (window.AudioContext || window.webkitAudioContext)(); master = ac.createGain(); master.gain.value = +ls.get('ambvol', '0.8'); master.connect(ac.destination); } if (ac.state === 'suspended') await ac.resume(); };
  const setLayer = async (id, on, vol) => { await ensureAudio(); if (on && !layers[id]) { const l = LAYERS[id].build(), vg = ac.createGain(); vg.gain.value = vol; l.out.connect(vg); vg.connect(master); layers[id] = { l, vg }; } else if (!on && layers[id]) { try { layers[id].l.stop(); layers[id].vg.disconnect(); } catch (e) {} delete layers[id]; } };
  P.stopAmbience = () => { Object.keys(layers).forEach(k => setLayer(k, false)); clearTimeout(sleepT); sleepT = null; };
  SEC.calm = (b, my) => {
    const vols = JSON.parse(ls.get('ambvols', '{}')); let pomo = null;
    b.innerHTML = '<div class="scroll pad" style="flex:1"><h2>Ambience</h2><div class="mute small">Mix relaxing sounds, generated on the spot - no files and no internet. Handy for focus, sleep, or a quiet evening without power. Sounds keep playing while you use other tabs.</div><div id="aml" style="margin-top:10px">' +
      Object.entries(LAYERS).map(([id, l]) => '<div class="card row" style="padding:8px 12px;margin:0 0 6px;gap:10px"><label class="chk" style="flex:1"><input type="checkbox" data-l="' + id + '"' + (layers[id] ? ' checked' : '') + '> ' + l.name + '</label><input type="range" min="0" max="1" step="0.05" data-v="' + id + '" value="' + (vols[id] == null ? 0.6 : vols[id]) + '" style="width:130px"></div>').join('') + '</div>' +
      '<div class="row" style="flex-wrap:wrap;gap:10px;margin:8px 0"><label class="small mute">Master volume <input type="range" id="amm" min="0" max="1" step="0.05" value="' + ls.get('ambvol', '0.8') + '" style="vertical-align:middle;width:140px"></label><label class="small mute">Sleep timer <select id="ams"><option value="0">Off</option><option value="15">15 min</option><option value="30">30 min</option><option value="60">1 hour</option><option value="120">2 hours</option></select></label><button class="ib" id="amx">Stop all</button></div><span class="small mute" id="amst"></span>' +
      '<div class="card" style="margin-top:12px"><b>Focus timer</b><div class="small mute" style="margin:2px 0 8px">Work in blocks, rest in between (Pomodoro).</div><div class="row" style="flex-wrap:wrap;gap:8px;align-items:center"><span id="pmd" style="font:600 34px Consolas,monospace;min-width:110px">25:00</span><button class="pri" id="pms">Start 25 min</button><button class="ib" id="pmb">Break 5 min</button><button class="ib" id="pmr">Reset</button></div></div></div>';
    b.onchange = async e => { const t = e.target; if (t.dataset.l) { await setLayer(t.dataset.l, t.checked, +(b.querySelector('[data-v=' + t.dataset.l + ']').value)); } };
    b.oninput = e => { const t = e.target; if (t.dataset.v) { vols[t.dataset.v] = +t.value; ls.set('ambvols', JSON.stringify(vols)); if (layers[t.dataset.v]) layers[t.dataset.v].vg.gain.value = +t.value; } else if (t.id === 'amm') { ls.set('ambvol', t.value); if (master) master.gain.value = +t.value; } };
    $('amx').onclick = () => { P.stopAmbience(); b.querySelectorAll('[data-l]').forEach(c => { c.checked = false; }); $('amst').textContent = ''; };
    $('ams').onchange = () => { clearTimeout(sleepT); const m = +$('ams').value; if (m) { sleepT = setTimeout(() => { P.stopAmbience(); A.toast('Sleep timer finished - ambience stopped', 4000); }, m * 60000); $('amst').textContent = 'Will stop in ' + m + ' minutes.'; } else $('amst').textContent = ''; };
    const tick = () => { if (!pomo) return; const left = Math.max(0, Math.round((pomo.end - Date.now()) / 1000)); const d = $('pmd'); if (d) d.textContent = String(Math.floor(left / 60)).padStart(2, '0') + ':' + String(left % 60).padStart(2, '0'); if (left <= 0) { const label = pomo.label; pomo = null; beep(); A.toast(label === 'work' ? 'Focus block done - take a break!' : 'Break over - ready for another round?', 6000); } else setTimeout(tick, 500); };
    const beep = async () => { try { await ensureAudio(); const o = ac.createOscillator(), g = ac.createGain(); o.frequency.value = 880; g.gain.value = 0.2; o.connect(g); g.connect(ac.destination); o.start(); setTimeout(() => o.stop(), 400); } catch (e) {} };
    const startP = (min, label) => { pomo = { end: Date.now() + min * 60000, label }; tick(); };
    $('pms').onclick = () => startP(25, 'work'); $('pmb').onclick = () => startP(5, 'break'); $('pmr').onclick = () => { pomo = null; $('pmd').textContent = '25:00'; };
  };
})();

// Self-test: opens every tab and sub-page, listens for errors and missing files, and checks the local services and data files. Settings > Run a self-test.
(() => {
  const esc2 = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const FILES = ['/web/data/sky.json', '/web/data/recipes.json', '/web/data/bible-web.json', '/web/data/bible-dr.json', '/web/music/catalog.json'];
  const APIS = ['/api/storage', '/api/chats', '/api/cards', '/api/reminders', '/api/verse/status', '/api/notes'];
  let running = false;
  async function run() {
    if (running) return; running = true; const t0 = Date.now(), errs = []; let cur = '';
    /* a picture or a sound that does not arrive is not a broken page: news photographs are fetched only while internet
       access is on, and the library art is allowed to be missing. The problem log already ignores these; the test had
       been counting them, which made a healthy tab look broken. */
    const onErr = e => { const t = e.target; if (t && t !== window && /^(IMG|SOURCE|TRACK|VIDEO|AUDIO|LINK)$/.test(t.tagName || '')) return; const m = e.message ? e.message + (e.filename ? ' (' + String(e.filename).split('/').pop() + ':' + e.lineno + ')' : '') : t && (t.src || t.href) ? 'could not load ' + String(t.src || t.href).split('/').slice(-2).join('/') : 'error'; errs.push([cur, m]); };
    const onRej = e => errs.push([cur, 'promise rejected: ' + String((e.reason && e.reason.message) || e.reason).slice(0, 160)]);
    window.addEventListener('error', onErr, true); window.addEventListener('unhandledrejection', onRej);
    const back = A.cur, rows = [], add = (name, ok, note) => { rows.push({ name, ok, note: note || '' }); paint(); };
    A.dlg('<div style="min-width:min(560px,90vw)"><div class="row"><b style="font-size:17px;flex:1">🩺 Self-test</b><button class="ib" id="stx">✕</button></div><div id="stsum" class="small mute" style="margin:4px 0 8px">Testing...</div><div id="stout" style="max-height:60vh;overflow:auto"></div></div>', true); document.getElementById('stx').onclick = A.closeDlg;
    const paint = () => { const o = document.getElementById('stout'); if (!o) return; const bad = rows.filter(r => !r.ok).length; const s = document.getElementById('stsum'); if (s && running) s.innerHTML = rows.length + ' checks · <b style="color:' + (bad ? 'var(--bad)' : 'var(--ok)') + '">' + (bad ? bad + ' need attention' : 'all good so far') + '</b>'; o.innerHTML = rows.slice().sort((a, b) => (a.ok ? 1 : 0) - (b.ok ? 1 : 0)).map(r => '<div style="display:flex;gap:8px;padding:3px 0;border-bottom:1px dashed var(--line);font-size:13px"><span>' + (r.ok ? '✅' : '❌') + '</span><span style="flex:1">' + esc2(r.name) + (r.note ? ' <span class="mute">' + esc2(r.note) + '</span>' : '') + '</span></div>').join(''); };
    /* files and services */
    for (const f of FILES) { cur = f; try { const r = await fetch(f, { headers: { Range: 'bytes=0-0' } }); add('File ' + f.replace('/web/', ''), r.ok, r.ok ? '' : 'HTTP ' + r.status); } catch (e) { add('File ' + f, false, 'not reachable'); } }
    for (const u of APIS) { cur = u; try { const r = await fetch(u); add('Service ' + u, r.ok, r.ok ? '' : 'HTTP ' + r.status); } catch (e) { add('Service ' + u, false, 'not reachable (does Moundshroud need a restart?)'); } }
    try { const s = await (await fetch('/api/verse/status')).json(); add('Daily verse notification', typeof s.scheduled === 'number', s.on ? s.scheduled + ' days scheduled' : 'switched off'); } catch (e) { add('Daily verse notification', false, 'needs a restart of Moundshroud'); }
    try { const n = window.OTD ? window.OTD.count() : 0, e = window.OTD && window.OTD.on(new Date(2028, 1, 29)), t = window.HOLIDAYS && window.HOLIDAYS.on(new Date(2026, 10, 26)).some(h => /Thanksgiving/.test(h.n)); add('Holidays and this day in history', n === 366 && !!e && !!t, n + ' dates' + (t ? '' : ', Thanksgiving missing')); } catch (e) { add('Holidays and this day in history', false, String(e.message || e)); }
    try { const ok = window.Rome && window.Rome.SCEN.length === 9 && window.Rome.SCEN.every(s => window.Rome.make(s.id, { play: 0, seed: 1 }).units.length > 10); add('Imperium: the battle engine', !!ok, ok ? '9 historical battles load' : 'a battle failed to load'); } catch (e) { add('Imperium: the battle engine', false, String(e.message || e)); }
    try {
      const files = ['index.html', 'data.js', 'sprite.js', 'city.js', 'tiles.js', 'world.js', 'rooms.js', 'story.js', 'caesar.js', 'senate.js', 'shop.js', 'decor.js', 'audio.js', 'battle.js', 'field.js', 'trials.js', 'wider.js', 'citizens.js', 'companions.js', 'game.js', 'imperium.css'];
      const got = await Promise.all(files.map(f => fetch('/web/games/imperium/' + f, { headers: { Range: 'bytes=0-0' } }).then(r => r.ok).catch(() => false)));
      const g = A.play && A.play.games.rome, ok = got.every(Boolean) && !!g && /Imperium/.test(g.name) && /\/web\/games\/imperium\/index\.html/.test(String(g.mount));
      add('Imperium, the Rome RPG', !!ok, ok ? files.length + ' files, opened from Entertainment' : 'the Rome game page or its files are missing');
    } catch (e) { add('Imperium, the Rome RPG', false, String(e.message || e)); }
    try { const g = A.play.games, R = window.ClassicRules, ok = g.backgammon && g.hearts && R && R.BG.finals(R.BG.start(), 0, [3, 1]).length > 5 && R.HR.deal().every(h => h.length === 13) && window.PixelRand && window.PixelRand.make('monster', 16, 16, 1, ['#000000', '#ff0000', '#00ff00']).some(Boolean); add('Backgammon, Hearts and random pixel art', !!ok, ok ? 'rules and generators load' : 'something failed to load'); } catch (e) { add('Backgammon, Hearts and random pixel art', false, String(e.message || e)); }
    try { const cc = (window.CHESS_COURSES || []).find(c => c.id === 'capa'), n = cc ? cc.lessons.reduce((a, l) => a + l.steps.length, 0) : 0, g = (window.CHESS_GAMES || []).filter(x => /^capa-/.test(x.id)).length, wc = (window.CHESS_COURSES || []).find(c => c.id === 'wchist'), wg = (window.CHESS_GAMES || []).filter(x => /^wc-/.test(x.id)).length; const ok = wc && wc.lessons.length >= 19 && wg >= 39 && cc &&cc.lessons.length >= 50 && n >= 250 && g >= 19 && (window.CHESS_TIPS || []).length >= 100 && window.ChessUI && ChessUI.openGame; add('Capablanca course, games and chess tips', !!ok, ok ? cc.lessons.length + ' lessons, ' + n + ' steps, ' + g + ' games, ' + window.CHESS_TIPS.length + ' tips' : 'something failed to load'); } catch (e) { add('Capablanca course, games and chess tips', false, String(e.message || e)); }
    try { const s = await (await fetch('/api/music/status')).json(), ok = typeof s.model === 'boolean' && !!A.studio; add('AI music model and Qwen fallback', !!ok, ok ? (s.model ? 'AI music model installed' : 'AI music model not installed (Qwen writes the songs)') : 'music status or studio not available'); } catch (e) { add('AI music model and Qwen fallback', false, String(e.message || e)); }
    try {
      const T = window.ChessTrainer, C = window.Chess, UI = window.ChessUI, a = T && T.analyse ? T.analyse() : null;
      let pz = null; try { pz = T && C ? T.puzzleOf({ fen: C.START, best: 'e2e4', motif: 'capture', dw: 30, gid: 1, ply: 0, opp: 'Test' }) : null; } catch (e) { pz = null; }
      const nm = UI && UI.PZ && typeof UI.PZ.mineCount === 'function' ? UI.PZ.mineCount() : null;
      const ok = !!T && !!window.ChessSpecial && !!ChessSpecial.trainer && ['nudge', 'bonus', 'build', 'analyseGames', 'openPuzzles', 'read', 'focus'].every(k => typeof T[k] === 'function') && !!a && typeof a.games === 'number' && Array.isArray(a.slips) && /Trainer here/.test(T.brief()) && !!pz && pz.f === C.START && pz.s[0] === 'e2e4' && (pz.g || []).includes('My game') && nm !== null;
      add('Chess Trainer bot (reads your games, builds puzzles)', ok, ok ? 'ready · ' + a.games + ' games read, ' + a.slips.length + ' mistakes found, ' + nm + ' of your own puzzles saved' : 'the Trainer did not load, or it cannot turn a game into a puzzle');
    } catch (e) { add('Chess Trainer bot (reads your games, builds puzzles)', false, String(e.message || e)); }
    try { const s = window.AIArt ? await AIArt.status(true) : null, sp = window.ChessSpecial || {}, ok = !!s && typeof s.sd === 'boolean' && !!A.studio && sp.draw && sp.tide; add('Offline art engine, Equinox and Tide bots', !!ok, ok ? (s.sd ? 'image model installed' : 'image model not installed (Qwen drawing only)') : 'something failed to load'); } catch (e) { add('Offline art engine, Equinox and Tide bots', false, String(e.message || e)); }
    try { const bots = window.ChessBots ? ChessBots.R : [], top = bots[bots.length - 1], ok = window.ChessClock && A.bm && A.bm.list && bots.length >= 29 && top && top.e === 3200; add('Chess bots to 3200, clocks, bookmarks', !!ok, ok ? bots.length + ' bots, top is ' + top.n : 'something failed to load'); } catch (e) { add('Chess bots to 3200, clocks, bookmarks', false, String(e.message || e)); }
    try { const used = JSON.stringify(localStorage).length; add('Saved settings size', used < 4.5e6, Math.round(used / 1024) + ' KB of about 5,000 KB'); } catch (e) { add('Saved settings', false, 'cannot read'); }
    /* every tab */
    for (const n of A.order.slice()) {
      if (!A.tabs[n] || A.tabs[n].hidden) continue; cur = A.tabs[n].label; const before = errs.length;
      try {
        A.showTab(n); const p = document.getElementById('p-' + n);
        /* wait for the page to draw rather than guessing a pause: on a busy PC (another tab playing a game, a video, a
           model loading) a lazy page can take a few seconds, and a fixed 0.7 s made those tabs look empty when they were fine. */
        const step = n === 'sky' || n === 'kitchen' || n === 'timeline' || n === 'play' ? 150 : 80;
        for (let t = 0; t < 40; t++) { if (p && p.innerText.trim().length > 10) break; await wait(t < 8 ? step : 120); }
        const len = p ? p.innerText.trim().length : 0;
        /* and the page in front must be the one that gets the clicks (a hidden page on top once froze every page) */
        await wait(60); const hit = A.guard ? A.guard.check() : { ok: true };
        add('Tab: ' + A.tabs[n].label, !!p && len > 10 && errs.length === before && hit.ok, errs.length > before ? errs[errs.length - 1][1] : len <= 10 ? 'the page is empty' : !hit.ok ? (hit.fixed ? 'a hidden page was covering it (moved aside)' : 'something is covering it: ' + hit.what) : '');
      }
      catch (e) { add('Tab: ' + A.tabs[n].label, false, String(e.message || e)); }
    }
    /* sub-pages we can reach */
    const subs = [];
    if (A.sky && A.sky.subs) A.sky.subs.forEach(s => subs.push(['Sky > ' + s.label, () => { A.showTab('sky'); A.sky.show(s.id); }, 'p-sky']));
    if (A.tools && A.tools.subs) A.tools.subs.forEach(s => subs.push(['Tools > ' + String(s[1]).replace(/^[^\p{L}\p{N}]+/u, ''), () => A.tools.go(s[0]), 'p-tools']));
    for (const [name, fn, panel] of subs) {
      cur = name; const before = errs.length;
      try {
        fn(); const p = document.getElementById(panel);
        for (let t = 0; t < 30; t++) { if (p && p.innerText.trim().length > 10) break; await wait(t < 6 ? 150 : 200); }
        add(name, errs.length === before && !!p && p.innerText.trim().length > 10, errs.length > before ? errs[errs.length - 1][1] : '');
      } catch (e) { add(name, false, String(e.message || e)); }
    }
    /* anything that fired while idle */
    await wait(600); const stray = errs.filter(e => !rows.some(r => !r.ok && r.note && e[1] && r.note.indexOf(String(e[1]).slice(0, 30)) >= 0));
    if (stray.length) add('Other errors seen during the test', false, stray.slice(0, 4).map(e => e[0] + ': ' + e[1]).join(' | '));
    window.removeEventListener('error', onErr, true); window.removeEventListener('unhandledrejection', onRej); A.showTab(back); running = false; paint();
    const bad = rows.filter(r => !r.ok).length, sm = document.getElementById('stsum'); if (sm) { sm.innerHTML = rows.length + ' checks in ' + Math.round((Date.now() - t0) / 1000) + ' s · <b style="color:' + (bad ? 'var(--bad)' : 'var(--ok)') + '">' + (bad ? bad + ' need attention' : 'everything passed') + '</b>' + (bad ? '' : ' 🎉') + ' <button class="ib" id="stcp" style="margin-left:8px">Copy report</button>'; const cp = document.getElementById('stcp'); if (cp) cp.onclick = () => A.copy(rows.map(r => (r.ok ? 'OK   ' : 'FAIL ') + r.name + (r.note ? ' - ' + r.note : '')).join('\n')); }
    ls.set('selftest', JSON.stringify({ at: Date.now(), checks: rows.length, bad })); return { rows, bad };
  }
  A.selftest = { run, last: () => { try { return JSON.parse(ls.get('selftest', 'null')); } catch (e) { return null; } } };
})();

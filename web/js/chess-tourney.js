// Chess > Tournament: a simulated tournament in three formats (Swiss, round robin, knockout). You play your own games on the online-simulator board
// (clocks, chat, negotiation, captured pieces); every other game in the round is decided by the players' ratings. Nothing goes online.
// Saved in localStorage 'chtour': { cur: the tournament in progress, hist: finished tournaments }.
(() => {
  const UI = window.ChessUI; if (!UI || !UI.olx) return;
  const X = UI.olx, pick = a => a[Math.random() * a.length | 0], clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const esc2 = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const rd = (k, d) => { try { return JSON.parse(ls.get(k, JSON.stringify(d))); } catch (e) { return d; } };
  const load = () => { const o = rd('chtour', {}); o.hist = o.hist || []; return o; }, save = o => { try { ls.set('chtour', JSON.stringify(o)); } catch (e) { } };
  const FORMATS = [
    { id: 'swiss', n: 'Swiss', d: 'Everyone plays every round; each round you are paired with someone on a similar score. Nobody is knocked out.', sizes: [[8, 4], [12, 5], [16, 5], [20, 6]] },
    { id: 'rr', n: 'Round robin', d: 'Everybody plays everybody once. The fairest format, and the longest.', sizes: [[6, 5], [8, 7]] },
    { id: 'ko', n: 'Knockout', d: 'Lose and you are out. A drawn game goes to an Armageddon tie-break (Black wins a draw).', sizes: [[8, 3], [16, 4]] },
  ];
  const TIERS = [['club', 'Club night', -220], ['regional', 'Regional', 0], ['open', 'Open', 160], ['elite', 'Elite', 380]];
  const TCL = [['180+2', 'Blitz 3 | 2'], ['300+0', 'Blitz 5 min'], ['300+5', 'Blitz 5 | 5 (unrated only)', 1], ['600+0', 'Rapid 10 min'], ['900+10', 'Rapid 15 | 10'], ['1800+0', 'Classical 30 min'], ['1800+20', 'Classical 30 | 20'], ['3600+0', 'Classical 60 min']];
  const NAMES = ['Riverside Open', 'Harbor Cup', 'Golden Knight Invitational', 'Autumn Classic', 'Citadel Championship', 'Lighthouse Blitz', 'Maple Open', 'Ironclad Cup', 'Midnight Masters', 'Lakeside Classic', 'Crown & Castle Cup', 'Northern Lights Open'];
  const ROUNDN = (n, total) => total && n === total ? 'Final' : total && n === total - 1 && total > 1 ? 'Semi-final' : total && n === total - 2 && total > 2 ? 'Quarter-final' : 'Round ' + n;
  const E = (a, b) => 1 / (1 + Math.pow(10, (b - a) / 400));
  const simRes = (w, b) => {       // result of a game decided by ratings (White gets a small edge)
    const d = w.rating + 35 - b.rating, e = E(w.rating + 35, b.rating); let pd = clamp(.36 * Math.exp(-Math.pow(d / 520, 2)) * ((w.rating + b.rating) / 2 > 1800 ? 1.15 : 1), .05, .45); pd = Math.min(pd, 2 * e - .02, 2 * (1 - e) - .02); pd = Math.max(pd, 0);
    const pw = e - pd / 2, r = Math.random(); return r < pw ? '1-0' : r < pw + pd ? '1/2-1/2' : '0-1';
  };
  const pts = res => res === '1-0' ? [1, 0] : res === '0-1' ? [0, 1] : [.5, .5];
  const dp = p => { p = clamp(p, .01, .99); return Math.round(400 * Math.log10(p / (1 - p))); };
  const koOrder = n => n === 2 ? [1, 2] : koOrder(n / 2).flatMap(x => [x, n + 1 - x]);

  /* ---------- the tournament model ---------- */
  const create = o => {
    const fm = FORMATS.find(f => f.id === o.fmt), cat = X.catOf(o.tc), me = { id: 0, name: ls.get('chprofname', 'You'), flag: '⭐', country: '', rating: X.rating(cat).r, you: true };
    const tier = TIERS.find(t => t[0] === o.tier) || TIERS[1], center = me.rating + tier[2], players = [me], used = new Set([me.name.toLowerCase()]);
    while (players.length < o.size) { const p = X.genOpp(center, cat); if (used.has(p.name.toLowerCase())) continue; used.add(p.name.toLowerCase()); p.rating = clamp(Math.round(center + (Math.random() + Math.random() + Math.random() - 1.5) * 340), 500, 2600); p.id = players.length; players.push(p); }
    const total = o.fmt === 'swiss' ? o.rounds : o.fmt === 'rr' ? o.size - 1 : Math.log2(o.size);
    const T = { id: Date.now(), name: pick(NAMES) + ' ' + (new Date().getFullYear()), fmt: o.fmt, tier: o.tier, tc: o.tc, rated: !!o.rated, size: o.size, total, players, rounds: [], done: false, inGame: null, created: Date.now(), fmN: fm.n };
    makeRound(T); return T;
  };
  const played = (T) => { const s = new Set(); T.rounds.forEach(r => r.pairs.forEach(p => { if (p.b >= 0) s.add(Math.min(p.w, p.b) + '-' + Math.max(p.w, p.b)); })); return s; };
  const scoreOf = (T, id, upto) => { let s = 0; T.rounds.forEach((r, i) => { if (upto !== undefined && i > upto) return; r.pairs.forEach(p => { if (p.res === null || p.res === undefined) return; if (p.w === id) s += pts(p.res)[0]; else if (p.b === id) s += pts(p.res)[1]; }); }); return s; };
  const swissPairs = T => {
    const ids = T.players.map(p => p.id).sort((a, b) => scoreOf(T, b) - scoreOf(T, a) || T.players[b].rating - T.players[a].rating), seen = played(T), key = (a, b) => Math.min(a, b) + '-' + Math.max(a, b), pairs = []; let list = ids.slice();
    if (list.length % 2) { const had = new Set(); T.rounds.forEach(r => r.pairs.forEach(p => { if (p.b < 0) had.add(p.w); })); let bi = -1; for (let i = list.length - 1; i >= 0; i--) if (!had.has(list[i])) { bi = i; break; } if (bi < 0) bi = list.length - 1; pairs.push({ w: list[bi], b: -1, res: '1-0', bye: true }); list.splice(bi, 1); }
    const up = (l, strict) => { if (!l.length) return []; const a = l[0]; for (let i = 1; i < l.length; i++) { const b = l[i]; if (strict && seen.has(key(a, b))) continue; const r = up(l.slice(1, i).concat(l.slice(i + 1)), strict); if (r) return [[a, b]].concat(r); } return null; };
    const m = up(list, true) || up(list, false) || [];
    const bal = id => { let n = 0; T.rounds.forEach(r => r.pairs.forEach(p => { if (p.b < 0) return; if (p.w === id) n++; else if (p.b === id) n--; })); return n; };
    m.forEach(([a, b]) => { const ba = bal(a), bb = bal(b), whiteA = ba < bb ? true : ba > bb ? false : Math.random() < .5; pairs.push(whiteA ? { w: a, b, res: null } : { w: b, b: a, res: null }); });
    return pairs;
  };
  const rrPairs = (T, r) => {
    const n = T.players.length, ids = T.players.map(p => p.id); if (n % 2) ids.push(-1); const m = ids.length, rot = ids.slice(1), pairs = [];
    const k = r % (m - 1), arr = [ids[0]].concat(rot.slice(rot.length - k).concat(rot.slice(0, rot.length - k)));
    for (let i = 0; i < m / 2; i++) { let a = arr[i], b = arr[m - 1 - i]; if (a < 0 || b < 0) { pairs.push({ w: a < 0 ? b : a, b: -1, res: '1-0', bye: true }); continue; } if ((i + r) % 2) { const t = a; a = b; b = t; } pairs.push({ w: a, b, res: null }); }
    return pairs;
  };
  const advOf = p => p.bye ? p.w : p.res === '1-0' ? p.w : p.res === '0-1' ? p.b : p.tb && p.tb.res ? (p.tb.res === '1-0' ? p.tb.w : p.tb.res === '0-1' ? p.tb.b : p.tb.b) : null;   // a drawn tie-break goes to Black
  const koPairs = (T, r) => {
    if (r === 0) { const seeds = T.players.slice().sort((a, b) => b.rating - a.rating), ord = koOrder(T.size), list = ord.map(s => seeds[s - 1].id), pairs = []; for (let i = 0; i < list.length; i += 2) pairs.push({ w: list[i], b: list[i + 1], res: null }); pairs.forEach(p => { if (Math.random() < .5) { const t = p.w; p.w = p.b; p.b = t; } }); return pairs; }
    const prev = T.rounds[r - 1].pairs.map(advOf), pairs = []; for (let i = 0; i < prev.length; i += 2) { const a = prev[i], b = prev[i + 1], wh = Math.random() < .5; pairs.push(wh ? { w: a, b, res: null } : { w: b, b: a, res: null }); } return pairs;
  };
  const mineOf = (rnd) => rnd.pairs.find(p => (p.w === 0 || p.b === 0) && p.b >= 0);
  const needsMe = (rnd) => { const p = mineOf(rnd); if (!p) return null; if (p.res === null) return { p, tb: false }; if (p.res === '1/2-1/2' && p.tb && p.tb.res === null && (p.tb.w === 0 || p.tb.b === 0)) return { p, tb: true }; return null; };
  function makeRound(T) {
    const r = T.rounds.length, pairs = T.fmt === 'swiss' ? swissPairs(T) : T.fmt === 'rr' ? rrPairs(T, r) : koPairs(T, r), rnd = { pairs, shown: false };
    pairs.forEach(p => { if (p.bye || p.w === 0 || p.b === 0) return; p.res = simRes(T.players[p.w], T.players[p.b]); if (T.fmt === 'ko' && p.res === '1/2-1/2') { const wh = Math.random() < .5, a = wh ? p.w : p.b, b = wh ? p.b : p.w; p.tb = { w: a, b, res: simRes(T.players[a], T.players[b]) }; } });
    T.rounds.push(rnd); rnd.shown = !needsMe(rnd); return rnd;
  }
  const roundDone = rnd => rnd.pairs.every(p => p.bye || (p.res !== null && !(p.res === '1/2-1/2' && p.tb && p.tb.res === null)));
  const standings = T => {
    const upto = T.rounds.length - 1, rows = T.players.map(p => ({ p, pts: 0, w: 0, d: 0, l: 0, opp: [], beat: [], drew: [], reach: 0, out: false }));
    T.rounds.forEach((rnd, ri) => { if (!rnd.shown && !T.done) return; rnd.pairs.forEach(g => { const a = rows[g.w]; if (g.bye) { a.pts += 1; a.w++; return; } const b = rows[g.b]; if (g.res === null) return; const [x, y] = pts(g.res); a.pts += x; b.pts += y; a.opp.push(g.b); b.opp.push(g.w); if (x === 1) { a.w++; b.l++; a.beat.push(g.b); } else if (y === 1) { b.w++; a.l++; b.beat.push(g.w); } else { a.d++; b.d++; a.drew.push(g.b); b.drew.push(g.w); } if (T.fmt === 'ko') { const adv = advOf(g); if (adv !== null) { rows[adv].reach = ri + 1; } } }); });
    const sc = id => rows[id].pts;
    rows.forEach(r => { r.bh = r.opp.reduce((s, id) => s + sc(id), 0); r.sb = r.beat.reduce((s, id) => s + sc(id), 0) + r.drew.reduce((s, id) => s + sc(id) / 2, 0); });
    if (T.fmt === 'ko') rows.sort((a, b) => b.reach - a.reach || b.pts - a.pts || b.p.rating - a.p.rating); else rows.sort((a, b) => b.pts - a.pts || (T.fmt === 'rr' ? b.sb - a.sb : b.bh - a.bh) || b.w - a.w || b.p.rating - a.p.rating);
    rows.forEach((r, i) => { r.pos = i + 1; }); return rows;
  };
  const myGames = T => { const L = []; T.rounds.forEach((rnd, i) => rnd.pairs.forEach(p => { if (p.bye) { if (p.w === 0) L.push({ r: i + 1, bye: true, s: 1 }); return; } [[p, false], [p.tb, true]].forEach(([g, tb]) => { if (!g || g.res === null || g.res === undefined) return; if (g.w !== 0 && g.b !== 0) return; const white = g.w === 0, o = T.players[white ? g.b : g.w], s = pts(g.res)[white ? 0 : 1]; L.push({ r: i + 1, tb, opp: o, white, s, res: g.res, gid: g.gid, plies: g.plies }); }); })); return L; };
  const tpr = T => { const g = myGames(T).filter(x => !x.bye); if (g.length < 3) return null; const avg = g.reduce((s, x) => s + x.opp.rating, 0) / g.length, p = g.reduce((s, x) => s + x.s, 0) / g.length; return Math.round(avg + dp(p)); };

  /* ---------- the screen ---------- */
  UI.sections.tourney = (host, api, ctx) => {
    let dead = false, child = null, tab = null, S = load(), T = S.cur || null, note = '';
    const persist = () => { S = load(); S.cur = T; save(S); };
    const stopChild = () => { if (child) { try { child(); } catch (e) { } child = null; } };
    const flag = p => p.flag || '';
    const nameCell = p => '<span' + (p.you ? ' style="font-weight:700;color:var(--acc)"' : '') + '>' + flag(p) + ' ' + esc2(p.name) + '</span>';
    const fmtRes = (g, T0) => g.res === null ? '…' : g.bye ? 'bye' : g.res === '1/2-1/2' ? '½-½' : g.res;

    /* ---- the lobby ---- */
    const lobby = () => {
      stopChild(); const st = load(), cur = st.cur, hist = (st.hist || []).slice().reverse(), gold = hist.filter(h => h.place === 1).length, pod = hist.filter(h => h.place <= 3).length;
      let o = Object.assign({ fmt: 'swiss', size: 8, rounds: 4, tier: 'regional', tc: '300+0', rated: true }, rd('chtouropt', {}));
      host.innerHTML = '<div style="max-width:980px">' +
        (cur ? '<div class="card" style="margin:0 0 10px;border-color:var(--acc)"><div class="row" style="gap:10px;align-items:center;flex-wrap:wrap"><div><b>' + esc2(cur.name) + '</b> <span class="small mute">' + cur.fmN + ' · ' + cur.size + ' players · ' + X.tcLabel(cur.tc) + ' · ' + (cur.rounds.length) + '/' + cur.total + ' rounds</span><div class="small mute">A tournament is in progress.</div></div><span class="sp"></span><button class="pri" id="tcont">Continue</button><button class="ib dang" id="tdrop">Abandon</button></div></div>' : '') +
        '<div class="card" style="margin:0 0 10px"><b>🏟 New tournament</b> <span class="small mute">(simulated: the other players are generated on this PC; nothing goes online)</span>' +
        '<div class="row" style="gap:10px;flex-wrap:wrap;margin-top:8px">' + FORMATS.map(f => '<div class="card tfm" data-f="' + f.id + '" style="margin:0;flex:1;min-width:210px;cursor:pointer;' + (o.fmt === f.id ? 'border-color:var(--acc);' : '') + '"><b>' + f.n + '</b><div class="small mute">' + f.d + '</div></div>').join('') + '</div>' +
        '<div class="row" style="gap:14px;flex-wrap:wrap;margin-top:10px;align-items:center"><label class="small mute">Size <select id="tsz"></select></label><label class="small mute">Field <select id="ttr">' + TIERS.map(t => '<option value="' + t[0] + '"' + (o.tier === t[0] ? ' selected' : '') + '>' + t[1] + '</option>').join('') + '</select></label><label class="small mute">Time <select id="ttc">' + TCL.filter(t => !(t[2] && o.rated)).map(t => '<option value="' + t[0] + '"' + (o.tc === t[0] ? ' selected' : '') + '>' + t[1] + '</option>').join('') + '</select></label><label class="chk" title="Rated games count toward your online rating and have no live coach. Unrated tournaments are practice: the live coach sidebar is on and 5 | 5 is available."><input type="checkbox" id="trt"' + (o.rated ? ' checked' : '') + '> ⭐ Rated <span class="small mute">(counts toward rating, no coach). Untick for unrated practice with the live coach.</span></label></div>' +
        '<div class="row" style="gap:10px;margin-top:10px;align-items:center"><button class="pri" id="tgo">Start tournament</button><span class="small mute" id="tinfo"></span></div></div>' +
        '<div class="card" style="margin:0"><div class="row" style="gap:12px;align-items:center"><b>Your tournaments</b><span class="small mute">' + hist.length + ' played · 🥇 ' + gold + ' wins · 🏅 ' + pod + ' podiums</span></div>' + (hist.length ? '<table class="small" style="width:100%;margin-top:6px"><tr><th style="text-align:left">Tournament</th><th>Format</th><th>Place</th><th>Score</th><th>Perf.</th></tr>' + hist.slice(0, 15).map(h => '<tr><td>' + esc2(h.name) + '</td><td style="text-align:center">' + esc2(h.fmN) + ' ' + h.size + '</td><td style="text-align:center">' + (h.place === 1 ? '🥇' : h.place === 2 ? '🥈' : h.place === 3 ? '🥉' : '#' + h.place) + ' of ' + h.size + '</td><td style="text-align:center">' + esc2(h.score) + '</td><td style="text-align:center">' + (h.tpr || '-') + '</td></tr>').join('') + '</table>' : '<div class="small mute" style="margin-top:6px">No tournaments yet. Pick a format above and start one.</div>') + '</div></div>';
      const q = id => host.querySelector('#' + id);
      const sizes = () => { const fm = FORMATS.find(f => f.id === o.fmt); q('tsz').innerHTML = fm.sizes.map(([n, r]) => '<option value="' + n + '"' + (o.size === n ? ' selected' : '') + '>' + n + ' players' + (o.fmt === 'swiss' ? ', ' + r + ' rounds' : o.fmt === 'ko' ? ', ' + r + ' rounds' : ', ' + r + ' rounds') + '</option>').join(''); if (!fm.sizes.some(s => s[0] === o.size)) { o.size = fm.sizes[0][0]; q('tsz').value = o.size; } o.rounds = fm.sizes.find(s => s[0] === o.size)[1]; info(); };
      const info = () => { const fm = FORMATS.find(f => f.id === o.fmt), games = o.rounds, mins = Math.round(games * (+o.tc.split('+')[0] * 2 + (+o.tc.split('+')[1] || 0) * 60) / 60 * .75); q('tinfo').textContent = 'You play up to ' + games + ' games, about ' + mins + ' minutes if you play them all (you can skip any of them).'; };
      sizes();
      host.onclick = e => {
        const f = e.target.closest('[data-f]'); if (f) { o.fmt = f.dataset.f; ls.set('chtouropt', JSON.stringify(o)); host.querySelectorAll('.tfm').forEach(c => { c.style.borderColor = c.dataset.f === o.fmt ? 'var(--acc)' : ''; }); sizes(); return; }
        if (e.target.id === 'tcont') { T = cur; view(); } else if (e.target.id === 'tdrop') { if (confirm('Abandon this tournament? It will not be saved to your history.')) { const s = load(); s.cur = null; save(s); T = null; lobby(); } } else if (e.target.id === 'tgo') { if (cur && !confirm('Starting a new tournament abandons the one in progress. Continue?')) return; T = create({ fmt: o.fmt, size: o.size, rounds: o.rounds, tier: o.tier, tc: o.tc, rated: o.rated }); tab = null; persist(); ls.set('chtouropt', JSON.stringify(o)); view(); }
      };
      host.onchange = e => { if (e.target.id === 'tsz') { o.size = +e.target.value; o.rounds = FORMATS.find(f => f.id === o.fmt).sizes.find(s => s[0] === o.size)[1]; } if (e.target.id === 'ttr') o.tier = e.target.value; if (e.target.id === 'ttc') o.tc = e.target.value; if (e.target.id === 'trt') { o.rated = e.target.checked; if (o.rated && o.tc === '300+5') o.tc = '300+0'; ls.set('chtouropt', JSON.stringify(o)); return lobby(); } ls.set('chtouropt', JSON.stringify(o)); info(); };
    };

    /* ---- results ---- */
    const myPair = () => T.rounds.length ? needsMe(T.rounds[T.rounds.length - 1]) : null;
    const setResult = (p, tb, res, gid, plies) => { const g = tb ? p.tb : p; g.res = res; g.gid = gid || g.gid; g.plies = plies || 0; if (T.fmt === 'ko' && !tb && res === '1/2-1/2') { const wh = Math.random() < .5; p.tb = { w: wh ? 0 : (p.w === 0 ? p.b : p.w), b: wh ? (p.w === 0 ? p.b : p.w) : 0, res: null }; } const last = T.rounds[T.rounds.length - 1]; if (!needsMe(last)) last.shown = true; T.inGame = null; persist(); };
    const youRes = (g, r) => r === 'W' ? (g.w === 0 ? '1-0' : '0-1') : r === 'L' ? (g.w === 0 ? '0-1' : '1-0') : '1/2-1/2';
    const nextRound = () => {
      const last = T.rounds[T.rounds.length - 1]; if (!roundDone(last)) return; last.shown = true;
      if (T.rounds.length >= T.total) return finish(); makeRound(T); persist(); view();
    };
    function finish() {
      T.done = true; T.rounds.forEach(r => { r.shown = true; }); const rows = standings(T), me = rows.find(r => r.p.you), g = myGames(T).filter(x => !x.bye), score = T.fmt === 'ko' ? (me.reach >= T.total ? 'Champion' : (me.reach === T.total - 1 ? 'Final' : 'Out in ' + ROUNDN(me.reach + 1, T.total))) : me.pts + '/' + T.total;
      const place = T.fmt === 'ko' ? (me.reach >= T.total ? 1 : me.reach === T.total - 1 ? 2 : me.reach === T.total - 2 ? 3 : Math.pow(2, T.total - me.reach - 1) + 1) : me.pos, t = tpr(T);
      const s = load(); s.hist.push({ id: T.id, name: T.name, fmN: T.fmN, fmt: T.fmt, size: T.size, place, score, tpr: t, tc: T.tc, tier: T.tier, t: Date.now() }); s.hist = s.hist.slice(-40); s.cur = null; save(s); T.summary = { place, score, tpr: t };
      try { ChessAch.event('tourney', { place, size: T.size, fmt: T.fmt, tier: T.tier, games: g.length, wins: g.filter(x => x.s === 1).length, losses: g.filter(x => x.s === 0).length, perfect: g.length >= 3 && g.every(x => x.s === 1), tpr: t || 0, pts: me.pts, rounds: T.total, rated: T.rated }); if (place <= 3) ChessFx.confetti(); } catch (e) { }
      view();
    }
    const simMine = () => { const m = myPair(); if (!m) return; const g = m.tb ? m.p.tb : m.p, wp = T.players[g.w], bp = T.players[g.b]; let res = simRes(wp, bp); if (m.tb && res === '1/2-1/2') res = '1/2-1/2'; setResult(m.p, m.tb, res); };
    const simAll = () => { let guard = 0; while (!T.done && guard++ < 200) { const m = myPair(); if (m) simMine(); const last = T.rounds[T.rounds.length - 1]; if (!roundDone(last)) { last.pairs.forEach(p => { if (!p.bye && p.res === null) p.res = simRes(T.players[p.w], T.players[p.b]); if (!p.bye && p.res === '1/2-1/2' && T.fmt === 'ko' && !p.tb) p.tb = { w: p.w, b: p.b, res: simRes(T.players[p.w], T.players[p.b]) }; if (p.tb && p.tb.res === null) p.tb.res = simRes(T.players[p.tb.w], T.players[p.tb.b]); }); } nextRound(); if (dead) return; } };

    /* ---- playing my game ---- */
    const play = () => {
      const m = myPair(); if (!m) return; const g = m.tb ? m.p.tb : m.p, white = g.w === 0, opp = Object.assign({}, T.players[white ? g.b : g.w]), rn = T.rounds.length;
      T.inGame = { round: rn, tb: m.tb }; persist(); stopChild();
      child = UI.sections.online(host, api, ctx, { opp, tc: T.tc, rated: T.rated, human: white ? 1 : -1, label: T.name + ' (' + ROUNDN(rn, T.fmt === 'ko' ? T.total : 0) + (m.tb ? ', tie-break' : '') + ')', cont: T.rounds[rn - 1] && rn >= T.total && !m.tb ? 'Finish' : 'Continue',
        onResult: r => { if (dead || !T) return; setResult(m.p, m.tb, youRes(g, r.res), r.gid, r.plies); },
        onContinue: () => { stopChild(); if (!dead) view(); } });
    };

    /* ---- the tournament view ---- */
    const view = () => {
      if (!T) return lobby(); stopChild(); host.onclick = tourClick; host.onchange = null; const rows = standings(T), me = rows.find(r => r.p.you), ko = T.fmt === 'ko', last = T.rounds[T.rounds.length - 1], m = T.done ? null : myPair(), rn = T.rounds.length;
      if (!tab) tab = ko ? 'bracket' : 'standings';
      const tabs = [[ko ? 'bracket' : 'standings', ko ? 'Bracket' : 'Standings'], ['rounds', 'Rounds'], ['mine', 'My games']].concat(T.fmt === 'rr' ? [['cross', 'Crosstable']] : []).concat(ko ? [['standings', 'Standings']] : []);
      let action = '';
      if (T.done) {
        const sm = T.summary || {}, place = sm.place, top = rows.slice(0, 3);
        action = '<div class="card" style="margin:0 0 10px;text-align:center;border-color:var(--acc)"><div style="font-size:34px">' + (place === 1 ? '🏆' : place <= 3 ? '🏅' : '🏁') + '</div><h3 style="margin:2px 0">' + (place === 1 ? 'You won the tournament!' : place === 2 ? 'Runner-up' : place === 3 ? 'Third place' : 'Finished #' + place + ' of ' + T.size) + '</h3><div class="small mute">' + esc2(T.name) + ' · ' + T.fmN + ' · score ' + esc2(sm.score || '') + (sm.tpr ? ' · performance rating ' + sm.tpr : '') + '</div>' +
          '<div class="row" style="gap:18px;justify-content:center;margin:10px 0;flex-wrap:wrap">' + top.map((r, i) => '<div><div style="font-size:26px">' + ['🥇', '🥈', '🥉'][i] + '</div><div>' + nameCell(r.p) + '</div><div class="small mute">' + r.p.rating + '</div></div>').join('') + '</div><button class="pri" id="tnew">New tournament</button></div>';
      } else if (m) {
        const g = m.tb ? m.p.tb : m.p, white = g.w === 0, o = T.players[white ? g.b : g.w];
        action = '<div class="card" style="margin:0 0 10px;border-color:var(--acc)"><div class="row" style="gap:12px;align-items:center;flex-wrap:wrap"><div style="font-size:30px">' + (m.tb ? '⚡' : '♟') + '</div><div><b>' + (m.tb ? 'Armageddon tie-break' : ROUNDN(rn, ko ? T.total : 0)) + '</b>: you play <b>' + (white ? 'White' : 'Black') + '</b> against ' + nameCell(o) + ' <span class="small mute">(' + o.rating + ', ' + esc2(o.country || '') + ')</span><div class="small mute">' + (m.tb ? 'The first game was drawn. In this game a draw counts as a win for Black.' : X.tcLabel(T.tc) + (T.rated ? ' · rated' : ' · casual')) + '</div></div><span class="sp"></span><button class="pri" id="tplay">▶ Play</button><button class="ib" id="tsim" title="Decide this game by the two ratings">Simulate it</button></div></div>';
      } else if (last && !roundDone(last)) action = '';
      else {
        const byeMe = last && last.pairs.some(p => p.bye && p.w === 0), out = ko && T.rounds.some(r => r.pairs.some(p => !p.bye && (p.w === 0 || p.b === 0) && advOf(p) !== null && advOf(p) !== 0));
        action = '<div class="card" style="margin:0 0 10px"><div class="row" style="gap:12px;align-items:center;flex-wrap:wrap"><div>' + (byeMe ? '<b>You have a bye this round</b> (1 point).' : out ? '<b>You are out of the tournament.</b> You can watch the rest.' : '<b>Round complete.</b>') + '<div class="small mute">' + (rn >= T.total ? 'That was the last round.' : 'Next: ' + ROUNDN(rn + 1, ko ? T.total : 0)) + '</div></div><span class="sp"></span><button class="pri" id="tnext">' + (rn >= T.total ? 'See final results' : 'Next round') + '</button></div></div>';
      }
      host.innerHTML = '<div style="max-width:1000px"><div class="row" style="gap:10px;align-items:center;margin-bottom:8px;flex-wrap:wrap"><button class="ib" id="tback">← Tournaments</button><div><b style="font-size:17px">' + esc2(T.name) + '</b><div class="small mute">' + T.fmN + ' · ' + T.size + ' players · ' + X.tcLabel(T.tc) + ' · ' + (T.tier ? TIERS.find(t => t[0] === T.tier)[1] : '') + ' · ' + (T.done ? 'finished' : ko ? ROUNDN(rn, T.total) : 'round ' + rn + ' of ' + T.total) + '</div></div><span class="sp"></span>' + (!T.done ? '<button class="ib" id="tall" title="Simulate everything left, including your games">⏩ Sim to the end</button>' : '') + '</div>' + (note ? '<div class="acmsg" style="margin-bottom:8px">' + note + '</div>' : '') + action +
        '<div class="row" style="gap:6px;margin-bottom:8px;flex-wrap:wrap">' + tabs.map(([k, n]) => '<button class="ib' + (tab === k ? ' on' : '') + '" data-tab="' + k + '">' + n + '</button>').join('') + '</div><div id="tbody"></div></div>';
      note = ''; body(rows, me);
    };
    const body = (rows, me) => {
      const b = host.querySelector('#tbody'), ko = T.fmt === 'ko'; let h = '';
      if (tab === 'standings') {
        h = '<div class="card" style="margin:0;overflow:auto"><table class="small" style="width:100%"><tr><th>#</th><th style="text-align:left">Player</th><th>Rating</th>' + (ko ? '<th>Reached</th>' : '<th>Pts</th><th>' + (T.fmt === 'rr' ? 'SB' : 'Buch.') + '</th><th>W-D-L</th>') + '</tr>' +
          rows.map(r => '<tr' + (r.p.you ? ' style="background:var(--panel2)"' : '') + '><td style="text-align:center">' + r.pos + '</td><td>' + nameCell(r.p) + '</td><td style="text-align:center">' + r.p.rating + '</td>' + (ko ? '<td style="text-align:center">' + (r.reach >= T.total ? '🏆 Champion' : r.reach === 0 ? 'Round ' + 1 : ROUNDN(r.reach + 1, T.total)) + '</td>' : '<td style="text-align:center"><b>' + r.pts + '</b></td><td style="text-align:center">' + (T.fmt === 'rr' ? r.sb : r.bh) + '</td><td style="text-align:center">' + r.w + '-' + r.d + '-' + r.l + '</td>') + '</tr>').join('') + '</table></div>';
      } else if (tab === 'bracket') {
        h = '<div class="row" style="gap:12px;align-items:flex-start;overflow:auto">' + Array.from({ length: T.total }, (_, i) => { const rnd = T.rounds[i]; return '<div style="min-width:210px"><div class="small mute" style="margin-bottom:4px"><b>' + ROUNDN(i + 1, T.total) + '</b></div>' + (rnd ? rnd.pairs.map(p => { const show = rnd.shown || (p.w !== 0 && p.b !== 0 && false), adv = rnd.shown ? advOf(p) : null, line = id => '<div style="' + (adv === id ? 'font-weight:700;' : adv !== null ? 'opacity:.55;' : '') + '">' + nameCell(T.players[id]) + ' <span class="small mute">' + T.players[id].rating + '</span></div>'; const unk = !rnd.shown && p.w !== 0 && p.b !== 0; return '<div class="card" style="margin:0 0 8px;padding:6px 9px">' + line(p.w) + line(p.b) + (rnd.shown && p.res !== null ? '<div class="small mute">' + fmtRes(p) + (p.tb && p.tb.res ? ' · tie-break ' + fmtRes(p.tb) : '') + '</div>' : unk ? '<div class="small mute">in progress</div>' : '') + '</div>'; }).join('') : '<div class="small mute">Not played yet</div>') + '</div>'; }).join('') + '</div>';
      } else if (tab === 'rounds') {
        h = T.rounds.map((rnd, i) => '<div class="card" style="margin:0 0 8px"><b>' + ROUNDN(i + 1, ko ? T.total : 0) + '</b><table class="small" style="width:100%;margin-top:4px">' + rnd.pairs.map(p => { const mine = p.w === 0 || p.b === 0, hide = !rnd.shown && !mine; return '<tr' + (mine ? ' style="background:var(--panel2)"' : '') + '><td style="width:42%">' + nameCell(T.players[p.w]) + ' <span class="mute">' + T.players[p.w].rating + '</span></td><td style="text-align:center;width:16%"><b>' + (p.bye ? 'bye' : hide ? '…' : fmtRes(p) + (p.tb && p.tb.res ? ' (' + fmtRes(p.tb) + ')' : '')) + '</b></td><td>' + (p.bye ? '' : nameCell(T.players[p.b]) + ' <span class="mute">' + T.players[p.b].rating + '</span>') + '</td></tr>'; }).join('') + '</table></div>').join('') || '<div class="small mute">No rounds yet.</div>';
      } else if (tab === 'cross') {
        const ord = rows.map(r => r.p.id), cell = (a, b) => { if (a === b) return '■'; let s = ''; T.rounds.forEach(rnd => { if (!rnd.shown && !T.done) return; rnd.pairs.forEach(p => { if (p.res === null) return; if (p.w === a && p.b === b) s = pts(p.res)[0] === 1 ? '1' : pts(p.res)[0] === .5 ? '½' : '0'; else if (p.w === b && p.b === a) s = pts(p.res)[1] === 1 ? '1' : pts(p.res)[1] === .5 ? '½' : '0'; }); }); return s || '·'; };
        h = '<div class="card" style="margin:0;overflow:auto"><table class="small"><tr><th></th>' + ord.map((_, i) => '<th>' + (i + 1) + '</th>').join('') + '<th>Pts</th></tr>' + rows.map((r, i) => '<tr' + (r.p.you ? ' style="background:var(--panel2)"' : '') + '><td style="white-space:nowrap">' + (i + 1) + '. ' + nameCell(r.p) + '</td>' + ord.map(id => '<td style="text-align:center;padding:2px 7px">' + cell(r.p.id, id) + '</td>').join('') + '<td style="text-align:center"><b>' + r.pts + '</b></td></tr>').join('') + '</table></div>';
      } else {
        const g = myGames(T), t = tpr(T);
        h = '<div class="card" style="margin:0">' + (g.length ? '<table class="small" style="width:100%"><tr><th>Rd</th><th style="text-align:left">Opponent</th><th>Colour</th><th>Result</th><th></th></tr>' + g.map(x => '<tr><td style="text-align:center">' + x.r + (x.tb ? ' ⚡' : '') + '</td><td>' + (x.bye ? 'Bye' : nameCell(x.opp) + ' <span class="mute">' + x.opp.rating + '</span>') + '</td><td style="text-align:center">' + (x.bye ? '' : x.white ? 'White' : 'Black') + '</td><td style="text-align:center;color:' + (x.s === 1 ? 'var(--ok)' : x.s === 0 ? 'var(--bad)' : 'var(--warn)') + '"><b>' + (x.s === 1 ? 'Won' : x.s === 0 ? 'Lost' : 'Drew') + '</b></td><td>' + (x.gid ? '<button class="ib" data-an="' + x.gid + '">Analyze</button>' : '') + '</td></tr>').join('') + '</table>' + (t ? '<div class="small mute" style="margin-top:6px">Performance rating so far: <b>' + t + '</b></div>' : '') : '<div class="small mute">You have not played a game yet.</div>') + '</div>';
      }
      b.innerHTML = h;
    };

    const tourClick = e => {
      const c = e.target;
      if (c.closest('#tback')) return lobby(); if (c.closest('#tplay')) return play(); if (c.closest('#tsim')) { simMine(); const last = T.rounds[T.rounds.length - 1]; return roundDone(last) && !myPair() ? view() : view(); }
      if (c.closest('#tnext')) return nextRound(); if (c.closest('#tnew')) { T = null; return lobby(); } if (c.closest('#tall')) { if (confirm('Simulate the whole rest of the tournament, including your games?')) { simAll(); if (!T) return lobby(); view(); } return; }
      const t = c.closest('[data-tab]'); if (t) { tab = t.dataset.tab; return view(); } const an = c.closest('[data-an]'); if (an) { UI.pending = { id: an.dataset.an }; UI.show('analysis'); }
    };

    /* ---- start ---- */
    if (T && T.inGame && !T.done) {   // the game was left unfinished (the tab was changed or Moundshroud closed): that counts as a forfeit
      const m = myPair(); if (m) { setResult(m.p, m.tb, (m.tb ? m.p.tb : m.p).w === 0 ? '0-1' : '1-0'); note = 'You left your last game unfinished, so it was scored as a loss.'; } else { T.inGame = null; persist(); }
    }
    UI.tourneyDebug = { state: () => T, create, simAll: () => { simAll(); }, standings: () => standings(T), tpr: () => tpr(T), play, simMine, nextRound };
    if (T && !T.done) view(); else lobby();
    return () => { dead = true; stopChild(); };
  };
  UI.tourney = { create, simRes, standings, myGames, tpr, makeRound, roundDone, needsMe, advOf, swissPairs, rrPairs, koOrder, FORMATS };

  /* ---------- trophies ---------- */
  try {
    const Ach = window.ChessAch; if (Ach && Ach.DEFS && !Ach.DEFS.some(d => d.id === 'tn1')) {
      const T2 = (id, name, icon, desc, xp, key, n) => ({ id, name, icon, desc, xp, key, n, cat: 'Tournaments' }), F2 = (id, name, icon, desc, xp, cond, secret) => ({ id, name, icon, desc, xp, cond, cat: 'Tournaments', secret });
      Ach.DEFS.push(T2('tn1', 'Tournament Player', '🏟', 'Finish a tournament.', 15, 'tourneys', 1), T2('tn5', 'Circuit Regular', '🎪', 'Finish 5 tournaments.', 40, 'tourneys', 5), T2('tn15', 'Tour Veteran', '🧳', 'Finish 15 tournaments.', 90, 'tourneys', 15),
        T2('tw1', 'Champion', '🏆', 'Win a tournament.', 60, 'tourneyWins', 1), T2('tw3', 'Serial Winner', '🥇', 'Win 3 tournaments.', 120, 'tourneyWins', 3), T2('tw10', 'Dynasty', '👑', 'Win 10 tournaments.', 300, 'tourneyWins', 10),
        T2('tp1', 'On the Podium', '🥉', 'Finish in the top three.', 30, 'tourneyPodiums', 1), T2('tp5', 'Podium Habit', '🏅', 'Finish in the top three 5 times.', 90, 'tourneyPodiums', 5),
        T2('tg25', 'Tournament Grinder', '⚙', 'Play 25 tournament games.', 40, 'tourneyGames', 25), T2('tg100', 'Marathon', '🏃', 'Play 100 tournament games.', 120, 'tourneyGames', 100),
        T2('tswiss', 'Swiss Master', '🇨🇭', 'Win a Swiss tournament.', 70, 'swissWins', 1), T2('trr', 'Round Robin Winner', '🔄', 'Win a round robin.', 90, 'rrWins', 1), T2('tko', 'Last One Standing', '⚔', 'Win a knockout tournament.', 90, 'koWins', 1),
        T2('telite', 'Giant Killer', '🗡', 'Win an Elite-field tournament.', 200, 'eliteWins', 1), T2('tbig', 'Big Field', '👥', 'Finish in the top three of a 16-player or larger tournament.', 80, 'bigPods', 1),
        F2('tperfect', 'Perfect Score', '💯', 'Win every game of a tournament (3 or more games).', 150, c => c.tourneyPerfect >= 1), F2('ttpr2000', 'Strong Showing', '📈', 'Reach a performance rating of 2000 in a tournament.', 100, c => c.tourneyTpr >= 2000), F2('ttpr2400', 'Master Class', '🎓', 'Reach a performance rating of 2400 in a tournament.', 250, c => c.tourneyTpr >= 2400, true));
      const base = Ach.event, sv = s => { try { ls.set('chach', JSON.stringify(s)); } catch (e) { } };
      Ach.event = function (name, d) {
        if (name === 'tourney') { try { d = d || {}; const s = Ach.data(), c = s.c, add1 = (k, n) => { c[k] = (c[k] || 0) + (n == null ? 1 : n); }; add1('tourneys'); add1('tourneyGames', d.games || 0); if (d.place === 1) { add1('tourneyWins'); if (d.fmt === 'swiss') add1('swissWins'); if (d.fmt === 'rr') add1('rrWins'); if (d.fmt === 'ko') add1('koWins'); if (d.tier === 'elite') add1('eliteWins'); } if (d.place <= 3) { add1('tourneyPodiums'); if (d.size >= 16) add1('bigPods'); } if (d.perfect) c.tourneyPerfect = 1; if ((d.tpr || 0) > (c.tourneyTpr || 0)) c.tourneyTpr = d.tpr; sv(s); } catch (e) { } }
        return base.call(Ach, name, d);
      };
    }
  } catch (e) { }
})();

// Chess hub > 📅 Daily: correspondence games like chess.com's Daily chess. Each player has 1 to 14 days per move and the clock resets after every move, so a game can last weeks.
// Games are saved on this PC and carry on while you are away: the simulated opponent answers after a while (minutes to a day or so, never more than the time limit) and
// when you come back it is your move. If YOUR time runs out you lose on time. Daily games have their own rating. Variants: standard, Chess960, Three-check, King of the Hill, Fog of War.
(() => {
  const C = window.Chess, UI = window.ChessUI; if (!C || !UI) return;
  const KEY = 'chdaily', DAY = 864e5, rnd = (a, b) => a + Math.random() * (b - a), pick = a => a[Math.random() * a.length | 0], clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const load = () => { try { const o = JSON.parse(ls.get(KEY, '{"games":[]}')); o.games = o.games || []; return o; } catch (e) { return { games: [] }; } };
  const save = o => { try { ls.set(KEY, JSON.stringify(o)); } catch (e) { } };
  const VL = () => (window.ChessVariants ? ChessVariants.list : [{ id: 'std', name: 'Standard chess', icon: '♟' }]);
  const mkPos = g => window.ChessVX && ChessVX.has(g.vid) ? ChessVX.make(g.vid, g.startFen) : new C.Pos().setFen(g.startFen || C.START);
  const posOf = g => { const p = mkPos(g); for (const u of g.moves) { const m = p.fromUci(u); if (m === undefined || m === null || m === false) break; p.make(m); } return p; };
  const left = ms => { ms = Math.max(0, ms); const d = Math.floor(ms / DAY), h = Math.floor(ms % DAY / 36e5), m = Math.floor(ms % 36e5 / 6e4); return d ? d + 'd ' + h + 'h' : h ? h + 'h ' + m + 'm' : m + 'm'; };
  let eng = null; const getEng = () => eng || (eng = UI.Eng());
  const verdict = (g, p) => {                       // is the game over? returns {res:'1-0'|'0-1'|'1/2-1/2', why} or null
    const V = window.ChessVariants ? ChessVariants.get(g.vid || 'std') : { id: 'std' };
    if (V.check && g.moves.length) { const mover = p.side > 0 ? -1 : 1; try { const r = V.check(p, { hist: g.moves.map(u => ({ u })), startFen: g.startFen }, mover); if (r && r.draw) return { res: '1/2-1/2', why: r.txt }; if (r && r.win) { const wn = r.winner || mover; return { res: wn > 0 ? '1-0' : '0-1', why: r.txt }; } } catch (e) { } }
    if (!p.legal().length) return p.inCheck() ? { res: p.side > 0 ? '0-1' : '1-0', why: 'checkmate' } : { res: '1/2-1/2', why: 'stalemate' };
    if (p.insufficient && p.insufficient()) return { res: '1/2-1/2', why: 'not enough pieces' }; if (p.half >= 100) return { res: '1/2-1/2', why: 'fifty-move rule' };
    return null;
  };
  function end(o, g, res, why) {                    // finish a game, update the Daily rating, save it for analysis
    if (g.status === 'done') return; g.status = 'done'; g.res = res; g.why = why; g.replyAt = 0; const mine = res === '1/2-1/2' ? .5 : ((res === '1-0') === (g.human > 0) ? 1 : 0);
    if (g.rated && UI.olx) { const r = UI.olx.rating('daily'); g.delta = UI.olx.eloDelta(r.r, g.opp.rating, mine, r.n); UI.olx.setRating('daily', { r: Math.max(100, r.r + g.delta), n: r.n + 1 }); }
    if (!ChessVX.has(g.vid)) try { const me = ls.get('chprofname', 'You'); const s = ChessAna.GS.add({ white: g.human > 0 ? me : g.opp.name, black: g.human > 0 ? g.opp.name : me, result: res, moves: g.moves.slice(), human: g.human, elo: g.opp.rating, src: 'daily', startFen: g.startFen !== C.START ? g.startFen : undefined, event: 'Daily ' + g.days + ' day' + (g.days > 1 ? 's' : '') + '/move', date: new Date(g.created).toISOString(), reason: why }); g.gid = s.id; } catch (e) { }
    try { ChessAch.event('daily', { res: mine === 1 ? 'W' : mine === .5 ? 'D' : 'L' }); } catch (e) { }
    save(o);
  }
  /* bring every game up to date: the opponent's reply if it is due, and a loss on time if you ran out of days */
  async function advance(o, g) {
    if (g.status !== 'active') return false; const p = posOf(g), now = Date.now(), myTurn = p.side === g.human; let changed = false;
    if (myTurn && now > g.deadline) { end(o, g, g.human > 0 ? '0-1' : '1-0', 'you ran out of time'); return true; }
    if (!myTurn && g.replyAt && now >= g.replyAt) {
      let mv = null; if (ChessVX.has(g.vid)) { try { mv = ChessVX.think(p, g.opp.rating, 700); } catch (e) { } } else try { const r = await getEng().ask({ fen: p.fen(), elo: g.opp.rating, ms: 700 }); mv = r && r.move; } catch (e) { }
      const l = p.legal(); const m = l.find(x => x === mv) || l[0];
      if (m !== undefined) { if (window.ChessVariants && g.vid !== 'std') { try { const pm = await ChessVariants.pick(ChessVariants.get(g.vid), p, getEng(), m, { hist: g.moves.map(u => ({ u })), startFen: g.startFen }); if (l.includes(pm)) { g.moves.push(p.uci(pm)); } else g.moves.push(p.uci(m)); } catch (e) { g.moves.push(p.uci(m)); } } else g.moves.push(p.uci(m)); g.deadline = Date.now() + g.days * DAY; g.replyAt = 0; g.lastMove = Date.now(); g.unseen = 1; changed = true; const p2 = posOf(g), v = verdict(g, p2); if (v) end(o, g, v.res, v.why); else save(o); }
    }
    return changed;
  }
  window.ChessDaily = { load, advance: async () => { const o = load(); let n = 0; for (const g of o.games) if (await advance(o, g)) n++; save(o); return n; }, due: () => load().games.filter(g => g.status === 'active' && posOf(g).side === g.human) };
  /* a gentle heads-up from the buddy when it is your move */
  const nudge = async () => { try { await ChessDaily.advance(); const d = ChessDaily.due(); const fresh = d.filter(g => g.unseen); if (fresh.length && A.companion) { A.companion.say('♟ Daily chess: ' + fresh[0].opp.name + ' moved. Your turn!', 6000); } } catch (e) { } };
  setTimeout(nudge, 6000); setInterval(nudge, 5 * 60e3);

  UI.sections.daily = (host, api, ctx) => {
    let dead = false, board = null, cur = null, timer = 0;
    const ratings = () => (UI.olx ? UI.olx.rating('daily') : { r: 1000, n: 0 });
    const list = async () => {
      if (board) { try { board.destroy(); } catch (e) { } board = null; } clearInterval(timer); const o = load(); for (const g of o.games) await advance(o, g); if (dead) return; const r = ratings(), act = o.games.filter(g => g.status === 'active'), done = o.games.filter(g => g.status === 'done').slice(0, 12);
      host.innerHTML = '<div style="max-width:920px"><div class="card" style="margin:0 0 10px"><div class="row" style="gap:12px;align-items:center;flex-wrap:wrap"><div style="font-size:24px;font-weight:700;color:var(--acc)">' + r.r + '</div><div class="small mute">Daily rating (' + r.n + ' games)</div><span class="sp"></span><span class="small mute">Each move gets 1 to 14 days. Your clock resets after you move. Games are saved and carry on while Moundshroud is closed.</span></div></div>' +
        '<div class="card" style="margin:0 0 10px"><b>Start a daily game</b><div class="row" style="gap:10px;flex-wrap:wrap;align-items:center;margin-top:8px"><label class="small mute">Days per move <select id="dd">' + [1, 2, 3, 5, 7, 14].map(d => '<option value="' + d + '"' + (d === 3 ? ' selected' : '') + '>' + d + (d > 1 ? ' days' : ' day') + '</option>').join('') + '</select></label><label class="small mute">Variant <select id="dv">' + VL().map(v => '<option value="' + v.id + '">' + v.icon + ' ' + v.name + '</option>').join('') + '</select></label><label class="small mute">You play <select id="dc"><option value="0">Random</option><option value="1">White</option><option value="-1">Black</option></select></label><label class="small mute">Opponent <select id="dr"><option value="0">Near my rating</option><option value="-250">Easier</option><option value="250">Harder</option></select></label><label class="chk small"><input type="checkbox" id="drt" checked> Rated</label><button class="pri" id="dnew">Start game</button></div></div>' +
        '<div class="card" style="margin:0 0 10px"><b>Your games</b>' + (act.length ? '<table class="small" style="width:100%;margin-top:6px"><tr><th style="text-align:left">Opponent</th><th>Variant</th><th>Move</th><th>Status</th><th></th></tr>' + act.map(g => { const p = posOf(g), my = p.side === g.human, V = window.ChessVariants ? ChessVariants.get(g.vid) : { icon: '♟', name: 'Standard' }; return '<tr><td>' + g.opp.flag + ' ' + esc(g.opp.name) + ' (' + g.opp.rating + ')</td><td style="text-align:center">' + V.icon + '</td><td style="text-align:center">' + (Math.floor(g.moves.length / 2) + 1) + '</td><td style="color:' + (my ? 'var(--acc)' : 'var(--mute)') + '"><b>' + (my ? 'Your move · ' + left(g.deadline - Date.now()) + ' left' : 'Waiting for ' + esc(g.opp.name) + ' (about ' + left(Math.max(0, g.replyAt - Date.now())) + ')') + '</b></td><td><button class="ib" data-o="' + g.id + '">Open</button></td></tr>'; }).join('') + '</table>' : '<div class="small mute" style="margin-top:6px">No games in progress. Start one above.</div>') + '</div>' +
        (done.length ? '<div class="card" style="margin:0"><b>Finished</b><table class="small" style="width:100%;margin-top:6px">' + done.map(g => { const w = g.res === '*' ? 'Aborted' : g.res === '1/2-1/2' ? 'Drew' : ((g.res === '1-0') === (g.human > 0)) ? 'Won' : 'Lost'; return '<tr><td>' + g.opp.flag + ' ' + esc(g.opp.name) + '</td><td style="color:' + (w === 'Won' ? 'var(--ok)' : w === 'Lost' ? 'var(--bad)' : 'var(--warn)') + '"><b>' + w + '</b> <span class="mute">' + esc(g.why || '') + '</span></td><td>' + (g.rated && g.delta != null ? (g.delta >= 0 ? '+' : '') + g.delta : 'casual') + '</td><td>' + (g.gid ? '<button class="ib" data-a="' + g.gid + '">Analyze</button>' : '') + '</td></tr>'; }).join('') + '</table></div>' : '') + '</div>';
      host.querySelector('#dnew').onclick = newGame; host.onclick = e => { const b = e.target.closest('[data-o]'); if (b) return open(b.dataset.o); const a = e.target.closest('[data-a]'); if (a) { UI.pending = { id: a.dataset.a }; UI.show('analysis'); } };
      timer = setInterval(() => { if (!dead && !board && host.isConnected) list(); }, 60000);
    };
    const newGame = () => {
      const o = load(), q = id => host.querySelector('#' + id), days = +q('dd').value, vid = q('dv').value, V = window.ChessVariants ? ChessVariants.get(vid) : { id: 'std' }, my = ratings().r, off = +q('dr').value;
      const human = +q('dc').value || (Math.random() < .5 ? 1 : -1), fl = UI.olx ? UI.olx.FLAGS : [['🌍', 'World']], rating = clamp(Math.round(my + off + (Math.random() + Math.random() - 1) * 160), 400, 2400);
      const nm = UI.olx ? UI.olx.genOpp(rating, 'rapid') : { name: 'Opponent', flag: '🌍', rating, manner: 'friendly' };
      const g = { id: Date.now().toString(36), opp: { name: nm.name, flag: nm.flag, rating, manner: nm.manner }, human, vid, startFen: V.start ? V.start() : C.START, moves: [], days, created: Date.now(), deadline: Date.now() + days * DAY, replyAt: 0, status: 'active', rated: q('drt').checked };
      if (human < 0) g.replyAt = Date.now() + 1500; o.games.unshift(g); save(o); open(g.id);
    };
    const open = async id => {
      const o = load(); cur = o.games.find(x => x.id === id); if (!cur) return list(); const g = cur; g.unseen = 0; save(o); clearInterval(timer);
      host.innerHTML = '<div class="acw" style="align-items:flex-start"><div class="ckw"><div id="dclk" class="ckp" style="display:none"></div><div><div class="chbar row" id="dtop" style="min-height:34px;gap:8px;align-items:center"></div><div id="dbd"></div><div class="chbar row" id="dbot" style="min-height:34px;gap:8px;align-items:center"></div></div></div><div class="acside" style="width:320px"><div class="acmsg" id="dst" style="font-weight:600;min-height:44px"></div><div class="row" style="gap:6px;flex-wrap:wrap"><button class="ib" id="dback">← Games</button><button class="ib dang" id="dres">Resign</button><button class="ib" id="dskip" title="This is a simulation: skip the wait for your opponent">⏩ Skip the wait</button><button class="ib" id="dflip">Flip</button></div><div class="chml" id="dml" style="height:200px;overflow:auto;background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:6px 10px;font:13px/1.8 \'Cascadia Mono\',Consolas,monospace"></div><div class="small mute" id="dnote"></div></div></div>';
      const q = i => host.querySelector('#' + i); board = new UI.Board(q('dbd')); const V = window.ChessVariants ? ChessVariants.get(g.vid) : { id: 'std', hint: '' };
      const paint = () => {
        const p = posOf(g), my = p.side === g.human && g.status === 'active', last = g.moves.length ? (() => { const pp = mkPos(g); let lm = null; for (const u of g.moves) { const m = pp.fromUci(u); lm = [m & 63, (m >> 6) & 63]; pp.make(m); } return lm; })() : null;
        board.set(p.fen(), { variant: ChessVX.has(g.vid) ? g.vid : '', who: my ? g.human : 0, flipped: g.human < 0, last, anim: false, fog: g.vid === 'fog' && g.status === 'active' ? g.human : 0 });
        let s = '', pp = mkPos(g); g.moves.forEach((u, i) => { const m = pp.fromUci(u); if (i % 2 === 0) s += (i ? '<br>' : '') + '<span class="mute" style="display:inline-block;width:2.2em">' + (i / 2 + 1) + '.</span>'; s += '<span style="display:inline-block;width:5.4em">' + esc(pp.san(m)) + '</span>'; pp.make(m); }); q('dml').innerHTML = s; q('dml').scrollTop = 1e6;
        q('dtop').innerHTML = '<b>' + g.opp.flag + ' ' + esc(g.opp.name) + '</b> <span class="small mute">(' + g.opp.rating + ')</span>'; q('dbot').innerHTML = '<b>' + esc(ls.get('chprofname', 'You')) + '</b> <span class="small mute">(' + ratings().r + ')</span>' + '<span class="small mute" style="margin-left:auto">' + g.days + ' day' + (g.days > 1 ? 's' : '') + ' per move</span>';
        { const dc = q('dclk'); if (dc) { if (g.status !== 'active') dc.style.display = 'none'; else { const mine = { who: ls.get('chprofname', 'You'), t: my ? left(g.deadline - Date.now()) : '-', on: my, low: my && g.deadline - Date.now() < 6 * 36e5, sub: g.days + ' day' + (g.days > 1 ? 's' : '') + ' per move' }, them = { who: g.opp.name, t: my ? '-' : '~' + left(Math.max(0, g.replyAt - Date.now())), on: !my, low: false, sub: 'to reply' }; /* a daily game has no clock, but the day's allowance works just as well as a dial */ const dtotal = g.days * 86400, now = Date.now(); them.sec = Math.max(0, (g.replyAt - now) / 1000); them.total = dtotal; them.side = -g.human; mine.sec = Math.max(0, (g.deadline - now) / 1000); mine.total = dtotal; mine.side = g.human; ChessClock.paint(dc, [them, mine]); } } }
        q('dst').textContent = g.status === 'done' ? 'Game over: ' + (g.res === '*' ? 'aborted' : g.res === '1/2-1/2' ? 'draw' : ((g.res === '1-0') === (g.human > 0)) ? 'you won' : 'you lost') + ' (' + g.why + ')' + (g.delta != null && g.rated ? ' · ' + (g.delta >= 0 ? '+' : '') + g.delta : '') : my ? 'Your move · ' + left(g.deadline - Date.now()) + ' left' : g.opp.name + ' will move in about ' + left(Math.max(0, g.replyAt - Date.now()));
        q('dskip').style.display = g.status === 'active' && !my ? '' : 'none'; q('dres').style.display = g.status === 'active' ? '' : 'none'; q('dres').textContent = g.moves.length < 2 ? 'Abort' : 'Resign'; q('dres').title = g.moves.length < 2 ? 'Cancel this game before it starts: no rating change' : 'Give up the game'; q('dnote').innerHTML = V.hint ? esc(V.hint) : '';
      };
      board.onmove = async m => { const p = posOf(g); if (g.status !== 'active' || p.side !== g.human) return; g.moves.push(p.uci(m)); g.deadline = Date.now() + g.days * DAY; const p2 = posOf(g), v = verdict(g, p2); const o2 = load(); const i = o2.games.findIndex(x => x.id === g.id); if (v) end(o2, g, v.res, v.why); else { g.replyAt = Date.now() + Math.max(3 * 60e3, rnd(.02, .35) * g.days * DAY); } o2.games[i] = g; save(o2); paint(); try { A.sfx && A.sfx.play('tick'); } catch (e) { } };
      const resync = async () => { const o2 = load(), g2 = o2.games.find(x => x.id === g.id); if (!g2) return; const ch = await advance(o2, g2); Object.assign(g, g2); if (ch || g.status === 'done') { paint(); if (g.status === 'active') try { ChessSet.sound('move'); } catch (e) { } } else paint(); };
      q('dback').onclick = () => { list(); }; q('dflip').onclick = () => { board.flipped = !board.flipped; board.draw(); };
      q('dskip').onclick = async () => { g.replyAt = Date.now() - 1; const o2 = load(), i = o2.games.findIndex(x => x.id === g.id); o2.games[i] = g; save(o2); await resync(); };
      q('dres').onclick = () => { if (g.moves.length < 2) { if (!confirm('Abort this game? It is cancelled and your rating does not change.')) return; const o2 = load(), i = o2.games.findIndex(x => x.id === g.id); g.status = 'done'; g.res = '*'; g.why = 'aborted'; g.replyAt = 0; o2.games[i] = g; save(o2); return list(); } if (!confirm('Resign this game?')) return; const o2 = load(), i = o2.games.findIndex(x => x.id === g.id); end(o2, g, g.human > 0 ? '0-1' : '1-0', 'you resigned'); o2.games[i] = g; save(o2); paint(); };
      timer = setInterval(() => { if (!dead && host.isConnected) resync(); }, 30000); paint(); if (g.status === 'active' && posOf(g).side !== g.human && g.replyAt && Date.now() >= g.replyAt) resync();
    };
    ctx && ctx.onLeave && ctx.onLeave(() => { });
    list();
    return () => { dead = true; clearInterval(timer); try { board && board.destroy(); } catch (e) { } if (eng) { try { eng.kill && eng.kill(); } catch (e) { } eng = null; } };
  };
  UI.dailyDebug = { load, advance, posOf, verdict };
})();

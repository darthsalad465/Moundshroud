// Chess hub > 🌐 Online: a SIMULATED online chess site. Nothing touches the internet: opponents are generated players (names, countries, ratings, manners) played by the
// human-like Rival engine at their rating. It feels like an online game: a lobby with ratings per time control, matchmaking, a real-time clock, an opponent who thinks,
// chats, offers draws, resigns, may disconnect, and can be talked into things (the same negotiation system as the learning bots). Ratings are kept separately per time control.
(() => {
  const C = Chess, UI = window.ChessUI, GL = UI && UI.GL; if (!UI) return;
  const pick = a => a[Math.random() * a.length | 0], rnd = (a, b) => a + Math.random() * (b - a), sleep = ms => new Promise(r => setTimeout(r, ms)), clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const esc2 = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const rd = (k, d) => { try { return JSON.parse(ls.get(k, JSON.stringify(d))); } catch (e) { return d; } };
  const TCS = [['bullet', 'Bullet', ['60+0', '60+1']], ['blitz', 'Blitz', ['180+0', '180+2', '300+0', '300+5']], ['rapid', 'Rapid', ['600+0', '900+10']], ['classical', 'Classical', ['1800+0', '1800+20', '3600+0']]];
  const tcLabel = s => { const [b, i] = s.split('+').map(Number); return (b >= 60 ? b / 60 : b + 's') + (i ? ' | ' + i : ' min'); };
  const catOf = s => { const b = +s.split('+')[0]; return b < 180 ? 'bullet' : b < 600 ? 'blitz' : b < 1800 ? 'rapid' : 'classical'; };
  const poolOf = (tc, vid) => { const v = vid === undefined ? ls.get('chovar', 'std') : vid; return !v || v === 'std' ? catOf(tc) : v; };
  const poolName = p => ({ bullet: 'Bullet', blitz: 'Blitz', rapid: 'Rapid', classical: 'Classical', daily: 'Daily' }[p]) || ((window.ChessVariants && ChessVariants.get(p).name) || p);
  const ADJ = ['Silent', 'Quick', 'Sneaky', 'Cosmic', 'Royal', 'Mighty', 'Lucky', 'Calm', 'Fierce', 'Tiny', 'Golden', 'Iron', 'Misty', 'Brave', 'Wild', 'Clever', 'Jolly', 'Stormy', 'Shadow', 'Pixel', 'Frosty', 'Rusty', 'Lazy', 'Turbo'];
  const NOUN = ['Knight', 'Pawn', 'Rook', 'Bishop', 'Queen', 'Gambit', 'Fork', 'Castle', 'Tempo', 'Endgame', 'Zugzwang', 'Fianchetto', 'Panda', 'Falcon', 'Tiger', 'Wizard', 'Otter', 'Comet', 'Dragon', 'Walrus', 'Badger', 'Pigeon', 'Cactus', 'Moose'];
  const FLAGS = [['🇺🇸', 'United States'], ['🇮🇳', 'India'], ['🇧🇷', 'Brazil'], ['🇩🇪', 'Germany'], ['🇬🇧', 'United Kingdom'], ['🇫🇷', 'France'], ['🇪🇸', 'Spain'], ['🇮🇹', 'Italy'], ['🇵🇱', 'Poland'], ['🇹🇷', 'Turkey'], ['🇲🇽', 'Mexico'], ['🇨🇦', 'Canada'], ['🇦🇺', 'Australia'], ['🇳🇱', 'Netherlands'], ['🇸🇪', 'Sweden'], ['🇦🇷', 'Argentina'], ['🇵🇭', 'Philippines'], ['🇮🇩', 'Indonesia'], ['🇯🇵', 'Japan'], ['🇰🇷', 'South Korea'], ['🇳🇬', 'Nigeria'], ['🇿🇦', 'South Africa'], ['🇪🇬', 'Egypt'], ['🇨🇴', 'Colombia']];
  const MANNERS = {
    friendly: { hi: ['hi! gl hf', 'hello, good luck!', 'gl hf', 'good luck, have fun'], q: ['nice one', 'oof, well played', 'wow nice'], win: ['gg wp', 'good game!', 'gg, thanks for the game'], lose: ['gg well played', 'gg, nice game!', 'well played, gg'], yes: ['sure!', 'yep, let us go', 'ok sure'], no: ['maybe later, thanks for the game', 'gotta go, thanks!'], idle: ['good move', 'hmm interesting', 'this is a fun position'] },
    chatty: { hi: ['hey! ready for a good one?', 'yo gl, what is your favourite opening?', 'hi there! let us have a fun game'], q: ['whoa did not see that coming', 'ouch, that hurts lol', 'nice shot!'], win: ['good game! that was fun', 'gg, we should play again', 'gg wp, that got tense'], lose: ['gg wow nice game', 'ahh you got me, gg!', 'good game, you played great'], yes: ['sure why not!', 'yeah let us go again', 'ok!! rematch'], no: ['i need a break, great game though', 'next time!'], idle: ['i am not sure about this one', 'lol this is getting wild', 'tough position'] },
    cocky: { hi: ['gl, you will need it', 'let us go', 'hope you warmed up'], q: ['lucky...', 'hmm. ok.', 'did not matter'], win: ['gg ez', 'gg, better luck next time', 'gg, too easy'], lose: ['gg, i was lagging lol', 'gg, got lucky', 'whatever, gg'], yes: ['sure, same result though', 'ok, let us do it', 'fine, run it back'], no: ['no thanks, got what i wanted', 'nah'], idle: ['is that your plan?', 'interesting...', 'ok'] },
    quiet: { hi: [], q: [], win: ['gg'], lose: ['gg'], yes: ['ok'], no: [], idle: [] },
    nervous: { hi: ['hi.. i am a bit nervous', 'hello, go easy on me?', 'hi, good luck, i am new here'], q: ['oh no', 'ouch', 'oops, i blundered...'], win: ['phew, gg', 'gg, that was close!', 'wow i won, gg'], lose: ['gg, you are too good', 'gg, i knew it', 'good game, i need to practise more'], yes: ['ok, if you want!', 'um ok sure'], no: ['sorry, maybe later', 'i should go, thanks!'], idle: ['hmm...', 'i hope that is ok', 'thinking...'] },
  };
  const STYLE = { friendly: 'a warm, polite online player who likes saying gl hf and gg', chatty: 'a talkative, curious online player who likes to chat about chess and the game', cocky: 'a confident, cheeky online player who teases lightly but is never rude', quiet: 'a quiet online player who says very little', nervous: 'a nervous, modest online player who worries about mistakes' };

  /* ---------- ratings, one per time control ---------- */
  const store = () => { const o = rd('chonline', {}); o.hist = o.hist || []; return o; };
  const base = () => { try { return clamp(Math.round(ChessLearn.rate().r), 600, 2000); } catch (e) { return 1000; } };
  const rating = cat => { const o = store(); return o[cat] || { r: base(), n: 0 }; };
  const setRating = (cat, v) => { const o = store(); o[cat] = v; ls.set('chonline', JSON.stringify(o)); };
  const eloDelta = (my, opp, score, n) => { const E = 1 / (1 + Math.pow(10, (opp - my) / 400)), K = n < 6 ? 48 : n < 20 ? 32 : 24; return Math.round(K * (score - E)); };

  const genOpp = (myR, cat) => {
    const manner = pick(['friendly', 'friendly', 'chatty', 'cocky', 'quiet', 'nervous']), f = pick(FLAGS), r = clamp(Math.round(myR + (Math.random() + Math.random() + Math.random() - 1.5) * 220), 400, 2400);
    let name = pick(ADJ) + pick(NOUN); const k = Math.random(); if (k < .35) name += Math.floor(rnd(1, 99)); else if (k < .55) name += '_' + Math.floor(rnd(2, 2012)); else if (k < .7) name = name.toLowerCase(); else if (k < .8) name = pick(ADJ) + '_' + pick(NOUN);
    return { name, flag: f[0], country: f[1], rating: r, manner, speed: rnd(.6, 1.5), drawish: manner === 'cocky' ? .01 : rnd(.02, .12), resigns: rnd(.08, .35), disc: Math.random() < .03, since: 2015 + Math.floor(Math.random() * 10), games: Math.floor(rnd(80, 6000)) };
  };

  const regNet = o => { const id = 'net:' + A.chars.slug(o.name); try { const def = { id, name: o.name, em: o.flag || '🌐', title: 'Online player, about ' + o.rating + ', ' + (o.country || ''), bio: 'An online chess player (' + o.manner + ') on the site since ' + o.since + ' with about ' + o.games + ' games played.', style: STYLE[o.manner] || 'a friendly online chess player', lines: { chat: ['gg', 'good luck all', 'that was a fun one'] } }; A.chars.reg(Object.assign({ realm: 'Online chess' }, def)); if (A.community) A.community.addCast('chess', def); } catch (e) { } return id; };
  UI.olx = { genOpp, tcLabel, catOf, poolOf, poolName, rating, setRating, eloDelta, TCS, MANNERS, FLAGS };      // shared with the tournament simulator (chess-tourney.js)
  /* ---------- the screen ---------- */
  // tour (optional): { opp, tc, rated, human, label, onResult({res, how, gid}), onContinue() } starts straight in that game and reports back instead of showing the lobby.
  UI.sections.online = (host, api, ctx, tour) => {
    let dead = false, G = null, eng = null, searchTimer = 0;
    const cleanupGame = () => { if (G) { G.dead = true; clearInterval(G.tick); clearTimeout(G.discT); if (G.board) G.board.destroy(); G = null; } if (eng) { eng.kill(); eng = null; } };

    /* ---- lobby ---- */
    const lobby = () => {
      cleanupGame(); clearTimeout(searchTimer); const o = store(), recent = (o.hist || []).slice(-8).reverse(); let rated = ls.get('chorated', '1') !== '0', vid = ls.get('chovar', 'std'), color = ls.get('chocolor', 'auto');
      host.innerHTML = '<div style="max-width:900px"><div class="row" style="gap:10px;flex-wrap:wrap;margin-bottom:8px">' + TCS.map(([k, n]) => { const r = rating(k); return '<div class="card" style="margin:0;min-width:150px;text-align:center"><div style="font-size:24px;font-weight:700;color:var(--acc)">' + r.r + (r.n < 6 ? '<span class="small mute">?</span>' : '') + '</div><div class="small">' + n + '</div><div class="small mute">' + r.n + ' games</div></div>'; }).join('') + (window.ChessVariants ? ChessVariants.list.filter(v => v.id !== 'std').map(v => { const r = rating(v.id); return '<div class="card" style="margin:0;min-width:150px;text-align:center" title="Separate rating for ' + v.name + '"><div style="font-size:24px;font-weight:700;color:var(--acc)">' + r.r + (r.n < 6 ? '<span class="small mute">?</span>' : '') + '</div><div class="small">' + v.icon + ' ' + v.name + '</div><div class="small mute">' + r.n + ' games</div></div>'; }).join('') : '') + '</div>' +
        '<div class="card" style="margin:0 0 10px"><b>Play online</b> <span class="small mute">(simulated: the players are generated on this PC, nothing goes online)</span><div style="margin-top:8px">' + TCS.map(([k, n, list]) => '<div class="row" style="gap:8px;margin:6px 0;align-items:center"><span style="width:70px;font-weight:600">' + n + '</span>' + list.map(s => '<button class="ib" data-tc="' + s + '"' + (s === '300+5' ? ' data-un="1"' : '') + ' style="min-width:86px">' + tcLabel(s) + (s === '300+5' ? ' <span class="small mute">unrated</span>' : '') + '</button>').join('') + '</div>').join('') + '</div>' +
        '<div class="row" style="gap:14px;flex-wrap:wrap;margin-top:8px;align-items:center"><div id="olmode" class="row" style="gap:6px;align-items:stretch"><button class="ib" data-rm="1" title="Counts toward your rating. The live coach is switched off, like a real rated game.">⭐ Rated <span class="small mute">counts toward rating · no coach</span></button><button class="ib" data-rm="0" title="A practice game. The live coach sidebar is on, 5 | 5 is available, and the rating does not change.">🧑‍🏫 Unrated <span class="small mute">practice · live coach on</span></button></div><label class="small mute">Variant <select id="olv">' + (window.ChessVariants ? ChessVariants.list.map(v => '<option value="' + v.id + '"' + (vid === v.id ? ' selected' : '') + '>' + v.icon + ' ' + v.name + '</option>').join('') : '<option value="std">Standard</option>') + '</select></label><span class="small mute" id="olvd"></span><label class="chk" title="While your opponent is thinking, queue your next move; it plays instantly when they move. Right-click the board to cancel it."><input type="checkbox" id="olp"' + (ls.get('olpre', '1') !== '0' ? ' checked' : '') + '> Premoves</label><label class="small mute">You play <select id="olc"><option value="auto">Random</option><option value="1">White</option><option value="-1">Black</option></select></label><span class="small mute">Opponents are matched near your rating, and some are better than the rating says.</span></div></div>' +
        '<div class="card" style="margin:0"><b>Your recent online games</b>' + (recent.length ? '<table class="small" style="width:100%;margin-top:6px"><tr><th style="text-align:left">Opponent</th><th>Time</th><th>Result</th><th>Rating</th></tr>' + recent.map(g => '<tr data-g="' + (g.gid || '') + '" style="cursor:pointer"><td>' + g.flag + ' ' + esc2(g.opp) + ' (' + g.oe + ')</td><td>' + tcLabel(g.tc) + '</td><td style="color:' + ({ W: 'var(--ok)', D: 'var(--warn)', L: 'var(--bad)' }[g.r]) + '"><b>' + ({ W: 'Won', D: 'Drew', L: 'Lost' }[g.r]) + '</b></td><td>' + (g.rated ? (g.d >= 0 ? '+' : '') + g.d + ' &rarr; ' + g.ra : 'casual') + '</td></tr>').join('') + '</table><div class="small mute" style="margin-top:4px">Click a game to analyse it.</div>' : '<div class="small mute" style="margin-top:6px">No games yet. Pick a time control above.</div>') + '</div></div>';
      host.querySelector('#olc').value = color;
      const syncMode = () => { const std = vid === 'std'; host.querySelectorAll('[data-rm]').forEach(b => { const on = (b.dataset.rm === '1') === rated; b.classList.toggle('on', on); b.disabled = false; b.style.opacity = 1; }); host.querySelectorAll('[data-un]').forEach(b => { b.style.display = rated ? 'none' : ''; }); const d = host.querySelector('#olvd'); if (d) d.textContent = (!std ? ChessVariants.get(vid).desc + ' Rated games use their own ' + ChessVariants.get(vid).name + ' rating. ' : '') + (rated ? 'Rated: the live coach is off.' : 'Unrated: the live coach sidebar is on.'); };
      host.querySelector('#olv').onchange = e => { vid = e.target.value; ls.set('chovar', vid); syncMode(); }; host.querySelector('#olmode').onclick = e => { const b = e.target.closest('[data-rm]'); if (!b || b.disabled) return; rated = b.dataset.rm === '1'; ls.set('chorated', rated ? '1' : '0'); syncMode(); }; syncMode(); host.querySelector('#olp').onchange = e => ls.set('olpre', e.target.checked ? '1' : '0'); host.querySelector('#olc').onchange = e => ls.set('chocolor', e.target.value);
      host.onclick = e => { const b = e.target.closest('[data-tc]'); if (b) return search(b.dataset.tc, rated, host.querySelector('#olc').value); const r = e.target.closest('tr[data-g]'); if (r && r.dataset.g) { UI.pending = { id: r.dataset.g }; UI.show('analysis'); } };
    };

    /* ---- matchmaking ---- */
    const search = (tc, rated, colorPick, rematch) => {
      cleanupGame(); const cat = catOf(tc), my = rating(poolOf(tc)).r; let opp = rematch || genOpp(my, cat), n = 0;
      host.innerHTML = '<div class="card" style="max-width:520px;margin:30px auto;text-align:center"><div style="font-size:34px;animation:float 2s ease-in-out infinite">🌐</div><h3 id="olsm" style="margin:6px 0">Looking for a ' + tcLabel(tc) + ' opponent...</h3><div class="small mute" id="olss">Searching near your rating (' + my + ')</div><div class="row" style="justify-content:center;margin-top:10px"><button class="ib" id="olx">Cancel</button></div><div class="small mute" style="margin-top:12px">Simulated online play. Everything runs on this PC.</div></div>';
      host.querySelector('#olx').onclick = lobby;
      const msgs = ['Searching near your rating (' + my + ')', 'Widening the search...', 'Checking who is online...'];
      searchTimer = setInterval(() => { const e = host.querySelector('#olss'); if (e) e.textContent = msgs[++n % msgs.length]; }, 1100);
      const t = setTimeout(() => { clearInterval(searchTimer); if (dead) return; found(); }, rematch ? 900 : rnd(1800, 4800)); const prevCancel = host.querySelector('#olx').onclick; host.querySelector('#olx').onclick = () => { clearTimeout(t); clearInterval(searchTimer); lobby(); };
      const found = async () => {
        host.innerHTML = '<div class="card" style="max-width:520px;margin:30px auto;text-align:center"><div style="font-size:34px">⚔️</div><h3 style="margin:6px 0">Opponent found!</h3><div style="font-size:20px"><b>' + opp.flag + ' ' + esc2(opp.name) + '</b></div><div class="small mute">' + opp.country + ' · rated ' + opp.rating + ' · member since ' + opp.since + '</div><div id="olcd" style="font-size:40px;font-weight:700;color:var(--acc);margin-top:8px">3</div></div>';
        for (let i = 3; i >= 1; i--) { const e = host.querySelector('#olcd'); if (!e || dead) return; e.textContent = i; await sleep(800); } if (dead) return;
        const human = colorPick === 'auto' || !colorPick ? (Math.random() < .5 ? 1 : -1) : +colorPick; game(opp, tc, rated, human);
      };
    };

    /* ---- the game ---- */
    const game = (opp, tc, rated, human, T) => { const V = window.ChessVariants ? ChessVariants.get(T ? 'std' : ls.get('chovar', 'std')) : { id: 'std', name: 'Standard chess' }; const startFen = V.start ? V.start() : C.START; const mk = fen => V.vx && window.ChessVX ? ChessVX.make(V.id, fen) : new C.Pos().setFen(fen);
      cleanupGame(); eng = UI.Eng(); const netId = regNet(opp), ctxNet = () => { try { return A.chars.context(netId, 'You are playing an online chess game against the user right now.'); } catch (e) { return ''; } }; const [bs, inc] = tc.split('+').map(Number), cat = catOf(tc), pool = poolOf(tc, V.id), my0 = rating(pool), myName = T && T.me ? T.me.name : ls.get('chprofname', 'You');
      const S = G = { opp, tc, rated, human, cat, gp: mk(startFen), startFen, V, hist: [], clock: { w: bs, b: bs, total: bs }, inc, over: false, thinking: false, token: 0, last: performance.now(), chat: [], offer: null, myR: T && T.me ? T.me.rating : my0.r, oppDraws: 0, lastOffer: -99, dead: false, discPly: opp.disc ? Math.floor(rnd(14, 38)) : -1, busy: false, started: Date.now(), pend: null, T, gid: null, cc: null };
      const bot = { n: opp.name, e: opp.rating, special: 'twin', t: 'online player', st: STYLE[opp.manner], L: { chat: MANNERS[opp.manner].idle.length ? MANNERS[opp.manner].idle : ['ok'] } };
      host.innerHTML = '<div class="acw" style="align-items:flex-start"><div class="ckw"><div id="oclk" class="ckp"></div><div><div class="chbar row" id="otop" style="min-height:34px;gap:8px;align-items:center"></div><div id="obd"></div><div class="chbar row" id="obot" style="min-height:34px;gap:8px;align-items:center"></div></div></div>' +
        '<div class="acside" style="width:340px"><div class="acmsg" id="ost" style="font-weight:600;min-height:44px"></div><div id="onb"></div>' +
        '<div class="row" style="gap:6px;flex-wrap:wrap"><button class="ib dang" id="ores">Resign</button><button class="ib" id="odr">Offer draw</button><button class="ib" id="oflip">Flip</button></div>' +
        '<div id="olive"></div><div class="chml" id="oml" style="height:150px;overflow:auto;background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:6px 10px;font:13px/1.8 \'Cascadia Mono\',Consolas,monospace"></div>' +
        '<div class="card" style="margin:0;padding:8px"><div id="ochat" style="height:130px;overflow:auto;font-size:13.5px;display:flex;flex-direction:column;gap:4px"></div><div class="row" style="gap:6px;margin-top:6px"><input type="text" id="oin" placeholder="Type a message..." maxlength="160" style="flex:1" autocomplete="off"><button class="ib" id="osend">Send</button></div><div class="row" style="gap:5px;flex-wrap:wrap;margin-top:5px" id="oq">' + ['Good luck!', 'Have fun!', 'Well played!', 'Thanks!', 'Oops', 'Wow!', 'Draw?', 'Good game!'].map(t => '<span class="chip" data-q="' + t + '">' + t + '</span>').join('') + '</div></div></div></div>';
      const q = id => host.querySelector('#' + id), fmt = s => { s = Math.max(0, Math.ceil(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
      const board = S.board = new UI.Board(q('obd'));
      if (rated) q('olive').innerHTML = '<div class="card small mute" style="margin:0;padding:8px 10px">⭐ <b>Rated game</b>: the live coach is off, like a real rated game. You can review the game afterwards.</div>';
      if (V.hint) q('onb').innerHTML = '<div class="acmsg small">' + V.icon + ' ' + V.hint + '</div>';
      if (window.ChessLive && !rated && V.id !== 'fog' && !V.vx) S.live = ChessLive.attach(q('olive'), () => ({ fen: S.gp.fen(), hist: S.hist, startFen: S.startFen, human, over: S.over, side: S.gp.side, board, review: () => { if (S.gid) { UI.pending = { id: S.gid }; UI.show('analysis'); } else A.toast('The game is still being saved. Try again in a moment.'); } }));
      /* pieces each side has captured (replayed from the move list, so take-backs and en passant stay right); +N shows who is ahead in material */
      const VALS = [0, 1, 3, 3, 5, 9], GLY = ['', '♟︎', '♞︎', '♝︎', '♜︎', '♛︎'];
      const captured = () => {
        if (S.cc && S.cc.n === S.hist.length) return S.cc; const cc = { n: S.hist.length, w: [], b: [] }, p = mk(S.startFen);
        for (const h of S.hist) { const m = p.fromUci(h.u); if (m === undefined || m === null || m === false) break; let pc = Math.abs(p.b[(m >> 6) & 63]); if (m & 32768) pc = 1; if (pc) cc[p.side > 0 ? 'w' : 'b'].push(pc); p.make(m); }
        cc.w.sort((a, b) => a - b); cc.b.sort((a, b) => a - b); return S.cc = cc;
      };
      const capHtml = side => {
        const cc = captured(), mine = cc[side > 0 ? 'w' : 'b'], theirs = cc[side > 0 ? 'b' : 'w'], sum = a => a.reduce((x, y) => x + VALS[y], 0), diff = sum(mine) - sum(theirs);
        const col = side > 0 ? 'color:#15171d;text-shadow:0 0 1px #fff,0 0 2px #fff,0 0 3px #fff' : 'color:#fff;text-shadow:0 0 2px #000,0 0 3px #000';
        return '<span class="olcap" title="Pieces captured by this player" style="margin-left:8px;font-size:17px;line-height:1;letter-spacing:-2px;' + col + '">' + mine.map(p => GLY[p]).join('') + '</span>' + (diff > 0 ? '<span class="small" style="margin-left:5px;font-weight:700;color:var(--ok)">+' + diff + '</span>' : '');
      };
      const bars = () => { const mk =(side, who, r, flag) => { const cl = S.clock[side > 0 ? 'w' : 'b'], on = !S.over && S.gp.side === side && S.hist.length >= 2; return '<b>' + (flag ? flag + ' ' : '') + esc2(who) + '</b> <span class="small mute">(' + r + ')</span>' + capHtml(side) + (V.badge ? V.badge(S, side) : '') + (S.thinking && side !== human ? '<span class="small" style="color:var(--acc2)">thinking...</span>' : '') ; void cl; void on; }; const oppBar = mk(-human, opp.name, opp.rating, opp.flag), meBar = mk(human, myName, S.myR, T && T.me ? T.me.flag : ''); q('otop').innerHTML = oppBar; q('obot').innerHTML = meBar;
        const ck = q('oclk'); if (ck) { const blk = (side, who, r) => { const c = S.clock[side > 0 ? 'w' : 'b']; return { who: who + ' (' + r + ')', t: c < 20 && c > 0 ? c.toFixed(1) : fmt(c), on: !S.over && S.gp.side === side && S.hist.length >= 2, low: c < 10 && !S.over, sec: c, total: S.clock.total || 0, side: side, sub: '' }; }; ChessClock.paint(ck, [blk(-human, opp.name, opp.rating), blk(human, myName, S.myR)]); } };
      const moveList = () => { let s = ''; S.hist.forEach((x, i) => { if (i % 2 === 0) s += (i ? '<br>' : '') + '<span class="mute" style="display:inline-block;width:2.2em">' + (i / 2 + 1) + '.</span>'; s += '<span style="display:inline-block;width:5.4em">' + esc2(x.san) + '</span>'; }); q('oml').innerHTML = s; q('oml').scrollTop = 1e6; };
      const status = (t, c) => { const e = q('ost'); if (e) { e.textContent = t; e.style.color = c || ''; } };
      const refresh = () => { if (S.dead) return; try { S.live && S.live.update(); } catch (e) { } const last = S.hist.length ? S.hist[S.hist.length - 1] : null; board.set(S.gp.fen(), { who: !S.over && !S.thinking && S.gp.side === human && !S.pend ? human : 0, flipped: human < 0, last: last ? [last.f, last.t] : null, variant: V.vx ? V.id : '', fog: V.id === 'fog' && !S.over ? human : 0, pre: !V.vx && !S.over && !S.dead && S.gp.side !== human && !S.pend && ls.get('olpre', '1') !== '0' ? human : 0, clearPre: !!S.over || !!S.dead || ls.get('olpre', '1') === '0' }); bars(); moveList(); q('ores').textContent = S.hist.length < 2 && !S.over ? 'Abort' : 'Resign'; q('ores').title = S.hist.length < 2 ? 'Cancel the game before it really starts (no rating change)' + (T ? '. In a tournament an abort counts as a forfeit' : '') : 'Give up the game'; };
      /* chat */
      const addChat = (who, text) => { S.chat.push({ who, text }); const d = document.createElement('div'); d.style.cssText = 'padding:3px 8px;border-radius:8px;max-width:92%;overflow-wrap:anywhere;' + (who === 'me' ? 'align-self:flex-end;background:var(--user)' : who === 'sys' ? 'align-self:center;color:var(--mute);font-size:12px' : 'align-self:flex-start;background:var(--panel2)'); d.textContent = (who === 'opp' ? opp.name + ': ' : '') + text; const c = q('ochat'); if (c) { c.appendChild(d); c.scrollTop = c.scrollHeight; } };
      const oppSay = (text, delay) => { if (!text) return; setTimeout(() => { if (!S.dead) { addChat('opp', text); try { A.chars.said(netId, text); } catch (e) { } try { A.sfx && A.sfx.play('tick'); } catch (e) { } } }, delay === undefined ? rnd(700, 2200) : delay); };
      const M = MANNERS[opp.manner];
      /* negotiation context (shared with the learning bots) */
      const nctx = { get: () => ({ elo: opp.rating, human, hist: S.hist, fen: S.gp.fen(), over: S.over, side: S.gp.side }), actions: { draw: () => finish('agreed', 'Draw agreed.', '1/2-1/2'), resign: () => finish('resign', 'Your opponent resigned. You win!', human > 0 ? '1-0' : '0-1'), undo: () => takeback() }, evalBot: async () => { const r = await eng.ask({ cmd: 'ana', fen: S.gp.fen(), depth: 4, ms: 800 }); const b = r && typeof r.bs === 'number' ? r.bs : 0; return S.gp.side === human ? -b : b; } };
      const llmChat = async (text, extra, fallback) => {
        let got = ''; if (ls.get('olai', '1') !== '0' && window.ChessCoach) { try { const sys = 'You are ' + opp.name + ', an online chess player rated ' + opp.rating + ' from ' + opp.country + ', ' + STYLE[opp.manner] + '. You are playing a ' + tcLabel(tc) + ' game against the user right now. Reply like a real person in the game chat: ONE short lowercase message (under 14 words), abbreviations like gl, gg, lol are fine, at most one emoji, no markdown. Never give chess advice or reveal engine information, and never say you are an AI. ' + ctxNet() + ' ' + (extra ? 'NEGOTIATION RESULT, follow it exactly: ' + extra : ''); const hist = S.chat.slice(-6).map(x => ({ role: x.who === 'opp' ? 'assistant' : 'user', content: x.text })); got = (await Promise.race([ChessCoach.stream([{ role: 'system', content: sys }].concat(hist), () => { }, null, { quiet: 1, temp: .9 }), sleep(25000).then(() => '')])).replace(/\*+/g, '').trim().split('\n')[0].slice(0, 140); } catch (e) { got = ''; } }
        return got || fallback || pick(M.idle.length ? M.idle : ['ok']);
      };
      const send = async text => {
        text = (text || '').trim(); if (!text || S.dead) return; try { ChessAch.event('botchat'); } catch (e) { } q('oin').value = ''; addChat('me', text); try { A.chars.hear(netId, text, { realm: 'Online chess' }); } catch (e) { } let neg = null; try { neg = window.ChessNeg ? await ChessNeg.handle(text, nctx, bot) : null; } catch (e) { neg = null; }
        if (neg && neg.handled) { const r = await llmChat(text, neg.instruction, neg.fallback); await sleep(rnd(600, 1600)); if (S.dead) return; addChat('opp', r); if (neg.act) setTimeout(() => { try { neg.act(); } catch (e) { } }, 1300); return; }
        if (opp.manner === 'quiet' && Math.random() < .6) return; const r = await llmChat(text); await sleep(rnd(700, 1800)); if (!S.dead) addChat('opp', r);
      };
      q('osend').onclick = () => send(q('oin').value); q('oin').onkeydown = e => { e.stopPropagation(); if (e.key === 'Enter') send(q('oin').value); };
      q('oq').onclick = e => { const c = e.target.closest('[data-q]'); if (c) send(c.dataset.q); };
      q('odr').onclick = () => { if (S.over || S.hist.length < 2) return A.toast('Make a few moves first.'); send('Would you like to agree to a draw?'); };
      q('oflip').onclick = () => { board.flipped = !board.flipped; board.draw(); };
      q('ores').onclick = () => { if (S.over) return; if (S.hist.length < 2) { if (!confirm(T ? 'Abort this game? In a tournament an aborted game counts as a forfeit (a loss).' : 'Abort the game? It will not be rated.')) return; return finish('abort', T ? 'Game aborted. It counts as a forfeit.' : 'Game aborted.', '*'); } if (confirm('Resign this game?')) finish('resign', 'You resigned.', human > 0 ? '0-1' : '1-0'); };
      /* the opponent's side offers a draw */
      const showOffer = () => { S.offer = { ply: S.hist.length }; q('onb').innerHTML = '<div class="acmsg" style="border-color:var(--acc)">🤝 <b>' + esc2(opp.name) + '</b> offers a draw. <div class="row" style="gap:6px;margin-top:6px"><button class="pri" id="oya">Accept</button><button class="ib" id="oyn">Decline</button></div></div>'; q('oya').onclick = () => { q('onb').innerHTML = ''; S.offer = null; finish('agreed', 'Draw agreed.', '1/2-1/2'); }; q('oyn').onclick = () => { q('onb').innerHTML = ''; S.offer = null; addChat('sys', 'You declined the draw offer.'); }; };
      /* takeback: only if the opponent agreed (negotiation) */
      const takeback = () => { if (S.over || S.thinking || !S.hist.length) return; const n = S.gp.side === human ? 2 : 1, keep = S.hist.slice(0, Math.max(0, S.hist.length - n)); S.gp = mk(S.startFen); S.hist = []; for (const h of keep) { const m = S.gp.fromUci(h.u); S.gp.make(m); S.hist.push(h); } S.token++; refresh(); addChat('sys', 'Take-back granted.'); if (S.gp.side !== human) oppTurn(); };
      /* ending */
      function finish(how, txt, res) {
        if (S.over) return; S.over = true; S.thinking = false; S.token++; clearInterval(S.tick); clearTimeout(S.discT); q('onb').innerHTML = '';
        const mine = res === '*' ? null : res === '1/2-1/2' ? 'D' : (res === '1-0') === (human > 0) ? 'W' : 'L'; let delta = 0, newR = S.myR;
        try { if (mine) A.chars.event(netId, 'Online game (' + tcLabel(tc) + '): ' + (mine === 'W' ? 'you beat me' : mine === 'L' ? 'I beat you' : 'we drew') + ' after ' + Math.ceil(S.hist.length / 2) + ' moves.', 'Online chess', mine === 'W' ? 3 : mine === 'D' ? 2 : 1); } catch (e) { }
        if (mine && rated && how !== 'abort') { const o = rating(pool); delta = eloDelta(o.r, opp.rating, mine === 'W' ? 1 : mine === 'D' ? .5 : 0, o.n); newR = Math.max(100, o.r + delta); setRating(pool, { r: newR, n: o.n + 1 }); }
        status(txt, mine === 'W' ? 'var(--ok)' : mine === 'L' ? 'var(--bad)' : ''); refresh();
        try { ChessSet.sound(mine === 'W' ? 'win' : mine === 'D' ? 'draw' : mine === 'L' ? 'lose' : 'end'); } catch (e) { }
        if (how === 'abort' || !S.hist.length) { try { ChessAch.event('abort'); } catch (e) { } endCard(T ? mine : null, T ? delta : 0, newR, how); return; }
        let gid = null; if (!V.vx) try { const g = ChessAna.GS.add({ white: human > 0 ? myName : opp.name, black: human > 0 ? opp.name : myName, result: res, moves: S.hist.map(h => h.u), human, elo: opp.rating, src: 'online-sim', startFen: S.startFen !== C.START ? S.startFen : undefined, event: T ? T.label : 'Online (simulated) ' + (V.id !== 'std' ? V.name + ' ' : '') + tcLabel(tc), date: new Date(S.started).toISOString(), reason: txt }); gid = g.id; S.gid = gid; } catch (e) { }
        if (!(T && T.me)) try { const o = store(); o.hist.push({ gid, opp: opp.name, flag: opp.flag, oe: opp.rating, tc, r: mine, d: delta, ra: newR, rated, t: Date.now() }); o.hist = o.hist.slice(-60); ls.set('chonline', JSON.stringify(o)); } catch (e) { }
        if (!(T && T.me)) try { ChessProfile.log({ gid, kind: 'online', opp: opp.name, oe: opp.rating, c: human, r: mine, how: ChessProfile.howOf(how === 'agreed' ? 'agreed' : how === 'abandon' ? 'abandon' : how === 'mate' ? 'checkmate' : how === 'resign' ? 'resign' : how === 'time' ? 'time' : txt), p: S.hist.length, tc, op: ChessProfile.openingOf(S.hist.map(h => h.u)), rt: rated, rb: my0.r, d: delta, country: opp.country, friendly: (window.ChessNeg ? ChessNeg.state().trust : .5) > .66, dur: Math.round((Date.now() - S.started) / 1000), cat, newBest: rated && newR > (rd('chonline', {}).best || 0) }); } catch (e) { }
        if (!(T && T.me)) try { const o = store(); if (rated && newR > (o.best || 0)) { o.best = newR; ls.set('chonline', JSON.stringify(o)); } ChessAch.event('online', { res: mine, cat, rating: newR, oppRating: opp.rating, myRating: my0.r, how, plies: S.hist.length, rated }); if (mine === 'W') ChessFx.confetti(); } catch (e) { }
        // the opponent says goodbye
        if (mine === 'W') oppSay(pick(M.lose.length ? M.lose : ['gg']), 1200); else if (mine === 'L') oppSay(pick(M.win.length ? M.win : ['gg']), 1200); else if (mine === 'D') oppSay(pick(['gg', 'good game', 'gg, draw is fair']), 1200);
        endCard(mine, delta, newR, how);
      }
      const endCard = (mine, delta, newR, how) => { if (T && !S.reported) { S.reported = true; try { T.onResult({ res: mine || 'L', how, gid: S.gid, plies: S.hist.length }); } catch (e) { } } q('onb').innerHTML ='<div class="acmsg" style="text-align:center"><div style="font-size:22px;font-weight:700;color:' + (mine === 'W' ? 'var(--ok)' : mine === 'L' ? 'var(--bad)' : 'var(--warn)') + '">' + (mine === 'W' ? 'You won!' : mine === 'L' ? 'You lost' : mine === 'D' ? 'Draw' : 'Game aborted') + '</div>' + (rated && mine && how !== 'abort' ? '<div>' + poolName(pool) + ' rating <b>' + newR + '</b> <span style="color:' + (delta >= 0 ? 'var(--ok)' : 'var(--bad)') + '">(' + (delta >= 0 ? '+' : '') + delta + ')</span></div>' : '<div class="small mute">' + (rated ? '' : 'Casual game: rating unchanged') + '</div>') + '<div class="row" style="gap:6px;justify-content:center;flex-wrap:wrap;margin-top:8px">' + (T ? '<button class="pri" id="otc">' + (T.cont || 'Continue') + '</button><button class="ib" id="oan">Analyze</button>' : '<button class="pri" id="orm">Rematch</button><button class="ib" id="onw">New opponent</button><button class="ib" id="oan">🔬 Analyze</button><button class="ib" id="olb">Lobby</button>') + '</div></div>';
        if (T) { q('otc').onclick = () => T.onContinue(); q('oan').onclick = () => { if (S.gid) { UI.pending = { id: S.gid }; UI.show('analysis'); } else A.toast('Nothing to analyse.'); }; return; }
        q('olb').onclick = lobby; q('onw').onclick = () => search(tc, rated, 'auto'); q('oan').onclick = () => { const gid = rd('chonline', {}).hist.slice(-1)[0]; if (gid && gid.gid) { UI.pending = { id: gid.gid }; UI.show('analysis'); } else A.toast('Nothing to analyse yet.'); };
        q('orm').onclick = () => { q('orm').disabled = true; addChat('me', 'Rematch?'); const ok = Math.random() < (mine === 'L' ? .7 : mine === 'W' ? .5 : .6) * (opp.manner === 'quiet' ? .7 : 1); setTimeout(() => { if (S.dead) return; if (ok) { try { ChessAch.event('rematch'); } catch (e) { } addChat('opp', pick(M.yes)); setTimeout(() => { if (!S.dead) { const o2 = Object.assign({}, opp, { disc: Math.random() < .03 }); search(tc, rated, String(-human), o2); } }, 1000); } else { addChat('opp', pick(M.no.length ? M.no : ['no thanks'])); q('orm').textContent = 'Declined'; } }, rnd(900, 2000)); };
      };
      /* the clock */
      S.tick = setInterval(() => { if (S.over || S.dead) return; const now = performance.now(), dt = (now - S.last) / 1000; S.last = now; if (S.hist.length < 2) { bars(); return; } const k = S.gp.side > 0 ? 'w' : 'b'; S.clock[k] -= dt; bars(); if (S.clock[k] <= 0) { S.clock[k] = 0; const loser = S.gp.side; finish('time', loser === human ? 'Time is up. You lost on time.' : 'Your opponent ran out of time. You win!', loser > 0 ? '0-1' : '1-0'); } }, 200);
      /* making a move */
      /* ---------- premoves ----------
         The queue is read only after the opponent's move has landed, so a premove is played in the position that really
         exists when the turn comes back. Nothing is taken out of the queue until it has actually been played: a premove
         used to be removed first and played from a timer a moment later, and anything that went wrong in that moment
         (a slow frame, the game ending, or the player making a move first) threw the whole queue away without a word.
         Now a premove either plays, or it is dropped with a message and the rest of the plan is kept. */
      const preNote = n => A.toast(n === 1 ? 'A premove was no longer possible, so it was dropped.' : n + ' premoves were no longer possible, so they were dropped.', 3200);
      let prePlaying = false, preTok = 0;
      const premoveDue = () => {                     /* returns true when there is nothing left to wait for */
        if (!board || !board.premoves || !board.premoves.length) return true;
        if (S.over || S.dead) { board.premoves = []; try { board.draw(); } catch (e) { } return true; }
        if (S.thinking || S.gp.side !== human) return false;      /* not our turn yet: hold them and look again in a moment */
        const q = board.premoves, l = S.gp.legal(); let dropped = 0, play = null;
        while (q.length) {
          const pm = q.shift();
          const c = l.filter(x => (x & 63) === pm.from && ((x >> 6) & 63) === pm.to && (!pm.promo || ((x >> 12) & 7) === pm.promo));
          if (c.length) { play = c.length > 1 ? (c.find(x => ((x >> 12) & 7) === (pm.promo || 5)) || c[0]) : c[0]; break; }
          dropped++;                                 /* this one can never be played: drop it and try the next in the plan */
        }
        try { board.draw(); } catch (e) { }          /* show what is left, and what is being played now */
        if (dropped) preNote(dropped);
        if (play === null) return true;
        prePlaying = true; board._mine = performance.now();
        try { apply(play); } finally { prePlaying = false; }
        return true;
      };
      const premoveGo = () => {                      /* the opponent has moved: give the board a moment to show it, then play */
        const tok = ++preTok; let tries = 0;
        const step = () => {
          if (tok !== preTok || !board) return;
          if (premoveDue()) return;
          if (++tries > 80) {                        /* four seconds and it is still not our turn: leave the plan alone (the bar shows it) rather than wipe it */
            try { board.draw(); } catch (e) { }
            return;
          }
          setTimeout(step, 60);
        };
        setTimeout(step, 20);
      };
      const apply = m => {
        /* the opponent is the one moving, so the queue is read AFTER their move lands (below): a premove is only good in the
           position that actually exists when your turn comes back. Reading it before their move is what made premoves
           "finicky" — a legal-now move could be played into a position where it is not legal any more. */
        const fromOpp = S.gp.side !== human;
        const l = S.gp.legal(), san = S.gp.san(m, l), f = m & 63, t = (m >> 6) & 63; S.lastCap = !!S.gp.b[t] || ((m & 32768) !== 0);
        const u = S.gp.uci(m), mover = S.gp.side; S.gp.make(m); S.hist.push({ u, san, f, t }); if (S.hist.length > 2) S.clock[mover > 0 ? 'w' : 'b'] += S.inc; S.last = performance.now(); try { ChessAch.event('move', { san, mine: mover === human, ply: S.hist.length }); } catch (e) { }
        if (V.check) { const vr = V.check(S.gp, S, mover); if (vr && vr.draw) return finish('rule', 'Draw: ' + vr.txt + '.', '1/2-1/2'); if (vr && vr.win) { const wn = vr.winner || mover; return finish('rule', (wn === human ? 'You win: ' : 'You lose: ') + vr.txt + '.', wn > 0 ? '1-0' : '0-1'); } }
        const legal = S.gp.legal(), key = S.gp.key(); let rep = 0; S.hist.forEach(h => { /* repetition counted below */ }); const keys = []; { const p = mk(S.startFen); keys.push(p.key()); for (const h of S.hist) { p.make(p.fromUci(h.u)); keys.push(p.key()); } rep = keys.filter(x => x === key).length; }
        if (!legal.length) { if (S.gp.inCheck()) return finish('mate', 'Checkmate. ' + (mover === human ? 'You win!' : 'You lose.'), mover > 0 ? '1-0' : '0-1'); return finish('rule', 'Stalemate. The game is drawn.', '1/2-1/2'); }
        if (S.gp.insufficient()) return finish('rule', 'Draw: not enough pieces to mate.', '1/2-1/2'); if (S.gp.half >= 100) return finish('rule', 'Draw: fifty-move rule.', '1/2-1/2'); if (rep >= 3) return finish('rule', 'Draw by threefold repetition.', '1/2-1/2');
        status(S.gp.side === human ? (S.gp.inCheck() ? 'Check! Your move.' : 'Your move') : opp.name + ' is thinking...', S.gp.inCheck() ? 'var(--bad)' : ''); refresh();
        if (mover === human) {
          /* a move made by hand wipes the rest of a premove plan (it was built for another position), and says so */
          if (!prePlaying && board.premoves.length) { board.premoves = []; try { board.draw(); } catch (e) { } A.toast('Your queued premoves were cleared because you played a different move.', 3200); }
          if (S.offer) { q('onb').innerHTML = ''; S.offer = null; } try { ChessNeg.onUserMove(); } catch (e) { } if (S.gp.side !== human) oppTurn();
        }
        else if (fromOpp) premoveGo();
      };
      board.onmove = m => { if (S.over || S.thinking || S.gp.side !== human) return; if (S.hist.length === 0 && human < 0) return; apply(m); };
      /* how hard is this position for a person? 0.1 = forced or obvious, about 1 = ordinary, up to 3 = complicated */
      const complexity = ply => {
        const g = S.gp, legal = g.legal(), n = legal.length; if (n <= 1) return .08; let caps = 0, chks = 0, recap = false, tactical = 0; const last = S.hist.length ? S.hist[S.hist.length - 1] : null;
        for (const m of legal) { const to = (m >> 6) & 63; if (g.b[to]) { caps++; if (last && S.lastCap && to === last.t) recap = true; } g.make(m); if (g.inCheck()) chks++; g.unmake(); }
        let pcs = 0; for (let i = 0; i < 64; i++) if (g.b[i]) pcs++; tactical = caps + chks; let c = .45 + n / 36 + tactical * .1 + (pcs > 22 ? .1 : 0);
        if (recap && caps <= 2) c *= .3; else if (g.inCheck() && n <= 3) c *= .3; if (ply < 10) c *= .45; if (pcs <= 6) c *= .8; if (pcs > 10 && tactical >= 4) c *= 1.35; return clamp(c, .12, 3);
      };
      S.complexity = complexity;
      /* the opponent's turn: think like a person (time + engine) */
      async function oppTurn() {
        if (S.over || S.dead) return; const my = ++S.token; S.thinking = true; refresh();
        // very rarely an online opponent aborts before the game really starts (never in tournaments or careers)
        if (!T && S.hist.length < 2 && S.abortRoll === undefined) S.abortRoll = Math.random() < .03;
        if (S.abortRoll && S.hist.length < 2) { S.abortRoll = false; await sleep(2500 + Math.random() * 7000); if (my !== S.token || S.over || S.dead || S.hist.length >= 2) return; S.thinking = false; addChat('sys', opp.name + ' has aborted the game.'); return finish('abort', opp.name + ' aborted the game before it started. No rating change.', '*'); }
        // disconnect event
        if (S.discPly > 0 && S.hist.length >= S.discPly) { S.discPly = -1; S.thinking = false; S.clock[human > 0 ? 'b' : 'w'] += 0; return disconnected(); }
        const ply = S.hist.length, mine = S.clock[human > 0 ? 'b' : 'w'], speed = { bullet: [.3, 1.4], blitz: [1, 6], rapid: [3, 16], classical: [6, 40] }[cat], cx = complexity(ply);
        let think = rnd(speed[0], speed[1]) * opp.speed * cx * (Math.random() < .08 ? 1.8 : 1); think = clamp(think, cx <= .25 ? .25 : .5, Math.max(.4, mine * (cat === 'classical' ? .05 : cat === 'rapid' ? .08 : .2))); if (mine < 8) think = Math.min(think, .6);
        let mv = null; if (V.vx) { await sleep(think * 1000); try { mv = ChessVX.think(S.gp, opp.rating, 700); } catch (e) { mv = null; } } else try { const r = await Promise.all([ChessLearn.choose({ gp: S.gp, eng, elo: opp.rating, human, hist: S.hist, ms: 700, mode: 'twin', rate: opp.rating, sleep: 0 }), sleep(think * 1000)]); mv = r[0] && r[0].move; } catch (e) { mv = null; }
        if (my !== S.token || S.over || S.dead) return;
        if (!mv && !V.vx) { try { const r = await eng.ask({ fen: S.gp.fen(), elo: opp.rating, ms: 500, style: opp.manner === 'cocky' ? 'aggressive' : (opp.manner === 'nervous' || opp.manner === 'quiet') ? 'solid' : undefined }); mv = r && r.move; } catch (e) { } } if (my !== S.token || S.over || S.dead) return;
        const ev = window.ChessNeg ? ChessNeg.state().ev : 0;     // from the opponent's point of view
        if (ply > 24 && ev <= -700 && Math.random() < opp.resigns) { S.thinking = false; return finish('resign', opp.name + ' resigned. You win!', human > 0 ? '1-0' : '0-1'); }
        S.thinking = false; if (V.id !== 'std') { try { mv = await ChessVariants.pick(V, S.gp, eng, mv, S); } catch (e) { } if (my !== S.token || S.over || S.dead) return; } const l = S.gp.legal(); const m = l.find(x => x === mv) || l[0]; if (m === undefined) return; apply(m);
        if (!S.over) { if (ply > 38 && Math.abs(ev) < 60 && S.hist.length - S.lastOffer > 24 && !S.offer && Math.random() < opp.drawish) { S.lastOffer = S.hist.length; showOffer(); oppSay(pick(['draw?', 'shall we call it a draw?', 'i think this is a draw']), 500); } else if (ev < -300 && Math.random() < .1 && M.q.length) oppSay(pick(M.q), 400); }
      }
      function disconnected() {
        let left = 20; addChat('sys', opp.name + ' has left the game.'); status(opp.name + ' disconnected. You win in ' + left + 's unless they come back.', 'var(--warn)'); q('onb').innerHTML = '<div class="acmsg"><div class="row" style="gap:8px;align-items:center"><span id="ocd">Opponent disconnected. Win in ' + left + 's.</span><span class="sp"></span><button class="pri" id="occ" disabled>Claim win</button></div></div>';
        S.discT = setInterval(() => { if (S.over || S.dead) return clearInterval(S.discT); left--; const e = q('ocd'); if (e) e.textContent = 'Opponent disconnected. Win in ' + Math.max(0, left) + 's.'; if (left <= 10 && q('occ')) q('occ').disabled = false; if (left <= 0) { clearInterval(S.discT); finish('abandon', opp.name + ' abandoned the game. You win!', human > 0 ? '1-0' : '0-1'); } }, 1000); if (q('occ')) q('occ').onclick = () => { clearInterval(S.discT); finish('abandon', opp.name + ' abandoned the game. You win!', human > 0 ? '1-0' : '0-1'); };
      }
      /* start */
      try { ChessNeg.reset(); } catch (e) { } try { ChessSet.sound('start'); } catch (e) { }
      addChat('sys', 'Game started: ' + (V.id !== 'std' ? V.name + ' ' : '') + tcLabel(tc) + (rated ? ' (rated)' : ' (casual)') + '. You are ' + (human > 0 ? 'White' : 'Black') + '.'); if (rated && !T) { const n0 = my0.n, w = eloDelta(my0.r, opp.rating, 1, n0), d = eloDelta(my0.r, opp.rating, .5, n0), l = eloDelta(my0.r, opp.rating, 0, n0), sg = v => (v >= 0 ? '+' : '') + v; addChat('sys', '⭐ ' + poolName(pool) + ' rating ' + my0.r + ' vs ' + opp.rating + ': win ' + sg(w) + ' · draw ' + sg(d) + ' · loss ' + sg(l)); try { const e = q('olive'); if (e) e.innerHTML = '<div class="card small" style="margin:0;padding:8px 10px">⭐ <b>Rated ' + poolName(pool) + '</b>: coach off. <span style="color:var(--ok)">Win ' + sg(w) + '</span> · <span class="mute">Draw ' + sg(d) + '</span> · <span style="color:var(--bad)">Loss ' + sg(l) + '</span></div>'; } catch (x) { } } if (M.hi.length && Math.random() < .85) oppSay(pick(M.hi), rnd(900, 2600));
      status(human > 0 ? 'Your move' : opp.name + ' is thinking...'); refresh(); if (human < 0) oppTurn();
    };

    UI.onlineDebug = { game, lobby, state: () => G };      // test hook: start a game without matchmaking
    if (tour) game(tour.opp, tour.tc, tour.rated, tour.human, tour); else lobby();
    return () => { dead = true; clearTimeout(searchTimer); clearInterval(searchTimer); cleanupGame(); };
  };
})();

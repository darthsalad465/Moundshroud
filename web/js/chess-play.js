// Chess hub: play a game against Moundshroud (strength 400 to 3200 (3200 = Stockfish at full strength), optional clock). Finished games are saved so they can be analyzed.
(() => {
  const C = Chess, U = () => window.ChessUI, AN = () => window.ChessAna;
  const TCS = [['none', 'No clock'], ['180+2', '3 min + 2 s'], ['300+0', '5 min'], ['300+5', '5 min + 5 s'], ['600+0', '10 min'], ['900+10', '15 min + 10 s'], ['1800+0', '30 min (classical)'], ['3600+0', '60 min (classical)']];
  const LEVELS = [[600, 'Beginner'], [1000, 'Casual'], [1400, 'Club player'], [1800, 'Strong club'], [2100, 'Expert'], [2500, 'Master'], [2800, 'Grandmaster'], [3150, 'Super-grandmaster'], [9999, 'Stockfish at full strength, no handicap']];
  const lname = e => (LEVELS.find(l => e <= l[0]) || LEVELS[5])[1];
  const VAL = [0, 1, 3, 3, 5, 9, 0];
  const fmt = s => { s = Math.max(0, Math.ceil(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };

  const UI2 = () => window.ChessUI || {};
  window.ChessUI.sections.play = function (host, api, ctx) {
    const { Board, Eng, GL } = U(), saved = (() => { try { return JSON.parse(ls.get('chess', 'null')); } catch (e) { return null; } })();
    /* the position the game starts from: the usual one, or one handed over (a scanned picture: Play from here) */
    let sfen = (saved && saved.sfen) || C.START;
    host.innerHTML = '<div class="acw"><div class="ckw"><div id="pclk" class="ckp" style="display:none"></div><div><div class="chbar row" id="ptop" style="min-height:30px;font-size:13px;gap:8px;align-items:center"></div><div id="pbd"></div><div class="chbar row" id="pbot" style="min-height:30px;font-size:13px;gap:8px;align-items:center"></div></div></div>' +
      '<div class="acside"><div class="card" style="margin:0"><div class="row" style="justify-content:space-between"><b>Opponent strength</b><span id="pel" style="color:var(--acc2);font-weight:600"></span></div><input type="range" id="pelo" min="100" max="3200" step="1" style="width:100%"><div class="row" style="gap:6px;margin-top:4px;align-items:center"><span class="small mute" style="white-space:nowrap">Exact rating:</span><input type="number" id="pelot" min="100" max="3200" step="1" title="Type any rating from 100 to 3200" style="width:84px"></div><div class="small mute" id="plv"></div>' +
      '<div class="row" style="margin-top:8px;gap:6px;flex-wrap:wrap"><label class="small mute">You play <select id="pcol"><option value="1">White</option><option value="-1">Black</option><option value="0">Random</option></select></label><label class="small mute">Clock <select id="ptc">' + TCS.map(t => '<option value="' + t[0] + '">' + t[1] + '</option>').join('') + '</select></label><button class="ib" id="pckd" title="Choose the look of the clock, and whether it switches by itself or by a button">&#9201; Design</button></div></div>' +
      '<div id="plive"></div><div class="card" id="pbc" style="margin:0"></div>' +
      '<div class="row" style="flex-wrap:wrap;gap:6px"><button class="pri" id="pnew">New game</button><button class="ib" id="pundo">Undo</button><button class="ib" id="phint">Hint</button><button class="ib" id="pflip">Flip</button><button class="ib" id="pdraw">Offer draw</button><button class="ib dang" id="pres">Resign</button></div>' +
      '<div class="acmsg" id="pst" style="font-weight:600;min-height:44px"></div><div class="chml" id="pml" style="height:190px;overflow:auto;background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:6px 10px;font:13px/1.8 \'Cascadia Mono\',Consolas,monospace"></div>' +
      '<div class="row" style="flex-wrap:wrap;gap:6px"><button class="ib" id="pana">🔬 Analyze this game</button><button class="ib" id="pcopy">Copy PGN</button><button class="ib" id="pdl">Download PGN</button></div><div class="small mute">Click or drag a piece. Click a move in the list to look back; click Live to return. Strength is approximate: Moundshroud looks deeper and slips less as you raise it.</div></div></div>';
    const $p = id => host.querySelector('#' + id);
    const board = new Board($p('pbd')); let eng = Eng(), gp, hist, human = 1, elo = saved ? saved.elo : 1200, tc = saved && saved.tc || 'none', over = false, thinking = false, token = 0, flipped = false, view = null, clock = null, tick = null, lastTick = 0, resultNote = '', started = 0, dead = false, drawDeclined = 0;
    $p('pelo').value = elo; $p('pelot').value = elo; $p('ptc').value = tc;
    $p('pelot').onchange = () => { const v = Math.max(100, Math.min(3200, Math.round(+$p('pelot').value || 1200))); $p('pelot').value = v; $p('pelo').value = v; $p('pelo').oninput(); };
    const bots = window.ChessBots ? ChessBots.mount($p('pbc'), { get: () => ({ elo, human, hist: hist || [], fen: gp ? gp.fen() : '', over, side: gp ? gp.side : 1 }), setElo: v => { if (window.ChessBots) ChessBots._setting = true; $p('pelo').value = v; $p('pelo').oninput(); if (window.ChessBots) ChessBots._setting = false; },
      actions: { draw: () => { if (!over) finish('Draw agreed. Your opponent accepted.', '1/2-1/2'); }, resign: () => !over && finish('Your opponent resigned. You win!', human > 0 ? '1-0' : '0-1', true), undo: () => { if (over) return; thinking = false; const b = $p('pundo'); if (b && b.onclick) b.onclick(); } },
      evalBot: async () => { const r = await eng.ask({ cmd: 'ana', fen: gp.fen(), depth: 4, ms: 900 }); const bs = r && typeof r.bs === 'number' ? r.bs : 0; return gp.side === human ? -bs : bs; } }) : null;
    const live = window.ChessLive ? ChessLive.attach($p('plive'), () => ({ fen: gp ? gp.fen() : '', hist: hist || [], human, over, side: gp ? gp.side : 1, board, review: () => { const id = ls.get('chesslastid', ''); if (id) { try { ChessUI.pending = { id }; ctx.show('analysis'); } catch (e) { } } } })) : null;
    const sideName = s => s > 0 ? 'White' : 'Black';
    const names = () => human > 0 ? ['You', 'Moundshroud (' + elo + ')'] : ['Moundshroud (' + elo + ')', 'You'];
    const save = () => ls.set('chess', JSON.stringify({ elo, human, moves: hist.map(h => h.u), flipped, tc, clock, started, sfen: sfen !== C.START ? sfen : undefined }));
    const status = (t, color) => { const s = $p('pst'); s.textContent = t; s.style.color = color || ''; };
    /* the clock: automatic (the side to move always runs, the default) or manual, where a press on the clock gives the time to a side */
    const clockKey = () => (ChessClock.cfg().manual && clock && clock.active) ? clock.active : (gp && gp.side < 0 ? 'b' : 'w');
    const ckOn = side => { if (!clock || over) return false; return ChessClock.cfg().manual ? clockKey() === (side > 0 ? 'w' : 'b') : !!(gp && gp.side === side); };
    const pressClock = side => {
      if (!clock || over || dead) return;
      clock.active = side > 0 ? 'w' : 'b'; clock.last = performance.now();
      try { ChessSet.sound('tick'); } catch (e) { }
      try { ChessSet.sound('move'); } catch (e) { }
      save(); bars();
      status((side > 0 ? 'White' : 'Black') + ' has the clock.');
    };
    const dispPos = () => { if (view === null || view >= hist.length) return gp; const p = new C.Pos().setFen(sfen); for (let i = 0; i < view; i++) p.make(p.fromUci(hist[i].u)); return p; };
    const captured = pos => { const have = [0, 8, 2, 2, 2, 1, 1], cnt = { 1: [0, 0, 0, 0, 0, 0, 0], '-1': [0, 0, 0, 0, 0, 0, 0] }; for (let i = 0; i < 64; i++) { const p = pos.b[i]; if (p) cnt[p > 0 ? 1 : -1][Math.abs(p)]++; } const lost = { 1: [], '-1': [] }; let sc = 0; for (const s of [1, -1]) for (let t = 5; t >= 1; t--) { const n = Math.max(0, have[t] - cnt[s][t]); for (let k = 0; k < n; k++) lost[s].push(t); sc += (s > 0 ? -1 : 1) * n * VAL[t]; } return { lost, sc }; };
    const bars = () => {
      const pos = dispPos(), cp = captured(pos), nm = names(), top = flipped ? 1 : -1, bot = -top;
      const row = side => { const who = side === human ? 'You' : (window.ChessBots ? ChessBots.name(elo) : 'Moundshroud (' + elo + ')'), mine = cp.lost[-side].map(t => '<span style="font-size:17px;color:' + (-side > 0 ? '#fff' : '#111') + ';-webkit-text-stroke:.6px ' + (-side > 0 ? '#222' : '#ddd') + '">' + GL[t] + '</span>').join(''), adv = side > 0 ? cp.sc : -cp.sc, cl = clock ? '<b style="margin-left:auto;font:600 16px \'Cascadia Mono\',Consolas,monospace;padding:1px 8px;border-radius:8px;background:' + (gp && gp.side === side && !over ? 'var(--acc)' : 'var(--panel2)') + ';color:' + (gp && gp.side === side && !over ? 'var(--onacc)' : 'var(--text)') + '">' + fmt(clock[side > 0 ? 'w' : 'b']) + '</b>' : ''; return '<b>' + who + '</b><span style="letter-spacing:-3px">' + mine + '</span>' + (adv !== 0 ? '<span class="small" style="font-weight:700;color:' + (adv > 0 ? 'var(--ok)' : 'var(--bad)') + '">' + (adv > 0 ? '+' : '−') + Math.abs(adv) + '</span>' : '') + (thinking && side !== human ? '<span class="small" style="color:var(--acc2)">thinking...</span>' : ''); void cl; };
      $p('ptop').innerHTML = row(flipped ? 1 : -1); $p('pbot').innerHTML = row(flipped ? -1 : 1);
      // top bar belongs to the side shown at the top of the board
      if (!flipped) { $p('ptop').innerHTML = row(-1); $p('pbot').innerHTML = row(1); } else { $p('ptop').innerHTML = row(1); $p('pbot').innerHTML = row(-1); }
      const pc = $p('pclk'); if (pc) {
        if (!clock) pc.style.display = 'none'; else {
          const mk = side => { const w = clock[side > 0 ? 'w' : 'b'], adv = side > 0 ? cp.sc : -cp.sc; return { who: side === human ? 'You' : (window.ChessBots ? ChessBots.name(elo) : 'Moundshroud'), t: fmt(w), on: ckOn(side), low: w < 30, sec: w, total: clock.total || 0, side: side, sub: adv > 0 ? 'Material +' + adv : adv < 0 ? 'Material −' + Math.abs(adv) : 'Material level' }; };
          ChessClock.paint(pc, flipped ? [mk(1), mk(-1)] : [mk(-1), mk(1)], { manual: ChessClock.cfg().manual, onPress: pressClock });
        }
      }
    };
    const moveList = () => { const ml = $p('pml'); let s = ''; hist.forEach((x, i) => { if (i % 2 === 0) s += (i ? '<br>' : '') + '<span class="mute" style="display:inline-block;width:2.2em">' + (i / 2 + 1) + '.</span>'; const cur = (view === null ? hist.length - 1 : view - 1) === i; s += '<span data-i="' + (i + 1) + '" style="display:inline-block;width:5.4em;cursor:pointer;border-radius:4px;padding:0 3px;' + (cur ? 'background:var(--acc);color:var(--onacc)' : '') + '">' + esc(x.san) + '</span>'; }); if (view !== null && view < hist.length) s += '<br><span class="chip" data-live="1">Back to live</span>'; ml.innerHTML = s; ml.scrollTop = view === null ? 1e6 : ml.scrollTop; };
    const refresh = () => {
      const pos = dispPos(), live = pos === gp, last = (live ? hist.length : view) ? hist[(live ? hist.length : view) - 1] : null;
      board.set(pos.fen(), { who: live && !over && !thinking && gp.side === human ? human : 0, flipped, last: last ? [last.f, last.t] : null }); bars(); moveList(); $p('pundo').disabled = !hist.length || thinking; $p('pel').textContent = elo >= 3200 ? '3200 · full strength' : elo; $p('plv').textContent = lname(elo);
    };
    const pgn = () => AN().toPGN({ white: names()[0] === 'You' ? 'You' : 'Moundshroud', black: names()[1] === 'You' ? 'You' : 'Moundshroud', result: resultOf(), moves: hist.map(h => h.u), tags: { WhiteElo: human > 0 ? '' : String(elo), BlackElo: human < 0 ? '' : String(elo) }, event: 'Game vs Moundshroud', startFen: sfen !== C.START ? sfen : undefined, date: new Date(started || Date.now()).toISOString() });
    let result = '*'; const resultOf = () => result;
    const finishInfo = {};
    const finish = (txt, res, win) => {
      over = true; thinking = false; token++; result = res; clearInterval(tick); status(txt, win ? 'var(--ok)' : ''); save(); try { ChessSet.sound(win ? 'win' : res === '1/2-1/2' ? 'draw' : 'lose'); } catch (e) { } try { bots && bots.event('end', { res, win }); } catch (e) { } try { const rb0 = window.ChessLearn ? ChessLearn.rate().r : 0, md = window.ChessBots ? ChessBots.mode() : 'elo'; finishInfo.rb = rb0; finishInfo.md = md; window.ChessLearn && ChessLearn.finished({ res, win, elo, mode: md }); } catch (e) { }
      const g = AN().GS.add({ white: names()[0] === 'You' ? 'You' : 'Moundshroud (' + elo + ')', black: names()[1] === 'You' ? 'You' : 'Moundshroud (' + elo + ')', result: res, moves: hist.map(h => h.u), startFen: sfen !== C.START ? sfen : undefined, human, elo, src: 'moundshroud', event: 'Game vs Moundshroud', date: new Date(started || Date.now()).toISOString(), reason: txt }); ls.set('chesslastid', g.id); try { if (window.ChessProfile) { const md = finishInfo.md || 'elo', rb0 = finishInfo.rb || 0; ChessProfile.log({ gid: g.id, kind: md === 'elo' ? 'bot' : md, opp: window.ChessBots ? ChessBots.cur(elo).n : 'Moundshroud', oe: md === 'elo' ? elo : rb0, c: human, r: ChessProfile.resOf(res, human), how: ChessProfile.howOf(txt), p: hist.length, tc: tc || 'none', op: ChessProfile.openingOf(hist.map(h => h.u)), rt: true, rb: rb0, friendly: (window.ChessNeg ? ChessNeg.state().trust : .5) > .66, dur: Math.round((Date.now() - (started || Date.now())) / 1000) }); } } catch (e) { } try { ChessAch.event('game', { result: win ? 'win' : res === '1/2-1/2' ? 'draw' : 'loss', elo, human, plies: hist.length, mate: /^Checkmate/.test(txt), timed: !!clock }); if (win) ChessFx.confetti(); } catch (e) { }
      if (win) { const nb = api.submit(elo); A.toast('You beat Moundshroud at ' + elo + '!' + (nb ? ' New best.' : ''), 4500); } api.hud('Moundshroud ' + elo); refresh();
    };
    const check = () => {
      try { live && live.update(); } catch (e) { }
      const l = gp.legal(), key = gp.key(); let rep = 0; hist.forEach(h => { if (h.key === key) rep++; }); const mine = gp.side === human;
      if (!l.length) { if (gp.inCheck()) { const humanWon = gp.side !== human; return finish('Checkmate - ' + (humanWon ? 'you win!' : 'Moundshroud wins.'), humanWon === (human > 0) ? '1-0' : '0-1', humanWon); } return finish('Stalemate - a draw.', '1/2-1/2'); }
      if (gp.insufficient()) return finish('Draw - not enough pieces to mate.', '1/2-1/2'); if (gp.half >= 100) return finish('Draw - fifty-move rule.', '1/2-1/2'); if (rep >= 2) return finish('Draw - threefold repetition.', '1/2-1/2');
      status(mine ? (gp.inCheck() ? 'Check! Your move.' : 'Your move') : 'Moundshroud is thinking...', gp.inCheck() ? 'var(--bad)' : ''); refresh(); if (!mine) engineMove(); return true;
    };
    const play = (m, think) => { const l = gp.legal(), san = gp.san(m, l), f = m & 63, t = (m >> 6) & 63, u = gp.uci(m); const mover = gp.side, before = gp.fen(); if (mover === human) { try { window.ChessLearn && ChessLearn.learn(gp, m, hist.length); } catch (e) { } } gp.make(m); hist.push({ u, san, f, t, key: gp.key() }); try { ChessAch.event('move', { san, mine: mover === human, ply: hist.length }); } catch (e) { } if (clock) { clock[mover > 0 ? 'w' : 'b'] += clock.inc; clock.last = performance.now(); } view = null; save(); try { bots && bots.event('move', { san, mine: mover === human, u, before }); } catch (e) { } check(); };
    const engineMs = () => { if (!clock) return elo >= 3000 ? 5000 : AN() && elo >= 1800 ? 3000 : 1600; const mine = clock[gp.side > 0 ? 'w' : 'b']; return Math.max(250, Math.min(elo >= 3000 ? 6000 : elo >= 1800 ? 3500 : 2000, mine * 1000 / 25 + clock.inc * 300)); };
    const bookMove = () => {
      if (!window.ChessSet || ChessSet.experience() === 'legacy' || !ChessSet.openingBook() || sfen !== C.START || !AN() || !AN().LINES) return null;
      const played = hist.map(h => h.san), choices = new Map();
      for (const [, line] of AN().LINES) {
        if (line.length <= played.length || !played.every((san, i) => line[i] === san)) continue;
        const san = line[played.length]; choices.set(san, (choices.get(san) || 0) + 1);
      }
      const legal = gp.legal(), candidates = [];
      for (const [san, weight] of choices) { const m = legal.find(x => gp.san(x, legal) === san); if (m !== undefined) for (let i = 0; i < weight; i++) candidates.push(m); }
      return candidates.length ? candidates[Math.random() * candidates.length | 0] : null;
    };
    const engineMove = () => {
      const my = ++token; thinking = true; refresh(); const fen = gp.fen(), ms = engineMs(), t0 = performance.now();
      const done = mv => { if (my !== token || over || dead) return; thinking = false; const l = gp.legal(); if (!l.length) return check(); const m = l.find(x => x === mv) ?? l[0]; const wait = Math.max(0, (elo < 1000 ? 500 : 250) - (performance.now() - t0)); setTimeout(() => { if (my === token && !over && !dead) play(m); }, wait); };
      const bm = bookMove(); if (bm !== null) { done(bm); return; }
      const dflt = () => eng.ask({ fen, elo, ms, style: window.ChessBots && ChessBots.style ? ChessBots.style(elo) : undefined }).then(r => { try { if (r && typeof r.score === 'number' && bots) bots.event('score', { score: r.score }); } catch (e) { } done(r && r.move); }).catch(() => done(null));
      if (window.ChessLearn) ChessLearn.choose({ gp, eng, elo, human, hist, ms }).then(r => { if (r && r.move) { if (r.note) { try { ChessBots.say(r.note, 100); } catch (e) { } } done(r.move); } else dflt(); }).catch(dflt); else dflt();
    };
    function startClock() {
      clearInterval(tick); if (!clock) return; lastTick = performance.now();
      tick = setInterval(() => { if (over || dead || hist.length < 1) return; const now = performance.now(), dt = (now - lastTick) / 1000; lastTick = now; const k = clockKey(); clock[k] -= dt; bars(); if (k === (human > 0 ? 'w' : 'b') && clock[k] > 0 && clock[k] <= 10 && Math.ceil(clock[k]) !== board._low) { board._low = Math.ceil(clock[k]); try { ChessSet.sound('low'); } catch (e) { } } if (clock[k] <= 0) { clock[k] = 0; const humanFlag = (k === 'w' ? 1 : -1) === human; finish('Time is up - ' + (humanFlag ? 'Moundshroud wins on time.' : 'you win on time!'), k === 'w' ? '0-1' : '1-0', !humanFlag); } }, 250);
    }
    const newGame = (moves, ck, resume) => {
      if (!moves && !resume) { try { ChessSet.sound('start'); } catch (e) { } }
      token++; eng.reset(); clearInterval(tick); gp = new C.Pos().setFen(sfen); hist = []; over = false; thinking = false; view = null; result = '*'; drawDeclined = 0; started = moves ? (started || (saved && saved.started) || Date.now()) : Date.now();
      tc = resume ? saved.tc || 'none' : $p('ptc').value; $p('ptc').value = tc; const parts = tc === 'none' ? null : tc.split('+').map(Number); const old = ck || (resume && saved.clock ? saved.clock : null); clock = parts ? (moves && old ? Object.assign({}, old) : { w: parts[0], b: parts[0], inc: parts[1], total: parts[0], active: 'w', last: 0 }) : null;
      if (clock) { if (!clock.total) clock.total = parts ? parts[0] : clock.w; if (!clock.active) clock.active = 'w'; }
      if (moves) { for (const u of moves) { const m = gp.fromUci(u); if (!m) break; const l = gp.legal(), san = gp.san(m, l); hist.push({ u, san, f: m & 63, t: (m >> 6) & 63, key: (gp.make(m), gp.key()) }); } }
      else { const v = +$p('pcol').value; human = v || (Math.random() < .5 ? 1 : -1); flipped = human < 0; }
      $p('pcol').value = String(human); $p('pelo').value = elo; $p('pelot').value = elo; api.hud('Moundshroud ' + elo); save(); refresh(); try { bots && bots.event(moves ? 'resume' : 'start'); } catch (e) { }
      if (hist.length >= 1) startClock(); if (!over) check();
    };
    board.onmove = async m => { if (over || thinking || view !== null || gp.side !== human) return; if (window.ChessLive && ChessLive.cfg.on && ChessLive.cfg.guard) { const msg = ChessLive.guard(gp.fen(), gp.uci(m)); if (msg && !(await A.confirm(msg + ' Play it anyway?'))) return; } const first = hist.length === 0; play(m); if (first || hist.length === 1) startClock(); };
    $p('pml').onclick = e => { if (e.target.closest('[data-live]')) { view = null; refresh(); return; } const s = e.target.closest('[data-i]'); if (!s) return; const i = +s.dataset.i; view = i >= hist.length ? null : i; refresh(); };
    $p('pnew').onclick = async () => { if (!over && hist.length > 1 && !(await A.confirm('Start a new game? The current one will be lost.'))) return; sfen = C.START; newGame(); };
    $p('pckd').onclick = () => { try { ChessClock.choose(); } catch (e) { A.toast('The clock designs could not be opened.', 4000); } };
    $p('pelo').oninput = () => { if (window.ChessBots && !ChessBots._setting && ChessBots.mode() !== 'elo') ChessBots.setMode('elo'); elo = +$p('pelo').value; $p('pelot').value = elo; $p('pel').textContent = elo >= 3200 ? '3200 · full strength' : elo; $p('plv').textContent = lname(elo); api.hud('Moundshroud ' + elo); bars(); save(); if (bots) bots.head(); };
    $p('pcol').onchange = () => { if (hist.length === 0 || over) newGame(); };
    $p('ptc').onchange = () => { if (hist.length === 0 || over) newGame(); else { $p('ptc').value = tc; A.toast('The clock is chosen when a game starts.'); } };
    $p('pflip').onclick = () => { flipped = !flipped; save(); refresh(); };
    $p('pundo').onclick = () => { if (!hist.length || thinking) return; token++; eng.reset(); thinking = false; const n = hist.length && gp.side === human ? 2 : 1; const keep = hist.slice(0, Math.max(0, hist.length - (over ? (gp.side === human ? 2 : 1) : n))).map(h => h.u); newGame(keep, clock || undefined); status('Move taken back'); };
    $p('phint').onclick = async () => { if (over || thinking || gp.side !== human || view !== null) return; status('Thinking about a hint...'); const r = await eng.ask({ cmd: 'ana', fen: gp.fen(), depth: 5, ms: 2500 }); if (r && r.best) { const m = gp.fromUci(r.best); board.marks = {}; board.marks[m & 63] = 'hint'; board.marks[(m >> 6) & 63] = 'hint'; board.draw(); status('Hint: the blue squares show a strong move.'); } };
    $p('pres').onclick = async () => { if (over || !hist.length) return; if ((await A.confirm('Resign this game?'))) finish('You resigned. Moundshroud wins.', human > 0 ? '0-1' : '1-0'); };
    $p('pdraw').onclick = async () => {
      if (over || thinking || gp.side !== human || hist.length < 2) return; status('Moundshroud is considering your draw offer...'); const r = await eng.ask({ cmd: 'ana', fen: gp.fen(), depth: 4, ms: 1200 });
      const engineEval = r ? -r.bs : 0; if (hist.length >= 30 && engineEval < 40 || drawDeclined >= 0 && engineEval < -150) finish('Draw agreed.', '1/2-1/2'); else { drawDeclined++; status('Moundshroud declines the draw offer.'); }
    };
    $p('pana').onclick = () => { if (!hist.length) return A.toast('Play a move first.'); const g = AN().GS.add({ white: names()[0] === 'You' ? 'You' : 'Moundshroud (' + elo + ')', black: names()[1] === 'You' ? 'You' : 'Moundshroud (' + elo + ')', result: over ? result : '*', moves: hist.map(h => h.u), startFen: sfen !== C.START ? sfen : undefined, human, elo, src: 'moundshroud', event: 'Game vs Moundshroud', date: new Date(started || Date.now()).toISOString() }); U().pending = { id: g.id }; ctx.show('analysis'); };
    $p('pcopy').onclick = () => { if (!hist.length) return; A.copy(pgn()); };
    $p('pdl').onclick = () => { if (!hist.length) return; const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([pgn()], { type: 'application/x-chess-pgn' })); a.download = 'moundshroud-game-' + new Date().toISOString().slice(0, 10) + '.pgn'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); };
    /* a position handed over to play from (ChessUI.playFrom = { fen, human }) starts a fresh game from it */
    const pf = UI2().playFrom; UI2().playFrom = null;
    if (pf && pf.fen) { try { new C.Pos().setFen(pf.fen); sfen = pf.fen; human = pf.human || 1; flipped = human < 0; $p('pcol').value = String(human); newGame(); A.toast('Playing from the scanned position. You are ' + (human > 0 ? 'White' : 'Black') + '.'); } catch (e) { A.toast('That position could not be set up.'); newGame(); } }
    else if (saved && saved.moves && saved.moves.length) { human = saved.human; flipped = !!saved.flipped; newGame(saved.moves, null, true); if (hist.length && !over && clock) startClock(); } else newGame();
    return () => { dead = true; token++; clearInterval(tick); if (eng) eng.kill(); if (bots) bots.destroy(); board.destroy(); };
  };
})();

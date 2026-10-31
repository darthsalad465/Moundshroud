// Learning chess bots: Echo (the Mirror) learns YOUR style and plays the way you would; Rival (the Elo twin) plays like a human at your rating.
// Everything is local. Style = how often you pick captures, checks, castling, centre moves, developing moves and so on, compared with how often those were available.
// A move chooser combines the engine's scores with that style (or a human error model), then honours any deals made in chat (see chess-neg.js).
(() => {
  const C = Chess, KEY = 'chlearn', RKEY = 'chrate';
  const FEAT = ['cap', 'chk', 'castle', 'pawn', 'knight', 'bishop', 'rook', 'queen', 'king', 'center', 'forward', 'retreat', 'dev', 'earlyQ', 'edgeP', 'trade', 'risk', 'double', 'kside'];
  const SAY = { cap: ['takes pieces whenever it can', 'rarely grabs material'], chk: ['loves giving checks', 'rarely gives checks'], castle: ['castles early', 'delays castling'], pawn: ['pushes pawns often', 'prefers pieces to pawns'], knight: ['favours knight moves', 'rarely moves knights'], bishop: ['loves bishops', 'rarely moves bishops'], rook: ['activates rooks often', 'keeps rooks at home'], queen: ['brings the queen out a lot', 'keeps the queen quiet'], king: ['moves the king often', 'keeps the king still'], center: ['fights for the centre', 'plays on the wings'], forward: ['advances pieces boldly', 'plays cautiously'], retreat: ['retreats pieces readily', 'seldom retreats'], dev: ['develops pieces fast', 'develops slowly'], earlyQ: ['plays an early queen', 'keeps the queen back early'], edgeP: ['uses the edge pawns', 'avoids edge pawns'], trade: ['trades pieces willingly', 'avoids trades'], risk: ['leaves pieces en prise (daring)', 'keeps every piece protected'], double: ['likes two-square pawn pushes', 'prefers single pawn steps'], kside: ['attacks on the kingside', 'plays on the queenside'] };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), rnd = (a, b) => a + Math.random() * (b - a), sleep = ms => new Promise(r => setTimeout(r, ms));

  /* ---------- features of a move (computed before it is played) ---------- */
  const feats = (pos, m, ply) => {
    const fr = m & 63, to = (m >> 6) & 63, p = pos.b[fr], t = Math.abs(p), s = p > 0 ? 1 : -1, tgt = pos.b[to], f = {};
    const cap = !!tgt || (t === 1 && (fr & 7) !== (to & 7)), rf = 8 - (fr >> 3), rt = 8 - (to >> 3), file = to & 7, castle = t === 6 && Math.abs((to & 7) - (fr & 7)) === 2;
    f.cap = cap; f.pawn = t === 1; f.knight = t === 2; f.bishop = t === 3; f.rook = t === 4; f.queen = t === 5; f.king = t === 6 && !castle; f.castle = castle;
    f.center = (file === 3 || file === 4) && (rt === 4 || rt === 5); f.forward = t !== 1 && (rt - rf) * s >= 1; f.retreat = t !== 1 && (rt - rf) * s <= -1;
    f.dev = (t === 2 || t === 3) && rf === (s > 0 ? 1 : 8) && ply < 30; f.earlyQ = t === 5 && ply < 14; f.edgeP = t === 1 && ((fr & 7) === 0 || (fr & 7) === 7); f.double = t === 1 && Math.abs(rt - rf) === 2; f.kside = file >= 5;
    pos.make(m); f.chk = pos.inCheck(); f.trade = cap && !!pos.attacked(to, -s); f.risk = !cap && t > 1 && !!pos.attacked(to, -s) && !pos.attacked(to, s); pos.unmake();
    return f;
  };

  /* ---------- orientation-free position keys: Black positions are flipped so both colours share one memory ---------- */
  const canonFen = fen => {
    const [pl, side, cas, ep] = fen.split(' '); const order = c => 'KQkq'.indexOf(c);
    if (side === 'w') return pl + ' w ' + cas + ' ' + ep;
    const sw = ch => /[a-z]/.test(ch) ? ch.toUpperCase() : /[A-Z]/.test(ch) ? ch.toLowerCase() : ch;
    const rows = pl.split('/').reverse().map(r => r.split('').map(sw).join('')), c2 = cas === '-' ? '-' : cas.split('').map(sw).sort((a, b) => order(a) - order(b)).join('');
    return rows.join('/') + ' w ' + c2 + ' ' + (ep === '-' ? '-' : ep[0] + (9 - ep[1]));
  };
  const flipUci = u => u[0] + (9 - u[1]) + u[2] + (9 - u[3]) + (u[4] || '');

  /* ---------- the learned profile ---------- */
  let P = null, saveT = 0;
  const fresh = () => ({ n: 0, games: 0, ch: {}, ex: {}, book: {}, seen: {}, fid: 70 });
  const load = () => { if (P) return P; try { P = Object.assign(fresh(), JSON.parse(ls.get(KEY, '{}'))); } catch (e) { P = fresh(); } return P; };
  const save = () => { clearTimeout(saveT); saveT = setTimeout(() => { try { const p = load(), k = Object.keys(p.book); if (k.length > 3000) k.slice(0, k.length - 3000).forEach(x => delete p.book[x]); ls.set(KEY, JSON.stringify(p)); } catch (e) { } }, 400); };
  const learn = (pos, m, ply) => {
    try {
      const p = load(), legal = pos.legal(); if (!legal.length) return; const all = legal.map(x => feats(pos, x, ply)), mine = feats(pos, m, ply);
      for (const f of FEAT) { p.ch[f] = (p.ch[f] || 0) + (mine[f] ? 1 : 0); p.ex[f] = (p.ex[f] || 0) + all.filter(a => a[f]).length / all.length; }
      p.n++; try { window.ChessAch && ChessAch.event('learn'); } catch (e) { } const fen = pos.fen(), k = canonFen(fen), u = pos.uci(m), cu = fen.split(' ')[1] === 'b' ? flipUci(u) : u; (p.book[k] = p.book[k] || {})[cu] = ((p.book[k] || {})[cu] || 0) + 1; save();
    } catch (e) { }
  };
  const weights = () => { const p = load(), conf = p.n / (p.n + 40), w = {}; for (const f of FEAT) w[f] = Math.log(((p.ch[f] || 0) + 1.5) / ((p.ex[f] || 0) + 1.5)) * conf; return w; };
  const styleScore = (f, w) => { let s = 0; for (const k of FEAT) if (f[k]) s += w[k]; return clamp(s, -2.2, 2.2); };
  const bootstrap = () => {
    const p = load(); let added = 0;
    try { const AN = window.ChessAna; const list = AN && AN.GS ? AN.GS.list() : []; for (const g of list) { if (!g || !g.moves || !g.human || p.seen[g.id]) continue; p.seen[g.id] = 1; const pos = new C.Pos().setFen(C.START); let i = 0; for (const u of g.moves) { const m = pos.fromUci(u); if (!m) break; if (pos.side === g.human) { learn(pos, m, i); added++; } pos.make(m); i++; } p.games++; } } catch (e) { }
    if (added) save(); return added;
  };
  const summary = () => {
    const p = load(), w = weights(), conf = p.n / (p.n + 40), rows = FEAT.map(f => ({ f, v: w[f], lift: ((p.ch[f] || 0) + 1.5) / ((p.ex[f] || 0) + 1.5) })).filter(x => Math.abs(x.v) > .05).sort((a, b) => Math.abs(b.v) - Math.abs(a.v)).slice(0, 6);
    return { n: p.n, games: p.games, conf, traits: rows.map(r => ({ text: SAY[r.f][r.v > 0 ? 0 : 1], pct: Math.round(Math.abs(r.lift - 1) * 100), up: r.v > 0, f: r.f })), book: Object.keys(p.book).length };
  };
  const resetLearning = () => { P = fresh(); try { ls.set(KEY, JSON.stringify(P)); } catch (e) { } };

  /* ---------- your estimated rating ---------- */
  const rateGet = () => { try { const r = JSON.parse(ls.get(RKEY, 'null')); if (r && r.r) return r; } catch (e) { } let pz = 1000; try { pz = JSON.parse(ls.get('chstudy', '{}')).puz.rating || 1000; } catch (e) { } return { r: clamp(Math.round(pz), 500, 2300), n: 0, from: 'puzzles' }; };
  const rateSet = v => { const o = rateGet(); o.r = clamp(Math.round(v), 400, 2600); o.manual = 1; ls.set(RKEY, JSON.stringify(o)); };
  /* Tide, the adaptive bot you can beat: its skill (0 to 1) drifts up when you win and down when you lose */
  const TKEY = 'chtide', tideGet = () => { try { const t = JSON.parse(ls.get(TKEY, 'null')); if (t && typeof t.s === 'number') return t; } catch (e) { } return { s: .5, n: 0, w: 0, l: 0, d: 0 }; };
  const tideSet = t => { try { ls.set(TKEY, JSON.stringify(t)); } catch (e) { } };
  const finished = d => { try { if (d.mode === 'tide') { const t = tideGet(), dr = d.res === '1/2-1/2'; t.s = clamp(t.s + (d.win ? .1 : dr ? .02 : -.1), .05, 1); t.n++; if (d.win) t.w++; else if (dr) t.d++; else t.l++; tideSet(t); } } catch (e) { } try { const o = rateGet(), opp = d.mode && d.mode !== 'elo' ? o.r : d.elo, exp = 1 / (1 + Math.pow(10, (opp - o.r) / 400)), sc = d.win ? 1 : d.res === '1/2-1/2' ? .5 : 0, K = o.n < 10 ? 40 : 24; o.r = clamp(Math.round(o.r + K * (sc - exp)), 400, 2600); o.n++; delete o.from; ls.set(RKEY, JSON.stringify(o)); } catch (e) { } };

  /* ---------- picking a move ---------- */
  const softPick = (items, tau) => { const mx = Math.max(...items.map(i => i.v)), w = items.map(i => Math.exp((i.v - mx) / tau)), sum = w.reduce((a, b) => a + b, 0); let r = Math.random() * sum; for (let i = 0; i < items.length; i++) { r -= w[i]; if (r <= 0) return items[i]; } return items[0]; };
  const PRIOR = { cap: .3, chk: .2, castle: .45, dev: .35, center: .3, king: -.45, earlyQ: -.45, edgeP: -.2, retreat: -.15, risk: -.4, forward: .05 };
  const tauFor = r => clamp((2500 - r) / 14, 25, 150);
  const lastBest = { v: 0 };

  async function choose(c) {
    const BOT = window.ChessBots, NG = window.ChessNeg, mode = c.mode || (BOT ? BOT.mode() : 'elo'), pos = c.gp;
    const dealState = NG ? NG.state() : { deals: [] }, needs = mode !== 'elo' || (NG && NG.needsScores());
    if (!needs) return null;
    // when Stockfish is the engine, online opponents play with Stockfish limited to their own Elo (unless a deal needs the move scores)
    if (mode === 'twin' && !(dealState.deals && dealState.deals.length) && window.ChessSF && ChessSF.ready() && (c.rate || c.elo || 0) >= 1320) return null;
    const legal = pos.legal(); if (legal.length < 2) return null; const ply = c.hist.length, rate = c.rate || rateGet().r;
    const deep = mode === 'draw' || mode === 'tide';
    const r = await c.eng.ask({ cmd: 'eval', fen: pos.fen(), depth: deep ? 5 : 4, ms: Math.min(c.ms || 1500, deep ? 3000 : 2200) }); if (!r || !r.scores || !r.scores.length) return null;
    const sc = r.scores.slice().sort((a, b) => b[1] - a[1]), best = sc[0][1]; lastBest.v = best; if (NG) NG.setEval(best, pos.side, c.human);
    /* Equinox: always plays the move that brings the position back to equal (a score as near 0 as it can get). If it is the one in trouble it simply plays its best move. */
    if (mode === 'draw') {
      const quiet = sc.filter(x => x[1] > -20 && x[1] < C.MATE - 100); let pick; const ply = c.hist.length;
      if (best <= -20 || !quiet.length) pick = sc[0]; else if (best <= 35) { const ok = sc.filter(x => x[1] >= best - 15).map(x => ({ x, v: ply < 14 ? (() => { let q = 0; const f = feats(pos, x[0], ply); for (const k in PRIOR) if (f[k]) q += PRIOR[k]; return q; })() : 0 })); const top = Math.max(...ok.map(o => o.v)), good = ok.filter(o => o.v >= top - .1); pick = good[Math.random() * good.length | 0].x; } else { const mn = Math.min(...quiet.map(x => Math.abs(x[1]))), near = quiet.filter(x => Math.abs(x[1]) <= mn + 8); pick = near[Math.random() * near.length | 0]; }
      await sleep(c.sleep !== undefined ? c.sleep : rnd(300, 900)); return { move: pick[0], note: best - pick[1] > 150 && Math.random() < .5 ? 'Let us even this out.' : null };
    }
    /* Tide: adapts to how you are doing, but can win or lose. Strong when you are ahead, gentle when it is crushing you, otherwise it plays near its current skill level. */
    if (mode === 'tide') {
      const T = tideGet(), s = T.s; if (best > C.MATE - 100 && Math.random() < .45 + s * .5) return { move: sc[0][0] };
      let maxLoss = clamp(380 - s * 330, 40, 380), tau = clamp(150 - s * 125, 20, 150), pool = sc.filter(x => best - x[1] <= maxLoss), note = null;
      if (best <= -150) { maxLoss = Math.min(maxLoss, 50); tau = Math.min(tau, 30); pool = sc.filter(x => best - x[1] <= maxLoss); }
      else if (best >= 350 && best < C.MATE - 100) { const easy = sc.filter(x => x[1] >= 120 && x[1] <= best - 80 && best - x[1] <= 450); if (easy.length) { pool = easy; note = Math.random() < .25 ? 'I will give you some air.' : null; } }
      if (!pool.length) pool = [sc[0]]; const op = ply < 14 ? 1 : 0, pr = f => { let q = 0; for (const x in PRIOR) if (f[x]) q += PRIOR[x]; return q * 140; };
      const pick = softPick(pool.map(x => ({ m: x[0], v: x[1] + (op ? pr(feats(pos, x[0], ply)) : 0) })), tau);
      await sleep(c.sleep !== undefined ? c.sleep : rnd(350, 1100)); return { move: pick.m, note };
    }
    const gentle = NG && NG.has('gentle'), serious = NG && NG.has('serious');
    if (best > C.MATE - 100 && !gentle) return { move: sc[0][0] };
    let note = null;
    /* 1. a promised move */
    const dm = NG ? NG.takeMoveDeal(pos) : null;
    if (dm) {
      if (dm.forget) note = dm.forget;
      else { const mv = NG.resolve(dm.deal.spec, pos, legal); if (!mv) { NG.broke(dm.deal); note = 'I wanted to keep my word, but ' + dm.deal.spec.label + ' is no longer possible. I will play my own move.'; } else { const ent = sc.find(x => x[0] === mv), loss = ent ? best - ent[1] : 9999; if (loss <= NG.allowedLoss(dm.deal)) { NG.done(dm.deal); return { move: mv, note: 'A deal is a deal: ' + pos.san(mv, legal) + '.' }; } NG.broke(dm.deal); note = 'Sorry, after your move ' + pos.san(mv, legal) + ' would lose too much. The deal is off.'; } }
    }
    /* 2. style / human model */
    let tau, maxLoss, bonus = () => 0, blunderP = 0, wts = null;
    if (mode === 'mirror') { wts = weights(); const fid = clamp(load().fid, 0, 100) / 100; tau = tauFor(rate) * (1.15 - fid * .5); maxLoss = clamp((2300 - rate) / 7.5, 90, 250); const book = bookMoves(pos); if (book && Math.random() < .35 + fid * .6) { const ok = book.filter(b => { const e = sc.find(x => x[0] === b.m); return e && best - e[1] <= maxLoss; }); if (ok.length) { const tot = ok.reduce((a, b) => a + b.n, 0); let q = Math.random() * tot, pk = ok[0]; for (const b of ok) { q -= b.n; if (q <= 0) { pk = b; break; } } return { move: pk.m, note, why: 'book' }; } } const cf = load().n / (load().n + 40), kk = clamp(1.25 - rate / 2800, .35, 1); bonus = f => { let pr = 0; for (const x in PRIOR) if (f[x]) pr += PRIOR[x]; return styleScore(f, wts) * 60 * (.4 + fid * .9) + (1 - cf) * pr * 110 * kk; }; }
    else if (mode === 'twin' || mode === 'trainer') { tau = tauFor(rate); maxLoss = clamp((2400 - rate) / 6.5, 110, 300); blunderP = clamp((2300 - rate) / 7000, .012, .2); const k = clamp(1.25 - rate / 2800, .35, 1); bonus = f => { let s = 0; for (const x in PRIOR) if (f[x]) s += PRIOR[x]; return s * 110 * k; }; }
    else { tau = tauFor(c.elo || 1400); maxLoss = clamp((2600 - (c.elo || 1400)) / 5, 60, 360); }
    if (gentle) { tau *= 1.8; maxLoss += 140; blunderP = Math.max(blunderP, .1); } if (serious) { tau *= .5; maxLoss = Math.min(maxLoss, 90); blunderP = 0; }
    /* the first moves: from about 700 up people play the opening sensibly (develop, centre, castle), so keep the choice sharp and sound there */
    const orate = mode === 'elo' ? (c.elo || 1400) : rate, openN = orate >= 700 ? clamp(6 + Math.round((orate - 700) / 200), 6, 12) : 3;
    /* online players below about 1800 still make opening slips; the chance of playing a sound opening move rises with rating (about 10% at 1000, 80% at 1800) */
    const pSound = mode === 'twin' ? clamp((orate - 900) / 1100, .05, .97) : 1;
    if (mode !== 'mirror' && ply < openN && !gentle && Math.random() < pSound) { tau = Math.min(tau, 35); maxLoss = Math.min(maxLoss, 80); blunderP = 0; const b0 = bonus; bonus = f => b0(f) * 1.4; }
    const extra = NG ? NG.bonusFn() : null;
    /* Trainer (chess-trainer.js): it wants the game in the positions where you lose points. nudge is the move of your own
       weak line; bonus is a gentle pull towards the kind of position it is teaching (a trade, a tension, development).
       Both go through maxLoss below, so the Trainer can steer without ever giving the game away. */
    const TR = mode === 'trainer' && window.ChessTrainer ? window.ChessTrainer : null;
    const tn = TR ? TR.nudge(pos, ply) : null;
    const items = sc.map(([m, s]) => { const f = feats(pos, m, ply); return { m, loss: best - s, v: clamp(s, -1500, 1500) + bonus(f) + (extra ? extra(f, m, pos) : 0) + (tn && m === tn ? 400 : 0) + (TR ? (TR.bonus(f, pos, ply) || 0) : 0) }; }).filter(x => x.loss <= maxLoss || x === undefined);
    if (!items.length) return { move: sc[0][0], note };
    let pick;
    if (blunderP && Math.random() < blunderP) { const weak = sc.slice(2, 9).map(([m, s]) => ({ m, loss: best - s, v: s })).filter(x => x.loss >= 120 && x.loss <= 520); pick = weak.length ? weak[Math.random() * weak.length | 0] : softPick(items, tau); } else pick = softPick(items, tau);
    await sleep(c.sleep !== undefined ? c.sleep : rnd(350, mode === 'twin' ? 1900 : 900));
    return { move: pick.m, note };
  }
  const bookMoves = pos => { try { const p = load(), fen = pos.fen(), e = p.book[canonFen(fen)]; if (!e) return null; const black = fen.split(' ')[1] === 'b', legal = pos.legal(), out = []; for (const cu in e) { const u = black ? flipUci(cu) : cu, m = pos.fromUci(u, legal); if (m) out.push({ m, n: e[cu] }); } return out.length ? out : null; } catch (e) { return null; } };

  window.ChessLearn = { tide: tideGet, resetTide: () => tideSet({ s: .5, n: 0, w: 0, l: 0, d: 0 }), choose, learn, bootstrap, summary, resetLearning, rate: rateGet, setRate: rateSet, finished, feats, FEAT, profile: load, canonFen, flipUci, fid: v => { const p = load(); if (v !== undefined) { p.fid = clamp(+v, 0, 100); save(); } return p.fid; }, lastBest };
})();

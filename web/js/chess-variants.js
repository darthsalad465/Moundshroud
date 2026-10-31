// Chess variants for the Online simulator: Chess960 (Fischer Random, with real 960 castling in the engine), Three-check and King of the Hill.
// A variant provides a start position, an extra way to win checked after every move, a badge for the player bars, and a small helper that stops the computer
// opponent from missing a win or walking into one (the engine itself plays ordinary chess, so this keeps it sensible in the variants).
(() => {
  const C = window.Chess; if (!C) return;
  const CENTRE = [27, 28, 35, 36];                                  // d5 e5 d4 e4
  const rnd = n => Math.floor(Math.random() * n);
  /* Chess960: bishops on opposite colours, king between the rooks */
  function random960() {
    const r = Array(8).fill(''), free = () => r.map((x, i) => x ? -1 : i).filter(i => i >= 0), put = (i, c) => { r[i] = c; };
    put([1, 3, 5, 7][rnd(4)], 'b'); put([0, 2, 4, 6][rnd(4)], 'b'); let f = free(); put(f[rnd(f.length)], 'q'); f = free(); const a = f.splice(rnd(f.length), 1)[0]; const b = f.splice(rnd(f.length), 1)[0]; put(a, 'n'); put(b, 'n'); f = free(); put(f[0], 'r'); put(f[1], 'k'); put(f[2], 'r');
    const row = r.join(''), files = 'abcdefgh', rooks = r.map((x, i) => x === 'r' ? files[i] : '').join('');
    return row + '/pppppppp/8/8/8/8/PPPPPPPP/' + row.toUpperCase() + ' w ' + rooks.toUpperCase() + rooks + ' - 0 1';
  }
  const checksOf = (S, upto) => { const cnt = { w: 0, b: 0 }; const p = new C.Pos().setFen(S.startFen || C.START); const n = upto == null ? S.hist.length : upto; for (let i = 0; i < n; i++) { const m = p.fromUci(S.hist[i].u); if (m === null || m === undefined) break; const mover = p.side; p.make(m); if (p.inCheck()) cnt[mover > 0 ? 'w' : 'b']++; } return cnt; };
  const vxCheck = gp => { try { const r = gp.result && gp.result(); if (!r) return null; return r.draw ? { draw: true, txt: r.txt } : { win: true, winner: r.winner, txt: r.txt }; } catch (e) { return null; } };
  const V = {
    std: { id: 'std', name: 'Standard chess', icon: '♟', desc: 'The normal game.' },
    '960': { id: '960', name: 'Chess960 (Fischer Random)', icon: '🎲', desc: 'The back rank is shuffled (960 possible starts). Castle by moving your king onto your own rook.', start: random960, hint: 'Chess960: the back rank is shuffled. To castle, move your king onto your own rook (the king and rook end up on the usual squares).' },
    '3check': { id: '3check', name: 'Three-check', icon: '✚', desc: 'Give check three times to win, or checkmate as usual.', hint: 'Three-check: you win by giving check three times (or by checkmate).',
      check(gp, S, mover) { const c = checksOf(S); if (c[mover > 0 ? 'w' : 'b'] >= 3) return { win: true, txt: 'third check' }; return null; },
      badge(S, side) { const c = checksOf(S); return '<span class="small" style="margin-left:8px;color:var(--warn)" title="Checks given (3 wins)">✚ ' + c[side > 0 ? 'w' : 'b'] + '/3</span>'; },
      wins(gp, S, who) { const c = checksOf(S); return c[who > 0 ? 'w' : 'b'] >= 2 && gp.inCheck(); } },
    koth: { id: 'koth', name: 'King of the Hill', icon: '⛰️', desc: 'Move your king to one of the four centre squares to win, or checkmate as usual.', hint: 'King of the Hill: you win by getting your king to d4, e4, d5 or e5 (or by checkmate).',
      check(gp, S, mover) { return CENTRE.includes(gp.ksq[mover > 0 ? 0 : 1]) ? { win: true, txt: 'king reached the hill' } : null; },
      badge() { return '<span class="small" style="margin-left:8px;color:var(--warn)" title="Reach d4, e4, d5 or e5 with your king">⛰️</span>'; },
      wins(gp, S, who) { return CENTRE.includes(gp.ksq[who > 0 ? 0 : 1]); } },
    atomic: { id: 'atomic', vx: 1, name: 'Atomic', icon: '💥', desc: 'Every capture explodes: the capturing piece, the captured piece and all non-pawn pieces next to it disappear. Blow up the enemy king to win. Kings cannot capture and are never in check next to each other.', hint: 'Atomic: captures explode and remove every non-pawn piece around the square. Explode the enemy king to win (and keep yours safe).', start() { return ChessVX.START.atomic; }, check: (gp) => vxCheck(gp) },
    anti: { id: 'anti', vx: 1, name: 'Antichess', icon: '🎭', desc: 'Capturing is compulsory and the goal is to lose all your pieces (or be stalemated). The king is an ordinary piece: there is no check and no castling.', hint: 'Antichess: if you can capture, you must. Lose all your pieces (or get stalemated) to win.', start() { return ChessVX.START.anti; }, check: (gp) => vxCheck(gp) },
    horde: { id: 'horde', vx: 1, name: 'Horde', icon: '🧟', desc: 'White has 36 pawns and no king; Black has the normal army. White wins by checkmating Black. Black wins by capturing every white piece.', hint: 'Horde: White has a wall of pawns. Black must capture them all; White must checkmate.', start() { return ChessVX.START.horde; }, check: (gp) => vxCheck(gp) },
    racing: { id: 'racing', vx: 1, name: 'Racing Kings', icon: '🏁', desc: 'No pawns, and nobody may give check. Be the first king to reach the eighth rank (if White arrives first, Black gets one more move to draw).', hint: 'Racing Kings: no checks allowed. Race your king to the top rank.', start() { return ChessVX.START.racing; }, check: (gp) => vxCheck(gp) },
    fog: { id: 'fog', name: 'Fog of War', icon: '🌫️', desc: 'You only see your own pieces and the squares they can move to. Hidden pieces appear when you get close. Normal chess rules apply, and the computer opponent plays at its normal strength (it is not blinded).', hint: 'Fog of War: squares you cannot reach are hidden. Scout with your pieces to find the enemy. (The computer opponent is not blinded.)' },
  };
  /* keep the computer from missing a win or allowing one on the next move */
  async function pick(v, gp, eng, mv, S) {
    if (!v.wins) return mv; const me = gp.side, legal = gp.legal(); if (!legal.length) return mv;
    for (const m of legal) { gp.make(m); let w = false; try { w = v.wins(gp, { hist: S.hist.concat([{ u: gp.uci ? '' : '' }]), startFen: S.startFen }, me, true); } catch (e) { } gp.unmake(); if (w && v.id === 'koth') return m; }
    // three-check wins need the history, so test them by replaying the move on a copy
    if (v.id === '3check') { for (const m of legal) { const hist = S.hist.concat([{ u: gp.uci(m) }]), c = checksOf({ startFen: S.startFen, hist }); if (c[me > 0 ? 'w' : 'b'] >= 3) return m; } }
    const bad = new Set();
    for (const m of legal) {
      const hist = S.hist.concat([{ u: gp.uci(m) }]); gp.make(m); const opp = gp.legal(); let danger = false;
      for (const r of opp) { if (v.id === 'koth') { gp.make(r); if (CENTRE.includes(gp.ksq[-me > 0 ? 0 : 1])) danger = true; gp.unmake(); } else { const h2 = hist.concat([{ u: gp.uci(r) }]); const c = checksOf({ startFen: S.startFen, hist: h2 }); if (c[-me > 0 ? 'w' : 'b'] >= 3) danger = true; } if (danger) break; }
      gp.unmake(); if (danger) bad.add(m);
    }
    if (!bad.has(mv)) return mv; let list = []; try { const r = await eng.ask({ cmd: 'eval', fen: gp.fen(), depth: 3, ms: 700 }); list = (r && r.scores ? r.scores : []).slice().sort((a, b) => b[1] - a[1]); } catch (e) { }
    for (const [m] of list) if (!bad.has(m) && legal.includes(m)) return m; return legal.find(m => !bad.has(m)) || mv;
  }
  window.ChessVariants = { list: [V.std, V['960'], V['3check'], V.koth, V.fog, V.atomic, V.anti, V.racing, V.horde], get: id => V[id] || V.std, pick, random960, checksOf, CENTRE };
})();

// Chess > Opponents > Learning bots > Trainer (🎯).
// The Trainer reads the games you have actually played and does two things with them:
//   1. It finds the thing that costs you the most points — an opening you score badly in, a tactic you keep missing
//      (forks, hanging pieces, captures you do not see) or an endgame you keep slipping in — and then it steers the game
//      into exactly those positions, so you meet your own weakness while it is still a game and not a lesson.
//   2. It turns the positions where you went wrong into puzzles of your own. They go into the normal puzzle trainer
//      ("Puzzles from: My puzzles"), with your rating, hints and everything else, so you can drill the exact moments.
// Nothing leaves this PC: the games, the engine's verdicts and the puzzles all live in the window's own storage.
(() => {
  const C = window.Chess, E = window.ChessSpecial; if (!C || !E) return;
  const AN = () => window.ChessAna, PROF = () => window.ChessProfile, PUZ = () => window.ChessUI && window.ChessUI.PZ;
  const esc2 = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const files = 'abcdefgh', sqName = s => files[s & 7] + (8 - (s >> 3));
  let cache = { t: 0, data: null };

  /* the kinds of mistake the Trainer can recognise, in the words it will use */
  const MOTIF = {
    capture: 'you miss captures that win material',
    fork: 'you miss forks and double attacks',
    mate: 'you miss forced mates',
    promotion: 'you miss pawns running to promotion',
    check: 'you miss forcing checks',
    hang: 'you leave pieces where they can be taken',
    'ignored threat': 'you do not answer your opponent’s threats',
    best: 'you miss the strongest move'
  };
  const SHORT = { capture: 'Missed a capture', fork: 'Missed a fork', mate: 'Missed a mate', promotion: 'Missed a promotion', check: 'Missed a check', hang: 'Left a piece loose', 'ignored threat': 'Ignored a threat', best: 'Missed the best move' };

  /* ---------- reading your games ---------- */
  const phaseOf = (fen, ply) => {
    if (ply < 16) return 'opening';
    const b = fen.split(' ')[0], big = (b.match(/[nbrqNBRQ]/g) || []).length;
    try { const p = new C.Pos().setFen(fen); if (p.insufficient()) return 'endgame'; } catch (e) { }
    return big <= 6 ? 'endgame' : 'middlegame';
  };

  /* why a move was the right one: the cheapest honest label for what the player failed to see */
  const motifOf = (fen, played, best, ply) => {
    try {
      if (!best) return 'best';
      const R = window.ChessReview, L = window.ChessLive, p = new C.Pos().setFen(fen), m = p.fromUci(best);
      if (!m && m !== 0) return 'best';
      const d = R && R.describe ? R.describe(fen, best, ply) : null, tags = (d && d.tags) || [];
      if (tags.includes('promotes')) return 'promotion';
      if (tags.includes('fork')) return 'fork';
      if (tags.includes('captures') && d && d.mat > 0) return 'capture';
      p.make(m); const mate = p.inCheck() && !p.legal().length; p.unmake();
      if (mate) return 'mate';
      if (tags.includes('check')) return 'check';
      if (tags.includes('saves')) return 'ignored threat';
      /* what the move you played allowed */
      if (L && L.threats) {
        const p2 = new C.Pos().setFen(fen), m2 = p2.fromUci(played);
        if (m2 || m2 === 0) { p2.make(m2); const th = L.threats(p2, p2.side).mine; if (th.length && th[0].gain >= 3) return 'hang'; }
      }
      return 'best';
    } catch (e) { return 'best'; }
  };

  const collect = (g, out) => {
    try {
      const rows = g.ana && g.ana.rows; if (!rows || !rows.length) return 0;
      const P = PROF(), name = P ? P.openingOf(g.moves) : '', human = g.human, opp = human > 0 ? (g.black || 'your opponent') : (g.white || 'your opponent');
      const pos = new C.Pos().setFen(g.startFen || C.START); let n = 0;
      for (let i = 0; i < g.moves.length; i++) {
        const mover = i % 2 === 0 ? 1 : -1, r = rows[i], fen = pos.fen();
        const m = pos.fromUci(g.moves[i]); if (!m && m !== 0) break;
        pos.make(m);
        if (mover !== human || !r || r.unk || !(r.dw >= 10) || !r.b) continue;
        const motif = motifOf(fen, g.moves[i], r.b, i), ph = phaseOf(fen, i);
        out.motifs[motif] = (out.motifs[motif] || 0) + 1; out.phases[ph] = (out.phases[ph] || 0) + 1;
        if (out.slips.length < 80) out.slips.push({ gid: g.id, ply: i, fen, played: g.moves[i], best: r.b, dw: r.dw, cls: r.c, motif, phase: ph, opening: name || '', opp, moveNo: Math.floor(i / 2) + 1, side: human });
        n++;
      }
      return n;
    } catch (e) { return 0; }
  };

  const read = () => {
    if (cache.data && Date.now() - cache.t < 20000) return cache.data;
    const out = { t: Date.now(), games: 0, analysed: 0, need: [], rec: { w: 0, d: 0, l: 0 }, opens: {}, slips: [], motifs: {}, phases: { opening: 0, middlegame: 0, endgame: 0 }, focusOpen: null, openSlips: {} };
    try {
      const A2 = AN(), list = A2 && A2.GS ? A2.GS.list() : [], P = PROF();
      for (const g of list) {
        if (!g || !g.human || !g.moves || g.moves.length < 8) continue;
        const r = P ? P.resOf(g.result, g.human) : null, name = P ? P.openingOf(g.moves) : '';
        if (r) {
          out.games++; out.rec[r.toLowerCase()]++;
          if (name) { const col = g.human > 0 ? 'w' : 'b', k = col + ':' + name, o = out.opens[k] || (out.opens[k] = { name, col, n: 0, pts: 0, moves: g.moves.slice(), id: g.id }); o.n++; o.pts += r === 'W' ? 1 : r === 'D' ? .5 : 0; }
        }
        if (g.ana && g.ana.rows && g.ana.rows.length) { out.analysed++; collect(g, out); }
        else if (out.need.length < 10) out.need.push(g.id);
      }
      /* the opening that costs you the most: a poor score first, otherwise the one where you make the most mistakes */
      const scored = Object.values(out.opens).filter(o => o.n >= 2 && o.pts / o.n < .6).sort((a, b) => a.pts / a.n - b.pts / b.n || b.n - a.n);
      out.focusOpen = scored[0] || null;
      if (!out.focusOpen) {
        const byOp = {};
        out.slips.forEach(s => { if (!s.opening) return; s.opening.split(':')[0]; const k = s.opening; byOp[k] = (byOp[k] || 0) + 1; });
        const top = Object.entries(byOp).sort((a, b) => b[1] - a[1])[0];
        if (top && top[1] >= 3) {
          const g = out.slips.find(s => s.opening === top[0]);
          const found = Object.values(out.opens).find(o => o.name === top[0]);
          out.focusOpen = found ? Object.assign({}, found, { bySlips: true }) : { name: top[0], col: (g && g.side) > 0 ? 'w' : 'b', n: 0, pts: 0, moves: (AN().GS.list().find(x => x.id === (g && g.gid)) || {}).moves || [], bySlips: true };
        }
      }
      out.slips.sort((a, b) => b.dw - a.dw);
    } catch (e) { }
    cache = { t: Date.now(), data: out };
    return out;
  };

  /* the single thing to work on now, or null when there is no clear pattern yet */
  const focus = () => {
    const a = read();
    const mo = Object.entries(a.motifs).sort((x, y) => y[1] - x[1]);
    const ph = Object.entries(a.phases).sort((x, y) => y[1] - x[1]);
    const bestMo = mo[0] || null, bestPh = ph[0] || null;
    if (a.focusOpen && !a.focusOpen.bySlips) return { kind: 'opening', key: 'opening', open: a.focusOpen, label: a.focusOpen.name + ' as ' + (a.focusOpen.col === 'w' ? 'White' : 'Black'), why: 'you have scored ' + a.focusOpen.pts + ' out of ' + a.focusOpen.n + ' in it' };
    if (bestMo && bestMo[1] >= 2) return { kind: 'tactic', key: bestMo[0], label: MOTIF[bestMo[0]] || ('you keep making the same mistake (' + bestMo[0] + ')'), why: bestMo[1] + ' times in your analysed games' };
    if (bestPh && bestPh[0] === 'endgame' && bestPh[1] >= 3) return { kind: 'endgame', key: 'endgame', label: 'endgames', why: 'you slip most once the pieces come off' };
    if (a.focusOpen) return { kind: 'opening', key: 'opening', open: a.focusOpen, label: a.focusOpen.name + ' as ' + (a.focusOpen.col === 'w' ? 'White' : 'Black'), why: 'it is where most of your mistakes happen' };
    return null;
  };

  /* ---------- steering: the move it would like to play, when that is still sound ---------- */
  const nudge = (pos, ply) => {
    try {
      const f = focus(); if (!f || f.kind !== 'opening' || !f.open || !f.open.moves || !f.open.moves.length) return null;
      if (ply >= 22 || (pos.side > 0 ? 'w' : 'b') === f.open.col) return null;
      const src = f.open.moves, p = new C.Pos().setFen(C.START);
      for (let i = 0; i < ply; i++) { const m = p.fromUci(src[i]); if (!m && m !== 0) return null; p.make(m); }
      const key = x => x.fen().split(' ').slice(0, 3).join(' ');
      if (key(p) !== key(pos)) return null;
      const m = src[ply] ? p.fromUci(src[ply]) : null;
      return (m || m === 0) ? m : null;
    } catch (e) { return null; }
  };

  /* a small preference added to the engine's score for each candidate move (chess-learn.js keeps the soundness filter,
     so the Trainer can want a kind of position without ever handing the game away) */
  const matCount = pos => { let n = 0; for (let i = 0; i < 64; i++) { const t = Math.abs(pos.b[i]); if (t >= 2 && t <= 5) n++; } return n; };
  const bonus = (f, pos, ply) => {
    try {
      if (!f) return 0;
      const fo = focus(); if (!fo) return 0;
      let b = 0; const big = matCount(pos);
      if (fo.kind === 'endgame') {
        if (f.trade) b += 30; if (f.cap && big > 8) b += 16; if (f.forward && big <= 8) b += 12; if (f.king && big <= 8) b += 12; if (f.retreat) b -= 10;
      } else if (fo.kind === 'tactic') {
        if (ply >= 8 && ply <= 70) { if (f.risk) b += 22; if (f.cap) b += 12; if (f.chk) b += 8; }
        if (f.king) b -= 12; if (f.earlyQ) b -= 8;
      } else if (fo.kind === 'opening') {
        if (f.dev) b += 10; if (f.center) b += 10; if (f.castle) b += 8; if (f.earlyQ) b -= 12; if (f.edgeP) b -= 6;
      }
      return b;
    } catch (e) { return 0; }
  };

  /* ---------- turning your mistakes into puzzles ---------- */
  const fenBefore = (g, i) => { const p = new C.Pos().setFen(g.startFen || C.START); for (let k = 0; k < i; k++) { const m = p.fromUci(g.moves[k]); if (!m && m !== 0) return null; p.make(m); } return p.fen(); };

  const puzzleOf = s => {
    const wins = s.motif === 'capture' || s.motif === 'promotion';
    return {
      f: s.fen, s: [s.best], v: [s.best], k: 1,
      t: wins ? 'Win material' : 'Find the best move',
      l: s.dw >= 25 ? 'hard' : s.dw >= 15 ? 'medium' : 'easy',
      g: ['My game', SHORT[s.motif] || 'Missed tactic'],
      src: 'mine',
      from: { gid: s.gid, ply: s.ply, motif: s.motif, vs: s.opp, at: Date.now() }
    };
  };

  /* save the mistakes you have actually made as puzzles: the ones in your weakest pattern come first */
  const build = limit => {
    const P = PUZ(); if (!P) return { made: 0, total: 0, why: 'The puzzle trainer is not loaded yet.' }; if (typeof P.addMine !== 'function') return { made: 0, total: 0, why: 'The puzzle trainer is not ready.' };
    const a = read(); if (!a.slips.length) return { made: 0, total: P.mineCount(), why: a.analysed ? 'No clear mistakes found in the analysed games.' : 'noana' };
    const weight = m => (a.motifs[m] || 0);
    const order = a.slips.slice().sort((x, y) => weight(y.motif) - weight(x.motif) || y.dw - x.dw);
    const seen = new Set(), use = limit || 24; let made = 0;
    for (const s of order) {
      if (made >= use) break;
      const key = s.fen.split(' ').slice(0, 2).join(' '); if (seen.has(key)) continue; seen.add(key);
      const pz = puzzleOf(s);
      /* one position, one puzzle: pressing the button again offers what is genuinely new, not the same twenty-four again */
      if (typeof P.isMine === 'function' && P.isMine(pz)) continue;
      P.addMine(pz); made++;
    }
    cache = { t: 0, data: null };
    return { made, total: P.mineCount(), why: '' };
  };

  /* run the real analyser over games that have never been analysed, so there is material to work from */
  async function analyseGames(onStep) {
    const A2 = AN(); if (!A2) return 0;
    const list = A2.GS.list().filter(g => g && g.human && g.moves && g.moves.length >= 8 && !g.ana).slice(0, 4);
    for (let i = 0; i < list.length; i++) {
      const g = list[i];
      try { onStep && onStep(i, list.length, g); } catch (e) { }
      let res = null; try { res = await A2.analyzeGame(g, { mode: 'quick', size: 2 }); } catch (e) { res = null; }
      if (res) A2.GS.patch(g.id, { ana: { rows: res.rows, summary: res.summary, mode: res.mode, at: res.at } });
      await new Promise(r => setTimeout(r, 20));
    }
    cache = { t: 0, data: null };
    return list.length;
  }

  /* open the puzzle trainer showing only the puzzles built from your games */
  const openPuzzles = () => {
    const UI = window.ChessUI; if (!UI || !UI.show) return false;
    try {
      const def = { moves: 'any', themes: [], level: 'mixed', pieces: 'any', side: 'any', source: 'mine', labels: true, hints: true, rated: true, auto: false, speed: 'normal', timer: 0 };
      const cur = Object.assign(def, JSON.parse(ls.get('pzset', '{}')));
      /* "My puzzles" and the My game theme only. Everything that could hide them is reset, so the tab opens on your
         own material instead of "nothing matches these settings". */
      cur.source = 'mine'; cur.themes = ['My game']; cur.moves = 'any'; cur.level = 'mixed'; cur.side = 'any'; cur.pieces = 'any';
      ls.set('pzset', JSON.stringify(cur));
    } catch (e) { }
    UI.show('puzzles');
    return true;
  };

  /* ---------- what it says ---------- */
  const rec = a => a.rec.w + '-' + a.rec.d + '-' + a.rec.l;
  const brief = () => {
    const a = read(), f = focus(), n = PUZ() ? PUZ().mineCount() : 0;
    const extra = n ? ' ' + n + ' puzzle' + (n === 1 ? '' : 's') + ' from your own games are ready in Puzzles.' : '';
    if (!f) {
      if (a.games < 3) return 'Trainer here. I have only seen ' + a.games + ' of your finished games, so I do not know your weak spots yet. Play a few, then Analyze them and I will find the pattern.' + extra;
      return 'Trainer here. Nothing stands out yet (record ' + rec(a) + '). We will just play, and I will keep reading your games.' + extra;
    }
    if (f.kind === 'opening') return 'Trainer here. Today we work on ' + f.label + ': ' + f.why + '. Play ' + (f.open.col === 'w' ? 'White' : 'Black') + ' and I will steer straight into it.' + extra;
    if (f.kind === 'endgame') return 'Trainer here. Today we work on endgames: ' + f.why + '. I will keep trading pieces so you get a real one.' + extra;
    return 'Trainer here. Today we work on one thing: ' + f.label + '. I will steer the game into positions where you have to see it.' + extra;
  };
  const debrief = k => {
    const a = read(), f = focus(), n = PUZ() ? PUZ().mineCount() : 0;
    const res = k === 'win' ? 'I won this one.' : k === 'lose' ? 'You got me.' : 'A draw.';
    const tail = f ? ' The focus was ' + f.label + '.' : '';
    const next = a.analysed ? (n ? ' Your own puzzles are waiting in Puzzles → My puzzles.' : ' Analyse this game and I will turn your mistakes into puzzles.') : ' Open it in Analysis and I will learn from it.';
    return res + tail + ' Open the game in Analysis to see where it was decided.' + next;
  };

  E.trainer = {
    n: 'Trainer', i: '🎯', t: 'The Trainer: reads your games and sets the lesson',
    special: 'trainer',
    bio: 'Reads the games you have played: it finds the opening that costs you the most points, or the tactic you keep missing, and steers the game into exactly those positions. It also turns the moments where you went wrong into puzzles of your own. Plays at your rating, says what it is working on before the game, and reminds you after.',
    st: 'a patient, friendly coach-sparring partner who knows the user’s past games; encouraging, specific, never harsh, and always able to say exactly which mistake it is training today',
    L: {
      get hi() { return brief(); }, get win() { return debrief('win'); }, get lose() { return debrief('lose'); }, get draw() { return debrief('draw'); },
      cap: 'A capture. Keep an eye on what it opens up.', lost: 'Good capture. Notice why it worked.', chk: 'Check. Count your safe squares.', chkd: 'A check. Think before you answer it.',
      chat: ['Take your time. Slow is fine.', 'What is the plan here?', 'This is the kind of position I wanted you to see.']
    }
  };

  window.ChessTrainer = {
    read, analyse: read, focus, nudge, bonus, brief, debrief, build, analyseGames, openPuzzles, puzzleOf, reset: () => { cache = { t: 0, data: null }; },
    /* for the self-test and for the card in the Learning bots dialog */
    stats: () => { const a = read(), f = focus(); return { games: a.games, analysed: a.analysed, need: a.need.length, slips: a.slips.length, motifs: a.motifs, focus: f, puzzles: PUZ() ? PUZ().mineCount() : 0 }; }
  };
})();

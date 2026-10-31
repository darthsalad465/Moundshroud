// Chess game tools: PGN reading/writing, a saved-games store, opening names, and a fast parallel game analyzer.
(() => {
  const C = Chess, MATE = C.MATE;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const wp = cp => 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * clamp(cp, -1000, 1000))) - 1);          // win chance in percent
  const accOf = dw => clamp(103.1668 * Math.exp(-0.04354 * dw) - 3.1669, 0, 100);                    // accuracy of one move from its win-chance drop
  const evalText = (cp, mate) => { if (Math.abs(cp) > MATE - 100) { const n = Math.ceil((MATE - Math.abs(cp) + 1) / 2); return (cp > 0 ? '+' : '-') + 'M' + n; } return (cp > 0 ? '+' : cp < 0 ? '-' : '') + (Math.abs(cp) / 100).toFixed(1); };

  /* ---------------- opening names (short list of the main lines) ---------------- */
  const ECO = [['Italian Game', 'e4 e5 Nf3 Nc6 Bc4'], ['Giuoco Piano', 'e4 e5 Nf3 Nc6 Bc4 Bc5'], ['Two Knights Defence', 'e4 e5 Nf3 Nc6 Bc4 Nf6'], ['Evans Gambit', 'e4 e5 Nf3 Nc6 Bc4 Bc5 b4'], ['Ruy Lopez', 'e4 e5 Nf3 Nc6 Bb5'], ['Ruy Lopez: Morphy Defence', 'e4 e5 Nf3 Nc6 Bb5 a6'], ['Scotch Game', 'e4 e5 Nf3 Nc6 d4'], ['Petrov Defence', 'e4 e5 Nf3 Nf6'], ['Philidor Defence', 'e4 e5 Nf3 d6'], ["King's Gambit", 'e4 e5 f4'], ['Vienna Game', 'e4 e5 Nc3'], ['Centre Game', 'e4 e5 d4'], ['Danish Gambit', 'e4 e5 d4 exd4 c3'], ['Sicilian Defence', 'e4 c5'], ['Sicilian: Najdorf', 'e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6'], ['Sicilian: Dragon', 'e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 g6'], ['Sicilian: Sveshnikov', 'e4 c5 Nf3 Nc6 d4 cxd4 Nxd4 Nf6 Nc3 e5'], ['Sicilian: Alapin', 'e4 c5 c3'], ['French Defence', 'e4 e6'], ['French: Advance', 'e4 e6 d4 d5 e5'], ['French: Winawer', 'e4 e6 d4 d5 Nc3 Bb4'], ['Caro-Kann Defence', 'e4 c6'], ['Caro-Kann: Advance', 'e4 c6 d4 d5 e5'], ['Scandinavian Defence', 'e4 d5'], ["Alekhine's Defence", 'e4 Nf6'], ['Pirc Defence', 'e4 d6'], ['Modern Defence', 'e4 g6'], ["Queen's Gambit", 'd4 d5 c4'], ["Queen's Gambit Declined", 'd4 d5 c4 e6'], ["Queen's Gambit Accepted", 'd4 d5 c4 dxc4'], ['Slav Defence', 'd4 d5 c4 c6'], ['London System', 'd4 d5 Bf4'], ['Colle System', 'd4 d5 Nf3 Nf6 e3'], ["King's Indian Defence", 'd4 Nf6 c4 g6'], ['Nimzo-Indian Defence', 'd4 Nf6 c4 e6 Nc3 Bb4'], ["Queen's Indian Defence", 'd4 Nf6 c4 e6 Nf3 b6'], ['Grunfeld Defence', 'd4 Nf6 c4 g6 Nc3 d5'], ['Catalan Opening', 'd4 Nf6 c4 e6 g3'], ['Benoni Defence', 'd4 Nf6 c4 c5 d5'], ['Trompowsky Attack', 'd4 Nf6 Bg5'], ['Dutch Defence', 'd4 f5'], ['English Opening', 'c4'], ['Reti Opening', 'Nf3'], ["Bird's Opening", 'f4'], ['Larsen Opening', 'b3'], ['Nimzowitsch-Larsen', 'b3 e5'], ['Polish Opening', 'b4'], ['Grob Opening', 'g4']];
  const LINES = ECO.map(x => [x[0], x[1].split(' ')]);
  try { (window.CHESS_STUDY ? window.CHESS_STUDY.openings : []).forEach(o => LINES.push([o.name, o.m.split(' ')])); } catch (e) { }
  const opening = sans => { let best = null; for (const [n, l] of LINES) { if (l.length <= sans.length && l.every((s, i) => s === sans[i]) && (!best || l.length > best[1])) best = [n, l.length]; } return best ? { name: best[0], plies: best[1] } : null; };
  const inBook = (sans, i) => { const pre = sans.slice(0, i + 1); return LINES.some(([, l]) => l.length > i && pre.every((s, k) => s === l[k])); };

  /* ---------------- PGN ---------------- */
  const SAN_RE = /^([KQRBN])?([a-h])?([1-8])?x?([a-h][1-8])(?:=?([QRBN]))?$/;
  /* matches a SAN word to a legal move without building SAN strings for every move (much faster than Pos.fromSan) */
  function fastSan(pos, tok, legal) {
    let s = tok.replace(/[+#!?]+$/g, '').replace(/0/g, 'O').replace(/^([a-h])x?([a-h][1-8])=?$/, '$1$2'); if (!s) return null;
    if (/^O-O(-O)?$/.test(s)) { const long = s === 'O-O-O'; return legal.find(m => (m >> 15) & 2 && ((m >> 6) & 63) > (m & 63) !== long) || null; }
    const m = SAN_RE.exec(s); if (!m) return pos.fromSan(tok, legal); const T = { K: 6, Q: 5, R: 4, B: 3, N: 2 }[m[1] || ''] || 1, to = C.sqIndex(m[4]), pr = m[5] ? { N: 2, B: 3, R: 4, Q: 5 }[m[5]] : 0;
    const c = legal.filter(x => ((x >> 6) & 63) === to && Math.abs(pos.b[x & 63]) === T && (((x >> 12) & 7) === pr) && (!m[2] || FILES[(x & 63) & 7] === m[2]) && (!m[3] || String(8 - ((x & 63) >> 3)) === m[3]));
    return c.length === 1 ? c[0] : (c[0] || null);
  }
  const FILES = 'abcdefgh';
  function cleanText(s) {
    s = s.replace(/\{[^}]*\}/g, ' ').replace(/;[^\n]*/g, ' ').replace(/^%[^\n]*/gm, ' ');
    for (let k = 0; k < 8 && /\(/.test(s); k++) s = s.replace(/\([^()]*\)/g, ' ');
    return s.replace(/\$\d+/g, ' ').replace(/\d+\s*\.(\s*\.\.)?/g, ' ').replace(/[–—]/g, '-').replace(/½-½/g, '1/2-1/2');
  }
  function replay(tokens, startFen) {
    const pos = new C.Pos().setFen(startFen || C.START), moves = [], sans = []; let error = null;
    for (const tk of tokens) {
      const legal = pos.legal(); const m = fastSan(pos, tk, legal);
      if (m == null) { error = 'Could not read move ' + (Math.floor(moves.length / 2) + 1) + (moves.length % 2 ? '...' : '.') + ' "' + tk + '"' + (legal.length ? '' : ' (the game was already over)'); break; }
      sans.push(pos.san(m, legal)); moves.push(pos.uci(m)); pos.make(m);
    }
    return { moves, sans, error, pos };
  }
  function parseOne(h, mt) {
    const tags = {}; h.forEach(l => { const m = /^\[(\w+)\s+"((?:[^"\\]|\\.)*)"\]/.exec(l); if (m) tags[m[1]] = m[2].replace(/\\"/g, '"'); });
    const text = cleanText(mt.join('\n')); const tokens = text.split(/\s+/).filter(t => t && !/^(1-0|0-1|1\/2-1\/2|\*)$/.test(t) && !/^[-.]+$/.test(t));
    const start = tags.SetUp === '1' && tags.FEN ? tags.FEN : null; let r; try { r = replay(tokens, start); } catch (e) { return { tags, moves: [], sans: [], error: 'This does not look like a valid game.' }; }
    const res = tags.Result || ((/(1-0|0-1|1\/2-1\/2|\*)\s*$/.exec(mt.join(' ')) || [])[1]) || '*';
    return { tags, startFen: start, moves: r.moves, sans: r.sans, error: r.error, result: res };
  }
  /* reads a PGN file or pasted text (many games allowed), a bare move list like "e4 e5 Nf3", or a lone FEN position */
  function parsePGN(text) {
    text = String(text || '').replace(/^﻿/, '').replace(/\r/g, ''); const lines = text.split('\n'), games = []; let cur = { h: [], m: [] };
    for (const raw of lines) {
      const l = raw.trim(); const isTag = /^\[\w+\s+"/.test(l);
      if (isTag) { if (cur.m.some(x => x.trim())) { games.push(cur); cur = { h: [], m: [] }; } cur.h.push(l); } else cur.m.push(raw);
    }
    if (cur.h.length || cur.m.some(x => x.trim())) games.push(cur);
    const out = games.map(g => parseOne(g.h, g.m)).filter(g => g.moves.length || g.error || Object.keys(g.tags).length);
    if ((!out.length || (out.length === 1 && !out[0].moves.length && !Object.keys(out[0].tags).length)) && /^\s*[rnbqkpRNBQKP1-8]+(\/[rnbqkpRNBQKP1-8]+){7}\s+[wb]\b/.test(text)) { const fen = text.trim().split('\n')[0].trim(); return { games: [{ tags: { Event: 'Position' }, startFen: fen, moves: [], sans: [], result: '*', fenOnly: true }], fen: true }; }
    return { games: out };
  }
  function toPGN(g) {
    const t = Object.assign({ Event: g.event || 'Game', Site: g.site || 'Moundshroud', Date: (g.date || new Date().toISOString()).slice(0, 10).replace(/-/g, '.'), Round: '-', White: g.white || 'White', Black: g.black || 'Black', Result: g.result || '*' }, g.tags || {});
    if (g.startFen) { t.SetUp = '1'; t.FEN = g.startFen; }
    const pos = new C.Pos().setFen(g.startFen || C.START); let mt = '', n = Math.max(0, (parseInt(String(g.startFen || '').split(' ')[5], 10) || 1) - 1) + (pos.side < 0 ? 1 : 0);
    for (const u of g.moves) { const m = pos.fromUci(u); if (!m) break; const first = pos.side > 0; if (first) mt += (++n) + '. '; else if (!mt) mt += n + '... '; mt += pos.san(m) + ' '; pos.make(m); }
    return Object.entries(t).map(([k, v]) => '[' + k + ' "' + String(v).replace(/"/g, '\\"') + '"]').join('\n') + '\n\n' + (mt + (g.result || '*')).replace(/(.{1,78})(\s|$)/g, '$1\n').trim() + '\n';
  }

  /* ---------------- saved games ---------------- */
  const GS = {
    list() { try { return JSON.parse(ls.get('chgames', '[]')); } catch (e) { return []; } },
    save(a) { const trimmed = a.slice(0, 80); try { ls.set('chgames', JSON.stringify(trimmed)); } catch (e) { try { ls.set('chgames', JSON.stringify(trimmed.slice(0, 30))); } catch (x) { } } },
    add(g) { const a = GS.list(), key = (g.startFen || '') + '|' + g.moves.join(' '), dup = a.find(x => (x.startFen || '') + '|' + x.moves.join(' ') === key); if (dup) { Object.assign(dup, g, { id: dup.id, ana: g.ana || dup.ana }); GS.save(a); return dup; } g.id = Date.now().toString(36) + Math.random().toString(36).slice(2, 5); g.date = g.date || new Date().toISOString(); a.unshift(g); GS.save(a); return g; },
    get: id => GS.list().find(x => x.id === id),
    patch(id, p) { const a = GS.list(), g = a.find(x => x.id === id); if (g) { Object.assign(g, p); GS.save(a); } return g; },
    remove(id) { GS.save(GS.list().filter(x => x.id !== id)); }
  };

  /* ---------------- engine pool: several workers analysing at once ---------------- */
  function Pool(size) {
    const workers = [], queue = []; let dead = false, nid = 0;
    const spawn = () => { const w = { w: new Worker('/web/js/chess-engine.js'), busy: null }; w.w.onmessage = e => { const j = w.busy; if (!j || j.id !== e.data.id) return; clearTimeout(j.t); w.busy = null; j.res(e.data); pump(); }; w.w.onerror = () => { const j = w.busy; w.busy = null; if (j) { clearTimeout(j.t); j.res(null); } replace(w); pump(); }; return w; };
    const replace = w => { try { w.w.terminate(); } catch (e) { } if (!dead) workers[workers.indexOf(w)] = spawn(); };
    const pump = () => { if (dead) return; for (const w of workers) { if (!w.busy && queue.length) { const j = queue.shift(); w.busy = j; j.t = setTimeout(() => { if (w.busy === j) { w.busy = null; j.res(null); replace(w); pump(); } }, j.limit); w.w.postMessage(Object.assign({}, j.msg, { id: j.id })); } } };
    for (let i = 0; i < size; i++) workers.push(spawn());
    return { size, ask: (msg, limit) => new Promise(res => { if (dead) return res(null); const enq = () => { queue.push({ id: ++nid, msg, res, limit: limit || 20000 }); pump(); }; if (window.ChessSF && ChessSF.wants(msg)) ChessSF.run(msg).then(res, enq); else enq(); }), kill() { dead = true; queue.length = 0; workers.forEach(w => { try { w.w.terminate(); } catch (e) { } }); } };
  }
  const cores = () => { const n = (navigator.hardwareConcurrency || 4); const low = window.A && A.power && A.power.on; return low ? 1 : clamp(n - 1, 1, 4); };
  const MODES = { quick: { depth: 3, ms: 500, label: 'Quick' }, standard: { depth: 5, ms: 1500, label: 'Standard' }, deep: { depth: 7, ms: 4000, label: 'Deep' } };

  /* classify a move by how much win chance it gave away */
  const classify = (dw, isBest) => isBest || dw < 0.5 ? 'best' : dw < 2 ? 'excellent' : dw < 5 ? 'good' : dw < 10 ? 'inaccuracy' : dw < 20 ? 'mistake' : 'blunder';
  const CLASS_INFO = { brilliant: ['‼', 'Brilliant', '#26c9c9'], great: ['!', 'Great', '#5b8def'], book: ['📖', 'Book', 'var(--mute)'], best: ['⭐', 'Best', 'var(--ok)'], excellent: ['✔', 'Excellent', 'var(--ok)'], good: ['✓', 'Good', 'var(--acc2)'], inaccuracy: ['?!', 'Inaccuracy', 'var(--warn)'], mistake: ['?', 'Mistake', '#ff9f43'], blunder: ['??', 'Blunder', 'var(--bad)'] };

  /* runs the whole game through the engine on several workers and reports each move as soon as it is ready */
  /* a real sacrifice: after the move, the opponent can win at least two points of material (counting what we took and can take back) */
  const PV = [0, 1, 3, 3, 5, 9, 0];
  function isSacrifice(fen, u) {
    try {
      const p = new C.Pos().setFen(fen), m = p.fromUci(u); if (!m) return false; const to = (m >> 6) & 63, took = PV[Math.abs(p.b[to])]; p.make(m); let worst = 0;
      for (const oc of p.legal()) { const t = PV[Math.abs(p.b[(oc >> 6) & 63])]; if (!t) continue; p.make(oc); let rec = 0; for (const mc of p.legal()) { const tt = PV[Math.abs(p.b[(mc >> 6) & 63])]; if (tt > rec) rec = tt; } p.unmake(); worst = Math.max(worst, t - rec); }
      return worst - took >= 2;
    } catch (e) { return false; }
  }
  async function analyzeGame(game, o) {
    o = o || {}; const mode = MODES[o.mode] || MODES.standard, pos = new C.Pos().setFen(game.startFen || C.START), fens = [], sans = [], N = game.moves.length;
    for (const u of game.moves) { fens.push(pos.fen()); const m = pos.fromUci(u); if (!m) break; sans.push(pos.san(m)); pos.make(m); } fens.push(pos.fen());
    const rows = new Array(N).fill(null), wbs = new Array(N).fill(null), pool = Pool(o.size || cores()); let done = 0, cancelled = false; o.handle && (o.handle.cancel = () => { cancelled = true; pool.kill(); });
    const t0 = Date.now(); const bookSans = sans;
    const jobs = game.moves.map((u, i) => pool.ask({ cmd: 'ana', fen: fens[i], played: u, depth: mode.depth, ms: mode.ms }, mode.ms * 4 + 5000).then(r => {
      if (cancelled) return; const side = fens[i].split(' ')[1] === 'w' ? 1 : -1; let row;
      if (!r || r.best == null) row = { unk: true, e: i ? (rows[i - 1] && rows[i - 1].e) || 0 : 0 };
      else { const bs = r.bs, ps = r.played == null ? r.bs : r.played, isBest = r.best === u, dw = isBest ? 0 : Math.max(0, wp(bs) - wp(ps)); let c = classify(dw, isBest), wbest = wp(bs), wplay = wp(ps); if (c === 'best' || c === 'excellent' || c === 'good') { if (dw < 5 && wplay >= 33 && wbest <= 95 && isSacrifice(fens[i], u)) c = 'brilliant'; } wbs[i] = wbest; let dwx = dw, lossx = Math.max(0, Math.round(bs - ps)); if (!game.startFen && i < 14 && inBook(bookSans, i)) { c = 'book'; dwx = 0; lossx = 0; } row = { c, dw: Math.round(dwx * 10) / 10, loss: lossx, b: r.best, e: Math.round(ps * side), a: Math.round(accOf(dwx)), d: r.depth }; }
      rows[i] = row; done++; o.onRow && o.onRow(i, row, done, N, (Date.now() - t0) / 1000);
    }));
    await Promise.all(jobs);
    /* Great = the only good move: best move whose runner-up is clearly worse (checked for a limited number of moves per game) */
    if (!cancelled) { const cand = []; rows.forEach((r, i) => { if (r && r.c === 'best' && wbs[i] != null && wbs[i] >= 12 && wbs[i] <= 90) cand.push(i); }); const picks = cand.slice(0, 14);
      await Promise.all(picks.map(i => pool.ask({ cmd: 'multi', fen: fens[i], depth: mode.depth, ms: mode.ms, n: 2 }, mode.ms * 3 + 4000).then(r => { if (cancelled || !r || !r.lines || r.lines.length < 2) return; if (wp(r.lines[0][1]) - wp(r.lines[1][1]) >= 15 && rows[i]) rows[i].c = 'great'; }).catch(() => { }))); }
    pool.kill(); if (cancelled) return null;
    // positions whose result was lost get the evaluation of their neighbour so the graph stays smooth
    for (let i = 0; i < N; i++) if (!rows[i] || rows[i].unk) rows[i] = { unk: true, e: i ? rows[i - 1].e : 0 };
    return { rows, summary: summarize(game, rows, fens, sans), mode: o.mode || 'standard', at: Date.now() };
  }
  function summarize(game, rows, fens, sans) {
    const S = { w: { acc: 0, n: 0, loss: 0, c: {} }, b: { acc: 0, n: 0, loss: 0, c: {} } }, phase = { open: [0, 0], mid: [0, 0], end: [0, 0] };
    rows.forEach((r, i) => { if (r.unk) return; const s = S[i % 2 === 0 ? 'w' : 'b']; s.acc += r.a; s.n++; s.loss += Math.min(r.loss, 500); s.c[r.c] = (s.c[r.c] || 0) + 1; const bd = fens[i].split(' ')[0], np = (bd.match(/[nbrqNBRQ]/g) || []).length, ph = i < 16 ? 'open' : np <= 6 ? 'end' : 'mid'; phase[ph][0] += r.a; phase[ph][1]++; });
    const fin = s => ({ acc: s.n ? Math.round(s.acc / s.n * 10) / 10 : 0, acpl: s.n ? Math.round(s.loss / s.n) : 0, c: s.c, n: s.n });
    const moments = rows.map((r, i) => ({ i, dw: r.dw || 0, c: r.c })).filter(x => x.dw >= 10).sort((a, b) => b.dw - a.dw).slice(0, 5).map(x => x.i).sort((a, b) => a - b);
    return { w: fin(S.w), b: fin(S.b), phase: Object.fromEntries(Object.entries(phase).map(([k, v]) => [k, v[1] ? Math.round(v[0] / v[1]) : null])), moments, opening: opening(sans) };
  }

  /* a cheap look at one position (top lines) for the engine panel, cached per position */
  const lineCache = new Map();
  async function lines(pool, fen, depth, ms, n) { const k = fen + '|' + depth; if (lineCache.has(k)) return lineCache.get(k); const r = await pool.ask({ cmd: 'multi', fen, depth, ms, n: n || 3 }, ms * 3 + 4000); if (r && r.lines) { lineCache.set(k, r); if (lineCache.size > 300) lineCache.delete(lineCache.keys().next().value); } return r; }

  window.ChessAna = { LINES, isSacrifice, parsePGN, toPGN, GS, Pool, cores, MODES, analyzeGame, summarize, classify, CLASS_INFO, wp, accOf, evalText, opening, inBook, lines, fastSan, replay, MATE };
})();

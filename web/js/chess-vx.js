// Rule-changing chess variants on top of the standard engine's move generator: Atomic, Antichess, Racing Kings and Horde.
// ChessVX.make(id, fen) returns a Chess.Pos whose legal()/make()/unmake()/inCheck()/result() follow the variant, so the board, Online and Daily games can use it like normal.
// ChessVX.think(pos, elo, ms) is a small alpha-beta player for these variants (the main engine only understands standard chess).
(() => {
  const C = window.Chess; if (!C) return; const MATE = 100000, VAL = [0, 100, 320, 330, 500, 900, 0];
  const STD = C.Pos.prototype, NBR = [-9, -8, -7, -1, 1, 7, 8, 9];
  const START = { atomic: C.START, anti: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w - - 0 1', racing: '8/8/8/8/8/8/krbnNBRK/qrbnNBRQ w - - 0 1', horde: 'rnbqkbnr/pppppppp/8/1PP2PP1/PPPPPPPP/PPPPPPPP/PPPPPPPP/PPPPPPPP w kq - 0 1' };
  const has = (p, side) => { for (let i = 0; i < 64; i++) if (p.b[i] === 6 * side) return true; return false; };
  const kingSq = (p, side) => { for (let i = 0; i < 64; i++) if (p.b[i] === 6 * side) return i; return -1; };
  const adjacent = (a, b) => a >= 0 && b >= 0 && Math.abs((a >> 3) - (b >> 3)) <= 1 && Math.abs((a & 7) - (b & 7)) <= 1;
  function make(id, fen) {
    const p = new C.Pos(); p.setFen(fen || START[id] || C.START); p.vid = id; p.vstack = [];
    const std = { make: STD.make, unmake: STD.unmake, gen: STD.gen, attacked: STD.attacked };
    p.make = function (m) {
      this.vstack.push({ b: this.b.slice(), ksq: this.ksq.slice() }); const f = m & 63, t = (m >> 6) & 63, fl = m >> 15, cap = this.b[t] !== 0 || (fl & 1) !== 0;
      std.make.call(this, m);
      if (id === 'atomic' && cap && !(fl & 2)) {                         // the explosion: the capturing piece, the captured piece and every non-pawn next door
        this.b[t] = 0; for (const d of NBR) { const x = t + d; if (x < 0 || x > 63 || Math.abs((x & 7) - (t & 7)) > 1) continue; if (Math.abs(this.b[x]) !== 1) this.b[x] = 0; }
        if (fl & 1) { const cs = t + (this.side < 0 ? 8 : -8); this.b[cs] = 0; }          // en passant: the captured pawn sits behind the target square
        this.ksq[0] = kingSq(this, 1); this.ksq[1] = kingSq(this, -1);
      }
    };
    p.unmake = function () { const s = this.vstack.pop(); std.unmake.call(this); this.b.set(s.b); this.ksq = s.ksq; };
    p.inCheck = function (side) {
      side = side || this.side; if (id === 'anti') return false; const k = kingSq(this, side); if (k < 0) return false;
      if (id === 'atomic') { const o = kingSq(this, -side); if (adjacent(k, o)) return false; if (o < 0) return false; }
      return std.attacked.call(this, k, -side);
    };
    p.legal = function () {
      const out = []; const me = this.side;
      for (const m of std.gen.call(this, false)) {
        const f = m & 63, t = (m >> 6) & 63, pc = Math.abs(this.b[f]);
        if (id === 'atomic' && pc === 6 && (this.b[t] !== 0)) continue;     // a king cannot capture: it would blow itself up
        this.make(m);
        let ok = true;
        if (id === 'atomic') { if (!has(this, me)) ok = false; else if (!has(this, -me)) ok = true; else ok = !this.inCheckOf(me); }
        else if (id === 'racing') ok = !std.attacked.call(this, this.ksq[me > 0 ? 0 : 1], -me) && !std.attacked.call(this, this.ksq[me > 0 ? 1 : 0], me);   // nobody may ever be in check
        else if (id === 'horde') { const bk = kingSq(this, -1); ok = me > 0 ? true : (bk < 0 || !std.attacked.call(this, bk, 1)); }   // White has no king, so only Black must watch for check
        this.unmake(); if (ok) out.push(m);
      }
      if (id === 'anti') { const caps = out.filter(m => this.b[(m >> 6) & 63] !== 0 || (m >> 15 & 1)); return caps.length ? caps : out; }
      return out;
    };
    p.inCheckOf = function (side) { const k = kingSq(this, side), o = kingSq(this, -side); if (k < 0 || o < 0 || adjacent(k, o)) return false; return std.attacked.call(this, k, -side); };
    /* game result for the side to move: null = go on, {winner: 1|-1, txt} or {draw: true, txt} */
    p.result = function (ms) {
      ms = ms || this.legal(); const side = this.side;
      if (id === 'atomic') { if (!has(this, side)) return { winner: -side, txt: 'king exploded' }; if (!has(this, -side)) return { winner: side, txt: 'king exploded' }; if (!ms.length) return this.inCheckOf(side) ? { winner: -side, txt: 'checkmate' } : { draw: true, txt: 'stalemate' }; }
      else if (id === 'anti') { let mine = 0; for (let i = 0; i < 64; i++) if (this.b[i] * side > 0) mine++; if (!mine || !ms.length) return { winner: side, txt: mine ? 'no moves left (stalemate wins)' : 'all pieces lost' }; }
      else if (id === 'horde') { let wc = 0; for (let i = 0; i < 64; i++) if (this.b[i] > 0) wc++; if (!wc) return { winner: -1, txt: 'every white piece was captured' }; if (!ms.length) { if (side < 0 && std.attacked.call(this, kingSq(this, -1), 1)) return { winner: 1, txt: 'checkmate' }; return { draw: true, txt: 'stalemate' }; } }
      else if (id === 'racing') {
        const wk = (this.ksq[0] >> 3) === 0, bk = (this.ksq[1] >> 3) === 0;
        if (side < 0 && wk) { if (bk) return { draw: true, txt: 'both kings reached the eighth rank' }; if (!ms.some(m => (m & 63) === this.ksq[1] && ((m >> 6) & 63) >> 3 === 0)) return { winner: 1, txt: 'king reached the eighth rank' }; return null; }
        if (side > 0 && bk) return wk ? { draw: true, txt: 'both kings reached the eighth rank' } : { winner: -1, txt: 'king reached the eighth rank' };
        if (!ms.length) return { draw: true, txt: 'stalemate' };
      }
      if (this.half >= 100) return { draw: true, txt: 'fifty-move rule' };
      return null;
    };
    p.insufficient = function () { return false; };
    return p;
  }
  /* ---------- a small player ---------- */
  const evalPos = (p, id) => {
    let w = 0, bl = 0, wm = 0, bm = 0; for (let i = 0; i < 64; i++) { const v = p.b[i]; if (!v) continue; const t = Math.abs(v); if (v > 0) { w += VAL[t]; wm += (t === 6 ? 0 : 1); } else { bl += VAL[t]; bm += (t === 6 ? 0 : 1); } }
    let s;
    if (id === 'anti') s = (bl - w) / 1 + (bm - wm) * 15; else if (id === 'racing') { const wr = p.ksq[0] >> 3, br = p.ksq[1] >> 3; s = (br - wr) * 90 + (w - bl) * .05; } else { s = w - bl; const wk = kingSq(p, 1), bk = kingSq(p, -1); if (wk >= 0 && bk >= 0 && !adjacent(wk, bk)) { let near = 0; for (const d of NBR) { const x = bk + d; if (x >= 0 && x < 64 && p.b[x] > 0) near += 15; const y = wk + d; if (y >= 0 && y < 64 && p.b[y] < 0) near -= 15; } s += near; } }
    return p.side > 0 ? s : -s;
  };
  let deadline = 0, nodes = 0;
  const nega = (p, d, al, be, ply, id) => {
    if ((++nodes & 255) === 0 && Date.now() > deadline) throw 0; const ms = p.legal(), r = p.result(ms);
    if (r) return r.draw ? 0 : (r.winner === p.side ? MATE - ply : -MATE + ply); if (d <= 0) return evalPos(p, id);
    ms.sort((a, b) => (p.b[(b >> 6) & 63] !== 0) - (p.b[(a >> 6) & 63] !== 0)); let best = -Infinity;
    for (const m of ms) { p.make(m); const s = -nega(p, d - 1, -be, -al, ply + 1, id); p.unmake(); if (s > best) best = s; if (s > al) al = s; if (al >= be) break; }
    return best;
  };
  function think(p, elo, ms) {
    const id = p.vid, legal = p.legal(); if (!legal.length) return null; if (legal.length === 1) return legal[0];
    const depth = elo <= 900 ? 2 : elo <= 1500 ? 3 : 4, T = Math.max(15, Math.min(300, (2300 - elo) / 7)); deadline = Date.now() + (ms || 700); nodes = 0; let scored = legal.map(m => [m, 0]);
    for (let d = 1; d <= depth; d++) { const cur = []; try { for (const m of legal) { p.make(m); const s = -nega(p, d - 1, -MATE * 2, MATE * 2, 1, id); p.unmake(); cur.push([m, s]); } } catch (e) { break; } scored = cur; }
    // a thrown timeout can leave the board mid-move: rebuild from the fen to be safe
    if (scored.some(x => x[1] === undefined)) return legal[Math.random() * legal.length | 0];
    const top = Math.max(...scored.map(x => x[1])); if (top > MATE - 50) return scored.find(x => x[1] === top)[0];
    const w = scored.map(x => Math.exp(Math.max(-60, (x[1] - top) / T))); let r = Math.random() * w.reduce((a, c) => a + c, 0), i = 0; while (i < w.length - 1 && (r -= w[i]) > 0) i++; return scored[i][0];
  }
  const thinkSafe = (p, elo, ms) => { const fen = p.fen(), q = make(p.vid, fen); try { return think(q, elo, ms); } catch (e) { const l = q.legal(); return l.length ? l[Math.random() * l.length | 0] : null; } };
  window.ChessVX = { make, think: (p, elo, ms) => { const fen = p.fen(), m = thinkSafe(p, elo, ms); if (m === null || m === undefined) return null; /* the search ran on a copy: map the move back */ const l = p.legal(); return l.find(x => x === m) !== undefined ? m : l[0]; }, START, ids: ['atomic', 'anti', 'racing', 'horde'], has: id => !!START[id] };
})();

// Chess rules + a small alpha-beta engine with adjustable strength. Loaded as a normal script (rules for the UI) and as a Web Worker (thinking).
(function (root) {
  const P = 1, N = 2, B = 3, R = 4, Q = 5, K = 6, FILES = 'abcdefgh';
  const VAL = [0, 100, 320, 330, 500, 900, 0];
  const sqName = s => FILES[s & 7] + (8 - (s >> 3));
  const CR = new Int8Array(64).fill(15); CR[60] = 12; CR[63] = 14; CR[56] = 13; CR[4] = 3; CR[7] = 11; CR[0] = 7;

  /* tables */
  const KN = [], KG = [], RAY = [], PAW = [[], []]; // PAW[0][sq] = squares a white pawn would attack sq from
  const inb = (r, c) => r >= 0 && r < 8 && c >= 0 && c < 8;
  for (let s = 0; s < 64; s++) {
    const r = s >> 3, c = s & 7; KN[s] = []; KG[s] = []; RAY[s] = []; PAW[0][s] = []; PAW[1][s] = [];
    for (const [dr, dc] of [[1, 2], [2, 1], [-1, 2], [-2, 1], [1, -2], [2, -1], [-1, -2], [-2, -1]]) if (inb(r + dr, c + dc)) KN[s].push((r + dr) * 8 + c + dc);
    for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) { if (inb(r + dr, c + dc)) KG[s].push((r + dr) * 8 + c + dc); const ray = []; for (let k = 1; inb(r + dr * k, c + dc * k); k++) ray.push((r + dr * k) * 8 + c + dc * k); RAY[s].push(ray); }
    for (const dc of [-1, 1]) { if (inb(r + 1, c + dc)) PAW[0][s].push((r + 1) * 8 + c + dc); if (inb(r - 1, c + dc)) PAW[1][s].push((r - 1) * 8 + c + dc); }
  } // RAY order: rook dirs 0-3, bishop dirs 4-7

  function Pos() { this.b = new Int8Array(64); this.side = 1; this.castle = 15; this.ep = -1; this.half = 0; this.full = 1; this.ksq = [60, 4]; this.stack = []; this.c9 = null; this.cr = null; }
  const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  Pos.prototype.setFen = function (fen) {
    const f = (fen || START).split(' '); this.b.fill(0); let i = 0;
    for (const ch of f[0]) { if (ch === '/') continue; if (/\d/.test(ch)) { i += +ch; continue; } const t = 'pnbrqk'.indexOf(ch.toLowerCase()) + 1, w = ch === ch.toUpperCase(); this.b[i] = w ? t : -t; if (t === K) this.ksq[w ? 0 : 1] = i; i++; }
    this.side = f[1] === 'b' ? -1 : 1; this.castle = 0; this.c9 = null; this.cr = null; const rk = [-1, -1, -1, -1], ks = [60, 4]; let odd = false;
    for (const c of f[2] || '') {
      if (c === '-') continue; const w = c === c.toUpperCase(), row = w ? 56 : 0, kp = w ? K : -K, rp = w ? R : -R; let kf = -1; for (let x = 0; x < 8; x++) if (this.b[row + x] === kp) kf = x; if (kf < 0) continue; ks[w ? 0 : 1] = row + kf;
      let rf = -1, kside = false; if ('KQkq'.includes(c)) { kside = c.toLowerCase() === 'k'; if (kside) { for (let x = 7; x > kf; x--) if (this.b[row + x] === rp) { rf = x; break; } } else { for (let x = 0; x < kf; x++) if (this.b[row + x] === rp) { rf = x; break; } } } else { rf = c.toLowerCase().charCodeAt(0) - 97; kside = rf > kf; }
      if (rf < 0 || rf > 7) continue; this.castle |= w ? (kside ? 1 : 2) : (kside ? 4 : 8); rk[(w ? 0 : 2) + (kside ? 1 : 0)] = row + rf; if (kf !== 4 || rf !== (kside ? 7 : 0)) odd = true;
    }
    if (odd) { this.c9 = { ks, rk }; const cr = new Int8Array(64).fill(15); cr[ks[0]] &= 12; cr[ks[1]] &= 3; if (rk[0] >= 0) cr[rk[0]] &= 13; if (rk[1] >= 0) cr[rk[1]] &= 14; if (rk[2] >= 0) cr[rk[2]] &= 7; if (rk[3] >= 0) cr[rk[3]] &= 11; this.cr = cr; }
    this.ep = f[3] && f[3] !== '-' ? (8 - +f[3][1]) * 8 + FILES.indexOf(f[3][0]) : -1; this.half = +f[4] || 0; this.full = +f[5] || 1; this.stack = []; return this;
  };
  Pos.prototype.fen = function () {
    let s = ''; for (let r = 0; r < 8; r++) { let e = 0; for (let c = 0; c < 8; c++) { const p = this.b[r * 8 + c]; if (!p) { e++; continue; } if (e) { s += e; e = 0; } const ch = 'pnbrqk'[Math.abs(p) - 1]; s += p > 0 ? ch.toUpperCase() : ch; } if (e) s += e; if (r < 7) s += '/'; }
    return s + ' ' + (this.side > 0 ? 'w' : 'b') + ' ' + (this.c9 ? ((this.castle & 1 ? FILES[this.c9.rk[1] & 7].toUpperCase() : '') + (this.castle & 2 ? FILES[this.c9.rk[0] & 7].toUpperCase() : '') + (this.castle & 4 ? FILES[this.c9.rk[3] & 7] : '') + (this.castle & 8 ? FILES[this.c9.rk[2] & 7] : '') || '-') : ((this.castle & 1 ? 'K' : '') + (this.castle & 2 ? 'Q' : '') + (this.castle & 4 ? 'k' : '') + (this.castle & 8 ? 'q' : '') || '-')) + ' ' + (this.ep >= 0 ? sqName(this.ep) : '-') + ' ' + this.half + ' ' + this.full;
  };
  Pos.prototype.key = function () { return this.fen().split(' ').slice(0, 4).join(' '); };
  Pos.prototype.attacked = function (sq, by) {
    const b = this.b, s = by > 0 ? 1 : -1;
    for (const x of PAW[by > 0 ? 0 : 1][sq]) if (b[x] === s * P) return true;
    for (const x of KN[sq]) if (b[x] === s * N) return true;
    for (const x of KG[sq]) if (b[x] === s * K) return true;
    for (let d = 0; d < 8; d++) for (const x of RAY[sq][d]) { const p = b[x]; if (p) { if (p * s > 0) { const t = Math.abs(p); if (t === Q || (d < 4 ? t === R : t === B)) return true; } break; } }
    return false;
  };
  Pos.prototype.inCheck = function (side) { side = side || this.side; return this.attacked(this.ksq[side > 0 ? 0 : 1], -side); };
  Pos.prototype.gen = function (capOnly) {
    const out = [], b = this.b, side = this.side;
    for (let sq = 0; sq < 64; sq++) {
      const p = b[sq]; if (!p || p * side < 0) continue; const t = Math.abs(p);
      if (t === P) {
        const dir = side > 0 ? -8 : 8, start = side > 0 ? 6 : 1, last = side > 0 ? 0 : 7, r = sq >> 3, c = sq & 7, to = sq + dir;
        const add = (to2, fl) => { if ((to2 >> 3) === last) { for (const pr of [Q, N, R, B]) out.push(sq | to2 << 6 | pr << 12); } else out.push(sq | to2 << 6 | fl << 15); };
        if (!b[to]) { if (!capOnly || (to >> 3) === last) { add(to, 0); } if (!capOnly && r === start && !b[to + dir]) out.push(sq | (to + dir) << 6 | 4 << 15); }
        for (const dc of [-1, 1]) { const cc = c + dc; if (cc < 0 || cc > 7) continue; const x = to + dc; if (b[x] * side < 0) add(x, 0); else if (x === this.ep) out.push(sq | x << 6 | 1 << 15); }
      } else if (t === N || t === K) {
        for (const x of (t === N ? KN : KG)[sq]) { if (b[x] * side <= 0 && (!capOnly || b[x])) out.push(sq | x << 6); }
      } else {
        for (let d = t === B ? 4 : 0; d < (t === R ? 4 : 8); d++) for (const x of RAY[sq][d]) { if (!b[x]) { if (!capOnly) out.push(sq | x << 6); continue; } if (b[x] * side < 0) out.push(sq | x << 6); break; }
      }
    }
    if (!capOnly && this.c9) {
      const c9 = this.c9, w = side > 0, ks = c9.ks[w ? 0 : 1], kp = w ? K : -K, rp = w ? R : -R;
      if (b[ks] === kp) for (const [bit, rs, kd, rd] of w ? [[1, c9.rk[1], 62, 61], [2, c9.rk[0], 58, 59]] : [[4, c9.rk[3], 6, 5], [8, c9.rk[2], 2, 3]]) {
        if (!(this.castle & bit) || rs < 0 || b[rs] !== rp) continue; const lo = Math.min(ks, kd, rs, rd), hi = Math.max(ks, kd, rs, rd); let ok = true; for (let s = lo; s <= hi; s++) if (s !== ks && s !== rs && b[s]) { ok = false; break; } if (!ok) continue;
        const a = Math.min(ks, kd), z = Math.max(ks, kd); for (let s = a; s <= z; s++) if (this.attacked(s, -side)) { ok = false; break; } if (ok) out.push(ks | rs << 6 | 2 << 15);
      }
    } else if (!capOnly) {
      if (side > 0 && b[60] === K) {
        if ((this.castle & 1) && !b[61] && !b[62] && b[63] === R && !this.attacked(60, -1) && !this.attacked(61, -1) && !this.attacked(62, -1)) out.push(60 | 62 << 6 | 2 << 15);
        if ((this.castle & 2) && !b[59] && !b[58] && !b[57] && b[56] === R && !this.attacked(60, -1) && !this.attacked(59, -1) && !this.attacked(58, -1)) out.push(60 | 58 << 6 | 2 << 15);
      } else if (side < 0 && b[4] === -K) {
        if ((this.castle & 4) && !b[5] && !b[6] && b[7] === -R && !this.attacked(4, 1) && !this.attacked(5, 1) && !this.attacked(6, 1)) out.push(4 | 6 << 6 | 2 << 15);
        if ((this.castle & 8) && !b[3] && !b[2] && !b[1] && b[0] === -R && !this.attacked(4, 1) && !this.attacked(3, 1) && !this.attacked(2, 1)) out.push(4 | 2 << 6 | 2 << 15);
      }
    }
    return out;
  };
  Pos.prototype.make = function (m) {
    const f = m & 63, t = (m >> 6) & 63, pr = (m >> 12) & 7, fl = m >> 15, b = this.b, p = b[f], side = this.side;
    if ((fl & 2) && this.c9) { const ks = t > f, kd = side > 0 ? (ks ? 62 : 58) : (ks ? 6 : 2), rd = side > 0 ? (ks ? 61 : 59) : (ks ? 5 : 3), kg = b[f], rg = b[t]; b[f] = 0; b[t] = 0; b[kd] = kg; b[rd] = rg; this.ksq[side > 0 ? 0 : 1] = kd; this.stack.push({ m, cap: 0, castle: this.castle, ep: this.ep, half: this.half, c9: 1 }); this.castle &= this.cr[f] & this.cr[t]; this.ep = -1; this.half++; if (side < 0) this.full++; this.side = -side; return; }
    const u = { m, cap: b[t], castle: this.castle, ep: this.ep, half: this.half };
    b[t] = p; b[f] = 0;
    if (fl & 1) { const cs = t + (side > 0 ? 8 : -8); u.cap = b[cs]; b[cs] = 0; }
    if (pr) b[t] = side * pr;
    if (fl & 2) { if (t === 62) { b[61] = b[63]; b[63] = 0; } else if (t === 58) { b[59] = b[56]; b[56] = 0; } else if (t === 6) { b[5] = b[7]; b[7] = 0; } else { b[3] = b[0]; b[0] = 0; } }
    if (Math.abs(p) === K) this.ksq[side > 0 ? 0 : 1] = t;
    { const T9 = this.cr || CR; this.castle &= T9[f] & T9[t]; } this.ep = (fl & 4) ? (f + t) >> 1 : -1; this.half = (Math.abs(p) === P || u.cap) ? 0 : this.half + 1; if (side < 0) this.full++;
    this.side = -side; this.stack.push(u);
  };
  Pos.prototype.unmake = function () {
    const u = this.stack.pop(), m = u.m, f = m & 63, t = (m >> 6) & 63, pr = (m >> 12) & 7, fl = m >> 15, b = this.b; this.side = -this.side; const side = this.side;
    if (u.c9) { const ks = t > f, kd = side > 0 ? (ks ? 62 : 58) : (ks ? 6 : 2), rd = side > 0 ? (ks ? 61 : 59) : (ks ? 5 : 3); b[kd] = 0; b[rd] = 0; b[f] = side > 0 ? K : -K; b[t] = side > 0 ? R : -R; this.ksq[side > 0 ? 0 : 1] = f; this.castle = u.castle; this.ep = u.ep; this.half = u.half; if (side < 0) this.full--; return; }
    let p = b[t]; if (pr) p = side * P;
    b[f] = p; b[t] = 0; if (fl & 1) b[t + (side > 0 ? 8 : -8)] = u.cap; else b[t] = u.cap;
    if (fl & 2) { if (t === 62) { b[63] = b[61]; b[61] = 0; } else if (t === 58) { b[56] = b[59]; b[59] = 0; } else if (t === 6) { b[7] = b[5]; b[5] = 0; } else { b[0] = b[3]; b[3] = 0; } }
    if (Math.abs(p) === K) this.ksq[side > 0 ? 0 : 1] = f;
    this.castle = u.castle; this.ep = u.ep; this.half = u.half; if (side < 0) this.full--;
  };
  Pos.prototype.nullMake = function () { this.stack.push({ nul: 1, ep: this.ep }); this.ep = -1; this.side = -this.side; };
  Pos.prototype.nullUnmake = function () { const u = this.stack.pop(); this.ep = u.ep; this.side = -this.side; };
  Pos.prototype.legal = function () { const r = []; for (const m of this.gen(false)) { this.make(m); if (!this.attacked(this.ksq[this.side > 0 ? 1 : 0], this.side)) r.push(m); this.unmake(); } return r; };
  Pos.prototype.san = function (m, legal) {
    const f = m & 63, t = (m >> 6) & 63, pr = (m >> 12) & 7, fl = m >> 15, p = Math.abs(this.b[f]); let s;
    if (fl & 2) s = t > f ? 'O-O' : 'O-O-O';
    else {
      const cap = this.b[t] || (fl & 1);
      if (p === P) s = (cap ? FILES[f & 7] + 'x' : '') + sqName(t) + (pr ? '=' + 'NBRQ'[pr - 2] : '');
      else { const o = (legal || this.legal()).filter(x => x !== m && ((x >> 6) & 63) === t && Math.abs(this.b[x & 63]) === p); let d = ''; if (o.length) { if (!o.some(x => (x & 7) === (f & 7))) d = FILES[f & 7]; else if (!o.some(x => ((x & 63) >> 3) === (f >> 3))) d = String(8 - (f >> 3)); else d = sqName(f); } s = 'NBRQK'[p - 2] + d + (cap ? 'x' : '') + sqName(t); }
    }
    this.make(m); if (this.inCheck()) s += this.legal().length ? '+' : '#'; this.unmake(); return s;
  };
  Pos.prototype.perft = function (d) { if (!d) return 1; let n = 0; for (const m of this.gen(false)) { this.make(m); if (!this.attacked(this.ksq[this.side > 0 ? 1 : 0], this.side)) n += this.perft(d - 1); this.unmake(); } return n; };
  Pos.prototype.insufficient = function () { let minors = 0; for (let i = 0; i < 64; i++) { const t = Math.abs(this.b[i]); if (t === P || t === R || t === Q) return false; if (t === N || t === B) minors++; } return minors <= 1; };

  /* evaluation (piece-square tables, simplified) */
  const T = {
    1: [0, 0, 0, 0, 0, 0, 0, 0, 50, 50, 50, 50, 50, 50, 50, 50, 10, 10, 20, 30, 30, 20, 10, 10, 5, 5, 10, 25, 25, 10, 5, 5, 0, 0, 0, 20, 20, 0, 0, 0, 5, -5, -10, 0, 0, -10, -5, 5, 5, 10, 10, -20, -20, 10, 10, 5, 0, 0, 0, 0, 0, 0, 0, 0],
    2: [-50, -40, -30, -30, -30, -30, -40, -50, -40, -20, 0, 0, 0, 0, -20, -40, -30, 0, 10, 15, 15, 10, 0, -30, -30, 5, 15, 20, 20, 15, 5, -30, -30, 0, 15, 20, 20, 15, 0, -30, -30, 5, 10, 15, 15, 10, 5, -30, -40, -20, 0, 5, 5, 0, -20, -40, -50, -40, -30, -30, -30, -30, -40, -50],
    3: [-20, -10, -10, -10, -10, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 10, 10, 5, 0, -10, -10, 5, 5, 10, 10, 5, 5, -10, -10, 0, 10, 10, 10, 10, 0, -10, -10, 10, 10, 10, 10, 10, 10, -10, -10, 5, 0, 0, 0, 0, 5, -10, -20, -10, -10, -10, -10, -10, -10, -20],
    4: [0, 0, 0, 0, 0, 0, 0, 0, 5, 10, 10, 10, 10, 10, 10, 5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, 0, 0, 0, 5, 5, 0, 0, 0],
    5: [-20, -10, -10, -5, -5, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 5, 5, 5, 0, -10, -5, 0, 5, 5, 5, 5, 0, -5, 0, 0, 5, 5, 5, 5, 0, -5, -10, 5, 5, 5, 5, 5, 0, -10, -10, 0, 5, 0, 0, 0, 0, -10, -20, -10, -10, -5, -5, -10, -10, -20],
    6: [-30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -20, -30, -30, -40, -40, -30, -30, -20, -10, -20, -20, -20, -20, -20, -20, -10, 20, 20, 0, 0, 0, 0, 20, 20, 20, 30, 10, 0, 0, 10, 30, 20],
    7: [-50, -40, -30, -20, -20, -30, -40, -50, -30, -20, -10, 0, 0, -10, -20, -30, -30, -10, 20, 30, 30, 20, -10, -30, -30, -10, 30, 40, 40, 30, -10, -30, -30, -10, 30, 40, 40, 30, -10, -30, -30, -10, 20, 30, 30, 20, -10, -30, -30, -30, 0, 0, 0, 0, -30, -30, -50, -30, -30, -30, -30, -30, -30, -50]
  };
  const PASSED = [0, 0, 10, 20, 40, 70, 110, 0];
  function evaluate(pos) {
    const b = pos.b; let mat = 0, s = 0; const pc = [new Int8Array(8), new Int8Array(8)], wp = [], bp = [], rk = [[], []], bs = [0, 0];
    for (let i = 0; i < 64; i++) {
      const p = b[i]; if (!p) continue; const t = Math.abs(p); if (t === K) continue; if (t !== P) mat += VAL[t];
      if (t === P) { if (p > 0) { pc[0][i & 7]++; wp.push(i); } else { pc[1][i & 7]++; bp.push(i); } } else if (t === B) bs[p > 0 ? 0 : 1]++; else if (t === R) rk[p > 0 ? 0 : 1].push(i);
    }
    const end = mat < 2600;
    for (let i = 0; i < 64; i++) {
      const p = b[i]; if (!p) continue; const t = Math.abs(p), tab = t === K && end ? T[7] : T[t];
      if (p > 0) s += VAL[t] + tab[i]; else s -= VAL[t] + tab[i ^ 56];
    }
    for (let side = 0; side < 2; side++) {
      let e = 0; const own = pc[side], opp = pc[1 - side], mine = side ? bp : wp, theirs = side ? wp : bp;
      for (let f = 0; f < 8; f++) { const c = own[f]; if (c > 1) e -= 10 * (c - 1); if (c && (f === 0 || !own[f - 1]) && (f === 7 || !own[f + 1])) e -= 12; }
      for (const i of mine) { const f = i & 7, r = i >> 3; let pass = true; for (const j of theirs) { const g = j & 7; if (Math.abs(g - f) <= 1 && (side ? (j >> 3) > r : (j >> 3) < r)) { pass = false; break; } } if (pass) e += PASSED[side ? r - 1 : 6 - r] * (end ? 1.5 : 1) | 0; }
      if (bs[side] >= 2) e += 30;
      for (const i of rk[side]) { const f = i & 7; if (!own[f]) e += opp[f] ? 8 : 15; }
      if (!end) { const ks = pos.ksq[side], kr = ks >> 3, kf = ks & 7; if (side ? kr <= 1 : kr >= 6) { const rr = side ? kr + 1 : kr - 1; for (let g = kf - 1; g <= kf + 1; g++) if (g >= 0 && g < 8 && b[rr * 8 + g] === (side ? -P : P)) e += 10; } }
      s += side ? -e : e;
    }
    return pos.side > 0 ? s : -s;
  }

  /* search */
  const INF = 32000, MATE = 30000; let nodes = 0, deadline = 0, aborted = false; const killers = [], hist = [new Int32Array(4096), new Int32Array(4096)];
  const order = (pos, moves, ply, first) => {
    const b = pos.b, hh = hist[pos.side > 0 ? 0 : 1], sc = moves.map(m => { if (m === first) return 100000; const t = (m >> 6) & 63, cap = b[t] || ((m >> 15) & 1 ? P : 0); let s = 0; if (cap) s = 10 * VAL[Math.abs(cap)] - VAL[Math.abs(b[m & 63])] / 10 + 1000; if ((m >> 12) & 7) s += 800; if (killers[ply] && (killers[ply][0] === m || killers[ply][1] === m)) s += 90; if (!cap) s += Math.min(80, hh[(m & 63) * 64 + ((m >> 6) & 63)] >> 4); return s; });
    return moves.map((m, i) => [sc[i], m]).sort((a, c) => c[0] - a[0]).map(x => x[1]);
  };
  const illegal = pos => pos.attacked(pos.ksq[pos.side > 0 ? 1 : 0], pos.side);
  function qs(pos, alpha, beta) {
    nodes++; if ((nodes & 2047) === 0 && Date.now() > deadline) aborted = true; if (aborted) return 0;
    const stand = evaluate(pos); if (stand >= beta) return beta; if (stand > alpha) alpha = stand;
    for (const m of order(pos, pos.gen(true), 0)) { pos.make(m); if (illegal(pos)) { pos.unmake(); continue; } const s = -qs(pos, -beta, -alpha); pos.unmake(); if (aborted) return 0; if (s >= beta) return beta; if (s > alpha) alpha = s; }
    return alpha;
  }
  const hasPieces = pos => { for (let i = 0; i < 64; i++) { const p = pos.b[i]; if (p * pos.side > 0 && Math.abs(p) > P && Math.abs(p) < K) return true; } return false; };
  function nega(pos, d, alpha, beta, ply, nonull) {
    nodes++; if ((nodes & 2047) === 0 && Date.now() > deadline) aborted = true; if (aborted) return 0;
    const chk = pos.inCheck(); if (chk && ply < 24) d++;
    if (d <= 0) return qs(pos, alpha, beta); if (pos.half >= 100 || pos.insufficient()) return 0;
    if (!nonull && !chk && d >= 3 && ply > 0 && beta < MATE - 100 && beta > -MATE + 100 && hasPieces(pos)) {
      pos.nullMake(); const sn = -nega(pos, d - 3, -beta, -beta + 1, ply + 1, true); pos.nullUnmake(); if (aborted) return 0; if (sn >= beta && sn < MATE - 100) return beta;
    }
    let legal = 0, best = -INF; const hh = hist[pos.side > 0 ? 0 : 1];
    for (const m of order(pos, pos.gen(false), ply)) {
      const quiet = !pos.b[(m >> 6) & 63] && !((m >> 12) & 7) && !((m >> 15) & 1);
      pos.make(m); if (illegal(pos)) { pos.unmake(); continue; } legal++;
      let s;
      if (legal > 6 && d >= 4 && quiet && !chk && !pos.inCheck()) { s = -nega(pos, d - 2, -alpha - 1, -alpha, ply + 1); if (s > alpha) s = -nega(pos, d - 1, -beta, -alpha, ply + 1); }
      else s = -nega(pos, d - 1, -beta, -alpha, ply + 1);
      pos.unmake(); if (aborted) return 0;
      if (s > best) best = s; if (s > alpha) alpha = s;
      if (alpha >= beta) { if (quiet) { const k = killers[ply] || (killers[ply] = [0, 0]); if (k[0] !== m) { k[1] = k[0]; k[0] = m; } hh[(m & 63) * 64 + ((m >> 6) & 63)] += d * d; } break; }
    }
    if (!legal) return chk ? -MATE + ply : 0; return best;
  }
  /* strength for any rating from 100 up: depth is stepped, the randomness (T) and blunder chance (bl) slide smoothly between these anchor points, so 650 plays a little differently from 600 */
  const LV = [[100, 1, 700, .5], [400, 1, 450, .24], [500, 1, 400, .18], [700, 1, 250, .1], [900, 2, 160, .05], [1100, 2, 100, .025], [1300, 3, 70, .012], [1500, 3, 40, 0], [1700, 3, 20, 0], [1900, 4, 12, 0], [2100, 4, 0, 0]];
  function level(elo) {
    if (elo > 2100) return { d: 7, T: 0, bl: 0 }; if (elo <= LV[0][0]) return { d: LV[0][1], T: LV[0][2], bl: LV[0][3] };
    for (let i = 1; i < LV.length; i++) if (elo <= LV[i][0]) { const a = LV[i - 1], b = LV[i], t = (elo - a[0]) / (b[0] - a[0]); return { d: b[1], T: a[2] + (b[2] - a[2]) * t, bl: a[3] + (b[3] - a[3]) * t }; }
    return { d: 4, T: 0, bl: 0 };
  }
  /* opening sense in centipawns: develop knights and bishops, take the centre with the d/e pawns, castle; avoid early queen and king walks and edge pawns */
  function openBonus(pos, m) {
    const fr = m & 63, to = (m >> 6) & 63, p = pos.b[fr], ap = Math.abs(p), row = fr >> 3, col = fr & 7, cap = pos.b[to] !== 0, back = p > 0 ? 7 : 0; let b = 0;
    if (ap === 1) { if (!cap && (col === 0 || col === 7)) b -= 45; if (Math.abs((to >> 3) - row) === 2) b += col === 3 || col === 4 ? 60 : col === 2 || col === 5 ? 25 : 0; }
    else if (ap === 2 || ap === 3) { b += row === back ? 40 : -15; if ((to >> 3) === back) b -= 45; const tc = to & 7; if (ap === 2 && (tc === 0 || tc === 7)) b -= 60; if (ap === 2 && row === back && (tc === 2 || tc === 5)) b += 25; }
    else if (ap === 4) b -= 40; else if (ap === 5) b -= 70;
    else if (ap === 6) { const castle = Math.abs(to - fr) === 2 || (pos.b[to] * p > 0 && Math.abs(pos.b[to]) === 4); b += castle ? 60 : -120; }
    return b;
  }
  function rootScores(pos, legal, d) { const out = []; for (const m of legal) { pos.make(m); const s = -nega(pos, d - 1, -INF, INF, 1); pos.unmake(); if (aborted) return null; out.push([m, s]); } return out; }
  function think(pos, elo, ms) {
    const legal = pos.legal(); if (!legal.length) return null; if (legal.length === 1) return { move: legal[0], score: 0 };
    const cfg = level(elo); nodes = 0; killers.length = 0; aborted = false; deadline = Date.now() + 60000;
    /* people from about 700 up play the first moves of a game sensibly (develop, fight for the centre, castle) and only start to slip later;
       below that the opening is looser. A "blunder" is a plausible mistake, not a random legal move. */
    const ply = ((pos.full || 1) - 1) * 2 + (pos.side > 0 ? 0 : 1), openN = elo >= 700 ? Math.min(12, 6 + Math.round((elo - 700) / 200)) : 3, inOpen = ply < openN && cfg.T > 0;
    if (!inOpen && Math.random() < cfg.bl) { const sh = rootScores(pos, legal, 1); if (sh) { const top1 = Math.max(...sh.map(x => x[1])), weak = sh.filter(x => top1 - x[1] >= 100 && top1 - x[1] <= 450); if (weak.length) return { move: weak[Math.random() * weak.length | 0][0], score: 0 }; } aborted = false; return { move: legal[Math.random() * legal.length | 0], score: 0 }; }
    let scored;
    if (cfg.T > 0) {
      scored = rootScores(pos, legal, Math.min(cfg.d, 2));
      if (cfg.d > 2) { deadline = Date.now() + ms; const deep = rootScores(pos, legal, cfg.d); if (deep) scored = deep; aborted = false; }
      let T = cfg.T; if (inOpen) { T = Math.min(T, 30); scored = scored.map(x => [x[0], x[1] + openBonus(pos, x[0])]); const tp = Math.max(...scored.map(x => x[1])); scored = scored.filter(x => tp - x[1] <= 90); }
      const top = Math.max(...scored.map(x => x[1])), w = scored.map(x => Math.exp(Math.max(-60, (x[1] - top) / T)));
      let r = Math.random() * w.reduce((a, c) => a + c, 0), i = 0; while (i < w.length - 1 && (r -= w[i]) > 0) i++; return { move: scored[i][0], score: scored[i][1] };
    }
    deadline = Date.now() + ms; let best = null, bs = 0, ordered = order(pos, legal, 0);
    for (let d = 1; d <= cfg.d; d++) {
      let cur = null, cs = -INF, alpha = -INF;
      for (const m of ordered) { pos.make(m); const s = -nega(pos, d - 1, -INF, -alpha, 1); pos.unmake(); if (aborted) break; if (s > cs) { cs = s; cur = m; } if (s > alpha) alpha = s; }
      if (aborted) break; best = cur; bs = cs; ordered = order(pos, ordered, 0, best); if (Math.abs(bs) > MATE - 50) break;
    }
    return { move: best || legal[0], score: bs };
  }
  /* fast analysis: iterative deepening for the best move, then score the move that was actually played at the same depth */
  const resetSearch = ms => { nodes = 0; killers.length = 0; hist[0].fill(0); hist[1].fill(0); aborted = false; deadline = Date.now() + (ms || 60000); };
  function analyzeMove(pos, played, maxDepth, ms) {
    const legal = pos.legal(); if (!legal.length) return { best: null, bs: 0, played: 0, depth: 0 }; resetSearch(ms);
    let best = legal[0], bs = 0, reached = 0, ordered = order(pos, legal, 0);
    if (legal.length === 1) { reached = 1; }
    else for (let d = 1; d <= maxDepth; d++) {
      let cur = null, cs = -INF, alpha = -INF;
      for (const m of ordered) { pos.make(m); const s = -nega(pos, d - 1, -INF, -alpha, 1); pos.unmake(); if (aborted) break; if (s > cs) { cs = s; cur = m; } if (s > alpha) alpha = s; }
      if (aborted) break; best = cur; bs = cs; reached = d; ordered = order(pos, ordered, 0, best); if (Math.abs(bs) > MATE - 50 && d >= 2) break;
    }
    let ps = bs; if (played != null && played !== best) { aborted = false; deadline = Date.now() + (ms || 60000); pos.make(played); ps = -nega(pos, Math.max(0, reached - 1), -INF, INF, 1); pos.unmake(); if (aborted) ps = null; }
    return { best, bs, played: ps, depth: reached };
  }
  /* the top n lines of a position (every legal move scored at each depth until time runs out) */
  function analyzeMulti(pos, maxDepth, ms, n) {
    const legal = pos.legal(); if (!legal.length) return { depth: 0, lines: [] }; resetSearch(ms); let ordered = order(pos, legal, 0), res = null, reached = 0;
    for (let d = 1; d <= maxDepth; d++) {
      const sc = []; let ab = false; for (const m of ordered) { pos.make(m); const s = -nega(pos, d - 1, -INF, INF, 1); pos.unmake(); if (aborted) { ab = true; break; } sc.push([m, s]); }
      if (ab) break; sc.sort((a, c) => c[1] - a[1]); res = sc; reached = d; ordered = sc.map(x => x[0]); if (Math.abs(sc[0][1]) > MATE - 50 && d >= 3) break;
    }
    return { depth: reached, lines: (res || []).slice(0, n || 3) };
  }
  /* a short best-play line from a position */
  function pvLine(pos, len, depth, ms) { const out = [], made = []; try { for (let i = 0; i < len; i++) { const r = analyzeMove(pos, null, depth, ms); if (!r.best) break; out.push(pos.uci(r.best)); pos.make(r.best); made.push(1); } } finally { while (made.pop()) pos.unmake(); } return out; }
  /* study helpers: score every legal move (mover's view, centipawns), UCI and SAN parsing */
  function analyze(pos, depth, ms) { const legal = pos.legal(); nodes = 0; killers.length = 0; aborted = false; deadline = Date.now() + (ms || 60000); if (!legal.length) return []; const sc = rootScores(pos, legal, depth); return sc ? sc.sort((a, b) => b[1] - a[1]) : null; }
  Pos.prototype.uci = function (m) { const pr = (m >> 12) & 7; return sqName(m & 63) + sqName((m >> 6) & 63) + (pr ? 'nbrq'[pr - 2] : ''); };
  Pos.prototype.fromUci = function (s, legal) { return (legal || this.legal()).find(m => this.uci(m) === s) || null; };
  const cleanSan = s => String(s).replace(/[+#!?]/g, '').replace(/0/g, 'O');
  Pos.prototype.fromSan = function (s, legal) { legal = legal || this.legal(); const want = cleanSan(s); return legal.find(m => cleanSan(this.san(m, legal)) === want) || null; };
  const sqIndex = n => (8 - +n[1]) * 8 + FILES.indexOf(n[0]);
  /* squares a piece attacks (including squares holding any piece) */
  function pieceAttacks(pos, sq) {
    const b = pos.b, p = b[sq], t = Math.abs(p), out = [];
    if (t === P) { const r = (sq >> 3) + (p > 0 ? -1 : 1), c = sq & 7; if (r >= 0 && r < 8) { if (c > 0) out.push(r * 8 + c - 1); if (c < 7) out.push(r * 8 + c + 1); } }
    else if (t === N) return KN[sq]; else if (t === K) return KG[sq];
    else for (let d = t === B ? 4 : 0; d < (t === R ? 4 : 8); d++) for (const x of RAY[sq][d]) { out.push(x); if (b[x]) break; }
    return out;
  }
  /* what is the idea of this move? (used to label puzzles) */
  function themes(pos, m) {
    const tags = [], b = pos.b, side = pos.side, f = m & 63, t = (m >> 6) & 63, pr = (m >> 12) & 7, fl = m >> 15, mover = Math.abs(b[f]), cap = Math.abs(b[t]) || (fl & 1 ? P : 0), enemy = -side;
    let nonPawn = 0; for (let i = 0; i < 64; i++) { const a = Math.abs(b[i]); if (a > P && a < K) nonPawn++; }
    pos.make(m);
    try {
      const chk = pos.inCheck(), mate = chk && pos.legal().length === 0, ek = pos.ksq[enemy > 0 ? 0 : 1], pt = Math.abs(b[t]);
      if (mate) {
        tags.push('Mate'); const br = enemy > 0 ? 7 : 0;
        if ((ek >> 3) === br && (t >> 3) === br && (pt === R || pt === Q)) tags.push('Back-rank mate');
        if (pt === N && KG[ek].every(x => b[x] * enemy > 0)) tags.push('Smothered mate');
      } else if (chk) tags.push('Check');
      if (!mate && pt !== P) {
        const tg = pieceAttacks(pos, t).filter(x => b[x] * enemy > 0 && (Math.abs(b[x]) === K || VAL[Math.abs(b[x])] > VAL[pt] || !pos.attacked(x, enemy)));
        if (tg.length >= 2) tags.push('Fork');
        if (pt === B || pt === R || pt === Q) for (let d = pt === B ? 4 : 0; d < (pt === R ? 4 : 8); d++) {
          const ray = RAY[t][d]; let x = -1, y = -1; for (const s of ray) { if (b[s]) { if (x < 0) x = s; else { y = s; break; } } }
          if (x >= 0 && y >= 0 && b[x] * enemy > 0 && b[y] * enemy > 0) { const vx = Math.abs(b[x]) === K ? 99 : VAL[Math.abs(b[x])], vy = Math.abs(b[y]) === K ? 99 : VAL[Math.abs(b[y])]; if (vy > vx) tags.push('Pin'); else if (vx > vy) tags.push('Skewer'); }
        }
      }
      for (let d = 0; d < 8; d++) { // discovered attack: a friendly slider behind the moved piece now sees an enemy piece
        let a = -1, e = -1; for (const s of RAY[f][d]) { if (b[s]) { a = s; break; } } for (const s of RAY[f][d ^ 1]) { if (b[s]) { e = s; break; } }
        if (a >= 0 && e >= 0 && a !== t && e !== t && b[a] * side > 0 && b[e] * enemy > 0) { const at = Math.abs(b[a]); if (at === Q || (d < 4 ? at === R : at === B)) { tags.push(Math.abs(b[e]) === K ? 'Discovered attack' : 'Discovered attack'); break; } }
      }
      if (cap >= 3 && !mate && !pos.attacked(t, enemy)) tags.push('Hanging piece');
      if (pr) tags.push('Promotion');
      if (VAL[mover] - VAL[cap] >= 200 && pos.attacked(t, enemy)) tags.push('Sacrifice');
      if (nonPawn <= 4) tags.push('Endgame');
    } finally { pos.unmake(); }
    return [...new Set(tags)];
  }
  /* ---------- puzzles: turn a position into a solvable line (one or several moves) ---------- */
  const material = (pos, side) => { let s = 0; for (let i = 0; i < 64; i++) { const p = pos.b[i]; if (p) s += (p * side > 0 ? 1 : -1) * VAL[Math.abs(p)]; } return s; };
  /* follows best play from the first move: mates run until mate, material wins run until the gain is safely banked (up to maxK of your moves) */
  function buildLine(pos, first, mate, n, maxK) {
    const side = pos.side, v = [], made = [], base = material(pos, side); let k = 0, ok = false;
    const push = m => { v.push(pos.uci(m)); pos.make(m); made.push(m); };
    try {
      push(first); k = 1;
      if (mate) {
        ok = true;
        while (k < n) {
          if (!pos.legal().length) { ok = false; break; }
          const ar = analyze(pos, 2 * (n - k), 5000); if (!ar || !ar.length) { ok = false; break; } push(ar[0][0]);
          const ap = analyze(pos, Math.max(2, 2 * (n - k) - 1), 5000); if (!ap || !ap.length || ap[0][1] <= MATE - 60) { ok = false; break; } push(ap[0][0]); k++;
        }
        if (ok && !(pos.inCheck() && pos.legal().length === 0)) ok = false;
      } else {
        for (;;) {
          const bal = material(pos, side) - base; if (!pos.legal().length) break;
          const ar = analyze(pos, 3, 3000); if (!ar || !ar.length) break;
          pos.make(ar[0][0]); const bal2 = material(pos, side) - base; pos.unmake();
          if (bal >= 200 && bal2 >= 150) { ok = true; break; }
          if (k >= maxK) break; push(ar[0][0]);
          const ap = analyze(pos, 3, 3000); if (!ap || !ap.length || ap[0][1] < 150) break; push(ap[0][0]); k++;
        }
      }
      return ok ? { v: v.slice(), k } : null;
    } finally { while (made.length) { pos.unmake(); made.pop(); } }
  }
  /* o.force: accept any position (for puzzles you create yourself); o.maxK: longest solution, in your moves */
  function puzzleFrom(pos, o) {
    o = o || {}; const legal = pos.legal(); if (legal.length < (o.force ? 1 : 2)) return null;
    const a3 = analyze(pos, 3, 5000); if (!a3 || !a3.length) return null;
    if (!o.force && a3.length < 2) return null;
    const best = a3[0][1], second = a3.length > 1 ? a3[1][1] : -INF, mate3 = best > MATE - 60;
    if (!o.force && !((best >= 280 || mate3) && (second <= best - 220 || (mate3 && second < MATE - 60)))) return null;
    const a4 = analyze(pos, 4, 9000); if (!a4 || !a4.length) return null; const b4 = a4[0], mate = b4[1] > MATE - 60;
    if (!o.force && !(b4[0] === a3[0][0] && (mate ? true : b4[1] >= 250) && a4[1][1] <= b4[1] - 200)) return null;
    const acc = a4.filter(x => x[1] >= b4[1] - 40 && (!mate || x[1] > MATE - 60)).map(x => pos.uci(x[0])), n = mate ? Math.ceil((MATE - b4[1] + 1) / 2) : 0;
    let line = buildLine(pos, b4[0], mate, n, o.maxK || 4);
    if (!line) { if (!o.force) return null; line = { v: [pos.uci(b4[0])], k: 1 }; }
    const ok = a => a && a.length && acc.includes(pos.uci(a[0][0])) && (mate ? a[0][1] > MATE - 60 : a[0][1] >= 200), a2 = analyze(pos, 2, 3000);
    /* difficulty follows how much you must calculate: one move seen at a glance = easy, two moves or a deeper idea = medium, three or more moves = hard */
    const lvl = (line.k >= 3 || n >= 3) ? 'hard' : (line.k === 2 || !ok(a2)) ? 'medium' : 'easy';
    return { f: pos.fen(), s: acc, v: line.v, k: line.k, l: lvl, t: mate ? 'Mate in ' + n : 'Win material', g: themes(pos, b4[0]), x: pos.san(b4[0], legal) };
  }
  root.Chess = { Pos, think, analyze, analyzeMove, analyzeMulti, pvLine, evaluate, themes, puzzleFrom, material, level, sqName, sqIndex, START, FILES, MATE };
  if (typeof importScripts === 'function') self.onmessage = e => {
    const d = e.data, pos = new Pos().setFen(d.fen);
    if (d.cmd === 'ana') { const p = d.played ? pos.fromUci(d.played) : null, r = analyzeMove(pos, p, d.depth || 4, d.ms || 3000); self.postMessage({ id: d.id, best: r.best == null ? null : pos.uci(r.best), bs: r.bs, played: r.played, depth: r.depth }); return; }
    if (d.cmd === 'multi') { const r = analyzeMulti(pos, d.depth || 5, d.ms || 4000, d.n || 3); self.postMessage({ id: d.id, depth: r.depth, lines: r.lines.map(x => [pos.uci(x[0]), x[1]]) }); return; }
    if (d.cmd === 'pv') { self.postMessage({ id: d.id, pv: pvLine(pos, d.len || 6, d.depth || 3, d.ms || 800) }); return; }
    if (d.cmd === 'puzzle') { const r = puzzleFrom(pos, { force: !!d.force, maxK: d.maxK || 4 }); self.postMessage({ id: d.id, puzzle: r }); return; }
    if (d.cmd === 'eval') { const a = analyze(pos, d.depth || 3, d.ms || 4000) || []; self.postMessage({ id: d.id, best: a.length ? a[0][0] : null, score: a.length ? a[0][1] : 0, list: a.slice(0, 4).map(x => [x[0], x[1]]), scores: a.map(x => [x[0], x[1]]) }); return; }
    const r = think(pos, d.elo, d.ms); self.postMessage({ id: d.id, move: r ? r.move : null, score: r ? r.score : 0 });
  };
})(typeof self !== 'undefined' ? self : this);

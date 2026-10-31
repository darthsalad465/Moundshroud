// Chess › 📷 Scan: turn a picture of a chess position (a screenshot, a book or magazine diagram, a photo) into a board
// you can analyse or play. Everything happens on this PC.
//   1. find the board: the edges between squares make strong, evenly spaced lines; or you drag its four corners
//   2. straighten it into a flat square
//   3. read each square: empty or not (does it differ from the square's own colour?), white or black (the two
//      groups of piece brightness), and which piece (its outline compared with reference pieces drawn from the
//      app's own piece sets and the chess symbols in your fonts)
//   4. sense checks: one king each, no pawns on the first or last rank, and which way round the board is
// The result is always shown on an editable board, so anything the picture made unclear takes one click to fix.
(() => {
  const UI = window.ChessUI, C = window.Chess;
  const TYPES = ['', 'P', 'N', 'B', 'R', 'Q', 'K'];

  /* ---------- pictures ---------- */
  const loadImg = src => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('That file is not a picture Moundshroud can read.')); i.src = src; });
  function pixels(img, max, pad) {
    pad = pad || 0; const k = Math.min(1, max / Math.max(img.naturalWidth || img.width, img.naturalHeight || img.height)), iw = Math.max(1, Math.round((img.naturalWidth || img.width) * k)), ih = Math.max(1, Math.round((img.naturalHeight || img.height) * k)), w = iw + 2 * pad, h = ih + 2 * pad;
    const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d', { willReadFrequently: true }); g.fillStyle = pad ? '#7f7f7f' : '#fff'; g.fillRect(0, 0, w, h); if (pad) { g.fillStyle = '#fff'; g.fillRect(pad, pad, iw, ih); } g.drawImage(img, pad, pad, iw, ih);
    return { w, h, k, pad, d: g.getImageData(0, 0, w, h).data };
  }
  const lum = (d, i) => .299 * d[i] + .587 * d[i + 1] + .114 * d[i + 2];

  /* ---------- 1. finding the board ---------- */
  /* how strongly the brightness changes across each column (or row), only inside a band of the picture */
  function profile(P, vertical, from, to) {
    const n = vertical ? P.w : P.h, out = new Float32Array(n);
    for (let a = 0; a < n - 1; a++) { let s = 0; for (let b = from; b < to; b++) { const i = vertical ? (b * P.w + a) * 4 : (a * P.w + b) * 4, j = vertical ? i + 4 : i + P.w * 4; s += Math.abs(lum(P.d, i) - lum(P.d, j)); } out[a] = s; }
    return out;
  }
  /* nine evenly spaced strong lines: the edges of the eight files (or ranks) */
  function grid(p, n) {
    let mean = 0; for (let i = 0; i < n; i++) mean += p[i]; mean = mean / n || 1;
    const pk = i => Math.max(p[i - 1] || 0, p[i] || 0, p[i + 1] || 0);
    let best = { score: -1, x0: 0, s: n / 8 };
    for (let s = Math.max(6, n / 40); s <= n / 8 + .01; s += .5) {
      for (let x0 = 1; x0 + 8 * s < n - 1; x0++) {
        let inner = 0, worst = 1e9; for (let k = 1; k < 8; k++) { const v = pk(Math.round(x0 + k * s)); inner += v; if (v < worst) worst = v; }
        const score = (inner + .5 * (pk(x0) + pk(Math.round(x0 + 8 * s))) + 2 * worst) / mean;
        if (score > best.score) best = { score, x0, s };
      }
    }
    return best;
  }
  function findBoard(img) {
    const P = pixels(img, 700, 6);
    let gx = grid(profile(P, true, 0, P.h), P.w), gy = grid(profile(P, false, 0, P.w), P.h);
    for (let it = 0; it < 2; it++) {       // look again inside the band the other direction found
      gy = grid(profile(P, false, Math.max(0, Math.round(gx.x0)), Math.min(P.w - 1, Math.round(gx.x0 + 8 * gx.s))), P.h);
      gx = grid(profile(P, true, Math.max(0, Math.round(gy.x0)), Math.min(P.h - 1, Math.round(gy.x0 + 8 * gy.s))), P.w);
    }
    const sq = Math.abs(gx.s - gy.s) / Math.max(gx.s, gy.s), ok = sq < .12 && gx.score > 11 && gy.score > 11;
    const x0 = (gx.x0 - P.pad) / P.k, y0 = (gy.x0 - P.pad) / P.k, x1 = (gx.x0 + 8 * gx.s - P.pad) / P.k, y1 = (gy.x0 + 8 * gy.s - P.pad) / P.k;
    const pts = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
    /* a real board alternates light and dark squares: if what was found does not, say so (and let the corners be dragged) */
    const check = ok ? checker(img, pts) : 0;
    return { ok: ok && check > .55, pts, score: Math.min(gx.score, gy.score), checker: check };
  }
  function checker(img, pts) {
    const N = 160, q = N / 8, id = warp(img, pts, N), d = id.data, L = [], par = [];
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) { const ring = []; for (let k = 2; k < q - 2; k++) for (const [x, y] of [[c * q + k, r * q + 2], [c * q + k, r * q + q - 3], [c * q + 2, r * q + k], [c * q + q - 3, r * q + k]]) ring.push(lum(d, ((y | 0) * N + (x | 0)) * 4)); ring.sort((a, b) => a - b); L.push(ring[ring.length >> 1]); par.push((r + c) % 2); }
    const mL = L.reduce((a, b) => a + b) / 64, mP = .5; let num = 0, dl = 0, dp = 0; for (let i = 0; i < 64; i++) { num += (L[i] - mL) * (par[i] - mP); dl += (L[i] - mL) ** 2; dp += (par[i] - mP) ** 2; }
    return dl && dp ? Math.abs(num / Math.sqrt(dl * dp)) : 0;
  }

  /* ---------- 2. straightening: the four corners onto a square ---------- */
  function homography(src) {          // maps the unit square onto the four corners (top-left, top-right, bottom-right, bottom-left)
    const [[x0, y0], [x1, y1], [x2, y2], [x3, y3]] = src;
    const dx1 = x1 - x2, dx2 = x3 - x2, dx3 = x0 - x1 + x2 - x3, dy1 = y1 - y2, dy2 = y3 - y2, dy3 = y0 - y1 + y2 - y3;
    const den = dx1 * dy2 - dx2 * dy1, g = (dx3 * dy2 - dx2 * dy3) / den, h = (dx1 * dy3 - dx3 * dy1) / den;
    return [x1 - x0 + g * x1, x3 - x0 + h * x3, x0, y1 - y0 + g * y1, y3 - y0 + h * y3, y0, g, h];
  }
  function warp(img, pts, N) {
    const P = pixels(img, 2000), H = homography(pts.map(([x, y]) => [x * P.k, y * P.k])), out = new ImageData(N, N), o = out.data;
    for (let v = 0; v < N; v++) for (let u = 0; u < N; u++) {
      const s = (u + .5) / N, t = (v + .5) / N, w = H[6] * s + H[7] * t + 1, x = (H[0] * s + H[1] * t + H[2]) / w, y = (H[3] * s + H[4] * t + H[5]) / w;
      const xi = Math.max(0, Math.min(P.w - 2, Math.floor(x))), yi = Math.max(0, Math.min(P.h - 2, Math.floor(y))), fx = Math.min(1, Math.max(0, x - xi)), fy = Math.min(1, Math.max(0, y - yi));
      const j = (v * N + u) * 4;
      for (let ch = 0; ch < 3; ch++) { const a = P.d[(yi * P.w + xi) * 4 + ch], b = P.d[(yi * P.w + xi + 1) * 4 + ch], c = P.d[((yi + 1) * P.w + xi) * 4 + ch], d = P.d[((yi + 1) * P.w + xi + 1) * 4 + ch]; o[j + ch] = (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy; }
      o[j + 3] = 255;
    }
    return out;
  }

  /* ---------- shapes: a piece's outline, filled in, scaled into a small grid ---------- */
  const GW = 16, GH = 20;
  function shapeOf(mask, w, h) {
    /* fill the holes: anything the outside cannot reach is part of the piece */
    const seen = new Uint8Array(w * h), st = [];
    for (let x = 0; x < w; x++) { st.push(x, (h - 1) * w + x); } for (let y = 0; y < h; y++) { st.push(y * w, y * w + w - 1); }
    while (st.length) { const i = st.pop(); if (seen[i] || mask[i]) continue; seen[i] = 1; const x = i % w, y = (i / w) | 0; if (x > 0) st.push(i - 1); if (x < w - 1) st.push(i + 1); if (y > 0) st.push(i - w); if (y < h - 1) st.push(i + w); }
    let x0 = w, y0 = h, x1 = -1, y1 = -1, area = 0; const full = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) if (!seen[i]) { full[i] = 1; area++; const x = i % w, y = (i / w) | 0; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    if (x1 < 0) return null;
    const bw = x1 - x0 + 1, bh = y1 - y0 + 1, g = new Float32Array(GW * GH);
    for (let gy = 0; gy < GH; gy++) for (let gx = 0; gx < GW; gx++) { let n = 0, t = 0; const ya = y0 + Math.floor(gy * bh / GH), yb = y0 + Math.max(Math.floor((gy + 1) * bh / GH), Math.floor(gy * bh / GH) + 1), xa = x0 + Math.floor(gx * bw / GW), xb = x0 + Math.max(Math.floor((gx + 1) * bw / GW), Math.floor(gx * bw / GW) + 1); for (let y = ya; y < yb && y < h; y++) for (let x = xa; x < xb && x < w; x++) { n++; t += full[y * w + x]; } g[gy * GW + gx] = n ? t / n : 0; }
    return { g, bw, bh, asp: bh / bw, area, fill: area / (bw * bh), top: y0 / h, bot: y1 / h, full };
  }
  const iou = (a, b) => { let i = 0, u = 0; for (let k = 0; k < a.length; k++) { i += Math.min(a[k], b[k]); u += Math.max(a[k], b[k]); } return u ? i / u : 0; };

  /* ---------- reference pieces: every piece set in the app, plus the chess symbols in the fonts on this PC ---------- */
  let REF = null;
  async function refs() {
    if (REF) return REF; REF = [];
    const S = 96, draw = async (paint, set) => {
      const per = {};
      for (let t = 1; t <= 6; t++) {
        const c = document.createElement('canvas'); c.width = S; c.height = S; const g = c.getContext('2d', { willReadFrequently: true });
        if (!(await paint(g, t))) continue;
        const d = g.getImageData(0, 0, S, S).data, m = new Uint8Array(S * S); for (let i = 0; i < S * S; i++) m[i] = d[i * 4 + 3] > 100 ? 1 : 0;
        const sh = shapeOf(m, S, S); if (sh) per[t] = sh;
      }
      const hmax = Math.max(...Object.values(per).map(s => s.bh), 1);
      for (const t in per) REF.push(Object.assign(per[t], { t: +t, set, hn: per[t].bh / hmax }));
    };
    /* the app's own piece sets (drawn shapes; the playful Roman soldiers are left out) */
    if (window.ChessSet && ChessSet.html) for (const set of ['classic', 'gothic', 'pixel', 'bubble', 'totem', 'rune'].filter(x => !(window.__csHold || []).includes(x))) {      /* __csHold: a test can hide a style, to check pieces the scanner has never seen */
      await draw(async (g, t) => {
        const h = ChessSet.html(t, set), m = h.match(/<svg[\s\S]*<\/svg>/); if (!m) return false;
        const svg = m[0].replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" fill="#000" stroke="#000"').replace(/class="[^"]*"/g, '');
        try { const im = await loadImg('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)); g.drawImage(im, 0, 0, 96, 96); return true; } catch (e) { return false; }
      }, set);
    }
    /* chess symbols in common fonts (the shapes most books and websites use) */
    for (const font of ['Segoe UI Symbol', 'Arial Unicode MS', 'DejaVu Sans', 'serif'].filter(x => !(window.__csHold || []).includes('font:' + x))) {
      await draw(async (g, t) => { g.font = '84px "' + font + '"'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#000'; g.fillText(String.fromCodePoint(0x265A + (6 - t)), 48, 52); return true; }, 'font:' + font);
    }
    return REF;
  }

  /* ---------- 3. reading the squares ---------- */
  async function read(id, opts) {
    opts = opts || {}; const ref = await refs(), N = id.width, q = N / 8, d = id.data, sq = [];
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
      const X = Math.round(c * q), Y = Math.round(r * q), Q = Math.round(q), m0 = Math.max(2, Math.round(Q * .06));
      /* the square's own colour, from a thin ring just inside its edges */
      const ring = []; for (let y = Y + m0; y < Y + Q - m0; y++) for (let x = X + m0; x < X + Q - m0; x++) { const e = Math.min(x - X, X + Q - 1 - x, y - Y, Y + Q - 1 - y); if (e <= m0 + 2) { const i = (y * N + x) * 4; ring.push([d[i], d[i + 1], d[i + 2]]); } }
      const med = k => { const a = ring.map(p => p[k]).sort((a, b) => a - b); return a[a.length >> 1] || 0; }, bg = [med(0), med(1), med(2)];
      const devs = ring.map(p => Math.hypot(p[0] - bg[0], p[1] - bg[1], p[2] - bg[2])).sort((a, b) => a - b), mad = devs[devs.length >> 1] || 0, T = Math.max(42, mad * 3.5);
      /* the pixels that are not the square: the piece, if there is one */
      const inner = Math.round(Q * .08), w = Q - 2 * inner, h = Q - 2 * inner, mask = new Uint8Array(w * h); let n = 0; const L = [];
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = ((Y + inner + y) * N + X + inner + x) * 4, dist = Math.hypot(d[i] - bg[0], d[i + 1] - bg[1], d[i + 2] - bg[2]); if (dist > T) { mask[y * w + x] = 1; n++; L.push(lum(d, i)); } }
      const bgL = .299 * bg[0] + .587 * bg[1] + .114 * bg[2];
      const sh = n / (w * h) > .045 ? shapeOf(mask, w, h) : null;
      /* how light the whole piece is: every pixel inside its outline, the outline included */
      let sumL = 0, cnt = 0; if (sh) for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (sh.full[y * w + x]) { sumL += lum(d, ((Y + inner + y) * N + X + inner + x) * 4); cnt++; }
      /* how black a piece is: how much of its shape is ink, times how dark that ink is. A white piece is light, or (in
         books) a hollow outline; a black piece is solid and dark. */
      const inkL = L.length ? L.reduce((a, b) => a + b, 0) / L.length : 0, ink = sh ? Math.min(1, n / sh.area) : 0;
      sq.push({ r, c, bgL, sh: sh && sh.area / (w * h) > .06 && sh.bh > h * .25 ? sh : null, Lin: cnt ? sumL / cnt : 0, ink, dark: ink * ink * (1 - inkL / 255) });   /* solid and dark = black; an outline with the square showing through = white */
    }
    let occ = sq.filter(s => s.sh), hmax = 0;
    const judge = () => {
      /* white or black: two groups of brightness (a white piece is light inside its dark outline; a black piece is dark) */
      const v = s => 1 - s.dark; let lo = Math.min(...occ.map(v)), hi = Math.max(...occ.map(v));     /* high = white */
      if (hi - lo < .2) { occ.forEach(s => s.white = v(s) > .38); }
      else { for (let it = 0; it < 12; it++) { const A = [], B = []; occ.forEach(s => (Math.abs(v(s) - lo) < Math.abs(v(s) - hi) ? A : B).push(v(s))); if (A.length) lo = A.reduce((a, b) => a + b) / A.length; if (B.length) hi = B.reduce((a, b) => a + b) / B.length; } occ.forEach(s => s.white = Math.abs(v(s) - hi) < Math.abs(v(s) - lo)); }
      /* which piece: the outline against every reference piece, with its height compared with the tallest piece on the board */
      hmax = Math.max(...occ.map(s => s.sh.bh));
      occ.forEach(s => {
        const hn = s.sh.bh / hmax, sc = [0, -9, -9, -9, -9, -9, -9];
        for (const R of ref) { const val = iou(s.sh.g, R.g) - 1.1 * Math.abs(hn - R.hn) - .35 * Math.abs(Math.log(s.sh.asp / R.asp)); if (val > sc[R.t]) sc[R.t] = val; }
        s.scores = sc; const order = [1, 2, 3, 4, 5, 6].sort((a, b) => sc[b] - sc[a]); s.t = order[0]; s.alt = order[1]; s.conf = Math.max(0, Math.min(1, (sc[order[0]] - sc[order[1]]) * 6 + .3));
      });
    };
    if (occ.length) judge();
    /* a mark that looks like no chess piece at all (a smudge, a line, the edge of the picture) is not one: drop it, and judge
       the rest again without it, since it would skew both the white/black split and the tallest-piece height */
    const real = occ.filter(s => Math.max(...s.scores.slice(1)) >= .3);
    if (real.length < occ.length) { occ = real; if (occ.length) judge(); }
    if (!occ.length) return { board: Array(64).fill(''), conf: Array(64).fill(1), flipped: false, pieces: 0 };
    /* 3b. on any one board, pieces of the same kind look the same: group the matching shapes, then name each group from
       all its members together and from what chess allows (one king a side; more than two alike are almost always pawns;
       the shortest big group is usually the pawns). One clear pawn then settles the blurry ones. */
    const same = (a, b) => iou(a.sh.g, b.sh.g) > .86 && Math.abs(a.sh.bh - b.sh.bh) / hmax < .05 && Math.abs(Math.log(a.sh.asp / b.sh.asp)) < .12;
    const groups = []; occ.forEach(s => { const g = groups.find(G => G.filter(x => same(x, s)).length >= Math.max(1, G.length * .6)); if (g) g.push(s); else groups.push([s]); });
    const ev = groups.map(G => { const sc = [0, 0, 0, 0, 0, 0, 0]; G.forEach(s => { for (let t = 1; t <= 6; t++) sc[t] += s.scores[t]; }); for (let t = 1; t <= 6; t++) sc[t] /= G.length; const w = G.filter(s => s.white).length; return { G, sc, hn: G.reduce((a, s) => a + s.sh.bh, 0) / G.length / hmax, w, b: G.length - w }; });
    ev.forEach(e => { const mx = Math.max(e.w, e.b); if (mx > 1) { e.sc[6] -= 1; e.sc[5] -= .1; } if (mx > 2) { e.sc[2] -= .25; e.sc[3] -= .25; e.sc[4] -= .25; e.sc[5] -= .4; e.sc[1] += .15; } });
    const pawnish = ev.filter(e => e.G.length >= 3).sort((a, b) => a.hn - b.hn)[0]; if (pawnish) pawnish.sc[1] += .12;
    const LIMIT = { 2: 2, 3: 2, 4: 2, 5: 1, 6: 1 };
    ev.forEach(e => { e.order = [1, 2, 3, 4, 5, 6].sort((a, b) => e.sc[b] - e.sc[a]); e.k = 0; });
    for (let round = 0; round < 6; round++) {       /* two groups both claiming, say, knights, with too many for one side: the weaker one takes its next choice */
      let moved = false;
      for (let t = 2; t <= 6; t++) {
        const claim = ev.filter(e => e.order[e.k] === t); if (claim.length < 2) continue;
        const per = c => claim.reduce((a, e) => a + (c ? e.w : e.b), 0);
        if (per(true) > LIMIT[t] || per(false) > LIMIT[t]) { const weak = claim.sort((a, b) => a.sc[t] - b.sc[t])[0]; if (weak.k < 5) { weak.k++; moved = true; } }
      }
      if (!moved) break;
    }
    ev.forEach(e => { const t = e.order[e.k], nx = e.order[e.k + 1] || e.order[0], margin = e.sc[t] - e.sc[nx]; e.G.forEach(s => {
      if (s.t !== t && s.scores[s.t] - s.scores[t] > .12) return;       /* a piece whose own shape clearly says otherwise keeps its own reading */
      s.t = t; s.conf = Math.max(0, Math.min(1, margin * 6 + .3 + (e.G.length > 1 ? .15 : 0))); }); });
    /* 4. sense checks */
    const fix = (white, t, want) => { const mine = occ.filter(s => s.white === white && s.t === t); if (mine.length <= want) return; mine.sort((a, b) => b.scores[t] - a.scores[t]).slice(want).forEach(s => { s.scores[t] = -9; const o = [1, 2, 3, 4, 5].filter(x => x !== t).sort((a, b) => s.scores[b] - s.scores[a]);      /* the next most likely piece, never another king */ s.t = o[0]; s.conf = Math.min(s.conf, .3); }); };
    for (const wh of [true, false]) {
      fix(wh, 6, 1); fix(wh, 1, 8);
      if (!occ.some(s => s.white === wh && s.t === 6)) { const k = occ.filter(s => s.white === wh).sort((a, b) => b.scores[6] - a.scores[6])[0]; if (k) { k.t = 6; k.conf = Math.min(k.conf, .3); } }
    }
    /* which way round: white usually starts at the bottom; pawns can never stand on the back ranks */
    const below = occ.filter(s => s.white && s.r >= 4).length - occ.filter(s => s.white && s.r < 4).length, blackBelow = occ.filter(s => !s.white && s.r >= 4).length - occ.filter(s => !s.white && s.r < 4).length;
    let flipped = opts.flipped !== undefined ? opts.flipped : below - blackBelow < 0;
    const board = Array(64).fill(''), conf = Array(64).fill(1);
    occ.forEach(s => { let r = s.r, c = s.c; if (flipped) { r = 7 - r; c = 7 - c; } const i = r * 8 + c; let t = s.t; if (t === 1 && (r === 0 || r === 7)) { t = [2, 3, 4, 5].sort((a, b) => s.scores[b] - s.scores[a])[0]; s.conf = Math.min(s.conf, .3); } board[i] = s.white ? TYPES[t] : TYPES[t].toLowerCase(); conf[i] = s.conf; });
    return { board, conf, flipped, pieces: occ.length, debug: opts.debug ? occ.map(o => ({ sq: 'abcdefgh'[o.c] + (8 - o.r), t: o.t, white: o.white, dark: +o.dark.toFixed(2), ink: +o.ink.toFixed(2), hn: +(o.sh.bh / hmax).toFixed(2), asp: +o.sh.asp.toFixed(2), sc: o.scores.slice(1).map(x => +x.toFixed(2)) })) : undefined };
  }

  /* ---------- the position as FEN ---------- */
  function fenOf(board, side, opts) {
    opts = opts || {}; let f = '';
    for (let r = 0; r < 8; r++) { let e = 0; for (let c = 0; c < 8; c++) { const p = board[r * 8 + c]; if (!p) e++; else { if (e) { f += e; e = 0; } f += p; } } if (e) f += e; if (r < 7) f += '/'; }
    /* castling: only where the king and rook still stand on their home squares */
    let cr = ''; if (board[60] === 'K') { if (board[63] === 'R') cr += 'K'; if (board[56] === 'R') cr += 'Q'; } if (board[4] === 'k') { if (board[7] === 'r') cr += 'k'; if (board[0] === 'r') cr += 'q'; }
    if (opts.noCastle) cr = '';
    return f + ' ' + (side === 'b' ? 'b' : 'w') + ' ' + (cr || '-') + ' - 0 1';
  }
  function problems(board, side) {
    const out = [], n = p => board.filter(x => x === p).length;
    if (n('K') !== 1) out.push('There must be exactly one white king (there ' + (n('K') === 0 ? 'is none' : 'are ' + n('K')) + ').');
    if (n('k') !== 1) out.push('There must be exactly one black king (there ' + (n('k') === 0 ? 'is none' : 'are ' + n('k')) + ').');
    if (board.some((p, i) => (p === 'P' || p === 'p') && (i < 8 || i > 55))) out.push('A pawn is on the first or last rank, which cannot happen.');
    if (n('P') > 8 || n('p') > 8) out.push('One side has more than eight pawns.');
    if (!out.length && C) { try { const p = new C.Pos().setFen(fenOf(board, side)); if (p.attacked(p.ksq[p.side > 0 ? 1 : 0], p.side)) out.push('The side that is not to move is in check, so it must be the other side’s move.'); } catch (e) { out.push('That is not a position the engine can use.'); } }
    return out;
  }

  window.ChessScan = { findBoard, warp, read, fenOf, problems, refs, loadImg, _t: { homography, shapeOf, iou, grid } };
})();

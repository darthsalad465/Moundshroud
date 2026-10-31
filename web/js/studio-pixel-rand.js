// Studio > Pixel art > "Random pixel art": makes a new picture from a seed number. window.PixelRand.make(kind, w, h, seed, palette) -> array of w*h colours ('#rrggbb' or null).
// Every kind is drawn from the chosen palette so the results always look like they belong together. The same seed always gives the same picture.
(() => {
  const rngOf = seed => { let s = (seed >>> 0) || 1; return () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296; };
  const hexN = h => { const v = parseInt(h.replace('#', ''), 16); return [v >> 16 & 255, v >> 8 & 255, v & 255]; };
  const nHex = c => '#' + c.map(x => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, '0')).join('');
  const lum = h => { const c = hexN(h); return .299 * c[0] + .587 * c[1] + .114 * c[2]; };
  const mix = (a, b, t) => { const x = hexN(a), y = hexN(b); return nHex(x.map((v, i) => v + (y[i] - v) * t)); };
  /* the nearest palette colour to any colour, so shading stays inside the palette */
  const snapTo = (pal, h) => { const c = hexN(h); let best = pal[0], bd = 1e9; for (const p of pal) { const q = hexN(p), d = (q[0] - c[0]) ** 2 + (q[1] - c[1]) ** 2 + (q[2] - c[2]) ** 2; if (d < bd) { bd = d; best = p; } } return best; };
  const MAKERS = {};
  const grid = (w, h) => { const g = new Array(w * h).fill(null); return { g, w, h, set(x, y, c) { x = Math.round(x); y = Math.round(y); if (x >= 0 && y >= 0 && x < w && y < h) g[y * w + x] = c; }, get(x, y) { return x >= 0 && y >= 0 && x < w && y < h ? g[y * w + x] : null; }, rect(x, y, a, b, c) { for (let j = 0; j < b; j++) for (let i = 0; i < a; i++) this.set(x + i, y + j, c); }, disc(cx, cy, r, c) { for (let y = Math.floor(cy - r); y <= cy + r; y++) for (let x = Math.floor(cx - r); x <= cx + r; x++) if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) this.set(x, y, c); } }; };
  const sorted = pal => pal.slice().sort((a, b) => lum(a) - lum(b));
  /* outline every filled pixel that touches an empty one, and shade the lower edge */
  const finish = (G, dark, outline) => { const { w, h } = G, src = G.g.slice(); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { if (src[y * w + x]) continue; const n = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => x + a >= 0 && y + b >= 0 && x + a < w && y + b < h && src[(y + b) * w + x + a]); if (n && outline) G.g[y * w + x] = outline; } };

  /* creature: a left half of random blobs mirrored, with eyes, shading and an outline */
  MAKERS.monster = (w, h, R, pal) => {
    const G = grid(w, h), S = sorted(pal), body = pal[1 + Math.floor(R() * (pal.length - 1))] || pal[0], dark = snapTo(S, mix(body, '#000000', .45)), light = snapTo(S, mix(body, '#ffffff', .4)), cw = Math.ceil(w / 2), mx = Math.floor(w * .12), my = Math.floor(h * .12);
    const m = Array.from({ length: h }, () => Array(cw).fill(0)); const cx = cw - 1, cy = h / 2; for (let y = my; y < h - my; y++) for (let x = mx; x < cw; x++) { const d = Math.hypot((x - cx) / (cw - mx), (y - cy) / (h / 2 - my)); if (R() < Math.max(0, 1.15 - d * .95) + (R() < .08 ? .3 : 0)) m[y][x] = 1; }
    for (let k = 0; k < 2; k++) for (let y = 1; y < h - 1; y++) for (let x = 1; x < cw; x++) { const n = m[y - 1][x] + m[y + 1][x] + m[y][x - 1] + (m[y][x + 1] || 0) + m[y][x]; if (n >= 3) m[y][x] = 1; else if (n <= 1) m[y][x] = 0; }
    for (let y = 0; y < h; y++) for (let x = 0; x < cw; x++) if (m[y][x]) { const c = y < h * .33 ? light : (!m[y + 1] || !m[y + 1][x]) ? dark : body; G.set(x, y, c); G.set(w - 1 - x, y, c); }
    const ey = Math.floor(h * (.3 + R() * .15)), ex = Math.floor(w / 2 - 1 - R() * w * .14 - 1); for (const sx of [ex, w - 1 - ex]) { G.set(sx, ey, '#ffffff'); if (w >= 16) { G.set(sx, ey + 1, '#ffffff'); G.set(sx + (sx < w / 2 ? 1 : -1), ey, '#ffffff'); } G.set(sx, ey + (w >= 16 ? 1 : 0), '#111111'); }
    if (R() < .6) for (let x = Math.floor(w * .38); x < w * .62; x++) G.set(x, Math.floor(h * .62), '#1b1b1b'); finish(G, dark, snapTo(S, '#0a0a14')); return G.g;
  };
  /* spaceship: symmetric, nose up */
  MAKERS.ship = (w, h, R, pal) => {
    const G = grid(w, h), S = sorted(pal), hull = pal[1 + Math.floor(R() * (pal.length - 1))] || pal[0], hi = snapTo(S, mix(hull, '#ffffff', .45)), lo = snapTo(S, mix(hull, '#000000', .5)), acc = pal[Math.floor(R() * pal.length)], c = Math.floor(w / 2);
    const prof = []; let wd = 1; for (let y = 0; y < h; y++) { const t = y / h; wd += (R() < .5 ? 1 : 0) * (t < .6 ? 1 : -1) * (R() < .5 ? 1 : 0); wd = Math.max(1, Math.min(w / 2 - 2, wd)); prof.push(wd); }
    for (let y = Math.floor(h * .08); y < h * .88; y++) { const half = Math.round(prof[y] * (y > h * .5 && y < h * .78 ? 1.9 : 1)); for (let x = -half; x <= half; x++) { const shade = x < -half + 1 ? lo : x === 0 ? hi : x > half - 1 ? lo : hull; G.set(c + x, y, shade); if (w % 2 === 0) G.set(c - 1 - x, y, shade); } }
    G.disc(c, Math.floor(h * .3), Math.max(1, w / 12), snapTo(S, '#8fe3ff')); const fy = Math.floor(h * .88); for (let k = 0; k < Math.floor(h * .12); k++) for (const sx of [-Math.max(1, w / 8), Math.max(1, w / 8)]) { G.set(c + sx, fy + k, k < 2 ? '#ffe66d' : '#ff8a3d'); }
    for (let y = Math.floor(h * .55); y < h * .8; y++) { const half = prof[y] + Math.floor((y - h * .55) * .5); G.set(c - half - 1, y, acc); G.set(c + half + 1, y, acc); } finish(G, lo, '#0b0b16'); return G.g;
  };
  /* robot: boxes */
  MAKERS.robot = (w, h, R, pal) => {
    const G = grid(w, h), S = sorted(pal), metal = pal[1 + Math.floor(R() * (pal.length - 1))] || pal[0], hi = snapTo(S, mix(metal, '#ffffff', .4)), lo = snapTo(S, mix(metal, '#000000', .5)), led = pal[Math.floor(R() * pal.length)], c = Math.floor(w / 2);
    const hw = Math.floor(w * .5), hh = Math.floor(h * .3), bw = Math.floor(w * .6), bh = Math.floor(h * .34), x0 = c - Math.floor(hw / 2), by = Math.floor(h * .06) + hh + 1;
    G.rect(c - 0, Math.floor(h * .02), 1, Math.floor(h * .06), lo); G.set(c, Math.floor(h * .02), '#ff4d4d'); G.rect(x0, Math.floor(h * .08), hw, hh, metal); G.rect(x0, Math.floor(h * .08), hw, 1, hi); G.rect(x0, Math.floor(h * .08) + hh - 1, hw, 1, lo);
    const ey = Math.floor(h * .08) + Math.floor(hh / 2) - 1, ew = Math.max(1, Math.floor(hw / 6)); G.rect(x0 + Math.floor(hw / 4) - 1, ey, ew + 1, ew + 1, led); G.rect(x0 + hw - Math.floor(hw / 4) - ew, ey, ew + 1, ew + 1, led);
    G.rect(x0 + Math.floor(hw / 4), ey + ew + 3, Math.floor(hw / 2), 1, lo); G.rect(c - bw / 2 | 0, by, bw, bh, metal); G.rect(c - bw / 2 | 0, by, bw, 1, hi); G.rect(c - bw / 2 | 0, by + bh - 1, bw, 1, lo); G.rect(c - 2, by + 2, 4, 3, led); for (let k = 0; k < 3; k++) G.set(c - 3 + k * 3, by + bh - 4, lo);
    const aw = Math.max(1, Math.floor(w * .12)); G.rect((c - bw / 2 | 0) - aw - 1, by, aw, bh - 1, lo); G.rect((c + bw / 2 | 0) + 1, by, aw, bh - 1, lo); const ly = by + bh; G.rect(c - bw / 3 | 0, ly, aw + 1, h - ly - 1, lo); G.rect(c + bw / 3 - aw | 0, ly, aw + 1, h - ly - 1, lo); G.rect((c - bw / 3 | 0) - 1, h - 2, aw + 3, 2, metal); G.rect((c + bw / 3 - aw | 0) - 1, h - 2, aw + 3, 2, metal); finish(G, lo, '#0b0b16'); return G.g;
  };
  /* planet with bands or rings, stars around */
  MAKERS.planet = (w, h, R, pal) => {
    const G = grid(w, h), S = sorted(pal), bg = S[0]; G.rect(0, 0, w, h, snapTo(S, mix(bg, '#000000', .6))); for (let i = 0; i < w * h / 40; i++) G.set(R() * w, R() * h, R() < .3 ? '#ffffff' : snapTo(S, '#9fb3d9'));
    const r = Math.min(w, h) * (.3 + R() * .1), cx = w / 2, cy = h / 2, base = pal[1 + Math.floor(R() * (pal.length - 1))] || pal[0], b2 = pal[Math.floor(R() * pal.length)], lx = -.6, ly = -.6, ring = R() < .5;
    if (ring) for (let t = 0; t < 6.3; t += .02) { const x = cx + Math.cos(t) * r * 1.7, y = cy + Math.sin(t) * r * .45; if (!(Math.sin(t) < 0 && Math.abs(x - cx) < r * .98)) G.set(x, y, snapTo(S, mix(b2, '#ffffff', .3))); }
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const dx = (x - cx) / r, dy = (y - cy) / r, d = dx * dx + dy * dy; if (d > 1) continue; const z = Math.sqrt(1 - d), l = Math.max(0, dx * lx * -1 + dy * ly * -1 + z * .6), band = Math.sin(dy * (5 + R() * 0) + dx * .6) > .25; const col = band ? b2 : base; G.set(x, y, snapTo(S, mix(col, l > .55 ? '#ffffff' : '#000000', l > .55 ? (l - .55) * .8 : (.55 - l) * .85))); }
    if (ring) for (let t = 0; t < 3.14; t += .02) G.set(cx + Math.cos(t) * r * 1.7, cy + Math.sin(t) * r * .45, snapTo(S, mix(b2, '#ffffff', .3))); return G.g;
  };
  /* landscape: a sky that fades to the horizon, a sun, three hazy ridges and pine trees, all in palette colours */
  MAKERS.landscape = (w, h, R, pal) => {
    const G = grid(w, h), S = sorted(pal), blue = c => { const q = hexN(c); return q[2] - (q[0] + q[1]) / 2; }, green = c => { const q = hexN(c); return q[1] - (q[0] + q[2]) / 2; };
    const top = pal.slice().sort((x, y) => blue(y) - blue(x))[0], hor = snapTo(S, mix(top, '#ffffff', .55)), sunC = snapTo(S, '#ffe9a0'), grn = pal.slice().sort((x, y) => green(y) - green(x))[0];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const t = Math.max(0, Math.min(1, y / (h * .62) + ((x + y) % 2 ? .07 : -.07))); G.set(x, y, snapTo(S, mix(top, hor, t))); }
    const sx = w * (.2 + R() * .6), sy = h * (.2 + R() * .2), sr = Math.max(2, w * .075); G.disc(sx, sy, sr + 1, snapTo(S, mix(hor, sunC, .5))); G.disc(sx, sy, sr, sunC);
    const layers = [[.5, .09, snapTo(S, mix(hor, top, .55))], [.6, .08, snapTo(S, mix(grn, hor, .5))], [.72, .06, snapTo(S, mix(grn, '#000000', .4))]];
    layers.forEach(([base, amp, col], l) => { const p1 = R() * 9, p2 = R() * 9, f1 = .12 + R() * .1 + l * .04, f2 = .31 + R() * .2; for (let x = 0; x < w; x++) { const y0 = h * base + Math.sin(x * f1 + p1) * h * amp + Math.sin(x * f2 + p2) * h * amp * .45 + (R() - .5) * (l + 1) * .5; for (let y = Math.floor(y0); y < h; y++) G.set(x, y, y === Math.floor(y0) && l < 2 ? snapTo(S, mix(col, '#ffffff', .25)) : col); } });
    const pine = snapTo(S, mix(grn, '#000000', .62)); for (let i = 0; i < Math.max(2, w / 6); i++) { const tx = Math.floor(R() * w), ty = Math.floor(h * (.8 + R() * .16)), th = Math.max(3, Math.floor(h * (.14 + R() * .08))); for (let k = 0; k < th; k++) { const hw = Math.floor(k / 2.2); for (let q = -hw; q <= hw; q++) G.set(tx + q, ty - th + k, pine); } G.set(tx, ty + 1, '#4a3020'); }
    return G.g;
  };
  /* potion bottle */
  MAKERS.potion = (w, h, R, pal) => {
    const G = grid(w, h), S = sorted(pal), liq = pal[1 + Math.floor(R() * (pal.length - 1))] || pal[0], c = Math.floor(w / 2), glass = snapTo(S, '#cfe8f5'), bw = Math.floor(w * .62), nw = Math.max(2, Math.floor(w * .22)), neck = Math.floor(h * .32), by = Math.floor(h * .36);
    G.rect(c - nw / 2 | 0, Math.floor(h * .05), nw, Math.floor(h * .1), '#8a5a2b'); G.rect(c - nw / 2 | 0, Math.floor(h * .15), nw, neck - Math.floor(h * .15), glass);
    for (let y = by; y < h - 1; y++) { const t = (y - by) / (h - 1 - by), half = Math.round(bw / 2 * Math.sqrt(Math.sin(Math.min(1, t * 1.4 + .15) * Math.PI / 2 + .0))); for (let x = -half; x <= half; x++) G.set(c + x, y, y > by + (h - by) * .25 ? (x < -half + 1 ? snapTo(S, mix(liq, '#ffffff', .5)) : x > half - 1 ? snapTo(S, mix(liq, '#000000', .4)) : liq) : glass); }
    for (let k = 0; k < 3; k++) G.set(c + Math.floor((R() - .5) * bw * .5), Math.floor(h * (.55 + R() * .25)), snapTo(S, mix(liq, '#ffffff', .6))); G.set(c - bw / 3 | 0, by + 2, '#ffffff'); finish(G, null, '#0b0b16'); return G.g;
  };
  /* gem with facets */
  MAKERS.gem = (w, h, R, pal) => {
    const G = grid(w, h), S = sorted(pal), col = pal[1 + Math.floor(R() * (pal.length - 1))] || pal[0], c = (w - 1) / 2, top = Math.floor(h * .2), mid = Math.floor(h * .38), bot = h - 2;
    for (let y = top; y <= bot; y++) { const half = y <= mid ? (w * .46) * (.6 + .4 * (y - top) / Math.max(1, mid - top)) : (w * .46) * (1 - (y - mid) / Math.max(1, bot - mid)); for (let x = -Math.floor(half); x <= Math.floor(half); x++) { const fx = Math.abs(x) / Math.max(1, half), t = (x < 0 ? 1 : -1) * .3 + (y <= mid ? .15 : -.1) + (Math.abs(x) < 1 ? .3 : 0) + (fx > .6 ? -.2 : 0); G.set(c + x, y, snapTo(S, mix(col, t > 0 ? '#ffffff' : '#000000', Math.abs(t) * 1.2))); } }
    G.set(c - 2, top + 1, '#ffffff'); G.set(c - 1, top + 1, '#ffffff'); G.set(w - 2, top - 1, '#ffffff'); G.set(w - 2, top - 2, '#ffffff'); G.set(w - 3, top - 1, '#ffffff'); finish(G, null, '#0b0b16'); return G.g;
  };
  /* flower */
  MAKERS.flower = (w, h, R, pal) => {
    const G = grid(w, h), S = sorted(pal), pet = pal[1 + Math.floor(R() * (pal.length - 1))] || pal[0], c = Math.floor(w / 2), cy = Math.floor(h * .36), n = 5 + Math.floor(R() * 4), r = Math.min(w, h) * .26, green = snapTo(S, '#3f9a48');
    for (let y = cy; y < h; y++) G.set(c + Math.round(Math.sin(y * .25) * 1.2), y, green); for (let k = 0; k < 2; k++) { const ly = Math.floor(h * (.62 + k * .15)), dir = k ? -1 : 1; for (let i = 0; i < w * .22; i++) { G.set(c + dir * i, ly - Math.floor(i * .45), green); G.set(c + dir * i, ly - Math.floor(i * .45) + 1, snapTo(S, mix(green, '#000000', .3))); } }
    for (let i = 0; i < n; i++) { const a = i / n * 6.283; G.disc(c + Math.cos(a) * r, cy + Math.sin(a) * r, r * .62, snapTo(S, mix(pet, '#000000', i % 2 ? .12 : 0))); } G.disc(c, cy, r * .5, snapTo(S, '#ffd24a')); G.set(c - 1, cy - 1, snapTo(S, '#fff3b0')); finish(G, null, '#0b0b16'); return G.g;
  };
  /* tree with a round canopy */
  MAKERS.tree = (w, h, R, pal) => {
    const G = grid(w, h), S = sorted(pal), leaf = snapTo(S, '#3f9a48'), c = Math.floor(w / 2), tw = Math.max(2, Math.floor(w / 8));
    G.rect(c - tw / 2 | 0, Math.floor(h * .5), tw, Math.floor(h * .46), '#6b4a2a'); G.rect(c - tw / 2 | 0, Math.floor(h * .5), 1, Math.floor(h * .46), '#8a6a3a');
    const blobs = 4 + Math.floor(R() * 3); for (let i = 0; i < blobs; i++) { const bx = c + (R() - .5) * w * .42, by = h * (.18 + R() * .26), br = w * (.16 + R() * .1); for (let y = Math.floor(by - br); y <= by + br; y++) for (let x = Math.floor(bx - br); x <= bx + br; x++) { const d = Math.hypot(x - bx, y - by); if (d <= br) { const t = (-(x - bx) * .5 - (y - by) * .8) / br; G.set(x, y, snapTo(S, mix(leaf, t > .15 ? '#ffffff' : '#000000', t > .15 ? .25 : (.3 - t * .4)))); } } }
    finish(G, null, '#0b0b16'); return G.g;
  };
  const KINDS = [['monster', '👾 Monster'], ['ship', '🚀 Spaceship'], ['robot', '🤖 Robot'], ['planet', '🪐 Planet'], ['landscape', '🏞️ Landscape'], ['potion', '🧪 Potion'], ['gem', '💎 Gem'], ['flower', '🌸 Flower'], ['tree', '🌳 Tree']];
  window.PixelRand = { KINDS, make(kind, w, h, seed, palette) { const R = rngOf(seed * 2654435761 + 12345); const pal = palette.length >= 3 ? palette : palette.concat(['#222222', '#dddddd', '#888888']); const out = MAKERS[kind](w, h, R, pal); return out; } };
})();

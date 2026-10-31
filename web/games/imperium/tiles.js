/* IMPERIUM — the world art room. Every tile, wall, roof, column, statue, tree and piece of furniture in the game
   is drawn here, pixel by pixel, into small canvases while the game loads. There are no picture files anywhere and
   nothing is ever downloaded: the same seed always builds the same Rome. Draw order is deliberate — base colours,
   then a 3-tone ramp for form, then weathering and clutter on top, then a hard 1px outline — because that is the
   order a person drawing by hand works in. */
window.PIXTOOLS = (() => {
  'use strict';
  const T = 32;                                             // one tile, in pixels

  const rng = seed => { let a = (seed >>> 0) || 0x9e3779b9; return () => { a += 0x6d2b79f5; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
  const hash = s => { let h = 2166136261; s = String(s); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
  const cv = (w, h) => { const c = document.createElement('canvas'); c.width = Math.max(1, w | 0); c.height = Math.max(1, h | 0); const g = c.getContext('2d'); g.imageSmoothingEnabled = false; return c; };
  const ctx = c => c.getContext('2d');
  const px = (g, x, y, w, h, col) => { g.fillStyle = col; g.fillRect(x | 0, y | 0, Math.max(1, w | 0), Math.max(1, h | 0)); };
  const rgb = h => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const toHex = (r, g2, b) => '#' + ((Math.max(0, Math.min(255, r | 0)) << 16) | (Math.max(0, Math.min(255, g2 | 0)) << 8) | Math.max(0, Math.min(255, b | 0))).toString(16).padStart(6, '0');
  const mix = (a, b, k) => { const A = rgb(a), B = rgb(b); return toHex(A[0] + (B[0] - A[0]) * k, A[1] + (B[1] - A[1]) * k, A[2] + (B[2] - A[2]) * k); };
  const shade = (c, k) => mix(c, k < 0 ? '#0a0a0c' : '#fff6df', Math.abs(k));
  const warm = (c, k) => mix(c, '#c98a3a', k);              // sun-bleached plaster
  const ramp = base => ({ base, d2: shade(base, -.14), d: shade(base, -.32), dd: shade(base, -.5), hi: shade(base, .14), hi2: shade(base, .3) });
  const lerp = (a, b, k) => a + (b - a) * k;
  const cl = (v, a, b) => Math.max(a, Math.min(b, v));
  const pickr = (r, a) => a[Math.min(a.length - 1, Math.floor(r() * a.length))];
  const chance = (r, p) => r() < p;

  /* a hard 1px dark edge, the way hand-drawn sprites are outlined */
  function edge(c, col, spread) {
    const w = c.width, h = c.height, o = cv(w, h), g = ctx(o);
    const sil = cv(w, h), s = ctx(sil);
    s.drawImage(c, 0, 0); s.globalCompositeOperation = 'source-in';
    s.fillStyle = col || 'rgba(24,16,20,.85)'; s.fillRect(0, 0, w, h);
    const sp = spread || [[-1, 0], [1, 0], [0, -1], [0, 1]];
    sp.forEach(p => g.drawImage(sil, p[0], p[1]));
    g.drawImage(c, 0, 0);
    return o;
  }
  /* a soft ellipse shadow under anything that stands up */
  function shadow(c, w, h, cx, cy, a) {
    const g = ctx(c); g.save(); g.globalAlpha = a === undefined ? .3 : a;
    const grd = g.createRadialGradient(cx, cy, 0, cx, cy, Math.max(2, w / 2));
    grd.addColorStop(0, 'rgba(12,8,14,.85)'); grd.addColorStop(1, 'rgba(12,8,14,0)');
    g.fillStyle = grd; g.translate(cx, cy); g.scale(1, h / Math.max(1, w)); g.beginPath(); g.arc(0, 0, w / 2, 0, 6.3); g.fill(); g.restore();
  }
  /* brick / ashlar courses: the base of every wall in the game */
  function courses(g, x, y, w, h, rows, colA, colB) {
    const rh = h / rows;
    for (let i = 0; i < rows; i++) {
      const yy = y + i * rh, off = (i % 2) * (rh * .9);
      px(g, x, yy, w, rh, i % 2 ? colA : colB);
      px(g, x, yy, w, 1, shade(i % 2 ? colA : colB, .2));
      px(g, x, yy + rh - 1, w, 1, shade(colB, -.3));
      for (let bx = x - off; bx < x + w; bx += rh * 1.8) px(g, bx, yy, 1, rh, shade(colB, -.34));
    }
  }
  /* opus reticulatum: the diamond brickwork Romans actually used */
  function reticulate(g, x, y, w, h, colA, colB) {
    px(g, x, y, w, h, colA);
    for (let j = 0; j * 4 < h; j++) for (let i = 0; i * 4 < w; i++) {
      const cx = x + i * 4 + ((j % 2) * 2), cy = y + j * 4 + 2;
      if (cx > x + w - 3 || cy > y + h - 3) continue;
      const c = (i + j) % 3 ? colB : shade(colB, .14);
      px(g, cx, cy - 1, 2, 2, c); px(g, cx - 1, cy, 2, 2, c);
    }
  }
  /* fluting and entasis on a column shaft */
  function column(g, x, y, w, h, col, cap) {
    const r = ramp(col);
    px(g, x, y, w, h, r.base);
    for (let i = 0; i < w; i++) {
      const f = i / (w - 1);
      px(g, x + i, y, 1, h, f < .18 ? r.d : f > .82 ? r.hi : f < .45 ? r.d2 : f > .62 ? r.hi2 : r.base);
    }
    px(g, x, y, 2, h, r.d); px(g, x + w - 1, y, 1, h, r.dd);
    if (cap) { px(g, x - 1, y, w + 2, 2, r.hi); px(g, x, y + 2, w, 1, r.d2); }
    return r;
  }
  return { T, rng, hash, cv, ctx, px, rgb, toHex, mix, shade, warm, ramp, lerp, cl, pickr, chance, edge, shadow, courses, reticulate, column };
})();

window.PIXWORLD = (() => {
  'use strict';
  const { T, rng, hash, cv, ctx, px, mix, shade, ramp, cl, pickr, chance, edge, courses, reticulate, column } = window.PIXTOOLS;
  const VARS = 6;

  /* =========================== ground =========================== */
  const TILES = {
    /* the basalt paving of the great streets: irregular blocks, worn to a polish by wheels */
    cobble(r) {
      const c = cv(T, T), g = ctx(c);
      /* kept low in contrast: the paving is the background everybody walks over, and a busy street makes a busy
         picture. The warm stones are the ones the sun has been on. */
      px(g, 0, 0, T, T, '#615a4e');
      const cols = ['#857c6d', '#8d8473', '#7f7768', '#928876', '#88806f'];
      for (let gy = 0; gy < T; gy += 8) for (let gx = 0; gx < T; gx += 8) {
        const jx = Math.round((r() - .5) * 2), jy = Math.round((r() - .5) * 2);
        const w = 7 + (r() < .3 ? 1 : 0), h = 7 + (r() < .3 ? 1 : 0), t = pickr(r, cols);
        px(g, gx + jx, gy + jy, w, h, t);
        px(g, gx + jx, gy + jy, w, 1, shade(t, .09));
        px(g, gx + jx, gy + jy + h - 1, w, 1, shade(t, -.13));
        px(g, gx + jx + w - 1, gy + jy, 1, h, shade(t, -.08));
        if (chance(r, .2)) px(g, gx + jx + 2, gy + jy + 2, 2, 1, shade(t, -.16));
      }
      for (let i = 0; i < 10; i++) px(g, (r() * T) | 0, (r() * T) | 0, 1, 1, chance(r, .5) ? 'rgba(255,246,214,.13)' : 'rgba(0,0,0,.2)');
      return c;
    },
    /* the side streets: smaller stones, a lot more mud */
    cobble2(r) {
      const c = cv(T, T), g = ctx(c);
      px(g, 0, 0, T, T, '#5c5245');
      for (let gy = 0; gy < T; gy += 6) for (let gx = 0; gx < T; gx += 6) {
        const t = pickr(r, ['#7d7362', '#756b5b', '#827867', '#706656']);
        px(g, gx + Math.round((r() - .5) * 2), gy + Math.round((r() - .5) * 2), 5, 5, t);
        px(g, gx, gy, 5, 1, shade(t, .08));
        px(g, gx, gy + 4, 5, 1, shade(t, -.12));
      }
      for (let i = 0; i < 6; i++) { const x = (r() * T) | 0, y = (r() * T) | 0; px(g, x, y, 3 + (r() * 4) | 0, 2, 'rgba(72,58,40,.5)'); }
      for (let i = 0; i < 8; i++) px(g, (r() * T) | 0, (r() * T) | 0, 1, 1, 'rgba(120,104,78,.55)');
      return c;
    },
    /* marble: the Forum and the temples. Big slabs, veins, and a shine on the leading edge. */
    marble(r) {
      const c = cv(T, T), g = ctx(c);
      const base = ['#d9d2c2', '#d2cbb9', '#e0d9c9', '#cdc6b4'];
      for (let sy = 0; sy < T; sy += 16) for (let sx = 0; sx < T; sx += 16) {
        const t = pickr(r, base);
        px(g, sx, sy, 16, 16, t);
        px(g, sx, sy, 16, 1, shade(t, .12));
        px(g, sx, sy, 1, 16, shade(t, .08));
        px(g, sx, sy + 15, 16, 1, shade(t, -.26));
        px(g, sx + 15, sy, 1, 16, shade(t, -.2));
        /* veins: a short random walk in a stronger tone */
        if (chance(r, .6)) {
          let x = sx + 2 + r() * 10, y = sy + 2 + r() * 10;
          const tone = shade(t, -.13);
          for (let i = 0; i < 12; i++) { px(g, x, y, 1, 1, tone); x += (r() - .5) * 2.2; y += (r() - .5) * 2.2; if (x < sx || x > sx + 15 || y < sy || y > sy + 15) break; }
        }
      }
      for (let i = 0; i < 6; i++) px(g, (r() * T) | 0, (r() * T) | 0, 1, 1, 'rgba(255,252,240,.25)');
      return c;
    },
    /* the Forum floor: marble slabs with dust in the seams */
    plaza(r) {
      const c = cv(T, T), g = ctx(c);
      for (let sy = 0; sy < T; sy += 16) for (let sx = 0; sx < T; sx += 16) {
        const t = pickr(r, ['#cfc6b1', '#c7bea8', '#d6cdb8', '#c1b8a2']);
        px(g, sx, sy, 16, 16, t);
        px(g, sx, sy, 16, 1, shade(t, .13)); px(g, sx, sy + 15, 16, 1, shade(t, -.24));
        px(g, sx, sy, 1, 16, shade(t, .07)); px(g, sx + 15, sy, 1, 16, shade(t, -.18));
      }
      for (let i = 0; i < 22; i++) px(g, (r() * T) | 0, (r() * T) | 0, 1, 1, chance(r, .5) ? 'rgba(150,132,102,.35)' : 'rgba(255,248,228,.2)');
      return c;
    },
    /* polished ashlar, for inside the temples and the curia */
    stone(r) {
      const c = cv(T, T), g = ctx(c);
      courses(g, 0, 0, T, T, 4, '#c3b9a3', '#cec4ae');
      for (let i = 0; i < 14; i++) px(g, (r() * T) | 0, (r() * T) | 0, 1, 1, 'rgba(90,78,60,.28)');
      px(g, 0, 0, T, 1, 'rgba(255,250,232,.18)');
      return c;
    },
    dirt(r) {
      const c = cv(T, T), g = ctx(c);
      px(g, 0, 0, T, T, '#6d5a41');
      for (let i = 0; i < 240; i++) px(g, (r() * T) | 0, (r() * T) | 0, 1, 1, pickr(r, ['#7a6649', '#5f4e38', '#836e4f', '#6a563d', '#57462f']));
      for (let i = 0; i < 9; i++) px(g, (r() * T) | 0, (r() * T) | 0, 1 + (r() * 2) | 0, 1, 'rgba(120,104,80,.65)');
      for (let i = 0; i < 4; i++) px(g, (r() * T) | 0, (r() * T) | 0, 1, 1, 'rgba(40,32,22,.5)');
      return c;
    },
    grass(r) {
      const c = cv(T, T), g = ctx(c);
      px(g, 0, 0, T, T, '#4a6a33');
      for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
        const n = r();
        if (n > .62) px(g, x, y, 1, 1, n > .88 ? '#5d8040' : n > .75 ? '#3d5a2a' : '#527336');
      }
      for (let i = 0; i < 26; i++) {
        const x = (r() * T) | 0, y = (r() * T) | 0, h = 2 + (r() * 4) | 0, t = pickr(r, ['#6b9048', '#7ba24f', '#5a7d3a']);
        px(g, x, y, 1, h, t); if (chance(r, .4)) px(g, x + 1, y + 1, 1, h - 1, shade(t, -.14));
      }
      if (chance(r, .5)) { const x = 2 + r() * 26, y = 3 + r() * 26, t = pickr(r, ['#e8e0b0', '#d8a03c', '#c76a8a', '#e6e6f0']); px(g, x, y, 2, 2, t); px(g, x, y + 2, 1, 1, '#4a6a33'); }
      return c;
    },
    flower(r) {
      const c = TILES.grass(r), g = ctx(c);
      for (let i = 0; i < 12; i++) { const x = 1 + r() * 29, y = 1 + r() * 29, t = pickr(r, ['#e0c04a', '#d1708f', '#e8e2d0', '#c05a4a']); px(g, x, y, 2, 1, t); px(g, x, y + 1, 1, 1, shade(t, -.3)); }
      return c;
    },
    garden(r) {
      const c = TILES.grass(r), g = ctx(c);
      for (let i = 0; i < 3; i++) {                                   // clipped box edging wandering across
        let x = (r() * T) | 0, y = (r() * T) | 0;
        for (let k = 0; k < 9; k++) { px(g, x, y, 2, 2, '#2f4a22'); px(g, x, y, 2, 1, '#3f6229'); x += (r() < .5 ? 1 : 0) * 3; y += 1; if (x > T - 2 || y > T - 2) break; }
      }
      for (let i = 0; i < 6; i++) px(g, (r() * T) | 0, (r() * T) | 0, 2, 1, '#8c7f5f');   // gravel
      return c;
    },
    sand(r) {
      const c = cv(T, T), g = ctx(c);
      px(g, 0, 0, T, T, '#d3b681');
      for (let i = 0; i < 200; i++) px(g, (r() * T) | 0, (r() * T) | 0, 1, 1, pickr(r, ['#dec48f', '#c8a971', '#e6cf9d', '#bd9d66']));
      for (let i = 0; i < 4; i++) {                                   // wind ripples
        const y = (r() * T) | 0;
        for (let x = 0; x < T; x++) if (r() > .25) px(g, x, y + Math.round(Math.sin(x / 4) * 1.2), 1, 1, 'rgba(255,240,204,.35)');
      }
      return c;
    },
    /* the sand of the arena and the circus track: packed, hoof-marked, bloodstained here and there */
    track(r) {
      const c = TILES.sand(r), g = ctx(c);
      for (let i = 0; i < 5; i++) { const x = (r() * T) | 0, y = (r() * T) | 0; px(g, x, y, 2, 2, 'rgba(120,96,60,.45)'); px(g, x + 1, y - 1, 1, 1, 'rgba(90,70,44,.4)'); }
      for (let i = 0; i < 3; i++) { const x = (r() * T) | 0; for (let y = 0; y < T; y++) if (r() > .4) px(g, x, y, 1, 3, 'rgba(120,98,62,.22)'); }
      if (chance(r, .12)) { const x = 4 + r() * 22, y = 4 + r() * 22; px(g, x, y, 4, 3, 'rgba(112,32,28,.35)'); }
      return c;
    },
    wood(r) {
      const c = cv(T, T), g = ctx(c);
      px(g, 0, 0, T, T, '#6b4d2f');
      for (let i = 0; i < 4; i++) {
        const y = i * 8, t = pickr(r, ['#7d5c39', '#6f5233', '#87643d', '#664a2c']);
        px(g, 0, y, T, 8, t);
        for (let k = 0; k < 10; k++) px(g, (r() * T) | 0, y + (r() * 7) | 0, 2 + (r() * 6) | 0, 1, shade(t, r() < .5 ? -.18 : .12));
        px(g, 0, y, T, 1, shade(t, .16)); px(g, 0, y + 7, T, 1, shade(t, -.3));
        px(g, 3, y + 3, 1, 1, '#3d2a18'); px(g, 26, y + 3, 1, 1, '#3d2a18');      // nail heads
      }
      return c;
    },
    /* the Tiber: deep water with ripples drawn as a wavy line pattern so it never tiles obviously */
    water(r) {
      const c = cv(T, T), g = ctx(c);
      px(g, 0, 0, T, T, '#2e5566');
      for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
        const n = r(); if (n > .7) px(g, x, y, 1, 1, n > .93 ? '#4a7d8c' : n > .85 ? '#25485a' : '#376273');
      }
      for (let i = 0; i < 5; i++) {
        const y0 = 2 + r() * 28, tone = pickr(r, ['rgba(150,200,210,.30)', 'rgba(24,50,62,.4)', 'rgba(180,225,232,.22)']);
        for (let x = 0; x < T; x++) { const y = y0 + Math.round(Math.sin((x + y0) / 3.4) * 1.6); if (y > 0 && y < T) px(g, x, y, 2, 1, tone); }
      }
      return c;
    },
    /* city wall: great blocks, mortar, a dressed top course */
    wall(r) {
      const c = cv(T, T), g = ctx(c);
      px(g, 0, 0, T, T, '#5b5245');
      const rows = 3, rh = T / rows;
      for (let i = 0; i < rows; i++) {
        const y = i * rh, off = (i % 2) * 14;
        for (let x = -off; x < T; x += 28) {
          const t = pickr(r, ['#9a9080', '#8d8474', '#a49a89', '#847b6c']);
          px(g, x + 1, y + 1, 26, rh - 2, t);
          px(g, x + 1, y + 1, 26, 1, shade(t, .2)); px(g, x + 1, y + 1, 1, rh - 2, shade(t, .12));
          px(g, x + 1, y + rh - 2, 26, 1, shade(t, -.28)); px(g, x + 26, y + 1, 1, rh - 2, shade(t, -.2));
          if (chance(r, .35)) for (let k = 0; k < 5; k++) px(g, x + 2 + r() * 22, y + 2 + r() * (rh - 4), 1, 1, shade(t, -.22));
        }
      }
      return c;
    },
    /* tiled roof seen from above, for flat-topped buildings and awnings */
    roof(r) {
      const c = cv(T, T), g = ctx(c);
      px(g, 0, 0, T, T, '#8f4a30');
      for (let y = 0; y < T; y += 5) for (let x = 0; x < T; x += 8) {
        const t = pickr(r, ['#b4603c', '#a5552f', '#c06c44', '#96492a']);
        px(g, x, y, 8, 5, t); px(g, x, y, 8, 1, shade(t, .22)); px(g, x, y + 4, 8, 1, shade(t, -.3));
        px(g, x + 7, y, 1, 5, shade(t, -.18));
      }
      for (let i = 0; i < 5; i++) px(g, (r() * T) | 0, (r() * T) | 0, 2, 2, 'rgba(80,110,60,.35)');
      return c;
    },
    /* a laid mosaic floor: tesserae in a meander pattern, the way the rich pave a triclinium */
    mosaic(r) {
      const c = cv(T, T), g = ctx(c);
      for (let y = 0; y < T; y += 4) for (let x = 0; x < T; x += 4) {
        const t = pickr(r, ['#c9b489', '#bfa87c', '#d2bd93']);
        px(g, x, y, 4, 4, t); px(g, x, y, 4, 1, shade(t, .1)); px(g, x, y + 3, 4, 1, shade(t, -.16));
      }
      const gold = '#8c6a2f', dark = '#3b2f22';
      for (let x = 0; x < T; x += 4) { px(g, x, 12, 4, 2, gold); px(g, x + 2, 8, 2, 10, dark); }
      for (let y = 0; y < T; y += 4) { px(g, 2, y, 2, 4, dark); px(g, 28, y, 2, 4, dark); }
      px(g, 0, 0, T, 2, gold); px(g, 0, T - 2, T, 2, gold);
      return c;
    },
    /* painted plaster for interiors: panels of deep red and black, with a figure in each */
    fresco(r) {
      const c = cv(T, T), g = ctx(c);
      px(g, 0, 0, T, T, '#8e2f28');
      px(g, 2, 2, 28, 28, '#78241f');
      px(g, 4, 4, 24, 24, '#5e1a1c');
      for (let i = 0; i < 4; i++) {                                     // a painted figure: body, drape, head
        const x = 5 + i * 6, tone = pickr(r, ['#d8c49a', '#c9a97e', '#e0d2ae']);
        px(g, x + 1, 12, 3, 12, tone); px(g, x, 10, 5, 3, tone);
        px(g, x + 1, 10, 3, 2, shade(tone, -.4));
        px(g, x + 1, 22, 3, 2, shade(tone, -.25));
        px(g, x + 1, 12, 1, 10, 'rgba(70,40,30,.35)');
      }
      px(g, 0, 0, T, 3, '#3a2a20'); px(g, 0, T - 3, T, 3, '#3a2a20');
      px(g, 0, 3, T, 1, '#e0c46a'); px(g, 0, T - 4, T, 1, '#c9a94f');
      return c;
    },
    /* a shelf of amphorae on a cellar wall, for the warehouses */
    rubble(r) {
      const c = cv(T, T), g = ctx(c);
      px(g, 0, 0, T, T, '#6b6255');
      for (let i = 0; i < 26; i++) {
        const w = 2 + (r() * 5) | 0, h = 2 + (r() * 4) | 0, x = (r() * T) | 0, y = (r() * T) | 0;
        const t = pickr(r, ['#8c8474', '#79705f', '#9a9282', '#6a6153']);
        px(g, x, y, w, h, t); px(g, x, y, w, 1, shade(t, .2)); px(g, x, y + h - 1, w, 1, shade(t, -.3));
      }
      return c;
    },
    puddle(r) {
      const c = TILES.cobble2(r), g = ctx(c);
      const grd = g.createRadialGradient(16, 16, 1, 16, 16, 12);
      grd.addColorStop(0, 'rgba(70,96,104,.72)'); grd.addColorStop(1, 'rgba(70,96,104,0)');
      g.fillStyle = grd; g.beginPath(); g.ellipse(16, 16, 11, 8, 0, 0, 6.3); g.fill();
      px(g, 11, 12, 4, 1, 'rgba(220,240,240,.5)');
      return c;
    }
  };

  function tiles() {
    const at = {};
    Object.keys(TILES).forEach(k => {
      const r = rng(hash('tile:' + k) + 7), out = [];
      for (let i = 0; i < VARS; i++) out.push(TILES[k](rng(hash(k + i) + 31)));
      at[k] = out;
    });
    return { at, VARS };
  }

  /* =========================== façades =========================== */
  /* everything you can walk into, drawn from the outside. A building knows its pixel size, its style, and its
     colour; the roof hangs 8px above its footprint so the world reads as solid rather than flat. */
  const ROOF = 10;

  const doors = (g, x, y, w, h, col) => {                    // an arched door with bronze studs
    const r = ramp(col);
    px(g, x, y + 2, w, h - 2, r.base); px(g, x, y + 2, w, 1, r.d2);
    px(g, x, y + 2, 1, h - 2, r.hi); px(g, x + w - 1, y + 2, 1, h - 2, r.d);
    for (let i = 0; i < 3; i++) { px(g, x, y + 4 + i * 5, w, 1, r.d); }
    px(g, x + (w >> 1), y + 2, 1, h - 2, r.d);
    [[3, 5], [3, 12], [w - 4, 5], [w - 4, 12]].forEach(p => px(g, x + p[0], y + p[1], 1, 1, '#d9b64a'));
    px(g, x - 1, y, w + 2, 2, '#cbbfa4'); px(g, x - 1, y, w + 2, 1, '#e6dcc4');
  };
  const window1 = (g, x, y, w, h, shut, lit) => {            // a shuttered window, sometimes with a lamp inside
    px(g, x - 1, y - 1, w + 2, h + 2, '#8d8271');
    px(g, x - 1, y - 1, w + 2, 1, '#b0a58f');
    px(g, x, y, w, h, lit ? '#e8b64c' : '#2b2620');
    if (!lit) { for (let i = 1; i < w; i += 2) px(g, x + i, y, 1, h, '#1b1713'); }
    else { px(g, x, y, w, 1, '#f4d489'); px(g, x, y + h - 1, w, 1, '#a86a1e'); }
    if (shut === 1) px(g, x - 2, y - 1, 2, h + 2, '#6b4a2c');
    if (shut === 2) px(g, x + w, y - 1, 2, h + 2, '#6b4a2c');
    px(g, x - 2, y + h + 1, w + 4, 2, '#a89a80');
  };
  const awning = (g, x, y, w, colA, colB) => {                // a striped shop awning with a scalloped edge
    for (let i = 0; i < w; i++) px(g, x + i, y, 1, 7, (i % 8) < 4 ? colA : colB);
    for (let i = 0; i < w; i += 2) px(g, x + i, y + 7, 2, 1, (i % 8) < 4 ? shade(colA, -.3) : shade(colB, -.3));
    px(g, x, y, w, 1, 'rgba(255,246,214,.35)');
    px(g, x, y + 8, w, 1, 'rgba(0,0,0,.25)');
  };
  const bannerRail = (g, x, y, w, col) => {
    px(g, x, y, w, 1, '#6b5a3a');
    for (let i = 4; i < w - 4; i += 12) { px(g, x + i, y + 1, 7, 12, col); px(g, x + i, y + 1, 7, 2, shade(col, .25)); px(g, x + i + 3, y + 5, 1, 5, '#e6d6a2'); }
  };
  const colonnade = (g, x, y, w, h, n, col) => {
    const cw = Math.max(4, Math.floor(w / n) - 2);
    for (let i = 0; i < n; i++) {
      const cx = x + Math.floor((w - cw) * (n === 1 ? .5 : i / (n - 1)));
      column(g, cx, y, cw, h, col, true);
      px(g, cx - 1, y + h, cw + 2, 3, shade(col, -.1));
    }
  };

  function facade(b, style) {
    const w = b.w * T, h = b.h * T, W2 = w + 4, H2 = h + ROOF + 4;
    const c = cv(W2, H2), g = ctx(c);
    const r = rng(hash('b' + (b.id || b.style) + b.x + ',' + b.y));
    const col = b.col || '#cabfa4', R = ramp(col);
    const wallY = ROOF, wallH = h;
    g.translate(2, ROOF);

    const plasterWall = (tone, weather) => {
      px(g, 0, 0, w, wallH, tone);
      for (let i = 0; i < w * wallH / 26; i++) px(g, (r() * w) | 0, (r() * wallH) | 0, 1 + (r() * 3) | 0, 1, shade(tone, r() < .5 ? -.08 : .07));
      if (weather) {                                              // rain streaks under the eaves and dirt at the base
        for (let i = 0; i < w / 6; i++) { const x = (r() * w) | 0; for (let y = 0; y < 8 + r() * 10; y++) px(g, x, y, 1, 1, 'rgba(90,78,60,.18)'); }
        px(g, 0, wallH - 5, w, 5, 'rgba(92,74,52,.3)');
        for (let i = 0; i < w / 5; i++) px(g, (r() * w) | 0, wallH - 6 - r() * 3, 2, 2, 'rgba(70,58,40,.3)');
      }
      px(g, 0, 0, w, 2, shade(tone, .2)); px(g, 0, wallH - 2, w, 2, shade(tone, -.3));
    };
    const tiledRoof = (top, ridge) => {
      px(g, 0, -ROOF, w, ROOF, shade(col, -.42));
      for (let y = -ROOF; y < 0; y += 4) for (let x = 0; x < w; x += 7) {
        const t = pickr(r, ['#b4603c', '#a5552f', '#c16c44', '#98492a']);
        px(g, x, y, 7, 4, t); px(g, x, y, 7, 1, shade(t, .24));
      }
      px(g, 0, -ROOF, w, 1, '#8f4a30');
      px(g, 0, -3, w, 3, shade(col, -.55));
      for (let x = 3; x < w; x += 9) px(g, x, -3, 3, 2, shade(col, -.3));       // antefixes
      if (ridge) { px(g, 0, -ROOF - 3, w, 3, '#d9c9a6'); px(g, 0, -ROOF - 3, w, 1, '#efe4c6'); px(g, 0, -ROOF - 1, w, 1, '#a08f6d'); }
    };

    if (style === 'temple') {
      px(g, 0, wallH - 10, w, 10, R.d2);                                        // podium
      for (let i = 0; i < 4; i++) px(g, 0, wallH - 10 + i * 3, w, 1, shade(col, -.5));
      px(g, 0, wallH - 12, w, 3, R.hi);
      const cols = Math.max(4, Math.round(b.w * 1.6));
      colonnade(g, 6, 16, w - 12, wallH - 42, cols, '#e0d7bd');
      px(g, 2, 10, w - 4, 6, '#d8cfb4'); px(g, 2, 10, w - 4, 2, '#efe7cf');     // architrave
      for (let i = 0; i < (w - 8) / 8; i++) { px(g, 5 + i * 8, 11, 4, 4, '#cbbf9e'); px(g, 6 + i * 8, 12, 2, 2, '#8d8163'); }
      px(g, 2, 4, w - 4, 4, '#e6dcc2'); px(g, 2, 4, w - 4, 1, '#f5efdb');
      g.save(); g.beginPath(); g.moveTo(0, 4); g.lineTo(w / 2, -ROOF + 2); g.lineTo(w, 4); g.closePath();
      px(g, 0, 0, 1, 1, 'rgba(0,0,0,0)');
      g.fillStyle = '#ddd2b4'; g.fill(); g.restore();                            // pediment
      px(g, 0, 4, w, 1, '#a89a78');
      g.save(); g.beginPath(); g.moveTo(2, 4); g.lineTo(w / 2, -ROOF + 3); g.lineTo(w - 2, 4); g.closePath(); g.clip();
      for (let i = 0; i < w / 5; i++) {                                          // a relief in the pediment
        const cx = 8 + r() * (w - 16), tone = pickr(r, ['#c6b691', '#b9a882', '#d3c3a0']);
        px(g, cx, 1 - r() * 4, 3, 6, tone); px(g, cx, -2 - r() * 2, 3, 3, shade(tone, -.3));
      }
      g.restore();
      px(g, 3, -ROOF + 5, w - 6, 3, '#cbbfa2'); px(g, 3, -ROOF + 5, w - 6, 1, '#e8dfc4');
      doors(g, (w >> 1) - 9, wallH - 26, 18, 16, '#5b3f26');
      px(g, 0, -ROOF - 2, w, 2, '#8f4a30');
    } else if (style === 'basilica') {
      plasterWall('#cfc5aa', true);
      for (let i = 0; i < Math.max(3, Math.round(b.w / 3)); i++) {               // arcade of arches
        const cw = w / Math.max(3, Math.round(b.w / 3)), x = i * cw;
        const ax = x + cw * .18, aw = cw * .64, ay = 22, ah = wallH - 40;
        g.save(); g.beginPath(); g.moveTo(ax, ay + ah); g.lineTo(ax, ay + aw / 2); g.arc(ax + aw / 2, ay + aw / 2, aw / 2, Math.PI, 0); g.lineTo(ax + aw, ay + ah); g.closePath();
        g.fillStyle = '#2a221a'; g.fill(); g.strokeStyle = '#b3a684'; g.lineWidth = 2; g.stroke(); g.restore();
        column(g, ax - 5, ay + 6, 5, ah - 6, '#ded4b8', true);
        column(g, ax + aw + 1, ay + 6, 5, ah - 6, '#ded4b8', true);
        if (chance(r, .5)) window1(g, ax + aw / 2 - 3, ay + 26, 7, 8, 0, true);
      }
      px(g, 0, 14, w, 8, '#c6b995'); px(g, 0, 14, w, 2, '#ded2ae');
      for (let x = 6; x < w - 6; x += 11) px(g, x, 17, 5, 3, '#8f8365');
      for (let i = 0; i < b.w; i++) window1(g, 12 + i * 32, 6, 9, 8, 0, chance(r, .3));
      tiledRoof(true);
    } else if (style === 'insulae') {
      const floors = Math.max(2, b.h - 1);
      reticulate(g, 0, 0, w, wallH, '#b9ad93', '#a4977c');
      for (let i = 0; i < 40; i++) { const x = (r() * w) | 0, y = (r() * wallH) | 0; px(g, x, y, 3, 1, 'rgba(74,62,44,.25)'); }
      px(g, 0, wallH - 12, w, 12, '#8f8574');                                    // the shop at street level
      for (let y = 0; y < floors; y++) {
        const fy = 6 + y * ((wallH - 20) / floors);
        if (y > 0) { px(g, 0, fy + 22, w, 3, '#6b5c43'); px(g, 0, fy + 22, w, 1, '#8f7d5c'); }
        for (let x = 5; x < w - 8; x += 16) {
          window1(g, x, fy, 9, 10, chance(r, .5) ? (chance(r, .5) ? 1 : 2) : 0, chance(r, .3));
          if (y === 1) { px(g, x - 2, fy + 13, 13, 2, '#6b4a2c'); px(g, x - 1, fy + 11, 11, 2, '#8a6a3c'); }
        }
        if (y === 1) bannerRail(g, 2, fy + 16, w - 4, pickr(r, ['#9c4a44', '#3f5f7a', '#c39b4a', '#7a6b9c']));
      }
      if (chance(r, .7)) awning(g, 4, wallH - 22, w - 8, '#b4562f', '#e2d6bc');
      px(g, 0, wallH - 3, 11, 3, '#6b6153'); px(g, w - 11, wallH - 2, 11, 3, '#6b6153');
      for (let i = 0; i < (w - 16) / 14; i++) {
        const x = 8 + i * 14;
        px(g, x, wallH - 8, 10, 8, '#2b2620');                                   // shop doorways
        px(g, x, wallH - 8, 10, 1, '#b0a58f');
        if (i % 3 === 0) px(g, x + 2, wallH - 20, 6, 12, '#e8b64c');             // a lit shop
      }
      tiledRoof(false);
    } else if (style === 'shop') {
      plasterWall('#c4b89c', true);
      awning(g, 3, 6, w - 6, pickr(r, ['#a8432c', '#2f5f6b', '#7a5a2c']), '#e6dcc0');
      for (let i = 0; i < Math.max(2, b.w - 1); i++) {                           // counters with goods on them
        const x = 5 + i * ((w - 10) / Math.max(2, b.w - 1));
        px(g, x, wallH - 20, 22, 3, '#8a6a3c'); px(g, x, wallH - 20, 22, 1, '#a98a52');
        for (let k = 0; k < 4; k++) {
          const gx = x + 2 + k * 5, t = pickr(r, ['#c9a24a', '#a8562f', '#7a9c52', '#8c5a3c']);
          px(g, gx, wallH - 23, 4, 3, t); px(g, gx + 1, wallH - 24, 2, 1, shade(t, .2));
        }
      }
      doors(g, 3, wallH - 14, 11, 12, '#6b4a2c');
      px(g, w - 16, wallH - 14, 11, 12, '#5b4530');
      tiledRoof(false);
    } else if (style === 'tavern') {
      px(g, 0, 0, w, wallH, '#a89b80');
      courses(g, 0, 0, w, wallH * .6, 4, '#8f8368', '#9c9076');
      for (let i = 0; i < b.w; i++) { px(g, 6 + i * 32, 8, 14, 10, '#7a6a4a'); px(g, 6 + i * 32, 8, 14, 1, '#9c8a63'); }
      px(g, 0, wallH * .6, w, wallH * .4, '#8a7454');
      for (let x = 0; x < w; x += 5) px(g, x, wallH * .6, 2, wallH * .4, '#6e5c42');
      px(g, w / 2 - 9, wallH - 26, 18, 26, '#3a2c1e');
      px(g, w / 2 - 9, wallH - 26, 18, 1, '#8a6a3c');
      px(g, w / 2 - 3, 16, 6, 8, '#4a3a26');                                     // the hanging sign
      px(g, w / 2 - 1, 24, 2, 6, '#6b5a3a');
      px(g, w / 2 - 8, 30, 16, 10, '#c9a24a'); px(g, w / 2 - 8, 30, 16, 1, '#e0c46a');
      px(g, w / 2 - 5, 34, 4, 4, '#3a2c1e'); px(g, w / 2 + 1, 34, 4, 4, '#3a2c1e');
      tiledRoof(false);
    } else if (style === 'warehouse') {
      reticulate(g, 0, 0, w, wallH, '#b0a289', '#8f8268');
      px(g, 0, wallH - 4, w, 4, '#7d7260');
      for (let i = 0; i < Math.max(1, Math.round(b.w / 4)); i++) {
        const x = (w / Math.max(1, Math.round(b.w / 4))) * (i + .5);
        g.save(); g.beginPath(); g.moveTo(x - 11, wallH); g.lineTo(x - 11, wallH - 20); g.arc(x, wallH - 20, 11, Math.PI, 0); g.lineTo(x + 11, wallH); g.closePath();
        g.fillStyle = '#3c3126'; g.fill(); g.strokeStyle = '#8f8268'; g.lineWidth = 2; g.stroke(); g.restore();
        for (let k = 0; k < 4; k++) px(g, x - 10, wallH - 30 + k * 6, 20, 1, 'rgba(200,180,140,.25)');
      }
      px(g, 4, 2, w - 8, 8, '#8a7c60');                                          // the hoist beam
      px(g, 8, 10, 6, 4, '#6b5a3a');
      tiledRoof(false);
    } else if (style === 'barracks') {
      reticulate(g, 0, 0, w, wallH, '#a89b81', '#877b62');
      px(g, 0, wallH - 3, w, 3, '#6e6350');
      for (let x = 0; x < w; x += 10) { px(g, x + 4, -ROOF + 1, 4, 5, '#b3a488'); px(g, x + 4, -ROOF + 1, 4, 1, '#d0c2a4'); }   // crenellations
      px(g, 0, -ROOF, w, ROOF, '#8f8268');
      for (let i = 0; i < Math.max(1, b.w / 3); i++) {
        const x = (w / Math.max(1, b.w / 3)) * (i + .5);
        px(g, x - 7, wallH - 22, 14, 22, '#4a3a26'); px(g, x - 7, wallH - 22, 14, 1, '#8a6a3c');
        for (let k = 0; k < 6; k++) px(g, x - 7, wallH - 20 + k * 4, 14, 1, 'rgba(0,0,0,.35)');
      }
      for (let i = 0; i < b.w; i++) window1(g, 8 + i * 32, 12, 7, 6, 0, chance(r, .4));
    } else if (style === 'bath') {
      plasterWall('#d5cbb0', true);
      for (let i = 0; i < 2; i++) for (let x = 8; x < w - 10; x += 24) {
        const y = i ? wallH - 30 : 20;
        g.save(); g.beginPath(); g.moveTo(x, y + 12); g.lineTo(x, y + 5); g.arc(x + 6, y + 5, 6, Math.PI, 0); g.lineTo(x + 12, y + 12); g.closePath();
        g.fillStyle = i ? '#3a4a52' : '#43555e'; g.fill(); g.strokeStyle = '#b8ab8c'; g.lineWidth = 2; g.stroke(); g.restore();
      }
      px(g, w / 2 - 14, 6, 28, 12, '#c6bb9c'); px(g, w / 2 - 14, 6, 28, 2, '#e2d8ba');   // pediment over the entrance
      doors(g, w / 2 - 9, wallH - 24, 18, 22, '#5b3f26');
      for (let i = 0; i < b.w; i++) window1(g, 4 + i * 32, wallH - 40, 6, 8, 0, chance(r, .5));
      tiledRoof(false);
    } else if (style === 'ludus') {
      reticulate(g, 0, 0, w, wallH, '#b3a68c', '#8f826a');
      px(g, 0, wallH - 14, w, 14, '#8f826a');
      for (let x = 6; x < w - 6; x += 12) px(g, x, wallH - 12, 8, 12, '#33291d');       // barred cells
      px(g, w / 2 - 12, wallH - 22, 24, 22, '#3a2f22'); px(g, w / 2 - 12, wallH - 22, 24, 2, '#8a7c60');
      for (let k = 0; k < 5; k++) px(g, w / 2 - 10 + k * 5, wallH - 20, 2, 20, '#6b6152');
      px(g, 4, -ROOF, w - 8, ROOF, '#a5987d');
      for (let i = 0; i < b.w; i++) px(g, 4 + i * 30, -ROOF + 2, 26, 4, '#8f8268');
    } else if (style === 'hut') {
      px(g, 0, 4, w, wallH - 4, '#a4946f');
      for (let y = 4; y < wallH; y += 6) { px(g, 0, y, w, 3, '#8c7c5c'); px(g, 0, y + 3, w, 3, '#b5a37c'); }
      px(g, 0, wallH - 4, w, 4, '#6b5f45');
      g.save(); g.beginPath(); g.moveTo(-3, 4); g.lineTo(w / 2, -ROOF - 6); g.lineTo(w + 3, 4); g.closePath();
      g.fillStyle = '#8a6f3c'; g.fill(); g.restore();
      for (let i = 0; i < w + 8; i += 3) px(g, -2 + i, 2 - (i < w / 2 ? i * .5 : (w - i) * .5) + 1, 2, 4, 'rgba(90,70,40,.35)');
      px(g, w / 2 - 6, wallH - 16, 12, 16, '#4a3a26'); px(g, w / 2 - 6, wallH - 16, 12, 1, '#8a6a3c');
    } else if (style === 'tomb') {
      px(g, 0, 0, w, wallH, '#d5cbb0');
      px(g, 0, 0, w, 3, '#efe6cb'); px(g, 0, wallH - 3, w, 3, '#a89a78');
      for (let x = 6; x < w - 6; x += 16) { px(g, x, 8, 12, 16, '#bfb28f'); px(g, x, 8, 12, 1, '#dad0ae'); px(g, x + 3, 12, 6, 9, '#9c8f6e'); }
      for (let y = 30; y < wallH - 8; y += 5) for (let x = 6; x < w - 8; x += 5) px(g, x, y, 3, 3, chance(r, .5) ? '#8f826a' : '#b5a888');
      px(g, 0, -6, w, 6, '#c6b995'); px(g, 0, -6, w, 1, '#e2d8ba');
    } else if (style === 'villa') {
      plasterWall(col, true);
      if (chance(r, .5)) { for (let x = 4; x < w - 8; x += 9) px(g, x, wallH - 26, 6, 16, pickr(r, ['#8e3b34', '#3b5a6b', '#7a5a2c'])); }
      for (let i = 0; i < Math.max(2, b.w / 3); i++) {
        const x = 10 + i * ((w - 20) / Math.max(2, b.w / 3));
        column(g, x, wallH - 26, 6, 26, '#ded4b8', true);
      }
      px(g, 2, 4, w - 4, 8, '#cbc0a2');
      for (let x = 4; x < w - 6; x += 10) px(g, x, 6, 6, 4, '#a89a78');
      doors(g, w / 2 - 10, wallH - 22, 20, 22, '#6b4a2c');
      for (let x = 6; x < w - 12; x += 20) window1(g, x, 14, 8, 8, 0, chance(r, .35));
      tiledRoof(true);
    } else if (style === 'gate') {
      px(g, 0, 0, 22, wallH, '#a3967b'); px(g, w - 22, 0, 22, wallH, '#a3967b');
      for (let y = 0; y < wallH; y += 8) for (let x = 0; x < 22; x += 11) { px(g, x + (y % 16 ? 5 : 0), y, 10, 7, chance(r, .5) ? '#b3a68c' : '#95896f'); px(g, x + (y % 16 ? 5 : 0), y, 10, 1, '#c6b99c'); }
      for (let y = 0; y < wallH; y += 8) for (let x = w - 22; x < w; x += 11) { px(g, x + (y % 16 ? 5 : 0), y, 10, 7, chance(r, .5) ? '#b3a68c' : '#95896f'); px(g, x + (y % 16 ? 5 : 0), y, 10, 1, '#c6b99c'); }
      g.save(); g.beginPath(); g.moveTo(22, wallH); g.lineTo(22, 30); g.arc(w / 2, 30, (w - 44) / 2, Math.PI, 0); g.lineTo(w - 22, wallH); g.closePath();
      g.fillStyle = '#3a2f22'; g.fill(); g.restore();
      for (let k = 0; k < 5; k++) px(g, 24 + k * ((w - 48) / 4), 34, 3, wallH - 34, 'rgba(120,100,70,.5)');
      px(g, 18, -8, 8, 8, '#b3a68c'); px(g, w - 26, -8, 8, 8, '#b3a68c');
      px(g, 20, -14, 4, 6, '#8f8268'); px(g, w - 24, -14, 4, 6, '#8f8268');
    } else if (style === 'circus') {
      plasterWall('#c6bb9c', true);
      for (let i = 0; i < Math.max(3, Math.round(b.w / 2.2)); i++) {
        const cw = w / Math.max(3, Math.round(b.w / 2.2)), x = i * cw, aw = cw * .62;
        g.save(); g.beginPath(); g.moveTo(x + cw * .19, wallH - 4); g.lineTo(x + cw * .19, 16 + aw / 2); g.arc(x + cw * .19 + aw / 2, 16 + aw / 2, aw / 2, Math.PI, 0); g.lineTo(x + cw * .19 + aw, wallH - 4); g.closePath();
        g.fillStyle = '#2b231a'; g.fill(); g.strokeStyle = '#b3a684'; g.lineWidth = 1.6; g.stroke(); g.restore();
      }
      px(g, 0, 8, w, 4, '#d8ceb0'); px(g, 0, 8, w, 1, '#efe6cb');
      for (let x = 4; x < w - 4; x += 12) px(g, x, 4, 8, 4, '#8f8268');
      px(g, 0, -4, w, 4, '#b4603c');
    } else {                                                                     // a plain block of flats / offices
      plasterWall(col, true);
      for (let x = 6; x < w - 8; x += 14) window1(g, x, 10, 8, 9, 0, chance(r, .25));
      doors(g, w / 2 - 8, wallH - 18, 16, 18, '#5b3f26');
      tiledRoof(false);
    }
    return c;
  }

  /* =========================== props =========================== */
  /* street furniture, trees, water, carts and the odd animal. Anything with frames is animated by the game. */
  const P = {};
  const raw = new Set(['water', 'spray', 'smoke', 'flowers', 'reeds', 'vines']);
  const prop = (name, seed) => {
    const f = P[name];
    if (!f) return null;
    const r = rng(hash(name + ':' + (seed | 0)) + 11);
    const out = f(r);
    if (out && !out.frames && out.c && !raw.has(name)) out.c = edge(out.c, 'rgba(22,14,18,.75)');
    return out;
  };
  const one = (w, h, draw, over) => r => { const c = cv(w, h), g = ctx(c); draw(g, cv, r, w, h); return { c, w, h, over }; };
  const anim = (w, h, n, draw, over, soft) => r => {
    const frames = [];
    for (let i = 0; i < n; i++) { const c = cv(w, h), g = ctx(c); draw(g, cv, r, w, h, i, n); frames.push(soft ? c : edge(c, 'rgba(22,14,18,.6)')); }
    return { frames, w, h, over, fps: soft ? 6 : 8 };
  };

  P.column = one(32, 64, (g, mk, r) => {
    px(g, 8, 54, 16, 10, '#c6bb9c'); px(g, 8, 54, 16, 1, '#ded2b0'); px(g, 6, 60, 20, 4, '#a89a78');
    column(g, 10, 10, 12, 44, '#ddd3b6', true);
    px(g, 8, 4, 16, 7, '#cfc4a6'); px(g, 8, 4, 16, 1, '#e8dfc3'); px(g, 7, 11, 18, 2, '#b3a684');
  });
  P.pillar = one(32, 48, (g, mk, r) => {
    px(g, 9, 40, 14, 8, '#c6bb9c'); column(g, 11, 6, 10, 34, '#ddd3b6', true);
  });
  P.statue = one(32, 56, (g, mk, r) => {
    px(g, 6, 48, 20, 8, '#c6bb9c'); px(g, 6, 48, 20, 1, '#ded2b0');
    px(g, 10, 44, 12, 5, '#b3a68c');
    const tone = '#e2d8bd';
    px(g, 13, 20, 7, 24, tone); px(g, 12, 16, 9, 5, tone);
    px(g, 10, 22, 4, 12, '#d5cbb0'); px(g, 19, 20, 4, 16, '#d5cbb0');
    px(g, 13, 10, 6, 7, '#e8dfc3'); px(g, 12, 9, 8, 4, '#d5cbb0');
    px(g, 14, 12, 1, 1, '#6b6152'); px(g, 17, 12, 1, 1, '#6b6152');
    for (let i = 0; i < 8; i++) px(g, 12 + i, 20 + i * 3, 1, 4, '#c6bb9c');
  });
  P.obelisk = one(32, 88, (g, mk, r) => {
    px(g, 8, 80, 16, 8, '#c6bb9c'); px(g, 8, 80, 16, 1, '#ded2b0');
    g.fillStyle = '#d5cbb0'; g.beginPath(); g.moveTo(13, 82); g.lineTo(12, 8); g.lineTo(20, 8); g.lineTo(19, 82); g.closePath(); g.fill();
    g.fillStyle = '#e8dfc3'; g.beginPath(); g.moveTo(16, 4); g.lineTo(12, 8); g.lineTo(20, 8); g.closePath(); g.fill();
    px(g, 13, 20, 1, 60, '#b3a68c'); px(g, 18, 20, 1, 60, '#efe6cb');
    for (let y = 24; y < 76; y += 10) { px(g, 14, y, 5, 1, '#a89a78'); px(g, 14, y + 1, 5, 1, '#a89a78'); }
  });
  P.arch = one(96, 76, (g, mk, r) => {
    px(g, 0, 22, 96, 54, '#c6bb9c');
    for (let y = 22; y < 76; y += 8) for (let x = 0; x < 96; x += 12) { const t = chance(r, .5) ? '#d2c8a9' : '#b9ad90'; px(g, x, y, 11, 7, t); px(g, x, y, 11, 1, '#e2d8ba'); }
    g.save(); g.beginPath(); g.moveTo(28, 76); g.lineTo(28, 46); g.arc(48, 46, 20, Math.PI, 0); g.lineTo(68, 76); g.closePath();
    g.fillStyle = '#2e2620'; g.fill(); g.restore();
    px(g, 0, 14, 96, 9, '#d5cbb0'); px(g, 0, 14, 96, 2, '#efe6cb'); px(g, 0, 22, 96, 1, '#a89a78');
    for (let x = 4; x < 92; x += 14) px(g, x, 8, 10, 7, '#c6bb9c');
  }, true);
  P.fountain = anim(32, 48, 4, (g, mk, r, w, h, i) => {
    px(g, 4, 34, 24, 12, '#cfc4a6'); px(g, 4, 34, 24, 2, '#e8dfc3'); px(g, 3, 44, 26, 3, '#a89a78');
    px(g, 6, 30, 20, 5, '#b3a68c');
    px(g, 8, 26, 16, 4, '#5a8fa0'); px(g, 8, 26, 16, 1, '#8fc0cc');
    column(g, 13, 12, 6, 15, '#ddd3b6', true);
    px(g, 10, 8, 12, 5, '#cfc4a6');
    const k = [0, 1, 2, 1][i];
    px(g, 15, 12, 2, 8 + k * 2, '#eaf6f8'); px(g, 12, 16 - k, 2, 5, '#cfe8ee'); px(g, 18, 16 - k, 2, 5, '#cfe8ee');
    px(g, 9, 24 - k, 2, 3, '#eaf6f8'); px(g, 21, 24 - k, 2, 3, '#eaf6f8');
    px(g, 10, 28, 12, 1, '#dff2f6');
  }, true);
  P.well = one(32, 40, (g, mk, r) => {
    px(g, 4, 22, 24, 16, '#a89a78'); px(g, 4, 22, 24, 2, '#cbc0a2');
    for (let y = 24; y < 38; y += 5) for (let x = 5; x < 27; x += 8) { px(g, x, y, 7, 4, chance(r, .5) ? '#b3a68c' : '#9c8f70'); px(g, x, y, 7, 1, '#cbc0a2'); }
    px(g, 7, 20, 18, 4, '#3a4a52'); px(g, 7, 20, 18, 1, '#6b8f94');
    px(g, 6, 6, 3, 16, '#7a5c34'); px(g, 23, 6, 3, 16, '#7a5c34'); px(g, 5, 4, 22, 3, '#8a6a3c');
    px(g, 14, 12, 4, 4, '#6b5a3a');
  });
  P.altar = one(32, 36, (g, mk, r) => {
    px(g, 5, 24, 22, 12, '#d5cbb0'); px(g, 5, 24, 22, 1, '#efe6cb');
    px(g, 7, 18, 18, 6, '#c6bb9c'); px(g, 7, 18, 18, 1, '#e2d8ba');
    px(g, 9, 14, 14, 4, '#b3a68c');
    px(g, 12, 10, 8, 5, '#8a3a2c');                                     // a small flame on the altar
    px(g, 14, 7, 4, 4, '#e8a03c'); px(g, 15, 5, 2, 3, '#f4d489');
    for (let x = 7; x < 25; x += 4) px(g, x, 28, 2, 6, '#a89a78');
  }, true);
  P.torches = anim(32, 56, 4, (g, mk, r, w, h, i) => {
    px(g, 13, 26, 6, 30, '#6b4a2c'); px(g, 13, 26, 2, 30, '#8a6a3c');
    px(g, 11, 22, 10, 5, '#4a3a26');
    const k = [0, 2, 1, 3][i];
    px(g, 12, 12 - k, 8, 12 + k, '#e8792c'); px(g, 13, 8 - k, 6, 8, '#f2a63c');
    px(g, 14, 4 - k, 4, 8, '#f8d07a'); px(g, 15, 2 - k, 2, 6, '#fff0c0');
    px(g, 11, 20, 1, 4, '#c05a20'); px(g, 20, 20, 1, 4, '#c05a20');
  }, true);
  P.lamp = anim(32, 44, 4, (g, mk, r, w, h, i) => {
    px(g, 14, 30, 4, 14, '#5a4a3c'); px(g, 11, 42, 10, 3, '#4a3c30');
    px(g, 10, 22, 12, 9, '#3a3630'); px(g, 11, 23, 10, 7, '#f2c257');
    px(g, 12, 24, 3, 5, '#fff0c0');
    px(g, 9, 20, 14, 3, '#5a4a3c'); px(g, 13, 17, 6, 4, '#4a3c30');
    const k = [0, 1, 0, 2][i]; px(g, 9 - k, 26, 1, 3, 'rgba(255,220,150,.5)'); px(g, 22 + k, 26, 1, 3, 'rgba(255,220,150,.5)');
  }, true);
  P.banner = anim(32, 64, 6, (g, mk, r, w, h, i) => {
    const sway = [0, 1, 2, 2, 1, 0][i];
    px(g, 15, 4, 3, 56, '#6b5a3a');
    const col = pickr(r, ['#8e2f2c', '#2f4f7a', '#4a6b2f', '#7a5a2c']);
    for (let y = 8; y < 56; y++) { const off = Math.round(Math.sin((y + i * 2) / 7) * 2); px(g, 17 + off, y, 11, 1, y < 12 ? shade(col, .2) : col); }
    px(g, 17 + sway, 8, 11, 1, '#e6d6a2');
    for (let k = 0; k < 4; k++) px(g, 20 + sway + k * 2, 12, 1, 4, '#e6d6a2');
    px(g, 16 + sway, 38, 13, 2, '#e6d6a2');
  }, true);
  P.laundry = one(96, 40, (g, mk, r) => {
    px(g, 0, 6, 96, 1, '#6b5a3a');
    const cols = ['#c9b49a', '#a86a5a', '#8a9cae', '#c2ae7a', '#9c8a6c'];
    for (let i = 4; i < 92; i += 13) {
      const c2 = pickr(r, cols), hh = 10 + (r() * 12) | 0;
      px(g, i, 7, 9, hh, c2); px(g, i, 7, 9, 1, shade(c2, .2)); px(g, i, 7 + hh - 1, 9, 1, shade(c2, -.2));
      px(g, i + 2, 10, 5, 2, shade(c2, -.12));
    }
  }, true);
  P.stall = one(32, 44, (g, mk, r) => {
    px(g, 2, 6, 28, 6, '#a8432c');
    for (let x = 2; x < 30; x += 5) px(g, x, 6, 2, 6, '#e6dcc0');
    px(g, 2, 12, 28, 1, 'rgba(0,0,0,.3)');
    px(g, 4, 12, 3, 24, '#7a5c34'); px(g, 25, 12, 3, 24, '#7a5c34');
    px(g, 3, 22, 26, 4, '#8a6a3c'); px(g, 3, 22, 26, 1, '#a98a52');
    for (let k = 0; k < 5; k++) { const t = pickr(r, ['#c9a24a', '#a8562f', '#7a9c52', '#8c5a3c', '#b08a5a']); px(g, 5 + k * 5, 18, 4, 4, t); px(g, 6 + k * 5, 17, 2, 2, shade(t, .25)); }
    px(g, 4, 28, 10, 12, '#6b4a2c'); px(g, 18, 28, 10, 10, '#5a3c24');
  });
  P.amphorae = one(32, 34, (g, mk, r) => {
    const draw = (x, y, s, tone) => {
      px(g, x + 3 * s, y + 3 * s, 3 * s, 3 * s, tone);                       // a clay jar with a pointed foot
      px(g, x + 1 * s, y + 6 * s, 7 * s, 8 * s, tone);
      px(g, x + 2 * s, y + 13 * s, 5 * s, 3 * s, shade(tone, -.1));
      px(g, x + 1 * s, y + 6 * s, 1 * s, 8 * s, shade(tone, .18));
      px(g, x + 7 * s, y + 6 * s, 1 * s, 8 * s, shade(tone, -.22));
      px(g, x + 0 * s, y + 5 * s, 2 * s, 2 * s, shade(tone, -.1));
    };
    draw(2, 6, 2, '#b4623c'); draw(17, 2, 2, '#a8562f'); draw(9, 18, 1, '#9c6a44');
  });
  P.cart = one(48, 44, (g, mk, r) => {
    px(g, 4, 18, 30, 12, '#7a5c34'); px(g, 4, 18, 30, 2, '#9c7c48');
    for (let x = 6; x < 34; x += 6) px(g, x, 20, 1, 10, '#5a4326');
    px(g, 30, 16, 12, 3, '#8a6a3c');
    for (const cx of [12, 28]) {
      px(g, cx - 6, 28, 12, 12, '#6b4a2c');
      px(g, cx - 5, 29, 10, 10, '#8a6a3c');
      px(g, cx - 2, 32, 4, 4, '#4a3a26');
      for (let i = 0; i < 8; i++) { const a = i / 8 * 6.3; px(g, cx + Math.cos(a) * 4, 34 + Math.sin(a) * 4, 1, 1, '#5a4326'); }
    }
    for (let k = 0; k < 3; k++) { const t = pickr(r, ['#b4623c', '#c9a24a', '#8a7a52']); px(g, 7 + k * 8, 12, 6, 6, t); }
  });
  P.crane = one(48, 80, (g, mk, r) => {
    px(g, 4, 74, 40, 6, '#8a7c60');
    px(g, 8, 8, 5, 68, '#6b4a2c'); px(g, 12, 8, 4, 68, '#8a6a3c');
    px(g, 10, 6, 34, 4, '#6b4a2c'); px(g, 10, 6, 34, 1, '#8a6a3c');
    px(g, 40, 10, 2, 18, '#3a2c1e');
    px(g, 34, 28, 12, 10, '#a8763c'); px(g, 34, 28, 12, 1, '#c4954f');
    for (let i = 0; i < 4; i++) px(g, 30 - i * 5, 10 + i * 4, 8, 2, '#5a4326');
  });
  P.ship = one(96, 96, (g, mk, r) => {
    const hull = '#6b4a2c';
    g.beginPath(); g.moveTo(6, 66); g.lineTo(88, 66); g.lineTo(74, 84); g.lineTo(20, 84); g.closePath(); g.fillStyle = hull; g.fill();
    for (let i = 0; i < 6; i++) px(g, 12 + i * 12, 68, 2, 14, '#4a3a26');
    px(g, 6, 64, 82, 3, '#8a6a3c');
    px(g, 16, 84, 56, 2, '#3a2c1e');
    px(g, 44, 10, 4, 54, '#8a6a3c');                                   // mast
    px(g, 46, 14, 30, 3, '#6b4a2c');
    g.beginPath(); g.moveTo(48, 18); g.lineTo(78, 50); g.lineTo(48, 50); g.closePath(); g.fillStyle = '#e2d6bc'; g.fill();
    for (let i = 0; i < 5; i++) px(g, 50 + i * 6, 20 + i * 6, 20 - i * 3, 2, 'rgba(150,130,100,.4)');
    px(g, 36, 26, 10, 24, '#c9b49a');
    for (let i = 0; i < 10; i++) { px(g, 4 + i * 2, 88, 3, 6, '#4a3a26'); }
    px(g, 60, 40, 18, 1, '#8a6a3c');
  });
  P.milestone = one(32, 30, (g, mk, r) => {
    px(g, 10, 12, 12, 18, '#c6bb9c'); px(g, 10, 12, 12, 1, '#ded2b0');
    px(g, 12, 8, 8, 5, '#b3a68c');
    for (let y = 15; y < 28; y += 4) px(g, 12, y, 8, 2, '#9c8f70');
  });
  P.tomb = one(64, 56, (g, mk, r) => {
    px(g, 2, 8, 60, 48, '#d5cbb0'); px(g, 2, 8, 60, 3, '#efe6cb');
    for (let x = 6; x < 58; x += 14) { px(g, x, 16, 10, 14, '#bfb28f'); px(g, x + 2, 19, 6, 8, '#8f826a'); }
    for (let y = 34; y < 50; y += 5) for (let x = 6; x < 54; x += 5) px(g, x, y, 3, 3, chance(r, .5) ? '#8f826a' : '#b5a888');
  });
  P.reeds = one(32, 40, (g, mk, r) => {
    for (let i = 0; i < 12; i++) { const x = 2 + r() * 28, hh = 14 + r() * 22; px(g, x, 40 - hh, 1, hh, pickr(r, ['#5a7d3a', '#6d8f44', '#4a6a33'])); if (chance(r, .4)) px(g, x + 1, 40 - hh + 3, 1, hh - 4, '#7ba24f'); }
  });
  P.bench = one(32, 26, (g, mk, r) => {
    px(g, 3, 10, 26, 5, '#a58a5c'); px(g, 3, 10, 26, 1, '#c0a473');
    px(g, 5, 15, 4, 9, '#7a5c34'); px(g, 23, 15, 4, 9, '#7a5c34');
  });
  P.haystack = one(48, 40, (g, mk, r) => {
    g.beginPath(); g.moveTo(2, 38); g.lineTo(12, 10); g.lineTo(36, 10); g.lineTo(46, 38); g.closePath(); g.fillStyle = '#c2a458'; g.fill();
    for (let i = 0; i < 40; i++) px(g, 4 + r() * 40, 12 + r() * 26, 3, 1, chance(r, .5) ? '#a8862f' : '#d8bc6a');
    px(g, 2, 36, 44, 3, '#8a6f2c');
  });
  P.cypress = one(40, 88, (g, mk, r) => {
    px(g, 17, 76, 6, 12, '#4a3a26');
    g.beginPath(); g.moveTo(20, 4); g.lineTo(33, 46); g.lineTo(30, 80); g.lineTo(10, 80); g.lineTo(7, 46); g.closePath();
    g.fillStyle = '#2c4a2c'; g.fill();
    for (let i = 0; i < 40; i++) { const x = 9 + r() * 22, y = 8 + r() * 70; px(g, x, y, 2, 3, chance(r, .5) ? '#1f3a20' : '#3d6238'); }
    px(g, 18, 10, 3, 30, '#446b3c');
  });
  P.pine = one(48, 72, (g, mk, r) => {
    px(g, 21, 54, 6, 18, '#5a4326');
    g.beginPath(); g.ellipse(24, 30, 22, 14, 0, 0, 6.3); g.fillStyle = '#3a5c33'; g.fill();
    g.beginPath(); g.ellipse(18, 24, 14, 10, 0, 0, 6.3); g.fillStyle = '#44693a'; g.fill();
    for (let i = 0; i < 34; i++) { const x = 4 + r() * 40, y = 16 + r() * 22; px(g, x, y, 2, 2, chance(r, .5) ? '#2c4a2c' : '#527a44'); }
    px(g, 20, 22, 8, 4, '#5c8a4c');
  });
  P.olive = one(48, 60, (g, mk, r) => {
    px(g, 22, 42, 5, 18, '#6b5a3a');
    g.beginPath(); g.ellipse(24, 32, 18, 13, 0, 0, 6.3); g.fillStyle = '#5e7a48'; g.fill();
    for (let i = 0; i < 30; i++) { const x = 8 + r() * 32, y = 22 + r() * 20; px(g, x, y, 2, 2, chance(r, .5) ? '#4a6638' : '#7a945c'); }
    for (let i = 0; i < 6; i++) px(g, 10 + r() * 28, 24 + r() * 16, 1, 1, '#2f2618');
  });
  P.fig = one(44, 56, (g, mk, r) => {
    px(g, 20, 40, 5, 16, '#7a6242');
    g.beginPath(); g.ellipse(22, 30, 19, 12, 0, 0, 6.3); g.fillStyle = '#4c6b3a'; g.fill();
    for (let i = 0; i < 26; i++) { const x = 5 + r() * 34, y = 20 + r() * 20; px(g, x, y, 3, 2, chance(r, .5) ? '#3c5c2c' : '#658c4c'); }
    for (let i = 0; i < 4; i++) px(g, 12 + r() * 24, 24 + r() * 14, 2, 2, '#7a4a6a');
  });
  P.hedge = one(32, 26, (g, mk, r) => {
    px(g, 1, 8, 30, 16, '#375c2c');
    for (let i = 0; i < 60; i++) px(g, 2 + r() * 28, 8 + r() * 15, 2, 2, chance(r, .5) ? '#2b4a24' : '#4c7438');
    px(g, 1, 8, 30, 2, '#5c8a44'); px(g, 1, 22, 30, 2, '#22381c');
  });
  /* a vine on its stakes: a rounded mass of leaves lit from the upper left, with a few bunches of grapes hanging
     out of it (it used to be a grid of green squares, which read as a fence) */
  P.vines = one(40, 40, (g, mk, r) => {
    px(g, 9, 22, 2, 18, '#6b5a3a'); px(g, 29, 24, 2, 16, '#6b5a3a'); px(g, 9, 24, 22, 1, '#7a6644');
    const blobs = []; for (let i = 0; i < 9; i++) blobs.push([8 + r() * 24, 12 + r() * 16, 5 + r() * 5]);
    const inside = (x, y, k) => blobs.some(b => (x - b[0]) ** 2 + (y - b[1]) ** 2 <= (b[2] + k) ** 2);
    for (let y = 0; y < 40; y++) for (let x = 0; x < 40; x++) {
      if (!inside(x + .5, y + .5, 0)) continue;
      const lit = !inside(x - 2.5, y - 2.5, 0), dark = !inside(x + 2.5, y + 2.5, 0);
      px(g, x, y, 1, 1, lit ? '#6f9c4c' : dark ? '#2f4a24' : ((x * 7 + y * 13) % 5 === 0 ? '#3f6a2e' : '#4c7a36'));
    }
    for (let i = 0; i < 4; i++) { const x = 8 + r() * 24, y = 20 + r() * 10; px(g, x, y, 3, 3, '#5a2f5a'); px(g, x + 1, y + 3, 1, 1, '#4a244a'); px(g, x, y, 1, 1, '#8a5a8a'); }
  });
  P.flowers = one(32, 24, (g, mk, r) => {
    for (let i = 0; i < 8; i++) { const x = 3 + i * 3.5, hh = 6 + r() * 10; px(g, x, 22 - hh, 1, hh, '#4c7438'); px(g, x - 1, 22 - hh - 2, 3, 3, pickr(r, ['#d1708f', '#e0c04a', '#e8e2d0', '#c05a4a', '#7a8ad0'])); }
  });
  P.dog = one(32, 24, (g, mk, r) => {
    px(g, 8, 12, 14, 7, '#a8763c'); px(g, 19, 8, 7, 6, '#b98547');
    px(g, 20, 6, 3, 4, '#a8763c'); px(g, 23, 9, 3, 2, '#3a2c1e');
    px(g, 24, 10, 1, 1, '#20180f');
    for (const x of [10, 14, 18]) px(g, x, 19, 3, 4, '#a8763c');
    px(g, 8, 12, 3, 3, '#3a2c1e');
  });
  P.chicken = one(24, 22, (g, mk, r) => {
    px(g, 8, 10, 9, 7, '#e2d6bc'); px(g, 15, 7, 5, 5, '#efe6cb');
    px(g, 14, 5, 2, 3, '#c04a2c'); px(g, 19, 9, 2, 2, '#e0a03c');
    px(g, 10, 17, 2, 4, '#c9a24a'); px(g, 14, 17, 2, 4, '#c9a24a'); px(g, 5, 10, 4, 3, '#d8cca8');
  });
  P.oxen = one(48, 40, (g, mk, r) => {
    px(g, 6, 18, 28, 14, '#c9b49a'); px(g, 30, 14, 12, 11, '#d5c0a4');
    px(g, 30, 8, 4, 6, '#e2d6bc'); px(g, 38, 8, 4, 6, '#e2d6bc');
    g.beginPath(); g.moveTo(32, 14); g.lineTo(26, 6); g.lineTo(33, 13); g.closePath(); g.fillStyle = '#e2d6bc'; g.fill();
    g.beginPath(); g.moveTo(41, 14); g.lineTo(47, 6); g.lineTo(40, 13); g.closePath(); g.fillStyle = '#e2d6bc'; g.fill();
    px(g, 41, 18, 2, 2, '#2b1f16'); px(g, 42, 24, 3, 2, '#8a7a68');
    for (const x of [9, 15, 25, 31]) px(g, x, 30, 4, 8, '#b09a7c');
    px(g, 5, 22, 3, 4, '#a08a68');
  });
  P.standard = one(32, 64, (g, mk, r) => {
    px(g, 15, 10, 3, 54, '#8a6a3c');
    px(g, 12, 58, 9, 4, '#c6bb9c');
    px(g, 9, 18, 15, 12, '#8e2f2c');
    for (let x = 9; x < 24; x += 4) px(g, x, 18, 2, 12, '#e6d6a2');
    px(g, 10, 16, 13, 3, '#c9a24a');
    px(g, 12, 8, 8, 8, '#d9b64a'); px(g, 14, 10, 4, 4, '#8a6a2c');
    px(g, 11, 6, 10, 2, '#c9a24a');
  });
  P.bust = one(32, 36, (g, mk, r) => {
    px(g, 8, 26, 16, 10, '#cfc4a6'); px(g, 8, 26, 16, 1, '#e8dfc3');
    px(g, 11, 12, 10, 15, '#e2d8bd');
    px(g, 12, 8, 8, 6, '#d5cbb0');
    px(g, 13, 13, 1, 2, '#6b6152'); px(g, 17, 13, 1, 2, '#6b6152');
  });
  P.water = anim(32, 32, 4, (g, mk, r, w, h, i) => {
    for (let k = 0; k < 4; k++) {
      const x = (i * 7 + k * 11) % 30, y = (i * 5 + k * 9) % 30;
      px(g, x, y, 3, 1, 'rgba(200,235,240,.5)'); px(g, x + 1, y + 1, 1, 1, 'rgba(160,210,220,.4)');
    }
  }, true, true);
  P.spray = anim(48, 32, 4, (g, mk, r, w, h, i) => {
    for (let k = 0; k < 14; k++) { const x = (k * 3 + i * 2) % 46, y = 26 - ((k * 5 + i * 7) % 24); px(g, x, y, 1, 2, 'rgba(230,246,250,.7)'); }
  }, true, true);
  P.smoke = anim(32, 32, 4, (g, mk, r, w, h, i) => {
    for (let k = 0; k < 10; k++) { const x = 10 + Math.sin((k + i) / 2) * 5, y = 28 - k * 2 - i; px(g, x, y, 4, 3, 'rgba(200,190,180,.22)'); }
  }, true, true);

  return { tiles, facade, prop, T, VARS };
})();

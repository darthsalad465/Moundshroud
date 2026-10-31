/* ROOMS — the insides. Walking up to a door and pressing E takes you in, and every one of these is a real room:
   a floor of mosaic or marble, frescoed walls, furniture you can walk round, and the people who belong there.
   Rooms are small — twenty-odd tiles across — so they are painted whole, once, the first time you enter.
   Nine buildings have interiors; the templates below are shared by the ones that are the same kind of place. */
window.IMP = window.IMP || {};
(function () {
  'use strict';
  const IMP = window.IMP;
  const B = window.PIXTOOLS;
  const { T, cv, ctx, px, mix, shade, ramp, cl, pickr, chance, edge } = B;
  const rng = seed => { let a = (seed >>> 0) || 1; return () => { a += 0x6d2b79f5; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };

  /* =========================== the furniture room =========================== */
  const F = {}, ANIM = {};
  const one = (w, h, draw, over) => r => { const c = cv(w, h), g = ctx(c); draw(g, r, w, h); return { c, w, h, over }; };
  const anim = (w, h, n, draw, over) => r => {
    const frames = [];
    for (let i = 0; i < n; i++) { const c = cv(w, h); draw(ctx(c), r, w, h, i); frames.push(c); }
    return { frames, w, h, over, fps: 7 };
  };
  const outline = (art, o) => { if (art && art.c && !art.soft) art.c = edge(art.c, 'rgba(24,16,20,.8)'); return art; };

  /* the impluvium: the pool in the middle of the atrium, fed by a hole in the roof */
  F.impluvium = anim(96, 48, 4, (g, r, w, h, i) => {
    px(g, 0, 12, 96, 34, '#cfc6ae'); px(g, 0, 12, 96, 3, '#e6dcc4'); px(g, 0, 43, 96, 3, '#a89a78');
    for (let x = 4; x < 92; x += 12) px(g, x, 16, 8, 26, '#bdb29a');
    px(g, 8, 18, 80, 22, '#2f5a6b');
    for (let k = 0; k < 8; k++) { const y = 20 + k * 2.6, off = (i * 3 + k * 7) % 70; px(g, 12 + off, y, 14, 1, 'rgba(150,200,210,.35)'); }
    px(g, 10, 18, 76, 2, '#4a7d8c');
    px(g, 40, 14, 16, 6, '#6a9aa8'); px(g, 44, 12, 8, 4, '#8fc0cc');
  }, true);
  /* a dining couch: three of these round a table is how Rome eats */
  F.couch = one(64, 44, (g) => {
    px(g, 2, 18, 60, 20, '#8a5a3c'); px(g, 2, 18, 60, 3, '#a8744c'); px(g, 2, 35, 60, 3, '#5f3c26');
    px(g, 4, 12, 20, 8, '#b8776a'); px(g, 4, 12, 20, 2, '#cf9686');
    for (let x = 6; x < 62; x += 7) px(g, x, 21, 5, 12, chance(rng(x), .5) ? '#9c6a44' : '#8a5a3c');
    px(g, 2, 20, 60, 1, 'rgba(255,240,210,.2)');
    px(g, 4, 38, 6, 5, '#6b4a2c'); px(g, 54, 38, 6, 5, '#6b4a2c');
  });
  F.table = one(48, 34, (g) => {
    px(g, 2, 10, 44, 5, '#8a6a3c'); px(g, 2, 10, 44, 1, '#a98a52');
    px(g, 6, 15, 4, 16, '#6b4a2c'); px(g, 38, 15, 4, 16, '#6b4a2c');
    const rr = rng(9);
    for (let k = 0; k < 5; k++) { const x = 6 + k * 8, t = pickr(rr, ['#c9a24a', '#a8562f', '#7a9c52', '#c07a4a']); px(g, x, 4, 5, 6, t); px(g, x + 1, 3, 3, 2, shade(t, .2)); }
    px(g, 4, 6, 10, 4, '#b4623c'); px(g, 6, 5, 6, 2, '#c97a52');
  });
  F.chest = one(40, 34, (g) => {
    px(g, 2, 12, 36, 20, '#7a5230'); px(g, 2, 12, 36, 3, '#9c6f42'); px(g, 2, 29, 36, 3, '#523622');
    for (let x = 4; x < 38; x += 8) px(g, x, 13, 6, 19, '#8c5f38');
    px(g, 16, 16, 8, 12, '#c9a24a'); px(g, 19, 20, 2, 4, '#6b4a2c');
    px(g, 4, 33, 6, 3, '#4a3020'); px(g, 30, 33, 6, 3, '#4a3020');
  });
  F.scrollrack = one(40, 56, (g) => {
    px(g, 2, 4, 36, 50, '#6b4a2c'); px(g, 2, 4, 36, 2, '#8a6a3c');
    for (let y = 6; y < 52; y += 11) {
      px(g, 3, y + 8, 34, 3, '#523820');
      const rr = rng(y);
      for (let x = 5; x < 36; x += 5) { const t = pickr(rr, ['#e6d6b0', '#d8c49a', '#c9b48a']); px(g, x, y + 1, 4, 7, t); px(g, x, y + 1, 4, 1, shade(t, .2)); }
    }
    px(g, 12, 10, 16, 2, '#8a6a3c');
  });
  F.shrine = one(40, 56, (g) => {
    px(g, 4, 14, 32, 40, '#8a5a3c'); px(g, 4, 14, 32, 3, '#a8744c');
    px(g, 8, 20, 24, 18, '#4a3020'); px(g, 10, 22, 20, 14, '#2f2118');
    for (let k = 0; k < 4; k++) { px(g, 12 + k * 5, 24, 3, 10, '#b0a48f'); px(g, 12 + k * 5, 22, 3, 2, shade('#b0a48f', -.3)); }
    px(g, 2, 8, 36, 6, '#cfc6ae'); px(g, 2, 8, 36, 1, '#e6dcc4');
    px(g, 16, 2, 8, 6, '#e8792c'); px(g, 17, 0, 6, 3, '#f2a63c');
  }, true);
  F.hearth = anim(48, 40, 4, (g, r, w, h, i) => {
    px(g, 2, 14, 44, 20, '#6b6152'); px(g, 2, 14, 44, 2, '#8a7f6c');
    for (let x = 4; x < 44; x += 8) px(g, x, 16, 6, 16, '#5a5245');
    px(g, 10, 20, 28, 12, '#2a2320');
    for (let k = 0; k < 5; k++) { const x = 14 + k * 5, hh = 4 + ((k + i) % 3) * 2; px(g, x, 32 - hh, 4, hh, '#e8792c'); px(g, x + 1, 30 - hh, 2, hh, '#f8d07a'); }
    px(g, 0, 34, 48, 4, '#8a7f6c');
  }, true);
  F.pool = one(96, 64, (g, r) => {
    px(g, 0, 8, 96, 52, '#cfc6ae'); px(g, 0, 8, 96, 3, '#e6dcc4');
    px(g, 6, 14, 84, 40, '#3f7a8c'); px(g, 6, 14, 84, 3, '#6aa8b8');
    for (let y = 20; y < 52; y += 6) for (let x = 10; x < 88; x += 14) px(g, x + (y % 12 ? 4 : 0), y, 10, 1, 'rgba(200,235,240,.28)');
    for (let k = 0; k < 6; k++) px(g, 10 + r() * 76, 16 + r() * 34, 2, 2, 'rgba(230,246,250,.4)');
    px(g, 4, 58, 88, 4, '#a89a78');
  }, true);
  F.dais = one(96, 56, (g) => {
    px(g, 0, 20, 96, 36, '#d5cbb0'); px(g, 0, 20, 96, 3, '#efe6cb'); px(g, 0, 50, 96, 4, '#a89a78');
    for (let x = 6; x < 90; x += 12) px(g, x, 26, 8, 20, '#c6b99c');
    px(g, 6, 8, 84, 14, '#c6b99c'); px(g, 6, 8, 84, 2, '#e2d8ba');
    px(g, 12, 0, 72, 10, '#b3a68c');
  });
  F.urn = one(32, 48, (g) => {
    px(g, 10, 36, 12, 10, '#c6bb9c'); px(g, 10, 36, 12, 1, '#ded2b0');
    px(g, 6, 34, 20, 5, '#b3a68c');
    g.beginPath(); g.ellipse(16, 24, 11, 12, 0, 0, 6.3); g.fillStyle = '#b4623c'; g.fill();
    px(g, 6, 20, 6, 10, '#c97a52'); px(g, 20, 20, 6, 10, '#8a4a2c');
    px(g, 12, 8, 8, 5, '#a8562f'); px(g, 13, 6, 6, 3, '#c97a52');
    px(g, 10, 4, 12, 2, '#8a6a3c');
  });
  F.loom = one(48, 56, (g) => {
    px(g, 2, 6, 6, 46, '#7a5230'); px(g, 40, 6, 6, 46, '#7a5230'); px(g, 2, 4, 44, 4, '#8c5f38');
    for (let y = 10; y < 48; y += 3) px(g, 10, y, 28, 2, y % 6 ? '#c9b49a' : '#a86a5a');
    px(g, 6, 30, 36, 4, '#6b4a2c'); px(g, 16, 34, 16, 6, '#4a3020');
  });
  F.cabinet = one(48, 52, (g) => {
    px(g, 2, 4, 44, 44, '#6b4a2c'); px(g, 2, 4, 44, 3, '#8a6a3c');
    px(g, 5, 8, 18, 36, '#7a5230'); px(g, 25, 8, 18, 36, '#7a5230');
    px(g, 5, 8, 18, 2, '#9c6f42'); px(g, 25, 8, 18, 2, '#9c6f42');
    px(g, 20, 24, 3, 4, '#c9a24a'); px(g, 25, 24, 3, 4, '#c9a24a');
    px(g, 4, 46, 8, 4, '#4a3020'); px(g, 36, 46, 8, 4, '#4a3020');
  });
  F.bed = one(48, 56, (g) => {
    px(g, 2, 8, 44, 46, '#7a5230'); px(g, 2, 8, 44, 3, '#9c6f42');
    px(g, 6, 14, 36, 30, '#c9b49a'); px(g, 6, 14, 36, 2, '#e0d2bc');
    px(g, 6, 40, 36, 8, '#a86a5a'); px(g, 6, 40, 36, 2, '#c08474');
    px(g, 8, 10, 18, 8, '#e0d6bc'); px(g, 8, 12, 18, 4, '#c9bda3');
  });
  F.stool = one(24, 26, (g) => {
    px(g, 3, 8, 18, 5, '#8a6a3c'); px(g, 3, 8, 18, 1, '#a98a52');
    px(g, 5, 13, 4, 12, '#6b4a2c'); px(g, 15, 13, 4, 12, '#6b4a2c');
  });
  F.rug = one(80, 48, (g, r) => {
    px(g, 0, 4, 80, 40, '#8e2f2c');
    px(g, 3, 7, 74, 34, '#7a241f'); px(g, 6, 10, 68, 28, '#5e1a1c');
    px(g, 0, 4, 80, 2, '#c9a24a'); px(g, 0, 42, 80, 2, '#c9a24a');
    for (let x = 10; x < 72; x += 12) { px(g, x, 16, 8, 8, '#c9a24a'); px(g, x + 2, 18, 4, 4, '#7a241f'); }
    pebble(g, r);
  }, true);
  F.mill = one(48, 52, (g) => {
    px(g, 6, 30, 36, 18, '#8a7f6c'); px(g, 6, 30, 36, 2, '#a89a86');
    px(g, 10, 10, 28, 20, '#6b6152'); px(g, 14, 4, 20, 8, '#5a5245');
    g.beginPath(); g.arc(24, 22, 12, 0, 6.3); g.fillStyle = '#7a7264'; g.fill();
    px(g, 23, 10, 2, 24, '#4a4538'); px(g, 12, 21, 24, 2, '#4a4538');
  });
  F.palus = one(32, 64, (g) => {
    px(g, 13, 16, 6, 48, '#7a5230'); px(g, 12, 12, 8, 6, '#5f3c26');
    px(g, 12, 24, 8, 3, '#8a6a3c'); px(g, 12, 34, 8, 3, '#8a6a3c');
    px(g, 15, 16, 2, 48, '#9c6f42');
  });
  F.winejars = one(40, 44, (g) => {
    const jar = (x, y, s, t) => { px(g, x + 2 * s, y + 2 * s, 4 * s, 4 * s, t); px(g, x, y + 6 * s, 8 * s, 10 * s, t); px(g, x, y + 6 * s, 2 * s, 10 * s, shade(t, .2)); px(g, x + 6 * s, y + 8 * s, 2 * s, 8 * s, shade(t, -.2)); };
    jar(2, 6, 2, '#a8562f'); jar(18, 2, 2, '#b4623c'); jar(10, 22, 1, '#8a4a2c');
  });
  F.bar = one(96, 44, (g, r) => {
    px(g, 0, 12, 96, 26, '#6b4a2c'); px(g, 0, 12, 96, 3, '#8a6a3c'); px(g, 0, 34, 96, 4, '#4a3020');
    for (let x = 4; x < 92; x += 10) px(g, x, 16, 7, 18, '#5a3f26');
    for (let k = 0; k < 8; k++) { const t = pickr(r, ['#c9a24a', '#a8562f', '#b4623c', '#8a6a3c']); px(g, 6 + k * 11, 6, 7, 8, t); px(g, 7 + k * 11, 4, 5, 2, shade(t, .25)); }
  });
  F.counter = one(96, 40, (g, r) => {
    px(g, 0, 14, 96, 22, '#8a6a3c'); px(g, 0, 14, 96, 3, '#a98a52');
    for (let k = 0; k < 9; k++) { const x = 4 + k * 10, t = pickr(r, ['#c9a24a', '#a8562f', '#7a9c52', '#8c5a3c', '#b08a5a']); px(g, x, 6, 7, 8, t); px(g, x + 1, 4, 5, 3, shade(t, .2)); }
    px(g, 0, 34, 96, 3, '#5f3c26');
  });
  F.crate = one(40, 40, (g) => {
    px(g, 2, 8, 36, 28, '#8a6a3c'); px(g, 2, 8, 36, 3, '#a98a52');
    px(g, 2, 8, 36, 2, '#a98a52'); px(g, 4, 12, 32, 3, '#6b4a2c'); px(g, 4, 28, 32, 3, '#6b4a2c');
    px(g, 18, 8, 4, 28, '#6b4a2c');
  });
  F.standard2 = one(32, 64, (g) => {
    px(g, 15, 10, 3, 54, '#8a6a3c'); px(g, 20, 12, 6, 4, '#4a3020');
    px(g, 8, 16, 16, 14, '#8e2f2c'); for (let x = 8; x < 24; x += 4) px(g, x, 16, 2, 14, '#e6d6a2');
    px(g, 9, 14, 14, 3, '#c9a24a'); px(g, 12, 6, 8, 8, '#d9b64a');
  });
  F.map = one(80, 44, (g) => {
    px(g, 0, 10, 80, 24, '#6b4a2c'); px(g, 0, 10, 80, 2, '#8a6a3c');
    px(g, 4, 14, 72, 16, '#e6dcc4');
    for (let k = 0; k < 6; k++) px(g, 6 + k * 12, 16, 8, 2, '#8a7c60');
    px(g, 20, 22, 12, 6, '#8e2f2c'); px(g, 46, 18, 10, 5, '#3f5f7a');
  });
  F.niche = one(40, 72, (g) => {
    px(g, 0, 6, 40, 64, '#c6b99c'); px(g, 0, 6, 40, 3, '#e2d8ba');
    px(g, 6, 16, 28, 46, '#8a7f6c'); px(g, 8, 18, 24, 42, '#5a5245');
    px(g, 12, 26, 16, 34, '#d5cbb0'); px(g, 14, 20, 12, 8, '#e2d8ba');
    px(g, 16, 30, 8, 22, '#e2d8ba'); px(g, 17, 28, 6, 4, '#cfc6ae');
    px(g, 0, 66, 40, 6, '#b3a68c');
  });
  const pebble = (g, r) => { for (let i = 0; i < 5; i++) px(g, 4 + r() * 70, 8 + r() * 30, 2, 1, 'rgba(255,246,214,.14)'); };
  const WALKOVER = { rug: 1 };
  function furn(name, seed) {
    const f = F[name];
    if (!f) return window.PIXWORLD.prop(name, seed);        // some rooms use the street furniture as it stands
    return outline(f(rng(B.hash(name + (seed | 0)) + 13)));
  }

  /* =========================== room templates =========================== */
  const box = (g, x, y, w, h, col) => px(g, x, y, w, h, col);
  /* the walls of every room: frescoed inside, with a painted dado and a border, and a doorway in the south wall */
  function wallBand(g, x, y, w, h, kind, doorX) {
    const tones = kind === 'temple' ? ['#5b5148', '#3f3730'] : ['#7a2620', '#4a1c18'];
    px(g, x, y, w, h, tones[1]);
    for (let t = 0; t < 3; t++) {
      for (let i = 0; i < w / 32; i++) {
        const fx = x + i * 32;
        px(g, fx, y, 30, h, tones[0]);
        px(g, fx, y, 30, 2, 'rgba(255,240,200,.14)');
        px(g, fx, y + h - 6, 30, 6, '#2a211a');
        px(g, fx + 2, y + 4, 26, h - 12, shade(tones[0], -.12));
        for (let k = 0; k < 3; k++) px(g, fx + 6 + k * 9, y + 6, 5, h - 16, '#d8c49a');
      }
    }
  }
  function roomPlan(R) {
    const r = rng(B.hash(R.id) + 3);
    const W = R.w, H = R.h, floorSheet = PIX.tiles().at;
    const c = cv(W * T, H * T), g = ctx(c);
    const floor = floorSheet[R.floor] || floorSheet.stone;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (x === 0 || y === 0 || x === W - 1 || y === H - 1) continue;
      g.drawImage(floor[(x * 7 + y * 3) % floor.length], x * T, y * T);
    }
    wallBand(g, 0, 0, W * T, T, R.wall, 0);
    wallBand(g, 0, 0, T, H * T, R.wall, 0);
    wallBand(g, (W - 1) * T, 0, T, H * T, R.wall, 0);
    wallBand(g, 0, (H - 1) * T, W * T, T, R.wall, 0);
    /* the doorway out, drawn as an opening in the south wall */
    const dx = R.door === undefined ? (W >> 1) : R.door;
    px(g, dx * T - 2, (H - 1) * T, T + 4, T, '#d8c49a');
    px(g, dx * T, (H - 1) * T + 6, T, T - 6, '#2a211a');
    px(g, dx * T, (H - 1) * T + 4, T, 3, '#a89a78');
    px(g, dx * T - 4, (H - 1) * T, 3, T, '#b3a68c'); px(g, dx * T + T + 1, (H - 1) * T, 3, T, '#b3a68c');
    /* furniture, then the people */
    const solid = new Uint8Array(W * H), lights = [], over = [];
    for (let i = 0; i < W * H; i++) { const x = i % W, y = (i / W) | 0; if (x === 0 || y === 0 || x === W - 1 || y === H - 1) solid[i] = 1; }
    solid[(H - 1) * W + dx] = 0;
    (R.items || []).forEach(it => {
      const art = furn(it[0], it[3] || 0); if (!art) return;
      const tw = it[5] || 1, th = it[6] || 1;
      const x = it[1] * T + ((tw * T - art.w) >> 1), y = it[2] * T + th * T - art.h;
      if (art.frames || art.over) over.push({ art, x, y }); else g.drawImage(art.c, x, y);
      if (it[0] === 'hearth' || it[0] === 'shrine') lights.push({ x: it[1], y: it[2] });
      if (WALKOVER[it[0]]) return;
      for (let j = 0; j < th; j++) for (let k = 0; k < tw; k++) { const sx = it[1] + k, sy = it[2] + j; if (sx < W && sy < H) solid[sy * W + sx] = 1; }
    });
    (R.lamps || []).forEach(l => lights.push({ x: l[0], y: l[1] }));
    SOLIDS[R.id] = solid;
    return { base: c, w: W, h: H, solid, over, lights, door: { x: dx, y: H - 1 }, spawn: { x: dx, y: H - 2 }, name: R.name };
  }
  const SOLIDS = {}, CACHE = {};

  const T_ATRIUM = (o) => Object.assign({
    floor: 'mosaic', wall: 'plain', items: [
      ['rug', 5, 4, 1, null, 3, 2], ['impluvium', 5, 5, 2, null, 3, 1],
      ['couch', 2, 3, 3, null, 2, 1], ['couch', 11, 3, 4, null, 2, 1], ['table', 5, 9, 5, null, 2, 1],
      ['shrine', 1, 7, 6], ['cabinet', 12, 8, 7], ['scrollrack', 13, 2, 8], ['stool', 10, 9, 9], ['stool', 8, 10, 10],
      ['urn', 1, 11, 11], ['couch', 2, 11, 12, null, 2, 1], ['winejars', 12, 11, 13]
    ], lamps: []
  }, o || {});
  const T_TEMPLE = (o) => Object.assign({
    floor: 'marble', wall: 'temple', items: [
      ['dais', 3, 2, 1, null, 4, 1], ['altar', 4, 3, 2], ['niche', 1, 2, 3], ['niche', 13, 2, 4],
      ['column', 3, 5, 5], ['column', 12, 5, 6], ['altar', 8, 5, 7], ['urn', 2, 8, 8], ['urn', 13, 8, 9],
      ['statue', 8, 2, 10], ['couch', 5, 9, 11, null, 2, 1], ['rug', 6, 5, 12, null, 3, 1]
    ]
  }, o || {});
  const T_HALL = (o) => Object.assign({
    floor: 'marble', wall: 'plain', items: [
      ['dais', 4, 2, 1, null, 5, 1], ['rug', 5, 7, 2, null, 4, 1],
      ['column', 2, 4, 3], ['column', 15, 4, 4], ['column', 2, 9, 5], ['column', 15, 9, 6],
      ['bench2', 4, 6, 7], ['bench2', 4, 10, 8], ['cabinet', 13, 2, 9], ['scrollrack', 1, 2, 10],
      ['table', 9, 5, 11], ['statue', 9, 2, 12], ['stool', 9, 9, 13]
    ]
  }, o || {});
  const T_MARKET = (o) => Object.assign({
    floor: 'stone', wall: 'plain', items: [
      ['counter', 2, 3, 1, null, 4, 1], ['counter', 9, 3, 2, null, 4, 1], ['counter', 2, 10, 3, null, 5, 1],
      ['crate', 13, 3, 4], ['winejars', 12, 6, 5], ['amphorae', 14, 9, 6], ['cart', 6, 8, 7, null, 2, 1],
      ['table', 9, 10, 8, null, 2, 1], ['bar', 2, 6, 9, null, 3, 1], ['crate', 1, 12, 10]
    ]
  }, o || {});
  const T_TAVERN = (o) => Object.assign({
    floor: 'wood', wall: 'plain', items: [
      ['bar', 2, 3, 1, null, 3, 1], ['winejars', 12, 3, 2], ['crate', 14, 4, 3],
      ['table', 4, 8, 4], ['stool', 3, 9, 5], ['stool', 6, 9, 6], ['table', 10, 8, 7], ['stool', 9, 9, 8], ['stool', 12, 9, 9],
      ['couch', 6, 12, 10, null, 3, 1], ['barrelf', 14, 10, 11]
    ]
  }, o || {});
  const T_BATH = (o) => Object.assign({
    floor: 'marble', wall: 'plain', items: [
      ['pool', 3, 3, 1, null, 4, 2], ['pool', 4, 9, 2, null, 3, 2], ['bench2', 9, 4, 3],
      ['cabinet', 13, 2, 4], ['statue', 8, 2, 5], ['urn', 12, 8, 6], ['couch', 8, 9, 7, null, 2, 1],
      ['column', 1, 7, 8], ['column', 15, 7, 9], ['stool', 11, 12, 10]
    ]
  }, o || {});
  const T_YARD = (o) => Object.assign({
    floor: 'sand', wall: 'plain', items: [
      ['palus', 4, 3, 1], ['palus', 12, 3, 2], ['standard', 8, 2, 3], ['map', 6, 8, 4, null, 2, 1],
      ['crate', 2, 9, 5], ['crate', 14, 9, 6], ['winejars', 13, 5, 7], ['bench2', 3, 5, 8],
      ['standard', 11, 5, 9], ['barrelf', 15, 12, 10], ['stool', 9, 12, 11]
    ]
  }, o || {});
  const T_WAREHOUSE = (o) => Object.assign({
    floor: 'wood', wall: 'plain', items: [
      ['crate', 2, 3, 1], ['crate', 6, 3, 2], ['crate', 10, 3, 3], ['crate', 14, 3, 4],
      ['crate', 4, 6, 5], ['winejars', 9, 6, 6], ['amphorae', 13, 6, 7], ['map', 6, 10, 8, null, 2, 1],
      ['bar', 2, 10, 9, null, 3, 1], ['crate', 12, 10, 10], ['urn', 15, 8, 11]
    ]
  }, o || {});

  /* the amphitheatre floor: nothing but raked sand, the two gates the fighters are let in through, and the
     editor's podium at the north end. Big — twenty tiles across — because the whole point of it is size. */
  const T_ARENA = (o) => Object.assign({
    floor: 'sand', wall: 'plain', items: [
      ['standard', 3, 2, 1], ['standard', 16, 2, 2], ['stool', 9, 2, 3],
      ['bench2', 4, 4, 4], ['bench2', 14, 4, 5],
      ['crate', 2, 11, 6], ['crate', 17, 11, 7],
      ['barrelf', 3, 13, 8], ['barrelf', 16, 13, 9], ['winejars', 10, 13, 10],
      ['map', 8, 3, 11, null, 2, 1]
    ]
  }, o || {});

  const ROOMS = {
    domus: { name: 'Your Domus', w: 18, h: 14, t: T_ATRIUM, desc: 'The atrium first: the pool, the masks of your ancestors, and whoever has come to ask for something.' },
    curia: { name: 'Curia Hostilia', w: 18, h: 14, t: T_HALL, desc: 'Benches in tiers, the dais, and three hundred men who all believe they should be standing on it.' },
    basilica: { name: 'Basilica Aemilia', w: 18, h: 14, t: T_HALL, desc: 'The courts: money-changers on the right, advocates on the left, and everyone waiting for a verdict.' },
    vesta: { name: 'Temple of Vesta', w: 16, h: 12, t: T_TEMPLE, desc: 'A round room, no image of the goddess, and a fire that has not gone out in nine hundred years.' },
    capitolium: { name: 'The Capitolium', w: 18, h: 14, t: T_TEMPLE, desc: 'Three cellae under one roof: Jupiter, Juno and Minerva, and the smell of a thousand sacrifices.' },
    temple: { name: 'Temple of Mars', w: 16, h: 12, t: T_TEMPLE, desc: 'The god of war keeps his house outside the wall, so the army can reach it without entering the city.' },
    macellum: { name: 'The Macellum', w: 18, h: 14, t: T_MARKET, desc: 'Fish, grain, cloth, iron, and four hundred conversations about the price of everything.' },
    tavern: { name: 'A tavern in the Subura', w: 18, h: 14, t: T_TAVERN, desc: 'Wine, smoke, and men who will tell you anything for a cup.' },
    balnea: { name: 'Balneae Seniae', w: 18, h: 14, t: T_BATH, desc: 'The warm room, the hot room, and the cold plunge nobody takes.' },
    ludus: { name: 'The Ludus of Sestius', w: 16, h: 14, t: T_YARD, desc: 'Sand, a post to strike, and men whose whole career is a single afternoon.' },
    castra: { name: 'The Camp on the Campus', w: 18, h: 14, t: T_YARD, desc: 'The principia: standards, maps, pay chests, and officers arguing over them.' },
    portus: { name: 'Horrea at the Portus', w: 18, h: 14, t: T_WAREHOUSE, desc: 'Grain, rope, oil, and ledgers that disagree with the cargo.' },
    rostra: { name: 'The Rostra', w: 16, h: 12, t: T_HALL, desc: 'A platform, a rail hung with ships\u2019 beaks, and the whole crowd below you.' },
    colosseum: { name: 'The Wooden Amphitheatre', w: 20, h: 16, t: T_ARENA, desc: 'Sand raked between acts, a gate at each end, and timber seats going up and up until the top row is only a noise.' }
  };
  IMP.INTERIORS = ROOMS;          // note: IMP.ROOMS is the list of rooms you can build in the domus (data.js)
  IMP.room = id => {
    const R = ROOMS[id];
    if (!R) return null;
    if (!CACHE[id] && R.build) { CACHE[id] = R.build(); CACHE[id].desc = R.desc; }    // an outdoor region paints itself (wider.js)
    if (!CACHE[id]) {
      /* the size lives on the room, the furniture in the template — the plan needs both, or it builds nothing */
      const spec = Object.assign({ id, name: R.name, w: R.w, h: R.h }, R.t());
      CACHE[id] = roomPlan(spec);
      CACHE[id].desc = R.desc;
      CACHE[id].door = spec.door === undefined ? { x: spec.w >> 1, y: spec.h - 1 } : { x: spec.door, y: spec.h - 1 };
    }
    return CACHE[id];
  };
  /* the room furniture the templates share: benches and barrels are small enough to live here */
  F.bench2 = one(64, 30, (g) => {
    px(g, 2, 10, 60, 6, '#a58a5c'); px(g, 2, 10, 60, 1, '#c0a473');
    px(g, 6, 16, 5, 10, '#7a5c34'); px(g, 52, 16, 5, 10, '#7a5c34');
  });
  F.barrelf = one(32, 36, (g) => {
    px(g, 6, 6, 20, 28, '#7a5230'); px(g, 6, 6, 20, 2, '#9c6f42');
    px(g, 6, 14, 20, 4, '#4a3020'); px(g, 6, 24, 20, 4, '#4a3020');
    px(g, 10, 8, 4, 24, '#8c5f38');
  });
})();

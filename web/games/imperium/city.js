/* CITY — Rome from the height of a rooftop. The first painter drew every building as a front elevation filling its
   whole plot, so from above a house was a wall the size of a courtyard. Here a building is what you would see from a
   high window looking south: most of it is roof, red Roman tiles in rows with the round cover tiles running down the
   slope, and only the bottom of the plot is the front wall with its doors, shops and windows. The light comes from
   the upper left, so slopes facing it are bright and every building throws its shadow down and to the right.
   Roofs come in the shapes Rome actually built: plain gables, hipped roofs, the atrium house with its rain pool open
   to the sky, the flat terrace of an insula with pots and washing, a temple's long roof ending in its pediment, the
   domes of the baths, and the open yards of the camp and the gladiators' school. */
window.PIXCITY = (() => {
  'use strict';
  const { T, rng, hash, cv, ctx, px, mix, shade, pickr, chance, edge, column } = window.PIXTOOLS;
  const OV = 8;                                    // the roof overhangs its plot by this much at the back
  const SIDE = 3;                                  // and by this much at either side
  const FACADE_ROOF = 10;                          // the strip of roof the old façade painter puts above its wall

  /* how tall the front wall stands, in pixels; never more than a little over half the plot */
  const WALLT = { insulae: 64, shop: 44, tavern: 46, temple: 60, basilica: 56, villa: 46, warehouse: 50, barracks: 50, bath: 52, ludus: 46, hut: 34, tomb: 34, circus: 54, gate: 64 };
  const wallOf = b => Math.round(Math.min(WALLT[b.style] || 46, b.h * T * .58));

  const TERRA = ['#b4603c', '#a5552f', '#c16c44', '#98492a', '#ad5a36'];
  const THATCH = ['#a3844a', '#94763f', '#ad8e54', '#8a6c38'];

  /* ---------------- roof surfaces ---------------- */
  /* Roman tiling: flat tegulae with a round imbrex over every joint, running down the slope. `down` says which way
     the slope runs on the picture ('v' = up and down the screen, 'h' = across it). */
  function tiling(g, x, y, w, h, tones, light, down, r) {
    if (w <= 0 || h <= 0) return;
    const base = shade(pickr(r, tones), light);
    px(g, x, y, w, h, base);
    if (down === 'v') {
      for (let yy = y; yy < y + h; yy += 5) px(g, x, yy, w, 1, shade(base, -.1));                 // tegula courses
      for (let xx = x + 2; xx < x + w - 1; xx += 6) {
        const t = shade(pickr(r, tones), light + .04);
        px(g, xx, y, 2, h, t); px(g, xx, y, 1, h, shade(t, .16)); px(g, xx + 2, y, 1, h, shade(base, -.24));
        for (let yy = y + 2; yy < y + h; yy += 5) px(g, xx, yy, 3, 1, shade(t, -.12));            // the overlap of each imbrex
      }
    } else {
      for (let xx = x; xx < x + w; xx += 5) px(g, xx, y, 1, h, shade(base, -.1));
      for (let yy = y + 2; yy < y + h - 1; yy += 6) {
        const t = shade(pickr(r, tones), light + .04);
        px(g, x, yy, w, 2, t); px(g, x, yy, w, 1, shade(t, .16)); px(g, x, yy + 2, w, 1, shade(base, -.24));
        for (let xx = x + 2; xx < x + w; xx += 5) px(g, xx, yy, 1, 3, shade(t, -.12));
      }
    }
    for (let i = 0; i < w * h / 160; i++) {                                                       // lichen and the odd broken tile
      const lx = x + r() * w, ly = y + r() * h;
      px(g, lx, ly, 2, 1, r() < .7 ? 'rgba(96,120,64,.32)' : 'rgba(40,24,16,.45)');
    }
  }
  /* a soft gradient over a slope: darker towards the eaves, where the rain and the shadow are */
  function slopeShade(g, x, y, w, h, from, to) {
    const gr = g.createLinearGradient(0, y, 0, y + h);
    gr.addColorStop(0, from); gr.addColorStop(1, to);
    g.fillStyle = gr; g.fillRect(x, y, w, h);
  }
  const ridgeCap = (g, x, y, w, vertical) => {
    if (vertical) { px(g, x - 1, y, 4, w, '#c97a50'); px(g, x - 1, y, 1, w, '#e09a6a'); px(g, x + 2, y, 1, w, '#7a3a22'); for (let i = 0; i < w; i += 4) px(g, x - 1, y + i, 4, 1, '#9a4a2c'); }
    else { px(g, x, y - 1, w, 4, '#c97a50'); px(g, x, y - 1, w, 1, '#e09a6a'); px(g, x, y + 2, w, 1, '#7a3a22'); for (let i = 0; i < w; i += 4) px(g, x + i, y - 1, 1, 4, '#9a4a2c'); }
  };
  const eaves = (g, x, y, w) => {                     // the drip edge, with a row of little antefixes along it
    px(g, x, y - 2, w, 2, '#6e3420');
    for (let i = 2; i < w - 2; i += 6) { px(g, x + i, y - 4, 3, 3, '#d8c49a'); px(g, x + i, y - 4, 3, 1, '#f0e2bc'); }
  };

  /* each roof gets the rectangle (0,0)-(w,h) of its own little canvas */
  const ROOFS = {
    gable(g, w, h, r, tones) {
      const ry = Math.round(h * .38);
      tiling(g, 0, 0, w, ry, tones, .14, 'v', r);                                   // the far slope, in the light
      tiling(g, 0, ry, w, h - ry, tones, -.02, 'v', r);                             // the near slope
      slopeShade(g, 0, ry, w, h - ry, 'rgba(255,230,190,.10)', 'rgba(40,16,8,.22)');
      px(g, 0, 0, 2, h, 'rgba(255,240,210,.18)'); px(g, w - 2, 0, 2, h, 'rgba(30,12,6,.3)');
      ridgeCap(g, 0, ry, w);
      eaves(g, 0, h, w);
    },
    hip(g, w, h, r, tones) {
      const ry = Math.round(h * .42), hw = Math.min(Math.round(w * .32), Math.round(h * .55));
      tiling(g, 0, 0, w, ry, tones, .14, 'v', r);
      tiling(g, 0, ry, w, h - ry, tones, -.02, 'v', r);
      slopeShade(g, 0, ry, w, h - ry, 'rgba(255,230,190,.08)', 'rgba(40,16,8,.22)');
      /* the two hips at the ends: triangles that catch the light on the left and lose it on the right */
      for (let y = 0; y < h; y++) {
        const k = y < ry ? y / ry : (h - y) / (h - ry), iw = Math.round(hw * k);
        if (iw <= 0) continue;
        px(g, 0, y, iw, 1, shade(tones[0], .22)); px(g, w - iw, y, iw, 1, shade(tones[3], -.18));
        if (y % 5 === 0) { px(g, 0, y, iw, 1, shade(tones[0], .08)); px(g, w - iw, y, iw, 1, shade(tones[3], -.3)); }
        px(g, iw - 1, y, 2, 1, '#d48a5e'); px(g, w - iw - 1, y, 2, 1, '#7a3a22');            // the hip ridges
      }
      ridgeCap(g, hw, ry, w - hw * 2);
      eaves(g, 0, h, w);
    },
    /* the atrium house: a hipped roof sloping inwards round a square open to the sky, and the rain pool under it */
    atrium(g, w, h, r, tones) {
      ROOFS.hip(g, w, h, r, tones);
      const ow = Math.round(w * .3), oh = Math.round(h * .32), ox = Math.round((w - ow) / 2), oy = Math.round(h * .3);
      px(g, ox - 3, oy - 3, ow + 6, oh + 6, shade(tones[1], -.1));
      tiling(g, ox - 3, oy - 3, ow + 6, 3, tones, -.15, 'h', r); tiling(g, ox - 3, oy - 3, 3, oh + 6, tones, .1, 'v', r);
      px(g, ox, oy, ow, oh, '#cfc6b1');                                                         // the atrium floor
      for (let i = 0; i < ow; i += 4) px(g, ox + i, oy, 1, oh, 'rgba(120,100,70,.18)');
      const pw = Math.max(6, ow - 10), ph = Math.max(4, oh - 10), pxx = ox + ((ow - pw) >> 1), pyy = oy + ((oh - ph) >> 1) + 1;
      px(g, pxx - 2, pyy - 2, pw + 4, ph + 4, '#e8e0cc');                                      // the impluvium, rimmed in marble
      px(g, pxx, pyy, pw, ph, '#3d7186'); px(g, pxx, pyy, pw, 1, '#2a5466'); px(g, pxx + 1, pyy + 1, Math.max(2, pw >> 2), 1, '#9cd0dc');
      px(g, ox, oy, ow, 3, 'rgba(20,10,6,.35)'); px(g, ox, oy, 3, oh, 'rgba(20,10,6,.25)');     // the inner eaves' shadow
    },
    /* the flat roof of an insula: a parapet, pots, a pergola, a cistern and the washing */
    terrace(g, w, h, r) {
      px(g, 0, 0, w, h, '#b7aa8e');
      for (let y = 0; y < h; y += 8) for (let x = (y / 8 % 2) * 6; x < w; x += 12) px(g, x, y, 11, 7, chance(r, .5) ? '#bdb093' : '#aea088');
      for (let i = 0; i < w * h / 90; i++) px(g, r() * w, r() * h, 2, 1, 'rgba(90,76,56,.22)');
      px(g, 0, 0, w, 3, '#d4c8ab'); px(g, 0, 0, 3, h, '#d0c4a6'); px(g, w - 3, 0, 3, h, '#9a8e74'); px(g, 0, h - 3, w, 3, '#8e8268');
      if (w > 60) {                                                                             // a pergola with a vine over it
        const gx = 8 + r() * (w - 48), gy = 6 + r() * Math.max(2, h - 30);
        for (let i = 0; i < 5; i++) px(g, gx + i * 8, gy, 2, 18, '#7a5a34');
        px(g, gx - 2, gy, 38, 2, '#8a6a3c'); px(g, gx - 2, gy + 16, 38, 2, '#6a4a28');
        for (let i = 0; i < 26; i++) px(g, gx + r() * 34, gy + r() * 16, 3, 2, pickr(r, ['#4f7a34', '#5f8a3c', '#3f6a2a']));
      }
      for (let i = 0; i < 3 + (w / 40 | 0); i++) {                                              // pots
        const x = 5 + r() * (w - 14), y = 5 + r() * (h - 14);
        px(g, x, y + 3, 6, 4, '#a5552f'); px(g, x, y + 3, 6, 1, '#c97a50');
        px(g, x - 1, y, 8, 4, pickr(r, ['#4f7a34', '#6a8a3c', '#3f6a2a'])); px(g, x + 1, y - 1, 3, 2, '#7aa04a');
      }
      const cx = w - 18 - r() * 10, cy = 6;                                                     // a cistern
      px(g, cx, cy, 12, 10, '#8f8574'); px(g, cx, cy, 12, 2, '#b3a892'); px(g, cx + 2, cy + 3, 8, 4, '#3d5a66');
      if (h > 30) {                                                                             // and the washing
        const ly = h - 14 - r() * 8; px(g, 6, ly, w - 12, 1, '#6b5a40');
        for (let x = 10; x < w - 14; x += 7 + (r() * 4 | 0)) px(g, x, ly + 1, 4, 5 + (r() * 3 | 0), pickr(r, ['#e8e2d0', '#c9b48a', '#8f3b34', '#3f5f7a', '#d8cfa8']));
      }
    },
    /* a temple: the long roof runs away from you, so the ridge goes up the middle of the picture and the pediment
       faces the street at the front */
    temple(g, w, h, r) {
      const mid = w >> 1, tones = ['#c46e44', '#b4603c', '#a5552f', '#c97a50'];
      tiling(g, 0, 0, mid, h, tones, .16, 'h', r);
      tiling(g, mid, 0, w - mid, h, tones, -.12, 'h', r);
      ridgeCap(g, mid - 1, 0, h, true);
      const ph = Math.min(26, Math.round(h * .45));                                             // the pediment, seen at a slant
      g.save(); g.beginPath(); g.moveTo(-1, h); g.lineTo(mid, h - ph); g.lineTo(w + 1, h); g.closePath();
      g.fillStyle = '#e4dbc2'; g.fill(); g.clip();
      for (let i = 0; i < w / 6; i++) { const x = 6 + r() * (w - 12), t = pickr(r, ['#cdbf9c', '#c2b28c', '#d8caa6']); px(g, x, h - 4 - r() * (ph - 8), 3, 5, t); }   // the relief
      px(g, 0, h - 3, w, 3, '#c9bd9c');
      g.restore();
      g.strokeStyle = '#f6efd9'; g.lineWidth = 2; g.beginPath(); g.moveTo(0, h); g.lineTo(mid, h - ph); g.lineTo(w, h); g.stroke();
      px(g, mid - 3, h - ph - 6, 6, 6, '#d9b64a'); px(g, mid - 2, h - ph - 6, 4, 2, '#f2d88a');  // a gilt acroterion
      px(g, 0, h - 2, 6, 2, '#d9b64a'); px(g, w - 6, h - 2, 6, 2, '#d9b64a');
    },
    /* the baths: a hipped roof with a dome on it, ribbed, lit from the upper left, with an oculus at the top */
    bath(g, w, h, r, tones) {
      ROOFS.hip(g, w, h, r, tones);
      const R = Math.min(w, h * 1.4) * .3, cx = w * .5, cy = h * .46;
      const img = g.getImageData(0, 0, w, h), d = img.data;
      for (let y = Math.max(0, cy - R | 0); y < Math.min(h, cy + R + 1); y++) for (let x = Math.max(0, cx - R | 0); x < Math.min(w, cx + R + 1); x++) {
        const dx = (x + .5 - cx) / R, dy = (y + .5 - cy) / (R * .82), q = dx * dx + dy * dy; if (q > 1) continue;
        const nz = Math.sqrt(1 - q), l = Math.max(0, (-dx * .55 - dy * .55 + nz * .62));                 // light from the upper left
        const rib = Math.abs(Math.sin(Math.atan2(dy, dx) * 6)) < .12 ? -.12 : 0;
        const v = Math.min(1, .48 + l * .5 + rib), i = (y * w + x) * 4;
        d[i] = 205 * v + 30; d[i + 1] = 196 * v + 26; d[i + 2] = 170 * v + 20; d[i + 3] = 255;
      }
      g.putImageData(img, 0, 0);
      px(g, cx - 3, cy - R * .82 + 2, 6, 4, '#2a2420'); px(g, cx - 3, cy - R * .82 + 2, 6, 1, '#e8e0cc');
    },
    /* the camp and the gladiators' school: a covered walk on all four sides and an open yard in the middle */
    yard(g, w, h, r, tones, b) {
      const pw = 12;
      px(g, 0, 0, w, h, '#8f8268');
      tiling(g, 0, 0, w, pw, tones, .12, 'v', r);
      tiling(g, 0, pw, pw, h - pw, tones, .2, 'h', r);
      tiling(g, w - pw, pw, pw, h - pw, tones, -.15, 'h', r);
      const yx = pw, yy = pw, yw = w - pw * 2, yh = h - pw - 2;
      const sand = b.style === 'ludus';
      px(g, yx, yy, yw, yh, sand ? '#d3b681' : '#8a7654');
      for (let i = 0; i < yw * yh / 12; i++) px(g, yx + r() * yw, yy + r() * yh, 1, 1, sand ? pickr(r, ['#dec48f', '#c8a971']) : pickr(r, ['#7a6649', '#957f5a']));
      px(g, yx, yy, yw, 3, 'rgba(20,10,6,.35)'); px(g, yx, yy, 3, yh, 'rgba(20,10,6,.25)');
      if (sand) {                                                                               // training posts and a rack of wooden swords
        for (let i = 0; i < Math.max(2, yw / 24 | 0); i++) { const x = yx + 10 + i * 24, y = yy + 8 + (i % 2) * 8; px(g, x, y, 3, 10, '#6b4a2c'); px(g, x, y, 3, 1, '#8a6a3c'); px(g, x - 1, y + 10, 5, 2, 'rgba(0,0,0,.25)'); }
        px(g, yx + yw - 18, yy + 4, 12, 2, '#6b4a2c'); for (let i = 0; i < 4; i++) px(g, yx + yw - 16 + i * 3, yy + 1, 1, 6, '#a07a4a');
      } else {                                                                                  // tents in rows and the standards
        for (let x = yx + 6; x < yx + yw - 12; x += 16) for (let y = yy + 6; y < yy + yh - 10; y += 14) {
          px(g, x, y, 12, 8, '#cfc2a0'); px(g, x, y, 6, 8, '#e2d6b6'); px(g, x + 6, y, 6, 8, '#b5a887'); px(g, x, y + 8, 12, 1, 'rgba(0,0,0,.3)');
        }
        px(g, yx + yw / 2, yy + 2, 2, 12, '#6b5a3a'); px(g, yx + yw / 2 - 3, yy + 2, 8, 5, '#c04a34'); px(g, yx + yw / 2 - 1, yy, 4, 2, '#d9b64a');
      }
    },
    flat(g, w, h, r) {
      px(g, 0, 0, w, h, '#a89b80');
      for (let y = 0; y < h; y += 6) for (let x = (y / 6 % 2) * 8; x < w; x += 16) px(g, x, y, 15, 5, chance(r, .5) ? '#b0a388' : '#9f9278');
      px(g, 0, 0, w, 3, '#c6b99c'); px(g, 0, h - 3, w, 3, '#7d7260');
      for (let x = 2; x < w - 4; x += 10) { px(g, x, -4, 5, 5, '#b3a488'); px(g, x, -4, 5, 1, '#d0c2a4'); }                 // crenellations
    },
    tomb(g, w, h, r) {
      px(g, 0, 0, w, h, '#d5cbb0'); px(g, 0, 0, w, 2, '#efe6cb'); px(g, 0, h - 3, w, 3, '#a89a78');
      const R = Math.min(w, h) * .32, cx = w / 2, cy = h / 2;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const q = ((x - cx) / R) ** 2 + ((y - cy) / (R * .8)) ** 2; if (q < 1) px(g, x, y, 1, 1, q < .5 && x < cx ? '#e6ddc4' : q < .85 ? '#cfc4a8' : '#b3a688'); }
      for (let i = 0; i < 6; i++) px(g, cx - R + r() * R * 2, cy - R * .6 + r() * R, 3, 2, '#5f8a3c');                       // the cypress shoots on the mound
    },
    thatch(g, w, h, r) {
      const ry = Math.round(h * .4);
      px(g, 0, 0, w, h, '#9a7a44');
      for (let i = 0; i < w * h / 6; i++) { const x = r() * w, y = r() * h; px(g, x, y, 1, 3, pickr(r, THATCH)); }
      px(g, 0, 0, w, ry, 'rgba(255,236,190,.14)'); slopeShade(g, 0, ry, w, h - ry, 'rgba(0,0,0,0)', 'rgba(40,24,8,.28)');
      px(g, 0, ry - 1, w, 3, '#7a5c30');
      px(g, 0, h - 2, w, 2, '#5e4422');
    },
    stands(g, w, h, r) {                              // the Circus: tiers of seats seen from above
      for (let y = 0; y < h; y += 5) { px(g, 0, y, w, 3, (y / 5) % 2 ? '#c6bb9c' : '#b5a98a'); px(g, 0, y + 3, w, 2, '#7d7260'); }
      for (let i = 0; i < w * h / 30; i++) px(g, r() * w, r() * h, 1, 1, pickr(r, ['#8f3b34', '#3f5f7a', '#e8e2d0', '#c9a24a', '#6a8a3c']));   // the crowd
      px(g, 0, 0, w, 2, '#e0d6ba');
    }
  };
  const roofKind = (b, r, wh) => {
    const s = b.style, rh = b.h * T - wh + OV;
    if (s === 'temple') return 'temple';
    if (s === 'bath') return 'bath';
    if (s === 'barracks' || s === 'ludus') return b.w >= 6 && rh >= 56 ? 'yard' : 'flat';
    if (s === 'hut') return 'thatch';
    if (s === 'tomb') return 'tomb';
    if (s === 'circus') return 'stands';
    if (s === 'gate') return 'flat';
    if (s === 'villa' || b.id === 'domus') return b.w >= 5 && rh >= 52 ? 'atrium' : 'hip';
    if (s === 'insulae') return r() < .38 ? 'terrace' : r() < .5 ? 'hip' : 'gable';
    if (s === 'basilica') return 'hip';
    return r() < .3 ? 'hip' : 'gable';
  };

  /* ---------------- the front wall ---------------- */
  /* The old façade painter already knows how to draw a Roman front (doors, shutters, shops, awnings, columns); it is
     asked for a wall exactly as tall as this one and its own roof strip is left off. Temples are drawn here, because
     a portico of columns needs its full height to read. */
  function templeFront(g, w, wh, r) {
    px(g, 0, 0, w, wh, '#4e4436');                                                             // the shadowed cella behind
    px(g, w / 2 - 9, wh - 30, 18, 18, '#6b4a2c'); px(g, w / 2 - 9, wh - 30, 18, 1, '#a07a4a');
    for (let i = 0; i < 4; i++) px(g, 0, wh - 12 + i * 3, w, 3, i % 2 ? '#c6bb9c' : '#ded4b8');  // the podium steps
    px(g, w * .25, wh - 12, w * .5, 12, 'rgba(255,248,226,.18)');
    const n = Math.max(4, Math.round(w / 16)), cw = 6;
    for (let i = 0; i < n; i++) { const x = Math.round(3 + (w - 6 - cw) * (i / (n - 1))); column(g, x, 4, cw, wh - 16, '#e6ddc6', true); px(g, x + cw, 6, 3, wh - 18, 'rgba(0,0,0,.22)'); }
    px(g, 0, 0, w, 5, '#e6dcc2'); px(g, 0, 0, w, 1, '#f6efdb'); px(g, 0, 4, w, 1, '#a89a78');
  }
  function wall(b, w, wh) {
    const c = cv(w, wh), g = ctx(c);
    if (b.style === 'temple') { templeFront(g, w, wh, rng(hash('tf' + b.x + ',' + b.y))); return c; }
    const f = window.PIXWORLD.facade(Object.assign({}, b, { h: wh / T }), b.style);
    g.drawImage(f, 2, FACADE_ROOF, w, wh, 0, 0, w, wh);
    return c;
  }

  /* ---------------- one building ---------------- */
  const cache = {};
  function building(b) {
    const key = (b.id || '') + b.style + b.x + ',' + b.y + 'x' + b.w + ',' + b.h;
    if (cache[key]) return cache[key];
    const r = rng(hash('city' + key));
    const w = b.w * T, h = b.h * T, wh = wallOf(b), rh = h - wh + OV;
    const W2 = w + SIDE * 2, H2 = rh + wh + 2;
    const c = cv(W2, H2), g = ctx(c);
    const tones = b.id === 'domus' ? ['#c4703f', '#b8653a', '#cc7a48', '#a85a33'] : TERRA;
    /* the wall first, then the roof over it, then the shadow of the eaves on the wall */
    g.drawImage(wall(b, w, wh), SIDE, rh);
    const kind = roofKind(b, r, wh);
    const rc = cv(w + SIDE * 2, rh), rg = ctx(rc);
    ROOFS[kind](rg, w + SIDE * 2, rh, r, tones, b);
    g.drawImage(rc, 0, 0);
    if (kind !== 'temple') { const sh = g.createLinearGradient(0, rh, 0, rh + 9); sh.addColorStop(0, 'rgba(18,10,6,.42)'); sh.addColorStop(1, 'rgba(18,10,6,0)'); g.fillStyle = sh; g.fillRect(SIDE, rh, w, 9); }
    px(g, SIDE, rh + wh - 2, w, 2, 'rgba(20,12,8,.35)');                                      // the foot of the wall
    const out = { c: edge(c, 'rgba(28,18,14,.8)'), ox: SIDE, oy: OV, wall: wh, kind, roofH: rh };
    cache[key] = out;
    return out;
  }

  /* The shadow a building throws, down and to the right, onto whatever is there. Drawn before any building, so a tall
     house darkens the street and the lower roofs beside it but never itself. */
  function shadow(g, b) {
    const x0 = b.x * T, y0 = b.y * T, w = b.w * T, h = b.h * T, d = Math.round(wallOf(b) * .62) + 8;
    g.moveTo(x0 + w + SIDE, y0 - OV + 4);
    g.lineTo(x0 + w + SIDE + d, y0 - OV + 4 + d * .55);
    g.lineTo(x0 + w + SIDE + d, y0 + h + d * .3);
    g.lineTo(x0 + d * .7, y0 + h + d * .3);
    g.lineTo(x0, y0 + h);
    g.lineTo(x0 + w, y0 + h);
    g.closePath();
  }
  /* one path for all of them, filled once, so two shadows that overlap are no darker than one */
  function shadows(g, list) {
    g.save(); g.fillStyle = 'rgba(30,20,44,.36)'; g.beginPath(); list.forEach(b => shadow(g, b)); g.fill('nonzero'); g.restore();
  }

  return { building, shadows, wallOf, OV, SIDE };
})();

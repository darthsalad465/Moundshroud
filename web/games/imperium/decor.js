/* DECOR — the difference between a map and a place.

   world.js paints the bones of the city: stone, street, facade, prop. This file goes over the top of that once, at
   load, and puts in the things that make a street read as inhabited at a glance — awnings over shopfronts with the
   stripes sagging in the middle, shutters half-closed against the afternoon, iron lanterns on brackets, election
   slogans painted in red on the plaster, the washing strung between two insulae, a vine that has been growing since
   the last repair, and the crack somebody has been meaning to fill since the year of Marius.

   It also adds things that move: smoke out of the kitchen chimneys, cloth in the wind, water in the fountains,
   pigeons on the paving, torches at the doors. They are real animated props in the same list the game already
   walks, so they sort with the people and you can stand behind them. */
(window.DECOR = (() => {
  'use strict';
  const T = 32;

  /* a small deterministic random, so the city looks the same every time you load it */
  function rng(seed) {
    let s = seed >>> 0 || 1;
    return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
  }
  const px = (g, x, y, w, h, c) => { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
  const shade = (hex, k) => {
    const n = parseInt(hex.slice(1), 16);
    let r = (n >> 16) & 255, gg = (n >> 8) & 255, b = n & 255;
    r = Math.max(0, Math.min(255, Math.round(r * k))); gg = Math.max(0, Math.min(255, Math.round(gg * k))); b = Math.max(0, Math.min(255, Math.round(b * k)));
    return '#' + ((1 << 24) + (r << 16) + (gg << 8) + b).toString(16).slice(1);
  };
  const cv = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };

  /* ============================ the vocabulary ============================ */
  /* a cloth awning over a shop: the stripes sag, and the scalloped edge is what the eye actually reads */
  function awning(g, x, y, w, c1, c2) {
    const h = 7;
    for (let i = 0; i < w; i++) {
      const sag = Math.round(Math.sin((i / w) * Math.PI) * 1.4);
      const col = (Math.floor(i / 4) % 2) ? c1 : c2;
      px(g, x + i, y + sag, 1, h - sag, col);
      px(g, x + i, y + sag + h - sag - 1, 1, 1, shade(col, .8));
    }
    for (let i = 0; i < w; i += 2) px(g, x + i, y + h, 1, 2, (Math.floor(i / 2) % 2) ? shade(c1, .92) : shade(c2, .92));
    px(g, x, y - 1, w, 1, 'rgba(20,14,10,.5)');                     // the shadow of the pole
  }

  /* painted slogans: the actual medium of Roman politics, and the reason no wall in Pompeii is clean */
  function programmata(g, x, y, w, r) {
    const red = '#8d2f27', black = '#31261d';
    const lines = 1 + Math.floor(r() * 3);
    for (let i = 0; i < lines; i++) {
      const ly = y + i * 3;
      let lx = x;
      const len = 6 + Math.floor(r() * (w - 8));
      while (lx < x + len) {
        const ww = 1 + Math.floor(r() * 3);
        px(g, lx, ly, ww, 1, r() < .5 ? red : black);
        lx += ww + 1;
        if (r() < .12) lx += 2;
      }
    }
  }

  /* the crack somebody has been meaning to fill since the year of Marius */
  function crack(g, x, y, h, r) {
    let cx = x;
    for (let i = 0; i < h; i++) {
      px(g, cx, y + i, 1, 1, 'rgba(28,20,14,.5)');
      if (r() < .3) cx += r() < .5 ? -1 : 1;
      if (r() < .1) px(g, cx + 1, y + i, 1, 1, 'rgba(28,20,14,.28)');
    }
  }

  /* a vine on a plaster wall: the leaves cluster, the stem does not */
  function vine(g, x, y, h, r) {
    let cx = x;
    for (let i = 0; i < h; i++) {
      px(g, cx, y + i, 1, 1, '#3d5530');
      if (r() < .45) {
        const s = r() < .5 ? -1 : 1;
        px(g, cx + s, y + i, 1, 1, r() < .5 ? '#4c6a38' : '#5d7d43');
        if (r() < .3) px(g, cx + s * 2, y + i - 1, 1, 2, '#456035');
      }
      if (r() < .2) cx += r() < .5 ? -1 : 1;
      if (cx < x - 4) cx = x - 4; if (cx > x + 4) cx = x + 4;
    }
  }

  /* an iron lantern on a bracket: the thing that makes a night street a street rather than a corridor */
  function lantern(g, x, y) {
    px(g, x, y, 6, 1, '#2e2a26');
    px(g, x + 5, y, 1, 4, '#2e2a26');
    px(g, x + 3, y + 4, 6, 1, '#2e2a26');
    px(g, x + 3, y + 4, 5, 5, 'rgba(240,200,120,.30)');
    px(g, x + 4, y + 5, 3, 4, '#f2cd7c');
    px(g, x + 4, y + 5, 3, 1, '#fff2c4');
    px(g, x + 3, y + 9, 5, 1, '#2e2a26');
  }

  /* a mosaic threshold: what you walk over on the way into any house worth the name */
  function threshold(g, x, y, w, r) {
    px(g, x, y, w, 10, '#cfc3a6');
    for (let i = 0; i < w; i += 3) for (let j = 0; j < 10; j += 3) {
      const c = r() < .5 ? '#b8a98b' : '#e2d7ba';
      px(g, x + i, y + j, 2, 2, c);
    }
    px(g, x, y, w, 1, '#8d8067'); px(g, x, y + 9, w, 1, '#8d8067');
  }

  /* ============================ animated pieces ============================ */
  /* smoke: three frames, drifting and thinning. Anchored to the top of a chimney. */
  function smokeFrames(col) {
    const frames = [];
    for (let f = 0; f < 3; f++) {
      const c = cv(26, 34), g = c.getContext('2d');
      for (let i = 0; i < 9; i++) {
        const t = i / 9;
        const yy = 32 - t * 30, xx = 13 + Math.sin((t + f / 3) * 3.2) * (2 + t * 5);
        const s = 2 + t * 4;
        g.globalAlpha = (1 - t) * .22;
        g.fillStyle = col || '#b9b4ab';
        g.beginPath(); g.arc(xx, yy, s, 0, 6.3); g.fill();
      }
      frames.push(c);
    }
    return { frames, w: 26, h: 34, fps: 5 };
  }

  /* cloth in the wind: three frames of a hanging banner */
  function bannerFrames(c1, c2) {
    const frames = [];
    for (let f = 0; f < 3; f++) {
      const c = cv(12, 30), g = c.getContext('2d');
      px(g, 0, 0, 1, 30, '#5a4a3a');
      px(g, 1, 2, 9, 20, c1);
      for (let i = 0; i < 20; i++) {
        const off = Math.round(Math.sin((i / 20) * 3.4 + f * 2.1) * 1.6);
        px(g, 1, 2 + i, 9, 1, 'rgba(0,0,0,0)');
        px(g, 1 + Math.max(0, off), 2 + i, 9 - Math.abs(off), 1, i > 16 ? c2 : shade(c1, 1 + off * .03));
      }
      px(g, 2, 22, 8, 2, c2);
      frames.push(c);
    }
    return { frames, w: 12, h: 30, fps: 4 };
  }

  /* water: a fountain jet, four frames of falling */
  function waterFrames() {
    const frames = [];
    for (let f = 0; f < 4; f++) {
      const c = cv(28, 22), g = c.getContext('2d');
      for (let i = 0; i < 26; i++) {
        const t = ((i / 26) + f / 4) % 1;
        const x = 14 + Math.sin(t * 6.3 * 2) * 8 * t;
        const y = 2 + t * 16;
        g.globalAlpha = .7 - t * .35;
        g.fillStyle = i % 3 ? '#cfe6ee' : '#ffffff';
        g.fillRect(Math.round(x), Math.round(y), 1, 2);
      }
      g.globalAlpha = .5;
      g.strokeStyle = '#cfe6ee';
      g.beginPath(); g.ellipse(14, 19, 9, 3, 0, 0, 6.3); g.stroke();
      frames.push(c);
    }
    return { frames, w: 28, h: 22, fps: 8 };
  }

  /* pigeons: two frames, because a pigeon on a square that does not move is a pigeon that is dead */
  function birdFrames(col) {
    const frames = [];
    for (let f = 0; f < 2; f++) {
      const c = cv(7, 7), g = c.getContext('2d');
      px(g, 2, 3, 3, 2, col);
      px(g, 1, 2, 2, 2, shade(col, 1.15));
      px(g, 5, 2, 1, 1, '#c8a24a');
      if (f) px(g, 0, 1, 2, 1, shade(col, .85)); else px(g, 3, 1, 2, 1, shade(col, .85));
      frames.push(c);
    }
    return { frames, w: 7, h: 7, fps: 3 };
  }

  /* laundry on a line: three frames, and the whole street feels lived in */
  function laundryFrames(r) {
    const frames = [];
    const cols = ['#cfc0a0', '#a8b4bd', '#c08a6a', '#e0d6bc', '#8f9a78'];
    const n = 4;
    const shirts = [];
    for (let i = 0; i < n; i++) shirts.push({ c: cols[Math.floor(r() * cols.length)], w: 4 + Math.floor(r() * 4), h: 8 + Math.floor(r() * 5) });
    for (let f = 0; f < 3; f++) {
      const c = cv(30, 18), g = c.getContext('2d');
      px(g, 0, 1, 30, 1, 'rgba(40,32,24,.55)');
      let x = 2;
      shirts.forEach((s, i) => {
        const sway = Math.round(Math.sin(f * 2 + i) * .8);
        px(g, x + sway, 2, s.w, s.h, s.c);
        px(g, x + sway, 2, s.w, 1, shade(s.c, .82));
        px(g, x + sway, 2 + s.h, s.w, 1, shade(s.c, .7));
        x += s.w + 2;
      });
      frames.push(c);
    }
    return { frames, w: 30, h: 18, fps: 2 };
  }

  /* ============================ dressing the city ============================ */
  function dress(art, L) {
    const g = art.base.getContext('2d');
    const r = rng(77213);
    const anim = art.anim || (art.anim = []);
    const lights = art.lights || (art.lights = []);
    const add = (frameset, x, y, y0) => anim.push({ art: frameset, x, y, y0: y0 == null ? y : y0 });

    /* ---- ground detail, before the buildings, so it sits under the walls ---- */
    for (let y = 0; y < L.tile.length; y++) {
      for (let x = 0; x < L.tile[y].length; x++) {
        const t = L.tile[y][x][0];
        const X = x * T, Y = y * T;
        if (t === 'cobble' || t === 'cobble2') {
          /* wear in the middle of the street, and a drain every so often */
          if (r() < .06) px(g, X + 4, Y + 6, 24, 20, 'rgba(255,250,235,.045)');
          if (r() < .035) { px(g, X + 12, Y + 10, 8, 8, '#4a453d'); px(g, X + 13, Y + 11, 6, 6, '#2b2721'); for (let i = 0; i < 3; i++) px(g, X + 13, Y + 12 + i * 2, 6, 1, '#3d382f'); }
          if (r() < .05) { px(g, X + 2 + r() * 24, Y + 4 + r() * 24, 2, 1, '#4e6a3a'); px(g, X + 3 + r() * 22, Y + 4 + r() * 24, 1, 1, '#5e7a46'); }
        } else if (t === 'plaza' || t === 'marble') {
          if (r() < .05) px(g, X, Y + 31, 32, 1, 'rgba(40,32,24,.16)');
          if (r() < .03) { px(g, X + 8, Y + 14, 16, 1, 'rgba(60,50,38,.14)'); px(g, X + 8, Y + 17, 10, 1, 'rgba(60,50,38,.1)'); }
        } else if (t === 'grass' || t === 'garden') {
          if (r() < .2) { px(g, X + r() * 30, Y + r() * 30, 1, 2, '#557a3a'); }
          if (r() < .06) { px(g, X + r() * 28, Y + r() * 28, 2, 2, r() < .5 ? '#c8b45a' : '#b46a72'); }
        }
        /* the chalk games of children, the dice of adults, the marks of both */
        if ((t === 'cobble' || t === 'plaza') && r() < .006) {
          for (let i = 0; i < 7; i++) px(g, X + 6 + i * 2, Y + 18 + (i % 2), 2, 1, 'rgba(238,232,210,.35)');
        }
      }
    }

    /* ---- the buildings ---- */
    L.buildings.forEach(b => {
      const x0 = b.x * T, w = b.w * T, h0 = b.h * T;
      /* Seen from a rooftop most of the plot is roof, and the front wall starts at b.wy (set by the painter). Every
         weathering mark and every line of washing belongs on that wall, so the wall is what this pass calls the
         building; the roof is left alone except for its chimney. */
      const roofed = b.wy != null, y0 = roofed ? b.wy : b.y * T, h = roofed ? b.y * T + h0 - b.wy : h0;
      const top = roofed ? b.wy - 14 : y0 - 14;                // where the eaves hang over the wall
      const doorX = x0 + ((b.w - 1) >> 1) * T + 8;
      const doorY = y0 + h - T;
      const shops = !!b.loc;

      /* First, separation. The facades and the paving are drawn in the same family of greys, and at a glance that
         makes a wall of insulae look like more street. A warm wash over the wall, a hard line at its foot and a
         contact shadow underneath is all it takes for the eye to read solid and void. */
      g.save();
      g.fillStyle = 'rgba(126,88,48,.10)';
      g.fillRect(x0, y0 - 2, w, h + 2);
      g.fillStyle = 'rgba(26,17,10,.28)';
      g.fillRect(x0, y0 + h - 2, w, 2);
      const sh = g.createLinearGradient(0, y0 + h, 0, y0 + h + 10);
      sh.addColorStop(0, 'rgba(18,12,7,.26)');
      sh.addColorStop(1, 'rgba(18,12,7,0)');
      g.fillStyle = sh;
      g.fillRect(x0, y0 + h, w, 10);
      g.restore();

      /* roof: ridge tiles, a chimney, and the odd dormer — the skyline is half of what makes a city look drawn. The
         new roofs bring their own ridge, so on those only the chimney is added, standing on the near slope. */
      if (roofed) {
        if (b.h > 2 && /gable|hip|atrium/.test(b.roof || '') && r() < .6) {
          const cx = x0 + 12 + Math.floor(r() * Math.max(8, w - 40)), cy = b.y * T + Math.round((b.wy - b.y * T) * .55);
          px(g, cx + 6, cy + 6, 6, 4, 'rgba(28,20,40,.3)');
          px(g, cx, cy - 6, 7, 12, '#8a5236'); px(g, cx, cy - 7, 8, 2, '#5e3a26'); px(g, cx + 1, cy - 6, 5, 2, '#3a2418'); px(g, cx, cy - 6, 2, 12, '#a86a48');
          add(smokeFrames(r() < .5 ? '#b9b4ab' : '#cbc2ae'), cx - 9, cy - 37, cy - 37);
        }
      } else if (b.h > 1 && r() < .8) {
        px(g, x0 + 2, top + 2, w - 4, 2, 'rgba(60,30,20,.25)');
        const ridge = '#a4583a';
        for (let i = 2; i < w - 4; i += 4) px(g, x0 + i, top + 1, 2, 2, shade(ridge, .9 + r() * .2));
        if (r() < .6) {
          /* a chimney on the roof, and the kitchen smoke that goes with it: the one thing a flat painted city cannot
             have without somebody drawing it */
          const cx = x0 + 12 + Math.floor(r() * Math.max(8, w - 40));
          px(g, cx, top - 3, 7, 10, '#8a5236'); px(g, cx, top - 4, 8, 2, '#5e3a26');
          px(g, cx + 1, top - 3, 5, 2, '#3a2418');
          px(g, cx + 1, top + 1, 1, 5, 'rgba(0,0,0,.18)');
          add(smokeFrames(r() < .5 ? '#b9b4ab' : '#cbc2ae'), cx - 9, top - 34, top - 34);
        }
      }

      /* The wall itself. The facade art already has its own windows and doors, so nothing here may add a second set:
         this pass is weathering, not architecture. */
      /* every mark is kept inside the wall, which on a rooftop view can be as little as a tile high */
      if (r() < .45 && h > 40) crack(g, x0 + 8 + r() * (w - 20), y0 + 10 + r() * Math.max(1, h - 44), Math.min(12 + r() * 26, h - 24), r);
      if (r() < .3) { px(g, x0 + r() * w * .6, y0 + 8, 10 + r() * 14, Math.min(8, h - 16), 'rgba(60,54,40,.1)'); }
      if (r() < .3 && h > 36) vine(g, x0 + 6 + r() * (w - 16), y0 + 8, Math.min(18 + r() * 22, h - 14), r);
      if (r() < .38 && h >= 44) programmata(g, x0 + 6, y0 + h - 34 - r() * Math.min(10, h - 44), Math.min(w - 12, 40), r);

      if (shops) {
        /* a shopfront: awning over the door, a counter, a lantern, and a board with what is sold */
        awning(g, doorX - 14, doorY - 14, 36, r() < .5 ? '#b2443a' : '#3f6a72', '#e3d6b4');
        threshold(g, doorX - 10, doorY + 6, 28, r);
        lantern(g, doorX + 12, doorY - 16);
        lights.push({ x: (doorX + 14) / T, y: (doorY - 12) / T });
        if (r() < .5) {                                                   // a counter with something on it
          px(g, doorX - 12, doorY + 2, 12, 3, '#7a5636');
          px(g, doorX - 10, doorY, 2, 3, '#c8a24a'); px(g, doorX - 7, doorY, 2, 3, '#8f6a3a');
        }
        if (r() < .4) add(bannerFrames('#b2443a', '#e3d6b4'), doorX + 16, doorY - 36, doorY - 36);
      } else if (r() < .55) {
        /* somebody's washing, strung under the eaves between two windows */
        const bx = x0 + 8 + (r() * Math.max(6, w - 46));
        if (r() < .55) add(laundryFrames(r), bx + 1, top + 20, top + 20);
        else { px(g, bx, top + 34, 24, 2, '#8a7554'); for (let i = 0; i < 24; i += 4) px(g, bx + i, top + 36, 1, 3, '#6b5a40'); }
      }
      if (r() < .22) add(birdFrames('#8d8a84'), x0 + 6 + r() * (w - 20), top + 6, top + 6);
    });

    /* ---- the square and the street ---- */
    L.props.forEach(p => {
      if (p.name === 'fountain' || p.name === 'well') add(waterFrames(), p.x * T + 2, p.y * T + 8, p.y * T + 8);
      if (p.name === 'torches') lights.push(p);
      if (p.name === 'statue' && r() < .5) add(birdFrames('#a8a49c'), p.x * T + 40, p.y * T + 6, p.y * T + 6);
      if (p.name === 'stall') add(awningFrames(), p.x * T - 2, p.y * T - 24, p.y * T - 24);
      if (p.name === 'altar' && r() < .7) add(smokeFrames('#d8cfbe'), p.x * T + 8, p.y * T - 26, p.y * T - 26);
    });

    /* a few pigeons on the paving, and a dog that is not going anywhere */
    for (let i = 0; i < 26; i++) {
      const x = 6 + Math.floor(r() * 100), y = 6 + Math.floor(r() * 64);
      if (L.solid[y * 112 + x]) continue;
      add(birdFrames(r() < .5 ? '#8d8a84' : '#6f6b66'), x * T + 4 + r() * 20, y * T + 8 + r() * 18, y * T + 8);
    }
    return art;
  }

  /* an awning over a market stall that lifts a little in the wind */
  function awningFrames() {
    const frames = [];
    for (let f = 0; f < 3; f++) {
      const c = cv(34, 14), g = c.getContext('2d');
      for (let i = 0; i < 34; i++) {
        const lift = Math.round(Math.sin(i / 6 + f * 1.4) * 1.2);
        const col = (Math.floor(i / 5) % 2) ? '#b2443a' : '#e3d6b4';
        px(g, i, 2 - lift, 1, 10, col);
      }
      for (let i = 0; i < 34; i += 3) px(g, i, 12, 2, 2, shade('#e3d6b4', .9));
      frames.push(c);
    }
    return { frames, w: 34, h: 14, fps: 3 };
  }

  /* ============================ the air ============================ */
  /* Drawn every frame over the finished picture, in screen space: a soft vignette so the eye settles on the middle of
     the street, dust in the light on a dry afternoon, and the small splashes that make rain read as rain rather than
     as lines falling past the window. */
  let vign = null, vignKey = '';
  const motes = [];
  for (let i = 0; i < 26; i++) motes.push({ x: Math.random(), y: Math.random(), v: .1 + Math.random() * .3, p: Math.random() * 6.3, s: .4 + Math.random() * .8 });
  function atmos(g, w, h, S, t, night) {
    /* dust: only when it is dry and light */
    if (S && S.weather !== 'rain' && !night) {
      g.save();
      motes.forEach(m => {
        const x = ((m.x + t * 1e-5 * m.v * 60) % 1) * w + Math.sin(t / 1400 + m.p) * 14;
        const y = ((m.y + t * 2e-5 * m.v * 30) % 1) * h + Math.cos(t / 1700 + m.p) * 10;
        g.globalAlpha = .10 + .10 * Math.sin(t / 700 + m.p);
        g.fillStyle = '#f7e6bd';
        g.fillRect(x, y, m.s, m.s);
      });
      g.restore();
    }
    /* splash: short, low, and only on wet ground */
    if (S && S.wet > .2) {
      g.save(); g.strokeStyle = 'rgba(200,222,235,.35)'; g.lineWidth = 1;
      for (let i = 0; i < 14; i++) {
        const seed = (i * 7.13 + Math.floor(t / 130) * 3.7) % 1;
        const x = ((seed * 97) % 1) * w, y = ((seed * 61) % 1) * h;
        g.beginPath(); g.ellipse(x, y, 2.5 * S.wet, .9 * S.wet, 0, 0, 6.3); g.stroke();
      }
      g.restore();
    }
    /* the vignette itself, cached per size */
    const key = w + 'x' + h;
    if (key !== vignKey) {
      const c = cv(w, h), cg = c.getContext('2d');
      const grd = cg.createRadialGradient(w / 2, h / 2, Math.min(w, h) * .32, w / 2, h / 2, Math.max(w, h) * .78);
      grd.addColorStop(0, 'rgba(12,8,5,0)');
      grd.addColorStop(1, 'rgba(12,8,5,.46)');
      cg.fillStyle = grd; cg.fillRect(0, 0, w, h);
      vign = c; vignKey = key;
    }
    if (vign) g.drawImage(vign, 0, 0);
  }

  return { dress, atmos, rng };
})());

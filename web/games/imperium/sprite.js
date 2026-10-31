/* IMPERIUM — the people. Every Roman in the game is a 28x40 pixel sprite with four directions and a four frame
   walk cycle, drawn here from a description (skin, hair, garment, role) rather than a picture file. They are built
   chibi, the way the little legionaries of Shieldwall are: a round head as big as the rest of them put together,
   dot eyes and a blush, a short soft body, two stubs for legs and a shield nearly as tall as they are. Every shape is
   a circle or a rounded box filled pixel by pixel, the light comes from the upper left, and every sprite is outlined
   once at the end. Also here: the battle troops (horses, elephants, beasts and ships too), portraits for the
   dialogue box, inventory icons, and the little effects (dust, sparks, coins) the game throws around. */
window.PIX = (() => {
  'use strict';
  const B = window.PIXTOOLS;
  const { T, rng, hash, cv, ctx, px, mix, shade, ramp, cl, pickr, chance, edge } = B;
  const W = 28, H = 40, FOOT = 37;

  /* ---------------- looks: who a person is, in eight numbers ---------------- */
  const SKINS = [['#f2d3ac', '#d8b287'], ['#e8c199', '#c99f72'], ['#d6a878', '#b28455'], ['#b57c4d', '#8e5d34'], ['#8a5330', '#653a1f'], ['#6b3f24', '#4d2b15']];
  const HAIRS = ['#241c15', '#33261a', '#4a3320', '#6a4a24', '#8f7a5e', '#b0a48f', '#e0d6c2', '#8e3a1c', '#5a3a5a'];
  const CLOTHS = {
    common: ['#b9a488', '#a4906f', '#8f7f68', '#c2b092', '#93876f', '#7d7466'],
    poor: ['#8a7a63', '#6f6353', '#7c6a58', '#63594c', '#877a5e'],
    rich: ['#7d3b3f', '#3f4f6b', '#4c5c40', '#6d4b74', '#8a6a2c', '#2f4f57', '#8e4a2a'],
    white: ['#efe6d2', '#e6dcc4', '#f4ecda']
  };
  const ROLES = {
    senator: { cloth: CLOTHS.white, toga: 1, stripe: 1, shoe: '#5b3a22' },
    consul: { cloth: CLOTHS.white, toga: 1, stripe: 1, wreath: 1, shoe: '#5b3a22' },
    soldier: { cloth: ['#c04a34', '#a83c2a'], helmet: 1, mail: 1, shield: 'scutum', spear: 1, shoe: '#3f2f20' },
    officer: { cloth: ['#c04a34'], helmet: 2, mail: 1, cloak: '#a83a34', swords: 1, shoe: '#3f2f20' },
    priest: { cloth: CLOTHS.white, veil: 1, trim: '#c9a227', shoe: '#5b3a22' },
    vestal: { cloth: CLOTHS.white, veil: 1, trim: '#c9a227', female: 1, robe: 1, shoe: '#5b3a22' },
    merchant: { cloth: ['#8a5a2c', '#2f5f6b', '#6b3a5a', '#5a6b2f'], trim: '#d9b64a', purse: 1, shoe: '#4a3020' },
    pleb: { cloth: CLOTHS.common, apron: 1, shoe: '#3f2f22' },
    poor: { cloth: CLOTHS.poor, apron: 1, bare: 1, shoe: '#33261a' },
    child: { cloth: CLOTHS.common, small: 1, shoe: '#3f2f22' },
    gladiator: { cloth: ['#8a6a4a'], bare: 1, helmet: 3, armguard: 1, shoe: '#3f2f22' },
    lictor: { cloth: ['#c04a34'], fasces: 1, shoe: '#4a3020' },
    matron: { cloth: CLOTHS.rich, female: 1, robe: 1, shawl: 1, shoe: '#5b3a22' },
    scholar: { cloth: ['#3f4f6b', '#4c5c40'], scroll: 1, shoe: '#4a3020' },
    noble: { cloth: CLOTHS.rich, cloak: '#6d2b3f', trim: '#d9b64a', shoe: '#5b3a22' },
    /* the battlefield's own people: they only ever appear as troops */
    archer: { cloth: ['#5f7a3a', '#7a6a3a'], helmet: 4, bow: 1, shoe: '#3f2f20' },
    gaul: { cloth: ['#3f6a8a', '#5a7a3a', '#8a4a2a'], trouser: '#8a6a3a', shield: 'oval', shieldCol: '#3a7a5a', shieldRim: '#c9c2b0', axe: 1, hairStyle: 'long', stache: 1, hair: '#c98a3a', shoe: '#4a3020' },
    hoplite: { cloth: ['#8a3a2a'], helmet: 5, shield: 'round', shieldCol: '#c8913a', shieldRim: '#9a6a2a', spear: 1, shoe: '#4a3020' },
    numidian: { cloth: ['#e6dcc4'], spear: 1, shield: 'round', shieldCol: '#a8562f', shieldRim: '#e6c052', hairStyle: 'curly', hair: '#241c15', skin: '#8a5330', shoe: '#4a3020' },
    hunter: { cloth: ['#8a6a4a'], spear: 1, armguard: 1, shoe: '#3f2f22' }
  };

  function look(key, o) {
    o = Object.assign({}, ROLES[o && o.role] || {}, o || {});
    const s = hash(key || 'x'), r = rng(s);
    const skinP = o.skin && o.skin[0] === '#' && o.skin.length > 4 ? [o.skin, shade(o.skin, -.2)] : pickr(r, SKINS);
    const kind = o.role === 'senator' || o.role === 'consul' || o.role === 'priest' || o.role === 'vestal' ? 'white'
      : o.role === 'merchant' || o.role === 'noble' || o.role === 'matron' || o.role === 'officer' ? 'rich'
        : o.role === 'poor' ? 'poor' : 'common';
    const cloth = o.cloth2 || o.cloth && o.cloth[0] === '#' ? (o.cloth2 || o.cloth) : pickr(r, (o.cloth && o.cloth[0] && o.cloth[0][0] === '#' ? o.cloth : CLOTHS[kind]));
    let hair = o.hair && o.hair[0] === '#' ? o.hair : pickr(r, HAIRS);
    if (o.female === undefined && (o.role === 'vestal' || o.role === 'matron')) o.female = true;
    if (o.kind === 'rich' && o.role === 'senator') o.toga = 1;
    return Object.assign({
      key, seed: s,
      skin: skinP[0], skin2: skinP[1], skin3: shade(skinP[1], -.2),
      hair, hairS: shade(hair, -.26), hairH: shade(hair, .2),
      cloth, clothS: shade(cloth, -.24), clothD: shade(cloth, -.4), clothH: shade(cloth, .17),
      trim: o.trim || (kind === 'rich' ? '#d9b64a' : shade(cloth, -.45)),
      leather: '#6a4a2c', leatherS: '#46301c',
      metal: '#ced7df', metalS: '#8a95a0', metalH: '#f4fafd', gold: '#e6c052', goldS: '#a8842a',
      steel: '#8f99a4',
      hairStyle: o.hairStyle || (o.female ? pickr(r, ['bun', 'long', 'wavy']) : pickr(r, ['short', 'short', 'curly', 'wavy', 'bald', 'crop'])),
      beard: o.beard !== undefined ? o.beard : (o.female ? 0 : (r() < .35 ? 1 : 0)),
      build: o.build || (o.role === 'soldier' || o.role === 'gladiator' ? 'broad' : o.female ? 'slim' : 'mid')
    }, o, {
      skin: skinP[0], skin2: skinP[1], skin3: shade(skinP[1], -.2),
      hair, hairS: shade(hair, -.26), hairH: shade(hair, .2),
      cloth, clothS: shade(cloth, -.24), clothD: shade(cloth, -.4), clothH: shade(cloth, .17)
    });
  }

  /* ---------------- shapes ----------------
     fill() paints every pixel whose centre passes a test, so a shape is just a sentence about where it is.
     inE is inside an ellipse, inR inside a box with rounded corners. */
  const fill = (g, col, f) => {
    g.fillStyle = col;
    const w = g.canvas.width, h = g.canvas.height;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (f(x + .5, y + .5)) g.fillRect(x, y, 1, 1);
  };
  const inE = (x, y, cx, cy, rx, ry) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1;
  const inR = (x, y, x0, y0, x1, y1, r) => {
    if (x < x0 || x > x1 || y < y0 || y > y1) return false;
    const cx = Math.max(x0 + r, Math.min(x1 - r, x)), cy = Math.max(y0 + r, Math.min(y1 - r, y));
    return (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
  };
  /* the inside of a shape, one pixel in from its edge, and the bottom edge of it, for rims and shading */
  const inner = S => (x, y) => S(x, y) && S(x - 1, y) && S(x + 1, y) && S(x, y - 1) && S(x, y + 1);
  const bottom = S => (x, y) => S(x, y) && !S(x, y + 1);
  const TEAM = { me: '#c8402f', foe: '#3d63a8' };

  /* one frame's pose: the step it is on, and where the head and body sit. On a step the whole person squashes a pixel. */
  const pose = (dir, f) => {
    const step = f === 1 ? 1 : f === 3 ? -1 : 0, b = step ? 1 : 0;
    return { dir, f, step, b, hx: 14, hy: 12 + b, R: 9.6, y0: 20 + b, y1: 31 };
  };

  /* ---------------- the body ---------------- */
  const legs = (g, o, P) => {
    const tone = o.trouser || o.skin2, ts = shade(tone, -.2), sock = o.shoe || '#3f2f22';
    if (P.dir !== 'side') {
      const l1 = P.step > 0 ? 1 : 0, l2 = P.step < 0 ? 1 : 0;
      fill(g, tone, (x, y) => (x > 10 && x < 13 && y > 29 && y < 35 - l1) || (x > 15 && x < 18 && y > 29 && y < 35 - l2));
      fill(g, ts, (x, y) => (x > 12 && x < 13 && y > 29 && y < 35 - l1) || (x > 17 && x < 18 && y > 29 && y < 35 - l2));
      fill(g, sock, (x, y) => inR(x, y, 9.5, 33 - l1, 13.6, 37 - l1, 1.4) || inR(x, y, 14.4, 33 - l2, 18.5, 37 - l2, 1.4));
      fill(g, shade(sock, .22), (x, y) => (x > 9.6 && x < 13.4 && y > 33 - l1 && y < 34 - l1) || (x > 14.6 && x < 18.4 && y > 33 - l2 && y < 34 - l2));
    } else {
      // side view: the near leg strides, the far leg trails behind it
      const a = P.step * 2;
      fill(g, ts, (x, y) => x > 12 - a && x < 15 - a && y > 29 && y < 35);
      fill(g, shade(sock, -.15), (x, y) => inR(x, y, 11.5 - a, 33, 16.5 - a, 37, 1.4));
      fill(g, tone, (x, y) => x > 13 + a && x < 16 + a && y > 29 && y < 35);
      fill(g, sock, (x, y) => inR(x, y, 12.5 + a, 33, 17.8 + a, 37, 1.4));
    }
  };

  const torsoBox = P => {
    const side = P.dir === 'side';
    return { X0: side ? 8.6 : 7.6, X1: side ? 19.4 : 20.4, y0: P.y0, y1: P.y1 + .4 };
  };
  /* a cloak hangs behind the body, so it is painted first and the body covers the middle of it */
  const cloakBack = (g, o, P) => {
    const { X0, X1, y0, y1 } = torsoBox(P);
    if (P.dir === 'down') fill(g, o.cloak, (x, y) => inR(x, y, X0 - 2, y0 - 1, X0 + 1.4, y1 + 2.5, 1.2) || inR(x, y, X1 - 1.4, y0 - 1, X1 + 2, y1 + 2.5, 1.2));
    if (P.dir === 'side') fill(g, o.cloak, (x, y) => inR(x, y, X0 - 3, y0 - 1, X0 + 2, y1 + 2.5, 1.4));
  };

  const body = (g, o, P) => {
    const up = P.dir === 'up', side = P.dir === 'side';
    const { X0, X1, y0, y1 } = torsoBox(P);
    const Tb = (x, y) => inR(x, y, X0, y0, X1, y1, 3.4);
    const c = up ? shade(o.cloth, -.08) : o.cloth;
    fill(g, c, Tb);
    fill(g, o.clothS, (x, y) => Tb(x, y) && (x > X1 - 2.6 || y > y1 - 1.6));
    if (!up) fill(g, o.clothH, (x, y) => Tb(x, y) && x < X0 + 2 && y > y0 + 1.5 && y < y1 - 2.5);
    if (o.robe) {                                                         // a robe falls to the ankles and flares
      const top = y1 - 4, Rb = (x, y) => y > top && y < 35.4 && x > X0 - (y - top) * .35 && x < X1 + (y - top) * .35;
      fill(g, c, Rb);
      fill(g, o.clothS, (x, y) => Rb(x, y) && (Math.floor(x) % 3 === 0 || y > 34.4 || x > X1 + (y - top) * .35 - 1.6));
    }
    if (o.bare) {                                                         // a bare chest, and the loincloth under it
      const Bc = (x, y) => Tb(x, y) && y < y1 - 4.5;
      fill(g, o.skin, Bc);
      fill(g, o.skin2, (x, y) => Bc(x, y) && (x > X1 - 2.6 || bottom(Bc)(x, y)));
      if (!up && !side) fill(g, o.skin2, (x, y) => Bc(x, y) && Math.abs(x - 14) < .6 && y > y0 + 2);
      if (o.role === 'gladiator') fill(g, '#efe3c6', (x, y) => Tb(x, y) && y >= y1 - 4.5);
    }
    if (o.apron && !up) fill(g, o.leather, (x, y) => inR(x, y, side ? 12 : 10.6, y0 + 4, side ? 19 : 17.4, y1, 1.2));
    if (o.toga) {                                                         // the toga: one long drape from the left shoulder to the right hip
      const k = up ? -1 : 1, base = up ? X1 : X0;
      const D = (x, y) => Tb(x, y) && Math.abs((x - base) * k - (y - y0) * 1.1 - 1) < 2.6;
      fill(g, up ? o.cloth : o.clothH, D);
      fill(g, o.clothS, (x, y) => Tb(x, y) && Math.abs((x - base) * k - (y - y0) * 1.1 - 4.2) < .6);
      if (o.stripe && !up) fill(g, '#7a2f5a', (x, y) => Tb(x, y) && Math.abs((x - base) * k - (y - y0) * 1.1 + 1.8) < .6);
    }
    if (o.mail) {                                                         // lorica segmentata: bands of iron across the chest
      const M = (x, y) => Tb(x, y) && y < y0 + 7.5;
      fill(g, o.metal, M);
      fill(g, o.metalS, (x, y) => M(x, y) && (Math.floor(y - y0) % 2 === 1 || x > X1 - 2.4));
      fill(g, o.metalH, (x, y) => M(x, y) && Math.floor(y - y0) % 2 === 0 && x < X0 + 2.6);
      const by = y1 - 4.6;
      fill(g, o.leather, (x, y) => Tb(x, y) && y > by && y < by + 1.2);
      fill(g, o.gold, (x, y) => Tb(x, y) && y > by && y < by + 1.2 && Math.floor(x) % 3 === 0);
      fill(g, o.leatherS, (x, y) => Tb(x, y) && y > by + 1.2 && Math.floor(x) % 2 === 0);   // the leather strips of the skirt
    } else if (!o.robe && !o.bare && !o.toga) {
      const by = y1 - 4.6;                                                // a belt, with a bit of gold on it
      fill(g, o.leatherS, (x, y) => Tb(x, y) && y > by && y < by + 1.1);
      if (!up) px(g, side ? 16 : 13, Math.floor(by), 2, 1, o.gold);
    }
    if (o.cloak && up) {
      const C = (x, y) => inR(x, y, X0 - 1, y0 - 1, X1 + 1, y1 + 3, 2.5);
      fill(g, o.cloak, C); fill(g, shade(o.cloak, -.25), bottom(C)); fill(g, shade(o.cloak, .18), (x, y) => C(x, y) && y < y0 + .5);
    }
    if (o.cloak && !up) fill(g, shade(o.cloak, .14), (x, y) => Tb(x, y) && y < y0 + 1.6);   // the cloak's fold over the shoulders
    if (o.shawl) fill(g, o.trim, (x, y) => Tb(x, y) && y < y0 + 3.5);
  };

  const arms = (g, o, P) => {
    const sl = o.bare ? o.skin : (o.sleeve || o.cloth), sk = o.skin;
    const sw = P.step;
    if (P.dir === 'side') {
      const ax = 14 - sw * 1.6, ay = P.y0 + 4.5;
      fill(g, shade(sl, -.08), (x, y) => inE(x, y, ax, ay, 2.2, 4));
      fill(g, sk, (x, y) => inE(x, y, ax + .4, ay + 4.2, 1.9, 1.9));
      if (o.armguard) fill(g, o.metal, (x, y) => inE(x, y, ax, ay, 2.3, 3.6) && Math.floor(y) % 2 === 0);
      P.hand = [[ax + .4, ay + 4.2]];
      return;
    }
    const dark = P.dir === 'up';
    const L = [6.6, P.y0 + 4.5 + Math.max(0, sw)], Rr = [21.4, P.y0 + 4.5 + Math.max(0, -sw)];
    fill(g, dark ? shade(sl, -.12) : shade(sl, .06), (x, y) => inE(x, y, L[0], L[1], 2.1, 4));
    fill(g, shade(sl, dark ? -.28 : -.18), (x, y) => inE(x, y, Rr[0], Rr[1], 2.1, 4));
    fill(g, dark ? o.skin2 : sk, (x, y) => inE(x, y, L[0], L[1] + 4.2, 1.9, 1.9) || inE(x, y, Rr[0], Rr[1] + 4.2, 1.9, 1.9));
    if (o.armguard) fill(g, o.metal, (x, y) => inE(x, y, Rr[0], Rr[1], 2.3, 3.6) && Math.floor(y) % 2 === 0);
    P.hand = [[L[0], L[1] + 4.2], [Rr[0], Rr[1] + 4.2]];
  };

  /* ---------------- the head: half of every Roman ---------------- */
  const hair = (g, o, P, Hd) => {
    const { hx, hy, R } = P, ry = R * .92, up = P.dir === 'up', side = P.dir === 'side', st = o.hairStyle;
    let F;
    if (up) F = (x, y) => Hd(x, y, .5);
    else if (side) F = (x, y) => Hd(x, y, .5) && (y < hy - 3.6 - (st === 'crop' ? 1 : 0) || x < hx - 1.8);
    else F = (x, y) => Hd(x, y, .5) && (y < hy - 3.4 + (st === 'wavy' && Math.floor(x) % 4 < 2 ? 1 : 0) - (st === 'crop' ? 1 : 0) || ((x < hx - R + 2.4 || x > hx + R - 2.4) && y < hy + 1.5));
    if (st === 'bald') {
      const top = F;
      F = (x, y) => top(x, y) && (up ? y > hy - 3 : side ? x < hx - 1.8 && y > hy - 4 : y > hy - 4.5 && (x < hx - R + 2.4 || x > hx + R - 2.4));
    }
    let extra = () => false;
    if (st === 'curly') extra = (x, y) => { for (let i = 0; i < 7; i++) { const a = Math.PI * (1.05 + i * .15); if (inE(x, y, hx + Math.cos(a) * (R - .6), hy + Math.sin(a) * (ry - .6), 2.3, 2.3)) return true; } return false; };
    else if (st === 'bun') extra = side ? (x, y) => inE(x, y, hx - R + .6, hy - 2, 3, 3) : (x, y) => inE(x, y, hx, hy - ry - 1.2, 3.2, 2.8);
    else if (st === 'long' || (st === 'wavy' && o.female)) extra = side ? (x, y) => inR(x, y, hx - R - .2, hy - 2, hx - 1.5, hy + 10, 2)
      : up ? (x, y) => inR(x, y, hx - R - .4, hy, hx + R + .4, hy + 10, 3)
        : (x, y) => inR(x, y, hx - R - .6, hy - 2, hx - R + 2.6, hy + 10, 1.4) || inR(x, y, hx + R - 2.6, hy - 2, hx + R + .6, hy + 10, 1.4);
    const all = (x, y) => F(x, y) || extra(x, y);
    fill(g, o.hair, all);
    fill(g, o.hairH, (x, y) => all(x, y) && y < hy - ry + 2.6 && x < hx + (side ? 1 : -1) && x > hx - R + 1.5);
    fill(g, o.hairS, bottom(all));
    if (st === 'bald' && !up) px(g, hx - 4, Math.floor(hy - ry + 2.5), 3, 1, shade(o.skin, .3));   // the shine on a bald head
  };

  const face = (g, o, P, Hd) => {
    const { hx, hy } = P, side = P.dir === 'side';
    const eye = '#2b1d26', shine = '#fffaf0', blush = mix(o.skin, '#ef7f76', .55), mouth = shade(o.skin2, -.45);
    if (o.beard) {
      if (side) fill(g, o.hairS, (x, y) => (Hd(x, y) && y > hy + 3.4 && x > hx - 2.5) || inE(x, y, hx + 4, hy + 7.4, 4, 2.6));
      else fill(g, o.hairS, (x, y) => (Hd(x, y) && y > hy + 3.6 && Math.abs(x - hx) < P.R - 1.5) || inE(x, y, hx, hy + 7.8, 5.2, 3));
    }
    if (side) {
      fill(g, o.skin, (x, y) => inE(x, y, hx - 1.4, hy + 1.6, 1.6, 1.9));        // ear
      px(g, hx - 2, hy + 1, 1, 2, o.skin2);
      px(g, hx + 3, hy + 1, 2, 3, eye); px(g, hx + 3, hy + 1, 1, 1, shine);
      if (!o.beard) px(g, hx + 5, hy + 4, 2, 1, blush);
      px(g, hx + 6, hy + 5, 2, 1, o.beard ? '#5a2a2a' : mouth);
      if (o.stache && !o.beard) px(g, hx + 4, hy + 4, 4, 1, o.hairS);
    } else {
      px(g, hx - 5, hy + 1, 2, 3, eye); px(g, hx + 3, hy + 1, 2, 3, eye);    // two dots, a long way apart
      px(g, hx - 5, hy + 1, 1, 1, shine); px(g, hx + 3, hy + 1, 1, 1, shine);
      if (!o.beard) { px(g, hx - 7, hy + 4, 2, 1, blush); px(g, hx + 5, hy + 4, 2, 1, blush); }
      px(g, hx - 1, hy + 5, 2, 1, o.beard ? '#5a2a2a' : mouth);
      if (o.stache && !o.beard) { px(g, hx - 4, hy + 4, 3, 1, o.hairS); px(g, hx + 1, hy + 4, 3, 1, o.hairS); px(g, hx - 5, hy + 5, 1, 1, o.hairS); px(g, hx + 4, hy + 5, 1, 1, o.hairS); }
    }
  };

  const CREST = ['#d64a3a', '#f07a62', '#8f2f28'];
  const helmet = (g, o, P, Hd) => {
    const { hx, hy, R } = P, ry = R * .92, up = P.dir === 'up', side = P.dir === 'side', kind = o.helmet;
    const brow = hy - 2.6;
    if (kind === 4) {                                                     // the archer's pointed cap
      const C = (x, y) => (Hd(x, y, .8) && y < brow) || (y < brow && y > hy - ry - 4 && Math.abs(x - hx) < (y - (hy - ry - 4.5)) * 1.1);
      fill(g, '#8a8f96', C); fill(g, '#b9c0c6', (x, y) => C(x, y) && x < hx - 1); fill(g, '#5f656c', bottom(C));
      return;
    }
    const bronze = kind === 5;
    const m = bronze ? '#d09a42' : o.metal, ms = bronze ? '#9a6a2a' : o.metalS, mh = bronze ? '#f2cf7a' : o.metalH;
    const D = (x, y) => Hd(x, y, .9) && (up ? y < hy + 3.5 : y < brow + (bronze && !side ? 0 : 0));
    fill(g, m, D);
    fill(g, mh, (x, y) => D(x, y) && y < hy - ry + 3 && x < hx + (side ? 1 : -1));
    fill(g, ms, bottom(D));
    if (!up) {
      if (side) fill(g, m, (x, y) => inR(x, y, hx - R - .9, brow - 1, hx - 2.5, hy + 3.8, 1.2));      // the neck guard
      if (kind === 3) {                                                   // the gladiator's grille over the whole face
        const V = side ? (x, y) => inR(x, y, hx - 1, brow - .5, hx + 7.6, hy + 6, 2) : (x, y) => inR(x, y, hx - 6.2, brow - .5, hx + 6.2, hy + 6, 2);
        fill(g, m, V);
        fill(g, '#2a2a30', (x, y) => V(x, y) && y > brow + 1 && y < hy + 4.8 && (Math.floor(x) + Math.floor(y)) % 2 === 0 && Math.abs(x - hx - (side ? 3.2 : 0)) < (side ? 3.6 : 5));
      } else if (bronze) {                                                // Corinthian: cheeks closed round the face, a slot for the eyes
        const Cc = side ? (x, y) => inR(x, y, hx - 1, brow - .5, hx + 7.6, hy + 6.4, 2) : (x, y) => inR(x, y, hx - R - .5, brow - .5, hx + R + .5, hy + 6.4, 3);
        const open = side ? (x, y) => (y > hy + .4 && y < hy + 3.6 && x > hx + 2) || (y > hy + 3.6 && x > hx + 5.2)
          : (x, y) => (y > hy + .4 && y < hy + 3.6 && Math.abs(x - hx) < 6 && Math.abs(x - hx) > .8) || (y > hy + 3.6 && Math.abs(x - hx) < 2.4);
        fill(g, m, (x, y) => Cc(x, y) && !open(x, y));
        fill(g, ms, (x, y) => Cc(x, y) && !open(x, y) && (x > hx + R - 2.5 || bottom(Cc)(x, y)));
      } else {                                                            // cheek guards
        if (side) fill(g, m, (x, y) => inR(x, y, hx - 1, brow - .5, hx + 2.2, hy + 4.6, 1.1));
        else fill(g, m, (x, y) => inR(x, y, hx - R - .9, brow - .5, hx - R + 2.4, hy + 4.6, 1.1) || inR(x, y, hx + R - 2.4, brow - .5, hx + R + .9, hy + 4.6, 1.1));
      }
    }
    /* the crest: a brush that runs front to back (seen thin from the front, long from the side), or the officer's
       crosswise one, which is the other way round */
    const top = hy - ry;
    const thin = (x, y) => inR(x, y, hx - 1.8, top - 5.2, hx + 1.8, top + 1.5, 1.6);
    const long = (x, y) => inE(x, y, hx - .5, top - 1.2, 6.4, 3.2) && y < top + 1;
    const wide = (x, y) => inE(x, y, hx, top - 1.2, R + 1.8, 2.8) && y < top + 1.2;
    let Cr = null;
    if (kind === 1 || kind === 5) Cr = side ? long : thin;
    if (kind === 2) Cr = side ? thin : wide;
    if (Cr) {
      const cc = bronze ? ['#a8322a', '#d0503a', '#5a1a16'] : CREST;
      fill(g, cc[0], Cr);
      fill(g, cc[1], (x, y) => Cr(x, y) && !Cr(x, y - 1.5));
      fill(g, cc[2], bottom(Cr));
    }
  };

  const veil = (g, o, P, Hd) => {
    const { hx, hy, R } = P, ry = R * .92, up = P.dir === 'up', side = P.dir === 'side';
    const V = up ? (x, y) => Hd(x, y, 1.4) || inR(x, y, hx - R - 1.4, hy, hx + R + 1.4, 29, 3)
      : side ? (x, y) => (Hd(x, y, 1.4) && (y < hy - 3.8 || x < hx - 2.2)) || inR(x, y, hx - R - 1.4, hy - 1, hx - 1, 29, 2)
        : (x, y) => (Hd(x, y, 1.4) && !inE(x, y, hx, hy + 1.6, R - 2.4, ry - 2.2)) || inR(x, y, hx - R - 1.4, hy, hx - R + 2.2, 29, 1.5) || inR(x, y, hx + R - 2.2, hy, hx + R + 1.4, 29, 1.5);
    fill(g, o.cloth, V);
    fill(g, o.clothH, (x, y) => V(x, y) && !V(x - 1.5, y - 1.5));
    fill(g, o.clothS, bottom(V));
    if (o.trim) fill(g, o.trim, (x, y) => V(x, y) && y > 27.4);
  };

  const wreath = (g, o, P) => {
    const { hx, hy, R } = P, side = P.dir === 'side', up = P.dir === 'up';
    for (let i = 0; i <= 10; i++) {
      const a = Math.PI * (i / 10);
      const x = hx + Math.cos(a) * (R + .2) * (side ? .75 : 1) + (side ? -1 : 0), y = hy - 4.2 + Math.sin(a) * 1.4 * (up ? -1 : 1);
      px(g, x - 1, y, 2, 1, i % 2 ? '#5f8a34' : '#8fbf52');
    }
  };

  const head = (g, o, P) => {
    const { hx, hy, R } = P, ry = R * .92, up = P.dir === 'up';
    const Hd = (x, y, k = 0) => inE(x, y, hx, hy, R + k, ry + k);
    fill(g, o.skin, Hd);
    fill(g, o.skin2, (x, y) => Hd(x, y) && !inE(x, y, hx - 1.1, hy - 1.3, R - .6, ry - .6));   // shade round the bottom right
    if (!o.helmet || o.helmet === 4) hair(g, o, P, Hd);
    if (!up) face(g, o, P, Hd);
    if (o.helmet) helmet(g, o, P, Hd);
    if (o.veil) veil(g, o, P, Hd);
    if (o.wreath && !o.helmet) wreath(g, o, P);
  };

  /* ---------------- the kit they carry ---------------- */
  const WOOD = '#7a5532';
  /* held behind the hand, so the fingers close over it: spears, the trident, the lictor's rods */
  const kitBack = (g, o, P) => {
    const d = P.dir;
    if (o.spear || o.trident) {
      const sx = d === 'side' ? 15 - P.step * 1.6 : d === 'up' ? 6 : 21;
      fill(g, WOOD, (x, y) => x > sx && x < sx + 1.2 && y > 3 && y < 35);
      if (o.trident) fill(g, o.metal, (x, y) => (y > 0 && y < 5 && [-1.5, .6, 2.6].some(k => Math.abs(x - sx - k) < .6)) || (y > 4 && y < 5.4 && x > sx - 2 && x < sx + 3.2));
      else fill(g, o.metalS, (x, y) => y > 0 && y < 5 && Math.abs(x - sx - .6) < y * .3 + .3);
    }
    if (o.fasces) {
      const fx = d === 'side' ? 16 : d === 'up' ? 4 : 21;
      fill(g, '#a8762c', (x, y) => x > fx && x < fx + 3 && y > 9 && y < 33);
      fill(g, '#7a5c34', (x, y) => x > fx && x < fx + 3 && y > 9 && y < 33 && Math.floor(y) % 4 === 0);
      fill(g, '#8f8268', (x, y) => inE(x, y, fx + 2.5, 8, 2.4, 2));
    }
    if (o.bow && d === 'up') fill(g, '#7a5532', (x, y) => inR(x, y, 15, P.y0 - 2, 18, P.y0 + 8, .8));   // the quiver on his back
  };

  const SHIELD_DEC = '#f2dc8a';
  const shield = (g, o, P) => {
    const d = P.dir, kind = o.shield, rim = o.shieldRim || '#e6c052';
    const col = d === 'up' ? '#6a4a2c' : (o.shieldCol || '#c03a2e');                   // seen from behind it is just leather
    const cx = d === 'side' ? 19.5 : d === 'up' ? 22 : 5.6, cy = P.y0 + 7;
    let S;
    if (kind === 'scutum') S = d === 'side' ? (x, y) => inR(x, y, 16.5, P.y0 - 1, 22.5, 35, 2) : d === 'up' ? (x, y) => inR(x, y, 18.5, P.y0 - 1, 26.8, 35, 2.2) : (x, y) => inR(x, y, 1.2, P.y0 - 1, 9.6, 35, 2.2);
    else if (kind === 'oval') S = (x, y) => inE(x, y, cx, cy + 1, d === 'side' ? 3 : 4.6, 8);
    else if (kind === 'parma') S = (x, y) => inR(x, y, cx - (d === 'side' ? 2.6 : 3.8), cy - 3.8, cx + (d === 'side' ? 2.6 : 3.8), cy + 3.8, 1.2);
    else S = (x, y) => inE(x, y, cx, cy, d === 'side' ? 3.2 : 5.6, 6.4);
    const In = inner(S);
    fill(g, rim, S);
    fill(g, col, In);
    fill(g, shade(col, .18), (x, y) => In(x, y) && !In(x - 1, y - 1));
    fill(g, shade(col, -.25), (x, y) => In(x, y) && !In(x + 1, y + 1));
    if (d === 'up') return;
    const bx = kind === 'scutum' ? (d === 'side' ? 19.5 : 5.4) : cx, by = kind === 'scutum' ? P.y0 + 7.5 : cy;
    if (kind === 'scutum' && d !== 'side') {                             // the gold wings and bolts painted on a legion's shield
      [[-2, -4], [2, -4], [-2, 4], [2, 4], [0, -7], [0, 7]].forEach(p => px(g, bx + p[0] - .5, by + p[1], 1, p[1] === 0 ? 1 : 2, SHIELD_DEC));
    }
    fill(g, rim, (x, y) => inE(x, y, bx, by, 1.8, 1.8));                  // the boss
    px(g, bx - 1, by - 1, 1, 1, '#fff6d8');
  };

  /* held in front: the shield, and whatever is in his hand */
  const kitFront = (g, o, P) => {
    const d = P.dir, h = P.hand || [];
    if (o.shield) shield(g, o, P);
    const rh = d === 'side' ? h[0] : h[1], lh = h[0];
    if (!rh || d === 'up') return;
    if (o.bow) {
      const bx = d === 'side' ? 17 : 4.5, by = P.y0 + 7;
      fill(g, '#8a5a2a', (x, y) => { const e = ((x - bx) / 3.2) ** 2 + ((y - by) / 9) ** 2; return e > .55 && e < 1 && (d === 'side' ? x > bx : x < bx); });
      fill(g, '#efe6cc', (x, y) => Math.abs(x - bx) < .5 && Math.abs(y - by) < 8.6);
    }
    if (o.axe) {
      px(g, rh[0], rh[1] - 9, 1, 10, WOOD);
      fill(g, o.metal, (x, y) => inE(x, y, rh[0] + 2.2, rh[1] - 8, 2.2, 2.6) && x > rh[0] + 1);
      fill(g, o.metalS, (x, y) => inE(x, y, rh[0] + 2.2, rh[1] - 8, 2.2, 2.6) && x > rh[0] + 3.4);
    }
    if (o.swords) {                                                       // a gladius, point up, or one in each hand
      const blade = p => { if (d === 'side') { px(g, p[0] + 1, p[1], 6, 1, o.metalH); px(g, p[0], p[1] - 1, 1, 3, o.gold); } else { px(g, p[0], p[1] - 7, 1, 6, o.metalH); px(g, p[0] - 1, p[1] - 1, 3, 1, o.gold); } };
      blade(rh);
      if (o.swords === 2 && d !== 'side') blade(lh);
    }
    if (o.scroll) { px(g, rh[0] - 2, rh[1] - 1, 4, 3, '#e6d6b0'); px(g, rh[0] - 2, rh[1] - 1, 1, 3, '#c9b48a'); px(g, rh[0] + 1, rh[1] - 1, 1, 3, '#c9b48a'); }
    if (o.purse && d === 'down') { px(g, 16, P.y1 - 6, 3, 3, o.leather); px(g, 16, P.y1 - 6, 3, 1, shade(o.leather, .2)); px(g, 17, P.y1 - 5, 1, 1, o.gold); }
  };

  /* ---------------- one frame, one direction ---------------- */
  /* A child is drawn at full size and then shrunk about their feet, so they stand in the street a head shorter
     than everybody else without a second set of coordinates to keep in step. */
  function smaller(c) {
    const s = .74, tx = (W / 2) * (1 - s), ty = FOOT * (1 - s);
    const o = cv(W, H), g = ctx(o);
    g.imageSmoothingEnabled = false;
    g.save(); g.translate(tx, ty); g.scale(s, s); g.drawImage(c, 0, 0); g.restore();
    return o;
  }
  function frameSprite(o, dir, f) {
    const c = cv(W, H), g = ctx(c), P = pose(dir, f);
    if (o.cloak) cloakBack(g, o, P);
    legs(g, o, P);
    body(g, o, P);
    kitBack(g, o, P);
    arms(g, o, P);
    head(g, o, P);
    kitFront(g, o, P);
    return edge(o.small ? smaller(c) : c, 'rgba(26,18,20,.92)');
  }

  const flip = c => { const m = cv(c.width, c.height), g = ctx(m); g.translate(c.width, 0); g.scale(-1, 1); g.drawImage(c, 0, 0); return m; };
  const cache = {};
  function folk(o) {
    const key = (o.key || 'x') + '|' + o.role + '|' + o.cloth + o.hair + o.skin + o.hairStyle + (o.helmet || '') + (o.female ? 'f' : '') + (o.toga ? 't' : '') + (o.shield || '');
    if (cache[key]) return cache[key];
    const side = [0, 1, 2, 3].map(f => frameSprite(o, 'side', f));
    const spr = {
      down: [0, 1, 2, 3].map(f => frameSprite(o, 'down', f)),
      up: [0, 1, 2, 3].map(f => frameSprite(o, 'up', f)),
      left: side.map(flip),
      right: side
    };
    cache[key] = spr;
    return spr;
  }

  /* ---------------- the battlefield: troops, mounts, beasts and boats ----------------
     Everything here faces right; the battle mirrors the enemy's whole formation, so one drawing serves both sides.
     The side still matters for colour: the saddle cloth, the sail and the elephant's blanket are the team's. */
  const TROOP = {
    legion: { role: 'soldier' },
    guard: { role: 'soldier', cloth: ['#6b3f86'], shieldCol: '#4c2f6a', helmet: 2, cloak: '#3f2a5a' },
    aux: { role: 'archer' },
    horse: { role: 'soldier', mount: 'bay', shield: 'oval', shieldCol: '#c03a2e' },
    elephant: { beast: 'elephant', rider: 1 },
    warband: { role: 'gaul' },
    horde: { role: 'gaul', shield: 0, bare: 1, cloth: ['#7a5a3a', '#5a6a3a'] },
    phalanx: { role: 'hoplite' },
    horsearcher: { role: 'archer', mount: 'grey', cloth: ['#8a5a2c'] },
    numidian: { role: 'numidian', mount: 'pony' },
    murmillo: { role: 'gladiator', helmet: 3, shield: 'scutum', shieldCol: '#8a6a2a' },
    retiarius: { role: 'gladiator', helmet: 0, trident: 1 },
    thraex: { role: 'gladiator', helmet: 3, shield: 'parma', shieldCol: '#9a3a2a', swords: 1 },
    hoplo: { role: 'gladiator', helmet: 5, shield: 'round', shieldCol: '#c8913a', spear: 1 },
    esseda: { role: 'gladiator', helmet: 1, mount: 'grey', shield: 'round', shieldCol: '#3a6a8a' },
    dimachaerus: { role: 'gladiator', helmet: 3, swords: 2 },
    bestiarius: { role: 'hunter' },
    leo: { beast: 'lion' }, ursus: { beast: 'bear' }, panthera: { beast: 'leopard' }, caecus: { beast: 'wolf' },
    elephas: { beast: 'elephant' },
    liburna: { ship: 1 }, trireme: { ship: 3 }, bireme: { ship: 2 }, raft: { ship: 0 }, captured: { ship: 2, black: 1 }
  };
  const stepOf = f => f === 1 ? 1 : f === 3 ? -1 : 0;

  const COATS = { bay: ['#9a6238', '#6e4224', '#2a1c16'], grey: ['#c4bcae', '#948c7e', '#5a5248'], pony: ['#b07a44', '#84572e', '#3a2618'] };
  function ride(man, coat, side, f) {
    const c = cv(48, 52), g = ctx(c), [hc, hs, mane] = COATS[coat] || COATS.bay, step = stepOf(f);
    g.drawImage(man, 8, 1 + (step ? 1 : 0));                             // the rider first, so the horse's back hides his legs
    const hb = cv(48, 52), q = ctx(hb);
    const bodyH = (x, y) => inE(x, y, 21, 37, 12.5, 6.6);
    const neck = (x, y) => inE(x, y, 32.5, 30, 3.6, 6.5);
    const headH = (x, y) => inE(x, y, 37, 24.5, 5.6, 3.9);
    const legX = [11, 16, 25, 30];
    const legH = (x, y) => legX.some((lx, i) => x > lx && x < lx + 3 && y > 40 && y < 49 - ((i % 2 === 0) === (step > 0) && step ? 1.5 : 0));
    fill(q, mane, (x, y) => inE(x, y, 8, 36, 2.4, 5.5) || inE(x, y, 7, 41, 1.8, 3));          // tail
    fill(q, hs, (x, y) => legH(x, y) && (Math.floor((x - 11) / 5) % 2 === 1));                // far legs, in shade
    fill(q, hc, (x, y) => legH(x, y) && (Math.floor((x - 11) / 5) % 2 === 0));
    fill(q, mane, (x, y) => legH(x, y) && !legH(x, y + 1.5));                                 // hooves
    fill(q, hc, (x, y) => bodyH(x, y) || neck(x, y) || headH(x, y));
    fill(q, hs, (x, y) => bodyH(x, y) && !inE(x, y, 20, 35.6, 12, 6));
    fill(q, mane, (x, y) => inE(x, y, 31, 27, 2, 6) && x < 32);                               // mane
    fill(q, hc, (x, y) => inR(x, y, 34.5, 18.5, 37, 22, .8));                                 // ear
    fill(q, TEAM[side] || TEAM.me, (x, y) => bodyH(x, y) && y < 36 && x > 15 && x < 27);      // the saddle cloth
    fill(q, '#e6c052', (x, y) => bodyH(x, y) && y > 35 && y < 36 && x > 15 && x < 27);
    px(q, 38, 22, 2, 2, '#1e1418'); px(q, 38, 22, 1, 1, '#fffaf0');
    px(q, 39, 26, 2, 1, '#e58a7a');
    px(q, 42, 25, 1, 1, hs);
    g.drawImage(edge(hb, 'rgba(26,18,20,.92)'), 0, 0);
    return c;
  }

  const BEASTS = {
    lion: { c: '#d9a54a', s: '#a87a2e', mane: '#9a5a24' },
    bear: { c: '#7a5236', s: '#563620', ears: 'round', big: 1 },
    leopard: { c: '#e2b44c', s: '#b0862e', spots: '#5a3a1a' },
    wolf: { c: '#8e8e9a', s: '#64646e', ears: 'point', snout: 1 }
  };
  function quad(kind, f) {
    const Bk = BEASTS[kind], c = cv(38, 32), g = ctx(c), step = stepOf(f);
    const bodyF = (x, y) => inE(x, y, 16, 20, 10.5, Bk.big ? 7 : 6);
    const legX = [8, 12.5, 19, 23.5];
    const legF = (x, y) => legX.some((lx, i) => x > lx && x < lx + 3 && y > 22 && y < 29.5 - ((i % 2 === 0) === (step > 0) && step ? 1.4 : 0));
    if (kind !== 'bear') fill(g, Bk.c, (x, y) => inE(x, y, 4.5, 15, 1.6, 4.4));             // tail
    if (kind === 'lion') fill(g, Bk.mane, (x, y) => inE(x, y, 4, 11, 2.2, 2.2));
    fill(g, Bk.s, (x, y) => legF(x, y) && Math.floor((x - 8) / 4.5) % 2 === 1);
    fill(g, Bk.c, (x, y) => legF(x, y) && Math.floor((x - 8) / 4.5) % 2 === 0);
    fill(g, Bk.c, bodyF);
    fill(g, Bk.s, (x, y) => bodyF(x, y) && !inE(x, y, 15.4, 19, 10, 5.6));
    if (Bk.spots) fill(g, Bk.spots, (x, y) => bodyF(x, y) && (Math.floor(x) * 5 + Math.floor(y) * 3) % 7 === 0);
    if (Bk.mane) fill(g, Bk.mane, (x, y) => inE(x, y, 26, 13, 8, 8));
    if (Bk.ears === 'round') fill(g, Bk.c, (x, y) => inE(x, y, 23, 7.5, 2.4, 2.4) || inE(x, y, 30, 7.5, 2.4, 2.4));
    else if (Bk.ears === 'point') fill(g, Bk.c, (x, y) => (y > 3 && y < 9 && Math.abs(x - 23.5) < (y - 3) * .45) || (y > 3 && y < 9 && Math.abs(x - 29.5) < (y - 3) * .45));
    else fill(g, Bk.c, (x, y) => inE(x, y, 23.5, 8, 1.9, 1.9) || inE(x, y, 29.5, 8, 1.9, 1.9));
    const headF = (x, y) => inE(x, y, 27, 13, Bk.big ? 6.6 : 6.2, Bk.big ? 6.2 : 5.8);
    fill(g, Bk.c, headF);
    fill(g, Bk.s, (x, y) => headF(x, y) && !inE(x, y, 26.4, 12.4, 6, 5.4));
    if (Bk.snout) fill(g, shade(Bk.c, .2), (x, y) => inE(x, y, 32.5, 15.5, 3.4, 2.2));
    else fill(g, shade(Bk.c, .25), (x, y) => inE(x, y, 30.5, 15.2, 2.6, 2));
    px(g, 28, 11, 2, 2, '#1e1418'); px(g, 28, 11, 1, 1, '#fffaf0');
    px(g, 28, 15, 2, 1, '#e88a80');
    px(g, Bk.snout ? 35 : 32, 14, 1, 1, '#3a2420');
    return edge(c, 'rgba(26,18,20,.92)');
  }

  function elephant(f, side, withRider) {
    const c = cv(54, 56), g = ctx(c), step = stepOf(f), oy = 8;
    if (withRider) {                                                      // the mahout sits up on its back
      const rider = folk(look('troop-mahout', { role: 'numidian', shield: 0, spear: 0, swords: 0 })).right[0];
      g.drawImage(rider, 10, -3);
    }
    const e = cv(54, 56), q = ctx(e), gr = '#a3a3b0', gs = '#7a7a88';
    const bodyE = (x, y) => inE(x, y, 22, 30 + oy, 15, 10.5);
    const headE = (x, y) => inE(x, y, 37, 24 + oy, 8.5, 8);
    const legX = [9.5, 16.5, 25, 31.5];
    const legE = (x, y) => legX.some((lx, i) => x > lx && x < lx + 5.5 && y > 36 + oy && y < 47.5 + oy - ((i % 2 === 0) === (step > 0) && step ? 1.5 : 0));
    const trunk = (x, y) => { for (let t = 0; t <= 1.001; t += .08) { if (inE(x, y, 43.5 + 2.4 * t + Math.sin(t * 3) * 1.4, 27 + oy + 13 * t, 2.7 - 1.1 * t, 2.7 - 1.1 * t)) return true; } return false; };
    fill(q, gs, (x, y) => inE(x, y, 6.5, 31 + oy, 1.3, 4.5));
    fill(q, gs, (x, y) => legE(x, y) && (legX.findIndex(lx => x > lx && x < lx + 5.5) % 2 === 1));
    fill(q, gr, (x, y) => legE(x, y) && (legX.findIndex(lx => x > lx && x < lx + 5.5) % 2 === 0));
    fill(q, '#d6d6de', (x, y) => legE(x, y) && !legE(x, y + 1.2) && Math.floor(x) % 2 === 0);     // toenails
    fill(q, gr, (x, y) => bodyE(x, y) || headE(x, y) || trunk(x, y));
    fill(q, gs, (x, y) => bodyE(x, y) && !inE(x, y, 21, 28.6 + oy, 14.4, 10));
    fill(q, TEAM[side] || TEAM.me, (x, y) => bodyE(x, y) && y < 27 + oy && x > 12 && x < 30);       // the blanket
    fill(q, '#e6c052', (x, y) => bodyE(x, y) && y > 26 + oy && y < 27.2 + oy && x > 12 && x < 30);
    fill(q, '#8e8e9c', (x, y) => inE(x, y, 32, 25 + oy, 5.2, 7));                                 // the ear
    fill(q, '#d9a0a6', (x, y) => inE(x, y, 32.4, 25.4 + oy, 3.2, 4.8));
    fill(q, '#f4ecd8', (x, y) => inE(x, y, 43, 33 + oy, 2.8, 1.2));                              // tusk
    px(q, 39, 21 + oy, 2, 2, '#1e1418'); px(q, 39, 21 + oy, 1, 1, '#fffaf0');
    px(q, 40, 26 + oy, 2, 1, '#e08a90');
    g.drawImage(edge(e, 'rgba(26,18,20,.92)'), 0, 0);
    return c;
  }

  function ship(banks, side, black, f) {
    const c = cv(52, 40), g = ctx(c), bob = f % 2;
    const sail = black ? '#2e2a2e' : (TEAM[side] || TEAM.me);
    const hull = (x, y) => y > 25 + bob && y < 34 + bob && x > 3 + (y - 25 - bob) && x < 48 - (y - 25 - bob) * 1.4;
    if (banks === 0) {                                                    // a raft: planks, and men standing on them
      [12, 22, 32].forEach((hx, i) => { const lk = look('troop-raft' + i, { role: 'soldier', shield: 0, spear: 1 }); g.drawImage(folk(lk).right[0], hx - 14, -4 + bob); });
      const Rf = (x, y) => inR(x, y, 3, 27 + bob, 47, 32 + bob, 1.2);
      const r2 = cv(52, 40), q = ctx(r2);
      fill(q, '#8a6238', Rf); fill(q, '#5a3e22', (x, y) => Rf(x, y) && Math.floor(x) % 5 === 0); fill(q, '#5a3e22', bottom(Rf));
      g.drawImage(edge(r2, 'rgba(26,18,20,.92)'), 0, 0);
      return c;
    }
    const s2 = cv(52, 40), q = ctx(s2);
    fill(q, '#6a4a2a', (x, y) => x > 24.5 && x < 26.5 && y > 2 && y < 26);                       // mast
    const Sl = (x, y) => inR(x, y, 13, 4 + bob, 38, 18 + bob, 1.5) && !(y > 16 + bob && Math.abs(x - 25.5) > 10);
    fill(q, sail, Sl);
    if (!black) fill(q, '#e6c052', (x, y) => Sl(x, y) && y > 10 + bob && y < 12 + bob);
    fill(q, shade(sail, -.25), (x, y) => Sl(x, y) && x > 35);
    g.drawImage(edge(s2, 'rgba(26,18,20,.92)'), 0, 0);
    for (let i = 0; i < 3; i++) {                                          // three little heads over the side, helmets on
      const hx = 14 + i * 9.5, hy = 23 + bob, Hh = (x, y) => inE(x, y, hx, hy, 3.4, 3.2);
      const h2 = cv(52, 40), r = ctx(h2);
      fill(r, i === 1 ? '#d6a878' : '#e8c199', Hh); fill(r, '#ced7df', (x, y) => Hh(x, y) && y < hy - .6); fill(r, CREST[0], (x, y) => inE(x, y, hx, hy - 3.4, 1, 1.4));
      px(r, hx + 1, hy, 1, 1, '#2b1d26');
      g.drawImage(edge(h2, 'rgba(26,18,20,.92)'), 0, 0);
    }
    const h3 = cv(52, 40), r = ctx(h3);
    for (let k = 0; k < Math.max(1, banks) * 2 + 2; k++) {                // oars: a row for every bank
      const ox = 9 + (k % 6) * 6 + (k >= 6 ? 3 : 0), oyy = 31 + bob + (k >= 6 ? 1 : 0);
      for (let t = 0; t < 7; t++) px(r, ox - t * .45 + (bob ? 1 : 0), oyy + t, 1, 1, '#a07848');
    }
    fill(r, '#8a5a32', hull);
    fill(r, shade('#8a5a32', -.3), bottom(hull));
    fill(r, sail, (x, y) => hull(x, y) && y > 26.4 + bob && y < 28 + bob);
    fill(r, '#5a3a1e', (x, y) => hull(x, y) && y > 30 + bob && y < 31 + bob && Math.floor(x) % 4 === 0);   // oar ports
    fill(r, '#8a5a32', (x, y) => inE(x, y, 4.5, 23 + bob, 2, 3.4));                                      // the stern curl
    fill(r, '#c8913a', (x, y) => inR(x, y, 45, 30 + bob, 51, 32.4 + bob, .6));                           // the bronze ram
    g.drawImage(edge(h3, 'rgba(26,18,20,.92)'), 0, 0);
    return c;
  }

  const tcache = {};
  /* one figure of a unit: v picks one of three faces, so a formation is not twelve copies of the same man */
  function troop(type, side, f, v) {
    f = f || 0; v = v || 0; side = side === 'foe' ? 'foe' : 'me';
    const key = type + '|' + side + '|' + f + '|' + v;
    if (tcache[key]) return tcache[key];
    const d = TROOP[type] || { role: 'soldier' };
    let out;
    if (d.beast === 'elephant') out = elephant(f, side, d.rider);
    else if (d.beast) out = quad(d.beast, f);
    else if (d.ship !== undefined) out = ship(d.ship, side, d.black, f);
    else {
      const o = Object.assign({}, d); delete o.mount;
      const man = folk(look('troop-' + type + '-' + v, o)).right[f % 4];
      out = d.mount ? ride(man, d.mount, side, f) : man;
    }
    tcache[key] = out;
    return out;
  }

  /* ---------------- portraits: the face in the dialogue box ----------------
     The same little person, close up: the head and shoulders of the front-facing sprite, blown up in whole pixels
     and then fitted to the box, so the face you talk to is the face you walked up to. */
  const pcache = {};
  function portrait(o, size) {
    const S = size || 64, key = (o.key || 'x') + 'P' + S;
    if (pcache[key]) return pcache[key];
    const c = cv(S, S), g = ctx(c);
    const grd = g.createLinearGradient(0, 0, 0, S);
    grd.addColorStop(0, o.role === 'soldier' || o.role === 'officer' ? '#4a3026' : o.toga ? '#3a3448' : '#2e3742');
    grd.addColorStop(1, '#1a1b22');
    g.fillStyle = grd; g.fillRect(0, 0, S, S);
    const glowG = g.createRadialGradient(S * .5, S * .42, 0, S * .5, S * .42, S * .5);
    glowG.addColorStop(0, 'rgba(255,226,170,.22)'); glowG.addColorStop(1, 'rgba(255,226,170,0)');
    g.fillStyle = glowG; g.fillRect(0, 0, S, S);
    for (let i = 0; i < 34; i++) { g.fillStyle = 'rgba(255,240,200,.09)'; g.fillRect((i * 13) % S, (i * 7) % S, 1, 1); }
    const spr = frameSprite(Object.assign({}, o, { small: 0 }), 'down', 0);
    const k = Math.max(1, Math.ceil(S * .94 / W)), crop = 31;
    const big = cv(W * k, crop * k), bg = ctx(big);
    bg.imageSmoothingEnabled = false;
    bg.drawImage(spr, 0, 0, W, crop, 0, 0, W * k, crop * k);
    const dw = S * .94, dh = dw * crop / W;
    g.imageSmoothingEnabled = dw < W * k;
    g.drawImage(big, (S - dw) / 2, S * .05, dw, dh);
    pcache[key] = c;
    return c;
  }

  /* ---------------- inventory icons ---------------- */
  const ICONS = {};
  const icon = (n, w, h, draw) => { ICONS[n] = () => { const c = cv(w, h), g = ctx(c); draw(g); return edge(c, 'rgba(20,14,16,.8)'); }; };
  icon('coin', 20, 20, g => { px(g, 4, 4, 12, 12, '#d9b64a'); px(g, 4, 4, 12, 2, '#f0d47a'); px(g, 4, 14, 12, 2, '#9c7a22'); px(g, 8, 7, 4, 6, '#9c7a22'); px(g, 6, 6, 2, 1, '#fff0b0'); });
  icon('scroll', 20, 20, g => { px(g, 4, 3, 12, 14, '#e6d6b0'); px(g, 3, 2, 14, 3, '#c9b48a'); px(g, 3, 16, 14, 3, '#c9b48a'); for (let y = 6; y < 15; y += 3) px(g, 6, y, 8, 1, '#8a7a5a'); });
  icon('sword', 20, 20, g => { px(g, 9, 2, 2, 11, '#c3cad1'); px(g, 10, 2, 1, 11, '#eef3f6'); px(g, 6, 13, 8, 2, '#8a6a3c'); px(g, 9, 15, 2, 4, '#5b3a22'); });
  icon('shield', 20, 20, g => { px(g, 4, 3, 12, 12, '#8f4a34'); px(g, 4, 3, 12, 2, '#b06a4a'); px(g, 6, 6, 8, 8, '#a8762c'); px(g, 8, 8, 4, 4, '#d9b64a'); px(g, 4, 14, 12, 2, '#5b2f22'); });
  icon('eagle', 20, 20, g => { px(g, 8, 8, 4, 8, '#d9b64a'); px(g, 4, 6, 4, 4, '#c9a227'); px(g, 12, 6, 4, 4, '#c9a227'); px(g, 9, 4, 2, 4, '#e0c46a'); px(g, 6, 4, 8, 2, '#e0c46a'); });
  icon('helmet', 20, 20, g => { px(g, 5, 6, 10, 9, '#b9c0c6'); px(g, 5, 6, 10, 2, '#dfe6ea'); px(g, 5, 14, 10, 2, '#78828c'); px(g, 8, 2, 4, 4, '#8a2f2a'); });
  icon('amphora', 20, 20, g => { px(g, 8, 2, 4, 3, '#a8562f'); px(g, 5, 5, 10, 10, '#b4623c'); px(g, 6, 5, 2, 10, '#c97a52'); px(g, 7, 15, 6, 3, '#8a4a2c'); });
  icon('wine', 20, 20, g => { px(g, 5, 4, 10, 4, '#8a4a2c'); px(g, 6, 8, 8, 9, '#c9a24a'); px(g, 7, 9, 6, 7, '#8a2f3a'); px(g, 6, 8, 8, 1, '#e0c46a'); });
  icon('laurel', 20, 20, g => { for (let i = 0; i < 8; i++) { const a = i / 8 * 6.28; px(g, 10 + Math.cos(a) * 6, 10 + Math.sin(a) * 6, 3, 2, i % 2 ? '#6b8f3c' : '#8fae52'); } });
  icon('bread', 20, 20, g => { px(g, 3, 8, 14, 8, '#c9a24a'); px(g, 3, 8, 14, 2, '#e0c06a'); px(g, 5, 6, 10, 3, '#d8b45a'); px(g, 6, 10, 2, 1, '#a8862f'); px(g, 11, 12, 2, 1, '#a8862f'); });
  icon('key', 20, 20, g => { px(g, 4, 8, 6, 6, '#c9a24a'); px(g, 6, 10, 2, 2, '#5b4326'); px(g, 10, 10, 7, 2, '#c9a24a'); px(g, 15, 12, 2, 3, '#c9a24a'); px(g, 12, 12, 2, 2, '#c9a24a'); });
  icon('tablet', 20, 20, g => { px(g, 3, 4, 14, 12, '#e6dcc4'); px(g, 3, 4, 14, 3, '#c9b48a'); for (let y = 8; y < 15; y += 2) px(g, 5, y, 10, 1, '#8a7a5a'); px(g, 3, 16, 14, 2, '#b5a888'); });
  icon('ring', 20, 20, g => { px(g, 6, 9, 8, 6, '#d9b64a'); px(g, 8, 11, 4, 2, 'rgba(0,0,0,0)'); px(g, 8, 5, 4, 4, '#8fc0cc'); px(g, 9, 6, 2, 2, '#e0f4f8'); });
  icon('heart', 20, 20, g => { px(g, 4, 6, 5, 5, '#b03a3a'); px(g, 11, 6, 5, 5, '#b03a3a'); px(g, 5, 9, 10, 5, '#b03a3a'); px(g, 7, 13, 6, 2, '#b03a3a'); px(g, 6, 7, 2, 2, '#d97070'); });
  icon('star', 20, 20, g => { px(g, 9, 2, 2, 16, '#e0c46a'); px(g, 2, 9, 16, 2, '#e0c46a'); px(g, 5, 5, 3, 3, '#f4d489'); px(g, 12, 5, 3, 3, '#f4d489'); px(g, 5, 12, 3, 3, '#f4d489'); px(g, 12, 12, 3, 3, '#f4d489'); });
  const item = n => ICONS[n] ? ICONS[n]() : null;

  /* ---------------- little effects ---------------- */
  const FX = {};
  const fx = (n, w, h, frames, draw) => { FX[n] = { frames: frames, w, h, draw }; };
  fx('dust', 12, 8, 4, (g, i) => { for (let k = 0; k < 4; k++) { const a = k / 4 * 6.28 + i; px(g, 6 + Math.cos(a) * (1 + i), 5 + Math.sin(a) * (1 + i * .4), 2, 1, 'rgba(200,186,154,' + (0.5 - i * .1) + ')'); } });
  fx('spark', 10, 10, 4, (g, i) => { px(g, 5 - i / 2, 5 - i / 2, 1 + i, 1 + i, 'rgba(255,226,150,' + (0.9 - i * .2) + ')'); });
  fx('coin', 10, 12, 5, (g, i) => { px(g, 4, 2 + i, 3, 2, i > 2 ? 'rgba(217,182,74,0)' : '#e0c46a'); });
  fx('blood', 10, 8, 4, (g, i) => { px(g, 4, 3, 1 + i, 1 + (i >> 1), 'rgba(140,30,30,' + (0.8 - i * .18) + ')'); });
  const fxCache = {};
  function effect(n) {
    if (fxCache[n]) return fxCache[n];
    const d = FX[n]; if (!d) return null;
    const out = [];
    for (let i = 0; i < d.frames; i++) { const c = cv(d.w, d.h); d.draw(ctx(c), i); out.push(c); }
    fxCache[n] = out; return out;
  }
  /* a soft lamp glow, drawn under the night overlay so torches light the street */
  const glowCache = {};
  function glow(r, col) {
    const key = r + (col || '');
    if (glowCache[key]) return glowCache[key];
    const c = cv(r * 2, r * 2), g = ctx(c);
    const grd = g.createRadialGradient(r, r, 0, r, r, r);
    grd.addColorStop(0, (col || 'rgba(255,200,110,') + '.55)');
    grd.addColorStop(.45, (col || 'rgba(255,200,110,') + '.22)');
    grd.addColorStop(1, (col || 'rgba(255,200,110,') + '0)');
    g.fillStyle = grd; g.beginPath(); g.arc(r, r, r, 0, 6.3); g.fill();
    glowCache[key] = c; return c;
  }

  return {
    T, W, H, FOOT, look, folk, portrait, item, effect, glow, troop,
    cv: B.cv, ctx: B.ctx, px: B.px, shade: B.shade, mix: B.mix, edge: B.edge, ramp: B.ramp,
    tiles: window.PIXWORLD.tiles, facade: window.PIXWORLD.facade, prop: window.PIXWORLD.prop,
    get VARS() { return window.PIXWORLD.VARS; }
  };
})();

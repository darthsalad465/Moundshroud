/* FIELD — a battle you stand in. The old board moved blocks one square a turn. This is a field a mile wide where
   every soldier is a body: he has a position, a velocity and a mass, he walks to his place in the formation, he
   turns to face the man in front of him, and when two lines meet they push. A horse at a gallop carries two and a
   half times a man's weight at three times his speed, so a charge into a flank throws men down and breaks the line,
   and a charge into braced spears breaks the horse. Shields only work toward the front. Arrows are fired, not
   rolled: they leave the bow at the angle that will carry them to where the target will be, the wind drifts them,
   gravity brings them down, and whoever is standing there when they land is hit, friend or enemy. Ground matters:
   uphill men strike harder, woods slow a formation and pull it apart, and the river can only be crossed well at the
   fords. Every unit has morale and fatigue; men who have seen too much run, and a general who rides up and shouts
   can sometimes bring them back.

   You are on the field yourself: walk your general with WASD, fight with your sword (Space), raise your shield (Q),
   roll out of trouble (C) and rally the wavering (R). Command with the number keys and the right mouse button, and
   press P to stop time and think. Before it starts, you place your units on the ground the way you would set up a
   board.

   The simulation never touches the page: FIELD.simulate() runs the same battle with nobody watching, for the tests. */
window.FIELD = (() => {
  'use strict';
  const FW = 1800, FH = 1100, G = 420, STEP = 1 / 60, CELL = 32;
  /* how long a man lasts in the press. Real lines pushed and shoved for an hour; one blow in three was turned by the
     armour or landed on a shield rim, so a soldier here takes several before he goes down (tuned so a battle runs
     two to four minutes, long enough to command) */
  const HARD = 4;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rnd = (a, b) => a + Math.random() * (b - a);
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const angDiff = (a, b) => { let d = (a - b) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return Math.abs(d); };

  /* what each kind of soldier is made of: radius, mass, men per figure on the field, how much of a blow a shield
     turns from the front, whether he carries a spear to brace, a horse, a missile, and how fast he walks */
  const BODY = {
    legion: { r: 5, mass: 1.25, n: 24, shield: .55, missile: 'pilum', speed: 46 },
    guard: { r: 5.2, mass: 1.35, n: 18, shield: .6, missile: 'pilum', speed: 48 },
    aux: { r: 4.6, mass: .9, n: 18, shield: .12, missile: 'arrow', range: 270, speed: 50, loose: 1 },
    horse: { r: 7, mass: 3, n: 12, horse: 1, shield: .25, speed: 98 },
    elephant: { r: 12, mass: 12, n: 4, speed: 54, fear: 1, shield: 0 },
    warband: { r: 5, mass: 1.1, n: 24, shield: .3, speed: 54 },
    horde: { r: 5, mass: 1, n: 30, shield: .15, speed: 58 },
    phalanx: { r: 5, mass: 1.2, n: 24, shield: .42, spear: 1, rigid: 1, speed: 38 },
    horsearcher: { r: 7, mass: 2.4, n: 10, horse: 1, missile: 'arrow', range: 240, speed: 108, skirmish: 1 },
    numidian: { r: 6.5, mass: 2.2, n: 10, horse: 1, missile: 'javelin', range: 120, speed: 112, skirmish: 1 }
  };
  const bodyOf = t => Object.assign({ r: 5, mass: 1.1, n: 20, shield: .3, speed: 48 }, BODY[t] || {});
  const supported = list => (list || []).every(x => BODY[typeof x === 'string' ? x : x.type]);

  /* ============================ the ground ============================ */
  function ground(kind) {
    const T = { kind, hills: [], woods: [], river: kind === 'river' };
    const nh = kind === 'hills' ? 6 : kind === 'woods' ? 2 : 3;
    for (let i = 0; i < nh; i++) T.hills.push({ x: rnd(.15, .85) * FW, y: rnd(.1, .9) * FH, r: rnd(140, 260), h: kind === 'hills' ? rnd(.7, 1.2) : rnd(.2, .4) });
    if (kind === 'woods') for (let i = 0; i < 6; i++) T.woods.push({ x: rnd(.25, .75) * FW, y: rnd(.08, .92) * FH, r: rnd(60, 120) });
    else if (kind === 'plain') for (let i = 0; i < 2; i++) T.woods.push({ x: rnd(.35, .65) * FW, y: (i ? rnd(.82, .95) : rnd(.05, .18)) * FH, r: rnd(50, 80) });
    T.fords = [FH * .28, FH * .72];
    T.height = (x, y) => T.hills.reduce((a, h) => a + h.h * Math.exp(-((x - h.x) ** 2 + (y - h.y) ** 2) / (h.r * h.r)), 0);
    T.riverX = y => FW * .5 + 60 * Math.sin(y / 180);
    T.inRiver = (x, y) => T.river && Math.abs(x - T.riverX(y)) < 26 && !T.fords.some(f => Math.abs(y - f) < 55);
    T.inWood = (x, y) => T.woods.some(w => (x - w.x) ** 2 + (y - w.y) ** 2 < w.r * w.r);
    T.slow = (x, y) => (T.inRiver(x, y) ? .32 : 1) * (T.inWood(x, y) ? .62 : 1);
    return T;
  }

  /* ============================ the armies ============================ */
  let uid = 0;
  function makeUnit(B, side, spec, mods, i) {
    const type = typeof spec === 'string' ? spec : spec.type, d = window.IMP.UNITS[type]; if (!d) return null;
    const b = bodyOf(type), m = Object.assign({}, mods || {}, (spec && spec.mods) || {});
    const q = m.quality || 1, n = Math.max(3, Math.round(b.n * clamp(q, .6, 1.6)));
    const u = {
      id: side + (uid++), side, type, body: b, name: (spec && spec.who ? spec.who + '’s ' : '') + d.n, ic: d.ic,
      atk: d.atk * (m.atk || 1), def: d.def, morale: clamp(d.morale + (m.morale || 0), 20, 100), base: clamp(d.morale + (m.morale || 0), 20, 100),
      n0: n, menPer: d.men / b.n, fatigue: 0, routed: false, testudo: false, pila: b.missile === 'pilum' ? 1 : 0, shieldBroken: 0,
      order: { kind: 'hold' }, face: side === 'me' ? 0 : Math.PI, cx: 0, cy: 0, soldiers: [], idx: i, lastHit: 0, sel: false, hpMul: clamp(q, .7, 1.8)
    };
    u.cols = b.horse ? Math.ceil(n / 2) : b.loose ? Math.ceil(n / 2) : type === 'elephant' ? n : Math.ceil(n / 3);
    return u;
  }
  /* the line the way a Roman general draws it up: heavy foot in the middle, archers behind, horse on the wings */
  function deploy(B, side, list, mods) {
    const out = [], xFront = side === 'me' ? FW * .24 : FW * .76, dir = side === 'me' ? 1 : -1;
    let foot = 0, wing = 0;
    (list || []).forEach((spec, i) => {
      const u = makeUnit(B, side, spec, mods, i); if (!u) return;
      const b = u.body;
      if (b.horse || u.type === 'elephant') { u.cx = xFront - dir * 30; u.cy = wing % 2 ? FH * (.12 + Math.floor(wing / 2) * .1) : FH * (.88 - Math.floor(wing / 2) * .1); wing++; }
      else if (b.missile === 'arrow') { u.cx = xFront - dir * 110; u.cy = FH * .5 + (foot % 2 ? 1 : -1) * (40 + foot * 30); foot++; }
      else { const k = out.filter(x => !x.body.horse && x.body.missile !== 'arrow').length; u.cx = xFront; u.cy = FH * .5 + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 130; }
      u.cy = clamp(u.cy, 80, FH - 80);
      for (let s = 0; s < u.n0; s++) {
        const p = slot(u, s), sol = { u, i: s, slot: s, x: p.x + rnd(-2, 2), y: p.y + rnd(-2, 2), vx: 0, vy: 0, r: b.r, m: b.mass, hp: (8 + u.def * 1.2) * u.hpMul * HARD, face: u.face, cd: rnd(0, 1), alive: true, flash: 0, tgt: null };
        sol.maxhp = sol.hp; u.soldiers.push(sol);
      }
      out.push(u);
    });
    return out;
  }
  /* where the i-th man of a unit stands: rank and file behind the front line, turned to face the way the unit faces */
  function slot(u, i) {
    const b = u.body, cols = u.cols, r = Math.floor(i / cols), c = i % cols;
    const sp = (b.r * 2 + 3) * (b.loose ? 1.7 : 1) * (u.testudo ? .78 : 1);
    const lx = -r * sp, ly = (c - (cols - 1) / 2) * sp, co = Math.cos(u.face), si = Math.sin(u.face);
    return { x: u.cx + lx * co - ly * si, y: u.cy + lx * si + ly * co };
  }
  const alive = u => u.soldiers.some(s => s.alive);
  const live = u => u.soldiers.filter(s => s.alive);
  const centroid = u => { const l = live(u); if (!l.length) return { x: u.cx, y: u.cy }; let x = 0, y = 0; l.forEach(s => { x += s.x; y += s.y; }); return { x: x / l.length, y: y / l.length }; };

  /* ============================ the battle ============================ */
  function create(cfg, opts) {
    uid = 0;
    const B = {
      T: ground(cfg.terrain || 'plain'), t: 0, log: [], proj: [], fx: [], over: false, result: null, paused: false,
      wind: { x: rnd(-18, 18), y: rnd(-8, 8) }, decals: [], stats: {}, general: null, rallyAt: -99, aiAt: 0, endAt: 360, sounds: []
    };
    B.units = deploy(B, 'me', cfg.mine, cfg.mods).concat(deploy(B, 'foe', cfg.foe, cfg.foeMods));
    if (opts && opts.general) {
      const gu = { id: 'gen', side: 'me', type: 'general', body: { r: 6, mass: 1.5, shield: .7, speed: 120 }, atk: 13, def: 12, morale: 100, base: 100, n0: 1, menPer: 0, fatigue: 0, soldiers: [], order: { kind: 'hold' }, face: 0, gen: true };
      const hp = 150 * (1 + (opts.martial || 0) / 20);
      B.general = { u: gu, i: 0, x: FW * .2, y: FH * .5, vx: 0, vy: 0, r: 6, m: 1.5, hp, maxhp: hp, face: 0, cd: 0, alive: true, flash: 0, gen: true, st: 100, swing: 0, block: false, roll: 0, look: opts.look };
      gu.soldiers.push(B.general);
    }
    B.all = () => { const a = []; B.units.forEach(u => u.soldiers.forEach(s => { if (s.alive) a.push(s); })); if (B.general && B.general.alive) a.push(B.general); return a; };
    B.n = { me: B.units.filter(u => u.side === 'me').reduce((a, u) => a + u.n0, 0), foe: B.units.filter(u => u.side === 'foe').reduce((a, u) => a + u.n0, 0) };
    return B;
  }

  /* a coarse grid over the field so each man only looks at the men near him */
  function buildHash(B) {
    const h = new Map();
    B.all().forEach(s => { const k = ((s.x / CELL) | 0) * 4096 + ((s.y / CELL) | 0); let a = h.get(k); if (!a) h.set(k, a = []); a.push(s); });
    B.hash = h;
  }
  function near(B, x, y, rad, fn) {
    const x0 = ((x - rad) / CELL) | 0, x1 = ((x + rad) / CELL) | 0, y0 = ((y - rad) / CELL) | 0, y1 = ((y + rad) / CELL) | 0;
    for (let cx = x0; cx <= x1; cx++) for (let cy = y0; cy <= y1; cy++) { const a = B.hash.get(cx * 4096 + cy); if (a) for (let i = 0; i < a.length; i++) fn(a[i]); }
  }
  function nearestEnemy(B, s, rad) {
    let best = null, bd = rad * rad;
    near(B, s.x, s.y, rad, o => { if (!o.alive || o.u.side === s.u.side || o.u.routed) return; const d = (o.x - s.x) ** 2 + (o.y - s.y) ** 2; if (d < bd) { bd = d; best = o; } });
    return best;
  }
  const say = (B, t) => { B.log.push({ t: Math.round(B.t), text: t }); if (B.log.length > 60) B.log.shift(); };
  const sound = (B, n) => { if (B.sounds.length < 6) B.sounds.push(n); };

  /* ---------- a blow, a hit, a death ---------- */
  function hurt(B, d, dmg, from, how) {
    if (!d.alive) return;
    if (d.gen && (d.roll > 0)) return;                                      // the roll: for a moment, nothing touches you
    if (d.gen && d.block && from) { const toA = Math.atan2(from.y - d.y, from.x - d.x); if (angDiff(d.face, toA) < 1.1) { dmg *= .22; d.st = Math.max(0, d.st - 6); B.fx.push({ k: 'spark', x: d.x, y: d.y - 6, life: .2 }); } }
    d.hp -= dmg; d.flash = .16;
    const sk = d.u.side + ':' + (how || '?') + (from && from.u && from.u.side === d.u.side ? '-friendly' : ''); B.stats[sk] = (B.stats[sk] || 0) + dmg;   // where the blood went, for the tests
    if (Math.random() < .5) B.fx.push({ k: 'blood', x: d.x + rnd(-3, 3), y: d.y + rnd(-3, 3), life: .5 });
    if (d.hp > 0) return;
    d.alive = false;
    B.decals.push({ k: 'body', x: d.x, y: d.y, type: d.u.type, side: d.u.side, a: rnd(0, 6.28) });
    if (d.gen) { say(B, 'You are struck down and carried from the field. Your officers take command.'); B.units.filter(u => u.side === 'me').forEach(u => { u.morale -= 20; }); return; }
    const u = d.u, rear = how === 'rear';
    u.morale -= (75 / u.n0) * (rear ? 1.6 : 1) * (how === 'charge' ? 1.4 : 1);
    u.lastHit = B.t;
  }
  function melee(B, a, d) {
    const au = a.u, du = d.u;
    a.cd = rnd(1.1, 1.7) * (au.body.horse ? 1.15 : 1) / (1 - .3 * au.fatigue);
    const toA = Math.atan2(a.y - d.y, a.x - d.x), off = angDiff(d.face, toA);
    const where = off < 1.05 ? 'front' : off < 2.1 ? 'side' : 'rear';
    const hgt = (B.T.height(a.x, a.y) - B.T.height(d.x, d.y)) * .25;
    let hit = .58 + (au.atk - du.def) * .018 + (where === 'rear' ? .25 : where === 'side' ? .12 : 0) + hgt;
    if (B.T.inRiver(a.x, a.y)) hit -= .2;
    if (Math.random() > hit) return;
    /* a pike block is a wall only toward the front and only on flat open ground: on a slope or among trees it comes apart */
    const rough = du.body.rigid && (B.T.inWood(d.x, d.y) || Math.abs(B.T.height(d.x + 8, d.y) - B.T.height(d.x - 8, d.y)) + Math.abs(B.T.height(d.x, d.y + 8) - B.T.height(d.x, d.y - 8)) > .05);
    if (du.body.rigid) hit += rough ? .14 : 0;
    const block = (du.body.shield || 0) * (where === 'front' ? (rough ? .45 : 1) : where === 'side' ? (du.body.rigid ? 0 : .45) : 0) * (du.testudo ? 1.35 : 1) * (du.shieldBroken > B.t ? .4 : 1) * (d.gen && d.block ? 0 : 1);
    if (Math.random() < block) { if (Math.random() < .15) B.fx.push({ k: 'spark', x: (a.x + d.x) / 2, y: (a.y + d.y) / 2 - 4, life: .15 }); return; }
    const dmg = au.atk * .62 * rnd(.7, 1.3) * (1 - .35 * au.fatigue) * (where === 'rear' ? 1.6 : where === 'side' ? 1.25 : 1) * (1 + Math.max(0, hgt));
    hurt(B, d, dmg, a, where);
    if (Math.random() < .08) sound(B, 'sword');
  }

  /* ---------- missiles: fired at where the target will be, carried by the wind, pulled down by gravity ---------- */
  function fire(B, s, t, kind) {
    const d = dist(s, t), T = clamp(d / (kind === 'javelin' ? 300 : kind === 'pilum' ? 260 : 230), .3, 1.8);
    const err = d * (kind === 'arrow' ? .055 : .04) * (1 + s.u.fatigue), ex = (Math.random() + Math.random() - 1) * err, ey = (Math.random() + Math.random() - 1) * err;
    const tx = t.x + t.vx * T + ex, ty = t.y + t.vy * T + ey;
    B.proj.push({ x: s.x, y: s.y, z: 9, vx: (tx - s.x) / T - B.wind.x * T / 2, vy: (ty - s.y) / T - B.wind.y * T / 2, vz: G * T / 2 - 9 / T, side: s.u.side, kind, from: s });
  }
  function flyAll(B, dt) {
    for (let i = B.proj.length - 1; i >= 0; i--) {
      const p = B.proj[i];
      p.vx += B.wind.x * dt; p.vy += B.wind.y * dt; p.vz -= G * dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      if (p.z > 0) continue;
      B.proj.splice(i, 1);
      /* it lands: whoever is standing there is hit — an enemy if there is one, otherwise maybe a friend */
      let foe = null, friend = null, bf = 64, bfr = 30;
      near(B, p.x, p.y, 9, o => { if (!o.alive) return; const d2 = (o.x - p.x) ** 2 + (o.y - p.y) ** 2; if (o.u.side !== p.side && d2 < bf) { bf = d2; foe = o; } else if (o.u.side === p.side && d2 < bfr) { bfr = d2; friend = o; } });
      const hit = foe || (friend && Math.random() < .35 ? friend : null);
      if (!hit) { B.decals.push({ k: 'arrow', x: p.x, y: p.y, a: Math.atan2(p.vy, p.vx), pil: p.kind === 'pilum' }); continue; }
      const fromDir = Math.atan2(-p.vy, -p.vx), front = angDiff(hit.face, fromDir) < 1.15;
      const u = hit.u, shield = (u.body.shield || 0) * (front ? 1.25 : .2);
      const blocked = u.testudo ? Math.random() < .85 : (hit.gen && hit.block && front) ? true : Math.random() < shield;
      if (blocked) { if (p.kind === 'pilum') u.shieldBroken = B.t + 6; B.fx.push({ k: 'spark', x: hit.x, y: hit.y - 5, life: .12 }); continue; }
      hurt(B, hit, (p.kind === 'pilum' ? rnd(9, 13) : p.kind === 'javelin' ? rnd(6, 9) : rnd(4, 7)) * HARD * .55, p.from, 'missile');
    }
  }

  /* ---------- the general, under your hands ---------- */
  function swing(B) {
    const g = B.general; if (!g || !g.alive || g.swing > 0 || g.st < 8) return;
    g.swing = .48; g.st -= 16; g.swingT = B.t;
    let n = 0;
    near(B, g.x, g.y, 32, o => {
      if (!o.alive || o.u.side === 'me' || n >= 3) return;
      const d = dist(g, o), a = Math.atan2(o.y - g.y, o.x - g.x);
      if (d > 30 || angDiff(g.face, a) > 1.1) return;
      n++;
      hurt(B, o, rnd(10, 16) * (g.st > 10 ? 1 : .55), g, angDiff(o.face, Math.atan2(g.y - o.y, g.x - o.x)) > 2.1 ? 'rear' : 'front');
      o.vx += Math.cos(a) * 90 / o.m; o.vy += Math.sin(a) * 90 / o.m;          // the blow throws him back
    });
    sound(B, n ? 'sword' : 'click');
  }
  function roll(B, dx, dy) {
    const g = B.general; if (!g || !g.alive || g.roll > 0 || g.st < 20) return;
    const m = Math.hypot(dx, dy) || 1, a = m > .1 ? Math.atan2(dy, dx) : g.face;
    g.vx = Math.cos(a) * 340; g.vy = Math.sin(a) * 340; g.roll = .35; g.st -= 22;
  }
  function rally(B) {
    const g = B.general; if (!g || !g.alive || B.t - B.rallyAt < 20) return false;
    B.rallyAt = B.t; let n = 0;
    B.units.filter(u => u.side === 'me').forEach(u => {
      const c = centroid(u); if (Math.hypot(c.x - g.x, c.y - g.y) > 190 || !alive(u)) return;
      if (u.routed && live(u).length > u.n0 * .25) { u.routed = false; u.morale = 38; u.order = { kind: 'hold' }; u.cx = c.x; u.cy = c.y; n++; say(B, u.name + ' rallies to your standard.'); }
      else if (!u.routed) { u.morale = Math.min(100, u.morale + 25); n++; }
    });
    B.fx.push({ k: 'ring', x: g.x, y: g.y, life: .8 });
    sound(B, 'good');
    return n;
  }

  /* ---------- the commanders: yours follows your orders, theirs thinks for itself ---------- */
  function enemyMind(B) {
    const mine = B.units.filter(u => u.side === 'me' && alive(u) && !u.routed), foes = B.units.filter(u => u.side === 'foe' && alive(u) && !u.routed);
    if (!mine.length) return;
    foes.forEach(u => {
      const c = centroid(u), b = u.body;
      const near1 = mine.map(m => ({ m, c: centroid(m) })).sort((a, z) => Math.hypot(a.c.x - c.x, a.c.y - c.y) - Math.hypot(z.c.x - c.x, z.c.y - c.y))[0];
      const d = Math.hypot(near1.c.x - c.x, near1.c.y - c.y);
      if (b.skirmish) {                                                    // ride in, throw, ride away before the swords arrive
        if (d < 110) { const a = Math.atan2(c.y - near1.c.y, c.x - near1.c.x); u.order = { kind: 'move', x: clamp(c.x + Math.cos(a) * 160, 40, FW - 40), y: clamp(c.y + Math.sin(a) * 160, 40, FH - 40), run: 1 }; }
        else if (d > (b.range || 200) * .9) u.order = { kind: 'move', x: near1.c.x + (c.x > near1.c.x ? 1 : -1) * (b.range || 200) * .7, y: near1.c.y, run: 1 };
        else u.order = { kind: 'hold' };
      } else if (b.missile === 'arrow') {
        u.order = d > (b.range || 260) * .85 ? { kind: 'move', x: near1.c.x + (c.x > near1.c.x ? 1 : -1) * (b.range * .7), y: near1.c.y } : { kind: 'hold' };
      } else if (b.horse || u.type === 'elephant') {
        /* the horse goes round: the archers if it can reach them, otherwise the rear of the nearest line */
        const soft = mine.find(m => m.body.missile === 'arrow') || near1.m, sc = centroid(soft);
        const behind = { x: sc.x - Math.cos(soft.face) * 70, y: sc.y - Math.sin(soft.face) * 70 };
        const far = Math.hypot(behind.x - c.x, behind.y - c.y);
        u.order = far > 140 ? { kind: 'move', x: behind.x, y: behind.y + (behind.y > FH / 2 ? -90 : 90), run: 1 } : { kind: 'charge', target: soft.id };
      } else {
        const weak = mine.slice().sort((a, z) => (Math.hypot(centroid(a).x - c.x, centroid(a).y - c.y) + a.morale * 3) - (Math.hypot(centroid(z).x - c.x, centroid(z).y - c.y) + z.morale * 3))[0];
        /* the Gauls and the Germans close the last stretch at a dead run: the charge was their whole art of war */
        const wc = centroid(weak), wild = u.type === 'warband' || u.type === 'horde';
        u.order = { kind: wild && Math.hypot(wc.x - c.x, wc.y - c.y) < 170 ? 'charge' : 'attack', target: weak.id };
      }
    });
  }
  /* your units, when you have not told them anything: hold, and fight whatever reaches them; archers shoot at will */
  function autoMine(B) {
    B.units.filter(u => u.side === 'me' && alive(u) && !u.routed && u.order.kind === 'auto').forEach(u => {
      const foes = B.units.filter(f => f.side === 'foe' && alive(f) && !f.routed); if (!foes.length) return;
      const c = centroid(u), t = foes.sort((a, z) => Math.hypot(centroid(a).x - c.x, centroid(a).y - c.y) - Math.hypot(centroid(z).x - c.x, centroid(z).y - c.y))[0];
      u.order = { kind: 'auto', target: t.id, attack: 1 };
    });
  }

  /* ---------- one sixtieth of a second ---------- */
  function tick(B, dt, input) {
    if (B.over) return;
    B.t += dt;
    buildHash(B);
    if (B.t > B.aiAt) { B.aiAt = B.t + .6; enemyMind(B); autoMine(B); }
    /* each unit: where its formation stands, which way it faces, how tired and how frightened it is */
    B.units.forEach(u => {
      if (!alive(u)) return;
      const c = centroid(u), o = u.order, b = u.body;
      let tgt = o.target ? B.units.find(x => x.id === o.target) : null;
      if (tgt && (!alive(tgt) || tgt.routed)) { tgt = null; if (o.kind !== 'move') u.order = { kind: u.side === 'me' && o.kind !== 'auto' ? 'hold' : o.kind === 'auto' ? 'auto' : 'hold' }; }
      if (u.routed) { u.cx = u.side === 'me' ? -80 : FW + 80; u.cy = c.y; }
      else if (o.kind === 'move') {
        const dx = o.x - u.cx, dy = o.y - u.cy, dd = Math.hypot(dx, dy), sp = b.speed * (o.run ? 1.35 : 1) * dt * (1 - .4 * u.fatigue);
        if (dd > 3) { u.face = Math.atan2(dy, dx); u.cx += dx / dd * Math.min(sp, dd); u.cy += dy / dd * Math.min(sp, dd); }
        else { u.order = { kind: 'hold' }; if (o.faceTo) u.face = o.faceTo; }
      } else if (tgt) {
        const tc = centroid(tgt), dx = tc.x - u.cx, dy = tc.y - u.cy, dd = Math.hypot(dx, dy);
        const range = b.missile === 'arrow' || b.missile === 'javelin' ? (b.range || 200) * .8 : 0;
        u.face = Math.atan2(dy, dx);
        if (dd > range + 6) { const sp = b.speed * (o.kind === 'charge' ? 1.5 : 1) * dt * (1 - .4 * u.fatigue); u.cx += dx / dd * Math.min(sp, dd - range); u.cy += dy / dd * Math.min(sp, dd - range); }
      }
      u.cx = clamp(u.cx, -100, FW + 100); u.cy = clamp(u.cy, 20, FH - 20);
      /* fatigue: running and fighting tire, standing rests */
      const moving = o.kind === 'move' || (tgt && o.kind !== 'hold'), fighting = B.t - u.lastHit < 2;
      u.fatigue = clamp(u.fatigue + dt * ((o.run || o.kind === 'charge') ? .012 : moving ? .004 : -.01) + (fighting ? dt * .006 : 0), 0, .85);
      /* morale: losses already took theirs; the general nearby gives some back; elephants frighten; the broken flee */
      if (!u.routed) {
        if (B.general && B.general.alive && u.side === 'me' && Math.hypot(c.x - B.general.x, c.y - B.general.y) < 150) u.morale = Math.min(u.base, u.morale + dt * 3);
        else if (B.t - u.lastHit > 6) u.morale = Math.min(u.base, u.morale + dt * .8);
        if (u.type !== 'elephant') B.units.forEach(e => { if (e.type === 'elephant' && e.side !== u.side && alive(e) && !e.routed) { const ec = centroid(e); if (Math.hypot(ec.x - c.x, ec.y - c.y) < 110) u.morale -= dt * 2.2; } });
        if (u.morale < 16) {
          u.routed = true; say(B, (u.side === 'me' ? 'Your ' : 'The enemy’s ') + u.name + (u.name.endsWith('s') ? ' break and run!' : ' breaks and runs!'));
          B.units.forEach(f => { if (f !== u && f.side === u.side && alive(f)) { const fc = centroid(f); if (Math.hypot(fc.x - c.x, fc.y - c.y) < 230) f.morale -= 8; } });
        }
      }
      if (u.testudo && (o.kind === 'move' || o.kind === 'charge')) u.testudo = false;
    });
    /* each man */
    const all = B.all();
    for (let k = 0; k < all.length; k++) {
      const s = all[k], u = s.u, b = u.body;
      s.cd -= dt; s.mcd = (s.mcd || 0) - dt; s.flash -= dt;
      if (s.gen) { general(B, s, dt, input); continue; }
      let tx, ty, want = b.speed, contact = 0, foe = null;
      if (u.routed) { tx = u.cx; ty = s.y; want = b.speed * 1.4; }
      else {
        const o = u.order, engage = o.kind === 'attack' || o.kind === 'charge' || o.kind === 'auto' ? 70 : b.missile === 'arrow' ? 12 : 30;
        foe = s.tgt && s.tgt.alive && !s.tgt.u.routed && dist(s, s.tgt) < engage + 20 ? s.tgt : null;
        if (!foe || ((k + Math.floor(B.t * 60)) % 8 === 0)) foe = nearestEnemy(B, s, engage);
        s.tgt = foe;
        if (foe && !(o.kind === 'move' && o.force)) { tx = foe.x; ty = foe.y; contact = s.r + foe.r + 1.5; if (o.kind === 'charge') want *= 1.5; }
        else { const p = slot(u, s.slot); tx = p.x; ty = p.y; if (o.run) want *= 1.35; }
      }
      const dx = tx - s.x, dy = ty - s.y, d = Math.hypot(dx, dy) || 1;
      const spd = want * B.T.slow(s.x, s.y) * (1 - .45 * u.fatigue) * (d <= contact ? 0 : clamp((d - contact) / 26, .12, 1));
      const ax = (dx / d * spd - s.vx), ay = (dy / d * spd - s.vy), lim = 260 / Math.sqrt(s.m) * dt;
      const am = Math.hypot(ax, ay); s.vx += am > lim ? ax / am * lim : ax; s.vy += am > lim ? ay / am * lim : ay;
      if (foe && dist(s, foe) < 46) s.face = Math.atan2(foe.y - s.y, foe.x - s.x);
      else if (Math.hypot(s.vx, s.vy) > 10) s.face = Math.atan2(s.vy, s.vx);
      else s.face += angDiff(s.face, u.face) > .05 ? (((u.face - s.face + Math.PI * 3) % (Math.PI * 2)) - Math.PI) * dt * 3 : 0;
      /* a blow, if he is close enough and his arm is ready */
      if (foe && s.cd <= 0 && dist(s, foe) <= s.r + foe.r + 5) melee(B, s, foe);
      /* missiles: archers loose at will, legions throw their pila once when the enemy comes close */
      if (!u.routed && b.missile && s.mcd <= 0 && s.cd <= 0) {
        const range = b.missile === 'pilum' ? 85 : b.range || 200;
        if (b.missile !== 'pilum' || u.pila > 0) {
          const t = nearestEnemy(B, s, range);
          if (t && dist(s, t) > (b.missile === 'pilum' ? 18 : 22) && !(u.order.kind === 'move' && b.missile !== 'javelin')) {
            fire(B, s, t, b.missile); s.mcd = b.missile === 'arrow' ? rnd(2, 3) : b.missile === 'javelin' ? rnd(2.6, 3.4) : 99; s.cd = .8;   // the throw takes a moment; the sword is free again after it
            if (b.missile === 'pilum') { s.thrown = 1; if (u.soldiers.every(x => !x.alive || x.thrown)) u.pila = 0; }
            if (Math.random() < .12) sound(B, 'arrow');
          }
        }
      }
    }
    /* move everybody, then push apart anybody standing in somebody else: this is where a charge becomes a crush */
    all.forEach(s => {
      if (!s.alive) return;
      s.vx *= s.gen ? 1 : .985; s.vy *= s.gen ? 1 : .985;
      s.x += s.vx * dt; s.y += s.vy * dt;
      if (s.u.routed && (s.x < -40 || s.x > FW + 40)) { s.alive = false; s.fled = true; return; }
      if (!s.u.routed) { s.x = clamp(s.x, 4, FW - 4); }
      s.y = clamp(s.y, 4, FH - 4);
    });
    buildHash(B);
    all.forEach(a => {
      if (!a.alive) return;
      near(B, a.x, a.y, a.r + 13, b => {
        if (b === a || !b.alive || b.i < a.i && b.u === a.u) return;
        const dx = b.x - a.x, dy = b.y - a.y, rr = a.r + b.r, d2 = dx * dx + dy * dy;
        if (d2 >= rr * rr || d2 === 0) return;
        const d = Math.sqrt(d2), nx = dx / d, ny = dy / d, pen = rr - d, im = 1 / a.m + 1 / b.m;
        a.x -= nx * pen * (1 / a.m) / im; a.y -= ny * pen * (1 / a.m) / im;
        b.x += nx * pen * (1 / b.m) / im; b.y += ny * pen * (1 / b.m) / im;
        const vn = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
        if (vn >= 0) return;
        const j = -(1.08) * vn / im;
        a.vx -= j * nx / a.m; a.vy -= j * ny / a.m; b.vx += j * nx / b.m; b.vy += j * ny / b.m;
        /* a hard impact between enemies: the heavier, faster body does damage — unless it ran onto braced spears */
        if (a.u.side !== b.u.side && -vn > 55) {
          const [hit, by] = a.m * Math.hypot(a.vx, a.vy) > b.m * Math.hypot(b.vx, b.vy) ? [b, a] : [a, b];
          if (!by.u.body.horse && by.u.type !== 'elephant' && by.u.order.kind === 'charge' && -vn > 60) {
            hurt(B, hit, -vn * by.m * .05 * HARD * .5, by, 'charge');                     // a man at a run with his shoulder behind his shield
          } else if (by.u.body.horse || by.u.type === 'elephant') {
            const fromBy = Math.atan2(by.y - hit.y, by.x - hit.x), braced = hit.u.body.spear && angDiff(hit.face, fromBy) < 1 && !hit.u.routed;
            if (braced) { hurt(B, by, -vn * .12 * by.m * .5, hit, 'front'); sound(B, 'sword'); }
            else { hurt(B, hit, -vn * by.m * .032, by, angDiff(hit.face, fromBy) > 2.1 ? 'rear' : 'charge'); B.fx.push({ k: 'dust', x: hit.x, y: hit.y, life: .5 }); B.shake = Math.max(B.shake || 0, .25); }
          }
        }
      });
    });
    flyAll(B, dt);
    B.fx.forEach(f => { f.life -= dt; }); B.fx = B.fx.filter(f => f.life > 0);
    /* the end: one side has nobody left standing who has not run */
    if ((B.chk = (B.chk || 0) + dt) > .5) {
      B.chk = 0;
      const up = s => B.units.filter(u => u.side === s && alive(u) && !u.routed).length;
      if (!up('foe')) end(B, 'win'); else if (!up('me')) end(B, 'loss');
      else if (B.t > B.endAt) end(B, men(B, 'me') >= men(B, 'foe') ? 'win' : 'loss');
    }
  }
  const men = (B, side) => B.units.filter(u => u.side === side).reduce((a, u) => a + live(u).length * u.menPer, 0);
  function end(B, r) {
    B.over = true; B.result = r;
    const lost = B.units.filter(u => u.side === 'me').reduce((a, u) => a + u.soldiers.filter(s => !s.alive && !s.fled).length * u.menPer + u.soldiers.filter(s => s.fled).length * u.menPer * .3, 0);
    const killed = B.units.filter(u => u.side === 'foe').reduce((a, u) => a + u.soldiers.filter(s => !s.alive && !s.fled).length * u.menPer + u.soldiers.filter(s => s.fled).length * u.menPer * .3, 0);
    B.res = { result: r, lost: Math.round(lost), killed: Math.round(killed), rounds: Math.max(1, Math.round(B.t / 15)), seconds: Math.round(B.t), log: B.log };
  }

  /* the general's body: your keys, his stamina */
  function general(B, g, dt, input) {
    const k = (input && input.keys) || {};
    let ax = 0, ay = 0;
    if (k.a || k.arrowleft) ax -= 1; if (k.d || k.arrowright) ax += 1; if (k.w || k.arrowup) ay -= 1; if (k.s || k.arrowdown) ay += 1;
    const sprint = (k.shift) && g.st > 5 && (ax || ay);
    g.block = !!k.q && g.st > 2;
    g.roll = Math.max(0, g.roll - dt); g.swing = Math.max(0, g.swing - dt);
    const top = (sprint ? 175 : 110) * (g.block ? .5 : 1) * B.T.slow(g.x, g.y);
    if (g.roll <= 0) {
      const m = Math.hypot(ax, ay) || 1, tvx = ax / m * top * (ax || ay ? 1 : 0), tvy = ay / m * top * (ax || ay ? 1 : 0), kk = Math.min(1, dt * 12);
      g.vx += (tvx - g.vx) * kk; g.vy += (tvy - g.vy) * kk;
    }
    if (input && input.aim) g.face = Math.atan2(input.aim.y - g.y, input.aim.x - g.x);
    else if (ax || ay) g.face = Math.atan2(ay, ax);
    g.st = clamp(g.st + dt * (sprint ? -22 : g.block ? -4 : 20), 0, 100);
    g.lastMove = ax || ay;
  }

  /* ============================ watching it: the canvas and the controls ============================ */
  function start(cfg, host, onEnd) {
    const S = window.IMPERIUM && window.IMPERIUM.state;
    const look = cfg.look || (window.PIX ? window.PIX.look('general', { role: 'officer' }) : null);
    const B = create(cfg, { general: true, martial: S && S.attrs ? S.attrs.martial : 4, look });
    api.live = { B, begin: () => begin(), run: sec => { for (let i = 0; i < sec * 60 && !B.over; i++) tick(B, STEP, { keys: {} }); } };   // a handle for the self-test and the console
    const sel = new Set(); let phase = 'deploy', zoom = 1.15, cam = { x: FW * .2, y: FH * .5 }, free = false, mouse = { x: 0, y: 0, wx: 0, wy: 0 }, keys = {}, raf = 0, last = 0, acc = 0, ended = false;
    host.innerHTML = '<div class="fld"><canvas id="fldc"></canvas><div class="fldtop"><b>' + (cfg.title || 'Battle') + '</b><span id="fldtime"></span><span id="fldmsg"></span></div>' +
      '<div class="fldgen"><div><i>Health</i><em><b id="fldhp"></b></em></div><div><i>Stamina</i><em><b id="fldst"></b></em></div><span id="fldwind"></span></div>' +
      '<div class="fldunits" id="fldunits"></div><canvas class="fldmini" id="fldmini" width="180" height="110"></canvas>' +
      '<div class="fldhelp" id="fldhelp"></div><div class="flddeploy" id="flddeploy"><b>Deploy your army</b><span>Click one of your units, then click where it should stand on your side of the field. When the line is right, begin.</span><button class="btn pri" id="fldgo">Begin the battle ▸</button><button class="btn tiny" id="fldclassic">Command it turn by turn instead</button></div>' +
      '<div class="fldlog" id="fldlog"></div></div>';
    const cv = host.querySelector('#fldc'), g = cv.getContext('2d'), mini = host.querySelector('#fldmini').getContext('2d');
    const $ = id => host.querySelector('#' + id);
    const resize = () => { cv.width = host.clientWidth; cv.height = host.clientHeight; };
    resize(); window.addEventListener('resize', resize);
    const groundArt = paintGround(B.T), decal = document.createElement('canvas'); decal.width = FW; decal.height = FH; const dg = decal.getContext('2d');
    let decalN = 0;
    const sprites = {};
    const spr = (u, f, v) => { const k = u.type + u.side + f + v; return sprites[k] || (sprites[k] = window.PIX.troop(u.type, u.side, f, v)); };
    const genSpr = window.PIX && look ? window.PIX.folk(look) : null;
    const help = () => { $('fldhelp').innerHTML = phase === 'deploy' ? '' : '<b>WASD</b> walk · <b>Shift</b> run · <b>Space</b> strike · <b>Q</b> shield · <b>C</b> roll · <b>R</b> rally · <b>1–9</b> pick a unit (<b>0</b> all) · <b>right-click</b> move / attack · <b>G</b> attack · <b>H</b> hold · <b>T</b> testudo · <b>F</b> charge · <b>P</b> pause · scroll to zoom'; };
    help();
    const myUnits = () => B.units.filter(u => u.side === 'me');
    function cards() {
      $('fldunits').innerHTML = myUnits().map((u, i) => {
        const l = live(u).length, src = spr(u, 0, 0);
        return '<div class="fldu' + (sel.has(u) ? ' on' : '') + (u.routed ? ' rout' : '') + (!l ? ' dead' : '') + '" data-i="' + i + '"><em>' + (i + 1) + '</em><img src="' + (src.__url || (src.__url = src.toDataURL())) + '" alt=""><div><b>' + u.name + '</b>' +
          '<span>' + Math.round(l * u.menPer) + ' men · ' + (u.routed ? 'ROUTED' : u.order.kind === 'move' ? 'moving' : u.order.kind === 'charge' ? 'charging' : u.order.kind === 'attack' || u.order.kind === 'auto' ? 'attacking' : u.testudo ? 'testudo' : 'holding') + '</span>' +
          '<i class="mor"><b style="width:' + clamp(u.morale, 0, 100) + '%"></b></i><i class="fat"><b style="width:' + (100 - u.fatigue * 100) + '%"></b></i></div></div>';
      }).join('');
      host.querySelectorAll('.fldu').forEach(el => el.onclick = ev => { const u = myUnits()[+el.dataset.i]; if (!ev.shiftKey) sel.clear(); sel.add(u); cards(); });
    }
    cards();
    const toWorld = (sx, sy) => ({ x: (sx - cv.width / 2) / zoom + cam.x, y: (sy - cv.height / 2) / zoom + cam.y });
    const pickUnit = (wx, wy, side) => { let best = null, bd = 26 * 26; B.units.forEach(u => { if (side && u.side !== side) return; u.soldiers.forEach(s => { if (!s.alive) return; const d = (s.x - wx) ** 2 + (s.y - wy) ** 2; if (d < bd) { bd = d; best = u; } }); }); return best; };
    const order = (o) => { sel.forEach(u => { if (alive(u) && !u.routed) { u.order = Object.assign({}, o); if (o.kind === 'move') { u.order.x = o.x + (u.cx - avgSel().x); u.order.y = o.y + (u.cy - avgSel().y); } } }); cards(); sfx('click'); };
    const avgSel = () => { let x = 0, y = 0, n = 0; sel.forEach(u => { x += u.cx; y += u.cy; n++; }); return { x: x / (n || 1), y: y / (n || 1) }; };
    const sfx = n => { try { window.ImpAudio && window.ImpAudio.sfx(n); } catch (e) { } };
    const flash = t => { const m = $('fldmsg'); m.textContent = t; m.classList.add('on'); clearTimeout(flash.tm); flash.tm = setTimeout(() => m.classList.remove('on'), 1800); };

    /* the mouse: left picks, right commands; in deployment, left places */
    cv.addEventListener('contextmenu', e => e.preventDefault());
    cv.addEventListener('mousemove', e => { const r = cv.getBoundingClientRect(); mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top; const w = toWorld(mouse.x, mouse.y); mouse.wx = w.x; mouse.wy = w.y; });
    cv.addEventListener('mousedown', e => {
      const r = cv.getBoundingClientRect(), w = toWorld(e.clientX - r.left, e.clientY - r.top);
      if (phase === 'deploy') {
        const u = pickUnit(w.x, w.y, 'me');
        if (u) { sel.clear(); sel.add(u); cards(); return; }
        if (sel.size && w.x < FW * .38 && w.x > 30) { sel.forEach(su => { const dx = w.x - su.cx, dy = w.y - su.cy; su.cx = w.x; su.cy = clamp(w.y, 60, FH - 60); su.soldiers.forEach(s => { s.x += dx; s.y += dy; }); }); sfx('click'); }
        return;
      }
      if (e.button === 2) {
        if (!sel.size) return;
        const t = pickUnit(w.x, w.y, 'foe');
        if (t) { order({ kind: 'attack', target: t.id }); flash('Attack ' + t.name); }
        else { order({ kind: 'move', x: w.x, y: w.y, run: e.shiftKey ? 1 : 0, faceTo: Math.atan2(FH / 2 - w.y, (FW * .8) - w.x) }); B.fx.push({ k: 'mark', x: w.x, y: w.y, life: .6 }); }
        return;
      }
      const u = pickUnit(w.x, w.y, 'me');
      if (u) { if (!e.shiftKey) sel.clear(); sel.has(u) && e.shiftKey ? sel.delete(u) : sel.add(u); cards(); }
      else if (!e.shiftKey) { sel.clear(); cards(); swing(B); }
    });
    cv.addEventListener('wheel', e => { e.preventDefault(); zoom = clamp(zoom * (e.deltaY < 0 ? 1.1 : .9), .45, 2.2); }, { passive: false });
    /* the keys belong to the battle while it lasts: the city's keys (journal, map...) stay quiet */
    const kd = e => {
      if (e.target && /^(INPUT|TEXTAREA)$/.test(e.target.tagName)) return;
      const k = e.key.toLowerCase(); e.stopImmediatePropagation();
      if ([' ', 'w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'tab'].includes(k)) e.preventDefault();
      keys[k] = 1; if (e.shiftKey) keys.shift = 1;
      if (phase === 'deploy') { if (k === 'enter') begin(); return; }
      if (k === 'p' || k === 'tab') { B.paused = !B.paused; flash(B.paused ? 'Paused — give your orders' : 'Fight on'); }
      else if (k === ' ') swing(B);
      else if (k === 'c') roll(B, (keys.d ? 1 : 0) - (keys.a ? 1 : 0), (keys.s ? 1 : 0) - (keys.w ? 1 : 0));
      else if (k === 'r') { const n = rally(B); flash(n === false ? 'Your voice is hoarse — wait a little' : n ? 'You rally ' + n + ' unit' + (n > 1 ? 's' : '') : 'Nobody close enough to hear you'); }
      else if (k >= '1' && k <= '9') { const u = myUnits()[+k - 1]; if (u) { if (!e.shiftKey) sel.clear(); sel.add(u); cards(); } }
      else if (k === '0') { sel.clear(); myUnits().forEach(u => alive(u) && sel.add(u)); cards(); }
      else if (k === 'g') { sel.forEach(u => { u.order = { kind: 'auto' }; }); flash('Attack!'); cards(); }
      else if (k === 'h') { order({ kind: 'hold' }); flash('Hold the line'); }
      else if (k === 't') { sel.forEach(u => { if (u.type === 'legion' || u.type === 'guard') { u.testudo = !u.testudo; if (u.testudo) u.order = { kind: 'hold' }; } }); flash('Testudo'); cards(); }
      else if (k === 'f') { sel.forEach(u => { const c = centroid(u), t = B.units.filter(f => f.side === 'foe' && alive(f) && !f.routed).sort((a, z) => Math.hypot(centroid(a).x - c.x, centroid(a).y - c.y) - Math.hypot(centroid(z).x - c.x, centroid(z).y - c.y))[0]; if (t) u.order = { kind: 'charge', target: t.id }; }); flash('Charge!'); sfx('crowd'); cards(); }
      else if (k === 'escape') { sel.clear(); cards(); }
    };
    const ku = e => { const k = e.key.toLowerCase(); keys[k] = 0; if (k === 'shift') keys.shift = 0; e.stopImmediatePropagation(); };
    window.addEventListener('keydown', kd, true); window.addEventListener('keyup', ku, true);
    const blur = () => { keys = {}; }; window.addEventListener('blur', blur);
    function begin() { phase = 'go'; $('flddeploy').remove(); help(); myUnits().forEach(u => { u.order = { kind: 'hold' }; }); sfx('fanfare'); say(B, 'The trumpets sound. Wind from the ' + (B.wind.x > 0 ? 'west' : 'east') + '.'); }
    $('fldgo').onclick = begin;
    $('fldclassic').onclick = () => { cleanup(); host.innerHTML = ''; window.BattleSim.start(cfg, host, onEnd); };
    function cleanup() { try { if (window.ImpAudio && ImpAudio.intensity) ImpAudio.intensity(0); } catch (e) { } api.live = null; cancelAnimationFrame(raf); window.removeEventListener('keydown', kd, true); window.removeEventListener('keyup', ku, true); window.removeEventListener('blur', blur); window.removeEventListener('resize', resize); }

    function frame(t) {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(.1, (t - (last || t)) / 1000); last = t;
      if (phase === 'go' && !B.paused && !B.over) { acc += dt; let n = 0; while (acc >= STEP && n < 6) { tick(B, STEP, { keys, aim: null }); acc -= STEP; n++; } }
      B.sounds.splice(0).forEach(sfx);
      /* the camera stays on you; once you have fallen it can be walked about with the keys */
      const gen = B.general;
      if (gen && gen.alive) { cam.x += (gen.x - cam.x) * .12; cam.y += (gen.y - cam.y) * .12; }
      else { free = true; const sp = 600 * dt / zoom; if (keys.a || keys.arrowleft) cam.x -= sp; if (keys.d || keys.arrowright) cam.x += sp; if (keys.w || keys.arrowup) cam.y -= sp; if (keys.s || keys.arrowdown) cam.y += sp; }
      if (phase === 'deploy') { const sp = 500 * dt / zoom; if (keys.a) cam.x -= sp; if (keys.d) cam.x += sp; if (keys.w) cam.y -= sp; if (keys.s) cam.y += sp; }
      cam.x = clamp(cam.x, 0, FW); cam.y = clamp(cam.y, 0, FH);
      render(t);
      if (Math.floor(t / 400) !== frame.c) { frame.c = Math.floor(t / 400); cards(); hudBits(); }
      if (B.over && !ended) { ended = true; setTimeout(finish, 900); }
    }
    function hudBits() {
      const gn = B.general;
      $('fldhp').style.width = gn ? clamp(gn.hp / gn.maxhp * 100, 0, 100) + '%' : '0';
      $('fldst').style.width = gn ? clamp(gn.st, 0, 100) + '%' : '0';
      /* the music rises with the fighting: how many men are in contact right now */
      try { const all = B.all(), engaged = all.filter(s => s.tgt && s.tgt.alive && Math.hypot(s.x - s.tgt.x, s.y - s.tgt.y) < 30).length; if (window.ImpAudio && ImpAudio.intensity) ImpAudio.intensity(Math.min(1, .25 + engaged / Math.max(30, all.length * .45))); } catch (e) { }
      $('fldwind').textContent = 'Wind ' + (B.wind.x > 0 ? '→' : '←') + ' ' + Math.round(Math.hypot(B.wind.x, B.wind.y));
      const mm = Math.floor(B.t / 60), ss = Math.floor(B.t % 60);
      $('fldtime').textContent = (B.paused ? '⏸ PAUSED · ' : '') + mm + ':' + String(ss).padStart(2, '0') + ' · ' + Math.round(men(B, 'me')) + ' of yours, ' + Math.round(men(B, 'foe')) + ' of theirs';
      $('fldlog').innerHTML = B.log.slice(-4).map(l => '<div>' + l.text + '</div>').join('');
    }
    function render(t) {
      const W = cv.width, H = cv.height;
      g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = '#2a2a1c'; g.fillRect(0, 0, W, H);
      const sh = B.shake > 0 ? (B.shake -= .016, (Math.random() - .5) * 6) : 0;
      g.setTransform(zoom, 0, 0, zoom, W / 2 - cam.x * zoom + sh, H / 2 - cam.y * zoom + sh);
      g.imageSmoothingEnabled = false;
      g.drawImage(groundArt, 0, 0);
      /* the dead and the spent arrows stay where they fell, painted once into the ground */
      for (; decalN < B.decals.length; decalN++) paintDecal(dg, B.decals[decalN], spr);
      g.drawImage(decal, 0, 0);
      if (phase === 'deploy') { g.fillStyle = 'rgba(240,212,122,.08)'; g.fillRect(30, 0, FW * .38 - 30, FH); g.strokeStyle = 'rgba(240,212,122,.12)'; g.lineWidth = 1; for (let x = 30; x < FW * .38; x += 60) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, FH); g.stroke(); } for (let y = 0; y < FH; y += 60) { g.beginPath(); g.moveTo(30, y); g.lineTo(FW * .38, y); g.stroke(); } }
      /* selection under the feet, then every man, nearest the bottom drawn last */
      const list = B.all().sort((a, b) => a.y - b.y);
      sel.forEach(u => { g.fillStyle = 'rgba(240,212,122,.35)'; live(u).forEach(s => { g.beginPath(); g.ellipse(s.x, s.y + 1, s.r + 2, (s.r + 2) * .45, 0, 0, 6.3); g.fill(); }); });
      const time = performance.now() / 1000;
      list.forEach(s => {
        g.fillStyle = 'rgba(20,14,24,.3)'; g.beginPath(); g.ellipse(s.x + 2, s.y + 1, s.r + 1, (s.r + 1) * .45, 0, 0, 6.3); g.fill();
        if (s.gen) return drawGeneral(s, time);
        const u = s.u, moving = Math.hypot(s.vx, s.vy) > 8, f = moving ? Math.floor(time * 9 + s.i) % 4 : 0;
        const im = spr(u, f, s.i % 3), sc = u.type === 'elephant' ? .55 : u.body.horse ? .5 : .52, w = im.width * sc, h = im.height * sc;
        const left = Math.cos(s.face) < 0;
        g.save(); g.translate(s.x, s.y);
        if (u.routed) g.globalAlpha = .8;
        if (left) g.scale(-1, 1);
        if (moving) g.rotate(Math.sin(time * 12 + s.i) * .06);
        g.drawImage(im, -w / 2, -h + 2, w, h);
        if (s.flash > 0) { g.globalCompositeOperation = 'source-atop'; g.fillStyle = 'rgba(255,60,40,.5)'; g.fillRect(-w / 2, -h + 2, w, h); }
        g.restore();
      });
      /* banners: one per unit, over its middle, with its number */
      B.units.forEach((u, i) => {
        if (!alive(u)) return; const c = centroid(u), mineU = u.side === 'me';
        g.fillStyle = '#6a4a2a'; g.fillRect(c.x - 1, c.y - 40, 2, 26);
        g.fillStyle = u.routed ? '#777' : mineU ? '#c8402f' : '#3d63a8'; g.fillRect(c.x + 1, c.y - 40, 14, 10);
        if (mineU) { g.fillStyle = '#f6e7b8'; g.font = 'bold 9px sans-serif'; g.fillText(String(myUnits().indexOf(u) + 1), c.x + 5, c.y - 32); }
        if (u.testudo) { g.strokeStyle = 'rgba(240,212,122,.6)'; g.lineWidth = 1.5; g.strokeRect(c.x - 22, c.y - 14, 44, 24); }
      });
      /* missiles in the air: drawn up off the ground by their height, with a shadow where they will land */
      B.proj.forEach(p => {
        g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(p.x - 1, p.y - 1, 2, 2);
        const a = Math.atan2(p.vy - p.vz * .6, p.vx), L = p.kind === 'pilum' ? 10 : p.kind === 'javelin' ? 9 : 7;
        g.strokeStyle = p.kind === 'arrow' ? '#e8dcb8' : '#cfd5da'; g.lineWidth = p.kind === 'arrow' ? 1 : 1.6;
        g.beginPath(); g.moveTo(p.x, p.y - p.z); g.lineTo(p.x - Math.cos(a) * L, p.y - p.z - Math.sin(a) * L); g.stroke();
      });
      B.fx.forEach(f => {
        if (f.k === 'blood') { g.fillStyle = 'rgba(140,24,24,' + f.life + ')'; g.fillRect(f.x, f.y, 2, 2); }
        if (f.k === 'spark') { g.fillStyle = 'rgba(255,240,180,' + f.life * 5 + ')'; g.fillRect(f.x - 1, f.y - 1, 3, 3); }
        if (f.k === 'dust') { g.fillStyle = 'rgba(210,190,150,' + f.life * .6 + ')'; g.beginPath(); g.arc(f.x, f.y, 10 * (1.5 - f.life), 0, 6.3); g.fill(); }
        if (f.k === 'ring') { g.strokeStyle = 'rgba(240,212,122,' + f.life + ')'; g.lineWidth = 3; g.beginPath(); g.arc(f.x, f.y, 190 * (1 - f.life * .8), 0, 6.3); g.stroke(); }
        if (f.k === 'mark') { g.strokeStyle = 'rgba(240,212,122,' + f.life + ')'; g.lineWidth = 2; g.beginPath(); g.arc(f.x, f.y, 12 * (1.3 - f.life), 0, 6.3); g.stroke(); }
      });
      /* woods drawn over the men, so a unit in a wood is half hidden by it */
      B.T.woods.forEach(w => { for (let i = 0; i < 18; i++) { const a = i * 2.39996, rr = w.r * Math.sqrt((i + .5) / 18), x = w.x + Math.cos(a) * rr, y = w.y + Math.sin(a) * rr; g.fillStyle = 'rgba(30,58,26,.72)'; g.beginPath(); g.arc(x, y - 6, 13, 0, 6.3); g.fill(); g.fillStyle = 'rgba(72,110,52,.55)'; g.beginPath(); g.arc(x - 3, y - 10, 7, 0, 6.3); g.fill(); } });
      /* the aim line for orders, while a unit is selected */
      if (sel.size && phase === 'go') { g.strokeStyle = 'rgba(240,212,122,.25)'; g.setLineDash([4, 6]); const a = avgSel(); g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(mouse.wx, mouse.wy); g.stroke(); g.setLineDash([]); }
      if (B.paused) { g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = 'rgba(20,24,40,.25)'; g.fillRect(0, 0, W, H); }
      drawMini();
    }
    function drawGeneral(s, time) {
      const fr = genSpr ? genSpr[Math.cos(s.face) < 0 ? 'left' : 'right'][Math.hypot(s.vx, s.vy) > 10 ? Math.floor(time * 10) % 4 : 0] : null;
      g.strokeStyle = 'rgba(240,212,122,.85)'; g.lineWidth = 1.5; g.beginPath(); g.ellipse(s.x, s.y + 1, 10, 4.5, 0, 0, 6.3); g.stroke();
      if (fr) { g.save(); if (s.roll > 0) { g.translate(s.x, s.y - 8); g.rotate((1 - s.roll / .35) * 6.28); g.translate(-s.x, -(s.y - 8)); } g.drawImage(fr, s.x - 10, s.y - 27, 20, 29); g.restore(); }
      if (s.flash > 0) { g.fillStyle = 'rgba(255,60,40,.35)'; g.beginPath(); g.arc(s.x, s.y - 12, 11, 0, 6.3); g.fill(); }
      if (s.swing > .3) { g.strokeStyle = 'rgba(255,250,230,.85)'; g.lineWidth = 2.5; g.beginPath(); g.arc(s.x, s.y - 8, 22, s.face - 1.1 + (1 - (s.swing - .3) / .18) * 2.2 - .4, s.face - 1.1 + (1 - (s.swing - .3) / .18) * 2.2); g.stroke(); }
      if (s.block) { g.fillStyle = 'rgba(200,64,47,.9)'; g.fillRect(s.x + Math.cos(s.face) * 8 - 3, s.y - 16 + Math.sin(s.face) * 4, 6, 12); g.strokeStyle = '#e6c052'; g.strokeRect(s.x + Math.cos(s.face) * 8 - 3, s.y - 16 + Math.sin(s.face) * 4, 6, 12); }
    }
    function drawMini() {
      mini.fillStyle = '#3a3a24'; mini.fillRect(0, 0, 180, 110);
      const kx = 180 / FW, ky = 110 / FH;
      if (B.T.river) { mini.fillStyle = '#2e5566'; for (let y = 0; y < FH; y += 20) mini.fillRect(B.T.riverX(y) * kx - 2, y * ky, 4, 2); }
      B.T.woods.forEach(w => { mini.fillStyle = '#26401e'; mini.beginPath(); mini.arc(w.x * kx, w.y * ky, w.r * kx, 0, 6.3); mini.fill(); });
      B.units.forEach(u => { live(u).forEach(s => { mini.fillStyle = u.routed ? '#888' : u.side === 'me' ? '#e05a46' : '#6a8fd6'; mini.fillRect(s.x * kx, s.y * ky, 1.5, 1.5); }); });
      if (B.general && B.general.alive) { mini.fillStyle = '#f0d47a'; mini.fillRect(B.general.x * kx - 2, B.general.y * ky - 2, 4, 4); }
      mini.strokeStyle = 'rgba(255,255,255,.5)'; mini.strokeRect((cam.x - cv.width / 2 / zoom) * kx, (cam.y - cv.height / 2 / zoom) * ky, cv.width / zoom * kx, cv.height / zoom * ky);
    }
    function finish() {
      cleanup();
      const r = B.res;
      sfx(r.result === 'win' ? 'fanfare' : 'dirge');
      const box = document.createElement('div'); box.className = 'panelwrap';
      box.innerHTML = '<div class="panel card" style="width:min(520px,94vw)"><div class="ph"><h2>' + (r.result === 'win' ? (cfg.winHead || '🏆 Victory') : (cfg.loseHead || '💀 Defeat')) + '</h2></div><div class="pb">' +
        '<p style="margin:0 0 8px">' + (r.result === 'win' ? (cfg.winWord || 'The field is yours.') : (cfg.loseWord || 'Your line broke. What is left of the army is falling back in disorder.')) + ' It lasted ' + Math.floor(B.t / 60) + ' minutes ' + Math.floor(B.t % 60) + ' seconds.</p>' +
        '<div class="two small"><div>Our losses: <b>' + r.lost + ' men</b></div><div>Enemy losses: <b>' + r.killed + ' men</b></div>' + (B.general ? '<div>You: <b>' + (B.general.alive ? 'standing, ' + Math.round(B.general.hp / B.general.maxhp * 100) + '% health' : 'carried from the field') + '</b></div>' : '') + '</div>' +
        '<div class="row" style="margin-top:14px;justify-content:flex-end"><button class="btn pri" id="bend">Continue</button></div></div></div>';
      host.querySelector('.fld').appendChild(box);
      box.querySelector('#bend').onclick = () => { box.remove(); onEnd && onEnd(r); };
    }
    raf = requestAnimationFrame(frame);
    return () => { cleanup(); host.innerHTML = ''; };
  }

  /* the ground, painted once: grass with the light on the hills, woods' shade, the river and its fords */
  function paintGround(T) {
    const c = document.createElement('canvas'); c.width = FW; c.height = FH; const g = c.getContext('2d');
    const img = g.createImageData(FW, FH), d = img.data;
    for (let y = 0; y < FH; y++) for (let x = 0; x < FW; x++) {
      const h = T.height(x, y), hx = T.height(x + 3, y) - h, hy = T.height(x, y + 3) - h;
      const light = clamp(1 - (hx + hy) * 6, .65, 1.35), n = ((x * 73856093) ^ (y * 19349663)) & 15;
      let r = 86 + n, gg = 112 + n * 1.2, b = 58 + n * .5;
      if (T.kind === 'plain' || T.kind === 'woods') { r += 4; gg += 6; }
      r = r * light + h * 18; gg = gg * light + h * 14; b = b * light + h * 6;
      if (T.inRiver(x, y)) { r = 44; gg = 88; b = 104 + n; }
      else if (T.river && Math.abs(x - T.riverX(y)) < 30) { r = 150; gg = 136; b = 96; }
      const i = (y * FW + x) * 4; d[i] = r; d[i + 1] = gg; d[i + 2] = b; d[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    if (T.river) T.fords.forEach(f => { g.fillStyle = 'rgba(176,160,120,.75)'; g.fillRect(T.riverX(f) - 30, f - 55, 60, 110); });
    for (let i = 0; i < 2600; i++) { g.fillStyle = Math.random() < .5 ? 'rgba(60,90,40,.35)' : 'rgba(150,170,90,.25)'; g.fillRect(Math.random() * FW, Math.random() * FH, 1, 2); }
    T.woods.forEach(w => { const gr = g.createRadialGradient(w.x, w.y, 0, w.x, w.y, w.r * 1.1); gr.addColorStop(0, 'rgba(20,40,16,.55)'); gr.addColorStop(1, 'rgba(20,40,16,0)'); g.fillStyle = gr; g.fillRect(w.x - w.r * 1.2, w.y - w.r * 1.2, w.r * 2.4, w.r * 2.4); });
    return c;
  }
  function paintDecal(g, d, spr) {
    if (d.k === 'arrow') { g.strokeStyle = d.pil ? 'rgba(170,176,180,.8)' : 'rgba(200,190,160,.7)'; g.lineWidth = 1; g.beginPath(); g.moveTo(d.x, d.y); g.lineTo(d.x - Math.cos(d.a) * 4, d.y - Math.sin(d.a) * 4 - 3); g.stroke(); return; }
    g.fillStyle = 'rgba(110,20,20,.35)'; g.beginPath(); g.ellipse(d.x, d.y, 6, 3, d.a, 0, 6.3); g.fill();
    const im = spr({ type: d.type, side: d.side }, 0, 0); if (!im) return;
    const sc = d.type === 'elephant' ? .5 : .45;
    g.save(); g.translate(d.x, d.y); g.rotate(1.45); g.globalAlpha = .75; g.filter = 'grayscale(.5) brightness(.75)';
    g.drawImage(im, -im.width * sc / 2, -im.height * sc / 2, im.width * sc, im.height * sc); g.restore();
  }

  /* the same battle with nobody watching: both sides fight on their own, for the tests and for "let my legate do it" */
  function simulate(cfg, maxT) {
    const B = create(cfg, {});
    B.units.filter(u => u.side === 'me').forEach(u => { u.order = { kind: 'auto' }; });
    B.endAt = maxT || 360;
    while (!B.over && B.t < (maxT || 360) + 1) tick(B, STEP, null);
    if (!B.over) end(B, men(B, 'me') >= men(B, 'foe') ? 'win' : 'loss');
    return Object.assign({ seconds: Math.round(B.t), nMe: B.n.me, nFoe: B.n.foe }, B.res);
  }

  const api = { start, simulate, supported, create, tick, BODY, live: null };
  return api;
})();

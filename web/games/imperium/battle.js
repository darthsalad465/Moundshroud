/* IMPERIUM — the battlefield. A small tactical simulator: cohorts, archers, horse and elephants on a 14x8 field.
   Turn based. You give one order to each of your units, the enemy answers, casualties and morale are worked out,
   and a side breaks when its units rout. It can also be resolved instantly (BattleSim.auto) when a campaign is decided
   on the map instead of on the field. All of it is local, and the maths is seeded so a seed always fights the same way. */
window.BattleSim = (() => {
  const U = () => window.IMP.UNITS;
  const COLS = 14, ROWS = 8;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  /* the laws you carried are standing in the line too: veteran settlements, pay, roads and a grain dole all show up
     as men who are more or less willing to hold a position they were told to hold */
  function senateMorale() {
    try { const st = window.IMPERIUM && window.IMPERIUM.state; return (st && window.SENATE) ? window.SENATE.eff(st).morale : 0; } catch (e) { return 0; }
  }
  function makeUnit(side, type, x, y, mods) {
    const d = U()[type]; if (!d) return null;
    const q = (mods && mods.quality) || 1;
    const men = Math.round(d.men * q);
    return {
      id: side + '-' + type + '-' + Math.random().toString(36).slice(2, 6), side, type, x, y,
      n: d.n, ic: d.ic, men, max: men, word: d.word || 'men', kind: d.kind || null, morale: clamp(d.morale + ((mods && mods.morale) || 0) + (side === 'me' ? senateMorale() : 0), 20, 100),
      atk: d.atk * ((mods && mods.atk) || 1), def: d.def * ((mods && mods.def) || 1),
      spd: d.spd, range: d.range, menPer: d.menPer, acted: false, hit: false, routed: false,
      pila: type === 'legion' || type === 'guard' ? 1 : 0           // one volley of heavy javelins, thrown before the lines meet
    };
  }

  /* pick a sensible starting layout: infantry in front, missiles behind, horse on the wings.
     `close` is the arena: a war begins with two armies a day's march apart, a bout begins with two parties
     already inside the same square of sand, so nobody spends a quarter of the fight walking. */
  function deploy(side, list, mods, close) {
    const x0 = close ? (side === 'me' ? 5 : 8) : (side === 'me' ? 1 : COLS - 2), step = side === 'me' ? 1 : -1;
    const out = [], rows = [3, 4, 2, 5, 1, 6];
    let i = 0;
    list.forEach(spec => {
      const type = typeof spec === 'string' ? spec : spec.type;
      const d = U()[type]; if (!d) return;
      const rowsArr = d.range > 1 ? [1, 6, 2, 5] : (d.spd > 1 ? [0, 7, 3, 4] : rows);
      const y = rowsArr[i % rowsArr.length];
      const x = clamp(x0 + (d.range > 1 ? -step : 0) + Math.floor(i / rowsArr.length) * step * 0, 0, COLS - 1);
      const u = makeUnit(side, type, x, y, Object.assign({}, mods, spec && spec.mods));
      if (u) out.push(u);
      i++;
    });
    /* spread anything sharing a square */
    const seen = {};
    out.forEach(u => { const k = u.x + ',' + u.y; if (seen[k]) { for (let y = 0; y < ROWS; y++) if (!seen[u.x + ',' + y]) { u.y = y; break; } } seen[u.x + ',' + u.y] = 1; });
    return out;
  }

  const dist = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
  const alive = u => !u.routed && u.men > 0;
  const sideOf = (S, s) => S.units.filter(u => u.side === s && alive(u));

  function nearest(u, S) {
    let best = null, bd = 99;
    sideOf(S, u.side === 'me' ? 'foe' : 'me').forEach(f => { const d = dist(u, f); if (d < bd) { bd = d; best = f; } });
    return best;
  }
  function inRange(u, t) { return dist(u, t) <= u.range; }

  function terrainMod(S, u) {
    const t = S && S.terrain ? S.terrain : 'plain';
    if (t === 'hills' && u.y <= 2) return 1.12;
    if (t === 'woods' && (u.y === 0 || u.y === 7)) return 0.94;
    return 1;
  }

  /* one blow from a to d. `back` is set on the answering blow, so the two of them cannot trade for ever. */
  function strike(S, a, d, kind, back) {
    if (!alive(a) || !alive(d)) return;
    a.hit = true;
    const flank = Math.abs(a.y - d.y) >= 2 ? 1.28 : 1;
    const moraleF = 0.72 + (a.morale / 100) * 0.5;
    const power = a.atk * (a.men / 120) * moraleF * flank * terrainMod(S, a) * rnd(.82, 1.22) * (kind === 'charge' ? 1.3 : kind === 'volley' ? .72 : kind === 'pilum' ? 1.15 : 1);
    let losses = Math.max(4, Math.round(power * 3.4 / (1 + d.def / 12)));
    /* the testudo: shields locked overhead and in front. Arrows and javelins mostly bounce; a sword still finds a gap */
    if (d.testudo) losses = Math.max(2, Math.round(losses * (kind === 'volley' || kind === 'pilum' ? .35 : .72)));
    const real = Math.min(d.men, losses);
    d.men -= real;
    if (!back) { a.fx = 'atk'; d.fx = 'hurt'; }                    // the next drawing lunges one and flinches the other (not undone by the answering blow)
    (S.fxq = S.fxq || []).push({ a: a.id, d: d.id, kind: kind || 'attack', back: !!back });   // for the picture: what flew, and what clashed
    const shock = (real / d.max) * 120 * (kind === 'charge' ? 1.25 : 1) / (1 + d.def / 14);
    d.morale = clamp(d.morale - shock, 0, 100);
    a.morale = clamp(a.morale + 1.2, 0, 100);
    S.log.push({ who: a.side, a: a.n, d: d.n, n: real, kind: kind || 'attack', flank: flank > 1, rout: d.men <= 0 || d.morale <= 0 });
    if (d.men <= 0 || d.morale <= 0) {
      d.routed = true; d.men = Math.max(0, d.men);
      S.log.push({ who: a.side, a: a.n, d: d.n, n: 0, kind: 'rout' });
      sideOf(S, d.side).forEach(f => { f.morale = clamp(f.morale - 4, 0, 100); });
      return;
    }
    /* The answering blow. Nobody strikes for free: a man in the front rank who has not struck a blow yet hits back
       at whoever just reached him, so the accident of who moved first does not decide the battle. Arrows are not
       answered — the archers are twenty paces away and the swords are not. */
    if (!back && kind !== 'volley' && kind !== 'pilum' && dist(d, a) <= 1 && alive(d) && alive(a) && !d.hit) {
      d.acted = true;
      strike(S, d, a, d.spd > 1 ? 'charge' : 'attack', 1);
    }
  }

  function step(S, u) {
    const t = nearest(u, S); if (!t) return;
    const dx = Math.sign(t.x - u.x), dy = Math.sign(t.y - u.y);
    if (u.range > 1 && dist(u, t) <= u.range) return;               // missile troops hold their ground once in range
    const moves = u.spd;
    for (let i = 0; i < moves; i++) {
      if (dist(u, t) <= Math.max(1, u.range)) break;
      const nx = u.x + (Math.abs(t.x - u.x) >= Math.abs(t.y - u.y) ? dx : 0);
      const ny = u.y + (Math.abs(t.x - u.x) >= Math.abs(t.y - u.y) ? 0 : dy);
      if (nx >= 0 && nx < COLS) u.x = nx;
      if (ny >= 0 && ny < ROWS) u.y = ny;
    }
  }

  function order(S, u, what) {
    if (!alive(u) || u.acted) return;
    const t = nearest(u, S);
    if (what === 'hold') { u.morale = clamp(u.morale + 5, 0, 100); S.log.push({ who: u.side, a: u.n, kind: 'hold' }); }
    else if (what === 'rally') {
      sideOf(S, u.side).forEach(f => { f.morale = clamp(f.morale + 8, 0, 100); });
      S.log.push({ who: u.side, a: u.n, kind: 'rally' });
    } else if (what === 'testudo') {
      u.testudo = true; u.morale = clamp(u.morale + 3, 0, 100);
      S.log.push({ who: u.side, a: u.n, kind: 'testudo' });
    } else if (what === 'pilum') {
      const near = sideOf(S, u.side === 'me' ? 'foe' : 'me').filter(f => dist(u, f) <= 2).sort((p, q) => dist(u, p) - dist(u, q))[0];
      if (near && u.pila) { u.pila = 0; strike(S, u, near, 'pilum'); }
      else { step(S, u); S.log.push({ who: u.side, a: u.n, kind: 'advance' }); }
    } else if (what === 'advance') { step(S, u); S.log.push({ who: u.side, a: u.n, kind: 'advance' }); }
    else if (!t) { /* nothing to fight */ }
    else if (u.range > 1 && dist(u, t) <= u.range) strike(S, u, t, 'volley');
    else if (dist(u, t) <= 1) strike(S, u, t, 'attack');                 // already in contact: grind, do not charge
    else { step(S, u); if (dist(u, nearest(u, S) || t) <= u.range) strike(S, u, nearest(u, S) || t, u.spd > 1 ? 'charge' : u.range > 1 ? 'volley' : 'attack'); }
    u.acted = true;
    check(S);
  }

  function check(S) {
    if (S.over) return;
    const me = sideOf(S, 'me'), foe = sideOf(S, 'foe');
    if (!foe.length) { S.over = true; S.result = 'win'; }
    else if (!me.length) { S.over = true; S.result = 'loss'; }
    else if (S.round > 18) { S.over = true; S.result = me.reduce((a, u) => a + u.men, 0) >= foe.reduce((a, u) => a + u.men, 0) ? 'win' : 'loss'; }
  }

  /* the enemy: advance, shoot, and try to get round a flank. It picks on the weak: among the men it can reach it
     strikes the unit with the fewest left (a broken cohort routs sooner), archers shoot whoever is not hiding
     under shields, and only when nobody is in reach does it simply head for the nearest */
  function pickTarget(f, mine) {
    const reach = mine.filter(u => dist(f, u) <= Math.max(1, f.range));
    if (reach.length) return reach.sort((p, q) => (p.men * (p.testudo && f.range > 1 ? 3 : 1)) - (q.men * (q.testudo && f.range > 1 ? 3 : 1)))[0];
    return mine.reduce((a, u) => dist(f, u) < dist(f, a) ? u : a, mine[0]);
  }
  function enemyTurn(S) {
    const mine = sideOf(S, 'me');
    sideOf(S, 'foe').forEach(f => {
      if (!alive(f)) return;
      if (f.acted) return;                      // it already answered a blow this round; that was its turn
      const t = mine.length ? pickTarget(f, sideOf(S, 'me')) : null;
      if (!t) return;
      if (f.range > 1 && dist(f, t) <= f.range) { strike(S, f, t, 'volley'); f.acted = true; return; }
      if (dist(f, t) <= 1) { strike(S, f, t, 'attack'); f.acted = true; return; }
      step(S, f);
      if (dist(f, t) <= f.range) strike(S, f, t, f.spd > 1 ? 'charge' : f.range > 1 ? 'volley' : 'attack');
      f.acted = true;
      check(S);
    });
    finishRound(S);
  }

  /* The end of the round. Anybody standing in reach who has not struck a blow yet strikes now, both armies — so a
     cohort that spent its whole action closing the distance still gets its hit in, and a line that stands and
     waits is not hit for free. Without this the side that happened to move second won every fight. */
  function finishRound(S) {
    ['me', 'foe'].forEach(side => {
      sideOf(S, side).forEach(u => {
        if (u.hit || !alive(u)) return;
        const t = nearest(u, S);
        if (t && dist(u, t) <= u.range) strike(S, u, t, u.range > 1 ? 'volley' : 'attack');
      });
    });
    check(S);
  }

  /* ---------- instant resolution, for a campaign decided on the map ---------- */
  function auto(cfg) {
    const close = cfg.terrain === 'sand' || cfg.terrain === 'water';
    const S = { units: deploy('me', cfg.mine || ['legion'], cfg.mods, close).concat(deploy('foe', cfg.foe || ['warband'], cfg.foeMods, close)), round: 1, log: [], over: false, terrain: cfg.terrain };
    let guard = 0;
    while (!S.over && guard++ < 30) {
      sideOf(S, 'me').forEach(u => order(S, u, 'attack'));
      if (S.over) break;
      enemyTurn(S);
      S.units.forEach(u => { u.acted = false; u.hit = false; u.testudo = false; });
      S.round++;
      check(S);
    }
    const mine = S.units.filter(u => u.side === 'me'), foe = S.units.filter(u => u.side === 'foe');
    const lost = mine.reduce((a, u) => a + (u.max - u.men), 0), killed = foe.reduce((a, u) => a + (u.max - u.men), 0);
    return { result: S.result || 'loss', lost, killed, rounds: S.round, log: S.log.slice(-10) };
  }

  /* ---------- the visible battle ---------- */
  function start(cfg, host, onEnd) {
    const close = cfg.terrain === 'sand' || cfg.terrain === 'water';
    const S = {
      terrain: cfg.terrain || 'plain',
      units: deploy('me', cfg.mine || ['legion', 'aux'], cfg.mods, close).concat(deploy('foe', cfg.foe || ['warband'], cfg.foeMods, close)),
      round: 1, log: [], over: false, sel: null, awaiting: false
    };
    host.innerHTML = '<div id="battle"><div class="bhead"><div><div class="t">' + (cfg.title || 'Battle') + '</div><div class="sub">' + (cfg.sub || '') + '</div></div>' +
      '<span class="sp" style="flex:1"></span><div class="small" id="bround" style="color:#c9a227"></div></div>' +
      '<div style="flex:1;display:flex;min-height:0"><div style="flex:1;display:flex;flex-direction:column;min-width:0">' +
      '<div class="bfield" id="bf"></div><div class="orders" id="borders"></div></div><div class="blog" id="blog"></div></div></div>';
    const field = host.querySelector('#bf'), ord = host.querySelector('#borders'), logEl = host.querySelector('#blog');
    if (S.terrain === 'hills') field.innerHTML = '<div class="terr hill" style="left:6%;top:4%;width:26%;height:26%"></div><div class="terr hill" style="left:64%;top:62%;width:30%;height:28%"></div>';
    if (S.terrain === 'woods') field.innerHTML = '<div class="terr wood" style="left:10%;top:60%;width:22%;height:30%"></div><div class="terr wood" style="left:62%;top:6%;width:26%;height:26%"></div>';
    if (S.terrain === 'river') field.innerHTML = '<div class="terr river" style="left:47%;top:0;width:5%;height:100%"></div>';
    /* the arena floor: sand and its gates, or the flooded basin and the two slips at the ends */
    if (S.terrain === 'sand') field.innerHTML = '<div class="terr sandbank" style="left:3%;top:3%;width:94%;height:94%"></div>' +
      '<div class="terr gate" style="left:0;top:38%;width:5%;height:24%"></div><div class="terr gate" style="right:0;top:38%;width:5%;height:24%"></div>';
    if (S.terrain === 'water') field.innerHTML = '<div class="terr basin" style="left:4%;top:6%;width:92%;height:88%"></div>' +
      '<div class="terr quay" style="left:0;top:34%;width:7%;height:32%"></div><div class="terr quay" style="right:0;top:34%;width:7%;height:32%"></div>';

    const U = () => window.IMP.UNITS;
    /* A unit on the field is a little knot of chibi soldiers, not a badge. Each figure stands for a share of the
       men, so the knot thins as they fall; they lunge when they strike, flinch when they are hit and fall over when
       the unit routs. Every figure faces right; the enemy's whole knot is mirrored in CSS. */
    const srcs = {};
    const src = (type, side, v) => {
      const k = type + side + v;
      if (!(k in srcs)) { let s = null; try { const c = window.PIX && PIX.troop ? PIX.troop(type, side, 0, v) : null; if (c) s = { u: c.toDataURL(), w: c.width, h: c.height }; } catch (e) { } srcs[k] = s; }
      return srcs[k];
    };
    const squad = u => {
      const first = src(u.type, u.side, 0);
      if (!first) return '<div class="block">' + u.ic + '</div>';
      const big = first.w > 34;                                      // horses, elephants and ships take more room each
      const N = big ? 3 : 6, n = u.routed ? Math.min(2, N) : Math.max(1, Math.ceil(u.men / u.max * N));
      const spots = big ? [[30, 0], [2, 8], [34, 20]] : [[36, 0], [20, 2], [4, 4], [42, 17], [26, 19], [10, 21]];
      let h = '<div class="squad' + (u.fx ? ' ' + u.fx : '') + '"><i class="ban"></i>';
      for (let i = 0; i < n; i++) {
        const s = src(u.type, u.side, i % 3) || first, sc = big ? .62 : .78;
        h += '<img class="trp" src="' + s.u + '" style="left:' + spots[i][0] + 'px;top:' + spots[i][1] + 'px;width:' + Math.round(s.w * sc) + 'px;--d:' + (-(i * .19)).toFixed(2) + 's" alt="">';
      }
      return h + '</div>';
    };
    const draw = () => {
      field.querySelectorAll('.unit').forEach(e => e.remove());
      /* a knot is sized to its square, so a small window shrinks the soldiers instead of piling them on each other */
      const sk = Math.max(.5, Math.min(1.25, field.clientWidth / COLS / 70, field.clientHeight / ROWS / 74));
      field.style.setProperty('--sk', sk.toFixed(3));
      S.units.forEach(u => {
        const el = document.createElement('div');
        el.className = 'unit ' + u.side + (u.routed ? ' done routed' : '') + (S.sel === u.id ? ' sel' : '') + (u.acted ? ' done' : '') + (u.testudo ? ' testudo' : '');
        el.style.left = ((u.x + .5) / COLS * 100) + '%';
        el.style.top = ((u.y + .5) / ROWS * 100) + '%';
        el.dataset.id = u.id;
        el.innerHTML = squad(u) + '<div class="hp"><i style="width:' + Math.round(u.men / u.max * 100) + '%"></i></div>' +
          '<div class="lb">' + (u.routed ? (cfg.routedWord || 'routed') : u.n) + '</div><div class="mor">' + (u.routed ? '' : Math.round(u.men) + ' ' + u.word + ' · ' + Math.round(u.morale) + ' morale') + '</div>';
        field.appendChild(el);
      });
      /* the selected unit, if it is still one of yours and still standing (find() can miss after a rout) */
      const selU = S.units.find(u => u.id === S.sel);
      const can = (selU && selU.side === 'me' && !selU.routed && selU.men > 0) ? (S.selUnit = selU) : null;
      if (!can) S.selUnit = null;
      /* with nobody selected the round can still be ended: otherwise a rout of the selected unit, after the rest have
         moved, leaves the bar with no button on it and the battle looks frozen */
      ord.innerHTML = !can ? '<span class="hintbar"><span class="kbd">Click</span> one of your units to give it an order.</span><span style="flex:1"></span><button class="btn pri" data-o="end" ' + (S.over ? 'disabled' : '') + '>End round ▸</button>' :
        '<span class="small" style="color:#e0cfa8;margin-right:6px">' + can.n + ' —</span>' +
        '<button class="btn" data-o="advance">Advance</button>' +
        '<button class="btn" data-o="attack">Attack</button>' +
        (can.range > 1 ? '<button class="btn" data-o="volley">Volley</button>' : '') +
        (can.spd > 1 ? '<button class="btn" data-o="charge">Charge</button>' : '') +
        (can.pila ? '<button class="btn" data-o="pilum" title="Throw the heavy javelins at an enemy up to two squares away. Once per battle."' + (sideOf(S, 'foe').some(f => dist(can, f) <= 2) ? '' : ' disabled') + '>Pilum volley</button>' : '') +
        (can.type === 'legion' || can.type === 'guard' ? '<button class="btn" data-o="testudo" title="Lock shields overhead until the next round: arrows and javelins mostly bounce off, swords do less, and the unit does not move.">Testudo</button>' : '') +
        '<button class="btn" data-o="hold">Hold</button>' +
        (can.type === 'guard' || can.type === 'legion' ? '<button class="btn" data-o="rally">Rally the line</button>' : '') +
        '<span style="flex:1"></span><button class="btn pri" data-o="end" ' + (S.over ? 'disabled' : '') + '>End round ▸</button>';
      logEl.innerHTML = S.log.slice(-40).reverse().map(l => {
        if (l.kind === 'rout') return '<div class="r">💀 <b>' + l.d + '</b> breaks and runs.</div>';
        if (l.kind === 'hold') return '<div class="r">' + l.a + ' holds the line.</div>';
        if (l.kind === 'rally') return '<div class="r">📣 ' + l.a + ' rallies the line.</div>';
        if (l.kind === 'advance') return '<div class="r">' + l.a + ' advances.</div>';
        if (l.kind === 'testudo') return '<div class="r">🛡️ ' + l.a + ' locks shields: testudo.</div>';
        return '<div class="r">' + (l.kind === 'volley' ? '🏹' : l.kind === 'pilum' ? '🎯' : l.kind === 'charge' ? '🐎' : '⚔️') + ' ' + l.a + ' → ' + l.d + ': <b>' + l.n + '</b> lost' + (l.flank ? ' <span style="color:#c9a227">(flank)</span>' : '') + '</div>';
      }).join('');
      host.querySelector('#bround').textContent = 'Round ' + S.round + ' · ' + sideOf(S, 'me').length + ' vs ' + sideOf(S, 'foe').length;
    };
    const float = (u, txt) => {
      const el = document.createElement('div'); el.className = 'flat'; el.textContent = txt;
      el.style.left = ((u.x + .5) / COLS * 100) + '%'; el.style.top = ((u.y + .2) / ROWS * 100) + '%';
      field.appendChild(el); setTimeout(() => el.remove(), 1050);
    };
    const before = () => S.units.map(u => ({ id: u.id, men: u.men }));
    const flash = b => { S.units.forEach(u => { const o = b.find(x => x.id === u.id); if (o && o.men > u.men) float(u, '−' + Math.round(o.men - u.men)); }); playFx(); };
    /* What happened, shown: arrows arc across the field and stick, javelins go in a heavier, flatter flight, and
       where two lines meet there is a burst of dust; a cavalry charge shakes the whole field. Everything is played in
       the order the blows were struck, a beat apart. */
    const centre = u => ({ x: (u.x + .5) / COLS * field.clientWidth, y: (u.y + .5) / ROWS * field.clientHeight });
    const puff = (x, y, big) => { const p = document.createElement('div'); p.className = 'puff' + (big ? ' big' : ''); p.style.left = x + 'px'; p.style.top = y + 'px'; field.appendChild(p); setTimeout(() => p.remove(), 600); };
    const fly = (A, D, jav, k) => {
      const el = document.createElement('div'); el.className = 'proj' + (jav ? ' jav' : ''); field.appendChild(el);
      const j = () => (Math.random() - .5) * 22, sx = A.x + j(), sy = A.y + j(), ex = D.x + j(), ey = D.y + j();
      const arc = (jav ? 18 : 46) + Math.hypot(ex - sx, ey - sy) * (jav ? .06 : .16), frames = [];
      for (let i = 0; i <= 8; i++) {
        const t = i / 8, x = sx + (ex - sx) * t, y = sy + (ey - sy) * t - arc * 4 * t * (1 - t);
        const dx = ex - sx, dy = (ey - sy) - arc * 4 * (1 - 2 * t);
        frames.push({ transform: 'translate(' + x + 'px,' + y + 'px) rotate(' + Math.atan2(dy, dx) + 'rad)', opacity: t > .92 ? .6 : 1 });
      }
      if (!el.animate) { el.remove(); return; }
      const an = el.animate(frames, { duration: (jav ? 430 : 560) + k * 25, delay: k * 45, easing: 'linear', fill: 'forwards' });
      an.onfinish = () => { el.remove(); if (k % 2 === 0) puff(ex, ey, false); };
    };
    const shake = () => { field.classList.remove('shake'); void field.offsetWidth; field.classList.add('shake'); setTimeout(() => field.classList.remove('shake'), 380); };
    const sound = n => { try { ImpAudio.sfx(n); } catch (e) { } };
    function playFx() {
      const q = S.fxq || []; S.fxq = [];
      q.forEach((e, i) => setTimeout(() => {
        const a = S.units.find(u => u.id === e.a), d = S.units.find(u => u.id === e.d); if (!a || !d) return;
        const A = centre(a), D = centre(d);
        if (e.kind === 'volley' || e.kind === 'pilum') { const n = e.kind === 'pilum' ? 4 : 7; for (let k = 0; k < n; k++) fly(A, D, e.kind === 'pilum', k); sound('arrow'); }
        else { puff((A.x + D.x) / 2, (A.y + D.y) / 2, e.kind === 'charge'); if (!e.back) sound('sword'); if (e.kind === 'charge' && !e.back) shake(); }
      }, i * 160));
    }

    field.onclick = e => { const el = e.target.closest('.unit'); if (!el) return; const u = S.units.find(x => x.id === el.dataset.id); if (!u || u.side !== 'me' || u.routed) return; S.sel = u.id; draw(); };
    ord.onclick = async e => {
      const b = e.target.closest('[data-o]'); if (!b || S.over || S.awaiting) return;
      const what = b.dataset.o;
      if (what === 'end') {
        S.awaiting = true;
        const snap = before();
        S.units.forEach(x => { x.fx = null; });
        enemyTurn(S); flash(snap); draw();
        await new Promise(r => setTimeout(r, 420));
        S.units.forEach(u => { u.acted = false; u.hit = false; u.fx = null; u.testudo = false; }); S.round++;
        S.sel = (sideOf(S, 'me')[0] || {}).id;      // hand the next round to the first unit still standing
        check(S); draw();
        S.awaiting = false;
        if (S.over) return finish();
        return;
      }
      let u = S.units.find(x => x.id === S.sel); if (!u) { const first = sideOf(S, 'me').find(x => !x.acted); if (!first) return; u = first; S.sel = u.id; }
      if (u.acted) { /* already acted, pick the next one */ const nx = sideOf(S, 'me').find(x => !x.acted); if (nx) { S.sel = nx.id; draw(); } return; }
      const snap = before();
      S.units.forEach(x => { x.fx = null; });
      const want =what === 'attack' || what === 'charge' ? 'attack' : what === 'volley' ? 'attack' : what;
      order(S, u, want);
      flash(snap); draw();
      const nx = sideOf(S, 'me').find(x => !x.acted); if (nx) { S.sel = nx.id; draw(); }
      if (S.over) return finish();
    };
    function finish() {
      const mine = S.units.filter(u => u.side === 'me'), foe = S.units.filter(u => u.side === 'foe');
      const lost = mine.reduce((a, u) => a + (u.max - u.men), 0), killed = foe.reduce((a, u) => a + (u.max - u.men), 0);
      draw();
      ImpAudio.sfx(S.result === 'win' ? 'fanfare' : 'dirge');   // the horns get the last word, not the log
      const box = document.createElement('div');
      const W = cfg.lossWord || 'men', winW = cfg.winWord || 'The field is yours', loseW = cfg.loseWord || 'Your line broke. What is left of the army is falling back in disorder.';
      box.className = 'panelwrap';
      box.innerHTML = '<div class="panel card" style="width:min(520px,94vw)"><div class="ph"><h2>' + (S.result === 'win' ? (cfg.winHead || '🏆 Victory') : (cfg.loseHead || '💀 Defeat')) + '</h2></div><div class="pb">' +
        '<p style="margin:0 0 8px">' + (S.result === 'win' ? winW + ' It held after ' + S.round + ' rounds.' : loseW) + '</p>' +
        '<div class="two small"><div>Our losses: <b>' + lost + ' ' + W + '</b></div><div>Enemy losses: <b>' + killed + ' ' + W + '</b></div></div>' +
        '<div class="row" style="margin-top:14px;justify-content:flex-end"><button class="btn pri" id="bend">Continue</button></div></div></div>';
      host.appendChild(box);
      box.querySelector('#bend').onclick = () => { box.remove(); onEnd && onEnd({ result: S.result, lost, killed, rounds: S.round, log: S.log }); };
    }
    draw();
    S.sel = (sideOf(S, 'me')[0] || {}).id; draw();
    return () => { host.innerHTML = ''; };
  }

  return { start, auto, makeUnit, deploy, order, strike };
})();

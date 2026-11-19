// Entertainment > Germ Theory: an original outbreak strategy game. Design a germ, pick where it starts on a made-up world of twelve regions,
// then spend mutation points on spread, symptoms and defenses. Wipe out every region before the world finishes its cure. Autosaves.
// The simulation (P.germSim) has no DOM code, so tests can run it in Node.
(() => {
  const P = (typeof A !== 'undefined' && A.play) || (typeof window !== 'undefined' && window.__germP); if (!P) return;
  const KEY = 'germ_save', clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  // [name, x, y, population (millions), climate c/m/h, humid, wealth 1-3, airport, seaport]
  const REG = [
    ['Norrvik', 120, 72, 42, 'c', 0, 3, 1, 1], ['Kaskar Steppe', 345, 70, 95, 'c', 0, 1, 1, 0], ['Ostmark', 225, 150, 180, 'm', 0, 3, 1, 0],
    ['Velhaven', 95, 205, 120, 'm', 1, 2, 1, 1], ['Sardane', 255, 262, 210, 'h', 0, 1, 0, 0], ['Ombari Basin', 330, 352, 260, 'h', 1, 1, 0, 1],
    ['Qal Tirra', 455, 205, 150, 'h', 0, 2, 1, 1], ['Jinrai', 590, 125, 640, 'm', 1, 2, 1, 0], ['Tamsul Isles', 712, 262, 310, 'h', 1, 1, 1, 1],
    ['Hollowmere', 735, 52, 12, 'c', 0, 3, 1, 1], ['Lunaro', 570, 318, 160, 'm', 0, 3, 1, 1], ['Pellucid Reach', 445, 380, 230, 'h', 1, 2, 0, 1]];
  const LAND = [[0, 2], [0, 3], [2, 3], [2, 1], [2, 4], [3, 4], [4, 5], [4, 6], [1, 6], [1, 7], [6, 7], [5, 11], [6, 11], [11, 10], [7, 10]];
  const TYPES = {
    bacterium: { n: 'Bacterium', ic: '🦠', d: 'Tough and steady. Starts with Cold Resistance.', start: ['cold1'] },
    virus: { n: 'Virus', ic: '🧬', d: 'Spreads fast and mutates new symptoms by itself. The world researches it faster.', inf: 3, cure: 1.15, mutate: 1 },
    fungus: { n: 'Fungus', ic: '🍄', d: 'Struggles to cross borders, but the cure is slower and points come faster.', cross: .6, cure: .85, pts: 1.2 },
    parasite: { n: 'Parasite', ic: '🪱', d: 'Hard to notice: symptoms draw half the attention. Spreads a little slower.', inf: -1, vis: .5 } };
  const DIFF = { casual: { n: 'Casual', cure: .7, close: .6, pts: 1.3 }, normal: { n: 'Normal', cure: 1, close: 1, pts: 1 }, brutal: { n: 'Brutal', cure: 1.9, close: 2.2, pts: .8 } };
  // t: tree, c: cost, req: needs any one of these, e: effects
  const UPG = [
    ['touch', 'spread', 'Skin contact', '✋', 4, [], { inf: 1 }, 'Spreads through handshakes and shared surfaces.'],
    ['air1', 'spread', 'Airborne I', '💨', 7, [], { inf: 2, air: 1 }, 'Floats in the air. More cases travel on planes.'],
    ['air2', 'spread', 'Airborne II', '🌬️', 15, ['air1'], { inf: 3, air: 1 }, 'Lingers for hours in closed rooms and cabins.'],
    ['water1', 'spread', 'Waterborne I', '💧', 7, [], { inf: 2, water: 1 }, 'Survives in water. More cases travel on ships; better in humid regions.'],
    ['water2', 'spread', 'Waterborne II', '🌊', 15, ['water1'], { inf: 3, water: 1 }, 'Contaminates reservoirs and pipes.'],
    ['insect1', 'spread', 'Insect carriers I', '🦟', 9, [], { inf: 2, insect: 1 }, 'Mosquitoes carry it. Big boost in humid regions.'],
    ['insect2', 'spread', 'Insect carriers II', '🪰', 18, ['insect1'], { inf: 3, insect: 1 }, 'Every biting insect becomes a carrier.'],
    ['live1', 'spread', 'Livestock', '🐄', 8, [], { inf: 2, live: 1 }, 'Farm animals carry it. Boost in poorer, rural regions.'],
    ['live2', 'spread', 'Wild animals', '🦇', 16, ['live1'], { inf: 3, live: 1 }, 'Birds and bats carry it across borders.', { cross: .25 }],
    ['sneeze', 'sym', 'Sneezing', '🤧', 3, [], { inf: 1, sev: 1 }, 'More spread, a little more attention.'],
    ['cough', 'sym', 'Coughing', '😮‍💨', 4, [], { inf: 2, sev: 1 }, 'Spreads well in crowds.'],
    ['rash', 'sym', 'Rash', '🔴', 5, [], { inf: 2, sev: 2 }, 'Itchy skin passes it on by touch.'],
    ['fever', 'sym', 'Fever', '🌡️', 7, [], { inf: 1, sev: 3, leth: 1 }, 'People notice, and the weakest start to die.'],
    ['insomnia', 'sym', 'Insomnia', '😵', 4, [], { sev: 2 }, 'Tired people make mistakes. Mostly attention.'],
    ['pneu', 'sym', 'Pneumonia', '🫁', 12, ['cough'], { inf: 3, sev: 3, leth: 3 }, 'Lungs fill up. Deadly for many.'],
    ['delirium', 'sym', 'Delirium', '🌀', 15, ['fever', 'insomnia'], { sev: 5, leth: 3 }, 'Confused patients wander and spread it.', { inf: 1 }],
    ['bleed', 'sym', 'Internal bleeding', '🩸', 24, ['pneu', 'rash'], { inf: 4, sev: 6, leth: 7 }, 'Terrifying and very deadly.'],
    ['coma', 'sym', 'Coma', '💤', 20, ['delirium'], { sev: 4, leth: 6 }, 'Victims stop moving, then stop breathing.'],
    ['organ', 'sym', 'Organ failure', '💀', 32, ['bleed', 'coma'], { sev: 8, leth: 14 }, 'Almost nobody survives this.'],
    ['cold1', 'def', 'Cold resistance I', '❄️', 7, [], { cold: 1 }, 'Spreads better in cold regions.'],
    ['cold2', 'def', 'Cold resistance II', '🧊', 14, ['cold1'], { cold: 1 }, 'Cold regions no longer slow it much.'],
    ['heat1', 'def', 'Heat resistance I', '☀️', 7, [], { heat: 1 }, 'Spreads better in hot regions.'],
    ['heat2', 'def', 'Heat resistance II', '🔥', 14, ['heat1'], { heat: 1 }, 'Hot regions no longer slow it much.'],
    ['drug1', 'def', 'Drug resistance I', '💊', 10, [], { drug: 1 }, 'Rich regions with good medicine struggle to stop it.'],
    ['drug2', 'def', 'Drug resistance II', '🧪', 20, ['drug1'], { drug: 1 }, 'Even the best hospitals cannot slow it.'],
    ['hard', 'def', 'Hardened shell', '🛡️', 12, [], { hard: 1 }, 'Survives travel: border closures and quarantines work less well.'],
    ['shuf1', 'def', 'Gene shuffle I', '🎲', 15, [], { shuf: 1 }, 'Scientists lose ground: cure set back 3% and slowed.'],
    ['shuf2', 'def', 'Gene shuffle II', '🎰', 25, ['shuf1'], { shuf: 1 }, 'Cure set back 4% more and slowed further.'],
    ['shuf3', 'def', 'Gene shuffle III', '♾️', 40, ['shuf2'], { shuf: 1 }, 'Cure set back 5% more and slowed a lot.']
  ].map(u => ({ id: u[0], t: u[1], n: u[2], ic: u[3], c: u[4], req: u[5], e: Object.assign({}, u[6], u[8] || {}), d: u[7] }));
  const U = {}; UPG.forEach(u => U[u.id] = u);

  const sim = {
    REG, LAND, TYPES, DIFF, UPG,
    create(type, diff, name, rnd) {
      const S = { v: 1, type, diff, name: name || 'Strain X', day: 0, pts: 2, cure: 0, noticed: 0, nday: 0, own: [], over: 0, won: 0, news: [], seed: 0, hint0: 0,
        r: REG.map(g => ({ pop: g[3] * 1e6, inf: 0, dead: 0, air: g[7], port: g[8], bc: 0, q: 0, gone: 0 })) };
      (TYPES[type].start || []).forEach(id => S.own.push(id));
      return S;
    },
    stats(S) { const st = { inf: TYPES[S.type].inf || 0, sev: 0, leth: 0, air: 0, water: 0, insect: 0, live: 0, cold: 0, heat: 0, drug: 0, hard: 0, shuf: 0, cross: 0 };
      S.own.forEach(id => { const e = U[id].e; for (const k in e) st[k] += e[k]; }); return st; },
    canBuy(S, id) { const u = U[id]; return u && !S.own.includes(id) && (!u.req.length || u.req.some(r => S.own.includes(r))); },
    cost(S, id) { return U[id].c + (U[id].t === 'sym' ? Math.floor(S.own.filter(o => U[o].t === 'sym').length / 3) : 0); },
    buy(S, id) { if (!sim.canBuy(S, id) || S.pts < sim.cost(S, id)) return false; S.pts -= sim.cost(S, id); S.own.push(id);
      if (U[id].e.shuf) S.cure = Math.max(0, S.cure - (2 + U[id].e.shuf + S.own.filter(o => /^shuf/.test(o)).length - 1)); return true; },
    canRemove(S, id) { return U[id].t === 'sym' && S.own.includes(id) && !S.own.some(o => U[o].req.includes(id) && !U[o].req.some(r => r !== id && S.own.includes(r))) && S.pts >= 1; },
    remove(S, id) { if (!sim.canRemove(S, id)) return false; S.pts -= 1; S.own = S.own.filter(o => o !== id); return true; },
    start(S, i) { S.r[i].inf = 1; S.seed = i; S.day = 1; S.news.unshift([1, 'Doctors in ' + REG[i][0] + ' treat a patient with an odd illness.']); },
    totals(S) { let pop = 0, inf = 0, dead = 0; S.r.forEach(r => { pop += r.pop; inf += r.inf; dead += r.dead; }); return { pop, inf, dead, alive: pop - dead, healthy: pop - dead - inf }; },
    // One day. rnd() returns 0..1. Returns events for the screen: flights and news.
    tick(S, rnd) {
      if (S.over) return [];
      const T = TYPES[S.type], D = DIFF[S.diff], st = sim.stats(S), ev = [], say = t => { S.news.unshift([S.day, t]); ev.push({ k: 'news', t }); };
      const tot0 = sim.totals(S), gInf = tot0.inf / tot0.pop, gDead = tot0.dead / tot0.pop;
      let newInf = 0, newDead = 0;
      S.r.forEach((r, i) => {
        if (r.gone || r.inf <= 0) return; const g = REG[i], alive = r.pop - r.dead, H = alive - r.inf;
        const clim = g[4] === 'c' ? Math.min(1.1, .4 + .3 * st.cold) : g[4] === 'h' ? Math.min(1.1, .4 + .3 * st.heat) : 1;
        const rich = g[6] === 3 ? Math.min(1.05, .5 + .17 * st.drug) : g[6] === 2 ? Math.min(1.05, .8 + .08 * st.drug) : 1;
        const route = 1 + (g[5] ? .1 * st.insect + .06 * st.water : 0) + (g[6] === 1 ? .08 * st.live : 0);
        const beta = (.15 + .024 * st.inf + .006 * st.sev) * clim * rich * route * (1 - r.q * (1 - .4 * st.hard));
        const ni = Math.max(0, Math.min(H, r.inf * beta * (H / alive) + (H > 0 && r.inf < 3 ? .3 : 0))); r.inf += ni; newInf += ni;
        if (st.leth > 0) { const d = Math.min(r.inf, r.inf * st.leth * .0021 * (g[6] === 3 ? .8 : 1)); r.inf -= d; r.dead += d; newDead += d; }
        if (r.pop - r.dead < 1000) { newDead += r.pop - r.dead; r.dead = r.pop; r.inf = 0; r.gone = 1; S.pts += 2; say('📵 ' + g[0] + ' has gone silent. No one is left.'); }
      });
      // Crossing borders: by land, by plane and by ship
      const cross = (T.cross || 1) * (1 + st.cross), seedTo = (b, how) => { const r = S.r[b]; if (r.gone || r.pop - r.dead - r.inf < 1) return; const was = r.inf; r.inf += Math.min(r.pop - r.dead - r.inf, 1 + rnd() * 3); if (was < 1) { S.pts += 3 * D.pts; say('📍 ' + how + ' The first case in ' + REG[b][0] + '.'); } };
      const frac = r => r.inf / Math.max(1, r.pop - r.dead), bclose = .08 + .3 * st.hard;
      LAND.forEach(([a, b]) => [[a, b], [b, a]].forEach(([x, y]) => { const rx = S.r[x], ry = S.r[y]; if (rx.inf < 1 || ry.inf >= 1) return;
        if (rnd() < .35 * Math.sqrt(frac(rx)) * cross * ((rx.bc || ry.bc) ? bclose : 1)) seedTo(y, 'Over the border from ' + REG[x][0] + '.'); }));
      S.r.forEach((r, i) => {
        if (r.gone) return; const f = frac(r);
        if (r.air && rnd() < .55) { const opts = S.r.map((o, j) => j).filter(j => j !== i && S.r[j].air && !S.r[j].gone); const b = opts[Math.floor(rnd() * opts.length)];
          const sick = r.inf >= 1 && rnd() < .3 * Math.sqrt(f) * (1 + .6 * st.air) * cross; if (b !== undefined) { ev.push({ k: 'fly', a: i, b, sick }); if (sick) seedTo(b, 'A sick passenger lands from ' + REG[i][0] + '.'); } }
        if (r.port && rnd() < .35) { const opts = S.r.map((o, j) => j).filter(j => j !== i && S.r[j].port && !S.r[j].gone); const b = opts[Math.floor(rnd() * opts.length)];
          const sick = r.inf >= 1 && rnd() < .22 * Math.sqrt(f) * (1 + .6 * st.water) * cross; if (b !== undefined) { ev.push({ k: 'ship', a: i, b, sick }); if (sick) seedTo(b, 'A ship from ' + REG[i][0] + ' docks with sick crew.'); } }
      });
      // Does the world notice?
      const tot = sim.totals(S), sev = st.sev * (T.vis || 1);
      if (!S.noticed) { const hit = S.r.filter(r => r.inf >= 1).length, p = .0016 * sev + (tot.dead > 1000 ? .2 : 0) + (hit >= 5 ? .008 : 0) + gInf * (sev > 0 ? .06 : .015);
        if (rnd() < p) { S.noticed = 1; S.nday = S.day; say('🔬 The world has noticed ' + S.name + '. Scientists start working on a cure.'); } }
      if (S.noticed) {
        // Panic: quarantines, then airports, seaports and borders close
        S.r.forEach((r, i) => { if (r.gone) return; const w = REG[i][6], f = frac(r), worry = (f > .001 ? 1 : 0) + gDead * 40 + sev * .03;
          if (f > .001) r.q = Math.min(.45, r.q + .004 * w * D.close);
          if (r.air && rnd() < .006 * w * D.close * worry) { r.air = 0; say('✈️ ' + REG[i][0] + ' closes its airports.'); }
          if (r.port && rnd() < .005 * w * D.close * worry) { r.port = 0; say('⚓ ' + REG[i][0] + ' closes its seaports.'); }
          if (!r.bc && rnd() < .004 * w * D.close * worry) { r.bc = 1; say('🚧 ' + REG[i][0] + ' closes its land borders.'); } });
        let work = 0, W0 = 0; S.r.forEach((r, i) => { const w = REG[i][6]; W0 += w * r.pop; work += w * Math.max(0, r.pop - r.dead - .6 * r.inf); });
        const ramp = Math.min(1, .35 + (S.day - S.nday) / 140);
        S.cure += .62 * (work / W0) * ramp * (1 + .03 * sev) * (T.cure || 1) * D.cure * (1 - .14 * st.shuf);
        const c0 = Math.floor((S.cure - .01) / 25), c1 = Math.floor(S.cure / 25); if (c1 > c0 && c1 >= 1 && c1 <= 3) say('🧫 Cure research reaches ' + c1 * 25 + '%.');
      }
      // Mutations (virus) and mutation points
      if (T.mutate && S.noticed && rnd() < .025) { const opts = UPG.filter(u => u.t === 'sym' && sim.canBuy(S, u.id)); if (opts.length) { const u = opts[Math.floor(rnd() * opts.length)]; S.own.push(u.id); say('🧬 ' + S.name + ' mutated on its own: ' + u.n + '.'); } }
      S.pts += (.2 + .11 * Math.log10(1 + newInf) + .14 * Math.log10(1 + newDead)) * D.pts * (T.pts || 1);
      if (!S.hint0 && tot.healthy < tot.pop * .02 && st.leth === 0) { S.hint0 = 1; say('💡 Almost everyone is infected, but nobody is dying. Add deadly symptoms before the cure is done.'); }
      S.day++;
      if (tot.alive < 1) { S.over = 1; S.won = 1; say('☠️ ' + S.name + ' has wiped out the world in ' + S.day + ' days.'); }
      else if (S.cure >= 100) { S.cure = 100; S.over = 1; say('💉 The cure is ready and given to everyone. ' + S.name + ' is beaten.'); }
      else if (tot.inf < .5) { S.over = 1; say('🫥 ' + S.name + ' died out. No one is infected any more.'); }
      if (S.news.length > 40) S.news.length = 40;
      return ev;
    }
  };
  P.germSim = sim;
  if (typeof document === 'undefined') return;

  const fmt = n => { n = Math.max(0, n); return n >= 1e9 ? (n / 1e9).toFixed(2) + 'B' : n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1e3 ? (n / 1e3).toFixed(1) + 'K' : String(Math.round(n)); };
  const pct = v => v < .01 ? '<1%' : Math.round(v * 100) + '%';
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  // Each region is a lumpy blob drawn from a fixed seed, so the map looks the same every game
  const blob = (i) => { const g = REG[i], R = 26 + Math.sqrt(g[3]) * 1.9, pts = []; let s = (i + 1) * 9301;
    const rr = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; }; const k = [rr(), rr(), rr()];
    for (let a = 0; a < 18; a++) { const t = a / 18 * Math.PI * 2, w = 1 + .16 * Math.sin(t * 2 + k[0] * 6) + .1 * Math.sin(t * 3 + k[1] * 6) + .07 * Math.sin(t * 5 + k[2] * 6);
      pts.push((g[1] + Math.cos(t) * R * w * 1.18).toFixed(1) + ',' + (g[2] + Math.sin(t) * R * w * .82).toFixed(1)); } return pts.join(' '); };
  const css = () => { if (document.getElementById('germcss')) return; const st = document.createElement('style'); st.id = 'germcss'; st.textContent = `
.gt{display:flex;flex-direction:column;gap:8px;width:min(1150px,calc(100vw - 70px));max-width:100%}.gt-top{display:flex;flex-wrap:wrap;gap:6px;align-items:center}
.gt-stat{background:var(--panel2);border:1px solid var(--line);border-radius:8px;padding:4px 9px;font-size:13px;white-space:nowrap}.gt-stat b{font-variant-numeric:tabular-nums}
.gt-cure{flex:1;min-width:160px}.gt-bar{height:8px;border-radius:5px;background:var(--panel2);border:1px solid var(--line);overflow:hidden;margin-top:3px}.gt-bar i{display:block;height:100%;background:var(--ok);transition:width .3s}
.gt-main{display:flex;gap:10px;align-items:flex-start}.gt-map{flex:1 1 560px;min-width:0}.gt-map svg{width:100%;height:auto;display:block;border-radius:10px;border:1px solid var(--line)}
.gt-side{flex:0 0 300px;max-width:100%}.gt-tabs{display:flex;gap:4px;margin-bottom:6px;flex-wrap:wrap}.gt-tabs button.on{background:var(--acc);color:var(--onacc,#fff)}
.gt-list{display:flex;flex-direction:column;gap:5px;max-height:420px;overflow:auto;padding-right:3px}
.gt-u{display:flex;gap:8px;align-items:center;text-align:left;padding:6px 8px;border-radius:8px;border:1px solid var(--line);background:var(--panel2);color:var(--text);cursor:pointer;font:inherit}
.gt-u .ic{font-size:20px}.gt-u .tx{flex:1;min-width:0}.gt-u .tx small{display:block;color:var(--mute);font-size:11.5px}.gt-u .pr{font-weight:700;white-space:nowrap}
.gt-u.own{border-color:var(--bad);background:color-mix(in srgb,var(--bad) 14%,var(--panel2))}.gt-u.lock{opacity:.45;cursor:default}.gt-u.poor .pr{color:var(--bad)}
.gt-news{font-size:12.5px;line-height:1.5;min-height:58px}.gt-news div:first-child{font-weight:600}
.gt-reg{cursor:pointer}.gt-reg:hover .gt-edge{stroke:var(--acc);stroke-width:2.5}.gt-pick .gt-reg:hover .gt-edge{stroke-width:4}
.gt-setup{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px}.gt-opt{display:block;text-align:left;white-space:normal;height:auto;padding:8px 10px;border-radius:10px;border:1px solid var(--line);background:var(--panel2);color:var(--text);cursor:pointer;font:inherit;line-height:1.35}.gt-opt:hover{border-color:var(--acc)}.gt-opt.on{border-color:var(--acc);box-shadow:0 0 0 2px var(--acc) inset;background:color-mix(in srgb,var(--acc) 16%,var(--panel2))}
.gt-tbl{width:100%;font-size:12px;border-collapse:collapse}.gt-tbl td{padding:3px 4px;border-bottom:1px solid var(--line)}.gt-tbl tr.sel td{background:color-mix(in srgb,var(--acc) 15%,transparent)}
@media (max-width:1000px){.gt-main{flex-direction:column}.gt-map{flex:none;width:100%}.gt-side{flex:none;width:100%}.gt-list{max-height:none}}`; document.head.appendChild(st); };

  P.games.germ = { name: 'Germ Theory', icon: '🦠', desc: 'Design a germ and spread it across a made-up world of twelve regions before scientists finish a cure. Spend points on spread, symptoms and defenses. Autosaves.', mount(el, api) {
    css(); let S = null, dead = false, timer = 0, speed = 1, paused = false, tab = 'spread', sel = -1, setup = { type: 'bacterium', diff: 'normal', name: '' }, svg = null, fills = [], lastSave = 0;
    const SPEED = [0, 600, 250, 90], rnd = Math.random;
    const save = () => { try { ls.set(KEY, S && !S.over && S.day ? JSON.stringify(S) : ''); } catch (e) { } };
    const stop = () => { clearInterval(timer); timer = 0; };
    const run = () => { stop(); if (S && S.day && !S.over && !paused) timer = setInterval(step, SPEED[speed]); };
    const step = () => { if (dead || !S) return stop(); const ev = sim.tick(S, rnd); ev.forEach(e => { if (e.k === 'fly' || e.k === 'ship') travel(e); }); if (S.day - lastSave >= 5 || S.over) { lastSave = S.day; save(); }
      if (S.over) { stop(); if (S.won) { const nb = api.submit(S.day, true); S.best = nb; } save(); paint(); } else paint(); };

    const setupView = () => {
      el.innerHTML = '<div class="gt"><div class="card"><h3 style="margin:0 0 4px">🦠 Germ Theory</h3><div class="small mute">Pick a germ, a difficulty and a name. Then click the region where it starts. Spread it everywhere and make it deadly before the world finishes a cure.</div></div>' +
        '<div><b class="small">Germ</b><div class="gt-setup" style="margin-top:4px">' + Object.keys(TYPES).map(k => '<button class="gt-opt' + (setup.type === k ? ' on' : '') + '" data-ty="' + k + '"><b>' + TYPES[k].ic + ' ' + TYPES[k].n + '</b><div class="small mute">' + TYPES[k].d + '</div></button>').join('') + '</div></div>' +
        '<div><b class="small">Difficulty</b><div class="gt-setup" style="margin-top:4px">' + Object.keys(DIFF).map(k => '<button class="gt-opt' + (setup.diff === k ? ' on' : '') + '" data-df="' + k + '"><b>' + DIFF[k].n + '</b><div class="small mute">' + ({ casual: 'Slow cure, few closures, more points.', normal: 'A fair fight.', brutal: 'Fast cure and quick closures.' })[k] + '</div></button>').join('') + '</div></div>' +
        '<div class="row" style="gap:8px;align-items:center;flex-wrap:wrap"><label class="small">Name <input id="gtname" maxlength="24" placeholder="Strain X" value="' + esc(setup.name) + '" style="width:180px"></label><button class="pri" data-go="1">Choose a starting region ▶</button></div></div>';
    };
    const build = () => {
      const pick = !S.day;
      el.innerHTML = '<div class="gt"><div class="gt-top" id="gttop"></div>' + (pick ? '<div class="card" style="padding:8px 10px"><b>Click a region to release ' + esc(S.name) + '.</b> <span class="small mute">Big, poor, humid places spread fast. Rich, cold places notice early. Islands are hard to reach later.</span></div>' : '') +
        '<div class="gt-main"><div class="gt-map' + (pick ? ' gt-pick' : '') + '" id="gtmap"></div><div class="gt-side"><div class="gt-tabs">' +
        [['spread', '🌍 Spread'], ['sym', '🤒 Symptoms'], ['def', '🛡️ Defenses'], ['world', '📊 World']].map(t => '<button class="ib' + (tab === t[0] ? ' on' : '') + '" data-tab="' + t[0] + '">' + t[1] + '</button>').join('') + '</div><div class="gt-list" id="gtlist"></div></div></div>' +
        '<div class="card gt-news" id="gtnews"></div></div>';
      const W = 800, H = 430; let h = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="World map"><defs><radialGradient id="gtsea" cx="50%" cy="45%" r="75%"><stop offset="0" stop-color="#1d4a66"/><stop offset="1" stop-color="#0d2233"/></radialGradient></defs><rect width="' + W + '" height="' + H + '" fill="url(#gtsea)"/>';
      for (let y = 18; y < H; y += 36) h += '<path d="M0 ' + y + ' Q200 ' + (y - 6) + ' 400 ' + y + ' T800 ' + y + '" stroke="#fff" stroke-opacity=".04" fill="none"/>';
      LAND.forEach(([a, b]) => h += '<line x1="' + REG[a][1] + '" y1="' + REG[a][2] + '" x2="' + REG[b][1] + '" y2="' + REG[b][2] + '" stroke="#c9b98a" stroke-opacity=".25" stroke-width="3" stroke-linecap="round" id="gtl' + a + '_' + b + '"/>');
      REG.forEach((g, i) => { const pts = blob(i);
        h += '<g class="gt-reg" data-r="' + i + '"><title>' + esc(g[0]) + '</title><polygon points="' + pts + '" fill="' + (g[4] === 'c' ? '#7d927f' : g[4] === 'h' ? '#a8935c' : '#6f9a5d') + '"/><polygon points="' + pts + '" fill="#d62f3a" fill-opacity="0" id="gti' + i + '"/><polygon points="' + pts + '" fill="#111" fill-opacity="0" id="gtd' + i + '"/><polygon class="gt-edge" points="' + pts + '" fill="none" stroke="#000" stroke-opacity=".45" stroke-width="1.5" id="gte' + i + '"/>' +
          '<text x="' + g[1] + '" y="' + (g[2] - 4) + '" text-anchor="middle" font-size="17" font-weight="700" fill="#fff" stroke="#000" stroke-width="3" paint-order="stroke" pointer-events="none">' + esc(g[0]) + '</text>' +
          '<text x="' + g[1] + '" y="' + (g[2] + 15) + '" text-anchor="middle" font-size="14" fill="#fff" stroke="#000" stroke-width="2.5" paint-order="stroke" pointer-events="none" id="gtt' + i + '"></text></g>'; });
      h += '<g id="gtfx"></g></svg>';
      $m().innerHTML = h; svg = $m().querySelector('svg'); paint();
    };
    const $m = () => el.querySelector('#gtmap');
    const travel = e => { if (!svg || paused || speed === 3 && !e.sick || document.hidden) return; const fx = svg.querySelector('#gtfx'); if (!fx || fx.childNodes.length > 14) return;
      const a = REG[e.a], b = REG[e.b], mx = (a[1] + b[1]) / 2, my = (a[2] + b[2]) / 2 - Math.hypot(a[1] - b[1], a[2] - b[2]) * .25;
      const NS = 'http://www.w3.org/2000/svg', path = document.createElementNS(NS, 'path'), dot = document.createElementNS(NS, 'text');
      path.setAttribute('d', 'M' + a[1] + ' ' + a[2] + ' Q' + mx + ' ' + my + ' ' + b[1] + ' ' + b[2]); path.setAttribute('fill', 'none'); path.setAttribute('stroke', e.sick ? '#ff5a63' : '#ffffff'); path.setAttribute('stroke-opacity', e.sick ? '.7' : '.18'); path.setAttribute('stroke-dasharray', e.k === 'ship' ? '2 5' : '5 4');
      dot.textContent = e.k === 'ship' ? '🚢' : '✈️'; dot.setAttribute('font-size', '13'); dot.setAttribute('text-anchor', 'middle'); fx.appendChild(path); fx.appendChild(dot);
      const t0 = performance.now(), dur = Math.min(1600, SPEED[speed] * 1.6); const f = now => { if (dead || !dot.isConnected) return; const t = Math.min(1, (now - t0) / dur), u = 1 - t;
        dot.setAttribute('x', u * u * a[1] + 2 * u * t * mx + t * t * b[1]); dot.setAttribute('y', u * u * a[2] + 2 * u * t * my + t * t * b[2] + 4); if (t < 1) requestAnimationFrame(f); else { path.remove(); dot.remove(); } }; requestAnimationFrame(f); };
    const paint = () => {
      if (!S || !svg) return; const tot = sim.totals(S), st = sim.stats(S);
      S.r.forEach((r, i) => { const al = Math.max(1, r.pop - r.dead), fi = r.inf / al, fd = r.dead / r.pop;
        svg.querySelector('#gti' + i).setAttribute('fill-opacity', r.inf >= 1 ? (.18 + .67 * Math.sqrt(fi)).toFixed(3) : 0); svg.querySelector('#gtd' + i).setAttribute('fill-opacity', (fd * .85).toFixed(3));
        const e = svg.querySelector('#gte' + i); e.setAttribute('stroke', sel === i ? '#fff' : '#000'); e.setAttribute('stroke-width', sel === i ? 3 : 1.5); e.setAttribute('stroke-opacity', sel === i ? 1 : .45);
        svg.querySelector('#gtt' + i).textContent = r.gone ? '💀' : (r.inf >= 1 ? '🦠' + pct(fi) + ' ' : '') + (r.dead >= 1 ? '☠' + pct(fd) + ' ' : '') + (REG[i][7] && !r.air ? '🚫✈' : '') + (REG[i][8] && !r.port ? '🚫⚓' : '') + (r.bc ? '🚧' : ''); });
      LAND.forEach(([a, b]) => { const l = svg.querySelector('#gtl' + a + '_' + b); if (l) l.setAttribute('stroke-opacity', (S.r[a].bc || S.r[b].bc) ? '.06' : '.25'); });
      const top = el.querySelector('#gttop'); if (top) top.innerHTML =
        '<span class="gt-stat">' + TYPES[S.type].ic + ' <b>' + esc(S.name) + '</b></span><span class="gt-stat">📅 Day <b>' + S.day + '</b></span><span class="gt-stat">🧬 Points <b>' + Math.floor(S.pts) + '</b></span>' +
        '<span class="gt-stat">🙂 <b>' + fmt(tot.healthy) + '</b></span><span class="gt-stat" style="color:var(--bad)">🦠 <b>' + fmt(tot.inf) + '</b></span><span class="gt-stat">☠️ <b>' + fmt(tot.dead) + '</b></span>' +
        '<span class="gt-stat" title="Infectivity / severity / lethality">⚡' + st.inf + ' 🔥' + st.sev + ' 💀' + st.leth + '</span>' +
        '<span class="gt-stat gt-cure">💉 Cure <b>' + (S.noticed ? S.cure.toFixed(1) + '%' : 'not started') + '</b><div class="gt-bar"><i style="width:' + S.cure.toFixed(1) + '%"></i></div></span>' +
        (S.day && !S.over ? '<span class="row" style="gap:3px"><button class="ib" data-sp="0" title="Pause (Space)">' + (paused ? '▶' : '⏸') + '</button>' + [1, 2, 3].map(n => '<button class="ib' + (speed === n && !paused ? ' on' : '') + '" data-sp="' + n + '" title="Speed ' + n + '">' + '▸'.repeat(n) + '</button>').join('') + '</span>' : '') +
        '<button class="ib" data-new="1">New game</button>';
      el.querySelectorAll('.gt-tabs [data-sp].on').forEach(b => b.classList.remove('on'));
      list(); news();
      api.hud(S.day ? 'Day ' + S.day + ' · ' + Math.floor(S.pts) + ' points · cure ' + S.cure.toFixed(0) + '%' : 'Pick a starting region');
    };
    const list = () => { const L = el.querySelector('#gtlist'); if (!L) return; const keep = L.scrollTop;
      if (tab === 'world') { const tot = sim.totals(S);
        L.innerHTML = (S.over ? over() : '') + (sel >= 0 ? reg(sel) : '<div class="small mute">Click a region on the map for details.</div>') + '<table class="gt-tbl">' + REG.map((g, i) => { const r = S.r[i];
          return '<tr data-sel="' + i + '"' + (sel === i ? ' class="sel"' : '') + ' style="cursor:pointer"><td>' + esc(g[0]) + '</td><td style="color:var(--bad)">' + (r.inf >= 1 ? fmt(r.inf) : '') + '</td><td>' + (r.dead >= 1 ? '☠' + fmt(r.dead) : '') + '</td></tr>'; }).join('') + '</table><div class="small mute" style="margin-top:6px">World ' + fmt(tot.pop) + ' people, ' + fmt(tot.alive) + ' alive.</div>';
      } else L.innerHTML = (S.over ? over() : '') + UPG.filter(u => u.t === tab).map(u => { const own = S.own.includes(u.id), can = sim.canBuy(S, u.id), c = sim.cost(S, u.id), poor = can && S.pts < c;
        const fx = Object.keys(u.e).filter(k => ['inf', 'sev', 'leth'].includes(k)).map(k => ({ inf: '⚡', sev: '🔥', leth: '💀' })[k] + '+' + u.e[k]).join(' ');
        return '<button class="gt-u' + (own ? ' own' : '') + (!own && !can ? ' lock' : '') + (poor ? ' poor' : '') + '" data-u="' + u.id + '"' + (!own && !can ? ' title="Needs ' + u.req.map(r => U[r].n).join(' or ') + '"' : '') + '><span class="ic">' + u.ic + '</span><span class="tx"><b>' + u.n + '</b> <span class="small">' + fx + '</span><small>' + (!own && !can ? 'Needs ' + u.req.map(r => U[r].n).join(' or ') : u.d) + '</small></span><span class="pr">' + (own ? (sim.canRemove(S, u.id) ? '✕ 1' : '✓') : c) + '</span></button>'; }).join('') +
        (tab === 'sym' ? '<div class="small mute">🔥 Severity gets you noticed and speeds the cure. 💀 Lethality kills. Click an owned symptom (✕ 1 point) to remove it. Each 3 symptoms add 1 to the next one\'s price.</div>' : '');
      L.scrollTop = keep; };
    const reg = i => { const g = REG[i], r = S.r[i]; return '<div class="card" style="padding:7px 9px;margin-bottom:6px"><b>' + esc(g[0]) + '</b><div class="small">' + fmt(r.pop) + ' people · ' + ({ c: '❄️ cold', m: '🌤️ mild', h: '☀️ hot' })[g[4]] + (g[5] ? ' · 💧 humid' : ' · arid') + ' · ' + ['', 'poor', 'middle income', 'rich'][g[6]] + '</div><div class="small">' +
      (g[7] ? (r.air ? '✈️ airports open' : '🚫 airports closed') : 'no airports') + ' · ' + (g[8] ? (r.port ? '⚓ seaports open' : '🚫 seaports closed') : 'no seaports') + ' · ' + (r.bc ? '🚧 borders closed' : 'borders open') + '</div><div class="small">🦠 ' + fmt(r.inf) + ' infected · ☠️ ' + fmt(r.dead) + ' dead' + (r.q > .05 ? ' · quarantine ' + Math.round(r.q * 100) + '%' : '') + '</div></div>'; };
    const over = () => '<div class="card" style="margin-bottom:8px;border-color:' + (S.won ? 'var(--bad)' : 'var(--ok)') + '"><b>' + (S.won ? '☠️ You win in ' + S.day + ' days' + (S.best ? ' (new best!)' : '') : '💉 Humanity survived') + '</b><div class="small">' + esc(S.news[0] ? S.news[0][1] : '') + '</div><div style="margin-top:6px"><button class="pri" data-new="1">New game</button></div></div>';
    const news = () => { const n = el.querySelector('#gtnews'); if (n) n.innerHTML = S.news.slice(0, 4).map(x => '<div><span class="mute">Day ' + x[0] + ':</span> ' + esc(x[1]) + '</div>').join('') || '<div class="mute">News will appear here.</div>'; };

    el.onclick = async e => { const t = e.target;
      const ty = t.closest('[data-ty]'), df = t.closest('[data-df]'), go = t.closest('[data-go]'), rg = t.closest('[data-r]'), tb = t.closest('[data-tab]'), u = t.closest('[data-u]'), sp = t.closest('[data-sp]'), nw = t.closest('[data-new]'), sl = t.closest('[data-sel]');
      if (ty || df) { const nm = el.querySelector('#gtname'); if (nm) setup.name = nm.value; if (ty) setup.type = ty.dataset.ty; else setup.diff = df.dataset.df; return setupView(); }
      if (go) { const nm = el.querySelector('#gtname'); setup.name = (nm && nm.value.trim()) || 'Strain X'; S = sim.create(setup.type, setup.diff, setup.name); sel = -1; tab = 'spread'; return build(); }
      if (nw) { if (S && S.day && !S.over && !(await A.confirm('Start a new game? This outbreak will be lost.'))) return; stop(); S = null; save(); return setupView(); }
      if (!S) return;
      if (rg) { const i = +rg.dataset.r; if (!S.day) { sim.start(S, i); paused = false; lastSave = 0; save(); build(); run(); return; } sel = i; tab = 'world'; el.querySelectorAll('[data-tab]').forEach(b => b.classList.toggle('on', b.dataset.tab === tab)); return paint(); }
      if (sl) { sel = +sl.dataset.sel; return paint(); }
      if (tb) { tab = tb.dataset.tab; el.querySelectorAll('[data-tab]').forEach(b => b.classList.toggle('on', b.dataset.tab === tab)); return list(); }
      if (sp) { const n = +sp.dataset.sp; if (n === 0) paused = !paused; else { speed = n; paused = false; } run(); return paint(); }
      if (u && !S.over) { const id = u.dataset.u; if (S.own.includes(id)) { if (sim.canRemove(S, id) && (await A.confirm('Remove ' + U[id].n + ' for 1 point?'))) sim.remove(S, id); } else sim.buy(S, id); save(); return paint(); }
    };
    const key = e => { if (!S || !S.day || S.over || !el.isConnected || /INPUT|TEXTAREA|SELECT/.test((e.target.tagName || ''))) return; if (e.key === ' ') { e.preventDefault(); paused = !paused; run(); paint(); } else if (/^[1-3]$/.test(e.key)) { speed = +e.key; paused = false; run(); paint(); } };
    document.addEventListener('keydown', key);
    try { const r = JSON.parse(ls.get(KEY, 'null')); if (r && r.v === 1 && r.r && !r.over) { S = r; paused = true; } } catch (e) { }
    if (S) { build(); S.news.unshift([S.day, '⏸ Welcome back. Press ▶ or Space to carry on.']); paint(); } else setupView();
    return () => { dead = true; stop(); save(); el.onclick = null; document.removeEventListener('keydown', key); };
  } };
})();

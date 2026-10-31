/* WIDER — Rome is not the whole of a Roman life. This file adds the world outside the walls and the life that
   happens to you whether or not you are on a chapter:

   - three journeys: Ostia, the sea port half a day down the river, where cargoes are bought and sometimes lost;
     your villa on the bay near Baiae, two days south, an estate you can build up and the one place you sleep well;
     and the legions' winter camp in Cisalpine Gaul, four days north, where men are drilled, skirmishes fought and
     veterans recruited. Each is a real place you walk around, drawn the same way as the city.
   - a rival with a story of his own: Vatinius in the career, Cato in the life of Caesar (who really was Caesar's
     most stubborn enemy). Every few days he makes a move; you answer it, buy it off or let it stand, and after
     enough of it there is a reckoning in the Basilica.
   - clients: at dawn somebody is waiting in your atrium with a favour to ask. Help them and the clientela grows,
     and a speaker with a hundred men at his back starts every speech ahead.
   - the city's own events: fires, omens, gifts, fevers and rumours, a few times a week.

   Nothing here interrupts anything. Whatever arrives waits in a queue until no panel, dialogue or battle is open. */
window.WIDER = (() => {
  'use strict';
  const rnd = Math.random, pick = a => a[Math.floor(rnd() * a.length)];
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const T = 32;

  /* ============================ the regions ============================ */
  /* from: the place in Rome the road starts (and where the quest marker points from inside the city); hours: one way */
  const REGIONS = {
    ostia: { name: 'Ostia', g: '⚓', from: 'portus', hours: 6, w: 40, h: 26, sub: 'The sea port at the mouth of the Tiber: the grain fleet, the warehouses, the lighthouse fire and every rumour from overseas a day before Rome hears it.' },
    villa: { name: 'Your villa near Baiae', g: '🍇', from: 'domus', hours: 48, w: 38, h: 26, sub: 'A house on the bay with vines on the slope behind it, olive trees, a fish pond and a steward who writes to you every week whether or not anything has happened.' },
    camp: { name: 'The winter camp in Gaul', g: '⛺', from: 'castra', hours: 96, w: 40, h: 28, sub: 'Two legions in winter quarters on the Po: ditch, rampart, tents in rows, and nine thousand men who want something to do.' }
  };
  const isRegion = id => !!REGIONS[id];

  /* a little painter for open country, the same tiles, roofs and props as the city */
  function paintRegion(id, spec) {
    const W = spec.w, H = spec.h, sheet = window.PIX.tiles().at, C = window.PIXCITY;
    const base = PIX.cv(W * T, H * T), g = base.getContext('2d');
    const tile = [], solid = new Uint8Array(W * H), r = PIXTOOLS.rng(PIXTOOLS.hash('region' + id));
    for (let y = 0; y < H; y++) { const row = []; for (let x = 0; x < W; x++) row.push(spec.ground(x, y)); tile.push(row); }
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const k = tile[y][x], set = sheet[k] || sheet.grass;
      g.drawImage(set[(x * 7 + y * 13) % set.length], x * T, y * T);
      if (k === 'water' || k === 'wall') solid[y * W + x] = 1;
    }
    /* broad patches of light, as in the city */
    for (let i = 0; i < 70; i++) {
      const x = r() * W * T, y = r() * H * T, rad = 50 + r() * 140, gr = g.createRadialGradient(x, y, 0, x, y, rad);
      gr.addColorStop(0, r() < .55 ? 'rgba(255,214,150,.08)' : 'rgba(40,52,70,.07)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
    if (spec.extra) spec.extra(g, tile, solid, W, H, r);
    /* buildings: shadows first, then back rows before front rows */
    const bl = (spec.buildings || []).map(b => Object.assign({ col: '#cabfa4' }, b));
    if (C) {
      C.shadows(g, bl);
      bl.slice().sort((a, b) => (a.y + a.h) - (b.y + b.h)).forEach(b => { const a = C.building(b); g.drawImage(a.c, b.x * T - a.ox, b.y * T - a.oy); });
    }
    bl.forEach(b => { for (let y = b.y; y < b.y + b.h; y++) for (let x = b.x; x < b.x + b.w; x++) if (x >= 0 && y >= 0 && x < W && y < H) solid[y * W + x] = 1; });
    /* props: trees, carts, cranes, ships... standing things throw a shadow and block the way */
    const over = [], lights = [];
    const SOLIDP = { statue: 1, column: 1, fountain: 1, obelisk: 1, well: 1, cypress: 1, pine: 1, olive: 1, fig: 1, hedge: 1, torches: 1, lamp: 1, altar: 1, cart: 1, stall: 1, crane: 1, ship: 1, milestone: 1, oxen: 1, haystack: 1, standard: 1, amphorae: 1 };
    (spec.props || []).slice().sort((a, b) => a[2] - b[2]).forEach(p => {
      const [name, x, y, seed] = p, art = PIX.prop(name, seed || (x * 31 + y));
      if (!art || x < 0 || y < 0 || x >= W || y >= H) return;
      if (solid[y * W + x] && name !== 'ship') return;
      const ax = x * T + ((T - art.w) >> 1), ay = y * T + T - art.h;
      if (SOLIDP[name] && name !== 'ship') { g.save(); g.fillStyle = 'rgba(28,20,40,.24)'; g.beginPath(); g.ellipse(x * T + 22, y * T + T - 3, Math.max(6, art.w * .4), 5, -.35, 0, 6.3); g.fill(); g.restore(); }
      if (art.frames) over.push({ art, x: ax, y: ay }); else g.drawImage(art.c, ax, ay);
      if (SOLIDP[name]) solid[y * W + x] = 1;
      if (name === 'torches' || name === 'lamp' || name === 'altar') lights.push({ x, y });
    });
    /* the edges of the world: the map ends, the road home leaves from the south */
    for (let x = 0; x < W; x++) { solid[x] = 1; solid[(H - 1) * W + x] = 1; }
    for (let y = 0; y < H; y++) { solid[y * W] = 1; solid[y * W + W - 1] = 1; }
    const door = { x: W >> 1, y: H - 1 };
    solid[door.y * W + door.x] = 0;
    PIXTOOLS.px(g, door.x * T, door.y * T, T, T, 'rgba(240,212,122,.25)');
    const sign = PIX.prop('milestone', 7); if (sign) g.drawImage(sign.c, (door.x + 1) * T + ((T - sign.w) >> 1), (door.y - 1) * T + T - sign.h);
    solid[(door.y - 1) * W + door.x + 1] = 1;
    return { base, w: W, h: H, solid, over, lights, door, spawn: { x: door.x, y: H - 2 }, name: spec.name, outdoor: true, tile };
  }

  const SPECS = {
    /* Ostia: the sea along the top, a quay, warehouses facing the water, a temple of Vulcan and the fleet's office */
    ostia: {
      ground: (x, y) => y < 6 ? 'water' : y === 6 ? 'sand' : y < 9 ? 'stone' : (x === 19 || x === 20 || y === 16) ? 'cobble' : 'cobble2',
      buildings: [
        { style: 'warehouse', x: 2, y: 9, w: 6, h: 4 }, { style: 'warehouse', x: 9, y: 9, w: 6, h: 4 }, { style: 'warehouse', x: 25, y: 9, w: 6, h: 4 },
        { style: 'basilica', id: 'fleet', x: 32, y: 9, w: 6, h: 4 }, { style: 'temple', x: 12, y: 18, w: 5, h: 5 },
        { style: 'insulae', x: 2, y: 18, w: 5, h: 5 }, { style: 'tavern', x: 24, y: 18, w: 5, h: 4 }, { style: 'insulae', x: 31, y: 18, w: 6, h: 5 }
      ],
      props: [['ship', 5, 2, 1], ['ship', 13, 3, 2], ['ship', 22, 1, 3], ['ship', 30, 3, 4], ['ship', 36, 2, 5],
        ['crane', 4, 7], ['crane', 11, 7], ['crane', 27, 7], ['amphorae', 7, 8], ['amphorae', 16, 7], ['amphorae', 17, 8], ['amphorae', 23, 8],
        ['cart', 21, 8], ['cart', 9, 14], ['stall', 4, 15], ['stall', 26, 15], ['stall', 30, 15], ['torches', 18, 8], ['torches', 22, 14],
        ['fountain', 19, 22], ['statue', 22, 22], ['well', 8, 22], ['haystack', 34, 15], ['dog', 15, 15], ['reeds', 1, 6], ['reeds', 38, 6]],
      npcs: [
        { name: 'A sailor from Gades', role: 'pleb', x: 14, y: 8, lines: ['Three weeks out of Gades and the wind died off Sardinia. Never trust a calm sea, or a calm senator.', 'The oil on our boat is Baetican. Best in the world. Ask anyone who has tasted the other kind.'] },
        { name: 'A harbour clerk', role: 'scholar', x: 31, y: 14, lines: ['If you want a cargo, the fleet office is the long building on the quay. Bring coin; they do not take promises.', 'Grain ships pay the best and sink the most. That is the whole of the trade.'] },
        { name: 'A woman selling fish', role: 'matron', x: 5, y: 16, lines: ['Mullet, fresh this morning. Your cook would weep.', 'They say a storm took two of the Alexandria ships last month. They say a lot of things.'] },
        { name: 'A priest of Vulcan', role: 'priest', x: 14, y: 24, lines: ['Ostia keeps its own god. Rome forgets that we were here before the fleets.', 'A man who buys a cargo should make an offering. A man who does not should buy two cargoes.'] }
      ]
    },
    /* the villa: vines on the slope, olives, the house with its atrium, a fish pond, and the bay on the right */
    villa: {
      ground: (x, y) => x >= 33 ? 'water' : x === 32 ? 'sand' : (y === 21 || x === 19) && y > 4 ? 'dirt' : (x >= 23 && x <= 29 && y >= 15 && y <= 19) ? (x === 23 || x === 29 || y === 15 || y === 19 ? 'stone' : 'water') : (y > 14 && x < 18) ? 'garden' : 'grass',
      buildings: [{ style: 'villa', id: 'domus', x: 15, y: 7, w: 9, h: 6 }, { style: 'warehouse', x: 26, y: 4, w: 4, h: 3 }, { style: 'hut', x: 3, y: 18, w: 3, h: 3 }],
      props: (() => {
        const p = [];
        for (let y = 3; y < 13; y += 2) for (let x = 2; x < 13; x += 2) p.push(['vines', x, y, x * 7 + y]);
        for (let i = 0; i < 9; i++) p.push(['olive', 7 + (i * 5) % 11, 15 + (i % 3) * 2, i]);
        [[14, 14], [24, 14], [14, 20], [30, 12], [31, 22]].forEach((c, i) => p.push(['cypress', c[0], c[1], i]));
        p.push(['fountain', 19, 15], ['statue', 22, 13], ['statue', 16, 13], ['hedge', 21, 21], ['hedge', 17, 21], ['bench', 26, 21], ['torches', 18, 13], ['torches', 21, 13], ['haystack', 7, 21], ['oxen', 9, 22], ['cart', 26, 8]);
        return p;
      })(),
      npcs: [
        { name: 'Your steward, Philo', role: 'scholar', x: 20, y: 14, lines: ['The vines took the frost well, dominus. The olives less well. The accounts, as ever, are perfectly well.', 'A press house would pay for itself in three seasons. I have written this in four letters. I am saying it now in person.'] },
        { name: 'A vineyard slave', role: 'poor', x: 6, y: 13, lines: ['The south rows are the sweetest. Nobody ever believes me until the vintage.', 'The steward is fair. That is more than the last one.'] },
        { name: 'A fisherman from Baiae', role: 'pleb', x: 31, y: 18, lines: ['Half the Senate summers on this bay. You can tell who is losing by whose boat is smallest.', 'Your pond would take eels. Lampreys, even. Rich men pay a fortune for a lamprey.'] }
      ]
    },
    /* the winter camp: a palisade, tents in rows, the principia in the middle, training posts and a parade ground */
    camp: {
      ground: (x, y) => (x === 2 || x === 37 || y === 2 || y === 25) && x >= 2 && x <= 37 && y >= 2 && y <= 25 && !(y === 25 && x >= 19 && x <= 20) ? 'wall' : (x < 2 || x > 37 || y < 2 || y > 25) ? 'grass' : (x >= 13 && x <= 26 && y >= 18 && y <= 23) ? 'sand' : (x === 19 || x === 20 || y === 12) ? 'cobble2' : 'dirt',
      buildings: [{ style: 'barracks', id: 'principia', x: 15, y: 5, w: 10, h: 5 }],
      props: [['standard', 18, 11], ['standard', 21, 11], ['altar', 19, 15], ['torches', 17, 15], ['torches', 22, 15],
        ['standard', 14, 19], ['standard', 25, 19], ['haystack', 13, 23], ['haystack', 26, 23], ['cart', 30, 13], ['cart', 9, 13], ['oxen', 32, 22], ['well', 28, 15], ['crate', 6, 22]],
      extra(g, tile, solid, W, H, r) {
        /* the tents: eight men to a tent, in rows on both sides of the via principalis */
        for (const [x0, x1] of [[4, 17], [22, 36]]) for (let y = 4; y < 23; y += 3) {
          if (y >= 11 && y <= 13) continue;
          for (let x = x0; x < x1; x += 3) {
            if (x0 === 22 && y >= 17 && x < 27) continue;
            if (x0 === 4 && y >= 17 && x >= 13) continue;
            const X = x * T, Y = y * T;
            g.fillStyle = 'rgba(28,20,40,.25)'; g.beginPath(); g.moveTo(X + 52, Y + 8); g.lineTo(X + 70, Y + 22); g.lineTo(X + 70, Y + 56); g.lineTo(X + 52, Y + 56); g.fill();
            PIXTOOLS.px(g, X + 4, Y + 10, 26, 22, '#d8cba8'); PIXTOOLS.px(g, X + 30, Y + 10, 26, 22, '#bcae8c');
            PIXTOOLS.px(g, X + 29, Y + 6, 3, 28, '#8f8268'); PIXTOOLS.px(g, X + 4, Y + 32, 52, 6, '#a89a7c');
            PIXTOOLS.px(g, X + 24, Y + 32, 12, 6, '#3a2e22');
            PIXTOOLS.px(g, X + 4, Y + 10, 52, 1, '#efe4c6');
            for (let k = 0; k < 2; k++) for (let j = 0; j < 2; j++) solid[(y + j) * W + x + k] = 1;
          }
        }
        /* training posts on the parade ground */
        for (let i = 0; i < 5; i++) { const X = (14 + i * 2.5) * T, Y = 21 * T; PIXTOOLS.px(g, X, Y, 5, 22, '#6b4a2c'); PIXTOOLS.px(g, X - 2, Y + 20, 9, 3, 'rgba(0,0,0,.3)'); }
      },
      npcs: [
        { name: 'A centurion of the Tenth', role: 'soldier', x: 18, y: 13, lines: ['The men are bored, sir, and a bored legion is a legion that remembers its pay is late.', 'Drill them, march them, or let them fight something. Anything but leave them to dice.'] },
        { name: 'A recruit from Cremona', role: 'soldier', x: 23, y: 16, lines: ['They say beyond the river the Gauls paint themselves blue. The centurion says that is the Britons and to stop asking.', 'Six months ago I was pressing grapes. I would like to be pressing grapes.'] },
        { name: 'A Gallic trader', role: 'merchant', x: 30, y: 16, lines: ['Wine for the camp, horses for the officers, and news from the other side of the Alps if the price is right.', 'The Helvetii are restless. Everyone on the far side of the mountains knows it but you.'] }
      ]
    }
  };
  /* register them as places you can be "in", beside the rooms of the city */
  function install() {
    const ROOMS = window.IMP.INTERIORS || {};
    Object.keys(REGIONS).forEach(id => {
      const R = REGIONS[id], spec = Object.assign({ name: R.name, w: R.w, h: R.h }, SPECS[id]);
      ROOMS[id] = { name: R.name, w: R.w, h: R.h, desc: R.sub, outdoor: true, build: () => paintRegion(id, spec) };
      window.IMP.LOCS[id] = { id, name: R.name, g: R.g, sub: R.sub, room: id };
    });
    window.IMP.REGION_FROM = { ostia: 'portus', villa: 'domus', camp: 'castra' };
    window.IMP.QUESTS.push(...JOBS);
  }

  /* ============================ new jobs, out in the world ============================ */
  const JOBS = [
    { id: 'wreck', n: 'The ship that did not sink', giver: 'marina', ic: '🚢', at: 'ostia',
      d: 'A grain ship was reported lost off Antium, and the insurance paid. Marina has seen its figurehead on a boat in the harbour at Ostia, freshly painted.',
      steps: [{ at: 'ostia', act: 'Find the boatman who repainted it', text: 'Find the boatman who repainted the figurehead' }, { at: 'ostia', act: 'Audit the fleet office books', text: 'Audit the fleet office books for the insured cargo' }, { at: 'basilica', act: 'Bring the charge in Rome', text: 'Bring the charge before the court in Rome' }],
      reward: { denarii: 1600, auctoritas: 18, rep: { senate: 6, people: 6 } } },
    { id: 'lighthouse', n: 'The harbour fire', giver: 'marina', ic: '🔥', at: 'ostia',
      d: 'The beacon on the mole at Ostia went dark on a stormy night and two ships went onto the rocks. Somebody was paid to let it go out.',
      steps: [{ at: 'ostia', act: 'Question the fire-keeper', text: 'Question the man who keeps the beacon' }, { at: 'ostia', act: 'Buy the truth from the sailors', text: 'Buy the truth from the sailors who saw it' }, { at: 'curia', act: 'Tell the house who paid', text: 'Tell the house who paid for the dark' }],
      reward: { denarii: 900, auctoritas: 16, rep: { people: 10, senate: 4 } } },
    { id: 'vintage', n: 'The vintage', giver: 'cornelia', ic: '🍇', at: 'villa',
      d: 'Your steward writes that the vintage is the best in ten years and the buyers from Puteoli are offering half what it is worth. Your mother says go yourself.',
      steps: [{ at: 'villa', act: 'Walk the rows at dawn', text: 'Walk the rows at dawn before the pickers' }, { at: 'villa', act: 'Bargain with the Puteoli buyers', text: 'Bargain with the buyers from Puteoli' }, { at: 'macellum', act: 'Sell the rest in Rome', text: 'Sell the rest of it yourself in Rome' }],
      reward: { denarii: 2200, auctoritas: 8, rep: { people: 6 } } },
    { id: 'neighbour', n: 'The neighbour’s wall', giver: 'cornelia', ic: '🧱', at: 'villa',
      d: 'A senator with the next villa along the bay has moved his boundary wall forty feet onto your land and planted vines in it. He sends his compliments.',
      steps: [{ at: 'villa', act: 'Find the old boundary stones', text: 'Find the old boundary stones under his new vines' }, { at: 'tabularium', act: 'Find the survey in the record office', text: 'Find the original survey in the record office' }, { at: 'basilica', act: 'Argue it before the praetor', text: 'Argue it before the praetor' }],
      reward: { denarii: 800, auctoritas: 14, rep: { senate: 8 } } },
    { id: 'deserters', n: 'The men who walked away', giver: 'gaius', ic: '🏃', at: 'camp',
      d: 'Twelve men walked out of the winter camp with their kit and their pay. The legate wants an example made. The centurions want to know why they left.',
      steps: [{ at: 'camp', act: 'Ask the tent-mates why', text: 'Ask the deserters’ tent-mates why they went' }, { at: 'camp', act: 'Ride them down before the river', text: 'Ride them down before they cross the river' }, { at: 'camp', act: 'Decide their punishment before the legion', text: 'Decide their punishment in front of the legion' }],
      reward: { denarii: 600, auctoritas: 18, rep: { army: 14 } } },
    { id: 'pay', n: 'The pay chest', giver: 'gaius', ic: '💰', at: 'camp',
      d: 'The pay chest arrived at the winter camp three hundred denarii light, and the quaestor’s seal on it is perfect.',
      steps: [{ at: 'camp', act: 'Audit the pay rolls', text: 'Audit the pay rolls against the chest' }, { at: 'camp', act: 'Question the escort', text: 'Question the men who escorted it north' }, { at: 'tabularium', act: 'Find the quaestor’s copy in Rome', text: 'Find the quaestor’s own copy in the record office' }],
      reward: { denarii: 700, auctoritas: 16, rep: { army: 10, senate: 4 } } }
  ];

  /* ============================ the state this adds to a career ============================ */
  function ensure(S) {
    if (!S.wider) S.wider = { clients: S.bg === 'patrician' ? 8 : S.bg === 'novus' ? 3 : S.bg === 'miles' ? 2 : 5, estate: {}, ventures: [], vets: 0, queue: [], nextPetition: S.day + 2, nextEvent: S.day + 1, lastIncome: S.day, drilledOn: -1, restedOn: -1 };
    if (!S.wider.rival) S.wider.rival = { heat: 25, beats: 0, next: S.day + 3, done: null, moves: 0 };
    return S.wider;
  }
  const clients = S => (S && S.wider ? S.wider.clients : 0);

  /* ============================ the rival ============================ */
  const RIVAL = {
    career: { id: 'vatinius', name: 'Vatinius' },
    caesar: { id: 'cato', name: 'Cato' }
  };
  const rivalOf = S => RIVAL[S.mode === 'caesar' ? 'caesar' : 'career'];
  const MOVES = [
    { id: 'rumour', career: 'Vatinius has paid a crier in the Forum to say that your fortune was made selling short measures of grain.', caesar: 'Cato has stood up in the house and read out your debts, one creditor at a time, with the sums.',
      answer: { kind: 'persuade', act: 'Answer him from the Rostra', text: 'Answer the charge in front of the crowd', at: 'rostra' }, pay: 300, payText: 'Pay the crier to sing something else', ignore: { people: -4 } },
    { id: 'contract', career: 'Vatinius has underbid you for the contract on the Via Flaminia with figures that cannot be honest.', caesar: 'Cato has demanded the accounts of your province, every denarius, by the Kalends.',
      answer: { kind: 'audit', act: 'Go through his figures', text: 'Go through the figures line by line', at: 'tabularium' }, pay: 600, payText: 'Outbid him and swallow the loss', ignore: { senate: -4 } },
    { id: 'suit', career: 'Vatinius is prosecuting one of your clients for extortion in the provinces. Everybody knows who the real target is.', caesar: 'Cato has promised to prosecute you the moment your command ends and you are a private citizen again.',
      answer: { kind: 'persuade', act: 'Defend him in the Basilica', text: 'Defend the case in the Basilica', at: 'basilica' }, pay: 500, payText: 'Settle it quietly out of court', ignore: { people: -5 }, loseClient: 1 },
    { id: 'poach', career: 'Two of your clients were seen at Vatinius’s morning salutatio, and they did not look embarrassed.', caesar: 'Cato has been dining with the men who carried your last election, and lecturing them on virtue.',
      answer: { kind: 'question', act: 'Find out what he offered them', text: 'Find out what he offered them', at: 'subura' }, pay: 400, payText: 'Send them each a better gift', ignore: { people: -2 }, loseClient: 2 },
    { id: 'omen', career: 'An augur in Vatinius’s pay has declared that the birds were against you on the day of your last vote.', caesar: 'Your colleague, on Cato’s advice, has gone home to watch the sky for omens every day you try to pass a law.',
      answer: { kind: 'omens', act: 'Take the auspices yourself, in public', text: 'Take the auspices yourself, in front of witnesses', at: 'temple' }, pay: 350, payText: 'Pay for a second augur and a second opinion', ignore: { senate: -3, people: -2 } }
  ];
  function rivalMove(S) {
    const w = ensure(S), rv = w.rival, who = rivalOf(S), c = (window.IMP.CHARS || []).find(x => x.id === who.id);
    if (rv.done) return null;
    /* a rival who is dead, or not in Rome this year, makes no moves */
    const era = (c && c.era) || (window.IMP.ERA || {})[who.id];
    const yr = S.mode === 'caesar' ? (window.IMPERIUM && window.IMPERIUM.year ? window.IMPERIUM.year() : -60) : -63;
    if (era && !era.some(r => yr >= r[0] && yr <= r[1])) return null;
    rv.moves++;
    /* the reckoning comes once he has been beaten often enough or has pushed too far, but in the career not before
       Act III: Vatinius has a chapter of his own in Act II, and it would be strange to have finished with him first */
    const late = S.mode === 'caesar' || !window.STORY || window.STORY.actOf(S) >= 3;
    if (late && (rv.beats >= 4 || rv.heat >= 85)) return { type: 'reckoning' };
    const m = pick(MOVES);
    return { type: 'rival', id: m.id };
  }

  /* ============================ clients at the door ============================ */
  const PETITIONS = [
    { who: 'a cobbler from the Argiletum', ask: 'His shop burned with half the street and he needs a loan to start again.', cost: { denarii: 150 }, give: 'Lend him the money' },
    { who: 'a widow with two sons', ask: 'She wants a word put in with the aedile about her late husband’s stall in the market.', cost: { auctoritas: 2 }, give: 'Put in the word' },
    { who: 'a veteran with a limp', ask: 'He was promised land in Campania twenty years ago and has a tablet to prove it.', cost: { denarii: 200 }, give: 'Pay a surveyor to find it' },
    { who: 'a freedman baker', ask: 'He wants your name on a letter vouching for him with the grain commissioners.', cost: { auctoritas: 1 }, give: 'Write the letter' },
    { who: 'a young poet', ask: 'He has written forty lines in your honour and would like to be fed while he writes forty more.', cost: { denarii: 120 }, give: 'Become his patron', bonus: { attrs: { rhetoric: 1 } }, chance: .25 },
    { who: 'a stonemason', ask: 'He has been cheated by a contractor and wants an advocate who frightens contractors.', cost: { auctoritas: 2 }, give: 'Take his case' },
    { who: 'two brothers from Tusculum', ask: 'They will bring forty votes from their tribe to anybody who gets their nephew a post on a governor’s staff.', cost: { auctoritas: 3 }, give: 'Find the nephew a post', bonus: { rep: { senate: 2 } } },
    { who: 'a midwife from the Subura', ask: 'Her son is in the cells for a brawl he did not start.', cost: { denarii: 100, auctoritas: 1 }, give: 'Get him out' },
    { who: 'a boatman', ask: 'The harbour clerks want a bribe he cannot pay before they will let him tie up.', cost: { denarii: 80 }, give: 'Pay it for him' },
    { who: 'a retired gladiator', ask: 'He wants a job guarding something, anything, and promises he is very good at standing still.', cost: { denarii: 60 }, give: 'Hire him for the door', bonus: { rep: { people: 1 } } }
  ];

  /* ============================ the city's own events ============================ */
  const MORE_EVENTS = [
    { id: 'flood', n: 'The Tiber rises', d: 'The river is over the wharves and into the Forum Boarium. The low streets are wading.', opts: [
      { t: 'Pay for boats and bread', cost: 450, eff: { rep: { people: 9 }, auctoritas: 3 }, msg: 'Your boats are the ones people remember, rowing down streets with bread in the bow.' },
      { t: 'Open your house to the flooded', cost: 0, eff: { rep: { people: 5 }, attrs: { health: -1 } }, msg: 'Forty strangers sleep in your atrium. Your mother counts the silver twice.' },
      { t: 'Wait for it to go down', cost: 0, eff: { rep: { people: -6 } }, msg: 'It goes down in four days. So does your name, in the low streets.' }] },
    { id: 'thief', n: 'A thief in the house', d: 'Your strongbox has been opened in the night. The steward suspects the new porter; the porter suspects the steward.', opts: [
      { t: 'Question the household yourself', cost: 0, eff: { attrs: { cunning: 1 } }, msg: 'It was neither. It was the porter’s cousin, who had a key made in the Subura.' },
      { t: 'Let it go and change the locks', cost: 120, eff: {}, msg: 'The locks are better. The silver is still gone.' }] },
    { id: 'prodigy', n: 'A prodigy', d: 'A calf with two heads has been born on a farm outside the Porta Collina. The whole city has an opinion about what it means.', opts: [
      { t: 'Sponsor the expiation', cost: 300, eff: { rep: { people: 5, senate: 2 }, attrs: { fides: 1 } }, msg: 'The priests do it properly. The city exhales. The calf, sadly, does not.' },
      { t: 'Say it means nothing', cost: 0, eff: { rep: { people: -3 }, attrs: { cunning: 1 } }, msg: 'You are right, and nobody thanks you for it.' }] },
    { id: 'dinner', n: 'An invitation to dinner', d: 'A rich equestrian you barely know has invited you to a dinner of nine courses and one favour.', opts: [
      { t: 'Go, and hear the favour', cost: 0, eff: { denarii: 500, rep: { senate: -2 } }, msg: 'The favour is small. The gift that arrives the next morning is not.' },
      { t: 'Go, and leave before the favour', cost: 0, eff: { rep: { senate: 2 }, attrs: { health: -1 } }, msg: 'You eat everything and promise nothing. Your stomach regrets it.' },
      { t: 'Send your regrets', cost: 0, eff: {}, msg: 'He sends his, at greater length.' }] },
    { id: 'graffiti', n: 'Your name on a wall', d: 'Somebody has painted a rude verse about you on the wall of the baths, and it scans.', opts: [
      { t: 'Have it painted over', cost: 40, eff: {}, msg: 'It is painted over. A new one appears the next night. This one rhymes.' },
      { t: 'Have a better one painted back', cost: 60, eff: { rep: { people: 4 }, attrs: { rhetoric: 1 } }, msg: 'Yours is funnier. By evening it is being sung in the taverns.' }] },
    { id: 'embassy', n: 'An embassy from the provinces', d: 'Envoys from a town in Spain have come to ask for a patron in the Senate, and they have asked for you by name.', opts: [
      { t: 'Take them on', cost: 0, eff: { auctoritas: 5, rep: { senate: 3 } }, msg: 'A whole town is now in your clientela, and its olive oil is in your cellar.', clients: 3 },
      { t: 'Send them to somebody greater', cost: 0, eff: { rep: { senate: 1 } }, msg: 'They go to Crassus. Of course they go to Crassus.' }] },
    { id: 'collapse', n: 'An insula collapses', d: 'A five-storey tenement on the Esquiline has come down in the night, and three families are under it.', opts: [
      { t: 'Send your slaves to dig', cost: 0, eff: { rep: { people: 7 } }, msg: 'They bring out eleven people alive. The street does not forget whose men they were.' },
      { t: 'Pay the builders’ guild to dig', cost: 250, eff: { rep: { people: 5 }, auctoritas: 2 }, msg: 'The guild works through the night and sends you the bill in the morning.' },
      { t: 'Find out who the landlord is', cost: 0, eff: { attrs: { cunning: 1 }, rep: { people: -2 } }, msg: 'It is Crassus. It is always Crassus.' }] },
    { id: 'fever2', n: 'Fever in the household', d: 'Half your slaves are down with a fever from the marsh, and the doctor wants Greek prices.', opts: [
      { t: 'Pay the Greek doctor', cost: 220, eff: {}, msg: 'Everybody lives. The doctor buys a horse.' },
      { t: 'Trust to the household gods', cost: 0, eff: { attrs: { health: -1, fides: 1 } }, msg: 'Most of them recover. You catch it yourself, mildly.' }] },
    { id: 'pirates', n: 'Pirates off the coast', d: 'Pirates have taken a ship carrying a senator’s nephew, and the senator is asking every friend he has for the ransom.', opts: [
      { t: 'Contribute generously', cost: 400, eff: { rep: { senate: 6 }, auctoritas: 3 }, msg: 'The nephew comes home. The senator remembers who paid.' },
      { t: 'Contribute something', cost: 100, eff: { rep: { senate: 2 } }, msg: 'Your name is on the list, somewhere in the middle.' },
      { t: 'Contribute nothing', cost: 0, eff: { rep: { senate: -3 } }, msg: 'The list is read out in the house. Your name is not on it.' }] },
    { id: 'statue', n: 'A statue in your honour', d: 'A guild of grateful bakers wants to put up a statue of you by the Temple of Ceres, if you will pay for the bronze.', opts: [
      { t: 'Pay for the bronze', cost: 700, eff: { rep: { people: 6 }, auctoritas: 6 }, msg: 'It is a terrible likeness. Everyone agrees it is a terrible likeness, and everyone goes to look at it.' },
      { t: 'Ask for a modest bust instead', cost: 150, eff: { rep: { people: 3 }, auctoritas: 2 }, msg: 'The bust is better than the statue would have been, and nobody can say you are vain.' },
      { t: 'Decline with thanks', cost: 0, eff: { rep: { senate: 2 } }, msg: 'Cato hears of it and nods, which is the most anybody has had from Cato all year.' }] }
  ];
  const EVENTS = () => (window.IMP.EVENTS || []).concat(MORE_EVENTS);

  /* ============================ the estate and the cargoes ============================ */
  const ESTATE = [
    { id: 'vines', n: 'Terraced vineyards', d: 'More rows on the hillside, and a proper pressing floor.', cost: 1500, inc: 30 },
    { id: 'olives', n: 'An olive press', d: 'A press house and two millstones: your oil instead of somebody else’s.', cost: 2000, inc: 40 },
    { id: 'fish', n: 'Fish ponds for lampreys', d: 'Rich men pay a fortune for a lamprey, and they will pay it to you.', cost: 2600, inc: 50, rep: { senate: 3 } },
    { id: 'library', n: 'A Greek library', d: 'A reading room over the bay, and a reader who knows the speeches of Demosthenes by heart.', cost: 1800, inc: 0, once: { attrs: { rhetoric: 1, gravitas: 1 } } },
    { id: 'baths', n: 'A bath suite on the shore', d: 'Hot rooms fed by the springs. You will come back from every visit younger.', cost: 1400, inc: 0, once: { attrs: { health: 1 } } }
  ];
  const income = w => ESTATE.reduce((a, e) => a + (w.estate[e.id] ? e.inc : 0), 0);
  const CARGO = [
    { id: 'oil', n: 'Baetican oil', cost: 600, days: 4, lo: 1.2, hi: 1.55, risk: .08, d: 'Steady money from Spain. Rarely lost, rarely spectacular.' },
    { id: 'wine', n: 'Chian wine', cost: 450, days: 3, lo: 1.15, hi: 1.6, risk: .1, d: 'The Greeks charge for their reputation and so will you.' },
    { id: 'grain', n: 'Egyptian grain', cost: 900, days: 6, lo: 1.1, hi: 2.1, risk: .18, d: 'The biggest returns in the sea, and the most ships at the bottom of it.' },
    { id: 'spice', n: 'Pepper from the Red Sea', cost: 1200, days: 8, lo: 1.3, hi: 2.4, risk: .22, d: 'Brought up the Nile and across from Alexandria. A fortune, if it arrives.' }
  ];

  /* ============================ what you can do, and where ============================ */
  function acts(S, where) {
    ensure(S);
    const w = S.wider, out = [], room = where.room;
    if (where.inRoom && isRegion(room)) {
      if (room === 'ostia') {
        out.push({ wk: 'cargo', t: '📦 Buy a cargo at the fleet office', d: 'Put money into a ship. Collect it here or at the Portus in Rome when it comes in, if it comes in.' });
      }
      if (room === 'villa') {
        out.push({ wk: 'estate', t: '🍇 Improve the estate', d: 'Vines, oil, lampreys, a library, a bath. Income arrives every week whether you are here or not. Now ' + income(w) + ' ⚖ a day.' });
        out.push({ wk: 'retreat', t: '🌅 Stay a few days by the sea', d: w.restedOn === S.day ? 'You have only just arrived; the bay will still be here tomorrow.' : 'Three days of sleep, sea air and nobody asking for anything. Health and spirits restored.' });
      }
      if (room === 'camp') {
        out.push({ wk: 'drill', t: '🛡️ Drill the men', d: w.drilledOn === S.day ? 'They have drilled enough for one day.' : 'A morning on the parade ground with the centurions. Martial skill, and the army hears of it.' });
        out.push({ wk: 'skirmish', t: '⚔️ Raid across the river', d: 'A short, sharp fight with a tribe that has been stealing the legion’s horses.' });
        out.push({ wk: 'vets', t: '🎖️ Recruit veterans', d: 'Old soldiers who will follow you into any war you go to. +1 unit in every battle (' + w.vets + ' of 2).' });
      }
      if (ventureReady(S) && room === 'ostia') out.push({ wk: 'collect', t: '💰 Collect your cargoes', d: 'The fleet office has news of your ships.', pri: 1 });
      out.push({ wk: 'home', t: '🧭 Travel back to Rome', d: REGIONS[room].hours >= 24 ? (REGIONS[room].hours / 24) + ' days on the road.' : REGIONS[room].hours + ' hours on the road.', pri: 1 });
      return out;
    }
    if (where.inRoom) {
      if (room === 'domus') out.push({ wk: 'house', t: '📜 Your clients and estate', d: w.clients + ' clients, ' + income(w) + ' ⚖ a day from the villa, ' + w.ventures.length + ' cargo' + (w.ventures.length === 1 ? '' : 'es') + ' at sea.' });
      return out;
    }
    const loc = where.loc;
    if (loc === 'portus' || loc === 'wharf') out.push({ wk: 'travel', to: 'ostia', t: '⚓ Take a barge down to Ostia', d: 'Half a day down the river to the sea port: cargoes, ships and two jobs that need doing.' });
    if (loc === 'domus' || loc === 'palatine' || loc === 'villa') out.push({ wk: 'travel', to: 'villa', t: '🍇 Ride south to your villa', d: 'Two days on the Via Appia to the bay at Baiae: the estate, the sea, and the only good sleep in Italy.' });
    if (loc === 'castra' || loc === 'campus') out.push({ wk: 'travel', to: 'camp', t: '⛺ Ride north to the legions', d: 'Four days up the Via Flaminia to the winter camp on the Po: drill, raids and recruits.' });
    if ((loc === 'portus' || loc === 'wharf') && ventureReady(S)) out.push({ wk: 'collect', t: '💰 Collect your cargoes', d: 'Word has come up the river about your ships.', pri: 1 });
    if (loc === 'domus') out.push({ wk: 'house', t: '📜 Your clients and estate', d: w.clients + ' clients, ' + income(w) + ' ⚖ a day from the villa.' });
    return out;
  }
  const ventureReady = S => (S.wider.ventures || []).some(v => S.day >= v.ready);

  /* every action this file offers, carried out through the game's own panel, dialogue and trials */
  function act(a, api) {
    const S = api.S, w = ensure(S), esc = api.esc;
    const choose = (title, intro, rows, after) => {
      api.modal(title, '<p class="mute" style="margin:0 0 10px">' + intro + '</p><div class="trchoices">' + rows.map((r, i) =>
        '<button class="trc" data-i="' + i + '"' + (r.off ? ' disabled' : '') + '><b>' + esc(r.t) + '</b><span>' + r.d + '</span></button>').join('') + '</div>', true);
      document.querySelectorAll('#modal .trc').forEach(b => b.onclick = () => { const r = rows[+b.dataset.i]; api.close(); after(r); });
    };
    switch (a.wk) {
      case 'travel': {
        const R = REGIONS[a.to];
        return api.cine({ kicker: R.hours >= 24 ? (R.hours / 24) + ' days on the road' : 'Half a day on the river', title: R.g + ' ' + R.name, paras: [R.sub, travelLine(a.to)], go: 'Arrive ▸' }, () => { api.advance(R.hours); api.enter(a.to); });
      }
      case 'home': {
        const R = REGIONS[S.room];
        return api.cine({ kicker: 'The road home', title: '🏛️ Rome', paras: ['You come back up the ' + (S.room === 'ostia' ? 'river' : S.room === 'villa' ? 'Via Appia' : 'Via Flaminia') + ' and the city is louder than you remembered, and has moved on without you.'], go: 'Back to the city ▸' }, () => { api.advance(R.hours); api.leave(); });
      }
      case 'cargo':
        return choose('📦 The fleet office', 'A clerk with salt in his beard unrolls the sailing list. You have ' + S.denarii.toLocaleString() + ' ⚖.', CARGO.map(c => ({ t: c.n + ' — ' + c.cost + ' ⚖', d: c.d + ' Back in about ' + c.days + ' days.', c, off: S.denarii < c.cost })), r => {
          api.applyEff({ denarii: -r.c.cost }); w.ventures.push({ id: r.c.id, cost: r.c.cost, ready: S.day + r.c.days });
          api.sfx('coin'); api.toast('Cargo bought', r.c.n + ' sails at dawn. Collect it here or at the Portus in Rome.', 'scroll'); api.save();
        });
      case 'collect': {
        const ready = w.ventures.filter(v => S.day >= v.ready); w.ventures = w.ventures.filter(v => S.day < v.ready);
        let total = 0; const lines = [];
        ready.forEach(v => {
          const c = CARGO.find(x => x.id === v.id);
          if (rnd() < c.risk) { lines.push('The ship carrying your ' + c.n.toLowerCase() + ' went down off Sicily. The sea keeps no accounts.'); return; }
          const pay = Math.round(v.cost * (c.lo + rnd() * (c.hi - c.lo)) / 10) * 10; total += pay;
          lines.push('Your ' + c.n.toLowerCase() + ' came in and sold for ' + pay + ' ⚖ (you paid ' + v.cost + ').');
        });
        if (total) api.applyEff({ denarii: total, xp: 8 });
        api.sfx(total ? 'coin' : 'bad'); api.save();
        return api.say('narrator', lines.concat([total ? 'In all, ' + total.toLocaleString() + ' ⚖ is counted into your strongbox.' : 'Nothing to count this time.']));
      }
      case 'estate':
        return choose('🍇 The estate', 'Your steward has the plans ready, as he always does. The villa pays ' + income(w) + ' ⚖ a day now. You have ' + S.denarii.toLocaleString() + ' ⚖.', ESTATE.map(e => ({ t: (w.estate[e.id] ? '✔ ' : '') + e.n + (w.estate[e.id] ? '' : ' — ' + e.cost + ' ⚖'), d: e.d + (e.inc ? ' +' + e.inc + ' ⚖ a day.' : ''), e, off: w.estate[e.id] || S.denarii < e.cost })), r => {
          w.estate[r.e.id] = 1; api.applyEff(Object.assign({ denarii: -r.e.cost }, r.e.once || {}, r.e.rep ? { rep: r.e.rep } : {}));
          api.sfx('good'); api.say('narrator', ['The builders come from Puteoli and stay for a month. ' + r.e.n + ' is finished, and Philo the steward is almost smiling.']); api.save();
        });
      case 'retreat':
        if (w.restedOn === S.day) return api.toast('Not yet', 'you have only just arrived', 'bad');
        w.restedOn = S.day + 3; api.advance(72);
        api.applyEff({ attrs: { health: Math.max(0, 8 - (S.attrs.health || 0)) } });
        return api.say('narrator', ['Three days of sea, sleep and figs eaten off the tree. You swim before breakfast like a boy.', 'You are as well as you have been in years. Rome has, of course, been busy without you.']);
      case 'drill':
        if (w.drilledOn === S.day) return api.toast('Enough for today', 'the centurions have the men cleaning kit now', 'bad');
        w.drilledOn = S.day;
        return window.TRIALS.run(api.trialApi(), { kind: 'chase', step: { act: 'Drill the men', text: 'Drill a cohort on the parade ground', at: 'camp' }, title: 'The winter camp · Drill' }, res => {
          const g = res.grade;
          api.applyEff(g === 2 ? { xp: 20, rep: { army: 4 }, attrs: Math.random() < .35 ? { martial: 1 } : {} } : g === 1 ? { xp: 12, rep: { army: 2 } } : g === 0 ? { xp: 5 } : {});
          api.say('narrator', [g === 2 ? 'By noon the cohort wheels like one man. The centurions stop shouting, which is the highest praise a centurion gives.' : g === 1 ? 'A useful morning. Nobody was trampled.' : g === 0 ? 'The men are tired, and so are you, and so are the centurions of you.' : 'The centurions run it without you, as they usually do.']); api.save();
        });
      case 'skirmish':
        return api.battle({ id: 'raid', n: 'Across the Po', g: '🏹', foe: 'warband', str: 50, loot: 500, diff: 2, blurb: 'A tribe that has been stealing the legion’s horses, on its own ground, with its back to the woods.' });
      case 'vets':
        if (w.vets >= 2) return api.toast('The camp has no more to give', 'the best of the veterans already follow you', 'bad');
        return choose('🎖️ Veterans', 'Men who have served their sixteen years and would serve four more for the right general. You have ' + S.denarii.toLocaleString() + ' ⚖ and ' + Math.round(S.auctoritas) + ' auctoritas.', [
          { t: 'Pay them — 1,500 ⚖', d: 'Silver now, land later, and they will march.', off: S.denarii < 1500, pay: { denarii: -1500 } },
          { t: 'Win them with your name — 30 auctoritas', d: 'They have heard of you. That has to be worth something.', off: S.auctoritas < 30, pay: { auctoritas: -30 } }
        ], r => { w.vets++; api.applyEff(Object.assign({ rep: { army: 5 } }, r.pay)); api.sfx('good'); api.say('narrator', ['Two hundred old soldiers swear to you on the eagle. From now on there is one more unit in every army you lead.']); api.save(); });
      case 'house':
        return api.modal('📜 Your clients and estate', '<div class="two small"><div>Clients at your door <b>' + w.clients + '</b></div><div>The villa pays <b>' + income(w) + ' ⚖ a day</b></div><div>Cargoes at sea <b>' + w.ventures.length + '</b></div><div>Veterans sworn to you <b>' + w.vets + ' of 2</b></div><div>' + esc(rivalOf(S).name) + '’s campaign against you <b>' + (w.rival.done ? (w.rival.done === 'won' ? 'broken' : 'his') : Math.round(w.rival.heat) + '/100') + '</b></div><div>Estate <b>' + (ESTATE.filter(e => w.estate[e.id]).map(e => e.n).join(', ') || 'nothing built yet') + '</b></div></div>' +
          '<p class="mute" style="margin-top:12px">Every five clients you have is a head start in any speech you make. A client is somebody you helped at dawn, and who remembers it.</p>', true);
    }
  }
  const travelLine = id => id === 'ostia' ? 'The barge goes down with the current, past the salt flats and the tombs, and you smell the sea an hour before you see it.'
    : id === 'villa' ? 'The Via Appia south, past the tombs of men you have never heard of and a thousand milestones, and then the bay opens below you like a held breath.'
      : 'North up the Via Flaminia, across the Apennines in the wind, and down into the wide flat country of the Po where the legions winter.';

  /* ============================ the days ============================ */
  function day(S, api) {
    const w = ensure(S);
    /* the villa pays every day, and the steward writes once a week */
    const inc = income(w);
    if (inc) { S.denarii += inc; if (S.day - w.lastIncome >= 7) { api.toast('A letter from Philo', 'the villa has sent ' + (inc * (S.day - w.lastIncome)) + ' ⚖ this week', 'scroll'); w.lastIncome = S.day; } }
    if (S.end) return;
    if (S.day >= w.nextPetition) { w.queue.push({ type: 'petition', p: Math.floor(rnd() * PETITIONS.length) }); w.nextPetition = S.day + 2 + Math.floor(rnd() * 3); }
    if (!w.rival.done && S.day >= w.rival.next) { const m = rivalMove(S); if (m) w.queue.push(m); w.rival.next = S.day + 3 + Math.floor(rnd() * 3); }
    if (S.day >= w.nextEvent && rnd() < .45) { const ev = EVENTS(); w.queue.push({ type: 'event', id: ev[Math.floor(rnd() * ev.length)].id }); w.nextEvent = S.day + 2; }
    if (w.queue.length > 3) w.queue = w.queue.slice(-3);
  }

  /* one waiting thing at a time, and only when nothing else is on the screen */
  function tick(S, api) {
    if (!S || !S.wider || !S.wider.queue.length || api.busy()) return;
    if (S.map === 'room' && isRegion(S.room)) return;           // clients, rivals and the city's news wait until you are back in Rome
    const it = S.wider.queue.shift(); api.save();
    if (it.type === 'petition') return petition(S, api, PETITIONS[it.p] || PETITIONS[0]);
    if (it.type === 'event') return event(S, api, EVENTS().find(e => e.id === it.id));
    if (it.type === 'rival') return rival(S, api, MOVES.find(m => m.id === it.id));
    if (it.type === 'reckoning') return reckoning(S, api);
  }
  function panel(api, title, intro, rows, after) {
    api.modal(title, '<p style="margin:0 0 12px">' + intro + '</p><div class="trchoices">' + rows.map((r, i) =>
      '<button class="trc" data-i="' + i + '"' + (r.off ? ' disabled' : '') + '><b>' + api.esc(r.t) + '</b><span>' + r.d + '</span></button>').join('') + '</div>', true);
    const mx = document.getElementById('mx'); if (mx) mx.onclick = () => { api.close(); after(rows[rows.length - 1]); };   // closing the panel is the last, quietest answer
    document.querySelectorAll('#modal .trc').forEach(b => b.onclick = () => { const r = rows[+b.dataset.i]; api.close(); after(r); });
  }
  const costText = c => Object.keys(c).map(k => k === 'denarii' ? c[k] + ' ⚖' : c[k] + ' ' + k).join(', ');
  const affords = (S, c) => (!c.denarii || S.denarii >= c.denarii) && (!c.auctoritas || S.auctoritas >= c.auctoritas);
  function petition(S, api, p) {
    const w = S.wider;
    panel(api, '🌅 The morning salutatio', 'At dawn, <b>' + p.who + '</b> is waiting in your atrium with the other clients. ' + p.ask + ' You have ' + w.clients + ' clients.', [
      { t: p.give, d: 'Costs ' + costText(p.cost) + '. They will be yours.', off: !affords(S, p.cost), yes: 1 },
      { t: 'Hear them out and send them away', d: 'It costs nothing, and the street will hear about it.' }
    ], r => {
      if (r.yes) {
        const eff = { rep: { people: 2 } }; if (p.cost.denarii) eff.denarii = -p.cost.denarii; if (p.cost.auctoritas) eff.auctoritas = -p.cost.auctoritas;
        api.applyEff(eff); w.clients++;
        if (p.bonus && (!p.chance || rnd() < p.chance)) api.applyEff(p.bonus);
        api.toast('A new client', p.who + ' is yours now · ' + w.clients + ' clients', 'good'); api.sfx('good');
      } else { api.applyEff({ rep: { people: -1 } }); api.toast('Sent away', 'the line at your door is a little shorter tomorrow', 'bad'); }
      api.save();
    });
  }
  function event(S, api, ev) {
    if (!ev) return;
    panel(api, '📣 ' + ev.n, ev.d, ev.opts.map(o => ({ t: o.t, d: o.cost ? o.cost + ' ⚖' : 'No cost', off: o.cost && S.denarii < o.cost, o })), r => {
      const o = r.o; if (o.cost) api.applyEff({ denarii: -o.cost }); api.applyEff(o.eff || {});
      if (o.clients) { S.wider.clients += o.clients; }
      api.say('narrator', [o.msg]); api.save();
    });
  }
  function rival(S, api, m) {
    if (!m) return;
    const rv = S.wider.rival, who = rivalOf(S), caesar = S.mode === 'caesar';
    panel(api, '🐍 ' + who.name + ' moves', (caesar ? m.caesar : m.career) + ' <span class="mute">(his campaign against you: ' + Math.round(rv.heat) + '/100)</span>', [
      { t: m.answer.act, d: 'Meet it head on. Done well, it costs him; done badly, it costs you.', fight: 1 },
      { t: m.payText, d: 'Costs ' + m.pay + ' ⚖. It goes away, for now.', off: S.denarii < m.pay, pay: 1 },
      { t: 'Let it stand', d: 'Say nothing, and let the city decide.' }
    ], r => {
      if (r.fight) {
        return window.TRIALS.run(api.trialApi(), { kind: m.answer.kind, step: m.answer, title: who.name + ' · ' + m.answer.act }, res => {
          const g = res.grade;
          if (g >= 1) { rv.heat = clamp(rv.heat - (g === 2 ? 18 : 10), 0, 100); rv.beats++; api.applyEff({ xp: 14, rep: { [res.house || 'people']: g === 2 ? 4 : 2 }, auctoritas: g === 2 ? 3 : 1 }); }
          else { rv.heat = clamp(rv.heat + 10, 0, 100); api.applyEff({ rep: { [res.house || 'people']: -3 } }); if (m.loseClient) S.wider.clients = Math.max(0, S.wider.clients - 1); }
          api.say(who.id, [g === 2 ? pick(['That was well done. I shall have to be cleverer, which I find I resent.', 'You have made me look foolish in public. I will remember the date.']) : g >= 1 ? 'You got out of that one. There will be others.' : g === 0 ? pick(['You see? The city is beginning to agree with me.', 'I do enjoy watching you explain yourself.']) : 'You did not even trouble to answer. I am almost hurt.']);
          api.save();
        });
      }
      if (r.pay) { api.applyEff({ denarii: -m.pay }); rv.heat = clamp(rv.heat - 4, 0, 100); api.toast('Paid off', 'it goes quiet, for now', 'scroll'); }
      else { rv.heat = clamp(rv.heat + 12, 0, 100); api.applyEff({ rep: m.ignore }); if (m.loseClient) S.wider.clients = Math.max(0, S.wider.clients - m.loseClient); api.toast('It stands', who.name + ' grows bolder', 'bad'); }
      api.save();
    });
  }
  /* the end of it: a trial in the Basilica, his name against yours, with the whole city in the seats */
  function reckoning(S, api) {
    const rv = S.wider.rival, who = rivalOf(S), caesar = S.mode === 'caesar';
    api.say(who.id, [caesar ? 'Enough. I am going to stand in the Basilica and say in front of the whole city what you are. Come and answer, if you can.' : 'Shall we stop pretending? I am bringing a charge against you in the Basilica. Bring your friends; I am bringing mine.'], {
      onEnd: () => window.TRIALS.run(api.trialApi(), { kind: 'persuade', step: { act: 'The reckoning with ' + who.name, text: 'Answer ' + who.name + ' before the court and the whole city', at: 'basilica' }, title: 'The Basilica · ' + who.name }, res => {
        if (res.grade >= 1) {
          rv.done = 'won'; S.story.flags.rivalBroken = 1;
          api.applyEff({ xp: 60, auctoritas: 20, rep: { people: 8, senate: 6 } });
          api.say('narrator', [caesar ? 'Cato sits down in silence, which is the only defeat he has ever acknowledged. He will oppose you again, because he cannot help it, but the city no longer listens to him about you.' : 'The court finds for you before the water clock has run out. Vatinius bows, gathers his togas and leaves for a long stay on his estates in Apulia.', 'You have no rival now in this city — only enemies, which is an improvement.']);
        } else if (res.grade === 0) {
          rv.heat = 50; rv.beats = 2;
          api.applyEff({ auctoritas: -10, rep: { people: -5 } });
          api.say('narrator', ['He wins the day, narrowly, and says so to everybody who will listen. It is not over. He will come again, and so will you.']);
        } else {
          rv.heat = 60; rv.beats = 2;
          api.say('narrator', ['You let your advocates speak for you. It goes neither way, and both of you leave knowing it is not over.']);
        }
        api.save();
      })
    });
  }

  install();
  return { acts, act, day, tick, ensure, isRegion, clients, REGIONS, people: id => (SPECS[id] && SPECS[id].npcs) || [] };
})();

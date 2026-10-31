/* WORLD — Rome. A hundred and twelve tiles across and seventy-six down: about four times the ground the old city
   covered. The Capitol above the Forum, the Subura's tenements, the Argiletum market, the Forum with its temples and
   colonnades, the Palatine with your own house, the Aventine, the Campus Martius with the camp and the temple of
   Mars, the baths, the long sand of the Circus Maximus, the wharves on the Tiber — and across two bridges the
   Transtiberim, where the same city lives a different life on the far bank. Streets are laid first, then district
   floors, then buildings, then all the clutter a real city has. Nine of the buildings can be walked into, and their
   insides are in rooms.js. Nothing touches a canvas until paint() is called. */
window.IMP = window.IMP || {};
(function () {
  'use strict';
  const IMP = window.IMP;
  const W = 112, H = 76, T = 32, RIVER = 82, RIVER2 = 92;
  IMP.W = W; IMP.H = H; IMP.T = T; IMP.RIVER = RIVER;
  const px = (g, x, y, w, h, c) => { g.fillStyle = c; g.fillRect(x | 0, y | 0, Math.max(1, w | 0), Math.max(1, h | 0)); };
  const pickr = (r, a) => a[Math.floor(r() * a.length)];
  const rng = seed => { let a = (seed >>> 0) || 1; return () => { a += 0x6d2b79f5; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };

  /* ---------------- the places you can walk into ---------------- */
  /* loc is the id of the interior you can walk into, or null: one field, so nothing can disagree about it */
  const B = (id, name, short, g, x, y, w, h, style, o) => Object.assign({ id, name, short, g, x, y, w, h, style, loc: id || null, col: '#c9bda3', sub: '' }, o || {});
  const PLACES = [
    /* the Forum and the north end of the Via Sacra */
    B('curia', 'Curia Hostilia', 'Curia', '🏛️', 46, 30, 8, 5, 'basilica', { col: '#cfc2a6', room: 'curia', sub: 'The Senate house. The floor is where careers are made and unmade.' }),
    B('basilica', 'Basilica Aemilia', 'Basilica', '⚖️', 55, 30, 7, 5, 'basilica', { col: '#c6b99c', room: 'basilica', sub: 'Law courts and money-changers under one long roof. Money is judged here in public.' }),
    B('rostra', 'The Rostra', 'Rostra', '🗣️', 50, 39, 3, 2, 'basilica', { col: '#d8cdb2', room: 'rostra', sub: 'The speakers\u2019 platform, hung with the bronze beaks of captured ships.' }),
    B('aedes', 'Temple of Concord', 'Concordia', '🕊️', 62, 45, 6, 5, 'temple', { col: '#e2d7bd', sub: 'Where the factions meet to pretend to agree, twice a year, for the good of the state.' }),
    B('vesta', 'Temple of Vesta', 'Vesta', '🔥', 38, 38, 4, 4, 'temple', { col: '#e6dcc2', room: 'vesta', sub: 'The sacred fire that keeps Rome alive. Six women guard it and do not marry.' }),
    B('capitolium', 'Temple of Jupiter Optimus Maximus', 'Capitolium', '⚡', 12, 10, 9, 6, 'temple', { col: '#e8dfc3', room: 'capitolium', sub: 'The greatest temple in Rome, on the hill it owns. Triumphs end here.' }),
    B('tabularium', 'Tabularium', 'Tabularium', '🗂️', 22, 12, 6, 5, 'basilica', { col: '#cbc0a2', sub: 'The public record office: laws, treaties, debts, and everything anybody would rather forget.' }),
    /* the streets of trade */
    B('macellum', 'The Macellum', 'Macellum', '🏺', 44, 14, 7, 5, 'shop', { col: '#c9bda3', room: 'macellum', sub: 'Food, wine, cloaks, arms, and a Greek tutor who has taught three consuls.' }),
    B('subura', 'The Subura', 'Subura', '🏚️', 26, 14, 7, 5, 'tavern', { col: '#b9a386', room: 'tavern', sub: 'Alleys, taverns, and murders nobody writes down.' }),
    B('balnea', 'Balneae Seniae', 'Balneae', '💧', 26, 34, 7, 5, 'bath', { col: '#cfc2a6', room: 'balnea', sub: 'Rest, gossip, health. Every rumour in the city is washed here first.' }),
    B('ludus', 'The Ludus of Sestius', 'Ludus', '🗿', 20, 58, 7, 5, 'ludus', { col: '#c9bda3', room: 'ludus', sub: 'The gladiators\u2019 school: sand, iron, superstition, and men who have nothing to lose.' }),
    B('temple', 'Temple of Mars', 'Templum Martis', '🛡️', 10, 44, 6, 5, 'temple', { col: '#e2d7bd', room: 'temple', sub: 'Omens, blessings, and the god who is always owed something before a war.' }),
    B('castra', 'The Camp on the Campus', 'Castra', '⚔️', 10, 34, 8, 5, 'barracks', { col: '#bfb298', room: 'castra', sub: 'The muster camp, just outside the sacred boundary where no army may stand. Recruit, drill, and buy men who will follow you further than the law allows.' }),
    B('domus', 'Your Domus', 'Domus', '🏠', 64, 34, 8, 6, 'domus', { col: '#d0a882', room: 'domus', sub: 'Your house: the atrium, the archive, the garden, the gods.' }),
    B('villa', 'Horti Palatini', 'Palatium', '🌿', 68, 46, 7, 5, 'villa', { col: '#d0a882', sub: 'Gardens, pavilions and clipped hedges where the great houses do their quiet business.' }),
    B('circus', 'Circus Maximus', 'Circus', '🐎', 66, 56, 3, 6, 'circus', { col: '#c6b99c', room: 'circus', sub: 'Races, the crowd, and the people\u2019s favour. Two hundred thousand of them, shouting.' }),
    B('colosseum', 'The Wooden Amphitheatre', 'Amphitheatre', '🏟️', 32, 56, 9, 9, 'ludus', { col: '#cfc2a6', sub: 'Timber stands raised for the games around one floor of sand: gladiators, beasts, and, when an editor is rich enough, a basin dug and flooded for the fleets. Rome will not have a stone one for another thirty years.' }),
    B('portus', 'Portus Tiberinus', 'Portus', '⛵', 74, 12, 6, 5, 'warehouse', { col: '#b9a386', room: 'portus', sub: 'Docks, the grain fleet, and foreign coin that has no interest in your ancestors.' }),
    B('horrea', 'Horrea Galbae', 'Horrea', '📦', 60, 12, 7, 5, 'warehouse', { col: '#b9a386', sub: 'State warehouses: the grain reserve, the fleet\u2019s rope, and a great many rats.' }),
    /* across the river */
    B('janiculum', 'Temple of the Janiculum', 'Janiculum', '🌄', 98, 42, 8, 6, 'temple', { col: '#ded2b4', sub: 'The ridge across the water. From here Rome is a noise, not a place.' }),
    B('transforum', 'Forum of the Traders', 'Forum', '🐟', 96, 22, 6, 5, 'shop', { col: '#c9bda3', room: 'macellum', sub: 'Not the Roman Forum: the fish market, the salt sellers and the sailors\u2019 chapel.' })
  ];
  /* ---------------- the houses of everybody else ---------------- */
  const D = [];
  const row = (style, x, y, w, h, col) => D.push(B(null, null, null, null, x, y, w, h, style, { col }));
  /* what kind of house belongs on this street corner: the fill pass uses it to give each district its own face */
  const houseAt = (x, y, r) => {
    if (x > 92) return r() < .22 ? 'shop' : 'insulae';                       // the far bank
    if (x > 70 && y < 30) return 'warehouse';                                // the wharves
    if (x < 22 && y < 24) return 'villa';                                    // the Capitol, where the old families live
    if (x >= 29 && x <= 41 && y >= 54 && y <= 66) return r() < .35 ? 'shop' : 'insulae';   // the amphitheatre quarter
    if (x < 46 && y < 30) return r() < .28 ? 'shop' : 'insulae';             // the Subura
    if (x >= 40 && x < 54 && y < 26) return r() < .5 ? 'shop' : 'insulae';    // the Argiletum
    if (y >= 30 && y < 52 && x >= 56) return 'villa';                        // the Palatine
    if (y >= 50 && x < 62) return r() < .2 ? 'shop' : 'insulae';             // the Aventine
    if (x < 36 && y >= 32) return r() < .3 ? 'barracks' : r() < .5 ? 'shop' : 'hut';
    if (y > 62) return r() < .5 ? 'hut' : 'villa';
    return r() < .2 ? 'shop' : 'insulae';
  };
  /* a few buildings are placed by hand, because they are the landmarks of their district. Everything else is
     filled in by the village pass in plan(), which walks the map and puts a house on every block of plain ground. */
  row('temple', 26, 66, 6, 4, '#e2d7bd');                  // the old temple on the Aventine
  row('barracks', 22, 40, 4, 6, '#bfb298'); row('barracks', 22, 50, 4, 6, '#bfb298');
  row('villa', 76, 30, 7, 5, '#d0a882');                   // the great house on the Palatine
  /* outside the walls: farms, market gardens, tombs and the roads out of the city */
  row('hut', 20, 1, 6, 2, '#b9a386'); row('hut', 62, 1, 7, 2, '#b9a386'); row('hut', 84, 1, 6, 2, '#b9a386');
  row('hut', 12, 71, 7, 3, '#b9a386'); row('hut', 40, 71, 7, 3, '#b9a386');
  row('tomb', 52, 71, 4, 3, '#c6b99c'); row('tomb', 58, 71, 4, 3, '#c6b99c');
  row('villa', 70, 71, 8, 3, '#d0a882'); row('villa', 0, 30, 4, 5, '#d0a882'); row('villa', 0, 12, 4, 4, '#d0a882');
  row('warehouse', 94, 62, 8, 6, '#b9a386'); row('villa', 100, 4, 7, 4, '#d0a882');
  const BUILDINGS = PLACES.concat(D);
  IMP.BUILDINGS = BUILDINGS;

  /* props the player walks behind rather than in front of */
  const OVERP = { arch: 1, laundry: 1, banner: 1 };

  /* ---------------- the plan ---------------- */
  function plan() {
    const r = rng(20261027);
    const tile = [], solid = new Uint8Array(W * H);
    for (let y = 0; y < H; y++) { const r2 = []; for (let x = 0; x < W; x++) r2.push(['grass', Math.floor(r() * 6)]); tile.push(r2); }
    const set = (x, y, k, v) => { if (x < 0 || y < 0 || x >= W || y >= H) return; tile[y][x] = [k, v === undefined ? Math.floor(r() * 6) : v]; };
    const rect = (x, y, w, h, k) => { for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) set(i, j, k); };
    const streets = new Uint8Array(W * H);             // the Tiber runs between RIVER and RIVER2
    const road = (x, y, w, h, k) => { rect(x, y, w, h, k || 'cobble'); for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) if (i >= 0 && j >= 0 && i < W && j < H) streets[j * W + i] = 1; };

    /* the world outside the walls */
    rect(0, 0, W, H, 'dirt');
    rect(0, 0, W, 4, 'grass'); rect(0, 70, W, H - 70, 'grass'); rect(0, 0, 5, H, 'grass'); rect(108, 0, 4, H, 'grass');
    rect(18, 0, 34, 3, 'grass'); rect(88, 0, 24, 4, 'grass');
    rect(RIVER, 0, RIVER2 - RIVER, H, 'water');
    for (let y = 0; y < H; y++) { set(RIVER - 1, y, 'sand'); set(RIVER2, y, 'sand'); }
    rect(30, 60, 52, 10, 'grass');                        // the Aventine's green flank
    rect(6, 62, 22, 12, 'grass');
    /* the city floor and the wall that holds it */
    rect(5, 5, 76, 64, 'cobble');
    rect(4, 4, 78, 1, 'wall'); rect(4, 68, 78, 1, 'wall'); rect(4, 4, 1, 65, 'wall'); 
    rect(4, 20, 1, 1, 'cobble'); rect(4, 44, 1, 1, 'cobble');
    rect(30, 4, 3, 1, 'cobble'); rect(64, 4, 3, 1, 'cobble'); rect(48, 68, 3, 1, 'cobble');
    /* the far bank, and no wall on it: it is not worth defending */
    rect(93, 5, 17, 60, 'cobble2');
    rect(93, 5, 1, 60, 'grass');

    /* the avenues. Every one of these is a tile a house may never stand on. */
    road(5, 5, 2, 64);                                    // the cardo, north to south inside the wall
    road(5, 24, 76, 3); road(5, 48, 76, 2);               // the two great east-west streets
    road(26, 5, 2, 64); road(42, 5, 3, 64);               // the Subura's spine and the Argiletum
    road(38, 5, 2, 64);
    road(58, 5, 2, 64);                                   // the Via Lata
    road(70, 5, 3, 64);                                   // the road to the wharves
    road(46, 34, 3, 34); road(64, 34, 3, 34);             // down to the Forum and the Palatine
    road(60, 20, 3, 30); road(50, 44, 3, 24);
    for (let x = 30; x < 42; x += 3) road(x, 42, 1, 26);
    /* the Forum itself: a paved plain with the Via Sacra across it */
    rect(44, 26, 24, 22, 'plaza'); rect(46, 28, 20, 18, 'marble');
    road(44, 36, 24, 3); road(50, 26, 3, 22);
    rect(48, 40, 10, 5, 'plaza');
    /* the Saepta and the Campus Martius parade ground */
    rect(12, 36, 16, 12, 'stone'); rect(14, 38, 12, 8, 'plaza');
    rect(6, 50, 22, 12, 'grass'); rect(8, 52, 18, 8, 'dirt'); rect(10, 54, 6, 4, 'sand');
    /* the Capitol */
    rect(8, 8, 16, 12, 'plaza'); rect(10, 10, 12, 8, 'marble');
    /* the Palatine gardens */
    rect(58, 32, 22, 22, 'garden'); rect(66, 50, 12, 6, 'flower');
    /* the baths and the market */
    rect(24, 32, 14, 10, 'stone');
    rect(40, 12, 12, 8, 'plaza');
    /* the Circus Maximus: an oval of sand with an island down the middle */
    rect(62, 54, 20, 14, 'stone');
    const ox = 72, oy = 61, rx = 9.4, ry = 6.2;
    for (let y = 54; y < 68; y++) for (let x = 62; x < 82; x++) {
      const dx = (x - ox) / rx, dy = (y - oy) / ry;
      if (dx * dx + dy * dy <= 1) set(x, y, 'track');
    }
    rect(71, 60, 2, 3, 'marble');
    /* the wharves */
    rect(72, 6, 8, 22, 'stone'); rect(74, 8, 5, 16, 'dirt');
    /* the far bank: a market square under the hill */
    rect(94, 20, 10, 10, 'plaza'); rect(96, 22, 6, 6, 'marble');
    rect(94, 34, 12, 4, 'garden');
    /* two bridges, and the roads that lead onto them */
    road(74, 28, 20, 2, 'wood'); road(74, 52, 20, 2, 'wood');
    road(93, 28, 14, 2); road(93, 52, 14, 2);
    road(93, 24, 2, 32); road(104, 24, 2, 32);

    /* nothing that stands up is walkable */
    const blocked = { wall: 1, water: 1 };
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (blocked[tile[y][x][0]]) solid[y * W + x] = 1;

    /* ---------------- the houses ---------------- */
    /* A house may only stand on plain ground — never on a marked street, never on a paved square or a temple floor,
       never on top of another house, and never tight against one, so there is always an alley between two blocks.
       The landmarks in PLACES are placed first and everything else gives way to them. */
    const STAND_ON = { cobble: 1, cobble2: 1, dirt: 1, grass: 1, garden: 1, flower: 1, sand: 1 };
    const placed = [], reservedDoor = new Uint8Array(W * H);
    const doorOf = b => ({ x: b.x + ((b.w - 1) >> 1), y: b.y + b.h - 1 });
    const clearApron = b => {
      const d = doorOf(b);
      for (let dx = 0; dx < 3; dx++) for (let dy = 1; dy <= 2; dy++) {
        const x = d.x - 1 + dx, y = d.y + dy;
        if (x < 0 || y < 0 || x >= W || y >= H) return false;
        if (!STAND_ON[tile[y][x][0]]) return false;
      }
      return true;
    };
    const overlaps = (b, pad) => placed.some(q => !(b.x + b.w + pad <= q.x || q.x + q.w <= b.x - pad || b.y + b.h + pad <= q.y || q.y + q.h <= b.y - pad));
    const lay = b => {
      for (let y = b.y; y < b.y + b.h; y++) for (let x = b.x; x < b.x + b.w; x++) {
        if (x < 0 || y < 0 || x >= W || y >= H) continue;
        solid[y * W + x] = 1; tile[y][x] = ['stone', (x + y) % 6];
      }
    };
    PLACES.forEach(b => { if (overlaps(b, 0)) return; placed.push(b); lay(b); const d = doorOf(b); for (let dx = -2; dx <= 2; dx++) for (let dy = 1; dy <= 3; dy++) { const x = d.x + dx, y = d.y + dy; if (x >= 0 && y >= 0 && x < W && y < H) reservedDoor[y * W + x] = 1; } });
    const why = b => {
      if (overlaps(b, 1)) return 'overlap';
      for (let y = b.y; y < b.y + b.h; y++) for (let x = b.x; x < b.x + b.w; x++) {
        if (x < 1 || y < 1 || x >= W - 1 || y >= H - 1) return 'edge';
        const i = y * W + x;
        if (streets[i]) return 'street';
        if (reservedDoor[i]) return 'door';
        if (!STAND_ON[tile[y][x][0]]) return 'kind:' + tile[y][x][0];
      }
      return clearApron(b) ? 'ok' : 'apron';
    };
    const good = b => why(b) === 'ok';
    D.forEach(b => { if (!good(b)) return; placed.push(b); lay(b); });
    /* the fill pass: every block of plain ground in the city gets houses, which is what makes it read as a city
       rather than a plan. Six tiles apart with a house five wide leaves the one-tile alleys Rome was famous for. */
    const fr = rng(4711);
    for (let y = 6; y < 70; y += 6) for (let x = 6; x < W - 6; x += 6) {
      const w = 4 + (fr() < .35 ? 1 : 0), h = 4 + (fr() < .45 ? 1 : 0);
      const b = B(null, null, null, null, x, y, w, h, houseAt(x, y, fr), { col: fr() < .5 ? '#c9bda3' : fr() < .6 ? '#bdae92' : '#cfc4ab' });
      if (!good(b)) continue;
      placed.push(b); lay(b);
    }
    /* a second, tighter pass: four-tile houses on a five-tile grid, which fills the alleys of the Subura and the
       far bank where the earlier grid was too coarse to fit anything. */
    for (let y = 4; y < 72; y += 5) for (let x = 4; x < W - 4; x += 5) {
      const b = B(null, null, null, null, x, y, 4, 4, houseAt(x, y, fr), { col: fr() < .6 ? '#c2b294' : '#cdc0a4' });
      if (!good(b)) continue;
      placed.push(b); lay(b);
    }
    /* and a third, tightest pass: workshops, sheds and the little offices that squeeze between the big houses */
    for (let y = 3; y < 73; y += 4) for (let x = 3; x < W - 3; x += 4) {
      const b = B(null, null, null, null, x, y, 3, 3, fr() < .35 ? 'shop' : houseAt(x, y, fr), { col: fr() < .5 ? '#c6b99c' : '#bcae91' });
      if (!good(b)) continue;
      placed.push(b); lay(b);
    }
    const FINAL = placed;
    IMP.buildingsPlaced = FINAL.length;
    /* and neither is the water under a bridge */
    for (let y = 26; y < 32; y++) for (let x = 74; x < 94; x++) if (tile[y][x][0] === 'wood') solid[y * W + x] = 0;
    for (let y = 50; y < 56; y++) for (let x = 74; x < 94; x++) if (tile[y][x][0] === 'wood') solid[y * W + x] = 0;

    /* ---------------- the clutter ---------------- */
    const SOLIDP = { statue: 1, column: 1, fountain: 1, obelisk: 1, well: 1, cypress: 1, pine: 1, olive: 1, fig: 1, hedge: 1, torches: 1, lamp: 1, altar: 1, tomb: 1, cart: 1, stall: 1, crane: 1, ship: 1, milestone: 1, oxen: 1, haystack: 1, standard: 1 };
    const props = [], lights = [], reserved = new Uint8Array(W * H);
    const open = (x, y) => x > 4 && y > 4 && x < W - 1 && y < H - 1 && !solid[y * W + x] && !reserved[y * W + x];
    FINAL.forEach(b => {                                     // keep the street outside every door clear
      const d = doorOf(b);
      for (let dx = -1; dx <= 1; dx++) for (let dy = 1; dy <= 3; dy++) {
        const x = d.x + dx, y = d.y + dy;
        if (x >= 0 && y >= 0 && x < W && y < H) reserved[y * W + x] = 1;
      }
    });
    const neighbours = (x, y, allowSolid) => [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(d => { const nx = x + d[0], ny = y + d[1]; return nx >= 0 && ny >= 0 && nx < W && ny < H && (allowSolid || !solid[ny * W + nx]); }).length;
    const put = (name, x, y, seed, wet) => {
      if (x < 0 || y < 0 || x >= W || y >= H) return null;
      if (wet ? tile[y][x][0] !== 'water' : !open(x, y)) return null;
      if (SOLIDP[name] && !wet && neighbours(x, y) < 3) return null;   // never seal a street with a statue
      reserved[y * W + x] = 1;
      const p = { name, x, y, seed: seed === undefined ? Math.floor(r() * 1000) : seed };
      props.push(p); return p;
    };
    const scatter = (name, x, y, w, h, n, seed, wet) => { const rr = rng(seed || 7); for (let i = 0; i < n; i++) put(name, x + Math.floor(rr() * w), y + Math.floor(rr() * h), Math.floor(rr() * 1000), wet); };
    const line = (name, x, y, dx, dy, n, seed) => { for (let i = 0; i < n; i++) put(name, x + dx * i, y + dy * i, (seed || 0) + i); };

    /* the Forum: colonnades, statues, fountains, banners, and the Via Sacra running through it */
    for (let x = 45; x < 67; x += 2) { put('column', x, 27); put('column', x, 46); }
    for (let y = 29; y < 45; y += 2) { put('column', 44, y); put('column', 67, y); }
    put('statue', 47, 31); put('statue', 64, 31); put('statue', 47, 43); put('statue', 64, 43);
    put('fountain', 55, 42); put('fountain', 47, 34); put('fountain', 64, 34);
    put('altar', 55, 28); put('obelisk', 55, 39); put('well', 52, 44); put('well', 58, 45);
    line('banner', 46, 29, 4, 0, 5, 40); line('banner', 62, 35, 0, 3, 4, 50);
    put('bench', 51, 35); put('bench', 58, 35); put('bench', 51, 46); put('bench', 58, 27);
    line('torches', 46, 26, 3, 0, 8, 60); line('torches', 46, 47, 3, 0, 8, 70);
    put('arch', 68, 36); put('arch', 43, 36, 2);            // the arches at either end of the Via Sacra
    put('milestone', 68, 39); put('statue', 68, 43);
    scatter('vines', 46, 28, 20, 18, 7, 91);
    /* the Capitol */
    for (let x = 11; x < 22; x += 2) put('column', x, 17);
    put('statue', 13, 20); put('statue', 20, 20); put('altar', 16, 18); put('obelisk', 16, 22);
    line('cypress', 9, 9, 0, 2, 4, 92); line('cypress', 23, 9, 0, 2, 4, 93);
    scatter('cypress', 6, 8, 20, 12, 8, 94); scatter('milestone', 8, 18, 16, 4, 4, 95);
    put('well', 12, 21); put('bench', 20, 21);
    /* the Subura: laundry over every alley, stalls in every corner, and nothing straight */
    for (let y = 7; y < 28; y += 4) line('laundry', 24, y, 6, 0, 7, y);
    for (let y = 12; y < 28; y += 6) line('laundry', 30, y, 6, 0, 6, y + 3);
    scatter('stall', 23, 7, 20, 26, 16, 101); scatter('amphorae', 23, 7, 20, 26, 18, 102);
    scatter('well', 23, 7, 20, 26, 5, 103); scatter('vines', 23, 7, 20, 26, 20, 104);
    scatter('cart', 23, 7, 20, 26, 6, 105); scatter('dog', 23, 7, 20, 26, 7, 106);
    scatter('chicken', 23, 7, 20, 26, 9, 107); scatter('haystack', 23, 7, 20, 26, 4, 108);
    scatter('flowers', 23, 7, 20, 26, 14, 109); scatter('reeds', 23, 7, 20, 26, 5, 110);
    line('torches', 25, 10, 0, 6, 4, 111);
    /* the Argiletum market and the macellum */
    scatter('stall', 40, 6, 12, 26, 14, 121); scatter('amphorae', 40, 6, 12, 26, 16, 122);
    scatter('cart', 40, 6, 12, 26, 5, 123); scatter('bench', 41, 24, 10, 8, 5, 124);
    scatter('chicken', 40, 6, 12, 26, 6, 125); scatter('oxen', 40, 6, 12, 26, 3, 126);
    line('banner', 41, 7, 3, 0, 4, 127); line('laundry', 40, 24, 7, 0, 6, 128);
    /* the Palatine: clipped hedges, cypresses, fountains and lamps */
    scatter('cypress', 58, 32, 22, 22, 22, 141); scatter('olive', 58, 32, 22, 22, 10, 142);
    scatter('hedge', 60, 42, 18, 8, 9, 143); scatter('bench', 58, 32, 22, 22, 10, 147);
    scatter('vines', 58, 32, 22, 22, 12, 148); scatter('flowers', 62, 34, 16, 16, 22, 149);
    put('fountain', 76, 40); put('statue', 76, 36); put('statue', 62, 47); put('well', 60, 34);
    line('column', 60, 32, 4, 0, 5, 145); line('lamp', 60, 49, 4, 0, 5, 146);
    put('arch', 70, 32); scatter('fig', 58, 32, 22, 22, 4, 150);
    /* the Aventine */
    scatter('stall', 44, 52, 16, 16, 10, 151); scatter('laundry', 44, 52, 16, 16, 8, 152);
    scatter('amphorae', 44, 52, 16, 16, 12, 153); scatter('dog', 44, 52, 16, 16, 5, 154);
    scatter('cypress', 44, 62, 16, 6, 8, 155); scatter('haystack', 44, 52, 16, 16, 5, 156);
    put('altar', 48, 60); put('statue', 56, 60);
    /* the Campus Martius: parade ground, altars, milestones, and the tombs of old families */
    scatter('olive', 6, 34, 24, 28, 16, 161); scatter('cypress', 6, 46, 12, 16, 10, 162);
    scatter('pine', 16, 50, 12, 12, 6, 163); scatter('milestone', 8, 36, 18, 12, 8, 164);
    scatter('haystack', 6, 50, 12, 12, 5, 165); scatter('oxen', 6, 50, 12, 12, 4, 166);
    put('obelisk', 18, 40); put('altar', 18, 44); put('standard', 14, 40); put('standard', 22, 40);
    line('banner', 12, 36, 4, 0, 4, 167); line('torches', 10, 47, 4, 0, 5, 168);
    put('statue', 26, 46); put('fountain', 22, 52);
    /* the baths */
    scatter('cypress', 24, 31, 14, 2, 4, 171); put('fountain', 30, 40); put('bench', 26, 41);
    put('statue', 34, 33); put('well', 24, 33);
    /* the Circus: rails, booths, banners and the spina */
    put('obelisk', 71, 60, 3); put('altar', 72, 62); put('statue', 70, 62, 5);
    line('banner', 64, 53, 3, 0, 6, 181); line('banner', 64, 68, 3, 0, 6, 182);
    scatter('bench', 62, 52, 20, 2, 12, 183); scatter('bench', 62, 68, 20, 2, 12, 184);
    scatter('stall', 62, 54, 2, 14, 6, 185); scatter('stall', 80, 54, 2, 14, 6, 186);
    scatter('torches', 62, 52, 20, 14, 12, 187); scatter('standard', 62, 52, 20, 14, 4, 188);
    /* the wharves: ships on the river, cranes on the quay, rope and oil on the stones */
    put('ship', 84, 12, 1, 1); put('ship', 84, 20, 2, 1); put('ship', 84, 30, 3, 1); put('ship', 84, 40, 4, 1); put('ship', 84, 50, 5, 1);
    put('crane', 79, 12); put('crane', 79, 26); put('crane', 79, 44); put('crane', 79, 58);
    scatter('amphorae', 73, 6, 7, 24, 18, 191); scatter('cart', 73, 6, 7, 24, 6, 192);
    scatter('haystack', 73, 6, 7, 24, 5, 193); scatter('stall', 72, 20, 8, 8, 5, 194);
    for (let y = 6; y < 66; y += 3) put('reeds', 81, y, y);
    put('ship', 84, 6, 6, 1); put('ship', 84, 60, 7, 1);
    scatter('water', 84, 4, 7, 64, 90, 195, 1);
    line('torches', 78, 24, 0, 4, 4, 196);
    /* the gardens and tombs outside the walls */
    scatter('tomb', 20, 69, 40, 4, 8, 201); scatter('cypress', 14, 69, 30, 5, 12, 202);
    scatter('milestone', 24, 0, 40, 4, 6, 203); scatter('olive', 6, 68, 40, 5, 10, 204);
    scatter('haystack', 6, 68, 24, 6, 6, 205); scatter('pine', 24, 0, 20, 4, 6, 206);
    scatter('haystack', 88, 0, 20, 4, 6, 207); scatter('olive', 88, 0, 20, 4, 6, 208);
    scatter('flowers', 30, 60, 52, 10, 30, 209); scatter('cypress', 30, 62, 52, 8, 12, 210);
    /* the far bank */
    scatter('stall', 93, 5, 16, 60, 16, 221); scatter('amphorae', 93, 5, 16, 60, 16, 222);
    scatter('laundry', 93, 5, 16, 60, 10, 223); scatter('cart', 93, 5, 16, 60, 6, 224);
    scatter('dog', 93, 5, 16, 60, 6, 225); scatter('cypress', 94, 34, 14, 20, 14, 226);
    scatter('olive', 94, 34, 14, 20, 8, 227); scatter('reeds', 93, 6, 2, 58, 20, 228);
    put('fountain', 98, 26); put('statue', 96, 18); put('well', 104, 30);
    line('torches', 93, 30, 0, 5, 5, 229); line('banner', 94, 20, 3, 0, 4, 230);
    scatter('ship', 84, 20, 6, 40, 4, 231, 1);

    props.forEach(p => { if (p.name === 'torches' || p.name === 'lamp' || p.name === 'altar') lights.push(p); });
    props.forEach(p => { if (SOLIDP[p.name]) { const i = p.y * W + p.x; if (!solid[i]) solid[i] = 1; } });
    /* the invisible facts the game needs: where water is, where a light is, where you may not walk */
    return { tile, solid, buildings: FINAL, props, lights, streets };
  }

  /* how long a shadow each kind of standing thing throws, in pixels */
  const CASTS = { cypress: 30, pine: 26, olive: 18, fig: 18, column: 26, obelisk: 30, statue: 16, crane: 26, cart: 8, stall: 10, fountain: 8, hedge: 6, torches: 8, lamp: 10, altar: 6, haystack: 8, oxen: 8, standard: 14, milestone: 4, well: 4, tomb: 10 };

  /* The ground, made to read as one place instead of a grid of tiles: broad patches of warmer and cooler light so no
     two streets look stamped from the same block, a dressed kerb wherever a paved street meets something else, and
     grass that creeps over the edge of the paving instead of stopping at a straight line. */
  function ground(g, p) {
    const r = rng(90210);
    g.save();
    for (let i = 0; i < 520; i++) {
      const x = r() * W * T, y = r() * H * T, rad = 60 + r() * 180;
      const warm = r() < .55, gr = g.createRadialGradient(x, y, 0, x, y, rad);
      gr.addColorStop(0, warm ? 'rgba(255,214,150,.07)' : 'rgba(40,52,70,.07)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
    g.restore();
    const kind = (x, y) => (x < 0 || y < 0 || x >= W || y >= H) ? '' : p.tile[y][x][0];
    const paved = k => k === 'cobble' || k === 'cobble2' || k === 'plaza' || k === 'marble' || k === 'stone';
    const green = k => k === 'grass' || k === 'garden' || k === 'flower';
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const X = x * T, Y = y * T, k = kind(x, y);
      if (p.streets[y * W + x] && (k === 'cobble' || k === 'cobble2')) {
        /* a kerb on any side where the street stops */
        /* only where the street meets something different: between two pavings of the same stone a kerb is just a
           line across the picture */
        const edgeOf = (nx, ny) => { const nk = kind(nx, ny); return nk && !p.streets[ny * W + nx] && nk !== 'water' && nk !== 'wall' && nk !== 'wood' && nk !== 'cobble' && nk !== 'cobble2' && nk !== 'stone'; };
        if (edgeOf(x, y - 1)) { px(g, X, Y, T, 3, '#a39986'); px(g, X, Y, T, 1, '#c4baa6'); px(g, X, Y + 3, T, 1, 'rgba(20,14,10,.3)'); }
        if (edgeOf(x, y + 1)) { px(g, X, Y + T - 3, T, 3, '#9a907c'); px(g, X, Y + T - 3, T, 1, '#bdb39e'); }
        if (edgeOf(x - 1, y)) { px(g, X, Y, 3, T, '#a39986'); px(g, X, Y, 1, T, '#c4baa6'); px(g, X + 3, Y, 1, T, 'rgba(20,14,10,.22)'); }
        if (edgeOf(x + 1, y)) { px(g, X + T - 3, Y, 3, T, '#8f8572'); px(g, X + T - 3, Y, 1, T, '#b1a792'); }
        /* ruts worn by the carts, down the middle of the long streets */
        if (r() < .5) { px(g, X, Y + 11, T, 2, 'rgba(30,24,18,.08)'); px(g, X, Y + 20, T, 2, 'rgba(30,24,18,.08)'); }
      }
      if (paved(k)) {
        /* grass creeping in from any green neighbour */
        [[0, -1], [0, 1], [-1, 0], [1, 0]].forEach(([dx, dy]) => {
          if (!green(kind(x + dx, y + dy))) return;
          for (let i = 0; i < 14; i++) {
            const t = r() * T, d = r() * r() * 9;
            const gx = dx ? (dx < 0 ? X + d : X + T - 1 - d) : X + t, gy = dy ? (dy < 0 ? Y + d : Y + T - 1 - d) : Y + t;
            px(g, gx, gy, 1 + (r() < .3 ? 1 : 0), 2, pickr(r, ['#5d8040', '#4a6a33', '#6b9048', '#3d5a2a']));
          }
        });
      }
    }
  }

  /* ---------------- painting: the whole city, once, into one canvas ---------------- */
  function paint(p) {
    const base = PIX.cv(W * T, H * T), bg = base.getContext('2d');
    const sheet = PIX.tiles();
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const t = p.tile[y][x], cell = sheet.at[t[0]] || sheet.at.cobble;
      bg.drawImage(cell[t[1] % sheet.VARS], x * T, y * T);
    }
    ground(bg, p);
    const C = window.PIXCITY;
    if (C) {
      /* the city from a rooftop: shadows on the ground first, then every building, back rows before front rows so
         a nearer roof overlaps the one behind it. Each building remembers where its front wall begins (wy), which
         the dressing pass needs to hang its washing and paint its slogans on the wall and not on the roof. */
      C.shadows(bg, p.buildings);
      p.buildings.slice().sort((a, b) => (a.y + a.h) - (b.y + b.h)).forEach(b => {
        const a = C.building(b);
        bg.drawImage(a.c, b.x * T - a.ox, b.y * T - a.oy);
        b.wy = b.y * T + b.h * T - a.wall; b.roof = a.kind;
      });
    } else {
      p.buildings.forEach(b => {
        bg.drawImage(PIX.facade(b, b.style), b.x * T - 2, b.y * T - 14);
        bg.fillStyle = 'rgba(30,22,14,.22)';
        bg.fillRect(b.x * T, b.y * T + b.h * T - 6, b.w * T, 8);
      });
    }
    /* the clutter: things you stand in front of go down now, things you walk behind are drawn every frame. Anything
       that stands up throws a soft shadow down and to the right, the same way the buildings do. */
    const over = [], anim = [];
    p.props.slice().sort((a, b) => a.y - b.y).forEach(pr => {
      const art = PIX.prop(pr.name, pr.seed);
      if (!art) return;
      const x = pr.x * T + ((T - art.w) >> 1), y = pr.y * T + T - art.h;
      const tall = CASTS[pr.name];
      if (tall) {
        bg.save(); bg.fillStyle = 'rgba(28,20,40,.24)'; bg.beginPath();
        bg.ellipse(pr.x * T + 16 + tall * .35, pr.y * T + T - 3, Math.max(6, art.w * .38) + tall * .25, 4 + tall * .06, -.35, 0, 6.3); bg.fill(); bg.restore();
      }
      if (art.frames || OVERP[pr.name]) { anim.push({ art, x, y, y0: pr.y }); return; }
      bg.drawImage(art.c, x, y);
    });
    return { base, over, anim, lights: p.lights, shadows: p.shadows };
  }

  IMP.plan = plan;
  IMP.paint = paint;
  IMP.doorOf = b => ({ x: b.x + ((b.w - 1) >> 1), y: b.y + b.h - 1 });
  IMP.buildingAt = (x, y) => BUILDINGS.find(b => x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h) || null;
  /* the districts, as rectangles on the map. locAt picks the smallest one you are standing in, and a landmark
     within three tiles of you wins outright — which is how "you are at the Curia" gets to be true. */
  const DISTRICTS = [
    ['capitol', 5, 5, 20, 20], ['subura', 22, 5, 20, 24], ['argiletum', 40, 5, 18, 24], ['wharf', 68, 4, 14, 28],
    ['forum', 42, 25, 28, 24], ['palatine', 56, 29, 26, 25], ['aventine', 42, 50, 20, 18], ['circus', 60, 50, 24, 18],
    ['campus', 5, 30, 24, 30], ['trans', 92, 4, 20, 64], ['colosseum', 29, 54, 13, 13], ['outside', 0, 0, 112, 76]
  ];
  IMP.LOCS = {
    via: { id: 'via', name: 'A street in Rome', g: '🛣️', sub: 'Carts, gossip, and a loose stone by the Basilica that has taken three men down this month' },
    capitol: { id: 'capitol', name: 'The Capitol', g: '⛰️', sub: 'The hill the city keeps its promises on, and the view that has decided a thousand arguments' },
    subura: { id: 'subura', name: 'The Subura', g: '🏚️', sub: 'Alleys, taverns, laundry over your head, and murders nobody writes down' },
    argiletum: { id: 'argiletum', name: 'The Argiletum', g: '🏺', sub: 'The market street: every price in Rome, revised hourly' },
    wharf: { id: 'wharf', name: 'The river wharves', g: '⚓', sub: 'Rope, oil, grain and foreign coin, all of it arguing' },
    forum: { id: 'forum', name: 'Forum Romanum', g: '🏛️', sub: 'The heart of the city: news, trade, and every ambition in Rome' },
    palatine: { id: 'palatine', name: 'The Palatine', g: '🌿', sub: 'Gardens, clipped hedges, and houses that have outlived their families' },
    aventine: { id: 'aventine', name: 'The Aventine', g: '⛪', sub: 'The plebeian hill: older temples, cheaper bread, longer memories' },
    circus: { id: 'circus', name: 'Circus Maximus', g: '🐎', sub: 'Two hundred thousand people shouting at four horses' },
    campus: { id: 'campus', name: 'Campus Martius', g: '🛡️', sub: 'The parade ground: the army drills here and the gods keep their temples at the edge of it' },
    trans: { id: 'trans', name: 'Transtiberim', g: '🌉', sub: 'The far bank: cheaper wine, older gods, shorter memories' },
    outside: { id: 'outside', name: 'The country', g: '🌾', sub: 'Market gardens, tombs along the road, and the city behind you making its noise' },
    pons: { id: 'pons', name: 'The bridge', g: '🌉', sub: 'Two of these cross the Tiber, and both of them are always wet' },
    colosseum: { id: 'colosseum', name: 'The Amphitheatre', g: '🏟️', sub: 'Sand, rope, and forty thousand people who were promised blood before noon' }
  };
  PLACES.forEach(b => { IMP.LOCS[b.id] = b; });
  /* where each of them can be found, by third of the day */
  IMP.SCHEDULE = {
    crassus: ['curia', 'forum', 'balnea'], cato: ['curia', 'forum', 'basilica'], cicero: ['forum', 'rostra', 'curia'],
    marius: ['castra', 'forum', 'temple'], catilina: ['subura', 'forum', 'portus'], aurelia: ['vesta', 'temple', 'forum'],
    pullo: ['castra', 'subura', 'forum'], berenice: ['portus', 'forum', 'macellum'], vatinius: ['curia', 'balnea', 'forum'],
    aulus: ['domus', 'forum', 'macellum'], cornelia: ['domus', 'temple', 'forum'],    sestius: ['ludus', 'circus', 'colosseum'],
    lucia: ['macellum', 'forum', 'domus'], gaius: ['castra', 'forum', 'balnea'], marina: ['portus', 'macellum', 'forum'],
    fabius: ['tabularium', 'forum', 'macellum'], cassia: ['vesta', 'forum', 'balnea'],
    pompey: ['forum', 'curia', 'balnea'], brutus: ['basilica', 'curia', 'tabularium'], antony: ['subura', 'forum', 'castra'],
    cleopatra: ['portus', 'macellum', 'forum'], vercingetorix: ['castra', 'forum', 'curia'], sulla: ['curia', 'temple', 'domus'],
    clodius: ['subura', 'forum', 'rostra']
  };
  let LAYOUT = null;
  IMP.load = () => { if (!LAYOUT) LAYOUT = plan(); return LAYOUT; };
  IMP.isSolid = (x, y) => { const L = IMP.load(); if (x < 0 || y < 0 || x >= W || y >= H) return true; return !!L.solid[y * W + x]; };
  IMP.free = (x, y, max) => { for (let k = 0; k < (max || 10); k++) for (let dy = -k; dy <= k; dy++) for (let dx = -k; dx <= k; dx++) { const nx = x + dx, ny = y + dy; if (nx > 4 && ny > 4 && nx < W - 1 && ny < H - 1 && !IMP.isSolid(nx, ny)) return { x: nx, y: ny }; } return { x, y }; };
  /* Somebody who is "at" a building stands on its apron: the few squares of street in front of the door. n picks a
     different square of that apron, so four men scheduled to the Castra arrive shoulder to shoulder rather than
     inside one another. Squares are offered nearest the door first. */
  const APRON_ORDER = [0, -1, 1, -2, 2, -3, 3, -4, 4, -5, 5];
  IMP.spotOf = (id, n) => {
    const b = PLACES.find(x => x.id === id);
    const r = rng(String(id).length * 977 + String(id).charCodeAt(0) * 31 + 5);
    const at = Math.abs(n | 0);
    if (!b) {
      for (let i = 0; i < 300; i++) {
        const x = 46 + Math.floor(r() * 20) + ((at + i) % 7) - 3, y = 28 + Math.floor(r() * 16) + (((at + i) / 7) | 0);
        if (x > 4 && y > 4 && x < W - 1 && y < H - 1 && !IMP.isSolid(x, y)) return { x, y };
      }
      return IMP.free(55, 36, 6);
    }
    const d = IMP.doorOf(b);
    const apron = [];
    for (let dy = 1; dy <= 3; dy++) for (const dx of APRON_ORDER) {
      const x = d.x + dx, y = d.y + dy;
      if (x > 4 && y > 4 && x < W - 1 && y < H - 1 && !IMP.isSolid(x, y)) apron.push({ x, y });
    }
    if (!apron.length) return IMP.free(d.x, d.y + 1, 6);
    return apron[at % apron.length];
  };
  IMP.spawn = () => IMP.free(56, 38, 12);
  IMP.locAt = (x, y) => {
    if (x >= RIVER && x <= RIVER2) return 'pons';
    let best = null, bd = 1e9;
    PLACES.forEach(b => {
      const dx = Math.max(b.x - x, 0, x - (b.x + b.w - 1));
      const dy = Math.max(b.y - y, 0, y - (b.y + b.h - 1));
      const d = Math.hypot(dx, dy);
      if (d < bd) { bd = d; best = b; }
    });
    if (best && bd <= 3) return best.id;
    let out = 'via', area = 1e9;
    DISTRICTS.forEach(([id, dx, dy, dw, dh]) => {
      if (x >= dx && y >= dy && x < dx + dw && y < dy + dh) { const a = dw * dh; if (a < area) { area = a; out = id; } }
    });
    return out;
  };
  /* Is this spot the named place? A chapter step says `at: 'forum'` or `at: 'curia'` and the player has to be
     standing there. A building counts from its doorway outwards; a district counts anywhere inside its rectangle —
     that is what makes "go to the Subura" mean what a player expects it to mean instead of "stand in the one
     square that is not near a wall". The bridge and the open country get the same treatment as districts. */
  IMP.atPlace = (id, x, y) => {
    const b = PLACES.find(p => p.id === id);
    if (b) {
      const dx = Math.max(b.x - 1 - x, 0, x - (b.x + b.w));
      const dy = Math.max(b.y - 1 - y, 0, y - (b.y + b.h));
      return dx <= 2 && dy <= 2;
    }
    if (id === 'pons') return x >= RIVER && x <= RIVER2;
    /* the country is everything no district claims: its rectangle covers the whole map, so testing the rectangle
       made "walk out to the estate" come true in the middle of the Forum */
    if (id === 'outside') return IMP.locAt(x, y) === 'outside';
    const d = DISTRICTS.find(p => p[0] === id);
    if (!d) return false;
    return x >= d[1] && y >= d[2] && x < d[1] + d[3] && y < d[2] + d[4];
  };
  /* Where to send somebody who has been told to go there. Buildings answer with the tile in front of their door,
     districts with the middle of themselves — and whatever comes back is guaranteed standable, so the quest
     marker can never point at a square inside a wall. */
  IMP.goalOf = id => {
    if (IMP.REGION_FROM && IMP.REGION_FROM[id]) return IMP.goalOf(IMP.REGION_FROM[id]);   // a place outside Rome: the road there starts here
    const b = PLACES.find(p => p.id === id);
    if (b) { const d = { x: b.x + ((b.w - 1) >> 1), y: b.y + b.h - 1 }; return IMP.free(d.x, d.y + 1, 6); }
    if (id === 'pons') { const x = Math.round((RIVER + RIVER2) / 2); for (let y = 0; y < H; y++) if (!IMP.isSolid(x, y)) return { x, y }; }
    if (id === 'outside') {                                 // the nearest open country to the south road, outside every district
      for (let k = 0; k < 40; k++) for (let dx = -k; dx <= k; dx++) { const x = 48 + dx, y = H - 3 - (k >> 2); if (x > 0 && y > 0 && !IMP.isSolid(x, y) && IMP.locAt(x, y) === 'outside') return { x, y }; }
    }
    const d = DISTRICTS.find(p => p[0] === id);
    if (d) {
      const cx = d[1] + ((d[3] - 1) >> 1), cy = d[2] + ((d[4] - 1) >> 1);
      return IMP.free(cx, cy, 26);
    }
    return IMP.spawn();
  };
  /* breadth-first walking, used by every passer-by and by click-to-walk */
  IMP.path = (from, to, limit) => {
    if (!from || !to || IMP.isSolid(to.x, to.y)) return null;
    const key = (x, y) => y * W + x, start = key(from.x, from.y), goal = key(to.x, to.y);
    if (start === goal) return [];
    const prev = new Int32Array(W * H).fill(-1), seen = new Uint8Array(W * H);
    let q = [start]; seen[start] = 1; const steps = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    let n = 0;
    while (q.length && n < (limit || 9000)) {
      const next = [];
      for (let i = 0; i < q.length; i++) {
        const cur = q[i]; n++;
        const x = cur % W, y = (cur / W) | 0;
        for (let s = 0; s < 4; s++) {
          const nx = x + steps[s][0], ny = y + steps[s][1];
          if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
          const k = ny * W + nx;
          if (seen[k] || IMP.isSolid(nx, ny)) continue;
          seen[k] = 1; prev[k] = cur;
          if (k === goal) { const out = []; let c = k; while (c !== start) { out.unshift({ x: c % W, y: (c / W) | 0 }); c = prev[c]; } return out; }
          next.push(k);
        }
      }
      q = next;
    }
    return null;
  };
  /* a headless check: every door reachable, the streets all in one piece. Run from the console, harmless at runtime. */
  IMP.audit = () => {
    const L = IMP.load(), out = { doors: [], unreachablePlaces: [], walkingTiles: 0, treasure: [] };
    const seen = new Uint8Array(W * H), start = IMP.spawn();
    let q = [start.y * W + start.x]; seen[start.y * W + start.x] = 1;
    while (q.length) {
      const next = [];
      for (const cur of q) {
        const x = cur % W, y = (cur / W) | 0;
        [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(d => {
          const nx = x + d[0], ny = y + d[1]; if (nx < 0 || ny < 0 || nx >= W || ny >= H) return;
          const k = ny * W + nx; if (seen[k] || L.solid[k]) return; seen[k] = 1; next.push(k);
        });
      }
      q = next;
    }
    for (let i = 0; i < W * H; i++) if (seen[i]) out.walkingTiles++;
    PLACES.forEach(b => {
      const d = IMP.doorOf(b), y = d.y + 1, x = d.x;
      const ok = x >= 0 && y < H && seen[y * W + x];
      out.doors.push([b.id, !!ok]);
      if (!ok) out.unreachablePlaces.push(b.id);
    });
    return out;
  };
})();

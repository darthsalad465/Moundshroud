// Imperium: battle engine and historic scenarios for the Roman emperor game (Entertainment > Imperium).
// Pure rules, no screen: window.Rome = { TYPES, TERRAIN, SCEN, make, reach, targets, preview, move, attack, endTurn, aiStep, total }. Tested headless with AI against AI.
(function () {
  /* ---------- units ---------- */
  // cls: inf / cav / big / art decides what terrain they cross. rg = range, mn = minimum range. cost of moving is per terrain.
  const TYPES = {
    legion: { n: 'Legionaries', mv: 3, rg: 1, atk: 10, def: 11, cls: 'inf', mo: 80, d: 'Disciplined heavy infantry. Steady, and stronger in a tight line.' },
    aux: { n: 'Auxiliaries', mv: 3, rg: 1, atk: 8, def: 8, cls: 'inf', mo: 65, d: 'Allied or provincial infantry. Cheap and solid.' },
    warband: { n: 'Warband', mv: 4, rg: 1, atk: 13, def: 5, cls: 'inf', mo: 60, fury: 1, d: 'Fierce but loose. Hits very hard while confident, breaks fast.' },
    pike: { n: 'Phalanx', mv: 2, rg: 1, atk: 9, def: 12, cls: 'inf', mo: 70, spear: 1, d: 'A wall of spears. Strong against horse, weak when surrounded.' },
    archer: { n: 'Archers', mv: 3, rg: 3, atk: 7, def: 4, cls: 'inf', ranged: 1, mo: 55, d: 'Shoot from three tiles away. Fragile in melee.' },
    sling: { n: 'Skirmishers', mv: 4, rg: 2, atk: 6, def: 5, cls: 'inf', ranged: 1, mo: 55, d: 'Slingers and javelins. Quick, good against elephants.' },
    cav: { n: 'Cavalry', mv: 6, rg: 1, atk: 11, def: 6, cls: 'cav', charge: 1.4, mo: 65, d: 'Fast. Charge for extra damage after a long run.' },
    hcav: { n: 'Heavy cavalry', mv: 5, rg: 1, atk: 13, def: 10, cls: 'cav', charge: 1.55, mo: 75, d: 'Armoured horse. Devastating charge.' },
    harch: { n: 'Horse archers', mv: 6, rg: 2, atk: 8, def: 4, cls: 'cav', ranged: 1, mounted: 1, mo: 60, d: 'Shoot and ride away. Can fire after moving.' },
    eleph: { n: 'War elephants', mv: 4, rg: 1, atk: 15, def: 9, cls: 'big', fright: 1, mo: 70, d: 'Terrifying. Weak to skirmishers and archers.' },
    cata: { n: 'Artillery', mv: 1, rg: 5, mn: 2, atk: 10, def: 2, cls: 'art', ranged: 1, still: 1, mo: 60, d: 'Ballistae and catapults. Cannot move and fire in one turn.' },
    train: { n: 'Baggage', mv: 2, rg: 1, atk: 1, def: 3, cls: 'inf', mo: 40, d: 'Wagons and camp followers. Protect them.' },
    gen: { n: 'General', mv: 4, rg: 1, atk: 7, def: 9, cls: 'inf', gen: 1, mo: 90, d: 'Your commander. Nearby units fight harder and recover heart. If he falls, the army shudders.' }
  };
  // terrain: cost per class, defence multiplier, and a name
  const INF = 99;
  const TERRAIN = {
    '.': { n: 'Plain', c: { inf: 1, cav: 1, big: 1, art: 1 }, d: 1 },
    r: { n: 'Road', c: { inf: 1, cav: 1, big: 1, art: 1 }, d: 1 },
    f: { n: 'Forest', c: { inf: 2, cav: 3, big: 3, art: 3 }, d: 1.25, dc: .85 },
    h: { n: 'Hill', c: { inf: 2, cav: 2, big: 2, art: 3 }, d: 1.2, high: 1 },
    m: { n: 'Marsh', c: { inf: 3, cav: 4, big: 4, art: INF }, d: .85 },
    w: { n: 'Ford', c: { inf: 2, cav: 2, big: 2, art: INF }, d: .85 },
    '~': { n: 'Deep water', c: { inf: INF, cav: INF, big: INF, art: INF }, d: 1 },
    W: { n: 'Rampart', c: { inf: 2, cav: INF, big: INF, art: INF }, d: 1.45, dc: .9 },
    d: { n: 'Ditch', c: { inf: 3, cav: INF, big: INF, art: INF }, d: .8 },
    T: { n: 'Town', c: { inf: 1, cav: 2, big: 2, art: 2 }, d: 1.3 },
    b: { n: 'Bridge', c: { inf: 1, cav: 1, big: 1, art: 1 }, d: 1 }
  };
  const cheb = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
  const rngSeed = s => () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };

  /* ---------- map and unit building helpers for the scenarios ---------- */
  const grid = (W, H, ch) => Array.from({ length: H }, () => Array(W).fill(ch || '.'));
  const rect = (g, ch, x, y, w, h) => { for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) if (g[j] && g[j][i] !== undefined) g[j][i] = ch; };
  const U = (t, n, x, y, name, o) => Object.assign({ t, n, x, y, name: name || '' }, o || {});
  const col = (t, n, x, y0, y1, names, o) => { const r = []; const cnt = Math.abs(y1 - y0) + 1, step = y1 >= y0 ? 1 : -1; for (let i = 0; i < cnt; i++) r.push(U(t, n, x, y0 + i * step, Array.isArray(names) ? names[i] || '' : (names || '') + (names && cnt > 1 ? ' ' + (i + 1) : ''), o)); return r; };

  /* ---------- the nine battles ---------- */
  const SCEN = [];
  { // CANNAE
    const g = grid(24, 13); rect(g, '~', 0, 0, 24, 1); rect(g, 'w', 0, 1, 24, 1);
    SCEN.push({
      id: 'cannae', name: 'Cannae', year: '216 BC', war: 'Second Punic War', diff: 3, W: 24, H: 13, map: g, limit: 18, def: 1, win: 1,
      sides: [{ name: 'Rome', who: 'Varro and Paullus', col: '#d63a3a', mo: 0 }, { name: 'Carthage', who: 'Hannibal', col: '#3a7bd6', mo: 0 }],
      timeout: 0, genLoss: [false, false],
      units: [
        [U('gen', 80, 5, 6, 'Varro'),
        ...col('legion', 94, 7, 3, 8, 'Legio', { mo: 64 }), ...col('legion', 86, 6, 4, 7, 'Legio II-', { mo: 64 }), ...col('aux', 85, 7, 9, 10, 'Socii', { mo: 50 }),
        ...col('cav', 70, 7, 2, 2, 'Roman horse'), ...col('cav', 70, 7, 11, 12, 'Allied horse'), ...col('sling', 60, 10, 4, 8, 'Velites')].slice(0, 99),
        [U('gen', 80, 17, 6, 'Hannibal'),
        ...col('warband', 90, 13, 5, 8, 'Gauls and Celtiberians', { mo: 75 }), ...col('legion', 100, 15, 3, 4, 'Libyan veterans', { mo: 90 }), ...col('legion', 100, 15, 9, 10, 'Libyan veterans', { mo: 90 }),
        ...col('hcav', 80, 15, 1, 2, 'Iberian and Gallic horse'), ...col('cav', 70, 15, 11, 12, 'Numidian horse'), ...col('sling', 60, 11, 5, 8, 'Balearic slingers')]
      ],
      brief: 'August, Apulia. Rome has put its biggest army ever on the plain by the river Aufidus, packed deep to smash through the middle. Hannibal has fewer men, but he has a plan: let the centre give ground, and let the wings close around it.',
      real: 'Hannibal\'s centre bent back as planned while his African veterans folded in from both sides and his cavalry swept round the rear. Perhaps 50,000 Romans died, one of the worst days in Roman history.',
      goal: 'Break the enemy army (reduce it to a quarter of its starting strength).'
    });
  }
  { // ZAMA
    const g = grid(22, 12); rect(g, 'h', 9, 4, 2, 4);
    SCEN.push({
      id: 'zama', name: 'Zama', year: '202 BC', war: 'Second Punic War', diff: 3, W: 22, H: 12, map: g, limit: 18, def: 0, win: 0,
      sides: [{ name: 'Rome', who: 'Scipio Africanus', col: '#d63a3a' }, { name: 'Carthage', who: 'Hannibal', col: '#3a7bd6' }], genLoss: [false, false], timeout: 1,
      units: [
        [U('gen', 80, 5, 6, 'Scipio'), ...col('legion', 90, 8, 3, 9, 'Hastati', { mo: 85 }).filter((u, i) => i % 2 === 0), ...col('legion', 90, 7, 3, 9, 'Principes', { mo: 85 }).filter((u, i) => i % 2 === 0), ...col('legion', 65, 6, 4, 8, 'Triarii').filter((u, i) => i % 2 === 0),
        ...col('sling', 55, 11, 3, 9, 'Velites').filter((u, i) => i % 3 === 0), ...col('cav', 70, 8, 0, 1, 'Numidians of Masinissa'), ...col('cav', 70, 8, 10, 11, 'Roman horse of Laelius')],
        [U('gen', 80, 20, 6, 'Hannibal'), ...col('eleph', 85, 13, 2, 9, 'Elephant').filter((u, i) => i % 2 === 0), ...col('aux', 80, 14, 3, 9, 'Mercenaries').filter((u, i) => i % 2 === 0),
        ...col('aux', 70, 16, 3, 9, 'Citizen levy', { mo: 40 }).filter((u, i) => i % 2 === 0), ...col('legion', 90, 18, 4, 8, 'Hannibal\'s veterans').filter((u, i) => i % 2 === 0), ...col('cav', 65, 14, 0, 0, 'Numidian horse', { mo: 55 }), ...col('cav', 65, 14, 11, 11, 'Carthaginian horse', { mo: 55 })]
      ],
      brief: 'Near Carthage. Hannibal, back in Africa, faces the young Scipio. Eighty war elephants open the battle, and behind them stand Hannibal\'s three lines. Scipio\'s answer: open lanes in the line, and a pair of winged cavalry forces.',
      real: 'Scipio\'s men let the elephants run through the lanes or scared them off, and his cavalry chased off the Carthaginian horse. They returned to hit the rear of Hannibal\'s veterans. Carthage lost the war.',
      goal: 'Break the enemy army before dusk (turn 18). If time runs out, Carthage holds.'
    });
  }
  { // CARRHAE
    const g = grid(22, 12); rect(g, 'h', 10, 5, 2, 2); rect(g, 'h', 3, 0, 2, 2);
    SCEN.push({
      id: 'carrhae', aggr: [.5, 1.2], name: 'Carrhae', year: '53 BC', war: 'Parthian War', diff: 5, W: 22, H: 12, map: g, limit: 16, def: 0, win: 1,
      sides: [{ name: 'Rome', who: 'Marcus Crassus', col: '#d63a3a' }, { name: 'Parthia', who: 'Surena', col: '#e0a030' }], genLoss: [true, false], timeout: 0,
      units: [
        [U('gen', 80, 3, 6, 'Crassus'), ...col('legion', 85, 5, 4, 8, 'Legion'), ...col('legion', 85, 4, 5, 7, 'Legion ').filter((u, i) => i !== 1), ...col('aux', 70, 6, 3, 9, 'Auxilia').filter((u, i) => i % 3 === 0), ...col('cav', 70, 7, 5, 6, 'Gallic horse of Publius'), ...col('archer', 55, 3, 4, 8, 'Archers').filter((u, i) => i % 4 === 0)],
        [U('gen', 70, 19, 6, 'Surena'), ...col('harch', 70, 14, 1, 11, 'Horse archers').filter((u, i) => i % 2 === 0), ...col('hcav', 60, 16, 4, 8, 'Cataphracts').filter((u, i) => i % 2 === 0), ...col('harch', 70, 17, 2, 9, 'Horse archers ').filter((u, i) => i % 3 === 1)]
      ],
      brief: 'The Syrian desert. Crassus has marched seven legions after glory. Surena\'s horse archers ride in a huge cloud, loosing arrows and riding out of reach. Spare Romans stay in tight squares and wait for the camel train to run out of arrows. It will not.',
      real: 'Crassus\'s men stood in squares under arrows until his son was lured out and killed, then the army collapsed. Crassus himself was killed at a parley. Perhaps 20,000 Romans died and 10,000 were taken.',
      goal: 'Survive until dusk (turn 16) with your army intact enough not to be broken. Rome loses if Crassus falls.'
    });
  }
  { // ALESIA
    const g = grid(24, 14); rect(g, 'h', 0, 3, 7, 8); rect(g, 'T', 1, 4, 4, 6);
    rect(g, 'd', 8, 0, 1, 14); rect(g, 'W', 9, 0, 1, 14); rect(g, 'W', 16, 0, 1, 14); rect(g, 'd', 17, 0, 1, 14);
    rect(g, 'h', 12, 0, 3, 2); rect(g, 'f', 20, 0, 3, 3); rect(g, 'f', 21, 11, 3, 3); rect(g, 'h', 19, 5, 3, 3);
    SCEN.push({
      id: 'alesia', aggr: [.4, 1.8], name: 'Alesia', year: '52 BC', war: 'Gallic War', diff: 4, W: 24, H: 14, map: g, limit: 22, def: 0, win: 0,
      sides: [{ name: 'Rome', who: 'Julius Caesar', col: '#d63a3a' }, { name: 'The Gauls', who: 'Vercingetorix', col: '#2f9e5b' }], genLoss: [true, false], timeout: 0,
      units: [
        [U('gen', 85, 12, 7, 'Caesar'), ...col('legion', 70, 10, 2, 11, 'Legio').filter((u, i) => i % 2 === 0), ...col('legion', 70, 15, 2, 11, 'Legio ').filter((u, i) => i % 3 === 0), ...col('aux', 65, 11, 4, 10, 'Auxilia').filter((u, i) => i % 3 === 0),
        ...col('cata', 50, 11, 3, 3, 'Scorpions'), ...col('cata', 50, 11, 11, 11, 'Scorpions '), ...col('cav', 60, 13, 6, 8, 'German horse', { }).filter((u, i) => i % 2 === 0), ...col('archer', 45, 13, 3, 3, 'Cretan archers')],
        [U('gen', 80, 4, 7, 'Vercingetorix'), ...col('warband', 85, 2, 4, 9, 'Mandubii and Arverni').filter((u, i) => i % 1 === 0), ...col('warband', 85, 5, 3, 10, 'Besieged Gauls').filter((u, i) => i % 2 === 0), ...col('cav', 55, 6, 5, 8, 'Gallic horse').filter((u, i) => i % 2 === 0)]
      ],
      reinf: [
        { turn: 6, side: 1, at: [23, 6], units: [U('gen', 80, 0, 0, 'Vercassivellaunus'), ...col('warband', 95, 0, 0, 9, 'Relief army').slice(0, 8), ...col('cav', 65, 0, 0, 2, 'Relief horse').slice(0, 3), ...col('archer', 50, 0, 0, 0, 'Relief archers').slice(0, 1)] }
      ],
      brief: 'Gaul, the hill town of Alesia. Caesar has trapped Vercingetorix and his army inside with two rings of ditch and wall, one facing in and one facing out. A vast Gallic army is marching to relieve the town, and will arrive around turn 6.',
      real: 'Caesar held both walls through days of attacks. At the crisis he led the reserves himself, and his German horse circled the hill and hit the relief army from behind. Vercingetorix surrendered, and Gaul was Roman.',
      goal: 'Break the Gallic armies, inside and out. Hold the walls, and keep Caesar alive: the Gauls win if he falls.'
    });
  }
  { // PHARSALUS
    const g = grid(22, 12); rect(g, '~', 8, 0, 14, 1); rect(g, 'w', 8, 1, 14, 1);
    SCEN.push({
      id: 'pharsalus', name: 'Pharsalus', year: '48 BC', war: 'Caesar\'s Civil War', diff: 3, W: 22, H: 12, map: g, limit: 16, def: 0, win: 0,
      sides: [{ name: 'Caesar', who: 'Julius Caesar', col: '#d63a3a' }, { name: 'The Senate', who: 'Pompey the Great', col: '#8c5fd6' }], genLoss: [false, true], timeout: 1,
      units: [
        [U('gen', 85, 4, 6, 'Caesar'), ...col('legion', 75, 8, 3, 10, 'Veteran legion', { mo: 90 }).filter((u, i) => i % 1 === 0).slice(0, 6), ...col('legion', 60, 7, 4, 9, 'Second line').filter((u, i) => i % 2 === 0), ...col('legion', 60, 9, 2, 4, 'Fourth line (reserves)', { hold: 3 }).slice(0, 3), ...col('cav', 55, 10, 2, 3, 'Caesar\'s horse').slice(0, 2)],
        [U('gen', 75, 17, 6, 'Pompey'), ...col('legion', 80, 14, 3, 10, 'Pompey\'s legion', { mo: 55 }).filter((u, i) => i % 1 === 0), ...col('aux', 70, 16, 4, 9, 'Senatorial levy', { mo: 45 }).filter((u, i) => i % 2 === 0), ...col('cav', 80, 14, 2, 2, 'Pompey\'s cavalry').concat(col('cav', 80, 15, 2, 3, 'Pompey\'s cavalry')), ...col('sling', 60, 13, 5, 8, 'Slingers').filter((u, i) => i % 2 === 0)]
      ],
      brief: 'Thessaly. Pompey\'s army is twice the size of Caesar\'s and he leans on the river with a mass of cavalry to flank the Caesarian right. Caesar has quietly pulled six cohorts back into a fourth line to meet the horse.',
      real: 'Pompey\'s cavalry charged and was met by Caesar\'s hidden reserves, who stabbed at their faces. The horse broke, Caesar\'s lines surged in, and Pompey fled to Egypt where he was murdered.',
      goal: 'Break the enemy army. Pompey\'s army collapses if Pompey falls. If dusk (turn 16) arrives, the Senate holds.'
    });
  }
  { // TEUTOBURG
    const g = grid(26, 10, 'f'); rect(g, 'r', 0, 4, 26, 2); rect(g, 'm', 0, 0, 12, 2); rect(g, 'm', 14, 8, 10, 2); rect(g, '.', 20, 3, 6, 4);
    SCEN.push({
      id: 'teutoburg', aggr: [1.5, 1.6], name: 'Teutoburg Forest', year: '9 AD', war: 'The Germanic revolt', diff: 5, W: 26, H: 10, map: g, limit: 16, def: 0, win: 1, exit: { side: 0, x: 25, need: 3 },
      sides: [{ name: 'Rome', who: 'Publius Quinctilius Varus', col: '#d63a3a' }, { name: 'The Germans', who: 'Arminius', col: '#6b9a3a' }], genLoss: [false, false], timeout: 1,
      units: [
        [U('gen', 80, 5, 5, 'Varus', { mo: 70 }), ...col('legion', 70, 1, 4, 4, 'XVII'), ...col('legion', 70, 3, 5, 5, 'XVIII'), ...col('legion', 70, 7, 4, 4, 'XIX'), ...col('aux', 60, 9, 5, 5, 'Auxilia'), ...col('train', 40, 5, 4, 4, 'Baggage'), ...col('train', 40, 4, 5, 5, 'Baggage '), ...col('cav', 55, 10, 4, 4, 'Cavalry'), ...col('archer', 40, 11, 5, 5, 'Archers')].map(u => Object.assign(u, { mo: u.mo || 55 })),
        [U('gen', 80, 8, 1, 'Arminius'), ...col('warband', 75, 3, 2, 3, 'Cherusci').concat(col('warband', 75, 6, 7, 8, 'Marsi')).concat(col('warband', 75, 9, 7, 8, 'Chatti')).concat(col('warband', 75, 12, 2, 3, 'Bructeri')).concat(col('warband', 75, 15, 7, 8, 'Chauci')).concat(col('warband', 75, 4, 8, 8, 'Cherusci '))].map(u => Object.assign(u, { wake: 2, hold: undefined }))
      ],
      brief: 'A rainy autumn in the German woods. Varus\'s three legions are strung out for miles along a narrow track, with their wagons, and the German war leader Arminius, whom Varus trusted, has led them into the trap. The forest on each side is full of warriors who will strike on turn 2.',
      real: 'The Romans were cut down piece by piece over three days. Varus took his own life. Three legions were lost and Augustus is said to have cried "Quinctilius Varus, give me back my legions!"',
      goal: 'Escape: get 3 of your units off the east end of the road. Or break the Germans. Very hard.'
    });
  }
  { // WATLING STREET
    const g = grid(22, 12); rect(g, 'f', 0, 0, 5, 12); rect(g, 'f', 5, 0, 8, 3); rect(g, 'f', 5, 9, 8, 3); rect(g, 'h', 5, 4, 3, 4);
    SCEN.push({
      id: 'watling', aggr: [.6, 1.5], name: 'Watling Street', year: '60 AD', war: 'Boudica\'s Revolt', diff: 3, W: 22, H: 12, map: g, limit: 14, def: 0, win: 0,
      sides: [{ name: 'Rome', who: 'Suetonius Paulinus', col: '#d63a3a' }, { name: 'The Britons', who: 'Boudica', col: '#2fa8a8' }], genLoss: [false, false], timeout: 0,
      units: [
        [U('gen', 80, 6, 6, 'Suetonius'), ...col('legion', 80, 8, 4, 7, 'XIV Gemina', { mo: 90 }), ...col('legion', 80, 7, 5, 6, 'XX Valeria', { mo: 90 }), ...col('aux', 60, 9, 5, 6, 'Auxilia'), ...col('cav', 50, 7, 3, 3, 'Cavalry'), ...col('cav', 50, 7, 8, 8, 'Cavalry '), ...col('archer', 40, 6, 4, 4, 'Archers')],
        [U('gen', 80, 18, 6, 'Boudica'), ...col('warband', 90, 14, 3, 8, 'Iceni and Trinovantes').filter((u, i) => i % 1 === 0), ...col('warband', 90, 16, 2, 9, 'Tribal host').filter((u, i) => i % 2 === 0), ...col('cav', 50, 14, 1, 2, 'War chariots').concat(col('cav', 50, 14, 9, 10, 'War chariots '))]
      ],
      brief: 'Somewhere on Watling Street. Boudica\'s revolt has burned Londinium and Camulodunum. Suetonius has fewer than 10,000 men but he has chosen a defile with a wood behind him. The Britons are so confident that they have brought their families in wagons to watch.',
      real: 'The Britons surged into the defile and were stopped by volleys of pila, then by the Roman wedge. Penned in by their own wagons, tens of thousands died. Boudica took poison, or fell ill and died.',
      goal: 'Break the enemy army. Hold the line in the gap.'
    });
  }
  { // MILVIAN BRIDGE
    const g = grid(22, 12); rect(g, '~', 19, 0, 2, 12); rect(g, 'b', 19, 5, 2, 2); rect(g, 'f', 10, 0, 3, 2); rect(g, 'f', 12, 10, 3, 2);
    SCEN.push({
      id: 'milvian', name: 'Milvian Bridge', year: '312 AD', war: 'Constantine\'s rise', diff: 2, W: 22, H: 12, map: g, limit: 14, def: 0, win: 0,
      sides: [{ name: 'Constantine', who: 'Constantine the Great', col: '#d63a3a' }, { name: 'Maxentius', who: 'Maxentius', col: '#9a8f7a' }], genLoss: [true, true], timeout: 0,
      units: [
        [U('gen', 85, 4, 6, 'Constantine', { mo: 95 }), ...col('legion', 70, 7, 3, 8, 'Gallic legion', { mo: 88 }).filter((u, i) => i % 1 === 0), ...col('hcav', 70, 6, 2, 3, 'Heavy cavalry', { mo: 88 }).concat(col('cav', 65, 6, 9, 10, 'Horse', { mo: 88 })), ...col('aux', 70, 9, 4, 7, 'Germans and Britons', { mo: 85 }).filter((u, i) => i % 2 === 0)],
        [U('gen', 80, 17, 6, 'Maxentius'), ...col('legion', 90, 13, 3, 8, 'Praetorian Guard', { mo: 80 }).filter((u, i) => i % 2 === 0), ...col('aux', 80, 14, 4, 9, 'Italian levy', { mo: 50 }).filter((u, i) => i % 2 === 0), ...col('hcav', 70, 15, 2, 3, 'Clibanarii').concat(col('hcav', 70, 15, 9, 10, 'Clibanarii ')), ...col('sling', 55, 12, 5, 7, 'Skirmishers').filter((u, i) => i % 2 === 0)]
      ],
      brief: 'The Tiber, outside Rome. Maxentius has broken the bridge behind him and left only a bridge of boats, so he can fight with the river at his back. Constantine has the sign of the Chi-Rho on his soldiers\' shields and a dream of victory: "In this sign, conquer".',
      real: 'Constantine\'s cavalry struck first and the line folded. The fleeing army jammed the bridge, which collapsed with Maxentius on it. Constantine became master of the West and later made Christianity legal.',
      goal: 'Break the enemy army. Both generals are vulnerable: if yours falls, you lose.'
    });
  }
  { // ADRIANOPLE
    const g = grid(24, 12); rect(g, 'W', 15, 2, 1, 8); rect(g, 'W', 16, 1, 1, 1); rect(g, 'W', 16, 10, 1, 1); rect(g, 'h', 10, 4, 3, 4); rect(g, 'f', 0, 0, 3, 3);
    SCEN.push({
      id: 'adrianople', aggr: [1.2, .8], name: 'Adrianople', year: '378 AD', war: 'The Gothic War', diff: 5, W: 24, H: 12, map: g, limit: 16, def: 0, win: 1,
      sides: [{ name: 'Rome', who: 'Emperor Valens', col: '#d63a3a' }, { name: 'The Goths', who: 'Fritigern', col: '#a8744a' }], genLoss: [true, false], timeout: 1,
      units: [
        [U('gen', 85, 4, 6, 'Valens', { mo: 65 }), ...col('legion', 75, 7, 3, 9, 'Eastern legion', { mo: 55 }).filter((u, i) => i % 1 === 0).slice(0, 6), ...col('aux', 70, 6, 4, 8, 'Auxilia', { mo: 55 }).filter((u, i) => i % 2 === 0), ...col('cav', 60, 9, 1, 1, 'Left-wing cavalry', { mo: 55 }).concat(col('cav', 60, 9, 11, 11, 'Right-wing cavalry', { mo: 55 })), ...col('archer', 45, 5, 5, 7, 'Archers').filter((u, i) => i % 2 === 0)],
        [U('gen', 80, 20, 6, 'Fritigern'), ...col('warband', 85, 17, 3, 9, 'Gothic warriors', { mo: 70, hold: 4 }).filter((u, i) => i % 1 === 0).slice(0, 7), ...col('warband', 70, 18, 2, 4, 'Reserve', { hold: 4 }).slice(0, 2), ...col('archer', 40, 18, 5, 7, 'Bowmen', { hold: 4 }).filter((u, i) => i % 2 === 0)]
      ],
      reinf: [{ turn: 5, side: 1, at: [23, 3], units: [...col('hcav', 80, 0, 0, 3, 'Gothic cavalry of Alatheus and Saphrax', { mo: 85 })] }],
      brief: 'Thrace, a hot August noon. Valens has marched his men out without a rest and without waiting for the western emperor\'s help. The Goths sit inside a ring of wagons, and their cavalry has not yet come back from foraging. They will arrive in the middle of the battle.',
      real: 'The Roman left charged too early, the Gothic horse arrived, and the Roman army was cut up. Two thirds of the eastern field army was lost and the emperor Valens vanished in the fighting. The Empire was never the same.',
      goal: 'Break the Gothic army before they are reinforced. If the fight drags to turn 16, the Goths hold. Valens must live.'
    });
  }
  const find = id => SCEN.find(s => s.id === id);

  /* ---------- the battle ---------- */
  // opts: { play: side index, level: -1/0/1, up: {armor, arms, drill, eagle, supply}, seed }
  function make(id, opts) {
    opts = opts || {}; const sc = find(id), up = opts.up || {}, play = opts.play === undefined ? sc.def : opts.play;
    const S = { sc, id, W: sc.W, H: sc.H, map: sc.map.map(r => r.join('')), units: [], turn: 1, side: 0, log: [], over: null, play, level: opts.level || 0, up, nextId: 1, rnd: rngSeed(opts.seed === undefined ? (Math.random() * 1e9 | 0) : opts.seed), escaped: [0, 0], init: [0, 0], lost: [0, 0], hit: {} };
    sc.units.forEach((list, side) => list.forEach(u => addUnit(S, side, u)));
    S.init = [total(S, 0), total(S, 1)]; begin(S);
    return S;
  }
  function addUnit(S, side, d) {
    const T = TYPES[d.t], mine = side === S.play, up = S.up || {};
    const u = { id: S.nextId++, side, t: d.t, name: d.name || T.n, n: Math.min(120, d.n + (mine ? (up.supply || 0) * 4 : 0)), max: Math.max(100, d.n), mo: Math.min(100, (d.mo || T.mo) + (mine ? (up.drill || 0) * 6 : 0)), x: d.x, y: d.y, moved: 0, acted: false, gen: !!T.gen, hold: d.hold, wake: d.wake, am: mine ? 1 + .07 * (up.arms || 0) : 1, dm: mine ? 1 + .07 * (up.armor || 0) : 1, aura: mine ? (up.eagle || 0) : 0, attacked: false };
    if (!mine && S.level) { u.am *= 1 + .1 * S.level; }
    S.units.push(u); return u;
  }
  const total = (S, side) => S.units.reduce((a, u) => a + (u.side === side ? u.n : 0), 0);
  const at = (S, x, y) => S.units.find(u => u.x === x && u.y === y);
  const inMap = (S, x, y) => x >= 0 && y >= 0 && x < S.W && y < S.H;
  const ter = (S, x, y) => TERRAIN[S.map[y][x]] || TERRAIN['.'];
  const log = (S, t) => { S.log.push(t); if (S.log.length > 60) S.log.shift(); };
  const label = u => u.name + (u.n < u.max * .5 ? ' (battered)' : '');

  /* movement: cost per terrain and class, no passing through enemies, may pass friends but not stop on them */
  function reach(S, u) {
    const T = TYPES[u.t], out = new Map(), key = (x, y) => y * S.W + x; const mv = u.acted ? 0 : T.mv - u.moved;
    out.set(key(u.x, u.y), { x: u.x, y: u.y, c: 0, p: null });
    if (mv <= 0) return out; const q = [[u.x, u.y, 0]];
    while (q.length) {
      q.sort((a, b) => a[2] - b[2]); const [x, y, c] = q.shift(); if (c > (out.get(key(x, y)) || { c: 1e9 }).c) continue;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue; const nx = x + dx, ny = y + dy; if (!inMap(S, nx, ny)) continue;
        const o = at(S, nx, ny); if (o && o.side !== u.side) continue; const tc = ter(S, nx, ny).c[T.cls]; if (tc >= INF) continue;
        const nc = c + tc; if (nc > mv) continue; const k = key(nx, ny), old = out.get(k); if (old && old.c <= nc) continue;
        out.set(k, { x: nx, y: ny, c: nc, p: key(x, y), friend: !!o }); q.push([nx, ny, nc]);
      }
    }
    for (const [k, v] of [...out]) if (v.friend) out.delete(k); // cannot stop on a friend
    return out;
  }
  function targets(S, u, fx, fy) {
    const T = TYPES[u.t], pos = { x: fx === undefined ? u.x : fx, y: fy === undefined ? u.y : fy }, r = [];
    if (u.acted || u.shot) return r; if (T.still && u.moved) return r;
    for (const e of S.units) { if (e.side === u.side) continue; const d = cheb(pos, e); if (d <= T.rg && d >= (T.mn || 1)) r.push(e); }
    return r;
  }
  const near = (S, u, rad, side, pred) => S.units.filter(o => o.side === side && o !== u && cheb(o, u) <= rad && (!pred || pred(o)));
  const moraleF = u => .6 + .4 * Math.max(0, Math.min(100, u.mo)) / 100;
  /* the numbers of one blow: returns expected losses to the defender and, for melee, to the attacker */
  function calc(S, a, d, from) {
    const A = TYPES[a.t], D = TYPES[d.t], fx = from ? from.x : a.x, fy = from ? from.y : a.y, ap = { x: fx, y: fy }, dist = cheb(ap, d);
    const gAura = o => { const g = near(S, o, 3, o.side, x => x.gen)[0]; return (o.gen ? 1 : g ? 1 + .1 + .04 * (g.aura || 0) : 1); };
    let atk = A.atk * a.am * gAura(a) * moraleF(a) * (A.fury && a.mo > 60 ? 1.2 : 1);
    const moveDist = from ? (from.c || 0) : a.moved;
    if (A.charge && moveDist >= 3 && dist === 1) atk *= A.charge;
    if (A.spear && TYPES[d.t].cls === 'cav') atk *= 1.2; if (D.spear && A.cls === 'cav') atk *= .65;
    if (D.mounted || D.cls === 'big') { if (A.ranged && D.cls === 'big') atk *= 1.35; }
    // terrain the attacker stands in (high ground) vs the defender's
    const ta = S.map[fy][fx], td = S.map[d.y][d.x], hi = (TERRAIN[ta] || {}).high && !(TERRAIN[td] || {}).high; if (hi) atk *= 1.15;
    // surrounding: each extra enemy of the defender touching it adds weight
    const around = S.units.filter(o => o.side === a.side && o !== a && cheb(o, d) === 1 && !TYPES[o.t].ranged).length;
    let flank = 1 + Math.min(.6, .2 * around); if (A.ranged && dist > 1) flank = 1;
    const tt = TERRAIN[td] || TERRAIN['.']; let dm = (D.cls === 'inf' || D.cls === 'art' ? tt.d : (tt.dc || tt.d));
    const friends = near(S, d, 1, d.side, o => !TYPES[o.t].ranged).length; let cohesion = D.spear ? (friends >= 2 ? 1.05 : .8) : 1 + Math.min(.24, .08 * friends);
    if (D.spear) { const sur = S.units.filter(o => o.side === a.side && cheb(o, d) === 1).length; if (sur >= 3) cohesion *= .75; }
    const def = D.def * d.dm * gAura(d) * moraleF(d) * dm * cohesion;
    const sizeA = Math.pow(Math.max(.05, a.n / 100), .9), lossD = Math.max(1, Math.min(d.n, Math.round(11 * (atk * flank) / def * sizeA * (S.level < 0 && a.side !== S.play ? .85 : 1))));
    let lossA = 0, melee = dist === 1 && !(A.ranged && !(D.ranged && dist > 1) && false);
    if (dist === 1 || (D.ranged && dist <= D.rg && dist >= (D.mn || 1))) {
      const dd = d.n - lossD; if (dd > 0 && !(A.ranged && !D.ranged && dist > 1)) {
        const ratk = D.atk * d.am * gAura(d) * moraleF(d) * (D.fury && d.mo > 60 ? 1.2 : 1) * (D.spear && A.cls === 'cav' ? 1.5 : 1) * (dist > 1 ? .5 : 1);
        const adef = A.def * a.dm * gAura(a) * moraleF(a) * ((TERRAIN[ta] || TERRAIN['.']).d || 1);
        lossA = Math.max(0, Math.min(a.n, Math.round(11 * ratk / adef * Math.pow(Math.max(.05, dd / 100), .9) * .85)));
        if (A.ranged && dist > 1 && !D.ranged) lossA = 0;
      }
    }
    return { lossD, lossA, around, hi };
  }
  const preview = (S, a, d, from) => calc(S, a, d, from);
  function move(S, u, x, y) {
    const r = reach(S, u), k = y * S.W + x, to = r.get(k); if (!to || (x === u.x && y === u.y)) return null;
    const path = []; let c = to; while (c) { path.unshift({ x: c.x, y: c.y }); c = c.p !== null ? r.get(c.p) : null; }
    u.x = x; u.y = y; u.moved += to.c; u.from = path; if (S.sc.exit && u.side === S.sc.exit.side && x >= S.sc.exit.x) { S.units = S.units.filter(o => o !== u); S.escaped[u.side]++; log(S, label(u) + ' escapes from the battle!'); u.gone = true; }
    return path;
  }
  function kill(S, u, why) { S.units = S.units.filter(o => o !== u); S.lost[u.side] += 0; log(S, label(u) + ' ' + why); S.hit[u.id] = 0; if (u.gen) { S.units.filter(o => o.side === u.side).forEach(o => { o.mo = Math.max(0, o.mo - 25); }); log(S, u.side === S.play ? 'Your general has fallen! The army wavers.' : 'The enemy general has fallen! Their army wavers.'); S.genDead = (S.genDead || []); S.genDead[u.side] = true; } }
  function attack(S, a, d) {
    const A = TYPES[a.t], D = TYPES[d.t], c = calc(S, a, d), j = () => .88 + S.rnd() * .24;
    let lD = Math.max(1, Math.min(d.n, Math.round(c.lossD * j()))), lA = Math.min(a.n, Math.round(c.lossA * j()));
    d.n -= lD; a.n -= lA; if (A.mounted && A.ranged) a.shot = true; else a.acted = true; d.attacked = true; a.attacked = true; S.alarm = S.alarm || []; S.alarm[d.side] = true;
    let dmo = lD * .75 + 2 + 5 * c.around + (A.fright ? 8 : 0) + (D.fury ? 3 : 0) + (a.gen ? 0 : 0), amo = lA * .4; if (TYPES[d.t].gen) dmo *= .5;
    if (D.fury) dmo *= 1.25; if (D.cls === 'inf' && D.mo >= 75 && !D.fury) dmo *= .85;
    d.mo -= dmo; a.mo -= amo;
    const res = { a: a.id, d: d.id, lD, lA, x: d.x, y: d.y, ax: a.x, ay: a.y, an: label(a), dn: label(d) };
    log(S, a.name + ' hits ' + d.name + ': ' + lD + ' fall' + (lA ? ', and ' + lA + ' of yours' : '') + '.');
    if (d.n <= 0) { res.dead = d.id; kill(S, d, 'is wiped out.'); } else if (d.mo <= 0) { res.rout = d.id; S.lost[d.side] += d.n; kill(S, d, 'breaks and runs!'); }
    if (a.n <= 0) { res.deadA = a.id; kill(S, a, 'is wiped out.'); } else if (a.mo <= 0) { res.routA = a.id; kill(S, a, 'breaks and runs!'); }
    check(S); return res;
  }
  /* turn flow: side 0 acts, then side 1, then the turn counter moves on */
  function begin(S) {
    S.units.forEach(u => { if (u.side === S.side) { u.moved = 0; u.acted = false; u.shot = false; u.did = false; } });
    (S.sc.reinf || []).forEach(r => { if (r.turn === S.turn && r.side === S.side && !r.done) { r.done = true; let n = 0; r.units.forEach(d => { const spot = free(S, r.at[0], r.at[1] + (n++ % 2 ? 1 : -1) * Math.ceil(n / 2)); if (spot) addUnit(S, r.side, Object.assign({}, d, { x: spot.x, y: spot.y })); }); log(S, 'Reinforcements arrive: ' + r.units.filter(x => x.t !== 'gen').length + ' fresh units for ' + S.sc.sides[r.side].name + '!'); S.init[r.side] += r.units.reduce((a, x) => a + x.n, 0) * .6; S.news = 'reinf'; } });
  }
  const free = (S, x, y) => { for (let r = 0; r < 6; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { const nx = x + dx, ny = y + dy; if (inMap(S, nx, ny) && !at(S, nx, ny) && TERRAIN[S.map[ny][nx]].c.inf < INF) return { x: nx, y: ny }; } return null; };
  function endTurn(S) {
    if (S.over) return; // recovery for the side that just finished
    S.units.forEach(u => { if (u.side === S.side) { if (!u.attacked) { const g = near(S, u, 3, u.side, o => o.gen).length; u.mo = Math.min(100, u.mo + 4 + (g ? 5 : 0)); } u.attacked = false; } });
    if (S.side === 0) { S.side = 1; } else { S.side = 0; S.turn++; }
    check(S); if (!S.over) begin(S);
  }
  function check(S) {
    if (S.over) return; const sc = S.sc; let loser = -1, why = '';
    for (const s of [0, 1]) { const t = total(S, s); if (t <= S.init[s] * .22 || !S.units.some(u => u.side === s)) { loser = s; why = 'army broken'; } if (sc.genLoss[s] && S.genDead && S.genDead[s]) { loser = s; why = 'general fell'; } }
    if (sc.exit && S.escaped[sc.exit.side] >= sc.exit.need) { loser = 1 - sc.exit.side; why = 'escaped'; }
    if (loser < 0 && S.turn > sc.limit) { loser = 1 - sc.timeout; why = 'time ran out'; }
    if (loser >= 0) S.over = { winner: 1 - loser, why, turn: Math.min(S.turn, sc.limit) };
  }
  /* ---------- the AI ---------- */
  function aiStep(S, side) {
    const T = TYPES; let cand = S.units.filter(u => u.side === side && !u.acted && !(u.did)); if (!cand.length) return null;
    // act with ranged first, then front-liners; keeps the order natural
    cand.sort((a, b) => (T[b.t].ranged ? 1 : 0) - (T[a.t].ranged ? 1 : 0) || (a.gen ? 1 : 0) - (b.gen ? 1 : 0));
    const u = cand[0]; u.did = true; const t = T[u.t], foes = S.units.filter(o => o.side !== side); if (!foes.length) { u.acted = true; return { stay: u.id }; }
    // ambushers lie still until their wake turn; defenders wait until a foe comes within their 'hold' distance or the alarm is raised
    const closest = foes.reduce((m, o) => Math.min(m, cheb(u, o)), 99);
    const sleeping = (u.wake && S.turn < u.wake) || (!u.wake && u.hold !== undefined && !u.woke && closest > u.hold && !(S.alarm && S.alarm[side]));
    if (sleeping) { const tg0 = targets(S, u).sort((a, b) => b.n - a.n)[0]; if (tg0) return strike(S, u, tg0); u.acted = true; return { stay: u.id }; }    u.woke = true;
    const ag = (S.sc.aggr && S.sc.aggr[side]) || 1, r = reach(S, u); let best = null, bestS = -1e9; const goal = nearestFoe(S, u, foes);
    for (const [k, p] of r) {
      const tg = targets(S, u, p.x, p.y).filter(e => !(T[u.t].ranged && false)); let sc = 0, pick = null;
      for (const e of tg) { const c = calc(S, u, e, p); const val = c.lossD * (e.gen ? 1.6 : 1) * (1 + (T[e.t].atk > 9 ? .1 : 0)) + (c.lossD >= e.n ? 15 : 0) - c.lossA * .9 * (T[u.t].ranged ? 1.5 : 1) + c.around * 3; if (val > (pick ? pick.val : -1e9)) pick = { e, val }; }
      if (pick) sc += pick.val + 8;
      const terr = TERRAIN[S.map[p.y][p.x]] || TERRAIN['.']; sc += (terr.d - 1) * 10;
      const dgr = danger(S, u, p, side); sc -= dgr * (T[u.t].ranged ? .6 : u.t === 'warband' ? .07 : .15) / ag * (u.gen ? 2 : 1);
      if (!pick) { const d = cheb(p, goal); sc -= d * (u.gen ? .3 : 1.2) * ag; if (T[u.t].ranged) { const md = foes.reduce((m, o) => Math.min(m, cheb(p, o)), 99); if (md <= 1) sc -= 10; } }
      if (u.gen && pick) sc -= 10; sc -= p.c * .05; sc += S.rnd() * 1.5;
      if (S.sc.exit && side === S.sc.exit.side) sc += (p.x - 0) * 2.2;
      if (sc > bestS) { bestS = sc; best = { p, pick }; }
    }
    const from = { x: u.x, y: u.y }; let path = null; if (best && (best.p.x !== u.x || best.p.y !== u.y)) { const c0 = r.get(best.p.y * S.W + best.p.x); path = move(S, u, best.p.x, best.p.y); if (u.gone) return { move: u.id, from, path, escaped: true }; }
    let res = null; if (best && best.pick) { res = attack(S, u, best.pick.e); } else u.acted = true;
    let ride = null; if (u.shot && !u.acted && S.units.includes(u)) { ride = retreat(S, u, side); u.acted = true; }
    return { move: u.id, from, path, res, uid: u.id, ride };
  }
  function retreat(S, u, side) { const r = reach(S, u), foes = S.units.filter(o => o.side !== side && !TYPES[o.t].ranged); let b = null, bs = -1e9; for (const [k, p] of r) { const m = foes.reduce((mm, o) => Math.min(mm, cheb(p, o) - TYPES[o.t].mv), 99); const sc = m * 3 - p.c * .1 + S.rnd(); if (sc > bs) { bs = sc; b = p; } } if (b && (b.x !== u.x || b.y !== u.y)) { const from = { x: u.x, y: u.y }; const path = move(S, u, b.x, b.y); return { from, path }; } return null; }
  function strike(S, u, e) { const res = attack(S, u, e); return { move: u.id, from: { x: u.x, y: u.y }, path: null, res, uid: u.id }; }
  const nearestFoe = (S, u, foes) => foes.reduce((b, o) => (!b || cheb(u, o) < cheb(u, b) || (cheb(u, o) === cheb(u, b) && o.gen)) ? o : b, null);
  function danger(S, u, p, side) { let d = 0; for (const e of S.units) { if (e.side === side) continue; const et = TYPES[e.t], dist = cheb(p, e); if (dist <= et.mv + et.rg) d += et.atk * (e.n / 100) * (dist <= et.rg ? 1.4 : 1); } return d * (u.n / 100) * (1 + (TYPES[u.t].def < 6 ? .6 : 0)); }
  const scoreOf = (S, side) => { const t = total(S, side) / (S.init[side] || 1); return Math.round(Math.max(0, Math.min(1, t)) * 100); };
  window.Rome = { TYPES, TERRAIN, SCEN, find, make, reach, targets, preview, move, attack, begin, endTurn, aiStep, total, check, scoreOf, label };
})();

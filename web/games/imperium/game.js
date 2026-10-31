/* IMPERIUM — the game itself. A top-down Rome you walk: streets, bridges, the far bank, and the insides of nine
   buildings. People are solid — you cannot walk through a Roman, and if you shoulder one he steps aside and
   remembers it. Days pass, weather changes, the streets fill and empty by the hour, and the career runs through
   twenty chapters of story with choices that open and close later doors. Everything is drawn from the two art
   rooms, and everything is saved to this browser. */
(() => {
  'use strict';
  const IMP = window.IMP, PIX = window.PIX, T = 32;
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const LEGACY = 'imperium.career.v2', OLDSAVE = 'imperium.save.v1';
  /* three careers in the same browser: switching slots swaps the whole game, not just the file */
  const SLOTS = [1, 2, 3];
  const slotKey = n => 'imperium.slot.' + n;
  const readSlot = n => {
    try {
      const raw = localStorage.getItem(slotKey(n)) || (n === 1 ? localStorage.getItem(LEGACY) : null);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  };
  const firstFilled = () => SLOTS.find(n => readSlot(n)) || 1;
  let activeSlot = +(localStorage.getItem('imperium.slot.active') || 0);
  if (activeSlot !== 1 && activeSlot !== 2 && activeSlot !== 3) activeSlot = firstFilled();
  const SAVE = () => slotKey(activeSlot);
  const HOUR = 45;                                        // real seconds per in-game hour

  /* Two ways to play. Both stories answer to the same interface, so the whole engine — chapters, journal, act
     cards, endings, the crier — can be pointed at either one without knowing which it is holding. */
  const STORY_CAREER = window.STORY, STORY_CAESAR = window.CAESAR;
  function setMode(m) {
    if (S) S.mode = m;
    window.STORY = (m === 'caesar' && STORY_CAESAR) ? STORY_CAESAR : STORY_CAREER;
    recast();
    if (S && window.CIT) CIT.restore(S);                     // the jobs citizens wrote for this career
  }
  /* the small API the Senate and the market use to talk to the game: panels, dialogue, effects, sound */
  const gc = () => ({
    S, modal, close: closeModal, say, toast, applyEff, hud, save, esc, charById, cine, text: esc,
    sfx: n => { try { ImpAudio.sfx(n); } catch (e) { } },
    portrait: id => { const c = charById(id); return c && PIX ? PIX.portrait(lookOf(c), 46).toDataURL() : ''; },
    company: () => window.COMP && window.COMP.panel(S, gc())
  });

  /* ============================ the career ============================ */
  const STARTS = {};
  const newCareer = (name, bgId) => {
    const bg = IMP.BGS.find(b => b.id === bgId) || IMP.BGS[0];
    const sp = IMP.spawn();
    return {
      v: 2, mode: 'career', slot: activeSlot, name: name || 'Gaius Novus', bg: bg.id, office: bg.office,
      attrs: Object.assign({ health: 6 }, bg.attrs), denarii: bg.denarii, auctoritas: 6, xp: 0,
      rep: Object.assign({ senate: 0, people: 0, army: 0 }, bg.rep),
      tile: { x: sp.x, y: sp.y }, map: 'city', room: null, roomDoor: null,
      time: 7.2, day: 1, season: 0, weather: 'clear', wet: 0,
      quests: { active: [], done: [], step: {}, started: {} },
      story: { act: 1, flags: {}, seen: {} }, actShown: 1,
      disp: {}, inv: { coin: 1, bread: 2 }, laws: [], province: null, battles: { w: 0, l: 0 },
      rooms: { owned: ['atrium'] }, rel: {}, ach: [], death: 0, xpLog: [], tone: 'auto', squad: [], trained: {},
      set: { sound: true, mini: true, weather: true, scale: 1, speed: 1 }
    };
  };
  let S = null, music = null, boot = {};

  /* ============================ the cast, and the year ============================ */
  /* The career is fixed in 63 BC. The life of Caesar is in whatever year its chapter says ("Alesia, 52 BC"): the
     open chapter, or failing that the last one finished. */
  const yearNow = () => {
    if (!S || S.mode !== 'caesar' || !STORY_CAESAR) return IMP.YEAR_CAREER || -63;
    const ch = STORY_CAESAR.chapter(S.quests.chId) || (S.quests.done || []).slice().reverse().map(id => STORY_CAESAR.chapter(id)).find(Boolean);
    const m = ch && / (\d+) BC/.exec(ch.title);
    return m ? -(+m[1]) : -100;
  };
  /* Each character object is rewritten in place from its original plus the story's version of that person for this
     year (IMP.CAST), so anything already holding one sees the change. */
  const BASE = {};
  (IMP.CHARS || []).forEach(c => { BASE[c.id] = Object.assign({}, c); });
  let castKey = '';
  function recast() {
    const mode = S && S.mode === 'caesar' ? 'caesar' : 'career', yr = yearNow(), table = (IMP.CAST || {})[mode] || {};
    castKey = mode + yr;
    (IMP.CHARS || []).forEach(c => {
      const b = BASE[c.id]; if (!b) return;
      let o = table[c.id];
      if (Array.isArray(o)) o = o.find(x => (x.from == null || yr >= x.from) && (x.to == null || yr <= x.to)) || null;
      Object.keys(c).forEach(k => { delete c[k]; });
      Object.assign(c, b, o || {});
    });
  }
  /* a new chapter can move the year on: then the cast and the people in the street are made again */
  function recastIfMoved() {
    const mode = S && S.mode === 'caesar' ? 'caesar' : 'career';
    if (castKey === mode + yearNow()) return;
    recast();
    if (you && art) buildPeople();
  }
  /* only the people who were alive, grown and in Rome that year walk its streets (IMP.ERA) */
  const aboutNow = c => {
    /* a rival you have broken leaves the city: Vatinius goes to his estates in Apulia (Cato stays; nothing moves Cato) */
    if (c.id === 'vatinius' && S && S.mode !== 'caesar' && S.wider && S.wider.rival && S.wider.rival.done === 'won') return false;
    const w = c.era || (IMP.ERA || {})[c.id]; if (!w) return true; const y = yearNow(); return w.some(r => y >= r[0] && y <= r[1]); };

  function save(quiet) {
    try { localStorage.setItem(SAVE(), JSON.stringify(S)); if (!quiet) toast('Saved', 'the clerks have copied the page', 'scroll'); }
    catch (e) { toast('Could not save', 'the browser storage is full', 'bad'); }
  }
  function load() {
    try {
      const raw = localStorage.getItem(SAVE()) || localStorage.getItem(LEGACY) || (activeSlot === 1 ? localStorage.getItem(OLDSAVE) : null);
      if (!raw) return null;
      const s = JSON.parse(raw);
      if (!s || !s.attrs) return null;
      s.mode = s.mode || 'career';
      s.quests = s.quests || { active: [], done: [], step: {}, started: {} };
      s.quests.step = s.quests.step || {}; s.quests.started = s.quests.started || {};
      s.story = s.story || { act: 1, flags: {}, seen: {} }; s.story.flags = s.story.flags || {};
      if (!s.actShown) s.actShown = 1;
      s.set = Object.assign({ sound: true, mini: true, weather: true, scale: 1, speed: 1 }, s.set || {});
      s.inv = s.inv || {}; s.rel = s.rel || {}; s.ach = s.ach || []; s.battles = s.battles || { w: 0, l: 0 };
      s.rooms = s.rooms || { owned: ['atrium'] }; s.map = s.map || 'city';
      if (!Array.isArray(s.squad)) s.squad = [];
      s.trained = s.trained || {};
      if (s.map !== 'city' && !(IMP.INTERIORS || {})[s.map]) s.map = 'city';
      if (!s.tile || IMP.isSolid(s.tile.x, s.tile.y)) { const sp = IMP.spawn(); s.tile = { x: sp.x, y: sp.y }; }
      return s;
    } catch (e) { return null; }
  }
  const rankOf = () => IMP.rankOf(S.xp);
  const rankName = () => IMP.rankName(S.xp);
  const nextRank = () => { const r = IMP.ranks[rankOf() + 1]; return r ? r[0] : IMP.ranks[IMP.ranks.length - 1][0]; };
  const rankProgress = () => { const cur = IMP.ranks[rankOf()][0], nx = nextRank(); return nx > cur ? clamp((S.xp - cur) / (nx - cur), 0, 1) : 1; };

  /* ============================ characters ============================ */
  const extras = [
    { id: 'sestius', n: 'Sestius', t: 'Sestius the lanista', tt: 'Keeper of the Ludus', ic: '🗿', skin: '#c98f5f', robe: '#6b4a2c', hair: '#2b2119', role: 'gladiator', likes: ['courage', 'coin'], hates: ['mercy'], disp: 0.1, persona: 'Sestius keeps the gladiators: a fat, careful man who bets on his own men and has never watched a fight without thinking about the odds.' },
    { id: 'lucia', n: 'Lucia', t: 'Lucia of the Macellum', tt: 'Grain seller', ic: '🌾', skin: '#e3b98c', robe: '#8a6a2c', hair: '#5a4024', role: 'merchant', female: true, likes: ['trade', 'order'], hates: ['delay'], disp: 0.2, persona: 'Lucia sells grain and knows every price in the city by the hour. She has four children, two boats and no patience.' },
    { id: 'gaius', n: 'Gaius', t: 'Gaius the evocatus', tt: 'Veteran of the Tenth', ic: '🛡️', skin: '#b57c4d', robe: '#5a4a2c', hair: '#8f7a5e', role: 'soldier', likes: ['discipline'], hates: ['politics'], disp: 0.15, persona: 'Gaius served twenty-five years and came back to a city he cannot afford. He is quiet, exact, and has one bad hand.' },
    { id: 'marina', n: 'Marina', t: 'Marina of Ostia', tt: 'Harbour clerk', ic: '📦', skin: '#d6a878', robe: '#2f4f57', hair: '#33261a', role: 'scholar', female: true, likes: ['order', 'trade'], hates: ['lies'], disp: 0.25, persona: 'Marina keeps the harbour ledgers and can tell you which senator is smuggling before you have finished asking.' },
    { id: 'fabius', n: 'Fabius', t: 'Fabius Pictor', tt: 'Clerk of the records', ic: '🗂️', skin: '#e8c199', robe: '#3f4f6b', hair: '#4a3320', role: 'scholar', likes: ['law', 'order'], hates: ['haste'], disp: 0.3, persona: 'Fabius has read every law in the Tabularium twice. He quotes them at length and is always, irritatingly, right about the date.' },
    { id: 'cassia', n: 'Cassia', t: 'Cassia Vesta', tt: 'Vestal, warden of the oven', ic: '🕯️', skin: '#f2d3ac', robe: '#efe6d2', hair: '#241c15', role: 'vestal', female: true, likes: ['piety', 'truth'], hates: ['disorder'], disp: 0.2, persona: 'Cassia keeps the records of the Vestals and knows who has been to the temple at night.' }
  ];
  const CHARS = () => IMP.CHARS;
  const minor = () => IMP.MINOR || [];
  const charById = id => CHARS().find(c => c.id === id) || extras.find(c => c.id === id) || minor().find(c => c.id === id) || null;

  /* ============================ the city ============================ */
  let L = null, art = null, raf = 0, people = [], you = null, ac = null;
  let cam = { x: 0, y: 0, tx: 0, ty: 0 }, keys = {}, lastT = 0, weatherP = [], fx = [];
  /* a unit's card shows one of its own little soldiers instead of an emoji */
  const tico = {};
  const troopIcon = t => {
    if (!(t in tico)) { let u = ''; try { const c = PIX.troop && PIX.troop(t, 'me', 0, 0); if (c) u = c.toDataURL(); } catch (e) { } tico[t] = u; }
    return tico[t] ? '<img class="tico" src="' + tico[t] + '" alt="">' : ((IMP.UNITS[t] || {}).ic || '');
  };
  const lookOf = (c) => PIX.look('imp-' + c.id, { role: c.role || roleFor(c), skin: c.skin, hair: c.hair, cloth: c.robe, female: c.female || (c.role === 'vestal'), beard: c.beard, hairStyle: c.hairStyle });
  const ANON = [
    ['pleb', 'Titus'], ['pleb', 'Marcus'], ['poor', 'Quintus'], ['merchant', 'Servius'], ['matron', 'Flavia'],
    ['child', 'Lucius'], ['pleb', 'Gnaeus'], ['poor', 'Sextus'], ['merchant', 'Aulus'], ['soldier', 'Decimus'],
    ['senator', 'Appius'], ['scholar', 'Gaius'], ['matron', 'Julia'], ['pleb', 'Publius'], ['poor', 'Spurius']
  ];
  function roleFor(c) {
    if (c.role) return c.role;
    if (c.faction === 'army') return 'soldier';
    if (c.id === 'aurelia') return 'vestal';
    if (c.id === 'cato' || c.id === 'cicero' || c.id === 'crassus' || c.id === 'vatinius') return 'senator';
    if (c.id === 'berenice') return 'noble';
    if (c.id === 'aulus') return 'scholar';
    if (c.id === 'cornelia') return 'matron';
    if (c.id === 'catilina') return 'noble';
    if (c.id === 'pullo') return 'soldier';
    return 'pleb';
  }
  function entity(o) {
    const spr = PIX.folk(o.look);
    return Object.assign({
      x: 0, y: 0, fx: 0, fy: 0, dir: 'down', frame: 0, spd: 128, walk: false, prog: 0, vx: 0, vy: 0, goal: null, stepAcc: 0,
      from: { x: 0, y: 0 }, to: { x: 0, y: 0 }, path: null, idle: Math.random() * 2, home: { x: 0, y: 0 }, spr, alive: true
    }, o, { fx: o.x * T, fy: o.y * T, from: { x: o.x, y: o.y }, to: { x: o.x, y: o.y } });
  }
  const you_is = (x, y) => x === S.tile.x && y === S.tile.y;

  function citySpot() { return IMP.spotOf(S.tile ? 'forum' : 'forum'); }
  function buildPeople() {
    people = [];
    const seen = {};
    const hourPart = partOfDay();
    /* Nobody stands inside anybody else. Every square in the street is claimed before it is handed out, and a
       person who arrives at a taken square moves outwards until they find one of their own. */
    const taken = {};
    const claimable = (x, y) => !taken[x + ',' + y] && standable(x, y);
    const place = base => {
      if (claimable(base.x, base.y)) { taken[base.x + ',' + base.y] = 1; return base; }
      for (let k = 1; k < 10; k++) for (let dy = -k; dy <= k; dy++) for (let dx = -k; dx <= k; dx++) {
        const x = base.x + dx, y = base.y + dy;
        if (claimable(x, y)) { taken[x + ',' + y] = 1; return { x, y }; }
      }
      taken[base.x + ',' + base.y] = 1; return base;
    };
    const add = (c, at) => {
      if (seen[c.id]) return; seen[c.id] = 1;
      const look = lookOf(c);
      people.push(entity({ id: c.id, char: c, name: c.n, x: at.x, y: at.y, look, spd: c.id === 'pullo' ? 150 : c.id === 'cornelia' ? 92 : 112, talkable: true, gift: c.ic === '🔥' }));
    };
    const squad = (S && S.squad) || [];
    CHARS().concat(extras).forEach((c, ci) => {
      if (squad.some(m => m.id === c.id)) return;              // he is not out there: he is with you
      if (!aboutNow(c)) return;                                 // dead, a child, or a thousand miles away this year
      const sched = (IMP.SCHEDULE[c.id] || ['forum'])[hourPart];
      const at = place(IMP.spotOf(sched, ci));                  // a different square of the same apron for each
      add(c, at);
    });
    /* the crowd: the people of Rome, out on their own business near their own streets. The same baker is always the
       same baker (citizens.js), with the same face and the same memory of you */
    const r = IMP.rngFor ? IMP.rngFor() : Math.random;
    if (window.CIT) {
      CIT.crowd(S, 30, r).forEach(c => {
        const g = IMP.goalOf(c.home) || IMP.spawn();
        const at = place(IMP.free(g.x + Math.round((r() - .5) * 10), g.y + Math.round((r() - .5) * 8), 10));
        people.push(entity({ id: 'cit:' + c.id, cit: c.id, name: c.name, look: PIX.look('cit' + c.id, CIT.lookOpts(c)), x: at.x, y: at.y, spd: 70 + r() * 45, wander: true, home: at, delay: r() * 4, talkable: true }));
      });
    } else for (let i = 0; i < 26; i++) {
      const t = ANON[Math.floor(r() * ANON.length)];
      const at = place(IMP.free(20 + Math.floor(r() * 60), 8 + Math.floor(r() * 58), 14));
      const look = PIX.look('anon' + i + t[0], { role: t[0] });
      people.push(entity({ id: 'anon' + i, name: t[1], look, x: at.x, y: at.y, spd: 78 + r() * 40, wander: true, home: at, delay: r() * 4 }));
    }
    /* the company: up to three people walking two steps behind you, one tile at a time, around every corner */
    if (!inRoom() && squad.length && window.COMP) {
      squad.forEach((m, i) => {
        const c = charById(m.id); if (!c) return;
        const at = IMP.free(S.tile.x - 1 + i, S.tile.y + 1, 4);
        people.push(entity({ id: c.id, char: c, name: c.n, look: lookOf(c), x: at.x, y: at.y, spd: 150, talkable: true, follow: i, delay: 0 }));
      });
    }
    return people;
  }
  /* one tile at a time, along a fresh path each time they stop: they walk around corners instead of through them */
  const BACK = { up: [0, 1], down: [0, -1], left: [1, 0], right: [-1, 0] };
  function followerSpot(idx) {
    const b = BACK[you.dir] || [0, 1];
    const side = idx === 0 ? 0 : (idx % 2 ? 1 : -1);
    return IMP.free(you.x + (b[0] ? b[0] * (1 + Math.floor(idx / 2)) : side), you.y + (b[1] ? b[1] * (1 + Math.floor(idx / 2)) : side), 4);
  }
  function followTick(p) {
    const idx = p.follow || 0;
    const gap = Math.hypot(p.x - you.x, p.y - you.y);
    if (gap > 14) {                                            // you went somewhere without them: they arrive
      const at = followerSpot(idx); p.x = at.x; p.y = at.y; p.fx = at.x * T; p.fy = at.y * T; p.from = { x: at.x, y: at.y }; p.to = { x: at.x, y: at.y }; p.walk = false; p.path = null;
      return;
    }
    const target = followerSpot(idx);
    if (p.x === target.x && p.y === target.y) { p.walk = false; p.dir = you.dir; return; }
    const path = IMP.path({ x: p.x, y: p.y }, target, 1200);
    if (!path || path.length < 2) return;
    const n = path[1];
    p.from = { x: p.x, y: p.y }; p.to = { x: n.x, y: n.y };
    p.x = n.x; p.y = n.y; p.path = null; p.prog = 0; p.walk = true;
    p.dir = (n.y - p.from.y) < 0 ? 'up' : (n.y - p.from.y) > 0 ? 'down' : (n.x - p.from.x) < 0 ? 'left' : 'right';
  }
  const partOfDay = () => S.time < 10 ? 0 : S.time < 16 ? 1 : 2;

  function startCity(fresh) {
    if (!L) L = IMP.load();
    if (!art) {
      art = IMP.paint(L);
      /* the second pass: awnings, shutters, slogans, washing, smoke, pigeons — everything that makes a street read
         as inhabited instead of generated. It only ever runs once, on the painted canvas. */
      if (window.DECOR) { try { window.DECOR.dress(art, L); } catch (e) { console.warn('decor', e); } }
    }
    you = entity({ id: 'you', name: S.name, x: S.tile.x, y: S.tile.y, look: lookOf(Object.assign({ id: 'you' + S.bg, role: S.bg === 'miles' ? 'soldier' : S.bg === 'priest' ? 'priest' : S.bg === 'matron' ? 'matron' : 'senator' }, bgLook())), spd: 165, you: true });
    buildPeople();
    cam.x = clamp(you.fx - vw() / 2, 0, Math.max(0, art.base.width - vw()));
    cam.y = clamp(you.fy - vh() / 2, 0, Math.max(0, art.base.height - vh()));
    cam.tx = cam.x; cam.ty = cam.y;
    S.map = 'city';
    if (fresh) setTimeout(() => play('intro'), 700);
    draw();
  }
  function bgLook() {
    const bg = IMP.BGS.find(b => b.id === S.bg) || IMP.BGS[0];
    return { skin: S.bg === 'matron' ? '#ecd7b5' : '#e3cba8', hair: '#3f2f22', cloth: S.bg === 'matron' ? '#7d3b3f' : '#efe6d2' };
  }

  /* ============================ rooms ============================ */
  let room = null;
  function enterRoom(id) {
    const R = IMP.room(id);
    if (!R) return;
    room = R; S.room = id; S.map = 'room';
    S.roomDoor = { x: S.tile.x, y: S.tile.y };
    you.x = R.door.x; you.y = (R.spawn ? R.spawn.y : R.door.y - 1); you.fx = you.x * T; you.fy = you.y * T;
    you.vx = you.vy = 0; you.goal = null; you.path = null; you.walk = false;
    people = [];
    if (id === 'domus' || id === 'curia' || id === 'castra' || id === 'ludus' || id === 'temple') {
      people.push(entity({ id: 'aulus', char: charById('aulus'), name: 'Aulus', x: R.door.x - 2, y: R.door.y - 3, look: lookOf(charById('aulus')), talkable: true }));
    }
    if (id === 'domus') people.push(entity({ id: 'cornelia', char: charById('cornelia'), name: 'Cornelia', x: R.door.x + 2, y: R.door.y - 3, look: lookOf(charById('cornelia')), talkable: true }));
    if (id === 'vesta') people.push(entity({ id: 'aurelia', char: charById('aurelia'), name: 'Aurelia', x: R.door.x, y: R.door.y - 4, look: lookOf(charById('aurelia')), talkable: true }));
    /* out in the world: the people who live there, each with a thing or two to say */
    if (window.WIDER && WIDER.isRegion(id)) WIDER.people(id).forEach((n, i) => people.push(entity({ id: 'reg' + id + i, name: n.name, x: n.x, y: n.y, look: PIX.look('reg' + id + i, { role: n.role }), lines: n.lines, talkable: true })));
    cam.x = clamp(you.fx - vw() / 2, 0, Math.max(0, R.base.width - vw()));
    cam.y = clamp(you.fy - vh() / 2, 0, Math.max(0, R.base.height - vh()));
    cam.tx = cam.x; cam.ty = cam.y;
    toast(R.name, R.desc, 'door'); ImpAudio.sfx('door');
    save(true); hud(); musicFor(here().id);                      // the room's own music starts as the door closes
  }
  function leaveRoom() {
    if (!inRoom()) return;
    room = null; S.room = null; S.map = 'city';
    const b = S.roomDoor ? IMP.buildingAt(S.roomDoor.x, S.roomDoor.y) : null;
    const d = b ? IMP.doorOf(b) : null;
    const at = d ? IMP.free(d.x, d.y + 1, 5) : IMP.free(S.roomDoor.x, S.roomDoor.y, 5);
    you.x = at.x; you.y = at.y; you.fx = at.x * T; you.fy = at.y * T; you.path = null;
    S.tile = { x: at.x, y: at.y };
    buildPeople(); hud(); save(true); musicFor(here().id);
  }
  const inRoom = () => !!(S && S.map === 'room' && room);
  const outdoors = () => !inRoom() || !!room.outdoor;                 // the city, or one of the places out in the world
  /* time on the road: every midnight crossed is a new day, with everything a new day brings */
  function advanceHours(h) { S.time += h; while (S.time >= 24) { S.time -= 24; S.day++; onNewDay(); } hud(); save(true); }
  const wapi = () => Object.assign(gc(), {
    $, cine, trialApi, advance: advanceHours, battle: p => battleIn(p),
    busy: () => boxOpen() || paused || !!document.querySelector('#battle.show') || !!S.end,
    enter: id => { if (inRoom()) { room = null; S.room = null; S.map = 'city'; } enterRoom(id); },
    leave: () => leaveRoom()
  });
  const solidAt = (x, y) => inRoom() ? (x < 0 || y < 0 || x >= room.w || y >= room.h || !!room.solid[y * room.w + x]) : IMP.isSolid(x, y);
  const here = () => {
    if (inRoom()) return { id: S.room, name: room.name, g: '🏛️', sub: room.desc || '' };
    const id = IMP.locAt(you.x, you.y);
    return IMP.LOCS[id] || IMP.LOCS.via;
  };
  /* the house you are standing at: buildings are solid, so "here" means within a couple of tiles of one */
  const nearBuilding = (rad) => {
    if (inRoom() || !L) return null;
    let best = null, bd = 1e9;
    L.buildings.forEach(b => {
      const dx = Math.max(b.x - you.x, 0, you.x - (b.x + b.w - 1));
      const dy = Math.max(b.y - you.y, 0, you.y - (b.y + b.h - 1));
      const d = Math.hypot(dx, dy);
      if (d < bd) { bd = d; best = b; }
    });
    return best && bd <= (rad === undefined ? 2 : rad) ? best : null;
  };
  const buildingHere = () => inRoom() ? null : nearBuilding(2);

  /* ============================ drawing ============================ */
  const view = () => { const c = $('view'); return { w: c.width, h: c.height }; };
  /* a whole-number zoom, the way a pixel game is meant to be looked at: thirteen to twenty tiles across */
  const zoom = () => { const w = view().w; return w >= 1560 ? 3 : w >= 940 ? 2 : 1; };
  const vw = () => view().w / zoom(), vh = () => view().h / zoom();
  function resize() {
    const c = $('view'), host = $('stage');
    c.width = Math.max(320, host.clientWidth | 0); c.height = Math.max(240, host.clientHeight | 0);
    const W2 = inRoom() ? room.base.width : art ? art.base.width : 0;
    const H2 = inRoom() ? room.base.height : art ? art.base.height : 0;
    cam.tx = clamp(cam.tx, 0, Math.max(0, W2 - vw()));
    cam.ty = clamp(cam.ty, 0, Math.max(0, H2 - vh()));
  }
  /* The sky is one long curve, not a stack of steps. Dawn and dusk are interpolated hour by hour — colour and
     depth together — so the light changes continuously instead of popping the moment a threshold is crossed. */
  const SKY = [
    [0, '#0a1430', .46], [4.2, '#0a1430', .46], [5.6, '#2a2a5a', .30], [6.8, '#c07a3a', .17], [8.4, '#000000', 0],
    [16.4, '#000000', 0], [18.1, '#c0641e', .16], [19.9, '#4a2a6a', .28], [21.4, '#0a1430', .46], [24, '#0a1430', .46]
  ];
  const hexRGB = h => { const v = parseInt(h.slice(1), 16); return [(v >> 16) & 255, (v >> 8) & 255, v & 255]; };
  const smoothstep = k => k * k * (3 - 2 * k);
  function hourTint() {
    const t = (((S ? S.time : 12) % 24) + 24) % 24;
    let i = 0;
    while (i < SKY.length - 2 && t >= SKY[i + 1][0]) i++;
    const a = SKY[i], b = SKY[i + 1];
    const k = b[0] === a[0] ? 0 : smoothstep(clamp((t - a[0]) / (b[0] - a[0]), 0, 1));
    const c1 = hexRGB(a[1]), c2 = hexRGB(b[1]);
    const m = c1.map((v, j) => Math.round(v + (c2[j] - v) * k));
    return ['rgb(' + m[0] + ',' + m[1] + ',' + m[2] + ')', a[2] + (b[2] - a[2]) * k];
  }
  /* how deep the night is right now: 1 in the middle of it, 0 in full daylight, easing through dawn and dusk.
     Lamps, glows and the crowd's behaviour all follow this instead of a hard on/off. */
  function darkAmt(t) {
    t = (((t % 24) + 24) % 24);
    if (t < 5.4) return 1;
    if (t < 8) return 1 - smoothstep(clamp((t - 5.4) / 2.6, 0, 1));
    if (t < 18.6) return 0;
    if (t < 21.4) return smoothstep(clamp((t - 18.6) / 2.8, 0, 1));
    return 1;
  }
  function step(e, dt) {
    if (!e.walk) { e.frame = 0; return; }
    e.prog += dt * (e.spd / T);
    while (e.prog >= 1) {
      e.prog -= 1; e.from = { x: e.to.x, y: e.to.y };
      if (e.path && e.path.length) { const n = e.path.shift(); e.to = { x: n.x, y: n.y }; }
      else { e.walk = false; e.path = null; if (e.you) S.tile = { x: e.from.x, y: e.from.y }; break; }
      const dx = e.to.x - e.from.x, dy = e.to.y - e.from.y;
      e.dir = dy < 0 ? 'up' : dy > 0 ? 'down' : dx < 0 ? 'left' : 'right';
    }
    const k = clamp(e.prog, 0, 1);
    e.fx = (e.from.x + (e.to.x - e.from.x) * k) * T;
    e.fy = (e.from.y + (e.to.y - e.from.y) * k) * T;
    e.frame = [0, 1, 2, 3][Math.floor(e.prog * 4) % 4];
    if (!e.you) { const sgn = (e.to.x - e.from.x) + (e.to.y - e.from.y); e.frame = (e.frame + (sgn < 0 ? 0 : 0)) % 4; }
  }
  function walkTo(x, y, e) { e = e || you; e.path = [{ x, y }]; e.to = { x, y }; e.from = { x: e.x, y: e.y }; e.x = x; e.y = y; e.prog = 0; e.walk = true; }
  /* Walk a whole route, square by square, round the corners. (The crowd used to be given the route and then sent
     straight to the end of it, so they slid through houses and walls in a line.) The destination is claimed at once,
     so two people never pick the same square to walk to. */
  function walkPath(e, path) {
    if (!path || !path.length) return false;
    const end = path[path.length - 1];
    e.from = { x: e.x, y: e.y }; e.to = { x: path[0].x, y: path[0].y }; e.path = path.slice(1);
    e.x = end.x; e.y = end.y; e.prog = 0; e.walk = true;
    const dx = e.to.x - e.from.x, dy = e.to.y - e.from.y; e.dir = dy < 0 ? 'up' : dy > 0 ? 'down' : dx < 0 ? 'left' : 'right';
    return true;
  }
  /* at dusk and dawn the people you know walk to where they spend that part of the day, instead of the whole crowd
     being thrown away and made again in new places */
  function shiftChange() {
    if (inRoom()) return;
    const part = partOfDay();
    people.forEach((p, i) => {
      if (!p.char || p.follow !== undefined || p === you) return;
      const where = (IMP.SCHEDULE[p.id] || [])[part]; if (!where) return;
      const spot = IMP.spotOf(where, i);
      if (!standable(spot.x, spot.y, p)) return;
      walkPath(p, IMP.path({ x: p.x, y: p.y }, spot, 12000));
    });
  }
  /* click a square and you walk the whole way there, smoothly, one waypoint after another */
  function clickWalk(tx, ty) {
    const setRoute = list => {
      you.goal = list.map(w => ({ x: w.x * T + 2, y: w.y * T }));
      you.walk = true; you.stepAcc = 0;
    };
    if (inRoom()) {
      const r = room;
      if (tx < 0 || ty < 0 || tx >= r.w || ty >= r.h || r.solid[ty * r.w + tx]) return ImpAudio.sfx('bad');
      const p = roomPath({ x: you.x, y: you.y }, { x: tx, y: ty });
      if (p && p.length) setRoute(p); else ImpAudio.sfx('bad');
      return;
    }
    let gx = tx, gy = ty;
    const b = IMP.buildingAt(tx, ty);
    if (b) { const d = IMP.doorOf(b), at = IMP.free(d.x, d.y + 1, 4); gx = at.x; gy = at.y; }   // click a house and you walk to its door
    const p = IMP.path({ x: you.x, y: you.y }, { x: gx, y: gy }, 20000);
    if (p && p.length) setRoute(p);
    else ImpAudio.sfx('bad');
  }
  function roomPath(from, to) {
    const w = room.w, h = room.h, key = (x, y) => y * w + x;
    const prev = new Int32Array(w * h).fill(-1), seen = new Uint8Array(w * h);
    const start = key(from.x, from.y), goal = key(to.x, to.y);
    if (room.solid[start] || room.solid[goal]) return null;
    let q = [start]; seen[start] = 1;
    while (q.length) {
      const nx = [];
      for (const cur of q) {
        const x = cur % w, y = (cur / w) | 0;
        for (const d of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const ax = x + d[0], ay = y + d[1];
          if (ax < 0 || ay < 0 || ax >= w || ay >= h) continue;
          const k = key(ax, ay);
          if (seen[k] || room.solid[k]) continue;
          seen[k] = 1; prev[k] = cur;
          if (k === goal) { const out = []; let c = k; while (c !== start) { out.unshift({ x: c % w, y: (c / w) | 0 }); c = prev[c]; } return out; }
          nx.push(k);
        }
      }
      q = nx;
    }
    return null;
  }

  /* ============================ walking ============================ */
  /* You walk in pixels and stop when you let go — not tile by tile, one square per press. The grid is still what
     the world is made of: your feet decide which square you are standing in, and everything else (doors, streets,
     the journal, the save) keeps working off that. Hold two keys to walk at an angle, Shift to run. */
  const FEET = { x: 6, y: 21, w: 16, h: 10 };                 // the box your feet occupy inside the tile you are standing in
  const mapBase = () => (inRoom() ? room.base : art.base);
  const WALK = 158, RUN = 252;
  function bitsSolid(fx, fy) {
    const x0 = Math.floor((fx + FEET.x) / T), x1 = Math.floor((fx + FEET.x + FEET.w) / T);
    const y0 = Math.floor((fy + FEET.y) / T), y1 = Math.floor((fy + FEET.y + FEET.h) / T);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (solidAt(x, y)) return true;
    return false;
  }
  /* is there a Roman in the way? people are solid: you cannot walk through one, you go round or he gives ground */
  function inTheWay(fx, fy, skip) {
    const x0 = fx + FEET.x, x1 = x0 + FEET.w, y0 = fy + FEET.y, y1 = y0 + FEET.h;
    for (let i = 0; i < people.length; i++) {
      const p = people[i];
      if (p === skip || p === you || p.alive === false) continue;
      const qx0 = p.fx + 6, qx1 = qx0 + 16, qy0 = p.fy + 23, qy1 = qy0 + 12;
      if (x1 > qx0 && x0 < qx1 && y1 > qy0 && y0 < qy1) return p;
    }
    return null;
  }
  function tileOpen(x, y, skip) {
    if (solidAt(x, y)) return false;
    for (let i = 0; i < people.length; i++) { const p = people[i]; if (p !== skip && p !== you && p.alive !== false && p.x === x && p.y === y) return false; }
    return true;
  }
  /* is this square free to stand in — solid ground, and not already the square somebody has claimed? This is what
     keeps the crowd from ending up inside one another: at spawn, while wandering, and when two of them meet. */
  function standable(x, y, skip) {
    if (solidAt(x, y)) return false;
    for (let i = 0; i < people.length; i++) {
      const p = people[i];
      if (p === skip || p.alive === false) continue;
      if (p.x === x && p.y === y) return false;
    }
    if (you && skip !== you && you.x === x && you.y === y) return false;
    return true;
  }
  /* Two people may never occupy the same square. Every half second anybody standing inside somebody else takes a
     step to a free square beside them — the walkable city is only as believable as its crowd. */
  function separate(dt) {
    boot.sep = (boot.sep || 0) + dt;
    if (boot.sep < .45) return;
    boot.sep = 0;
    for (let i = 0; i < people.length; i++) {
      const a = people[i];
      if (a === you || a.walk || a.follow !== undefined || a.alive === false) continue;
      for (let j = i + 1; j < people.length; j++) {
        const b = people[j];
        if (b === you || b.alive === false) continue;
        const dx = a.fx - b.fx, dy = a.fy - b.fy;
        if (dx * dx + dy * dy > 26 * 26) continue;                  // standing in the same square, or nearly
        const mover = b.walk ? a : (a.walk ? b : (a.id > b.id ? a : b));
        if (mover.walk) continue;
        const spot = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]
          .map(d => ({ x: mover.x + d[0], y: mover.y + d[1] }))
          .find(q => standable(q.x, q.y, mover));
        if (spot) walkTo(spot.x, spot.y, mover);
        break;
      }
    }
  }
  /* shoulder a Roman aside: he steps out of the way and remembers it */
  function shoulder(p) {
    if (!p || p === you || p.alive === false) return;
    const spots = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]]
      .map(d => ({ x: p.x + d[0], y: p.y + d[1] })).filter(q => tileOpen(q.x, q.y, p));
    if (!spots.length) return;
    const sp = spots[Math.floor(Math.random() * spots.length)];
    walkTo(sp.x, sp.y, p);
    p.bumped = (p.bumped || 0) + 1;
    if (p.char) S.disp[p.id] = (S.disp[p.id] || 0) - 0.06;
    if (p.bumped === 1) toast(p.name + ' steps aside', p.char ? p.char.n + ' will remember that you shoved him' : 'and mutters something about manners', 'walk');
    ImpAudio.sfx('click');
  }
  function moveYou(dt) {
    const run = !!(keys['shift'] || keys['shiftleft'] || keys['shiftright']);
    let ax = 0, ay = 0;
    if (keys['a'] || keys['arrowleft']) ax -= 1;
    if (keys['d'] || keys['arrowright']) ax += 1;
    if (keys['w'] || keys['arrowup']) ay -= 1;
    if (keys['s'] || keys['arrowdown']) ay += 1;
    if (ax || ay) {
      you.goal = null;                                        // a key overrides a click
      const m = Math.hypot(ax, ay); ax /= m; ay /= m;         // ...and two keys walk at an angle, not faster
    } else if (you.goal && you.goal.length) {
      const g = you.goal[0];
      const dx = g.x - you.fx, dy = g.y - you.fy;
      if (Math.abs(dx) < 4 && Math.abs(dy) < 4) { you.goal.shift(); if (!you.goal.length) { you.goal = null; you.vx = you.vy = 0; } }
      else { const m = Math.hypot(dx, dy); ax = dx / m; ay = dy / m; }
    }
    const top = (run ? RUN : WALK) * (S.set.speed || 1);
    const k = Math.min(1, dt * ((ax || ay) ? 15 : 19));        // up to speed at once, and stopping feels like stopping
    you.vx += (ax * top - you.vx) * k;
    you.vy += (ay * top - you.vy) * k;
    if (!ax && !ay && Math.hypot(you.vx, you.vy) < 6) { you.vx = you.vy = 0; }
    /* move on each axis on its own, so a wall slows you along it instead of stopping you dead */
    const nx = you.fx + you.vx * dt, ny = you.fy + you.vy * dt;
    if (!bitsSolid(nx, you.fy)) you.fx = nx; else you.vx = 0;
    if (!bitsSolid(you.fx, ny)) you.fy = ny; else you.vy = 0;
    const other = inTheWay(you.fx, you.fy, you);
    if (other) {
      you.fx = Math.max(0, Math.min(mapBase().width - 28, you.fx - you.vx * dt));
      you.fy = Math.max(0, Math.min(mapBase().height - 36, you.fy - you.vy * dt));
      const push = Math.abs(you.vx) + Math.abs(you.vy);
      if (push > 20 && boot.t - (you.shoveAt || 0) > 500) { you.shoveAt = boot.t; shoulder(other); }
      you.vx *= .3; you.vy *= .3;
    }
    const spd = Math.hypot(you.vx, you.vy);
    you.walk = spd > 14;
    if (spd > 6) {
      you.dir = Math.abs(you.vx) > Math.abs(you.vy) + 2 ? (you.vx < 0 ? 'left' : 'right')
        : Math.abs(you.vy) > Math.abs(you.vx) + 2 ? (you.vy < 0 ? 'up' : 'down')
          : you.dir;
      you.stepAcc = (you.stepAcc || 0) + spd * dt;
      you.frame = [0, 1, 2, 3][Math.floor(you.stepAcc / 13) % 4];
      if (run && Math.random() < dt * 9) fx.push({ t: 'dust', x: you.fx + 14, y: you.fy + 32, life: .4 });
    } else { you.frame = 0; you.stepAcc = 0; }
    const tx = Math.floor((you.fx + 14) / T), ty = Math.floor((you.fy + 26) / T);
    if (tx !== you.x || ty !== you.y) {
      you.x = tx; you.y = ty; S.tile = { x: tx, y: ty }; hud();
      if (Math.random() < .3 && spd > 60) fx.push({ t: 'dust', x: you.fx + 14, y: you.fy + 33, life: .4 });
    }
    /* keep yourself in the middle of the picture */
    const B = mapBase();
    cam.tx = clamp(you.fx + 14 - vw() / 2, 0, Math.max(0, B.width - vw()));
    cam.ty = clamp(you.fy + 16 - vh() / 2, 0, Math.max(0, B.height - vh()));
  }

  function loop(t) {
    raf = requestAnimationFrame(loop);
    const dt = Math.min(.05, (t - lastT) / 1000 || 0); lastT = t;
    if (!S || paused) return;
    S.time += dt / HOUR * (S.set.speed || 1) * 2;
    if (S.time >= 24) { S.time -= 24; S.day++; onNewDay(); }
    if (dusk === undefined) dusk = S.time < 7.5 || S.time > 19;
    const night = S.time < 6.2 || S.time > 19.6, duskNow = S.time < 7.5 || S.time > 19;
    if (duskNow !== dusk) { dusk = duskNow; shiftChange(); musicFor(here().id); }
    S.wet = Math.max(0, S.wet - dt / 120);
    updateWeather(dt);
    /* walking */
    moveYou(dt);
    /* standing in the doorway of a room takes you back out to the street */
    if (inRoom() && !you.walk && you.x === room.door.x && you.y >= room.h - 1) { leaveRoom(); return; }
    /* everybody else */
    people.forEach(p => {
      if (p === you) return;
      if (p.walk) { step(p, dt); return; }
      if (p.follow !== undefined) { followTick(p); return; }         // they wait until you move, then come
      if (p.delay > 0) { p.delay -= dt; return; }
      p.delay = 1.2 + Math.random() * 3.4;
      if (p.path) p.path = null;
      const r = Math.random();
      if (p.wander) {
        let spot = null;
        for (let k = 0; k < 6 && !spot; k++) {                   // never wander into somebody's square
          const c = IMP.free(p.x + Math.round((Math.random() - .5) * 10), p.y + Math.round((Math.random() - .5) * 8), 4);
          if (standable(c.x, c.y, p)) spot = c;
        }
        if (spot) walkPath(p, inRoom() ? roomPath({ x: p.x, y: p.y }, spot) : IMP.path({ x: p.x, y: p.y }, spot, 3000));
        /* a citizen idling turns to look at whatever is going on: you, if you are close */
        else if (you && Math.hypot(you.x - p.x, you.y - p.y) < 4) p.dir = Math.abs(you.x - p.x) > Math.abs(you.y - p.y) ? (you.x < p.x ? 'left' : 'right') : (you.y < p.y ? 'up' : 'down');
      } else if (p.talkable && night && r < .5 && !inRoom()) {
        const home = IMP.spotOf((IMP.SCHEDULE[p.id] || ['domus'])[2], Math.floor(r * 9));
        if (standable(home.x, home.y, p)) walkPath(p, IMP.path({ x: p.x, y: p.y }, home, 12000));
      }
    });
    separate(dt);
    updateFx(dt);
    draw(night);
    if (t - (boot.hudAt || 0) > 900) {
      boot.hudAt = t; hud();
      const pt = partOfDay(); if (boot.part !== undefined && boot.part !== pt) shiftChange(); boot.part = pt;   // morning, afternoon, evening
      musicFor(here().id);                                     // the music follows you: a new district, a room, a journey, a battle
      /* whatever has been waiting (a client at the door, a fire, the rival's latest) comes when the screen is clear */
      if (window.WIDER && S) { try { WIDER.tick(S, wapi()); } catch (e) { console.warn('wider tick', e); } }
    }
  }
  let dusk;
  function updateWeather(dt) {
    if (!S.set.weather) { weatherP = []; return; }
    if (Math.random() < dt / 260) { S.weather = S.weather === 'clear' ? (Math.random() < .5 ? 'rain' : 'cloud') : 'clear'; if (S.weather === 'rain') { S.wet = 1; toast('Rain', 'the streets shine and the crowd thins', 'water'); } }
    const rate = (S.weather === 'rain' ? 150 : S.weather === 'cloud' ? 6 : 8) * zoom();
    if (weatherP.length < rate) weatherP.push({ x: Math.random() * vw() + cam.x, y: cam.y - 20 - Math.random() * 60, v: 420 + Math.random() * 260, l: S.weather === 'rain' ? 1 : .5, leaf: Math.random() < .2 });
  }
  function updateFx(dt) {
    weatherP.forEach(p => { p.y += p.v * dt * (p.leaf ? .3 : 1); p.x += (p.leaf ? Math.sin(p.y / 30) * 30 * dt : p.v * .06 * dt); });
    weatherP = weatherP.filter(p => p.y < cam.y + vh() + 30);
    fx.forEach(f => { f.life -= dt; f.y -= dt * 18; });
    fx = fx.filter(f => f.life > 0);
  }
  function draw(night) {
    const c = $('view'), g = c.getContext('2d');
    g.imageSmoothingEnabled = false;
    const z = zoom(), sw = view().w, sh = view().h, ww = sw / z, wh = sh / z;
    cam.x += (cam.tx - cam.x) * .16; cam.y += (cam.ty - cam.y) * .16;
    g.fillStyle = '#151318'; g.fillRect(0, 0, sw, sh);
    g.save(); g.scale(z, z); g.translate(-Math.round(cam.x), -Math.round(cam.y));
    const src = inRoom() ? room.base : art.base;
    g.drawImage(src, Math.round(cam.x), Math.round(cam.y), Math.ceil(ww), Math.ceil(wh), Math.round(cam.x), Math.round(cam.y), Math.ceil(ww), Math.ceil(wh));
    /* everything that stands up, sorted so nearer things overlap farther ones */
    const items = [];
    const base = inRoom() ? room.over : art.anim;
    base.forEach(a => { if (inView(a.x, a.y, a.art.w, a.art.h)) items.push({ y: a.y + a.art.h, x: a.x, y2: a.y, art: a.art }); });
    people.forEach(p => { if (inView(p.fx, p.fy, 28, 40)) items.push({ y: p.fy + 34, ent: p }); });
    if (inView(you.fx, you.fy, 28, 40)) items.push({ y: you.fy + 34, ent: you });
    items.sort((a, b) => a.y - b.y);
    items.forEach(it => {
      if (it.art) {
        const c1 = it.art.frames ? it.art.frames[Math.floor(boot.t / (it.art.fps || 8) * 1000 / 125) % it.art.frames.length] : it.art.c;
        g.drawImage(c1, it.x, it.y2);
        return;
      }
      const p = it.ent;
      g.save(); g.globalAlpha = .32; g.fillStyle = '#100c12';
      g.beginPath(); g.ellipse(p.fx + 14, p.fy + 34, 11, 4.4, 0, 0, 6.3); g.fill(); g.restore();
      if (p.you) {                                  // a small ring of light so you never lose yourself in a crowd
        g.save(); g.globalAlpha = .5; g.strokeStyle = '#f0d47a'; g.lineWidth = 1.4;
        g.beginPath(); g.ellipse(p.fx + 14, p.fy + 35, 12, 4.6, 0, 0, 6.3); g.stroke();
        g.globalAlpha = .22; g.fillStyle = '#f0d47a'; g.fill(); g.restore();
      }
      const spr = p.spr[p.dir] || p.spr.down;
      let img = spr[(p.frame || 0) % 4];
      if (p.thisFrame) img = p.thisFrame;
      /* the Shieldwall wobble: everybody sways a little on their feet, and rocks from side to side when they walk */
      const ph = p.wob || (p.wob = 1 + Math.random() * 6), tt = performance.now() / 1000;
      const rot = p.walk ? Math.sin(tt * 10 + ph) * .085 : Math.sin(tt * 1.7 + ph) * .03;
      const sq = p.walk ? 1 - Math.abs(Math.sin(tt * 10 + ph)) * .06 : 1 + Math.sin(tt * 2.3 + ph) * .025;
      g.save(); g.translate(Math.round(p.fx) + 14, Math.round(p.fy) + 33); g.rotate(rot); g.scale(2 - sq, sq);
      g.drawImage(img, -14, -37); g.restore();
      if (p.you && p.think) {                                       // the little mark over your own head
        g.font = 'bold 13px "Atkinson Hyperlegible",sans-serif'; g.fillStyle = '#f4e3b0'; g.textAlign = 'center';
        g.fillText(p.think, p.fx + 14, p.fy - 12);
      }
    });
    /* dust and blood and coins */
    fx.forEach(f => { g.globalAlpha = clamp(f.life * 2, 0, 1) * .7; g.fillStyle = f.t === 'blood' ? '#8c2222' : f.t === 'coin' ? '#e0c46a' : '#cbbfa4'; g.fillRect(f.x, f.y, f.t === 'coin' ? 4 : 6, f.t === 'coin' ? 4 : 3); g.globalAlpha = 1; });
    /* rain and leaves fall in the world, not the screen */
    weatherP.forEach(p => { g.strokeStyle = p.leaf ? 'rgba(140,160,90,.55)' : 'rgba(190,215,230,.5)'; g.lineWidth = 1; g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(p.x + (p.leaf ? 3 : 1.5), p.y + (p.leaf ? 6 : 14)); g.stroke(); });
    /* lamps and torches at night, drawn under the dark so they light the street */
    const dark = darkAmt(S.time);
    if (outdoors()) sky(g, dark);
    if (dark > .02) {                                        // the lamps come up as the light goes down, and fade with it
      const lt = (inRoom() ? room.lights : art.lights) || [];
      g.save(); g.globalAlpha = Math.min(1, dark * 1.2);
      lt.forEach(l => { const gl = PIX.glow(52); g.drawImage(gl, l.x * T - 36, l.y * T - 36); });
      g.restore();
    }
    /* the objective, when it is on the picture: a shaft of light on the door you want, breathing */
    if (S.questTarget && !inRoom()) {
      const q = S.questTarget, qx = q.x * T + 16, qy = q.y * T + 16;
      if (inView(qx - 70, qy - 200, 140, 250)) {
        const pulse = .6 + .4 * Math.sin(((boot.t || lastT) / 1000) * 2.3);
        g.save();
        const gr = g.createLinearGradient(0, qy - 156, 0, qy + 6);
        gr.addColorStop(0, 'rgba(240,212,122,0)');
        gr.addColorStop(.6, 'rgba(240,212,122,' + (.1 * pulse).toFixed(3) + ')');
        gr.addColorStop(1, 'rgba(240,212,122,' + (.32 * pulse).toFixed(3) + ')');
        g.fillStyle = gr;
        g.beginPath();
        g.moveTo(qx - 8, qy); g.lineTo(qx + 8, qy);
        g.lineTo(qx + 28, qy - 156); g.lineTo(qx - 28, qy - 156);
        g.closePath(); g.fill();
        g.strokeStyle = 'rgba(240,212,122,' + (.6 * pulse).toFixed(3) + ')'; g.lineWidth = 2;
        g.beginPath(); g.ellipse(qx, qy - 2, 13 + 3.5 * pulse, 5.6 + 1.5 * pulse, 0, 0, 6.3); g.stroke();
        g.fillStyle = 'rgba(240,212,122,' + (.11 * pulse).toFixed(3) + ')'; g.fill();
        g.restore();
      }
    }
    g.restore();
    /* the colour of the afternoon: a warm soft-light grade over the whole picture by day, strongest in the gold
       hours after dawn and before dusk, gone by night (the night has its own tint below) */
    if (outdoors() && dark < .6) {
      const h = S.time % 24, gold = h < 9 ? (9 - h) / 3 : h > 16 ? (h - 16) / 3 : 0;
      g.save(); g.globalCompositeOperation = 'soft-light';
      g.globalAlpha = (.2 + .16 * clamp(gold, 0, 1)) * (1 - dark / .6) * (S.weather === 'rain' ? .4 : 1);
      g.fillStyle = gold > .3 ? '#ffb070' : '#ffd29a'; g.fillRect(0, 0, sw, sh); g.restore();
    }
    const [tc, ta] = hourTint();
    /* outdoors the dark itself comes from the light map below, so the sky's tint keeps only its colour at night */
    const nightK = outdoors() ? dark * .85 : 0;
    if (ta > 0) { g.fillStyle = tc; g.globalAlpha = ta * (1 - nightK); g.fillRect(0, 0, sw, sh); g.globalAlpha = 1; }
    if (outdoors() && dark > .03) nightLights(g, sw, sh, z, dark);
    if (S.weather === 'cloud') { g.fillStyle = 'rgba(90,96,110,.14)'; g.fillRect(0, 0, sw, sh); }
    if (S.weather === 'rain') { g.fillStyle = 'rgba(70,90,110,.1)'; g.fillRect(0, 0, sw, sh); }
    if (boot.flash > boot.t) { g.fillStyle = 'rgba(255,250,230,.5)'; g.fillRect(0, 0, sw, sh); }
    /* ...and when it is off the picture, the same instruction pinned to the edge so the way is never a guess */
    if (S.questTarget && !inRoom()) {
      const q = S.questTarget;
      const sxp = (q.x * T + 16 - cam.x) * z, syp = (q.y * T + 16 - cam.y) * z;
      const pad = 42;
      if (sxp < pad || sxp > sw - pad || syp < pad || syp > sh - pad) {
        const cx2 = sw / 2, cy2 = sh / 2;
        const a = Math.atan2(syp - cy2, sxp - cx2);
        const rr = Math.max(64, Math.min(sw, sh) * .32);
        const ax2 = clamp(cx2 + Math.cos(a) * rr, pad, sw - pad);
        const ay2 = clamp(cy2 + Math.sin(a) * rr, pad + 26, sh - pad);
        g.save();
        g.translate(ax2, ay2); g.rotate(a);
        g.fillStyle = 'rgba(12,8,5,.82)';
        g.beginPath(); g.moveTo(-15, -14); g.lineTo(15, 0); g.lineTo(-15, 14); g.lineTo(-6, 0); g.closePath(); g.fill();
        g.fillStyle = '#f0d47a';
        g.beginPath(); g.moveTo(-12, -9.5); g.lineTo(11, 0); g.lineTo(-12, 9.5); g.lineTo(-5.5, 0); g.closePath(); g.fill();
        g.restore();
        g.save();
        g.font = '700 11px "Atkinson Hyperlegible",sans-serif'; g.textAlign = 'center'; g.textBaseline = 'top';
        const lbl = Math.round(Math.hypot(q.x - you.x, q.y - you.y)) + ' paces';
        const wdt = g.measureText(lbl).width + 12;
        g.fillStyle = 'rgba(12,8,5,.8)'; g.fillRect(ax2 - wdt / 2, ay2 + 16, wdt, 15);
        g.fillStyle = '#f0d47a'; g.fillText(lbl, ax2, ay2 + 18);
        g.restore();
      }
    }
    /* the air over the picture: vignette, dust in the sunlight, splashes when the ground is wet */
    if (window.DECOR && window.DECOR.atmos) window.DECOR.atmos(g, sw, sh, S, boot.t || lastT, night);
  }
  /* Night as a light map: a layer of deep blue over the whole picture with a soft hole cut wherever there is light
     (every torch, lamp and shop lantern, about half the windows, and the little circle you carry yourself), then a
     warm glow added on top. The dark pools between the lights instead of greying the whole city. */
  let lightMap = null, winLights = null;
  function nightLights(g, sw, sh, z, dark) {
    if (!lightMap || lightMap.width !== sw || lightMap.height !== sh) lightMap = PIX.cv(sw, sh);
    if (!winLights) {
      winLights = [];
      (IMP.load().buildings || []).forEach(b => {
        if (b.wy == null || b.style === 'temple' || b.style === 'tomb' || b.style === 'circus') return;
        const n = Math.max(1, Math.floor(b.w * T / 44));
        for (let i = 0; i < n; i++) {
          const h = Math.sin(b.x * 31.7 + b.y * 17.3 + i * 7.1) * 1e4, f = h - Math.floor(h);
          if (f < .5) winLights.push({ x: b.x * T + 16 + i * 44 + f * 12, y: b.wy + 18 });
        }
      });
    }
    const lamps = (inRoom() ? room.lights : art.lights) || [], lg = lightMap.getContext('2d');
    const windows = inRoom() ? [] : winLights;                         // out in the country only the lamps and fires light the dark
    lg.globalCompositeOperation = 'source-over'; lg.clearRect(0, 0, sw, sh);
    lg.fillStyle = 'rgba(12,16,42,' + (.68 * dark).toFixed(3) + ')'; lg.fillRect(0, 0, sw, sh);
    lg.globalCompositeOperation = 'destination-out';
    const at = (wx, wy, R) => { const x = (wx - cam.x) * z, y = (wy - cam.y) * z; return x < -R * z || y < -R * z || x > sw + R * z || y > sh + R * z ? null : [x, y]; };
    const hole = (wx, wy, r, a) => {
      const p = at(wx, wy, r); if (!p) return;
      const R = r * z, gr = lg.createRadialGradient(p[0], p[1], 0, p[0], p[1], R);
      gr.addColorStop(0, 'rgba(0,0,0,' + a + ')'); gr.addColorStop(.55, 'rgba(0,0,0,' + (a * .45) + ')'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      lg.fillStyle = gr; lg.fillRect(p[0] - R, p[1] - R, R * 2, R * 2);
    };
    lamps.forEach(l => hole(l.x * T + 16, l.y * T + 10, 96, .95));
    windows.forEach(w => hole(w.x, w.y, 36, .75));
    if (you) hole(you.fx + 14, you.fy + 22, 64, .5);
    g.drawImage(lightMap, 0, 0);
    g.save(); g.globalCompositeOperation = 'lighter';
    const gl = PIX.glow(52);
    g.globalAlpha = .3 * dark; lamps.forEach(l => { const p = at(l.x * T + 16, l.y * T + 10, 60); if (p) g.drawImage(gl, p[0] - 56 * z, p[1] - 56 * z, 112 * z, 112 * z); });
    g.globalAlpha = .26 * dark; windows.forEach(w => { const p = at(w.x, w.y, 24); if (p) g.drawImage(gl, p[0] - 18 * z, p[1] - 18 * z, 36 * z, 36 * z); });
    g.restore();
  }
  /* Over the city, in the world and not on the screen, so it scrolls with the streets: the shadows of clouds sliding
     across the roofs, and now and then a flock of birds with their own small shadows on the ground below. */
  let cloudArt = null;
  function sky(g, dark) {
    if (dark > .7) return;
    const t = performance.now() / 1000, WW = inRoom() ? room.base.width : IMP.W * T, HH = inRoom() ? room.base.height : IMP.H * T;
    if (!cloudArt) {
      cloudArt = PIX.cv(520, 320); const cg = cloudArt.getContext('2d'), rr = (a, b) => a + Math.random() * (b - a);
      for (let i = 0; i < 14; i++) {
        const x = rr(110, 410), y = rr(90, 230), r = rr(50, 110), gr = cg.createRadialGradient(x, y, 0, x, y, r);
        gr.addColorStop(0, 'rgba(26,22,44,.5)'); gr.addColorStop(1, 'rgba(26,22,44,0)');
        cg.fillStyle = gr; cg.fillRect(x - r, y - r, r * 2, r * 2);
      }
    }
    const a = (S.weather === 'cloud' ? .55 : S.weather === 'rain' ? .3 : .3) * (1 - dark);
    g.save(); g.globalAlpha = a;
    for (let i = 0; i < 6; i++) {
      const span = WW + 1100, x = ((i * 1733 + t * (14 + i * 2)) % span) - 600, y = ((i * 977) % (HH - 200)) - 60 + Math.sin(t / 40 + i) * 30;
      if (inView(x, y, 520, 320)) g.drawImage(cloudArt, x, y, 520 * (1 + (i % 3) * .3), 320 * (1 + (i % 2) * .25));
    }
    g.restore();
    /* a flock every half minute or so, crossing on a slant, wings beating out of step */
    const cycle = 34, k = Math.floor(t / cycle), p = (t % cycle) / cycle;
    if (p > .62 || S.weather === 'rain') return;
    const sr = n => { const s = Math.sin(k * 91.7 + n * 12.9) * 43758.5; return s - Math.floor(s); };
    const fx0 = cam.x - 120 + (vw() + 240) * (p / .62), fy0 = cam.y + vh() * (.15 + sr(1) * .5) - p * 90;
    for (let i = 0; i < 7; i++) {
      const bx = fx0 - i * 13 - (i % 2) * 6, by = fy0 + (i % 2 ? 1 : -1) * Math.ceil(i / 2) * 9, flap = Math.sin(t * 9 + i * 1.7) > 0;
      g.fillStyle = 'rgba(28,20,40,.2)'; g.fillRect(bx + 46, by + 70, 5, 2);                           // its shadow on the street
      g.fillStyle = '#2c2420';
      g.fillRect(bx, by, 2, 2);
      if (flap) { g.fillRect(bx - 4, by - 2, 4, 1); g.fillRect(bx + 2, by - 2, 4, 1); } else { g.fillRect(bx - 4, by + 1, 4, 1); g.fillRect(bx + 2, by + 1, 4, 1); }
    }
  }
  const inView = (x, y, w, h) => x + w > cam.x - 60 && x < cam.x + vw() + 60 && y + h > cam.y - 80 && y < cam.y + vh() + 80;

  /* ============================ the HUD ============================ */
  const toast = (t, s, k) => {
    const box = $('toasts'); if (!box) return;
    const d = document.createElement('div');
    d.className = 'toast ' + (k === 'bad' ? 'bad' : k === 'good' ? 'good' : '');
    d.innerHTML = '<b>' + esc(t) + '</b>' + (s ? '<span>' + esc(s) + '</span>' : '');
    box.appendChild(d);
    if (boot.nowT) boot.nowT.textContent = s ? t + ' — ' + s : t;
    setTimeout(() => { d.classList.add('out'); setTimeout(() => d.remove(), 500); }, 4200);
  };
  function hud() {
    if (!S) return;
    const r = rankOf(), here_ = here();
    const money = $('hMoney'), au = $('hAu'), off = $('hOffice'), loc = $('hLoc'), when = $('hWhen'), xp = $('hXp');
    if (money) money.textContent = S.denarii.toLocaleString() + ' ⚖';
    if (au) au.textContent = Math.round(S.auctoritas) + ' ✦';
    if (off) off.textContent = (S.office || 'Tiro') + ' · ' + rankName() + ' ' + Math.round(S.xp);
    if (loc) loc.innerHTML = '<b>' + (here_.g || '') + ' ' + esc(here_.name) + '</b>' + (here_.sub ? '<span>' + esc(here_.sub) + '</span>' : '');
    if (when) when.textContent = fmtTime();
    if (xp) { xp.style.width = (rankProgress() * 100).toFixed(1) + '%'; xp.title = 'next: ' + (IMP.ranks[r + 1] ? IMP.ranks[r + 1][1] : 'the end of the ladder'); }
    const hint = $('hint');
    if (hint) {
      const near = nearestPerson(2.2);
      hint.innerHTML = inRoom()
        ? '<span class="k">WASD</span> walk · <span class="k">Shift</span> run · <span class="k">E</span> talk · <span class="k">Esc</span> out of here'
        : near ? '<span class="k">E</span> talk to ' + esc(near.name)
          : buildingHere() ? '<span class="k">E</span> enter ' + esc((buildingHere() || {}).name || '') + (buildingHere() && buildingHere().loc ? '' : ' (nothing inside)')
            : '<span class="k">Click</span> to walk · <span class="k">E</span> what can I do here · <span class="k">J</span> journal · <span class="k">M</span> map';
    }
    refreshTarget();
    tracker();
    mini();
    objectiveBar();
    if (window.COMP) COMP.hud($('squad'), { S, toast, save, refresh: () => hud() });
    const bar = $('hudBar'); if (bar) bar.style.opacity = boxOpen() ? .25 : 1;
  }
  const fmtTime = () => {
    const h = Math.floor(S.time), m = Math.floor((S.time - h) * 60);
    const w = S.weather === 'rain' ? '🌧' : S.weather === 'cloud' ? '☁️' : S.time < 6.5 || S.time > 19 ? '🌙' : '☀️';
    const se = IMP.seasons[S.season % 4];
    return w + ' ' + String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0') + ' · day ' + S.day + ' · ' + se;
  };
  function objectiveBar() {
    const box = $('objbar'); if (!box) return;
    const list = objective(), o = list[0];
    if (!o) {
      const nx = STORY.next(S);
      box.className = 'objbar idle';
      box.innerHTML = nx
        ? '<i class="oi">📜</i><div><b>Nothing in hand</b><span>Chapter ' + nx.n + ' — ' + esc(nx.title) + ' — is waiting. Press <u>E</u> anywhere to take it up.</span></div>'
        : '<i class="oi">✅</i><div><b>Every chapter done</b><span>The rest of your life is the city. Jobs still pay: press <u>E</u> at any door.</span></div>';
      return;
    }
    const place = placeName(o.at);
    const dist = S.questTarget ? Math.round(Math.hypot(S.questTarget.x - you.x, S.questTarget.y - you.y)) : 0;
    box.className = 'objbar' + (o.here ? ' arrived' : '');
    box.innerHTML = '<i class="oi">' + o.icon + '</i><div>' +
      '<b>' + esc(o.act) + '</b>' +
      '<span>' + esc(o.label) + ' · ' + (o.here
        ? '✓ You are here — press <u>E</u>'
        : esc(place) + (dist ? ' · <b class="dist">' + dist + ' paces ' + bearing(you, S.questTarget) + '</b>' : '')) + '</span>' +
      '</div>' + (o.here ? '' : '<button class="ogot" id="oGo">Go →</button>');
    const btn = $('oGo'); if (btn) btn.onclick = () => goToPlace(o.at);
  }
  function tracker() {
    const box = $('tracker'); if (!box) return;
    const act = STORY.actOf(S);
    const ch = STORY.CH.find(c => STORY.active(S, c.id));
    const side = IMP.QUESTS.filter(q => STORY.active(S, q.id));
    let h = '<div class="th">' + (ch ? 'Chapter ' + ch.n + ' · ' + esc(ch.title) : 'No chapter in hand') + '<i>Act ' + act + '</i></div>';
    if (ch) {
      const st = S.quests.step[ch.id] || 0;
      h += '<div class="tsteps">' + ch.steps.map((s, i) => '<div class="ts' + (i < st ? ' done' : i === st ? ' now' : '') + '"><i>' + (i < st ? '✔' : i === st ? '▸' : '·') + '</i>' + esc(s.text) + (i === st ? '<em>' + esc(placeName(s.at)) + '</em>' : '') + '</div>').join('') + '</div>';
    }
    if (side.length) h += '<div class="tside">' + side.map(q => { const st = S.quests.step[q.id] || 0, s = q.steps[st]; return '<div class="ts now"><i>' + q.ic + '</i>' + esc(q.n) + (s ? '<em>' + esc(placeName(s.at)) + '</em>' : '') + '</div>'; }).join('') + '</div>';
    box.innerHTML = h;
  }
  function mini() {
    const box = $('mini'); if (!box) return;
    box.style.display = S.set.mini ? '' : 'none';
    if (!S.set.mini) return;
    const c = box.querySelector('canvas'); if (!c) return;
    if (!boot.miniMap) {
      const m = document.createElement('canvas'); m.width = IMP.W; m.height = IMP.H;
      const g = m.getContext('2d');
      const P = { water: '#2f5a6b', cobble: '#8a8274', cobble2: '#7c7466', plaza: '#cfc6b1', marble: '#d9d2c2', stone: '#bfb6a2', garden: '#4f6f3a', grass: '#4a6a33', flower: '#5a7a3c', sand: '#d3b681', track: '#d8bd8d', wood: '#7a5c39', wall: '#6b6152', fresco: '#7a2620', mosaic: '#c9b489', rubble: '#6b6255', roof: '#a5552f', dirt: '#6d5a41' };
      for (let y = 0; y < IMP.H; y++) for (let x = 0; x < IMP.W; x++) { g.fillStyle = P[L.tile[y][x][0]] || '#888'; g.fillRect(x, y, 1, 1); }
      L.buildings.forEach(b => { g.fillStyle = '#3a3228'; g.fillRect(b.x, b.y, b.w, b.h); if (b.loc) { g.fillStyle = '#e0c46a'; g.fillRect(b.x + ((b.w - 1) >> 1), b.y + b.h - 1, 1, 1); } });
      boot.miniMap = m;
    }
    const R = 9, scale = 6, w = R * 2 * scale;
    c.width = w; c.height = w;
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = false;
    g.fillStyle = '#0d0c10'; g.fillRect(0, 0, w, w);
    const px = inRoom() ? Math.floor(room.w / 2) : you.x, py = inRoom() ? Math.floor(room.h / 2) : you.y;
    const sx = inRoom() ? 0 : clamp(px - R, 0, IMP.W - R * 2), sy = inRoom() ? 0 : clamp(py - R, 0, IMP.H - R * 2);
    if (inRoom()) {
      for (let y = 0; y < room.h; y++) for (let x = 0; x < room.w; x++) { g.fillStyle = room.solid[y * room.w + x] ? '#3a3228' : '#b3a68c'; g.fillRect(x * scale, y * scale, scale, scale); }
      g.fillStyle = '#e0c46a'; g.fillRect(you.x * scale, you.y * scale, scale, scale);
    } else {
      g.drawImage(boot.miniMap, sx, sy, R * 2, R * 2, 0, 0, w, w);
      people.forEach(p => { if (Math.abs(p.x - sx) < R * 2 && Math.abs(p.y - sy) < R * 2) { g.fillStyle = p.char ? '#e66a4a' : 'rgba(230,220,190,.7)'; g.fillRect((p.x - sx) * scale, (p.y - sy) * scale, scale, scale); } });
      g.fillStyle = '#fff6d0'; g.fillRect((you.x - sx) * scale, (you.y - sy) * scale, scale, scale);
      if (S.questTarget) { const q = S.questTarget; if (Math.abs(q.x - sx) < R * 2 && Math.abs(q.y - sy) < R * 2) { g.fillStyle = '#8fd0ff'; g.fillRect((q.x - sx) * scale, (q.y - sy) * scale, scale, scale); } }
    }
  }

  /* ============================ dialogue ============================ */
  let dlg = null;                       // { who, lines, i, choose, onEnd }
  function portraitFor(c) { return c ? PIX.portrait(lookOf(charById(c.id) || c), 72) : null; }
  const speakerOf = id => (id === 'narrator' ? { n: '', id: 'narrator' } : (id === 'you' ? { n: S.name, id: 'you' } : (charById(id) || { n: id, id })));
  /* a line is either plain text or a [who, text] pair; the portrait and the name follow the speaker line by line */
  function say(who, lines, o) {
    const pairs = (lines || []).map(l => Array.isArray(l) ? { who: l[0], text: String(l[1]) } : { who: who || 'narrator', text: String(l) });
    dlg = { lines: pairs, i: 0, choose: (o && o.choose) || null, onEnd: (o && o.onEnd) || null, typed: 0 };
    renderDlg();
  }
  function whoLook(id) {
    if (id === 'you') return you ? you.look : null;
    const c = charById(id);
    return c ? lookOf(c) : null;
  }
  function renderDlg() {
    const box = $('dialog');
    if (!dlg) { box.classList.remove('show'); box.innerHTML = ''; return; }
    const cur = dlg.lines[dlg.i] || { who: 'narrator', text: '' };
    const isN = cur.who === 'narrator';
    const c = speakerOf(cur.who);
    const line = cur.text;
    const shown = line.slice(0, Math.floor(dlg.typed));
    const lk = isN ? null : whoLook(cur.who);
    const p = lk ? PIX.portrait(lk, 72) : null;
    box.classList.add('show');
    box.innerHTML =
      '<div class="dbox' + (isN ? ' narr' : '') + '">' +
      (p ? '<div class="dport"><img src="' + p.toDataURL() + '" alt=""></div>' : '') +
      '<div class="dtext">' +
      (c.n && !isN ? '<div class="dname">' + esc(c.n) + (c.tt ? '<i>' + esc(c.tt) + '</i>' : '') + '</div>' : '') +
      '<div class="dline">' + esc(shown) + '<span class="caret">▾</span></div>' +
      (dlg.choose && dlg.i >= dlg.lines.length - 1 ? '<div class="dch">' + dlg.choose.opts.map((o2, k) => '<button data-k="' + k + '">' + esc(o2.t) + '</button>').join('') + '</div>'
        : '<div class="dgo"><button id="dnext">' + (dlg.i < dlg.lines.length - 1 ? 'Continue ▸' : dlg.choose ? '' : 'Close') + '</button><span class="kh">Space</span></div>') +
      '</div></div>';
    const nb = box.querySelector('#dnext'); if (nb) nb.onclick = dlgNext;
    box.querySelectorAll('.dch button').forEach(b => b.onclick = () => dlgPick(+b.dataset.k));
    dlg.typed = Math.min(dlg.typed, line.length);
  }
  function dlgTick(dt) {
    if (!dlg) return;
    const cur = dlg.lines[dlg.i]; if (!cur) return;
    const line = cur.text;
    if (dlg.typed < line.length) { dlg.typed = Math.min(line.length, dlg.typed + dt * 46); const el = document.querySelector('#dialog .dline'); if (el) el.innerHTML = esc(line.slice(0, Math.floor(dlg.typed))) + '<span class="caret">▾</span>'; }
  }
  function dlgNext() {
    if (!dlg) return;
    const cur = dlg.lines[dlg.i]; if (!cur) { dlg = null; renderDlg(); return; }
    const line = cur.text;
    if (dlg.typed < line.length) { dlg.typed = line.length; renderDlg(); return; }
    if (dlg.i < dlg.lines.length - 1) { dlg.i++; dlg.typed = 0; ImpAudio.sfx('click'); renderDlg(); return; }
    if (dlg.choose) { renderDlg(); return; }
    const end = dlg.onEnd; dlg = null; renderDlg(); if (end) end();
    flushCine();
  }
  function dlgPick(k) {
    const ch = dlg.choose, opt = ch.opts[k]; if (!opt) return;
    const after = dlg.onEnd; dlg = null; renderDlg();
    if (opt.say) say(opt.rawWho || ch.who || 'narrator', [opt.say], { onEnd: () => finishChoice(opt, after) });
    else finishChoice(opt, after);
  }
  function finishChoice(opt, after) {
    applyEff(opt.eff);
    if (opt.disp) for (const k in opt.disp) S.disp[k] = clamp((S.disp[k] || 0) + opt.disp[k], -1, 1);
    if (opt.flag) S.story.flags[opt.flag] = 1;
    /* a public decision is news: the street will repeat it to you */
    if (window.CIT && opt.flag && opt.t) CIT.note(S, 'They say ' + S.name + ' decided: “' + opt.t.replace(/\.$/, '') + '”');
    if (typeof opt.act === 'function') { try { opt.act(); } catch (e) { console.warn('choice', e); } }
    if (opt.end) return ending(opt.end);
    if (after) after(); else { hud(); save(true); }
  }
  function applyEff(e) {
    if (!e) return;
    if (e.denarii) { S.denarii = Math.max(0, S.denarii + e.denarii); }
    if (e.xp) xp(e.xp);
    if (e.auctoritas) S.auctoritas += e.auctoritas;
    if (e.rep) for (const k in e.rep) S.rep[k] = (S.rep[k] || 0) + e.rep[k];
    if (e.attrs) for (const k in e.attrs) S.attrs[k] = (S.attrs[k] || 0) + e.attrs[k];
    hud();
  }
  function xp(n) {
    const before = rankOf();
    /* the company takes a third of what you earn, and pays it back as bonuses */
    if (window.COMP) n = Math.max(1, Math.round(n * COMP.bonuses(S).xp));
    S.xp += n; S.xpLog.push([n, Date.now()]);
    if (window.COMP) COMP.share(S, n).forEach(u => { const r = COMP.recruitOf(u.id); if (r) toast(r.n + ' is level ' + u.lvl, COMP.whatItDoes(r, u.lvl), 'good'); });
    if (n >= 40) toast('+' + n + ' experience', 'the city learns your name a little better', 'good');
    if (rankOf() > before) {
      const r = IMP.ranks[rankOf()];
      S.office = IMP.offices[Math.min(IMP.offices.length - 1, rankOf())] || S.office;
      ImpAudio.sfx('good');
      fx = fx.concat([0, 1, 2, 3, 4, 5].map(i => ({ t: 'coin', x: you.fx + 4 + i * 4, y: you.fy + 20 - i * 3, life: .9 + i * .1 })));
      say('narrator', ['You are ' + r[1] + ' now — ' + r[2] + '. The clerks will write it down, and the men who count such things will write it down twice.'], { onEnd: () => hud() });
    }
  }
  function ending(which) {
    const e = STORY.endings[which] || STORY.endings.republic;
    const count = ({ 16: 'sixteen', 20: 'twenty' })[(STORY.CH || []).length] || String((STORY.CH || []).length || 'all the');
    const Count = count[0].toUpperCase() + count.slice(1);
    cine({
      kicker: count + ' chapters later',
      title: e.title,
      paras: [S.battles.w + ' battles won and ' + S.battles.l + ' lost, ' + Math.round(S.xp) + ' experience, ' + S.denarii.toLocaleString() + ' denarii, and ' + Object.keys(S.story.flags).length + ' decisions the clerks wrote down and never threw away.',
        'Rome does not announce what it has decided about you. It simply starts treating you that way.'],
      go: 'See how it ends ▸'
    }, () => say('narrator', e.lines, {
      onEnd: () => {
        S.end = which;
        modal('🏁 ' + e.title, '<div class="ending"><div class="eic">' + e.ic + '</div><p>' + Count + ' chapters, ' + S.battles.w + ' battles won, ' + S.battles.l + ' lost, ' + Math.round(S.xp) + ' experience, ' + S.denarii.toLocaleString() + ' denarii, and ' + Object.keys(S.story.flags).length + ' decisions that will follow you into the archives.</p><p class="mute">' + (S.rep.senate > 20 ? 'The house loved you.' : S.rep.senate < -10 ? 'The house never forgave you.' : 'The house tolerated you.') + ' ' + (S.rep.people > 20 ? 'The crowd cheered.' : 'The crowd never learned your name.') + '</p></div>' +
          '<div class="row" style="justify-content:flex-end;margin-top:12px"><button class="btn" id="ep">Play on in the city</button><button class="btn pri" id="en">Begin a new career</button></div>');
        const p = $('ep'), n = $('en');
        if (p) p.onclick = () => closeModal();
        if (n) n.onclick = () => { localStorage.removeItem(SAVE()); location.reload(); };
        save();
      }
    }));
  }

  /* ============================ chapter cards and the act turns ============================ */
  /* Between one chapter and the next the world stops and the game shows a plate: where the career stands, what the
     chapter is called, what it is going to cost. Under it sits the quiet machinery that makes a career feel like it
     is going somewhere — an act turning over, and the letter that comes with it. */
  const ACTS_CAREER = [
    { name: 'A nobody with a name', blurb: 'You have a mended toga, a name nobody has written down twice, and a chair in the Senate house with another man’s dust still on it. Everything in this act is cheap, and everything in it will be remembered.' },
    { name: 'The price of everything', blurb: 'You are worth buying now. Grain, the courts and the men who own both will find out what you are willing to sign, and the city keeps every copy. What you refuse this year will cost you more than what you take.' },
    { name: 'The city in the balance', blurb: 'Two men cannot be consul at once, and both of them have legions within a week’s march. Whatever you do in this act, somebody will call it treason and somebody will call it the only decent thing left in Rome.' },
    { name: 'What Rome becomes', blurb: 'A career does not end with a battle. It ends on a morning when the house votes, the streets are quiet, and the city decides what to call you while you are not in the room.' }
  ];
  /* Caesar's life comes in four acts too, and they are not the acts of a man inventing a career — they are the acts
     of a Republic deciding, over twenty years, that it has no idea what to do with him. */
  const ACTS_CAESAR = [
    { name: 'The boy from the Subura', blurb: 'A patrician name and a house with a hole in the roof. Everything in this act is about how much of your future you are willing to spend before you have any.' },
    { name: 'Gaul', blurb: 'Eight years, a province, a million words of dispatches and a great many men. You will come back rich, owed, feared, and completely unable to explain to the Senate what you were doing there.' },
    { name: 'The die is cast', blurb: 'A small river, a boundary stone, and the difference between a general and an enemy of the state, which turns out to be the direction you are walking.' },
    { name: 'The man who would not be king', blurb: 'Four triumphs, a calendar, a crown offered three times and a morning in March when sixty men with knives decide the argument in about four minutes.' }
  ];
  const acts = () => (S && S.mode === 'caesar' ? ACTS_CAESAR : ACTS_CAREER);
  let cineDone = null;
  const cineQ = [];                    // a card asked for while another is up waits its turn instead of eating it
  /* the plate itself: a kicker, a title, the body, and one way out of it */
  function cine(o, after) {
    if (!o) return;
    if (cineUp() || dlg || document.querySelector('#modal.show')) { cineQ.push([o, after]); return; }
    const host = $('cine');
    cineDone = after || null;
    const paras = (o.paras || []).filter(Boolean).map(p => '<p>' + esc(p) + '</p>').join('');
    host.innerHTML = '<div class="cbox">' +
      (o.kicker ? '<div class="kicker">' + esc(o.kicker) + '</div>' : '') +
      '<div class="ctitle">' + esc(o.title) + '</div><div class="cline"></div>' +
      (paras ? '<div class="cbody">' + paras + '</div>' : '') +
      '<div class="cgo"><button class="btn pri big" id="cgo">' + esc(o.go || 'Go on ▸') + '</button>' +
      (o.sub ? '<div class="small mute" style="margin-top:9px">' + esc(o.sub) + '</div>' : '') + '</div></div>';
    host.classList.add('show');
    host.onclick = cineClose;
    $('cgo').onclick = ev => { ev.stopPropagation(); cineClose(); };
    paused = true; keys = {};                                  // the world holds still while the card is up
    ImpAudio.sfx('scroll');
    if (S && S.set.sound) ImpAudio.music('plate');              // the plate has its own music: a bell and a chant
    hud();
  }
  function cineClose() {
    const host = $('cine');
    if (!host || !host.classList.contains('show')) return;
    host.classList.remove('show'); host.innerHTML = '';
    paused = false; keys = {};
    if (S) musicFor(here().id);                                 // back to the street the card interrupted
    const d = cineDone; cineDone = null;
    if (d) d();
    flushCine();
  }
  /* a card that had to wait for the last one, or for a line of dialogue, gets shown as soon as the floor is free */
  function flushCine() {
    if (!cineQ.length || cineUp() || dlg || document.querySelector('#modal.show')) return;
    const [o, after] = cineQ.shift();
    cine(o, after);
  }
  const cineUp = () => { const h = $('cine'); return !!(h && h.classList.contains('show')); };
  function actCard(act, after) {
    const a = acts()[act - 1]; if (!a) { if (after) after(); return; }
    cine({ kicker: act >= 4 ? 'Act IV · the last act' : 'Act ' + act + ' of four', title: a.name, paras: [a.blurb], go: 'Act ' + act + ' ▸' }, after);
  }
  /* the letter that arrives when the year turns — the only voice in the game that talks to you about your own life
     rather than about Rome */
  function actLetter(act, after) {
    const l = STORY.letterAt(act);
    if (!l) { if (after) after(); return; }
    say(null, l.lines, { onEnd: () => { if (after) after(); else hud(); } });
  }
  /* an act turning over: the plate, then the letter, then whatever comes next */
  function actTurn(act, after) {
    S.actShown = act;
    save(true);
    actCard(act, () => actLetter(act, () => { if (after) after(); }));
  }

  /* ============================ chapters, quests, actions ============================ */
  /* `open` plays a chapter's scene without its question: the question is asked at the end of the chapter */
  function play(sceneId, done2, open) {
    const s = STORY.scene(sceneId); if (!s) { if (done2) done2(); return; }
    S.story.seen[sceneId] = (S.story.seen[sceneId] || 0) + 1;
    if (open) { S.story.opened = S.story.opened || {}; S.story.opened[sceneId] = 1; }
    const choose = s.choose && !open ? Object.assign({ who: s.choose.who || 'you' }, s.choose) : null;
    say(null, s.lines, { choose, onEnd: () => { if (done2) done2(); else hud(); } });
  }
  /* The chapter's decision comes once you have done the walking, which is the point of the walking. A save made before
     this worked that way has already answered it, at the start (seen, but never opened without its question). */
  function undecided(c) {
    const s = c && STORY.scene(c.scene); if (!s || !s.choose) return false;
    const st = S.story; st.opened = st.opened || {}; st.decided = st.decided || {};
    if (st.decided[c.scene]) return false;
    return !((st.seen[c.scene] || 0) && !st.opened[c.scene]);
  }
  function decide(c, after) {
    const s = STORY.scene(c.scene);
    S.story.decided = S.story.decided || {}; S.story.decided[c.scene] = 1;
    const back = s.lines.filter(l => l[0] !== 'narrator').slice(-1)[0] || s.lines[s.lines.length - 1];
    say(null, [back], { choose: Object.assign({ who: s.choose.who || 'you' }, s.choose), onEnd: after });
  }
  /* One chapter at a time. A chapter left open (an old save, or a second one started in the same breath as the
     first) becomes the one in hand again, so nothing is stranded and the chapters after it can still be offered. */
  /* the same for jobs: taking a new job used to leave the old one active and invisible for ever */
  function focusJob() {
    const open = (S.quests.active || []).filter(id => !STORY.chapter(id) && IMP.QUESTS.some(q => q.id === id));
    if (!open.includes(S.quests.qId)) S.quests.qId = open[0] || null;
  }
  function focusChapter() {
    const open = (S.quests.active || []).filter(id => STORY.chapter(id) && !STORY.done(S, id));
    if (open.includes(S.quests.chId)) return S.quests.chId;
    if (open.length) { S.quests.chId = open[0]; return open[0]; }
    return null;
  }
  function offerChapter(quiet) {
    const held = focusChapter();
    if (held) {
      if (quiet) return false;                    // the timer after a chapter closes, and you had already begun the next
      const h = STORY.chapter(held);
      toast('Unfinished business', 'Chapter ' + h.n + ' · ' + h.title + ' is still open — the journal (J) has the next step', 'scroll');
      hud(); return false;
    }
    const c = STORY.next(S);
    if (!c) return false;
    S.quests.active.push(c.id); S.quests.step[c.id] = 0; S.quests.chId = c.id;
    recastIfMoved();
    const giver = charById(c.giver), first = (c.steps && c.steps[0]) || null;
    cine({
      kicker: 'Chapter ' + c.n + ' · Act ' + c.act,
      title: c.title,
      paras: [c.d, 'Find ' + (giver ? giver.n : 'the man who sent for you') + ' at ' + (IMP.LOCS[c.where] ? IMP.LOCS[c.where].name : c.where) + ', or do the work where it takes you.'],
      go: 'Begin ▸',
      sub: first ? 'First: ' + String(first.act).toLowerCase() + ' · the journal (J) keeps every step' : 'The journal (J) keeps every step'
    }, () => {
      const sc = STORY.scene(c.scene);
      if (sc) play(c.scene, () => { if (giver) S.disp[giver.id] = clamp((S.disp[giver.id] || 0) + .05, -1, 1); hud(); save(); }, true);
      else save();
    });
    return true;
  }
  function chapterStep() {
    const id = S.quests.chId;
    const c = STORY.chapter(id);
    if (!c) return false;
    const st = S.quests.step[id] || 0, step = c.steps[st];
    if (!step) return false;
    if (!stepHere(step)) return false;
    if (document.querySelector('#modal.show')) return false;      // a trial is already open: one at a time
    const last = st >= c.steps.length - 1;
    /* A step that says there is a battle in it actually fights one, wherever it falls in the chapter (Alesia, Pharsalus
       and Thapsus are middle steps, and used to be walked past). It is never harder than the act you are in can bear:
       an Act I command is not sent against the worst of Gaul. A save from before kept the chapter's id as the marker. */
    const key = id + ':' + st, foughtHere = S.quests.fought === key || (last && S.quests.fought === id);
    if (step.battle && !foughtHere) {
      const p0 = IMP.PROVS.find(x => x.id === step.battle) || (IMP.FIELDS || []).find(x => x.id === step.battle) || IMP.PROVS[0];
      const p = Object.assign({}, p0, { diff: Math.min(p0.diff, (c.act || 1) + 1), story: true });
      return battleIn(p, result => {
        if (result === 'win') { S.quests.fought = key; return chapterStep(); }
        lostField(c, id, p, key);
      });
    }
    const lost = foughtHere && S.story.flags['lost_' + id];
    if (foughtHere) S.quests.fought = null;
    /* a step that was not a battle is played: the trial decides how well it went, then the story moves on */
    if (!foughtHere && !step.battle && window.TRIALS) {
      const nx = c.steps[st + 1];
      window.TRIALS.run(trialApi(), { step, title: 'Chapter ' + c.n + ' · ' + step.act, next: nx ? placeName(nx.at) : null }, res => {
        const words = trialWords(res, step, () => chapterFlavour(c, st));
        advanceChapter(c, id, st, last, words);
      });
      return true;
    }
    const lines = lost ? [['narrator', 'The field was lost. ' + step.text + ' — not the way you meant to.'], ['narrator', 'The crier has it by the ninth hour, and for once he does not need to exaggerate.']]
      : [['narrator', step.act + ' — done.'], ['narrator', chapterFlavour(c, st)]];
    advanceChapter(c, id, st, last, lines.map(l => l[1]));
    return true;
  }
  /* what a played step is worth: well done is noticed by the part of Rome that cares, badly done costs a little */
  const trialApi = () => Object.assign(gc(), { $ });
  function trialWords(res, step, flavour) {
    const g = res.grade;
    if (g === 2) {
      const gain = { xp: 12, auctoritas: 2, rep: { [res.house]: 3 } };
      if (Math.random() < .3) gain.attrs = { [res.stat]: 1 };
      applyEff(gain); ImpAudio.sfx('good');
      toast('Done well', (gain.attrs ? '+1 ' + res.stat + ', ' : '') + '+12 experience, +3 with the ' + res.house, 'good');
    } else if (g === 0) { applyEff({ rep: { [res.house]: -2 } }); toast('Done badly', '−2 with the ' + res.house, 'bad'); }
    if (g < 0) return [step.act + ' — done.', flavour()];
    return [step.act + (g === 2 ? ' — done, and done well.' : g === 1 ? ' — done.' : ' — done, after a fashion.')].concat(window.TRIALS.after(res.kind, g));
  }
  function advanceChapter(c, id, st, last, words) {
    S.quests.step[id] = st + 1;
    say('narrator', words, {
      onEnd: () => {
        if (!last) { hud(); save(true); return; }
        const finish = () => {
          STORY.active(S, id);
          S.quests.active = S.quests.active.filter(x => x !== id);
          S.quests.done.push(id);
          const rw = S.story.flags['lost_' + id] ? halved(c.reward) : c.reward;
          applyEff(rw);
          const actNow = STORY.actOf(S), turn = actNow > (S.actShown || 1) ? actNow : 0;
          say('narrator', ['The chapter closes. ' + (rw.xp ? '+' + rw.xp + ' experience. ' : '') + (rw.denarii ? '+' + rw.denarii + ' denarii. ' : '') + (rw.auctoritas ? '+' + rw.auctoritas + ' auctoritas. ' : '')], { onEnd: () => { ImpAudio.sfx('good'); hud(); save(); const nxt = () => setTimeout(() => offerChapter(true), 400); if (turn) actTurn(turn, nxt); else nxt(); } });
        };
        if (undecided(c)) decide(c, finish); else finish();
      }
    });
    return true;
  }
  const halved = r => { const o = {}; for (const k in r) o[k] = typeof r[k] === 'number' ? Math.round(r[k] / 2) : (r[k] && typeof r[k] === 'object' ? halved(r[k]) : r[k]); return o; };
  /* A story battle you lose is not quietly counted as a win. March again (the step stays open, and the camp will
     sell you more men in the meantime), or come home and let the chapter close on the defeat, at half the reward. */
  function lostField(c, id, p, key) {
    say('narrator', ['The field is not yours, and the chapter is still open.'], { choose: { q: 'What now?', who: 'narrator', opts: [
      { t: 'Rest the men, fill the line, and march again.', say: 'The survivors are fed and the gaps are filled with recruits. Train in the camp, bring more men if your standing allows it, and take the step again when you are ready.' },
      { t: 'Come home and carry the defeat.', say: 'You march back into a city that already knows. The clerks write down what happened, not what you meant.', eff: { auctoritas: -4, rep: { army: -4 } },
        act: () => { S.story.flags['lost_' + id] = 1; S.quests.fought = key; setTimeout(() => chapterStep(), 60); } }
    ] } });
  }
  const chapterFlavour = (c, st) => [
    'The crier in the Forum repeats it by the ninth hour. Somebody has already decided what it means for your career, and it is not you.',
    'Two clerks write it down, which is the difference between an event and a fact in this city.',
    'By evening it has reached the wharves, where things are believed much faster and forgotten much slower.'
  ][st % 3] + ' ' + (c.steps[st].text || '');
  const currentLocId = () => { const b = buildingHere(); return b && b.loc ? b.id : (inRoom() ? S.room : IMP.locAt(you.x, you.y)); };

  function sideQuest(id) {
    const q = IMP.QUESTS.find(x => x.id === id); if (!q) return;
    if (STORY.done(S, id)) return toast('Already settled', q.n, 'bad');
    S.quests.active.push(id); S.quests.step[id] = 0;
    say(charById(q.giver) ? q.giver : 'narrator', ['A small thing, then: ' + q.d, 'It will take ' + q.steps.length + ' stops and it will pay ' + (q.reward.denarii || 0) + ' denarii and a name worth having.'], { onEnd: () => { S.quests.qId = id; hud(); save(); } });
  }
  function sideStep() {
    const id = S.quests.qId, q = IMP.QUESTS.find(x => x.id === id);
    if (!q) return false;
    const st = S.quests.step[id] || 0, step = q.steps[st];
    if (!step) return false;
    if (!stepHere(step)) return false;
    if (document.querySelector('#modal.show')) return false;
    const last = st >= q.steps.length - 1;
    /* a job's steps are played too, the same way a chapter's are */
    const go = res => {
      S.quests.step[id] = st + 1;
      const words = res ? trialWords(res, step, () => step.text) : null;
      if (last) {
        S.quests.active = S.quests.active.filter(x => x !== id); S.quests.done.push(id);
        applyEff(q.reward); ImpAudio.sfx('coin');
        if (q.ai && window.CIT) CIT.questDone(S, q);                        // the citizen who asked remembers, and so does the street
        say('narrator', (words || []).concat(['That is the last of it. ' + q.n + ' is finished. ' + (q.reward.denarii ? '+' + q.reward.denarii + ' denarii. ' : '') + (q.reward.auctoritas ? '+' + q.reward.auctoritas + ' auctoritas.' : '')]), { onEnd: () => { hud(); save(); } });
      } else if (words) say('narrator', words, { onEnd: () => { hud(); save(true); } });
      else { toast(step.act, step.text, 'scroll'); hud(); save(true); }
    };
    if (window.TRIALS) { const nx = q.steps[st + 1]; window.TRIALS.run(trialApi(), { step, title: q.n + ' · ' + step.act, next: nx ? placeName(nx.at) : null }, go); }
    else go(null);
    return true;
  }

  /* ---------- the Senate floor: a debate you can actually lose ---------- */
  function debate() {
    const topics = [
      { n: 'The grain dole', house: 'senate', crowd: 'people', d: 'The aediles want the dole raised. The treasury cannot pay for it twice.' },
      { n: 'The command in the east', house: 'army', crowd: 'senate', d: 'Two legions need a commander, and three men want the post.' },
      { n: 'The courts and bribery', house: 'senate', crowd: 'army', d: 'A law against electoral bribery, which half the house has committed twice.' },
      { n: 'Citizenship beyond the Po', house: 'people', crowd: 'army', d: 'The Latin towns north of the Po want the full vote. The army has been asking for it since Marius.' },
      { n: 'The public land', house: 'people', crowd: 'senate', d: 'Public land is being held by eleven families and farmed by nobody.' }
    ];
    const t = topics[Math.floor(Math.random() * topics.length)];
    const arg = S.tone === 'auto' ? bestArg(t) : IMP.ARGS.find(a => a.id === S.tone) || IMP.ARGS[0];
    const stat = S.attrs[arg.stat] || 1;
    const roll = Math.random() * 8;
    const power = stat * 1.4 + (S.auctoritas / 12) + roll + (arg.strong.includes(t.house) ? 2 : 0) - (arg.weak.includes(t.house) ? 2 : 0);
    let beat = power > 7 + S.xp / 400;
    const opener = ['The house is not quiet; three hundred men are all talking at the volume of a man who wants to be overheard.',
      'You have the floor until somebody with more ancestors coughs.',
      'The clerks have stopped writing, which in Rome is the loudest thing a clerk can do.'][Math.floor(Math.random() * 3)];
    /* the debate is now argued, not rolled: four arguments to win the house. Skipping it falls back on the old roll */
    say('narrator', [opener + ' The matter on the floor: ' + t.d], {
      onEnd: () => {
        if (!window.TRIALS) return verdict();
        window.TRIALS.run(trialApi(), { kind: 'persuade', step: { act: 'The floor: ' + t.n, text: t.d.replace(/\.$/, ''), at: 'curia' }, title: 'The Senate · ' + t.n }, res => {
          if (res.grade >= 0) beat = res.grade >= 1;
          if (res.grade === 2) applyEff({ auctoritas: 2 });
          verdict();
        });
      }
    });
    function verdict() {
      const after = charById(beat ? (t.house === 'army' ? 'marius' : t.house === 'people' ? 'cicero' : 'cato') : (t.house === 'senate' ? 'vatinius' : 'cato'));
      {
        if (beat) {
          applyEff({ xp: 14 + Math.round(stat), auctoritas: 3, rep: { [t.house]: 4 } , attrs: { [arg.stat]: Math.random() < .3 ? 1 : 0 } });
          say(after ? after.id : 'narrator', [after ? after.n + ' grunts: \"That was better than most of what this house has heard this year. Do it again and I will start to worry.\"' : 'The house shifts. You have won a little.', 'The clerks write the argument down, which is how an opinion turns into precedent, and how a career turns into a reputation.'], { onEnd: () => { ImpAudio.sfx('good'); hud(); save(true); } });
        } else {
          applyEff({ xp: 6, rep: { [t.house]: -3 } });
          say(after ? after.id : 'narrator', [after ? after.n + ' smiles with enormous sympathy: \"A good attempt. You argued the part of it that pleases you and not the part that persuades them.\"' : 'The house turns back to its own conversations.', 'Losing a debate costs you nothing except exactly the thing you came here to buy.'], { onEnd: () => { ImpAudio.sfx('bad'); hud(); save(true); } });
        }
      }
    }
  }
  const bestArg = t => {
    const pool = IMP.ARGS.slice().sort((a, b) => ((S.attrs[b.stat] || 0) + (b.strong.includes(t.house) ? 2 : 0)) - ((S.attrs[a.stat] || 0) + (a.strong.includes(t.house) ? 2 : 0)));
    return pool[0];
  };

  /* ---------- laws, provinces, the games ---------- */
  function passLaw() {
    const l = IMP.LAWS[Math.floor(Math.random() * IMP.LAWS.length)];
    if (S.denarii < (l.cost || 0)) return toast('Not enough coin', l.n + ' needs ' + l.cost + ' denarii to buy the votes it needs', 'bad');
    applyEff({ denarii: -(l.cost || 0), auctoritas: l.auctoritas, rep: l.rep, xp: 18 });
    S.laws.push(l.id);
    say('narrator', ['You carry ' + l.n + '. ' + l.d, 'It passes by eleven votes, of which four were bought and two were frightened. The fasti will record none of that, only that it passed.'], { onEnd: () => { ImpAudio.sfx('good'); hud(); save(); } });
  }
  function province() {
    const list = IMP.PROVS.filter(p => !S.province || p.id !== S.province);
    battleIn(list[Math.floor(Math.random() * list.length)]);
  }
  /* how many units you may take to the field, and what you are allowed to field at all:
     the guard and the elephants are not given to a man nobody has heard of yet */
  /* a bigger command: your own gift for war, and how much of the city has heard of you */
  const armySlots = () => clamp(3 + Math.floor((S.attrs.martial || 0) / 4) + Math.floor((S.auctoritas || 0) / 40), 3, 7) + ((S.wider && S.wider.vets) || 0);   // + the veterans sworn to you at the winter camp
  /* a horde fields half again as many men per unit as anybody else, so its provinces were far harder than their stars
     said: this brings Germania and the long-haired Gaul back into line with the rest (tuned by simulation) */
  const HORDE = .8;
  const ARMY = [
    { t: 'legion', need: 0 }, { t: 'aux', need: 0 }, { t: 'horse', need: 12 }, { t: 'guard', need: 26 }, { t: 'elephant', need: 46 }
  ];
  function battleIn(p, after) {
    if (!p) return;
    /* a hard province is not the same fight with better men in it — it is a bigger enemy army */
    const foe = [];
    const n = p.diff >= 5 ? 5 : p.diff >= 3 ? 4 : 3;
    for (let i = 0; i < n; i++) foe.push(i && !p.pure && Math.random() < .35 ? 'warband' : p.foe);
    const terrain = ['plain', 'hills', 'woods', 'river'][Math.floor(Math.random() * 4)];
    const slots = armySlots();
    const have = n => (S.auctoritas || 0) >= n;
    /* the army you start with: a line of legions, archers behind them, horse on the wing — and then you change it */
    const mine = [];
    /* the people walking with you come first, and they are worth the slot: a blade companion is a real unit */
    const company = window.COMP ? COMP.army(S) : [];
    company.forEach(u => { if (mine.length < slots) mine.push(u); });
    ['legion', 'legion', 'aux', 'horse', 'guard', 'elephant'].forEach(t => {
      const a = ARMY.find(x => x.t === t);
      if (a && have(a.need) && mine.length < slots) mine.push(t);
    });
    while (mine.length < slots) mine.push('legion');            // the line fills out with legions, which every man of rank has
    const men = arr => arr.reduce((a, t) => a + Math.round((IMP.UNITS[typeof t === 'string' ? t : t.type] || {}).men || 0), 0);
    const paint = () => {
      const enemyMen = Math.round(men(foe) * (1 + p.diff / 9) * (p.foe === 'horde' ? HORDE : 1));
      const body = $('modal'), cnt = t => mine.filter(x => (typeof x === 'string' ? x : x.type) === t).length;
      const h = ['<p>' + p.g + ' ' + esc(p.blurb) + '</p>' +
        '<div class="two small" style="margin:8px 0"><div>Enemy strength <b>' + p.str + '</b></div><div>Expected loot <b>' + p.loot + ' denarii</b></div><div>Ground <b>' + terrain + '</b></div><div>Difficulty <b>' + '★'.repeat(p.diff) + '</b></div></div>',
        '<h4>Your army — ' + mine.length + ' of ' + slots + ' units, ' + men(mine).toLocaleString() + ' men</h4>', '<div class="army">'];
      ARMY.forEach(u => {
        const d = IMP.UNITS[u.t], n = cnt(u.t), lock = !have(u.need), full = mine.length >= slots;
        h.push('<div class="ucard' + (n ? ' on' : '') + (lock ? ' lock' : '') + '" data-u="' + u.t + '"><div class="ui">' + troopIcon(u.t) + '</div><b>' + esc(d.n) + '</b>' +
          '<span>' + d.men + ' men · atk ' + d.atk + ' · def ' + d.def + ' · morale ' + d.morale + '</span>' +
          '<i>' + (lock ? 'needs ' + u.need + ' auctoritas' : n ? 'in the line' : 'hold in reserve') + '</i>' +
          (lock ? '' : '<div class="uc"><button class="ub" data-d="-1"' + (n ? '' : ' disabled') + '>−</button><span class="un">' + n + '</span><button class="ub" data-d="1"' + (full ? ' disabled' : '') + '>+</button></div>') +
          '</div>');
      });
      h.push('</div><p class="mute">The enemy brings ' + foe.length + ' units — about ' + enemyMen.toLocaleString() + ' men, and ' + esc(IMP.UNITS[p.foe].n.toLowerCase()) + ' are the worst of it. ' +
        (p.diff >= 3 ? 'This will be a hard field; take more men than you think you need.' : p.diff >= 2 ? 'A serious fight.' : 'The omens are not bad.') + '</p>',
        '<div class="row" style="justify-content:flex-end"><button class="btn" id="pback">Not this year</button><button class="btn pri" id="pgo"' + (mine.length ? '' : ' disabled') + '>March</button></div>');
      body.innerHTML = '<div class="mbox wide"><div class="mhead"><b>⚔ ' + esc(p.n) + '</b><button class="ib" id="mx">✕</button></div><div class="mbody">' + h.join('') + '</div></div>';
      body.classList.add('show');
      $('mx').onclick = closeModal;
      $('pback').onclick = closeModal;
      const add = t => {
        const u = ARMY.find(a => a.t === t);
        if (!u || !have(u.need)) return toast('Not yours to command', 'that unit answers to men with more auctoritas than you', 'bad');
        if (mine.length >= slots) return toast('The line is full', 'you can command ' + slots + ' units with your standing. Train, and you will command more.', 'bad');
        mine.push(t); paint();
      };
      body.querySelectorAll('.ucard').forEach(c => c.onclick = ev => {
        const t = c.dataset.u, b = ev.target.closest('.ub');
        if (b) {
          if (b.disabled) return;
          if (+b.dataset.d < 0) { const at = mine.lastIndexOf(t); if (at >= 0) mine.splice(at, 1); } else mine.push(t);
          paint(); return;
        }
        if (mine.includes(t)) { const at = mine.lastIndexOf(t); mine.splice(at, 1); paint(); }
        else add(t);
      });
      $('pgo').onclick = () => march(p, mine, foe, terrain, after);
    };
    paint();
  }
  function march(p, mine, foe, terrain, after) {
    if (!mine.length) return;
    {
      closeModal();
      const host = $('battle');
      host.innerHTML = '';
      host.classList.add('show'); musicFor(here().id);              // the war drums start with the battle (the loop is paused)
      const cfg = { title: 'The war in ' + p.n, sub: 'You command ' + mine.length + ' units against ' + foe.length + '.', mine, foe, mods: { quality: 1 + (S.attrs.martial || 0) / 30, morale: (S.rep.army || 0) / 6, atk: 1 + (S.attrs.martial || 0) / 40 }, foeMods: { quality: (1 + p.diff / 9) * (p.foe === 'horde' ? HORDE : 1), morale: p.diff * 3 }, terrain };
      paused = true;
      /* the field: you stand in it and command in real time; the old board is still there for anyone who asks for it */
      const real = window.FIELD && FIELD.supported(mine) && FIELD.supported(foe) && !S.classicBattles;
      if (real) { host.classList.add('field'); cfg.look = you && you.look; }       // your own figure, walking the field
      (real ? FIELD : BattleSim).start(cfg, host, res => {
        host.classList.remove('show', 'field'); host.innerHTML = ''; paused = false;
        S.battles[res.result === 'win' ? 'w' : 'l']++;
        if (window.CIT) CIT.note(S, 'They say ' + S.name + (res.result === 'win' ? ' won a battle in ' : ' lost a battle in ') + p.n.split(',')[0] + ', and ' + res.lost + ' men died');
        const then = () => { hud(); save(); if (after) after(res.result); };
        if (res.result === 'win') {
          if (IMP.PROVS.some(x => x.id === p.id)) S.province = p.id;      // a field in Italy is won, not owned
          applyEff({ denarii: p.loot, xp: 40 + p.diff * 10, auctoritas: 6 + p.diff * 2, rep: { army: 8 }, attrs: Math.random() < .4 ? { martial: 1 } : {} });
          say('narrator', ['The field is yours after ' + (res.seconds ? (res.seconds < 90 ? 'a short, hard fight' : 'a long afternoon') : res.rounds + ' rounds') + '. ' + res.lost + ' of yours are dead and ' + res.killed + ' of theirs.',
            IMP.PROVS.some(x => x.id === p.id) ? p.n + ' is yours for as long as you can hold it, which is a different question and a later one.' : 'Nobody will build a monument to a victory over Romans, and nobody should.',
            'The loot is counted in the quaestor\u2019s tent by two men who will each tell a different story of it.'], { onEnd: then });
        } else {
          applyEff({ xp: 12, rep: { army: -6, senate: -2 } });
          say('narrator', ['Your line broke in the fourth hour. ' + res.lost + ' men are not coming back, and the eagles went with them.', 'The old soldiers in the camp will not say it out loud, but they will look at you differently for a long time.'], { onEnd: then });
        }
        ImpAudio.sfx(res.result === 'win' ? 'good' : 'bad');
      });
    }
  }
  /* ---------- the wooden amphitheatre ----------
     Three afternoons on one floor of sand: a bout between schools, whatever came off the beast ship, and the
     year the basin is flooded and Rome watches itself sink itself. Same simulator as the wars, different roster. */
  function arena() {
    S.arena = S.arena || { w: 0, l: 0, seen: {} };
    let sel = null, mine = [];
    const slots = () => clamp(3 + Math.floor((S.attrs.martial || 0) / 4) + Math.floor((S.auctoritas || 0) / 60), 3, 6);
    const paint = () => {
      const body = $('modal'), h = [];
      if (!sel) {
        h.push('<p class="mute" style="margin:0 0 10px">Forty thousand people, one editor — you — and a floor of sand that gets raked between acts.</p>', '<div class="army">');
        IMP.ARENA.forEach(b => {
          const times = S.arena.seen[b.id] || 0;
          h.push('<div class="ucard" data-b="' + b.id + '"><div class="ui">' + b.g + '</div><b>' + esc(b.n) + '</b>' +
            '<span>' + esc(b.sub) + '</span>' +
            '<i>purse ' + b.purse + ' ⚖ · ' + '★'.repeat(b.diff) + (times ? ' · ' + times + ' already' : ' · never fought') + '</i></div>');
        });
        h.push('</div>', '<div class="two small"><div>Record <b>' + (S.arena.w || 0) + ' won · ' + (S.arena.l || 0) + ' lost</b></div>' +
          '<div>Standing with the crowd <b>' + Math.round(S.rep.people || 0) + '</b></div></div>',
          '<div class="row" style="justify-content:flex-end"><button class="btn" id="aback">Leave the sand</button></div>');
        body.innerHTML = '<div class="mbox wide"><div class="mhead"><b>🏟️ The Wooden Amphitheatre</b><button class="ib" id="mx">✕</button></div><div class="mbody">' + h.join('') + '</div></div>';
        body.classList.add('show'); $('mx').onclick = closeModal; $('aback').onclick = closeModal;
        body.querySelectorAll('[data-b]').forEach(c => c.onclick = () => {
          sel = IMP.ARENA.find(b => b.id === c.dataset.b);
          mine = sel.mine.slice(0, slots());
          paint();
        });
        return;
      }
      const pool = IMP.ARENA_UNITS_BY_KIND(sel.kind), full = mine.length >= slots();
      h.push('<p>' + esc(sel.blurb) + '</p>',
        '<div class="two small" style="margin:8px 0"><div>Ground <b>' + (sel.terrain === 'water' ? 'flooded basin' : 'sand') + '</b></div>' +
        '<div>Opposition <b>' + '★'.repeat(sel.diff) + '</b></div><div>Purse <b>' + sel.purse + ' denarii</b></div>' +
        '<div>Your party <b>' + mine.length + ' of ' + slots() + '</b></div></div>',
        '<h4>Your fighters</h4><div class="army">');
      pool.forEach(t => {
        const d = IMP.UNITS[t], n = mine.filter(x => x === t).length;
        h.push('<div class="ucard' + (n ? ' on' : '') + '" data-u="' + t + '"><div class="ui">' + troopIcon(t) + '</div><b>' + esc(d.n) + '</b>' +
          '<span>' + d.men + ' ' + (d.word || 'men') + ' · atk ' + d.atk + ' · def ' + d.def + ' · spd ' + d.spd + '</span>' +
          '<i>' + esc(d.desc || '') + '</i>' +
          '<div class="uc"><button class="ub" data-d="-1"' + (n ? '' : ' disabled') + '>−</button><span class="un">' + n + '</span>' +
          '<button class="ub" data-d="1"' + (full ? ' disabled' : '') + '>+</button></div></div>');
      });
      h.push('</div><h4>What they are sending</h4><div class="jdone">' +
        sel.foe.map(t => '<span>' + IMP.UNITS[t].ic + ' ' + esc(IMP.UNITS[t].n) + '</span>').join('') + '</div>',
        '<div class="row" style="margin-top:14px;justify-content:flex-end"><button class="btn" id="aback">◂ back</button>' +
        '<button class="btn pri" id="ago"' + (mine.length ? '' : ' disabled') + '>Let them in</button></div>');
      body.innerHTML = '<div class="mbox wide"><div class="mhead"><b>' + sel.g + ' ' + esc(sel.title) + '</b><button class="ib" id="mx">✕</button></div><div class="mbody">' + h.join('') + '</div></div>';
      body.classList.add('show'); $('mx').onclick = closeModal;
      $('aback').onclick = () => { sel = null; paint(); };
      $('ago').onclick = () => arenaFight(sel, mine.slice());
      body.querySelectorAll('.ucard').forEach(c => c.onclick = ev => {
        const t = c.dataset.u, b = ev.target.closest('.ub');
        if (b) {
          if (b.disabled) return;
          if (+b.dataset.d < 0) { const at = mine.lastIndexOf(t); if (at >= 0) mine.splice(at, 1); }
          else if (mine.length < slots()) mine.push(t); else return toast('Your party is full', slots() + ' is what the gate will let you bring', 'bad');
          paint(); return;
        }
        if (mine.includes(t)) { const at = mine.lastIndexOf(t); if (at >= 0) mine.splice(at, 1); }
        else if (mine.length < slots()) mine.push(t);
        else return toast('Your party is full', slots() + ' is what the gate will let you bring', 'bad');
        paint();
      });
    };
    paint();
  }
  function arenaFight(b, mine) {
    if (!b || !mine.length) return;
    closeModal();
    const host = $('battle');
    host.innerHTML = ''; host.classList.add('show'); musicFor(here().id);
    paused = true;
    const isSea = b.kind === 'naumachia';
    BattleSim.start({
      title: b.g + ' ' + b.title, sub: b.sub,
      mine, foe: b.foe,
      mods: { quality: 1 + (S.attrs.martial || 0) / 40 + (S.auctoritas || 0) / 200, morale: (S.rep.people || 0) / 12, atk: 1 + .04 + (S.attrs.martial || 0) / 60 },
      foeMods: { quality: 1 + b.diff / (b.q || 10), morale: b.diff * 4 },
      terrain: b.terrain,
      lossWord: isSea ? 'souls afloat' : 'fighters',
      winHead: '🏆 ' + (isSea ? 'The basin is yours' : 'The sand is yours'),
      loseHead: '💀 Missio',
      winWord: isSea ? 'Two hulls are towed to the slip and the rest are fish.' : 'The editor gives the thumb to your men, and the crowd will remember whose games these were.',
      loseWord: isSea ? 'Your boats are beached and the crowd goes quiet for exactly as long as it takes to forget you.' : 'Your men are carried out through the sand-gate while the crowd counts somebody else\u2019s money.'
    }, host, res => {
      host.classList.remove('show'); host.innerHTML = ''; paused = false;
      S.arena = S.arena || { w: 0, l: 0, seen: {} };
      S.arena.seen[b.id] = (S.arena.seen[b.id] || 0) + 1;
      if (res.result === 'win') {
        S.arena.w++;
        applyEff({ denarii: b.purse, auctoritas: 5 + b.diff * 2, xp: 20 + b.diff * 8, rep: { people: 6 + b.diff * 2 } });
        say('narrator', [b.g + ' ' + b.title + ', and it is your name they chant on the way out — ' + res.rounds + ' rounds, and ' + res.killed + ' of theirs are not walking off the sand.',
          'The purse is counted at the podium in front of four thousand witnesses, which is the only accounting Rome trusts.',
          'By evening the crier in the Forum has it: the games of the hour were the games you paid for.'], { onEnd: () => { ImpAudio.sfx('crowd'); hud(); save(); } });
      } else {
        S.arena.l++;
        applyEff({ xp: 8, rep: { people: -5 } });
        say('narrator', ['The sand is raked, the gate is opened, and what is carried out is carried out quickly so the next act can start.',
          'It cost you the purse and a season of being laughed at in the Subura.', 'You buy the next one. That is what editors do.'], { onEnd: () => { ImpAudio.sfx('bad'); hud(); save(); } });
      }
    });
  }
  function games() {
    const cost = 400 + Math.round(Math.random() * 900);
    if (S.denarii < cost) return toast('You cannot afford games', 'the cheapest games in the Circus cost ' + cost + ' denarii', 'bad');
    applyEff({ denarii: -cost, rep: { people: 12 + Math.round(Math.random() * 10), senate: -2 }, auctoritas: 5, xp: 22 });
    say('narrator', ['Four days of races, three pairs of gladiators from the Ludus, and a rain of coins over the first three rows.', 'The crowd chants your name twice — once when you stand, and once, later, when somebody reminds them to.'], { onEnd: () => { ImpAudio.sfx('crowd'); hud(); save(); } });
  }
  function homeBuild() {
    const owned = S.rooms.owned;
    const opts = IMP.ROOMS.filter(r => !owned.includes(r.id));
    if (!opts.length) return toast('The house is finished', 'every room in the domus has been built', 'good');
    const r = opts[0];
    if (S.denarii < r.cost) return toast('Not yet', r.n + ' costs ' + r.cost + ' denarii. ' + r.eff, 'bad');
    applyEff({ denarii: -r.cost, auctoritas: 4, xp: 10 });
    S.rooms.owned.push(r.id);
    say('narrator', ['You build the ' + r.n + ' at the back of the domus. ' + r.eff, 'The workmen are Greek, the marble comes from Luna, and the noise goes on for six weeks.'], { onEnd: () => { hud(); save(); } });
  }
  function rest() {
    const before = S.time;
    S.time = (Math.floor(S.time / 24) * 24) + 6.4;
    if (S.time <= before) S.time += 0;
    S.day += S.time < before ? 1 : 0;
    S.attrs.health = clamp((S.attrs.health || 5) + 1, 2, 9);
    S.auctoritas += 1;
    onNewDay();
    buildPeople();
    say('narrator', ['You sleep in the tablinum with the shutters open, and wake before the fourth hour with the whole household already moving.', 'The city has not waited for you. The price of grain has moved, two men have died, and somebody has written your name on a wall for a reason nobody remembers.'], { onEnd: () => { hud(); save(); } });
  }
  /* The morning after every night: the only place where a law you passed in the spring turns up in the autumn. The
     treasury fills or empties, the street gets angrier or quieter, bread moves, and Crassus's man leaves a note. */
  function onNewDay() {
    if (S && window.WIDER) { try { WIDER.day(S, wapi()); } catch (e) { console.warn('wider day', e); } }
    if (!S || !window.SENATE) return;
    let msgs = [];
    try { msgs = window.SENATE.day(S) || []; } catch (e) { console.warn('senate day', e); }
    msgs.forEach((m, i) => setTimeout(() => toast('Rome', m, 'scroll'), 500 + i * 1800));
    if (msgs.length) hud();
    save(true);
  }
  /* the conversation panel's view of the game: the year in words, faces, and a way to take on the job they offer */
  const capi = () => Object.assign(gc(), {
    $, portrait: look => PIX.portrait(look, 64).toDataURL(),
    yearText: () => (S.mode === 'caesar' ? Math.abs(yearNow()) + ' BC' : '691 years from the founding of the city (63 BC)') + ', ' + IMP.seasons[S.season % 4].toLowerCase() + ', ' + (S.time < 6 || S.time > 20 ? 'night' : S.time < 11 ? 'morning' : S.time < 17 ? 'afternoon' : 'evening') + (S.weather === 'rain' ? ', raining' : ''),
    startQuest: q => { S.aiQuests = S.aiQuests || []; S.aiQuests.push(q); if (!IMP.QUESTS.some(x => x.id === q.id)) IMP.QUESTS.push(q); closeModal(); sideQuest(q.id); }
  });
  function talkTo(p) {
    if (!p) return;
    /* every Roman with a name talks in their own words through the local AI; Crassus and Cicero too, with the old
       scripted talk (hiring them, gifts) one button away */
    if (window.CIT && p.cit) return CIT.chat(S, capi(), { cit: p.cit, look: p.look });
    if (window.CIT && p.char) return CIT.chat(S, capi(), { char: p.char, look: lookOf(p.char), more: () => scriptedTalk(p) });
    return scriptedTalk(p);
  }
  function scriptedTalk(p) {
    if (!p) return;
    if (!p.char) {                                   // a stranger: they have one line and no memory
      if (p.lines) return say(p.name, [p.lines[Math.floor(Math.random() * p.lines.length)]], {});
      const lines = [
        'You are the one they are talking about. My brother says you are lucky.', 'Bread is up two as. Everything else is up four.',
        'Mind the loose stone by the Basilica, I have seen three men go down on it.', 'They are pulling the tiles off the temple roof again at night. Selling them in the Subura.',
        'If you want a letter carried to Ostia, my cousin does it for two denarii and a cup.',
        'The aediles promised games. The aediles always promise games.'
      ];
      return say(p.name, [lines[Math.floor(Math.random() * lines.length)]], {});
    }
    const c = p.char;
    const disp = S.disp[c.id] || c.disp || 0;
    const mood = disp > .35 ? 'warm' : disp > 0 ? 'civil' : disp > -.3 ? 'guarded' : 'cold';
    const first = S.story.seen['met' + c.id] ? null : (c.first || null);
    if (first) S.story.seen['met' + c.id] = 1;
    const follow = impLines(c, mood);
    say(c.id, first ? [first].concat(follow) : follow, {
      choose: compChoice(c),
      onEnd: () => {
        const before = S.disp[c.id] || 0;
        S.disp[c.id] = clamp(before + .03, -1, 1);
        if (before <= 0 && S.disp[c.id] > 0) toast(c.n + ' warms to you', 'by exactly one small degree', 'good');
        hud(); save(true);
      }
    });
  }
  /* Talking to somebody can become three things: hiring them, sending them home, or handing over the gift you
     bought. Everything else stays the conversation it already was. */
  const compChoice = c => {
    if (!window.COMP || !c || !S) return null;
    const opts = [];
    const r = COMP.recruitOf(c.id);
    const joined = !!COMP.member(S, c.id);
    if (joined) {
      opts.push({
        t: 'Say farewell for now',
        say: 'For now, then. I will be in the Forum when you are ready — try not to get yourself killed first.',
        act: () => { COMP.dismiss(S, c.id); toast(c.n + ' goes home', 'the company has room for three again', 'door'); buildPeople(); hud(); save(true); }
      });
      opts.push({ t: 'Nothing. Carry on together.', say: 'Good. I was hoping you would say that.' });
      return { who: c.id, q: 'The company', opts };
    }
    if (r && COMP.eligible(S, c.id)) {
      opts.push({
        t: 'Ask ' + c.n + ' to walk with you',
        say: r.pitch + ' ' + r.line,
        act: () => {
          const res = COMP.recruit(S, c.id);
          if (res.ok) { toast(c.n + ' joins you', 'the company now walks with you — look behind you in the street', 'good'); ImpAudio.sfx('good'); buildPeople(); }
          else if (res.why === 'not willing') toast(c.n + ' says not yet', 'they think of you as ' + Math.round(((S.disp[c.id] || 0) + 1) / 2 * 100) + '% — 70% is what it takes. Gifts and jobs move it.', 'bad');
          else toast('No room in the company', 'three is the number, and somebody is already walking with you', 'bad');
          hud(); save(true);
        }
      });
    }
    if (S.inv && S.inv.gift) {
      opts.push({
        t: 'Give a gift from the bag (' + S.inv.gift + ')',
        say: 'You take it out of the folds where you have been carrying it since the market. ' + c.n + ' looks at it for a moment before taking it, which is the whole point of gifts.',
        act: () => {
          const before = S.disp[c.id] || 0;
          const res = COMP.gift(S, c.id);
          if (!res.ok) return toast('Nothing to give', 'buy a gift at the Macellum first', 'bad');
          toast(c.n + ' is pleased', 'they think of you as ' + Math.round(((S.disp[c.id] || 0) + 1) / 2 * 100) + '%' + (before <= .4 && S.disp[c.id] > .4 ? ' — enough to ask them to walk with you' : ''), 'good');
          ImpAudio.sfx('coin'); hud(); save(true);
        }
      });
    }
    if (!opts.length) return null;
    opts.push({ t: 'Only a word.', say: 'Then say it quickly; the day is not going to say itself.' });
    return { who: c.id, q: 'What will you do?', opts };
  };
  const impLines = (c, mood) => {
    const L2 = {
      crassus: { warm: ['Sit. There is something in the eastern accounts that would interest you, and I never sell information to friends.', 'You have cost me money twice and made me more than that four times. I keep the ledger in my head.'], cold: ['You are still here. Most new men are gone by the second autumn.', 'Do not confuse my politeness for an agreement.'], civil: ['Wine? No. Then listen: the grain contracts renew in the spring and everyone in this city is about to become your friend.'] },
      cato: { warm: ['You did the correct thing. I have said that about six men in my life and three of them are dead.', 'Come and walk. I do not sleep and so I walk, and I find I think better when somebody else is arguing.'], cold: ['I have read your decree twice. It is clever and it is not honest, and the difference will cost the city eventually.', 'Do not ask me to be pleased about any of this.'], civil: ['The house sits in an hour. If you have evidence, bring it; if you have a speech, leave it at home.'] },
      cicero: { warm: ['Aha! My favourite man of no ancestors. Listen to this sentence — I have been building it since dawn.', 'You owe me a dinner and I intend to collect it at length.'], cold: ['You are being advised by people who do not like you. I would know; I advise people like that myself.', 'Speak plainly — I have three hundred letters waiting and all of them are more flattering than you.'], civil: ['You have the floor after the quaestor, and the quaestor is long. Say the short version first.'] },
      marius: { warm: ['You have the hands of a man who has held a sword, after all. Sit down; the wine is terrible and the company is worse.', 'I have watched you in the field. You do not know when to stop, and that is the only useful fault a commander can have.'], cold: ['You sound like a man who has read about war. I have read about farming; it does not make me a farmer.', 'Come to the camp at dawn and hold a shield for an hour. Then we will talk about provinces.'], civil: ['The recruits are drilling badly and the pay is late. Both of those are your problem now, whether you like it or not.'] },
      catilina: { warm: ['My friend. Sit where the lamp does not reach your face; it is a habit worth having.', 'There is a house in the Subura with a room in it that has never been written about. It is my favourite room in Rome.'], cold: ['Still standing on the moral side of the street. It floods there, you know.', 'You will come to me eventually. Everybody does; I am simply early.'], civil: ['Do not look at the door. The door is the least interesting thing in this room.'] },
      aurelia: { warm: ['The flame is steady today, and it has been steady all week, which means the city is either very well or very quiet.', 'You are one of perhaps nine people in this city who tells me the truth the first time.'], cold: ['You have been in the Subura again. I am not the gods, but I am better informed than they are.', 'Do not swear anything in front of me that you would not swear in front of the fire.'], civil: ['Ask your question. I have six hours of rites and no patience for a preamble.'] },
      pullo: { warm: ['Chief! Sit down, the wine here is honest and so am I, which is why I am still a primus pilus.', 'Ten men, whenever you need them. Say the word and stop looking at your hands.'], cold: ['You have gone quiet and political on me. I liked you better when you were worried about the law.', 'Nobody is going to remember the hearings, chief. They remember the men who stood.'], civil: ['The watch buried something last week. I can find out what, if it matters to you.'] },
      berenice: { warm: ['There you are. I have a cargo of Egyptian glass and a problem that needs a senator\u2019s name on it.', 'Rome is loud, but you are the only Roman I can hear over it.'], cold: ['You are all the same to me, you understand. Romans are a very large customer and a very poor listener.', 'Do not tax my patience; it has a rate, and you have exceeded it.'], civil: ['Two hundred jars of wine, eight horses, and a letter from a king who would like to know what you intend.'] },
      vatinius: { warm: ['My dear colleague! I have decided to be useful to you, for reasons which will become obvious in about a year.', 'Between us: Cato is going to destroy somebody this month and it will not be either of us.'], cold: ['How brave of you to be seen with me. I would not, in your place.', 'I hear about your speeches. I hear about them from people who were paid to listen.'], civil: ['Do not worry. I have already told everyone that you are lucky, which means they will be watching for the fall.'] },
      aulus: { warm: ['The accounts are on the table, dominus, and for once they are not frightening. I have allowed myself a small pleasure about it.', 'I have taken the liberty of writing to the province. I hope that was right; I have not been wrong about a letter in eleven years.'], cold: ['I would rather you read the ledger before you sign it. I have watched two houses end over a line somebody did not read.', 'I am your freedman and I will say it anyway: you are spending to be seen spending.'], civil: ['Three men asked after your health. I have written down which of them meant it, and it is one.'] },
      cornelia: { warm: ['Sit. There is bread, and there is an account of everything this family has done since your grandfather, and you are in it now.', 'You are doing better than your father and I will not tell you that twice.'], cold: ['The household heard you have been in the Subura again. The gods are not the only ones who see everything.', 'The family name can be spent, and it is not infinite, and I have buried enough of it.'], civil: ['Two cousins, one week, the same table. I have written the names down. Read it tonight.'] },
      sestius: { warm: ['You want to see a real fight? Third hour. Do not bet, and do not call my men by their names — it upsets the other buyers.'], cold: ['Coin is coin. Do not stand in the sand and do not explain to me about dignity.'], civil: ['Eleven fights, that murmillo. If you buy his contract I will want twice what I paid.'] },
      lucia: { warm: ['Twelve boats this week and the price is soft. Buy now and I will carry it for you for nothing on the third.'], cold: ['I sell grain, not opinions. If you want opinions the Forum is full of men giving them away.'], civil: ['The price is eight to the modius and it will be ten by the Kalends. That is not a threat, it is arithmetic.'] },
      gaius: { warm: ['You have the look of a man who has been counted on. It is rare in this city.'], cold: ['I fought for twenty-five years and this city cannot afford my pension. Think about that before you speak about honour.'], civil: ['The Tenth would hold that line. The Tenth will not hold it for nothing.'] },
      marina: { warm: ['Here. The harbour book. Two senators are moving grain under another man\u2019s seal, and one of them owes you money.'], cold: ['You are not on my list, so you do not exist yet.'], civil: ['Twelve ships due, three late, and one that will never come.'] },
      fabius: { warm: ['I have the statute. It is from the year of Corvus, it has never been repealed, and it says exactly what you want it to say.'], cold: ['The archive closes at the ninth hour and I do not make exceptions for magistrates, however recently elected.'], civil: ['You want the law on grain contracts. There are four of them and three contradict each other.'] },
      cassia: { warm: ['The fire is safe and you are welcome to stand here as long as you like. Everybody needs one place where nothing is being negotiated.'], cold: ['I keep the Vestals\u2019 record of who came at night. Do not give me a reason to write your name down.'], civil: ['I cannot discuss the rites. I can tell you the city is frightened of something it will not name.'] }
    };
    const set = L2[c.id];
    if (!set) {
      const g = { warm: ['Well then. Sit, sit. Wine?', 'They say you are going to be consul. Well, they say it about everybody with a clean toga.'], cold: ['You have what you came for. Do not make it a habit.'], civil: ['Rome is Rome, dominus. Ask your question before somebody else does.'] };
      return g[mood] || g.civil;
    }
    return set[mood] || set.civil;
  };

  /* ============================ the action panel ============================ */
  /* ===================== what you are supposed to be doing =====================
     A step names a place — `at: 'curia'` — and the whole quest system hangs off "are you standing there".
     Before this, the only way to find out was to wander into the right building and press E: nothing on screen
     said where to go, and the minimap marker that was written for the job was never assigned. These three
     functions resolve the current step to a square on the map, and everything else (the HUD line, the marker,
     the edge arrow, the "take me there" button) reads off them. */
  const placeName = id => (IMP.LOCS[id] || {}).name || id;
  function stepHere(step) {
    if (!step || !step.at) return true;
    /* indoors you are only "at" the place whose room you are standing in — being in the tavern never counts as
       being at the Curia, however many interiors happen to exist for that id */
    if (inRoom()) return S.room === step.at || S.room === (IMP.LOCS[step.at] || {}).room;
    return IMP.atPlace(step.at, you.x, you.y);
  }
  /* every objective in hand, nearest first: the chapter is what Rome is watching, a job is what pays this week */
  function objective() {
    const out = [];
    focusChapter();
    const chId = S.quests.chId, ch = STORY.chapter(chId);
    if (ch && STORY.active(S, chId)) {
      const st = S.quests.step[chId] || 0, s = ch.steps[st];
      if (s) out.push({ k: 'ch', act: s.act, text: s.text, at: s.at, icon: ch.ic, label: 'Chapter ' + ch.n + ' · ' + ch.title, here: stepHere(s) });
    }
    focusJob();
    const qId = S.quests.qId, q = IMP.QUESTS.find(x => x.id === qId);
    if (q && STORY.active(S, qId)) {
      const st = S.quests.step[qId] || 0, s = q.steps[st];
      if (s) out.push({ k: 'q', act: s.act, text: s.text, at: s.at, icon: q.ic, label: q.n, here: stepHere(s) });
    }
    return out;
  }
  /* Keep the minimap marker parked on the current step. Resolved once per place, not once per frame: the
     spiral search for a standable tile is the sort of thing you do not want running sixty times a second. */
  function refreshTarget() {
    const o = objective()[0];
    if (!o || o.here || inRoom()) { S.questTarget = null; return; }
    if (S.questTarget && S.questTarget.at === o.at && S.questTarget.for === o.label) return;
    const g = IMP.goalOf(o.at);
    S.questTarget = g ? { x: g.x, y: g.y, at: o.at, for: o.label } : null;
  }
  const bearing = (from, to) => {
    if (!from || !to) return '';
    const dx = to.x - from.x, dy = to.y - from.y;
    if (!dx && !dy) return '';
    /* atan2(dy, dx) is zero pointing east and grows clockwise on screen, so the ring starts at → */
    const ring = ['→', '↘', '↓', '↙', '←', '↖', '↑', '↗'];
    return ring[((Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) % 8) + 8) % 8];
  };
  function goToPlace(at) {
    /* from inside anywhere, out first: and from a place outside Rome, the road home takes its time */
    if (inRoom()) { const W2 = window.WIDER; if (W2 && W2.isRegion(S.room) && !W2.isRegion(at)) advanceHours(W2.REGIONS[S.room].hours); if (!W2 || !W2.isRegion(at) || S.room !== at) leaveRoom(); }
    const g = IMP.goalOf(at); if (!g) return;
    closeModal();
    clickWalk(g.x, g.y);
    toast('On the way to ' + placeName(at), 'Follow the gold marker on the minimap — it sits on the door you want.', 'walk');
    ImpAudio.sfx('click');
  }

  const canDo = () => {
    const out = [];
    const loc = currentLocId(), b = buildingHere();
    focusChapter();
    const chId = S.quests.chId, ch = STORY.chapter(chId);
    if (ch && STORY.active(S, chId)) {
      const st = S.quests.step[chId] || 0, step = ch.steps[st];
      if (step) {
        if (stepHere(step)) out.push({ k: 'ch', t: '▸ ' + step.act, d: step.text, pri: 1 });
        else out.push({ k: 'goto', t: '🧭 Go to ' + placeName(step.at), d: 'Your next step is at ' + placeName(step.at) + ' — walk it, or let me take you there.', pri: 1, at: step.at });
      }
    }
    focusJob();
    const qId = S.quests.qId, q = IMP.QUESTS.find(x => x.id === qId);
    if (q && STORY.active(S, qId)) {
      const st = S.quests.step[qId] || 0, step = q.steps[st];
      if (step) {
        if (stepHere(step)) out.push({ k: 'q', t: '▸ ' + step.act, d: step.text });
        else out.push({ k: 'goto', t: '🧭 Go to ' + placeName(step.at), d: 'This job needs you at ' + placeName(step.at) + '.', at: step.at });
      }
    }
    if (!S.quests.chId || !STORY.chapter(S.quests.chId) || !STORY.active(S, S.quests.chId)) {
      const nx = STORY.next(S);
      if (nx && (!nx.where || nx.where === loc || true)) out.push({ k: 'start', t: 'Begin a chapter: ' + nx.title, d: 'Chapter ' + nx.n + ' is ready to be taken up.', pri: 1 });
    }
    const avail = IMP.QUESTS.filter(x => !x.ai && !STORY.active(S, x.id) && !STORY.done(S, x.id) && (!x.at || stepHere({ at: x.at })));   // a job a citizen wrote for you is only ever offered by them
    if (avail.length) out.push({ k: 'side', t: 'Take up a job: ' + avail[0].n, d: avail[0].d, q: avail[0].id });
    if (loc === 'curia' || inRoom() && S.room === 'curia') out.push({ k: 'debate', t: 'Take the floor and argue', d: 'Win or lose a debate in front of the house. Costs nothing but your reputation.' });
    if (loc === 'curia') out.push({ k: 'draft', t: '📜 Draft a law of your own', d: 'Write the bill yourself: the matter, the purse, the clauses, the name. Then take it onto the floor and count the seats.' });
    if (loc === 'curia') out.push({ k: 'state', t: '🏛️ The state of Rome', d: 'The treasury, the price of bread, the temper of the street, and every law of yours still standing.' });
    if (loc === 'macellum' || loc === 'argiletum') out.push({ k: 'market', t: '🏺 Walk the market', d: 'Bread, wine, a toga, a doctor, a gift for a man whose vote you need. Prices follow the city.' });
    if (loc === 'circus') out.push({ k: 'games', t: 'Put on games', d: 'Buy the crowd for a week. Cheap at the price and expensive at the treasury.' });
    if (loc === 'colosseum' || (b && b.id === 'colosseum')) out.push({ k: 'arena', t: '🏟️ Fight in the arena', d: 'Gladiators, beasts, or the flooded basin: three ways to buy the crowd for an afternoon.' });
    if (loc === 'castra') out.push({ k: 'war', t: 'Go to a province and fight', d: 'Tactical battle, real losses, and loot if you win.' });
    if (loc === 'domus' || (inRoom() && S.room === 'domus')) out.push({ k: 'build', t: 'Build on the house', d: 'Every room adds something to what you can do.' });
    if (window.WIDER) WIDER.acts(S, { loc, inRoom: inRoom(), room: S.room }).forEach(a => out.push(Object.assign({ k: 'wider' }, a)));
    out.push({ k: 'rest', t: 'Rest until dawn', d: 'A day passes, you feel human again, and the city moves on without you.' });
    const near = nearestPerson(2.2);
    if (near) out.push({ k: 'talk', who: near, t: '💬 Talk to ' + near.name, d: near.char ? (near.char.tt || near.char.n) : 'A face in the crowd.' });
    if (b && b.loc) out.push({ k: 'enter', t: 'Enter ' + b.name, d: b.sub || '', pri: 1 });
    else if (b) out.push({ k: 'enter', t: 'Try the door', d: 'It is locked, and the man inside does not open it for magistrates.' });
    if (inRoom() && !(window.WIDER && WIDER.isRegion(S.room))) out.push({ k: 'out', t: 'Step outside', d: 'Back to the street.', pri: 1 });
    out.push({ k: 'help', t: 'What am I looking at?', d: 'The crier, the street, and what you could be doing.' });
    return out;
  };
  function actionPanel() {
    const list = canDo();
    modal('📍 ' + esc(here().name), '<p class="mute" style="margin:0 0 10px">' + esc(here().sub || '') + '</p>' +
      '<div class="acts">' + list.map((a, i) => '<button class="act' + (a.pri ? ' pri' : '') + '" data-i="' + i + '"><b>' + esc(a.t) + '</b><span>' + esc(a.d || '') + '</span></button>').join('') + '</div>');
    document.querySelectorAll('#modal .act').forEach((b, i) => b.onclick = () => { const a = list[i]; closeModal(); doAction(a); });
  }
  function doAction(a) {
    if (!a) return;
    switch (a.k) {
      case 'ch': return chapterStep();
      case 'q': return sideStep();
      case 'goto': return goToPlace(a.at);
      case 'talk': return talkTo(a.who);
      case 'start': return offerChapter();
      case 'side': return sideQuest(a.q);
      case 'debate': return debate();
      case 'draft': case 'law': return window.SENATE ? window.SENATE.draft(gc()) : passLaw();
      case 'state': return window.SENATE ? window.SENATE.stateOfRome(gc()) : passLaw();
      case 'market': return window.SHOP ? window.SHOP.open(gc()) : toast('The market is shut', 'the stalls have been taken down for the day', 'bad');
      case 'games': return games();
      case 'arena': return arena();
      case 'war': return province();
      case 'build': return homeBuild();
      case 'rest': return rest();
      case 'enter': return enterBuilding();
      case 'out': return leaveRoom();
      case 'wider': closeModal(); return window.WIDER && WIDER.act(a, wapi());
      case 'help': return say('narrator', [STORY.crier ? STORY.crier(S) : 'The crier shouts the news and nobody believes him.', 'You are in ' + here().name + '. ' + (here().sub || '')]);
    }
  }
  function enterBuilding() {
    const b = buildingHere();
    if (!b) return say('narrator', ['There is no door here.'], {});
    const id = b.loc;
    if (!id || !(IMP.INTERIORS || {})[id]) return say('narrator', ['The door does not open. Whatever is behind it is not for you today.'], {});
    enterRoom(id);
  }

  /* ============================ panels ============================ */
  let paused = false;
  const boxOpen = () => !!(dlg || cineUp() || document.querySelector('#modal.show'));
  function modal(title, html, wide) {
    const m = $('modal');
    m.innerHTML = '<div class="mbox' + (wide ? ' wide' : '') + '"><div class="mhead"><b>' + title + '</b><button class="ib" id="mx">✕</button></div><div class="mbody">' + html + '</div></div>';
    m.classList.add('show');
    $('mx').onclick = closeModal;
    hud();
    return m;
  }
  function closeModal() { const m = $('modal'); m.classList.remove('show'); m.innerHTML = ''; hud(); flushCine(); }
  function journal() {
    const act = STORY.actOf(S);
    const actNames = ['A nobody with a name', 'The price of everything', 'The city in the balance', 'What Rome becomes'];
    let h = '<div class="tabs">';
    h += '<div class="jin"><h4>Act ' + act + ' · ' + actNames[act - 1] + '</h4>';
    const chActive = STORY.CH.filter(c => STORY.active(S, c.id));
    const chNext = STORY.next(S);
    const chDone = STORY.CH.filter(c => STORY.done(S, c.id));
    if (chActive.length) h += chActive.map(c => {
      const st = S.quests.step[c.id] || 0;
      return '<div class="jch"><div class="jh">Chapter ' + c.n + ': ' + esc(c.title) + '</div><div class="jd">' + esc(c.d) + '</div>' +
        '<div class="jsteps">' + c.steps.map((s, i) => '<div class="' + (i < st ? 'done' : i === st ? 'now' : '') + '">' + (i < st ? '✔' : i === st ? '▸' : '·') + ' ' + esc(s.text) + ' <i>(' + esc((IMP.LOCS[s.at] || {}).name || s.at) + ')</i></div>').join('') + '</div></div>';
    }).join('');
    if (!chActive.length) h += '<p class="mute">' + (chNext ? 'Chapter ' + chNext.n + ' — ' + esc(chNext.title) + ' is ready. Find ' + esc((charById(chNext.giver) || {}).n || 'somebody') + ' at ' + esc((IMP.LOCS[chNext.where] || {}).name || chNext.where) + ', or just press E anywhere to take it up.' : 'Every chapter is done. The rest of your life is the city.') + '</p>';
    const side = IMP.QUESTS.filter(q => STORY.active(S, q.id));
    if (side.length) h += '<h4>Jobs in hand</h4>' + side.map(q => { const st = S.quests.step[q.id] || 0; return '<div class="jch"><div class="jh">' + q.ic + ' ' + esc(q.n) + '</div><div class="jd">' + esc(q.d) + '</div><div class="jsteps">' + q.steps.map((s, i) => '<div class="' + (i < st ? 'done' : i === st ? 'now' : '') + '">' + (i < st ? '✔' : i === st ? '▸' : '·') + ' ' + esc(s.text) + ' <i>(' + esc(placeName(s.at)) + ')</i></div>').join('') + '</div></div>'; }).join('');
    if (chDone.length) h += '<h4>Behind you</h4><div class="jdone">' + chDone.map(c => '<span>' + c.ic + ' ' + c.n + '. ' + esc(c.title) + '</span>').join('') + '</div>';
    h += '</div><div class="jin"><h4>The people</h4>';
    h += CHARS().concat(extras).map(c => {
      const d = S.disp[c.id] || 0;
      const bar = Math.round((d + 1) / 2 * 100);
      return '<div class="jrel"><img src="' + PIX.portrait(lookOf(c), 40).toDataURL() + '" alt=""><div><b>' + esc(c.n) + '</b><i>' + esc(c.tt || '') + '</i>' +
        '<div class="rbar"><i style="width:' + bar + '%"></i></div></div></div>';
    }).join('');
    h += '</div>';
    modal('📜 The journal', h, true);
  }
  function character() {
    const a = S.attrs;
    const bars = Object.keys({ gravitas: 1, rhetoric: 1, martial: 1, cunning: 1, fides: 1, health: 1 }).map(k =>
      '<div class="stat"><b>' + k + '</b><div class="sbar"><i style="width:' + clamp((a[k] / 12) * 100, 4, 100) + '%"></i></div><span>' + (a[k] || 0) + '</span></div>').join('');
    const rep = ['senate', 'people', 'army'].map(k => '<div class="stat"><b>' + k + '</b><div class="sbar ' + k + '"><i style="width:' + clamp((S.rep[k] + 40) / 80 * 100, 3, 100) + '%"></i></div><span>' + Math.round(S.rep[k]) + '</span></div>').join('');
    modal('🪪 ' + esc(S.name), '<div class="ctop"><div><b>' + esc(S.office || 'Tiro') + '</b><i>' + rankName() + ' · ' + Math.round(S.xp) + ' experience</i></div>' +
      '<div class="cmoney">' + S.denarii.toLocaleString() + ' ⚖<i>' + Math.round(S.auctoritas) + ' ✦ auctoritas</i></div></div>' +
      '<h4>Attributes</h4>' + bars + '<h4>Standing</h4>' + rep +
      '<h4>The house</h4><div class="jdone">' + S.rooms.owned.map(id => { const r = IMP.ROOMS.find(x => x.id === id); return '<span>' + (r ? r.ic + ' ' + r.n : id) + '</span>'; }).join('') + '</div>' +
      '<h4>In the purse</h4><div class="jdone">' + (Object.keys(S.inv || {}).length ? Object.keys(S.inv).map(id => { const g2 = window.SHOP ? window.SHOP.GOODS.find(x => x.id === id) : null; return '<span>' + (g2 ? g2.g + ' ' + g2.n : id) + (S.inv[id] > 1 ? ' ×' + S.inv[id] : '') + '</span>'; }).join('') : '<span class="mute">Nothing bought yet. The Macellum sells bread, wine, a toga and worse.</span>') + '</div>' +
      (window.SENATE ? '<h4>Laws of your making</h4><div class="jdone">' + (S.pol && S.pol.laws.filter(l => !l.repealed).length ? S.pol.laws.filter(l => !l.repealed).map(l => '<span>' + l.icon + ' ' + esc(l.title.split(' — ')[0]) + '</span>').join('') : '<span class="mute">None yet. Take the floor of the house and write one.</span>') + '</div>' : '') +
      '<h4>Careers recorded</h4><p class="mute">' + S.battles.w + ' battles won, ' + S.battles.l + ' lost. ' + S.laws.length + ' laws carried. ' + Object.keys(S.story.flags).length + ' decisions on the record.</p>' +
      '<div class="row" style="margin-top:14px;gap:8px"><button class="btn pri" id="cComp">🤝 The company</button><button class="btn" id="cState">🏛️ The state of Rome</button></div>', true);
    const cc = $('cComp'); if (cc) cc.onclick = () => { closeModal(); if (window.COMP) COMP.panel(S, gc()); };
    const cs = $('cState'); if (cs) cs.onclick = () => { closeModal(); if (window.SENATE) SENATE.stateOfRome(gc()); };
  }
  function worldMap() {
    const m = document.createElement('canvas');
    const sc = 7; m.width = IMP.W * sc; m.height = IMP.H * sc;
    const g = m.getContext('2d');
    g.imageSmoothingEnabled = false;
    g.fillStyle = '#0f0e12'; g.fillRect(0, 0, m.width, m.height);
    const P = { water: '#2f5a6b', cobble: '#7a7264', cobble2: '#6d6659', plaza: '#b3a990', marble: '#c6bda6', stone: '#a89e88', garden: '#3f5c30', grass: '#3d5a2b', flower: '#4a6a33', sand: '#bb9f6d', track: '#c4a878', wood: '#6b4f33', wall: '#5a5145', fresco: '#6b211c', mosaic: '#a8956b', rubble: '#5f574a', roof: '#8f4a30', dirt: '#5f4e38' };
    for (let y = 0; y < IMP.H; y++) for (let x = 0; x < IMP.W; x++) { g.fillStyle = P[L.tile[y][x][0]] || '#777'; g.fillRect(x * sc, y * sc, sc, sc); }
    L.buildings.forEach(b => { g.fillStyle = b.loc ? '#3a2f22' : '#4a3f30'; g.fillRect(b.x * sc, b.y * sc, b.w * sc, b.h * sc); });
    IMP.BUILDINGS.filter(b => b.loc).forEach(b => {
      g.fillStyle = '#e0c46a';
      g.fillRect(b.x * sc, b.y * sc, b.w * sc, b.h * sc);
      g.fillStyle = '#2a2118';
      g.font = 'bold ' + (sc * 1.4) + 'px sans-serif'; g.textAlign = 'center';
      g.fillText(b.short || b.name, (b.x + b.w / 2) * sc, (b.y + b.h / 2 + .5) * sc);
    });
    g.fillStyle = '#fff6d0'; g.beginPath(); g.arc(you.x * sc, you.y * sc, sc * .9, 0, 6.3); g.fill();
    g.strokeStyle = '#ff5a3c'; g.lineWidth = 2; g.stroke();
    modal('🗺️ Rome', '<div class="mapwrap"><img src="' + m.toDataURL() + '" alt="map of Rome"></div><p class="mute">You are the dot. Gold marks the places you can walk into. The river is the blue band, and there are two bridges.</p>', true);
  }
  function settings() {
    modal('⚙ Settings', '<div class="sets">' +
      '<label><input type="checkbox" id="sSound"' + (S.set.sound ? ' checked' : '') + '> Music and sound</label>' +
      '<label>Music volume <input type="range" id="sVolM" min="0" max="100" value="' + Math.round(ImpAudio.volume('music') * 100) + '"></label>' +
      '<label>Effects volume <input type="range" id="sVolS" min="0" max="100" value="' + Math.round(ImpAudio.volume('sfx') * 100) + '"></label>' +
      '<label><input type="checkbox" id="sMini"' + (S.set.mini ? ' checked' : '') + '> Map in the corner</label>' +
      '<label><input type="checkbox" id="sWeather"' + (S.set.weather ? ' checked' : '') + '> Weather</label>' +
      '<label>Walk speed <input type="range" id="sSpeed" min="1" max="3" step="1" value="' + (S.set.speed || 1) + '"></label>' +
      '<label>Your voice in the Senate <select id="sTone"><option value="auto"' + (S.tone === 'auto' ? ' selected' : '') + '>Let me choose the best argument</option>' + IMP.ARGS.map(a => '<option value="' + a.id + '"' + (S.tone === a.id ? ' selected' : '') + '>' + a.n + '</option>').join('') + '</select></label>' +
      '<div class="row" style="margin-top:10px;gap:8px"><button class="btn" id="sSave">Save now</button><button class="btn" id="sWipe">Abandon this career</button></div>' +
      '</div>');
    $('sSound').onchange = e => { S.set.sound = e.target.checked; ImpAudio.enable(S.set.sound); if (S.set.sound) musicFor(here().id); save(true); };
    $('sVolM').oninput = e => ImpAudio.volume('music', e.target.value / 100);
    $('sVolS').oninput = e => ImpAudio.volume('sfx', e.target.value / 100);
    $('sVolS').onchange = () => ImpAudio.sfx('coin');
    $('sMini').onchange = e => { S.set.mini = e.target.checked; hud(); save(true); };
    $('sWeather').onchange = e => { S.set.weather = e.target.checked; save(true); };
    $('sSpeed').onchange = e => { S.set.speed = +e.target.value; save(true); };
    $('sTone').onchange = e => { S.tone = e.target.value; save(true); };
    $('sSave').onclick = () => { save(); closeModal(); };
    $('sWipe').onclick = () => { if (confirm('Abandon this career and start again? The save is deleted.')) { localStorage.removeItem(SAVE()); localStorage.removeItem(LEGACY); location.reload(); } };
  }
  function help() {
    modal('❔ How to live in Rome', '<div class="helpgrid">' +
      '<div><b>Walk</b><span>WASD or the arrow keys. Or click somewhere and walk there. Romans are solid — you cannot walk through one.</span></div>' +
      '<div><b>E</b><span>What you can do here: talk, take a step in a chapter, enter a building, take the Senate floor.</span></div>' +
      '<div><b>J</b><span>The journal: chapters, jobs, and what everybody in Rome thinks of you.</span></div>' +
      '<div><b>C</b><span>Your character: attributes, standing with the three powers, and the house you are building.</span></div>' +
      '<div><b>M</b><span>The map of the city. Gold marks the places you can walk into. Two bridges cross the river.</span></div>' +
      '<div><b>Space</b><span>Advance the conversation.</span></div>' +
      '<div><b>Esc</b><span>Close whatever is open, or leave a room.</span></div>' +
      '<div><b>Shift</b><span>Hold it and walk faster — the crowd gets out of the way, mostly.</span></div>' +
      '<div><b>The Senate</b><span>At the Curia (E): draft your own law — the matter, the purse, the clauses, the name — then argue it on the floor. Three rounds, four blocs, 151 seats. What passes changes the price of bread, the temper of the street and the morale of your legions, every day after.</span></div>' +
      '<div><b>The market</b><span>The Macellum and the Argiletum sell bread (its price follows your grain laws), wine, a toga, a doctor, and gifts for the three powers.</span></div>' +
      '</div><p class="mute">Chapters come in order: the journal always tells you the one step you are on. Wars are won with the battle engine, the house with arguments and money, and the street with both.</p>');
  }

  /* ============================ sound ============================ */
  function toggleSound() {
    const m = ImpAudio.toggle();
    S.set.sound = !m;
    toast(m ? 'Sound off' : 'Sound on', m ? 'the lyre is put away' : 'a lyre and a drum, if the browser allows it', 'sound');
  }
  /* the theme for every room and every place outside Rome (the rooms used to fall back on the atrium tune, and the
     baths' room is called balnea, so its own music never played) */
  const ROOM_MUSIC = {
    domus: 'atrium', curia: 'court', basilica: 'court', rostra: 'forum', vesta: 'temple', capitolium: 'temple', temple: 'temple',
    macellum: 'harvest', tavern: 'subura', balnea: 'baths', ludus: 'ludus', castra: 'field', portus: 'port', colosseum: 'circus',
    ostia: 'voyage', villa: 'harvest', camp: 'field'
  };
  function musicFor(id) {
    /* the save remembers whether you want sound; the browser's own copy of that choice could disagree and stay silent */
    if (ImpAudio.muted === !!S.set.sound) ImpAudio.enable(!!S.set.sound);
    if (!S.set.sound) return;
    if (cineUp()) { ImpAudio.music('plate'); return; }
    if (document.querySelector('#battle.show')) { ImpAudio.music('siege'); return; }   // a battle has its own drums
    const night = S.time < 5.5 || S.time > 20.5;
    const theme = inRoom()
      ? (night && room && room.outdoor ? 'night' : ROOM_MUSIC[S.room] || 'atrium')
      : ['basilica', 'tabularium'].includes(id) ? 'court'
        : id === 'balnea' ? 'baths'
          : id === 'ludus' || id === 'colosseum' ? 'ludus'
            : ['curia', 'rostra', 'forum', 'aedes'].includes(id) ? (night ? 'night' : 'forum')
              : ['subura', 'tavern'].includes(id) ? 'subura'
                : id === 'macellum' ? 'harvest'
                  : ['castra', 'temple'].includes(id) ? 'field'
                    : id === 'circus' ? 'circus'
                      : id === 'portus' || id === 'wharf' || id === 'horrea' ? 'port'
                        : ['vesta', 'capitolium', 'capitol', 'janiculum'].includes(id) ? 'temple'
                          : night ? 'night'
                          : (you.x > 92) ? 'far'
                            : 'via';
    ImpAudio.music(theme);
  }

  /* ============================ input ============================ */
  function bindInput() {
    const c = $('view');
    c.addEventListener('mousedown', ev => {
      const r = c.getBoundingClientRect(), z = zoom();
      const x = Math.floor(((ev.clientX - r.left) / z + cam.x) / T), y = Math.floor(((ev.clientY - r.top) / z + cam.y) / T);
      clickWalk(x, y);
    });
    window.addEventListener('keydown', ev => {
      /* typing in a box (a conversation, the name of a law) is typing, not walking or opening the journal */
      if (ev.target && /^(INPUT|TEXTAREA|SELECT)$/.test(ev.target.tagName)) return;
      const k = ev.key.toLowerCase();
      if (cineUp()) {                                       // a chapter card: space, enter, E or escape go on
        if (k === ' ' || k === 'enter' || k === 'escape' || k === 'e') { ev.preventDefault(); cineClose(); }
        return;
      }
      if (dlg) {
        if (k === ' ' || k === 'enter') { ev.preventDefault(); dlgNext(); return; }
        if (k === 'escape') { dlg = null; renderDlg(); return; }
        if (k >= '1' && k <= '3') { const b = document.querySelectorAll('#dialog .dch button')[+k - 1]; if (b) b.click(); return; }
      }
      if (k === 'w' || k === 'a' || k === 's' || k === 'd' || k === 'arrowup' || k === 'arrowdown' || k === 'arrowleft' || k === 'arrowright' || k === ' ') ev.preventDefault();
      keys[k] = 1;
      if (k === 'e') { ev.preventDefault(); pressE(); }
      else if (k === 'j') journal();
      else if (k === 'g') { if (window.COMP) COMP.panel(S, gc()); }
      else if (k === 'c') character();
      else if (k === 'm') worldMap();
      else if (k === 'k') settings();
      else if (k === '?' || k === 'h') help();
      else if (k === 's' && ev.ctrlKey) { ev.preventDefault(); save(); }
      else if (k === 'escape') { if (boxOpen()) closeModal(); else if (inRoom()) leaveRoom(); }
      else if (k === 'p') musicFor(here().id);
      else if (k === 'f') { toggleSound(); musicFor(here().id); }
    });
    window.addEventListener('keyup', ev => { keys[ev.key.toLowerCase()] = 0; });
    window.addEventListener('blur', () => { keys = {}; });        // never keep walking because a key got stuck down
    window.addEventListener('pointerdown', () => { try { window.focus(); } catch (e) { } });
    window.addEventListener('resize', () => { resize(); });
    window.addEventListener('message', ev => { if (ev.data && ev.data.impSet) Object.assign(S.set, ev.data.impSet); });
  }
  /* the step you are standing on right now, if it can be finished where you are */
  function stepReadyHere() {
    return objective().some(o => o.here && (o.k === 'ch' || o.k === 'q'));
  }
  /* the E key, the button, and the touch pad all mean the same thing */
  function pressE() {
    if (boxOpen()) return;
    const near = nearestPerson(2.2);
    if (inRoom() && Math.abs(you.x - room.door.x) <= 1 && you.y >= room.h - 3) return leaveRoom();
    /* If the step you are on can be finished right here, that is what E does. Standing on your objective with a
       stranger at your elbow used to open the stranger's conversation and bury the thing you walked there for. */
    if (stepReadyHere()) return actionPanel();
    near ? talkTo(near) : actionPanel();
  }

  function nearestPerson(radius) {
    let best = null, bd = radius;
    people.forEach(p => { if (p === you) return; const d = Math.hypot(p.x + .5 - (you.x + .5), p.y + .5 - (you.y + .5)); if (d <= bd) { bd = d; best = p; } });
    return best;
  }

  /* ============================ boot ============================ */
  function title() {
    const have = load();
    if (S ? S.set.sound : true) ImpAudio.music('anthem');        // the screen the game opens on has its own theme
    const host = $('title');
    host.classList.add('show');
    host.innerHTML =
      '<div class="tcard">' +
      '<div class="trome">IMPERIUM</div>' +
      '<div class="tsub">Two ways to live in Rome: a career you invent, or the most documented life in the Republic.</div>' +
      (have ? '<button class="btn pri big" id="tcont">Continue as ' + esc(have.name) + ' — ' + esc(have.office || 'Tiro') + '</button>' : '') +
      '<div class="tmodes">' +
      '<button class="tmode" id="tcareer"><b>🏛️ A career of your own</b><span>Pick a way into the city and write a life out of it. Twenty chapters, four acts, six starts, and a Senate that will vote against you in front of a crowd.</span></button>' +
      '<button class="tmode" id="tcaesar"><b>🦅 The life of Caesar</b><span>Sixteen chapters from a bad roof in the Subura to the hall of Pompey on the fifteenth of March. Pirates, Gaul, the Rubicon, the Nile, and the crown offered three times.</span></button>' +
      '</div>' +
      '<div class="tslots" id="tslots"></div>' +
      '<div class="tbgs" id="tbgs"></div>' +
      '<div class="tfoot"><span><b>WASD</b> walk</span><span><b>Shift</b> run</span><span><b>E</b> act</span><span><b>J</b> journal</span><span><b>C</b> character</span><span><b>M</b> map</span><span><b>?</b> help</span></div>' +
      '</div>';
    $('tcareer').onclick = () => chooseCareer();
    $('tcaesar').onclick = () => startCaesar();
    if (have) $('tcont').onclick = () => { S = have; setMode(have.mode || 'career'); bootGame(); };
    paintSlots();
    const box = $('tbgs');
    IMP.BGS.forEach(bg => {
      const b = document.createElement('button');
      b.className = 'tbg';
      b.innerHTML = '<b>' + bg.ic + ' ' + bg.name + '</b><span>' + bg.tag + '</span>';
      b.onclick = () => start(bg.id);
      box.appendChild(b);
    });
  }
  /* The three books on the shelf. Switching one re-renders the title so the Continue button targets it. */
  function paintSlots() {
    const box = $('tslots'); if (!box) return;
    box.innerHTML = '<div class="sh">Careers — slot ' + activeSlot + '</div>' + SLOTS.map(n => {
      const s = readSlot(n);
      const mode = s && s.mode === 'caesar' ? '🦅' : '🏛️';
      return '<button class="tslot' + (n === activeSlot ? ' on' : '') + '" data-slot="' + n + '">' +
        '<b>Slot ' + n + '</b><span>' + (s ? mode + ' ' + esc(s.name) + ' · day ' + (s.day || 1) + ' · ' + esc(s.office || 'Tiro') : 'empty — begin here') + '</span>' +
        (n === activeSlot ? '<i>▸ in play</i>' : '') + '</button>';
    }).join('');
    box.querySelectorAll('[data-slot]').forEach(b => b.onclick = () => {
      const n = +b.dataset.slot;
      if (n === activeSlot) return;
      const other = readSlot(n);
      if (S) { save(true); }                                  // never lose the career you are standing in
      activeSlot = n;
      try { localStorage.setItem('imperium.slot.active', String(n)); } catch (e) { }
      setMode(other && other.mode === 'caesar' ? 'caesar' : 'career');
      title();
    });
  }
  function chooseCareer() {
    $('title').innerHTML = '<div class="tcard"><div class="trome small">WHO ARE YOU?</div><div class="tsub">Six ways into a city that has never heard of you.</div><div class="tbgs" id="tbgs"></div><div class="row" style="margin-top:12px"><button class="btn" id="tback">◂ back</button></div></div>';
    const box = $('tbgs');
    IMP.BGS.forEach(bg => {
      const b = document.createElement('button');
      b.className = 'tbg';
      const at = Object.keys(bg.attrs).map(k => '<i>' + k + ' ' + bg.attrs[k] + '</i>').join('');
      b.innerHTML = '<b>' + bg.ic + ' ' + bg.name + '</b><span>' + bg.tag + '</span><p>' + bg.blurb + '</p><div class="attrs">' + at + '</div><div class="bgd">' + bg.denarii + ' ⚖ · ' + bg.office + '</div>';
      b.onclick = () => start(bg.id);
      box.appendChild(b);
    });
    $('tback').onclick = title;
  }
  /* The life of Caesar. Not a background you choose — a life already in progress, with an uncle who is consul for
     the sixth time, a mother who counts the money, and a city that will spend the next forty years deciding what he is. */
  function startCaesar() {
    S = newCareer('Gaius Julius Caesar', 'novus');
    S.mode = 'caesar'; setMode('caesar');
    S.bg = 'caesar';
    S.attrs = { health: 6, gravitas: 6, rhetoric: 7, martial: 6, cunning: 8, fides: 4 };
    S.denarii = 600; S.auctoritas = 12;
    S.rep = { senate: 10, people: 26, army: 18 };
    S.office = 'Flamen Dialis';
    boot.fresh = true;
    bootGame();
    setTimeout(() => {
      S.actShown = 1;
      cine({
        kicker: 'Rome, the year of Marius’s sixth consulship',
        title: 'Act I · The boy from the Subura',
        paras: ['You are born in a house with a good name and a bad roof, into a family that claims Venus and cannot afford a new gutter.',
          'Everything after this is on the record. That is the difference: this life has clerks.'],
        go: 'Open your eyes ▸'
      }, () => say('narrator', ['Your mother is Aurelia. Your uncle by marriage is Gaius Marius, who has no ancestors, six consulships and no patience.',
        'The alley outside is already deciding what you are, and it will not be asked again.'], { onEnd: () => { play('c1', () => { offerChapter(); save(); }); } }));
    }, 420);
  }
  function start(bgId) {
    S = newCareer(null, bgId);
    S.mode = 'career'; setMode('career');
    boot.fresh = true;
    bootGame();
    setTimeout(() => {
      const bg = IMP.BGS.find(b => b.id === bgId);
      S.actShown = 1;
      cine({
        kicker: 'Rome, 691 from the founding of the city',
        title: 'Act I · A nobody with a name',
        paras: [bg.name + ': ' + bg.tag + '. ' + bg.blurb, acts()[0].blurb],
        go: 'Walk out into the street ▸'
      }, () => say('narrator', ['Your household, your debts, your name, and a city of a million people who have not heard of any of it.'], { onEnd: () => { play('intro', () => { offerChapter(); save(); }); } }));
    }, 420);
  }
  function bootGame() {
    const host = $('title');
    host.classList.remove('show'); host.innerHTML = '';
    $('stage').classList.add('show');
    buildPeopleOnce = true;
    startCity(false);
    if (S.set.sound) musicFor(here().id);
    resize(); hud(); save(true);
    /* a resumed career with no chapter in hand is offered the next one; a brand new one gets its own opening card
       and the first chapter after the intro scene, so this must not fire twice */
    const nx = STORY.next(S);
    if (!boot.fresh && nx && !S.quests.active.length && !Object.keys(S.story.seen).length) setTimeout(() => offerChapter(), 900);
    boot.fresh = false;
  }
  let buildPeopleOnce = false;
  function begin() {
    if (!window.PIXWORLD) { document.title = 'Imperium: art missing'; return; }
    L = IMP.load();
    art = IMP.paint(L);
    bindInput();
    /* thumbs: a phone or a tablet gets a d-pad and four buttons over the corner of the board */
    document.querySelectorAll('#touch [data-k]').forEach(b => {
      const down = e => { e.preventDefault(); keys[b.dataset.k] = 1; };
      const up = e => { e.preventDefault(); keys[b.dataset.k] = 0; };
      b.addEventListener('pointerdown', down); b.addEventListener('pointerup', up);
      b.addEventListener('pointerleave', up); b.addEventListener('pointercancel', up);
    });
    document.querySelectorAll('#touch [data-a]').forEach(b => b.onclick = e => {
      e.preventDefault();
      const a = b.dataset.a;
      if (a === 'act') pressE();
      else if (a === 'journal') journal();
      else if (a === 'map') worldMap();
      else if (a === 'char') character();
      else if (a === 'back') { if (boxOpen()) closeModal(); else if (inRoom()) leaveRoom(); }
    });
    if (matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window) {
      const t = document.getElementById('touch'); if (t) t.style.display = '';
    }
    title();
    lastT = performance.now();
    raf = requestAnimationFrame(loop);
    boot.t = 0;
    setInterval(() => { boot.t = performance.now(); dlgTick(.05); }, 60);
    setInterval(() => { if (S && !dlg) save(true); }, 20000);
    window.addEventListener('beforeunload', () => { if (S) save(true); });
    ImpAudio.wake();
  }
  /* a tiny hook so the app's self-test and the page's own buttons can reach the game */
  window.IMPERIUM = {
    get state() { return S; }, start, title, year: () => yearNow(), offerChapter, play, save: () => save(), newCareer, audit: () => IMP.audit(),
    get here() { return here(); }, get who() { return people.map(p => p.name + '@' + p.x + ',' + p.y); },
    /* handles for the app's self-test and for the console: move, walk into a room, come out, start a fight */
    debug: {
      goto(x, y) { you.x = x; you.y = y; you.fx = x * T; you.fy = y * T; you.vx = you.vy = 0; you.goal = null; you.from = { x, y }; you.to = { x, y }; you.path = null; you.walk = false; S.tile = { x, y }; cam.tx = clamp(you.fx - vw() / 2, 0, Math.max(0, (inRoom() ? room.base : art.base).width - vw())); cam.ty = clamp(you.fy - vh() / 2, 0, Math.max(0, (inRoom() ? room.base : art.base).height - vh())); cam.x = cam.tx; cam.y = cam.ty; hud(); },
      enter: id => enterRoom(id), leave: () => leaveRoom(), panel: () => actionPanel(), war: () => province(), warIn: id => battleIn(IMP.PROVS.find(p => p.id === id) || IMP.PROVS[0]),
      draft: () => window.SENATE && window.SENATE.draft(gc()), state: () => window.SENATE && window.SENATE.stateOfRome(gc()),
      lawbook: () => (S.pol || {}).laws || [], senateDay: () => { onNewDay(); return window.SENATE ? window.SENATE.eff(S) : null; },
      market: () => window.SHOP && window.SHOP.open(gc()), marketBoard: () => window.SHOP ? window.SHOP.board(S) : null,
      caesar: () => startCaesar(), mode: () => S.mode, story: () => window.STORY === STORY_CAESAR ? 'caesar' : 'career',
      pick: (k, v) => { S.story.flags[k] = v; return S.story.flags; },
      solidAt: (x, y) => solidAt(x, y), walk: (x, y) => clickWalk(x, y), people: () => people.length,
      /* is anybody standing inside anybody else? — and a way to force a separation pass without waiting for the loop */
      overlap: () => {
        const seen = {}, clash = [];
        people.forEach(p => { const k = p.x + ',' + p.y; if (seen[k]) clash.push(k); seen[k] = 1; });
        return { people: people.length, squares: Object.keys(seen).length, clash };
      },
      separate: () => { separate(1); return window.IMPERIUM.debug.overlap(); },
      near: () => { const p = nearestPerson(3); return p ? p.name : null; }, say,
      where: () => ({ x: you.x, y: you.y, fx: Math.round(you.fx), fy: Math.round(you.fy), vx: Math.round(you.vx), vy: Math.round(you.vy), walk: !!you.walk, aim: !!(you.goal && you.goal.length), cam: Math.round(cam.x) + ',' + Math.round(cam.y), map: S.map, here: here().id, b: (buildingHere() || {}).id, loc: (buildingHere() || {}).loc }),
      acts: () => canDo().map(a => a.k + ':' + a.t), act: a => doAction(a), last: () => boot.lastEnter,
      card: () => cineUp(), cine: (o, cb) => cine(o, cb), close: () => cineClose(), actCard: n => actCard(n), letter: n => actLetter(n), crier: () => STORY.crier(S),
      imp: () => ({ same: IMP === window.IMP, k: Object.keys(IMP.INTERIORS || {}), domus: !!(IMP.INTERIORS || {}).domus, roomDomus: !!IMP.room('domus') })
    }
  };
  if (document.readyState === 'complete' || document.readyState === 'interactive') setTimeout(begin, 0);
  else window.addEventListener('DOMContentLoaded', begin);
})();

/* follow the app's Motion setting (Settings > Appearance > Motion): "off" stills the decorative animations here too */
try { if (localStorage.getItem('oa_motion') === 'off') document.documentElement.classList.add('still'); } catch (e) { }

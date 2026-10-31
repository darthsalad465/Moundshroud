/* COMPANIONS — the people who go with you.

   A city RPG is lonely if you walk through it alone. This is the machinery that turns people you have already
   impressed into people who are actually beside you:

     · recruiting: three slots, earned by liking you enough (0.4 out of 1) and paid for in coin. Ask them where
       they stand; they say yes because you have spent an hour being worth following.
     · following: they appear in the street behind you, walk where you walk, wait when you wait, and are not
       inside when you go inside — a Roman of rank does not drag his friends into the baths.
     · fighting: a blade companion brings a real unit to every battle, scaled by their level. The others bring
       money, cheaper markets, or better arguments instead of swords.
     · growing: they take a third of your experience and level up to five, and that is where the bonuses come from.
     · teaching: anyone in Rome with something worth knowing will train you for coin, once a day each.
     · gifts: the market sells them for exactly this — one person's opinion of you, raised, in one action.
*/
window.COMP = (() => {
  'use strict';
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&', '<': '<', '>': '>', '"': '"' }[c]));

  /* ============================ the roster ============================ */
  /* role: blade brings a unit to battle · quill helps you argue and learn · purse moves money.
     modes: which of the two stories this person can travel in. */
  const ROSTER = [
    { id: 'pullo', n: 'Pullo', ic: '🛡️', role: 'blade', unit: 'guard', modes: ['career', 'caesar'],
      tag: 'Primus pilus',
      pitch: 'Ten men, whenever you need them. Say the word and stop looking at your hands.',
      line: 'Chief — I have been two paces behind you for eleven years anyway. It might as well be official.' },
    { id: 'aulus', n: 'Aulus', ic: '🖋️', role: 'quill', modes: ['career'],
      tag: 'Your secretary',
      pitch: 'The accounts, the letters and the men who owe you, all in one place and read twice.',
      line: 'I will go where the accounts go, which is where you go. Shall I bring the good stylus?' },
    { id: 'berenice', n: 'Berenice', ic: '⛵', role: 'purse', modes: ['career'],
      tag: 'Queen of the eastern trade',
      pitch: 'Your purse goes further in every market between Ostia and Alexandria. It always has.',
      line: 'Rome is loud, and you are the only Roman I can hear over it. Very well — I will come.' },
    { id: 'gaius', n: 'Gaius', ic: '🛡️', role: 'blade', unit: 'legion', modes: ['career'],
      tag: 'Veteran of the Tenth',
      pitch: 'Twenty-five years in the line and one bad hand that has never once held him back.',
      line: 'The Tenth would hold that line for you, and the Tenth will hold it for nothing if you ask properly.' },
    { id: 'marina', n: 'Marina', ic: '📦', role: 'quill', modes: ['career'],
      tag: 'Harbour clerk',
      pitch: 'Every price in the city, revised hourly, and which senator is smuggling what.',
      line: 'I know where the ships go. If you are walking into something, I would rather walk into it too.' },
    { id: 'antony', n: 'Antony', ic: '🍷', role: 'blade', unit: 'guard', modes: ['caesar'],
      tag: 'Soldier and drinker',
      pitch: 'The best company in Rome and the worst man to leave in charge of it. Both are useful.',
      line: 'Finally! I have been waiting for you to ask. Bring a cloak; we are not coming back for a while.' },
    { id: 'brutus', n: 'Brutus', ic: '📖', role: 'quill', modes: ['caesar'],
      tag: 'The most honourable man in the room',
      pitch: 'He reads the law before you do and tells you when you are about to be wrong in public.',
      line: 'I will come. I will argue with you constantly. You will find that useful, and so will I.' },
    { id: 'cleopatra', n: 'Cleopatra', ic: '🐍', role: 'purse', modes: ['caesar'],
      tag: 'Queen of Egypt',
      pitch: 'Nine languages, a fleet and more money than the treasury. She does not bring the fleet.',
      line: 'Very well. I will walk your streets and see whether Rome is really as loud as they say.' }
  ];
  const recruitOf = id => ROSTER.find(r => r.id === id) || null;

  /* what each person can teach you, and what they think of you before they will start */
  const TEACH = {
    cato: { attr: 'gravitas', n: 'the old way of doing things', d: 'He will explain why the Republic works, at length, and you will start to believe it.' },
    cornelia: { attr: 'gravitas', n: 'the family name', d: 'How a name is spent, kept and borrowed against without anybody noticing.' },
    cicero: { attr: 'rhetoric', n: 'a sentence that lands', d: 'He takes your paragraph apart and leaves you one line that survives.' },
    aulus: { attr: 'rhetoric', n: 'the ledger argument', d: 'Numbers said out loud, in order, in front of men who hoped you had not counted.' },
    marius: { attr: 'martial', n: 'how to hold a line', d: 'Five hours in the camp with a shield and no conversation whatsoever.' },
    pullo: { attr: 'martial', n: 'what actually happens in a fight', d: 'Not the speech. The thing that happens in the two seconds after the speech.' },
    gaius: { attr: 'martial', n: 'twenty-five years of it', d: 'He shows you the bad hand and explains exactly how it went bad.' },
    crassus: { attr: 'cunning', n: 'how a contract really works', d: 'You read a clause twice, then a third time, and then he tells you what it is for.' },
    vatinius: { attr: 'cunning', n: 'the useful lie', d: 'How to say something untrue in a way that cannot be prosecuted.' },
    aurelia: { attr: 'fides', n: 'the rites', d: 'The flame, the offerings, and why the city believes what it believes.' },
    cassia: { attr: 'fides', n: 'keeping a fire', d: 'Six hours of ritual and the discipline of doing it exactly the same way every day.' },
    berenice: { attr: 'cunning', n: 'what a shipload costs', d: 'Freight, spoilage, and the price of being trusted in three harbours.' },
    antony: { attr: 'martial', n: 'how to keep men loyal', d: 'He pays their debts, learns their names, and never asks them to do what he would not.' },
    brutus: { attr: 'rhetoric', n: 'the moral case', d: 'You write an argument down and he crosses out every word flattering to you.' },
    cleopatra: { attr: 'cunning', n: 'nine languages of it', d: 'She teaches you to hear what somebody is not saying, in whatever tongue they use.' }
  };
  const teachOf = id => TEACH[id] || null;

  /* ============================ state ============================ */
  function init(S) {
    if (!S) return S;
    if (!Array.isArray(S.squad)) S.squad = [];
    if (!S.trained) S.trained = {};
    return S;
  }
  const member = (S, id) => (S.squad || []).find(m => m.id === id) || null;
  const level = m => m ? clamp(1 + Math.floor((m.xp || 0) / 380), 1, 5) : 0;
  const room = () => 3;

  function eligible(S, id) {
    if (!S) return false;
    init(S);
    const r = recruitOf(id);
    if (!r || member(S, id)) return false;
    if (S.squad.length >= room()) return false;
    const mode = (S.mode === 'caesar') ? 'caesar' : 'career';
    return r.modes.indexOf(mode) >= 0;
  }
  /* the opinion has to be earned first: 0.4 is "I will walk out of the city with you" */
  const willing = (S, id) => ((S.disp || {})[id] || 0) >= .4;

  function recruit(S, id) {
    if (!S) return { ok: false, why: 'no career' };
    init(S);
    if (!eligible(S, id)) return { ok: false, why: 'not eligible' };
    if (!willing(S, id)) return { ok: false, why: 'not willing' };
    S.squad.push({ id, xp: 0, joined: S.day || 1 });
    return { ok: true };
  }
  function dismiss(S, id) {
    if (!S) return false;
    init(S);
    S.squad = S.squad.filter(m => m.id !== id);
    return true;
  }

  /* ============================ what the company is worth ============================ */
  function bonuses(S) {
    const b = { atk: 1, morale: 0, quality: 1, loot: 1, price: 1, xp: 1, argue: 0, units: [], names: [] };
    if (!S) return b;
    init(S);
    S.squad.forEach(m => {
      const r = recruitOf(m.id); if (!r) return;
      const l = level(m);
      b.names.push(r.n);
      if (r.role === 'blade') {
        b.atk += .035 * l;
        b.morale += 3 * l;
        b.quality += .07 * l;
        b.units.push({ type: r.unit, mods: { quality: 1 + .10 * l, morale: 4 * l, atk: 1 + .05 * l }, who: r.n });
      } else if (r.role === 'quill') {
        b.xp += .05 * l;
        b.argue += .02 * l;
      } else if (r.role === 'purse') {
        b.loot += .10 * l;
        b.price -= .05 * l;
      }
    });
    b.price = clamp(b.price, .5, 1);
    return b;
  }

  /* experience shares out: you take the lot, they take a third of it, and that is how they level */
  function share(S, n) {
    if (!S) return [];
    init(S);
    if (!S.squad.length || n <= 0) return [];
    const gained = Math.max(1, Math.round(n * .35));
    const ups = [];
    S.squad.forEach(m => {
      const before = level(m);
      m.xp = (m.xp || 0) + gained;
      const after = level(m);
      if (after > before) { m.xp = after * 380; ups.push({ id: m.id, lvl: after }); }
    });
    return ups;
  }

  /* ============================ the street ============================ */
  /* Who is behind you when the people of the city are rebuilt. */
  function followers(S) {
    if (!S) return [];
    init(S);
    return S.squad.map(m => recruitOf(m.id)).filter(Boolean);
  }

  /* ============================ the field ============================ */
  function army(S) { return bonuses(S).units; }

  /* ============================ training ============================ */
  const teaches = id => teachOf(id);
  function trainCost(S, id) {
    const a = (S && S.attrs || {})[(TEACH[id] || {}).attr] || 1;
    return Math.round(60 + a * a * 7);
  }
  function canTrain(S, id) {
    if (!S) return false;
    init(S);
    const t = teachOf(id); if (!t) return false;
    if (((S.attrs || {})[t.attr] || 1) >= 12) return false;
    if (((S.disp || {})[id] || 0) < .25) return false;               // he will not waste an afternoon on you yet
    return (S.trained[id] || 0) !== S.day;
  }
  function train(S, id) {
    const t = teachOf(id);
    const cost = trainCost(S, id);
    if (!t) return { ok: false, why: 'no teacher' };
    if (!canTrain(S, id)) return { ok: false, why: (S.trained[id] || 0) === S.day ? 'today' : 'not yet' };
    if (S.denarii < cost) return { ok: false, why: 'coin', cost };
    S.denarii -= cost;
    S.attrs[t.attr] = clamp((S.attrs[t.attr] || 1) + 1, 1, 12);
    S.trained[id] = S.day;
    S.xp = (S.xp || 0) + 6;
    return { ok: true, attr: t.attr, cost, t };
  }

  /* ============================ gifts ============================ */
  function gift(S, id) {
    if (!S) return { ok: false, why: 'no career' };
    init(S);
    if (!(S.inv && S.inv.gift)) return { ok: false, why: 'no gift' };
    S.inv.gift--;
    const before = S.disp[id] || 0;
    S.disp[id] = clamp(before + .12, -1, 1);
    const c = (window.IMP && window.IMP.CHARS) ? window.IMP.CHARS.find(x => x.id === id) : null;
    const fac = c && c.faction;
    if (fac && S.rep) S.rep[fac] = clamp((S.rep[fac] || 0) + 2, -100, 100);
    return { ok: true, rose: before <= .4 && S.disp[id] > .4 };
  }

  /* ============================ painting ============================ */
  /* The row in the side panel: who is with you and what they have become. */
  function hud(host, opts) {
    const S = opts && opts.S;
    if (!host) return;
    if (!S || !S.squad || !S.squad.length) { host.innerHTML = ''; host.style.display = 'none'; return; }
    init(S);
    host.style.display = '';
    host.innerHTML = '<div class="sh">With you</div>' + S.squad.map(m => {
      const r = recruitOf(m.id); if (!r) return '';
      const l = level(m), cur = m.xp || 0;
      const pct = l >= 5 ? 100 : clamp(((cur - (l - 1) * 380) / 380) * 100, 0, 100);
      return '<div class="sq"><div class="sqi">' + r.ic + '</div><div class="sqb"><b>' + esc(r.n) + '</b>' +
        '<i>' + esc(r.tag) + '</i><div class="sqf"><u style="width:' + pct + '%"></u></div>' +
        '<span>level ' + l + (l < 5 ? ' · ' + Math.max(0, l * 380 - cur) + ' to go' : ' · master') + '</span></div>' +
        '<button class="sqx" data-x="' + m.id + '" title="Let them go home">✕</button></div>';
    }).join('');
    host.querySelectorAll('.sqx').forEach(b => b.onclick = ev => {
      ev.stopPropagation();
      const id = b.dataset.x, r = recruitOf(id);
      S.squad = S.squad.filter(x => x.id !== id);
      if (opts && opts.toast) opts.toast((r ? r.n : 'They') + ' goes home', 'one place in the company is free again', 'door');
      if (opts && opts.save) opts.save(true);
      if (opts && opts.refresh) opts.refresh();
    });
  }

  /* the company page of the journal, with the teachers you have found and what they charge */
  function panel(S, g) {
    if (!S) return '';
    init(S);
    const b = bonuses(S);
    let h = '<div class="jin"><h4>The company — ' + S.squad.length + ' of ' + room() + '</h4>';
    if (!S.squad.length) h += '<p class="mute">Nobody is walking with you. Raise somebody to 0.4 — talk to them, give gifts, finish their jobs — and ask them where they stand. Three places in the company.</p>';
    h += S.squad.map(m => {
      const r = recruitOf(m.id); if (!r) return '';
      const l = level(m), pct = l >= 5 ? 100 : clamp(((m.xp - (l - 1) * 380) / 380) * 100, 0, 100);
      const pic = (g && g.portrait) ? g.portrait(m.id) : '';
      return '<div class="jrel"><div class="sqi big">' + (pic ? '<img src="' + pic + '" alt="">' : r.ic) + '</div><div><b>' + esc(r.n) + '</b><i>' + esc(r.tag) + ' · with you since day ' + (m.joined || 1) + '</i>' +
        '<div class="rbar"><i style="width:' + pct + '%"></i></div>' +
        '<div class="small mute">level ' + l + ' — ' + esc(whatItDoes(r, l)) + '</div></div>' +
        '<button class="btn tiny" data-leave="' + m.id + '">Let go</button></div>';
    }).join('');
    h += '<h4>What the company gives you now</h4><div class="jdone">' +
      '<span>' + (b.morale ? '+' + Math.round(b.morale) + ' morale on every man you lead' : 'no soldier in the company yet') + '</span>' +
      (b.xp > 1 ? '<span>' + Math.round((b.xp - 1) * 100) + '% more experience from everything you do</span>' : '') +
      (b.price < 1 ? '<span>' + Math.round((1 - b.price) * 100) + '% off everything in the market</span>' : '') +
      (b.loot > 1 ? '<span>' + Math.round((b.loot - 1) * 100) + '% more loot from a province</span>' : '') +
      '</div>';
    h += '</div><div class="jin"><h4>Who will teach you</h4>' +
      '<p class="mute small">One lesson with one person a day; the same man will not sit with you again for three days. The market sells the gifts.</p>';
    h += Object.keys(TEACH).map(id => {
      const c = (g && g.charById) ? g.charById(id) : null; if (!c) return '';
      const t = TEACH[id], a = (S.attrs || {})[t.attr] || 1, disp = (S.disp || {})[id] || 0;
      const known = disp >= .25;
      const ready = canTrain(S, id) && S.denarii >= trainCost(S, id);
      const why = (S.trained[id] === S.day) ? 'taught you all he can today' : S.denarii < trainCost(S, id) ? 'not enough coin' : 'held';
      return '<div class="jrel teach' + (known ? '' : ' locked') + '"><div class="sqi">' + c.ic + '</div><div><b>' + esc(c.n) + '</b>' +
        '<i>' + esc(t.n) + ' · ' + esc(t.attr) + ' ' + a + '</i>' +
        '<div class="small mute">' + (known ? esc(t.d) : 'He does not know you well enough yet — ' + Math.round((disp + 1) / 2 * 100) + '%, wants 62%.') + '</div></div>' +
        (known ? '<button class="btn tiny' + (ready ? ' pri' : '') + '" data-train="' + id + '">' + (ready ? trainCost(S, id) + ' ⚖' : why) + '</button>' : '<span class="small mute">locked</span>') +
        '</div>';
    }).join('');
    h += '</div>';
    if (!g || !g.modal) return h;
    g.modal('🤝 The company', h, true);
    document.querySelectorAll('#modal [data-leave]').forEach(el => el.onclick = () => {
      const r = recruitOf(el.dataset.leave);
      dismiss(S, el.dataset.leave);
      if (g.toast) g.toast((r ? r.n : 'They') + ' goes home', 'there is a place free again, and they will come back if you ask', 'door');
      if (g.save) g.save(true);
      if (g.hud) g.hud();
      panel(S, g);
    });
    document.querySelectorAll('#modal [data-train]').forEach(el => el.onclick = () => {
      const id = el.dataset.train, t = TEACH[id];
      const res = train(S, id);
      if (!res.ok) {
        const why = res.why === 'coin' ? 'the lesson costs ' + trainCost(S, id) + ' denarii and you have ' + Math.floor(S.denarii)
          : res.why === 'today' ? 'he has already spent today on you' : 'he does not know you well enough yet';
        if (g.toast) g.toast('Not today', why, 'bad');
        return;
      }
      if (g.sfx) g.sfx('good');
      if (g.toast) g.toast('➕ ' + res.attr, (t ? t.n : 'a lesson') + ' — ' + res.cost + ' denarii, and the rest of the day is his', 'good');
      if (g.hud) g.hud();
      if (g.save) g.save(true);
      panel(S, g);
    });
    return h;
  }

  const whatItDoes = (r, l) => r.role === 'blade'
    ? 'brings ' + r.n + '’s ' + (r.unit === 'guard' ? 'veterans' : 'cohort') + ' to every battle, +' + (4 * l) + ' morale'
    : r.role === 'quill' ? '+' + (5 * l) + '% experience from everything you do'
      : (5 * l) + '% off the market, +' + (10 * l) + '% loot';

  return {
    ROSTER, TEACH, init, member, level, eligible, willing, recruit, dismiss, bonuses, share,
    followers, army, train, canTrain, trainCost, teaches, gift, hud, panel, recruitOf, teachOf, room, whatItDoes
  };
})();

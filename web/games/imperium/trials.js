/* TRIALS — the work between the decisions. A chapter step used to be a place and a key press: you walked to the
   harbour, pressed E, and were told it was done. Now the step is played. What kind of play it is comes from what
   the step says it is: questioning somebody is an interrogation, a speech is a contest for a room, a contract is a
   ledger with something wrong in it, a purchase is a haggle, the omens are a pattern of birds to read, and anything
   that has to be done with your feet is a matter of timing.

   Every trial is short, reads your attributes (a good talker starts ahead in a speech, a soldier has a wider target),
   and ends in one of three grades: 2 well, 1 well enough, 0 badly. None of them can stop the story: the chapter
   moves on whatever the grade, and the "just get it done" link at the bottom always works. The grade changes what
   the city says about it and what it is worth. */
window.TRIALS = (() => {
  'use strict';
  const rnd = Math.random, pick = a => a[Math.floor(rnd() * a.length)];
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const shuffle = a => { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };

  /* ---------------- which trial a step is ---------------- */
  const KINDS = [
    ['audit', /audit|ledger|contract|accounts|manifest|the wax|books|tally|records|papers|read (his|their|the) proposal|letters|the roll|count the names|figures|signature|clause/i],
    ['omens', /omen|auspic|the gods|altar|rites?\b|give thanks|pray|flame|sacrific|rededicate|judgement|the birds/i],
    ['haggle', /\bbuy\b|price|\bpay\b|bribe|\bhire\b|terms|dowry|stone and|meet both|trade|factor|money|treasury|purse/i],
    ['persuade', /speak|argue|answer|\bname\b|the house|senate|rostra|crowd|verdict|charge|denounce|make the|tell the|lay the|aloud|swear|case|speech|decide|put it to|use him/i],
    ['chase', /follow|chase|march|fire|hold the|cross|\brun\b|get (his|the) .* out|walk the road|take the hill|the line|front rank|bridge|counter-attack|harbour|wall|raised|before the man/i],
    ['question', /question|ask|find|hear|work the|trace|meet|watch|inspect|catch|bring the answer|look at|listen/i]
  ];
  const BYPLACE = { curia: 'persuade', rostra: 'persuade', basilica: 'persuade', tabularium: 'audit', macellum: 'haggle', temple: 'omens', vesta: 'omens', capitolium: 'omens', aedes: 'omens', castra: 'chase', portus: 'question', subura: 'question' };
  function kindOf(step) {
    if (/^(hear|listen|watch|ask|question|find|work)\b/i.test(step.act || '')) return 'question';   // listening, whatever else the line mentions
    const s = (step.act || '') + ' · ' + (step.text || '');
    for (const [k, re] of KINDS) if (re.test(s)) return k;
    return BYPLACE[step.at] || 'question';
  }
  /* which part of Rome notices how well you did it */
  const HOUSE = { question: 'people', persuade: null, audit: 'senate', haggle: 'people', omens: 'people', chase: 'army' };
  const STAT = { question: 'cunning', persuade: 'rhetoric', audit: 'cunning', haggle: 'cunning', omens: 'fides', chase: 'martial' };

  /* ---------------- the frame every trial sits in ---------------- */
  function frame(api, title, sub, body) {
    const m = api.modal(title, '<div class="tri"><p class="trsub">' + sub + '</p><div id="trb">' + body + '</div>' +
      '<div class="trfoot"><button class="trskip" id="trskip">Just get it done (no bonus)</button></div></div>', true);
    return m;
  }
  const bar = (label, v, col) => '<div class="trbar"><span>' + label + '</span><i><b style="width:' + clamp(v, 0, 100) + '%;background:' + col + '"></b></i><em>' + Math.round(v) + '</em></div>';

  /* =========================== 1. questioning a witness =========================== */
  const WIT = [
    { who: 'a harbourmaster', role: 'merchant', likes: 'pay', hates: 'lean', tells: ['He rubs his thumb against two fingers without noticing he is doing it.', 'His eyes keep going to your belt, where the purse is.'] },
    { who: 'a frightened house-slave', role: 'poor', likes: 'charm', hates: 'lean', tells: ['She flinches every time anybody raises a voice in the street.', 'She keeps watching the door instead of you.'] },
    { who: 'a veteran on the door', role: 'soldier', likes: 'lean', hates: 'pay', tells: ['He stands straighter when you speak to him like an officer.', 'He looks at the coin on the table as if it were an insult.'] },
    { who: 'a clerk with ink to the wrist', role: 'scholar', likes: 'press', hates: 'charm', tells: ['He corrects his own dates when you repeat them back to him.', 'Compliments seem to bore him.'] },
    { who: 'a widow from the tenement', role: 'matron', likes: 'charm', hates: 'pay', tells: ['She talks about her husband before you have asked anything.', 'She stiffens when your hand goes to your purse.'] },
    { who: 'a tavern keeper', role: 'pleb', likes: 'pay', hates: 'press', tells: ['He polishes the same cup over and over, watching your belt.', 'He goes quiet when the questions come too fast.'] },
    { who: 'a gladiator with a split lip', role: 'gladiator', likes: 'lean', hates: 'charm', tells: ['He grins when you square up to him.', 'Flattery makes him spit on the sand.'] },
    { who: 'a boatman', role: 'pleb', likes: 'press', hates: 'lean', tells: ['He contradicts himself about the hour and does not seem to notice.', 'He has the look of a man who has been threatened before, and recently.'] }
  ];
  const APPROACH = {
    press: { n: 'Press on the details', d: 'Make the times and names agree', stat: 'cunning' },
    charm: { n: 'Win them round', d: 'Patience, sympathy, a cup of something', stat: 'rhetoric' },
    pay: { n: 'Put a coin on the table', d: '40 denarii', stat: 'cunning', cost: 40 },
    lean: { n: 'Lean on them', d: 'Remind them who you are', stat: 'martial' }
  };
  const CLUES = [
    'There was a man in a good cloak. Nobody in that street owns a cloak like that.',
    'It was done at night, and the paper was signed the next morning by somebody who was not there.',
    'Two of the names on it are men who died last winter.',
    'He was paid in new coin, still sharp at the edges, the kind that comes straight from the mint.',
    'They meet every ninth day, and the man who pays always leaves first.',
    'The order came from a house on the Palatine. I never saw whose.'
  ];
  /* the witness is whoever the step names, when it names somebody; otherwise whoever is to hand */
  const WHO = [[/harbour/i, 0], [/slave|household/i, 1], [/veteran|watch|guard|camp|soldier/i, 2], [/clerk|record|scribe|ledger|tabular/i, 3], [/widow|husband|mother|woman/i, 4], [/tavern|alley|subura|wine/i, 5], [/gladiator|ludus/i, 6], [/boat|wharf|river|barge|bridge/i, 7]];
  function question(api, info, done) {
    const said = (info.step.act || '') + ' ' + (info.step.text || ''), m = WHO.find(x => x[0].test(said));
    const S = api.S, w = m ? WIT[m[1]] : pick(WIT), st = k => S.attrs[APPROACH[k].stat] || 0;
    let truth = 8, nerve = 3, round = 0, used = {}, log = ['<p class="trline"><b>' + cap(w.who) + '</b> waits for you to begin. ' + w.tells[0] + '</p>'];
    const next = info.next ? info.next : null;
    const paint = () => {
      const h = [bar('Truth', truth, 'linear-gradient(90deg,#8a6a1c,#f0d47a)'), bar('Nerve', nerve / 3 * 100, 'linear-gradient(90deg,#7a2f2a,#c9483a)'),
        '<div class="trlog">' + log.slice(-4).join('') + '</div>'];
      if (truth >= 85 || nerve <= 0 || round >= 4) {
        const g = truth >= 80 ? 2 : truth >= 45 ? 1 : 0;
        h.push('<p class="trres g' + g + '">' + (g === 2 ? 'You have the whole of it.' : g === 1 ? 'You have enough of it, if not all.' : 'You have almost nothing, and they know it.') + '</p><button class="btn pri" id="trok">Go on ▸</button>');
        api.$('trb').innerHTML = h.join(''); api.$('trok').onclick = () => done(g); return;
      }
      h.push('<div class="trchoices">' + Object.keys(APPROACH).map(k => {
        const a = APPROACH[k], poor = a.cost && S.denarii < a.cost;
        return '<button class="trc" data-k="' + k + '"' + (poor ? ' disabled' : '') + '><b>' + a.n + '</b><span>' + a.d + ' · ' + a.stat + ' ' + st(k) + '</span></button>';
      }).join('') + '</div>');
      api.$('trb').innerHTML = h.join('');
      api.$('trb').querySelectorAll('.trc').forEach(b => b.onclick = () => ask(b.dataset.k));
    };
    const ask = k => {
      const a = APPROACH[k]; round++;
      if (a.cost) { api.applyEff({ denarii: -a.cost }); api.sfx('coin'); } else api.sfx('click');
      const again = used[k]; used[k] = 1;
      let gain, line;
      if (k === w.hates) { gain = -10; nerve--; line = pick(['They close up like a shutter.', 'That was the wrong door to knock on. They look away.', 'Their jaw sets. Whatever they knew is going to stay where it is.']); }
      else if (k === w.likes) { gain = 34 + st(k) * 3; line = pick(['That lands. They lean in.', 'Something gives. They start talking, quickly and low.', 'They look at you properly for the first time.']) + ' “' + pick(CLUES) + '”'; }
      else { gain = 14 + st(k) * 2; line = pick(['They answer, carefully, and not all of it.', 'A little comes out, and they watch to see what you do with it.', 'They give you something, the way you would give a dog a bone to keep it quiet.']); }
      if (again) gain = Math.round(gain * .5);
      truth = clamp(truth + gain, 0, 100);
      log.push('<p class="trline"><i>' + a.n + '.</i> ' + line + '</p>');
      if (k !== w.likes && round === 1) log.push('<p class="trline tell">' + w.tells[1] + '</p>');
      if (truth >= 80 && next) log.push('<p class="trline clue">“If you want the rest, try ' + next + '.”</p>');
      paint();
    };
    frame(api, '🔎 ' + info.title, 'You find ' + w.who + '. ' + (info.step.text || '') + '. Read them, then choose how to ask: the wrong approach costs you their nerve.', '');
    paint();
  }
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);

  /* =========================== 2. a speech: winning a room =========================== */
  const ROOMS = {
    curia: { name: 'the house', w: { senate: .6, people: .15, army: .25 } },
    basilica: { name: 'the court', w: { senate: .45, people: .45, army: .1 } },
    rostra: { name: 'the crowd', w: { senate: .1, people: .7, army: .2 } },
    forum: { name: 'the Forum', w: { senate: .2, people: .65, army: .15 } },
    castra: { name: 'the camp', w: { senate: .05, people: .2, army: .75 } }
  };
  const HECKLE = ['“And who paid for your toga?” somebody shouts from the back.', 'A man in the third row starts laughing at exactly the wrong moment.', '“We have heard this before!” comes from the left, and some of them agree.'];
  function persuade(api, info, done) {
    const S = api.S, room = ROOMS[info.step.at] || ROOMS.forum, ARGS = window.IMP.ARGS;
    const sup = { senate: 32 + (S.rep.senate || 0) / 4, people: 32 + (S.rep.people || 0) / 4, army: 32 + (S.rep.army || 0) / 4 };
    Object.keys(sup).forEach(k => { sup[k] = clamp(sup[k], 15, 55); });
    const cl = Math.min(12, Math.floor(((S.wider && S.wider.clients) || 0) / 5) * 2);  // every five clients in the seats is a head start
    if (cl) Object.keys(sup).forEach(k => { sup[k] += cl; });
    let round = 0, last = null, heckled = false, log = [];
    let hand = shuffle(ARGS).slice(0, 4);
    const total = () => Object.keys(room.w).reduce((a, k) => a + sup[k] * room.w[k], 0);
    const paint = () => {
      const h = ['<div class="trbars">' + bar('Senate', sup.senate, '#6b7fa8') + bar('People', sup.people, '#c9883a') + bar('Army', sup.army, '#a8483a') + '</div>',
        bar('The room is with you', total(), 'linear-gradient(90deg,#8a6a1c,#f0d47a)'), '<div class="trlog">' + log.slice(-3).join('') + '</div>'];
      if (round >= 4) {
        const t = total(), g = t >= 64 ? 2 : t >= 48 ? 1 : 0;
        h.push('<p class="trres g' + g + '">' + (g === 2 ? 'You have them. You can feel it in the silence when you stop.' : g === 1 ? 'Enough of them nod. It will do.' : 'You lose them somewhere in the middle and never get them back.') + '</p><button class="btn pri" id="trok">Step down ▸</button>');
        api.$('trb').innerHTML = h.join(''); api.$('trok').onclick = () => done(g); return;
      }
      if (round >= 2 && !heckled && rnd() < .6) {
        heckled = true;
        h.push('<p class="trline tell">' + pick(HECKLE) + '</p><div class="trchoices"><button class="trc" id="trh1"><b>Turn it on them</b><span>rhetoric ' + (S.attrs.rhetoric || 0) + '</span></button><button class="trc" id="trh2"><b>Ignore it and go on</b><span>gravitas ' + (S.attrs.gravitas || 0) + '</span></button></div>');
        api.$('trb').innerHTML = h.join('');
        const answer = (stat, good) => { const ok = (S.attrs[stat] || 0) + rnd() * 6 >= 7; Object.keys(sup).forEach(k => { sup[k] = clamp(sup[k] + (ok ? good : -5), 0, 100); }); log.push('<p class="trline">' + (ok ? 'The laugh comes back on your side of the room.' : 'It sticks. You can see it sticking.') + '</p>'); api.sfx(ok ? 'crowd' : 'bad'); paint(); };
        api.$('trh1').onclick = () => answer('rhetoric', 8); api.$('trh2').onclick = () => answer('gravitas', 5);
        return;
      }
      h.push('<p class="trq">Round ' + (round + 1) + ' of 4 — choose your argument:</p><div class="trchoices">' + hand.map((a, i) =>
        '<button class="trc" data-i="' + i + '"><b>' + a.n + '</b><span>' + a.d + '</span><span class="trtags">' + a.stat + ' ' + (S.attrs[a.stat] || 0) +
        (a.strong.length ? ' · moves the ' + a.strong.join(', ') : '') + (a.weak.length ? ' · irritates the ' + a.weak.join(', ') : '') + (last === a.id ? ' · <u>they just heard it</u>' : '') + '</span></button>').join('') + '</div>');
      api.$('trb').innerHTML = h.join('');
      api.$('trb').querySelectorAll('.trc').forEach(b => b.onclick = () => play(+b.dataset.i));
    };
    const play = i => {
      const a = hand[i], s = S.attrs[a.stat] || 0, stale = last === a.id ? .4 : 1;
      Object.keys(sup).forEach(k => {
        let d = a.strong.includes(k) ? 12 + s * 1.6 : a.weak.includes(k) ? -7 : 4 + s * .6;
        if (a.id === 'cunning') d = 6 + s * 1.2;
        sup[k] = clamp(sup[k] + d * stale, 0, 100);
      });
      log.push('<p class="trline"><i>' + a.n + '.</i> ' + (stale < 1 ? 'They have heard that one already, and it shows.' : pick(['There is a murmur, and most of it is yours.', 'Heads turn. Some of them nod.', 'You find the line and they follow it.'])) + '</p>');
      api.sfx('click');
      last = a.id; round++;
      hand = shuffle(ARGS).slice(0, 4);
      if (!hand.some(x => x.id === last)) hand[3] = ARGS.find(x => x.id === last);
      paint();
    };
    frame(api, '🗣️ ' + info.title, (info.step.text || '') + '. Four arguments to win ' + room.name + '. Each part of Rome hears them differently, and nobody likes the same point twice.' + (cl ? ' Your clients in the seats give you a head start (+' + cl + ').' : ''), '');
    paint();
  }

  /* =========================== 3. a ledger with something wrong in it =========================== */
  const GOODS = [['modii of grain', 3, 6], ['amphorae of oil', 18, 30], ['coils of rope', 4, 9], ['roof tiles', 1, 3], ['sacks of salt', 5, 11], ['beams of timber', 12, 26], ['bronze lamps', 9, 16], ['jars of fish sauce', 7, 15], ['bolts of linen', 20, 34]];
  const DAYS = ['Kalends', 'Nones', 'Ides', '3rd day before the Kalends', '6th day before the Ides', '4th day before the Nones'];
  function audit(api, info, done) {
    const S = api.S, n = 7, rows = [];
    const bad = shuffle([0, 1, 2, 3, 4, 5, 6]).slice(0, 2);
    for (let i = 0; i < n; i++) {
      const g = pick(GOODS), q = 10 + Math.floor(rnd() * 90), p = g[1] + Math.floor(rnd() * (g[2] - g[1] + 1));
      let t = q * p;
      if (bad.includes(i)) t += (rnd() < .5 ? 1 : -1) * p * (2 + Math.floor(rnd() * 6)) + (rnd() < .4 ? 10 : 0);
      rows.push({ q, g: g[0], p, t, day: pick(DAYS), bad: bad.includes(i), mark: false });
    }
    let oil = 3, sealed = false;
    const keen = (S.attrs.cunning || 0) >= 7 ? bad[0] : -1;               // a sharp eye notices one of them on its own
    const paint = () => {
      const found = rows.filter(r => r.mark && r.bad).length, wrong = rows.filter(r => r.mark && !r.bad).length;
      const h = ['<p class="trq">Mark the entries whose sum is false. Each entry is quantity × price = total. Lamp oil left: <b>' + '🪔'.repeat(Math.max(0, oil)) + '</b></p>',
        '<table class="trled"><tr><th></th><th>Day</th><th>Goods</th><th>Qty</th><th>Price</th><th>Total</th></tr>' + rows.map((r, i) =>
          '<tr data-i="' + i + '" class="' + (r.mark ? 'mk ' : '') + (sealed && r.bad ? 'bad ' : '') + (i === keen && !sealed ? 'keen' : '') + '"><td>' + (r.mark ? '✗' : '') + '</td><td>' + r.day + '</td><td>' + r.g + '</td><td>' + r.q + '</td><td>' + r.p + ' ⚖</td><td><b>' + r.t.toLocaleString() + ' ⚖</b></td></tr>').join('') + '</table>'];
      if (sealed) {
        const g = found === 2 && wrong === 0 ? 2 : found >= 1 ? 1 : 0;
        h.push('<p class="trres g' + g + '">' + (g === 2 ? 'Both false entries, and nothing honest accused. The clerk goes very pale.' : g === 1 ? 'You catch ' + (found === 2 ? 'both, and an honest line with them' : 'one of the two') + '. It is enough to frighten somebody.' : 'The accounts survive you. Somebody is relieved tonight.') + '</p><button class="btn pri" id="trok">Close the books ▸</button>');
        api.$('trb').innerHTML = h.join(''); api.$('trok').onclick = () => done(g); return;
      }
      if (keen >= 0) h.push('<p class="trline tell">Your eye snags on one line before you have even started adding.</p>');
      h.push('<div class="row" style="justify-content:flex-end;margin-top:8px"><button class="btn pri" id="trseal">Seal the audit</button></div>');
      api.$('trb').innerHTML = h.join('');
      api.$('trb').querySelectorAll('tr[data-i]').forEach(tr => tr.onclick = () => {
        const r = rows[+tr.dataset.i];
        if (r.mark) { r.mark = false; paint(); return; }
        if (rows.filter(x => x.mark).length >= 3) return;
        r.mark = true; api.sfx('scroll');
        if (!r.bad) { oil--; if (oil <= 0) sealed = true; }
        if (rows.filter(x => x.mark && x.bad).length === 2) sealed = true;
        paint();
      });
      api.$('trseal').onclick = () => { sealed = true; paint(); };
    };
    frame(api, '📜 ' + info.title, (info.step.text || '') + '. Two entries in this ledger do not add up. Wrong accusations burn your lamp oil.', '');
    paint();
  }

  /* =========================== 4. haggling =========================== */
  const SELLERS = [
    { who: 'a stone merchant from Tibur', ware: 'the stone', base: 420 },
    { who: 'a grain factor', ware: 'the cargo', base: 380 },
    { who: 'a freedman with a ledger and a cough', ware: 'his silence', base: 300 },
    { who: 'a contractor with very clean hands', ware: 'the contract', base: 460 },
    { who: 'an Alexandrian broker', ware: 'the papers', base: 340 }
  ];
  function haggle(api, info, done) {
    const S = api.S, s = pick(SELLERS), ask0 = Math.round(s.base * (.9 + rnd() * .3) / 10) * 10;
    const floor = Math.round(ask0 * (.55 + rnd() * .15) / 10) * 10;
    let ask = ask0, patience = 4 + Math.floor((S.attrs.cunning || 0) / 4), log = [], over = null;
    const offers = () => [Math.round(ask * .6 / 10) * 10, Math.round(ask * .78 / 10) * 10, Math.round(ask * .9 / 10) * 10];
    const finish = price => {
      over = price;
      api.applyEff({ denarii: -Math.min(S.denarii, price) }); api.sfx('coin');
      const g = price <= floor * 1.08 ? 2 : price <= (floor + ask0) / 2 ? 1 : 0;
      api.$('trb').innerHTML = '<div class="trlog">' + log.slice(-3).join('') + '</div><p class="trres g' + g + '">' + (g === 2 ? 'You paid ' + price + ' ⚖ for something he priced at ' + ask0 + '. He will tell his wife it was a good day; it was not.' : g === 1 ? 'You paid ' + price + ' ⚖. Fair, as these things go.' : 'You paid ' + price + ' ⚖, and he did not even try to hide the smile.') + '</p><button class="btn pri" id="trok">Take it ▸</button>';
      api.$('trok').onclick = () => done(g);
    };
    const paint = () => {
      if (over != null) return;
      const h = [bar('His patience', patience / 6 * 100, 'linear-gradient(90deg,#7a2f2a,#c9883a)'), '<p class="trq">' + cap(s.who) + ' wants <b>' + ask + ' ⚖</b> for ' + s.ware + '. You have ' + S.denarii.toLocaleString() + ' ⚖.</p>',
        '<div class="trlog">' + log.slice(-3).join('') + '</div><div class="trchoices">' + offers().map(o => '<button class="trc" data-o="' + o + '"><b>Offer ' + o + ' ⚖</b><span>' + Math.round(o / ask * 100) + '% of his price</span></button>').join('') +
        '<button class="trc" data-o="' + ask + '"><b>Pay ' + ask + ' ⚖</b><span>and be done with it</span></button></div>'];
      api.$('trb').innerHTML = h.join('');
      api.$('trb').querySelectorAll('.trc').forEach(b => b.onclick = () => offer(+b.dataset.o));
    };
    const offer = o => {
      if (o >= ask) return finish(ask);
      if (o >= floor) { log.push('<p class="trline">He sighs like a man being robbed, and takes your hand.</p>'); return finish(o); }
      patience -= o < ask * .7 ? 2 : 1;
      if (patience <= 0) { log.push('<p class="trline tell">“Enough. ' + ask0 + ', or find it somewhere else.” He means it.</p>'); return finish(ask0); }
      ask = Math.max(floor, Math.round((ask - (ask - o) * (.3 + rnd() * .2)) / 10) * 10);
      log.push('<p class="trline">' + pick(['He laughs, not kindly, and comes down to ' + ask + '.', '“My children,” he says, and settles on ' + ask + '.', 'He looks at the ceiling for a long time. ' + ask + '.']) + '</p>');
      api.sfx('click'); paint();
    };
    frame(api, '⚖️ ' + info.title, (info.step.text || '') + '. Every man has a price below which he will not go; find it before his patience runs out.', '');
    paint();
  }

  /* =========================== 5. the auspices =========================== */
  const QUARTERS = [['N', '⬆', 'north'], ['E', '➡', 'east'], ['S', '⬇', 'south'], ['W', '⬅', 'west']];
  function omens(api, info, done) {
    const S = api.S, seqLen = [3, 4, 5];
    let round = 0, seq = [], pos = 0, showing = false, slips = (S.attrs.fides || 0) >= 6 ? 1 : 0, passed = 0, msg = '';
    const paint = () => {
      if (!api.alive()) return;                                    // the panel was closed while the birds were still flying
      const h = ['<p class="trq">Round ' + (round + 1) + ' of 3. ' + (showing ? 'Watch where the birds come from.' : 'Now say it back to the augur, in order.') + (slips ? ' <i>(the gods forgive you one slip)</i>' : '') + '</p>',
        '<div class="trsky">' + QUARTERS.map((q, i) => '<button class="trq' + i + ' trdir" data-d="' + i + '"' + (showing ? ' disabled' : '') + '>' + q[1] + '<span>' + q[2] + '</span></button>').join('') + '<div class="trtemple">🏛️</div></div>',
        '<p class="trline">' + msg + '</p>'];
      api.$('trb').innerHTML = h.join('');
      api.$('trb').querySelectorAll('.trdir').forEach(b => b.onclick = () => press(+b.dataset.d));
    };
    const flash = i => { const b = api.alive() && api.$('trb').querySelector('[data-d="' + i + '"]'); if (b) { b.classList.add('lit'); setTimeout(() => b.classList.remove('lit'), 420); } };
    const show = () => {
      if (!api.alive()) return;
      seq = []; for (let i = 0; i < seqLen[round]; i++) seq.push(Math.floor(rnd() * 4));
      pos = 0; showing = true; msg = ''; paint();
      seq.forEach((d, i) => setTimeout(() => { flash(d); api.sfx('click'); }, 700 + i * 620));
      setTimeout(() => { showing = false; paint(); }, 700 + seq.length * 620);
    };
    const end = () => {
      if (!api.alive()) return;
      const g = passed >= 3 ? 2 : passed >= 2 ? 1 : 0;
      api.$('trb').innerHTML = '<p class="trres g' + g + '">' + (g === 2 ? 'The augur lowers his staff and says the word every Roman wants to hear: favourable.' : g === 1 ? 'The signs are mixed, which the priests say is the commonest answer of all.' : 'The augur looks at you, then at the sky, and says nothing for far too long.') + '</p><button class="btn pri" id="trok">Leave the temple ▸</button>';
      api.$('trok').onclick = () => done(g);
    };
    const press = d => {
      if (showing) return;
      flash(d);
      if (d === seq[pos]) { pos++; if (pos >= seq.length) { passed++; round++; api.sfx('good'); if (round >= 3) return end(); msg = 'The augur nods.'; setTimeout(show, 700); } return; }
      if (slips > 0) { slips--; msg = 'A slip. The augur pretends not to have heard it.'; api.sfx('bad'); paint(); return; }
      round++; api.sfx('bad');
      if (round >= 3) return end();
      msg = 'Wrong quarter. The augur sighs and begins again with a new sign.'; setTimeout(show, 900);
    };
    frame(api, '🕊️ ' + info.title, (info.step.text || '') + '. Birds come from the four quarters of the sky; the augur wants them read back in the order they came.', '');
    show();
  }

  /* =========================== 6. doing it with your feet =========================== */
  const MOVES = {
    default: ['Through the crowd', 'Past the carts', 'Round the corner', 'The last stretch'],
    fire: ['The first bucket line', 'The stairwell', 'The roof next door', 'The last of it'],
    march: ['Break camp', 'The ford', 'The pass', 'Into line'],
    follow: ['Keep him in sight', 'Down the alley', 'Across the square', 'Close the gap']
  };
  function chase(api, info, done) {
    const S = api.S, s = (info.step.act || '') + ' ' + (info.step.text || '');
    const labels = /fire/i.test(s) ? MOVES.fire : /march|cross|line|hill|bridge|harbour/i.test(s) ? MOVES.march : /follow|trail|chase/i.test(s) ? MOVES.follow : MOVES.default;
    let tries = 0, hits = 0, pos = 0, dir = 1, raf = 0, t0 = 0, msg = '';
    const width = () => clamp(26 + (S.attrs.martial || 0) * 2 - tries * 4, 10, 44);
    let zone = 50;
    const paint = () => {
      const h = ['<p class="trq">' + (tries < 4 ? labels[tries] + ' — stop the marker inside the gold.' : '') + ' Done well: <b>' + hits + ' of ' + tries + '</b></p>',
        '<div class="trtrack"><div class="trzone" style="left:' + (zone - width() / 2) + '%;width:' + width() + '%"></div><div class="trneedle" id="trneedle" style="left:' + pos + '%"></div></div>',
        '<p class="trline">' + msg + '</p>', tries < 4 ? '<div class="row" style="justify-content:center"><button class="btn pri big" id="trgo">Now! <span class="kh">Space</span></button></div>' : ''];
      api.$('trb').innerHTML = h.join('');
      const b = api.$('trgo'); if (b) b.onclick = hit;
    };
    const loop = t => {
      if (!t0) t0 = t;
      const dt = Math.min(.05, (t - t0) / 1000); t0 = t;
      pos += dir * dt * (55 + tries * 18);
      if (pos > 100) { pos = 100; dir = -1; } if (pos < 0) { pos = 0; dir = 1; }
      const n = api.$('trneedle'); if (n) n.style.left = pos + '%';
      if (tries < 4) raf = requestAnimationFrame(loop);
    };
    const key = e => { if (e.code === 'Space' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); hit(); } };
    const hit = () => {
      if (tries >= 4) return;
      const ok = Math.abs(pos - zone) <= width() / 2;
      tries++; if (ok) hits++;
      api.sfx(ok ? 'sword' : 'bad');
      msg = ok ? pick(['Clean.', 'Through.', 'Just in time.', 'Nobody saw that but you, and it was good.']) : pick(['A step too late.', 'You stumble, and lose a moment.', 'Not quite.']);
      zone = 15 + rnd() * 70;
      if (tries >= 4) {
        cancelAnimationFrame(raf); document.removeEventListener('keydown', key, true);
        const g = hits >= 3 ? 2 : hits >= 2 ? 1 : 0;
        api.$('trb').innerHTML = '<p class="trres g' + g + '">' + (g === 2 ? 'Done, and done fast, and the men who were watching will talk about it tonight.' : g === 1 ? 'Done, with a scrape or two.' : 'Done, in the end, and not prettily.') + '</p><button class="btn pri" id="trok">Go on ▸</button>';
        api.$('trok').onclick = () => done(g);
        return;
      }
      paint();
    };
    frame(api, '⚡ ' + info.title, (info.step.text || '') + '. Four moments that have to be timed right; the gold gets narrower as you go.', '');
    document.addEventListener('keydown', key, true);
    api.onClose = () => { cancelAnimationFrame(raf); document.removeEventListener('keydown', key, true); };
    paint(); raf = requestAnimationFrame(loop);
  }

  /* ---------------- what the city says afterwards ---------------- */
  const AFTER = {
    question: [['They will remember you as the one who asked the wrong things, which is a kind of reputation.', 'You leave with less than you came for, and the street knows it.'],
      ['You leave with enough of it to go on.', 'It is not the whole story, but stories in this city never are.'],
      ['You leave knowing more than anybody meant you to.', 'By evening the street has decided you are a person it is dangerous to lie to.']],
    persuade: [['They talk about it afterwards, and not the way you hoped.', 'Somewhere a rival is having a very good dinner.'],
      ['It goes your way, narrowly, which is how most things in this city go.', 'The clerks write it down without adjectives.'],
      ['People repeat your best line to each other on the way out.', 'Two men who did not know your name this morning are asking for it now.']],
    audit: [['The books close with the lie still in them.', 'Somebody will sleep well tonight, and it is not you.'],
      ['One false line is enough to make a careful man nervous.', 'The clerk who kept that ledger asks for a week off.'],
      ['Every false line, found and initialled.', 'Word goes round the record office that you can add.']],
    haggle: [['It cost you more than it should have.', 'The man who sold it to you is buying wine for his friends.'],
      ['A fair price, by Roman standards, which are not high.', 'Nobody cheated anybody very much.'],
      ['You got it for a song, and he will not forget the tune.', 'The market hears about it before you are home.']],
    omens: [['The signs were not kind, and the priests made sure everybody knew it.', 'Old women in the Subura make the sign against the evil eye when you pass.'],
      ['The gods give a cautious answer, which is the commonest kind.', 'The priests take their fee either way.'],
      ['The omens were as clean as anybody has seen this year.', 'The crowd at the temple steps begins, quietly, to talk about destiny.']],
    chase: [['You get there, eventually, bruised and late.', 'The men who saw it are kind enough not to mention it.'],
      ['Done, with a scrape or two.', 'Nobody will write a poem about it, which is fine.'],
      ['Fast, clean and in front of witnesses.', 'The veterans in the taverns tell it again that night with improvements.']]
  };
  const after = (kind, g) => AFTER[kind][g];

  /* the whole thing: choose, play, report */
  let serial = 0;
  function run(api, info, done) {
    const token = ++serial;
    api.alive = () => token === serial && !!api.$('trb');          // timers from a trial that has closed do nothing
    const kind = info.kind || kindOf(info.step);
    const finish = g => { if (api.onClose) { try { api.onClose(); } catch (e) { } api.onClose = null; } api.close(); done({ kind, grade: g, house: HOUSE[kind] || (ROOMS[info.step.at] ? Object.keys(ROOMS[info.step.at].w).sort((a, b) => ROOMS[info.step.at].w[b] - ROOMS[info.step.at].w[a])[0] : 'people'), stat: STAT[kind] }); };
    const games = { question, persuade, audit, haggle, omens, chase };
    games[kind](api, info, finish);
    const skip = () => finish(-1);
    const sk = api.$('trskip'); if (sk) sk.onclick = skip;
    const mx = api.$('mx'); if (mx) mx.onclick = skip;           // closing the panel is the same as getting it done
  }
  return { run, kindOf, after };
})();

/* THE MARKET — what your denarii are actually for.

   The Macellum and the Argiletum are where a career is paid for: bread when the street is close to a riot, wine for
   a man whose vote you need, a toga that says you are worth listening to, a doctor, an amulet, a horse. Prices are
   not decoration — they are read out of the Senate's books, so a grain law you carried in the spring makes bread
   cheap in the autumn and a burned granary makes it cruel by the weekend. */
window.SHOP = (() => {
  'use strict';
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  /* price is either fixed or a multiple of the market's grain price, so the whole board moves together */
  const GOODS = [
    { id: 'bread', n: 'Bread and oil', g: '🍞', base: 3, food: true, d: 'A basket of loaves and a jar of oil for the household. The one purchase that always pays.', eff: { health: 1 }, mood: 'the household eats properly for a week' },
    { id: 'wine', n: 'A jar of Falernian', g: '🍷', base: 22, d: 'Good wine, the kind that gets a man to say something he will regret in front of witnesses.', eff: { cunning: 1 }, mood: 'a good evening, and one sentence you will wish had not been said' },
    { id: 'toga', n: 'A new toga', g: '🧵', base: 90, d: 'Clean wool, properly draped, with a border that does not apologise for itself.', eff: { gravitas: 1 }, mood: 'the doorkeepers stand up straighter' },
    { id: 'scroll', n: 'Greek scrolls', g: '📜', base: 70, d: 'Four rolls of Thucydides and a book of speeches, from a shop that knows what it is selling.', eff: { rhetoric: 1 }, mood: 'you have something to quote that nobody else in the house has read' },
    { id: 'amulet', n: 'A household amulet', g: '🕯️', base: 60, d: 'Blessed by a priest who charged twice, and hung where the household gods can see it.', eff: { fides: 1 }, mood: 'the omens are marginally less alarming' },
    { id: 'horse', n: 'A good horse', g: '🐎', base: 240, d: 'Not a racer. A horse that will be where you left it, which is rarer than speed.', eff: { martial: 1 }, mood: 'you arrive at the camp before the men have finished pretending to drill' },
    { id: 'gift', n: 'A gift for a senator', g: '🏺', base: 180, d: 'Silver plate from Campania, wrapped by somebody who understands what the wrapping is for.', rep: 'senate', eff: { senate: 5 }, mood: 'the house is a little warmer towards you, and knows exactly why' },
    { id: 'giftP', n: 'A gift for the ward', g: '🌾', base: 130, d: 'Corn, wine and a small distribution in the street where you were born. Not charity — arithmetic.', rep: 'people', eff: { people: 6 }, mood: 'the alley says your name without irony for once' },
    { id: 'giftA', n: 'A purse for the camp', g: '🛡️', base: 200, d: 'Coin sent to the camp with no name on it, which is the only kind soldiers trust.', rep: 'army', eff: { army: 6 }, mood: 'the Tenth drinks your health and cannot spell it' },
    { id: 'doctor', n: 'A physician', g: '⚕️', base: 160, d: 'A Greek who has read Hippocrates and will tell you things you do not want to hear about your sleep.', eff: { health: 2 }, mood: 'you sleep, and wake up without the ache in your shoulder' },
    { id: 'feast', n: 'A dinner for nine', g: '🍽️', base: 320, d: 'Nine couches, a cook worth more than a tribune, and the sort of evening that ends with three men owing you something.', eff: { auctoritas: 14 }, mood: 'three senators leave your house friends and one leaves an enemy, which is a good night in Rome' }
  ];

  /* the board, priced for this morning */
  function board(S) {
    const m = window.SENATE ? window.SENATE.market(S) : { bread: 8, stress: 0 };
    const factor = clamp(m.bread / 8, .4, 2.6);
    return GOODS.map(gd => ({
      ...gd,
      price: Math.max(1, Math.round(gd.food ? gd.base * factor * 2 : gd.base * (1 + (factor - 1) * .18)))
    }));
  }

  function buy(g, id) {
    const S = g.S;
    if (!S.inv) S.inv = {};
    const gd = board(S).find(x => x.id === id);
    if (!gd) return;
    if ((S.denarii || 0) < gd.price) return g.toast('You cannot afford it', gd.n + ' is ' + gd.price + ' denarii and you have ' + Math.floor(S.denarii), 'bad');
    S.denarii -= gd.price;
    S.inv[id] = (S.inv[id] || 0) + 1;
    if (gd.eff) {
      const a = {};
      Object.keys(gd.eff).forEach(k => {
        const v = gd.eff[k];
        if (['health', 'gravitas', 'rhetoric', 'martial', 'cunning', 'fides'].includes(k)) a[k === 'health' ? 'health' : k] = v;
        else a[k] = v;
      });
      /* attributes and health move through the same door the rest of the game uses */
      const attrs = {};
      ['health', 'gravitas', 'rhetoric', 'martial', 'cunning', 'fides'].forEach(k => { if (a[k]) attrs[k] = a[k]; });
      if (Object.keys(attrs).length) g.applyEff({ attrs });
      const rep = {};
      ['senate', 'people', 'army'].forEach(k => { if (a[k]) rep[k] = a[k]; });
      if (Object.keys(rep).length) g.applyEff({ rep });
      if (a.auctoritas) g.applyEff({ auctoritas: a.auctoritas });
    }
    g.toast(gd.n, gd.price + ' denarii — ' + gd.mood, 'coin');
    g.sfx('coin'); g.hud(); g.save(true);
    open(g);
  }

  function open(g) {
    const S = g.S;
    const b = board(S);
    const m = window.SENATE ? window.SENATE.market(S) : { bread: 8, stress: 0, mood: 'fair' };
    const h = '<div class="market">' +
      '<div class="mrow"><div class="mp"><b>' + m.bread + '</b><span>asses for a modius of grain</span></div>' +
      '<div class="mp"><b>' + (m.mood === 'dear' ? 'dear' : m.mood === 'cheap' ? 'cheap' : 'fair') + '</b><span>the market this morning</span></div>' +
      '<div class="mp"><b>' + Math.round(S.denarii).toLocaleString() + ' ⚖</b><span>in your purse</span></div></div>' +
      '<p class="mute small">Prices follow the city, not the shopkeeper. Pass a grain law and watch this board change by the end of the week.</p>' +
      '<div class="goods">' + b.map(x => '<button class="good" data-buy="' + x.id + '"><div class="gico">' + x.g + '</div>' +
        '<div class="gbod"><b>' + g.text(x.n) + '</b><span>' + g.text(x.d) + '</span>' +
        '<i>' + (S.inv && S.inv[x.id] ? 'you have ' + S.inv[x.id] + ' · ' : '') + (x.eff ? Object.keys(x.eff).map(k => '+' + x.eff[k] + ' ' + k).join(' · ') : '') + '</i></div>' +
        '<div class="gprice">' + x.price + ' ⚖</div></button>').join('') + '</div>' +
      '<div class="row" style="justify-content:flex-end"><button class="btn" id="mclose">Leave the market</button></div></div>';
    g.modal('🏺 The Macellum', h, true);
    document.getElementById('mclose').onclick = () => g.close();
    document.querySelectorAll('#modal [data-buy]').forEach(el => el.onclick = () => buy(g, el.dataset.buy));
  }

  return { GOODS, board, open, buy };
})();

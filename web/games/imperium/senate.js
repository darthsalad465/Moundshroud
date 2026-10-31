/* SENATE — the floor of the house.

   Everything here is one idea taken seriously: you write the law yourself. Pick the subject, pick where the money
   comes from, pick the clauses, name it — then walk onto the floor and get three hundred men to agree with you.

   Three things make it a system rather than a menu:
     1. The bill is assembled from real parts (sixteen subjects, six ways of paying, nine clauses), and the parts
        push against each other. Free bread is easy to promise and impossible to fund; a hard enforcement clause
        makes the law bite and makes the house hate it; a sunset clause buys you votes by promising to go away.
     2. The debate is fought in blocs. The Optimates, the Populares, the Undecided and the Soldiers' Men each hold
        seats and each listen to different arguments. You have three rounds, one argument each, and an objector
        who stands up after every one of them.
     3. What passes, stays passed. Laws change the price of bread in the market, the temper of the street, the
        morale of your legions and the money in the treasury — every day, for the rest of the career. */
window.SENATE = (() => {
  'use strict';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const r1 = n => Math.round(n * 10) / 10;

  /* ============================ the state of Rome ============================ */
  /* One object holds the things a law can actually move. Everything else in the game reads it. */
  const INIT = () => ({
    treasury: 3200,       // the aerarium: what the state has in the box this morning
    harvest: 0,           // the year's luck with the weather, rolled each day
    unrest: 18,           // the temper of the street, 0..100
    tax: 0,               // the luxury tax, in per-cent
    debt: 0,              // what Crassus is owed, and what he charges for it
    laws: [],             // the lawbook
    log: [],              // the fasti: what passed, by how many votes, on what day
    n: 1                  // the counter that gives each law its own identity
  });
  function init(S) {
    if (!S.pol || typeof S.pol.treasury !== 'number') S.pol = INIT();
    if (!Array.isArray(S.pol.laws)) S.pol.laws = [];
    if (!Array.isArray(S.pol.log)) S.pol.log = [];
    return S.pol;
  }

  /* the numbers the rest of the game asks for: the price of bread, the mood of the street, the morale of the
     legions, the money the state takes in each morning */
  function eff(S) {
    const p = init(S);
    let grain = 0, income = 0, morale = 0, unrest = 0, drift = { senate: 0, people: 0, army: 0 }, power = 0;
    p.laws.forEach(l => {
      grain += l.daily.grain || 0;
      income += l.daily.income || 0;
      morale += l.daily.morale || 0;
      unrest += l.daily.unrest || 0;
      drift.senate += (l.drift && l.drift.senate) || 0;
      drift.people += (l.drift && l.drift.people) || 0;
      drift.army += (l.drift && l.drift.army) || 0;
      power += l.power || 0;
    });
    /* bread: eight asses is the calm price. A flooded market or an angry street moves it more than any law can. */
    const bread = r1(clamp(8 - grain * .22 + p.harvest * .3 + (p.unrest - 20) * .06, 2.5, 24));
    /* the interest on borrowed votes, which Crassus calculates to the half-as */
    const interest = r1(p.debt * .0055);
    return {
      bread, grain, income: Math.round(income - interest), morale: Math.round(clamp(morale, -12, 16)),
      unrest: clamp(unrest, -30, 30), drift, power, interest, treasury: p.treasury, debt: p.debt
    };
  }

  /* ============================ the parts of a law ============================ */
  /* A subject carries: what it does (daily), what it costs now (cost), who it pleases (rep), who it angers, and
     how much the house resists it (res, 0..4). Radical laws are stronger and much harder to pass. */
  const SUBJECTS = [
    {
      id: 'frumentaria', n: 'The grain dole', latin: 'frumentaria', g: '🌾', res: 1, tags: ['people'],
      d: 'A monthly ration of grain, sold under cost to every citizen on the roll. The oldest bribe in politics and the only one the poor can eat.',
      blurb: 'Cheap bread, expensive votes.',
      cost: 700, daily: { grain: 7, income: -3, unrest: -1.1 }, rep: { people: 12, senate: -5 },
      drift: { people: .12, senate: -.02 }, appeal: { populares: .22, optimates: -.14, neutrals: .1, veterans: 0 }
    },
    {
      id: 'agraria', n: 'The land law', latin: 'agraria', g: '🌿', res: 3, tags: ['people', 'army'],
      d: 'Public land held by eleven families, broken up and given to citizens with no land and to veterans with no farm. The most dangerous sentence in Roman politics.',
      blurb: 'Give the land back. Make eleven enemies.',
      cost: 600, daily: { grain: 5, income: -2, unrest: -1.6, morale: 2 }, rep: { people: 12, army: 9, senate: -12 },
      drift: { people: .1, army: .06, senate: -.06 }, appeal: { populares: .2, optimates: -.32, neutrals: .04, veterans: .2 }
    },
    {
      id: 'civitate', n: 'Citizenship beyond the Po', latin: 'de civitate', g: '🪪', res: 3, tags: ['people', 'army'],
      d: 'The full vote for the Latin towns beyond the Po. They have bled in your legions for a generation and asked politely; Crassus tried to enrol them as censor and was stopped by his own colleague.',
      blurb: 'A hundred thousand new voters, none of whom know your name yet.',
      cost: 500, daily: { income: 4, unrest: -.8, morale: 3 }, rep: { army: 10, people: 8, senate: -14 },
      drift: { army: .08, people: .05, senate: -.05 }, appeal: { populares: .18, optimates: -.3, neutrals: .08, veterans: .16 }
    },
    {
      id: 'ambitu', n: 'The bribery courts', latin: 'de ambitu', g: '⚖️', res: 1, tags: ['senate'],
      d: 'A permanent court for electoral corruption, with heavy fines and exile for the second offence. Half the house has committed it twice; the other half intends to.',
      blurb: 'A law that makes your rivals illegal.',
      cost: 200, daily: { income: 3, unrest: -.5 }, rep: { people: 7, senate: 4 },
      drift: { senate: .05, people: .03 }, appeal: { populares: .1, optimates: -.04, neutrals: .14, veterans: 0 }
    },
    {
      id: 'pecunia', n: 'The audit', latin: 'de pecunia', g: '🧾', res: 1, tags: ['money'],
      d: 'An audit of every public contract of the last ten years, with the accounts read aloud in the Forum. Someone will hang, and it will not be you.',
      blurb: 'Follow the money. Publicly.',
      cost: 150, daily: { income: 11, unrest: .4 }, rep: { people: 6, senate: -7 },
      drift: { senate: -.03 }, appeal: { populares: .16, optimates: -.16, neutrals: .1, veterans: 0 }
    },
    {
      id: 'aquis', n: 'The water', latin: 'de aquis', g: '💧', res: 0, tags: ['people'],
      d: 'A new aqueduct from the hills, public fountains in every ward, and a curator who answers to the aedile rather than to the contractors.',
      blurb: 'Nobody votes against water.',
      cost: 900, daily: { grain: 2, unrest: -1.3 }, rep: { people: 10, senate: 2, army: 2 },
      drift: { people: .07 }, appeal: { populares: .18, optimates: .04, neutrals: .22, veterans: .04 }
    },
    {
      id: 'viaria', n: 'The roads', latin: 'viaria', g: '🛣️', res: 0, tags: ['army', 'money'],
      d: 'Milestones, bridges, and a road surface that a wagon can cross in winter. Legions move on roads; so does grain; so does news, which is the dangerous part.',
      blurb: 'Fast legions, fast money, fast rumour.',
      cost: 800, daily: { income: 8, morale: 2 }, rep: { army: 8, senate: 4, people: 3 },
      drift: { army: .05 }, appeal: { populares: .04, optimates: .12, neutrals: .16, veterans: .1 }
    },
    {
      id: 'sumptuaria', n: 'The sumptuary law', latin: 'sumptuaria', g: '🍷', res: 2, tags: ['senate', 'money'],
      d: 'A cap on what a senator may spend on a dinner: no more than three kinds of bird, no purple, no gold plate at a private table. Cato has wanted this for years.',
      blurb: 'Tell rich men what to eat. Watch what happens.',
      cost: 100, daily: { income: 5, unrest: -.3 }, rep: { people: 7, senate: -3 },
      drift: { senate: -.03, people: .05 }, appeal: { populares: .14, optimates: -.08, neutrals: .06, veterans: .04 }
    },
    {
      id: 'imperio', n: 'A command for you', latin: 'de imperio', g: '🦅', res: 2, tags: ['army'],
      d: 'A province, two legions, and the right to raise more, for five years, with nobody in the house allowed to ask what you are doing there.',
      blurb: 'The law that makes you dangerous.',
      cost: 400, daily: { income: 3, morale: 4 }, rep: { army: 12, senate: -8 },
      drift: { army: .09, senate: -.04 }, appeal: { populares: .02, optimates: -.2, neutrals: -.02, veterans: .26 }
    },
    {
      id: 'tabellaria', n: 'The secret ballot', latin: 'tabellaria', g: '🗳️', res: 2, tags: ['people'],
      d: 'A written ballot in every assembly, counted by the clerks instead of watched by the great men standing at the front. The most quietly revolutionary thing in the Republic.',
      blurb: 'Let the poor vote without being seen doing it.',
      cost: 150, daily: { unrest: -.9 }, rep: { people: 12, senate: -9 },
      drift: { people: .1, senate: -.04 }, appeal: { populares: .24, optimates: -.22, neutrals: .04, veterans: .02 }
    },
    {
      id: 'veteranis', n: 'The veterans’ settlement', latin: 'de veteranis', g: '🛡️', res: 2, tags: ['army'],
      d: 'Land, a discharge bonus, and a farm in a province for every man who has served his twenty-five years. The army has been promised this by four generals and given it by none.',
      blurb: 'Pay the men. Own the army.',
      cost: 1100, daily: { grain: 3, income: -4, morale: 5 }, rep: { army: 16, people: 5, senate: -7 },
      drift: { army: .12, senate: -.03 }, appeal: { populares: .08, optimates: -.12, neutrals: .04, veterans: .34 }
    },
    {
      id: 'annonae', n: 'The grain commission', latin: 'annonae', g: '⚓', res: 1, tags: ['people', 'money'],
      d: 'A standing commission with a fleet of its own and a budget it does not have to explain, to keep the city nine days from hunger at all times.',
      blurb: 'Buy the fleet. Never be blamed for a famine.',
      cost: 1000, daily: { grain: 9, income: -2, unrest: -1.4 }, rep: { people: 11, senate: -4 },
      drift: { people: .1 }, appeal: { populares: .2, optimates: -.06, neutrals: .12, veterans: 0 }
    },
    {
      id: 'maiestate', n: 'The treason law', latin: 'de maiestate', g: '🗡️', res: 3, tags: ['senate'],
      d: 'An offence against the majesty of the Roman people, defined broadly enough to fit any man who annoys the house, and tried in a court the house controls.',
      blurb: 'A weapon. Whichever hand holds it.',
      cost: 250, daily: { unrest: .9, income: 4 }, rep: { senate: 10, people: -10 },
      drift: { senate: .1, people: -.1 }, appeal: { populares: -.24, optimates: .22, neutrals: -.06, veterans: .02 }
    },
    {
      id: 'usuris', n: 'The debt law', latin: 'de usuris', g: '💰', res: 4, tags: ['people', 'money'],
      d: 'A cap on interest, a cancellation of a third of every debt, and a year’s grace for those who owe it. Every debtor in Italy will know whose name is on this.',
      blurb: 'The most popular law ever written. Also the most fatal.',
      cost: 0, daily: { income: -9, unrest: -2.2 }, rep: { people: 18, senate: -18, army: 4 },
      drift: { people: .14, senate: -.08 }, appeal: { populares: .3, optimates: -.4, neutrals: -.04, veterans: .04 }
    },
    {
      id: 'iudiciis', n: 'The jury law', latin: 'iudiciis', g: '🏛️', res: 2, tags: ['senate', 'money'],
      d: 'Juries drawn from the equestrians as well as the Senate, so that a senator can no longer be tried only by men who owe him money.',
      blurb: 'Take the courts off the Senate. Hand them to the men who lend to it.',
      cost: 200, daily: { income: 3, unrest: -.5 }, rep: { people: 8, senate: -10 },
      drift: { senate: -.05, people: .05 }, appeal: { populares: .16, optimates: -.26, neutrals: .1, veterans: 0 }
    },
    {
      id: 'coloniis', n: 'The colonies', latin: 'de coloniis', g: '⛵', res: 1, tags: ['people', 'army'],
      d: 'Six thousand citizens settled abroad with a wall, a well and a plot. Rome exports its poorest and calls it an honour, which is how an empire is built.',
      blurb: 'Empty the alley, fill the province.',
      cost: 700, daily: { income: 9, grain: 2, unrest: -.7 }, rep: { people: 7, army: 5, senate: 2 },
      drift: { people: .05, army: .04 }, appeal: { populares: .12, optimates: .08, neutrals: .14, veterans: .1 }
    }
  ];

  /* Where the money comes from. Every funding choice is a trade: the treasury can pay and cannot afford it, a tax
     pays and costs you the house, a loan pays now and follows you around for years. */
  const FUNDING = [
    { id: 'treasury', n: 'The treasury', g: '🏦', d: 'Pay for it out of the aerarium. Honest, and the box is never as full as the clerks pretend.', senateMod: 0, pay: 1.0, income: 0, note: 'No new money. The box pays.' },
    { id: 'land', n: 'A tax on land', g: '🌾', d: 'One part in twenty on the assessed value of Italian land. The great families will feel it and will remember the name on it.', senateMod: -6, pay: .7, income: 9, note: 'Cheaper for you. The landowners pay, and they vote.' },
    { id: 'luxury', n: 'A tax on luxury', g: '🍷', d: 'Purple, incense, silver plate, imported birds and anything a man might be embarrassed to be seen wanting. The crowd loves it; the rich call it theft.', senateMod: -8, pay: .55, income: 11, note: 'Popular. Expensive to defend in the house.' },
    { id: 'loan', n: 'Borrow from Crassus', g: '💰', d: 'He will lend without a word of complaint and charge interest by the half-as. He is not being generous; he is buying a share.', senateMod: -2, pay: 0, income: 0, debt: 1.15, note: 'Nothing today. Interest every day after.' },
    { id: 'confiscate', n: 'Confiscate an estate', g: '⚔️', d: 'Declare one of your rivals an enemy of the state and sell his house. The money is there by the afternoon and the precedent is there forever.', senateMod: -11, pay: 0, income: 5, unrest: .5, note: 'Free, fast, and it teaches the house a lesson it will use on you.' },
    { id: 'tribute', n: 'Provincial tribute', g: '🏺', d: 'Raise the assessment on the provinces by a third. The money is real, the resentment is distant, and both of those are temporary.', senateMod: -5, pay: .4, income: 13, morale: -2, note: 'Distant money, distant anger — for now.' }
  ];

  /* The clauses. Small words with large consequences; each one buys votes or buys strength, never both. */
  const CLAUSES = [
    { id: 'sunset', n: 'A sunset clause', g: '🌇', d: 'The law lapses after five years unless the house renews it.', senate: 5, power: -.22, cost: 0, appeal: { optimates: .1 } },
    { id: 'exempt', n: 'Exempt the allied towns', g: '🕊️', d: 'Italy outside Rome keeps its own arrangements. Half the sting, half the benefit.', senate: 4, power: -.16, cost: 0, appeal: { optimates: .08, populares: -.06 } },
    { id: 'courts', n: 'Enforce it in the courts', g: '⚖️', d: 'A standing court with a staff and a budget, so the law is not merely a hope.', senate: -3, power: .16, cost: 200, appeal: { neutrals: .08 } },
    { id: 'dole', n: 'Add a dole rider', g: '🍞', d: 'A monthly corn allowance to every citizen on the list, paid out of the same purse.', senate: -2, power: .1, cost: 350, people: 7, appeal: { populares: .12, optimates: -.06 } },
    { id: 'readings', n: 'Read it aloud each market day', g: '📣', d: 'Proclaimed in the Forum every ninth day by a herald you pay. Nobody can say afterwards they did not know.', senate: 1, power: .06, cost: 120, auctoritas: 8, people: 4, appeal: { populares: .1, neutrals: .06 } },
    { id: 'commission', n: 'A commission chaired by you', g: '🪑', d: 'You, five clerks and the power to decide what the law means. The most valuable sentence in the whole text.', senate: -4, power: .2, cost: 150, auctoritas: 12, appeal: { optimates: -.1, veterany: 0 } },
    { id: 'capital', n: 'Death for those who evade it', g: '☠️', d: 'The penalty is capital and the appeal is to the people, which in practice means no appeal.', senate: -7, power: .28, cost: 0, unrest: .6, appeal: { populares: .08, optimates: -.18 } },
    { id: 'sacred', n: 'Bind it with a religious sanction', g: '🕯️', d: 'Sworn before the Vestals and enrolled among the sacred laws. To break it is not a crime, it is a pollution.', senate: 2, power: .12, cost: 90, appeal: { neutrals: .14, populares: .04 } },
    { id: 'army', n: 'Exempt the army from its costs', g: '🛡️', d: 'Soldiers and veterans pay nothing under this law. They will hear about it before the ink is dry.', senate: -1, power: .05, cost: 0, morale: 3, appeal: { veterans: .16, populares: .04 } }
  ];

  /* ============================ the house ============================ */
  /* Three hundred men who do not agree with each other. The seats are fixed; where they stand is not. */
  const BLOCS = [
    { id: 'optimates', n: 'The Optimates', lead: 'cato', seats: 112, col: '#6d7291', note: 'old names, old money, and a horror of anything new' },
    { id: 'populares', n: 'The Populares', lead: 'cicero', seats: 74, col: '#b0813c', note: 'the men who stand for the crowd because it is standing there' },
    { id: 'neutrals', n: 'The Undecided', lead: 'vatinius', seats: 58, col: '#7d7666', note: 'they will vote for whichever side is counting loudest' },
    { id: 'veterans', n: 'The Soldiers’ Men', lead: 'marius', seats: 56, col: '#8d4331', note: 'men whose brothers are in the legions and whose pension is not' }
  ];
  const SEATS = BLOCS.reduce((a, b) => a + b.seats, 0);

  const ARGS = [
    { id: 'ancestors', n: 'Appeal to the ancestors', g: '🏛️', stat: 'gravitas', d: 'The mos maiorum. Rome has always done it this way and Rome is still here.', w: { optimates: .20, neutrals: .08, populares: -.07, veterans: .02 } },
    { id: 'people', n: 'Appeal to the people', g: '👥', stat: 'rhetoric', d: 'Name the men in the street by their trades and tell the house what they will do if this fails.', w: { populares: .24, neutrals: .10, optimates: -.10, veterans: .04 } },
    { id: 'legions', n: 'Appeal to the legions', g: '⚔️', stat: 'martial', d: 'The army is the Republic, and the Republic has never once pretended otherwise.', w: { veterans: .28, neutrals: .04, optimates: -.08, populares: -.02 } },
    { id: 'law', n: 'Read the law and the record', g: '📜', stat: 'rhetoric', d: 'Cite the statute, the year, and the two precedents that make this motion unremarkable.', w: { optimates: .16, neutrals: .12, populares: .02, veterans: -.02 } },
    { id: 'gods', n: 'Invoke the gods', g: '🕯️', stat: 'fides', d: 'The omens, the rites, and the safety of the state. Nobody wants to be the man who voted against the gods.', w: { neutrals: .18, populares: .08, optimates: .04, veterans: .06 } },
    { id: 'accuse', n: 'Turn it into an accusation', g: '🗡️', stat: 'cunning', d: 'Do not defend the bill. Stand up and ask aloud why the last man who opposed it was so very rich.', w: { populares: .12, neutrals: .06, optimates: -.14, veterans: .02 } },
    { id: 'purse', n: 'Open your purse', g: '💰', stat: 'cunning', d: 'A distribution of coin, quietly, to the men who are undecided and the men who are never undecided but are expensive.', w: { neutrals: .30, optimates: .06, populares: .04, veterans: .06 }, bribe: true },
    { id: 'threat', n: 'Remind them who is outside', g: '🔥', stat: 'martial', d: 'There are nine thousand men in the Forum who came to hear this bill. Say their number out loud and let the house do the arithmetic.', w: { veterany: 0, veterans: .22, populares: .14, optimates: -.18, neutrals: .10 }, threat: true }
  ];

  /* The objections. One senator stands after every argument, and what he says depends on what the bill is about. */
  const OBJECTIONS = [
    { who: 'cato', tag: 'money', line: 'And who pays for this? I have read the accounts. You have not. The treasury is a promise the state has already spent.' },
    { who: 'cato', tag: 'people', line: 'You are buying the crowd with the city’s own money. That is not generosity, it is a fire you are lighting in a granary.' },
    { who: 'cato', tag: 'senate', line: 'This is not a law. It is a list of men you would like to see ruined, written in the language of the Republic.' },
    { who: 'cato', tag: 'army', line: 'A general with a law of his own is not a magistrate. He is a king who has not yet found the word for it.' },
    { who: 'vatinius', tag: 'money', line: 'My dear colleague — and I say this as a friend — the arithmetic in this bill is a work of imagination. A beautiful one. Would you read the fourth line aloud?' },
    { who: 'vatinius', tag: 'people', line: 'The crowd will cheer anything with bread in it, and next month they will cheer the man who takes the bread away again. You know this. Why pretend?' },
    { who: 'vatinius', tag: 'senate', line: 'I support the principle entirely. I merely wonder why every clause names a man who happens to have opposed you.' },
    { who: 'vatinius', tag: 'army', line: 'The legions are not a constituency. The moment they become one, the elections are held in a camp and the camp has better swords than the Forum.' },
    { who: 'crassus', tag: 'money', line: 'I will not oppose the bill. I will merely observe that a state which cannot pay its debts will find that very few people lend to it again.' },
    { who: 'crassus', tag: 'senate', line: 'You are spending a great deal of other men’s property today. I hope you have thought about what happens when the men are no longer other.' },
    { who: 'crassus', tag: 'people', line: 'There is no such thing as free grain. There is only grain somebody has already agreed to pay for, and he is sitting behind you looking pleased.' },
    { who: 'cicero', tag: 'senate', line: 'The house is asked to decide this in one afternoon, on the word of one man, with the doors open and a crowd outside. That is not law-making. That is a siege.' },
    { who: 'cicero', tag: 'money', line: 'I have no objection to the purpose. I object to the drafting, which is so loose that any magistrate after you could drive a wagon through it.' },
    { who: 'cicero', tag: 'army', line: 'Rome has survived ambitious men before. It has survived them by making them argue in this room, and you are proposing to let them stop.' },
    { who: 'pullo', tag: 'army', line: 'I have stood in the line, senator, and I will tell you what the men say about laws: nothing. They say it about pay.' },
    { who: 'aurelia', tag: 'people', line: 'The fire has burned low twice this month. I am not saying the gods are angry. I am saying that when a city promises what it cannot deliver, something always goes out.' },
    { who: 'aurelia', tag: 'money', line: 'You may swear this on the altar if you like. Understand that the oath is not a decoration, and the goddess does not accept a second draft.' },
    { who: 'aurelia', tag: 'senate', line: 'Every man in this room has sworn an oath to the Republic. You are asking them to swear another, to you, in the same voice and on the same stone.' }
  ];

  /* ============================ assembling the bill ============================ */
  function build(d, S) {
    const sub = SUBJECTS.find(s => s.id === d.subject);
    if (!sub) return null;
    const fund = FUNDING.find(f => f.id === d.funding) || FUNDING[0];
    const cls = CLAUSES.filter(c => (d.clauses || []).includes(c.id));
    let power = 1 + (cls.reduce((a, c) => a + (c.power || 0), 0));
    power = clamp(power, .5, 1.9);
    /* what the bill costs, out of the treasury, or out of Crassus */
    let cost = Math.round((sub.cost || 0) * fund.pay + cls.reduce((a, c) => a + (c.cost || 0), 0));
    const daily = {
      grain: (sub.daily.grain || 0) * power,
      income: (sub.daily.income || 0) * power + (fund.income || 0),
      morale: (sub.daily.morale || 0) * power + (fund.morale || 0) + (cls.some(c => c.id === 'army') ? 3 : 0),
      unrest: (sub.daily.unrest || 0) * power + (fund.unrest || 0) + (cls.some(c => c.id === 'capital') ? .5 : 0)
    };
    const rep = {
      senate: (sub.rep.senate || 0) + fund.senateMod + cls.reduce((a, c) => a + (c.senate || 0), 0),
      people: (sub.rep.people || 0) + cls.reduce((a, c) => a + (c.people || 0), 0),
      army: (sub.rep.army || 0) + (sub.id === 'veteranis' ? 2 : 0)
    };
    /* how much the house resists it before a word is spoken */
    const appeal = { optimates: 0, populares: 0, neutrals: 0, veterans: 0 };
    Object.keys(appeal).forEach(k => { appeal[k] = (sub.appeal[k] || 0); });
    cls.forEach(c => { Object.keys(c.appeal || {}).forEach(k => { if (k in appeal) appeal[k] += c.appeal[k]; }); });
    appeal.optimates -= (sub.res - 1) * .06;
    appeal.optimates += fund.senateMod * .012;
    appeal.veterans += (fund.morale || 0) * .02;
    const auctoritas = 6 + Math.round((sub.res + (sub.eventful ? 0 : 0)) * 2) + cls.reduce((a, c) => a + (c.auctoritas || 0), 0);
    return {
      id: 'lex' + (init(S).n++), subject: sub.id, sub, funding: fund.id, fund, clauses: cls.map(c => c.id), cls,
      title: d.title, power, cost, daily, rep, appeal, auctoritas,
      passedDay: S.day, votes: null, struck: null
    };
  }

  /* the public face of a law: an English name and a Latin one */
  function autoTitle(d, S) {
    const sub = SUBJECTS.find(s => s.id === d.subject);
    if (!sub) return '';
    const stem = (S.name || 'Gaius').split(' ').pop().replace(/[^A-Za-z]/g, '');
    const gentile = stem.length > 3 ? stem.slice(0, -2) + 'ia' : stem + 'ia';
    const latin = 'Lex ' + gentile + ' ' + sub.latin;
    const plain = sub.n.replace(/^the /i, '').toLowerCase();
    return latin + ' — the ' + plain;
  }

  /* ============================ the workshop ============================ */
  /* Four pages: the subject, the purse, the clauses, the seal. Each re-renders with the projection at the bottom so
     you can see what the bill will actually do before you take it into the house. */
  function draft(g) {
    const S = g.S;
    init(S);
    const d = { step: 1, subject: null, funding: 'treasury', clauses: [], title: '' };
    const paint = () => {
      const body = [];
      body.push('<div class="lgsteps">' + ['The matter', 'The purse', 'The clauses', 'The seal'].map((n, i) =>
        '<span class="' + (d.step === i + 1 ? 'on' : d.step > i + 1 ? 'done' : '') + '">' + (d.step > i + 1 ? '✔ ' : '') + (i + 1) + '. ' + n + '</span>').join('') + '</div>');

      if (d.step === 1) {
        body.push('<p class="mute">Every law in Rome began as one man deciding what was wrong. Pick the thing you intend to fix.</p><div class="subjects">');
        SUBJECTS.forEach(s => body.push('<button class="subj' + (d.subject === s.id ? ' on' : '') + '" data-s="' + s.id + '"><b>' + s.g + ' ' + esc(s.n) + '</b><span>' + esc(s.blurb) + '</span><i>' + esc(s.d) + '</i><div class="subjtag">' + s.tags.map(t => '<em>' + t + '</em>').join('') + '<u>resistance ' + '●'.repeat(s.res) + '○'.repeat(Math.max(0, 5 - s.res)) + '</u></div></button>'));
        body.push('</div>');
      }

      if (d.step === 2) {
        const sub = SUBJECTS.find(s => s.id === d.subject);
        body.push('<p class="mute">' + esc(sub.n) + ' will cost about <b>' + Math.round(sub.cost * .8) + '–' + sub.cost + ' denarii</b> to put into effect. The house will want to know whose money it is.</p><div class="subjects two">');
        FUNDING.forEach(f => {
          const short = f.pay ? Math.round(sub.cost * f.pay) : 0;
          body.push('<button class="subj' + (d.funding === f.id ? ' on' : '') + '" data-f="' + f.id + '"><b>' + f.g + ' ' + esc(f.n) + '</b><span>' + esc(f.d) + '</span><i>' + esc(f.note) + '</i><div class="subjtag"><em>' + (f.pay ? short + ' ⚖ now' : 'nothing now') + '</em>' + (f.income ? '<em>+' + f.income + ' ⚖ a day</em>' : '') + (f.senateMod ? '<em class="bad">' + f.senateMod + ' in the house</em>' : '') + '</div></button>');
        });
        body.push('</div><p class="mute small">Treasury today: <b>' + S.pol.treasury.toLocaleString() + ' ⚖</b>' + (S.pol.debt ? ' · owed to Crassus: <b>' + Math.round(S.pol.debt).toLocaleString() + ' ⚖</b>' : '') + '</p>');
      }

      if (d.step === 3) {
        body.push('<p class="mute">Small words, large consequences. Every clause you add makes the law stronger or the house angrier — usually both.</p><div class="clauses">');
        CLAUSES.forEach(c => {
          const on = d.clauses.includes(c.id);
          const good = (c.power || 0) > 0 ? '+' + Math.round(c.power * 100) + '% bite' : Math.round((c.power || 0) * 100) + '% bite';
          body.push('<button class="clause' + (on ? ' on' : '') + '" data-c="' + c.id + '"><b>' + c.g + ' ' + esc(c.n) + '</b><span>' + esc(c.d) + '</span><div class="subjtag"><em>' + good + '</em>' + (c.cost ? '<em>' + c.cost + ' ⚖</em>' : '') + (c.senate ? '<em class="' + (c.senate < 0 ? 'bad' : 'good') + '">' + (c.senate > 0 ? '+' : '') + c.senate + ' in the house</em>' : '') + '</div></button>');
        });
        body.push('</div>');
      }

      if (d.step === 4) {
        const b = build(Object.assign({}, d, { title: d.title || autoTitle(d, S) }), S);
        if (!d.title) d.title = b.title;
        const purse = b.cost - (b.fund.id === 'loan' ? 0 : 0);
        body.push('<label class="lgname"><span>The law goes on the tablets as</span><input id="lgTitle" value="' + esc(d.title) + '"></label>');
        body.push('<div class="lgproj"><h4>What it does</h4><div class="two small">' +
          '<div>Cost now <b>' + (b.fund.id === 'loan' ? 'borrowed ' + b.cost : purse) + ' ⚖</b></div>' +
          '<div>Treasury each day <b class="' + (b.daily.income < 0 ? 'bad' : 'good') + '">' + (b.daily.income > 0 ? '+' : '') + r1(b.daily.income) + ' ⚖</b></div>' +
          '<div>Bread in the market <b>' + (b.daily.grain ? (b.daily.grain > 0 ? 'cheaper' : 'dearer') : 'unchanged') + '</b></div>' +
          '<div>The street <b>' + (b.daily.unrest < 0 ? 'quieter' : b.daily.unrest > 0 ? 'angrier' : 'unchanged') + '</b></div>' +
          '<div>The legions <b>' + (b.daily.morale ? (b.daily.morale > 0 ? '+' : '') + r1(b.daily.morale) + ' morale' : 'unmoved') + '</b></div>' +
          '<div>The house <b class="' + (b.rep.senate < 0 ? 'bad' : 'good') + '">' + (b.rep.senate > 0 ? '+' : '') + Math.round(b.rep.senate) + '</b></div>' +
          '</div><p class="mute small">' + esc(verdict(b, S)) + '</p></div>');
      }

      const canNext = d.step === 1 ? !!d.subject : d.step === 2 ? !!d.funding : true;
      body.push('<div class="row lgfoot">' +
        '<button class="btn" id="lgBack"' + (d.step === 1 ? ' disabled' : '') + '>◂ back</button>' +
        (d.step < 4
          ? '<button class="btn pri" id="lgNext"' + (canNext ? '' : ' disabled') + '>on to the ' + ['matter', 'purse', 'clauses', 'seal'][d.step] + ' ▸</button>'
          : '<button class="btn pri" id="lgGo">Take the floor ▸</button>') +
        '</div>');
      g.modal('📜 A law of your own', body.join(''), true);

      document.querySelectorAll('#modal .subj[data-s]').forEach(b => b.onclick = () => { d.subject = b.dataset.s; paint(); });
      document.querySelectorAll('#modal .subj[data-f]').forEach(b => b.onclick = () => { d.funding = b.dataset.f; paint(); });
      document.querySelectorAll('#modal .clause[data-c]').forEach(b => b.onclick = () => {
        const id = b.dataset.c;
        d.clauses = d.clauses.includes(id) ? d.clauses.filter(x => x !== id) : d.clauses.concat([id]);
        paint();
      });
      const back = document.getElementById('lgBack'), next = document.getElementById('lgNext'), go = document.getElementById('lgGo');
      if (back) back.onclick = () => { d.step = Math.max(1, d.step - 1); paint(); };
      if (next) next.onclick = () => { d.step = Math.min(4, d.step + 1); paint(); };
      const ti = document.getElementById('lgTitle');
      if (ti) ti.oninput = () => { d.title = ti.value; };
      if (go) go.onclick = () => { const b = build(Object.assign({}, d, { title: d.title || autoTitle(d, S) }), S); g.close(); floor(g, b); };
    };
    paint();
  }

  /* the one-line judgement the clerks would write in the margin */
  function verdict(b, S) {
    const opt = BLOCS.find(x => x.id === 'optimates');
    if (b.sub.res >= 3 && b.rep.senate < -8) return 'This will be a fight. The house has killed men for less, and several of them were consuls.';
    if (b.cost > S.pol.treasury && b.fund.id === 'treasury') return 'The treasury cannot pay for this today. Find the money or find another purse.';
    if (b.sub.id === 'usuris') return 'The most popular law in a generation, and the one most likely to end with a dagger. Bring your best argument.';
    if (b.rep.senate > 6) return 'The house is inclined to agree with you. That is when a man is most likely to say something careless.';
    return 'No bill is safe until the clerk has counted the seats twice. Go and count them.';
  }

  /* ============================ the floor ============================ */
  /* Where the house stands before you open your mouth. This is deliberately short of a majority on a good day: the
     point of the floor is that you have to move it. A radical bill starts nearly dead, and that is correct. */
  const open = (S, b) => BLOCS.map(bl => {
    let sup = .34 + (b.appeal[bl.id] || 0);
    const care = bl.id === 'optimates' ? 'senate' : bl.id === 'populares' ? 'people' : bl.id === 'veterans' ? 'army' : null;
    if (care) sup += (S.rep[care] || 0) / 400;
    else sup += ((S.rep.senate || 0) + (S.rep.people || 0)) / 900;
    if (bl.id === 'veterans') sup += (S.attrs.martial || 0) * .008;
    if (bl.id === 'populares') sup += (S.attrs.rhetoric || 0) * .009;
    if (bl.id === 'optimates') sup += (S.attrs.gravitas || 0) * .009;
    sup += (S.auctoritas || 0) / 2000;
    return { id: bl.id, n: bl.n, col: bl.col, seats: bl.seats, sup: clamp(sup, .04, .96) };
  });

  function tally(D) {
    let f = 0;
    D.blocs.forEach(b => { f += Math.round(b.seats * b.sup); });
    return { for: f, against: SEATS - f };
  }

  function floor(g, b) {
    const S = g.S;
    const D = { b, blocs: open(S, b), round: 1, log: [], used: {}, pending: null, done: false };
    if (!b.title) b.title = autoTitle({ subject: b.subject }, S);
    const say2 = (who, text) => D.log.push({ who, text });

    const paint = () => {
      const t = tally(D);
      const seatBar = D.blocs.map(bl => {
        const fill = Math.round(bl.sup * 100);
        return '<div class="blk" style="flex:' + bl.seats + ';--c:' + bl.col + '"><i style="width:' + fill + '%"></i><b>' + Math.round(bl.seats * bl.sup) + '</b><span>' + esc(bl.n) + '</span></div>';
      }).join('');
      const need = 151;
      const head = '<div class="floorhead"><div><b>' + esc(b.title) + '</b><span class="mute small">' + esc(b.sub.d) + '</span></div>' +
        '<div class="tally"><b class="' + (t.for >= need ? 'good' : 'bad') + '">' + t.for + '</b> for · <b>' + t.against + '</b> against</div></div>' +
        '<div class="seatbar">' + seatBar + '</div>' +
        '<div class="whipline"><div class="wfill"><i style="width:' + (t.for / SEATS * 100) + '%"></i><u style="left:' + (need / SEATS * 100) + '%"></u></div><span class="small mute">151 seats carry the motion</span></div>';

      const feed = D.log.slice(-5).map(l => '<div class="fb ' + (l.who === 'you' ? 'me' : '') + '"><b>' + esc(l.who) + '</b><span>' + esc(l.text) + '</span></div>').join('');

      let opts = '';
      if (D.pending) {
        opts = '<div class="objbox"><b>' + esc((g.charById(D.pending.who) || {}).n || D.pending.who) + '</b><span>' + esc(D.pending.line) + '</span></div><div class="ops">' +
          D.pending.ops.map((o, i) => '<button class="op" data-i="' + i + '"><b>' + esc(o.t) + '</b><span>' + esc(o.d) + '</span></button>').join('') + '</div>';
      } else if (!D.done) {
        opts = '<p class="mute small">Round ' + D.round + ' of 3. Choose what you say to the house.</p><div class="args">' +
          ARGS.map(a => {
            const used = !!D.used[a.id];
            const stat = S.attrs[a.stat] || 1;
            const appeal = blast(D, a);
            return '<button class="arg' + (used ? ' used' : '') + '" data-a="' + a.id + '"' + (used ? ' disabled' : '') + '><b>' + a.g + ' ' + esc(a.n) + '</b><span>' + esc(a.d) + '</span>' +
              '<div class="subjtag"><em>' + esc(a.stat) + ' ' + stat + '</em><em>' + appeal + '</em>' + (a.bribe ? '<em class="bad">coin</em>' : '') + (a.threat ? '<em class="bad">dangerous</em>' : '') + '</div></button>';
          }).join('') + '</div>';
      }
      const foot = '<div class="row lgfoot"><button class="btn" id="flLeave">Walk out</button>' +
        (D.done ? '' : '<button class="btn pri" id="flVote">' + (D.round > 3 ? 'Call the vote ▸' : 'Call the vote early') + '</button>') + '</div>';

      g.modal('🏛️ The floor of the house', head + '<div class="two"><div class="floorfeed">' + feed + '</div><div class="flooropts">' + opts + '</div></div>' + foot, true);

      document.querySelectorAll('#modal .arg[data-a]').forEach(el => el.onclick = () => argue(el.dataset.a));
      document.querySelectorAll('#modal .op[data-i]').forEach(el => el.onclick = () => rebut(+el.dataset.i));
      document.getElementById('flLeave').onclick = () => { g.close(); g.toast('You walk out', 'the bill stays in your pocket, unspoken', 'bad'); };
      const v = document.getElementById('flVote');
      if (v) v.onclick = () => vote();
    };

    /* how an argument reads to the house before you make it — a rough read, so the choice is informed but not safe */
    function blast(D, a) {
      const avg = D.blocs.reduce((s, bl) => s + bl.sup * ((a.w[bl.id] || 0) > .12 ? 1.6 : (a.w[bl.id] || 0) > 0 ? 1 : 0), 0) / 4;
      return avg > .45 ? 'well received' : avg > .3 ? 'it will land' : avg > .18 ? 'a thin room' : 'it will not help';
    }

    function shift(D, id, amt) {
      const bl = D.blocs.find(x => x.id === id);
      if (bl) bl.sup = clamp(bl.sup + amt, .02, .97);
    }

    function argue(id) {
      const a = ARGS.find(x => x.id === id);
      if (!a || D.used[id] || D.done) return;
      /* the purse and the threat cost you something before they are ever spoken */
      if (a.bribe) {
        const c = 220 + D.round * 60;
        if (S.denarii < c) return g.toast('Not enough coin', 'a purse of ' + c + ' denarii is what this room calls a friendly word', 'bad');
        S.denarii -= c;
        g.toast('Coin moves', c + ' denarii distributed by men who are good at it', 'coin');
      }
      if (a.threat) {
        if (S.auctoritas < 4) return g.toast('You have not the standing', 'a threat from a man nobody fears is a joke with a long ending', 'bad');
        S.auctoritas -= 4;
      }
      D.used[id] = 1;
      const stat = (S.attrs[a.stat] || 1) + Math.random() * 5;
      const roll = stat < 5 ? -.03 : stat < 8 ? .03 : .07;
      D.blocs.forEach(bl => shift(D, bl.id, (a.w[bl.id] || 0) * (1 + roll * 2)));
      /* winning an argument in front of the house is worth something in itself */
      if (a.id === 'purse') { D.bribed = (D.bribed || 0) + 1; say2('you', 'You do not speak at all. Your freedman speaks to eleven men in the colonnade, and the arithmetic changes.'); }
      else if (a.id === 'threat') say2('you', 'You give them the number: nine thousand men in the Forum, and every one of them knows your name. Nobody applauds. Nobody needs to.');
      else say2('you', 'You argue ' + a.n.toLowerCase() + '. ' + a.d);
      const t = tally(D);
      say2('the house', t.for >= 151 ? 'The benches are with you — for the moment.' : 'The benches shift, but not enough of them.');
      g.hud && g.hud();

      /* somebody always stands up */
      const sub = b.sub;
      const tag = sub.tags[Math.floor(Math.random() * sub.tags.length)] || 'senate';
      const pool = OBJECTIONS.filter(o => o.tag === tag);
      const pick = pool[Math.floor(Math.random() * pool.length)];
      const target = D.blocs.slice().sort((x, y) => y.seats * (1 - y.sup) - x.seats * (1 - x.sup))[0];
      D.pending = { who: pick.who, line: pick.line, tag, target: target.id, ops: responses(pick, target) };
      D.round++;
      paint();
    }

    function responses(obj, target) {
      const who = (g.charById(obj.who) || { n: 'He' }).n;
      return [
        { t: 'Concede, and narrow the law', d: 'Give him the point in public and take it out of the text. The house respects a man who can be argued out of something.', k: 'concede' },
        { t: 'Answer him on the facts', d: 'Take the objection apart with the statute and the accounts, in front of everybody.', k: 'answer', stat: 'rhetoric' },
        { t: 'Turn it back on him', d: 'Ask what he is afraid of, and say the answer out loud before he can. He will not forgive you.', k: 'attack', stat: 'cunning' }
      ];
    }

    function rebut(i) {
      const p = D.pending;
      if (!p) return;
      const o = p.ops[i];
      const who = (g.charById(p.who) || { n: 'the senator' }).n;
      if (o.k === 'concede') {
        shift(D, p.target, .07);
        D.blocs.forEach(bl => { if (bl.id !== p.target) shift(D, bl.id, .01); });
        b.power = Math.max(.55, b.power - .07);
        b.struck = b.clauses.length ? (b.clauses[b.clauses.length - 1]) : null;
        b.clauses = b.clauses.filter(c => c !== b.struck);
        b.cls = b.cls.filter(c => c.id !== b.struck);
        say2('you', 'You give him the point, and strike the clause he hates from the text. Half the house relaxes. The other half watches you do it.');
      } else {
        const stat = (S.attrs[o.stat] || 1) + Math.random() * 6;
        const diff = 6 + (b.sub.res * .7) + (o.k === 'attack' ? 1.5 : 0);
        const win = stat >= diff;
        if (o.k === 'answer') {
          D.blocs.forEach(bl => shift(D, bl.id, win ? (bl.id === 'optimates' ? .04 : .06) : -.04));
          say2('you', win ? 'You read the statute aloud, in order, and let the silence after the third line do the work. ' + who + ' sits down without being asked. Elsewhere in the house, three men begin to laugh.' : 'You cite the law twice and misquote it once. ' + who + ' corrects you gently, and the room enjoys it enormously.');
        } else {
          D.blocs.forEach(bl => shift(D, bl.id, win ? ((ARGS.find(a => a.id === 'accuse').w[bl.id] || 0) * 1.5) : -.05));
          if (!win) { S.rep.senate = clamp((S.rep.senate || 0) - 2, -100, 100); }
          say2('you', win ? 'You ask him, politely, what he is afraid of. Then you answer for him, with a number, in front of the house. He does not stand up again.' : 'You go for his throat and miss. Half the house sees exactly what you were doing, and it is a small house today.');
        }
      }
      D.pending = null;
      paint();
    }

    function vote() {
      if (D.done) return;
      D.done = true;
      const votes = tally(D).for;
      g.close();
      b.votes = votes;
      if (votes >= 190) return carried(1.15, 'acclaim');
      if (votes >= 151) return carried(1, 'carried');
      if (votes >= 136) return carried(.6, 'amended');
      return defeated(votes);
    }

    function carried(mult, how) {
      const S2 = g.S;
      b.power = clamp(b.power * mult, .4, 2);
      /* the cost comes out of the purse — or the money is borrowed at Crassus's rate */
      const purse = b.cost;
      if (b.fund.id === 'loan') S2.pol.debt += Math.round(purse * 1.15);
      else S2.pol.treasury -= Math.round(purse);
      if (S2.pol.treasury < 0) {
        S2.pol.unrest += 6;
        S2.pol.treasury = 0;
      }
      const law = {
        id: b.id, title: b.title, subject: b.subject, subName: b.sub.n, icon: b.sub.g,
        funding: b.fund.id, fundName: b.fund.n, clauses: b.clauses.slice(),
        power: b.power, daily: {
          grain: b.daily.grain * (mult === .6 ? .6 : 1), income: Math.round(b.daily.income * (mult === .6 ? .75 : 1)),
          morale: Math.round(b.daily.morale * (mult === .6 ? .6 : 1)), unrest: b.daily.unrest * (mult === .6 ? .6 : 1)
        },
        drift: b.sub.drift || {}, passedDay: S2.day, passedVotes: b.votes, repealed: null
      };
      S2.pol.laws.push(law);
      S2.pol.log.unshift({ day: S2.day, title: b.title, votes: b.votes, how });
      S2.laws = S2.laws || []; S2.laws.push(b.id);
      /* what carrying it does to you, this afternoon */
      const rep = { senate: Math.round(b.rep.senate / 2), people: Math.round(b.rep.people / 2), army: Math.round(b.rep.army / 2) };
      g.applyEff({ xp: 26 + Math.round(b.power * 18), auctoritas: Math.round(b.auctoritas / 2), rep });
      g.hud(); g.save();
      g.sfx('good');
      const subtitle = how === 'acclaim' ? 'carried with acclamation' : how === 'amended' ? 'carried, amended' : 'carried';
      g.cine({
        kicker: 'the fasti · day ' + S2.day,
        title: b.title.split(' — ')[0],
        paras: [
          'The clerk reads the result in a flat voice and the house makes the noise a house makes: not applause, not argument, but the sound of a great many men recalculating at once.',
          b.votes + ' seats for, ' + (SEATS - b.votes) + ' against. ' + (how === 'acclaim' ? 'They carry you out of the curia on their shoulders, which is a thing they will remind you of when they want something.' : how === 'amended' ? 'It passes with the sharpest clause struck out, which is how the Republic says yes to a thing it does not want.' : 'It passes by your own arithmetic and by two converted enemies.'),
          'It is law. The price of bread this morning is already wrong, and by tomorrow the street will know whose name is on it.'
        ],
        go: 'See what it does ▸'
      }, () => stateOfRome(g));
    }

    function defeated(votes) {
      const S2 = g.S;
      g.applyEff({ xp: 10, rep: { senate: -2 } });
      S2.pol.unrest = clamp(S2.pol.unrest + 2, 0, 100);
      S2.pol.log.unshift({ day: S2.day, title: b.title, votes, how: 'defeated' });
      g.hud(); g.save(); g.sfx('bad');
      g.say('narrator', [
        votes + ' seats for you. ' + (SEATS - votes) + ' against. The clerk does not even finish the sentence before the benches begin to empty.',
        'You have lost nothing but an afternoon and a little standing — and you have learned, exactly, which men are not persuadable and which are merely expensive.',
        'The draft is in the tablinum. Bring it back next year with a better purse, or bring it back with an army.'
      ], { onEnd: () => g.hud() });
    }

    paint();
    g.sfx('scroll');
  }

  /* ============================ the lawbook and the state ============================ */
  function breadWord(p) {
    return p < 6 ? 'cheap' : p < 9 ? 'fair' : p < 12 ? 'dear' : p < 16 ? 'cruel' : 'a riot waiting';
  }

  function stateOfRome(g) {
    const S = g.S; init(S);
    const e = eff(S);
    const unrest = S.pol.unrest;
    const mood = unrest > 70 ? 'The street is one spark from a revolt' : unrest > 45 ? 'The street is unhappy, and loud about it' : unrest > 26 ? 'The street is restless' : 'The street is quiet';
    const laws = S.pol.laws.filter(l => !l.repealed);
    let h = '<div class="sor">' +
      '<div class="sorc"><div class="sc b"><b>' + Math.round(S.pol.treasury).toLocaleString() + '</b><span>denarii in the treasury</span></div>' +
      '<div class="sc"><div class="scrow"><b>' + e.bread + '</b><span>asses a modius</span></div><i>' + breadWord(e.bread) + '</i></div>' +
      '<div class="sc"><div class="scrow"><b>' + Math.round(unrest) + '</b><span>the temper of the street</span></div><div class="ubar"><i style="width:' + unrest + '%"></i></div></div>' +
      '<div class="sc"><b>' + (e.income >= 0 ? '+' : '') + e.income + '</b><span>a day into the purse</span></div></div>' +
      '<p class="mute small">' + mood + '. ' + (e.debt ? 'Crassus is owed <b>' + Math.round(e.debt) + '</b> denarii and charges <b>' + e.interest + '</b> a day for the privilege. ' : '') +
      (e.morale ? 'Legions fight at <b>' + (e.morale > 0 ? '+' : '') + e.morale + '</b> morale under these laws. ' : '') + '</p>';
    h += '<h4>The lawbook — ' + laws.length + ' law' + (laws.length === 1 ? '' : 's') + ' in force</h4>';
    if (!laws.length) h += '<p class="mute">No law of yours stands on the tablets. The laws of other men are, as ever, standing on everything.</p>';
    h += '<div class="lawlist">' + laws.map(l => '<div class="lawrow"><div class="lich">' + l.icon + '</div><div class="lbody"><b>' + esc(l.title) + '</b>' +
      '<span>Carried on day ' + l.passedDay + ' by ' + l.passedVotes + ' votes · ' + esc(l.fundName) + ' · bite ' + Math.round(l.power * 100) + '%</span>' +
      '<div class="lchips">' +
      (l.daily.grain ? '<em>' + (l.daily.grain > 0 ? 'bread cheaper' : 'bread dearer') + '</em>' : '') +
      (l.daily.income ? '<em class="' + (l.daily.income < 0 ? 'bad' : 'good') + '">' + (l.daily.income > 0 ? '+' : '') + l.daily.income + ' ⚖/day</em>' : '') +
      (l.daily.unrest ? '<em class="' + (l.daily.unrest > 0 ? 'bad' : 'good') + '">' + (l.daily.unrest > 0 ? 'angrier street' : 'calmer street') + '</em>' : '') +
      (l.daily.morale ? '<em>' + (l.daily.morale > 0 ? '+' : '') + l.daily.morale + ' morale</em>' : '') +
      (l.clauses || []).map(id => { const c = CLAUSES.find(x => x.id === id); return c ? '<em class="cl">' + c.g + ' ' + esc(c.n) + '</em>' : ''; }).join('') +
      '</div></div><button class="btn tiny" data-rep="' + l.id + '">Repeal</button></div>').join('') + '</div>';
    const log = (S.pol.log || []).slice(0, 6);
    if (log.length) h += '<h4>The fasti</h4><div class="fasti">' + log.map(l => '<div><i>day ' + l.day + '</i><b>' + esc(l.title.split(' — ')[0]) + '</b><span>' + l.votes + ' for · ' + esc(l.how) + '</span></div>').join('') + '</div>';
    h += '<div class="row" style="margin-top:12px"><button class="btn pri" id="sorDraft">Draft a new law</button><button class="btn" id="sorClose">Close</button></div></div>';
    g.modal('🏛️ The state of Rome', h, true);
    document.getElementById('sorClose').onclick = () => g.close();
    document.getElementById('sorDraft').onclick = () => { g.close(); draft(g); };
    document.querySelectorAll('#modal [data-rep]').forEach(el => el.onclick = () => repeal(g, el.dataset.rep));
  }

  function repeal(g, id) {
    const S = g.S; init(S);
    const l = S.pol.laws.find(x => x.id === id);
    if (!l || l.repealed) return;
    const cost = 30 + Math.round(l.power * 40);
    if ((S.auctoritas || 0) < cost) return g.toast('You have not the standing', 'undoing a law of your own costs ' + cost + ' auctoritas, and you have ' + Math.round(S.auctoritas), 'bad');
    S.auctoritas -= cost;
    l.repealed = S.day;
    S.pol.unrest = clamp(S.pol.unrest + 3, 0, 100);
    g.applyEff({ rep: { senate: 2, people: -3 } });
    S.pol.log.unshift({ day: S.day, title: 'Repeal of ' + l.title.split(' — ')[0], votes: 0, how: 'repealed' });
    g.toast('Repealed', l.subName + ' is off the tablets. The men who profited from it will not forget which day.', 'bad');
    g.save(); g.hud();
    stateOfRome(g);
  }

  /* ============================ the days pass ============================ */
  /* Called once for every morning that goes by. Returns the sentences the game should say aloud, so a law you passed
     in the spring is still doing something to the city in the autumn. */
  function day(S) {
    const p = init(S);
    const out = [];
    /* the weather is a mean-reverting walk, not a drift: a good year is followed by an ordinary one */
    p.harvest = clamp(p.harvest * .4 + (Math.random() * 5 - 2.5), -4, 4);
    const e = eff(S);
    p.treasury += e.income;
    if (p.treasury < 0) { p.unrest += 4; p.treasury = 0; out.push('The treasury is empty again. The clerks are writing letters to men who do not answer letters.'); }
    /* opinion moves under a law by a tenth of a point a day, not by a point: this is a career, not a switch */
    Object.keys(e.drift).forEach(k => {
      const d = e.drift[k];
      if (d) { S.rep[k] = Math.round(clamp((S.rep[k] || 0) + d, -100, 100) * 10) / 10; }
    });
    /* the street has a temperature of its own. A city this big is always close to the boil; dear bread pushes it up
       and popular laws hold it down. One grain law roughly holds the line — the second one actually cools the city. */
    const pressure = .5 + (e.bread - 8) * .12;
    p.unrest = clamp(p.unrest + pressure + e.unrest * .35, 0, 100);
    if (p.unrest > 78) {
      p.unrest -= 22;
      const dmg = 200 + Math.round(Math.random() * 500);
      S.denarii = Math.max(0, S.denarii - dmg);
      S.rep.people = clamp((S.rep.people || 0) - 6, -100, 100);
      out.push('A riot in the Subura: a grain shop burned, ' + dmg + ' denarii of yours gone with it, and the vigiles arrived an hour after the crowd had finished.');
    } else if (p.unrest < 12 && p.laws.length) {
      out.push('The street is quiet enough that people are talking about something other than bread, which has not happened in a year.');
    }
    if (p.debt > 0) {
      p.debt = Math.round(p.debt * 1.002);
      if (e.interest > 0 && Math.random() < .25) out.push('Crassus’s man came by the tablinum to leave a note that was not a note: just the figure, and the date.');
    }
    /* the salary of an office, small and steady, plus a share of what the laws bring in */
    const rank = (window.IMP && window.IMP.rankOf) ? window.IMP.rankOf(S.xp) : 0;
    const stipend = 2 + rank * 3 + Math.max(0, Math.round(e.income * .22));
    S.denarii += stipend;
    return out;
  }

  /* what the market charges for a loaf, so the shop and the HUD agree with the senate */
  function market(S) {
    const e = eff(S);
    return { bread: e.bread, stress: e.unrest, mood: e.unrest > 45 ? 'dear' : e.unrest > 20 ? 'fair' : 'cheap' };
  }

  return {
    init, eff, day, market, draft, floor, stateOfRome, repeal, autoTitle, build,
    SUBJECTS, FUNDING, CLAUSES, BLOCS, ARGS, SEATS,
    get subjects() { return SUBJECTS; }
  };
})();

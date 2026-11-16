// Entertainment > Games > President: the rules of the president simulator (play-president.js draws it).
// The Republic of Velmora is made up. Five voter groups, six provinces, a budget, laws in a 100-seat Assembly,
// four advisors, events and crises, a midterm and a presidential election every 16 quarters.
// Pure logic with a seeded random generator kept in the save, so it runs the same in Node (tests/president-test.js).
(function (root) {
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), r1 = v => Math.round(v * 10) / 10;
  const R = S => { S.rs = (Math.imul(S.rs >>> 0, 1664525) + 1013904223) >>> 0; return S.rs / 4294967296; };
  const TERM = 16, SEASONS = ['Winter', 'Spring', 'Summer', 'Autumn'];

  const BLOCS = [
    { id: 'w', name: 'Workers', icon: '🔧', share: 30, wants: 'jobs, welfare, low prices' },
    { id: 'b', name: 'Business', icon: '💼', share: 10, wants: 'growth, low company tax, roads and rail' },
    { id: 'f', name: 'Farmers', icon: '🌾', share: 12, wants: 'infrastructure, low prices, support in bad years' },
    { id: 'y', name: 'Young voters', icon: '🎓', share: 22, wants: 'education, jobs, a country respected abroad' },
    { id: 'r', name: 'Retirees', icon: '🪑', share: 26, wants: 'health care, low inflation, order' }
  ];
  const BIDS = BLOCS.map(b => b.id);
  const PROV = [
    { id: 'nm', name: 'Northmarch', ev: 9, mix: { f: .45, w: .2, b: .05, y: .1, r: .2 }, pts: '20,20 250,20 230,150 20,170', lx: 120, ly: 90 },
    { id: 'pc', name: 'Port Calder', ev: 14, mix: { w: .45, b: .1, f: .05, y: .2, r: .2 }, pts: '250,20 470,20 480,130 360,170 230,150', lx: 355, ly: 85 },
    { id: 'sh', name: 'Seaholm', ev: 11, mix: { r: .45, w: .2, y: .1, b: .1, f: .15 }, pts: '470,20 580,20 580,240 500,250 480,130', lx: 530, ly: 130 },
    { id: 'ap', name: 'Ashby Plains', ev: 8, mix: { f: .4, w: .25, r: .2, y: .1, b: .05 }, pts: '20,170 230,150 250,280 120,360 20,360', lx: 115, ly: 260 },
    { id: 'vm', name: 'Valmont', ev: 16, mix: { b: .25, w: .25, y: .25, r: .2, f: .05 }, pts: '230,150 360,170 380,270 250,280', lx: 305, ly: 220 },
    { id: 'bw', name: 'Brightwater', ev: 12, mix: { y: .4, w: .2, r: .15, b: .1, f: .15 }, pts: '360,170 480,130 500,250 580,240 580,360 120,360 250,280 380,270', lx: 450, ly: 310 }
  ];
  const EV_TOTAL = PROV.reduce((a, p) => a + p.ev, 0), EV_WIN = Math.floor(EV_TOTAL / 2) + 1;

  const PARTIES = {
    civic: { name: 'Civic Labour Party', short: 'Civic Labour', color: '#c8553d', seats: 48, gw: 50, bonus: { w: 8, y: 4, b: -8 }, blurb: 'Jobs, wages and public services. Workers and the young like you. Business does not.' },
    market: { name: 'Free Enterprise League', short: 'Free Enterprise', color: '#2f6fb0', seats: 49, gw: 50, bonus: { b: 10, f: 4, w: -6 }, blurb: 'Low taxes and a growing economy. Business and farmers like you. Unions are wary.' },
    dawn: { name: 'New Dawn Movement', short: 'New Dawn', color: '#3c9a6b', seats: 44, gw: 60, bonus: { y: 10, r: -4 }, blurb: 'Clean politics, schools and the planet. Young voters love you. You start with fewer seats but more goodwill.' }
  };
  const RIVALS = ['Senator Aurelio Brandt', 'Governor Hesper Quill', 'Marta Oyelaran-Voss', 'Councillor Dag Ferrante', 'Judge Selma Arkwright'];

  const ADVISORS = [
    { id: 'tr', role: 'Treasury Secretary', icon: '💰', cares: 'the budget and the economy', names: ['Ines Calloway', 'Rupert Achebe-Stroud', 'Lena Varga'] },
    { id: 'in', role: 'Interior Minister', icon: '🏛️', cares: 'order and public mood', names: ['Tomas Reyhani', 'Greta Holm', 'Sami Kovacs'] },
    { id: 'fo', role: 'Foreign Minister', icon: '🌐', cares: 'standing abroad and security', names: ['Halvard Ostrom', 'Noor Delacroix', 'Piet Anand'] },
    { id: 'cs', role: 'Chief of Staff', icon: '📋', cares: 'your approval and the Assembly', names: ['Priya Venn', 'Owen Thackeray', 'Ada Mbeki-Lowe'] }
  ];

  /* laws: one-off effects (fx), lasting bloc effects (perm) and lasting economy effects (m: gr growth, un unemployment,
     in inflation, st stability, sd standing, rev revenue and cost spending per quarter in billions) */
  const LAWS = [
    { id: 'minwage', name: 'Minimum Wage Rise', icon: '💵', pc: 6, appeal: .35, fit: { civic: 1, market: -1, dawn: .5 }, perm: { w: 8, y: 4, b: -8 }, m: { un: .3, in: .2 }, d: 'Raises the lowest wage by 15%. Workers gain, firms hire a little less.' },
    { id: 'smallbiz', name: 'Small Business Tax Relief', icon: '🏪', pc: 5, appeal: .5, fit: { civic: -.3, market: 1, dawn: 0 }, perm: { b: 8, f: 3 }, m: { gr: .25, rev: -3 }, d: 'Cuts tax for firms under 50 staff. Costs 3 bn a quarter.' },
    { id: 'rail', name: 'National Rail Expansion', icon: '🚆', pc: 7, appeal: .55, fit: { civic: .6, market: .3, dawn: .8 }, perm: { w: 3, f: 2, y: 2 }, m: { gr: .3, un: -.2, cost: 3 }, d: 'New lines to every province. Costs 3 bn a quarter, lifts growth for good.' },
    { id: 'preschool', name: 'Universal Pre-School', icon: '🧸', pc: 6, appeal: .45, fit: { civic: 1, market: -.3, dawn: .8 }, perm: { y: 6, w: 3 }, m: { gr: .1, cost: 3 }, d: 'Free places for every child aged 3 and 4. Costs 3 bn a quarter.' },
    { id: 'pension', name: 'Pension Guarantee Act', icon: '🧓', pc: 6, appeal: .5, fit: { civic: .7, market: -.2, dawn: 0 }, perm: { r: 10 }, m: { cost: 4 }, d: 'Pensions rise with prices, by law. Costs 4 bn a quarter.' },
    { id: 'farm', name: 'Farm Price Support', icon: '🚜', pc: 4, appeal: .5, fit: { civic: 0, market: .4, dawn: -.3 }, perm: { f: 10, b: -2 }, m: { in: .1, cost: 2 }, d: 'A floor price for grain and milk. Costs 2 bn a quarter.' },
    { id: 'cleanair', name: 'Clean Air Standards', icon: '🌿', pc: 6, appeal: .35, fit: { civic: .3, market: -.8, dawn: 1 }, perm: { y: 7, r: 2, b: -6, f: -3 }, m: { gr: -.15, sd: 6 }, d: 'Strict limits on factory smoke. Respected abroad, costly for industry.' },
    { id: 'border', name: 'Border Security Act', icon: '🛂', pc: 5, appeal: .5, fit: { civic: -.4, market: .6, dawn: -.8 }, perm: { r: 4, y: -4 }, m: { st: 6, sd: -3, cost: 2 }, d: 'More guards and checks at the frontier. Costs 2 bn a quarter.' },
    { id: 'health', name: 'Public Health Insurance', icon: '🏥', pc: 9, appeal: .3, fit: { civic: 1, market: -1, dawn: .7 }, perm: { w: 6, r: 6, y: 4, b: -5 }, m: { st: 3, cost: 6 }, d: 'Cover for every citizen. Popular and expensive: 6 bn a quarter.' },
    { id: 'anticorrupt', name: 'Anti-Corruption Commission', icon: '⚖️', pc: 6, appeal: .6, fit: { civic: .5, market: .2, dawn: 1 }, perm: { w: 3, b: 3, f: 3, y: 3, r: 3 }, fx: { gw: -5 }, m: { st: 3, sd: 4 }, d: 'An independent watchdog with teeth. Voters cheer, deputies squirm.' },
    { id: 'housing', name: 'Housing Construction Drive', icon: '🏗️', pc: 6, appeal: .5, fit: { civic: .8, market: .2, dawn: .6 }, perm: { y: 7, w: 3 }, m: { gr: .2, cost: 3 }, d: '200,000 new homes in four years. Costs 3 bn a quarter.' },
    { id: 'trade', name: 'Ostmark Free Trade Pact', icon: '🤝', pc: 7, appeal: .45, fit: { civic: -.5, market: 1, dawn: 0 }, perm: { b: 7, f: -5, w: -3 }, m: { gr: .35, sd: 5 }, d: 'Open trade with our big neighbour. Business booms, farms face competition.' },
    { id: 'digital', name: 'Digital Infrastructure Bill', icon: '📡', pc: 5, appeal: .6, fit: { civic: .3, market: .6, dawn: .6 }, perm: { y: 5, b: 3 }, m: { gr: .25, cost: 2 }, d: 'Fast internet in every village. Costs 2 bn a quarter.' },
    { id: 'wealth', name: 'Wealth Tax', icon: '🏦', pc: 7, appeal: .2, fit: { civic: .8, market: -1, dawn: .3 }, perm: { b: -12, w: 5, y: 3 }, m: { gr: -.1, rev: 4 }, d: '1% a year on fortunes over 5 million. Raises 4 bn a quarter.' },
    { id: 'police', name: 'Police Reform Act', icon: '👮', pc: 5, appeal: .4, fit: { civic: .4, market: -.3, dawn: .9 }, perm: { y: 6, w: 2, r: -3 }, fx: { st: -2 }, m: { st: 2 }, d: 'Body cameras, training and an outside complaints board.' },
    { id: 'austerity', name: 'Balanced Budget Act', icon: '✂️', pc: 8, appeal: .4, fit: { civic: -1, market: .9, dawn: -.3 }, perm: { b: 5, r: -4, w: -4 }, m: { in: -.2, cost: -5 }, d: 'Cuts 5 bn a quarter from every department. Calms prices, angers many.' },
    { id: 'energy', name: 'Energy Independence Plan', icon: '⚡', pc: 6, appeal: .55, fit: { civic: .4, market: .4, dawn: .9 }, perm: { f: 3 }, m: { in: -.2, st: 2, sd: 3, cost: 3 }, d: 'Wind, solar and storage at home. Costs 3 bn a quarter.' }
  ];

  /* effect keys: w b f y r one group, all every group, cash billions in (+) or out (-), gs growth shock, is inflation shock,
     st stability, sd standing, gw Assembly goodwill, pc political capital, un unemployment */
  const E = (id, icon, title, text, choices, o) => Object.assign({ id, icon, title, text, choices: choices.map(c => ({ t: c[0], fx: c[1] })) }, o || {});
  const EVENTS = [
    E('strike', '🔧', 'Dockworkers strike in Port Calder', 'The docks are shut. The union wants a 12% raise. Ships are queuing off the coast.', [['Back the raise', { w: 8, b: -5, cash: -6, is: .3 }], ['Order them back to work', { b: 5, w: -9, st: -4 }], ['Send a mediator', { pc: -3, w: 2, b: 1 }]]),
    E('flood', '🌊', 'Floods in Ashby Plains', 'The Tarn river burst its banks. 40,000 people left their homes overnight.', [['Full emergency relief', { cash: -15, f: 8, all: 2 }], ['Army engineers and cheap loans', { cash: -6, f: 3, st: 2 }], ['Leave it to the province', { f: -10, st: -3 }]], { crisis: 1 }),
    E('scandal', '📰', 'Deputy minister took bribes', 'The Valmont Courier has bank records: a deputy minister took money from a road contractor.', [['Fire and prosecute him', { gw: -3, all: 2, sd: 2 }], ['Move him quietly to another post', { all: -2, gw: 2 }], ['Defend him', { all: -6, gw: 3, st: -1 }]]),
    E('tech', '💻', 'A chip maker wants to build in Brightwater', 'Lumen Silicon will build a factory with 4,000 jobs if you give it five years without company tax.', [['Accept the deal', { cash: -5, gs: .6, y: 4, un: -.3, b: 3 }], ['Offer half the tax break', { cash: -2, gs: .3, b: 1 }], ['Decline', { b: -3, y: -2 }]]),
    E('troops', '🛡️', 'Ostmark troops at the border', 'Our northern neighbour has moved three brigades to the Northmarch frontier for "exercises".', [['Mobilise the reserves', { cash: -8, st: 4, sd: -4, r: 3, y: -3 }], ['Call an emergency summit', { pc: -4, sd: 6, st: 1 }], ['Ask our allies to speak up', { sd: -2, st: 2, gw: -2 }]], { crisis: 1 }),
    E('drought', '☀️', 'Drought ruins the grain harvest', 'No rain since spring. The grain harvest is down by a third and bread prices are rising.', [['Pay farmers for lost crops', { cash: -6, f: 7 }], ['Import grain', { is: -.2, cash: -4, f: -4, sd: 1 }], ['Ration water', { st: -3, f: -2, all: -1 }]]),
    E('bank', '🏦', 'Valmont Savings Bank near collapse', 'The country\'s fourth-largest bank lost a fortune on bad loans. Queues are forming outside branches.', [['Bail the bank out', { cash: -20, b: 6, w: -5, st: 3 }], ['Let it fail', { gs: -1.2, b: -8, st: -5, r: -5 }], ['Guarantee savings only', { cash: -8, r: 4, st: 2, b: -2 }]], { crisis: 1 }),
    E('games', '🏅', 'A bid for the Continental Games', 'The sports federation asks if Velmora will bid to host the Continental Games in six years.', [['Bid big', { cash: -10, all: 3, sd: 5, gs: .2 }], ['Make a modest bid', { cash: -3, sd: 2 }], ['Pass', { y: -2 }]]),
    E('tuition', '✊', 'Students protest university fees', '20,000 students fill Founders\' Square in Valmont. They want fees frozen.', [['Freeze the fees', { cash: -4, y: 8, b: -1 }], ['Meet the student leaders', { pc: -3, y: 3 }], ['Police clear the square', { y: -10, st: -3, r: 3 }]]),
    E('flu', '🦠', 'A flu outbreak spreads', 'A new strain of flu is filling hospitals in Seaholm and Valmont.', [['Close schools and offices for a month', { gs: -1, st: 3, r: 6, b: -6, y: -3 }], ['Free vaccination drive', { cash: -10, r: 4, all: 1 }], ['Keep everything open', { r: -8, gs: .2, st: -3 }]], { crisis: 1 }),
    E('fuel', '⛽', 'Fuel prices spike', 'A war far away has sent the world oil price up by half. Drivers and farmers are furious.', [['Cut fuel tax', { cash: -8, is: -.5, w: 3, f: 3 }], ['Release the strategic reserve', { is: -.3, sd: -1, cash: -2 }], ['Do nothing', { is: .6, w: -3, f: -3 }]]),
    E('memos', '🗞️', 'Leaked cabinet memos', 'The Courier printed your private cabinet notes on the budget. Your staff want the leaker found.', [['Defend the free press', { y: 4, sd: 3, gw: -2 }], ['Sue the paper', { y: -6, sd: -4, gw: 1, st: 1 }], ['Say nothing', { all: -1 }]]),
    E('refugees', '🧳', 'Refugees from Kessaria', 'Civil war in Kessaria. 30,000 people are walking toward our southern border.', [['Open camps and take them in', { cash: -6, sd: 7, y: 4, r: -4 }], ['Take a fixed quota', { cash: -2, sd: 2 }], ['Close the border', { sd: -6, r: 4, y: -5, st: 1 }]]),
    E('mine', '⛏️', 'Mine collapse in Northmarch', 'A tunnel at the Greyfell mine collapsed. 30 miners are trapped underground.', [['Go there and lead the rescue', { pc: -2, all: 3, w: 4 }], ['Fund the rescue and an inquiry', { cash: -4, w: 5 }], ['Leave it to the company', { w: -8 }]]),
    E('stocks', '📉', 'The stock market drops 18%', 'Panic selling in Valmont. Pension funds and firms are losing money.', [['Spend 12 bn to boost the economy', { cash: -12, gs: .8, b: 3 }], ['Give a calming speech', { pc: -3, b: 2, gs: .2 }], ['Do nothing', { b: -4, gs: -.4 }]]),
    E('wagepact', '🤝', 'Unions offer a wage pact', 'The unions will hold wage demands down for two years if you protect jobs in a downturn.', [['Sign the pact', { w: 6, is: -.2, b: -2 }], ['Counter-offer', { pc: -2, w: 2, b: 1 }], ['Refuse', { w: -5 }]]),
    E('envoy', '🌐', 'Our ambassador insults an ally', 'Our envoy to Lund called its prime minister "a clown" at a dinner. It was filmed.', [['Recall him', { sd: 4, gw: -1 }], ['Apologise publicly', { sd: 2, r: -1 }], ['Stand by him', { sd: -6, r: 2 }]]),
    E('fires', '🔥', 'Wildfires in Northmarch', 'Dry winds have spread fires across 60,000 hectares of farmland and forest.', [['A national firefighting fund', { cash: -7, f: 5, st: 1 }], ['Send the army', { cash: -3, st: 2, sd: -1, f: 2 }], ['Ask other countries for planes', { sd: 2, f: 2, r: -1 }]]),
    E('robots', '🤖', 'Robots replace factory jobs', 'Car plants in Port Calder will cut 6,000 jobs as they switch to robot lines.', [['Fund retraining', { cash: -6, w: 5, un: -.4 }], ['Tax the robots', { b: -6, w: 4, cash: 3, gs: -.2 }], ['Welcome the change', { gs: .4, w: -6, b: 5, un: .3 }]]),
    E('founders', '🎉', 'Founders\' Day centennial', 'Velmora is 100 years old this quarter. The country expects a celebration.', [['A grand parade', { cash: -4, all: 2, st: 2 }], ['Grants for local festivals', { cash: -3, w: 2, f: 2, y: 1 }], ['Keep it small', {}]]),
    E('hack', '🖥️', 'Cyberattack on the tax office', 'Hackers locked the tax office computers and want 2 bn to unlock them.', [['Pay the ransom', { cash: -2, sd: -3, st: 1 }], ['Rebuild the systems', { cash: -9, st: 2, sd: 2 }], ['Blame Ostmark in public', { sd: -5, r: 2, st: 1 }]], { crisis: 1 }),
    E('rating', '📊', 'Credit agency warns of a downgrade', 'The agency says Velmora\'s debt is too high. A downgrade would raise the cost of borrowing.', [['Announce spending cuts', { cash: 10, w: -5, r: -4, b: 5 }], ['Promise reforms', { pc: -4, b: 2 }], ['Ignore it', { gs: -.4, b: -4, is: .2 }]], { debt: .8 }),
    E('rents', '🏠', 'Rents in Valmont soar', 'Rents in the capital rose 22% this year. Young families are leaving.', [['Cap rents', { y: 7, w: 3, b: -6, gs: -.1 }], ['Build public housing', { cash: -8, y: 5, w: 2 }], ['Let the market fix it', { y: -5, b: 3 }]]),
    E('tariff', '📦', 'Ostmark puts tariffs on our steel', 'Ostmark added a 25% tariff on Velmoran steel. Port Calder mills are worried.', [['Hit back with our own tariffs', { w: 4, sd: -4, gs: -.3, is: .2 }], ['Negotiate', { pc: -3, sd: 2 }], ['Accept it', { w: -5, gs: -.2 }]]),
    E('general', '🎖️', 'A general criticises you on TV', 'General Corvin Ash says your defence plans "put the nation at risk".', [['Dismiss him', { st: -2, r: -2, gw: 1 }], ['Meet him privately', { pc: -2, st: 1 }], ['Ignore it', { st: -1, all: -1 }]]),
    E('quake', '🌋', 'Earthquake in Seaholm', 'A 6.4 earthquake hit the coast. Thousands of homes are damaged.', [['Massive aid', { cash: -18, r: 8, all: 3, st: 2 }], ['An insurance fund and loans', { cash: -8, r: 3 }], ['Appeal for foreign aid', { sd: 1, r: -3, cash: -2 }]], { crisis: 1 }),
    E('pharma', '💊', 'A drug company doubles its prices', 'Halden Pharma doubled the price of heart medicine. Pensioners are skipping doses.', [['Cap the price', { r: 6, b: -5 }], ['Build a public medicine factory', { cash: -6, r: 4, gs: .1 }], ['Negotiate with the company', { pc: -2, r: 2 }]]),
    E('teachers', '📚', 'Teachers threaten to strike', 'Teachers have had no raise in four years. They plan to walk out next month.', [['Raise their pay', { cash: -5, y: 4, w: 3 }], ['Bonuses for good results', { cash: -2, y: 1, b: 1 }], ['Refuse', { y: -5, w: -3 }]]),
    E('summit', '🕊️', 'An invitation to the Lund peace summit', 'Seven nations meet in Lund to end the Kessarian war. You are invited to speak.', [['Go and lead the talks', { pc: -3, sd: 7, r: 1 }], ['Send the foreign minister', { sd: 2 }], ['Stay home', { sd: -4, st: 1 }]]),
    E('tourism', '🏖️', 'A tourism boom on the coast', 'Visitors to Seaholm are up 40%. Hotels are full, roads are jammed.', [['A tourist tax', { cash: 5, b: -2, r: -1 }], ['Advertise abroad', { cash: -2, gs: .3, sd: 2 }], ['Leave it alone', { gs: .1 }]]),
    E('donations', '🕵️', 'Your campaign took illegal donations', 'Reporters say your campaign manager took cash from a shell company.', [['Order an independent inquiry', { all: -2, gw: 2, sd: 2 }], ['Fire the manager', { pc: -2, all: -1 }], ['Deny everything', { all: -5 }]], { minQ: 6 }),
    E('hospital', '🎁', 'A billionaire offers a hospital', 'Magnate Ezra Tull will pay for a new hospital in Seaholm if it carries his name.', [['Accept with his name', { r: 5, b: 2, y: -2 }], ['Accept, but no name', { r: 3, pc: -2 }], ['Decline', { y: 2 }]])
  ];
  const DEBATE = E('debate', '🎤', 'The televised debate', 'Tonight you face your rival on every channel. 4 million people are watching. What is your closing line?',
    [['Defend your record', { all: 2, b: 2, r: 2 }], ['Promise bold change', { y: 6, w: 3, r: -3 }], ['Attack your rival', { all: 1, r: 3, y: -2, st: -1 }]], { fixed: 1 });

  /* ---------- state ---------- */
  function newGame(o) {
    o = o || {}; const party = PARTIES[o.party] ? o.party : 'civic', P = PARTIES[party];
    const S = {
      v: 1, rs: (o.seed >>> 0) || ((Date.now() ^ 0x5bd1e995) >>> 0), name: String(o.name || 'Alex Marrow').slice(0, 40), party, q: 1, term: 1, phase: 'play',
      gdp: 1000, growth: 2, unemp: 6, infl: 2.5, debt: 600, stab: 62, sd: 50, gw: P.gw, pc: 10, seats: P.seats,
      budget: { ti: 30, tc: 25, h: 14, e: 12, d: 10, i: 10, wf: 14 },
      ap: {}, mood: {}, perm: {}, gs: 0, is: 0, laws: [], billQ: 0, whip: 0, speeches: {}, rally: {}, low: 0,
      adv: ADVISORS.map(a => ({ id: a.id, name: a.names[0], n: 0, trust: 60 })), seen: [], ev: [], hist: [], log: [], aiEv: !!o.aiEv, rival: '', result: null, over: null, wins: 0
    };
    S.rival = RIVALS[Math.floor(R(S) * RIVALS.length)];
    BIDS.forEach(b => { S.perm[b] = P.bonus[b] || 0; S.mood[b] = 0; S.ap[b] = clamp(48 + S.perm[b] * .6, 5, 95); });
    S.hist.push(snap(S)); log(S, 'You are sworn in as President of the Republic of Velmora. The ' + P.name + ' holds ' + S.seats + ' of 100 Assembly seats.');
    drawEvents(S); return S;
  }
  const log = (S, t) => { S.log.push({ q: S.q, t }); if (S.log.length > 120) S.log.shift(); };
  const overall = S => r1(BLOCS.reduce((a, b) => a + S.ap[b.id] * b.share, 0) / 100);
  const qInTerm = S => ((S.q - 1) % TERM) + 1;
  const when = S => 'Year ' + (Math.floor((S.q - 1) / 4) + 1) + ', ' + SEASONS[(S.q - 1) % 4];
  const campaign = S => qInTerm(S) >= TERM - 3;
  const lawMods = S => { const m = { gr: 0, un: 0, in: 0, st: 0, sd: 0, rev: 0, cost: 0 }; S.laws.forEach(id => { const L = LAWS.find(l => l.id === id); if (L && L.m) Object.keys(L.m).forEach(k => { m[k] += L.m[k]; }); }); return m; };
  function money(S, B) {
    B = B || S.budget; const m = lawMods(S), rev = S.gdp / 4 * (.6 * B.ti + .25 * B.tc) / 100 + m.rev, interest = S.debt * .045 / 4;
    const spend = B.h + B.e + B.d + B.i + B.wf + m.cost + interest; return { rev: r1(rev), spend: r1(spend), interest: r1(interest), deficit: r1(spend - rev) };
  }
  /* where each group's approval is heading under a budget (the budget screen previews this) */
  function targets(S, B) {
    B = B || S.budget; const dTi = B.ti - 30, dTc = B.tc - 25, dH = B.h - 14, dE = B.e - 12, dI = B.i - 10, dW = B.wf - 14, dD = B.d - 10;
    const uX = S.unemp - 6, iX = Math.max(0, S.infl - 2.5), g = S.growth - 2, st = S.stab - 60;
    const t = {
      w: 50 - 3 * uX - .5 * dTi + .35 * dTc + 1 * dW + .4 * dH - 2 * iX + 1.2 * g,
      b: 50 + 3 * g - 1.4 * dTc - .5 * dTi + .6 * dI - 1.5 * iX - .3 * dW + .1 * st,
      f: 50 + 1.5 * g + 1 * dI - 2 * iX - .4 * dTi + .1 * st,
      y: 50 + 1.6 * dE - 2.2 * uX - .3 * dTi + .3 * dW - 1 * iX + .08 * (S.sd - 50),
      r: 50 + 1.8 * dH - 3 * iX + .4 * dW + .15 * st - .2 * dTi + .2 * dD
    };
    const tired = .35 * (qInTerm(S) - 1) + (S.term - 1) * 3;   // voters tire of any government as a term wears on
    BIDS.forEach(b => { t[b] = clamp(t[b] + S.perm[b] + S.mood[b] - tired, 3, 97); }); return t;
  }
  function applyFx(S, fx, scale) {
    fx = fx || {}; scale = scale == null ? 1 : scale; const all = (fx.all || 0) * scale;
    BIDS.forEach(b => { const d = (fx[b] || 0) * scale + all; if (d) { S.ap[b] = clamp(S.ap[b] + d, 3, 97); S.mood[b] = clamp(S.mood[b] + d, -30, 30); } });
    if (fx.cash) S.debt = Math.max(0, S.debt - fx.cash * scale);
    if (fx.gs) S.gs += fx.gs * scale; if (fx.is) S.is += fx.is * scale; if (fx.un) S.unemp = clamp(S.unemp + fx.un * scale, 1.5, 25);
    if (fx.st) S.stab = clamp(S.stab + fx.st * scale, 0, 100); if (fx.sd) S.sd = clamp(S.sd + fx.sd * scale, 0, 100);
    if (fx.gw) S.gw = clamp(S.gw + fx.gw * scale, 0, 100); if (fx.pc) S.pc = clamp(S.pc + fx.pc * scale, 0, 60);
  }
  const FXN = { w: 'Workers', b: 'Business', f: 'Farmers', y: 'Young', r: 'Retirees', all: 'Everyone', cash: 'Treasury', gs: 'Growth', is: 'Inflation', st: 'Stability', sd: 'Standing', gw: 'Assembly goodwill', pc: 'Capital', un: 'Unemployment' };
  const fxText = fx => Object.keys(fx || {}).filter(k => FXN[k] && fx[k]).map(k => { const v = fx[k], good = (k === 'is' || k === 'un') ? v < 0 : v > 0; return { k, label: FXN[k], v, good, s: (v > 0 ? '+' : '') + v + (k === 'gs' || k === 'is' || k === 'un' ? ' pts' : k === 'cash' ? ' bn' : '') }; });

  /* ---------- advisors ---------- */
  function advScore(S, aid, fx) {
    fx = fx || {}; const g = k => fx[k] || 0;
    if (aid === 'tr') return g('cash') + g('gs') * 8 - g('is') * 6 - g('un') * 4 + g('b') * .2;
    if (aid === 'in') return g('st') * 1.5 + g('all') * 1.2 + (g('w') + g('y') + g('r') + g('f')) * .2;
    if (aid === 'fo') return g('sd') * 1.5 + g('st') * .5 + g('gs') * 2;
    return BLOCS.reduce((a, b) => a + b.share * (g(b.id) + g('all')), 0) / 100 * 3 + g('pc') * .5 + g('gw') * .3;
  }
  const advice = (S, ev) => S.adv.map(a => { let best = 0, bs = -1e9; ev.choices.forEach((c, i) => { const s = advScore(S, a.id, c.fx); if (s > bs) { bs = s; best = i; } }); return { id: a.id, pick: best }; });
  function advisorText(S, aid, ev) {
    const a = S.adv.find(x => x.id === aid), A = ADVISORS.find(x => x.id === aid), p = advice(S, ev).find(x => x.id === aid).pick, c = ev.choices[p];
    const why = { tr: 'It is the cheapest for the treasury and the kindest to growth.', in: 'It keeps the streets calm and the most people content.', fo: 'It protects our name abroad and our security.', cs: 'It polls best with the voters we need, and it costs you the least in the Assembly.' }[aid];
    return a.name + ' (' + A.role + '): "Choose “' + c.t + '”. ' + why + '"';
  }

  /* ---------- events ---------- */
  function eligible(S, e) { if (e.minQ && S.q < e.minQ) return false; if (e.debt && S.debt / S.gdp < e.debt) return false; return !S.seen.slice(-14).includes(e.id); }
  function drawEvents(S) {
    S.ev = []; const n = qInTerm(S) === TERM - 1 ? 1 : (R(S) < .35 ? 2 : 1);
    if (qInTerm(S) === TERM - 1) S.ev.push(JSON.parse(JSON.stringify(DEBATE)));
    for (let i = 0; i < n; i++) {
      let pool = EVENTS.filter(e => eligible(S, e) && !S.ev.some(x => x.id === e.id)); if (!pool.length) pool = EVENTS.filter(e => !S.ev.some(x => x.id === e.id));
      const crisisOk = S.q > 2, wpool = pool.filter(e => crisisOk || !e.crisis), e = wpool[Math.floor(R(S) * wpool.length)]; if (!e) break;
      S.ev.push(JSON.parse(JSON.stringify(e))); S.seen.push(e.id); if (S.seen.length > 40) S.seen.shift();
    }
  }
  /* an event the local AI wrote, cleaned up: short text, 2 to 3 choices, known effect keys only, each effect kept small */
  function cleanEvent(o) {
    if (!o || typeof o !== 'object') return null; const str = (v, n) => String(v == null ? '' : v).replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, n);
    const title = str(o.title, 70), text = str(o.text, 300), lim = { cash: 12, gs: .8, is: .6, un: .5, pc: 4 };
    if (!title || !text || !Array.isArray(o.choices)) return null;
    const choices = o.choices.slice(0, 3).map(c => { const fx = {}; Object.keys((c && c.fx) || {}).forEach(k => { if (!FXN[k]) return; const v = Number(c.fx[k]); if (!isFinite(v) || !v) return; const L = lim[k] || 8; fx[k] = Math.round(clamp(v, -L, L) * 10) / 10; }); return { t: str(c && (c.t || c.text || c.label), 60), fx }; }).filter(c => c.t);
    if (choices.length < 2) return null; return { id: 'ai' + Math.abs(title.length * 7919 + text.length), icon: str(o.icon, 4) || '📨', title, text, choices, ai: 1 };
  }
  function choose(S, idx, ci) {
    const ev = S.ev[idx]; if (!ev || ev.done != null || S.phase !== 'play') return null; const c = ev.choices[ci]; if (!c) return null;
    const adv = advice(S, ev); applyFx(S, c.fx); ev.done = ci; log(S, ev.icon + ' ' + ev.title + ': you chose “' + c.t + '”.');
    const gone = [];
    S.adv.forEach(a => { const rec = adv.find(x => x.id === a.id).pick; if (ev.choices.length < 2) return; a.trust = clamp(a.trust + (rec === ci ? 3 : -2), 0, 100); if (a.trust < 15) gone.push(a); });
    gone.forEach(a => { const A = ADVISORS.find(x => x.id === a.id), old = a.name; a.n = (a.n + 1) % A.names.length; a.name = A.names[a.n]; a.trust = 55; applyFx(S, { all: -2, st: -2 }); log(S, '📰 ' + old + ' resigned as ' + A.role + ', saying you never listen. ' + a.name + ' takes the post.'); });
    return { gone: gone.map(a => a.id) };
  }
  const pendingEvents = S => S.ev.filter(e => e.done == null).length;

  /* ---------- the Assembly ---------- */
  function votes(S, id) {
    const L = LAWS.find(l => l.id === id); if (!L) return 0; const fit = (L.fit && L.fit[S.party]) || 0;
    const own = S.seats * clamp(.8 + .12 * fit + (S.gw - 50) / 400, 0, 1), opp = (100 - S.seats) * clamp(L.appeal * .55 + (S.gw - 50) / 220 + (overall(S) - 50) / 300, 0, 1);
    return Math.round(own + opp + S.whip);
  }
  function propose(S, id) {
    const L = LAWS.find(l => l.id === id); if (!L || S.laws.includes(id) || S.phase !== 'play') return { ok: false, why: 'not available' };
    if (S.billQ === S.q) return { ok: false, why: 'One bill a quarter. Try again next quarter.' }; if (S.pc < L.pc) return { ok: false, why: 'Not enough political capital.' };
    S.pc -= L.pc; S.billQ = S.q; const yes = clamp(votes(S, id) + Math.round((R(S) - .5) * 6), 0, 100); S.whip = 0;
    if (yes >= 51) { S.laws.push(id); BIDS.forEach(b => { const d = (L.perm && L.perm[b]) || 0; S.perm[b] += d; S.ap[b] = clamp(S.ap[b] + d * .5, 3, 97); }); if (L.fx) applyFx(S, L.fx); S.gw = clamp(S.gw + 2, 0, 100); log(S, '⚖️ The ' + L.name + ' passed, ' + yes + ' to ' + (100 - yes) + '.'); return { ok: true, passed: true, yes }; }
    S.gw = clamp(S.gw - 3, 0, 100); applyFx(S, { all: -1 }); log(S, '❌ The ' + L.name + ' failed, ' + yes + ' to ' + (100 - yes) + '.'); return { ok: true, passed: false, yes };
  }
  function whip(S) { if (S.pc < 3 || S.whip >= 12) return false; S.pc -= 3; S.whip += 4; S.gw = clamp(S.gw - 1, 0, 100); return true; }
  function speech(S, b) { const used = S.speeches[S.q] || 0, cost = 4 + used * 2; if (!BIDS.includes(b) || S.pc < cost) return false; S.pc -= cost; S.speeches = {}; S.speeches[S.q] = used + 1; applyFx(S, { [b]: 4 }); log(S, '🎙️ You addressed the nation, speaking to ' + BLOCS.find(x => x.id === b).name.toLowerCase() + '.'); return true; }
  function rally(S, p) { if (!campaign(S) || !PROV.some(x => x.id === p) || S.pc < 5 || (S.rally[p] || 0) >= 8) return false; S.pc -= 5; S.rally[p] = (S.rally[p] || 0) + 2.5; log(S, '📣 You held a rally in ' + PROV.find(x => x.id === p).name + '.'); return true; }

  /* ---------- the quarter ---------- */
  function snap(S) { return { q: S.q, ap: overall(S), g: r1(S.growth), u: r1(S.unemp), i: r1(S.infl), d: Math.round(S.debt / S.gdp * 100) }; }
  function endQuarter(S) {
    if (S.phase !== 'play' || pendingEvents(S)) return null;
    S.cyc = (S.cyc || 0) * .7 + (R(S) - .5) * 1.6;   // the business cycle: booms and slumps you did not cause
    const B = S.budget, m = lawMods(S), mo = money(S), defPct = mo.deficit / (S.gdp / 4) * 100, ratio = S.debt / S.gdp;
    const g = 2 + .08 * (B.i - 10) + .04 * (B.e - 12) + .02 * (B.h - 14) - .05 * (B.ti - 30) - .07 * (B.tc - 25) + m.gr + S.gs + (S.sd - 50) * .01 + (S.stab - 60) * .01 + defPct * .05 + S.cyc + (R(S) - .5) * .8 - Math.max(0, ratio - .9) * 4;
    S.growth = clamp(g, -9, 9); S.gdp *= 1 + S.growth / 400; S.debt = Math.max(0, S.debt + mo.deficit);
    S.unemp = clamp(S.unemp + (6 - (S.growth - 2) * .6 + m.un - S.unemp) * .4, 1.5, 25);
    S.infl = clamp(S.infl + (2.5 + defPct * .25 + m.in + S.is + Math.max(0, S.growth - 3) * .3 - S.infl) * .45, -2, 30);
    S.stab = clamp(S.stab + (60 + .8 * (B.d - 10) + .5 * (B.wf - 14) + .3 * (B.h - 14) - 2 * Math.max(0, S.unemp - 6) - 1.5 * Math.max(0, S.infl - 3.5) + m.st + (overall(S) - 50) * .2 - S.stab) * .35, 0, 100);
    S.sd = clamp(S.sd + (50 + .4 * (B.d - 10) + m.sd - S.sd) * .15, 0, 100);
    const t = targets(S); BIDS.forEach(b => { S.ap[b] = clamp(S.ap[b] + (t[b] - S.ap[b]) * .4 + (R(S) - .5) * 1.5, 3, 97); S.mood[b] *= .8; });
    S.gs *= .55; S.is *= .55; const ov = overall(S); S.pc = clamp(S.pc + 3 + Math.round(ov / 12), 0, 60); S.gw = clamp(S.gw + (50 - S.gw) * .05, 0, 100);
    const qi = qInTerm(S), out = { midterm: null, election: false, impeach: null, collapse: false };
    if (S.stab <= 5) { S.phase = 'over'; S.over = { why: 'collapse', text: 'Riots spread from Valmont to every province. The army asked you to step down, and the Assembly named a caretaker government.' }; out.collapse = true; }
    if (!S.over) { if (ov < 22) S.low++; else S.low = 0; if (S.low >= 2) { const keep = S.seats + S.gw / 5 >= 45; out.impeach = keep ? 'survived' : 'removed'; if (keep) { S.low = 0; S.gw = clamp(S.gw - 10, 0, 100); log(S, '⚠️ The Assembly held an impeachment vote. Your party held firm and you survived.'); } else { S.phase = 'over'; S.over = { why: 'impeached', text: 'With approval below 22% for half a year, the Assembly voted to remove you from office.' }; } } }
    if (!S.over && qi === TERM / 2) { const old = S.seats; S.seats = clamp(Math.round(50 + (ov - 48) * .8 + (R(S) - .5) * 8), 25, 75); out.midterm = { old, seats: S.seats }; log(S, '🗳️ Midterm elections: your party now holds ' + S.seats + ' seats (was ' + old + ').'); }
    S.hist.push(snap(S)); if (S.hist.length > 40) S.hist.shift();
    if (!S.over && qi === TERM) { S.phase = 'election'; out.election = true; return out; }
    if (!S.over) { S.q++; drawEvents(S); log(S, '— ' + when(S) + ' begins. Approval ' + ov + '%.'); }
    return out;
  }

  /* ---------- the presidential election ---------- */
  function provinceShare(S, p, noise) { const base = BIDS.reduce((a, b) => a + p.mix[b] * S.ap[b], 0); return clamp(50 + (base - 50) * .9 + (S.rally[p.id] || 0) + (noise || 0), 5, 95); }
  function forecast(S) { return PROV.map(p => ({ id: p.id, name: p.name, ev: p.ev, share: r1(provinceShare(S, p, 0)) })); }
  function runElection(S) {
    if (S.phase !== 'election') return null;
    const res = PROV.map(p => { const share = r1(provinceShare(S, p, (R(S) - .5) * 7)); return { id: p.id, name: p.name, ev: p.ev, share, won: share > 50 }; });
    const ev = res.reduce((a, r) => a + (r.won ? r.ev : 0), 0), pop = r1(res.reduce((a, r) => a + r.share * r.ev, 0) / EV_TOTAL), won = ev >= EV_WIN;
    S.result = { term: S.term, res, ev, pop, won, rival: S.rival }; S.rally = {};
    if (won) { S.wins++; log(S, '🏆 You won the election with ' + ev + ' of ' + EV_TOTAL + ' electoral votes against ' + S.rival + '.'); }
    else log(S, '🏳️ You lost the election to ' + S.rival + ', ' + ev + ' to ' + (EV_TOTAL - ev) + '.');
    if (!won) { S.phase = 'over'; S.over = { why: 'lost', text: S.rival + ' won ' + (EV_TOTAL - ev) + ' electoral votes to your ' + ev + '. You hand over the keys to the Residence.' }; }
    else if (S.term >= 2) { S.phase = 'over'; S.over = { why: 'done', text: 'You won two elections and served the most the constitution allows. Velmora remembers you.' }; }
    else S.phase = 'won';
    return S.result;
  }
  function secondTerm(S) {
    if (S.phase !== 'won') return false; S.term = 2; S.phase = 'play'; S.q++; S.rival = RIVALS.filter(r => r !== S.rival)[Math.floor(R(S) * (RIVALS.length - 1))];
    S.seats = clamp(S.seats + 4, 25, 75); S.pc += 6; drawEvents(S); log(S, '🎖️ Your second term begins. Your new rival is ' + S.rival + '.'); return true;
  }
  function retire(S) { if (S.phase !== 'won') return false; S.phase = 'over'; S.over = { why: 'retired', text: 'You won re-election, then chose to step aside on a high note.' }; return true; }
  function legacy(S) {
    const h = S.hist, avgG = h.reduce((a, x) => a + x.g, 0) / Math.max(1, h.length);
    return Math.max(0, Math.round(overall(S) * 10 + avgG * 60 + S.laws.length * 25 + S.wins * 400 + S.sd * 2 + S.stab * 2 - Math.max(0, S.debt / S.gdp - .6) * 300));
  }
  function load(json) {
    try { const S = typeof json === 'string' ? JSON.parse(json) : json; if (!S || S.v !== 1 || !S.ap || !S.budget || !Array.isArray(S.ev)) return null; BIDS.forEach(b => { if (typeof S.ap[b] !== 'number' || !isFinite(S.ap[b])) S.ap[b] = 50; S.mood[b] = S.mood[b] || 0; S.perm[b] = S.perm[b] || 0; }); return S; } catch (e) { return null; }
  }

  const api = { TERM, BLOCS, PROV, PARTIES, ADVISORS, LAWS, EVENTS, DEBATE, EV_TOTAL, EV_WIN, FXN, newGame, load, overall, qInTerm, when, campaign, money, targets, applyFx, fxText, advice, advisorText, cleanEvent, choose, pendingEvents, votes, propose, whip, speech, rally, endQuarter, forecast, runElection, secondTerm, retire, legacy, lawMods };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.PresSim = api;
})(typeof window !== 'undefined' ? window : this);

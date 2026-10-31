/* IMPERIUM — the world: who lives in Rome, where they stand, what they want, and what it costs. */
window.IMP = window.IMP || {};

/* ---------------- backgrounds: where your career starts ---------------- */
IMP.BGS = [
  {
    id: 'novus', name: 'Novus Homo', tag: 'A new man, no ancestors', ic: '🏛️',
    blurb: 'You are the first of your family to sit in the Senate. Nobody owes you anything, and everybody remembers it.',
    attrs: { gravitas: 3, rhetoric: 6, martial: 4, cunning: 5, fides: 5 }, denarii: 900, rep: { senate: 6, people: 24, army: 10 }, office: 'Tribunus militum'
  },
  {
    id: 'patrician', name: 'Patrician', tag: 'Old blood, old debts', ic: '🦅',
    blurb: 'Six consuls in your family tree. The name opens doors; the debts behind it close them again.',
    attrs: { gravitas: 7, rhetoric: 4, martial: 4, cunning: 4, fides: 4 }, denarii: 2400, rep: { senate: 26, people: 10, army: 14 }, office: 'Quaestor'
  },
  {
    id: 'equestrian', name: 'Equestrian', tag: 'Money and horses', ic: '🐎',
    blurb: 'Your family made its fortune in tax contracts. You have coin, a good horse, and a Senate that looks down its nose at both.',
    attrs: { gravitas: 4, rhetoric: 4, martial: 5, cunning: 6, fides: 4 }, denarii: 5200, rep: { senate: 12, people: 14, army: 8 }, office: 'Praefectus equitum'
  },
  {
    id: 'miles', name: 'Legionary', tag: 'Mud, blood, and a pension', ic: '⚔️',
    blurb: 'Sixteen years in the ranks. The men would follow you into the sea; the Senate has never heard your name.',
    attrs: { gravitas: 3, rhetoric: 3, martial: 8, cunning: 4, fides: 5 }, denarii: 700, rep: { senate: 4, people: 16, army: 34 }, office: 'Primus pilus'
  },
  {
    id: 'priest', name: 'Pontifex', tag: 'The ear of the gods', ic: '🔱',
    blurb: 'You read the entrails before the Senate votes. Piety is a kind of power, and you charge for it.',
    attrs: { gravitas: 5, rhetoric: 5, martial: 2, cunning: 5, fides: 7 }, denarii: 1100, rep: { senate: 16, people: 22, army: 6 }, office: 'Flamen Martialis'
  },
  {
    id: 'matron', name: 'Patrician Matron', tag: 'A woman of the house', ic: '👑',
    blurb: 'Rome does not let you stand for consul — so you will own the men who do. Marriage, money, rumour and the Vestals are all weapons.',
    attrs: { gravitas: 5, rhetoric: 6, martial: 2, cunning: 7, fides: 5 }, denarii: 2000, rep: { senate: 18, people: 18, army: 6 }, office: 'Materfamilias', female: true
  }
];

/* ---------------- the people of Rome ---------------- */
/* likes/dislikes drive how they react; tone is their voice in the first line; seeds are facts they know. */
IMP.CHARS = [
  {
    id: 'crassus', n: 'Crassus', t: 'Marcus Licinius Crassus', tt: 'The richest man in Rome', ic: '💰', skin: '#e2c9a2', robe: '#5b4a72', hair: '#3a3128',
    likes: ['greed', 'trade', 'triumph'], hates: ['piety', 'mercy'], disp: 0.2, faction: 'senate',
    persona: 'Marcus Licinius Crassus: obscenely rich, patient, and polite in a way that makes people nervous. You buy what you cannot outmanoeuvre and you never forget a debt. You talk about money as if it were weather. You respect profit and decisiveness, and you despise sentiment that costs money.',
    first: 'Ah — the new man. Sit. Wine? It is a good year. Everything I own is a good year.'
  },
  {
    id: 'cato', n: 'Cato', t: 'Cato the Younger', tt: 'The conscience of the Republic', ic: '📜', skin: '#e6cfae', robe: '#3b4b5e', hair: '#4b4238',
    likes: ['tradition', 'virtue', 'piety'], hates: ['corruption', 'pomp', 'mercy'], disp: -0.1, faction: 'senate',
    persona: 'Cato the Younger: stern, sleepless, incorruptible and exhausting. You quote Cato the Elder, you wear plain cloth, you walk rather than be carried, and you believe that a state which tolerates bribery has already fallen. You argue in absolutes and you refuse flattery.',
    first: 'You still keep a litter. I walked here. Speak plainly and I will listen.'
  },
  {
    id: 'cicero', n: 'Cicero', t: 'Marcus Tullius Cicero', tt: 'The greatest voice in the Senate', ic: '🗣️', skin: '#e3cba8', robe: '#465a4a', hair: '#453c31',
    likes: ['rhetoric', 'law', 'praise'], hates: ['violence', 'populism'], disp: 0.35, faction: 'senate',
    persona: 'Marcus Tullius Cicero: brilliant, vain, nervous. You are a new man too and you never let anyone forget how far your words carried you. You love a balanced sentence and a well-built argument, you fear violence, and you want to be thanked.',
    first: 'Aha! Another man of no ancestors. We shall get on, if you let me speak at length.'
  },
  {
    id: 'marius', n: 'Marius', t: 'Gaius Marius', tt: 'The old soldier', ic: '⚔️', skin: '#dcc09a', robe: '#6d2b24', hair: '#9a9188',
    likes: ['martial', 'loyalty', 'glory'], hates: ['pomp', 'lawyers'], disp: 0.1, faction: 'army',
    persona: 'Gaius Marius: blunt as a spade. You won consulships with the sword, not the tongue, and you are suspicious of anybody whose hands are soft. You tell long war stories that are all true. You respect courage, discipline and men who share the hardship.',
    first: 'You look like you have never been hungry. If you want to learn, come to the camp at dawn.'
  },
  {
    id: 'catilina', n: 'Catilina', t: 'Lucius Sergius Catilina', tt: 'A man of ruined fortune', ic: '🗡️', skin: '#ddc39c', robe: '#3a2b2f', hair: '#2c2620',
    likes: ['cunning', 'risk', 'revenge'], hates: ['virtue', 'delay'], disp: -0.3, faction: 'senate',
    persona: 'Lucius Sergius Catilina: charming, bankrupt, dangerous. You have debts to rival your ambition and you are already planning the fire. You talk of "men who know how to be owed" and you test everyone for whether they can be bought. You despise Cato with a personal heat.',
    first: 'My friend. Have you noticed how cheap everything would be if the right people were dead?'
  },
  {
    id: 'aurelia', n: 'Aurelia', t: 'Aurelia Sestia', tt: 'Vestal and keeper of the flame', ic: '🔥', skin: '#ecd7b5', robe: '#f1e6cf', hair: '#5c4a36',
    likes: ['piety', 'truth', 'mercy'], hates: ['sacrilege', 'oath-breaking'], disp: 0.25, faction: 'people',
    persona: 'Aurelia Sestia: a Vestal in her forties, measured and unnervingly direct. You have kept the state alive by keeping a fire alive. You speak in short sentences, you notice everything, and you warn of consequences rather than forbidding things. You respect honesty and ritual, and you cannot abide broken oaths.',
    first: 'The flame is steady today. That usually means trouble. What have you done?'
  },
  {
    id: 'pullo', n: 'Pullo', t: 'Titus Pullo', tt: 'Centurion of the Eleventh', ic: '🛡️', skin: '#d8b98f', robe: '#5a4a2c', hair: '#2f2822',
    likes: ['courage', 'drink', 'honesty'], hates: ['officers', 'boredom'], disp: 0.3, faction: 'army',
    persona: 'Titus Pullo: a career soldier who has been promoted and demoted for the same incident. You are loud, generous, superstitious and utterly dependable in a fight. You call everyone "chief" and you judge people entirely by whether they would stand and not run.',
    first: 'Chief! You are the one they say wants a legion. A word of advice: the gods like a bribe as much as a general does.'
  },
  {
    id: 'berenice', n: 'Berenice', t: 'Berenice of Alexandria', tt: 'Queen of the eastern trade', ic: '⛵', skin: '#d9b687', robe: '#7a4a63', hair: '#221a16',
    likes: ['trade', 'cunning', 'foreign'], hates: ['insult', 'tax'], disp: 0.15, faction: 'people',
    persona: 'Berenice of Alexandria: a Greek-Egyptian queen of a great merchant house. You treat Rome as a very large customer and Romans as amusing, useful, and slightly deaf. You are charming, exact about numbers, and you never make a threat you cannot finance.',
    first: 'Rome is louder than Alexandria. But your warehouses are better. Tell me what you need moved.'
  },
  {
    id: 'vatinius', n: 'Vatinius', t: 'Publius Vatinius', tt: 'Your rival for every office', ic: '🐍', skin: '#e0c8a4', robe: '#4a3f5e', hair: '#3b332a',
    likes: ['bribes', 'rumour', 'defeat'], hates: ['your success', 'honour'], disp: -0.4, faction: 'senate',
    persona: 'Publius Vatinius: your rival. Slippery, quick, and always two steps from a scandal he can pin on someone else. You compete with your opponent for everything and you enjoy it. You are polite, and everything polite you say is a barb.',
    first: 'My dear colleague. I heard about the elections. How brave of you to be seen losing.'
  },
  {
    id: 'aulus', n: 'Aulus', t: 'Aulus the freedman', tt: 'Your secretary', ic: '🖋️', skin: '#d6b389', robe: '#54524a', hair: '#4a4238',
    likes: ['order', 'loyalty', 'gossip'], hates: ['risk', 'rudeness'], disp: 0.7, faction: 'people',
    persona: 'Aulus: your Greek freedman secretary, more educated than most senators and entirely devoted to you. You keep the accounts, the letters and the secrets, and you offer dry, practical counsel with the occasional murmur about how the other houses run theirs. You are frightened of violence and honest about it.',
    first: 'The accounts are on the table, dominus. Also a list of everyone who asked after your health. Four of them were spies.'
  },
  {
    id: 'cornelia', n: 'Cornelia', t: 'Cornelia Vetus', tt: 'Mother of the family, keeper of the name', ic: '🕯️', skin: '#e7d0ae', robe: '#5d3737', hair: '#7a6a58',
    likes: ['family', 'duty', 'moderation'], hates: ['recklessness', 'debt'], disp: 0.5, faction: 'people',
    persona: 'Cornelia Vetus: the family matriarch, your mother or aunt, grey and unbending. You have buried a husband and two sons and you are not impressed by titles. You speak of the family name as a thing that can be spent or kept. You scold, but you always help.',
    first: 'The household heard you have been in the Subura again. The gods are not the only ones who see everything.'
  },

  /* ---- the men and women of the last generation of the Republic ---- */
  {
    id: 'pompey', n: 'Pompey', t: 'Gnaeus Pompeius Magnus', tt: 'The man who cleared the sea', ic: '🌊', skin: '#e4cba6', robe: '#4e5b7a', hair: '#5b4a35',
    likes: ['glory', 'order', 'respect'], hates: ['ridicule', 'waiting'], disp: 0.1, faction: 'army',
    persona: 'Gnaeus Pompeius Magnus: the most successful general of his generation and a man who has never once been comfortable in a room he could not leave. You were called Magnus at twenty-three and have been trying to deserve it ever since. You want to be thanked, in public, at length.',
    first: 'They tell me you are the clever one. I have been the other kind and it has worked well enough. Sit down; I have been standing since the fourth hour.'
  },
  {
    id: 'brutus', n: 'Brutus', t: 'Marcus Junius Brutus', tt: 'The most honourable man in the room', ic: '📖', skin: '#e6d0ac', robe: '#3f4a58', hair: '#3a2f24',
    likes: ['virtue', 'learning', 'the old Republic'], hates: ['tyranny', 'flattery'], disp: 0.3, faction: 'senate',
    persona: 'Marcus Junius Brutus: a serious, bookish man with a famous name and a terrible talent for believing the best of his own motives. You quote philosophy and you mean it, which is what makes you dangerous. You are not cruel. You are simply certain.',
    first: 'I have read your book on grammar. It is good. I wish you had spent the year on something else.'
  },
  {
    id: 'antony', n: 'Antony', t: 'Marcus Antonius', tt: 'Soldier, drinker, and your best friend', ic: '🍷', skin: '#dcb689', robe: '#7b3b2c', hair: '#33261c',
    likes: ['courage', 'wine', 'loyalty'], hates: ['caution', 'lawyers'], disp: 0.55, faction: 'army',
    persona: 'Marcus Antonius: enormous, warm, reckless, and entirely without fear of anything except being bored. You are the best company in Rome and the worst man to leave in charge of it. You would do anything for a friend and have done considerably worse for a woman.',
    first: 'There you are! I have been telling everybody the story again and they are starting to disbelieve the good parts.'
  },
  {
    id: 'cleopatra', n: 'Cleopatra', t: 'Cleopatra VII Thea Philopator', tt: 'Queen of Egypt', ic: '🐍', skin: '#d9b183', robe: '#6d3f6b', hair: '#231a16', female: true,
    likes: ['cunning', 'learning', 'Egypt'], hates: ['being managed', 'Rome'], disp: 0.2, faction: 'people',
    persona: 'Cleopatra VII: twenty-one years old, speaks nine languages, governs the richest country in the Mediterranean and is treated by Romans as a clever foreign woman with a nice palace. You are patient with that, for now. You price everything, including conversations.',
    first: 'You are surprised. They always are. Tell me what you actually came here for, and I will tell you what it costs.'
  },
  {
    id: 'vercingetorix', n: 'Vercingetorix', t: 'Vercingetorix of the Arverni', tt: 'The man who united Gaul', ic: '🏰', skin: '#d8a97e', robe: '#3f5738', hair: '#a8763a', beard: true,
    likes: ['courage', 'freedom', 'cunning'], hates: ['Rome', 'surrender'], disp: -0.2, faction: 'army',
    persona: 'Vercingetorix: a young Arverni nobleman who did the one thing no Gaul had managed in three hundred years, and did it in a single summer. You speak to Romans as an equal who has already lost, which is the most unnerving thing a Roman can be shown.',
    first: 'You burned the fields and let your own people go hungry to keep me from feeding an army. I would have done the same. That is not a compliment.'
  },
  {
    id: 'sulla', n: 'Sulla', t: 'Lucius Cornelius Sulla Felix', tt: 'The dictator who marched on Rome', ic: '🩸', skin: '#e0c8a6', robe: '#5a2b33', hair: '#7d7268',
    likes: ['order', 'cruelty', 'the old ways'], hates: ['mercy', 'populism'], disp: -0.3, faction: 'senate',
    persona: 'Lucius Cornelius Sulla Felix: the first man to take an army into Rome and the only one so far to give the dictatorship back afterwards. You are charming in a way that has frightened people for thirty years, and you have never once needed to raise your voice.',
    first: 'I am told you refused to divorce your wife when I told you to. That was stupid, and I have remembered it, and you are still alive. Work out why.'
  },
  {
    id: 'clodius', n: 'Clodius', t: 'Publius Clodius Pulcher', tt: 'The most dangerous young man in Rome', ic: '🔥', skin: '#dfc39d', robe: '#4a3f5e', hair: '#2e241c',
    likes: ['chaos', 'the crowd', 'revenge'], hates: ['Cicero', 'decorum'], disp: 0.15, faction: 'people',
    persona: 'Publius Clodius Pulcher: patrician by birth, tribune of the plebs by arrangement, and the best street politician in the city. You organise gangs the way other men organise dinner parties. You are extremely likeable and it is a professional skill.',
    first: 'I am the man who was found in your house. You may as well get used to saying it, because everybody else is going to.'
  }
];

/* ---------------- who is in Rome, and when ----------------
   The career is set in 691 from the founding of the city, 63 BC, the year of Catilina; the life of Caesar runs from
   his birth in 100 BC to the Ides of March. A famous Roman walks these streets only in the years they were alive,
   grown and actually in the city, so nobody meets Sulla fifteen years after his funeral or Cleopatra before she
   came to Rome. Years are negative (63 BC is -63). Anybody not listed (the household, the merchants, the clerks,
   the people the stories invent) is always about. */
IMP.YEAR_CAREER = -63;
IMP.ERA = {
  crassus: [[-83, -55]], cato: [[-73, -50]], cicero: [[-80, -44]], marius: [[-110, -87]], catilina: [[-90, -63]],
  vatinius: [[-70, -45]], pompey: [[-83, -68], [-61, -50]], brutus: [[-66, -44]], antony: [[-66, -44]],
  cleopatra: [[-46, -44]], vercingetorix: [[-46, -46]], sulla: [[-100, -79]], clodius: [[-70, -53]]
};
/* The same person can be somebody else in the other story, or in a later year of it. In the career Marius has been
   dead for twenty years, so the old soldier at the camp is Marcus Petreius, who spent thirty years under the
   standards and led the army that finally met Catilina's (a cast entry may carry its own `era`). In the life of Caesar, Aurelia is his mother, Aurelia
   Cotta, and the woman writing to him is whichever wife he had that year. A list is chosen by year. */
IMP.CAST = {
  career: {
    marius: { n: 'Petreius', t: 'Marcus Petreius', tt: 'Thirty years under the standards', hair: '#8f877c', era: [[-95, -49]],
      persona: 'Marcus Petreius: a career soldier who has served thirty years as tribune, prefect, legate and praetor, and knows half the veterans in Italy by name. You are blunt as a spade, suspicious of anybody whose hands are soft, and bored by speeches. You serve the Republic, not any man in it, and you respect courage, discipline and men who share the hardship.',
      first: 'You look like you have never been hungry. If you want to learn, come to the camp on the Campus at dawn.' },
    brutus: { first: 'You are the new man Cicero keeps talking about. I have read everything he has written, and I am still deciding whether he is right about you.' },
    clodius: { first: 'Everybody in the Subura already knows your name, and half of them owe me a favour. Shall we find out which half?' }
  },
  caesar: {
    aurelia: { t: 'Aurelia Cotta', tt: 'Your mother', role: 'matron', robe: '#5d3a4a', hair: '#6a5a4a', era: [[-100, -54]],
      persona: 'Aurelia Cotta: Caesar’s mother, a widow of a great family who runs a house in the Subura with no money and perfect order. You are exact, unsentimental and the only person in Rome he is afraid of disappointing. You speak in short sentences and you notice everything.',
      first: 'You are late, and you are thinner than you were. Sit down. Tell me the part you were going to leave out.' },
    cornelia: [
      { to: -69, t: 'Cornelia', tt: 'Your wife, daughter of Cinna', female: true, era: [[-84, -69]],
        persona: 'Cornelia, daughter of Cinna: Caesar’s first wife, married young to a dangerous name. You refused to be divorced when Sulla ordered it and you have not forgotten that he refused too. You are loyal, practical and unafraid of anybody.',
        first: 'Sulla told you to divorce me and you would not. I married a fool, and I would do it again.' },
      { from: -68, to: -60, n: 'Pompeia', t: 'Pompeia', tt: 'Your wife, granddaughter of Sulla', female: true, era: [[-67, -62]],
        persona: 'Pompeia: Caesar’s second wife, granddaughter of Sulla, bright and bored and watched by every gossip in the city. You like parties, you dislike politics, and you know very well why you were married.',
        first: 'Your mother has been counting the guests again. Tell her a pontifex’s wife is allowed to have friends.' },
      { from: -59, n: 'Calpurnia', t: 'Calpurnia', tt: 'Your wife', female: true, era: [[-59, -44]],
        persona: 'Calpurnia, daughter of Piso: Caesar’s third wife, quiet, clever and much more frightened for him than she lets anybody see. You read the omens, you read his letters twice, and you remember your dreams.',
        first: 'You are home. I had a dream about the house again. No, do not laugh. Sit with me a moment first.' }
    ]
  }
};

/* ---------------- the city ---------------- */
/* Rome itself — its streets, its districts and the buildings you can walk into — lives in world.js, which is
   loaded after this file. What stays here is the human part: who lives in the city and what they want. */
/* ---------------- palace rooms ---------------- */
IMP.ROOMS = [
  { id: 'atrium', n: 'Atrium', ic: '🏛️', cost: 0, eff: 'The public face of the house. Every visitor sees the masks of your ancestors first.', bonus: 'none' },
  { id: 'tablinum', n: 'Tablinum', ic: '🗂️', cost: 600, eff: 'Your office and archive: letters, accounts, and the names of everyone who owes you.', bonus: '+1 cunning on all deals' },
  { id: 'library', n: 'Library', ic: '📚', cost: 1200, eff: 'Greek and Latin scrolls, and a reader who knows them.', bonus: '+2 rhetoric in debates' },
  { id: 'baths', n: 'Private baths', ic: '💧', cost: 1500, eff: 'A small balneum of your own, fed by the Aqua Marcia.', bonus: '+1 health each season' },
  { id: 'garden', n: 'Peristyle garden', ic: '🌿', cost: 900, eff: 'Columns, figs, and a fountain that makes guests lower their voices.', bonus: '+2 gravitas with visitors' },
  { id: 'lararium', n: 'Lararium', ic: '🕯️', cost: 400, eff: 'The household gods, kept properly. Your mother approves, which is rarer than you think.', bonus: '+2 piety, fewer bad omens' },
  { id: 'triclinium', n: 'Triclinium', ic: '🍷', cost: 1100, eff: 'Nine couches and a cook worth more than a tribune.', bonus: 'feasts win friends faster' },
  { id: 'stables', n: 'Stables', ic: '🐎', cost: 800, eff: 'Horses, a raeda, and couriers who reach the legions in days.', bonus: 'army moves and recovers faster' },
  { id: 'trophy', n: 'Trophy hall', ic: '🏆', cost: 2000, eff: 'Captured eagles, enemy standards, and the swords of men you beat.', bonus: '+3 army reputation' }
];

/* ---------------- legions and the battlefield ---------------- */
IMP.UNITS = {
  legion: { n: 'Legionary cohort', ic: '⚔️', men: 480, atk: 11, def: 9, morale: 78, spd: 1, range: 1, menPer: 6, cost: 2200, desc: 'Heavy infantry. Holds a line and grinds.' },
  aux: { n: 'Auxiliary archers', ic: '🏹', men: 360, atk: 8, def: 5, morale: 62, spd: 1, range: 3, menPer: 4, cost: 1200, desc: 'Missile troops. Weak in melee, deadly at range.' },
  horse: { n: 'Ala of cavalry', ic: '🐎', men: 240, atk: 13, def: 6, morale: 70, spd: 2, range: 1, menPer: 3, cost: 1800, desc: 'Fast, hits hard, hates standing still.' },
  guard: { n: 'Praetorian guard', ic: '🛡️', men: 300, atk: 13, def: 12, morale: 88, spd: 1, range: 1, menPer: 4, cost: 3000, desc: 'The best men you will ever own.' },
  elephant: { n: 'War elephants', ic: '🐘', men: 150, atk: 24, def: 8, morale: 60, spd: 1, range: 1, menPer: 1, cost: 4000, desc: 'Terrifying, until they turn.' },
  warband: { n: 'Gallic warband', ic: '🪓', men: 460, atk: 11, def: 5, morale: 66, spd: 1, range: 1, menPer: 6 },
  phalanx: { n: 'Phalangites', ic: '🔱', men: 460, atk: 8, def: 12, morale: 74, spd: 1, range: 1, menPer: 6 },
  horsearcher: { n: 'Horse archers', ic: '🏹', men: 220, atk: 10, def: 4, morale: 58, spd: 3, range: 3, menPer: 2 },
  numidian: { n: 'Numidian horse', ic: '🐎', men: 200, atk: 11, def: 4, morale: 64, spd: 3, range: 1, menPer: 2 },
  horde: { n: 'Barbarian horde', ic: '🪓', men: 760, atk: 8, def: 4, morale: 52, spd: 2, range: 1, menPer: 10 }
};

/* ---------------- the arena ---------------- */
/* The same simulator, wearing different clothes: a bout is a fight between small parties on sand instead of
   armies on a plain. `word` is what the UI calls the count — nobody measures a gladiator in men — and `kind`
   keeps each roster inside its own discipline so a lion never ends up fencing a retiarius. */
IMP.ARENA_UNITS = {
  /* munus: paired gladiators, one school against another */  murmillo:  { n: 'Murmillo',   ic: '🛡️', men: 132, atk: 14, def: 12, morale: 82, spd: 1, range: 1, word: 'fighters', kind: 'munus', cost: 0, desc: 'Heavy helm, short sword, the big scutum. They do not fall over.' },
  retiarius: { n: 'Retiarius',  ic: '🥅', men: 106, atk: 17, def: 7,  morale: 78, spd: 2, range: 1, word: 'fighters', kind: 'munus', cost: 0, desc: 'Net, trident, no helmet. Fast, and they know it.' },
  thraex:    { n: 'Thraex',     ic: '⚔️', men: 104, atk: 13, def: 8,  morale: 74, spd: 1, range: 1, word: 'fighters', kind: 'munus', cost: 0, desc: 'Curved blade and a greave. Fights angry, dies slowly.' },
  hoplo:     { n: 'Hoplomachus',ic: '🔱', men: 110, atk: 12, def: 10, morale: 76, spd: 1, range: 1, word: 'fighters', kind: 'munus', cost: 0, desc: 'Greek style: round shield, spear, and a crowd that respects it.' },
  esseda:    { n: 'Essedarii',  ic: '🛞', men: 96,  atk: 17, def: 6,  morale: 72, spd: 3, range: 1, word: 'fighters', kind: 'munus', cost: 0, desc: 'Chariot fighters. The wheels do most of the arguing.' },
  dimachaerus:{ n: 'Dimachaeri', ic: '🗡️', men: 100, atk: 18, def: 6,  morale: 70, spd: 2, range: 1, word: 'fighters', kind: 'munus', cost: 0, desc: 'A sword in each hand and no shield to hide behind.' },
  /* venatio: the beast master's bill */  bestiarius: { n: 'Bestiarii',  ic: '🏹', men: 104, atk: 15, def: 9,  morale: 70, spd: 1, range: 2, word: 'hunters',  kind: 'venatio', cost: 0, desc: 'Hunters with a pole and a bag of stones. They are not the bait.' },
  leo:       { n: 'Lion pride',  ic: '🦁', men: 84,  atk: 17, def: 4,  morale: 74, spd: 2, range: 1, word: 'beasts',    kind: 'venatio', cost: 0, desc: 'From Mauretania, shipped live, and they do not care about the crowd.' },
  ursus:     { n: 'Bears',       ic: '🐻', men: 96,  atk: 14, def: 7,  morale: 72, spd: 1, range: 1, word: 'beasts',    kind: 'venatio', cost: 0, desc: 'Brought down from the Danube in chains. They break the chains.' },
  panthera:  { n: 'Leopards',    ic: '🐆', men: 74,  atk: 16, def: 3,  morale: 70, spd: 3, range: 1, word: 'beasts',    kind: 'venatio', cost: 0, desc: 'Fast, silent, and already out of the cage.' },
  elephas:   { n: 'Arena elephant', ic: '🐘', men: 200, atk: 21, def: 9, morale: 62, spd: 1, range: 1, word: 'beasts', kind: 'venatio', cost: 0, desc: 'One elephant, four handlers hiding behind the podium, a very quiet crowd.' },
  caecus:    { n: 'Blind wolves', ic: '🐺', men: 62,  atk: 15, def: 3,  morale: 76, spd: 3, range: 1, word: 'beasts',    kind: 'venatio', cost: 0, desc: 'Starved, blind and furious. Released from under the floor.' },
  /* naumachia: the lake is flooded and the boats sink each other */
  liburna:   { n: 'Liburna crews',   ic: '⛵', men: 138, atk: 13, def: 8,  morale: 74, spd: 2, range: 1, word: 'ships',     kind: 'naumachia', cost: 0, desc: 'Fast, shallow, and crewed by men who were condemned this morning.' },
  trireme:   { n: 'Triremes',        ic: '🚢', men: 185, atk: 15, def: 11, morale: 80, spd: 1, range: 1, word: 'ships',     kind: 'naumachia', cost: 0, desc: 'Three banks of oars and a ram that has already been used once.' },
  bireme:    { n: 'Biremes',         ic: '🛶', men: 150, atk: 13, def: 9,  morale: 76, spd: 2, range: 1, word: 'ships',     kind: 'naumachia', cost: 0, desc: 'Two banks, half the pride, twice the manoeuvring.' },
  raft:      { n: 'Pontoon rafts',   ic: '🌉', men: 105, atk: 10, def: 5,  morale: 66, spd: 1, range: 2, word: 'rafts',     kind: 'naumachia', cost: 0, desc: 'Planks lashed together and marines with javelins standing on them.' },
  captured:  { n: 'Captured vessel', ic: '🏴', men: 120, atk: 11, def: 7,  morale: 60, spd: 1, range: 1, word: 'ships',     kind: 'naumachia', cost: 0, desc: 'Taken from the enemy last season and painted for the occasion.' }
};

/* The three ways to spend an afternoon in the wooden amphitheatre. `foe` is what the other side brings,
   `mine` is what you put in, and `blurb` is what the crier says about it in the Forum the next morning. */
IMP.ARENA = [
  { id: 'munus', n: 'Munus', g: '⚔️', title: 'Gladiatorial bout', sub: 'Steel on steel, one pair at a time, and a man with a thumb in his fist.',
    kind: 'munus', terrain: 'sand', diff: 2, purse: 900, q: 10,
    mine: ['murmillo', 'retiarius', 'esseda', 'thraex'], foe: ['thraex', 'hoplo', 'esseda', 'dimachaerus'],
    blurb: 'Your school against the best lanista in Capua. The crowd decides who lives before the editor does.' },
  { id: 'venatio', n: 'Venatio', g: '🦁', title: 'The beast hunt', sub: 'Whatever came off the boat this week, and the men paid to look at it.',
    kind: 'venatio', terrain: 'sand', diff: 3, purse: 1400, q: 8,
    mine: ['bestiarius', 'leo', 'panthera', 'bestiarius'], foe: ['leo', 'ursus', 'caecus', 'panthera'],
    blurb: 'Four hundred animals in a week, imported at ruinous expense, and the crowd has already seen a lion.' },
  { id: 'naumachia', n: 'Naumachia', g: '⛵', title: 'The naval spectacle', sub: 'The floor is flooded to the knees and two fleets are rowed at each other.',
    kind: 'naumachia', terrain: 'water', diff: 4, purse: 2200, q: 9,
    mine: ['trireme', 'liburna', 'bireme', 'liburna'], foe: ['trireme', 'bireme', 'captured', 'raft'],
    blurb: 'Rome watches itself fight itself, on water, in the middle of a city that has no sea.' }
];
IMP.ARENA_UNITS_BY_KIND = k => Object.keys(IMP.ARENA_UNITS).filter(x => IMP.ARENA_UNITS[x].kind === k);
/* one table for the simulator: a bout and a war are the same fight with a different roster */
IMP.UNITS = Object.assign(IMP.UNITS, IMP.ARENA_UNITS);

/* ---------------- provinces and the wars ---------------- */
IMP.PROVS = [
  { id: 'gallia', n: 'Gallia Narbonensis', g: '🍇', foe: 'warband', str: 55, loot: 900, diff: 1, blurb: 'The old province: wine, roads, and tribes who have not forgotten they were free.' },
  { id: 'aquitania', n: 'Aquitania', g: '🌲', foe: 'warband', str: 75, loot: 1500, diff: 2, blurb: 'Wet forests and hill forts. Every valley wants a different treaty.' },
  { id: 'britannia', n: 'Britannia', g: '🌫️', foe: 'warband', str: 85, loot: 1800, diff: 3, blurb: 'Beyond the sea. The druids on Anglesey say the legions cannot swim.' },
  { id: 'hispania', n: 'Hispania Citerior', g: '⛰️', foe: 'numidian', str: 65, loot: 1300, diff: 2, blurb: 'Silver mines and a mountainside war that has lasted two hundred years.' },
  { id: 'africa', n: 'Africa', g: '🌾', foe: 'numidian', str: 60, loot: 1600, diff: 2, blurb: 'The grain of Rome. Whoever holds the granaries holds the city.' },
  { id: 'aegyptus', n: 'Aegyptus', g: '🐊', foe: 'phalanx', str: 70, loot: 2400, diff: 2, blurb: 'The Nile, the fleet, and more coin than any province deserves.' },
  { id: 'syria', n: 'Syria', g: '🏺', foe: 'phalanx', str: 80, loot: 2000, diff: 3, blurb: 'Caravan cities, legions, and the Parthian border a day\'s march away.' },
  { id: 'dacia', n: 'Dacia', g: '🗡️', foe: 'phalanx', str: 92, loot: 2600, diff: 4, blurb: 'Gold in the rivers and a king who is building one kingdom out of every tribe on the Danube.' },
  { id: 'parthia', n: 'Parthia', g: '🏹', foe: 'horsearcher', str: 120, loot: 4000, diff: 5, blurb: 'Horse archers, arrows from the sky, and a King of Kings who does not think Rome is anything special.' },
  { id: 'germania', n: 'Germania', g: '🌑', foe: 'horde', str: 100, loot: 2200, diff: 4, blurb: 'Beyond the Rhine: forest, bog, and tribes who have never once been beaten on their own ground.' },
  { id: 'illyricum', n: 'Illyricum', g: '⛰️', foe: 'warband', str: 68, loot: 1400, diff: 2, blurb: 'Coast, mountains and a road that would be worth more than both if anybody could hold it.' },
  { id: 'thracia', n: 'Thracia', g: '🗡️', foe: 'phalanx', str: 76, loot: 1700, diff: 3, blurb: 'Tribes with a taste for Roman weapons and a talent for taking them off the men carrying them.' },
  { id: 'armenia', n: 'Armenia', g: '🏔️', foe: 'horsearcher', str: 96, loot: 2800, diff: 4, blurb: 'High country and a king who changes sides twice a season, always at the worst moment.' },
  { id: 'mauretania', n: 'Mauretania', g: '🦁', foe: 'numidian', str: 62, loot: 1500, diff: 2, blurb: 'Lions, purple dye and a king who would rather be a Roman client than a Numidian corpse.' },
  { id: 'creta', n: 'Creta', g: '🏝️', foe: 'aux', str: 55, loot: 1200, diff: 1, blurb: 'Pirates with a very old culture, an excellent harbour and no intention of giving up either.' },
  { id: 'narbonensis', n: 'The Long-Haired Gaul', g: '🌿', foe: 'horde', str: 110, loot: 3200, diff: 5, blurb: 'The real Gaul: fifty tribes, a walled hill in every valley, and one man clever enough to unite them.' }
];
/* fields the stories fight on that are not provinces you can take: Italy itself was never a province */
IMP.FIELDS = [
  { id: 'etruria', n: 'Etruria, the army of Catilina', g: '🔥', foe: 'legion', pure: true, str: 80, loot: 600, diff: 3, blurb: 'Sulla’s old veterans and men with nothing left to lose, dug in among the hills above Faesulae under a silver eagle that once belonged to Marius.' },
  { id: 'pharsalus', n: 'Pharsalus, the legions of Pompey', g: '⚔️', foe: 'legion', pure: true, str: 110, loot: 2400, diff: 4, blurb: 'Roman against Roman on a plain in Thessaly: Pompey’s eleven legions and seven thousand horse against your eight tired legions and your fourth line.' }
];

/* ---------------- the Senate floor ---------------- */
IMP.ARGS = [
  { id: 'tradition', n: 'Appeal to the ancestors', d: 'The mos maiorum: this is how Rome has always done it.', stat: 'gravitas', strong: ['senate'], weak: ['people'] },
  { id: 'people', n: 'Appeal to the people', d: 'Grain, games, and the freedom of the plebs.', stat: 'rhetoric', strong: ['people'], weak: ['senate'] },
  { id: 'army', n: 'Appeal to the legions', d: 'The army is the republic; the republic has always known it.', stat: 'martial', strong: ['army'], weak: ['people'] },
  { id: 'law', n: 'Cite the law and precedent', d: 'A careful, devastating reading of the statute and the record.', stat: 'rhetoric', strong: ['senate'], weak: ['army'] },
  { id: 'piety', n: 'Invoke the gods', d: 'The omens, the rites, and the safety of the state.', stat: 'fides', strong: ['people'], weak: ['senate'] },
  { id: 'cunning', n: 'Turn it into an accusation', d: 'Do not defend your position: destroy his.', stat: 'cunning', strong: [], weak: [] }
];

/* ---------------- the laws you can carry ---------------- */
IMP.LAWS = [
  { id: 'grain', n: 'Lex frumentaria', d: 'Subsidised grain for the city. The people will love you; the treasury and Cato will not.', cost: 800, rep: { people: 16, senate: -6, army: 0 }, auctoritas: 12 },
  { id: 'land', n: 'Lex agraria', d: 'Distribute public land to veterans and the poor. The army and the plebs gain; the rich lose.', cost: 600, rep: { people: 12, senate: -10, army: 10 }, auctoritas: 14 },
  { id: 'courts', n: 'Lex de ambitu', d: 'A hard law against bribery — which your rivals will find very inconvenient.', cost: 0, rep: { people: 8, senate: 6, army: 0 }, auctoritas: 10 },
  { id: 'command', n: 'Lex de imperio', d: 'A special command for you in a province, with troops and a budget to spend.', cost: 400, rep: { people: 4, senate: -4, army: 12 }, auctoritas: 16 },
  { id: 'citizenship', n: 'Lex de civitate', d: 'Full citizenship for the Latin towns beyond the Po. Enormously popular outside the city walls, and in the ranks.', cost: 700, rep: { people: 14, senate: -8, army: 8 }, auctoritas: 18 },
  { id: 'treasury', n: 'Lex de pecunia', d: 'An audit of the public accounts. Someone will hang for this, and it will not be you.', cost: 0, rep: { people: 6, senate: -2, army: 0 }, auctoritas: 8 }
];

/* ---------------- quests ---------------- */
/* Each step has an `at` (where you do it) and an `act` (what you do there). The location screen offers it while it is live. */
IMP.QUESTS = [
  {
    id: 'grain', n: 'The grain ships', giver: 'aulus', ic: '🌾', at: 'portus',
    d: 'Two grain fleets are overdue and the city is three days from riot. Aulus has the manifests, and the manifests do not add up.',
    steps: [
      { at: 'portus', act: 'Question the harbourmaster', text: 'Question the harbourmaster at the Portus' },
      { at: 'macellum', act: 'Find the grain factor', text: 'Find the factor who bought the missing cargo' },
      { at: 'curia', act: 'Denounce the grain ring in the Senate', text: 'Denounce the ring on the Senate floor' }
    ],
    reward: { denarii: 1200, auctoritas: 18, rep: { people: 12, senate: -4 } }
  },
  {
    id: 'debt', n: 'The debt of Crassus', giver: 'crassus', ic: '💰', at: 'domus',
    d: 'Crassus will fund your career. He would like a small thing in return: your name on a contract you have not read.',
    steps: [
      { at: 'domus', act: 'Read the contract carefully', text: 'Read the contract (or have Aulus read it)' },
      { at: 'macellum', act: 'Trace the contract to its holder', text: 'Trace who really holds the debt' },
      { at: 'curia', act: 'Raise it in the Senate', text: 'Raise the loan on the Senate floor' }
    ],
    reward: { denarii: 2400, auctoritas: 14, rep: { senate: 8, people: -4 } }
  },
  {
    id: 'blood', n: 'Blood in the Subura', giver: 'pullo', ic: '🗡️', at: 'subura',
    d: 'A wine-seller was killed in an alley, and the man who did it is wearing somebody else\'s cloak. Pullo wants five minutes alone with him. The law wants a trial.',
    steps: [
      { at: 'subura', act: 'Work the alley', text: 'Work the alley for witnesses' },
      { at: 'castra', act: 'Ask the watch what they buried', text: 'Ask the watch what they buried' },
      { at: 'subura', act: 'Bring him in — or let Pullo', text: 'Decide what happens to the killer' }
    ],
    reward: { denarii: 500, auctoritas: 10, rep: { people: 10 } }, choice: true
  },
  {
    id: 'eagle', n: 'The lost eagle', giver: 'marius', ic: '🦅', at: 'castra',
    d: 'A legion broke in the Thracian hills and its eagle went into a marsh with the standard-bearer. The old soldier at the camp says the eagle is worth more than the men were.',
    steps: [
      { at: 'castra', act: 'Take the volunteers', text: 'Take the old soldier\'s volunteers' },
      { at: 'temple', act: 'Take the omens before you march', text: 'Take the omens at the Temple of Mars' },
      { at: 'castra', act: 'March and bring it home', text: 'March north and bring the eagle home' }
    ],
    reward: { denarii: 900, auctoritas: 22, rep: { army: 16, senate: 4 } }, war: true
  },
  {
    id: 'poison', n: 'The poisoner of the Palatine', giver: 'cornelia', ic: '☠️', at: 'domus',
    d: 'Two cousins died in the same week, both after drinking at the same house. Your mother has an opinion about which house, and she is usually right.',
    steps: [
      { at: 'domus', act: 'Question the household', text: 'Question your own household' },
      { at: 'balnea', act: 'Follow the poisoner to the baths', text: 'Follow the trail to the baths' },
      { at: 'curia', act: 'Bring the charge', text: 'Bring the charge before the Senate' }
    ],
    reward: { denarii: 700, auctoritas: 16, rep: { senate: 10, people: 4 } }
  },
  {
    id: 'parthia', n: 'The Parthian envoy', giver: 'berenice', ic: '🏹', at: 'portus',
    d: 'A Parthian envoy has arrived with silk, horses, and a proposal that is either an alliance or an insult. Berenice thinks it is both.',
    steps: [
      { at: 'portus', act: 'Meet the envoy at the docks', text: 'Meet the envoy at the docks' },
      { at: 'curia', act: 'Read the proposal aloud', text: 'Read their proposal to the Senate' },
      { at: 'temple', act: 'Take the gods\' judgement', text: 'Take the gods\' judgement before answering' }
    ],
    reward: { denarii: 1600, auctoritas: 20, rep: { senate: 6, army: 6, people: 6 } }
  },
  {
    id: 'conspiracy', n: 'The conspiracy', giver: 'catilina', ic: '🔥', at: 'subura',
    d: 'Catilina has been recruiting in the taverns, and he wants you at the next meeting. What he is actually planning is written on his face if you know how to read it.',
    steps: [
      { at: 'subura', act: 'Attend the meeting', text: 'Attend the meeting in the Subura' },
      { at: 'castra', act: 'Warn the camp — or arm it', text: 'Decide who hears about this first' },
      { at: 'curia', act: 'Name names in the Senate', text: 'Name names in the Senate' }
    ],
    reward: { denarii: 1400, auctoritas: 26, rep: { senate: 14, people: 6 } }, choice: true
  },
  {
    id: 'temple', n: 'The falling temple', giver: 'aurelia', ic: '🏛️', at: 'temple',
    d: 'A crack has opened in the Temple of Mars and the augurs will not enter it. Aurelia says it is a building problem. She is lying.',
    steps: [
      { at: 'temple', act: 'Inspect the crack yourself', text: 'Inspect the crack yourself' },
      { at: 'macellum', act: 'Buy the stone and the men', text: 'Buy stone and hire the masons' },
      { at: 'temple', act: 'Rededicate the temple', text: 'Rededicate the temple' }
    ],
    reward: { denarii: 400, auctoritas: 18, rep: { people: 8, senate: 6 } }
  },
  {
    id: 'gladiator', n: 'The gladiator\'s freedom', giver: 'pullo', ic: '🗿', at: 'circus',
    d: 'A murmillo has won eleven fights and his owner will not sell. Pullo has fought beside him and has asked you, once, for help.',
    steps: [
      { at: 'circus', act: 'Watch him fight', text: 'Watch the murmillo fight' },
      { at: 'macellum', act: 'Meet his price — or find his contract', text: 'Meet his price, or find his contract' },
      { at: 'circus', act: 'Manumit him in the arena', text: 'Free him in front of the crowd' }
    ],
    reward: { denarii: 0, auctoritas: 14, rep: { people: 16, army: 4 } }
  },
  {
    id: 'flood', n: 'The Tiber in flood', giver: 'aulus', ic: '🌊', at: 'portus',
    d: 'The river is up two cubits and the warehouses by the wharf are already wet. The grain is insured. The men who load it are not.',
    steps: [
      { at: 'portus', act: 'Get the grain onto dry stone', text: 'Get the grain onto dry stone' },
      { at: 'subura', act: 'House the flooded families', text: 'House the families from the low alleys' },
      { at: 'curia', act: 'Make the city pay for it', text: 'Make the city pay for the repairs' }
    ],
    reward: { denarii: 800, auctoritas: 16, rep: { people: 14, senate: 2 } }
  },
  {
    id: 'augur', n: 'The augur’s fee', giver: 'aurelia', ic: '🕊️', at: 'temple',
    d: 'The augur who reads the birds for the elections has raised his fee twice this year and will not say why. The birds, he says, have become more expensive.',
    steps: [
      { at: 'temple', act: 'Watch the augur at work', text: 'Watch him take the auspices and see what he actually does' },
      { at: 'macellum', act: 'Find who is paying him', text: 'Find who else is paying for the birds' },
      { at: 'curia', act: 'Name the fee in the house', text: 'Name the fee in the house' }
    ],
    reward: { denarii: 600, auctoritas: 14, rep: { senate: 8, people: 6 } }
  },
  {
    id: 'chariot', n: 'The four horses', giver: 'sestius', ic: '🐎', at: 'circus',
    d: 'A faction in the Circus has a horse that is too good, and the other three factions have noticed. The owner wants a senator’s name on the entry and a senator’s silence afterwards.',
    steps: [
      { at: 'circus', act: 'Watch the morning trials', text: 'Watch the morning trials and count the horses' },
      { at: 'subura', act: 'Find the stable that does not exist', text: 'Find the stable that is not on any list' },
      { at: 'circus', act: 'Decide the race', text: 'Decide what happens on race day' }
    ],
    reward: { denarii: 1400, auctoritas: 10, rep: { people: 12 } }
  },
  {
    id: 'baths', n: 'The baths at the ninth hour', giver: 'cassia', ic: '💧', at: 'balnea',
    d: 'Three senators have been meeting in the hot room at the same hour every week, and one of the attendants has started talking to a woman who pays him better.',
    steps: [
      { at: 'balnea', act: 'Take the hot room', text: 'Take the hot room and listen to nothing in particular' },
      { at: 'subura', act: 'Buy the attendant’s list', text: 'Buy the attendant’s list' },
      { at: 'basilica', act: 'Decide who hears it', text: 'Decide who hears it first' }
    ],
    reward: { denarii: 500, auctoritas: 18, rep: { senate: 6 } }
  },
  {
    id: 'stone', n: 'The temple roof', giver: 'fabius', ic: '🏛️', at: 'tabularium',
    d: 'The tiles of the Temple of Castor are being sold at night by men with a cart and an arrangement. The god has not complained. The quaestor has.',
    steps: [
      { at: 'tabularium', act: 'Find the contract', text: 'Find the contract that authorised the repair' },
      { at: 'portus', act: 'Find the cart', text: 'Find the cart at the wharves' },
      { at: 'temple', act: 'Give the god his roof', text: 'Give the god his roof back' }
    ],
    reward: { denarii: 900, auctoritas: 16, rep: { people: 10, senate: 4 } }
  },
  {
    id: 'scribe', n: 'The scribe who copied the ledgers', giver: 'marina', ic: '🖋️', at: 'portus',
    d: 'A harbour clerk has been copying the customs ledgers for a man in the Subura. He is frightened, he is careful, and he has a wife and two children on the Aventine.',
    steps: [
      { at: 'portus', act: 'Find the clerk', text: 'Find the clerk before the man in the Subura does' },
      { at: 'aventine', act: 'Get his family out', text: 'Get his family off the Aventine' },
      { at: 'curia', act: 'Use him properly', text: 'Use him properly in the house' }
    ],
    reward: { denarii: 1100, auctoritas: 18, rep: { people: 8, senate: 6 } }
  },
  {
    id: 'roadworks', n: 'The Via Appia', giver: 'gaius', ic: '🛣️', at: 'outside',
    d: 'The Appian Way is being repaired with money voted for the Appian Way, which has not been repaired since the money was voted. A veteran with one bad hand has counted the carts.',
    steps: [
      { at: 'outside', act: 'Walk the road with Gaius', text: 'Walk the road and count the carts that cannot get through' },
      { at: 'castra', act: 'Find the surveyor', text: 'Find the surveyor and the surveyor’s books' },
      { at: 'rostra', act: 'Read the figures out', text: 'Read the figures aloud from the Rostra' }
    ],
    reward: { denarii: 700, auctoritas: 14, rep: { army: 8, people: 10 } }
  },
  {
    id: 'case', n: 'A case you should refuse', giver: 'cicero', ic: '🗣️', at: 'forum',
    d: 'A man with a clean cloak and a filthy client wants a speech in the forum by tomorrow. Cicero has read the papers and says the man will lose either way — the question is whether you lose with him.',
    steps: [
      { at: 'forum', act: 'Read the papers', text: 'Read the papers Cicero has already read' },
      { at: 'subura', act: 'Find the witness', text: 'Find the one witness who will still talk' },
      { at: 'rostra', act: 'Make the speech', text: 'Make the speech on the Rostra, knowing the outcome' }
    ],
    reward: { denarii: 800, auctoritas: 16, rep: { people: 10, senate: 4 } }
  },
  {
    id: 'wine', n: 'The wine that was never grapes', giver: 'lucia', ic: '🍷', at: 'argiletum',
    d: 'Six jars of Falernian sold on the Argiletum this week were thinned with something that is not wine. Lucia knows the seller by his hands and would like the city to know him by his name.',
    steps: [
      { at: 'argiletum', act: 'Buy a jar', text: 'Buy a jar from the man who sold it' },
      { at: 'outside', act: 'Walk to the estate', text: 'Follow the casks back to the estate that made them' },
      { at: 'macellum', act: 'Name him in the market', text: 'Name the seller in front of the market' }
    ],
    reward: { denarii: 600, auctoritas: 10, rep: { people: 12 } }
  },
  {
    id: 'rolls', n: 'Names on the dole roll', giver: 'catilina', ic: '📜', at: 'aventine',
    d: 'The grain dole pays four hundred names on the Aventine. Three of the four men standing in front of you say they have never received anything, and one of them is dead.',
    steps: [
      { at: 'aventine', act: 'Count the names at the temple', text: 'Count the names at the temple with the men who are on the roll' },
      { at: 'forum', act: 'Find the four hundred', text: 'Find out who is really taking the grain' },
      { at: 'curia', act: 'Put it to the aedile', text: 'Put the roll in front of the aedile in the house' }
    ],
    reward: { denarii: 900, auctoritas: 14, rep: { people: 14, senate: -4 } }
  },
  {
    id: 'drill', n: 'The recruits at dawn', giver: 'marius', ic: '🛡️', at: 'campus',
    d: 'Eight hundred men were enrolled for the autumn levy and drilled on the Campus with boots two sizes short. Somebody bought the surplus at the price of the good leather.',
    steps: [
      { at: 'campus', act: 'Take the watch at dawn', text: 'Take the morning watch and look at the boots' },
      { at: 'subura', act: 'Find the cobbler', text: 'Find who sold the surplus in the Subura' },
      { at: 'castra', act: 'Report it at the castra', text: 'Report it where it cannot be buried' }
    ],
    reward: { denarii: 500, auctoritas: 12, rep: { army: 14 } }
  },
  {
    id: 'toll', n: 'The bridge toll', giver: 'gaius', ic: '🌉', at: 'pons',
    d: 'Every cart crossing the Tiber pays a toll voted for one year, eleven years ago. The veteran with one bad hand has counted the carts and the take, and they do not agree.',
    steps: [
      { at: 'pons', act: 'Count the carts', text: 'Count the carts at the bridge for a whole day' },
      { at: 'trans', act: 'Find the collector', text: 'Find the collector on the far bank' },
      { at: 'tabularium', act: 'Take the tally', text: 'Take the tally to the record office' }
    ],
    reward: { denarii: 650, auctoritas: 12, rep: { people: 8, senate: 6 } }
  },
  {
    id: 'cargo', n: 'Oil under water', giver: 'marina', ic: '⚓', at: 'wharf',
    d: 'A lighters’ barge sank at the wharf with forty jars of Spanish oil aboard, and the harbour ledger records the barge as empty. Somebody is drinking very well.',
    steps: [
      { at: 'wharf', act: 'Have the crates raised', text: 'Have the crates raised out of the silt' },
      { at: 'portus', act: 'Find the manifest', text: 'Find the manifest that says the barge was empty' },
      { at: 'curia', act: 'Lay it before the house', text: 'Lay the manifest before the house' }
    ],
    reward: { denarii: 1000, auctoritas: 14, rep: { senate: 6, people: 6 } }
  },
  {
    id: 'lost', n: 'The woman from the far bank', giver: 'pullo', ic: '🕯️', at: 'trans',
    d: 'A woman who sold cloth on the Transtiberim has not been home in nine days. Her husband thinks she has left him. Pullo, who has seen this before, thinks she has not.',
    steps: [
      { at: 'trans', act: 'Ask in the taverns', text: 'Ask in the taverns on the far bank' },
      { at: 'subura', act: 'Find where she was last seen', text: 'Find where she was last seen' },
      { at: 'trans', act: 'Bring the answer back', text: 'Bring the answer back to the husband' }
    ],
    reward: { denarii: 450, auctoritas: 10, rep: { people: 10 } }
  },
  {
    id: 'seals', n: 'The seals of the Tabularium', giver: 'fabius', ic: '🔏', at: 'capitol',
    d: 'The night books come up to the record office with their wax intact and their sums changed. Fabius has a key, a rule, and no idea which of his three clerks hates him.',
    steps: [
      { at: 'tabularium', act: 'Check the wax', text: 'Check the wax on the night books' },
      { at: 'argiletum', act: 'Catch the man with the key', text: 'Catch whoever is selling the copies on the Argiletum' },
      { at: 'capitol', act: 'Put the books back', text: 'Put the books right before the morning count' }
    ],
    reward: { denarii: 750, auctoritas: 16, rep: { senate: 8 } }
  }
];

/* ---------------- events that find you ---------------- */
IMP.EVENTS = [
  { id: 'fire', n: 'Fire in the Subura', d: 'A tenement is burning and the wind is taking it east. The vigiles want money before they bring water.', opts: [
    { t: 'Pay the vigiles', cost: 500, eff: { rep: { people: 8 }, auctoritas: 4 }, msg: 'The fire is out by dawn. The alley remembers.' },
    { t: 'Send your own slaves', cost: 0, eff: { rep: { people: 4 }, attrs: { health: -1 } }, msg: 'You lose two men and a lot of sleep; the alley keeps a third of itself.' },
    { t: 'Do nothing', cost: 0, eff: { rep: { people: -10 } }, msg: 'Half the street burns. They will remember the shape of your window.' }
  ] },
  { id: 'omen', n: 'A bad omen', d: 'Lightning struck the statue of Jupiter on the Capitol, and the haruspices have gone quiet in a way that costs money to end.', opts: [
    { t: 'Pay for the expiation', cost: 400, eff: { rep: { senate: 4, people: 4 }, attrs: { fides: 1 } }, msg: 'The rites are performed properly. The city breathes.' },
    { t: 'Ignore it', cost: 0, eff: { rep: { people: -4 }, attrs: { fides: -1 } }, msg: 'You are a sceptic. Rome is not.' }
  ] },
  { id: 'gift', n: 'A gift from a province', d: 'A merchant from the east sends a sealed crate: Egyptian glass, a Persian carpet, and a letter asking for a small favour at the customs house.', opts: [
    { t: 'Take it and help', cost: 0, eff: { denarii: 900, rep: { senate: -3 }, attrs: { cunning: 1 } }, msg: 'The crate is worth more than the favour. Probably.' },
    { t: 'Return it', cost: 0, eff: { rep: { senate: 5 }, attrs: { fides: 1 } }, msg: 'The letter is returned unopened, which is its own kind of message.' }
  ] },
  { id: 'plague', n: 'Fever in the camp', d: 'A quarter of the recruits at the Castra have gone down with a fever from the marsh water.', opts: [
    { t: 'Buy clean water and a physician', cost: 350, eff: { rep: { army: 8 } }, msg: 'The fever breaks. The men notice who paid.' },
    { t: 'Let it run its course', cost: 0, eff: { rep: { army: -8 } }, msg: 'You bury forty recruits and save three hundred denarii.' }
  ] },
  { id: 'rumour', n: 'A rumour about you', d: 'Somebody has been telling the market that you bought your office with a loan from a man in the Subura.', opts: [
    { t: 'Answer it with a speech', cost: 0, eff: { rep: { people: 6, senate: 2 }, attrs: { rhetoric: 1 } }, msg: 'You speak at the rostra and the crowd laughs at the rumour instead of you.' },
    { t: 'Find who started it', cost: 200, eff: { rep: { people: -2 }, attrs: { cunning: 1 } }, msg: 'A clerk in a rival\'s house talks too much. You keep the name for later.' }
  ] }
];

/* ---------------- small helpers used by both the UI and the battle ---------------- */
IMP.seasons = ['Spring', 'Summer', 'Autumn', 'Winter'];
IMP.ranks = [
  [0, 'Tiro', 'a nobody with a name'], [60, 'Tribunus', 'a tribune of the soldiers'], [150, 'Quaestor', 'keeper of the public purse'],
  [280, 'Aedile', 'games, grain and the city\'s temper'], [440, 'Praetor', 'justice, and a province to govern'], [650, 'Consul', 'the highest office in the Republic'],
  [900, 'Censor', 'the morals of Rome'], [1150, 'Imperator', 'hailed by the legions'], [1500, 'Princeps', 'first man of the Senate']
];
IMP.rankOf = xp => { let r = 0; IMP.ranks.forEach((x, i) => { if (xp >= x[0]) r = i; }); return r; };
IMP.rankName = xp => IMP.ranks[IMP.rankOf(xp)][1];
IMP.offices = ['Tribunus militum', 'Quaestor', 'Aedile', 'Praetor', 'Consul', 'Censor'];

/* a bust drawn from four numbers: skin, robe, hair, and an accessory. All vector, all offline. */
IMP.bust = function (c, size) {
  const s = size || 48, id = 'g' + (c.id || 'x').replace(/\W/g, '');
  return '<svg viewBox="0 0 100 100" width="' + s + '" height="' + s + '" aria-hidden="true">' +
    '<defs><linearGradient id="' + id + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + (c.robe || '#6b5b45') + '"/><stop offset="1" stop-color="#ffffff" stop-opacity=".18"/></linearGradient></defs>' +
    '<rect width="100" height="100" fill="#d9cbaa"/>' +
    '<path d="M14 100 Q20 64 50 62 Q80 64 86 100 Z" fill="url(#' + id + ')"/>' +
    '<path d="M50 62 L38 100 L62 100 Z" fill="#f4ead2" opacity=".9"/>' +
    '<circle cx="50" cy="42" r="20" fill="' + (c.skin || '#e0c49a') + '"/>' +
    '<path d="M30 40 Q32 18 50 18 Q68 18 70 40 Q60 30 50 30 Q40 30 30 40 Z" fill="' + (c.hair || '#3b332a') + '"/>' +
    '<circle cx="43" cy="43" r="2" fill="#3a2c1e"/><circle cx="57" cy="43" r="2" fill="#3a2c1e"/>' +
    '<path d="M44 53 Q50 57 56 53" stroke="#8a6a52" stroke-width="1.6" fill="none" stroke-linecap="round"/>' +
    (c.ic ? '<text x="84" y="22" font-size="16" text-anchor="middle">' + c.ic + '</text>' : '') +
    '</svg>';
};

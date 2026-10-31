/* STORY — the career, told properly. Twenty chapters in four acts, from a new man taking an empty chair to the
   morning the Republic either holds or does not. Scenes are written out in full, choices change what Rome — and
   each of the eleven people around you — thinks of you, and some choices open chapters that others close: two of
   the acts branch on what you did in the Subura and at Catilina's table, and the last scene has three endings.
   The engine is deliberately the same as the small jobs around the city: a place, an action, a reward. */
window.STORY = (() => {
  'use strict';
  const S = (title, lines, choose) => ({ title, lines, choose });
  const sc = (title, sub, lines, choose) => ({ title, sub, lines, choose });

  const SCENES = {
    /* ================= ACT I — a nobody with a name ================= */
    intro: sc('Rome, before dawn', 'Act I', [
      ['narrator', 'The year is 691 from the founding of the city. It has rained for three days and the Tiber is the colour of weak wine.'],
      ['narrator', 'You are awake before your household. On the table: a wax tablet with your name on it, a toga mended twice, and the smell of somebody else\u2019s bread from the alley below.'],
      ['narrator', 'Rome does not care what you intend. It cares what you can carry, and how many men will stand behind you while you carry it.'],
      ['narrator', 'There is a chair in the Senate house with nobody in it. It has been that way for nine months. Before the year is out, one of two men will be sitting in it — and the other will be dead, ruined, or owed a favour he can never repay.'],
      ['narrator', 'Walk out into the street. Everything after this is yours to lose.']
    ]),
    s1: sc('Cicero, on the steps', '', [
      ['cicero', 'You are the new man. No — no need to look at the tablet. I know every face in that house and yours is the one I have not insulted yet.'],
      ['cicero', 'Understand something on your first morning: birth buys you a seat and nothing else. The rest is argued for, in front of men who would rather you lost.'],
      ['cicero', 'I won my first case at twenty-six with no ancestors at all, and I have not stopped talking since. Speak to the crowd before you speak to the house. The crowd remembers faces; the house remembers only votes.'],
      ['narrator', 'He is already walking away, expecting to be followed. He is right to expect it.']
    ]),
    s2: sc('Crassus, and a cup of wine', '', [
      ['crassus', 'Sit. Wine? It is a good year — everything I own is a good year.'],
      ['crassus', 'You want a career. A career is a house with many rooms, and every room has a price. I am not asking you for money.'],
      ['crassus', 'I am asking for your name, on one small contract, in a matter concerning grain and a man who is going to disappear. Do not look like that. Men disappear in the market every day; it is the contracts that survive.'],
      ['crassus', 'Read it. Read it twice, or have your Greek read it to you in the evening. I have never lied to anybody. I have simply never been asked the right question.']
    ], {
      q: 'What will you do with the contract?',
      opts: [
        { t: 'Sign it. Crassus funds careers, and yours needs funding.', say: 'Sign there — yes, there. The ink of a new man is the freshest ink in Rome.', eff: { denarii: 1400, xp: 12 }, disp: { crassus: .25, cato: -.12 }, flag: 'signedCrassus' },
        { t: 'Take it home and read every clause with Aulus.', say: 'Reading it will not change the number at the bottom. But it will change what you know, which is worth more.', eff: { xp: 16, attrs: { cunning: 1 } }, disp: { crassus: .05, aulus: .2 }, flag: 'readCrassus' },
        { t: 'Refuse him, politely, in front of the household.', say: 'How refreshing. Do send word when the money runs out; it usually takes about a season.', eff: { rep: { senate: 4 }, xp: 14 }, disp: { crassus: -.25, cato: .2, cornelia: .15 }, flag: 'refusedCrassus' }
      ]
    }),
    s3: sc('The harbourmaster\u2019s hands', '', [
      ['aulus', 'Two grain fleets are overdue, dominus, and the manifests disagree with themselves. That is not weather. That is arithmetic.'],
      ['aulus', 'The warehouses at the Portus are empty and the ledger says full. Whoever signs those papers also signs for the vigiles, and for the aedile, and for a senator.'],
      ['aulus', 'I would go myself, but I am a freedman and they would laugh at me. You they will lie to, which is better. Bring the ledger. Bring witnesses, and bring one of the army men — soldiers make accountants honest.'],
      ['narrator', 'Somewhere in the city, a warehouse is standing empty with a full page in front of it, and a clerk is waiting to be asked the right question.']
    ]),
    s4: sc('An alley off the Subura', '', [
      ['pullo', 'Chief. Wine-seller, end of the alley. Throat opened for four denarii and a grudge nobody can name.'],
      ['pullo', 'There was a man in a good cloak walking out of it, and a good cloak in the Subura at that hour means somebody paid for it this week.'],
      ['pullo', 'I can find him in a day. Ten men would follow me, and I would not have to ask twice. But I want to know what you do with him when I have him, because these things are decided in advance or they are decided badly.'],
      ['narrator', 'Behind the tenements a woman starts keening. She stops very suddenly, the way people stop when somebody opens a door.']
    ], {
      q: 'What is to be done with the killer?',
      opts: [
        { t: 'Bring him to the courts. The law is the only thing a new man owns.', say: 'The law. Very well, chief — but the law works slowly and I do not.', eff: { rep: { senate: 8, people: 6 }, auctoritas: 6, xp: 22 }, disp: { pullo: -.05, cato: .2, cicero: .15 }, flag: 'lawKiller' },
        { t: 'Let Pullo deal with it. Some things are settled in alleys.', say: 'Good. Then he is mine, and the alley keeps its own accounts.', eff: { rep: { army: 8, people: 4, senate: -6 }, xp: 18, attrs: { cunning: 1 } }, disp: { pullo: .3, cato: -.2 }, flag: 'killedKiller' },
        { t: 'Let him go, but keep the name. Debts are useful.', say: 'You are learning. I do not like it, but you are learning.', eff: { auctoritas: 4, xp: 16, attrs: { cunning: 2 } }, disp: { pullo: -.15, crassus: .15 }, flag: 'owedKiller' }
      ]
    }),
    s5: sc('Petreius at the gate', '', [
      ['marius', 'You want a province. Every fool in the house wants a province; provinces are where the money is and where the men die.'],
      ['marius', 'There is an eagle in a Thracian marsh, beyond Macedonia. The legion that lost it is gone, and the standard-bearer went into the water still holding it. The Senate calls it a symbol. I call it the only thing that tells a soldier who he is.'],
      ['marius', 'Take volunteers, take the omens, bring it home. Pay no attention to what the house says while you are away. It will be saying something else when you return, and it will be saying it about you.'],
      ['narrator', 'Far to the east the ground is wet and quiet, and a piece of gold on a pole is waiting to be somebody\u2019s career.']
    ]),

    /* ================= ACT II — the price of everything ================= */
    s6: sc('Vatinius, in the bath', 'Act II', [
      ['vatinius', 'My dear colleague! In the warm room too. I heard about your little command. How brave, to be seen going north.'],
      ['vatinius', 'Do you know what they are saying about you in the house? That you are lucky. Luck is the worst thing they can call a man, because luck runs out in public.'],
      ['vatinius', 'I am not your enemy. I am your competition, which is better for you: an enemy wants you dead, and I want your office. Come and have wine and we will discuss which of them you would rather lose.'],
      ['narrator', 'Behind him two of his clients stop talking as you pass. One of them has a wax tablet and he is not writing poetry on it.']
    ]),
    s7: sc('The meeting in the Subura', '', [
      ['catilina', 'Come in, come in. Do not look at the door; the door is the least interesting thing in this room.'],
      ['catilina', 'Look at these faces. Every man here has been refused something a worse man was given. Debts, provinces, priesthoods, a second consulship. Rome is a house with rotten beams and a landlord who will not answer the bell.'],
      ['catilina', 'You are the only man in here with a future worth buying. So tell me honestly — and I will know if you lie — if the roof comes down, whose side of the street are you standing on?'],
      ['narrator', 'Around the table, eleven men wait to hear your answer. One of them has his hand under his cloak and is not moving it.']
    ], {
      q: 'What do you tell Catilina?',
      opts: [
        { t: 'Nothing. Let him wonder where you stand.', say: 'Silence. Yes. The most expensive answer in Rome.', eff: { auctoritas: 6, xp: 20, attrs: { cunning: 2 } }, disp: { catilina: .1 }, flag: 'silentFire' },
        { t: 'Talk him down, in front of his own men.', say: 'Careful. Men who save you publicly expect to be thanked privately.', eff: { rep: { senate: 10, people: 4 }, xp: 24, attrs: { rhetoric: 1 } }, disp: { catilina: -.25, cato: .25, cicero: .2 }, flag: 'againstFire' },
        { t: 'Join the table. A fire is a tool if you are holding it.', say: 'There. I knew you were not a fool. Drink — nobody here is poisoned tonight.', eff: { denarii: 1800, xp: 22, attrs: { cunning: 2 } }, disp: { catilina: .4, cato: -.4, cicero: -.3 }, rep: { senate: -10, people: -6, army: 4 }, flag: 'joinedFire' }
      ]
    }),
    s8: sc('Your mother\u2019s list', '', [
      ['cornelia', 'Two cousins dead in one week. Both drank at the house of the same man, who is now remembering that his wine was bought by somebody else.'],
      ['cornelia', 'I have written down everyone at that table and what each of them gained by it. It is a short list and a shameful one.'],
      ['cornelia', 'I am not asking you to be brave. This family has buried enough brave men to fill a small temple. I am asking you to be exact. Exact men live longer and their mothers sleep.'],
      ['narrator', 'She puts the tablet in your hand. Her writing is very small and very even, and there are no crossings out.']
    ]),
    s9: sc('A Parthian, on the wharf', '', [
      ['berenice', 'He came up the river with silk, eight horses, and a proposal wrapped in three kinds of flattery. He is very good. I have met worse men with better manners and I prefer him.'],
      ['berenice', 'Syria is worth more in a year than every province you have north of the sea, and the Parthians know it. That is why they send horses and not armies.'],
      ['berenice', 'Read his proposal aloud in the house and watch which senators look at their hands. That will tell you who has already been paid. It is also very funny, if you have the stomach for it.'],
      ['narrator', 'On the wharf, a Persian horse is being led in a circle by a boy who has never seen one before. It is not going well.']
    ]),
    s10: sc('The ledger of a rich man', '', [
      ['crassus', 'You have the contract, and therefore you have a choice: enforce it and make an enemy of me, or ignore it and make an enemy of yourself.'],
      ['crassus', 'People believe I want money. I want a city where every account can be settled, because in such a city mine always are. Every reform you pass that makes an account easier to settle makes me richer, and every riot makes me poorer. That is the whole of my politics.'],
      ['crassus', 'Do what you like with the ledger. I have already adjusted for it. I adjust for everything, which is why I am still alive and Cato is not sleeping.'],
      ['narrator', 'The ledger is on the table between you. It is not very thick. It has cost four lives so far, that anybody has counted.']
    ], {
      q: 'What will you do with Crassus\u2019s ledger?',
      opts: [
        { t: 'Publish it. Let the city see how the money moved.', say: 'You have made a great many enemies in one afternoon. Some of them are useful ones.', eff: { rep: { people: 14, senate: -10 }, auctoritas: 14, xp: 30 }, disp: { crassus: -.3, cato: .3, aulus: .2 }, flag: 'publishedLedger' },
        { t: 'Keep it. A ledger is worth more in a drawer than on a wall.', say: 'Sensible. Sentiment is expensive; I have always said so.', eff: { auctoritas: 8, xp: 22, attrs: { cunning: 2 } }, disp: { crassus: .2 }, flag: 'keptLedger' },
        { t: 'Burn it, and tell him you did.', say: 'Then we understand each other completely, which is rarer than you think.', eff: { rep: { senate: 6, people: 4 }, xp: 26, attrs: { fides: 1 } }, disp: { crassus: .1, cato: .15, aurelia: .2 }, flag: 'burnedLedger' }
      ]
    }),
    s11: sc('Cato, sleepless', '', [
      ['cato', 'I have not slept for two nights and I do not want sympathy. I want a name, a place and a time, written down, in the order in which they will happen.'],
      ['cato', 'There are men in this city with torches and reasons, and the reasons are always money. If you have proof, bring it before the house. If you have only suspicion, keep it — suspicion kills the innocent and misses the guilty, and then it comes back for the man who held it.'],
      ['cato', 'The army will not move on a speech. It moves on a decree, and the decree will pass only if the house is frightened more than it is greedy. That is the arithmetic of the Republic and I have hated it for thirty years.'],
      ['narrator', 'He is already dressed. He has been dressed since yesterday.']
    ]),

    /* ================= ACT III — the city in the balance ================= */
    s12: sc('The Rostra, at the ninth hour', 'Act III', [
      ['narrator', 'The crowd below the platform is not a mob; it is forty thousand small arguments that have agreed to stand in one place.'],
      ['narrator', 'They have come for bread they have not got, for games that have not been announced, and for the pleasure of watching a senator be humiliated by one of his own kind.'],
      ['cicero', 'Speak to the middle of them, not the front. The front will cheer anything. The middle decides whether you live to be consul.'],
      ['narrator', 'You have one sentence to begin with. Rome has always judged men on their first sentence.']
    ], {
      q: 'How will you begin?',
      opts: [
        { t: 'With bread: the price of grain, and who is holding it.', say: 'By the fourth word the shouting stops, because they can hear a number.', eff: { rep: { people: 16 }, auctoritas: 10, xp: 34, attrs: { rhetoric: 1 } }, flag: 'breadSpeech' },
        { t: 'With the army: the legions, the provinces, the men who die for Rome.', say: 'The veterans at the back of the crowd put their hands together first, and the rest follow out of habit.', eff: { rep: { army: 14, people: 6 }, auctoritas: 12, xp: 34 }, flag: 'armySpeech' },
        { t: 'With a name: the man who has been buying this city quietly.', say: 'You can hear the crowd turn, like a very large animal shifting its weight.', eff: { rep: { people: 10, senate: -8 }, auctoritas: 16, xp: 36, attrs: { cunning: 1 } }, disp: { vatinius: -.3, cato: .1 }, flag: 'namingSpeech' }
      ]
    }),
    s13: sc('The camp or the house', '', [
      ['marius', 'The legion at Fidenae has not been paid for two seasons. Do you know what an unpaid legion is? It is a very well-organised mob with better weapons than the other mob.'],
      ['marius', 'You can take the money from the treasury, in which case Cato will call you a thief by nightfall. Or you can find it somewhere else, in which case whoever gives it to you will own the legion, and therefore own you.'],
      ['marius', 'Both of those are the same crime with different clothes on. Choose which clothes you prefer, and then never explain the choice to anybody, because explaining is what gets men killed.'],
      ['narrator', 'Somewhere south, four thousand men are drilling in a field because it is the only thing to do when you are owed money.']
    ], {
      q: 'Where does the army\u2019s pay come from?',
      opts: [
        { t: 'The treasury, openly, and let the house howl.', say: 'At least it is in the records. I have spent my life in armies and I have never once been able to say that.', eff: { rep: { army: 16, senate: -8, people: 4 }, auctoritas: 12, xp: 36 }, disp: { marius: .25, cato: -.15 }, flag: 'armyTreasury' },
        { t: 'From Berenice and the eastern trade. Money with a name on it.', say: 'Money is the least patriotic thing in the world and the only thing that has never lied to me.', eff: { denarii: 2000, rep: { army: 12 }, xp: 34, attrs: { cunning: 1 } }, disp: { berenice: .3, marius: .1 }, flag: 'armyBerenice' },
        { t: 'From Crassus, and accept what that means.', say: 'Ah. So we are all his men after all. It is a large house; there is room.', eff: { denarii: 3000, rep: { army: 10 }, xp: 32 }, disp: { crassus: .3, cato: -.25, marius: -.1 }, flag: 'armyCrassus' }
      ]
    }),
    s14: sc('The trial of Gnaeus', '', [
      ['cato', 'He is one of yours. Do not pretend otherwise; the whole house knows who put him in that chair and it is the man who is now asking me to look away.'],
      ['cato', 'If you defend him, you will be defending the very thing you told the crowd you would end. If you condemn him, you will lose two of your clients and half your faction by the morning.'],
      ['cato', 'I told you suspicion kills the innocent. It also kills the guilty, in the end, and rather slowly. I am prepared to be patient. Are you?'],
      ['narrator', 'There is a man in a chair in front of both of you who has begun to understand that he is a lesson.']
    ], {
      q: 'What do you do with Gnaeus?',
      opts: [
        { t: 'Prosecute him yourself, and be seen to do it.', say: 'You have just bought the one thing you cannot buy back: a reputation for not looking away.', eff: { rep: { senate: 14, people: 8 }, auctoritas: 18, xp: 42 }, disp: { cato: .35, cicero: .2 }, flag: 'prosecutedGnaeus' },
        { t: 'Defend him, badly, and lose.', say: 'A loyal man in the provinces is worth more than a dead one and cheaper than a dangerous one.', eff: { rep: { senate: -6, army: 10 }, auctoritas: 4, xp: 38, denarii: 900 }, disp: { marius: .2, cato: -.25 }, flag: 'defendedGnaeus' },
        { t: 'Buy the verdict, quietly, and tell no one.', say: 'It worked. It always works. That is the trouble with it.', eff: { denarii: -1200, rep: { senate: 4 }, auctoritas: 6, xp: 34, attrs: { cunning: 2 } }, disp: { cato: -.1, crassus: .2 }, flag: 'boughtGnaeus' }
      ]
    }),
    s15: sc('The province', '', [
      ['marius', 'Two legions, one river, and a king with a hill fort who has beaten Roman armies twice and will explain to you at length why the third time will be different.'],
      ['marius', 'You will not have enough cavalry and the grain will be late. That is not bad luck; that is every campaign. Draw your line along the ridge, keep the auxiliaries out of the bog, and do not chase them into the trees.'],
      ['marius', 'Whatever the augurs say, the men will believe the first hour of it. So make the first hour count, and let me do the shouting.'],
      ['narrator', 'Ahead, in the wet grey distance, an army is standing on a hill it believes it can hold.']
    ]),
    s16: sc('Your mother\u2019s bargain', '', [
      ['cornelia', 'There is a house in the Subura with three magistracies in its ward and a daughter of twenty-two. They will bring grain, ships and five hundred clients with them.'],
      ['cornelia', 'Or there is the priest\u2019s family, which brings nothing but respectability, and respectability is the one debt that is never called in.'],
      ['cornelia', 'I am not sentimental about this. I married for the family and I have been content twice in forty years, which is above the average and I am told I should be grateful.'],
      ['narrator', 'She waits. She has waited for years; one more minute costs her nothing.']
    ], {
      q: 'Which house do you join?',
      opts: [
        { t: 'The merchants. Grain, ships, five hundred clients, and a wife you have met once.', say: 'It is done, then. The dowry arrives before the wedding, which tells you what they think of us.', eff: { denarii: 4000, rep: { people: 10 }, auctoritas: 6, xp: 30 }, disp: { cornelia: .2, berenice: .15 }, flag: 'marriedMerchants' },
        { t: 'The priests. Let the city think you are pious before it thinks you are rich.', say: 'You will be poorer and you will be trusted. Trust has fed this family before.', eff: { rep: { senate: 8, people: 8 }, auctoritas: 10, xp: 32, attrs: { fides: 1 } }, disp: { cornelia: .3, aurelia: .3, cato: .1 }, flag: 'marriedPriests' },
        { t: 'Neither. Marry nobody and owe nobody.', say: 'Then you have chosen the most expensive thing in Rome, and I hope it is worth what you will pay for it.', eff: { auctoritas: 12, xp: 30, attrs: { gravitas: 1 } }, disp: { cornelia: -.2, cato: .1 }, flag: 'marriedNobody' }
      ]
    }),
    s17: sc('The night of knives', '', [
      ['narrator', 'It happens the way these things always happen: without a signal, in four places at once, and slightly too early.'],
      ['aurelia', 'The fire is being carried out of the city in nine lanterns and the Vestals have been forbidden to notice. I am ignoring that instruction, which is a crime, and I am telling you first because you are the only man in this city who will act before dawn.'],
      ['catilina', 'Do not look for me in the morning. Look at what is left of the house and ask yourself, honestly, whether I did it or whether I merely arrived in the same week as the catastrophe.'],
      ['narrator', 'The Subura is already glowing at the edges. Somewhere a watch is blowing a whistle that has been out of tune since the last consul.']
    ]),
    s18: sc('The consul\u2019s year', 'Act IV', [
      ['narrator', 'You are consul. The chair is uncomfortable — nobody has ever mentioned that — and it faces the door, so you see everyone who comes in before they see you.'],
      ['cicero', 'Congratulations. Now the important part: in twelve months, nobody will remember that you held it. Consuls are weather. The man who writes the decree, or the man who commands the legion, that is who is remembered.'],
      ['cicero', 'Pass one law that stays passed. One. Not six. Six laws is a career; one law that outlives you is a country.'],
      ['narrator', 'Outside, in the Forum, the clerks are already copying your name into the fasti. It takes them a quarter of an hour per consul and they do it in order, every year, without fail.']
    ]),
    s19: sc('The man who will not kneel', '', [
      ['cato', 'So here it is. The army is at Fidenae, the grain is bought, the provinces are paying, and every one of those things was arranged by you personally, outside the law, for the good of the state.'],
      ['cato', 'I have watched better men than you do exactly this and I have watched what they became. Give the legions back. Give the provinces to the Senate and take the provinces you are given.'],
      ['crassus', 'Do not be dramatic, Cato. He is one general with two legions in a wet field. I have three hundred contracts with the treasury and nobody has ever called me a tyrant, because a tyrant is a man who wants the chair and I have never wanted anything I could not bill for.'],
      ['narrator', 'They are both right, which is the thing nobody tells you about the Republic. Its crises are always between two correct men.']
    ], {
      q: 'How much of it do you give back?',
      opts: [
        { t: 'All of it. The legions, the provinces, the ledgers.', say: 'Then you are the first man in eighty years to do it voluntarily, and the house will spend the rest of your life trying to work out why.', eff: { rep: { senate: 20, people: 8 }, auctoritas: 24, xp: 60 }, disp: { cato: .4, marius: -.2, crassus: -.1 }, flag: 'gaveBack' },
        { t: 'The provinces, but keep the legions. Somebody has to hold the roads.', say: 'Half of it is how the last three men started. Shall I mark the other half on a tablet for you?', eff: { rep: { army: 16, senate: -6 }, auctoritas: 16, xp: 60 }, disp: { marius: .25, cato: -.3 }, flag: 'keptArmy' },
        { t: 'Nothing. The Republic has been asking for this for a hundred years.', say: 'Then say it plainly in the house, so the clerks can copy it into the record for the man who comes after you.', eff: { rep: { army: 12, people: 10, senate: -18 }, auctoritas: 20, xp: 62 }, disp: { cato: -.45, marius: .3, crassus: .2 }, flag: 'keptAll' }
      ]
    }),
    s20: sc('The morning after', '', [
      ['narrator', 'Rain. Again. The fires in the Subura are out as far as the Argiletum, and the carts are moving in the streets before the fourth hour.'],
      ['narrator', 'In the curia the clerks are copying the decrees into the archives — an act that takes twenty years off a memory and adds twenty to a name.'],
      ['narrator', 'There is a crowd outside your door: criers, clients, a provincial with a petition, two soldiers who want paying, and three men from the house who have come to tell you what is best for Rome.'],
      ['narrator', 'For one moment — this one, in this rain, with the crowd not yet shouting — you may choose what you are going to be.']
    ], {
      q: 'What do you make of it?',
      opts: [
        { t: 'Nothing. The Republic is the Republic; you will simply serve it.', say: 'The house votes thanks. The crowd cheers your name twice and then thinks about bread, which is what crowds do.', eff: { rep: { senate: 20, people: 10 }, auctoritas: 30, xp: 80 }, end: 'republic' },
        { t: 'Take the crown. The city has never once deserved a master less than it deserved its factions.', say: 'The soldiers at the front of the crowd kneel without being told. The senators behind them look at each other and work out, very fast, who has already been paid.', eff: { rep: { army: 20, people: 20, senate: -30 }, auctoritas: 40, xp: 80 }, end: 'crown' },
        { t: 'Walk away. Let the city have the rest of your life and take nothing.', say: 'You are at Ostia by the third day, and the clerks have already begun to write that you died at the right moment, which is the kindest thing they can write about anybody.', eff: { auctoritas: 24, xp: 80 }, disp: { cato: .3, aurelia: .2 }, end: 'exile' }
      ]
    })
  };

  /* ---------------- the chapters ---------------- */
  const CH = [
    { id: 's1', act: 1, n: 1, giver: 'cicero', ic: '🏛️', title: 'The First Morning', where: 'forum', needs: [],
      d: 'Your seat in the Senate is an empty chair and a name nobody knows. Cicero has decided to be seen speaking to you, which is either a favour or a purchase.',
      steps: [
        { at: 'rostra', act: 'Hear the crier and the crowd', text: 'Stand at the Rostra and hear what Rome is saying' },
        { at: 'curia', act: 'Take your seat in the house', text: 'Take your seat in the Senate for the first time' },
        { at: 'basilica', act: 'Argue your first case', text: 'Argue a case in the Basilica and win the clerks over' }
      ], reward: { xp: 40, auctoritas: 8, rep: { senate: 4, people: 6 } }, scene: 's1' },
    { id: 's2', act: 1, n: 2, giver: 'crassus', ic: '💰', title: 'The Price of a Name', where: 'domus', needs: ['s1'],
      d: 'Crassus funds careers the way other men fund horses: early, cheaply, and with a view to the winnings. He has a contract and a smile.',
      steps: [
        { at: 'domus', act: 'Read the contract with Aulus', text: 'Read the contract with Aulus, clause by clause' },
        { at: 'subura', act: 'Ask who really guarantees the loan', text: 'Ask in the Subura who is really behind the loan' },
        { at: 'curia', act: 'Give Crassus your answer in the house', text: 'Answer Crassus where the whole house can hear it' }
      ], reward: { denarii: 1500, xp: 45, auctoritas: 10 }, scene: 's2' },
    { id: 's3', act: 1, n: 3, giver: 'aulus', ic: '🌾', title: 'The Grain Ships', where: 'portus', needs: ['s1'],
      d: 'Two grain fleets overdue, warehouses empty, ledgers full. Aulus has done the arithmetic and does not like the answer.',
      steps: [
        { at: 'portus', act: 'Question the harbourmaster', text: 'Question the harbourmaster at the Portus' },
        { at: 'macellum', act: 'Find the grain factor', text: 'Find the factor who bought the missing cargo' },
        { at: 'rostra', act: 'Name the ring from the Rostra', text: 'Name the ring aloud, from the Rostra' }
      ], reward: { denarii: 1200, xp: 55, auctoritas: 16, rep: { people: 12, senate: -4 } }, scene: 's3' },
    { id: 's4', act: 1, n: 4, giver: 'pullo', ic: '🗡️', title: 'Blood in the Subura', where: 'subura', needs: ['s1'],
      d: 'A wine-seller with his throat opened and a good cloak seen leaving the alley. Pullo wants five minutes; the law wants a trial.',
      steps: [
        { at: 'subura', act: 'Work the alley for witnesses', text: 'Work the alley and find who saw the cloak' },
        { at: 'ludus', act: 'Ask the gladiators what they saw', text: 'Ask the gladiators at the Ludus what they saw' },
        { at: 'curia', act: 'Decide what is to be done', text: 'Decide, in the house, what is to be done with him' }
      ], reward: { xp: 50, auctoritas: 12, rep: { people: 8 } }, scene: 's4' },
    { id: 's5', act: 1, n: 5, giver: 'marius', ic: '🦅', title: 'The Lost Eagle', where: 'castra', needs: ['s3'],
      d: 'A legion broke in the Thracian hills and its eagle went into a marsh. Petreius thinks the eagle is worth more than the men were, and he is probably right.',
      steps: [
        { at: 'castra', act: 'Take Petreius\u2019s volunteers', text: 'Take the volunteers and the pay chest' },
        { at: 'temple', act: 'Take the omens before you march', text: 'Take the omens at the Temple of Mars' },
        { at: 'castra', act: 'March east and bring it home', text: 'March into Thrace and bring the eagle home', battle: 'thracia' }
      ], reward: { denarii: 900, xp: 70, auctoritas: 24, rep: { army: 16, senate: 4 } }, scene: 's5' },

    { id: 's6', act: 2, n: 6, giver: 'vatinius', ic: '🐍', title: 'The Rival', where: 'curia', needs: ['s5'],
      d: 'Vatinius has begun telling the house that you are lucky. Luck is the worst thing that can be said about a man, because it runs out in public.',
      steps: [
        { at: 'curia', act: 'Answer Vatinius on the floor', text: 'Answer Vatinius on the floor of the house' },
        { at: 'balnea', act: 'Find who he has been paying', text: 'Find out who he has been paying, in the baths' },
        { at: 'basilica', act: 'Break his contract in the courts', text: 'Break his contract in the courts' }
      ], reward: { xp: 80, auctoritas: 20, rep: { senate: 10 } }, scene: 's6' },
    { id: 's7', act: 2, n: 7, giver: 'catilina', ic: '🔥', title: 'The Meeting', where: 'subura', needs: ['s6'],
      d: 'Catilina has been recruiting, and the recruitment has stopped being a joke. He wants you at the next meeting, and he wants an answer.',
      steps: [
        { at: 'subura', act: 'Attend the meeting', text: 'Attend the meeting in the back room' },
        { at: 'balnea', act: 'Count who else was there', text: 'Find out, in the baths, who else was at that table' },
        { at: 'basilica', act: 'Decide what you will swear to', text: 'Decide what, and before whom, you will swear' }
      ], reward: { xp: 90, auctoritas: 22, rep: { senate: 6 } }, scene: 's7' },
    { id: 's8', act: 2, n: 8, giver: 'cornelia', ic: '☠️', title: 'The Poisoner', where: 'domus', needs: ['s6'],
      d: 'Two cousins dead in one week, both after drinking at the same table. Your mother has made a list, and your mother is usually exact.',
      steps: [
        { at: 'domus', act: 'Question your own household', text: 'Question your own household, name by name' },
        { at: 'balnea', act: 'Follow the trail to the baths', text: 'Follow the poisoner to the baths' },
        { at: 'basilica', act: 'Bring the charge', text: 'Bring the charge in the Basilica' }
      ], reward: { denarii: 700, xp: 85, auctoritas: 18, rep: { senate: 10, people: 4 } }, scene: 's8' },
    { id: 's9', act: 2, n: 9, giver: 'berenice', ic: '🏹', title: 'Silk and Arrows', where: 'portus', needs: ['s6'],
      d: 'A Parthian envoy with silk, eight horses and a proposal that is either an alliance or an insult. Berenice thinks it is both, and that the insults are the interesting part.',
      steps: [
        { at: 'portus', act: 'Meet the envoy at the wharf', text: 'Meet the Parthian envoy at the wharf' },
        { at: 'curia', act: 'Read the proposal aloud', text: 'Read their proposal aloud in the house' },
        { at: 'temple', act: 'Take the gods\u2019 judgement', text: 'Take the gods\u2019 judgement before you answer' }
      ], reward: { denarii: 1800, xp: 90, auctoritas: 22 }, scene: 's9' },
    { id: 's10', act: 2, n: 10, giver: 'crassus', ic: '📜', title: 'The Ledger', where: 'curia', needs: ['s8'],
      d: 'Crassus has decided to test what kind of man you have become. He has left a ledger where you will find it, which is itself a kind of sentence.',
      steps: [
        { at: 'tabularium', act: 'Audit the public contracts', text: 'Audit the public contracts in the record office' },
        { at: 'subura', act: 'Trace where the money went', text: 'Trace where the money actually went' },
        { at: 'forum', act: 'Decide what you owe Crassus', text: 'Decide, in the open Forum, what you owe Crassus' }
      ], reward: { denarii: 2400, xp: 95, auctoritas: 24 }, scene: 's10' },
    { id: 's11', act: 2, n: 11, giver: 'cato', ic: '⚖️', title: 'Name the Names', where: 'curia', needs: ['s7', 's10'],
      d: 'Cato has gone two nights without sleep and wants names, places and dates, written down, in the order in which they will happen.',
      steps: [
        { at: 'curia', act: 'Lay the evidence before the house', text: 'Lay the evidence before the house' },
        { at: 'rostra', act: 'Speak to the crowd below', text: 'Speak to the crowd from the Rostra and hold them' },
        { at: 'castra', act: 'Put the army on the roads', text: 'Put the army on the roads' }
      ], reward: { xp: 110, auctoritas: 30, rep: { senate: 12, people: 8 } }, scene: 's11' },

    { id: 's12', act: 3, n: 12, giver: 'cicero', ic: '🗣️', title: 'The Rostra', where: 'rostra', needs: ['s11'],
      d: 'Forty thousand people, no bread, no games, and one sentence to begin with. Rome has always judged men on their first sentence.',
      steps: [
        { at: 'rostra', act: 'Speak from the platform', text: 'Speak to the crowd from the Rostra' },
        { at: 'forum', act: 'Walk the crowd afterwards', text: 'Walk the Forum afterwards and let them touch your toga' },
        { at: 'curia', act: 'Make the house listen', text: 'Make the house listen to what the crowd said' }
      ], reward: { xp: 120, auctoritas: 28, rep: { people: 12 } }, scene: 's12' },
    { id: 's13', act: 3, n: 13, giver: 'marius', ic: '⚔️', title: 'The Price of a Legion', where: 'castra', needs: ['s12'],
      d: 'The legion at Fidenae has not been paid for two seasons. An unpaid legion is a very well-organised mob with better weapons than the other mob.',
      steps: [
        { at: 'tabularium', act: 'Look at the treasury\u2019s books', text: 'Look at what is actually left in the treasury' },
        { at: 'portus', act: 'Ask the eastern trade for terms', text: 'Ask the eastern trade what their terms would be' },
        { at: 'castra', act: 'Pay the legion', text: 'Find the money and pay the legion' }
      ], reward: { xp: 130, auctoritas: 22, rep: { army: 18 } }, scene: 's13' },
    { id: 's14', act: 3, n: 14, giver: 'cato', ic: '🪶', title: 'The Trial of Gnaeus', where: 'basilica', needs: ['s13'],
      d: 'One of your own men is in the dock, and the whole house is watching to see whether your speeches about the law were a policy or a performance.',
      steps: [
        { at: 'basilica', act: 'Take the case', text: 'Take the case, one way or the other' },
        { at: 'forum', act: 'Hear what the Forum thinks', text: 'Hear what the Forum thinks of you this week' },
        { at: 'curia', act: 'Give the verdict to the house', text: 'Give the verdict to the house' }
      ], reward: { xp: 130, auctoritas: 26, rep: { senate: 8 } }, scene: 's14' },
    { id: 's15', act: 3, n: 15, giver: 'marius', ic: '🏔️', title: 'The Province', where: 'castra', needs: ['s14'],
      d: 'Two legions, one river, and a king in a hill fort who has beaten Roman armies twice and will explain at length why the third time will be different.',
      steps: [
        { at: 'temple', act: 'Take the auspices for the campaign', text: 'Take the auspices for the campaign' },
        { at: 'castra', act: 'Draw up the legions', text: 'Draw the legions up in the camp' },
        { at: 'castra', act: 'Take the hill', text: 'Take the hill fort', battle: 'dacia' }
      ], reward: { denarii: 2600, xp: 160, auctoritas: 34, rep: { army: 20 } }, scene: 's15' },
    { id: 's16', act: 3, n: 16, giver: 'cornelia', ic: '🕯️', title: 'The Bargain', where: 'domus', needs: ['s15'],
      d: 'Two houses want your name, one for its grain and one for its gods, and your mother has been negotiating since before you were born.',
      steps: [
        { at: 'domus', act: 'Hear your mother out', text: 'Hear your mother out, to the end' },
        { at: 'temple', act: 'Ask what the gods want', text: 'Ask what the gods want, if anything' },
        { at: 'macellum', act: 'Meet both families', text: 'Meet both families in the market' }
      ], reward: { xp: 120, auctoritas: 20, denarii: 1500 }, scene: 's16' },
    { id: 's17', act: 3, n: 17, giver: 'aurelia', ic: '🔥', title: 'The Night of Knives', where: 'vesta', needs: ['s16'],
      d: 'It happens the way these things always happen: without a signal, in four places at once, and slightly too early.',
      steps: [
        { at: 'vesta', act: 'Hear what the Vestal knows', text: 'Hear what the Vestal knows' },
        { at: 'subura', act: 'Put out the fires', text: 'Put out the fires in the Subura' },
        { at: 'castra', act: 'Meet Catilina’s army', text: 'March into Etruria and meet Catilina’s army', battle: 'etruria' }
      ], reward: { xp: 180, auctoritas: 30, rep: { people: 16, army: 10 } }, scene: 's17' },

    { id: 's18', act: 4, n: 18, giver: 'cicero', ic: '🪑', title: 'The Consul\u2019s Year', where: 'curia', needs: ['s17'],
      d: 'You are consul. The chair is uncomfortable and it faces the door. Pass one law that stays passed: one, not six.',
      steps: [
        { at: 'curia', act: 'Open the year with a speech', text: 'Open the year with a speech that is not about yourself' },
        { at: 'tabularium', act: 'Write the law down properly', text: 'Have the law written down properly' },
        { at: 'rostra', act: 'Read the law to the city', text: 'Read the law to the city from the Rostra' }
      ], reward: { xp: 200, auctoritas: 34, rep: { people: 10, senate: 10 } , scene: 's18' }, scene: 's18' },
    { id: 's19', act: 4, n: 19, giver: 'cato', ic: '🏛️', title: 'The Man Who Will Not Kneel', where: 'curia', needs: ['s18'],
      d: 'Cato and Crassus are both right, which is the thing nobody tells you about the Republic: its crises are always between two correct men.',
      steps: [
        { at: 'curia', act: 'Meet Cato in the house', text: 'Meet Cato in the house and hear him out' },
        { at: 'temple', act: 'Take the last auspices', text: 'Take the last auspices at the Temple of Mars' },
        { at: 'forum', act: 'Give your answer to the Forum', text: 'Give your answer in the open Forum' }
      ], reward: { xp: 220, auctoritas: 36 }, scene: 's19' },
    { id: 's20', act: 4, n: 20, giver: 'aurelia', ic: '☔', title: 'The Morning After', where: 'domus', needs: ['s19'],
      d: 'Rain, fires out as far as the Argiletum, and a crowd outside your door. For one moment, with the crowd not yet shouting, you may choose what you are going to be.',
      steps: [
        { at: 'domus', act: 'Stand on your own threshold', text: 'Stand on your own threshold and look at the crowd' },
        { at: 'temple', act: 'Give thanks at the altar', text: 'Give thanks at the altar of Mars' },
        { at: 'curia', act: 'Tell Rome what it is to be', text: 'Tell the Senate what Rome is to be' }
      ], reward: { xp: 260, auctoritas: 40 }, scene: 's20' }
  ];

  const chapter = id => CH.find(c => c.id === id) || null;
  const done = (state, id) => (state.quests.done || []).includes(id);
  const active = (state, id) => (state.quests.active || []).includes(id);
  const flags = state => (state.story && state.story.flags) || {};
  /* the next chapter you are allowed to be offered: its predecessors finished, and any opinion of the city satisfied */
  function next(state) {
    return CH.find(c => !done(state, c.id) && !active(state, c.id) && (c.needs || []).every(n => done(state, n))) || null;
  }
  const offerable = (state, id) => {
    const c = chapter(id);
    if (!c || done(state, id) || active(state, id)) return false;
    return (c.needs || []).every(n => done(state, n));
  };
  const actOf = state => {
    let a = 1;
    CH.forEach(c => { if (done(state, c.id)) a = Math.max(a, c.act); });
    return a;
  };

  const endings = {
    republic: { title: 'The Republic Endures', ic: '🏛️', lines: [
      ['narrator', 'The house votes thanks. The crowd cheers your name twice and then goes to look for bread, which is what crowds do.'],
      ['narrator', 'You keep your hands clean and your name in the fasti, and Rome spends the next twenty years being governed by committees of men who all believe they could do better.'],
      ['cato', 'You did the dull, correct thing. It will not be remembered, and that is precisely what makes it right.'],
      ['narrator', 'You are consul again in six years, and again after that. On the day you die the city is still arguing with itself. The Republic is exhausting. It is also yours.']
    ] },
    crown: { title: 'Imperium', ic: '⚡', lines: [
      ['narrator', 'The soldiers at the front of the crowd kneel without waiting to be told. Behind them, the senators look at each other and calculate, very fast, who has already been paid.'],
      ['narrator', 'By the fourth hour the guard has been doubled everywhere it matters, the archives have been sealed, and a courier is riding for the provinces with your name in the first line.'],
      ['aurelia', 'You took the oath of a magistrate and you meant it. That is what makes this the worst thing you have done.'],
      ['narrator', 'Rome is quieter than it has been in a hundred years, and nobody in the city can quite decide whether that is peace, or the noise before the next thing.']
    ] },
    exile: { title: 'The Man Who Walked Away', ic: '⛵', lines: [
      ['narrator', 'You are at Ostia by the third day, with two slaves, a chest of letters and no lictors. The clerks write that you retired, which is their polite word for a man they have stopped counting.'],
      ['cornelia', 'You have done the only thing I have ever asked of you: you are alive, and the family name has nothing to pay for this year.'],
      ['narrator', 'In six months the letters stop coming, and in a year the house on the Palatine is somebody else\u2019s and has a new mosaic in the atrium.'],
      ['narrator', 'You live another twenty-two years in a Greek town, and you are remembered there as a kind, slightly too serious old Roman who always knew what was about to happen in the city and would never say.']
    ] }
  };
  /* what the crier shouts in the street, which changes as the career turns */
  const CRIER = [
    ['The aediles are buying grain again: the price of bread falls a quarter of an as, this week only.',
      'A senator was seen in the Subura last night and his household says he was at the baths. The baths say otherwise.',
      'Sixteen grain ships in from Egypt. A press of porters at the wharf, and two arrested for theft.',
      'A dog was elected to a ward office in the Subura. He is said to be honest.'],
    ['The grain fleets are overdue and the aediles are promising the moon in writing.',
      'A man was arrested at the Portus with a manifest signed by nobody. Three senators deny the signature and two of them are lying.',
      'Vatinius promises games in the autumn. Somebody has written his name on the wall by the Circus. He did it himself.',
      'A priest has refused to take the auspices until he is paid. The house has voted him the money and a new cloak.'],
    ['Troops have been seen on the Flaminian road and nobody will say whose.',
      'The house has sat past the ninth hour two days running. The clerks have stopped going home.',
      'A thunderstorm broke over the Circus at dawn. The augurs have been asked twice and refuse to answer in the same words.',
      'They are pulling the tiles off the roof of the Basilica again to sell. Third time this year.'],
    ['The city is quiet. Nobody in the Forum believes it.',
      'Oil, grain and leather have all risen, and the guard at the Portus has trebled.',
      'Two men were taken up for writing on the doors of the house. One of them wrote the truth.',
      'The consul is said to be unwell. The consul was seen at dawn walking the whole length of the Via Sacra alone.']
  ];
  const crier = state => {
    const t = actOf(state);
    const pool = CRIER[Math.min(3, Math.max(0, t - 1))];
    return pool[Math.floor(Math.random() * pool.length)];
  };
  /* a letter from Aulus when an act turns over: cheap to build, and it makes the year feel like it is going somewhere */
  const letters = [
    { at: 2, who: 'aulus', lines: [
      ['aulus', 'Dominus — the household accounts for the season, and two pieces of news I would rather tell you in person.'],
      ['aulus', 'First: men have begun to ask after your health in the Forum, and they ask in the way a creditor asks. Second: Catilina has been seen three times at a house in the Subura, each time with fewer men than the time before.'],
      ['aulus', 'I have bought the household two more years of quiet. What you do with them is not my department, and I am glad of it.']
    ] },
    { at: 3, who: 'aulus', lines: [
      ['aulus', 'Dominus — the city is frightened, which is expensive. Oil, grain and leather have all risen, and the guard at the Portus has trebled.'],
      ['aulus', 'I have sent the family plate to the house of your mother\u2019s cousin, where nobody will look for it, and I have written to the province asking the legates what they have heard.'],
      ['aulus', 'Whatever you decide in the next month, decide it before the market opens, not after. Markets forgive nothing.']
    ] },
    { at: 4, who: 'cornelia', lines: [
      ['cornelia', 'You are consul, and the house is full of people. I have told the doorkeeper to admit nobody before the second hour, including senators, especially senators.'],
      ['cornelia', 'Your father had one year of this and spent nine months of it being flattered. I remember every man who helped him and every man who did not, and I have written both lists down.'],
      ['cornelia', 'Eat something. Consuls who do not eat are consuls who make decisions in the afternoon.']
    ] }
  ];
  const letterAt = act => letters.find(l => l.at === act) || null;

  return { SCENES, CH, endings, chapter, next, offerable, done, active, actOf, flags, crier, letterAt, scene: id => SCENES[id] || null };
})();

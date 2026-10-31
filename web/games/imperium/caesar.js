/* CAESAR — the second way to play: not a career you invent, but the most documented life in Roman history, told as
   a career you still have to make the decisions in.

   Same engine as the first story (a place, an action, a reward), but every chapter is a real year, and the world
   around you is full of people who are already famous and will still be surprised by what you do. Sixteen chapters
   in four acts: the Subura, the pirates, the priesthood, the triumvirate, Gaul, the Rubicon, Pharsalus, the Nile,
   and the morning in March when the whole thing is decided by other men. */
window.CAESAR = (() => {
  'use strict';
  const sc = (title, sub, lines, choose) => ({ title, sub, lines, choose });

  const SCENES = {
    /* ================= ACT I — the boy from the Subura ================= */
    c1: sc('The Subura, the sixth hour', 'Act I · 100 BC', [
      ['narrator', 'You are born in a house in the Subura with a bad roof and a good name, which is the most Roman combination there is: the Julii claim Venus and cannot afford a new gutter.'],
      ['aurelia', 'He is small. Do not tell me he is small, and do not tell your father. Give him to me.'],
      ['narrator', 'Your mother is Aurelia, and she will be the most exact person you ever know. The midwife has already told the neighbours; by morning, half the street will have an opinion about your future.'],
      ['narrator', 'Down the alley lives a man who is consul for the sixth time and keeps his trophies in a shed: Gaius Marius, your uncle by marriage, who has no ancestors and no patience and has beaten two armies and the Senate in the same decade.'],
      ['narrator', 'The city is a hundred thousand arguments and you have been entered into all of them without being asked.']
    ]),
    c2: sc('Pharmacusa, and the men who laughed', 'Act I · 75 BC', [
      ['narrator', 'The pirates take you off the boat near Pharmacusa with the calm of men who have done this eleven hundred times. They ask what you are worth.'],
      ['narrator', 'You tell them twenty talents. They laugh so hard that one of them has to sit down on a rock. The going rate for a young aristocrat is eight.'],
      ['narrator', 'You spend thirty-eight days with them. You tell them what to do about their ship, their wine and their poetry. You tell them, in the evenings, that when this is over you will have every one of them crucified. They think it is a joke. It is not a joke; it is a statement of the schedule.'],
      ['cornelia', 'They have sent the demand. My dowry is in the chest and my father has not spoken to me since you were taken. Take the money and come home, Gaius, and then do not go to sea again.'],
      ['narrator', 'You are twenty-five. Everything you will ever do is decided by what kind of man you are when nobody is making you be one.']
    ], {
      q: 'What do you do about the twenty talents?',
      opts: [
        { t: 'Pay the ransom, then crucify them anyway. A promise is a promise.', say: 'You have made an enemy of every pirate in the Aegean and a name that will travel faster than you do.', eff: { denarii: -900, auctoritas: 14, xp: 40, rep: { army: 6, people: 8 } }, disp: { cornelia: -.1, pullo: .2 }, flag: 'crucifiedPirates' },
        { t: 'Pay the ransom and let them go. The money is cheaper than the reputation.', say: 'You are learning the first law of Roman politics: a thing not done can always be done later.', eff: { denarii: -900, xp: 28, attrs: { cunning: 1 } }, disp: { cornelia: .2 }, flag: 'sparedPirates' },
        { t: 'Refuse to pay. Take their ships with your own men.', say: 'The pirates had fifty men who did not expect a Roman with a plan. They now have a story they will tell in whatever comes next.', eff: { denarii: -300, auctoritas: 20, xp: 46, rep: { army: 14 } }, disp: { pullo: .35, cato: .1 }, flag: 'tookTheirShips' }
      ]
    }),
    c3: sc('The pontiff’s house', 'Act I · 63 BC', [
      ['narrator', 'The Pontifex Maximus is a title held by a man called Caecilius Metellus, and he is old, and he is rich, and he does not want to die. He will anyway.'],
      ['crassus', 'The office is not res divina. It is a house on the Via Sacra with a thousand visitors a year and the right to say what the gods think about any bill you do not like. It goes to the man who knows how to win a public vote.'],
      ['crassus', 'I will help. Not out of affection; I am not accused of that. If you are pontifex, I will know what the augurs will say before the Senate does, and that is worth more than the money.'],
      ['aurelia', 'You have spent your wife’s dowry. You have spent the money you borrowed to spend the dowry. Do not tell me what the office is worth. Tell me what your daughter will eat at the end of the year.'],
      ['narrator', 'That winter a scandal works its way through every dining room in Rome: the rites of the Bona Dea, held in your house, attended by women only — and a man inside. His name is Clodius and he will be either your deadliest enemy or your best instrument.']
    ], {
      q: 'Clodius is discovered inside the rites. What do you say?',
      opts: [
        { t: 'Divorce your wife publicly and deny you knew anything.', say: 'The house remembers the divorce and the placard both. Clodius’s men remember that you were the only man who came out of it looking clean.', eff: { rep: { senate: 8, people: -4 }, xp: 34, auctoritas: 8 }, disp: { cato: .2, crassus: -.05 }, flag: 'divorced' },
        { t: 'Say nothing at all, publicly, and do not divorce her.', say: 'You have done the most frightening thing in Roman public life: you have let a rumour go unanswered.', eff: { xp: 40, attrs: { cunning: 2 }, auctoritas: 4 }, disp: { cicero: -.1, pompey: .1 }, flag: 'silentScandal' },
        { t: 'Use it. Clodius owes you now, and a man who owes you is a weapon.', say: 'He will be the best weapon you ever pick up and the last one that will ever be forgiven you for.', eff: { xp: 44, attrs: { cunning: 2 }, rep: { senate: -6 }, auctoritas: 10 }, disp: { clodius: .5, cato: -.3 }, flag: 'clodiusDebt' }
      ]
    }),
    c4: sc('Three heads, one neck', 'Act I · 60 BC', [
      ['pompey', 'I have the legions and the glory and I cannot get a single thing voted for me in that house. Do you understand what it is like to come home from the east and be made to stand in a queue?'],
      ['crassus', 'I have the money and I cannot buy a bill that will not be torn up by the first consul who wants to be popular. Between us, we have everything except a way to make the Senate do it.'],
      ['narrator', 'Three men in a room on the verge of being enemies: the soldier, the banker, and you. Nobody in this city can beat any two of you. None of you can do it alone.'],
      ['pompey', 'Say the thing you are actually going to say. I have been standing here since the fourth hour and my knees are not what they were.'],
      ['narrator', 'This is the arrangement the clerks will later call the three-headed monster. It holds, more or less, for eleven years. Everything that follows comes out of this room.']
    ], {
      q: 'What do you offer Pompey?',
      opts: [
        { t: 'An alliance — his veterans’ land for your command.', say: 'There is no document. There is only a conversation three men will each remember differently later, on purpose.', eff: { auctoritas: 22, xp: 50, rep: { army: 12, senate: -6 } }, disp: { pompey: .35, crassus: .1 }, flag: 'triumvirate' },
        { t: 'His daughter for your daughter’s husband — bind it with blood.', say: 'Julia is nineteen and Pompey is forty-six and every single person in Rome understands exactly what the marriage is for.', eff: { auctoritas: 26, xp: 46, attrs: { cunning: 1 } }, disp: { pompey: .5, cato: -.25 }, flag: 'marriedJulia' },
        { t: 'Offer him nothing. Let him need you and wait.', say: 'Dangerous, and correct, and you will spend two years wondering which of them it was.', eff: { xp: 38, attrs: { cunning: 2 }, rep: { army: -4 } }, disp: { pompey: -.2, crassus: .2 }, flag: 'heldBack' }
      ]
    }),

    /* ================= ACT II — Gaul ================= */
    c5: sc('Genava, and the bridge of one legion', 'Act II · 58 BC', [
      ['narrator', 'The Helvetii are moving: four hundred thousand of them, men, women, carts and cattle, walking out of their own country and into yours. They are not an army. They are a migration, which is worse, because you cannot defeat it, only redirect it.'],
      ['pullo', 'Chief. The bridge at Genava comes down in two days if my men work nights, and the engineering is not the problem. The problem is that every one of those wagons is a family, and the men in the line are already asking what we are going to do about that.'],
      ['narrator', 'You cut the bridge. You build another eleven miles away. You follow a migration for eighteen days, and when you finally turn and fight at Bibracte, you win a battle that kills more of them than a plague would.'],
      ['narrator', 'He states the numbers in his own account, year by year, as though they were weather: a hundred and ten thousand moving out, ninety-two thousand left. He does not say how many he killed. He does not have to.']
    ], {
      q: 'What do you do with the defeated Helvetii?',
      opts: [
        { t: 'Send them home and give them grain. Rome can use a client nation.', say: 'The Helvetii go back to their own land and remember, for one generation, who sent them there and what it cost.', eff: { auctoritas: 14, xp: 52, rep: { senate: 8, people: 4 } }, disp: { pullo: .1 }, flag: 'helvetiiHome' },
        { t: 'Sell them. The war must pay for itself, or the Senate will end it.', say: 'Eleven thousand heads sold by the gross. The report has the terseness of a man describing a supply problem, because that is exactly what it was.', eff: { denarii: 2400, auctoritas: 10, xp: 48, rep: { army: 6, people: -4 } }, disp: { crassus: .2, cato: -.2 }, flag: 'soldHelvetii' },
        { t: 'Make an example. Kill the men, keep the women and children.', say: 'It is not a battle, it is a demonstration, and every tribe between here and the sea understands it perfectly.', eff: { auctoritas: 18, xp: 56, rep: { army: 12, senate: -10, people: -8 } }, disp: { pullo: -.2, cato: -.35 }, flag: 'destroyedHelvetii' }
      ]
    }),
    c6: sc('The river Sabis, and the worst morning', 'Act II · 57 BC', [
      ['narrator', 'The Nervii do not send envoys and do not make terms. They have spent two generations cutting down their own hedges and hedges are the only thing a legion cannot walk through.'],
      ['pullo', 'The Belgians are in the wood across the river, somewhere between forty and eighty thousand of them, and the cavalry has not come back. I have been a centurion for eleven years, chief, and I have never been this unhappy about a wood.'],
      ['narrator', 'You are half an hour into building the camp when they come out of the trees at a run. The legion with the eagles is not formed up. The men work at it with their hands and their shields, and the morning becomes the thing you will remember when you are fifty and cannot sleep.'],
      ['narrator', 'The Tenth holds. You take a shield off a man from the rear rank and stand in the line, because that is the only order you have left to give. By noon the Sabis is full of things that used to be men.']
    ]),
    c7: sc('The sea, and a bridge across the Rhine', 'Act II · 55 BC', [
      ['narrator', 'The Senate has voted thanks for Gaul. The Senate has not yet asked what Gaul costs, how long you mean to stay, or what you will do with two legions that now obey you rather than the year’s consul. That question is coming. You get ahead of it by making the war bigger.'],
      ['narrator', 'You take two legions across the sea to Britain, which the Romans have been saying for a century is a myth with tin in it. You land on a beach against chariots, you take their town, you come back, and you have promised the Senate more than the gods would promise.'],
      ['narrator', 'Then you build a bridge over the Rhine in ten days and walk across it, and back, and burn it. Thirty miles of Roman road-building in a country nobody can hold is not a military plan. It is a sentence written for the clerks who will write the history.']
    ]),
    c8: sc('Alesia', 'Act II · 52 BC', [
      ['vercingetorix', 'You call it a rebellion because it began in a country you had already decided was yours. I am a man with a country and a wall, and you are a man with a bank and a lawyer.'],
      ['narrator', 'The walls are real. And he has done the one clever thing: he has gone behind his walls with eighty thousand men and let you surround him, which means you are now a man with two enemies — him, and everything behind you.'],
      ['vercingetorix', 'Charcoal in the beard and a cloak of some large animal, on the wall of Alesia, sitting on the ground with his hands in his pockets, not cold: “Choose your ground and your day. I have.”'],
      ['narrator', 'You build eighteen miles of ditch, two walls, two camps and forty towers in five weeks. Then the relieving army arrives, and you are the thing that is surrounded, at a wall, with the wall on the other side.'],
      ['pullo', 'Every man here has been awake for two days and the plunder is inside the wall, chief. Whatever you are going to do, do it in the next hour.']
    ], {
      q: 'The relieving army attacks the weak point of the inner wall. What do you do?',
      opts: [
        { t: 'Lead the counter-attack yourself. On foot, in the line.', say: 'You are seen with a crimson cloak on a bad horse in the one place the line breaks. Every man in that army can tell you exactly where you were, twenty years later, and it is not because of the cloak.', eff: { xp: 80, auctoritas: 24, rep: { army: 20 }, attrs: { martial: 1 } }, disp: { pullo: .4, antony: .1 }, flag: 'atAlesia' },
        { t: 'Send the horse around the outside. Take their camp for them.', say: 'The cavalry comes round the back, and the relieving army loses its baggage and then its courage. It works, and it is the sort of thing a careful man might have done just as well.', eff: { xp: 68, auctoritas: 18, rep: { army: 12 } }, flag: 'cavalryAlesia' },
        { t: 'Wait. The wall holds, and hunger is doing the fighting.', say: 'The wall holds and the relieving army goes home in the dark. The men inside the wall are now the only ones still here, and they will be your parade tomorrow.', eff: { xp: 74, auctoritas: 20, attrs: { cunning: 1 }, rep: { army: 6 } }, flag: 'siegeAlesia' }
      ]
    }),

    /* ================= ACT III — the die is cast ================= */
    c9: sc('The Rubicon', 'Act III · 49 BC', [
      ['narrator', 'The Senate has ordered you home without your army, and they have given the order to the man whose wife is your daughter, and you know exactly what it is: a death sentence written politely, by the two hundred men you have spent eight years fighting.'],
      ['antony', 'They stripped my office to get at you. The tribunes’ veto is a piece of cloth they have decided is worth ignoring, and when the house decides a veto is cloth, the house is telling you what it is prepared to do to you.'],
      ['narrator', 'The river is not wide. It is a small brown stream with a bridge and a boundary stone, and on one side of it you are a proconsul with a province, and on the other side you are a man who has brought his army into Italy.'],
      ['narrator', 'You spend a day on it. You eat with the officers. You speak to the men at dusk and they are all with you and you cannot hear the river for the noise of them.']
    ], {
      q: 'The Rubicon. There is no way back across it and everybody knows it.',
      opts: [
        { t: 'Cross. “The die is cast.”', say: 'You cross at night with the Thirteenth, and the die is cast, and by the sixth hour a rider is already ten miles down the road with the news.', eff: { xp: 100, auctoritas: 30, rep: { senate: -30, army: 26, people: 10 }, attrs: { martial: 1 } }, disp: { antony: .4, cato: -.5 }, flag: 'crossedRubicon' },
        { t: 'Cross, but offer terms at once. Give the Senate a way out.', say: 'The offer goes to Rome before the army does. If they refuse it, the offer is not a policy, it is a document you will quote at a funeral.', eff: { xp: 92, auctoritas: 24, rep: { senate: -16, army: 18, people: 14 }, attrs: { cunning: 1 } }, disp: { cicero: .2, antony: .2 }, flag: 'crossedWithTerms' },
        { t: 'Do not cross. Go to Rome alone, as a citizen, and argue it there.', say: 'Every man in the Thirteenth offers to come with you, and you refuse all of them, and it is the bravest thing you have ever done and it is not going to work.', eff: { xp: 84, auctoritas: 12, rep: { senate: 12, army: -14 }, attrs: { rhetoric: 1 } }, disp: { cato: .3, antony: -.3 }, flag: 'wentAlone' }
      ]
    }),
    c10: sc('Spain, without a battle', 'Act III · 49 BC', [
      ['narrator', 'Pompey is in the east with seven legions. Spain has the best of the rest. You leave Rome to a clerk and go west at a speed that breaks two of your own supply carts, because an army that arrives early is worth one that arrives strong.'],
      ['narrator', 'You win Ilerda by building, not fighting: you take a hill, you cut their water, you let them lose the argument with their own supply. Six of Pompey’s legions go home. They start saying your name in the market before the Senate has decided what to call what you did.'],
      ['narrator', 'On the road back you write a book on a temple, on the run, in a cart, and the clerks take it down as fast as you can say it. Grammar, addressed to a man named Brutus, because you have noticed that the man has no sense of humour about anything.']
    ]),
    c11: sc('Pharsalus', 'Act III · 48 BC', [
      ['narrator', 'Nineteen miles apart on a plain in Thessaly, with eighty thousand men between them, most of whom have served in the same legions under the same eagles. Some of them are brothers. Some of them have the same mother.'],
      ['pompey', 'I have eleven thousand horse and you have none worth the name, and I have the Senate sitting behind me in the camp, and they are all telling me what to do in the tone men use with a servant.'],
      ['narrator', 'His horse will come round your right. You take six cohorts and tell them one thing: do not throw the pilum. Take the shaft and put it in the face of the first horse. They will not expect that, and an idea nobody has had in this army is worth a thousand men.'],
      ['narrator', 'At dawn the cavalry comes, and at the eighth hour it is running, and by afternoon there are fifteen thousand of their men dead in the wheat, and the wheat is somebody’s farm, and there is nothing to say about that.']
    ], {
      q: 'Pompey is in his tent. His camp is already in your hands.',
      opts: [
        { t: 'Go after him. The war ends when he dies.', say: 'You follow a man across the sea to a country that has already decided to have a civil war of its own.', eff: { xp: 110, auctoritas: 26, rep: { army: 14 } }, flag: 'chasedPompey' },
        { t: 'Stop. Offer clemency to every man in his camp.', say: 'You write to Rome that not one citizen was killed after the field was taken. Some of the Senate come in to dinner with you that night and find it hard to eat.', eff: { xp: 104, auctoritas: 30, rep: { people: 12, senate: 8, army: -4 }, attrs: { fides: 1 } }, disp: { cicero: .3, cato: -.2 }, flag: 'clemency' },
        { t: 'Take the eagles and the camp, and let the Senate come to you.', say: 'Nine eagles, and the Senate of Rome standing in a field outside a town called Pharsalus, waiting for a chair.', eff: { xp: 100, auctoritas: 34, rep: { senate: 10, army: 10 } }, flag: 'tookEagles' }
      ]
    }),
    c12: sc('Alexandria, on fire', 'Act III · 48 BC', [
      ['cleopatra', 'My brother’s advisers had my father’s will and the whole army and they had me written out of the country on a ship going nowhere. I am here because it is the only thing left to do.'],
      ['cleopatra', 'You are landed with four thousand men in a city that has had a plan for you since your arrival, and the plan is not one you will survive. So we will both be the thing the other one needs, and then, in a year or two, we will find out what this was.'],
      ['narrator', 'The library catches fire, or the docks do and the wind does the rest. Somewhere in the smoke, hundreds of scrolls that exist nowhere else are becoming the thing that everyone will be very sincere about in a hundred years.'],
      ['narrator', 'You stay in Alexandria for months with too few men, and you win, and by the time you leave you have made a queen, been fought through a harbour, and spent a winter at the worst possible moment in a war.']
    ], {
      q: 'Cleopatra wants the crown. Her brother wants you dead.',
      opts: [
        { t: 'Put her on the throne alone. Make her a client queen.', say: 'She is crowned in an Egyptian ceremony that you attend in Roman dress, because the Romans have never been able to decide how much of a country they are visiting.', eff: { auctoritas: 20, xp: 84, denarii: 2200, rep: { senate: -8, people: 6 } }, disp: { cleopatra: .5 }, flag: 'cleopatraQueen' },
        { t: 'Rule through her, not over her. A joint throne is cheaper to govern.', say: 'She has the administration and the family and the name. You have the four thousand men. Neither of you mentions how long it lasts.', eff: { auctoritas: 16, xp: 78, attrs: { cunning: 1 }, rep: { senate: -4 } }, disp: { cleopatra: .35, brutus: -.1 }, flag: 'jointThrone' },
        { t: 'Take the treasury, quiet the city, and go. You are needed in Rome.', say: 'The money is real and the queen remembers that you took it and left. She is patient, and she is now alone with a great deal of your debt.', eff: { denarii: 3800, auctoritas: 10, xp: 70, rep: { army: 4 } }, disp: { cleopatra: -.3, crassus: .15 }, flag: 'tookTreasury' }
      ]
    }),

    /* ================= ACT IV — the man who would not be king ================= */
    c13: sc('Thapsus, and the last man standing', 'Act IV · 46 BC', [
      ['cato', 'I have read your letters. I believe that you intended them. That is the problem: you are not lying, and you are still doing all of it.'],
      ['narrator', 'Cato is in Africa with the men who could not accept Pharsalus, and they lose at Thapsus more quickly than anyone expects, and he is not killed: he sits down with a book and an evening and decides.'],
      ['narrator', 'He reads the Phaedo twice. Then he does it, and reads it again outside himself, and you arrive too late to say anything to him at all.'],
      ['narrator', 'You will write an anti-Cato, two books, in which you argue that he was wrong. You will spend the effort because he has done the one thing you cannot answer: he has made dying mean something.']
    ], {
      q: 'Cato is dead and his side is finished. What do the men who followed him get?',
      opts: [
        { t: 'Amnesty. Every man who did not raise a sword after the battle keeps his property.', say: 'The amnesty is printed and posted. Half of Rome reads it as mercy and half as a list of men who are still here.', eff: { auctoritas: 24, xp: 92, rep: { senate: 10, people: 8 } }, disp: { cicero: .2 }, flag: 'amnesty' },
        { t: 'Their property is confiscated and sold. The war has to be paid for.', say: 'The lists go up on the walls and the auction takes four days. The money is excellent and everybody in Rome now knows what a list on a wall looks like.', eff: { denarii: 4200, auctoritas: 14, xp: 86, rep: { senate: -12, people: -6 } }, disp: { brutus: -.25 }, flag: 'proscribed' },
        { t: 'Punish the leaders only, and publicly, as a warning.', say: 'Six men and two names of families. The rest keep their houses and remember all fourteen seconds of the hearing.', eff: { auctoritas: 18, xp: 88, rep: { senate: -4, army: 6 } }, disp: { cato: 0 }, flag: 'punishedLeaders' }
      ]
    }),
    c14: sc('Four triumphs', 'Act IV · 46 BC', [
      ['narrator', 'Four processions in a month: Gaul, Egypt, Pontus, Africa. You have invented the giraffe for the Roman crowd, and the crowd is uncertain whether to applaud or run.'],
      ['narrator', 'Vercingetorix is in the third triumph, in chains, and is executed at the end of the day in a way that is not described in the account, because some things are simply done at the Tullianum and written down as a word.'],
      ['pompey', 'You made his name the thing you trod on and the thing you buried. Do not expect the crowd to have forgotten whose face is on that head yet, they always remember the man on the shaft of the axle, especially when he is not the one they can see.'],
      ['narrator', 'You do not have a son of your own left to carry the procession, so you have the crowd shout the name of the city instead, and you are the only one who hears how thin it sounds.']
    ]),
    c15: sc('The Lupercal, and the diadem', 'Act IV · 44 BC', [
      ['antony', 'The whole city is at the foot of the hill and the whole city is in a mood to be convinced of something. I have the crown in my hand and the crowd has been shouting for three days.'],
      ['narrator', 'He offers it to you three times. Three times you refuse him, and the crowd — the entire, enormous, hot, anxious crowd — cheers each refusal, once, twice, three times, and it is impossible to tell now whether they are cheering your refusal or being applauded for wanting you to accept.'],
      ['narrator', 'Somebody has written on the base of your statue that morning: “Brutus, you are asleep.” The next line says that Rome is not free, and it has been written by a man who knows the name of every senator and has a good hand.'],
      ['antony', 'Whatever you say next will be written down word for word, by us and by them. I am ready to be the man who says the thing you cannot.']
    ], {
      q: 'The crown is in his hand for the third time.',
      opts: [
        { t: 'Refuse it again, and have it placed in the temple of Jupiter.', say: '“Not a king. Only Caesar.” The clerks write it down. Everybody in that crowd decides for themselves what it means, and half of them get it wrong.', eff: { xp: 96, auctoritas: 26, rep: { people: 14, senate: 8 } }, disp: { antony: .1 }, flag: 'refusedCrown' },
        { t: 'Take it. Rome has not governed itself in forty years.', say: 'You take it in front of the city, and for one full second the sky is the loudest thing you have ever heard.', eff: { xp: 100, auctoritas: 40, rep: { senate: -40, people: 4, army: 20 } }, disp: { brutus: -.6, cato: -.5, antony: .4 }, flag: 'tookCrown' },
        { t: 'Say nothing. Let the silence be the answer and go home.', say: 'You walk down from the rostra without a word. The crowd waits; the crown stays where it was; every man on the hill goes away and thinks about what it meant, which is exactly what you meant him to do.', eff: { xp: 92, auctoritas: 22, attrs: { cunning: 1 } }, disp: { antony: -.1 }, flag: 'silentCrown' }
      ]
    }),
    c16: sc('The Ides of March', 'Act IV · 44 BC', [
      ['narrator', 'The Senate sits in the hall of Pompey because it has been repaired after the riots, which is a detail nobody had to arrange and nobody can stop thinking about.'],
      ['narrator', 'The augurs have given bad omens, which is as common as a headache and means anything you want it to. Your wife has dreamt about you and asked you not to go. A rider came up the road all night with something that people will mention for two thousand years, and he arrives nine minutes too late.'],
      ['brutus', 'You have had six years in which to give it back, and every one of them you have spent making it easier to keep. That is not the Rome I was taught to serve, and I will not serve you in it.'],
      ['narrator', 'There are sixty men in the hall with knives under their togas, and they are not a conspiracy in the way stories like; they are fifty good husbands with appointments that evening and one bad arithmetic about the Republic.'],
      ['narrator', 'It happens very fast and in a crowd. You say the famous thing at the second blow, or you do not — there are three versions and the one everybody quotes is not the one anybody heard.'],
      ['narrator', 'Rome does not fall. It gets a moment in which everything might be decided, and then it decides to carry on with the auction.']
    ], {
      q: 'The last decision of the career: how does it end?',
      opts: [
        { t: 'You walk in. Let it happen as it happens.', say: 'The whole thing is decided in about four minutes by men who were all thinking about something else at breakfast. What follows is another war, a boy of nineteen and a month of Egyptian mud.', eff: { xp: 120 }, end: 'ides' },
        { t: 'Turn back at the door. There is still a thing you can do that is not this.', say: 'You have one moment on the threshold where Rome is still whatever you are about to say. Nobody in that hall knows it yet but you.', eff: { xp: 120 }, end: 'republic' },
        { t: 'Go in and give them the crown. Make them do it with their faces showing.', say: 'You take the whole thing off and put it on a chair in the middle of the floor, and tell the Senate they may have it. And the room is so quiet that the scribe writes it down badly, because his hand is shaking.', eff: { xp: 130 }, end: 'crown' }
      ]
    })
  };

  const CH = [
    { id: 'c1', act: 1, n: 1, giver: 'aurelia', ic: '👶', title: 'The Subura, 100 BC', where: 'subura', needs: [],
      d: 'A house with a bad roof and a name older than the Republic. Your mother is exact, your uncle is a legend, and the alley is already deciding what you are.',
      steps: [
        { at: 'subura', act: 'Walk the alley you were born in', text: 'Walk the Subura and look at the house you will spend a lifetime being measured against' },
        { at: 'domus', act: 'Serve your mother', text: 'Serve your mother out the dowry she is watching' },
        { at: 'castra', act: 'Stand in Marius’s shadow', text: 'Go to the camp and listen to Marius talk about glory' }
      ], reward: { xp: 30, auctoritas: 8, attrs: { martial: 1 } }, scene: 'c1' },
    { id: 'c2', act: 1, n: 2, giver: 'cornelia', ic: '⛵', title: 'Pharmacusa, 75 BC', where: 'portus', needs: ['c1'],
      d: 'You are twenty-five, on a ship, in the wrong water, and the men boarding it are very good at their job. Thirty-eight days with pirates. Then the bill.',
      steps: [
        { at: 'portus', act: 'Argue with the pirates', text: 'Argue with the pirates about your own ransom, at length, until they laugh' },
        { at: 'macellum', act: 'Raise the twenty talents', text: 'Raise the twenty talents in the market and the banks' },
        { at: 'portus', act: 'Come back with a fleet', text: 'Come back with a fleet and settle the account' }
      ], reward: { xp: 40, auctoritas: 12, denarii: 300 }, scene: 'c2' },
    { id: 'c3', act: 1, n: 3, giver: 'crassus', ic: '🔱', title: 'The Pontifex Maximus, 63 BC', where: 'temple', needs: ['c2'],
      d: 'The highest religious office in Rome is bought with money you do not have, from a man who does not do favours. Then the Bona Dea scandal puts Clodius inside your house.',
      steps: [
        { at: 'temple', act: 'Take the long walk to the election', text: 'Go up the Via Sacra to the election you cannot afford' },
        { at: 'domus', act: 'Deal with Clodius', text: 'Deal with the man who was found inside the rites' },
        { at: 'curia', act: 'Survive the hearing', text: 'Survive the hearing in the house without being ruined' }
      ], reward: { xp: 50, auctoritas: 18, rep: { senate: 4 } }, scene: 'c3' },
    { id: 'c4', act: 1, n: 4, giver: 'pompey', ic: '🤝', title: 'Three Heads, 60 BC', where: 'forum', needs: ['c3'],
      d: 'The soldier cannot get a bill passed and the banker cannot buy one. You have neither legions nor money and you have the one thing they are missing.',
      steps: [
        { at: 'forum', act: 'Meet Pompey in the open', text: 'Meet Pompey where everybody can see the meeting' },
        { at: 'domus', act: 'Broker with Crassus', text: 'Broker the terms with Crassus in his own house' },
        { at: 'curia', act: 'Hold the arrangement together', text: 'Hold the arrangement together in front of the house' }
      ], reward: { xp: 60, auctoritas: 24, rep: { army: 6 } }, scene: 'c4' },

    { id: 'c5', act: 2, n: 5, giver: 'pullo', ic: '🌉', title: 'The Helvetii, 58 BC', where: 'castra', needs: ['c4'],
      d: 'Four hundred thousand people are walking out of their country into yours, with carts. You have one legion and a bridge, and eight years of pay you have not stopped earning.',
      steps: [
        { at: 'castra', act: 'Cut the bridge at Genava', text: 'Cut the bridge at Genava and make the migration change course' },
        { at: 'forum', act: 'Justify the war in Rome', text: 'Justify the war to a Senate that has not yet decided it wants one' },
        { at: 'castra', act: 'Fight at Bibracte', text: 'March eighteen days behind them and turn at Bibracte', battle: 'gallia' }
      ], reward: { xp: 70, auctoritas: 20, denarii: 900 }, scene: 'c5' },
    { id: 'c6', act: 2, n: 6, giver: 'pullo', ic: '🌲', title: 'The River Sabis, 57 BC', where: 'castra', needs: ['c5'],
      d: 'The Nervii have no cavalry, no envoys and no hedges left to hide behind, and they come out of the wood at a run while your men are still building the camp.',
      steps: [
        { at: 'castra', act: 'Get the line formed', text: 'Get two legions into a line in the time it takes to drop a tent' },
        { at: 'castra', act: 'Stand in the front rank', text: 'Take a shield off a man and stand in the front rank' },
        { at: 'forum', act: 'Count the dead for the Senate', text: 'Write the report and read it to the house aloud' }
      ], reward: { xp: 80, auctoritas: 22, rep: { army: 12 } }, scene: 'c6' },
    { id: 'c7', act: 2, n: 7, giver: 'berenice', ic: '🌫️', title: 'The Sea and the Rhine, 55 BC', where: 'portus', needs: ['c6'],
      d: 'Two legions across the sea to a country the Romans have decided is a myth, then a bridge over the Rhine in ten days. Neither is a strategy. Both are a paragraph in a book.',
      steps: [
        { at: 'portus', act: 'Requisition the transports', text: 'Requisition every transport on the coast and lie about the purpose' },
        { at: 'castra', act: 'Build the bridge over the Rhine', text: 'Build the bridge over the Rhine in ten days' },
        { at: 'curia', act: 'Write the account', text: 'Write the account of it that Rome will be reading in a hundred years' }
      ], reward: { xp: 90, auctoritas: 24, rep: { senate: 6 } }, scene: 'c7' },
    { id: 'c8', act: 2, n: 8, giver: 'vercingetorix', ic: '🏰', title: 'Alesia, 52 BC', where: 'castra', needs: ['c7'],
      d: 'A wall, a hill, eighty thousand men inside it and every tribe in Gaul behind you. You have five weeks and a great deal of turf to cut.',
      steps: [
        { at: 'castra', act: 'Draw the two walls', text: 'Draw eighteen miles of wall around a hill in the wet' },
        { at: 'castra', act: 'Break the relieving army', text: 'Break the relieving army at the weak point', battle: 'narbonensis' },
        { at: 'domus', act: 'Deal with Vercingetorix', text: 'Decide what becomes of the man on the wall' }
      ], reward: { xp: 110, auctoritas: 30, denarii: 1800 }, scene: 'c8' },

    { id: 'c9', act: 3, n: 9, giver: 'antony', ic: '🌊', title: 'The Rubicon, 49 BC', where: 'castra', needs: ['c8'],
      d: 'The Senate has ordered you home without the army. There is a small brown river between you and Italy, and a boundary stone, and no way back across either.',
      steps: [
        { at: 'castra', act: 'Speak to the Thirteenth', text: 'Speak to the men at dusk and find out what they are actually willing to do' },
        { at: 'castra', act: 'Cross the river', text: 'Cross the river at night' },
        { at: 'rostra', act: 'Tell Rome why', text: 'Tell Rome why, before somebody else does' }
      ], reward: { xp: 120, auctoritas: 30, rep: { army: 16 } }, scene: 'c9' },
    { id: 'c10', act: 3, n: 10, giver: 'antony', ic: '⛰️', title: 'Spain, 49 BC', where: 'castra', needs: ['c9'],
      d: 'Pompey is in the east. Spain has the best of the rest. You go west faster than your own supply train and win a campaign by taking a hill.',
      steps: [
        { at: 'castra', act: 'March faster than the carts', text: 'March faster than your own carts and arrive before they expect you' },
        { at: 'castra', act: 'Take the hill above Ilerda', text: 'Take the hill and cut their water' },
        { at: 'domus', act: 'Let six legions go home', text: 'Let six of the enemy legions go home with their arms' }
      ], reward: { xp: 120, auctoritas: 26, rep: { army: 12 } }, scene: 'c10' },
    { id: 'c11', act: 3, n: 11, giver: 'pompey', ic: '⚔️', title: 'Pharsalus, 48 BC', where: 'castra', needs: ['c10'],
      d: 'Eighty thousand men on a plain in Thessaly, most of them Romans, and eleven thousand horse coming round your right at dawn.',
      steps: [
        { at: 'castra', act: 'Post the fourth line', text: 'Post the fourth line where nobody expects a fourth line' },
        { at: 'castra', act: 'Take the field', text: 'Take the field at Pharsalus', battle: 'pharsalus' },
        { at: 'castra', act: 'Decide about Pompey', text: 'Decide what happens to Pompey and his camp' }
      ], reward: { xp: 130, auctoritas: 34, denarii: 2200 }, scene: 'c11' },
    { id: 'c12', act: 3, n: 12, giver: 'cleopatra', ic: '🐍', title: 'The Nile, 48 BC', where: 'portus', needs: ['c11'],
      d: 'Four thousand men, a burning harbour, a disputed throne and a twenty-one-year-old queen who has had herself carried in through the door in a rug.',
      steps: [
        { at: 'portus', act: 'Meet the queen', text: 'Meet the queen in the palace at Alexandria' },
        { at: 'castra', act: 'Hold the harbour', text: 'Hold the harbour with four thousand men' },
        { at: 'portus', act: 'Settle the throne', text: 'Settle the throne of Egypt and be paid for it' }
      ], reward: { xp: 130, auctoritas: 26, denarii: 2400 }, scene: 'c12' },

    { id: 'c13', act: 4, n: 13, giver: 'cato', ic: '📖', title: 'Thapsus, 46 BC', where: 'curia', needs: ['c12'],
      d: 'The last of the republicans are in Africa and they lose in an afternoon. Cato does not lose. Cato sits down with a book.',
      steps: [
        { at: 'curia', act: 'Read the letters', text: 'Read what Cato wrote to you, twice, and understand what he is telling you' },
        { at: 'castra', act: 'Win the last field', text: 'Win the last field and take the camp', battle: 'africa' },
        { at: 'curia', act: 'Decide what the losers get', text: 'Decide what happens to every man who fought for Cato' }
      ], reward: { xp: 140, auctoritas: 30 }, scene: 'c13' },
    { id: 'c14', act: 4, n: 14, giver: 'antony', ic: '🎪', title: 'Four Triumphs, 46 BC', where: 'circus', needs: ['c13'],
      d: 'Gaul, Egypt, Pontus, Africa. A giraffe. A queen’s sister in chains. And a man on a cart who has to decide what the crowd is supposed to shout.',
      steps: [
        { at: 'circus', act: 'Stage the processions', text: 'Stage four processions in one month without emptying the city' },
        { at: 'rostra', act: 'Hear what the crowd shouts', text: 'Stand on the rostra and hear what the crowd actually shouts' },
        { at: 'domus', act: 'Sit down with the calendar', text: 'Sit down with the calendar and fix the year itself' }
      ], reward: { xp: 140, auctoritas: 34, rep: { people: 14 } }, scene: 'c14' },
    { id: 'c15', act: 4, n: 15, giver: 'antony', ic: '👑', title: 'The Lupercal, 44 BC', where: 'rostra', needs: ['c14'],
      d: 'The crown in Antony’s hand, three times, and a crowd that has been shouting for a week. Whatever you do is written down by both sides before the sun is down.',
      steps: [
        { at: 'rostra', act: 'Take the crown — or refuse it', text: 'Take the crown, or refuse it, with the whole city watching' },
        { at: 'vesta', act: 'Take the omens seriously', text: 'Take the omens seriously for once' },
        { at: 'curia', act: 'Draft the last decree', text: 'Draft the decree that decides what Rome is' }
      ], reward: { xp: 150, auctoritas: 40 }, scene: 'c15' },
    { id: 'c16', act: 4, n: 16, giver: 'brutus', ic: '🗡️', title: 'The Ides, 44 BC', where: 'curia', needs: ['c15'],
      d: 'The hall of Pompey, the fifteenth of March, sixty men with knives under their togas and a rider nine minutes behind on the road.',
      steps: [
        { at: 'domus', act: 'Hear your wife’s dream', text: 'Hear your wife out about the dream, and decide' },
        { at: 'curia', act: 'Walk into the hall', text: 'Walk into the hall of Pompey' },
        { at: 'curia', act: 'The last word', text: 'The last word' }
      ], reward: { xp: 200, auctoritas: 40 }, scene: 'c16' }
  ];

  const endings = {
    ides: { title: 'The Ides of March', ic: '🗡️', lines: [
      ['narrator', 'The hall empties in about ninety seconds. Two men stay with the body, because somebody has to, and they are not the ones anybody will remember.'],
      ['narrator', 'Rome does not fall. It gets a moment in which everything might be decided, and it decides — quietly, by auction, by the soldiers who were paid on Tuesday — to carry on.'],
      ['brutus', 'He was not a tyrant this morning. That is the part nobody wants to hear. He was a man who had been right about everything for six years and had stopped noticing that being right is not a form of consent.'],
      ['narrator', 'They put a wax image of you in the Forum with twenty-three wounds in it and the crowd burns the Senate house by accident. Within the year there are three armies in Italy and none of them are the Republic’s.'],
      ['narrator', 'Your name becomes an office. Every emperor for the next four hundred years will carry it, and none of them will be you.']
    ] },
    republic: { title: 'The Man Who Gave It Back', ic: '🏛️', lines: [
      ['narrator', 'You turn at the door. The sixty men in the hall spend the rest of their lives explaining that they were there for reasons that had nothing to do with the knives.'],
      ['narrator', 'You lay the dictatorship down in the temple of Jupiter and walk home through a city that has no idea what to do with a man who keeps his word in public.'],
      ['cato', 'The dead do not forgive, and I am not asking you to be forgiven. I am telling you that you have done the only thing in forty years that the Republic can survive.'],
      ['narrator', 'The Senate votes you nothing for it. The crowd is confused for a season and then decides you were weak, and the men who will come after you learn the wrong lesson entirely, which is that the crown is there for the taking.'],
      ['narrator', 'You live another twenty years, mostly on the coast. You are right about almost everything and nobody asks you again, and in the end the Republic does what you were afraid it would do anyway, only slower.']
    ] },
    crown: { title: 'Caesar', ic: '⚜️', lines: [
      ['narrator', 'You sit down on the chair in the middle of the floor with the crown on the seat beside you and say: here. Take it. Let the record show that Rome was given the choice with the doors open.'],
      ['narrator', 'Nobody moves for a long time. Then a man in the third row starts laughing, because he has understood that he is in a room where the argument is finally over and it was over before he got here.'],
      ['narrator', 'You are king of Rome, or the thing that comes after consuls, and it will not be called a kingdom because Rome cannot bear the word. The clerks invent a phrase for it before the evening meal.'],
      ['narrator', 'The Republic ends not with a battle but with an administrative decision, taken in a well-lit room, by men who were all very tired. It takes about forty minutes and then everybody goes to dinner.']
    ] }
  };

  const CRIER = [
    ['The proconsul is raising legions in Gaul again, and the Senate has asked to see the accounts for the fourth time.',
      'A grain ship from Egypt has come in with a cargo of glass and a letter nobody will read aloud.',
      'Two tribunes have vetoed the whole month. The clerks are paid by the page and are said to be delighted.',
      'The pirates have taken another young aristocrat. His family says he is worth twenty talents. The pirates say eight.'],
    ['Gaul has sent another dispatch. The number of the enemy in it has gone up since the last one.',
      'Bread is dear and the aediles are promising the moon in writing, as usual.',
      'A bridge has been built over the Rhine. Nobody in Rome has ever needed a bridge over the Rhine.',
      'The Tenth has been paid late again, and the Tenth has noticed.'],
    ['Troops have crossed a river in the north and the Senate is sitting at night.',
      'Pompey has left the city, which everybody agrees is a very bad sign and nobody will say out loud.',
      'The market has doubled the price of rope, oil and horses, and has not doubled anything else, which is the market telling you what it thinks is coming.',
      'A tribune fled the city in a slave’s cloak. He is said to be safe. Nobody believes it.'],
    ['The dictator has reformed the calendar and the year is now three months too long, which everyone is pretending to find funny.',
      'Four triumphs in one month. The circus has run out of animals and is buying them from the provinces.',
      'A crown was offered at the Lupercal and refused three times, and the crowd cheered each refusal, and nobody can say any more than that.',
      'Somebody has been writing names on the base of a statue. The names are accurate.']
  ];
  const crier = state => {
    const a = actOf(state);
    const pool = CRIER[Math.min(3, Math.max(0, a - 1))];
    return pool[Math.floor(Math.random() * pool.length)];
  };

  const letters = [
    { at: 2, who: 'aurelia', lines: [
      ['aurelia', 'They tell me you were taken by pirates and that you told them a joke. Your father would have paid and said nothing. You will be a different kind of trouble, I can see it already.'],
      ['aurelia', 'The house is quiet, the roof is still bad, and your daughter asks where you are every evening at the hour you used to come in. Answer her in your own hand, not your secretary’s.'],
      ['aurelia', 'Whatever you are about to do with the money you have borrowed: do it once, do it properly, and do not come home and explain it to me for two hours.']
    ] },
    { at: 3, who: 'cornelia', lines: [
      ['cornelia', 'There are three legions in Gaul that answer to your name and one Senate in Rome that answers to nothing, and I have been married to you long enough to know which of those you consider the more reliable.'],
      ['cornelia', 'I am not writing to tell you to come home. I am writing to tell you that the letters you send are being read aloud in houses you would not be invited into, and that one of them is being copied.'],
      ['cornelia', 'Be careful with the men you promote this year. They will be the ones holding the bridge when it matters.']
    ] },
    { at: 4, who: 'antony', lines: [
      ['antony', 'They have given you the dictatorship for ten years and the crowds have given you a month of holidays, and every man in the city is now either yours or quietly waiting to see which of the sixty is going to do it.'],
      ['antony', 'I have the crown and I have the crowd and I have a very good idea about the Lupercal. Say the word and I will make it look like an accident of enthusiasm.'],
      ['antony', 'The men who are going to be a problem are not the ones you are watching. They are the ones who keep saying they are your friends and have started to look tired.']
    ] }
  ];
  const letterAt = act => letters.find(l => l.at === act) || null;

  const done = (state, id) => (state.quests.done || []).includes(id);
  const active = (state, id) => (state.quests.active || []).includes(id);
  const chapter = id => CH.find(c => c.id === id) || null;
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
  const flags = state => (state.story && state.story.flags) || {};

  return { SCENES, CH, endings, chapter, next, offerable, done, active, actOf, flags, crier, letterAt, scene: id => SCENES[id] || null };
})();

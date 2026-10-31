// Spiritual section, second half: the devotional pages. Registers extra sub-tabs with faith.js, which draws them.
// Everything here is offline: the scripture comes from the Bible files already on disk, the rest is public-domain
// devotional text and original wording. State is kept in the Moundshroud window's own storage (faithx_*).
(() => {
  const root = document.getElementById('p-faith'); if (!root) return;
  const rd = (k, d) => { try { const v = ls.get('faithx_' + k, ''); return v ? JSON.parse(v) : d; } catch (e) { return d; } };
  const wr = (k, v) => { try { ls.set('faithx_' + k, JSON.stringify(v)); } catch (e) { } };
  const ymd = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const md = d => String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const ask = t => { A.showTab('chat'); A.chat.ask(t, { noLocal: true, sources: [] }); };
  const roman = n => ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII', 'XIV'][n];
  let tick = null;
  const clearTick = () => { if (tick) { clearInterval(tick); tick = null; } };

  /* ---------- scripture helpers (reuse the Bible the Spiritual tab already loads) ---------- */
  async function refText(ref) {
    try {
      await A.faith.getBible(); const b = A.faith.bible(); const p = A.faith.parseRef(ref);
      if (!p || !b || !b.books[p.b]) return '';
      const ch = b.books[p.b].ch[p.c]; if (!ch || !ch.v) return '';
      return ch.v.slice(p.v ? p.v - 1 : 0, p.v2 || undefined).join(' ').replace(/\s+/g, ' ').trim();
    } catch (e) { return ''; }
  }
  async function psalmText(n) {
    try {
      await A.faith.getBible(); const b = A.faith.bible(); if (!b || !b.books[20]) return null;
      const tr = (A.faith.tr && A.faith.tr()) || 'web';
      const num = A.faith.psConv ? A.faith.psConv(n, 'web', tr) : n;
      const ch = b.books[20].ch[num - 1]; if (!ch || !ch.v) return null;
      return { num, label: 'Psalm ' + num, v: ch.v };
    } catch (e) { return null; }
  }

  /* ---------- Stations of the Cross (14, traditional order; meditations written for Moundshroud) ---------- */
  const VERSICLE = 'We adore thee, O Christ, and we bless thee. <i>Because by thy holy cross thou hast redeemed the world.</i>';
  const STATIONS = [
    ['Jesus is condemned to death', 'Pilate washes his hands and the crowd chooses Barabbas. An innocent man is handed over to be killed by a legal process that wanted to look clean.', 'Matthew 27:24-26', 'Where in my own life do I let someone else carry the cost of my comfort, and call it nothing?'],
    ['Jesus takes up his cross', 'The cross is laid on his shoulders and he accepts it - not because it was good, but because it was the way to us.', 'John 19:16-17', 'Name the weight I am carrying today. Instead of asking to be spared it, ask for the strength to carry it well.'],
    ['Jesus falls the first time', 'The weight is too much and he goes down. He gets up. That is all, and that is everything.', 'Isaiah 53:4-5', 'Falling is not the failure. Staying down is. What am I avoiding getting up from?'],
    ['Jesus meets his mother', 'No words are recorded. There is only the meeting of two people who love each other and cannot spare each other this.', 'Luke 2:34-35', 'Who do I need to stand with in a grief I cannot fix? And whose face would strengthen me if I let them see mine?'],
    ['Simon of Cyrene helps Jesus', 'A man coming in from the country is seized and made to carry the cross. Unwilling help is still help.', 'Mark 15:21', 'Whose burden could I carry this week, even inconveniently, even if I am not thanked?'],
    ['Veronica wipes the face of Jesus', 'A woman steps out of the crowd with a cloth. It is a small, brave, useless-looking act, and it is remembered forever.', 'Isaiah 53:2-3', 'What small kindness is being asked of me that I keep postponing because it seems too little to matter?'],
    ['Jesus falls the second time', 'Not the first fall, but the second. He does it again in front of everyone who has already watched him fail once.', 'Psalm 42:6', 'Repetition is the hardest part: the same sin, the same weakness. Ask for the grace to begin again without despair.'],
    ['Jesus consoles the women of Jerusalem', 'Bleeding and condemned, he turns to comfort others: do not weep for me, weep for your children.', 'Luke 23:27-31', 'Suffering can turn a person inward. Where am I still able to look outward?'],
    ['Jesus falls the third time', 'The third fall, closest to the end. He will not reach the place of execution without being carried by grace.', '2 Corinthians 12:9', 'What have I given up on because I have failed at it too many times?'],
    ['Jesus is stripped of his garments', 'Even his clothes are taken. Nothing of his own remains to him.', 'John 19:23-24', 'What do I cling to for my identity? What would I still be if it were taken?'],
    ['Jesus is nailed to the cross', 'They are free to go now, but they do not go. They stretch him out and drive through his hands and feet.', 'Luke 23:33-34', 'He prays for them while they do it. Who do I need to forgive for what they are doing right now?'],
    ['Jesus dies on the cross', 'Three hours of darkness, then the words: it is finished. He dies with a prayer on his lips, and the ground shakes.', 'John 19:28-30', 'Sit with this for a moment and say nothing. Then write the one thing you would want to be finished with, and hand it over.'],
    ['Jesus is taken down from the cross', 'A body is taken down and put into the arms of his mother. The worst part of love is outliving it.', 'John 19:38-40', 'Who is grieving near me that I have no words for? Be present anyway.'],
    ['Jesus is laid in the tomb', 'A stone, a guard, and a silence. Nothing is happening. That is where the story rests, and it is not the end.', 'Mark 15:46-47', 'What feels dead or unfinished in my life right now? Ask for the patience to wait in it rather than run from it.']
  ];

  /* ---------- Divine Mercy chaplet + Seven Sorrows ---------- */
  const CHAPLET = [
    ['Sign of the Cross', 'In the name of the Father, and of the Son, and of the Holy Ghost. Amen.'],
    ['Opening', 'You expired, Jesus, but the source of life gushed forth for souls, and the ocean of mercy opened up for the whole world. O Fount of Life, unfathomable Divine Mercy, envelop the whole world and empty Yourself out upon us. O Blood and Water, which gushed forth from the Heart of Jesus as a fountain of mercy for us, I trust in You.'],
    ['Our Father', 'Our Father, who art in heaven, hallowed be thy name; thy kingdom come; thy will be done on earth as it is in heaven. Give us this day our daily bread; and forgive us our trespasses as we forgive those who trespass against us; and lead us not into temptation, but deliver us from evil. Amen.'],
    ['Hail Mary', 'Hail Mary, full of grace, the Lord is with thee; blessed art thou amongst women, and blessed is the fruit of thy womb, Jesus. Holy Mary, Mother of God, pray for us sinners, now and at the hour of our death. Amen.'],
    ['Apostles\' Creed', 'I believe in God, the Father almighty, Creator of heaven and earth; and in Jesus Christ, his only Son, our Lord, who was conceived by the Holy Ghost, born of the Virgin Mary, suffered under Pontius Pilate, was crucified, died, and was buried. He descended into hell; the third day he rose again from the dead; he ascended into heaven, and sitteth at the right hand of God the Father almighty; from thence he shall come to judge the living and the dead. I believe in the Holy Ghost, the holy Catholic Church, the communion of saints, the forgiveness of sins, the resurrection of the body, and life everlasting. Amen.'],
    ['On each large bead (Our Father)', 'Eternal Father, I offer You the Body and Blood, Soul and Divinity of Your dearly beloved Son, Our Lord Jesus Christ, in atonement for our sins and those of the whole world.'],
    ['On the ten small beads', 'For the sake of His sorrowful Passion, have mercy on us and on the whole world.'],
    ['Closing (three times)', 'Holy God, Holy Mighty One, Holy Immortal One, have mercy on us and on the whole world.'],
    ['Final prayer', 'Eternal God, in whom mercy is endless and the treasury of compassion inexhaustible, look kindly upon us and increase Your mercy in us, that in difficult moments we might not despair nor become despondent, but with great confidence submit ourselves to Your holy will, which is Love and Mercy itself. Amen.']
  ];
  const SORROWS = [
    ['The prophecy of Simeon', 'The sword that would pierce her own soul was promised before the joy of the Nativity had faded.', 'Luke 2:34-35'],
    ['The flight into Egypt', 'She held a sleeping child on a donkey road out of her own country, running from a king who wanted him dead.', 'Matthew 2:13-15'],
    ['The loss of Jesus for three days', 'Three days of not knowing. Any parent who has lost sight of a child in a crowd knows the first minute.', 'Luke 2:43-49'],
    ['The meeting on the way to Calvary', 'She met him carrying the instrument of his death, and could do nothing but be there.', 'Luke 23:27'],
    ['The crucifixion', 'She stood at the foot of the cross while he died: the fullest measure of a mother\'s sorrow.', 'John 19:25-27'],
    ['The taking down from the cross', 'She received his body, the same body she had once wrapped in swaddling clothes.', 'Mark 15:46'],
    ['The burial of Jesus', 'She watched a stone close over her son, and went home into a silence with no promise of tomorrow.', 'John 19:41-42']
  ];

  /* ---------- a small saints calendar (feast dates and one line each) ---------- */
  const SAINTS = {
    '01-01': ['Mary, Mother of God', 'Theotokos: the woman who said yes, and the mother of the Church.', 'mothers, faith'],
    '01-02': ['Basil the Great and Gregory Nazianzen', 'Two friends who defended the faith of Nicaea and then argued about a chair.', 'theologians, friendship'],
    '01-03': ['The Most Holy Name of Jesus', 'The name that is above every name, spoken simply, at any hour.', ''],
    '01-13': ['Hilary of Poitiers', 'Exiled for refusing to soften the creed, he wrote his way through it.', 'theologians'],
    '01-17': ['Anthony of Egypt', 'Sold everything, walked into the desert, and started monastic life by accident.', 'monks, solitude'],
    '01-20': ['Fabian and Sebastian', 'A pope and a soldier, both martyred under the same persecution.', 'martyrs'],
    '01-21': ['Agnes', 'A girl of twelve or thirteen who would not be frightened out of her faith.', 'young people, chastity'],
    '01-24': ['Francis de Sales', 'The gentlest controversialist in the Church: patience with everyone, beginning with yourself.', 'writers, journalists'],
    '01-25': ['The Conversion of St Paul', 'The one who hunted Christians became the one who wrote half the New Testament.', 'converts, hope'],
    '01-26': ['Timothy and Titus', 'Paul\'s apprentices: ordinary men given charge of young churches.', 'church workers'],
    '01-27': ['Angela Merici', 'Founded the Ursulines to teach girls when nobody else would.', 'girls\' education'],
    '01-28': ['Thomas Aquinas', 'Called the dumb ox by his classmates; wrote the summa they still cannot ignore.', 'students, theologians'],
    '01-31': ['John Bosco', 'Gathered the street children of Turin, fed them, taught them a trade, and never gave up on one.', 'young people, apprentices'],
    '02-01': ['Brigid of Kildare', 'Abbess, bishop-maker, and patron of the poor of Ireland.', 'Ireland, dairy work'],
    '02-02': ['The Presentation of the Lord', 'Forty days after Christmas, the Child is carried into the Temple and recognised by two old people.', ''],
    '02-03': ['Blaise', 'Bishop and martyr, asked for the blessing of throats for centuries.', 'sore throats, illness'],
    '02-05': ['Agatha', 'Martyred in Sicily; her name is in the Roman canon of the Mass.', 'nurses, breast cancer'],
    '02-06': ['Paul Miki and the martyrs of Japan', 'Twenty-six men crucified on a hill at Nagasaki, singing as they died.', 'Japan, missionaries'],
    '02-08': ['Josephine Bakhita', 'Kidnapped into slavery as a girl, freed, and forgiving to the end.', 'victims of trafficking, Sudan'],
    '02-10': ['Scholastica', 'Benedict\'s sister, who prayed for a storm so her brother would stay and talk all night.', 'nuns'],
    '02-11': ['Our Lady of Lourdes', 'A spring, a girl named Bernadette, and a place of prayer for the sick.', 'the sick'],
    '02-14': ['Cyril and Methodius', 'Brothers who invented an alphabet so people could pray in their own language.', 'Europe, translators'],
    '02-22': ['The Chair of St Peter', 'A feast in honour of the office: one visible place of teaching and unity.', ''],
    '02-23': ['Polycarp', 'A disciple of the apostles, killed in old age: "I have served him for eighty-six years."', 'old age'],
    '03-04': ['Casimir', 'A prince who preferred prayer and the poor to the throne he might have had.', 'Poland, Lithuania'],
    '03-07': ['Perpetua and Felicity', 'A young noblewoman and her slave died together in the arena, friends to the end.', 'martyrs, mothers'],
    '03-17': ['Patrick', 'Taken as a slave to Ireland, escaped, and went back to the people who had taken him.', 'Ireland, missionaries'],
    '03-19': ['Joseph, husband of the Blessed Virgin Mary', 'A man of few recorded words who did exactly what was asked of him.', 'workers, fathers, a happy death, the Church'],
    '03-25': ['The Annunciation of the Lord', 'Nine months before Christmas: an angel, a question, and the answer that changed everything.', 'unborn children'],
    '01-04': ['Elizabeth Ann Seton', 'A widow with five children who opened the first Catholic school in the United States.', 'widows, teachers'],
    '04-04': ['Isidore of Seville', 'His encyclopaedia was the internet of the seventh century.', 'the internet, students'],
    '04-11': ['Stanislaus of Kraków', 'A bishop killed at the altar for telling a king the truth.', 'Poland, difficult causes'],
    '07-06': ['Maria Goretti', 'An eleven-year-old who forgave the man who killed her, and died forgiving him.', 'young people, forgiveness, victims of violence'],
    '08-16': ['Stephen of Hungary', 'A king who built churches, fed the poor and made law for widows and orphans.', 'Hungary, kings, builders'],
    '10-26': ['Evaristus and the unnamed saints of the day', 'The general calendar keeps no fixed saint today, so the Church remembers all the holy men and women whose names never made it into a book.', ''],
    '04-23': ['George', 'A soldier\'s soldier, and a martyr most of all.', 'soldiers, England, scouters'],
    '04-25': ['Mark the Evangelist', 'Peter\'s interpreter, who wrote down the shortest and most breathless Gospel.', 'writers'],
    '04-29': ['Catherine of Siena', 'Twenty-three years old and telling popes what to do, out of love, in letters that still sting.', 'Europe, nurses, fire'],
    '05-01': ['Joseph the Worker', 'The feast of ordinary work done well and unnoticed.', 'workers, fathers, job seekers'],
    '05-03': ['Philip and James the apostles', 'Two of the Twelve: one brought a sceptic to Jesus by saying simply "come and see".', ''],
    '05-13': ['Our Lady of Fatima', 'Three shepherd children, six months of visits, and the Rosary asked for by name.', 'Portugal, peace'],
    '05-14': ['Matthias', 'Chosen to replace Judas by lot, after prayer: an ordinary man who was there the whole time.', ''],
    '05-26': ['Philip Neri', 'The cheerful saint of Rome, who thought a saint without joy was no advertisement.', 'joy, Rome'],
    '05-31': ['The Visitation of the Blessed Virgin Mary', 'Two pregnant women, one Magnificat, and help given without being asked.', 'expectant mothers'],
    '06-01': ['Justin Martyr', 'A philosopher who kept asking questions until they led him to the Gospel.', 'philosophers'],
    '06-03': ['Charles Lwanga and companions', 'Young African Christians, catechumens and court servants, martyred for refusing an old king.', 'African youth, converts'],
    '06-11': ['Barnabas', 'The "son of encouragement" who vouched for Paul when nobody else would.', 'peacemakers'],
    '06-13': ['Anthony of Padua', 'A great preacher who is best loved for finding what is lost.', 'lost things, the poor'],
    '06-22': ['Thomas More and John Fisher', 'A chancellor and a bishop who kept their integrity when it cost them their heads.', 'lawyers, politicians'],
    '06-24': ['The Nativity of John the Baptist', 'Six months before Christmas: the forerunner born, and his father finally able to speak.', ''],
    '06-29': ['Peter and Paul', 'The fisherman and the scholar: two very different men, one Church.', 'Rome, the papacy'],
    '07-03': ['Thomas the Apostle', 'Doubting Thomas saw the wounds and said, "My Lord and my God."', 'architects, doubters'],
    '07-11': ['Benedict of Nursia', 'Wrote a rule so balanced that fifteen centuries of monasteries still keep it: ora et labora.', 'Europe, monks, students'],
    '07-14': ['Kateri Tekakwitha', 'A Mohawk girl who walked a hard path to faith and died at twenty-four.', 'ecology, Native peoples'],
    '07-15': ['Bonaventure', 'Francis\'s great biographer and a doctor of the Church.', 'theologians'],
    '07-16': ['Our Lady of Mount Carmel', 'The scapular and a long tradition of trust in the Mother of God.', ''],
    '07-22': ['Mary Magdalene', 'The "apostle to the apostles": first to the tomb, first to believe, first to tell.', 'penitents, perfumers'],
    '07-25': ['James the Apostle', 'One of the sons of thunder, the first of the Twelve to be martyred.', 'pilgrims, Spain'],
    '07-26': ['Joachim and Anne', 'The parents of Mary, whose names come down to us through tradition alone.', 'grandparents, married couples'],
    '07-29': ['Martha, Mary and Lazarus', 'The house at Bethany where Jesus was simply a friend.', 'cooks, hospitality, siblings'],
    '07-31': ['Ignatius of Loyola', 'A soldier whose leg was shattered by a cannonball, and who read his way into another kind of war.', 'retreats, soldiers, educators'],
    '08-01': ['Alphonsus Liguori', 'A lawyer who lost his first case, left the courts, and became the moral theologian of the confessional.', 'confessors, moralists'],
    '08-04': ['John Vianney', 'The curé of a village of 230 souls who heard confessions up to sixteen hours a day.', 'parish priests'],
    '08-08': ['Dominic', 'A preacher who founded an order on study, poverty and argument without bitterness.', 'preachers, astronomers'],
    '08-10': ['Lawrence', 'A deacon told to hand over the treasures of the Church, who presented the poor of Rome.', 'deacons, cooks, the poor'],
    '08-11': ['Clare of Assisi', 'Ran away at eighteen to follow Francis, and outlived him building a quiet, joyful order.', 'television, embroidery, laundry'],
    '08-14': ['Maximilian Kolbe', 'A priest who took the place of a young father in a starvation bunker.', 'prisoners, families, addicts'],
    '08-15': ['The Assumption of the Blessed Virgin Mary', 'The oldest Marian feast: taken up, body and soul, into heaven.', ''],
    '08-20': ['Bernard of Clairvaux', 'The honey-sweet preacher who wrote about loving God by degrees.', 'beekeepers, the Cistercians'],
    '08-24': ['Bartholomew', 'One of the Twelve, traditionally the apostle of Armenia.', ''],
    '08-25': ['Louis of France', 'A king who washed the feet of the poor and judged under an oak tree so anyone could reach him.', 'kings, France, the Third Order'],
    '08-27': ['Monica', 'She prayed for her son for seventeen years before he became Augustine.', 'mothers, difficult marriages'],
    '08-28': ['Augustine of Hippo', 'The restless one: "our hearts are restless until they rest in thee."', 'theologians, printers'],
    '09-03': ['Gregory the Great', 'A monk dragged to the papacy who reorganised it, fed Rome, and sent the mission to England.', 'singers, teachers'],
    '09-08': ['The Nativity of the Blessed Virgin Mary', 'The birthday of the Mother of God, nine months after the Immaculate Conception.', ''],
    '09-14': ['The Exaltation of the Holy Cross', 'The instrument of execution kept as the sign of victory.', ''],
    '09-15': ['Our Lady of Sorrows', 'The woman who stood at the cross, asked for by millions in grief since.', 'the grieving'],
    '09-21': ['Matthew', 'The tax collector who got up from his table when Jesus said "follow me".', 'accountants, bankers, tax offices'],
    '09-23': ['Pio of Pietrelcina', 'A Capuchin in a small town who spent his life in the confessional.', 'confessors, civil defence'],
    '09-29': ['Michael, Gabriel and Raphael', 'The three archangels named in scripture: protector, messenger, healer.', 'soldiers, messengers, travellers'],
    '09-30': ['Jerome', 'Bad-tempered, brilliant, and the reason we have the Latin Bible.', 'Bible scholars, translators, librarians'],
    '10-01': ['Thérèse of Lisieux', 'The Little Flower: a cloistered girl of twenty-four who taught the Church about small things.', 'missionaries, florists, aviators'],
    '10-02': ['The Guardian Angels', 'The old, quiet belief that each of us has a companion we cannot see.', ''],
    '10-04': ['Francis of Assisi', 'The rich boy who gave his clothes to a beggar and rebuilt the Church by being poor.', 'animals, ecology, Italy'],
    '10-07': ['Our Lady of the Rosary', 'A feast in honour of a string of beads and the habit of praying it.', ''],
    '10-15': ['Teresa of Avila', 'Reformer, writer, and the first woman named a doctor of the Church.', 'Spain, headache sufferers, chess players'],
    '10-18': ['Luke the Evangelist', 'A physician who wrote the Gospel of mercy and the Acts of the Apostles.', 'doctors, artists, butchers'],
    '10-22': ['John Paul II', 'A Polish priest who survived two totalitarian regimes and told the world not to be afraid.', 'families, Poland'],
    '10-28': ['Simon and Jude', 'Judas Thaddaeus, the saint of impossible cases.', 'desperate cases, Armenia'],
    '11-01': ['All Saints', 'The whole family in heaven, named and unnamed, including the forgotten ones.', ''],
    '11-02': ['All Souls', 'A day to pray for the dead by name: the Church\'s longest memory.', ''],
    '11-11': ['Martin of Tours', 'A soldier who cut his cloak in half for a beggar and dreamed of Christ wearing it.', 'soldiers, France, the poor'],
    '11-13': ['Frances Xavier Cabrini', 'An Italian nun who crossed the ocean twenty-three times for immigrants.', 'immigrants, hospital workers'],
    '11-22': ['Cecilia', 'A Roman noblewoman, venerated since the third century, who sang to God on her wedding day.', 'musicians, singers'],
    '11-30': ['Andrew', 'The first-called, who brought his brother Simon to Jesus.', 'Scotland, Greece, fishermen'],
    '12-03': ['Francis Xavier', 'The great missionary of the East, who baptised so many he could no longer lift his arm.', 'missionaries, India, Japan'],
    '12-06': ['Nicholas', 'A bishop of Myra remembered for secret gifts, which is why he is Santa Claus.', 'children, sailors, pawnbrokers'],
    '12-08': ['The Immaculate Conception', 'Preserved from sin from the first moment, for the sake of the One she would carry.', ''],
    '12-12': ['Our Lady of Guadalupe', 'The Mother of God who spoke to Juan Diego in his own language, and left roses in December.', 'the Americas, the unborn'],
    '12-13': ['Lucy', 'Martyred in Syracuse; her name means light, which is why her feast falls in the darkest days.', 'the eyes, sight, Sweden'],
    '12-14': ['John of the Cross', 'Imprisoned, starved, escaped, and wrote the most beautiful Spanish poetry of the mystical life.', 'mystics, poets'],
    '12-26': ['Stephen', 'The first martyr, a deacon: forgiving the men who stoned him as he died.', 'deacons, stonemasons'],
    '12-27': ['John the Apostle', 'The beloved disciple, who stood at the cross and outlived almost everyone.', 'theologians, friendship'],
    '12-28': ['The Holy Innocents', 'The children killed by Herod, honoured as martyrs who died for a Christ they never met.', 'babies, the innocent'],
    '12-31': ['Sylvester', 'A pope of the peace of Constantine, remembered at the hinge of the year.', ''],
    '12-25': ['The Nativity of the Lord', 'Christmas: the Word made flesh, laid where animals fed.', ''],
    '12-24': ['Christmas Eve', 'Joseph finds nowhere for her to give birth. The waiting is nearly over.', ''],
    '11-27': ['The Miraculous Medal (Catherine Labouré)', 'A young novice who was asked to strike a medal that half the world now wears.', ''],
    '11-05': ['Elizabeth and Zechariah', 'The elderly couple who were told "nothing is impossible with God".', ''],
    '09-13': ['John Chrysostom', 'The golden-mouthed preacher exiled twice for saying true things to powerful people.', 'preachers, public speakers'],
    '05-10': ['Damien of Molokai', 'A missionary priest who lived and died with the lepers of Molokai.', 'lepers, outcasts, missionaries'],
    '10-27': ['Bartolomé de las Casas', 'A landowner who gave up his estates after one sermon and spent fifty years defending the peoples of the Americas.', 'justice, the Americas']
  };
  const SAINT_UPCOMING = 7;

  /* ---------- Office of Readings / Lauds / Vespers / Compline: a simplified psalter ---------- */
  const OFFICE = {
    0: { name: 'Sunday', lauds: [63, 149], vespers: [110, 113], compline: [91, 134] },
    1: { name: 'Monday', lauds: [5, 42], vespers: [11, 45], compline: [91, 4] },
    2: { name: 'Tuesday', lauds: [24, 87], vespers: [20, 21], compline: [91, 16] },
    3: { name: 'Wednesday', lauds: [77, 96], vespers: [15, 112], compline: [91, 31] },
    4: { name: 'Thursday', lauds: [80, 97], vespers: [132, 135], compline: [91, 121] },
    5: { name: 'Friday', lauds: [51, 100], vespers: [41, 46], compline: [91, 130] },
    6: { name: 'Saturday', lauds: [122, 150], vespers: [23, 126], compline: [91, 143] }
  };
  const CANTICLES = [
    ['Benedictus (Zechariah\'s song)', 'Luke 1:68-79'],
    ['Magnificat (Mary\'s song)', 'Luke 1:46-55'],
    ['Nunc Dimittis (Simeon\'s song)', 'Luke 2:29-32']
  ];

  /* ---------- shared chrome ---------- */
  const subBar = (cur, list) => '<div class="fa-sub">' + list.map(x => '<button class="ib' + (x[0] === cur ? ' on' : '') + '" data-fx="' + x[0] + '">' + x[1] + '</button>').join('') + '</div>';
  const lookStrip = () => '<div class="fa-card"><b>🕯️ Dress Moundshroud for prayer</b>' +
    '<div class="small mute" style="margin:4px 0 8px">A few of the newer colour themes and shapes suit this section. Settings &gt; Appearance has the full list and keeps your choice.</div>' +
    '<div class="row" style="flex-wrap:wrap;gap:6px">' +
    [['vespers', '🌆 Vespers'], ['icon', '🖼 Iconostasis'], ['catacomb', '🔥 Catacomb'], ['parchment', '📜 Parchment'], ['rosewindow', '🌹 Rose Window'], ['triduum', '🕯 Triduum']].map(t => '<button class="ib" data-fxt="' + t[0] + '">' + t[1] + '</button>').join('') +
    '<button class="ib" data-fxt="reset">↺ Back to my theme</button></div>' +
    '<div class="row" style="flex-wrap:wrap;gap:6px;margin-top:6px">' +
    [['illuminated', '📜 Illuminated'], ['monastic', '☩ Monastic'], ['candlelight', '🔥 Candlelight'], ['rubric', '✒️ Rubric'], ['gothic', '🗼 Gothic']].map(t => '<button class="chip" data-fxs="' + t[0] + '">' + t[1] + '</button>').join('') +
    '</div></div>';
  const wireLook = host => {
    host.querySelectorAll('[data-fxt]').forEach(b => b.onclick = () => {
      try {
        if (b.dataset.fxt === 'reset') { const back = ls.get('faithx_savedtheme', '') || ls.get('theme', 'midnight') || 'midnight'; ls.set('faithx_savedtheme', ''); window.OA_THEMES.apply(back); A.toast('Back to your usual look.'); return; }
        if (!ls.get('faithx_savedtheme')) ls.set('faithx_savedtheme', window.OA_THEMES.get());
        window.OA_THEMES.apply(b.dataset.fxt); A.toast('Theme: ' + b.textContent.trim());
      } catch (e) { }
    });
    host.querySelectorAll('[data-fxs]').forEach(b => b.onclick = () => {
      try { window.OA_THEMES.applyStyle(b.dataset.fxs); A.toast('Shape: ' + b.textContent.trim()); } catch (e) { }
    });
  };

  /* ================== 1. Holy Hour / Adoration ================== */
  const HOUR_WATCHES = [
    ['First watch: be still', 'You do not have to say anything at all. Sit down and let the silence do the work.', 'Psalm 46:10'],
    ['Second watch: look at him', 'Look at the cross and let it look back at you. Nothing has to be resolved tonight.', '2 Corinthians 4:6'],
    ['Third watch: speak plainly', 'Say the thing you have not said out loud anywhere else. He already knows, and he has not left.', 'Psalm 62:8'],
    ['Fourth watch: hand it over', 'Name one thing you will stop carrying tonight, and leave it here.', 'Matthew 11:28-30'],
  ];
  async function adoration(host) {
    clearTick();
    const st = rd('ador', { minutes: 60, day: '', mins: 0, streak: 0, notes: {}, started: 0 });
    const plan = [15, 30, 45, 60].some(m => m === st.minutes) ? st.minutes : 60;
    const quarter = plan / 4;
    const now = Date.now();
    const running = st.started > 0;
    const left = running ? Math.max(0, st.started + plan * 60000 - now) : plan * 60000;
    const watch = Math.min(3, Math.floor((plan * 60000 - left) / (quarter * 60000)));
    const txt = (await Promise.all([refText(HOUR_WATCHES[watch][2]), psalmText(16)]));
    const mmss = ms => Math.floor(ms / 60000) + ':' + String(Math.floor((ms % 60000) / 1000)).padStart(2, '0');
    host.innerHTML = '<div class="fa-wrap">' + subBar('adoration', window.FAITHX.tabs) +
      '<div class="fa-card"><div class="row" style="gap:12px;align-items:center;flex-wrap:wrap"><div style="font-size:32px">🕯️</div><div style="flex:1;min-width:220px"><b style="font-size:17px">A holy hour, made easy</b><div class="small mute">Four watches, a passage for each, and somewhere to write what came up. No clock-watching required: leave and come back, it keeps your place.</div></div></div>' +
      '<div class="row" style="flex-wrap:wrap;gap:6px;margin-top:10px">' + [15, 30, 45, 60].map(m => '<button class="' + (plan === m ? 'pri' : 'ib') + '" data-fxm="' + m + '">' + m + ' min</button>').join('') +
      '<span class="sp" style="flex:1"></span><button class="' + (running ? 'ib' : 'pri') + '" data-fxgo="' + (running ? 'stop' : 'start') + '">' + (running ? '⏸ Pause' : '▶ Begin') + '</button><button class="ib" data-fxgo="reset">↺ Finish</button></div>' +
      '<div class="row" style="gap:16px;margin-top:12px;flex-wrap:wrap"><div class="ring" style="--p:' + Math.round((plan * 60000 - left) / (plan * 60000) * 100) + ';--c:var(--acc);margin:0"><span id="adclock">' + mmss(left) + '</span></div>' +
      '<div style="flex:1;min-width:240px"><b>' + HOUR_WATCHES[watch][0] + '</b><div class="small mute" style="margin-top:2px">' + HOUR_WATCHES[watch][1] + '</div><div class="small" style="margin-top:8px;font-style:italic;color:var(--mute)">' + (txt[0] ? '“' + esc(txt[0]) + '” <span class="small">— ' + HOUR_WATCHES[watch][2] + '</span>' : '') + '</div></div></div></div>' +
      '<div class="fa-card"><b>🕊️ Spiritual communion</b><div class="small" style="margin-top:4px;line-height:1.7">My Jesus, I believe that Thou art present in the Blessed Sacrament. I love Thee above all things and I desire Thee in my soul. Since I cannot now receive Thee sacramentally, come at least spiritually into my heart. I embrace Thee as already come, and unite myself wholly to Thee; never permit me to be separated from Thee. Amen.</div>' +
      '<div class="small mute" style="margin-top:8px">' + (txt[1] ? 'Psalm 16 is a good companion for a holy hour.' : '') + '</div></div>' +
      '<div class="fa-card"><b>📝 What did you notice?</b><div class="small mute" style="margin:2px 0 6px">Only you can see this. It stays on this PC.</div><textarea id="adnote" rows="5" style="width:100%" placeholder="A word, a line, a thing to do tomorrow...">' + esc(st.notes[ymd(new Date())] || '') + '</textarea></div>' +
      '<div class="fa-card"><b>🔥 The habit</b><div class="small mute">' + (st.streak ? 'You have kept ' + st.streak + ' day' + (st.streak === 1 ? '' : 's') + ' in a row.' : 'Start today and it will count the days for you.') + (st.day ? ' Last hour: ' + st.day + '.' : '') + ' ' + (st.mins ? 'Total time given: ' + st.mins + ' minutes.' : '') + '</div></div>' + lookStrip() + '</div>';
    wireLook(host);
    const box = host.querySelector('#adnote'); if (box) box.oninput = () => { st.notes[ymd(new Date())] = box.value; wr('ador', st); };
    host.querySelectorAll('[data-fxm]').forEach(b => b.onclick = () => { st.minutes = +b.dataset.fxm; st.started = 0; wr('ador', st); adoration(host); });
    host.querySelectorAll('[data-fxgo]').forEach(b => b.onclick = () => {
      const go = b.dataset.fxgo;
      if (go === 'start') { st.started = Date.now(); st.day = ymd(new Date()); wr('ador', st); adoration(host); }
      else if (go === 'stop') { st.started = 0; wr('ador', st); adoration(host); }
      else {
        st.started = 0; st.mins = (st.mins || 0) + plan;
        const s = rd('adorStreak', { last: '', n: 0 }), yesterday = ymd(new Date(Date.now() - 864e5));
        s.n = s.last === st.day ? s.n : (s.last === yesterday ? s.n + 1 : 1);
        s.last = st.day || ymd(new Date()); wr('adorStreak', s); st.streak = s.n; wr('ador', st);
        A.toast('Hour finished. Well done.'); adoration(host);
      }
    });
    if (running) {
      const end = st.started + plan * 60000;
      tick = setInterval(() => {
        const el = host.querySelector('#adclock'); if (!el) { clearTick(); return; }
        const ms = end - Date.now();
        el.textContent = ms > 0 ? mmss(ms) : '0:00';
        if (ms <= 0) { clearTick(); A.toast('The hour is complete. Thank you for the time.', 5000); }
      }, 1000);
    }
  }

  /* ================== 2. Stations of the Cross ================== */
  const VERSE_AFTER = 'We adore thee, O Christ, and we bless thee. Because by thy holy cross thou hast redeemed the world.';
  async function stations(host) {
    const st = rd('stations', { walk: false, at: 0, done: {}, last: '' });
    const verses = await Promise.all(STATIONS.map(s => refText(s[2])));
    const pct = Object.keys(st.done).filter(k => st.done[k]).length;
    const head = subBar('stations', window.FAITHX.tabs) +
      '<div class="fa-card"><div class="row" style="gap:10px;align-items:center;flex-wrap:wrap"><div style="font-size:30px">✝️</div><div style="flex:1;min-width:220px"><b style="font-size:17px">Stations of the Cross</b><div class="small mute">Walk them one at a time, or read the whole way at once. ' + pct + ' of 14 marked this month.</div></div><button class="' + (st.walk ? 'pri' : 'ib') + '" data-fxw="1">' + (st.walk ? '🚶 Walking mode' : '🚶 Walk them') + '</button><button class="ib" data-fxw="all">📖 Show all</button><button class="ib" data-fxw="copy">📋 Copy</button><button class="ib" data-fxw="clear">↺ Reset</button></div>' +
      (st.walk ? '<div class="row" style="gap:3px;margin-top:10px;flex-wrap:wrap">' + STATIONS.map((s, i) => '<span class="fa-bead' + (st.done[i] ? ' on' : '') + (i === st.at ? ' cur' : '') + '" data-fxj="' + i + '" title="' + roman(i + 1) + '"></span>').join('') + '</div>' : '') + '</div>';
    let body = '';
    if (st.walk) {
      const i = Math.max(0, Math.min(13, st.at)), s = STATIONS[i];
      body = '<div class="fa-card"><div class="small mute">Station ' + roman(i + 1) + ' of XIV</div><b style="font-size:18px;display:block;margin:2px 0 8px">' + esc(s[0]) + '</b>' +
        '<div class="small" style="line-height:1.75">' + esc(s[1]) + '</div>' +
        (verses[i] ? '<div class="small" style="margin-top:10px;padding-left:10px;border-left:3px solid var(--line);font-style:italic;line-height:1.7">' + esc(verses[i].slice(0, 420)) + '<div class="small mute" style="margin-top:4px">' + esc(s[2]) + '</div></div>' : '') +
        '<div class="small" style="margin-top:10px;color:var(--acc)">' + VERSICLE + '</div>' +
        '<div class="small mute" style="margin-top:10px"><b>To think about:</b> ' + esc(s[3]) + '</div>' +
        '<div class="row" style="gap:6px;margin-top:12px;flex-wrap:wrap"><button class="ib" data-fxn="' + (i - 1) + '"' + (i === 0 ? ' disabled' : '') + '>◀ Back</button><button class="pri" data-fxn="' + (i + 1) + '"' + (i === 13 ? ' disabled' : '') + '>Next ▶</button><span style="flex:1"></span><button class="' + (st.done[i] ? 'ib on' : 'ib') + '" data-fxd="' + i + '">' + (st.done[i] ? '✓ Prayed' : 'Mark as prayed') + '</button></div></div>';
    } else {
      body = STATIONS.map((s, i) => '<div class="fa-card"><div class="row" style="gap:10px;align-items:baseline"><div style="font-size:20px;color:var(--acc);font-weight:700;min-width:34px">' + roman(i + 1) + '</div><div style="flex:1;min-width:0"><b>' + esc(s[0]) + '</b><div class="small" style="margin:4px 0;line-height:1.7">' + esc(s[1]) + '</div>' +
        (verses[i] ? '<div class="small" style="padding-left:10px;border-left:3px solid var(--line);font-style:italic;line-height:1.7">' + esc(verses[i].slice(0, 360)) + ' <span class="mute">— ' + esc(s[2]) + '</span></div>' : '') +
        '<div class="small" style="margin-top:6px;color:var(--acc)">' + VERSICLE + '</div><div class="small mute" style="margin-top:6px"><b>To think about:</b> ' + esc(s[3]) + '</div></div></div></div>').join('');
    }
    host.innerHTML = '<div class="fa-wrap">' + head + body +
      '<div class="fa-card"><b>🙏 Praying them well</b><div class="small mute" style="margin-top:4px">Move as slowly as you like: a station can take a minute or ten. If you are walking a church, the traditional order above is the one on the walls. On Fridays in Lent this is the classic devotion; it can be prayed any day.</div><div class="row" style="gap:6px;margin-top:8px;flex-wrap:wrap"><button class="ib" data-fxask="1">💬 Ask Moundshroud about the Stations</button><button class="ib" data-fxask="2">💬 Ask about Good Friday</button></div></div>' + lookStrip() + '</div>';
    wireLook(host);
    host.querySelectorAll('[data-fxn]').forEach(b => b.onclick = () => { st.at = +b.dataset.fxn; wr('stations', st); stations(host); });
    host.querySelectorAll('[data-fxj]').forEach(b => b.onclick = () => { st.at = +b.dataset.fxj; wr('stations', st); stations(host); });
    host.querySelectorAll('[data-fxd]').forEach(b => b.onclick = () => { const i = +b.dataset.fxd; st.done[i] = st.done[i] ? 0 : 1; st.last = ymd(new Date()); wr('stations', st); stations(host); });
    host.querySelectorAll('[data-fxw]').forEach(b => b.onclick = () => {
      const w = b.dataset.fxw;
      if (w === 'copy') { A.copy('STATIONS OF THE CROSS\n\n' + STATIONS.map((s, i) => roman(i + 1) + '. ' + s[0] + '\n' + s[1] + '\n' + VERSE_AFTER + '\n').join('\n')); return; }
      if (w === 'clear') { st.done = {}; wr('stations', st); stations(host); return; }
      st.walk = (w === '1') ? !st.walk : false; if (st.walk) st.at = 0; wr('stations', st); stations(host);
    });
    host.querySelectorAll('[data-fxask]').forEach(b => b.onclick = () => ask(b.dataset.fxask === '1'
      ? 'Explain the Stations of the Cross to someone who has never prayed them: where the devotion comes from, why there are fourteen, and how to pray them slowly. Under 220 words.'
      : 'Why is Good Friday called good? Explain the day to someone who finds the crucifixion hard to think about. Under 200 words.'));
  }

  /* ================== 3. Chaplet of Divine Mercy (and the Seven Sorrows) ================== */
  async function chaplet(host) {
    const st = rd('chaplet', { kind: 'mercy', bead: 1, day: '', done: {} });
    const kind = st.kind;
    const seq = kind === 'mercy'
      ? [].concat([CHAPLET[0], CHAPLET[1], CHAPLET[2], CHAPLET[3], CHAPLET[4]],
        (() => { const out = []; for (let d = 0; d < 5; d++) { out.push(CHAPLET[5]); for (let i = 0; i < 10; i++) out.push(CHAPLET[6]); } return out; })(),
        [CHAPLET[7], CHAPLET[8]])
      : [].concat([CHAPLET[0], CHAPLET[1], CHAPLET[5]],
        (() => { const out = []; SORROWS.forEach((s, i) => { out.push(['Sorrow ' + (i + 1) + ': ' + s[0], s[1] + ' (Hail Mary seven times for the sorrow and its fruit.)']); for (let b = 0; b < 7; b++) out.push(['Hail Mary', CHAPLET[3][1]]); }); return out; })(),
        [CHAPLET[7], CHAPLET[8]]);
    const at = Math.max(1, Math.min(seq.length, st.bead)), cur = seq[at - 1];
    const pct = Math.round((st.done[ymd(new Date())] || 0) / seq.length * 100);
    host.innerHTML = '<div class="fa-wrap">' + subBar('chaplet', window.FAITHX.tabs) +
      '<div class="fa-card"><div class="row" style="gap:10px;align-items:center;flex-wrap:wrap"><div style="font-size:30px">📿</div><div style="flex:1;min-width:220px"><b style="font-size:17px">' + (kind === 'mercy' ? 'The Chaplet of Divine Mercy' : 'The Seven Sorrows of Mary') + '</b><div class="small mute">' + (kind === 'mercy' ? 'Prayed on ordinary rosary beads, usually at three in the afternoon. About six minutes.' : 'Seven sorrows, seven Hail Marys each: a devotion for grief and patience.') + '</div></div>' +
      '<button class="' + (kind === 'mercy' ? 'pri' : 'ib') + '" data-fxk="mercy">Divine Mercy</button><button class="' + (kind === 'sorrows' ? 'pri' : 'ib') + '" data-fxk="sorrows">Seven Sorrows</button></div></div>' +
      '<div class="fa-card"><div id="chbeads" style="margin:4px 0 10px;line-height:1.9">' + seq.map((x, i) => '<span class="fa-bead' + (i + 1 < at ? ' on' : '') + (i + 1 === at ? ' cur' : '') + '" data-fxb="' + (i + 1) + '" title="' + (i + 1) + '"></span>').join('') + '</div>' +
      '<b id="chname">' + esc(cur[0]) + '</b><div class="small" style="margin-top:6px;line-height:1.8" id="chtxt">' + esc(cur[1]) + '</div>' +
      '<div class="row" style="gap:6px;margin-top:12px;flex-wrap:wrap"><button class="ib" data-fxb="' + (at - 1) + '"' + (at <= 1 ? ' disabled' : '') + '>◀ Back</button><button class="pri" data-fxb="' + (at + 1) + '"' + (at >= seq.length ? ' disabled' : '') + '>Next bead ▶</button><span style="flex:1"></span><button class="ib" data-fxr="1">↺ Start again</button></div>' +
      '<div class="bar" style="margin-top:10px"><i style="width:' + pct + '%"></i></div><div class="small mute">' + at + ' of ' + seq.length + ' · ' + pct + '% of today\'s prayers</div></div>' +
      '<div class="fa-card"><b>The prayers</b>' + CHAPLET.map(p => '<div style="margin-top:8px"><b class="small">' + esc(p[0]) + '</b><div class="small mute" style="line-height:1.7">' + esc(p[1]) + '</div></div>').join('') + '</div>' + lookStrip() + '</div>';
    wireLook(host);
    const go = n => { st.bead = Math.max(1, Math.min(seq.length, n)); if (st.bead >= seq.length) A.toast('Finished. The chaplet is complete.'); wr('chaplet', st); chaplet(host); };
    const count = () => { const d = ymd(new Date()); st.done[d] = at; wr('chaplet', st); };
    host.querySelectorAll('[data-fxb]').forEach(b => b.onclick = () => { count(); go(+b.dataset.fxb); });
    host.querySelectorAll('[data-fxk]').forEach(b => b.onclick = () => { st.kind = b.dataset.fxk; st.bead = 1; wr('chaplet', st); chaplet(host); });
    const r = host.querySelector('[data-fxr]'); if (r) r.onclick = () => { count(); go(1); };
  }

  /* ================== 4. Liturgy of the Hours (simplified) ================== */
  async function office(host) {
    const d = new Date(), day = OFFICE[d.getDay()];
    const st = rd('office', { hour: 'lauds', day: '', hours: {} });
    const hourName = { readings: 'Office of Readings', lauds: 'Morning Prayer (Lauds)', vespers: 'Evening Prayer (Vespers)', compline: 'Night Prayer (Compline)' }[st.hour];
    const set = st.hour === 'readings' ? { ps: [1, 8] } : st.hour === 'lauds' ? { ps: day.lauds } : st.hour === 'vespers' ? { ps: day.vespers } : { ps: day.compline };
    const ps = (await Promise.all(set.ps.map(psalmText))).filter(Boolean);
    const canticle = st.hour === 'lauds' ? CANTICLES[0] : st.hour === 'vespers' ? CANTICLES[1] : st.hour === 'compline' ? CANTICLES[2] : null;
    const ctext = canticle ? await refText(canticle[1]) : '';
    const reading = st.hour === 'readings' ? await refText('Romans 8:31-39') : st.hour === 'compline' ? await refText('1 Peter 5:8-9') : await refText('Colossians 3:12-17');
    const season = (() => { try { return window.FAITH.season(d); } catch (e) { return { n: 'Ordinary Time' }; } })();
    const antiphon = /Lent/i.test(season.n) ? '“Return to me with all your heart, says the Lord.”'
      : /Advent/i.test(season.n) ? '“Come, Lord Jesus, do not delay.”'
        : /Christmas/i.test(season.n) ? '“A light has dawned for those who dwelt in the land of deep darkness.”'
          : /Easter/i.test(season.n) ? '“Alleluia, the Lord is risen as he promised. Alleluia.”'
            : '“O God, come to my assistance; O Lord, make haste to help me.”';
    const doneToday = st.hours[ymd(d)] || {};
    host.innerHTML = '<div class="fa-wrap">' + subBar('office', window.FAITHX.tabs) +
      '<div class="fa-card"><div class="row" style="gap:10px;align-items:center;flex-wrap:wrap"><div style="font-size:30px">🕰️</div><div style="flex:1;min-width:220px"><b style="font-size:17px">Pray the hours</b><div class="small mute">A simplified psalter, prayed with the Church morning, evening and night. ' + esc(season.n) + ', ' + day.name + '. The psalms come from your own Bible files, so it works with no internet at all.</div></div></div>' +
      '<div class="row" style="flex-wrap:wrap;gap:6px;margin-top:10px">' + [['lauds', '🌅 Morning'], ['readings', '📖 Readings'], ['vespers', '🌆 Evening'], ['compline', '🌙 Night']].map(x => '<button class="' + (st.hour === x[0] ? 'pri' : 'ib') + '" data-fxo="' + x[0] + '">' + x[1] + '</button>').join('') +
      '<span style="flex:1"></span><button class="ib" data-fxr="1">🔊 Read it aloud</button><button class="ib" data-fxsay="1">💬 Ask about this hour</button></div></div>' +
      '<div class="fa-card"><b>' + esc(hourName) + '</b><div class="small mute" style="margin-top:2px">' + esc(antiphon) + '</div>' +
      '<div class="small" style="margin-top:10px;line-height:1.85"><b style="color:var(--acc)">✚ O God, come to my assistance. R. O Lord, make haste to help me.</b><br>Glory be to the Father, and to the Son, and to the Holy Ghost. As it was in the beginning, is now, and ever shall be, world without end. Amen.</div></div>' +
      ps.map(p => '<div class="fa-card"><b class="small" style="color:var(--acc)">' + esc(p.label) + '</b><div class="small" style="margin-top:6px;line-height:1.85">' + p.v.map((t, i) => '<span class="fa-v">' + esc(t) + '</span>').join(' ') + '</div></div>').join('') +
      (canticle ? '<div class="fa-card"><b class="small" style="color:var(--acc)">' + esc(canticle[0]) + '</b><div class="small" style="margin-top:6px;line-height:1.85">' + esc(ctext) + '</div></div>' : '') +
      (reading ? '<div class="fa-card"><b class="small" style="color:var(--acc)">Short reading</b><div class="small" style="margin-top:6px;line-height:1.8;font-style:italic">' + esc(reading.slice(0, 900)) + '</div></div>' : '') +
      '<div class="fa-card"><b class="small" style="color:var(--acc)">Prayers and the Lord\'s Prayer</b><div class="small" style="margin-top:6px;line-height:1.8">Let us pray for the Church and for the whole world, then pray together as he taught us:<br><span style="font-style:italic">Our Father, who art in heaven...</span></div>' +
      '<div class="row" style="gap:6px;margin-top:10px;flex-wrap:wrap"><button class="' + (doneToday[st.hour] ? 'ib on' : 'pri') + '" data-fxp="1">' + (doneToday[st.hour] ? '✓ Prayed ' + esc(hourName) + ' today' : '✚ I have prayed this hour') + '</button></div></div>' +
      '<div class="fa-card"><b>🙏 The hours at a glance</b><div class="small mute" style="margin-top:4px">This is a devotional simplification, not the full breviary: two psalms, a canticle and a short reading for each hour, with a four-week spirit kept by the day of the week. If you want the full four-volume office, this is a good place to begin and grow from.</div></div>' + lookStrip() + '</div>';
    wireLook(host);
    host.querySelectorAll('[data-fxo]').forEach(b => b.onclick = () => { st.hour = b.dataset.fxo; wr('office', st); office(host); });
    const p = host.querySelector('[data-fxp]'); if (p) p.onclick = () => { const k = ymd(d); st.hours[k] = st.hours[k] || {}; st.hours[k][st.hour] = st.hours[k][st.hour] ? 0 : 1; wr('office', st); office(host); };
    const sp = host.querySelector('[data-fxr]'); if (sp) sp.onclick = () => { try { A.speech.stop(); A.speech.speak(hourName + '. ' + antiphon + ' ' + ps.map(x => x.label + '. ' + x.v.join(' ')).join(' ') + ' ' + ctext + ' ' + reading); A.toast('Reading aloud.'); } catch (e) { A.toast('No voice is installed.'); } };
    const sq = host.querySelector('[data-fxsay]'); if (sq) sq.onclick = () => ask('Explain the Liturgy of the Hours (' + hourName.replace(/[()]/g, '') + ') to a beginner: what it is, where it comes from, and how a person might start praying it at home with a Bible. Under 220 words.');
  }

  /* ================== 5. Saints, feast days and novenas ================== */
  async function saints(host) {
    const today = new Date(), key = md(today);
    const st = rd('novena', { saint: '', start: '', days: {}, note: '' });
    const list = Object.keys(SAINTS).filter(k => SAINTS[k] && SAINTS[k][0]).sort();
    const upcoming = list.filter(k => k >= key).slice(0, SAINT_UPCOMING).concat(list.filter(k => k < key).slice(0, 2));
    /* the general Roman calendar has quiet days: show the next feast rather than an empty card */
    const todayEntry = SAINTS[key], shownKey = todayEntry ? key : (list.filter(k => k > key)[0] || list[0]), shown = SAINTS[shownKey] || ['', '', ''];
    const feastRow = k => { const s = SAINTS[k]; const t = k === key; return '<div class="row" style="gap:10px;padding:7px 0;border-bottom:1px solid var(--line);align-items:baseline"><span class="small mute" style="width:74px">' + (t ? 'Today' : k.replace('-', '/')) + '</span><div style="flex:1;min-width:0"><b' + (t ? ' style="color:var(--acc)"' : '') + '>' + esc(s[0]) + '</b><div class="small mute" style="line-height:1.6">' + esc(s[1]) + (s[2] ? ' <span class="badge">asks for: ' + esc(s[2]) + '</span>' : '') + '</div></div>' + (t ? '' : '<button class="chip" data-fxv="' + k + '">Novena</button>') + '</div>'; };
    const day1 = st.start ? new Date(st.start + 'T00:00:00') : null;
    const nDay = day1 ? Math.min(9, Math.floor((today - day1) / 864e5) + 1) : 0;
    host.innerHTML = '<div class="fa-wrap">' + subBar('saints', window.FAITHX.tabs) +
      '<div class="fa-card"><div class="row" style="gap:10px;align-items:center;flex-wrap:wrap"><div style="font-size:30px">😇</div><div style="flex:1;min-width:220px"><b style="font-size:17px">' + (todayEntry ? 'Saint of the day' : 'The next feast day') + '</b><div class="small mute">' + today.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' }) + (todayEntry ? '' : ' &middot; no fixed feast today') + '</div>' +
      '<b style="display:block;margin-top:8px">' + esc(shown[0]) + '</b>' +
      '<div class="small" style="margin-top:4px;line-height:1.7">' + esc(shown[1]) + '</div>' +
      (shown[2] ? '<div class="small mute" style="margin-top:4px">Patron of: ' + esc(shown[2]) + '</div>' : '') +
      (todayEntry ? '' : '<div class="small mute" style="margin-top:6px">The general Roman calendar keeps no saint on this date, so here is the next one: ' + esc(shownKey.replace('-', '/')) + '.</div>') + '</div></div>' +
      '<div class="row" style="gap:6px;margin-top:10px;flex-wrap:wrap"><button class="ib" data-fxask="1">💬 Ask Moundshroud about this saint</button><button class="ib" data-fxask="2">💬 Suggest someone for my situation</button><button class="ib" data-fxv="' + shownKey + '">🙏 Start a nine-day novena</button></div></div>' +
      '<div class="fa-card"><b>🗓️ The next few days</b>' + upcoming.map(feastRow).join('') + '</div>' +
      '<div class="fa-card"><b>🙏 Your novena</b>' + (st.start && SAINTS[st.saint] ? (() => {
        const s = SAINTS[st.saint]; let beads = '';
        for (let i = 1; i <= 9; i++) beads += '<span class="fa-bead' + (st.days[i] ? ' on' : '') + (i === nDay ? ' cur' : '') + '" data-fxd2="' + i + '" title="Day ' + i + '"></span>';
        return '<div class="small mute" style="margin:2px 0 8px">Nine days with <b>' + esc(s[0]) + '</b>, started ' + esc(st.start) + '. ' + (nDay >= 1 && nDay <= 9 ? 'Today is day ' + nDay + '.' : nDay > 9 ? 'The nine days are complete.' : '') + (s[2] ? ' They are asked for: ' + esc(s[2]) + '.' : '') + '</div>' + beads +
          '<textarea id="nvnote" rows="3" style="width:100%;margin-top:8px" placeholder="What you are asking for, in your own words...">' + esc(st.note || '') + '</textarea>' +
          '<div class="small mute" style="margin-top:6px">Pray in your own words, or use the Rosary page and offer one decade each day. Day ' + (nDay > 9 ? 9 : Math.max(1, nDay)) + ' of nine is today.</div>';
      })() : '<div class="small mute">Choose a saint above and Moundshroud will keep the nine days for you, one bead at a time.</div>') + '</div>' +
      '<div class="fa-card"><b>📅 All the feast days</b><div class="small mute" style="margin:2px 0 8px">Tap a day to see it, or use the search below. The spiritual Calendar page has the seasons and the moveable feasts.</div>' +
      '<input id="ssearch" placeholder="Search a name or a patronage (animals, students, mothers...)" style="width:100%;margin-bottom:6px"><div id="slist" style="max-height:340px;overflow:auto">' + list.map(feastRow).join('') + '</div></div>' + lookStrip() + '</div>';
    wireLook(host);
    const box = host.querySelector('#nvnote'); if (box) box.oninput = () => { st.note = box.value; wr('novena', st); };
    host.querySelectorAll('[data-fxd2]').forEach(b => b.onclick = () => { const i = +b.dataset.fxd2; st.days[i] = st.days[i] ? 0 : 1; wr('novena', st); saints(host); });
    host.querySelectorAll('[data-fxv]').forEach(b => b.onclick = () => { st.saint = b.dataset.fxv; st.start = ymd(new Date()); st.days = {}; wr('novena', st); A.toast('Novena started with ' + (SAINTS[st.saint] || [''])[0]); saints(host); });
    const se = host.querySelector('#ssearch');
    if (se) se.oninput = () => { const q = se.value.trim().toLowerCase(); const out = list.filter(k => !q || (SAINTS[k][0] + ' ' + SAINTS[k][1] + ' ' + (SAINTS[k][2] || '')).toLowerCase().includes(q)); host.querySelector('#slist').innerHTML = out.length ? out.map(feastRow).join('') : '<div class="small mute">Nothing matches that.</div>'; host.querySelectorAll('#slist [data-fxv]').forEach(b => b.onclick = () => { st.saint = b.dataset.fxv; st.start = ymd(new Date()); st.days = {}; wr('novena', st); saints(host); }); };
    host.querySelectorAll('[data-fxask]').forEach(b => b.onclick = () => ask(b.dataset.fxask === '1'
      ? 'Tell me the story of ' + shown[0] + ': who they were, what they did, and one concrete thing a person could learn from them today. Under 220 words.'
      : 'I am looking for a saint to pray with. Ask me nothing; instead suggest three saints for ordinary struggles (anxiety, overwork, a difficult family situation), with one sentence on why each one fits. Under 200 words.'));
  }

  const PAGES = { adoration, stations, chaplet, office, saints };
  window.FAITHX = {
    tabs: [['adoration', '🕯️ Adoration'], ['stations', '✝️ Stations'], ['chaplet', '📿 Chaplet'], ['office', '🕰️ Office'], ['saints', '😇 Saints']],
    has: id => !!PAGES[id],
    render(id, host) { clearTick(); if (!PAGES[id]) return; PAGES[id](host).catch(e => { host.innerHTML = '<div class="mute">Could not draw this page: ' + esc(e.message) + '</div>'; }); }
  };
})();

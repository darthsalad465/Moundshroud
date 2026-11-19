// Spiritual › 🎓 Learn: an interactive way to learn the Bible, all offline, using the Bible texts already on this PC.
//  - The 73 books: a tour by group with a line on each book, and three drills (which group, what it is about, put them in order)
//  - The story in 12 steps: a short lesson, the passage itself from your Bible, and three questions
//  - Memorize a verse: fill the blanks (3 levels) or type it from memory; reviewed again after 1, 2, 4, 8 and 16 days
//  - Quick quiz: which book is this verse in, and complete the verse
// Progress (points, streak, lessons, verses) is kept in this browser only. The teaching logic at the top has no page code in it,
// so tests/learn-test.js can run it in Node.
const Learn = (() => {
  const GROUPS = ['The Law', 'History', 'Wisdom and poetry', 'The Prophets', 'The Gospels', 'Acts', 'Letters of Paul', 'Other letters', 'Revelation'];
  /* one entry per book, in the order of the Bible texts (73 books): [group, a line about it] */
  const BOOK = [
    [0, 'Creation, the Fall, Noah, and the patriarchs Abraham, Isaac, Jacob and Joseph.'], [0, 'God frees Israel from Egypt, gives the Law at Sinai and has the Tabernacle built.'], [0, 'Laws of worship, sacrifice and holiness for the people and the priests.'], [0, 'Israel\'s forty years in the desert, counted and tested.'], [0, 'Moses\' farewell speeches: remember the Lord and keep the covenant.'],
    [1, 'Israel crosses the Jordan and takes the promised land.'], [1, 'Cycles of sin and rescue under Gideon, Deborah, Samson and others.'], [1, 'A widow\'s loyalty brings her into the family line of David.'], [1, 'Samuel, Saul, and the rise of David, the shepherd who becomes king.'], [1, 'David\'s reign, his great sin, and the troubles that follow.'],
    [1, 'Solomon builds the Temple, the kingdom splits, and Elijah stands against Ahab.'], [1, 'The two kingdoms decline until Assyria and Babylon carry the people away.'], [1, 'Genealogies and David\'s reign, told with a focus on worship and the Temple.'], [1, 'The Temple and the kings of Judah, ending with the exile and Cyrus\' decree.'], [1, 'The exiles return from Babylon and the Temple and the Law are restored.'],
    [1, 'Nehemiah rebuilds the walls of Jerusalem and the people renew the covenant.'], [1, 'A faithful family, the angel Raphael, and a journey of healing.'], [1, 'A widow\'s courage saves her besieged town from Holofernes.'], [1, 'A Jewish queen in Persia saves her people from destruction.'], [2, 'A righteous man suffers, and God answers out of the whirlwind.'],
    [2, '150 prayers and songs of praise, lament, thanks and trust.'], [2, 'Short sayings of practical wisdom for daily life.'], [2, 'Everything under the sun is fleeting: fear God and keep his commandments.'], [2, 'Love poetry, read as the love between God and his people.'], [2, 'Praise of Wisdom and a call to the just to live for God, written in Greek.'],
    [2, 'Advice on life, family and prayer, and the praise of famous ancestors.'], [3, 'Judgment and comfort: Emmanuel, the Suffering Servant, and a new Jerusalem.'], [3, 'The weeping prophet warns of exile and promises a new covenant.'], [3, 'Poems of grief over the fall of Jerusalem.'], [3, 'A prayer of repentance in exile and a poem in praise of Wisdom.'],
    [3, 'Visions of glory and judgment, and of dry bones brought back to life.'], [3, 'Faith in exile: the lions\' den, the fiery furnace and visions of the kingdom.'], [3, 'God, the faithful husband, loves unfaithful Israel.'], [3, 'A plague of locusts becomes a call to repent and a promise of the Spirit.'], [3, 'A shepherd demands justice for the poor.'],
    [3, 'A short judgment on Edom.'], [3, 'A reluctant prophet and a God whose mercy reaches Nineveh.'], [3, 'Justice, mercy and humility, and a ruler to come from Bethlehem.'], [3, 'The fall of Nineveh.'], [3, 'A prophet\'s questions about evil, answered with: the just shall live by faith.'],
    [3, 'The day of the Lord, and a humble remnant.'], [3, 'A call to rebuild the Temple.'], [3, 'Visions of restoration, and a king who comes riding on a donkey.'], [3, 'The last prophet of the Old Testament: honor God and await his messenger.'], [1, 'A priestly family leads a revolt for the faith against the Greek king.'],
    [1, 'Martyrs, prayer for the dead, and hope in the resurrection.'], [4, 'Jesus the new Moses and the King, with the Sermon on the Mount.'], [4, 'The shortest and fastest Gospel: Jesus the suffering Son of God.'], [4, 'The Gospel of mercy: the prodigal son and the Good Samaritan.'], [4, 'The Word became flesh: signs, the "I am" sayings and the Last Supper.'],
    [5, 'The Holy Spirit and the growth of the Church from Jerusalem to Rome.'], [6, 'Paul\'s great letter on sin, grace, faith and life in the Spirit.'], [6, 'Paul answers a divided church: unity, the Eucharist, love and the resurrection.'], [6, 'Paul defends his ministry and teaches strength in weakness.'], [6, 'Freedom in Christ, not bondage to the Law.'],
    [6, 'One Church, one body of Christ, and the armor of God.'], [6, 'A joyful letter from prison: Christ\'s humility and rejoicing.'], [6, 'Christ is supreme over all things.'], [6, 'Encouragement and hope about the coming of the Lord.'], [6, 'Stand firm and keep working until the Lord comes.'],
    [6, 'Advice to a young bishop on church order and sound teaching.'], [6, 'Paul\'s last letter: guard the faith and preach the word.'], [6, 'Order in the churches of Crete and a life of good works.'], [6, 'A short plea to welcome a runaway slave as a brother.'], [7, 'Christ the great High Priest, greater than the angels, Moses and the old sacrifices.'],
    [7, 'Faith must show itself in works; keep control of the tongue.'], [7, 'Hope and holiness for Christians suffering for their faith.'], [7, 'A warning against false teachers: the Lord will come like a thief.'], [7, 'God is love: walk in the light and love one another.'], [7, 'Stay in the truth and love, and beware of deceivers.'],
    [7, 'Welcome the missionaries; praise for Gaius.'], [7, 'Contend for the faith against those who twist it.'], [8, 'Visions of the victory of Christ, the Lamb, and the new heaven and new earth.'],
  ];
  /* the story in 12 steps: passages are [book, chapter (0 = first), first verse, last verse] in the order of the Bible texts */
  const LESSONS = [
    { id: 'l1', ic: '🌍', t: 'Creation and the Fall', ps: [[0, 0, 26, 31], [0, 2, 1, 15]], intro: 'The Bible opens with God making everything good and making man and woman in his own image. Sin enters when they doubt God\'s word and eat the forbidden fruit. Even then God promises that the offspring of the woman will crush the serpent, the first hint of a Savior.',
      q: [['In whose image does Genesis say man and woman were made?', ['The angels', 'God', 'The animals', 'Adam alone'], 1], ['What did God say about all he had made on the sixth day?', ['It was very good', 'It needed more work', 'It was hidden', 'It was a test'], 0], ['Which creature tempted Eve?', ['A lion', 'A raven', 'The serpent', 'A fox'], 2]] },
    { id: 'l2', ic: '⭐', t: 'Abraham and the promise', ps: [[0, 11, 1, 3], [0, 14, 5, 6]], intro: 'God calls Abram to leave his home and promises land, descendants and a blessing for all the families of the earth. Abram believes, and God counts it to him as righteousness. This promise is the seed of everything that follows.',
      q: [['What did God promise Abram in Genesis 12?', ['Gold and power only', 'A great nation and blessing for all families of the earth', 'An easy life', 'A kingdom in Egypt'], 1], ['What did God show Abram to picture his many descendants?', ['The grains of sand', 'The stars of heaven', 'The sheep of the flock', 'The waves of the sea'], 1], ['What did God count Abram\'s faith as?', ['Weakness', 'Righteousness', 'A debt', 'A vow'], 1]] },
    { id: 'l3', ic: '🌊', t: 'The Exodus and the Passover', ps: [[1, 11, 21, 28], [1, 13, 21, 31]], intro: 'Israel is enslaved in Egypt. God sends Moses, the blood of the lamb on the doorposts saves the firstborn at the first Passover, and God parts the sea. Christians see the Passover lamb as a sign of Christ.',
      q: [['What marked the Israelite houses on Passover night?', ['The blood of a lamb on the doorposts', 'A red cloth', 'Salt', 'Oil'], 0], ['Who led Israel out of Egypt?', ['Joshua', 'Aaron alone', 'Moses', 'Samuel'], 2], ['What happened to the sea when Moses stretched out his hand?', ['It turned to wine', 'It divided and Israel crossed on dry ground', 'It froze', 'It rose over the people'], 1]] },
    { id: 'l4', ic: '📜', t: 'The covenant at Sinai', ps: [[1, 19, 1, 17]], intro: 'At Mount Sinai God makes Israel his own people and gives the Ten Commandments. The Law shows how to love God and neighbor: the first commandments are about God, the rest about our neighbor.',
      q: [['How many commandments did God give on the tablets?', ['Seven', 'Ten', 'Twelve', 'Twenty'], 1], ['What does the first commandment say?', ['Keep the Sabbath', 'Honor your parents', 'You shall have no other gods before me', 'You shall not steal'], 2], ['Which day is to be kept holy?', ['The Sabbath day', 'The new moon', 'The harvest day', 'The day of Passover'], 0]] },
    { id: 'l5', ic: '👑', t: 'David and the promised king', ps: [[8, 16, 45, 47], [9, 6, 8, 16]], intro: 'Samuel anoints David of Bethlehem, a shepherd boy, who defeats Goliath by trusting in the Lord. God then promises David that his throne will last forever. Christians read this as pointing to Jesus, the Son of David.',
      q: [['Whom did David defeat with a sling and a stone?', ['Saul', 'Goliath', 'Absalom', 'Pharaoh'], 1], ['What did God promise David in 2 Samuel 7?', ['His house and kingdom would be established forever', 'He would never be tempted', 'Israel would never fight again', 'He would live a thousand years'], 0], ['From which town did David come?', ['Nazareth', 'Bethlehem', 'Jericho', 'Hebron'], 1]] },
    { id: 'l6', ic: '📣', t: 'The prophets and the coming Messiah', ps: [[26, 8, 6, 7], [26, 52, 3, 6]], intro: 'God speaks through prophets such as Isaiah to warn his people and to promise a coming king and a suffering servant. Isaiah\'s words about a child born to us, and a servant wounded for our sins, are read by Christians as fulfilled in Jesus.',
      q: [['Which prophet wrote "to us a child is born, to us a son is given"?', ['Jeremiah', 'Isaiah', 'Hosea', 'Amos'], 1], ['Which title does Isaiah 9 give the promised child?', ['Prince of Peace', 'Lord of the Sea', 'King of Tyre', 'Judge of Israel'], 0], ['In Isaiah 53, for whose sins is the servant wounded?', ['His own', 'Our sins', 'Only the priests\'', 'The Gentiles\' alone'], 1]] },
    { id: 'l7', ic: '🏚️', t: 'Exile and the new covenant', ps: [[27, 30, 31, 34]], intro: 'Because Israel broke the covenant, Babylon destroys Jerusalem and carries the people into exile. Yet Jeremiah promises a new covenant, written not on stone but on the heart. At the Last Supper Jesus speaks of the new covenant in his blood.',
      q: [['Which empire carried Judah into exile?', ['Egypt', 'Babylon', 'Rome', 'Greece'], 1], ['Where will God write the new covenant?', ['On stone tablets', 'On their hearts', 'On the Temple wall', 'In the sky'], 1], ['Who said at the Last Supper, "This cup is the new covenant in my blood"?', ['Moses', 'Jesus', 'Paul', 'John the Baptist'], 1]] },
    { id: 'l8', ic: '👶', t: 'The Word becomes flesh', ps: [[48, 0, 26, 38], [49, 0, 1, 14]], intro: 'The angel Gabriel tells Mary she will bear the Son of the Most High, and she says yes. John\'s Gospel says the eternal Word became flesh and lived among us. This is the Incarnation.',
      q: [['Which angel announced the birth of Jesus to Mary?', ['Michael', 'Gabriel', 'Raphael', 'Uriel'], 1], ['What did Mary answer?', ['Let it be to me according to your word', 'I am not worthy, ask another', 'I cannot', 'Wait until Joseph returns'], 0], ['What does John 1 say the Word became?', ['A spirit', 'Flesh', 'Light only', 'A king'], 1]] },
    { id: 'l9', ic: '🏔️', t: 'Jesus teaches', ps: [[46, 4, 1, 12], [48, 14, 11, 24]], intro: 'Jesus teaches the crowds on a mountain and tells parables of mercy. The Beatitudes show the way of the kingdom, and the story of the prodigal son shows the Father\'s welcome.',
      q: [['What are the blessings at the start of the Sermon on the Mount called?', ['The Commandments', 'The Beatitudes', 'The Psalms', 'The Proverbs'], 1], ['Whom does the father in the parable of the prodigal son stand for?', ['The elder brother', 'God the Father', 'The devil', 'The Pharisees'], 1], ['What did the younger son ask his father for?', ['His share of the estate', 'A servant\'s job', 'A new name', 'Nothing'], 0]] },
    { id: 'l10', ic: '✝️', t: 'The Passion and the Resurrection', ps: [[48, 22, 33, 46], [48, 23, 1, 12]], intro: 'Jesus is crucified outside Jerusalem, forgiving those who crucify him and commending his spirit to the Father. On the first day of the week the women find the tomb empty. The Resurrection is the center of the Christian faith.',
      q: [['What did Jesus say about those who crucified him?', ['Father, forgive them', 'Curse them', 'Punish them', 'Remember them'], 0], ['Who went to the tomb on Sunday morning?', ['The soldiers', 'The women who had followed him', 'Pilate', 'The council'], 1], ['What did they find?', ['The stone rolled away and the tomb empty', 'The body guarded', 'Nothing changed', 'Angels asleep'], 0]] },
    { id: 'l11', ic: '🔥', t: 'Pentecost and the Church', ps: [[50, 1, 1, 13], [50, 1, 42, 47]], intro: 'Fifty days after Easter the Holy Spirit comes on the apostles as wind and tongues of fire. Peter preaches, thousands are baptized, and the first believers share prayer, teaching, the breaking of bread and their goods.',
      q: [['What appeared over the disciples at Pentecost?', ['Tongues like fire', 'A rainbow', 'A star', 'A cloud only'], 0], ['Who preached to the crowd?', ['Peter', 'Judas', 'John the Baptist', 'Stephen'], 0], ['What did the first believers devote themselves to?', ['The teaching of the apostles, fellowship, the breaking of bread and prayers', 'Trade', 'Travel', 'Politics'], 0]] },
    { id: 'l12', ic: '💖', t: 'Love and the new creation', ps: [[52, 12, 1, 13], [72, 20, 1, 5]], intro: 'Paul says that without love every gift is empty, and that love is the greatest of faith, hope and love. The Bible ends with a vision of a new heaven and a new earth where God wipes away every tear.',
      q: [['Which is the greatest of faith, hope and love?', ['Faith', 'Hope', 'Love', 'All are equal'], 2], ['What will God wipe away in the new creation?', ['Every tear', 'The sea', 'The stars', 'The names'], 0], ['Who says "Behold, I make all things new"?', ['Paul', 'The one seated on the throne', 'An angel', 'John the Baptist'], 1]] },
  ];

  /* ----- teaching logic (no page code) ----- */
  const norm = w => String(w || '').toLowerCase().replace(/[‘’]/g, '\'').replace(/[^a-z0-9']/g, '');
  const shuffle = (a, r) => { r = r || Math.random; a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; } return a; };
  const pick = (a, n, r) => shuffle(a, r).slice(0, n);
  /* a verse with some words taken out: level 1, 2, 3 hide about 20%, 40%, 60% of the longer words */
  function blanks(text, level, r) {
    const toks = String(text).replace(/—/g, '— ').replace(/\s+/g, ' ').trim().split(' '); let cand = []; toks.forEach((t, i) => { if (norm(t).length >= 4) cand.push(i); });
    if (cand.length < 2) { cand = []; toks.forEach((t, i) => { if (norm(t).length >= 3) cand.push(i); }); }      /* the longer words make the better blanks */
    const k = Math.max(1, Math.min(cand.length, Math.round(cand.length * [0.2, 0.4, 0.6][Math.max(0, Math.min(2, level - 1))]))), hide = new Set(pick(cand, k, r));
    const parts = toks.map((t, i) => hide.has(i) ? { blank: true, w: t, a: norm(t) } : { blank: false, w: t });
    return { parts, bank: shuffle(parts.filter(p => p.blank).map(p => p.a), r) };
  }
  /* typed from memory, word by word: which words of the original were found, in order */
  function grade(typed, original) {
    const dashes = x => String(x).replace(/[—–]/g, ' '), a = dashes(typed).split(/\s+/).map(norm).filter(Boolean), o = dashes(original).split(/\s+/).filter(Boolean), marks = []; let p = 0, ok = 0;
    for (const w of o) {
      const n = norm(w); if (!n) { marks.push(true); continue; }
      if (a[p] === n) { marks.push(true); p++; ok++; } else if (a[p + 1] === n) { marks.push(true); p += 2; ok++; } else marks.push(false);
    }
    const total = o.filter(w => norm(w)).length || 1; return { marks, score: ok / total, ok, total };
  }
  const DAYS = [0, 1, 2, 4, 8, 16];
  const nextBox = (box, good) => good ? Math.min(5, (box || 0) + 1) : 1;
  const dueAfter = (box, now) => now + DAYS[Math.max(1, Math.min(5, box))] * 86400000;
  /* "which book?" and "complete the verse": options built from the other books and the other verses */
  function whichBook(v, names, r) { const ot = v.b < 46, pool = names.map((n, i) => ({ n, i })).filter(x => (x.i < 46) === ot && x.i !== v.b).map(x => x.n); return { q: 'Which book is this verse from?', text: v.text, opts: shuffle([names[v.b]].concat(pick(pool, 3, r)), r), ans: names[v.b], ref: v.label }; }
  function completeVerse(v, pool, r) {
    const toks = v.text.split(/\s+/), seen = {}; toks.forEach(t => { seen[norm(t)] = (seen[norm(t)] || 0) + 1; });
    const cand = toks.map((t, i) => i).filter(i => norm(toks[i]).length >= 5 && seen[norm(toks[i])] === 1); if (!cand.length) return null;
    const i = pick(cand, 1, r)[0], ans = norm(toks[i]), others = []; pool.forEach(o => o.split(/\s+/).forEach(t => { const n = norm(t); if (n.length >= 5 && Math.abs(n.length - ans.length) <= 2 && n !== ans && !others.includes(n)) others.push(n); }));
    if (others.length < 3) return null;
    const shown = toks.map((t, j) => j === i ? t.replace(/[^\s.,;:!?"'()‘’“”-]+/, '_____') : t).join(' ');
    return { q: 'Which word is missing?', text: shown, opts: shuffle([ans].concat(pick(others, 3, r)), r), ans, ref: v.label };
  }
  return { GROUPS, BOOK, LESSONS, DAYS, norm, shuffle, pick, blanks, grade, nextBox, dueAfter, whichBook, completeVerse };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = Learn;

/* ----- the page ----- */
(() => {
  if (typeof window === 'undefined' || typeof A === 'undefined' || typeof document === 'undefined') return;      /* in Node (the tests) there is no page */
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const KEY = 'faith_learn', today = () => new Date().toISOString().slice(0, 10);
  const load = () => { let s = {}; try { s = JSON.parse(ls.get(KEY, '{}')) || {}; } catch (e) { } return Object.assign({ xp: 0, streak: 0, last: '', lessons: {}, verses: {}, quiz: { right: 0, total: 0 }, books: { right: 0, total: 0 } }, s); };
  const store = s => { try { ls.set(KEY, JSON.stringify(s)); } catch (e) { } };
  /* points: the first activity of a day moves the streak on */
  function award(pts, tweak) {
    const s = load(), t = today();
    if (s.last !== t) { const y = new Date(Date.now() - 864e5).toISOString().slice(0, 10); s.streak = s.last === y ? s.streak + 1 : 1; s.last = t; }
    s.xp += pts; if (tweak) tweak(s); store(s); return s;
  }
  const F = () => A.faith;
  const bibleNow = () => F().bible();
  const names = () => bibleNow().books.map(b => b.n);
  /* a verse by reference in the translation chosen in Spiritual (Psalm numbers follow the translation) */
  function verseByRef(ref) {
    const f = F(), pr = f.parseRef(ref), bb = bibleNow(); if (!pr) return null;
    if (pr.b === 20 && f.tr() !== 'dr') pr.c = Math.max(0, f.psConv(pr.c + 1, 'dr', 'web') - 1);
    const ch = bb.books[pr.b] && bb.books[pr.b].ch[pr.c], text = ch ? String(ch.v[pr.v - 1] || '').replace(/\s+/g, ' ').trim() : ''; if (!text) return null;
    return { b: pr.b, c: pr.c, v: pr.v, text, label: bb.books[pr.b].n + ' ' + (pr.c + 1) + ':' + pr.v, key: pr.b + '.' + pr.c + '.' + pr.v };
  }
  const famous = () => { const out = []; (window.FAITH && window.FAITH.VERSES || []).forEach(r => { try { const v = verseByRef(r); if (v && v.text.split(/\s+/).length >= 6) out.push(v); } catch (e) { } }); return out; };
  function passage(p) { const bb = bibleNow(), b = bb.books[p[0]], ch = b && b.ch[Math.min(p[1], b.ch.length - 1)]; if (!ch) return null; const out = []; for (let n = p[2]; n <= Math.min(p[3], ch.v.length); n++) if (ch.v[n - 1]) out.push({ n, t: String(ch.v[n - 1]).replace(/\s+/g, ' ').trim() }); return { label: b.n + ' ' + (Math.min(p[1], b.ch.length - 1) + 1) + ':' + p[2] + '-' + Math.min(p[3], ch.v.length), vs: out }; }

  let H = null, view = 'home', cur = null, mem = null;      /* the page host, the screen, and the activity in progress */
  const go = (v, c) => { view = v; cur = c == null ? null : c; draw(); const sc = H && H.closest('.scroll'); if (sc) sc.scrollTop = 0; };
  const bar = (n, of) => '<div style="height:8px;border-radius:5px;background:var(--line);overflow:hidden;margin:6px 0"><div style="width:' + Math.round(100 * n / Math.max(1, of)) + '%;height:100%;background:var(--acc)"></div></div>';
  const back = (to, label) => '<button class="ib" data-ln="go" data-v="' + (to || 'home') + '">← ' + esc(label || 'Learn') + '</button>';
  const opt = (i, t) => '<button class="ib ln-o" data-ln="ans" data-i="' + i + '" style="display:block;width:100%;text-align:left;margin:6px 0;padding:10px 12px">' + esc(t) + '</button>';

  function home() {
    const s = load(), now = Date.now(), due = Object.keys(s.verses).filter(k => s.verses[k].due <= now), done = Object.keys(s.lessons).length, lvl = Math.floor(s.xp / 100) + 1, learning = Object.keys(s.verses).length;
    const acc = s.quiz.total ? Math.round(100 * s.quiz.right / s.quiz.total) + '%' : 'not yet';
    return '<div class="fa-wrap"><div class="fa-card"><div class="row" style="gap:12px;align-items:center;flex-wrap:wrap"><div style="font-size:34px">🎓</div><div style="flex:1;min-width:220px"><b style="font-size:20px">Learn the Bible</b><div class="small mute">Short, hands-on lessons that use the Bible on this PC. Everything is offline.</div></div><div style="text-align:right"><b>Level ' + lvl + '</b> · ' + s.xp + ' points<div class="small mute">🔥 ' + s.streak + (s.streak === 1 ? ' day' : ' days') + ' in a row</div></div></div>' + bar(s.xp % 100, 100) +
      '<div class="small mute">Lessons done: ' + done + ' of 12 · verses you are learning: ' + learning + ' · quiz answers right: ' + acc + '</div></div>' +
      (due.length ? '<div class="fa-card" style="border-left:6px solid var(--acc)"><b>🔁 ' + due.length + (due.length === 1 ? ' verse is' : ' verses are') + ' ready to review today</b><div class="small mute" style="margin:2px 0 8px">Saying a verse again, just as it fades, is what makes it stay.</div><button class="pri" data-ln="go" data-v="review">Review now</button></div>' : '') +
      '<div class="row" style="gap:12px;flex-wrap:wrap">' +
      [['books', '📚', 'The 73 books', 'Meet every book by group, then test yourself: which group, what is it about, put them in order.'], ['lessons', '🧭', 'The story in 12 steps', 'From Creation to the new heaven and earth: a short lesson, the passage, three questions.'], ['pick', '🧠', 'Memorize a verse', 'Fill the blanks or type it from memory. Verses come back for review after 1, 2, 4, 8 and 16 days.'], ['quiz', '❓', 'Quick quiz', 'Which book is this verse in? Which word is missing? Ten questions a round.']].map(c => '<div class="fa-card" style="flex:1;min-width:240px;cursor:pointer" data-ln="go" data-v="' + c[0] + '"><div style="font-size:26px">' + c[1] + '</div><b>' + c[2] + '</b><div class="small mute" style="margin-top:4px">' + c[3] + '</div></div>').join('') + '</div>' +
      '<div class="fa-card small mute">Stuck on a passage? <button class="ib" data-ln="expert">Ask the Bible Expert</button> · Your points and streak stay in this browser. <button class="ib" data-ln="reset">Start over</button></div></div>';
  }

  /* ----- the books ----- */
  function books() {
    const nm = names(), g = cur == null ? -1 : cur;
    const tour = Learn.GROUPS.map((gn, gi) => { const ids = Learn.BOOK.map((b, i) => [b[0], i]).filter(x => x[0] === gi).map(x => x[1]); return '<details' + (gi === g ? ' open' : '') + ' style="margin-top:6px"><summary><b>' + esc(gn) + '</b> <span class="small mute">· ' + ids.length + ' books</span></summary>' + ids.map(i => '<div class="row" style="gap:8px;align-items:baseline;padding:4px 2px;border-bottom:1px solid var(--line)"><b style="min-width:140px">' + esc(nm[i]) + '</b><span class="small" style="flex:1">' + esc(Learn.BOOK[i][1]) + '</span><button class="ib" data-ln="read" data-b="' + i + '">Read</button></div>').join('') + '</details>'; }).join('');
    return '<div class="fa-wrap"><div class="row" style="gap:8px;margin-bottom:8px">' + back() + '<b style="font-size:18px">📚 The 73 books</b></div><div class="fa-card"><b>Test yourself</b><div class="row" style="gap:8px;flex-wrap:wrap;margin-top:8px"><button class="pri" data-ln="drill" data-k="group">Which group?</button><button class="pri" data-ln="drill" data-k="about">What is it about?</button><button class="pri" data-ln="drill" data-k="order">Put them in order</button></div></div><div class="fa-card"><b>The tour</b><div class="small mute">Old Testament: the Law, History, Wisdom and poetry, the Prophets. New Testament: the Gospels, Acts, the letters, Revelation.</div>' + tour + '</div></div>';
  }
  function drillQ() {
    const k = cur.k, nm = names(), r = Math.floor(Math.random() * 73);
    if (k === 'group') { const g = Learn.BOOK[r][0], opts = Learn.shuffle([g].concat(Learn.pick(Learn.GROUPS.map((x, i) => i).filter(i => i !== g), 3))); return { q: 'Which group does ' + nm[r] + ' belong to?', opts: opts.map(i => Learn.GROUPS[i]), ans: Learn.GROUPS[g], note: nm[r] + ': ' + Learn.BOOK[r][1] }; }
    if (k === 'about') { const ot = r < 46, pool = nm.map((n, i) => i).filter(i => (i < 46) === ot && i !== r); return { q: 'Which book is this?', text: Learn.BOOK[r][1], opts: Learn.shuffle([nm[r]].concat(Learn.pick(pool, 3).map(i => nm[i]))), ans: nm[r], note: nm[r] + ': ' + Learn.BOOK[r][1] }; }
    const start = Math.floor(Math.random() * 68), seq = [0, 1, 2, 3, 4].map(i => start + i); return { q: 'Put these books in the order they appear in the Bible. Tap them one by one.', order: seq, shuffled: Learn.shuffle(seq), ans: seq.map(i => nm[i]).join(', ') };
  }
  function drill() {
    const c = cur; if (!c.q) { c.q = drillQ(); c.n = (c.n || 0); c.picked = []; }
    const q = c.q, head = '<div class="fa-wrap"><div class="row" style="gap:8px;margin-bottom:8px">' + back('books', 'The books') + '<b>Question ' + (c.n + 1) + ' · ' + (c.right || 0) + ' right so far</b></div><div class="fa-card">';
    if (q.order) { const nm = names(); return head + '<b>' + esc(q.q) + '</b><div style="margin:10px 0;display:flex;flex-wrap:wrap;gap:8px">' + q.shuffled.map(i => '<button class="ib ln-b" data-ln="pickb" data-i="' + i + '"' + (c.picked.includes(i) ? ' disabled' : '') + '>' + esc(nm[i]) + '</button>').join('') + '</div><div class="small">Your order: <b>' + (c.picked.length ? esc(c.picked.map(i => nm[i]).join(' → ')) : '(tap the first book)') + '</b></div><div class="row" style="gap:8px;margin-top:10px"><button class="ib" data-ln="clearb">Clear</button><span class="sp"></span><button class="pri" data-ln="checkb"' + (c.picked.length === 5 ? '' : ' disabled') + '>Check</button></div><div id="lnfb"></div></div></div>'; }
    return head + '<b>' + esc(q.q) + '</b>' + (q.text ? '<div style="font-family:Georgia,serif;font-size:18px;margin:10px 0">' + esc(q.text) + '</div>' : '') + q.opts.map((t, i) => opt(i, t)).join('') + '<div id="lnfb"></div></div></div>';
  }
  function finish(ok, note, kind) {
    const fb = H.querySelector('#lnfb'); if (!fb) return; const c = cur;
    award(ok ? 5 : 1, s => { const t = kind === 'quiz' ? s.quiz : s.books; t.total++; if (ok) t.right++; }); if (ok) c.right = (c.right || 0) + 1;
    fb.innerHTML = '<div style="margin-top:10px;padding:10px;border-radius:8px;background:color-mix(in srgb,' + (ok ? 'var(--ok,#3a3)' : 'var(--bad,#c33)') + ' 18%,transparent)"><b>' + (ok ? 'Right! +5' : 'Not quite.') + '</b> ' + esc(note || '') + '</div><div class="row" style="margin-top:8px"><span class="sp"></span><button class="pri" data-ln="next">' + ((c.n + 1) >= (c.total || 10) ? 'Finish' : 'Next question') + '</button></div>';
  }

  /* ----- the story in 12 steps ----- */
  function lessons() {
    const s = load(); return '<div class="fa-wrap"><div class="row" style="gap:8px;margin-bottom:8px">' + back() + '<b style="font-size:18px">🧭 The story in 12 steps</b><span class="sp"></span><span class="small mute">' + Object.keys(s.lessons).length + ' of 12 done</span></div>' + bar(Object.keys(s.lessons).length, 12) +
      Learn.LESSONS.map((l, i) => '<div class="fa-card" style="cursor:pointer" data-ln="go" data-v="lesson" data-i="' + i + '"><div class="row" style="gap:12px;align-items:center"><div style="font-size:26px">' + l.ic + '</div><div style="flex:1"><b>' + (i + 1) + '. ' + esc(l.t) + '</b><div class="small mute">' + l.ps.map(p => { const x = passage(p); return x ? esc(x.label) : ''; }).filter(Boolean).join(' · ') + '</div></div><div>' + (s.lessons[l.id] != null ? '<span class="badge">✓ ' + s.lessons[l.id] + '/3</span>' : '') + '</div></div></div>').join('') + '</div>';
  }
  function lesson() {
    const l = Learn.LESSONS[cur.i], c = cur;
    if (c.step == null) c.step = 0;
    const read = '<div class="fa-card"><div style="font-size:26px">' + l.ic + '</div><b style="font-size:18px">' + esc(l.t) + '</b><p style="line-height:1.6">' + esc(l.intro) + '</p>' + l.ps.map(p => { const x = passage(p); return x ? '<div style="margin:10px 0;padding-left:12px;border-left:3px solid var(--acc)"><b>' + esc(x.label) + '</b> <span class="small mute">' + esc(F().trLabel ? F().trLabel() : (F().tr() === 'dr' ? 'Douay-Rheims' : 'WEB')) + '</span><div style="font-family:Georgia,serif;line-height:1.65;margin-top:4px">' + x.vs.map(v => '<sup class="small mute">' + v.n + '</sup>' + esc(v.t)).join(' ') + '</div></div>' : ''; }).join('') + '<div class="row" style="gap:8px;margin-top:10px"><button class="ib" data-ln="go" data-v="lessons">← All lessons</button><span class="sp"></span><button class="pri" data-ln="startq">Take the 3 questions</button></div></div>';
    if (c.step === 0) return '<div class="fa-wrap">' + read + '</div>';
    const q = l.q[c.step - 1]; if (!q) return '<div class="fa-wrap"><div class="fa-card" style="text-align:center"><div style="font-size:40px">' + (c.right === 3 ? '🏆' : '👍') + '</div><b style="font-size:20px">' + c.right + ' of 3 right</b><div class="small mute" style="margin:6px 0 12px">+' + (10 + c.right * 5) + ' points</div><div class="row" style="gap:8px;justify-content:center"><button class="ib" data-ln="go" data-v="lesson" data-i="' + c.i + '">Read it again</button>' + (c.i < 11 ? '<button class="pri" data-ln="go" data-v="lesson" data-i="' + (c.i + 1) + '">Next lesson</button>' : '') + '<button class="ib" data-ln="go" data-v="lessons">All lessons</button></div></div></div>';
    if (!c.o) c.o = Learn.shuffle(q[1].map((t, i) => i));
    return '<div class="fa-wrap"><div class="fa-card"><div class="small mute">' + esc(l.t) + ' · question ' + c.step + ' of 3</div><b style="font-size:17px">' + esc(q[0]) + '</b>' + c.o.map(i => opt(i, q[1][i])).join('') + '<div id="lnfb"></div></div></div>';
  }

  /* ----- memorize ----- */
  function pick() {
    const f = famous(), mine = (() => { try { return JSON.parse(ls.get('faith_bm', '[]')); } catch (e) { return []; } })(), s = load();
    const row = v => '<div class="row" style="gap:8px;align-items:center;padding:6px 2px;border-bottom:1px solid var(--line)"><b style="min-width:130px">' + esc(v.label) + '</b><span class="small" style="flex:1">' + esc(v.text.slice(0, 90)) + (v.text.length > 90 ? '…' : '') + '</span>' + (s.verses[v.key] ? '<span class="badge" title="Box ' + s.verses[v.key].box + ' of 5">box ' + s.verses[v.key].box + '</span>' : '') + '<button class="ib" data-ln="mem" data-k="' + v.key + '">Learn</button></div>';
    const saved = mine.map(x => { const [b, c, vn] = String(x.k).split('.').map(Number); const bb = bibleNow(), ch = bb.books[b] && bb.books[b].ch[c], t = ch ? String(ch.v[vn - 1] || '') : ''; return t ? { b, c, v: vn, text: t.replace(/\s+/g, ' ').trim(), label: bb.books[b].n + ' ' + (c + 1) + ':' + vn, key: x.k } : null; }).filter(Boolean).slice(-12).reverse();
    return '<div class="fa-wrap"><div class="row" style="gap:8px;margin-bottom:8px">' + back() + '<b style="font-size:18px">🧠 Memorize a verse</b></div>' + (saved.length ? '<div class="fa-card"><b>⭐ From your saved verses</b>' + saved.map(row).join('') + '</div>' : '') + '<div class="fa-card"><b>Well-loved verses</b><div class="small mute" style="margin-bottom:4px">Pick one. You start with a few blanks, then take more out, then say it from memory.</div>' + f.map(row).join('') + '</div></div>';
  }
  const verseOfKey = k => { const [b, c, vn] = String(k).split('.').map(Number), bb = bibleNow(), ch = bb.books[b] && bb.books[b].ch[c], t = ch ? String(ch.v[vn - 1] || '').replace(/\s+/g, ' ').trim() : ''; return t ? { b, c, v: vn, text: t, label: bb.books[b].n + ' ' + (c + 1) + ':' + vn, key: k } : null; };
  function memorize() {
    const m = cur, v = m.v, s = load(), st = s.verses[v.key];
    if (!m.level) m.level = 1;
    const lv = m.level, head = '<div class="fa-wrap"><div class="row" style="gap:8px;margin-bottom:8px">' + back(m.from || 'pick', m.from === 'review' ? 'Review' : 'Verses') + '<b style="font-size:18px">' + esc(v.label) + '</b><span class="small mute">' + esc(F().trLabel ? F().trLabel() : (F().tr() === 'dr' ? 'Douay-Rheims' : 'WEB')) + '</span><span class="sp"></span>' + [1, 2, 3, 4].map(n => '<button class="ib' + (n === lv ? ' on' : '') + '" data-ln="level" data-n="' + n + '" title="' + ['A few blanks', 'Half hidden', 'Mostly hidden', 'From memory'][n - 1] + '">' + n + '</button>').join('') + '</div><div class="fa-card">';
    if (lv < 4) {
      if (!m.bl || m.bl.level !== lv) { m.bl = Learn.blanks(v.text, lv); m.bl.level = lv; }
      const bk = m.bl.bank; let bi = -1;
      return head + '<div class="small mute">Level ' + lv + ': choose the missing words.</div><div style="font-family:Georgia,serif;font-size:19px;line-height:2.2;margin:8px 0">&ldquo;' + m.bl.parts.map(p => { if (!p.blank) return esc(p.w) + ' '; bi++; return '<select data-ln="blank" data-a="' + esc(p.a) + '" style="font-size:16px;margin:0 2px"><option value="">…</option>' + bk.map(w => '<option>' + esc(w) + '</option>').join('') + '</select>' + esc((p.w.match(/[.,;:!?”"’')]+$/) || [''])[0]) + ' '; }).join('') + '&rdquo;</div><div class="row" style="gap:8px"><button class="ib" data-ln="peek">Show it</button><span class="sp"></span><button class="pri" data-ln="checkm">Check</button></div><div id="lnfb"></div></div></div>';
    }
    return head + '<div class="small mute">Level 4: type the verse from memory. Capitals and punctuation do not matter.</div><textarea id="lntype" rows="4" style="width:100%;margin:8px 0;font-family:Georgia,serif;font-size:17px" placeholder="Type ' + esc(v.label) + ' here…"></textarea><div class="row" style="gap:8px"><button class="ib" data-ln="hint">First letters</button><button class="ib" data-ln="peek">Show it</button><span class="sp"></span><button class="pri" data-ln="checkm">Check</button></div><div id="lnfb"></div></div></div>';
  }
  function reviewEmpty() {
    return '<div class="fa-wrap"><div class="fa-card" style="text-align:center"><div style="font-size:40px">🌟</div><b>Nothing to review right now.</b><div class="small mute" style="margin:6px 0 10px">Come back tomorrow, or learn a new verse.</div><button class="pri" data-ln="go" data-v="pick">Memorize a verse</button> <button class="ib" data-ln="go" data-v="home">Back</button></div></div>';
  }

  /* ----- quick quiz ----- */
  function quiz() {
    const c = cur, f = famous(); if (f.length < 8) return '<div class="fa-wrap"><div class="fa-card">The verses are not loaded yet. Open Spiritual › Bible once, then come back.</div></div>';
    if (!c.q) {
      const v = f[Math.floor(Math.random() * f.length)], mk = Math.random() < 0.5 ? Learn.completeVerse(v, f.map(x => x.text)) : null; c.q = mk || Learn.whichBook(v, names()); c.n = c.n || 0; c.total = 10;
    }
    const q = c.q; return '<div class="fa-wrap"><div class="row" style="gap:8px;margin-bottom:8px">' + back() + '<b>Question ' + (c.n + 1) + ' of 10 · ' + (c.right || 0) + ' right</b></div>' + bar(c.n, 10) + '<div class="fa-card"><b>' + esc(q.q) + '</b><div style="font-family:Georgia,serif;font-size:18px;line-height:1.6;margin:10px 0">&ldquo;' + esc(q.text) + '&rdquo;</div>' + q.opts.map((t, i) => opt(i, t)).join('') + '<div id="lnfb"></div></div></div>';
  }

  function draw() {
    if (!H) return; let h;
    try { h = ({ home, books, drill, lessons, lesson, pick, mem: memorize, reviewempty: reviewEmpty, quiz })[view](); } catch (e) { h = '<div class="mute">Could not show this page: ' + esc(e.message) + '</div>'; }
    H.innerHTML = h;
  }

  async function onClick(e) {
    const el = e.target.closest('[data-ln]'); if (!el || !H || !H.contains(el)) return; const k = el.dataset.ln, c = cur;
    if (k === 'go') { const v = el.dataset.v; if (v === 'lesson') return go('lesson', { i: +el.dataset.i });
      if (v === 'review') { const s = load(), now = Date.now(), key = Object.keys(s.verses).filter(x => s.verses[x].due <= now).sort((a, b) => s.verses[a].due - s.verses[b].due).find(x => verseOfKey(x)); return key ? go('mem', { v: verseOfKey(key), level: 4, from: 'review' }) : go('reviewempty'); } if (v === 'quiz') return go('quiz', { n: 0, right: 0 }); return go(v); }
    if (k === 'expert') { if (F().expert) F().expert(); return; }
    if (k === 'reset') { if ((await A.confirm('Clear your points, streak, lessons and verses in Learn?'))) { store({}); go('home'); } return; }
    if (k === 'read') { F().openBible(+el.dataset.b, 0, 1); return; }
    if (k === 'drill') return go('drill', { k: el.dataset.k, n: 0, right: 0, total: 10 });
    if (k === 'pickb') { c.picked.push(+el.dataset.i); return draw(); }
    if (k === 'clearb') { c.picked = []; return draw(); }
    if (k === 'checkb') { const ok = c.picked.join() === c.q.order.join(); H.querySelectorAll('[data-ln=pickb],[data-ln=clearb],[data-ln=checkb]').forEach(b => { b.disabled = true; }); return finish(ok, ok ? '' : 'The order is: ' + c.q.ans + '.'); }
    if (k === 'ans') {
      const i = +el.dataset.i; H.querySelectorAll('.ln-o').forEach(b => { b.disabled = true; });
      if (view === 'lesson') { const q = Learn.LESSONS[c.i].q[c.step - 1], ok = i === q[2]; el.style.outline = '2px solid ' + (ok ? 'var(--ok,#3a3)' : 'var(--bad,#c33)'); if (!ok) { const r = H.querySelector('.ln-o[data-i="' + q[2] + '"]'); if (r) r.style.outline = '2px solid var(--ok,#3a3)'; } if (ok) c.right = (c.right || 0) + 1; const fb = H.querySelector('#lnfb'); fb.innerHTML = '<div style="margin-top:10px"><b>' + (ok ? 'Right!' : 'Not quite.') + '</b></div><div class="row" style="margin-top:8px"><span class="sp"></span><button class="pri" data-ln="lnext">' + (c.step >= 3 ? 'Finish' : 'Next question') + '</button></div>'; return; }
      const q = c.q, ok = q.opts[i] === q.ans; el.style.outline = '2px solid ' + (ok ? 'var(--ok,#3a3)' : 'var(--bad,#c33)'); if (!ok) H.querySelectorAll('.ln-o').forEach(b => { if (b.textContent === q.ans) b.style.outline = '2px solid var(--ok,#3a3)'; });
      return finish(ok, (ok ? '' : 'It is ' + q.ans + '. ') + (q.ref ? q.ref + '.' : (q.note || '')), view === 'quiz' ? 'quiz' : 'books');
    }
    if (k === 'next') { c.n++; if (c.n >= (c.total || 10)) { const r = c.right || 0; H.innerHTML = '<div class="fa-wrap"><div class="fa-card" style="text-align:center"><div style="font-size:40px">' + (r >= 8 ? '🏆' : r >= 5 ? '👍' : '💪') + '</div><b style="font-size:20px">' + r + ' of ' + (c.total || 10) + ' right</b><div class="row" style="gap:8px;justify-content:center;margin-top:12px"><button class="pri" data-ln="' + (view === 'quiz' ? 'again' : 'drillagain') + '">Another round</button><button class="ib" data-ln="go" data-v="' + (view === 'quiz' ? 'home' : 'books') + '">Done</button></div></div></div>'; award(r >= 8 ? 10 : 0); return; } c.q = null; return draw(); }
    if (k === 'again') return go('quiz', { n: 0, right: 0 });
    if (k === 'drillagain') return go('drill', { k: c.k, n: 0, right: 0, total: 10 });
    if (k === 'startq') { c.step = 1; c.right = 0; c.o = null; return draw(); }
    if (k === 'lnext') { if (c.step >= 3) { const l = Learn.LESSONS[c.i]; award(10 + c.right * 5, s => { s.lessons[l.id] = Math.max(s.lessons[l.id] || 0, c.right); }); } c.step++; c.o = null; return draw(); }
    if (k === 'mem') { const v = verseOfKey(el.dataset.k); if (v) go('mem', { v, level: (load().verses[v.key] ? 4 : 1), from: 'pick' }); return; }
    if (k === 'level') { c.level = +el.dataset.n; c.bl = null; return draw(); }
    if (k === 'peek') { const fb = H.querySelector('#lnfb'); fb.innerHTML = '<div style="margin-top:10px;font-family:Georgia,serif;font-size:18px">&ldquo;' + esc(c.v.text) + '&rdquo;</div>'; return; }
    if (k === 'hint') { const ta = H.querySelector('#lntype'), w = c.v.text.split(/\s+/); ta.value = ta.value.trim() ? ta.value : w.map(x => x[0]).join(' '); ta.focus(); return; }
    if (k === 'checkm') {
      let ok, msg = '';
      if (c.level < 4) { const sel = [...H.querySelectorAll('select[data-ln=blank]')]; sel.forEach(s => { const good = Learn.norm(s.value) === s.dataset.a; s.style.outline = '2px solid ' + (good ? 'var(--ok,#3a3)' : 'var(--bad,#c33)'); }); const right = sel.filter(s => Learn.norm(s.value) === s.dataset.a).length; ok = right === sel.length; msg = right + ' of ' + sel.length + ' words right.'; }
      else { const g = Learn.grade(H.querySelector('#lntype').value, c.v.text); ok = g.score >= 0.9; msg = Math.round(g.score * 100) + '% of the words.'; const parts = c.v.text.split(/\s+/); H.querySelector('#lnfb').dataset.shown = '1'; msg += ' <div style="font-family:Georgia,serif;font-size:17px;margin-top:6px">' + parts.map((w, i) => '<span style="' + (g.marks[i] ? '' : 'color:var(--bad,#c33);font-weight:700') + '">' + esc(w) + '</span>').join(' ') + '</div>'; }
      { const s = load(), rec = s.verses[c.v.key]; if (c.level >= 3 || rec) { const box = Learn.nextBox(rec && rec.box, ok); s.verses[c.v.key] = { box, due: Learn.dueAfter(box, Date.now()) }; store(s); } award(ok ? 10 : 2); }
      const nl = ok && c.level < 4 ? c.level + 1 : c.level;
      H.querySelector('#lnfb').innerHTML = '<div style="margin-top:10px;padding:10px;border-radius:8px;background:color-mix(in srgb,' + (ok ? 'var(--ok,#3a3)' : 'var(--bad,#c33)') + ' 18%,transparent)"><b>' + (ok ? 'Well done!' : 'Keep going.') + '</b> ' + msg + '</div><div class="row" style="margin-top:8px;gap:8px"><span class="sp"></span>' + (c.from === 'review' ? '<button class="pri" data-ln="go" data-v="review">' + (ok ? 'Next verse' : 'Done for now') + '</button>' : '<button class="ib" data-ln="level" data-n="' + c.level + '">Try again</button>' + (ok && c.level < 4 ? '<button class="pri" data-ln="level" data-n="' + nl + '">Next level</button>' : '<button class="pri" data-ln="go" data-v="pick">Pick another verse</button>')) + '</div>';
      return;
    }
  }

  A.faithLearn = {
    render: async host => { H = host; if (!host._lnBound) { host.addEventListener('click', onClick); host._lnBound = true; } try { await F().getBible(); } catch (e) { } if (view === 'mem' && !cur) view = 'home'; draw(); },
    due: () => { const s = load(), now = Date.now(); return Object.keys(s.verses).filter(k => s.verses[k].due <= now).length; },
  };
})();

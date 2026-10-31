// The Chess Community: the opponents, legends, club regulars and buddies all hang out in group chats.
// They keep talking when you are not there. Step in, read back, or join the conversation.
(() => {
  const UI = window.ChessUI; if (!UI || !A.community) return;
  const arr = x => x == null ? [] : [].concat(x), slug = n => A.chars.slug(n);
  const NATIVES = [
    ['Marta', '🇵🇱', 'f', 'Club champion, endgame nerd', 'Quietly crushes people in rook endings and loves telling you about it afterwards.', 'a precise, dry-humoured endgame specialist who gets excited about opposition and zugzwang'],
    ['Jamal', '🇺🇸', 'm', 'Blitz addict', 'Plays two hundred bullet games a week and calls it rest.', 'fast-talking, funny, competitive, always has a hot take about time controls'],
    ['Priya', '🇮🇳', 'f', 'Puzzle fanatic', 'Wakes up and does ten puzzles before breakfast.', 'cheerful, enthusiastic about tactics, always sharing the puzzle she just solved'],
    ['Lars', '🇸🇪', 'm', 'Opening theorist', 'Has a spreadsheet for every opening and an opinion about every gambit.', 'thoughtful, a bit nerdy, loves obscure opening lines and gets carried away'],
    ['Chen', '🇨🇳', 'm', 'Quiet strategist', 'Rarely speaks, and when he does everyone listens.', 'calm and brief, speaks rarely but with insight, a little shy'],
    ['Beatriz', '🇧🇷', 'f', 'Attacking player', 'Sacrifices first and calculates later.', 'bold, warm and dramatic, loves a king hunt and big sacrifices'],
    ['Omar', '🇪🇬', 'm', 'History buff', 'Knows the story behind every famous game.', 'a gentle storyteller who loves chess history and anecdotes'],
    ['Sakura', '🇯🇵', 'f', 'Mini-game lover', 'Prefers weird variants and tiny boards to normal chess.', 'playful, curious about variants like Atomic and Racing Kings'],
    ['Declan', '🇮🇪', 'm', 'Club joker', 'Treats every blunder as material for a story.', 'a cheeky joker who teases friends kindly and tells tall tales'],
    ['Hana', '🇰🇷', 'f', 'Junior coach', 'Teaches kids on weekends and is shockingly patient.', 'patient, encouraging, loves helping beginners improve'],
    ['Mateo', '🇦🇷', 'm', 'Chess streamer', 'Talks to an imaginary audience while analysing.', 'upbeat showman who narrates everything like a stream and loves tournaments'],
    ['Greta', '🇩🇪', 'f', 'Retired teacher', 'Plays slowly, scolds gently, never resigns.', 'warm, a little stern, loves a long careful game and a cup of tea']
  ].map(r => ({ id: 'com:' + slug(r[0]), name: r[0], em: r[1], g: r[2], title: r[3] + ', about ' + (1300 + (A.community.hash(r[0]) % 600)), bio: r[4], style: r[5], lines: { chat: [], hi: [] }, voice: {} }));
  const LEG_LINES = ['Every game teaches something, even the ones you lose.', 'The position speaks, if you listen.', 'I always preferred the open game.', 'Patience is a weapon too.', 'Ah, that reminds me of a game I once played.', 'Young players today have such tools. We had only our minds.'];
  const OPENINGS = ['the Sicilian', 'the Queen\'s Gambit', 'the King\'s Indian', 'the London System', 'the Italian Game', 'the Caro-Kann', 'the French Defence', 'the Ruy Lopez', 'the Scandinavian', 'the English Opening', 'the Vienna Gambit', 'the Dutch Defence'];
  const TOPICS = {
    lobby: ['Anyone up for a quick game tonight?', 'Long day. What did I miss in here?', 'Hot take: {opening} is overrated. Fight me.', 'Does anybody else play better after coffee, or is that just me?', 'Who is going to the next club tournament?', '{player}, did you ever finish that game from yesterday?', 'Good morning, chess people. Or good evening, depending where you are.', 'I just got my first win in a week. Let me have this.'],
    openings: ['I have been trying {opening} lately and I keep walking into the same trap.', 'Real question: do you memorise lines or learn the ideas?', 'Anyone have a good answer to the Scandinavian? I keep getting it.', '{opening} is just solid. Nothing flashy, and that is why it works.', 'Sacrificing a pawn for the initiative is fine if you know what comes next.', '{player}, what do you play against 1.e4?', 'I swear every opening book disagrees with every other opening book.'],
    endgame: ['Rook endings are the real test of a player.', 'King activity! In the endgame the king is a fighting piece.', 'I drew a won position again. Opposition got me.', 'Philidor position or Lucena? Pick the one you can actually remember.', 'Never underestimate a good bishop against a bad knight.', 'Pawn races always look closer than they are.', 'Zugzwang is the most beautiful word in chess.'],
    blunder: ['I hung my queen in a totally equal position. Please enjoy.', 'Confession: I forgot en passant exists. Again.', 'Blunder of the week goes to... me. Moved the right piece to the wrong square.', 'You know that sinking feeling right after you let go of the piece? Yes.', 'I was winning. I want that on record.', 'Missed a mate in one. In ONE.', '{player}, remember when you blundered a rook and just laughed? Respect.'],
    legends: ['I sometimes wonder what the old masters would think of modern engines.', 'Great games were often decided by courage more than calculation.', 'Do you prefer the romantic style or the modern positional style?', 'The chess clock changed everything, did it not?', 'Which game of the past would you most like to have watched?', 'I always enjoyed the quiet strength of a well-placed pawn.', 'Young players today study more than we ever dreamed. Impressive.'],
    pets: ['Does anyone else get hungry looking at the board? Those pawns look like snacks.', 'I tried to teach my friend the horsey move and it went... fine.', 'Beep boop. I mean, hello!', 'Nap time or one more game? Tough one.', 'Everyone is so serious about chess. It is just a very tiny war with wooden pieces.', 'Anyone else just move randomly and hope for the best?', '{player}, I like your style. Do you take treats?'],
    tournament: ['Rapid or classical for the next event? I vote rapid.', 'Anyone prepared for the Swiss this weekend?', 'Pairings are out and of course I got the top seed in round one.', 'Tournament tip: eat something. Tired players hang pieces.', 'Last round nerves are real. How do you calm down?', 'Who is going to win it all this time?', 'Blitz playoffs are chaos, and I love chaos.'],
    off: ['Okay but what is everyone listening to while they play?', 'Weather is awful here. Perfect chess weather.', 'Recommend me a good book. Not chess. Okay, maybe a chess one.', 'Anyone else dream in algebraic notation?', 'I learned something new about openings today and I cannot stop thinking about it.', 'Best snack for a long game? Go.', 'Tell me one non-chess thing you are good at.'],
    poker: ['Who is up for a hand or two tonight?', 'I folded the best hand of my life. Do not ask.', 'Never bluff a chess player. They see it coming.', 'Pocket aces again. And of course someone called.', 'The river card is cruel and I love it.', 'Which is harder, reading a board or reading a face?', 'Chips and chess: same game, different clock.'],
    friends: ['Good to see everyone here. Who has a game going?', 'I beat a friend of a friend today. Do not tell them.', 'Anyone fancy a friendly game tonight?', 'We should start a club tournament among ourselves.', 'I tried a new opening and it actually worked.', 'Remember when we all stayed up for that long blitz marathon?', '{player}, how did your last game go?'],
    world: ['Greetings from the other side of the world! What time is it there?', 'Anyone else playing chess at ridiculous hours?', 'Just joined a new club, they are so friendly.', 'My rating went up ten points. I am unstoppable (for today).', 'Which opening do you trust when you are tired?', 'The lobby is lively today.', 'I lost on time again. The clock is not my friend.'],
    career: ['Rising through the ranks takes patience and a good coach.', 'Training plans matter more than talent. Prove me wrong.', 'Contracts, events, travel: being a pro is a lot of admin.', 'How do you balance study with actual games?', 'The best coaches ask questions more than they give answers.', 'Who is the one to watch this season?', 'Sponsors want results, coaches want growth. Choose wisely.'],
    any: ['Quiet in here today.', 'Good game, everyone.']
  };
  const FOLLOW = {
    lobby: ['What is everyone playing today?', 'Anyone around for a game later?', 'I need a new opening to try. Suggestions?', 'This chat is the best part of my day.', 'Who is on the board right now?', '{player}, you have been quiet. Everything alright?'],
    openings: ['Have you tried {opening} yet? It suits you.', 'I lose with {opening} more than I win, honestly.', 'Does {opening} still hold up against the engines?', 'The trap in {opening} gets me every time.', 'I wish I had learned {opening} years ago.'],
    endgame: ['Rook behind the passed pawn, always.', 'Activate the king, people!', 'That ending is a draw with best play, I am fairly sure.', 'Opposition is everything here.', 'I think the bishops of opposite colours are drawish, but not always.'],
    blunder: ['It happens to the best of us. Mostly to me.', 'I once resigned in a position that was winning.', 'We have all been there, {p}.', 'I only noticed after I pressed the clock.', 'That is why we double-check every move. In theory.'],
    legends: ['In my day we adjourned games overnight.', 'A beautiful combination is worth a hundred quiet moves.', 'Preparation matters, but so does nerve.', 'Study the endgame, young ones. It is where games are truly settled.', 'It is the ideas that last, not the results.'],
    pets: ['Do pawns like being pushed around?', 'I would like a snack with my checkmate.', 'Beep. I mean, that is nice.', 'I lost a game because I got distracted by a butterfly.', 'Chess is just very slow hide and seek.'],
    tournament: ['Time management is half the battle.', 'Do you prepare openings for specific opponents?', 'Last year I lost on time in a winning position.', 'The coffee at these events is terrible and I love it.', 'Round three is always where it gets serious.'],
    poker: ['Do you play the player or the cards?', 'Position is everything. At the board and at the table.', 'Folding is a skill, same as resigning gracefully.', 'I like a good bluff almost as much as a good sacrifice.'],
    friends: ['Let us all play a team event soon.', 'We should make this a regular thing.', 'Good friends make good sparring partners.', 'I will bring snacks next time.'],
    world: ['It is evening here, perfect for a long game.', 'The world is small when you play chess.', 'Every country has a favourite opening, I swear.', 'Hello from the other timezone!'],
    career: ['A good plan beats good luck.', 'Rest days are training days too.', 'Results follow habits.', 'Ask your agent about the next event.'],
    off: ['Tea or coffee while you play?', 'I have been walking more. Helps me think.', 'Music with lyrics or without while you play?', 'Anyone watching anything good lately?', 'Rainy days are made for long games.']
  };
  const CH = [
    { id: 'lobby', name: 'lobby', em: '💬', topic: 'general chat for everyone', kind: 'lobby', fn: all => all.filter(i => !/^(bud|ppl|net|coach|agent|pk):/.test(i)) },
    { id: 'openings', name: 'openings', em: '📖', topic: 'theory, traps and gambits', kind: 'openings', ms: ['lars', 'chen', 'beatriz', 'morphy', 'steinitz', 'tal', 'sir-reginald', 'isla', 'detective-hawk', 'ada', 'priya', 'omar'] },
    { id: 'endgame', name: 'endgame-café', em: '🏁', topic: 'rooks, kings and patience', kind: 'endgame', ms: ['marta', 'greta', 'capablanca', 'petrosian', 'viktor-the-stoic', 'ada', 'old-titan', 'chen', 'sensei-kenji'] },
    { id: 'blunders', name: 'blunder-corner', em: '🙈', topic: 'confess your worst moves', kind: 'blunder', ms: ['pip', 'goldie', 'captain-barnacle', 'gran-maude', 'dexter-the-dino', 'professor-plink', 'zara', 'jamal', 'declan', 'priya'] },
    { id: 'legends', name: 'legends-lounge', em: '👑', topic: 'the old masters talk shop', kind: 'legends', ms: ['morphy', 'steinitz', 'lasker', 'capablanca', 'alekhine', 'botvinnik', 'tal', 'petrosian', 'fischer', 'omar', 'the-oracle', 'old-titan'] },
    { id: 'pets', name: 'pet-corner', em: '🐾', topic: 'animals, robots and buddies', kind: 'pets', ms: ['pip', 'goldie', 'dexter-the-dino', 'isla', 'ada', 'moundshroud-prime', 'nova', 'sakura'], buds: 1 },
    { id: 'tournaments', name: 'tournament-talk', em: '🏟', topic: 'events, pairings, nerves', kind: 'tournament', ms: ['mateo', 'jamal', 'coach-bolt', 'baron-von-blitz', 'zara', 'hana', 'moundshroud-prime', 'madame-rook', 'beatriz', 'greta'] },
    { id: 'poker', name: 'poker-room', em: '🃏', topic: 'cards, chips and bluffs', kind: 'poker', fn: (all, pre, f) => pre('pk:').concat(['zara', 'mateo', 'jamal', 'declan', 'coach-bolt', 'madame-rook', 'tal'].map(f)) },
    { id: 'friends', name: 'friends-hub', em: '🤝', topic: 'your friends and their friends', kind: 'friends', fn: (all, pre, f) => { const s = UI.socialPeople && UI.socialPeople(), fr = ((s && s.friends) || []).map(id => 'ppl:' + id).filter(i => all.includes(i)); return (fr.length >= 2 ? fr : pre('ppl:').slice(0, 8)).concat(['hana', 'greta', 'declan'].map(f)); } },
    { id: 'world', name: 'world-lounge', em: '🌍', topic: 'players from every corner of the site', kind: 'world', fn: (all, pre) => pre('ppl:').concat(pre('net:')) },
    { id: 'career', name: 'career-corner', em: '🏆', topic: 'coaches, agents and rising stars', kind: 'career', fn: (all, pre, f) => pre('coach:').concat(pre('agent:'), ['hana', 'coach-bolt', 'greta', 'mateo'].map(f)) },
    { id: 'off', name: 'off-board', em: '☕', topic: 'everything except chess (mostly)', kind: 'off', ms: ['luna', 'nova', 'sensei-kenji', 'detective-hawk', 'sir-reginald', 'declan', 'greta', 'marta', 'omar', 'sakura', 'mateo', 'hana', 'the-oracle'] }
  ];
  const cast = () => {
    const out = NATIVES.slice();
    try { (window.ChessBots ? ChessBots.R : []).forEach(b => out.push({ id: 'bot:' + slug(b.n), name: b.n, em: b.i, title: b.t, bio: b.bio, style: b.st, lines: { chat: arr(b.L.chat), hi: arr(b.L.hi) } })); } catch (e) { }
    try { (UI.careerLegends || []).forEach(l => out.push({ id: 'leg:' + l.id, name: l.n, em: l.em, title: 'Legend of chess (' + l.born + ')', bio: l.bio, style: 'a dramatized portrayal of ' + l.n + ': ' + l.style + '. Speaks with dignity and the wisdom of long experience.', lines: { chat: LEG_LINES } })); } catch (e) { }
    try { A.companion.buddies().forEach(b => out.push({ id: 'bud:' + slug(b.n), name: b.n, em: b.e, title: 'Moundshroud buddy', bio: 'A small animated companion from the corner of Moundshroud who loves hanging out with chess people.', style: 'cheerful, curious and playful, a bit of a show-off', lines: { chat: ['This is fun!', 'Hee hee!', 'I love it here.'] } })); } catch (e) { }
    try { const sp = window.ChessSpecial; if (sp) Object.values(sp).forEach(b => { if (b && b.n) out.push({ id: 'bot:' + slug(b.n), name: b.n, em: b.i, title: b.t, bio: b.bio, style: b.st, lines: { chat: arr(b.L && b.L.chat), hi: arr(b.L && b.L.hi) } }); }); } catch (e) { }
    try { (A.pokerRoster || []).forEach(r => out.push({ id: 'pk:' + r.id, name: r.n, em: r.em, title: r.t + ' (poker regular)', bio: r.bio, style: r.st, lines: { chat: arr(r.L && r.L.idle), hi: arr(r.L && r.L.hi) } })); } catch (e) { }
    try { const sp2 = UI.socialPeople && UI.socialPeople(); ((sp2 && sp2.people) || []).forEach(p => out.push({ id: 'ppl:' + p.id, name: p.name, em: p.flag, title: 'Chess player, about ' + p.rating + (p.country ? ', ' + p.country : ''), bio: p.bio, style: 'a friendly chess club player' + (p.fav ? ' who loves ' + p.fav : ''), lines: { chat: [] } })); } catch (e) { }
    try { (UI.careerCast ? UI.careerCast() : []).forEach(c => out.push(c)); } catch (e) { }
    return out;
  };
  const castKey = () => { let k = ''; try { const s = UI.socialPeople && UI.socialPeople(); k += (s && s.people ? s.people.length : 0) + ':' + (s && s.friends ? s.friends.length : 0); k += ':' + (ls.get('chcareers', '') || '').length; k += ':' + (A.pokerRoster ? A.pokerRoster.length : 0) + ':' + (window.ChessSpecial ? 1 : 0); } catch (e) { } return k; };
  const byName = (ids) => { const have = {}; cast().forEach(c => { have[c.id] = 1; }); return ids; };
  const members = ch => () => {
    const all = Object.keys(A.community.cast('chess')), pre = p => all.filter(i => i.startsWith(p)), f = n => all.find(i => i.endsWith(':' + n));
    if (ch.fn) return ch.fn(all, pre, f).filter((x, i, a) => x && a.indexOf(x) === i);
    const ids = ch.ms.map(n => all.find(i => i.endsWith(':' + n))).filter(Boolean);
    if (ch.buds) all.filter(i => /^bud:/.test(i)).forEach(i => ids.push(i)); return ids;
  };
  A.community.define({
    id: 'chess', name: 'the Moundshroud Chess Community', period: 55000, cast, topics: TOPICS, follow: FOLLOW, castKey, fillers: { opening: OPENINGS },
    channels: () => CH.map(c => Object.assign({}, c, { members: members(c) })),
    ctxLine: () => 'It is a friendly, lively community of chess players and characters. Keep it light and in character.'
  });

  UI.sections.community = (host, api) => {
    host.innerHTML = '<div class="card" style="margin:0 0 10px"><div class="row" style="gap:10px;align-items:center"><div style="flex:1"><b style="font-size:17px">🗣 Chess Community</b><div class="small mute">The opponents, legends and club regulars are always chatting in these channels, with or without you. Step in whenever you like, scroll back to read what you missed, or join the conversation. Tap a name to see who they are and what they remember about you.</div></div><label class="chk small" title="When off, chatter uses quick built-in lines instead of the AI model"><input type="checkbox" id="cmai"' + (ls.get('cmai', '1') !== '0' ? ' checked' : '') + '> AI chatter</label></div></div><div id="cmroot"></div>';
    host.querySelector('#cmai').onchange = e => ls.set('cmai', e.target.checked ? '1' : '0');
    return A.community.view(host.querySelector('#cmroot'), 'chess');
  };
  // the community keeps living in the background once you have visited it
  // the community is alive from the start: every character is registered with memory and starts chatting
  setTimeout(() => { try { A.community.start('chess'); A.community.cast('chess'); A.community.catchUp('chess'); } catch (e) { } }, 3000);
})();

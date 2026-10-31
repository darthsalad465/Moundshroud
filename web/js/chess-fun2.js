// Many more chess achievements (about 300). New event sources feed counters in the same store as chess-fun.js (localStorage chach).
// Events used: logged (a finished game, any opponent), move, analysis (with move-quality counts), deal, dealkept, botchat, boardset, look, arrow, learn, moment, histquiz, legend,
// profileview, rematch, online. They are handled here before chess-fun.js's own handler runs.
(() => {
  const Ach = window.ChessAch; if (!Ach || !Ach.DEFS) return;
  const T = (id, name, icon, desc, xp, key, n, cat) => ({ id, name, icon, desc, xp, key, n, cat });
  const F = (id, name, icon, desc, xp, cond, cat, secret) => ({ id, name, icon, desc, xp, cond, cat, secret });
  const D = [], have = new Set(Ach.DEFS.map(d => d.id));
  const add = d => { if (!have.has(d.id)) { have.add(d.id); D.push(d); } };
  const tiers = (pre, key, cat, icon, list, name, desc, xp) => list.forEach((n, i) => add(T(pre + n, name(n, i), icon, desc(n), xp ? xp(n, i) : 10 + i * 15, key, n, cat)));
  const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const roman = i => ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'][i] || String(i + 1);

  /* ================= PLAY ================= */
  tiers('ag', 'allGames', 'Play', '♟️', [5, 25, 100, 250, 500, 1000], (n, i) => ['Warming Up', 'Regular', 'Veteran', 'Seasoned', 'Marathoner', 'Chess Lifer'][i], n => 'Finish ' + n + ' games against any opponent.', (n, i) => 20 + i * 40);
  tiers('aw', 'allWins', 'Play', '🏆', [25, 100, 250, 500], (n, i) => ['Winner', 'Centurion', 'Champion', 'Legend'][i], n => 'Win ' + n + ' games.', (n, i) => 60 + i * 80);
  tiers('ad', 'allDraws', 'Play', '🤝', [5, 25, 50], (n, i) => ['Peacemaker', 'Diplomat', 'Master of the Draw'][i], n => 'Draw ' + n + ' games.', (n, i) => 25 + i * 40);
  tiers('al', 'allLosses', 'Play', '📚', [10, 25, 100], (n, i) => ['Learning Curve', 'Resilient', 'Never Give Up'][i], n => 'Lose ' + n + ' games and keep playing. Losses teach the most.', (n, i) => 20 + i * 30);
  tiers('ws', 'maxStreak', 'Play', '🔥', [2, 3, 5, 7, 10, 15, 20], (n, i) => ['Back to Back', 'Hat Trick', 'On a Roll', 'Lucky Seven', 'Unstoppable', 'Dominant', 'Untouchable'][i], n => 'Win ' + n + ' games in a row.', (n, i) => 20 + i * 35);
  tiers('wb', 'blackWins', 'Play', '⚫', [10, 25, 50, 100], (n, i) => ['Dark Side', 'Black Belt', 'Night Rider', 'Master of Black'][i], n => 'Win ' + n + ' games as Black.', (n, i) => 40 + i * 40);
  tiers('wf', 'win20', 'Play', '⚡', [1, 5, 10, 25], (n, i) => ['Lightning', 'Blitz Attack', 'Quick Kill', 'Speed Demon'][i], n => 'Win ' + n + ' game' + (n > 1 ? 's' : '') + ' in 20 moves or fewer.', (n, i) => 30 + i * 40);
  tiers('wl', 'long100', 'Play', '🏔️', [1, 3, 10], (n, i) => ['Endurance', 'Marathon Match', 'Iron Will'][i], n => 'Finish ' + n + ' game' + (n > 1 ? 's' : '') + ' of 50 moves or more.', (n, i) => 40 + i * 50);
  tiers('wm', 'mateWins', 'Play', '♚', [25, 50, 100], (n, i) => ['Mate Maker', 'Checkmate Collector', 'The Closer'][i], n => 'Win ' + n + ' games by checkmate.', (n, i) => 60 + i * 60);
  tiers('wt', 'timeWins', 'Play', '⏱️', [1, 5, 10, 25], (n, i) => ['Flagged!', 'Clock Watcher', 'Time Lord', 'Master of Time'][i], n => 'Win ' + n + ' game' + (n > 1 ? 's' : '') + ' on time.', (n, i) => 30 + i * 35);
  tiers('lt', 'timeLosses', 'Play', '⌛', [1, 5], (n, i) => ['Out of Time', 'Time Trouble'][i], n => 'Lose ' + n + ' game' + (n > 1 ? 's' : '') + ' on time. It happens to everyone.', (n, i) => 10 + i * 10);
  tiers('lr', 'resigned', 'Play', '🏳️', [1, 10], (n, i) => ['Resigned', 'Know When to Fold'][i], n => 'Resign ' + n + ' lost game' + (n > 1 ? 's' : '') + '.', (n, i) => 10 + i * 20);
  tiers('rd', 'ruleDraws', 'Play', '♾️', [1, 5], (n, i) => ['By the Rules', 'Stalemate Specialist'][i], n => 'Draw ' + n + ' game' + (n > 1 ? 's' : '') + ' by stalemate, repetition or the fifty-move rule.', (n, i) => 25 + i * 30);
  tiers('agd', 'agreedDraws', 'Play', '🕊️', [1, 5, 10, 25], (n, i) => ['Handshake', 'Shake on It', 'Friendly Rival', 'Peace Treaty'][i], n => 'Agree to ' + n + ' draw' + (n > 1 ? 's' : '') + ' with an opponent.', (n, i) => 25 + i * 30);
  tiers('ov', 'opCount', 'Play', '📖', [3, 6, 10, 15], (n, i) => ['Opening Explorer', 'Repertoire', 'Opening Scholar', 'Opening Encyclopedia'][i], n => 'Play games in ' + n + ' different named openings.', (n, i) => 30 + i * 40);

  /* ================= OPPONENTS ================= */
  try { (window.ChessBots ? ChessBots.R : []).forEach(b => add(T('beat_' + slug(b.n), 'Defeated ' + b.n, b.i, 'Beat ' + b.n + ' (' + b.e + ' Elo): ' + b.t + '.', 30 + Math.round(b.e / 25), 'beat_' + slug(b.n), 1, 'Opponents'))); } catch (e) { }
  tiers('bc', 'beatCount', 'Opponents', '🎭', [5, 10, 15, 21], (n, i) => ['Character Collector', 'Cast Crusher', 'Almost Everyone', 'Beat the Whole Cast'][i], n => 'Beat ' + n + ' different characters.', (n, i) => 60 + i * 100);
  tiers('bd', 'drawCount', 'Opponents', '🤝', [1, 5, 10], (n, i) => ['Held to a Draw', 'Draw Specialist', 'Draw Master'][i], n => 'Draw with ' + n + ' different character' + (n > 1 ? 's' : '') + '.', (n, i) => 30 + i * 40);
  add(T('beatEcho', 'Defeated Your Reflection', '🪞', 'Beat Echo, the bot that plays like you.', 120, 'beatEcho', 1, 'Opponents')); add(T('beatRival', 'Out-ranked the Twin', '👥', 'Beat Rival, the Elo twin.', 100, 'beatRival', 1, 'Opponents'));
  add(T('drawEcho', 'Even with Yourself', '🪞', 'Draw with Echo.', 80, 'drawEcho', 1, 'Opponents')); add(T('drawRival', 'Dead Even', '👥', 'Draw with Rival.', 70, 'drawRival', 1, 'Opponents'));
  tiers('opE', 'mirrorGames', 'Opponents', '🪞', [1, 10, 25], (n, i) => ['Mirror Match', 'Studying Yourself', 'Know Thyself'][i], n => 'Play ' + n + ' game' + (n > 1 ? 's' : '') + ' against Echo.', (n, i) => 25 + i * 50);
  tiers('opR', 'twinGames', 'Opponents', '👥', [1, 10, 25], (n, i) => ['Meet Your Match', 'Sparring Partner', 'Old Rivals'][i], n => 'Play ' + n + ' game' + (n > 1 ? 's' : '') + ' against Rival.', (n, i) => 25 + i * 50);
  tiers('opB', 'botGames', 'Opponents', '🎭', [10, 50, 100], (n, i) => ['Cast Member', 'Regular at the Table', 'Part of the Family'][i], n => 'Play ' + n + ' games against the characters.', (n, i) => 30 + i * 60);

  /* ================= ONLINE (simulated) ================= */
  tiers('og', 'onlineGames', 'Online', '🌐', [1, 5, 10, 25, 50, 100, 250], (n, i) => ['First Connection', 'Getting Online', 'Regular Player', 'Dedicated', 'Online Veteran', 'Addicted', 'Server Legend'][i], n => 'Finish ' + n + ' simulated online game' + (n > 1 ? 's' : '') + '.', (n, i) => 20 + i * 30);
  tiers('ow', 'onlineWins', 'Online', '🏅', [1, 5, 10, 25, 50, 100], (n, i) => ['First Online Win', 'Winning Habit', 'Climber', 'Rising Star', 'Ladder Master', 'Online Champion'][i], n => 'Win ' + n + ' online game' + (n > 1 ? 's' : '') + '.', (n, i) => 25 + i * 40);
  [['bullet', 'Bullet', '💨'], ['blitz', 'Blitz', '⚡'], ['rapid', 'Rapid', '🐢']].forEach(([k, n, ic]) => tiers('o' + k.slice(0, 3), k + 'Wins', 'Online', ic, [1, 10, 25], (x, i) => [n + ' Debut', n + ' Regular', n + ' Master'][i], x => 'Win ' + x + ' ' + k + ' game' + (x > 1 ? 's' : '') + ' online.', (x, i) => 30 + i * 50));
  tiers('or', 'onlineBest', 'Online', '📈', [800, 1000, 1200, 1400, 1600, 1800, 2000, 2200], (n, i) => 'Rated ' + n, n => 'Reach an online rating of ' + n + ' in any time control.', (n, i) => 30 + i * 40);
  tiers('ou', 'upsets', 'Online', '🎯', [1, 5, 10, 25], (n, i) => ['Upset!', 'Giant Killer', 'Underdog Hero', 'Rating Assassin'][i], n => 'Beat an online opponent rated 100+ above you ' + n + (n > 1 ? ' times.' : ' time.'), (n, i) => 40 + i * 50);
  add(T('bigUpset', 'David and Goliath', '🗡️', 'Beat an online opponent rated 300+ above you.', 150, 'bigUpset', 1, 'Online'));
  tiers('oa', 'abandonWins', 'Online', '🔌', [1, 3], (n, i) => ['They Left!', 'Chased Them Away'][i], n => 'Win ' + n + ' time' + (n > 1 ? 's' : '') + ' because your online opponent disconnected.', (n, i) => 20 + i * 20);
  tiers('orw', 'onlineResignWins', 'Online', '🏳️', [1, 5], (n, i) => ['They Resigned', 'Pressure Cooker'][i], n => 'Win ' + n + ' online game' + (n > 1 ? 's' : '') + ' by your opponent resigning.', (n, i) => 25 + i * 25);
  tiers('os', 'onlineStreak', 'Online', '🔥', [3, 5, 10], (n, i) => ['Online Hat Trick', 'Hot Streak', 'Server Slayer'][i], n => 'Win ' + n + ' online games in a row.', (n, i) => 40 + i * 60);
  tiers('od', 'onlineDraws', 'Online', '🤝', [1, 5], (n, i) => ['Online Draw', 'Draw Diplomat'][i], n => 'Draw ' + n + ' online game' + (n > 1 ? 's' : '') + '.', (n, i) => 20 + i * 20);
  tiers('oc', 'casualGames', 'Online', '☕', [1, 10], (n, i) => ['Just for Fun', 'Casual Regular'][i], n => 'Play ' + n + ' unrated online game' + (n > 1 ? 's' : '') + '.', (n, i) => 10 + i * 20);
  tiers('orm', 'rematches', 'Online', '🔁', [1, 5, 10], (n, i) => ['Run It Back', 'Rematch Fan', 'Rivalry'][i], n => 'Get a rematch accepted ' + n + ' time' + (n > 1 ? 's' : '') + '.', (n, i) => 15 + i * 25);
  add(T('onAbort', 'Cold Feet', '🚪', 'Abort an online game before it starts.', 10, 'onlineAborts', 1, 'Online')); add(T('onFlag', 'Flagged Online', '⏰', 'Lose an online game on time.', 10, 'onlineTimeLosses', 1, 'Online'));
  add(F('onAllCats', 'All Speeds', '🎚️', 'Win an online game in bullet, blitz and rapid.', 120, c => c.bulletWins && c.blitzWins && c.rapidWins, 'Online'));
  tiers('ot', 'onlineWorld', 'Online', '🌍', [5, 10, 20], (n, i) => ['Around the World', 'Globetrotter', 'Citizen of the World'][i], n => 'Play opponents from ' + n + ' different countries.', (n, i) => 30 + i * 40);

  /* ================= BRILLIANCE (move quality) ================= */
  tiers('mb', 'brilliants', 'Brilliance', '‼️', [1, 3, 5, 10, 25, 50, 100], (n, i) => ['First Brilliancy', 'Spark of Genius', 'Brilliant Mind', 'Artist', 'Master of Sacrifice', 'Genius', 'Immortal'][i], n => 'Play ' + n + ' brilliant move' + (n > 1 ? 's' : '') + ' in analysed games.', (n, i) => 60 + i * 70);
  tiers('mg', 'greats', 'Brilliance', '❗', [1, 5, 10, 25, 50, 100, 250], (n, i) => ['Great Find', 'Sharp Eye', 'Only Move', 'Critical Thinker', 'Tactician', 'Great Player', 'Moment Maker'][i], n => 'Play ' + n + ' great move' + (n > 1 ? 's' : '') + ' in analysed games.', (n, i) => 30 + i * 40);
  tiers('mbest', 'bests', 'Brilliance', '⭐', [25, 100, 250, 500, 1000, 2500], (n, i) => ['Top Choice', 'Engine Friend', 'Best Foot Forward', 'Precision', 'Computer-like', 'Silicon Mind'][i], n => 'Play ' + n + ' best moves in analysed games.', (n, i) => 30 + i * 45);
  tiers('mc', 'cleanGames', 'Brilliance', '🧼', [1, 3, 5, 10, 25], (n, i) => ['Clean Sheet', 'Tidy Player', 'Careful Hands', 'Blunder-Free', 'Spotless'][i], n => 'Finish ' + n + ' analysed game' + (n > 1 ? 's' : '') + ' (20+ moves) with no blunders and no mistakes.', (n, i) => 40 + i * 50);
  tiers('ma', 'maxAcc', 'Brilliance', '🎯', [75, 85, 92, 96, 98, 100], (n, i) => 'Accuracy ' + n + '%', n => 'Reach ' + n + '% accuracy in an analysed game.', (n, i) => 25 + i * 40);
  tiers('mp', 'perfectGames', 'Brilliance', '💎', [1, 3], (n, i) => ['Near Perfect', 'Perfectionist'][i], n => 'Finish ' + n + ' analysed game' + (n > 1 ? 's' : '') + ' (25+ moves) at 99% accuracy or higher.', (n, i) => 150 + i * 150);
  tiers('mn', 'analyses', 'Brilliance', '🔬', [25, 100, 250], (n, i) => ['Analyst', 'Game Doctor', 'Grandmaster Prep'][i], n => 'Analyse ' + n + ' games.', (n, i) => 80 + i * 100);
  add(T('mx', 'Ten Great Moves', '🌟', 'Play 10 great or brilliant moves in total.', 80, 'gb10', 10, 'Brilliance'));

  /* ================= MOVES ================= */
  tiers('kc', 'castleK', 'Moves', '🏰', [1, 10, 50, 200], (n, i) => ['Safe and Sound', 'Habitual Castler', 'Castle Keeper', 'King of the Castle'][i], n => 'Castle kingside ' + n + ' time' + (n > 1 ? 's' : '') + '.', (n, i) => 10 + i * 25);
  tiers('qc', 'castleQ', 'Moves', '🏯', [1, 5, 25, 100], (n, i) => ['Long Castle', 'Queenside Attacker', 'Opposite Wings', 'Long Castle Legend'][i], n => 'Castle queenside ' + n + ' time' + (n > 1 ? 's' : '') + '.', (n, i) => 15 + i * 30);
  tiers('pq', 'promoQ', 'Moves', '👑', [1, 10, 50], (n, i) => ['Crowned', 'Queen Maker', 'Coronation Day'][i], n => 'Promote a pawn to a queen ' + n + ' time' + (n > 1 ? 's' : '') + '.', (n, i) => 15 + i * 35);
  add(T('pn', 'Underpromotion: Knight', '🐴', 'Promote a pawn to a knight.', 60, 'promoN', 1, 'Moves')); add(T('pr1', 'Underpromotion: Rook', '🏰', 'Promote a pawn to a rook.', 60, 'promoR', 1, 'Moves')); add(T('pb1', 'Underpromotion: Bishop', '⛪', 'Promote a pawn to a bishop.', 60, 'promoB', 1, 'Moves'));
  tiers('ck', 'checks', 'Moves', '⚠️', [10, 50, 250, 1000, 5000], (n, i) => ['Check!', 'Check Mate Yourself', 'Check Enthusiast', 'Checkmate Hunter', 'Royal Pest'][i], n => 'Give check ' + n + ' times.', (n, i) => 15 + i * 30);
  tiers('cp', 'captures', 'Moves', '⚔️', [50, 250, 1000, 5000], (n, i) => ['Capturer', 'Trade Master', 'Material Thief', 'Piece Hoarder'][i], n => 'Capture ' + n + ' pieces.', (n, i) => 20 + i * 35);
  [['Q', 'Queen', '♛'], ['R', 'Rook', '♜'], ['B', 'Bishop', '♝'], ['N', 'Knight', '♞'], ['p', 'Pawn', '♟']].forEach(([k, n, ic]) => add(T('mate' + k, 'Mate with the ' + n, ic, 'Deliver checkmate with a ' + n.toLowerCase() + '.', 40, 'mateBy' + k, 1, 'Moves')));
  add(F('mateAll', 'Every Piece Mates', '🧩', 'Checkmate with a queen, rook, bishop, knight and pawn.', 150, c => c.mateByQ && c.mateByR && c.mateByB && c.mateByN && c.mateByp, 'Moves'));
  tiers('cm', 'matesGiven', 'Moves', '♚', [10, 50, 100], (n, i) => ['Ten Mates', 'Fifty Mates', 'Hundred Mates'][i], n => 'Deliver checkmate ' + n + ' times.', (n, i) => 50 + i * 60);

  /* ================= SOCIAL (negotiation) ================= */
  tiers('dw', 'dealsWon', 'Social', '🗣️', [1, 5, 10, 25, 50, 100], (n, i) => ['Silver Tongue', 'Persuader', 'Negotiator', 'Diplomat', 'Master Negotiator', 'Smooth Talker'][i], n => 'Get ' + n + ' opponent' + (n > 1 ? 's' : '') + ' to agree to something in chat.', (n, i) => 25 + i * 40);
  tiers('dd', 'draws_won', 'Social', '🤝', [1, 3, 5, 10, 25], (n, i) => ['Talked into a Draw', 'Peace Talks', 'Draw by Diplomacy', 'The Mediator', 'Born Peacemaker'][i], n => 'Convince an opponent to agree to a draw ' + n + ' time' + (n > 1 ? 's' : '') + '.', (n, i) => 30 + i * 35);
  tiers('dt', 'takebacks_won', 'Social', '↩️', [1, 3, 10], (n, i) => ['Just This Once', 'Second Chances', 'Eternal Optimist'][i], n => 'Get a take-back granted ' + n + ' time' + (n > 1 ? 's' : '') + '.', (n, i) => 20 + i * 30);
  tiers('dm', 'move_won', 'Social', '📜', [1, 5, 10, 25], (n, i) => ['Gentleman\'s Agreement', 'Move Whisperer', 'Puppet Master', 'Chess Hypnotist'][i], n => 'Get an opponent to promise a move ' + n + ' time' + (n > 1 ? 's' : '') + '.', (n, i) => 25 + i * 40);
  tiers('dx', 'trade_won', 'Social', '🔄', [1, 5, 10], (n, i) => ['Fair Trade', 'Trade Broker', 'Stock Exchange'][i], n => 'Get an opponent to agree to a trade deal ' + n + ' time' + (n > 1 ? 's' : '') + '.', (n, i) => 20 + i * 30);
  tiers('dg', 'gentle_won', 'Social', '🕊️', [1, 5], (n, i) => ['Mercy!', 'Beggar\'s Banquet'][i], n => 'Convince an opponent to go easy on you ' + n + ' time' + (n > 1 ? 's' : '') + '.', (n, i) => 20 + i * 30);
  tiers('dk', 'dealsKept', 'Social', '🔒', [1, 10, 25], (n, i) => ['A Deal Is a Deal', 'Man of Their Word', 'Trusted Partner'][i], n => 'See ' + n + ' promised move' + (n > 1 ? 's' : '') + ' kept by an opponent.', (n, i) => 20 + i * 30);
  tiers('dc', 'botChats', 'Social', '💬', [1, 10, 50, 200, 500, 1000], (n, i) => ['Say Hello', 'Chatterbox', 'Table Talk', 'Social Butterfly', 'Motormouth', 'Chess Podcaster'][i], n => 'Send ' + n + ' chat messages to opponents.', (n, i) => 10 + i * 30);
  add(T('silver3', 'Triple Deal', '🥉', 'Get three agreements in a single game.', 100, 'bestGameDeals', 3, 'Social')); add(T('hardDraw', 'Persuaded a Master', '🧠', 'Talk a 1800+ rated opponent into a draw.', 200, 'hardDraw', 1, 'Social'));
  add(F('rude', 'Not Nice', '😠', 'Be rude to an opponent. They noticed.', 5, c => c.rude >= 1, 'Social', true)); add(T('kind', 'Friendly Face', '😊', 'Keep an opponent friendly for a whole game while you win.', 50, 'friendlyWins', 1, 'Social'));

  /* ================= LEARNING BOTS ================= */
  tiers('ln', 'learned', 'Learning Bots', '🧠', [10, 50, 100, 250, 500, 1000, 2500], (n, i) => ['First Lessons', 'Echo Listens', 'Echo Learns', 'Echo Knows You', 'Deep Profile', 'Open Book', 'Fully Mapped'][i], n => 'Let Echo learn from ' + n + ' of your moves.', (n, i) => 15 + i * 30);

  /* ================= CUSTOMIZE ================= */
  tiers('ct', 'themesTried', 'Customize', '🎨', [3, 6, 10, 15], (n, i) => ['Colour Curious', 'Board Stylist', 'Interior Designer', 'Every Colour'][i], n => 'Try ' + n + ' different board colour schemes.', (n, i) => 15 + i * 30);
  tiers('cp2', 'setsTried', 'Customize', '♞', [2, 4, 5], (n, i) => ['New Pieces', 'Piece Collector', 'Every Piece Set'][i], n => 'Try ' + n + ' different piece sets.', (n, i) => 15 + i * 35);
  tiers('cf', 'framesTried', 'Customize', '🖼️', [2, 5], (n, i) => ['Framed', 'Gallery Wall'][i], n => 'Try ' + n + ' different board frames.', (n, i) => 15 + i * 25);
  tiers('cx', 'texTried', 'Customize', '🪵', [2, 4], (n, i) => ['Surface Detail', 'Texture Tester'][i], n => 'Try ' + n + ' different board surfaces.', (n, i) => 15 + i * 25);
  tiers('cl', 'looksTried', 'Customize', '✨', [1, 4, 7], (n, i) => ['Quick Makeover', 'Look Hopper', 'Every Look'][i], n => 'Apply ' + n + ' different one-click board looks.', (n, i) => 15 + i * 30);
  tiers('ca', 'arrows', 'Customize', '➡️', [1, 10, 50, 200], (n, i) => ['First Arrow', 'Planner', 'Arrow Artist', 'Analyst\'s Pen'][i], n => 'Draw ' + n + ' arrow' + (n > 1 ? 's' : '') + ' on a board with right-click.', (n, i) => 10 + i * 25);
  tiers('cs', 'squaresMarked', 'Customize', '🟧', [1, 25], (n, i) => ['Marked Square', 'Highlighter'][i], n => 'Highlight ' + n + ' square' + (n > 1 ? 's' : '') + ' with right-click.', (n, i) => 10 + i * 20);
  add(T('cAll', 'Power User', '🛠️', 'Change 12 different board settings.', 100, 'settingsChanged', 12, 'Customize')); add(T('cSnd', 'Sound Check', '🔊', 'Change a board sound setting.', 10, 'soundChanged', 1, 'Customize')); add(T('cCo', 'Where Am I?', '🔤', 'Change the square-name (coordinate) setting.', 10, 'coordsChanged', 1, 'Customize')); add(T('cSz', 'Big Board Energy', '📐', 'Change the board size.', 10, 'sizeChanged', 1, 'Customize'));
  add(T('cCu', 'Custom Colours', '🖌️', 'Choose your own board or piece colours.', 25, 'customColours', 1, 'Customize'));

  /* ================= STUDY ================= */
  tiers('sl', 'lessons', 'Study', '📘', [5, 15, 30, 50], (n, i) => ['Student', 'Diligent', 'Scholar', 'Professor'][i], n => 'Finish ' + n + ' lessons.', (n, i) => 25 + i * 40);
  tiers('sc', 'courses', 'Study', '🎓', [1, 3, 5, 8], (n, i) => ['Course Complete', 'Triple Graduate', 'Five Courses', 'Master of Courses'][i], n => 'Finish ' + n + ' course' + (n > 1 ? 's' : '') + '.', (n, i) => 50 + i * 60);
  tiers('so', 'openings', 'Study', '📖', [3, 8, 15], (n, i) => ['Opening Student', 'Opening Expert', 'Opening Master'][i], n => 'Learn ' + n + ' openings.', (n, i) => 30 + i * 50);
  tiers('sm', 'moments', 'Study', '✨', [1, 10, 25, 50], (n, i) => ['Moment of Genius', 'Great Finder', 'Brilliancy Hunter', 'Moment Master'][i], n => 'Solve ' + n + ' "Moments of genius" from the famous games.', (n, i) => 25 + i * 40);
  add(T('sq1', 'History Buff Quiz', '❓', 'Finish a chess history quiz.', 20, 'histQuizzes', 1, 'Study')); add(T('sq10', 'History Scholar', '🏛️', 'Score 10 out of 10 on the history quiz.', 80, 'histPerfect', 1, 'Study'));
  tiers('sg', 'legends', 'Study', '🌟', [5, 10, 17], (n, i) => ['Meet the Legends', 'Hall of Fame Visitor', 'Know Them All'][i], n => 'Read ' + n + ' legend profiles.', (n, i) => 20 + i * 40);
  tiers('sch', 'coach', 'Study', '🧑‍🏫', [25, 100, 250], (n, i) => ['Coach\'s Pet', 'Dedicated Student', 'Always Learning'][i], n => 'Ask the coach ' + n + ' questions.', (n, i) => 40 + i * 60);
  tiers('spv', 'profileViews', 'Study', '👤', [1, 10, 50], (n, i) => ['Know Thyself', 'Stats Fan', 'Data Nerd'][i], n => 'Open your chess profile ' + n + ' time' + (n > 1 ? 's' : '') + '.', (n, i) => 10 + i * 25);
  tiers('sfm', 'famous', 'Study', '🏆', [3, 7, 14], (n, i) => ['Game Watcher', 'History Student', 'Every Game'][i], n => 'Play through ' + n + ' famous games.', (n, i) => 30 + i * 50);

  /* ================= PUZZLES ================= */
  tiers('pz', 'puzzles', 'Puzzles', '🧩', [2500, 5000], (n, i) => ['Puzzle Machine', 'Puzzle Legend'][i], n => 'Solve ' + n + ' puzzles.', (n, i) => 300 + i * 300);
  tiers('pst', 'bestStreak', 'Puzzles', '🔥', [50, 100], (n, i) => ['Streak of Fifty', 'Streak of a Hundred'][i], n => 'Solve ' + n + ' puzzles in a row.', (n, i) => 200 + i * 200);
  tiers('prt', 'maxRating', 'Puzzles', '📈', [2000, 2200, 2400], (n, i) => 'Puzzle Rating ' + n, n => 'Reach a puzzle rating of ' + n + '.', (n, i) => 200 + i * 150);

  /* ================= HABITS ================= */
  tiers('hd', 'dayCount', 'Habits', '📅', [2, 3, 5, 7, 14, 30, 60, 100], (n, i) => ['Came Back', 'Third Day', 'Five Days', 'A Week of Chess', 'Fortnight', 'A Month of Chess', 'Two Months', 'Hundred Days'][i], n => 'Play chess on ' + n + ' different days.', (n, i) => 15 + i * 30);
  tiers('hs', 'dayStreak', 'Habits', '🔥', [3, 7, 14, 30, 60], (n, i) => ['Three in a Row', 'Weekly Habit', 'Two-Week Streak', 'Monthly Streak', 'Chess Habit'][i], n => 'Play chess ' + n + ' days in a row.', (n, i) => 30 + i * 50);
  tiers('hm', 'maxDay', 'Habits', '🏃', [5, 10, 20], (n, i) => ['Chess Day', 'Chess Marathon', 'Chess Binge'][i], n => 'Finish ' + n + ' games in one day.', (n, i) => 30 + i * 50);
  add(T('hEarly', 'Early Bird', '🌅', 'Play chess before 7 in the morning.', 20, 'early', 1, 'Habits')); add(F('hWeekend', 'Weekend Warrior', '🛋️', 'Play chess on both a Saturday and a Sunday.', 40, c => c.sat && c.sun, 'Habits'));
  add(T('hLunch', 'Lunch Break', '🥪', 'Finish a game between 12 and 2 in the afternoon.', 15, 'lunch', 1, 'Habits'));

  /* ================= SPECIAL ================= */
  add(F('sQuick', 'Miniature', '🔬', 'Win a game in 10 moves or fewer.', 100, c => c.win10 >= 1, 'Special', true)); add(F('sBounce', 'Bounce Back', '🏀', 'Win right after a loss.', 20, c => c.bounce >= 1, 'Special', true));
  add(F('sRevenge', 'Revenge', '😈', 'Beat an opponent you lost to in the previous game.', 40, c => c.revenge >= 1, 'Special', true)); add(F('sHat', 'Four of a Kind', '🎰', 'Win, lose, draw and win in four consecutive games.', 60, c => c.wldw >= 1, 'Special', true));
  add(F('sAllRes', 'Every Result', '🎲', 'Win, lose and draw at least once against Echo, Rival or an online player.', 60, c => c.mixedRes >= 1, 'Special', true)); add(F('sNight', 'Insomniac Win', '🌙', 'Win a game between midnight and 5 in the morning.', 40, c => c.nightWin >= 1, 'Special', true));

  Ach.DEFS.push(...D);

  /* the Completionist trophy should need every category (the old one counted only six) */
  try { const ac = Ach.DEFS.find(d => d.id === 'allcats'); if (ac) { ac.cond = c => c.catsDone >= new Set(Ach.DEFS.map(x => x.cat)).size; ac.desc = 'Unlock at least one trophy in every category.'; } } catch (e) { }

  /* ---------- counters for the new events (handled before chess-fun.js's own switch) ---------- */
  const base = Ach.event, ld = () => Ach.data(), keyDay = d => d.toDateString();
  const sv = s => { try { ls.set('chach', JSON.stringify(s)); } catch (e) { } };
  Ach.event = function (name, d) {
    d = d || {};
    try {
      const s = ld(), c = s.c, add1 = (k, n) => { c[k] = (c[k] || 0) + (n == null ? 1 : n); }, max = (k, v) => { if (v > (c[k] || 0)) c[k] = v; }, set = (k, v) => { c[k] = c[k] || {}; c[k][v] = 1; return Object.keys(c[k]).length; };
      let touched = true;
      if (name === 'logged') {
        const r = d.r, now = new Date(), dk = keyDay(now); add1('allGames'); if (r === 'W') add1('allWins'); else if (r === 'D') add1('allDraws'); else if (r === 'L') add1('allLosses');
        add1(d.kind + 'Games'); const days = c.dayMap = c.dayMap || {}; if (!days[dk]) { days[dk] = 0; } days[dk]++; c.dayCount = Object.keys(days).length; max('maxDay', days[dk]); let st = 0; for (let i = 0; i < 400; i++) { const k = keyDay(new Date(Date.now() - i * 864e5)); if (days[k]) st++; else if (i > 0) break; else continue; } max('dayStreak', st);
        if (now.getHours() < 7) add1('early'); if (now.getHours() >= 12 && now.getHours() < 14) add1('lunch'); if (now.getDay() === 6) c.sat = 1; if (now.getDay() === 0) c.sun = 1; if (r === 'W' && now.getHours() < 5) add1('nightWin');
        const prev = c.lastRes || [], hist = prev.slice(-3).concat([r]); c.lastRes = hist.slice(-6); if (r === 'W') { c.curStreak = (c.curStreak || 0) + 1; max('maxStreak', c.curStreak); } else c.curStreak = 0;
        if (r === 'W' && prev.length && prev[prev.length - 1] === 'L') { add1('bounce'); if (c.lastOpp === d.opp) add1('revenge'); } c.lastOpp = r === 'L' ? d.opp : (c.lastOpp === d.opp ? null : c.lastOpp);
        if (hist.length >= 4 && hist.slice(-4).join('') === 'WLDW') add1('wldw');
        if (r === 'W' && (d.p || 0) <= 40) add1('win20'); if (r === 'W' && (d.p || 0) <= 20 && (d.p || 0) >= 1) add1('win10'); if (r === 'W' && d.friendly) add1('friendlyWins'); if ((d.p || 0) >= 100) add1('long100');
        if (r === 'W' && d.how === 'time') add1('timeWins'); if (r === 'L' && d.how === 'time') add1('timeLosses'); if (r === 'L' && d.how === 'resign') add1('resigned'); if (d.how === 'rule' && r === 'D') add1('ruleDraws'); if (d.how === 'agreed' && r === 'D') add1('agreedDraws'); if (r === 'W' && d.how === 'mate') add1('mateWins');
        if (d.op) { const n = set('opSet', d.op); c.opCount = n; }
        if (d.kind === 'bot') { try { const b = ChessBots.R.find(x => x.n === d.opp); if (b) { if (r === 'W') { c['beat_' + slug(b.n)] = 1; } if (r === 'D') c['drew_' + slug(b.n)] = 1; } } catch (e) { } c.beatCount = Object.keys(c).filter(k => k.startsWith('beat_')).length; c.drawCount = Object.keys(c).filter(k => k.startsWith('drew_')).length; }
        if (d.kind === 'mirror') { if (r === 'W') c.beatEcho = 1; if (r === 'D') c.drawEcho = 1; } if (d.kind === 'twin') { if (r === 'W') c.beatRival = 1; if (r === 'D') c.drawRival = 1; }
        if (d.kind === 'mirror' || d.kind === 'twin' || d.kind === 'online') { const m = c.mixed = c.mixed || {}; m[r] = 1; if (m.W && m.D && m.L) c.mixedRes = 1; }
        if (d.kind === 'online') {
          add1('onlineGames'); if (!d.rt) add1('casualGames'); if (r === 'W') { add1('onlineWins'); add1((d.cat || 'blitz') + 'Wins'); if (d.how === 'abandon') add1('abandonWins'); if (d.how === 'resign') add1('onlineResignWins'); const diff = (d.oe || 0) - (d.rb || 0); if (d.rt && diff >= 100) add1('upsets'); if (d.rt && diff >= 300) c.bigUpset = 1; c.onlineStr = (c.onlineStr || 0) + 1; max('onlineStreak', c.onlineStr); } else c.onlineStr = 0;
          if (r === 'D') add1('onlineDraws'); if (r === 'L' && d.how === 'time') add1('onlineTimeLosses'); try { const o = JSON.parse(ls.get('chonline', '{}')); max('onlineBest', Math.max(0, ...['bullet', 'blitz', 'rapid'].map(k => (o[k] && o[k].r) || 0))); } catch (e) { }
          if (d.country) c.onlineWorld = set('countries', d.country);
        }
        if (r === 'D' && d.how === 'agreed' && (d.oe || 0) >= 1800) add1('hardDraw');
      } else if (name === 'move') {
        if (d.mine) { const san = String(d.san || ''); if (/^O-O-O/.test(san)) add1('castleQ'); else if (/^O-O/.test(san)) add1('castleK'); const pm = /=([QRBN])/.exec(san); if (pm) add1('promo' + pm[1]); if (/[+#]/.test(san)) add1('checks'); if (/x/.test(san)) add1('captures'); if (/#/.test(san)) { add1('matesGiven'); const p = /^[KQRBN]/.test(san) ? san[0] : 'p'; add1('mateBy' + p); } } else touched = false;
      } else if (name === 'analysis') {
        const k = d.counts || {}, n = d.n || 0; add1('brilliants', k.brilliant || 0); add1('greats', k.great || 0); add1('bests', k.best || 0); add1('gb10', (k.brilliant || 0) + (k.great || 0)); max('maxAcc', Math.round(d.acc || 0)); if (n >= 20 && !(k.blunder || 0) && !(k.mistake || 0)) add1('cleanGames'); if (n >= 25 && (d.acc || 0) >= 99) add1('perfectGames');
      } else if (name === 'deal') {
        add1('dealsTried'); if (d.accepted) { add1('dealsWon'); add1('gameDeals'); max('bestGameDeals', c.gameDeals || 0); const kmap = { draw: 'draws_won', takeback: 'takebacks_won', move: 'move_won', trade: 'trade_won', avoid: 'trade_won', gentle: 'gentle_won' }; if (kmap[d.kind]) add1(kmap[d.kind]); }
      } else if (name === 'dealreset') { c.gameDeals = 0; } else if (name === 'dealkept') add1('dealsKept'); else if (name === 'botchat') add1('botChats'); else if (name === 'rude') add1('rude');
      else if (name === 'boardset') {
        const k = d.k; c.setK = c.setK || {}; c.setK[k] = 1; c.settingsChanged = Object.keys(c.setK).length; if (k === 'theme') { c.themesTried = set('themeSet', d.v); if (d.v === 'custom') c.customColours = 1; } if (k === 'pieces') c.setsTried = set('pieceSet', d.v); if (k === 'frame') c.framesTried = set('frameSet', d.v); if (k === 'tex') c.texTried = set('texSet', d.v); if (k === 'coords' || k === 'coordSize') c.coordsChanged = 1; if (k === 'size' || k === 'maxsz') c.sizeChanged = 1; if (k === 'sound' || k === 'vol') c.soundChanged = 1; if (k === 'pw' || k === 'pb' || k === 'lightC' || k === 'darkC') c.customColours = 1;
      } else if (name === 'look') { c.looksTried = set('lookSet', d.name); } else if (name === 'arrow') add1('arrows'); else if (name === 'square') add1('squaresMarked');
      else if (name === 'learn') add1('learned'); else if (name === 'moment') add1('moments'); else if (name === 'histquiz') { add1('histQuizzes'); if (d.score >= 10) c.histPerfect = 1; } else if (name === 'legend') c.legends = set('legSet', d.n); else if (name === 'profileview') add1('profileViews'); else if (name === 'rematch') add1('rematches'); else if (name === 'abort') add1('onlineAborts');
      else if (name === 'online') { touched = false; } else touched = false;
      if (touched) sv(s);
    } catch (e) { }
    return base.call(Ach, name, d);
  };
})();

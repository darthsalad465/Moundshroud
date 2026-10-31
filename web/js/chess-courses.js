// Chess courses and famous games. Step kinds: info (t, f|m), explore (ex), task (ok=[uci], why), quiz, drill (endless generated puzzles on a theme), link.
// f = FEN, m = SAN moves from the start position, hl = squares to highlight. A script checks every position, task move, mate and game against the engine.
(() => {
  const ST = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  const I = (t, f, o) => Object.assign({ t, f }, o || {});
  const M = (t, m, o) => Object.assign({ t, m }, o || {});
  const X = (t, f) => ({ t, f, ex: 1 });
  const T = (t, f, ok, why, o) => Object.assign({ t, f, ok, why }, o || {});
  const TM = (t, m, ok, why, o) => Object.assign({ t, m, ok, why }, o || {});
  const Q = (t, q, o, a, why, f) => Object.assign({ t, quiz: { q, o, a, why } }, f ? { f } : {});
  const D = (t, theme, n) => ({ t: t + ' Now practise it on <b>fresh, randomly generated puzzles</b>: solve ' + (n || 5) + ' to finish.', drill: { theme, n: n || 5 } });
  const L = (id, title, steps) => ({ id, title, steps });
  const SINGLE = (name, fen, txt) => ({ t: '<b>The ' + name + '.</b> ' + txt + ' Click it, then click a square. Dots show where it can go. Move as much as you like.', f: fen, ex: 1 });

  const courses = [
    /* ===================================================== BASICS ===================================================== */
    { id: 'basics', icon: '🌱', title: 'Chess Basics', level: 'Beginner', blurb: 'The board, the pieces, special moves, how a game is won, and your first opening ideas. Start here if you are new.', lessons: [
      L('board', 'The board and how to read it', [
        I('The board has 64 squares: <b>files</b> a-h run left to right, <b>ranks</b> 1-8 run bottom to top (White starts on ranks 1 and 2). Every square has a name: the file letter then the rank number. The four squares in the middle (d4, e4, d5, e5) are the most important. A light square is always at the bottom-right corner of the board from each player\'s view.', ST, { hl: ['d4', 'e4', 'd5', 'e5'] }),
        I('Each side starts with 16 pieces: 1 king, 1 queen, 2 rooks, 2 bishops, 2 knights and 8 pawns. The queen always starts on her own colour (white queen on a light square d1, black queen on a dark square d8). White always moves first.', ST),
        T('Moves are written like <b>e4</b> (a pawn to e4) or <b>Nf3</b> (a knight to f3). Let\'s play. Move the pawn in front of the king two squares: e2 to e4.', ST, ['e2e4'], 'That is 1.e4, the most popular first move in chess. It opens lines for the queen and bishop and claims the centre.'),
        TM('Black answered with e5. Now develop a knight: move the knight from g1 to f3. In notation this is <b>Nf3</b> (N is the knight, because K is the king).', 'e4 e5', ['g1f3'], 'Nf3 develops a knight toward the centre and attacks the black pawn on e5.'),
      ]),
      L('pieces', 'How the pieces move', [
        SINGLE('rook', '7k/8/8/3R4/8/8/8/K7 w - - 0 1', 'It slides any distance along a rank or file, but cannot jump over pieces. Worth about 5 pawns.'),
        SINGLE('bishop', '7k/8/8/3B4/8/8/8/K7 w - - 0 1', 'It slides any distance diagonally and stays on one colour of square for the whole game. Worth about 3 pawns.'),
        SINGLE('queen', '7k/8/8/3Q4/8/8/8/K7 w - - 0 1', 'It moves like a rook and a bishop combined. The strongest piece: about 9 pawns.'),
        SINGLE('knight', '7k/8/8/3N4/8/8/8/K7 w - - 0 1', 'It moves in an L (two squares one way, one the other) and is the only piece that jumps over others. Worth about 3 pawns.'),
        SINGLE('king', '7k/8/8/8/3K4/8/8/8 w - - 0 1', 'It moves one square in any direction, but never onto a square an enemy piece attacks. Lose it and the game is over.'),
        { t: '<b>The pawn.</b> It moves forward one square (or two from its starting square) and captures one square diagonally forward. Try pushing the pawn, then try capturing the black pawn.', f: '7k/8/8/8/8/3p4/4P3/K7 w - - 0 1', ex: 1 },
        Q('Which piece can jump over other pieces?', 'Which piece can jump over others?', ['Bishop', 'Knight', 'Rook', 'Queen'], 1, 'Only the knight jumps. Every other piece is blocked by anything in its path.'),
        Q('Count the value.', 'About how many pawns is a rook worth?', ['3', '5', '7', '9'], 1, 'Pawn 1, knight 3, bishop 3, rook 5, queen 9. These numbers help you decide whether a trade is good.'),
      ]),
      L('checkmate', 'Check, checkmate and stalemate', [
        I('<b>Check</b> means the king is attacked. Here the black king is in check from the rook, and Black must respond: move the king, block, or capture the checker.', '4k3/8/8/8/8/8/4R3/4K3 b - - 0 1'),
        T('Now <b>you</b> are in check. The enemy rook is right next to your king and nothing protects it. Get out of check.', '7k/8/8/8/8/8/4r3/4K3 w - - 0 1', ['e1e2'], 'Capturing the checking piece is often the best answer to check. Always look for it first.'),
        T('<b>Checkmate</b> means the king is in check and nothing can save it. It wins the game. Black\'s king is trapped by its own pawns: deliver mate with the rook.', '6k1/5ppp/8/8/8/8/8/R3K3 w - - 0 1', ['a1a8'], 'Ra8# - the rook checks along the back rank and the pawns block the king\'s escape.'),
        I('<b>Stalemate</b> is a draw. If the player to move has no legal move but is <i>not</i> in check, the game ends in a tie. Black to move here has no moves, but is not in check. Be careful when you are winning!', '7k/5Q2/6K1/8/8/8/8/8 b - - 0 1'),
        Q('A sneaky ending.', 'You are far ahead. Your opponent has no legal move but is NOT in check. What is the result?', ['You win', 'It is a draw (stalemate)', 'You lose', 'The game continues'], 1, 'Stalemate is a draw. When your opponent has only a king left, always leave it a legal move unless it is checkmate.'),
      ]),
      L('special', 'Castling, en passant, promotion', [
        T('<b>Castling</b> tucks your king away and brings a rook into play in one move. It is allowed if neither piece has moved, the squares between are empty, and the king is not in check or passing through check. Castle kingside: move the king two squares toward the rook.', 'r3k2r/pppq1ppp/2np1n2/2b1p3/2B1P3/2NP1N2/PPP2PPP/R1BQK2R w KQkq - 0 1', ['e1g1'], 'The king went to g1 and the rook jumped to f1.'),
        T('<b>En passant</b>: when an enemy pawn jumps two squares and lands beside your pawn, you may capture it as if it had moved only one square - but only on the very next move. Black just played d7-d5. Capture it en passant.', '4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1', ['e5d6'], 'exd6 e.p. - your pawn lands on d6 and the black pawn on d5 is removed.'),
        T('<b>Promotion</b>: a pawn reaching the last rank becomes a queen, rook, bishop or knight (almost always a queen). Promote the pawn.', '8/4P1k1/8/8/8/8/8/4K3 w - - 0 1', ['e7e8q'], 'e8=Q - a pawn that gets to the end is worth far more than a pawn.'),
        Q('Castling rules.', 'When can you NOT castle?', ['If your king has already moved', 'If the king would pass through a square attacked by the enemy', 'If you are in check', 'All of these'], 3, 'All three stop castling. Also the rook must not have moved and the squares between must be empty.'),
      ]),
      L('values', 'What the pieces are worth', [
        I('Pawn = 1, knight = 3, bishop = 3, rook = 5, queen = 9. The king is priceless. These points are a guide to whether a trade is good. Giving a rook (5) for a knight and pawn (4) is usually a bad trade; winning a queen (9) for a rook (5) is great.', ST),
        T('Free material! The black rook on d4 is not protected by anything. Take it.', '4k3/8/8/8/3r4/8/8/3RK3 w - - 0 1', ['d1d4'], 'Before you capture, always ask: is the piece protected? Here it is not, so the rook is simply yours.'),
        Q('Is this a good trade?', 'You can trade your bishop for a knight (3 for 3). Is that a good or a bad trade in terms of material?', ['Good', 'Bad', 'Even'], 2, 'Even. But it may still matter for the position: the bishop pair, an open board or a closed one can make one piece better than the other.'),
        Q('When ahead, trade pieces.', 'You are a rook up (5 points) in the middlegame. What is usually the best plan?', ['Trade pieces to simplify', 'Keep the queens on and attack', 'Sacrifice for an attack', 'Give the material back at once'], 0, 'When you are ahead, trade pieces: every trade makes your advantage bigger as a fraction of what is left. When you are behind, avoid trades.'),
      ]),
      L('opening', 'Your first opening principles', [
        I('<b>1. Fight for the centre.</b> Put pawns on e4 and d4 (or e5 and d5 as Black). Central pieces control more squares.', ST, { hl: ['d4', 'e4'] }),
        I('<b>2. Develop your pieces.</b> Bring out knights and bishops early; knights before bishops is a good habit. Do not move the same piece twice without a reason.', ST),
        I('<b>3. Castle early</b> to protect your king and connect your rooks.', ST),
        I('<b>4. Do not bring the queen out too soon.</b> It will get chased around by smaller pieces while you lose time.', ST),
        TM('The famous <b>Scholar\'s mate</b> trick: White tries to checkmate on f7. Black (to move) just played 3...Nf6?? and walked into it. Deliver the mate.', 'e4 e5 Bc4 Nc6 Qh5 Nf6', ['h5f7'], 'Qxf7# - the queen is protected by the bishop and the king has no escape. Never ignore a threat to your f7 or f2 pawn.'),
        TM('Now you are Black. White\'s queen on h5 and bishop on c4 both aim at f7. Defend, ideally with a move that also attacks the queen.', 'e4 e5 Bc4 Nc6 Qh5', ['g7g6', 'd8f6', 'd8e7'], 'Good: ...g6 kicks the queen, and ...Qe7 or ...Qf6 defend f7. Do <b>not</b> play ...Nf6?? which is the blunder from the last step.'),
        Q('Opening habit.', 'Which is the best habit in the first ten moves?', ['Move your queen out early to attack', 'Develop pieces, control the centre, castle', 'Push every pawn you can', 'Only move one piece'], 1, 'Develop, control the centre and castle. Everything else is detail.'),
      ]),
      L('think', 'How to think during a game', [
        I('Before every move ask three questions: <b>1. What does my opponent threaten?</b> (look at the move they just played) <b>2. Can I take something for free or make a threat?</b> <b>3. Is my move safe?</b> (does it leave a piece hanging?) Players below 1500 lose most games to simple blunders, not fancy tactics. This habit alone will win you points.', ST),
        Q('The blunder check.', 'You found a good-looking move. What should you do next?', ['Play it immediately', 'Check what your opponent can capture or threaten after it', 'Check the clock only', 'Play a different move'], 1, 'Always do a quick blunder check: after my move, what can they capture, and what checks do they have?'),
        Q('Spot the pattern.', 'Your opponent moves a piece next to your queen. What is the first thing to ask?', ['Can I take it?', 'Is it attacking something, or protected?', 'Both of these', 'Nothing - ignore it'], 2, 'Always ask what a move attacks and whether the piece is protected. Then decide.'),
      ]),
    ] },

    /* ===================================================== TACTICS ===================================================== */
    { id: 'tactics', icon: '⚔️', title: 'Tactics Toolkit', level: 'Beginner to Intermediate', blurb: 'Forks, pins, skewers, discovered attacks and more. Every lesson ends with endless fresh puzzles on that exact theme.', lessons: [
      L('hanging', 'Free pieces: spot what is undefended', [
        I('The simplest tactic: a piece that is <b>attacked but not protected</b> can be taken for free. Before each move, scan the board for "loose" pieces on both sides. This is called <b>LPDO</b>: Loose Pieces Drop Off.', ST),
        T('Black\'s bishop on a6 is attacked by your queen and nothing defends it. Take it.', '4k3/8/b7/8/8/8/8/Q3K3 w - - 0 1', ['a1a6'], 'Qxa6 wins a whole bishop. Make this scan a habit every single move.'),
        D('Spot the loose piece.', 'Hanging piece', 6),
      ]),
      L('fork', 'The fork', [
        T('A <b>fork</b> is one move that attacks two (or more) pieces at once. Knights are the great forkers because their jump is hard to see. Find the square that checks the king and attacks the rook.', 'r3k3/8/4N3/8/8/8/8/4K3 w - - 0 1', ['e6c7'], 'Nc7+ attacks the king and the rook. The king has to move, and then Nxa8 wins the rook.'),
        T('The same idea wins even more when the second target is the queen.', 'q3k3/8/4N3/8/8/8/8/4K3 w - - 0 1', ['e6c7'], 'Nc7+ forks king and queen. A fork with check wins the queen for a knight.'),
        Q('Fork or not?', 'Which piece type is best at forking because its attack is least expected?', ['Bishop', 'Knight', 'King', 'Rook'], 1, 'Knights attack in a pattern that no other piece shares, so players often overlook knight forks.'),
        D('Hunt for forks.', 'Fork', 6),
      ]),
      L('pin', 'The pin', [
        T('A <b>pin</b> freezes a piece because moving it would expose something more valuable behind it. The black knight on c6 stands in front of its king. Pin it with the bishop.', '4k3/8/2n5/8/8/8/4B3/4K3 w - - 0 1', ['e2b5'], 'Bb5 pins the knight to the king. Because it is an <i>absolute</i> pin the knight cannot legally move at all.'),
        T('Pins win material when you can attack the pinned piece again. Here the black queen is pinned to its king along the e-file. Win it.', '4k3/4q3/8/8/8/8/8/4RK2 w - - 0 1', ['e1e7'], 'Rxe7+ - the pinned queen could not move away, so you win queen for rook.'),
        Q('Absolute vs relative.', 'A pin to the KING is called...', ['Relative', 'Absolute', 'Partial', 'A skewer'], 1, 'An absolute pin is against the king, so the pinned piece truly cannot move. A relative pin is against a lesser piece, so moving is legal but costly.'),
        D('Find the pin.', 'Pin', 4),
      ]),
      L('skewer', 'The skewer', [
        T('A <b>skewer</b> is a pin in reverse: you attack a valuable piece, it has to move, and you win what stood behind it. Skewer the king and queen along the back rank.', '2k2q2/8/8/8/8/8/8/R3K3 w - - 0 1', ['a1a8'], 'Ra8+ checks the king. When it steps aside, Rxf8 wins the queen.'),
        Q('Skewer or pin?', 'What is the difference between a pin and a skewer?', ['No difference', 'In a skewer the more valuable piece is in front', 'In a pin the more valuable piece is in front', 'Skewers only use rooks'], 1, 'In a skewer the big piece is in front and must move, exposing the smaller piece behind it. In a pin the less valuable piece is in front.'),
        D('Spot the skewer.', 'Skewer', 4),
      ]),
      L('discovered', 'Discovered attacks and checks', [
        T('A <b>discovered attack</b> happens when you move one piece and unmask an attack from the piece behind it. The bishop on e2 hides the rook\'s attack on the black king. Move the bishop so it captures something AND gives check.', '4k3/8/q7/8/8/8/4B3/4RK2 w - - 0 1', ['e2a6'], 'Bxa6+ takes the queen with a discovered check from the rook. Black must answer the check, so the queen is simply lost.'),
        T('A knight is ideal for a discovered check because it can then attack something new. Move the knight with discovered check, attacking the queen.', '4k3/8/2q5/8/8/8/4N3/4RK2 w - - 0 1', ['e2d4'], 'Nd4+ unmasks the rook\'s check and the knight hits the queen. Black must deal with the check, so the queen falls.'),
        D('Unmask the attack.', 'Discovered attack', 4),
      ]),
      L('checks', 'Checks, captures, threats', [
        I('When you look for a tactic, examine forcing moves in this order: <b>Checks, Captures, Threats</b> (CCT). Forcing moves limit your opponent\'s replies, so they are easy to calculate and often win something. Quiet moves come last.', ST),
        Q('Calculation order.', 'What should you look at first when searching for a tactic?', ['Quiet positional moves', 'Checks, captures and threats', 'Pawn moves', 'Moves with the king'], 1, 'Forcing moves (checks, captures, threats) come first because your opponent has few answers, so you can calculate deeply.'),
        D('Use CCT: find the winning move.', 'Win material', 6),
      ]),
      L('backrank', 'Back-rank tactics', [
        T('A king stuck behind its own pawns on the back rank cannot escape a rook or queen check. Find the mate.', '6k1/5ppp/8/8/8/8/8/R3K3 w - - 0 1', ['a1a8'], 'Ra8#. Tip: give your own king an escape square early with h3 or g3 so this never happens to you.'),
        Q('Prevention.', 'How do you avoid back-rank mate?', ['Never castle', 'Make a luft: move h3 or g3 so the king has an escape square', 'Move all pawns', 'Trade queens'], 1, 'A "luft" (air hole) like h3 gives the king a flight square. It costs one move but saves games.'),
        D('Back-rank tactics.', 'Back-rank mate', 4),
      ]),
      L('promotion', 'Promotion tactics', [
        T('A pawn on the 7th rank is a huge threat. Promote and win. (Promotion is also the idea behind many sacrifices: give material to get a pawn to the end.)', '8/P6k/8/8/8/8/8/K7 w - - 0 1', ['a7a8q'], 'a8=Q. A passed pawn on the 7th is worth almost a queen. Push it!'),
        D('Promote!', 'Promotion', 4),
      ]),
      L('deflection', 'Deflection, decoy, overload, removing the defender', [
        I('Four ways to attack a defender: <b>Removing the defender</b> (capture or chase away the piece guarding your target). <b>Deflection</b> (force a defender to leave its post). <b>Decoy</b> (lure a piece to a bad square, such as dragging the king out). <b>Overloading</b> (a piece guards two things at once; attack one and the other falls).', ST),
        Q('Overloaded piece.', 'A black rook defends both the knight on b6 and the bishop on f6. You attack the knight. What happens?', ['Nothing', 'If the rook recaptures, it abandons the bishop', 'Black wins a piece', 'The rook becomes stronger'], 1, 'That is overloading: one defender cannot do two jobs, so you win material by attacking one target and then the other.'),
        Q('Name the idea.', 'You sacrifice a rook on d8 to drag the black queen away from guarding f7, and then capture f7 with mate. What is that called?', ['A fork', 'Deflection', 'A pin', 'Zugzwang'], 1, 'Deflection: forcing a defender away from its important job.'),
        D('Win material by hitting the defender.', 'Win material', 6),
      ]),
      L('sacrifice', 'Sacrifices for attack', [
        I('A good sacrifice gives up material for a bigger gain: a mating attack, a winning pawn, or a better position. Ask what the sacrifice <b>forces</b>: if every reply is forced and you come out ahead, it works. If your opponent has a choice, calculate each option or do not sacrifice.', ST),
        Q('Safe sacrifice?', 'Before sacrificing a piece, what must you be sure about?', ['That it looks pretty', 'That you win more back by force or get a mating attack', 'That the opponent cannot decline', 'That it is a bishop'], 1, 'A sacrifice must be calculated: you need a forced win of more material, or mate, or a clear lasting advantage.'),
        D('Sacrifice and win.', 'Sacrifice', 4),
      ]),
      L('zwischen', 'The in-between move (zwischenzug)', [
        I('Your opponent captures, you expect to recapture, but first you insert a <b>forcing move</b> (usually a check or a bigger threat) - a <b>zwischenzug</b>. It changes the order of the exchange and can win material. Whenever an obvious recapture is available, check for an in-between move first.', ST),
        Q('The habit.', 'When your opponent captures a piece of yours, what should you consider before recapturing?', ['Nothing - recapture at once', 'Whether a check or bigger threat is available first', 'Resign', 'Castle'], 1, 'Look for the in-between move: a check or a stronger capture may win more than the simple recapture.'),
      ]),
      L('mates2', 'Calculating mate in 2 and 3', [
        I('A mate in 2 is a forcing line: your move, any reply, your mating move. Start with <b>checks</b> and moves that take away the king\'s squares. If the enemy king has an escape, look for a move that leaves them no good reply (often a quiet "waiting" move).', ST),
        D('Mate in 2.', 'Mate in 2', 5),
        D('Mate in 3.', 'Mate in 3', 3),
      ]),
    ] },

    /* ===================================================== CHECKMATES ===================================================== */
    { id: 'mates', icon: '♚', title: 'Checkmate Patterns', level: 'Beginner to Intermediate', blurb: 'The mating patterns every player should know by sight, with famous examples and endless mate puzzles.', lessons: [
      L('backrankm', 'Back-rank mate', [
        T('The most common mate at every level. A king stuck behind its own pawns on the back rank cannot escape a rook or queen check. Find the mate.', '6k1/5ppp/8/8/8/8/8/R3K3 w - - 0 1', ['a1a8'], 'Ra8#. The three pawns are the king\'s prison.'),
        D('Back-rank mates.', 'Back-rank mate', 5),
      ]),
      L('smothered', 'Smothered mate', [
        T('A king boxed in by its own pieces can be mated by a lone knight, which nothing can capture or block. Find the mate.', '6rk/6pp/8/4N3/8/8/8/K7 w - - 0 1', ['e5f7'], 'Nf7# - the king has no squares and the knight cannot be taken. In real games this arrives after a queen sacrifice on g8.'),
        D('Smothered mates.', 'Smothered mate', 3),
      ]),
      L('scholars', 'Fool\'s mate and Scholar\'s mate', [
        T('The shortest game. White opened with two terrible pawn moves (f3 and g4). Black can mate in one. The lesson: never weaken the diagonal in front of your king.', 'rnbqkbnr/pppp1ppp/8/4p3/6P1/5P2/PPPPP2P/RNBQKBNR b KQkq - 0 2', ['d8h4'], 'Qh4# - the fastest possible checkmate.'),
        TM('The Scholar\'s mate (four moves) attacks f7. Black has just blundered with 3...Nf6. Finish the game.', 'e4 e5 Bc4 Nc6 Qh5 Nf6', ['h5f7'], 'Qxf7#. f7 (and f2) is the weak spot because only the king defends it at the start.'),
      ]),
      L('ladder', 'The two-rook ladder', [
        T('Two rooks can mate by taking turns cutting off ranks, like climbing a ladder. The rook on a7 already seals the seventh rank. Finish on the back rank.', '6k1/R7/8/8/8/8/8/1R4K1 w - - 0 1', ['b1b8'], 'Rb8# - one rook guards the 7th rank, the other delivers check on the 8th.'),
        I('To mate with two rooks from scratch, give check with one rook, then move the other rook one rank beyond it, and repeat. The king is driven to the edge one rank at a time. You can practise it against Moundshroud in the <b>Endgames</b> tab.', ST, {}),
      ]),
      L('queenmate', 'Mating with the queen', [
        T('King and queen can force mate against a lone king. Here the white king already holds the b7 and a7 squares; the queen delivers the final blow from far away.', 'k7/8/1K6/8/8/8/7Q/8 w - - 0 1', ['h2h8'], 'Qh8# - check along the 8th rank; the king on b6 covers a7 and b7.'),
        I('The method for K+Q vs K: use the queen to cut the king off a knight\'s move away, drive it to the edge, bring your king up, then mate. The one thing to avoid is <b>stalemate</b>: always check that your opponent still has a legal move unless it is mate. Practise in <b>Endgames</b>.', ST),
      ]),
      L('anastasia', 'Anastasia\'s mate', [
        T('A knight and a rook trap the king against its own pawn and the edge of the board. The knight on e7 covers g8 and g6; the black pawn on g7 blocks the king. Deliver the mate with the rook.', '8/4N1pk/8/8/8/8/R7/K7 w - - 0 1', ['a2h2'], 'Rh2# - the rook gives check along the h-file; the king\'s only flight squares are covered by the knight or taken by its own pawn.'),
      ]),
      L('arabian', 'Arabian mate', [
        T('The rook and knight cooperate in the corner. The knight on f6 guards h7 and g8. Mate the king on h8.', '7k/1R6/5N2/8/8/8/8/K7 w - - 0 1', ['b7h7'], 'Rh7# - the rook is protected by the knight, and the knight also covers g8. The rook on h7 takes away g7.'),
      ]),
      L('opera', 'The Opera mate', [
        TM('From the Opera Game (Morphy, 1858). White has just won a rook with a sacrifice combination. The bishop on g5 pins the black knight on d7... now it is time to finish. Find the mate.', 'e4 e5 Nf3 d6 d4 Bg4 dxe5 Bxf3 Qxf3 dxe5 Bc4 Nf6 Qb3 Qe7 Nc3 c6 Bg5 b5 Nxb5 cxb5 Bxb5+ Nbd7 O-O-O Rd8 Rxd7 Rxd7 Rd1 Qe6 Bxd7+ Nxd7 Qb8+ Nxb8', ['d1d8'], 'Rd8# - a rook mate on the back rank supported by the bishop on g5 that pins the queen\'s defender. Perhaps the most elegant finish in chess history.'),
      ]),
      L('legal', 'Légal\'s mate', [
        TM('A classic opening trap. Black\'s bishop grabbed the queen on d1: 5...Bxd1. White now plays a surprising bishop sacrifice that forces the king to e7. Find it.', 'e4 e5 Nf3 d6 Bc4 Bg4 Nc3 g6 Nxe5 Bxd1', ['c4f7'], 'Bxf7+ forces ...Ke7. Next comes a smothered-style mate with a knight.'),
        TM('...Ke7 was forced. Now finish with a knight move that gives checkmate.', 'e4 e5 Nf3 d6 Bc4 Bg4 Nc3 g6 Nxe5 Bxd1 Bxf7+ Ke7', ['c3d5'], 'Nd5# - the king is boxed in by its own pieces and the knight and bishop deliver mate. Never grab the queen without checking for tactics!'),
      ]),
      L('mate1', 'Mate in 1 practice', [
        D('Look for the one-move checkmate: check every check!', 'Mate in 1', 8),
      ]),
      L('mate2', 'Mate in 2 practice', [
        D('Find the forcing first move that leads to mate next turn.', 'Mate in 2', 6),
      ]),
      L('mate3', 'Mate in 3 practice', [
        D('Three-move mates: look for checks and sacrifices that drive the king into a net.', 'Mate in 3', 4),
      ]),
    ] },

    /* ===================================================== OPENINGS ===================================================== */
    { id: 'openings', icon: '📖', title: 'Opening Strategy', level: 'Beginner to Intermediate', blurb: 'Principles, famous traps and how to learn a repertoire. Pair this with the Openings tab to memorise specific lines.', lessons: [
      L('center', 'Controlling the centre', [
        I('A pawn on e4 or d4 controls squares in the middle of the board and gives your pieces room. Knights and bishops placed near the centre attack more squares. This is why almost every opening begins with 1.e4, 1.d4, 1.c4 or 1.Nf3.', ST, { hl: ['d4', 'e4', 'c4', 'f3'] }),
        Q('First move.', 'Which of these is a sensible first move for White?', ['1.h4', '1.e4', '1.a3', '1.Ra2'], 1, '1.e4 (or 1.d4) stakes a claim in the centre and opens lines for the bishop and queen.'),
        Q('Pawn or piece?', 'In a classical centre, you can control squares with pawns AND pieces. Which is a risk of occupying the centre with pawns too early?', ['Nothing', 'The pawns may become targets', 'You lose the right to castle', 'Your queen is blocked forever'], 1, 'A big pawn centre can be attacked and undermined. You must be ready to support it with pieces.'),
      ]),
      L('develop', 'Development and tempo', [
        I('Every opening move should bring a new piece into play or make a threat. Moving the same piece twice, or making edge-pawn moves early, loses <b>tempo</b> (time). The side that develops faster can open the position and attack before the other side is ready.', ST),
        Q('Tempo.', 'In the first moves, which is generally better?', ['Developing a new piece', 'Moving an already-developed piece again', 'Pushing the h-pawn', 'Moving the king'], 0, 'Develop a new piece with each move unless you have a strong reason not to.'),
        Q('Knights or bishops first?', 'A common guideline is to develop...', ['Queen, then rooks', 'Knights before bishops', 'Rooks before knights', 'Only pawns'], 1, 'Knights have fewer good squares, so you can usually decide their best squares earlier; bishops are decided once you know the pawn structure.'),
      ]),
      L('castle', 'Castle early, castle correctly', [
        T('Castling puts the king in a safer corner and activates the rook. Here every piece needed is developed. Castle kingside.', 'r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/3P1N2/PPP2PPP/RNBQK2R w KQkq - 0 1', ['e1g1'], 'O-O. Castle before the centre opens, then connect your rooks by developing the rest of your pieces.'),
        Q('Which side?', 'You usually castle kingside because...', ['It takes fewer moves and keeps pawns in front of the king', 'It is the only legal side', 'It is required', 'The rook is stronger there'], 0, 'Kingside castling needs only two squares to be cleared. Queenside castling is also fine but puts the king a bit farther from its pawns.'),
      ]),
      L('traps', 'Opening traps to know (and avoid)', [
        TM('<b>The Blackburne Shilling Gambit.</b> After a wild line, White\'s queenside bishop block lets Black deliver a mate with a knight. Black to move: find the checkmate.', 'e4 e5 Nf3 Nc6 Bc4 Nd4 Nxe5 Qg5 Nxf7 Qxg2 Rf1 Qxe4+ Be2', ['d4f3'], 'Nf3# - a knight mate. White grabbed too many pawns and forgot about his king.'),
        Q('<b>The Fried Liver Attack</b> (1.e4 e5 2.Nf3 Nc6 3.Bc4 Nf6 4.Ng5 d5 5.exd5 Nxd5 6.Nxf7) is a trap against the move 4...d5?. White sacrifices a knight to drag the king into the open.', 'What is Black\'s best way to avoid the Fried Liver?', ['5...Nxd5 and hope', '5...Na5! (kicking the bishop)', '5...Qxd5', '5...Bc5'], 1, 'After 4.Ng5 d5 5.exd5, the accurate reply is 5...Na5! hitting the bishop, rather than 5...Nxd5? which allows 6.Nxf7. Opening knowledge also means knowing which traps to avoid.', 'r1bqkb1r/ppp2ppp/2n5/3Pp1N1/2B5/8/PPPP1PPP/RNBQK2R b KQkq - 0 5'),
        Q('Safe play.', 'A good way to avoid falling for traps is to...', ['Memorise every trap', 'Ask what every move threatens before you reply', 'Play fast', 'Copy your opponent'], 1, 'If you always ask what the opponent\'s last move threatens, you will avoid most traps even in positions you do not know.'),
      ]),
      L('breaks', 'Pawn breaks and the centre', [
        I('A <b>pawn break</b> is a pawn move that attacks the enemy pawn structure. In many openings, Black fights the centre with ...c5 or ...d5, and White with c4, f4 or d4-d5. Knowing the typical pawn breaks of your opening tells you what plan to follow after the memorised moves are over.', ST),
        Q('Pawn breaks.', 'What is the purpose of a pawn break?', ['To win time', 'To challenge or undermine the opponent\'s pawn structure', 'To castle', 'To trade queens'], 1, 'A break attacks the enemy pawn chain, opening lines for your pieces or creating weaknesses.'),
      ]),
      L('repertoire', 'Building a repertoire', [
        I('Choose <b>one</b> opening for White, and <b>one defence</b> against 1.e4 and one against 1.d4 for Black. Learn the first 8 to 10 moves, the ideas behind them, and the typical plans. It is better to understand a few openings deeply than to memorise many lines you do not understand.', ST, { link: { tab: 'openings', label: 'Open the Openings trainer' } }),
        Q('Repertoire size.', 'For a beginner, how many openings should you try to learn as White?', ['As many as possible', 'One main opening', 'Fifteen', 'None - improvise'], 1, 'One main opening as White, and a simple defence to each of 1.e4 and 1.d4. You will learn the middlegame plans much faster.'),
      ]),
    ] },

    /* ===================================================== MIDDLEGAME ===================================================== */
    { id: 'middle', icon: '🏰', title: 'Middlegame Strategy', level: 'Intermediate', blurb: 'Plans, pawn structures, outposts, open files and king safety: what to do when the tactics run out.', lessons: [
      L('activity', 'Piece activity', [
        I('An <b>active</b> piece controls many squares and eyes targets; a <b>passive</b> piece is blocked by its own pawns or stuck guarding. In this position White\'s knight on d5 is central and active, while Black\'s bishop on c8 is hemmed in by its own pawns. Improve your worst piece first.', 'r1bqk2r/pp2bppp/2n1pn2/3N4/3P4/4B3/PP2BPPP/R2QK2R w KQkq - 0 1', { hl: ['d5', 'c8'] }),
        Q('Worst piece.', 'In a quiet position, which plan is commonly recommended?', ['Move your best piece again', 'Improve your worst-placed piece', 'Trade your best piece', 'Make a pawn move at random'], 1, 'Find your least active piece and give it a better square. A chain is as strong as its weakest link.'),
      ]),
      L('files', 'Open files and rooks', [
        I('Rooks belong on <b>open files</b> (no pawns) or <b>half-open files</b> (no pawn of your own colour) and on the 7th rank. Here the e-file is open: a rook on e1 has a clear view down the board and pressure on e8.', '4k3/pp3ppp/8/8/8/8/PP3PPP/R3K3 w - - 0 1', { hl: ['e1', 'e8'] }),
        Q('Rook placement.', 'Where does a rook usually do the most work?', ['In the corner', 'On an open or half-open file', 'Behind its own pawns', 'Next to the king'], 1, 'Rooks want open lines. Put them on open files and the 7th rank, and double them when you can.'),
        Q('The 7th rank.', 'A rook on the opponent\'s 7th rank is strong because it...', ['Attacks pawns and traps the king on the back rank', 'Cannot be captured', 'Is next to the queen', 'Controls the centre'], 0, 'On the 7th, the rook attacks the pawns that have not moved and confines the king.'),
      ]),
      L('outpost', 'Outposts and weak squares', [
        I('An <b>outpost</b> is an advanced square (usually a knight\'s) that enemy pawns can never attack. Here White\'s knight on d5 cannot be driven away by a black pawn, because Black has no c- or e-pawn left that can ever capture on d5. Outposts are brilliant homes for knights.', '4k3/pp3ppp/3p4/3N4/8/8/PPP2PPP/4K3 w - - 0 1', { hl: ['d5'] }),
        Q('Outpost.', 'What makes a square an outpost?', ['It is on the edge', 'It is protected by a pawn and cannot be attacked by enemy pawns', 'It is in the centre', 'It is on a dark square'], 1, 'A good outpost is protected by your own pawn and cannot be challenged by an enemy pawn.'),
      ]),
      L('bishops', 'Good and bad bishops, the bishop pair', [
        I('A bishop is <b>bad</b> when its own pawns stand on the same colour of squares and block it. A <b>good</b> bishop has open diagonals. Having <b>both bishops</b> (the bishop pair) is an advantage in open positions because together they cover squares of both colours.', '4k3/pp1b1ppp/8/2p5/2P5/8/PP3PPP/2B1K3 w - - 0 1', { hl: ['c4', 'c1'] }),
        Q('Bishop quality.', 'You have a bishop on light squares and most of your pawns are on light squares too. This is called...', ['A good bishop', 'A bad bishop', 'A bishop pair', 'A fianchetto'], 1, 'A "bad" bishop is blocked by its own pawns. Try to trade it or put your pawns on the other colour.'),
        Q('Bishop pair.', 'When is the bishop pair most valuable?', ['In closed positions with many pawns', 'In open positions', 'Never', 'Only in the endgame with no pawns'], 1, 'Bishops thrive on open boards with long diagonals.'),
      ]),
      L('structure', 'Pawn structure basics', [
        I('Pawns decide the character of a position and cannot move backward. Know the main features: <b>isolated</b> pawn (no friendly pawn on neighbouring files), <b>doubled</b> pawns (two on a file), <b>backward</b> pawn (stuck behind and cannot be protected by a pawn), <b>passed</b> pawn (no enemy pawn can stop it) and <b>pawn chain</b> (diagonal links). White\'s pawn on d4 is isolated here (c- and e- pawns are gone).', '4k3/pp3ppp/8/8/3P4/8/PP3PPP/4K3 w - - 0 1', { hl: ['d4'] }),
        Q('Isolated pawn.', 'An isolated pawn is a weakness because...', ['It cannot move', 'No pawn can defend it, so pieces must guard it', 'It is always lost', 'It blocks the king'], 1, 'Without neighbours it can only be defended by pieces, which ties them down. It also gives an outpost in front of it.'),
        Q('Passed pawn.', 'A passed pawn is one that...', ['Has moved two squares', 'Has no enemy pawns in front on its file or the neighbouring files', 'Is protected', 'Is on the 7th rank'], 1, 'No enemy pawn can stop it by capture or blocking, so it is a long-term trump. "Passed pawns must be pushed" - supported by pieces.'),
      ]),
      L('kingsafety', 'King safety and attacking the castled king', [
        I('A castled king with its pawns in front (f, g, h) is safe. Every pawn move near the king (g4, h6, f6) makes holes that attackers use. Attack when you have more pieces near the enemy king, and open lines (sacrifice a pawn if needed). Defend by trading attackers and keeping pawns still.', 'r1bq1rk1/ppp2ppp/2n2n2/3pp3/1b2P3/2NP1N2/PPP1BPPP/R1BQ1RK1 w - - 0 1', { hl: ['f2', 'g2', 'h2', 'f7', 'g7', 'h7'] }),
        Q('Attack rule.', 'A good time to launch an attack against the king is when...', ['You have more pieces than the defender near the king and open lines', 'You have no pieces near it', 'You have just moved your king', 'The queens are off the board'], 0, 'Superiority of force near the enemy king plus open lines is the recipe for a successful attack.'),
        Q('Pawn shield.', 'Which pawn move near your own castled king is generally risky?', ['Moving a pawn in front of it without a reason', 'Moving a rook', 'Castling', 'Developing a bishop'], 0, 'Each pawn move near your king loosens it. Move them only with a clear purpose.'),
      ]),
      L('plans', 'How to make a plan', [
        I('When there is nothing tactical, ask: <b>1. Where are the weaknesses (mine and theirs)?</b> <b>2. Where is my worst piece?</b> <b>3. What does my opponent want to do?</b> A plan can be as simple as "trade off their strong knight" or "open the c-file for my rooks". A bad plan is better than no plan.', ST),
        Q('Planning.', 'Which question helps you find a plan?', ['Where are the weaknesses in the position?', 'What will I have for dinner?', 'How can I move quickly?', 'Which piece did I move last?'], 0, 'Weaknesses (isolated pawns, weak squares, an exposed king) tell you where to aim.'),
      ]),
      L('trades', 'When to trade pieces', [
        I('Trade pieces when you are ahead in material, when your opponent is attacking, or when it removes a strong enemy piece. Avoid trades when you are behind, when you are the one attacking, or when you have the bishop pair. "When ahead, trade pieces not pawns; when behind, trade pawns not pieces."', ST),
        Q('Trading rule.', 'You are behind in material. What should you generally do?', ['Trade pieces', 'Avoid trades and keep the position complicated', 'Trade queens immediately', 'Resign'], 1, 'If you are behind you need complications, so avoid simplifying.'),
      ]),
      L('prophylaxis', 'Prophylaxis and restricting your opponent', [
        I('<b>Prophylaxis</b> means stopping your opponent\'s plan before it starts. Ask: "What does my opponent want to do next?" and make a useful move that prevents it. Restricting the enemy pieces to a few squares gives you time to build your own plan.', ST),
        Q('Prophylaxis.', 'What is prophylaxis?', ['An attack on the king', 'A move that prevents the opponent\'s plan', 'A type of endgame', 'A pawn structure'], 1, 'It is "prevention is better than cure": stop their idea first.'),
      ]),
    ] },

    /* ===================================================== ENDGAMES ===================================================== */
    { id: 'endgames', icon: '🏁', title: 'Endgame Mastery', level: 'Intermediate to Advanced', blurb: 'King and pawn endings, rooks, minor pieces and the key ideas that win and save half-points. Pair with the Endgames drills.', lessons: [
      L('eg-intro', 'Why endgames matter', [
        I('In the endgame the <b>king becomes a fighting piece</b>: bring it to the centre. Pawns become the most important material because they can promote. Most games between equal players are decided by who knows the basic endings. Learning a few key positions gives you a huge edge.', ST),
        Q('The king in the endgame.', 'In the endgame, how should you usually use your king?', ['Keep it in the corner', 'Bring it to the centre as an active piece', 'Sacrifice it', 'Keep it behind its pawns'], 1, 'With few pieces left, there is little danger of mate, so the king is a strong attacker and defender.'),
      ]),
      L('eg-kq', 'King and queen vs king', [
        T('This is the easiest win but you must avoid stalemate. Technique: restrict the king with the queen a knight\'s move away, bring your own king, then mate. Practise it in the <b>Endgames</b> tab. First, a mate-in-one to see the final pattern.', 'k7/8/1K6/8/8/8/7Q/8 w - - 0 1', ['h2h8'], 'Qh8#. The king on b6 covers a7 and b7, the queen covers the back rank.'),
        Q('Stalemate danger.', 'You have K+Q against a lone king that has no legal move but is not in check. What is the result?', ['You win', 'Draw by stalemate', 'You lose', 'Black wins'], 1, 'Always leave the lone king at least one legal move unless you give checkmate.'),
        I('Go to the <b>Endgames</b> tab and practise K+Q vs K and K+R vs K against Moundshroud until you can mate every time within about 10 moves.', ST, { link: { tab: 'endgames', label: 'Open the Endgames trainer' } }),
      ]),
      L('eg-kr', 'King and rook vs king', [
        I('Mate with K+R takes more moves. Idea: use the rook to cut the enemy king off along a rank or file, walk your king up to take the <b>opposition</b>, then give check from the side so the king is pushed back one rank at a time to the edge, and mate.', ST),
        Q('Opposition.', 'When two kings face each other with one square between them, the player who does NOT have to move is said to have...', ['The opposition', 'Zugzwang', 'A fork', 'Castling rights'], 0, 'Having the opposition means the other side must give way. It is the key to many king endings.'),
        I('Practise it against Moundshroud in the Endgames trainer.', ST, { link: { tab: 'endgames', label: 'Open the Endgames trainer' } }),
      ]),
      L('eg-kp1', 'King and pawn vs king: key squares', [
        T('The attacking king wants to reach a <b>key square</b>, usually two squares directly in front of the pawn. White\'s king on e6 stands in front of the pawn on e5 and wins whoever moves. Make progress: step diagonally forward.', '4k3/8/4K3/4P3/8/8/8/8 w - - 0 1', ['e6d6', 'e6f6'], 'Kd6 (or Kf6) keeps the king in front of the pawn and takes the opposition so the pawn can advance with support.'),
        Q('Rule of thumb.', 'In a K+P vs K ending, where do you want your king relative to the pawn?', ['Behind it', 'In front of it, on a key square', 'Far away', 'On the edge'], 1, 'The king in front of the pawn escorts it to promotion and cannot be dislodged by the defending king.'),
      ]),
      L('eg-square', 'The rule of the square', [
        I('To see whether a king can catch a passed pawn: draw a square from the pawn to the promotion square. If the defending king can step into the square on its move, it catches the pawn. Here the pawn on a4 needs four moves to promote on a8, so the square runs from a4 to e8 (a4-e4-e8-a8). The black king on e5 is inside it, so Black moves and catches the pawn.', '8/8/8/4k3/P7/8/8/7K b - - 0 1', { hl: ['a4', 'e4', 'e8', 'a8'] }),
        Q('Rule of the square.', 'The rule of the square helps you decide...', ['If a king can catch a passed pawn', 'Which piece to trade', 'How to castle', 'How to promote'], 0, 'Count the pawn\'s moves to promote and see if the king can reach the "square" in time.'),
      ]),
      L('eg-lucena', 'Rook endings: the Lucena position', [
        I('The most important winning position in rook endings. White has a pawn on the 7th rank and the king in front of it on the promotion square corner, but the enemy rook cuts the king off. The plan is to <b>build a bridge</b>: bring your rook to the 4th rank, then step out and shield your king from checks. Practise it against Moundshroud in the Endgames trainer.', '1K1k4/1P6/8/8/8/8/r7/5R2 w - - 0 1'),
        Q('Lucena.', 'What is the key manoeuvre in the Lucena position?', ['Sacrifice the rook', 'Build a bridge with the rook on the 4th rank', 'Push the king back', 'Offer a draw'], 1, 'The rook on the 4th rank blocks the checks so the king can leave its hiding place and the pawn can promote.'),
        I('Practise the Lucena position against Moundshroud.', ST, { link: { tab: 'endgames', label: 'Open the Endgames trainer' } }),
      ]),
      L('eg-rook', 'Rook endings: general rules', [
        Q('Active rook.', 'In rook endings, which rule is often quoted?', ['Rooks belong behind passed pawns', 'Rooks belong in front of their pawns', 'Keep rooks in the corners', 'Never trade rooks'], 0, '"Rooks belong behind passed pawns" - yours or your opponent\'s - to support or stop them along the file.'),
        Q('Rook activity.', 'It is usually better to have an active rook and be a pawn down than a passive rook and be a pawn up. True?', ['Often true - activity matters a lot', 'Never true', 'Only with queens on', 'Only in the opening'], 0, 'Rook activity is so important that sacrificing a pawn for an active rook is often right.'),
        Q('Cutting off the king.', 'Cutting the enemy king off along a file with your rook helps your...', ['Passed pawn to advance', 'King to castle', 'Queen to promote', 'Bishop'], 0, 'A cut-off king cannot cross the file, so your pawn can run.'),
      ]),
      L('eg-minor', 'Bishops, knights and opposite-coloured bishops', [
        I('Bishops are usually better than knights in open endings with pawns on both sides; knights are better in closed positions. <b>Opposite-coloured bishop</b> endings are very drawish: even two pawns up can be a draw, because the defender\'s bishop controls the colour the pawns cannot cross.', ST),
        Q('Drawish.', 'Which ending is notoriously drawish even when one side is a pawn or two up?', ['Rook ending', 'Opposite-coloured bishops', 'Queen ending', 'Knight vs bishop'], 1, 'The defender can set up a fortress with the bishop on a colour the attacker\'s bishop cannot challenge.'),
        Q('Knight or bishop.', 'In an open position with pawns on both wings, which minor piece is usually better?', ['Bishop', 'Knight', 'Equal always', 'Neither'], 0, 'Bishops are long-range pieces and thrive when lines are open.'),
      ]),
      L('eg-zug', 'Zugzwang and triangulation', [
        I('<b>Zugzwang</b> is a position in which any move makes your situation worse - and you must move. It is common in king and pawn endings. <b>Triangulation</b> is when your king takes a three-move route to reach the same square, losing a move on purpose to hand the move (and the zugzwang) to your opponent.', ST),
        Q('Zugzwang.', 'In zugzwang, the player to move...', ['Would like to pass but must move and loses something', 'Is checkmated', 'Gets an extra move', 'Can resign only'], 0, 'Passing is not allowed, so a move that harms you becomes forced.'),
        Q('Triangulation.', 'The aim of triangulation is to...', ['Lose a tempo to change who is to move', 'Win a rook', 'Castle faster', 'Offer a draw'], 0, 'By losing a move on purpose, you reach the same position but with the opponent to move - in zugzwang.'),
      ]),
      L('eg-practice', 'Endgame practice', [
        I('Now put it all together. The Endgames tab has positions to play against Moundshroud at full strength: king and queen, king and rook, two rooks, and the Lucena position. Aim to win or draw each one reliably. These positions come up in real games again and again.', ST, { link: { tab: 'endgames', label: 'Open the Endgames trainer' } }),
        D('Endgame puzzles.', 'Endgame', 5),
      ]),
    ] },

    /* ===================================================== THINKING ===================================================== */
    { id: 'think', icon: '🧠', title: 'Thinking and Calculation', level: 'All levels', blurb: 'How to choose a move: candidate moves, calculation, blunder checks and learning from your games.', lessons: [
      L('candidates', 'Candidate moves', [
        I('Do not play the first good-looking move. List two to four <b>candidate moves</b> (checks, captures, threats, then improving moves) and compare them. This is the difference between hoping and calculating.', ST),
        Q('Candidates.', 'What is a candidate move?', ['A move you actually play', 'A move worth considering', 'A forced move', 'A bad move'], 1, 'Candidates are the moves you think are worth examining. Then pick the best after calculating.'),
      ]),
      L('calc', 'Calculating variations', [
        I('Calculate forcing lines to the end and check the final position: who is better? Do not stop mid-way. Visualise the board after each move. If a line is too complicated, ask whether a simpler move reaches the same goal. Practise by solving puzzles <b>without moving the pieces</b>: look first, then move.', ST),
        D('Calculate before you move.', 'Mate in 2', 5),
        Q('Calculation habit.', 'How deep should you calculate a forcing line?', ['One move', 'Until the position is calm (no more checks or captures)', 'Ten moves always', 'Not at all'], 1, 'Calculate until the position settles, so you can evaluate the final position fairly.'),
      ]),
      L('evaluate', 'Evaluating a position', [
        I('A simple checklist: <b>1. Material</b> (who is ahead?) <b>2. King safety</b> <b>3. Piece activity</b> <b>4. Pawn structure</b> <b>5. Space and control of the centre</b>. If one side leads in several, that side has the advantage and should look for a plan to cash it in.', ST),
        Q('Checklist.', 'Which is NOT on the usual evaluation checklist?', ['Material', 'King safety', 'The colour of the pieces\' logos', 'Pawn structure'], 2, 'Material, king safety, activity, structure and space are the five main factors.'),
      ]),
      L('blunders', 'Avoiding blunders', [
        I('Most club games are decided by a blunder, not a brilliant combination. Build a habit: before every move check <b>checks, captures and threats</b> against you (their answer to your move) and make sure your move does not hang a piece. When you are winning, slow down and play safe moves.', ST),
        Q('Winning position.', 'You are completely winning. What should you do?', ['Play fast to finish quickly', 'Slow down, look for threats and play safe moves', 'Offer a draw', 'Sacrifice for fun'], 1, 'Many games are lost from winning positions by carelessness. Spend more time when the position is critical.'),
        D('Spot the tactic.', 'Win material', 6),
      ]),
      L('review', 'Learning from your games', [
        I('The fastest way to improve is to review your own games, especially your losses. Use the <b>Analysis</b> tab to find the moments where the evaluation swung, ask the AI coach what to learn from them, and note the pattern (hanging pieces, missed forks, back-rank). Then train that pattern with the puzzle themes.', ST, { link: { tab: 'analysis', label: 'Open Analysis' } }),
        Q('Review.', 'Which games are most useful to review?', ['Only wins', 'Especially your losses', 'Only blitz games', 'None'], 1, 'Losses show where your understanding or concentration breaks down.'),
      ]),
    ] },

    /* ===================================================== FUN ===================================================== */
    { id: 'fun', icon: '🎈', title: 'Fun & Games', level: 'All ages', blurb: 'Playful lessons with stories, little challenges and quick wins. Perfect when you want to learn without the pressure.', lessons: [
      L('army', 'Meet the army', [
        I('Every chess piece has a personality. Let\'s meet the army! You will command <b>16 pieces</b>: one king, one queen, two rooks, two bishops, two knights and eight pawns. Click through to meet them.', ST),
        { t: '<b>The King</b> 👑 is the shy leader. He only takes one tiny step at a time, but if he is captured the game is over, so everyone protects him. Try moving him!', f: '7k/8/8/8/3K4/8/8/8 w - - 0 1', ex: 1 },
        { t: '<b>The Queen</b> 💃 is the superstar. She goes anywhere in a straight line: sideways, up, down or diagonally. Nobody moves faster. Try her out!', f: '7k/8/8/3Q4/8/8/8/K7 w - - 0 1', ex: 1 },
        { t: '<b>The Rook</b> 🏰 is the tower. He only travels in straight lines, but he does it with power. Rooks love open roads.', f: '7k/8/8/3R4/8/8/8/K7 w - - 0 1', ex: 1 },
        { t: '<b>The Bishop</b> 🎩 loves diagonals and never leaves his colour. One bishop lives on light squares, the other on dark squares.', f: '7k/8/8/3B4/8/8/8/K7 w - - 0 1', ex: 1 },
        { t: '<b>The Knight</b> 🐴 is the trickster. He hops in an L-shape and jumps right over other pieces. Nobody sees him coming!', f: '7k/8/8/3N4/8/8/8/K7 w - - 0 1', ex: 1 },
        { t: '<b>The Pawns</b> 🛡️ are the foot soldiers. They walk forward one step (two on their first move) and capture sideways. If a pawn marches all the way across the board, it becomes a queen. Try capturing the black pawn!', f: '7k/8/8/8/8/3p4/4P3/K7 w - - 0 1', ex: 1 },
        Q('Pop quiz!', 'Which piece jumps over other pieces?', ['The bishop', 'The knight', 'The rook'], 1, 'Only the knight can jump. Everyone else needs a clear path.'),
      ]),
      L('quest', 'The knight\'s quest', [
        I('Once upon a time, a brave knight set out on a quest to visit every square of a giant checkered kingdom exactly once. This is a real puzzle called the <b>Knight\'s Tour</b>, and mathematicians have loved it for over a thousand years.', ST, { hl: ['a1', 'h8'] }),
        Q('A knight\'s journey.', 'How does a knight move?', ['One square in any direction', 'Two squares one way and one square sideways, in an L-shape', 'Any distance along a diagonal'], 1, 'The L-shape: two squares in one direction, then one square at a right angle.'),
        Q('Think like a knight.', 'A knight stands in the very middle of the board. About how many squares can it jump to?', ['2', '4', '8'], 2, 'From the centre a knight has up to 8 possible jumps. In a corner it only has 2, which is why corners are tricky in the tour!'),
        I('Ready for the real thing? Try the <b>Knight\'s Tour</b> mini-game. Hint: it is usually best to go to the square with the fewest exits first, so you never get stuck.', ST, { link: { tab: 'minis', label: 'Open the mini-games' } }),
      ]),
      L('pawnhero', 'The pawn who became a queen', [
        I('Every pawn dreams of reaching the far side of the board. Why? Because there, a pawn is <b>promoted</b>: it can become a queen, the strongest piece of all! Many games are won by a brave little pawn.', ST),
        T('Help this pawn finish its journey. It is one step from the last rank. Promote it to a queen!', '8/4P1k1/8/8/8/8/8/4K3 w - - 0 1', ['e7e8q'], 'e8=Q! The pawn became a queen. Promoting is one of the happiest moments in chess.'),
        T('Now a trickier one: this pawn can promote and capture at the same time! Which move does it?', '3r4/4P1k1/8/8/8/8/8/4K3 w - - 0 1', ['e7d8q'], 'exd8=Q captures the rook AND promotes. Always look for double wins like this.'),
        Q('Quick question.', 'What can a pawn turn into when it reaches the last rank?', ['Only a queen', 'A queen, rook, bishop or knight', 'A king'], 1, 'You can choose a queen, rook, bishop or knight. Almost everyone picks a queen.'),
      ]),
      L('traps', 'Sneaky traps', [
        I('Chess is full of sneaky traps that catch beginners. If you know them, you can <b>set</b> them for your friends and avoid them yourself. Here are two of the most famous ones.', ST),
        T('The <b>Fool\'s Mate</b> is the quickest checkmate in chess. White played two terrible pawn moves. Black to move: deliver mate!', 'rnbqkbnr/pppp1ppp/8/4p3/6P1/5P2/PPPPP2P/RNBQKBNR b KQkq - 0 2', ['d8h4'], 'Qh4# - checkmate in just two moves! Never open the diagonal to your king like that.'),
        TM('The <b>Scholar\'s Mate</b> goes after f7. Black has just made a mistake. Finish the game!', 'e4 e5 Bc4 Nc6 Qh5 Nf6', ['h5f7'], 'Qxf7# - the queen and bishop team up. Next time, defend f7!'),
        Q('Trap check.', 'Which square is the weak spot that these quick traps aim at?', ['The f7 (or f2) pawn', 'The a-pawn', 'The centre'], 0, 'At the start, the f-pawn is protected only by the king, so it is the favourite target of quick attacks.'),
      ]),
      L('quiz', 'Chess quiz show', [
        Q('Question 1', 'How many squares are on a chessboard?', ['32', '64', '100'], 1, '8 times 8 makes 64 squares, half light and half dark.'),
        Q('Question 2', 'Which piece starts the game on the square next to the king?', ['The queen', 'The bishop', 'The knight'], 0, 'The queen sits next to the king on the starting row. A good memory trick: "the queen goes on her own colour".'),
        Q('Question 3', 'What is it called when the king is attacked and cannot escape?', ['Stalemate', 'Checkmate', 'Castling'], 1, 'Checkmate ends the game. The word comes from a Persian phrase meaning "the king is helpless".'),
        Q('Question 4', 'Which piece is worth the most points (not counting the king)?', ['Rook', 'Queen', 'Bishop'], 1, 'The queen is worth about nine pawns.'),
        Q('Question 5', 'What is the special move where the king and rook switch places called?', ['Promotion', 'En passant', 'Castling'], 2, 'Castling tucks the king away safely and brings out a rook.'),
        Q('Question 6', 'A draw happens when a player has no legal move but is not in check. It is called...', ['Zugzwang', 'Stalemate', 'A fork'], 1, 'Stalemate is a tie. Be careful when you are far ahead!'),
      ]),
      L('speed', 'Speed drills', [
        I('Time to turn on your tactics radar! These drills give you brand-new puzzles that are generated on the spot. Solve them to finish the lesson. Quick, but look carefully!', ST),
        D('Spot the one-move checkmate!', 'Mate in 1', 5),
        D('Find the fork!', 'Fork', 3),
      ]),
      L('coords', 'Find the square', [
        I('Every square has a name: a letter for the column (a to h) and a number for the row (1 to 8). Knowing them makes reading chess books and notation easy. e4 is the famous square in front of the king!', ST, { hl: ['e4'] }),
        Q('Name that square.', 'The bottom-left corner square from White\'s point of view is...', ['a1', 'h1', 'a8'], 0, 'a1 is the bottom-left corner. It is always a dark square.'),
        Q('Name that square.', 'The square right in front of the white king at the start (two steps forward) is...', ['d4', 'e4', 'e5'], 1, 'The king starts on e1; the pawn in front of him starts on e2 and 1.e4 is the most popular first move.'),
        I('Think you know them? Try <b>Coordinate Sniper</b> and see how many squares you can name in 30 seconds!', ST, { link: { tab: 'minis', label: 'Open the mini-games' } }),
      ]),
      L('captures', 'Capture practice', [
        I('Taking pieces is how you win material. But always ask: <b>is it safe?</b> Free pieces (ones nobody protects) are the best, and a trade can be great or terrible depending on what the pieces are worth.', ST),
        T('Look! A black rook is just sitting there with nobody protecting it. Take it with your rook!', '4k3/8/8/8/3r4/8/8/3RK3 w - - 0 1', ['d1d4'], 'Free rook! Before you capture, always check if the piece is protected. This one was not.'),
        T('Now a queen spots a loose bishop on the long diagonal. Take it!', '4k3/8/8/2b5/8/8/8/2Q1K3 w - - 0 1', ['c1c5'], 'Qxc5+ wins the bishop AND gives check. Free pieces are the best pieces to capture.'),
      ]),
    ] },
  ];

  /* ===================================================== FAMOUS GAMES ===================================================== */
  const games = [
    { id: 'opera', name: 'The Opera Game', c: 1, who: 'Paul Morphy vs the Duke of Brunswick and Count Isouard, Paris, 1858', idea: 'Played in a box at the Paris opera while the performance went on. A model of rapid development and a sparkling finish.', m: 'e4 e5 Nf3 d6 d4 Bg4 dxe5 Bxf3 Qxf3 dxe5 Bc4 Nf6 Qb3 Qe7 Nc3 c6 Bg5 b5 Nxb5 cxb5 Bxb5+ Nbd7 O-O-O Rd8 Rxd7 Rxd7 Rd1 Qe6 Bxd7+ Nxd7 Qb8+ Nxb8 Rd8#',
      notes: { 4: 'Black plays the Philidor Defence. White will grab the centre with d4.', 9: 'Morphy trades his knight and opens lines with the queen.', 11: 'Develop with threats: the bishop eyes f7.', 19: 'Morphy sacrifices a knight to rip open the black king\'s defences.', 23: 'White castles queenside, bringing a rook to the d-file with tempo.', 31: 'The queen sacrifice! Qb8+ forces the knight to capture, and the back rank is bare.' } },
    { id: 'immortal', name: 'The Immortal Game', c: 1, who: 'Adolf Anderssen vs Lionel Kieseritzky, London, 1851', idea: 'A friendly game in which White sacrifices two rooks and a queen to win with three minor pieces. The ultimate romantic attacking game.', m: 'e4 e5 f4 exf4 Bc4 Qh4+ Kf1 b5 Bxb5 Nf6 Nf3 Qh6 d3 Nh5 Nh4 Qg5 Nf5 c6 g4 Nf6 Rg1 cxb5 h4 Qg6 h5 Qg5 Qf3 Ng8 Bxf4 Qf6 Nc3 Bc5 Nd5 Qxb2 Bd6 Bxg1 e5 Qxa1+ Ke2 Na6 Nxg7+ Kd8 Qf6+ Nxf6 Be7#',
      notes: { 3: 'The King\'s Gambit: White sacrifices a pawn for rapid development.', 6: 'Black checks the king; White allows it and keeps developing.', 19: 'White ignores material, pushing pawns to attack the knight and the queen.', 35: 'Bd6!! White lets Black take his rook on g1 and even leaves the other rook hanging.', 41: 'Nxg7+ drags the king out. Black has won two rooks, but White\'s three minor pieces are closing in.', 43: 'Qf6+!! The queen sacrifice that forces the final mate.' } },
    { id: 'evergreen', name: 'The Evergreen Game', c: 1, who: 'Adolf Anderssen vs Jean Dufresne, Berlin, 1852', idea: 'Famous for its beautiful combination at the end: a queen sacrifice followed by a bishop mate. The name means it stays fresh forever.', m: 'e4 e5 Nf3 Nc6 Bc4 Bc5 b4 Bxb4 c3 Ba5 d4 exd4 O-O d3 Qb3 Qf6 e5 Qg6 Re1 Nge7 Ba3 b5 Qxb5 Rb8 Qa4 Bb6 Nbd2 Bb7 Ne4 Qf5 Bxd3 Qh5 Nf6+ gxf6 exf6 Rg8 Rad1 Qxf3 Rxe7+ Nxe7 Qxd7+ Kxd7 Bf5+ Ke8 Bd7+ Kf8 Bxe7#',
      notes: { 7: 'The Evans Gambit: a pawn is offered to open the position.', 14: 'Black pushes a pawn to d3, but White gets a big attack.', 33: 'Nf6+! A knight sacrifice opens the g-file and breaks the king\'s shelter.', 39: 'Rxe7+! The rook sacrifice begins the final combination.', 41: 'Qxd7+!! The queen sacrifice that lets the bishops do the work.' } },
    { id: 'lasker', name: 'Lasker\'s Combination', c: 1, who: 'Edward Lasker vs Sir George Thomas, London, 1912', idea: 'White sacrifices the queen on h7 to start a king hunt that ends in checkmate with the king dragged all the way up the board.', m: 'd4 e6 Nf3 f5 Nc3 Nf6 Bg5 Be7 Bxf6 Bxf6 e4 fxe4 Nxe4 b6 Ne5 O-O Bd3 Bb7 Qh5 Qe7 Qxh7+ Kxh7 Nxf6+ Kh6 Neg4+ Kg5 h4+ Kf4 g3+ Kf3 Be2+ Kg2 Rh2+ Kg1 Kd2#',
      notes: { 19: 'White prepares the sacrifice with Bd3 and Qh5.', 21: 'Qxh7+!! The queen sacrifice drags the king into the open.', 25: 'The king hunt begins: knight checks drive the king up the board.', 35: 'The king has been walked all the way to g1, and now the white king itself delivers mate.' } },
    { id: 'fischer', name: 'The Game of the Century', c: -1, who: 'Donald Byrne vs Bobby Fischer (13 years old), New York, 1956', idea: 'A 13-year-old Fischer sacrifices his queen for a decisive attack. A masterpiece of piece coordination that outplays a strong International Master.', m: 'Nf3 Nf6 c4 g6 Nc3 Bg7 d4 O-O Bf4 d5 Qb3 dxc4 Qxc4 c6 e4 Nbd7 Rd1 Nb6 Qc5 Bg4 Bg5 Na4 Qa3 Nxc3 bxc3 Nxe4 Bxe7 Qb6 Bc4 Nxc3 Bc5 Rfe8+ Kf1 Be6 Bxb6 Bxc4+ Kg1 Ne2+ Kf1 Nxd4+ Kg1 Ne2+ Kf1 Nc3+ Kg1 axb6 Qb4 Ra4 Qxb6 Nxd1 h3 Rxa2 Kh2 Nxf2 Re1 Rxe1 Qd8+ Bf8 Nxe1 Bd5 Nf3 Ne4 Qb8 b5 h4 h5 Ne5 Kg7 Kg1 Bc5+ Kf1 Ng3+ Ke1 Bb4+ Kd1 Bb3+ Kc1 Ne2+ Kb1 Nc3+ Kc1 Rc2#',
      notes: { 8: 'Fischer chooses the Grunfeld setup and castles. Byrne has a nice centre.', 26: 'Black grabs a pawn on e4: the knight will become a monster in the attack.', 34: '17...Be6!! The key move. Black offers his queen for a huge attack on the white king.', 36: 'After the bishop captures with check, White\'s king is stuck and the black pieces swarm.', 82: 'Black finishes with a king hunt and a rook mate on c2.' } },
    { id: 'topalov', name: 'Kasparov\'s Immortal', c: 1, who: 'Garry Kasparov vs Veselin Topalov, Wijk aan Zee, 1999', idea: 'A rook sacrifice on d4, followed by a king hunt across the whole board. Many chess players consider this the greatest attacking game of the modern era.', m: "e4 d6 d4 Nf6 Nc3 g6 Be3 Bg7 Qd2 c6 f3 b5 Nge2 Nbd7 Bh6 Bxh6 Qxh6 Bb7 a3 e5 O-O-O Qe7 Kb1 a6 Nc1 O-O-O Nb3 exd4 Rxd4 c5 Rd1 Nb6 g3 Kb8 Na5 Ba8 Bh3 d5 Qf4+ Ka7 Rhe1 d4 Nd5 Nbxd5 exd5 Qd6 Rxd4 cxd4 Re7+ Kb6 Qxd4+ Kxa5 b4+ Ka4 Qc3 Qxd5 Ra7 Bb7 Rxb7 Qc4 Qxf6 Kxa3 Qxa6+ Kxb4 c3+ Kxc3 Qa1+ Kd2 Qb2+ Kd1 Bf1 Rd2 Rd7 Rxd7 Bxc4 bxc4 Qxh8 Rd3 Qa8 c3 Qa4+ Ke1 f4 f5 Kc1 Rd2 Qa7",
      notes: { 6: 'Topalov plays the Pirc Defence. Kasparov chooses the Austrian setup with Be3, Qd2 and f3 and prepares to attack on the kingside.', 15: 'Bh6! White trades off the defender of the dark squares around the black king.', 26: 'Topalov castles long, right into the attack that follows.', 43: 'Nd5! A knight sacrifice that opens the d-file and the a2-g8 diagonal.', 47: 'Rxd4!! The famous rook sacrifice. Black must take it, and the king is dragged into the open.', 49: 'Re7+! Check after check keeps the black king running.', 61: 'Qxf6! One more quiet-looking capture keeps all the threats alive.', 87: 'Topalov resigned. White is a rook up and Black\'s king is still exposed.' } },
    { id: 'deepblue', name: 'Deep Blue vs Kasparov, Game 6', c: 1, who: 'Deep Blue vs Garry Kasparov, New York, 1997', idea: 'The decisive game of the match in which a computer beat the reigning world champion for the first time. Kasparov, mixing up his opening preparation, was crushed in just 19 moves.', m: "e4 c6 d4 d5 Nc3 dxe4 Nxe4 Nd7 Ng5 Ngf6 Bd3 e6 N1f3 h6 Nxe6 Qe7 O-O fxe6 Bg6+ Kd8 Bf4 b5 a4 Bb7 Re1 Nd5 Bg3 Kc8 axb5 cxb5 Qd3 Bc6 Bf5 exf5 Rxe7 Bxe7 c4",
      notes: { 14: 'Kasparov plays 7...h6?, a known inaccuracy mixed up with another line. It allows a sacrifice.', 15: 'Nxe6! The knight sacrifice that wins the game by force.', 19: 'Bg6+ drives the king to d8, where it will be stuck for the rest of the game.', 35: 'Rxe7! A final exchange breaks the defence.', 37: 'Kasparov resigned. Deep Blue won the match 3.5-2.5.' } },
    { id: 'reti', name: 'Reti vs Tartakower', c: 1, who: 'Richard Reti vs Savielly Tartakower, Vienna, 1910', idea: 'One of the most famous short games ever: White sacrifices his queen on move 9 and mates in two more moves. A great lesson in why you must check every capture, even a "free" one.', m: "e4 c6 d4 d5 Nc3 dxe4 Nxe4 Nf6 Qd3 e5 dxe5 Qa5+ Bd2 Qxe5 O-O-O Nxe4 Qd8+ Kxd8 Bg5+ Kc7 Bd8#",
      notes: { 8: 'Black has just grabbed a pawn with the queen. White castles queenside, bringing the rook to the d-file.', 17: 'Qd8+!! The queen sacrifice. If Black takes, a bishop will mate.', 19: 'Bg5+ forces the king to c7, where it has no escape.', 21: 'Bd8# - checkmate with a bishop and the rook on d1 doing the rest.' } },
    { id: 'rubinstein', name: 'Rubinstein\'s Immortal', c: -1, who: 'Georg Rotlewi vs Akiba Rubinstein, Lodz, 1907', idea: 'Rubinstein, playing Black, sacrifices both rooks and wins with a crushing attack on the queenside and the white king.', m: "d4 d5 Nf3 e6 e3 c5 c4 Nc6 Nc3 Nf6 dxc5 Bxc5 a3 a6 b4 Bd6 Bb2 O-O Qd2 Qe7 Bd3 dxc4 Bxc4 b5 Bd3 Rd8 Qe2 Bb7 O-O Ne5 Nxe5 Bxe5 f4 Bc7 e4 Rac8 e5 Bb6+ Kh1 Ng4 Be4 Qh4 g3 Rxc3 gxh4 Rd2 Qxd2 Bxe4+ Qg2 Rh3",
      notes: { 22: 'Rubinstein takes the c4 pawn and begins to build threats against the white king.', 44: 'Rxc3!! The first rook sacrifice. After gxh4 the white king is exposed.', 46: 'Rd2!! A second rook sacrifice, and now the white queen is lost.', 48: 'Bxe4+! Black wins the queen and keeps the attack going.', 50: 'Rh3! White resigned: Black has too much material for the queen and still threatens mate.' } },
    { id: 'spassky', name: 'Fischer vs Spassky, 1972, Game 6', c: 1, who: 'Bobby Fischer vs Boris Spassky, Reykjavik, 1972 (World Championship, Game 6)', idea: 'Fischer, who had never opened with 1.c4 in a serious game, plays one of the most beautiful positional games ever. Even his opponent applauded.', m: "c4 e6 Nf3 d5 d4 Nf6 Nc3 Be7 Bg5 O-O e3 h6 Bh4 b6 cxd5 Nxd5 Bxe7 Qxe7 Nxd5 exd5 Rc1 Be6 Qa4 c5 Qa3 Rc8 Bb5 a6 dxc5 bxc5 O-O Ra7 Be2 Nd7 Nd4 Qf8 Nxe6 fxe6 e4 d4 f4 Qe7 e5 Rb8 Bc4 Kh8 Qh3 Nf8 b3 a5 f5 exf5 Rxf5 Nh7 Rcf1 Qd8 Qg3 Re7 h4 Rbb7 e6 Rbc7 Qe5 Qe8 a4 Qd8 R1f2 Qe8 R2f3 Qd8 Bd3 Qe8 Qe4 Nf6 Rxf6 gxf6 Rxf6 Kg8 Bc4 Kh8 Qf4",
      notes: { 1: 'Fischer opens with 1.c4 for the first time in his career. It was a surprise to Spassky.', 37: 'Nxe6! Fischer trades his strong knight for a bishop to open the f-file.', 39: 'e4! A central pawn break, taking advantage of the opened files.', 63: 'Qe5! The queen centralised: threatening everything on the kingside.', 75: 'Rxf6! A final exchange breaks Black\'s defences and wins material.', 81: 'Spassky resigned and joined the audience in applauding Fischer.' } },
  ];

  window.CHESS_COURSES = courses; window.CHESS_GAMES = games;
})();

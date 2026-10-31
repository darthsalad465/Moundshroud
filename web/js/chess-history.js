// Chess hub > 🏛 History: timeline, world champions, legends, glossary, "Moments of genius" (find the master's move) and a history quiz.
(() => {
  const UI = window.ChessUI, C = Chess; if (!UI) return;
  const TIMELINE = [
    ['c. 600', 'Chess begins in India as chaturanga, "four divisions of the army" (infantry, cavalry, elephants, chariots): the ancestors of the pawn, knight, bishop and rook.'],
    ['c. 600-800', 'The game travels to Persia as shatranj. Here "check" (shah, king) and "checkmate" (shah mat, "the king is helpless") get their names.'],
    ['c. 1000', 'Chess spreads through the Islamic world and enters Europe through Spain and Italy. Over time the vizier piece turns into the queen.'],
    ['c. 1475', 'In Spain and Italy the modern rules appear: the queen and bishop become powerful long-range pieces and the game speeds up. It was nicknamed "mad queen chess".'],
    ['c. 1497', 'Luis Ramirez de Lucena\'s book is printed in Salamanca, among the oldest printed chess books. The "Lucena position" in rook endgames is still taught.'],
    ['1561', 'Ruy Lopez, a Spanish priest, publishes a book of chess analysis. The Ruy Lopez opening still carries his name.'],
    ['1749', 'Francois-Andre Danican Philidor publishes his famous analysis of the game and teaches that pawns are "the soul of chess".'],
    ['1770', 'The Turk, a "chess-playing machine" built by Wolfgang von Kempelen, starts touring Europe. It was a hoax: a hidden human played the moves.'],
    ['1834', 'La Bourdonnais and McDonnell play a famous series of matches in London, one of the first sets of master games to be widely recorded.'],
    ['1849-50', 'The Staunton chess set appears. Its clear, balanced shapes make it the standard design for tournaments, and it still is.'],
    ['1851', 'The first international chess tournament is held in London. Adolf Anderssen wins and is seen as the best player in the world.'],
    ['1858', 'Paul Morphy, a young American from New Orleans, defeats Europe\'s best players and is regarded as the unofficial world champion.'],
    ['1886', 'Wilhelm Steinitz beats Johannes Zukertort in the first match widely accepted as a World Championship.'],
    ['1894', 'Emanuel Lasker beats Steinitz and begins a reign of nearly 27 years, the longest of any champion.'],
    ['1921', 'Jose Raul Capablanca of Cuba becomes champion. He is famous for his almost flawless technique.'],
    ['1924', 'FIDE, the World Chess Federation, is founded in Paris on 20 July to organise chess worldwide.'],
    ['1927', 'The first Women\'s World Championship is won by Vera Menchik. In the same year Alexander Alekhine takes the men\'s title from Capablanca.'],
    ['1948', 'After Alekhine\'s death in 1946, FIDE organises a tournament to choose a new champion. Mikhail Botvinnik wins and the era of Soviet dominance begins.'],
    ['1950', 'FIDE awards the first Grandmaster titles.'],
    ['1970', 'FIDE adopts the Elo rating system, created by the physicist Arpad Elo, to measure playing strength.'],
    ['1972', 'Bobby Fischer beats Boris Spassky in Reykjavik, ending a long period of Soviet control and starting a worldwide chess boom.'],
    ['1975', 'Fischer does not defend his title. Anatoly Karpov becomes World Champion without playing.'],
    ['1985', 'Garry Kasparov, aged 22, becomes the youngest World Champion to that date.'],
    ['1996-97', 'IBM\'s Deep Blue beats Kasparov in a game in 1996 and wins a six-game match in 1997, the first time a computer beats the reigning champion in a match.'],
    ['2006', 'Deep Fritz defeats World Champion Vladimir Kramnik in a match. After this, the best humans no longer beat the best chess programs.'],
    ['2013', 'Magnus Carlsen of Norway becomes World Champion. He holds the title for ten years and reaches the highest rating ever, 2882.'],
    ['2017', 'DeepMind\'s AlphaZero teaches itself chess from scratch in hours and beats a top engine, showing a bold and very human-looking attacking style.'],
    ['2020', 'Online chess booms during lockdowns, helped by the TV drama The Queen\'s Gambit.'],
    ['2023', 'Ding Liren of China becomes World Champion after Magnus Carlsen chooses not to defend his title.'],
    ['2024', 'Gukesh Dommaraju of India becomes, at 18, the youngest undisputed World Champion in history.'],
  ];
  const CHAMPS = [
    ['Wilhelm Steinitz', '1886-1894', 'Austria / USA', 'Founded positional chess: collect small advantages, then attack.'],
    ['Emanuel Lasker', '1894-1921', 'Germany', 'A fighter who played the opponent, not just the board. Also a mathematician.'],
    ['Jose Raul Capablanca', '1921-1927', 'Cuba', 'Crystal-clear technique, especially in endgames.'],
    ['Alexander Alekhine', '1927-1935, 1937-1946', 'Russia / France', 'Dazzling attacking combinations. Died as champion.'],
    ['Max Euwe', '1935-1937', 'Netherlands', 'A maths teacher who beat Alekhine in 1935. Later FIDE president.'],
    ['Mikhail Botvinnik', '1948-1957, 1958-1959, 1961-1963', 'USSR', 'Scientific preparation. Trained Karpov, Kasparov and Kramnik.'],
    ['Vasily Smyslov', '1957-1958', 'USSR', 'Smooth, harmonious style; a gifted endgame player and singer.'],
    ['Mikhail Tal', '1960-1961', 'USSR (Latvia)', 'The "Magician from Riga": wild sacrificial attacks.'],
    ['Tigran Petrosian', '1963-1969', 'USSR (Armenia)', 'Iron defence. Almost impossible to attack.'],
    ['Boris Spassky', '1969-1972', 'USSR', 'A universal player, equally at home attacking or defending.'],
    ['Bobby Fischer', '1972-1975', 'USA', 'Won in 1972; his match with Spassky was front-page news worldwide.'],
    ['Anatoly Karpov', '1975-1985', 'USSR', 'Python-like squeeze: slowly takes away your space until you crack.'],
    ['Garry Kasparov', '1985-2000', 'USSR / Russia', 'Energy and deep preparation. Dominated for twenty years.'],
    ['Vladimir Kramnik', '2000-2007', 'Russia', 'Beat Kasparov in 2000 with ultra-solid play (the Berlin Wall).'],
    ['Viswanathan Anand', '2007-2013', 'India', 'Lightning-fast thinker, nicknamed "the Tiger of Madras".'],
    ['Magnus Carlsen', '2013-2023', 'Norway', 'Grinds out wins from tiny edges. Highest rating in history (2882).'],
    ['Ding Liren', '2023-2024', 'China', 'The first Chinese men\'s World Champion.'],
    ['Gukesh Dommaraju', '2024-', 'India', 'Became champion at 18, the youngest ever.'],
  ];
  const LEGENDS = [
    { n: 'Francois-Andre Philidor', y: '1726-1795', c: 'France', t: 'The first great theorist', b: 'Philidor was also a successful composer of operas. He wrote the first modern book of chess strategy and taught that pawns decide the structure of a game. He amazed Europe by playing blindfold, with the pieces only in his mind.', g: null },
    { n: 'Adolf Anderssen', y: '1818-1879', c: 'Germany', t: 'The romantic attacker', b: 'A schoolteacher from Breslau who won the first international tournament in London in 1851. He played two of the most famous attacking games of all time, the Immortal Game and the Evergreen Game.', g: 'immortal' },
    { n: 'Paul Morphy', y: '1837-1884', c: 'USA', t: 'The pride and sorrow of chess', b: 'A prodigy from New Orleans who crossed the Atlantic in 1858 and beat Europe\'s best, including Anderssen. He understood quick development and open lines far ahead of his time, then gave up serious chess and became a lawyer.', g: 'opera' },
    { n: 'Wilhelm Steinitz', y: '1836-1900', c: 'Austria / USA', t: 'The first official World Champion', b: 'Steinitz showed that attacks only work if your position is already better, and that you should build small advantages step by step. This "positional" idea is the foundation of modern chess.', g: null },
    { n: 'Emanuel Lasker', y: '1868-1941', c: 'Germany', t: 'Champion for nearly 27 years', b: 'A doctor of mathematics and a philosopher, Lasker believed in the psychology of the game: choose the move that is most uncomfortable for this particular opponent. He held the title for longer than anyone.', g: null },
    { n: 'Jose Raul Capablanca', y: '1888-1942', c: 'Cuba', t: 'The human chess machine', b: 'He learned the game at age four and played with such clarity that he lost very few games. His book Chess Fundamentals is still one of the best introductions to the game.', g: null },
    { n: 'Alexander Alekhine', y: '1892-1946', c: 'Russia / France', t: 'The master of attack', b: 'Alekhine combined deep preparation with spectacular tactics. He won the title in 1927 and held it, apart from a two-year gap, until he died. The Alekhine Defence (1.e4 Nf6) is named after him.', g: null },
    { n: 'Mikhail Botvinnik', y: '1911-1995', c: 'USSR', t: 'The patriarch of Soviet chess', b: 'An electrical engineer, Botvinnik treated chess as a science: he trained like an athlete and analysed his own games and opponents deeply. His school produced Karpov, Kasparov and Kramnik.', g: null },
    { n: 'Mikhail Tal', y: '1936-1992', c: 'USSR (Latvia)', t: 'The Magician from Riga', b: 'Tal became World Champion at 23 with sacrifices so bold that opponents often could not calculate them. He said he liked to take the game into positions where "two plus two equals five".', g: null },
    { n: 'Bobby Fischer', y: '1943-2008', c: 'USA', t: 'The chess prodigy who changed the world', b: 'A US champion at 14, Fischer won the world title in 1972 and made chess a global sensation. He also invented Fischer Random Chess (Chess960). Two of his games are in Famous games.', g: 'fischer' },
    { n: 'Anatoly Karpov', y: 'born 1951', c: 'Russia', t: 'The great strangler', b: 'Karpov smothered his opponents with tiny positional advantages, so slowly that they only noticed when it was too late. He won more top tournaments than anyone of his era.', g: null },
    { n: 'Garry Kasparov', y: 'born 1963', c: 'Azerbaijan / Russia', t: 'The dominant champion', b: 'World Champion at 22, Kasparov was the top-rated player for about twenty years. In 1997 he lost a match to Deep Blue, and later became a writer and campaigner for democracy.', g: 'topalov' },
    { n: 'Judit Polgar', y: 'born 1976', c: 'Hungary', t: 'The strongest woman ever', b: 'She became a grandmaster at 15 years and 4 months, a record at the time, and reached world number eight. She beat Kasparov in a game in 2002 and competed against men throughout her career.', g: null },
    { n: 'Vera Menchik', y: '1906-1944', c: 'Czechoslovakia / UK', t: 'The first Women\'s World Champion', b: 'She won the first Women\'s World Championship in 1927 and held the title until her death. She beat many top male players, and losing to her earned a man a place in the jokingly named "Menchik Club".', g: null },
    { n: 'Hou Yifan', y: 'born 1994', c: 'China', t: 'The prodigy who beat the men too', b: 'Hou Yifan became a grandmaster at 14 and Women\'s World Champion at 16. She won the Women\'s title several times and also played strongly in top men\'s tournaments.', g: null },
    { n: 'Magnus Carlsen', y: 'born 1990', c: 'Norway', t: 'The champion of the 2010s', b: 'A grandmaster at 13, Carlsen won the world title in 2013 and reached a record rating of 2882. He is famous for outlasting opponents in equal-looking endgames.', g: null },
    { n: 'Gukesh Dommaraju', y: 'born 2006', c: 'India', t: 'The youngest World Champion', b: 'Gukesh won the 2024 Candidates tournament at 17 and then the World Championship at 18, beating Ding Liren in a close match, the youngest undisputed champion in history.', g: null },
  ];
  const GLOSS = [
    ['Castling', 'A special move of king and rook together that tucks the king to safety and brings the rook into play.'], ['En passant', '"In passing": a pawn that has just moved two squares can be captured by an enemy pawn as if it had moved one.'],
    ['Promotion', 'A pawn that reaches the last rank turns into a queen, rook, bishop or knight.'], ['Check', 'The king is attacked. You must get out of it immediately.'], ['Checkmate', 'The king is in check and cannot escape. The game ends.'],
    ['Stalemate', 'The side to move has no legal move but is not in check. The game is drawn.'], ['Fork', 'One piece attacks two or more enemy pieces at once. Knights are famous for it.'], ['Pin', 'A piece cannot move without exposing a more valuable piece behind it.'],
    ['Skewer', 'The reverse of a pin: a valuable piece is attacked and when it moves, a piece behind it falls.'], ['Discovered attack', 'Moving one piece uncovers an attack by another piece behind it.'], ['Double check', 'Two pieces give check at once; the only answer is to move the king.'],
    ['Zugzwang', 'A position where every legal move makes your position worse, and you would rather pass.'], ['Zwischenzug', 'An "in-between move" that interrupts an expected sequence, usually with a threat.'], ['Gambit', 'An opening where a pawn (or more) is offered for faster development or attack.'],
    ['Sacrifice', 'Giving up material on purpose to get something more valuable, like an attack or checkmate.'], ['Fianchetto', 'Developing a bishop to b2, g2, b7 or g7 after moving the knight\'s pawn one square.'], ['Opposition', 'In king and pawn endings, the kings face each other with one square between; the side that does not have to move has the opposition.'],
    ['Tempo', 'A unit of time in chess: one move. Gaining a tempo means making progress while forcing the opponent to waste a move.'], ['Initiative', 'Keeping the opponent busy with threats so you decide what happens.'], ['Outpost', 'A square deep in enemy territory, often for a knight, that cannot be attacked by enemy pawns.'],
    ['Passed pawn', 'A pawn with no enemy pawns in front of it on its file or the neighbouring files. It is dangerous in the endgame.'], ['Isolated pawn', 'A pawn with no friendly pawns on the neighbouring files, so it cannot be defended by pawns.'], ['Doubled pawns', 'Two pawns of the same colour on the same file, usually a weakness.'],
    ['Backward pawn', 'A pawn that has fallen behind its neighbours and cannot safely advance.'], ['Pawn chain', 'A diagonal line of pawns protecting each other.'], ['Open file', 'A file with no pawns on it; rooks love them.'], ['Rank and file', 'Ranks are the rows (1 to 8); files are the columns (a to h).'],
    ['Back-rank mate', 'A checkmate on the first or last rank where the king is trapped behind its own pawns.'], ['Smothered mate', 'A checkmate by a knight where the king is surrounded by its own pieces.'], ['Perpetual check', 'Endless checks that the king cannot escape, leading to a draw.'], ['Fortress', 'A defensive setup the stronger side cannot break through, giving a draw.'],
    ['Prophylaxis', 'A move that prevents the opponent\'s plan before it starts.'], ['Deflection', 'Forcing a defending piece away from its duty.'], ['Decoy', 'Luring an enemy piece to a bad square.'], ['Overloaded piece', 'A piece guarding two things at once, which cannot do both.'],
    ['Desperado', 'A piece that is lost anyway and grabs as much material as it can before being taken.'], ['Blunder', 'A serious mistake that loses material or the game.'], ['Swindle', 'A trick that rescues a lost game, often from a worse position.'], ['Time control', 'The time each player has, e.g. 10 minutes, or 3 minutes + 2 seconds added per move.'],
    ['Increment', 'Seconds added to your clock after every move you make.'], ['Bullet, blitz, rapid, classical', 'Time formats: bullet under 3 minutes, blitz 3 to 10, rapid 10 to 60, classical longer than that.'], ['Flag', 'To run out of time. In an online game, the flag falls when your clock hits zero.'],
    ['Elo', 'A rating system that estimates strength. About 1000 is a casual player, 1800 a strong club player, and 2500 or more a grandmaster.'], ['Grandmaster (GM)', 'The highest title awarded by FIDE for playing strength, after meeting norms and a 2500 rating.'], ['FIDE', 'Federation Internationale des Echecs, the World Chess Federation.'],
    ['PGN', 'Portable Game Notation, the standard text format for saving chess games.'], ['FEN', 'A short line of text that describes one exact position.'], ['SAN', 'Standard Algebraic Notation: how moves are written, like Nf3 or exd5.'], ['J\'adoube', 'French for "I adjust": said before touching a piece just to straighten it, so you do not have to move it.'],
    ['Touch-move rule', 'In over-the-board play, if you touch a piece you must move it, and if you touch an enemy piece you must capture it.'], ['Opening, middlegame, endgame', 'The three phases of a game: develop, fight, then convert or hold with few pieces left.'],
    ['Book move', 'A move that follows established opening theory.'], ['Engine', 'A chess program. Today\'s engines are far stronger than any human.'], ['Brilliancy', 'A game or move that is both beautiful and deep, often with a sacrifice.'],
  ];
  const QUIZ = [
    ['Where did chess begin?', ['India', 'Egypt', 'Italy', 'China'], 0], ['What was the ancestor of chess called?', ['Chaturanga', 'Backgammon', 'Mancala', 'Senet'], 0], ['Who was the first official World Chess Champion?', ['Wilhelm Steinitz', 'Paul Morphy', 'Emanuel Lasker', 'Bobby Fischer'], 0],
    ['Which champion held the title for nearly 27 years?', ['Emanuel Lasker', 'Garry Kasparov', 'Anatoly Karpov', 'Magnus Carlsen'], 0], ['Which Cuban was famous for near-flawless technique?', ['Jose Raul Capablanca', 'Alexander Alekhine', 'Paul Morphy', 'Max Euwe'], 0],
    ['Which champion is nicknamed the "Magician from Riga"?', ['Mikhail Tal', 'Tigran Petrosian', 'Boris Spassky', 'Vasily Smyslov'], 0], ['Which player was famous for iron-clad defence?', ['Tigran Petrosian', 'Mikhail Tal', 'Garry Kasparov', 'Bobby Fischer'], 0],
    ['Where was the famous 1972 Fischer vs Spassky match held?', ['Reykjavik, Iceland', 'New York', 'Moscow', 'Paris'], 0], ['Who became World Champion at 18 in 2024?', ['Gukesh Dommaraju', 'Magnus Carlsen', 'Ding Liren', 'Viswanathan Anand'], 0],
    ['Which computer beat Garry Kasparov in a match in 1997?', ['Deep Blue', 'AlphaZero', 'Stockfish', 'Deep Fritz'], 0], ['Who invented the rating system used in chess?', ['Arpad Elo', 'Garry Kasparov', 'Bobby Fischer', 'Max Euwe'], 0],
    ['The Immortal Game was played by Anderssen and...', ['Kieseritzky', 'Morphy', 'Steinitz', 'Dufresne'], 0], ['Which American beat Europe\'s best in 1858 and then retired from the game?', ['Paul Morphy', 'Bobby Fischer', 'Wilhelm Steinitz', 'Frank Marshall'], 0],
    ['Who was the first Women\'s World Champion?', ['Vera Menchik', 'Judit Polgar', 'Hou Yifan', 'Nona Gaprindashvili'], 0], ['Who said pawns are "the soul of chess"?', ['Philidor', 'Morphy', 'Lasker', 'Capablanca'], 0],
    ['Which of these is a World Chess Federation?', ['FIDE', 'UEFA', 'FIFA', 'WTA'], 0], ['Which piece did the "mad queen" rules of c. 1475 make powerful?', ['The queen', 'The king', 'The pawn', 'The rook'], 0],
    ['What does "shah mat" in Persian mean, from which "checkmate" comes?', ['The king is helpless', 'The king is dead', 'The game is over', 'The queen wins'], 0], ['The Staunton design is known for...', ['The standard tournament chess set', 'A famous opening', 'A chess clock', 'A rating system'], 0],
    ['Which World Champion was also a mathematician with a doctorate?', ['Emanuel Lasker', 'Mikhail Tal', 'Bobby Fischer', 'Anatoly Karpov'], 0], ['What is the highest rating ever achieved, held by Magnus Carlsen?', ['2882', '2700', '2999', '2500'], 0],
    ['Who invented Fischer Random Chess (Chess960)?', ['Bobby Fischer', 'Garry Kasparov', 'Magnus Carlsen', 'Paul Morphy'], 0], ['What is a "fork"?', ['One piece attacks two or more pieces at once', 'A pawn on the seventh rank', 'A type of castling', 'A draw by repetition'], 0],
    ['What does "zugzwang" mean?', ['Every move makes your position worse', 'A checkmate by a knight', 'A pawn promotion', 'A fast opening'], 0], ['Which engine learned chess from scratch in hours in 2017?', ['AlphaZero', 'Deep Blue', 'Rybka', 'Fritz'], 0],
  ];
  const norm = s => (s || '').replace(/[+#!?]/g, '');
  const sh = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const MOMENTS = () => { const out = []; for (const g of (window.CHESS_GAMES || [])) { const toks = g.m.split(' '); for (const k of Object.keys(g.notes || {})) { const ply = +k, txt = g.notes[k]; if (!/!/.test(txt) || ply < 2 || ply > toks.length) continue; out.push({ g, ply, san: toks[ply - 1], note: txt, toks }); } } return out; };

  UI.sections.history = (host, api) => {
    const TABS = [['time', '📜 Timeline'], ['champs', '👑 Champions'], ['legends', '🌟 Legends'], ['gloss', '📖 Glossary'], ['moments', '✨ Moments of genius'], ['quiz', '❓ History quiz']];
    let tab = ls.get('chhist', 'time'), cleanup = null;
    host.innerHTML = '<div class="row" id="hbar" style="gap:6px;flex-wrap:wrap;margin-bottom:10px"></div><div id="hbody"></div>';
    const body = () => host.querySelector('#hbody');
    const show = t => { if (cleanup) { try { cleanup(); } catch (e) { } cleanup = null; } tab = t; ls.set('chhist', t); host.querySelector('#hbar').innerHTML = TABS.map(x => '<button class="ib' + (x[0] === t ? ' on' : '') + '" data-t="' + x[0] + '">' + x[1] + '</button>').join(''); cleanup = SEC[t](body()) || null; };
    host.querySelector('#hbar').onclick = e => { const b = e.target.closest('[data-t]'); if (b) show(b.dataset.t); };
    const SEC = {
      time(b) { b.innerHTML = '<p class="mute small" style="margin:0 0 10px">1,400 years of chess, from the first board in India to AlphaZero.</p><div style="position:relative;padding-left:22px;max-width:760px"><div style="position:absolute;left:7px;top:6px;bottom:6px;width:2px;background:linear-gradient(var(--acc),var(--acc2))"></div>' + TIMELINE.map(t => '<div style="position:relative;margin:0 0 12px"><i style="position:absolute;left:-20px;top:5px;width:12px;height:12px;border-radius:50%;background:var(--acc);box-shadow:0 0 0 3px var(--bg)"></i><b style="color:var(--acc2)">' + esc(t[0]) + '</b><div style="line-height:1.55">' + esc(t[1]) + '</div></div>').join('') + '</div>'; },
      champs(b) { b.innerHTML = '<p class="mute small" style="margin:0 0 10px">The undisputed line of World Champions. (From 1993 to 2006 the title was split between two organisations; this list follows the main line.)</p><div style="max-width:820px">' + CHAMPS.map((c, i) => '<div class="card" style="margin:0 0 8px;display:flex;gap:12px;align-items:center"><div style="font:700 18px/1 var(--mono,Consolas);color:var(--acc);width:30px;text-align:center">' + (i + 1) + '</div><div style="flex:1"><b>' + esc(c[0]) + '</b> <span class="small mute">' + esc(c[2]) + '</span><div class="small" style="color:var(--acc2)">' + esc(c[1]) + '</div><div class="small mute">' + esc(c[3]) + '</div></div></div>').join('') + '</div>'; },
      legends(b) {
        b.innerHTML = '<div class="acg">' + LEGENDS.map((l, i) => '<div class="card" data-l="' + i + '" style="cursor:pointer"><b>' + esc(l.n) + '</b><div class="small" style="color:var(--acc2)">' + esc(l.t) + '</div><div class="small mute">' + esc(l.y) + ' · ' + esc(l.c) + '</div></div>').join('') + '</div>';
        b.onclick = e => { const c = e.target.closest('[data-l]'); if (!c) return; const l = LEGENDS[+c.dataset.l]; try { ChessAch.event('legend', { n: l.n }); } catch (e) { } A.dlg('<div class="hd"><b>' + esc(l.n) + '</b></div><div class="bd"><div class="small" style="color:var(--acc2)">' + esc(l.t) + '</div><div class="small mute" style="margin-bottom:8px">' + esc(l.y) + ' · ' + esc(l.c) + '</div><div style="line-height:1.6">' + esc(l.b) + '</div><div class="row" style="margin-top:12px;gap:8px">' + (l.g ? '<button class="ib" id="lgame">🏆 Watch a famous game</button>' : '') + '<span class="sp"></span><button class="pri" id="lx">Close</button></div></div>'); document.getElementById('lx').onclick = A.closeDlg; if (l.g) document.getElementById('lgame').onclick = () => { A.closeDlg(); ls.set('chgamefocus', l.g); show2('games'); }; };
      },
      gloss(b) { let q = ''; b.innerHTML = '<input type="text" id="gq" placeholder="Search ' + GLOSS.length + ' chess terms..." style="max-width:320px;margin-bottom:10px"><div id="gl" style="max-width:820px"></div>'; const draw = () => { const f = GLOSS.filter(g => !q || (g[0] + ' ' + g[1]).toLowerCase().includes(q)); b.querySelector('#gl').innerHTML = f.map(g => '<div class="card" style="margin:0 0 6px;padding:8px 12px"><b>' + esc(g[0]) + '</b><div class="small">' + esc(g[1]) + '</div></div>').join('') || '<div class="mute small">No terms match.</div>'; }; b.querySelector('#gq').oninput = e => { q = e.target.value.toLowerCase(); draw(); }; draw(); },
      moments(b) {
        const ALL = MOMENTS(); let cur = null, board = null, done = 0, ok = 0;
        b.innerHTML = '<div class="acw"><div><div id="mbd"></div></div><div class="acside"><div class="acmsg" id="mq"></div><div class="acmsg" id="mr" style="min-height:70px"></div><div class="row" style="gap:6px;flex-wrap:wrap"><button class="ib" id="mh">💡 Hint</button><button class="ib" id="ms">Show the move</button><button class="pri" id="mn">Next moment</button></div><div class="small mute">Positions from the famous games. Find the move the master played. These moves were often sacrifices, so the best move may not look natural!</div></div></div>';
        const q = id => b.querySelector('#' + id); board = new UI.Board(q('mbd'));
        const next = () => {
          cur = sh(ALL)[0]; const p = new C.Pos().setFen(C.START); for (let i = 0; i < cur.ply - 1; i++) p.make(p.fromSan(cur.toks[i])); cur.pos = p; cur.done = false;
          board.set(p.fen(), { who: p.side, flipped: p.side < 0, anim: false });
          q('mq').innerHTML = '<b>' + (p.side > 0 ? 'White' : 'Black') + ' to move.</b> ' + esc(cur.g.name) + '<div class="small mute">' + esc(cur.g.who) + '</div>'; q('mr').innerHTML = '<span class="mute">What did the master play here?</span>'; api.hud(ok + ' / ' + done);
        };
        board.onmove = m => { if (!cur || cur.done) return; const san = cur.pos.san(m, cur.pos.legal()); done++; if (norm(san) === norm(cur.san)) { ok++; cur.done = true; board.play(m); try { ChessAch.event('moment'); } catch (e) { } q('mr').innerHTML = '<span style="color:var(--ok)"><b>Yes! ' + esc(cur.san) + '</b></span> ' + esc(cur.note); try { ChessFx.confetti(); } catch (e) { } } else { board.draw(); q('mr').innerHTML = '<span style="color:var(--bad)">' + esc(san) + ' is not what was played.</span> Try again, use the hint, or show the move.'; board.shake && board.shake(); } api.hud(ok + ' / ' + done); };
        q('mh').onclick = () => { if (!cur) return; const m = cur.pos.fromSan(cur.san); if (!m) return; board.marks = {}; board.marks[m & 63] = 'hint'; board.draw(); q('mr').innerHTML = '<span class="mute">Look at the highlighted piece.</span>'; };
        q('ms').onclick = () => { if (!cur || cur.done) return; cur.done = true; const m = cur.pos.fromSan(cur.san); board.who = 0; board.play(m); q('mr').innerHTML = '<b>' + esc(cur.san) + '</b> ' + esc(cur.note); };
        q('mn').onclick = next; next(); return () => { if (board) board.destroy(); };
      },
      quiz(b) {
        let qs = sh(QUIZ).slice(0, 10), i = 0, sc = 0, done = false;
        const draw = () => { done = false; if (i >= qs.length) { const best = Math.max(+ls.get('chhistbest', '0'), sc); ls.set('chhistbest', String(best)); b.innerHTML = '<div class="card" style="max-width:520px"><h2>Quiz complete</h2><div>You scored <b>' + sc + ' of ' + qs.length + '</b>. Your best is ' + best + '.</div><div class="row" style="margin-top:10px"><button class="pri" id="qa">Play again</button></div></div>'; b.querySelector('#qa').onclick = () => { qs = sh(QUIZ).slice(0, 10); i = 0; sc = 0; draw(); }; try { ChessAch.event('histquiz', { score: sc }); if (sc >= 9) ChessFx.confetti(); } catch (e) { } return; } const x = qs[i], opts = sh(x[1].map((o, k) => [o, k === x[2]])); b.innerHTML = '<div class="card" style="max-width:560px"><div class="small mute">Question ' + (i + 1) + ' of ' + qs.length + ' · score ' + sc + '</div><h3 style="margin:6px 0 10px">' + esc(x[0]) + '</h3>' + opts.map(o => '<button class="acq" data-r="' + (o[1] ? 1 : 0) + '">' + esc(o[0]) + '</button>').join('') + '<div id="qm" style="margin-top:8px"></div></div>'; };
        b.onclick = e => { const a = e.target.closest('.acq'); if (!a || done) return; done = true; const right = a.dataset.r === '1'; if (right) sc++; a.classList.add(right ? 'ok' : 'no'); if (!right) b.querySelectorAll('.acq').forEach(y => { if (y.dataset.r === '1') y.classList.add('ok'); }); b.querySelector('#qm').innerHTML = '<button class="pri" id="qn">' + (i + 1 < qs.length ? 'Next' : 'Finish') + '</button>'; b.querySelector('#qn').onclick = () => { i++; draw(); }; api.hud('Quiz ' + sc); }; draw(); return () => { b.onclick = null; };
      },
    };
    const show2 = t => { if (UI.show) UI.show(t); };
    show(TABS.some(x => x[0] === tab) ? tab : 'time'); return () => { if (cleanup) { try { cleanup(); } catch (e) { } } };
  };
})();

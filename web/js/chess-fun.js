// Chess fun layer: confetti, mascot, XP and levels, and a long list of achievements. Other chess files call ChessAch.event(name, data).
(() => {
  /* ---------------- effects ---------------- */
  const Fx = {
    confetti(opts) {
      if (document.body.classList.contains('lowpower')) return; opts = opts || {};
      const cv = document.createElement('canvas'), W = innerWidth, H = innerHeight; cv.width = W; cv.height = H; cv.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:9999'; document.body.appendChild(cv); const cx = cv.getContext('2d');
      const N = opts.n || 90, ox = opts.x != null ? opts.x : W / 2, oy = opts.y != null ? opts.y : H * .35, cols = ['#ffd24a', '#ff6b81', '#46d7c8', '#8b7cff', '#5ee6a8', '#ff9f43'];
      const ps = Array.from({ length: N }, () => { const a = Math.random() * Math.PI * 2, s = 4 + Math.random() * 9; return { x: ox, y: oy, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 5, r: 3 + Math.random() * 4, c: cols[Math.random() * cols.length | 0], rot: Math.random() * 6, vr: (Math.random() - .5) * .4, life: 70 + Math.random() * 40 }; });
      let t = 0; const step = () => { t++; cx.clearRect(0, 0, W, H); let alive = 0; for (const p of ps) { p.vy += .32; p.vx *= .99; p.x += p.vx; p.y += p.vy; p.rot += p.vr; if (p.life-- > 0 && p.y < H + 20) { alive++; cx.save(); cx.translate(p.x, p.y); cx.rotate(p.rot); cx.globalAlpha = Math.min(1, p.life / 30); cx.fillStyle = p.c; cx.fillRect(-p.r, -p.r / 2, p.r * 2, p.r); cx.restore(); } } if (alive && t < 220) requestAnimationFrame(step); else cv.remove(); }; requestAnimationFrame(step);
    },
    /* a quick pop on an element */
    pop(el) { if (!el || document.body.classList.contains('lowpower')) return; el.classList.remove('fxpop'); void el.offsetWidth; el.classList.add('fxpop'); },
    sparkle(el) { if (!el) return; const r = el.getBoundingClientRect(); Fx.confetti({ n: 24, x: r.left + r.width / 2, y: r.top + r.height / 2 }); }
  };
  const SAY = { good: ['Nicely done!', 'Brilliant!', 'That is the one!', 'You spotted it!', 'Sharp eyes!', 'Textbook!'], bad: ['Not quite - look again.', 'Close! Think about the threats.', 'Hmm, try another idea.', 'Check every check, capture and threat.'], start: ['Ready? Let\'s go!', 'Take your time and look carefully.', 'You have got this.'] };
  const say = k => SAY[k][Math.random() * SAY[k].length | 0];
  /* a small knight mascot that bobs and talks */
  function mascot(host) { host.innerHTML = '<div class="mascot"><span class="mk">♞</span><span class="mb" id="mkb"></span></div>'; const b = host.querySelector('.mb'); return { say(t, mood) { b.textContent = t || say(mood || 'good'); b.className = 'mb on ' + (mood || ''); clearTimeout(b._t); b._t = setTimeout(() => b.classList.remove('on'), 4200); host.querySelector('.mk').classList.remove('hop'); void host.offsetWidth; host.querySelector('.mk').classList.add('hop'); } }; }

  /* ---------------- achievements ---------------- */
  const T = (id, name, icon, desc, xp, key, n, cat) => ({ id, name, icon, desc, xp, key, n, cat });
  const F = (id, name, icon, desc, xp, cond, cat, secret) => ({ id, name, icon, desc, xp, cond, cat, secret });
  const DEFS = [
    // play
    T('g1', 'First Move', '♟️', 'Finish a game against Moundshroud.', 20, 'games', 1, 'Play'), T('g10', 'Regular', '🎲', 'Finish 10 games.', 40, 'games', 10, 'Play'), T('g50', 'Club Member', '🏠', 'Finish 50 games.', 100, 'games', 50, 'Play'), T('g100', 'Chess Addict', '🔥', 'Finish 100 games.', 200, 'games', 100, 'Play'),
    T('w1', 'First Blood', '🏆', 'Win a game.', 30, 'wins', 1, 'Play'), T('w10', 'Winning Streak', '🥇', 'Win 10 games.', 80, 'wins', 10, 'Play'), T('w50', 'Dominator', '👑', 'Win 50 games.', 200, 'wins', 50, 'Play'),
    T('e600', 'Beat the Beginner', '🌱', 'Beat Moundshroud at 600 Elo or higher.', 30, 'maxWin', 600, 'Play'), T('e1000', 'Casual Crusher', '🌿', 'Beat Moundshroud at 1000 Elo or higher.', 50, 'maxWin', 1000, 'Play'), T('e1400', 'Club Level', '🌳', 'Beat Moundshroud at 1400 Elo or higher.', 80, 'maxWin', 1400, 'Play'), T('e1800', 'Strong Player', '🌲', 'Beat Moundshroud at 1800 Elo or higher.', 150, 'maxWin', 1800, 'Play'), T('e2200', 'Giant Slayer', '🐉', 'Beat Moundshroud at 2200 Elo or higher.', 300, 'maxWin', 2200, 'Play'),
    T('mate', 'Checkmate!', '♚', 'Win by checkmate.', 40, 'mateWins', 1, 'Play'), T('mate10', 'Mating Machine', '⚙️', 'Win 10 games by checkmate.', 100, 'mateWins', 10, 'Play'), T('black', 'Dark Side', '🌑', 'Win a game as Black.', 50, 'blackWins', 1, 'Play'), T('fast', 'Blitzkrieg', '⚡', 'Win in 20 moves or fewer.', 80, 'fastWins', 1, 'Play'), T('timed', 'Beat the Clock', '⏱️', 'Win a game with the clock on.', 60, 'timedWins', 1, 'Play'), T('draw', 'Peace Treaty', '🕊️', 'Finish a game as a draw.', 30, 'draws', 1, 'Play'), T('loss', 'Graceful Loser', '🙂', 'Lose a game and keep going.', 10, 'losses', 1, 'Play'),
    F('fool', 'Fool\'s Mate Victim', '🤡', 'Lose in four moves or fewer. It happens to everyone.', 25, c => c.quickLoss >= 1, 'Play', true), F('long', 'Marathon', '🏃', 'Play a game of 100 moves or more.', 80, c => c.longGame >= 1, 'Play', true),
    // puzzles
    T('p1', 'Puzzle Starter', '🧩', 'Solve a puzzle.', 15, 'puzzles', 1, 'Puzzles'), T('p10', 'Puzzle Fan', '🧩', 'Solve 10 puzzles.', 40, 'puzzles', 10, 'Puzzles'), T('p50', 'Puzzle Addict', '🧠', 'Solve 50 puzzles.', 100, 'puzzles', 50, 'Puzzles'), T('p100', 'Century', '💯', 'Solve 100 puzzles.', 150, 'puzzles', 100, 'Puzzles'), T('p250', 'Tactics Machine', '🤖', 'Solve 250 puzzles.', 250, 'puzzles', 250, 'Puzzles'), T('p1000', 'Puzzle Legend', '🌟', 'Solve 1000 puzzles.', 600, 'puzzles', 1000, 'Puzzles'),
    T('ps5', 'On a Roll', '🎯', 'Solve 5 puzzles in a row.', 40, 'bestStreak', 5, 'Puzzles'), T('ps10', 'Hot Streak', '🔥', 'Solve 10 puzzles in a row.', 80, 'bestStreak', 10, 'Puzzles'), T('ps25', 'Unstoppable', '⚡', 'Solve 25 puzzles in a row.', 200, 'bestStreak', 25, 'Puzzles'),
    T('pr10', 'Rising Rating', '📈', 'Reach a puzzle rating of 1000.', 60, 'maxRating', 1000, 'Puzzles'), T('pr12', 'Sharp', '📈', 'Reach a puzzle rating of 1200.', 100, 'maxRating', 1200, 'Puzzles'), T('pr15', 'Tactician', '📈', 'Reach a puzzle rating of 1500.', 200, 'maxRating', 1500, 'Puzzles'), T('pr18', 'Grandmaster Eyes', '📈', 'Reach a puzzle rating of 1800.', 400, 'maxRating', 1800, 'Puzzles'),
    T('pm', 'Think Ahead', '🔭', 'Solve a puzzle that needs 2 or more moves.', 40, 'multi', 1, 'Puzzles'), T('pm3', 'Deep Calculator', '🧮', 'Solve a puzzle that needs 3 or more moves.', 80, 'k3', 1, 'Puzzles'), T('pm20', 'Calculation Master', '🧮', 'Solve 20 multi-move puzzles.', 200, 'multi', 20, 'Puzzles'), T('phard', 'Hard Mode', '💪', 'Solve a hard puzzle.', 60, 'hard', 1, 'Puzzles'), T('pnh', 'No Hints Needed', '🙈', 'Solve 10 puzzles without hints or mistakes.', 80, 'clean', 10, 'Puzzles'),
    T('pfork', 'Fork Finder', '🍴', 'Solve 10 fork puzzles.', 60, 'th_Fork', 10, 'Puzzles'), T('ppin', 'Pin Pro', '📌', 'Solve 5 pin puzzles.', 60, 'th_Pin', 5, 'Puzzles'), T('pmate3', 'Mate Hunter', '🎯', 'Solve 5 mate-in-3 puzzles.', 100, 'th_Mate in 3', 5, 'Puzzles'), T('pback', 'Back-Rank Basher', '🧱', 'Solve 5 back-rank mate puzzles.', 60, 'th_Back-rank mate', 5, 'Puzzles'), T('pcreate', 'Puzzle Maker', '🛠️', 'Create your own puzzle.', 40, 'created', 1, 'Puzzles'), T('psave', 'Collector', '⭐', 'Save a puzzle to My puzzles.', 15, 'saved', 1, 'Puzzles'), T('ptimer', 'Against the Clock', '⏲️', 'Solve a puzzle with a time limit on.', 40, 'timerSolved', 1, 'Puzzles'),
    // learn
    T('l1', 'Student', '📘', 'Finish a lesson.', 15, 'lessons', 1, 'Learn'), T('l10', 'Scholar', '📚', 'Finish 10 lessons.', 60, 'lessons', 10, 'Learn'), T('l30', 'Dedicated Learner', '🎓', 'Finish 30 lessons.', 150, 'lessons', 30, 'Learn'), T('l61', 'Graduate', '🏅', 'Finish all 61 lessons.', 400, 'lessons', 61, 'Learn'), T('c1', 'Course Complete', '📗', 'Finish a whole course.', 80, 'courses', 1, 'Learn'), T('c4', 'Four Courses', '📚', 'Finish 4 courses.', 200, 'courses', 4, 'Learn'),
    T('q10', 'Quiz Kid', '❓', 'Answer 10 lesson quiz questions correctly.', 30, 'quizzes', 10, 'Learn'), T('q50', 'Know-It-All', '🧠', 'Answer 50 lesson quiz questions correctly.', 100, 'quizzes', 50, 'Learn'), T('o1', 'Opening Student', '📖', 'Play a whole opening line from memory.', 30, 'openings', 1, 'Learn'), T('o8', 'Repertoire', '📖', 'Master 8 openings.', 120, 'openings', 8, 'Learn'), T('o17', 'Opening Encyclopedia', '📖', 'Master all 17 openings.', 300, 'openings', 17, 'Learn'),
    T('f1', 'History Buff', '🏆', 'Play through a famous game.', 30, 'famous', 1, 'Learn'), T('f5', 'Game Collector', '🏛️', 'Play through 5 famous games.', 80, 'famous', 5, 'Learn'), T('f10', 'Hall of Fame', '🏛️', 'Play through all 10 famous games.', 200, 'famous', 10, 'Learn'), T('eg1', 'Endgame Rookie', '🏁', 'Win an endgame drill.', 40, 'endgames', 1, 'Learn'), T('eg6', 'Endgame Expert', '🏁', 'Win all 6 endgame drills.', 150, 'endgames', 6, 'Learn'),
    // analysis
    T('a1', 'Under the Microscope', '🔬', 'Analyze a game.', 30, 'analyses', 1, 'Analysis'), T('a10', 'Post-Mortem Pro', '🔬', 'Analyze 10 games.', 100, 'analyses', 10, 'Analysis'), T('a50', 'Analysis Addict', '🔬', 'Analyze 50 games.', 250, 'analyses', 50, 'Analysis'), T('up1', 'Uploader', '📤', 'Upload a PGN game.', 30, 'uploads', 1, 'Analysis'), T('up20', 'Game Library', '🗃️', 'Load 20 uploaded games.', 100, 'uploads', 20, 'Analysis'), T('ex1', 'Explorer', '🧭', 'Try your own moves in the analysis board.', 20, 'explore', 1, 'Analysis'), T('ex100', 'Variation Lover', '🧭', 'Play 100 moves on the analysis board.', 80, 'explore', 100, 'Analysis'),
    T('acc90', 'Clean Game', '✨', 'Play a game with 90% accuracy or higher.', 100, 'maxAcc', 90, 'Analysis'), T('acc96', 'Near Perfect', '💎', 'Play a game with 96% accuracy or higher.', 250, 'maxAcc', 96, 'Analysis'), T('co1', 'Ask the Coach', '🧑‍🏫', 'Ask the AI coach a question.', 15, 'coach', 1, 'Analysis'), T('co25', 'Coach\'s Pet', '🎒', 'Ask the coach 25 questions.', 80, 'coach', 25, 'Analysis'), T('mist', 'Learn from Mistakes', '🎯', 'Turn your mistakes into puzzles.', 40, 'mistakes', 1, 'Analysis'), T('start', 'Board Builder', '🧱', 'Set up your own position on the analysis board.', 30, 'setup', 1, 'Analysis'),
    // books and mini-games
    T('b1', 'Bookworm', '📚', 'Open a chess book.', 20, 'books', 1, 'Explore'), T('b5', 'Reader', '📖', 'Open 5 different chess books.', 60, 'books', 5, 'Explore'), T('b15', 'Library Regular', '🏛️', 'Open 15 different chess books.', 160, 'books', 15, 'Explore'),
    T('m1', 'Playtime', '🎮', 'Play a chess mini-game.', 15, 'minis', 1, 'Explore'), T('kt', 'Knight\'s Tour', '🐴', 'Complete a knight\'s tour of the whole board.', 150, 'tours', 1, 'Explore'), T('q8', 'Eight Queens', '👸', 'Solve the eight queens puzzle.', 120, 'queens', 1, 'Explore'), T('q8b', 'Queen Collector', '👸', 'Find 5 different eight-queens solutions.', 250, 'queenSols', 5, 'Explore'), T('co20', 'Sniper', '🎯', 'Name 20 squares in a round of Coordinate Sniper.', 60, 'coordBest', 20, 'Explore'), T('co40', 'Board Vision', '👁️', 'Name 40 squares in a round of Coordinate Sniper.', 150, 'coordBest', 40, 'Explore'), T('pw', 'Pawn Wars Winner', '♙', 'Win a game of Pawn Wars.', 60, 'pawnWins', 1, 'Explore'), T('rush', 'Rush Hour', '🚀', 'Solve 10 puzzles in one Puzzle Rush.', 100, 'rushBest', 10, 'Explore'),
    T('d1', 'Daily Visitor', '📅', 'Finish a daily challenge.', 25, 'daily', 1, 'Explore'), T('d7', 'Week Streak', '🔥', 'Finish the daily challenge 7 days in a row.', 120, 'dailyStreak', 7, 'Explore'), T('d30', 'Monthly Devotion', '🏆', 'Finish the daily challenge 30 days in a row.', 400, 'dailyStreak', 30, 'Explore'),
    // levels
    T('lv5', 'Level 5', '⭐', 'Reach level 5.', 0, 'level', 5, 'Milestones'), T('lv10', 'Level 10', '🌟', 'Reach level 10.', 0, 'level', 10, 'Milestones'), T('lv20', 'Level 20', '💫', 'Reach level 20.', 0, 'level', 20, 'Milestones'),
    F('night', 'Night Owl', '🦉', 'Play chess after midnight.', 20, c => c.night >= 1, 'Milestones', true), F('allcats', 'All-Rounder', '🌈', 'Unlock at least one trophy in every category.', 150, c => c.catsDone >= 6, 'Milestones', true),
  ];
  const TITLES = ['Pawn', 'Knight', 'Bishop', 'Rook', 'Queen', 'King', 'Grandmaster'], lvOf = xp => Math.floor(Math.sqrt(xp / 40)) + 1, xpFor = lv => (lv - 1) * (lv - 1) * 40;
  const titleOf = lv => TITLES[Math.min(TITLES.length - 1, Math.floor((lv - 1) / 4))];
  const load = () => { try { return Object.assign({ c: {}, u: {}, xp: 0 }, JSON.parse(ls.get('chach', '{}'))); } catch (e) { return { c: {}, u: {}, xp: 0 }; } };
  const save = d => ls.set('chach', JSON.stringify(d));
  const queue = []; let showing = false;
  function toast(d) {
    queue.push(d); if (showing) return; showing = true;
    const next = () => { const x = queue.shift(); if (!x) { showing = false; return; } const el = document.createElement('div'); el.className = 'achtoast'; el.innerHTML = '<div class="ai">' + x.icon + '</div><div><b>Achievement unlocked!</b><div class="an">' + esc(x.name) + '</div><div class="small mute">' + esc(x.desc) + ' · +' + x.xp + ' XP</div></div>'; document.body.appendChild(el); Fx.confetti({ n: 70, x: innerWidth - 140, y: innerHeight - 120 }); setTimeout(() => { el.classList.add('out'); setTimeout(() => { el.remove(); next(); }, 400); }, 3600); };
    next();
  }
  const Ach = {
    DEFS, Fx, mascot, say, TITLES,
    data: load, level(xp) { const lv = lvOf(xp == null ? load().xp : xp); return { lv, title: titleOf(lv), xp: xp == null ? load().xp : xp, from: xpFor(lv), to: xpFor(lv + 1) }; },
    unlocked: () => Object.keys(load().u),
    /* bump counters and unlock whatever is now earned */
    event(name, d) {
      d = d || {}; const s = load(), c = s.c; const add = (k, n) => { c[k] = (c[k] || 0) + (n == null ? 1 : n); }, max = (k, v) => { if (v > (c[k] || 0)) c[k] = v; }, hr = new Date().getHours();
      if (hr < 5) c.night = (c.night || 0) + 1;
      switch (name) {
        case 'game': add('games'); if (d.result === 'win') { add('wins'); max('maxWin', d.elo || 0); if (d.mate) add('mateWins'); if (d.human < 0) add('blackWins'); if (d.plies <= 40) add('fastWins'); if (d.timed) add('timedWins'); } else if (d.result === 'draw') add('draws'); else { add('losses'); if (d.plies <= 8) c.quickLoss = (c.quickLoss || 0) + 1; } if (d.plies >= 200) c.longGame = 1; break;
        case 'puzzle': add('puzzles'); max('bestStreak', d.streak || 0); max('maxRating', Math.round(d.rating || 0)); if (d.k >= 2) add('multi'); if (d.k >= 3) add('k3'); if (d.level === 'hard') add('hard'); if (d.clean) add('clean'); if (d.timer) add('timerSolved'); (d.themes || []).concat([d.t]).forEach(t => t && add('th_' + t)); break;
        case 'puzzle_created': add('created'); break; case 'puzzle_saved': add('saved'); break; case 'mistakes': add('mistakes'); break;
        case 'lesson': add('lessons', d.fresh === false ? 0 : 1); break; case 'course': add('courses'); break; case 'quiz': add('quizzes'); break;
        case 'opening': if (d.fresh) add('openings'); break; case 'famous': if (d.fresh) add('famous'); break; case 'endgame': if (d.fresh) add('endgames'); break;
        case 'analysis': add('analyses'); if (d.acc) max('maxAcc', Math.round(d.acc)); break; case 'upload': add('uploads', d.n || 1); break; case 'explore': add('explore'); break; case 'setup': add('setup'); break; case 'coach': add('coach'); break;
        case 'book': { c.bookSet = c.bookSet || {}; c.bookSet[d.id] = 1; c.books = Object.keys(c.bookSet).length; break; }
        case 'mini': add('minis'); if (d.k === 'tour') add('tours'); if (d.k === 'queens') { add('queens'); c.qs = c.qs || {}; c.qs[d.sol] = 1; c.queenSols = Object.keys(c.qs).length; } if (d.k === 'coord') max('coordBest', d.score || 0); if (d.k === 'pawnwars' && d.win) add('pawnWins'); if (d.k === 'rush') max('rushBest', d.score || 0); break;
        case 'daily': { const today = new Date().toDateString(); if (c.dailyLast !== today) { const y = new Date(Date.now() - 864e5).toDateString(); c.dailyStreak = c.dailyLast === y ? (c.dailyStreak || 0) + 1 : 1; c.dailyLast = today; add('daily'); } break; }
      }
      c.level = lvOf(s.xp); Ach.check(s); save(s);
    },
    check(s) {
      s = s || load(); let again = true;
      while (again) {
        again = false; c0: for (const d of DEFS) { if (s.u[d.id]) continue; const c = s.c; c.catsDone = new Set(DEFS.filter(x => s.u[x.id] && x.cat !== 'Milestones').map(x => x.cat)).size + (DEFS.some(x => s.u[x.id] && x.cat === 'Milestones') ? 1 : 0);
          const ok = d.cond ? d.cond(c) : (c[d.key] || 0) >= d.n; if (!ok) continue c0;
          s.u[d.id] = Date.now(); s.xp += d.xp; c.level = lvOf(s.xp); again = true; toast(d); }
      }
      return s;
    },
    progress(d, c) { c = c || load().c; return d.key ? [Math.min(d.n, c[d.key] || 0), d.n] : null; }
  };
  window.ChessAch = Ach; window.ChessFx = Fx;
})();

// Points, Elo-style rating and badges for every terminal exercise that has a right answer.
// Learn More is deliberately excluded: it is a no-stakes workshop, so nothing here changes while it is open.
// Everything is local to this device (localStorage), like the rest of the playground's progress.
(function () {
  if (window.TerminalRewards) return;

  const KEY = 'tpg_rewards_v1';
  const blank = () => ({
    points: 0,
    elo: 1000,
    wins: 0,
    s: { puzzle: 0, lab: 0, job: 0, mission: 0, clean: 0, hints: 0, streakBest: 0, depthBest: 0, jobsBest: 0 },
    badges: {},
    log: []
  });
  const num = value => Number.isFinite(+value) ? +value : 0;
  function load() {
    const base = blank();
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (!saved || typeof saved !== 'object') return base;
      return Object.assign(base, saved, {
        s: Object.assign(base.s, saved.s || {}),
        badges: Object.assign({}, saved.badges || {}),
        log: Array.isArray(saved.log) ? saved.log.slice(0, 12) : []
      });
    } catch (e) { return base; }
  }
  const state = load();
  function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { } }

  const RATINGS = { easy: 800, medium: 1150, hard: 1500, insane: 1850 };
  const POINTS = { easy: 22, medium: 38, hard: 60, insane: 90 };
  const RANKS = [
    [0, '🐣 Curious'], [60, '🔎 Apprentice'], [180, '🛠️ Operator'], [420, '🧭 Pathfinder'],
    [800, '⚙️ Engineer'], [1400, '🛡️ Specialist'], [2200, '🏆 Veteran'], [3400, '🌟 Terminal legend']
  ];
  const rank = points => (RANKS.filter(([at]) => points >= at).pop() || RANKS[0])[1];

  function expected(elo, rating) { return 1 / (1 + Math.pow(10, (rating - elo) / 400)); }

  const BADGES = [
    { id: 'first-key', icon: '🔑', name: 'First key', text: 'Solve a puzzle.', test: s => s.s.puzzle >= 1 },
    { id: 'keys-10', icon: '🗝️', name: 'Key ring', text: 'Solve 10 puzzles.', test: s => s.s.puzzle >= 10 },
    { id: 'keys-50', icon: '🔐', name: 'Locksmith', text: 'Solve 50 puzzles.', test: s => s.s.puzzle >= 50 },
    { id: 'clean-1', icon: '🧼', name: 'No hints needed', text: 'Solve a puzzle with zero hints.', test: s => s.s.clean >= 1 },
    { id: 'clean-5', icon: '🙈', name: 'Eyes closed', text: 'Solve 5 puzzles without hints.', test: s => s.s.clean >= 5 },
    { id: 'streak-3', icon: '🔥', name: 'Warm streak', text: 'Solve 3 puzzles in a row.', test: s => s.s.streakBest >= 3 },
    { id: 'streak-7', icon: '☄️', name: 'Hot streak', text: 'Solve 7 puzzles in a row.', test: s => s.s.streakBest >= 7 },
    { id: 'lab-1', icon: '🌀', name: 'First descent', text: 'Clear a Labyrinth checkpoint.', test: s => s.s.lab >= 1 },
    { id: 'lab-10', icon: '🕳️', name: 'Deep diver', text: 'Clear 10 Labyrinth checkpoints.', test: s => s.s.lab >= 10 },
    { id: 'depth-10', icon: '🪜', name: 'Ten floors down', text: 'Reach Labyrinth depth 10.', test: s => s.s.depthBest >= 10 },
    { id: 'depth-25', icon: '⛏️', name: 'Under the bedrock', text: 'Reach Labyrinth depth 25.', test: s => s.s.depthBest >= 25 },
    { id: 'depth-50', icon: '🌋', name: 'Fifty fathoms', text: 'Reach Labyrinth depth 50.', test: s => s.s.depthBest >= 50 },
    { id: 'job-1', icon: '📋', name: 'On the payroll', text: 'Complete a practice job.', test: s => s.s.job >= 1 },
    { id: 'job-5', icon: '💼', name: 'Reliable worker', text: 'Complete 5 practice jobs.', test: s => s.s.job >= 5 },
    { id: 'job-20', icon: '🧾', name: 'Employee of the month', text: 'Complete 20 practice jobs.', test: s => s.s.job >= 20 },
    { id: 'mission-1', icon: '🎯', name: 'Mission accepted', text: 'Finish a Help-window mission.', test: s => s.s.mission >= 1 },
    { id: 'mission-5', icon: '🗺️', name: 'Field agent', text: 'Finish 5 Help-window missions.', test: s => s.s.mission >= 5 },
    { id: 'mission-10', icon: '🎖️', name: 'Mission control', text: 'Finish 10 Help-window missions.', test: s => s.s.mission >= 10 },
    { id: 'all-rounder', icon: '🧩', name: 'All-rounder', text: 'Earn points in puzzles, the Labyrinth, jobs and missions.', test: s => s.s.puzzle > 0 && s.s.lab > 0 && s.s.job > 0 && s.s.mission > 0 },
    { id: 'points-100', icon: '⭐', name: '100 points', text: 'Collect 100 points.', test: s => s.points >= 100 },
    { id: 'points-500', icon: '🌟', name: '500 points', text: 'Collect 500 points.', test: s => s.points >= 500 },
    { id: 'points-2000', icon: '💫', name: '2000 points', text: 'Collect 2000 points.', test: s => s.points >= 2000 },
    { id: 'elo-1100', icon: '📈', name: 'Above average', text: 'Reach 1100 Elo.', test: s => s.elo >= 1100 },
    { id: 'elo-1300', icon: '🏅', name: 'Sharp', text: 'Reach 1300 Elo.', test: s => s.elo >= 1300 },
    { id: 'elo-1500', icon: '🥇', name: 'Expert', text: 'Reach 1500 Elo.', test: s => s.elo >= 1500 },
    { id: 'elo-1800', icon: '👑', name: 'Grandmaster of shells', text: 'Reach 1800 Elo.', test: s => s.elo >= 1800 }
  ];

  function checkBadges() {
    const fresh = [];
    for (const badge of BADGES) {
      if (state.badges[badge.id]) continue;
      let earned = false;
      try { earned = badge.test(state); } catch (e) { earned = false; }
      if (!earned) continue;
      state.badges[badge.id] = Date.now();
      fresh.push(badge);
    }
    return fresh;
  }

  /* the Cyber Desktop's practice bank pays for terminal work as well: a puzzle room, a Labyrinth floor, a
     job or a Help mission. Inside the desktop the playground lives in an iframe, so the win is posted up to
     the desktop window, which does the crediting. */
  function banked(kind, data) {
    const detail = kind === 'puzzle'
      ? { kind: 'puzzle', diff: { easy: 2, medium: 4, hard: 6, insane: 7 }[data.difficulty] || 4, hinted: Math.max(0, Number(data.hints) || 0) > 0 }
      : kind === 'lab' ? { kind: 'lab', depth: Math.max(1, Number(data.depth) || Number(data.reached) || 1) }
      : kind === 'mission' ? { kind: 'mission', title: data.title || data.id || '' }
      : { kind: 'job' };
    try {
      if (window.A && window.A.cyberBank) {
        if (detail.kind === 'puzzle') window.A.cyberBank.puzzleSolved('cyterm', { diff: detail.diff, hinted: detail.hinted });
        else if (detail.kind === 'lab') window.A.cyberBank.credit(12 + Math.min(6, detail.depth) * 4, 'Labyrinth floor cleared (depth ' + detail.depth + ')', 'lab');
        else if (detail.kind === 'mission') window.A.cyberBank.credit(25, 'Terminal mission: ' + String(detail.title).slice(0, 90), 'mission');
        else window.A.cyberBank.credit(15, 'Terminal job completed', 'job');
        return;
      }
      if (window.parent && window.parent !== window) window.parent.postMessage({ type: 'cyber-earned', detail }, '*');
    } catch (e) { }
  }

  function award(kind, data) {
    data = data || {};
    const before = { points: state.points, elo: state.elo };
    let points = 0, rating = 1000, label = '';
    const hints = Math.max(0, num(data.hints));
    if (kind === 'puzzle') {
      const difficulty = RATINGS[data.difficulty] ? data.difficulty : 'medium';
      points = POINTS[difficulty];
      if (!hints) points = Math.round(points * 1.35);
      else points = Math.round(points * Math.max(0.35, 1 - hints * 0.16));
      if (num(data.tries) > 0) points = Math.max(5, points - Math.min(12, num(data.tries) * 2));
      rating = RATINGS[difficulty];
      label = difficulty + ' puzzle';
      state.s.puzzle++;
      state.s.hints += hints;
      if (!hints) state.s.clean++;
      state.s.streakBest = Math.max(state.s.streakBest, num(data.streak));
    } else if (kind === 'lab') {
      const depth = Math.max(1, num(data.depth));
      points = Math.round(14 + depth * 3.2) - Math.min(8, hints);
      rating = Math.min(2100, 850 + depth * 22);
      label = 'Labyrinth depth ' + depth;
      state.s.lab++;
      state.s.depthBest = Math.max(state.s.depthBest, depth, num(data.reached));
      state.s.hints += hints;
      if (!hints) state.s.clean++;
    } else if (kind === 'job') {
      points = 28 + Math.min(30, num(data.completed) * 2);
      rating = 1050;
      label = 'practice job';
      state.s.job++;
      state.s.jobsBest = Math.max(state.s.jobsBest, num(data.completed));
    } else if (kind === 'mission') {
      points = 45;
      rating = 950;
      label = 'Help mission';
      state.s.mission++;
    } else {
      return null;
    }
    points = Math.max(1, Math.round(points));
    banked(kind, data);
    const delta = Math.max(1, Math.round(32 * (1 - expected(state.elo, rating))));
    state.points += points;
    state.elo += delta;
    state.wins++;
    const fresh = checkBadges();
    state.log.unshift({ icon: kind === 'puzzle' ? '🧩' : kind === 'lab' ? '🌀' : kind === 'job' ? '📋' : '🎯', text: label, points, elo: delta, badges: fresh.map(b => b.icon), at: Date.now() });
    state.log = state.log.slice(0, 12);
    save();
    const result = { points, elo: delta, total: state.points, rating: state.elo, badges: fresh, label };
    try {
      if (window.A && A.toast) {
        A.toast('+' + points + ' points · ' + (delta >= 0 ? '+' : '') + delta + ' Elo' + (fresh.length ? ' · ' + fresh.map(b => b.icon + ' ' + b.name).join(', ') : ''), 4200);
      }
    } catch (e) { }
    return result;
  }

  const esc = text => String(text == null ? '' : text).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const earned = () => BADGES.filter(badge => state.badges[badge.id]);

  function chip() {
    return '<span class="tpg-rwd-chip" title="Points earned in Sandbox, Puzzles, the Labyrinth and missions">⭐ <b>' + state.points + '</b> pts · 🏅 <b>' + state.elo + '</b> Elo</span>';
  }

  function panel() {
    const got = earned();
    const next = BADGES.filter(badge => !state.badges[badge.id]).slice(0, 3);
    return '<div class="tpg-rwd-panel" style="border:1px solid var(--line);border-radius:10px;padding:9px 10px;margin-bottom:8px;background:var(--panel)">' +
      '<div class="row" style="gap:6px;align-items:center"><b class="small">🏆 Rewards</b><span style="flex:1"></span><span class="small mute">' + got.length + '/' + BADGES.length + ' badges</span></div>' +
      '<div class="row" style="gap:6px;flex-wrap:wrap;margin:6px 0 2px"><span class="tpg-rwd-pill">⭐ ' + state.points + ' points</span><span class="tpg-rwd-pill">🏅 ' + state.elo + ' Elo</span><span class="tpg-rwd-pill">' + esc(rank(state.points)) + '</span></div>' +
      (state.log.length ? '<div class="small mute" style="margin-top:4px;line-height:1.45">Last: ' + state.log.slice(0, 3).map(item => esc(item.icon + ' ' + item.text + ' +' + item.points)).join(' · ') + '</div>' : '<div class="small mute" style="margin-top:4px">Solve a puzzle, clear a Labyrinth checkpoint, finish a job or complete a mission to start earning.</div>') +
      (next.length ? '<div class="small" style="margin-top:6px;line-height:1.5"><b>Next badges</b><br>' + next.map(badge => '<span class="tpg-rwd-next">' + badge.icon + ' <b>' + esc(badge.name) + '</b> — ' + esc(badge.text) + '</span>').join('') + '</div>' : '') +
      (got.length ? '<details style="margin-top:6px"><summary class="small">All earned badges</summary><div class="tpg-rwd-badges">' + got.map(badge => '<span class="tpg-rwd-badge" title="' + esc(badge.text) + '">' + badge.icon + ' ' + esc(badge.name) + '</span>').join('') + '</div></details>' : '') +
      '<div class="small mute" style="margin-top:5px;font-size:10.5px">Learn More is a no-stakes workshop: points and Elo only change in Sandbox, Puzzles, the Labyrinth and Help missions.</div>' +
      '</div>';
  }

  window.TerminalRewards = { award, chip, panel, rank, state: () => state, badges: BADGES.slice() };
})();

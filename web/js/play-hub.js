// The Entertainment hub: featured games, your level and streak, a daily challenge, medals and trophies, search and filters,
// a page of tips and facts for every game, and a themed frame around whichever game is running.
// Everything is stored on this PC (ls play_stats).
(() => {
  const P = A.play, M = A.playMeta; if (!P || !M) return;
  const KEY = 'play_stats', hash = s => { let h = 7; s = String(s); for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; };
  let S = (() => { try { return JSON.parse(ls.get(KEY, '{}')) || {}; } catch (e) { return {}; } })();
  S.games = S.games || {}; S.xp = S.xp || 0; S.days = S.days || []; S.ach = S.ach || {}; S.bests = S.bests || 0; S.dailies = S.dailies || 0;
  const save = () => { try { ls.set(KEY, JSON.stringify(S)); } catch (e) { } };
  const today = () => new Date().toLocaleDateString('en-CA'), dayNo = () => Math.floor((Date.now() - new Date().getTimezoneOffset() * 60e3) / 864e5);
  const gs = id => S.games[id] || (S.games[id] = { p: 0, t: 0, last: 0, fav: 0, nb: 0 });
  const meta = id => M.games[id] || { cat: (P.games[id] && P.games[id].cat) || 'more', tag: (P.games[id] && P.games[id].desc || '').split(/[.!]/)[0], tags: [], diff: 2, mins: '5', tips: [], fact: '' };
  const cat = id => M.cats[meta(id).cat] || M.cats.more;
  const ids = () => Object.keys(P.games);

  /* ---------- levels, streaks, medals ---------- */
  const TITLES = ['Newcomer', 'Player', 'Regular', 'Challenger', 'Veteran', 'Champion', 'Master', 'Legend'];
  const level = xp => { let l = 1, need = 120, left = xp; while (left >= need) { left -= need; l++; need = Math.round(120 + l * 40); } return { l, into: left, need, title: TITLES[Math.min(TITLES.length - 1, Math.floor((l - 1) / 3))] }; };
  const streak = () => { const d = new Set(S.days); let n = 0, t = new Date(); if (!d.has(t.toLocaleDateString('en-CA'))) t.setDate(t.getDate() - 1); while (d.has(t.toLocaleDateString('en-CA'))) { n++; t.setDate(t.getDate() - 1); } return n; };
  const medal = id => { const g = S.games[id]; if (!g) return 0; return g.p >= 25 && g.t >= 7200 ? 3 : g.p >= 10 && g.t >= 1800 ? 2 : g.p >= 3 ? 1 : 0; };
  const MEDAL = ['', '🥉', '🥈', '🥇'];
  const totalMin = () => Math.round(Object.values(S.games).reduce((a, g) => a + (g.t || 0), 0) / 60);
  const ACH = [
    ['first', '🎮', 'First steps', 'Play your first game', () => Object.keys(S.games).some(k => S.games[k].p > 0)],
    ['five', '🧭', 'Explorer', 'Play 5 different games', () => Object.keys(S.games).filter(k => S.games[k].p > 0).length >= 5],
    ['fifteen', '🗺️', 'Collector', 'Play 15 different games', () => Object.keys(S.games).filter(k => S.games[k].p > 0).length >= 15],
    ['cats', '🌈', 'All-rounder', 'Play a game from every category', () => M.order.filter(c => c !== 'more').every(c => Object.keys(S.games).some(k => S.games[k].p > 0 && meta(k).cat === c))],
    ['hour', '⏳', 'Marathon', 'Spend an hour playing in all', () => totalMin() >= 60],
    ['str3', '🔥', 'On a roll', 'Play three days in a row', () => streak() >= 3],
    ['str7', '☄️', 'Unstoppable', 'Play seven days in a row', () => streak() >= 7],
    ['bests', '🏆', 'Record breaker', 'Set 5 new personal bests', () => S.bests >= 5],
    ['daily', '📅', 'Daily devotee', 'Finish 5 daily challenges', () => S.dailies >= 5],
    ['gold', '🥇', 'Gold standard', 'Earn a gold medal in any game', () => ids().some(i => medal(i) === 3)],
    ['fav', '⭐', 'Curator', 'Favourite 3 games', () => ids().filter(i => (S.games[i] || {}).fav).length >= 3]
  ];
  const xp = (n, why) => { S.xp += n; const before = level(S.xp - n).l, after = level(S.xp).l; save(); if (after > before) pop('⬆️ Level ' + after + ': ' + level(S.xp).title + '!'); else if (n >= 25) pop('+' + n + ' XP · ' + why); };
  const checkAch = () => ACH.forEach(a => { if (!S.ach[a[0]] && a[4]()) { S.ach[a[0]] = Date.now(); S.xp += 100; save(); pop(a[1] + ' Trophy: ' + a[2] + ' (+100 XP)'); } });
  const pop = t => { try { A.toast(t, 3500); } catch (e) { } };

  /* ---------- the daily challenge ---------- */
  const SCORED = ['2048', 'snake', 'breakout', 'tetris', 'pong', 'flap', 'whack', 'reaction', 'typing', 'simon', 'memory', 'mines', 'slide', 'lights', 'mastermind', 'sudoku', 'wordguess', 'hangman'];
  const daily = () => {
    const d = today(); if (S.daily && S.daily.date === d) return S.daily;
    const list = ids().filter(i => i !== 'aicommons' && i !== 'town'), id = list[(dayNo() * 7 + 3) % list.length], r = hash(d + id) % 3;
    const kind = r === 0 && SCORED.includes(id) ? 'best' : r === 1 ? 'time' : 'play'; S.daily = { date: d, id, kind, prog: 0, done: 0 }; save(); return S.daily;
  };
  const dailyText = dl => dl.kind === 'play' ? 'Play ' + P.games[dl.id].name + ' twice' : dl.kind === 'time' ? 'Spend 5 minutes in ' + P.games[dl.id].name : 'Set a new personal best in ' + P.games[dl.id].name;
  const dailyDone = () => { const dl = daily(); if (dl.done) return; dl.done = 1; S.dailies++; save(); xp(50, 'daily challenge'); pop('📅 Daily challenge complete! (+50 XP)'); checkAch(); };

  /* ---------- tracking a play session ---------- */
  let sess = null;
  const begin = id => { const g = gs(id), now = Date.now(); g.p++; g.last = now; sess = { id, t0: now }; const d = today(); if (!S.days.includes(d)) { S.days.push(d); if (S.days.length > 120) S.days.shift(); } const dl = daily(); if (dl.id === id && dl.kind === 'play' && !dl.done && ++dl.prog >= 2) dailyDone(); save(); xp(5, 'play'); checkAch(); };
  const end = () => { if (!sess) return; const secs = Math.min(3600, Math.round((Date.now() - sess.t0) / 1000)), g = gs(sess.id); g.t += secs; const mins = Math.floor(secs / 60); const dl = daily(); if (dl.id === sess.id && dl.kind === 'time' && !dl.done) { dl.prog += secs; if (dl.prog >= 300) dailyDone(); } sess = null; if (mins >= 1) xp(Math.min(30, mins), 'time'); save(); checkAch(); };
  const oSubmit = P.submit; P.submit = (id, score, lower) => { const nb = oSubmit(id, score, lower); if (nb && Number(score) > 0) { const g = gs(id); g.nb++; S.bests++; save(); burst(['🏆', '⭐', '✨', '🎉']); xp(25, 'new best'); const dl = daily(); if (dl.id === id && dl.kind === 'best' && !dl.done) dailyDone(); checkAch(); } return nb; };
  setInterval(() => { if (sess && !P.active()) end(); }, 2500);
  addEventListener('beforeunload', () => { try { end(); } catch (e) { } });

  /* ---------- little effects ---------- */
  function burst(em) {
    if (document.body.classList.contains('lowpower')) return; const w = document.createElement('div'); w.className = 'gburst'; for (let i = 0; i < 26; i++) { const s = document.createElement('span'); s.textContent = em[i % em.length]; s.style.cssText = '--x:' + (Math.random() * 100) + 'vw;--dx:' + (Math.random() * 160 - 80) + 'px;--d:' + (1.4 + Math.random() * 1.2) + 's;--s:' + (16 + Math.random() * 18) + 'px;--r:' + (Math.random() * 540 - 270) + 'deg;animation-delay:' + (Math.random() * .35) + 's'; w.appendChild(s); } document.body.appendChild(w); setTimeout(() => w.remove(), 3200);
  }

  /* ---------- cards and art ---------- */
  const PAT = { board: 'conic-gradient(rgba(255,255,255,.09) 25%,transparent 0 50%,rgba(255,255,255,.09) 0 75%,transparent 0) 0 0/34px 34px', cards: 'repeating-linear-gradient(45deg,rgba(255,255,255,.08) 0 8px,transparent 8px 16px)', puzzle: 'radial-gradient(rgba(255,255,255,.16) 2px,transparent 2.6px) 0 0/20px 20px', word: 'repeating-linear-gradient(0deg,rgba(255,255,255,.08) 0 1px,transparent 1px 22px)', arcade: 'linear-gradient(rgba(255,255,255,.08) 1px,transparent 1px) 0 0/22px 22px,linear-gradient(90deg,rgba(255,255,255,.08) 1px,transparent 1px) 0 0/22px 22px', adventure: 'radial-gradient(rgba(255,230,160,.28) 1.5px,transparent 2px) 0 0/30px 30px', social: 'radial-gradient(circle at 30% 30%,rgba(255,255,255,.13) 0 26px,transparent 27px) 0 0/64px 64px', cyber: 'repeating-linear-gradient(0deg,rgba(0,255,150,.1) 0 2px,transparent 2px 6px)', more: 'radial-gradient(rgba(255,255,255,.12) 2px,transparent 2.5px) 0 0/24px 24px' };
  const art = id => { const c = cat(id), k = meta(id).cat, h1 = (c.h + (hash(id) % 40) - 20 + 360) % 360, h2 = (h1 + 38) % 360; return 'background:' + (PAT[k] || PAT.more) + ',linear-gradient(135deg,hsl(' + h1 + ' 68% 44%),hsl(' + h2 + ' 72% 24%))'; };
  const dots = n => '●'.repeat(n) + '<span style="opacity:.3">' + '●'.repeat(3 - n) + '</span>';
  const card = (id, mini) => {
    const g = P.games[id], m = meta(id), s = S.games[id] || {}, best = P.best(id), isNew = M.newIds.includes(id), md = medal(id);
    return '<div class="gcard' + (mini ? ' gmini' : '') + '" data-g="' + id + '" tabindex="0" role="button" aria-label="Play ' + esc(g.name) + '"><div class="gcover" style="' + art(id) + '"><span class="gem">' + esc(g.icon) + '</span>' + (isNew ? '<span class="gnew">NEW</span>' : '') + '<button class="gfav' + (s.fav ? ' on' : '') + '" data-fav="' + id + '" title="' + (s.fav ? 'Remove from favourites' : 'Add to favourites') + '" aria-label="Favourite">' + (s.fav ? '★' : '☆') + '</button><span class="gdiff" title="Difficulty">' + dots(m.diff || 2) + '</span></div><div class="gbody"><b>' + esc(g.name) + '</b><div class="gtag">' + esc(m.tag || '') + '</div>' + (mini ? '' : '<div class="gchips">' + (m.tags || []).slice(0, 3).map(t => '<span>' + esc(t) + '</span>').join('') + '</div>') + '</div><div class="gfoot"><span title="Your best">' + (best !== null ? '🏅 ' + best : '·') + '</span><span title="Times played">▶ ' + (s.p || 0) + '</span><span title="Medal">' + (md ? MEDAL[md] : '') + '</span><button class="gi" data-i="' + id + '" title="Tips, facts and challenges" aria-label="Details">ⓘ</button></div></div>';
  };

  /* ---------- the hub view ---------- */
  const view = { q: '', cat: 'all', sort: 'feat', fav: false };
  const norm = s => String(s || '').toLowerCase();
  const pass = id => { const g = P.games[id], m = meta(id); if (view.fav && !(S.games[id] || {}).fav) return false; if (view.cat !== 'all' && m.cat !== view.cat) return false; if (view.q) { const hay = norm(g.name + ' ' + m.tag + ' ' + (m.tags || []).join(' ') + ' ' + cat(id).name); return view.q.split(/\s+/).every(w => hay.includes(w)); } return true; };
  const sorted = list => { const az = (a, b) => P.games[a].name.localeCompare(P.games[b].name); return view.sort === 'plays' ? list.sort((a, b) => ((S.games[b] || {}).p || 0) - ((S.games[a] || {}).p || 0) || az(a, b)) : view.sort === 'recent' ? list.sort((a, b) => ((S.games[b] || {}).last || 0) - ((S.games[a] || {}).last || 0) || az(a, b)) : list.sort(az); };
  const hero = () => {
    const ch = P.games.chess, mw = P.games.middlewatch, im = P.games.rome;
    return (ch ? '<div class="feat" data-g="chess" role="button" tabindex="0" aria-label="Play Chess, the featured game"><div class="feat-board" aria-hidden="true">♞</div><div class="feat-body"><div class="feat-tag">⭐ Featured · the best game in Moundshroud</div><h2 class="feat-title">♟️ Chess</h2><div class="feat-desc">A whole chess site built in: play Stockfish at any strength, online and daily games, tournaments, clubs and a living community, a full career mode, coach, puzzles, courses, variants and voice moves for blindfold play.</div><div class="feat-chips"><span>⚡ Stockfish</span><span>🏆 Career</span><span>🗣 Community</span><span>🎙 Voice moves</span><span>🧩 Puzzles</span><span>🎓 Coach</span></div><button class="pri feat-go">Play chess</button></div></div>' : '') +
      (mw ? '<div class="feat feat2" data-g="middlewatch" role="button" tabindex="0" aria-label="Play Middle Watch, also featured"><div class="feat-board" aria-hidden="true">🕯️</div><div class="feat-body"><div class="feat-tag">⭐ Also featured · an original adventure</div><h2 class="feat-title">Middle Watch</h2><div class="feat-desc">A pixel-art fantasy adventure in four chapters: explore, talk, trade, make allies, and fight or calm your way through. Your progress is saved.</div><div class="feat-chips"><span>🗺 4 chapters</span><span>👾 Pixel art</span><span>💾 Saves progress</span></div><button class="pri feat-go">Play Middle Watch</button></div></div>' : '') +
      (im ? '<div class="feat feat3" data-g="rome" role="button" tabindex="0" aria-label="Play Imperium, a career in Rome"><div class="feat-board" aria-hidden="true">🏛️</div><div class="feat-body"><div class="feat-tag">⭐ Also featured · live a life in Rome</div><h2 class="feat-title">Imperium</h2><div class="feat-desc">A role-playing game and a battle simulator in one: choose who you are, walk the city, talk with Romans who answer in their own voice, debate on the Senate floor, take provinces by war and build your domus.</div><div class="feat-chips"><span>🎭 11 Romans</span><span>🗣 AI conversation</span><span>⚔️ Battles</span><span>🏛 The Senate</span><span>💾 Saves itself</span></div><button class="pri feat-go">Play Imperium</button></div></div>' : '');
  };
  const statsStrip = () => {
    const lv = level(S.xp), st = streak(), dl = daily(), dg = P.games[dl.id], pct = Math.round(lv.into / lv.need * 100), medals = ids().reduce((a, i) => a + (medal(i) ? 1 : 0), 0), trophies = Object.keys(S.ach).length;
    return '<div class="gstats"><div class="gcell glevel"><div class="glv">' + lv.l + '</div><div class="grow"><b>' + lv.title + '</b><div class="gbar"><i style="width:' + pct + '%"></i></div><div class="small mute">' + lv.into + ' / ' + lv.need + ' XP to level ' + (lv.l + 1) + '</div></div></div>' +
      '<div class="gcell"><div class="gbig">🔥 ' + st + '</div><div class="small mute">day streak</div></div><div class="gcell"><div class="gbig">⏱ ' + totalMin() + '</div><div class="small mute">minutes played</div></div><div class="gcell" data-trophies="1" role="button" tabindex="0" title="See your trophies"><div class="gbig">🏅 ' + medals + ' · 🏆 ' + trophies + '</div><div class="small mute">medals · trophies</div></div>' +
      '<div class="gcell gdaily' + (dl.done ? ' done' : '') + '" data-g="' + dl.id + '" role="button" tabindex="0"><div class="small" style="letter-spacing:.08em;text-transform:uppercase;color:var(--acc2)">📅 Daily challenge</div><div class="gdt">' + esc(dg.icon) + ' ' + esc(dailyText(dl)) + '</div><div class="small mute">' + (dl.done ? '✓ Done. Come back tomorrow for another.' : (dl.kind === 'time' ? Math.min(5, Math.floor(dl.prog / 60)) + ' / 5 min' : dl.kind === 'play' ? dl.prog + ' / 2 plays' : 'Reward: 50 XP')) + '</div></div></div>';
  };
  const toolbar = cy => '<div class="gtools"><input type="search" id="gq" placeholder="Search games, tags, tips..." value="' + esc(view.q) + '" autocomplete="off" aria-label="Search games"><div class="gchipsrow" id="gcats">' + (cy ? '' : '<button class="chip' + (view.cat === 'all' ? ' on' : '') + '" data-cat="all">All</button>') + (cy ? [] : M.order.filter(c => c !== 'more' && c !== 'cyber' && ids().some(i => meta(i).cat === c))).map(c => '<button class="chip' + (view.cat === c ? ' on' : '') + '" data-cat="' + c + '">' + M.cats[c].icon + ' ' + M.cats[c].name + '</button>').join('') + '<button class="chip' + (view.fav ? ' on' : '') + '" data-fav-f="1">★ Favourites</button></div><label class="small mute">Sort <select id="gsort"><option value="feat"' + (view.sort === 'feat' ? ' selected' : '') + '>By category</option><option value="az"' + (view.sort === 'az' ? ' selected' : '') + '>A to Z</option><option value="plays"' + (view.sort === 'plays' ? ' selected' : '') + '>Most played</option><option value="recent"' + (view.sort === 'recent' ? ' selected' : '') + '>Recently played</option></select></label></div>';
  function paint(b, onlyCyber) {
    const list = ids().filter(i => (onlyCyber ? meta(i).cat === 'cyber' : meta(i).cat !== 'cyber') && pass(i));
    const recent = ids().filter(i => (S.games[i] || {}).last && !(onlyCyber !== (meta(i).cat === 'cyber') && false)).sort((a, c) => S.games[c].last - S.games[a].last).slice(0, 6);
    const filtered = view.q || view.cat !== 'all' || view.fav || view.sort !== 'feat', showHero = !onlyCyber && !filtered;
    let h = '';
    if (!onlyCyber) h += (showHero ? hero() : '') + statsStrip() + (showHero && recent.length ? '<div class="gshelfhead"><b>▶ Continue playing</b></div><div class="gshelf gmini-row">' + recent.map(i => card(i, true)).join('') + '</div>' : '') + toolbar();
    else h += '<div class="gstats gone">' + '<div class="gcell"><b>Cyber games</b><div class="small mute">Hacker-style puzzles that teach how attacks and defences really work. Everything is a safe sandbox with pretend files, a pretend database and made-up emails. For the guides behind them, open Cyber → Cyber Lab.</div></div></div>' + toolbar(onlyCyber);
    if (!list.length) h += '<div class="gempty">Nothing matches. Try a different search or filter.</div>';
    else if (!filtered) {
      M.order.forEach(c => { const l = sorted(list.filter(i => meta(i).cat === c && (showHero ? i !== 'chess' && i !== 'middlewatch' : true))); if (!l.length) return; h += (onlyCyber ? '' : '<div class="gshelfhead"><b>' + M.cats[c].icon + ' ' + M.cats[c].name + '</b><span class="small mute">' + esc(M.cats[c].blurb) + '</span></div>') + '<div class="gshelf gcatrow cat-' + c + '">' + l.map(i => card(i)).join('') + '</div>'; });
    } else h += '<div class="gshelf">' + sorted(list.slice()).map(i => card(i)).join('') + '</div>';
    b.innerHTML = '<div class="scroll pad gh" style="flex:1"><h2 class="ghtitle">' + (onlyCyber ? '🕶️ Cyber games' : '🎮 Game room') + '</h2>' + h + '</div>';
    const q = b.querySelector('#gq'); if (q) { q.oninput = () => { view.q = norm(q.value).trim(); const pos = q.selectionStart; paint(b, onlyCyber); const n = b.querySelector('#gq'); n.focus(); n.setSelectionRange(pos, pos); }; q.onkeydown = e => e.stopPropagation(); }
    const so = b.querySelector('#gsort'); if (so) so.onchange = () => { view.sort = so.value; paint(b, onlyCyber); };
    b.onclick = e => {
      const f = e.target.closest('[data-fav]'); if (f) { e.stopPropagation(); const g = gs(f.dataset.fav); g.fav = g.fav ? 0 : 1; save(); checkAch(); paint(b, onlyCyber); return; }
      const i = e.target.closest('[data-i]'); if (i && P.games[i.dataset.i]) { e.stopPropagation(); info(i.dataset.i); return; }
      const c = e.target.closest('[data-cat]'); if (c) { view.cat = c.dataset.cat; paint(b, onlyCyber); return; }
      if (e.target.closest('[data-fav-f]')) { view.fav = !view.fav; paint(b, onlyCyber); return; }
      if (e.target.closest('[data-trophies]')) { trophies(); return; }
      const g = e.target.closest('[data-g]'); if (g) P.start(g.dataset.g);
    };
    b.onkeydown = e => { if (e.key !== 'Enter' && e.key !== ' ') return; const t = e.target.closest && e.target.closest('[data-g],[data-trophies]'); if (!t || /INPUT|SELECT/.test(e.target.tagName)) return; e.preventDefault(); if (t.dataset.trophies) trophies(); else P.start(t.dataset.g); };
  }
  P.addSub('arcade', '🕹️ Arcade', b => paint(b, false));
  /* the cyber games have their own place in the Cyber tab (relocate.js), so they are not a page of the Games tab */

  /* ---------- a page for each game, and the trophy shelf ---------- */
  const modal = html => { const d = document.createElement('div'); d.className = 'gmodal'; d.innerHTML = '<div class="gsheet" role="dialog" aria-modal="true">' + html + '</div>'; document.body.appendChild(d); const close = () => d.remove(); d.onclick = e => { if (e.target === d || e.target.closest('[data-x]')) close(); }; const k = e => { if (e.key === 'Escape') { e.stopPropagation(); close(); document.removeEventListener('keydown', k, true); } }; document.addEventListener('keydown', k, true); return { d, close }; };
  function info(id) {
    const g = P.games[id], m = meta(id), s = S.games[id] || {}, h = P.help && P.help[id], md = medal(id), mins = Math.round((s.t || 0) / 60);
    const prog = (n, of) => '<div class="gbar sm"><i style="width:' + Math.min(100, Math.round(n / of * 100)) + '%"></i></div>';
    const chal = [['Play 3 times', (s.p || 0) >= 3, (s.p || 0) + ' / 3'], ['Spend 10 minutes here', mins >= 10, mins + ' / 10 min'], ['Set a new personal best', (s.nb || 0) >= 1, (s.nb || 0) >= 1 ? 'done' : 'not yet']];
    const { d, close } = modal('<div class="gscover" style="' + art(id) + '"><span class="gem big">' + esc(g.icon) + '</span><button class="ib" data-x="1" aria-label="Close">✕</button></div><div class="gsbody"><div class="row" style="gap:10px;align-items:flex-start;flex-wrap:wrap"><div style="flex:1;min-width:200px"><h2 style="margin:0">' + esc(g.name) + '</h2><div class="mute">' + esc(m.tag || '') + '</div><div class="gchips" style="margin-top:6px"><span>' + cat(id).icon + ' ' + esc(cat(id).name) + '</span><span>Difficulty ' + dots(m.diff || 2) + '</span><span>⏱ about ' + esc(m.mins || '5') + ' min</span>' + (m.tags || []).map(t => '<span>' + esc(t) + '</span>').join('') + '</div></div><div class="row" style="gap:8px"><button class="ib" data-favm="1">' + (s.fav ? '★ Favourited' : '☆ Favourite') + '</button><button class="pri" data-play="1">▶ Play</button></div></div>' +
      (h ? '<h3>How to play</h3><div>' + esc(h[0]) + '</div><ol class="gsteps">' + (h[1] || []).map(x => '<li>' + esc(x) + '</li>').join('') + '</ol>' : '') +
      (m.tips && m.tips.length ? '<h3>Tips from the pros</h3><ul class="gsteps">' + m.tips.map(x => '<li>' + esc(x) + '</li>').join('') + '</ul>' : '') + (m.fact ? '<div class="gfact">💡 <b>Did you know?</b> ' + esc(m.fact) + '</div>' : '') +
      '<h3>Your progress</h3><div class="gprog"><div><b>' + (s.p || 0) + '</b><span class="small mute">plays</span></div><div><b>' + mins + '</b><span class="small mute">minutes</span></div><div><b>' + (P.best(id) !== null ? P.best(id) : '·') + '</b><span class="small mute">best</span></div><div><b>' + (md ? MEDAL[md] : '·') + '</b><span class="small mute">medal</span></div></div>' +
      '<div class="small mute" style="margin-top:6px">🥉 3 plays · 🥈 10 plays and 30 minutes · 🥇 25 plays and 2 hours</div><h3>Challenges</h3>' + chal.map(c => '<div class="gchal' + (c[1] ? ' done' : '') + '"><span>' + (c[1] ? '✅' : '⬜') + ' ' + c[0] + '</span><span class="small mute">' + c[2] + '</span></div>').join('') + '</div>');
    d.querySelector('[data-play]').onclick = () => { close(); P.start(id); };
    d.querySelector('[data-favm]').onclick = e => { const x = gs(id); x.fav = x.fav ? 0 : 1; save(); checkAch(); e.target.textContent = x.fav ? '★ Favourited' : '☆ Favourite'; };
  }
  function trophies() {
    const lv = level(S.xp);
    const { d } = modal('<div class="gsbody"><div class="row" style="align-items:center;gap:10px"><h2 style="margin:0;flex:1">🏅 Your trophy shelf</h2><button class="ib" data-x="1" aria-label="Close">✕</button></div><div class="mute">Level ' + lv.l + ' · ' + lv.title + ' · ' + S.xp + ' XP in all</div><div class="gtroph">' + ACH.map(a => '<div class="gt' + (S.ach[a[0]] ? ' got' : '') + '"><span class="gte">' + (S.ach[a[0]] ? a[1] : '🔒') + '</span><b>' + a[2] + '</b><span class="small mute">' + a[3] + '</span></div>').join('') + '</div><h3>Medals</h3><div class="gmedals">' + (ids().filter(medal).sort((a, b) => medal(b) - medal(a)).map(i => '<span class="chip">' + MEDAL[medal(i)] + ' ' + esc(P.games[i].icon) + ' ' + esc(P.games[i].name) + '</span>').join('') || '<span class="mute small">Play a game three times to earn your first bronze medal.</span>') + '</div></div>');
  }

  /* ---------- the frame around a running game ---------- */
  const oStart = P.start; let tipT = 0, clockT = 0;
  P.start = function (id) {
    end(); const r = oStart.apply(this, arguments); if (!P.active()) return r; begin(id); frame(id); return r;
  };
  function frame(id) {
    const b = document.getElementById('plbody'), st = document.getElementById('plstage'); if (!b || !st) return; const m = meta(id), c = cat(id), head = b.firstElementChild;
    b.classList.add('gframe', 'gc-' + m.cat); b.style.setProperty('--gh', c.h); if (head) { head.classList.add('ghead'); }
    const bar = document.createElement('div'); bar.className = 'ginfo'; bar.innerHTML = '<span class="gcat">' + c.icon + ' ' + esc(c.name) + '</span><span class="gdiffs" title="Difficulty">' + dots(m.diff || 2) + '</span><span class="gtip" id="gtip"></span><span class="gtimer" id="gtimer" title="Time in this session">0:00</span>';
    if (head) head.after(bar); let tips = (m.tips || []).concat(m.fact ? ['Did you know? ' + m.fact] : []); if (id === 'chess' && window.CHESS_TIPS) tips = window.CHESS_TIPS.concat(tips).map(x => [Math.random(), x]).sort((a, b) => a[0] - b[0]).map(x => x[1]); let i = 0; const tip = () => { const e = document.getElementById('gtip'); if (e && tips.length) { e.textContent = '💡 ' + tips[i++ % tips.length]; } }; tip();
    clearInterval(tipT); tipT = setInterval(() => { if (!P.active()) { clearInterval(tipT); return; } tip(); }, id === 'chess' ? 12000 : 20000);
    const t0 = Date.now(); clearInterval(clockT); clockT = setInterval(() => { const e = document.getElementById('gtimer'); if (!e || !P.active()) { clearInterval(clockT); return; } const s = Math.floor((Date.now() - t0) / 1000); e.textContent = Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }, 1000);
  }
  A.playHub = { stats: () => S, level: () => level(S.xp), medal, daily, checkAch, info, trophies };
  checkAch();
})();

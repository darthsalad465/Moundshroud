// Chess hub: Mini-games (coordinate trainer, knight's tour, eight queens, attack trainer, pawn wars, puzzle rush, daily challenge), Trophies and Books tabs.
(() => {
  const C = Chess, U = () => window.ChessUI, Ach = () => window.ChessAch, Fx = () => window.ChessFx;
  const rnd = n => Math.random() * n | 0, FILES = 'abcdefgh';
  const sqName = (r, c) => FILES[c] + (8 - r);
  const ev = (k, d) => { try { Ach().event(k, d); } catch (e) { } };
  const lsGet = (k, d) => { try { return JSON.parse(ls.get(k, JSON.stringify(d))); } catch (e) { return d; } };

  /* ---- a plain clickable 8x8 grid used by several mini-games ---- */
  function grid(host, o) {
    host.innerHTML = '<div class="mgb" style="--sz:var(--csz,56px);display:grid;grid-template:repeat(8,var(--sz))/repeat(8,var(--sz));border-radius:10px;overflow:hidden;border:2px solid var(--line);box-shadow:0 10px 30px rgba(0,0,0,.35);user-select:none"></div>';
    const el = host.firstChild; let flip = !!o.flip;
    const draw = (cellFn) => { let h = ''; for (let i = 0; i < 64; i++) { const sq = flip ? 63 - i : i, r = sq >> 3, c = sq & 7, x = cellFn(r, c, sq) || {}; h += '<div data-r="' + r + '" data-c="' + c + '" style="position:relative;display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:calc(var(--sz)*.7);line-height:1;background:' + (x.bg || ((r + c) & 1 ? 'var(--sqD)' : 'var(--sqL)')) + ';transition:background .15s,transform .15s;' + (x.style || '') + '">' + (x.html || '') + '</div>'; } el.innerHTML = h; };
    el.onclick = e => { const t = e.target.closest('[data-r]'); if (t) o.onclick(+t.dataset.r, +t.dataset.c); };
    return { draw, flip: v => { flip = v; }, el };
  }
  const piece = (ch, white) => '<span style="color:' + (white ? '#fff' : '#14161c') + ';-webkit-text-stroke:' + (white ? '.9px #1a1a1a' : '0') + ';filter:drop-shadow(0 2px 1px rgba(0,0,0,.45))">' + ch + '</span>';

  /* ======================== MINI-GAMES ======================== */
  function minis(host, api, ctx) {
    let cleanup = null;
    const MG = [
      ['coord', '🎯', 'Coordinate Sniper', 'A square name appears. Click it fast! 30 seconds.'],
      ['tour', '🐴', 'Knight\'s Tour', 'Visit every square once with a knight.'],
      ['queens', '👸', 'Eight Queens', 'Place 8 queens so none attack each other.'],
      ['attack', '👁️', 'Attack Trainer', 'Click every square the piece attacks.'],
      ['pawnwars', '♙', 'Pawn Wars', 'Only pawns and kings. Race a pawn to the end!'],
      ['rush', '🚀', 'Puzzle Rush', 'Solve easy puzzles for 3 minutes. Three strikes and out.'],
    ];
    const list = () => {
      if (cleanup) { cleanup(); cleanup = null; } const best = lsGet('chmini', {}), day = dailyPuzzle(), done = Ach().data().c.dailyLast === new Date().toDateString();
      host.onclick = e => { const c = e.target.closest('[data-m]'); if (c) { if (c.dataset.m === 'daily') return daily(); open(c.dataset.m); } };
      host.innerHTML = '<p class="mute small" style="margin:0 0 10px">Little games that teach the board without the pressure. Each one counts toward trophies.</p><div class="acg"><div class="card" data-m="daily" style="border-color:var(--acc)"><div style="font-size:26px">📅</div><b>Daily challenge</b><div class="small mute">A new puzzle every day. ' + (done ? '✅ Done today!' : 'Keep your streak alive.') + '</div></div>' + A.az(MG, m => m[2]).map(m => '<div class="card" data-m="' + m[0] + '"><div style="font-size:26px">' + m[1] + '</div><b>' + m[2] + '</b><div class="small mute">' + m[3] + '</div>' + (best[m[0]] != null ? '<div class="small" style="margin-top:4px;color:var(--acc2)">Best: ' + best[m[0]] + '</div>' : '') + '</div>').join('') + '</div>';
      void day;
    };
    const setBest = (k, v, lower) => { const b = lsGet('chmini', {}); if (b[k] == null || (lower ? v < b[k] : v > b[k])) { b[k] = v; ls.set('chmini', JSON.stringify(b)); return true; } return false; };
    const open = id => {
      if (cleanup) cleanup(); host.onclick = null; ev('mini', { k: id === 'attack' ? 'attack' : id === 'pawnwars' ? 'pawnwarsStart' : id === 'rush' ? 'rushStart' : id === 'coord' ? 'coordStart' : id });
      host.innerHTML = '<div class="row" style="margin-bottom:8px"><button class="ib" id="mgback">&larr; Mini-games</button><b style="flex:1;margin-left:6px">' + MG.find(m => m[0] === id)[2] + '</b></div><div id="mgbody"></div>'; host.querySelector('#mgback').onclick = list;
      cleanup = GAMES[id](host.querySelector('#mgbody'), api, { setBest });
    };

    const GAMES = {
      /* ---- coordinate sniper ---- */
      coord(h, api, X) {
        h.innerHTML = '<div class="acw"><div id="cgb"></div><div class="acside"><div class="acmsg" style="font-size:34px;text-align:center" id="cgt">Ready?</div><div class="row" style="gap:6px"><button class="pri" id="cgs">Start</button><label class="chk small"><input type="checkbox" id="cgf"> View from Black</label></div><div class="acmsg small" id="cgi">Name the square shown, then click it on the board. You have 30 seconds. Rank and file labels are hidden on purpose!</div></div></div>';
        let target = null, score = 0, left = 0, timer = null, live = false, flash = null; const g = grid(h.querySelector('#cgb'), { onclick: (r, c) => { if (!live) return; if (sqName(r, c) === target) { score++; flash = [r, c, 'good']; pick(); } else { flash = [r, c, 'bad']; left = Math.max(0, left - 1); } paint(); setTimeout(() => { flash = null; paint(); }, 280); } });
        const paint = () => g.draw((r, c) => flash && flash[0] === r && flash[1] === c ? { bg: flash[2] === 'good' ? 'rgba(80,200,120,.8)' : 'rgba(255,80,100,.8)' } : null); const pick = () => { let t; do { t = sqName(rnd(8), rnd(8)); } while (t === target); target = t; h.querySelector('#cgt').textContent = target; };
        const end = () => { live = false; clearInterval(timer); h.querySelector('#cgt').textContent = score + ' squares!'; const nb = X.setBest('coord', score); api.hud('Sniper ' + score); ev('mini', { k: 'coord', score }); h.querySelector('#cgi').textContent = nb ? 'New best! ' : 'Your best is ' + lsGet('chmini', {}).coord + '. '; if (score >= 20) Fx().confetti({ n: 50 }); };
        h.querySelector('#cgs').onclick = () => { score = 0; left = 30; live = true; g.flip(h.querySelector('#cgf').checked); pick(); paint(); clearInterval(timer); timer = setInterval(() => { left--; api.hud(score + ' · ' + left + ' s'); if (left <= 0) end(); }, 1000); };
        paint(); return () => { clearInterval(timer); live = false; };
      },
      /* ---- knight's tour ---- */
      tour(h, api, X) {
        h.innerHTML = '<div class="acw"><div id="ktb"></div><div class="acside"><div class="acmsg" id="kts">Click any square to place the knight, then keep jumping to squares you have not visited.</div><div class="row" style="gap:6px"><button class="ib" id="ktr">Restart</button><button class="ib" id="kth">Hint</button></div><div class="acmsg small">The knight moves in an L. Visit all 64 squares exactly once. Tip: head for the squares with the fewest exits first!</div></div></div>';
        let vis, cur, n, over; const reset = () => { vis = Array.from({ length: 8 }, () => Array(8).fill(0)); cur = null; n = 0; over = false; hintSq = null; paint(); h.querySelector('#kts').textContent = 'Click any square to place the knight.'; };
        let hintSq = null; const moves = (r, c) => [[1, 2], [2, 1], [-1, 2], [-2, 1], [1, -2], [2, -1], [-1, -2], [-2, -1]].map(([a, b]) => [r + a, c + b]).filter(([a, b]) => a >= 0 && a < 8 && b >= 0 && b < 8 && !vis[a][b]);
        const g = grid(h.querySelector('#ktb'), { onclick: (r, c) => { if (over) return; if (!cur) { cur = [r, c]; vis[r][c] = ++n; paint(); return; } if (!moves(cur[0], cur[1]).some(([a, b]) => a === r && b === c)) { Fx().pop(g.el); return; } cur = [r, c]; vis[r][c] = ++n; hintSq = null; paint(); api.hud('Visited ' + n + '/64'); if (n === 64) { over = true; h.querySelector('#kts').textContent = 'You completed the tour! 🎉'; Fx().confetti(); ev('mini', { k: 'tour' }); } else if (!moves(r, c).length) { over = true; h.querySelector('#kts').textContent = 'Stuck after ' + n + ' squares. Press Restart and try again.'; } else h.querySelector('#kts').textContent = n + ' of 64 squares visited'; } });
        const paint = () => { const ok = cur ? moves(cur[0], cur[1]) : []; g.draw((r, c) => { const v = vis[r][c], isCur = cur && cur[0] === r && cur[1] === c, can = ok.some(([a, b]) => a === r && b === c); return { bg: isCur ? 'rgba(255,214,10,.75)' : v ? 'rgba(139,124,255,.55)' : hintSq && hintSq[0] === r && hintSq[1] === c ? 'rgba(79,168,255,.7)' : null, html: isCur ? piece('♞', true) : v ? '<span style="font:700 12px Segoe UI;color:#fff">' + v + '</span>' : can ? '<span style="width:30%;height:30%;border-radius:50%;background:rgba(20,30,20,.35)"></span>' : '' }; }); };
        h.querySelector('#ktr').onclick = reset; h.querySelector('#kth').onclick = () => { if (!cur || over) return; const o = moves(cur[0], cur[1]); if (!o.length) return; const cnt = ([a, b]) => { vis[a][b] = -1; const k = moves(a, b).length; vis[a][b] = 0; return k; }; o.sort((p, q) => cnt(p) - cnt(q)); hintSq = o[0]; paint(); };
        reset(); return () => { };
      },
      /* ---- eight queens ---- */
      queens(h, api, X) {
        h.innerHTML = '<div class="acw"><div id="qb"></div><div class="acside"><div class="acmsg" id="qs">Click a square to place a queen, click it again to remove it.</div><div class="row" style="gap:6px"><button class="ib" id="qr">Clear</button></div><div class="acmsg small" id="qi">There are 92 different solutions. Red squares show queens that attack each other.</div></div></div>';
        let q = []; const found = new Set(lsGet('chqueens', [])); const conflicts = () => { const bad = new Set(); for (let i = 0; i < q.length; i++) for (let j = i + 1; j < q.length; j++) { const [a, b] = q[i], [c, d] = q[j]; if (a === c || b === d || Math.abs(a - c) === Math.abs(b - d)) { bad.add(i); bad.add(j); } } return bad; };
        const paint = () => { const bad = conflicts(); g.draw((r, c) => { const k = q.findIndex(x => x[0] === r && x[1] === c); return k >= 0 ? { bg: bad.has(k) ? 'rgba(255,80,100,.7)' : null, html: piece('♛', true) } : null; }); const st = h.querySelector('#qs'); if (q.length === 8 && !bad.size) { const key = q.slice().sort((a, b) => a[0] - b[0]).map(x => x[1]).join(''); const fresh = !found.has(key); found.add(key); ls.set('chqueens', JSON.stringify([...found])); st.textContent = 'Solved! ' + (fresh ? 'A new solution - you have found ' + found.size + '.' : 'You already found that one.'); if (fresh) { Fx().confetti(); ev('mini', { k: 'queens', sol: key }); } } else st.textContent = q.length + ' queens placed' + (bad.size ? ' - some attack each other' : ''); api.hud(q.length + ' queens'); };
        const g = grid(h.querySelector('#qb'), { onclick: (r, c) => { const k = q.findIndex(x => x[0] === r && x[1] === c); if (k >= 0) q.splice(k, 1); else if (q.length < 8) q.push([r, c]); paint(); } }); h.querySelector('#qr').onclick = () => { q = []; paint(); }; paint(); return () => { };
      },
      /* ---- attack trainer ---- */
      attack(h, api, X) {
        h.innerHTML = '<div class="acw"><div id="ab"></div><div class="acside"><div class="acmsg" id="as">Click every square this piece can move to.</div><div class="acmsg small" id="ai2">Score: <b id="asc">0</b> · Streak: <b id="ast">0</b></div><button class="ib" id="ask">Skip</button></div></div>';
        let pc, from, want, got, score = 0, streak = 0; const NAMES = { 2: ['♞', 'knight'], 3: ['♝', 'bishop'], 4: ['♜', 'rook'], 5: ['♛', 'queen'], 6: ['♚', 'king'] };
        const newRound = () => { do { const t = [2, 3, 4, 5, 6][rnd(5)]; pc = t; from = [rnd(8), rnd(8)]; const fen = (() => { const b = Array.from({ length: 8 }, () => Array(8).fill('')); b[from[0]][from[1]] = 'PNBRQK'[t - 1]; const place = (ch) => { for (let k = 0; k < 40; k++) { const r = rnd(8), c = rnd(8); if (!b[r][c] && Math.max(Math.abs(r - from[0]), Math.abs(c - from[1])) > 2) { b[r][c] = ch; return; } } }; if (t !== 6) place('K'); place('k'); if (t === 6) { const r = from[0], c = from[1]; b[r][c] = 'K'; } return b.map(row => { let s = '', e = 0; for (const x of row) { if (!x) e++; else { if (e) { s += e; e = 0; } s += x; } } return (s + (e || '')); }).join('/') + ' w - - 0 1'; })(); const p = new C.Pos().setFen(fen); const kk = p.ksq; if (!p.b.some(x => Math.abs(x) === 6) || p.legal === undefined) continue; want = new Set(p.legal().filter(m => (m & 63) === from[0] * 8 + from[1]).map(m => ((m >> 6) & 63))); } while (!want || !want.size); got = new Set(); h.querySelector('#as').innerHTML = 'Click every square the <b>' + NAMES[pc][1] + '</b> can move to.'; paint(); };
        const g = grid(h.querySelector('#ab'), { onclick: (r, c) => { const sq = r * 8 + c; if (sq === from[0] * 8 + from[1]) return; if (want.has(sq)) { got.add(sq); if (got.size === want.size) { score++; streak++; h.querySelector('#asc').textContent = score; h.querySelector('#ast').textContent = streak; X.setBest('attack', score); api.hud('Attack ' + score); Fx().sparkle(g.el); ev('mini', { k: 'attack' }); setTimeout(newRound, 500); } } else { streak = 0; h.querySelector('#ast').textContent = 0; Fx().pop(g.el); } paint(); } });
        const paint = () => g.draw((r, c, sq) => { if (r === from[0] && c === from[1]) return { html: piece(NAMES[pc][0], true), bg: 'rgba(255,214,10,.6)' }; if (got.has(sq)) return { bg: 'rgba(80,200,120,.7)' }; return null; });
        h.querySelector('#ask').onclick = () => { streak = 0; newRound(); }; newRound(); return () => { };
      },
      /* ---- pawn wars ---- */
      pawnwars(h, api, X) {
        const { Board, Eng } = U(); h.innerHTML = '<div class="acw"><div id="pwb"></div><div class="acside"><div class="acmsg" id="pws">You have the white pawns. Get one to the last rank first!</div><div class="row" style="gap:6px"><button class="ib" id="pwr">Restart</button><label class="small mute">Moundshroud <select id="pwl"><option value="900">Easy</option><option value="1400" selected>Medium</option><option value="1900">Hard</option></select></label></div><div class="acmsg small">Pawns can only move forward and capture diagonally. Promote a pawn, or leave your opponent without a move, to win.</div></div></div>';
        let board = new Board(h.querySelector('#pwb')), eng = Eng(), pos, over, busy, tok = 0;
        const START = '4k3/pppppppp/8/8/8/8/PPPPPPPP/4K3 w - - 0 1';
        const status = t => { h.querySelector('#pws').textContent = t; };
        const refresh = last => board.set(pos.fen(), { who: !over && !busy && pos.side > 0 ? 1 : 0, last });
        const check = () => { const l = pos.legal(); const wp = [...Array(8).keys()].some(c => pos.b[c] === 1), bp = [...Array(8).keys()].some(c => pos.b[56 + c] === -1); if (wp || (pos.side < 0 && !l.length && false)) return fin(true, 'You promoted a pawn - you win!'); if (bp) return fin(false, 'Moundshroud promoted a pawn.'); if (!l.length) return pos.inCheck() ? fin(pos.side < 0, pos.side < 0 ? 'Checkmate - you win!' : 'Checkmate - Moundshroud wins.') : fin(false, 'No moves left - a draw.', true); return false; };
        const fin = (win, t, draw) => { over = true; refresh(); status(t); if (win) { Fx().confetti(); X.setBest('pawnwars', 1); ev('mini', { k: 'pawnwars', win: true }); } return true; };
        const aiMove = () => { busy = true; const my = ++tok; refresh(); status('Moundshroud is thinking...'); eng.ask({ fen: pos.fen(), elo: +h.querySelector('#pwl').value, ms: 900 }).then(r => { if (my !== tok) return; busy = false; const l = pos.legal(); const m = l.find(x => x === (r && r.move)) ?? l[0]; if (!m) return; pos.make(m); const f = m & 63, t = (m >> 6) & 63; if (!check()) { status('Your move'); refresh([f, t]); } }); };
        board.onmove = m => { if (over || busy || pos.side < 0) return; const f = m & 63, t = (m >> 6) & 63; pos.make(m); if (check()) return; refresh([f, t]); aiMove(); };
        const reset = () => { tok++; eng.reset(); pos = new C.Pos().setFen(START); over = false; busy = false; status('You have the white pawns. Get one to the last rank first!'); refresh(); };
        h.querySelector('#pwr').onclick = reset; reset(); return () => { tok++; eng.kill(); board.destroy(); };
      },
      /* ---- puzzle rush ---- */
      rush(h, api, X) {
        const { Board } = U(), PZ = U().PZ; h.innerHTML = '<div class="acw"><div id="rb"></div><div class="acside"><div class="acmsg" style="text-align:center"><div style="font:700 32px Segoe UI" id="rt">3:00</div><div id="rsc" class="mute">Solved: 0 · Strikes: 0/3</div></div><div class="acmsg" id="rm">Press Start. Solve easy puzzles as fast as you can!</div><button class="pri" id="rs">Start</button></div></div>';
        let board = new Board(h.querySelector('#rb')), p, left = 0, tick, solved = 0, strikes = 0, live = false, pm = null;
        const next = () => { p = PZ.take({ level: 'easy', moves: '1', source: 'all', themes: [] }) || PZ.take({ level: 'easy', source: 'all', themes: [] }); if (!p) { h.querySelector('#rm').textContent = 'Out of puzzles for now - generating more...'; setTimeout(next, 1500); return; } const pos = new C.Pos().setFen(p.f); board.set(p.f, { who: pos.side, flipped: pos.side < 0 }); h.querySelector('#rm').textContent = (pos.side > 0 ? 'White' : 'Black') + ' to move'; PZ.use({ level: 'easy', moves: '1', source: 'all', themes: [] }); };
        const end = () => { live = false; clearInterval(tick); board.who = 0; const nb = X.setBest('rush', solved); h.querySelector('#rm').textContent = 'Finished! You solved ' + solved + (nb ? ' - a new best!' : '') + '.'; api.hud('Rush ' + solved); ev('mini', { k: 'rush', score: solved }); if (solved >= 10) Fx().confetti(); };
        const upd = () => { h.querySelector('#rt').textContent = Math.floor(left / 60) + ':' + String(left % 60).padStart(2, '0'); h.querySelector('#rsc').textContent = 'Solved: ' + solved + ' · Strikes: ' + strikes + '/3'; };
        board.onmove = m => { if (!live || !p) return; const u = board.pos.uci(m); if (p.s.includes(u)) { solved++; Fx().pop(board.el); board.play(m); upd(); setTimeout(next, 350); } else { strikes++; board.shake(); board.sel = -1; board.targets = []; board.draw(); upd(); if (strikes >= 3) end(); } };
        h.querySelector('#rs').onclick = () => { solved = 0; strikes = 0; left = 180; live = true; upd(); next(); clearInterval(tick); tick = setInterval(() => { left--; upd(); if (left <= 0) end(); }, 1000); };
        return () => { live = false; clearInterval(tick); board.destroy(); };
      },
    };

    /* ---- daily challenge: one puzzle a day, picked from the bank by date ---- */
    function dailyPuzzle() { const bank = (window.CHESS_PUZZLES || []).filter(p => p.l !== 'hard' || p.k <= 3); const d = new Date(), seed = d.getFullYear() * 400 + d.getMonth() * 31 + d.getDate(); return bank.length ? bank[seed % bank.length] : null; }
    function daily() {
      if (cleanup) cleanup(); host.onclick = null; const p = dailyPuzzle(); if (!p) return;
      const { Board } = U(); host.innerHTML = '<div class="row" style="margin-bottom:8px"><button class="ib" id="mgback">&larr; Mini-games</button><b style="flex:1;margin-left:6px">📅 Daily challenge</b></div><div class="acw"><div id="db"></div><div class="acside"><div class="acmsg" id="dm"></div><div class="small mute" id="dst"></div></div></div>'; host.querySelector('#mgback').onclick = list;
      const board = new Board(host.querySelector('#db')); let ply = 0, busy = false, solved = Ach().data().c.dailyLast === new Date().toDateString(); const pos0 = new C.Pos().setFen(p.f);
      const msg = t => { host.querySelector('#dm').innerHTML = t; }; board.set(p.f, { who: solved ? 0 : pos0.side, flipped: pos0.side < 0 }); msg('<b>' + (pos0.side > 0 ? 'White' : 'Black') + ' to move.</b> ' + (p.k > 1 ? 'Find the winning line (' + p.k + ' moves).' : 'Find the best move.') + (solved ? '<div class="ok" style="margin-top:6px">✅ You already finished today\'s challenge. Come back tomorrow!</div>' : ''));
      host.querySelector('#dst').textContent = 'Daily streak: ' + (Ach().data().c.dailyStreak || 0) + ' days';
      board.onmove = async m => { if (busy || solved) return; const u = board.pos.uci(m); const ok = ply === 0 ? p.s.includes(u) : u === p.v[ply]; if (!ok) { board.shake(); board.sel = -1; board.targets = []; board.draw(); msg('❌ Not quite. Try again!'); return; } board.play(m); ply++; if (ply >= p.v.length) { solved = true; board.who = 0; msg('✅ <b>Solved!</b> Daily challenge complete.'); Fx().confetti(); ev('daily'); host.querySelector('#dst').textContent = 'Daily streak: ' + (Ach().data().c.dailyStreak || 0) + ' days'; return; } busy = true; board.who = 0; await new Promise(r => setTimeout(r, 600)); const rm = board.pos.fromUci(p.v[ply]); if (rm) board.play(rm); ply++; busy = false; board.who = pos0.side; msg('Good! Keep going...'); };
      cleanup = () => board.destroy();
    }
    list(); return () => { if (cleanup) cleanup(); };
  }

  /* ======================== TROPHIES ======================== */
  function trophies(host) {
    const A_ = Ach(), D = A_.data(), lv = A_.level(), un = D.u, cats = ['All', ...new Set(A_.DEFS.map(d => d.cat))]; let cat = 'All';
    const draw = () => {
      const have = A_.DEFS.filter(d => un[d.id]).length, pct = Math.round((D.xp - lv.from) / Math.max(1, lv.to - lv.from) * 100);
      host.innerHTML = '<div class="acmsg" style="margin-bottom:10px"><div class="row" style="gap:14px;align-items:center;flex-wrap:wrap"><div style="font-size:44px;animation:float 3s ease-in-out infinite">' + ['♙', '♞', '♝', '♜', '♛', '♚', '👑'][Math.min(6, Math.floor((lv.lv - 1) / 4))] + '</div><div style="flex:1;min-width:200px"><b style="font-size:18px">Level ' + lv.lv + ' · ' + lv.title + '</b><div class="small mute">' + D.xp + ' XP · ' + (lv.to - D.xp) + ' to the next level</div><div class="bar" style="margin-top:6px"><i style="width:' + pct + '%"></i></div></div><div style="text-align:center"><b style="font-size:24px">' + have + '/' + A_.DEFS.length + '</b><div class="small mute">trophies</div></div></div></div><div class="chips" id="tcats" style="margin-bottom:10px">' + cats.map(c => '<span class="chip" data-c="' + c + '" style="' + (c === cat ? 'background:var(--acc);color:var(--onacc);border-color:var(--acc)' : '') + '">' + c + '</span>').join('') + '</div><div class="acg">' + A_.DEFS.filter(d => cat === 'All' || d.cat === cat).sort((a, b) => (un[b.id] ? 1 : 0) - (un[a.id] ? 1 : 0)).map(d => { const got = !!un[d.id], pr = A_.progress(d, D.c); return '<div class="card trophy' + (got ? ' got' : '') + '" style="cursor:default;' + (got ? 'border-color:var(--ok)' : 'opacity:.8') + '"><div style="display:flex;gap:10px;align-items:center"><div style="font-size:30px;' + (got ? '' : 'filter:grayscale(1);opacity:.5') + '">' + (!got && d.secret ? '❔' : d.icon) + '</div><div style="flex:1;min-width:0"><b>' + esc(!got && d.secret ? 'Secret trophy' : d.name) + '</b><div class="small mute">' + esc(!got && d.secret ? 'Keep playing to find this one.' : d.desc) + '</div></div></div>' + (!got && pr ? '<div class="bar" style="margin-top:6px"><i style="width:' + Math.round(pr[0] / pr[1] * 100) + '%"></i></div><div class="small mute">' + pr[0] + ' / ' + pr[1] + '</div>' : got ? '<div class="small" style="margin-top:4px;color:var(--ok)">Unlocked · +' + d.xp + ' XP</div>' : '') + '</div>'; }).join('') + '</div>';
      host.querySelector('#tcats').onclick = e => { const c = e.target.closest('[data-c]'); if (c) { cat = c.dataset.c; draw(); } };
    };
    draw(); return () => { };
  }

  /* ======================== BOOKS ======================== */
  function books(host) {
    host.innerHTML = '<div class="acmsg"><b>📚 Chess books</b><div class="small" style="margin-top:6px">Free public-domain chess books are stored on this PC and live in the <b>Library</b> tab under <b>♟ Chess books</b>: Capablanca, Lasker, Staunton, Steinitz, Morphy and more, from beginner guides to opening manuals and tournament books.</div><div class="row" style="gap:6px;margin-top:10px;flex-wrap:wrap"><button class="pri" id="bkopen">Open the chess bookshelf</button></div><div class="small mute" id="bkn" style="margin-top:8px"></div></div>';
    host.querySelector('#bkopen').onclick = () => A.chessbooks.open(); A.chessbooks.count().then(n => { host.querySelector('#bkn').textContent = n ? n + ' books installed.' : 'No books found yet. Close and reopen Moundshroud after they finish downloading.'; });
    return () => { };
  }

  U().sections.minis = minis; U().sections.trophies = trophies; U().sections.books = books;
})();

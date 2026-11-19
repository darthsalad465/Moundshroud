// Chess hub: Analysis (load a game from a PGN file, paste, your own games or the famous ones; analyze it on several engine workers;
// browse moves, evaluation graph, engine lines, report) and the Coach tab. Loaded after chess-analysis.js and chess-coach.js.
(() => {
  const C = Chess;
  const tidy = s => String(s || '').replace(/[<>]/g, '');
  const evCp = (cp, side) => ChessAna.evalText(cp * (side || 1));

  window.ChessUI.sections.analysis = function (host, api, ctx) {
    const UI = window.ChessUI, AN = window.ChessAna, { Board, GL } = UI, CI = AN.CLASS_INFO;
    host.innerHTML = '<div class="acw" id="anw"><div id="anleft"><div class="row" style="gap:8px;align-items:stretch"><div id="aneb" style="width:22px;border-radius:8px;overflow:hidden;background:#1b1d24;position:relative;border:1px solid var(--line);height:calc(var(--csz,56px)*8)"><div id="anebw" style="position:absolute;left:0;right:0;background:#f1f1f1;height:50%;transition:height .25s"></div><span id="anebt" style="position:absolute;left:0;right:0;font:600 9px/1 Segoe UI;text-align:center;mix-blend-mode:difference;color:#fff"></span></div><div id="anbd"></div></div>' +
      '<div class="row" style="gap:6px;margin-top:8px;flex-wrap:wrap"><button class="ib" id="an0">⏮</button><button class="ib" id="anp">◀</button><button class="ib" id="ann">▶</button><button class="ib" id="an9">⏭</button><button class="ib" id="anflip">Flip</button><label class="chk small" title="Show the best moves the engine finds as arrows, with their evaluations"><input type="checkbox" id="anarr"> Engine arrows</label><label class="chk small" title="Show your move and the better move as arrows when a move was weak"><input type="checkbox" id="anbest" checked> Played vs best</label><button class="ib" id="anback" style="display:none">↩ Back to the game</button><button class="ib" id="ankeep" style="display:none" title="Turn the moves you just explored into a game of their own">💾 Keep this line</button></div><div id="angr" style="margin-top:8px;max-width:calc(var(--csz,56px)*8 + 30px)"></div><div id="anuser" style="margin-top:8px;max-width:calc(var(--csz,56px)*8 + 30px)"></div><div class="small mute" style="margin-top:4px">Tip: right-drag on the board to draw an arrow. The engine will tell you how good that move is and show the line.</div></div>' +
      '<div class="acside" id="anside" style="width:380px"><div class="acmsg" id="anhdr"></div><div class="row" id="antabs" style="gap:4px;flex-wrap:wrap"></div><div id="anbody"></div></div></div>';
    const q = id => host.querySelector('#' + id), board = new Board(q('anbd'));
    let game = null, fens = [], sans = [], rows = null, summary = null, N = 0, idx = 0, explore = null, flipped = false, me = 0, tab = 'games', dead = false;
    let handle = null, analyzing = false, prog = { done: 0, n: 0, t: 0 }, engPool = null, engSeq = 0, engRes = null, engFen = '', engT = null, fileGames = [], coach = null, coachHost = null, mode = ls.get('anmode', 'standard');
    const getEng = () => engPool || (engPool = AN.Pool(1));
    let RV = null; const rv = () => RV || (RV = ChessReview.make({ AN, CI, board, q, getEng, curFen: () => (game ? curFen() : ''), state: () => ({ game, fens, sans, rows, summary, idx, explore, N }), jump: i => jump(i), tab: () => tab, engineWant: () => engineWant(), playMoves: ms => { if (!game) return; if (!explore) explore = { base: idx, moves: [] }; explore.moves.push(...ms); refresh(); }, exploreFrom: (i, ms) => { if (!game) return; idx = i; explore = { base: i, moves: ms.slice() }; refresh(); } }));
    const gameLabel = g => (g.white || 'White') + ' vs ' + (g.black || 'Black');

    /* ---------- positions ---------- */
    function build(g) { const pos = new C.Pos().setFen(g.startFen || C.START), f = [pos.fen()], s = [], used = []; for (const u of g.moves) { const m = pos.fromUci(u); if (!m) break; s.push(pos.san(m)); used.push(u); pos.make(m); f.push(pos.fen()); } return { f, s, used }; }
    const curFen = () => { if (!explore) return fens[idx]; const p = new C.Pos().setFen(fens[explore.base]); for (const u of explore.moves) { const m = p.fromUci(u); if (!m) break; p.make(m); } return p.fen(); };
    const curSans = () => { if (!explore) return sans.slice(0, idx); const p = new C.Pos().setFen(fens[explore.base]), out = sans.slice(0, explore.base); for (const u of explore.moves) { const m = p.fromUci(u); if (!m) break; out.push(p.san(m)); p.make(m); } return out; };
    const lastMove = () => { if (explore) { if (!explore.moves.length) return null; const u = explore.moves[explore.moves.length - 1]; return [C.sqIndex(u.slice(0, 2)), C.sqIndex(u.slice(2, 4))]; } if (!idx) return null; const u = game.moves[idx - 1]; return [C.sqIndex(u.slice(0, 2)), C.sqIndex(u.slice(2, 4))]; };

    function openGame(g, o) {
      o = o || {}; if (handle) { handle.cancel && handle.cancel(); handle = null; analyzing = false; } const b = build(g); g.moves = b.used; game = g; fens = b.f; sans = b.s; N = b.used.length; explore = null; engRes = null; engFen = '';
      rows = g.ana && g.ana.rows && g.ana.rows.length === N ? g.ana.rows : null; summary = rows ? g.ana.summary : null; me = g.human != null ? g.human : g.me || 0; flipped = me < 0; idx = o.idx != null ? o.idx : 0;
      tab = 'moves'; renderAll(); if (o.auto && !rows && N > 1) runAnalysis(mode);
    }
    const ensureSaved = () => { if (game && !game.id) { const s = AN.GS.add(Object.assign({}, game)); game.id = s.id; } return game && game.id; };

    /* ---------- a board you play on yourself ---------- */
    function newBoard(fen, silent) { openGame({ white: 'White', black: 'Black', result: '*', event: 'Analysis board', moves: [], startFen: fen || null, src: 'board', free: true }, { auto: false }); if (silent) { tab = 'games'; renderBody(); } else { tab = 'moves'; renderBody(); } }
    function branchToGame() { if (!explore) return; const g = { white: (game.white || 'White'), black: (game.black || 'Black'), result: '*', event: 'Analysis line', startFen: game.startFen || null, moves: game.moves.slice(0, explore.base).concat(explore.moves), src: 'board', free: true }; const s = AN.GS.add(g); openGame(s, { auto: false, idx: g.moves.length }); A.toast('Saved as a new game in My games.'); }
    function openEditor() {
      const UIg = window.ChessUI.GL, start = explore || game ? curFen() : C.START; const pos0 = new C.Pos().setFen(start || C.START), bd = Array(64).fill(''); for (let i = 0; i < 64; i++) { const p = pos0.b[i]; if (p) { const ch = 'pnbrqk'[Math.abs(p) - 1]; bd[i] = p > 0 ? ch.toUpperCase() : ch; } }
      let tool = 'P', side = 'w', cas = { K: true, Q: true, k: true, q: true }; const GLY = { p: 1, n: 2, b: 3, r: 4, q: 5, k: 6 };
      const fenOf = () => { let s = ''; for (let r = 0; r < 8; r++) { let e = 0; for (let c = 0; c < 8; c++) { const x = bd[r * 8 + c]; if (!x) e++; else { if (e) { s += e; e = 0; } s += x; } } if (e) s += e; if (r < 7) s += '/'; } const ok = { K: bd[60] === 'K' && bd[63] === 'R' && cas.K, Q: bd[60] === 'K' && bd[56] === 'R' && cas.Q, k: bd[4] === 'k' && bd[7] === 'r' && cas.k, q: bd[4] === 'k' && bd[0] === 'r' && cas.q }; const cs = ['K', 'Q', 'k', 'q'].filter(k => ok[k]).join('') || '-'; return s + ' ' + side + ' ' + cs + ' - 0 1'; };
      const draw = () => { const g = q2('edg'); g.innerHTML = bd.map((x, i) => { const r = i >> 3, c = i & 7; return '<div data-i="' + i + '" style="width:42px;height:42px;display:flex;align-items:center;justify-content:center;font-size:30px;cursor:pointer;background:' + ((r + c) & 1 ? 'var(--sqD)' : 'var(--sqL)') + '">' + (x ? '<span style="color:' + (x === x.toUpperCase() ? '#fff' : '#14161c') + ';-webkit-text-stroke:' + (x === x.toUpperCase() ? '.8px #1a1a1a' : '0') + '">' + UIg[GLY[x.toLowerCase()]] + '</span>' : '') + '</div>'; }).join(''); q2('edf').value = fenOf(); q2('edp').querySelectorAll('[data-t]').forEach(b => { b.style.outline = b.dataset.t === tool ? '2px solid var(--acc)' : 'none'; }); };
      const q2 = id => document.getElementById(id);
      A.dlg('<div class="hd"><b>Set up a position</b><span class="sp"></span><span class="ib" id="edx" style="cursor:pointer;float:right">&times;</span></div><div class="bd"><div class="small mute" style="margin-bottom:6px">Pick a piece below, then click squares to place it. Pick the eraser to remove pieces.</div><div style="display:grid;grid-template-columns:repeat(8,42px);width:336px;border:2px solid var(--line);border-radius:8px;overflow:hidden" id="edg"></div><div class="row" id="edp" style="gap:4px;margin:8px 0;flex-wrap:wrap">' + ['K', 'Q', 'R', 'B', 'N', 'P', 'k', 'q', 'r', 'b', 'n', 'p'].map(x => '<button class="ib" data-t="' + x + '" style="font-size:22px;padding:2px 8px;color:' + (x === x.toUpperCase() ? '#fff' : '#14161c') + ';background:var(--sqD)">' + UIg[GLY[x.toLowerCase()]] + '</button>').join('') + '<button class="ib" data-t="x" title="Eraser">⌫</button></div><div class="row" style="gap:10px;flex-wrap:wrap"><label class="small">Side to move <select id="eds"><option value="w">White</option><option value="b">Black</option></select></label>' + ['K', 'Q', 'k', 'q'].map(k => '<label class="chk small"><input type="checkbox" data-c="' + k + '" checked> ' + ({ K: 'White O-O', Q: 'White O-O-O', k: 'Black O-O', q: 'Black O-O-O' })[k] + '</label>').join('') + '</div><input id="edf" type="text" readonly style="margin-top:8px;font-family:monospace"><div class="row" style="gap:6px;margin-top:8px;flex-wrap:wrap"><button class="ib" id="edc">Clear board</button><button class="ib" id="edst">Start position</button><span class="sp"></span><button class="ib" id="edcn">Cancel</button><button class="pri" id="edok">Use this position</button></div><div class="small" id="edm" style="margin-top:6px;min-height:18px"></div></div>', true);
      q2('edx').onclick = q2('edcn').onclick = A.closeDlg; q2('edp').onclick = e => { const b = e.target.closest('[data-t]'); if (b) { tool = b.dataset.t; draw(); } };
      q2('edg').onclick = e => { const c = e.target.closest('[data-i]'); if (!c) return; const i = +c.dataset.i; bd[i] = tool === 'x' ? '' : (bd[i] === tool ? '' : tool); draw(); };
      q2('eds').onchange = () => { side = q2('eds').value; draw(); }; document.querySelectorAll('#dlg [data-c]').forEach(c => { c.onchange = () => { cas[c.dataset.c] = c.checked; draw(); }; });
      q2('edc').onclick = () => { bd.fill(''); draw(); }; q2('edst').onclick = () => { const p = new C.Pos().setFen(C.START); for (let i = 0; i < 64; i++) { const v = p.b[i]; bd[i] = v ? (v > 0 ? 'PNBRQK'[v - 1] : 'pnbrqk'[-v - 1]) : ''; } side = 'w'; q2('eds').value = 'w'; draw(); };
      q2('edok').onclick = () => { const kw = bd.filter(x => x === 'K').length, kb = bd.filter(x => x === 'k').length; const m = q2('edm'); if (kw !== 1 || kb !== 1) { m.innerHTML = '<span class="bad">There must be exactly one white king and one black king.</span>'; return; } if (bd.some((x, i) => (x === 'P' || x === 'p') && (i < 8 || i > 55))) { m.innerHTML = '<span class="bad">Pawns cannot stand on the first or last rank.</span>'; return; } const fen = fenOf(), p = new C.Pos().setFen(fen); if (p.attacked(p.ksq[p.side > 0 ? 1 : 0], p.side)) { m.innerHTML = '<span class="bad">The side that is not to move is in check, which is not a legal position.</span>'; return; } A.closeDlg(); try { ChessAch.event('setup'); } catch (e) { } newBoard(fen === 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1' ? null : fen); };
      draw();
    }

    /* ---------- analysis run ---------- */
    async function runAnalysis(m) {
      if (!game || analyzing || N < 1) return; mode = m || mode; ls.set('anmode', mode); ensureSaved(); analyzing = true; rows = new Array(N).fill(null); summary = null; handle = {}; prog = { done: 0, n: N, t: 0 }; renderBody(); drawGraph();
      const mine = game; let raf = 0;
      const res = await AN.analyzeGame(game, { mode, handle, onRow: (i, r, done, n, t) => { if (game !== mine || dead) return; rows[i] = r; prog = { done, n, t }; if (!raf) raf = requestAnimationFrame(() => { raf = 0; if (dead) return; updateProgress(); drawGraph(); if (tab === 'moves') paintMoves(); eBar(); }); } });
      if (dead || game !== mine) return; analyzing = false; handle = null;
      if (!res) { rows = null; renderBody(); drawGraph(); return; }
      rows = res.rows; summary = res.summary; mine.ana = { rows, summary, mode: res.mode, at: res.at }; if (mine.id) AN.GS.patch(mine.id, { ana: mine.ana }); A.toast('Analysis complete.'); try { const acc = me > 0 ? summary.w.acc : me < 0 ? summary.b.acc : Math.max(summary.w.acc, summary.b.acc); ChessAch.event('analysis', { acc, counts: (me < 0 ? summary.b : summary.w).c, n: (me < 0 ? summary.b : summary.w).n }); } catch (e) { } tab = 'report'; renderBody(); renderHeader(); drawGraph(); eBar(); if (coach) coach.refreshChips();
    }
    function updateProgress() { const p = q('anpg'); if (!p) return; p.style.width = Math.round(prog.done / Math.max(1, prog.n) * 100) + '%'; const t = q('anpt'); if (t) { const eta = prog.done ? Math.round(prog.t / prog.done * (prog.n - prog.done)) : null; t.textContent = 'Analyzing move ' + prog.done + ' of ' + prog.n + (eta != null ? ' · about ' + eta + ' s left' : ''); } }

    /* ---------- header, eval bar, graph ---------- */
    function renderHeader() {
      const h = q('anhdr'); if (!game) { h.innerHTML = '<b>Analysis</b><div class="small mute">Load a game below: upload a PGN file, paste moves, or pick one of your games or a famous game.</div>'; return; }
      const op = AN.opening(sans.slice(0, N)), t = game.tags || {}, acc = summary ? '<span class="chip" style="cursor:default">White ' + summary.w.acc + '%</span><span class="chip" style="cursor:default">Black ' + summary.b.acc + '%</span>' : '';
      h.innerHTML = '<div class="row" style="justify-content:space-between;gap:6px"><b>' + esc(tidy(gameLabel(game))) + '</b><span class="small mute">' + esc(game.result || '*') + '</span></div><div class="small mute">' + esc(tidy([game.event || t.Event, t.Site, (game.date || t.Date || '').slice(0, 10)].filter(x => x && x !== '?').join(' · '))) + (op ? ' · <b style="color:var(--text)">' + esc(op.name) + '</b>' : '') + '</div>' +
        '<div class="row" style="gap:6px;margin-top:6px;flex-wrap:wrap"><label class="small mute">I played <select id="anme"><option value="0">not set</option><option value="1">White</option><option value="-1">Black</option></select></label>' + acc + '</div>';
      q('anme').value = String(me); q('anme').onchange = () => { me = +q('anme').value; game.me = me; if (game.id) AN.GS.patch(game.id, { me }); if (me) { flipped = me < 0; refresh(); } };
    }
    const evalNow = () => { if (explore || idx === 0 && !rows) { return engRes && engFen === curFen() && engRes.lines && engRes.lines[0] ? engRes.lines[0][1] * (curFen().split(' ')[1] === 'w' ? 1 : -1) : (idx === 0 && !explore ? 0 : null); } if (rows && rows[idx - 1] && !rows[idx - 1].unk) return rows[idx - 1].e; if (idx === 0) return 0; return engRes && engFen === curFen() && engRes.lines && engRes.lines[0] ? engRes.lines[0][1] * (curFen().split(' ')[1] === 'w' ? 1 : -1) : null; };
    function eBar() {
      const e = evalNow(), w = q('anebw'), t = q('anebt'); if (!w) return; const pct = e == null ? 50 : AN.wp(e), bottom = !flipped;
      w.style.height = pct + '%'; w.style[bottom ? 'bottom' : 'top'] = '0'; w.style[bottom ? 'top' : 'bottom'] = 'auto';
      t.textContent = e == null ? '' : AN.evalText(e); const atBottom = (pct >= 50) === bottom; t.style.top = atBottom ? 'auto' : '2px'; t.style.bottom = atBottom ? '2px' : 'auto';
    }
    /* the engine's preferred move, as SAN, for move i of the game (cached) */
    const bestMemo = {}; const bestSan = i => { const r = rows && rows[i]; if (!r || !r.b) return ''; const k = i + r.b; if (bestMemo[k] !== undefined) return bestMemo[k]; const p = new C.Pos().setFen(fens[i]), m = p.fromUci(r.b); return (bestMemo[k] = m ? p.san(m) : ''); };
    function drawGraph() {
      const g = q('angr'); if (!g) return; if (!game || N < 2) { g.innerHTML = ''; return; } const W = 480, H = 64, pts = []; pts.push(0);
      for (let i = 0; i < N; i++) pts.push(rows && rows[i] ? rows[i].e : null);
      const X = i => (i / N * W).toFixed(1), Y = e => (H / 2 - clampN(e, -600, 600) / 600 * (H / 2 - 3)).toFixed(1); let d = '', last = null, dots = '';
      pts.forEach((e, i) => { if (e == null) return; d += (last == null ? 'M' : 'L') + X(i) + ',' + Y(e); last = e; if (i > 0 && rows[i - 1] && ['mistake', 'blunder'].includes(rows[i - 1].c)) dots += '<circle cx="' + X(i) + '" cy="' + Y(e) + '" r="3" fill="' + (rows[i - 1].c === 'blunder' ? 'var(--bad)' : '#ff9f43') + '"/>'; });
      const area = d ? d + 'L' + X(pts.reduce((a, e, i) => e != null ? i : a, 0)) + ',' + H / 2 + 'L0,' + H / 2 + 'Z' : '';
      g.innerHTML = '<svg id="angsvg" viewBox="0 0 ' + W + ' ' + H + '" style="width:100%;background:var(--panel);border:1px solid var(--line);border-radius:10px;cursor:pointer"><line x1="0" x2="' + W + '" y1="' + H / 2 + '" y2="' + H / 2 + '" stroke="var(--line)"/>' + (area ? '<path d="' + area + '" fill="var(--acc2)" opacity=".22"/>' : '') + (d ? '<path d="' + d + '" fill="none" stroke="var(--acc2)" stroke-width="1.6"/>' : '') + dots + '<line x1="' + X(idx) + '" x2="' + X(idx) + '" y1="0" y2="' + H + '" stroke="var(--acc)" stroke-width="1.5"/></svg><div class="small mute" style="text-align:center">Evaluation graph (up = better for White). Click to jump.</div>';
      q('angsvg').onclick = e => { const r = e.currentTarget.getBoundingClientRect(); jump(Math.round((e.clientX - r.left) / r.width * N)); };
    }
    const clampN = (v, a, b) => Math.max(a, Math.min(b, v));

    /* ---------- board ---------- */
    function refresh() {
      if (!game) { board.set(C.START, { who: 0, flipped }); renderHeader(); return; }
      const fen = curFen(); board.set(fen, { who: 2, flipped, last: lastMove() });
      q('anback').style.display = explore ? '' : 'none'; q('ankeep').style.display = explore ? '' : 'none'; q('an0').disabled = q('anp').disabled = !explore && idx === 0; q('ann').disabled = q('an9').disabled = !explore && idx >= N;
      if (!explore && rows && rows[idx - 1] && rows[idx - 1].b && ['mistake', 'blunder', 'inaccuracy'].includes(rows[idx - 1].c)) { /* show where the better move started */ }
      eBar(); drawGraph(); if (tab === 'moves') paintMoves(); if (tab === 'engine') engineWant(); if (coach) coach.refreshChips(); api.hud(game ? gameLabel(game) : ''); try { rv().onRefresh(); } catch (e) { console.warn(e); }
    }
    function jump(i) { if (!game) return; idx = clampN(i, 0, N); explore = null; refresh(); }
    board.onmove = m => {
      if (!game) return; const u = board.pos.uci(m); try { ChessAch.event('explore'); } catch (e) { }
      if (!explore && idx < N && game.moves[idx] === u) { idx++; refresh(); return; }
      if (game.free && !explore) { if (idx < N) game.moves = game.moves.slice(0, idx); game.moves.push(u); const b = build(game); fens = b.f; sans = b.s; N = b.used.length; idx = N; rows = null; summary = null; game.ana = null; if (game.id) AN.GS.patch(game.id, { moves: game.moves, ana: null }); renderHeader(); refresh(); return; }
      if (!explore) explore = { base: idx, moves: [] }; explore.moves.push(u); refresh();
    };
    q('an0').onclick = () => jump(0); q('anp').onclick = () => { if (explore) { explore.moves.pop(); if (!explore.moves.length) explore = null; refresh(); } else jump(idx - 1); };
    q('ann').onclick = () => jump(idx + 1); q('an9').onclick = () => jump(N); q('anflip').onclick = () => { flipped = !flipped; refresh(); }; q('anback').onclick = () => { explore = null; refresh(); }; q('ankeep').onclick = () => branchToGame();
    const key = e => { if (dead || A.cur !== 'play' || /INPUT|TEXTAREA|SELECT/.test((e.target || {}).tagName || '') || !game) return; if (e.key === 'ArrowLeft') { e.preventDefault(); q('anp').click(); } else if (e.key === 'ArrowRight') { e.preventDefault(); q('ann').click(); } else if (e.key === 'Home') { e.preventDefault(); jump(0); } else if (e.key === 'End') { e.preventDefault(); jump(N); } };
    document.addEventListener('keydown', key);

    /* ---------- engine lines for the current position ---------- */
    function engineWant() { clearTimeout(engT); const fen = curFen(), seq = ++engSeq; engT = setTimeout(async () => { if (dead) return; const box = q('eng'); if (box) box.innerHTML = '<div class="mute small">Thinking...</div>'; const r = await AN.lines(getEng(), fen, 5, 2500, 3); if (dead || seq !== engSeq) return; engRes = r; engFen = fen; paintEngine(); eBar(); if (coach) coach.refreshChips(); }, 250); }
    function linesNow() { if (!engRes || engFen !== curFen() || !engRes.lines) return []; const pos = new C.Pos().setFen(engFen), side = pos.side > 0 ? 1 : -1; return engRes.lines.map(([u, s]) => { const m = pos.fromUci(u); return m ? { uci: u, san: pos.san(m), cp: s * side, ev: evCp(s, side) } : null; }).filter(Boolean); }
    function paintEngine() { const box = q('eng'); const L = linesNow(); if (box) rv().paintLines(box, L, engRes, engFen); else rv().onEngine(L); }

    /* ---------- panels ---------- */
    const TABS = [['games', '📂 Games'], ['review', '🔎 Review'], ['moves', '📜 Moves'], ['report', '📊 Report'], ['engine', '⚙ Engine'], ['coach', '🧑‍🏫 Coach']];
    function renderTabs() { q('antabs').innerHTML = TABS.map(t => '<button class="ib' + (tab === t[0] ? ' on' : '') + '" data-t="' + t[0] + '">' + t[1] + '</button>').join(''); }
    q('antabs').onclick = e => { const b = e.target.closest('[data-t]'); if (b) { tab = b.dataset.t; renderBody(); } };
    function renderAll() { renderHeader(); refresh(); renderBody(); }
    function renderBody() {
      renderTabs(); const body = q('anbody'); if (coachHost) coachHost.style.display = 'none'; body.querySelectorAll(':scope > :not(#cch)').forEach(n => n.remove());
      const mk = html => { const d = document.createElement('div'); d.innerHTML = html; body.insertBefore(d, coachHost || null); return d; };
      if (tab === 'games') { gamesPanel(mk('')); } else if (tab === 'review') { rv().panel(mk('')); } else if (tab === 'moves') { movesPanel(mk('')); } else if (tab === 'report') { reportPanel(mk('')); } else if (tab === 'engine') { mk('<div class="acmsg"><b>Engine lines</b><div id="eng" style="margin-top:6px"></div></div>'); engineWant(); } else if (tab === 'coach') { coachPanel(); }
    }
    function runBar() {
      if (!game || N < 1) return ''; if (analyzing) return '<div class="acmsg"><div class="small" id="anpt">Starting...</div><div class="bar" style="margin:6px 0"><i id="anpg" style="width:0%"></i></div><button class="ib" id="ancancel">Cancel</button></div>';
      return '<div class="acmsg"><div class="row" style="gap:6px;flex-wrap:wrap"><select id="anmode">' + Object.entries(AN.MODES).map(([k, v]) => '<option value="' + k + '"' + (k === mode ? ' selected' : '') + '>' + v.label + (k === 'quick' ? ' (seconds)' : k === 'deep' ? ' (slow, most accurate)' : '') + '</option>').join('') + '</select><button class="pri" id="anrun">' + (rows ? 'Re-analyze' : '🔬 Analyze game') + '</button></div><div class="small mute" style="margin-top:4px">' + (rows ? 'This game has been analyzed.' : 'Every move is checked by the engine so mistakes can be found.') + ' Uses ' + AN.cores() + ' engine thread' + (AN.cores() > 1 ? 's' : '') + '.</div></div>';
    }
    function bindRun(root) { const r = root.querySelector('#anrun'); if (r) r.onclick = () => { mode = root.querySelector('#anmode').value; runAnalysis(mode); }; const c = root.querySelector('#ancancel'); if (c) c.onclick = () => { if (handle && handle.cancel) handle.cancel(); analyzing = false; handle = null; rows = game && game.ana && game.ana.rows && game.ana.rows.length === N ? game.ana.rows : null; summary = rows ? game.ana.summary : null; renderBody(); drawGraph(); eBar(); }; }

    /* games panel: load, upload, paste, my games, famous */
    function gamesPanel(d) {
      const mine = AN.GS.list(), fam = (window.CHESS_GAMES || []);
      d.innerHTML = '<div class="acmsg"><b>Analysis board</b><div class="small mute" style="margin-top:2px">Play moves for both sides yourself, with the engine watching.</div><div class="row" style="gap:6px;margin-top:8px;flex-wrap:wrap"><button class="pri" id="annew">♟ New board</button><button class="ib" id="anset">🧱 Set up a position</button></div></div><div class="acmsg"><b>Load a game</b><div class="row" style="gap:6px;margin-top:8px;flex-wrap:wrap"><button class="pri" id="anup">📤 Upload PGN file</button><button class="ib" id="anpaste">📋 Paste moves or PGN</button></div><div class="small mute" style="margin-top:6px">You can also drag a .pgn file onto this page. PGN files with many games are fine.</div><div id="anpastebox" style="display:none;margin-top:8px"><textarea id="anpta" rows="6" placeholder="Paste a PGN, a list of moves like 1. e4 e5 2. Nf3 ..., or a FEN position" style="width:100%;font-family:monospace"></textarea><div class="row" style="gap:6px;margin-top:6px"><button class="pri" id="anload">Load</button><span class="small" id="anperr"></span></div></div></div>' +
        (fileGames.length > 1 ? '<div class="acmsg"><b>Games in this file (' + fileGames.length + ')</b><div class="scroll" style="max-height:200px;margin-top:6px">' + fileGames.map((g, i) => '<div class="hit" data-fg="' + i + '" style="padding:5px 8px;cursor:pointer;border-radius:8px;display:flex;gap:8px"><span style="flex:1">' + esc(tidy(gameLabel(g))) + '</span><span class="small mute">' + esc(g.result || '*') + ' · ' + g.moves.length + ' plies</span></div>').join('') + '</div><button class="ib" id="ansaveall" style="margin-top:6px">Save all to My games</button></div>' : '') +
        '<div class="acmsg"><b>Famous games</b><div class="row" style="gap:6px;margin-top:6px"><select id="anfam" style="flex:1"><option value="">Choose a game...</option>' + fam.map((g, i) => '<option value="' + i + '">' + esc(g.name) + ' - ' + esc((g.who || '').split(',')[0]) + '</option>').join('') + '</select></div></div>' +
        '<div class="acmsg"><b>My games (' + mine.length + ')</b><div class="small mute">Games you played against Moundshroud and games you loaded are saved here with their analysis.</div><div class="scroll" id="anmine" style="max-height:240px;margin-top:6px">' + (mine.length ? mine.map(g => '<div class="hit" data-gid="' + g.id + '" style="padding:5px 8px;cursor:pointer;border-radius:8px;display:flex;gap:8px;align-items:center"><span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(tidy(gameLabel(g))) + '</span><span class="small mute">' + esc(g.result || '*') + (g.ana ? ' · ' + (g.human === -1 ? g.ana.summary.b.acc : g.human === 1 ? g.ana.summary.w.acc : Math.round((g.ana.summary.w.acc + g.ana.summary.b.acc) / 2)) + '%' : '') + '</span><span class="small mute">' + esc((g.date || '').slice(5, 10)) + '</span><span data-del="' + g.id + '" title="Delete" style="cursor:pointer;color:var(--bad)">&times;</span></div>').join('') : '<div class="small mute">Nothing yet. Play a game on the Play tab or load a PGN.</div>') + '</div></div>';
      d.querySelector('#annew').onclick = () => newBoard(null); d.querySelector('#anset').onclick = () => openEditor();
      d.querySelector('#anup').onclick = () => { const f = document.createElement('input'); f.type = 'file'; f.accept = '.pgn,.txt,text/plain'; f.multiple = false; f.onchange = () => f.files[0] && readFile(f.files[0]); f.click(); };
      d.querySelector('#anpaste').onclick = () => { const b = d.querySelector('#anpastebox'); b.style.display = b.style.display === 'none' ? '' : 'none'; d.querySelector('#anpta').focus(); };
      d.querySelector('#anload').onclick = () => loadText(d.querySelector('#anpta').value, d.querySelector('#anperr'));
      d.querySelector('#anfam').onchange = e => { const g = fam[+e.target.value]; if (!g) return; famousToGame(g); };
      d.onclick = async e => {
        const del = e.target.closest('[data-del]'); if (del) { e.stopPropagation(); if ((await A.confirm('Delete this saved game?'))) { AN.GS.remove(del.dataset.del); if (game && game.id === del.dataset.del) { game = null; } renderBody(); } return; }
        const gi = e.target.closest('[data-gid]'); if (gi) { const g = AN.GS.get(gi.dataset.gid); if (g) openGame(g, { auto: false }); return; }
        const fg = e.target.closest('[data-fg]'); if (fg) { openGame(Object.assign({}, fileGames[+fg.dataset.fg], { src: 'upload' }), { auto: false }); return; }
        if (e.target.id === 'ansaveall') { let n = 0; fileGames.forEach(g => { if (g.moves.length) { AN.GS.add(Object.assign({ src: 'upload', white: (g.tags || {}).White, black: (g.tags || {}).Black, event: (g.tags || {}).Event, date: ((g.tags || {}).Date || '').replace(/\./g, '-') }, g)); n++; } }); A.toast('Saved ' + n + ' games to My games.'); renderBody(); }
      };
    }
    function toGame(p, src) { const t = p.tags || {}; return { white: t.White || 'White', black: t.Black || 'Black', result: p.result || t.Result || '*', event: t.Event, date: (t.Date || '').replace(/\./g, '-'), tags: t, moves: p.moves, startFen: p.startFen || null, src }; }
    function loadText(text, errEl) {
      const r = AN.parsePGN(text); const gs = r.games.filter(g => g.moves.length || g.fenOnly);
      if (!gs.length) { const e = r.games[0] && r.games[0].error; if (errEl) errEl.innerHTML = '<span class="bad">' + esc(e || 'I could not find a game in that text.') + '</span>'; return false; }
      fileGames = gs.map(g => toGame(g, 'upload')); try { ChessAch.event('upload', { n: gs.length }); } catch (e) { } const first = fileGames[0]; if (gs[0].error) A.toast(gs[0].error + ' The game was loaded up to that point.', 5000);
      if (fileGames.length === 1) { const s = AN.GS.add(first); openGame(s, { auto: !first.fenOnly && s.moves.length > 1 && !s.ana }); } else { tab = 'games'; renderBody(); A.toast(fileGames.length + ' games found. Pick one from the list.'); }
      return true;
    }
    async function readFile(f) { if (f.size > 8 * 1024 * 1024) return A.toast('That file is too large (8 MB limit).'); const text = await f.text(); loadText(text, null); }
    function famousToGame(fg) { const who = (fg.who || '').split(','), names = who[0].split(/\s+vs\.?\s+/i), p = AN.replay(fg.m.split(' '), null), g = { white: names[0] || 'White', black: names[1] || 'Black', result: /#/.test(p.sans[p.sans.length - 1] || '') ? (p.moves.length % 2 ? '1-0' : '0-1') : (fg.c > 0 ? '1-0' : '0-1'), event: fg.name, date: (who[who.length - 1] || '').trim(), moves: p.moves, src: 'famous', famous: true }; const s = AN.GS.add(g); openGame(s, { auto: false }); }

    /* moves panel */
    function movesPanel(d) {
      d.innerHTML = runBar() + '<div class="acmsg" style="padding:6px"><div id="anmv" class="scroll" style="max-height:340px;font:13px/1.9 \'Cascadia Mono\',Consolas,monospace"></div><div class="small mute" id="anmvhint" style="margin-top:4px"></div></div>'; bindRun(d); paintMoves(); if (analyzing) updateProgress();
    }
    function paintMoves() {
      const el = q('anmv'); if (!el) return; if (!game) { el.innerHTML = '<span class="mute">No game loaded.</span>'; return; } let s = '';
      sans.forEach((x, i) => { if (i % 2 === 0) s += '<span class="mute" style="display:inline-block;width:2.4em">' + (i / 2 + 1) + '.</span>'; const r = rows && rows[i], c = r && !r.unk ? CI[r.c] : null, cur = !explore && idx === i + 1; s += '<span data-i="' + (i + 1) + '" title="' + (r && !r.unk ? esc(CI[r.c][1] + (r.b && !['best', 'book'].includes(r.c) && bestSan(i) ? ' - better: ' + bestSan(i) : '')) : '') + '" style="display:inline-block;min-width:6.2em;cursor:pointer;border-radius:5px;padding:0 4px;' + (cur ? 'background:var(--acc);color:var(--onacc)' : '') + '">' + esc(x) + (c && !['best', 'excellent', 'good'].includes(r.c) ? '<b style="color:' + (cur ? 'inherit' : c[2]) + ';margin-left:2px">' + c[0] + '</b>' : c ? '<span style="opacity:.5;margin-left:2px;font-size:10px">' + c[0] + '</span>' : '') + '</span>'; if (i % 2 === 1) s += '<br>'; });
      el.innerHTML = s || '<span class="mute">This position has no moves yet. Move pieces on the board to explore it.</span>'; el.onclick = e => { const m = e.target.closest('[data-i]'); if (m) jump(+m.dataset.i); };
      const c = el.querySelector('span[style*="var(--acc)"]'); if (c && c.scrollIntoView) c.scrollIntoView({ block: 'nearest' });
      const hint = q('anmvhint'); if (hint) { const r = rows && !explore && rows[idx - 1]; hint.innerHTML = r && !r.unk && r.b && !['best', 'book', 'excellent', 'good', 'brilliant', 'great'].includes(r.c) ? CI[r.c][0] + ' <b>' + CI[r.c][1] + '</b>: the engine preferred <b>' + esc(bestSan(idx - 1)) + '</b>.' + ' <a href="#" id="anshowbest" style="color:var(--acc2)">Show it</a>' : r && !r.unk ? CI[r.c][0] + ' ' + CI[r.c][1] : ''; const sb = q('anshowbest'); if (sb) sb.onclick = e => { e.preventDefault(); const u = rows[idx - 1].b; idx = idx - 1; explore = { base: idx, moves: [u] }; refresh(); }; }
    }

    /* report panel */
    function reportPanel(d) {
      if (!game) { d.innerHTML = '<div class="acmsg">Load a game first.</div>'; return; } if (!rows || !summary) { d.innerHTML = runBar() + '<div class="acmsg">Analyze the game to see accuracy, mistakes and key moments.</div>'; bindRun(d); if (analyzing) updateProgress(); return; }
      const S = summary, cnt = (s, k) => s.c[k] || 0, names = ['brilliant', 'great', 'book', 'best', 'excellent', 'good', 'inaccuracy', 'mistake', 'blunder'];
      const ring = (v, label) => '<div style="text-align:center"><div style="width:74px;height:74px;border-radius:50%;background:conic-gradient(var(--acc2) ' + Math.round(v * 3.6) + 'deg,var(--panel2) 0);display:flex;align-items:center;justify-content:center"><div style="width:58px;height:58px;border-radius:50%;background:var(--panel);display:flex;align-items:center;justify-content:center;font-weight:700">' + v + '%</div></div><div class="small mute">' + label + '</div></div>';
      d.innerHTML = runBar() + '<div class="acmsg"><div class="row" style="justify-content:space-around;margin-bottom:8px">' + ring(S.w.acc, esc(tidy(game.white || 'White')).slice(0, 14)) + ring(S.b.acc, esc(tidy(game.black || 'Black')).slice(0, 14)) + '</div>' +
        '<table style="width:100%;font-size:13px;border-collapse:collapse">' + names.map(k => '<tr><td>' + CI[k][0] + ' ' + CI[k][1] + '</td><td style="text-align:center;color:' + CI[k][2] + '">' + cnt(S.w, k) + '</td><td style="text-align:center;color:' + CI[k][2] + '">' + cnt(S.b, k) + '</td></tr>').join('') + '<tr class="mute"><td>Avg. centipawn loss</td><td style="text-align:center">' + S.w.acpl + '</td><td style="text-align:center">' + S.b.acpl + '</td></tr></table>' +
        '<div class="small mute" style="margin-top:8px">By phase (accuracy): opening ' + (S.phase.open == null ? '-' : S.phase.open + '%') + ' · middlegame ' + (S.phase.mid == null ? '-' : S.phase.mid + '%') + ' · endgame ' + (S.phase.end == null ? '-' : S.phase.end + '%') + '</div></div>' +
        '<div class="acmsg"><b>Key moments</b>' + (S.moments.length ? S.moments.map(i => { const r = rows[i], pos = new C.Pos().setFen(fens[i]); const bm = r.b ? pos.fromUci(r.b) : null; return '<div class="hit" data-km="' + i + '" style="padding:4px 6px;cursor:pointer;border-radius:8px"><b style="color:' + CI[r.c][2] + '">' + CI[r.c][0] + '</b> ' + (Math.floor(i / 2) + 1) + (i % 2 ? '...' : '.') + ' ' + esc(sans[i]) + (bm ? ' <span class="small mute">better: ' + esc(pos.san(bm)) + '</span>' : '') + '</div>'; }).join('') : '<div class="small mute">No big mistakes. Clean game!</div>') + '</div>' +
        '<div class="row" style="gap:6px;flex-wrap:wrap"><button class="ib" id="antrain">🎯 Turn my mistakes into puzzles</button><button class="ib" id="ancoachrep">🧑‍🏫 Ask the coach for a report</button><button class="ib" id="anpgn">Copy PGN</button></div><div class="small mute" id="antmsg"></div>';
      bindRun(d); d.onclick = e => { const k = e.target.closest('[data-km]'); if (k) { jump(+k.dataset.km); tab = 'moves'; renderBody(); } };
      d.querySelector('#antrain').onclick = () => trainMistakes(d.querySelector('#antmsg')); d.querySelector('#ancoachrep').onclick = () => { tab = 'coach'; renderBody(); coach.ask('Please write a coaching report for this game: a one-sentence verdict, my main strengths and weaknesses, explain the key moments simply, and give me three concrete things to practise.', { moments: momentsFacts(), summary: summary, fen: null, sans: sans, opening: (AN.opening(sans) || {}).name }); }; d.querySelector('#anpgn').onclick = () => A.copy(AN.toPGN(game));
      if (analyzing) updateProgress();
    }
    function momentsFacts() { return (summary ? summary.moments : []).map(i => { const r = rows[i], pos = new C.Pos().setFen(fens[i]), bm = r.b ? pos.fromUci(r.b) : null; return { n: (Math.floor(i / 2) + 1) + (i % 2 ? '...' : '.'), san: sans[i], c: r.c, best: bm ? pos.san(bm) : '' }; }); }
    function trainMistakes(msg) {
      if (!me) { msg.innerHTML = '<span class="warn">Tell me which side you played (the "I played" box at the top) so I know which mistakes are yours.</span>'; return; } let n = 0;
      rows.forEach((r, i) => { const side = i % 2 === 0 ? 1 : -1; if (side !== me || !r || r.unk || !r.b || r.dw < 10) return; UI.PZ.addMine({ f: fens[i], s: [r.b], v: [r.b], k: 1, l: r.dw >= 20 ? 'medium' : 'easy', t: 'From my game', g: ['My game'], x: '' }); n++; });
      if (n) { try { ChessAch.event('mistakes'); } catch (e) { } } msg.innerHTML = n ? 'Saved <b>' + n + '</b> puzzle' + (n > 1 ? 's' : '') + ' from your mistakes. <a href="#" id="antgo" style="color:var(--acc2)">Practise them now</a>' : 'No big mistakes of yours to turn into puzzles.'; const go = q('antgo'); if (go) go.onclick = e => { e.preventDefault(); const s = (() => { try { return JSON.parse(ls.get('pzset', '{}')); } catch (x) { return {}; } })(); s.source = 'mine'; s.themes = []; s.moves = 'any'; s.level = 'mixed'; ls.set('pzset', JSON.stringify(s)); ctx.show('puzzles'); };
    }

    /* coach panel */
    function coachCtx() {
      if (!game) return {}; const fen = curFen(), pos = new C.Pos().setFen(fen), L = linesNow(), r = !explore && idx > 0 && rows && rows[idx - 1] && !rows[idx - 1].unk ? rows[idx - 1] : null; let mv = null;
      if (r) { const bp = new C.Pos().setFen(fens[idx - 1]), bm = r.b ? bp.fromUci(r.b) : null; mv = { san: sans[idx - 1], side: (idx - 1) % 2 === 0 ? 1 : -1, c: CI[r.c][1], best: bm && r.b !== game.moves[idx - 1] ? bp.san(bm) : '', dw: r.dw }; }
      return { game, me, fen, sans: curSans(), lines: L.map(l => ({ san: l.san, ev: l.ev })), move: mv, summary, moments: summary ? momentsFacts() : null, opening: (AN.opening(sans) || {}).name };
    }
    const coachCtxLite = () => ({ hasMove: !explore && idx > 0 && rows && rows[idx - 1] && !rows[idx - 1].unk && !['best', 'book', 'excellent', 'good', 'brilliant', 'great'].includes(rows[idx - 1].c), hasSummary: !!summary });
    function coachPanel() {
      if (!coachHost) { coachHost = document.createElement('div'); coachHost.id = 'cch'; q('anbody').appendChild(coachHost); coach = window.ChessCoach.panel(coachHost, () => { if (!game) return {}; if (!engRes || engFen !== curFen()) return AN.lines(getEng(), curFen(), 4, 2000, 3).then(r => { engRes = r; engFen = curFen(); return coachCtx(); }); return coachCtx(); }, { chipsFn: () => { const c = coachCtxLite(), L = window.ChessCoach.QUICK; return !game ? ['Explain a chess idea', 'How do I improve?'] : c.hasMove ? L.move.concat(L.position.slice(0, 1)) : c.hasSummary && idx === 0 ? L.game : L.position.concat(c.hasSummary ? L.game.slice(0, 1) : []); } }); }
      coachHost.style.display = ''; if (!game) coachHost.insertAdjacentHTML('afterbegin', ''); coach.refreshChips();
    }

    /* drag & drop a PGN anywhere on the page */
    host.addEventListener('dragover', e => { e.preventDefault(); }); host.addEventListener('drop', e => { e.preventDefault(); const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]; if (f) readFile(f); });

    /* start: a game handed over by Play, otherwise the loader */
    renderAll(); const pend = UI.pending; UI.pending = null;
    if (pend && pend.id) { const g = AN.GS.get(pend.id); if (g) openGame(g, { auto: !g.ana && g.moves.length > 1 }); } else if (pend && pend.game) { openGame(pend.game, { auto: false }); } else { newBoard(null, true); }
    return () => { dead = true; document.removeEventListener('keydown', key); if (handle && handle.cancel) handle.cancel(); if (engPool) engPool.kill(); if (coach) coach.destroy(); board.destroy(); };
  };

  /* ---------------- Coach tab: general coaching and training plans from all your analyzed games ---------------- */
  window.ChessUI.sections.coach = function (host, api, ctx) {
    const UI = window.ChessUI, AN = window.ChessAna;
    host.innerHTML = '<div style="max-width:720px"><div class="acmsg"><b>🧑‍🏫 Chess coach</b><div class="small mute" id="chstat" style="margin-top:4px"></div></div><div id="chbox"></div><div class="small mute" style="margin-top:8px">The coach is the AI model running on this PC. It explains ideas and plans; when you ask about a specific game or position, open the <b>Analysis</b> tab so it can see the engine\'s verdict.</div></div>';
    const games = AN.GS.list().filter(g => g.ana && g.ana.summary); const mineSide = g => g.human === -1 ? 'b' : g.human === 1 ? 'w' : null;
    const rollup = () => { const t = { n: games.length, acc: 0, blunders: 0, mistakes: 0, open: [0, 0], mid: [0, 0], end: [0, 0], recent: [] }; games.slice(0, 10).forEach(g => { const s = g.ana.summary, side = mineSide(g) ? s[mineSide(g)] : { acc: (s.w.acc + s.b.acc) / 2, c: { blunder: (s.w.c.blunder || 0) + (s.b.c.blunder || 0), mistake: (s.w.c.mistake || 0) + (s.b.c.mistake || 0) } }; t.acc += side.acc; t.blunders += side.c.blunder || 0; t.mistakes += side.c.mistake || 0; for (const k of ['open', 'mid', 'end']) if (s.phase[k] != null) { t[k][0] += s.phase[k]; t[k][1]++; } t.recent.push((g.result || '*') + ' ' + Math.round(side.acc) + '%'); }); return t; };
    const R = rollup(); host.querySelector('#chstat').textContent = games.length ? games.length + ' analyzed game' + (games.length > 1 ? 's' : '') + ' · average accuracy ' + (R.acc / Math.min(10, games.length)).toFixed(1) + '% over your latest ' + Math.min(10, games.length) : 'No analyzed games yet. Play a game, press "Analyze this game", and the coach can build a plan from your results.';
    const TRAIN = ['Make me a training plan', 'What should I study first?', 'Explain the opposition in endgames', 'How do I stop blundering pieces?', 'Which opening should I learn?'];
    const panel = window.ChessCoach.panel(host.querySelector('#chbox'), () => ({ extra: games.length ? 'The user\'s recent analyzed games (up to 10): ' + R.recent.join('; ') + '. Average blunders per game: ' + (R.blunders / Math.min(10, games.length)).toFixed(1) + '; mistakes: ' + (R.mistakes / Math.min(10, games.length)).toFixed(1) + '. Average accuracy by phase (opening/middlegame/endgame): ' + ['open', 'mid', 'end'].map(k => R[k][1] ? Math.round(R[k][0] / R[k][1]) + '%' : 'n/a').join(' / ') + '.' : 'The user has no analyzed games yet.' }), { chipsFn: () => TRAIN });
    return () => panel.destroy();
  };
})();

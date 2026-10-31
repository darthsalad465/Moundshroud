// Chess hub extras in the spirit of chess.com: ⚡ Puzzle Rush (solve as many as you can before the clock or three strikes end it) and 🧭 Opening Explorer
// (walk any line on the board and see the book moves, famous-game moves and how YOUR games went from every position).
(() => {
  const C = window.Chess, UI = window.ChessUI; if (!C || !UI) return;
  const rd = (k, d) => { try { return JSON.parse(ls.get(k, JSON.stringify(d))); } catch (e) { return d; } };
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const rank = { easy: 0, medium: 1, hard: 2 };
  /* ---------------- ⚡ Puzzle Rush ---------------- */
  UI.sections.rush = (host) => {
    const MODES = [['3', '⚡ 3 minutes', 180], ['5', '⏱ 5 minutes', 300], ['s', '♾ Survival', 0]]; let board = null, timer = 0, dead = false, R = null;
    const best = () => rd('chrush', {});
    const pool = () => { const all = (window.CHESS_PUZZLES || []).concat(rd('chgen', []), rd('chmine', [])); const seen = new Set(), out = []; for (const p of all) { if (!p || !p.f || !p.s || seen.has(p.f)) continue; seen.add(p.f); out.push({ f: p.f, v: p.v && p.v.length ? p.v : [p.s[0]], s: p.s, l: p.l || 'medium' }); } return out; };
    const home = () => {
      clearInterval(timer); if (board) { try { board.destroy(); } catch (e) { } board = null; } const b = best();
      host.innerHTML = '<div style="max-width:760px"><div class="card" style="margin:0 0 10px"><b>⚡ Puzzle Rush</b><div class="small mute" style="margin:4px 0 10px">Solve as many puzzles as you can. They start easy and get harder. Three wrong moves (strikes) and it is over. Move the pieces on the board.</div><div class="row" style="gap:10px;flex-wrap:wrap">' + MODES.map(m => '<button class="card" data-m="' + m[0] + '" style="cursor:pointer;margin:0;width:200px;text-align:center"><div style="font-size:26px">' + m[1].split(' ')[0] + '</div><b>' + m[1].slice(2) + '</b><div class="small mute">Best: <b>' + (b[m[0]] || 0) + '</b></div></button>').join('') + '</div></div><div class="small mute">Puzzles come from the built-in bank plus the ones Moundshroud has generated for you (' + pool().length + ' available).</div></div>';
      host.onclick = e => { const m = e.target.closest('[data-m]'); if (m) start(m.dataset.m); };
    };
    const next = () => {
      if (dead || R.over) return; const tier = Math.min(2, Math.floor(R.score / 7)), cand = R.pool.filter(p => rank[p.l] === tier && !R.used.has(p.f)); const list = cand.length ? cand : R.pool.filter(p => !R.used.has(p.f)); if (!list.length) { R.used.clear(); return next(); }
      const p = list[Math.random() * list.length | 0]; R.used.add(p.f); R.cur = p; R.idx = 0; const side = p.f.split(' ')[1] === 'b' ? -1 : 1; board.set(p.f, { who: side, flipped: side < 0, anim: false }); R.busy = false; paint('Find the best move for ' + (side > 0 ? 'White' : 'Black') + '.');
    };
    const paint = msg => { const s = host.querySelector('#rst'); if (!s) return; const left = R.limit ? Math.max(0, R.limit - (Date.now() - R.t0) / 1000) : null; s.innerHTML = '<b style="font-size:20px">' + R.score + '</b> solved · ' + '❌'.repeat(R.strikes) + '▫️'.repeat(3 - R.strikes) + (left !== null ? ' · <b>' + Math.floor(left / 60) + ':' + String(Math.floor(left % 60)).padStart(2, '0') + '</b>' : '') + '<div class="small mute">' + (msg || '') + '</div>'; };
    const over = () => { if (R.over) return; R.over = true; clearInterval(timer); const b = best(), prev = b[R.mode] || 0; if (R.score > prev) { b[R.mode] = R.score; ls.set('chrush', JSON.stringify(b)); } try { ChessAch.event('rush', { score: R.score, mode: R.mode }); } catch (e) { } board.who = 0; host.querySelector('#rend').innerHTML = '<div class="acmsg" style="text-align:center"><div style="font-size:22px;font-weight:700">Final score: ' + R.score + '</div><div class="small mute">' + (R.score > prev ? '🏆 New best!' : 'Best: ' + prev) + '</div><div class="row" style="gap:6px;justify-content:center;margin-top:8px"><button class="pri" id="ragain">Play again</button><button class="ib" id="rhome">Modes</button></div></div>'; host.querySelector('#ragain').onclick = () => start(R.mode); host.querySelector('#rhome').onclick = home; };
    const wrong = () => { R.strikes++; R.busy = true; try { ChessSet.sound('illegal'); } catch (e) { } board.shake(); const p = R.cur, pos = new C.Pos().setFen(p.f), m = pos.fromUci(p.v[0]); paint('Not that one. Correct was ' + (m ? pos.san(m) : p.v[0]) + '.'); if (R.strikes >= 3) return over(); setTimeout(next, 1100); };
    const start = mode => {
      const M = MODES.find(m => m[0] === mode); R = { mode, limit: M[2], t0: Date.now(), score: 0, strikes: 0, over: false, busy: true, used: new Set(), pool: shuffle(pool()) };
      host.innerHTML = '<div class="acw" style="align-items:flex-start"><div id="rbd"></div><div class="acside" style="width:300px"><div class="acmsg" id="rst" style="min-height:60px"></div><div id="rend"></div><div class="row" style="gap:6px"><button class="ib dang" id="rquit">End run</button></div><div class="small mute" style="margin-top:8px">Easy puzzles first; they get harder every 7 solved.</div></div></div>';
      board = new UI.Board(host.querySelector('#rbd')); host.onclick = null; host.querySelector('#rquit').onclick = () => { if (!R.over) over(); };
      board.onmove = m => { if (R.over || R.busy || !R.cur) return; const p = R.cur, pos = board.pos, u = pos.uci(m), ok = u === p.v[R.idx] || (R.idx === 0 && p.s.includes(u)); if (!ok) { board.play(m); return wrong(); } board.play(m); R.idx++; if (R.idx >= p.v.length) { R.score++; R.busy = true; paint('Correct!'); try { ChessSet.sound('good'); } catch (e) { } return setTimeout(next, 350); } R.busy = true; setTimeout(() => { if (R.over || dead) return; const om = board.pos.fromUci(p.v[R.idx]); if (om) board.play(om); R.idx++; if (R.idx >= p.v.length) { R.score++; paint('Correct!'); setTimeout(next, 350); } else R.busy = false; }, 380); };
      timer = setInterval(() => { if (dead || R.over) return; paint(); if (R.limit && (Date.now() - R.t0) / 1000 >= R.limit) over(); }, 250); next();
    };
    UI.rushDebug = { state: () => R, board: () => board };
    home(); return () => { dead = true; clearInterval(timer); try { board && board.destroy(); } catch (e) { } };
  };

  /* ---------------- 🧭 Opening Explorer ---------------- */
  let INDEX = null;
  const buildIndex = () => {
    const idx = new Map(), add = (key, san, kind, res) => { let e = idx.get(key); if (!e) idx.set(key, e = new Map()); let r = e.get(san); if (!r) e.set(san, r = { book: 0, fam: 0, w: 0, d: 0, l: 0 }); if (kind === 'my') { if (res) r[res]++; } else r[kind]++; };
    const walkSan = (sans, kind) => { const p = new C.Pos().setFen(C.START); for (let i = 0; i < Math.min(sans.length, 26); i++) { const m = p.fromSan(sans[i]); if (!m) break; add(p.key(), p.san(m), kind); p.make(m); } };
    try { for (const [, l] of (ChessAna.LINES || [])) walkSan(l, 'book'); } catch (e) { }
    try { for (const g of (window.CHESS_GAMES || [])) walkSan(g.m.split(' ').filter(x => !/^\d+\.|^[01]-[01]$|^1\/2/.test(x)), 'fam'); } catch (e) { }
    try { for (const g of ChessAna.GS.list()) { if (!g.moves || g.startFen || !g.human) continue; const res = g.result === '1/2-1/2' ? 'd' : (g.result === '1-0') === (g.human > 0) ? 'w' : g.result === '*' ? null : 'l'; const p = new C.Pos().setFen(C.START); for (let i = 0; i < Math.min(g.moves.length, 26); i++) { const m = p.fromUci(g.moves[i]); if (!m) break; add(p.key(), p.san(m), 'my', res); p.make(m); } } } catch (e) { }
    return idx;
  };
  UI.sections.explorer = (host) => {
    let board = null, dead = false; INDEX = buildIndex(); const hist = []; const pos = () => board.pos;
    host.innerHTML = '<div class="acw" style="align-items:flex-start"><div><div id="xbd"></div></div><div class="acside" style="width:380px"><div class="acmsg" id="xname" style="font-weight:600;min-height:40px"></div><div class="row" style="gap:6px;margin-bottom:6px"><button class="ib" id="xback">◀ Back</button><button class="ib" id="xreset">⟲ Start</button><button class="ib" id="xflip">Flip</button></div><div id="xmoves"></div><div class="small mute" id="xline" style="margin-top:8px"></div></div></div>';
    board = new UI.Board(host.querySelector('#xbd')); const q = id => host.querySelector('#' + id);
    const sans = () => { const p = new C.Pos().setFen(C.START), out = []; for (const m of hist) { out.push(p.san(m)); p.make(m); } return out; };
    const paint = () => {
      const s = sans(), nm = ChessAna.opening ? ChessAna.opening(s) : null, p = pos(), e = INDEX.get(p.key());
      q('xname').innerHTML = (nm ? '📖 <b>' + esc(nm.name) + '</b>' : e ? '📖 Still in the book' : s.length ? 'Out of the book' : 'Starting position') + '<div class="small mute">' + (s.length ? s.map((x, i) => (i % 2 === 0 ? (i / 2 + 1) + '. ' : '') + x).join(' ') : 'Play a move or click one below') + '</div>';
      const rows = e ? [...e.entries()].map(([san, r]) => ({ san, r, n: r.book + r.fam + r.w + r.d + r.l })).sort((a, b) => b.n - a.n) : [];
      q('xmoves').innerHTML = rows.length ? '<table class="small" style="width:100%;border-collapse:collapse"><tr class="mute"><th style="text-align:left">Move</th><th>Book</th><th>Famous</th><th>Your games</th></tr>' + rows.map(x => { const my = x.r.w + x.r.d + x.r.l, tot = my || 1; return '<tr data-s="' + esc(x.san) + '" style="cursor:pointer;border-top:1px solid var(--line)"><td style="padding:4px 0"><b>' + esc(x.san) + '</b></td><td style="text-align:center">' + (x.r.book || '·') + '</td><td style="text-align:center">' + (x.r.fam || '·') + '</td><td>' + (my ? '<div style="display:flex;height:10px;border-radius:5px;overflow:hidden;min-width:90px"><span style="background:var(--ok);width:' + x.r.w / tot * 100 + '%"></span><span style="background:var(--mute);width:' + x.r.d / tot * 100 + '%"></span><span style="background:var(--bad);width:' + x.r.l / tot * 100 + '%"></span></div><span class="mute">' + my + ' game' + (my > 1 ? 's' : '') + ': ' + x.r.w + 'W ' + x.r.d + 'D ' + x.r.l + 'L</span>' : '<span class="mute">·</span>') + '</td></tr>'; }).join('') + '</table>' : '<div class="small mute">No book moves from here. The explorer knows ' + INDEX.size + ' positions from the opening book, famous games and your own games. Keep playing moves on the board.</div>';
      board.set(p.fen(), { who: 2, flipped: board.flipped, last: hist.length ? [hist[hist.length - 1] & 63, (hist[hist.length - 1] >> 6) & 63] : null, anim: false });
    };
    const push = m => { hist.push(m); const p = new C.Pos().setFen(C.START); for (const x of hist) p.make(x); board.pos = p; paint(); };
    board.onmove = m => push(m);
    q('xmoves').onclick = e => { const r = e.target.closest('[data-s]'); if (!r) return; const mv = pos().fromSan(r.dataset.s); if (mv) push(mv); };
    q('xback').onclick = () => { if (!hist.length) return; hist.pop(); const p = new C.Pos().setFen(C.START); for (const x of hist) p.make(x); board.pos = p; paint(); };
    q('xreset').onclick = () => { hist.length = 0; board.pos = new C.Pos().setFen(C.START); paint(); }; q('xflip').onclick = () => { board.flipped = !board.flipped; paint(); };
    board.pos = new C.Pos().setFen(C.START); paint();
    return () => { dead = true; try { board.destroy(); } catch (e) { } };
  };
})();

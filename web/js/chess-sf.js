// Stockfish client + 🧠 Engine Lab. ChessSF connects the chess modules to the local Stockfish (through the Moundshroud server): Maximum-strength play (and 2100+ levels), deep game analysis, top lines,
// and the studied opening book. The Engine Lab shows what the engine is studying in the background (opening book growth, your games, your costliest mistakes) and lets you browse
// what it learned, ask Stockfish about any position, and drill your own mistakes.
(() => {
  const C = window.Chess, UI = window.ChessUI; if (!C || !UI) return;
  const MATE = C.MATE || 100000, esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  let st = null, failUntil = 0;
  const post = (u, b) => fetch(u, { method: 'POST', body: JSON.stringify(b) }).then(r => r.json());
  const get = u => fetch(u).then(r => r.json());
  const refresh = async () => { try { const r = await get('/api/sf/status?low=' + (lowPower() ? 1 : 0)); st = r && 'available' in r ? r : null; } catch (e) { st = null; } paintSwitch(); return st; };
  const use = () => ls.get('sf_use', '1') !== '0';
  const lowPower = () => { try { return !!(typeof A !== 'undefined' && A.power && A.power.on); } catch (e) { return false; } };
  const std = fen => !fen || /^\S+ [wb] (-|[KQkq]+) /.test(String(fen));   // Chess960 (Shredder-FEN) positions stay with the built-in engine
  const sc = l => !l ? 0 : l.mate !== undefined ? (l.mate > 0 ? MATE - 2 * l.mate : -MATE - 2 * l.mate) : l.cp;
  const toMove = (fen, u) => { try { const p = new C.Pos().setFen(fen), m = p.fromUci(u); return m === undefined || m === null || m === false ? null : m; } catch (e) { return null; } };
  const SF = window.ChessSF = {
    status: () => st, refresh, use, lowPower, setUse(v) { ls.set('sf_use', v ? '1' : '0'); paintSwitch(); }, ready: () => !!(st && st.available && !st.suspended && use() && !lowPower() && Date.now() > failUntil),
    // everything goes to Stockfish unless the built-in engine is chosen (or low power); only the puzzle maker and rule-changing variants stay built-in
    wants: o => SF.ready() && std(o.fen) && (!o.cmd || o.cmd === 'ana' || o.cmd === 'multi' || o.cmd === 'pv' || o.cmd === 'eval'),
    async book(fen) { try { return (await get('/api/study/book?fen=' + encodeURIComponent(fen))).m || []; } catch (e) { return []; } },
    async run(o) {
      try {
        if (!o.cmd) {                                                // play a move
          const elo = o.elo || 3200, full = elo >= 3200;
          if (elo < 1320) {                                           // weaker than Stockfish can be limited: sample from its best moves
            const pos = new C.Pos().setFen(o.fen), n = Math.min(pos.legal().length, 20); if (n < 2) { const only = pos.legal()[0]; return { move: only, score: 0 }; }
            const r = await post('/api/sf/go', { fen: o.fen, ms: 300, multipv: n }); if (r.error || !r.lines || !r.lines.length) throw new Error(r.error || 'no move');
            const ls2 = r.lines.filter(l => l.pv && l.pv[0]), t = 1.5 + (1320 - elo) / 90, w = ls2.map((l, i) => Math.exp(-i / t)); let x = Math.random() * w.reduce((a, b) => a + b, 0), i = 0; while (i < w.length - 1 && (x -= w[i]) > 0) i++;
            const m = toMove(o.fen, ls2[i].pv[0]); if (m === null) throw new Error('bad move'); return { move: m, score: sc(ls2[i]) };
          } if (elo >= 1900) { const bk = await SF.book(o.fen); const top = bk.length ? Math.max(...bk.map(x => x[1])) : 0, good = bk.filter(x => x[2] >= 16 && top - x[1] <= (elo >= 2600 ? 12 : 25)); if (good.length && Math.random() < (elo >= 2400 ? .95 : .7)) { const w = good.map(x => Math.exp(-(top - x[1]) / 10)); let r = Math.random() * w.reduce((a, b) => a + b, 0), i = 0; while (i < w.length - 1 && (r -= w[i]) > 0) i++; const m = toMove(o.fen, good[i][0]); if (m !== null) return { move: m, score: good[i][1], book: true }; } }
          const styled = o.style && !full && elo < 3000, r = await post('/api/sf/go', { fen: o.fen, ms: Math.max(400, Math.min(o.ms || 1000, full ? 6000 : 2500)), elo: full ? null : elo, multipv: styled ? 4 : undefined }); if (r.error || !r.best) throw new Error(r.error || 'no move');
          if (styled && r.lines && r.lines.length > 1) {                // personality: among near-equal moves, lean the way this character likes to play
            const pos = new C.Pos().setFen(o.fen), tol = elo >= 2400 ? 25 : elo >= 1800 ? 45 : 80, top = sc(r.lines[0]), cand = r.lines.filter(l => l.pv && l.pv[0] && top - sc(l) <= tol).map(l => { const m = toMove(o.fen, l.pv[0]); let san = ''; try { san = pos.san(m); } catch (e) { } const cap = /x/.test(san), chk = /[+#]/.test(san), cas = /^O-O/.test(san), promo = /=/.test(san); const v = o.style === 'aggressive' ? (cap ? 2 : 0) + (chk ? 2 : 0) + (promo ? 2 : 0) : o.style === 'solid' ? (cas ? 3 : 0) + (!cap && !chk ? 1 : 0) - (cap ? .5 : 0) : 0; return { m, v, s: sc(l) }; }).filter(c => c.m !== null);
            if (cand.length > 1) { cand.sort((a, b) => b.v - a.v || b.s - a.s); return { move: cand[0].m, score: cand[0].s, styled: o.style }; }
          }
          const m = toMove(o.fen, r.best); if (m === null) throw new Error('bad move'); return { move: m, score: sc(r.lines[0]) };
        }
        if (o.cmd === 'eval') {                                      // score every legal move (used by hints, deals and the learning bots)
          const pos = new C.Pos().setFen(o.fen), legal = pos.legal(), n = Math.min(legal.length, 24); if (!legal.length) return { best: null, score: 0, list: [], scores: [] };
          const r = await post('/api/sf/go', { fen: o.fen, ms: Math.min(Math.max(o.ms || 800, 500), 2500), multipv: n }); if (r.error || !r.lines || !r.lines.length) throw new Error(r.error || 'no eval');
          const out = []; r.lines.forEach(l => { if (!l.pv || !l.pv[0]) return; const m = toMove(o.fen, l.pv[0]); if (m !== null && !out.some(x => x[0] === m)) out.push([m, sc(l)]); }); if (!out.length) throw new Error('no eval');
          const low = Math.min(...out.map(x => x[1])) - 80; legal.forEach(m => { if (!out.some(x => x[0] === m)) out.push([m, low]); }); out.sort((a, b) => b[1] - a[1]);
          return { best: out[0][0], score: out[0][1], list: out.slice(0, 4), scores: out, depth: r.depth };
        }
        if (o.cmd === 'ana') { const r = await post('/api/sf/ana', { fen: o.fen, played: o.played || null, ms: Math.min(Math.max(o.ms || 700, 300), 2500) }); if (r.error) throw new Error(r.error); return { best: r.best, bs: r.bs, played: r.played, depth: r.depth }; }
        if (o.cmd === 'multi') { const r = await post('/api/sf/go', { fen: o.fen, ms: Math.min(o.ms || 1500, 3000), multipv: o.n || 3 }); if (r.error) throw new Error(r.error); return { depth: r.depth, lines: r.lines.filter(l => l.pv && l.pv[0]).map(l => [l.pv[0], sc(l)]) }; }
        if (o.cmd === 'pv') { const r = await post('/api/sf/go', { fen: o.fen, ms: Math.min(Math.max(o.ms || 700, 500), 1500) }); if (r.error) throw new Error(r.error); return { pv: (r.lines[0] && r.lines[0].pv || []).slice(0, o.len || 6) }; }
      } catch (e) { failUntil = Date.now() + 20000; throw e; }
      throw new Error('unsupported');
    },
    async syncGames() { try { if (!st || !st.available || !window.ChessAna) return; let sent; try { sent = JSON.parse(ls.get('sf_synced', '[]')); } catch (e) { sent = []; } const fresh = ChessAna.GS.list().filter(g => g.id && g.moves && g.moves.length >= 6 && !sent.includes(g.id) && !g.startFen).slice(0, 30); if (!fresh.length) return; await post('/api/study/games', { games: fresh.map(g => ({ id: g.id, moves: g.moves, human: g.human || 0 })) }); fresh.forEach(g => sent.push(g.id)); ls.set('sf_synced', JSON.stringify(sent.slice(-400))); } catch (e) { } }
  };
  /* the engine switch, always visible at the top of the chess tab */
  const paintSwitch = () => { const e = document.getElementById('acengsw'); if (!e) return; const off = lowPower(), no = !st || !st.available, on = !off && !no && use(); e.innerHTML = '<span class="small mute">Engine</span><button class="ib' + (on ? ' on' : '') + '" data-eng="sf"' + (off || no ? ' disabled style="opacity:.5"' : '') + ' title="Stockfish: far stronger, uses more CPU">⚡ Stockfish</button><button class="ib' + (!on ? ' on' : '') + '" data-eng="js" title="Moundshroud built-in engine: lighter, human-like at lower levels">🧩 Built-in</button><span class="small mute">' + (off ? 'Low-power mode: Stockfish is off' : no ? (st ? 'Stockfish is not installed' : 'Restart Moundshroud to turn on Stockfish') : on ? 'Stockfish plays levels 1400+ and analyses games' : 'Using the built-in engine') + '</span>'; };
  const injectSwitch = () => { const t = document.getElementById('actabs'); if (!t || document.getElementById('acengsw')) return; const d = document.createElement('div'); d.id = 'acengsw'; d.style.cssText = 'display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin:0 0 6px'; t.parentNode.insertBefore(d, t); d.onclick = ev => { const b = ev.target.closest('[data-eng]'); if (!b || b.disabled) return; SF.setUse(b.dataset.eng === 'sf'); try { A.toast(b.dataset.eng === 'sf' ? 'Stockfish is now your chess engine.' : 'Using the built-in engine.', 2200); } catch (x) { } }; paintSwitch(); };
  try { new MutationObserver(() => injectSwitch()).observe(document.getElementById('p-play') || document.body, { childList: true, subtree: true }); } catch (e) { }
  /* low-power mode turns Stockfish off completely (the server stops both engine processes and the background study) */
  try { if (typeof A !== 'undefined' && A.power && !A.power.__sf) { A.power.__sf = 1; for (const k of ['toggle', 'enable', 'disable']) { const o = A.power[k]; if (typeof o !== 'function') continue; A.power[k] = function () { const r = o.apply(this, arguments); setTimeout(() => { post('/api/sf/power', { low: lowPower() }).then(s => { st = s; paintSwitch(); }).catch(() => { }); }, 80); return r; }; } } } catch (e) { }
  refresh().then(() => SF.syncGames()); setInterval(() => refresh(), 60000); setInterval(() => SF.syncGames(), 5 * 60000);

  /* ---------- 🧠 Engine Lab ---------- */
  UI.sections.lab = (host) => {
    let dead = false, timer = 0, board = null, hist = [], drill = null; const q = id => host.querySelector('#' + id);
    const fmtCp = (cp, side) => { if (Math.abs(cp) > 20000) return (cp * side > 0 ? '+' : '-') + 'M'; const v = cp * side / 100; return (v > 0 ? '+' : '') + v.toFixed(2); };
    const posFromHist = () => { const p = new C.Pos().setFen(C.START); for (const m of hist) p.make(m); return p; };
    const skeleton = () => {
      host.innerHTML = '<div style="max-width:1100px"><div class="card" style="margin:0 0 10px"><div class="row" style="gap:12px;align-items:center;flex-wrap:wrap"><div style="font-size:30px">🧠</div><div style="flex:1;min-width:220px"><b style="font-size:17px">Engine Lab</b><div class="small mute">Stockfish plays Maximum strength, powers deep analysis, and studies in the background while Moundshroud is open.</div></div><label class="chk"><input type="checkbox" id="lab-use"> Use Stockfish</label><label class="chk"><input type="checkbox" id="lab-on"> Study in the background</label><label class="small mute">Study power <select id="lab-th"><option value="1">Light (1 thread)</option><option value="2">2 threads</option><option value="4">Medium (4 threads)</option><option value="8">Heavy (8 threads)</option></select></label><label class="small mute">Depth <select id="lab-dp">' + [18, 20, 22, 24, 26].map(d => '<option>' + d + '</option>').join('') + '</select></label></div><div id="lab-st" class="small" style="margin-top:10px;line-height:1.6"></div></div>' +
        '<div style="display:flex;gap:14px;flex-wrap:wrap;align-items:flex-start"><div class="card" style="margin:0;flex:1 1 520px"><b>📖 What it has studied</b><div class="small mute" style="margin:2px 0 8px">Play moves on the board. The list shows the engine\'s own ranking from deep searches. It plays these moves when it plays you at high strength.</div><div class="acw" style="align-items:flex-start;gap:12px"><div id="lab-bd"></div><div style="flex:1;min-width:230px"><div class="row" style="gap:6px;margin-bottom:6px"><button class="ib" id="lab-back">◀ Back</button><button class="ib" id="lab-reset">⟲ Start</button><button class="pri" id="lab-ask">Ask Stockfish now</button></div><div id="lab-mv"></div><div id="lab-ai" class="small" style="margin-top:8px;line-height:1.5"></div></div></div></div>' +
        '<div class="card" style="margin:0;flex:1 1 320px"><b>🎯 Your costliest mistakes</b><div class="small mute" style="margin:2px 0 8px">Found by studying your saved games. Drill them until you find the right move.</div><div id="lab-ls"></div><div id="lab-dr"></div></div></div></div>';
      q('lab-use').checked = use() && !lowPower(); q('lab-use').disabled = lowPower(); q('lab-use').onchange = e => { SF.setUse(e.target.checked); };
      const cfgSend = o => post('/api/study/config', o).then(r => { st = r; paintSt(); }); q('lab-on').onchange = e => cfgSend({ on: e.target.checked }); q('lab-th').onchange = e => cfgSend({ threads: +e.target.value }); q('lab-dp').onchange = e => cfgSend({ depth: +e.target.value });
      board = new UI.Board(q('lab-bd')); board.onmove = m => { hist.push(m); paintBook(); }; q('lab-back').onclick = () => { hist.pop(); paintBook(); }; q('lab-reset').onclick = () => { hist = []; paintBook(); }; q('lab-ask').onclick = ask;
    };
    const paintSt = () => {
      const s = st; if (!q('lab-st')) return; if (!s) { q('lab-st').innerHTML = '<span style="color:var(--warn)">⚠️ The engine service is not running. Close Moundshroud completely and open it again (the engine was added after this copy of Moundshroud started). Stockfish is already installed.</span>'; return; } if (!s.available) { q('lab-st').innerHTML = '<span style="color:var(--bad)">Stockfish is not installed.</span>'; return; }
      const d = s.study; q('lab-on').checked = !!s.on; q('lab-th').value = String(s.cfg.threads); q('lab-dp').value = String(s.cfg.depth);
      q('lab-st').innerHTML = '<div>' + (s.on ? '🟢 ' : '⚪ ') + '<b>' + esc(s.job ? s.job.text : (s.on ? 'Starting...' : 'Studying is switched off')) + '</b></div><div class="mute">Positions studied <b>' + d.positions + '</b> · opening book <b>' + d.book + '</b> positions (queue ' + d.queue + ') · average depth <b>' + d.avgDepth + '</b> · time spent <b>' + d.hours + ' h</b> · your games studied <b>' + d.games + '</b> (' + d.gamesQueued + ' waiting) · mistakes found <b>' + d.lessons + '</b></div><div class="mute">It studies while Moundshroud is open and you are not using the engine, on a separate low-priority process.</div>';
    };
    const paintBook = async () => {
      const p = posFromHist(), fen = p.fen(); board.set(fen, { who: 2, last: hist.length ? [hist[hist.length - 1] & 63, (hist[hist.length - 1] >> 6) & 63] : null, anim: false }); const side = p.side, bk = await SF.book(fen); if (dead) return; const el = q('lab-mv'); if (!el) return;
      el.innerHTML = bk.length ? '<table class="small" style="width:100%;border-collapse:collapse"><tr class="mute"><th style="text-align:left">Move</th><th>Eval (White)</th><th>Depth</th></tr>' + bk.map(m => { const mv = toMove(fen, m[0]); const san = mv !== null ? p.san(mv) : m[0]; return '<tr data-u="' + m[0] + '" style="cursor:pointer;border-top:1px solid var(--line)"><td style="padding:4px 0"><b>' + esc(san) + '</b></td><td style="text-align:center">' + fmtCp(m[1], side) + '</td><td style="text-align:center">' + m[2] + '</td></tr>'; }).join('') + '</table>' : '<div class="small mute">The engine has not studied this position yet. Use <b>Ask Stockfish now</b>, or leave Moundshroud open and it will get there.</div>';
      el.onclick = e => { const r = e.target.closest('[data-u]'); if (!r) return; const m = toMove(fen, r.dataset.u); if (m !== null) { hist.push(m); paintBook(); } }; q('lab-ai').innerHTML = '';
    };
    const ask = async () => { const p = posFromHist(), fen = p.fen(), box = q('lab-ai'); box.textContent = 'Stockfish is thinking...'; try { const r = await post('/api/sf/go', { fen, ms: 3000, multipv: 3 }); if (dead) return; box.innerHTML = r.lines.map(l => { const pp = new C.Pos().setFen(fen), sans = []; for (const u of (l.pv || []).slice(0, 8)) { const m = pp.fromUci(u); if (!m) break; sans.push(pp.san(m)); pp.make(m); } return '<div><b>' + fmtCp(sc(l), p.side) + '</b> <span class="mute">(White) depth ' + l.depth + '</span> ' + esc(sans.join(' ')) + '</div>'; }).join('') + '<div class="mute">' + Math.round((r.nps || 0) / 1000) + 'k positions per second</div>'; } catch (e) { box.textContent = 'Could not reach the engine.'; } };
    const paintLessons = async () => {
      let ls2 = []; try { ls2 = (await get('/api/study/lessons')).lessons || []; } catch (e) { } if (dead || !q('lab-ls')) return;
      q('lab-ls').innerHTML = ls2.length ? ls2.slice(0, 12).map((l, i) => { const p = new C.Pos().setFen(l.fen), mv = p.fromUci(l.played), bm = p.fromUci(l.best); return '<div class="row" style="gap:6px;align-items:center;padding:5px 0;border-bottom:1px solid var(--line)"><div class="small" style="flex:1">Move ' + p.full + ' (' + (p.side > 0 ? 'White' : 'Black') + '): you played <b>' + esc(mv ? p.san(mv) : l.played) + '</b>, best <b>' + esc(bm ? p.san(bm) : l.best) + '</b> <span class="mute">(−' + (l.loss / 100).toFixed(1) + ')</span></div><button class="ib" data-d="' + i + '">Drill</button></div>'; }).join('') : '<div class="small mute">No mistakes found yet. Play some games; the engine studies each one after you finish. ' + (st && st.study && st.study.gamesQueued ? st.study.gamesQueued + ' waiting.' : '') + '</div>';
      q('lab-ls').onclick = e => { const b = e.target.closest('[data-d]'); if (b) startDrill(ls2[+b.dataset.d]); };
    };
    const startDrill = l => {
      drill = l; const p = new C.Pos().setFen(l.fen), side = p.side; q('lab-dr').innerHTML = '<div class="small" style="margin:8px 0 4px">Find the best move for ' + (side > 0 ? 'White' : 'Black') + ':</div><div id="lab-db"></div><div id="lab-dm" class="small" style="margin-top:6px"></div>';
      const b2 = new UI.Board(q('lab-db')); b2.set(l.fen, { who: side, flipped: side < 0, anim: false }); b2.onmove = m => { const u = b2.pos.uci(m); if (u === l.best) { q('lab-dm').innerHTML = '<span style="color:var(--ok)">✔ Correct! That is the engine\'s move.</span>'; b2.who = 0; } else { q('lab-dm').innerHTML = '<span style="color:var(--bad)">Not quite.</span> Try again.'; b2.set(l.fen, { who: side, flipped: side < 0, anim: false }); } };
    };
    skeleton(); paintBook(); paintLessons(); refresh().then(() => paintSt()); timer = setInterval(async () => { if (dead) return; await refresh(); paintSt(); }, 2500); setInterval(() => { if (!dead) paintLessons(); }, 20000);
    return () => { dead = true; clearInterval(timer); try { board && board.destroy(); } catch (e) { } };
  };
})();

// Live coach for chess: an evaluation bar, a verdict on each move (best / good / inaccuracy / mistake / blunder, with the better move), hanging-piece and free-capture alerts,
// the opening name, a hint arrow, a plain-English explanation from the AI, and an optional blunder guard that asks before a move leaves a piece to be taken.
// It is attached to the Play and Online/Tournament boards (all unrated, so coaching is fair). The engine analyses in its own worker. Nothing leaves this PC.
(() => {
  const C = window.Chess; if (!C) return;
  const NAME = ['', 'pawn', 'knight', 'bishop', 'rook', 'queen', 'king'], V = [0, 1, 3, 3, 5, 9, 0], FILES = 'abcdefgh', sqn = s => FILES[s & 7] + (8 - (s >> 3));
  const cfg = Object.assign({ on: 1, lvl: 1, guard: 0 }, (() => { try { return JSON.parse(ls.get('chlive', '{}')); } catch (e) { return {}; } })()); const saveCfg = () => ls.set('chlive', JSON.stringify(cfg));
  const esc2 = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const replay = (hist, upto, start) => { const p = new C.Pos().setFen(start || C.START); for (let i = 0; i < upto; i++) { const m = p.fromUci(hist[i].u); if (!m && m !== 0) return null; p.make(m); } return p; };
  const G = () => (window.ChessReact && ChessReact.geo) || null;
  const fmtEval = cp => { if (cp == null) return '...'; if (Math.abs(cp) >= 20000) return (cp > 0 ? '+' : '-') + 'M' + Math.max(1, Math.ceil((30000 - Math.abs(cp)) / 2)); const v = cp / 100; return (v >= 0 ? '+' : '') + v.toFixed(1); };
  const pct = cp => cp == null ? 50 : Math.abs(cp) >= 20000 ? (cp > 0 ? 100 : 0) : Math.round(50 + 50 * Math.tanh(cp / 450));
  const grade = (loss, best) => best ? ['Best', '#34d399', '!'] : loss <= 12 ? ['Excellent', '#34d399', '✓'] : loss <= 45 ? ['Good', '#86efac', '✓'] : loss <= 110 ? ['Inaccuracy', '#fbbf24', '?!'] : loss <= 260 ? ['Mistake', '#fb923c', '?'] : ['Blunder', '#f87171', '??'];
  /* pieces of `side` that can be taken profitably, and pieces of the other side that `side` can take profitably */
  function threats(p, side) {
    const g = G(); if (!g) return { mine: [], free: [] }; const mine = [], free = [];
    for (let s = 0; s < 64; s++) { const v = p.b[s]; if (!v || Math.abs(v) === 6) continue; const own = (v > 0) === (side > 0), t = Math.abs(v), by = own ? -side : side;
      const att = g.attackers(p, s, by); if (!att.length) continue; const def = g.attackers(p, s, own ? side : -side), low = V[att[0]];
      if (!def.length || low < V[t]) { const gain = !def.length ? V[t] : V[t] - low; if (gain >= 1 && (t > 1 || !def.length)) (own ? mine : free).push({ s, t, gain, undefended: !def.length }); }
    }
    mine.sort((a, b) => b.gain - a.gain); free.sort((a, b) => b.gain - a.gain); return { mine, free };
  }
  /* the blunder guard: a message if the move leaves something worse off than before, else '' */
  function guard(fenBefore, uci) {
    try { if (!G()) return ''; const p = new C.Pos().setFen(fenBefore), side = p.side, before = threats(p, side).mine.map(x => x.s), m = p.fromUci(uci); if (!m && m !== 0) return ''; p.make(m); const after = threats(p, side).mine.filter(x => !before.includes(x.s) && x.gain >= 3);
      if (!after.length) return ''; const w = after[0]; return 'This leaves your ' + NAME[w.t] + ' on ' + sqn(w.s) + (w.undefended ? ' attacked and unprotected' : ' able to be taken by a cheaper piece') + '.'; } catch (e) { return ''; }
  }
  function attach(el, getCtx) {
    const st = { log: [], over: false, n: -1, tok: 0, cp: null, verdict: null, eng: null, busy: false, alerts: '', open: '', explain: '' };
    const eng = () => { if (!st.eng) st.eng = (window.ChessUI && ChessUI.Eng) ? ChessUI.Eng() : null; return st.eng; };
    const $ = s => el.querySelector(s);
    const summary = log => { const avg = log.reduce((a, x) => a + Math.min(x.loss, 600), 0) / log.length, acc = Math.round(100 * Math.exp(-avg / 220)), cnt = {}; log.forEach(x => { cnt[x.label] = (cnt[x.label] || 0) + 1; }); const worst = log.slice().sort((a, b) => b.loss - a.loss)[0], c = getCtx();
      return '<div class="card" style="margin:0 0 8px;padding:10px 12px;border-color:var(--acc)"><b>📊 Your game in short</b><div class="row" style="gap:16px;margin:6px 0;align-items:baseline"><span style="font-size:26px;font-weight:800;color:var(--acc)">' + acc + '%</span><span class="small mute">accuracy (estimate) over ' + log.length + ' moves</span></div><div class="small" style="line-height:1.6">' + ['Best', 'Excellent', 'Good', 'Inaccuracy', 'Mistake', 'Blunder'].filter(k => cnt[k]).map(k => k + ' <b>' + cnt[k] + '</b>').join(' · ') + '</div>' + (worst && worst.loss > 110 ? '<div class="small" style="margin-top:4px">Biggest swing: move ' + Math.ceil(worst.ply / 2) + ', <b>' + esc2(worst.san) + '</b> (' + worst.label.toLowerCase() + ').</div>' : '<div class="small" style="margin-top:4px">No big swings. Clean game!</div>') + (c.review ? '<div style="margin-top:8px"><button class="pri" id="lrev">🔬 Review the whole game</button></div>' : '') + '</div>'; };
    function draw() {
      if (!el.isConnected) return; const ctx = getCtx(), v = st.verdict;
      const mineLog = st.log.filter(x => x && x.who === 'me'), sum = ctx.over && mineLog.length >= 3 ? summary(mineLog) : '';
      el.innerHTML = (sum || '') + '<div class="card" style="margin:0;padding:8px 10px"><div class="row" style="align-items:center;gap:8px"><b>🧑‍🏫 Live coach</b><span class="sp"></span>' + (cfg.on ? '<select id="lvl" class="small" title="How much the coach says"><option value="0"' + (cfg.lvl === 0 ? ' selected' : '') + '>Only big mistakes</option><option value="1"' + (cfg.lvl === 1 ? ' selected' : '') + '>Normal</option><option value="2"' + (cfg.lvl === 2 ? ' selected' : '') + '>Detailed</option></select>' : '') + '<label class="chk small" title="Turn the live coach on or off"><input type="checkbox" id="lon"' + (cfg.on ? ' checked' : '') + '> On</label></div>' +
        (cfg.on ? '<div style="position:relative;height:16px;border-radius:8px;overflow:hidden;background:#1d1f27;margin:8px 0 4px;border:1px solid var(--line)"><div style="width:' + pct(st.cp) + '%;height:100%;background:#e9e9ee;transition:width .4s"></div><span style="position:absolute;left:0;right:0;top:0;text-align:center;font:700 11px/16px system-ui;mix-blend-mode:difference;color:#fff">' + fmtEval(st.cp) + '</span></div><div class="small mute" style="display:flex;justify-content:space-between"><span>White</span><span>' + (st.busy ? 'thinking...' : st.open ? esc2(st.open) : '') + '</span><span>Black</span></div>' +
          (v ? '<div style="margin-top:8px;padding:7px 9px;border-radius:9px;border:1px solid ' + v.col + ';background:rgba(255,255,255,.03)"><b style="color:' + v.col + '">' + esc2(v.san) + ' ' + v.mark + ' ' + esc2(v.label) + '</b>' + (v.better && v.loss > 30 ? '<div class="small">Better was <b>' + esc2(v.better) + '</b>' + (v.loss > 30 ? ' (about ' + (v.loss / 100).toFixed(1) + ' pawns)' : '') + '</div>' : '') + (v.who === 'opp' ? '<div class="small mute">Opponent\'s move</div>' : '') + '</div>' : '<div class="small mute" style="margin-top:8px">Make a move and I will tell you how it was.</div>') +
          (st.alerts ? '<div class="small" style="margin-top:6px;line-height:1.5">' + st.alerts + '</div>' : '') +
          '<div class="row" style="gap:6px;margin-top:8px;flex-wrap:wrap"><button class="ib" id="lhint">💡 Hint</button><button class="ib" id="lexp">✨ Explain</button><label class="chk small" title="Ask before a move leaves a piece to be taken"><input type="checkbox" id="lgd"' + (cfg.guard ? ' checked' : '') + '> Blunder guard</label></div>' + (st.explain ? '<div class="small" style="margin-top:6px;line-height:1.55;white-space:pre-wrap">' + esc2(st.explain) + '</div>' : '') : '<div class="small mute" style="margin-top:6px">Off. Turn it on for an evaluation bar, move grades and alerts.</div>') + '</div>';
      const rv = $('#lrev'); if (rv) rv.onclick = () => { try { getCtx().review(); } catch (e) { } };
      const q = $('#lon'); q.onchange = () => { cfg.on = q.checked ? 1 : 0; saveCfg(); if (cfg.on) { st.n = -1; update(); } else draw(); };
      const l = $('#lvl'); if (l) l.onchange = () => { cfg.lvl = +l.value; saveCfg(); st.n = -1; update(); }; const gd = $('#lgd'); if (gd) gd.onchange = () => { cfg.guard = gd.checked ? 1 : 0; saveCfg(); };
      const h = $('#lhint'); if (h) h.onclick = async () => { const c = getCtx(); if (c.over || c.side !== c.human) return; const e = eng(); if (!e) return; h.disabled = true; const r = await e.ask({ cmd: 'ana', fen: c.fen, depth: 5, ms: 2500 }); if (r && r.best && c.board) { const p = new C.Pos().setFen(c.fen), m = p.fromUci(r.best); if (m || m === 0) { c.board.marks = {}; c.board.marks[m & 63] = 'hint'; c.board.marks[(m >> 6) & 63] = 'hint'; c.board.draw(); } } if ($('#lhint')) $('#lhint').disabled = false; };
      const x = $('#lexp'); if (x) x.onclick = async () => { const c = getCtx(); if (!c.hist.length) return; const last = c.hist[c.hist.length - 1]; x.disabled = true; st.explain = 'Thinking...'; draw(); let out = ''; try { out = await A.ai.stream([{ role: 'system', content: 'You are a friendly chess coach. In at most 4 short sentences, explain the position or the last move for a club player: the idea, any danger, and a plan. Do not list engine lines or give long variations.' }, { role: 'user', content: 'Position (FEN): ' + c.fen + '. Moves so far: ' + c.hist.map(h => h.san).join(' ') + '. Last move: ' + last.san + '. Engine evaluation (White view): ' + fmtEval(st.cp) + (v ? '. The coach graded the last human move as ' + v.label + (v.better ? ' (better was ' + v.better + ')' : '') : '') + '.' }], t => { st.explain = t; const e = el.querySelector('div[style*="pre-wrap"]'); if (e) e.textContent = t; }, null, { temp: .4 }); } catch (e) { out = 'The AI engine did not answer.'; } st.explain = out; draw(); };
    }
    async function update() {
      if (!el.isConnected) { try { st.eng && st.eng.kill(); } catch (e) { } st.eng = null; return; } if (!cfg.on) { if (!el.firstChild) draw(); return; }
      const c = getCtx(), n = c.hist.length; if (c.over !== st.over) { st.over = c.over; draw(); } if (n === st.n && el.firstChild) return; if (n < st.n || n === 0) st.log = st.log.slice(0, n); st.n = n; const my = ++st.tok; st.busy = true; try { if (c.board && c.board.marks && Object.keys(c.board.marks).length) { /* a hint from before is stale */ } } catch (e) { }
      st.alerts = ''; const p = new C.Pos().setFen(c.fen); try { st.open = window.ChessProfile && c.hist.length ? ChessProfile.openingOf(c.hist.map(h => h.u)) : ''; } catch (e) { st.open = ''; } draw();
      const e = eng(); if (!e) { st.busy = false; draw(); return; }
      try {
        if (n >= 1) {
          const before = replay(c.hist, n - 1, c.startFen); if (before) { const last = c.hist[n - 1], r = await e.ask({ cmd: 'ana', fen: before.fen(), played: last.u, depth: 4, ms: 800 }); if (my !== st.tok) return;
            if (r && typeof r.bs === 'number') { const mover = before.side, loss = Math.max(0, r.bs - (typeof r.played === 'number' ? r.played : r.bs)), best = r.best === last.u, gr = grade(loss, best); st.cp = (typeof r.played === 'number' ? r.played : r.bs) * mover; let bsan = ''; if (r.best && !best) { const bm = before.fromUci(r.best); if (bm || bm === 0) bsan = before.san(bm, before.legal()); }
              const mine = mover === c.human; st.log[n - 1] = { who: mine ? 'me' : 'opp', loss, label: gr[0], san: last.san, ply: n }; st.verdict = (mine && (cfg.lvl >= 1 || loss > 110)) || (!mine && cfg.lvl >= 2) ? { san: last.san, label: gr[0], mark: gr[2], col: gr[1], better: bsan, loss, who: mine ? 'me' : 'opp' } : (mine ? null : st.verdict); } }
        } else { const r = await e.ask({ cmd: 'ana', fen: c.fen, depth: 3, ms: 400 }); if (my !== st.tok) return; if (r && typeof r.bs === 'number') st.cp = r.bs * p.side; st.verdict = null; }
        const t = threats(p, c.human), msgs = [];
        if (p.inCheck()) msgs.push('⚠️ ' + (p.side === c.human ? 'You are' : 'The opponent is') + ' in check.');
        if (t.mine.length && cfg.lvl >= 1) msgs.push('🛡️ Your ' + NAME[t.mine[0].t] + ' on ' + sqn(t.mine[0].s) + (t.mine[0].undefended ? ' is attacked and unprotected.' : ' can be taken by a cheaper piece.'));
        if (t.free.length && cfg.lvl >= 1 && p.side === c.human) msgs.push('🎯 You can win the ' + NAME[t.free[0].t] + ' on ' + sqn(t.free[0].s) + (t.free[0].undefended ? ' (it is unprotected).' : '.'));
        st.alerts = msgs.join('<br>');
      } catch (er) { }
      if (my !== st.tok) return; st.busy = false; draw();
    }
    draw(); setTimeout(update, 50); return { update, draw, destroy() { try { st.eng && st.eng.kill(); } catch (e) { } st.eng = null; } };
  }
  window.ChessLive = { attach, guard, cfg, threats };
})();

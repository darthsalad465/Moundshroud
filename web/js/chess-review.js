// Analysis extras: engine arrows on the board (best move vs played, the engine's top lines with evals, numbered lines you can hover), the full line for each engine move,
// an evaluation of any arrow you draw (right-drag), and a Review tab that explains every move: what it was probably trying to do, why it was good or bad,
// what it allows, which other moves were available (with lines), what changed, and an optional AI explanation. Hooked into chess-analyze-ui.js through ChessReview.make(env).
(() => {
  const C = window.Chess; if (!C) return;
  const NAME = ['', 'pawn', 'knight', 'bishop', 'rook', 'queen', 'king'], V = [0, 1, 3, 3, 5, 9, 0], FILES = 'abcdefgh', sqn = s => FILES[s & 7] + (8 - (s >> 3));
  const esc2 = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const G = () => (window.ChessReact && ChessReact.geo) || null;
  const cap1 = s => s.charAt(0).toUpperCase() + s.slice(1);
  const sideN = s => s > 0 ? 'White' : 'Black';

  /* ---------- plain-language facts about one move ---------- */
  function describe(fen, uci, ply, sans) {
    const g = G(); const p = new C.Pos().setFen(fen), m = p.fromUci(uci); if (!m && m !== 0) return null; if (!g) return { san: uci, parts: [], tags: [] };
    const f = m & 63, t = (m >> 6) & 63, side = p.side, mv = p.b[f], pt = Math.abs(mv), tgt = p.b[t], ep = pt === 1 && !tgt && (f & 7) !== (t & 7), capT = ep ? 1 : Math.abs(tgt), promo = (m >> 12) & 7, san = p.san(m, p.legal());
    const castle = pt === 6 && Math.abs((t & 7) - (f & 7)) === 2, before = ChessLive.threats(p, side), back = side > 0 ? 7 : 0, mat0 = g.material(p);
    const parts = [], tags = []; const add = (s, tag) => { parts.push(s); if (tag) tags.push(tag); };
    p.make(m); const chk = p.inCheck(), after = ChessLive.threats(p, side), mat1 = g.material(p), myAtt = g.attackers(p, t, -side), myDef = g.attackers(p, t, side);
    if (castle) add('castles ' + ((t & 7) > 4 ? 'kingside' : 'queenside') + ', tucking the king away and bringing a rook into play', 'castles');
    else if (promo) add('promotes the pawn to a ' + NAME[promo] + ' on ' + sqn(t), 'promotes');
    else if (capT) { const eq = V[capT] === V[pt] && pt !== 1; add((ep ? 'captures a pawn en passant' : 'takes the ' + NAME[capT] + ' on ' + sqn(t) + ' with the ' + NAME[pt]) + (eq && myAtt.length ? ', inviting a trade' : V[capT] > V[pt] ? ', winning material' : ''), 'captures'); }
    if (chk) add('gives check', 'check');
    // defending or rescuing something that was under attack
    const wasHanging = before.mine.find(x => x.s === f); if (wasHanging && !castle) add('moves the attacked ' + NAME[pt] + ' out of danger', 'saves');
    else { const saved = before.mine.find(x => x.s !== f && !after.mine.some(y => y.s === x.s)); if (saved && (!capT)) add('defends the ' + NAME[saved.t] + ' on ' + sqn(saved.s) + ' that was under attack', 'defends'); }
    // development and centre
    const developing = (pt === 2 || pt === 3) && (f >> 3) === back && (ply == null || ply < 28); if (developing) add('develops the ' + NAME[pt] + ' towards the centre', 'develops');
    if (pt === 1 && [27, 28, 35, 36].includes(t) && !capT) add('stakes a claim in the centre with the pawn', 'centre');
    else if (pt === 1 && !capT && (t >> 3 === (side > 0 ? 1 : 6))) add('pushes the pawn to the ' + (side > 0 ? 'seventh' : 'second') + ' rank, one step from promotion', 'push');
    if (pt === 4 && !capT) { let ownP = 0, oppP = 0; for (let r = 0; r < 8; r++) { const v = p.b[r * 8 + (t & 7)]; if (Math.abs(v) === 1) { if ((v > 0) === (side > 0)) ownP++; else oppP++; } } if (!ownP) add('puts the rook on the ' + (oppP ? 'half-open' : 'open') + ' ' + FILES[t & 7] + '-file', 'rookfile'); }
    if (pt === 5 && !capT && (ply != null && ply < 12)) add('brings the queen out very early, which can cost time if she is chased', 'earlyq');
    if (pt === 6 && !castle && !capT && mat1.nw + mat1.nb > 26) add('moves the king, which is risky while many pieces are on the board', 'kingwalk');
    // what the moved piece now attacks
    const hits = g.attSq(p, t).filter(s => p.b[s] && (p.b[s] > 0) !== (mv > 0) && Math.abs(p.b[s]) >= 2 && (Math.abs(p.b[s]) === 6 || V[Math.abs(p.b[s])] > V[pt] || !g.attackers(p, s, -side).length)).map(s => ({ s, t: Math.abs(p.b[s]) }));
    if (hits.length >= 2) add('creates a double attack: the ' + NAME[pt] + ' now hits the ' + hits.map(h => NAME[h.t] + ' on ' + sqn(h.s)).join(' and the '), 'fork'); else if (hits.length === 1 && hits[0].t !== 6 && !capT) add('attacks the ' + NAME[hits[0].t] + ' on ' + sqn(hits[0].s), 'attacks');
    // discovered threats against big pieces (something new is attacked besides the moved piece)
    const newFree = after.free.filter(x => !before.free.some(y => y.s === x.s) && !hits.some(h => h.s === x.s) && x.gain >= 3); if (newFree.length) add('also uncovers a threat to the ' + NAME[newFree[0].t] + ' on ' + sqn(newFree[0].s), 'discover');
    // danger created by the move itself
    const created = after.mine.filter(x => !before.mine.some(y => y.s === x.s) && x.gain >= 3); if (created.length) add('but leaves the ' + NAME[created[0].t] + ' on ' + sqn(created[0].s) + ' ' + (created[0].undefended ? 'attacked and unprotected' : 'exposed to a cheaper piece'), 'weakens');
    const own = side > 0 ? mat1.w - mat1.b : mat1.b - mat1.w, own0 = side > 0 ? mat0.w - mat0.b : mat0.b - mat0.w, dm = own - own0;
    if (!parts.length) add(pt === 1 ? 'a quiet pawn move that gains space' : pt === 6 ? 'a quiet king move' : 'a quiet move that improves the ' + NAME[pt] + '\'s placement', 'quiet');
    return { san, parts, tags, mat: dm, check: chk, pt, capT, from: f, to: t };
  }
  const stateOf = cp => { if (cp == null) return ''; if (Math.abs(cp) >= 20000) return cp > 0 ? 'a forced win for White' : 'a forced win for Black'; return cp >= 300 ? 'clearly winning for White' : cp >= 100 ? 'better for White' : cp >= 40 ? 'slightly better for White' : cp > -40 ? 'roughly equal' : cp > -100 ? 'slightly better for Black' : cp > -300 ? 'better for Black' : 'clearly winning for Black'; };
  const fmt = cp => cp == null ? '' : Math.abs(cp) >= 20000 ? (cp > 0 ? '+' : '-') + 'M' + Math.max(1, Math.ceil((30000 - Math.abs(cp)) / 2)) : (cp >= 0 ? '+' : '') + (cp / 100).toFixed(1);

  window.ChessReview = {
    describe,
    make(env) {
      const { AN, CI } = env, mkBoardPos = fen => new C.Pos().setFen(fen);
      let arrowsOn = ls.get('anarr', '0') === '1', bestOn = ls.get('anbest', '1') !== '0', hover = -1, userLine = null, userCount = 0, lastFen = '', revTok = 0, lineCache = {}, pvCache = {}, curLines = [];
      const sqIdx = n => C.sqIndex(n);
      /* ---------- overlay ---------- */
      const COL = { best: '#3fae4b', bad: '#e53935', warn: '#f0a020', e1: '#2a8cff', e2: '#6aa5ff', e3: '#9cc0ff', pv: ['#2a8cff', '#e0a030'] };
      function paint() {
        const el = env.board.el; if (!el) return; let o = el.querySelector('.rvarr'); if (o) o.remove(); const S = env.state(); if (!S.game) return; const arrows = [];
        const add = (u, c, w, label, num) => { if (!u || u.length < 4) return; arrows.push({ f: sqIdx(u.slice(0, 2)), t: sqIdx(u.slice(2, 4)), c, w, label, num }); };
        if (bestOn && !S.explore && S.rows && S.idx > 0) { const r = S.rows[S.idx - 1], pl = S.game.moves[S.idx - 1]; if (r && !r.unk && r.b) { if (['inaccuracy', 'mistake', 'blunder'].includes(r.c)) { add(pl, r.c === 'inaccuracy' ? COL.warn : COL.bad, .16, CI[r.c][0]); if (r.b !== pl) add(r.b, COL.best, .2, 'best'); } else if (r.c === 'brilliant' || r.c === 'great') add(pl, COL.best, .17, CI[r.c][0]); } }
        if (arrowsOn) { curLines.slice(0, 3).forEach((l, i) => { if (hover === -1 || hover === i) add(l.uci, [COL.e1, COL.e2, COL.e3][i], [.2, .15, .12][i], l.ev); }); if (hover >= 0 && curLines[hover] && curLines[hover].pv) curLines[hover].pv.slice(1, 6).forEach((u, k) => add(u, COL.pv[(k + 1) % 2], .13, '', k + 2)); }
        if (userLine) userLine.moves.forEach((u, k) => add(u, COL.pv[k % 2], k === 0 ? .18 : .14, '', k + 1));
        if (!arrows.length) return;
        const fl = env.board.flipped, pos = s => { const i = fl ? 63 - s : s; return [(i & 7) + .5, (i >> 3) + .5]; }; let h = '';
        for (const a of arrows) { const [x1, y1] = pos(a.f), [x2, y2] = pos(a.t), dx = x2 - x1, dy = y2 - y1, d = Math.hypot(dx, dy) || 1, sx = x1 + dx / d * .3, sy = y1 + dy / d * .3, ex = x2 - dx / d * .16, ey = y2 - dy / d * .16; h += env.board.arrowSvg(a);
          if (a.num) h += '<circle cx="' + (x1 + dx * .55) + '" cy="' + (y1 + dy * .55) + '" r=".19" fill="' + a.c + '" stroke="#111" stroke-width=".03"/><text x="' + (x1 + dx * .55) + '" y="' + (y1 + dy * .55 + .08) + '" text-anchor="middle" font-size=".24" font-weight="700" fill="#fff" font-family="Segoe UI,sans-serif">' + a.num + '</text>';
          else if (a.label) h += '<rect x="' + (x2 - .3) + '" y="' + (y2 - .46) + '" width=".6" height=".26" rx=".08" fill="' + a.c + '" opacity=".95"/><text x="' + x2 + '" y="' + (y2 - .27) + '" text-anchor="middle" font-size=".19" font-weight="700" fill="#fff" font-family="Segoe UI,sans-serif">' + esc2(a.label) + '</text>'; }
        o = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); o.setAttribute('class', 'rvarr'); o.setAttribute('viewBox', '0 0 8 8'); o.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:3'; o.innerHTML = h; el.appendChild(o);
      }
      const d0 = env.board.draw; env.board.draw = function () { const r = d0.apply(this, arguments); try { paint(); } catch (e) { } return r; };
      /* ---------- principal variations ---------- */
      async function pvOf(fen, uci) {
        const k = fen + '|' + uci; if (pvCache[k]) return pvCache[k]; const p = mkBoardPos(fen), m = p.fromUci(uci); if (!m && m !== 0) return { uci: [uci], san: [uci] }; const san0 = p.san(m, p.legal()); p.make(m);
        let r = null; try { r = await env.getEng().ask({ cmd: 'pv', fen: p.fen(), len: 6, depth: 3, ms: 1200 }, 8000); } catch (e) { }
        const U = [uci], S = [san0]; for (const u of (r && r.pv) || []) { const mm = p.fromUci(u); if (!mm && mm !== 0) break; S.push(p.san(mm, p.legal())); U.push(u); p.make(mm); } const out = { uci: U, san: S }; pvCache[k] = out; return out;
      }
      const lineText = (fenStart, sanList) => { const p = mkBoardPos(fenStart); const n0 = p.full || 1; let s = ''; sanList.forEach((x, i) => { const w = (p.side > 0) === (i % 2 === 0); const num = n0 + Math.floor((i + (p.side > 0 ? 0 : 1)) / 2); if (i === 0 || w) s += num + (w ? '. ' : '... ') ; s += x + ' '; }); return s.trim(); };
      /* ---------- engine tab ---------- */
      async function paintLines(box, L, res, fen) {
        curLines = L.map(l => ({ uci: l.uci, san: l.san, cp: l.cp, ev: l.ev, pv: null })); paint();
        if (!L.length) { box.innerHTML = '<div class="mute small">' + (res && fen === env.curFen() ? 'No legal moves here.' : 'Thinking...') + '</div>'; return; }
        const draw = () => { box.innerHTML = curLines.map((l, i) => '<div class="rvl" data-i="' + i + '" style="padding:6px 8px;border-radius:8px;cursor:pointer;border-bottom:1px solid var(--line)"><div style="display:flex;gap:8px;align-items:baseline"><b style="min-width:3.4em;color:' + (l.cp > 30 ? 'var(--ok)' : l.cp < -30 ? 'var(--bad)' : 'var(--text)') + '">' + l.ev + '</b><b>' + esc2(l.san) + '</b><span class="sp" style="flex:1"></span><button class="ib" data-play="' + i + '" style="padding:1px 8px" title="Play this whole line on the board">▶ line</button></div><div class="small mute" style="margin-top:2px;line-height:1.5">' + (l.pv ? esc2(lineText(fen, l.pv.san)) : 'working out the line...') + '</div></div>').join('') + '<div class="small mute" style="margin-top:6px">Depth ' + (res && res.depth || '?') + '. Hover a line to see it as numbered arrows on the board. Click a line to play its first move, or ▶ line to play it all.</div>'; };
        draw(); box.onmouseover = e => { const r = e.target.closest('.rvl'); const i = r ? +r.dataset.i : -1; if (i !== hover) { hover = i; paint(); } }; box.onmouseleave = () => { hover = -1; paint(); };
        box.onclick = e => { const pl = e.target.closest('[data-play]'); if (pl) { const l = curLines[+pl.dataset.play]; env.playMoves(l.pv ? l.pv.uci : [l.uci]); return; } const r = e.target.closest('.rvl'); if (r) env.playMoves([curLines[+r.dataset.i].uci]); };
        for (let i = 0; i < curLines.length; i++) { const l = curLines[i]; const pv = await pvOf(fen, l.uci); if (fen !== env.curFen()) return; l.pv = pv; draw(); }
      }
      function onEngine(L) { curLines = (L || []).map(l => ({ uci: l.uci, san: l.san, cp: l.cp, ev: l.ev, pv: null })); paint(); }
      /* ---------- your own arrows ---------- */
      const d1 = env.board.drawAnn; let uTok = 0;
      env.board.drawAnn = function () { const r = d1.apply(this, arguments); try { const a = env.board.ann.a; if (a.length > userCount) evalArrow(a[a.length - 1]); else if (!a.length) clearUser(); userCount = a.length; } catch (e) { } return r; };
      function clearUser() { userLine = null; const c = env.q('anuser'); if (c) c.innerHTML = ''; paint(); }
      async function evalArrow(a) {
        const fen = env.curFen(), p = mkBoardPos(fen), me = ++uTok, box = env.q('anuser'); if (!box) return; let uci = sqn(a.f) + sqn(a.t); const pc = p.b[a.f]; if (pc && Math.abs(pc) === 1 && ((a.t >> 3) === 0 || (a.t >> 3) === 7)) uci += 'q';
        const m = p.fromUci(uci); if (!m && m !== 0) { box.innerHTML = '<div class="acmsg small mute">That arrow is not a legal move here, so it is just an annotation.</div>'; return; }
        const san = p.san(m, p.legal()); box.innerHTML = '<div class="acmsg small"><b>' + esc2(san) + '</b>: checking with the engine...</div>';
        let r = null; try { r = await env.getEng().ask({ cmd: 'ana', fen, played: uci, depth: 5, ms: 1300 }, 8000); } catch (e) { } if (me !== uTok) return; if (!r || r.best == null) { box.innerHTML = ''; return; }
        const side = p.side, isBest = r.best === uci, dw = isBest ? 0 : Math.max(0, AN.wp(r.bs) - AN.wp(r.played == null ? r.bs : r.played)), cls = AN.classify(dw, isBest), info = CI[cls] || CI.good, after = (r.played == null ? r.bs : r.played) * side, bm = p.fromUci(r.best), bsan = bm || bm === 0 ? p.san(bm, p.legal()) : r.best, pv = await pvOf(fen, uci); if (me !== uTok) return;
        userLine = { moves: pv.uci }; paint();
        box.innerHTML = '<div class="acmsg" style="line-height:1.55"><div><b>' + esc2(san) + '</b> <span style="color:' + info[2] + ';font-weight:700">' + info[0] + ' ' + info[1] + '</span> <span class="small mute">eval ' + fmt(after) + ' (' + stateOf(after) + ')</span></div>' + (!isBest ? '<div class="small">The engine\'s choice is <b>' + esc2(bsan) + '</b> (' + fmt(r.bs * side) + ')' + (dw >= 5 ? ', about ' + (Math.max(0, r.bs - (r.played == null ? r.bs : r.played)) / 100).toFixed(1) + ' pawns better' : '') + '.</div>' : '<div class="small">That is the engine\'s top choice.</div>') +
          '<div class="small mute" style="margin-top:3px">Line: ' + esc2(lineText(fen, pv.san)) + '</div><div class="row" style="gap:6px;margin-top:6px"><button class="ib" id="uplay">▶ Play this line</button>' + (!isBest ? '<button class="ib" id="ubest">Show the best line</button>' : '') + '<button class="ib" id="uclr">✕</button></div></div>';
        box.querySelector('#uplay').onclick = () => env.playMoves(pv.uci); box.querySelector('#uclr').onclick = () => { env.board.ann = { s: {}, a: [] }; env.board.drawAnn(); }; const ub = box.querySelector('#ubest'); if (ub) ub.onclick = async () => { const bp = await pvOf(fen, r.best); userLine = { moves: bp.uci }; paint(); box.querySelector('.small.mute').textContent = 'Best line: ' + lineText(fen, bp.san); };
      }
      /* ---------- toggles ---------- */
      function bindToggles() { const a = env.q('anarr'), b = env.q('anbest'); if (a) { a.checked = arrowsOn; a.onchange = () => { arrowsOn = a.checked; ls.set('anarr', arrowsOn ? '1' : '0'); if (arrowsOn) env.engineWant(); paint(); }; } if (b) { b.checked = bestOn; b.onchange = () => { bestOn = b.checked; ls.set('anbest', bestOn ? '1' : '0'); paint(); }; } }
      /* ---------- the Review tab ---------- */
      function critical(dir) { const S = env.state(); if (!S.rows) return; const bad = ['inaccuracy', 'mistake', 'blunder', 'brilliant', 'great']; for (let i = S.idx - 1 + dir; i >= 0 && i < S.rows.length; i += dir) { const r = S.rows[i]; if (r && !r.unk && bad.includes(r.c) && i !== S.idx - 1) return env.jump(i + 1); } A.toast(dir > 0 ? 'No more key moments ahead.' : 'No earlier key moments.'); }
      function panel(d) {
        d.innerHTML = '<div class="acmsg"><div class="row" style="gap:6px;flex-wrap:wrap;align-items:center"><b>🔎 Move review</b><span class="sp"></span><button class="ib" id="rvp" title="Previous key moment">◀ key moment</button><button class="ib" id="rvn" title="Next key moment">key moment ▶</button></div><div id="rvg" style="margin-top:10px"></div><div id="rvc" style="margin-top:8px;line-height:1.6"></div></div>'; d.querySelector('#rvp').onclick = () => critical(-1); d.querySelector('#rvn').onclick = () => critical(1); d.querySelector('#rvg').onclick = e => { const p = e.target.closest('[data-ply]'); if (p) env.jump(+p.dataset.ply); }; paintReview();
      }
      function paintGraph(S) {
        const box = env.q('rvg'); if (!box) return;
        if (window.ChessSet && ChessSet.experience() === 'legacy') { box.innerHTML = ''; return; }
        const rows = S.rows || []; if (!S.game || !rows.length) { box.innerHTML = ''; return; }
        const W = 520, H = 72, pad = 8, vals = rows.map(r => Math.max(-900, Math.min(900, Number(r.e) || 0))), x = i => pad + i * (W - pad * 2) / Math.max(1, vals.length - 1), y = v => H / 2 - v / 900 * (H / 2 - pad);
        const points = vals.map((v, i) => x(i).toFixed(1) + ',' + y(v).toFixed(1)).join(' '), cur = Math.max(0, Math.min(vals.length - 1, (S.idx || 0) - 1));
        box.innerHTML = '<div class="small mute" style="margin-bottom:3px">Position evaluation · select a point to jump to that move</div><svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Game evaluation graph" style="display:block;width:100%;max-width:520px;height:auto;background:var(--panel2);border-radius:8px;touch-action:manipulation"><path d="M' + pad + ' ' + (H / 2) + 'H' + (W - pad) + '" stroke="var(--line)" stroke-width="1"/><polyline points="' + points + '" fill="none" stroke="var(--acc)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>' + vals.map((v, i) => '<circle data-ply="' + (i + 1) + '" cx="' + x(i).toFixed(1) + '" cy="' + y(v).toFixed(1) + '" r="' + (i === cur ? 5 : 3.5) + '" fill="' + (i === cur ? 'var(--acc)' : 'var(--text)') + '" opacity="' + (i === cur ? 1 : .65) + '" style="cursor:pointer"/>').join('') + '</svg>';
      }
      async function paintReview() {
        const box = env.q('rvc'); if (!box) return; const S = env.state(), my = ++revTok; paintGraph(S); if (!S.game) { box.innerHTML = '<span class="mute">Load a game in the Games tab.</span>'; return; }
        if (S.explore) { box.innerHTML = '<span class="mute">You are exploring a side line. Press "Back to the game" to see the review for the game move.</span>'; return; }
        if (S.idx === 0) return story(box);
        const i = S.idx - 1, fen0 = S.fens[i], fen1 = S.fens[i + 1], u = S.game.moves[i], row = S.rows && S.rows[i], san = S.sans[i], side = fen0.split(' ')[1] === 'w' ? 1 : -1, moveNo = Math.floor(i / 2) + 1;
        const desc = describe(fen0, u, i, S.sans); if (!desc) { box.innerHTML = ''; return; }
        let h = '<div style="font-size:16px"><b>' + moveNo + (side > 0 ? '. ' : '... ') + esc2(san) + '</b> <span class="small mute">played by ' + sideN(side) + '</span></div>';
        const opening = !S.game.startFen && i < 16 ? AN.opening(S.sans.slice(0, i + 1)) : null;
        if (!row || row.unk) { h += '<div class="small mute" style="margin:6px 0">Analyze the game (Moves tab) to get the engine\'s verdict, alternatives and an explanation of every move.</div>'; }
        const before = i > 0 && S.rows && S.rows[i - 1] && !S.rows[i - 1].unk ? S.rows[i - 1].e : 0, afterE = row && !row.unk ? row.e : null, info = row && !row.unk ? CI[row.c] : null;
        if (info) h += '<div style="margin:6px 0"><span style="color:' + info[2] + ';font-weight:700;font-size:15px">' + info[0] + ' ' + info[1] + '</span> <span class="small mute">· accuracy ' + row.a + '% · eval ' + fmt(before) + ' → ' + fmt(afterE) + '</span></div>';
        h += '<div class="rvs"><b>🎯 What the move does</b><div>' + esc2(cap1(desc.parts.join('; ')) + '.') + '</div></div>';
        box.innerHTML = h + '<div class="small mute" id="rvwait" style="margin-top:8px">Looking at the alternatives...</div>';
        if (!row || row.unk) return;
        let lines = null; try { lines = await AN.lines(env.getEng(), fen0, 5, 2500, 3); } catch (e) { } if (my !== revTok) return;
        const L = lines && lines.lines ? lines.lines.map(([uu, sc]) => { const p = mkBoardPos(fen0), mm = p.fromUci(uu); return mm || mm === 0 ? { uci: uu, san: p.san(mm, p.legal()), cp: sc * side } : null; }).filter(Boolean) : [];
        const pvPlayed = await pvOf(fen0, u); if (my !== revTok) return;
        // the verdict, in words
        const bestU = row.b, bestIsPlayed = bestU === u, bad = ['inaccuracy', 'mistake', 'blunder'].includes(row.c), swing = (afterE - before) * side, bestDesc = bestU && !bestIsPlayed ? describe(fen0, bestU, i, S.sans) : null, bestSan = bestDesc ? bestDesc.san : '';
        let why = '';
        if (row.c === 'book') why = 'This is a standard theory move' + (opening ? ' in the <b>' + esc2(opening.name) + '</b>' : '') + '. Players have tested it for generations, so there is nothing to criticise.';
        else if (row.c === 'brilliant') why = 'A sacrifice that works. The engine agrees it is sound even though it gives up material, because of what it creates afterwards.';
        else if (row.c === 'great') why = 'A strong, hard-to-find move. Most alternatives were clearly worse.';
        else if (row.c === 'best') why = 'This was the engine\'s top choice. ' + (swing > 30 ? 'It improves the position for ' + sideN(side) + '.' : 'It keeps everything under control.');
        else if (row.c === 'excellent' || row.c === 'good') why = 'A good, sensible move that keeps the position ' + stateOf(afterE) + '. ' + (bestU && !bestIsPlayed ? 'The engine slightly preferred <b>' + esc2(bestSan) + '</b>, but the difference is small.' : '');
        else {
          why = 'Before the move the position was <b>' + stateOf(before) + '</b>; afterwards it is <b>' + stateOf(afterE) + '</b>' + (Math.abs(swing) >= 80 ? ' (a swing of ' + (Math.abs(swing) / 100).toFixed(1) + ' pawns against ' + sideN(side) + ')' : '') + '. ';
          const reply = pvPlayed.uci[1] ? describe(fen1, pvPlayed.uci[1], i + 1, S.sans) : null;
          if (reply) { const ev = reply.tags.includes('captures') ? ' It allows <b>' + esc2(reply.san) + '</b>, which ' + reply.parts[0] + (reply.mat > 0 ? ', winning material' : '') + '.' : reply.tags.includes('check') ? ' It allows the forcing <b>' + esc2(reply.san) + '</b>.' : reply.tags.includes('fork') ? ' It allows <b>' + esc2(reply.san) + '</b>, which ' + reply.parts.find(x => /double attack/.test(x)) + '.' : ' The best reply is <b>' + esc2(reply.san) + '</b>, which ' + reply.parts[0] + '.'; why += ev; }
          if (desc.tags.includes('weakens')) why += ' The move itself ' + desc.parts.find(x => /^but leaves/.test(x)).replace(/^but /, '') + '.';
          if (bestSan) why += ' Instead, <b>' + esc2(bestSan) + '</b> ' + bestDesc.parts[0] + (bestDesc.check ? ' with check' : '') + (L[0] && L[0].uci === bestU ? ', and keeps the position <b>' + stateOf(L[0].cp) + '</b>' : '') + '.';
        }
        const altRows = L.map((l, k) => { const isP = l.uci === u, dd = k === 0 ? null : describe(fen0, l.uci, i, S.sans); return '<div class="rvl2" data-k="' + k + '" style="padding:5px 0;border-bottom:1px solid var(--line);cursor:pointer"><b style="color:' + (l.cp > 30 ? 'var(--ok)' : l.cp < -30 ? 'var(--bad)' : 'var(--text)') + '">' + fmt(l.cp) + '</b> <b>' + esc2(l.san) + '</b>' + (isP ? ' <span class="badge">played</span>' : '') + '<div class="small mute">' + esc2((k === 0 ? describe(fen0, l.uci, i, S.sans) : dd).parts.slice(0, 2).join('; ')) + '</div></div>'; }).join('');
        // what is going on after the move
        const posAfter = mkBoardPos(fen1), th = ChessLive.threats(posAfter, side), thO = ChessLive.threats(posAfter, -side), notes = [];
        if (posAfter.inCheck()) notes.push('The king is in check.'); if (th.mine.length) notes.push('📌 ' + sideN(side) + '\'s ' + NAME[th.mine[0].t] + ' on ' + sqn(th.mine[0].s) + (th.mine[0].undefended ? ' is attacked and unprotected.' : ' can be won by a cheaper piece.')); if (thO.mine.length) notes.push('📌 ' + sideN(-side) + '\'s ' + NAME[thO.mine[0].t] + ' on ' + sqn(thO.mine[0].s) + (thO.mine[0].undefended ? ' is attacked and unprotected.' : ' can be won by a cheaper piece.'));
        const phase = i < 20 ? 'opening' : (g => { const m = G() && G().material(posAfter); return m && m.nw <= 13 && m.nb <= 13 ? 'endgame' : 'middlegame'; })(), plan = { opening: 'In the opening the priorities are development, a share of the centre and getting the king safe.', middlegame: 'In the middlegame look for active piece placement, weaknesses in the enemy camp and the safety of both kings.', endgame: 'In the endgame activate the king, create or stop a passed pawn and count pawn races.' }[phase];
        const wait = box.querySelector('#rvwait'); if (wait) wait.remove();
        box.insertAdjacentHTML('beforeend', '<div class="rvs" style="margin-top:8px"><b>' + (bad ? '⚠️ Why it is a problem' : '✅ Why it works') + '</b><div>' + why + '</div></div>' +
          (L.length ? '<div class="rvs" style="margin-top:8px"><b>🔀 What else could be played</b><div>' + altRows + '</div><div class="small mute" style="margin-top:4px">Click a line to see it on the board.</div></div>' : '') +
          '<div class="rvs" style="margin-top:8px"><b>👀 What the move changes</b><div class="small">' + (notes.join('<br>') || 'No immediate tactical threats on either side.') + '</div><div class="small mute" style="margin-top:4px">' + esc2(plan) + '</div></div>' +
          '<div class="row" style="gap:6px;margin-top:10px;flex-wrap:wrap"><button class="ib" id="rvai">✨ Explain in words</button>' + (bestU && !bestIsPlayed ? '<button class="ib" id="rvbest">Show the better line</button>' : '') + '<button class="ib" id="rvmine">Show what happens after my move</button></div><div id="rvai1" style="margin-top:8px;white-space:pre-wrap;line-height:1.6"></div>');
        box.querySelector('.rvs:nth-of-type(2)');
        box.onclick = e => { const k = e.target.closest('.rvl2'); if (k) { const l = L[+k.dataset.k]; pvOf(fen0, l.uci).then(pv => { env.exploreFrom(i, pv.uci); }); } };
        const bb = box.querySelector('#rvbest'); if (bb) bb.onclick = async () => { const pv = await pvOf(fen0, bestU); env.exploreFrom(i, pv.uci); };
        box.querySelector('#rvmine').onclick = () => env.exploreFrom(i, pvPlayed.uci);
        box.querySelector('#rvai').onclick = async () => {
          const out = box.querySelector('#rvai1'); out.textContent = 'Thinking...'; const facts = 'Move ' + moveNo + (side > 0 ? '. ' : '... ') + san + ' by ' + sideN(side) + '. What it does: ' + desc.parts.join('; ') + '. Engine verdict: ' + (info ? info[1] : 'unknown') + (opening ? ' (' + opening.name + ')' : '') + '. Eval before ' + fmt(before) + ', after ' + fmt(afterE) + '. ' + (bestSan ? 'Engine preferred ' + bestSan + (bestDesc ? ' which ' + bestDesc.parts[0] : '') + '. ' : '') + 'Top engine lines: ' + L.map(l => l.san + ' ' + fmt(l.cp)).join(', ') + '. After the move the engine expects: ' + lineText(fen0, pvPlayed.san) + '.';
          try { await A.ai.stream([{ role: 'system', content: 'You are a warm chess coach reviewing one move for a club player. Using ONLY the facts given, write 4 to 6 sentences: the probable idea behind the move, why it is good or bad, what the opponent can do about it, and what to look for next time. Use SAN moves, no markdown, do not invent variations beyond the lines given.' }, { role: 'user', content: 'Position FEN before the move: ' + fen0 + '\n' + facts }], t => { out.textContent = t; }, null, { temp: .4 }); } catch (e) { out.textContent = 'The AI engine did not answer.'; }
        };
      }
      function story(box) {
        const S = env.state(); if (!S.rows || !S.summary) { box.innerHTML = '<span class="mute">Analyze the game in the Moves tab to get a story of it: how the opening went, who was better when, and the turning points.</span><div class="small mute" style="margin-top:6px">Press ▶ to step through moves; the Review tab explains each one.</div>'; return; }
        const sm = S.summary, g = S.game, op = AN.opening(S.sans.slice(0, 14)), mom = (sm.moments || []).slice(0, 5); let h = '<div><b>📖 The story of the game</b></div><div style="margin:6px 0">' + esc2((g.white || 'White') + ' vs ' + (g.black || 'Black')) + (op ? ' · <b>' + esc2(op.name) + '</b>' : '') + (g.result && g.result !== '*' ? ' · ' + esc2(g.result) : '') + '</div>';
        h += '<div class="small">Accuracy: White <b>' + (sm.w && sm.w.acc) + '%</b>, Black <b>' + (sm.b && sm.b.acc) + '%</b>.</div>';
        if (mom.length) h += '<div style="margin-top:8px"><b>Turning points</b></div>' + mom.map(i => { const r = S.rows[i], before = i > 0 && S.rows[i - 1] && !S.rows[i - 1].unk ? S.rows[i - 1].e : 0, mover = i % 2 === 0 ? 1 : -1, inf = CI[r.c] || CI.good; return '<div class="rvm" data-i="' + (i + 1) + '" style="padding:6px 0;border-bottom:1px solid var(--line);cursor:pointer"><b>' + (Math.floor(i / 2) + 1) + (mover > 0 ? '. ' : '... ') + esc2(S.sans[i]) + '</b> <span style="color:' + inf[2] + '">' + inf[0] + ' ' + inf[1] + '</span><div class="small mute">' + sideN(mover) + ' ' + (['blunder', 'mistake', 'inaccuracy'].includes(r.c) ? 'let the position slip from ' : 'moved the position from ') + stateOf(before) + ' to ' + stateOf(r.e) + ' (' + fmt(before) + ' → ' + fmt(r.e) + ').</div></div>'; }).join('');
        else h += '<div class="small mute" style="margin-top:8px">No big swings: a steady game.</div>';
        h += '<div class="small mute" style="margin-top:8px">Click a turning point to jump to it, then read the move-by-move review here.</div>'; box.innerHTML = h; box.onclick = e => { const m = e.target.closest('.rvm'); if (m) env.jump(+m.dataset.i); };
      }
      function onRefresh() { const fen = env.curFen(); if (fen !== lastFen) { lastFen = fen; userLine = null; userCount = 0; const c = env.q('anuser'); if (c) c.innerHTML = ''; } bindToggles(); paint(); if (arrowsOn && env.tab() !== 'engine') env.engineWant(); if (env.tab() === 'review') paintReview(); }
      return { paint, onRefresh, onEngine, paintLines, panel, paintReview, bindToggles };
    }
  };
})();

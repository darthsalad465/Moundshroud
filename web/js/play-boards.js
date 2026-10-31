// Entertainment > classic board games against the computer: Go (9x9, area scoring, 6.5 komi), Mancala (Kalah, alpha-beta search) and Gomoku (five in a row on 15x15).
(() => {
  const P = A.play; if (!P) return; const rnd = n => Math.random() * n | 0;
  /* ================= GO 9x9 ================= */
  P.games.go = { name: 'Go 9×9', icon: '⚪', desc: 'The ancient game of territory on a 9×9 board. Surround stones to capture them, claim more area than the computer (White gets 6.5 komi). You play Black.', mount(el, api) {
    const N = 9, Z = 46, M = 28, NB = []; for (let i = 0; i < N * N; i++) { const x = i % N, y = i / N | 0, a = []; if (x > 0) a.push(i - 1); if (x < N - 1) a.push(i + 1); if (y > 0) a.push(i - N); if (y < N - 1) a.push(i + N); NB.push(a); }
    let B, prev, turn, passes, caps, over, cv, cx, dead = false, think = false, lastMove = -1, msg = '';
    const group = (b, i) => { const c = b[i], st = [i], seen = new Set([i]), lib = new Set(); while (st.length) { const k = st.pop(); for (const n of NB[k]) { if (b[n] === 0) lib.add(n); else if (b[n] === c && !seen.has(n)) { seen.add(n); st.push(n); } } } return { s: [...seen], l: lib.size }; };
    const play = (b, i, c) => { if (b[i]) return null; const nb = b.slice(); nb[i] = c; let cap = 0; for (const n of NB[i]) if (nb[n] === 3 - c) { const g = group(nb, n); if (!g.l) { g.s.forEach(s => nb[s] = 0); cap += g.s.length; } } if (!group(nb, i).l) return null; return { b: nb, cap }; };
    const score = b => { let bl = 0, wh = 0; const seen = new Set(); for (let i = 0; i < N * N; i++) { if (b[i] === 1) bl++; else if (b[i] === 2) wh++; else if (!seen.has(i)) { const reg = [i], st = [i]; seen.add(i); const bord = new Set(); while (st.length) { const k = st.pop(); for (const n of NB[k]) { if (b[n] === 0) { if (!seen.has(n)) { seen.add(n); st.push(n); reg.push(n); } } else bord.add(b[n]); } } if (bord.size === 1) { if (bord.has(1)) bl += reg.length; else wh += reg.length; } } } return { bl, wh: wh + 6.5 }; };
    const eyeOf = (b, i, c) => NB[i].every(n => b[n] === c);
    const playout = (b0, c0, koB) => { let b = b0.slice(), c = c0, pass = 0, n = 0; while (pass < 2 && n++ < 110) { const em = []; for (let i = 0; i < N * N; i++) if (!b[i] && !eyeOf(b, i, c)) em.push(i); let moved = false; for (let t = 0; t < 8 && em.length; t++) { const k = rnd(em.length), i = em[k]; const r = play(b, i, c); if (r) { b = r.b; moved = true; break; } em.splice(k, 1); } if (!moved) pass++; else pass = 0; c = 3 - c; } const s = score(b); return s.wh > s.bl; };
    const aiMove = () => {
      const cand = []; const any = B.some(v => v); for (let i = 0; i < N * N; i++) { if (B[i]) continue; if (any) { const x = i % N, y = i / N | 0; let near = false; for (let j = 0; j < N * N && !near; j++) if (B[j] && Math.abs((j % N) - x) <= 2 && Math.abs((j / N | 0) - y) <= 2) near = true; if (!near) continue; } const r = play(B, i, 2); if (!r || (prev && r.b.join('') === prev)) continue; if (eyeOf(B, i, 2) && r.cap === 0) continue; cand.push({ i, r }); }
      if (!cand.length) return null; let best = null, bw = -1; const sims = Math.max(2, Math.round((cand.length > 40 ? 14 : 22) * [.25, 1, 1.8][api.level])); for (const c of cand) { let w = 0; for (let k = 0; k < sims; k++) if (playout(c.r.b, 1)) w++; const x = c.i % N, y = c.i / N | 0, edge = Math.min(x, y, N - 1 - x, N - 1 - y); const sc = w / sims + c.r.cap * .03 + (edge === 0 ? -.05 : 0) + Math.random() * .02; if (sc > bw) { bw = sc; best = c; } } return { c: best, wr: bw };
    };
    const draw = () => {
      if (dead) return; cx.fillStyle = '#d9b26b'; cx.fillRect(0, 0, cv.width, cv.height); cx.strokeStyle = '#4b3a1a'; cx.lineWidth = 1; for (let i = 0; i < N; i++) { cx.beginPath(); cx.moveTo(M + i * Z, M); cx.lineTo(M + i * Z, M + (N - 1) * Z); cx.moveTo(M, M + i * Z); cx.lineTo(M + (N - 1) * Z, M + i * Z); cx.stroke(); } cx.fillStyle = '#4b3a1a'; for (const [x, y] of [[2, 2], [6, 2], [4, 4], [2, 6], [6, 6]]) { cx.beginPath(); cx.arc(M + x * Z, M + y * Z, 3, 0, 7); cx.fill(); }
      for (let i = 0; i < N * N; i++) if (B[i]) { const x = M + (i % N) * Z, y = M + (i / N | 0) * Z; cx.beginPath(); cx.arc(x, y, Z * .45, 0, 7); cx.fillStyle = B[i] === 1 ? '#111' : '#f4f4f4'; cx.fill(); cx.strokeStyle = '#000'; cx.stroke(); if (i === lastMove) { cx.fillStyle = B[i] === 1 ? '#fff' : '#c00'; cx.beginPath(); cx.arc(x, y, 5, 0, 7); cx.fill(); } }
      const s = score(B); el.querySelector('#gst').innerHTML = (over ? '<b>Game over.</b> ' : think ? 'The computer is thinking... ' : 'Your move (Black). ') + 'Area: Black <b>' + s.bl + '</b> vs White <b>' + s.wh + '</b> (incl. 6.5 komi) · captured: you ' + caps[1] + ', computer ' + caps[2] + ' ' + msg; api.hud('Black ' + s.bl + ' · White ' + s.wh);
    };
    const finish = () => { over = true; const s = score(B), win = s.bl > s.wh; msg = win ? 'You win by ' + (s.bl - s.wh) + '!' : 'The computer wins by ' + (s.wh - s.bl) + '.'; api.submit(Math.max(0, Math.round((s.bl - s.wh) * 10))); draw(); };
    const aiTurn = () => { think = true; draw(); setTimeout(() => { if (dead) return; const m = aiMove(); think = false; if (!m || (m.wr < .08 && passes >= 1)) { passes++; msg = 'The computer passes.'; if (passes >= 2) return finish(); turn = 1; return draw(); } const r = play(B, m.c.i, 2); prev = B.join(''); B = r.b; caps[2] += r.cap; lastMove = m.c.i; passes = 0; msg = ''; turn = 1; draw(); }, 40); };
    const reset = () => { B = Array(N * N).fill(0); prev = null; turn = 1; passes = 0; caps = { 1: 0, 2: 0 }; over = false; think = false; lastMove = -1; msg = ''; draw(); };
    el.innerHTML = '<div><div id="gst" class="small" style="min-height:40px;max-width:' + (N * Z + 2 * M - 40) + 'px"></div><canvas id="gcv" width="' + ((N - 1) * Z + 2 * M) + '" height="' + ((N - 1) * Z + 2 * M) + '" style="border-radius:10px;max-width:100%;height:auto;cursor:pointer"></canvas><div class="row" style="gap:8px;margin-top:8px"><button class="ib" id="gps">Pass</button><button class="ib" id="gnw">New game</button></div><div class="small mute" style="margin-top:6px">Capture stones by filling every neighbouring empty point. You cannot play a suicide move or immediately retake a ko. The game ends when both players pass.</div></div>';
    cv = el.querySelector('#gcv'); cx = cv.getContext('2d');
    cv.onclick = e => { if (over || think || turn !== 1) return; const r = cv.getBoundingClientRect(), sc = cv.width / r.width, x = Math.round(((e.clientX - r.left) * sc - M) / Z), y = Math.round(((e.clientY - r.top) * sc - M) / Z); if (x < 0 || y < 0 || x >= N || y >= N) return; const i = y * N + x, m = play(B, i, 1); if (!m) { msg = 'Illegal move.'; return draw(); } if (prev && m.b.join('') === prev) { msg = 'That would be a ko: play elsewhere first.'; return draw(); } prev = B.join(''); B = m.b; caps[1] += m.cap; lastMove = i; passes = 0; msg = ''; turn = 2; aiTurn(); };
    el.querySelector('#gps').onclick = () => { if (over || think || turn !== 1) return; passes++; msg = 'You pass.'; if (passes >= 2) return finish(); turn = 2; aiTurn(); }; el.querySelector('#gnw').onclick = reset;
    reset(); return () => { dead = true; };
  } };

  /* ================= MANCALA (Kalah) ================= */
  P.games.mancala = { name: 'Mancala', icon: '🥣', desc: 'Kalah: pick up a pit and watch every bean hop into the next pits. Land your last bean in your store for an extra turn, or in an empty pit of yours to capture the beans across from it. You play the bottom row.', mount(el, api) {
    let b, turn, over, dead = false, busy = false, resetPending = false, msg = '', beans = [], cnt = [], wells = []; const SEEDS = 4;
    const PX0 = 92, PITCH = 74, ROW0 = 12, ROW1 = 86, BW = 15, BH = 10, COLS = ['#ead6ab', '#cf7b52', '#92b69d', '#dcb447', '#80a2d3', '#b887cf', '#f2e8d4'];
    const SPEED = () => { const v = ls.get('mancala_speed', 'normal'); return v === 'fast' ? 120 : v === 'off' ? 0 : 300; };
    const fresh = () => { const a = Array(14).fill(SEEDS); a[6] = 0; a[13] = 0; return a; };
    // pits: 0-5 yours (left to right), 6 your store, 7-12 computer's, 13 computer's store. Sowing goes 0..13 and wraps, skipping the opponent's store.
    const sow = (s, i, side) => { s = s.slice(); let n = s[i]; s[i] = 0; let k = i; const skip = side === 0 ? 13 : 6; while (n > 0) { k = (k + 1) % 14; if (k === skip) continue; s[k]++; n--; } const mine = side === 0 ? [0, 5] : [7, 12], store = side === 0 ? 6 : 13; let again = k === store; if (!again && k >= mine[0] && k <= mine[1] && s[k] === 1 && s[12 - k] > 0) { s[store] += s[12 - k] + 1; s[k] = 0; s[12 - k] = 0; } const e0 = s.slice(0, 6).every(v => !v), e1 = s.slice(7, 13).every(v => !v); let end = false; if (e0 || e1) { for (let j = 0; j < 6; j++) { s[6] += s[j]; s[j] = 0; s[13] += s[7 + j]; s[7 + j] = 0; } end = true; } return { s, again: again && !end, end }; };
    const moves = (s, side) => { const o = side === 0 ? 0 : 7, r = []; for (let j = 0; j < 6; j++) if (s[o + j]) r.push(o + j); return r; };
    const search = (s, side, d, al, be) => { if (d === 0) return s[13] - s[6]; const ms = moves(s, side); if (!ms.length) return s[13] - s[6]; let best = side === 1 ? -1e9 : 1e9; for (const m of ms) { const r = sow(s, m, side), nx = r.again ? side : 1 - side; const v = r.end ? r.s[13] - r.s[6] : search(r.s, nx, d - 1, al, be); if (side === 1) { best = Math.max(best, v); al = Math.max(al, v); } else { best = Math.min(best, v); be = Math.min(be, v); } if (be <= al) break; } return best; };
    const ai = () => { let bm = -1, bv = -1e9; for (const m of moves(b, 1)) { const r = sow(b, m, 1), v = r.end ? r.s[13] - r.s[6] : search(r.s, r.again ? 1 : 0, [2, 5, 8][api.level], -1e9, 1e9) + Math.random() * (api.level === 0 ? 5 : .1); if (v > bv) { bv = v; bm = m; } } return bm; };
    /* the same move as sow(), broken into what the eye sees: the beans dropped one by one, then a capture, then the end-of-game sweep */
    const plan = (s, i, side) => {
      const skip = side === 0 ? 13 : 6, store = side === 0 ? 6 : 13, mine = side === 0 ? [0, 5] : [7, 12], path = []; let n = s[i], k = i;
      while (n > 0) { k = (k + 1) % 14; if (k === skip) continue; path.push(k); n--; }
      const mid = s.slice(); mid[i] = 0; path.forEach(p => { mid[p]++; });
      const after = mid.slice(); let cap = false;
      if (k !== store && k >= mine[0] && k <= mine[1] && mid[k] === 1 && mid[12 - k] > 0) { cap = true; after[store] += mid[12 - k] + 1; after[k] = 0; after[12 - k] = 0; }
      return { path, mid, after, cap, fin: sow(s, i, side), store };
    };

    /* ---- geometry ---- */
    const centre = p => p === 6 ? [571, 81] : p === 13 ? [47, 81] : p < 6 ? [PX0 + p * PITCH + 32, ROW1 + 32] : [PX0 + (12 - p) * PITCH + 32, ROW0 + 32];
    const slot = (p, j) => {                       // where the j-th bean rests in pit p: a tidy spiral, so beans never need re-arranging
      const [cx, cy] = centre(p), a = j * 2.39996, r = 5 * Math.sqrt(j + 0.6);
      if (p === 6 || p === 13) return [cx + Math.max(-26, Math.min(26, r * Math.cos(a))), cy + Math.max(-60, Math.min(60, r * Math.sin(a) * 2.3))];
      const q = Math.min(r, 21); return [cx + q * Math.cos(a), cy + q * Math.sin(a)];
    };
    const place = (bn, x, y) => { bn.e.style.left = (x - BW / 2) + 'px'; bn.e.style.top = (y - BH / 2) + 'px'; };
    const mkBean = (host, x, y) => {
      const c = COLS[Math.floor(Math.random() * COLS.length)], deg = Math.floor(Math.random() * 180), e = document.createElement('div');
      e.style.cssText = 'position:absolute;width:' + BW + 'px;height:' + BH + 'px;border-radius:50%;pointer-events:none;z-index:3;background:radial-gradient(ellipse at 30% 28%,rgba(255,255,255,.8),' + c + ' 42%,' + c + ');box-shadow:0 1px 2px rgba(0,0,0,.55);transform:rotate(' + deg + 'deg)';
      const bn = { e, x, y }; place(bn, x, y); host.appendChild(e); return bn;
    };
    const tick = () => { try { if (A.sfx && A.sfx.on === false) return; const c = tick.c = tick.c || new (window.AudioContext || window.webkitAudioContext)(), o = c.createOscillator(), g = c.createGain(); o.type = 'triangle'; o.frequency.value = 480 + Math.random() * 120; g.gain.setValueAtTime(.05, c.currentTime); g.gain.exponentialRampToValueAtTime(.0001, c.currentTime + .09); o.connect(g); g.connect(c.destination); o.start(); o.stop(c.currentTime + .1); } catch (e) { } };
    const wait = ms => new Promise(r => setTimeout(r, ms));
    const tween = (bn, x1, y1, ms, hop) => new Promise(res => {
      const x0 = bn.x, y0 = bn.y; let done = false;
      const fin = () => { if (done) return; done = true; bn.x = x1; bn.y = y1; place(bn, x1, y1); res(); };
      if (!ms || dead) return fin();
      const t0 = performance.now();
      const step = now => { if (done) return; if (dead) return fin(); const t = Math.min(1, (now - t0) / ms); place(bn, x0 + (x1 - x0) * t, y0 + (y1 - y0) * t - hop * 4 * t * (1 - t)); if (t < 1) requestAnimationFrame(step); else fin(); };
      requestAnimationFrame(step); setTimeout(fin, ms + 250);       // never get stuck if the window is in the background
    });
    const setCnt = p => { if (cnt[p]) cnt[p].textContent = beans[p].length; };
    const moveBean = async (bn, to, ms, hop) => { bn.e.style.zIndex = 6; const [x, y] = slot(to, beans[to].length); await tween(bn, x, y, ms, hop); bn.e.style.zIndex = 3; beans[to].push(bn); setCnt(to); if (ms) tick(); };
    const reconcile = async (from, to, dest, ms) => {     // beans that left a pit (capture or end-of-game sweep) fly into a store
      for (let j = 0; j < 14; j++) { if (j === 6 || j === 13) continue; const ex = from[j] - to[j]; for (let n = 0; n < ex; n++) { const bn = beans[j].pop(); setCnt(j); if (bn) await moveBean(bn, dest(j), ms, 16); } }
    };
    const run = async (i, side) => {
      const P = plan(b, i, side), ms = SPEED(), hand = beans[i].splice(0); setCnt(i);
      const [cx, cy] = centre(i); wells[i].style.boxShadow = 'inset 0 4px 8px #000a,0 0 0 3px var(--acc)';
      await Promise.all(hand.map((bn, k) => { bn.e.style.zIndex = 6; return tween(bn, cx + (k - (hand.length - 1) / 2) * 5, cy - 36 - (k % 2) * 6, ms ? 170 : 0, 0); }));
      for (const to of P.path) { if (dead) return P; const bn = hand.shift(); await moveBean(bn, to, ms * 0.9, 26); }
      wells[i].style.boxShadow = '';
      if (P.cap) { msg = side === 0 ? 'Capture!' : 'The computer captured your beans.'; status(); if (ms) await wait(ms * 1.1); await reconcile(P.mid, P.after, () => P.store, ms * 0.6); }
      if (P.fin.end) { if (ms) await wait(ms); await reconcile(P.after, P.fin.s, j => j < 6 ? 6 : 13, ms * 0.45); }
      return P;
    };

    /* ---- building and showing the board ---- */
    const mkWells = host => {
      for (let p = 0; p < 14; p++) {
        const st = p === 6 || p === 13, [cx, cy] = centre(p), d = document.createElement('div'), w = st ? 70 : 64, h = st ? 138 : 64;
        d.style.cssText = 'position:absolute;left:' + (cx - w / 2) + 'px;top:' + (cy - h / 2) + 'px;width:' + w + 'px;height:' + h + 'px;border-radius:' + (st ? '35px' : '50%') + ';background:radial-gradient(' + (st ? 'ellipse' : 'circle') + ' at 50% 38%,#24160a 0,#3b2512 62%,#52351b 100%);box-shadow:inset 0 4px 8px #000a;z-index:1;' + (st && p === 6 ? 'border:2px solid var(--acc);box-sizing:border-box;' : '');
        const c = document.createElement('div'); c.style.cssText = 'position:absolute;left:0;right:0;text-align:center;font-weight:700;pointer-events:none;z-index:8;color:#fff;text-shadow:0 1px 2px #000;' + (st ? 'top:4px;font-size:20px' : 'bottom:1px;font-size:11px;opacity:.78');
        d.appendChild(c); cnt[p] = c; wells[p] = d; host.appendChild(d); if (p < 6) d.onclick = () => human(p);
      }
    };
    const build = () => {
      const host = el.querySelector('#mbd'); host.innerHTML = ''; beans = Array.from({ length: 14 }, () => []); mkWells(host);
      for (let p = 0; p < 14; p++) { for (let k = 0; k < b[p]; k++) { const [x, y] = slot(p, k), bn = mkBean(host, x, y); beans[p].push(bn); } setCnt(p); }
    };
    const synced = () => b.every((v, p) => beans[p].length === v);
    const status = () => {
      if (dead) return; const m = el.querySelector('#mmsg'); if (!m) return;
      m.innerHTML = over ? '<b>' + (b[6] > b[13] ? 'You win ' : b[6] < b[13] ? 'The computer wins ' : 'Draw ') + b[6] + ' - ' + b[13] + '</b>' : busy ? (turn === 0 ? 'Sowing...' : 'The computer is playing...') + ' ' + msg : turn === 0 ? 'Your move: pick one of your pits (bottom row). ' + msg : 'The computer is thinking...';
      for (let p = 0; p < 6; p++) { const on = turn === 0 && !over && !busy && b[p]; wells[p].style.cursor = on ? 'pointer' : 'default'; wells[p].style.outline = on ? '2px solid rgba(139,124,255,.75)' : 'none'; wells[p].style.opacity = b[p] || !on ? 1 : .75; }
      api.hud('You ' + b[6] + ' · Computer ' + b[13]);
    };
    const finish = () => { over = true; api.submit(Math.max(0, b[6] - b[13] + 48)); };
    const settle = r => { b = r.s; if (!synced()) build(); busy = false; };
    const human = async i => {
      if (busy || turn !== 0 || over || i > 5 || !b[i]) return; busy = true; msg = ''; status();
      const r = sow(b, i, 0); await run(i, 0); if (dead) return; settle(r);
      if (resetPending) return reset();
      if (r.end) { finish(); return status(); } if (r.again) { msg = 'Extra turn!'; return status(); }
      turn = 1; msg = ''; status(); setTimeout(compTurn, 350);
    };
    const compTurn = async () => {
      if (dead || over) return; const m = ai(); if (m < 0) { finish(); return status(); }
      busy = true; msg = ''; status(); const r = sow(b, m, 1); await run(m, 1); if (dead) return; settle(r);
      if (resetPending) return reset();
      if (r.end) { finish(); return status(); }
      if (r.again) { msg = 'The computer gets an extra turn.'; status(); return setTimeout(compTurn, 500); }
      turn = 0; msg = ''; status();
    };
    const reset = () => { resetPending = false; b = fresh(); turn = 0; over = false; busy = false; msg = ''; build(); status(); };
    el.innerHTML = '<div style="display:inline-block;max-width:100%"><div class="small" id="mmsg" style="margin-bottom:8px;min-height:22px"></div><div style="overflow:auto;max-width:100%;padding-bottom:2px"><div id="mbd" style="position:relative;width:618px;height:174px;border-radius:18px;background:linear-gradient(135deg,#8a5d33,#6b4524 55%,#7a5129);border:2px solid #3b2a18;box-shadow:inset 0 2px 8px #0006,0 6px 18px #0005;box-sizing:content-box"></div></div>' +
      '<div class="row" style="gap:8px;margin-top:8px;flex-wrap:wrap;align-items:center"><button class="ib" id="mnew">New game</button><span class="small mute">Bean speed</span><select class="ib" id="mspd"><option value="normal">Normal</option><option value="fast">Fast</option><option value="off">Instant</option></select></div>' +
      '<div class="small mute" style="margin-top:6px">Beans go counter-clockwise. Last bean in your store (right) = another turn. Last bean in an empty pit of yours captures the beans opposite.</div></div>';
    el.querySelector('#mnew').onclick = () => { if (busy) { resetPending = true; A.toast('New game starts when the beans stop.'); } else reset(); };
    const sp = el.querySelector('#mspd'); sp.value = ls.get('mancala_speed', 'normal'); sp.onchange = () => ls.set('mancala_speed', sp.value);
    reset(); return () => { dead = true; };
  } };

  /* ================= GOMOKU ================= */
  P.games.gomoku = { name: 'Gomoku', icon: '⚫', desc: 'Five in a row on a 15×15 board. Make an unbroken line of five stones in any direction before the computer does. You play Black and move first.', mount(el, api) {
    const N = 15, Z = 34, M = 22; let B, over, turn, cv, cx, dead = false, last = -1, msg = '', win = [];
    const DIRS = [[1, 0], [0, 1], [1, 1], [1, -1]];
    const line = (b, x, y, c) => { for (const [dx, dy] of DIRS) { const out = [[x, y]]; for (const s of [1, -1]) { let k = 1; for (; ;) { const nx = x + dx * k * s, ny = y + dy * k * s; if (nx < 0 || ny < 0 || nx >= N || ny >= N || b[ny * N + nx] !== c) break; out.push([nx, ny]); k++; } } if (out.length >= 5) return out; } return null; };
    const pat = (b, x, y, c) => { let tot = 0; for (const [dx, dy] of DIRS) { let n = 1, open = 0; for (const s of [1, -1]) { let k = 1; while (true) { const nx = x + dx * k * s, ny = y + dy * k * s; if (nx < 0 || ny < 0 || nx >= N || ny >= N) break; const v = b[ny * N + nx]; if (v === c) { n++; k++; continue; } if (v === 0) open++; break; } } tot += n >= 5 ? 100000 : n === 4 ? (open === 2 ? 10000 : open === 1 ? 1500 : 0) : n === 3 ? (open === 2 ? 1200 : open === 1 ? 120 : 0) : n === 2 ? (open === 2 ? 100 : open === 1 ? 12 : 0) : open ? 2 : 0; } return tot; };
    const aiG = () => { let best = [], bs = -1; const any = B.some(v => v); if (!any) return 7 * N + 7; const lv = api.level, cands = []; for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { if (B[y * N + x]) continue; let near = false; for (let j = -2; j <= 2 && !near; j++) for (let i = -2; i <= 2; i++) { const nx = x + i, ny = y + j; if (nx >= 0 && ny >= 0 && nx < N && ny < N && B[ny * N + nx]) { near = true; break; } } if (!near) continue; const idx = y * N + x, att = pat(B, x, y, 2), def = pat(B, x, y, 1); let s = att * (lv === 0 ? .8 : 1.1) + def * (lv === 0 ? .55 : lv === 2 ? 1.05 : 1) + (7 - Math.abs(x - 7) * .3 - Math.abs(y - 7) * .3); if (lv === 0) s *= .55 + Math.random() * .9; cands.push({ idx, s, x, y }); }
      cands.sort((a, b) => b.s - a.s); if (lv === 2) { let bb = -1e18, pick = []; for (const c of cands.slice(0, 8)) { B[c.idx] = 2; let opp = 0; for (const o of cands.slice(0, 14)) { if (o.idx === c.idx || B[o.idx]) continue; opp = Math.max(opp, pat(B, o.x, o.y, 1)); } B[c.idx] = 0; const v = c.s - opp * .45; if (v > bb) { bb = v; pick = [c.idx]; } else if (v === bb) pick.push(c.idx); } return pick[rnd(pick.length)]; }
      bs = cands.length ? cands[0].s : -1; best = cands.filter(c => c.s === bs).map(c => c.idx); return best[rnd(best.length)]; };
    const ai = aiG;
    const draw = () => {
      if (dead) return; cx.fillStyle = '#d9b26b'; cx.fillRect(0, 0, cv.width, cv.height); cx.strokeStyle = '#4b3a1a'; for (let i = 0; i < N; i++) { cx.beginPath(); cx.moveTo(M + i * Z, M); cx.lineTo(M + i * Z, M + (N - 1) * Z); cx.moveTo(M, M + i * Z); cx.lineTo(M + (N - 1) * Z, M + i * Z); cx.stroke(); }
      for (let i = 0; i < N * N; i++) if (B[i]) { const x = M + (i % N) * Z, y = M + (i / N | 0) * Z; cx.beginPath(); cx.arc(x, y, Z * .44, 0, 7); cx.fillStyle = B[i] === 1 ? '#111' : '#f4f4f4'; cx.fill(); cx.strokeStyle = '#000'; cx.stroke(); if (i === last) { cx.fillStyle = '#e33'; cx.beginPath(); cx.arc(x, y, 4, 0, 7); cx.fill(); } }
      if (win.length) { cx.strokeStyle = '#e33'; cx.lineWidth = 4; cx.beginPath(); cx.moveTo(M + win[0][0] * Z, M + win[0][1] * Z); const e = win.reduce((a, c) => (Math.abs(c[0] - win[0][0]) + Math.abs(c[1] - win[0][1]) > Math.abs(a[0] - win[0][0]) + Math.abs(a[1] - win[0][1]) ? c : a), win[0]); cx.lineTo(M + e[0] * Z, M + e[1] * Z); cx.stroke(); cx.lineWidth = 1; }
      el.querySelector('#kst').textContent = (over ? msg : turn === 1 ? 'Your move (Black).' : 'The computer is thinking...'); api.hud(over ? msg : 'Gomoku');
    };
    const put = (i, c) => { B[i] = c; last = i; const x = i % N, y = i / N | 0, w = line(B, x, y, c); if (w) { over = true; win = w; msg = c === 1 ? 'You win! Five in a row.' : 'The computer wins this one.'; api.submit(c === 1 ? Math.max(1, 120 - B.filter(v => v === 1).length * 3) : 0); } else if (B.every(v => v)) { over = true; msg = 'Draw: the board is full.'; } };
    const reset = () => { B = Array(N * N).fill(0); over = false; turn = 1; last = -1; msg = ''; win = []; draw(); };
    el.innerHTML = '<div><div id="kst" class="small" style="min-height:22px;margin-bottom:6px"></div><canvas id="kcv" width="' + ((N - 1) * Z + 2 * M) + '" height="' + ((N - 1) * Z + 2 * M) + '" style="border-radius:10px;max-width:100%;height:auto;cursor:pointer"></canvas><div class="row" style="gap:8px;margin-top:8px"><button class="ib" id="knw">New game</button></div></div>';
    cv = el.querySelector('#kcv'); cx = cv.getContext('2d'); el.querySelector('#knw').onclick = reset;
    cv.onclick = e => { if (over || turn !== 1) return; const r = cv.getBoundingClientRect(), sc = cv.width / r.width, x = Math.round(((e.clientX - r.left) * sc - M) / Z), y = Math.round(((e.clientY - r.top) * sc - M) / Z); if (x < 0 || y < 0 || x >= N || y >= N || B[y * N + x]) return; put(y * N + x, 1); if (over) return draw(); turn = 2; draw(); setTimeout(() => { if (dead) return; put(ai(), 2); turn = 1; draw(); }, 250); };
    reset(); return () => { dead = true; };
  } };
})();

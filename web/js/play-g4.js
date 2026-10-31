// Entertainment games, batch 4: Pong, Flap, Sliding Puzzle, Lights Out, Simon, Whack-a-Mole, Reaction Timer, Typing Test.
(() => {
  const P = A.play, L = P.logic = P.logic || {};
  const reg = (id, name, icon, desc, mount) => { P.games[id] = { name, icon, desc, mount }; };
  const pill = (id, t) => '<button class="ib" id="' + id + '">' + t + '</button>';
  const rnd = n => Math.random() * n | 0;
  const CSS = id => getComputedStyle(document.documentElement).getPropertyValue(id).trim() || '#888';
  const keysOn = (fn) => { const h = e => { if (A.cur !== 'play' || /INPUT|TEXTAREA|SELECT/.test((e.target || {}).tagName || '')) return; fn(e); }; document.addEventListener('keydown', h); return () => document.removeEventListener('keydown', h); };

  /* ================= PONG ================= */
  reg('pong', 'Pong', '🏓', 'First to 7 wins. Move with the mouse, or W/S and the arrow keys.', (el, api) => {
    const W = 480, H = 300; el.innerHTML = '<div class="row" style="gap:8px;margin-bottom:8px"><label class="small mute">Level <select id="pl"><option value="3">Easy</option><option value="4.5" selected>Medium</option><option value="6.5">Hard</option></select></label>' + pill('pn', 'New match') + '</div><canvas id="pc" width="' + W + '" height="' + H + '" style="border:1px solid var(--line);border-radius:12px;background:var(--panel);max-width:100%;touch-action:none;cursor:none"></canvas>';
    const cv = $('pc'), cx = cv.getContext('2d'); let me, ai, ball, sc, over, raf, up = 0, dn = 0, serve;
    const reset = () => { me = H / 2 - 30; ai = H / 2 - 30; sc = [0, 0]; over = false; spawn(1); };
    const spawn = d => { ball = { x: W / 2, y: H / 2, vx: 4 * d, vy: (Math.random() * 4 - 2) }; serve = 40; };
    const frame = () => {
      if (!over) {
        if (up) me -= 6; if (dn) me += 6; me = Math.max(0, Math.min(H - 60, me)); const sp = +$('pl').value; const tgt = ball.y - 30; ai += Math.max(-sp, Math.min(sp, tgt - ai)) * (ball.vx > 0 ? 1 : .4); ai = Math.max(0, Math.min(H - 60, ai));
        if (serve > 0) serve--; else { ball.x += ball.vx; ball.y += ball.vy; }
        if (ball.y < 6 || ball.y > H - 6) ball.vy *= -1;
        if (ball.vx < 0 && ball.x < 24 && ball.x > 10 && ball.y > me - 4 && ball.y < me + 64) { const o = (ball.y - (me + 30)) / 30; ball.vx = Math.min(10, Math.abs(ball.vx) * 1.06); ball.vy = o * 5; }
        if (ball.vx > 0 && ball.x > W - 24 && ball.x < W - 10 && ball.y > ai - 4 && ball.y < ai + 64) { const o = (ball.y - (ai + 30)) / 30; ball.vx = -Math.min(10, Math.abs(ball.vx) * 1.06); ball.vy = o * 5; }
        if (ball.x < -10) { sc[1]++; spawn(1); } else if (ball.x > W + 10) { sc[0]++; spawn(-1); }
        api.hud(sc[0] + ' : ' + sc[1]); if (sc[0] >= 7 || sc[1] >= 7) { over = true; if (sc[0] > sc[1]) api.submit(sc[0] - sc[1]); }
      }
      cx.fillStyle = CSS('--panel'); cx.fillRect(0, 0, W, H); cx.strokeStyle = 'rgba(255,255,255,.15)'; cx.setLineDash([6, 8]); cx.beginPath(); cx.moveTo(W / 2, 0); cx.lineTo(W / 2, H); cx.stroke(); cx.setLineDash([]);
      cx.fillStyle = CSS('--acc'); cx.beginPath(); cx.roundRect(10, me, 8, 60, 4); cx.fill(); cx.fillStyle = CSS('--acc2'); cx.beginPath(); cx.roundRect(W - 18, ai, 8, 60, 4); cx.fill(); cx.fillStyle = '#fff'; cx.beginPath(); cx.arc(ball.x, ball.y, 6, 0, 7); cx.fill();
      cx.fillStyle = 'rgba(255,255,255,.5)'; cx.font = '700 30px Segoe UI'; cx.textAlign = 'center'; cx.fillText(sc[0], W / 2 - 40, 38); cx.fillText(sc[1], W / 2 + 40, 38);
      if (over) { cx.fillStyle = 'rgba(8,10,16,.7)'; cx.fillRect(0, 0, W, H); cx.fillStyle = '#fff'; cx.font = '600 24px Segoe UI'; cx.fillText(sc[0] > sc[1] ? 'You win!' : 'Moundshroud wins', W / 2, H / 2 - 4); cx.font = '14px Segoe UI'; cx.fillText('Click "New match" to play again', W / 2, H / 2 + 22); }
      raf = requestAnimationFrame(frame);
    };
    cv.addEventListener('mousemove', e => { const r = cv.getBoundingClientRect(); me = Math.max(0, Math.min(H - 60, (e.clientY - r.top) * (H / r.height) - 30)); });
    const off = keysOn(e => { if (e.key === 'ArrowUp' || e.key === 'w') up = 1; if (e.key === 'ArrowDown' || e.key === 's') dn = 1; }); const ku = e => { if (e.key === 'ArrowUp' || e.key === 'w') up = 0; if (e.key === 'ArrowDown' || e.key === 's') dn = 0; }; document.addEventListener('keyup', ku);
    $('pn').onclick = reset; reset(); frame(); return () => { cancelAnimationFrame(raf); off(); document.removeEventListener('keyup', ku); };
  });

  /* ================= FLAP ================= */
  reg('flap', 'Flap', '🐦', 'Tap, click or press Space to flap through the gaps. Do not touch the pipes!', (el, api) => {
    const W = 360, H = 480; el.innerHTML = '<canvas id="fc" width="' + W + '" height="' + H + '" style="border:1px solid var(--line);border-radius:12px;background:#4fa8e0;max-width:100%;touch-action:none"></canvas>';
    const cv = $('fc'), cx = cv.getContext('2d'); let y, vy, pipes, score, over, started, raf, t;
    const reset = () => { y = H / 2; vy = 0; pipes = []; score = 0; over = false; started = false; t = 0; api.hud('Score 0'); };
    const flap = () => { if (over) { reset(); return; } started = true; vy = -6.2; };
    const frame = () => {
      if (started && !over) { t++; vy += 0.38; y += vy; if (t % 88 === 1) pipes.push({ x: W, gap: [150, 120, 100][api.level] + rnd([70, 60, 45][api.level]), top: 60 + rnd(H - 260), scored: false }); pipes.forEach(p => { p.x -= [2.2, 2.6, 3.0][api.level]; if (!p.scored && p.x + 50 < 80) { p.scored = true; score++; api.hud('Score ' + score); } }); pipes = pipes.filter(p => p.x > -60);
        if (y > H - 20 || y < 0) over = true; for (const p of pipes) if (80 + 12 > p.x && 80 - 12 < p.x + 50 && (y - 12 < p.top || y + 12 > p.top + p.gap)) over = true; if (over) api.submit(score); }
      cx.fillStyle = '#4fa8e0'; cx.fillRect(0, 0, W, H); cx.fillStyle = 'rgba(255,255,255,.7)'; for (let i = 0; i < 4; i++) { const x = ((i * 130 - t * .5) % (W + 60)); cx.beginPath(); cx.arc(x < -40 ? x + W + 60 : x, 70 + i * 55, 22, 0, 7); cx.fill(); }
      cx.fillStyle = '#3fa65a'; pipes.forEach(p => { cx.fillRect(p.x, 0, 50, p.top); cx.fillRect(p.x, p.top + p.gap, 50, H); cx.fillStyle = '#2c8244'; cx.fillRect(p.x - 3, p.top - 14, 56, 14); cx.fillRect(p.x - 3, p.top + p.gap, 56, 14); cx.fillStyle = '#3fa65a'; });
      cx.fillStyle = '#d9b46a'; cx.fillRect(0, H - 8, W, 8); cx.save(); cx.translate(80, y); cx.rotate(Math.max(-.5, Math.min(1, vy / 10))); cx.fillStyle = '#ffd24a'; cx.beginPath(); cx.arc(0, 0, 13, 0, 7); cx.fill(); cx.fillStyle = '#fff'; cx.beginPath(); cx.arc(5, -4, 4, 0, 7); cx.fill(); cx.fillStyle = '#111'; cx.beginPath(); cx.arc(6, -4, 2, 0, 7); cx.fill(); cx.fillStyle = '#e8483f'; cx.beginPath(); cx.moveTo(10, 2); cx.lineTo(20, 5); cx.lineTo(10, 8); cx.fill(); cx.restore();
      cx.fillStyle = '#fff'; cx.font = '700 38px Segoe UI'; cx.textAlign = 'center'; cx.strokeStyle = 'rgba(0,0,0,.4)'; cx.lineWidth = 4; cx.strokeText(score, W / 2, 60); cx.fillText(score, W / 2, 60);
      if (!started) { cx.font = '600 18px Segoe UI'; cx.fillText('Tap or press Space to start', W / 2, H / 2 + 60); } if (over) { cx.fillStyle = 'rgba(0,0,0,.45)'; cx.fillRect(0, H / 2 - 50, W, 100); cx.fillStyle = '#fff'; cx.font = '600 24px Segoe UI'; cx.fillText('Game over - ' + score, W / 2, H / 2 - 4); cx.font = '14px Segoe UI'; cx.fillText('Tap to try again', W / 2, H / 2 + 24); }
      raf = requestAnimationFrame(frame);
    };
    cv.addEventListener('pointerdown', flap); const off = keysOn(e => { if (e.key === ' ' || e.key === 'ArrowUp') { e.preventDefault(); flap(); } }); reset(); frame(); return () => { cancelAnimationFrame(raf); off(); };
  });

  /* ================= SLIDING PUZZLE ================= */
  const slideSolved = t => t.every((v, i) => v === (i + 1) % 16);
  L.slideSolved = slideSolved;
  reg('slide', 'Sliding Puzzle', '🔢', 'Slide the tiles into order, 1 to 15. Fewer moves is better.', (el, api) => {
    el.innerHTML = '<div class="row" style="gap:8px;margin-bottom:8px">' + pill('sn', 'Shuffle') + '<span class="small mute" id="ss"></span></div><div id="sb" style="display:grid;grid-template-columns:repeat(4,70px);gap:6px;padding:8px;background:var(--panel2);border-radius:14px;border:1px solid var(--line)"></div>';
    let t, moves, over;
    const draw = () => { $('sb').innerHTML = t.map((v, i) => v ? '<div data-i="' + i + '" style="height:70px;border-radius:12px;background:linear-gradient(135deg,var(--acc),var(--acc2));color:var(--onacc);font:700 28px Segoe UI;display:flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 3px 8px rgba(0,0,0,.3);transition:transform .12s">' + v + '</div>' : '<div style="height:70px"></div>').join(''); api.hud('Moves ' + moves); };
    const nb = i => { const r = i >> 2, c = i & 3, o = []; if (r) o.push(i - 4); if (r < 3) o.push(i + 4); if (c) o.push(i - 1); if (c < 3) o.push(i + 1); return o; };
    const reset = () => { t = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 0]; let e = 15, prev = -1; for (let k = 0; k < 220; k++) { const o = nb(e).filter(x => x !== prev); const n = o[rnd(o.length)]; t[e] = t[n]; t[n] = 0; prev = e; e = n; } moves = 0; over = false; $('ss').textContent = ''; draw(); };
    $('sb').onclick = e => { if (over) return; const c = e.target.closest('[data-i]'); if (!c) return; const i = +c.dataset.i, z = t.indexOf(0); if (!nb(i).includes(z)) return; t[z] = t[i]; t[i] = 0; moves++; draw(); if (slideSolved(t)) { over = true; $('ss').textContent = 'Solved in ' + moves + ' moves!'; api.submit(moves, true); } };
    const off = keysOn(e => { const z = t.indexOf(0), d = { ArrowUp: 4, ArrowDown: -4, ArrowLeft: 1, ArrowRight: -1 }[e.key]; if (!d || over) return; e.preventDefault(); const i = z + d; if (i >= 0 && i < 16 && nb(z).includes(i)) { t[z] = t[i]; t[i] = 0; moves++; draw(); if (slideSolved(t)) { over = true; $('ss').textContent = 'Solved in ' + moves + ' moves!'; api.submit(moves, true); } } });
    $('sn').onclick = reset; reset(); return off;
  });

  /* ================= LIGHTS OUT ================= */
  reg('lights', 'Lights Out', '💡', 'Clicking a light flips it and its neighbours. Turn every light off.', (el, api) => {
    el.innerHTML = '<div class="row" style="gap:8px;margin-bottom:8px">' + pill('ln', 'New puzzle') + '<span class="small mute" id="ls2"></span></div><div id="lb2" style="display:grid;grid-template-columns:repeat(5,60px);gap:6px"></div>';
    let g, moves, over;
    const press = i => { const r = i / 5 | 0, c = i % 5; [i, r > 0 ? i - 5 : -1, r < 4 ? i + 5 : -1, c > 0 ? i - 1 : -1, c < 4 ? i + 1 : -1].forEach(k => { if (k >= 0) g[k] = !g[k]; }); };
    const draw = () => { $('lb2').innerHTML = g.map((v, i) => '<div data-i="' + i + '" style="height:60px;border-radius:12px;cursor:pointer;background:' + (v ? 'radial-gradient(circle at 35% 30%,#fff7c2,#ffd24a)' : 'var(--panel2)') + ';border:1px solid var(--line);box-shadow:' + (v ? '0 0 18px rgba(255,210,74,.55)' : 'none') + ';transition:all .18s"></div>').join(''); api.hud('Moves ' + moves); };
    const reset = () => { g = Array(25).fill(false); const n = 6 + rnd(8); for (let k = 0; k < n; k++) press(rnd(25)); if (!g.some(Boolean)) press(12); moves = 0; over = false; $('ls2').textContent = ''; draw(); };
    $('lb2').onclick = e => { if (over) return; const c = e.target.closest('[data-i]'); if (!c) return; press(+c.dataset.i); moves++; draw(); if (!g.some(Boolean)) { over = true; $('ls2').textContent = 'All dark in ' + moves + ' moves!'; api.submit(moves, true); } };
    $('ln').onclick = reset; reset(); return () => { };
  });

  /* ================= SIMON ================= */
  reg('simon', 'Simon', '🎵', 'Watch the pattern, then repeat it. It gets one step longer every round.', (el, api) => {
    el.innerHTML = '<div class="row" style="gap:8px;margin-bottom:8px">' + pill('sin', 'Start') + '<span class="small mute" id="sis"></span></div><div id="sip" style="display:grid;grid-template-columns:repeat(2,120px);gap:10px"></div>';
    const COL = ['#e8483f', '#4fc36b', '#4a8fe8', '#e8d23f'], FR = [330, 392, 262, 523]; let seq = [], pos = 0, accept = false, ac = null, token = 0;
    const tone = i => { try { ac = ac || new (window.AudioContext || window.webkitAudioContext)(); const o = ac.createOscillator(), g = ac.createGain(); o.frequency.value = FR[i]; o.type = 'sine'; g.gain.value = .12; o.connect(g); g.connect(ac.destination); o.start(); g.gain.exponentialRampToValueAtTime(.0001, ac.currentTime + .35); o.stop(ac.currentTime + .36); } catch (e) { } };
    const pads = () => { $('sip').innerHTML = COL.map((c, i) => '<div data-i="' + i + '" id="sp' + i + '" style="height:120px;border-radius:' + ['120px 14px 14px 14px', '14px 120px 14px 14px', '14px 14px 14px 120px', '14px 14px 120px 14px'][i] + ';background:' + c + ';opacity:.45;cursor:pointer;transition:opacity .12s,transform .12s"></div>').join(''); };
    const flash = async i => { const p = $('sp' + i); if (!p) return; p.style.opacity = 1; p.style.transform = 'scale(1.04)'; tone(i); await new Promise(r => setTimeout(r, [450, 320, 210][api.level])); p.style.opacity = .45; p.style.transform = ''; await new Promise(r => setTimeout(r, [170, 120, 70][api.level])); };
    const play = async () => { const my = ++token; accept = false; pos = 0; $('sis').textContent = 'Watch...'; await new Promise(r => setTimeout(r, 500)); for (const i of seq) { if (my !== token) return; await flash(i); } if (my !== token) return; accept = true; $('sis').textContent = 'Your turn'; };
    const start = () => { seq = [rnd(4)]; api.hud('Round 1'); play(); };
    $('sip').onclick = async e => { const p = e.target.closest('[data-i]'); if (!p || !accept) return; const i = +p.dataset.i; flash(i); if (i !== seq[pos]) { accept = false; const best = seq.length - 1; $('sis').textContent = 'Missed it! You reached round ' + seq.length + '.'; api.submit(best); seq = []; return; } pos++; if (pos === seq.length) { accept = false; seq.push(rnd(4)); api.hud('Round ' + seq.length); $('sis').textContent = 'Nice!'; setTimeout(play, 700); } };
    $('sin').onclick = start; pads(); return () => { token++; accept = false; };
  });

  /* ================= WHACK-A-MOLE ================= */
  reg('whack', 'Whack-a-Mole', '🔨', 'Hit as many moles as you can in 30 seconds.', (el, api) => {
    el.innerHTML = '<div class="row" style="gap:8px;margin-bottom:8px">' + pill('wn', 'Start') + '<span class="small mute" id="wt"></span></div><div id="wg" style="display:grid;grid-template-columns:repeat(3,96px);gap:10px"></div>';
    let hits, left, timer, mole, spawn, live = false, miss;
    const draw = () => { $('wg').innerHTML = Array.from({ length: 9 }, (_, i) => '<div data-i="' + i + '" style="height:96px;border-radius:50%;background:radial-gradient(circle at 50% 70%,#5a3b22,#3a2514);border:3px solid #2a1a0e;display:flex;align-items:center;justify-content:center;font-size:' + (mole === i ? 54 : 0) + 'px;cursor:pointer;transition:font-size .08s;overflow:hidden">' + (mole === i ? '🐹' : '') + '</div>').join(''); api.hud('Hits ' + hits + ' · ' + left + ' s'); };
    const end = () => { live = false; clearInterval(timer); clearTimeout(spawn); mole = -1; $('wt').textContent = 'Time! You hit ' + hits + ' moles (' + miss + ' misses).'; api.submit(hits); draw(); };
    const pop = () => { if (!live) return; mole = rnd(9); draw(); spawn = setTimeout(() => { mole = -1; draw(); pop(); }, [750, 450, 300][api.level] + rnd([650, 500, 350][api.level])); };
    $('wn').onclick = () => { hits = 0; miss = 0; left = 30; live = true; mole = -1; $('wt').textContent = ''; clearInterval(timer); timer = setInterval(() => { left--; if (left <= 0) end(); else draw(); }, 1000); draw(); pop(); };
    $('wg').onclick = e => { const c = e.target.closest('[data-i]'); if (!c || !live) return; if (+c.dataset.i === mole) { hits++; mole = -1; clearTimeout(spawn); draw(); spawn = setTimeout(pop, 150); } else miss++; };
    hits = 0; left = 30; mole = -1; miss = 0; draw(); return () => { live = false; clearInterval(timer); clearTimeout(spawn); };
  });

  /* ================= REACTION TIMER ================= */
  reg('reaction', 'Reaction Timer', '⚡', 'Click the moment the box turns green. How fast are you?', (el, api) => {
    el.innerHTML = '<div id="rb3" style="width:300px;height:200px;border-radius:18px;display:flex;align-items:center;justify-content:center;text-align:center;font:600 20px Segoe UI;cursor:pointer;user-select:none;background:var(--panel2);border:1px solid var(--line);transition:background .1s">Click to start</div><div class="small mute" id="rs" style="margin-top:8px"></div>';
    let state = 'idle', t0 = 0, tm, times = [];
    const box = $('rb3'), set = (bg, txt, c) => { box.style.background = bg; box.textContent = txt; box.style.color = c || '#fff'; };
    box.onclick = () => {
      if (state === 'idle' || state === 'done') { state = 'wait'; set('#c0392b', 'Wait for green...'); tm = setTimeout(() => { state = 'go'; t0 = performance.now(); set('#27ae60', 'CLICK!'); }, 1200 + rnd(2800)); }
      else if (state === 'wait') { clearTimeout(tm); state = 'done'; set('#8e44ad', 'Too soon! Click to try again.'); }
      else if (state === 'go') { const ms = Math.round(performance.now() - t0); state = 'done'; times.push(ms); const avg = Math.round(times.slice(-5).reduce((a, b) => a + b, 0) / Math.min(5, times.length)); set('#2980b9', ms + ' ms - click to go again'); $('rs').textContent = 'Last 5 average: ' + avg + ' ms · best ' + Math.min(...times) + ' ms'; api.hud(ms + ' ms'); api.submit(ms, true); }
    };
    return () => clearTimeout(tm);
  });

  /* ================= TYPING TEST ================= */
  const SENT = ['The quick brown fox jumps over the lazy dog near the river bank.', 'A calm mind and a steady hand will carry you through any long journey.', 'Small steps taken every day add up to remarkable progress over time.', 'When the lights went out the whole town gathered outside to watch the stars.', 'Good tools, clear goals and a little patience make hard work feel easy.', 'She packed a map, a compass and enough bread to last for three days.', 'Learning to play an instrument teaches you to listen as well as to practise.', 'The old bridge creaked in the wind but it had never once failed anyone.', 'Strong coffee, quiet music and an open notebook are all a writer needs.', 'Every great idea began as a small question that someone refused to ignore.'];
  L.SENT = SENT;
  reg('typing', 'Typing Test', '⌨️', 'Type the sentences as fast and accurately as you can. 45 seconds.', (el, api) => {
    el.innerHTML = '<div class="row" style="gap:8px;margin-bottom:8px">' + pill('tyn', 'Start') + '<span class="small mute" id="tys"></span></div><div id="tyt" style="max-width:560px;font:20px/1.7 Georgia,serif;padding:12px 14px;background:var(--panel);border:1px solid var(--line);border-radius:12px;min-height:70px"></div><input id="tyi" type="text" autocomplete="off" spellcheck="false" style="max-width:560px;margin-top:8px" placeholder="Press Start, then type here" disabled>';
    let text, idx, correct, typed, left, timer, live, t0;
    const render = () => { const v = $('tyi').value; $('tyt').innerHTML = [...text].map((ch, i) => '<span style="' + (i < v.length ? (v[i] === ch ? 'color:var(--ok)' : 'color:var(--bad);text-decoration:underline') : i === v.length ? 'background:var(--acc);color:var(--onacc);border-radius:3px' : 'color:var(--mute)') + '">' + (ch === ' ' ? '&nbsp;' : esc(ch)) + '</span>').join(''); };
    const wpm = () => { const mins = Math.max(0.05, (45 - left) / 60); return Math.round((correct / 5) / mins); };
    const nextS = () => { text = SENT[rnd(SENT.length)]; $('tyi').value = ''; render(); };
    const end = () => { live = false; clearInterval(timer); $('tyi').disabled = true; const w = wpm(), acc = typed ? Math.round(correct / typed * 100) : 100; $('tys').textContent = 'Finished: ' + w + ' WPM at ' + acc + '% accuracy.'; api.submit(w); api.hud(w + ' WPM'); };
    $('tyn').onclick = () => { correct = 0; typed = 0; left = 45; live = true; $('tyi').disabled = false; $('tyi').focus(); nextS(); clearInterval(timer); timer = setInterval(() => { left--; $('tys').textContent = left + ' s · ' + wpm() + ' WPM'; if (left <= 0) end(); }, 1000); $('tys').textContent = '45 s'; };
    $('tyi').oninput = () => { if (!live) return; const v = $('tyi').value; render(); if (v.length >= text.length) { for (let i = 0; i < text.length; i++) { typed++; if (v[i] === text[i]) correct++; } nextS(); } };
    text = SENT[0]; $('tyt').textContent = 'Press Start to begin.'; return () => { clearInterval(timer); };
  });
})();

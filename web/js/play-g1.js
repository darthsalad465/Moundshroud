// Games, part 1: Snake, 2048, Memory, Connect Four, Breakout. Each registers with A.play.games and returns a stop() function.
(() => {
  const P = A.play, L = P.logic = P.logic || {};
  const reg = (id, name, icon, desc, mount) => { P.games[id] = { name, icon, desc, mount }; };
  const CSS = id => getComputedStyle(document.documentElement).getPropertyValue(id).trim() || '#888';
  const keys = fn => { const h = e => { if (A.cur !== 'play' || /INPUT|TEXTAREA|SELECT/.test((e.target || {}).tagName || '')) return; fn(e); }; document.addEventListener('keydown', h); return () => document.removeEventListener('keydown', h); };
  const swipe = (el, cb) => { let sx = 0, sy = 0; const d = e => { sx = e.clientX; sy = e.clientY; }, u = e => { const dx = e.clientX - sx, dy = e.clientY - sy; if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return; cb(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up')); }; el.addEventListener('pointerdown', d); el.addEventListener('pointerup', u); return () => { el.removeEventListener('pointerdown', d); el.removeEventListener('pointerup', u); }; };
  const DIRS = { ArrowUp: 'up', w: 'up', W: 'up', ArrowDown: 'down', s: 'down', S: 'down', ArrowLeft: 'left', a: 'left', A: 'left', ArrowRight: 'right', d: 'right', D: 'right' };
  const pillBtn = (id, t) => '<button class="ib" id="' + id + '">' + t + '</button>';

  /* ================= SNAKE ================= */
  reg('snake', 'Snake', '🐍', 'Eat, grow, do not crash. Arrow keys or WASD.', (el, api) => {
    const N = 18, S = 22; el.innerHTML = '<canvas id="sn" width="' + N * S + '" height="' + N * S + '" style="border:1px solid var(--line);border-radius:12px;background:var(--panel);max-width:100%;touch-action:none"></canvas><div class="small mute" style="margin-top:8px">Space pauses &middot; Enter restarts</div>';
    const cv = $('sn'), cx = cv.getContext('2d'); let snake, dir, q, food, score, alive, paused, timer, speed;
    const spawn = () => { for (;;) { const f = { x: Math.random() * N | 0, y: Math.random() * N | 0 }; if (!snake.some(s => s.x === f.x && s.y === f.y)) return f; } };
    const reset = () => { snake = [{ x: 9, y: 9 }, { x: 8, y: 9 }, { x: 7, y: 9 }]; dir = 'right'; q = []; score = 0; alive = true; paused = false; speed = [170, 130, 95][api.level]; food = spawn(); api.hud('Score ' + score); loop(); };
    const step = () => {
      if (!alive || paused) return; if (q.length) { const n = q.shift(), opp = { up: 'down', down: 'up', left: 'right', right: 'left' }; if (n !== opp[dir]) dir = n; }
      const h = { x: snake[0].x + (dir === 'right') - (dir === 'left'), y: snake[0].y + (dir === 'down') - (dir === 'up') };
      if (h.x < 0 || h.y < 0 || h.x >= N || h.y >= N || snake.some(s => s.x === h.x && s.y === h.y)) { alive = false; api.submit(score); draw(); return; }
      snake.unshift(h); if (h.x === food.x && h.y === food.y) { score++; api.hud('Score ' + score); food = spawn(); if (speed > [80, 60, 45][api.level]) { speed -= [2, 3, 4][api.level]; clearInterval(timer); timer = setInterval(step, speed); } } else snake.pop(); draw();
    };
    const draw = () => {
      cx.fillStyle = CSS('--panel'); cx.fillRect(0, 0, cv.width, cv.height); cx.strokeStyle = 'rgba(255,255,255,.04)'; for (let i = 1; i < N; i++) { cx.beginPath(); cx.moveTo(i * S, 0); cx.lineTo(i * S, cv.height); cx.moveTo(0, i * S); cx.lineTo(cv.width, i * S); cx.stroke(); }
      cx.fillStyle = CSS('--bad'); cx.beginPath(); cx.arc(food.x * S + S / 2, food.y * S + S / 2, S / 2 - 3, 0, 7); cx.fill();
      snake.forEach((s, i) => { cx.fillStyle = i === 0 ? CSS('--acc2') : CSS('--acc'); cx.beginPath(); cx.roundRect(s.x * S + 1, s.y * S + 1, S - 2, S - 2, 6); cx.fill(); });
      if (!alive || paused) { cx.fillStyle = 'rgba(8,10,16,.7)'; cx.fillRect(0, 0, cv.width, cv.height); cx.fillStyle = '#fff'; cx.font = '600 24px Segoe UI'; cx.textAlign = 'center'; cx.fillText(!alive ? 'Game over - ' + score : 'Paused', cv.width / 2, cv.height / 2 - 6); cx.font = '14px Segoe UI'; cx.fillText(!alive ? 'Press Enter to play again' : 'Press Space to continue', cv.width / 2, cv.height / 2 + 20); }
    };
    const loop = () => { clearInterval(timer); timer = setInterval(step, speed); draw(); };
    const off = keys(e => { if (DIRS[e.key]) { const d = DIRS[e.key]; if (q.length < 3) q.push(d); } else if (e.key === ' ' && alive) { paused = !paused; draw(); } else if (e.key === 'Enter' && !alive) reset(); });
    const offS = swipe(cv, d => { if (q.length < 3) q.push(d); }); cv.onclick = () => { if (!alive) reset(); }; reset();
    L.snakeStep = step; return () => { clearInterval(timer); off(); offS(); };
  });

  /* ================= 2048 ================= */
  const slide = row => { const t = row.filter(Boolean), out = []; let gain = 0; for (let i = 0; i < t.length; i++) { if (t[i] === t[i + 1]) { out.push(t[i] * 2); gain += t[i] * 2; i++; } else out.push(t[i]); } while (out.length < 4) out.push(0); return { row: out, gain }; };
  L.slide2048 = slide;
  reg('2048', '2048', '🔢', 'Slide tiles, merge matching numbers, reach 2048.', (el, api) => {
    el.innerHTML = '<div id="g48" style="display:grid;grid-template-columns:repeat(4,76px);gap:8px;background:var(--panel2);padding:8px;border-radius:14px;border:1px solid var(--line);touch-action:none"></div><div class="row" style="margin-top:10px">' + pillBtn('n48', 'New game') + '</div><div class="small mute" style="margin-top:6px">Arrow keys, WASD or swipe</div>';
    const COLORS = { 0: 'rgba(255,255,255,.04)', 2: '#2b3350', 4: '#34406b', 8: '#5b4fcf', 16: '#6d5de0', 32: '#8b7cff', 64: '#46a8d7', 128: '#46d7c8', 256: '#4fe0a8', 512: '#9be06a', 1024: '#e0c24f', 2048: '#ff9f43' };
    let g, score, over, won;
    const add = () => { const e = []; g.forEach((r, y) => r.forEach((v, x) => { if (!v) e.push([y, x]); })); if (!e.length) return; const [y, x] = e[Math.random() * e.length | 0]; g[y][x] = Math.random() < 0.9 ? 2 : 4; };
    const reset = () => { g = Array.from({ length: 4 }, () => [0, 0, 0, 0]); score = 0; over = false; won = false; add(); add(); draw(); };
    const draw = () => { api.hud('Score ' + score); $('g48').innerHTML = g.flat().map(v => '<div style="height:76px;border-radius:10px;display:flex;align-items:center;justify-content:center;font:700 ' + (v > 999 ? 22 : v > 99 ? 27 : 32) + 'px Segoe UI;color:' + (v > 4 ? '#fff' : 'var(--text)') + ';background:' + (COLORS[v] || '#ff6b81') + '">' + (v || '') + '</div>').join('') + (over ? '' : ''); };
    const move = d => {
      if (over) return; const before = JSON.stringify(g); let gain = 0;
      const rows = d === 'left' || d === 'right', rev = d === 'right' || d === 'down';
      for (let i = 0; i < 4; i++) { let line = rows ? g[i].slice() : g.map(r => r[i]); if (rev) line.reverse(); const r = slide(line); gain += r.gain; line = r.row; if (rev) line.reverse(); if (rows) g[i] = line; else line.forEach((v, y) => { g[y][i] = v; }); }
      if (JSON.stringify(g) === before) return; score += gain; add(); if (!won && g.flat().includes(2048)) { won = true; A.toast('You made 2048! Keep going for a higher score.', 4000); }
      const can = () => g.flat().includes(0) || g.some((r, y) => r.some((v, x) => v === r[x + 1] || (g[y + 1] && v === g[y + 1][x]))); if (!can()) { over = true; A.toast('No moves left - final score ' + score, 4000); } api.submit(score); draw();
    };
    const off = keys(e => { if (DIRS[e.key]) move(DIRS[e.key]); }), offS = swipe($('g48'), move); $('n48').onclick = reset; reset(); return () => { off(); offS(); };
  });

  /* ================= MEMORY ================= */
  reg('memory', 'Memory', '🃏', 'Find all the matching pairs in as few moves as you can.', (el, api) => {
    const EM = ['🐶', '🐱', '🦊', '🐼', '🐸', '🦉', '🐙', '🦋', '🌵', '🍄', '🚀', '⚡', '🍕', '🎸', '🌈', '🍩'];
    el.innerHTML = '<div class="row" style="gap:8px;margin-bottom:10px">' + pillBtn('m1', 'Easy 4×3') + pillBtn('m2', 'Medium 4×4') + pillBtn('m3', 'Hard 6×4') + '</div><div id="mg"></div>';
    let first = null, lock = false, moves = 0, left = 0, level = 'm2', memT = 0;
    const start = lvl => { clearTimeout(memT); level = lvl; const pairs = lvl === 'm1' ? 6 : lvl === 'm2' ? 8 : 12, cols = lvl === 'm3' ? 6 : 4; const deck = EM.slice().sort(() => Math.random() - .5).slice(0, pairs); const cards = deck.concat(deck).sort(() => Math.random() - .5); first = null; lock = false; moves = 0; left = pairs; api.hud('Moves 0');
      $('mg').style.cssText = 'display:grid;grid-template-columns:repeat(' + cols + ',70px);gap:8px'; $('mg').innerHTML = cards.map((c, i) => '<div class="tile" data-i="' + i + '" data-e="' + c + '" style="height:70px;font-size:32px;min-height:0">?</div>').join(''); };
    $('mg').onclick = e => { const t = e.target.closest('.tile'); if (!t || lock || t.classList.contains('done') || t === first || t.dataset.shown) return; t.textContent = t.dataset.e; t.dataset.shown = '1'; t.style.background = 'var(--panel2)';
      if (!first) { first = t; return; } moves++; api.hud('Moves ' + moves); const a = first; first = null;
      if (a.dataset.e === t.dataset.e) { a.style.borderColor = t.style.borderColor = 'var(--ok)'; a.dataset.matched = t.dataset.matched = '1'; if (--left === 0) { const nb = api.submit(moves, true); A.toast('All matched in ' + moves + ' moves' + (nb ? ' - a new best!' : '') + '!', 4500); } }
      else { lock = true; memT = setTimeout(() => { [a, t].forEach(x => { x.textContent = '?'; delete x.dataset.shown; x.style.background = ''; }); lock = false; }, 800); } };
    ['m1', 'm2', 'm3'].forEach(id => { $(id).onclick = () => start(id); }); start('m2'); return () => { clearTimeout(memT); };
  });

  /* ================= CONNECT FOUR ================= */
  const W = 7, H = 6;
  const c4win = (b, p) => { for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) for (const [dx, dy] of [[1, 0], [0, 1], [1, 1], [1, -1]]) { let k = 0; for (; k < 4; k++) { const xx = x + dx * k, yy = y + dy * k; if (xx < 0 || yy < 0 || xx >= W || yy >= H || b[yy][xx] !== p) break; } if (k === 4) return true; } return false; };
  const c4moves = b => { const m = []; for (const x of [3, 2, 4, 1, 5, 0, 6]) if (!b[0][x]) m.push(x); return m; };
  const c4drop = (b, x, p) => { for (let y = H - 1; y >= 0; y--) if (!b[y][x]) { b[y][x] = p; return y; } return -1; };
  const c4score = (b, p) => { let s = 0; const o = p === 1 ? 2 : 1; const win = (cells) => { const a = cells.filter(c => c === p).length, e = cells.filter(c => c === 0).length, q = cells.filter(c => c === o).length; if (a === 4) return 1000; if (a === 3 && e === 1) return 6; if (a === 2 && e === 2) return 2; if (q === 3 && e === 1) return -8; return 0; };
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) for (const [dx, dy] of [[1, 0], [0, 1], [1, 1], [1, -1]]) { const cells = []; for (let k = 0; k < 4; k++) { const xx = x + dx * k, yy = y + dy * k; if (xx < 0 || yy < 0 || xx >= W || yy >= H) { cells.length = 0; break; } cells.push(b[yy][xx]); } if (cells.length === 4) s += win(cells); }
    for (let y = 0; y < H; y++) if (b[y][3] === p) s += 3; return s; };
  const c4search = (b, depth, alpha, beta, maxing, ai, hu) => {
    if (c4win(b, ai)) return { s: 100000 + depth }; if (c4win(b, hu)) return { s: -100000 - depth }; const mv = c4moves(b); if (!mv.length || depth === 0) return { s: c4score(b, ai) };
    let best = { s: maxing ? -Infinity : Infinity, x: mv[0] };
    for (const x of mv) { const y = c4drop(b, x, maxing ? ai : hu); const r = c4search(b, depth - 1, alpha, beta, !maxing, ai, hu); b[y][x] = 0; if (maxing ? r.s > best.s : r.s < best.s) best = { s: r.s, x }; if (maxing) alpha = Math.max(alpha, best.s); else beta = Math.min(beta, best.s); if (beta <= alpha) break; }
    return best;
  };
  L.c4best = (board, depth) => c4search(board.map(r => r.slice()), depth, -Infinity, Infinity, true, 2, 1).x; L.c4win = c4win;
  reg('connect4', 'Connect Four', '🔴', 'Get four in a row before Moundshroud does. Three difficulty levels.', (el, api) => {
    el.innerHTML = '<div class="row" style="gap:8px;margin-bottom:8px;flex-wrap:wrap"><label class="small mute">Difficulty <select id="c4d"><option value="2">Easy</option><option value="4" selected>Medium</option><option value="6">Hard</option></select></label>' + pillBtn('c4n', 'New game') + '<span class="small mute" id="c4s"></span></div><div id="c4" style="display:grid;grid-template-columns:repeat(7,52px);gap:6px;background:var(--panel2);padding:10px;border-radius:14px;border:1px solid var(--line)"></div><div class="small mute" style="margin-top:6px">Click a column or press 1-7</div>';
    let b, over, turn, busy = false, aiT = 0; const wins = () => +ls.get('c4wins', '0');
    const draw = (hl) => { $('c4').innerHTML = b.flatMap((r, y) => r.map((v, x) => '<div data-x="' + x + '" style="width:52px;height:52px;border-radius:50%;cursor:pointer;background:' + (v === 1 ? 'var(--acc)' : v === 2 ? 'var(--acc2)' : 'var(--bg)') + ';box-shadow:inset 0 0 0 2px ' + (hl && hl.some(h => h[0] === y && h[1] === x) ? '#fff' : 'rgba(255,255,255,.07)') + '"></div>').join('')).join(''); };
    const reset = () => { clearTimeout(aiT); b = Array.from({ length: H }, () => Array(W).fill(0)); over = false; turn = 1; busy = false; $('c4s').textContent = 'Your turn (purple)'; api.hud('Wins ' + wins()); draw(); };
    const finish = who => { over = true; const line = []; for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) for (const [dx, dy] of [[1, 0], [0, 1], [1, 1], [1, -1]]) { let k = 0; const cells = []; for (; k < 4; k++) { const xx = x + dx * k, yy = y + dy * k; if (xx < 0 || yy < 0 || xx >= W || yy >= H || b[yy][xx] !== who) break; cells.push([yy, xx]); } if (k === 4 && !line.length) cells.forEach(c => line.push(c)); } draw(line);
      if (who === 1) { ls.set('c4wins', String(wins() + 1)); api.submit(wins()); $('c4s').textContent = 'You win!'; A.toast('You beat Moundshroud!', 3000); } else $('c4s').textContent = 'Moundshroud wins - try again?'; api.hud('Wins ' + wins()); };
    const play = x => { if (over || busy || turn !== 1 || b[0][x]) return; c4drop(b, x, 1); draw(); if (c4win(b, 1)) return finish(1); if (!c4moves(b).length) { over = true; $('c4s').textContent = 'A draw'; return; } turn = 2; busy = true; $('c4s').textContent = 'Moundshroud is thinking...';
      aiT = setTimeout(() => { const d = +$('c4d').value, m = c4search(b, d, -Infinity, Infinity, true, 2, 1), ax = (d === 2 && Math.random() < 0.25) ? c4moves(b)[Math.random() * c4moves(b).length | 0] : m.x; c4drop(b, ax, 2); draw(); busy = false; if (c4win(b, 2)) return finish(2); if (!c4moves(b).length) { over = true; $('c4s').textContent = 'A draw'; return; } turn = 1; $('c4s').textContent = 'Your turn (purple)'; }, 250); };
    $('c4').onclick = e => { const c = e.target.closest('[data-x]'); if (c) play(+c.dataset.x); }; $('c4n').onclick = reset; const off = keys(e => { if (/^[1-7]$/.test(e.key)) play(+e.key - 1); }); reset(); return () => { clearTimeout(aiT); off(); };
  });

  /* ================= BREAKOUT ================= */
  reg('breakout', 'Breakout', '🧱', 'Bounce the ball, smash every brick. Mouse or arrow keys.', (el, api) => {
    const Wd = 420, Ht = 320; el.innerHTML = '<canvas id="bo" width="' + Wd + '" height="' + Ht + '" style="border:1px solid var(--line);border-radius:12px;background:var(--panel);max-width:100%;touch-action:none;cursor:none"></canvas><div class="small mute" style="margin-top:8px">Move the mouse or use &larr; &rarr; &middot; Space launches &middot; click to launch</div>';
    const cv = $('bo'), cx = cv.getContext('2d'); let px, ball, bricks, lives, score, level, running, raf, keyL = false, keyR = false, state;
    const make = () => { bricks = []; const cols = 10, rows = 5 + Math.min(3, level - 1); for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) bricks.push({ x: 12 + c * 40, y: 36 + r * 18, w: 36, h: 14, hue: [330, 30, 55, 140, 200, 260, 300, 10][r % 8] }); };
    const serve = () => { ball = { x: px + 32, y: Ht - 38, vx: 0, vy: 0, r: 6, stuck: true }; };
    const newGame = () => { px = Wd / 2 - 32; lives = [5, 3, 2][api.level]; score = 0; level = 1; state = 'play'; make(); serve(); api.hud('Score 0 · Lives ' + lives); };
    const launch = () => { if (ball.stuck) { ball.stuck = false; const sp = (3.6 + level * 0.3) * [.85, 1, 1.2][api.level]; ball.vx = (Math.random() < .5 ? -1 : 1) * sp * 0.6; ball.vy = -sp; } else if (state !== 'play') newGame(); };
    const frame = () => {
      if (state === 'play') {
        if (keyL) px -= 6; if (keyR) px += 6; px = Math.max(0, Math.min(Wd - 64, px));
        if (ball.stuck) { ball.x = px + 32; ball.y = Ht - 38; } else {
          ball.x += ball.vx; ball.y += ball.vy; if (ball.x < ball.r || ball.x > Wd - ball.r) { ball.vx *= -1; ball.x = Math.max(ball.r, Math.min(Wd - ball.r, ball.x)); } if (ball.y < ball.r) { ball.vy *= -1; ball.y = ball.r; }
          if (ball.vy > 0 && ball.y + ball.r >= Ht - 24 && ball.y + ball.r <= Ht - 14 && ball.x >= px - 4 && ball.x <= px + 68) { const off = (ball.x - (px + 32)) / 36, sp = Math.hypot(ball.vx, ball.vy); ball.vx = off * sp * 0.9; ball.vy = -Math.sqrt(Math.max(sp * sp - ball.vx * ball.vx, 4)); ball.y = Ht - 24 - ball.r; }
          for (const b of bricks) { if (b.dead) continue; if (ball.x + ball.r > b.x && ball.x - ball.r < b.x + b.w && ball.y + ball.r > b.y && ball.y - ball.r < b.y + b.h) { b.dead = true; score += 10; const ox = Math.min(ball.x + ball.r - b.x, b.x + b.w - (ball.x - ball.r)), oy = Math.min(ball.y + ball.r - b.y, b.y + b.h - (ball.y - ball.r)); if (ox < oy) ball.vx *= -1; else ball.vy *= -1; api.hud('Score ' + score + ' · Lives ' + lives); break; } }
          if (bricks.every(b => b.dead)) { level++; make(); serve(); A.toast('Level ' + level + '!', 1500); }
          if (ball.y > Ht + 10) { lives--; api.hud('Score ' + score + ' · Lives ' + lives); if (lives <= 0) { state = 'over'; api.submit(score); } else serve(); }
        }
      }
      cx.fillStyle = CSS('--panel'); cx.fillRect(0, 0, Wd, Ht); bricks.forEach(b => { if (!b.dead) { cx.fillStyle = 'hsl(' + b.hue + ',70%,60%)'; cx.beginPath(); cx.roundRect(b.x, b.y, b.w, b.h, 4); cx.fill(); } });
      cx.fillStyle = CSS('--acc'); cx.beginPath(); cx.roundRect(px, Ht - 24, 64, 10, 5); cx.fill(); cx.fillStyle = '#fff'; cx.beginPath(); cx.arc(ball.x, ball.y, ball.r, 0, 7); cx.fill();
      if (state === 'over') { cx.fillStyle = 'rgba(8,10,16,.7)'; cx.fillRect(0, 0, Wd, Ht); cx.fillStyle = '#fff'; cx.font = '600 24px Segoe UI'; cx.textAlign = 'center'; cx.fillText('Game over - ' + score, Wd / 2, Ht / 2); cx.font = '14px Segoe UI'; cx.fillText('Click or press Space to play again', Wd / 2, Ht / 2 + 24); }
      raf = requestAnimationFrame(frame);
    };
    cv.addEventListener('mousemove', e => { const r = cv.getBoundingClientRect(); px = Math.max(0, Math.min(Wd - 64, (e.clientX - r.left) * (Wd / r.width) - 32)); }); cv.addEventListener('click', launch);
    const off = keys(e => { if (e.key === 'ArrowLeft' || e.key === 'a') keyL = true; if (e.key === 'ArrowRight' || e.key === 'd') keyR = true; if (e.key === ' ') launch(); });
    const up = e => { if (e.key === 'ArrowLeft' || e.key === 'a') keyL = false; if (e.key === 'ArrowRight' || e.key === 'd') keyR = false; }; document.addEventListener('keyup', up);
    newGame(); frame(); return () => { cancelAnimationFrame(raf); off(); document.removeEventListener('keyup', up); };
  });
})();

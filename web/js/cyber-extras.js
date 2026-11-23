// Cyber Desktop > the guest's own applications: Games (Minefield, Cable Snake, 2048, Memory), Calculator,
// System Monitor, Mail, Photos, and the Cyber VM that everything dangerous must run inside.
// Everything here runs in this page, offline: no network, no real machine, nothing saved outside the guest disk.
(() => {
  /* ---- shared helpers --------------------------------------------------------------------------------------- */
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const pad = n => String(n).padStart(2, '0');
  const pick = list => list[Math.floor(Math.random() * list.length)];
  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

  /* ---- the Cyber VM -----------------------------------------------------------------------------------------
     A practice machine you boot before you start pretend hacking. It is the only place attack tools are allowed:
     outside it, a tool that "attacks" runs on the host, and the host gets owned. */
  const vmState = { running: false, startedAt: 0, snapshots: 0, everBooted: false };
  const vmLog = [
    'guest: moundshroud-practice-vm',
    'cpu: 2 vCPU · memory: 4096 MB · disk: 40 GB qcow2',
    'network: host-only 10.13.37.0/24 · no internet route',
    'loading kernel 6.6.8-practice …',
    'systemd: reached target multi-user.target',
    'toolkit: nmap, hydra, sqlmap, gobuster, metasploit-framework (demo)',
    'ready: attack range available inside the guest only'
  ];

  function vmBoot() {
    vmState.running = true;
    vmState.startedAt = Date.now();
    vmState.everBooted = true;
  }

  /* ---- Games ------------------------------------------------------------------------------------------------ */
  function games(body, ctx) {
    let stop = null;
    body.innerHTML = `<div class="cd-content cd-games">
      <h2>Games</h2><p>Bundled with the guest image. Four small games, nothing to install, nothing online.</p>
      <div class="cd-game-grid">
        <button type="button" data-game="mines"><i>💣</i><b>Minefield</b><small>Clear a 9×9 field · 10 mines</small></button>
        <button type="button" data-game="snake"><i>🐍</i><b>Cable Snake</b><small>Eat the packets, grow the cable</small></button>
        <button type="button" data-game="2048"><i>🔢</i><b>Block Collapse</b><small>Slide and merge to 2048</small></button>
        <button type="button" data-game="memory"><i>🃏</i><b>Memory Row</b><small>Match the six pairs</small></button>
      </div>
      <div class="cd-game-stage" data-stage hidden></div></div>`;
    const stage = body.querySelector('[data-stage]');
    body.querySelector('.cd-game-grid').addEventListener('click', event => {
      const card = event.target.closest('[data-game]');
      if (!card) return;
      stop?.();
      stop = null;
      stage.hidden = false;
      stop = make(card.dataset.game, stage, ctx) || null;
      stage.focus?.();
    });
    return () => { stop?.(); stop = null; };
  }

  function make(kind, stage, ctx) {
    if (kind === 'mines') return makeMines(stage);
    if (kind === 'snake') return makeSnake(stage);
    if (kind === '2048') return make2048(stage);
    if (kind === 'memory') return makeMemory(stage);
  }

  /* Minefield */
  function makeMines(stage) {
    const N = 9, MINES = 10;
    let mines, open, flags, over, won;
    stage.innerHTML = `<div class="cd-game-head"><b>Minefield</b><span data-mines-left></span><span data-mines-face>🙂</span><button type="button" data-mines-new>New field</button></div>
      <p class="cd-game-help">Click to open a square. Right-click (or long-press) to flag a mine.</p><div class="cd-mines" data-board role="grid"></div>
      <p class="cd-game-msg" data-mines-msg></p>`;
    const board = stage.querySelector('[data-board]');
    const msg = stage.querySelector('[data-mines-msg]');
    stage.querySelector('[data-mines-new]').onclick = reset;
    const near = i => {
      const r = Math.floor(i / N), c = i % N, out = [];
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
        if (!dr && !dc) continue;
        const rr = r + dr, cc = c + dc;
        if (rr >= 0 && rr < N && cc >= 0 && cc < N) out.push(rr * N + cc);
      }
      return out;
    };
    function reset() {
      mines = new Set(); open = new Set(); flags = new Set(); over = false; won = false;
      msg.textContent = '';
      stage.querySelector('[data-mines-face]').textContent = '🙂';
      let guard = 0;
      while (mines.size < MINES && guard++ < 500) mines.add(Math.floor(Math.random() * N * N));
      board.innerHTML = Array.from({ length: N * N }, (_, i) => `<button type="button" class="cd-mine-cell" data-i="${i}" role="gridcell" aria-label="Square ${i + 1}"></button>`).join('');
      paint();
    }
    function paint() {
      for (const cell of board.children) {
        const i = +cell.dataset.i;
        if (open.has(i)) {
          const n = near(i).filter(x => mines.has(x)).length;
          cell.className = 'cd-mine-cell open' + (mines.has(i) ? ' boom' : '');
          cell.textContent = mines.has(i) ? '💥' : n ? String(n) : '';
          cell.dataset.n = n;
        } else {
          cell.className = 'cd-mine-cell' + (flags.has(i) ? ' flag' : '');
          cell.textContent = flags.has(i) ? '🚩' : '';
        }
      }
      stage.querySelector('[data-mines-left]').textContent = (MINES - flags.size) + ' mines left';
    }
    function reveal(i) {
      if (over || open.has(i) || flags.has(i)) return;
      open.add(i);
      if (mines.has(i)) { over = true; return; }
      if (!near(i).some(x => mines.has(x))) near(i).forEach(x => { if (!open.has(x)) reveal(x); });
    }
    board.addEventListener('click', event => {
      const cell = event.target.closest('[data-i]');
      if (!cell || over) return;
      const i = +cell.dataset.i;
      reveal(i);
      paint();
      if (open.size === N * N - MINES) { over = true; won = true; }
      if (over) {
        stage.querySelector('[data-mines-face]').textContent = won ? '😎' : '💥';
        msg.textContent = won ? 'Field cleared. No cables cut.' : 'Boom. That square was a mine. Try a new field.';
        if (!won) for (const j of mines) open.add(j);
        paint();
      }
    });
    board.addEventListener('contextmenu', event => {
      event.preventDefault();
      const cell = event.target.closest('[data-i]');
      if (!cell || over) return;
      const i = +cell.dataset.i;
      if (open.has(i)) return;
      if (flags.has(i)) flags.delete(i); else flags.add(i);
      paint();
    });
    reset();
    return () => { };
  }

  /* Cable Snake */
  function makeSnake(stage) {
    const CELL = 16, COLS = 24, ROWS = 17;
    stage.innerHTML = `<div class="cd-game-head"><b>Cable Snake</b><span data-snake-score>0 packets</span><button type="button" data-snake-new>Restart</button></div>
      <p class="cd-game-help">Arrow keys or WASD. Space pauses. The cable cannot touch itself or the wall.</p>
      <canvas class="cd-canvas" width="${COLS * CELL}" height="${ROWS * CELL}" tabindex="0" aria-label="Cable Snake board"></canvas>
      <p class="cd-game-msg" data-snake-msg>Press an arrow key to start.</p>`;
    const canvas = stage.querySelector('canvas'), msg = stage.querySelector('[data-snake-msg]'), scoreEl = stage.querySelector('[data-snake-score]');
    const g = canvas.getContext('2d');
    let snake, food, dir, next, timer, score, dead, paused, started;
    function spawn() {
      do { food = { x: Math.floor(Math.random() * COLS), y: Math.floor(Math.random() * ROWS) }; }
      while (snake.some(s => s.x === food.x && s.y === food.y));
    }
    function reset() {
      snake = [{ x: 8, y: 8 }, { x: 7, y: 8 }, { x: 6, y: 8 }];
      dir = { x: 1, y: 0 }; next = null; score = 0; dead = false; paused = false; started = false;
      msg.textContent = 'Press an arrow key to start.'; scoreEl.textContent = '0 packets';
      spawn(); draw(); clearInterval(timer);
    }
    function draw() {
      g.fillStyle = '#081020'; g.fillRect(0, 0, canvas.width, canvas.height);
      g.strokeStyle = '#16293f';
      for (let x = 0; x <= COLS; x++) { g.beginPath(); g.moveTo(x * CELL, 0); g.lineTo(x * CELL, canvas.height); g.stroke(); }
      for (let y = 0; y <= ROWS; y++) { g.beginPath(); g.moveTo(0, y * CELL); g.lineTo(canvas.width, y * CELL); g.stroke(); }
      g.fillStyle = '#ffd166';
      g.fillRect(food.x * CELL + 3, food.y * CELL + 3, CELL - 6, CELL - 6);
      snake.forEach((s, i) => {
        g.fillStyle = dead ? '#ff8b8b' : (i === 0 ? '#a7e8ff' : '#4ba3c7');
        g.fillRect(s.x * CELL + 1, s.y * CELL + 1, CELL - 2, CELL - 2);
      });
    }
    function step() {
      if (!started || paused || dead) return;
      if (next && !(next.x === -dir.x && next.y === -dir.y)) dir = next;
      next = null;
      const head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };
      if (head.x < 0 || head.y < 0 || head.x >= COLS || head.y >= ROWS || snake.some(s => s.x === head.x && s.y === head.y)) {
        dead = true; clearInterval(timer);
        msg.textContent = 'Cable cut. Score: ' + score + '. Press Restart.';
        draw(); return;
      }
      snake.unshift(head);
      if (head.x === food.x && head.y === food.y) { score++; scoreEl.textContent = score + (score === 1 ? ' packet' : ' packets'); spawn(); }
      else snake.pop();
      draw();
    }
    canvas.addEventListener('keydown', event => {
      const map = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0], w: [0, -1], s: [0, 1], a: [-1, 0], d: [1, 0] };
      const k = event.key.length === 1 ? event.key.toLowerCase() : event.key;
      if (k === ' ') {
        event.preventDefault(); event.stopPropagation();
        if (dead) return;
        paused = !paused;
        msg.textContent = paused ? 'Paused. Space to continue.' : '';
        return;
      }
      if (!map[k]) return;
      event.preventDefault(); event.stopPropagation();
      if (dead) return;
      if (!started) {
        started = true; msg.textContent = '';
        timer = setInterval(step, 115);
      }
      next = { x: map[k][0], y: map[k][1] };
    });
    canvas.addEventListener('click', () => canvas.focus());
    stage.querySelector('[data-snake-new]').onclick = () => { reset(); canvas.focus(); };
    reset();
    setTimeout(() => canvas.focus(), 30);
    return () => clearInterval(timer);
  }

  /* Block Collapse (2048) */
  function make2048(stage) {
    let grid, score, best = 0, over;
    stage.innerHTML = `<div class="cd-game-head"><b>Block Collapse</b><span data-2048-score>0</span><button type="button" data-2048-new>New game</button></div>
      <p class="cd-game-help">Arrow keys or WASD slide every block. Equal blocks merge. Reach 2048.</p>
      <div class="cd-2048" data-2048-board tabindex="0" aria-label="2048 board"></div>
      <p class="cd-game-msg" data-2048-msg></p>`;
    const board = stage.querySelector('[data-2048-board]');
    const scoreEl = stage.querySelector('[data-2048-score]'), msg = stage.querySelector('[data-2048-msg]');
    function reset() {
      grid = Array.from({ length: 4 }, () => [0, 0, 0, 0]);
      score = 0; over = false; msg.textContent = '';
      add(); add(); paint();
    }
    function add() {
      const free = [];
      grid.forEach((row, r) => row.forEach((v, c) => { if (!v) free.push([r, c]); }));
      if (!free.length) return;
      const [r, c] = pick(free);
      grid[r][c] = Math.random() < .9 ? 2 : 4;
    }
    function paint() {
      scoreEl.textContent = score + ' points';
      board.innerHTML = grid.flatMap((row, r) => row.map((v, c) =>
        `<div class="cd-2048-cell" data-v="${v}">${v || ''}</div>`)).join('');
    }
    function slide(line) {
      const nums = line.filter(Boolean);
      const out = [];
      for (let i = 0; i < nums.length; i++) {
        if (nums[i] === nums[i + 1]) { out.push(nums[i] * 2); score += nums[i] * 2; i++; }
        else out.push(nums[i]);
      }
      while (out.length < 4) out.push(0);
      return out;
    }
    function move(dx, dy) {
      if (over) return;
      const before = JSON.stringify(grid);
      if (dx === 1) grid = grid.map(row => slide(row.slice().reverse()).reverse());
      else if (dx === -1) grid = grid.map(row => slide(row));
      else if (dy === 1) {
        for (let c = 0; c < 4; c++) { const col = slide(grid.map(row => row[c]).reverse()).reverse(); col.forEach((v, r) => grid[r][c] = v); }
      } else if (dy === -1) {
        for (let c = 0; c < 4; c++) { const col = slide(grid.map(row => row[c])); col.forEach((v, r) => grid[r][c] = v); }
      }
      if (JSON.stringify(grid) === before) return;
      add(); paint();
      if (grid.flat().includes(2048)) { over = true; msg.textContent = '2048 reached. Well played.'; }
      else if (grid.flat().every(Boolean) && !canMove()) { over = true; msg.textContent = 'No moves left. Score: ' + score + '.'; }
    }
    function canMove() {
      for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) {
        const v = grid[r][c];
        if (!v) return true;
        if (c < 3 && grid[r][c + 1] === v) return true;
        if (r < 3 && grid[r + 1][c] === v) return true;
      }
      return false;
    }
    board.addEventListener('keydown', event => {
      const map = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0], w: [0, -1], s: [0, 1], a: [-1, 0], d: [1, 0] };
      const k = event.key.length === 1 ? event.key.toLowerCase() : event.key;
      if (!map[k]) return;
      event.preventDefault(); event.stopPropagation();
      move(map[k][0], map[k][1]);
    });
    board.addEventListener('click', () => board.focus());
    stage.querySelector('[data-2048-new]').onclick = () => { reset(); board.focus(); };
    reset();
    setTimeout(() => board.focus(), 30);
    return () => { };
  }

  /* Memory Row */
  function makeMemory(stage) {
    const symbols = ['🔐', '🛰️', '💾', '🧪', '⚙️', '📡'];
    let cards, first, lock, moves, found;
    stage.innerHTML = `<div class="cd-game-head"><b>Memory Row</b><span data-mem-moves>0 pairs</span><button type="button" data-mem-new>Shuffle</button></div>
      <p class="cd-game-help">Turn two cards. Match all six pairs in as few turns as you can.</p>
      <div class="cd-mem" data-mem-board></div><p class="cd-game-msg" data-mem-msg></p>`;
    const board = stage.querySelector('[data-mem-board]');
    const movesEl = stage.querySelector('[data-mem-moves]'), msg = stage.querySelector('[data-mem-msg]');
    function reset() {
      cards = symbols.concat(symbols).map((s, i) => ({ s, i, open: false, done: false }));
      for (let i = cards.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [cards[i], cards[j]] = [cards[j], cards[i]]; }
      first = null; lock = false; moves = 0; found = 0;
      movesEl.textContent = '0 turns'; msg.textContent = '';
      paint();
    }
    function paint() {
      board.innerHTML = cards.map((c, i) => `<button type="button" class="cd-mem-card${c.open || c.done ? ' open' : ''}${c.done ? ' done' : ''}" data-m="${i}">${c.open || c.done ? c.s : ''}</button>`).join('');
    }
    board.addEventListener('click', event => {
      const btn = event.target.closest('[data-m]');
      if (!btn || lock) return;
      const i = +btn.dataset.m, card = cards[i];
      if (card.done || card.open) return;
      card.open = true; paint();
      if (!first) { first = i; return; }
      moves++; movesEl.textContent = moves + (moves === 1 ? ' turn' : ' turns');
      if (cards[first].s === card.s) {
        cards[first].done = true; card.done = true; first = null; found++;
        paint();
        if (found === symbols.length) msg.textContent = 'All pairs matched in ' + moves + ' turns.';
      } else {
        lock = true;
        const a = first; first = null;
        setTimeout(() => {
          cards[a].open = false; card.open = false; lock = false; paint();
        }, 700);
      }
    });
    stage.querySelector('[data-mem-new]').onclick = reset;
    reset();
    return () => { };
  }

  /* ---- Calculator -------------------------------------------------------------------------------------------- */
  function calc(body) {
    body.innerHTML = `<div class="cd-content cd-calc"><h2>Calculator</h2>
      <div class="cd-calc-screen"><span data-calc-history></span><b data-calc-value>0</b></div>
      <div class="cd-calc-keys">
        <button type="button" data-k="AC">AC</button><button type="button" data-k="DEL">⌫</button><button type="button" data-k="%">%</button><button type="button" data-k="/" class="op">÷</button>
        <button type="button" data-k="7">7</button><button type="button" data-k="8">8</button><button type="button" data-k="9">9</button><button type="button" data-k="*" class="op">×</button>
        <button type="button" data-k="4">4</button><button type="button" data-k="5">5</button><button type="button" data-k="6">6</button><button type="button" data-k="-" class="op">−</button>
        <button type="button" data-k="1">1</button><button type="button" data-k="2">2</button><button type="button" data-k="3">3</button><button type="button" data-k="+" class="op">+</button>
        <button type="button" data-k="0">0</button><button type="button" data-k=".">.</button><button type="button" data-k="+/-">±</button><button type="button" data-k="=" class="eq">=</button>
      </div></div>`;
    const value = body.querySelector('[data-calc-value]'), history = body.querySelector('[data-calc-history]');
    let cur = '0', acc = null, op = null, fresh = true;
    const show = () => {
      const numeric = /^-?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(cur);
      value.textContent = numeric && cur.length > 16 ? String(Number(cur).toPrecision(12)) : cur;
      history.textContent = acc === null ? '' : acc + ' ' + ({ '+': '+', '-': '−', '*': '×', '/': '÷' }[op] || '');
    };
    const apply = () => {
      const a = acc, b = parseFloat(cur) || 0;
      if (a === null) return b;
      if (op === '+') return a + b;
      if (op === '-') return a - b;
      if (op === '*') return a * b;
      if (op === '/') return b === 0 ? NaN : a / b;
      return b;
    };
    body.querySelector('.cd-calc-keys').addEventListener('click', event => {
      const key = event.target.closest('[data-k]');
      if (!key) return;
      const k = key.dataset.k;
      if (/^[0-9]$/.test(k)) { cur = fresh || cur === '0' ? k : cur + k; fresh = false; }
      else if (k === '.') { if (fresh) { cur = '0.'; fresh = false; } else if (!cur.includes('.')) cur += '.'; }
      else if (k === 'AC') { cur = '0'; acc = null; op = null; fresh = true; }
      else if (k === 'DEL') { cur = cur.length > 1 ? cur.slice(0, -1) : '0'; }
      else if (k === '+/-') { cur = cur.startsWith('-') ? cur.slice(1) : (cur === '0' ? '0' : '-' + cur); }
      else if (k === '%') { cur = String((parseFloat(cur) || 0) / 100); fresh = false; }
      else if (k === '=') { const n = apply(); cur = Number.isFinite(n) ? String(Math.round(n * 1e10) / 1e10) : 'Cannot divide by zero'; acc = null; op = null; fresh = true; }
      else { if (acc !== null && op) cur = String(Math.round(apply() * 1e10) / 1e10); acc = parseFloat(cur) || 0; op = k; fresh = true; }
      show();
    });
    show();
  }

  /* ---- System Monitor ---------------------------------------------------------------------------------------- */
  function sysmon(body, ctx) {
    const processes = [
      ['1', 'systemd', 'init', 0.1], ['412', 'cyber-vm', 'virtual machine', 12.4],
      ['655', 'Xorg', 'display server', 3.1], ['712', 'moundshroud-shell', 'desktop shell', 1.8],
      ['903', 'terminal-playground', 'guest terminal', 0.6], ['1204', 'browser-guest', 'offline browser', 6.2],
      ['1330', 'evidence-utils', 'file analysis', 0.2], ['1552', 'mcode', 'offline model helper', 0.0]
    ];
    body.innerHTML = `<div class="cd-content cd-sysmon"><h2>System Monitor</h2>
      <p>Practice machine telemetry. Simulated, like the rest of the guest.</p>
      <div class="cd-sysmon-grid">
        <section class="cd-meter"><b>CPU</b><span data-m-cpu>0%</span><div><i data-b-cpu style="width:0%"></i></div><small>2 vCPU · 3.20 GHz</small></section>
        <section class="cd-meter"><b>Memory</b><span data-m-ram>0%</span><div><i data-b-ram style="width:0%"></i></div><small data-s-ram>0 / 4096 MB</small></section>
        <section class="cd-meter"><b>Disk</b><span data-m-disk>0%</span><div><i data-b-disk style="width:0%"></i></div><small>9.4 / 40 GB used</small></section>
        <section class="cd-meter"><b>Network</b><span data-m-net>0</span><div><i data-b-net style="width:0%"></i></div><small>host-only · no internet route</small></section>
      </div>
      <h2>Processes</h2>
      <table class="cd-proc"><thead><tr><th>PID</th><th>Process</th><th>Role</th><th>CPU</th></tr></thead>
      <tbody>${processes.map(([pid, name, role]) => `<tr data-pid="${pid}"><td>${pid}</td><td><code>${name}</code></td><td>${role}</td><td data-pc="${pid}">0.0%</td></tr>`).join('')}</tbody></table>
      <p class="cd-game-msg" data-sys-uptime></p></div>`;
    let tick = 0;
    const started = Date.now();
    function step() {
      if (!body.isConnected) return;
      tick++;
      const cpu = Math.round(18 + Math.sin(tick / 3) * 13 + Math.random() * 12);
      const ram = Math.round(42 + Math.sin(tick / 7) * 6 + Math.random() * 4);
      const disk = 23 + Math.round(Math.random() * 2);
      const net = Math.round(80 + Math.random() * 320);
      const set = (sel, text) => { const n = body.querySelector(sel); if (n) n.textContent = text; };
      const bar = (sel, pct) => { const n = body.querySelector(sel); if (n) n.style.width = clamp(pct, 2, 100) + '%'; };
      set('[data-m-cpu]', cpu + '%'); bar('[data-b-cpu]', cpu);
      set('[data-m-ram]', ram + '%'); bar('[data-b-ram]', ram);
      set('[data-s-ram]', Math.round(4096 * ram / 100) + ' / 4096 MB');
      set('[data-m-disk]', disk + '%'); bar('[data-b-disk]', disk);
      set('[data-m-net]', net + ' KB/s'); bar('[data-b-net]', Math.min(100, net / 6));
      for (const [pid, , , base] of processes) {
        const cell = body.querySelector('[data-pc="' + pid + '"]');
        if (cell) cell.textContent = (base + Math.random() * (base > 5 ? 6 : 1.2)).toFixed(1) + '%';
      }
      const mins = Math.floor((Date.now() - started) / 60000), secs = Math.floor((Date.now() - started) / 1000) % 60;
      set('[data-sys-uptime]', 'Uptime ' + mins + 'm ' + pad(secs) + 's · guest image moundshroud-practice-vm');
    }
    step();
    const timer = setInterval(step, 1400);
    return () => clearInterval(timer);
  }

  /* ---- Photos ------------------------------------------------------------------------------------------------
     A real picture folder: bundled photographs of the practice machine's owner, any pictures you add from this PC,
     and a delete that removes them for good. Nothing is uploaded; your own pictures live in this browser only. */
  const PHOTOS_KEY = 'cyber_desktop_photos', HIDDEN_KEY = 'cyber_desktop_photos_hidden';
  const BUNDLED_PHOTOS = [
    ['/web/cyber-photos/rack-row.jpg', 'Rack row three', 'Night shift · colo cage B'],
    ['/web/cyber-photos/harbour-dawn.jpg', 'Harbour at dawn', 'Saturday, before anyone else was up'],
    ['/web/cyber-photos/night-desk.jpg', 'Night desk', 'Writing up the incident at 01:40'],
    ['/web/cyber-photos/cable-tangle.jpg', 'Cable management (before)', 'Do not open the bottom drawer'],
    ['/web/cyber-photos/whiteboard.jpg', 'Whiteboard, unreadable', 'The subnet split, attempt three'],
    ['/web/cyber-photos/sticker-laptop.jpg', 'Old laptop, new life', 'Still the best keyboard I own']
  ];
  const readStored = (key, fallback) => { try { const raw = ls.get(key, ''); return raw ? JSON.parse(raw) : fallback; } catch (e) { return fallback; } };
  const writeStored = (key, value) => { try { ls.set(key, JSON.stringify(value)); return true; } catch (e) { return false; } };

  function photos(body) {
    let own = readStored(PHOTOS_KEY, []);
    if (!Array.isArray(own)) own = [];
    const hidden = new Set(readStored(HIDDEN_KEY, []));
    body.innerHTML = `<div class="cd-content cd-photos">
      <header class="cd-photos-head"><h2>Photos</h2><span class="cd-photo-count" data-photo-count></span>
        <div class="cd-photo-actions">
          <label class="cd-photo-add" tabindex="0">＋ Add photos<input type="file" data-photo-file accept="image/png,image/jpeg,image/webp" multiple hidden></label>
          <button type="button" data-photo-restore>Restore bundled</button>
        </div></header>
      <p>Your pictures folder. Add pictures from this PC, open one to look at it, or delete the ones you no longer want.</p>
      <div class="cd-photo-grid" data-photo-grid></div>
      <p class="cd-game-msg" data-photo-msg></p>
      <div class="cd-photo-view" data-photo-view hidden></div></div>`;
    const grid = body.querySelector('[data-photo-grid]'), view = body.querySelector('[data-photo-view]');
    const msg = body.querySelector('[data-photo-msg]'), counter = body.querySelector('[data-photo-count]');
    const items = () => BUNDLED_PHOTOS.map(([src, title, cap], i) => ({ id: 'b' + i, src, title, cap, bundled: true }))
      .filter(photo => !hidden.has(photo.id))
      .concat(own.map(photo => Object.assign({ bundled: false, cap: 'Added by you' }, photo)));
    function closeView() { view.hidden = true; view.replaceChildren(); }
    function paint() {
      const list = items();
      counter.textContent = list.length + (list.length === 1 ? ' picture' : ' pictures');
      body.querySelector('[data-photo-restore]').hidden = !hidden.size;
      grid.innerHTML = list.length ? list.map((photo, i) =>
        `<figure class="cd-photo-tile" data-photo="${i}">
          <button type="button" class="cd-photo-open" aria-label="Open ${esc(photo.title)}"><img src="${esc(photo.src)}" alt="${esc(photo.title)}" loading="lazy"></button>
          <figcaption><b>${esc(photo.title)}</b><span>${esc(photo.cap || '')}</span></figcaption>
          <button type="button" class="cd-photo-del" data-del="${i}" title="Delete this photo" aria-label="Delete ${esc(photo.title)}">✕</button>
        </figure>`).join('')
        : '<p class="cd-photo-empty">Nothing here. Choose <b>Add photos</b> to put your own pictures in this folder.</p>';
    }
    function open(index) {
      const photo = items()[index];
      if (!photo) return;
      view.hidden = false;
      view.innerHTML = `<div class="cd-photo-big"><img src="${esc(photo.src)}" alt="${esc(photo.title)}"></div>
        <div class="cd-photo-cap"><b>${esc(photo.title)}</b><span>${esc(photo.cap || '')}</span>
          <a class="cd-photo-save" download="${esc(photo.title)}.jpg" href="${esc(photo.src)}">Save a copy</a>
          <button type="button" data-view-del="${index}">Delete</button>
          <button type="button" data-photo-close>Close</button></div>`;
      view.querySelector('[data-photo-close]').onclick = closeView;
      view.querySelector('[data-view-del]').onclick = () => remove(index);
      view.scrollIntoView({ block: 'nearest' });
    }
    async function remove(index) {
      const photo = items()[index];
      if (!photo) return;
      if (!(await A.confirm('Delete “' + photo.title + '”? It is removed from this pictures folder.'))) return;
      if (photo.bundled) { hidden.add(photo.id); writeStored(HIDDEN_KEY, [...hidden]); }
      else { own = own.filter(item => item.id !== photo.id); writeStored(PHOTOS_KEY, own); }
      msg.textContent = 'Deleted “' + photo.title + '”.';
      closeView();
      paint();
    }
    async function addFiles(input) {
      const files = [...(input.files || [])];
      input.value = '';
      if (!files.length) return;
      msg.textContent = 'Reading ' + files.length + (files.length === 1 ? ' picture…' : ' pictures…');
      let added = 0, skipped = 0;
      for (const file of files) {
        if (!/^image\/(png|jpeg|webp)$/.test(file.type) || file.size > 12 * 1024 * 1024) { skipped++; continue; }
        let bitmap;
        try {
          bitmap = await createImageBitmap(file);
          const scale = Math.min(1, 1400 / Math.max(bitmap.width, bitmap.height));
          const canvas = document.createElement('canvas');
          canvas.width = Math.max(1, Math.round(bitmap.width * scale));
          canvas.height = Math.max(1, Math.round(bitmap.height * scale));
          canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
          const src = canvas.toDataURL('image/jpeg', .78);
          own.unshift({ id: 'p' + Date.now().toString(36) + added, src, title: file.name.replace(/\.[a-z0-9]+$/i, '').slice(0, 80) || 'Picture' });
          if (!writeStored(PHOTOS_KEY, own)) { own.shift(); skipped++; continue; }
          added++;
        } catch (error) { skipped++; }
        finally { bitmap?.close(); }
      }
      msg.textContent = added
        ? 'Added ' + added + (added === 1 ? ' picture' : ' pictures') + '.' + (skipped ? ' ' + skipped + ' could not be added (choose a PNG, JPEG or WebP under 12 MB, and keep the folder small).' : '')
        : 'No pictures were added. Choose a PNG, JPEG or WebP under 12 MB; this folder holds a few of them at most.';
      paint();
    }
    grid.addEventListener('click', event => {
      const del = event.target.closest('[data-del]');
      if (del) { remove(+del.dataset.del); return; }
      const tile = event.target.closest('[data-photo]');
      if (tile) open(+tile.dataset.photo);
    });
    body.querySelector('[data-photo-file]').onchange = event => addFiles(event.target);
    body.querySelector('[data-photo-restore]').onclick = () => {
      hidden.clear(); writeStored(HIDDEN_KEY, []);
      msg.textContent = 'Bundled pictures restored.';
      paint();
    };
    paint();
  }

  /* ---- Mail --------------------------------------------------------------------------------------------------
     A live mailbox: real-looking work mail keeps arriving while the app is open, some of it written by the local
     model, and now and then a phishing message arrives that pretends to take the machine. */
  const MAIL_SEED = [
    ['SOC Team', 'Welcome to the practice image', 'This desktop is a sandbox. Boot the Cyber VM before you run any attack tooling.', 'Your account was created for the offline security course.\n\nThe guest image ships with the usual defensive tools, four games someone left in /opt/games, and a practice range behind the Cyber VM app.\n\nRule one: attack tools run inside the VM. Run them on the host and the host is what gets compromised.'],
    ['Helpdesk', 'Your VM snapshot was refreshed', 'The practice machine was rebuilt from its clean snapshot this morning.', 'The Cyber VM boots from a read-only image and discards its diff disk on shutdown, so nothing you break inside it survives a restart.\n\nIf you need your notes, they are on the guest disk, not in the VM.'],
    ['Nadia (Lab)', 'Lunch and a subnet question', 'Can we go over the 10.13.37.0/24 split after lunch?', 'I keep getting the broadcast address wrong when I split the practice range into four subnets.\n\nAlso there is leftover pizza if you get there first.'],
    ['Facilities', 'Do not unplug the rack', 'A reminder about the lab network rack.', 'The practice rack is virtual. Nothing physical happens when you pull a cable, but the ticket queue notices.'],
    ['Moundshroud Update', 'Desktop update installed', 'Games, calculator, monitor, mail and photos were added to the guest image.', 'The desktop now opens with games, a working calculator, a live system monitor, a photo folder and a mailbox that fills up on its own.\n\nRight-click anywhere for the app menu, including View page source in the browser.'],
    ['Security Notice', 'Right-click now belongs to the app', 'The guest browser forwards its right-click to the desktop app menu.', 'View page source, copy link address, find, print, reader view and zoom are all on the right-click menu, in the main Browser tab as well as the one on this desktop.'],
    ['Dana (Platform)', 'Ticket queue is quiet', 'Nothing urgent, so I am closing the older ones.', 'I have closed eleven tickets that were really the same switch port flapping. If yours disappears, that is why.'],
    ['You', 'Draft: notes to self', 'Remember to read the case files before running the range.', 'Order of work:\n1. Read the case brief in Incident Desk.\n2. Boot the Cyber VM.\n3. Open the range and work the missions in order.\n4. Write the finding in Notes.']
  ];
  const MAIL_PEOPLE = [
    'Dana (Platform)', 'Priya (NetOps)', 'Tom (Helpdesk)', 'Nadia (Lab)', 'SOC Team', 'Facilities',
    'Iris (Compliance)', 'mcode (assistant)', 'Ravi (Data)', 'Jo (Shift lead)'
  ];
  const MAIL_TOPICS = [
    'the maintenance window on Thursday night',
    'a printer that keeps dropping off the network',
    'last week\'s backup restore test',
    'whether the lab VLAN needs another address range',
    'the new starter who needs a practice account',
    'the alert that fired at 3am and then went quiet',
    'a courier delivery for the server room',
    'the quarterly access review spreadsheet',
    'a length of fibre someone tripped over',
    'the phishing drill results from Monday'
  ];
  const PHISH = [
    ['IT Service Desk', 'Action required: re-verify your staff credentials', 'Your mailbox password expires today. Re-verify now to avoid losing access.', 'Our records show that your mailbox password expires today at 17:00.\n\nTo keep your account, sign in through the verification page below and confirm your current password. Accounts that are not verified are locked automatically and mail is held for seven days.\n\nIT Service Desk · ticket #SR-44821'],
    ['Payroll', 'Your salary payment was rejected', 'The bank rejected this month\'s transfer. Confirm your details to be paid.', 'The bank rejected this month\'s transfer because your account details did not match.\n\nOpen the payroll portal and confirm your bank details and your login before Friday, or payment moves to next month.\n\nPayroll Operations'],
    ['Moundshroud Account', 'Unusual sign-in from 41.203.x.x', 'Someone signed in to your account from an unknown location.', 'We blocked a sign-in to your account from an unfamiliar location.\n\nIf this was not you, verify your identity now and change your password. The review link stays open for 24 hours.\n\nAccount Protection']
  ];
  function mailMessage(from, subject, body, extra) {
    return Object.assign({ id: 'm' + Math.random().toString(36).slice(2, 9), from, subject, body,
      at: Date.now(), unread: true, preview: String(body).replace(/\s+/g, ' ').slice(0, 90) }, extra || {});
  }
  /* most of the mail is ordinary; now and then it carries a link to one of the fake internet's sites */
  function siteUrl(path) {
    const W = A.cyberWeb;
    if (!W) return '';
    const site = W.random();
    return 'https://' + site.host + (path || pick(['/', '/about', site.cat.route, '/login']));
  }
  function withLink(text, path) {
    const url = siteUrl(path);
    if (!url) return text;
    return text + '\n\n' + pick(['Here is the page:', 'Link:', 'They sent this address:', 'Details are on the site:']) + '\n' + url;
  }
  /* the body is plain text in a <pre>; a URL inside it becomes a real link that opens in the desktop's browser */
  const linkify = text => esc(text).replace(/(https?:\/\/[^\s<>"']+)/g, m =>
    '<a href="#" class="cd-mail-link" data-open-site="' + m + '">' + m.replace(/^https?:\/\//, '').replace(/\/$/, '') + '</a>');

  function mail(body, ctx) {
    const inbox = MAIL_SEED.map(([from, subject, , body]) => Object.assign(mailMessage(from, subject, body), { unread: false }));
    /* a couple of ordinary messages carry a link to somewhere, the way real mail does */
    for (const at of [1, 5]) if (inbox[at]) inbox[at] = mailMessage(inbox[at].from, inbox[at].subject, withLink(inbox[at].body), { unread: false });
    /* one phishing drill is waiting in the mailbox from the start, so the lesson is never missed */
    inbox.splice(2, 0, mailMessage(PHISH[0][0], PHISH[0][1], withLink(PHISH[0][3], '/login'), { phishing: true, preview: PHISH[0][2] }));
    let selected = 0, timers = [], alive = true, writing = false, count = 0, aiNote = 'Mail arrives on its own while this window is open.';
    body.innerHTML = `<div class="cd-content cd-mail"><header class="cd-mail-head"><h2>Mail</h2>
        <span class="cd-mail-badge" data-mail-badge></span><span class="cd-mail-note" data-mail-note></span></header>
      <div class="cd-mail-wrap">
        <div class="cd-mail-list" data-mail-list></div>
        <article class="cd-mail-body" data-mail-body></article>
      </div></div>`;
    const list = body.querySelector('[data-mail-list]'), pane = body.querySelector('[data-mail-body]');
    const badge = body.querySelector('[data-mail-badge]'), note = body.querySelector('[data-mail-note]');
    function paintList() {
      const unread = inbox.filter(message => message.unread).length;
      badge.textContent = unread ? unread + ' unread' : 'All read';
      badge.className = 'cd-mail-badge' + (unread ? '' : ' done');
      note.textContent = aiNote;
      list.innerHTML = inbox.map((message, i) => `<button type="button" data-mail="${i}" class="${message.unread ? 'unread' : 'read'}${message.phishing ? ' phish' : ''}">
        <b>${esc(message.from)}</b><span>${message.phishing ? '⚠ ' : ''}${esc(message.subject)}</span><small>${esc(message.preview)}</small>
        <i class="cd-mail-time">${new Date(message.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</i></button>`).join('');
    }
    function open(index) {
      const message = inbox[index];
      if (!message) return;
      selected = index;
      message.unread = false;
      pane.innerHTML = `<header><b>${esc(message.subject)}</b><span>${esc(message.from)} · ${new Date(message.at).toLocaleString()}</span></header>
        <pre>${linkify(message.body)}</pre>
        ${message.phishing ? `<div class="cd-mail-phish"><b>This message wants you to act.</b>
          <button type="button" data-phish="link">Re-verify my account</button>
          <button type="button" data-phish="file">📎 payroll_verify.exe (184 KB)</button></div>` : ''}
        <footer class="cd-mail-foot"><button type="button" data-mail-del="${index}">Delete this message</button>
          <button type="button" data-mail-reply>Reply</button></footer>`;
      paintList();
    }
    function chosen() { return inbox[Math.min(selected, inbox.length - 1)]; }
    function receive(message, why) {
      inbox.unshift(message);
      if (inbox.length > 40) inbox.length = 40;
      if (selected >= 0) selected = Math.min(selected + 1, inbox.length - 1);
      paintList();
      A.toast('✉ New mail from ' + message.from + (message.phishing ? ' — it looks urgent' : ''));
      aiNote = why || aiNote;
      note.textContent = aiNote;
    }
    /* the local model writes some of the mail; without a model installed the templates take over and it still flows */
    async function compose() {
      if (writing || !alive) return;
      writing = true;
      count++;
      const topic = pick(MAIL_TOPICS);
      const controller = new AbortController();
      const guard = setTimeout(() => controller.abort(), 12000);
      timers.push(guard);
      try {
        if (!A.ai || !A.ai.stream) throw new Error('no model');
        const text = await A.ai.stream([
          { role: 'system', content: 'You write one short, believable internal email for a fictional offline security lab. Reply with only JSON: {"from":"Name, Role","subject":"...","body":"two short plain-text paragraphs"}. No markdown, no links, no lists.' },
          { role: 'user', content: 'Write email ' + count + ' about ' + topic + '. Make it ordinary work mail between colleagues.' }
        ], null, controller.signal, { localOnly: true, temp: .85 });
        const parsed = A.ai.json(text);
        if (!parsed || !parsed.subject || !parsed.body) throw new Error('bad reply');
        const body = String(parsed.body).slice(0, 4000);
        receive(mailMessage(String(parsed.from || pick(MAIL_PEOPLE)).slice(0, 60), String(parsed.subject).slice(0, 120),
          Math.random() < .45 ? withLink(body) : body), 'New mail is written by the model on this PC.');
      } catch (error) {
        const from = pick(MAIL_PEOPLE);
        const subject = topic.charAt(0).toUpperCase() + topic.slice(1);
        const text = 'Quick one — ' + topic + '.\n\nCan you take a look before the end of the day and tell me if anything needs to be booked in? No rush if you are in the middle of something.';
        receive(mailMessage(from, subject, Math.random() < .5 ? withLink(text) : text, null), 'Mail arrives on its own; a local model writes it when one is installed.');
      } finally {
        clearTimeout(guard);
        writing = false;
      }
    }
    function deliver() {
      if (!alive) return;
      if (Math.random() < .3) {
        const [from, subject, preview, text] = pick(PHISH);
        receive(mailMessage(from, subject, withLink(text, '/login'), { phishing: true, preview }), 'One of these messages is a phishing drill. Opening its link is the whole lesson.');
      } else compose();
    }
    body.querySelector('[data-mail-list]').addEventListener('click', event => {
      const item = event.target.closest('[data-mail]');
      if (item) open(+item.dataset.mail);
    });
    pane.addEventListener('click', event => {
      /* a real link in the message: it opens that site in this desktop's browser */
      const siteLink = event.target.closest('[data-open-site]');
      if (siteLink) {
        event.preventDefault();
        ctx.openSite?.(siteLink.dataset.openSite);
        return;
      }
      /* a phishing link gives the machine the pop-up virus: harmless windows inside the guest desktop, and a lesson */
      if (event.target.closest('[data-phish]')) {
        if (ctx.infect) ctx.infect();
        else ctx.hacked?.('phish');
        return;
      }
      const del = event.target.closest('[data-mail-del]');
      if (del) {
        const index = +del.dataset.mailDel;
        const message = inbox[index];
        if (!message) return;
        inbox.splice(index, 1);
        selected = Math.max(0, Math.min(index, inbox.length - 1));
        if (!inbox.length) { pane.innerHTML = '<p class="cd-mail-empty">No messages. Delete nothing for a while and mail will arrive.</p>'; paintList(); return; }
        paintList();
        open(selected);
        return;
      }
      if (event.target.closest('[data-mail-reply]')) {
        const message = chosen();
        if (!message) return;
        A.toast('Replies stay on this practice machine — nothing is sent.');
        pane.querySelector('pre').insertAdjacentHTML('afterend', '<p class="cd-mail-sent">Draft reply saved locally.</p>');
      }
    });
    paintList();
    open(0);
    timers.push(setTimeout(deliver, 9000));
    const loop = setInterval(deliver, 26000 + Math.random() * 14000);
    return () => { alive = false; clearInterval(loop); timers.forEach(clearTimeout); };
  }

  /* ---- Cyber VM ---------------------------------------------------------------------------------------------- */
  function vm(body, ctx) {
    let release = null, timers = [];
    const stop = () => { timers.forEach(clearTimeout); timers = []; };
    body.innerHTML = `<div class="cd-content cd-vm">
      <h2>Cyber VM</h2>
      <p class="cd-vm-line">Practice machine · <b data-vm-state></b> · moundshell · <b data-vm-shell>closed</b></p>
      <p>Attack tools only run inside this virtual machine. On the host, they run on the host — and the host gets owned.</p>
      <div class="cd-vm-console" data-vm-console></div>
      <dl class="cd-vm-specs"><dt>Image</dt><dd>moundshroud-practice-vm (read-only)</dd>
        <dt>Snapshot</dt><dd data-vm-snap>none</dd><dt>Network</dt><dd>host-only 10.13.37.0/24</dd>
        <dt>Uptime</dt><dd data-vm-uptime>—</dd></dl>
      <div class="cd-vm-actions">
        <button type="button" data-vm="start" class="cd-primary">Start VM</button>
        <button type="button" data-vm="restart">Restart</button>
        <button type="button" data-vm="snapshot">Take snapshot</button>
        <button type="button" data-vm="range">Open hacking range</button>
        <button type="button" data-vm="host" class="dang">Attack from the host (unsafe)</button>
      </div>
      <p class="cd-vm-shell-note" data-vm-shell-note></p>
      <div class="cd-vm-range" data-vm-range hidden></div></div>`;
    const stateEl = body.querySelector('[data-vm-state]'), consoleEl = body.querySelector('[data-vm-console]');
    const snapEl = body.querySelector('[data-vm-snap]'), uptimeEl = body.querySelector('[data-vm-uptime]');
    const startButton = body.querySelector('[data-vm="start"]'), rangeBox = body.querySelector('[data-vm-range]');
    function paint() {
      stateEl.textContent = vmState.running ? 'Running' : 'Stopped';
      stateEl.className = vmState.running ? 'cd-ok' : 'cd-bad';
      startButton.hidden = vmState.running;
      snapEl.textContent = vmState.snapshots ? vmState.snapshots + ' saved · ' + new Date(vmState.savedAt).toLocaleTimeString() : 'none';
      uptimeEl.textContent = vmState.running ? Math.max(0, Math.floor((Date.now() - vmState.startedAt) / 1000)) + 's' : '—';
      consoleEl.innerHTML = vmState.running
        ? vmLog.map(line => `<span>${esc(line)}</span>`).join('')
        : '<span class="mute">Stopped. Press Start VM to boot the practice machine.</span>';
      /* the switch the guest makes in moundshell is shown here, in the VM app it belongs to */
      const shell = (() => { try { return window.AppShell && window.AppShell.user ? window.AppShell.user() : null; } catch (e) { return null; } })();
      const shellEl = body.querySelector('[data-vm-shell]'), shellNote = body.querySelector('[data-vm-shell-note]');
      if (shellEl) {
        shellEl.textContent = !shell || !shell.open ? 'closed' : shell.user;
        shellEl.className = shell && shell.open && shell.pentest ? 'cd-ok' : '';
      }
      if (shellNote) shellNote.textContent = !vmState.running ? '' : (shell && shell.open && shell.pentest
        ? 'moundshell is signed in as kali@pentest.'
        : 'Turning the VM on does not change moundshell by itself. Open it (Ctrl+T) and press ⟲ Restart to sign in as kali@pentest.');
    }
    function boot() {
      stop();
      vmBoot();
      consoleEl.innerHTML = '<span>power on …</span>';
      vmLog.forEach((line, i) => timers.push(setTimeout(() => { if (body.isConnected) { consoleEl.insertAdjacentHTML('beforeend', '<span>' + esc(line) + '</span>'); paint(); ctx.refresh?.(); } }, 90 * (i + 1))));
      timers.push(setTimeout(() => { if (body.isConnected) { paint(); ctx.refresh?.(); } }, 120));
      paint(); ctx.refresh?.();
      A.toast('VM running — moundshell signs in as kali@pentest when you restart it.');
    }
    function openRange() {
      if (!vmState.running) { ctx.hacked?.(); return; }
      rangeBox.hidden = false;
      rangeBox.innerHTML = '<div data-breach-host>Loading your offline library targets…</div>';
      A.api('/api/lib/books').then(r => {
        if (!rangeBox.isConnected) return;
        release?.();
        release = A.cyberBreach ? A.cyberBreach.mount(rangeBox.querySelector('[data-breach-host]'), { books: (r && r.books) || [] }) : null;
      }).catch(() => {
        if (!rangeBox.isConnected) return;
        release?.();
        release = A.cyberBreach ? A.cyberBreach.mount(rangeBox.querySelector('[data-breach-host]'), { books: [] }) : null;
      });
      rangeBox.scrollIntoView({ block: 'nearest' });
    }
    body.addEventListener('click', event => {
      const button = event.target.closest('[data-vm]');
      if (!button) return;
      const what = button.dataset.vm;
      if (what === 'start' || what === 'restart') boot();
      else if (what === 'snapshot') { vmState.snapshots++; vmState.savedAt = Date.now(); paint(); A.toast('VM snapshot saved.'); }
      else if (what === 'range') openRange();
      else if (what === 'host') ctx.hacked?.();
    });
    paint();
    const tick = setInterval(() => { if (body.isConnected && vmState.running) paint(); }, 1000);
    return () => { stop(); clearInterval(tick); release?.(); release = null; };
  }

  function reset() {
    vmState.running = false;
    vmState.startedAt = 0;
    vmState.snapshots = 0;
    vmState.savedAt = 0;
  }

  /* mail lives in cyber-mail.js (folders, categories and junk sorting); the local mail above stays as the fallback
     for a page that somehow loads without that file */
  A.cyberExtras = { games, calc, sysmon, mail: (body, ctx) => (A.cyberMail ? A.cyberMail.app(body, ctx) : mail(body, ctx)), photos, vm, state: vmState, reset, vmLog };
})();

// mcode /whip cursor: the mouse pointer becomes a whip (a Verlet rope hanging from a handle) that cracks with sound when its tip moves fast enough; a crack over the target box calls back.
(() => {
  const SEGMENTS = 20, LINK = 8.5, GRAVITY = 0.42, DAMPING = 0.986, ITERATIONS = 14;
  const CRACK_SPEED = 2300, COOLDOWN = 260;      // tip speed in px/s that makes the popper break the sound barrier
  let canvas = null, ctx = null, style = null, timers = { raf: 0, timeout: 0 };
  let points = [], mouse = null, lastMouse = null, mouseVel = { x: 0, y: 0 }, flashes = [];
  let onCrack = null, target = null, lastCrack = 0, running = false, lastFrame = 0;

  const fallbackSound = () => {
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      const audio = fallbackSound.ctx || (fallbackSound.ctx = new AC());
      const length = Math.floor(audio.sampleRate * 0.09), buffer = audio.createBuffer(1, length, audio.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (audio.sampleRate * 0.012));
      const source = audio.createBufferSource(), gain = audio.createGain();
      source.buffer = buffer; gain.gain.value = 0.6;
      source.connect(gain); gain.connect(audio.destination); source.start();
    } catch (e) { }
  };
  const crackSound = () => (window.A?.openwhip?.sound ? A.openwhip.sound() : fallbackSound());

  function reset(x, y) {
    points = Array.from({ length: SEGMENTS + 1 }, (_, i) => ({ x, y: y + i * LINK, px: x, py: y + i * LINK }));
  }

  function resize() {
    if (!canvas) return;
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.round(innerWidth * ratio); canvas.height = Math.round(innerHeight * ratio);
    canvas.style.width = innerWidth + 'px'; canvas.style.height = innerHeight + 'px';
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  }

  const onMove = event => {
    const now = performance.now();
    if (!mouse) { mouse = { x: event.clientX, y: event.clientY, t: now }; reset(mouse.x, mouse.y); }
    lastMouse = mouse;
    mouse = { x: event.clientX, y: event.clientY, t: now };
    const dt = Math.max(1, now - lastMouse.t) / 1000;
    mouseVel = { x: (mouse.x - lastMouse.x) / dt, y: (mouse.y - lastMouse.y) / dt };
  };
  // A click lashes the rope: each point is thrown along the hand's motion, more toward the tip.
  const onDown = () => {
    if (!points.length) return;
    const speed = Math.hypot(mouseVel.x, mouseVel.y);
    const dir = speed > 40 ? { x: mouseVel.x / speed, y: mouseVel.y / speed } : { x: 0.7, y: -0.7 };
    points.forEach((p, i) => {
      const share = i / SEGMENTS;
      p.px = p.x - dir.x * 34 * share * share;
      p.py = p.y - dir.y * 34 * share * share;
    });
  };

  function step() {
    if (!mouse || !points.length) return;
    // Verlet: carry each point's velocity forward, add gravity, then pull every link back to its length.
    for (let i = 1; i < points.length; i++) {
      const p = points[i];
      const vx = (p.x - p.px) * DAMPING, vy = (p.y - p.py) * DAMPING;
      p.px = p.x; p.py = p.y;
      p.x += vx; p.y += vy + GRAVITY;
    }
    const anchor = points[0];
    anchor.px = anchor.x; anchor.py = anchor.y;
    anchor.x = mouse.x; anchor.y = mouse.y;
    for (let k = 0; k < ITERATIONS; k++) {
      points[0].x = mouse.x; points[0].y = mouse.y;
      for (let i = 0; i < SEGMENTS; i++) {
        const a = points[i], b = points[i + 1];
        const dx = b.x - a.x, dy = b.y - a.y, dist = Math.hypot(dx, dy) || 0.001;
        const diff = (dist - LINK) / dist;
        if (i === 0) { b.x -= dx * diff; b.y -= dy * diff; }
        else { a.x += dx * diff * 0.5; a.y += dy * diff * 0.5; b.x -= dx * diff * 0.5; b.y -= dy * diff * 0.5; }
      }
    }
    const tip = points[points.length - 1];
    const tipSpeed = Math.hypot(tip.x - tip.px, tip.y - tip.py) * 60;
    const now = performance.now();
    if (tipSpeed > CRACK_SPEED && now - lastCrack > COOLDOWN) {
      lastCrack = now;
      crackSound();
      flashes.push({ x: tip.x, y: tip.y, born: now });
      const box = typeof target === 'function' ? target() : target;
      const rect = box?.getBoundingClientRect?.();
      const hit = !!rect && tip.x >= rect.left && tip.x <= rect.right && tip.y >= rect.top && tip.y <= rect.bottom;
      try { onCrack?.({ hit, x: tip.x, y: tip.y, speed: Math.round(tipSpeed) }); } catch (e) { }
    }
  }

  function draw() {
    if (!ctx) return;
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    if (!mouse || !points.length) return;
    // Handle: a leather grip ending at the pointer.
    const hx = mouse.x + 12, hy = mouse.y + 26;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#3b2412'; ctx.lineWidth = 7;
    ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(mouse.x, mouse.y); ctx.stroke();
    ctx.strokeStyle = '#a0703c'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(hx - 1, hy - 2); ctx.lineTo(mouse.x + 1, mouse.y + 2); ctx.stroke();
    // Thong: thick near the handle, thin at the popper.
    for (let i = 0; i < SEGMENTS; i++) {
      const a = points[i], b = points[i + 1];
      ctx.strokeStyle = i < SEGMENTS - 2 ? '#7a4a22' : '#e9d8b4';
      ctx.lineWidth = Math.max(1, 4.2 - i * 0.18);
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    }
    const now = performance.now();
    flashes = flashes.filter(f => now - f.born < 220);
    for (const f of flashes) {
      const t = (now - f.born) / 220;
      ctx.strokeStyle = 'rgba(255,214,120,' + (1 - t) + ')';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(f.x, f.y, 6 + t * 26, 0, Math.PI * 2); ctx.stroke();
    }
  }

  // Animation runs on requestAnimationFrame with a timer fallback, so a hidden pane still advances the physics.
  function loop() {
    if (!running) return;
    cancelAnimationFrame(timers.raf); clearTimeout(timers.timeout);
    const now = performance.now();
    const frames = Math.min(4, Math.max(1, Math.round((now - (lastFrame || now - 16)) / 16.7)));
    lastFrame = now;
    for (let i = 0; i < frames; i++) step();
    draw();
    timers.raf = requestAnimationFrame(loop);
    timers.timeout = setTimeout(loop, 60);
  }

  function on(options = {}) {
    onCrack = options.onCrack || null;
    target = options.target || null;
    if (running) return;
    running = true;
    canvas = document.createElement('canvas');
    canvas.className = 'mcwhip-canvas';
    canvas.setAttribute('aria-hidden', 'true');
    canvas.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:2147483000';
    ctx = canvas.getContext('2d');
    document.body.appendChild(canvas);
    style = document.createElement('style');
    style.textContent = 'html.mcwhip-on, html.mcwhip-on * { cursor: none !important; }';
    document.head.appendChild(style);
    document.documentElement.classList.add('mcwhip-on');
    resize();
    addEventListener('resize', resize);
    addEventListener('pointermove', onMove, true);
    addEventListener('pointerdown', onDown, true);
    mouse = null; points = []; flashes = []; lastFrame = 0;
    // the whip hangs from where the pointer already is (the button just clicked), so it shows at once
    if (lastSeen) { mouse = { x: lastSeen.x, y: lastSeen.y, t: performance.now() }; reset(mouse.x, mouse.y); }
    loop();
    dispatchEvent(new CustomEvent('mcodewhip', { detail: true }));
  }

  function off() {
    if (!running) return;
    running = false;
    cancelAnimationFrame(timers.raf); clearTimeout(timers.timeout);
    removeEventListener('resize', resize);
    removeEventListener('pointermove', onMove, true);
    removeEventListener('pointerdown', onDown, true);
    document.documentElement.classList.remove('mcwhip-on');
    canvas?.remove(); style?.remove();
    canvas = ctx = style = null; onCrack = target = null; points = [];
    dispatchEvent(new CustomEvent('mcodewhip', { detail: false }));
  }

  // Test hook: drive the rope without a mouse (simulate a pointer at x, y for n frames).
  const simulate = (x, y, frames = 1) => {
    onMove({ clientX: x, clientY: y });
    for (let i = 0; i < frames; i++) step();
    return points.length ? { ...points[points.length - 1] } : null;
  };

  let lastSeen = null;
  addEventListener('pointermove', event => { lastSeen = { x: event.clientX, y: event.clientY }; }, { capture: true, passive: true });
  addEventListener('pointerdown', event => { lastSeen = { x: event.clientX, y: event.clientY }; }, { capture: true, passive: true });

  window.A = window.A || {};
  A.mcodeWhip = { on, off, active: () => running, simulate, lash: onDown, CRACK_SPEED };
})();

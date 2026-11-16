// Moundshroud Companion: a living, articulated character that walks around the workspace, perches on cards, tracks your
// pointer with its eyes, physically walks over to buttons and tabs to press them for you, performs tricks, and cheers your progress.
(() => {
  const BUDDIES = [
    ['🦉', 'Hoot', 'Royal Astral Owl', '#a184ff', 'wise, observant, and warm'],
    ['🦊', 'Fenn', 'Kitsune Ember Fox', '#ff7b3a', 'clever, quick, and playful'],
    ['🐙', 'Inky', 'Cosmic Octo-Mage', '#c46bff', 'curious, inventive, and witty'],
    ['🤖', 'Bolt', 'Aether-Mecha Unit', '#46e8ff', 'precise, upbeat, and helpful'],
    ['🐉', 'Ember', 'Sovereign Ruby Drake', '#ff5468', 'bold, loyal, and fiery'],
    ['🦥', 'Sloane', 'Cozy Moss Sloth', '#63e2a8', 'chill, gentle, and unhurried'],
    ['🐧', 'Pip', 'Frost-Crown Penguin', '#7da0ff', 'cheerful, dapper, and adventurous'],
    ['🐱', 'Miso', 'Lucky Starlight Neko', '#f2c75c', 'cozy, mischievous, and affectionate']
  ];
  const S = Object.assign({ on: 1, b: 0, roam: 0 }, (() => { try { return JSON.parse(ls.get('companion', '{}')); } catch (e) { return {}; } })());
  S.roam = 0; // Only move when explicitly told to
  const save = () => ls.set('companion', JSON.stringify({ on: S.on, b: S.b, roam: S.roam }));
  const LINES = {
    cheer: ['Nice work!', 'Look at you go!', 'That was great!', 'You did it!', 'Another one done!', 'Keep it up!'],
    win: ['What a game!', 'Checkmate energy!', 'Well played, grandmaster!'],
    proud: ['Thanks for writing today.', 'A day well noted.', 'That counts. Good job.'],
    lang: ['Another lesson down!', 'Your vocabulary is growing!', 'Hablas, parles, sprichst... you\'re getting there!'],
    sleepy: ['Zzz...', 'Wake me when you are back.'],
    hi: ['Welcome back!', 'Good to see you!', 'Ready when you are.'],
    pep: ['Small steps add up.', 'You are doing better than you think.', 'Take a sip of water.', 'Stretch your shoulders for a moment.', 'One thing at a time.', 'Progress, not perfection.'],
    roam: ['Just stretching my legs!', 'Checking out this spot!', 'Everything looks tidy over here.', 'Tell me to click or point at anything!', 'Ooh, what is this over here?', 'Nice view from up here!']
  };
  const pick = a => a[Math.floor(Math.random() * a.length)];

  const css =
    '#cmp{position:fixed;left:14px;bottom:14px;z-index:9995;display:flex;align-items:flex-end;gap:10px;pointer-events:none;will-change:left,bottom;transition:filter .25s}' +
    '#cmp.flip-bub{flex-direction:row-reverse}' +
    '#cmp .cb{pointer-events:auto;width:66px;height:66px;border-radius:22px;background:radial-gradient(circle at 50% 25%,color-mix(in srgb,var(--bcol,var(--acc)) 28%,var(--panel2)),color-mix(in srgb,var(--panel) 92%,var(--bg)));border:1.5px solid color-mix(in srgb,var(--bcol,var(--acc)) 48%,var(--line));box-shadow:0 12px 28px -8px rgba(0,0,0,.55),0 0 22px -6px color-mix(in srgb,var(--bcol,var(--acc)) 45%,transparent),inset 0 1px 0 rgba(255,255,255,.14);display:flex;align-items:center;justify-content:center;font-size:32px;cursor:grab;user-select:none;position:relative;padding:4px;transition:border-color .2s,box-shadow .25s,transform .18s cubic-bezier(.34,1.45,.5,1)}' +
    '#cmp .cb:hover{border-color:var(--bcol,var(--acc));box-shadow:0 16px 34px -8px rgba(0,0,0,.65),0 0 28px -4px color-mix(in srgb,var(--bcol,var(--acc)) 65%,transparent),inset 0 1px 0 rgba(255,255,255,.22);transform:translateY(-2px) scale(1.04)}' +
    '#cmp .cb:active{cursor:grabbing}' +
    '#cmp.walking .cb{border-radius:24px;background:radial-gradient(circle at 50% 60%,color-mix(in srgb,var(--bcol,var(--acc)) 26%,transparent),transparent 74%);border-color:color-mix(in srgb,var(--bcol,var(--acc)) 30%,transparent);box-shadow:0 14px 28px -10px rgba(0,0,0,.5)}' +
    '#cmp .cb.face-l .pa-svg,#cmp .cb.face-l > .pet > i{transform:scaleX(-1)}' +
    '#cmp .cb.hop{animation:cmphop .62s cubic-bezier(.34,1.5,.5,1)}' +
    '#cmp .cb.spin{animation:cmpspin .68s cubic-bezier(.22,1,.36,1)}' +
    '#cmp .cb-tag{position:absolute;bottom:-7px;left:50%;transform:translateX(-50%);padding:1px 7px;border-radius:99px;background:color-mix(in srgb,var(--panel) 95%,#000);border:1px solid color-mix(in srgb,var(--bcol,var(--acc)) 50%,var(--line));font-size:10px;font-weight:700;letter-spacing:.02em;color:var(--text);white-space:nowrap;box-shadow:0 2px 6px rgba(0,0,0,.4);pointer-events:none;transition:opacity .2s,transform .2s}' +
    '#cmp .cb:hover .cb-tag{transform:translateX(-50%) scale(1.06);border-color:var(--bcol,var(--acc))}' +
    '#cmp .bub{pointer-events:auto;max-width:268px;padding:10px 14px;border-radius:16px 16px 16px 4px;background:linear-gradient(180deg,color-mix(in srgb,var(--panel2) 60%,var(--panel)),color-mix(in srgb,var(--panel) 96%,var(--bg)));backdrop-filter:blur(16px);border:1px solid color-mix(in srgb,var(--bcol,var(--acc)) 55%,var(--line));box-shadow:0 12px 32px -6px rgba(0,0,0,.55),inset 0 1px 0 rgba(255,255,255,.08);font-size:13.5px;line-height:1.45;color:var(--text);opacity:0;transform:translateY(8px) scale(.96);transition:opacity .22s ease,transform .25s cubic-bezier(.34,1.45,.5,1);display:none;cursor:pointer}' +
    '#cmp.flip-bub .bub{border-radius:16px 16px 4px 16px}' +
    '#cmp .bub.on{opacity:1;transform:none;display:block}' +
    '#cmpm{position:fixed;left:14px;bottom:88px;z-index:9998;min-width:225px;background:color-mix(in srgb,var(--panel) 94%,transparent);backdrop-filter:blur(20px) saturate(1.3);border:1px solid color-mix(in srgb,var(--text) 16%,var(--line));border-radius:16px;padding:7px;box-shadow:0 22px 56px rgba(0,0,0,.65),inset 0 1px 0 rgba(255,255,255,.08);display:none;animation:cmpMenuIn .18s cubic-bezier(.16,1,.3,1)}' +
    '#cmpm .cm-hd{padding:5px 10px 6px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--mute);border-bottom:1px solid color-mix(in srgb,var(--line) 65%,transparent);margin-bottom:4px;display:flex;justify-content:space-between;align-items:center}' +
    '#cmpm div[data-a]{padding:7px 11px;border-radius:10px;cursor:pointer;white-space:nowrap;font-size:13px;display:flex;align-items:center;gap:9px;color:var(--text);transition:background .12s}' +
    '#cmpm div[data-a]:hover{background:color-mix(in srgb,var(--acc) 16%,var(--panel2))}' +
    '#cmpm hr{border:0;border-top:1px solid color-mix(in srgb,var(--line) 65%,transparent);margin:4px 0}' +
    '.cmp-step{position:fixed;z-index:9994;width:7px;height:7px;border-radius:50%;pointer-events:none;background:var(--bcol,var(--acc));box-shadow:0 0 10px var(--bcol,var(--acc));animation:cmpStepFade .65s ease-out forwards}' +
    '.cmp-ring{position:fixed;z-index:9996;pointer-events:none;border-radius:14px;border:2.5px solid var(--acc2,#ecc35f);box-shadow:0 0 0 6px color-mix(in srgb,var(--acc) 28%,transparent),0 0 28px var(--acc2,#ecc35f),inset 0 0 16px color-mix(in srgb,var(--acc2,#ecc35f) 35%,transparent);animation:cmpRingPulse .95s cubic-bezier(.16,1,.3,1) forwards}' +
    '@keyframes cmpStepFade{0%{opacity:.85;transform:scale(1)}100%{opacity:0;transform:translateY(-8px) scale(.2)}}' +
    '@keyframes cmpRingPulse{0%{opacity:0;transform:scale(.92)}25%{opacity:1;transform:scale(1.03)}75%{opacity:1;transform:scale(1)}100%{opacity:0;transform:scale(1.06)}}' +
    '@keyframes cmpMenuIn{from{opacity:0;transform:translateY(6px) scale(.96)}to{opacity:1;transform:none}}' +
    '@keyframes cmphop{0%{transform:translateY(0)}30%{transform:translateY(-22px) rotate(-6deg) scale(1.08)}60%{transform:translateY(0) rotate(5deg) scale(.95,1.05)}100%{transform:none}}' +
    '@keyframes cmpspin{0%{transform:translateY(0) rotate(0deg) scale(1)}45%{transform:translateY(-18px) rotate(180deg) scale(1.1)}100%{transform:translateY(0) rotate(360deg) scale(1)}}' +
    '@media(max-width:700px){#cmp{display:none}}';
  const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  const el = document.createElement('div'); el.id = 'cmp';
  el.innerHTML = '<div class="cb" title="Your companion — click to chat, drag to move, Alt+click anywhere on screen to send me there, right-click for actions"><div class="cb-pet"></div><span class="cb-tag"></span></div><div class="bub" title="Click to open companion chat"></div>';
  document.body.appendChild(el);
  const menu = document.createElement('div'); menu.id = 'cmpm'; document.body.appendChild(menu);
  const cb = el.querySelector('.cb'), petHost = el.querySelector('.cb-pet'), tagEl = el.querySelector('.cb-tag'), bub = el.querySelector('.bub');

  let t1 = 0, lastAct = Date.now(), asleep = false, walkRaf = 0, walkResolve = null, followCursor = false, perchedEl = null, pointMode = false;
  let pos = { x: 14, y: 14 }; // x = left px, y = bottom px
  const homeCoords = () => ({ x: document.documentElement.classList.contains('rail-min') ? 6 : 14, y: 14 });
  const isAtHome = () => { const h = homeCoords(); return Math.hypot(pos.x - h.x, pos.y - h.y) < 24; };

  const applyPos = (x, y) => {
    const W = innerWidth || 1024, H = innerHeight || 768;
    pos.x = Math.max(6, Math.min(W - 76, x));
    pos.y = Math.max(8, Math.min(H - 78, y));
    el.style.left = Math.round(pos.x) + 'px';
    el.style.bottom = Math.round(pos.y) + 'px';
    el.classList.toggle('flip-bub', pos.x > W * 0.62);
    try { dispatchEvent(new CustomEvent('companion-move', { detail: { x: pos.x, y: pos.y, clientX: pos.x + 33, clientY: H - pos.y - 33 } })); } catch (e) { }
  };

  const spawnStep = () => {
    if (document.hidden) return;
    const d = document.createElement('i'); d.className = 'cmp-step';
    const b = BUDDIES[S.b % BUDDIES.length];
    d.style.setProperty('--bcol', b[3] || 'var(--acc)');
    d.style.left = Math.round(pos.x + 28 + (Math.random() * 14 - 7)) + 'px';
    d.style.bottom = Math.round(pos.y + 4 + (Math.random() * 6)) + 'px';
    document.body.appendChild(d);
    setTimeout(() => d.remove(), 660);
  };

  const highlightEl = target => {
    if (!target || !target.getBoundingClientRect) return;
    const r = target.getBoundingClientRect(); if (r.width < 4 || r.height < 4) return;
    const ring = document.createElement('div'); ring.className = 'cmp-ring';
    const pad = 6;
    Object.assign(ring.style, { left: Math.round(r.left - pad) + 'px', top: Math.round(r.top - pad) + 'px', width: Math.round(r.width + pad * 2) + 'px', height: Math.round(r.height + pad * 2) + 'px' });
    document.body.appendChild(ring);
    setTimeout(() => ring.remove(), 980);
  };

  const stopWalk = () => {
    if (walkRaf) { cancelAnimationFrame(walkRaf); walkRaf = 0; }
    el.classList.remove('walking');
    if (walkResolve) { const r = walkResolve; walkResolve = null; r(false); }
  };

  /* Smoothly walk or fly the companion to viewport (left=tx, bottom=ty) */
  function walkTo(tx, ty, opts) {
    opts = opts || {};
    stopWalk();
    if (!S.on) { S.on = 1; save(); face(); }
    wake();
    const W = innerWidth || 1024, H = innerHeight || 768;
    tx = Math.max(8, Math.min(W - 76, Number(tx) || 14));
    ty = Math.max(8, Math.min(H - 78, Number(ty) || 14));
    const sx = pos.x, sy = pos.y, dx = tx - sx, dy = ty - sy, dist = Math.hypot(dx, dy);
    const speech = opts.say || opts.speech || '';
    if (opts.sayBefore) say(opts.sayBefore, 2200);
    if (dist < 4 || document.hidden) {
      applyPos(tx, ty);
      if (speech) say(speech, opts.sayMs || 3800);
      return Promise.resolve(true);
    }
    cb.classList.toggle('face-l', dx < -3);
    el.classList.add('walking');
    try { dispatchEvent(new CustomEvent('companion-walk-start', { detail: { tx, ty } })); } catch (e) { }
    mood(dist > 280 || opts.fast ? 'run' : 'walk', 0);
    const speed = opts.speed || (opts.fast ? 460 : 280); // px per second
    const dur = Math.max(280, Math.min(2200, (dist / speed) * 1000));
    const arc = Math.min(44, Math.max(12, Math.abs(dy) * 0.18 + dist * 0.05));
    const t0 = performance.now();
    let lastStep = t0;
    return new Promise(resolve => {
      walkResolve = resolve;
      const tick = now => {
        const k = Math.min(1, (now - t0) / dur);
        const ease = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
        const curX = sx + dx * ease;
        const curY = sy + dy * ease + Math.sin(k * Math.PI) * arc;
        applyPos(curX, curY);
        if (now - lastStep > 120) { lastStep = now; spawnStep(); }
        if (k < 1) {
          walkRaf = requestAnimationFrame(tick);
        } else {
          walkRaf = 0; walkResolve = null;
          el.classList.remove('walking');
          applyPos(tx, ty);
          mood(opts.endMood || 'happy', opts.endMs || 1200);
          if (speech) say(speech, opts.sayMs || 3800);
          try { dispatchEvent(new CustomEvent('companion-walk-end', { detail: { x: pos.x, y: pos.y } })); } catch (e) { }
          resolve(true);
        }
      };
      walkRaf = requestAnimationFrame(tick);
    });
  }

  /* Walk using standard screen coordinates (clientX from left, clientY from top of window) */
  function walkToXY(clientX, clientY, opts) {
    const H = innerHeight || 768;
    return walkTo((Number(clientX) || 100) - 33, H - (Number(clientY) || 100) - 33, opts);
  }

  /* Walk directly to a DOM element, perch beside or on it, highlight it, and optionally click/focus it */
  async function walkToEl(target, opts) {
    opts = opts || {};
    if (typeof target === 'string') target = document.querySelector(target);
    if (!target || !target.getBoundingClientRect) return false;
    try {
      const r0 = target.getBoundingClientRect();
      if (r0.bottom < 0 || r0.top > innerHeight || (r0.width === 0 && r0.height === 0)) {
        if (target.scrollIntoView) {
          target.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
          await new Promise(res => setTimeout(res, 220));
        }
      }
    } catch (e) { }
    const r = target.getBoundingClientRect();
    if (r.width < 2 && r.height < 2) return false;
    const W = innerWidth || 1024, H = innerHeight || 768;
    let tx = r.left + Math.min(r.width / 2, 90) - 33;
    let ty = H - r.top + 2; // perch right on top edge of the element
    if (ty > H - 82 || r.height < 52) {
      // for top-bar buttons, sidebar buttons, or small controls, stand right beside or below them
      ty = Math.max(12, H - r.bottom - 20);
      if (r.left < 240) tx = r.right + 6;
      else if (r.left > W * 0.65) tx = r.left - 72;
      else tx = r.left + r.width / 2 - 33;
    }
    perchedEl = target;
    const speech = opts.say || opts.speech || '';
    if (opts.sayBefore) say(opts.sayBefore, 2400);
    await walkTo(tx, ty, { fast: opts.fast, endMood: 'interact', endMs: 1600 });
    cb.classList.toggle('face-l', (r.left + r.width / 2) < (pos.x + 33));
    highlightEl(target);
    try { A.sfx && A.sfx.play('click'); } catch (e) { }
    if (speech) say(speech, opts.sayMs || 4000);
    if (opts.click) {
      await new Promise(res => setTimeout(res, 180));
      try {
        target.click();
        if (target.matches && target.matches('input,textarea,select')) target.focus();
      } catch (e) { }
    }
    if (opts.returnHome) {
      setTimeout(() => { if (perchedEl === target) goHome(true); }, opts.stayMs || 3800);
    }
    return true;
  }

  function goHome(silent) {
    followCursor = false; perchedEl = null;
    const h = homeCoords();
    if (!silent && !isAtHome()) say('Heading back to my corner!', 2200);
    return walkTo(h.x, h.y, { endMood: 'happy', endMs: 900 });
  }

  async function doTrick(kind) {
    if (!S.on) { S.on = 1; save(); face(); }
    wake();
    if (!kind) kind = pick(['flip', 'dance', 'spin', 'zoomies']);
    if (kind === 'flip' || kind === 'backflip') {
      mood('flip', 900); hop();
      for (let i = 0; i < 6; i++) setTimeout(spawnStep, i * 75);
      say('Alley-oop! 10/10 landing! ✨', 3200);
    } else if (kind === 'dance') {
      mood('dance', 3800);
      say('🎶 Doing my victory dance! 🎶', 3600);
      const sx = pos.x, sy = pos.y;
      await walkTo(Math.min(innerWidth - 90, sx + 75), Math.min(innerHeight - 90, sy + 24), { fast: true, endMood: 'dance', endMs: 1800 });
      await walkTo(Math.max(14, sx - 45), sy, { fast: true, endMood: 'dance', endMs: 1800 });
      await walkTo(sx, sy, { fast: true, endMood: 'dance', endMs: 2000 });
    } else if (kind === 'hop' || kind === 'jump') {
      mood('happy', 1500); hop();
      for (let i = 0; i < 4; i++) setTimeout(spawnStep, i * 80);
      say('Boing! 🐾', 2400);
    } else if (kind === 'spin') {
      cb.classList.remove('spin'); void cb.offsetWidth; cb.classList.add('spin');
      mood('happy', 1600);
      for (let i = 0; i < 5; i++) setTimeout(spawnStep, i * 70);
      say('Wheee! Full 360° spin!', 2800);
    } else if (kind === 'wave') {
      mood('happy', 2400); hop();
      say('Hey there! 👋 Tell me where to walk or what to click!', 3500);
    } else if (kind === 'zoomies' || kind === 'run') {
      say('ZOOMIES! Watch me go! 💨', 3500);
      const W = innerWidth || 1024, H = innerHeight || 768;
      await walkTo(Math.round(W * 0.72), Math.round(H * 0.65), { fast: true });
      await walkTo(Math.round(W * 0.28), Math.round(H * 0.72), { fast: true });
      await walkTo(Math.round(W * 0.52), Math.round(H * 0.35), { fast: true, endMood: 'happy', say: 'Phew! That was fast!' });
    } else if (kind === 'circle') {
      say('Walking in a circle around the screen! 🌀', 3600);
      const W = innerWidth || 1024, H = innerHeight || 768, cx = W * 0.5, cy = H * 0.48, rx = Math.min(240, W * 0.28), ry = Math.min(170, H * 0.24);
      for (const a of [0, Math.PI * 0.5, Math.PI, Math.PI * 1.5, Math.PI * 2]) {
        await walkTo(Math.round(cx + Math.cos(a) * rx), Math.round(cy + Math.sin(a) * ry), { fast: true });
      }
      mood('happy', 1800);
    } else if (kind === 'roam') {
      S.roam = 1; save(); await roamOnce(true);
    } else if (kind === 'home') {
      await goHome(false);
    } else if (kind === 'follow') {
      setFollow(!followCursor);
    }
  }

  function setFollow(on) {
    followCursor = !!on;
    say(followCursor ? 'Following your cursor! Move your mouse and I will trot after you. 🐾' : 'Stopped following your cursor.', 3200);
    return followCursor;
  }

  /* Autonomous exploration: pick an interesting card, control, or spot on the active page and walk to it */
  async function roamOnce(manual) {
    if (!S.on) { S.on = 1; save(); face(); }
    if (asleep) wake();
    const W = innerWidth || 1024, H = innerHeight || 768;
    const panel = document.querySelector('.panel.on') || document.body;
    const allCands = [...panel.querySelectorAll('.td-card, .td-tile, .feat, .gcard, .card, button, h2, h3, #nav button[data-tab], #nav button.ngh')].filter(c => {
      if (c.closest('#cmp,#cmpc,#cmpm')) return false;
      const st = getComputedStyle(c);
      if (st.display === 'none' || st.visibility === 'hidden' || parseFloat(st.opacity) < 0.1) return false;
      const r = c.getBoundingClientRect();
      if (r.width < 32 || r.height < 24 || r.top < 44 || r.top > H - 90 || r.left < 8 || r.left > W - 60) return false;
      const tx = r.left + Math.min(r.width / 2, 80) - 33;
      const ty = H - r.top + 2;
      return Math.hypot(tx - pos.x, ty - pos.y) > 120;
    });

    if (allCands.length && (manual || Math.random() > 0.25)) {
      const pickEl = allCands[Math.floor(Math.random() * allCands.length)];
      const h4 = pickEl.querySelector ? pickEl.querySelector('h4, h3, h2, b, .nl') : null;
      const rawTitle = (h4 ? h4.textContent : (pickEl.textContent || pickEl.getAttribute('title') || '')).replace(/\s+/g, ' ').trim().slice(0, 34);
      const line = manual
        ? (rawTitle ? 'Checking out "' + rawTitle + '"!' : pick(LINES.roam))
        : (Math.random() < 0.6 ? (rawTitle ? 'Looking at "' + rawTitle + '"...' : pick(LINES.roam)) : '');
      await walkToEl(pickEl, { say: line, sayMs: 3400 });
      return rawTitle || 'a spot on the page';
    }

    // Fallback: pick a scenic coordinate on screen at least 180px away from current pos
    let tx = pos.x, ty = pos.y;
    for (let i = 0; i < 8; i++) {
      tx = Math.round(120 + Math.random() * Math.max(160, W - 260));
      ty = Math.round(90 + Math.random() * Math.max(140, H - 240));
      if (Math.hypot(tx - pos.x, ty - pos.y) > 160) break;
    }
    await walkTo(tx, ty, { say: manual ? pick(LINES.roam) : '' });
    return 'around the screen';
  }

  const mood = (m, ms) => { try { if (window.PetAnim) PetAnim.mood(petHost, m, ms); } catch (e) { } };
  const face = () => {
    const b = BUDDIES[S.b % BUDDIES.length];
    el.style.setProperty('--bcol', b[3] || 'var(--acc)');
    if (window.PetAnim) PetAnim.set(petHost, b[0]); else petHost.textContent = b[0];
    if (tagEl) tagEl.textContent = b[1];
    el.style.display = S.on ? '' : 'none';
    if (asleep) mood('sleep');
    try { dispatchEvent(new Event('companion-change')); } catch (x) { }
  };
  function say(text, ms) {
    if (!S.on || !text) return;
    bub.textContent = text; bub.classList.add('on');
    clearTimeout(t1); t1 = setTimeout(() => bub.classList.remove('on'), ms || 4400);
    if (!asleep && !walkRaf) mood('talk', Math.min(3200, 600 + String(text).length * 40));
  }
  function hop() { cb.classList.remove('hop'); void cb.offsetWidth; cb.classList.add('hop'); }
  function react(kind, text) {
    if (!S.on) return; wake(); hop(); mood('happy', 1800);
    say(text ? BUDDIES[S.b % BUDDIES.length][1] + ': ' + text : pick(LINES[kind] || LINES.cheer));
    try { A.sfx && A.sfx.play('coin'); } catch (e) { }
  }
  function wake() { lastAct = Date.now(); if (asleep) { asleep = false; mood(null); } }

  /* Eye tracking & follow-cursor mode */
  let eyeRaf = 0, mx = 0, my = 0, followT = 0;
  addEventListener('pointermove', e => {
    if (!S.on || document.hidden) return;
    mx = e.clientX; my = e.clientY;
    if (!eyeRaf) eyeRaf = requestAnimationFrame(() => {
      eyeRaf = 0;
      const r = cb.getBoundingClientRect();
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      const dx = mx - cx, dy = my - cy, d = Math.hypot(dx, dy) || 1;
      const max = 2.6, scale = Math.min(max, d / 45);
      cb.style.setProperty('--ex', ((dx / d) * scale).toFixed(2) + 'px');
      cb.style.setProperty('--ey', ((dy / d) * scale).toFixed(2) + 'px');
    });
    if (followCursor && !walkRaf) {
      clearTimeout(followT);
      followT = setTimeout(() => {
        if (!followCursor) return;
        const ty = innerHeight - my - 24, tx = mx + 26;
        if (Math.hypot(tx - pos.x, ty - pos.y) > 54) walkTo(tx, ty, { fast: true });
      }, 70);
    }
  }, { passive: true });

  /* Alt+Click (or Point-to-Walk mode) sends the companion walking directly to where you clicked */
  addEventListener('click', e => {
    if (!S.on) return;
    if (e.target.closest('#cmp,#cmpm')) return;
    if (pointMode || e.altKey) {
      e.preventDefault();
      e.stopPropagation();
      const wasPoint = pointMode;
      pointMode = false;
      document.body.style.cursor = '';
      const target = e.target.closest('button, a, [role="button"], input, select, textarea, .card, .td-card, .td-tile');
      if (target && !target.closest('#cmpc')) {
        walkToEl(target, { click: wasPoint, say: wasPoint ? 'Got it!' : 'Right here!' });
      } else {
        walkToXY(e.clientX, e.clientY, { say: 'Made it!' });
      }
    }
  }, true);

  /* Drag and drop the companion anywhere on screen */
  let drag = null;
  cb.addEventListener('pointerdown', e => {
    if (e.button !== 0) return;
    e.stopPropagation();
    stopWalk();
    drag = { id: e.pointerId, x0: e.clientX, y0: e.clientY, px: pos.x, py: pos.y, moved: false };
    try { cb.setPointerCapture(e.pointerId); } catch (x) { }
  });
  cb.addEventListener('pointermove', e => {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x0, dy = e.clientY - drag.y0;
    if (!drag.moved && Math.hypot(dx, dy) > 6) {
      drag.moved = true; followCursor = false;
      mood('drag', 0); say('Wheee!', 1500);
    }
    if (drag.moved) {
      applyPos(drag.px + dx, drag.py - dy);
      if (Math.random() < 0.35) spawnStep();
    }
  });
  const endDrag = e => {
    if (!drag || (e && e.pointerId !== drag.id)) return;
    const wasMoved = drag.moved; drag = null;
    if (wasMoved) {
      mood('happy', 1000); hop();
      say(isAtHome() ? 'Back in my corner!' : 'Nice spot! Double-click me or say "go home" to send me back.', 3200);
    } else {
      hop();
      if (A.buddy) A.buddy.toggle(); else showMenu();
    }
  };
  cb.addEventListener('pointerup', endDrag);
  cb.addEventListener('pointercancel', endDrag);
  cb.addEventListener('dblclick', e => { e.stopPropagation(); if (!isAtHome()) goHome(false); else doTrick('flip'); });
  bub.onclick = e => { e.stopPropagation(); if (A.buddy) A.buddy.open(); };

  /* Stay calm and still until told to act */
  ['mousemove', 'keydown', 'click'].forEach(ev => addEventListener(ev, () => {
    if (asleep) wake(); else lastAct = Date.now();
  }, { passive: true }));

  const showMenu = anchor => {
    const b = BUDDIES[S.b % BUDDIES.length];
    menu.innerHTML =
      '<div class="cm-hd"><span>' + b[0] + ' ' + b[1] + ' · ' + b[2] + '</span></div>' +
      '<div data-a="chat">💬 Talk &amp; give commands</div>' +
      '<div data-a="point">🎯 Click anywhere to send me there</div>' +
      '<div data-a="roamnow">🧭 Walk to a card on this page</div>' +
      '<div data-a="follow">' + (followCursor ? '🧲 Stop following cursor' : '🧲 Follow my cursor') + '</div>' +
      (!isAtHome() ? '<div data-a="home">🏠 Return to corner</div>' : '') +
      '<hr>' +
      '<div data-a="flip">🤸 Do a backflip</div>' +
      '<div data-a="dance">🎶 Do a victory dance</div>' +
      '<div data-a="zoomies">💨 Run zoomies around screen</div>' +
      '<div data-a="pep">🌟 Give me a pep talk</div>' +
      '<hr>' +
      '<div data-a="next">🔄 Switch buddy (' + BUDDIES[(S.b + 1) % BUDDIES.length][1] + ')</div>' +
      '<div data-a="hide">🙈 Hide companion</div>';
    const r = (anchor || cb).getBoundingClientRect();
    menu.style.display = 'block';
    const mw = menu.offsetWidth || 230, mh = menu.offsetHeight || 340;
    menu.style.left = Math.max(8, Math.min(innerWidth - mw - 8, r.left)) + 'px';
    menu.style.bottom = Math.max(8, Math.min(innerHeight - mh - 8, innerHeight - r.top + 8)) + 'px';
  };
  cb.oncontextmenu = e => { e.preventDefault(); e.stopPropagation(); showMenu(); };
  menu.onclick = e => {
    const a = e.target.closest('[data-a]'); if (!a) return; menu.style.display = 'none';
    const act = a.dataset.a;
    if (act === 'chat') { if (A.buddy) A.buddy.open(); }
    else if (act === 'point') { pointMode = true; document.body.style.cursor = 'crosshair'; say('Click anywhere on the screen and I will walk right over!', 4000); }
    else if (act === 'roamnow') roamOnce(true);
    else if (act === 'follow') setFollow(!followCursor);
    else if (act === 'home') goHome(false);
    else if (act === 'flip') doTrick('flip');
    else if (act === 'dance') doTrick('dance');
    else if (act === 'zoomies') doTrick('zoomies');
    else if (act === 'pep') { mood('happy', 2000); say(pick(LINES.pep), 5000); }
    else if (act === 'next') { S.b = (S.b + 1) % BUDDIES.length; save(); face(); say('Hi, I am ' + BUDDIES[S.b][1] + ' the ' + BUDDIES[S.b][2] + '!'); hop(); }
    else if (act === 'hide') { S.on = 0; save(); face(); A.toast('Companion hidden. Bring it back from Settings or Ctrl+K.', 3500); }
  };
  addEventListener('click', e => { if (!e.target.closest('#cmpm,#cmp')) menu.style.display = 'none'; });
  addEventListener('resize', () => { if (isAtHome()) applyPos(homeCoords().x, homeCoords().y); else applyPos(pos.x, pos.y); });

  applyPos(homeCoords().x, homeCoords().y);
  face();

  // Make pos callable AND readable as an object so A.companion.pos() and A.companion.pos.x both work
  const posHybrid = () => ({ x: pos.x, y: pos.y, clientX: pos.x + 33, clientY: (innerHeight || 768) - pos.y - 33 });
  Object.defineProperties(posHybrid, {
    x: { get: () => pos.x },
    y: { get: () => pos.y },
    clientX: { get: () => pos.x + 33 },
    clientY: { get: () => (innerHeight || 768) - pos.y - 33 }
  });

  A.companion = {
    react, say, mood, hop, menu: showMenu,
    walkTo, walkToXY, walkToEl, goHome, doTrick, roamOnce, highlightEl,
    setFollow,
    get following() { return followCursor; },
    startPointMode() { pointMode = true; document.body.style.cursor = 'crosshair'; say('Click anywhere on screen and I will walk there!', 4000); },
    get roaming() { return !!S.roam; },
    setRoaming(v) { S.roam = v ? 1 : 0; save(); if (!S.roam && !isAtHome()) goHome(true); },
    pos: posHybrid,
    buddies: () => BUDDIES.map((b, i) => ({ i, e: b[0], n: b[1], title: b[2], role: b[2], col: b[3], trait: b[4] })),
    current: () => S.b % BUDDIES.length,
    isOn: () => !!S.on,
    setBuddy(i) { S.b = ((+i % BUDDIES.length) + BUDDIES.length) % BUDDIES.length; save(); face(); say('Hi, I am ' + BUDDIES[S.b][1] + ' the ' + BUDDIES[S.b][2] + '!'); hop(); },
    info: () => { const b = BUDDIES[S.b % BUDDIES.length]; return { e: b[0], n: b[1], title: b[2], role: b[2], col: b[3], trait: b[4] }; },
    show() { S.on = 1; save(); face(); say('I am back!'); hop(); },
    hide() { S.on = 0; stopWalk(); save(); face(); }
  };
})();

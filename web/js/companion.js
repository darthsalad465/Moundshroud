// Moundshroud Companion: a living, articulated character that walks around the workspace, perches on cards, tracks your
// pointer with its eyes, physically walks over to buttons and tabs to press them for you, performs tricks, and cheers your progress.
(() => {
  const BUDDIES = [
    ['🦉', 'Hoot', 'Royal Astral Owl', '#a184ff'],
    ['🦊', 'Fenn', 'Kitsune Ember Fox', '#ff7b3a'],
    ['🐙', 'Inky', 'Cosmic Octo-Mage', '#c46bff'],
    ['🤖', 'Bolt', 'Aether-Mecha Unit', '#46e8ff'],
    ['🐉', 'Ember', 'Sovereign Ruby Drake', '#ff5468'],
    ['🦥', 'Sloane', 'Cozy Moss Sloth', '#63e2a8'],
    ['🐧', 'Pip', 'Frost-Crown Penguin', '#7da0ff'],
    ['🐱', 'Miso', 'Lucky Starlight Neko', '#f2c75c']
  ];
  const S = Object.assign({ on: 1, b: 0, roam: 1 }, (() => { try { return JSON.parse(ls.get('companion', '{}')); } catch (e) { return {}; } })());
  if (S.roam === undefined) S.roam = 1;
  const save = () => ls.set('companion', JSON.stringify({ on: S.on, b: S.b, roam: S.roam }));
  const LINES = {
    cheer: ['Nice work!', 'Look at you go!', 'That was great!', 'You did it!', 'Another one done!', 'Keep it up!'],
    win: ['What a game!', 'Checkmate energy!', 'Well played, grandmaster!'],
    proud: ['Thanks for writing today.', 'A day well noted.', 'That counts. Good job.'],
    lang: ['Another lesson down!', 'Your vocabulary is growing!', 'Hablas, parles, sprichst... you\'re getting there!'],
    sleepy: ['Zzz...', 'Wake me when you are back.'],
    hi: ['Welcome back!', 'Good to see you!', 'Ready when you are.'],
    pep: ['Small steps add up.', 'You are doing better than you think.', 'Take a sip of water.', 'Stretch your shoulders for a moment.', 'One thing at a time.', 'Progress, not perfection.'],
    roam: ['Just stretching my legs!', 'Checking out this card...', 'Everything looks tidy over here.', 'Let me know if you want me to click anything!', 'Ooh, what is this part?', 'Nice view from up here!']
  };
  const pick = a => a[Math.floor(Math.random() * a.length)];

  const css =
    '#cmp{position:fixed;left:14px;bottom:14px;z-index:58;display:flex;align-items:flex-end;gap:10px;pointer-events:none;will-change:left,bottom;transition:filter .25s}' +
    '#cmp.flip-bub{flex-direction:row-reverse}' +
    '#cmp .cb{pointer-events:auto;width:66px;height:66px;border-radius:22px;background:radial-gradient(circle at 50% 25%,color-mix(in srgb,var(--bcol,var(--acc)) 28%,var(--panel2)),color-mix(in srgb,var(--panel) 92%,var(--bg)));border:1.5px solid color-mix(in srgb,var(--bcol,var(--acc)) 48%,var(--line));box-shadow:0 12px 28px -8px rgba(0,0,0,.55),0 0 22px -6px color-mix(in srgb,var(--bcol,var(--acc)) 45%,transparent),inset 0 1px 0 rgba(255,255,255,.14);display:flex;align-items:center;justify-content:center;font-size:32px;cursor:grab;user-select:none;position:relative;padding:4px;transition:border-color .2s,box-shadow .25s,transform .18s cubic-bezier(.34,1.45,.5,1)}' +
    '#cmp .cb:hover{border-color:var(--bcol,var(--acc));box-shadow:0 16px 34px -8px rgba(0,0,0,.65),0 0 28px -4px color-mix(in srgb,var(--bcol,var(--acc)) 65%,transparent),inset 0 1px 0 rgba(255,255,255,.22);transform:translateY(-2px) scale(1.04)}' +
    '#cmp .cb:active{cursor:grabbing}' +
    '#cmp.walking .cb{border-radius:24px;background:radial-gradient(circle at 50% 60%,color-mix(in srgb,var(--bcol,var(--acc)) 22%,transparent),transparent 72%);border-color:transparent;box-shadow:none}' +
    '#cmp .cb.face-l .pa-svg,#cmp .cb.face-l > .pet > i{transform:scaleX(-1)}' +
    '#cmp .cb.hop{animation:cmphop .62s cubic-bezier(.34,1.5,.5,1)}' +
    '#cmp .cb-tag{position:absolute;bottom:-7px;left:50%;transform:translateX(-50%);padding:1px 7px;border-radius:99px;background:color-mix(in srgb,var(--panel) 95%,#000);border:1px solid color-mix(in srgb,var(--bcol,var(--acc)) 50%,var(--line));font-size:10px;font-weight:700;letter-spacing:.02em;color:var(--text);white-space:nowrap;box-shadow:0 2px 6px rgba(0,0,0,.4);pointer-events:none;transition:opacity .2s,transform .2s}' +
    '#cmp .cb:hover .cb-tag{transform:translateX(-50%) scale(1.06);border-color:var(--bcol,var(--acc))}' +
    '#cmp .bub{pointer-events:auto;max-width:268px;padding:10px 14px;border-radius:16px 16px 16px 4px;background:linear-gradient(180deg,color-mix(in srgb,var(--panel2) 60%,var(--panel)),color-mix(in srgb,var(--panel) 96%,var(--bg)));backdrop-filter:blur(16px);border:1px solid color-mix(in srgb,var(--bcol,var(--acc)) 55%,var(--line));box-shadow:0 12px 32px -6px rgba(0,0,0,.55),inset 0 1px 0 rgba(255,255,255,.08);font-size:13.5px;line-height:1.45;color:var(--text);opacity:0;transform:translateY(8px) scale(.96);transition:opacity .22s ease,transform .25s cubic-bezier(.34,1.45,.5,1);display:none;cursor:pointer}' +
    '#cmp.flip-bub .bub{border-radius:16px 16px 4px 16px}' +
    '#cmp .bub.on{opacity:1;transform:none;display:block}' +
    '#cmpm{position:fixed;left:14px;bottom:88px;z-index:62;min-width:220px;background:color-mix(in srgb,var(--panel) 94%,transparent);backdrop-filter:blur(20px) saturate(1.3);border:1px solid color-mix(in srgb,var(--text) 16%,var(--line));border-radius:16px;padding:7px;box-shadow:0 22px 56px rgba(0,0,0,.65),inset 0 1px 0 rgba(255,255,255,.08);display:none;animation:cmpMenuIn .18s cubic-bezier(.16,1,.3,1)}' +
    '#cmpm .cm-hd{padding:5px 10px 6px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--mute);border-bottom:1px solid color-mix(in srgb,var(--line) 65%,transparent);margin-bottom:4px;display:flex;justify-content:space-between;align-items:center}' +
    '#cmpm div[data-a]{padding:7px 11px;border-radius:10px;cursor:pointer;white-space:nowrap;font-size:13px;display:flex;align-items:center;gap:9px;color:var(--text);transition:background .12s}' +
    '#cmpm div[data-a]:hover{background:color-mix(in srgb,var(--acc) 16%,var(--panel2))}' +
    '#cmpm hr{border:0;border-top:1px solid color-mix(in srgb,var(--line) 65%,transparent);margin:4px 0}' +
    '.cmp-step{position:fixed;z-index:54;width:7px;height:7px;border-radius:50%;pointer-events:none;background:var(--bcol,var(--acc));box-shadow:0 0 10px var(--bcol,var(--acc));animation:cmpStepFade .65s ease-out forwards}' +
    '.cmp-ring{position:fixed;z-index:9990;pointer-events:none;border-radius:14px;border:2.5px solid var(--acc2,#ecc35f);box-shadow:0 0 0 6px color-mix(in srgb,var(--acc) 28%,transparent),0 0 28px var(--acc2,#ecc35f),inset 0 0 16px color-mix(in srgb,var(--acc2,#ecc35f) 35%,transparent);animation:cmpRingPulse .95s cubic-bezier(.16,1,.3,1) forwards}' +
    '@keyframes cmpStepFade{0%{opacity:.85;transform:scale(1)}100%{opacity:0;transform:translateY(-8px) scale(.2)}}' +
    '@keyframes cmpRingPulse{0%{opacity:0;transform:scale(.92)}25%{opacity:1;transform:scale(1.03)}75%{opacity:1;transform:scale(1)}100%{opacity:0;transform:scale(1.06)}}' +
    '@keyframes cmpMenuIn{from{opacity:0;transform:translateY(6px) scale(.96)}to{opacity:1;transform:none}}' +
    '@keyframes cmphop{0%{transform:translateY(0)}30%{transform:translateY(-20px) rotate(-6deg) scale(1.06)}60%{transform:translateY(0) rotate(5deg) scale(.96,1.04)}100%{transform:none}}' +
    '@media(max-width:700px){#cmp{display:none}}';
  const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  const el = document.createElement('div'); el.id = 'cmp';
  el.innerHTML = '<div class="cb" title="Your companion — click to chat, drag to move, right-click for actions"><div class="cb-pet"></div><span class="cb-tag"></span></div><div class="bub" title="Click to open companion chat"></div>';
  document.body.appendChild(el);
  const menu = document.createElement('div'); menu.id = 'cmpm'; document.body.appendChild(menu);
  const cb = el.querySelector('.cb'), petHost = el.querySelector('.cb-pet'), tagEl = el.querySelector('.cb-tag'), bub = el.querySelector('.bub');

  let t1 = 0, lastAct = Date.now(), asleep = false, walkRaf = 0, walkResolve = null, followCursor = false, perchedEl = null;
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
    try { dispatchEvent(new CustomEvent('companion-move', { detail: pos })); } catch (e) { }
  };

  const spawnStep = () => {
    if (document.hidden || (A.motion && A.motion.still && A.motion.still())) return;
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
    if (!S.on) return Promise.resolve(false);
    wake();
    const W = innerWidth || 1024, H = innerHeight || 768;
    tx = Math.max(8, Math.min(W - 76, tx));
    ty = Math.max(8, Math.min(H - 78, ty));
    const sx = pos.x, sy = pos.y, dx = tx - sx, dy = ty - sy, dist = Math.hypot(dx, dy);
    if (dist < 6 || (A.motion && A.motion.still && A.motion.still())) {
      applyPos(tx, ty);
      return Promise.resolve(true);
    }
    cb.classList.toggle('face-l', dx < -3);
    el.classList.add('walking');
    mood(dist > 280 || opts.fast ? 'run' : 'walk', 0);
    const speed = opts.fast ? 440 : 250; // px per second
    const dur = Math.max(260, Math.min(2200, (dist / speed) * 1000));
    const arc = Math.min(42, Math.max(10, Math.abs(dy) * 0.18 + dist * 0.05));
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
        if (now - lastStep > 130) { lastStep = now; spawnStep(); }
        if (k < 1) {
          walkRaf = requestAnimationFrame(tick);
        } else {
          walkRaf = 0; walkResolve = null;
          el.classList.remove('walking');
          applyPos(tx, ty);
          mood(opts.endMood || null, opts.endMs || 1200);
          resolve(true);
        }
      };
      walkRaf = requestAnimationFrame(tick);
    });
  }

  /* Walk directly to a DOM element, perch beside or on it, highlight it, and optionally click/focus it */
  async function walkToEl(target, opts) {
    opts = opts || {};
    if (typeof target === 'string') target = document.querySelector(target);
    if (!target || !target.getBoundingClientRect) return false;
    const r = target.getBoundingClientRect();
    if (r.width < 4 || r.height < 4) return false;
    const W = innerWidth || 1024, H = innerHeight || 768;
    let tx = r.left + r.width / 2 - 33;
    let ty = H - r.top + 4; // perch right on top edge of the element
    if (ty > H - 84 || r.height < 48) {
      // for top-bar buttons or small controls, stand right beside or below them
      ty = Math.max(12, H - r.bottom - 58);
      tx = r.left > W * 0.5 ? r.left - 72 : r.right + 8;
    }
    perchedEl = target;
    if (opts.sayBefore) say(opts.sayBefore, 2600);
    await walkTo(tx, ty, { fast: opts.fast, endMood: 'interact', endMs: 1500 });
    cb.classList.toggle('face-l', (r.left + r.width / 2) < (pos.x + 33));
    highlightEl(target);
    try { A.sfx && A.sfx.play('click'); } catch (e) { }
    if (opts.say) say(opts.say, opts.sayMs || 4200);
    if (opts.click) {
      await new Promise(res => setTimeout(res, 220));
      try { target.click(); } catch (e) { }
    }
    if (opts.returnHome) {
      setTimeout(() => { if (perchedEl === target) goHome(); }, opts.stayMs || 3800);
    }
    return true;
  }

  function goHome(silent) {
    followCursor = false; perchedEl = null;
    const h = homeCoords();
    if (!silent && !isAtHome()) say('Heading back to my corner!', 2200);
    return walkTo(h.x, h.y, { endMood: 'happy', endMs: 900 });
  }

  function doTrick(kind) {
    if (!S.on) return;
    wake();
    if (kind === 'flip') {
      mood('flip', 800); hop();
      for (let i = 0; i < 5; i++) setTimeout(spawnStep, i * 80);
      say('Alley-oop! 10/10 landing!', 3200);
    } else if (kind === 'dance') {
      mood('dance', 3600);
      say('🎶 Doing my victory dance! 🎶', 3600);
    } else if (kind === 'roam') {
      S.roam = 1; save(); roamOnce(true);
    } else if (kind === 'home') {
      goHome(false);
    } else if (kind === 'follow') {
      followCursor = !followCursor;
      say(followCursor ? 'Following your cursor! Lead the way.' : 'Stopped following your cursor.', 3000);
    }
  }

  /* Autonomous exploration: pick an interesting card or control on the active page and visit it */
  function roamOnce(manual) {
    if (!S.on || asleep) return;
    const panel = document.querySelector('.panel.on'); if (!panel) return;
    const cands = [...panel.querySelectorAll('.td-card, .td-tile, .feat, .gcard, .card, #p-chat > .composer')].filter(c => {
      const r = c.getBoundingClientRect();
      return r.width > 90 && r.height > 36 && r.top > 72 && r.bottom < innerHeight - 20 && r.left > 60 && r.right < innerWidth - 20;
    });
    if (!cands.length || (!manual && Math.random() < 0.28 && !isAtHome())) {
      goHome(true);
      return;
    }
    const pickEl = cands[Math.floor(Math.random() * cands.length)];
    const h4 = pickEl.querySelector('h4, h3, h2, b');
    const title = h4 ? h4.textContent.trim().slice(0, 36) : '';
    const line = manual
      ? (title ? 'Checking out "' + title + '"!' : pick(LINES.roam))
      : (Math.random() < 0.55 ? (title ? 'Looking at ' + title + '...' : pick(LINES.roam)) : '');
    walkToEl(pickEl, { say: line, sayMs: 3400 });
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
        if (Math.hypot(tx - pos.x, ty - pos.y) > 64) walkTo(tx, ty, { fast: true });
      }, 90);
    }
  }, { passive: true });

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

  /* Idle sleep & autonomous roaming loop */
  setInterval(() => {
    if (!S.on || document.hidden) return;
    const idleMs = Date.now() - lastAct;
    if (!asleep && idleMs > 6 * 60e3) { asleep = true; mood('sleep'); return; }
    if (!asleep && S.roam && !followCursor && !walkRaf && !(A.buddy && A.buddy.opened) && Math.random() < 0.55) {
      roamOnce(false);
    }
  }, 19000);

  ['mousemove', 'keydown', 'click'].forEach(ev => addEventListener(ev, () => {
    if (asleep) { wake(); say(pick(LINES.hi), 2500); hop(); } else lastAct = Date.now();
  }, { passive: true }));

  const showMenu = anchor => {
    const b = BUDDIES[S.b % BUDDIES.length];
    menu.innerHTML =
      '<div class="cm-hd"><span>' + b[0] + ' ' + b[1] + ' · ' + b[2] + '</span></div>' +
      '<div data-a="chat">💬 Talk &amp; give commands</div>' +
      '<div data-a="roamnow">🧭 Walk &amp; explore this page</div>' +
      '<div data-a="roamtog">' + (S.roam ? '🐾 Free roaming: On' : '📌 Stay in place: On') + '</div>' +
      '<div data-a="follow">' + (followCursor ? '🧲 Stop following cursor' : '🧲 Follow my cursor') + '</div>' +
      (!isAtHome() ? '<div data-a="home">🏠 Return to corner</div>' : '') +
      '<hr>' +
      '<div data-a="flip">🤸 Do a backflip</div>' +
      '<div data-a="dance">🎶 Do a victory dance</div>' +
      '<div data-a="pep">🌟 Give me a pep talk</div>' +
      '<hr>' +
      '<div data-a="next">🔄 Switch buddy (' + BUDDIES[(S.b + 1) % BUDDIES.length][1] + ')</div>' +
      '<div data-a="hide">🙈 Hide companion</div>';
    const r = (anchor || cb).getBoundingClientRect();
    menu.style.display = 'block';
    const mw = menu.offsetWidth || 230, mh = menu.offsetHeight || 320;
    menu.style.left = Math.max(8, Math.min(innerWidth - mw - 8, r.left)) + 'px';
    menu.style.bottom = Math.max(8, Math.min(innerHeight - mh - 8, innerHeight - r.top + 8)) + 'px';
  };
  cb.oncontextmenu = e => { e.preventDefault(); e.stopPropagation(); showMenu(); };
  menu.onclick = e => {
    const a = e.target.closest('[data-a]'); if (!a) return; menu.style.display = 'none';
    const act = a.dataset.a;
    if (act === 'chat') { if (A.buddy) A.buddy.open(); }
    else if (act === 'roamnow') doTrick('roam');
    else if (act === 'roamtog') { S.roam = S.roam ? 0 : 1; save(); say(S.roam ? 'Free roaming is on! I will explore around.' : 'Got it, I will stay put where you place me.', 3200); }
    else if (act === 'follow') doTrick('follow');
    else if (act === 'home') goHome(false);
    else if (act === 'flip') doTrick('flip');
    else if (act === 'dance') doTrick('dance');
    else if (act === 'pep') { mood('happy', 2000); say(pick(LINES.pep), 5000); }
    else if (act === 'next') { S.b = (S.b + 1) % BUDDIES.length; save(); face(); say('Hi, I am ' + BUDDIES[S.b][1] + ' the ' + BUDDIES[S.b][2] + '!'); hop(); }
    else if (act === 'hide') { S.on = 0; save(); face(); A.toast('Companion hidden. Bring it back from Settings or Ctrl+K.', 3500); }
  };
  addEventListener('click', e => { if (!e.target.closest('#cmpm,#cmp')) menu.style.display = 'none'; });
  addEventListener('resize', () => { if (isAtHome()) applyPos(homeCoords().x, homeCoords().y); else applyPos(pos.x, pos.y); });

  applyPos(homeCoords().x, homeCoords().y);
  face();

  // React to tab changes if roaming
  setTimeout(() => {
    try {
      A.on && A.on('tab:show', () => {
        if (!S.on || asleep) return;
        if (!isAtHome() && !S.roam) return;
        if (!isAtHome() && Math.random() < 0.5) setTimeout(() => goHome(true), 300);
      });
    } catch (e) { }
  }, 500);

  // Greeting once a day
  try {
    const k = new Date().toDateString();
    if (ls.get('companion_day', '') !== k) {
      ls.set('companion_day', k);
      setTimeout(() => {
        const l = A.lang && A.lang.summary && A.lang.summary();
        say(pick(LINES.hi) + (l && l.words ? ' ' + l.words + ' words in your language course so far.' : ''), 5000);
        hop();
      }, 2500);
    }
  } catch (e) { }

  // Cheer when a chess game ends in a win
  setTimeout(() => {
    try {
      if (window.ChessAch && !ChessAch.__cmp) {
        const o = ChessAch.event; ChessAch.__cmp = 1;
        ChessAch.event = function (n, d) {
          try { if (n === 'game' && d && d.result === 'win') { react('win'); doTrick('flip'); } } catch (e) { }
          return o.apply(this, arguments);
        };
      }
    } catch (e) { }
  }, 3000);

  A.companion = {
    react, say, mood, hop, menu: showMenu,
    walkTo, walkToEl, goHome, doTrick, highlightEl,
    get roaming() { return !!S.roam; },
    setRoaming(v) { S.roam = v ? 1 : 0; save(); if (!S.roam && !isAtHome()) goHome(true); },
    get pos() { return pos; },
    buddies: () => BUDDIES.map((b, i) => ({ i, e: b[0], n: b[1], title: b[2], col: b[3] })),
    current: () => S.b % BUDDIES.length,
    isOn: () => !!S.on,
    setBuddy(i) { S.b = ((+i % BUDDIES.length) + BUDDIES.length) % BUDDIES.length; save(); face(); say('Hi, I am ' + BUDDIES[S.b][1] + ' the ' + BUDDIES[S.b][2] + '!'); hop(); },
    info: () => { const b = BUDDIES[S.b % BUDDIES.length]; return { e: b[0], n: b[1], title: b[2], col: b[3] }; },
    show() { S.on = 1; save(); face(); say('I am back!'); hop(); },
    hide() { S.on = 0; stopWalk(); save(); face(); }
  };
})();

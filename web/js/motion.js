// Motion, loading feedback and the small conveniences that make the app feel finished.
// Three independent parts, each wrapped so a failure in one can never take the app down with it:
//   1. page changes  - a real cross-fade of the content area (view transitions), with a fallback for browsers without it
//   2. the loading bar - appears only when a request is slow enough to matter, so quick pages never flicker
//   3. the details  - skeletons, counting numbers, a back-to-top button, a fade when the theme changes
// Everything follows Settings > Appearance > Motion (full / subtle / off) and Low-power mode (the Windows animation setting no longer overrides it).
(() => {
  const root = document.documentElement, sysReduce = () => { try { return matchMedia('(prefers-reduced-motion:reduce)').matches; } catch (e) { return false; } };
  /* full unless chosen otherwise in Settings > Appearance > Motion. Windows' "animation effects" switch is often off for
     performance reasons alone, and following it made the whole app look frozen, so it is shown as a hint, not obeyed. */
  let LV = ls.get('motion', '') || 'full';

  /* how far things travel: 1 at full motion, a little less when subtle, nothing when off */
  const mv = () => LV === 'full' ? 1 : LV === 'subtle' ? .55 : 0;
  const still = () => mv() === 0 || document.body.classList.contains('lowpower') || document.hidden;
  const paint = () => { root.dataset.motion = LV; root.style.setProperty('--mv', String(mv())); };
  paint();
  A.motion = {
    get level() { return LV; },
    set(v) { LV = ['full', 'subtle', 'off'].indexOf(v) < 0 ? 'full' : v; ls.set('motion', LV); paint(); A.emit('motion', LV); },
    /* a motion scale other scripts can read, so the whole app agrees on how lively it is */
    scale: mv, still
  };
  /* follow the system setting only while the user has not made a choice of their own */
  A.motion.systemReduces = sysReduce;

  const EASE = 'cubic-bezier(.22,.8,.28,1)';
  /* tell fx.js to stand down: it animates page changes with its own keyframes, and two animations fighting
     over the same panel is worse than either one alone. Only claimed when the browser really has the API. */
  if (document.startViewTransition) { try { window.OA_VT = 1; } catch (e) { } }

  /* the first few cards on the new page settle into place just after the cross-fade ends, so a page does not simply
     appear: it arrives. Only what is already on screen is touched, and only a handful of items, so big pages stay fast. */
  const CARD = '.card, .tile, .bk, .stat, .cc, .nw-ev, .nw-card, .nw-bi, .mk-tile, .mk-card, .am-card, .am-box, .fldu';
  let satToken = 0;
  const settle = (panel, token) => {
    try {
      if (!panel || still() || !panel.querySelectorAll) return 0;
      if (panel.getElementsByTagName('*').length > 4000) return 0;                                  // a huge page is not worth the extra layout
      const cands = panel.querySelectorAll(CARD); if (!cands.length) return 0;
      const vh = innerHeight || 800, picked = [], tk = String(token || ++satToken);
      for (let i = 0; i < cands.length && i < 140 && picked.length < 8; i++) {
        const c = cands[i];
        if (c.dataset.sat === tk) continue;                                                          // already settled on this visit
        const r = c.getBoundingClientRect();
        if (r.height < 26 || r.width < 70) continue;
        if (r.top > vh * .92 || r.bottom < 16) continue;                                             // only what you can actually see
        picked.push(c);
      }
      picked.forEach((c, i) => {
        c.dataset.sat = tk;
        c.classList.remove('rise'); c.style.animationDelay = (i * 22) + 'ms'; c.classList.add('rise');
        setTimeout(() => { c.classList.remove('rise'); c.style.animationDelay = ''; }, (picked.length - 1) * 22 + 340 + i * 22);
      });
      return picked.length;
    } catch (e) { return 0; }
  };
  /* Most pages fill themselves in a moment *after* they are shown, so one attempt at the wrong instant would mean the
     effect never appears. Try a few times over the next second, then stop. New cards that arrive are picked up; the
     ones already settled are left alone. */
  const settleSoon = panel => {
    const mine = ++satToken;
    [0, 170, 430, 760, 1150].forEach(ms => setTimeout(() => {
      if (mine !== satToken || still() || !panel) return;
      if (panel !== document.getElementById('p-' + A.cur)) return;                                 // the user moved on
      settle(panel, mine);
    }, ms));
  };
  A.motion.settle = panel => settle(panel || document.querySelector('.panel.on'), ++satToken);

  /* ---------------- 1. page changes ---------------- */
  try {
    const panels = () => document.getElementById('p-home');
    const wrap = panels() && panels().parentElement;
    /* name the content region, so the browser cross-fades only this area and leaves the app bar alone */
    if (wrap) wrap.classList.add('content-swap');
    const orig = A.showTab;
    let inflight = 0;
    A.showTab = function (name) {
      const to = A.order.indexOf(name), from = A.order.indexOf(A.cur);
      const dir = to >= from ? 1 : -1;
      let panel = null; try { panel = document.getElementById('p-' + name); } catch (e) { }
      /* motion off, hidden window, a missing panel, or a browser without view transitions: switch cleanly, no animation */
      if (still() || !panel || !document.startViewTransition) {
        orig(name);
        if (!still() && panel && panel.animate) {                                  // the gentler fallback: the page rises into place
          try { panel.getAnimations().forEach(a => a.cancel()); panel.animate([{ opacity: 0, transform: 'translateY(' + (10 * mv() * dir) + 'px)' }, { opacity: 1, transform: 'none' }], { duration: 240, easing: EASE }); } catch (e) { }
          settleSoon(panel);
        }
        return;
      }
      try {
        inflight++;
        /* the new page slides in from the side you are moving towards in the tab bar */
        root.dataset.vtdir = dir > 0 ? 'fwd' : 'back';
        /* the browser only runs the switch on its next painted frame; a minimised or covered window may not paint,
           so if that has not happened soon, switch anyway rather than leave the app on the old page */
        let done = false; const sw = () => { if (done) return; done = true; orig(name); };
        const t = document.startViewTransition(sw);
        /* a transition cut short (by this, or by a quick second click) is normal, not an error */
        try { t.ready.catch(() => { }); t.updateCallbackDone.catch(() => { }); } catch (e) { }
        setTimeout(() => { if (!done) { try { t.skipTransition(); } catch (e) { } sw(); } }, 300);
        /* the cards settle in once the cross-fade is over: animating them underneath it would only be hidden by it */
        if (t && t.finished && t.finished.then) t.finished.catch(() => { }).then(() => { inflight--; settleSoon(panel); });
        else { inflight--; settleSoon(panel); }
      } catch (e) { try { orig(name); } catch (e2) { } inflight = Math.max(0, inflight - 1); settleSoon(panel); }
    };
  } catch (e) { }

  /* ---------------- 2. the loading bar ----------------
     Wrapped around fetch rather than added to 200 call sites. Quiet requests (the constant polling) and long
     AI jobs are left out: the first would leave the bar on forever, the second already has its own spinner. */
  try {
    const QUIET = /\/api\/(ping|incoming|closing|warm|verse\/status|status|sys)\b/;
    const SLOWJOB = /\/api\/(chat|tts|transcribe|music\/gen|music\/status|imggen|img\/gen|pull|prep\/stock|prep\/pull|study|sf\/|wallpaper)/;
    const track = u => { try { const s = String(u); return /\/api\//.test(s) && !QUIET.test(s) && !SLOWJOB.test(s); } catch (e) { return false; } };
    let bar = null, pend = 0, pct = 0, trick = 0, hideT = 0;
    const el = () => { if (!bar) { bar = document.createElement('div'); bar.id = 'loadbar'; document.body.appendChild(bar); } return bar; };
    const step = () => { pct += (91 - pct) * .16; el().style.transform = 'scaleX(' + (pct / 100) + ')'; };
    const start = () => { if (still()) return; const b = el(); pend++; clearTimeout(hideT); b.classList.remove('done'); b.classList.add('on'); if (!trick) { pct = Math.max(pct, 6); step(); trick = setInterval(step, 260); } };
    const stop = () => {
      pend = Math.max(0, pend - 1); if (pend) return;
      clearInterval(trick); trick = 0; const b = el(); b.style.transform = 'scaleX(1)'; b.classList.add('done'); b.classList.remove('on');
      hideT = setTimeout(() => { b.classList.remove('done'); b.style.transform = 'scaleX(0)'; pct = 0; }, 340);
    };
    const real = window.fetch;
    window.fetch = function (u) {
      if (!track(u)) return real.apply(this, arguments);
      /* Timers belong to this one request, never shared: with a shared handle one call settling could cancel
         another's count, and a single request that never answers would keep the bar on screen for ever. */
      let live = false, guard = 0, p;
      const showT = setTimeout(() => {
        live = true; start();
        /* self-healing: something that runs for 12 seconds is a long job with its own spinner (building the
           classics index, fetching web pages), not a page load. Let it go, so the bar can never get stuck. */
        guard = setTimeout(() => { if (live) { live = false; stop(); } }, 12000);
      }, 140);
      try { p = real.apply(this, arguments); } catch (e) { clearTimeout(showT); clearTimeout(guard); if (live) { live = false; stop(); } throw e; }
      const fin = () => { clearTimeout(showT); clearTimeout(guard); if (live) { live = false; stop(); } };
      if (p && p.then) p.then(fin, fin); else fin();
      return p;
    };
    A.loadbar = { start, stop };
  } catch (e) { }

  /* ---------------- 3. the details ---------------- */

  /* shimmering placeholders, so a page that is still fetching looks like it is filling in */
  A.skel = (rows = 3) => {
    const n = Math.max(1, Math.min(40, +rows || 3));
    let h = '<div class="skel h1"></div>';
    for (let i = 0; i < n; i++) h += '<div class="skel row" style="width:' + (96 - (i % 3) * 9) + '%;margin-bottom:8px"></div>';
    return h;
  };

  /* numbers that count to their value instead of appearing at it */
  A.countUp = (elm, to, opts = {}) => {
    const el2 = typeof elm === 'string' ? document.querySelector(elm) : elm; if (!el2) return;
    const end = +to || 0, from = +String(el2.textContent).replace(/[^\d.-]/g, '') || 0;
    const dur = opts.dur || 620, tail = opts.tail || '', head = opts.head || '', dec = opts.dec || 0;
    if (still() || Math.abs(end - from) < 1) { el2.textContent = head + end.toFixed(dec) + tail; return; }
    const t0 = performance.now();
    el2.classList.add('countup');
    const tick = now => {
      const k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 3);
      el2.textContent = head + (from + (end - from) * e).toFixed(dec) + tail;
      if (k < 1) requestAnimationFrame(tick); else el2.classList.remove('countup');
    };
    requestAnimationFrame(tick);
  };

  /* a quiet fade when the theme or interface style changes, instead of an instant jump */
  const fadeTheme = () => { if (still()) return; root.classList.add('theming'); clearTimeout(fadeTheme.t); fadeTheme.t = setTimeout(() => root.classList.remove('theming'), 300); };
  try {
    window.addEventListener('oa-theme', fadeTheme);
    if (window.OA_THEMES && window.OA_THEMES.applyStyle) { const st = window.OA_THEMES.applyStyle; window.OA_THEMES.applyStyle = function (id) { const r = st.apply(this, arguments); fadeTheme(); return r; }; }
    if (window.OA_THEMES && window.OA_THEMES.apply) { const ap = window.OA_THEMES.apply; window.OA_THEMES.apply = function (id) { const r = ap.apply(this, arguments); fadeTheme(); return r; }; }
  } catch (e) { }

  /* back to the top of a long page - one button, moved to whichever page is showing */
  try {
    const btn = document.createElement('button');
    btn.id = 'totop'; btn.title = 'Back to the top'; btn.setAttribute('aria-label', 'Back to the top'); btn.textContent = '↑';
    btn.onclick = () => { const s = live(); if (s) { try { s.scrollTo({ top: 0, behavior: 'smooth' }); } catch (e) { s.scrollTop = 0; } } };
    document.body.appendChild(btn);
    const live = () => { const p = document.querySelector('.panel.on'); return p && p.querySelector('.scroll, #mgrid, [class*=scroll]'); };
    let raf = 0;
    const check = () => {
      raf = 0; const s = live();
      /* the app bar deepens its shadow once the page has moved, so content reads as being under it */
      document.body.classList.toggle('scrolled', !!(s && s.scrollTop > 4));
      if (!s) { btn.classList.remove('on'); return; }
      const far = s.scrollHeight - s.clientHeight; btn.classList.toggle('on', far > 600 && s.scrollTop > 260);
    };
    document.addEventListener('scroll', () => { if (!raf) raf = requestAnimationFrame(check); }, true);
    A.on('motion', check);
    setInterval(check, 1200);
  } catch (e) { }

  /* long lists: let the browser skip work for rows that are far off screen (big pages get measurably faster) */
  try {
    const sweep = () => {
      const p = document.querySelector('.panel.on'); if (!p) return;
      const cs = p.querySelectorAll('div, ul, ol, tbody, section');
      for (const c of cs) {
        if (c.dataset.cvl) continue;
        if (c.children.length < 24 || c.scrollHeight < 900) continue;
        if (c.classList.contains('scroll') || c.id === 'mgrid') continue;                 // scroll containers must stay measurable
        c.dataset.cvl = '1'; c.classList.add('cvl');
        if (c.querySelectorAll(':scope > .hit, :scope > .bk').length > 16) c.classList.add('hits');
      }
    };
    let t = 0; const soon = (ms = 800) => { clearTimeout(t); t = setTimeout(sweep, ms); };
    document.addEventListener('click', () => soon(900), true);                 // a list that has just been drawn
    document.addEventListener('scroll', () => soon(400), true);
    /* one cheap check of the visible page's node count, so a page that filled in on its own is noticed too */
    let sig = -1;
    setInterval(() => {
      if (still()) return; const p = document.querySelector('.panel.on'); if (!p) return;
      const n = p.getElementsByTagName('*').length; if (n !== sig) { sig = n; soon(700); }
    }, 1800);
  } catch (e) { }
})();

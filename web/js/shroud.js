// The Moundshroud look (2026-11-13): a sidebar with drawn icons in place of the scrolling tab bar, tidy tools in the top
// bar, and a light that follows the pointer over cards. All the looks are in /web/shroud.css; this file builds the sidebar
// and sets a few CSS variables. It is on when the interface style is Modern and Settings > Appearance > "New look" is on
// (localStorage oa_shroud, anything but '0'). Loaded just before main.js, which is the first thing to build the tab bar.
(() => {
  const root = document.documentElement, nav = $('nav'), head = document.querySelector('body > header');
  if (!nav || !head) return;
  const wantLook = () => ls.get('shroud', '1') !== '0' && (root.dataset.style || 'modern') === 'modern';
  let on = false;

  /* ---------- icons: one drawn set, 24 x 24, stroked in the text colour ---------- */
  const IC = {
    home: 'M3 11.5 12 4l9 7.5M5.5 10v9.5h13V10M10 19.5v-5h4v5',
    news: 'M4 5h13v14H6a2 2 0 0 1-2-2zM17 9h3v8a2 2 0 0 1-2 2M7.5 9h6M7.5 12.5h6M7.5 16h4',
    chat: 'M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-7l-4.5 3.5V17H6a2 2 0 0 1-2-2z',
    web: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3',
    cal: 'M4 6.5h16v13H4zM4 10.5h16M8 4v4M16 4v4',
    lib: 'M5 4h4v16H5zM9 4h4v16H9zM14.2 6.2l3.8-1 3.6 13.5-3.8 1z',
    files: 'M3 7a2 2 0 0 1 2-2h4l2 2.5h8a2 2 0 0 1 2 2V17a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z',
    notes: 'M4 20h4L19.5 8.5l-4-4L4 16zM13.5 6.5l4 4',
    mail: 'M3.5 6h17v12h-17zM3.5 7l8.5 6.5L20.5 7',
    docs: 'M6 3.5h8l4 4v13H6zM14 3.5v4h4M9 13h6M9 16.5h4',
    offed: 'M4 5h16v14H4zM4 10h16M10 10v9',
    calc: 'M6 3.5h12v17H6zM9 7h6v3H9zM9 13.5h.01M12 13.5h.01M15 13.5h.01M9 17h.01M12 17h.01M15 17h.01',
    scan: 'M4 8V5.5A1.5 1.5 0 0 1 5.5 4H8M16 4h2.5A1.5 1.5 0 0 1 20 5.5V8M20 16v2.5a1.5 1.5 0 0 1-1.5 1.5H16M8 20H5.5A1.5 1.5 0 0 1 4 18.5V16M4 12h16',
    meet: 'M12 3.5a3 3 0 0 0-3 3v5a3 3 0 0 0 6 0v-5a3 3 0 0 0-3-3M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3',
    rem: 'M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15zM10 20.5a2 2 0 0 0 4 0',
    clip: 'M8 5H6v15.5h12V5h-2M8 3.5h8v3H8zM9 11h6M9 14.5h6',
    study: 'M2.5 9 12 4.5 21.5 9 12 13.5zM6.5 11v4.5c1.5 1.5 3.4 2.2 5.5 2.2s4-.7 5.5-2.2V11M21.5 9v5',
    lang: 'M4 5.5h9M8.5 3.5v2M6 5.5c.6 3.6 2.6 6.2 6 8M11.5 5.5c-.8 4-3.2 6.8-7 8.5M12.5 20.5l4-9.5 4 9.5M14 17.5h5',
    writing: 'M20 4c-7 0-12 4-13 12l-2.5 4.5M7 16c5 0 8.5-2 10.5-5.5M9.5 12.5h5',
    practice: 'M4 6h16v9H4zM12 15v5M8 20h8M8 10.5h8',
    teach: 'M12 4a3.2 3.2 0 1 0 0 6.4A3.2 3.2 0 0 0 12 4M5 20c.6-4 3.2-6 7-6s6.4 2 7 6',
    sky: 'M19.5 14.5A8 8 0 0 1 9.5 4.5a8 8 0 1 0 10 10M16 4.5l.7 1.8 1.8.7-1.8.7L16 9.5l-.7-1.8-1.8-.7 1.8-.7z',
    lab: 'M9.5 3.5h5M10.5 3.5v6L5 19a1 1 0 0 0 .9 1.5h12.2A1 1 0 0 0 19 19l-5.5-9.5v-6M7.8 15h8.4',
    studio: 'M12 3.5a8.5 8.5 0 1 0 0 17c1.4 0 2-1 2-2 0-1.5-1-1.7-1-3 0-1 .8-1.8 2-1.8h2a3.5 3.5 0 0 0 3.5-3.5c0-3.7-3.8-6.7-8.5-6.7M7.5 12h.01M9.5 8h.01M14 7.2h.01',
    cyber: 'M12 3.5 5 6v5.5c0 4.3 2.8 7.7 7 9 4.2-1.3 7-4.7 7-9V6zM9 12l2.2 2.2L15.2 10',
    tools: 'M4 9h16v10H4zM9 9V6h6v3M4 13.5h16M12 12.5v2',
    health: 'M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7M6 6l3.5 3.5M14.5 14.5 18 18M18 6l-3.5 3.5M9.5 14.5 6 18',
    kitchen: 'M5 10h14v6a3.5 3.5 0 0 1-3.5 3.5h-7A3.5 3.5 0 0 1 5 16zM3 10h18M9 6.5c0-1 1-1.2 1-2.5M14 6.5c0-1 1-1.2 1-2.5',
    garden: 'M12 20.5v-9M12 13c0-3.5-2.2-5.5-6.5-5.5C5.5 11 7.8 13 12 13M12 11.5c0-4 2.4-6.5 7-6.5 0 4.2-2.5 6.5-7 6.5',
    money: 'M4 7.5h14.5A1.5 1.5 0 0 1 20 9v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18zM4 7.5V6a1.5 1.5 0 0 1 1.5-1.5H16M16 13.5h.01',
    journal: 'M6 3.5h12v17H6zM9.5 3.5v17M13 8h2.5M13 11.5h2.5',
    albums: 'M4 7h13v12H4zM7 4h13v12M4 16l4-4 3.5 3.5 2-2L17 17',
    play: 'M7.5 8h9a4.5 4.5 0 0 1 4.4 5.4l-.5 2.6a2 2 0 0 1-3.5.9L15 14.5H9l-1.9 2.4a2 2 0 0 1-3.5-.9l-.5-2.6A4.5 4.5 0 0 1 7.5 8M8 10.5v2.5M6.75 11.75h2.5M15.5 11h.01M17.2 12.7h.01',
    music: 'M9 18.5V6l10-2v12.5M9 18.5a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0M19 16.5a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0',
    photos: 'M4 5h16v14H4zM4 15.5l4.5-4.5 4 4 2.5-2.5 5 5M15 9h.01',
    faith: 'M12 3.5v17M7 8.5h10',
    map: 'M9 4.5 3.5 6.5v13L9 17.5l6 2 5.5-2v-13L15 6.5zM9 4.5v13M15 6.5v13',
    guide: 'M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17M9.6 9.5a2.5 2.5 0 1 1 3.6 2.2c-.8.4-1.2 1-1.2 1.8M12 16.5h.01',
    timeline: 'M4 19.5h16M6 19.5v-9M10 19.5v-9M14 19.5v-9M18 19.5v-9M3.5 10.5 12 4.5l8.5 6z',
    /* the four menus */
    know: 'M4 8h16v11H4zM9 8V5.5h6V8M4 13h16',
    learn: 'M12 6.5c-2-1.3-4.5-2-8-2v13c3.5 0 6 .7 8 2 2-1.3 4.5-2 8-2v-13c-3.5 0-6 .7-8 2M12 6.5v13',
    life: 'M12 20s-7.5-4.4-7.5-10A4.3 4.3 0 0 1 12 7.4 4.3 4.3 0 0 1 19.5 10c0 5.6-7.5 10-7.5 10',
    fun: 'M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.8z',
    /* the top bar */
    search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14M16 16l4.5 4.5',
    hist: 'M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17M12 7.5V12l3 2',
    plus: 'M12 5v14M5 12h14',
    cog: 'M4 7h10M18 7h2M4 17h4M12 17h8M16 5v4M10 15v4',
    focus: 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5',
    rail: 'M4 5h16v14H4zM9.5 5v14',
    chev: 'M9 6l6 6-6 6',
  };
  const svg = (d, cls) => '<svg class="' + (cls || 'ic') + '" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="' + d + '"/></svg>';
  /* A.icon(id): the drawn icon for a tab or menu, or '' when the new look is off or there is none (callers fall back to the emoji) */
  A.icon = id => (on && IC[id]) ? svg(IC[id]) : '';

  /* ---------- the sidebar ---------- */
  const coreBuild = A.buildNav, coreMark = A.navMark;
  let coreClick = null, lastCur = null, inkT = 0;
  const opens = () => { try { return JSON.parse(ls.get('sh_open', '[]')) || []; } catch (e) { return []; } };
  const isMin = () => root.classList.contains('rail-min');
  /* a menu you unfold by hand stays unfolded (remembered); one that unfolded because you went to a page inside it
     folds again when you leave, so the sidebar does not grow longer and longer */
  const autoOpen = new Set();
  const setOpen = (g, open, auto) => {
    if (auto) autoOpen.add(g); else { autoOpen.delete(g); const o = opens().filter(x => x !== g); if (open) o.push(g); ls.set('sh_open', JSON.stringify(o)); }
    const box = nav.querySelector('.ngl[data-g="' + g + '"]'), b = nav.querySelector('button[data-grp="' + g + '"]');
    if (box) box.classList.toggle('open', open); if (b) b.setAttribute('aria-expanded', open ? 'true' : 'false');
    follow();
  };
  /* the marker behind the current page: it glides to the page's row (or to its menu when that menu is folded) */
  const ink = () => {
    const el = nav.querySelector('.nink'); if (!el) return;
    let t = nav.querySelector('button[data-tab].on');
    if (t && (isMin() || !t.offsetParent || (t.closest('.ngl') && !t.closest('.ngl').classList.contains('open')))) { const g = t.closest('.ngl'); t = g ? nav.querySelector('button[data-grp="' + g.dataset.g + '"]') : t; }
    if (!t || !t.offsetParent) { el.style.opacity = '0'; return; }
    const nr = nav.getBoundingClientRect(), r = t.getBoundingClientRect();
    el.style.opacity = '1'; el.style.width = r.width + 'px'; el.style.height = r.height + 'px';
    el.style.transform = 'translate(' + (r.left - nr.left + nav.scrollLeft) + 'px,' + (r.top - nr.top + nav.scrollTop) + 'px)';
  };
  /* while a menu unfolds, rows move every frame: the marker follows them instead of gliding after them */
  const follow = () => {
    const el = nav.querySelector('.nink'); if (!el) return; cancelAnimationFrame(inkT);
    const t0 = performance.now(); el.classList.add('live');
    const step = now => { ink(); if (now - t0 < 380) inkT = requestAnimationFrame(step); else { el.classList.remove('live'); ink(); } };
    inkT = requestAnimationFrame(step); setTimeout(() => { el.classList.remove('live'); ink(); }, 420);
  };
  const row = (n, sub) => '<button type="button" data-tab="' + n + '"' + (sub ? ' class="nsub"' : '') + ' title="' + esc(A.tabs[n].label) + '"><span class="ni">' + (IC[n] ? svg(IC[n]) : esc(A.NAVIC[n] || '•')) + '</span><span class="nl">' + esc(A.tabs[n].label) + '</span></button>';
  const build = () => {
    const seen = {}, open = opens(), cur = A.groupOf(A.cur);
    let h = '<i class="nink" aria-hidden="true"></i>';
    A.order.filter(n => !A.tabs[n].hidden).forEach(n => {
      const gid = A.groupOf(n); if (!gid) { h += row(n); return; } if (seen[gid]) return; seen[gid] = 1;
      const g = A.NAVGROUPS.find(x => x.id === gid), isOpen = open.includes(gid) || cur === gid; if (cur === gid && !open.includes(gid)) autoOpen.add(gid);
      h += '<button type="button" class="ngh" data-grp="' + gid + '" aria-expanded="' + isOpen + '" title="' + esc(g.label) + '"><span class="ni">' + (IC[gid] ? svg(IC[gid]) : g.icon) + '</span><span class="nl">' + esc(g.label) + '</span>' + svg(IC.chev, 'nx') + '</button>' +
        '<div class="ngl' + (isOpen ? ' open' : '') + '" data-g="' + gid + '"><div class="ngi">' + g.tabs.filter(t => A.tabs[t] && !A.tabs[t].hidden).map(t => row(t, 1)).join('') + '</div></div>';
    });
    nav.innerHTML = h; nav.setAttribute('aria-label', 'Pages');
    nav.onclick = click; mark();
  };
  const mark = () => {
    const g = A.groupOf(A.cur);
    nav.querySelectorAll('button[data-tab]').forEach(b => { const is = b.dataset.tab === A.cur; b.classList.toggle('on', is); if (is) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
    nav.querySelectorAll('button[data-grp]').forEach(b => b.classList.toggle('has', b.dataset.grp === g));
    /* arriving on a page inside a folded menu unfolds it once; folding it again afterwards is respected */
    if (A.cur !== lastCur) {
      lastCur = A.cur; let moved = false;
      autoOpen.forEach(x => { if (x !== g) { autoOpen.delete(x); const bx = nav.querySelector('.ngl[data-g="' + x + '"]'), bb = nav.querySelector('button[data-grp="' + x + '"]'); if (bx) bx.classList.remove('open'); if (bb) bb.setAttribute('aria-expanded', 'false'); moved = true; } });
      const box = g && nav.querySelector('.ngl[data-g="' + g + '"]'); if (box && !box.classList.contains('open')) { setOpen(g, true, true); return; }
      if (moved) { follow(); return; }
    }
    ink();
  };
  /* with the sidebar folded to icons, a menu opens as a small list beside it */
  const flyout = b => {
    const g = A.NAVGROUPS.find(x => x.id === b.dataset.grp); if (!g) return;
    const p = A.pop(b, '<div class="grp" style="margin-top:0">' + esc(g.label) + '</div>' + g.tabs.filter(t => A.tabs[t]).map(t => '<div class="hit row" data-t="' + t + '" style="cursor:pointer;gap:10px;padding:7px 8px' + (A.cur === t ? ';font-weight:700' : '') + '"><span class="ni">' + (IC[t] ? svg(IC[t]) : (A.NAVIC[t] || '')) + '</span>' + esc(A.tabs[t].label) + '</div>').join(''), 'left');
    const r = b.getBoundingClientRect(); p.style.minWidth = '200px'; p.style.left = (r.right + 10) + 'px'; p.style.top = Math.max(8, Math.min(innerHeight - p.offsetHeight - 8, r.top - 6)) + 'px';
    p.onclick = ev => { const it = ev.target.closest('[data-t]'); if (it) { A.closePop(); A.showTab(it.dataset.t); } };
  };
  const click = e => {
    const b = e.target.closest('button'); if (!b || !nav.contains(b)) return;
    if (b.dataset.tab) return A.showTab(b.dataset.tab);
    if (b.dataset.grp) { if (isMin()) flyout(b); else setOpen(b.dataset.grp, b.getAttribute('aria-expanded') !== 'true'); }
  };
  A.buildNav = () => {
    if (!coreClick) { coreBuild(); coreClick = nav.onclick; }             // the classic bar wires its own handlers once; they are kept for when the look is switched back
    if (on) build(); else { nav.onclick = coreClick; nav.removeAttribute('aria-label'); coreBuild(); }
  };
  A.navMark = () => { if (on && nav.querySelector('.nink')) mark(); else coreMark(); };
  /* the classic bar turns the mouse wheel into sideways scrolling; in the sidebar the wheel must scroll it up and down */
  nav.addEventListener('wheel', e => { if (on) e.stopImmediatePropagation(); }, true);
  nav.addEventListener('scroll', () => { if (on) ink(); }, { passive: true });
  addEventListener('resize', () => { if (on) { fit(); ink(); } });

  /* folded to icons: by choice (the button in the top bar), or by itself in a narrow window */
  const narrow = () => innerWidth < 900;
  const fit = () => { const min = ls.get('sh_rail', '') === 'min' || narrow(); if (min !== isMin()) { root.classList.toggle('rail-min', min); follow(); } };
  const toggleRail = () => {
    if (narrow()) { A.toast('The sidebar shows names again in a wider window.'); return; }
    ls.set('sh_rail', isMin() ? '' : 'min'); fit();
  };

  /* ---------- the top bar: drawn icons, a search box, a button that folds the sidebar ---------- */
  const TOP = { talk: ['meet', 'Talk'], hist: ['hist', 'History'], newc: ['plus', 'New chat'], cog: ['cog', 'Settings'], afbtn: ['focus', 'Focus'] };
  const keep = {};                                                       // what each button said before, for switching the look back
  const dress = () => {
    if (!on) return;
    if (!$('shfold')) { const b = document.createElement('button'); b.type = 'button'; b.id = 'shfold'; b.className = 'ib'; b.title = 'Show or hide the page names in the sidebar'; b.setAttribute('aria-label', b.title); b.innerHTML = svg(IC.rail); b.onclick = toggleRail; head.insertBefore(b, head.firstChild); }
    Object.keys(TOP).forEach(id => {
      const b = $(id); if (!b || b.closest('header') !== head || b.querySelector('svg.ic')) return;
      if (id === 'talk' && !/talk/i.test(b.textContent)) return;        // while it is listening it says something else: leave that alone
      if (!(id in keep)) keep[id] = b.innerHTML;
      b.innerHTML = svg(IC[TOP[id][0]]) + '<span class="hl' + (id === 'talk' || id === 'newc' ? ' always' : '') + '">' + TOP[id][1] + '</span>';
      if (!b.getAttribute('aria-label')) b.setAttribute('aria-label', TOP[id][1]);
    });
    const gs = $('gs'); if (gs && !gs.querySelector('svg.ic')) { if (!('gs' in keep)) keep.gs = gs.innerHTML; gs.innerHTML = svg(IC.search) + '<span class="hl always">Search or run a command</span><kbd>Ctrl K</kbd>'; gs.setAttribute('aria-label', 'Search everything, or run a command'); }
  };
  const undress = () => { Object.keys(keep).forEach(id => { const b = $(id); if (b) b.innerHTML = keep[id]; delete keep[id]; }); const f = $('shfold'); if (f) f.remove(); };

  /* ---------- a soft light under the pointer on cards (one listener for the whole app) ---------- */
  let lit = null, raf = 0, px = 0, py = 0;
  document.addEventListener('pointermove', e => {
    if (!on || e.pointerType === 'touch') return; px = e.clientX; py = e.clientY; if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0; if (A.motion && A.motion.still && A.motion.still()) return;
      const el = document.elementFromPoint(px, py), c = el && el.closest && el.closest('.card, .td-card, .td-tile, .feat, .nw-ev, .mk-tile, .am-card');
      if (lit && lit !== c) lit.classList.remove('lit');
      if (c) { const r = c.getBoundingClientRect(); c.style.setProperty('--mx', (px - r.left) + 'px'); c.style.setProperty('--my', (py - r.top) + 'px'); c.classList.add('lit'); }
      lit = c || null;
    });
  }, { passive: true });

  /* ---------- switching the look on and off ---------- */
  const sync = () => {
    const want = wantLook(); if (want === on && root.classList.contains('sh') === on) return;
    on = want; root.classList.toggle('sh', on);
    /* the older "Modern polish" layer (pro.css) steps aside while this look is on; its own switch decides again when it is off */
    root.classList.toggle('nopro', on || ls.get('nopro', '0') === '1');
    if (on) { fit(); dress(); } else { root.classList.remove('rail-min'); undress(); }
    if (A.order.length && nav.children.length) A.buildNav();
  };
  A.shroud = { get on() { return on; }, set(v) { ls.set('shroud', v ? '1' : '0'); sync(); }, sync, icons: IC, fold: toggleRail };
  sync();
  new MutationObserver(sync).observe(root, { attributes: true, attributeFilter: ['data-style'] });
  /* other scripts add their top-bar buttons (History, Focus) after this one runs, and Talk changes its words while listening */
  A.ready.push(() => { dress(); setTimeout(dress, 600); });
  setInterval(() => { if (on) { dress(); if (!document.hidden) ink(); } }, 1500);

  /* ---------- the first time the new look appears: say so, and offer the way back ---------- */
  A.ready.push(() => {
    let prev = null; try { prev = JSON.parse(localStorage.getItem('oa_shroud_prev') || 'null'); } catch (e) { }
    if (!on || !prev || ls.get('shroud_hello', '') === '1') return; ls.set('shroud_hello', '1');       // a first install has no old look to mention
    setTimeout(() => {
      const n = A.notify('info', 'Moundshroud has a new look: a sidebar, a new logo and a new colour theme. Settings › Appearance changes any of it.', 16000);
      if (!n || !n.el) return;
      const b = document.createElement('button'); b.type = 'button'; b.className = 'ib'; b.textContent = 'Use my old colours'; b.style.marginLeft = '8px';
      b.onclick = ev => { ev.stopPropagation(); try { if (prev.theme) window.OA_THEMES.apply(prev.theme); if (prev.style && prev.style !== 'modern') window.OA_THEMES.applyStyle(prev.style); } catch (x) { } n.close(); };
      n.el.querySelector('.ntm').appendChild(b);
    }, 2200);
  });
})();

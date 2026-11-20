// Shared helpers and the tab system. Everything hangs off the global `A`.
const $ = id => document.getElementById(id);
const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const ls = {
  get(k, d) { try { const v = localStorage.getItem('oa_' + k); return v === null ? d : v; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('oa_' + k, v); } catch (e) {} }
};
const A = { caps: {}, tabs: {}, order: [], cur: 'home', ready: [], version: '1.1.0', built: '2026-10-27' };
/* the helpers pages reach for most often. `esc` lives on A as well as at the top level, because half the pages call
   A.esc() inside a virtual-list renderer; without it those lists drew nothing at all. */
A.esc = esc;

const nowMs = () => (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
A.api = async (path, body) => {
  const o = body === undefined ? {} : { method: 'POST', body: JSON.stringify(body) };
  const t0 = nowMs();
  const r = await fetch(path, o); const j = await r.json();
  /* anything that took a noticeable time is worth seeing in the ⏱ list: it is the shape of why the app feels slow */
  try { const ms = nowMs() - t0; if (A.act && ms >= 100) A.act.mark('net', (o.method || 'GET') + ' ' + path.replace(/^\/api\//, ''), ms, { ok: r.ok, note: r.ok ? '' : 'HTTP ' + r.status }); } catch (e) { }
  return j;
};
/* Notifications: a quiet stack in the bottom corner. A.toast(message) works exactly as it always has, and
   A.notify(kind, message, ms) is for when the kind matters (info, ok, warn, err): it picks the colour, the
   icon and how long to stay. Hovering holds one still, clicking dismisses it, and only the newest four are kept. */
let nthost = null;
const KIND = { info: 'i', ok: '✓', warn: '!', err: '✕' };
const guessKind = m => {
  const s = String(m == null ? '' : m).trim();
  if (/^(could not|cannot|can’t|can't|failed|that is not|that file|sorry|unable|no |nothing )/i.test(s)) return 'err';
  if (/^(copied|saved|added|removed|restored|imported|opened|cleared|done|deleted|created|updated|set |now |🏆|⭐|🎉|✅|🔋|🗑️)/i.test(s)) return 'ok';
  return 'info';
};
A.notify = (kind, m, ms) => {
  const k = KIND[kind] ? kind : 'info';
  if (!nthost) { nthost = document.createElement('div'); nthost.id = 'nts'; nthost.setAttribute('aria-live', 'polite'); document.body.appendChild(nthost); }
  const el = document.createElement('div');
  el.className = 'nt nt-' + k;
  el.innerHTML = '<span class="nti"></span><span class="ntm"></span><button class="ntx" type="button" aria-label="Dismiss">&times;</button><i class="ntp"></i>';
  el.querySelector('.nti').textContent = KIND[k];
  el.querySelector('.ntm').textContent = String(m == null ? '' : m);
  const ttl = Math.max(1200, +ms || (k === 'err' ? 6500 : k === 'warn' ? 4400 : 2600));
  el.style.setProperty('--ttl', ttl + 'ms');
  const kill = () => { clearTimeout(el._t); el.classList.add('gone'); setTimeout(() => { el.remove(); if (nthost && !nthost.children.length) { nthost.remove(); nthost = null; } }, 240); };
  el.querySelector('.ntx').onclick = e => { e.stopPropagation(); kill(); };
  el.onclick = kill;
  /* a long one is worth a second look: hovering stops it sliding away, and leaving gives you a moment more */
  el.onmouseenter = () => { clearTimeout(el._t); el.classList.add('hold'); };
  el.onmouseleave = () => { el.classList.remove('hold'); el._t = setTimeout(kill, 1600); };
  nthost.appendChild(el);
  while (nthost.children.length > 4) nthost.firstElementChild.remove();
  el._t = setTimeout(kill, ttl);
  return { close: kill, el };
};
A.toast = (m, ms) => A.notify(guessKind(m), m, ms);

/* keep-alive pages: in a host that shows one page at a time (Studio, Tools, Prepare, the tool tabs, Cyber, Chat's panes),
   each page is made once and then only hidden and shown again. Switching away never throws away a picture being drawn,
   a reply being written or a form half filled in. A page may set el._onShow (run each time it comes back, e.g. to take
   something sent to it) and el._onHide. opts.fresh makes it again from scratch (its _cleanup runs first). */
A.keep = (host, key, render, opts) => {
  opts = opts || {}; if (!host) return null;
  if (!host._kp || host._kpGone) { if (host._cleanup) { try { host._cleanup(); } catch (e) { } host._cleanup = null; } host.innerHTML = ''; host._kp = {}; host._kpGone = false; }
  const P = host._kp, drop = el => { if (el._cleanup) { try { el._cleanup(); } catch (e) { } } el.remove(); };
  for (const k of Object.keys(P)) if (k !== key) { const el = P[k]; if (!el.isConnected) { delete P[k]; continue; } if (!el.hidden) { el.hidden = true; if (el._onHide) { try { el._onHide(); } catch (e) { } } } }
  let el = P[key];
  if (el && (opts.fresh || !el.isConnected)) { drop(el); el = null; }
  if (!el) {
    el = document.createElement('div'); el.className = 'kpage'; el.dataset.kp = key; host.appendChild(el); P[key] = el;
    try { render(el); } catch (e) { el.innerHTML = '<div class="pad bad">This page hit a problem: ' + String(e && e.message || e).replace(/[<>&]/g, '') + '</div>'; }
  } else { el.hidden = false; if (el._onShow) { try { el._onShow(); } catch (e) { } } }
  return el;
};
/* forget every kept page of a host (its pages' _cleanup runs); the next A.keep makes them fresh */
A.keepReset = host => { if (!host || !host._kp) return; for (const el of Object.values(host._kp)) { if (el._cleanup) { try { el._cleanup(); } catch (e) { } } } host._kpGone = true; };
A.registerTab = (name, label, onShow, opts = {}) => { A.tabs[name] = { label, onShow, hidden: !!opts.hidden }; A.order.push(name); };
/* A page only needs to keep working while you are on it or an AI is working on it. A.aiBusy(tab,on) marks a page
   whose AI job must keep running when you switch away; A.pageAwake(tab) is true for the open tab and those pages.
   A.every(tab,ms,fn) is a timer that skips its work while the tab is asleep, so hidden pages stop polling and drawing. */
A.awake = () => !document.hidden && (document.hasFocus ? document.hasFocus() : true);   // the app is in front and in use, not minimised or behind another window
A.hold = new Set();
A.aiBusy = (name, on) => { if (on) A.hold.add(name); else A.hold.delete(name); };
A.pageAwake = name => A.cur === name || A.hold.has(name);
A.every = (name, ms, fn) => setInterval(() => { if (A.pageAwake(name)) { try { fn(); } catch (e) { } } }, ms);

/* Performance: reduced polling for background tabs. Foreground = normal speed, Background = 5x slower, Hidden = paused */
const POLL_MULTIPLIER = { foreground: 1, background: 5, hidden: 0 };
let _pollState = 'foreground';
function _updatePollState() {
  if (document.hidden) _pollState = 'hidden';
  else if (document.hasFocus ? document.hasFocus() : true) _pollState = 'foreground';
  else _pollState = 'background';
}
document.addEventListener('visibilitychange', _updatePollState);
window.addEventListener('focus', _updatePollState);
window.addEventListener('blur', _updatePollState);
_updatePollState();

/* A.every with adaptive polling - skips work when tab is asleep or app is in background */
const _origEvery = A.every;
A.every = (name, ms, fn) => {
  const baseMs = ms * POLL_MULTIPLIER[_pollState];
  return _origEvery(name, baseMs, () => {
    if (!A.pageAwake(name)) return;
    if (_pollState === 'hidden') return;
    try { fn(); } catch (e) { }
  });
};

/* One-time idle callback for non-critical work */
A.onIdle = fn => {
  if ('requestIdleCallback' in window) requestIdleCallback(fn, { timeout: 5000 });
  else setTimeout(fn, 0);
};

/* Debounce helper for frequent events */
A.debounce = (fn, ms = 150) => {
  let t; return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
};

/* Throttle helper for high-frequency events */
A.throttle = (fn, ms = 100) => {
  let last = 0; return (...args) => { const now = Date.now(); if (now - last >= ms) { last = now; fn(...args); } };
};

/* Memory: track and warn on large arrays */
A.mem = {
  track: (name, arr) => { if (Array.isArray(arr) && arr.length > 5000) console.warn(`Large array ${name}: ${arr.length} items`); },
  clear: (obj, keys) => { keys.forEach(k => { if (obj[k] && typeof obj[k] === 'object') obj[k] = []; }); }
};

/* Virtual scrolling for large lists - renders only visible items */
A.virtualList = (host, items, renderItem, opts = {}) => {
  const { itemHeight = 40, overscan = 5, onScroll } = opts;
  let scrollTop = 0;
  let startIdx = 0;
  let endIdx = 0;
  let wrapper = host.querySelector('.virtual-wrapper');

  if (!wrapper) {
    host.style.overflow = 'auto';
    host.innerHTML = '<div class="virtual-wrapper" style="position:relative"></div>';
    wrapper = host.querySelector('.virtual-wrapper');
  }

  const visibleCount = Math.ceil(host.clientHeight / itemHeight) + overscan * 2;

  function render() {
    const totalHeight = items.length * itemHeight;
    wrapper.style.height = totalHeight + 'px';

    startIdx = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
    endIdx = Math.min(items.length, startIdx + visibleCount);

    wrapper.innerHTML = '';
    for (let i = startIdx; i < endIdx; i++) {
      const div = document.createElement('div');
      div.style.position = 'absolute';
      div.style.top = i * itemHeight + 'px';
      div.style.height = itemHeight + 'px';
      div.style.left = 0;
      div.style.right = 0;
      div.innerHTML = renderItem(items[i], i);
      wrapper.appendChild(div);
    }
  }

  host.addEventListener('scroll', A.throttle(() => {
    scrollTop = host.scrollTop;
    render();
    onScroll?.(startIdx, endIdx);
  }, 16));

  const ro = new ResizeObserver(A.debounce(render, 50));
  ro.observe(host);

  return {
    refresh: render,
    scrollTo: idx => { host.scrollTop = idx * itemHeight; },
    setItems: newItems => { items.length = 0; items.push(...newItems); render(); },
    destroy: () => ro.disconnect()
  };
};

/* Virtual grid for grid layouts */
A.virtualGrid = (host, items, renderItem, opts = {}) => {
  const { colWidth = 160, colHeight = 200, cols = 4, overscan = 2 } = opts;
  let scrollTop = 0;
  let wrapper = host.querySelector('.virtual-wrapper');

  if (!wrapper) {
    host.style.overflow = 'auto';
    host.innerHTML = '<div class="virtual-wrapper" style="position:relative"></div>';
    wrapper = host.querySelector('.virtual-wrapper');
  }

  const rowHeight = colHeight;
  const rowsPerScreen = Math.ceil(host.clientHeight / rowHeight) + overscan;

  function render() {
    const totalRows = Math.ceil(items.length / cols);
    const totalHeight = totalRows * rowHeight;
    wrapper.style.height = totalHeight + 'px';

    const startRow = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan);
    const endRow = Math.min(totalRows, startRow + rowsPerScreen);

    wrapper.innerHTML = '';
    for (let r = startRow; r < endRow; r++) {
      for (let c = 0; c < cols; c++) {
        const idx = r * cols + c;
        if (idx >= items.length) continue;
        const div = document.createElement('div');
        div.style.position = 'absolute';
        div.style.top = r * rowHeight + 'px';
        div.style.left = c * colWidth + 'px';
        div.style.width = colWidth + 'px';
        div.style.height = colHeight + 'px';
        div.innerHTML = renderItem(items[idx], idx);
        wrapper.appendChild(div);
      }
    }
  }

  host.addEventListener('scroll', A.throttle(() => {
    scrollTop = host.scrollTop;
    render();
  }, 16));

  const ro = new ResizeObserver(A.debounce(render, 50));
  ro.observe(host);

  return { refresh: render, destroy: () => ro.disconnect() };
};

/* IntersectionObserver-based lazy image loading */
A.lazyImages = (root = document) => {
  const images = root.querySelectorAll('img[data-src]:not([data-lazy-done])');
  const obs = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const img = entry.target;
        img.src = img.dataset.src;
        img.onload = () => img.removeAttribute('data-src');
        img.dataset.lazyDone = '1';
        obs.unobserve(img);
      }
    });
  }, { rootMargin: '100px' });
  images.forEach(img => obs.observe(img));
  return obs;
};

/* Performance observer for long tasks */
A.perf = {
  marks: [],
  measure: (name, startMark, endMark) => {
    try { performance.measure(name, startMark, endMark); } catch (e) { }
  },
  mark: name => { performance.mark(name); A.perf.marks.push(name); },
  getEntries: () => performance.getEntriesByType('measure'),
  clear: () => { performance.clearMeasures(); A.perf.marks = []; },
  onLongTask: cb => {
    if ('PerformanceObserver' in window) {
      try {
        const obs = new PerformanceObserver(list => {
          list.getEntries().forEach(e => cb(e));
        });
        obs.observe({ entryTypes: ['longtask'] });
        return obs;
      } catch (e) { }
    }
  }
};

A.showTab = name => {
  if (!A.tabs[name]) return;
  const _t0 = nowMs();
  const prev = A.cur; A.cur = name; try { A.closePop(); } catch (e) { }
  if (prev !== name) { try { A.emit('tab:hide', prev); } catch (e) { } } try { A.emit('tab:show', name); } catch (e) { }
  /* every page is switched off except this one, whether or not its module has registered its tab yet: a page loaded
     later (the Chat tab is loaded on its own) must never stay on under the one being shown */
  for (const p of document.querySelectorAll('section.panel')) p.classList.toggle('on', p.id === 'p-' + name);
  try { A.navMark(); } catch (e) { }
  requestAnimationFrame(() => { const ab = document.querySelector('#nav button.on'); if (ab && ab.scrollIntoView) ab.scrollIntoView({ block: 'nearest', inline: 'center' }); });   // in the next frame: done here it forced a second full layout of the new page       // keep the active tab visible in a narrow window
  /* one page failing to open must never take the rest of the app with it: it gets a "try again" card instead */
  const fail = e => { try { A.problems && A.problems.push('page', 'Opening ' + name + ': ' + (e && e.message || e), (e && e.stack || '').split('\n')[1] || ''); } catch (x) { } const p = $('p-' + name); if (p && !p.textContent.trim()) { p.innerHTML = '<div class="pad" style="margin:auto;max-width:460px;text-align:center"><h3>This page hit a problem</h3><p class="mute small">The rest of Moundshroud still works. The details were saved for Settings › Problems.</p><button class="pri" onclick="A.showTab(\'' + name + '\')">Try again</button></div>'; } };
  if (A.tabs[name].onShow) { try { const r = A.tabs[name].onShow(); if (r && r.catch) r.catch(fail); } catch (e) { fail(e); } }
  /* how long the page took to be on screen: the work and the paint after it. The timer stops early in a window that is
     hidden or covered (a browser may pause animation frames for minutes), so the number always means something. */
  if (A.act) {
    let done = false;
    const fin = () => { if (done) return; done = true; try { A.act.mark('page', 'Opened ' + ((A.tabs[name] && A.tabs[name].label) || name), nowMs() - _t0, { tab: name }); } catch (e) { } };
    requestAnimationFrame(() => setTimeout(fin, 0)); setTimeout(fin, 1200);
  }
};
/* alphabetical order for lists and contents (switch: Settings > Appearance > Alphabetical order); the key ignores emoji and symbols */
A.az = (list, key) => { if (ls.get('alpha', '1') === '0') return list; const k = x => String(key ? key(x) : x).replace(/<[^>]*>/g, '').replace(/^[^\p{L}\p{N}]+/u, '').toLowerCase(); return list.slice().sort((a, b) => k(a).localeCompare(k(b), undefined, { numeric: true, sensitivity: 'base' })); };
/* top bar: related tabs fold into three menus (switch off in Settings > Appearance > Grouped top bar) */
/* the menus in the top bar (the ids are kept from the old names so saved settings still match) */
A.NAVGROUPS = [{ id: 'know', icon: '🏢', label: 'Office', tabs: ['lib', 'files', 'notes', 'mail', 'docs', 'offed', 'calc', 'scan', 'meet', 'rem', 'clip'] }, { id: 'learn', icon: '🎒', label: 'Education', tabs: ['study', 'lang', 'writing', 'practice', 'teach', 'sky', 'lab'] }, { id: 'life', icon: '🏡', label: 'Personal', tabs: ['kitchen', 'garden', 'money', 'journal', 'albums'] }, { id: 'fun', icon: '🎉', label: 'Entertainment', tabs: ['play', 'music', 'radio', 'tv', 'photos'] }];
A.NAVIC = { brain: '🧠', globe: '🌎', docs: '📄', offed: '📂', calc: '🧮', scan: '📷', meet: '🎙️', rem: '⏰', clip: '📋', writing: '✍️', practice: '🎤', teach: '🧑‍🎓', albums: '📚', journal: '📓', news: '📰', map: '🗺️', cyber: '🛡️', web: '🌐', chat: '💬', lib: '📚', files: '🗂️', notes: '📝', study: '🎓', tools: '🧰', music: '🎼', radio: '📻', tv: '📺', photos: '🖼️', mail: '✉️', lang: '🌍', studio: '🎨', home: '🏠', faith: '✝️', sky: '🔭', health: '🛟', play: '🎭', guide: '✨', cal: '📅', kitchen: '🍳', garden: '🌱', lab: '🔬', timeline: '🏛️', money: '💰' };
A.navOn = () => ls.get('navgroups', '1') !== '0';
A.groupOf = n => { if (!A.navOn()) return null; const g = A.NAVGROUPS.find(g => g.tabs.includes(n)); return g ? g.id : null; };
A.navMark = () => {
  document.querySelectorAll('#nav button').forEach(b => {
    if (b.dataset.grp) { const g = A.NAVGROUPS.find(x => x.id === b.dataset.grp), on = A.groupOf(A.cur) === g.id; b.classList.toggle('on', on); b.innerHTML = g.icon + '&nbsp;' + g.label + (on ? ': ' + esc(A.tabs[A.cur].label) : '') + ' <span class="mute" style="font-size:10px">&#9662;</span>'; }
    else b.classList.toggle('on', b.dataset.tab === A.cur);
  });
};
A.buildNav = () => {
  const tabBtn = n => '<button data-tab="' + n + '">' + (A.NAVIC[n] ? A.NAVIC[n] + '&nbsp;' : '') + esc(A.tabs[n].label) + '</button>', seen = {}, nav = $('nav');
  nav.innerHTML = A.order.filter(n => !A.tabs[n].hidden).map(n => { const g = A.groupOf(n); if (!g) return tabBtn(n); if (seen[g]) return ''; seen[g] = 1; return '<button data-grp="' + g + '"></button>'; }).join('');
  if (!nav._wired) {
    nav._wired = true;
    nav.addEventListener('wheel', e => { if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) { nav.scrollLeft += e.deltaY; e.preventDefault(); } }, { passive: false });
    nav.onclick = e => {
      const b = e.target.closest('button'); if (!b) return; if (b.dataset.tab) return A.showTab(b.dataset.tab);
      const g = A.NAVGROUPS.find(x => x.id === b.dataset.grp); if (!g) return;
      const p = A.pop(b, '<div class="grp" style="margin-top:0">' + g.icon + ' ' + g.label + '</div>' + g.tabs.filter(t => A.tabs[t]).map(t => '<div class="hit row" data-t="' + t + '" style="cursor:pointer;gap:8px;padding:7px 8px;border-radius:8px' + (A.cur === t ? ';font-weight:700' : '') + '"><span style="width:22px;text-align:center">' + (A.NAVIC[t] || '') + '</span>' + esc(A.tabs[t].label) + '</div>').join(''), 'left');
      p.style.minWidth = '190px'; p.onclick = ev => { const it = ev.target.closest('[data-t]'); if (it) { A.closePop(); A.showTab(it.dataset.t); } };
    };
  }
  A.navMark();
};

/* dialog + popover */
A.dlg = (html, wide) => { $('dlg').innerHTML = html; $('ov').classList.add('on'); $('dlg').style.width = wide ? 'min(760px,96vw)' : ''; };
A.closeDlg = () => { $('ov').classList.remove('on'); $('dlg').innerHTML = ''; };
$('ov').addEventListener('mousedown', e => { if (e.target.id === 'ov') A.closeDlg(); });
A.pop = (anchor, html, align) => {
  const p = $('pop'); p.innerHTML = html; p.style.display = 'block';
  const r = anchor.getBoundingClientRect(); p.style.maxWidth = Math.min(380, innerWidth - 20) + 'px'; p.style.minWidth = '240px';
  const w = p.offsetWidth, h = p.offsetHeight;
  let x = align === 'left' ? r.left : r.right - w; x = Math.max(8, Math.min(innerWidth - w - 8, x));
  let y = r.top - h - 6; if (y < 8) y = r.bottom + 6;
  p.style.left = x + 'px'; p.style.top = y + 'px'; return p;
};
A.closePop = () => { $('pop').style.display = 'none'; };
document.addEventListener('mousedown', e => { if (!e.target.closest('#pop') && !e.target.closest('[data-pop]')) A.closePop(); });

A.fmtDate = ms => new Date(ms).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
A.fmtAgo = ms => { const s = (Date.now() - ms) / 1000; if (s < 60) return 'just now'; if (s < 3600) return Math.floor(s / 60) + ' min ago'; if (s < 86400) return Math.floor(s / 3600) + ' h ago'; return Math.floor(s / 86400) + ' d ago'; };
A.debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
A.copy = async t => { try { await navigator.clipboard.writeText(t); A.toast('Copied'); } catch (e) { A.toast('Could not copy'); } };

/* a tiny event bus so tabs can talk to each other */
A.bus = {}; A.on = (e, f) => { (A.bus[e] = A.bus[e] || []).push(f); return () => A.off(e, f); }; A.off = (e, f) => { if (A.bus[e]) A.bus[e] = A.bus[e].filter(x => x !== f); }; A.emit = (e, d) => (A.bus[e] || []).slice().forEach(f => { try { f(d); } catch (x) { } });

/* model ordering: largest first by default, or the user's chosen default model (Settings › AI & power) pinned first */
A.modelOrder = (() => {
  const bare = n => String(n || '').replace(/:latest$/, '');
  const gb = n => !n ? '' : n >= 107374182 ? (n / 1073741824).toFixed(1) + ' GB' : Math.max(1, Math.round(n / 1048576)) + ' MB';
  const paramScore = s => {
    const t = String(s || '');
    const mx = /\b(\d+(?:\.\d+)?)\s*x\s*(\d+(?:\.\d+)?)\s*b\b/i.exec(t);
    if (mx) return (+mx[1]) * (+mx[2]) * 1e9;
    const b = /(?:^|[^a-z0-9])e?(\d+(?:\.\d+)?)\s*b(?![a-z0-9])/i.exec(t);
    if (b) return (+b[1]) * 1e9;
    const m = /(?:^|[^a-z0-9])(\d+(?:\.\d+)?)\s*m(?![a-z0-9])/i.exec(t);
    if (m) return (+m[1]) * 1e6;
    return 0;
  };
  const keyOf = m => (m && typeof m === 'object') ? String(m.name || m.id || '') : String(m || '');
  const matches = (m, want) => {
    if (!want) return false;
    const k = keyOf(m);
    if (k === want || bare(k) === bare(want)) return true;
    if ((want === 'free-auto' && k === 'free-agent') || (want === 'free-agent' && k === 'free-auto')) return true;
    return false;
  };
  /* Settings › Default model can follow Chat instead of pinning one model: LAST is saved, and the model Chat last
     used (ls 'model') is the default everywhere until another model is picked there. */
  const LAST = '__last__';
  const rawDefault = () => String(ls.get('default_model', '') || '').trim();
  const isLast = () => rawDefault() === LAST;
  const get = () => isLast() ? String(ls.get('model', '') || '') : rawDefault();
  /* a value that may be the LAST marker (for example one that came from the server) becomes a real model name */
  const resolve = d => String(d == null ? '' : d) === LAST ? get() : String(d == null ? '' : d);
  const sync = serverDefault => {
    if (typeof serverDefault === 'string') ls.set('default_model', serverDefault);
    return get();
  };
  const set = async name => {
    const v = String(name == null ? '' : name).trim();
    ls.set('default_model', v);
    /* changing the default model in Settings takes effect across tabs right away */
    try { localStorage.removeItem('agentmodel'); localStorage.removeItem('bible_model'); } catch (e) { }
    ['cmp_ai_model', 'gm_model', 'gd_model'].forEach(k => ls.set(k, ''));
    /* following Chat means the chat keeps the model it has: only a real model becomes the default everywhere */
    if (v && v !== LAST) { ls.set('model', v); if (!/^claude-|free-auto|free-agent/i.test(v)) ls.set('local_model', v); }
    try { await A.api('/api/default-model', { model: v }); } catch (e) { }
    A.emit('default-model', v);
    return v;
  };
  const isDefault = (m, defOverride) => {
    const def = resolve(defOverride !== undefined ? defOverride : get());
    return !!def && matches(m, def) && (!m || m.tools !== false);
  };
  const sort = (list, defOverride) => {
    const arr = Array.isArray(list) ? list.slice() : [];
    const def = resolve(defOverride !== undefined ? defOverride : get());
    return arr.sort((a, b) => {
      const aDef = !!def && matches(a, def) && (!a || a.tools !== false);
      const bDef = !!def && matches(b, def) && (!b || b.tools !== false);
      if (aDef !== bDef) return aDef ? -1 : 1;
      const aCloud = !!(a && (a.cloud || a.free));
      const bCloud = !!(b && (b.cloud || b.free));
      if (aCloud !== bCloud) return aCloud ? 1 : -1;
      const as = +(a && a.size) || 0, bs = +(b && b.size) || 0;
      if (as !== bs) return bs - as;
      if (!as && !bs) {
        const ap = paramScore(keyOf(a) + ' ' + ((a && a.label) || ''));
        const bp = paramScore(keyOf(b) + ' ' + ((b && b.label) || ''));
        if (ap !== bp) return bp - ap;
      }
      return 0;
    });
  };
  const label = (m, opts) => {
    opts = opts || {};
    const cloud = !!(m && (m.cloud || m.free));
    let txt = cloud ? (m.label || m.name || '') : bare(m && m.name);
    if (!cloud && m && m.size) txt += ' · ' + gb(m.size);
    if (opts.custom && m && m.custom) txt += ' (yours)';
    if (opts.showWhere) txt += cloud ? ' (online)' : ' (on this PC)';
    if (opts.toolsNote && m && m.tools === false) txt += ' · cannot use tools';
    if (!opts.noDefaultTag && isDefault(m, opts.defaultModel)) txt += ' · default';
    return txt;
  };
  return { LAST, bare, gb, paramScore, matches, get, isLast, sync, set, isDefault, sort, label };
})();

/* ==========================================================================
   Moundshroud In-App Modals & OS-Popup Guard (A.confirm, A.prompt, A.alert)
   Replaces all native browser/Windows popups ("127.0.0.1 says...") and OS
   Notification popups with cohesive, theme-aware Moundshroud dialogs.
   ========================================================================== */
(() => {
  const DANGER_RE = /\b(delete|remove|reset|clear|resign|abort|abandon|retire|disconnect|forget|wipe|overwrite|discard|kick|close .+ for good|lost|replaced)\b/i;
  let queue = Promise.resolve();

  function openModal(kind, message, defVal, opts) {
    opts = opts || {};
    const run = () => new Promise(resolve => {
      const msg = String(message == null ? '' : message);
      const isDanger = opts.danger != null ? !!opts.danger : (kind === 'confirm' && DANGER_RE.test(msg));
      const title = opts.title || (kind === 'prompt' ? 'Moundshroud' : kind === 'alert' ? 'Notice' : isDanger ? 'Please confirm' : 'Confirm');
      const okLabel = opts.okLabel || (kind === 'alert' ? 'OK' : kind === 'prompt' ? 'Save' : isDanger ? 'Confirm' : 'Continue');
      const cancelLabel = opts.cancelLabel || 'Cancel';
      const icon = opts.icon || (kind === 'alert' ? '✦' : kind === 'prompt' ? '✎' : isDanger ? '⚠' : '✦');

      const ov = document.createElement('div');
      ov.className = 'mdlg-ov';
      ov.setAttribute('role', 'dialog');
      ov.setAttribute('aria-modal', 'true');
      ov.innerHTML =
        '<div class="mdlg-card' + (isDanger ? ' mdlg-dang' : '') + '">' +
          '<div class="mdlg-hd">' +
            '<span class="mdlg-ic">' + esc(icon) + '</span>' +
            '<div class="mdlg-ht"><b class="mdlg-t">' + esc(title) + '</b><span class="mdlg-brand">Moundshroud</span></div>' +
          '</div>' +
          '<div class="mdlg-bd">' +
            '<div class="mdlg-msg">' + esc(msg).replace(/\n/g, '<br>') + '</div>' +
            (kind === 'prompt' ? '<input type="text" class="mdlg-in" autocomplete="off">' : '') +
          '</div>' +
          '<div class="mdlg-ft">' +
            (kind !== 'alert' ? '<button type="button" class="ib mdlg-no">' + esc(cancelLabel) + '</button>' : '') +
            '<button type="button" class="' + (isDanger ? 'ib dang mdlg-ok mdlg-ok-dang' : 'pri mdlg-ok') + '">' + esc(okLabel) + '</button>' +
          '</div>' +
        '</div>';

      document.body.appendChild(ov);
      const inp = ov.querySelector('.mdlg-in');
      const okBtn = ov.querySelector('.mdlg-ok');
      const noBtn = ov.querySelector('.mdlg-no');
      if (inp) {
        inp.value = defVal == null ? '' : String(defVal);
        setTimeout(() => { inp.focus(); inp.select(); }, 20);
      } else {
        setTimeout(() => { (isDanger && noBtn ? noBtn : okBtn).focus(); }, 20);
      }

      let done = false;
      const finish = val => {
        if (done) return;
        done = true;
        document.removeEventListener('keydown', onKey, true);
        ov.classList.add('out');
        setTimeout(() => ov.remove(), 150);
        resolve(val);
      };
      const accept = () => finish(kind === 'prompt' ? (inp ? inp.value : '') : true);
      const cancel = () => finish(kind === 'prompt' ? null : false);

      const onKey = e => {
        if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); cancel(); }
        else if (e.key === 'Enter' && (!inp || document.activeElement === inp || document.activeElement === okBtn)) {
          if (document.activeElement === noBtn) return;
          e.preventDefault(); e.stopPropagation(); accept();
        }
      };
      document.addEventListener('keydown', onKey, true);
      okBtn.onclick = accept;
      if (noBtn) noBtn.onclick = cancel;
      ov.addEventListener('click', e => { if (e.target === ov) cancel(); });
    });
    const next = queue.then(run, run);
    queue = next.catch(() => {});
    return next;
  }

  A.confirm = (msg, opts) => openModal('confirm', msg, '', opts);
  A.prompt = (msg, defVal, opts) => openModal('prompt', msg, defVal, opts);
  A.alert = (msg, opts) => openModal('alert', msg, '', opts);

  /* Intercept stray window.alert & OS Notification calls so Windows popups never appear */
  try { window.alert = msg => { A.alert(msg); }; } catch (e) { }
  try {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      function InAppNotification(title, options) {
        const body = options && options.body ? ' — ' + options.body : '';
        A.notify('info', String(title || 'Moundshroud') + body, 5000);
        this.close = () => {};
      }
      InAppNotification.permission = 'granted';
      InAppNotification.requestPermission = () => Promise.resolve('granted');
      window.Notification = InAppNotification;
    }
  } catch (e) { }
})();

/* Universal fullscreen helper for any terminal sandbox (viewport fullscreen + optional OS monitor fullscreen, Esc to exit) */
(() => {
  let active = null;
  const setHtml = on => {
    document.documentElement.classList.toggle('term-fs-on', !!on);
    if (!on && document.fullscreenElement) {
      try { document.exitFullscreen().catch(() => {}); } catch (e) { }
    }
  };
  function syncOsButtons() {
    document.querySelectorAll('.term-fs-os').forEach(b => {
      b.textContent = document.fullscreenElement ? '🗗 Window' : '🖥 Monitor';
    });
  }
  function exit() {
    const a = active;
    active = null;
    if (a && a.box) {
      a.box.classList.remove('term-fs');
      a.box.querySelectorAll('.term-fs-os').forEach(n => n.remove());
    }
    if (a && a.btn) {
      a.btn.textContent = '⛶ Fullscreen';
      a.btn.title = 'Fullscreen terminal (Esc to exit)';
      a.btn.classList.remove('on');
    }
    setHtml(false);
    if (a && typeof a.onExit === 'function') { try { a.onExit(); } catch (e) { } }
  }
  function apply(box, on, btn, onExit) {
    if (!box) return false;
    if (on) {
      if (active && active.box !== box) exit();
      box.classList.add('term-fs');
      active = { box, btn, onExit };
      setHtml(true);
    } else {
      box.classList.remove('term-fs');
      if (active && active.box === box) active = null;
      if (!document.querySelector('.term-fs-box.term-fs')) setHtml(false);
    }
    if (btn) {
      btn.textContent = on ? '✕ Exit' : '⛶ Fullscreen';
      btn.title = on ? 'Exit fullscreen (Esc)' : 'Fullscreen terminal (Esc to exit)';
      btn.classList.toggle('on', !!on);
    }
    const bar = btn && btn.parentElement;
    if (bar) {
      let osBtn = bar.querySelector('.term-fs-os');
      if (on && document.documentElement.requestFullscreen) {
        if (!osBtn) {
          osBtn = document.createElement('button');
          osBtn.type = 'button';
          osBtn.className = 'ib term-fs-os';
          osBtn.title = 'Toggle monitor fullscreen';
          osBtn.onclick = ev => {
            ev.stopPropagation();
            if (document.fullscreenElement) { try { document.exitFullscreen().catch(() => {}); } catch (e) { } }
            else { try { document.documentElement.requestFullscreen().catch(() => {}); } catch (e) { } }
          };
          bar.insertBefore(osBtn, btn);
        }
        osBtn.textContent = document.fullscreenElement ? '🗗 Window' : '🖥 Monitor';
      } else if (osBtn) {
        osBtn.remove();
      }
    }
    return !!on;
  }
  function toggle(box, btn, onExit) {
    if (!box) return false;
    return apply(box, !box.classList.contains('term-fs'), btn, onExit);
  }
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && active) {
      if (e.target.closest?.('.tpg-manual[open]')) return;
      if (!active.box || !document.contains(active.box)) { exit(); return; }
      e.preventDefault();
      e.stopImmediatePropagation();
      exit();
    }
  }, true);
  document.addEventListener('fullscreenchange', syncOsButtons);
  if (A.on) A.on('tab:hide', () => { if (active) exit(); });
  A.termFS = { apply, toggle, exit, active: () => !!active };
})();

/* Full screen for the Browser: any page it is showing (search results, an article, a page from this PC) fills this window, and the whole monitor
   too when the window allows it. Esc or the button brings the rest of the app back. */
(() => {
  let on = false, native = false;
  const box = () => document.getElementById('p-web');
  function label() {
    document.querySelectorAll('.page-fs-btn').forEach(b => {
      /* the words sit in their own span, so a narrow Browser toolbar can show just the icon */
      b.innerHTML = (on ? '🗗' : '⛶') + '<span class="fsw"> ' + (on ? 'Exit full screen' : 'Full screen') + '</span>';
      b.title = on ? 'Exit full screen (Esc)' : 'Full screen this page (Esc to exit)';
      b.classList.toggle('on', on);
    });
  }
  function set(v) {
    on = !!v; native = false;
    document.documentElement.classList.toggle('page-fs-on', on);
    const el = box(); if (el) el.classList.toggle('page-fs-box', on);
    label();
    if (on) {
      /* the class above already fills the window; the monitor is a bonus the window may refuse */
      if (el && el.requestFullscreen) { try { el.requestFullscreen().then(() => { native = true; }, () => { native = false; }); } catch (e) { } }
    } else if (document.fullscreenElement) {
      try { document.exitFullscreen().catch(() => { }); } catch (e) { }
    }
    return on;
  }
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && on) { e.preventDefault(); e.stopImmediatePropagation(); set(false); }
  }, true);
  document.addEventListener('fullscreenchange', () => { if (on && native && !document.fullscreenElement) set(false); });
  if (A.on) A.on('tab:hide', () => { if (on) set(false); });
  A.pageFS = { toggle: () => set(!on), set, refresh: label, on: () => on };
})();

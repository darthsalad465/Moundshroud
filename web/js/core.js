// Shared helpers and the tab system. Everything hangs off the global `A`.
const $ = id => document.getElementById(id);
const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const ls = {
  get(k, d) { try { const v = localStorage.getItem('oa_' + k); return v === null ? d : v; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('oa_' + k, v); } catch (e) {} }
};
const A = { caps: {}, tabs: {}, order: [], cur: 'home', ready: [], version: '1.1.0', built: '2026-10-27' };

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
A.showTab = name => {
  if (!A.tabs[name]) return;
  const _t0 = nowMs();
  const prev = A.cur; A.cur = name; try { A.closePop(); } catch (e) { }
  if (prev !== name) { try { A.emit('tab:hide', prev); } catch (e) { } } try { A.emit('tab:show', name); } catch (e) { }
  for (const n of A.order) { const p = $('p-' + n); if (p) p.classList.toggle('on', n === name); }      // a missing page must not stop the others being hidden
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
A.NAVIC = { docs: '📄', offed: '📂', calc: '🧮', scan: '📷', meet: '🎙️', rem: '⏰', clip: '📋', writing: '✍️', practice: '🎤', teach: '🧑‍🎓', albums: '📚', journal: '📓', news: '📰', map: '🗺️', cyber: '🛡️', web: '🌐', chat: '💬', lib: '📚', files: '🗂️', notes: '📝', study: '🎓', tools: '🧰', music: '🎼', radio: '📻', tv: '📺', photos: '🖼️', mail: '✉️', lang: '🌍', studio: '🎨', home: '🏠', faith: '✝️', sky: '🔭', health: '🛟', play: '🎭', guide: '✨', cal: '📅', kitchen: '🍳', garden: '🌱', lab: '🔬', timeline: '🏛️', money: '💰' };
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
A.bus = {}; A.on = (e, f) => { (A.bus[e] = A.bus[e] || []).push(f); }; A.emit = (e, d) => (A.bus[e] || []).forEach(f => f(d));

// Browser tab (was the Library tab): an offline web browser for the encyclopedias, dictionary, medical, tech-help and cooking/DIY books. Its homepage is the Search page (websearch.js),
// so searching and reading stay in one place. The Library tab (library.js) now holds just the classics and the chess books.
// Tabs, back / forward with a history list, reload, find in page, zoom, print, favorites, and your tabs come back next time.
(() => {
  const root = $('p-web');
  let books = [], book = '', hi = -1, sugT = null, curTitle = '', started = false, tabs = [], active = 0, f = null, uid = 1;
  const DARK = 'html,body{background:#0e1016!important;color:#dfe4f7!important}a{color:#a99bff!important}a:visited{color:#c3b6ff!important}' +
    'body{font-family:"Segoe UI",system-ui,sans-serif!important;line-height:1.6;max-width:880px;margin:0 auto;padding:14px 18px!important}' +
    'table,th,td{border-color:#2a3042!important;background-color:transparent!important;color:inherit!important}th{background:#1d212e!important}' +
    'pre,code,kbd,samp{background:#0b0e1a!important;color:#cfe3ff!important;border-color:#2a3042!important}' +
    'img{max-width:100%;height:auto}.infobox,.thumb,.navbox,.mw-collapsible,[class*=box]{background:#1d212e!important;color:inherit!important;border-color:#2a3042!important}' +
    'input,button{background:#1d212e!important;color:#e8ecfb!important;border:1px solid #2a3042!important}hr{border-color:#2a3042!important}' +
    'h1,h2,h3,h4,h5{border-color:#2a3042!important;color:#f4f6ff!important;font-family:inherit!important;line-height:1.3}svg{filter:invert(.9) hue-rotate(180deg)}' +
    /* some books (WikEM) colour their own text dark: force every text element readable, keep links coloured */
    'body *:not(a):not(a *):not(pre):not(pre *):not(code):not(h1):not(h2):not(h3):not(h4):not(h5):not(sup):not(.z1):not(.z2):not(.z3){color:#dfe4f7!important;background-color:transparent!important}' +
    'body{font-size:17px!important;line-height:1.7!important;padding:18px 22px 40px!important}p,li,dd,td{font-size:inherit!important;line-height:1.7!important;letter-spacing:0!important}' +
    'p{margin:.7em 0}ul,ol{padding-left:1.4em;margin:.5em 0}li{margin:.35em 0;list-style:disc outside!important;background:none!important}li::marker{color:#8b7cff}ul,ol,li{list-style-image:none!important;background-image:none!important}li::before,li::after{content:none!important;display:none!important}' +
    'h1{font-size:1.9em;margin:.4em 0}h2{font-size:1.4em;margin:1.4em 0 .4em;padding-bottom:.25em;border-bottom:1px solid #2a3042}h3{font-size:1.15em;margin:1.1em 0 .3em}' +
    'b,strong{color:#fff!important;font-weight:650}a{text-decoration:none;border-bottom:1px solid rgba(169,155,255,.35)}sup a{border:0}' +
    '[style*=background]{background:transparent!important}table{border-collapse:collapse;width:100%}td,th{padding:6px 10px;border:1px solid #2a3042!important}';

  const css = '#lhead{flex:none;border-bottom:1px solid var(--line);position:relative;background:var(--panel)}#ltabs{display:flex;gap:3px;padding:6px 8px 0;overflow-x:auto;scrollbar-width:none}.ltab{display:flex;align-items:center;gap:6px;max-width:190px;min-width:80px;padding:6px 8px 6px 11px;border-radius:9px 9px 0 0;background:var(--panel2);border:1px solid var(--line);border-bottom:0;cursor:pointer;font-size:12.5px;white-space:nowrap;opacity:.75}.ltab.on{background:var(--bg);opacity:1;border-color:var(--line)}.ltab span{overflow:hidden;text-overflow:ellipsis;flex:1}.ltab i{font-style:normal;opacity:.6;padding:0 3px;border-radius:5px}.ltab i:hover{background:var(--panel);opacity:1}#lnew{padding:4px 9px;border-radius:8px;cursor:pointer;opacity:.7;align-self:center}#lnew:hover{background:var(--panel2);opacity:1}' +
    '#lnav{display:flex;gap:5px;align-items:center;padding:6px 12px 3px;position:relative}#lnav .ib[disabled]{opacity:.35}#lbox{position:relative;flex:1;min-width:140px}#lbox input{width:100%}#lmenu{position:absolute;right:12px;top:100%;z-index:30;min-width:230px;background:var(--panel);border:1px solid var(--line);border-radius:12px;box-shadow:0 14px 40px rgba(0,0,0,.5);padding:6px;display:none}#lmenu div{padding:7px 10px;border-radius:8px;cursor:pointer;display:flex;gap:10px;white-space:nowrap}#lmenu div:hover{background:var(--panel2)}#lmenu div b{margin-left:auto;font-weight:400;opacity:.55;font-size:12px}#lmenu hr{border:0;border-top:1px solid var(--line);margin:4px 0}' +
    '#lfind{display:none;position:absolute;right:16px;top:4px;z-index:25;background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:6px 8px;gap:6px;align-items:center;box-shadow:0 8px 28px rgba(0,0,0,.45)}#lfind input{width:190px}#lframes{flex:1;position:relative;min-height:0;display:flex}#lframes iframe{flex:1;width:100%;border:0;background:#0e1016}#lhist{position:absolute;left:12px;top:100%;z-index:30;min-width:280px;max-width:440px;background:var(--panel);border:1px solid var(--line);border-radius:12px;box-shadow:0 14px 40px rgba(0,0,0,.5);padding:6px;display:none}#lhist div{padding:6px 10px;border-radius:8px;cursor:pointer;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}#lhist div:hover{background:var(--panel2)}#lhist div.cur{font-weight:700;color:var(--acc)}';
  if (!document.getElementById('libcss')) { const s = document.createElement('style'); s.id = 'libcss'; s.textContent = css; document.head.appendChild(s); }

  root.innerHTML =
    '<div id="lhead"><div id="ltabs"></div>' +
    '<div id="lnav"><button class="ib" id="lback" title="Back (Alt+Left). Right-click for the list">◀</button><button class="ib" id="lfwd" title="Forward (Alt+Right)">▶</button><button class="ib" id="lrel" title="Reload (Ctrl+R). While a page loads this stops it">⟳</button><button class="ib" id="lhome" title="Home: search Moundshroud’s offline archived internet (Alt+Home)">🏠</button>' +
    '<select id="lbook" style="display:none" title="Which library"></select>' +
    '<div id="lbox"><span id="lico">🔎</span><input id="wq" type="text" placeholder="Search Moundshroud, or type a page address" autocomplete="off" spellcheck="false"><button class="ib" id="lstar" title="Favorite this page (the star)">☆</button><div id="wsug"></div></div>' +
    '<button class="pri" id="wgo" style="display:none">Search</button><button class="ib" id="ltor" title="Tor Browser: browse the whole web privately through the Tor network (opens in its own window)">🧅 Tor</button><button class="ib" id="lbm" title="Bookmarks: save your place on this page and jump back to it (Ctrl+D)">🔖</button><button class="ib" id="lmore" title="Customize and control the Browser">⋮</button>' +
    '<div id="lmenu"></div><div id="lhist"></div></div><div id="lprog"></div><div id="lbmbar"></div>' +
    '<div class="chips" id="wbar" style="padding:3px 12px 7px"></div><div id="lfind"><input id="lfq" type="text" placeholder="Find in page"><span class="small mute" id="lfn"></span><button class="ib" id="lfp">▲</button><button class="ib" id="lfnx">▼</button><button class="ib" id="lfx">✕</button></div></div>' +
    '<div id="lframes"><div id="lstat"></div></div><div class="wh" id="wh"></div>';
  const q = $('wq'), sug = $('wsug'), frames = $('lframes'), head = $('lhead');
  /* 🧅 Tor: the official Tor Browser in its own window. The offline library stays here; the whole web goes through Tor
     there. If it is not on this PC yet, it can be fetched from Stock up's copy of the official download (checked first). */
  $('ltor').onclick = async () => {
    const typed = (q.value || '').trim(), url = /^(https?:\/\/|[a-z2-7]{16,56}\.onion\b)/i.test(typed) ? typed : '';
    let st; try { st = await A.api('/api/tor'); } catch (e) { return A.notify('err', 'Could not reach Moundshroud: ' + e.message); }
    if (st.installed) { const r = await A.api('/api/tor/open', { url }); return r.error ? A.notify('err', 'Tor Browser could not be opened: ' + r.error) : A.notify('ok', '🧅 Tor Browser is opening in its own window. Press “Connect” there the first time.' + (url ? ' It opens ' + url + '.' : ''), 7000); }
    if (st.job && st.job.status === 'downloading') return A.toast('Tor Browser is still being downloaded (' + st.job.pct + '%).');
    if (!(await A.confirm('Tor Browser is not on this PC yet.\n\nDownload it now? It is the official Tor Browser from torproject.org (about 120 MB). Moundshroud checks it against the fingerprint the Tor Project publishes before installing it, and it can be removed again in Prepare › Stock up.'))) return;
    const g = await A.api('/api/inv/get', { id: 'torbrowser' }); if (g.error) return A.notify('err', 'Could not start the download: ' + g.error);
    const btn = $('ltor'); btn.disabled = true;
    const poll = async () => {
      let s2; try { s2 = await A.api('/api/tor'); } catch (e) { s2 = {}; }
      if (s2.installed) { btn.disabled = false; btn.textContent = '🧅 Tor'; A.notify('ok', '🧅 Tor Browser is installed. Press 🧅 Tor again to open it.', 8000); return; }
      if (s2.job && s2.job.status === 'error') { btn.disabled = false; btn.textContent = '🧅 Tor'; return A.notify('err', 'Tor Browser was not installed: ' + s2.job.error, 9000); }
      btn.textContent = '🧅 ' + (s2.job ? (s2.job.note ? s2.job.note : s2.job.pct + '%') : '…'); setTimeout(poll, 1500);
    };
    poll();
  };
  const enc = encodeURIComponent, cats = () => A.az([...new Set(books.map(b => b.category))]);
  const setHead = () => { root.style.setProperty('--lhh', head.offsetHeight + 'px'); };
  try { new ResizeObserver(setHead).observe(head); } catch (e) { } setHead();
  const T = () => tabs[active], E = t => t && t.stack[t.i];
  const saveTabs = () => { try { ls.set('lib_tabs', JSON.stringify({ a: active, t: tabs.map(t => ({ id: t.id, i: t.i, z: t.z, s: t.stack.slice(-30).map(e => ({ u: e.u, t: e.t })) })) })); } catch (e) { } };

  /* ---------- tabs and frames ---------- */
  function mkTab(url, title) { const t = { id: uid++, stack: [], i: 0, z: 1, fr: null, nav: false }; t.stack.push(url ? { u: url, t: title || '' } : { u: '', t: 'Search' }); return t; }
  function frameFor(t) {
    if (t.fr) return t.fr; const fr = document.createElement('iframe'); fr.title = 'Library page'; fr.style.display = 'none';
    /* library pages live on their own address (libframe.js): everything below talks to them by message, never by reaching in */
    A.libframe.attach(fr, {
      load: m => onLoad(t, fr, m),
      ready: () => { if (t.fr === fr) fr.lf.text().then(x => { fr._text = x; }); },
      scroll: m => { const cur = E(t); if (cur && m.s) cur.sy = m.s.y; },
      hover: m => { const s = $('lstat'); if (!s) return; s.textContent = m.h || ''; s.style.display = m.h ? 'block' : 'none'; },
      back: () => back(), fwd: () => fwd(), sel: m => { lastSel = m.t; },
      newtab: m => { newTab(m.url, m.title, true); A.toast('Opened in a new tab'); },
      key: m => kd(Object.assign({ preventDefault() { }, target: { ownerDocument: null } }, m))
    });
    frames.appendChild(fr); t.fr = fr; return fr;
  }
  function render() {
    const tb = $('ltabs'); tb.innerHTML = tabs.map((t, i) => { const e = E(t); return '<div class="ltab' + (i === active ? ' on' : '') + (t.loading ? ' ld' : '') + '" data-ti="' + i + '" draggable="true" title="' + esc(e.t || 'Search') + '"><i class="lfav">' + (t.loading ? '◌' : favOf(e.u)) + '</i><span>' + esc(e.t || (e.u ? 'Loading...' : 'New tab')) + '</span><i data-tx="' + i + '" title="Close tab (Ctrl+W)">✕</i></div>'; }).join('') + '<div id="lnew" title="New tab (Ctrl+T)">＋</div>';
    const t = T(), e = E(t); $('lback').disabled = t.i <= 0; $('lfwd').disabled = t.i >= t.stack.length - 1; $('lrel').disabled = !e.u && !t.loading; $('lrel').textContent = t.loading ? '✕' : '⟳';
    const isPage = !!e.u; $('wh').style.display = isPage ? 'none' : ''; $('wgo').style.display = 'none'; $('lprog').classList.toggle('on', !!t.loading);
    tabs.forEach((x, i) => { if (x.fr) x.fr.style.display = (i === active && isPage) ? '' : 'none'; });
    $('lico').textContent = favOf(e.u); if (document.activeElement !== q) q.value = isPage ? (e.t || '') : '';
    bmBar(); favState(); setHead();
  }
  function switchTab(i) { if (i < 0 || i >= tabs.length) return; active = i; const t = T(); f = t.fr || null; closeMenus(); const e = E(t); if (e.u && !t.fr) navigateFrame(t, e.u, true); if (!e.u) { curTitle = ''; home(); } else curTitle = e.t || ''; render(); saveTabs(); }
  function newTab(url, title, bg) { if (tabs.length >= 10) { A.toast('Close a tab first (10 tabs is the limit)'); return; } const t = mkTab(url, title); tabs.push(t); if (!bg) switchTab(tabs.length - 1); else { if (url) navigateFrame(t, url, true); render(); saveTabs(); } return t; }
  function closeTab(i) { const t = tabs[i]; if (!t) return; { const e0 = E(t); if (e0 && e0.u) closed.push(e0); if (closed.length > 20) closed.shift(); } if (t.fr) t.fr.remove(); tabs.splice(i, 1); if (!tabs.length) tabs.push(mkTab()); if (active >= tabs.length) active = tabs.length - 1; else if (i < active) active--; switchTab(active); }
  function navigateFrame(t, url, ours) { const fr = frameFor(t); t.nav = !!ours; t.loading = true; clearTimeout(t.lt); t.lt = setTimeout(() => { t.loading = false; if (tabs.includes(t)) render(); }, 20000); fr._text = ''; fr.src = A.libframe.src(url); if (tabs.includes(t)) render(); }
  /* a small picture for each kind of page, standing in for a site icon */
  const favOf = u => !u ? '🔎' : /wiktionary/.test(u) ? '📕' : /gutenberg/.test(u) ? '📖' : /stackexchange|superuser|askubuntu|serverfault|unix\./.test(u) ? '💬' : /mdwiki|wikem|medic/.test(u) ? '🩺' : /devdocs/.test(u) ? '🛠️' : /wikivoyage/.test(u) ? '🧭' : /\/search\?/.test(u) ? '🔎' : /wikibooks|wikiversity/.test(u) ? '🎓' : /wikipedia/.test(u) ? '🌐' : '📄';
  /* the one navigation entry point: push a history entry, or move within it */
  function navigate(url, title, newT) {
    if (newT) return newTab(url, title);
    const t = T(); if (!url) { push(t, '', 'Search'); render(); home(); saveTabs(); return; }
    curTitle = title || ''; push(t, url, title || ''); navigateFrame(t, url, true); render(); saveTabs();
  }
  function push(t, u, ti) { t.stack = t.stack.slice(0, t.i + 1); t.stack.push({ u, t: ti }); if (t.stack.length > 60) t.stack.shift(); t.i = t.stack.length - 1; }
  function jump(t, i) { if (i < 0 || i >= t.stack.length) return; t.i = i; const e = t.stack[i]; closeMenus(); if (!e.u) { render(); home(); saveTabs(); return; } curTitle = e.t || ''; navigateFrame(t, e.u, true); render(); saveTabs(); }
  const back = () => jump(T(), T().i - 1), fwd = () => jump(T(), T().i + 1);

  function onLoad(t, fr, m) {
    t.loading = false; clearTimeout(t.lt);
    if (!fr.getAttribute('src') || !m || !m.url) return;
    const u = m.url, ent = E(t), ours = t.nav; t.nav = false;
    fr.lf.css(DARK + (A.custom ? A.custom.bookCss() : ''));
    const ttl = (m.title || '').replace(/\s*[-|].*$/, '').trim() || u;
    // a link was followed inside the page: record a new history entry. Pages we loaded ourselves (back, forward, search, tabs) only refresh theirs.
    if (!ours && ent && ent.u !== u) push(t, u, ttl); else if (ent) ent.u = u;
    const cur = E(t); cur.t = ttl;
    if (t === T()) { curTitle = ttl; try { A.fav.visit(u, ttl); } catch (e) { } }
    fr.lf.zoom(t.z);
    if (t.resume) { try { A.bm.restore(fr, t.resume); } catch (e) { } t.resume = null; }
    else if (cur.sy) fr.lf.restore({ y: cur.sy, p: 0, q: '' });
    try { A.bm.track(fr, u); } catch (e) { }
    if (t === T()) { f = fr; } render(); saveTabs();
  }

  /* ---------- toolbar, menus, keys ---------- */
  const closeMenus = () => { $('lmenu').style.display = 'none'; $('lhist').style.display = 'none'; };
  const curUrl = () => { const e = E(T()); return e && /\/wiki\/(content|viewer)/.test(e.u) ? e.u : ''; };
  function favState() { const u = curUrl(), on = u && A.fav && A.fav.has(u); $('lstar').textContent = on ? '⭐' : '☆'; const b = $('lfavb'); if (b) b.textContent = A.fav && A.fav.has('book:' + book, 'book') ? '⭐ Library favorited' : '☆ Favorite this library'; }
  document.addEventListener('favchange', favState);
  $('lback').onclick = back; $('lfwd').onclick = fwd; $('lrel').onclick = () => { const t = T(); if (t.loading) { if (t.fr) t.fr.lf.stop(); t.loading = false; render(); return; } if (t.fr) { t.loading = true; t.fr.lf.reload(); render(); } };
  $('lbm').onclick = () => A.bm.menu($('lbm'), { where: 'web', frame: () => T().fr, url: curUrl, title: () => curTitle || curUrl(), open: b => openUrl(b.u, b.t, { bm: b }) });
  $('lhome').onclick = () => goHome(); $('lstar').onclick = () => { const u = curUrl(); if (!u) return A.toast('Open a library page first'); A.fav.toggle({ u, t: curTitle || u, k: 'page' }); favState(); };
  const showHist = e => { if (e && e.preventDefault) e.preventDefault(); const t = T(), h = $('lhist'); h.innerHTML = t.stack.map((x, i) => '<div data-hi="' + i + '"' + (i === t.i ? ' class="cur"' : '') + '>' + esc(x.t || x.u || 'Search') + '</div>').reverse().join(''); h.style.display = 'block'; };
  $('lback').oncontextmenu = $('lfwd').oncontextmenu = showHist;
  $('lhist').onclick = e => { const d = e.target.closest('[data-hi]'); if (d) jump(T(), +d.dataset.hi); };
  $('ltabs').onclick = e => { if (e.target.id === 'lnew') return newTab(); const x = e.target.closest('[data-tx]'); if (x) { e.stopPropagation(); return closeTab(+x.dataset.tx); } const t = e.target.closest('[data-ti]'); if (t) switchTab(+t.dataset.ti); };
  $('ltabs').onauxclick = e => { if (e.button !== 1) return; const t = e.target.closest('[data-ti]'); if (t) { e.preventDefault(); closeTab(+t.dataset.ti); } };
  const MENU = [['🗂 New tab', 'newtab', 'Ctrl+T'], ['✕ Close tab', 'closetab', 'Ctrl+W'], ['↩ Reopen closed tab', 'reopen'], ['hr'], ['🔍 Find in page', 'find', 'Ctrl+F'], ['➕ Zoom in', 'zin', 'Ctrl +'], ['➖ Zoom out', 'zout', 'Ctrl -'], ['↺ Reset zoom', 'zreset', 'Ctrl 0'], ['🖨 Print or save as PDF', 'print', 'Ctrl+P'], ['hr'], ['🔗 Copy link to this page', 'copy'], ['🕘 History of this tab', 'thist'], ['🕘 All history', 'allhist', 'Ctrl+H'], ['⭐ Favorites', 'favs'], ['hr'], ['🔖 Show or hide the bookmarks bar', 'bmbar', 'Ctrl+Shift+B'], ['📕 Dictionary', 'dict'], ['📚 Thesaurus', 'thes'], ['🎵 Rhymer', 'rhy']];
  const closed = [];
  $('lmore').onclick = e => { e.stopPropagation(); const m = $('lmenu'); if (m.style.display === 'block') return closeMenus(); m.innerHTML = MENU.map(x => x[0] === 'hr' ? '<hr>' : '<div data-m="' + x[1] + '">' + x[0] + (x[2] ? '<b>' + x[2] + '</b>' : '') + '</div>').join('') + '<div class="small mute" style="cursor:default">Zoom ' + Math.round(T().z * 100) + '%</div>'; m.style.display = 'block'; };
  $('lmenu').onclick = e => { const d = e.target.closest('[data-m]'); if (!d) return; closeMenus(); act(d.dataset.m); };
  document.addEventListener('click', e => { if (!e.target.closest('#lmenu,#lmore,#lhist,#lback,#lfwd')) closeMenus(); });
  function zoom(dz) { const t = T(); t.z = dz === 0 ? 1 : Math.max(.5, Math.min(2.5, Math.round((t.z + dz) * 10) / 10)); if (t.fr) t.fr.lf.zoom(t.z); A.toast('Zoom ' + Math.round(t.z * 100) + '%', 900); saveTabs(); }
  function act(a) {
    const t = T();
    if (a === 'newtab') newTab(); else if (a === 'closetab') { const e = E(t); if (e && e.u) closed.push(e); closeTab(active); } else if (a === 'find') openFind(); else if (a === 'zin') zoom(.1); else if (a === 'zout') zoom(-.1); else if (a === 'zreset') zoom(0);
    else if (a === 'print') { if (t.fr && E(t).u) t.fr.lf.print(); else A.toast('Open a page first'); }
    else if (a === 'copy') { const u = curUrl(); if (u) A.copy(location.origin + u); else A.toast('Open a library page first'); }
    else if (a === 'thist') showHist(); else if (a === 'allhist') A.fav.open('hist'); else if (a === 'favs') A.fav.open('all'); else if (a === 'bmbar') { bmOn = !bmOn; ls.set('lib_bmbar', bmOn ? '1' : '0'); bmBar(); setHead(); } else if (a === 'dict' || a === 'thes' || a === 'rhy') { const w = (lastSel || '').trim().split(/\s+/)[0] || ''; if (a === 'thes') A.thes.open(w); else if (a === 'rhy') A.rhyme.open(w); else $('wbar').querySelector('[data-a=dict]').click(); }
    else if (a === 'reopen') { const e = closed.pop(); if (e && e.u) newTab(e.u, e.t); else A.toast('No closed tabs'); }
  }
  /* tab menu (right-click) and drag to reorder */
  $('ltabs').oncontextmenu = e => { const x = e.target.closest('[data-ti]'); if (!x) return; e.preventDefault(); const i = +x.dataset.ti; const p = A.pop(x, '<div class="ltmenu" style="min-width:210px"><div data-k="new">🗂 New tab</div><div data-k="dup">⧉ Duplicate</div><div data-k="rel">⟳ Reload</div><hr><div data-k="close">✕ Close tab</div><div data-k="others">Close other tabs</div><div data-k="right">Close tabs to the right</div></div>', 'left'); if (!p) return; x.dataset.pop = '1'; p.onclick = ev => { const k = (ev.target.closest('[data-k]') || {}).dataset; if (!k) return; A.closePop(); const t = tabs[i]; if (!t) return; if (k.k === 'new') newTab(); else if (k.k === 'dup') { const en = E(t); newTab(en.u, en.t); } else if (k.k === 'rel') { switchTab(i); $('lrel').click(); } else if (k.k === 'close') closeTab(i); else if (k.k === 'others') { tabs.filter(y => y !== t).forEach(y => { if (y.fr) y.fr.remove(); }); tabs = [t]; active = 0; switchTab(0); } else if (k.k === 'right') { tabs.slice(i + 1).forEach(y => { if (y.fr) y.fr.remove(); }); tabs = tabs.slice(0, i + 1); if (active > i) active = i; switchTab(active); } }; };
  let dragI = -1; $('ltabs').ondragstart = e => { const x = e.target.closest && e.target.closest('[data-ti]'); if (!x) return; dragI = +x.dataset.ti; try { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', 'tab'); } catch (x2) { } };
  $('ltabs').ondragover = e => { if (dragI < 0) return; e.preventDefault(); const x = e.target.closest('[data-ti]'); [...$('ltabs').children].forEach(c => c.classList && c.classList.remove('dragover')); if (x) x.classList.add('dragover'); };
  $('ltabs').ondrop = e => { if (dragI < 0) return; e.preventDefault(); const x = e.target.closest('[data-ti]'), to = x ? +x.dataset.ti : tabs.length - 1, cur0 = T(); if (to !== dragI) { const [mv] = tabs.splice(dragI, 1); tabs.splice(to, 0, mv); active = tabs.indexOf(cur0); saveTabs(); render(); } dragI = -1; };
  $('ltabs').ondragend = () => { dragI = -1; [...$('ltabs').children].forEach(c => c.classList && c.classList.remove('dragover')); };
  /* bookmarks bar: your bookmarks (saved places) and favorite pages */
  let bmOn = ls.get('lib_bmbar', '1') !== '0';
  function bmBar() { const el = $('lbmbar'); if (!el) return; el.classList.toggle('off', !bmOn); if (!bmOn) return; let its = []; try { its = A.bm.list().filter(b => b.w === 'web').slice(0, 10).map(b => ({ k: 'b', id: b.id, t: b.l || b.t, u: b.u })).concat(A.fav.list().filter(x => x.k === 'page' && /^\//.test(x.u)).slice(0, 12).map(x => ({ k: 'f', t: x.t, u: x.u }))); } catch (e) { } el.innerHTML = (its.length ? its.slice(0, 16).map((x, i) => '<span class="bmi" data-bi="' + i + '" title="' + esc(x.t) + '">' + (x.k === 'b' ? '🔖' : '⭐') + ' ' + esc(String(x.t).slice(0, 26)) + '</span>').join('') : '<span class="none">Bookmarks bar: press the ☆ or 🔖 on a page and it shows up here. (Ctrl+Shift+B hides this bar.)</span>') + '<span class="bmi more" data-bi="all" title="All favorites">⭐ All favorites</span>'; el._its = its; el.onclick = e => { const c = e.target.closest('[data-bi]'); if (!c) return; if (c.dataset.bi === 'all') return A.fav.open('all'); const x = el._its[+c.dataset.bi]; if (!x) return; if (x.k === 'b') { const b = A.bm.list().find(y => y.id === x.id); if (b) return openUrl(b.u, b.t, { bm: b }); } openUrl(x.u, x.t); }; }
  document.addEventListener('bmchange', bmBar);
  q.addEventListener('focus', () => setTimeout(() => q.select(), 0));
  /* find in page */
  function openFind() { const b = $('lfind'); b.style.display = 'flex'; const i = $('lfq'); i.focus(); i.select(); }
  function closeFind() { $('lfind').style.display = 'none'; const t = T(); if (t && t.fr) t.fr.lf.clearFind(); }
  function doFind(back2) {
    const v = $('lfq').value; if (!v) { $('lfn').textContent = ''; return; } const t = T(); if (!t.fr) return;
    t.fr.lf.find(v, back2).then(n => { if ($('lfq').value !== v) return; $('lfn').textContent = n ? n + ' found' : 'Not found'; });
  }
  $('lfq').oninput = () => doFind(false); $('lfq').onkeydown = e => { e.stopPropagation(); if (e.key === 'Enter') doFind(e.shiftKey); else if (e.key === 'Escape') closeFind(); };
  $('lfp').onclick = () => doFind(true); $('lfnx').onclick = () => doFind(false); $('lfx').onclick = closeFind;
  function kd(e) {
    if (!root.classList.contains('on')) return; const k = e.key || '', c = e.ctrlKey || e.metaKey, lk = k.toLowerCase();
    if (e.altKey && k === 'ArrowLeft') { e.preventDefault(); back(); } else if (e.altKey && k === 'ArrowRight') { e.preventDefault(); fwd(); }
    else if (c && lk === 't') { e.preventDefault(); if (e.shiftKey) act('reopen'); else newTab(); } else if (c && e.shiftKey && lk === 'b') { e.preventDefault(); act('bmbar'); } else if (c && lk === 'h') { e.preventDefault(); A.fav.open('hist'); } else if (e.altKey && k === 'Home') { e.preventDefault(); goHome(); } else if (c && /^[1-9]$/.test(k)) { e.preventDefault(); switchTab(k === '9' ? tabs.length - 1 : Math.min(+k - 1, tabs.length - 1)); } else if (c && lk === 'w') { e.preventDefault(); act('closetab'); }
    else if (c && lk === 'l') { e.preventDefault(); q.focus(); q.select(); } else if (c && lk === 'f') { e.preventDefault(); openFind(); }
    else if (c && lk === 'd') { e.preventDefault(); const u = curUrl(); if (!u) return A.toast('Open a page first, then press Ctrl+D to bookmark your place'); const b = A.bm.add(T().fr, 'web', u, curTitle || u); A.toast('🔖 Bookmarked at ' + Math.round(b.p * 100) + '%'); }
    else if ((c && lk === 'r') || k === 'F5') { e.preventDefault(); $('lrel').click(); } else if (c && (k === '=' || k === '+')) { e.preventDefault(); zoom(.1); } else if (c && k === '-') { e.preventDefault(); zoom(-.1); } else if (c && k === '0') { e.preventDefault(); zoom(0); }
    else if (c && k === 'Tab') { e.preventDefault(); switchTab((active + (e.shiftKey ? tabs.length - 1 : 1)) % tabs.length); }
    else if (c && lk === 'p' && E(T()).u) { e.preventDefault(); act('print'); }
    else if (k === 'Escape') { if ($('lfind').style.display === 'flex') closeFind(); else if (e.target && e.target.ownerDocument !== document) parent.postMessage('esc', '*'); }
  }
  document.addEventListener('keydown', e => { if (!root.classList.contains('on')) return; if (e.target.id === 'lfq') return; if (/INPUT|TEXTAREA|SELECT/.test(e.target.tagName) && !(e.ctrlKey || e.altKey || e.metaKey)) return; kd(e); }, true);
  document.addEventListener('mouseup', e => { if (!root.classList.contains('on')) return; if (e.button === 3) { e.preventDefault(); back(); } else if (e.button === 4) { e.preventDefault(); fwd(); } });

  /* ---------- home and the rest of the library ---------- */
  function home() {
    const h = $('wh'); h.style.display = ''; h.className = 'wh wsh'; A.websearch.mount(h); setTimeout(() => A.websearch.focus(), 40); return;
  }
  function pickCat(cat, hint) { const b = (hint && books.find(x => x.category === cat && hint.test(x.name))) || books.find(x => x.category === cat); if (b) { book = b.name; $('lbook').value = b.name; A.toast(cat + ' selected'); } }

  function bar() {
    $('wbar').innerHTML = '<span class="chip" data-a="favs" style="border-color:var(--acc)">⭐ Favorites</span><span class="chip" data-a="dict" style="border-color:var(--acc)">📕 Dictionary</span><span class="chip" data-a="thes" style="border-color:var(--acc)">📚 Thesaurus</span><span class="chip" data-a="rhy" style="border-color:var(--acc)">🎵 Rhymer</span><span class="chip" data-a="rand">Random</span><span class="chip" data-a="ask">Ask AI about this page</span><span class="chip" data-a="listen">Read aloud</span><span class="chip" data-a="note">Save to note</span>';
  }
  $('wbar').onclick = e => {
    const c = e.target.closest('.chip'); if (!c) return;
    switch (c.dataset.a) {
      case 'cls': A.classics.open(); break;
      case 'cbk': A.chessbooks.open(); break;
      case 'favs': A.fav.open('all'); break;
      case 'rand': random(); break;
      case 'dict': { const w = (lastSel || '').trim(); if (w && w.split(/\s+/).length <= 3 && /^[\p{L}'\u2019 -]+$/u.test(w)) define(w); else { navigate(''); A.websearch.mount($('wh')); A.websearch.dict(true); A.websearch.focus(); A.toast('Dictionary mode: type a word and press Enter'); } break; }
      case 'thes': A.thes.open(q.value.trim().split(/\s+/)[0] || ''); break;
      case 'rhy': A.rhyme.open(q.value.trim().split(/\s+/)[0] || ''); break;
      case 'listen': A.speech.speak(pageText(), c); break;
      case 'note': { const t = pageText(); if (!t) return A.toast('Open a page first'); A.notes.create(curTitle || 'Library page', '# ' + (curTitle || 'Library page') + '\n\n' + t.slice(0, 6000)); break; }
      case 'ask': {
        const t = pageText(); if (!t) return A.toast('Open a page first');
        const p = A.pop(c, ['Summarize this page', 'Explain it simply', 'Quiz me on it', 'Make flashcards', 'Ask my own question...'].map(x => '<div class="hit"><b>' + x + '</b></div>').join(''), 'left');
        p.onclick = ev => {
          const h = ev.target.closest('.hit'); if (!h) return; A.closePop(); const a = h.textContent, body = t.slice(0, 9000), ttl = curTitle || 'this page';
          if (a.startsWith('Make')) return A.study.fromText(body, ttl);
          if (a.startsWith('Ask')) { A.showTab('chat'); A.chat.setInput('About "' + ttl + '": '); pending = body; return; }
          const P = { Summarize: 'Summarize the article "' + ttl + '" in a few clear paragraphs.', Explain: 'Explain the article "' + ttl + '" in simple terms.', Quiz: 'Write 5 quiz questions with answers based on the article "' + ttl + '".' };
          A.chat.ask(P[a.split(' ')[0]] + '\n\nARTICLE:\n' + body, { noLocal: true, sources: [] });
        };
        c.dataset.pop = '1'; break;
      }
    }
  };
  let pending = null, lastSel = '';
  /* the page's text arrives from the page once it has loaded (libframe.js), so it is ready when a button needs it */
  function pageText() { const t = T(); return (t && t.fr && E(t).u && t.fr._text) || ''; }

  /* back to the screen you see when you first open the Library: closes shelves and any open page, clears the search */
  function goHome() { hideSug(); curTitle = ''; q.value = ''; navigate(''); }
  function show(url, title) { navigate(url, title); }
  function openUrl(url, title, opts) { A.showTab('web'); init().then(() => { if (!/^\//.test(url)) url = '/wiki/' + url; const r = navigate(url, title, opts && opts.newTab); if (opts && opts.bm) { const tt = r && r.id ? r : T(); tt.resume = opts.bm; } }); }
  function runSearch(term, bookName) {
    term = (term || '').trim(); if (!term) return; hideSug(); const bk = bookName || book || (books[0] || {}).name; if (!bk) return;
    show('/wiki/search?content=' + enc(bk) + '&pattern=' + enc(term), 'Results for ' + term);
  }
  async function random() { await init(); const bk = book || (books[0] || {}).name; if (!bk) return; show('/wiki/random?content=' + enc(bk), ''); }
  function openBook(name) {
    A.showTab('web'); init().then(() => { const bk = books.find(x => x.name === name); if (!bk) return A.toast('That library is not installed any more.'); book = name; $('lbook').value = name; navigate('/wiki/content/' + name, bk.title); });
  }

  function lab(s) { const d = document.createElement('div'); d.innerHTML = s; return esc(d.textContent).replace(/&lt;b&gt;/g, '<b>').replace(/&lt;\/b&gt;/g, '</b>'); }
  async function suggest() {
    const term = q.value.trim(); if (term.length < 2 || !book || /^\//.test(term)) return hideSug();
    try {
      const r = await (await fetch('/wiki/suggest?content=' + enc(book) + '&term=' + enc(term))).json();
      const items = (r || []).filter(x => x.path || x.value).slice(0, 8); if (!items.length || q.value.trim() !== term) return hideSug();
      hi = -1; sug.style.display = 'block'; sug.style.left = '0'; sug.style.right = '0'; sug.style.top = '100%'; sug.style.marginTop = '3px';
      sug.innerHTML = items.map(x => '<div data-p="' + esc(x.path || '') + '" data-v="' + esc(x.value || x.label || '') + '">' + lab(x.label || x.value) + '</div>').join('');
    } catch (e) { hideSug(); }
  }
  const hideSug = () => { sug.style.display = 'none'; sug.innerHTML = ''; hi = -1; };
  sug.onmousedown = e => { const d = e.target.closest('div'); if (!d) return; e.preventDefault(); chooseSug(d); };
  function chooseSug(d) { q.value = d.dataset.v; hideSug(); if (d.dataset.p) show('/wiki/content/' + book + '/' + d.dataset.p, d.dataset.v); else runSearch(d.dataset.v); }
  q.addEventListener('input', () => { clearTimeout(sugT); sugT = setTimeout(suggest, 180); });
  q.addEventListener('blur', () => setTimeout(hideSug, 150));
  q.addEventListener('keydown', e => {
    const items = [...sug.children];
    if (e.key === 'ArrowDown' && items.length) { e.preventDefault(); hi = (hi + 1) % items.length; items.forEach((x, i) => x.classList.toggle('hi', i === hi)); }
    else if (e.key === 'ArrowUp' && items.length) { e.preventDefault(); hi = (hi - 1 + items.length) % items.length; items.forEach((x, i) => x.classList.toggle('hi', i === hi)); }
    else if (e.key === 'Enter') { e.preventDefault(); if (hi >= 0 && items[hi]) chooseSug(items[hi]); else if (/^\/wiki\//.test(q.value.trim())) { show(q.value.trim(), ''); hideSug(); } else A.lib.search(q.value.trim()); }
    else if (e.key === 'Escape' && sug.style.display === 'block') { e.stopPropagation(); hideSug(); }
  });
  $('wgo').onclick = () => A.lib.search(q.value.trim());

  async function define(word) {
    word = (word || '').trim(); if (!word) return A.toast('Select a single word first');
    A.showTab('web'); await init();
    const d = books.find(b => b.category === 'Dictionary');
    if (!d) { A.toast('The dictionary is not installed - using the encyclopedia'); q.value = word; return runSearch(word); }
    book = d.name; $('lbook').value = d.name; q.value = word;
    try {
      const r = await (await fetch('/wiki/suggest?content=' + enc(d.name) + '&term=' + enc(word))).json();
      const exact = (r || []).find(x => (x.value || '').toLowerCase() === word.toLowerCase()) || (r || [])[0];
      if (exact && exact.path) return show('/wiki/content/' + d.name + '/' + exact.path, word);
    } catch (e) { }
    runSearch(word, d.name);
  }

  async function init() {
    if (started) return; started = true;
    try {
      const r = await A.api('/api/lib/books'); books = r.books || []; A.caps.lib = r.available; A.fav._books = books;
      $('lbook').innerHTML = cats().map(c => '<optgroup label="' + esc(c) + '">' + books.filter(b => b.category === c).map(b => '<option value="' + esc(b.name) + '">' + esc(b.title) + '</option>').join('') + '</optgroup>').join('');
      book = (books[0] || {}).name || ''; $('lbook').value = book; $('uwl').style.display = r.available ? '' : 'none';
    } catch (e) { started = false; }
    // bring back the tabs from last time
    if (!tabs.length) {
      try { const s = JSON.parse(ls.get('lib_tabs', 'null')); if (s && s.t && s.t.length) { tabs = s.t.map(x => { const t = mkTab(); if ((x.s || []).length) t.stack = x.s.map(e => ({ u: e.u, t: e.t === 'Library home' ? 'Search' : e.t })); t.i = Math.min(Math.max(0, x.i == null ? t.stack.length - 1 : x.i), t.stack.length - 1); t.z = x.z || 1; return t; }); active = Math.min(s.a || 0, tabs.length - 1); } } catch (e) { }
      if (!tabs.length) tabs = [mkTab()];
    }
    bar(); switchTab(active);
  }
  $('lbook').onchange = () => { book = $('lbook').value; q.focus(); if (q.value.trim()) suggest(); };

  A.lib = {
    openUrl, openBook, define, init, home: goHome, dark: () => DARK + (A.custom ? A.custom.bookCss() : ''),
    search(term, cat, hint) { A.showTab('web'); init().then(() => { q.value = ''; navigate(''); A.websearch.mount($('wh')); A.websearch.search(term); }); },
    pending: () => { const p = pending; pending = null; return p; },
    selection: () => lastSel, back, forward: fwd, newTab: (u, t) => newTab(u, t), tabs: () => tabs.map(t => ({ title: E(t).t, url: E(t).u })), current: () => ({ url: curUrl(), title: curTitle })
  };
  addEventListener('message', e => { if (e.data === 'esc') A.escape && A.escape(); });
  A.registerTab('web', 'Browser', () => { init(); setTimeout(() => { if (T() && !E(T()).u) A.websearch.focus(); }, 50); });
  A.ready.push(() => init());
})();

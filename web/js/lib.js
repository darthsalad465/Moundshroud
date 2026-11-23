// Browser tab (was the Library tab): an offline web browser for the encyclopedias, dictionary, medical, tech-help and cooking/DIY books. Its homepage is the Search page (websearch.js),
// so searching and reading stay in one place. The Library tab (library.js) now holds just the classics and the chess books.
// Tabs, back / forward with a history list, reload, find in page, zoom, print, favorites, and your tabs come back next time.
(() => {
  const root = $('p-web');
  const homeParent = root.parentElement;
  const homeNext = root.nextSibling;
  /* MoundHub, the repository site: an address this browser owns, shown as a real page inside the tab (and inside the
     cyber desktop's browser, which docks this same tab). It is the app's own MoundHub page, so it sees the same store. */
  const HUB = 'https://moundhub.com', HUB_PAGE = '/web/moundhub.html', HUB_TITLE = 'MoundHub';
  const isHub = u => { const s = String(u == null ? '' : u).trim(); return /^(?:https?:\/\/)?(?:www\.)?moundhub\.com\/?$/i.test(s) || s === HUB_PAGE; };
  let desktopHost = null;
  function moveBrowser(target, before = null) {
    if (root.parentElement === target) return;
    if (target.moveBefore) target.moveBefore(root, before);
    else target.insertBefore(root, before);
  }
  function releaseBrowser() {
    if (!desktopHost) return;
    desktopHost = null;
    root.classList.remove('in-cyber-desktop', 'on');
    moveBrowser(homeParent, homeNext?.parentElement === homeParent ? homeNext : null);
  }
  function showBrowser() {
    if (!desktopHost || A.cur !== 'cyber') A.showTab('web');
  }
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
  const READER = 'body{max-width:730px!important;margin:0 auto!important;padding:48px 56px 90px!important;font-family:Georgia,"Iowan Old Style",serif!important;font-size:19px!important;line-height:1.85!important}p,li,dd{line-height:1.85!important;margin-bottom:.9em!important}h1,h2,h3{letter-spacing:-.02em!important}img{border-radius:10px!important}';
  const pageCss = t => DARK + (A.custom ? A.custom.bookCss() : '') + (t && t.reader ? READER : '');

  const css = '#lhead{flex:none;border-bottom:1px solid var(--line);position:relative;background:var(--panel)}#ltabs{display:flex;gap:3px;padding:6px 8px 0;overflow-x:auto;scrollbar-width:none}.ltab{display:flex;align-items:center;gap:6px;max-width:190px;min-width:80px;padding:6px 8px 6px 11px;border-radius:9px 9px 0 0;background:var(--panel2);border:1px solid var(--line);border-bottom:0;cursor:pointer;font-size:12.5px;white-space:nowrap;opacity:.75}.ltab.on{background:var(--bg);opacity:1;border-color:var(--line)}.ltab span{overflow:hidden;text-overflow:ellipsis;flex:1}.ltab i{font-style:normal;opacity:.6;padding:0 3px;border-radius:5px}.ltab i:hover{background:var(--panel);opacity:1}#lnew{padding:4px 9px;border-radius:8px;cursor:pointer;opacity:.7;align-self:center}#lnew:hover{background:var(--panel2);opacity:1}' +
    '#lnav{display:flex;gap:5px;align-items:center;padding:6px 12px 3px;position:relative}#lnav .ib[disabled]{opacity:.35}#lbox{position:relative;flex:1;min-width:140px}#lbox input{width:100%}#lmenu{position:absolute;right:12px;top:100%;z-index:30;min-width:230px;background:var(--panel);border:1px solid var(--line);border-radius:12px;box-shadow:0 14px 40px rgba(0,0,0,.5);padding:6px;display:none}#lmenu div{padding:7px 10px;border-radius:8px;cursor:pointer;display:flex;gap:10px;white-space:nowrap}#lmenu div:hover{background:var(--panel2)}#lmenu div b{margin-left:auto;font-weight:400;opacity:.55;font-size:12px}#lmenu hr{border:0;border-top:1px solid var(--line);margin:4px 0}' +
    '#lfind{display:none;position:absolute;right:16px;top:4px;z-index:25;background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:6px 8px;gap:6px;align-items:center;box-shadow:0 8px 28px rgba(0,0,0,.45)}#lfind input{width:190px}#lframes{flex:1;position:relative;min-height:0;display:flex}#lframes iframe{flex:1;width:100%;border:0;background:#0e1016}#lhist{position:absolute;left:12px;top:100%;z-index:30;min-width:280px;max-width:440px;background:var(--panel);border:1px solid var(--line);border-radius:12px;box-shadow:0 14px 40px rgba(0,0,0,.5);padding:6px;display:none}#lhist div{padding:6px 10px;border-radius:8px;cursor:pointer;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}#lhist div:hover{background:var(--panel2)}#lhist div.cur{font-weight:700;color:var(--acc)}' +
    '.srcview{position:fixed!important;z-index:2147483500!important;inset:5vh 5vw;display:flex;flex-direction:column;background:var(--panel,#101725);color:var(--text,#e6edf8);border:1px solid var(--line,#334155);border-radius:14px;box-shadow:0 32px 100px rgba(0,0,0,.78),0 0 0 1px rgba(255,255,255,.1);overflow:hidden;outline:none}' +
    '.srcview header{display:flex;align-items:center;gap:10px;padding:10px 14px;border-bottom:1px solid var(--line,#334155);font-size:13px;flex:none;background:var(--panel,#101725);color:var(--text,#e6edf8)}' +
    '.srcview header b{white-space:nowrap}.srcview header span{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--mute,#94a3b8);font-size:12px}' +
    '.srcview header div{display:flex;gap:6px;flex:none}.srcview header button{border:1px solid var(--line,#334155);border-radius:8px;background:var(--panel2,#182235);color:var(--text,#e6edf8);padding:5px 10px;cursor:pointer;font:inherit;font-size:12.5px}.srcview header button:hover{filter:brightness(1.12)}' +
    '.srcview pre{margin:0;flex:1;overflow:auto;padding:14px 16px;white-space:pre-wrap;overflow-wrap:anywhere;font:12.5px/1.55 Consolas,"Cascadia Mono",monospace;color:var(--text,#e6edf8);background:var(--bg,#0a0f1a)}';
  const luxe = `
    #lhead{background:color-mix(in srgb,var(--panel) 92%,var(--bg));border:0;border-bottom:1px solid var(--line);box-shadow:0 8px 30px rgba(0,0,0,.12);z-index:20}
    #ltabs{min-height:47px;gap:7px;padding:9px 16px 0;background:linear-gradient(180deg,color-mix(in srgb,var(--panel2) 48%,transparent),transparent);scrollbar-width:thin;scrollbar-color:var(--line) transparent}
    .ltab{flex:0 1 235px;min-width:148px;max-width:270px;height:38px;gap:9px;padding:6px 10px 6px 13px;border:1px solid color-mix(in srgb,var(--line) 72%,transparent);border-bottom:0;border-radius:12px 12px 0 0;background:color-mix(in srgb,var(--panel2) 74%,transparent);font-size:13px;opacity:.78;transition:background .18s ease,border-color .18s ease,opacity .18s ease,transform .18s ease}
    .ltab:hover{opacity:1;background:var(--panel2);transform:translateY(-1px)}.ltab.on{position:relative;z-index:2;background:var(--bg);border-color:color-mix(in srgb,var(--acc) 24%,var(--line));opacity:1;box-shadow:0 -3px 15px color-mix(in srgb,var(--acc) 9%,transparent)}
    .ltab .lfav{font-size:14px}.ltab [data-tx]{width:24px;height:24px;display:grid;place-items:center;opacity:.45}.ltab [data-tx]:hover{color:var(--bad);background:color-mix(in srgb,var(--bad) 12%,var(--panel));opacity:1}
    #lnew{width:32px;height:32px;display:grid;place-items:center;margin:0 0 3px 2px;border:1px solid var(--line);border-radius:10px;background:color-mix(in srgb,var(--panel2) 55%,transparent);font-size:18px;opacity:.8;transition:transform .18s ease,background .18s ease}#lnew:hover{transform:rotate(90deg);background:var(--panel2)}
    #lnav{gap:9px;padding:11px 18px 12px;align-items:center}#lnav>.ib,#lnav>.pri{flex:none;height:40px;min-width:40px;display:inline-flex;align-items:center;justify-content:center;border-radius:12px;font-size:15px}
    #lnav #lback,#lnav #lfwd{width:38px;height:38px;padding:0;border-radius:50%;font-size:13px}#lnav #lhome{width:38px;height:38px;padding:0;border-radius:50%}
    #lbox{height:44px;min-width:220px;display:flex;align-items:center;gap:8px;padding:0 7px 0 14px;border:1px solid color-mix(in srgb,var(--line) 88%,transparent);border-radius:14px;background:color-mix(in srgb,var(--bg) 70%,var(--panel));box-shadow:inset 0 1px 0 rgba(255,255,255,.025);transition:border-color .18s ease,box-shadow .18s ease,background .18s ease}
    #lbox:focus-within{border-color:color-mix(in srgb,var(--acc) 72%,var(--line));background:var(--bg);box-shadow:0 0 0 3px color-mix(in srgb,var(--acc) 13%,transparent),0 8px 24px rgba(0,0,0,.14)}#lico{flex:none;opacity:.75;font-size:15px}
    #lbox input{flex:1;min-width:0;width:auto;height:100%;padding:0 4px;border:0!important;outline:0;box-shadow:none!important;background:transparent!important;font-size:14px;color:var(--text)}#lbox input:focus{box-shadow:none!important}#lbox input::placeholder{color:var(--mute);opacity:.78}
    #lnav #lstar{width:32px;height:32px;min-width:32px;padding:0;border:0;background:transparent;border-radius:9px}#lnav #lstar:hover{background:var(--panel2)}
    #lnav #ltor{margin-left:5px;margin-right:5px;min-width:86px;max-width:190px;padding:0 14px;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}#lnav #lbm{width:42px;min-width:42px;margin-left:4px;padding:0}#lnav #lmore{width:38px;padding:0;font-size:20px}
    /* the toolbar keeps every button whole: icons never shrink, and Full screen is a pill like Tor (its words drop when the bar is narrow) */
    #p-web #lnav{container-type:inline-size}#p-web #lnav>button{flex:none}
    #p-web #lnav #ltor,#p-web #lnav #lfs{width:auto;border-radius:17px;display:flex;gap:5px;align-items:center;justify-content:center;border:1px solid color-mix(in srgb,var(--line) 80%,transparent)}
    #p-web #lnav #lfs{min-width:34px;max-width:170px;padding:0 13px;font-size:12px;white-space:nowrap;overflow:hidden}#p-web #lnav #lfs.on{color:var(--text);background:color-mix(in srgb,var(--acc) 22%,transparent);border-color:var(--acc)}
    @container (max-width:740px){#p-web #lnav #lfs .fsw{display:none}#p-web #lnav #lfs{width:34px;padding:0}#p-web #lnav #ltor{min-width:0;padding:0 11px;margin:0 2px}}
    #lprog{height:3px;position:relative;flex:none;overflow:hidden;background:transparent;opacity:0;transition:opacity .2s}#lprog.on{opacity:1}#lprog.on:after{content:'';position:absolute;inset:0 auto 0 -35%;width:35%;background:linear-gradient(90deg,transparent,var(--acc),var(--acc2),transparent);animation:browserProgress 1.2s ease-in-out infinite}@keyframes browserProgress{to{left:100%}}
    #lbmbar{display:flex;align-items:center;gap:7px;min-height:40px;padding:3px 18px 8px;overflow-x:auto;scrollbar-width:none}#lbmbar.off{display:none}#lbmbar .bmi{flex:none;padding:6px 10px;border:1px solid color-mix(in srgb,var(--line) 70%,transparent);border-radius:10px;background:color-mix(in srgb,var(--panel2) 58%,transparent);font-size:12px;transition:background .16s ease,border-color .16s ease}#lbmbar .bmi:hover{background:var(--panel2);border-color:color-mix(in srgb,var(--acc) 42%,var(--line))}#lbmbar .none{font-size:12px;color:var(--mute)}
    #wbar{display:flex;gap:7px;align-items:center;flex-wrap:wrap;padding:8px 20px 11px!important;border-bottom:1px solid color-mix(in srgb,var(--line) 75%,transparent)}#wbar .chip{padding:6px 11px;border-radius:10px;background:color-mix(in srgb,var(--panel2) 55%,transparent);font-size:12px;transition:transform .15s ease,background .15s ease}#wbar .chip:hover{transform:translateY(-1px);background:var(--panel2)}
    #lframes{background:var(--bg);min-height:0}#lframes iframe{background:var(--bg)}#lstat{position:absolute;left:16px;bottom:12px;z-index:5;max-width:min(65vw,720px);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding:5px 10px;border:1px solid var(--line);border-radius:9px;background:color-mix(in srgb,var(--panel) 92%,transparent);box-shadow:0 6px 20px rgba(0,0,0,.2);font-size:11px}
    #lmenu,#lhist{border-color:color-mix(in srgb,var(--line) 88%,transparent);border-radius:16px;background:color-mix(in srgb,var(--panel) 96%,transparent);backdrop-filter:blur(18px);box-shadow:0 18px 52px rgba(0,0,0,.36);padding:8px}#lmenu div,#lhist div{padding:9px 11px;border-radius:10px}#lmenu div:hover,#lhist div:hover{background:color-mix(in srgb,var(--acc) 11%,var(--panel2))}
    #lfind{right:18px;top:8px;padding:8px 10px;border-radius:13px;backdrop-filter:blur(16px)}#lfind input{height:34px;border-radius:9px;padding:0 9px}
    @media(max-width:760px){#ltabs{padding-left:9px;padding-right:9px}.ltab{flex:0 0 185px;min-width:135px}#lnav{gap:6px;padding:9px 10px;flex-wrap:wrap}#lbox{order:2;flex-basis:100%;min-width:0}#lnav #ltor{margin-left:auto}#lbmbar{padding-left:10px;padding-right:10px}#wbar{padding-left:12px!important;padding-right:12px!important}}
    @media(prefers-reduced-motion:reduce){.ltab,#lnew,#wbar .chip,#lbox{transition:none!important}#lprog.on:after{animation-duration:3s}}
  `;
  if (!document.getElementById('libcss')) { const s = document.createElement('style'); s.id = 'libcss'; s.textContent = css + luxe; document.head.appendChild(s); }

  root.innerHTML =
    '<div id="lhead"><div id="ltabs"></div>' +
    '<div id="lnav"><button class="ib" id="lback" title="Back (Alt+Left). Right-click for the list">◀</button><button class="ib" id="lfwd" title="Forward (Alt+Right)">▶</button><button class="ib" id="lrel" title="Reload (Ctrl+R). While a page loads this stops it">⟳</button><button class="ib" id="lhome" title="Home: search Moundshroud’s offline archived internet (Alt+Home)">🏠</button>' +
    '<select id="lbook" style="display:none" title="Which library"></select>' +
    '<button class="ib" id="llib" type="button" style="display:none;min-width:0;max-width:210px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px;padding:0 10px" title=""></button>' +
    '<div id="lbox"><span id="lico">🔎</span><input id="wq" type="text" placeholder="Search Moundshroud, or type a page address" title="The page’s name. Click it to see and copy the page’s address" autocomplete="off" spellcheck="false"><button class="ib" id="lstar" title="Favorite this page (the star)">☆</button><div id="wsug"></div></div>' +
    '<button class="pri" id="wgo" style="display:none">Search</button><button class="ib" id="ltor" title="Tor Browser: browse the whole web privately through the Tor network (opens in its own window)">🧅 Tor</button><button class="ib" id="lbm" title="Bookmarks: save your place on this page and jump back to it (Ctrl+D)">🔖</button><button class="ib page-fs-btn" id="lfs" title="Full screen this page (Esc to exit)">⛶<span class="fsw">Full screen</span></button><button class="ib" id="lmore" title="Customize and control the Browser">⋮</button>' +
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
  /* generated sites live in memory only, so they are never written into the saved tab list: a restored tab would
     otherwise try to fetch a host that does not exist */
  const fakeHosts = new Set();
  const hostOf = u => { try { return new URL(u).host; } catch (e) { return ''; } };
  const saveTabs = () => { try { ls.set('lib_tabs', JSON.stringify({ a: active, t: tabs.map(t => ({ id: t.id, i: t.i, z: t.z, reader: !!t.reader, s: t.stack.slice(-30).filter(e => !fakeHosts.has(hostOf(e.u))).map(e => ({ u: e.u, t: e.t })) })) })); } catch (e) { } };

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
            key: m => {
              /* Ctrl+T belongs to the moundshell even while a library page has the keyboard (a key event inside the
                 page never reaches the app's own document, so the page hands it over here) */
              if ((m.ctrlKey || m.metaKey) && !m.altKey && !m.shiftKey && (String(m.key).toLowerCase() === 't' || m.code === 'KeyT')) {
                if (window.AppShell) { if (window.AppShell.isOpen && window.AppShell.isOpen()) window.AppShell.close(); else window.AppShell.open(); }
                return;
              }
              kd(Object.assign({ preventDefault() { }, target: { ownerDocument: null } }, m));
            },
      ctx: m => frameMenu(m, fr)
    });
    wireOwnCtx(fr);
    frames.appendChild(fr); t.fr = fr; return fr;
  }
  function render() {
    const tb = $('ltabs'); tb.innerHTML = tabs.map((t, i) => { const e = E(t); return '<div class="ltab' + (i === active ? ' on' : '') + (t.loading ? ' ld' : '') + '" data-ti="' + i + '" draggable="true" title="' + esc(e.t || 'Search') + '"><i class="lfav">' + (t.loading ? '◌' : favOf(e.u)) + '</i><span>' + esc(e.t || (e.u ? 'Loading...' : 'New tab')) + '</span><i data-tx="' + i + '" title="Close tab (Ctrl+W)">✕</i></div>'; }).join('') + '<div id="lnew" title="New tab (Ctrl+T)">＋</div>';
    const t = T(), e = E(t); $('lback').disabled = t.i <= 0; $('lfwd').disabled = t.i >= t.stack.length - 1; $('lrel').disabled = !e.u && !t.loading; $('lrel').textContent = t.loading ? '✕' : '⟳';
    const isPage = !!e.u; $('wh').style.display = isPage ? 'none' : ''; $('wgo').style.display = 'none'; $('lprog').classList.toggle('on', !!t.loading);
    tabs.forEach((x, i) => { if (x.fr) x.fr.style.display = (i === active && isPage) ? '' : 'none'; });
    $('lico').textContent = favOf(e.u); if (document.activeElement !== q) q.value = isPage ? (e.t || '') : '';
    bmBar(); favState(); renderLib(); setHead();
  }
  function switchTab(i) { if (i < 0 || i >= tabs.length) return; active = i; const t = T(); f = t.fr || null; closeMenus(); const e = E(t); if (e.u && !t.fr) navigateFrame(t, e.u, true); if (!e.u) { curTitle = ''; home(); } else curTitle = e.t || ''; render(); saveTabs(); }
  function newTab(url, title, bg) { if (tabs.length >= 20) { A.toast('Close a tab first (20 tabs is the limit)'); return; } const t = mkTab(url, title); tabs.push(t); if (!bg) switchTab(tabs.length - 1); else { if (url) navigateFrame(t, url, true); render(); saveTabs(); } return t; }
  function closeTab(i) { const t = tabs[i]; if (!t) return; { const e0 = E(t); if (e0 && e0.u) closed.push(e0); if (closed.length > 20) closed.shift(); } if (t.fr) t.fr.remove(); tabs.splice(i, 1); if (!tabs.length) tabs.push(mkTab()); if (active >= tabs.length) active = tabs.length - 1; else if (i < active) active--; switchTab(active); }
  function fakeDocFor(site, path, answer) {
    const body = String(answer && answer.body != null ? answer.body : '');
    if (/html/i.test(String(answer && answer.type || ''))) return body;
    const bridge = (A.cyberWeb && A.cyberWeb.bridgeScript) || '';
    return '<!doctype html><html lang="en"><head><meta charset="utf-8"><style>' +
      'body{margin:0;background:#0d1117;color:#dbe4f3;font:14px/1.6 Consolas,"Cascadia Mono",monospace;padding:18px 22px}' +
      'a{color:#7dd3fc;text-decoration:none}a:hover{text-decoration:underline}' +
      'pre{white-space:pre-wrap;word-break:break-word;background:#141a23;border:1px solid #232c3a;border-radius:10px;padding:14px;margin:12px 0 0}' +
      '</style></head><body><div><a href="/">← Back to ' + esc(site.brand || site.host) + '</a> · ' +
      esc('https://' + site.host + path) + ' · HTTP ' + esc(String(answer && answer.status || 200)) +
      '</div><pre>' + esc(body) + '</pre>' + bridge + '</body></html>';
  }
  function navigateFrame(t, url, ours, method) {
    const hub = isHub(url);
    const isInternalLib = /^\/(?:wiki|api\/lib)\//.test(url);
    /* a URL on the fake internet (a link in the mail, the Fake internet tab, the address bar, moundshell) is drawn from this page */
    const fake = !hub && !isInternalLib && A.cyberWeb &&
      (A.cyberWeb.locate(url) || (/^https?:\/\//i.test(url) && A.cyberWeb.visit(url)));
    /* Switching between srcdoc (fake internet), MoundHub, and library pages requires a fresh iframe so Chromium never
       keeps a stale srcdoc (which overrides src) or stale sandbox attributes. */
    if (t.fr && (Boolean(t.fr._fake) !== Boolean(fake) || Boolean(t.fr._hub) !== Boolean(hub))) {
      t.fr.remove(); t.fr = null;
    }
    const fr = frameFor(t);
    if (hub) url = HUB;
    t.nav = !!ours; t.loading = true; clearTimeout(t.lt); t.lt = setTimeout(() => { t.loading = false; if (tabs.includes(t)) render(); }, 20000); fr._text = '';
    /* MoundHub is a page of this app, so it is framed directly on the app's own address (no library bridge): it shares
       the repository store with moundshell, and its own header says https://moundhub.com. */
    if (hub) {
      fr.removeAttribute('sandbox'); fr.removeAttribute('srcdoc'); fr._hub = true; fr._fake = false; fr.src = HUB_PAGE;
      fr.onload = () => { if (fr._hub) onLoad(t, fr, { url: HUB, title: HUB_TITLE }); };
    } else if (fake) {
      /* a generated site: opaque-origin frame, its own CSS, and a tiny script that reports link and form clicks */
      fr._hub = false; fr._fake = true; fr.removeAttribute('src'); fakeHosts.add(fake.site.host);
      /* allow-forms is what makes a submit event fire at all: without it the browser cancels the submission before
         any handler runs, so Sign in / Contact did nothing. Every submit is still caught and cancelled below, and
         the page it would have gone to is handed to this browser instead. */
      fr.setAttribute('sandbox', 'allow-scripts allow-forms');
      fr.setAttribute('referrerpolicy', 'no-referrer');
      const answer = A.cyberWeb.serve(fake.site, fake.path, method || 'GET');
      fr._cdweb = { site: fake.site, path: fake.path, answer };
      fr.onload = () => onFakeLoad(t, fr);
      fr.srcdoc = fakeDocFor(fake.site, fake.path, answer);
    } else {
      fr._hub = false; fr._fake = false; fr.onload = null; fr.removeAttribute('srcdoc');
      fr.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-forms allow-downloads allow-modals');
      /* a page you imported yourself lives on this app's address, so its title is read from its own document */
      if (MINE.test(url)) fr.onload = () => {
        t.loading = false; clearTimeout(t.lt);
        let ttl = url;
        try { ttl = (fr.contentDocument && fr.contentDocument.title) || url; } catch (x) { }
        const ent = E(t); if (ent) { ent.u = url; ent.t = ttl; }
        if (t === T()) curTitle = ttl;
        render(); saveTabs();
      };
      fr.src = A.libframe.src(url);
    }
    if (tabs.includes(t)) render();
  }
  /* a small picture for each kind of page, standing in for a site icon */
  const favOf = u => isHub(u) ? '🔖' : !u ? '🔎' : /wiktionary/.test(u) ? '📕' : /gutenberg/.test(u) ? '📖' : /stackexchange|superuser|askubuntu|serverfault|unix\./.test(u) ? '💬' : /mdwiki|wikem|medic/.test(u) ? '🩺' : /devdocs/.test(u) ? '🛠️' : /wikivoyage/.test(u) ? '🧭' : /\/search\?/.test(u) ? '🔎' : /wikibooks|wikiversity/.test(u) ? '🎓' : /wikipedia/.test(u) ? '🌐' : '📄';
  /* the one navigation entry point: push a history entry, or move within it */
  function navigate(url, title, newT, method) {
    if (isHub(url)) { url = HUB; title = title || HUB_TITLE; }
    if (newT) return newTab(url, title);
    const t = T(); if (!url) { push(t, '', 'Search'); render(); home(); saveTabs(); return; }
    curTitle = title || ''; push(t, url, title || ''); navigateFrame(t, url, true, method); render(); saveTabs();
  }
  function push(t, u, ti) { t.stack = t.stack.slice(0, t.i + 1); t.stack.push({ u, t: ti }); if (t.stack.length > 60) t.stack.shift(); t.i = t.stack.length - 1; }
  function jump(t, i) { if (i < 0 || i >= t.stack.length) return; t.i = i; const e = t.stack[i]; closeMenus(); if (!e.u) { render(); home(); saveTabs(); return; } curTitle = e.t || ''; navigateFrame(t, e.u, true); render(); saveTabs(); }
  const back = () => jump(T(), T().i - 1), fwd = () => jump(T(), T().i + 1);

  /* a page from the fake internet: it has no library bridge, so its title and address are set here */
  function onFakeLoad(t, fr) {
    t.loading = false; clearTimeout(t.lt);
    const at = fr._cdweb;
    if (!at || !tabs.includes(t)) return;
    const e = E(t), url = 'https://' + at.site.host + at.path;
    /* the tab title is the page, not its query: a sign-in URL must never put credentials in the tab strip */
    const bare = at.path.split('?')[0];
    const name = bare === '/' ? at.site.kind : (bare.split('/').filter(Boolean).pop() || at.site.kind);
    const ttl = at.site.brand + ' — ' + name.replace(/\.(?:html?|json|txt|zip|php)$/i, '');
    if (e) { e.u = url; e.t = ttl; }
    if (t === T()) { curTitle = ttl; f = fr; }
    /* half of this internet is booby-trapped: the pop-up virus breaks out on the desktop around the browser,
       unless Shield Pro from the Surplus Vault is installed, which blocks every one of them before it opens */
    if (at.site.trapped && A.cyberVirus && A.cur === 'cyber') {
      if (A.cyberRewards && A.cyberRewards.blocks && A.cyberRewards.blocks()) {
        A.toast && A.toast('🛡 Shield Pro blocked the fake virus on ' + at.site.host + '.', 4200);
      } else {
        const desk = document.querySelector('#p-cyber .cd-desktop');
        if (desk) A.cyberVirus.start(desk, { host: at.site.host });
      }
    }
    render(); saveTabs();
  }

  /* links, forms and right-clicks inside a generated site arrive here: the frame is sandboxed, so postMessage is the only way out */
  addEventListener('message', event => {
    const srcTab = tabs.find(x => x.fr && x.fr._fake === true && x.fr.contentWindow === event.source) || null;
    if (!srcTab || !srcTab.fr) return;
    if (event.data && event.data.cdwebKey === 'shell') {
      if (window.AppShell) { if (window.AppShell.isOpen && window.AppShell.isOpen()) window.AppShell.close(); else window.AppShell.open(); }
      return;
    }
    if (event.data && event.data.cdwebCtx) {
      const at = srcTab.fr._cdweb, ctx = event.data.cdwebCtx;
      if (!at || !A.ctxMenu || !A.ctxMenu.page) return;
      const box = srcTab.fr.getBoundingClientRect();
      const linkUrl = ctx.link ? (/^https?:\/\//i.test(ctx.link) ? ctx.link : 'https://' + at.site.host + (ctx.link.startsWith('/') ? ctx.link : '/' + ctx.link)) : '';
      A.ctxMenu.page({
        x: box.left + (Number(ctx.x) || 0), y: box.top + (Number(ctx.y) || 0),
        link: linkUrl,
        sel: typeof ctx.sel === 'string' ? ctx.sel : ''
      });
      return;
    }
    const rel = event.data && event.data.cdweb;
    if (typeof rel !== 'string') return;
    const at = srcTab.fr._cdweb;
    if (!at) return;
    const method = String(event.data.cdwebMethod || 'GET').toUpperCase();
    /* /random on the Fake Internet portal jumps straight to the next fake-internet site */
    if (at.site.portal && /^\/random(?:\?|$)/i.test(rel)) {
      const nextSite = A.cyberWeb && A.cyberWeb.next ? A.cyberWeb.next() : null;
      if (nextSite) { show('https://' + nextSite.host + '/', nextSite.brand); return; }
    }
    /* a search result links to another host by its full address; a site's own links are relative to it */
    if (/^https?:\/\//i.test(rel)) { show(rel, '', method); return; }
    const norm = rel.startsWith('?') ? '/' + rel : (rel.startsWith('/') ? rel : '/' + rel);
    show('https://' + at.site.host + norm, at.site.brand, method);
  });

  function onLoad(t, fr, m) {
    t.loading = false; clearTimeout(t.lt);
    if (!fr.getAttribute('src') || !m || !m.url) return;
    const u = m.url, ent = E(t), ours = t.nav; t.nav = false;
    fr.lf.css(pageCss(t));
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
  const curUrl = () => { const e = E(T()); return e && (e.u === HUB || /\/wiki\/(content|viewer)/.test(e.u)) ? e.u : ''; };
  const pageAddr = u => u === HUB ? HUB : location.origin + u;
  /* the address a page is really at: a generated site's own https address (the link from the mail), or the address the
     library page is actually served from. Clicking the address box shows this, so it can be copied and pasted. */
  const addrOf = u => !u ? '' : /^https?:\/\//i.test(u) ? u : (A.libframe.isLib(u) ? A.libframe.src(u) : location.origin + u);
  /* Which library — and which number — a page belongs to. The Browser's own books come first, in the same order as
     the library list; then MoundHub; then the fake internet: its search index, then one library for every shelf of
     generated sites, so every fake website says which collection it is filed under. */
  function libraryOf(url) {
    if (!url) return null;
    const B = books.length, web = A.cyberWeb || null;
    if (isHub(url)) return { no: B + 1, name: 'MoundHub', icon: '🔖', note: 'the repository site this app keeps, shared with moundshell git' };
    const at = web && web.locate ? web.locate(url) : null;
    if (at && at.site) {
      if (at.site.dark) return { no: B + 3 + (web.CATS ? web.CATS.length : 0), name: 'Fake Dark Web', icon: '🧅',
        note: 'the onion section · ' + (A.cyberDark ? A.cyberDark.count() : '?') + ' hidden services · ' + at.site.host };
      if (at.site.portal) return { no: B + 2, name: 'Moundshroud Search', icon: '🔎', note: 'the index of the whole fake internet · ' + (web.count ? web.count() : 0) + ' sites' };
      const cats = web.CATS || [], i = cats.findIndex(c => c && at.site.cat && c.id === at.site.cat.id);
      const shelf = i >= 0 ? cats[i] : { label: at.site.kind || 'Generated sites', icon: '🌐' };
      const all = web.all ? web.all() : [];
      return { no: B + 2 + (i >= 0 ? i + 1 : cats.length + 1), name: shelf.label, icon: shelf.icon || '🌐',
        note: 'Moundshroud Net · site ' + (at.site.id || 1) + ' of ' + (all.length || '?') + ' · ' + at.site.host + ' · generated in this page' };
    }
    if (MINE.test(url)) return { no: B + 3 + (web && web.CATS ? web.CATS.length : 0), name: 'Your imported libraries', icon: '📥', note: 'pages you imported yourself, kept in this app' };
    const m = /[?&]content=([^&]+)/.exec(url) || /^\/wiki\/content\/([^/?#]+)/.exec(url);
    const name = m ? decodeURIComponent(m[1]) : '';
    const i = name ? books.findIndex(b => b.name === name) : -1;
    if (i >= 0) { const b = books[i] || {}; return { no: i + 1, name: b.title || b.name, icon: '📚', note: (b.category ? b.category + ' · ' : '') + b.name }; }
    const b = books.find(x => x.name === book);
    if (b) return { no: books.indexOf(b) + 1, name: b.title || b.name, icon: '📚', note: 'the book this page was opened from' };
    return null;
  }
  function renderLib() {
    const el = $('llib'); if (!el) return;
    const e = E(T()), info = libraryOf(e && e.u);
    if (!info) { el.style.display = 'none'; el.dataset.copy = ''; return; }
    el.style.display = '';
    /* the library's own FLAG: every bundled library carries one, paid into the Cyber Desktop bank with `solve` */
    const book = books[info.no - 1] || null;
    const flag = book && A.cyberFlags && A.cyberFlags.libFlag ? A.cyberFlags.libFlag(book) : '';
    el.innerHTML = info.icon + (info.no ? ' <b>Library ' + info.no + '</b>' : '') + ' · ' + esc(info.name) +
      (flag ? ' <span style="margin-left:8px;padding:1px 7px;border:1px solid var(--acc);border-radius:6px;font:12.5px/1.6 Consolas,\'Cascadia Mono\',monospace;color:var(--acc);opacity:.92" data-libflag>' + esc(flag) + '</span>' : '');
    el.dataset.copy = 'Library ' + (info.no || '?') + ' · ' + info.name + (flag ? '\nFLAG: ' + flag : '');
    el.title = 'Library ' + (info.no || '?') + ' · ' + info.name + (info.note ? '\n' + info.note : '') +
      (flag ? '\n\nThis library\'s flag: ' + flag + '\nSubmit it in moundshell with: solve ' + flag : '') + '\n\nClick to copy this line.';
  }
  function favState() { const u = curUrl(), on = u && A.fav && A.fav.has(u); $('lstar').textContent = on ? '⭐' : '☆'; const b = $('lfavb'); if (b) b.textContent = A.fav && A.fav.has('book:' + book, 'book') ? '⭐ Library favorited' : '☆ Favorite this library'; }
  document.addEventListener('favchange', favState);
  $('lback').onclick = back; $('lfwd').onclick = fwd; $('lrel').onclick = () => {
    const t = T();
    if (t.loading) { if (t.fr && !t.fr._fake && !t.fr._hub) t.fr.lf.stop(); t.loading = false; render(); return; }
    if (t.fr) {
      t.loading = true;
      if (t.fr._hub) t.fr.src = HUB_PAGE;
      else if (t.fr._fake) navigateFrame(t, E(t).u, true);
      else t.fr.lf.reload();
      render();
    }
  };
  $('lfs').onclick = () => act('fs');
  $('lbm').onclick = () => A.bm.menu($('lbm'), { where: 'web', frame: () => T().fr, url: curUrl, title: () => curTitle || curUrl(), open: b => openUrl(b.u, b.t, { bm: b }) });
  $('llib').onclick = () => { const c = $('llib').dataset.copy; if (!c) return; A.copy(c); A.toast('Copied: ' + c, 2600); };
  $('lhome').onclick = () => goHome(); $('lstar').onclick = () => { const u = curUrl(); if (!u) return A.toast('Open a library page first'); A.fav.toggle({ u, t: curTitle || u, k: 'page' }); favState(); };
  const showHist = e => { if (e && e.preventDefault) e.preventDefault(); const t = T(), h = $('lhist'); h.innerHTML = t.stack.map((x, i) => '<div data-hi="' + i + '"' + (i === t.i ? ' class="cur"' : '') + '>' + esc(x.t || x.u || 'Search') + '</div>').reverse().join(''); h.style.display = 'block'; };
  $('lback').oncontextmenu = $('lfwd').oncontextmenu = showHist;
  $('lhist').onclick = e => { const d = e.target.closest('[data-hi]'); if (d) jump(T(), +d.dataset.hi); };
  $('ltabs').onclick = e => { if (e.target.id === 'lnew') return newTab(); const x = e.target.closest('[data-tx]'); if (x) { e.stopPropagation(); return closeTab(+x.dataset.tx); } const t = e.target.closest('[data-ti]'); if (t) switchTab(+t.dataset.ti); };
  $('ltabs').onauxclick = e => { if (e.button !== 1) return; const t = e.target.closest('[data-ti]'); if (t) { e.preventDefault(); closeTab(+t.dataset.ti); } };
  const MENU = [['🗂 New tab', 'newtab', 'Ctrl+T'], ['✕ Close tab', 'closetab', 'Ctrl+W'], ['↩ Reopen closed tab', 'reopen'], ['hr'], ['🔍 Find in page', 'find', 'Ctrl+F'], ['</> View page source', 'source', 'Ctrl+U'], ['📖 Reader view', 'reader'], ['➕ Zoom in', 'zin', 'Ctrl +'], ['➖ Zoom out', 'zout', 'Ctrl -'], ['↺ Reset zoom', 'zreset', 'Ctrl 0'], ['🖨 Print or save as PDF', 'print', 'Ctrl+P'], ['⛶ Full screen', 'fs', 'Esc exits'], ['hr'], ['🔗 Copy link to this page', 'copy'], ['🕘 History of this tab', 'thist'], ['🕘 All history', 'allhist', 'Ctrl+H'], ['🧹 Clear browsing history', 'clearhist'], ['⭐ Favorites', 'favs'], ['hr'], ['🔖 Show or hide the bookmarks bar', 'bmbar', 'Ctrl+Shift+B'], ['📥 Import your own library', 'imp'], ['🗂 Your imported libraries', 'mine'], ['📕 Dictionary', 'dict'], ['📚 Thesaurus', 'thes'], ['🎵 Rhymer', 'rhy']];
  const closed = [];
  $('lmore').onclick = e => { e.stopPropagation(); const m = $('lmenu'); if (m.style.display === 'block') return closeMenus(); m.innerHTML = MENU.map(x => x[0] === 'hr' ? '<hr>' : '<div data-m="' + x[1] + '">' + x[0] + (x[1] === 'reader' ? '<b>' + (T().reader ? 'On' : 'Off') + '</b>' : x[2] ? '<b>' + x[2] + '</b>' : '') + '</div>').join('') + '<div class="small mute" style="cursor:default">Zoom ' + Math.round(T().z * 100) + '%</div>'; m.style.display = 'block'; };
  $('lmenu').onclick = e => { const d = e.target.closest('[data-m]'); if (!d) return; closeMenus(); act(d.dataset.m); };
  document.addEventListener('click', e => { if (!e.target.closest('#lmenu,#lmore,#lhist,#lback,#lfwd')) closeMenus(); });
  function zoom(dz) { const t = T(); t.z = dz === 0 ? 1 : Math.max(.5, Math.min(2.5, Math.round((t.z + dz) * 10) / 10)); if (t.fr) t.fr.lf.zoom(t.z); A.toast('Zoom ' + Math.round(t.z * 100) + '%', 900); saveTabs(); }
  function act(a) {
    const t = T();
    if (a === 'newtab') newTab(); else if (a === 'closetab') { const e = E(t); if (e && e.u) closed.push(e); closeTab(active); } else if (a === 'find') openFind();     else if (a === 'reader') { if (!E(t).u || !t.fr) return A.toast('Open a page first to use Reader view'); if (t.fr._fake || t.fr._hub) return A.toast('Reader view only works on library pages'); t.reader = !t.reader; t.fr.lf.css(pageCss(t)); saveTabs(); A.toast(t.reader ? 'Reader view on' : 'Reader view off'); } else if (a === 'zin') zoom(.1); else if (a === 'zout') zoom(-.1); else if (a === 'zreset') zoom(0);
    else if (a === 'print') { if (t.fr && E(t).u && !t.fr._fake && !t.fr._hub) t.fr.lf.print(); else A.toast(t.fr && t.fr._fake ? 'This is a simulated site — it has nothing to print' : 'Open a page first'); }
    else if (a === 'source') viewSource();
    else if (a === 'fs') {
      if (desktopHost) desktopHost.closest('.cd-window')?.querySelector('[data-action="maximize"]')?.click();
      else if (A.pageFS) A.pageFS.toggle();
    }
    else if (a === 'copy') { const u = curUrl(); if (u) A.copy(pageAddr(u)); else A.toast('Open a library page first'); }
    else if (a === 'clearhist') A.confirm('Clear browsing history and recent searches on this device? Your bookmarks and favorites will be kept.').then(ok => { if (ok) { A.fav.clearHistory('all'); tabs.forEach(x => { const current = E(x); x.stack = [current || { u: '', t: 'Search' }]; x.i = 0; }); closed.length = 0; saveTabs(); render(); A.toast('Browsing history cleared'); } });
    else if (a === 'thist') showHist(); else if (a === 'allhist') A.fav.open('hist'); else if (a === 'favs') A.fav.open('all'); else if (a === 'bmbar') { bmOn = !bmOn; ls.set('lib_bmbar', bmOn ? '1' : '0'); bmBar(); setHead(); } else if (a === 'dict' || a === 'thes' || a === 'rhy') { const w = (lastSel || '').trim().split(/\s+/)[0] || ''; if (a === 'thes') A.thes.open(w); else if (a === 'rhy') A.rhyme.open(w); else $('wbar').querySelector('[data-a=dict]').click(); }
    else if (a === 'imp') importLibrary(); else if (a === 'mine') myLibraries();
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
  /* the bar shows the page's name while you read; click it (or press Ctrl+L) and it becomes the page's real address,
     already selected, so a fake site reached from a mail or any library page can simply be copied */
  q.addEventListener('focus', () => {
    const e = E(T()), a = e && addrOf(e.u);
    if (a) { q.value = a; $('lico').textContent = '🔗'; }
    setTimeout(() => q.select(), 0);
  });
  q.addEventListener('blur', () => setTimeout(() => { if (document.activeElement !== q) render(); }, 0));
  /* clicking the box around the address (the icon, the padding) opens it the same way the address itself does */
  $('lbox').addEventListener('mousedown', event => {
    if (event.target.closest('#wsug,button') || event.target === q) return;
    event.preventDefault(); q.focus();
  });
  /* find in page */
  function openFind() { const b = $('lfind'); b.style.display = 'flex'; const i = $('lfq'); i.focus(); i.select(); }
  function closeFind() { $('lfind').style.display = 'none'; const t = T(); if (t && t.fr && !t.fr._fake && !t.fr._hub) t.fr.lf.clearFind(); }
  function doFind(back2) {
    const v = $('lfq').value; if (!v) { $('lfn').textContent = ''; return; } const t = T(); if (!t.fr) return;
    if (t.fr._fake || t.fr._hub) { $('lfn').textContent = 'not available here'; return; }
    t.fr.lf.find(v, back2).then(n => { if ($('lfq').value !== v) return; $('lfn').textContent = n ? n + ' found' : 'Not found'; });
  }
  $('lfq').oninput = () => doFind(false); $('lfq').onkeydown = e => { e.stopPropagation(); if (e.key === 'Enter') doFind(e.shiftKey); else if (e.key === 'Escape') closeFind(); };
  $('lfp').onclick = () => doFind(true); $('lfnx').onclick = () => doFind(false); $('lfx').onclick = closeFind;
  function kd(e) {
    if (!root.classList.contains('on')) return; const k = e.key || '', c = e.ctrlKey || e.metaKey, lk = k.toLowerCase();
    if (e.altKey && k === 'ArrowLeft') { e.preventDefault(); back(); } else if (e.altKey && k === 'ArrowRight') { e.preventDefault(); fwd(); }
    else if (c && lk === 't') { /* the moundshell owns Ctrl+T; Ctrl+Shift+T reopens a closed browser tab */ if (e.shiftKey) { e.preventDefault(); act('reopen'); } } else if (c && e.shiftKey && lk === 'b') { e.preventDefault(); act('bmbar'); } else if (c && lk === 'h') { e.preventDefault(); A.fav.open('hist'); } else if (e.altKey && k === 'Home') { e.preventDefault(); goHome(); } else if (c && /^[1-9]$/.test(k)) { e.preventDefault(); switchTab(k === '9' ? tabs.length - 1 : Math.min(+k - 1, tabs.length - 1)); } else if (c && lk === 'w') { e.preventDefault(); act('closetab'); }
    else if (c && lk === 'l') { e.preventDefault(); q.focus(); q.select(); } else if (c && lk === 'f') { e.preventDefault(); openFind(); } else if (c && lk === 'u') { e.preventDefault(); viewSource(); }
    else if (c && lk === 'd') { e.preventDefault(); const u = curUrl(); if (!u) return A.toast('Open a page first, then press Ctrl+D to bookmark your place'); const b = A.bm.add(T().fr, 'web', u, curTitle || u); A.toast('🔖 Bookmarked at ' + Math.round(b.p * 100) + '%'); }
    else if ((c && lk === 'r') || k === 'F5') { e.preventDefault(); $('lrel').click(); } else if (c && (k === '=' || k === '+')) { e.preventDefault(); zoom(.1); } else if (c && k === '-') { e.preventDefault(); zoom(-.1); } else if (c && k === '0') { e.preventDefault(); zoom(0); }
    else if (c && k === 'Tab') { e.preventDefault(); switchTab((active + (e.shiftKey ? tabs.length - 1 : 1)) % tabs.length); }
    else if (c && lk === 'p' && E(T()).u) { e.preventDefault(); act('print'); }
    else if (k === 'Escape') { if ($('lfind').style.display === 'flex') closeFind(); else if (e.target && e.target.ownerDocument !== document) parent.postMessage('esc', '*'); }
  }
  document.addEventListener('keydown', e => { if (!root.classList.contains('on') || (desktopHost && !root.contains(e.target))) return; if (e.target.id === 'lfq') return; if (/INPUT|TEXTAREA|SELECT/.test(e.target.tagName) && !(e.ctrlKey || e.altKey || e.metaKey)) return; kd(e); }, true);
  document.addEventListener('mouseup', e => { if (!root.classList.contains('on') || (desktopHost && !root.contains(e.target))) return; if (e.button === 3) { e.preventDefault(); back(); } else if (e.button === 4) { e.preventDefault(); fwd(); } });

  /* ---------- home and the rest of the library ---------- */
  function home() {
    const h = $('wh'); h.style.display = ''; h.className = 'wh wsh'; A.websearch.mount(h); setTimeout(() => A.websearch.focus(), 40); return;
  }
  function pickCat(cat, hint) { const b = (hint && books.find(x => x.category === cat && hint.test(x.name))) || books.find(x => x.category === cat); if (b) { book = b.name; $('lbook').value = b.name; A.toast(cat + ' selected'); } }

  function bar() {
    $('wbar').innerHTML = '<span class="chip" data-a="hub" style="border-color:var(--acc)" title="Your repositories: moundhub.com">🔖 MoundHub</span><span class="chip" data-a="favs" style="border-color:var(--acc)">⭐ Favorites</span><span class="chip" data-a="dict" style="border-color:var(--acc)">📕 Dictionary</span><span class="chip" data-a="thes" style="border-color:var(--acc)">📚 Thesaurus</span><span class="chip" data-a="rhy" style="border-color:var(--acc)">🎵 Rhymer</span><span class="chip" data-a="fakes" title="Browse and search the Cyber Desktop fake internet (only generated & Cyber Mail sites — never your downloaded libraries)">🌐 Fake internet</span><span class="chip" data-a="dark" title="Open the Fake Dark Web: the separate onion section with its own hidden services">🧅 Fake dark web</span><span class="chip" data-a="rand" title="Open a random fake-internet website or a random page from any of your downloaded libraries">🎲 Random</span><span class="chip" data-a="ask">Ask AI about this page</span><span class="chip" data-a="listen">Read aloud</span><span class="chip" data-a="note">Save to note</span>';
  }
  $('wbar').onclick = e => {
    const c = e.target.closest('.chip'); if (!c) return;
    switch (c.dataset.a) {
      case 'hub': show(HUB, HUB_TITLE); break;
      case 'cls': A.classics.open(); break;
      case 'cbk': A.chessbooks.open(); break;
      case 'favs': A.fav.open('all'); break;
      case 'rand': random(); break;
      case 'fakes': init().then(() => { if (A.cyberWeb && A.cyberWeb.ensure) A.cyberWeb.ensure(); show('https://search.moundshroud.example/', 'Moundshroud Search'); }); break;
      case 'dark': init().then(() => {
        if (A.cyberWeb && A.cyberWeb.ensure) A.cyberWeb.ensure();
        const portal = A.cyberWeb && A.cyberWeb.darkPortal ? A.cyberWeb.darkPortal : 'https://darknet-index.onion/';
        show(portal, 'Fake dark web');
      }); break;
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
  function show(url, title, method) { navigate(url, title, false, method); }
  function openUrl(url, title, opts) {
    showBrowser();
    init().then(() => {
      if (isHub(url)) { navigate(HUB, title || HUB_TITLE, opts && opts.newTab); return; }
      /* a link on the fake internet is a real destination too: it opens that generated site, here or in a new tab */
      if (!/^\/(?:wiki|api\/lib)\//.test(url) && A.cyberWeb &&
        (A.cyberWeb.locate(url) || (/^https?:\/\//i.test(url) && A.cyberWeb.visit(url)))) {
        navigate(url, title || '', opts && opts.newTab); return;
      }
      if (!/^\//.test(url)) url = '/wiki/' + url;
      const r = navigate(url, title, opts && opts.newTab);
      if (opts && opts.bm) { const tt = r && r.id ? r : T(); tt.resume = opts.bm; }
    });
  }
  /* open MoundHub from anywhere in the app (the Browser homepage card, the toolbar chip, a search) */
  function openHub() { showBrowser(); init().then(() => show(HUB, HUB_TITLE)); }
  function runSearch(term, bookName) {
    term = (term || '').trim(); if (!term) return; hideSug(); const bk = bookName || book || (books[0] || {}).name; if (!bk) return;
    show('/wiki/search?content=' + enc(bk) + '&pattern=' + enc(term), 'Results for ' + term);
  }
  let randStep = 0, randLibBag = [];
  function shuffleCopy(list) {
    const arr = list.slice();
    for (let i = arr.length - 1; i > 0; i--) {
      const j = (Math.random() * (i + 1)) | 0;
      const tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
    }
    return arr;
  }
  async function nextDownloadedTarget() {
    if (!randLibBag.length) {
      const pool = books.filter(b => b && b.name).map(b => ({ kind: 'book', name: b.name, title: b.title || b.name }));
      try {
        const mine = (await A.api('/api/lib/mine')).libraries || [];
        for (const item of mine) {
          if (item && item.id) pool.push({ kind: 'mine', id: item.id, title: item.title || item.id });
        }
      } catch (e) { }
      randLibBag = shuffleCopy(pool);
    }
    return randLibBag.pop() || null;
  }
  /* Random walks BOTH the fake internet AND the entire downloaded library (every downloaded book — Wikipedia,
     Wiktionary, StackExchange, Gutenberg, medical, guides, etc. — plus any user-imported libraries), alternating
     smoothly between fake websites and downloaded library pages. */
  async function random() {
    await init();
    const web = A.cyberWeb;
    const hasFake = !!(web && web.next);
    const wantLibrary = !hasFake || (++randStep % 2 === 0);
    if (wantLibrary) {
      const pickLib = await nextDownloadedTarget();
      if (pickLib) {
        if (pickLib.kind === 'mine') {
          show('/api/lib/mine/' + pickLib.id + '.html', pickLib.title);
          return;
        }
        show('/wiki/random?content=' + enc(pickLib.name), '');
        return;
      }
    }
    const site = hasFake ? web.next() : null;
    if (site) {
      const paths = ['/', '/', '/', '/about', site.cat.route, '/login', '/faq'];
      show('https://' + site.host + paths[(Math.random() * paths.length) | 0], '');
      return;
    }
    const fallback = await nextDownloadedTarget();
    if (fallback) {
      if (fallback.kind === 'mine') show('/api/lib/mine/' + fallback.id + '.html', fallback.title);
      else show('/wiki/random?content=' + enc(fallback.name), '');
    }
  }
  function openBook(name) {
    showBrowser(); init().then(() => { const bk = books.find(x => x.name === name); if (!bk) return A.toast('That library is not installed any more.'); book = name; $('lbook').value = name; navigate('/wiki/content/' + name, bk.title); });
  }

  function lab(s) { const d = document.createElement('div'); d.innerHTML = s; return esc(d.textContent).replace(/&lt;b&gt;/g, '<b>').replace(/&lt;\/b&gt;/g, '</b>'); }
  async function suggest() {
    const curTab = T();
    if (curTab && curTab.fr && curTab.fr._fake) return hideSug();
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
    else if (e.key === 'Enter') {
      e.preventDefault();
      const inFake = !!(T() && T().fr && T().fr._fake);
      if (hi >= 0 && items[hi]) chooseSug(items[hi]);
      else if (isHub(q.value)) { hideSug(); show(HUB, HUB_TITLE); }
      else if (A.cyberWeb && (A.cyberWeb.visit ? A.cyberWeb.visit(q.value) : A.cyberWeb.locate(q.value))) { hideSug(); show('https://' + q.value.trim().replace(/^[a-z]+:\/\//i, ''), ''); }
      /* on a Fake Internet tab, searches always stay inside the fake internet (never jumping into downloaded libraries
         like Wikipedia). Outside it, matching fake-internet keywords search Moundshroud Search too. */
      else if (A.cyberWeb && A.cyberWeb.portalUrl && q.value.trim() && !/^\//.test(q.value.trim()) &&
        (inFake || A.cyberWeb.search(q.value.trim(), 20).length)) {
        hideSug();
        show(A.cyberWeb.portalUrl(q.value.trim()), 'Search: ' + q.value.trim());
      }
      else if (/^\/wiki\//.test(q.value.trim())) { show(q.value.trim(), ''); hideSug(); }
      else A.lib.search(q.value.trim());
    }
    else if (e.key === 'Escape') { if (sug.style.display === 'block') { e.stopPropagation(); hideSug(); } else { render(); q.blur(); } }
  });
  $('wgo').onclick = () => A.lib.search(q.value.trim());

  async function define(word) {
    word = (word || '').trim(); if (!word) return A.toast('Select a single word first');
    showBrowser(); await init();
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
      try { const s = JSON.parse(ls.get('lib_tabs', 'null')); if (s && s.t && s.t.length) { tabs = s.t.map(x => { const t = mkTab(); if ((x.s || []).length) t.stack = x.s.map(e => ({ u: e.u, t: e.t === 'Library home' ? 'Search' : e.t })); t.i = Math.min(Math.max(0, x.i == null ? t.stack.length - 1 : x.i), t.stack.length - 1); t.z = x.z || 1; t.reader = !!x.reader; return t; }); active = Math.min(s.a || 0, tabs.length - 1); } } catch (e) { }
      if (!tabs.length) tabs = [mkTab()];
    }
    bar(); switchTab(active);
  }
  $('lbook').onchange = () => { book = $('lbook').value; q.focus(); if (q.value.trim()) suggest(); };

    /* ---------- right-click: the Browser's own menu, on the toolbar and on the page itself ---------------------
     A library page runs on its own address, so its right-click is forwarded here by lib-bridge.js and mapped back
     under the pointer. Both paths build the same list, so the menu is the same everywhere in the app. */
  function pageItems() {
    const t = T(), e = E(t), open = !!(e && e.u), addr = (t && t.fr && t.fr._fake && e && e.u) || curUrl();
    return [
      { header: open ? (curTitle || e.t || 'Library page') : 'Browser' },
      { icon: '◀', label: 'Back', kbd: 'Alt+←', disabled: t.i <= 0, run: back },
      { icon: '▶', label: 'Forward', kbd: 'Alt+→', disabled: t.i >= t.stack.length - 1, run: fwd },
      { icon: '⟳', label: t.loading ? 'Stop loading' : 'Reload', kbd: 'Ctrl+R', run: () => $('lrel').click() },
      { icon: '🗂', label: 'New tab', kbd: 'Ctrl+T', run: () => newTab() },
      { icon: '</>', label: 'View page source', kbd: 'Ctrl+U', disabled: !open, run: viewSource },
      { icon: '🔗', label: 'Copy page address', disabled: !open, run: () => { if (addr) A.copy(pageAddr(addr)); else A.toast('Open a library page first'); } },
      { icon: '🔍', label: 'Find in page', kbd: 'Ctrl+F', run: openFind },
      { icon: '🖨', label: 'Print or save as PDF', kbd: 'Ctrl+P', disabled: !open, run: () => act('print') },
      { icon: '📖', label: (t.reader ? 'Turn off' : 'Turn on') + ' Reader view', disabled: !open, run: () => act('reader') },
      { icon: '➕', label: 'Zoom in', kbd: 'Ctrl+ +', run: () => zoom(.1) },
      { icon: '➖', label: 'Zoom out', kbd: 'Ctrl+ -', run: () => zoom(-.1) },
      { icon: '🔎', label: 'Reset zoom', kbd: 'Ctrl+0', run: () => zoom(0) },
      { icon: '🔖', label: 'Bookmark this spot', kbd: 'Ctrl+D', disabled: !open, run: () => { const u = curUrl(); if (!u) return A.toast('Open a library page first'); const b = A.bm.add(T().fr, 'web', u, curTitle || u); A.toast('🔖 Bookmarked at ' + Math.round(b.p * 100) + '%'); } },
      { icon: '🗒', label: 'Save page to Notes', disabled: !open, run: () => { const txt = pageText(); if (!txt) return A.toast('Open a page first'); A.notes.create(curTitle || 'Library page', '# ' + (curTitle || 'Library page') + '\n\n' + txt.slice(0, 6000)); } },
      { icon: '🔊', label: 'Read page aloud', disabled: !open, run: () => { const txt = pageText(); if (!txt) return A.toast('Open a page first'); A.speech.speak(txt.slice(0, 3000)); } },
      { icon: '🤖', label: 'Ask AI about this page', disabled: !open, run: () => { const txt = pageText(); if (!txt) return A.toast('Open a page first'); A.showTab('chat'); A.chat.ask('Summarize the page "' + (curTitle || 'this page') + '" in a few clear paragraphs.\n\nPAGE TEXT:\n' + txt.slice(0, 9000), { noLocal: true, sources: [] }); } },
      { icon: '🕘', label: 'History of this tab', run: showHist },
      { icon: '🧹', label: 'Clear browsing history', run: () => act('clearhist') }
    ];
  }
  function frameMenu(m, fr) {
    const box = fr.getBoundingClientRect();
    const x = box.left + Math.max(0, Math.min(+m.x || 0, box.width - 2));
    const y = box.top + Math.max(0, Math.min(+m.y || 0, box.height - 2));
    if (A.ctxMenu && A.ctxMenu.page) A.ctxMenu.page({ x, y, link: m.link || '', sel: m.sel || '', url: m.url || '' });
  }
  /* A page on this app's own address (MoundHub, a library you imported) has no lib-bridge, but it is same-origin, so
     its right-click is taken over here and the same Browser menu opens under the pointer — in the main Browser, in the
     Cyber Desktop's browser, and while either one is full screen. A text field or selected text keeps the browser's
     own menu, which is the one that can cut, copy and paste. */
  function ownFrameMenu(fr, event) {
    const box = fr.getBoundingClientRect();
    let link = '', sel = '';
    try {
      const a = event.target.closest && event.target.closest('a[href]');
      if (a) link = new URL(a.href, location.href).href;
      sel = String((fr.contentWindow && fr.contentWindow.getSelection && fr.contentWindow.getSelection()) || '').trim().slice(0, 600);
    } catch (e) { }
    if (A.ctxMenu && A.ctxMenu.page) A.ctxMenu.page({ x: box.left + event.clientX, y: box.top + event.clientY, link, sel });
  }
  function wireOwnCtx(fr) {
    fr.addEventListener('load', () => {
      let doc = null;
      try { doc = fr.contentDocument; } catch (e) { doc = null; }   // library pages are another address: lib-bridge.js speaks for them
      if (!doc || doc.__moundCtx) return;
      doc.__moundCtx = true;
      doc.addEventListener('contextmenu', event => {
        const t = event.target;
        const field = t && t.closest && t.closest('input, textarea, [contenteditable=""], [contenteditable="true"]');
        let sel = '';
        try { sel = String(fr.contentWindow.getSelection() || '').trim(); } catch (e) { }
        if (field || sel) return;
        event.preventDefault();
        ownFrameMenu(fr, event);
      }, true);
    });
  }
  /* View page source: the page's own HTML, handed over by lib-bridge.js (or any app page), in a foreground pane
     that mounts inside document.fullscreenElement when fullscreened so it ALWAYS paints on top of everything. */
  let sourcePanel = null, sourceEsc = null, sourceFs = null, sourceNoteTitle = '';
  function overlayHost() {
    const fs = document.fullscreenElement;
    if (fs && fs.appendChild && !/^(?:IFRAME|VIDEO|CANVAS|IMG|EMBED|OBJECT)$/.test(fs.tagName || '')) return fs;
    return document.body;
  }
  function mountTop(el) {
    if (!el) return;
    const fs = document.fullscreenElement;
    if (fs && /^(?:IFRAME|VIDEO|CANVAS|IMG|EMBED|OBJECT)$/.test(fs.tagName || '')) {
      try { document.exitFullscreen().catch(() => { }); } catch (x) { }
    }
    const host = overlayHost();
    if (el.parentNode !== host || host.lastElementChild !== el) host.appendChild(el);
  }
  function closeSource() {
    sourcePanel?.remove(); sourcePanel = null;
    if (sourceEsc) { document.removeEventListener('keydown', sourceEsc, true); sourceEsc = null; }
    if (sourceFs) { document.removeEventListener('fullscreenchange', sourceFs); sourceFs = null; }
  }
  function viewSource(custom) {
    const hasCustom = custom && typeof custom === 'object' && ('html' in custom || 'url' in custom);
    const t = hasCustom ? null : T(), fr = t && t.fr, e = t && E(t);
    if (!hasCustom && (!fr || !e || !e.u)) return A.toast('Open a library page first, then right-click → View page source');
    if (!sourcePanel) {
      sourcePanel = document.createElement('div');
      sourcePanel.className = 'srcview';
      sourcePanel.tabIndex = -1;
      sourcePanel.setAttribute('role', 'dialog');
      sourcePanel.setAttribute('aria-label', 'Page source');
      sourcePanel.innerHTML = '<header><b>&lt;/&gt; Page source</b><span data-src-url></span><div>' +
        '<button type="button" data-src="copy">📋 Copy</button><button type="button" data-src="note">🗒 Save to Notes</button>' +
        '<button type="button" data-src="close" aria-label="Close page source">✕</button></div></header><pre data-src-code>Reading the page…</pre>';
      sourcePanel.querySelector('[data-src="close"]').onclick = closeSource;
      sourcePanel.querySelector('[data-src="copy"]').onclick = () => { A.copy(sourcePanel.querySelector('[data-src-code]').textContent || ''); A.toast('Page source copied'); };
      sourcePanel.querySelector('[data-src="note"]').onclick = () => { const code = sourcePanel.querySelector('[data-src-code]').textContent || ''; A.notes.create('Page source: ' + (sourceNoteTitle || curTitle || 'Page'), '```html\n' + code.slice(0, 20000) + '\n```'); A.toast('Page source saved to Notes'); };
      sourceEsc = ev => { if (ev.key === 'Escape') { ev.preventDefault(); ev.stopPropagation(); closeSource(); } };
      sourceFs = () => { if (sourcePanel && sourcePanel.isConnected) mountTop(sourcePanel); };
      document.addEventListener('keydown', sourceEsc, true);
      document.addEventListener('fullscreenchange', sourceFs);
    }
    /* Always mount into the active fullscreen host (or body) as last child so it comes straight to the forefront */
    mountTop(sourcePanel);
    try { sourcePanel.focus({ preventScroll: true }); } catch (x) { }
    const code = sourcePanel.querySelector('[data-src-code]');
    if (hasCustom) {
      sourceNoteTitle = custom.title || 'Page';
      sourcePanel.querySelector('[data-src-url]').textContent = custom.url || location.href;
      code.textContent = String(custom.html || '') || 'This page has no readable HTML source.';
      return;
    }
    sourceNoteTitle = curTitle || e.t || 'Library page';
    sourcePanel.querySelector('[data-src-url]').textContent = /^https?:/i.test(e.u) ? e.u : location.origin + e.u;
    code.textContent = 'Reading the page…';
    if (fr._fake) { code.textContent = (fr._cdweb && fr._cdweb.answer.body) || 'This simulated page has no source.'; return; }
    /* an imported library is a same-origin page: its source is read from the document. Library pages hand it over by message. */
    if (!A.libframe.isLib(e.u)) {
      let html = '';
      try { html = fr.contentDocument && fr.contentDocument.documentElement ? fr.contentDocument.documentElement.outerHTML : ''; } catch (x) { }
      code.textContent = html || 'This page did not hand over its source. Reload it and try again.';
      return;
    }
    fr.lf.source().then(html => { if (code.isConnected) code.textContent = html || 'This page did not hand over its source. Reload it and try again.'; });
  }
  /* ---------- your own libraries: pages you add by their source ---------- */
  const MINE = /^\/api\/lib\/mine\//;
  const IMPCSS = '.impview{inset:6vh 6vw;max-width:760px;margin:0 auto}' +
    '.impview .impbody{display:grid;gap:11px;padding:16px 18px;overflow:auto}' +
    '.impview label{display:grid;gap:5px;font-size:12.5px;color:var(--mute)}' +
    '.impview input[type=text],.impview input:not([type]),.impview textarea{border:1px solid var(--line);border-radius:9px;background:var(--bg);color:var(--text);padding:8px 10px;font:13px/1.5 inherit}' +
    '.impview textarea{min-height:150px;resize:vertical;font-family:Consolas,"Cascadia Mono",monospace;white-space:pre}' +
    '.impview .improw{display:flex;gap:8px;flex-wrap:wrap;align-items:center}' +
    '.impview .improw .pri{padding:8px 14px;border-radius:9px}' +
    '.implist{display:grid;gap:7px}' +
    '.implist div{display:flex;gap:9px;align-items:center;padding:8px 10px;border:1px solid var(--line);border-radius:10px;background:var(--panel2)}' +
    '.implist b{font-size:13px;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
    '.implist small{color:var(--mute);font-size:11.5px;margin-left:auto;flex:none}' +
    '.implist button{flex:none}';
  let impDlg = null;
  function closeImport() { impDlg?.remove(); impDlg = null; }
  function impShell(title, note, inner) {
    closeImport();
    if (!document.getElementById('impcss')) { const style = document.createElement('style'); style.id = 'impcss'; style.textContent = IMPCSS; document.head.appendChild(style); }
    impDlg = document.createElement('div');
    impDlg.className = 'srcview impview';
    impDlg.innerHTML = '<header><b>' + title + '</b><span>' + note + '</span><div><button type="button" data-imp="close" aria-label="Close">✕</button></div></header>' +
      '<div class="impbody">' + inner + '</div>';
    mountTop(impDlg);
    impDlg.querySelector('[data-imp="close"]').onclick = closeImport;
    impDlg.addEventListener('click', event => { if (event.target === impDlg) closeImport(); });
    return impDlg;
  }
  function importLibrary() {
    const box = impShell('📥 Import your own library', 'Add a page by its source: HTML, Markdown or plain text. It is saved on this PC.',
      '<label>Library name<input data-imp="title" placeholder="My offline site" maxlength="120"></label>' +
      '<label>Choose a file<input type="file" data-imp="file" accept=".html,.htm,.xhtml,.md,.markdown,.txt,text/html,text/plain"></label>' +
      '<label>…or paste the page source<textarea data-imp="src" spellcheck="false" placeholder="&lt;!doctype html&gt;\n&lt;html&gt;…"></textarea></label>' +
      '<p class="small" data-imp="note">Imported pages open in the Browser, and View page source shows exactly the code you added.</p>' +
      '<div class="improw"><button type="button" class="pri" data-imp="save">Import library</button>' +
      '<button type="button" data-imp="list">Your libraries</button></div>');
    const title = box.querySelector('[data-imp="title"]'), src = box.querySelector('[data-imp="src"]'), note = box.querySelector('[data-imp="note"]');
    box.querySelector('[data-imp="file"]').onchange = async event => {
      const file = event.target.files[0];
      if (!file) return;
      if (file.size > 2 * 1024 * 1024) { note.textContent = 'That file is larger than 2 MB. Paste the part you need instead.'; return; }
      const text = await file.text().catch(() => '');
      if (!text) { note.textContent = 'That file could not be read.'; return; }
      src.value = text;
      if (!title.value.trim()) title.value = file.name.replace(/\.(html?|xhtml|md|markdown|txt)$/i, '');
      note.textContent = 'Read ' + text.length.toLocaleString() + ' characters from ' + file.name + '.';
    };
    box.querySelector('[data-imp="list"]').onclick = myLibraries;
    box.querySelector('[data-imp="save"]').onclick = async () => {
      const html = src.value;
      if (!html.trim()) { note.textContent = 'Add the page source first.'; src.focus(); return; }
      const button = box.querySelector('[data-imp="save"]');
      button.disabled = true;
      let result;
      try { result = await A.api('/api/lib/mine/import', { title: title.value.trim(), html }); }
      catch (e) { result = { error: String(e.message || e) }; }
      button.disabled = false;
      if (result.error) { note.textContent = result.error; return; }
      closeImport();
      A.toast('📥 Added “' + result.library.title + '” to your libraries');
      navigate('/api/lib/mine/' + result.library.id + '.html', result.library.title, true);
    };
    title.focus();
  }
  async function myLibraries() {
    const box = impShell('🗂 Your libraries', 'Pages you imported by their source. Open one in a tab, or remove it.',
      '<div class="implist" data-imp="list"><p class="small mute">Reading your libraries…</p></div>' +
      '<div class="improw"><button type="button" class="pri" data-imp="add">Import another</button></div>');
    box.querySelector('[data-imp="add"]').onclick = importLibrary;
    const list = box.querySelector('[data-imp="list"]');
    let libraries = [];
    try { libraries = (await A.api('/api/lib/mine')).libraries || []; } catch (e) { libraries = []; }
    const draw = () => {
      list.innerHTML = libraries.length ? libraries.map((item, i) =>
        '<div><b title="' + esc(item.title) + '">📄 ' + esc(item.title) + '</b>' +
        '<small>' + Math.max(1, Math.round((item.bytes || 0) / 1024)) + ' KB</small>' +
        '<button type="button" data-open="' + i + '">Open</button>' +
        '<button type="button" data-del="' + i + '" title="Remove this library">✕</button></div>').join('')
        : '<p class="small mute">Nothing imported yet. Choose Import another, paste a page\'s source, and it appears here and in the Browser.</p>';
    };
    draw();
    list.onclick = async event => {
      const open = event.target.closest('[data-open]'), del = event.target.closest('[data-del]');
      if (open) {
        const item = libraries[+open.dataset.open];
        if (!item) return;
        closeImport();
        A.lib.newTab('/api/lib/mine/' + item.id + '.html', item.title);
        return;
      }
      if (!del) return;
      const item = libraries[+del.dataset.del];
      if (!item) return;
      if (!(await A.confirm('Remove “' + item.title + '” from your libraries? The saved page is deleted from this PC.'))) return;
      const r = await A.api('/api/lib/mine/remove', { id: item.id }).catch(e => ({ error: e.message }));
      if (r.error) { A.notify('err', r.error); return; }
      libraries = libraries.filter(x => x.id !== item.id);
      draw();
    };
  }
  A.closePageSource = closeSource;

  A.lib = {
    openUrl, openBook, define, init, home: goHome, hub: openHub, dark: () => DARK + (A.custom ? A.custom.bookCss() : ''),
    dock(host) {
      desktopHost = host;
      moveBrowser(host);
      root.classList.add('in-cyber-desktop', 'on');
      init();
      setHead();
      return () => { if (desktopHost === host) releaseBrowser(); };
    },
    search(term, cat, hint) { showBrowser(); init().then(() => { q.value = ''; navigate(''); A.websearch.mount($('wh')); A.websearch.search(term); }); },
    /* the mail (and moundshell) open a generated site here: same tab machinery, links and history as any page */
    openSite(url, title) {
      const raw = String(url == null ? '' : url).trim();
      const target = isHub(raw) ? HUB : (/^(?:https?:\/\/|\/)/i.test(raw) ? raw : 'https://' + raw);
      if (!isHub(target) && A.cyberWeb && A.cyberWeb.visit) A.cyberWeb.visit(target);
      showBrowser();
      init().then(() => navigate(target, title || ''));
    },
    pending: () => { const p = pending; pending = null; return p; },
    selection: () => lastSel, back, forward: fwd, newTab: (u, t) => newTab(u, t), tabs: () => tabs.map(t => ({ title: E(t).t, url: E(t).u })),
    current: () => {
      const t = T(), e = E(t), web = t && t.fr && t.fr._cdweb ? t.fr._cdweb : null;
      return {
        url: (e && e.u) || curUrl(),
        title: (e && e.t) || curTitle,
        fake: !!(t && t.fr && t.fr._fake),
        host: (web && web.site && web.site.host) || '',
        trapped: !!(web && web.site && web.site.trapped)
      };
    },
    pageItems, viewSource, find: openFind, libraryOf, print: () => act('print'), reader: () => act('reader'), zoom, reload: () => $('lrel').click(),
    bookmark: () => { const u = curUrl(); if (!u) return A.toast('Open a library page first'); return A.bm.add(T().fr, 'web', u, curTitle || u); },
    inDesktop: () => !!desktopHost
  };
  addEventListener('message', e => { if (e.data === 'esc') A.escape && A.escape(); });
  A.on('tab:show', name => { if (name === 'web') releaseBrowser(); });
  A.registerTab('web', 'Browser', () => { init(); setTimeout(() => { if (T() && !E(T()).u) A.websearch.focus(); }, 50); });
  A.ready.push(() => init());
})();

// The desktop look (web/os.css): the wallpaper and taskbar are the page, the app itself opens in a window over
// them, and the left of the wallpaper holds app and folder icons, the way a desktop system works. Everything here
// is a switch in Settings (Appearance for the desktop, Privacy for the password); turning the desktop off puts the
// page back exactly as it was, because the window is unwrapped and everything built here is removed again.
(() => {
  if (!window.A) return;
  const root = document.documentElement, body = document.body;
  const esc2 = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const on = () => ls.get('oslook', '1') !== '0';
  const desk = () => root.classList.contains('os-desk');
  const tabLabel = n => (A.tabs[n] && A.tabs[n].label) || n;
  const iconOf = n => (A.icon && A.icon(n)) || '<span class="osi-e">' + esc2(A.NAVIC[n] || '•') + '</span>';
  const tintOf = n => (A.tint ? A.tint(n) : '');
  const iconCell = n => '<span class="osi-ic" style="--tint:' + tintOf(n) + '">' + iconOf(n) + '</span>';
  /* an app's logo in colour, without the tile: the taskbar, the title bar and the Start menu have no room for one */
  const iconTint = n => '<span class="os-tint" style="color:' + tintOf(n) + '">' + iconOf(n) + '</span>';
  const FOLDER_ICON = '<svg class="ic" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7a2 2 0 0 1 2-2h4l2 2.5h8a2 2 0 0 1 2 2V17a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>';

  /* ---------- wallpapers: drawn with gradients, so there are no extra files and they always fit ---------- */
  const WALLS = [
    ['orbital', 'Orbital dawn', 'radial-gradient(120% 92% at 68% 4%,#dff0ff 0%,#93c9f2 16%,#4b88bd 38%,#1a3a55 64%,#070f19 100%)'],
    ['nebula', 'Nebula', 'radial-gradient(80% 60% at 22% 18%,#6f3bd0 0%,transparent 60%),radial-gradient(72% 60% at 84% 74%,#1f6f8d 0%,transparent 62%),linear-gradient(160deg,#0b0620,#120b2c 45%,#05030c)'],
    ['cyber', 'Cyber grid', 'repeating-linear-gradient(0deg,rgba(94,230,168,.09) 0 1px,transparent 1px 42px),repeating-linear-gradient(90deg,rgba(94,230,168,.09) 0 1px,transparent 1px 42px),linear-gradient(180deg,#04121a,#062028 60%,#02090d)'],
    ['ember', 'Ember', 'radial-gradient(92% 70% at 18% 92%,#b5482a 0%,transparent 60%),radial-gradient(70% 60% at 84% 10%,#7e2f5f 0%,transparent 60%),linear-gradient(160deg,#1a0f16,#2a1420 55%,#120a10)'],
    ['glacier', 'Glacier', 'linear-gradient(165deg,#d3ebf7 0%,#83bad2 30%,#2f6a86 62%,#0b2430 100%)'],
    ['violet', 'Violet dusk', 'linear-gradient(160deg,#241c48,#3c2c6d 45%,#150f2a)'],
    ['aurora', 'Aurora', 'radial-gradient(60% 45% at 30% 18%,rgba(70,215,200,.55) 0%,transparent 60%),radial-gradient(56% 42% at 72% 30%,rgba(139,124,255,.5) 0%,transparent 62%),linear-gradient(180deg,#040b16,#071827 62%,#02060c)'],
    ['midnight', 'Midnight', 'linear-gradient(180deg,#0b1220,#0e1726 55%,#070b12)'],
    ['paper', 'Paper', 'linear-gradient(160deg,#f7f3e9,#e9e3d5 58%,#d5cec0)'],
    ['teal', 'Teal (1995)', 'linear-gradient(180deg,#0a7f7f,#046565)'],
    ['bliss', 'Bliss', 'linear-gradient(180deg,#3a7bd5 0%,#7fc4f7 42%,#a8d8f5 58%,#79b84a 62%,#4f8f2f 100%)'],
    ['aubergine', 'Aubergine', 'radial-gradient(90% 70% at 30% 12%,#77216f 0%,transparent 60%),linear-gradient(160deg,#2c001e,#4a0f3f 55%,#1b0014)'],
    ['mintleaf', 'Mint leaf', 'linear-gradient(160deg,#1f3d2b,#2f6f45 55%,#12241a)'],
    ['breeze', 'Breeze', 'linear-gradient(160deg,#1b2b3a,#2a4a63 55%,#0e1a24)'],
    ['adwaita', 'Adwaita', 'linear-gradient(160deg,#2b2b2b,#3a3a3a 55%,#1a1a1a)']
  ];
  const wallValue = () => {
    const id = ls.get('os_wall', 'orbital'), img = ls.get('os_wall_img', '');
    if (id === 'custom' && img) return 'url("' + img + '") center/cover no-repeat fixed,#0a0f18';
    const w = WALLS.filter(x => x[0] === id)[0] || WALLS[0];
    return w[2];
  };
  const paintWall = () => { try { root.style.setProperty('--os-wall', wallValue()); } catch (e) { } };

  /* ---------- what sits where ---------- */
  const DEFAULT_ICONS = ['home', 'chat', 'files', 'notes', 'study', 'play', 'cyber', 'studio', 'music', 'faith', 'lib', 'health'];
  const DEFAULT_PINS = ['home', 'chat', 'web', 'files', 'notes', 'play', 'cyber'];
  const iconsOn = () => ls.get('osicons', '1') !== '0';
  /* the Browser is on the bar by default: someone who saved their bar before that gets it once, and can still
     unpin it like any other app */
  const readPins = () => {
    let a = null;
    try { const s = JSON.parse(ls.get('os_pins', 'null')); if (Array.isArray(s) && s.length) a = s.filter(n => A.tabs[n]); } catch (e) { }
    if (!a) return DEFAULT_PINS.filter(n => A.tabs[n]);
    if (A.tabs.web && a.indexOf('web') < 0 && ls.get('os_pins_browser', '0') !== '1') {
      a.splice(1, 0, 'web'); writePins(a); ls.set('os_pins_browser', '1');
    }
    return a;
  };
  const writePins = a => ls.set('os_pins', JSON.stringify(a));
  const togglePin = n => { const p = readPins(), i = p.indexOf(n); if (i >= 0) p.splice(i, 1); else p.push(n); writePins(p); ls.set('os_pins_browser', '1'); drawBar(); };
  const groups = () => (A.NAVGROUPS || []).filter(g => g.tabs.some(t => A.tabs[t]));

  /* ---------- system looks: the same desktop, drawn the way other operating systems drew theirs ---------- */
  /* barH is the taskbar height that system used, barTop its usual place, ctl the order and side of the window
     buttons, start the word on the Start button ('' is an icon only), pv the preview colours [title, bar, bar text,
     window face, accent], wall the backdrop of its preview card. */
  const THEMES = [
    { id: 'mound', fam: 'Now', name: 'Moundshroud', note: 'The look this app ships with', accent: '#8b7cff', barH: 60, barTop: false, ctl: ['min', 'max', 'close'], start: 'Start', pv: ['#121a2a', '#0c101a', '#dbe2ff', '#101724', '#8b7cff'], wall: 'linear-gradient(160deg,#2a3a5a,#0b1220)' },
    { id: 'greybox', fam: 'Grey years', name: 'Grey Box', note: '1995 · grey 3D, a Start menu, a 30px bar', accent: '#000080', barH: 30, barTop: false, ctl: ['min', 'max', 'close'], start: 'Start', pv: ['#000080', '#c0c0c0', '#000000', '#c0c0c0', '#000080'], wall: 'linear-gradient(180deg,#0a7f7f,#046565)' },
    { id: 'greygrad', fam: 'Grey years', name: 'Grey Gradient', note: '1998 · a gradient title, a 3D taskbar', accent: '#000080', barH: 30, barTop: false, ctl: ['min', 'max', 'close'], start: 'Start', pv: ['#1084d0', '#c0c0c0', '#000000', '#c0c0c0', '#000080'], wall: 'linear-gradient(180deg,#0a7f7f,#046565)' },
    { id: 'slateblue', fam: 'Grey years', name: 'Slate Blue', note: '2000 · the pale blue professional title bar', accent: '#0a246a', barH: 30, barTop: false, ctl: ['min', 'max', 'close'], start: 'Start', pv: ['#0a246a', '#c0c0c0', '#000000', '#c0c0c0', '#0a246a'], wall: 'linear-gradient(180deg,#1a5f8a,#0a3550)' },
    { id: 'millennia', fam: 'Grey years', name: 'Millennia', note: '2000 · millennium blue and grey', accent: '#0054e3', barH: 30, barTop: false, ctl: ['min', 'max', 'close'], start: 'Start', pv: ['#0054e3', '#c0c0c0', '#000000', '#c0c0c0', '#0054e3'], wall: 'linear-gradient(180deg,#1a5f8a,#0a3550)' },
    { id: 'skyblue', fam: 'Glass years', name: 'Sky Blue', note: '2001 · sky blue, rounded corners, a green Start', accent: '#2f6bde', barH: 34, barTop: false, ctl: ['min', 'max', 'close'], start: 'Start', pv: ['#0053ee', '#245edb', '#ffffff', '#ece9d8', '#2f6bde'], wall: 'linear-gradient(180deg,#3a7bd5,#7fc4f7 42%,#79b84a 62%,#4f8f2f)' },
    { id: 'blackglass', fam: 'Glass years', name: 'Black Glass', note: '2006 · black glass and a round Start', accent: '#3f7fd0', barH: 38, barTop: false, ctl: ['min', 'max', 'close'], start: '', pv: ['#cfe2f8', '#1f2c40', '#ffffff', '#e7eef8', '#3f7fd0'], wall: 'linear-gradient(160deg,#1b3550,#3b6f9e 55%,#0d1a26)' },
    { id: 'blueglass', fam: 'Glass years', name: 'Blue Glass', note: '2009 · glass panels, pinned apps', accent: '#4a9eff', barH: 40, barTop: false, ctl: ['min', 'max', 'close'], start: '', pv: ['#d6e7fb', '#16213a', '#ffffff', '#e7eef8', '#4a9eff'], wall: 'linear-gradient(160deg,#0d3b66,#3b7fb5 55%,#071a2b)' },
    { id: 'flattiles', fam: 'Flat years', name: 'Flat Tiles', note: '2012 · flat tiles and a full-screen Start', accent: '#00a4ef', barH: 40, barTop: false, ctl: ['min', 'max', 'close'], start: '', pv: ['#2b2b2b', '#1f1f1f', '#ffffff', '#2d2d2d', '#00a4ef'], wall: 'linear-gradient(160deg,#0f4c81,#1f7fa8 55%,#0a1f2e)' },
    { id: 'darkbar', fam: 'Flat years', name: 'Dark Bar', note: '2015 · a dark bar and accent underlines', accent: '#0078d4', barH: 40, barTop: false, ctl: ['min', 'max', 'close'], start: '', pv: ['#202020', '#181818', '#ffffff', '#262626', '#0078d4'], wall: 'linear-gradient(160deg,#123a5a,#1f6f9a 55%,#08161f)' },
    { id: 'centred', fam: 'Flat years', name: 'Centred Light', note: '2021 · a centred taskbar, rounded panels', accent: '#0078d4', barH: 48, barTop: false, ctl: ['min', 'max', 'close'], start: '', pv: ['#f3f3f3', '#e9e9e9', '#1b1b1b', '#fbfbfb', '#0078d4'], wall: 'linear-gradient(160deg,#1b4f8a,#5a9bd8 55%,#0c2337)' },
    { id: 'orangetop', fam: 'Open desktops', name: 'Orange Top', note: 'A purple desktop, a top bar, buttons on the left', accent: '#e95420', barH: 34, barTop: true, ctl: ['close', 'min', 'max'], start: 'Activities', pv: ['#3d3d3d', '#1e1e1e', '#f2f2f2', '#3d3d3d', '#e95420'], wall: 'radial-gradient(90% 70% at 30% 12%,#77216f 0%,transparent 60%),linear-gradient(160deg,#2c001e,#4a0f3f 55%,#1b0014)' },
    { id: 'greenmenu', fam: 'Open desktops', name: 'Green Menu', note: 'A dark panel and a green Menu button', accent: '#8ec63f', barH: 40, barTop: false, ctl: ['min', 'max', 'close'], start: 'Menu', pv: ['#3c3c3c', '#2f2f2f', '#eaeaea', '#3c3c3c', '#8ec63f'], wall: 'linear-gradient(160deg,#1f3d2b,#2f6f45 55%,#12241a)' },
    { id: 'oceanblue', fam: 'Open desktops', name: 'Ocean Blue', note: 'A dark panel, blue highlights, a launcher', accent: '#3daee9', barH: 44, barTop: false, ctl: ['min', 'max', 'close'], start: 'Apps', pv: ['#31363b', '#232629', '#eff0f1', '#31363b', '#3daee9'], wall: 'linear-gradient(160deg,#1b2b3a,#2a4a63 55%,#0e1a24)' },
    { id: 'gridshell', fam: 'Open desktops', name: 'Grid Shell', note: 'A black top bar and a full-screen app grid', accent: '#3584e4', barH: 34, barTop: true, ctl: ['min', 'max', 'close'], start: 'Activities', pv: ['#303030', '#000000', '#ffffff', '#303030', '#3584e4'], wall: 'linear-gradient(160deg,#2b2b2b,#3a3a3a 55%,#1a1a1a)' },
    { id: 'swirl', fam: 'Open desktops', name: 'Swirl Red', note: 'A red swirl on warm charcoal, a bottom dock', accent: '#d70a53', barH: 38, barTop: false, ctl: ['min', 'max', 'close'], start: 'Menu', pv: ['#3a1c2a', '#2b1620', '#f6eaf0', '#2f1a24', '#d70a53'], wall: 'radial-gradient(90% 70% at 25% 10%,#5c1030 0%,transparent 60%),linear-gradient(160deg,#241018,#3d1526 55%,#140a10)' },
    { id: 'obsidian', fam: 'Open desktops', name: 'Obsidian', note: 'Black and monospaced, built for a terminal', accent: '#00b7ff', barH: 32, barTop: false, ctl: ['min', 'max', 'close'], start: 'Term', pv: ['#141414', '#0d0d0d', '#d6f0ff', '#1b1b1b', '#00b7ff'], wall: 'linear-gradient(160deg,#0b1015,#132330 55%,#05080a)' },
    { id: 'rolling', fam: 'Open desktops', name: 'Rolling Minimal', note: 'A thin black bar, monospaced, nothing else', accent: '#1793d1', barH: 30, barTop: false, ctl: ['min', 'max', 'close'], start: 'Apps', pv: ['#1b1b1b', '#111111', '#e6e6e6', '#171717', '#1793d1'], wall: 'linear-gradient(160deg,#101010,#1a1a1a 55%,#0a0a0a)' },
    { id: 'gecko', fam: 'Open desktops', name: 'Gecko Teal', note: 'A teal top bar and a green accent', accent: '#73ba25', barH: 34, barTop: true, ctl: ['min', 'max', 'close'], start: 'Activities', pv: ['#18342c', '#0f241f', '#e8f6ef', '#1b3a31', '#73ba25'], wall: 'linear-gradient(170deg,#0d3a2e,#1d6b4a 55%,#071a15)' },
    { id: 'deepblue', fam: 'Open desktops', name: 'Deep Blue', note: 'A deep blue dock, translucent panels', accent: '#008cff', barH: 44, barTop: false, ctl: ['min', 'max', 'close'], start: 'Launcher', pv: ['#16243a', '#101a2b', '#e8f0ff', '#182740', '#008cff'], wall: 'linear-gradient(160deg,#0a1730,#1a3a66 55%,#050c18)' },
    { id: 'cobalt', fam: 'Open desktops', name: 'Cobalt Tiles', note: 'Grey tiles with a cobalt accent', accent: '#4b8bf5', barH: 40, barTop: false, ctl: ['min', 'max', 'close'], start: 'Apps', pv: ['#262c37', '#1b1f27', '#eef2f8', '#232936', '#4b8bf5'], wall: 'linear-gradient(160deg,#141922,#242b38 55%,#0b0f15)' }
  ];
  /* looks used to be named after the systems they echo: keep anyone's saved choice working after the rename */
  const OLD_IDS = { win95: 'greybox', win98: 'greygrad', win2000: 'slateblue', winme: 'millennia', winxp: 'skyblue', winvista: 'blackglass', win7: 'blueglass', win8: 'flattiles', win10: 'darkbar', win11: 'centred', ubuntu: 'orangetop', mint: 'greenmenu', kde: 'oceanblue', gnome: 'gridshell' };
  const themeId = () => { let id = ls.get('os_theme', 'mound'); if (OLD_IDS[id]) id = OLD_IDS[id]; return THEMES.some(t => t.id === id) ? id : 'mound'; };
  const themeDef = () => THEMES.filter(t => t.id === themeId())[0] || THEMES[0];
  const applyTheme = () => { const id = themeId(); THEMES.forEach(t => root.classList.toggle('ost-' + t.id, t.id === id)); };

  /* ---------- the desktop's own settings: icon size, names, taskbar place and size, accent, motion ---------- */
  const ICON_SIZES = { s: 36, m: 46, l: 58 };
  const theme = () => {
    const size = ICON_SIZES[ls.get('os_icsize', 'm')] ? ls.get('os_icsize', 'm') : 'm';
    const accent = ls.get('os_accent', ''), d = themeDef();
    return {
      size,
      labels: ls.get('os_labels', '1') !== '0',
      barTop: (ls.get('os_barpos', '') || (d.barTop ? 'top' : 'bottom')) === 'top',
      barH: Math.max(30, Math.min(96, parseInt(ls.get('os_barsize', ''), 10) || d.barH || 60)),
      accent: /^#[0-9a-f]{6}$/i.test(accent) ? accent : (d.accent || '#8b7cff'),
      clock: ls.get('os_clock', '1') !== '0',
      motion: ls.get('os_anim', '1') !== '0',
      snap: ls.get('os_snap', '1') !== '0'
    };
  };
  const iconPx = () => ICON_SIZES[theme().size] || 46;
  const cell = () => { const ic = iconPx(), labels = theme().labels && innerWidth > 560; return { w: Math.max(88, ic + 52), h: ic + (labels ? 48 : 16) }; };
  const deskBox = () => { const t = theme(), top = t.barTop ? t.barH : 0, bottom = t.barTop ? 0 : t.barH; return { x: 4, y: top + 4, w: innerWidth - 8, h: innerHeight - top - bottom - 8 }; };
  const restyle = () => {
    const t = theme(), c = cell();
    applyTheme();
    root.style.setProperty('--os-bar-h', t.barH + 'px');
    root.style.setProperty('--os-accent', t.accent);
    root.style.setProperty('--os-icon', iconPx() + 'px');
    root.style.setProperty('--os-cellw', c.w + 'px');
    root.style.setProperty('--os-cellh', c.h + 'px');
    root.classList.toggle('os-bar-top', t.barTop);
    root.classList.toggle('os-no-labels', !t.labels || innerWidth <= 560);
    root.classList.toggle('os-no-clock', !t.clock);
    root.classList.toggle('os-motion-off', !t.motion);
  };

  /* ---------- menus: the app's own right-click menu, given the desktop's items ---------- */
  const baseItems = () => ([
    { icon: '🔎', label: 'Search & Commands', kbd: 'Ctrl+K', run: () => { const g = $('gs'); if (g) g.click(); } },
    { icon: '🖼️', label: 'Change wallpaper…', run: wallpaper },
    { icon: '🖥️', label: 'Desktop settings…', run: () => customize() },
    { icon: '🪟', label: 'System look…', run: () => systems() },
    { icon: '⚙', label: 'Settings', run: () => { if (A.settings && A.settings.open) A.settings.open(); } },
    { icon: '🔒', label: 'Lock Moundshroud', run: () => showLock() },
    { icon: '↩', label: 'Turn off the desktop look', run: () => A.os.set(false) }
  ]);
  const menu = (e, sections) => {
    e.preventDefault(); e.stopPropagation();
    if (A.ctxMenu) A.ctxMenu.show(e.clientX, e.clientY, sections, { skipLang: true });
  };

  /* ---------- the app window ---------- */
  let win = null, barEl = null, headEl = null, navEl = null, mainEl = null, ctlEl = null, titleEl = null;
  let maxed = false, saved = null, drag = null, started = false;

  /* the taskbar's place and size decide where a window can sit */
  const workArea = () => {
    const t = theme(), top = t.barTop ? t.barH : 0, bottom = t.barTop ? 0 : t.barH;
    return { t: top + 8, b: bottom + 8, h: innerHeight - top - bottom - 16 };
  };
  const place = (l, t, w, h) => {
    if (!win) return;
    w = Math.max(320, Math.min(Math.round(w), innerWidth));
    h = Math.max(220, Math.min(Math.round(h), innerHeight));
    t = Math.max(0, Math.round(t));
    win.style.left = Math.round(l) + 'px'; win.style.top = t + 'px';
    win.style.width = w + 'px'; win.style.height = h + 'px';
    win.style.right = 'auto'; win.style.bottom = 'auto';
    /* the window can be narrower than the screen, so its own width (not the viewport) decides when a toolbar or a
       page has to make do with less: web/fit.css reads these two classes */
    win.classList.toggle('nw', w < 850);
    win.classList.toggle('nw-xs', w < 480);
  };
  /* a window opens over the whole screen, leaving only the taskbar in view, so every page it holds has room to show
     all of itself; the desktop icons come back when the window is put away */
  const defaultRect = () => {
    const t = theme(), top = t.barTop ? t.barH : 0;
    return { l: 0, t: top, w: innerWidth, h: Math.max(240, innerHeight - t.barH) };
  };
  const readRect = () => {
    try {
      const r = JSON.parse(ls.get('os_winrect', 'null'));
      if (!r || !(r.w > 200) || !(r.h > 140)) return null;
      const a = workArea();
      return { l: Math.max(0, Math.min(r.l, innerWidth - 120)), t: Math.max(a.t, Math.min(r.t, innerHeight - 60)), w: Math.max(320, Math.min(r.w, innerWidth)), h: Math.max(220, Math.min(r.h, innerHeight)) };
    } catch (e) { return null; }
  };
  const saveRect = () => {
    if (!win || maxed || ls.get('os_remember', '1') === '0') return;
    const r = win.getBoundingClientRect();
    ls.set('os_winrect', JSON.stringify({ l: Math.round(r.left), t: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) }));
  };

  /* the three buttons, in the order (and on the side) the chosen system puts them */
  const setCtl = () => {
    if (!ctlEl) return;
    const G = { min: '▁', max: maxed ? '❐' : '▢', close: '✕' };
    const T = { min: 'Minimise', max: maxed ? 'Restore' : 'Maximise', close: 'Close' };
    const order = themeDef().ctl || ['min', 'max', 'close'];
    ctlEl.innerHTML = order.map(w => '<button type="button" data-w="' + w + '" title="' + T[w] + '" aria-label="' + T[w] + '">' + G[w] + '</button>').join('');
  };

  const wrap = () => {
    if (win) return;
    headEl = headEl || document.querySelector('body > header');
    mainEl = mainEl || document.querySelector('body > main');
    navEl = navEl || document.getElementById('nav');
    if (!headEl || !mainEl) return;
    win = document.createElement('div'); win.id = 'oswin';
    body.insertBefore(win, body.firstChild);

    /* the window's own title bar: the three controls always sit at its top right, whatever the app's toolbar holds */
    barEl = document.createElement('div'); barEl.id = 'oswbar';
    titleEl = document.createElement('span'); titleEl.id = 'ostitle';
    ctlEl = document.createElement('div'); ctlEl.id = 'oswctl';
    setCtl();
    barEl.appendChild(titleEl); barEl.appendChild(ctlEl);
    win.appendChild(barEl); win.appendChild(headEl); win.appendChild(mainEl);
    ['s', 'e', 'w', 'sw', 'se'].forEach(dir => { const g = document.createElement('div'); g.className = 'osz ' + dir; g.dataset.rz = dir; win.appendChild(g); });
    const d = readRect() || defaultRect(); place(d.l, d.t, d.w, d.h);
    setTitle();

    /* the edges and corners resize the window, and the size is remembered for the next time */
    let rs = null;
    win.addEventListener('pointerdown', e => {
      const g = e.target.closest('.osz');
      if (!g || maxed || !on() || e.button !== 0) return;
      e.preventDefault(); e.stopPropagation();
      const r = win.getBoundingClientRect();
      rs = { d: g.dataset.rz, x: e.clientX, y: e.clientY, l: r.left, t: r.top, w: r.width, h: r.height };
      win.classList.add('drag');
      try { g.setPointerCapture(e.pointerId); } catch (x) { }
    });
    win.addEventListener('pointermove', e => {
      if (!rs) return;
      const dx = e.clientX - rs.x, dy = e.clientY - rs.y, minW = 320, minH = 220;
      let l = rs.l, t = rs.t, w = rs.w, h = rs.h;
      if (rs.d.indexOf('e') >= 0) w = Math.max(minW, Math.min(rs.w + dx, innerWidth - rs.l));
      if (rs.d.indexOf('s') >= 0) h = Math.max(minH, Math.min(rs.h + dy, innerHeight - rs.t));
      if (rs.d.indexOf('w') >= 0) { w = Math.max(minW, Math.min(rs.w - dx, rs.l + rs.w)); l = rs.l + rs.w - w; }
      place(l, t, w, h);
    });
    const endResize = () => { if (!rs) return; rs = null; win.classList.remove('drag'); saveRect(); };
    win.addEventListener('pointerup', endResize);
    win.addEventListener('pointercancel', endResize);

    ctlEl.onclick = e => {
      const b = e.target.closest('[data-w]'); if (!b) return;
      e.stopPropagation();
      const w = b.dataset.w;
      if (w === 'max') toggleMax();
      else if (w === 'min') minim();
      else close();
    };

    barEl.addEventListener('pointerdown', e => {
      if (!on() || e.button !== 0) return;
      if (e.target.closest('button,select,input,a,textarea,#oswctl')) return;
      const r = win.getBoundingClientRect();
      drag = { dx: e.clientX - r.left, dy: e.clientY - r.top, w: r.width, h: r.height };
      win.classList.add('drag');
      try { barEl.setPointerCapture(e.pointerId); } catch (x) { }
    });
    barEl.addEventListener('pointermove', e => {
      if (!drag) return;
      const l = Math.max(-60, Math.min(innerWidth - 100, e.clientX - drag.dx));
      const t = Math.max(0, Math.min(innerHeight - 100, e.clientY - drag.dy));
      place(l, t, drag.w, drag.h);
    });
    const endDrag = () => { if (!drag) return; drag = null; if (win) win.classList.remove('drag'); saveRect(); };
    barEl.addEventListener('pointerup', endDrag);
    barEl.addEventListener('pointercancel', endDrag);
    barEl.addEventListener('dblclick', e => { if (e.target.closest('button,select,input,a')) return; toggleMax(); });

    barEl.addEventListener('contextmenu', e => {
      if (!on()) return;
      menu(e, [[
        { icon: '▁', label: 'Minimise', run: minim },
        { icon: '▢', label: maxed ? 'Restore the window' : 'Maximise', run: toggleMax },
        { icon: '✕', label: 'Close the window', run: close }
      ], baseItems()]);
    });
  };
  const unwrap = () => {
    if (!win) return;
    if (barEl) barEl.remove();
    if (navEl && navEl.parentNode === body) {
      body.insertBefore(headEl, navEl);
      body.insertBefore(mainEl, navEl.nextSibling);
    } else {
      body.insertBefore(headEl, win);
      body.insertBefore(mainEl, win);
    }
    win.remove(); win = null; barEl = null; ctlEl = null; titleEl = null; maxed = false; saved = null;
  };
  const toggleMax = () => {
    if (!win) return;
    if (!maxed) {
      const r = win.getBoundingClientRect();
      saved = { l: r.left, t: r.top, w: r.width, h: r.height };
      maxed = true;
      win.classList.add('maxed');
      place(0, 0, innerWidth, innerHeight);       // the whole screen: the taskbar is covered too
    } else {
      maxed = false;
      win.classList.remove('maxed');
      if (saved) place(saved.l, saved.t, saved.w, saved.h); else { const d = readRect() || defaultRect(); place(d.l, d.t, d.w, d.h); }
    }
    if (ctlEl) {
      const b = ctlEl.querySelector('[data-w="max"]');
      b.textContent = maxed ? '❐' : '▢';
      b.title = maxed ? 'Restore' : 'Maximise';
      b.setAttribute('aria-label', maxed ? 'Restore' : 'Maximise');
    }
  };

  const showWin = () => {
    if (!on() || !win) return;
    if (!desk()) return;
    root.classList.remove('os-desk');
    closeStart(); closeFold();
    markTabs();
  };
  const showDesk = () => {
    if (!win) return;
    root.classList.add('os-desk');
    closeStart(); closeFold();
    markTabs();
  };
  /* minimise puts the window away but leaves it open on the taskbar; close does the same and lets go of the page */
  const minim = () => { showDesk(); };
  const close = () => { showDesk(); };
  const openApp = n => {
    if (!A.tabs[n]) return;
    if (on() && win) showWin();
    A.showTab(n);
    closeStart(); closeFold();
  };

  /* anything that changes page (a chat prompt, a search result) brings the window forward */
  const coreShow = A.showTab;
  A.showTab = n => {
    if (on() && win && started) showWin();      // at start-up the desktop stays put; after that a page brings its window forward
    const r = coreShow(n);
    markTabs();
    return r;
  };
  setTimeout(() => { started = true; }, 1500);

  /* ---------- desktop icons and folders ---------- */
  const readPos = () => { try { const o = JSON.parse(ls.get('os_iconpos', '{}')); return o && typeof o === 'object' ? o : {}; } catch (e) { return {}; } };
  const writePos = o => ls.set('os_iconpos', JSON.stringify(o));
  const clampIcon = (p, c) => { const d = deskBox(); return { x: Math.max(d.x, Math.min(p.x, d.x + d.w - c.w)), y: Math.max(d.y, Math.min(p.y, d.y + d.h - c.h)) }; };
  const drawIcons = () => {
    if (!on()) { const h = $('osicons'); if (h) h.remove(); return; }
    if (iconsOn() && !$('osicons')) { const a = document.createElement('div'); a.id = 'osicons'; body.appendChild(a); }
    const host = $('osicons'); if (!host) return;
    if (!iconsOn()) { host.remove(); return; }
    let list = null;
    try { const a = JSON.parse(ls.get('os_icons_list', 'null')); if (Array.isArray(a) && a.length) list = a.filter(n => A.tabs[n]); } catch (e) { }
    const apps = list || DEFAULT_ICONS.filter(n => A.tabs[n]);
    const items = groups().map(g => ({
      key: 'g:' + g.id,
      html: '<button type="button" class="osi folder" data-grp="' + g.id + '" data-key="g:' + g.id + '" title="' + esc2(g.label) + ' — double-click to open"><span class="osi-ic">' + FOLDER_ICON + '</span><b>' + esc2(g.label) + '</b></button>'
    })).concat(apps.map(n => ({
      key: 't:' + n,
      html: '<button type="button" class="osi' + (A.cur === n && !desk() ? ' on' : '') + '" data-tab="' + n + '" data-key="t:' + n + '" title="' + esc2(tabLabel(n)) + ' — double-click to open">' + iconCell(n) + '<b>' + esc2(tabLabel(n)) + '</b></button>'
    })));
    host.innerHTML = items.map(x => x.html).join('');
    const saved = readPos(), c = cell(), d = deskBox();
    const rows = Math.max(1, Math.floor(d.h / c.h));
    host.querySelectorAll('.osi').forEach((b, i) => {
      const col = Math.floor(i / rows), row = i % rows;
      const p = clampIcon(saved[b.dataset.key] || { x: d.x + col * c.w, y: d.y + row * c.h }, c);
      b.style.left = Math.round(p.x) + 'px'; b.style.top = Math.round(p.y) + 'px';
    });
    const sel = b => { host.querySelectorAll('.osi.sel').forEach(x => x.classList.remove('sel')); if (b) b.classList.add('sel'); };
    let idrag = null;
    host.onpointerdown = e => {
      const b = e.target.closest('.osi'); if (!b || e.button !== 0) return;
      const r = b.getBoundingClientRect();
      idrag = { b, key: b.dataset.key, dx: e.clientX - r.left, dy: e.clientY - r.top, x: e.clientX, y: e.clientY, moved: false };
      try { b.setPointerCapture(e.pointerId); } catch (x) { }
    };
    host.onpointermove = e => {
      if (!idrag) return;
      if (!idrag.moved && (Math.abs(e.clientX - idrag.x) > 4 || Math.abs(e.clientY - idrag.y) > 4)) {
        idrag.moved = true; idrag.b.classList.add('idrag'); sel(idrag.b);
      }
      if (!idrag.moved) return;
      const p = clampIcon({ x: e.clientX - idrag.dx, y: e.clientY - idrag.dy }, c);
      idrag.p = p;
      idrag.b.style.left = Math.round(p.x) + 'px'; idrag.b.style.top = Math.round(p.y) + 'px';
    };
    host.onpointerup = () => {
      if (!idrag) return;
      const g = idrag; idrag = null;
      g.b.classList.remove('idrag');
      if (!g.moved) { sel(g.b); return; }
      let p = g.p || { x: parseFloat(g.b.style.left), y: parseFloat(g.b.style.top) };
      if (theme().snap) {
        p = { x: d.x + Math.round((p.x - d.x) / c.w) * c.w, y: d.y + Math.round((p.y - d.y) / c.h) * c.h };
        p = clampIcon(p, c);
        g.b.style.left = Math.round(p.x) + 'px'; g.b.style.top = Math.round(p.y) + 'px';
      }
      const o = readPos(); o[g.key] = p; writePos(o);
      sel(g.b);
    };
    host.onpointercancel = () => { if (idrag) { idrag.b.classList.remove('idrag'); idrag = null; } };
    host.ondblclick = e => {
      const b = e.target.closest('.osi'); if (!b) return;
      sel(b);
      if (b.dataset.grp) return openFolder(b.dataset.grp, b.getBoundingClientRect());
      if (b.dataset.tab) openApp(b.dataset.tab);
    };
    host.oncontextmenu = e => {
      const b = e.target.closest('.osi'); if (!b) return;
      sel(b);
      const g = b.dataset.grp;
      if (g) {
        const grp = A.NAVGROUPS.filter(x => x.id === g)[0];
        return menu(e, [[{ header: grp.label }, { icon: '📂', label: 'Open folder', run: () => openFolder(g, b.getBoundingClientRect()) }], [
          { icon: '📍', label: 'Put the icon back', run: () => { const o = readPos(); delete o[b.dataset.key]; writePos(o); drawIcons(); } }
        ], baseItems()]);
      }
      const n = b.dataset.tab, pinned = readPins().indexOf(n) >= 0;
      menu(e, [[
        { header: tabLabel(n) },
        { icon: '↗', label: 'Open ' + tabLabel(n), run: () => openApp(n) },
        { icon: '📌', label: pinned ? 'Unpin from the taskbar' : 'Pin to the taskbar', run: () => togglePin(n) }
      ], [
        { icon: '📍', label: 'Put the icon back', run: () => { const o = readPos(); delete o[b.dataset.key]; writePos(o); drawIcons(); } },
        { icon: '🗑', label: 'Hide from the desktop', danger: true, run: () => { const a = Array.prototype.map.call(host.querySelectorAll('[data-tab]'), x => x.dataset.tab).filter(x => x !== n); ls.set('os_icons_list', JSON.stringify(a)); drawIcons(); } }
      ], baseItems()]);
    };
  };

  let foldEl = null;
  const closeFold = () => { if (foldEl) { foldEl.remove(); foldEl = null; } };
  const openFolder = (gid, r) => {
    const g = A.NAVGROUPS.filter(x => x.id === gid)[0]; if (!g) return;
    if (foldEl && foldEl.dataset.g === gid) return closeFold();
    closeFold();
    foldEl = document.createElement('div'); foldEl.id = 'osfold'; foldEl.dataset.g = gid;
    foldEl.innerHTML = '<div class="osf-hd"><span style="font-size:15px">📁</span><span>' + esc2(g.label) + '</span><span class="small mute" style="font-weight:400">' + g.tabs.filter(t => A.tabs[t]).length + ' apps</span><button type="button" aria-label="Close">✕</button></div>' +
      '<div class="osf-grid">' + g.tabs.filter(t => A.tabs[t]).map(t => '<button type="button" class="osf-it" data-tab="' + t + '">' + iconCell(t) + '<span>' + esc2(tabLabel(t)) + '</span></button>').join('') + '</div>';
    body.appendChild(foldEl);
    const w = foldEl.offsetWidth, h = foldEl.offsetHeight;
    const top = r ? Math.max(8, Math.min(innerHeight - 80 - h, r.top)) : 100;
    foldEl.style.left = (innerWidth <= 900 ? 8 : 96) + 'px'; foldEl.style.top = top + 'px';
    foldEl.querySelector('.osf-hd button').onclick = closeFold;
    foldEl.ondblclick = e => { const b = e.target.closest('[data-tab]'); if (b) openApp(b.dataset.tab); };
    foldEl.oncontextmenu = e => menu(e, [baseItems()]);
    /* a folder window drags by its title, like the app window */
    const fhd = foldEl.querySelector('.osf-hd');
    let fdrag = null;
    fhd.addEventListener('pointerdown', e => {
      if (e.target.closest('button') || e.button !== 0) return;
      const r = foldEl.getBoundingClientRect();
      fdrag = { dx: e.clientX - r.left, dy: e.clientY - r.top };
      try { fhd.setPointerCapture(e.pointerId); } catch (x) { }
    });
    fhd.addEventListener('pointermove', e => {
      if (!fdrag) return;
      foldEl.style.left = Math.max(0, Math.min(innerWidth - 90, e.clientX - fdrag.dx)) + 'px';
      foldEl.style.top = Math.max(0, Math.min(innerHeight - 60, e.clientY - fdrag.dy)) + 'px';
    });
    fhd.addEventListener('pointerup', () => { fdrag = null; });
    fhd.addEventListener('pointercancel', () => { fdrag = null; });
  };

  /* ---------- taskbar ---------- */
  /* the moundshell is a fixed part of the bar: it is not a page and cannot be unpinned, so it is always one click away */
  const openShell = () => {
    closeStart(); closeFold();
    if (window.AppShell && window.AppShell.open) window.AppShell.open();
  };
  const clockText = () => { const d = new Date(); return '<b>' + d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) + '</b><span>' + d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) + '</span>'; };
  const drawBar = () => {
    const bar = $('osbar'); if (!bar) return;
    const pins = readPins(), label = themeDef().start;
    bar.innerHTML = '<div id="osapps">' +
      '<button type="button" class="osb" id="osstart" title="Start: every page, settings and the lock">' + iconCell('home').replace('class="osi-ic"', 'class="osi-ic osi-start"') + (label ? '<span class="osb-la">' + esc2(label) + '</span>' : '') + '</button>' +
      '<button type="button" class="osb osb-fix" id="osshell" title="moundshell — a bash shell over this app (Ctrl+T)" aria-label="Open moundshell">🐚</button>' +
      pins.map(n => '<button type="button" class="osb' + (A.cur === n && !desk() ? ' on' : '') + '" data-tab="' + n + '" title="' + esc2(tabLabel(n)) + '">' + iconTint(n) + '</button>').join('') +
      '</div>' + '<span class="sp"></span>' +
      '<button type="button" class="osb" data-os="wall" title="Change the wallpaper">🖼️</button>' +
      '<button type="button" class="osb" data-os="lock" title="Lock Moundshroud">🔒</button>' +
      '<button type="button" class="osb" data-os="cog" title="Settings">⚙</button>' +
      '<div id="osclock" title="' + esc2(new Date().toLocaleString()) + '">' + clockText() + '</div>' +
      '<button type="button" class="osb" id="osdeskbtn" data-os="desk" title="Show the desktop"></button>';
  };
  const barClicks = () => {
    const bar = $('osbar'); if (!bar) return;
    bar.onclick = e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.id === 'osstart') return toggleStart();
      if (b.id === 'osshell') return openShell();
      if (b.dataset.tab) {
        if (b.dataset.tab === A.cur && !desk()) return showDesk();     // clicking the open app puts it away, like a taskbar
        return openApp(b.dataset.tab);
      }
      if (b.dataset.os === 'wall') return wallpaper();
      if (b.dataset.os === 'lock') return showLock();
      if (b.dataset.os === 'cog') return A.settings && A.settings.open && A.settings.open();
      if (b.dataset.os === 'desk') return showDesk();
    };
    bar.oncontextmenu = e => {
      const b = e.target.closest('[data-tab]'); if (b) {
        const n = b.dataset.tab;
        return menu(e, [[{ header: tabLabel(n) }, { icon: '↗', label: 'Open ' + tabLabel(n), run: () => openApp(n) }, { icon: '📌', label: 'Unpin from the taskbar', run: () => togglePin(n) }], baseItems()]);
      }
      e.preventDefault(); e.stopPropagation();
      const sec = [
        { icon: '▤', label: 'Start menu', run: toggleStart },
        { icon: '▭', label: 'Show the desktop', run: showDesk }
      ];
      if (iconsOn()) sec.push({ icon: '🗂️', label: 'Hide the desktop icons', run: () => A.os.icons(false) });
      if (A.ctxMenu) A.ctxMenu.show(e.clientX, e.clientY, [sec, baseItems()], { skipLang: true });
    };
  };
  const tickClock = () => { const c = $('osclock'); if (c) { c.innerHTML = clockText(); c.title = new Date().toLocaleString(); } };

  /* ---------- Start menu ---------- */
  const closeStart = () => { const m = $('osmenu'); if (m) m.classList.remove('on'); };
  const toggleStart = () => {
    const m = $('osmenu'); if (!m) return;
    if (m.classList.contains('on')) return closeStart();
    drawStart(); m.classList.add('on');
    const q = m.querySelector('#osm-q'); if (q) { q.value = ''; setTimeout(() => q.focus(), 30); }
  };
  const drawStart = () => {
    const m = $('osmenu'); if (!m) return;
    const gs = groups(), shown = {};
    gs.forEach(g => g.tabs.forEach(t => shown[t] = 1));
    const rest = A.order.filter(n => A.tabs[n] && !shown[n]);
    const item = n => '<button type="button" class="osm-it" data-tab="' + n + '">' + iconTint(n) + '<span>' + esc2(tabLabel(n)) + '</span></button>';
    m.innerHTML = '<div class="osm-hd"><input id="osm-q" type="search" placeholder="Search apps and pages…" autocomplete="off"></div>' +
      '<div class="osm-list" id="osm-list">' +
      gs.map(g => '<div class="osm-g">' + esc2(g.label) + '</div>' + g.tabs.filter(t => A.tabs[t]).map(item).join('')).join('') +
      (rest.length ? '<div class="osm-g">More</div>' + rest.map(item).join('') : '') +
      '</div>' +
      '<div class="osm-ft"><button class="ib" type="button" data-os="cog">⚙ Settings</button><button class="ib" type="button" data-os="systems">🪟 System look</button><button class="ib" type="button" data-os="custom">🖥️ Desktop</button><button class="ib" type="button" data-os="wall">🖼️ Wallpaper</button><button class="ib" type="button" data-os="lock">🔒 Lock</button><button class="ib" type="button" data-os="today">🏠 Today</button></div>';
    const list = m.querySelector('#osm-list'), q = m.querySelector('#osm-q');
    q.oninput = () => {
      const s = q.value.trim().toLowerCase();
      list.querySelectorAll('.osm-it').forEach(b => { b.style.display = !s || b.textContent.toLowerCase().indexOf(s) >= 0 ? '' : 'none'; });
      list.querySelectorAll('.osm-g').forEach(h => { h.style.display = !s ? '' : 'none'; });
    };
    q.onkeydown = e => {
      e.stopPropagation();
      if (e.key === 'Enter') { const first = Array.prototype.filter.call(list.querySelectorAll('.osm-it'), b => b.style.display !== 'none')[0]; if (first) first.click(); }
      if (e.key === 'Escape') closeStart();
    };
    m.onclick = e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.tab) return openApp(b.dataset.tab);
      if (b.dataset.os === 'cog') { closeStart(); A.settings && A.settings.open(); }
      else if (b.dataset.os === 'systems') { closeStart(); systems(); }
      else if (b.dataset.os === 'custom') { closeStart(); customize(); }
      else if (b.dataset.os === 'wall') { closeStart(); wallpaper(); }
      else if (b.dataset.os === 'lock') { closeStart(); showLock(); }
      else if (b.dataset.os === 'today') openApp('home');
    };
    m.oncontextmenu = e => menu(e, [baseItems()]);
  };

  /* ---------- a small dialog of its own, so it shows above Settings and the lock screen ---------- */
  const modal = html => {
    const ov = document.createElement('div'); ov.className = 'osmo';
    ov.innerHTML = '<div class="osmo-c" role="dialog" aria-modal="true"><button class="osmo-x" type="button" aria-label="Close">✕</button>' + html + '</div>';
    document.body.appendChild(ov);
    const close = () => { ov.remove(); document.removeEventListener('keydown', key, true); };
    const key = e => { if (e.key === 'Escape') { e.stopPropagation(); close(); } };
    document.addEventListener('keydown', key, true);
    ov.querySelector('.osmo-x').onclick = close;
    ov.addEventListener('click', e => { if (e.target === ov) close(); });
    return { el: ov, close };
  };

  /* ---------- wallpaper ---------- */
  function wallpaper() {
    const cur = ls.get('os_wall', 'orbital'), img = ls.get('os_wall_img', '');
    const d = modal('<h3>Wallpaper</h3><div class="small mute">Pick a background for the desktop. One of your own pictures can be used too; it is kept on this PC and shrunk to fit.</div>' +
      '<div class="osw-grid">' + WALLS.map(w => '<button type="button" class="osw' + (cur === w[0] ? ' on' : '') + '" data-w="' + w[0] + '"><span style="background:' + w[2] + '"></span><b>' + esc2(w[1]) + '</b></button>').join('') +
      (img ? '<button type="button" class="osw' + (cur === 'custom' ? ' on' : '') + '" data-w="custom"><span style="background-image:url(' + img + ')"></span><b>Your picture</b></button>' : '') +
      '</div><div class="osf-btns"><button class="pri" type="button" id="oswup">Upload a picture</button>' + (img ? '<button class="ib" type="button" id="oswrm">Remove my picture</button>' : '') + '<span class="small mute" id="oswst"></span></div>');
    const host = d.el;
    host.querySelectorAll('[data-w]').forEach(b => b.onclick = () => {
      ls.set('os_wall', b.dataset.w); paintWall();
      host.querySelectorAll('[data-w]').forEach(x => x.classList.toggle('on', x === b));
      A.toast('Wallpaper: ' + (b.dataset.w === 'custom' ? 'your picture' : (WALLS.filter(w => w[0] === b.dataset.w)[0] || ['', ''])[1]));
    });
    host.querySelector('#oswup').onclick = () => {
      const f = document.createElement('input'); f.type = 'file'; f.accept = 'image/png,image/jpeg,image/webp';
      f.onchange = () => {
        const file = f.files && f.files[0]; if (!file) return;
        const st = host.querySelector('#oswst'); if (st) st.textContent = 'Preparing…';
        const fr = new FileReader();
        fr.onload = () => {
          const im = new Image();
          im.onload = () => {
            const mx = 1920, sc = Math.min(1, mx / Math.max(im.width, im.height));
            const cv = document.createElement('canvas');
            cv.width = Math.max(1, Math.round(im.width * sc)); cv.height = Math.max(1, Math.round(im.height * sc));
            cv.getContext('2d').drawImage(im, 0, 0, cv.width, cv.height);
            let url = '';
            try { url = cv.toDataURL('image/jpeg', 0.82); } catch (e) { }
            if (!url) { if (st) st.textContent = 'That picture could not be read.'; return; }
            try { ls.set('os_wall_img', url); }
            catch (e) { if (st) st.textContent = 'That picture is too large to keep on this PC. Try a smaller one.'; return; }
            ls.set('os_wall', 'custom'); paintWall(); d.close(); A.toast('Wallpaper changed to your picture.');
          };
          im.onerror = () => { if (st) st.textContent = 'That file is not a picture Moundshroud can read.'; };
          im.src = String(fr.result);
        };
        fr.readAsDataURL(file);
      };
      f.click();
    };
    const rm = host.querySelector('#oswrm');
    if (rm) rm.onclick = () => { ls.set('os_wall_img', ''); ls.set('os_wall', 'orbital'); d.close(); paintWall(); };
  }

  /* ---------- system looks: original desktop eras, grey to glossy to flat, and a set of open-source desktops ---------- */
  function systems() {
    const cur = themeId();
    const card = t => '<button type="button" class="ost-card' + (t.id === cur ? ' on' : '') + '" data-ost="' + t.id + '" title="' + esc2(t.name) + '">' +
      '<span class="ost-prev" style="background:' + t.wall + '">' +
        '<i class="pw" style="border-color:' + t.pv[4] + ';background:' + t.pv[3] + '">' +
          '<i class="pwt" style="background:' + t.pv[0] + ';color:' + t.pv[2] + '"><em></em><em></em><em></em><b></b></i>' +
          '<i class="pwb"></i>' +
        '</i>' +
        '<i class="pbar" style="background:' + t.pv[1] + ';color:' + t.pv[2] + '"><s></s><u></u><u></u><i class="ps"></i></i>' +
      '</span><b>' + esc2(t.name) + '</b><span>' + esc2(t.note) + '</span></button>';
    const fam = f => '<div class="ost-fam">' + esc2(f) + '</div><div class="ost-grid">' + THEMES.filter(t => t.fam === f).map(card).join('') + '</div>';
    const d = modal('<h3>System look</h3><div class="small mute">Moundshroud keeps working the same way: the window still maximises over the taskbar, drags, resizes, and the icons still move and open with a double-click. Only the desktop is drawn in the style of another era or another open-source desktop, with its window buttons, its bar and its start menu. A look can be changed at any time, and the Moundshroud look puts it back as it is now.</div>' +
      fam('Now') + fam('Grey years') + fam('Glass years') + fam('Flat years') + fam('Open desktops') +
      '<div class="osf-btns"><button class="pri" type="button" id="ost-close">Done</button><span class="small mute">These are Moundshroud\'s own drawings, inspired by the eras they name; no company is behind them or endorses them. Taskbar place, size and the wallpaper stay yours: change them in Desktop settings.</span></div>');
    const el = d.el;
    el.querySelectorAll('[data-ost]').forEach(b => b.onclick = () => {
      setTheme(b.dataset.ost);
      d.close(); systems();
    });
    el.querySelector('#ost-close').onclick = d.close;
  }
  function setTheme(id) {
    if (!THEMES.some(t => t.id === id)) id = 'mound';
    ls.set('os_theme', id);
    const t = themeDef();
    /* the taskbar goes where that system put it, at the height it used; the sliders change it afterwards */
    ls.set('os_barpos', t.barTop ? 'top' : 'bottom');
    ls.set('os_barsize', String(t.barH));
    restyle();
    /* a put-away window has no measurable box: leave its size alone and only lift a visible one above the taskbar */
    if (win && !desk()) { const r = win.getBoundingClientRect(); if (r.width > 300) place(r.left, Math.max(workArea().t, r.top), r.width, r.height); }
    setCtl(); drawIcons(); drawBar(); setTitle(); markTabs();
    A.toast('System look: ' + t.name);
  }

  /* ---------- every part of the desktop, in one place (right-click the wallpaper, or Settings › Appearance) ---------- */
  function customize() {
    const t = theme();
    const d = modal('<h3>Desktop settings</h3><div class="small mute">The wallpaper, the icons and the taskbar, arranged the way you like them. Everything is kept on this PC and <b>Reset the desktop</b> puts it all back.</div>' +
      '<div class="osgrid">' +
      '<div class="osfield"><b>System look</b><span class="small mute">Ten desktop eras, from grey and boxy to flat and centred, and ten open-source desktops (orange, green, blue, teal, mono and more).</span><button class="pri" type="button" id="osc-themes">Choose a system look…</button></div>' +
      '<div class="osfield"><b>Wallpaper</b><span class="small mute">A gradient or one of your own pictures.</span><button class="pri" type="button" id="osc-wall">Choose wallpaper…</button></div>' +
      '<div class="osfield"><b>Icon size</b><div class="osseg" id="osc-size">' + [['s', 'Small'], ['m', 'Medium'], ['l', 'Large']].map(x => '<button type="button" data-size="' + x[0] + '"' + (t.size === x[0] ? ' class="on"' : '') + '>' + x[1] + '</button>').join('') + '</div><span class="small mute">Names are under the icons unless you turn them off below.</span></div>' +
      '<div class="osfield"><b>Desktop icons</b><label class="ossw"><input type="checkbox" id="osc-icons"' + (iconsOn() ? ' checked' : '') + '> Show icons</label><label class="ossw"><input type="checkbox" id="osc-labels"' + (t.labels ? ' checked' : '') + '> Show their names</label><label class="ossw"><input type="checkbox" id="osc-snap"' + (t.snap ? ' checked' : '') + '> Snap them to a grid</label><button class="ib" type="button" id="osc-arrange">Arrange them again</button></div>' +
      '<div class="osfield"><b>Taskbar</b><div class="osseg" id="osc-barpos">' + [['bottom', 'Bottom'], ['top', 'Top']].map(x => '<button type="button" data-pos="' + x[0] + '"' + (t.barTop === (x[0] === 'top') ? ' class="on"' : '') + '>' + x[1] + '</button>').join('') + '</div><div class="osrange"><span class="small mute">Size</span><input type="range" id="osc-barsize" min="42" max="96" step="2" value="' + t.barH + '"><output id="osc-barsize-v">' + t.barH + 'px</output></div><label class="ossw"><input type="checkbox" id="osc-clock"' + (t.clock ? ' checked' : '') + '> Show the clock</label></div>' +
      '<div class="osfield"><b>Accent colour</b><div class="osacc" id="osc-accent">' + ['#8b7cff', '#46d7c8', '#ff7a59', '#ffc24a', '#63d471', '#4aa8ff', '#ff6ea8', '#cfd6ea'].map(c => '<button type="button" class="ossw2' + (t.accent.toLowerCase() === c ? ' on' : '') + '" data-c="' + c + '" title="' + c + '" style="background:' + c + '"></button>').join('') + '<input type="color" id="osc-color" value="' + t.accent + '" title="Any colour"></div><span class="small mute">The running mark on the taskbar, the Start icon and highlights.</span></div>' +
      '<div class="osfield"><b>Windows</b><label class="ossw"><input type="checkbox" id="osc-motion"' + (t.motion ? ' checked' : '') + '> Animate them</label><label class="ossw"><input type="checkbox" id="osc-rect"' + (ls.get('os_remember', '1') !== '0' ? ' checked' : '') + '> Remember size and place</label><button class="ib" type="button" id="osc-winreset">Reset the window size</button></div>' +
      '<div class="osfield"><b>Boot password</b><label class="ossw"><input type="checkbox" id="osc-lock"' + (lockOn() ? ' checked' : '') + '> Ask for a password on boot</label><span class="small mute">Turn off to boot straight in with no password next time.</span><button class="ib" type="button" id="osc-lockpw">Change password…</button></div>' +
      '</div>' +
      '<div class="osf-btns"><button class="pri" type="button" id="osc-close">Done</button><button class="ib" type="button" id="osc-reset">Reset the desktop</button><span class="small mute">Drag any icon to move it; double-click to open it.</span></div>');
    const el = d.el;
    const settle = () => {
      if (!win) return;
      if (maxed) return place(0, 0, innerWidth, innerHeight);
      const a = workArea(), r = win.getBoundingClientRect();
      place(r.left, Math.max(a.t, r.top), r.width, r.height);
    };
    const apply = () => { restyle(); settle(); drawIcons(); drawBar(); };
    const mark = (sel, on) => el.querySelectorAll(sel).forEach(x => x.classList.toggle('on', !!on(x)) );
    el.querySelector('#osc-wall').onclick = () => { d.close(); wallpaper(); };
    el.querySelector('#osc-themes').onclick = () => { d.close(); systems(); };
    el.querySelectorAll('#osc-size [data-size]').forEach(b => b.onclick = () => {
      ls.set('os_icsize', b.dataset.size); mark('#osc-size button', x => x === b); apply();
    });
    el.querySelector('#osc-icons').onchange = e => { ls.set('osicons', e.target.checked ? '1' : '0'); apply(); };
    el.querySelector('#osc-labels').onchange = e => { ls.set('os_labels', e.target.checked ? '1' : '0'); apply(); };
    el.querySelector('#osc-snap').onchange = e => { ls.set('os_snap', e.target.checked ? '1' : '0'); apply(); };
    el.querySelector('#osc-arrange').onclick = () => { ls.set('os_iconpos', ''); drawIcons(); A.toast('The icons are back in their places.'); };
    el.querySelectorAll('#osc-barpos [data-pos]').forEach(b => b.onclick = () => {
      ls.set('os_barpos', b.dataset.pos); mark('#osc-barpos button', x => x === b); apply();
    });
    const size = el.querySelector('#osc-barsize'), sizeV = el.querySelector('#osc-barsize-v');
    size.oninput = () => { ls.set('os_barsize', size.value); if (sizeV) sizeV.textContent = size.value + 'px'; apply(); };
    el.querySelector('#osc-clock').onchange = e => { ls.set('os_clock', e.target.checked ? '1' : '0'); apply(); };
    el.querySelectorAll('#osc-accent [data-c]').forEach(b => b.onclick = () => {
      ls.set('os_accent', b.dataset.c); el.querySelector('#osc-color').value = b.dataset.c;
      mark('#osc-accent [data-c]', x => x === b); apply();
    });
    el.querySelector('#osc-color').oninput = e => { ls.set('os_accent', e.target.value); mark('#osc-accent [data-c]', () => false); apply(); };
    el.querySelector('#osc-motion').onchange = e => { ls.set('os_anim', e.target.checked ? '1' : '0'); apply(); };
    el.querySelector('#osc-rect').onchange = e => { ls.set('os_remember', e.target.checked ? '1' : '0'); if (!e.target.checked) ls.set('os_winrect', ''); };
    el.querySelector('#osc-winreset').onclick = () => {
      ls.set('os_winrect', '');
      if (win) { if (maxed) toggleMax(); const r = defaultRect(); place(r.l, r.t, r.w, r.h); }
      A.toast('The window is back to its usual size.');
    };
    el.querySelector('#osc-lock').onchange = e => { A.os.lockOn(e.target.checked); };
    el.querySelector('#osc-lockpw').onclick = () => { d.close(); changePw(); };
    el.querySelector('#osc-close').onclick = d.close;
    el.querySelector('#osc-reset').onclick = () => {
      ['os_icsize', 'os_labels', 'os_barpos', 'os_barsize', 'os_accent', 'os_clock', 'os_anim', 'os_snap', 'os_remember', 'os_iconpos', 'os_winrect'].forEach(k => ls.set(k, ''));
      restyle();
      if (win) { if (maxed) toggleMax(); const r = defaultRect(); place(r.l, r.t, r.w, r.h); }
      drawIcons(); drawBar();
      d.close(); customize();
      A.toast('The desktop is back to its first look.');
    };
  }

  /* ---------- the password at start-up ---------- */
  const digest = async s => {
    try {
      const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('moundshroud-os::' + s));
      return Array.prototype.map.call(new Uint8Array(b), x => x.toString(16).padStart(2, '0')).join('');
    } catch (e) {
      let h = 5381; const t = String(s);
      for (let i = 0; i < t.length; i++) h = ((h << 5) + h + t.charCodeAt(i)) | 0;
      return 'w' + h;
    }
  };
  const lockOn = () => ls.get('lock', '1') !== '0';
  const syncLockUi = () => {
    const onNow = lockOn();
    document.querySelectorAll('input[data-t="lockon"]').forEach(el => {
      el.checked = onNow;
      const sp = el.parentElement && el.parentElement.querySelector('span');
      if (sp && /^(On|Off)$/.test(sp.textContent)) sp.textContent = onNow ? 'On' : 'Off';
    });
    const osc = document.getElementById('osc-lock');
    if (osc) osc.checked = onNow;
  };
  const checkPw = async pw => {
    const savedPw = ls.get('lock_pw', '');
    if (!savedPw) return pw === 'Moundshroud';
    return (await digest(pw)) === savedPw;
  };
  let lockEl = null;
  function showLock() {
    if (lockEl) return;
    try { sessionStorage.removeItem('os_ok'); } catch (e) { }
    lockEl = document.createElement('div'); lockEl.id = 'oslock';
    const hint = ls.get('lock_pw', '')
      ? 'Forgot the password? Add <code>?unlock=off</code> to the address to open without the lock, then change or turn it off in Settings › Privacy.'
      : 'The first password is <b>Moundshroud</b>. Change or turn it off in Settings › Privacy.';
    lockEl.innerHTML = '<div class="osk"><div class="osk-ic">✦</div><h2>Moundshroud</h2><div class="osk-sub">' + (ls.get('lock_pw', '') ? 'Enter your password to open the desktop.' : 'Enter the password to open the desktop.') + '</div>' +
      '<input id="oslpin" type="password" autocomplete="current-password" placeholder="Password" aria-label="Password">' +
      '<button class="osk-go" id="oslgo" type="button">Unlock</button>' +
      '<div class="osk-err" id="oslerr" role="status" aria-live="polite"></div>' +
      '<div class="osk-hint">' + hint + '</div></div>';
    document.body.appendChild(lockEl);
    const inp = lockEl.querySelector('#oslpin'), go = lockEl.querySelector('#oslgo'), err = lockEl.querySelector('#oslerr');
    setTimeout(() => inp.focus(), 80);
    const submit = async () => {
      const v = inp.value; if (!v) return;
      go.disabled = true; err.textContent = 'Checking…';
      const ok = await checkPw(v);
      go.disabled = false;
      if (!ok) {
        err.textContent = 'That is not the password.';
        lockEl.classList.add('shake'); setTimeout(() => lockEl.classList.remove('shake'), 420);
        inp.value = ''; inp.focus(); return;
      }
      err.textContent = '';
      try { sessionStorage.setItem('os_ok', '1'); } catch (e) { }
      hideLock();
      todayPop();
    };
    go.onclick = submit;
    inp.onkeydown = e => { e.stopPropagation(); if (e.key === 'Enter') submit(); };
  }
  function hideLock() {
    if (!lockEl) return;
    const el = lockEl; lockEl = null;
    el.style.transition = 'opacity .28s ease,transform .28s ease';
    el.style.opacity = '0'; el.style.transform = 'scale(1.03)';
    setTimeout(() => el.remove(), 300);
  }
  function changePw() {
    const custom = !!ls.get('lock_pw', '');
    const d = modal('<h3>Lock screen password</h3><div class="small mute">' + (custom ? 'Your own password is set.' : 'The default password is <b>Moundshroud</b>.') + ' It is kept on this PC only, scrambled, and the password itself is never stored.</div>' +
      '<label class="oslbl">' + (custom ? 'Current password' : 'Current password (Moundshroud)') + '</label><input type="password" id="osk-cur" autocomplete="current-password">' +
      '<label class="oslbl">New password</label><input type="password" id="osk-new" autocomplete="new-password">' +
      '<label class="oslbl">New password again</label><input type="password" id="osk-new2" autocomplete="new-password">' +
      '<div class="small" id="osk-msg" style="min-height:18px;margin-top:8px;color:var(--warn)"></div>' +
      '<div class="osf-btns"><button class="pri" type="button" id="osk-save">Save password</button><button class="ib" type="button" id="osk-def">Use the default again</button><button class="ib" type="button" id="osk-off">Turn the lock screen off</button></div>');
    const el = d.el, msg = el.querySelector('#osk-msg');
    el.querySelector('#osk-save').onclick = async () => {
      const cur = el.querySelector('#osk-cur').value, a = el.querySelector('#osk-new').value, b = el.querySelector('#osk-new2').value;
      if (!(await checkPw(cur))) { msg.textContent = 'The current password is not right.'; return; }
      if (a.length < 4) { msg.textContent = 'Use at least four characters.'; return; }
      if (a !== b) { msg.textContent = 'The two new passwords are not the same.'; return; }
      ls.set('lock_pw', await digest(a)); ls.set('lock', '1'); syncLockUi();
      d.close(); A.toast('Password changed. It is asked for the next time Moundshroud boots up.', 5000);
    };
    el.querySelector('#osk-def').onclick = async () => {
      if (!(await A.confirm('Go back to the default password, Moundshroud?'))) return;
      ls.set('lock_pw', ''); d.close(); A.toast('The password is Moundshroud again.');
    };
    el.querySelector('#osk-off').onclick = () => { ls.set('lock', '0'); syncLockUi(); d.close(); A.toast('Boot password turned off. Next time Moundshroud boots up, it will open with no password.', 4500); };
  }

  /* ---------- Today, opened by itself: the real page, filling the screen above the taskbar ---------- */
  function todayPop() {
    if (ls.get('os_today', '1') === '0') return;
    try { if (sessionStorage.getItem('os_today_shown')) return; sessionStorage.setItem('os_today_shown', '1'); } catch (e) { }
    if (on() && win) {
      if (!maxed) { const d = defaultRect(); place(d.l, d.t, d.w, d.h); }
      showWin();
    }
    A.showTab('home');
    markTabs();
  }

  /* ---------- build and remove the shell ---------- */
  const shell = () => {
    if (!$('osicons')) { const a = document.createElement('div'); a.id = 'osicons'; body.appendChild(a); }
    if (!$('osbar')) { const b = document.createElement('div'); b.id = 'osbar'; body.appendChild(b); barClicks(); }
    if (!$('osmenu')) { const m = document.createElement('div'); m.id = 'osmenu'; body.appendChild(m); }
    drawIcons(); drawBar();
  };
  const unshell = () => {
    ['osicons', 'osbar', 'osmenu', 'ostoday'].forEach(id => { const e = $(id); if (e) e.remove(); });
    closeFold();
  };
  let untake = 0;
  const sync = () => {
    paintWall(); restyle();
    const want = on();
    if (!want) {
      closeStart(); closeFold();
      /* the plain layout first, then the window is taken apart in its own task: a page with a lot of measuring of its
         own (Chat) could otherwise be left redrawing a half-switched page and freeze the tab */
      root.classList.remove('os', 'os-desk');
      clearTimeout(untake);
      untake = setTimeout(() => { untake = 0; if (on()) return; unshell(); unwrap(); }, 0);
      return;
    }
    clearTimeout(untake); untake = 0;
    const first = !win;
    root.classList.add('os');
    wrap(); shell();
    if (first) root.classList.add('os-desk');     // the wallpaper and icons first, the way a desktop starts
    if (ctlEl) ctlEl.querySelector('[data-w="max"]').textContent = maxed ? '❐' : '▢';
    markTabs();
  };

  /* the icon, taskbar and title follow the page you are on */
  const markTabs = () => {
    if (!on()) return;
    const cur = A.cur, open = !desk();
    document.querySelectorAll('#osicons .osi').forEach(b => b.classList.toggle('on', open && b.dataset.tab === cur));
    document.querySelectorAll('#osbar [data-tab]').forEach(b => b.classList.toggle('on', open && b.dataset.tab === cur));
    setTitle();
  };
  const setTitle = () => {
    if (!titleEl) return;
    const n = A.cur;
    titleEl.innerHTML = iconTint(n) + '<span>' + esc2(tabLabel(n)) + '</span>';
  };

  /* ---------- events ---------- */
  document.addEventListener('contextmenu', e => {
    if (!on()) return;
    const t = e.target;
    if (t === document.body || t === root || (t && (t.id === 'osicons' || t.id === 'osbar'))) {
      e.preventDefault(); e.stopPropagation();
      const sec = [
        { icon: '▭', label: 'Show the desktop', run: showDesk },
        { icon: '▤', label: 'Start menu', run: toggleStart }
      ];
      sec.push({ icon: '🗂️', label: iconsOn() ? 'Hide the desktop icons' : 'Show the desktop icons', run: () => A.os.icons(!iconsOn()) });
      if (A.ctxMenu) A.ctxMenu.show(e.clientX, e.clientY, [sec, baseItems()], { skipLang: true });
    }
  }, true);

  document.addEventListener('pointerdown', e => {
    const m = $('osmenu');
    if (m && m.classList.contains('on') && !m.contains(e.target) && !(e.target.closest && e.target.closest('#osstart'))) closeStart();
    if (foldEl && !foldEl.contains(e.target) && !(e.target.closest && e.target.closest('[data-grp]'))) closeFold();
    if (!(e.target.closest && e.target.closest('.osi'))) { const ic = $('osicons'); if (ic) ic.querySelectorAll('.osi.sel').forEach(x => x.classList.remove('sel')); }
  }, true);
  addEventListener('keydown', e => { if (e.key === 'Escape') { closeStart(); closeFold(); } });
  addEventListener('resize', () => {
    restyle();
    if (!win) return;
    if (maxed) place(0, 0, innerWidth, innerHeight);
    else if (innerWidth <= 900) { const d = defaultRect(); place(d.l, d.t, d.w, d.h); }
    else {
      const r = win.getBoundingClientRect();
      place(Math.min(r.left, Math.max(0, innerWidth - r.width)), Math.min(r.top, Math.max(0, innerHeight - 60)), Math.min(r.width, innerWidth), Math.min(r.height, innerHeight));
    }
    drawIcons();
  });

  A.os = {
    get on() { return root.classList.contains('os'); },
    set(v) { ls.set('oslook', v ? '1' : '0'); sync(); A.toast(v ? 'Desktop look on.' : 'Desktop look off: Moundshroud is the way it was before.'); },
    icons(v) { ls.set('osicons', v ? '1' : '0'); drawIcons(); A.toast(v ? 'Desktop icons on.' : 'Desktop icons hidden.'); },
    lockOn(v) {
      ls.set('lock', v ? '1' : '0');
      if (!v) hideLock();
      syncLockUi();
      A.toast(v ? 'Moundshroud will ask for a password the next time it boots up.' : 'Boot password turned off. Next time Moundshroud boots up, it will open with no password.', 4500);
    },
    wallpaper, lockpw: changePw, locknow: showLock, today: todayPop, sync, paintWall,
    desk: showDesk, maximize: toggleMax, open: openApp, customize, settings: theme,
    theme: setTheme, systems, looks: () => THEMES.map(t => ({ id: t.id, name: t.name, family: t.fam })),
    /* redraw the desktop from what is saved now (used after a saved look changes the system look or the wallpaper) */
    refresh: () => { restyle(); paintWall(); if (win) drawIcons(); drawBar(); setTitle(); markTabs(); }
  };

  /* ---------- start-up: the desktop, then the lock, then Today ---------- */
  paintWall();
  sync();

  A.on('tab', markTabs);
  if (A.buildNav) {
    const bn = A.buildNav;
    A.buildNav = () => { bn(); if (on()) { drawIcons(); drawBar(); markTabs(); } };
  }

  A.ready.push(() => {
    sync();
    setInterval(tickClock, 20000);
    tickClock();
    if (A.cmd && A.cmd.reg) A.cmd.reg([
      { id: 'os:desk', title: 'Show the desktop', sub: 'Put the window away and see the wallpaper', icon: '🖥️', group: 'Look', tags: 'desktop minimize show wallpaper icons', run: showDesk },
      { id: 'os:lock', title: 'Lock Moundshroud', sub: 'Ask for the password again', icon: '🔒', group: 'Do', tags: 'lock password screen sign out', run: showLock },
      { id: 'os:wall', title: 'Wallpaper', sub: 'Change the desktop background', icon: '🖼️', group: 'Look', tags: 'wallpaper background desktop picture', run: wallpaper },
      { id: 'os:custom', title: 'Desktop settings', sub: 'Icons, taskbar, accent colour, wallpaper', icon: '🖥️', group: 'Look', tags: 'desktop customize settings taskbar icons accent theme linux kde gnome', run: customize },
      { id: 'os:themes', title: 'System look', sub: '10 desktop eras and 10 open-source desktops', icon: '🪟', group: 'Look', tags: 'theme skin desktop era retro grey boxy glossy flat tiles centred open source linux distro orange top green menu ocean blue grid shell swirl obsidian rolling gecko teal deep blue cobalt system look', run: systems },
      { id: 'os:look', title: 'Desktop look', sub: 'Wallpaper, icons and a taskbar, or the plain app', icon: '🖥️', group: 'Look', tags: 'desktop operating system look taskbar icons', run: () => A.os.set(!on()) }
    ]);
  });

  const skip = () => { try { return /(?:^|[?&])unlock=off(?:&|$)/.test(location.search); } catch (e) { return false; } };
  const unlocked = () => { try { return sessionStorage.getItem('os_ok') === '1'; } catch (e) { return false; } };
  const later = fn => setTimeout(fn, 1100);

  if (lockOn() && !skip() && !unlocked()) later(() => showLock());
  else later(todayPop);
})();

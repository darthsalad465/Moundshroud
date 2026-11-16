// Visual themes. Self-contained: loaded first so the saved theme is applied before anything is drawn.
(() => {
  const KEY = 'oa_theme';
  // vars: bg panel panel2 line text mute acc acc2 user ok bad warn onacc sqL sqD (chess board)
  const mk = (v) => ':root{' + Object.entries(v).map(([k, x]) => '--' + k + ':' + x).join(';') + '}';
  const stars = 'radial-gradient(1.5px 1.5px at 12% 18%,#fff,transparent),radial-gradient(1px 1px at 27% 72%,#cfd8ff,transparent),radial-gradient(1.5px 1.5px at 41% 33%,#fff,transparent),radial-gradient(1px 1px at 58% 82%,#ffd9f2,transparent),radial-gradient(1.5px 1.5px at 73% 21%,#fff,transparent),radial-gradient(1px 1px at 86% 61%,#cfd8ff,transparent),radial-gradient(1px 1px at 93% 12%,#fff,transparent),radial-gradient(1px 1px at 6% 90%,#fff,transparent),radial-gradient(1.5px 1.5px at 65% 50%,#e7dcff,transparent)';
  const THEMES = [
    /* the signature theme (2026-11-13): the logo's own violet and gold over a deep ink, with a slow veil of light drifting behind the bars */
    { id: 'shroud', name: 'Moundshroud', note: 'Royal violet and gold over deep ink: the signature look', dark: 1, sw: ['#0c0916', '#a184ff', '#ebc15f'],
      v: { bg: '#0c0916', panel: '#161224', panel2: '#1f1a33', line: '#2f2849', text: '#f0ecfa', mute: '#a59cc0', acc: '#a184ff', acc2: '#ebc15f', user: '#2d2260', ok: '#63e2a8', bad: '#ff7189', warn: '#ffc46b', onacc: '#150b2e', sqL: '#cfc4ee', sqD: '#6c57b0' },
      css: 'body{background:radial-gradient(1100px 620px at 88% -14%,rgba(125,79,230,.32),transparent 62%),radial-gradient(900px 560px at -10% 112%,rgba(235,193,95,.09),transparent 60%),var(--bg)!important}body::before{content:"";position:fixed;inset:-30%;z-index:-1;pointer-events:none;background:radial-gradient(38% 30% at 30% 28%,rgba(161,132,255,.15),transparent 70%),radial-gradient(30% 34% at 74% 70%,rgba(235,193,95,.06),transparent 70%),radial-gradient(36% 30% at 62% 20%,rgba(96,60,220,.17),transparent 72%);transform:translate3d(-3%,-2%,0)}@keyframes shroudDrift{0%{transform:translate3d(-3%,-2%,0) rotate(0)}100%{transform:translate3d(4%,3%,0) rotate(8deg)}}' },
    { id: 'midnight', name: 'Midnight', note: 'The original: calm violet and teal', dark: 1, sw: ['#0e1016', '#8b7cff', '#46d7c8'],
      v: { bg: '#0e1016', panel: '#161923', panel2: '#1d212e', line: '#2a3042', text: '#eceef5', mute: '#9aa3ba', acc: '#8b7cff', acc2: '#46d7c8', user: '#2b2f55', ok: '#5ee6a8', bad: '#ff6b81', warn: '#ffc266', onacc: '#fff', sqL: '#b7bdd9', sqD: '#5c6590' }, css: '' },
    { id: 'aurora', name: 'Aurora', note: 'Northern lights drifting behind everything', dark: 1, sw: ['#07131a', '#3ee0b0', '#7a8bff'],
      v: { bg: '#06121a', panel: '#0d1c26', panel2: '#12273a', line: '#1d3a4d', text: '#e8f6f4', mute: '#8fb3b8', acc: '#3ee0b0', acc2: '#7a8bff', user: '#13404a', ok: '#5ee6a8', bad: '#ff7b8f', warn: '#ffd27a', onacc: '#04221a', sqL: '#b6dfd3', sqD: '#3d8a85' },
      css: 'body{background:var(--bg)!important}body::before{content:"";position:fixed;inset:-20%;z-index:-1;pointer-events:none;background:radial-gradient(40% 35% at 25% 30%,rgba(62,224,176,.28),transparent 70%),radial-gradient(35% 40% at 75% 25%,rgba(122,139,255,.28),transparent 70%),radial-gradient(45% 30% at 55% 80%,rgba(62,224,176,.16),transparent 70%);animation:auroraDrift 22s ease-in-out infinite alternate}@keyframes auroraDrift{0%{transform:translate(-4%,-2%) scale(1)}100%{transform:translate(5%,4%) scale(1.15) rotate(6deg)}}' },
    { id: 'sunset', name: 'Sunset', note: 'Warm dusk gradient', dark: 1, sw: ['#1d1024', '#ff7a59', '#ffc266'],
      v: { bg: '#170d1f', panel: '#241430', panel2: '#2e1a3b', line: '#44274f', text: '#fdeef0', mute: '#c4a1b5', acc: '#ff7a59', acc2: '#ffc266', user: '#5a2748', ok: '#8be6a0', bad: '#ff5f7e', warn: '#ffd27a', onacc: '#2a0f12', sqL: '#f1d3c0', sqD: '#b5654f' },
      css: 'body{background:linear-gradient(180deg,#2a1240 0%,#4a1b4d 38%,#7a2a4a 68%,#b8453f 100%) fixed!important}main,.panel{background:transparent}' },
    { id: 'nebula', name: 'Nebula', note: 'A twinkling night sky', dark: 1, sw: ['#05030f', '#a78bfa', '#f472b6'],
      v: { bg: '#05030f', panel: '#0f0b22', panel2: '#17113a', line: '#2a2160', text: '#f1ecff', mute: '#a79fd0', acc: '#a78bfa', acc2: '#f472b6', user: '#2f2370', ok: '#6ee7b7', bad: '#fb7185', warn: '#fcd34d', onacc: '#150a33', sqL: '#cbbff5', sqD: '#6a54b8' },
      css: 'body{background:radial-gradient(900px 500px at 20% 0%,#1b1250 0%,transparent 60%),radial-gradient(800px 500px at 90% 100%,#3a0f48 0%,transparent 60%),var(--bg)!important}body::before{content:"";position:fixed;inset:0;z-index:-1;pointer-events:none;background:' + stars + ';background-size:420px 420px;animation:twinkle 5s ease-in-out infinite alternate}@keyframes twinkle{0%{opacity:.45}100%{opacity:1}}' },
    { id: 'cyber', name: 'Neon City', note: 'Hot pink and cyan glow', dark: 1, sw: ['#07050f', '#ff2bd6', '#00f0ff'],
      v: { bg: '#07050f', panel: '#0d0a1c', panel2: '#150f2b', line: '#3a1a5c', text: '#f4eaff', mute: '#a98fd0', acc: '#ff2bd6', acc2: '#00f0ff', user: '#3a1260', ok: '#39ffb0', bad: '#ff3d71', warn: '#ffe14a', onacc: '#12001a', sqL: '#d7b8ee', sqD: '#7a2e9c' },
      css: 'body{font-family:"Cascadia Mono","Consolas","Segoe UI",monospace!important;background:linear-gradient(rgba(255,43,214,.06) 1px,transparent 1px) 0 0/100% 38px,linear-gradient(90deg,rgba(0,240,255,.05) 1px,transparent 1px) 0 0/38px 100%,radial-gradient(900px 500px at 80% -10%,#3a0f55,transparent 60%),var(--bg)!important}.card,.hit,.tile{box-shadow:0 0 0 1px rgba(255,43,214,.15),0 0 18px rgba(255,43,214,.08)}.pri,nav button.on,.ib.on{box-shadow:0 0 14px var(--acc),0 0 30px rgba(255,43,214,.35)}.logo{box-shadow:0 0 22px var(--acc2)!important}h2,h3{text-shadow:0 0 10px rgba(0,240,255,.45)}input:focus,textarea:focus{box-shadow:0 0 12px rgba(0,240,255,.4)}' },
    { id: 'terminal', name: 'Terminal', note: 'Green phosphor with scanlines', dark: 1, sw: ['#020a04', '#2bff6a', '#b6ff3d'],
      v: { bg: '#020a04', panel: '#06140a', panel2: '#0a1d10', line: '#124a22', text: '#9dffb0', mute: '#4fb06a', acc: '#2bff6a', acc2: '#b6ff3d', user: '#0f3a1c', ok: '#2bff6a', bad: '#ff5f5f', warn: '#e6ff4a', onacc: '#01140a', sqL: '#6fbf84', sqD: '#1d6b34' },
      css: 'body{font-family:"Cascadia Mono","Consolas",monospace!important;background:var(--bg)!important}body::after{content:"";position:fixed;inset:0;z-index:9;pointer-events:none;background:repeating-linear-gradient(0deg,rgba(0,0,0,.18) 0 1px,transparent 1px 3px);mix-blend-mode:multiply}.logo{animation:none!important;box-shadow:0 0 14px var(--acc)!important}*{text-shadow:0 0 6px rgba(43,255,106,.22)}.pri,nav button.on,.ib.on{text-shadow:none}' },
    { id: 'forest', name: 'Forest', note: 'Deep greens and moss gold', dark: 1, sw: ['#0b140e', '#7bd88f', '#e0c27a'],
      v: { bg: '#0a130d', panel: '#121f16', panel2: '#192a1e', line: '#27422e', text: '#e9f3e6', mute: '#92ad97', acc: '#7bd88f', acc2: '#e0c27a', user: '#244a32', ok: '#7bd88f', bad: '#ff8080', warn: '#e0c27a', onacc: '#08200f', sqL: '#d9e4c0', sqD: '#6a8f55' },
      css: 'body{background:radial-gradient(1000px 520px at 15% -10%,#1d3d27 0%,transparent 60%),radial-gradient(800px 400px at 100% 100%,#2c3a1a 0%,transparent 60%),var(--bg)!important}' },
    { id: 'royal', name: 'Royal', note: 'Black and gold, a little grand', dark: 1, sw: ['#0b0a08', '#d4af37', '#f3e3a1'],
      v: { bg: '#0b0a08', panel: '#15130e', panel2: '#1e1b13', line: '#3a3320', text: '#f6efdc', mute: '#b3a67f', acc: '#d4af37', acc2: '#f3e3a1', user: '#3a3116', ok: '#9be0a8', bad: '#ff8a80', warn: '#f3e3a1', onacc: '#1a1405', sqL: '#ecdcae', sqD: '#8b6d1f' },
      css: 'body{font-family:"Georgia","Palatino Linotype",serif!important;background:radial-gradient(900px 500px at 50% -20%,#2c2410 0%,transparent 65%),var(--bg)!important}h2,h3,.logo+*{letter-spacing:.02em}nav button,.ib,.pri,.chip{font-family:"Segoe UI",system-ui,sans-serif}.card{border-color:#4a3f20}' },
    { id: 'paper', name: 'Paper', note: 'Warm light theme, easy on the eyes by day', dark: 0, sw: ['#f4efe6', '#b4572f', '#3b7a6b'],
      v: { bg: '#f4efe6', panel: '#fffdf8', panel2: '#f0e9db', line: '#ddd2bd', text: '#2b2620', mute: '#7a6f5d', acc: '#b4572f', acc2: '#3b7a6b', user: '#f1dcc9', ok: '#2f8a5b', bad: '#c0392b', warn: '#b7791f', onacc: '#fff', sqL: '#f0d9b5', sqD: '#b58863' },
      css: 'body{background:var(--bg)!important;font-family:"Georgia","Segoe UI",serif!important}nav button,.ib,.pri,.chip,button,select,input,textarea{font-family:"Segoe UI",system-ui,sans-serif}header,nav{backdrop-filter:none}.card{box-shadow:0 1px 3px rgba(60,40,10,.08)}::-webkit-scrollbar-thumb{background:#d4c8b0}mark{background:rgba(180,87,47,.25)}' },
    { id: 'frost', name: 'Frost', note: 'Bright, crisp and airy', dark: 0, sw: ['#eaf1fb', '#3b6bff', '#12b5cb'],
      v: { bg: '#e9f0fa', panel: '#ffffff', panel2: '#eef3fb', line: '#d3deee', text: '#14213a', mute: '#5d6f8f', acc: '#3b6bff', acc2: '#12b5cb', user: '#dbe6ff', ok: '#12935f', bad: '#d6335a', warn: '#b7791f', onacc: '#fff', sqL: '#dfe9f7', sqD: '#7b9bd1' },
      css: 'body{background:radial-gradient(900px 500px at 85% -10%,#d3e2ff 0%,transparent 60%),radial-gradient(700px 400px at 0% 100%,#d7f3f7 0%,transparent 60%),var(--bg)!important}.card{box-shadow:0 2px 10px rgba(40,70,140,.08)}::-webkit-scrollbar-thumb{background:#c4d2ea}mark{background:rgba(59,107,255,.2)}' },
  ];
  if (Array.isArray(window.OA_THEMES_MORE)) THEMES.push(...window.OA_THEMES_MORE);
  const BASE = 'header{background:color-mix(in srgb,var(--panel) 72%,transparent)!important}nav{background:color-mix(in srgb,var(--panel) 50%,transparent)!important}.chip:hover{background:var(--panel2)!important}::-webkit-scrollbar-thumb{background:var(--line)}.pri,nav button.on,.ib.on{color:var(--onacc)!important}.logo{box-shadow:0 0 16px color-mix(in srgb,var(--acc) 55%,transparent)}';
  let style = null;
  const get = () => { try { return localStorage.getItem(KEY) || 'shroud'; } catch (e) { return 'shroud'; } };
  const apply = id => {
    const t = THEMES.find(x => x.id === id) || THEMES[0];
    if (!style) { style = document.createElement('style'); style.id = 'oa-theme'; (document.head || document.documentElement).appendChild(style); }
    style.textContent = mk(t.v) + BASE + t.css; document.documentElement.dataset.theme = t.id; document.documentElement.style.colorScheme = t.dark ? 'dark' : 'light';
    try { localStorage.setItem(KEY, t.id); } catch (e) { }
    window.dispatchEvent(new CustomEvent('oa-theme', { detail: t.id }));
  };
  window.OA_THEMES = { list: THEMES, get, apply };
  apply(get());
})();

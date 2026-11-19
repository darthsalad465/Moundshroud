// Aurum Σ9: the graphing and algebra calculator in Office > Calculator. This file holds the device, the Calculate
// screen with its history, the keypad (Basic and Advanced), memory, settings and the Library of variables,
// functions and constants. calc-pro-apps.js adds Graph, Table, Matrix, Stats, Base and Units.
// The maths lives in calc-engine.js, calc-lib.js and calc-cas.js. Everything is saved in localStorage (oa_aurum).
(() => {
  const E = window.CalcEngine; if (!E) return;
  E.units = (v, a, b) => (A.calc && A.calc.convert ? A.calc.convert(v, a, b) : null);
  const AU = A.aurum = { E };
  const COLORS = ['#7c9cff', '#ff6b9a', '#46d7c8', '#ffc266', '#b48cff', '#7be08a'];
  const defaults = () => ({
    adv: false, tab: 'calc', hist: [],
    st: { angle: ls.get('calcrad', '0') === '1' ? 'rad' : 'deg', mode: 'exact', digits: 12, bits: 64, vars: {}, funcs: {}, ans: '' },
    fns: [{ src: 'sin(x)', on: true }, { src: 'x^2/4 - 1', on: true }, { src: '', on: true }, { src: '', on: true }, { src: '', on: true }, { src: '', on: true }],
    win: { x0: -10, x1: 10, y0: -6.5, y1: 6.5 }, lists: { L1: ['1', '2', '3', '4', '5', '6'], L2: ['2.1', '3.9', '6.2', '7.8', '10.1', '12.2'], L3: [] },
    mats: { A: '[[2,1],[1,3]]', B: '[[1,0],[4,2]]', C: '[[1,2,3],[0,1,4],[5,6,0]]' }, base: { b: 10, v: '255', o: '15' }, units: { cat: '', a: '', b: '', v: '1' }, reg: 'lin', tstep: '1', tstart: '-5'
  });
  function load() { let s = null; try { s = JSON.parse(ls.get('aurum', 'null')); } catch (e) { s = null; } const d = defaults(); if (!s || typeof s !== 'object') return d; const out = Object.assign(d, s); out.st = Object.assign(defaults().st, s.st || {}); if (!Array.isArray(out.hist)) out.hist = []; return out; }
  const S = AU.S = load();
  let saveT = 0; AU.save = () => { clearTimeout(saveT); saveT = setTimeout(() => { if (S.hist.length > 150) S.hist.splice(0, S.hist.length - 150); ls.set('aurum', JSON.stringify(S)); }, 120); };
  AU.COLORS = COLORS;
  AU.approx = () => Object.assign({}, S.st, { mode: 'approx', base: 10 });
  AU.show = (v, approx) => E.show(v, approx ? AU.approx() : S.st);

  /* ---------- look and feel ---------- */
  const CSS = `
.aurum{--au-gold:#e8b53a;--au-gold2:#fff0b0;--au-ink:#e9eef9;--au-mute:#8f9bb6;--au-scr:#091020;--au-cyan:#7fe3ff;max-width:1120px;margin:0 auto;color:var(--au-ink);font-family:"Segoe UI Variable Text","Segoe UI",system-ui,sans-serif}
.aurum *{box-sizing:border-box}
.aurum .au-dev{position:relative;border-radius:30px;padding:16px 18px 20px;background:linear-gradient(160deg,#252937 0%,#161923 48%,#0d0f16 100%);border:1px solid rgba(232,181,58,.32);box-shadow:0 34px 90px rgba(0,0,0,.55),0 2px 0 rgba(255,255,255,.04) inset,0 0 0 6px rgba(255,255,255,.015)}
.aurum .au-dev::after{content:"";position:absolute;inset:0;border-radius:30px;pointer-events:none;background:linear-gradient(115deg,rgba(255,255,255,.07),transparent 28%,transparent 70%,rgba(255,255,255,.03))}
.aurum .au-top{display:flex;align-items:center;gap:12px;margin:0 4px 12px;flex-wrap:wrap}
.aurum .au-brand{font-family:Georgia,"Palatino Linotype",serif;font-weight:700;letter-spacing:.32em;font-size:17px;background:linear-gradient(180deg,var(--au-gold2),var(--au-gold) 55%,#a87416);-webkit-background-clip:text;background-clip:text;color:transparent}
.aurum .au-model{font:600 11px "Segoe UI";letter-spacing:.24em;color:#b49a5c;text-transform:uppercase;margin-left:-4px}
.aurum .au-sp{flex:1}
.aurum .au-seg{display:inline-flex;padding:3px;border-radius:999px;background:#0b0d13;border:1px solid rgba(232,181,58,.25);box-shadow:inset 0 2px 6px rgba(0,0,0,.6)}
.aurum .au-seg button{border:0;background:transparent;color:var(--au-mute);font:600 12.5px "Segoe UI";padding:6px 14px;border-radius:999px;cursor:pointer;letter-spacing:.04em;transition:all .18s}
.aurum .au-seg button.on{background:linear-gradient(180deg,#f6d77d,#d9a233);color:#1b1407;box-shadow:0 2px 10px rgba(232,181,58,.35)}
.aurum .au-icon{width:34px;height:34px;border-radius:50%;border:1px solid rgba(255,255,255,.1);background:linear-gradient(180deg,#2a2e3c,#1a1d27);color:#cfd6ea;cursor:pointer;font-size:15px}
.aurum .au-icon:hover{border-color:var(--au-gold);color:#fff}
.aurum .au-body{display:flex;gap:18px;align-items:stretch;flex-wrap:wrap}
.aurum .au-scr{position:relative;flex:999 1 340px;min-width:0;border-radius:20px;padding:10px 12px 12px;background:radial-gradient(120% 90% at 15% 0%,#1d2d50 0%,#0d1529 52%,#070b15 100%);border:1px solid rgba(127,227,255,.22);box-shadow:inset 0 0 0 1px rgba(255,255,255,.03),inset 0 14px 40px rgba(0,0,0,.55),0 0 0 5px #07080c,0 0 0 6px rgba(255,255,255,.06);display:flex;flex-direction:column;min-height:440px;overflow:hidden}
.aurum .au-scr::before{content:"";position:absolute;left:0;right:0;top:0;height:46%;border-radius:20px 20px 60% 60%/20px 20px 22px 22px;background:linear-gradient(180deg,rgba(255,255,255,.045),transparent);pointer-events:none}
.aurum .au-status{display:flex;gap:6px;align-items:center;flex-wrap:wrap;font:700 10.5px "Segoe UI";letter-spacing:.14em;text-transform:uppercase;margin-bottom:8px;position:relative;z-index:1}
.aurum .au-chip{padding:3px 8px;border-radius:6px;border:1px solid rgba(127,227,255,.25);color:var(--au-cyan);background:rgba(127,227,255,.06);cursor:pointer;user-select:none}
.aurum .au-chip:hover{background:rgba(127,227,255,.14)}
.aurum .au-chip.gold{color:#f3cf6e;border-color:rgba(232,181,58,.35);background:rgba(232,181,58,.08)}
.aurum .au-tabs{display:flex;gap:4px;flex-wrap:wrap;margin-bottom:8px;position:relative;z-index:1}
.aurum .au-tab{border:1px solid transparent;background:rgba(255,255,255,.04);color:#a9b5d1;border-radius:9px;padding:5px 10px;font:600 12.5px "Segoe UI";cursor:pointer;transition:all .15s}
.aurum .au-tab:hover{color:#fff;background:rgba(255,255,255,.08)}
.aurum .au-tab.on{color:#fff;background:linear-gradient(180deg,rgba(124,156,255,.35),rgba(124,156,255,.14));border-color:rgba(124,156,255,.5);box-shadow:0 0 14px rgba(124,156,255,.25)}
.aurum .au-view{flex:1;min-height:0;display:flex;flex-direction:column;position:relative;z-index:1}
.aurum .au-hist{flex:1;min-height:200px;max-height:440px;overflow:auto;padding:2px 4px 6px;scrollbar-width:thin}
.aurum .au-h{padding:8px 10px;border-radius:12px;margin-bottom:4px;border:1px solid transparent;transition:background .15s}
.aurum .au-h:hover{background:rgba(255,255,255,.04);border-color:rgba(255,255,255,.06)}
.aurum .au-hi{font:500 14px "Cascadia Mono",Consolas,monospace;color:#9fb0d3;cursor:pointer;word-break:break-word}
.aurum .au-hi:hover{color:#dfe8ff}
.aurum .au-ho{text-align:right;font:600 22px "Segoe UI Variable Display","Segoe UI",sans-serif;color:#fff;cursor:pointer;word-break:break-word;letter-spacing:.01em}
.aurum .au-ho:hover{color:var(--au-cyan)}
.aurum .au-ha{text-align:right;font:500 13px "Cascadia Mono",Consolas,monospace;color:#7fc4e8}
.aurum .au-hn{text-align:right;font-size:12px;color:#c9a95a}
.aurum .au-h.err .au-ho{color:#ff8a9a;font-size:16px}
.aurum .au-hx{display:flex;gap:6px;justify-content:flex-end;opacity:0;transition:opacity .15s;margin-top:2px}
.aurum .au-h:hover .au-hx{opacity:1}
.aurum .au-mini{border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.05);color:#c9d3ea;border-radius:7px;font:600 11px "Segoe UI";padding:3px 8px;cursor:pointer}
.aurum .au-mini:hover{border-color:var(--au-gold);color:#fff}
.aurum .au-empty{color:#7d8aa8;font-size:13.5px;padding:18px 8px;line-height:1.6}
.aurum .au-empty code{color:#bcd7ff;background:rgba(255,255,255,.06);padding:1px 5px;border-radius:5px;font-family:"Cascadia Mono",Consolas,monospace;cursor:pointer}
.aurum .au-entry{border-top:1px solid rgba(127,227,255,.16);padding-top:8px;margin-top:4px}
.aurum .au-in{width:100%;background:transparent;border:0;outline:0;color:#f3f8ff;font:500 22px "Cascadia Mono",Consolas,monospace;padding:4px 4px;caret-color:var(--au-gold)}
.aurum .au-in::placeholder{color:#4f5f80}
.aurum .au-in:focus,.aurum .au-in:focus-visible{box-shadow:none;outline:0;border:0;background:transparent}
.aurum .au-pv{min-height:20px;text-align:right;font:500 14px "Cascadia Mono",Consolas,monospace;color:#6fb6d8;padding:0 4px}
.aurum .au-pv.err{color:#ff8a9a}
.aurum table.au-mt{border-collapse:separate;border-spacing:0;margin-left:auto;font:600 17px "Cascadia Mono",Consolas,monospace;border-left:2px solid #cfe3ff;border-right:2px solid #cfe3ff;border-radius:6px;padding:2px 4px}
.aurum table.au-mt td{padding:3px 10px;text-align:right}
.aurum table.au-st{margin-left:auto;font-size:13.5px;border-collapse:collapse}
.aurum table.au-st td{padding:2px 8px;text-align:right}.aurum table.au-st td:first-child{color:#9fb0d3;text-align:left}
.aurum .au-pad{flex:1 1 360px;max-width:460px;display:flex;flex-direction:column;gap:8px}
.aurum .au-grid{display:grid;gap:7px}
.aurum .au-g5{grid-template-columns:repeat(5,1fr)}.aurum .au-g6{grid-template-columns:repeat(6,1fr)}
.aurum .au-k{position:relative;height:46px;border-radius:12px;cursor:pointer;color:#e8ebf5;font:600 17px "Segoe UI Variable Display","Segoe UI",sans-serif;background:linear-gradient(180deg,#2c3141,#1e2230);border:1px solid rgba(255,255,255,.07);box-shadow:0 3px 0 #0a0b10,inset 0 1px 0 rgba(255,255,255,.09);transition:transform .06s,box-shadow .06s,filter .15s;user-select:none;padding:0 2px;line-height:1.05}
.aurum .au-k:hover{filter:brightness(1.18)}
.aurum .au-k:active,.aurum .au-k.khit{transform:translateY(2px);box-shadow:0 1px 0 #0a0b10,inset 0 1px 0 rgba(255,255,255,.05)}
.aurum .au-k.kn{background:linear-gradient(180deg,#3a4055,#292e3e);font-size:19px}
.aurum .au-k.ko{background:linear-gradient(180deg,#3b3322,#272015);color:#f6d77d;border-color:rgba(232,181,58,.3);font-size:20px}
.aurum .au-k.kf{font-size:14px;color:#c4cde4}
.aurum .au-k.ks{height:38px;font-size:13.5px;color:#c4cde4;border-radius:10px}
.aurum .au-k.kc{height:38px;font-size:12.5px;border-radius:10px;color:#9ff0e4;background:linear-gradient(180deg,#1d3a3e,#13272b);border-color:rgba(70,215,200,.28)}
.aurum .au-k.km{height:30px;font-size:12px;color:#aab4cc;border-radius:9px;background:linear-gradient(180deg,#232735,#191c26)}
.aurum .au-k.kx{color:#ff8a9a}
.aurum .au-k.keq{background:linear-gradient(135deg,#8b7cff,#5a8bff 55%,#46d7c8);color:#fff;border:0;box-shadow:0 3px 0 #1b2550,0 0 22px rgba(124,140,255,.45),inset 0 1px 0 rgba(255,255,255,.35);font-size:22px}
.aurum .au-k.ksec{color:#d9c8ff}.aurum .au-k.ksec.on{background:linear-gradient(180deg,#5b4bb8,#3a2f86);color:#fff;box-shadow:0 3px 0 #160f3c,0 0 16px rgba(139,124,255,.55)}
.aurum .au-k sup.au-2{position:absolute;top:2px;left:0;right:0;font-size:9.5px;color:#b9a6ff;font-weight:600;letter-spacing:.02em}
.aurum .au-k.kalt{color:#cbb8ff}
.aurum .au-label{font:700 10px "Segoe UI";letter-spacing:.2em;color:#7d6c45;text-transform:uppercase;margin:2px 2px -2px}
.aurum .au-panel{background:rgba(255,255,255,.035);border:1px solid rgba(255,255,255,.07);border-radius:14px;padding:10px 12px;margin-bottom:8px}
.aurum .au-row{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.aurum .au-f{background:rgba(0,0,0,.35);border:1px solid rgba(127,227,255,.2);border-radius:9px;color:#eef5ff;padding:6px 9px;font:500 14px "Cascadia Mono",Consolas,monospace;outline:0;min-width:0}
.aurum .au-f:focus{border-color:var(--au-gold);box-shadow:0 0 0 3px rgba(232,181,58,.15)}
.aurum select.au-f{font-family:"Segoe UI";cursor:pointer}
.aurum .au-btn{border:1px solid rgba(255,255,255,.12);background:linear-gradient(180deg,#2c3141,#1e2230);color:#e3e8f6;border-radius:10px;padding:6px 12px;font:600 12.5px "Segoe UI";cursor:pointer;box-shadow:0 2px 0 #0a0b10}
.aurum .au-btn:hover{border-color:var(--au-gold);color:#fff}
.aurum .au-btn.on{border-color:rgba(232,181,58,.7);color:#f6d77d;background:linear-gradient(180deg,#3b3322,#272015)}
.aurum .au-btn.gold{background:linear-gradient(180deg,#f6d77d,#d9a233);color:#1b1407;border:0}
.aurum .au-small{font-size:12px;color:var(--au-mute)}
.aurum .au-set{position:absolute;right:18px;top:58px;z-index:20;width:330px;max-width:calc(100% - 36px);background:linear-gradient(180deg,#1e2230,#141720);border:1px solid rgba(232,181,58,.35);border-radius:16px;padding:14px;box-shadow:0 20px 60px rgba(0,0,0,.6)}
.aurum .au-set h4{margin:0 0 8px;font:700 12px "Segoe UI";letter-spacing:.18em;text-transform:uppercase;color:#f3cf6e}
.aurum .au-set .au-row{margin-bottom:10px}
.aurum .au-lib td{padding:4px 8px;border-bottom:1px solid rgba(255,255,255,.05);font:500 13.5px "Cascadia Mono",Consolas,monospace}
.aurum .au-lib{width:100%;border-collapse:collapse}
.aurum .au-foot{margin:12px 6px 0;font-size:12px;color:#77829c;line-height:1.55}
.aurum .au-foot b{color:#b9c3dd}
.aurum canvas{display:block}
@media (max-width:900px){.aurum .au-pad{max-width:none}.aurum .au-scr{min-height:360px}}
@keyframes auShake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
.aurum .shake{animation:auShake .22s}
`;
  function css() { if (document.getElementById('aurum-css')) return; const s = document.createElement('style'); s.id = 'aurum-css'; s.textContent = CSS; document.head.appendChild(s); }

  /* ---------- keypad ---------- */
  // [label, what it types or does, style, 2nd label, 2nd action]
  const MEM = [['MC', '#mc', 'km'], ['MR', '#mr', 'km'], ['M+', '#m+', 'km'], ['M−', '#m-', 'km'], ['Ans', 'ans', 'km'], ['→', '->', 'km']];
  const SCI = [
    ['2nd', '#2nd', 'ksec'], ['sin', 'sin(', 'ks', 'sin⁻¹', 'asin('], ['cos', 'cos(', 'ks', 'cos⁻¹', 'acos('], ['tan', 'tan(', 'ks', 'tan⁻¹', 'atan('], ['ln', 'ln(', 'ks', 'eˣ', 'e^('], ['log', 'log(', 'ks', '10ˣ', '10^('],
    ['π', 'π', 'ks', 'e', 'e'], ['i', 'i', 'ks', '∠', 'polar('], ['x!', '!', 'ks', 'Γ', 'gamma('], ['nCr', 'nCr(', 'ks', 'nPr', 'nPr('], ['|x|', 'abs(', 'ks', 'mod', 'mod('], ['x⁻¹', '^(-1)', 'ks', '1/x', '1/'],
    ['x', 'x', 'ks', 'y', 'y'], ['ⁿ√', 'root(', 'ks', '∛', 'cbrt('], ['sinh', 'sinh(', 'ks', 'sinh⁻¹', 'asinh('], ['cosh', 'cosh(', 'ks', 'cosh⁻¹', 'acosh('], [',', ',', 'ks', ';', ';'], ['{ }', '{', 'ks', '[ ]', '[']
  ];
  const CAS = [['solve', '@solve(|, x)', 'kc', 'nsolve', '@nsolve(|, x)'], ['d/dx', '@diff(|, x)', 'kc', 'd²/dx²', '@diff(|, x, 2)'], ['∫', '@integrate(|, x)', 'kc', '∫ₐᵇ', '@integrate(|, x, 0, 1)'], ['lim', '@limit(|, x, 0)', 'kc', 'Σ', '@sum(|, k, 1, 10)'], ['factor', '@factor(|)', 'kc', 'taylor', '@taylor(|, x, 0, 5)'], ['expand', '@expand(|)', 'kc', 'simplify', '@simplify(|)']];
  const BASIC = [
    ['AC', '#ac', 'kf kx'], ['(', '(', 'kf'], [')', ')', 'kf'], ['%', '%', 'kf'], ['÷', '÷', 'ko'],
    ['7', '7', 'kn'], ['8', '8', 'kn'], ['9', '9', 'kn'], ['√', '√(', 'kf'], ['×', '×', 'ko'],
    ['4', '4', 'kn'], ['5', '5', 'kn'], ['6', '6', 'kn'], ['x²', '²', 'kf'], ['−', '−', 'ko'],
    ['1', '1', 'kn'], ['2', '2', 'kn'], ['3', '3', 'kn'], ['xʸ', '^', 'kf'], ['+', '+', 'ko'],
    ['±', '#neg', 'kf'], ['0', '0', 'kn'], ['.', '.', 'kn'], ['⌫', '#del', 'kf'], ['=', '#eq', 'keq']
  ];
  const keyHtml = (k, i, set) => '<button class="au-k ' + (k[2] || '') + (k[1] === '#2nd' && AU.second ? ' on' : '') + (AU.second && k[3] ? ' kalt' : '') + '" data-set="' + set + '" data-i="' + i + '" title="' + esc(k[3] ? k[0] + '   (2nd: ' + k[3] + ')' : k[0]) + '">' + (k[3] && S.adv ? '<sup class="au-2">' + esc(k[3]) + '</sup>' : '') + esc(AU.second && k[3] ? k[3] : k[0]) + '</button>';
  const SETS = { mem: MEM, sci: SCI, cas: CAS, basic: BASIC };
  function padHtml() {
    return '<div class="au-grid au-g6">' + MEM.map((k, i) => keyHtml(k, i, 'mem')).join('') + '</div>' +
      (S.adv ? '<div class="au-label">Scientific</div><div class="au-grid au-g6">' + SCI.map((k, i) => keyHtml(k, i, 'sci')).join('') + '</div><div class="au-label">Algebra and calculus</div><div class="au-grid au-g6">' + CAS.map((k, i) => keyHtml(k, i, 'cas')).join('') + '</div>' : '') +
      '<div class="au-grid au-g5" style="margin-top:4px">' + BASIC.map((k, i) => keyHtml(k, i, 'basic')).join('') + '</div>';
  }

  /* ---------- the device ---------- */
  const TABS = [['calc', '🧮 Calculate'], ['graph', '📈 Graph'], ['table', '▦ Table'], ['matrix', '⊞ Matrix'], ['stats', '📊 Stats'], ['base', '⌗ Base'], ['units', '⇄ Units'], ['lib', '𝑥 Library']];
  let root = null;
  AU.mount = function (el) {
    css(); AU.second = false; if (!S.adv) S.tab = 'calc';
    el.innerHTML = '<div class="aurum"><div class="au-dev"><div class="au-top"><span class="au-brand">AURUM</span><span class="au-model">Σ9 · graphing CAS</span><span class="au-sp"></span>' +
      '<span class="au-seg" id="au-mode"><button data-adv="0">Basic</button><button data-adv="1">Advanced</button></span><button class="au-icon" id="au-gear" title="Settings">⚙</button></div>' +
      '<div class="au-body" id="au-body"></div><div id="au-setbox"></div></div><div class="au-foot" id="au-foot"></div></div>';
    root = el.querySelector('.aurum');
    root.querySelector('#au-mode').onclick = e => { const b = e.target.closest('[data-adv]'); if (!b) return; S.adv = b.dataset.adv === '1'; if (!S.adv) S.tab = 'calc'; AU.save(); draw(); };
    root.querySelector('#au-gear').onclick = () => settings();
    draw();
    if (AU._kd) window.removeEventListener('keydown', AU._kd, true);
    AU._kd = globalKey; window.addEventListener('keydown', AU._kd, true);
  };
  AU.alive = () => root && document.body.contains(root) && root.offsetParent !== null;
  function draw() {
    root.querySelectorAll('#au-mode button').forEach(b => b.classList.toggle('on', (b.dataset.adv === '1') === !!S.adv));
    const body = root.querySelector('#au-body');
    const tabs = S.adv ? '<div class="au-tabs" id="au-tabs">' + TABS.map(t => '<button class="au-tab' + (S.tab === t[0] ? ' on' : '') + '" data-t="' + t[0] + '">' + t[1] + '</button>').join('') + '</div>' : '';
    body.innerHTML = '<div class="au-scr" id="au-scr"><div class="au-status" id="au-status"></div>' + tabs + '<div class="au-view" id="au-view"></div></div>' + (S.tab === 'calc' ? '<div class="au-pad" id="au-pad">' + padHtml() + '</div>' : '');
    if (S.adv) root.querySelector('#au-tabs').onclick = e => { const b = e.target.closest('[data-t]'); if (!b) return; S.tab = b.dataset.t; AU.save(); draw(); };
    status();
    const view = root.querySelector('#au-view');
    if (S.tab === 'calc') calcView(view); else if (S.tab === 'lib') libView(view); else if (AU.apps && AU.apps[S.tab]) AU.apps[S.tab](view); else calcView(view);
    if (S.tab === 'calc') root.querySelector('#au-pad').onclick = padClick;
    root.querySelector('#au-foot').innerHTML = S.adv ? 'Type with the keyboard or tap the keys. <b>Enter</b> answers, <b>Esc</b> clears, <b>↑ ↓</b> bring back earlier lines. Letters stay as letters: <b>x+x</b> gives 2x. Store with <b>a := 5</b> or <b>5 → a</b>; define functions with <b>f(x) := x² + 1</b>. Calculus treats angles as radians.' : 'Type with the keyboard or tap the keys. <b>Enter</b> answers, <b>Esc</b> clears. Switch to <b>Advanced</b> for graphs, algebra, matrices, statistics, number bases and units.';
  }
  AU.redraw = () => root && draw();
  function status() {
    const st = S.st, el = root.querySelector('#au-status'); if (!el) return;
    el.innerHTML = '<span class="au-chip" data-s="angle" title="Angle unit for sin, cos and tan. Click to change.">' + ({ deg: 'DEG', rad: 'RAD', grad: 'GRAD' }[st.angle]) + '</span><span class="au-chip" data-s="mode" title="Exact shows fractions and roots like 1/3 and √2. Decimal shows 0.333…">' + (st.mode === 'approx' ? 'DECIMAL' : 'EXACT') + '</span>' +
      (S.adv ? '<span class="au-chip" data-s="digits" title="Significant digits shown">' + st.digits + ' DIG</span>' : '') + (st.vars.M ? '<span class="au-chip gold" title="Memory M">M = ' + esc(trunc(AU.showSrc(st.vars.M), 14)) + '</span>' : '') + (AU.second ? '<span class="au-chip" style="color:#d9c8ff;border-color:#8b7cff">2ND</span>' : '');
    el.onclick = e => { const c = e.target.closest('[data-s]'); if (!c) return; const k = c.dataset.s; if (k === 'angle') st.angle = { deg: 'rad', rad: 'grad', grad: 'deg' }[st.angle]; else if (k === 'mode') st.mode = st.mode === 'approx' ? 'exact' : 'approx'; else st.digits = st.digits >= 15 ? 6 : st.digits + 1; ls.set('calcrad', st.angle === 'rad' ? '1' : '0'); AU.save(); status(); if (S.tab === 'calc') { drawHist(); preview(); } else AU.redraw(); };
  }
  const trunc = (s, n) => (s.length > n ? s.slice(0, n - 1) + '…' : s);
  AU.showSrc = src => { try { const r = E.run(src, JSON.parse(JSON.stringify(S.st))); return r && !r.error ? r.out : src; } catch (e) { return src; } };

  /* ---------- Calculate ---------- */
  let inp = null, pv = null, recall = -1;
  function calcView(v) {
    v.innerHTML = '<div class="au-hist" id="au-hist"></div><div class="au-entry"><input class="au-in" id="au-in" autocomplete="off" spellcheck="false" placeholder="' + (S.adv ? 'Try  x² − 5x + 6 = 0   or   diff(sin(x)·x, x)' : 'Type a sum, e.g. 12.5 × 4 + 7') + '"><div class="au-pv" id="au-pv"></div></div>';
    inp = v.querySelector('#au-in'); pv = v.querySelector('#au-pv');
    inp.value = AU.draft || '';
    inp.oninput = () => { AU.draft = inp.value; recall = -1; preview(); };
    inp.onkeydown = e => {
      if (e.key === 'Enter') { e.preventDefault(); exec(); }
      else if (e.key === 'Escape') { e.preventDefault(); setEntry(''); }
      else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') { const srcs = S.hist.filter(h => h.src).map(h => h.src); if (!srcs.length) return; e.preventDefault(); recall = e.key === 'ArrowUp' ? (recall < 0 ? srcs.length - 1 : Math.max(0, recall - 1)) : (recall < 0 ? -1 : recall + 1); if (recall >= srcs.length) recall = -1; setEntry(recall < 0 ? '' : srcs[recall], true); }
    };
    v.querySelector('#au-hist').onclick = histClick;
    drawHist(); preview(); setTimeout(() => { if (AU.alive() && document.activeElement !== inp && !/INPUT|TEXTAREA|SELECT/.test((document.activeElement || {}).tagName || '')) inp.focus(); }, 30);
  }
  function setEntry(t, keepRecall) { if (!inp) return; inp.value = t; AU.draft = t; if (!keepRecall) recall = -1; inp.focus(); inp.setSelectionRange(t.length, t.length); preview(); }
  AU.toCalc = t => { S.tab = 'calc'; AU.save(); draw(); setEntry(t); };
  function preview() {
    if (!pv) return; const t = inp.value.trim(); pv.classList.remove('err');
    if (!t || /:=|->|→/.test(t)) { pv.textContent = ''; return; }
    let r = null; try { r = E.run(t, JSON.parse(JSON.stringify(S.st))); } catch (e) { r = null; }
    pv.textContent = r && !r.error && r.kind !== 'def' ? '= ' + trunc(r.out, 90) : '';
  }
  function exec() {
    const t = inp.value.trim(); if (!t) return;
    const r = E.run(t, S.st);
    if (!r) return;
    if (r.error) { pv.textContent = r.out; pv.classList.add('err'); inp.classList.remove('shake'); void inp.offsetWidth; inp.classList.add('shake'); return; }
    const h = { src: t, i: r.input, o: r.out, a: r.alt || '', n: r.note || '', k: r.kind, ans: r.ans || '' };
    const v = r.value;
    if (E.isM(v)) h.m = v.rows.map(row => row.map(x => E.show(x, S.st)));
    if (v && v.kind === 'stats') { h.t = v.rows.map(rw => [rw[0], AU.show(rw[1], true)]); h.o = '1-variable statistics'; }
    if (v && v.kind === 'reg') { h.o = E.REG_FORM[v.type]; h.t = v.labels.map((l, i) => [l, AU.show(v.coef[i], true)]).concat([['r²', AU.show(v.r2, true)]]).concat(v.r !== undefined ? [['r', AU.show(v.r, true)]] : []); h.g = v.expr; }
    if (r.ans) S.st.ans = r.ans;
    S.hist.push(h); AU.save(); drawHist(); setEntry(''); status();
  }
  AU.exec = t => { if (!inp) return null; setEntry(t); exec(); };
  function drawHist() {
    const el = root && root.querySelector('#au-hist'); if (!el) return;
    if (!S.hist.length) { el.innerHTML = '<div class="au-empty">' + (S.adv ? 'Answers appear here. Tap an answer to use it again, or tap the sum to edit it.<br>Try: <code>1/3 + 1/6</code> <code>sqrt(8)</code> <code>solve(x² − 5x + 6 = 0, x)</code> <code>diff(x³·sin(x), x)</code> <code>integrate(x·e^x, x)</code> <code>[[1,2],[3,4]]⁻¹</code> <code>linreg({1,2,3},{2,4,7})</code> <code>hex(255)</code>' : 'Answers appear here. Tap one to use it again.<br>Try: <code>12.5 × 4 + 7</code> <code>15% × 240</code> <code>√(144) + 5</code> <code>1/3 + 1/6</code>') + '</div>'; el.querySelectorAll('code').forEach(c => { c.onclick = () => setEntry(c.textContent); }); return; }
    const list = S.hist.slice(-80), off = S.hist.length - list.length;
    el.innerHTML = list.map((h, j) => {
      const i = j + off;
      let out = '<div class="au-ho" data-a="use" data-i="' + i + '">' + esc(h.o) + '</div>';
      if (h.m) out = '<div data-a="use" data-i="' + i + '" style="cursor:pointer"><table class="au-mt">' + h.m.map(r => '<tr>' + r.map(x => '<td>' + esc(x) + '</td>').join('') + '</tr>').join('') + '</table></div>';
      if (h.t) out = '<div class="au-ho" style="font-size:16px">' + esc(h.o) + '</div><table class="au-st">' + h.t.map(r => '<tr><td>' + esc(r[0]) + '</td><td>' + esc(r[1]) + '</td></tr>').join('') + '</table>';
      return '<div class="au-h' + (h.err ? ' err' : '') + '"><div class="au-hi" data-a="edit" data-i="' + i + '" title="Edit this line">' + esc(h.i) + '</div>' + out + (h.a ? '<div class="au-ha">≈ ' + esc(h.a) + '</div>' : '') + (h.n ? '<div class="au-hn">' + esc(h.n) + '</div>' : '') +
        '<div class="au-hx">' + (h.g ? '<button class="au-mini" data-a="graph" data-i="' + i + '">📈 Graph it</button>' : '') + '<button class="au-mini" data-a="use" data-i="' + i + '">Use answer</button><button class="au-mini" data-a="edit" data-i="' + i + '">Edit</button><button class="au-mini" data-a="copy" data-i="' + i + '">Copy</button><button class="au-mini" data-a="del" data-i="' + i + '">✕</button></div></div>';
    }).join('');
    el.scrollTop = el.scrollHeight;
  }
  function histClick(e) {
    const b = e.target.closest('[data-a]'); if (!b) return; const h = S.hist[+b.dataset.i]; if (!h) return; const a = b.dataset.a;
    if (a === 'edit') setEntry(h.src);
    else if (a === 'use') ins(h.ans ? (h.ans.length > 60 ? 'ans' : h.ans.replace(/^\((-?\d+(?:\.\d+)?)\)$/, '$1')) : h.o);
    else if (a === 'copy') A.copy(h.o.replace(/−/g, '-') + (h.a ? '' : ''));
    else if (a === 'del') { S.hist.splice(+b.dataset.i, 1); AU.save(); drawHist(); }
    else if (a === 'graph' && h.g) { const f = S.fns.find(x => !x.src.trim()) || S.fns[S.fns.length - 1]; f.src = h.g; f.on = true; S.adv = true; S.tab = 'graph'; AU.save(); draw(); }
  }
  /* type at the cursor; a template with | wraps what is already typed when the cursor sits at the end */
  function ins(t) {
    if (!inp) return; let v = inp.value, a = inp.selectionStart == null ? v.length : inp.selectionStart, z = inp.selectionEnd == null ? a : inp.selectionEnd;
    if (t[0] === '@') { t = t.slice(1); const bar = t.indexOf('|'); if (a === z && a === v.length && v.trim()) { const nv = t.slice(0, bar) + v.trim() + t.slice(bar + 1); setEntry(nv); return; } const sel = v.slice(a, z); inp.value = v.slice(0, a) + t.slice(0, bar) + sel + t.slice(bar + 1) + v.slice(z); const p = a + bar + sel.length; inp.focus(); inp.setSelectionRange(p, p); AU.draft = inp.value; preview(); return; }
    inp.value = v.slice(0, a) + t + v.slice(z); const p = a + t.length; inp.focus(); inp.setSelectionRange(p, p); AU.draft = inp.value; preview();
  }
  function del() { const v = inp.value, a = inp.selectionStart, z = inp.selectionEnd; if (a !== z) { inp.value = v.slice(0, a) + v.slice(z); inp.setSelectionRange(a, a); } else if (a > 0) { const pre = v.slice(0, a), m = /([a-zA-Z⁻¹]+\(|.)$/u.exec(pre), n = m ? m[0].length : 1; inp.value = pre.slice(0, -n) + v.slice(a); inp.setSelectionRange(a - n, a - n); } AU.draft = inp.value; inp.focus(); preview(); }
  function memVal() { const t = inp.value.trim(); const r = t ? E.run(t, JSON.parse(JSON.stringify(S.st))) : (S.st.ans ? { ans: S.st.ans, value: true } : null); return r && !r.error && r.ans ? r.ans : null; }
  function padClick(e) {
    const b = e.target.closest('.au-k'); if (!b) return; const k = SETS[b.dataset.set][+b.dataset.i]; let act = AU.second && k[4] ? k[4] : k[1];
    b.classList.add('khit'); setTimeout(() => b.classList.remove('khit'), 90);
    if (AU.second && k[1] !== '#2nd') { AU.second = false; root.querySelector('#au-pad').innerHTML = padHtml(); status(); }
    if (act[0] !== '#') return ins(act);
    switch (act) {
      case '#2nd': AU.second = !AU.second; root.querySelector('#au-pad').innerHTML = padHtml(); status(); inp.focus(); return;
      case '#ac': setEntry(''); pv.textContent = ''; return;
      case '#del': return del();
      case '#eq': return exec();
      case '#neg': { const v = inp.value.trim(); if (!v) return ins('−'); return setEntry(/^−\(.*\)$/.test(v) ? v.slice(2, -1) : '−(' + v + ')'); }
      case '#mc': delete S.st.vars.M; AU.save(); status(); return;
      case '#mr': return ins('M');
      case '#m+': case '#m-': { const m = memVal(); if (!m) { A.toast('Nothing to add to memory yet'); return; } const cur = S.st.vars.M || '0'; const r = E.run('(' + cur + ')' + (act === '#m+' ? '+' : '-') + '(' + m + ')', JSON.parse(JSON.stringify(S.st))); if (r && r.ans) { S.st.vars.M = r.ans; AU.save(); status(); A.toast('Memory: ' + r.out); } return; }
    }
  }
  function globalKey(e) {
    if (!AU.alive() || S.tab !== 'calc' || !inp || e.ctrlKey || e.metaKey || e.altKey) return;
    const tg = e.target || {}; if (/INPUT|TEXTAREA|SELECT/.test(tg.tagName || '') || tg.isContentEditable) return;
    let hit = true;
    if (e.key.length === 1 && /[\w.+\-*/^()%!=,{}\[\] ]/.test(e.key)) ins(e.key);
    else if (e.key === 'Backspace') del();
    else if (e.key === 'Enter') exec();
    else hit = false;
    if (hit) { e.preventDefault(); e.stopPropagation(); }
  }

  /* ---------- Library: variables, functions, constants ---------- */
  function libView(v) {
    const st = S.st, vars = Object.keys(st.vars).sort(), fns = Object.keys(st.funcs).sort();
    v.innerHTML = '<div style="overflow:auto;max-height:520px;padding-right:4px">' +
      '<div class="au-panel"><div class="au-row"><input class="au-f" id="au-def" style="flex:1" placeholder="Define:  a := 12   or   f(x) := x² + 3x   or   g(x, y) := x·y"><button class="au-btn gold" id="au-defgo">Save</button></div><div class="au-small" id="au-defmsg" style="margin-top:6px">Saved names work everywhere: in sums, graphs and tables.</div></div>' +
      '<div class="au-panel"><b style="font-size:13px;color:#f3cf6e">Variables</b><table class="au-lib">' + (vars.length ? vars.map(n => '<tr><td style="color:#9fe0ff">' + esc(n) + '</td><td>' + esc(trunc(AU.showSrc(st.vars[n]), 60)) + '</td><td style="text-align:right"><button class="au-mini" data-ins="' + esc(n) + '">Use</button> <button class="au-mini" data-dv="' + esc(n) + '">✕</button></td></tr>').join('') : '<tr><td class="au-small">None yet.</td></tr>') + '</table></div>' +
      '<div class="au-panel"><b style="font-size:13px;color:#f3cf6e">Functions</b><table class="au-lib">' + (fns.length ? fns.map(n => '<tr><td style="color:#9fe0ff">' + esc(n + '(' + st.funcs[n].params.join(', ') + ')') + '</td><td>' + esc(trunc(E.pretty(E.parse(st.funcs[n].src, E.ctxOf(st))), 60)) + '</td><td style="text-align:right"><button class="au-mini" data-gf="' + esc(n) + '">📈</button> <button class="au-mini" data-ins="' + esc(n) + '(">Use</button> <button class="au-mini" data-df="' + esc(n) + '">✕</button></td></tr>').join('') : '<tr><td class="au-small">None yet.</td></tr>') + '</table></div>' +
      '<div class="au-panel"><b style="font-size:13px;color:#f3cf6e">Constants</b><table class="au-lib">' + E.CONSTANTS.map(c => '<tr><td style="color:#9fe0ff">' + esc(c[0]) + '</td><td style="font-family:Segoe UI">' + esc(c[1]) + '</td><td>' + esc(AU.show(E.CONST[c[0]], true)) + ' <span class="au-small">' + esc(c[2]) + '</span></td><td style="text-align:right"><button class="au-mini" data-ins="' + esc(c[0]) + '">Use</button></td></tr>').join('') + '</table></div></div>';
    const go = () => { const t = v.querySelector('#au-def').value.trim(); if (!t) return; const r = E.run(/:=|->|→/.test(t) ? t : t, S.st); const msg = v.querySelector('#au-defmsg'); if (!r || r.error) { msg.textContent = r ? r.out : 'Nothing to save'; msg.style.color = '#ff8a9a'; return; } AU.save(); libView(v); };
    v.querySelector('#au-defgo').onclick = go; v.querySelector('#au-def').onkeydown = e => { if (e.key === 'Enter') go(); };
    v.onclick = e => { const b = e.target.closest('button'); if (!b) return; if (b.dataset.ins) AU.toCalc((AU.draft || '') + b.dataset.ins); else if (b.dataset.dv) { delete st.vars[b.dataset.dv]; AU.save(); libView(v); } else if (b.dataset.df) { delete st.funcs[b.dataset.df]; AU.save(); libView(v); } else if (b.dataset.gf) { const n = b.dataset.gf, f = S.fns.find(x => !x.src.trim()) || S.fns[5]; f.src = n + '(x)'; f.on = true; S.tab = 'graph'; AU.save(); draw(); } };
  }

  /* ---------- settings ---------- */
  function settings() {
    const box = root.querySelector('#au-setbox'); if (box.innerHTML) { box.innerHTML = ''; return; }
    const st = S.st, seg = (k, opts) => '<span class="au-seg" data-k="' + k + '">' + opts.map(o => '<button data-v="' + o[0] + '" class="' + (String(st[k]) === String(o[0]) ? 'on' : '') + '">' + o[1] + '</button>').join('') + '</span>';
    box.innerHTML = '<div class="au-set"><h4>Settings</h4><div class="au-row"><span class="au-small" style="width:70px">Angles</span>' + seg('angle', [['deg', 'Degrees'], ['rad', 'Radians'], ['grad', 'Gradians']]) + '</div>' +
      '<div class="au-row"><span class="au-small" style="width:70px">Answers</span>' + seg('mode', [['exact', 'Exact'], ['approx', 'Decimal']]) + '</div>' +
      '<div class="au-row"><span class="au-small" style="width:70px">Digits</span><input type="range" min="6" max="15" value="' + st.digits + '" id="au-dg" style="flex:1"><b id="au-dgv" style="width:24px">' + st.digits + '</b></div>' +
      '<div class="au-row"><span class="au-small" style="width:70px">Word size</span>' + seg('bits', [[8, '8'], [16, '16'], [32, '32'], [64, '64 bit']]) + '</div>' +
      '<div class="au-row" style="margin-top:14px"><button class="au-btn" id="au-ch">Clear history</button><button class="au-btn" id="au-cv">Clear variables</button><button class="au-btn" id="au-close" style="margin-left:auto">Done</button></div></div>';
    box.onclick = async e => {
      const s = e.target.closest('[data-k]'), b = e.target.closest('[data-v]');
      if (s && b) { const k = s.dataset.k; st[k] = k === 'bits' ? +b.dataset.v : b.dataset.v; ls.set('calcrad', st.angle === 'rad' ? '1' : '0'); AU.save(); s.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); status(); refresh(); return; }
      if (e.target.id === 'au-ch') { if ((await A.confirm('Clear the whole calculator history?'))) { S.hist = []; AU.save(); refresh(); } }
      if (e.target.id === 'au-cv') { if ((await A.confirm('Delete every saved variable and function (including memory)?'))) { st.vars = {}; st.funcs = {}; AU.save(); status(); refresh(); } }
      if (e.target.id === 'au-close') box.innerHTML = '';
    };
    box.querySelector('#au-dg').oninput = e => { st.digits = +e.target.value; box.querySelector('#au-dgv').textContent = st.digits; AU.save(); status(); refresh(); };
  }
  function refresh() { if (S.tab === 'calc') { drawHist(); preview(); } else { const v = root.querySelector('#au-view'); if (S.tab === 'lib') libView(v); else if (AU.apps && AU.apps[S.tab]) AU.apps[S.tab](v); } }
})();

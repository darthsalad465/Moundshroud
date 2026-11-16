// Aurum Σ9 apps (Advanced mode): Graph (six coloured functions, pan, zoom, trace, roots, intersections,
// minimum/maximum and shaded integrals), Table, Matrix editor, Stats with lists and regressions, Base
// (hex/dec/oct/bin with a clickable bit grid) and Units. Loaded after calc-pro.js, which owns the device.
(() => {
  const AU = A.aurum; if (!AU) return;
  const E = AU.E, S = AU.S;
  const apps = AU.apps = {};
  const q = (v, s) => v.querySelector(s);
  const short = x => (isFinite(x) ? E.fmtNum(x, 7) : x !== x ? '—' : (x > 0 ? '∞' : '−∞'));
  const exactish = x => { const r = E.recognise(x); return r ? r : ''; };
  const SUBS = '₁₂₃₄₅₆';

  /* ================= Graph ================= */
  let gsel = 0, marks = [], area = null, analysis = '';
  apps.graph = v => {
    v.innerHTML = '<div style="display:flex;gap:12px;flex-wrap:wrap"><div style="width:270px;flex:none;max-width:100%"><div class="au-panel" id="ag-fns"></div>' +
      '<div class="au-panel"><div class="au-row" style="margin-bottom:6px"><button class="au-btn" data-z="in">＋ Zoom</button><button class="au-btn" data-z="out">− Zoom</button><button class="au-btn" data-z="std">Standard</button><button class="au-btn" data-z="trig">Trig</button><button class="au-btn" data-z="fit">Fit Y</button></div>' +
      '<div class="au-small">Drag to move, scroll to zoom, hover to trace.</div></div>' +
      '<div class="au-panel"><div class="au-small" style="margin-bottom:6px">Analyse <b id="ag-selname" style="color:#fff"></b></div><div class="au-row"><button class="au-btn" data-an="roots">Roots</button><button class="au-btn" data-an="ext">Min / Max</button><button class="au-btn" data-an="int">Intersections</button></div>' +
      '<div class="au-row" style="margin-top:6px"><span class="au-small">∫ from</span><input class="au-f" id="ag-a" value="0" style="width:56px"><span class="au-small">to</span><input class="au-f" id="ag-b" value="2" style="width:56px"><button class="au-btn" data-an="area">Area</button></div><div id="ag-res" style="margin-top:8px;font-size:13px;line-height:1.6;max-height:150px;overflow:auto"></div></div></div>' +
      '<div style="flex:1;min-width:260px;position:relative"><canvas id="ag-cv" style="width:100%;height:420px;border-radius:14px;background:rgba(0,0,0,.28);cursor:crosshair;touch-action:none"></canvas><div id="ag-tip" style="position:absolute;pointer-events:none;font:600 12px Cascadia Mono,Consolas,monospace;color:#fff;background:rgba(10,14,26,.9);border:1px solid rgba(127,227,255,.35);border-radius:8px;padding:3px 7px;display:none"></div><div class="au-small" id="ag-win" style="text-align:right;margin-top:4px"></div></div></div>';
    const fnsEl = q(v, '#ag-fns');
    const drawFns = () => {
      fnsEl.innerHTML = S.fns.map((f, i) => '<div class="au-row" style="margin-bottom:5px"><span data-on="' + i + '" title="Show or hide" style="width:16px;height:16px;border-radius:50%;cursor:pointer;flex:none;background:' + (f.on ? AU.COLORS[i] : 'transparent') + ';border:2px solid ' + AU.COLORS[i] + ';box-shadow:' + (f.on ? '0 0 8px ' + AU.COLORS[i] : 'none') + '"></span><span data-sel="' + i + '" style="font:600 13px Cascadia Mono,Consolas;color:' + (gsel === i ? '#fff' : '#8f9bb6') + ';cursor:pointer;width:34px">y' + SUBS[i] + '=</span><input class="au-f" data-fi="' + i + '" value="' + esc(f.src) + '" placeholder="e.g. x^3 − 2x" style="flex:1;width:0' + (gsel === i ? ';border-color:' + AU.COLORS[i] : '') + '"></div>').join('');
      q(v, '#ag-selname').textContent = 'y' + SUBS[gsel];
    };
    drawFns();
    fnsEl.oninput = e => { const i = e.target.dataset.fi; if (i == null) return; S.fns[i].src = e.target.value; marks = []; area = null; AU.save(); plot(); };
    fnsEl.onclick = e => { const o = e.target.closest('[data-on]'), s = e.target.closest('[data-sel]'), fi = e.target.closest('[data-fi]'); if (o) { S.fns[o.dataset.on].on = !S.fns[o.dataset.on].on; AU.save(); drawFns(); plot(); } else if (s || fi) { const n = +(s ? s.dataset.sel : fi.dataset.fi); if (n !== gsel) { gsel = n; drawFns(); const inpt = q(v, '[data-fi="' + n + '"]'); inpt.focus(); } } };
    const cv = q(v, '#ag-cv'), tip = q(v, '#ag-tip'), W = S.win;
    let fs = [];
    const compileAll = () => { fs = S.fns.map((f, i) => { if (!f.src.trim()) return null; try { return E.compile(f.src, S.st).f; } catch (e) { const el = q(v, '[data-fi="' + i + '"]'); if (el) el.style.borderColor = '#ff6b81'; return null; } }); };
    function plot() {
      compileAll();
      const dpr = window.devicePixelRatio || 1, w = cv.clientWidth, h = cv.clientHeight; if (!w) return;
      cv.width = w * dpr; cv.height = h * dpr; const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, h);
      const X = x => (x - W.x0) / (W.x1 - W.x0) * w, Y = y => h - (y - W.y0) / (W.y1 - W.y0) * h;
      const step = span => { const r = span / 8, p = Math.pow(10, Math.floor(Math.log10(r))), m = r / p; return (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * p; };
      const sx = step(W.x1 - W.x0), sy = step(W.y1 - W.y0);
      g.lineWidth = 1; g.font = '11px Segoe UI'; g.fillStyle = 'rgba(180,200,235,.7)';
      for (let x = Math.ceil(W.x0 / sx) * sx; x <= W.x1; x += sx) { g.strokeStyle = 'rgba(127,227,255,.07)'; g.beginPath(); g.moveTo(X(x), 0); g.lineTo(X(x), h); g.stroke(); if (Math.abs(x) > sx / 2) g.fillText(short(+x.toPrecision(6)), X(x) + 3, Math.min(h - 4, Math.max(12, Y(0) + 13))); }
      for (let y = Math.ceil(W.y0 / sy) * sy; y <= W.y1; y += sy) { g.strokeStyle = 'rgba(127,227,255,.07)'; g.beginPath(); g.moveTo(0, Y(y)); g.lineTo(w, Y(y)); g.stroke(); if (Math.abs(y) > sy / 2) g.fillText(short(+y.toPrecision(6)), Math.min(w - 40, Math.max(3, X(0) + 4)), Y(y) - 3); }
      g.strokeStyle = 'rgba(225,235,255,.55)'; g.lineWidth = 1.3; g.beginPath(); g.moveTo(0, Y(0)); g.lineTo(w, Y(0)); g.moveTo(X(0), 0); g.lineTo(X(0), h); g.stroke();
      if (area && fs[area.i]) { const f = fs[area.i]; g.fillStyle = AU.COLORS[area.i] + '44'; g.beginPath(); g.moveTo(X(area.a), Y(0)); const n = 300; for (let k = 0; k <= n; k++) { const x = area.a + (area.b - area.a) * k / n, y = f(x); g.lineTo(X(x), Y(isFinite(y) ? y : 0)); } g.lineTo(X(area.b), Y(0)); g.closePath(); g.fill(); }
      fs.forEach((f, i) => {
        if (!f || !S.fns[i].on) return; g.strokeStyle = AU.COLORS[i]; g.lineWidth = i === gsel ? 2.6 : 2; g.shadowColor = AU.COLORS[i]; g.shadowBlur = 8; g.beginPath();
        let pen = false, py = 0; const n = Math.ceil(w * 1.5), span = W.y1 - W.y0;
        for (let k = 0; k <= n; k++) { const x = W.x0 + (W.x1 - W.x0) * k / n, y = f(x); if (!isFinite(y)) { pen = false; continue; } const yy = Y(y); if (pen && Math.abs(y - py) > span * 2) pen = false; if (!pen) g.moveTo(X(x), yy); else g.lineTo(X(x), yy); pen = true; py = y; }
        g.stroke(); g.shadowBlur = 0;
      });
      marks.forEach(m => { g.fillStyle = '#fff'; g.strokeStyle = m.c || '#fff'; g.lineWidth = 2; g.beginPath(); g.arc(X(m.x), Y(m.y), 4.5, 0, 7); g.fill(); g.stroke(); g.fillStyle = '#e9f2ff'; g.font = '600 11px Segoe UI'; g.fillText(m.label, X(m.x) + 7, Y(m.y) - 7); });
      q(v, '#ag-win').textContent = 'x ' + short(W.x0) + ' to ' + short(W.x1) + '   ·   y ' + short(W.y0) + ' to ' + short(W.y1);
      AU._plot = { X, Y, w, h };
    }
    const toX = px => W.x0 + px / cv.clientWidth * (W.x1 - W.x0), toY = py => W.y0 + (1 - py / cv.clientHeight) * (W.y1 - W.y0);
    const zoom = (k, cx, cy) => { cx = cx == null ? (W.x0 + W.x1) / 2 : cx; cy = cy == null ? (W.y0 + W.y1) / 2 : cy; W.x0 = cx + (W.x0 - cx) * k; W.x1 = cx + (W.x1 - cx) * k; W.y0 = cy + (W.y0 - cy) * k; W.y1 = cy + (W.y1 - cy) * k; AU.save(); plot(); };
    let drag = null;
    cv.onpointerdown = e => { drag = { x: e.clientX, y: e.clientY, w: Object.assign({}, W) }; cv.setPointerCapture(e.pointerId); };
    cv.onpointerup = () => { drag = null; AU.save(); };
    cv.onpointermove = e => {
      const r = cv.getBoundingClientRect(), px = e.clientX - r.left, py = e.clientY - r.top;
      if (drag) { const dx = (e.clientX - drag.x) / cv.clientWidth * (drag.w.x1 - drag.w.x0), dy = (e.clientY - drag.y) / cv.clientHeight * (drag.w.y1 - drag.w.y0); W.x0 = drag.w.x0 - dx; W.x1 = drag.w.x1 - dx; W.y0 = drag.w.y0 + dy; W.y1 = drag.w.y1 + dy; plot(); tip.style.display = 'none'; return; }
      const f = fs[gsel] && S.fns[gsel].on ? fs[gsel] : null; if (!f) { tip.style.display = 'none'; return; }
      const x = toX(px), y = f(x); if (!isFinite(y)) { tip.style.display = 'none'; return; }
      plot(); const p = AU._plot, g = cv.getContext('2d'); g.strokeStyle = 'rgba(255,255,255,.25)'; g.setLineDash([4, 4]); g.beginPath(); g.moveTo(p.X(x), 0); g.lineTo(p.X(x), p.h); g.stroke(); g.setLineDash([]); g.fillStyle = AU.COLORS[gsel]; g.beginPath(); g.arc(p.X(x), p.Y(y), 5, 0, 7); g.fill();
      tip.style.display = 'block'; tip.textContent = 'x = ' + E.fmtNum(x, 6) + '   y = ' + E.fmtNum(y, 6); tip.style.left = Math.min(px + 12, cv.clientWidth - 200) + 'px'; tip.style.top = Math.max(0, p.Y(y) - 34) + 'px';
    };
    cv.onpointerleave = () => { tip.style.display = 'none'; if (!drag) plot(); };
    cv.onwheel = e => { e.preventDefault(); const r = cv.getBoundingClientRect(); zoom(e.deltaY > 0 ? 1.2 : 1 / 1.2, toX(e.clientX - r.left), toY(e.clientY - r.top)); };
    v.onclick = e => {
      const z = e.target.closest('[data-z]'), an = e.target.closest('[data-an]');
      if (z) { const t = z.dataset.z; if (t === 'in') zoom(0.7); else if (t === 'out') zoom(1 / 0.7); else if (t === 'std') { Object.assign(W, { x0: -10, x1: 10, y0: -6.5, y1: 6.5 }); AU.save(); plot(); } else if (t === 'trig') { const k = S.st.angle === 'deg' ? 360 : S.st.angle === 'grad' ? 400 : 2 * Math.PI; Object.assign(W, { x0: -k, x1: k, y0: -4, y1: 4 }); AU.save(); plot(); } else fitY(); }
      if (an) analyse(an.dataset.an);
    };
    function fitY() { let lo = Infinity, hi = -Infinity; fs.forEach((f, i) => { if (!f || !S.fns[i].on) return; for (let k = 0; k <= 400; k++) { const y = f(W.x0 + (W.x1 - W.x0) * k / 400); if (isFinite(y) && Math.abs(y) < 1e9) { lo = Math.min(lo, y); hi = Math.max(hi, y); } } }); if (!isFinite(lo)) return; if (hi - lo < 1e-9) { lo -= 1; hi += 1; } const pad = (hi - lo) * 0.08; W.y0 = lo - pad; W.y1 = hi + pad; AU.save(); plot(); }
    function analyse(kind) {
      const res = q(v, '#ag-res'), f = fs[gsel]; marks = []; area = null; const col = AU.COLORS[gsel], name = 'y' + SUBS[gsel];
      const fmt = (x) => E.fmtNum(x, 8) + (exactish(x) ? '  (' + exactish(x) + ')' : '');
      if (!f) { res.innerHTML = '<span style="color:#ff8a9a">Type a function in ' + name + ' first.</span>'; plot(); return; }
      let lines = [];
      if (kind === 'roots') { const r = E.findRoots(f, W.x0, W.x1, 3000); r.forEach(x => marks.push({ x, y: 0, c: col, label: 'x = ' + E.fmtNum(x, 5) })); lines = r.length ? r.map(x => 'Root  x = ' + fmt(x)) : ['No roots in view.']; }
      if (kind === 'ext') { const d = x => E.nderiv(f, x), r = E.findRoots(d, W.x0, W.x1, 2000); r.forEach(x => { const y = f(x), k = E.nderiv(d, x); if (!isFinite(y)) return; const t = k > 0 ? 'Minimum' : k < 0 ? 'Maximum' : 'Flat point'; marks.push({ x, y, c: col, label: t.slice(0, 3) + ' (' + E.fmtNum(x, 4) + ', ' + E.fmtNum(y, 4) + ')' }); lines.push(t + '  (' + fmt(x) + ',  ' + fmt(y) + ')'); }); if (!lines.length) lines = ['No turning points in view.']; }
      if (kind === 'int') { fs.forEach((g, j) => { if (j === gsel || !g || !S.fns[j].on) return; const r = E.findRoots(x => f(x) - g(x), W.x0, W.x1, 3000); r.forEach(x => { marks.push({ x, y: f(x), c: AU.COLORS[j], label: '(' + E.fmtNum(x, 4) + ', ' + E.fmtNum(f(x), 4) + ')' }); lines.push(name + ' = y' + SUBS[j] + '  at  (' + fmt(x) + ',  ' + fmt(f(x)) + ')'); }); }); if (!lines.length) lines = ['No crossings in view. Turn on a second function.']; }
      if (kind === 'area') { let a, b; try { a = E.N(E.ev(E.parse(q(v, '#ag-a').value, E.ctxOf(S.st)), E.ctxOf(S.st))); b = E.N(E.ev(E.parse(q(v, '#ag-b').value, E.ctxOf(S.st)), E.ctxOf(S.st))); } catch (e) { res.textContent = 'Check the limits.'; return; } const I = E.quad(f, a, b); area = { i: gsel, a, b }; let exact = ''; const r = E.run('integrate(' + S.fns[gsel].src + ', x, ' + q(v, '#ag-a').value + ', ' + q(v, '#ag-b').value + ')', JSON.parse(JSON.stringify(S.st))); if (r && !r.error && r.out !== E.fmtNum(I, 12)) exact = '  =  ' + r.out; lines = ['∫ ' + name + ' dx from ' + E.fmtNum(a, 6) + ' to ' + E.fmtNum(b, 6) + '  =  ' + E.fmtNum(I, 10) + exact]; }
      analysis = lines.map(l => '<div style="color:' + col + '">● <span style="color:#e9eef9">' + esc(l) + '</span></div>').join(''); res.innerHTML = analysis; plot();
    }
    plot(); if (analysis) q(v, '#ag-res').innerHTML = analysis;
    if (AU._ro) AU._ro.disconnect(); if (window.ResizeObserver) { AU._ro = new ResizeObserver(() => { if (document.body.contains(cv)) plot(); }); AU._ro.observe(cv); }
  };

  /* ================= Table ================= */
  apps.table = v => {
    v.innerHTML = '<div class="au-row" style="margin-bottom:8px"><span class="au-small">Start x</span><input class="au-f" id="at-s" value="' + esc(S.tstart) + '" style="width:80px"><span class="au-small">Step</span><input class="au-f" id="at-d" value="' + esc(S.tstep) + '" style="width:80px"><span class="au-small">Uses the functions from Graph.</span></div><div id="at-t" style="overflow:auto;max-height:470px"></div>';
    const draw = () => {
      S.tstart = q(v, '#at-s').value; S.tstep = q(v, '#at-d').value; AU.save();
      let x0, dx; try { const c = E.ctxOf(S.st); x0 = E.N(E.ev(E.parse(S.tstart, c), c)); dx = E.N(E.ev(E.parse(S.tstep, c), c)); } catch (e) { q(v, '#at-t').innerHTML = '<div class="au-small">Check the start and step.</div>'; return; }
      const cols = S.fns.map((f, i) => [f, i]).filter(([f]) => f.on && f.src.trim()).map(([f, i]) => { let fn = null; try { fn = E.compile(f.src, S.st).f; } catch (e) { fn = () => NaN; } return { i, fn }; });
      if (!cols.length) { q(v, '#at-t').innerHTML = '<div class="au-empty">Add a function in Graph first.</div>'; return; }
      let h = '<table class="au-lib" style="font-variant-numeric:tabular-nums"><tr><td style="color:#f3cf6e">x</td>' + cols.map(c => '<td style="color:' + AU.COLORS[c.i] + '">y' + SUBS[c.i] + '</td>').join('') + '</tr>';
      for (let k = 0; k < 40; k++) { const x = +(x0 + k * dx).toPrecision(12); h += '<tr><td style="color:#c9d3ea">' + E.fmtNum(x, 8) + '</td>' + cols.map(c => '<td>' + short(c.fn(x)) + '</td>').join('') + '</tr>'; }
      q(v, '#at-t').innerHTML = h + '</table>';
    };
    q(v, '#at-s').oninput = q(v, '#at-d').oninput = draw; draw();
  };

  /* ================= Matrix ================= */
  let mname = 'A';
  const parseMat = src => { try { const r = E.run(src, JSON.parse(JSON.stringify(S.st))); if (r && E.isM(r.value)) return r.value.rows.map(row => row.map(x => E.show(x, S.st).replace(/−/g, '-'))); } catch (e) { /* fall back */ } return [['0', '0'], ['0', '0']]; };
  apps.matrix = v => {
    const cells = parseMat(S.mats[mname] || '[[0]]'); S.st.vars[mname] = S.mats[mname];
    const OPS = [['det(A)', 'det'], ['A⁻¹', 'inverse'], ['Aᵀ', 'transpose'], ['rref(A)', 'rref'], ['rank(A)', 'rank'], ['trace(A)', 'trace'], ['eig(A)', 'eigenvalues'], ['A²', 'square'], ['A+B', ''], ['A−B', ''], ['A×B', ''], ['B×A', ''], ['A⁻¹×B', 'solve A·X = B'], ['A×C', '']];
    v.innerHTML = '<div style="display:flex;gap:12px;flex-wrap:wrap"><div class="au-panel" style="flex:1;min-width:260px"><div class="au-row" style="margin-bottom:8px">' + ['A', 'B', 'C'].map(n => '<button class="au-btn' + (n === mname ? ' on' : '') + '" data-m="' + n + '">' + n + '</button>').join('') + '<span class="au-sp" style="flex:1"></span><span class="au-small">Rows</span><select class="au-f" id="am-r">' + [1, 2, 3, 4, 5, 6].map(n => '<option' + (n === cells.length ? ' selected' : '') + '>' + n + '</option>').join('') + '</select><span class="au-small">Columns</span><select class="au-f" id="am-c">' + [1, 2, 3, 4, 5, 6].map(n => '<option' + (n === cells[0].length ? ' selected' : '') + '>' + n + '</option>').join('') + '</select></div>' +
      '<div id="am-g" style="display:inline-grid;gap:6px;padding:8px 12px;border-left:2px solid #cfe3ff;border-right:2px solid #cfe3ff;border-radius:8px;grid-template-columns:repeat(' + cells[0].length + ',74px)">' + cells.map((r, i) => r.map((x, j) => '<input class="au-f" data-r="' + i + '" data-c="' + j + '" value="' + esc(x) + '" style="width:74px;text-align:right">').join('')).join('') + '</div><div class="au-small" style="margin-top:8px">Entries can be fractions or sums, like 1/3 or 2√2. ' + mname + ' is also saved as a variable for Calculate.</div></div>' +
      '<div class="au-panel" style="width:330px;max-width:100%"><div class="au-row">' + OPS.map(o => '<button class="au-btn" data-op="' + esc(o[0]) + '" title="' + esc(o[1]) + '">' + esc(o[0]) + '</button>').join('') + '</div><div id="am-out" style="margin-top:10px;min-height:60px"></div><div class="au-row" style="margin-top:8px"><button class="au-btn" id="am-send">Use in Calculate</button></div></div></div>';
    const save = () => { const rows = [...v.querySelectorAll('#am-g input')].reduce((m, el) => { (m[+el.dataset.r] = m[+el.dataset.r] || [])[+el.dataset.c] = (el.value.trim() || '0'); return m; }, []); S.mats[mname] = '[' + rows.map(r => '[' + r.join(',') + ']').join(',') + ']'; S.st.vars[mname] = S.mats[mname]; AU.save(); };
    const resize = () => { const R = +q(v, '#am-r').value, C = +q(v, '#am-c').value, rows = Array.from({ length: R }, (_, i) => Array.from({ length: C }, (_, j) => (cells[i] && cells[i][j] != null ? cells[i][j] : (i === j ? '1' : '0')))); S.mats[mname] = '[' + rows.map(r => '[' + r.join(',') + ']').join(',') + ']'; S.st.vars[mname] = S.mats[mname]; AU.save(); apps.matrix(v); };
    q(v, '#am-r').onchange = q(v, '#am-c').onchange = resize;
    q(v, '#am-g').oninput = save;
    let lastExpr = '';
    v.onclick = e => {
      const m = e.target.closest('[data-m]'), op = e.target.closest('[data-op]');
      if (m) { save(); mname = m.dataset.m; apps.matrix(v); return; }
      if (e.target.id === 'am-send' && lastExpr) { AU.toCalc(lastExpr); return; }
      if (!op) return; save(); ['A', 'B', 'C'].forEach(n => { S.st.vars[n] = S.mats[n]; });
      const map = { 'det(A)': 'det(A)', 'A⁻¹': 'inv(A)', 'Aᵀ': 'transpose(A)', 'rref(A)': 'rref(A)', 'rank(A)': 'rank(A)', 'trace(A)': 'trace(A)', 'eig(A)': 'eig(A)', 'A²': 'A^2', 'A+B': 'A+B', 'A−B': 'A-B', 'A×B': 'A*B', 'B×A': 'B*A', 'A⁻¹×B': 'inv(A)*B', 'A×C': 'A*C' };
      const ex = map[op.dataset.op].replace(/\b[AB]\b/g, m => (m === 'A' ? mname : mname === 'A' ? 'B' : 'A'));
      lastExpr = ex; const r = E.run(ex, JSON.parse(JSON.stringify(S.st))), out = q(v, '#am-out');
      if (!r || r.error) { out.innerHTML = '<span style="color:#ff8a9a">' + esc(r ? r.out : 'Error') + '</span>'; return; }
      out.innerHTML = '<div class="au-small" style="margin-bottom:6px">' + esc(E.pretty(E.parse(ex, E.ctxOf(S.st)))) + ' =</div>' + (E.isM(r.value) ? '<table class="au-mt" style="margin-left:0">' + r.value.rows.map(row => '<tr>' + row.map(x => '<td>' + esc(E.show(x, S.st)) + '</td>').join('') + '</tr>').join('') + '</table>' : '<div style="font:600 20px Segoe UI">' + esc(r.out) + '</div>') + (r.alt ? '<div class="au-ha" style="text-align:left">≈ ' + esc(r.alt) + '</div>' : '');
    };
  };

  /* ================= Stats ================= */
  const REGS = [['lin', 'Linear'], ['quad', 'Quadratic'], ['cubic', 'Cubic'], ['exp', 'Exponential'], ['pow', 'Power'], ['ln', 'Logarithmic']];
  apps.stats = v => {
    const L = S.lists, n = Math.max(L.L1.length, L.L2.length, L.L3.length) + 2;
    v.innerHTML = '<div style="display:flex;gap:12px;flex-wrap:wrap"><div class="au-panel" style="width:290px;max-width:100%;max-height:520px;overflow:auto"><table class="au-lib" id="as-t"><tr><td></td>' + ['L1', 'L2', 'L3'].map(k => '<td style="color:#f3cf6e;font-family:Segoe UI;font-weight:700">' + k + '</td>').join('') + '</tr>' +
      Array.from({ length: n }, (_, i) => '<tr><td class="au-small">' + (i + 1) + '</td>' + ['L1', 'L2', 'L3'].map(k => '<td><input class="au-f" data-l="' + k + '" data-i="' + i + '" value="' + esc(L[k][i] || '') + '" style="width:70px;text-align:right;padding:4px 6px"></td>').join('') + '</tr>').join('') + '</table><div class="au-row" style="margin-top:8px"><button class="au-btn" id="as-clear">Clear lists</button></div></div>' +
      '<div style="flex:1;min-width:260px"><div class="au-panel"><div class="au-row"><button class="au-btn gold" id="as-1v">1-variable stats of L1</button><select class="au-f" id="as-reg">' + REGS.map(r => '<option value="' + r[0] + '"' + (S.reg === r[0] ? ' selected' : '') + '>' + r[1] + '</option>').join('') + '</select><button class="au-btn gold" id="as-fit">Fit L2 against L1</button></div><div id="as-out" style="margin-top:10px"></div></div>' +
      '<canvas id="as-cv" style="width:100%;height:240px;border-radius:12px;background:rgba(0,0,0,.28)"></canvas></div></div>';
    const sync = () => { ['L1', 'L2', 'L3'].forEach(k => { const vals = [...v.querySelectorAll('[data-l="' + k + '"]')].map(el => el.value.trim()); while (vals.length && !vals[vals.length - 1]) vals.pop(); L[k] = vals; S.st.vars[k] = '{' + vals.map(x => x || '0').join(',') + '}'; }); AU.save(); };
    sync();
    q(v, '#as-t').oninput = () => { sync(); scatter(null); };
    q(v, '#as-t').onkeydown = e => { if (e.key === 'Enter') { const el = e.target; const nx = q(v, '[data-l="' + el.dataset.l + '"][data-i="' + (+el.dataset.i + 1) + '"]'); if (nx) nx.focus(); else apps.stats(v); } };
    q(v, '#as-clear').onclick = () => { if (!confirm('Empty L1, L2 and L3?')) return; L.L1 = []; L.L2 = []; L.L3 = []; ['L1', 'L2', 'L3'].forEach(k => { S.st.vars[k] = '{}'; }); AU.save(); apps.stats(v); };
    q(v, '#as-reg').onchange = e => { S.reg = e.target.value; AU.save(); };
    const out = q(v, '#as-out'), table = rows => '<table class="au-st" style="margin-left:0">' + rows.map(r => '<tr><td>' + esc(r[0]) + '</td><td style="font-weight:600">' + esc(r[1]) + '</td></tr>').join('') + '</table>';
    q(v, '#as-1v').onclick = () => { sync(); const r = E.run('stats(L1)', JSON.parse(JSON.stringify(S.st))); if (!r || r.error) { out.innerHTML = '<span style="color:#ff8a9a">' + esc(r ? r.out : '') + '</span>'; return; } out.innerHTML = table(r.value.rows.map(x => [x[0], AU.show(x[1], true)])); scatter(null); };
    q(v, '#as-fit').onclick = () => {
      sync(); const t = q(v, '#as-reg').value; S.reg = t; const r = E.run(t + 'reg(L1, L2)', JSON.parse(JSON.stringify(S.st)));
      if (!r || r.error) { out.innerHTML = '<span style="color:#ff8a9a">' + esc(r ? r.out : '') + '</span>'; return; }
      const g = r.value; S.st.funcs.RegEq = { params: ['x'], src: g.expr }; AU.save();
      out.innerHTML = '<div style="font:600 17px Segoe UI;margin-bottom:6px">' + esc(E.REG_FORM[g.type]) + '</div>' + table(g.labels.map((l, i) => [l, AU.show(g.coef[i], true)]).concat([['r²', AU.show(g.r2, true)]]).concat(g.r !== undefined ? [['r', AU.show(g.r, true)]] : [])) + '<div class="au-small" style="margin:6px 0">Saved as the function <b>RegEq(x)</b>.</div><button class="au-btn" id="as-graph">📈 Graph the fit</button>';
      q(v, '#as-graph').onclick = () => { const f = S.fns.find(x => !x.src.trim()) || S.fns[5]; f.src = 'RegEq(x)'; f.on = true; S.tab = 'graph'; AU.save(); AU.redraw(); };
      scatter(g);
    };
    function scatter(g) {
      const cv = q(v, '#as-cv'), dpr = window.devicePixelRatio || 1, w = cv.clientWidth, h = cv.clientHeight; if (!w) return; cv.width = w * dpr; cv.height = h * dpr; const c = cv.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0);
      const num = s => { try { return E.N(E.ev(E.parse(s, E.ctxOf(S.st)), E.ctxOf(S.st))); } catch (e) { return NaN; } };
      const pts = L.L1.map((x, i) => [num(x), num(L.L2[i] || '')]).filter(p => isFinite(p[0]) && isFinite(p[1]));
      if (!pts.length) { c.fillStyle = '#7d8aa8'; c.font = '13px Segoe UI'; c.fillText('Type numbers in L1 and L2 to see a scatter plot.', 14, 24); return; }
      let x0 = Math.min(...pts.map(p => p[0])), x1 = Math.max(...pts.map(p => p[0])), y0 = Math.min(...pts.map(p => p[1])), y1 = Math.max(...pts.map(p => p[1])); const px = (x1 - x0 || 1) * 0.1, py = (y1 - y0 || 1) * 0.12; x0 -= px; x1 += px; y0 -= py; y1 += py;
      const X = x => (x - x0) / (x1 - x0) * w, Y = y => h - (y - y0) / (y1 - y0) * h;
      c.strokeStyle = 'rgba(127,227,255,.12)'; for (let k = 1; k < 5; k++) { c.beginPath(); c.moveTo(0, h * k / 5); c.lineTo(w, h * k / 5); c.stroke(); }
      if (g) { const f = E.compile(g.expr, S.st).f; c.strokeStyle = '#f6d77d'; c.lineWidth = 2.2; c.shadowColor = '#e8b53a'; c.shadowBlur = 8; c.beginPath(); for (let k = 0; k <= 300; k++) { const x = x0 + (x1 - x0) * k / 300, y = f(x); if (isFinite(y)) (k ? c.lineTo(X(x), Y(y)) : c.moveTo(X(x), Y(y))); } c.stroke(); c.shadowBlur = 0; }
      pts.forEach(p => { c.fillStyle = '#7fe3ff'; c.beginPath(); c.arc(X(p[0]), Y(p[1]), 4.5, 0, 7); c.fill(); });
      c.fillStyle = '#9fb0d3'; c.font = '11px Segoe UI'; c.fillText('x ' + short(x0 + px) + ' to ' + short(x1 - px) + '   y ' + short(y0 + py) + ' to ' + short(y1 - py), 8, h - 8);
    }
    scatter(null);
  };

  /* ================= Base ================= */
  apps.base = v => {
    const B = S.base, bits = S.st.bits;
    const BN = { 16: ['HEX', /^[0-9a-f]+$/i], 10: ['DEC', /^-?\d+$/], 8: ['OCT', /^[0-7]+$/], 2: ['BIN', /^[01]+$/] };
    const parse = (s, b) => { s = String(s).replace(/[\s_]/g, '').replace(/^0[xbo]/i, ''); if (!s || !BN[b][1].test(s)) return null; const neg = s[0] === '-'; if (neg) s = s.slice(1); let n = 0n; for (const ch of s.toLowerCase()) n = n * BigInt(b) + BigInt(parseInt(ch, 36)); return BigInt.asIntN(bits, neg ? -n : n); };
    let val = parse(B.v, B.b); if (val === null) val = 0n;
    const u = () => BigInt.asUintN(bits, val);
    const show = b => b === 10 ? val.toString() : u().toString(b).toUpperCase();
    const group = (s, k) => s.replace(new RegExp('\\B(?=(.{' + k + '})+$)', 'g'), ' ');
    v.innerHTML = '<div class="au-panel"><div class="au-row"><span class="au-seg" id="ab-b">' + [16, 10, 8, 2].map(b => '<button data-b="' + b + '" class="' + (B.b === b ? 'on' : '') + '">' + BN[b][0] + '</button>').join('') + '</span><input class="au-f" id="ab-v" value="' + esc(B.v) + '" style="flex:1;font-size:20px;min-width:160px"><span class="au-small">' + bits + '-bit, signed</span></div>' +
      '<div id="ab-all" style="margin-top:10px;display:grid;grid-template-columns:52px 1fr;gap:4px 10px;font:600 16px Cascadia Mono,Consolas,monospace"></div></div>' +
      '<div class="au-panel"><div class="au-small" style="margin-bottom:6px">Bits (click one to flip it). Bit 0 is on the right.</div><div id="ab-bits" style="display:flex;flex-wrap:wrap;gap:3px"></div></div>' +
      '<div class="au-panel"><div class="au-row"><span class="au-small">Second value (' + BN[B.b][0] + ')</span><input class="au-f" id="ab-o" value="' + esc(B.o) + '" style="width:140px">' + ['AND', 'OR', 'XOR', 'NAND', 'NOR', 'NOT', '<<', '>>', '+', '−', '×', '÷', 'mod'].map(o => '<button class="au-btn" data-op="' + o + '">' + o + '</button>').join('') + '</div><div class="au-small" id="ab-msg" style="margin-top:6px">The result replaces the value above. NOT and the shifts use the word size from Settings.</div></div>';
    const draw = () => {
      q(v, '#ab-all').innerHTML = [16, 10, 8, 2].map(b => '<span style="color:#f3cf6e;font-family:Segoe UI;font-size:12px;align-self:center">' + BN[b][0] + '</span><span style="word-break:break-all;color:' + (b === B.b ? '#fff' : '#b9c7e4') + '">' + esc(b === 2 ? group(show(2), 4) : b === 16 ? group(show(16), 4) : show(b)) + '</span>').join('');
      const s = u().toString(2).padStart(bits, '0');
      q(v, '#ab-bits').innerHTML = [...s].map((ch, i) => { const bit = bits - 1 - i; return '<span data-bit="' + bit + '" title="bit ' + bit + '" style="width:22px;height:28px;display:inline-flex;align-items:center;justify-content:center;border-radius:6px;cursor:pointer;font:600 13px Cascadia Mono,Consolas;' + (ch === '1' ? 'background:linear-gradient(180deg,#f6d77d,#d9a233);color:#1b1407' : 'background:rgba(255,255,255,.05);color:#6c7896') + (bit % 4 === 0 && bit ? ';margin-right:6px' : '') + '">' + ch + '</span>'; }).join('');
    };
    const setVal = n => { val = BigInt.asIntN(bits, n); B.v = show(B.b); q(v, '#ab-v').value = B.v; AU.save(); draw(); };
    q(v, '#ab-v').oninput = e => { const n = parse(e.target.value, B.b); if (n === null) { e.target.style.borderColor = '#ff6b81'; return; } e.target.style.borderColor = ''; val = n; B.v = e.target.value; AU.save(); draw(); };
    q(v, '#ab-o').oninput = e => { B.o = e.target.value; AU.save(); };
    v.onclick = e => {
      const b = e.target.closest('[data-b]'), bit = e.target.closest('[data-bit]'), op = e.target.closest('[data-op]');
      if (b) { const o = parse(B.o, B.b); B.b = +b.dataset.b; B.v = show(B.b); if (o !== null) B.o = B.b === 10 ? o.toString() : BigInt.asUintN(bits, o).toString(B.b).toUpperCase(); AU.save(); apps.base(v); return; }
      if (bit) { setVal(u() ^ (1n << BigInt(bit.dataset.bit))); return; }
      if (op) { const o = op.dataset.op, w = parse(B.o, B.b), msg = q(v, '#ab-msg'); if (o !== 'NOT' && w === null) { msg.textContent = 'Type a second value in ' + BN[B.b][0] + ' first.'; msg.style.color = '#ff8a9a'; return; } msg.style.color = ''; msg.textContent = 'Done: ' + o + '.';
        if ((o === '÷' || o === 'mod') && w === 0n) { msg.textContent = 'Cannot divide by 0.'; msg.style.color = '#ff8a9a'; return; }
        const r = { AND: () => val & w, OR: () => val | w, XOR: () => val ^ w, NAND: () => ~(val & w), NOR: () => ~(val | w), NOT: () => ~val, '<<': () => val << w, '>>': () => BigInt.asUintN(bits, val) >> w, '+': () => val + w, '−': () => val - w, '×': () => val * w, '÷': () => val / w, mod: () => val % w }[o](); setVal(r); }
    };
    draw();
  };

  /* ================= Units ================= */
  apps.units = v => {
    const U = S.units, dims = A.calc && A.calc.dims ? A.calc.dims() : {};
    if (!dims.temperature && A.calc && A.calc.convert(0, 'c', 'f') === 32) dims.temperature = ['c', 'f', 'k'];
    const cats = Object.keys(dims).filter(c => dims[c].length > 1); if (!cats.length) { v.innerHTML = '<div class="au-empty">Unit conversion is not available.</div>'; return; }
    if (!cats.includes(U.cat)) U.cat = cats.includes('length') ? 'length' : cats[0];
    const uniq = c => { const ks = dims[c], seen = [], out = []; for (const k of ks.slice().sort((a, b) => a.length - b.length)) { const val = A.calc.convert(1, k, ks[0]); if (val == null) continue; if (seen.some(s => Math.abs(s - val) <= 1e-12 * Math.abs(val))) continue; seen.push(val); out.push(k); } return out; };
    const units = uniq(U.cat), PAIR = { length: ['m', 'ft'], mass: ['kg', 'lb'], volume: ['l', 'gal'], temperature: ['c', 'f'], speed: ['km/h', 'mph'], area: ['m2', 'ft2'], time: ['h', 'min'], data: ['mb', 'gb'] }[U.cat] || [];
    if (!units.includes(U.a)) U.a = units.includes(PAIR[0]) ? PAIR[0] : units[0]; if (!units.includes(U.b)) U.b = units.includes(PAIR[1]) ? PAIR[1] : units[1] || units[0];
    const nice = s => s.charAt(0).toUpperCase() + s.slice(1);
    v.innerHTML = '<div class="au-panel"><div class="au-row" style="margin-bottom:10px">' + cats.map(c => '<button class="au-btn' + (c === U.cat ? ' on' : '') + '" data-c="' + esc(c) + '">' + esc(nice(c)) + '</button>').join('') + '</div>' +
      '<div class="au-row"><input class="au-f" id="au-uv" value="' + esc(U.v) + '" style="width:150px;font-size:20px"><select class="au-f" id="au-ua">' + units.map(x => '<option' + (x === U.a ? ' selected' : '') + '>' + esc(x) + '</option>').join('') + '</select><button class="au-btn" id="au-sw" title="Swap">⇄</button><select class="au-f" id="au-ub">' + units.map(x => '<option' + (x === U.b ? ' selected' : '') + '>' + esc(x) + '</option>').join('') + '</select></div>' +
      '<div id="au-ur" style="font:600 30px Segoe UI Variable Display,Segoe UI;margin:14px 2px 4px;color:#fff"></div><div class="au-small">Values can be sums, like 5280/3 or 2.5e3.</div></div><div class="au-panel" style="max-height:260px;overflow:auto"><table class="au-lib" id="au-ut"></table></div>';
    const go = () => {
      let x; try { const c = E.ctxOf(S.st); x = E.N(E.ev(E.parse(q(v, '#au-uv').value, c), c)); } catch (e) { q(v, '#au-ur').textContent = '—'; return; }
      U.v = q(v, '#au-uv').value; U.a = q(v, '#au-ua').value; U.b = q(v, '#au-ub').value; AU.save();
      const r = A.calc.convert(x, U.a, U.b); q(v, '#au-ur').textContent = r == null ? '—' : E.fmtNum(x, 10) + ' ' + U.a + ' = ' + E.fmtNum(r, 10) + ' ' + U.b;
      q(v, '#au-ut').innerHTML = units.map(k => '<tr><td style="color:#9fe0ff">' + esc(k) + '</td><td style="text-align:right">' + esc(E.fmtNum(A.calc.convert(x, U.a, k), 10)) + '</td></tr>').join('');
    };
    q(v, '#au-uv').oninput = go; q(v, '#au-ua').onchange = go; q(v, '#au-ub').onchange = go;
    q(v, '#au-sw').onclick = () => { [U.a, U.b] = [q(v, '#au-ub').value, q(v, '#au-ua').value]; AU.save(); apps.units(v); };
    v.onclick = e => { const c = e.target.closest('[data-c]'); if (c) { U.cat = c.dataset.c; U.a = ''; U.b = ''; AU.save(); apps.units(v); } };
    go();
  };
})();

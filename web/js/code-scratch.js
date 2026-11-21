// Coding › Playground: Scratch, as blocks.
// The script is kept as plain text (one block per line, indented inside repeat/forever), so it saves, loads and can be
// read by the lessons like any other language. The editor here is the block palette; ▶ Run on the screen compiles the
// blocks to JavaScript and runs them in the sandboxed Screen (web/js/code-stage.js), where the sprite moves, draws with a
// pen and talks. Everything is local: no network, no files, no plugins.
(() => {
  'use strict';

  /* every block: how it is written in the script text, how it looks, and its default values */
  const OPS = {
    'when flag clicked': { hat: 1, g: 'Events', label: '🏳 when flag clicked', pal: '🏳 when flag clicked' },
    'when key pressed': { hat: 1, g: 'Events', label: '⌨ when key pressed', pal: '⌨ when key pressed', key: 'a' },
    move: { g: 'Motion', label: 'move ... steps', pal: '➡ move 10 steps', n: 10 },
    turn: { g: 'Motion', label: 'turn ... degrees', pal: '🔄 turn 15 degrees', n: 15 },
    goto: { g: 'Motion', label: 'go to x ... y ...', pal: '🎯 go to x 0 y 0', n: 0, m: 0 },
    bounce: { g: 'Motion', label: 'if on edge, bounce', pal: '🧱 if on edge, bounce' },
    say: { g: 'Looks', label: 'say ...', pal: '💬 say Hello!', text: 'Hello!', n: 1 },
    color: { g: 'Looks', label: 'change colour by ...', pal: '🌈 change colour by 25', n: 25 },
    wait: { g: 'Control', label: 'wait ... seconds', pal: '⏱ wait 1 seconds', n: 1 },
    repeat: { g: 'Control', label: 'repeat ...', pal: '🔁 repeat 4', n: 4, body: 1 },
    forever: { g: 'Control', label: 'forever', pal: '♾ forever', body: 1 },
    pendown: { g: 'Pen', label: 'pen down', pal: '🖊 pen down' },
    penup: { g: 'Pen', label: 'pen up', pal: '⬜ pen up' },
  };
  const GROUPS = ['Events', 'Motion', 'Looks', 'Control', 'Pen'];
  const NUM = (v, d) => { const n = Number(String(v == null ? d : v).replace(',', '.')); return isFinite(n) ? n : d; };
  const esc = t => String(t == null ? '' : t).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));

  /* ----- script text <-> blocks ----- */
  function parse(text) {
    const root = [];
    const stack = [{ indent: -1, list: root }];
    for (const raw of String(text == null ? '' : text).replace(/\r\n?/g, '\n').split('\n')) {
      if (!raw.trim() || /^\s*\/\//.test(raw)) continue;
      const indent = raw.match(/^\s*/)[0].length;
      const b = parseLine(raw.trim());
      if (!b) continue;
      const hat = !!OPS[b.op].hat;
      while (stack.length > 1 && indent <= stack[stack.length - 1].indent) stack.pop();
      /* a hat starts its own script: the next hat ends it, however the lines are indented */
      if (hat) while (stack.length > 1 && stack[stack.length - 1].hat) stack.pop();
      stack[stack.length - 1].list.push(b);
      if (b.body) stack.push({ indent: hat ? indent - 1 : indent, list: b.body, hat });
    }
    return root;
  }

  function parseLine(line) {
    let m;
    if (/^when flag clicked$/i.test(line)) return { op: 'when flag clicked', body: [] };
    if ((m = /^when key (.+) pressed$/i.exec(line))) return { op: 'when key pressed', key: m[1].trim() || 'a', body: [] };
    if ((m = /^move (-?[\d.]+) steps?$/i.exec(line))) return { op: 'move', n: NUM(m[1], 10) };
    if ((m = /^turn (-?[\d.]+) degrees?$/i.exec(line))) return { op: 'turn', n: NUM(m[1], 15) };
    if ((m = /^go to x (-?[\d.]+) y (-?[\d.]+)$/i.exec(line))) return { op: 'goto', n: NUM(m[1], 0), m: NUM(m[2], 0) };
    if (/^if on edge,? bounce$/i.test(line)) return { op: 'bounce' };
    if ((m = /^say (.+?) for (-?[\d.]+)(?: seconds?)?$/i.exec(line))) return { op: 'say', text: m[1], n: NUM(m[2], 1) };
    if ((m = /^say (.+)$/i.exec(line))) return { op: 'say', text: m[1], n: 1 };
    if ((m = /^change colou?r by (-?[\d.]+)$/i.exec(line))) return { op: 'color', n: NUM(m[1], 25) };
    if ((m = /^wait (-?[\d.]+)(?: seconds?)?$/i.exec(line))) return { op: 'wait', n: NUM(m[1], 1) };
    if ((m = /^repeat (-?[\d.]+)$/i.exec(line))) return { op: 'repeat', n: NUM(m[1], 4), body: [] };
    if (/^forever$/i.test(line)) return { op: 'forever', body: [] };
    if (/^pen down$/i.test(line)) return { op: 'pendown' };
    if (/^pen up$/i.test(line)) return { op: 'penup' };
    return null;
  }

  function lineOf(b) {
    switch (b.op) {
      case 'when flag clicked': return 'when flag clicked';
      case 'when key pressed': return 'when key ' + (String(b.key || 'a').trim() || 'a') + ' pressed';
      case 'move': return 'move ' + NUM(b.n, 10) + ' steps';
      case 'turn': return 'turn ' + NUM(b.n, 15) + ' degrees';
      case 'goto': return 'go to x ' + NUM(b.n, 0) + ' y ' + NUM(b.m, 0);
      case 'bounce': return 'if on edge, bounce';
      case 'say': return 'say ' + String(b.text == null ? 'Hello!' : b.text).replace(/\s*\n\s*/g, ' ') + ' for ' + Math.max(0, NUM(b.n, 1));
      case 'color': return 'change color by ' + NUM(b.n, 25);
      case 'wait': return 'wait ' + Math.max(0, NUM(b.n, 1)) + ' seconds';
      case 'repeat': return 'repeat ' + Math.max(0, Math.round(NUM(b.n, 4)));
      case 'forever': return 'forever';
      case 'pendown': return 'pen down';
      case 'penup': return 'pen up';
      default: return '';
    }
  }

  function stringify(blocks, depth) {
    const out = [];
    for (const b of blocks || []) {
      out.push('  '.repeat(depth || 0) + lineOf(b));
      if (b.body) out.push(...stringify(b.body, (depth || 0) + 1));
    }
    return out;
  }
  const text = blocks => { const s = stringify(blocks, 0); return s.length ? s.join('\n') + '\n' : ''; };

  /* ----- blocks -> the page that runs in the Screen ----- */
  const RUNTIME = String.raw`
var W = 480, H = 360;
document.documentElement.style.background = '#0b0f1a';
document.body.style.cssText = 'margin:0;height:100vh;display:flex;align-items:center;justify-content:center;background:#0b0f1a;overflow:hidden';
var c = document.createElement('canvas'); c.width = W; c.height = H;
c.style.cssText = 'max-width:100%;max-height:100%;display:block;border-radius:8px;background:#121a2b';
document.body.appendChild(c);
var ctx = c.getContext('2d');
var trail = document.createElement('canvas'); trail.width = W; trail.height = H;
var tctx = trail.getContext('2d');
var S = { x: 0, y: 0, dir: 90, hue: 200, pen: false, say: '', stopped: false };
var flagHats = [], keyHats = {}, running = 0;
function px() { return W / 2 + S.x; }
function py() { return H / 2 - S.y; }
function penLine(x1, y1, x2, y2) {
  tctx.strokeStyle = 'hsl(' + S.hue + ',90%,62%)'; tctx.lineWidth = 3; tctx.lineCap = 'round';
  tctx.beginPath(); tctx.moveTo(x1, y1); tctx.lineTo(x2, y2); tctx.stroke();
}
function draw() {
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#121a2b'; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = 'rgba(255,255,255,.045)'; ctx.lineWidth = 1;
  for (var gx = 0; gx <= W; gx += 40) { ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, H); ctx.stroke(); }
  for (var gy = 0; gy <= H; gy += 40) { ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(W, gy); ctx.stroke(); }
  ctx.drawImage(trail, 0, 0);
  ctx.save();
  ctx.translate(px(), py()); ctx.rotate((S.dir - 90) * Math.PI / 180);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = 'hsl(' + S.hue + ',85%,62%)';
  ctx.beginPath(); ctx.arc(0, 0, 22, 0, Math.PI * 2); ctx.fill();
  ctx.font = '34px "Segoe UI Emoji","Apple Color Emoji",serif';
  ctx.fillText('\uD83D\uDC31', 0, 2);
  ctx.restore();
  if (S.say) {
    ctx.font = '600 14px system-ui,sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    var pad = 8, tw = Math.min(W - 24, ctx.measureText(S.say).width);
    var bx = Math.min(W - tw - pad * 2 - 8, Math.max(8, px() - tw / 2 - pad)), by = Math.max(8, py() - 76);
    ctx.fillStyle = 'rgba(255,255,255,.96)';
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(bx, by, tw + pad * 2, 30, 8); else ctx.rect(bx, by, tw + pad * 2, 30);
    ctx.fill();
    ctx.beginPath(); ctx.moveTo(px() - 6, by + 30); ctx.lineTo(px() + 6, by + 30); ctx.lineTo(px(), by + 38); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#121a2b'; ctx.fillText(S.say, bx + pad, by + 16);
  }
}
function frame() { return new Promise(function (r) { requestAnimationFrame(r); }); }
async function tick() { if (S.stopped) throw 'stop'; await frame(); if (S.stopped) throw 'stop'; }
var api = {
  tick: tick,
  wait: async function (sec) {
    var end = performance.now() + Math.max(0, sec) * 1000;
    while (performance.now() < end) { await tick(); draw(); }
  },
  move: async function (n) {
    var r = S.dir * Math.PI / 180, x0 = px(), y0 = py();
    S.x += Math.cos(r) * n; S.y += Math.sin(r) * n;
    if (S.pen) penLine(x0, y0, px(), py());
    await tick(); draw();
  },
  turn: async function (n) { S.dir = ((S.dir + n) % 360 + 360) % 360; await tick(); draw(); },
  goto: async function (x, y) {
    var x0 = px(), y0 = py(); S.x = x; S.y = y;
    if (S.pen) penLine(x0, y0, px(), py());
    await tick(); draw();
  },
  bounce: async function () {
    if (Math.abs(S.x) > W / 2 - 14) { S.dir = 180 - S.dir; S.x = Math.max(-W / 2 + 14, Math.min(W / 2 - 14, S.x)); }
    if (Math.abs(S.y) > H / 2 - 14) { S.dir = -S.dir; S.y = Math.max(-H / 2 + 14, Math.min(H / 2 - 14, S.y)); }
    await tick(); draw();
  },
  say: async function (t, sec) {
    S.say = String(t == null ? '' : t).slice(0, 120);
    try { console.log(S.say); } catch (e) { }
    if (sec > 0) await api.wait(sec);
    else { var until = performance.now() + 1600; while (performance.now() < until) { await tick(); draw(); } }
    S.say = '';
    draw();
  },
  color: async function (n) { S.hue = ((S.hue + n) % 360 + 360) % 360; await tick(); draw(); },
  pen: function (on) { S.pen = !!on; }
};
function keyName(k) {
  k = String(k || '').toLowerCase();
  if (k === 'space' || k === ' ') return ' ';
  if (/^(up|arrowup)$/.test(k)) return 'ArrowUp';
  if (/^(down|arrowdown)$/.test(k)) return 'ArrowDown';
  if (/^(left|arrowleft)$/.test(k)) return 'ArrowLeft';
  if (/^(right|arrowright)$/.test(k)) return 'ArrowRight';
  return k;
}
window.addEventListener('keydown', function (e) {
  var k = keyName(e.key);
  var hats = keyHats[k];
  if (!hats || !hats.length) return;
  if (e.key === ' ' || /^Arrow/.test(e.key)) e.preventDefault();
  hats.forEach(function (h) { run(h); });
});
window.addEventListener('message', function (e) { if (e.data && e.data.msStop) S.stopped = true; });
async function run(fn) {
  running++;
  try { await fn(); } catch (e) { }
  running = Math.max(0, running - 1);
  if (!running) { try { parent.postMessage({ msStage: 'done' }, '*'); } catch (e) { } }
}
var S_api2 = {
  api: api,
  onFlag: function (fn) { flagHats.push(fn); },
  onKey: function (k, fn) { var n = keyName(k); (keyHats[n] = keyHats[n] || []).push(fn); },
  ready: function () {
    draw();
    if (!flagHats.length) { try { parent.postMessage({ msStage: 'done' }, '*'); } catch (e) { } }
    flagHats.forEach(function (h) { run(h); });
  }
};
`;

  const bodyJs = list => (list || []).map(statement).join('');
  const statement = b => {
    const a = 'S.api';
    switch (b.op) {
      case 'move': return 'await ' + a + '.move(' + NUM(b.n, 10) + ');';
      case 'turn': return 'await ' + a + '.turn(' + NUM(b.n, 15) + ');';
      case 'goto': return 'await ' + a + '.goto(' + NUM(b.n, 0) + ',' + NUM(b.m, 0) + ');';
      case 'bounce': return 'await ' + a + '.bounce();';
      case 'say': return 'await ' + a + '.say(' + JSON.stringify(String(b.text == null ? '' : b.text)) + ',' + Math.max(0, NUM(b.n, 1)) + ');';
      case 'color': return 'await ' + a + '.color(' + NUM(b.n, 25) + ');';
      case 'wait': return 'await ' + a + '.wait(' + Math.max(0, NUM(b.n, 1)) + ');';
      case 'repeat': return 'for (var i' + b._n + ' = 0; i' + b._n + ' < ' + Math.max(0, Math.round(NUM(b.n, 4))) + '; i' + b._n + '++) {' + bodyJs(b.body) + 'await S.api.tick(); }';
      case 'forever': return 'while (true) {' + bodyJs(b.body) + 'await S.api.tick(); }';
      case 'pendown': return a + '.pen(true);';
      case 'penup': return a + '.pen(false);';
      default: return '';
    }
  };
  function nameLoops(blocks, n) {
    for (const b of blocks || []) { if (b.op === 'repeat') b._n = '_' + (n = (n || 0) + 1); if (b.body) n = nameLoops(b.body, n); }
    return n;
  }

  /* compile the blocks into a page for the Screen (CodeStage.page adds the console bridge and the no-network CSP) */
  function compile(blocks) {
    const list = blocks || [];
    nameLoops(list, 0);
    const hatsJs = list.filter(b => b.op === 'when flag clicked' || b.op === 'when key pressed').map(h => h.op === 'when flag clicked'
      ? 'S.onFlag(async function () {' + bodyJs(h.body) + '});'
      : 'S.onKey(' + JSON.stringify(String(h.key || 'a')) + ', async function () {' + bodyJs(h.body) + '});').join('\n');
    return RUNTIME + '\nvar S = S_api2;\n' + (hatsJs || '/* add a 🏳 block to start */') + '\nS.ready();';
  }
  const program = blocksOrText => compile(typeof blocksOrText === 'string' ? parse(blocksOrText) : blocksOrText);

  /* ----- the block editor ----- */
  /* Scratch's block colours, so the palette reads like the real thing */
  const COLORS = { Events: '#d9a300', Motion: '#4c97ff', Looks: '#9966ff', Control: '#ffab19', Pen: '#0fbd8c' };
  const CSS = [
    '.sb-wrap{display:flex;gap:12px;align-items:flex-start;flex-wrap:wrap;margin-top:8px}',
    '.sb-palette{display:grid;gap:6px;min-width:196px;flex:0 1 220px}',
    '.sb-grp{display:grid;gap:5px;padding:7px;border:1px solid var(--line);border-radius:10px;background:var(--panel2)}',
    '.sb-grp b{font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:var(--mute)}',
    '.sb-pal{text-align:left;border:0;border-left:4px solid var(--sb,#4c97ff);background:var(--sb,#4c97ff);color:#fff;border-radius:7px;padding:6px 9px;font-size:12.5px;font-weight:600;cursor:grab;box-shadow:0 1px 0 rgba(0,0,0,.25) inset}',
    '.sb-pal:hover{filter:brightness(1.12)}',
    '.sb-pal:active{cursor:grabbing}',
    '.sb-script{flex:1 1 320px;min-width:280px;display:flex;flex-direction:column;gap:0;align-content:start;padding:2px}',
    '.sb-row{display:flex;align-items:center;gap:6px;border:0;border-left:4px solid var(--sb,#4c97ff);background:var(--sb,#4c97ff);color:#fff;border-radius:8px;padding:6px 9px;cursor:grab;box-shadow:0 1px 0 rgba(0,0,0,.28) inset}',
    '.sb-row:active{cursor:grabbing}',
    '.sb-row .sb-lab{flex:1;min-width:0;font-size:13px;font-weight:600;display:flex;align-items:center;gap:5px;flex-wrap:wrap}',
    '.sb-row .sb-lab .small.mute{color:rgba(255,255,255,.85)}',
    '.sb-row.drag{opacity:.35}',
    '.sb-row.on{outline:2px dashed var(--acc,#7fd1ff);outline-offset:1px}',
    '.sb-pal.drag{opacity:.35}',
    '.sb-row.sel{outline:2px solid #fff;outline-offset:-2px}',
    '.sb-x{border:0;background:rgba(0,0,0,.18);color:#fff;cursor:pointer;font-size:11px;border-radius:4px;padding:0 4px;line-height:16px}',
    '.sb-x:hover{background:rgba(0,0,0,.45)}',
    '.sb-in{background:#fff;color:#111;border:1px solid rgba(0,0,0,.35);border-radius:12px;padding:1px 7px;font-size:12.5px;font-weight:600}',
    '.sb-in.say{width:130px}.sb-in.key{width:52px}.sb-in.num{width:52px}',
    '.sb-drop{height:12px;border-radius:6px;margin:1px 0 1px 12px;transition:background .08s,height .08s}',
    '.sb-drop.on{background:var(--acc,#7fd1ff);height:9px}',
    '.sb-body{margin-left:16px;border-left:2px dashed rgba(255,255,255,.22);padding-left:9px;display:flex;flex-direction:column;gap:0}',
    '.sb-body.on{outline:1px dashed var(--acc,#7fd1ff);border-radius:6px}',
    '.sb-empty{border:1px dashed rgba(255,255,255,.3);border-radius:7px;padding:6px;text-align:center;color:rgba(255,255,255,.8)}',
    '.sb-empty2{border:1px dashed var(--line);border-radius:8px;padding:16px;text-align:center;color:var(--mute);font-size:13px}',
  ].join('');
  function styles() {
    if (document.getElementById('code-scratch-css')) return;
    const s = document.createElement('style'); s.id = 'code-scratch-css'; s.textContent = CSS; document.head.appendChild(s);
  }

  function editor(host, ta, options) {
    if (!host || !ta) return null;
    styles();
    /* with no click yet, the next block goes at the end of the last script (inside its hat), not loose at the bottom */
    const endSel = list => { const hats = list.filter(b => OPS[b.op].hat), last = hats[hats.length - 1]; return last ? { list: last.body, i: last.body.length } : { list, i: list.length }; };
    let model = parse(ta.value);
    let sel = endSel(model);
    let lastValue = ta.value, writing = false;
    const rows = [];   // every block, in paint order, for the inputs and ✕ buttons
    let anchors = [];  // every place a block can be dropped, as { list, i } insertion points
    let drag = null;   // what is being dragged: { op } from the palette, or { block, list } from the script
    let hot = null;    // the drop target under the pointer, highlighted while dragging

    function writeText(repaint) {
      const v = text(model);
      if (v !== ta.value) {
        writing = true;
        ta.value = v;
        ta.dispatchEvent(new Event('input', { bubbles: true }));
        writing = false;
      }
      lastValue = ta.value;
      if (repaint !== false) paint();
    }

    const innerOf = (b, idx) => {
      if (b.op === 'say') return '<input class="sb-in say" data-sb="arg" data-k="text" data-i="' + idx + '" value="' + esc(b.text) + '" aria-label="What to say"> <span class="small mute">for</span> <input class="sb-in num" data-sb="arg" data-k="n" data-i="' + idx + '" value="' + esc(b.n) + '" aria-label="Seconds"> <span class="small mute">s</span>';
      if (b.op === 'when key pressed') return '<span class="small mute">key</span> <input class="sb-in key" data-sb="arg" data-k="key" data-i="' + idx + '" value="' + esc(b.key) + '" aria-label="Key">';
      if (b.op === 'goto') return '<span class="small mute">x</span> <input class="sb-in num" data-sb="arg" data-k="n" data-i="' + idx + '" value="' + esc(b.n) + '" aria-label="X"> <span class="small mute">y</span> <input class="sb-in num" data-sb="arg" data-k="m" data-i="' + idx + '" value="' + esc(b.m) + '" aria-label="Y">';
      if (OPS[b.op].n !== undefined) return '<input class="sb-in num" data-sb="arg" data-k="n" data-i="' + idx + '" value="' + esc(b.n) + '" aria-label="Number">';
      return '';
    };

    function paint() {
      rows.length = 0;
      anchors = [];
      hot = null;
      const palette = GROUPS.map(g => '<div class="sb-grp"><b>' + g + '</b>' +
        Object.keys(OPS).filter(k => OPS[k].g === g).map(k => '<button type="button" class="sb-pal" draggable="true" style="--sb:' + COLORS[g] + '" data-sb="add" data-op="' + k + '" title="Drag this block into the script (or click to add it)">' + esc(OPS[k].pal) + '</button>').join('') + '</div>').join('');
      /* a thin strip between blocks: drop on it to put a block exactly there */
      const dropAt = (list, i) => '<div class="sb-drop" data-sb="drop" data-d="' + (anchors.push({ list, i }) - 1) + '"></div>';
      const render = blocks => {
        let out = '';
        blocks.forEach((b, i) => {
          out += dropAt(blocks, i);
          const idx = rows.push(b) - 1;
          const isSel = sel.list === blocks && sel.i === i + 1;
          const inner = innerOf(b, idx);
          const label = OPS[b.op].label.replace('...', '').trim();
          const body = b.body
            ? '<div class="sb-body" data-sb="body" data-i="' + idx + '">' + (b.body.length ? render(b.body)
              : '<div class="small mute sb-empty" data-sb="into" data-i="' + idx + '">drop blocks here</div>') + '</div>'
            : '';
          out += '<div class="sb-row' + (isSel ? ' sel' : '') + '" draggable="true" style="--sb:' + COLORS[OPS[b.op].g] + '"' +
            ' data-sb="pick" data-i="' + idx + '" data-g="' + OPS[b.op].g + '">' +
            '<span class="sb-lab' + (OPS[b.op].hat ? ' hat' : '') + '">' + esc(label) + (inner ? ' ' + inner : '') + '</span>' +
            '<button type="button" class="sb-x" data-sb="del" data-i="' + idx + '" title="Delete this block">✕</button></div>' + body;
        });
        return out + dropAt(blocks, blocks.length);
      };
      let script;
      if (model.length) script = render(model);
      else {
        const d = anchors.push({ list: model, i: 0 }) - 1;
        script = '<div class="sb-empty2" data-sb="drop" data-d="' + d + '">Drag blocks here to begin — start with <b>🏳 when flag clicked</b>, then a move or a say.</div>';
      }
      host.innerHTML = '<div class="sb-wrap"><div class="sb-palette">' + palette + '</div>' +
        '<div class="sb-script" data-sb="script">' + script +
        '<div class="small mute" style="margin-top:8px">Drag blocks from the left into the script. Drag a block in the script to move it, and drop it inside 🔁 repeat or ♾ forever to nest it. ▶ Run on the screen starts the script.</div></div></div>';
    }

    function blockFor(op) {
      const base = OPS[op], b = { op };
      if (base.n !== undefined) b.n = base.n;
      if (base.m !== undefined) b.m = base.m;
      if (base.text !== undefined) b.text = base.text;
      if (base.key !== undefined) b.key = base.key;
      if (base.body) b.body = [];
      return b;
    }

    function insertAt(op, at) {
      if (!OPS[op]) return;
      const b = blockFor(op);
      const list = Array.isArray(at.list) ? at.list : model;
      const i = Math.max(0, Math.min(at.i == null ? list.length : at.i, list.length));
      list.splice(i, 0, b);
      sel = b.body ? { list: b.body, i: 0 } : { list, i: i + 1 };
      writeText();
    }

    const insert = op => insertAt(op, sel);

    /* is this list inside that block? (so a loop can never be dropped into its own body) */
    function holds(block, list) {
      if (!block || !block.body) return false;
      if (block.body === list) return true;
      return block.body.some(child => holds(child, list));
    }

    /* dragging a block that already exists: take it out of its list, then put it where it was dropped */
    function moveTo(at, block, fromList) {
      if (!at || !Array.isArray(at.list) || holds(block, at.list)) return;
      const from = fromList.indexOf(block);
      if (from < 0) return;
      let i = Math.max(0, Math.min(at.i == null ? at.list.length : at.i, at.list.length));
      fromList.splice(from, 1);
      if (fromList === at.list && from < i) i--;
      at.list.splice(Math.max(0, Math.min(i, at.list.length)), 0, block);
      sel = { list: at.list, i: at.list.indexOf(block) + 1 };
      writeText();
    }

    /* what a DOM element under the pointer means as a drop position */
    function anchorOf(el) {
      if (!el || !el.dataset) return null;
      if (el.dataset.sb === 'drop') return anchors[+el.dataset.d] || null;
      if (el.dataset.sb === 'into') { const b = rows[+el.dataset.i]; return b && b.body ? { list: b.body, i: 0 } : null; }
      if (el.dataset.sb === 'body') { const b = rows[+el.dataset.i]; return b && b.body ? { list: b.body, i: b.body.length } : null; }
      if (el.dataset.sb === 'pick') { const b = rows[+el.dataset.i], list = b && listOf(b); return list ? { list, i: list.indexOf(b) + 1 } : null; }
      if (el.dataset.sb === 'script') return { list: model, i: model.length };
      return null;
    }

    function clearHot() { if (hot) { hot.classList.remove('on'); hot = null; } }
    function setHot(el) { if (hot === el) return; clearHot(); if (!el) return; hot = el; el.classList.add('on'); }
    const dropTarget = e => e.target && e.target.closest && e.target.closest('[data-sb="drop"],[data-sb="into"],[data-sb="body"],[data-sb="pick"],[data-sb="script"]');

    /* ----- drag and drop, like Scratch: palette → script, and every block can be moved, nested or pulled back out ----- */
    host.addEventListener('dragstart', e => {
      if (e.target && e.target.closest && e.target.closest('.sb-in')) { e.preventDefault(); return; }
      const t = e.target && e.target.closest && e.target.closest('[data-sb="add"],[data-sb="pick"]');
      if (!t) return;
      if (t.dataset.sb === 'add') {
        drag = { op: t.dataset.op };
        t.classList.add('drag');
      } else {
        const b = rows[+t.dataset.i], list = b && listOf(b);
        if (!b || !list) { drag = null; return; }
        drag = { block: b, list };
        t.classList.add('drag');
      }
      try {
        e.dataTransfer.setData('text/plain', drag.op || 'move');
        e.dataTransfer.effectAllowed = drag.op ? 'copy' : 'move';
      } catch (err) { }
    });

    host.addEventListener('dragover', e => {
      if (!drag) return;
      const el = dropTarget(e), at = anchorOf(el);
      if (!at || (drag.block && holds(drag.block, at.list))) { clearHot(); return; }
      e.preventDefault();
      try { e.dataTransfer.dropEffect = drag.op ? 'copy' : 'move'; } catch (err) { }
      setHot(el);
    });

    host.addEventListener('dragleave', e => { if (!host.contains(e.relatedTarget)) clearHot(); });

    host.addEventListener('drop', e => {
      if (!drag) return;
      const el = dropTarget(e), at = anchorOf(el);
      if (!at) return;
      e.preventDefault();
      e.stopPropagation();
      const moving = drag;
      drag = null;
      clearHot();
      host.querySelectorAll('.drag').forEach(x => x.classList.remove('drag'));
      if (moving.op) insertAt(moving.op, at);
      else moveTo(at, moving.block, moving.list);
    });

    host.addEventListener('dragend', () => {
      drag = null;
      clearHot();
      host.querySelectorAll('.drag').forEach(x => x.classList.remove('drag'));
    });

    function listOf(want, list) {
      list = list || model;
      for (const b of list) {
        if (b === want) return list;
        if (b.body) { const found = listOf(want, b.body); if (found) return found; }
      }
      return null;
    }

    host.addEventListener('click', e => {
      const t = e.target.closest('[data-sb]');
      if (!t || !host.contains(t) || t.dataset.sb === 'arg') return;
      if (t.dataset.sb === 'add') { e.preventDefault(); insert(t.dataset.op); return; }
      if (t.dataset.sb === 'del') {
        e.preventDefault(); e.stopPropagation();
        const b = rows[+t.dataset.i], list = b && listOf(b);
        if (!list) return;
        const at = list.indexOf(b); list.splice(at, 1);
        sel = { list, i: Math.min(at, list.length) };
        writeText(); return;
      }
      if (t.dataset.sb === 'into') {
        e.preventDefault(); e.stopPropagation();
        const b = rows[+t.dataset.i];
        if (b && b.body) { sel = { list: b.body, i: b.body.length }; paint(); }
        return;
      }
      if (t.dataset.sb === 'pick') {
        e.preventDefault();
        const b = rows[+t.dataset.i];
        if (!b) return;
        const list = listOf(b);
        /* clicking a repeat's header means "put the next block inside it" */
        if (b.body && !e.target.closest('.sb-in')) { sel = { list: b.body, i: b.body.length }; paint(); return; }
        sel = { list, i: list.indexOf(b) + 1 };
        paint();
      }
    });

    /* typing a value must not redraw the editor under the cursor */
    host.addEventListener('input', e => {
      const inp = e.target.closest('[data-sb="arg"]');
      if (!inp) return;
      const b = rows[+inp.dataset.i];
      if (!b) return;
      b[inp.dataset.k] = inp.value;
      writeText(false);
    });

    ta.addEventListener('input', () => {
      if (writing || ta.value === lastValue) return;
      model = parse(ta.value);
      sel = endSel(model);
      lastValue = ta.value;
      paint();
    });

    paint();
    return { refresh: paint, text: () => text(model), program: () => program(model) };
  }

  window.CodeScratch = {
    OPS, GROUPS, parse, text, program,
    editor: (host, ta) => editor(host, ta),
    example: 'when flag clicked\nsay Hello from Scratch! for 2\nrepeat 4\n  move 60 steps\n  turn 90 degrees\n',
  };
})();

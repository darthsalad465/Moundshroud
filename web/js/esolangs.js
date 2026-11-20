// Coding › Playground: interpreters for esoteric languages, written for Moundshroud and run offline in a Web Worker
// (web/js/esolang-worker.js) or in the tests. Brainfuck, Ook!, COW, Befunge-93, Befunge-98 (core), ><> (Fish), Malbolge,
// Piet (as a grid of colour letters), Chicken, Whitespace, Unlambda, FALSE, Thue, Underload, Deadfish, ///, Brain-Flak,
// HQ9+, FRACTRAN and Bitwise Cyclic Tag. Each interpreter reads the program and an io object (out, byte, getc, getb,
// getn, getline, tick). tick() stops a run after its time limit; out() stops it at 64 KB of output. Word-based languages
// are in esolangs-words.js, small practical languages (Scheme, Prolog, Forth, BASIC) in minilangs.js.
(function (root) {
  'use strict';
  class Stop extends Error { }
  const OUT_MAX = 65536;
  const chr = v => { v = Number(v); return Number.isInteger(v) && v >= 0 && v <= 0x10FFFF ? String.fromCodePoint(v) : '�'; };

  function makeIO(input, ms) {
    input = String(input || '');
    const parts = [], inBytes = new TextEncoder().encode(input), limit = ms || 10000, until = Date.now() + limit;
    let size = 0, pos = 0, bpos = 0, steps = 0, bytes = [];
    const flush = () => { if (bytes.length) { parts.push(new TextDecoder().decode(new Uint8Array(bytes))); bytes = []; } };
    const grow = n => { size += n; if (size > OUT_MAX) throw new Stop('Stopped after reaching the 64 KB output limit.'); };
    return {
      out(s) { flush(); s = String(s); parts.push(s); grow(s.length); },
      byte(b) { bytes.push(((b % 256) + 256) % 256); grow(1); },
      getc() { if (pos >= input.length) return -1; const c = input.codePointAt(pos); pos += c > 0xffff ? 2 : 1; return c; },
      getb() { return bpos < inBytes.length ? inBytes[bpos++] : -1; },
      getn() {
        while (pos < input.length && !/[-+\d]/.test(input[pos])) pos++;
        const m = /^[-+]?\d+/.exec(input.slice(pos));
        if (!m) { pos = input.length; return null; }
        pos += m[0].length; if (input[pos] === '\n') pos++;
        return parseInt(m[0], 10);
      },
      getline() { if (pos >= input.length) return null; let e = input.indexOf('\n', pos); if (e < 0) e = input.length; const l = input.slice(pos, e).replace(/\r$/, ''); pos = e + 1; return l; },
      tick() { if ((++steps & 0x3FFFF) === 0 && Date.now() > until) throw new Stop('Stopped after ' + Math.round(limit / 1000) + ' seconds. The program may loop forever.'); },
      text() { flush(); return parts.join(''); },
    };
  }

  const L = {};

  /* ---------- Brainfuck family ---------- */
  function bf(ops, io) {
    const j = new Int32Array(ops.length), st = [];
    for (let i = 0; i < ops.length; i++) {
      if (ops[i] === '[') st.push(i);
      else if (ops[i] === ']') { if (!st.length) throw new Error('A ] has no matching [.'); const o = st.pop(); j[o] = i; j[i] = o; }
    }
    if (st.length) throw new Error('A [ has no matching ].');
    const t = new Uint8Array(65536); let p = 0;
    for (let i = 0; i < ops.length; i++) {
      io.tick();
      switch (ops[i]) {
        case '+': t[p]++; break;
        case '-': t[p]--; break;
        case '>': p = (p + 1) & 65535; break;
        case '<': p = (p + 65535) & 65535; break;
        case '.': io.byte(t[p]); break;
        case ',': { const c = io.getb(); if (c >= 0) t[p] = c; break; }
        case '[': if (!t[p]) i = j[i]; break;
        case ']': if (t[p]) i = j[i]; break;
      }
    }
  }
  L.bf = (code, io) => bf([...code].filter(c => '+-<>[].,'.includes(c)), io);
  L.ook = (code, io) => {
    const w = code.match(/Ook[.?!]/g) || [], map = { '. ?': '>', '? .': '<', '. .': '+', '! !': '-', '! .': '.', '. !': ',', '! ?': '[', '? !': ']' }, ops = [];
    if (w.length % 2) throw new Error('Ook! words come in pairs; there is an odd one out.');
    for (let i = 0; i < w.length; i += 2) { const k = w[i][3] + ' ' + w[i + 1][3], op = map[k]; if (!op) throw new Error('"Ook' + w[i][3] + ' Ook' + w[i + 1][3] + '" is not an Ook! instruction.'); ops.push(op); }
    bf(ops, io);
  };
  /* COW: 12 moos. MOO/moo form a loop; mOO runs the instruction whose number is in the current cell. */
  L.cow = (code, io) => {
    const names = ['moo', 'mOo', 'moO', 'mOO', 'Moo', 'MOo', 'MoO', 'MOO', 'OOO', 'MMM', 'OOM', 'oom'];
    const p = (code.match(/[mMoO]{3}/g) || []).map(w => names.indexOf(w)).filter(n => n >= 0);
    const j = new Int32Array(p.length), st = [];
    for (let i = 0; i < p.length; i++) { if (p[i] === 7) st.push(i); else if (p[i] === 0) { if (!st.length) throw new Error('A moo has no matching MOO.'); const o = st.pop(); j[o] = i; j[i] = o; } }
    if (st.length) throw new Error('A MOO has no matching moo.');
    const m = [0]; let mp = 0, reg = null;
    const exec = (op, i) => {
      switch (op) {
        case 0: return j[i] - 1;
        case 1: if (mp === 0) throw new Error('The memory pointer moved left of the first cell.'); mp--; break;
        case 2: mp++; if (m.length <= mp) m.push(0); break;
        case 3: if (m[mp] === 3 || m[mp] < 0 || m[mp] > 11) return -2; return exec(m[mp], i);
        case 4: if (m[mp] === 0) { const c = io.getc(); m[mp] = c < 0 ? 0 : c; } else io.out(chr(m[mp])); break;
        case 5: m[mp]--; break;
        case 6: m[mp]++; break;
        case 7: if (m[mp] === 0) return j[i]; break;
        case 8: m[mp] = 0; break;
        case 9: if (reg === null) reg = m[mp]; else { m[mp] = reg; reg = null; } break;
        case 10: io.out(m[mp] + '\n'); break;
        case 11: { const n = io.getn(); m[mp] = n === null ? 0 : n; break; }
      }
      return i;
    };
    for (let i = 0; i < p.length; i++) { io.tick(); const r = exec(p[i], i); if (r === -2) return; i = r; }
  };

  /* ---------- Befunge-93: 80 x 25 torus ---------- */
  L.befunge93 = (code, io) => {
    const W = 80, H = 25, lines = code.replace(/\r/g, '').split('\n'), g = [];
    for (let y = 0; y < H; y++) { const row = new Array(W).fill(32), l = lines[y] || ''; for (let x = 0; x < Math.min(W, l.length); x++) row[x] = l.charCodeAt(x); g.push(row); }
    const s = [], pop = () => s.length ? s.pop() : 0;
    let x = 0, y = 0, dx = 1, dy = 0, str = false;
    for (;;) {
      io.tick();
      const c = g[y][x], ch = String.fromCharCode(c);
      if (str) { if (ch === '"') str = false; else s.push(c); }
      else switch (ch) {
        case ' ': break;
        case '+': s.push(pop() + pop()); break;
        case '-': { const a = pop(), b = pop(); s.push(b - a); break; }
        case '*': s.push(pop() * pop()); break;
        case '/': { const a = pop(), b = pop(); s.push(a ? Math.trunc(b / a) : 0); break; }
        case '%': { const a = pop(), b = pop(); s.push(a ? b % a : 0); break; }
        case '!': s.push(pop() ? 0 : 1); break;
        case '`': { const a = pop(), b = pop(); s.push(b > a ? 1 : 0); break; }
        case '>': dx = 1; dy = 0; break;
        case '<': dx = -1; dy = 0; break;
        case '^': dx = 0; dy = -1; break;
        case 'v': dx = 0; dy = 1; break;
        case '?': { const d = [[1, 0], [-1, 0], [0, 1], [0, -1]][Math.random() * 4 | 0]; dx = d[0]; dy = d[1]; break; }
        case '_': dx = pop() ? -1 : 1; dy = 0; break;
        case '|': dy = pop() ? -1 : 1; dx = 0; break;
        case '"': str = true; break;
        case ':': { const a = pop(); s.push(a, a); break; }
        case '\\': { const a = pop(), b = pop(); s.push(a, b); break; }
        case '$': pop(); break;
        case '.': io.out(pop() + ' '); break;
        case ',': io.out(chr(pop())); break;
        case '#': x = (x + dx + W) % W; y = (y + dy + H) % H; break;
        case 'p': { const yy = pop(), xx = pop(), v = pop(); if (yy >= 0 && yy < H && xx >= 0 && xx < W) g[yy][xx] = v; break; }
        case 'g': { const yy = pop(), xx = pop(); s.push(yy >= 0 && yy < H && xx >= 0 && xx < W ? g[yy][xx] : 0); break; }
        case '&': { const n = io.getn(); s.push(n === null ? -1 : n); break; }
        case '~': s.push(io.getc()); break;
        case '@': return;
        default:
          if (c >= 48 && c <= 57) s.push(c - 48);
          else throw new Error('"' + ch + '" is not a Befunge-93 instruction (column ' + (x + 1) + ', line ' + (y + 1) + ').');
      }
      x = (x + dx + W) % W; y = (y + dy + H) % H;
    }
  };

  /* ---------- Befunge-98 core: unbounded Lahey-space, no fingerprints, one stack ---------- */
  L.funge98 = (code, io) => {
    const sp = new Map(); let x0 = 0, y0 = 0, x1 = 0, y1 = 0, any = false;
    const key = (x, y) => x + ',' + y;
    const put = (x, y, v) => {
      if (v === 32) sp.delete(key(x, y)); else sp.set(key(x, y), v);
      if (v !== 32) { if (!any) { x0 = x1 = x; y0 = y1 = y; any = true; } x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    };
    const get = (x, y) => { const v = sp.get(key(x, y)); return v === undefined ? 32 : v; };
    code.replace(/\r/g, '').split('\n').forEach((l, y) => { for (let x = 0; x < l.length; x++) { const c = l.charCodeAt(x); if (c !== 32 && c !== 12) put(x, y, c); } });
    if (!any) return;
    const s = [], pop = () => s.length ? s.pop() : 0;
    let x = 0, y = 0, dx = 1, dy = 0, str = false;
    const inside = (a, b) => a >= x0 && a <= x1 && b >= y0 && b <= y1;
    const step = () => {
      x += dx; y += dy;
      if (!inside(x, y)) { do { x -= dx; y -= dy; } while (inside(x, y)); x += dx; y += dy; }
    };
    const reflect = () => { dx = -dx; dy = -dy; };
    const skipBlank = () => {
      for (let n = 0; n < 1e6; n++) {
        const c = get(x, y);
        if (c === 32) { step(); continue; }
        if (c === 59) { do step(); while (get(x, y) !== 59); step(); continue; }
        return;
      }
      throw new Error('The program has no instructions to run.');
    };
    const exec = c => {
      const ch = String.fromCharCode(c);
      if (c >= 48 && c <= 57) { s.push(c - 48); return; }
      if (c >= 97 && c <= 102) { s.push(c - 87); return; }
      switch (ch) {
        case '+': s.push(pop() + pop()); break;
        case '-': { const a = pop(), b = pop(); s.push(b - a); break; }
        case '*': s.push(pop() * pop()); break;
        case '/': { const a = pop(), b = pop(); s.push(a ? Math.trunc(b / a) : 0); break; }
        case '%': { const a = pop(), b = pop(); s.push(a ? b % a : 0); break; }
        case '!': s.push(pop() ? 0 : 1); break;
        case '`': { const a = pop(), b = pop(); s.push(b > a ? 1 : 0); break; }
        case '>': dx = 1; dy = 0; break;
        case '<': dx = -1; dy = 0; break;
        case '^': dx = 0; dy = -1; break;
        case 'v': dx = 0; dy = 1; break;
        case '?': { const d = [[1, 0], [-1, 0], [0, 1], [0, -1]][Math.random() * 4 | 0]; dx = d[0]; dy = d[1]; break; }
        case '_': dx = pop() ? -1 : 1; dy = 0; break;
        case '|': dy = pop() ? -1 : 1; dx = 0; break;
        case '[': { const t = dx; dx = dy; dy = -t; break; }
        case ']': { const t = dx; dx = -dy; dy = t; break; }
        case 'r': reflect(); break;
        case 'x': dy = pop(); dx = pop(); break;
        case '"': str = true; break;
        case ':': { const a = pop(); s.push(a, a); break; }
        case '\\': { const a = pop(), b = pop(); s.push(a, b); break; }
        case '$': pop(); break;
        case 'n': s.length = 0; break;
        case '.': io.out(pop() + ' '); break;
        case ',': io.out(chr(pop())); break;
        case '#': step(); break;
        case 'j': { let n = pop(); if (n < 0) { reflect(); n = -n; for (let k = 0; k < n; k++) step(); reflect(); } else for (let k = 0; k < n; k++) step(); break; }
        case "'": step(); s.push(get(x, y)); break;
        case 's': step(); put(x, y, pop()); break;
        case 'w': { const b = pop(), a = pop(); if (a < b) { const t = dx; dx = dy; dy = -t; } else if (a > b) { const t = dx; dx = -dy; dy = t; } break; }
        case 'p': { const yy = pop(), xx = pop(); put(xx, yy, pop()); break; }
        case 'g': { const yy = pop(), xx = pop(); s.push(get(xx, yy)); break; }
        case '&': { const n = io.getn(); if (n === null) reflect(); else s.push(n); break; }
        case '~': { const c2 = io.getc(); if (c2 < 0) reflect(); else s.push(c2); break; }
        case 'z': break;
        case '@': return 'stop';
        case 'q': return 'stop';
        default: reflect();
      }
    };
    for (;;) {
      io.tick();
      const c = get(x, y);
      if (str) {
        if (c === 34) str = false;
        else if (c === 32) { s.push(32); while (get(x + dx, y + dy) === 32 && inside(x + dx, y + dy)) step(); }
        else s.push(c);
        step(); continue;
      }
      if (c === 32 || c === 59) { skipBlank(); continue; }
      if (c === 107) { /* k: run the next instruction n times */
        const n = pop(), sx = x, sy = y; step(); skipBlank(); const ins = get(x, y), tx = x, ty = y; x = sx; y = sy;
        if (n <= 0) { x = tx; y = ty; }
        else { for (let k = 0; k < n; k++) { io.tick(); if (exec(ins) === 'stop') return; } if (x === sx && y === sy) { x = tx; y = ty; } }
        step(); continue;
      }
      if (exec(c) === 'stop') return;
      step();
    }
  };

  /* ---------- ><> (Fish) ---------- */
  L.fish = (code, io) => {
    const lines = code.replace(/\r/g, '').replace(/\n+$/, '').split('\n'), H = Math.max(1, lines.length), W = Math.max(1, ...lines.map(l => l.length));
    const g = lines.map(l => { const r = new Array(W).fill(0); for (let i = 0; i < l.length; i++) r[i] = l.charCodeAt(i); return r; });
    while (g.length < H) g.push(new Array(W).fill(0));
    const fishy = () => new Error('something smells fishy...');
    const stacks = [{ v: [], reg: null }];
    const cur = () => stacks[stacks.length - 1];
    const pop = () => { const v = cur().v; if (!v.length) throw fishy(); return v.pop(); };
    const push = x => cur().v.push(x);
    const fmt = n => Number.isInteger(n) ? String(n) : String(+n.toFixed(12));
    let x = 0, y = 0, dx = 1, dy = 0, quote = 0;
    const move = () => { x = (x + dx + W) % W; y = (y + dy + H) % H; };
    for (;;) {
      io.tick();
      const c = g[y][x], ch = String.fromCharCode(c);
      if (quote) { if (c === quote) quote = 0; else push(c); move(); continue; }
      if (c >= 48 && c <= 57) push(c - 48);
      else if (c >= 97 && c <= 102) push(c - 87);
      else switch (ch) {
        case '\0': case ' ': break;
        case '>': dx = 1; dy = 0; break;
        case '<': dx = -1; dy = 0; break;
        case '^': dx = 0; dy = -1; break;
        case 'v': dx = 0; dy = 1; break;
        case '/': { const t = dx; dx = -dy; dy = -t; break; }
        case '\\': { const t = dx; dx = dy; dy = t; break; }
        case '|': dx = -dx; break;
        case '_': dy = -dy; break;
        case '#': dx = -dx; dy = -dy; break;
        case 'x': { const d = [[1, 0], [-1, 0], [0, 1], [0, -1]][Math.random() * 4 | 0]; dx = d[0]; dy = d[1]; break; }
        case '!': move(); break;
        case '?': if (pop() === 0) move(); break;
        case '.': { const yy = pop(), xx = pop(); if (yy < 0 || yy >= H || xx < 0 || xx >= W) throw fishy(); x = xx; y = yy; break; }
        case '+': { const a = pop(), b = pop(); push(b + a); break; }
        case '-': { const a = pop(), b = pop(); push(b - a); break; }
        case '*': { const a = pop(), b = pop(); push(b * a); break; }
        case ',': { const a = pop(), b = pop(); if (a === 0) throw fishy(); push(b / a); break; }
        case '%': { const a = pop(), b = pop(); if (a === 0) throw fishy(); push(((b % a) + a) % a); break; }
        case '=': { const a = pop(), b = pop(); push(b === a ? 1 : 0); break; }
        case ')': { const a = pop(), b = pop(); push(b > a ? 1 : 0); break; }
        case '(': { const a = pop(), b = pop(); push(b < a ? 1 : 0); break; }
        case '"': case "'": quote = c; break;
        case ':': { const a = pop(); push(a); push(a); break; }
        case '~': pop(); break;
        case '$': { const a = pop(), b = pop(); push(a); push(b); break; }
        case '@': { const a = pop(), b = pop(), d = pop(); push(a); push(d); push(b); break; }
        case '}': { const v = cur().v; if (v.length) v.unshift(v.pop()); break; }
        case '{': { const v = cur().v; if (v.length) v.push(v.shift()); break; }
        case 'r': cur().v.reverse(); break;
        case 'l': push(cur().v.length); break;
        case '[': { const n = pop(), v = cur().v; if (n > v.length || n < 0) throw fishy(); stacks.push({ v: v.splice(v.length - n, n), reg: null }); break; }
        case ']': { const top = stacks.pop(); if (!stacks.length) stacks.push({ v: [], reg: null }); else cur().v.push(...top.v); break; }
        case 'o': io.out(chr(pop())); break;
        case 'n': io.out(fmt(pop())); break;
        case 'i': push(io.getc()); break;
        case '&': { const s = cur(); if (s.reg === null) s.reg = pop(); else { push(s.reg); s.reg = null; } break; }
        case 'g': { const yy = pop(), xx = pop(); push(yy >= 0 && yy < H && xx >= 0 && xx < W ? g[yy][xx] : 0); break; }
        case 'p': { const yy = pop(), xx = pop(), v = pop(); if (yy >= 0 && yy < H && xx >= 0 && xx < W) g[yy][xx] = v; break; }
        case ';': return;
        default: throw fishy();
      }
      move();
    }
  };

  /* ---------- Malbolge ---------- */
  const XLAT = '5z]&gqtyfr$(we4{WP)H-Zn,[%\\3dL+Q;>U!pJS72FhOA1CB6v^=I_0/8|jsb9m<.TVac`uY*MK\'X~xDl}REokN:#?G"i@';
  const CRZ = [[1, 0, 0], [1, 0, 2], [2, 2, 1]];
  function crazy(a, d) { let r = 0, p = 1; for (let k = 0; k < 10; k++) { r += CRZ[d % 3][a % 3] * p; a = Math.floor(a / 3); d = Math.floor(d / 3); p *= 3; } return r; }
  const rotr = v => Math.floor(v / 3) + (v % 3) * 19683;
  L.malbolge = (code, io) => {
    const mem = new Int32Array(59049); let n = 0;
    for (const ch of code) {
      if (/\s/.test(ch)) continue;
      const c = ch.charCodeAt(0);
      if (c < 33 || c > 126 || ![4, 5, 23, 39, 40, 62, 68, 81].includes((c + n) % 94)) throw new Error('Character ' + (n + 1) + ' ("' + ch + '") is not a valid Malbolge instruction at that position.');
      if (n >= 59049) throw new Error('The program is too long.');
      mem[n++] = c;
    }
    if (n < 2) throw new Error('A Malbolge program needs at least two characters.');
    for (let i = n; i < 59049; i++) mem[i] = crazy(mem[i - 1], mem[i - 2]);
    let a = 0, c = 0, d = 0;
    for (;;) {
      io.tick();
      const v = mem[c];
      if (v < 33 || v > 126) throw new Error('The program ran into memory that is not an instruction.');
      switch ((v + c) % 94) {
        case 4: c = mem[d]; break;
        case 5: io.byte(a % 256); break;
        case 23: { const b = io.getb(); a = b < 0 ? 59048 : b; break; }
        case 39: a = mem[d] = rotr(mem[d]); break;
        case 40: d = mem[d]; break;
        case 62: a = mem[d] = crazy(a, mem[d]); break;
        case 81: return;
        default: break;
      }
      if (mem[c] >= 33 && mem[c] <= 126) mem[c] = XLAT.charCodeAt(mem[c] - 33);
      c = (c + 1) % 59049; d = (d + 1) % 59049;
    }
  };

  /* ---------- Piet, as a grid of letters: one letter = one codel ----------
     Hues red yellow green cyan blue magenta: light r y g c b m, normal R Y G C B M, dark 1 2 3 4 5 6.
     '.' (or W) is white, '#' (or K) is black. */
  const PIET_HUE = 'rygcbm';
  function pietColour(ch) {
    if (ch === '.' || ch === 'W' || ch === 'w') return -1;
    if (ch === '#' || ch === 'K' || ch === 'k' || ch === ' ') return -2;
    let h = PIET_HUE.indexOf(ch); if (h >= 0) return h * 3;
    h = PIET_HUE.toUpperCase().indexOf(ch); if (h >= 0) return h * 3 + 1;
    h = '123456'.indexOf(ch); if (h >= 0) return h * 3 + 2;
    return null;
  }
  L.piet = (code, io) => {
    const rows = code.replace(/\r/g, '').split('\n').map(l => l.replace(/\s+$/, '')).filter(l => l && !/^\s*\/\//.test(l));
    if (!rows.length) throw new Error('Draw the program as rows of colour letters.');
    const W = Math.max(...rows.map(r => r.length)), H = rows.length, g = [];
    rows.forEach((r, y) => { const row = []; for (let x = 0; x < W; x++) { const k = pietColour(r[x] === undefined ? '#' : r[x]); if (k === null) throw new Error('"' + r[x] + '" on row ' + (y + 1) + ' is not a Piet colour letter.'); row.push(k); } g.push(row); });
    const at = (x, y) => x < 0 || y < 0 || x >= W || y >= H ? -2 : g[y][x];
    const blocks = new Map();
    const blockOf = (x, y) => {
      const k0 = y * W + x; if (blocks.has(k0)) return blocks.get(k0);
      const col = g[y][x], cells = [], seen = new Set([k0]), q = [[x, y]];
      while (q.length) { const [a, b] = q.pop(); cells.push([a, b]); for (const [u, v] of [[a + 1, b], [a - 1, b], [a, b + 1], [a, b - 1]]) { const k = v * W + u; if (at(u, v) === col && !seen.has(k)) { seen.add(k); q.push([u, v]); } } }
      const blk = { col, size: cells.length, cells };
      cells.forEach(([a, b]) => blocks.set(b * W + a, blk));
      return blk;
    };
    const DX = [1, 0, -1, 0], DY = [0, 1, 0, -1]; /* dp: 0 right, 1 down, 2 left, 3 up (clockwise) */
    const exitOf = (blk, dp, cc) => {
      let best = -Infinity, edge = [];
      for (const [a, b] of blk.cells) { const v = a * DX[dp] + b * DY[dp]; if (v > best) { best = v; edge = [[a, b]]; } else if (v === best) edge.push([a, b]); }
      const side = (dp + (cc ? 1 : 3)) % 4; let pick = edge[0], bv = -Infinity;
      for (const [a, b] of edge) { const v = a * DX[side] + b * DY[side]; if (v > bv) { bv = v; pick = [a, b]; } }
      return pick;
    };
    const s = []; let x = 0, y = 0, dp = 0, cc = 0;
    if (g[0][0] === -2) throw new Error('The top-left codel is black, so the program cannot start.');
    const op = (from, to, size) => {
      const dh = ((Math.floor(to / 3) - Math.floor(from / 3)) + 6) % 6, dl = ((to % 3) - (from % 3) + 3) % 3, need = n => s.length >= n;
      switch (dh * 3 + dl) {
        case 1: s.push(size); break;
        case 2: if (need(1)) s.pop(); break;
        case 3: if (need(2)) { const a = s.pop(), b = s.pop(); s.push(b + a); } break;
        case 4: if (need(2)) { const a = s.pop(), b = s.pop(); s.push(b - a); } break;
        case 5: if (need(2)) { const a = s.pop(), b = s.pop(); s.push(b * a); } break;
        case 6: if (need(2) && s[s.length - 1] !== 0) { const a = s.pop(), b = s.pop(); s.push(Math.floor(b / a)); } break;
        case 7: if (need(2) && s[s.length - 1] !== 0) { const a = s.pop(), b = s.pop(); s.push(((b % a) + a) % a); } break;
        case 8: if (need(1)) s.push(s.pop() ? 0 : 1); break;
        case 9: if (need(2)) { const a = s.pop(), b = s.pop(); s.push(b > a ? 1 : 0); } break;
        case 10: if (need(1)) dp = ((dp + s.pop()) % 4 + 4) % 4; break;
        case 11: if (need(1)) cc = (cc + Math.abs(s.pop())) % 2; break;
        case 12: if (need(1)) s.push(s[s.length - 1]); break;
        case 13: if (need(2)) { const n = s.pop(), d = s.pop(); if (d < 0 || d > s.length) { s.push(d, n); break; } const part = s.splice(s.length - d, d), r = ((n % d) + d) % d || 0; s.push(...part.slice(d - r), ...part.slice(0, d - r)); } break;
        case 14: { const n = io.getn(); if (n !== null) s.push(n); break; }
        case 15: { const c = io.getc(); if (c >= 0) s.push(c); break; }
        case 16: if (need(1)) io.out(String(s.pop())); break;
        case 17: if (need(1)) io.out(chr(s.pop())); break;
      }
    };
    for (;;) {
      io.tick();
      if (g[y][x] === -1) { /* sliding through white */
        const seen = new Set();
        for (;;) {
          io.tick();
          const k = y * W * 8 + x * 8 + dp * 2 + cc; if (seen.has(k)) return; seen.add(k);
          const nx = x + DX[dp], ny = y + DY[dp], c = at(nx, ny);
          if (c === -2) { cc ^= 1; dp = (dp + 1) % 4; continue; }
          x = nx; y = ny; if (c !== -1) break;
        }
        continue;
      }
      const blk = blockOf(x, y); let moved = false;
      for (let tries = 0; tries < 8; tries++) {
        const [ex, ey] = exitOf(blk, dp, cc), nx = ex + DX[dp], ny = ey + DY[dp], c = at(nx, ny);
        if (c !== -2) { if (c >= 0) op(blk.col, c, blk.size); x = nx; y = ny; moved = true; break; }
        if (tries % 2 === 0) cc ^= 1; else dp = (dp + 1) % 4;
      }
      if (!moved) return;
    }
  };

  /* ---------- Chicken: every line is one instruction, numbered by how many times it says "chicken" ---------- */
  L.chicken = (code, io) => {
    const ops = code.replace(/\r/g, '').replace(/\n+$/, '').split('\n').map(l => (l.match(/\bchicken\b/g) || []).length);
    const input = []; let c; while ((c = io.getc()) >= 0) input.push(chr(c));
    const st = [null, input.join('')], base = 2; st.push(...ops, 0); st[0] = st;
    const pop = () => { if (st.length <= base + ops.length + 1) throw new Error('The stack is empty.'); return st.pop(); };
    for (let ip = base; ;) {
      io.tick();
      const op = st[ip++];
      if (op === 0 || op === undefined) break;
      switch (op) {
        case 1: st.push('chicken'); break;
        case 2: { const b = pop(), a = pop(); st.push(a + b); break; }
        case 3: { const b = pop(), a = pop(); st.push(a - b); break; }
        case 4: { const b = pop(), a = pop(); st.push(a * b); break; }
        case 5: { const b = pop(), a = pop(); st.push(a == b); break; } // eslint-disable-line eqeqeq
        case 6: { const src = st[ip++], addr = pop(); st.push(src === 1 ? st[1][addr] : st[addr]); break; }
        case 7: { const addr = pop(), v = pop(); st[addr] = v; break; }
        case 8: { const off = pop(), cond = pop(); if (cond) ip += off; break; }
        case 9: st.push(chr(pop())); break;
        default: st.push(op - 10);
      }
    }
    if (st.length > base + ops.length + 1) { const top = st[st.length - 1]; io.out(top === true ? 'true' : top === false ? 'false' : String(top)); }
  };

  /* ---------- Whitespace: only spaces, tabs and line breaks count ---------- */
  L.whitespace = (code, io) => {
    const t = code.replace(/[^ \t\n]/g, ''); let i = 0;
    const tok = () => { if (i >= t.length) throw new Error('The program ends in the middle of an instruction.'); return t[i++]; };
    const num = () => { const sign = tok(); let v = 0n, c; while ((c = tok()) !== '\n') v = v * 2n + (c === '\t' ? 1n : 0n); return Number(sign === '\t' ? -v : v); };
    const lab = () => { let s = '', c; while ((c = tok()) !== '\n') s += c === '\t' ? '1' : '0'; return s; };
    const prog = [], labels = {};
    while (i < t.length) {
      const a = tok(); let ins;
      if (a === ' ') { const b = tok(); if (b === ' ') ins = ['push', num()]; else { const c = tok(); if (b === '\n') ins = [{ ' ': 'dup', '\t': 'swap', '\n': 'drop' }[c]]; else ins = [c === ' ' ? 'copy' : c === '\n' ? 'slide' : '?', c === '\t' ? 0 : num()]; } }
      else if (a === '\t') {
        const b = tok(), c = tok();
        if (b === ' ') ins = [{ '  ': 'add', ' \t': 'sub', ' \n': 'mul', '\t ': 'div', '\t\t': 'mod' }[c + tok()]];
        else if (b === '\t') ins = [{ ' ': 'store', '\t': 'load' }[c]];
        else ins = [{ '  ': 'outc', ' \t': 'outn', '\t ': 'readc', '\t\t': 'readn' }[c + tok()]];
      } else {
        const b = tok(), c = tok(), k = b + c;
        const m = { '  ': 'mark', ' \t': 'call', ' \n': 'jump', '\t ': 'jz', '\t\t': 'jn', '\t\n': 'ret', '\n\n': 'end' }[k];
        ins = [m]; if (m && m !== 'ret' && m !== 'end') ins.push(lab());
        if (m === 'mark') { labels[ins[1]] = prog.length; continue; }
      }
      if (!ins[0] || ins[0] === '?') throw new Error('Unknown Whitespace instruction near character ' + i + '.');
      prog.push(ins);
    }
    const s = [], heap = new Map(), calls = [];
    const pop = () => { if (!s.length) throw new Error('The stack is empty.'); return s.pop(); };
    const go = l => { if (!(l in labels)) throw new Error('No label ' + (l || '(empty)') + '.'); return labels[l]; };
    for (let pc = 0; pc < prog.length;) {
      io.tick();
      const [op, arg] = prog[pc++];
      switch (op) {
        case 'push': s.push(arg); break;
        case 'dup': { const a = pop(); s.push(a, a); break; }
        case 'swap': { const a = pop(), b = pop(); s.push(a, b); break; }
        case 'drop': pop(); break;
        case 'copy': if (arg < 0 || arg >= s.length) throw new Error('copy reaches past the stack.'); s.push(s[s.length - 1 - arg]); break;
        case 'slide': { const a = pop(); s.splice(Math.max(0, s.length - arg), arg); s.push(a); break; }
        case 'add': { const a = pop(), b = pop(); s.push(b + a); break; }
        case 'sub': { const a = pop(), b = pop(); s.push(b - a); break; }
        case 'mul': { const a = pop(), b = pop(); s.push(b * a); break; }
        case 'div': { const a = pop(), b = pop(); if (!a) throw new Error('Division by zero.'); s.push(Math.floor(b / a)); break; }
        case 'mod': { const a = pop(), b = pop(); if (!a) throw new Error('Division by zero.'); s.push(((b % a) + a) % a); break; }
        case 'store': { const v = pop(), addr = pop(); heap.set(addr, v); break; }
        case 'load': { const addr = pop(); s.push(heap.get(addr) || 0); break; }
        case 'outc': io.out(chr(pop())); break;
        case 'outn': io.out(String(pop())); break;
        case 'readc': { const c = io.getc(); heap.set(pop(), c); break; }
        case 'readn': { const n = io.getn(); heap.set(pop(), n === null ? 0 : n); break; }
        case 'call': calls.push(pc); pc = go(arg); break;
        case 'jump': pc = go(arg); break;
        case 'jz': if (pop() === 0) pc = go(arg); break;
        case 'jn': if (pop() < 0) pc = go(arg); break;
        case 'ret': if (!calls.length) throw new Error('Return with no call.'); pc = calls.pop(); break;
        case 'end': return;
      }
    }
    throw new Error('The program ran off the end without an end instruction (line feed, line feed, line feed).');
  };

  /* ---------- Unlambda: combinators, with call/cc and promises ---------- */
  L.unlambda = (code, io) => {
    let i = 0;
    const parse = () => {
      for (;;) {
        if (i >= code.length) throw new Error('The program ends too early: an application (`) is missing an operand.');
        const c = code[i++];
        if (/\s/.test(c)) continue;
        if (c === '#') { while (i < code.length && code[i] !== '\n') i++; continue; }
        if (c === '`') { const f = parse(), a = parse(); return { app: 1, f, a }; }
        if (c === '.' || c === '?') { if (i >= code.length) throw new Error(c + ' needs a character after it.'); return { t: c === '.' ? 'dot' : 'q', ch: code[i++] }; }
        const k = c.toLowerCase();
        if (k === 'r') return { t: 'dot', ch: '\n' };
        if ('ksivdce'.includes(k)) return { t: k };
        if (c === '@') return { t: 'at' };
        if (c === '|') return { t: 'pipe' };
        throw new Error('"' + c + '" is not an Unlambda function.');
      }
    };
    const prog = parse();
    let cur = null, mode = 'eval', e = prog, v = null, fn = null, k = { t: 'halt' };
    const I = { t: 'i' }, V = { t: 'v' };
    const apply = (f, a) => { fn = f; v = a; mode = 'apply'; };
    for (;;) {
      io.tick();
      if (mode === 'eval') {
        if (e.app) { k = { t: 'arg', a: e.a, next: k }; e = e.f; continue; }
        v = e; mode = 'ret'; continue;
      }
      if (mode === 'ret') {
        const fr = k;
        switch (fr.t) {
          case 'halt': return;
          case 'arg':
            if (v.t === 'd') { k = fr.next; v = { t: 'd1', e: fr.a }; continue; }
            k = { t: 'app', f: v, next: fr.next }; e = fr.a; mode = 'eval'; continue;
          case 'app': k = fr.next; apply(fr.f, v); continue;
          case 's1': k = { t: 's2', r: v, z: fr.z, next: fr.next }; apply(fr.y, fr.z); continue;
          case 's2': k = fr.next; apply(fr.r, v); continue;
          case 'd': k = fr.next; apply(v, fr.y); continue;
        }
      }
      /* apply fn to v */
      switch (fn.t) {
        case 'i': mode = 'ret'; break;
        case 'v': v = V; mode = 'ret'; break;
        case 'k': v = { t: 'k1', x: v }; mode = 'ret'; break;
        case 'k1': v = fn.x; mode = 'ret'; break;
        case 's': v = { t: 's1x', x: v }; mode = 'ret'; break;
        case 's1x': v = { t: 's2x', x: fn.x, y: v }; mode = 'ret'; break;
        case 's2x': k = { t: 's1', y: fn.y, z: v, next: k }; apply(fn.x, v); break;
        case 'd': v = { t: 'dv', x: v }; mode = 'ret'; break;
        case 'dv': apply(fn.x, v); break;
        case 'd1': k = { t: 'd', y: v, next: k }; e = fn.e; mode = 'eval'; break;
        case 'c': apply(v, { t: 'cont', k }); break;
        case 'cont': k = fn.k; mode = 'ret'; break;
        case 'e': return;
        case 'dot': io.out(fn.ch); mode = 'ret'; break;
        case 'at': { const c = io.getc(); cur = c < 0 ? null : chr(c); apply(v, cur === null ? V : I); break; }
        case 'q': apply(v, cur === fn.ch ? I : V); break;
        case 'pipe': apply(v, cur === null ? V : { t: 'dot', ch: cur }); break;
        default: throw new Error('Cannot apply ' + fn.t + '.');
      }
    }
  };

  /* ---------- FALSE ---------- */
  L.false = (code, io) => {
    const s = [], vars = new Array(26).fill(0);
    const pop = () => { if (!s.length) throw new Error('The stack is empty.'); return s.pop(); };
    const matchBracket = i => { let d = 0; for (let j = i; j < code.length; j++) { const c = code[j]; if (c === '"') { j = code.indexOf('"', j + 1); if (j < 0) break; continue; } if (c === '{') { j = code.indexOf('}', j + 1); if (j < 0) break; continue; } if (c === "'") { j++; continue; } if (c === '[') d++; else if (c === ']' && --d === 0) return j; } throw new Error('A [ has no matching ].'); };
    let depth = 0;
    const exec = (from, to) => {
      if (++depth > 5000) throw new Error('Too many nested calls.');
      for (let i = from; i < to; i++) {
        io.tick();
        const c = code[i];
        if (/\s/.test(c)) continue;
        if (c >= '0' && c <= '9') { let n = 0; while (i < to && code[i] >= '0' && code[i] <= '9') n = n * 10 + (code.charCodeAt(i++) - 48); i--; s.push(n); continue; }
        if (c >= 'a' && c <= 'z') { s.push({ v: c.charCodeAt(0) - 97 }); continue; }
        switch (c) {
          case "'": s.push(code.charCodeAt(++i)); break;
          case '"': { const e = code.indexOf('"', i + 1); if (e < 0) throw new Error('A string has no closing ".'); io.out(code.slice(i + 1, e)); i = e; break; }
          case '{': { const e = code.indexOf('}', i + 1); if (e < 0) throw new Error('A comment has no closing }.'); i = e; break; }
          case '[': { const e = matchBracket(i); s.push({ f: i + 1, t: e }); i = e; break; }
          case ':': { const r = pop(); if (!r || r.v === undefined) throw new Error(': needs a variable.'); vars[r.v] = pop(); break; }
          case ';': { const r = pop(); if (!r || r.v === undefined) throw new Error('; needs a variable.'); s.push(vars[r.v]); break; }
          case '!': { const f = pop(); if (!f || f.f === undefined) throw new Error('! needs a [function].'); exec(f.f, f.t); break; }
          case '?': { const f = pop(), cnd = pop(); if (cnd) exec(f.f, f.t); break; }
          case '#': { const body = pop(), cnd = pop(); for (;;) { io.tick(); exec(cnd.f, cnd.t); if (!pop()) break; exec(body.f, body.t); } break; }
          case '+': { const a = pop(), b = pop(); s.push((b + a) | 0); break; }
          case '-': { const a = pop(), b = pop(); s.push((b - a) | 0); break; }
          case '*': { const a = pop(), b = pop(); s.push(Math.imul(b, a)); break; }
          case '/': { const a = pop(), b = pop(); if (!a) throw new Error('Division by zero.'); s.push((b / a) | 0); break; }
          case '_': s.push(-pop() | 0); break;
          case '=': s.push(pop() === pop() ? -1 : 0); break;
          case '>': { const a = pop(), b = pop(); s.push(b > a ? -1 : 0); break; }
          case '&': s.push(pop() & pop()); break;
          case '|': s.push(pop() | pop()); break;
          case '~': s.push(~pop()); break;
          case '$': { const a = pop(); s.push(a, a); break; }
          case '%': pop(); break;
          case '\\': { const a = pop(), b = pop(); s.push(a, b); break; }
          case '@': { const a = pop(), b = pop(), d = pop(); s.push(b, a, d); break; }
          case 'ø': case 'O': { const n = pop(); if (n < 0 || n >= s.length) throw new Error('pick reaches past the stack.'); s.push(s[s.length - 1 - n]); break; }
          case '.': io.out(String(pop())); break;
          case ',': io.out(chr(pop())); break;
          case '^': s.push(io.getc()); break;
          case 'ß': case 'B': break;
          case '`': pop(); break;
          default: throw new Error('"' + c + '" is not a FALSE command.');
        }
      }
      depth--;
    };
    exec(0, code.length);
  };

  /* ---------- Thue: string rewriting in random order ---------- */
  L.thue = (code, io) => {
    const lines = code.replace(/\r/g, '').split('\n'), rules = []; let k = 0;
    for (; k < lines.length; k++) {
      const l = lines[k]; if (/^\s*::=\s*$/.test(l)) { k++; break; }
      if (!l.trim()) continue;
      const p = l.indexOf('::='); if (p < 0) throw new Error('Line ' + (k + 1) + ' is not a rule (left::=right).');
      rules.push([l.slice(0, p), l.slice(p + 3)]);
    }
    let str = lines.slice(k).join('\n').replace(/\n+$/, '');
    for (;;) {
      io.tick();
      const hits = [];
      for (const r of rules) { if (!r[0]) continue; let p = str.indexOf(r[0]); while (p >= 0) { hits.push([r, p]); p = str.indexOf(r[0], p + 1); } }
      if (!hits.length) return;
      const [[lhs, rhs], p] = hits[Math.random() * hits.length | 0];
      let rep = rhs;
      if (rhs.startsWith('~')) { io.out(rhs.slice(1) + '\n'); rep = ''; }
      else if (rhs === ':::') rep = io.getline() || '';
      str = str.slice(0, p) + rep + str.slice(p + lhs.length);
    }
  };

  /* ---------- Underload: a stack of programs ---------- */
  L.underload = (code, io) => {
    const s = []; let prog = code, i = 0;
    const pop = () => { if (!s.length) throw new Error('The stack is empty.'); return s.pop(); };
    while (i < prog.length) {
      io.tick();
      const c = prog[i++];
      switch (c) {
        case '(': { let d = 1, j = i; for (; j < prog.length && d; j++) { if (prog[j] === '(') d++; else if (prog[j] === ')') d--; } if (d) throw new Error('A ( has no matching ).'); s.push(prog.slice(i, j - 1)); i = j; break; }
        case '~': { const a = pop(), b = pop(); s.push(a, b); break; }
        case ':': { const a = pop(); s.push(a, a); break; }
        case '!': pop(); break;
        case '*': { const a = pop(), b = pop(); s.push(b + a); break; }
        case 'a': s.push('(' + pop() + ')'); break;
        case '^': { prog = pop() + prog.slice(i); i = 0; if (prog.length > 1e7) throw new Error('The program grew past 10 million characters.'); break; }
        case 'S': io.out(pop()); break;
        default: if (!/\s/.test(c)) throw new Error('"' + c + '" is not an Underload command.');
      }
    }
  };

  /* ---------- Deadfish ---------- */
  L.deadfish = (code, io) => {
    let a = 0;
    for (const c of code) {
      io.tick();
      if (c === 'i') a++; else if (c === 'd') a--; else if (c === 's') a *= a; else if (c === 'o') io.out(a + '\n'); else continue;
      if (a === 256 || a === -1) a = 0;
    }
  };

  /* ---------- /// (slashes): search and replace is the only command ---------- */
  L.slashes = (code, io) => {
    let p = code;
    for (;;) {
      let i = 0;
      while (i < p.length && p[i] !== '/') { if (p[i] === '\\') i++; if (i < p.length) io.out(p[i]); i++; }
      if (i >= p.length) return;
      const read = () => { let s = ''; i++; while (i < p.length && p[i] !== '/') { if (p[i] === '\\') i++; if (i < p.length) s += p[i]; i++; } return i < p.length ? s : null; };
      const pat = read(); if (pat === null) return;
      const rep = read(); if (rep === null) return;
      let rest = p.slice(i + 1);
      if (!pat) throw new Error('An empty pattern would loop forever.');
      let at = rest.indexOf(pat);
      while (at >= 0) { io.tick(); rest = rest.slice(0, at) + rep + rest.slice(at + pat.length); if (rest.length > 1e7) throw new Error('The program grew past 10 million characters.'); at = rest.indexOf(pat); }
      p = rest;
    }
  };

  /* ---------- Brain-Flak: two stacks and four kinds of brackets ---------- */
  L.brainflak = (code, io) => {
    const ascii = /#\s*(-A|ascii)\b/i.test(code), src = code.replace(/#.*$/gm, '').replace(/[^()[\]{}<>]/g, '');
    const close = { '(': ')', '[': ']', '{': '}', '<': '>' }; let i = 0;
    const parse = end => {
      const out = [];
      while (i < src.length) {
        const c = src[i];
        if (close[c]) { i++; const kids = parse(close[c]); out.push({ c, kids }); }
        else { if (c !== end) throw new Error('Unmatched "' + c + '" at bracket ' + (i + 1) + '.'); i++; return out; }
      }
      if (end) throw new Error('A bracket is never closed.');
      return out;
    };
    const tree = parse('');
    const inputs = []; let n; while ((n = io.getn()) !== null) inputs.push(n);
    let act = inputs.slice(), off = [];
    const ev = nodes => { let sum = 0; for (const nd of nodes) sum += one(nd); return sum; };
    const one = nd => {
      io.tick();
      const empty = !nd.kids.length;
      switch (nd.c) {
        case '(': if (empty) return 1; { const v = ev(nd.kids); act.push(v); return v; }
        case '[': return empty ? act.length : -ev(nd.kids);
        case '{': if (empty) return act.length ? act.pop() : 0; { let s = 0; while (act.length && act[act.length - 1] !== 0) s += ev(nd.kids); return s; }
        case '<': if (empty) { const t = act; act = off; off = t; return 0; } ev(nd.kids); return 0;
      }
      return 0;
    };
    ev(tree);
    const vals = act.slice().reverse();
    io.out(ascii ? vals.map(chr).join('') : vals.map(String).join('\n') + (vals.length ? '\n' : ''));
  };

  /* ---------- HQ9+ ---------- */
  L.hq9 = (code, io) => {
    let acc = 0;
    const b = n => n === 0 ? 'no more bottles' : n === 1 ? '1 bottle' : n + ' bottles';
    for (const c of code) {
      io.tick();
      const u = c.toUpperCase();
      if (u === 'H') io.out('Hello, world!\n');
      else if (u === 'Q') io.out(code + (code.endsWith('\n') ? '' : '\n'));
      else if (c === '9') for (let n = 99; n > 0; n--) io.out(b(n)[0].toUpperCase() + b(n).slice(1) + ' of beer on the wall, ' + b(n) + ' of beer.\nTake one down and pass it around, ' + b(n - 1) + ' of beer on the wall.\n\n');
      else if (c === '+') acc++;
    }
    void acc;
  };

  /* ---------- FRACTRAN: multiply by the first fraction that gives a whole number ---------- */
  L.fractran = (code, io) => {
    const fr = [...code.replace(/#.*$/gm, '').matchAll(/(\d+)\s*\/\s*(\d+)/g)].map(m => [BigInt(m[1]), BigInt(m[2])]);
    if (!fr.length) throw new Error('Write the program as fractions such as 3/2.');
    if (fr.some(f => f[1] === 0n)) throw new Error('A fraction has 0 below the line.');
    const sm = /start\s*[:=]?\s*(\d+)/i.exec(code), inp = io.getn();
    let n = BigInt(sm ? sm[1] : inp !== null ? inp : 2);
    io.out('start ' + n + '\n');
    const factor = x => { const f = []; let p = 2n; while (p * p <= x && f.length < 40) { let e = 0; while (x % p === 0n) { x /= p; e++; } if (e) f.push(p + (e > 1 ? '^' + e : '')); p++; } if (x > 1n) f.push(String(x)); return f.join(' × ') || '1'; };
    for (let steps = 0; ; steps++) {
      io.tick();
      const f = fr.find(q => (n * q[0]) % q[1] === 0n);
      if (!f) { io.out('halted after ' + steps + ' steps: ' + n + ' = ' + factor(n) + '\n'); return; }
      n = n * f[0] / f[1];
      io.out(n + '\n');
    }
  };

  /* ---------- Bitwise Cyclic Tag ---------- */
  L.bct = (code, io) => {
    const lines = code.replace(/#.*$/gm, '').split('\n').map(l => l.replace(/[^01]/g, '')).filter(Boolean);
    if (lines.length < 2) throw new Error('Write the program bits on the first line and the starting data bits on the second.');
    const prog = lines[0]; let data = lines[1], pc = 0;
    io.out(data + '\n');
    for (let n = 0; data.length; n++) {
      io.tick();
      if (prog[pc] === '0') { data = data.slice(1); pc = (pc + 1) % prog.length; io.out((data || '(empty)') + '\n'); }
      else { const x = prog[(pc + 1) % prog.length]; if (data[0] === '1') data += x; pc = (pc + 2) % prog.length; }
      if (data.length > 5000) throw new Error('The data grew past 5000 bits.');
    }
  };

  const api = Object.assign(root.Esolangs || {}, { L: Object.assign((root.Esolangs && root.Esolangs.L) || {}, L), makeIO, Stop, chr, crazy, rotr, XLAT });
  api.run = (id, code, input, opts) => {
    const f = api.L[id];
    const io = makeIO(input, opts && opts.ms);
    if (!f) return { ok: false, error: 'There is no interpreter for "' + id + '".' };
    try { f(String(code), io); return { ok: true, stdout: io.text() }; }
    catch (e) { return { ok: false, stdout: io.text(), stopped: e instanceof Stop, error: e && /Maximum call stack/.test(e.message) ? 'The program nested too deeply.' : (e && e.message) || String(e) }; }
  };
  root.Esolangs = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof self !== 'undefined' ? self : globalThis);

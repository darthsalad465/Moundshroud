// Aurum calculator engine, part 1 of 3 (Office > Calculator). Exact fractions on BigInt, complex numbers, lists,
// matrices, the expression parser, the printer and the evaluator. calc-lib.js adds the function library and
// calc-cas.js adds the symbolic algebra. Works in the page (window.CalcEngine) and in Node (tests/calc-test.js).
(function () {
  'use strict';
  class CalcError extends Error {}
  class Unknown extends CalcError { constructor(n) { super('Unknown name: ' + n); this.sym = n; } }
  const err = m => { throw new CalcError(m); };

  /* ---------- exact fractions ---------- */
  const babs = x => (x < 0n ? -x : x);
  const bgcd = (a, b) => { a = babs(a); b = babs(b); while (b) { const t = a % b; a = b; b = t; } return a; };
  const bitlen = x => babs(x).toString(2).length;
  const bigDiv = (n, d) => { const a = Number(n), b = Number(d); if (isFinite(a) && isFinite(b)) return a / b; const s = 2n ** BigInt(Math.max(bitlen(n), bitlen(d)) - 1000); return Number(n / s) / Number(d / s); };
  class Frac {
    constructor(n, d, dec) { n = BigInt(n); d = d === undefined ? 1n : BigInt(d); if (d === 0n) err('Division by zero'); if (d < 0n) { n = -n; d = -d; } const g = bgcd(n, d) || 1n; this.n = n / g; this.d = d / g; if (dec) this.dec = true; }
    get isInt() { return this.d === 1n; }
    num() { return bigDiv(this.n, this.d); }
  }
  const F = (n, d) => new Frac(n, d);
  const F0 = F(0), F1 = F(1);
  function litFrac(s) {
    if (/^0[xbo]/i.test(s)) return F(BigInt(s.toLowerCase()));
    const m = /^(\d*)\.?(\d*)(?:e([+-]?\d+))?$/i.exec(s); if (!m) err('Bad number ' + s);
    let n = BigInt((m[1] || '') + (m[2] || '') || '0'), d = 10n ** BigInt((m[2] || '').length); const e = +(m[3] || 0);
    if (Math.abs(e) > 400) return parseFloat(s);
    if (e > 0) n *= 10n ** BigInt(e); else if (e < 0) d *= 10n ** BigInt(-e);
    return new Frac(n, d, s.includes('.') || /e-/i.test(s));
  }
  function iroot(n, k) { if (n < 0n) { if (k % 2n === 0n) return null; const r = iroot(-n, k); return r === null ? null : -r; } if (n < 2n) return n; const g = Math.round(Math.pow(Number(n), 1 / Number(k))); if (!isFinite(g)) return null; const r = BigInt(g); for (const c of [r - 1n, r, r + 1n]) if (c >= 0n && c ** k === n) return c; return null; }

  /* ---------- complex numbers, lists, matrices ---------- */
  class Cx { constructor(re, im) { this.re = re; this.im = im; } }
  class Mat { constructor(rows) { if (!rows.length || rows.some(r => r.length !== rows[0].length || !r.length)) err('Every matrix row needs the same number of entries'); this.rows = rows; } get r() { return this.rows.length; } get c() { return this.rows[0].length; } }
  const isF = v => v instanceof Frac, isC = v => v instanceof Cx, isM = v => v instanceof Mat, isL = Array.isArray, isNum = v => typeof v === 'number';
  const isScalar = v => isF(v) || isNum(v) || isC(v);
  const N = v => isF(v) ? v.num() : isNum(v) ? v : isC(v) ? (v.im === 0 ? v.re : err('Expected a real number')) : err('Expected a number');
  const cx = (re, im) => (Math.abs(im) <= 1e-15 * Math.max(1, Math.abs(re)) ? re : new Cx(Math.abs(re) <= 1e-15 * Math.abs(im) ? 0 : re, im));
  const toC = v => isC(v) ? v : new Cx(N(v), 0);
  const isZero = v => isF(v) ? v.n === 0n : isC(v) ? Math.hypot(v.re, v.im) < 1e-12 : Math.abs(N(v)) < 1e-12;
  const absN = v => isC(v) ? Math.hypot(v.re, v.im) : Math.abs(N(v));
  const dec = (a, b, r) => { if (isF(r) && ((isF(a) && a.dec) || (isF(b) && b.dec)) && !r.dec) r = new Frac(r.n, r.d, true); return r; };
  const cexp = z => { const m = Math.exp(z.re); return cx(m * Math.cos(z.im), m * Math.sin(z.im)); };
  const clog = z => new Cx(Math.log(Math.hypot(z.re, z.im)), Math.atan2(z.im, z.re));
  function sAdd(a, b) { if (isF(a) && isF(b)) return dec(a, b, new Frac(a.n * b.d + b.n * a.d, a.d * b.d)); if (isC(a) || isC(b)) { a = toC(a); b = toC(b); return cx(a.re + b.re, a.im + b.im); } return N(a) + N(b); }
  function sNeg(a) { return isF(a) ? new Frac(-a.n, a.d, a.dec) : isC(a) ? new Cx(-a.re, -a.im) : -N(a); }
  const sSub = (a, b) => sAdd(a, sNeg(b));
  function sMul(a, b) { if (isF(a) && isF(b)) return dec(a, b, new Frac(a.n * b.n, a.d * b.d)); if (isC(a) || isC(b)) { a = toC(a); b = toC(b); return cx(a.re * b.re - a.im * b.im, a.re * b.im + a.im * b.re); } return N(a) * N(b); }
  function sDiv(a, b) { if (isZero(b) && !(isNum(b) && b !== 0)) err('Division by zero'); if (isF(a) && isF(b)) return dec(a, b, new Frac(a.n * b.d, a.d * b.n)); if (isC(a) || isC(b)) { a = toC(a); b = toC(b); const q = b.re * b.re + b.im * b.im; return cx((a.re * b.re + a.im * b.im) / q, (a.im * b.re - a.re * b.im) / q); } return N(a) / N(b); }
  function sPow(a, b) {
    if (isF(a) && isF(b)) {
      if (b.isInt) { const k = b.n; if (babs(k) <= 100000n && bitlen(a.n) * Number(babs(k)) < 200000 && bitlen(a.d) * Number(babs(k)) < 200000) { if (k >= 0n) return dec(a, b, new Frac(a.n ** k, a.d ** k)); if (a.n === 0n) err('Division by zero'); return dec(a, b, new Frac(a.d ** -k, a.n ** -k)); } }
      else if (b.d <= 64n) { const rn = iroot(a.n, b.d), rd = iroot(a.d, b.d); if (rn !== null && rd !== null) return sPow(new Frac(rn, rd, a.dec), F(b.n)); }
    }
    if (isC(a) || isC(b)) { if (isZero(a)) return 0; return cexp(cmulC(toC(b), clog(toC(a)))); }
    const x = N(a), y = N(b);
    if (x < 0 && !Number.isInteger(y)) { if (isF(b) && (b.d & 1n) === 1n) return ((b.n & 1n) === 0n ? 1 : -1) * Math.pow(-x, y); return cexp(cmulC(new Cx(y, 0), clog(new Cx(x, 0)))); }
    return Math.pow(x, y);
  }
  const cmulC = (a, b) => new Cx(a.re * b.re - a.im * b.im, a.re * b.im + a.im * b.re);
  function matMul(A, B) { if (A.c !== B.r) err('Matrix sizes do not match for multiplication (' + A.r + '×' + A.c + ' times ' + B.r + '×' + B.c + ')'); return new Mat(A.rows.map(row => B.rows[0].map((_, j) => row.reduce((s, x, k) => sAdd(s, sMul(x, B.rows[k][j])), F0)))); }
  function op(o, a, b) {
    if (isM(a) || isM(b)) {
      if (o === '*' && isM(a) && isM(b)) return matMul(a, b);
      if (o === '*' && isM(a) && isL(b)) return matMul(a, new Mat(b.map(x => [x]))).rows.map(r => r[0]);
      if (o === '*' && isL(a) && isM(b)) return matMul(new Mat([a]), b).rows[0];
      if (o === '^') { if (!isM(a)) err('A power cannot be a matrix'); const k = N(b); if (!Number.isInteger(k)) err('A matrix power must be a whole number'); let base = k < 0 ? E.FN.inv([a]) : a, r = E.FN.identity([F(a.r)]), n = Math.abs(k); while (n) { if (n & 1) r = matMul(r, base); base = matMul(base, base); n >>= 1; } return r; }
      if (o === '/' && isM(b)) return op('*', a, E.FN.inv([b]));
      if (isM(a) && isM(b)) { if (a.r !== b.r || a.c !== b.c) err('Matrices must be the same size'); return new Mat(a.rows.map((r, i) => r.map((x, j) => op(o, x, b.rows[i][j])))); }
      return isM(a) ? new Mat(a.rows.map(r => r.map(x => op(o, x, b)))) : new Mat(b.rows.map(r => r.map(y => op(o, a, y))));
    }
    if (isL(a) || isL(b)) { if (isL(a) && isL(b)) { if (a.length !== b.length) err('Lists must be the same length'); return a.map((x, i) => op(o, x, b[i])); } return isL(a) ? a.map(x => op(o, x, b)) : b.map(y => op(o, a, y)); }
    if (!isScalar(a) || !isScalar(b)) err('That needs numbers');
    return o === '+' ? sAdd(a, b) : o === '-' ? sSub(a, b) : o === '*' ? sMul(a, b) : o === '/' ? sDiv(a, b) : sPow(a, b);
  }
  const mapV = (v, f) => isL(v) ? v.map(x => mapV(x, f)) : isM(v) ? new Mat(v.rows.map(r => r.map(x => f(x)))) : f(v);
  const neg = v => mapV(v, sNeg);

  /* ---------- tokenizer and parser ---------- */
  const SUP = { '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4', '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9', '⁻': '-' };
  const norm = s => String(s).replace(/[×✕·⋅]/g, '*').replace(/÷/g, '/').replace(/[−–]/g, '-').replace(/π/g, ' pi ').replace(/θ/g, ' theta ').replace(/∞/g, ' inf ').replace(/√/g, ' sqrt ').replace(/∛/g, ' cbrt ')
    .replace(/[⁻⁰¹²³⁴⁵⁶⁷⁸⁹]+/g, m => '^(' + [...m].map(ch => SUP[ch]).join('') + ')').replace(/→/g, '->').replace(/≠/g, '!=').replace(/≤/g, '<=').replace(/≥/g, '>=');
  const TOK = /\s*(?:(0x[0-9a-f]+|0b[01]+|0o[0-7]+)|((?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)|([A-Za-z_][A-Za-z0-9_]*)|("[^"]*")|(:=|->|!=|<=|>=|\*\*|[-+*/^!%(),\[\]{};=<>]))/iy;
  function lex(s) {
    const out = []; TOK.lastIndex = 0; let m;
    while (TOK.lastIndex < s.length) {
      const at = TOK.lastIndex; m = TOK.exec(s);
      if (!m) { if (/^\s*$/.test(s.slice(at))) break; err('I do not understand "' + s.slice(at).trim().slice(0, 12) + '"'); }
      if (m[1] || m[2]) out.push({ k: 'n', v: litFrac(m[1] || m[2]) }); else if (m[3]) out.push({ k: 'id', v: m[3] }); else if (m[4]) out.push({ k: 's', v: m[4].slice(1, -1) }); else out.push({ k: 'op', v: m[5] });
    }
    return out;
  }
  function parse(src, c) {
    const toks = lex(norm(src)); let p = 0;
    const isOp = v => toks[p] && toks[p].k === 'op' && toks[p].v === v;
    const isFn = name => !!(E.FN[name.toLowerCase()] || E.SPECIAL[name.toLowerCase()] || (c && c.funcs && c.funcs[name]));
    const starts = () => { const t = toks[p]; return t && (t.k !== 'op' || t.v === '(' || t.v === '[' || t.v === '{'); };
    function expr() {
      const a = sum();
      if (isOp('=')) { p++; return { t: 'eq', a, b: sum() }; }
      if (toks[p] && toks[p].k === 'op' && ['<', '>', '<=', '>=', '!='].includes(toks[p].v)) { const o = toks[p++].v; return { t: 'cmp', o, a, b: sum() }; }
      return a;
    }
    function sum() { let a = term(); while (isOp('+') || isOp('-')) { const o = toks[p++].v; a = { t: 'bin', o, a, b: term() }; } return a; }
    function term() { let a = unary(); for (;;) { if (isOp('*') || isOp('/')) { const o = toks[p++].v; a = { t: 'bin', o, a, b: unary() }; } else if (starts()) a = { t: 'bin', o: '*', a, b: power() }; else return a; } }
    function unary() { if (isOp('-')) { p++; return { t: 'neg', a: unary() }; } if (isOp('+')) { p++; return unary(); } return power(); }
    function power() { const b = postfix(); if (isOp('^') || isOp('**')) { p++; return { t: 'bin', o: '^', a: b, b: unary() }; } return b; }
    function postfix() { let a = primary(); while (isOp('!') || isOp('%')) a = { t: 'post', o: toks[p++].v, a }; return a; }
    function primary() {
      const t = toks[p++]; if (!t) err('The expression ends too soon');
      if (t.k === 'n') return { t: 'num', v: t.v };
      if (t.k === 's') return { t: 'str', v: t.v };
      if (t.k === 'id') {
        if (!isFn(t.v)) return { t: 'sym', n: t.v };
        if (!isOp('(')) return { t: 'call', f: t.v, args: [power()] };
        p++; const args = []; if (!isOp(')')) { do { args.push(expr()); } while (isOp(',') && ++p); } if (isOp(')')) p++; else if (p < toks.length) err('Expected )');
        return { t: 'call', f: t.v, args };
      }
      if (t.v === '(') { const e = expr(); if (isOp(')')) p++; else if (p < toks.length) err('Expected )'); return e; }
      if (t.v === '[' || t.v === '{') {
        const close = t.v === '[' ? ']' : '}', rows = [[]];
        if (!isOp(close)) for (;;) { rows[rows.length - 1].push(expr()); if (isOp(',')) { p++; continue; } if (isOp(';')) { p++; rows.push([]); continue; } break; }
        if (isOp(close)) p++; else if (p < toks.length) err('Expected ' + close);
        if (rows.length > 1) return { t: 'mat', rows };
        const items = rows[0];
        if (t.v === '[' && items.length && items.every(x => x.t === 'list' && x.br)) return { t: 'mat', rows: items.map(x => x.items) };
        return { t: 'list', items, br: t.v === '[' };
      }
      err('Unexpected ' + t.v);
    }
    if (!toks.length) err('Nothing to work out');
    const e = expr(); if (p < toks.length) err('Unexpected ' + (toks[p].v instanceof Frac ? 'number' : toks[p].v)); return e;
  }

  /* ---------- printing (the output can be typed back in) ---------- */
  const SUPD = '⁰¹²³⁴⁵⁶⁷⁸⁹';
  const sup = s => String(s).replace(/^\+/, '').split('').map(ch => ch === '-' ? '⁻' : SUPD[+ch]).join('');
  const trimZ = s => s.includes('.') ? s.replace(/(\.\d*?)0+(?=$|e)/, '$1').replace(/\.(?=$|e)/, '') : s;
  function fmtNum(x, digits) {
    digits = digits || 12; if (isNaN(x)) return 'undefined'; if (!isFinite(x)) return x > 0 ? '∞' : '−∞'; if (x === 0) return '0';
    const a = Math.abs(x), sg = x < 0 ? '−' : '';
    if (a >= 1e12 || a < 1e-6) { const [m, e] = a.toExponential(digits - 1).split('e'); return sg + trimZ(m) + '×10' + sup(e); }
    return sg + trimZ(a.toPrecision(digits)).replace(/e.*$/, '');
  }
  const PREC = { eq: 0, cmp: 0, '+': 1, '-': 1, '*': 2, '/': 2, neg: 2, '^': 4, post: 5 };
  const NAMES = { pi: 'π', theta: 'θ', inf: '∞' };
  function pretty(n, digits) {
    const P = (x, min) => { const s = pretty(x, digits); return prec(x) < min ? '(' + s + ')' : s; };
    switch (n.t) {
      case 'hold': return pretty(n.a, digits);
      case 'raw': return n.s;
      case 'num': { const v = n.v; if (isF(v) && v.dec) return fmtNum(v.num(), digits); if (isF(v)) { const s = (v.n < 0n ? '−' : '') + babs(v.n).toString(); return v.isInt ? s : s + '/' + v.d; } return fmtNum(v, digits); }
      case 'str': return '"' + n.v + '"';
      case 'sym': return NAMES[n.n] || n.n;
      case 'neg': return '−' + P(n.a, 2);
      case 'post': return P(n.a, 5) + n.o;
      case 'eq': return pretty(n.a, digits) + ' = ' + pretty(n.b, digits);
      case 'cmp': return pretty(n.a, digits) + ' ' + ({ '<=': '≤', '>=': '≥', '!=': '≠' }[n.o] || n.o) + ' ' + pretty(n.b, digits);
      case 'list': return '{' + n.items.map(x => pretty(x, digits)).join(', ') + '}';
      case 'mat': return '[' + n.rows.map(r => '[' + r.map(x => pretty(x, digits)).join(', ') + ']').join(', ') + ']';
      case 'call': { const f = n.f.toLowerCase(); if (f === 'sqrt' && n.args.length === 1) { const a = n.args[0]; return '√' + (a.t === 'sym' || (a.t === 'num' && isF(a.v) && a.v.isInt && a.v.n >= 0n) ? pretty(a, digits) : '(' + pretty(a, digits) + ')'); } if (f === 'abs' && n.args.length === 1) return '|' + pretty(n.args[0], digits) + '|'; return n.f + '(' + n.args.map(x => pretty(x, digits)).join(', ') + ')'; }
      case 'bin': {
        const o = n.o;
        if (o === '+') { if (n.b.t === 'neg') return pretty(n.a, digits) + ' − ' + P(n.b.a, 2); if (n.b.t === 'num' && N(n.b.v) < 0) return pretty(n.a, digits) + ' − ' + pretty({ t: 'num', v: isF(n.b.v) ? sNeg(n.b.v) : -n.b.v }, digits); return pretty(n.a, digits) + ' + ' + pretty(n.b, digits); }
        if (o === '-') return pretty(n.a, digits) + ' − ' + P(n.b, 2);
        if (o === '*') { const L = P(n.a, 2), R = P(n.b, 3); const implicit = (n.a.t === 'num' && isF(n.a.v) && n.a.v.isInt) && (n.b.t === 'sym' || n.b.t === 'call' || (n.b.t === 'bin' && n.b.o === '^' && n.b.a.t === 'sym') || /^\(/.test(R)); return implicit ? L + R : L + '·' + R; }
        if (o === '/') return P(n.a, 2) + '/' + P(n.b, 3);
        if (o === '^') { const b = n.b; const base = P(n.a, 5); if (b.t === 'num' && isF(b.v) && b.v.isInt && b.v.n >= 2n && b.v.n <= 99n) return base + sup(b.v.n.toString()); if (b.t === 'num' && isF(b.v) && b.v.n === 1n && b.v.d === 2n) return pretty({ t: 'call', f: 'sqrt', args: [n.a] }, digits); return base + '^' + P(b, 5); }
      }
    }
    return '?';
  }
  function prec(n) { if (n.t === 'hold') return prec(n.a); if (n.t === 'bin') return PREC[n.o]; if (n.t === 'num') { if (N(n.v) < 0) return 2; if (isF(n.v) && !n.v.isInt) return 2; return 9; } return PREC[n.t] !== undefined ? PREC[n.t] : 9; }

  /* ---------- evaluation ---------- */
  const CONST = {};
  const constant = (name, c) => { const k = CONST[name]; if (k === undefined) return undefined; return c.float && isF(k) ? k.num() : k; };
  const cache = new Map();
  function evalSrc(src, c) { let ast = cache.get(src); if (!ast) { ast = parse(src, c); if (cache.size > 500) cache.clear(); cache.set(src, ast); } return ev(ast, c); }
  function look(name, c) {
    if (c.local && c.local.has(name)) return c.local.get(name);
    if (c.vars && Object.prototype.hasOwnProperty.call(c.vars, name)) { if ((c.depth = (c.depth || 0) + 1) > 60) { c.depth = 0; err(name + ' refers to itself'); } try { return evalSrc(c.vars[name], c); } finally { c.depth--; } }
    if (name === 'ans' || name === 'Ans') { if (c.ans == null || c.ans === '') return F0; return evalSrc(c.ans, c); }
    const k = constant(name, c); if (k !== undefined) return k;
    throw new Unknown(name);
  }
  function ev(n, c) {
    switch (n.t) {
      case 'num': return c.float ? (n.f === undefined ? (n.f = N(n.v)) : n.f) : n.v;
      case 'str': return n.v;
      case 'sym': { const v = look(n.n, c); return c.float && isF(v) ? v.num() : v; }
      case 'neg': return neg(ev(n.a, c));
      case 'bin': return op(n.o, ev(n.a, c), ev(n.b, c));
      case 'post': { const v = ev(n.a, c); return n.o === '!' ? E.FN.fact([v], c) : op('/', v, F(100)); }
      case 'list': return n.items.map(x => ev(x, c));
      case 'mat': return new Mat(n.rows.map(r => r.map(x => { const v = ev(x, c); if (!isScalar(v)) err('Matrix entries must be numbers'); return v; })));
      case 'eq': case 'cmp': {
        const a = ev(n.a, c), b = ev(n.b, c);
        if (n.t === 'eq' || n.o === '!=') { const same = isScalar(a) && isScalar(b) ? isZero(sSub(a, b)) : JSON.stringify(ser(a)) === JSON.stringify(ser(b)); return n.o === '!=' ? !same : same; }
        const d = N(sSub(a, b)); return n.o === '<' ? d < 0 : n.o === '>' ? d > 0 : n.o === '<=' ? d <= 1e-12 : d >= -1e-12;
      }
      case 'call': return call(n, c);
      case 'hold': return ev(n.a, c);
      case 'raw': return n.s;
    }
    err('Cannot work that out');
  }
  function call(n, c) {
    const name = n.f, low = name.toLowerCase();
    const uf = c.funcs && c.funcs[name];
    if (uf) {
      if (n.args.length !== uf.params.length) err(name + ' needs ' + uf.params.length + ' value' + (uf.params.length === 1 ? '' : 's'));
      if ((c.depth = (c.depth || 0) + 1) > 200) { c.depth = 0; err(name + ' calls itself too deeply'); }
      try { const local = new Map(c.local || []); uf.params.forEach((p, i) => local.set(p, ev(n.args[i], c))); if (!uf.ast) uf.ast = parse(uf.src, c); return ev(uf.ast, Object.assign({}, c, { local })); } finally { c.depth--; }
    }
    if (E.SPECIAL[low]) return E.SPECIAL[low](n.args, c, n);
    const fn = E.FN[low]; if (fn) return fn(n.args.map(a => ev(a, c)), c);
    err('Unknown function: ' + name);
  }
  /* a value written back as text that parses to exactly the same value */
  function ser(v) {
    if (isF(v)) { const s = v.n.toString() + (v.isInt ? '' : '/' + v.d); return v.isInt && v.n >= 0n ? s : '(' + s + ')'; }
    if (isNum(v)) { if (!isFinite(v)) err('That result is not a finite number'); const s = String(v); return v < 0 ? '(' + s + ')' : s; }
    if (isC(v)) return '(' + String(v.re) + (v.im < 0 ? '-' : '+') + String(Math.abs(v.im)) + '*i)';
    if (isL(v)) return '{' + v.map(ser).join(',') + '}';
    if (isM(v)) return '[' + v.rows.map(r => '[' + r.map(ser).join(',') + ']').join(',') + ']';
    if (typeof v === 'string') return '"' + v + '"';
    if (typeof v === 'boolean') return v ? '1' : '0';
    return '0';
  }

  /* ---------- showing a result ---------- */
  function ratOf(x, maxD) { if (!isFinite(x)) return null; let h0 = 0, h1 = 1, k0 = 1, k1 = 0, y = Math.abs(x); for (let i = 0; i < 30; i++) { const a = Math.floor(y); [h0, h1] = [h1, a * h1 + h0]; [k0, k1] = [k1, a * k1 + k0]; if (k1 > maxD) return null; if (Math.abs(Math.abs(x) - h1 / k1) <= 1e-12 * Math.max(1, Math.abs(x))) return [x < 0 ? -h1 : h1, k1]; const f = y - a; if (f < 1e-15) break; y = 1 / f; } return null; }
  const fracTxt = (p, q) => (p < 0 ? '−' : '') + Math.abs(p) + (q === 1 ? '' : '/' + q);
  function sqfree(n) { let o = 1, r = n; for (let k = 2; k * k <= r; k++) while (r % (k * k) === 0) { r /= k * k; o *= k; } return [o, r]; }
  /* recognise a decimal as a simple exact number: 1/3, 3π/4, √3/2 */
  function recognise(x) {
    if (!isFinite(x) || x === 0 || Number.isInteger(x)) return null;
    let r = ratOf(x, 1000); if (r) return fracTxt(r[0], r[1]);
    r = ratOf(x / Math.PI, 360); if (r) return (r[0] < 0 ? '−' : '') + (Math.abs(r[0]) === 1 ? '' : Math.abs(r[0])) + 'π' + (r[1] === 1 ? '' : '/' + r[1]);
    r = ratOf(x * x, 1000);
    if (r && r[0] > 0) { const [o, s] = sqfree(r[0] * r[1]); if (s > 1) { const g = gcdN(o, r[1]); const co = o / g, de = r[1] / g; return (x < 0 ? '−' : '') + (co === 1 ? '' : co) + '√' + s + (de === 1 ? '' : '/' + de); } }
    return null;
  }
  const gcdN = (a, b) => { while (b) [a, b] = [b, a % b]; return a; };
  function show(v, st) {
    const digits = st.digits || 12, exact = st.mode !== 'approx', base = st.base && st.base !== 10 ? st.base : 0;
    if (isF(v)) {
      if (base && v.isInt) return E.FN.tobase([v, F(base)], ctxOf(st));
      if (v.isInt && v.dec && babs(v.n) >= 1000000000000000n) return fmtNum(v.num(), digits);
      if (v.isInt) { const s = v.n.toString(); return (v.n < 0n ? '−' + s.slice(1) : s); }
      if (exact && !v.dec) return (v.n < 0n ? '−' : '') + babs(v.n) + '/' + v.d;
      return fmtNum(v.num(), digits);
    }
    if (isNum(v)) { if (exact) { const r = recognise(v); if (r) return r; } return fmtNum(v, digits); }
    if (isC(v)) { const re = v.re, im = v.im, ims = Math.abs(im) === 1 ? '' : show(Math.abs(im), st); return (re !== 0 ? show(re, st) + (im < 0 ? ' − ' : ' + ') : (im < 0 ? '−' : '')) + ims + 'i'; }
    if (isL(v)) return '{' + v.map(x => show(x, st)).join(', ') + '}';
    if (isM(v)) return '[' + v.rows.map(r => '[' + r.map(x => show(x, st)).join(', ') + ']').join(', ') + ']';
    if (typeof v === 'boolean') return v ? 'true' : 'false';
    if (typeof v === 'string') return v;
    if (v && v.kind && E.showObj) return E.showObj(v, st);
    return String(v);
  }
  function approxOf(v, st) {
    const s2 = Object.assign({}, st, { mode: 'approx', base: 10 });
    if (isF(v) && !v.isInt && !v.dec) return fmtNum(v.num(), st.digits || 12);
    if (isNum(v) && st.mode !== 'approx' && recognise(v)) return fmtNum(v, st.digits || 12);
    if ((isL(v) || isM(v) || isC(v)) && st.mode !== 'approx') { const a = show(v, s2), b = show(v, st); return a !== b ? a : ''; }
    return '';
  }
  function ctxOf(st) { st = st || {}; const funcs = {}; for (const k in (st.funcs || {})) funcs[k] = { params: st.funcs[k].params, src: st.funcs[k].src }; return { angle: st.angle || 'rad', vars: st.vars || {}, funcs, ans: st.ans, bits: st.bits || 64, st }; }

  /* ---------- one line typed into the calculator ---------- */
  const NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;
  const RESERVED = n => !!(E.FN[n.toLowerCase()] || E.SPECIAL[n.toLowerCase()] || CONST[n] !== undefined || /^ans$/i.test(n));
  function run(text, st) {
    st = st || {}; st.vars = st.vars || {}; st.funcs = st.funcs || {};
    const src = String(text || '').trim(); if (!src) return null;
    const c = ctxOf(st);
    try {
      let m = /^([A-Za-z_]\w*)\s*\(\s*([A-Za-z_]\w*(?:\s*,\s*[A-Za-z_]\w*)*)?\s*\)\s*:=\s*([\s\S]+)$/.exec(src);
      if (m) {
        if (RESERVED(m[1])) err(m[1] + ' is a built-in name. Pick another name.');
        const params = m[2] ? m[2].split(/\s*,\s*/) : [];
        c.funcs[m[1]] = { params, src: m[3] }; const body = parse(m[3], c);
        st.funcs[m[1]] = { params, src: m[3] }; delete st.vars[m[1]];
        return { kind: 'def', input: m[1] + '(' + params.join(', ') + ') := ' + pretty(body), out: 'Defined ' + m[1] + '(' + params.join(', ') + ')', name: m[1] };
      }
      let name = null, body = src;
      if ((m = /^([A-Za-z_]\w*)\s*:=\s*([\s\S]+)$/.exec(src))) { name = m[1]; body = m[2]; }
      else if ((m = /^([\s\S]+?)\s*(?:->|→)\s*([A-Za-z_]\w*)$/.exec(src))) { name = m[2]; body = m[1]; }
      if (name && RESERVED(name)) err(name + ' is a built-in name. Pick another name.');
      const ast = parse(body, c);
      let v;
      if (E.cas && !name && ast.t === 'call' && E.cas.handles(ast.f) && !(c.funcs && c.funcs[ast.f])) return E.cas.symbolic(ast, c, st);
      try { v = ev(ast, c); }
      catch (e) {
        if (!(e instanceof Unknown) || !E.cas) throw e;
        if (name) { st.vars[name] = '(' + body + ')'; delete st.funcs[name]; return { kind: 'def', input: name + ' := ' + pretty(ast), out: name + ' = ' + pretty(E.cas.simplify(ast, c)), name }; }
        return E.cas.symbolic(ast, c, st);
      }
      if (name) { st.vars[name] = ser(v); delete st.funcs[name]; }
      const r = { kind: kindOf(v), input: pretty(ast), value: v, out: show(v, st), alt: approxOf(v, st) };
      if (r.alt === r.out) r.alt = '';
      if (name) r.out = name + ' = ' + r.out;
      if (isScalar(v) || isL(v) || isM(v)) r.ans = ser(v);
      return r;
    } catch (e) {
      if (e instanceof CalcError || e instanceof RangeError) return { kind: 'error', input: src, out: e.message || 'Error', error: true };
      return { kind: 'error', input: src, out: 'Error: ' + (e.message || e), error: true };
    }
  }
  const kindOf = v => isM(v) ? 'matrix' : isL(v) ? 'list' : isC(v) ? 'complex' : typeof v === 'boolean' ? 'bool' : typeof v === 'string' ? 'text' : v && v.kind ? v.kind : 'number';

  /* ---------- graphing: a fast decimal function of x ---------- */
  function compile(src, st, v) {
    v = v || 'x'; const c = Object.assign(ctxOf(st), { float: true, angle: (st && st.angle) || 'rad' });
    const s = String(src).replace(/^\s*[yr]\s*(\(\s*[xθt]\s*\))?\s*=\s*/i, '');
    const ast = parse(s, c); const local = new Map(); c.local = local;
    const f = x => { local.set(v, x); try { const r = ev(ast, c); return typeof r === 'number' ? r : isF(r) ? r.num() : NaN; } catch (e) { return NaN; } };
    try { f(0.5); } catch (e) { /* checked per point */ }
    return { f, ast };
  }

  const E = { Frac, F, F0, F1, Cx, Mat, CalcError, Unknown, err, isF, isC, isM, isL, isNum, isScalar, isZero, absN, N, cx, toC, sAdd, sSub, sMul, sDiv, sPow, sNeg, op, neg, mapV, iroot, bgcd, babs, litFrac, cexp, clog,
    parse, pretty, prec, fmtNum, sup, ratOf, recognise, show, approxOf, ser, ev, look, ctxOf, run, compile, kindOf, CONST, FN: {}, SPECIAL: {}, cas: null, showObj: null };
  if (typeof module !== 'undefined' && module.exports) module.exports = E;
  if (typeof window !== 'undefined') window.CalcEngine = E; else if (typeof globalThis !== 'undefined') globalThis.CalcEngine = E;
})();

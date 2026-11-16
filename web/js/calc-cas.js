// Aurum calculator engine, part 3 of 3: symbolic algebra. Simplify, expand, factor, derivatives, integrals
// (definite ones exactly when an antiderivative is found, otherwise numerically), solve (exact up to quadratics
// plus rational roots, numeric beyond), linear systems, limits and Taylor series. Calculus treats angles as radians.
(function () {
  'use strict';
  const E = typeof CalcEngine !== 'undefined' ? CalcEngine : require('./calc-engine.js');
  const { Frac, F, F0, F1, Cx, Mat, err, isF, isC, isM, isL, isNum, isZero, N, sAdd, sMul, sDiv, sPow, sNeg, babs, iroot, ev, parse, pretty } = E;
  const NUM = v => ({ t: 'num', v }), SYM = n => ({ t: 'sym', n }), B = (o, a, b) => ({ t: 'bin', o, a, b }), CALL = (f, ...args) => ({ t: 'call', f, args }), NEG = a => ({ t: 'neg', a });
  const ONE = NUM(F1), TWO = NUM(F(2)), ZERO = NUM(F0);
  const KEEP_SYM = new Set(['pi', 'e', 'i', 'inf']);
  const ALIAS = { arcsin: 'asin', arccos: 'acos', arctan: 'atan', log10: 'log', sqr: 'sq' };
  const fname = f => { const l = f.toLowerCase(); return ALIAS[l] || l; };

  /* ---------- tree helpers ---------- */
  const kids = n => n.t === 'bin' || n.t === 'eq' || n.t === 'cmp' ? [n.a, n.b] : n.t === 'neg' || n.t === 'post' || n.t === 'hold' ? [n.a] : n.t === 'call' ? n.args : n.t === 'list' ? n.items : n.t === 'mat' ? n.rows.flat() : [];
  function map(n, f) {
    switch (n.t) {
      case 'bin': case 'eq': case 'cmp': return Object.assign({}, n, { a: f(n.a), b: f(n.b) });
      case 'neg': case 'post': case 'hold': return Object.assign({}, n, { a: f(n.a) });
      case 'call': return Object.assign({}, n, { args: n.args.map(f) });
      case 'list': return Object.assign({}, n, { items: n.items.map(f) });
      case 'mat': return Object.assign({}, n, { rows: n.rows.map(r => r.map(f)) });
    }
    return n;
  }
  const free = (n, x) => !(n.t === 'sym' && n.n === x) && kids(n).every(k => free(k, x));
  function freeSyms(n, out) { out = out || []; if (n.t === 'sym' && !KEEP_SYM.has(n.n) && E.CONST[n.n] === undefined && !out.includes(n.n)) out.push(n.n); kids(n).forEach(k => freeSyms(k, out)); return out; }
  const subst = (n, x, v) => (n.t === 'sym' && n.n === x ? v : map(n, k => subst(k, x, v)));
  function valAst(v) {
    if (isF(v) || isNum(v)) return NUM(v);
    if (isC(v)) return B('+', NUM(v.re), B('*', NUM(v.im), SYM('i')));
    if (isL(v)) return { t: 'list', items: v.map(valAst) };
    if (isM(v)) return { t: 'mat', rows: v.rows.map(r => r.map(valAst)) };
    err('That value cannot be used in algebra');
  }
  function key(n) {
    switch (n.t) {
      case 'num': return isF(n.v) ? n.v.n + '/' + n.v.d : 'f' + n.v;
      case 'sym': return n.n;
      case 'call': return fname(n.f) + '(' + n.args.map(key).join(',') + ')';
      case 'bin': return '(' + key(n.a) + n.o + key(n.b) + ')';
      case 'neg': return '-' + key(n.a);
      case 'hold': return 'hold:' + key(n.a);
      case 'raw': return 'raw:' + n.s;
      case 'post': return key(n.a) + n.o;
    }
    return n.t + ':' + JSON.stringify(n);
  }

  /* ---------- names and user functions are written out before the algebra ---------- */
  function inline(n, c, depth) {
    depth = depth || 0; if (depth > 60) err('A definition refers to itself');
    if (n.t === 'sym') {
      const s = n.n;
      if (c.keep && c.keep.has(s)) return n;
      if (c.local && c.local.has(s)) return valAst(c.local.get(s));
      if (c.vars && Object.prototype.hasOwnProperty.call(c.vars, s)) return inline(parse(c.vars[s], c), c, depth + 1);
      if ((s === 'ans' || s === 'Ans') && c.ans) return inline(parse(c.ans, c), c, depth + 1);
      if (KEEP_SYM.has(s)) return n;
      if (E.CONST[s] !== undefined) return valAst(E.CONST[s]);
      return n;
    }
    if (n.t === 'call') {
      const uf = c.funcs && c.funcs[n.f];
      if (uf) { if (n.args.length !== uf.params.length) err(n.f + ' needs ' + uf.params.length + ' values'); let body = parse(uf.src, c); const args = n.args.map(a => inline(a, c, depth + 1)); const tmp = uf.params.map((p, i) => '\u0001' + i); uf.params.forEach((p, i) => { body = subst(body, p, SYM(tmp[i])); }); tmp.forEach((t, i) => { body = subst(body, t, args[i]); }); return inline(body, c, depth + 1); }
      const h = CAS[fname(n.f)]; if (h) return h(n.args, c);
    }
    return map(n, k => inline(k, c, depth + 1));
  }
  const keep = (c, x) => Object.assign({}, c, { keep: new Set([...(c.keep || []), ...[].concat(x)]) });

  /* ---------- canonical form: a sum of terms, each a coefficient times powers of factors ---------- */
  const T = (c, f) => ({ c, f: f || new Map() });
  const isConstS = S => S.length === 0 || (S.length === 1 && S[0].f.size === 0);
  const constOf = S => (S.length === 0 ? F0 : S[0].c);
  const ek = e => isF(e) ? e.n + '/' + e.d : String(e);
  const mkey = t => [...t.f.keys()].sort().map(k => k + '^' + ek(t.f.get(k).e)).join('*');
  function addS(A, Bs) { const m = new Map(); for (const t of A.concat(Bs)) { const k = mkey(t), o = m.get(k); if (o) o.c = sAdd(o.c, t.c); else m.set(k, T(t.c, new Map(t.f))); } return [...m.values()].filter(t => !isZero(t.c)); }
  const scaleS = (A, k) => A.map(t => T(sMul(t.c, k), t.f)).filter(t => !isZero(t.c));
  function setFac(t, k, b, e) {
    if (isZero(e)) { t.f.delete(k); return; }
    if (b.t === 'num' && isF(b.v) && isF(e)) {
      if (e.isInt) { t.c = sMul(t.c, sPow(b.v, e)); t.f.delete(k); return; }
      const fl = e.n >= 0n ? e.n / e.d : -((-e.n + e.d - 1n) / e.d);
      if (fl !== 0n) { t.c = sMul(t.c, sPow(b.v, F(fl))); e = E.sSub(e, F(fl)); }
    }
    if (b.t === 'sym' && b.n === 'i' && isF(e) && e.isInt) { const m = Number(((e.n % 4n) + 4n) % 4n); t.f.delete(k); if (m >= 2) t.c = sNeg(t.c); if (m % 2) t.f.set(k, { b, e: F1 }); return; }
    t.f.set(k, { b, e });
  }
  function mulT(a, b) { const t = T(sMul(a.c, b.c), new Map(a.f)); for (const [k, fa] of b.f) { const o = t.f.get(k); setFac(t, k, fa.b, o ? sAdd(o.e, fa.e) : fa.e); } return t; }
  const atom = (b, e) => { const t = T(F1); setFac(t, key(b), b, e || F1); return [t]; };
  const wrap = S => (S.length === 1 ? S : atom(toAst(S)));
  function mulS(A, Bs, ex) {
    if (!A.length || !Bs.length) return [];
    if (!(ex || isConstS(A) || isConstS(Bs))) { A = wrap(A); Bs = wrap(Bs); }
    let out = []; for (const a of A) for (const b of Bs) out = addS(out, [mulT(a, b)]); return out;
  }
  function coefPow(cf, q) {
    const r = T(F1);
    if (!isF(cf)) { const x = N(cf); if (x < 0 && !Number.isInteger(N(q))) { r.c = Math.pow(-x, N(q)); setFac(r, 'i', SYM('i'), sMul(q, F(2))); return r; } r.c = Math.pow(x, N(q)); return r; }
    const exact = sPow(cf, q); if (isF(exact)) { r.c = exact; return r; }
    let n = cf.n, d = cf.d; if (n < 0n) { if (q.d === 2n) { setFac(r, 'i', SYM('i'), F(q.n)); n = -n; } else if ((q.d & 1n) === 1n) { if ((q.n & 1n) === 1n) r.c = F(-1); n = -n; } else { r.c = Math.pow(N(cf), N(q)); return r; } }
    const part = (v, sign) => { if (v === 1n) return; if (v > 1000000000000n) { setFac(r, key(NUM(F(v))), NUM(F(v)), sign > 0 ? q : sNeg(q)); return; } let o = 1n, s = 1n; for (const [p, k] of E.factorInt(v)) { const kk = BigInt(k); o *= p ** (kk / q.d); s *= p ** (kk % q.d); } if (o !== 1n) r.c = sMul(r.c, sPow(F(o), sign > 0 ? F(q.n) : F(-q.n))); if (s !== 1n) { const k = key(NUM(F(s))), old = r.f.get(k); setFac(r, k, NUM(F(s)), sAdd(old ? old.e : F0, sign > 0 ? q : sNeg(q))); } };
    part(n, 1); part(d, -1); return r;
  }
  function powS(A, q, ex) {
    if (isZero(q)) return [T(F1)];
    if (!A.length) { if (N(q) < 0) err('Division by zero'); return []; }
    if (A.length === 1) { const a = A[0], t = coefPow(a.c, q); for (const [k, fa] of a.f) { const o = t.f.get(k); setFac(t, k, fa.b, o ? sAdd(o.e, sMul(fa.e, q)) : sMul(fa.e, q)); } return [t]; }
    if (isF(q) && q.isInt && q.n > 0n && ex && q.n <= 12n) { let r = [T(F1)]; for (let i = 0n; i < q.n; i++) r = mulS(r, A, true); return r; }
    return atom(toAst(A), q);
  }
  const PI_T = { sin: { '0': F0, '1/6': F(1, 2), '1/2': F1, '5/6': F(1, 2), '1': F0, '7/6': F(-1, 2), '3/2': F(-1), '11/6': F(-1, 2) } };
  function trigPi(f, a) {
    let q; if (a.length === 0) q = F0; else if (a.length === 1 && a[0].f.size === 1 && a[0].f.has('pi') && isF(a[0].c) && N(a[0].f.get('pi').e) === 1) q = a[0].c; else return null;
    q = E.FN.mod([q, F(2)]); const s = x => PI_T.sin[ek(x)];
    const half = S => [T(S === 'r2' ? F(1, 2) : F(1, 2), new Map([[key(NUM(F(S === 'r2' ? 2 : 3))), { b: NUM(F(S === 'r2' ? 2 : 3)), e: F(1, 2) }]]))];
    const sinv = x => { const v = s(x); if (v) return isZero(v) ? [] : [T(v)]; const k = ek(x), m = { '1/4': [1, 'r2'], '3/4': [1, 'r2'], '5/4': [-1, 'r2'], '7/4': [-1, 'r2'], '1/3': [1, 'r3'], '2/3': [1, 'r3'], '4/3': [-1, 'r3'], '5/3': [-1, 'r3'] }[k]; return m ? scaleS(half(m[1]), F(m[0])) : null; };
    if (f === 'sin') return sinv(q);
    if (f === 'cos') return sinv(E.FN.mod([sAdd(q, F(1, 2)), F(2)]));
    if (f === 'tan') { const a1 = sinv(q), b1 = sinv(E.FN.mod([sAdd(q, F(1, 2)), F(2)])); if (!a1 || !b1) return null; if (!b1.length) err('tan is undefined there'); return mulS(a1, powS(b1, F(-1))); }
    return null;
  }
  function fromAst(n, c, ex) {
    switch (n.t) {
      case 'num': return isZero(n.v) ? [] : [T(n.v)];
      case 'sym': return atom(n);
      case 'neg': return scaleS(fromAst(n.a, c, ex), F(-1));
      case 'hold': case 'raw': return atom(n);
      case 'post': { const a = fromAst(n.a, c, ex); if (n.o === '%') return scaleS(a, F(1, 100)); if (isConstS(a)) return fromAst(NUM(E.FN.fact([constOf(a)])), c); return atom(CALL('fact', toAst(a))); }
      case 'bin': {
        const A = fromAst(n.a, c, ex);
        if (n.o === '^') {
          if (n.a.t === 'sym' && n.a.n === 'e' && n.b.t === 'call' && fname(n.b.f) === 'ln') return fromAst(n.b.args[0], c, ex);
          const Bs = fromAst(n.b, c, ex);
          if (isConstS(Bs)) { const q = constOf(Bs); if (isF(q)) return powS(A, q, ex); if (isConstS(A)) return fromAst(NUM(sPow(constOf(A), q)), c); }
          return atom(B('^', toAst(A), toAst(Bs)));
        }
        const Bs = fromAst(n.b, c, ex);
        if (n.o === '+') return addS(A, Bs); if (n.o === '-') return addS(A, scaleS(Bs, F(-1)));
        if (n.o === '*') return mulS(A, Bs, ex); if (n.o === '/') return mulS(A, powS(Bs, F(-1), ex), ex);
        break;
      }
      case 'call': return callS(n, c, ex);
    }
    err('That cannot be simplified');
  }
  const TRIG_ODD = { sin: 1, tan: 1, asin: 1, atan: 1, sinh: 1, tanh: 1 }, TRIG_EVEN = { cos: 1, cosh: 1 };
  function callS(n, c, ex) {
    const f = fname(n.f), args = n.args.map(a => toAst(fromAst(a, c, ex))), a0 = args[0];
    if (f === 'sqrt') return powS(fromAst(a0, c, ex), F(1, 2), ex);
    if (f === 'cbrt') return powS(fromAst(a0, c, ex), F(1, 3), ex);
    if (f === 'sq') return powS(fromAst(a0, c, ex), F(2), ex);
    if (f === 'root' && args[1].t === 'num' && isF(args[1].v)) return powS(fromAst(a0, c, ex), sDiv(F1, args[1].v), ex);
    if (f === 'exp') return fromAst(B('^', SYM('e'), a0), c, ex);
    if (f === 'ln' && a0.t === 'sym' && a0.n === 'e') return [T(F1)];
    if (f === 'ln' && a0.t === 'bin' && a0.o === '^' && a0.a.t === 'sym' && a0.a.n === 'e') return fromAst(a0.b, c, ex);
    if (f === 'log' && freeSyms(a0).length) return mulS(callS(CALL('ln', a0), c, ex), powS(callS(CALL('ln', args[1] || NUM(F(10))), c, ex), F(-1)), ex);
    const consts = args.every(a => !freeSyms(a).length);
    if (consts && !args.some(a => !free(a, 'pi') || !free(a, 'e') || !free(a, 'i'))) { try { const v = ev(CALL(n.f, ...args), Object.assign({}, c, { float: false })); if (isF(v)) return isZero(v) ? [] : [T(v)]; } catch (e) { if (!(e instanceof E.CalcError)) throw e; if (/zero|undefined/i.test(e.message)) throw e; } }
    if ((f === 'sin' || f === 'cos' || f === 'tan') && c.angle !== 'deg' && c.angle !== 'grad') { const r = trigPi(f, fromAst(a0, c, ex)); if (r) return r; }
    if ((TRIG_ODD[f] || TRIG_EVEN[f]) && args.length === 1) { const s = fromAst(a0, c, ex); if (s.length && s.every(t => N(t.c) < 0)) { const inner = callS(CALL(f, toAst(scaleS(s, F(-1)))), c, ex); return TRIG_ODD[f] ? scaleS(inner, F(-1)) : inner; } }
    if (f === 'abs' && consts) { const s = fromAst(a0, c, ex); if (isConstS(s)) return fromAst(NUM(E.FN.abs([constOf(s)])), c); }
    return atom(CALL(f, ...args));
  }
  /* back to a tree, in a readable order: highest powers first, numbers last */
  const facRank = b => (b.t === 'num' ? 0 : b.t === 'sym' ? (KEEP_SYM.has(b.n) ? 1 : 2) : b.t === 'call' ? 3 : 4);
  const degT = t => { let d = 0; for (const fa of t.f.values()) if (!(fa.b.t === 'num' || (fa.b.t === 'sym' && KEEP_SYM.has(fa.b.n)))) d += Math.abs(N(fa.e)); return d; };
  function facAst(b, e) { if (isF(e) && e.n === 1n && e.d === 1n) return b; if (isF(e) && e.n === 1n && e.d === 2n) return CALL('sqrt', b); return B('^', b, NUM(e)); }
  function termAst(t) {
    let c = t.c, neg = false; if (N(c) < 0) { c = sNeg(c); neg = true; }
    const fs = [...t.f.entries()].sort((x, y) => facRank(x[1].b) - facRank(y[1].b) || (x[0] < y[0] ? -1 : 1)), num = [], den = [];
    for (const [, fa] of fs) (N(fa.e) > 0 ? num : den).push(facAst(fa.b, N(fa.e) > 0 ? fa.e : sNeg(fa.e)));
    if (isF(c) && !c.dec) { if (c.n !== 1n || !num.length) num.unshift(NUM(F(c.n))); if (c.d !== 1n) den.unshift(NUM(F(c.d))); }
    else if (N(c) !== 1 || !num.length) num.unshift(NUM(c));
    const prod = l => l.reduce((x, y) => B('*', x, y));
    let r = prod(num); if (den.length) r = B('/', r, prod(den));
    return neg ? NEG(r) : r;
  }
  function toAst(S) {
    if (!S.length) return ZERO;
    const ts = S.slice().sort((a, b) => degT(b) - degT(a) || (mkey(a) < mkey(b) ? -1 : mkey(a) > mkey(b) ? 1 : 0)).map(termAst);
    let a = ts[0]; for (let i = 1; i < ts.length; i++) a = ts[i].t === 'neg' ? B('-', a, ts[i].a) : B('+', a, ts[i]); return a;
  }
  function simp(n, c, ex) {
    if (n.t === 'list') return { t: 'list', items: n.items.map(x => simp(x, c, ex)), br: n.br };
    if (n.t === 'mat') return { t: 'mat', rows: n.rows.map(r => r.map(x => simp(x, c, ex))) };
    if (n.t === 'eq' || n.t === 'cmp') return Object.assign({}, n, { a: simp(n.a, c, ex), b: simp(n.b, c, ex) });
    if (n.t === 'hold' || n.t === 'sols' || n.t === 'raw') return n;
    return toAst(fromAst(n, c, ex));
  }
  const vname = (n, c, e) => { if (n && n.t === 'sym') return n.n; if (n) err('The variable must be a name like x'); const f = freeSyms(inline(e, c)); return f.length === 1 ? f[0] : f.includes('x') || !f.length ? 'x' : f[0]; };

  /* ---------- derivatives ---------- */
  const DT = { sin: u => CALL('cos', u), cos: u => NEG(CALL('sin', u)), tan: u => B('/', ONE, B('^', CALL('cos', u), TWO)), sec: u => B('*', CALL('sec', u), CALL('tan', u)), csc: u => NEG(B('*', CALL('csc', u), CALL('cot', u))), cot: u => NEG(B('/', ONE, B('^', CALL('sin', u), TWO))),
    asin: u => B('/', ONE, CALL('sqrt', B('-', ONE, B('^', u, TWO)))), acos: u => NEG(B('/', ONE, CALL('sqrt', B('-', ONE, B('^', u, TWO))))), atan: u => B('/', ONE, B('+', ONE, B('^', u, TWO))),
    sinh: u => CALL('cosh', u), cosh: u => CALL('sinh', u), tanh: u => B('-', ONE, B('^', CALL('tanh', u), TWO)), asinh: u => B('/', ONE, CALL('sqrt', B('+', B('^', u, TWO), ONE))), acosh: u => B('/', ONE, CALL('sqrt', B('-', B('^', u, TWO), ONE))), atanh: u => B('/', ONE, B('-', ONE, B('^', u, TWO))),
    ln: u => B('/', ONE, u), abs: u => B('/', u, CALL('abs', u)), erf: u => B('*', B('/', TWO, CALL('sqrt', SYM('pi'))), B('^', SYM('e'), NEG(B('^', u, TWO)))) };
  function D(n, x) {
    if (free(n, x)) return ZERO;
    switch (n.t) {
      case 'sym': return ONE;
      case 'neg': return NEG(D(n.a, x));
      case 'hold': return D(n.a, x);
      case 'bin': {
        const a = n.a, b = n.b;
        if (n.o === '+' || n.o === '-') return B(n.o, D(a, x), D(b, x));
        if (n.o === '*') return B('+', B('*', D(a, x), b), B('*', a, D(b, x)));
        if (n.o === '/') return B('/', B('-', B('*', D(a, x), b), B('*', a, D(b, x))), B('^', b, TWO));
        if (n.o === '^') { if (free(b, x)) return B('*', B('*', b, B('^', a, B('-', b, ONE))), D(a, x)); if (free(a, x)) return B('*', B('*', n, CALL('ln', a)), D(b, x)); return B('*', n, B('+', B('*', D(b, x), CALL('ln', a)), B('/', B('*', b, D(a, x)), a))); }
        break;
      }
      case 'call': { const f = fname(n.f), u = n.args[0]; if (f === 'sqrt') return D(B('^', u, NUM(F(1, 2))), x); if (f === 'cbrt') return D(B('^', u, NUM(F(1, 3))), x); if (f === 'exp') return D(B('^', SYM('e'), u), x); if (f === 'log') return B('*', B('/', ONE, B('*', u, CALL('ln', n.args[1] || NUM(F(10))))), D(u, x)); if (DT[f] && n.args.length === 1) return B('*', DT[f](u), D(u, x)); err('No rule for the derivative of ' + n.f); }
    }
    err('Cannot take that derivative');
  }
  function diffAst(args, c) {
    const x = vname(args[1], c, args[0]), c2 = keep(c, x), k = args[2] ? Number(N(ev(args[2], c))) : 1; if (!(k >= 0 && k <= 20 && Number.isInteger(k))) err('Order must be 0 to 20');
    let e = simp(inline(args[0], c2), c2); for (let i = 0; i < k; i++) e = simp(D(e, x), c2); return e;
  }

  /* ---------- polynomials ---------- */
  function polyCoeffs(S, x) {
    const out = [];
    for (const t of S) { let deg = 0; const f = new Map(); for (const [k, fa] of t.f) { if (fa.b.t === 'sym' && fa.b.n === x) { if (!isF(fa.e) || !fa.e.isInt || fa.e.n < 0n) return null; deg = Number(fa.e.n); } else { if (!free(fa.b, x)) return null; f.set(k, fa); } } (out[deg] = out[deg] || []).push(T(t.c, f)); }
    for (let i = 0; i < out.length; i++) out[i] = out[i] || []; return out;
  }
  const linear = (b, x, c) => { const p = polyCoeffs(fromAst(b, c, true), x); if (!p || p.length !== 2 || !p[1].length) return null; return { p: toAst(p[1]), q: toAst(p[0]) }; };

  /* ---------- integrals ---------- */
  const lnabs = u => CALL('ln', CALL('abs', u));
  const IT = { sin: u => NEG(CALL('cos', u)), cos: u => CALL('sin', u), tan: u => NEG(lnabs(CALL('cos', u))), sec: u => lnabs(B('+', CALL('sec', u), CALL('tan', u))), csc: u => NEG(lnabs(B('+', CALL('csc', u), CALL('cot', u)))), cot: u => lnabs(CALL('sin', u)),
    sinh: u => CALL('cosh', u), cosh: u => CALL('sinh', u), tanh: u => CALL('ln', CALL('cosh', u)), ln: u => B('-', B('*', u, CALL('ln', u)), u),
    asin: u => B('+', B('*', u, CALL('asin', u)), CALL('sqrt', B('-', ONE, B('^', u, TWO)))), acos: u => B('-', B('*', u, CALL('acos', u)), CALL('sqrt', B('-', ONE, B('^', u, TWO)))), atan: u => B('-', B('*', u, CALL('atan', u)), B('/', CALL('ln', B('+', ONE, B('^', u, TWO))), TWO)), abs: u => B('/', B('*', u, CALL('abs', u)), TWO) };
  const IT2 = { sin: { 2: u => B('-', B('/', u, TWO), B('/', CALL('sin', B('*', TWO, u)), NUM(F(4)))), '-2': u => NEG(B('/', CALL('cos', u), CALL('sin', u))) }, cos: { 2: u => B('+', B('/', u, TWO), B('/', CALL('sin', B('*', TWO, u)), NUM(F(4)))), '-2': u => CALL('tan', u) }, sec: { 2: u => CALL('tan', u) }, csc: { 2: u => NEG(CALL('cot', u)) } };
  const prodAst = fs => (fs.length ? fs.map(fa => facAst(fa.b, fa.e)).reduce((x, y) => B('*', x, y)) : ONE);
  function intPow(b, e, x, c) {
    const lin = linear(b, x, c);
    if (lin) { if (N(e) === -1) return B('/', lnabs(b), lin.p); return B('/', B('^', b, NUM(sAdd(e, F1))), B('*', lin.p, NUM(sAdd(e, F1)))); }
    const ne = N(e);
    if (b.t === 'call' && b.args.length === 1) { const f = fname(b.f), u = b.args[0], l = linear(u, x, c); if (l) { const g = ne === 1 ? IT[f] : IT2[f] && IT2[f][String(ne)]; if (g) return B('/', g(u), l.p); } }
    if (ne === 1 && b.t === 'bin' && b.o === '^' && free(b.a, x)) { const l = linear(b.b, x, c); if (l) return b.a.t === 'sym' && b.a.n === 'e' ? B('/', b, l.p) : B('/', b, B('*', l.p, CALL('ln', b.a))); }
    const pc = polyCoeffs(fromAst(b, c, true), x);
    if (pc && pc.length === 3 && pc.every(isConstS) && (ne === -1 || ne === -0.5)) {
      const C0 = constOf(pc[0]), C1 = constOf(pc[1]), C2 = constOf(pc[2]), X = SYM(x);
      if (ne === -1) { const Dd = E.sSub(sMul(C1, C1), sMul(F(4), sMul(C2, C0))), lin2 = B('+', B('*', NUM(sMul(F(2), C2)), X), NUM(C1));
        if (isZero(Dd)) return B('/', NUM(F(-2)), lin2);
        if (N(Dd) < 0) { const r = CALL('sqrt', NUM(sNeg(Dd))); return B('*', B('/', TWO, r), CALL('atan', B('/', lin2, r))); }
        const r = CALL('sqrt', NUM(Dd)); return B('*', B('/', ONE, r), lnabs(B('/', B('-', lin2, r), B('+', lin2, r)))); }
      if (isZero(C1) && N(C2) < 0 && N(C0) > 0) return B('/', CALL('asin', B('*', X, CALL('sqrt', NUM(sDiv(sNeg(C2), C0))))), CALL('sqrt', NUM(sNeg(C2))));
      if (isZero(C1) && N(C2) > 0) return B('/', lnabs(B('+', B('*', X, CALL('sqrt', NUM(C2))), CALL('sqrt', b))), CALL('sqrt', NUM(C2)));
    }
    return null;
  }
  function intFactors(fs, x, c, depth) {
    if (!fs.length) return SYM(x);
    if (fs.length === 1) { const r = intPow(fs[0].b, fs[0].e, x, c); if (r) return r; }
    /* substitution: the rest of the product is a constant times the derivative of an inner part */
    for (let i = 0; i < fs.length; i++) {
      const { b, e } = fs[i], others = prodAst(fs.filter((_, j) => j !== i)), tries = [];
      if (!linear(b, x, c)) tries.push([b, u => (N(e) === -1 ? lnabs(u) : B('/', B('^', u, NUM(sAdd(e, F1))), NUM(sAdd(e, F1))))]);
      if (N(e) === 1 && b.t === 'call' && b.args.length === 1 && IT[fname(b.f)]) tries.push([b.args[0], u => IT[fname(b.f)](u)]);
      if (N(e) === 1 && b.t === 'bin' && b.o === '^' && free(b.a, x)) tries.push([b.b, () => (b.a.t === 'sym' && b.a.n === 'e' ? b : B('/', b, CALL('ln', b.a)))]);
      for (const [u, G] of tries) { if (linear(u, x, c) && u !== b) continue; let du; try { du = simp(D(u, x), c); } catch (er) { continue; } if (du.t === 'num' && isZero(du.v)) continue; const ratio = simp(B('/', others, du), c); if (free(ratio, x)) return B('*', ratio, G(u)); }
    }
    /* by parts: x^n times something we can integrate, or a log or inverse trig times x^n */
    if (depth < 8 && fs.length === 2) {
      for (let i = 0; i < 2; i++) {
        const p = fs[i], g = fs[1 - i];
        if (p.b.t !== 'sym' || p.b.n !== x || !isF(p.e)) continue;
        if (p.e.isInt && p.e.n > 0n && !(g.b.t === 'call' && /^(ln|log|asin|acos|atan)$/.test(fname(g.b.f)))) { const G = intPow(g.b, g.e, x, c); if (G) { const rest = antideriv(B('*', B('*', NUM(F(p.e.n)), B('^', SYM(x), NUM(F(p.e.n - 1n)))), G), x, c, depth + 1); if (rest) return B('-', B('*', B('^', SYM(x), NUM(p.e)), G), rest); } }
        if (N(g.e) === 1 && g.b.t === 'call' && /^(ln|asin|acos|atan)$/.test(fname(g.b.f)) && N(p.e) !== -1) { const k = sAdd(p.e, F1), V = B('/', B('^', SYM(x), NUM(k)), NUM(k)), rest = antideriv(B('*', V, D(g.b, x)), x, c, depth + 1); if (rest) return B('-', B('*', g.b, V), rest); }
      }
    }
    return null;
  }
  function antideriv(e, x, c, depth) {
    depth = depth || 0; const S = fromAst(e, c, true); const parts = [];
    for (const t of S) {
      const cf = T(t.c), xf = [];
      for (const [k, fa] of t.f) { if (free(fa.b, x)) cf.f.set(k, fa); else xf.push(fa); }
      const r = intFactors(xf, x, c, depth); if (!r) return null; parts.push(B('*', toAst([cf]), r));
    }
    return parts.length ? simp(parts.reduce((a, b) => B('+', a, b)), c) : ZERO;
  }
  function intAst(args, c) {
    const x = vname(args[1], c, args[0]), c2 = keep(c, x), e = simp(inline(args[0], c2), c2);
    const Fx = antideriv(e, x, c2);
    if (args.length < 4) { if (!Fx) err('No antiderivative found. For a number, add limits: integrate(f, x, a, b)'); return Fx; }
    const a = inline(args[2], c), b = inline(args[3], c), av = N(ev(a, Object.assign({}, c, { float: true }))), bv = N(ev(b, Object.assign({}, c, { float: true })));
    const q = E.quad(E.fnOf(e, x, c2), av, bv);
    if (Fx && isFinite(av) && isFinite(bv)) { try { const r = simp(B('-', subst(Fx, x, b), subst(Fx, x, a)), c); const rv = N(ev(r, Object.assign({}, c, { float: true }))); if (isFinite(rv) && Math.abs(rv - q) <= 1e-7 * (1 + Math.abs(q))) return r; } catch (er) { /* fall through to the numeric value */ } }
    if (!isFinite(q)) err('That integral does not converge');
    return NUM(q);
  }

  /* ---------- solving ---------- */
  function rootsPoly(cs, x, c) {
    while (cs.length && !cs[cs.length - 1].length) cs.pop();
    const deg = cs.length - 1; if (deg < 0) return 'all'; if (deg === 0) return [];
    const numeric = cs.every(isConstS);
    if (deg === 1) return [simp(B('/', NEG(toAst(cs[0])), toAst(cs[1])), c)];
    if (deg === 2 && !numeric) { const a = toAst(cs[2]), b = toAst(cs[1]), k = toAst(cs[0]), Dd = B('-', B('^', b, TWO), B('*', NUM(F(4)), B('*', a, k))); return [simp(B('/', B('-', NEG(b), CALL('sqrt', Dd)), B('*', TWO, a)), c), simp(B('/', B('+', NEG(b), CALL('sqrt', Dd)), B('*', TWO, a)), c)]; }
    if (deg === 2 && numeric) { const a = constOf(cs[2]), b = constOf(cs[1]), k = constOf(cs[0]), Dd = E.sSub(sMul(b, b), sMul(F(4), sMul(a, k))), s = N(a) > 0 ? 1 : -1; if (isZero(Dd)) return [simp(B('/', NUM(sNeg(b)), NUM(sMul(F(2), a))), c)]; const r = CALL('sqrt', NUM(Dd)); return [simp(B('/', B('-', NUM(sNeg(b)), B('*', NUM(F(s)), r)), NUM(sMul(F(2), a))), c), simp(B('/', B('+', NUM(sNeg(b)), B('*', NUM(F(s)), r)), NUM(sMul(F(2), a))), c)]; }
    if (!numeric) err('Only polynomials up to degree 2 can be solved with letters in the coefficients');
    let p = cs.map(constOf); const out = [];
    if (p.every(isF)) {
      const L = p.reduce((m, v) => m / E.bgcd(m, v.d) * v.d, 1n); let ip = p.map(v => v.n * (L / v.d));
      while (ip.length > 1 && ip[0] === 0n) { out.push(ZERO); ip = ip.slice(1); }
      const divs = v => { v = babs(v); const r = []; if (v > 1000000000000n) return r; for (let d = 1n; d * d <= v; d++) if (v % d === 0n) { r.push(d); if (d * d !== v) r.push(v / d); } return r; };
      let found = true;
      while (ip.length > 3 && found) {
        found = false; const an = ip[ip.length - 1], a0 = ip[0];
        for (const pp of divs(a0)) { for (const qq of divs(an)) { for (const s of [1n, -1n]) { const r = F(s * pp, qq); let acc = F0; for (let i = ip.length - 1; i >= 0; i--) acc = sAdd(sMul(acc, r), F(ip[i])); if (isZero(acc)) { out.push(NUM(r)); const nq = []; let carry = F0; for (let i = ip.length - 1; i >= 1; i--) { carry = sAdd(sMul(carry, r), F(ip[i])); nq.unshift(carry); } const L2 = nq.reduce((m, v) => m / E.bgcd(m, v.d) * v.d, 1n); ip = nq.map(v => v.n * (L2 / v.d)); found = true; break; } } if (found) break; } if (found) break; }
      }
      p = ip.map(v => F(v));
    }
    if (p.length <= 3) { const S = p.map(v => (isZero(v) ? [] : [T(v)])); return out.concat(p.length === 1 ? [] : rootsPoly(S, x, c)); }
    /* numeric: all roots at once (Durand-Kerner) */
    const a = p.map(N), n = a.length - 1, lead = a[n], z = []; for (let i = 0; i < n; i++) z.push(new Cx(0.4 + 0.9 * Math.cos(2 * Math.PI * i / n + 0.3), 0.9 * Math.sin(2 * Math.PI * i / n + 0.3)));
    const C = v => E.toC(v), cm = (u, w) => new Cx(u.re * w.re - u.im * w.im, u.re * w.im + u.im * w.re), cd = (u, w) => { const q = w.re * w.re + w.im * w.im; return new Cx((u.re * w.re + u.im * w.im) / q, (u.im * w.re - u.re * w.im) / q); };
    for (let it = 0; it < 2000; it++) { let moved = 0; for (let i = 0; i < n; i++) { let num = new Cx(a[n] / lead, 0); for (let k = n - 1; k >= 0; k--) { num = cm(num, z[i]); num = new Cx(num.re + a[k] / lead, num.im); } let den = new Cx(1, 0); for (let j = 0; j < n; j++) if (j !== i) den = cm(den, new Cx(z[i].re - z[j].re, z[i].im - z[j].im)); const d = cd(num, den); z[i] = new Cx(z[i].re - d.re, z[i].im - d.im); moved = Math.max(moved, Math.hypot(d.re, d.im)); } if (moved < 1e-15) break; }
    z.sort((u, w) => Math.abs(u.im) - Math.abs(w.im) || u.re - w.re);
    for (const r of z) out.push(Math.abs(r.im) < 1e-9 * Math.max(1, Math.abs(r.re)) ? NUM(+r.re.toPrecision(15)) : valAst(new Cx(+r.re.toPrecision(15), +r.im.toPrecision(15))));
    void C; return out;
  }
  function solveOne(eq, x, c) {
    const c2 = keep(c, x); let g = eq.t === 'eq' ? B('-', eq.a, eq.b) : eq; g = inline(g, c2);
    let S = fromAst(g, c2, true);
    const den = T(F1), dens = [];
    for (const t of S) for (const [k, fa] of t.f) if (!free(fa.b, x) && N(fa.e) < 0) { const o = den.f.get(k); if (!o || N(o.e) < -N(fa.e)) { den.f.set(k, { b: fa.b, e: sNeg(fa.e) }); } if (!dens.includes(fa.b)) dens.push(fa.b); }
    if (den.f.size) S = fromAst(toAst(S.map(t => mulT(t, den))), c2, true);
    const pc = polyCoeffs(S, x); let roots;
    if (pc) roots = rootsPoly(pc, x, c2);
    if (roots === 'all') return { t: 'sols', v: x, all: true, items: [] };
    let note = '';
    if (!roots) {
      const f = E.fnOf(toAst(S), x, c2); let r = E.findRoots(f, -100, 100, 20000); if (!r.length) r = E.findRoots(f, -10000, 10000, 40000);
      if (r.length > 10) { note = 'Showing the 10 solutions nearest 0 of ' + r.length + ' found.'; r = r.slice().sort((p, q) => Math.abs(p) - Math.abs(q)).slice(0, 10).sort((p, q) => p - q); }
      roots = r.map(v => { const k = E.ratOf(v, 1000); return k && Math.abs(f(k[0] / k[1])) < 1e-12 ? NUM(F(k[0], k[1])) : NUM(v); });
      if (!roots.length) note = 'No real solution found between −10000 and 10000.';
    }
    const fs = dens.map(b => E.fnOf(b, x, c2));
    roots = roots.filter(r => { try { const v = N(ev(r, Object.assign({}, c2, { float: true }))); return !fs.some(f => Math.abs(f(v)) < 1e-12); } catch (e) { return true; } });
    const seen = new Set(); roots = roots.filter(r => { const k = pretty(r); if (seen.has(k)) return false; seen.add(k); return true; });
    return { t: 'sols', v: x, items: roots, note };
  }
  function solveAst(args, c) {
    const e = args[0];
    if (e.t === 'list') {
      const vars = args[1] && args[1].t === 'list' ? args[1].items.map(v => vname(v, c)) : freeSyms(inline(e, c)).sort(); const c2 = keep(c, vars);
      const A = [], b = [];
      for (const q of e.items) {
        const S = fromAst(inline(q.t === 'eq' ? B('-', q.a, q.b) : q, c2), c2, true), row = vars.map(() => F0); let k = F0;
        for (const t of S) { const hit = [...t.f.values()].filter(fa => fa.b.t === 'sym' && vars.includes(fa.b.n)); if (hit.length > 1 || (hit.length === 1 && N(hit[0].e) !== 1) || t.f.size > hit.length) err('Only linear systems with number coefficients can be solved'); if (hit.length) { const i = vars.indexOf(hit[0].b.n); row[i] = sAdd(row[i], t.c); } else k = sAdd(k, t.c); }
        A.push(row); b.push(sNeg(k));
      }
      const sol = E.FN.linsolve([new Mat(A), b]); return { t: 'sols', sys: true, names: vars, items: sol.map(valAst) };
    }
    const x = vname(args[1], c, e); return solveOne(e, x, c);
  }

  /* ---------- limits ---------- */
  const finiteExact = (n, c) => { try { const v = ev(n, Object.assign({}, c, { float: false })); const x = isC(v) ? v.re : N(v); return isFinite(x) ? simp(n, c) : null; } catch (e) { return null; } };
  function splitFrac(n, c) { const S = fromAst(n, c, false); if (S.length !== 1) return null; const t = S[0], up = T(isF(t.c) ? F(t.c.n) : t.c), dn = T(isF(t.c) ? F(t.c.d) : F1); for (const [k, fa] of t.f) (N(fa.e) > 0 ? up : dn).f.set(k, { b: fa.b, e: N(fa.e) > 0 ? fa.e : sNeg(fa.e) }); return dn.f.size ? [toAst([up]), toAst([dn])] : null; }
  function nice(v) { if (!isFinite(v)) return v > 0 ? SYM('inf') : NEG(SYM('inf')); if (Math.abs(v) < 1e-9) return ZERO; if (Math.abs(v - Math.E) < 1e-8) return SYM('e'); if (Math.abs(v - Math.PI) < 1e-8) return SYM('pi'); const r = E.ratOf(Math.round(v * 1e9) / 1e9, 1000); if (r && Math.abs(v - r[0] / r[1]) < 1e-7 * Math.max(1, Math.abs(v))) return NUM(F(r[0], r[1])); return NUM(+v.toPrecision(10)); }
  function limitAst(args, c) {
    const x = vname(args[1], c, args[0]), c2 = keep(c, x), e = simp(inline(args[0], c2), c2), aA = inline(args[2] || ZERO, c), dir = args[3] ? Math.sign(N(ev(args[3], c))) : 0;
    const av = N(ev(aA, Object.assign({}, c, { float: true })));
    const f = E.fnOf(e, x, c2);
    if (isFinite(av)) {
      if (!dir) { const r = finiteExact(subst(e, x, aA), c2); if (r) return r; }
      let fr = splitFrac(e, c2);
      for (let k = 0; fr && k < 6; k++) { const fn = E.fnOf(fr[0], x, c2), fd = E.fnOf(fr[1], x, c2); if (!(Math.abs(fn(av)) < 1e-12 && Math.abs(fd(av)) < 1e-12)) break; fr = [simp(D(fr[0], x), c2), simp(D(fr[1], x), c2)]; const r = finiteExact(subst(B('/', fr[0], fr[1]), x, aA), c2); if (r) return r; }
      const side = s => { const v = []; for (let j = 8; j <= 26; j += 2) v.push(f(av + s * Math.pow(2, -j))); const l = v[v.length - 1], p = v[v.length - 2]; if (!isFinite(l)) return l; if (Math.abs(l) > 1e7 && Math.abs(l) > Math.abs(p) * 1.5) return Math.sign(l) * Infinity; return 2 * l - p; };
      const R = side(1), Lf = side(-1);
      if (dir > 0) return nice(R); if (dir < 0) return nice(Lf);
      if (isNaN(R) || isNaN(Lf)) err('The limit does not exist');
      if (R === Lf || Math.abs(R - Lf) < 1e-6 * Math.max(1, Math.abs(R))) return nice((R + Lf) / 2);
      err('The limit does not exist: from the left it is ' + E.fmtNum(Lf, 8) + ', from the right ' + E.fmtNum(R, 8));
    }
    const s = Math.sign(av), v = [3, 4, 5, 6, 7, 8].map(k => f(s * Math.pow(10, k)));
    if (Math.abs(v[5]) > 1e8 && Math.abs(v[5]) > Math.abs(v[4]) * 2) return nice(Math.sign(v[5]) * Infinity);
    const x1 = (10 * v[3] - v[2]) / 9, x2 = (10 * v[2] - v[1]) / 9;
    if (Math.abs(x1 - x2) < 1e-6 * Math.max(1, Math.abs(x1))) return nice(x1);
    err('The limit does not settle on a value');
  }

  /* ---------- factor, expand, Taylor ---------- */
  function factorAst(args, c) {
    const e = inline(args[0], c), fv = freeSyms(e);
    if (!fv.length) { const v = ev(e, c); if (isF(v) && v.isInt) return { t: 'raw', s: E.FN.ifactor([v]) }; return simp(e, c); }
    let S = fromAst(e, c, true); if (S.length < 2) return simp(e, c);
    /* common factor of every term */
    const common = T(F1); const first = S[0];
    for (const [k, fa] of first.f) { let m = fa.e; if (!isF(m)) continue; let ok = true; for (const t of S.slice(1)) { const o = t.f.get(k); if (!o || !isF(o.e)) { ok = false; break; } if (N(o.e) < N(m)) m = o.e; } if (ok && N(m) > 0) common.f.set(k, { b: fa.b, e: m }); }
    if (S.every(t => isF(t.c))) { const g = S.map(t => t.c).reduce((a, b) => F(E.bgcd(a.n, b.n), a.d * b.d / E.bgcd(a.d, b.d))); common.c = N(S[0].c) < 0 ? sNeg(g) : g; }
    const inv = powS([common], F(-1)); S = S.map(t => mulT(t, inv[0]));
    const parts = []; if (!(isF(common.c) && common.c.n === 1n && common.c.d === 1n) || common.f.size) parts.push(toAst([common]));
    const x = fv.length === 1 ? fv[0] : null, pc = x && polyCoeffs(S, x);
    if (pc && pc.every(isConstS) && pc.every(s => isF(constOf(s))) && pc.length > 2) {
      const roots = rootsPoly(pc.map(s => s.slice()), x, c).map(r => { try { const v = ev(r, c); return isF(v) ? NUM(v) : null; } catch (e) { return null; } }).filter(Boolean);
      let rest = S; const lin = new Map();
      for (const r of roots) { const fct = fromAst(B('-', B('*', NUM(F(r.v.d)), SYM(x)), NUM(F(r.v.n))), c, true); const k = pretty(toAst(fct)); lin.set(k, (lin.get(k) || 0) + 1); rest = divPoly(rest, fct, x, c); if (!rest) break; }
      if (rest) { for (const [k, m] of lin) parts.push(m > 1 ? B('^', { t: 'hold', a: parse(k, c) }, NUM(F(m))) : { t: 'hold', a: parse(k, c) }); const rs = toAst(rest); if (!(rs.t === 'num' && N(rs.v) === 1)) parts.push(rs.t === 'num' ? rs : { t: 'hold', a: rs }); return { t: 'hold', a: parts.length ? parts.reduce((a, b) => B('*', a, b)) : ONE }; }
    }
    parts.push({ t: 'hold', a: toAst(S) }); return { t: 'hold', a: parts.reduce((a, b) => B('*', a, b)) };
  }
  function divPoly(S, d, x, c) {
    const a = polyCoeffs(S, x), b = polyCoeffs(d, x); if (!a || !b) return null; let num = a.map(constOf), den = b.map(constOf); while (den.length && isZero(den[den.length - 1])) den.pop();
    const q = []; num = num.slice(); for (let i = num.length - den.length; i >= 0; i--) { const k = sDiv(num[i + den.length - 1], den[den.length - 1]); q[i] = k; for (let j = 0; j < den.length; j++) num[i + j] = E.sSub(num[i + j], sMul(k, den[j])); }
    if (num.slice(0, den.length - 1).some(v => !isZero(v))) return null;
    return fromAst(q.map((k, i) => B('*', NUM(k), B('^', SYM(x), NUM(F(i))))).reduce((p, r) => B('+', p, r)), c, true);
  }
  function taylorAst(args, c) {
    const x = vname(args[1], c, args[0]), c2 = keep(c, x), a = inline(args[2] || ZERO, c), n = args[3] ? Number(N(ev(args[3], c))) : 5;
    if (!(n >= 0 && n <= 15)) err('Order must be 0 to 15');
    let d = simp(inline(args[0], c2), c2), out = ZERO, fact = 1n;
    for (let k = 0; k <= n; k++) { if (k) fact *= BigInt(k); const ck = simp(B('/', subst(d, x, a), NUM(F(fact))), c2); out = B('+', out, B('*', ck, B('^', B('-', SYM(x), a), NUM(F(k))))); if (k < n) d = simp(D(d, x), c2); }
    return simp(out, c2, (a.t === 'num' && isZero(a.v)));
  }

  /* ---------- the functions the calculator offers ---------- */
  const CAS = {
    simplify: (a, c) => simp(inline(a[0], c), c),
    expand: (a, c) => simp(inline(a[0], c), c, true),
    factor: factorAst,
    diff: diffAst, derivative: diffAst, deriv: diffAst,
    integrate: intAst, integral: intAst, int: intAst,
    solve: (a, c) => solveAst(a, c),
    limit: limitAst, lim: limitAst,
    taylor: taylorAst,
    subst: (a, c) => { const x = vname(a[1], c, a[0]); return simp(subst(inline(a[0], keep(c, x)), x, inline(a[2], c)), c); }
  };
  /* inside a number calculation (a graph, or diff(x^3, x) at a stored x) the result is worked out to a value */
  for (const k of Object.keys(CAS)) E.SPECIAL[k] = (args, c, node) => {
    let r = c.float && node && node._cas && node._casV === JSON.stringify(c.vars || {}) ? node._cas : null;
    if (!r) { r = CAS[k](args, Object.assign({}, c, { local: null })); if (c.float && node) { node._cas = r; node._casV = JSON.stringify(c.vars || {}); } }
    if (r.t === 'sols') { if (r.all) err('Every value works'); return r.items.map(it => ev(it, c)); }
    return ev(r, c);
  };

  /* ---------- a line with letters in it ---------- */
  function solsText(r, st) {
    if (r.all) return 'Every ' + r.v + ' works';
    if (r.sys) return r.names.map((n, i) => n + ' = ' + pretty(r.items[i], st.digits)).join(',  ');
    if (!r.items.length) return r.note || 'No solution';
    return r.items.map(it => r.v + ' = ' + showAst(it, st)).join('  or  ');
  }
  function showAst(n, st) { if (n.t === 'num') return E.show(n.v, st); try { const v = ev(n, E.ctxOf(st)); if (isNum(v) && st.mode !== 'approx') return pretty(n, st.digits); if (!isF(v) || st.mode === 'approx') return E.show(v, st); } catch (e) { /* letters left */ } return pretty(n, st.digits); }
  function symbolic(ast, c, st) {
    const input = pretty(ast, st.digits);
    let res;
    if (ast.t === 'eq') { const inl = inline(ast, c), fv = freeSyms(inl); res = fv.length === 1 ? solveOne(inl, fv[0], c) : { t: 'eq', a: simp(inl.a, c), b: simp(inl.b, c) }; }
    else { res = inline(ast, c); if (res.t === 'hold') res = res.a; else if (res.t !== 'sols' && res.t !== 'raw') res = simp(res, c); }
    if (res.t === 'sols') {
      const out = solsText(res, st), approx = res.items.length && !res.sys ? res.items.map(it => { try { const v = ev(it, Object.assign({}, c, { float: true })); return res.v + ' ≈ ' + E.show(v, Object.assign({}, st, { mode: 'approx' })); } catch (e) { return ''; } }).filter(Boolean).join('  or  ') : '';
      let ansV = null; try { const vals = res.items.map(it => ev(it, c)); ansV = E.ser(vals.length === 1 ? vals[0] : vals); } catch (e) { /* symbolic roots */ }
      return { kind: 'solve', input, out, alt: approx && approx.replace(/≈/g, '=') !== out ? approx : '', note: res.note || '', ans: ansV || undefined };
    }
    if (res.t === 'raw') return { kind: 'text', input, out: res.s };
    if (!freeSyms(res).length) {
      try { const v = ev(res, c); const exactTxt = st.mode === 'approx' ? E.show(v, st) : (isNum(v) || isC(v) ? pretty(res, st.digits) : E.show(v, st)); const approx = E.show(v, Object.assign({}, st, { mode: 'approx' })); return { kind: E.kindOf(v), input, value: v, out: exactTxt, alt: approx !== exactTxt ? approx : '', ans: E.ser(v) }; } catch (e) { if (!(e instanceof E.CalcError)) throw e; }
    }
    const isInt = ast.t === 'call' && /^(integrate|integral|int)$/i.test(ast.f) && ast.args.length < 4;
    const out = pretty(res, st.digits) + (isInt ? ' + C' : '');
    return { kind: 'expr', input, out, ans: '(' + pretty(res) + ')', ast: res };
  }
  E.cas = { handles: name => !!CAS[fname(name)], simplify: (n, c) => simp(inline(n, c), c), symbolic, inline, simp, D, antideriv, freeSyms };
})();

// Coding › Playground: small interpreters for four classic practical languages, written for Moundshroud so they run
// offline in the Playground's worker: Scheme (a core of R7RS: define, lambda, let forms, cond, case, do, named let,
// tail calls, lists, strings, vectors, call/cc as an escape), Prolog (clauses, backtracking, cut, arithmetic, lists,
// findall, assert, format), Forth (colon words, IF/ELSE/THEN, DO/LOOP, BEGIN loops, VARIABLE, CONSTANT) and BASIC
// (line numbers optional; PRINT, INPUT, IF, FOR, WHILE, GOSUB, DIM, string functions). They add themselves to Esolangs.L.
(function (root) {
  'use strict';
  const E = root.Esolangs, L = E.L;
  const fail = m => { throw new Error(m); };

  /* =================== Scheme =================== */
  L.scheme = (code, io) => {
    class Sym { constructor(n) { this.n = n; } }
    const syms = new Map(), sym = n => { if (!syms.has(n)) syms.set(n, new Sym(n)); return syms.get(n); };
    const NIL = { nil: true };
    class Pair { constructor(a, d) { this.car = a; this.cdr = d; } }
    class Char { constructor(c) { this.c = c; } }
    class Str { constructor(s) { this.s = s; } }
    class Proc { constructor(params, rest, body, env, name) { this.params = params; this.rest = rest; this.body = body; this.env = env; this.name = name; } }
    class Escape { constructor(tag, v) { this.tag = tag; this.v = v; } }
    const list = (...xs) => xs.reduceRight((d, a) => new Pair(a, d), NIL);
    const toArr = l => { const a = []; while (l instanceof Pair) { a.push(l.car); l = l.cdr; } if (l !== NIL) fail('Not a proper list.'); return a; };
    /* reader */
    let i = 0;
    const skip = () => { for (;;) { while (i < code.length && /\s/.test(code[i])) i++; if (code[i] === ';') { while (i < code.length && code[i] !== '\n') i++; continue; } if (code.startsWith('#|', i)) { const e = code.indexOf('|#', i); i = e < 0 ? code.length : e + 2; continue; } if (code.startsWith('#;', i)) { i += 2; read(); continue; } return; } };
    const read = () => {
      skip();
      if (i >= code.length) return undefined;
      const c = code[i];
      if (c === '(' || c === '[') {
        const close = c === '(' ? ')' : ']'; i++; const items = []; let tail = NIL;
        for (;;) {
          skip(); if (i >= code.length) fail('A ( is never closed.');
          if (code[i] === close) { i++; break; }
          if (code[i] === '.' && /[\s()]/.test(code[i + 1] || ' ')) { i++; tail = read(); skip(); if (code[i] !== close) fail('Bad dotted list.'); i++; break; }
          items.push(read());
        }
        return items.reduceRight((d, a) => new Pair(a, d), tail);
      }
      if (c === ')' || c === ']') fail('Unexpected ).');
      if (c === "'") { i++; return list(sym('quote'), read()); }
      if (c === '`') { i++; return list(sym('quasiquote'), read()); }
      if (c === ',') { i++; if (code[i] === '@') { i++; return list(sym('unquote-splicing'), read()); } return list(sym('unquote'), read()); }
      if (c === '"') { let s = ''; i++; while (i < code.length && code[i] !== '"') { if (code[i] === '\\') { i++; const e = code[i]; s += e === 'n' ? '\n' : e === 't' ? '\t' : e; } else s += code[i]; i++; } if (i >= code.length) fail('A string is never closed.'); i++; return new Str(s); }
      if (code.startsWith('#\\', i)) { i += 2; const m = /^(space|newline|tab|nul|[^\s()])[^\s()]*/.exec(code.slice(i)); const w = m[0]; i += w.length; return new Char(w === 'space' ? ' ' : w === 'newline' ? '\n' : w === 'tab' ? '\t' : w === 'nul' ? '\0' : w.length > 1 ? fail('Unknown character #\\' + w) : w); }
      if (code.startsWith('#(', i)) { i++; const l = read(); return toArr(l); }
      let j = i; while (j < code.length && !/[\s()[\]";]/.test(code[j])) j++;
      const t = code.slice(i, j); i = j;
      if (t === '#t' || t === '#true') return true;
      if (t === '#f' || t === '#false') return false;
      if (/^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i.test(t)) return Number(t);
      if (/^[+-]?\d+\/\d+$/.test(t)) { const [a, b] = t.split('/'); return Number(a) / Number(b); }
      return sym(t.toLowerCase());
    };
    const prog = []; for (;;) { const x = read(); if (x === undefined) break; prog.push(x); }
    /* printer */
    const show = (x, w) => {
      if (x === true) return '#t'; if (x === false) return '#f'; if (x === NIL) return '()'; if (x === undefined) return '';
      if (typeof x === 'number') return Number.isInteger(x) ? String(x) : String(x);
      if (x instanceof Sym) return x.n; if (x instanceof Str) return w ? JSON.stringify(x.s) : x.s;
      if (x instanceof Char) return w ? '#\\' + (x.c === ' ' ? 'space' : x.c === '\n' ? 'newline' : x.c) : x.c;
      if (Array.isArray(x)) return '#(' + x.map(y => show(y, w)).join(' ') + ')';
      if (x instanceof Proc || typeof x === 'function') return '#<procedure' + (x.name ? ' ' + x.name : '') + '>';
      if (x instanceof Pair) {
        if (x.car instanceof Sym && x.cdr instanceof Pair && x.cdr.cdr === NIL) { const q = { quote: "'", quasiquote: '`', unquote: ',' }[x.car.n]; if (q) return q + show(x.cdr.car, w); }
        const parts = []; let l = x; while (l instanceof Pair) { parts.push(show(l.car, w)); l = l.cdr; }
        return '(' + parts.join(' ') + (l !== NIL ? ' . ' + show(l, w) : '') + ')';
      }
      return String(x);
    };
    /* environments */
    class Env { constructor(up) { this.v = new Map(); this.up = up; } find(s) { for (let e = this; e; e = e.up) if (e.v.has(s)) return e; fail('Unbound variable: ' + s.n); } get(s) { return this.find(s).v.get(s); } }
    const G = new Env(null);
    const def = (n, f) => { f.sname = n; G.v.set(sym(n), f); };
    const truthy = x => x !== false;
    const num = (x, who) => { if (typeof x !== 'number') fail(who + ': ' + show(x, true) + ' is not a number.'); return x; };
    const eqv = (a, b) => a === b || (a instanceof Char && b instanceof Char && a.c === b.c) || (typeof a === 'number' && a === b) || (a instanceof Str && b instanceof Str && a === b);
    const equal = (a, b) => { if (eqv(a, b)) return true; if (a instanceof Pair && b instanceof Pair) return equal(a.car, b.car) && equal(a.cdr, b.cdr); if (a instanceof Str && b instanceof Str) return a.s === b.s; if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((x, k) => equal(x, b[k])); return false; };
    const arith = (n, f, unit) => def(n, (...a) => { a.forEach(x => num(x, n)); if (!a.length) return unit; if (a.length === 1) return f(unit, a[0]); return a.reduce(f); });
    arith('+', (a, b) => a + b, 0); arith('*', (a, b) => a * b, 1); arith('-', (a, b) => a - b, 0); arith('/', (a, b) => { if (b === 0) fail('Division by zero.'); return a / b; }, 1);
    const cmp = (n, f) => def(n, (...a) => { a.forEach(x => num(x, n)); for (let k = 1; k < a.length; k++) if (!f(a[k - 1], a[k])) return false; return true; });
    cmp('=', (a, b) => a === b); cmp('<', (a, b) => a < b); cmp('>', (a, b) => a > b); cmp('<=', (a, b) => a <= b); cmp('>=', (a, b) => a >= b);
    def('quotient', (a, b) => { if (!b) fail('Division by zero.'); return Math.trunc(a / b); }); def('remainder', (a, b) => a % b); def('modulo', (a, b) => ((a % b) + b) % b);
    def('abs', Math.abs); def('min', Math.min); def('max', Math.max); def('sqrt', x => { const r = Math.sqrt(x); return r; }); def('expt', (a, b) => a ** b); def('exp', Math.exp); def('log', Math.log); def('sin', Math.sin); def('cos', Math.cos); def('atan', Math.atan);
    def('floor', Math.floor); def('ceiling', Math.ceil); def('round', x => { const r = Math.round(x); return Math.abs(x % 1) === 0.5 && r % 2 ? r - 1 : r; }); def('truncate', Math.trunc);
    def('exact->inexact', x => x); def('inexact->exact', Math.round); def('exact', Math.round); def('inexact', x => x); def('square', x => x * x); def('gcd', (a = 0, b = 0) => { a = Math.abs(a); b = Math.abs(b); while (b) [a, b] = [b, a % b]; return a; });
    def('number?', x => typeof x === 'number'); def('integer?', x => Number.isInteger(x)); def('zero?', x => x === 0); def('positive?', x => x > 0); def('negative?', x => x < 0); def('even?', x => x % 2 === 0); def('odd?', x => Math.abs(x % 2) === 1);
    def('not', x => x === false); def('eq?', eqv); def('eqv?', eqv); def('equal?', equal);
    def('cons', (a, b) => new Pair(a, b)); def('car', p => { if (!(p instanceof Pair)) fail('car: ' + show(p, true) + ' is not a pair.'); return p.car; }); def('cdr', p => { if (!(p instanceof Pair)) fail('cdr: ' + show(p, true) + ' is not a pair.'); return p.cdr; });
    ['caar', 'cadr', 'cdar', 'cddr', 'caddr', 'cdddr', 'cadddr'].forEach(n => def(n, p => { for (const c of n.slice(1, -1).split('').reverse()) { if (!(p instanceof Pair)) fail(n + ': not a pair.'); p = c === 'a' ? p.car : p.cdr; } return p; }));
    def('set-car!', (p, v) => { p.car = v; }); def('set-cdr!', (p, v) => { p.cdr = v; });
    def('list', list); def('length', l => toArr(l).length); def('list?', l => { while (l instanceof Pair) l = l.cdr; return l === NIL; }); def('pair?', x => x instanceof Pair); def('null?', x => x === NIL);
    def('append', (...ls) => { if (!ls.length) return NIL; let out = ls[ls.length - 1]; for (let k = ls.length - 2; k >= 0; k--) out = toArr(ls[k]).reduceRight((d, a) => new Pair(a, d), out); return out; });
    def('reverse', l => toArr(l).reduce((d, a) => new Pair(a, d), NIL)); def('list-ref', (l, n) => toArr(l)[n]); def('list-tail', (l, n) => { while (n-- > 0) l = l.cdr; return l; });
    def('memq', (x, l) => { while (l instanceof Pair) { if (eqv(x, l.car)) return l; l = l.cdr; } return false; }); def('member', (x, l) => { while (l instanceof Pair) { if (equal(x, l.car)) return l; l = l.cdr; } return false; }); G.v.set(sym('memv'), G.get(sym('memq')));
    def('assq', (x, l) => { for (const p of toArr(l)) if (eqv(x, p.car)) return p; return false; }); def('assoc', (x, l) => { for (const p of toArr(l)) if (equal(x, p.car)) return p; return false; }); G.v.set(sym('assv'), G.get(sym('assq')));
    def('symbol?', x => x instanceof Sym); def('string?', x => x instanceof Str); def('char?', x => x instanceof Char); def('boolean?', x => typeof x === 'boolean'); def('vector?', Array.isArray);
    def('procedure?', x => x instanceof Proc || typeof x === 'function');
    def('symbol->string', s => new Str(s.n)); def('string->symbol', s => sym(s.s)); def('number->string', (n, r) => new Str(n.toString(r || 10))); def('string->number', (s, r) => { const v = r ? parseInt(s.s, r) : Number(s.s); return isNaN(v) ? false : v; });
    def('string-append', (...s) => new Str(s.map(x => x.s).join(''))); def('string-length', s => s.s.length); def('substring', (s, a, b) => new Str(s.s.slice(a, b === undefined ? undefined : b))); def('string-ref', (s, k) => new Char(s.s[k]));
    def('string=?', (a, b) => a.s === b.s); def('string<?', (a, b) => a.s < b.s); def('string>?', (a, b) => a.s > b.s); def('string-upcase', s => new Str(s.s.toUpperCase())); def('string-downcase', s => new Str(s.s.toLowerCase()));
    def('string->list', s => list(...[...s.s].map(c => new Char(c)))); def('list->string', l => new Str(toArr(l).map(c => c.c).join(''))); def('string', (...cs) => new Str(cs.map(c => c.c).join(''))); def('make-string', (n, c) => new Str((c ? c.c : ' ').repeat(n)));
    def('char->integer', c => c.c.codePointAt(0)); def('integer->char', n => new Char(String.fromCodePoint(n))); def('char-upcase', c => new Char(c.c.toUpperCase())); def('char-downcase', c => new Char(c.c.toLowerCase()));
    def('char-alphabetic?', c => /\p{L}/u.test(c.c)); def('char-numeric?', c => /\d/.test(c.c)); def('char-whitespace?', c => /\s/.test(c.c)); def('char=?', (a, b) => a.c === b.c);
    def('vector', (...a) => a); def('make-vector', (n, f) => new Array(n).fill(f === undefined ? 0 : f)); def('vector-ref', (v, k) => { if (k < 0 || k >= v.length) fail('vector-ref: index ' + k + ' is out of range.'); return v[k]; }); def('vector-set!', (v, k, x) => { v[k] = x; });
    def('vector-length', v => v.length); def('vector->list', v => list(...v)); def('list->vector', l => toArr(l)); def('vector-fill!', (v, x) => { v.fill(x); });
    def('display', x => { io.out(show(x, false)); }); def('write', x => { io.out(show(x, true)); }); def('newline', () => { io.out('\n'); }); def('write-string', s => { io.out(s.s); }); def('write-char', c => { io.out(c.c); });
    def('read-line', () => { const l = io.getline(); return l === null ? sym('eof') : new Str(l); }); def('read', () => { const n = io.getn(); return n === null ? sym('eof') : n; });
    def('error', (m, ...xs) => fail((m instanceof Str ? m.s : show(m, true)) + (xs.length ? ' ' + xs.map(x => show(x, true)).join(' ') : '')));
    def('exit', () => { throw new Escape('exit'); });
    def('void', () => undefined);
    /* procedures that call back into Scheme */
    const call = (f, args) => { if (typeof f === 'function') return f(...args); if (f instanceof Proc) return evaluate(f.body, bind(f, args)); fail(show(f, true) + ' is not a procedure.'); };
    def('apply', (f, ...a) => { const last = a.pop(); return call(f, a.concat(toArr(last))); });
    def('map', (f, ...ls) => { const as = ls.map(toArr), n = Math.min(...as.map(a => a.length)), out = []; for (let k = 0; k < n; k++) out.push(call(f, as.map(a => a[k]))); return list(...out); });
    def('for-each', (f, ...ls) => { const as = ls.map(toArr), n = Math.min(...as.map(a => a.length)); for (let k = 0; k < n; k++) call(f, as.map(a => a[k])); });
    def('vector-map', (f, v) => v.map(x => call(f, [x]))); def('vector-for-each', (f, v) => { v.forEach(x => call(f, [x])); });
    def('filter', (f, l) => list(...toArr(l).filter(x => truthy(call(f, [x])))));
    def('reduce', (f, init, l) => { const a = toArr(l); if (!a.length) return init; return a.reduce((acc, x) => call(f, [x, acc])); });
    def('fold-left', (f, init, l) => toArr(l).reduce((acc, x) => call(f, [acc, x]), init)); def('fold-right', (f, init, l) => toArr(l).reduceRight((acc, x) => call(f, [x, acc]), init)); G.v.set(sym('fold'), (f, init, l) => toArr(l).reduce((acc, x) => call(f, [x, acc]), init));
    def('list-sort', (f, l) => list(...toArr(l).sort((a, b) => truthy(call(f, [a, b])) ? -1 : truthy(call(f, [b, a])) ? 1 : 0))); def('sort', (l, f) => list(...toArr(l).sort((a, b) => truthy(call(f, [a, b])) ? -1 : truthy(call(f, [b, a])) ? 1 : 0)));
    def('call-with-current-continuation', f => { const tag = {}; try { return call(f, [Object.assign((...v) => { throw new Escape(tag, v[0]); }, { sname: 'continuation' })]); } catch (x) { if (x instanceof Escape && x.tag === tag) return x.v; throw x; } });
    G.v.set(sym('call/cc'), G.get(sym('call-with-current-continuation')));
    def('iota', (n, s = 0, st = 1) => list(...Array.from({ length: n }, (_, k) => s + k * st)));
    const bind = (f, args) => {
      const env = new Env(f.env);
      if (args.length < f.params.length || (!f.rest && args.length > f.params.length)) fail((f.name || 'lambda') + ' takes ' + f.params.length + (f.rest ? ' or more' : '') + ' arguments, got ' + args.length + '.');
      f.params.forEach((p, k) => env.v.set(p, args[k]));
      if (f.rest) env.v.set(f.rest, list(...args.slice(f.params.length)));
      return env;
    };
    const S = n => sym(n);
    const QUOTE = S('quote'), IF = S('if'), DEFINE = S('define'), LAMBDA = S('lambda'), SET = S('set!'), BEGIN = S('begin'), LET = S('let'), LETS = S('let*'), LETREC = S('letrec'), LETRECS = S('letrec*'), COND = S('cond'), ELSE = S('else'), AND = S('and'), OR = S('or'), WHEN = S('when'), UNLESS = S('unless'), CASE = S('case'), DO = S('do'), QQ = S('quasiquote'), UNQ = S('unquote'), UNQS = S('unquote-splicing'), ARROW = S('=>'), DELAY = S('delay'), NAMED = S('named-lambda'), DEFREC = S('define-record-type');
    const lambda = (params, body, env, name) => { const ps = []; let p = params, rest = null; while (p instanceof Pair) { ps.push(p.car); p = p.cdr; } if (p instanceof Sym) rest = p; return new Proc(ps, rest, new Pair(BEGIN, body), env, name); };
    const qq = (x, env, depth) => {
      if (!(x instanceof Pair)) return Array.isArray(x) ? toArr(qq(list(...x), env, depth)) : x;
      if (x.car === UNQ) return depth === 1 ? evaluate(x.cdr.car, env) : list(UNQ, qq(x.cdr.car, env, depth - 1));
      if (x.car === QQ) return list(QQ, qq(x.cdr.car, env, depth + 1));
      if (x.car instanceof Pair && x.car.car === UNQS && depth === 1) { const spl = evaluate(x.car.cdr.car, env); const rest = qq(x.cdr, env, depth); return toArr(spl).reduceRight((d, a) => new Pair(a, d), rest); }
      return new Pair(qq(x.car, env, depth), qq(x.cdr, env, depth));
    };
    let depth = 0;
    function evaluate(x, env) {
      if (++depth > 9000) { depth = 0; fail('Too much recursion (more than 9000 nested calls that are not in tail position).'); }
      try {
        for (;;) {
          io.tick();
          if (x instanceof Sym) return env.get(x);
          if (!(x instanceof Pair)) return x instanceof Str ? x : x;
          const op = x.car, args = x.cdr;
          if (op === QUOTE) return args.car;
          if (op === QQ) return qq(args.car, env, 1);
          if (op === IF) { x = truthy(evaluate(args.car, env)) ? args.cdr.car : (args.cdr.cdr instanceof Pair ? args.cdr.cdr.car : undefined); if (x === undefined) return undefined; continue; }
          if (op === DEFINE) {
            if (args.car instanceof Pair) { let head = args.car, body = args.cdr; while (head.car instanceof Pair) { body = list(new Pair(LAMBDA, new Pair(head.cdr, body))); head = head.car; } env.v.set(head.car, lambda(head.cdr, body, env, head.car.n)); return undefined; }
            const v = evaluate(args.cdr.car, env); if (v instanceof Proc && !v.name) v.name = args.car.n; env.v.set(args.car, v); return undefined;
          }
          if (op === SET) { env.find(args.car).v.set(args.car, evaluate(args.cdr.car, env)); return undefined; }
          if (op === LAMBDA) return lambda(args.car, args.cdr, env);
          if (op === NAMED) return lambda(args.car.cdr, args.cdr, env, args.car.car.n);
          if (op === BEGIN) { if (args === NIL) return undefined; let b = args; while (b.cdr instanceof Pair) { evaluate(b.car, env); b = b.cdr; } x = b.car; continue; }
          if (op === LET || op === LETS || op === LETREC || op === LETRECS) {
            if (op === LET && args.car instanceof Sym) { /* named let */
              const name = args.car, binds = toArr(args.cdr.car), body = args.cdr.cdr, e2 = new Env(env);
              const f = lambda(list(...binds.map(b => b.car)), body, e2, name.n); e2.v.set(name, f);
              const vals = binds.map(b => evaluate(b.cdr.car, env)); env = bind(f, vals); x = f.body; continue;
            }
            const binds = toArr(args.car), e2 = new Env(env);
            if (op === LET) binds.forEach(b => e2.v.set(b instanceof Pair ? b.car : b, b instanceof Pair && b.cdr !== NIL ? evaluate(b.cdr.car, env) : undefined));
            else { if (op !== LETS) binds.forEach(b => e2.v.set(b.car, undefined)); let e3 = e2; binds.forEach(b => { if (op === LETS) { const v = evaluate(b.cdr.car, e3); e3 = new Env(e3); e3.v.set(b.car, v); } else e2.v.set(b.car, evaluate(b.cdr.car, e2)); }); env = op === LETS ? e3 : e2; x = new Pair(BEGIN, args.cdr); continue; }
            env = e2; x = new Pair(BEGIN, args.cdr); continue;
          }
          if (op === COND) {
            let c = args, next;
            for (; c instanceof Pair; c = c.cdr) {
              const cl = c.car;
              if (cl.car === ELSE) { next = new Pair(BEGIN, cl.cdr); break; }
              const t = evaluate(cl.car, env);
              if (truthy(t)) { if (cl.cdr === NIL) return t; if (cl.cdr.car === ARROW) return call(evaluate(cl.cdr.cdr.car, env), [t]); next = new Pair(BEGIN, cl.cdr); break; }
            }
            if (!next) return undefined; x = next; continue;
          }
          if (op === CASE) {
            const k = evaluate(args.car, env); let next;
            for (const cl of toArr(args.cdr)) { if (cl.car === ELSE || toArr(cl.car).some(d => eqv(d, k))) { next = new Pair(BEGIN, cl.cdr); break; } }
            if (!next) return undefined; x = next; continue;
          }
          if (op === AND) { if (args === NIL) return true; let b = args; while (b.cdr instanceof Pair) { if (!truthy(evaluate(b.car, env))) return false; b = b.cdr; } x = b.car; continue; }
          if (op === OR) { if (args === NIL) return false; let b = args; while (b.cdr instanceof Pair) { const v = evaluate(b.car, env); if (truthy(v)) return v; b = b.cdr; } x = b.car; continue; }
          if (op === WHEN || op === UNLESS) { const t = truthy(evaluate(args.car, env)); if (t !== (op === WHEN)) return undefined; x = new Pair(BEGIN, args.cdr); continue; }
          if (op === DO) {
            const specs = toArr(args.car), test = toArr(args.cdr.car), body = args.cdr.cdr, e2 = new Env(env);
            specs.forEach(s => e2.v.set(s.car, evaluate(s.cdr.car, env)));
            for (;;) {
              io.tick();
              if (truthy(evaluate(test[0], e2))) { let r; for (const t of test.slice(1)) r = evaluate(t, e2); return r; }
              toArr(body).forEach(b => evaluate(b, e2));
              const nv = specs.filter(s => s.cdr.cdr instanceof Pair).map(s => [s.car, evaluate(s.cdr.cdr.car, e2)]);
              nv.forEach(([k, v]) => e2.v.set(k, v));
            }
          }
          if (op === DELAY) { let done = false, val; const ex = args.car, e2 = env; return Object.assign(() => { if (!done) { val = evaluate(ex, e2); done = true; } return val; }, { promise: true, sname: 'promise' }); }
          if (op === DEFREC) {
            const [, ctor, pred, ...fields] = toArr(args); const names = toArr(ctor.cdr).map(s => s.n), tag = {};
            env.v.set(ctor.car, (...a) => ({ rec: tag, f: Object.fromEntries(names.map((n, k) => [n, a[k]])) }));
            env.v.set(pred, x => !!x && x.rec === tag);
            fields.forEach(fd => { const f = toArr(fd); env.v.set(f[1], r => r.f[f[0].n]); if (f[2]) env.v.set(f[2], (r, v) => { r.f[f[0].n] = v; }); });
            return undefined;
          }
          /* application */
          const f = evaluate(op, env), a = []; for (let p = args; p instanceof Pair; p = p.cdr) a.push(evaluate(p.car, env));
          if (typeof f === 'function') return f.promise ? f() : f(...a);
          if (!(f instanceof Proc)) fail(show(f, true) + ' is not a procedure (in ' + show(x, true).slice(0, 60) + ').');
          env = bind(f, a); x = f.body;
        }
      } finally { depth--; }
    }
    def('force', p => typeof p === 'function' && p.promise ? p() : p);
    def('eval', (x) => evaluate(x, G));
    try { for (const x of prog) evaluate(x, G); }
    catch (e) { if (e instanceof Escape && e.tag === 'exit') return; if (e instanceof Escape) fail('A continuation was called after its call/cc returned (only escaping continuations are supported).'); throw e; }
  };

  /* =================== Prolog =================== */
  L.prolog = (code, io) => {
    /* terms: {a:'atom'} atoms, numbers, {v:name,id} variables, {f:'name', args:[...]} compound; strings are code lists */
    class Var { constructor(n) { this.n = n; this.ref = undefined; } }
    const atom = a => ({ a });
    const ATOMS = new Map(), A = a => { if (!ATOMS.has(a)) ATOMS.set(a, atom(a)); return ATOMS.get(a); };
    const NILA = A('[]');
    const S = (f, ...args) => ({ f, args });
    const deref = t => { while (t instanceof Var && t.ref !== undefined) t = t.ref; return t; };
    const mkList = (xs, tail = NILA) => xs.reduceRight((d, x) => S('.', x, d), tail);
    /* tokenizer */
    const lexText = s => {
      const toks = []; let i = 0;
      while (i < s.length) {
        const c = s[i];
        if (/\s/.test(c)) { i++; continue; }
        if (c === '%') { while (i < s.length && s[i] !== '\n') i++; continue; }
        if (s.startsWith('/*', i)) { const e = s.indexOf('*/', i + 2); i = e < 0 ? s.length : e + 2; continue; }
        let m;
        if ((m = /^\d+(\.\d+)?([eE][+-]?\d+)?/.exec(s.slice(i)))) { if (m[0].includes('.') && !/\d/.test(s[i + m[0].indexOf('.') + 1] || '')) m[0] = m[0].split('.')[0]; toks.push({ k: 'n', v: Number(m[0]) }); i += m[0].length; continue; }
        if (s.startsWith("0'", i)) { toks.push({ k: 'n', v: s.codePointAt(i + 2) }); i += 3; continue; }
        if ((m = /^[A-Z_][A-Za-z0-9_]*/.exec(s.slice(i)))) { toks.push({ k: 'v', v: m[0] }); i += m[0].length; continue; }
        if ((m = /^[a-z][A-Za-z0-9_]*/.exec(s.slice(i)))) { toks.push({ k: 'a', v: m[0], fn: s[i + m[0].length] === '(' }); i += m[0].length; continue; }
        if (c === "'") { let j = i + 1, v = ''; while (j < s.length) { if (s[j] === "'" && s[j + 1] === "'") { v += "'"; j += 2; continue; } if (s[j] === "'") break; if (s[j] === '\\') { j++; v += s[j] === 'n' ? '\n' : s[j] === 't' ? '\t' : s[j]; j++; continue; } v += s[j++]; } toks.push({ k: 'a', v, fn: s[j + 1] === '(', q: 1 }); i = j + 1; continue; }
        if (c === '"') { let j = i + 1, v = ''; while (j < s.length && s[j] !== '"') { if (s[j] === '\\') { j++; v += s[j] === 'n' ? '\n' : s[j]; j++; continue; } v += s[j++]; } toks.push({ k: 's', v }); i = j + 1; continue; }
        if ('()[]{},|'.includes(c)) { toks.push({ k: 'p', v: c }); i++; continue; }
        if (c === '!' || c === ';') { toks.push({ k: 'a', v: c, fn: s[i + 1] === '(' }); i++; continue; }
        if ((m = /^[+\-*/\\^<>=~:.?@#&$]+/.exec(s.slice(i)))) {
          if (m[0] === '.' && (i + 1 >= s.length || /\s|%/.test(s[i + 1]))) { toks.push({ k: 'end' }); i++; continue; }
          let w = m[0]; if (w.endsWith('.') && w.length > 1 && (i + w.length >= s.length || /\s/.test(s[i + w.length]))) w = w.slice(0, -1);
          toks.push({ k: 'a', v: w, fn: s[i + w.length] === '(' }); i += w.length; continue;
        }
        fail('Prolog cannot read "' + c + '".');
      }
      return toks;
    };
    const toks = lexText(code);
    const OPS = {
      ':-': [1200, 'xfx'], '-->': [1200, 'xfx'], ';': [1100, 'xfy'], '|': [1100, 'xfy'], '->': [1050, 'xfy'], ',': [1000, 'xfy'],
      '=': [700, 'xfx'], '\\=': [700, 'xfx'], '==': [700, 'xfx'], '\\==': [700, 'xfx'], '@<': [700, 'xfx'], '@>': [700, 'xfx'], '@=<': [700, 'xfx'], '@>=': [700, 'xfx'], '=..': [700, 'xfx'],
      'is': [700, 'xfx'], '=:=': [700, 'xfx'], '=\\=': [700, 'xfx'], '<': [700, 'xfx'], '>': [700, 'xfx'], '=<': [700, 'xfx'], '>=': [700, 'xfx'],
      '+': [500, 'yfx'], '-': [500, 'yfx'], '/\\': [500, 'yfx'], '\\/': [500, 'yfx'], 'xor': [500, 'yfx'], '*': [400, 'yfx'], '/': [400, 'yfx'], '//': [400, 'yfx'], 'mod': [400, 'yfx'], 'rem': [400, 'yfx'], '<<': [400, 'yfx'], '>>': [400, 'yfx'], '**': [200, 'xfx'], '^': [200, 'xfy'],
    };
    const PRE = { '-': 200, '+': 200, '\\+': 900, '\\': 200, ':-': 1200, '?-': 1200 };
    let p = 0, varmap;
    const pk = () => toks[p];
    const expect = v => { const t = toks[p]; if (!t || t.v !== v || (t.k !== 'p' && t.k !== 'a')) fail('Expected "' + v + '" near token ' + (p + 1) + '.'); p++; };
    const parse = maxP => {
      let left, lp = 0; const t = toks[p++];
      if (!t) fail('The program ends in the middle of a clause.');
      if (t.k === 'n') left = t.v;
      else if (t.k === 'v') { if (t.v === '_') left = new Var('_'); else { if (!varmap.has(t.v)) varmap.set(t.v, new Var(t.v)); left = varmap.get(t.v); } }
      else if (t.k === 's') left = mkList([...t.v].map(c => c.codePointAt(0)));
      else if (t.k === 'p' && t.v === '(') { left = parse(1200); expect(')'); }
      else if (t.k === 'p' && t.v === '[') {
        if (pk() && pk().v === ']') { p++; left = NILA; }
        else { const items = [parse(999)]; while (pk() && pk().v === ',') { p++; items.push(parse(999)); } let tail = NILA; if (pk() && pk().v === '|') { p++; tail = parse(999); } expect(']'); left = mkList(items, tail); }
      }
      else if (t.k === 'p' && t.v === '{') { const inner = parse(1200); expect('}'); left = S('{}', inner); }
      else if (t.k === 'a') {
        if (t.fn) { p++; const args = [parse(999)]; while (pk() && pk().v === ',' && pk().k === 'p') { p++; args.push(parse(999)); } expect(')'); left = S(t.v, ...args); }
        else if (PRE[t.v] !== undefined && pk() && !(pk().k === 'p' && /[)\],|]/.test(pk().v)) && pk().k !== 'end' && !(pk().k === 'a' && OPS[pk().v] && !PRE[pk().v] && pk().v !== '(')) {
          if (t.v === '-' && pk().k === 'n') { left = -toks[p++].v; }
          else { const pr = PRE[t.v]; const arg = parse(pr <= maxP ? pr : maxP); left = S(t.v, arg); lp = pr; }
        }
        else left = A(t.v);
      }
      else fail('Unexpected "' + (t.v || '.') + '".');
      for (;;) {
        const o = pk(); if (!o) break;
        const name = o.k === 'p' && (o.v === ',' || o.v === '|') ? o.v : o.k === 'a' ? o.v : null;
        if (name === null || !OPS[name]) break;
        const [pr, type] = OPS[name];
        if (pr > maxP) break;
        const la = type[0] === 'y' ? pr : pr - 1; if (lp > la) break;
        p++;
        const right = parse(type[2] === 'y' ? pr : pr - 1);
        left = S(name === '|' ? ';' : name, left, right); lp = pr;
      }
      return left;
    };
    const clauses = [];
    while (p < toks.length) { varmap = new Map(); const t = parse(1200); if (!toks[p] || toks[p].k !== 'end') fail('A clause is missing its full stop (near token ' + p + ').'); p++; clauses.push(t); }
    /* database */
    const db = new Map(); const key = t => t.f ? t.f + '/' + t.args.length : t.a + '/0';
    const addClause = (t, front) => { let h = t, b = A('true'); if (t.f === ':-' && t.args.length === 2) { h = t.args[0]; b = t.args[1]; } h = deref(h); if (h instanceof Var || typeof h === 'number') fail('A clause head must be an atom or a compound term.'); const k = key(h); if (!db.has(k)) db.set(k, []); db.get(k)[front ? 'unshift' : 'push']({ h, b }); };
    /* copy with fresh variables */
    const rename = (t, map) => { t = deref(t); if (t instanceof Var) { if (!map.has(t)) map.set(t, new Var(t.n)); return map.get(t); } if (t && t.f) return { f: t.f, args: t.args.map(a => rename(a, map)) }; return t; };
    /* unification with trail */
    const trail = [];
    const bindv = (v, t) => { v.ref = t; trail.push(v); };
    const undo = n => { while (trail.length > n) trail.pop().ref = undefined; };
    const unify = (a, b) => {
      a = deref(a); b = deref(b);
      if (a === b) return true;
      if (a instanceof Var) { bindv(a, b); return true; }
      if (b instanceof Var) { bindv(b, a); return true; }
      if (typeof a === 'number' || typeof b === 'number') return a === b;
      if (a.a !== undefined || b.a !== undefined) return a.a !== undefined && a.a === b.a;
      if (a.f !== b.f || a.args.length !== b.args.length) return false;
      for (let k = 0; k < a.args.length; k++) if (!unify(a.args[k], b.args[k])) return false;
      return true;
    };
    /* printing */
    const fmt = (t, q) => {
      t = deref(t);
      if (t instanceof Var) return '_' + t.n;
      if (typeof t === 'number') return Number.isInteger(t) ? String(t) : String(t);
      if (t.a !== undefined) return q && !/^([a-z][A-Za-z0-9_]*|\[\]|!|;|[+\-*/\\^<>=~:.?@#&$]+)$/.test(t.a) ? "'" + t.a.replace(/'/g, "''") + "'" : t.a;
      if (t.f === '.' && t.args.length === 2) { const items = []; let l = t; while (deref(l).f === '.') { l = deref(l); items.push(fmt(l.args[0], q)); l = l.args[1]; } l = deref(l); return '[' + items.join(',') + (l.a === '[]' ? '' : '|' + fmt(l, q)) + ']'; }
      if (t.f === '{}' && t.args.length === 1) return '{' + fmt(t.args[0], q) + '}';
      if (t.args.length === 2 && OPS[t.f]) return fmt(t.args[0], q) + (/^[a-z]/.test(t.f) || t.f === '->' || t.f === ':-' ? ' ' + t.f + ' ' : t.f === ',' ? ',' : t.f) + fmt(t.args[1], q);
      if (t.args.length === 1 && PRE[t.f] && t.f !== ':-') return t.f + fmt(t.args[0], q);
      return fmt(A(t.f), q) + '(' + t.args.map(a => fmt(a, q)).join(',') + ')';
    };
    const listArr = t => { const out = []; t = deref(t); while (t.f === '.' && t.args.length === 2) { out.push(t.args[0]); t = deref(t.args[1]); } if (t.a !== '[]') fail('Expected a list, got ' + fmt(t) + '.'); return out; };
    const textOf = t => { t = deref(t); if (t.a !== undefined) return t.a; if (typeof t === 'number') return String(t); return listArr(t).map(c => typeof deref(c) === 'number' ? String.fromCodePoint(deref(c)) : deref(c).a).join(''); };
    /* arithmetic */
    const arith = t => {
      t = deref(t);
      if (typeof t === 'number') return t;
      if (t instanceof Var) fail('Arguments are not sufficiently instantiated (an unbound variable in arithmetic).');
      if (t.a === 'pi') return Math.PI; if (t.a === 'e') return Math.E; if (t.a === 'max_tagged_integer') return 2 ** 53;
      if (t.a !== undefined) fail('"' + t.a + '" is not a number.');
      const a = t.args.map(arith), [x, y] = a;
      switch (t.f + '/' + a.length) {
        case '+/2': return x + y; case '-/2': return x - y; case '*/2': return x * y;
        case '//2': if (y === 0) fail('Division by zero.'); return Number.isInteger(x) && Number.isInteger(y) && x % y === 0 ? x / y : x / y;
        case '///2': if (y === 0) fail('Division by zero.'); return Math.trunc(x / y);
        case 'mod/2': if (y === 0) fail('Division by zero.'); return ((x % y) + y) % y; case 'rem/2': return x % y;
        case '-/1': return -x; case '+/1': return x; case 'abs/1': return Math.abs(x); case 'sign/1': return Math.sign(x);
        case 'min/2': return Math.min(x, y); case 'max/2': return Math.max(x, y); case 'sqrt/1': return Math.sqrt(x); case '**/2': return x ** y; case '^/2': return x ** y;
        case 'sin/1': return Math.sin(x); case 'cos/1': return Math.cos(x); case 'exp/1': return Math.exp(x); case 'log/1': return Math.log(x);
        case 'floor/1': return Math.floor(x); case 'ceiling/1': return Math.ceil(x); case 'round/1': return Math.round(x); case 'truncate/1': return Math.trunc(x); case 'integer/1': return Math.round(x); case 'float/1': return x;
        case '>>/2': return x >> y; case '<</2': return x << y; case '/\\/2': return x & y; case '\\//2': return x | y; case 'xor/2': return x ^ y; case '\\/1': return ~x;
        case 'gcd/2': { let m = Math.abs(x), n = Math.abs(y); while (n) [m, n] = [n, m % n]; return m; }
      }
      fail('Unknown arithmetic function ' + t.f + '/' + a.length + '.');
    };
    const ord = (a, b) => { a = deref(a); b = deref(b); const rank = t => t instanceof Var ? 0 : typeof t === 'number' ? 1 : t.a !== undefined ? 3 : 4; const ra = rank(a), rb = rank(b); if (ra !== rb) return ra - rb; if (ra === 1) return a - b; if (ra === 3) return a.a < b.a ? -1 : a.a > b.a ? 1 : 0; if (ra === 0) return 0; if (a.args.length !== b.args.length) return a.args.length - b.args.length; if (a.f !== b.f) return a.f < b.f ? -1 : 1; for (let k = 0; k < a.args.length; k++) { const c = ord(a.args[k], b.args[k]); if (c) return c; } return 0; };
    let halted = false;
    class Halt { }
    /* solver: depth-first with generators; a cut is signalled by returning the 'cut' barrier */
    const builtins = {};
    const det = (n, f) => { builtins[n] = function* (args) { if (f(...args)) yield; }; };
    det('true/0', () => true); det('fail/0', () => false); det('false/0', () => false);
    det('=/2', (a, b) => unify(a, b));
    builtins['\\=/2'] = function* (a) { const m = trail.length; const r = unify(a[0], a[1]); undo(m); if (!r) yield; };
    det('==/2', (a, b) => ord(a, b) === 0); det('\\==/2', (a, b) => ord(a, b) !== 0); det('@</2', (a, b) => ord(a, b) < 0); det('@>/2', (a, b) => ord(a, b) > 0); det('@=</2', (a, b) => ord(a, b) <= 0); det('@>=/2', (a, b) => ord(a, b) >= 0);
    det('is/2', (a, b) => unify(a, arith(b)));
    det('=:=/2', (a, b) => arith(a) === arith(b)); det('=\\=/2', (a, b) => arith(a) !== arith(b)); det('</2', (a, b) => arith(a) < arith(b)); det('>/2', (a, b) => arith(a) > arith(b)); det('=</2', (a, b) => arith(a) <= arith(b)); det('>=/2', (a, b) => arith(a) >= arith(b));
    det('var/1', a => deref(a) instanceof Var); det('nonvar/1', a => !(deref(a) instanceof Var)); det('atom/1', a => deref(a).a !== undefined); det('number/1', a => typeof deref(a) === 'number'); det('integer/1', a => Number.isInteger(deref(a))); det('float/1', a => typeof deref(a) === 'number' && !Number.isInteger(deref(a)));
    det('atomic/1', a => { a = deref(a); return typeof a === 'number' || a.a !== undefined; }); det('compound/1', a => !!deref(a).f); det('callable/1', a => { a = deref(a); return !!a.f || a.a !== undefined; });
    det('is_list/1', a => { a = deref(a); while (a.f === '.' && a.args.length === 2) a = deref(a.args[1]); return a.a === '[]'; });
    det('write/1', a => { io.out(fmt(a)); return true; }); det('print/1', a => { io.out(fmt(a, true)); return true; }); det('writeq/1', a => { io.out(fmt(a, true)); return true; }); det('write_canonical/1', a => { io.out(fmt(a, true)); return true; });
    det('writeln/1', a => { io.out(fmt(a) + '\n'); return true; }); det('nl/0', () => { io.out('\n'); return true; }); det('tab/1', n => { io.out(' '.repeat(arith(n))); return true; }); det('put_char/1', c => { io.out(deref(c).a); return true; });
    det('halt/0', () => { throw new Halt(); }); det('halt/1', () => { throw new Halt(); });
    det('atom_codes/2', (a, l) => { a = deref(a); if (!(a instanceof Var)) return unify(l, mkList([...textOf(a)].map(c => c.codePointAt(0)))); return unify(a, A(textOf(l))); });
    det('atom_chars/2', (a, l) => { a = deref(a); if (!(a instanceof Var)) return unify(l, mkList([...textOf(a)].map(c => A(c)))); return unify(a, A(textOf(l))); });
    det('atom_length/2', (a, n) => unify(n, [...textOf(a)].length)); det('atom_string/2', (a, s) => unify(s, A(textOf(a))));
    det('number_codes/2', (a, l) => { a = deref(a); if (!(a instanceof Var)) return unify(l, mkList([...String(a)].map(c => c.codePointAt(0)))); return unify(a, Number(textOf(l))); });
    det('atom_number/2', (a, n) => { const v = Number(textOf(a)); return !isNaN(v) && unify(n, v); });
    det('char_code/2', (c, n) => { c = deref(c); if (!(c instanceof Var)) return unify(n, c.a.codePointAt(0)); return unify(c, A(String.fromCodePoint(arith(n)))); });
    det('atom_concat/3', (a, b, c) => unify(c, A(textOf(a) + textOf(b))));
    det('upcase_atom/2', (a, b) => unify(b, A(textOf(a).toUpperCase())));
    det('term_to_atom/2', (t, a) => unify(a, A(fmt(t, true))));
    det('functor/3', (t, n, a) => { t = deref(t); if (t instanceof Var) { const ar = arith(a), nm = deref(n); return unify(t, ar === 0 ? nm : S(nm.a, ...Array.from({ length: ar }, () => new Var('_')))); } if (t.f) return unify(n, A(t.f)) && unify(a, t.args.length); return unify(n, t) && unify(a, 0); });
    det('arg/3', (n, t, a) => { t = deref(t); const k = arith(n); return !!t.f && k >= 1 && k <= t.args.length && unify(a, t.args[k - 1]); });
    det('=../2', (t, l) => { t = deref(t); if (t instanceof Var) { const xs = listArr(l); return unify(t, xs.length === 1 ? xs[0] : S(deref(xs[0]).a, ...xs.slice(1))); } return unify(l, t.f ? mkList([A(t.f), ...t.args]) : mkList([t])); });
    det('copy_term/2', (a, b) => unify(b, rename(a, new Map())));
    det('assert/1', c => { addClause(rename(c, new Map())); return true; }); det('assertz/1', c => { addClause(rename(c, new Map())); return true; }); det('asserta/1', c => { addClause(rename(c, new Map()), true); return true; });
    builtins['retract/1'] = function* (a) { let c = deref(a[0]), h = c, b = A('true'); if (c.f === ':-' && c.args.length === 2) { h = c.args[0]; b = c.args[1]; } const list = db.get(key(deref(h))) || []; for (let k = 0; k < list.length; k++) { const m = trail.length, r = rename({ f: ':-', args: [list[k].h, list[k].b] }, new Map()); if (unify(h, r.args[0]) && unify(b, r.args[1])) { list.splice(k, 1); yield; return; } undo(m); } };
    builtins['between/3'] = function* (a) { const lo = arith(a[0]), hiT = deref(a[1]), hi = hiT.a === 'inf' ? Infinity : arith(hiT); const x = deref(a[2]); if (!(x instanceof Var)) { if (x >= lo && x <= hi) yield; return; } for (let k = lo; k <= hi; k++) { const m = trail.length; if (unify(x, k)) yield; undo(m); } };
    builtins['length/2'] = function* (a) { const l = deref(a[0]); let n = 0, t = l; while (deref(t).f === '.') { n++; t = deref(t).args[1]; } t = deref(t); if (t.a === '[]') { if (unify(a[1], n)) yield; return; } if (!(t instanceof Var)) return; const want = deref(a[1]); for (let k = typeof want === 'number' ? want - n : 0; typeof want === 'number' ? k === want - n : k < 1e6; k++) { const m = trail.length; if (unify(t, mkList(Array.from({ length: k }, () => new Var('_')))) && unify(a[1], n + k)) yield; undo(m); if (typeof want === 'number') break; } };
    builtins['msort/2'] = function* (a) { if (unify(a[1], mkList(listArr(a[0]).slice().sort(ord)))) yield; };
    builtins['sort/2'] = function* (a) { const s = listArr(a[0]).slice().sort(ord).filter((x, k, arr) => !k || ord(arr[k - 1], x) !== 0); if (unify(a[1], mkList(s))) yield; };
    builtins['sum_list/2'] = function* (a) { if (unify(a[1], listArr(a[0]).reduce((s, x) => s + arith(x), 0))) yield; };
    builtins['max_list/2'] = function* (a) { if (unify(a[1], Math.max(...listArr(a[0]).map(arith)))) yield; };
    builtins['min_list/2'] = function* (a) { if (unify(a[1], Math.min(...listArr(a[0]).map(arith)))) yield; };
    builtins['nb_getval/2'] = function* (a) { if (unify(a[1], globals.get(deref(a[0]).a))) yield; };
    builtins['b_setval/2'] = builtins['nb_setval/2'] = function* (a) { globals.set(deref(a[0]).a, rename(a[1], new Map())); yield; };
    const globals = new Map();
    builtins['format/1'] = function* (a) { io.out(format(textOf(a[0]), [])); yield; };
    builtins['format/2'] = function* (a) { const args = deref(a[1]); io.out(format(textOf(a[0]), args.f === '.' || args.a === '[]' ? listArr(args) : [args])); yield; };
    const format = (f, args) => { let k = 0; return f.replace(/~(\d*)([awdpqsnte~if])/g, (m, n, c) => { if (c === 'n') return '\n'.repeat(+n || 1); if (c === '~') return '~'; if (c === 't') return ''; const x = args[k++]; if (x === undefined) fail('format: not enough arguments.'); if (c === 'd') return String(Math.trunc(arith(x))); if (c === 'f' || c === 'e') return arith(x).toFixed(n === '' ? 6 : +n); if (c === 's') return textOf(x); if (c === 'q') return fmt(x, true); return fmt(x); }); };
    let depthGuard = 0;
    function* solve(goal, depth) {
      goal = deref(goal);
      io.tick();
      if (goal instanceof Var) fail('Arguments are not sufficiently instantiated (a goal is an unbound variable).');
      if (typeof goal === 'number') fail('A number is not a goal.');
      const name = goal.f || goal.a, args = goal.args || [], k = name + '/' + args.length;
      if (k === ',/2') { for (const r of solve(args[0], depth)) { if (r === CUT) { yield CUT; return; } for (const r2 of solve(args[1], depth)) { if (r2 === CUT) { yield CUT; return; } yield; } } return; }
      if (k === '!/0') { yield; yield CUT; return; }
      if (k === ';/2') {
        const l = deref(args[0]);
        if (l.f === '->' && l.args.length === 2) { const m = trail.length; let ok = false; for (const r of solve(l.args[0], depth + 1)) { void r; ok = true; break; } if (ok) { for (const r of solve(l.args[1], depth)) { if (r === CUT) { yield CUT; return; } yield; } } else { undo(m); for (const r of solve(args[1], depth)) { if (r === CUT) { yield CUT; return; } yield; } } return; }
        const m = trail.length;
        for (const r of solve(l, depth)) { if (r === CUT) { yield CUT; return; } yield; }
        undo(m);
        for (const r of solve(args[1], depth)) { if (r === CUT) { yield CUT; return; } yield; }
        return;
      }
      if (k === '->/2') { let ok = false; for (const r of solve(args[0], depth + 1)) { void r; ok = true; break; } if (ok) for (const r of solve(args[1], depth)) { if (r === CUT) { yield CUT; return; } yield; } return; }
      if (k === '\\+/1' || k === 'not/1') { const m = trail.length; let ok = false; for (const r of solve(args[0], depth + 1)) { void r; ok = true; break; } undo(m); if (!ok) yield; return; }
      if (name === 'call' && args.length >= 1) { let g = deref(args[0]); if (args.length > 1) g = g.f ? S(g.f, ...g.args, ...args.slice(1)) : S(g.a, ...args.slice(1)); for (const r of solve(g, depth + 1)) { if (r !== CUT) yield; } return; }
      if (k === 'findall/3') { const out = []; const m = trail.length; for (const r of solve(args[1], depth + 1)) { if (r === CUT) break; out.push(rename(args[0], new Map())); } undo(m); if (unify(args[2], mkList(out))) yield; return; }
      if (k === 'forall/2') { const m = trail.length; let ok = true; for (const r of solve(args[0], depth + 1)) { if (r === CUT) break; let inner = false; const m2 = trail.length; for (const r2 of solve(args[1], depth + 1)) { void r2; inner = true; break; } undo(m2); if (!inner) { ok = false; break; } } undo(m); if (ok) yield; return; }
      if (k === 'once/1') { for (const r of solve(args[0], depth + 1)) { void r; yield; return; } return; }
      if (k === 'ignore/1') { for (const r of solve(args[0], depth + 1)) { void r; break; } yield; return; }
      if (k === 'catch/3') { const m = trail.length; try { for (const r of solve(args[0], depth + 1)) { if (r !== CUT) yield; } } catch (x) { if (!(x instanceof PlThrow)) throw x; undo(m); if (unify(args[1], x.t)) { for (const r of solve(args[2], depth + 1)) { if (r !== CUT) yield; } } else throw x; } return; }
      if (k === 'throw/1') throw new PlThrow(rename(args[0], new Map()));
      if (builtins[k]) { const m = trail.length; for (const r of builtins[k](args)) { void r; yield; undo(m); } undo(m); return; }
      const list = db.get(k);
      if (!list) { if (k === 'main/0' && false) return; throw new PlThrow(S('existence_error', S('procedure', S('/', A(name), args.length)))); }
      if (++depthGuard > 200000) { depthGuard = 0; fail('Too deep: more than 200,000 nested goals.'); }
      try {
        for (const cl of list.slice()) {
          const m = trail.length, map = new Map(), h = rename(cl.h, map);
          if (unify(goal, h)) { const b = rename(cl.b, map); let cut = false; for (const r of solve(b, depth + 1)) { if (r === CUT) { cut = true; break; } yield; } undo(m); if (cut) return; }
          else undo(m);
        }
      } finally { depthGuard--; }
    }
    const CUT = { cut: true };
    class PlThrow { constructor(t) { this.t = t; } }
    /* library predicates written in Prolog */
    const LIB = 'append([],L,L). append([H|T],L,[H|R]) :- append(T,L,R). member(X,[X|_]). member(X,[_|T]) :- member(X,T). reverse(L,R) :- rev_(L,[],R). rev_([],A,A). rev_([H|T],A,R) :- rev_(T,[H|A],R). nth0(I,L,E) :- nth_(L,0,I,E). nth1(I,L,E) :- nth_(L,1,I,E). nth_([H|_],B,B,H). nth_([_|T],B,I,E) :- B1 is B+1, nth_(T,B1,I,E). last([X],X) :- !. last([_|T],X) :- last(T,X). select(X,[X|T],T). select(X,[H|T],[H|R]) :- select(X,T,R). exclude(_,[],[]). exclude(P,[H|T],R) :- ( call(P,H) -> R=R1 ; R=[H|R1] ), exclude(P,T,R1). include(_,[],[]). include(P,[H|T],R) :- ( call(P,H) -> R=[H|R1] ; R=R1 ), include(P,T,R1). maplist(_,[]). maplist(P,[A|As]) :- call(P,A), maplist(P,As). maplist(_,[],[]). maplist(P,[A|As],[B|Bs]) :- call(P,A,B), maplist(P,As,Bs). maplist(_,[],[],[]). maplist(P,[A|As],[B|Bs],[C|Cs]) :- call(P,A,B,C), maplist(P,As,Bs,Cs). foldl(_,[],V,V). foldl(P,[X|Xs],V0,V) :- call(P,X,V0,V1), foldl(P,Xs,V1,V). permutation([],[]). permutation(L,[H|T]) :- select(H,L,R), permutation(R,T). sumlist(L,S) :- sum_list(L,S). numlist(L,H,[]) :- L > H, !. numlist(L,H,[L|T]) :- L1 is L+1, numlist(L1,H,T). delete([],_,[]). delete([H|T],X,R) :- ( H == X -> R = R1 ; R = [H|R1] ), delete(T,X,R1). exclude_one_(_,_,_). list_to_set(L,S) :- lts_(L,[],S). lts_([],_,[]). lts_([H|T],Seen,R) :- ( memberchk(H,Seen) -> R = R1 ; R = [H|R1] ), lts_(T,[H|Seen],R1). memberchk(X,L) :- member(X,L), !. succ_or_fail(_).';
    /* load the library with the same parser */
    { const userToks = toks.splice(0, toks.length); toks.push(...lexText(LIB)); p = 0; while (p < toks.length) { varmap = new Map(); addClause(parse(1200)); p++; } toks.length = 0; toks.push(...userToks); }
    /* consult the user's program: directives run as they are read */
    const run = g => {
      try { for (const r of solve(g, 0)) { void r; return true; } return false; }
      catch (x) { if (x instanceof PlThrow) { const t = deref(x.t); if (t.f === 'existence_error') { const pi = deref(deref(t.args[0]).args[0]); io.out('Warning: unknown procedure ' + fmt(pi) + '\n'); return false; } io.out('Warning: uncaught exception ' + fmt(t, true) + '\n'); return false; } throw x; }
    };
    const inits = [];
    try {
      for (const c of clauses) {
        const d = deref(c);
        if ((d.f === ':-' || d.f === '?-') && d.args.length === 1) {
          const g = deref(d.args[0]);
          if (g.f === 'initialization') { inits.push(g.args[0]); continue; }
          if (g.f === 'dynamic' || g.f === 'discontiguous' || g.f === 'use_module' || g.f === 'ensure_loaded' || g.f === 'set_prolog_flag') continue;
          if (!run(g)) io.out('Warning: directive failed: ' + fmt(g, true) + '\n');
          continue;
        }
        addClause(c);
      }
      if (!inits.length && db.has('main/0') && !clauses.some(c => deref(c).f === ':-' && deref(c).args.length === 1)) inits.push(A('main'));
      for (const g of inits) if (!run(g)) io.out('Warning: goal (initialization) failed: ' + fmt(g, true) + '\n');
    } catch (x) { if (x instanceof Halt) return; throw x; }
    void halted;
  };

  /* =================== Forth =================== */
  L.forth = (code, io) => {
    const toks = []; {
      const s = code; let i = 0;
      while (i < s.length) {
        while (i < s.length && /\s/.test(s[i])) i++;
        if (i >= s.length) break;
        let j = i; while (j < s.length && !/\s/.test(s[j])) j++;
        const w = s.slice(i, j), W = w.toUpperCase(); i = j;
        if (W === '\\') { while (i < s.length && s[i] !== '\n') i++; continue; }
        if (W === '(') { const e = s.indexOf(')', i); i = e < 0 ? s.length : e + 1; continue; }
        if (W === '."' || W === 'S"' || W === '.(' || W === 'ABORT"') { const end = W === '.(' ? ')' : '"'; const e = s.indexOf(end, i + 1); if (e < 0) fail(w + ' has no closing ' + end + '.'); toks.push({ w: W, s: s.slice(i + 1, e) }); i = e + 1; continue; }
        if (W === 'CHAR' || W === '[CHAR]') { while (i < s.length && /\s/.test(s[i])) i++; toks.push({ w: 'LIT', v: s.codePointAt(i) }); while (i < s.length && !/\s/.test(s[i])) i++; continue; }
        toks.push({ w: W, raw: w });
      }
    }
    const st = [], rs = [], mem = [], dict = new Map();
    const pop = () => { if (!st.length) fail('Stack underflow.'); return st.pop(); };
    let k = 0;
    const prim = {
      '+': () => { const b = pop(), a = pop(); st.push(a + b | 0); }, '-': () => { const b = pop(), a = pop(); st.push(a - b | 0); }, '*': () => { const b = pop(), a = pop(); st.push(Math.imul(a, b)); },
      '/': () => { const b = pop(), a = pop(); if (!b) fail('Division by zero.'); st.push(Math.floor(a / b)); }, 'MOD': () => { const b = pop(), a = pop(); if (!b) fail('Division by zero.'); st.push(((a % b) + b) % b); },
      '/MOD': () => { const b = pop(), a = pop(); if (!b) fail('Division by zero.'); st.push(((a % b) + b) % b, Math.floor(a / b)); }, '*/': () => { const c = pop(), b = pop(), a = pop(); st.push(Math.floor(a * b / c)); },
      'NEGATE': () => st.push(-pop()), 'ABS': () => st.push(Math.abs(pop())), 'MIN': () => st.push(Math.min(pop(), pop())), 'MAX': () => st.push(Math.max(pop(), pop())),
      '1+': () => st.push(pop() + 1), '1-': () => st.push(pop() - 1), '2*': () => st.push(pop() * 2), '2/': () => st.push(pop() >> 1),
      '=': () => st.push(pop() === pop() ? -1 : 0), '<>': () => st.push(pop() !== pop() ? -1 : 0), '<': () => { const b = pop(); st.push(pop() < b ? -1 : 0); }, '>': () => { const b = pop(); st.push(pop() > b ? -1 : 0); },
      '0=': () => st.push(pop() === 0 ? -1 : 0), '0<': () => st.push(pop() < 0 ? -1 : 0), '0>': () => st.push(pop() > 0 ? -1 : 0),
      'AND': () => st.push(pop() & pop()), 'OR': () => st.push(pop() | pop()), 'XOR': () => st.push(pop() ^ pop()), 'INVERT': () => st.push(~pop()), 'LSHIFT': () => { const n = pop(); st.push(pop() << n); }, 'RSHIFT': () => { const n = pop(); st.push(pop() >>> n); },
      'DUP': () => { const a = pop(); st.push(a, a); }, 'DROP': () => { pop(); }, 'SWAP': () => { const b = pop(), a = pop(); st.push(b, a); }, 'OVER': () => { const b = pop(), a = pop(); st.push(a, b, a); },
      'ROT': () => { const c = pop(), b = pop(), a = pop(); st.push(b, c, a); }, '-ROT': () => { const c = pop(), b = pop(), a = pop(); st.push(c, a, b); }, 'NIP': () => { const b = pop(); pop(); st.push(b); }, 'TUCK': () => { const b = pop(), a = pop(); st.push(b, a, b); },
      '2DUP': () => { const b = pop(), a = pop(); st.push(a, b, a, b); }, '2DROP': () => { pop(); pop(); }, '2SWAP': () => { const d = pop(), c = pop(), b = pop(), a = pop(); st.push(c, d, a, b); }, '?DUP': () => { const a = pop(); st.push(a); if (a) st.push(a); },
      'PICK': () => { const n = pop(); if (n < 0 || n >= st.length) fail('PICK reaches past the stack.'); st.push(st[st.length - 1 - n]); }, 'DEPTH': () => st.push(st.length),
      '.': () => io.out(pop() + ' '), 'U.': () => io.out((pop() >>> 0) + ' '), '.S': () => io.out('<' + st.length + '> ' + st.map(String).join(' ') + ' '), 'CR': () => io.out('\n'), 'EMIT': () => io.out(E.chr(pop())), 'SPACE': () => io.out(' '), 'SPACES': () => io.out(' '.repeat(Math.max(0, pop()))),
      'TYPE': () => { const n = pop(), a = pop(); io.out(mem.slice(a, a + n).map(E.chr).join('')); }, 'KEY': () => st.push(io.getc()),
      '!': () => { const a = pop(); mem[a] = pop(); }, '@': () => { const a = pop(); st.push(mem[a] || 0); }, '+!': () => { const a = pop(); mem[a] = (mem[a] || 0) + pop(); }, '?': () => io.out((mem[pop()] || 0) + ' '),
      'HERE': () => st.push(mem.length), 'ALLOT': () => { const n = pop(); for (let q = 0; q < n; q++) mem.push(0); }, ',': () => mem.push(pop()), 'CELLS': () => {}, 'CELL+': () => st.push(pop() + 1), 'C@': () => { const a = pop(); st.push(mem[a] || 0); }, 'C!': () => { const a = pop(); mem[a] = pop(); },
      '>R': () => rs.push(pop()), 'R>': () => { if (!rs.length) fail('Return stack underflow.'); st.push(rs.pop()); }, 'R@': () => st.push(rs[rs.length - 1]),
      'I': () => st.push(rs[rs.length - 1]), 'J': () => st.push(rs[rs.length - 3]), 'TRUE': () => st.push(-1), 'FALSE': () => st.push(0), 'BL': () => st.push(32),
      'WORDS': () => io.out([...dict.keys(), ...Object.keys(prim)].join(' ') + '\n'), 'BYE': () => { throw new Bye(); },
    };
    class Bye { } class Exit { }
    const strAt = s => { const a = mem.length; for (const c of s) mem.push(c.codePointAt(0)); return [a, [...s].length]; };
    /* compile a token range into a list of ops with resolved branches */
    const compile = (end) => {
      const ops = [], ctl = [];
      while (k < toks.length) {
        const t = toks[k++], w = t.w;
        if (w === end) { if (ctl.length) fail('An IF, DO or BEGIN is not closed before ;.'); return ops; }
        if (w === '."') ops.push({ o: 'print', s: t.s });
        else if (w === '.(') io.out(t.s);
        else if (w === 'S"') ops.push({ o: 'str', s: t.s });
        else if (w === 'ABORT"') ops.push({ o: 'abort', s: t.s });
        else if (w === 'LIT') ops.push({ o: 'lit', v: t.v });
        else if (w === 'IF') { ctl.push({ k: 'if', at: ops.length }); ops.push({ o: '0br' }); }
        else if (w === 'ELSE') { const c = ctl.pop(); if (!c || c.k !== 'if') fail('ELSE without IF.'); ctl.push({ k: 'if', at: ops.length }); ops.push({ o: 'br' }); ops[c.at].to = ops.length; }
        else if (w === 'THEN') { const c = ctl.pop(); if (!c || c.k !== 'if') fail('THEN without IF.'); ops[c.at].to = ops.length; }
        else if (w === 'DO' || w === '?DO') { ops.push({ o: w === 'DO' ? 'do' : '?do' }); ctl.push({ k: 'do', at: ops.length, leaves: [] }); }
        else if (w === 'LOOP' || w === '+LOOP') { const c = ctl.pop(); if (!c || c.k !== 'do') fail(w + ' without DO.'); ops.push({ o: w === 'LOOP' ? 'loop' : '+loop', to: c.at }); c.leaves.forEach(l => { ops[l].to = ops.length; }); if (ops[c.at - 1].o === '?do') ops[c.at - 1].to = ops.length; }
        else if (w === 'LEAVE') { const c = [...ctl].reverse().find(x => x.k === 'do'); if (!c) fail('LEAVE outside DO.'); c.leaves.push(ops.length); ops.push({ o: 'leave' }); }
        else if (w === 'UNLOOP') ops.push({ o: 'unloop' });
        else if (w === 'BEGIN') ctl.push({ k: 'begin', at: ops.length });
        else if (w === 'UNTIL') { const c = ctl.pop(); if (!c || c.k !== 'begin') fail('UNTIL without BEGIN.'); ops.push({ o: '0br', to: c.at }); }
        else if (w === 'AGAIN') { const c = ctl.pop(); if (!c || c.k !== 'begin') fail('AGAIN without BEGIN.'); ops.push({ o: 'br', to: c.at }); }
        else if (w === 'WHILE') { const c = ctl[ctl.length - 1]; if (!c || c.k !== 'begin') fail('WHILE without BEGIN.'); c.wh = ops.length; ops.push({ o: '0br' }); }
        else if (w === 'REPEAT') { const c = ctl.pop(); if (!c || c.k !== 'begin' || c.wh === undefined) fail('REPEAT without BEGIN ... WHILE.'); ops.push({ o: 'br', to: c.at }); ops[c.wh].to = ops.length; }
        else if (w === 'RECURSE') ops.push({ o: 'recurse' });
        else if (w === 'EXIT') ops.push({ o: 'exit' });
        else if (w === ':' || w === ';') fail(w + ' cannot appear inside a definition.');
        else ops.push({ o: 'word', w, raw: t.raw });
      }
      if (end) fail('A definition is missing its ;');
      return ops;
    };
    let self = null;
    const exec = (ops, me) => {
      for (let pc = 0; pc < ops.length; pc++) {
        io.tick();
        const op = ops[pc];
        switch (op.o) {
          case 'print': io.out(op.s); break;
          case 'str': st.push(...strAt(op.s)); break;
          case 'abort': if (pop()) fail(op.s); break;
          case 'lit': st.push(op.v); break;
          case '0br': if (!pop()) pc = op.to - 1; break;
          case 'br': pc = op.to - 1; break;
          case 'do': { const start = pop(), limit = pop(); rs.push(limit, start); break; }
          case '?do': { const start = pop(), limit = pop(); if (start === limit) pc = op.to - 1; else rs.push(limit, start); break; }
          case 'loop': case '+loop': {
            const inc = op.o === 'loop' ? 1 : pop(), idx = rs.pop(), lim = rs[rs.length - 1], ni = idx + inc;
            const done = inc >= 0 ? (idx < lim && ni >= lim) || (idx >= lim && ni >= lim && idx === lim) : (idx >= lim && ni < lim);
            if (done || (inc > 0 && ni >= lim)) rs.pop(); else { rs.push(ni); pc = op.to - 1; }
            break;
          }
          case 'leave': rs.pop(); rs.pop(); pc = op.to - 1; break;
          case 'unloop': rs.pop(); rs.pop(); break;
          case 'recurse': call(me); break;
          case 'exit': return;
          case 'word': run(op.w, op.raw); break;
        }
      }
    };
    let calls = 0;
    const call = d => { if (++calls > 10000) fail('Return stack overflow (too much recursion).'); try { exec(d.ops, d); } finally { calls--; } };
    const run = (w, raw) => {
      const d = dict.get(w);
      if (d) { if (d.k === 'var' || d.k === 'create') st.push(d.a); else if (d.k === 'const') st.push(d.v); else call(d); return; }
      if (prim[w]) { prim[w](); return; }
      const n = /^-?\d+$/.test(w) ? parseInt(w, 10) : /^\$[0-9A-F]+$/.test(w) ? parseInt(w.slice(1), 16) : /^'.'$/.test(raw || '') ? raw.codePointAt(1) : NaN;
      if (!isNaN(n)) { st.push(n); return; }
      fail((raw || w) + ' ?  (an unknown word)');
    };
    void self;
    try {
      while (k < toks.length) {
        io.tick();
        const t = toks[k], w = t.w;
        if (w === ':') { k++; const nm = toks[k++]; if (!nm) fail(': needs a name.'); const d = { k: 'colon', ops: [] }; d.ops = compile(';'); dict.set(nm.w, d); continue; }
        if (w === 'VARIABLE') { k++; const nm = toks[k++]; dict.set(nm.w, { k: 'var', a: mem.length }); mem.push(0); continue; }
        if (w === 'CONSTANT') { k++; const nm = toks[k++]; dict.set(nm.w, { k: 'const', v: pop() }); continue; }
        if (w === 'CREATE') { k++; const nm = toks[k++]; dict.set(nm.w, { k: 'create', a: mem.length }); continue; }
        if (w === 'IF' || w === 'DO' || w === 'BEGIN' || w === '?DO') { const ops = compile(null, true); exec(ops, null); continue; }
        k++;
        if (w === '."') io.out(t.s); else if (w === '.(') io.out(t.s); else if (w === 'S"') st.push(...strAt(t.s)); else if (w === 'LIT') st.push(t.v); else run(w, t.raw);
      }
    } catch (x) { if (x instanceof Bye) return; if (x instanceof Exit) return; throw x; }
  };

  /* =================== BASIC =================== */
  L.basic = (code, io) => {
    const src = code.replace(/\r/g, '').split('\n');
    const lines = []; let auto = 0;
    src.forEach(l => { const t = l.trim(); if (!t) return; const m = /^(\d+)\s*(.*)$/.exec(t); if (m) { lines.push({ n: +m[1], s: m[2] }); auto = +m[1]; } else { auto += 1; lines.push({ n: auto, s: t, auto: true }); } });
    const numbered = lines.some(l => !l.auto); if (numbered) lines.sort((a, b) => a.n - b.n);
    /* split statements on ':' outside strings */
    const prog = []; const lineAt = new Map();
    lines.forEach(l => {
      lineAt.set(l.n, prog.length);
      let cur = '', q = false; const parts = [];
      for (const c of l.s) { if (c === '"') q = !q; if (c === ':' && !q && !/^\s*IF\b.*\bTHEN\b/i.test(cur)) { parts.push(cur); cur = ''; } else cur += c; }
      parts.push(cur);
      parts.map(s => s.trim()).filter(Boolean).forEach(s => prog.push({ s, n: l.n }));
      if (!parts.some(s => s.trim())) prog.push({ s: 'REM', n: l.n });
    });
    const vars = new Map(), arrs = new Map(), gos = [], fors = [], whiles = [];
    const data = []; let dataPos = 0;
    prog.forEach(p => { const m = /^DATA\s+(.*)$/i.exec(p.s); if (m) m[1].split(',').forEach(x => { x = x.trim(); data.push(/^".*"$/.test(x) ? x.slice(1, -1) : isNaN(+x) ? x : +x); }); });
    /* expression parser */
    const parseExpr = (s, ln) => {
      let i = 0;
      const ws = () => { while (s[i] === ' ' || s[i] === '\t') i++; };
      const kw = w => { ws(); if (s.slice(i, i + w.length).toUpperCase() === w && !/[A-Za-z0-9_$]/.test(s[i + w.length] || '')) { i += w.length; return true; } return false; };
      const FN = ['ABS', 'INT', 'SQR', 'RND', 'LEN', 'LEFT$', 'RIGHT$', 'MID$', 'STR$', 'VAL', 'CHR$', 'ASC', 'SIN', 'COS', 'TAN', 'ATN', 'EXP', 'LOG', 'SGN', 'UCASE$', 'LCASE$', 'INSTR', 'FIX', 'TAB', 'SPACE$', 'STRING$'];
      const call = (f, a) => {
        switch (f) {
          case 'ABS': return Math.abs(a[0]); case 'INT': return Math.floor(a[0]); case 'FIX': return Math.trunc(a[0]); case 'SQR': return Math.sqrt(a[0]); case 'RND': return Math.random();
          case 'LEN': return String(a[0]).length; case 'LEFT$': return String(a[0]).slice(0, a[1]); case 'RIGHT$': return a[1] > 0 ? String(a[0]).slice(-a[1]) : '';
          case 'MID$': return String(a[0]).substr(a[1] - 1, a[2] === undefined ? undefined : a[2]); case 'STR$': return (a[0] >= 0 ? ' ' : '') + fmtN(a[0]); case 'VAL': return parseFloat(a[0]) || 0;
          case 'CHR$': return E.chr(a[0]); case 'ASC': return String(a[0]).codePointAt(0) || 0; case 'SIN': return Math.sin(a[0]); case 'COS': return Math.cos(a[0]); case 'TAN': return Math.tan(a[0]); case 'ATN': return Math.atan(a[0]);
          case 'EXP': return Math.exp(a[0]); case 'LOG': return Math.log(a[0]); case 'SGN': return Math.sign(a[0]); case 'UCASE$': return String(a[0]).toUpperCase(); case 'LCASE$': return String(a[0]).toLowerCase();
          case 'INSTR': return a.length === 3 ? String(a[1]).indexOf(a[2], a[0] - 1) + 1 : String(a[0]).indexOf(a[1]) + 1; case 'TAB': return ' '.repeat(Math.max(0, a[0])); case 'SPACE$': return ' '.repeat(Math.max(0, a[0])); case 'STRING$': return (typeof a[1] === 'number' ? E.chr(a[1]) : String(a[1])[0]).repeat(a[0]);
        }
      };
      const prim = () => {
        ws(); const c = s[i];
        if (c === '(') { i++; const v = or(); ws(); if (s[i] !== ')') fail('Line ' + ln + ': missing ).'); i++; return v; }
        if (c === '"') { const e = s.indexOf('"', i + 1); if (e < 0) fail('Line ' + ln + ': a string has no closing quote.'); const v = s.slice(i + 1, e); i = e + 1; return v; }
        if (c === '-') { i++; return -pow(); }
        if (c === '+') { i++; return pow(); }
        let m = /^(\d+\.?\d*|\.\d+)(E[+-]?\d+)?/i.exec(s.slice(i)); if (m) { i += m[0].length; return parseFloat(m[0]); }
        if (kw('NOT')) return cmp() ? 0 : -1;
        for (const f of FN) { if (s.slice(i, i + f.length).toUpperCase() === f && /^\s*\(/.test(s.slice(i + f.length))) { i += f.length; ws(); i++; const a = []; ws(); if (s[i] !== ')') { a.push(or()); ws(); while (s[i] === ',') { i++; a.push(or()); ws(); } } if (s[i] !== ')') fail('Line ' + ln + ': missing ) after ' + f + '.'); i++; return call(f, a); } if (f === 'RND' && kw('RND')) return Math.random(); }
        m = /^[A-Za-z][A-Za-z0-9_]*\$?/.exec(s.slice(i)); if (m) {
          const name = m[0].toUpperCase(); i += m[0].length; ws();
          if (s[i] === '(') { i++; const ix = [or()]; ws(); while (s[i] === ',') { i++; ix.push(or()); ws(); } i++; const a = arrs.get(name); if (!a) fail('Line ' + ln + ': array ' + name + ' needs DIM first.'); const k = ix.map(Math.floor).join(','); return a.has(k) ? a.get(k) : name.endsWith('$') ? '' : 0; }
          return vars.has(name) ? vars.get(name) : name.endsWith('$') ? '' : 0;
        }
        fail('Line ' + ln + ': cannot read "' + s.slice(i) + '".');
      };
      const pow = () => { let a = prim(); for (;;) { ws(); if (s[i] === '^') { i++; a = a ** prim(); } else return a; } };
      const mul = () => { let a = pow(); for (;;) { ws(); const c = s[i]; if (c === '*') { i++; a *= pow(); } else if (c === '/') { i++; const b = pow(); if (b === 0) fail('Line ' + ln + ': division by zero.'); a /= b; } else if (c === '\\') { i++; a = Math.trunc(a / pow()); } else if (kw('MOD')) { const b = pow(); a = a % b; } else return a; } };
      const add = () => { let a = mul(); for (;;) { ws(); const c = s[i]; if (c === '+') { i++; const b = mul(); a = typeof a === 'string' || typeof b === 'string' ? String(a) + String(b) : a + b; } else if (c === '-') { i++; a -= mul(); } else return a; } };
      const cmp = () => { let a = add(); ws(); const m = /^(<>|<=|>=|=|<|>)/.exec(s.slice(i)); if (m) { i += m[0].length; const b = add(); const r = m[0] === '=' ? a === b : m[0] === '<>' ? a !== b : m[0] === '<' ? a < b : m[0] === '>' ? a > b : m[0] === '<=' ? a <= b : a >= b; return r ? -1 : 0; } return a; };
      const and = () => { let a = cmp(); while (kw('AND')) { const b = cmp(); a = (a && b) ? -1 : 0; } return a; };
      const or = () => { let a = and(); for (;;) { if (kw('OR')) { const b = and(); a = (a || b) ? -1 : 0; } else if (kw('XOR')) { const b = and(); a = (!!a !== !!b) ? -1 : 0; } else return a; } };
      return { or, rest: () => s.slice(i), at: () => i, ws, kw, setAt: n => { i = n; } };
    };
    const ev = (s, ln) => { const p = parseExpr(s, ln), v = p.or(); p.ws(); if (p.rest().trim()) fail('Line ' + ln + ': unexpected "' + p.rest().trim() + '".'); return v; };
    const fmtN = n => Number.isInteger(n) ? String(n) : String(+n.toPrecision(9));
    const showV = v => typeof v === 'number' ? (v >= 0 ? ' ' : '') + fmtN(v) + ' ' : v;
    let col = 0;
    const out = s => { io.out(s); const nl = s.lastIndexOf('\n'); col = nl >= 0 ? s.length - nl - 1 : col + s.length; };
    const assign = (target, v, ln) => {
      const m = /^([A-Za-z][A-Za-z0-9_]*\$?)\s*(\((.*)\))?$/.exec(target.trim()); if (!m) fail('Line ' + ln + ': "' + target + '" is not a variable.');
      const name = m[1].toUpperCase();
      if (name.endsWith('$') && typeof v !== 'string') fail('Line ' + ln + ': ' + name + ' holds text, not a number.');
      if (!name.endsWith('$') && typeof v === 'string') fail('Line ' + ln + ': ' + name + ' holds a number, not text (use ' + name + '$).');
      if (m[2]) { const a = arrs.get(name); if (!a) fail('Line ' + ln + ': array ' + name + ' needs DIM first.'); const k = splitArgs(m[3]).map(x => Math.floor(ev(x, ln))).join(','); a.set(k, v); }
      else vars.set(name, v);
    };
    const splitArgs = s => { const out2 = []; let d = 0, cur = '', q = false; for (const c of s) { if (c === '"') q = !q; if (!q && c === '(') d++; if (!q && c === ')') d--; if (!q && d === 0 && c === ',') { out2.push(cur); cur = ''; } else cur += c; } if (cur.trim()) out2.push(cur); return out2; };
    const gotoLine = (n, ln) => { if (!lineAt.has(n)) fail('Line ' + ln + ': there is no line ' + n + '.'); return lineAt.get(n); };
    const splitColons = t => { const out2 = []; let cur = '', q = false; for (const c of t) { if (c === '"') q = !q; if (c === ':' && !q && !/^\s*IF\b.*\bTHEN\b/i.test(cur)) { out2.push(cur); cur = ''; } else cur += c; } out2.push(cur); return out2.map(z => z.trim()).filter(Boolean); };
    const exec1 = (s, n, pc) => {
      let next = pc + 1, m;
      const U = s.toUpperCase();
      if (/^(REM\b|')/.test(U) || /^DATA\b/.test(U)) return next;
      if ((m = /^PRINT\b\s*(.*)$/i.exec(s)) || (m = /^\?\s*(.*)$/.exec(s))) {
        const body = m[1]; const p = parseExpr(body, n); let endsSep = false;
        for (;;) { p.ws(); if (!p.rest().length) break; const c = p.rest()[0]; if (c === ';') { p.setAt(p.at() + 1); endsSep = true; continue; } if (c === ',') { p.setAt(p.at() + 1); out(' '.repeat(14 - (col % 14))); endsSep = true; continue; } const v = p.or(); out(showV(v)); endsSep = false; }
        if (!endsSep) out('\n');
      }
      else if ((m = /^INPUT\b\s*(?:"([^"]*)"\s*[;,]\s*)?(.+)$/i.exec(s))) { if (m[1] !== undefined) out(m[1]); for (const t of splitArgs(m[2])) { const name = t.trim().toUpperCase(), l = io.getline(); const v = l === null ? '' : l; out((m[1] === undefined ? '? ' : '') + v + '\n'); assign(t, name.endsWith('$') ? v : parseFloat(v) || 0, n); } }
      else if ((m = /^READ\b\s*(.+)$/i.exec(s))) { for (const t of splitArgs(m[1])) { if (dataPos >= data.length) fail('Line ' + n + ': out of DATA.'); assign(t, data[dataPos++], n); } }
      else if (/^RESTORE$/i.test(s)) dataPos = 0;
      else if ((m = /^DIM\b\s*(.+)$/i.exec(s))) { for (const t of splitArgs(m[1])) { const mm = /^\s*([A-Za-z][A-Za-z0-9_]*\$?)\s*\(/.exec(t); if (!mm) fail('Line ' + n + ': bad DIM.'); arrs.set(mm[1].toUpperCase(), new Map()); } }
      else if ((m = /^IF\b(.+?)\bTHEN\b(.*)$/i.exec(s))) {
        let then = m[2].trim(), els = null; const em = /^(.*?)\bELSE\b(.*)$/i.exec(then); if (em) { then = em[1].trim(); els = em[2].trim(); }
        const branch = ev(m[1], n) ? then : els;
        if (branch) { if (/^\d+$/.test(branch)) return gotoLine(+branch, n); for (const st2 of splitColons(branch)) { const r = exec1(st2, n, pc); if (r !== pc + 1) return r; } }
      }
      else if ((m = /^(?:GOTO|GO TO)\s*(\d+)$/i.exec(s))) next = gotoLine(+m[1], n);
      else if ((m = /^GOSUB\s*(\d+)$/i.exec(s))) { if (gos.length > 1000) fail('Line ' + n + ': too many nested GOSUBs.'); gos.push(next); next = gotoLine(+m[1], n); }
      else if (/^RETURN$/i.test(s)) { if (!gos.length) fail('Line ' + n + ': RETURN without GOSUB.'); next = gos.pop(); }
      else if ((m = /^FOR\s+([A-Za-z][A-Za-z0-9_]*)\s*=\s*(.+?)\s+TO\s+(.+?)(?:\s+STEP\s+(.+))?$/i.exec(s))) { const v = m[1].toUpperCase(), a = ev(m[2], n), b = ev(m[3], n), st = m[4] ? ev(m[4], n) : 1; vars.set(v, a); const f = { v, b, st, pc: next }; for (let k2 = fors.length - 1; k2 >= 0; k2--) if (fors[k2].v === v) fors.splice(k2); fors.push(f); if (st > 0 ? a > b : a < b) { let d = 0, k2 = pc + 1; for (; k2 < prog.length; k2++) { if (/^FOR\b/i.test(prog[k2].s)) d++; else if (/^NEXT\b/i.test(prog[k2].s)) { if (!d) break; d--; } } fors.pop(); next = k2 + 1; } }
      else if ((m = /^NEXT\b\s*([A-Za-z][A-Za-z0-9_]*)?$/i.exec(s))) { let f = fors[fors.length - 1]; if (m[1]) { const v = m[1].toUpperCase(); while (f && f.v !== v) { fors.pop(); f = fors[fors.length - 1]; } } if (!f) fail('Line ' + n + ': NEXT without FOR.'); const val = vars.get(f.v) + f.st; vars.set(f.v, val); if (f.st > 0 ? val <= f.b : val >= f.b) next = f.pc; else fors.pop(); }
      else if ((m = /^WHILE\b(.+)$/i.exec(s))) { if (ev(m[1], n)) whiles.push({ pc }); else { let d = 0, k2 = pc + 1; for (; k2 < prog.length; k2++) { if (/^WHILE\b/i.test(prog[k2].s)) d++; else if (/^WEND\b/i.test(prog[k2].s)) { if (!d) break; d--; } } next = k2 + 1; } }
      else if (/^WEND$/i.test(s)) { const w = whiles.pop(); if (!w) fail('Line ' + n + ': WEND without WHILE.'); next = w.pc; }
      else if (/^(END|STOP)$/i.test(s)) return -1;
      else if (/^CLS$/i.test(s)) { /* no screen to clear */ }
      else if ((m = /^(?:LET\s+)?([A-Za-z][A-Za-z0-9_]*\$?\s*(?:\([^=]*\))?)\s*=\s*(.+)$/i.exec(s))) assign(m[1], ev(m[2], n), n);
      else fail('Line ' + n + ': BASIC does not understand "' + s + '".');
      return next;
    };
    for (let pc = 0; pc < prog.length && pc >= 0;) { io.tick(); pc = exec1(prog[pc].s, prog[pc].n, pc); }
  };
})(typeof self !== 'undefined' ? self : globalThis);
if (typeof module !== 'undefined' && module.exports) module.exports = globalThis.Esolangs;

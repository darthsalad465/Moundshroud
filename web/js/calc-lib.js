// Aurum calculator engine, part 2 of 3: the function library. Trigonometry with degrees, radians and gradians,
// logs, roots, factorials, nCr/nPr, constants, complex numbers, matrices and vectors, statistics with
// regressions and distributions, number bases and bitwise operations, and numeric calculus.
(function () {
  'use strict';
  const E = typeof CalcEngine !== 'undefined' ? CalcEngine : require('./calc-engine.js');
  const { Frac, F, F0, F1, Cx, Mat, err, isF, isC, isM, isL, isNum, isScalar, isZero, absN, N, cx, toC, sAdd, sSub, sMul, sDiv, sPow, sNeg, op, mapV, bgcd, babs, cexp, clog, ev } = E;
  const FN = E.FN, SP = E.SPECIAL;
  const m1 = f => (a, c) => { if (a.length !== 1) err('That function takes one value'); return mapV(a[0], x => f(x, c)); };
  const real = f => m1(x => f(N(x)));
  const int = v => { if (!isF(v) || !v.isInt) { const x = N(v); if (!Number.isInteger(x)) err('That needs a whole number'); return BigInt(x); } return v.n; };
  const list = v => isL(v) ? v : isM(v) ? v.rows.flat() : err('That needs a list like {1, 2, 3}');
  const nums = v => list(v).map(N);
  const snap = y => (Math.abs(y) < 1e-15 ? 0 : y);

  /* ---------- constants (2018 CODATA; the exact ones are exact) ---------- */
  const L = s => E.litFrac(s);
  Object.assign(E.CONST, { pi: Math.PI, e: Math.E, i: new Cx(0, 1), phi: (1 + Math.sqrt(5)) / 2, inf: Infinity, _c: L('299792458'), _g: L('9.80665'), _G: 6.6743e-11, _h: L('6.62607015e-34'), _hbar: 1.054571817e-34,
    _NA: L('6.02214076e23'), _k: L('1.380649e-23'), _R: 8.314462618, _qe: L('1.602176634e-19'), _me: 9.1093837015e-31, _mp: 1.67262192369e-27, _mn: 1.67492749804e-27, _e0: 8.8541878128e-12, _mu0: 1.25663706212e-6,
    _atm: L('101325'), _au: L('149597870700'), _ly: L('9460730472580800'), _sigma: 5.670374419e-8, _F: 96485.33212, _Rinf: 10973731.568160, _a0: 5.29177210903e-11, _u: 1.66053906660e-27 });
  E.CONSTANTS = [['_c', 'Speed of light', 'm/s'], ['_g', 'Standard gravity', 'm/s²'], ['_G', 'Gravitational constant', 'N·m²/kg²'], ['_h', 'Planck constant', 'J·s'], ['_hbar', 'Reduced Planck', 'J·s'], ['_NA', 'Avogadro number', '1/mol'],
    ['_k', 'Boltzmann constant', 'J/K'], ['_R', 'Gas constant', 'J/(mol·K)'], ['_qe', 'Elementary charge', 'C'], ['_me', 'Electron mass', 'kg'], ['_mp', 'Proton mass', 'kg'], ['_mn', 'Neutron mass', 'kg'], ['_u', 'Atomic mass unit', 'kg'],
    ['_e0', 'Vacuum permittivity', 'F/m'], ['_mu0', 'Vacuum permeability', 'N/A²'], ['_sigma', 'Stefan-Boltzmann', 'W/(m²·K⁴)'], ['_F', 'Faraday constant', 'C/mol'], ['_a0', 'Bohr radius', 'm'], ['_Rinf', 'Rydberg constant', '1/m'],
    ['_atm', 'Standard atmosphere', 'Pa'], ['_au', 'Astronomical unit', 'm'], ['_ly', 'Light year', 'm'], ['phi', 'Golden ratio', ''], ['pi', 'π', ''], ['e', "Euler's number", '']];

  /* ---------- trigonometry ---------- */
  const toRad = (x, c) => (c.angle === 'deg' ? x * Math.PI / 180 : c.angle === 'grad' ? x * Math.PI / 200 : x);
  const fromRad = (x, c) => (c.angle === 'deg' ? x * 180 / Math.PI : c.angle === 'grad' ? x * 200 / Math.PI : x);
  const SIN = { 0: F0, 30: F(1, 2), 90: F1, 150: F(1, 2), 180: F0, 210: F(-1, 2), 270: F(-1), 330: F(-1, 2) };
  const TAN = { 0: F0, 45: F1, 135: F(-1), 180: F0, 225: F1, 315: F(-1) };
  function exactDeg(x, c) { if (!isF(x) || c.angle === 'rad') return null; const d = c.angle === 'grad' ? sMul(x, F(9, 10)) : x; if (!d.isInt) return null; return Number(((d.n % 360n) + 360n) % 360n); }
  const trig = (name, f) => m1((x, c) => {
    if (isC(x)) { if (name === 'sin' || name === 'cos') { const z = toC(x), iz = new Cx(-z.im, z.re), a = cexp(iz), b = cexp(new Cx(z.im, -z.re)); const A = toC(a), B = toC(b); return name === 'sin' ? sDiv(sSub(A, B), new Cx(0, 2)) : sDiv(sAdd(A, B), F(2)); } err('That works on real numbers only'); }
    const k = exactDeg(x, c);
    if (k !== null && !c.float) { if (name === 'sin' && SIN[k]) return SIN[k]; if (name === 'cos' && SIN[(k + 90) % 360]) return SIN[(k + 90) % 360]; if (name === 'tan') { if (TAN[k]) return TAN[k]; if (k === 90 || k === 270) err('tan is undefined there'); } }
    return snap(f(toRad(N(x), c)));
  });
  FN.sin = trig('sin', Math.sin); FN.cos = trig('cos', Math.cos); FN.tan = trig('tan', Math.tan);
  FN.sec = m1((x, c) => sDiv(F1, FN.cos([x], c))); FN.csc = m1((x, c) => sDiv(F1, FN.sin([x], c))); FN.cot = m1((x, c) => sDiv(F1, FN.tan([x], c)));
  const inv = f => m1((x, c) => { const v = N(x), r = f(v); if (isNaN(r)) err('Outside the range of that function'); return fromRad(r, c); });
  FN.asin = FN.arcsin = inv(Math.asin); FN.acos = FN.arccos = inv(Math.acos); FN.atan = FN.arctan = inv(Math.atan);
  FN.atan2 = (a, c) => fromRad(Math.atan2(N(a[0]), N(a[1])), c);
  FN.sinh = real(Math.sinh); FN.cosh = real(Math.cosh); FN.tanh = real(Math.tanh); FN.asinh = real(Math.asinh); FN.acosh = real(Math.acosh); FN.atanh = real(Math.atanh);
  FN.sech = real(x => 1 / Math.cosh(x)); FN.csch = real(x => 1 / Math.sinh(x)); FN.coth = real(x => 1 / Math.tanh(x));
  FN.deg = real(x => x * 180 / Math.PI); FN.rad = real(x => x * Math.PI / 180);

  /* ---------- powers, roots, logs ---------- */
  const csqrt = z => { const r = Math.hypot(z.re, z.im), a = Math.sqrt((r + z.re) / 2), b = Math.sign(z.im || 1) * Math.sqrt((r - z.re) / 2); return cx(a, b); };
  FN.sqrt = m1(x => { if (isC(x)) return csqrt(x); if (isF(x)) { if (x.n < 0n) { const r = FN.sqrt([sNeg(x)]); return isF(r) ? cx(0, r.num()) : cx(0, N(r)); } return sPow(x, F(1, 2)); } return x < 0 ? new Cx(0, Math.sqrt(-x)) : Math.sqrt(x); });
  FN.cbrt = m1(x => isF(x) ? sPow(x, F(1, 3)) : Math.cbrt(N(x)));
  FN.root = (a) => mapV(a[0], x => { const n = a[1]; if (isF(n) && isF(x)) return sPow(x, sDiv(F1, n)); return sPow(x, 1 / N(n)); });
  FN.sq = m1(x => sMul(x, x));
  FN.exp = m1(x => isC(x) ? cexp(x) : isF(x) && x.n === 0n ? F1 : Math.exp(N(x)));
  const ln = x => { if (isC(x)) return cx(clog(x).re, clog(x).im); if (isF(x) && x.n === 1n && x.d === 1n) return F0; const v = N(x); if (v === 0) err('The log of 0 is undefined'); return v < 0 ? cx(Math.log(-v), Math.PI) : Math.log(v); };
  FN.ln = m1(ln);
  const logb = (x, b) => { if (isF(x) && isF(b) && x.n > 0n && b.n > 1n && x.d === 1n && b.d === 1n) { let k = 0n, p = 1n; while (p < x.n) { p *= b.n; k++; } if (p === x.n) return F(k); } const r = sDiv(ln(x), ln(b)); return isNum(r) ? snap(Math.round(r * 1e12) / 1e12 === Math.round(r) ? (Math.abs(r - Math.round(r)) < 1e-13 ? Math.round(r) : r) : r) : r; };
  FN.log = (a) => mapV(a[0], x => logb(x, a.length > 1 ? a[1] : F(10)));
  FN.log10 = m1(x => logb(x, F(10))); FN.log2 = m1(x => logb(x, F(2))); FN.logb = FN.log;

  /* ---------- whole numbers ---------- */
  function lgamma(x) { if (x < 0.5) return Math.log(Math.PI / Math.abs(Math.sin(Math.PI * x))) - lgamma(1 - x); const g = 7, C = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7]; x -= 1; let a = C[0]; const t = x + g + 0.5; for (let i = 1; i < 9; i++) a += C[i] / (x + i); return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a); }
  function gamma(x) { if (Number.isInteger(x) && x <= 0) err('Gamma is undefined at 0 and negative whole numbers'); if (x < 0.5) return Math.PI / (Math.sin(Math.PI * x) * gamma(1 - x)); return Math.exp(lgamma(x)); }
  E.lgamma = lgamma;
  FN.gamma = real(gamma);
  FN.fact = FN.factorial = m1(x => { if (isF(x) && x.isInt) { if (x.n < 0n) err('Factorial needs 0 or more'); if (x.n > 5000n) err('That factorial is too big'); let r = 1n; for (let k = 2n; k <= x.n; k++) r *= k; return F(r); } return gamma(N(x) + 1); });
  const ncr = (n, r) => { if (r < 0n || r > n) return 0n; r = r > n - r ? n - r : r; let a = 1n; for (let k = 1n; k <= r; k++) a = a * (n - r + k) / k; return a; };
  FN.ncr = FN.choose = FN.binomial = a => F(ncr(int(a[0]), int(a[1])));
  FN.npr = a => { const n = int(a[0]), r = int(a[1]); if (r < 0n || r > n) return F0; let p = 1n; for (let k = n - r + 1n; k <= n; k++) p *= k; return F(p); };
  const many = a => a.length === 1 && isL(a[0]) ? a[0] : a;
  FN.gcd = a => F(many(a).map(int).reduce((x, y) => bgcd(x, y)));
  FN.lcm = a => F(many(a).map(int).reduce((x, y) => (x === 0n || y === 0n ? 0n : babs(x * y) / bgcd(x, y))));
  FN.mod = a => { const x = a[0], m = a[1]; if (isF(x) && isF(m)) { if (m.n === 0n) err('mod by 0'); const q = sDiv(x, m), fl = F(q.n / q.d - ((q.n % q.d !== 0n && q.n < 0n) ? 1n : 0n)); return sSub(x, sMul(m, fl)); } const y = N(m); return N(x) - y * Math.floor(N(x) / y); };
  FN.rem = a => isF(a[0]) && isF(a[1]) && a[0].isInt && a[1].isInt ? F(a[0].n % a[1].n) : N(a[0]) % N(a[1]);
  const flo = x => isF(x) ? F(x.n / x.d - ((x.n % x.d !== 0n && x.n < 0n) ? 1n : 0n)) : Math.floor(N(x));
  FN.floor = m1(flo); FN.ceil = m1(x => sNeg(flo(sNeg(x)))); FN.trunc = FN.ipart = m1(x => isF(x) ? F(x.n / x.d) : Math.trunc(N(x)));
  FN.fpart = m1(x => sSub(x, FN.trunc([x])));
  FN.round = a => mapV(a[0], x => { const d = a.length > 1 ? Number(int(a[1])) : 0; if (isF(x)) { const s = F(10n ** BigInt(d)), y = sMul(x, s), r = flo(sAdd(y, F(1, 2))); return sDiv(r, s); } const p = Math.pow(10, d); return Math.round(N(x) * p) / p; });
  FN.abs = m1(x => isC(x) ? Math.hypot(x.re, x.im) : isF(x) ? new Frac(babs(x.n), x.d, x.dec) : Math.abs(x));
  FN.sign = FN.sgn = m1(x => F(Math.sign(N(x))));
  FN.min = a => many(a).reduce((x, y) => (N(y) < N(x) ? y : x)); FN.max = a => many(a).reduce((x, y) => (N(y) > N(x) ? y : x));
  function isPrime(n) { if (n < 2n) return false; for (const p of [2n, 3n, 5n, 7n, 11n, 13n, 17n, 19n, 23n, 29n, 31n, 37n]) { if (n === p) return true; if (n % p === 0n) return false; } let d = n - 1n, s = 0; while (d % 2n === 0n) { d /= 2n; s++; } const pw = (b, e, m) => { let r = 1n; b %= m; while (e) { if (e & 1n) r = r * b % m; b = b * b % m; e >>= 1n; } return r; }; outer: for (const a of [2n, 3n, 5n, 7n, 11n, 13n, 17n, 19n, 23n, 29n, 31n, 37n]) { let x = pw(a, d, n); if (x === 1n || x === n - 1n) continue; for (let i = 1; i < s; i++) { x = x * x % n; if (x === n - 1n) continue outer; } return false; } return true; }
  FN.isprime = a => isPrime(int(a[0]));
  FN.nextprime = a => { let n = int(a[0]) + 1n; while (!isPrime(n)) n++; return F(n); };
  function factorInt(n) { const out = []; n = babs(n); for (let p = 2n; p * p <= n; p += (p === 2n ? 1n : 2n)) { if (p > 10000000n) break; let k = 0; while (n % p === 0n) { n /= p; k++; } if (k) out.push([p, k]); } if (n > 1n) out.push([n, 1]); return out; }
  E.factorInt = factorInt;
  FN.ifactor = a => { const n = int(a[0]); if (babs(n) < 2n) return n.toString(); return (n < 0n ? '−' : '') + factorInt(n).map(([p, k]) => p + (k > 1 ? E.sup(String(k)) : '')).join('·'); };
  FN.divisors = a => { const n = babs(int(a[0])), out = []; for (let d = 1n; d * d <= n && d < 10000000n; d++) if (n % d === 0n) { out.push(d); if (d * d !== n) out.push(n / d); } return out.sort((x, y) => (x < y ? -1 : 1)).map(F); };
  FN.rand = a => a.length ? F(BigInt(Math.floor(Math.random() * Number(int(a[0]))) + 1)) : Math.random();
  FN.randint = a => { const lo = Number(int(a[0])), hi = Number(int(a[1])); return F(BigInt(lo + Math.floor(Math.random() * (hi - lo + 1)))); };
  FN.randnorm = a => { const mu = a.length ? N(a[0]) : 0, sd = a.length > 1 ? N(a[1]) : 1; return mu + sd * Math.sqrt(-2 * Math.log(1 - Math.random())) * Math.cos(2 * Math.PI * Math.random()); };

  /* ---------- complex numbers ---------- */
  FN.re = FN.real = m1(x => isC(x) ? x.re : x); FN.im = FN.imag = m1(x => isC(x) ? x.im : F0);
  FN.conj = m1(x => isC(x) ? new Cx(x.re, -x.im) : x);
  FN.arg = FN.angle = m1((x, c) => fromRad(Math.atan2(isC(x) ? x.im : 0, isC(x) ? x.re : N(x)), c));
  FN.polar = (a, c) => { const r = N(a[0]), t = toRad(N(a[1]), c); return cx(r * Math.cos(t), r * Math.sin(t)); };

  /* ---------- matrices and vectors ---------- */
  const mat = v => isM(v) ? v : isL(v) ? new Mat([v]) : err('That needs a matrix like [[1, 2], [3, 4]]');
  function elim(rows, cols) {
    let r = 0, det = F1; const m = rows.length;
    for (let c = 0; c < cols && r < m; c++) {
      let p = -1, best = -1; for (let i = r; i < m; i++) { const v = rows[i][c]; if (!isZero(v)) { const s = absN(v); if (s > best) { p = i; best = s; } } }
      if (p < 0) { det = F0; continue; }
      if (p !== r) { [rows[p], rows[r]] = [rows[r], rows[p]]; det = sNeg(det); }
      const pv = rows[r][c]; det = sMul(det, pv); rows[r] = rows[r].map(x => sDiv(x, pv));
      for (let i = 0; i < m; i++) if (i !== r && !isZero(rows[i][c])) { const f = rows[i][c]; rows[i] = rows[i].map((x, j) => { const y = sSub(x, sMul(f, rows[r][j])); return isNum(y) && Math.abs(y) < 1e-13 ? 0 : y; }); }
      r++;
    }
    return { rank: r, det: r < Math.min(m, cols) ? F0 : det };
  }
  const copyRows = M => M.rows.map(r => r.slice());
  FN.det = a => { const M = mat(a[0]); if (M.r !== M.c) err('det needs a square matrix'); return elim(copyRows(M), M.c).det; };
  FN.inv = a => { const M = mat(a[0]); if (M.r !== M.c) err('Only square matrices have an inverse'); const n = M.r, rows = M.rows.map((r, i) => r.concat(Array.from({ length: n }, (_, j) => (i === j ? F1 : F0)))); const { rank } = elim(rows, n); if (rank < n) err('This matrix has no inverse (its determinant is 0)'); return new Mat(rows.map(r => r.slice(n))); };
  FN.rref = a => { const M = mat(a[0]), rows = copyRows(M); elim(rows, M.c); return new Mat(rows); };
  FN.rank = a => { const M = mat(a[0]); return F(elim(copyRows(M), M.c).rank); };
  FN.transpose = FN.trans = a => { const M = mat(a[0]); return new Mat(M.rows[0].map((_, j) => M.rows.map(r => r[j]))); };
  FN.trace = a => { const M = mat(a[0]); return M.rows.reduce((s, r, i) => sAdd(s, r[i] || F0), F0); };
  FN.identity = FN.eye = a => { const n = Number(int(a[0])); if (n < 1 || n > 50) err('Size must be 1 to 50'); return new Mat(Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? F1 : F0)))); };
  FN.zeros = a => { const r = Number(int(a[0])), c = Number(int(a.length > 1 ? a[1] : a[0])); return new Mat(Array.from({ length: r }, () => Array(c).fill(F0))); };
  FN.dim = a => isM(a[0]) ? [F(a[0].r), F(a[0].c)] : F(list(a[0]).length);
  FN.augment = a => { if (isL(a[0]) && isL(a[1])) return a[0].concat(a[1]); const A = mat(a[0]), B = isL(a[1]) ? new Mat(a[1].map(x => [x])) : mat(a[1]); if (A.r !== B.r) err('Both need the same number of rows'); return new Mat(A.rows.map((r, i) => r.concat(B.rows[i]))); };
  FN.linsolve = a => { const A = mat(a[0]), b = isL(a[1]) ? a[1] : FN.transpose([a[1]]).rows[0]; if (A.r !== b.length) err('Sizes do not match'); const rows = A.rows.map((r, i) => r.concat([b[i]])); const { rank } = elim(rows, A.c); if (rank < A.c) err('No single solution'); if (rows.slice(rank).some(r => !isZero(r[A.c]))) err('No solution'); return rows.slice(0, A.c).map(r => r[A.c]); };
  const vec = v => isL(v) ? v : isM(v) && (v.r === 1 || v.c === 1) ? v.rows.flat() : err('That needs a vector like [1, 2, 3]');
  FN.dot = a => { const x = vec(a[0]), y = vec(a[1]); if (x.length !== y.length) err('Vectors must be the same length'); return x.reduce((s, v, i) => sAdd(s, sMul(v, y[i])), F0); };
  FN.cross = FN.crossp = a => { const x = vec(a[0]), y = vec(a[1]); if (x.length !== 3 || y.length !== 3) err('Cross product needs two 3D vectors'); return [sSub(sMul(x[1], y[2]), sMul(x[2], y[1])), sSub(sMul(x[2], y[0]), sMul(x[0], y[2])), sSub(sMul(x[0], y[1]), sMul(x[1], y[0]))]; };
  FN.norm = a => { if (isM(a[0]) && a[0].r > 1 && a[0].c > 1) return Math.sqrt(a[0].rows.flat().reduce((s, v) => s + absN(v) ** 2, 0)); const v = vec(a[0]); return FN.sqrt([v.reduce((s, x) => sAdd(s, isC(x) ? absN(x) ** 2 : sMul(x, x)), F0)]); };
  FN.unitv = a => { const v = vec(a[0]), n = FN.norm([v]); return v.map(x => sDiv(x, n)); };
  FN.eig = FN.eigvals = a => {
    const M = mat(a[0]); if (M.r !== M.c) err('Eigenvalues need a square matrix'); let A = M.rows.map(r => r.map(N)); const n = A.length;
    if (n === 1) return [A[0][0]];
    if (n === 2) { const t = A[0][0] + A[1][1], d = A[0][0] * A[1][1] - A[0][1] * A[1][0], D = t * t / 4 - d; if (D >= 0) { const s = Math.sqrt(D); return [t / 2 + s, t / 2 - s].map(snap); } const s = Math.sqrt(-D); return [cx(t / 2, s), cx(t / 2, -s)]; }
    for (let it = 0; it < 800; it++) {
      const Q = A.map(r => r.map(() => 0)), R = A.map(r => r.map(() => 0));
      for (let j = 0; j < n; j++) { const v = A.map(r => r[j]); for (let k = 0; k < j; k++) { const qk = Q.map(r => r[k]); const d = qk.reduce((s, q, i) => s + q * A[i][j], 0); R[k][j] = d; for (let i = 0; i < n; i++) v[i] -= d * qk[i]; } const nv = Math.hypot(...v); R[j][j] = nv; for (let i = 0; i < n; i++) Q[i][j] = nv ? v[i] / nv : 0; }
      A = R.map(r => Q[0].map((_, j) => r.reduce((s, x, k) => s + x * Q[k][j], 0)));
    }
    return A.map((r, i) => snap(+r[i].toPrecision(13))).sort((x, y) => y - x);
  };

  /* ---------- statistics ---------- */
  FN.sum = a => list(many(a)).reduce((s, x) => op('+', s, x), F0);
  FN.prod = FN.product = a => list(many(a)).reduce((s, x) => op('*', s, x), F1);
  FN.mean = FN.avg = a => { const l = list(many(a)); if (!l.length) err('The list is empty'); return op('/', FN.sum([l]), F(l.length)); };
  const sorted = l => nums(l).slice().sort((x, y) => x - y);
  const medOf = s => { const n = s.length; if (!n) err('The list is empty'); return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2; };
  FN.median = a => { const l = list(many(a)); if (l.every(isF)) { const s = l.slice().sort((x, y) => N(x) - N(y)), n = s.length; return n % 2 ? s[(n - 1) / 2] : sDiv(sAdd(s[n / 2 - 1], s[n / 2]), F(2)); } return medOf(sorted(l)); };
  const quart = (l, upper) => { const s = sorted(l), h = Math.floor(s.length / 2); return medOf(upper ? s.slice(s.length - h) : s.slice(0, h)); };
  FN.q1 = a => quart(many(a), false); FN.q3 = a => quart(many(a), true); FN.iqr = a => quart(many(a), true) - quart(many(a), false);
  FN.mode = a => { const cnt = new Map(); nums(many(a)).forEach(x => cnt.set(x, (cnt.get(x) || 0) + 1)); const top = Math.max(...cnt.values()); return [...cnt].filter(e => e[1] === top).map(e => e[0]).sort((x, y) => x - y); };
  const variance = (l, pop) => { l = list(l); const n = l.length; if (n < (pop ? 1 : 2)) err('Not enough values'); const m = FN.mean([l]); const ss = l.reduce((s, x) => { const d = op('-', x, m); return op('+', s, op('*', d, d)); }, F0); return op('/', ss, F(pop ? n : n - 1)); };
  FN.var = FN.variance = a => variance(many(a), false); FN.pvar = a => variance(many(a), true);
  FN.sd = FN.stdev = FN.stddev = a => FN.sqrt([variance(many(a), false)]); FN.psd = FN.pstdev = a => FN.sqrt([variance(many(a), true)]);
  FN.count = FN.len = a => F(list(many(a)).length);
  FN.sort = FN.sorta = a => list(many(a)).slice().sort((x, y) => N(x) - N(y)); FN.sortd = a => FN.sort(a).reverse();
  FN.cumsum = a => { let s = F0; return list(many(a)).map(x => (s = op('+', s, x))); };
  FN.cov = a => { const x = nums(a[0]), y = nums(a[1]), mx = x.reduce((s, v) => s + v, 0) / x.length, my = y.reduce((s, v) => s + v, 0) / y.length; return x.reduce((s, v, i) => s + (v - mx) * (y[i] - my), 0) / (x.length - 1); };
  FN.corr = a => FN.cov(a) / (Math.sqrt(N(variance(a[0], false))) * Math.sqrt(N(variance(a[1], false))));
  FN.stats = FN.onevar = a => { const l = list(many(a)), s = sorted(l), n = s.length, sum = s.reduce((x, y) => x + y, 0), sum2 = s.reduce((x, y) => x + y * y, 0); return { kind: 'stats', rows: [['n', n], ['Mean x̄', sum / n], ['Σx', sum], ['Σx²', sum2], ['Sample SD Sx', n > 1 ? Math.sqrt(N(variance(l, false))) : NaN], ['Population SD σx', Math.sqrt(N(variance(l, true)))], ['Minimum', s[0]], ['Q1', n > 1 ? quart(l, false) : s[0]], ['Median', medOf(s)], ['Q3', n > 1 ? quart(l, true) : s[0]], ['Maximum', s[n - 1]]] }; };
  function solveLin(A, b) { const n = A.length, M = A.map((r, i) => r.concat([b[i]])); for (let c = 0; c < n; c++) { let p = c; for (let i = c + 1; i < n; i++) if (Math.abs(M[i][c]) > Math.abs(M[p][c])) p = i; [M[c], M[p]] = [M[p], M[c]]; if (Math.abs(M[c][c]) < 1e-300) err('Not enough different x values for that fit'); for (let i = 0; i < n; i++) if (i !== c) { const f = M[i][c] / M[c][c]; for (let j = c; j <= n; j++) M[i][j] -= f * M[c][j]; } } return M.map((r, i) => r[n] / r[i]); }
  function polyfit(x, y, deg) { const k = deg + 1, A = [], b = []; for (let i = 0; i < k; i++) { A.push([]); for (let j = 0; j < k; j++) A[i].push(x.reduce((s, v) => s + Math.pow(v, i + j), 0)); b.push(x.reduce((s, v, t) => s + y[t] * Math.pow(v, i), 0)); } return solveLin(A, b); }
  const r2Of = (x, y, f) => { const my = y.reduce((s, v) => s + v, 0) / y.length, sst = y.reduce((s, v) => s + (v - my) ** 2, 0), sse = y.reduce((s, v, i) => s + (v - f(x[i])) ** 2, 0); return sst ? 1 - sse / sst : 1; };
  const cs = v => { const r = +v.toPrecision(10); return r < 0 ? '(' + r + ')' : String(r); };
  function reg(type) {
    return a => {
      const x = nums(a[0]), y = nums(a[1]); if (x.length !== y.length) err('The x and y lists must be the same length'); if (x.length < 2) err('Need at least 2 points');
      let coef, f, expr, labels;
      if (type === 'lin' || type === 'quad' || type === 'cubic') { const d = { lin: 1, quad: 2, cubic: 3 }[type]; if (x.length <= d) err('Need at least ' + (d + 1) + ' points'); const c = polyfit(x, y, d).reverse(); coef = c; f = t => c.reduce((s, v) => s * t + v, 0); expr = c.map((v, i) => cs(v) + (d - i ? '*x' + (d - i > 1 ? '^' + (d - i) : '') : '')).join('+'); labels = 'abcd'.slice(0, d + 1).split(''); }
      else if (type === 'exp') { if (y.some(v => v <= 0)) err('Exponential fit needs y above 0'); const c = polyfit(x, y.map(Math.log), 1); coef = [Math.exp(c[0]), Math.exp(c[1])]; f = t => coef[0] * Math.pow(coef[1], t); expr = cs(coef[0]) + '*' + cs(coef[1]) + '^x'; labels = ['a', 'b']; }
      else if (type === 'pow') { if (y.some(v => v <= 0) || x.some(v => v <= 0)) err('Power fit needs x and y above 0'); const c = polyfit(x.map(Math.log), y.map(Math.log), 1); coef = [Math.exp(c[0]), c[1]]; f = t => coef[0] * Math.pow(t, coef[1]); expr = cs(coef[0]) + '*x^' + cs(coef[1]); labels = ['a', 'b']; }
      else { if (x.some(v => v <= 0)) err('Log fit needs x above 0'); const c = polyfit(x.map(Math.log), y, 1); coef = [c[0], c[1]]; f = t => coef[0] + coef[1] * Math.log(t); expr = cs(coef[0]) + '+' + cs(coef[1]) + '*ln(x)'; labels = ['a', 'b']; }
      const r2 = r2Of(x, y, f), o = { kind: 'reg', type, coef, labels, r2, expr };
      if (type === 'lin') o.r = Math.sign(coef[0]) * Math.sqrt(Math.max(0, r2));
      return o;
    };
  }
  FN.linreg = reg('lin'); FN.quadreg = reg('quad'); FN.cubicreg = reg('cubic'); FN.expreg = reg('exp'); FN.powreg = reg('pow'); FN.lnreg = FN.logreg = reg('ln');
  E.REG_FORM = { lin: 'y = a·x + b', quad: 'y = a·x² + b·x + c', cubic: 'y = a·x³ + b·x² + c·x + d', exp: 'y = a·bˣ', pow: 'y = a·xᵇ', ln: 'y = a + b·ln(x)' };

  /* ---------- probability distributions ---------- */
  function erfcCF(x) { let f = 0; for (let k = 80; k >= 1; k--) f = (k / 2) / (x + f); return Math.exp(-x * x) / Math.sqrt(Math.PI) / (x + f); }
  function erf(x) { const s = Math.sign(x), a = Math.abs(x); if (a >= 3) return s * (1 - erfcCF(a)); let sum = 0, t = a; for (let n = 0; n < 300; n++) { const add = t / (2 * n + 1); sum += add; t *= -a * a / (n + 1); if (Math.abs(add) < 1e-17 * Math.abs(sum)) break; } return s * 2 / Math.sqrt(Math.PI) * sum; }
  const erfc = y => (y >= 3 ? erfcCF(y) : y <= -3 ? 2 - erfcCF(-y) : 1 - erf(y));
  const Phi = z => 0.5 * erfc(-z / Math.SQRT2);
  E.erf = erf; E.Phi = Phi;
  FN.erf = real(erf); FN.erfc = real(erfc);
  FN.normpdf = a => { const x = N(a[0]), mu = a.length > 1 ? N(a[1]) : 0, sd = a.length > 2 ? N(a[2]) : 1; return Math.exp(-0.5 * ((x - mu) / sd) ** 2) / (sd * Math.sqrt(2 * Math.PI)); };
  FN.normcdf = a => { if (a.length <= 1) return Phi(N(a[0])); if (a.length === 3) return Phi((N(a[0]) - N(a[1])) / N(a[2])); const lo = N(a[0]), hi = N(a[1]), mu = a.length > 2 ? N(a[2]) : 0, sd = a.length > 3 ? N(a[3]) : 1; return Phi((hi - mu) / sd) - Phi((lo - mu) / sd); };
  function invPhi(p) { if (p <= 0 || p >= 1) err('Probability must be between 0 and 1'); const a = [-39.69683028665376, 220.9460984245205, -275.9285104469687, 138.357751867269, -30.66479806614716, 2.506628277459239], b = [-54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972, -13.28068155288572], c = [-0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783], d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416]; let x; if (p < 0.02425) { const q = Math.sqrt(-2 * Math.log(p)); x = (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1); } else if (p > 1 - 0.02425) { const q = Math.sqrt(-2 * Math.log(1 - p)); x = -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1); } else { const q = p - 0.5, r = q * q; x = (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1); } for (let i = 0; i < 2; i++) { const e = Phi(x) - p, u = e * Math.sqrt(2 * Math.PI) * Math.exp(x * x / 2); x = x - u / (1 + x * u / 2); } return x; }
  FN.invnorm = a => { const p = N(a[0]), mu = a.length > 1 ? N(a[1]) : 0, sd = a.length > 2 ? N(a[2]) : 1; return mu + sd * invPhi(p); };
  const lchoose = (n, k) => lgamma(n + 1) - lgamma(k + 1) - lgamma(n - k + 1);
  const binp = (n, p, k) => (k < 0 || k > n ? 0 : p === 0 ? (k === 0 ? 1 : 0) : p === 1 ? (k === n ? 1 : 0) : Math.exp(lchoose(n, k) + k * Math.log(p) + (n - k) * Math.log(1 - p)));
  FN.binompdf = a => { const n = Number(int(a[0])), p = N(a[1]), k = Number(int(a[2])); return binp(n, p, k); };
  FN.binomcdf = a => { const n = Number(int(a[0])), p = N(a[1]), k = Number(int(a[2])); let s = 0; for (let i = 0; i <= Math.min(k, n); i++) s += binp(n, p, i); return Math.min(1, s); };
  const poip = (l, k) => Math.exp(-l + k * Math.log(l) - lgamma(k + 1));
  FN.poissonpdf = a => poip(N(a[0]), Number(int(a[1]))); FN.poissoncdf = a => { let s = 0; for (let i = 0; i <= Number(int(a[1])); i++) s += poip(N(a[0]), i); return Math.min(1, s); };
  FN.geompdf = a => { const p = N(a[0]), k = Number(int(a[1])); return p * Math.pow(1 - p, k - 1); };

  /* ---------- number bases and bits ---------- */
  const DIG = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  FN.tobase = FN.base = (a, c) => {
    let n = int(a[0]); const b = Number(int(a[1])); if (b < 2 || b > 36) err('Base must be 2 to 36'); const bits = BigInt((c && c.bits) || 64);
    if (n < 0n) { if (b === 2 || b === 8 || b === 16) n = BigInt.asUintN(Number(bits), n); else return '−' + FN.tobase([F(-n), F(b)], c).replace(/^0[xbo]/, ''); }
    let s = ''; const B = BigInt(b); do { s = DIG[Number(n % B)] + s; n /= B; } while (n > 0n);
    return (b === 16 ? '0x' : b === 2 ? '0b' : b === 8 ? '0o' : '') + s + (b === 16 || b === 2 || b === 8 || b === 10 ? '' : '₍' + [...String(b)].map(d => '₀₁₂₃₄₅₆₇₈₉'[d]).join('') + '₎');
  };
  FN.hex = (a, c) => FN.tobase([a[0], F(16)], c); FN.bin = (a, c) => FN.tobase([a[0], F(2)], c); FN.oct = (a, c) => FN.tobase([a[0], F(8)], c);
  FN.frombase = a => { const s = String(a[0]).trim().toUpperCase().replace(/^0[XBO]/, ''), b = BigInt(Number(int(a[1]))); let n = 0n; for (const ch of s) { const d = DIG.indexOf(ch); if (d < 0 || BigInt(d) >= b) err('"' + ch + '" is not a digit in base ' + b); n = n * b + BigInt(d); } return F(n); };
  const W = c => Number((c && c.bits) || 64);
  const bit = f => (a, c) => F(BigInt.asIntN(W(c), many(a).map(int).reduce(f)));
  FN.and = FN.band = bit((x, y) => x & y); FN.or = FN.bor = bit((x, y) => x | y); FN.xor = FN.bxor = bit((x, y) => x ^ y);
  FN.not = FN.bnot = (a, c) => F(BigInt.asIntN(W(c), ~int(a[0])));
  FN.nand = (a, c) => FN.not([FN.and(a, c)], c); FN.nor = (a, c) => FN.not([FN.or(a, c)], c);
  FN.shl = (a, c) => F(BigInt.asIntN(W(c), int(a[0]) << int(a.length > 1 ? a[1] : F1)));
  FN.shr = (a, c) => F(BigInt.asIntN(W(c), BigInt.asUintN(W(c), int(a[0])) >> int(a.length > 1 ? a[1] : F1)));
  FN.popcount = (a, c) => F(BigInt(BigInt.asUintN(W(c), int(a[0])).toString(2).replace(/0/g, '').length));

  /* ---------- units (the page plugs in the app's converter) ---------- */
  FN.convert = a => { if (!E.units) err('Unit conversion is not available here'); const r = E.units(N(a[0]), String(a[1]).toLowerCase(), String(a[2]).toLowerCase()); if (r == null) err('Those units do not convert into each other'); return r; };

  /* ---------- numeric calculus and functions with a running variable ---------- */
  const vname = (n, what) => (n && n.t === 'sym' ? n.n : err((what || 'The variable') + ' must be a name like x'));
  function fnOf(ast, v, c) { const local = new Map(c.local || []); const c2 = Object.assign({}, c, { float: true, local }); return x => { local.set(v, x); try { const r = ev(ast, c2); return isF(r) ? r.num() : isNum(r) ? r : NaN; } catch (e) { return NaN; } }; }
  E.fnOf = fnOf;
  /* tanh-sinh quadrature: accurate even when the function blows up at an end point */
  function quad(f, a, b) {
    if (a === b) return 0; if (a > b) return -quad(f, b, a);
    if (!isFinite(a) || !isFinite(b)) {
      if (isFinite(a)) return quad(t => { const s = 1 - t; return f(a + t / s) / (s * s); }, 0, 1);
      if (isFinite(b)) return quad(t => f(b - (1 - t) / t) / (t * t), 0, 1);
      return quad(t => { const s = 1 - t * t; return f(t / s) * (1 + t * t) / (s * s); }, -1, 1);
    }
    const c = (a + b) / 2, h2 = (b - a) / 2, fs = x => { const y = f(x); return isFinite(y) ? y : 0; };
    const terms = (t) => { const u = Math.PI / 2 * Math.sinh(t), ch = Math.cosh(u), w = Math.PI / 2 * Math.cosh(t) / (ch * ch), d = h2 * 2 / (1 + Math.exp(2 * u)); if (!(d > 0) || !isFinite(w)) return null; return w * (fs(b - d) + fs(a + d)); };
    let h = 1, S = Math.PI / 2 * fs(c);
    for (let k = 1; ; k++) { const v = terms(k * h); if (v === null || k > 60) break; S += v; }
    let I = h2 * h * S;
    for (let level = 1; level <= 9; level++) {
      h /= 2; for (let k = 1; ; k += 2) { const v = terms(k * h); if (v === null || k * h > 6) break; S += v; }
      const In = h2 * h * S; if (level >= 3 && Math.abs(In - I) <= 1e-13 * Math.abs(In) + 1e-300) { I = In; break; } I = In;
    }
    return I;
  }
  E.quad = quad;
  function nderiv(f, x) { const h = 1e-3 * Math.max(1, Math.abs(x)); const d = h => (f(x - 2 * h) - 8 * f(x - h) + 8 * f(x + h) - f(x + 2 * h)) / (12 * h); const a = d(h), b = d(h / 2); return b + (b - a) / 15; }
  E.nderiv = nderiv;
  /* every real root of f between a and b: sign changes plus touching points, each polished by bisection */
  function findRoots(f, a, b, n) {
    n = n || 2000; const out = [], xs = [], ys = [];
    for (let i = 0; i <= n; i++) { const x = a + (b - a) * i / n; xs.push(x); ys.push(f(x)); }
    const add = x => { if (!out.some(r => Math.abs(r - x) < 1e-9 * Math.max(1, Math.abs(x)))) out.push(x); };
    for (let i = 0; i < n; i++) {
      const y0 = ys[i], y1 = ys[i + 1]; if (!isFinite(y0) || !isFinite(y1)) continue;
      if (y0 === 0) { add(xs[i]); continue; }
      if (y0 * y1 < 0) { let lo = xs[i], hi = xs[i + 1], flo = y0; for (let k = 0; k < 200; k++) { const m = (lo + hi) / 2, fm = f(m); if (fm === 0 || hi - lo < 1e-15 * Math.max(1, Math.abs(m))) { lo = hi = m; break; } if (flo * fm < 0) hi = m; else { lo = m; flo = fm; } } const r = (lo + hi) / 2, fr = f(r); if (isFinite(fr) && Math.abs(fr) < 1e-6 * Math.max(1, Math.abs(y0), Math.abs(y1))) add(r); }
      else if (i > 0 && isFinite(ys[i - 1]) && Math.abs(y0) < Math.abs(ys[i - 1]) && Math.abs(y0) < Math.abs(y1)) {
        let lo = xs[i - 1], hi = xs[i + 1]; const g = x => Math.abs(f(x)); for (let k = 0; k < 120; k++) { const m1x = lo + (hi - lo) * 0.382, m2x = lo + (hi - lo) * 0.618; if (g(m1x) < g(m2x)) hi = m2x; else lo = m1x; } const r = (lo + hi) / 2; if (g(r) < 1e-10 * Math.max(1, Math.abs(r))) add(r);
      }
    }
    return out.sort((x, y) => x - y).map(x => (Math.abs(x) < 1e-12 ? 0 : x));
  }
  E.findRoots = findRoots;
  function extremum(f, a, b, max) { const g = max ? x => -f(x) : f; let best = a, bv = Infinity; for (let i = 0; i <= 400; i++) { const x = a + (b - a) * i / 400, y = g(x); if (y < bv) { bv = y; best = x; } } let lo = Math.max(a, best - (b - a) / 400), hi = Math.min(b, best + (b - a) / 400); for (let k = 0; k < 200; k++) { const p = lo + (hi - lo) * 0.381966, q = lo + (hi - lo) * 0.618034; if (g(p) < g(q)) hi = q; else lo = p; } const x = (lo + hi) / 2; return [x, f(x)]; }
  E.extremum = extremum;
  const loopVar = (args, c, each) => { const v = vname(args[1]), a = Number(int(ev(args[2], c))), b = Number(int(ev(args[3], c))), st = args[4] ? Number(int(ev(args[4], c))) : 1; if (!st || (b - a) / st > 100000) err('Too many steps'); const local = new Map(c.local || []), c2 = Object.assign({}, c, { local }); for (let k = a; st > 0 ? k <= b : k >= b; k += st) { local.set(v, F(k)); each(ev(args[0], c2)); } };
  SP.sum = (args, c) => { if (args.length < 4) return FN.sum(args.map(x => ev(x, c))); let s = F0; loopVar(args, c, v => { s = op('+', s, v); }); return s; };
  SP.prod = SP.product = (args, c) => { if (args.length < 4) return FN.prod(args.map(x => ev(x, c))); let s = F1; loopVar(args, c, v => { s = op('*', s, v); }); return s; };
  SP.seq = (args, c) => { if (args.length < 4) err('seq(expression, k, start, end)'); const out = []; loopVar(args, c, v => out.push(v)); return out; };
  SP.nint = (args, c) => { if (args.length < 4) err('nint(expression, x, from, to)'); const f = fnOf(args[0], vname(args[1]), c); return quad(f, N(ev(args[2], c)), N(ev(args[3], c))); };
  SP.nderiv = (args, c) => { if (args.length < 3) err('nderiv(expression, x, at)'); return nderiv(fnOf(args[0], vname(args[1]), c), N(ev(args[2], c))); };
  SP.fmin = (args, c) => extremum(fnOf(args[0], vname(args[1]), c), N(ev(args[2], c)), N(ev(args[3], c)), false);
  SP.fmax = (args, c) => extremum(fnOf(args[0], vname(args[1]), c), N(ev(args[2], c)), N(ev(args[3], c)), true);
  SP.nsolve = (args, c) => {
    const e = args[0], g = e.t === 'eq' ? { t: 'bin', o: '-', a: e.a, b: e.b } : e, v = vname(args[1]), f = fnOf(g, v, c);
    if (args.length > 2) { let x = N(ev(args[2], c)); for (let i = 0; i < 100; i++) { const y = f(x), d = nderiv(f, x); if (!isFinite(y) || !d) break; const nx = x - y / d; if (Math.abs(nx - x) < 1e-14 * Math.max(1, Math.abs(x))) { x = nx; break; } x = nx; } if (Math.abs(f(x)) > 1e-8) err('No solution found near that guess'); return x; }
    const r = findRoots(f, -1000, 1000, 20000); if (!r.length) err('No real solution between −1000 and 1000'); return r.length === 1 ? r[0] : r;
  };

  /* ---------- showing statistics and regression results ---------- */
  E.showObj = (v, st) => {
    const f = x => E.show(x, Object.assign({}, st, { mode: 'approx' }));
    if (v.kind === 'reg') return E.REG_FORM[v.type] + '   ' + v.labels.map((l, i) => l + ' = ' + f(v.coef[i])).join(', ') + '   r² = ' + f(v.r2) + (v.r !== undefined ? ', r = ' + f(v.r) : '');
    if (v.kind === 'stats') return v.rows.map(r => r[0] + ' ' + f(r[1])).join(' · ');
    return '';
  };
})();

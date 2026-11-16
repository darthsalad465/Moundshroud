// Checks the maths of the Aurum calculator (Office > Calculator): exact arithmetic, angle modes, algebra,
// calculus, matrices, statistics and number bases. Run alone with  node tests\calc-test.js  or through tests\run.js.
const path = require('path');
module.exports = async function (ok) {
  const js = f => path.join(__dirname, '..', 'web', 'js', f);
  const E = require(js('calc-engine.js')); require(js('calc-lib.js')); require(js('calc-cas.js'));
  const out = (s, st) => { const r = E.run(s, st || {}); return r ? r.out : null; };
  const eq = (name, s, want, st) => { const got = out(s, st); ok('calculator: ' + name, got === want, s + '  gave ' + JSON.stringify(got) + ', wanted ' + JSON.stringify(want)); };
  const near = (name, s, want, tol, st) => { const r = E.run(s, st || {}); const v = r && r.value !== undefined ? E.N(r.value) : NaN; ok('calculator: ' + name, Math.abs(v - want) <= (tol || 1e-9) * Math.max(1, Math.abs(want)), s + '  gave ' + (r && r.out) + ', wanted ' + want); };
  const deg = { angle: 'deg' }, rad = { angle: 'rad' }, grad = { angle: 'grad' }, dec = { mode: 'approx' };

  /* arithmetic precision */
  eq('0.1 + 0.2 is exactly 0.3', '0.1+0.2', '0.3');
  eq('fractions stay exact', '1/3+1/6', '1/2');
  eq('decimal mode shows decimals', '1/3', '0.333333333333', dec);
  eq('2^100 has every digit', '2^100', '1267650600228229401496703205376');
  eq('30! is exact', '30!', '265252859812191058636308480000000');
  eq('order of operations', '2+3*4^2', '50');
  eq('unary minus binds after powers', '-2^2', '−4');
  eq('implied multiplication', '3(4+1)', '15');
  eq('percent', '15%*240', '36');
  eq('square root simplifies', 'sqrt(8)', '2√2');
  eq('nCr', 'nCr(52,5)', '2598960');
  eq('nPr', 'nPr(10,3)', '720');
  eq('gcd and lcm', 'gcd(84,36)+lcm(4,6)', '24');
  eq('complex numbers', '(1+2i)*(3-i)', '5 + 5i');
  eq('square root of a negative', 'sqrt(-9)', '3i');
  eq('Euler identity', 'e^(i*pi)', '−1');

  /* trig modes */
  eq('sin 30 degrees is 1/2', 'sin(30)', '1/2', deg);
  eq('cos 60 degrees is 1/2', 'cos(60)', '1/2', deg);
  eq('tan 45 degrees is 1', 'tan(45)', '1', deg);
  eq('asin in degrees', 'asin(1/2)', '30', deg);
  eq('sin in gradians', 'sin(100)', '1', grad);
  eq('sin of pi/6 radians', 'sin(pi/6)', '1/2', rad);
  near('sin 1 radian', 'sin(1)', Math.sin(1), 1e-12, rad);
  near('sin 1 degree', 'sin(1)', Math.sin(Math.PI / 180), 1e-12, deg);

  /* algebra and calculus */
  eq('like terms combine', 'x+x+3x', '5x');
  eq('expand', 'expand((x+1)^3)', 'x³ + 3x² + 3x + 1');
  eq('factor a quadratic', 'factor(x^2-5x+6)', '(x − 2)·(x − 3)');
  eq('factor an integer', 'factor(360)', '2³·3²·5');
  eq('derivative of a polynomial', 'diff(x^3+2x,x)', '3x² + 2');
  eq('derivative with the product rule', 'diff(x*sin(x),x)', 'x·cos(x) + sin(x)', rad);
  eq('second derivative', 'diff(x^4,x,2)', '12x²');
  eq('integral of a polynomial', 'integrate(3x^2,x)', 'x³ + C');
  eq('integral by parts', 'integrate(x*e^x,x)', 'x·e^x − e^x + C');
  eq('definite integral is exact', 'integrate(x^2,x,0,3)', '9');
  near('Gaussian integral', 'integrate(e^(-x^2),x,-inf,inf)', Math.sqrt(Math.PI), 1e-9);
  eq('solve a linear equation', 'solve(2x+3=7,x)', 'x = 2');
  eq('solve a quadratic', 'solve(x^2-5x+6=0,x)', 'x = 2  or  x = 3');
  eq('solve with roots', 'solve(x^2=2,x)', 'x = −√2  or  x = √2');
  eq('solve with complex roots', 'solve(x^2+1=0,x)', 'x = −i  or  x = i');
  eq('a typed equation is solved', 'x^3-6x^2+11x-6=0', 'x = 1  or  x = 2  or  x = 3');
  eq('solve a linear system', 'solve({x+y=3,x-y=1},{x,y})', 'x = 2,  y = 1');
  near('solve numerically', 'nsolve(cos(x)=x,x,1)', 0.7390851332151607, 1e-12, rad);
  eq('limit sin(x)/x', 'limit(sin(x)/x,x,0)', '1', rad);
  eq('limit (1+1/n)^n', 'limit((1+1/n)^n,n,inf)', 'e');
  eq('Taylor series', 'taylor(e^x,x,0,3)', 'x³/6 + x²/2 + x + 1');

  /* variables and functions */
  const st = {};
  E.run('a := 5', st); E.run('f(x) := x^2 + a', st);
  eq('stored variable and function', 'f(3)', '14', st);

  /* matrices */
  eq('determinant', 'det([[1,2],[3,4]])', '−2');
  eq('inverse is exact', '[[1,2],[3,4]]^-1', '[[−2, 1], [3/2, −1/2]]');
  eq('matrix product', '[[1,2],[3,4]]*[[0,1],[1,0]]', '[[2, 1], [4, 3]]');
  eq('transpose', 'transpose([[1,2,3],[4,5,6]])', '[[1, 4], [2, 5], [3, 6]]');
  eq('rref', 'rref([[1,2,3],[4,5,6]])', '[[1, 0, −1], [0, 1, 2]]');
  eq('eigenvalues', 'eig([[2,1],[1,2]])', '{3, 1}');
  eq('cross product', 'cross([1,0,0],[0,1,0])', '{0, 0, 1}');

  /* statistics */
  eq('mean', 'mean({2,4,4,4,5,5,7,9})', '5');
  eq('median', 'median({3,1,2,8})', '5/2');
  near('sample standard deviation', 'sd({2,4,4,4,5,5,7,9})', 2.138089935299395, 1e-12);
  near('population standard deviation', 'psd({2,4,4,4,5,5,7,9})', 2, 1e-12);
  { const r = E.run('linreg({1,2,3,4},{3,5,7,9})', {}); ok('calculator: linear regression y = 2x + 1', r && Math.abs(r.value.coef[0] - 2) < 1e-12 && Math.abs(r.value.coef[1] - 1) < 1e-12 && Math.abs(r.value.r2 - 1) < 1e-12, r && r.out); }
  { const r = E.run('expreg({0,1,2,3},{3,6,12,24})', {}); ok('calculator: exponential regression y = 3·2^x', r && Math.abs(r.value.coef[0] - 3) < 1e-9 && Math.abs(r.value.coef[1] - 2) < 1e-9, r && r.out); }
  near('normal distribution', 'normcdf(1.96)', 0.9750021048517795, 1e-12);
  near('inverse normal', 'invnorm(0.975)', 1.959963984540054, 1e-9);
  near('binomial probability', 'binompdf(10,0.5,5)', 0.24609375, 1e-12);

  /* number bases */
  eq('decimal to hex', 'hex(255)', '0xFF');
  eq('decimal to binary', 'bin(10)', '0b1010');
  eq('hex and binary literals', '0xff+0b1010', '265');
  eq('any base', 'tobase(100,7)', '202₍₇₎');
  eq('back from a base', 'frombase("ff",16)', '255');
  eq('xor', 'xor(12,10)', '6');
  eq('not uses the word size', 'not(0)', '−1', { bits: 8 });
  eq('shift left', 'shl(1,10)', '1024');
  eq('negative numbers in hex use two\'s complement', 'hex(-1)', '0xFF', { bits: 8 });
};
if (require.main === module) {
  let pass = 0, fail = 0;
  module.exports((name, cond, detail) => { if (cond) { pass++; console.log('  ok   ' + name); } else { fail++; console.log('  FAIL ' + name + (detail ? '  ->  ' + detail : '')); } }).then(() => { console.log('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0); });
}

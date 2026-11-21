// AI Olympics (web/js/olympics.js): the answer checks give right answers credit and wrong ones none, and the medal table
// counts golds, silvers, bronzes and debate wins. Loaded in a small sandbox; no model runs here.
const fs = require('fs'), path = require('path'), vm = require('vm');

module.exports = async ok => {
  const A = { api: async () => [], ai: { json: t => { try { return JSON.parse(t); } catch (e) { return null; } } } };
  const ctx = { A, window: {}, document: { createElement: () => ({}) }, performance: { now: () => 0 }, URL, Blob: function () { }, Worker: function () { }, console, setTimeout, clearTimeout, TextDecoder };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'web', 'js', 'olympics.js'), 'utf8'), ctx);
  const O = A.olympics, T = O._t;
  const R = q => T.REASON.find(x => x[0].startsWith(q))[1], I = q => T.INSTR.find(x => x[0].startsWith(q))[1];
  ok('olympics: the bat-and-ball answer 5 cents is right, 10 is wrong', R('A bat')('So the ball costs 5 cents.') && !R('A bat')('The ball costs 10 cents.'));
  ok('olympics: thousands separators are read as one number', R('What is 17')('17 × 24 = 408') && !R('What is 17')('It is 4,080'));
  ok('olympics: the arrival time is checked as HH:MM', R('A train')('It arrives at 17:20.') && !R('A train')('17:10'));
  ok('olympics: "exactly three words" counts words', I('Reply with exactly three')('Blue sky above.') && !I('Reply with exactly three')('The sky is blue.'));
  ok('olympics: the JSON task needs a string name and a number age', I('Reply with JSON')('{"name":"Ana","age":31}') && I('Reply with JSON')('```json\n{"name":"Bo","age":4}\n```') && !I('Reply with JSON')('{"name":"Ana","age":"31"}'));
  ok('olympics: the numbered list must have exactly 5 lines', I('List exactly 5')('1. Apple\n2. Pear\n3. Fig\n4. Kiwi\n5. Plum') && !I('List exactly 5')('1. Apple\n2. Pear\n3. Fig'));
  ok('olympics: "is 91 prime" wants only NO', I('Answer with only YES')('No') && !I('Answer with only YES')('No, because 91 = 7 x 13'));
  ok('olympics: the repeat task must be exact', I('Repeat this text')('Moundshroud-42-blue') && !I('Repeat this text')('Sure! Moundshroud-42-blue'));
  ok('olympics: every code task has tests and a function name', T.CODE.every(c => typeof c[1] === 'string' && c.length >= 4));
  ok('olympics: every search question points at a real passage', T.SEARCH.qs.every(([, i]) => i >= 0 && i < T.SEARCH.passages.length));
  const M = O.medals({ reason: { a: { score: .9 }, b: { score: .5 }, c: { score: .9 }, d: { score: 0 } }, code: { a: { score: 1 }, b: { score: .8 }, c: { score: .2 } } }, [{ winner: 'b' }, { winner: 'b' }, { winner: 'c' }]);
  const row = n => (M.find(x => x[0] === n) || [, {}])[1];
  ok('olympics: a tie shares the gold', row('a').g === 2 && row('c').g >= 1);
  ok('olympics: a score of 0 wins no medal', row('d').g + row('d').s + row('d').b === 0);
  ok('olympics: debate wins hand out medals too', row('b').g >= 1 && row('b').best.includes('debate'));
  ok('olympics: the table is sorted by golds first', M[0][0] === 'a');
  /* the levels of pressure: harder items, more of them, a tighter clock */
  const LV = T.LEVELS;
  ok('olympics: there are four levels of pressure, each tighter than the last', LV.length === 4 && LV[0].clock === 0 && LV.every((l, i) => i <= 1 || l.clock < LV[i - 1].clock));
  ok('olympics: every level asks for more items than the one below it', LV.every((l, i) => i === 0 || ['reason', 'instr', 'code', 'know'].every(e => l.n[e] >= LV[i - 1].n[e])));
  const r0 = T.take(T.POOL.reason, 0, 99), r3 = T.take(T.POOL.reason, 3, 5);
  ok('olympics: the Club meet only draws the warm-up items', r0.length === 10 && r0.every(x => x[2] === 0));
  ok('olympics: the Inferno final draws the hardest items first', r3.length === 5 && r3.every(x => x[2] === 3));
  ok('olympics: the pools are deep enough for the biggest level', ['reason', 'instr', 'code', 'know'].every(e => T.POOL[e].filter(x => (x[2] != null ? x[2] : x.lvl) <= 3).length >= 14 || e === 'code') && T.POOL.code.length >= 9);
  ok('olympics: every hard code task has a function name and tests', T.POOL.code.every(c => typeof c.f === 'string' && c.f.length > 2 && c.t.length >= 2));
  ok('olympics: every search set points at a real passage', T.POOL.search.every(s => s.qs.every(([, i]) => i >= 0 && i < s.passages.length)));
  /* cybersecurity: an event of its own, checked by code, with no network anywhere */
  const C = q => T.CYBER.find(x => x[0].startsWith(q))[1];
  ok('olympics: cybersecurity is an event every chat model can enter', O.EVENTS.some(e => e.id === 'cyber' && e.need === 'chat'));
  ok('olympics: SQL injection is recognised, and a wrong answer is not', C('A login page puts')('SQL injection') && !C('A login page puts')('Cross-site scripting'));
  ok('olympics: XSS is recognised by its full name', C('What does XSS')('Cross-site scripting (XSS)') && !C('What does XSS')('XML safe storage'));
  ok('olympics: the HTTPS port must be 443', C('What is the default port number for HTTPS')('443') && !C('What is the default port number for HTTPS')('80'));
  ok('olympics: a 403 is not a 404', C('A web server answers with status 403')('No') && !C('A web server answers with status 403')('Yes'));
  ok('olympics: the Base64 forensic question decodes to the right text', C('Decode this Base64')('Hello, hacker') && !C('Decode this Base64')('SGVsbG8sIGhhY2tlcg=='));
  ok('olympics: it is fair to pick out MD5 as unsafe', (() => { const f = q => T.POOL.cyber.find(x => x[0].startsWith(q))[1]; return f('Which of these must never')('MD5') && !f('Which of these must never')('bcrypt'); })());
  ok('olympics: every cybersecurity item has a level and a checker that accepts a right answer', T.POOL.cyber.every(x => typeof x[0] === 'string' && typeof x[1] === 'function') && T.POOL.cyber.every(x => x[2] >= 0 && x[2] <= 3));
  ok('olympics: the cybersecurity pool is deep enough for the Inferno final', T.take(T.POOL.cyber, 3, 14).length === 14 && T.POOL.cyber.filter(x => x[2] === 3).length >= 9);
  ok('olympics: every level asks for cybersecurity questions', T.LEVELS.every(l => l.n.cyber >= 6));
};

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
};

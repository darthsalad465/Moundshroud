// Practice gym: a local model works through graded Python exercises. Each answer runs in a sealed sandbox (its own
// throwaway folder, no network, 10 second limit) against hidden tests. Answers that pass become training examples
// for the Model Lab, so you can fine-tune on them and run the gym again to see the score move.
const cp = require('child_process'), path = require('path'), fs = require('fs'), http = require('http'), crypto = require('crypto');
const ROOT = path.join(__dirname, '..'), RT = path.join(ROOT, 'runtime'), RUNS = path.join(ROOT, 'data', 'practice');
const SANDBOX = path.join(RT, 'practice-sandbox');
const pyExe = () => { const v = path.join(RT, 'ftenv', 'Scripts', 'python.exe'); return fs.existsSync(v) ? v : 'python'; };

/* [signature, what it should do, hidden tests] */
const P = [
  ['reverse_string(s)', 'returns the string reversed', "assert reverse_string('abc')=='cba'\nassert reverse_string('')==''"],
  ['is_palindrome(s)', 'returns True if s reads the same backwards, ignoring case and anything that is not a letter or digit', "assert is_palindrome('A man, a plan, a canal: Panama') is True\nassert is_palindrome('race a car') is False\nassert is_palindrome('') is True"],
  ['fizzbuzz(n)', "returns a list of strings for 1..n: 'Fizz' for multiples of 3, 'Buzz' for 5, 'FizzBuzz' for both, else the number", "assert fizzbuzz(5)==['1','2','Fizz','4','Buzz']\nassert fizzbuzz(15)[-1]=='FizzBuzz'"],
  ['factorial(n)', 'returns n factorial for n >= 0', 'assert factorial(0)==1\nassert factorial(5)==120'],
  ['fibonacci(n)', 'returns the nth Fibonacci number, with fibonacci(0)=0 and fibonacci(1)=1', 'assert fibonacci(0)==0\nassert fibonacci(1)==1\nassert fibonacci(10)==55'],
  ['gcd(a, b)', 'returns the greatest common divisor of two non-negative integers', 'assert gcd(12,18)==6\nassert gcd(7,5)==1\nassert gcd(0,9)==9'],
  ['is_prime(n)', 'returns True if n is a prime number', 'assert is_prime(2) and is_prime(13)\nassert not is_prime(1) and not is_prime(15) and not is_prime(0)'],
  ['count_vowels(s)', 'returns how many vowels (a, e, i, o, u, any case) are in s', "assert count_vowels('Hello World')==3\nassert count_vowels('xyz')==0"],
  ['flatten(lst)', 'flattens a list nested to any depth into one flat list', 'assert flatten([1,[2,[3,4]],5])==[1,2,3,4,5]\nassert flatten([])==[]'],
  ['two_sum(nums, target)', 'returns [i, j] with i < j where nums[i] + nums[j] == target (exactly one answer exists)', 'assert two_sum([2,7,11,15],9)==[0,1]\nassert two_sum([3,2,4],6)==[1,2]'],
  ['word_count(s)', 'returns a dict counting each lowercased word, splitting on whitespace', "assert word_count('the cat the')=={'the':2,'cat':1}\nassert word_count('')=={}"],
  ['max_subarray(nums)', 'returns the largest sum of any non-empty contiguous slice', 'assert max_subarray([-2,1,-3,4,-1,2,1,-5,4])==6\nassert max_subarray([-3,-1])==-1'],
  ['binary_search(arr, x)', 'returns the index of x in the sorted list arr, or -1 if absent', 'assert binary_search([1,3,5,7],5)==2\nassert binary_search([1,3,5,7],4)==-1\nassert binary_search([],1)==-1'],
  ['merge_sorted(a, b)', 'merges two sorted lists into one sorted list', 'assert merge_sorted([1,3,5],[2,4])==[1,2,3,4,5]\nassert merge_sorted([],[1])==[1]'],
  ['roman_to_int(s)', 'converts a Roman numeral string to an integer', "assert roman_to_int('III')==3\nassert roman_to_int('IX')==9\nassert roman_to_int('MCMXCIV')==1994"],
  ['int_to_roman(n)', 'converts an integer from 1 to 3999 to a Roman numeral string', "assert int_to_roman(4)=='IV'\nassert int_to_roman(58)=='LVIII'\nassert int_to_roman(1994)=='MCMXCIV'"],
  ['valid_parentheses(s)', 'returns True if every (, [ and { is closed in the right order', "assert valid_parentheses('()[]{}') is True\nassert valid_parentheses('(]') is False\nassert valid_parentheses('([{}])') is True\nassert valid_parentheses('(') is False"],
  ['rotate_list(lst, k)', 'returns the list rotated right by k places', 'assert rotate_list([1,2,3,4,5],2)==[4,5,1,2,3]\nassert rotate_list([1,2],0)==[1,2]\nassert rotate_list([],3)==[]'],
  ['unique_in_order(lst)', 'returns the items with duplicates removed, keeping the first occurrence order', 'assert unique_in_order([3,1,3,2,1])==[3,1,2]'],
  ['chunk(lst, n)', 'splits the list into pieces of length n (the last may be shorter)', 'assert chunk([1,2,3,4,5],2)==[[1,2],[3,4],[5]]\nassert chunk([],3)==[]'],
  ['caesar(s, k)', 'shifts each letter k places through the alphabet, keeping case and leaving other characters alone', "assert caesar('Abc xyz',1)=='Bcd yza'\nassert caesar('Hello!',0)=='Hello!'"],
  ['rle_encode(s)', "run-length encodes a string, e.g. 'aaabcc' becomes 'a3b1c2'", "assert rle_encode('aaabcc')=='a3b1c2'\nassert rle_encode('')==''"],
  ['transpose(m)', 'returns the transpose of a rectangular matrix given as a list of rows', 'assert transpose([[1,2,3],[4,5,6]])==[[1,4],[2,5],[3,6]]'],
  ['sum_digits(n)', 'returns the sum of the digits of the absolute value of n', 'assert sum_digits(1234)==10\nassert sum_digits(-56)==11\nassert sum_digits(0)==0'],
  ['second_largest(nums)', 'returns the second largest distinct value, or None if there is none', 'assert second_largest([4,1,4,3])==3\nassert second_largest([5]) is None\nassert second_largest([2,2]) is None'],
  ['longest_common_prefix(strs)', 'returns the longest prefix shared by all strings in the list', "assert longest_common_prefix(['flower','flow','flight'])=='fl'\nassert longest_common_prefix(['dog','car'])==''\nassert longest_common_prefix([])==''"],
  ['title_case(s)', 'capitalizes the first letter of each space-separated word and lowercases the rest', "assert title_case('hello WORLD')=='Hello World'"],
  ['is_anagram(a, b)', 'returns True if a and b use the same letters, ignoring case and spaces', "assert is_anagram('Listen','Silent') is True\nassert is_anagram('a gentleman','elegant man') is True\nassert is_anagram('ab','abc') is False"],
  ['count_primes(n)', 'returns how many prime numbers are less than n', 'assert count_primes(10)==4\nassert count_primes(0)==0\nassert count_primes(2)==0'],
  ['digital_root(n)', 'repeatedly sums the digits of a non-negative integer until one digit remains', 'assert digital_root(16)==7\nassert digital_root(942)==6\nassert digital_root(0)==0'],
  ['compress_spaces(s)', 'collapses every run of whitespace to one space and trims both ends', "assert compress_spaces('  a   b  ')=='a b'"],
  ['binary_to_int(s)', 'converts a string of 0s and 1s to its integer value', "assert binary_to_int('101')==5\nassert binary_to_int('0')==0"],
  ['is_leap_year(y)', 'returns True if y is a Gregorian leap year', 'assert is_leap_year(2000) and is_leap_year(2024)\nassert not is_leap_year(1900) and not is_leap_year(2023)'],
  ['pascal_row(n)', "returns row n (counting from 0) of Pascal's triangle", 'assert pascal_row(0)==[1]\nassert pascal_row(4)==[1,4,6,4,1]'],
  ['missing_number(nums)', 'given the numbers 0..n with exactly one missing, returns the missing one', 'assert missing_number([3,0,1])==2\nassert missing_number([0,1])==2'],
  ['mode(nums)', 'returns the most frequent value; on a tie, the smallest of them', 'assert mode([1,2,2,3,3])==2\nassert mode([5])==5'],
  ['snake_to_camel(s)', "converts snake_case to camelCase, e.g. 'hello_world' becomes 'helloWorld'", "assert snake_to_camel('hello_world_x')=='helloWorldX'\nassert snake_to_camel('abc')=='abc'"],
  ['running_sum(nums)', 'returns the running totals of the list', 'assert running_sum([1,2,3])==[1,3,6]\nassert running_sum([])==[]'],
  ['dedupe_chars(s)', 'removes repeated characters, keeping the first occurrence of each', "assert dedupe_chars('banana')=='ban'"],
  ['diagonal_sum(m)', 'returns the sum of the main diagonal of a square matrix', 'assert diagonal_sum([[1,2],[3,4]])==5\nassert diagonal_sum([[7]])==7'],
].map(([sig, desc, tests], i) => ({ id: 'p' + (i + 1), sig, name: sig.split('(')[0], desc, tests }));
const promptOf = p => 'Write a Python function `' + p.sig + '` that ' + p.desc + '. Use only the Python standard library. Reply with only the code, in one ```python block.';

let st = { running: false, model: '', total: 0, done: 0, passed: 0, tries: 0, recent: [], runId: '', started: 0, error: '' }, stopFlag = false, examples = [];

function ask(model, prompt) {
  return new Promise(res => {
    const body = JSON.stringify({ model, stream: false, think: false, options: { temperature: 0.7, num_predict: 900 }, messages: [{ role: 'system', content: 'You are a careful Python programmer. Answer with code only.' }, { role: 'user', content: prompt }] });
    const req = http.request({ host: '127.0.0.1', port: 11434, path: '/api/chat', method: 'POST', headers: { 'Content-Type': 'application/json' }, timeout: 180000 }, r => { let b = ''; r.on('data', d => b += d); r.on('end', () => { try { res(JSON.parse(b).message.content || ''); } catch (e) { res(''); } }); });
    req.on('error', () => res('')); req.on('timeout', () => { req.destroy(); res(''); }); req.end(body);
  });
}
const codeOf = t => { const m = /```(?:python|py)?\s*\n([\s\S]*?)```/i.exec(t || ''); return (m ? m[1] : (t || '')).trim(); };

/* run one answer against the hidden tests in a throwaway folder: network calls are blocked, 10 s limit, stdin closed */
function grade(code, tests) {
  return new Promise(res => {
    const dir = path.join(SANDBOX, crypto.randomBytes(6).toString('hex')); fs.mkdirSync(dir, { recursive: true });
    const nonce = crypto.randomBytes(8).toString('hex');
    fs.writeFileSync(path.join(dir, 'sol.py'), code);
    fs.writeFileSync(path.join(dir, 'run.py'), [
      'import socket',
      'def _blocked(*a, **k): raise OSError("network is disabled in the practice sandbox")',
      'socket.socket = _blocked; socket.create_connection = _blocked; socket.getaddrinfo = _blocked',
      'ns = {"__name__": "solution"}',
      'exec(compile(open("sol.py", encoding="utf-8").read(), "sol.py", "exec"), ns)',
      'exec(compile(' + JSON.stringify(tests) + ', "tests", "exec"), ns)',
      'print("' + nonce + '")'].join('\n'));
    let out = '', done = false;
    const p = cp.spawn(pyExe(), ['-I', 'run.py'], { cwd: dir, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], env: { SYSTEMROOT: process.env.SYSTEMROOT || 'C:\\Windows', TEMP: dir, TMP: dir } });
    const finish = ok => { if (done) return; done = true; clearTimeout(t); try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) { } res(ok); };
    const t = setTimeout(() => { try { cp.spawnSync('taskkill', ['/PID', String(p.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true }); } catch (e) { } finish(false); }, 10000);
    p.stdout.on('data', d => { out += d; if (out.length > 1e5) out = out.slice(-1e5); });
    p.on('error', () => finish(false));
    p.on('exit', code => finish(code === 0 && out.includes(nonce)));
  });
}

async function loop(cfg) {
  const list = P.slice(0, Math.max(1, Math.min(P.length, +cfg.limit || P.length))), tries = Math.max(1, Math.min(4, +cfg.attempts || 2));
  for (const p of list) {
    if (stopFlag) break;
    let ok = false, ans = '', t0 = Date.now(), n = 0;
    for (; n < tries && !ok && !stopFlag; n++) {
      const reply = await ask(cfg.model, promptOf(p)); const code = codeOf(reply); st.tries++;
      if (code && await grade(code, p.tests)) { ok = true; ans = '```python\n' + code + '\n```'; }
    }
    st.done++; if (ok) { st.passed++; examples.push({ u: promptOf(p), a: ans }); }
    st.recent.unshift({ name: p.name, ok, tries: n, s: Math.round((Date.now() - t0) / 1000) }); st.recent = st.recent.slice(0, 12);
  }
  fs.mkdirSync(RUNS, { recursive: true });
  fs.writeFileSync(path.join(RUNS, st.runId + '.json'), JSON.stringify({ id: st.runId, model: st.model, total: st.done, passed: st.passed, attempts: tries, stopped: stopFlag, when: new Date().toISOString(), examples }, null, 1));
  st.running = false;
}
function start(cfg) {
  if (st.running) return { ok: false, error: 'A practice run is already going.' };
  if (!cfg || !cfg.model) return { ok: false, error: 'Pick a model to practise.' };
  stopFlag = false; examples = [];
  st = { running: true, model: String(cfg.model), total: Math.min(P.length, +cfg.limit || P.length), done: 0, passed: 0, tries: 0, recent: [], runId: 'run' + Date.now().toString(36), started: Date.now(), error: '' };
  loop(cfg).catch(e => { st.error = String(e && e.message || e); st.running = false; });
  return { ok: true, runId: st.runId };
}
function stop() { stopFlag = true; return { ok: true }; }
function status() { return st; }
function runs() {
  try { return fs.readdirSync(RUNS).filter(f => f.endsWith('.json')).map(f => { try { const j = JSON.parse(fs.readFileSync(path.join(RUNS, f), 'utf8')); return { id: j.id, model: j.model, total: j.total, passed: j.passed, attempts: j.attempts, when: j.when, examples: (j.examples || []).length }; } catch (e) { return null; } }).filter(Boolean).sort((a, b) => (b.when || '').localeCompare(a.when || '')); } catch (e) { return []; }
}
function runExamples(id) { try { return JSON.parse(fs.readFileSync(path.join(RUNS, String(id).replace(/[^a-z0-9]/gi, '') + '.json'), 'utf8')).examples || []; } catch (e) { return []; } }
module.exports = { start, stop, status, runs, runExamples, grade, count: P.length, _P: P };

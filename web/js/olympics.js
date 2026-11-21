// AI Olympics (Chat › 🏅 Olympics): every model on this PC competes in the events it can do, and wins medals.
//   Auto-scored events (right answers checked by code): Reasoning, Instructions, Code (run against tests in a sandboxed
//   worker), Knowledge, Cybersecurity (attacks, logs, crypto and forensics, all answered offline), Speed, Vision (pictures
//   drawn here, for models that can see), Search (embeddings, for every model that can make them). Writing is scored by a
//   judge model. Debate medals come from the Debate page.
//   The Build-off: each model builds a single-page web toy for a challenge you pick; you rank the entries blind, then the
//   makers are revealed. The Picture duel: the two picture models draw the same prompts; you pick blind.
// Results are kept on this PC (/api/kv?name=olympics). Runs keep going if you switch to another page (A.keep / kept panes).
(() => {
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const bare = m => String(m || '').replace(/:latest$/, '');
  const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const MEDAL = ['🥇', '🥈', '🥉'];

  /* ---------- talking to one model, timed ---------- */
  /* a model that fails to load (the graphics card is still holding another model) gets one more try after the others are let go */
  const LOADFAIL = /out of memory|out-of-memory|llama-server|terminated|unexpectedly|model runner|EOF/i;
  async function ask(model, messages, o) {
    try { return await ask1(model, messages, o); }
    catch (e) {
      if ((o && o.signal && o.signal.aborted) || !LOADFAIL.test(String(e.message || e))) throw e;
      try { await fetch('/api/unload', { method: 'POST', body: '{}' }); } catch (x) { }
      await new Promise(r => setTimeout(r, 3000));
      return ask1(model, messages, o);
    }
  }
  async function ask1(model, messages, o) {
    o = o || {}; const t0 = performance.now(); let text = '', first = 0, stats = null;
    const r = await fetch('/api/chat', { method: 'POST', signal: o.signal, body: JSON.stringify({ model, stream: true, think: false, keep_alive: '2m', options: { temperature: o.temp == null ? 0 : o.temp, num_predict: o.max || 400 }, messages }) });
    if (!r.ok || !r.body) { let m = 'The model did not answer.'; try { m = (await r.json()).error || m; } catch (e) { } throw new Error(m); }
    const rd = r.body.getReader(), dec = new TextDecoder(); let buf = '';
    for (; ;) {
      const { value, done } = await rd.read(); if (done) break; buf += dec.decode(value, { stream: true }); let i;
      while ((i = buf.indexOf('\n')) >= 0) { const ln = buf.slice(0, i).trim(); buf = buf.slice(i + 1); if (!ln) continue; let j; try { j = JSON.parse(ln); } catch (e) { continue; } if (j.error) throw new Error(j.error); if (j.message && j.message.content) { if (!first) first = performance.now(); text += j.message.content; if (o.onText) o.onText(text); } if (j.done) stats = j; }
    }
    const ms = performance.now() - t0, tokens = stats && stats.eval_count ? stats.eval_count : Math.max(1, Math.round(text.length / 4));
    const tps = stats && stats.eval_duration ? tokens / (stats.eval_duration / 1e9) : tokens / Math.max(.2, (performance.now() - (first || t0)) / 1000);
    return { text: text.replace(/<think>[\s\S]*?<\/think>/g, '').trim(), ms, ttft: first ? first - t0 : ms, tokens, tps };
  }
  const lastNum = t => { const m = String(t).replace(/,(?=\d{3})/g, '').match(/-?\d+(?:\.\d+)?/g); return m ? +m[m.length - 1] : NaN; };
  const has = (t, re) => re.test(String(t).toLowerCase());

  /* ---------- the events ---------- */
  const REASON = [
    ['A bat and a ball cost $1.10 in total. The bat costs $1.00 more than the ball. How many cents does the ball cost?', t => lastNum(t) === 5],
    ['If 5 machines make 5 widgets in 5 minutes, how many minutes do 100 machines need to make 100 widgets?', t => lastNum(t) === 5],
    ['What is 17 multiplied by 24?', t => lastNum(t) === 408],
    ['Sally has 3 brothers. Each of her brothers has 2 sisters. How many sisters does Sally have?', t => lastNum(t) === 1 || has(t, /\bone\b/)],
    ['What is the next number in the series 2, 6, 12, 20, 30, ...?', t => lastNum(t) === 42],
    ['How many prime numbers are there between 10 and 30?', t => lastNum(t) === 6],
    ['A train leaves at 14:45 and the trip takes 2 hours 35 minutes. At what time does it arrive? Answer as HH:MM.', t => /17[:.]20/.test(t)],
    ['What is 15% of 260?', t => lastNum(t) === 39],
    ['A clock shows 3:15. What is the angle between the hour hand and the minute hand, in degrees?', t => Math.abs(lastNum(t) - 7.5) < .01],
    ['Rearrange the letters of LISTEN into a word that means quiet. What is the word?', t => has(t, /silent/)],
  ];
  const INSTR = [
    ['Reply with exactly three words and nothing else.', t => t.replace(/[^\p{L}\p{N}\s'-]/gu, ' ').trim().split(/\s+/).filter(Boolean).length === 3],
    ['Reply with JSON only: an object with a key "name" (a string) and a key "age" (a number) for a made-up person.', t => { try { const j = JSON.parse(t.replace(/^```(?:json)?|```$/g, '').trim()); return typeof j.name === 'string' && typeof j.age === 'number'; } catch (e) { return false; } }],
    ['Write one sentence about the sea, all in lowercase letters, with no commas.', t => t.length > 15 && t === t.toLowerCase() && !t.includes(',')],
    ['List exactly 5 fruits as a numbered list (1. to 5.), one per line, and nothing else.', t => { const l = t.split('\n').map(x => x.trim()).filter(Boolean); return l.length === 5 && l.every((x, i) => x.startsWith((i + 1) + '.')); }],
    ['Write a short sentence about cats that ends with the word DONE.', t => /DONE[.!]?$/.test(t.trim())],
    ['Answer with only YES or NO: is 91 a prime number?', t => /^\W*no\W*$/i.test(t.trim())],
    ['Write a haiku about rain in exactly 3 lines, with no title.', t => t.split('\n').map(x => x.trim()).filter(Boolean).length === 3],
    ['Repeat this text exactly and add nothing: Moundshroud-42-blue', t => t.trim().replace(/^["'`]|["'`.]$/g, '') === 'Moundshroud-42-blue'],
  ];
  const CODE = [
    ['isPalindrome(s): true if the string reads the same backwards, ignoring case and anything that is not a letter or digit.', 'isPalindrome', [['A man, a plan, a canal: Panama'], true], [['hello'], false], [['No lemon, no melon'], true], [[''], true]],
    ['fizz(n): an array for 1..n where multiples of 3 are "Fizz", of 5 are "Buzz", of both are "FizzBuzz", and the rest are the numbers.', 'fizz', [[5], [1, 2, 'Fizz', 4, 'Buzz']], [[15], [1, 2, 'Fizz', 4, 'Buzz', 'Fizz', 7, 8, 'Fizz', 'Buzz', 11, 'Fizz', 13, 14, 'FizzBuzz']]],
    ['sumDigits(n): the sum of the digits of a non-negative whole number.', 'sumDigits', [[0], 0], [[1234], 10], [[909], 18]],
    ['uniqueSorted(arr): the distinct numbers of the array, sorted from smallest to largest.', 'uniqueSorted', [[[3, 1, 3, 2, 1]], [1, 2, 3]], [[[10, -2, 10, 5]], [-2, 5, 10]], [[[]], []]],
    ['fib(n): the n-th Fibonacci number, with fib(0) = 0 and fib(1) = 1.', 'fib', [[0], 0], [[1], 1], [[10], 55], [[20], 6765]],
    ['wordCount(s): an object counting each word, lower-cased, words being runs of letters.', 'wordCount', [['The cat and the hat'], { the: 2, cat: 1, and: 1, hat: 1 }], [['Hi hi HI'], { hi: 3 }]],
  ];
  const KNOW = [
    ['What is the capital city of Australia?', /canberra/], ['What is the chemical symbol for gold?', /\bau\b/], ['Who wrote the novel 1984?', /orwell/],
    ['What is the largest planet in our solar system?', /jupiter/], ['In which year did World War II end?', /1945/], ['How many bones are in an adult human body?', /206/],
    ['Who painted the Mona Lisa?', /leonardo|da vinci/], ['What is the boiling point of water at sea level in degrees Fahrenheit?', /212/], ['What is the smallest prime number?', /\b2\b|two/], ['Which gas do plants take in from the air for photosynthesis?', /carbon dioxide|co2/],
  ];
  /* ---------- cybersecurity: every question is answered here, by the model alone, with no network ---------- */
  const CYBER = [
    ['A login page puts the typed username straight into its SQL query. Which attack does that allow? Answer in two words.', t => has(t, /sql injection|sqli/), 0],
    ['What does XSS stand for? Give the full name.', t => has(t, /cross[- ]site scripting/), 0],
    ['Passwords are stored with MD5. Name the kind of algorithm they should be hashed with instead. One word is enough.', t => has(t, /bcrypt|argon|scrypt|pbkdf/), 0],
    ['What is the default port number for HTTPS? Answer with the number only.', t => lastNum(t) === 443, 0],
    ['A web server answers with status 403. Does that mean the page was not found? Answer YES or NO only.', t => /^\W*no\W*$/i.test(t.trim()), 0],
    ['Users are allowed to type text that is printed into the page without being escaped. Which attack is that? Answer in two words.', t => has(t, /cross[- ]site scripting|xss/), 0],
    ['For passwords, which is safer: storing a hash or storing the password itself? Answer with one word.', t => has(t, /hash/), 0],
    ['A log shows "Failed password for root" five thousand times in one minute from one address. Name the attack in two words.', t => has(t, /brute[- ]?force|password spray|credential stuff/), 0],
    ['A web request asks for ../../etc/passwd. Name the attack in two words.', t => has(t, /traversal/), 0],
    ['Which protocol does HTTPS use to encrypt the traffic? Give its short name only.', t => has(t, /\btls\b|\bssl\b/), 0],
    ['Decode this Base64 and give the plain text only: SGVsbG8sIGhhY2tlcg==', t => has(t, /hello,? hacker/), 0],
  ];
  const SEARCH = {
    passages: ['The Eiffel Tower was finished in 1889 for the World\'s Fair in Paris.', 'Penguins live mostly in the Southern Hemisphere and cannot fly.', 'Photosynthesis turns sunlight, water and carbon dioxide into sugar and oxygen.', 'The Great Wall of China is thousands of kilometres long.', 'A violin has four strings tuned in fifths.', 'Mount Everest is the highest mountain above sea level.', 'Honey never spoils if it is sealed and kept dry.', 'The human heart beats about 100,000 times a day.', 'Chess is played on a board of 64 squares.', 'Bananas are berries, but strawberries are not.', 'The Pacific is the largest and deepest ocean.', 'Lightning is hotter than the surface of the sun.'],
    qs: [['When was the Paris landmark completed?', 0], ['Which birds are unable to fly and live in the south?', 1], ['How do plants make food from light?', 2], ['What is the tallest peak on Earth?', 5], ['Which food lasts almost forever?', 6], ['How many times does our heart pump each day?', 7], ['How many squares does a chess board have?', 8], ['Which ocean is biggest?', 10]],
  };
  const WRITE = 'Write a story of about 120 words about a lighthouse keeper who finds a message in a bottle. Make the ending surprising.';
  const SPEED = 'Write the numbers from 1 to 40, separated by spaces, and nothing else.';
  const EVENTS = [
    { id: 'reason', icon: '🧠', name: 'Reasoning', desc: 'Logic and maths with one right answer', need: 'chat' },
    { id: 'instr', icon: '📋', name: 'Instructions', desc: 'Doing exactly what was asked (format, length, words)', need: 'chat' },
    { id: 'code', icon: '💻', name: 'Code', desc: 'JavaScript functions, run against tests in a sandbox', need: 'chat' },
    { id: 'know', icon: '📚', name: 'Knowledge', desc: 'General facts', need: 'chat' },
    { id: 'cyber', icon: '🛡️', name: 'Cybersecurity', desc: 'Spotting attacks, reading logs, crypto and forensics — all offline', need: 'chat' },
    { id: 'speed', icon: '⚡', name: 'Speed', desc: 'Words per second on this PC', need: 'chat' },
    { id: 'vision', icon: '👁', name: 'Vision', desc: 'Counting, reading and colours in pictures (models that can see)', need: 'vision' },
    { id: 'search', icon: '🔎', name: 'Search', desc: 'Finding the right passage for a question (embeddings)', need: 'embed' },
    { id: 'write', icon: '✍️', name: 'Writing', desc: 'A short story, scored by the judge model', need: 'chat' },
  ];

  /* ---------- the levels of pressure ----------
     The Games are not one fixed test. Pick the level that suits the models you are putting in: a 2B model at Club meet is a fair
     fight, the same model at the Inferno final is meant to be torn apart. Each level brings harder items, more of them, a
     tighter clock on every answer (0 = untimed) and a smaller answer budget, so waffle costs points. */
  const LEVELS = [
    { id: 'club', icon: '🎽', name: 'Club meet', pitch: 0, clock: 0, max: 1, n: { reason: 5, instr: 5, code: 3, know: 6, vision: 3, cyber: 6 },
      blurb: 'The short friendly set, untimed. Right for 2–4B models and a quick run.' },
    { id: 'national', icon: '🏟️', name: 'National trials', pitch: 1, clock: 90, max: .85, n: { reason: 8, instr: 8, code: 5, know: 9, vision: 3, cyber: 8 },
      blurb: 'Harder items, more of them and a 90-second clock. The fair setting for 7–9B models.' },
    { id: 'world', icon: '🌍', name: 'World championships', pitch: 2, clock: 45, max: .65, n: { reason: 12, instr: 12, code: 7, know: 12, vision: 4, cyber: 11 },
      blurb: 'Traps, strict formats, edge-case code, 45 seconds a question. For a strong 9–14B.' },
    { id: 'inferno', icon: '🔥', name: 'Inferno final', pitch: 3, clock: 22, max: .5, n: { reason: 14, instr: 14, code: 9, know: 14, vision: 4, cyber: 14 },
      blurb: 'Everything at its hardest, 22 seconds a question, no room for waffle. Only the biggest models should survive.' },
  ];
  const lvlOf = id => LEVELS.find(l => l.id === id) || LEVELS[0];

  /* ---------- the harder items, one list per level above the warm-up ---------- */
  const HARD = {
    reason: [
      /* 1 — national */
      ['A shop sells pens at 3 for $2. How many pens can you buy with $14?', t => lastNum(t) === 21, 1],
      ['If today is Wednesday, what day of the week is it 100 days from now? Answer with the day only.', t => has(t, /friday/), 1],
      ['What is the sum of every whole number from 1 to 100?', t => lastNum(t) === 5050, 1],
      ['One pipe fills a tank in 6 hours, another in 4. With both open, how many hours does it take? Answer to one decimal place.', t => Math.abs(lastNum(t) - 2.4) < .05, 1],
      ['How many times does the digit 7 appear when every number from 1 to 100 is written out?', t => lastNum(t) === 20, 1],
      ['If 3 cats catch 3 mice in 3 minutes, how many cats catch 100 mice in 100 minutes?', t => lastNum(t) === 3, 1],
      ['What is 12.5% of 480?', t => lastNum(t) === 60, 1],
      ['A jacket costs $80 after a 20% discount. What was the price before the discount, in dollars?', t => lastNum(t) === 100, 1],
      /* 2 — world */
      ['A cube is painted on all six outside faces and then cut into 27 equal smaller cubes. How many of the small cubes have exactly two painted faces?', t => lastNum(t) === 12, 2],
      ['In a class of 30, 18 like tea, 20 like coffee and 5 like neither. How many like both?', t => lastNum(t) === 13, 2],
      ['What comes next: 1, 11, 21, 1211, 111221, ...?', t => lastNum(t) === 312211, 2],
      ['What is the remainder when 3^100 is divided by 7?', t => lastNum(t) === 4, 2],
      ['At a party every person shakes hands with every other person once, and there are 66 handshakes in all. How many people are there?', t => lastNum(t) === 12, 2],
      ['How many whole numbers from 1 to 999 contain the digit 0?', t => lastNum(t) === 180, 2],
      ['A clock is set correctly at 8:00 but it runs 6 minutes fast. What time does it show when the real time is 9:00? Answer as HH:MM.', t => /9[:.]06/.test(t), 2],
      ['A rope 40 m long is cut so that one piece is 3 times the other. How long is the shorter piece, in metres?', t => lastNum(t) === 10, 2],
      /* 3 — inferno */
      ['A train covers 120 km at 80 km/h and then 90 km at 60 km/h. What is its average speed for the whole trip, in km/h, to one decimal place?', t => Math.abs(lastNum(t) - 70) < .06, 3],
      ['Three friends split a bill of $87 in the ratio 2:3:4. How much does the largest share pay, in dollars, to the nearest cent?', t => Math.abs(lastNum(t) - 38.67) < .02, 3],
      ['In three fair coin tosses, what is the probability of exactly two heads? Answer as a fraction such as 3/8.', t => /\b3\s*\/\s*8\b/.test(t), 3],
      ['A ladder 13 m long stands with its foot 5 m from a wall. How high up the wall does the top reach, in metres?', t => lastNum(t) === 12, 3],
      ['Seven people sit around a round table. How many different arrangements are there if turning the whole table counts as the same arrangement?', t => lastNum(t) === 720, 3],
      ['A number is increased by 25% and the result is then decreased by 20%. By what percentage has it changed from where it started? Answer with the number only.', t => Math.abs(lastNum(t)) < .01, 3],
      ['How many prime numbers lie strictly between 100 and 130?', t => lastNum(t) === 6, 3],
      ['A bag holds 4 red and 6 blue balls. Two are drawn without putting any back. What is the probability that both are red? Answer as a fraction.', t => /\b2\s*\/\s*15\b/.test(t), 3],
      ['At 4:40, what is the smaller angle between the hour and minute hands, in degrees?', t => Math.abs(lastNum(t) - 100) < .05, 3],
      ['If x + y = 10 and x × y = 21, what is x² + y²?', t => lastNum(t) === 58, 3],
    ],
    instr: [
      /* 1 */
      ['Write exactly two sentences about winter, and use no exclamation marks.', t => { const s = t.trim(), m = s.match(/[.!?]/g) || []; return m.length === 2 && !s.includes('!') && s.length > 25; }, 1],
      ['Reply with the three colours of the Italian flag in order, separated by commas, and nothing else.', t => /^\s*green\s*,\s*white\s*,\s*red\s*[.!]?\s*$/i.test(t.trim()), 1],
      ['Answer with one word only: the opposite of "ancient".', t => /^\W*modern\W*$/i.test(t.trim()), 1],
      ['List the numbers 1 to 10 in reverse order, one per line, and nothing else.', t => t.split('\n').map(x => x.trim()).filter(Boolean).join(',') === '10,9,8,7,6,5,4,3,2,1', 1],
      ['Say the word HELLO followed by its five letters separated by hyphens, all on one line, nothing else.', t => /^\W*HELLO\W*H-E-L-L-O\W*$/i.test(t.trim()), 1],
      /* 2 */
      ['Reply with exactly 4 lines: ONE, TWO, THREE, FOUR in capitals, one per line, and nothing else.', t => t.split('\n').map(x => x.trim()).filter(Boolean).join('|') === 'ONE|TWO|THREE|FOUR', 2],
      ['Write one sentence of exactly 10 words about rivers.', t => { const w = t.replace(/[^\p{L}\p{N}\s'-]/gu, ' ').trim().split(/\s+/).filter(Boolean); return w.length === 10 && /[.!?]\s*$/.test(t.trim()); }, 2],
      ['Reply with JSON only and no other keys: {"sum": <the sum of 5 and 7>}.', t => { try { const j = JSON.parse(t.replace(/^```(?:json)?|```$/g, '').trim()); return Object.keys(j).length === 1 && j.sum === 12; } catch (e) { return false; } }, 2],
      ['Write the word banana exactly 5 times, separated by single spaces, and nothing else.', t => /^\s*(banana\s+){4}banana\s*[.!]?\s*$/i.test(t.trim()), 2],
      ['List exactly 3 bullet lines; each starts with "- " and has exactly 4 words after it.', t => { const l = t.split('\n').map(x => x.trim()).filter(Boolean); return l.length === 3 && l.every(x => /^-\s+\S+(\s+\S+){3}$/.test(x)); }, 2],
      ['Answer with the number 7 written as a word in capitals, then a full stop, and nothing else.', t => /^\W*SEVEN\.?\W*$/i.test(t.trim().toUpperCase()), 2],
      /* 3 */
      ['Write one sentence about the sea that contains no letter "e" at all.', t => { const s = t.trim(); return s.length > 20 && !/e/i.test(s) && /[.!?]$/.test(s); }, 3],
      ['Reply with the value of 2^10 in binary: bits only, no spaces and no explanation.', t => /^\D*1(0){10}\D*$/.test(t.trim()), 3],
      ['Reply with one JSON object with only the keys "a" and "b", whose values are the first two primes above 100 in ascending order.', t => { try { const j = JSON.parse(t.replace(/^```(?:json)?|```$/g, '').trim()); return Object.keys(j).sort().join() === 'a,b' && j.a === 101 && j.b === 103; } catch (e) { return false; } }, 3],
      ['Write the letters of the alphabet backwards on one line, separated by single spaces, and nothing else.', t => t.trim().toLowerCase().replace(/[^a-z\s]/g, '').replace(/\s+/g, ' ').trim() === 'z y x w v u t s r q p o n m l k j i h g f e d c b a', 3],
      ['Reply with exactly one sentence of at most 12 words that contains the word MOUNDSHROUD in capitals.', t => { const w = t.replace(/[^\p{L}\p{N}\s'-]/gu, ' ').trim().split(/\s+/).filter(Boolean); return w.length <= 12 && t.includes('MOUNDSHROUD') && (t.match(/[.!?]/g) || []).length === 1; }, 3],
      ['Answer with a single word: the number 17 in Roman numerals.', t => /^\W*xvii\W*$/i.test(t.trim()), 3],
      ['Reply with exactly two lines. The first is the word LEFT, the second is the number of letters in MOUNDSHROUD. Nothing else.', t => t.split('\n').map(x => x.trim()).filter(Boolean).join('|').toUpperCase() === 'LEFT|10', 3],
    ],
    know: [
      ['How many strings does a violin have?', /\b4\b|four/, 1], ['What is the capital city of Canada?', /ottawa/, 1],
      ['Which planet is closest to the Sun?', /mercury/, 1], ['What is the chemical formula of water?', /h2o/, 1],
      ['In which year did the Berlin Wall fall?', /\b1989\b/, 2], ['What is the atomic number of tungsten?', /\b74\b/, 2],
      ['Who wrote "On the Origin of Species"?', /darwin/, 2], ['Which country has the most time zones?', /france/, 2],
      ['What is the tallest building in the world as of 2024?', /burj|khalifa/, 2],
      ['Which element has the chemical symbol W?', /tungsten|wolfram/, 2],
      ['In which year was the Peace of Westphalia signed?', /\b1648\b/, 3], ['What is the smallest country in the world by area?', /vatican/, 3],
      ['How many keys does a standard modern piano have?', /\b88\b/, 3], ['Which is the longest river in Asia?', /yangtze|chang jiang/, 3],
      ['In which year was the first email sent on ARPANET?', /\b1971\b/, 3], ['What is the SI unit of pressure?', /pascal/, 3],
      ['Which sea has no land coastline?', /sargasso/, 3], ['What is the hardest natural substance on Earth?', /diamond/, 3],
      ['How many chambers does the human heart have?', /\b4\b|four/, 3], ['What is the longest bone in the human body?', /femur/, 3],
    ],
    code: [
      { lvl: 1, d: 'sumRange(a, b): the sum of every whole number from a to b inclusive.', f: 'sumRange', t: [[[1, 10], 55], [[-3, 3], 0], [[5, 5], 5]] },
      { lvl: 1, d: 'titleCase(s): the same words with the first letter of each word capitalised and the rest lower case.', f: 'titleCase', t: [[['hello world'], 'Hello World'], [['a tale of two cities'], 'A Tale Of Two Cities']] },
      { lvl: 2, d: 'chunk(arr, n): the array split into arrays of length n, the last one shorter if needed.', f: 'chunk', t: [[[[1, 2, 3, 4, 5], 2], [[1, 2], [3, 4], [5]]], [[[], 3], []]] },
      { lvl: 2, d: 'roman(n): the Roman numeral for a whole number from 1 to 3999, in capitals.', f: 'roman', t: [[[4], 'IV'], [[1994], 'MCMXCIV'], [[3999], 'MMMCMXCIX']] },
      { lvl: 2, d: 'rle(s): run-length encode a string, so "aaab" becomes "3a1b".', f: 'rle', t: [[['aaab'], '3a1b'], [['abc'], '1a1b1c'], [[''], '']] },
      { lvl: 2, d: 'flatten(a): a new array with every nested array flattened at any depth.', f: 'flatten', t: [[[[1, [2, [3, 4]], 5]], [1, 2, 3, 4, 5]], [[[[]]], []]] },
      { lvl: 3, d: 'balanced(s): true when every bracket in the string is closed in the right order, ignoring other characters.', f: 'balanced', t: [[['({[]})'], true], [['(]'], false], [[''], true], [['([)]'], false]] },
      { lvl: 3, d: 'isIsogram(s): true when no letter appears twice, ignoring case and anything that is not a letter.', f: 'isIsogram', t: [[['lumberjacks'], true], [['hello'], false], [[''], true]] },
      { lvl: 3, d: 'binarySearch(arr, x): the index of the first occurrence of x in an ascending sorted array, or -1.', f: 'binarySearch', t: [[[[1, 2, 2, 3], 2], 1], [[[1, 3, 5], 4], -1], [[[5], 5], 0]] },
      { lvl: 3, d: 'countPrimes(n): how many prime numbers are strictly below n. It must finish quickly for n = 100000.', f: 'countPrimes', t: [[[100000], 9592], [[10], 4]] },
      { lvl: 3, d: 'maxGap(nums): the largest difference between two neighbours once the numbers are sorted.', f: 'maxGap', t: [[[[1, 4, 9, 10]], 5], [[[1, 2]], 1]] },
    ],
    search: [
      { lvl: 1, passages: ['The Nile is about 6,650 km long and flows north into the Mediterranean.', 'The Amazon carries more water than any other river and is about 6,400 km long.', 'The Volga is the longest river in Europe, at about 3,530 km.', 'Lake Baikal holds about a fifth of the world\'s unfrozen fresh water.', 'The Danube flows through ten countries, more than any other river.', 'Mount Kilimanjaro is the highest mountain in Africa, at 5,895 m.'],
        qs: [['Which river is the longest in Europe?', 2], ['Which river flows through the most countries?', 4], ['Which lake holds the most fresh water?', 3], ['Which is the highest mountain in Africa?', 5]] },
      { lvl: 2, passages: ['The Golden Gate Bridge has a main span of 1,280 m.', 'The Akashi Kaikyo Bridge has a main span of 1,991 m.', 'The Humber Bridge has a main span of 1,410 m.', 'The Millau Viaduct is 2,460 m long and 343 m high.', 'The Burj Khalifa is 828 m tall.', 'The Shanghai Tower is 632 m tall.'],
        qs: [['Which bridge has the longest main span?', 1], ['Which structure is 343 m high?', 3], ['Which bridge has a main span of exactly 1,410 m?', 2], ['Which tower is 632 m tall?', 5]] },
      { lvl: 3, passages: ['The Peace of Westphalia was signed in 1648 and ended the Thirty Years\' War.', 'The armistice of 1918 stopped the fighting of the First World War, but the peace treaty came in 1919.', 'The Berlin Wall was opened in November 1989 and demolished over the following years.', 'The first email was sent in 1971 on ARPANET, though the word "email" came later.', 'The first web page went online in August 1991 at CERN.'],
        qs: [['Which year ended the Thirty Years\' War?', 0], ['When did the fighting of the First World War stop, before the peace treaty?', 1], ['When did the Berlin Wall open?', 2], ['What was sent in 1971 on ARPANET?', 3], ['In which year did the first web page go online?', 4]] },
    ],
    cyber: [
      /* 1 — national */
      ['A login form receives the password \' OR 1=1 -- . What kind of attack is this? Answer in two words.', t => has(t, /sql injection|sqli/), 1],
      ['What does CSRF stand for? Give the full name.', t => has(t, /cross[- ]site request forgery/), 1],
      ['Give the port number that SSH listens on by default. Answer with the number only.', t => lastNum(t) === 22, 1],
      ['Convert the hex 414243 to text and give the result only.', t => has(t, /\babc\b/), 1],
      ['Which of these must never be used to store passwords: bcrypt, MD5 or Argon2? Answer with the name only.', t => has(t, /md5/) && !has(t, /argon|bcrypt/), 1],
      ['A cookie is marked HttpOnly. Which attack does that flag help stop? Answer in two words.', t => has(t, /xss|cross[- ]site scripting|script injection/), 1],
      ['An attacker tries a thousand common passwords against one account. Name the cheapest server-side defence in two words.', t => has(t, /rate limit|throttl|lockout|lock out|two[- ]factor|2fa|mfa/), 1],
      ['The cipher text KHOOR was made by shifting every letter three places forward. What is the plain text? One word.', t => has(t, /hello/), 1],
      /* 2 — world */
      ['ROT13 turns "cnffjbeq" into which word? Answer with the word only.', t => has(t, /password/), 2],
      ['A JSON Web Token payload is only Base64-encoded, never encrypted. Can anyone holding the token read it? Answer YES or NO only.', t => /^\W*yes\W*$/i.test(t.trim()), 2],
      ['A vulnerability scores 9.8 on the CVSS scale. Is its severity low, medium, high or critical? One word.', t => has(t, /critical/), 2],
      ['A login endpoint is open to SQL injection. Name the fix that keeps the query and the data apart, in two words.', t => has(t, /parameteri[sz]ed|prepared statement|bound parameter|placeholder/), 2],
      ['Which HTTP header tells a browser to use HTTPS for a site from now on? Give the header name.', t => has(t, /strict[- ]transport[- ]security|hsts/), 2],
      ['A hash proves a downloaded file was not changed. Name that property in one word.', t => has(t, /integrity/), 2],
      ['Give the four-letter acronym for the bug where a user makes the server fetch a URL of their choosing.', t => has(t, /\bssrf\b/), 2],
      ['Long input overwrites a program\'s saved return address and crashes it. Name the bug class in two words.', t => has(t, /buffer overflow|stack overflow|memory corruption/), 2],
      ['A web app writes a file whose name the visitor supplies. Name the two-word attack that can overwrite system files that way.', t => has(t, /traversal/), 2],
      /* 3 — inferno */
      ['Decode this URL-encoded string and give the result exactly: %3Cscript%3Ealert(1)%3C%2Fscript%3E', t => /<script>alert\(1\)<[/]script>/i.test(t.replace(/\s+/g, '')), 3],
      ['A stolen session cookie still works for thirty days. Name the cookie defence it is missing: expiry, rotation or Secure? One word.', t => has(t, /expir|rotat/), 3],
      ['Name the two-word attack where the attacker relays traffic between a client and a server, reading it and changing it.', t => has(t, /man[- ]in[- ]the[- ]middle|mitm|on[- ]path/), 3],
      ['A login answers in 200 ms whether or not the username exists. Name in one word the class of leak that timing removes.', t => has(t, /timing|enumeration|side[- ]channel/), 3],
      ['Two different inputs produce the same hash digest. What is that called? One word.', t => has(t, /collision/), 3],
      ['Decode the hex 4d6f756e6464726f7564 and give the word only.', t => has(t, /moundshroud/), 3],
      ['Which two of these are the right choice for storing passwords: Argon2id, SHA-1, bcrypt, MD5? Name both.', t => has(t, /argon/) && has(t, /bcrypt/) && !has(t, /sha-?1/) && !has(t, /md5|\d{3,}/), 3],
      ['A server accepts a whole file path from a form. Name, in one word, the rule that stops an attacker escaping the intended folder: sanitise, escape or whitelist?', t => has(t, /whitelist|allow[- ]?list|saniti[sz]e/), 3],
      ['An attacker reuses a list of passwords leaked from another site. Name that attack in two words.', t => has(t, /credential stuff|password spray/), 3],
      ['An attacker floods a server with traffic until it stops answering. Give the three-letter acronym for that attack.', t => has(t, /\bd?dos\b/), 3],
    ],
  };

  /* the pools the Games draw from: the warm-up items (level 0) plus everything above */
  const POOL = {
    reason: REASON.map(x => [x[0], x[1], 0]).concat(HARD.reason),
    instr: INSTR.map(x => [x[0], x[1], 0]).concat(HARD.instr),
    know: KNOW.map(x => [x[0], x[1], 0]).concat(HARD.know),
    cyber: CYBER.concat(HARD.cyber),
    code: CODE.map(c => ({ lvl: 0, d: c[0], f: c[1], t: c.slice(2) })).concat(HARD.code),
    search: [{ lvl: 0, passages: SEARCH.passages, qs: SEARCH.qs }].concat(HARD.search),
  };
  /* the hardest items the level allows, so a higher level is never the same easy set again */
  const take = (pool, pitch, n) => pool.filter(x => (x[2] != null ? x[2] : x.lvl) <= pitch).sort((a, b) => (b[2] != null ? b[2] : b.lvl) - (a[2] != null ? a[2] : a.lvl)).slice(0, n);

  /* code runs in a worker with no network and a time limit */
  function runCode(code, fname, tests) {
    return new Promise(done => {
      const src = 'self.onmessage=function(e){var out=[];try{' + code + '\n;var f=(typeof ' + fname + '==="function")?' + fname + ':null;if(!f)throw new Error("no function ' + fname + '");var T=e.data;for(var i=0;i<T.length;i++){try{out.push(JSON.stringify(f.apply(null,T[i][0]))===JSON.stringify(T[i][1]));}catch(x){out.push(false);}}}catch(err){out=T?T.map(function(){return false}):[];}postMessage(out);};';
      let w; try { w = new Worker(URL.createObjectURL(new Blob([src], { type: 'text/javascript' }))); } catch (e) { return done(tests.map(() => false)); }
      const k = setTimeout(() => { w.terminate(); done(tests.map(() => false)); }, 3000);
      w.onmessage = e => { clearTimeout(k); w.terminate(); done(e.data || []); }; w.onerror = () => { clearTimeout(k); w.terminate(); done(tests.map(() => false)); };
      w.postMessage(tests);
    });
  }
  const codeOf = t => { const m = /```(?:javascript|js)?\s*\n([\s\S]*?)```/i.exec(t); return (m ? m[1] : t).trim(); };

  /* vision pictures, drawn here so the right answer is known */
  function visionTasks() {
    const mk = (draw) => { const c = document.createElement('canvas'); c.width = c.height = 384; const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, 384, 384); draw(g); return c.toDataURL('image/jpeg', .9).split(',')[1]; };
    const n = 3 + Math.floor(Math.random() * 4), word = ['TIGER', 'PLANET', 'CASTLE', 'ORANGE', 'ROCKET'][Math.floor(Math.random() * 5)];
    const colors = [['blue', '#1f5fe0'], ['red', '#e02424'], ['green', '#1fa34a'], ['yellow', '#f2c200']], col = colors[Math.floor(Math.random() * 4)], left = Math.random() < .5;
    const reds = 2 + (n % 3), blues = 2 + ((n + 1) % 3);   /* the hardest picture: counting two kinds at once */
    return [
      { q: 'How many red circles are in this picture? Answer with a number only.', img: mk(g => { for (let i = 0; i < n; i++) { g.fillStyle = '#e02424'; g.beginPath(); g.arc(50 + (i % 3) * 120, 90 + Math.floor(i / 3) * 150, 38, 0, 7); g.fill(); } g.fillStyle = '#1f5fe0'; g.fillRect(300, 300, 50, 50); }), ok: t => lastNum(t) === n },
      { q: 'What word is written in this picture? Answer with the word only.', img: mk(g => { g.fillStyle = '#111'; g.font = 'bold 72px Arial'; g.textAlign = 'center'; g.fillText(word, 192, 210); }), ok: t => t.toUpperCase().includes(word) },
      { q: 'What colour is the big square? Answer with one word.', img: mk(g => { g.fillStyle = col[1]; g.fillRect(80, 80, 224, 224); }), ok: t => t.toLowerCase().includes(col[0]) },
      { q: 'There is a circle and a triangle. Which shape is on the left? Answer with one word.', img: mk(g => { g.fillStyle = '#333'; const cx = left ? 96 : 288, tx = left ? 288 : 96; g.beginPath(); g.arc(cx, 192, 60, 0, 7); g.fill(); g.beginPath(); g.moveTo(tx, 130); g.lineTo(tx - 65, 250); g.lineTo(tx + 65, 250); g.closePath(); g.fill(); }), ok: t => has(t, left ? /circle/ : /triangle/) && !has(t, left ? /triangle/ : /circle/) },
      { q: 'Are there more red circles than blue squares in this picture? Answer YES or NO only.', img: mk(g => { for (let i = 0; i < reds; i++) { g.fillStyle = '#e02424'; g.beginPath(); g.arc(40 + (i % 3) * 130, 80 + Math.floor(i / 3) * 140, 34, 0, 7); g.fill(); } for (let i = 0; i < blues; i++) { g.fillStyle = '#1f5fe0'; g.fillRect(300 + (i % 2) * 20, 40 + i * 70, 60, 60); } }), ok: t => { const y = /\byes\b/i.test(t), no = /\bno\b/i.test(t); return reds > blues ? (y && !no) : (no && !y); } },
    ];
  }
  const cos = (a, b) => { let d = 0, x = 0, y = 0; for (let i = 0; i < a.length; i++) { d += a[i] * b[i]; x += a[i] * a[i]; y += b[i] * b[i]; } return d / (Math.sqrt(x * y) || 1); };

  /* one model, one event: {score 0..1, raw, notes[], ms} */
  async function runEvent(ev, m, J) {
    const S = J.signal, L = J.level || LEVELS[0], N = L.n || {}, sys = { role: 'system', content: 'Answer briefly and exactly as asked.' };
    /* the clock: how many seconds one answer gets at this level (0 = untimed, the Club meet) */
    const CLOCK = { reason: 1, instr: 1, know: .8, vision: 1.5, code: 3, write: 4, speed: 2, cyber: 1.2 };
    const clock = Math.round(L.clock * (CLOCK[ev] || 1));
    /* the answer budget shrinks with the pressure, so a model that waffles runs out of room */
    const cap = n => Math.max(40, Math.round(n * (L.max || 1)));
    const timed = fn => {
      if (!clock) return fn(S);
      const c = new AbortController(), onAbort = () => c.abort();
      S.addEventListener('abort', onAbort);
      const t = setTimeout(() => c.abort(), clock * 1000);
      return fn(c.signal)
        .catch(e => { if (S.aborted) throw e; throw Object.assign(new Error('out of time'), { timeout: true }); })
        .finally(() => { clearTimeout(t); S.removeEventListener('abort', onAbort); });
    };
    const tally = async (items, fn) => {
      let ok = 0; const notes = [];
      for (const it of items) {
        if (S.aborted) throw new Error('stopped');
        try { const r = await fn(it); if (r.ok) ok++; notes.push((r.ok ? '✓ ' : '✗ ') + r.note); }
        catch (e) { if (S.aborted) throw e; notes.push('✗ ' + (e.timeout ? 'no answer inside ' + clock + ' s' : String(e.message || e).slice(0, 70))); }
        J.tick();
      }
      return { score: items.length ? ok / items.length : 0, raw: ok + '/' + items.length, notes };
    };
    if (ev === 'reason') return tally(take(POOL.reason, L.pitch, N.reason || 5), async ([q, chk]) => {
      const r = await timed(sig => ask(m.name, [sys, { role: 'user', content: q + ' Give the final answer on the last line.' }], { signal: sig, max: cap(350) }));
      return { ok: chk(r.text), note: (r.ms / 1000).toFixed(0) + ' s · ' + q.slice(0, 46) + ' → ' + r.text.split('\n').pop().slice(0, 60) };
    });
    if (ev === 'instr') return tally(take(POOL.instr, L.pitch, N.instr || 5), async ([q, chk]) => {
      const r = await timed(sig => ask(m.name, [{ role: 'user', content: q }], { signal: sig, max: cap(200) }));
      return { ok: chk(r.text), note: (r.ms / 1000).toFixed(0) + ' s · ' + q.slice(0, 46) + ' → ' + r.text.replace(/\s+/g, ' ').slice(0, 60) };
    });
    if (ev === 'know') return tally(take(POOL.know, L.pitch, N.know || 6), async ([q, re]) => {
      const r = await timed(sig => ask(m.name, [sys, { role: 'user', content: q + ' Answer in a few words.' }], { signal: sig, max: cap(80) }));
      return { ok: re.test(r.text.toLowerCase()), note: (r.ms / 1000).toFixed(0) + ' s · ' + q.slice(0, 42) + ' → ' + r.text.slice(0, 50) };
    });
    if (ev === 'cyber') return tally(take(POOL.cyber, L.pitch, N.cyber || 6), async ([q, chk]) => {
      const r = await timed(sig => ask(m.name, [{ role: 'system', content: 'You are a calm security engineer. Answer in one short line, with no lecture and no caveats.' }, { role: 'user', content: q }], { signal: sig, max: cap(140) }));
      return { ok: chk(r.text), note: (r.ms / 1000).toFixed(0) + ' s · ' + q.slice(0, 46) + ' → ' + r.text.replace(/\s+/g, ' ').slice(0, 60) };
    });
    if (ev === 'code') return tally(take(POOL.code, L.pitch, N.code || 3), async c => {
      const r = await timed(sig => ask(m.name, [{ role: 'system', content: 'You write correct, plain JavaScript. Reply with one ```javascript code block containing only the function, no explanation, no imports, no console output.' }, { role: 'user', content: 'Write the JavaScript function ' + c.d }], { signal: sig, max: cap(700) }));
      const res = await runCode(codeOf(r.text), c.f, c.t), pass = res.filter(Boolean).length;
      return { ok: pass === c.t.length, note: c.f + ': ' + pass + '/' + c.t.length + ' tests · ' + (r.ms / 1000).toFixed(0) + ' s' };
    });
    if (ev === 'speed') {
      const r = await timed(sig => ask(m.name, [{ role: 'user', content: SPEED }], { signal: sig, max: cap(160) })); J.tick();
      return { score: r.tps, raw: r.tps.toFixed(1) + ' tok/s', notes: ['first word after ' + (r.ttft / 1000).toFixed(1) + ' s', r.tokens + ' tokens in ' + (r.ms / 1000).toFixed(1) + ' s'], higherIsRaw: true };
    }
    if (ev === 'vision') return tally(visionTasks().slice(0, N.vision || 3), async t => {
      const r = await timed(sig => ask(m.name, [{ role: 'user', content: t.q, images: [t.img] }], { signal: sig, max: cap(60) }));
      return { ok: t.ok(r.text), note: t.q.slice(0, 40) + ' → ' + r.text.slice(0, 40) };
    });
    if (ev === 'search') {
      const set = take(POOL.search, L.pitch, 1)[0] || POOL.search[0];
      const emb = async input => { const r = await fetch('/api/embed', { method: 'POST', signal: S, body: JSON.stringify({ model: m.name, input }) }); const j = await r.json(); if (!r.ok || !j.embeddings || !j.embeddings.length) throw new Error(j.error || 'no embeddings'); return j.embeddings; };
      const P = await emb(set.passages), Q = await emb(set.qs.map(x => x[0])); J.tick();
      let ok = 0; const notes = set.qs.map(([q, want], i) => { const best = P.map((p, k) => [cos(Q[i], p), k]).sort((a, b) => b[0] - a[0])[0][1]; if (best === want) ok++; return (best === want ? '✓ ' : '✗ ') + q; });
      return { score: ok / set.qs.length, raw: ok + '/' + set.qs.length, notes: ['level: ' + (set.lvl || 0)].concat(notes) };
    }
    if (ev === 'write') {
      /* a brief with a hard word window at the higher levels: the judge scores it, the word count is checked by code */
      const win = L.pitch >= 3 ? [110, 130] : L.pitch >= 2 ? [100, 140] : L.pitch >= 1 ? [90, 150] : [0, 999];
      const brief = win[0] ? 'Write a story of between ' + win[0] + ' and ' + win[1] + ' words about ' + WRITE.slice(WRITE.indexOf('about') + 6) : WRITE;
      const r = await timed(sig => ask(m.name, [{ role: 'user', content: brief }], { signal: sig, max: cap(400), temp: .8 })); J.tick();
      const wc = r.text.trim().split(/\s+/).filter(Boolean).length;
      let sc = 0, why = '';
      try { const jr = await ask(J.judge, [{ role: 'system', content: 'You are a strict, fair writing judge. Reply with JSON only: {"creativity":0-10,"coherence":0-10,"brief":0-10,"why":"one sentence"}' }, { role: 'user', content: 'The brief: ' + brief + '\n\nThe story:\n' + r.text.slice(0, 2500) }], { signal: S, max: 200 }); const j = A.ai.json(jr.text) || {}; sc = ((+j.creativity || 0) + (+j.coherence || 0) + (+j.brief || 0)) / 30; why = String(j.why || ''); } catch (e) { if (S.aborted) throw e; why = 'The judge could not score it.'; }
      const inWindow = wc >= win[0] && wc <= win[1];
      if (!inWindow) sc = sc * .5;
      J.tick(); return { score: sc, raw: Math.round(sc * 100) + '/100', notes: [(inWindow ? '✓ ' : '✗ ') + wc + ' words (the brief asked ' + (win[0] ? win[0] + '–' + win[1] : 'any length') + ')', why, r.text.slice(0, 600)] };
    }
    throw new Error('unknown event');
  }

  /* ---------- the models ---------- */
  async function models() {
    let list = []; try { const r = await A.api('/api/models'); if (A.modelOrder && typeof r.defaultModel === 'string') A.modelOrder.sync(r.defaultModel); list = r.models || []; } catch (e) { }
    const out = [];
    for (const m of list) {
      if (/-agent(-\d+k)?(:latest)?$/.test(m.name)) continue;      /* the agent's copies of a model are the same model */
      if (m.cloud) { out.push({ name: m.name, label: (m.label || m.name).replace(/^☁\s*/, ''), cloud: true, chat: true, vision: true, embed: false, size: 0 }); continue; }
      let caps = []; try { caps = (await A.api('/api/modelcaps?name=' + encodeURIComponent(m.name))).caps || []; } catch (e) { }
      const chat = !caps.length || caps.includes('completion');
      /* search needs a real embedding model (e.g. nomic-embed-text): this Ollama cannot make embeddings with chat models */
      out.push({ name: m.name, label: bare(m.name), size: m.size || 0, chat, vision: caps.includes('vision'), embed: caps.includes('embedding'), embedOnly: caps.includes('embedding') && !caps.includes('completion') });
    }
    return A.modelOrder ? A.modelOrder.sort(out) : out;
  }
  const can = (m, need) => need === 'chat' ? m.chat : need === 'vision' ? m.vision && !m.cloud : need === 'embed' ? m.embed && !m.cloud : false;

  /* ---------- the games (one at a time, kept running while you look elsewhere) ---------- */
  let JOB = null, DB = null;
  async function db() { if (DB) return DB; try { DB = await A.api('/api/kv?name=olympics'); } catch (e) { DB = []; } if (!Array.isArray(DB)) DB = []; return DB; }
  async function save(rec) { const d = await db(); d.unshift(rec); DB = d.slice(0, 60); try { await A.api('/api/kv?name=olympics', DB); } catch (e) { } }
  async function startGames(sel, events, level, judge) {
    if (JOB && JOB.running) return; const ctl = new AbortController(); const L = lvlOf(level && level.id ? level.id : level);
    const plan = []; sel.forEach(m => events.forEach(e => { if (can(m, EVENTS.find(x => x.id === e).need)) plan.push([m, e]); }));
    JOB = { running: true, ctl, level: L, judge, at: Date.now(), plan, done: 0, steps: 0, now: '', results: {}, models: sel.map(m => m.name), events, err: {} };
    const J = { signal: ctl.signal, level: L, judge, tick: () => { JOB.steps++; paint(); } };
    for (const [m, e] of plan) {      /* model by model, so each model loads only once */
      if (ctl.signal.aborted) break;
      JOB.now = bare(m.name) + ' · ' + EVENTS.find(x => x.id === e).name; paint();
      try { const r = await runEvent(e, m, J); (JOB.results[e] = JOB.results[e] || {})[m.name] = r; }
      catch (x) { if (ctl.signal.aborted) break; (JOB.err[e] = JOB.err[e] || {})[m.name] = String(x.message || x).slice(0, 120); }
      JOB.done++; paint();
    }
    JOB.running = false; JOB.now = ctl.signal.aborted ? 'Stopped.' : 'Finished.';
    if (JOB.done) await save({ type: 'games', at: JOB.at, level: L.id, levelName: L.name, judge, models: JOB.models, events, results: JOB.results, err: JOB.err, stopped: ctl.signal.aborted });
    paint();
  }

  /* ---------- medals ---------- */
  function medals(results, debates) {
    const table = {}, row = n => table[n] = table[n] || { g: 0, s: 0, b: 0, pts: 0, best: [] };
    Object.entries(results || {}).forEach(([ev, per]) => {
      const sorted = Object.entries(per).filter(([, r]) => r && isFinite(r.score)).sort((a, b) => b[1].score - a[1].score);
      let place = 0, prev = null; sorted.forEach(([name, r], i) => { if (prev === null || r.score < prev) place = i; prev = r.score; if (place < 3 && r.score > 0) { const t = row(name); t[['g', 's', 'b'][place]]++; t.pts += 3 - place; if (place === 0) t.best.push(ev); } else row(name); });
    });
    const wins = {}; (debates || []).forEach(d => { if (d.winner) wins[d.winner] = (wins[d.winner] || 0) + 1; });
    const dr = Object.entries(wins).sort((a, b) => b[1] - a[1]); dr.slice(0, 3).forEach(([n], i) => { const t = row(n); t[['g', 's', 'b'][i]]++; t.pts += 3 - i; if (!i) t.best.push('debate'); });
    return Object.entries(table).sort((a, b) => b[1].g - a[1].g || b[1].s - a[1].s || b[1].b - a[1].b || b[1].pts - a[1].pts);
  }

  /* ---------- the page ---------- */
  let root = null, view = 'table', MODELS = null, BUILD = null, DUEL = null;
  function paint() { if (root && root.isConnected) draw(); }
  async function render(host) {
    root = host; host.innerHTML = '<div class="olx"><div class="olhead"><b>🏅 AI Olympics</b><div class="row" id="olnav" style="gap:4px;flex-wrap:wrap"></div></div><div id="olbody" class="scroll pad" style="flex:1;min-height:0"></div></div>';
    host.querySelector('#olnav').onclick = e => { const b = e.target.closest('[data-v]'); if (b) { view = b.dataset.v; draw(); } };
    host.addEventListener('click', onClick);
    if (!MODELS) { host.querySelector('#olbody').innerHTML = '<div class="mute">Finding the models on this PC…</div>'; MODELS = await models(); }
    await db(); draw();
    host._onShow = () => draw();
    if (A.on && !host._defWired) { host._defWired = true; A.on('default-model', () => { if (root === host && host.isConnected && view === 'run' && !(JOB && JOB.running)) draw(); }); }
  }
  const NAV = [['table', '🏆 Medal table'], ['run', '▶ Run the Games'], ['build', '🏗 Build-off'], ['duel', '🖼 Picture duel'], ['hist', '🕘 History']];
  async function draw() {
    if (!root) return; const nav = root.querySelector('#olnav'), b = root.querySelector('#olbody'); if (!nav || !b) return;
    nav.innerHTML = NAV.map(n => '<button class="ib' + (view === n[0] ? ' on' : '') + '" data-v="' + n[0] + '">' + n[1] + (n[0] === 'run' && JOB && JOB.running ? ' ⏳' : '') + (n[0] === 'build' && BUILD && BUILD.running ? ' ⏳' : '') + '</button>').join('');
    if (view === 'build' && BUILD && b._build === BUILD) return buildUpdate(b);      /* only the entries that changed are redrawn, so a finished entry keeps running */
    b._build = view === 'build' ? BUILD : null;
    if (view === 'table') { const deb = await A.api('/api/kv?name=debates').catch(() => []); b.innerHTML = tableHtml(Array.isArray(deb) ? deb : []); }
    else if (view === 'run') b.innerHTML = runHtml();
    else if (view === 'build') b.innerHTML = buildHtml();
    else if (view === 'duel') b.innerHTML = duelHtml();
    else b.innerHTML = histHtml();
    if (view === 'build') b.querySelectorAll('iframe[data-src]').forEach(f => { f.srcdoc = sandboxed(BUILD.entries[+f.dataset.src].html); });
  }
  function buildUpdate(b) {
    const head = b.querySelector('[data-bhead]'); if (head) { const t = document.createElement('div'); t.innerHTML = buildHead(); if (head.outerHTML !== t.firstElementChild.outerHTML) head.replaceWith(t.firstElementChild); }
    BUILD.entries.forEach((e, i) => {
      const card = b.querySelector('[data-entry="' + i + '"]'), html = entryCard(e, i); if (!card || card.dataset.sig === sigOf(e, i)) return;
      const t = document.createElement('div'); t.innerHTML = html; const n = t.firstElementChild; card.replaceWith(n);
      const f = n.querySelector('iframe[data-src]'); if (f) f.srcdoc = sandboxed(e.html);
    });
  }
  const lastGames = () => (DB || []).find(r => r.type === 'games');
  function tableHtml(deb) {
    const g = lastGames(), M = medals(g ? g.results : {}, deb), EV = EVENTS.concat([{ id: 'debate', icon: '🗣', name: 'Debate' }]);
    if (!g && !(deb || []).length) return '<div class="card"><h3 style="margin-top:0">No Games yet</h3><p>Press <b>▶ Run the Games</b>: every model on this PC competes in the events it can do. Results with right answers are scored automatically; the story is scored by a judge model. Debates from the Debate page count too, and the Build-off is judged by you.</p></div>';
    const lv = g && g.level ? lvlOf(g.level) : null;
    let h = '<div class="small mute" style="margin-bottom:8px">' + (g ? 'From the Games on ' + new Date(g.at).toLocaleString() + (lv ? ' · ' + lv.icon + ' ' + lv.name : g.quick ? ' (quick)' : '') + (g.stopped ? ', stopped early' : '') : 'No Games run yet') + ' · debates: ' + (deb || []).length + '</div>';
    h += '<table class="oltab"><tr><th>#</th><th>Model</th><th>🥇</th><th>🥈</th><th>🥉</th><th>Points</th><th>Best at</th></tr>' + M.map(([n, t], i) => '<tr><td>' + (i < 3 ? MEDAL[i] : i + 1) + '</td><td><b>' + esc(bare(n)) + '</b></td><td>' + t.g + '</td><td>' + t.s + '</td><td>' + t.b + '</td><td>' + t.pts + '</td><td class="small">' + t.best.map(e => { const x = EV.find(y => y.id === e); return x ? x.icon + ' ' + x.name : e; }).join(', ') + '</td></tr>').join('') + '</table>';
    if (g) {
      h += '<h3>Event by event</h3><div class="olgrid">' + EVENTS.filter(e => g.results[e.id]).map(e => { const per = Object.entries(g.results[e.id]).sort((a, b) => b[1].score - a[1].score); return '<div class="card"><b>' + e.icon + ' ' + e.name + '</b><div class="small mute">' + esc(e.desc) + '</div>' + per.map(([n, r], i) => '<details><summary>' + (i < 3 && r.score > 0 ? MEDAL[i] + ' ' : '') + esc(bare(n)) + ' <span class="mute">' + esc(r.raw) + '</span></summary><div class="small" style="white-space:pre-wrap">' + esc((r.notes || []).join('\n')) + '</div></details>').join('') + '</div>'; }).join('') + '</div>';
      const errs = Object.entries(g.err || {}); if (errs.length) h += '<details class="small"><summary class="mute">Could not take part (' + errs.reduce((a, [, p]) => a + Object.keys(p).length, 0) + ')</summary>' + errs.map(([e, p]) => Object.entries(p).map(([n, m]) => esc(bare(n)) + ' · ' + e + ': ' + esc(m)).join('<br>')).join('<br>') + '</details>';
    }
    return h;
  }
  function runHtml() {
    if (JOB && (JOB.running || Date.now() - JOB.at < 6e5)) {
      const pct = JOB.plan.length ? Math.round(100 * JOB.done / JOB.plan.length) : 0;
      let h = '<div class="card"><div class="row" style="align-items:center;gap:8px"><b style="flex:1">' + (JOB.running ? '⏳ The Games are on' : '🏁 ' + esc(JOB.now)) + '</b>' + (JOB.running ? '<button class="ib dang" data-a="stop">■ Stop</button>' : '<button class="ib" data-a="new">New Games</button><button class="pri" data-a="seetable">See the medals</button>') + '</div>' +
        '<div class="bar" style="margin:8px 0"><i style="width:' + pct + '%"></i></div><div class="small mute">' + JOB.level.icon + ' ' + esc(JOB.level.name) + ' · ' + JOB.done + ' of ' + JOB.plan.length + ' events done · ' + esc(JOB.now) + (JOB.level.clock ? ' · ' + JOB.level.clock + ' s a question' : ' · untimed') + ' · you can switch to other pages, it keeps going</div></div>';
      h += '<table class="oltab"><tr><th>Model</th>' + JOB.events.map(e => '<th>' + EVENTS.find(x => x.id === e).icon + '</th>').join('') + '</tr>' + JOB.models.map(n => '<tr><td>' + esc(bare(n)) + '</td>' + JOB.events.map(e => { const r = (JOB.results[e] || {})[n], er = (JOB.err[e] || {})[n]; return '<td class="small">' + (r ? esc(r.raw) : er ? '<span class="bad" title="' + esc(er) + '">✗</span>' : JOB.plan.some(([m, x]) => m.name === n && x === e) ? '·' : '<span class="mute">n/a</span>') + '</td>'; }).join('') + '</tr>').join('') + '</table>';
      return h;
    }
    const ms = A.modelOrder ? A.modelOrder.sort(MODELS || []) : (MODELS || []);
    const chatMs = ms.filter(m => m.chat);
    const judgeDef = ((A.modelOrder && A.modelOrder.get() && chatMs.find(m => A.modelOrder.isDefault(m))) || chatMs.find(m => !m.cloud) || chatMs[0] || {}).name || '';
    return '<div class="card"><b>Who competes</b><div class="small mute" style="margin:2px 0 8px">Every model gets the events it can do: 👁 can see pictures, 🔎 can make embeddings for search, ☁ a guest on Claude (costs a little; only test questions are sent, never your files).</div><div class="olms">' +
      ms.map(m => '<label class="chk"><input type="checkbox" data-m="' + esc(m.name) + '"' + (m.cloud ? '' : ' checked') + '> ' + esc(m.label) + ' <span class="small mute">' + (m.size ? (m.size / 1e9).toFixed(1) + ' GB ' : '') + (m.vision ? '👁' : '') + (m.embed ? '🔎' : '') + (m.cloud ? '☁' : '') + (m.embedOnly ? ' search only' : '') + '</span></label>').join('') + '</div></div>' +
      '<div class="card"><b>Events</b><div class="olms">' + EVENTS.map(e => { const none = !ms.some(m => can(m, e.need)); return '<label class="chk"><input type="checkbox" data-e="' + e.id + '"' + (none ? ' disabled' : ' checked') + '> ' + e.icon + ' ' + e.name + ' <span class="small mute">' + esc(none && e.id === 'search' ? 'No search model yet: get nomic-embed-text (about 0.3 GB) in Prepare › Stock up › AI models, by name' : none ? 'No model here can do this' : e.desc) + '</span></label>'; }).join('') + '</div>' +
      '<div style="margin-top:12px"><b>How much pressure</b><div class="small mute" style="margin:2px 0 6px">Pick the level that fits the models you are entering. A small model at the Inferno final is meant to be torn apart; a big one at the Club meet is only warming up.</div>' + levelPicker() + '</div>' +
      '<div class="row" style="gap:10px;margin-top:10px;flex-wrap:wrap;align-items:center"><label class="small">Writing judge <select id="olj">' + chatMs.map(m => '<option value="' + esc(m.name) + '"' + (m.name === judgeDef ? ' selected' : '') + '>' + esc(A.modelOrder ? A.modelOrder.label(m) : m.label) + '</option>').join('') + '</select></label></div>' +
      '<div class="row" style="gap:8px;margin-top:12px"><button class="pri" data-a="start">🏁 Start the Games</button><span class="small mute">Models run one at a time; each loads once.</span></div></div>' +
      '<div class="card small mute">The Debate page (Chat › 🗣 Debate) hands out debate medals. The Build-off and the Picture duel are judged by you.</div>';
  }
  function histHtml() {
    const d = DB || []; if (!d.length) return '<div class="mute">Nothing yet.</div>';
    return d.map(r => '<div class="card"><b>' + (r.type === 'games' ? '🏅 Games' : r.type === 'build' ? '🏗 Build-off: ' + esc(r.challenge) : '🖼 Picture duel: ' + esc(r.prompt)) + '</b> <span class="small mute">' + (r.type === 'games' && r.level ? lvlOf(r.level).icon + ' ' + lvlOf(r.level).name + ' · ' : '') + new Date(r.at).toLocaleString() + '</span>' +
      (r.type === 'games' ? '<div class="small">' + medals(r.results).slice(0, 3).map(([n], i) => MEDAL[i] + ' ' + esc(bare(n))).join(' · ') + '</div>' : r.type === 'build' ? '<div class="small">' + (r.ranking || []).map((n, i) => (MEDAL[i] || (i + 1) + '.') + ' ' + esc(bare(n))).join(' · ') + '</div>' : '<div class="small">Your pick: ' + esc(r.winner || '-') + '</div>') + '</div>').join('');
  }

  /* ---------- the Build-off ---------- */
  const CHALLENGES = ['A tiny game I can play right away with the mouse or keyboard', 'An interactive toy that would make me smile', 'A beautiful animated generative-art piece', 'A useful little tool for everyday life', 'A space scene I can fly through or explore', 'A musical toy that makes sounds when I click (Web Audio)', 'A clock or timer that looks amazing', 'A tiny physics sandbox'];
  async function startBuild(challenge, sel) {
    if (BUILD && BUILD.running) return; const ctl = new AbortController();
    BUILD = { running: true, ctl, challenge, at: Date.now(), entries: shuffle(sel.map(m => ({ model: m.name, html: '', status: 'waiting', ms: 0 }))), rank: [], revealed: false };
    const sys = 'You are competing in a build-off judged by a human. Build ONE self-contained HTML page (inline CSS and JavaScript, no external files, no network, no images from the internet) for the challenge. It must work immediately when opened and look polished. Reply with only the full HTML document in one ```html code block.';
    for (const e of BUILD.entries) {
      if (ctl.signal.aborted) break; e.status = 'building'; paint();
      try { const r = await ask(e.model, [{ role: 'system', content: sys }, { role: 'user', content: 'The challenge: ' + challenge }], { signal: ctl.signal, max: 3500, temp: .7 }); const m = /```(?:html)?\s*\n([\s\S]*?)```/i.exec(r.text); e.html = (m ? m[1] : r.text).trim(); e.ms = r.ms; e.status = /<(html|body|canvas|div|script)/i.test(e.html) ? 'done' : 'empty'; }
      catch (x) { e.status = ctl.signal.aborted ? 'stopped' : 'failed'; e.err = String(x.message || x); }
      paint();
    }
    BUILD.running = false; paint();
  }
  /* each entry runs in a sandbox: scripts yes, but no access to Moundshroud, no network, no forms, no pop-ups */
  const sandboxed = h => '<!doctype html><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; script-src \'unsafe-inline\'; style-src \'unsafe-inline\'; img-src data: blob:; media-src data: blob:; font-src data:">' + h;
  function buildHtml() {
    if (!BUILD) {
      const ms = (MODELS || []).filter(m => m.chat);
      return '<div class="card"><b>🏗 Build-off</b><div class="small mute" style="margin:2px 0 8px">Each model builds a one-page web toy for the same challenge. You see the entries side by side as A, B, C… without knowing who made which, rank them, then the makers are revealed. Each entry runs sealed off: it cannot reach Moundshroud, your files or the internet.</div>' +
        '<div class="olsug">' + CHALLENGES.map(c => '<button class="chip" data-ch="' + esc(c) + '">' + esc(c) + '</button>').join('') + '</div><input id="olch" placeholder="Or type your own challenge" style="width:100%;margin-top:8px"><div class="olms" style="margin-top:8px">' + ms.map(m => '<label class="chk"><input type="checkbox" data-bm="' + esc(m.name) + '"' + (m.cloud ? '' : ' checked') + '> ' + esc(m.label) + '</label>').join('') + '</div><div class="row" style="gap:8px;margin-top:10px"><button class="pri" data-a="build">🏗 Start the Build-off</button><span class="small mute">Each model takes a minute or two.</span></div></div>';
    }
    return buildHead() + '<div class="olbuild">' + BUILD.entries.map(entryCard).join('') + '</div>';
  }
  const L = i => String.fromCharCode(65 + i);
  function buildHead() {
    const B = BUILD;
    return '<div class="card" data-bhead="1"><div class="row" style="gap:8px;align-items:center;flex-wrap:wrap"><b style="flex:1">🏗 ' + esc(B.challenge) + '</b>' + (B.running ? '<button class="ib dang" data-a="bstop">■ Stop</button>' : '') + (!B.running && !B.revealed ? '<span class="small mute">Rank them: click 🥇 🥈 🥉 under the entries, then Reveal.</span><button class="pri" data-a="reveal"' + (B.rank.some(x => x >= 0) ? '' : ' disabled') + '>Reveal the makers</button>' : '') + (B.revealed || !B.running ? '<button class="ib" data-a="bnew">New Build-off</button>' : '') + '</div></div>';
  }
  const sigOf = (e, i) => [e.status, BUILD.rank.indexOf(i), BUILD.revealed, BUILD.running].join('|');
  function entryCard(e, i) {
    const B = BUILD, place = B.rank.indexOf(i);
    return '<div class="card olentry" data-entry="' + i + '" data-sig="' + sigOf(e, i) + '"><div class="row" style="align-items:center;gap:6px"><b style="flex:1">Entry ' + L(i) + (B.revealed ? ' · ' + esc(bare(e.model)) : '') + '</b>' + (place >= 0 ? '<span style="font-size:20px">' + (MEDAL[place] || place + 1) + '</span>' : '') + '<span class="small mute">' + (e.status === 'building' ? '⏳ building…' : e.status === 'waiting' ? 'waiting' : e.status === 'done' ? Math.round(e.ms / 1000) + ' s' : esc(e.status)) + '</span></div>' +
      (e.status === 'done' ? '<iframe sandbox="allow-scripts" data-src="' + i + '" title="Entry ' + L(i) + '"></iframe>' : e.status === 'building' || e.status === 'waiting' ? '<div class="olwait">…</div>' : '<div class="olwait small mute">' + esc(e.err || 'It built nothing usable.') + '</div>') +
      (!B.running && !B.revealed && e.status === 'done' ? '<div class="row" style="gap:4px;margin-top:6px">' + [0, 1, 2].map(p => '<button class="ib" data-rank="' + i + ':' + p + '">' + MEDAL[p] + '</button>').join('') + '<button class="ib" data-full="' + i + '" title="Open bigger">⤢</button></div>' : e.status === 'done' ? '<div class="row" style="margin-top:6px"><button class="ib" data-full="' + i + '">⤢ Bigger</button></div>' : '') + '</div>';
  }
  function fullView(i) {
    const e = BUILD.entries[i]; const o = document.createElement('div'); o.className = 'olfull';
    o.innerHTML = '<div class="row" style="padding:8px;gap:8px"><b style="flex:1;color:#fff">Entry ' + String.fromCharCode(65 + i) + (BUILD.revealed ? ' · ' + esc(bare(e.model)) : '') + '</b><button class="ib" data-x="1">✕ Close</button></div><iframe sandbox="allow-scripts"></iframe>';
    document.body.appendChild(o); o.querySelector('iframe').srcdoc = sandboxed(e.html); o.querySelector('[data-x]').onclick = () => o.remove();
  }

  /* ---------- the Picture duel ---------- */
  const DUELP = ['A cosy cabin in a snowy forest at night, warm light in the windows', 'A red fox wearing a tiny knight\'s helmet, storybook illustration', 'A futuristic city floating above the clouds at sunrise', 'A bowl of ramen on a wooden table, steam rising, food photography'];
  async function startDuel(prompt) {
    if (DUEL && DUEL.running) return; const st = await AIArt.status(true);
    const eng = [{ id: 'sdxl', label: 'SDXL Turbo' }].concat(st.edit ? [{ id: 'flux', label: 'FLUX Kontext' }] : []);
    DUEL = { running: true, prompt, at: Date.now(), entries: shuffle(eng.map(e => ({ ...e, url: '', status: 'waiting', ms: 0 }))), winner: '', revealed: false };
    for (const e of DUEL.entries) {
      e.status = 'drawing'; paint(); const t0 = Date.now();
      try {
        if (e.id === 'sdxl') { const r = await AIArt.image(prompt, { w: 512, h: 512, steps: 4 }); e.url = r.url; }
        else { const r = await fetch('/api/art/flux', { method: 'POST', body: JSON.stringify({ prompt, w: 512, h: 512 }) }); if (!r.ok) throw new Error((await r.json()).error); e.url = URL.createObjectURL(await r.blob()); }
        e.status = 'done'; e.ms = Date.now() - t0;
      } catch (x) { e.status = 'failed'; e.err = String(x.message || x); }
      paint();
    }
    DUEL.running = false; paint();
  }
  function duelHtml() {
    if (!DUEL) return '<div class="card"><b>🖼 Picture duel</b><div class="small mute" style="margin:2px 0 8px">The picture models draw the same prompt. You pick the one you like, without knowing which made it. SDXL Turbo takes seconds; FLUX takes about 3 minutes and about 10 GB of free memory.</div><div class="olsug">' + DUELP.map(p => '<button class="chip" data-dp="' + esc(p) + '">' + esc(p) + '</button>').join('') + '</div><input id="oldp" placeholder="Or type your own prompt" style="width:100%;margin-top:8px"><div class="row" style="margin-top:10px"><button class="pri" data-a="duel">🖼 Start the duel</button></div></div>';
    const D = DUEL;
    return '<div class="card"><div class="row" style="align-items:center;gap:8px;flex-wrap:wrap"><b style="flex:1">🖼 ' + esc(D.prompt) + '</b>' + (!D.running ? '<button class="ib" data-a="dnew">New duel</button>' : '') + '</div></div><div class="olbuild">' +
      D.entries.map((e, i) => '<div class="card olentry"><b>Picture ' + (i + 1) + (D.revealed ? ' · ' + e.label + ' (' + Math.round(e.ms / 1000) + ' s)' : '') + '</b>' + (e.url ? '<img src="' + e.url + '" style="width:100%;border-radius:8px;margin-top:6px">' : '<div class="olwait">' + (e.status === 'failed' ? esc(e.err) : e.status === 'drawing' ? '⏳ drawing…' : 'waiting') + '</div>') + (!D.running && !D.revealed && e.url ? '<button class="pri" data-pick="' + i + '" style="margin-top:6px">👍 This one</button>' : D.winner === e.label ? '<div style="margin-top:6px">🥇 Your pick</div>' : '') + '</div>').join('') + '</div>';
  }

  /* ---------- clicks ---------- */
  async function onClick(e) {
    const t = e.target.closest('button'); if (!t || !root.contains(t)) return; const d = t.dataset;
    if (d.a === 'start') {
      const sel = (MODELS || []).filter(m => root.querySelector('[data-m="' + CSS.escape(m.name) + '"]').checked), evs = EVENTS.map(x => x.id).filter(id => root.querySelector('[data-e="' + id + '"]').checked);
      if (!sel.length || !evs.length) return A.toast('Pick at least one model and one event.');
      const judge = root.querySelector('#olj').value;
      const picked = root.querySelector('input[name="ollv"]:checked');
      startGames(sel, evs, picked ? picked.value : 'club', judge); draw();
    }
    else if (d.a === 'stop') { if (JOB) JOB.ctl.abort(); }
    else if (d.a === 'new') { JOB = null; draw(); }
    else if (d.a === 'seetable') { view = 'table'; draw(); }
    else if (d.ch) { root.querySelector('#olch').value = d.ch; }
    else if (d.a === 'build') { const ch = root.querySelector('#olch').value.trim(); if (!ch) return A.toast('Pick or type a challenge.'); const sel = (MODELS || []).filter(m => { const c = root.querySelector('[data-bm="' + CSS.escape(m.name) + '"]'); return c && c.checked; }); if (sel.length < 2) return A.toast('Pick at least two models.'); startBuild(ch, sel); draw(); }
    else if (d.a === 'bstop') { if (BUILD) BUILD.ctl.abort(); }
    else if (d.a === 'bnew') { BUILD = null; draw(); }
    else if (d.rank) { const [i, p] = d.rank.split(':').map(Number); BUILD.rank = BUILD.rank.filter(x => x !== i); while (BUILD.rank.length < p) BUILD.rank.push(-1); BUILD.rank[p] = i; BUILD.rank = BUILD.rank.map(x => x == null ? -1 : x); draw(); }
    else if (d.full) fullView(+d.full);
    else if (d.a === 'reveal') { BUILD.revealed = true; const ranking = BUILD.rank.filter(x => x >= 0).map(i => BUILD.entries[i].model); await save({ type: 'build', at: BUILD.at, challenge: BUILD.challenge, ranking, entries: BUILD.entries.map(x => ({ model: x.model, ms: x.ms, size: x.html.length })) }); draw(); }
    else if (d.dp) root.querySelector('#oldp').value = d.dp;
    else if (d.a === 'duel') { const p = root.querySelector('#oldp').value.trim(); if (!p) return A.toast('Pick or type a prompt.'); startDuel(p); draw(); }
    else if (d.pick) { DUEL.winner = DUEL.entries[+d.pick].label; DUEL.revealed = true; await save({ type: 'duel', at: DUEL.at, prompt: DUEL.prompt, winner: DUEL.winner, times: DUEL.entries.map(x => x.label + ' ' + Math.round(x.ms / 1000) + 's') }); draw(); }
    else if (d.a === 'dnew') { DUEL = null; draw(); }
  }

  /* the level cards the Run page shows */
  function levelPicker() {
    return '<div class="ollevels">' + LEVELS.map((l, i) => '<label class="ollev" data-lv="' + l.id + '"><input type="radio" name="ollv" value="' + l.id + '"' + (i === 0 ? ' checked' : '') + '><span class="ollv-i">' + l.icon + '</span><span class="ollv-t"><b>' + esc(l.name) + '</b><span class="small mute">' + esc(l.blurb) + '</span><span class="small">' + (l.clock ? l.clock + ' s a question' : 'untimed') + ' · up to ' + Math.max(...Object.values(l.n)) + ' items an event</span></span></label>').join('') + '</div>';
  }

  A.olympics = { render, EVENTS, LEVELS, ask, models, medals, runCode, _t: { REASON, INSTR, CODE, KNOW, CYBER, SEARCH, POOL, HARD, take, LEVELS } };
})();

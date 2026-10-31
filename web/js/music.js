// Theme songs for every game, synthesised live (nothing to download). A small sequencer + synth: each game has its own key, mode, tempo, chord progression,
// instruments, bass line and drum groove. The melody is composed from the chords with a fixed seed per game, so a game always has the same theme:
// an 8-bar tune in the shape A (statement) - A' (answer, half cadence) - B (higher contrast) - A'' (return, leads back to the start so the loop is seamless).
// Controls: A.music.on / A.music.vol (keys mx_on, mx_vol). The game player (play.js) calls A.music.play(id) and A.music.stop().
(() => {
  const SC = { maj: [0, 2, 4, 5, 7, 9, 11], min: [0, 2, 3, 5, 7, 8, 10], dor: [0, 2, 3, 5, 7, 9, 10], mix: [0, 2, 4, 5, 7, 9, 10], phr: [0, 1, 3, 5, 7, 8, 10], lyd: [0, 2, 4, 6, 7, 9, 11], hmin: [0, 2, 3, 5, 7, 8, 11], pmaj: [0, 2, 4, 7, 9], pmin: [0, 3, 5, 7, 10], blues: [0, 3, 5, 6, 7, 10], hira: [0, 2, 3, 7, 8], insen: [0, 1, 5, 7, 10] };
  const CH = { pmaj: 'maj', pmin: 'min', blues: 'min', hira: 'min', insen: 'phr' };
  const KEY = { C: 0, 'C#': 1, D: 2, Eb: 3, E: 4, F: 5, 'F#': 6, G: 7, Ab: 8, A: 9, Bb: 10, B: 11 };
  const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
  const NOTE = n => ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'][n % 12] + (Math.floor(n / 12) - 1);

  /* ---------- drum grooves (16 steps per bar; 12 for 3/4). x = hit ---------- */
  const DR = {
    chip: { k: 'x...x...x...x...', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.' },
    four: { k: 'x...x...x...x...', h: '..x...x...x...x.', c: '....x.......x...' },
    funk: { k: 'x..x..x...x..x..', s: '....x..x.x..x...', h: 'x.xxx.xxx.xxx.xx', o: '..............x.' },
    synth: { k: 'x...x...x...x...', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.', c: '............x...' },
    lofi: { k: 'x.....x...x.....', s: '....x.......x...', h: 'x.x.x.x.x.x.x.xx', r: '..............x.' },
    jazz: { k: 'x.......x.......', h: 'x..xx..xx..xx..x', r: '....x.......x...' },
    brush: { k: 'x...............', s: '....x.x.....x.x.', h: 'x.xxx.xxx.xxx.xx' },
    march: { k: 'x.......x.......', s: 'x.x.x.x.x.x.xxxx', t: '..............x.' },
    polka: { k: 'x...x...x...x...', s: '..x...x...x...x.', h: 'x.x.x.x.x.x.x.x.' },
    pop: { k: 'x.....x...x.....', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.', c: '....x.......x...' },
    punk: { k: 'x.x...x.x.x...x.', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.', o: '..x...........x.' },
    bossa: { k: 'x..x..x.x..x..x.', r: '..x..x..x..x..x.', sh: 'x.x.x.x.x.x.x.x.' },
    taiko: { k: 'x.....x...x.....', t: '..x.........x.x.', w: '..x...x...x...x.' },
    tense: { k: 'x.......x.......', h: '..x...x...x...x.', r: '...............x' },
    pulse: { k: 'x..x....x..x....', h: 'x.x.x.x.x.x.x.x.' },
    baroque: { },
    none: { },
    waltz: { k: 'x.....x.....', h: '..x...x...x.' },
  };

  /* ---------- the tracks ---------- */
  // lead: { i: instrument, rng: [lo, hi], feel, seed, vol, pan, dl: delay send, rv: reverb send }, arp/bass/pad/drums as parts; ch7 = use seventh chords; sw = swing
  const T = {
    snake: { name: 'Slither', key: 'A', sc: 'min', bpm: 142, prog: [1, 6, 3, 7], lead: { i: 'sq', rng: [69, 88], feel: 'dense', seed: 11, vol: .3, dl: .18 }, arp: { i: 'sq', pat: '1.3.5.3.1.3.5.3.', oct: 4, vol: .11 }, bass: { i: 'tri', pat: '1.1.1.8.1.1.5.8.', oct: 2, vol: .42 }, drums: 'chip', dv: .8, rv: .06 },
    '2048': { name: 'Lo-fi Sum', key: 'C', sc: 'maj', bpm: 76, sw: .3, prog: [1, 6, 4, 5], ch7: 1, lead: { i: 'ep', rng: [67, 84], feel: 'sparse', seed: 23, vol: .3, dl: .25, rv: .3 }, arp: { i: 'ep', pat: '.1..2..3..4..2..', oct: 4, vol: .12, rv: .3 }, bass: { i: 'sub', pat: '1.....5.1.....3.', oct: 2, vol: .5 }, pad: { i: 'pad', vol: .08 }, drums: 'lofi', dv: .55, rv: .25 },
    memory: { name: 'Music Box Lullaby', key: 'F', sc: 'maj', bpm: 84, meter: 3, prog: [1, 5, 6, 4], lead: { i: 'box', rng: [72, 93], feel: 'lyrical', seed: 31, vol: .3, dl: .3, rv: .4 }, arp: { i: 'box', pat: '1.3.5.', oct: 5, vol: .12, rv: .4 }, bass: { i: 'harp', pat: '1.....', oct: 2, vol: .3 }, pad: { i: 'strings', vol: .07 }, drums: 'none', rv: .35 },
    connect4: { name: 'Four in a Funk', key: 'D', sc: 'dor', bpm: 106, prog: [1, 4, 1, 5], ch7: 1, lead: { i: 'brass', rng: [62, 80], feel: 'sync', seed: 41, vol: .26, rv: .12 }, arp: { i: 'clav', pat: '..c..c..c.c..c..', oct: 4, vol: .16 }, bass: { i: 'bass', pat: '1..1..8.1.5..1.3', oct: 2, vol: .5 }, drums: 'funk', dv: .75, rv: .1 },
    breakout: { name: 'Neon Bricks', key: 'E', sc: 'min', bpm: 126, prog: [1, 6, 3, 7], lead: { i: 'super', rng: [64, 88], feel: 'dotted', seed: 51, vol: .27, dl: .35, rv: .25 }, arp: { i: 'pluck', pat: '1.3.5.3.1.3.5.8.', oct: 4, vol: .12, dl: .2 }, bass: { i: 'bass', pat: '1.1.1.1.1.1.1.1.', oct: 1, vol: .45 }, pad: { i: 'pad', vol: .1 }, pump: 1, drums: 'synth', dv: .75, rv: .22 },
    mines: { name: 'Tick Tick', key: 'F#', sc: 'phr', bpm: 88, prog: [1, 2, 1, 7], lead: { i: 'celesta', rng: [75, 96], feel: 'sparse', seed: 61, vol: .2, dl: .4, rv: .45 }, arp: { i: 'marimba', pat: '.1....3.....5...', oct: 4, vol: .15, rv: .3 }, bass: { i: 'sub', pat: '1...............', oct: 1, vol: .5 }, pad: { i: 'drone', vol: .09 }, drums: 'tense', dv: .5, rv: .35 },
    sudoku: { name: 'Quiet Logic', key: 'G', sc: 'maj', bpm: 72, prog: [1, 5, 6, 4], lead: { i: 'piano', rng: [67, 86], feel: 'lyrical', seed: 71, vol: .3, rv: .32 }, arp: { i: 'piano', pat: '1.2.3.2.1.2.3.5.', oct: 3, vol: .14, rv: .32 }, bass: { i: 'sub', pat: '1.......5.......', oct: 2, vol: .4 }, drums: 'none', rv: .3 },
    wordguess: { name: 'Cafe Crossword', key: 'Bb', sc: 'maj', bpm: 120, sw: .33, prog: [1, 6, 2, 5], ch7: 1, lead: { i: 'flute', rng: [70, 90], feel: 'sync', seed: 81, vol: .26, rv: .22 }, arp: { i: 'ep', pat: '..c.....c..c....', oct: 4, vol: .13, rv: .22 }, bass: { i: 'bass', pat: '1..51..31..51..8', oct: 2, vol: .42 }, drums: 'jazz', dv: .5, rv: .18 },
    tetris: { name: 'Falling Blocks Dance', key: 'E', sc: 'hmin', bpm: 150, prog: [1, 4, 1, 5], lead: { i: 'accordion', rng: [64, 86], feel: 'dotted', seed: 91, vol: .3, rv: .1 }, arp: { i: 'accordion', pat: '..c...c...c...c.', oct: 4, vol: .1 }, bass: { i: 'bass', pat: '1...5...1...5...', oct: 2, vol: .45 }, drums: 'polka', dv: .6, rv: .1 },
    tictactoe: { name: 'Pizzicato Pals', key: 'C', sc: 'maj', bpm: 116, prog: [1, 4, 5, 1], lead: { i: 'pizz', rng: [67, 88], feel: 'sparse', seed: 101, vol: .32, rv: .15 }, arp: { i: 'marimba', pat: '..3...5...3...5.', oct: 4, vol: .14 }, bass: { i: 'pizz', pat: '1...5...1...5...', oct: 2, vol: .38 }, drums: 'none', rv: .15 },
    checkers: { name: 'Parlour Rag', key: 'F', sc: 'maj', bpm: 118, prog: [1, 1, 4, 5], lead: { i: 'honky', rng: [65, 88], feel: 'sync', seed: 111, vol: .32, rv: .12 }, arp: { i: 'honky', pat: '..c...c...c...c.', oct: 3, vol: .13, rv: .12 }, bass: { i: 'pizz', pat: '1...5...1...5...', oct: 2, vol: .4 }, drums: 'none', rv: .12 },
    othello: { name: 'Stone and Water', key: 'D', sc: 'hira', bpm: 78, prog: [1, 3, 4, 1], lead: { i: 'shaku', rng: [62, 86], feel: 'lyrical', seed: 121, vol: .28, dl: .2, rv: .38 }, arp: { i: 'koto', pat: '1...3...5...3...', oct: 4, vol: .2, rv: .35 }, bass: { i: 'sub', pat: '1...............', oct: 2, vol: .35 }, drums: 'taiko', dv: .4, rv: .35 },
    battleship: { name: 'Fleet Command', key: 'C', sc: 'min', bpm: 96, prog: [1, 4, 1, 5], lead: { i: 'horn', rng: [55, 77], feel: 'dotted', seed: 131, vol: .3, rv: .3 }, arp: { i: 'tri', pat: '1..1..1..1..1..1', oct: 3, vol: .1 }, bass: { i: 'bass', pat: '1.......1.......', oct: 1, vol: .5 }, pad: { i: 'strings', vol: .1 }, drums: 'march', dv: .55, rv: .35 },
    mastermind: { name: 'Clockwork Sleuth', key: 'A', sc: 'dor', bpm: 104, prog: [1, 4, 1, 5], lead: { i: 'vibes', rng: [69, 91], feel: 'sync', seed: 141, vol: .27, dl: .2, rv: .28 }, arp: { i: 'pizz', pat: '1.3.5.3.1.3.5.7.', oct: 3, vol: .14 }, bass: { i: 'pizz', pat: '1.5.1.5.1.5.1.5.', oct: 2, vol: .36 }, drums: 'tense', dv: .35, rv: .25 },
    hangman: { name: 'Gallows Hall', key: 'D', sc: 'hmin', bpm: 80, prog: [1, 4, 5, 1], lead: { i: 'organ', rng: [57, 79], feel: 'lyrical', seed: 151, vol: .22, rv: .45 }, arp: { i: 'harpsi', pat: '1.3.5.3.1.3.5.3.', oct: 4, vol: .15, rv: .35 }, bass: { i: 'organ', pat: '1.......5.......', oct: 1, vol: .3 }, pad: { i: 'strings', vol: .1 }, drums: 'none', rv: .45 },
    pong: { name: 'Bleep Rally', key: 'G', sc: 'maj', bpm: 120, prog: [1, 1, 4, 5], lead: { i: 'sq', rng: [67, 88], feel: 'sparse', seed: 161, vol: .22 }, arp: { i: 'tri', pat: '1...5...1...5...', oct: 3, vol: .14 }, bass: { i: 'tri', pat: '1...............', oct: 2, vol: .3 }, drums: 'chip', dv: .45, rv: .03 },
    flap: { name: 'Little Wings', key: 'D', sc: 'maj', bpm: 132, prog: [1, 5, 6, 4], lead: { i: 'whistle', rng: [74, 93], feel: 'dense', seed: 171, vol: .24, rv: .22 }, arp: { i: 'uke', pat: '..c...c...c...c.', oct: 4, vol: .15 }, bass: { i: 'pluckb', pat: '1.......5.......', oct: 2, vol: .4 }, drums: 'pop', dv: .55, rv: .18 },
    slide: { name: 'Drifting Tiles', key: 'Ab', sc: 'lyd', bpm: 66, prog: [1, 2, 1, 5], lead: { i: 'bell', rng: [72, 96], feel: 'lyrical', seed: 181, vol: .2, dl: .4, rv: .55 }, bass: { i: 'sub', pat: '1...............', oct: 1, vol: .4 }, pad: { i: 'pad', vol: .13 }, drums: 'none', rv: .55 },
    lights: { name: 'Switchboard', key: 'C', sc: 'min', bpm: 126, prog: [1, 1, 6, 7], lead: { i: 'pluck', rng: [67, 86], feel: 'dotted', seed: 191, vol: .2, dl: .3, rv: .2 }, arp: { i: 'acid', pat: '1.1.8.1.1.1.8.5.', oct: 2, vol: .3 }, pad: { i: 'pad', vol: .06 }, pump: 1, drums: 'four', dv: .85, rv: .18 },
    simon: { name: 'Say It Back', key: 'C', sc: 'maj', bpm: 96, prog: [1, 4, 5, 1], bass: { i: 'tri', pat: '1.......5.......', oct: 2, vol: .22 }, pad: { i: 'pad', vol: .07 }, arp: { i: 'bell', pat: '.....3.....5....', oct: 4, vol: .06, rv: .4 }, drums: 'none', mix: .45, rv: .3 },
    whack: { name: 'Carnival Mole', key: 'A', sc: 'maj', bpm: 144, prog: [1, 4, 1, 5], lead: { i: 'calliope', rng: [69, 91], feel: 'dense', seed: 211, vol: .26, rv: .15 }, arp: { i: 'calliope', pat: '..c...c...c...c.', oct: 3, vol: .1 }, bass: { i: 'tuba', pat: '1...5...1...5...', oct: 1, vol: .45 }, drums: 'polka', dv: .65, rv: .15 },
    reaction: { name: 'Hair Trigger', key: 'E', sc: 'phr', bpm: 112, prog: [1, 1, 2, 1], lead: { i: 'pluck', rng: [64, 82], feel: 'sparse', seed: 221, vol: .18, dl: .35, rv: .25 }, arp: { i: 'sub', pat: '1...1...1...1...', oct: 2, vol: .3 }, pad: { i: 'drone', vol: .08 }, drums: 'pulse', dv: .45, rv: .22 },
    typing: { name: 'Words Per Minute', key: 'D', sc: 'maj', bpm: 156, prog: [1, 5, 6, 4], lead: { i: 'guitar', rng: [62, 86], feel: 'dense', seed: 231, vol: .26, rv: .15 }, arp: { i: 'power', pat: 'c.cc.cc.c.cc.cc.', oct: 3, vol: .12 }, bass: { i: 'bass', pat: '1.1.1.1.1.1.1.1.', oct: 2, vol: .42 }, drums: 'punk', dv: .8, rv: .12 },
    chess: { name: 'Quiet Pawn', key: 'D', sc: 'maj', bpm: 56, meter: 3, ch7: 1, rub: .045, drift: .025, noIntroHook: 1, form: [['A', 8], ['B', 8], ['A2', 8]], prog: [1, 4, 1, 4, 6, 5, 4, 1], progB: [2, 5, 1, 6, 4, 3, 2, 5],
      melodyA: ['3 - 5 - 3 -', '6 - 4 - 3 -', '1 - 3 - 5 -', "6 - 1' - 6 -", "1' - 6 - 5 -", '5 - 7 - 5 -', "4 - 6 - 1' -", '7 - 5 - 3 -'],
      melodyB: ["2' - 1' - 6 -", "5 - 7 - 2' -", "3' - 2' - 1' -", "6 - 1' - 3' -", "4' - 3' - 1' -", '7 - 5 - 3 -', '2 - 4 - 6 -', "5 - 7 - 2' -"],
      lead: { i: 'grand', oct: 2, rng: [62, 86], feel: 'lyrical', seed: 241, vol: .34, rv: .5 }, arp: { i: 'grand', pat: '..1.3.5.3.5.', oct: 3, vol: .11, rv: .5 }, bass: { i: 'grand', pat: '1...........', oct: 2, vol: .3 }, pad: { i: 'strings', vol: .05 }, drums: 'none', rv: .5 },
    cipher: { name: 'Hidden Meaning', key: 'B', sc: 'min', bpm: 98, prog: [1, 6, 1, 7], lead: { i: 'celesta', rng: [71, 93], feel: 'dotted', seed: 251, vol: .24, dl: .35, rv: .4 }, arp: { i: 'marimba', pat: '1.3.5.3.1.3.5.7.', oct: 4, vol: .14, rv: .3 }, bass: { i: 'cello', pat: '1.......1.......', oct: 1, vol: .3 }, pad: { i: 'strings', vol: .11 }, drums: 'tense', dv: .35, rv: .35 },
    terminal: { name: 'Root Shell', key: 'E', sc: 'min', bpm: 100, prog: [1, 1, 6, 5], lead: { i: 'blip', rng: [64, 84], feel: 'sync', seed: 261, vol: .17, dl: .4, rv: .2 }, arp: { i: 'pluck', pat: '1.1.5.1.1.3.5.8.', oct: 3, vol: .15, dl: .25 }, bass: { i: 'bass', pat: '1...1..1....1...', oct: 1, vol: .48 }, pad: { i: 'drone', vol: .1 }, pump: 1, drums: 'pulse', dv: .6, rv: .2 },
    sqldojo: { name: 'Quiet Injection', key: 'A', sc: 'insen', bpm: 112, prog: [1, 5, 1, 4], lead: { i: 'koto', rng: [64, 88], feel: 'sync', seed: 271, vol: .3, rv: .25 }, arp: { i: 'koto', pat: '1.1.3.1.5.1.3.1.', oct: 3, vol: .12, rv: .25 }, bass: { i: 'sub', pat: '1..1....1..1....', oct: 1, vol: .45 }, drums: 'taiko', dv: .7, rv: .22 },
    phish: { name: 'Something Fishy', key: 'F', sc: 'hmin', bpm: 86, sw: .2, prog: [1, 4, 5, 1], lead: { i: 'bassoon', rng: [55, 76], feel: 'sync', seed: 281, vol: .28, rv: .25 }, arp: { i: 'pizz', pat: '..1.3.5.3.1.3...', oct: 4, vol: .14 }, bass: { i: 'pizz', pat: '1...5...1...5...', oct: 2, vol: .36 }, pad: { i: 'strings', vol: .12 }, drums: 'tense', dv: .3, rv: .3 },
    netninja: { name: 'Bossa Packets', key: 'C', sc: 'maj', bpm: 118, prog: [2, 5, 1, 6], ch7: 1, lead: { i: 'nylon', rng: [64, 86], feel: 'sync', seed: 291, vol: .28, rv: .22 }, arp: { i: 'nylon', pat: '..c...c...c..c..', oct: 3, vol: .12, rv: .22 }, bass: { i: 'pluckb', pat: '1.....5.1.....5.', oct: 2, vol: .4 }, drums: 'bossa', dv: .5, rv: .2 },
    logs: { name: 'Night Shift Blues', key: 'F#', sc: 'blues', bpm: 74, sw: .3, prog: [1, 1, 4, 1], ch7: 1, lead: { i: 'sax', rng: [58, 80], feel: 'lyrical', seed: 301, vol: .26, rv: .3 }, arp: { i: 'ep', pat: '..c.....c..c....', oct: 3, vol: .12, rv: .28 }, bass: { i: 'bass', pat: '1..5..1.3..5..1.', oct: 1, vol: .42 }, drums: 'brush', dv: .42, rv: .28 },
  };

  /* ---------- audio graph ---------- */
  let ac = null, master = null, rvBus = null, dlBus = null, dlNode = null, comp = null, player = null, duckT = 0, lastOn = null;
  const getOn = () => ls.get('mx_on', '1') !== '0', getVol = () => Math.max(0, Math.min(100, +ls.get('mx_vol', '45')));
  const ensure = forced => {
    if (ac && !forced) { if (ac.state === 'suspended') ac.resume(); return ac; }
    try { ac = forced || new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; }
    comp = ac.createDynamicsCompressor(); comp.threshold.value = -18; comp.knee.value = 24; comp.ratio.value = 4; comp.attack.value = .01; comp.release.value = .25; comp.connect(ac.destination);
    master = ac.createGain(); master.gain.value = 0; master.connect(comp);
    // reverb: generated impulse (stereo noise with a smooth exponential tail)
    const len = Math.floor(ac.sampleRate * 2.4), ir = ac.createBuffer(2, len, ac.sampleRate); for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); let lp = 0; for (let i = 0; i < len; i++) { const e = Math.pow(1 - i / len, 2.6); lp += (((Math.random() * 2 - 1) * e) - lp) * (.25 + .5 * (i / len)); d[i] = lp * 1.8; } }
    const cv = ac.createConvolver(); cv.buffer = ir; rvBus = ac.createGain(); rvBus.gain.value = .9; rvBus.connect(cv); const rvOut = ac.createGain(); rvOut.gain.value = .55; cv.connect(rvOut); rvOut.connect(master);
    dlBus = ac.createGain(); const dl = ac.createDelay(1.5); dl.delayTime.value = .375; const fb = ac.createGain(); fb.gain.value = .32; const lpf = ac.createBiquadFilter(); lpf.type = 'lowpass'; lpf.frequency.value = 2600; dlNode = dl; dlBus.connect(dl); dl.connect(lpf); lpf.connect(fb); fb.connect(dl); lpf.connect(master);
    if (!forced) document.addEventListener('visibilitychange', () => { if (!ac || ac.suspend === undefined) return; if (document.hidden) ac.suspend(); else if (player) ac.resume(); });
    return ac;
  };
  const LEVEL = { snake: 1, '2048': .72, memory: 3, connect4: 1.05, breakout: 1.1, mines: 1.3, sudoku: 1.2, wordguess: 1.05, tetris: 1.05, tictactoe: 2.7, checkers: 2.2, othello: 1.45, battleship: 1.2, mastermind: 2.35, hangman: 2.6, pong: 2.6, flap: 1.4, slide: 1.45, lights: 2.1, simon: 2.5, whack: 1.05, reaction: 1.5, typing: 1.1, chess: .88, cipher: 2.25, terminal: 1.25, sqldojo: .72, phish: 1.3, netninja: 1, logs: 1.1 };      // measured with the offline renderer so every theme sits at about the same loudness
  const outGain = id => getVol() / 100 * .8 * (LEVEL[id || (player && player.id)] || 1);

  /* ---------- synth voices ---------- */
  const env = (g, t, a, d, s, r, peak, dur) => { g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(.0002, peak), t + a); g.gain.exponentialRampToValueAtTime(Math.max(.0002, peak * s), t + a + d); g.gain.setValueAtTime(Math.max(.0002, peak * s), t + Math.max(a + d, dur)); g.gain.exponentialRampToValueAtTime(.0001, t + Math.max(a + d, dur) + r); return t + Math.max(a + d, dur) + r; };
  const osc = (type, f, t, end, det) => { const o = ac.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t); if (det) o.detune.value = det; o.start(t); o.stop(end + .05); return o; };
  const lp = (f, q) => { const x = ac.createBiquadFilter(); x.type = 'lowpass'; x.frequency.value = f; x.Q.value = q || .7; return x; };
  const vib = (o, t, rate, depth, delay) => { const l = ac.createOscillator(), g = ac.createGain(); l.frequency.value = rate; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(depth, t + (delay || .15)); l.connect(g); g.connect(o.frequency); l.start(t); l.stop(t + 6); };
  // each voice: (t, midi, dur, vel, dest)
  const V = {
    sq: (t, m, d, v, o) => { const f = mtof(m), g = ac.createGain(), x = lp(4200), e = env(g, t, .004, .08, .55, .05, v * .5, d); osc('square', f, t, e).connect(x); x.connect(g); g.connect(o); },
    tri: (t, m, d, v, o) => { const g = ac.createGain(), e = env(g, t, .006, .1, .75, .06, v * .9, d); osc('triangle', mtof(m), t, e).connect(g); g.connect(o); },
    sub: (t, m, d, v, o) => { const g = ac.createGain(), e = env(g, t, .01, .1, .8, .1, v, d); osc('sine', mtof(m), t, e).connect(g); const h = ac.createGain(); h.gain.value = .25; osc('triangle', mtof(m), t, e).connect(h); h.connect(g); g.connect(o); },
    bass: (t, m, d, v, o) => { const g = ac.createGain(), x = lp(520, 1.2), e = env(g, t, .006, .12, .5, .06, v * .8, Math.min(d, .5)); x.frequency.setValueAtTime(1100, t); x.frequency.exponentialRampToValueAtTime(260, t + .18); osc('sawtooth', mtof(m), t, e).connect(x); osc('sine', mtof(m - 12), t, e).connect(x); x.connect(g); g.connect(o); },
    pluckb: (t, m, d, v, o) => { const g = ac.createGain(), x = lp(900), e = env(g, t, .004, .35, .1, .12, v, .2); osc('triangle', mtof(m), t, e).connect(x); osc('sine', mtof(m), t, e).connect(x); x.connect(g); g.connect(o); },
    acid: (t, m, d, v, o) => { const g = ac.createGain(), x = lp(500, 9), e = env(g, t, .003, .1, .3, .04, v * .7, .12); x.frequency.setValueAtTime(2400, t); x.frequency.exponentialRampToValueAtTime(200, t + .16); osc('sawtooth', mtof(m), t, e).connect(x); x.connect(g); g.connect(o); },
    pad: (t, m, d, v, o) => { const g = ac.createGain(), x = lp(1100, .5), e = env(g, t, .5, .3, .8, 1.1, v * .35, d); [-9, 0, 9].forEach(c => osc('sawtooth', mtof(m), t, e, c).connect(x)); x.connect(g); g.connect(o); },
    strings: (t, m, d, v, o) => { const g = ac.createGain(), x = lp(1700, .4), e = env(g, t, .42, .3, .85, .9, v * .3, d); [-6, 6].forEach(c => { const s = osc('sawtooth', mtof(m), t, e, c); vib(s, t, 5.2, 3, .6); s.connect(x); }); x.connect(g); g.connect(o); },
    drone: (t, m, d, v, o) => { const g = ac.createGain(), x = lp(420), e = env(g, t, .9, .3, .9, 1.4, v * .5, d); [-7, 0, 7].forEach(c => osc('sawtooth', mtof(m - 12), t, e, c).connect(x)); x.connect(g); g.connect(o); },
    pluck: (t, m, d, v, o) => { const g = ac.createGain(), x = lp(600, 2), e = env(g, t, .002, .22, .08, .08, v * .6, .12); x.frequency.setValueAtTime(4200, t); x.frequency.exponentialRampToValueAtTime(500, t + .2); osc('sawtooth', mtof(m), t, e).connect(x); x.connect(g); g.connect(o); },
    super: (t, m, d, v, o) => { const g = ac.createGain(), x = lp(3400), e = env(g, t, .01, .14, .6, .12, v * .35, d); [-14, -5, 5, 14].forEach(c => osc('sawtooth', mtof(m), t, e, c).connect(x)); x.connect(g); g.connect(o); },
    blip: (t, m, d, v, o) => { const g = ac.createGain(), e = env(g, t, .002, .05, .2, .05, v * .5, .06); osc('square', mtof(m), t, e).connect(lp(3000)).connect(g); g.connect(o); },
    bell: (t, m, d, v, o) => { const g = ac.createGain(), e = env(g, t, .004, 1.6, .01, .4, v * .55, .1); osc('sine', mtof(m), t, e).connect(g); const h = ac.createGain(); h.gain.value = .28; osc('sine', mtof(m) * 2.76, t, e).connect(h); h.connect(g); const k = ac.createGain(); k.gain.value = .12; osc('sine', mtof(m) * 5.4, t, e).connect(k); k.connect(g); g.connect(o); },
    box: (t, m, d, v, o) => { const g = ac.createGain(), e = env(g, t, .003, .5, .02, .15, v * .5, .05); osc('sine', mtof(m), t, e).connect(g); const h = ac.createGain(); h.gain.value = .35; osc('sine', mtof(m) * 4.01, t, e).connect(h); h.connect(g); g.connect(o); },
    celesta: (t, m, d, v, o) => { const g = ac.createGain(), e = env(g, t, .003, .9, .02, .25, v * .5, .05); osc('sine', mtof(m), t, e).connect(g); const h = ac.createGain(); h.gain.value = .3; osc('sine', mtof(m) * 3, t, e).connect(h); h.connect(g); g.connect(o); },
    vibes: (t, m, d, v, o) => { const g = ac.createGain(), e = env(g, t, .004, 1.2, .02, .3, v * .55, .1); const s = osc('sine', mtof(m), t, e); const tr = ac.createGain(); tr.gain.value = .85; const l = ac.createOscillator(), lg = ac.createGain(); l.frequency.value = 5.5; lg.gain.value = .15; l.connect(lg); lg.connect(tr.gain); l.start(t); l.stop(e + .1); s.connect(tr); tr.connect(g); const h = ac.createGain(); h.gain.value = .2; osc('sine', mtof(m) * 4, t, e).connect(h); h.connect(g); g.connect(o); },
    marimba: (t, m, d, v, o) => { const g = ac.createGain(), e = env(g, t, .002, .35, .02, .1, v * .7, .04); osc('sine', mtof(m), t, e).connect(g); const h = ac.createGain(); h.gain.value = .4; osc('sine', mtof(m) * 4, t, e - .2).connect(h); h.connect(g); g.connect(o); },
    ep: (t, m, d, v, o) => { const f = mtof(m), g = ac.createGain(), e = env(g, t, .004, .9, .15, .25, v * .55, d * .8); const c = osc('sine', f, t, e), md = osc('sine', f, t, e), mg = ac.createGain(); mg.gain.setValueAtTime(f * 1.6, t); mg.gain.exponentialRampToValueAtTime(f * .05, t + .5); md.connect(mg); mg.connect(c.frequency); c.connect(g); g.connect(o); },
    piano: (t, m, d, v, o) => { const f = mtof(m), g = ac.createGain(), x = lp(Math.min(7000, f * 7), .5), e = env(g, t, .003, 1.1, .06, .25, v * .6, d * .6); [1, 2, 3, 4].forEach((k, i) => { const h = ac.createGain(); h.gain.value = [1, .45, .2, .08][i]; osc(i ? 'sine' : 'triangle', f * k * (i ? 1.0008 : 1), t, e).connect(h); h.connect(x); }); x.connect(g); g.connect(o); },
    grand: (t, m, d, v, o) => { const f = mtof(m), g = ac.createGain(), x = lp(Math.min(9000, f * 6 + 900), .4), e = env(g, t, .004, 2.6, .05, .9, v * .8, Math.min(d, 1.4)); [[1, 1], [2, .42], [3, .22], [4, .11], [5, .05], [6, .03]].forEach(([k, a], i) => { const h = ac.createGain(); h.gain.value = a / (1 + (f / 900) * (k - 1) * .15); osc(i ? 'sine' : 'triangle', f * k * (1 + .0004 * k * k), t, e).connect(h); h.connect(x); if (i === 0) { const h2 = ac.createGain(); h2.gain.value = .35; osc('sine', f * 1.0012, t, e).connect(h2); h2.connect(x); } }); nz(t, .03, 'lowpass', Math.min(2500, f * 3), .7, v * .16, o); x.connect(g); g.connect(o); },
    honky: (t, m, d, v, o) => { const f = mtof(m), g = ac.createGain(), x = lp(5200), e = env(g, t, .002, .5, .05, .15, v * .55, .1); osc('triangle', f, t, e).connect(x); osc('triangle', f * 1.012, t, e).connect(x); osc('sine', f * 2, t, e).connect(x); x.connect(g); g.connect(o); },
    organ: (t, m, d, v, o) => { const f = mtof(m), g = ac.createGain(), e = env(g, t, .02, .05, .9, .12, v * .35, d); [1, 2, 3, 4, 6].forEach((k, i) => { const h = ac.createGain(); h.gain.value = [1, .6, .35, .3, .15][i]; osc('sine', f * k, t, e).connect(h); h.connect(g); }); g.connect(o); },
    harpsi: (t, m, d, v, o) => { const f = mtof(m), g = ac.createGain(), x = lp(5200), e = env(g, t, .002, .35, .03, .1, v * .5, .05); osc('sawtooth', f, t, e).connect(x); osc('sawtooth', f * 2.003, t, e).connect(x); x.connect(g); g.connect(o); },
    cello: (t, m, d, v, o) => { const g = ac.createGain(), x = lp(1400), e = env(g, t, .09, .2, .8, .25, v * .6, d); const s = osc('sawtooth', mtof(m), t, e); vib(s, t, 5.3, 4, .3); s.connect(x); osc('sawtooth', mtof(m) * 1.003, t, e).connect(x); x.connect(g); g.connect(o); },
    flute: (t, m, d, v, o) => { const g = ac.createGain(), e = env(g, t, .05, .1, .85, .12, v * .45, d); const s = osc('sine', mtof(m), t, e); vib(s, t, 5.2, 5, .25); s.connect(g); const h = ac.createGain(); h.gain.value = .12; osc('sine', mtof(m) * 2, t, e).connect(h); h.connect(g); g.connect(o); },
    shaku: (t, m, d, v, o) => { const g = ac.createGain(), x = lp(2800), e = env(g, t, .09, .15, .8, .2, v * .45, d); const s = osc('sine', mtof(m), t, e); vib(s, t, 4.8, 9, .3); s.connect(x); const h = ac.createGain(); h.gain.value = .22; osc('triangle', mtof(m), t, e).connect(h); h.connect(x); x.connect(g); g.connect(o); },
    whistle: (t, m, d, v, o) => { const g = ac.createGain(), e = env(g, t, .03, .06, .8, .1, v * .4, d); const s = osc('sine', mtof(m), t, e); vib(s, t, 6, 7, .1); s.connect(g); g.connect(o); },
    koto: (t, m, d, v, o) => { const f = mtof(m), g = ac.createGain(), x = lp(3600), e = env(g, t, .002, .9, .03, .2, v * .6, .05); const s = osc('triangle', f, t, e); s.frequency.setValueAtTime(f * 1.02, t); s.frequency.exponentialRampToValueAtTime(f, t + .04); s.connect(x); osc('sine', f * 2, t, e - .5).connect(x); x.connect(g); g.connect(o); },
    harp: (t, m, d, v, o) => { const f = mtof(m), g = ac.createGain(), e = env(g, t, .003, .8, .03, .2, v * .55, .05); osc('triangle', f, t, e).connect(g); const h = ac.createGain(); h.gain.value = .3; osc('sine', f * 3, t, e - .5).connect(h); h.connect(g); g.connect(o); },
    brass: (t, m, d, v, o) => { const g = ac.createGain(), x = lp(700), e = env(g, t, .03, .1, .75, .1, v * .5, d * .8); x.frequency.setValueAtTime(500, t); x.frequency.linearRampToValueAtTime(2400, t + .08); osc('sawtooth', mtof(m), t, e).connect(x); osc('sawtooth', mtof(m) * 1.004, t, e).connect(x); x.connect(g); g.connect(o); },
    horn: (t, m, d, v, o) => { const g = ac.createGain(), x = lp(900), e = env(g, t, .08, .15, .8, .25, v * .55, d); x.frequency.setValueAtTime(400, t); x.frequency.linearRampToValueAtTime(1500, t + .2); osc('sawtooth', mtof(m), t, e).connect(x); osc('square', mtof(m) * .5, t, e).connect(x); x.connect(g); g.connect(o); },
    tuba: (t, m, d, v, o) => { const g = ac.createGain(), x = lp(520), e = env(g, t, .02, .08, .7, .06, v * .8, Math.min(d, .26)); osc('sawtooth', mtof(m), t, e).connect(x); osc('sine', mtof(m), t, e).connect(x); x.connect(g); g.connect(o); },
    accordion: (t, m, d, v, o) => { const g = ac.createGain(), x = lp(3000), e = env(g, t, .03, .08, .85, .08, v * .4, d); [0, 8, -8].forEach(c => osc('square', mtof(m), t, e, c).connect(x)); x.connect(g); g.connect(o); },
    calliope: (t, m, d, v, o) => { const g = ac.createGain(), x = lp(4200), e = env(g, t, .01, .05, .9, .06, v * .35, d * .8); const s = osc('square', mtof(m), t, e); vib(s, t, 5.8, 6, .1); s.connect(x); osc('sawtooth', mtof(m) * 2, t, e).connect(x); x.connect(g); g.connect(o); },
    pizz: (t, m, d, v, o) => { const f = mtof(m), g = ac.createGain(), x = lp(2400), e = env(g, t, .002, .16, .03, .06, v * .8, .03); osc('triangle', f, t, e).connect(x); osc('sawtooth', f, t, e).connect(x); x.connect(g); g.connect(o); },
    uke: (t, m, d, v, o) => { const f = mtof(m), g = ac.createGain(), x = lp(3000), e = env(g, t, .002, .3, .04, .1, v * .6, .05); osc('triangle', f, t, e).connect(x); osc('sine', f * 2, t, e).connect(x); x.connect(g); g.connect(o); },
    nylon: (t, m, d, v, o) => { const f = mtof(m), g = ac.createGain(), x = lp(2600), e = env(g, t, .003, .7, .04, .15, v * .55, .06); osc('triangle', f, t, e).connect(x); osc('sine', f * 3, t, e - .4).connect(x); x.connect(g); g.connect(o); },
    clav: (t, m, d, v, o) => { const f = mtof(m), g = ac.createGain(), x = ac.createBiquadFilter(); x.type = 'bandpass'; x.frequency.value = Math.min(4000, f * 4); x.Q.value = 1.5; const e = env(g, t, .002, .09, .02, .04, v * 1.1, .03); osc('square', f, t, e).connect(x); x.connect(g); g.connect(o); },
    guitar: (t, m, d, v, o) => { const f = mtof(m), g = ac.createGain(), x = lp(2800, 1.2), e = env(g, t, .004, .2, .5, .1, v * .5, d * .6); osc('sawtooth', f, t, e).connect(x); osc('sawtooth', f * 1.005, t, e).connect(x); x.connect(g); g.connect(o); },
    power: (t, m, d, v, o) => { const g = ac.createGain(), x = lp(1800, 1), e = env(g, t, .004, .1, .7, .08, v * .45, Math.min(d, .3)); [0, 7].forEach(s => { osc('sawtooth', mtof(m + s), t, e).connect(x); osc('sawtooth', mtof(m + s), t, e, 7).connect(x); }); x.connect(g); g.connect(o); },
    bassoon: (t, m, d, v, o) => { const g = ac.createGain(), x = lp(1000), e = env(g, t, .05, .12, .8, .15, v * .6, d); const s = osc('sawtooth', mtof(m), t, e); vib(s, t, 4.6, 5, .3); s.connect(x); osc('square', mtof(m), t, e).connect(x); x.connect(g); g.connect(o); },
    sax: (t, m, d, v, o) => { const g = ac.createGain(), x = lp(1800, .8), e = env(g, t, .05, .12, .8, .2, v * .55, d); x.frequency.setValueAtTime(900, t); x.frequency.linearRampToValueAtTime(2200, t + .1); const s = osc('sawtooth', mtof(m), t, e); vib(s, t, 5.3, 7, .25); s.connect(x); osc('square', mtof(m), t, e).connect(x); x.connect(g); g.connect(o); },
  };

  /* ---------- drums ---------- */
  let nbuf = null; const noiseBuf = () => { if (!nbuf) { nbuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate); const c = nbuf.getChannelData(0); for (let i = 0; i < c.length; i++) c[i] = Math.random() * 2 - 1; } return nbuf; };
  const nz = (t, d, type, f, q, v, o) => { const s = ac.createBufferSource(), x = ac.createBiquadFilter(), g = ac.createGain(); s.buffer = noiseBuf(); x.type = type; x.frequency.value = f; x.Q.value = q; g.gain.setValueAtTime(Math.max(.0002, v), t); g.gain.exponentialRampToValueAtTime(.0001, t + d); s.connect(x); x.connect(g); g.connect(o); s.start(t, Math.random() * .4); s.stop(t + d + .03); };
  const tn = (t, f0, f1, d, v, o, type) => { const g = ac.createGain(), os = osc(type || 'sine', f0, t, t + d); os.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + d); g.gain.setValueAtTime(Math.max(.0002, v), t); g.gain.exponentialRampToValueAtTime(.0001, t + d); os.connect(g); g.connect(o); };
  const DV = {
    k: (t, v, o, kit) => kit === 'chip' ? tn(t, 150, 40, .12, v * .9, o, 'square') : tn(t, 140, 42, .2, v * 1.1, o),
    s: (t, v, o, kit) => { if (kit === 'chip') { nz(t, .09, 'highpass', 2500, .5, v * .5, o); return; } nz(t, .14, 'bandpass', 1900, .7, v * .55, o); tn(t, 220, 140, .08, v * .4, o, 'triangle'); },
    c: (t, v, o) => { [0, .012, .024].forEach(x => nz(t + x, .07, 'bandpass', 1500, 1, v * .35, o)); nz(t + .03, .16, 'bandpass', 1500, 1, v * .3, o); },
    h: (t, v, o) => nz(t, .035, 'highpass', 7000, .6, v * .22, o),
    o: (t, v, o) => nz(t, .22, 'highpass', 6500, .6, v * .2, o),
    r: (t, v, o) => { tn(t, 1700, 1500, .03, v * .3, o, 'square'); nz(t, .02, 'highpass', 3000, 1, v * .15, o); },
    t: (t, v, o) => tn(t, 190, 90, .28, v * .8, o),
    w: (t, v, o) => { tn(t, 900, 800, .05, v * .5, o, 'triangle'); },
    sh: (t, v, o) => nz(t, .05, 'bandpass', 6500, 1.5, v * .18, o),
    x: (t, v, o) => { nz(t, 1.3, 'highpass', 5500, .5, v * .22, o); nz(t, .6, 'bandpass', 8000, .8, v * .12, o); },
  };

  /* ---------- composing (v2): a full arrangement, not a loop ---------- */
  const rngOf = seed => { let s = (seed * 2654435761) >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return (s % 100000) / 100000; }; };
  const FEEL = {
    8: { dense: [[0, 1, 2, 3, 4, 5, 6, 7], [0, 1, 2, 3, 4, 5, 7], [0, 2, 3, 4, 5, 6, 7]], sparse: [[0, 2, 4, 6], [0, 2, 4, 5, 6], [0, 3, 4, 6]], sync: [[0, 3, 4, 7], [0, 2, 3, 6], [0, 1, 4, 6, 7]], dotted: [[0, 3, 6], [0, 3, 4, 6], [0, 2, 3, 6]], lyrical: [[0, 4, 6], [0, 4], [0, 3, 4]] },
    6: { dense: [[0, 1, 2, 3, 4, 5], [0, 2, 3, 4, 5]], sparse: [[0, 2, 4], [0, 2, 3, 4]], sync: [[0, 3, 4], [0, 2, 4]], dotted: [[0, 3], [0, 3, 4]], lyrical: [[0, 3], [0, 2, 4]] },
  };
  const modeInfo = tr => { const sc = SC[tr.sc], cs = SC[CH[tr.sc] || tr.sc], root = 48 + KEY[tr.key]; return { sc, cs, root, minor: cs[2] === 3 }; };
  const chordPitches = (tr, deg, mi) => { const n = mi.cs.length, i0 = deg - 1, p = k => mi.root + mi.cs[(i0 + k) % n] + 12 * Math.floor((i0 + k) / n); return [p(0), p(2), p(4), tr.ch7 ? p(6) : p(0) + 12]; };
  const expand = (p, alt) => p.length >= 8 ? p.slice(0, 8) : p.concat(p.slice(0, p.length - 1), [alt]).slice(0, 8);
  const progs = (tr, mi) => { const A = expand(tr.prog, 5), B = tr.progB ? expand(tr.progB, 5) : (mi.minor ? [4, 6, 7, 1, 4, 3, 5, 5] : [6, 4, 1, 5, 6, 4, 2, 5]); return { A, B }; };
  const FORM = tr => tr.form || [['intro', 4], ['A', 8], ['B', 8], ['A2', 8], ['out', 4]];
  const MASK = { intro: { pad: 1, arp: .6, bass: 0, drums: 0, lead: 0, cm: 0, hat: 0 }, A: { pad: 1, arp: 1, bass: 1, drums: 1, lead: 1, cm: 0, hat: 0 }, B: { pad: 1, arp: 1.15, bass: 1, drums: 1.12, lead: 1, cm: 1, hat: 1 }, A2: { pad: 1, arp: 1.05, bass: 1, drums: 1.08, lead: 1, cm: 1, hat: 1 }, out: { pad: 1, arp: .55, bass: .6, drums: 0, lead: 0, cm: 0, hat: 0 } };

  /* hand-written melody: tokens are eighth notes. 1-7 scale degrees, ' = octave up, , = octave down, # b = sharp/flat, . = rest, - = hold */
  const parseMel = (bars, tr, mi, base, oct, spb) => {
    const out = []; const tpb = spb / 2;
    bars.forEach((line, b) => { const toks = line.trim().split(/\s+/); let last = null; toks.forEach((tk, i) => { if (tk === '.') { last = null; return; } if (tk === '-') { if (last) last.dur += 2; return; } const m = /^([#b]?)([1-7])([',]*)$/.exec(tk); if (!m) return; const n = mi.sc.length, di = (+m[2] - 1) % n, up = (m[3].match(/'/g) || []).length - (m[3].match(/,/g) || []).length; const acc = m[1] === '#' ? 1 : m[1] === 'b' ? -1 : 0; const note = mi.root + 12 * (oct - 1) + mi.sc[di] + acc + 12 * up; last = { step: base + b * spb + i * 2, note, dur: 2, bar: b, first: i === 0 }; out.push(last); }); });
    return out;
  };
  /* generated melody for 8 bars of chords: a question phrase (bars 1-4, ends on a half cadence) and an answer (bars 5-8), motif repeated and developed */
  const phrase = (tr, mi, chords, seed, feelName, lift, base, spb, lead, last) => {
    const tpb = spb / 2, lo = lead.rng[0] + lift, hi = lead.rng[1] + lift, pcOf = m => ((m - mi.root) % 12 + 12) % 12, scaleNotes = [];
    for (let m = lo; m <= hi; m++) if (mi.sc.includes(pcOf(m))) scaleNotes.push(m);
    const feels = FEEL[tpb][feelName] || FEEL[tpb].dense, strong = tpb === 8 ? [0, 4] : [0], medium = tpb === 8 ? [2, 6] : [2, 4];
    const nearest = (target, set) => set.reduce((a, b) => Math.abs(b - target) < Math.abs(a - target) ? b : a);
    const ton = scaleNotes.filter(m => pcOf(m) === 0), mid = lo + (hi - lo) * .45; let prev = nearest(mid, ton.length ? ton : scaleNotes);
    const second = mi.sc[1], leading = mi.sc[mi.sc.length - 1], fifth = mi.sc[Math.min(4, mi.sc.length - 1)], third = mi.sc[Math.min(2, mi.sc.length - 1)];
    const events = []; let dir = 1, rng = rngOf(seed);
    for (let b = 0; b < 8; b++) {
      if (b % 2 === 0) { rng = rngOf(seed + (b >= 4 ? 0 : 0) + (b % 4) * 13 + (b >= 4 ? 5 : 0)); dir = b >= 4 ? -1 : 1; }
      const ch = chords[b], cp = chordPitches(tr, ch, mi), pcs = cp.map(x => x % 12), tpl = feels[(b + (b >= 4 ? 1 : 0)) % feels.length].slice();
      const chordIn = scaleNotes.filter(m => pcs.includes(m % 12)), set = chordIn.length ? chordIn : scaleNotes;
      const near = m => { let c = set.filter(x => Math.abs(x - m) <= 6 && x !== prev); if (!c.length) c = set.filter(x => x !== prev && Math.abs(x - prev) <= 9); if (!c.length) c = set; return nearest(m, c); };
      if (rng() < .22 && tpl.length > 4) tpl.splice(1 + Math.floor(rng() * (tpl.length - 2)), 1);         // a breath: drop an onset now and then
      const onsets = [];
      tpl.forEach((p, k) => {
        const isLast = k === tpl.length - 1; let note;
        if (b === 7 && isLast) note = nearest(prev, scaleNotes.filter(m => last === 'tonic' ? pcOf(m) === 0 : (pcOf(m) === second || pcOf(m) === leading)));
        else if (b === 3 && isLast) note = nearest(prev, scaleNotes.filter(m => pcOf(m) === fifth || pcOf(m) === second));
        else if (b === 5 && isLast && rng() < .5) note = nearest(prev, scaleNotes.filter(m => pcOf(m) === third));
        else if (strong.includes(p)) note = near(prev + dir * (rng() < .5 ? 2 : 4));
        else if (medium.includes(p) && rng() < .6) note = near(prev + dir * 3);
        else { const i = scaleNotes.indexOf(nearest(prev, scaleNotes)); note = scaleNotes[Math.max(0, Math.min(scaleNotes.length - 1, i + (rng() < .8 ? 1 : 2) * dir))]; }
        if (!note) note = prev; if (note <= lo + 1) dir = 1; else if (note >= hi - 1) dir = -1; else if (rng() < .2) dir = -dir;
        prev = note; onsets.push({ p, note });
      });
      onsets.forEach((o, i) => {
        const next = i + 1 < onsets.length ? onsets[i + 1].p : tpb; let dur = (next - o.p) * 2; if (lead.feel === 'dense' || lead.feel === 'sparse') dur = Math.max(1, Math.round(dur * .8));
        const e = { step: base + b * spb + o.p * 2, note: o.note, dur, bar: b, first: i === 0, end: b === 3 || b === 7 ? i === onsets.length - 1 : false }; events.push(e);
        if (dur >= 4 && rng() < .14 && e.step > base) { const g = scaleNotes[Math.min(scaleNotes.length - 1, scaleNotes.indexOf(nearest(o.note, scaleNotes)) + 1)]; events.push({ step: e.step - 1, note: g, dur: 1, bar: b, grace: true }); }     // a little grace note
      });
    }
    return events;
  };
  const compose = tr => {
    const mi = modeInfo(tr), spb = tr.meter === 3 ? 12 : 16, L = tr.lead, form = FORM(tr), P = progs(tr, mi); const sections = []; let bar = 0; for (const [name, n] of form) { sections.push({ name, bar, n }); bar += n; }
    if (!L) return { events: [], cm: [], total: bar * spb, sections, P, spb, mi };
    const ev = [], cm = [], oct = L.oct == null ? 1 : L.oct;
    let melA = null, melB = null; const getA = base => tr.melodyA ? parseMel(tr.melodyA, tr, mi, base, oct, spb) : phrase(tr, mi, P.A, L.seed, L.feel, 0, base, spb, L, 'second');
    const getB = base => tr.melodyB ? parseMel(tr.melodyB, tr, mi, base, oct, spb) : phrase(tr, mi, P.B, L.seed + 101, L.feel === 'dense' ? 'sync' : L.feel === 'sparse' ? 'dotted' : 'dense', 5, base, spb, L, 'second');
    for (const s of sections) {
      const base = s.bar * spb;
      if (s.name === 'A') ev.push(...getA(base));
      else if (s.name === 'B') ev.push(...getB(base));
      else if (s.name === 'A2') { const a = getA(base); a.forEach(e => { ev.push(e); if (!e.grace && e.dur >= 2) cm.push({ step: e.step, note: e.note - (tr.melodyA ? 12 : (mi.sc.length === 5 ? 7 : 4)), dur: e.dur, bar: e.bar }); }); }
      else if (s.name === 'intro' && !tr.noIntroHook) { const a = getA(0).filter(e => !e.grace && e.step < 2 * spb).slice(0, 4); a.forEach(e => cm.push({ step: base + e.step, note: e.note, dur: e.dur + 2, bar: e.bar, hook: true })); }
    }
    return { events: ev, cm, total: bar * spb, sections, P, spb, mi };
  };

  /* ---------- the player ---------- */
  const build = (id, tr) => {
    const C0 = compose(tr), { mi, P, spb, sections, total } = C0, stepDur = 60 / tr.bpm / 4, dr = DR[tr.drums] || {}, kit = tr.drums === 'chip' ? 'chip' : 'std', mixv = tr.mix || 1;
    const bus = {}; const mk = (name, pan, send) => { const g = ac.createGain(), p = ac.createStereoPanner ? ac.createStereoPanner() : null; if (p) { p.pan.value = pan; g.connect(p); p.connect(master); } else g.connect(master); const rs = ac.createGain(); rs.gain.value = send; g.connect(rs); rs.connect(rvBus); const ds = ac.createGain(); ds.gain.value = 0; g.connect(ds); ds.connect(dlBus); bus[name] = { g, ds }; return bus[name]; };
    mk('lead', .12, (tr.lead && tr.lead.rv) ?? tr.rv ?? .2); mk('arp', -.25, (tr.arp && tr.arp.rv) ?? tr.rv ?? .2); mk('bass', 0, .04); mk('pad', .0, .35); mk('drums', 0, tr.rv ? tr.rv * .5 : .1); mk('cm', -.12, tr.rv ?? .25);
    if (tr.lead && tr.lead.dl) bus.lead.ds.gain.value = tr.lead.dl; if (tr.arp && tr.arp.dl) bus.arp.ds.gain.value = tr.arp.dl; bus.cm.ds.gain.value = (tr.lead && tr.lead.dl) ? tr.lead.dl * .6 : 0;
    const byStep = {}; C0.events.forEach(e => { (byStep[e.step] = byStep[e.step] || []).push(e); }); const cmByStep = {}; C0.cm.forEach(e => { (cmByStep[e.step] = cmByStep[e.step] || []).push(e); });
    const secAt = bar => { for (const s of sections) if (bar >= s.bar && bar < s.bar + s.n) return s; return sections[0]; };
    const chordAt = (bar, s) => chordPitches(tr, (s.name === 'B' ? P.B : P.A)[(bar - s.bar) % 8], mi);
    const bassNote = (ch, c) => { const pc = ch[0] % 12, base = 12 * ((tr.bass.oct || 2) + 1) + pc; return c === '1' ? base : c === '5' ? base + 7 : c === '8' ? base + 12 : c === '3' ? base + (ch[1] - ch[0]) % 12 : c === '7' ? base + (ch[3] - ch[0] + 12) % 12 : c === '4' ? base + 5 : c === '2' ? base + 2 : base; };
    const vary = (pat, pat2, s) => (s.name === 'B' || s.name === 'A2') && pat2 ? pat2 : pat;
    const sched = (gs, t) => {
      const s = gs % total, bar = Math.floor(s / spb), st = s % spb, sec = secAt(bar), mk_ = MASK[sec.name] || MASK.A, ch = chordAt(bar, sec), inSec = bar - sec.bar;
      const sw = tr.sw && (st % 4 === 2) ? tr.sw * stepDur : 0, rub = tr.rub ? (Math.random() - .5) * tr.rub : (Math.random() - .5) * .008, tt = t + sw;
      const hum = rub, lastBar = inSec === sec.n - 1, sectionStart = inSec === 0 && st === 0;
      // lead (and the harmony voice in the returning section)
      (byStep[s] || []).forEach(e => { if (!tr.lead || mk_.lead < .5) return; const accent = e.first ? 1.1 : st % 4 === 0 ? 1 : .86, phraseShape = 1 - .12 * Math.abs(((e.bar % 4) - 1.5) / 1.5), vel = (tr.lead.vol || .28) * accent * phraseShape * (e.grace ? .55 : 1) * (.92 + Math.random() * .16); V[tr.lead.i](tt + hum, e.note, Math.max(.08, e.dur * stepDur * (e.end ? 1.5 : 1)), vel, bus.lead.g); });
      (cmByStep[s] || []).forEach(e => { if (!(mk_.cm || e.hook)) return; const ci = tr.cm && tr.cm.i || (tr.lead && tr.lead.i); V[ci](tt + hum, e.note, Math.max(.1, e.dur * stepDur), (tr.lead.vol || .28) * (e.hook ? .55 : .5), bus.cm.g); });
      // arpeggio / comping (denser in the chorus)
      if (tr.arp && mk_.arp) { const pat = vary(tr.arp.pat, tr.arp.pat2 || (tr.arp.pat.includes('c') ? tr.arp.pat : tr.arp.pat.replace(/\./g, (m, i) => i % 4 === 2 ? '1' : m)), sec), c = pat[st % pat.length]; if (c && c !== '.') { const o = tr.arp.oct || 4, vol = (tr.arp.vol || .12) * mixv * mk_.arp * (st % 4 === 0 ? 1 : .8); if (c === 'c') ch.slice(0, 3).forEach(m => V[tr.arp.i](tt + hum, m + 12 * (o - 3), stepDur * 3, vol * .7, bus.arp.g)); else { const tones = [ch[0], ch[1], ch[2], ch[3], ch[1] + 12, ch[2] + 12]; V[tr.arp.i](tt + hum, tones[Math.max(0, Math.min(5, +c - 1))] + 12 * (o - 3), stepDur * 1.9, vol, bus.arp.g); } } }
      // bass: pattern A in the verse, pattern B in the chorus, a passing note on the last beat before a chord change
      if (tr.bass && mk_.bass && mixv > .3) { const pat = vary(tr.bass.pat, tr.bass.pat2 || (tr.bass.pat.length >= 16 ? tr.bass.pat.slice(0, 8) + tr.bass.pat.slice(0, 7) + '5' : tr.bass.pat), sec); let c = pat[st % pat.length]; if (lastBar && st >= spb - 2 && c !== '.' && (inSec % 2 === 1)) c = '5'; if (c && c !== '.') V[tr.bass.i](tt, bassNote(ch, c), stepDur * 3.2, (tr.bass.vol || .4) * mixv * mk_.bass, bus.bass.g); }
      // pad, one chord per bar (a slow swell)
      if (tr.pad && mk_.pad && st === 0) ch.slice(0, 3).forEach(m => V[tr.pad.i](t, m + 12 * ((tr.pad.oct || 3) - 3), stepDur * spb, (tr.pad.vol || .1) * (sec.name === 'out' ? .8 : 1), bus.pad.g));
      // drums: groove, extra hats in the chorus, fills at the end of each block, a crash at each section start
      if (tr.drums && tr.drums !== 'none' && mk_.drums > 0) {
        const vol = (tr.dv || .6) * mk_.drums;
        for (const k in dr) { if (dr[k][st % dr[k].length] === 'x' && DV[k]) { let v = vol; if (k === 'h' || k === 'sh') v *= st % 4 === 0 ? 1 : .62; if (k === 'k' && tr.pump) { const pg = bus.pad.g.gain, ag = bus.arp.g.gain; pg.cancelScheduledValues(tt); pg.setValueAtTime(.35, tt); pg.linearRampToValueAtTime(1, tt + .2); ag.cancelScheduledValues(tt); ag.setValueAtTime(.45, tt); ag.linearRampToValueAtTime(1, tt + .17); } DV[k](tt, v * (.9 + Math.random() * .2), bus.drums.g, kit); } }
        if (sectionStart && (sec.name === 'A' || sec.name === 'B' || sec.name === 'A2') && DV.x) DV.x(tt, vol * .8, bus.drums.g, kit);
        if (lastBar && sec.n >= 8 && tr.drums !== 'tense' && tr.drums !== 'taiko' && tr.drums !== 'waltz' && st >= spb - 4) { const f = ['s', 't', 'r', 'k'].find(x => DV[x] && dr[x]) || 's'; if (st % 2 === 0 || sec.name !== 'A') DV[f](tt, vol * (.45 + .1 * (st - (spb - 4))), bus.drums.g, kit); }
        if (lastBar && sec.n >= 8 && sec.name === 'A' && st >= spb - 8 && st < spb - 4 && st % 2 === 0 && DV.s && dr.s) DV.s(tt, vol * .3, bus.drums.g, kit);        // a little build-up into the chorus
      }
    };
    return { sched, total, stepDur, bus, spb, sections };
  };

  const Mx = {
    TRACKS: T, NOTE,
    get on() { return getOn(); }, set on(v) { ls.set('mx_on', v ? '1' : '0'); if (!v) Mx.stop(); else if (lastOn) Mx.play(lastOn); },
    get vol() { return getVol(); }, set vol(v) { ls.set('mx_vol', String(v)); if (master && player) master.gain.setTargetAtTime(outGain(player.id), ac.currentTime, .1); },
    playing: () => player ? player.id : null,
    play(id) {
      lastOn = id; if (!getOn() || !T[id]) return; if (player && player.id === id) return; Mx.stop(true);
      const a = ensure(); if (!a) return; if (a.state === 'suspended') a.resume();
      const tr = T[id], B = build(id, tr); dlNode.delayTime.value = 60 / tr.bpm * .75; let step = 0, nextT = a.currentTime + .12; master.gain.cancelScheduledValues(a.currentTime); master.gain.setValueAtTime(0.0001, a.currentTime); master.gain.linearRampToValueAtTime(outGain(id), a.currentTime + 1.2);
      const timer = setInterval(() => { if (!player || player.id !== id) return; while (nextT < a.currentTime + .16) { try { B.sched(step, nextT); } catch (e) { } const drift = tr.drift ? 1 + Math.sin(step / 23) * tr.drift : 1; nextT += B.stepDur * drift; step++; } }, 30);
      player = { id, timer, B };
    },
    stop(quick) { if (!player) return; clearInterval(player.timer); const p = player; player = null; if (master && ac) { master.gain.cancelScheduledValues(ac.currentTime); master.gain.setValueAtTime(master.gain.value, ac.currentTime); master.gain.linearRampToValueAtTime(0.0001, ac.currentTime + (quick ? .08 : .5)); } try { Object.values(p.B.bus).forEach(b => setTimeout(() => { try { b.g.disconnect(); b.ds.disconnect(); } catch (e) { } }, 4500)); } catch (e) { } },
    duck() { if (!master || !player || !ac) return; const now = ac.currentTime; master.gain.cancelScheduledValues(now); master.gain.setValueAtTime(master.gain.value, now); master.gain.linearRampToValueAtTime(outGain() * .55, now + .03); master.gain.linearRampToValueAtTime(outGain(), now + .45); },
    /* offline test render: plays a theme into a buffer and measures it (peak, loudness, silence) */
    async render(id, nbars, from) { const tr = T[id]; if (!tr) return null; const sr = 22050, c0 = compose(tr), spb = c0.spb, sd = 60 / tr.bpm / 4, nb = nbars || c0.total / spb, f0 = (from || 0) * spb, dur = nb * spb * sd + 2.5, keep = { ac, master, comp, rvBus, dlBus, dlNode, nbuf }; nbuf = null; const off = new OfflineAudioContext(2, Math.ceil(dur * sr), sr); ensure(off); master.gain.value = outGain(id); const B = build(id, tr); dlNode.delayTime.value = 60 / tr.bpm * .75; for (let s = f0; s < f0 + nb * spb; s++) B.sched(s, .05 + (s - f0) * sd); const buf = await off.startRendering(); ({ ac, master, comp, rvBus, dlBus, dlNode, nbuf } = keep); const d = buf.getChannelData(0), e = buf.getChannelData(1); let pk = 0, sum = 0, nan = 0, sil = 0; const win = sr / 10; let wsum = 0, wn = 0; for (let i = 0; i < d.length; i++) { const x = (d[i] + e[i]) / 2; if (x !== x) nan++; const a = Math.abs(x); if (a > pk) pk = a; sum += x * x; wsum += x * x; wn++; if (wn === win) { if (Math.sqrt(wsum / wn) < .002) sil++; wsum = 0; wn = 0; } } return { id, name: tr.name, bars: nb, seconds: Math.round(dur * 10) / 10, peak: Math.round(pk * 100) / 100, rmsDb: Math.round(20 * Math.log10(Math.sqrt(sum / d.length) + 1e-9) * 10) / 10, nan, silentPct: Math.round(sil / Math.ceil(d.length / win) * 100) }; },
    melody(id, n) { const tr = T[id]; if (!tr) return ''; const c = compose(tr); return c.events.filter(e => !e.grace).slice(0, n || 40).map(e => NOTE(e.note)).join(' '); },
    info: id => { const tr = T[id]; if (!tr) return null; const c = compose(tr); return { bars: c.total / c.spb, sections: c.sections.map(s => s.name + ':' + s.n).join(' '), notes: c.events.length, countermelody: c.cm.length }; },
  };
  /* ---- Recorded classical piano: Kimiko Ishizaka's Open Goldberg Variations (CC0) and Open Well-Tempered Clavier, Book 1 (public domain), in web/music/piano.
     This is the default sound; the synthesised themes above stay available (Mx.src = 'synth'). Each game has its own shuffled playlist that carries on where it left off. ---- */
  const Pn = (() => {
    const base = '/web/music/piano/'; let au = null, list = null, loading = null, id = null, q = [], pos = 0, cur = null, fails = 0, rampT = 0, tok = 0;
    const load = () => loading || (loading = Promise.all([fetch(base + 'index.json').then(r => r.json()).then(j => j.map(x => Object.assign({ d: base }, x))).catch(() => []), fetch('/web/music/mozart/index.json').then(r => r.json()).then(j => j.map(x => Object.assign({ d: '/web/music/mozart/' }, x))).catch(() => [])]).then(([bach, moz]) => { list = bach; list.mozart = moz; return list; }));
    const hash = s => { let h = 2166136261; for (const c of String(s)) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; };
    const rng = seed => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    const vol = () => Math.min(1, getVol() / 100 * .9), pk = g => (g === 'chess' ? 'mx_pos_mz_' : 'mx_pos_') + g;
    const ramp = (to, ms, done) => { clearInterval(rampT); if (!au) return; const a = au, from = a.volume, t0 = Date.now(); rampT = setInterval(() => { const k = Math.min(1, (Date.now() - t0) / ms); try { a.volume = Math.max(0, Math.min(1, from + (to - from) * k)); } catch (e) { } if (k >= 1) { clearInterval(rampT); if (done) done(); } }, 40); };
    const next = () => {
      if (!id || !q.length) return; const t = q[pos % q.length]; cur = t; ls.set(pk(id), String((pos + 1) % q.length)); const my = tok;
      if (!au) { au = new Audio(); au.preload = 'auto'; } au.onended = () => { if (my !== tok) return; pos++; next(); };
      au.onerror = () => { if (my !== tok) return; if (++fails > 5) return; pos++; setTimeout(() => { if (my === tok) next(); }, 300); };
      au.src = (t.d || base) + t.f; au.volume = 0; const pr = au.play(); if (pr && pr.catch) pr.catch(() => { }); ramp(vol(), 1500);
      try { if (Mx.onTrack) Mx.onTrack(t); } catch (e) { }
    };
    return {
      get id() { return id; }, get track() { return cur; },
      async play(gid) {
        if (id === gid && au && !au.paused) return; Pn.stop(true); id = gid; const my = ++tok; await load(); if (my !== tok || !list.length) return;
        if (gid === 'chess' && list.mozart.length) q = list.mozart.slice();   // Chess plays Mozart's greatest hits in a fixed order (the Andantes first)
        else { const r = rng(hash(gid)); q = list.slice(); for (let i = q.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [q[i], q[j]] = [q[j], q[i]]; } }
        pos = Math.max(0, (+ls.get(pk(gid), '0') || 0)) % q.length; fails = 0; next();
      },
      stop(quick) { tok++; const a = au; id = null; cur = null; if (!a) return; if (quick) { clearInterval(rampT); try { a.pause(); } catch (e) { } return; } ramp(0, 450, () => { try { if (!id) a.pause(); } catch (e) { } }); },
      skip() { if (!id) return; pos++; tok++; if (au) { try { au.pause(); } catch (e) { } } next(); },
      setVol() { if (au && id) { clearInterval(rampT); try { au.volume = vol(); } catch (e) { } } },
      duck() { if (!au || !id) return; clearInterval(rampT); try { au.volume = vol() * .55; } catch (e) { } setTimeout(() => ramp(vol(), 400), 450); },
    };
  })();
  const synthPlay = Mx.play, synthStop = Mx.stop, synthDuck = Mx.duck, volDesc = Object.getOwnPropertyDescriptor(Mx, 'vol');
  const getSrc = () => ls.get('mx_src', 'piano') === 'synth' ? 'synth' : 'piano';
  Mx.play = function (id, forceSynth) {
    if (forceSynth || getSrc() === 'synth') { Pn.stop(true); return synthPlay.call(Mx, id); }
    lastOn = id; if (!getOn() || !T[id]) return; synthStop.call(Mx, true); Pn.play(id);
  };
  Mx.stop = function (quick) { Pn.stop(quick); return synthStop.call(Mx, quick); };
  Mx.duck = function () { Pn.duck(); return synthDuck.call(Mx); };
  Mx.skip = () => Pn.skip();
  Object.defineProperty(Mx, 'vol', { get: volDesc.get, set(v) { volDesc.set.call(Mx, v); Pn.setVol(); }, configurable: true });
  Object.defineProperty(Mx, 'src', { get: getSrc, set(v) { ls.set('mx_src', v === 'synth' ? 'synth' : 'piano'); const was = Mx.playing(); Mx.stop(true); if (was && getOn()) Mx.play(was); }, configurable: true });
  Mx.onTrack = t => { try { if (typeof A !== 'undefined' && A.toast) A.toast('♪ ' + (t.w === 'Mozart' ? 'Mozart: ' + t.t : t.t + ' (' + t.w.replace('Bach: ', '') + ')'), 3600); } catch (e) { } };
  const synthPlaying = Mx.playing; Mx.playing = () => Pn.id || synthPlaying();
  Mx.nowPlaying = () => Pn.track;
  (typeof A !== 'undefined' ? A : window).music = Mx;
})();

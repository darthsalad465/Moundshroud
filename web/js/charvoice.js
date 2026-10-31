// Character voices: every character speaks in its own voice (boy, girl, old, young, robot) and animals make their animal noise first.
// Uses the offline Windows voices plus a small synthesiser, so nothing leaves this PC. Microphone input goes through A.voice.
(() => {
  const KEY = 'cvoice';
  const cfg = Object.assign({ auto: 0, noise: 1, ov: {} }, (() => { try { return JSON.parse(ls.get(KEY, '{}')); } catch (e) { return {}; } })());
  const save = () => ls.set(KEY, JSON.stringify(cfg));
  const hash = s => { let h = 7; s = String(s); for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; };
  const slug = n => (typeof A !== 'undefined' && A.chars ? A.chars.slug(n) : String(n).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''));

  /* ---- who sounds like what ---- */
  // g: m / f / n   age: kid / adult / old   k: human / robot / animal   a: animal noise   p,r: pitch and rate multipliers
  const T = {
    'pip': { k: 'animal', a: 'penguin', g: 'n', age: 'kid' }, 'goldie': { k: 'animal', a: 'fish', g: 'f', age: 'kid' },
    'captain-barnacle': { g: 'm', p: .72, r: .9 }, 'gran-maude': { g: 'f', age: 'old', p: .95, r: .82 },
    'dexter-the-dino': { k: 'animal', a: 'roar', g: 'm', p: .55, r: .85 }, 'professor-plink': { g: 'm', p: 1.2, r: 1.12 },
    'zara': { g: 'f', age: 'kid', r: 1.15 }, 'sir-reginald': { g: 'm', age: 'old', p: .8, r: .85 }, 'luna': { g: 'f', p: 1.05, r: .8 },
    'coach-bolt': { g: 'm', p: .95, r: 1.22 }, 'nova': { g: 'f', age: 'kid', p: 1.1, r: 1.08 }, 'detective-hawk': { g: 'm', p: .68, r: .85 },
    'madame-rook': { g: 'f', p: 1.02, r: .9 }, 'sensei-kenji': { g: 'm', p: .85, r: .78 }, 'baron-von-blitz': { g: 'm', p: 1.05, r: 1.45 },
    'ada': { k: 'robot', g: 'f', p: .55, r: .95 }, 'viktor-the-stoic': { g: 'm', p: .58, r: .75 }, 'isla': { k: 'animal', a: 'hoot', g: 'f', p: 1.1, r: .9 },
    'the-oracle': { g: 'n', p: .5, r: .68 }, 'old-titan': { g: 'm', age: 'old', p: .65, r: .8 }, 'moundshroud-prime': { k: 'robot', g: 'm', p: .25, r: .9 },
    'maya-reyes': { g: 'f', p: 1.05, r: 1.05 }
  };
  const ANIMAL = { '🐧': 'penguin', '🐠': 'fish', '🐟': 'fish', '🐡': 'fish', '🐙': 'fish', '🦖': 'roar', '🦕': 'roar', '🦉': 'hoot', '🐱': 'meow', '🐈': 'meow', '😺': 'meow', '🐶': 'woof', '🐕': 'woof', '🐺': 'woof', '🐸': 'ribbit', '🐥': 'tweet', '🐤': 'tweet', '🐣': 'tweet', '🐦': 'tweet', '🦜': 'tweet', '🦁': 'roar', '🐯': 'roar', '🐮': 'moo', '🐄': 'moo', '🐷': 'oink', '🐑': 'baa', '🐐': 'baa', '🐭': 'squeak', '🐹': 'squeak', '🐰': 'squeak', '🐻': 'growl', '🐼': 'growl', '🦊': 'yip', '🐲': 'dragon', '🐉': 'dragon', '🦆': 'quack', '🐔': 'cluck', '🐴': 'neigh', '🦄': 'neigh', '🐝': 'buzz', '🦇': 'squeak', '🐢': 'chirp', '🐵': 'chirp', '🦊': 'yip' };
  const ROBOT = /🤖|⚙️|🧠|🛰/;
  const MALE = ['Alex', 'Ben', 'Carlos', 'Dan', 'Eli', 'Finn', 'Hugo', 'Ivan', 'Jack', 'Leo', 'Max', 'Noah', 'Omar', 'Pablo', 'Sam', 'Tom', 'Victor', 'Will', 'Yusuf', 'Zane', 'Tobias', 'Marcus', 'Ravi', 'Ferris', 'Mateo', 'Lars', 'Chen', 'Jamal', 'Declan', 'Mo'];
  const profile = id => {
    const def = (typeof A !== 'undefined' && A.chars && A.chars.get(id)) || {}, nm = def.name || String(id).replace(/^\w+:/, ''), key = slug(nm), t = T[key] || {};
    let k = t.k || 'human', a = t.a, g = t.g, age = t.age || 'adult';
    const em = def.em || '';
    if (!t.k && em) { if (ROBOT.test(em)) k = 'robot'; else if (ANIMAL[em]) { k = 'animal'; a = ANIMAL[em]; } }
    if (!g) { if (/^leg:/.test(id)) g = 'm'; else if (/^(bud|tw):/.test(id) && k === 'animal') g = 'n'; else { const f = nm.split(' ')[0].replace(/^(Dr\.?|Mr\.?|Mrs\.?|Ms\.?|Sir|Madame|Captain|Old|Gran)$/i, ''); g = MALE.some(m => m.toLowerCase() === f.toLowerCase()) || /^(Sir|Mr|Captain|Old|Baron|Coach)\b/i.test(nm) ? 'm' : (hash(nm) % 2 ? 'f' : 'm'); } }
    if (def.g) g = def.g; if (def.voice) Object.assign(t, def.voice);
    const h = hash(id), j = ((h % 100) - 50) / 700;      // a small personal wobble so two people with the same voice still differ
    let p = (t.p || 1) * (g === 'f' ? 1.12 : g === 'm' ? .88 : 1), r = (t.r || 1);
    if (age === 'old') { p *= .92; r *= .88; } if (age === 'kid') { p *= 1.18; r *= 1.05; }
    if (k === 'robot') { p = Math.min(p, .5) * (g === 'f' ? 1.25 : 1); r = Math.min(r, .95); }
    if (k === 'animal') { p = (t.p || 1.55) * (g === 'f' ? 1.05 : 1); r = Math.max(r, 1.1); }
    const ov = (cfg.ov || {})[id] || { p: 1, r: 1 };
    return { id, name: nm, kind: k, animal: a || 'chirp', gender: g, age, pitch: Math.max(.1, Math.min(2, (p + j) * ov.p)), rate: Math.max(.55, Math.min(2, (r + j * .6) * ov.r)), slot: h };
  };
  const describe = id => { const p = profile(id); return p.kind === 'robot' ? 'Robot voice' : p.kind === 'animal' ? 'Makes a ' + p.animal + ' noise, then speaks in a small voice' : (p.age === 'old' ? 'Older ' : p.age === 'kid' ? 'Young ' : '') + (p.gender === 'f' ? 'woman' : p.gender === 'm' ? 'man' : 'neutral') + ' voice'; };

  /* ---- animal noises (synthesised) ---- */
  let ac = null; const AC = () => { if (!ac) ac = new (window.AudioContext || window.webkitAudioContext)(); if (ac.state === 'suspended') ac.resume(); return ac; };
  const S = (t, f0, f1, d, at, v, vib) => ({ t, f0, f1, d, at: at || 0, v: v == null ? .22 : v, vib });
  const N = (f, d, at, v) => ({ n: 1, f, d, at: at || 0, v: v == null ? .2 : v });
  const NOISES = {
    penguin: [S('sawtooth', 520, 780, .12, 0), S('sawtooth', 780, 420, .22, .14, .22, [30, 40]), S('sawtooth', 520, 780, .12, .42), S('sawtooth', 780, 380, .28, .56, .22, [30, 50])],
    fish: [S('sine', 300, 700, .09, 0, .3), S('sine', 350, 800, .1, .13, .3), S('sine', 250, 600, .12, .3, .3), N(1800, .05, .32, .05)],
    roar: [N(500, .9, 0, .35), S('sawtooth', 120, 60, .95, 0, .3, [38, 18])],
    hoot: [S('sine', 400, 360, .28, 0, .3), S('sine', 400, 300, .45, .4, .3)],
    meow: [S('triangle', 480, 900, .22, 0, .3), S('triangle', 900, 420, .38, .22, .3, [7, 20])],
    woof: [S('square', 220, 120, .12, 0, .25), N(900, .08, 0, .12), S('square', 240, 110, .14, .22, .25), N(900, .08, .22, .12)],
    ribbit: [S('sawtooth', 160, 90, .09, 0, .28), S('sawtooth', 150, 80, .1, .13, .28), S('sawtooth', 190, 100, .12, .32, .28)],
    tweet: [S('sine', 2300, 3200, .06, 0, .22), S('sine', 3000, 2400, .07, .09, .22), S('sine', 2400, 3300, .06, .22, .22), S('sine', 3100, 2500, .08, .31, .22)],
    moo: [S('sawtooth', 150, 115, 1.0, 0, .3, [5, 10])],
    oink: [S('sawtooth', 260, 140, .13, 0, .3), N(700, .1, 0, .14), S('sawtooth', 210, 120, .16, .17, .3), N(700, .1, .17, .14)],
    baa: [S('sawtooth', 320, 270, .55, 0, .26, [28, 30])],
    squeak: [S('sine', 1800, 2800, .09, 0, .25), S('sine', 2000, 3000, .1, .13, .25)],
    growl: [S('sawtooth', 95, 70, .9, 0, .3, [55, 14]), N(300, .9, 0, .2)],
    yip: [S('square', 700, 1100, .09, 0, .2), S('square', 650, 1000, .1, .14, .2), S('square', 700, 1200, .12, .3, .2)],
    dragon: [N(350, 1.0, 0, .35), S('sawtooth', 80, 45, 1.1, 0, .3, [24, 16]), S('sawtooth', 160, 90, .6, .4, .15)],
    quack: [S('square', 520, 360, .15, 0, .22), S('square', 500, 330, .15, .2, .22)],
    cluck: [S('square', 720, 500, .05, 0, .2), S('square', 700, 480, .05, .1, .2), S('square', 740, 520, .05, .2, .2), S('square', 600, 400, .12, .32, .2)],
    neigh: [S('sawtooth', 500, 1100, .3, 0, .26, [12, 40]), S('sawtooth', 1100, 380, .5, .3, .26, [12, 40])],
    buzz: [S('sawtooth', 210, 210, .6, 0, .22, [110, 25])],
    chirp: [S('sine', 1800, 2400, .08, 0, .22), S('sine', 2400, 1900, .09, .12, .22)],
    beep: [S('square', 880, 880, .07, 0, .1), S('square', 660, 660, .07, .09, .1), S('square', 990, 990, .09, .18, .1)]
  };
  const noise = (kind, vol) => new Promise(res => {
    const segs = NOISES[kind] || NOISES.chirp, a = AC(), t0 = a.currentTime + .02, vm = Math.min(1, Math.max(0, +ls.get('svol', '1'))) * (vol == null ? 1 : vol); let end = 0;
    segs.forEach(s => {
      const g = a.createGain(), at = t0 + s.at, d = s.d; end = Math.max(end, s.at + d);
      g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(s.v * vm, at + Math.min(.02, d / 3)); g.gain.exponentialRampToValueAtTime(.0001, at + d);
      if (s.n) { const len = Math.max(1, Math.floor(a.sampleRate * d)), buf = a.createBuffer(1, len, a.sampleRate), x = buf.getChannelData(0); for (let i = 0; i < len; i++) x[i] = Math.random() * 2 - 1; const src = a.createBufferSource(); src.buffer = buf; const f = a.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = s.f; src.connect(f); f.connect(g); g.connect(a.destination); src.start(at); return; }
      const o = a.createOscillator(); o.type = s.t; o.frequency.setValueAtTime(s.f0, at); o.frequency.exponentialRampToValueAtTime(Math.max(20, s.f1), at + d);
      if (s.vib) { const l = a.createOscillator(), lg = a.createGain(); l.frequency.value = s.vib[0]; lg.gain.value = s.vib[1]; l.connect(lg); lg.connect(o.frequency); l.start(at); l.stop(at + d + .05); }
      const lp = a.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = s.t === 'sawtooth' || s.t === 'square' ? 2600 : 6000; o.connect(lp); lp.connect(g); g.connect(a.destination); o.start(at); o.stop(at + d + .05);
    });
    setTimeout(res, Math.ceil(end * 1000) + 60);
  });

  /* ---- speaking ---- */
  const F = /Zira|Aria|Jenny|Hazel|Susan|Heera|Eva|Catherine|Linda|Sonia|Libby|Natasha|Michelle|Emma|Ana|Female/i, M = /David|Mark|George|Guy|Ryan|James|Richard|Sean|Thomas|Alfie|Ravi|Christopher|Eric|Roger|Brian|Male/i;
  const voices = () => (window.speechSynthesis ? speechSynthesis.getVoices() : []);
  const voiceFor = pr => {
    const all = voices(), en = all.filter(v => /^en/i.test(v.lang)), pool = en.length ? en : all; if (!pool.length) return null;
    const want = pr.gender === 'f' ? F : pr.gender === 'm' ? M : null, hit = want ? pool.filter(v => want.test(v.name)) : [];
    const list = hit.length ? hit : pool.filter(v => v.localService).length ? pool.filter(v => v.localService) : pool;
    return list[pr.slot % list.length];
  };
  let gen = 0, speaking = null;
  const clean = t => String(t || '').replace(/[*_`#>~]+/g, '').replace(/\p{Extended_Pictographic}/gu, '').replace(/https?:\/\/\S+/g, ' link ').replace(/\s+/g, ' ').trim().slice(0, 320);
  const say = (pr, text) => new Promise(res => {
    if (!('speechSynthesis' in window)) return res(); const body = clean(text); if (!body) return res();
    const u = new SpeechSynthesisUtterance(body), v = voiceFor(pr); if (v) u.voice = v; u.pitch = pr.pitch; u.rate = pr.rate * Math.max(.5, +ls.get('rate', '1') || 1); u.volume = Math.min(1, Math.max(0, +ls.get('svol', '1')));
    u.onend = u.onerror = () => res(); speechSynthesis.speak(u);
  });
  const api = window.CVOICE = {}; if (typeof A !== 'undefined') A.cvoice = api;
  Object.assign(api, {
    profile, describe, noise, available: () => 'speechSynthesis' in window,
    get auto() { return !!cfg.auto; }, set auto(v) { cfg.auto = v ? 1 : 0; save(); },
    get noises() { return !!cfg.noise; }, set noises(v) { cfg.noise = v ? 1 : 0; save(); },
    stop() { gen++; try { speechSynthesis.cancel(); } catch (e) { } speaking = null; },
    /* speak a line as this character: animals squeak/roar first, robots beep first */
    async speak(id, text, o) {
      o = o || {}; const my = ++gen; try { speechSynthesis.cancel(); } catch (e) { } const pr = profile(id); speaking = id;
      try {
        if (pr.kind === 'animal' && cfg.noise) { await noise(pr.animal); if (my !== gen) return; if (o.noiseOnly) return; await new Promise(r => setTimeout(r, 120)); }
        else if (pr.kind === 'robot' && cfg.noise) { await noise('beep', .8); if (my !== gen) return; }
        if (o.noiseOnly) return; if (my !== gen) return; await say(pr, text);
      } catch (e) { }
      if (my === gen) speaking = null;
    },
    speaking: () => speaking,
    /* microphone: toggles; recognised text goes to cb. Returns true when recording started */
    mic(cb, stateCb) {
      if (!A.voice || !A.voice.available()) { A.toast('Voice input is not available here.'); return false; }
      if (A.voice.rec) { A.voice.stop(); return false; }
      api.stop(); A.voice.start(txt => { if (txt) cb(txt); }, (s, sec) => { if (stateCb) stateCb(s, sec); }, { auto: true, onSilence: () => A.toast('I did not hear anything.') }); return true;
    }
  });
  api.getOverride = id => (cfg.ov || {})[id] || { p: 1, r: 1 };
  api.setOverride = (id, p, r) => { cfg.ov = cfg.ov || {}; if (p === 1 && r === 1) delete cfg.ov[id]; else cfg.ov[id] = { p, r }; save(); };
  if (typeof A !== 'undefined' && A.chars && A.chars.extras) A.chars.extras.push({
    html: id => { const o = api.getOverride(id); return '<div class="card" style="margin:10px 0"><b>🔊 Voice</b> <span class="small mute">' + describe(id) + '</span><div class="row" style="gap:12px;align-items:center;flex-wrap:wrap;margin-top:6px"><label class="small">Pitch <input type="range" min="60" max="160" value="' + Math.round(o.p * 100) + '" data-vp="1"></label><label class="small">Speed <input type="range" min="60" max="160" value="' + Math.round(o.r * 100) + '" data-vr="1"></label><button class="ib" data-vt="1">▶ Test</button><button class="ib" data-vz="1">Reset</button></div></div>'; },
    bind: (d, id) => { const p = d.querySelector('[data-vp]'), r = d.querySelector('[data-vr]'); if (!p) return; const set = () => api.setOverride(id, p.value / 100, r.value / 100); p.onchange = r.onchange = set; d.querySelector('[data-vt]').onclick = () => { set(); const c = A.chars.get(id); api.speak(id, 'Hello, I am ' + ((c && c.name) || 'a friend') + '. This is my voice.'); }; d.querySelector('[data-vz]').onclick = () => { p.value = r.value = 100; set(); }; }
  });
  if (window.speechSynthesis) { try { speechSynthesis.getVoices(); } catch (e) { } }
})();

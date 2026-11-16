/* IMPERIUM — the soundtrack. Everything is synthesised while the game runs; nothing is loaded.

   It is built the way a game score is built now, not the way a chiptune is:
   - A mixing chain: every instrument has its own channel with a pan position and a send to a stereo hall reverb;
     the music bus goes through glue compression and EQ, the sound effects have their own bus, and both meet in a
     limiter, so the level is steady and loud enough (about -18 dB average) without ever clipping. Music and
     effects have separate volumes, and the music ducks under big moments.
   - Instruments modelled on the ones Rome actually heard: a lyre whose strings are physically modelled
     (Karplus-Strong: a burst of noise travelling round a delay line, losing its brightness as it rings), the aulos
     (the double reed pipe, with its scoop into the note, breath and formants), the cornu (the curved bronze horn
     of the legions), the hydraulis (the water organ of the baths and the games), the sistrum, crotala (finger
     clappers), frame drum and tambourine; and for weight, a string section, a male choir and big war drums.
   - A score, not a loop: every place has a theme with a key, a mode, an eight-bar harmonic plan and its own
     written phrases; a melody keeps to the chord under it, the bass and harmony voice-lead, and the players are
     humanised. One motif, the Imperium theme, returns through the score (title, Forum, triumph, battle, the
     chapter plates) the way a film's main theme does.
   - Adaptive: each theme has layers that come in and drop out with an intensity level, which the battlefield
     raises as the lines meet; moving between places crossfades instead of cutting.

   Browsers will not make a sound until the player has clicked or pressed a key, so the first click or key
   anywhere wakes the audio. */
window.ImpAudio = (() => {
  'use strict';
  const LS = (k, d) => { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; } };
  const SET = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { } };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rnd = (a, b) => a + Math.random() * (b - a);
  let muted = LS('imperium.sound', '1') === '0';
  let volM = clamp(+LS('imperium.vol.music', '.8') || 0, 0, 1), volS = clamp(+LS('imperium.vol.sfx', '.9') || 0, 0, 1);
  let ac = null, B = null, NOISE = null, wanted = null, cur = null, timer = 0, drive = 0, driveSm = 0, shapeCurve = null;
  const MUSIC_TRIM = 1.0, SFX_TRIM = 0.85;

  /* ============================ the mixing desk ============================ */
  function ctx() {
    if (!ac) {
      const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
      try { ac = new AC({ latencyHint: 'playback' }); } catch (e) { try { ac = new AC(); } catch (e2) { return null; } }
      build();
    }
    if (ac.state !== 'running' && ac.state !== 'closed') { try { const p = ac.resume(); if (p && p.catch) p.catch(() => { }); } catch (e) { } }
    return ac;
  }
  const filt = (type, f, q, gain) => { const b = ac.createBiquadFilter(); b.type = type; b.frequency.value = f; if (q !== undefined) b.Q.value = q; if (gain !== undefined) b.gain.value = gain; return b; };
  const gainN = v => { const g = ac.createGain(); g.gain.value = v; return g; };
  function comp(th, ratio, att, rel, knee) { const c = ac.createDynamicsCompressor(); c.threshold.value = th; c.ratio.value = ratio; c.attack.value = att; c.release.value = rel; c.knee.value = knee; return c; }
  function chain(...n) { for (let i = 0; i < n.length - 1; i++) n[i].connect(n[i + 1]); return n[n.length - 1]; }
  function build() {
    const sr = ac.sampleRate;
    NOISE = ac.createBuffer(1, sr * 2, sr); const nd = NOISE.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    const limiter = comp(-1.5, 20, .002, .12, 0), master = gainN(1);
    chain(master, limiter, ac.destination);
    /* music: glue compression, a cut in the mud, a little warmth below and air above, the duck, the user's volume */
    const musIn = gainN(MUSIC_TRIM), duck = gainN(1), mus = gainN(muted ? 0 : volM);
    chain(musIn, comp(-22, 2.6, .03, .3, 8), filt('peaking', 330, 1, -2.5), filt('lowshelf', 110, undefined, 2.5), filt('highshelf', 7200, undefined, 2), duck, mus, master);
    /* effects: their own compressor and volume */
    const sfxIn = gainN(SFX_TRIM), sfxG = gainN(muted ? 0 : volS);
    chain(sfxIn, comp(-16, 3, .004, .15, 6), sfxG, master);
    /* a stone hall: early reflections off near walls, then a darkening diffuse tail */
    const verb = ac.createConvolver(); verb.buffer = hall(2.9, 2.5);
    const verbIn = gainN(1), verbOut = gainN(.9);
    chain(verbIn, filt('highpass', 180, .5), verb, verbOut, musIn);
    B = { master, limiter, musIn, duck, mus, sfxIn, sfxG, verbIn };
    B.sfxCh = channel(sfxIn, 0, .12);
  }
  function hall(sec, decay) {
    const sr = ac.sampleRate, len = Math.floor(sr * sec), pre = Math.floor(sr * .022), b = ac.createBuffer(2, len, sr);
    const taps = [[.007, .5], [.012, .36], [.019, .42], [.026, .3], [.035, .27], [.044, .22], [.057, .19], [.071, .14]];
    for (let c = 0; c < 2; c++) {
      const d = b.getChannelData(c);
      taps.forEach(([tt, a], i) => { const k = pre + Math.floor(sr * (tt + (c ? .0011 * (i + 1) : 0))); if (k < len) d[k] += a * ((i + c) % 2 ? -1 : 1) * .6; });
      let y = 0;
      for (let i = pre; i < len; i++) { const p = (i - pre) / sr, x = (Math.random() * 2 - 1) * Math.exp(-p * 6.9 / decay), a = .6 - .48 * Math.min(1, p / decay); y += a * (x - y); d[i] += y * .55; }
    }
    return b;
  }
  /* a channel: gain -> pan -> the group it belongs to, plus a send to the hall */
  function channel(group, pan, send) {
    const g = gainN(1); let node = g;
    if (pan && ac.createStereoPanner) { const p = ac.createStereoPanner(); p.pan.value = pan; g.connect(p); node = p; }
    node.connect(group);
    if (send) { const s = gainN(send); node.connect(s); s.connect(B.verbIn); }
    return g;
  }

  /* ============================ the instruments ============================ */
  const hz = m => 440 * Math.pow(2, (m - 69) / 12);
  function osc(type, f, t, stop) { const o = ac.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t); o.start(t); o.stop(stop); return o; }
  /* attack, hold, release envelope on a gain node (release is exponential, so it never clicks) */
  function env(t, a, peak, hold, rel) { const g = ac.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(peak, t + a); g.gain.setValueAtTime(peak, t + a + hold); g.gain.setTargetAtTime(0, t + a + hold, rel / 4); return g; }
  function noiseSrc(t, dur) { const n = ac.createBufferSource(); n.buffer = NOISE; n.loop = true; n.start(t, Math.random() * 1.6); n.stop(t + dur); return n; }
  function shaper() {
    if (!shapeCurve) { shapeCurve = new Float32Array(1024); for (let i = 0; i < 1024; i++) { const x = i / 511.5 - 1; shapeCurve[i] = Math.tanh(2.2 * x) / Math.tanh(2.2); } }
    const w = ac.createWaveShaper(); w.curve = shapeCurve; return w;
  }

  /* the lyre (kithara): a plucked string modelled as a loop of noise that loses its highs each time round */
  const KS = {};
  function ksBuf(m) {
    if (KS[m]) return KS[m];
    const sr = ac.sampleRate, f = hz(m), N = Math.max(2, Math.floor(sr / f - .5)), T60 = clamp(2.8 - (m - 45) * .05, .45, 2.8);
    const len = Math.floor(sr * Math.min(3, T60 + .25)), r = Math.pow(.001, 1 / (f * T60));
    const ring = new Float32Array(N), b = ac.createBuffer(1, len, sr), d = b.getChannelData(0);
    let lp = 0; for (let i = 0; i < N; i++) { lp += .5 * ((Math.random() * 2 - 1) - lp); ring[i] = lp; }
    const pick = Math.max(1, Math.floor(N * .18));                       // plucked near the bridge: a comb takes out some harmonics
    for (let i = N - 1; i >= pick; i--) ring[i] -= ring[i - pick] * .6;
    let pk = 0;
    for (let i = 0; i < len; i++) { const k = i % N, nx = (ring[k] + ring[(k + 1) % N]) * .5 * r; d[i] = ring[k]; ring[k] = nx; pk = Math.max(pk, Math.abs(d[i])); }
    const fade = Math.floor(sr * .01);
    for (let i = 0; i < len; i++) d[i] = d[i] / (pk || 1) * (i > len - fade ? (len - i) / fade : 1);
    return (KS[m] = { b, rate: f * (N + .5) / sr });
  }
  function kithara(dest, m, t, vel, dur) {
    const rm = Math.round(m), k = ksBuf(rm), s = ac.createBufferSource();
    s.buffer = k.b; s.playbackRate.value = k.rate * Math.pow(2, (m - rm) / 12);
    const g = gainN(vel * .55);
    if (dur) { g.gain.setValueAtTime(vel * .55, t + dur); g.gain.setTargetAtTime(0, t + dur, .07); }
    chain(s, filt('peaking', 230, 1.1, 5), filt('lowpass', 1600 + vel * 4600, .5), g, dest);
    s.start(t); s.stop(t + Math.min(k.b.duration, (dur || 9) + .4));
  }
  /* the aulos: a double reed — buzzy source, scoop into the pitch, vibrato that blooms late, formants, breath */
  function aulos(dest, m, t, dur, vel) {
    const f = hz(m), stop = t + dur + .35, mix = gainN(1), sq = gainN(.45);
    const o1 = osc('sawtooth', f, t, stop), o2 = osc('square', f * 1.0023, t, stop);
    [o1, o2].forEach(o => { o.frequency.setValueAtTime(f * .975, t); o.frequency.exponentialRampToValueAtTime(f, t + .07); });
    const lfo = osc('sine', rnd(5.1, 5.7), t, stop), ld = ac.createGain();
    ld.gain.setValueAtTime(0, t); ld.gain.linearRampToValueAtTime(f * .0065, t + Math.min(.55, dur * .7));
    lfo.connect(ld); ld.connect(o1.frequency); ld.connect(o2.frequency);
    o1.connect(mix); o2.connect(sq); sq.connect(mix);
    const amp = env(t, .045, vel * .1, Math.max(0, dur - .045), .14);
    [[640, 5, 1], [1150, 6, .7], [2500, 7, .35]].forEach(([fr, q, a]) => chain(mix, filt('bandpass', fr, q), gainN(a * 3.2), amp));
    chain(mix, filt('lowpass', 900, .5), gainN(.45), amp);
    amp.connect(dest);
    chain(noiseSrc(t, dur + .2), filt('bandpass', 2300, 1.2), env(t, .03, vel * .045, Math.max(0, dur - .03), .1), dest);
  }
  /* the cornu: bronze — three saws, a filter that opens with how hard it is blown, a little saturation */
  function cornu(dest, m, t, dur, vel) {
    const f = hz(m), stop = t + dur + .45, mix = gainN(.6);
    [-7, 0, 6].forEach(c => { const ff = f * Math.pow(2, c / 1200), o = osc('sawtooth', ff, t, stop); o.frequency.setValueAtTime(ff * .985, t); o.frequency.exponentialRampToValueAtTime(ff, t + .06); o.connect(mix); });
    const lp = filt('lowpass', 260, 1.6);
    lp.frequency.setValueAtTime(260, t); lp.frequency.linearRampToValueAtTime(300 + 2900 * vel, t + .08); lp.frequency.setTargetAtTime(300 + 1500 * vel, t + .1, .25);
    chain(mix, lp, shaper(), env(t, .055, vel * .17, Math.max(0, dur - .055), .22), dest);
  }
  /* a string section: detuned saws spread across the stereo field; legato swells or short spiccato strokes */
  function strings(dest, m, t, dur, vel, short) {
    const f = hz(m), a = short ? .006 : .35 + (1 - vel) * .3, rel = short ? .12 : .9, hold = short ? .05 : Math.max(0, dur - a), stop = t + a + hold + rel + .1;
    const lp = filt('lowpass', short ? 3200 : 1400 + 1700 * vel, .6);
    if (short) { lp.frequency.setValueAtTime(4200, t); lp.frequency.exponentialRampToValueAtTime(1100, t + .15); }
    const n = short ? 3 : 4;
    for (let i = 0; i < n; i++) {
      const c = (i - (n - 1) / 2) * 9 + rnd(-2, 2), o = osc('sawtooth', f * Math.pow(2, c / 1200), t, stop);
      if (ac.createStereoPanner) { const p = ac.createStereoPanner(); p.pan.value = (i / (n - 1) - .5) * .8; o.connect(p); p.connect(lp); } else o.connect(lp);
    }
    chain(lp, env(t, a, vel * (short ? .17 : .06), hold, rel), dest);
  }
  /* a male choir: three voices per note, each with its own wobble, through the formants of a sung vowel */
  const VOWEL = { a: [[750, 1, 8], [1180, .5, 10], [2900, .22, 12]], o: [[450, 1, 8], [800, .6, 10], [2830, .18, 12]], u: [[330, 1, 8], [700, .4, 10], [2600, .14, 12]] };
  function choir(dest, m, t, dur, vel, vowel) {
    const f = hz(m), a = .7, rel = 1.1, stop = t + dur + rel + .2, src = gainN(1);
    for (let i = 0; i < 3; i++) {
      const o = osc('sawtooth', f * Math.pow(2, ((i - 1) * 8 + rnd(-3, 3)) / 1200), t, stop), l = osc('sine', rnd(4.4, 5.6), t, stop), lg = gainN(f * .004);
      l.connect(lg); lg.connect(o.frequency); o.connect(src);
    }
    const amp = env(t, a, vel * .2, Math.max(0, dur - a), rel);
    (VOWEL[vowel] || VOWEL.a).forEach(([fr, g, q]) => chain(src, filt('bandpass', fr, q), gainN(g * 2.4), amp));
    amp.connect(dest);
  }
  /* the hydraulis, the water organ: flue pipes in octaves and a twelfth, a chiff of air, the tremble of the pump */
  function organ(dest, m, t, dur, vel) {
    const f = hz(m), stop = t + dur + .5, amp = env(t, .05, vel * .065, Math.max(0, dur - .05), .3);
    [[1, 'triangle', 1], [2, 'sine', .5], [3, 'sine', .25], [4, 'sine', .16]].forEach(([h, ty, g]) => chain(osc(ty, f * h, t, stop), gainN(g), amp));
    chain(noiseSrc(t, .12), filt('bandpass', Math.min(8000, f * 4), 2), env(t, .01, vel * .05, .02, .05), dest);
    chain(osc('sine', 5.5, t, stop), gainN(vel * .012), amp.gain);
    amp.connect(dest);
  }
  /* a bronze bell (tintinnabulum): inharmonic partials, each dying at its own rate */
  function bell(dest, m, t, vel) {
    const f = hz(m);
    [[1, 1, 2.8], [2.01, .45, 1.9], [2.76, .32, 1.4], [4.07, .18, .9], [5.43, .12, .6]].forEach(([r, a, d]) => {
      const g = ac.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vel * a * .2, t + .004); g.gain.setTargetAtTime(0, t + .004, d / 4);
      chain(osc('sine', f * r, t, t + d + .2), g, dest);
    });
  }
  function drone(dest, m, t, dur, vel) {
    const f = hz(m), stop = t + dur + 1, amp = env(t, .4, vel * .12, Math.max(0, dur - .4), .7);
    osc('sine', f, t, stop).connect(amp);
    chain(osc('sawtooth', f * 1.002, t, stop), filt('lowpass', 260, .7), gainN(.5), amp);
    amp.connect(dest);
  }
  /* ---- drums ---- */
  function taiko(dest, t, vel, big) {
    const f0 = big ? 56 : 80, o = osc('sine', f0 * 2.4, t, t + 1.3), g = ac.createGain();
    o.frequency.exponentialRampToValueAtTime(f0, t + .035); o.frequency.exponentialRampToValueAtTime(f0 * .82, t + .7);
    g.gain.setValueAtTime(vel * .5, t); g.gain.setTargetAtTime(0, t + .02, big ? .26 : .14);
    chain(o, g, dest);
    const ng = ac.createGain(); ng.gain.setValueAtTime(vel * .32, t); ng.gain.setTargetAtTime(0, t, .04);
    chain(noiseSrc(t, .3), filt('lowpass', big ? 700 : 1100, .8), ng, dest);
  }
  function frame(dest, t, vel, low) {
    const f0 = low ? 118 : 205, o = osc('sine', f0 * 1.6, t, t + .45), g = ac.createGain();
    o.frequency.exponentialRampToValueAtTime(f0, t + .03); g.gain.setValueAtTime(vel * (low ? .65 : .38), t); g.gain.setTargetAtTime(0, t + .01, low ? .09 : .05);
    chain(o, g, dest);
    const ng = ac.createGain(); ng.gain.setValueAtTime(vel * .35, t); ng.gain.setTargetAtTime(0, t, .03);
    chain(noiseSrc(t, .2), filt('bandpass', low ? 700 : 1500, .9), ng, dest);
  }
  function jingle(dest, t, vel) {
    const g = ac.createGain(); g.gain.setValueAtTime(0, t);
    [0, .009, .02].forEach((d, i) => { g.gain.setValueAtTime(vel * .3 * (1 - i * .25), t + d); g.gain.setTargetAtTime(0, t + d + .002, .025); });
    chain(noiseSrc(t, .3), filt('highpass', 6000, .7), filt('peaking', 9500, 3, 8), g, dest);
  }
  function crotala(dest, t, vel) { const g = ac.createGain(); g.gain.setValueAtTime(vel * .9, t); g.gain.setTargetAtTime(0, t, .012); chain(noiseSrc(t, .1), filt('bandpass', 2600, 4), g, dest); }
  function sistrum(dest, t, vel) {
    const g = ac.createGain(); g.gain.setValueAtTime(0, t);
    [0, .05, .1, .15].forEach((d, i) => { g.gain.setValueAtTime(vel * .16 * (1 - i * .2), t + d); g.gain.setTargetAtTime(0, t + d + .003, .03); });
    chain(noiseSrc(t, .5), filt('highpass', 4500), filt('peaking', 5200, 12, 14), filt('peaking', 7600, 12, 12), g, dest);
  }
  function swell(dest, t, dur, vel) {
    const lp = filt('lowpass', 2000, .5), g = ac.createGain();
    lp.frequency.setValueAtTime(2000, t); lp.frequency.exponentialRampToValueAtTime(12000, t + dur);
    g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(vel * .22, t + dur); g.gain.setTargetAtTime(0, t + dur, .03);
    chain(noiseSrc(t, dur + .15), filt('highpass', 3500), lp, g, dest);
  }
  function crash(dest, t, vel) { const g = ac.createGain(); g.gain.setValueAtTime(vel * .2, t); g.gain.setTargetAtTime(0, t, .4); chain(noiseSrc(t, 2), filt('highpass', 4800), filt('peaking', 6500, 2, 4), g, dest); }

  /* ============================ the score ============================ */
  const MODES = { ionian: [0, 2, 4, 5, 7, 9, 11], dorian: [0, 2, 3, 5, 7, 9, 10], phrygian: [0, 1, 3, 5, 7, 8, 10], lydian: [0, 2, 4, 6, 7, 9, 11], mixo: [0, 2, 4, 5, 7, 9, 10], aeolian: [0, 2, 3, 5, 7, 8, 10], hijaz: [0, 1, 4, 5, 7, 8, 10] };
  const pitch = (th, d) => { const m = MODES[th.mode], o = Math.floor(d / 7), k = ((d % 7) + 7) % 7; return th.root + m[k] + 12 * o; };
  /* phrases: [scale degree, length in eighths]; null is a rest. Each is two bars. */
  const P = {
    leit: [[0, 3], [1, 1], [2, 2], [4, 2], [3, 3], [2, 1], [1, 2], [0, 2]],                          // the Imperium theme
    leitB: [[4, 2], [5, 2], [4, 1], [3, 1], [2, 2], [3, 3], [1, 1], [0, 4]],                         // ...and its answer
    leitSlow: [[0, 6], [2, 2], [4, 4], [3, 4]], leitSlowB: [[2, 4], [1, 4], [0, 8]],
    street: [[4, 1], [5, 1], [4, 1], [2, 1], [1, 2], [2, 2], [4, 2], [null, 2], [5, 1], [4, 1], [2, 2]],
    street2: [[2, 2], [4, 1], [2, 1], [1, 2], [0, 2], [-1, 1], [0, 1], [1, 2], [0, 4]],
    tav: [[0, 1], [2, 1], [4, 1], [2, 1], [3, 1], [1, 1], [2, 2], [0, 1], [2, 1], [4, 1], [5, 1], [4, 2], [null, 2]],
    tav2: [[4, 1], [4, 1], [3, 1], [2, 1], [1, 2], [2, 1], [0, 1], [-1, 2], [0, 1], [1, 1], [2, 2], [0, 2]],
    call: [[0, 1], [0, 1], [4, 2], [null, 2], [4, 1], [4, 1], [7, 2], [4, 2], [null, 4]],
    call2: [[7, 2], [4, 1], [4, 1], [2, 2], [4, 2], [0, 4], [null, 4]],
    east: [[0, 2], [1, 1], [2, 1], [1, 2], [0, 1], [-1, 1], [0, 4], [2, 1], [3, 1], [2, 2]],
    east2: [[4, 3], [3, 1], [2, 2], [1, 2], [2, 1], [1, 1], [0, 6]],
    slow: [[0, 4], [2, 2], [1, 2], [0, 4], [null, 4]], slow2: [[4, 4], [3, 2], [2, 2], [1, 6], [null, 2]],
    dance: [[0, 2], [2, 1], [4, 1], [2, 2], [3, 2], [2, 1], [1, 1], [0, 2]], dance2: [[4, 1], [5, 1], [4, 1], [2, 1], [0, 2], [1, 2], [2, 2], [0, 2]],
    sea: [[0, 3], [2, 1], [4, 2], [3, 3], [2, 3]], sea2: [[4, 2], [2, 1], [1, 3], [0, 2], [-1, 1], [0, 3]],
    war: [[0, 2], [1, 1], [0, 1], [3, 2], [1, 2], [0, 1], [0, 1], [4, 2], [3, 2], [1, 2]], war2: [[0, 3], [1, 1], [2, 2], [4, 2], [3, 4], [1, 4]],
    home: [[2, 1], [4, 1], [5, 2], [4, 1], [2, 1], [0, 2], [1, 1], [2, 1], [4, 2], [2, 4]], home2: [[5, 2], [4, 1], [2, 1], [4, 2], [1, 2], [2, 1], [1, 1], [0, 2], [null, 4]],
    bath: [[4, 2], [6, 2], [7, 2], [6, 2], [4, 4], [null, 4]], bath2: [[2, 2], [4, 2], [3, 2], [1, 2], [0, 6], [null, 2]],
    race: [[0, 1], [2, 1], [4, 1], [7, 1], [6, 1], [4, 1], [2, 2], [4, 1], [5, 1], [4, 1], [2, 1], [1, 2], [0, 2]],
    court: [[2, 2], [4, 2], [3, 1], [2, 1], [1, 2], [2, 3], [0, 1], [1, 2], [null, 2]], court2: [[4, 3], [5, 1], [4, 2], [2, 2], [3, 2], [1, 2], [0, 4]]
  };
  /* percussion grids, sixteenth by sixteenth: T big war drum, t small war drum, F low frame drum, f high frame drum,
     j tambourine, k crotala, s sistrum. Each kind has a sparse and a full version, chosen by intensity. */
  const PERC = {
    street: ['F.....f.F...f...', 'F..kf.j.F.k.f.jk'],
    ceremony: ['T.......t.......', 'T...f...t...f.j.'],
    tavern: ['F..k..f.F.k.f..j', 'F.kkf.jkF.kkf.jk'],
    march: ['T...f.f.t...f.ff', 'T.f.f.ffT.f.fftf'],
    race: ['T.f.t.f.T.f.t.ff', 'TjfjtjfjTjfjtjff'],
    sea: ['F.....f.....', 'F..s..f..s..'],
    distant: ['F...............', 'F.......f.......'],
    temple: ['................', 's.......s.......'],
    soft: ['f.......f.......', 'f.......f...j...'],
    spar: ['T..kt.k.T.kkt.k.', 'T.ktt.k.TtkkttkT'],
    dance: ['F...f...f...', 'F.j.fkj.f.jk'],
    war: ['T...t.t.T...t.tt', 'T.tTt.ttT.tTttTT'],
    none: ['', '']
  };
  /* the themes. root = the tonic (MIDI), meter = eighths in a bar, prog = the chord (scale degree) of each of the
     eight bars, base = how busy it is before anything happens; lead/arp/pad/bass name the players. */
  const L = (inst, oct, a, b, more) => Object.assign({ inst, oct, a, b: b || a }, more || {});
  const THEMES = {
    anthem: { bpm: 70, root: 50, mode: 'dorian', meter: 8, prog: [0, 0, 3, 4, 5, 3, 4, 4], lead: L('cornu', 1, [P.leit], [P.leitB]), pad: { inst: 'strings', oct: 1 }, choir: { at: .45, vowel: 'a' }, bass: 'drone', perc: 'ceremony', arp: { inst: 'kithara', oct: 1, rate: 8, seq: [0, 1, 2, 1], min: .5 }, base: .62, swell: 1 },
    triumph: { bpm: 92, root: 55, mode: 'ionian', meter: 8, prog: [0, 3, 4, 0, 5, 3, 4, 4], lead: L('cornu', 1, [P.leit, P.call], [P.leitB]), pad: { inst: 'strings', oct: 1 }, choir: { at: .5, vowel: 'a' }, bass: 'walk', perc: 'ceremony', arp: { inst: 'kithara', oct: 1, rate: 8, seq: [0, 1, 2, 3] }, base: .8, swell: 1 },
    forum: { bpm: 84, root: 57, mode: 'dorian', meter: 8, prog: [0, 6, 3, 4, 0, 3, 6, 4], lead: L('aulos', 1, [P.leit, P.street], [P.leitB, P.court2], { alt: 'cornu' }), pad: { inst: 'strings', oct: 0 }, bass: 'drone', perc: 'ceremony', arp: { inst: 'kithara', oct: 0, rate: 8, seq: [0, 2, 1, 2] }, base: .5 },
    via: { bpm: 96, root: 55, mode: 'mixo', meter: 8, prog: [0, 0, 6, 6, 3, 3, 4, 0], lead: L('aulos', 1, [P.street, P.street2]), bass: 'walk', perc: 'street', arp: { inst: 'kithara', oct: 0, rate: 8, seq: [0, 2, 1, 2] }, pad: { inst: 'strings', oct: 0, min: .55 }, base: .45 },
    subura: { bpm: 112, root: 52, mode: 'aeolian', meter: 8, swing: .28, prog: [0, 0, 5, 6, 0, 3, 4, 4], lead: L('aulos', 1, [P.tav, P.tav2]), bass: 'walk', perc: 'tavern', arp: { inst: 'kithara', oct: 0, rate: 16, seq: [0, 1, 2, 1, 3, 2, 1, 2] }, base: .6 },
    field: { bpm: 100, root: 50, mode: 'dorian', meter: 8, prog: [0, 0, 6, 4, 0, 3, 6, 0], lead: L('cornu', 1, [P.call, P.call2], [P.leit]), pad: { inst: 'strings', oct: 0 }, bass: 'pulse', perc: 'march', base: .6 },
    circus: { bpm: 138, root: 60, mode: 'mixo', meter: 8, prog: [0, 6, 3, 4, 0, 6, 3, 4], lead: L('cornu', 0, [P.race], [P.call]), bass: 'pulse', perc: 'race', arp: { inst: 'spiccato', oct: 0, rate: 16, seq: [0, 0, 2, 0, 1, 0, 2, 1] }, pad: { inst: 'organ', oct: 0 }, base: .75, swell: 1 },
    port: { bpm: 80, root: 52, mode: 'aeolian', meter: 6, prog: [0, 5, 6, 4, 0, 3, 6, 0], lead: L('aulos', 1, [P.sea, P.sea2]), pad: { inst: 'strings', oct: 0 }, bass: 'drone', perc: 'sea', arp: { inst: 'kithara', oct: 0, rate: 8, seq: [0, 1, 2, 3, 2, 1] }, base: .4 },
    voyage: { bpm: 86, root: 50, mode: 'aeolian', meter: 6, prog: [0, 6, 5, 6, 0, 3, 4, 0], lead: L('aulos', 1, [P.sea2, P.sea]), pad: { inst: 'strings', oct: 1 }, choir: { at: .7, vowel: 'o' }, bass: 'drone', perc: 'sea', arp: { inst: 'kithara', oct: 0, rate: 8, seq: [0, 1, 2, 3, 2, 1] }, base: .48 },
    far: { bpm: 70, root: 57, mode: 'hijaz', meter: 8, prog: [0, 0, 1, 0, 0, 6, 1, 0], lead: L('aulos', 0, [P.east, P.east2]), bass: 'drone', perc: 'distant', arp: { inst: 'kithara', oct: 0, rate: 8, seq: [0, 2, 1, 2], min: .5 }, base: .3, rest: .35 },
    temple: { bpm: 56, root: 50, mode: 'dorian', meter: 8, prog: [0, 0, 6, 0, 3, 3, 4, 0], lead: L('bell', 2, [P.slow, P.slow2]), pad: { inst: 'choir', oct: 0, vowel: 'o' }, bass: 'drone', perc: 'temple', base: .3, rest: .3 },
    atrium: { bpm: 76, root: 53, mode: 'ionian', meter: 8, prog: [0, 3, 4, 0, 5, 3, 1, 4], lead: L('kithara', 1, [P.home, P.home2]), pad: { inst: 'strings', oct: 0 }, bass: 'walk', perc: 'soft', arp: { inst: 'kithara', oct: 0, rate: 8, seq: [0, 2, 1, 2], min: .45 }, base: .35 },
    court: { bpm: 72, root: 53, mode: 'mixo', meter: 8, prog: [0, 1, 6, 4, 0, 3, 6, 4], lead: L('aulos', 1, [P.court, P.court2]), pad: { inst: 'organ', oct: 0 }, bass: 'drone', perc: 'soft', arp: { inst: 'kithara', oct: 0, rate: 8, seq: [0, 1, 2, 1] }, base: .4 },
    baths: { bpm: 64, root: 55, mode: 'lydian', meter: 8, prog: [0, 1, 0, 1, 5, 4, 1, 0], lead: L('kithara', 1, [P.bath, P.bath2]), pad: { inst: 'organ', oct: 0 }, bass: 'drone', perc: 'temple', arp: { inst: 'kithara', oct: 1, rate: 16, seq: [0, 1, 2, 3, 2, 1, 0, 1] }, base: .32 },
    ludus: { bpm: 122, root: 52, mode: 'phrygian', meter: 8, prog: [0, 1, 0, 6, 0, 1, 5, 6], lead: L('cornu', 1, [P.war, P.call]), bass: 'pulse', perc: 'spar', arp: { inst: 'spiccato', oct: 0, rate: 16, seq: [0, 0, 1, 0, 2, 0, 1, 0] }, base: .7 },
    harvest: { bpm: 108, root: 57, mode: 'mixo', meter: 6, prog: [0, 6, 0, 4, 0, 3, 6, 0], lead: L('kithara', 1, [P.dance, P.dance2], null, { alt: 'aulos' }), bass: 'walk', perc: 'dance', arp: { inst: 'kithara', oct: 0, rate: 8, seq: [0, 1, 2, 1, 2, 1] }, base: .55 },
    siege: { bpm: 140, root: 50, mode: 'phrygian', meter: 8, prog: [0, 0, 1, 0, 5, 6, 1, 0], lead: L('cornu', 1, [P.war, P.war2], [P.leit]), pad: { inst: 'strings', oct: 0 }, choir: { at: .72, vowel: 'a' }, bass: 'pulse', perc: 'war', arp: { inst: 'spiccato', oct: -1, rate: 16, seq: [0, 0, 2, 0, 1, 0, 2, 1] }, base: .62, swell: 1 },
    night: { bpm: 54, root: 50, mode: 'aeolian', meter: 8, prog: [0, 5, 3, 4, 0, 5, 6, 0], lead: L('kithara', 1, [P.slow, P.slow2]), pad: { inst: 'strings', oct: 0 }, bass: 'drone', perc: 'none', base: .2, rest: .45 },
    plate: { bpm: 48, root: 50, mode: 'aeolian', meter: 8, prog: [0, 0, 5, 5, 3, 3, 4, 4], lead: L('bell', 2, [P.leitSlow], [P.leitSlowB]), pad: { inst: 'choir', oct: 0, vowel: 'u' }, bass: 'drone', perc: 'none', base: .3 }
  };
  const ROLE = { lead: [1.5, .08, .32], alt: [1.25, -.25, .3], arp: [.75, .32, .22], pad: [1, 0, .4], bass: [.32, 0, .1], perc: [.9, 0, .14], hi: [.65, .38, .14], choir: [.7, 0, .5] };

  /* ============================ the player ============================ */
  function Player(name) {
    const th = THEMES[name] || THEMES.via, me = this;
    me.name = name; me.th = th;
    me.group = gainN(0); me.group.connect(B.musIn);
    me.ch = {}; Object.keys(ROLE).forEach(k => { me.ch[k] = channel(me.group, ROLE[k][1], ROLE[k][2]); me.ch[k].gain.value = ROLE[k][0]; });
    me.s16 = 60 / th.bpm / 4; me.barDur = me.s16 * th.meter * 2;
    me.bar = 0; me.cycle = 0; me.barT = ac.currentTime + .08; me.voicing = null; me.lvl = th.base;
    const fadeIn = name === 'siege' ? .3 : name === 'plate' ? .6 : 1.4;
    me.group.gain.setValueAtTime(0, ac.currentTime); me.group.gain.linearRampToValueAtTime(1, ac.currentTime + fadeIn);
  }
  Player.prototype.stop = function (fast) {
    const t = ac.currentTime; this.dead = true;
    this.group.gain.cancelScheduledValues(t); this.group.gain.setValueAtTime(this.group.gain.value, t); this.group.gain.setTargetAtTime(0, t, fast ? .08 : .7);
    const g = this.group; setTimeout(() => { try { g.disconnect(); } catch (e) { } }, fast ? 1500 : 6000);
  };
  /* the notes of a chord built on a scale degree, voiced near the last voicing so the harmony moves smoothly */
  function voice(me, deg, oct) {
    const th = me.th, center = th.root + 12 * (oct + 1) - 5, tones = [deg, deg + 2, deg + 4].map(d => pitch(th, d));
    const v = tones.map((m, i) => { let x = m; while (x < center - 6) x += 12; while (x >= center + 6) x -= 12; const prev = me.voicing && me.voicing[i]; if (prev !== undefined && Math.abs(x + 12 - prev) < Math.abs(x - prev) && x + 12 < center + 10) x += 12; return x; });
    me.voicing = v; return v.sort((a, b) => a - b);
  }
  Player.prototype.level = function () { driveSm += (drive - driveSm) * .35; return clamp(this.th.base + (driveSm - .3) * .55 + (this.bar >= 4 ? .06 : 0), 0, 1); };
  Player.prototype.playBar = function () {
    const me = this, th = me.th, t0 = me.barT, b = me.bar, chord = th.prog[b], lvl = me.level(), s16 = me.s16, steps = th.meter * 2, bd = me.barDur;
    const hum = (s) => s ? rnd(-.006, .006) : 0, sw = s => (th.swing && s % 4 === 2 ? th.swing * s16 * 2 : 0);
    const T = s => t0 + s * s16 + sw(s) + hum(s);
    /* the floor: bass */
    const root = pitch(th, chord), bassM = root - 12 >= 36 ? root - 12 : root;
    if (th.bass === 'drone') drone(me.ch.bass, bassM - 12 >= 33 ? bassM - 12 : bassM, t0, bd * .98, .8);
    else if (th.bass === 'walk' && lvl > .12) { kithara(me.ch.bass, bassM - 12, t0, .9, bd * .45); kithara(me.ch.bass, pitch(th, chord + 4) - 24, T(steps / 2), .7, bd * .4); if (lvl > .5) drone(me.ch.bass, bassM - 12, t0, bd * .9, .35); }
    else if (th.bass === 'pulse') { for (let s = 0; s < steps; s += 2) strings(me.ch.bass, bassM - 12 + (s === steps - 2 && lvl > .6 ? 12 : 0), T(s), s16 * 1.5, s % 8 === 0 ? .95 : .7, true); if (lvl > .55) drone(me.ch.bass, bassM - 12, t0, bd * .95, .5); }
    /* the harmony: a pad held through the bar, the choir when the moment is big enough */
    if (th.pad && lvl >= (th.pad.min || 0)) {
      const v = voice(me, chord, th.pad.oct);
      v.forEach((m, i) => {
        if (th.pad.inst === 'strings') strings(me.ch.pad, m, t0, bd * 1.02, .45 + lvl * .4);
        else if (th.pad.inst === 'organ') organ(me.ch.pad, m, t0, bd * .98, .5 + lvl * .4);
        else if (th.pad.inst === 'choir') choir(me.ch.pad, m, t0 + i * .03, bd * 1.02, .45 + lvl * .4, th.pad.vowel);
      });
    }
    if (th.choir && lvl >= th.choir.at && b % 2 === 0) voice(me, chord, 0).forEach(m => choir(me.ch.choir, m, t0, bd * 2, .5 + lvl * .4, th.choir.vowel));
    /* the tune: a two-bar phrase written for the place, kept on the chords under it, played like a person plays */
    if (b % 2 === 0 && th.lead) {
      const sec = b >= 4 ? th.lead.b : th.lead.a, ph = sec[(me.cycle + b / 2) % sec.length];
      if (Math.random() > (th.rest || .18) * (1.2 - lvl)) {
        const useAlt = th.lead.alt && b >= 4 && me.cycle % 2 === 1, inst = useAlt ? th.lead.alt : th.lead.inst, ch = useAlt ? me.ch.alt : me.ch.lead;
        const total = ph.reduce((a, n) => a + n[1], 0); let pos = 0;
        ph.forEach(([d, len], i) => {
          const at = pos; pos += len; if (d === null) return;
          const barOf = Math.floor(at / th.meter), chordHere = th.prog[(b + barOf) % 8];
          let deg = d; const strong = at % 2 === 0;
          if (strong) { const rel = (((deg - chordHere) % 7) + 7) % 7; if (rel === 1 || rel === 3 || rel === 5) deg -= 1; else if (rel === 6) deg += 1; }
          const m = pitch(th, deg) + 12 * th.lead.oct, t = t0 + at * s16 * 2 + (at % 2 ? 0 : 0) + rnd(-.008, .008);
          const vel = clamp(.55 + .3 * Math.sin(Math.PI * (at + len / 2) / total) + rnd(-.06, .06), .3, 1) * (.72 + .28 * lvl);
          const dur = len * s16 * 2;
          if (inst === 'aulos') { if (len >= 2 && Math.random() < .18) aulos(ch, m + 2, t - .05, .05, vel * .8); aulos(ch, m, t, dur * .94, vel); }
          else if (inst === 'cornu') cornu(ch, m, t, dur * .9, vel);
          else if (inst === 'kithara') { kithara(ch, m, t, vel, dur * 1.6); if (lvl > .5 && strong) kithara(ch, m - 12, t + .012, vel * .5, dur * 1.4); }
          else if (inst === 'bell') bell(ch, m, t, vel * .9);
        });
      }
    }
    /* the motion: arpeggios on the lyre, or strings bowing short notes under a battle */
    if (th.arp && lvl >= (th.arp.min || .22)) {
      const tones = [0, 2, 4, 7].map(x => pitch(th, chord + x) + 12 * th.arp.oct), every = th.arp.rate === 16 ? 1 : 2;
      for (let s = 0, i = 0; s < steps; s += every, i++) {
        if (th.arp.rate === 16 && lvl < .5 && s % 2) continue;
        const m = tones[th.arp.seq[i % th.arp.seq.length]], v = (s % (steps / 2) === 0 ? .62 : .42) * (.7 + .3 * lvl);
        if (th.arp.inst === 'spiccato') strings(me.ch.arp, m, T(s), s16 * .9, v, true);
        else kithara(me.ch.arp, m, T(s), v, s16 * every * 2.5);
      }
    }
    /* the drums */
    const grid = (PERC[th.perc] || PERC.none)[lvl > .55 ? 1 : 0];
    for (let s = 0; s < grid.length && s < steps; s++) {
      const c = grid[s]; if (c === '.') continue;
      let v = (s === 0 ? 1 : s % 4 === 0 ? .82 : .62) * rnd(.88, 1.05) * (.7 + .3 * lvl);
      const tt = T(s);
      if (c === 'T') taiko(me.ch.perc, tt, v, true); else if (c === 't') taiko(me.ch.perc, tt, v * .75, false);
      else if (c === 'F') frame(me.ch.perc, tt, v, true); else if (c === 'f') frame(me.ch.perc, tt, v * .8, false);
      else if (c === 'j') jingle(me.ch.hi, tt, v); else if (c === 'k') crotala(me.ch.hi, tt, v * .7); else if (c === 's') sistrum(me.ch.hi, tt, v);
    }
    /* the turn of the eight bars: a drum fill and a rising cymbal into the top, when the music is up */
    if (b === 7 && lvl > .6 && th.perc !== 'none') { for (let s = steps - 4; s < steps; s++) taiko(me.ch.perc, T(s), .55 + (s - steps + 4) * .1, false); if (th.swell) swell(me.ch.hi, t0 + bd * .5, bd * .5, .8); }
    if (b === 0 && me.cycle > 0 && th.swell && lvl > .6) crash(me.ch.hi, t0, .7);
    me.barT += bd; me.bar = (b + 1) % 8; if (!me.bar) me.cycle++;
  };

  function pump() {
    if (!ac || !cur || cur.dead) return;
    const look = document.hidden ? 2.2 : .25;                          // a hidden tab only wakes once a second
    let n = 0;
    if (cur.barT < ac.currentTime - 1) cur.barT = ac.currentTime + .05;    // after a long sleep, start again from now
    while (cur.barT < ac.currentTime + look && n++ < 4) cur.playBar();
  }
  function music(name) {
    wanted = name;
    if (muted || !ctx()) return;
    if (cur && cur.name === name && !cur.dead) return;
    if (cur) cur.stop(name === 'siege' || name === 'plate');
    cur = new Player(THEMES[name] ? name : 'via');
    if (!timer) timer = setInterval(pump, 50);
    pump();
  }
  function stop() { if (cur) cur.stop(true); cur = null; }

  /* ============================ sound effects ============================ */
  function duck(to, hold) { if (!B) return; const g = B.duck.gain, t = ac.currentTime; g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.setTargetAtTime(to, t, .04); g.setTargetAtTime(1, t + hold, .35); }
  function sfx(n) {
    if (muted || !ctx()) return;
    const t = ac.currentTime + .01, d = B.sfxCh;
    if (n === 'click') { crotala(d, t, .28); kithara(d, 84, t, .18, .05); }
    else if (n === 'coin') { bell(d, 88, t, .7); bell(d, 95, t + .07, .55); jingle(d, t + .02, .35); }
    else if (n === 'door') { frame(d, t, .9, true); frame(d, t + .12, .7, true); const o = osc('sawtooth', 92, t + .05, t + .5); o.frequency.linearRampToValueAtTime(70, t + .45); chain(o, filt('bandpass', 900, 8), env(t + .05, .05, .05, .25, .1), d); }
    else if (n === 'sword') {
      const bp = filt('bandpass', 2500, 3); bp.frequency.setValueAtTime(2500, t); bp.frequency.exponentialRampToValueAtTime(7000, t + .18);
      chain(noiseSrc(t, .3), bp, env(t, .01, .5, .08, .12), d);
      [[1210, .3], [1780, .2], [2530, .15], [3100, .1]].forEach(([f, a]) => { const g = ac.createGain(); g.gain.setValueAtTime(a * .4, t + .02); g.gain.setTargetAtTime(0, t + .02, .1); chain(osc('sine', f, t + .02, t + .7), g, d); });
      duck(.75, .25);
    }
    else if (n === 'crowd') {
      [[300, .5], [620, .45], [1150, .35], [2400, .2]].forEach(([f, a]) => { const bp = filt('bandpass', f, 1.5), l = osc('sine', rnd(2, 4), t, t + 2.2), lg = gainN(f * .15); l.connect(lg); lg.connect(bp.frequency); chain(noiseSrc(t, 2.2), bp, env(t, .25, a, .5, 1.2), d); });
      duck(.6, 1.2);
    }
    else if (n === 'water') { const lp = filt('lowpass', 500, 1); chain(osc('sine', .8, t, t + 1), gainN(400), lp.frequency); chain(noiseSrc(t, 1), lp, env(t, .1, .4, .3, .4), d); for (let i = 0; i < 4; i++) { const tt = t + rnd(0, .6), o = osc('sine', 600, tt, tt + .06); o.frequency.exponentialRampToValueAtTime(1300, tt + .05); chain(o, env(tt, .005, .08, .02, .03), d); } }
    else if (n === 'scroll') { for (let i = 0; i < 6; i++) { const tt = t + i * rnd(.025, .05); chain(noiseSrc(tt, .06), filt('highpass', 3000), env(tt, .003, .18, .01, .03), d); } }
    else if (n === 'arrow') { const bp = filt('bandpass', 1200, 2); bp.frequency.setValueAtTime(1200, t); bp.frequency.exponentialRampToValueAtTime(3800, t + .22); chain(noiseSrc(t, .3), bp, env(t, .12, .35, .02, .08), d); frame(d, t + .32, .5, true); }
    else if (n === 'bad') { kithara(d, 50, t, .8, .6); kithara(d, 51, t + .09, .7, .6); taiko(d, t, .4, false); }
    else if (n === 'good') { [72, 76, 79, 84].forEach((m, i) => kithara(d, m, t + i * .065, .65, .9)); bell(d, 96, t + .3, .35); }
    else if (n === 'fanfare') {
      duck(.25, 2.6);
      [[60, 0, .18], [64, .2, .18], [67, .4, .18], [72, .62, 1.3]].forEach(([m, dt, len]) => cornu(d, m, t + dt, len, .95));
      cornu(d, 64, t + .62, 1.3, .8); cornu(d, 48, t + .62, 1.3, .7);
      taiko(d, t, 1, true); taiko(d, t + .62, 1, true); crash(d, t + .62, .9);
      [60, 64, 67].forEach(m => choir(d, m - 12, t + .62, 1.4, .8, 'a'));
      bell(d, 84, t + 1.5, .6);
    }
    else if (n === 'dirge') {
      duck(.25, 3.4);
      [[50, 0, .6], [48, .65, .6], [46, 1.3, .6], [43, 1.95, 1.8]].forEach(([m, dt, len]) => cornu(d, m, t + dt, len, .75));
      [43, 46, 50].forEach(m => choir(d, m, t + .2, 3, .7, 'u'));
      taiko(d, t, .9, true); taiko(d, t + 1.95, .9, true);
    }
    else { crotala(d, t, .25); }
  }

  /* ============================ waking up, and the controls ============================ */
  const unlock = () => { if (muted) return; if (!ctx()) return; if (wanted && (!cur || cur.dead)) music(wanted); };
  ['pointerdown', 'mousedown', 'keydown', 'touchstart'].forEach(ev => window.addEventListener(ev, unlock, { capture: true, passive: true }));
  document.addEventListener('visibilitychange', () => { if (!document.hidden && ac && !muted) { ctx(); pump(); } });
  /* a song from Moundshroud's Music tab outranks the game's music: the music bus goes silent while it plays */
  const songOn = () => { try { return window.parent !== window && typeof window.parent.msSongOn === 'function' && window.parent.msSongOn(); } catch (e) { return false; } };
  setInterval(() => { if (!B || muted) return; const want = songOn() ? 0 : volM; if (Math.abs(B.mus.gain.value - want) > .01) B.mus.gain.setTargetAtTime(want, ac.currentTime, .15); }, 700);
  function enable(on) {
    muted = !on; SET('imperium.sound', on ? '1' : '0');
    if (B) { const t = ac.currentTime; [[B.mus, volM], [B.sfxG, volS]].forEach(([n, v]) => { n.gain.cancelScheduledValues(t); n.gain.setTargetAtTime(on ? v : 0, t, .05); }); }
    if (!on) stop(); else { ctx(); if (wanted) music(wanted); }
    return muted;
  }
  return {
    music, stop, sfx, enable,
    get muted() { return muted; },
    get theme() { return cur && !cur.dead ? cur.name : null; },
    get state() { return ac ? ac.state : 'none'; },
    get themes() { return Object.keys(THEMES); },
    toggle() { return enable(muted); },
    /* 0 = calm, 1 = everything at once: the battlefield raises it as the lines meet */
    intensity(x) { drive = clamp(+x || 0, 0, 1); },
    volume(kind, v) {
      if (v === undefined) return kind === 'sfx' ? volS : volM;
      v = clamp(+v, 0, 1);
      if (kind === 'sfx') { volS = v; SET('imperium.vol.sfx', v); if (B && !muted) B.sfxG.gain.setTargetAtTime(v, ac.currentTime, .05); }
      else { volM = v; SET('imperium.vol.music', v); if (B && !muted) B.mus.gain.setTargetAtTime(v, ac.currentTime, .05); }
      return v;
    },
    wake() { if (!muted) ctx(); }
  };
})();

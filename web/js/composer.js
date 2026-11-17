// Studio > Composer: write music on a real score (staff notation) and play it back. Treble, bass and drum staves, as many parts
// as you like, key and time signatures, tempo, whole to 16th notes, rests, dots, ties, accidentals and chords. Click the staff,
// type A-G or press the on-screen piano to write; 1-5 pick the note length; arrows move. 47 instruments are synthesised here
// with the Web Audio API (no downloads). Easy helpers fill in chords, a drum beat or a melody idea. Scores are saved in this
// browser profile (ls 'cmp_index' and 'cmp_s_<id>'); export MIDI or WAV. Time is counted in 32nd notes (a quarter is 8 units).
(() => {
  if (!A.studio) return; const esc = A.studio.esc;
  /* ================================================================ music model */
  const LET = 'CDEFGAB', PC = [0, 2, 4, 5, 7, 9, 11], SH = [3, 0, 4, 1, 5, 2, 6], FL = [6, 2, 5, 1, 4, 0, 3];
  const mod = (a, b) => ((a % b) + b) % b, clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const keyAlt = (k, l) => k > 0 ? (SH.indexOf(l) < k ? 1 : 0) : k < 0 ? (FL.indexOf(l) < -k ? -1 : 0) : 0;
  const midiOf = n => (Math.floor(n.s / 7) + 1) * 12 + PC[mod(n.s, 7)] + (n.a || 0);
  const ACC = { '-2': '𝄫', '-1': '♭', '0': '♮', '1': '♯', '2': '𝄪' };
  const nameOf = n => LET[mod(n.s, 7)] + ['𝄫', '♭', '', '♯', '𝄪'][(n.a || 0) + 2] + Math.floor(n.s / 7);
  const MAJ = ['C♭', 'G♭', 'D♭', 'A♭', 'E♭', 'B♭', 'F', 'C', 'G', 'D', 'A', 'E', 'B', 'F♯', 'C♯'], MIN = ['A♭', 'E♭', 'B♭', 'F', 'C', 'G', 'D', 'A', 'E', 'B', 'F♯', 'C♯', 'G♯', 'D♯', 'A♯'];
  const keyLabel = k => MAJ[k + 7] + ' major / ' + MIN[k + 7] + ' minor (' + (k ? Math.abs(k) + (k > 0 ? ' sharp' : ' flat') + (Math.abs(k) > 1 ? 's' : '') : 'no sharps or flats') + ')';
  const DUR = [[32, 'Whole', '5', '4 beats'], [16, 'Half', '4', '2 beats'], [8, 'Quarter', '3', '1 beat'], [4, 'Eighth', '2', '½ beat'], [2, '16th', '1', '¼ beat']];
  const FIT = [48, 32, 24, 16, 12, 8, 6, 4, 3, 2, 1], DV = { 48: [32, 1], 32: [32, 0], 24: [16, 1], 16: [16, 0], 12: [8, 1], 8: [8, 0], 6: [4, 1], 4: [4, 0], 3: [2, 1], 2: [2, 0], 1: [1, 0] };
  const len = e => e.d * (e.dot ? 1.5 : 1), mlen = sc => sc.ts[0] * 32 / sc.ts[1];
  const timed = p => { let t = 0; return p.ev.map(e => { const o = { t, e }; t += len(e); return o; }); };
  const endOf = p => p.ev.reduce((a, e) => a + len(e), 0);
  const fit = u => { const o = []; while (u > 0) { const f = FIT.find(x => x <= u) || 1; o.push(f); u -= f; } return o; };
  const mkEv = (f, base) => Object.assign({}, base, { d: DV[f][0], dot: DV[f][1] });
  function spans(t, L, ML) { const out = []; let a = t; const end = t + L; while (a < end) { const b = Math.min(end, (Math.floor(a / ML) + 1) * ML); fit(b - a).forEach(f => { out.push([a, f]); a += f; }); } return out; }
  function rebuild(list, ML) { list.sort((x, y) => x.t - y.t); const ev = []; let t = 0; list.forEach(x => { if (x.t < t) return; if (x.t > t) spans(t, x.t - t, ML).forEach(([, f]) => ev.push(mkEv(f, { r: 1 }))); ev.push(x.e); t = x.t + len(x.e); }); while (ev.length && ev[ev.length - 1].r) ev.pop(); return ev; }
  /* write a note/chord ({n:[...]}) or a rest ({r:1}) of length L at time t, overwriting what was there; splits at barlines with ties */
  function place(p, t, base, L, ML) {
    const end = t + L, list = timed(p).filter(x => !(x.t >= t && x.t < end));
    list.forEach(x => { if (x.t < t && x.t + len(x.e) > t) { x.e = mkEv(fit(t - x.t)[0], x.e); x.e.tie = 0; } });
    const ps = spans(t, L, ML); ps.forEach(([a, f], i) => { const e = mkEv(f, base.r ? { r: 1 } : { n: base.n.map(n => ({ s: n.s, a: n.a || 0 })), tie: i < ps.length - 1 ? 1 : (base.tie || 0) }); list.push({ t: a, e }); });
    p.ev = rebuild(list, ML);
  }
  function reflow(p, ML) { const list = []; timed(p).forEach(x => { const ps = spans(x.t, len(x.e), ML); ps.forEach(([a, f], i) => { const e = mkEv(f, x.e); if (!x.e.r) e.tie = i < ps.length - 1 ? 1 : (x.e.tie || 0); list.push({ t: a, e }); }); }); p.ev = rebuild(list, ML); }
  /* ================================================================ instruments (all synthesised) */
  const INST = {}, GROUPS = [];
  const def = (id, name, grp, gm, clef, p) => { INST[id] = Object.assign({ id, name, grp, gm, clef }, p); if (!GROUPS.includes(grp)) GROUPS.push(grp); };
  def('piano', 'Grand piano', 'Keyboards', 0, 'treble', { w: [1, .55, .32, .22, .13, .09, .06, .04, .025, .015], dec: 3.2, a: .003, r: .3, fc: 14, fe: 2, fd: .6, uni: 2.5, v: .42 });
  def('epiano', 'Electric piano', 'Keyboards', 4, 'treble', { part: [[1, 1, 1], [2, .12, .5], [14, .05, .06]], dec: 2.4, r: .3, v: .4 });
  def('harpsi', 'Harpsichord', 'Keyboards', 6, 'treble', { ks: .996, br: .9, sus: 2, r: .15, v: .3 });
  def('organ', 'Church organ', 'Keyboards', 19, 'treble', { w: [1, .9, .6, .7, .3, .4, .15, .3, .1, .15], a: .04, d: .1, s: 1, r: .25, fc: 20, v: .22 });
  def('rorgan', 'Rock organ', 'Keyboards', 18, 'treble', { w: [1, 1, .6, .8, 0, .5, 0, .4], a: .005, s: 1, r: .08, vib: [6.5, 8, 0], v: .22 });
  def('accord', 'Accordion', 'Keyboards', 21, 'treble', { w: 'sawtooth', uni: 7, a: .04, s: .9, r: .12, fc: 6, vib: [5, 3, .1], v: .16 });
  def('celesta', 'Celesta', 'Keyboards', 8, 'treble', { part: [[1, 1, 1], [4, .3, .3], [10, .08, .1]], dec: 1.4, r: .4, v: .35 });
  def('mbox', 'Music box', 'Keyboards', 10, 'treble', { part: [[1, 1, 1], [3.9, .4, .4], [9.3, .15, .15]], dec: 1.6, r: .6, v: .32 });
  def('glock', 'Glockenspiel', 'Mallets & bells', 9, 'treble', { part: [[1, 1, 1], [2.76, .45, .5], [5.4, .2, .25]], dec: 1.8, r: .6, v: .3 });
  def('vibes', 'Vibraphone', 'Mallets & bells', 11, 'treble', { part: [[1, 1, 1], [4, .25, .4]], dec: 3, r: .5, trem: [5, .35], v: .38 });
  def('marimba', 'Marimba', 'Mallets & bells', 12, 'treble', { part: [[1, 1, 1], [4, .35, .15], [10, .08, .05]], dec: .7, r: .2, v: .45 });
  def('xylo', 'Xylophone', 'Mallets & bells', 13, 'treble', { part: [[1, 1, 1], [3, .5, .4], [6.2, .2, .2]], dec: .35, r: .1, v: .4 });
  def('bells', 'Tubular bells', 'Mallets & bells', 14, 'treble', { part: [[1, 1, 1], [2.76, .6, .7], [5.4, .4, .5], [8.9, .2, .3]], dec: 4, r: 1.2, v: .28 });
  def('steeld', 'Steel drum', 'Mallets & bells', 114, 'treble', { part: [[1, 1, 1], [2, .55, .6], [3, .25, .3], [4.2, .1, .2]], dec: 1.2, r: .3, v: .32 });
  def('kalimba', 'Kalimba', 'Mallets & bells', 108, 'treble', { part: [[1, 1, 1], [5.9, .18, .15]], dec: 1.1, r: .3, v: .42 });
  def('timp', 'Timpani', 'Mallets & bells', 47, 'bass', { part: [[1, 1, 1], [1.5, .5, .6], [1.98, .35, .4], [2.44, .2, .3]], dec: 2.2, r: .4, nz: .5, v: .5 });
  def('violin', 'Violin', 'Strings', 40, 'treble', { w: 'sawtooth', a: .06, d: .2, s: .85, r: .18, fc: 6, q: 1.5, vib: [5.8, 14, .2], v: .2 });
  def('viola', 'Viola', 'Strings', 41, 'treble', { w: 'sawtooth', a: .07, d: .2, s: .85, r: .2, fc: 5, q: 1.3, vib: [5.5, 12, .2], v: .22 });
  def('cello', 'Cello', 'Strings', 42, 'bass', { w: 'sawtooth', a: .07, d: .2, s: .85, r: .22, fc: 5, q: 1.2, vib: [5.2, 12, .2], v: .26 });
  def('cbass', 'Double bass', 'Strings', 43, 'bass', { w: 'sawtooth', a: .06, d: .2, s: .85, r: .2, fc: 4, vib: [5, 8, .25], v: .32 });
  def('strings', 'String section', 'Strings', 48, 'treble', { w: 'sawtooth', uni: 9, a: .18, d: .3, s: .9, r: .4, fc: 5, vib: [5.5, 6, .3], v: .14 });
  def('pizz', 'Pizzicato strings', 'Strings', 45, 'treble', { ks: .985, br: .4, sus: 1, r: .15, v: .45 });
  def('harp', 'Harp', 'Strings', 46, 'treble', { ks: .997, br: .35, sus: 3, r: 1.2, ring: 1, v: .42 });
  def('trumpet', 'Trumpet', 'Brass', 56, 'treble', { w: 'sawtooth', a: .03, d: .1, s: .85, r: .1, fc: 7, fe: .35, fd: .08, vib: [5.5, 8, .3], v: .2 });
  def('horn', 'French horn', 'Brass', 60, 'treble', { w: 'sawtooth', a: .07, s: .9, r: .2, fc: 2.6, fe: .5, fd: .12, vib: [5, 4, .4], v: .3 });
  def('trombone', 'Trombone', 'Brass', 57, 'bass', { w: 'sawtooth', a: .05, s: .9, r: .15, fc: 4.5, fe: .4, fd: .1, v: .24 });
  def('tuba', 'Tuba', 'Brass', 58, 'bass', { w: 'sawtooth', a: .06, s: .9, r: .15, fc: 3, fe: .5, fd: .12, v: .32 });
  def('brass', 'Brass section', 'Brass', 61, 'treble', { w: 'sawtooth', uni: 8, a: .05, s: .85, r: .2, fc: 5, fe: .35, fd: .12, v: .14 });
  def('flute', 'Flute', 'Woodwinds', 73, 'treble', { w: [1, .12, .04, .02], a: .06, d: .1, s: .9, r: .12, vib: [5, 10, .25], nz: .25, v: .3 });
  def('piccolo', 'Piccolo', 'Woodwinds', 72, 'treble', { w: [1, .08, .02], a: .05, s: .9, r: .1, vib: [5.5, 10, .2], nz: .2, v: .22 });
  def('recorder', 'Recorder', 'Woodwinds', 74, 'treble', { w: [1, .25, .08, .05], a: .03, s: .9, r: .06, nz: .12, v: .28 });
  def('panflute', 'Pan flute', 'Woodwinds', 75, 'treble', { w: [1, .1], a: .08, s: .9, r: .2, vib: [4.5, 8, .3], nz: .5, v: .3 });
  def('clarinet', 'Clarinet', 'Woodwinds', 71, 'treble', { w: [1, 0, .55, 0, .3, 0, .18, 0, .1, 0, .05], a: .04, s: .9, r: .1, fc: 10, v: .26 });
  def('oboe', 'Oboe', 'Woodwinds', 68, 'treble', { w: [.6, 1, .8, .55, .5, .35, .25, .15, .1], a: .04, s: .9, r: .1, fc: 12, vib: [5.5, 8, .3], v: .2 });
  def('bassoon', 'Bassoon', 'Woodwinds', 70, 'bass', { w: [.7, 1, .75, .6, .45, .3, .2, .1], a: .05, s: .9, r: .12, fc: 8, v: .26 });
  def('sax', 'Saxophone', 'Woodwinds', 65, 'treble', { w: 'sawtooth', a: .04, s: .85, r: .12, fc: 5, fe: .5, fd: .1, vib: [5, 12, .3], nz: .08, v: .2 });
  def('harmonica', 'Harmonica', 'Woodwinds', 22, 'treble', { w: 'square', a: .03, s: .9, r: .08, fc: 4, vib: [6, 10, .2], v: .15 });
  def('nylon', 'Classical guitar', 'Guitars & bass', 24, 'treble', { ks: .994, br: .45, sus: 2.5, r: .2, v: .45 });
  def('steel', 'Acoustic guitar', 'Guitars & bass', 25, 'treble', { ks: .996, br: .7, sus: 3, r: .25, v: .4 });
  def('eguitar', 'Electric guitar (clean)', 'Guitars & bass', 27, 'treble', { ks: .997, br: .55, sus: 3, r: .12, v: .4 });
  def('dist', 'Electric guitar (rock)', 'Guitars & bass', 30, 'treble', { ks: .998, br: .6, sus: 3, r: .1, dist: 1, v: .4 });
  def('banjo', 'Banjo', 'Guitars & bass', 105, 'treble', { ks: .985, br: .9, sus: 1.2, r: .1, v: .4 });
  def('sitar', 'Sitar', 'Guitars & bass', 104, 'treble', { ks: .998, br: .95, sus: 3, r: .3, v: .35 });
  def('abass', 'Acoustic bass', 'Guitars & bass', 32, 'bass', { ks: .995, br: .3, sus: 2.5, r: .1, v: .6 });
  def('ebass', 'Bass guitar', 'Guitars & bass', 33, 'bass', { ks: .997, br: .4, sus: 3, r: .08, v: .65 });
  def('sbass', 'Synth bass', 'Guitars & bass', 38, 'bass', { w: 'sawtooth', a: .005, d: .25, s: .55, r: .08, fc: 2, fe: 6, fd: .18, q: 4, v: .3 });
  def('choir', 'Choir (aah)', 'Voices', 52, 'treble', { w: 'sawtooth', uni: 6, a: .2, s: .9, r: .35, form: [800, 1150, 2900], vib: [5, 10, .3], v: .5 });
  def('ooh', 'Voices (ooh)', 'Voices', 53, 'treble', { w: 'sawtooth', uni: 5, a: .25, s: .9, r: .4, form: [400, 800, 2600], vib: [5, 8, .3], v: .55 });
  def('sawlead', 'Saw lead', 'Synths', 81, 'treble', { w: 'sawtooth', uni: 10, a: .01, s: .8, r: .1, fc: 10, v: .13 });
  def('sqlead', 'Square lead', 'Synths', 80, 'treble', { w: 'square', a: .01, s: .8, r: .08, fc: 8, v: .13 });
  def('chip', '8-bit chiptune', 'Synths', 80, 'treble', { w: 'square', a: .002, s: .85, r: .02, fc: 40, v: .1 });
  def('softpad', 'Soft pad', 'Synths', 89, 'treble', { w: 'triangle', uni: 12, a: .5, s: .9, r: .9, fc: 8, v: .22 });
  def('warmpad', 'Warm pad', 'Synths', 89, 'treble', { w: 'sawtooth', uni: 14, a: .6, s: .9, r: 1, fc: 2.2, v: .15 });
  def('spluck', 'Synth pluck', 'Synths', 84, 'treble', { w: 'sawtooth', dec: .5, a: .003, r: .1, fc: 2, fe: 8, fd: .12, v: .32 });
  def('drums', 'Drum kit', 'Drums', 0, 'perc', { drum: 1 });
  /* drum staff: line/space (diatonic step on the treble staff) -> sound; x noteheads for cymbals */
  const DMAP = { 28: 'clap', 29: 'phat', 30: 'kick', 31: 'kick', 32: 'ftom', 33: 'ftom', 34: 'ltom', 35: 'snare', 36: 'mtom', 37: 'htom', 38: 'ride', 39: 'hat', 40: 'crash', 41: 'ohat', 42: 'cow' };
  const XHEAD = { 29: 1, 38: 1, 39: 1, 40: 1, 41: 1 }, DGM = { kick: 36, snare: 38, hat: 42, ohat: 46, phat: 44, crash: 49, ride: 51, ftom: 41, ltom: 45, mtom: 47, htom: 50, clap: 39, cow: 56 };
  const PADS = [[31, 'Kick', 'K'], [35, 'Snare', 'S'], [39, 'Hi-hat', 'H'], [41, 'Open hat', 'O'], [40, 'Crash', 'C'], [38, 'Ride', 'R'], [37, 'High tom', 'T'], [36, 'Mid tom', 'M'], [33, 'Floor tom', 'F'], [28, 'Clap', 'P'], [42, 'Cowbell', 'W']];
  const drumKind = s => DMAP[s] || DMAP[Object.keys(DMAP).map(Number).sort((a, b) => Math.abs(a - s) - Math.abs(b - s))[0]];
  const snapDrum = s => DMAP[s] ? s : Object.keys(DMAP).map(Number).sort((a, b) => Math.abs(a - s) - Math.abs(b - s))[0];
  /* ================================================================ sound engine */
  const WC = new WeakMap(), cache = ctx => { let c = WC.get(ctx); if (!c) WC.set(ctx, c = { w: {}, ks: {} }); return c; };
  function noiseBuf(ctx) { const c = cache(ctx); if (!c.nb) { const L = ctx.sampleRate * 2, b = ctx.createBuffer(1, L, ctx.sampleRate), d = b.getChannelData(0); for (let i = 0; i < L; i++) d[i] = Math.random() * 2 - 1; c.nb = b; } return c.nb; }
  function wave(ctx, I) { const c = cache(ctx); if (!c.w[I.id]) { const re = new Float32Array(I.w.length + 1), im = new Float32Array(I.w.length + 1); I.w.forEach((v, i) => im[i + 1] = v); c.w[I.id] = ctx.createPeriodicWave(re, im); } return c.w[I.id]; }
  let DIST = null; const distCurve = () => { if (!DIST) { DIST = new Float32Array(1024); for (let i = 0; i < 1024; i++) { const x = i / 511.5 - 1; DIST[i] = Math.tanh(7 * x); } } return DIST; };
  function ksBuf(ctx, I, f) {
    const c = cache(ctx), k = I.id + ':' + f.toFixed(2); if (c.ks[k]) return c.ks[k];
    const sr = ctx.sampleRate, N = Math.max(2, Math.round(sr / f - .5)), L = Math.floor(sr * (I.sus || 2.5)), b = ctx.createBuffer(1, L, sr), d = b.getChannelData(0), br = I.br || .5, dk = I.ks;
    let p = 0, mx = 0; for (let i = 0; i < N; i++) { p += ((Math.random() * 2 - 1) - p) * br; d[i] = p; mx = Math.max(mx, Math.abs(p)); }
    for (let i = N; i < L; i++) d[i] = dk * .5 * (d[i - N] + d[i - N + 1]);
    const sc = mx ? .9 / mx : 1; for (let i = 0; i < L; i++) d[i] *= sc;
    return (c.ks[k] = { b, rate: f * (N + .5) / sr });
  }
  function drum(ctx, out, kind, t, vel) {
    const nb = noiseBuf(ctx), g = ctx.createGain(); g.gain.value = .9 * vel; g.connect(out);
    const nz = (dur, type, fr, q, amp, at = 0) => { const s = ctx.createBufferSource(); s.buffer = nb; const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.value = fr; if (q) fl.Q.value = q; const ng = ctx.createGain(); ng.gain.setValueAtTime(amp, t + at); ng.gain.exponentialRampToValueAtTime(.001, t + at + dur); s.connect(fl); fl.connect(ng); ng.connect(g); s.start(t + at, Math.random() * 1.5, dur + .05); };
    const tone = (f1, f2, dur, amp, type = 'sine') => { const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f1, t); o.frequency.exponentialRampToValueAtTime(f2, t + dur * .6); const og = ctx.createGain(); og.gain.setValueAtTime(amp, t); og.gain.exponentialRampToValueAtTime(.001, t + dur); o.connect(og); og.connect(g); o.start(t); o.stop(t + dur + .05); };
    switch (kind) {
      case 'kick': tone(160, 45, .45, 1.2); nz(.02, 'lowpass', 3000, 0, .3); break;
      case 'snare': tone(230, 140, .14, .45, 'triangle'); nz(.22, 'highpass', 1400, 0, .7); break;
      case 'hat': nz(.06, 'highpass', 7500, 0, .45); break;
      case 'phat': nz(.04, 'highpass', 6500, 0, .3); break;
      case 'ohat': nz(.35, 'highpass', 7000, 0, .4); break;
      case 'crash': nz(1.6, 'highpass', 4500, 0, .5); nz(.8, 'bandpass', 9000, .8, .3); break;
      case 'ride': nz(.7, 'highpass', 8000, 0, .25); tone(3400, 3300, .6, .06, 'triangle'); break;
      case 'htom': tone(260, 170, .3, .8); break;
      case 'mtom': tone(200, 130, .33, .85); break;
      case 'ltom': tone(150, 100, .36, .9); break;
      case 'ftom': tone(110, 70, .42, .95); break;
      case 'clap': [0, .011, .022].forEach(at => nz(.03, 'bandpass', 1300, 1.2, .8, at)); nz(.2, 'bandpass', 1300, 1.2, .7, .03); break;
      case 'cow': [560, 845].forEach(f => { const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = f; const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 700; const og = ctx.createGain(); og.gain.setValueAtTime(.25, t); og.gain.exponentialRampToValueAtTime(.001, t + .3); o.connect(bp); bp.connect(og); og.connect(g); o.start(t); o.stop(t + .35); }); break;
    }
  }
  function voice(ctx, out, I, m, t, dur, vel = 1) {
    if (I.drum) return drum(ctx, out, m, t, vel);
    const f = 440 * Math.pow(2, (m - 69) / 12), g = ctx.createGain(); g.connect(out); let v = (I.v || .3) * vel;
    if (I.ks) { const kb = ksBuf(ctx, I, f), s = ctx.createBufferSource(); s.buffer = kb.b; s.playbackRate.value = kb.rate; let node = s;
      if (I.dist) { const ws = ctx.createWaveShaper(); ws.curve = distCurve(); const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3200; s.connect(ws); ws.connect(lp); node = lp; v *= .45; }
      node.connect(g); const hold = I.ring ? Math.max(dur, 1.5) : dur, r = I.r || .15; g.gain.setValueAtTime(v, t); g.gain.setTargetAtTime(0, t + hold, r / 4); s.start(t); s.stop(t + Math.min(I.sus || 2.5, hold + r * 1.6) + .05); return; }
    if (I.part) { const D = I.dec * Math.pow(2, -(m - 60) / 36), r = I.r || .3, end = t + Math.min(D * 1.8, dur + r * 1.6) + .05; let dest = g;
      if (I.trem) { const tg = ctx.createGain(); tg.gain.value = 1 - I.trem[1] / 2; const l = ctx.createOscillator(), lg = ctx.createGain(); l.frequency.value = I.trem[0]; lg.gain.value = I.trem[1] / 2; l.connect(lg); lg.connect(tg.gain); l.start(t); l.stop(end); tg.connect(g); dest = tg; }
      I.part.forEach(([ra, amp, dm]) => { const ff = f * ra; if (ff > ctx.sampleRate / 2.3) return; const o = ctx.createOscillator(); o.frequency.value = ff; const og = ctx.createGain(); og.gain.setValueAtTime(0, t); og.gain.linearRampToValueAtTime(amp, t + .002); og.gain.setTargetAtTime(0, t + .002, D * dm / 4); o.connect(og); og.connect(dest); o.start(t); o.stop(end); });
      if (I.nz) { const s = ctx.createBufferSource(); s.buffer = noiseBuf(ctx); const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 400; const ng = ctx.createGain(); ng.gain.setValueAtTime(I.nz, t); ng.gain.exponentialRampToValueAtTime(.001, t + .2); s.connect(lp); lp.connect(ng); ng.connect(dest); s.start(t, Math.random(), .25); }
      g.gain.setValueAtTime(v, t); g.gain.setTargetAtTime(0, t + dur, r / 4); return; }
    let inp; const r = I.r || .2, D = I.dec ? I.dec * Math.pow(2, -(m - 60) / 30) : 0, end = (D ? t + Math.min(dur + r * 1.6, D * 1.6) : t + dur + r * 1.6) + .05;
    if (I.form) { inp = ctx.createGain(); I.form.forEach((ff, i) => { const b = ctx.createBiquadFilter(); b.type = 'bandpass'; b.frequency.value = ff; b.Q.value = 5; const bg = ctx.createGain(); bg.gain.value = [1.6, 1, .5][i] || .4; inp.connect(b); b.connect(bg); bg.connect(g); }); }
    else { inp = ctx.createBiquadFilter(); inp.type = 'lowpass'; inp.Q.value = I.q || .8; const cut = Math.min(17000, f * (I.fc || 14)); if (I.fe) { inp.frequency.setValueAtTime(clamp(cut * I.fe, 60, 17000), t); inp.frequency.exponentialRampToValueAtTime(cut, t + (I.fd || .3)); } else inp.frequency.value = cut; inp.connect(g); }
    const oscs = []; (I.uni ? [0, I.uni, -I.uni] : [0]).forEach(dt => { const o = ctx.createOscillator(); if (Array.isArray(I.w)) o.setPeriodicWave(wave(ctx, I)); else o.type = I.w || 'sine'; o.frequency.value = f; o.detune.value = dt; const og = ctx.createGain(); og.gain.value = I.uni ? .55 : 1; o.connect(og); og.connect(inp); o.start(t); o.stop(end); oscs.push(o); });
    if (I.vib) { const [rate, depth, delay] = I.vib, l = ctx.createOscillator(), lg = ctx.createGain(); l.frequency.value = rate; lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(depth, t + delay + .3); l.connect(lg); oscs.forEach(o => lg.connect(o.detune)); l.start(t); l.stop(end); }
    if (I.nz) { const s = ctx.createBufferSource(); s.buffer = noiseBuf(ctx); s.loop = true; const b = ctx.createBiquadFilter(); b.type = 'bandpass'; b.frequency.value = Math.min(12000, f * 2); b.Q.value = 1.5; const ng = ctx.createGain(); ng.gain.value = I.nz; s.connect(b); b.connect(ng); ng.connect(g); s.start(t, Math.random()); s.stop(end); }
    const a = I.a || .01, gg = g.gain; gg.setValueAtTime(0, t); gg.linearRampToValueAtTime(v, t + a);
    if (D) gg.setTargetAtTime(0, t + a, D / 4); else gg.setTargetAtTime(v * (I.s == null ? .9 : I.s), t + a, (I.d || .1) / 3);
    gg.setTargetAtTime(0, t + Math.max(a, dur), r / 4);
  }
  function impulse(ctx) { const sr = ctx.sampleRate, L = Math.floor(sr * 2.2), b = ctx.createBuffer(2, L, sr); for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); for (let i = 0; i < L; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / L, 3); } return b; }
  function buses(ctx, sc) {
    const master = ctx.createGain(); master.gain.value = .85; const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4; master.connect(comp); comp.connect(ctx.destination);
    const rv = ctx.createConvolver(); rv.buffer = impulse(ctx); const wet = ctx.createGain(); wet.gain.value = .22; master.connect(rv); rv.connect(wet); wet.connect(comp);
    return { master, parts: sc.parts.map(p => { const g = ctx.createGain(); g.gain.value = p.mute ? 0 : (p.vol == null ? .8 : p.vol); g.connect(master); return g; }) };
  }
  /* every sounding note, with ties merged: {pi, t, dur, m (midi) or kind (drum)} in units */
  function flatNotes(sc) {
    const out = []; sc.parts.forEach((p, pi) => { const I = INST[p.inst] || INST.piano; let open = {}, t = 0;
      p.ev.forEach(e => { const L = len(e), nopen = {}; if (!e.r) e.n.forEach(n => { const key = I.drum ? drumKind(n.s) : midiOf(n); if (open[key] && !I.drum) { open[key].dur += L; nopen[key] = open[key]; } else { const o = { pi, t, dur: L, m: I.drum ? 0 : key, kind: I.drum ? key : null }; out.push(o); nopen[key] = o; } }); open = !e.r && e.tie ? nopen : {}; t += L; }); });
    return out.sort((a, b) => a.t - b.t);
  }
  const spuOf = sc => 60 / sc.bpm / 8;
  function wavBlob(buf) { const ch = buf.numberOfChannels, n = buf.length, sr = buf.sampleRate, dv = new DataView(new ArrayBuffer(44 + n * ch * 2)); const w = (o, s) => { for (let i = 0; i < s.length; i++) dv.setUint8(o + i, s.charCodeAt(i)); };
    w(0, 'RIFF'); dv.setUint32(4, 36 + n * ch * 2, true); w(8, 'WAVE'); w(12, 'fmt '); dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, ch, true); dv.setUint32(24, sr, true); dv.setUint32(28, sr * ch * 2, true); dv.setUint16(32, ch * 2, true); dv.setUint16(34, 16, true); w(36, 'data'); dv.setUint32(40, n * ch * 2, true);
    const d = []; for (let c = 0; c < ch; c++) d.push(buf.getChannelData(c)); let o = 44; for (let i = 0; i < n; i++) for (let c = 0; c < ch; c++) { const v = clamp(d[c][i], -1, 1); dv.setInt16(o, v < 0 ? v * 0x8000 : v * 0x7fff, true); o += 2; } return new Blob([dv], { type: 'audio/wav' }); }
  function midiBytes(sc) {
    const str = s => [...s].map(c => c.charCodeAt(0) & 127), vlq = n => { const b = [n & 127]; while ((n >>= 7)) b.unshift((n & 127) | 128); return b; }, be = (n, k) => { const b = []; for (let i = k - 1; i >= 0; i--) b.push((n >> (8 * i)) & 255); return b; };
    const track = evs => { evs.sort((a, b) => a.tk - b.tk || a.o - b.o); let last = 0; const d = []; evs.forEach(e => { d.push(...vlq(e.tk - last), ...e.b); last = e.tk; }); d.push(0, 0xFF, 0x2F, 0); return [...str('MTrk'), ...be(d.length, 4), ...d]; };
    const tpu = 60, tr = [track([{ tk: 0, o: 0, b: [0xFF, 0x51, 3, ...be(Math.round(60000000 / sc.bpm), 3)] }, { tk: 0, o: 0, b: [0xFF, 0x58, 4, sc.ts[0], Math.round(Math.log2(sc.ts[1])), 24, 8] }, { tk: 0, o: 0, b: [0xFF, 0x59, 2, sc.key & 255, 0] }])];
    const flat = flatNotes(sc); let ch = 0;
    sc.parts.forEach((p, pi) => { const I = INST[p.inst] || INST.piano; let c = 9; if (!I.drum) { if (ch === 9) ch++; c = ch % 16; ch++; }
      const nm = str(p.name || I.name), vel = Math.round(40 + 80 * (p.vol == null ? .8 : p.vol)), ev = [{ tk: 0, o: 0, b: [0xFF, 0x03, ...vlq(nm.length), ...nm] }]; if (!I.drum) ev.push({ tk: 0, o: 1, b: [0xC0 | c, I.gm] });
      flat.filter(n => n.pi === pi).forEach(n => { const key = I.drum ? DGM[n.kind] : n.m; ev.push({ tk: n.t * tpu, o: 3, b: [0x90 | c, key, vel] }, { tk: (n.t + n.dur) * tpu, o: 2, b: [0x80 | c, key, 0] }); });
      tr.push(track(ev)); });
    return new Uint8Array([...str('MThd'), 0, 0, 0, 6, 0, 1, ...be(tr.length, 2), ...be(480, 2), ...tr.flat()]);
  }
  /* ================================================================ easy helpers (chords, beats, melody) */
  const PROG = [['Happy pop', 'I V vi IV'], ['Classic', 'I IV V I'], ['Fifties', 'I vi IV V'], ['Sad and emotional', 'vi IV I V'], ['Jazzy', 'ii V I I'], ['Calm canon', 'I V vi iii IV I IV V'], ['Twelve-bar blues', 'I I I I IV IV I I V IV I V'], ['Folk song', 'I IV I V']];
  const STYLES = [['block', 'Held chords'], ['strum', 'A chord on every beat'], ['broken', 'Broken chords (one note at a time)'], ['bass', 'Bass line (low notes)'], ['waltz', 'Waltz: oom-pah-pah']];
  const BEATS = { Rock: { 31: [0, 4], 35: [2, 6], 39: [0, 1, 2, 3, 4, 5, 6, 7] }, Pop: { 31: [0, 3, 4], 35: [2, 6], 39: [0, 1, 2, 3, 4, 5, 6, 7] }, Disco: { 31: [0, 2, 4, 6], 35: [2, 6], 39: [0, 2, 4, 6], 41: [1, 3, 5, 7] }, Ballad: { 31: [0, 5], 35: [4], 39: [0, 2, 4, 6] }, 'Hip-hop': { 31: [0, 3, 5], 35: [2, 6], 39: [0, 1, 2, 3, 4, 5, 6, 7] }, Waltz: { 31: [0], 35: [], 39: [2, 4] } };
  const ROM = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'], parseProg = s => String(s || '').split(/[\s,\-–|]+/).map(x => ROM.indexOf(x.replace(/[^ivIV]/g, '').toUpperCase())).filter(d => d >= 0);
  const tonicL = sc => mod(sc.key * 4, 7);
  const toneS = (sc, deg, lo) => { const l = mod(tonicL(sc) + deg, 7); let s = Math.floor(lo / 7) * 7 + l; if (s < lo) s += 7; return s; };
  const nt = (sc, s) => ({ s, a: keyAlt(sc.key, mod(s, 7)) });
  const chordName = (sc, deg) => { const l = mod(tonicL(sc) + deg, 7), a = keyAlt(sc.key, l); return LET[l] + ['', '♭', '', '♯'][a + 2 > 3 ? 0 : a + 2].replace(/^$/, '') + ([1, 2, 5].includes(deg) ? 'm' : deg === 6 ? '°' : ''); };
  function triad(sc, deg, lo) { const r = toneS(sc, deg, lo); return [r, r + 2, r + 4].map(s => nt(sc, s)); }
  function applyProg(sc, pi, degs, style, fromBar, times) {
    const p = sc.parts[pi], ML = mlen(sc), beat = sc.ts[1] === 8 ? 12 : 8, bass = p.clef === 'bass';
    for (let k = 0; k < times; k++) degs.forEach((deg, i) => {
      const t0 = (fromBar + k * degs.length + i) * ML, ch = triad(sc, deg, bass ? 21 : 28), root = toneS(sc, deg, bass ? 17 : 24);
      if (style === 'block') place(p, t0, { n: ch }, ML, ML);
      else if (style === 'strum') for (let t = 0; t + beat <= ML; t += beat) place(p, t0 + t, { n: ch }, beat, ML);
      else if (style === 'broken') { const seq = [ch[0], ch[1], ch[2], nt(sc, ch[0].s + 7), ch[2], ch[1]]; for (let t = 0, j = 0; t + 4 <= ML; t += 4, j++) place(p, t0 + t, { n: [seq[j % 6]] }, 4, ML); }
      else if (style === 'bass') { const half = ML % 16 === 0 ? 16 : ML / 2 % 4 === 0 ? ML / 2 : ML; for (let t = 0, j = 0; t + half <= ML; t += half, j++) place(p, t0 + t, { n: [nt(sc, j % 2 ? root + 4 : root)] }, half, ML); }
      else if (style === 'waltz') { place(p, t0, { n: [nt(sc, root)] }, beat, ML); for (let t = beat; t + beat <= ML; t += beat) place(p, t0 + t, { n: ch }, beat, ML); }
    });
  }
  function applyBeat(sc, pi, name, fromBar, bars) {
    const p = sc.parts[pi], ML = mlen(sc), steps = Math.floor(ML / 4), pat = BEATS[name] || BEATS.Rock, n = name === 'Waltz' ? 6 : 8;
    for (let b = 0; b < bars; b++) for (let i = 0; i < steps; i++) { const hits = Object.keys(pat).filter(s => pat[s].includes(i % n)).map(Number); if (b === 0 && i === 0) hits.push(40); const t = (fromBar + b) * ML + i * 4; place(p, t, hits.length ? { n: hits.map(s => ({ s, a: 0 })) } : { r: 1 }, 4, ML); }
  }
  function melodyIdea(sc, pi, degs, fromBar) {
    const p = sc.parts[pi], ML = mlen(sc), off = p.clef === 'bass' ? -14 : 0, lo = 30 + off, hi = 39 + off, RH = [[8, 8, 8, 8], [8, 4, 4, 8, 8], [16, 8, 8], [4, 4, 8, 8, 8], [8, 8, 16], [12, 4, 8, 8], [8, 8, 4, 4, 8]];
    let prev = toneS(sc, 0, lo + 2);
    degs.forEach((deg, i) => {
      const t0 = (fromBar + i) * ML, last = i === degs.length - 1, cts = [0, 2, 4].map(x => mod(tonicL(sc) + deg + x, 7));
      let rh = ML === 32 ? RH[Math.floor(Math.random() * RH.length)] : []; if (!rh.length) { let u = 0; while (u < ML) { const c = [8, 8, 4].filter(x => u + x <= ML); const x = c.length ? c[Math.floor(Math.random() * c.length)] : ML - u; rh.push(x); u += x; } }
      if (last) rh = [ML];
      let t = 0; rh.forEach(d => {
        let s; if (t % 8 === 0) { const opts = []; for (let x = lo; x <= hi; x++) if (cts.includes(mod(x, 7))) opts.push(x); opts.sort((a, b) => Math.abs(a - prev) - Math.abs(b - prev)); s = last ? toneS(sc, deg, lo + 1) : opts[Math.random() < .7 ? 0 : Math.min(1, opts.length - 1)]; }
        else { s = prev + [-2, -1, -1, 1, 1, 2][Math.floor(Math.random() * 6)]; s = clamp(s, lo, hi); }
        place(p, t0 + t, { n: [nt(sc, s)] }, d, ML); prev = s; t += d; });
    });
  }
  function parseTune(sc, pi, txt, fromBar = 0) { const p = sc.parts[pi], ML = mlen(sc), D = { w: 32, h: 16, q: 8, e: 4, s: 2 }; let t = fromBar * ML;
    txt.split(/\s+/).filter(x => x && x !== '|').forEach(tok => { const m = /^([A-Gr])([#b]?)(\d?)([whqes])(\.?)$/.exec(tok); if (!m) return; const L = D[m[4]] * (m[5] ? 1.5 : 1); if (m[1] === 'r') place(p, t, { r: 1 }, L, ML); else place(p, t, { n: [{ s: +m[3] * 7 + LET.indexOf(m[1]), a: m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0 }] }, L, ML); t += L; }); }
  /* ================================================================ what the AI writes back
     A small format a local model can follow: four header lines and one PART line per staff.
       NAME: Midnight Waltz / TEMPO: 92 / KEY: -3 / TIME: 3/4
       PART: Melody | flute | notes: C5q D5q E5h
       PART: Chords | nylon | chords: I V vi IV     (or strum: / broken: / bass: / waltz:)
       PART: Drums | drums | beat: Rock             (Rock, Pop, Disco, Ballad, Hip-hop, Waltz)
     Every line is optional except the PART lines, and anything unreadable is simply skipped. */
  function parseSong(txt) {
    const out = { name: '', bpm: 0, key: null, ts: null, parts: [] };
    String(txt || '').replace(/\r/g, '').split('\n').forEach(line => {
      const m = /^\s*\**\s*(NAME|TEMPO|BPM|KEY|TIME|PART)\s*\**\s*:\s*(.+?)\s*$/.exec(line); if (!m) return;
      const k = m[1].toUpperCase(), v = m[2].replace(/\*\*/g, '').trim();
      if (k === 'NAME') out.name = v.slice(0, 40);
      else if (k === 'TEMPO' || k === 'BPM') { const n = parseInt(v.replace(/[^0-9]/g, ''), 10); if (!isNaN(n)) out.bpm = clamp(n, 40, 220); }
      else if (k === 'KEY') { const n = parseInt(v.replace(/[^\-0-9]/g, ''), 10); if (!isNaN(n)) out.key = clamp(n, -7, 7); }
      else if (k === 'TIME') { const t = /(\d+)\s*\/\s*(\d+)/.exec(v); if (t && [2, 3, 4, 5, 6, 9, 12].includes(+t[1]) && [4, 8].includes(+t[2])) out.ts = [+t[1], +t[2]]; }
      else if (k === 'PART') {
        const f = v.split('|').map(x => x.trim()); if (f.length < 3) return;
        const dir = /^(notes|chords|strum|broken|bass|waltz|beat)\s*:?\s*([\s\S]*)$/i.exec(f.slice(2).join(' | ').trim()); if (!dir) return;
        out.parts.push({ name: (f[0] || 'Part').slice(0, 24), inst: f[1], kind: dir[1].toLowerCase(), value: dir[2].trim() });
      }
    });
    return out;
  }
  /* ================================================================ reading a music file
     A MIDI file (every part, with its instrument, tempo, time and key), a plain text file of notes
     ("C4q D4q E4h", or the same lines the AI writes), or an audio file, which is turned into one
     melody line by following the pitch of the first 30 seconds (one note at a time, no chords or drums). */
  const PC2 = [[0, 0], [0, 1], [1, 0], [1, 1], [2, 0], [3, 0], [3, 1], [4, 0], [4, 1], [5, 0], [5, 1], [6, 0]];   // pitch class -> [letter, accidental]
  const GMD = { 35: 31, 36: 31, 37: 28, 38: 35, 39: 28, 40: 35, 41: 33, 42: 39, 43: 33, 44: 29, 45: 34, 46: 41, 47: 36, 48: 37, 49: 40, 50: 37, 51: 38, 52: 40, 53: 38, 54: 39, 55: 40, 56: 42, 57: 40, 59: 38 };   // General MIDI drum number -> drum staff step
  function midiNote(m) { const o = Math.floor(m / 12) - 1, pc = PC2[mod(m, 12)]; return { s: o * 7 + pc[0], a: pc[1] }; }
  function readMidi(buf) {
    const d = new Uint8Array(buf); let i = 0;
    const u16 = () => (d[i++] << 8) | d[i++];
    const u32 = () => ((d[i++] << 24) | (d[i++] << 16) | (d[i++] << 8) | d[i++]) >>> 0;
    const tag = () => String.fromCharCode(d[i++], d[i++], d[i++], d[i++]);
    if (tag() !== 'MThd') throw new Error('That file is not MIDI (it does not start with MThd).');
    const hlen = u32(); u16(); const ntr = u16(); const div = u16(); i += hlen - 6;
    const out = { division: (div & 0x7fff) || 480, bpm: 0, ts: null, key: null, tracks: [] };
    let usq = 0; const progs = {};
    for (let t = 0; t < ntr && i + 8 <= d.length; t++) {
      const id = tag(); const len = u32(); const end = Math.min(d.length, i + len);
      if (id !== 'MTrk') { i = end; continue; }
      const vl = () => { let v = 0, b; do { b = d[i++]; v = (v << 7) | (b & 127); } while (b & 128); return v; };
      let tick = 0, running = 0, name = '';
      const notes = [], open = new Map();
      while (i < end) {
        tick += vl();
        let st = d[i];
        if (st & 0x80) { i++; if (st < 0xf0) running = st; } else st = running;
        if (!st) break;
        if (st === 0xff) {
          const type = d[i++], ln = vl(), p0 = i;
          if (type === 0x03) { let s2 = ''; for (let k = 0; k < ln && p0 + k < d.length; k++) s2 += String.fromCharCode(d[p0 + k]); name = s2; }
          else if (type === 0x51 && ln === 3) usq = (d[p0] << 16) | (d[p0 + 1] << 8) | d[p0 + 2];
          else if (type === 0x58 && ln >= 2) out.ts = [d[p0], Math.pow(2, d[p0 + 1])];
          else if (type === 0x59 && ln >= 1) out.key = d[p0] > 127 ? d[p0] - 256 : d[p0];
          i = p0 + ln; continue;
        }
        if (st === 0xf0 || st === 0xf7) { const ln = vl(); i += ln; continue; }
        const hi = st & 0xf0, chan = st & 0x0f;
        if (hi === 0xc0) { const pr = d[i++]; if (!(chan in progs)) progs[chan] = pr; continue; }
        if (hi === 0xd0) { i += 1; continue; }
        const a = d[i++], b = d[i++] || 0;
        const key = chan * 128 + a;
        if (hi === 0x90 && b > 0) { const at = open.get(key); if (at != null) notes.push({ t: at, d: Math.max(1, tick - at), m: a, c: chan }); open.set(key, tick); }
        else if (hi === 0x80 || (hi === 0x90 && b === 0)) { const at = open.get(key); if (at != null) { open.delete(key); notes.push({ t: at, d: Math.max(1, tick - at), m: a, c: chan }); } }
      }
      i = end;
      const byCh = {}; notes.forEach(nt => (byCh[nt.c] = byCh[nt.c] || []).push(nt));
      Object.keys(byCh).forEach(c => out.tracks.push({ name, channel: +c, notes: byCh[c] }));
    }
    if (usq) out.bpm = Math.round(60000000 / usq);
    out.tracks.forEach(t => { t.program = progs[t.channel] || 0; t.notes.sort((a, b) => a.t - b.t); });
    return out;
  }
  /* notes that start together become one chord, in score time (a quarter is 8 units) */
  function midiToEvents(track, division) {
    const k = 8 / (division || 480), map = new Map();
    track.notes.forEach(n => { const t = Math.max(0, Math.round(n.t * k / 2) * 2), dur = Math.max(2, Math.round(n.d * k / 2) * 2); const e = map.get(t) || { t, dur: 0, m: [] }; e.dur = Math.max(e.dur, dur); if (e.m.indexOf(n.m) < 0) e.m.push(n.m); map.set(t, e); });
    return [...map.values()].sort((a, b) => a.t - b.t);
  }
  /* the tune in an audio file: one pitch per 32 ms, by autocorrelation, then runs of the same note */
  async function transcribe(src, maxSec, onProg) {
    maxSec = maxSec || 30;
    const sr0 = src.sampleRate, chs = src.numberOfChannels, need = Math.min(src.length, Math.floor(sr0 * maxSec));
    if (!need) return [];
    const mono = new Float32Array(need);
    for (let c = 0; c < chs; c++) { const dd = src.getChannelData(c); for (let i = 0; i < need; i++) mono[i] += dd[i] / chs; }
    const step = Math.max(1, sr0 / 8000), n = Math.floor(need / step), x = new Float32Array(n);
    for (let i = 0; i < n; i++) x[i] = mono[Math.floor(i * step)];
    const sr = sr0 / step, F = 512, H = 256, minLag = Math.floor(sr / 1000), maxLag = Math.floor(sr / 65), cents = [];
    for (let i = 0; i + F <= n; i += H) {
      if ((i / H) % 150 === 0) { if (onProg) onProg(i / n); await new Promise(r => setTimeout(r, 0)); }
      let en = 0; for (let j = 0; j < F; j++) en += x[i + j] * x[i + j];
      if (Math.sqrt(en / F) < 0.012) { cents.push(0); continue; }
      const rs = []; let best = 0;
      for (let lag = minLag; lag <= maxLag; lag++) {
        let s2 = 0, e1 = 0, e2 = 0;
        for (let j = 0; j < F - lag; j++) { s2 += x[i + j] * x[i + j + lag]; e1 += x[i + j] * x[i + j]; e2 += x[i + j + lag] * x[i + j + lag]; }
        const r = s2 / Math.sqrt(e1 * e2 + 1e-9); rs[lag] = r; if (r > best) best = r;
      }
      /* Every multiple of the period matches almost as well as the period itself, so the strongest match is often a
         harmonic: take the shortest lag that is nearly as strong, which is the note actually being played. */
      let bl = 0;
      for (let lag = minLag; lag <= maxLag; lag++) { const a0 = rs[lag - 1] == null ? -1 : rs[lag - 1], a2 = rs[lag + 1] == null ? -1 : rs[lag + 1]; if (rs[lag] >= best * 0.98 && rs[lag] >= a0 && rs[lag] >= a2) { bl = lag; break; } }
      let f = bl ? sr / bl : 0;
      if (bl) { const y0 = rs[bl - 1] == null ? rs[bl] : rs[bl - 1], y2 = rs[bl + 1] == null ? rs[bl] : rs[bl + 1], den = y0 - 2 * rs[bl] + y2; if (den) f = sr / (bl + 0.5 * (y0 - y2) / den); }
      cents.push(best > 0.6 && f ? 69 + 12 * Math.log2(f / 440) : 0);
    }
    const smooth = cents.map((v, i) => { if (!v) return 0; const w = cents.slice(Math.max(0, i - 2), i + 3).filter(y => y); w.sort((a, b) => a - b); return w[w.length >> 1] || v; });
    const mids = smooth.map(v => v ? Math.round(v) : 0), hop = H / sr, out = [];
    let start = -1, cur = 0;
    const flush = endF => { if (start >= 0 && cur) { const dur = (endF - start) * hop; if (dur >= 0.09) out.push({ t: start * hop, dur, m: cur }); } start = -1; cur = 0; };
    mids.forEach((m, i) => { if (!m) return flush(i); if (start < 0) { start = i; cur = m; } else if (m !== cur) { flush(i); start = i; cur = m; } });
    flush(mids.length);
    /* the same note split in two by a wobble at the change is one note */
    const joined = [];
    out.forEach(o => { const last = joined[joined.length - 1]; if (last && last.m === o.m && o.t - (last.t + last.dur) < 0.07) last.dur = o.t + o.dur - last.t; else joined.push(o); });
    return joined;
  }
  /* ================================================================ scores and templates */
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const mkPart = (name, inst, clef) => ({ name, inst, clef: clef || (INST[inst] || INST.piano).clef, vol: .8, mute: 0, ev: [] });
  const blankScore = (name, parts) => ({ id: uid(), name, bpm: 100, ts: [4, 4], key: 0, bars: 8, parts: parts.map(x => mkPart(...x)), upd: Date.now() });
  const TWINKLE = 'C4q C4q G4q G4q A4q A4q G4h F4q F4q E4q E4q D4q D4q C4h G4q G4q F4q F4q E4q E4q D4h G4q G4q F4q F4q E4q E4q D4h C4q C4q G4q G4q A4q A4q G4h F4q F4q E4q E4q D4q D4q C4h';
  const ODE = 'E5q E5q F5q G5q G5q F5q E5q D5q C5q C5q D5q E5q E5q. D5e D5h E5q E5q F5q G5q G5q F5q E5q D5q C5q C5q D5q E5q D5q. C5e C5h';
  const TPL = [
    ['twinkle', '⭐', 'Example: Twinkle, Twinkle', 'A finished song for piano and strings. Press Play, then change any note.', () => { const s = blankScore('Twinkle, Twinkle', [['Melody', 'piano'], ['Left hand', 'piano', 'bass'], ['Strings', 'strings']]); s.bpm = 104; parseTune(s, 0, TWINKLE); const pr = parseProg('I IV I V I V I V I IV I I'); applyProg(s, 1, pr, 'broken', 0, 1); applyProg(s, 2, pr, 'block', 0, 1); s.parts[2].vol = .5; return s; }],
    ['ode', '🎻', 'Example: Ode to Joy (Beethoven)', 'The famous melody on violin with cello and harp.', () => { const s = blankScore('Ode to Joy', [['Violin', 'violin'], ['Harp', 'harp'], ['Cello', 'cello']]); s.bpm = 112; parseTune(s, 0, ODE); const pr = parseProg('I V I V I V I I'); applyProg(s, 1, pr, 'broken', 0, 1); applyProg(s, 2, pr, 'bass', 0, 1); return s; }],
    ['piano', '🎹', 'Piano', 'Two staves: right hand on top, left hand below.', () => blankScore('Piano piece', [['Right hand', 'piano'], ['Left hand', 'piano', 'bass']])],
    ['melody', '🎶', 'Melody and chords', 'A tune on top, chords and a bass line under it.', () => blankScore('My song', [['Melody', 'flute'], ['Chords', 'piano'], ['Bass', 'ebass']])],
    ['band', '🎸', 'Rock band', 'Guitars, bass and drums. A beat and chords are already in; add a tune.', () => { const s = blankScore('Rock song', [['Lead guitar', 'dist'], ['Rhythm guitar', 'eguitar'], ['Bass', 'ebass'], ['Drums', 'drums']]); s.bpm = 120; const pr = parseProg('I V vi IV'); applyProg(s, 1, pr, 'strum', 0, 2); applyProg(s, 2, pr, 'bass', 0, 2); applyBeat(s, 3, 'Rock', 0, 8); return s; }],
    ['synth', '🌌', 'Synth pop', 'Lead, pad, synth bass and drums, ready to go.', () => { const s = blankScore('Synth song', [['Lead', 'sawlead'], ['Pad', 'warmpad'], ['Bass', 'sbass'], ['Drums', 'drums']]); s.bpm = 116; const pr = parseProg('vi IV I V'); applyProg(s, 1, pr, 'block', 0, 2); applyProg(s, 2, pr, 'bass', 0, 2); applyBeat(s, 3, 'Disco', 0, 8); return s; }],
    ['quartet', '🎻', 'String quartet', 'Two violins, viola and cello.', () => blankScore('String quartet', [['Violin 1', 'violin'], ['Violin 2', 'violin'], ['Viola', 'viola'], ['Cello', 'cello']])],
    ['orch', '🎺', 'Small orchestra', 'Flute, clarinet, horn, trumpet, strings, double bass and timpani.', () => blankScore('Orchestra piece', [['Flute', 'flute'], ['Clarinet', 'clarinet'], ['Horn', 'horn'], ['Trumpet', 'trumpet'], ['Strings', 'strings'], ['Double bass', 'cbass'], ['Timpani', 'timp']])],
    ['choir', '⛪', 'Choir and organ', 'Two voice parts with organ.', () => blankScore('Hymn', [['Sopranos', 'choir'], ['Altos', 'ooh'], ['Organ', 'organ'], ['Organ pedals', 'organ', 'bass']])],
    ['blank', '📄', 'Empty score', 'One piano staff. Add instruments any time.', () => blankScore('Untitled score', [['Melody', 'piano']])]];
  const idx = () => { try { return JSON.parse(ls.get('cmp_index', '[]')) || []; } catch (e) { return []; } };
  const loadScore = id => { try { const s = JSON.parse(ls.get('cmp_s_' + id, 'null')); if (s && s.parts) return s; } catch (e) { } return null; };
  function storeScore(s) { s.upd = Date.now(); try { ls.set('cmp_s_' + s.id, JSON.stringify(s)); const ix = idx().filter(x => x.id !== s.id); ix.unshift({ id: s.id, name: s.name, upd: s.upd }); ls.set('cmp_index', JSON.stringify(ix)); ls.set('cmp_cur', s.id); return true; } catch (e) { return false; } }
  /* ================================================================ styles */
  function css() { if (document.getElementById('cmp-css')) return; const st = document.createElement('style'); st.id = 'cmp-css'; st.textContent = `
.cmp-root{position:relative;flex:1;min-height:0;overflow:auto;padding:12px 14px 0}
.cmp-head{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:10px}
.cmp-head h2{margin:0;font-size:20px;letter-spacing:.3px}
.cmp-root .cmp-name{width:220px!important;flex:0 0 220px;font-weight:600}
.cmp-saved{font-size:12px;color:var(--mute);min-width:60px}
.cmp-bar{display:flex;gap:6px;align-items:center;flex-wrap:wrap;background:var(--panel2,var(--panel));border:1px solid var(--line);border-radius:12px;padding:8px 10px;margin-bottom:8px}
.cmp-bar .cmp-lbl{font-size:11px;text-transform:uppercase;letter-spacing:.6px;color:var(--mute);margin-right:2px}
.cmp-sep{width:1px;align-self:stretch;background:var(--line);margin:0 4px}
.cmp-b{display:inline-flex;align-items:center;gap:5px;background:transparent;border:1px solid var(--line);border-radius:9px;padding:5px 9px;color:var(--text);font-size:13px;cursor:pointer;line-height:1.1}
.cmp-b:hover{border-color:var(--acc)}
.cmp-b.cmp-on{background:var(--acc);border-color:var(--acc);color:#0a0c12}
.cmp-b svg{display:block}
.cmp-b small{opacity:.65;font-size:10px}
.cmp-big{font-size:14px;padding:7px 14px;font-weight:600}
.cmp-status{font-size:13px;color:var(--mute);margin:2px 2px 8px;min-height:18px}
.cmp-status b{color:var(--text)}
.cmp-pager{display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin:0 0 8px}
.cmp-pager .cmp-b[disabled]{opacity:.35;cursor:default}
.cmp-paper{background:#fbf8f1;border-radius:12px;box-shadow:0 6px 24px rgba(0,0,0,.28),inset 0 0 0 1px rgba(0,0,0,.06);padding:4px;margin-bottom:10px;overflow:hidden}
.cmp-paper svg{display:block;cursor:crosshair;user-select:none}
.cmp-paper.cmp-sel svg{cursor:pointer}
.cmp-cols{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:10px;margin-bottom:10px}
@media (max-width:900px){.cmp-cols{grid-template-columns:1fr}}
.cmp-card{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:10px 12px}
.cmp-card h3{margin:0 0 8px;font-size:14px}
.cmp-prow{display:flex;gap:6px;align-items:center;flex-wrap:wrap;padding:5px 0;border-bottom:1px dashed var(--line)}
.cmp-prow:last-child{border-bottom:0}
.cmp-prow input[type=text]{width:110px}
.cmp-prow.cmp-cur{background:rgba(120,160,255,.08);border-radius:8px}
.cmp-hrow{display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin:6px 0}
.cmp-hrow label{font-size:12px;color:var(--mute)}
.cmp-kb{position:sticky;bottom:0;background:var(--bg);padding:8px 0 10px;border-top:1px solid var(--line);z-index:2}
.cmp-kbrow{display:flex;gap:6px;align-items:center;margin-bottom:6px;flex-wrap:wrap;font-size:12px;color:var(--mute)}
.cmp-piano{position:relative;height:92px;user-select:none}
.cmp-wk{position:absolute;top:0;height:92px;background:linear-gradient(#fff,#ece8df);border:1px solid #9a9488;border-radius:0 0 6px 6px;box-sizing:border-box;cursor:pointer;display:flex;align-items:flex-end;justify-content:center;padding-bottom:4px;font-size:10px;color:#6b665c}
.cmp-wk.cmp-c{color:#1d1b18;font-weight:700}
.cmp-bk{position:absolute;top:0;height:56px;background:linear-gradient(#3a3a40,#111);border-radius:0 0 5px 5px;z-index:1;cursor:pointer;box-shadow:0 2px 3px rgba(0,0,0,.4)}
.cmp-wk:active,.cmp-wk.cmp-hit{background:linear-gradient(#cfe0ff,#9fbcf5)}
.cmp-bk:active,.cmp-bk.cmp-hit{background:linear-gradient(#5b7bd6,#2c4aa0)}
.cmp-pads{display:flex;gap:6px;flex-wrap:wrap}
.cmp-pad{min-width:82px;height:54px;border-radius:10px;border:1px solid var(--line);background:var(--panel2,var(--panel));color:var(--text);cursor:pointer;font-size:13px}
.cmp-pad:active{background:var(--acc);color:#0a0c12}
.cmp-ov{position:absolute;inset:0;background:rgba(5,8,14,.72);z-index:5;overflow:auto;padding:24px}
.cmp-ovin{max-width:980px;margin:0 auto;background:var(--panel);border:1px solid var(--line);border-radius:16px;padding:18px}
.cmp-tpls{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:10px;margin-top:10px}
.cmp-tpl{text-align:left;background:var(--panel2,var(--bg));border:1px solid var(--line);border-radius:12px;padding:12px;cursor:pointer;color:var(--text)}
.cmp-tpl:hover{border-color:var(--acc)}
.cmp-tpl .cmp-ti{font-size:26px}
.cmp-tpl b{display:block;margin:4px 0}
.cmp-tpl span{font-size:12px;color:var(--mute)}
.cmp-keys{font-size:12px;color:var(--mute);margin-bottom:10px}
.cmp-keys kbd{background:var(--panel2,var(--panel));border:1px solid var(--line);border-radius:4px;padding:0 4px}
`; document.head.appendChild(st); }
  /* small drawn icons for the length buttons */
  function durIcon(d, rest) {
    const c = 'currentColor'; if (rest) { const R = { 32: '<rect x="5" y="8" width="10" height="4" fill="' + c + '"/><line x1="2" y1="8" x2="18" y2="8" stroke="' + c + '"/>', 16: '<rect x="5" y="9" width="10" height="4" fill="' + c + '"/><line x1="2" y1="13" x2="18" y2="13" stroke="' + c + '"/>', 8: '<path d="M8 3 l5 6 l-4 5 l5 6 q-6 -3 -4 3" fill="none" stroke="' + c + '" stroke-width="2"/>', 4: '<circle cx="8" cy="8" r="2.3" fill="' + c + '"/><path d="M8 10 Q11 10 13 6 L9 19" fill="none" stroke="' + c + '" stroke-width="1.5"/>', 2: '<circle cx="8" cy="6" r="2" fill="' + c + '"/><circle cx="7" cy="12" r="2" fill="' + c + '"/><path d="M8 8 Q11 8 13 4 L8 21 M7 14 Q10 14 11.5 10" fill="none" stroke="' + c + '" stroke-width="1.5"/>' }; return '<svg width="20" height="24" viewBox="0 0 20 24">' + R[d] + '</svg>'; }
    const hollow = d >= 16, head = '<ellipse cx="7" cy="18" rx="4.6" ry="3.4" transform="rotate(-20 7 18)" fill="' + (hollow ? 'none' : c) + '" stroke="' + c + '" stroke-width="1.6"/>';
    const stem = d < 32 ? '<line x1="11.2" y1="17" x2="11.2" y2="2" stroke="' + c + '" stroke-width="1.4"/>' : '', fl = d === 4 ? 1 : d === 2 ? 2 : 0; let f = ''; for (let i = 0; i < fl; i++) f += '<path d="M11.2 ' + (2 + i * 5) + ' c0.5 5 7 6 5.5 13 c0.5 -5 -2 -7 -5.5 -8 z" fill="' + c + '"/>';
    return '<svg width="20" height="24" viewBox="0 0 20 24">' + head + stem + f + '</svg>';
  }
  const gmInst = pr => (Object.values(INST).find(i => i.gm === pr && !i.drum) || {}).id || 'piano';
  function scoreFromMidi(buf, title) {
    const m = readMidi(buf);
    const tracks = m.tracks.filter(t => t.notes.length).slice(0, 16);
    if (!tracks.length) throw new Error('That MIDI file has no notes in it.');
    const sc = blankScore(title || 'Imported song', []); sc.parts = [];
    if (m.ts && m.ts[0] > 0 && [2, 4, 8, 16].includes(m.ts[1])) sc.ts = m.ts;
    if (m.key != null) sc.key = clamp(m.key, -7, 7);
    if (m.bpm) sc.bpm = clamp(Math.round(m.bpm), 40, 220);
    tracks.forEach(tr => {
      const drum = tr.channel === 9, inst = drum ? 'drums' : gmInst(tr.program);
      const p = mkPart(String(tr.name || (drum ? 'Drums' : INST[inst].name)).replace(/[\x00-\x1f]/g, '').trim().slice(0, 24) || INST[inst].name, inst);
      /* low parts read best in the bass clef */
      if (!drum) { const avg = tr.notes.reduce((x, y) => x + y.m, 0) / tr.notes.length; p.clef = avg < 57 ? 'bass' : 'treble'; }
      sc.parts.push(p);
      const list = [];
      midiToEvents(tr, m.division).forEach(ev => {
        const ns = [];
        ev.m.forEach(mm => { const nd = drum ? { s: GMD[mm] || snapDrum(35), a: 0 } : midiNote(mm); if (!ns.some(u => u.s === nd.s)) ns.push(nd); });
        if (ns.length) list.push({ t: ev.t, dur: ev.dur, ns });
      });
      /* a note is cut short where the next one starts, so each staff reads as one line of notes and chords */
      list.forEach((e, i) => { const nx = list[i + 1]; const L2 = nx ? Math.min(e.dur, nx.t - e.t) : e.dur; if (L2 > 0) place(p, e.t, { n: e.ns }, L2, mlen(sc)); });
    });
    sc.bars = Math.max(4, Math.ceil(Math.max(0, ...sc.parts.map(endOf)) / mlen(sc)) + 1); return sc;
  }
  /* a whole score to stereo audio, with the same instruments as Play */
  async function renderScore(sc) { const notes = flatNotes(sc); if (!notes.length) throw new Error('There are no notes to play.'); const spu = spuOf(sc), endT = Math.max(...notes.map(n => n.t + n.dur)), sr = 44100, oc = new OfflineAudioContext(2, Math.ceil(sr * (endT * spu + 3)), sr), bus = buses(oc, sc); notes.forEach(n => voice(oc, bus.parts[n.pi], INST[sc.parts[n.pi].inst] || INST.piano, n.kind || n.m, .05 + n.t * spu, Math.max(.05, n.dur * spu - .02))); return oc.startRendering(); }
  /* ================================================================ the editor */
  function mount(body) {
    css(); const root = document.createElement('div'); root.className = 'cmp-root'; body.appendChild(root); const q = s => root.querySelector(s);
    let S = null, undo = [], redo = [], L = null, cur = { p: 0, t: 0 }, lastT = -1, sel = null, clip = null, mode = 'write', inDur = 8, inDot = 0, restMode = 0, chordMode = 0, saveT = 0, kbBase = { treble: 4, bass: 2, perc: 4 };
    let ac = null, playing = false, playT = 0, raf = 0, pac = null, hoverH = null, page = 0, lastCurT = -1;
    const ML = () => mlen(S), inLen = () => inDur * (inDot ? 1.5 : 1), part = () => S.parts[cur.p] || S.parts[0], isDrum = p => !!(INST[p.inst] || {}).drum;
    const nBars = () => Math.max(S.bars || 4, Math.ceil(Math.max(0, ...S.parts.map(endOf)) / ML()) + 1);
    const evAt = (p, t) => timed(p).find(x => x.t === t);
    const target = () => { const p = part(); return (mode === 'write' && lastT >= 0 && evAt(p, lastT)) || evAt(p, cur.t); };
    function edit(fn) { undo.push(JSON.stringify(S)); if (undo.length > 150) undo.shift(); redo = []; fn(); touch(); }
    function touch() { clearTimeout(saveT); q('#csaved').textContent = 'Saving…'; saveT = setTimeout(() => { q('#csaved').textContent = storeScore(S) ? 'Saved ✓' : 'Not saved: storage full'; }, 350); draw(); }
    function open(s) { stop(); S = s; undo = []; redo = []; cur = { p: 0, t: 0 }; lastT = -1; sel = null; storeScore(S); panels(); draw(); }
    /* ---------- sound helpers ---------- */
    function previewNotes(p, notes, sec = .45) { try { if (!pac) pac = new (window.AudioContext || window.webkitAudioContext)(); if (pac.state === 'suspended') pac.resume(); const I = INST[p.inst] || INST.piano; if (!pac._out) { pac._out = pac.createGain(); pac._out.gain.value = .8; pac._out.connect(pac.destination); } notes.forEach(n => voice(pac, pac._out, I, I.drum ? drumKind(n.s) : midiOf(n), pac.currentTime + .01, sec, (p.vol == null ? .8 : p.vol) + .2)); } catch (e) { } }
    function stop() { playing = false; cancelAnimationFrame(raf); clearInterval(playT); if (ac) { try { ac.close(); } catch (e) { } ac = null; } const pl = q('#cplayl'); if (pl) pl.setAttribute('visibility', 'hidden'); const b = q('#cplay'); if (b) b.innerHTML = '▶ Play'; }
    function play(fromT) {
      stop(); const notes = flatNotes(S).filter(n => n.t >= fromT); if (!notes.length) return A.toast('Nothing to play yet: click the staff to add notes.');
      ac = new (window.AudioContext || window.webkitAudioContext)(); const bus = buses(ac, S), spu = spuOf(S), t0 = ac.currentTime + .12, endT = Math.max(...notes.map(n => n.t + n.dur)); let i = 0; playing = true; q('#cplay').innerHTML = '⏹ Stop'; ac._bus = bus;
      const pump = () => { if (!ac) return; const now = ac.currentTime; while (i < notes.length && t0 + (notes[i].t - fromT) * spu < now + .6) { const n = notes[i++], p = S.parts[n.pi]; voice(ac, bus.parts[n.pi], INST[p.inst] || INST.piano, n.kind || n.m, t0 + (n.t - fromT) * spu, Math.max(.05, n.dur * spu - .02)); } };
      pump(); playT = setInterval(() => { pump(); if (ac && L) { const tt = fromT + (ac.currentTime - t0) / spu, me = L.meas[clamp(Math.floor(Math.max(0, tt) / ML()), 0, L.meas.length - 1)]; if (me && L.sys[me.sys].page !== page) { page = L.sys[me.sys].page; draw(); } } if (ac && i >= notes.length && fromT + (ac.currentTime - t0) / spu > endT + 2) stop(); }, 80); let lastSys = -1;
      const tick = () => { if (!ac || !playing) return; const tt = fromT + (ac.currentTime - t0) / spu; if (tt > endT + 2) return stop(); const m = Math.floor(Math.max(0, tt) / ML()), me = L.meas[m]; if (me && L.sys[me.sys].page !== page) { page = L.sys[me.sys].page; draw(); } const pl = q('#cplayl'); if (me && pl) { const sy = L.sys[me.sys], x = evX(me, Math.max(0, tt) - m * ML()); pl.setAttribute('x1', x); pl.setAttribute('x2', x); pl.setAttribute('y1', sy.y + 18); pl.setAttribute('y2', sy.y + S.parts.length * PH - 18); pl.setAttribute('visibility', 'visible'); if (me.sys !== lastSys) { lastSys = me.sys; try { pl.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } catch (e) { } } } raf = requestAnimationFrame(tick); };
      raf = requestAnimationFrame(tick);
    }
    function setPartGains() { if (ac && ac._bus) S.parts.forEach((p, i) => { const g = ac._bus.parts[i]; if (g) g.gain.value = p.mute ? 0 : (p.vol == null ? .8 : p.vol); }); }
    /* ---------- layout and drawing ---------- */
    const PH = 104, INK = '#1d1b18', SELC = '#2563eb', LM = 86;
    function layout() {
      /* systems are dealt onto pages the shape of a sheet of paper; only the page on show is drawn */
      const W = Math.max(560, (q('#cpaper').clientWidth || 900) - 8), ml = ML(), nb = nBars(), hw = 40 + Math.abs(S.key) * 9 + 6, tw = 28, minMW = Math.max(150, ml * 6.6), sys = [], meas = [], sysH = S.parts.length * PH + 22, H = Math.max(Math.round(W * 1.25), sysH + 140); let m = 0, y = 84, pg = 0;
      while (m < nb) { if (sys.length && y + sysH > H - 36) { pg++; y = 30; } const x0 = LM + hw + (sys.length ? 0 : tw), avail = W - x0 - 6, bpl = Math.max(1, Math.floor(avail / minMW)), n = Math.min(nb - m, bpl), mw = avail / bpl; sys.push({ y, x0, x1: x0 + mw * n, n, page: pg });
        for (let i = 0; i < n; i++) meas.push({ m: m + i, sys: sys.length - 1, x0: x0 + i * mw, x1: x0 + (i + 1) * mw }); m += n; y += sysH; }
      return { W, sys, meas, H, hw, tw, pages: pg + 1 };
    }
    const evX = (me, tin) => me.x0 + 16 + (tin / ML()) * (me.x1 - me.x0 - 28);
    const xAt = t => { const nb = L.meas.length, m = clamp(Math.floor(t / ML()), 0, nb - 1); return evX(L.meas[m], t - m * ML()); };
    const baseOf = p => p.clef === 'bass' ? 18 : 30;
    const topOf = (si, pi) => L.sys[si].y + pi * PH + 32;
    function restSVG(X, top, d, dot, col, op) {
      const mid = top + 20, o = op ? ' opacity="' + op + '"' : ''; let s = '';
      if (d >= 32) s = '<rect x="' + (X - 6) + '" y="' + (top + 10) + '" width="12" height="5" fill="' + col + '"' + o + '/>';
      else if (d === 16) s = '<rect x="' + (X - 6) + '" y="' + (top + 15) + '" width="12" height="5" fill="' + col + '"' + o + '/>';
      else if (d === 8) s = '<path d="M' + (X - 3) + ' ' + (mid - 15) + ' l6 7 l-5 6 l6 7 q-7 -3 -5 4" fill="none" stroke="' + col + '" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round"' + o + '/>';
      else { const k = d === 4 ? 1 : 2; for (let i = 0; i < k; i++) s += '<circle cx="' + (X - 2.5 - i * 1.5) + '" cy="' + (mid - 4 + i * 7) + '" r="2.6" fill="' + col + '"' + o + '/><path d="M' + (X - 2.5 - i * 1.5) + ' ' + (mid - 2 + i * 7) + ' Q' + (X + 1 - i * 1.5) + ' ' + (mid - 1 + i * 7) + ' ' + (X + 3.5 - i * 1.5) + ' ' + (mid - 6 + i * 7) + '" fill="none" stroke="' + col + '" stroke-width="1.5"' + o + '/>'; s += '<line x1="' + (X + 3.5) + '" y1="' + (mid - 6) + '" x2="' + (X - 1 - k * 1.5) + '" y2="' + (mid + 6 + k * 5) + '" stroke="' + col + '" stroke-width="1.6"' + o + '/>'; }
      if (dot) s += '<circle cx="' + (X + 10) + '" cy="' + (mid - 5) + '" r="2" fill="' + col + '"' + o + '/>';
      return s;
    }
    function chordSVG(X, top, e, base, drum, accMap, col) {
      const ns = e.n.slice().sort((a, b) => a.s - b.s), poss = ns.map(n => n.s - base), avg = poss.reduce((a, b) => a + b, 0) / poss.length, up = avg < 4, Y = q2 => top + 40 - q2 * 5, lo = poss[0], hi = poss[poss.length - 1]; let s = '', prevQ = null, prevOff = false, nAcc = 0; const ys = {};
      for (let q2 = -2; q2 >= lo; q2 -= 2) s += '<line x1="' + (X - 10) + '" y1="' + Y(q2) + '" x2="' + (X + 10) + '" y2="' + Y(q2) + '" stroke="' + INK + '" stroke-width="1.2"/>';
      for (let q2 = 10; q2 <= hi; q2 += 2) s += '<line x1="' + (X - 10) + '" y1="' + Y(q2) + '" x2="' + (X + 10) + '" y2="' + Y(q2) + '" stroke="' + INK + '" stroke-width="1.2"/>';
      ns.forEach((n, i) => { const q2 = poss[i], yy = Y(q2); let dx = 0; if (prevQ !== null && q2 - prevQ === 1 && !prevOff) dx = up ? 11 : -11; prevOff = dx !== 0; prevQ = q2; ys[n.s] = yy; const hx = X + dx;
        if (drum && XHEAD[n.s]) s += '<path d="M' + (hx - 4.5) + ' ' + (yy - 4.5) + ' l9 9 M' + (hx + 4.5) + ' ' + (yy - 4.5) + ' l-9 9" stroke="' + col + '" stroke-width="2"/>';
        else if (e.d >= 32) s += '<ellipse cx="' + hx + '" cy="' + yy + '" rx="6.6" ry="4.4" fill="none" stroke="' + col + '" stroke-width="2.3"/>';
        else s += '<ellipse cx="' + hx + '" cy="' + yy + '" rx="5.7" ry="4.1" transform="rotate(-20 ' + hx + ' ' + yy + ')" fill="' + (e.d >= 16 ? '#fbf8f1' : col) + '" stroke="' + col + '" stroke-width="' + (e.d >= 16 ? 1.8 : 1) + '"/>';
        if (!drum) { const want = n.a || 0, have = n.s in accMap ? accMap[n.s] : keyAlt(S.key, mod(n.s, 7)); if (want !== have) { s += '<text x="' + (X - 12 - (nAcc % 2) * 9 - (dx < 0 ? 11 : 0)) + '" y="' + (yy + 5) + '" font-size="16" text-anchor="end" fill="' + col + '" font-family="Segoe UI Symbol,Noto Music,serif">' + ACC[want] + '</text>'; accMap[n.s] = want; nAcc++; } }
        if (e.dot) s += '<circle cx="' + (X + 11 + (up && dx > 0 ? 11 : 0)) + '" cy="' + (yy - (mod(q2, 2) === 0 ? 2.5 : 0)) + '" r="2" fill="' + col + '"/>';
      });
      if (e.d < 32) { const sx = up ? X + 5.3 : X - 5.3, y1 = up ? Y(lo) : Y(hi), y2 = up ? Math.min(Y(hi) - 33, top + 20) : Math.max(Y(lo) + 33, top + 20); s += '<line x1="' + sx + '" y1="' + y1 + '" x2="' + sx + '" y2="' + y2 + '" stroke="' + col + '" stroke-width="1.4"/>';
        const fl = e.d === 4 ? 1 : e.d === 2 ? 2 : e.d === 1 ? 3 : 0; for (let i = 0; i < fl; i++) s += up ? '<path d="M' + sx + ' ' + (y2 + i * 7) + ' c0.5 7 9 8 7.5 17 c0.5 -6 -3 -9 -7.5 -11 z" fill="' + col + '"/>' : '<path d="M' + sx + ' ' + (y2 - i * 7) + ' c0.5 -7 9 -8 7.5 -17 c0.5 6 -3 9 -7.5 11 z" fill="' + col + '"/>'; }
      return { s, up, ys };
    }
    function draw() {
      if (!S) return; L = layout(); const ml = ML(), np = S.parts.length; let s = '';
      const pgOfT = t => L.sys[L.meas[clamp(Math.floor(t / ml), 0, L.meas.length - 1)].sys].page, onPg = me => L.sys[me.sys].page === page;
      if (cur.t !== lastCurT) { page = pgOfT(cur.t); lastCurT = cur.t; } page = clamp(page, 0, L.pages - 1);
      if (page === 0) s += '<text x="' + (L.W / 2) + '" y="42" font-size="26" text-anchor="middle" fill="' + INK + '" font-family="Georgia,serif">' + esc(S.name || '') + '</text><text x="' + (LM - 40) + '" y="72" font-size="13" fill="' + INK + '" font-family="Georgia,serif">♩ = ' + S.bpm + '</text>';
      s += '<text x="' + (L.W / 2) + '" y="' + (L.H - 12) + '" font-size="12" text-anchor="middle" fill="#8a8478">Page ' + (page + 1) + ' of ' + L.pages + '</text>'; pager();
      const k = S.key, kpos = k > 0 ? [8, 5, 9, 6, 3, 7, 4] : [4, 7, 3, 6, 2, 5, 1];
      L.sys.forEach((sy, si) => { if (sy.page !== page) return;
        s += '<text x="' + (LM + 2) + '" y="' + (sy.y + 14) + '" font-size="11" font-style="italic" fill="#8a8478">' + (L.meas.find(m => m.sys === si).m + 1) + '</text>';
        if (np > 1) s += '<line x1="' + LM + '" y1="' + topOf(si, 0) + '" x2="' + LM + '" y2="' + (topOf(si, np - 1) + 40) + '" stroke="' + INK + '" stroke-width="3"/>';
        S.parts.forEach((p, pi) => {
          const top = topOf(si, pi), isCur = pi === cur.p;
          for (let i = 0; i < 5; i++) s += '<line x1="' + LM + '" y1="' + (top + i * 10) + '" x2="' + sy.x1 + '" y2="' + (top + i * 10) + '" stroke="' + INK + '" stroke-width="1"/>';
          const nm = si === 0 ? p.name : (p.name || '').slice(0, 9); s += '<text x="' + (LM - 8) + '" y="' + (top + 24) + '" font-size="12" text-anchor="end" fill="' + (isCur ? SELC : INK) + '" font-weight="' + (isCur ? 700 : 500) + '">' + esc(nm) + '</text>';
          if (p.clef === 'perc') s += '<rect x="' + (LM + 12) + '" y="' + (top + 10) + '" width="4" height="20" fill="' + INK + '"/><rect x="' + (LM + 20) + '" y="' + (top + 10) + '" width="4" height="20" fill="' + INK + '"/>';
          else if (p.clef === 'bass') s += '<text x="' + (LM + 4) + '" y="' + (top + 30) + '" font-size="40" fill="' + INK + '" font-family="Segoe UI Symbol,Noto Music,serif">𝄢</text>';
          else s += '<text x="' + (LM + 3) + '" y="' + (top + 38) + '" font-size="54" fill="' + INK + '" font-family="Segoe UI Symbol,Noto Music,serif">𝄞</text>';
          if (p.clef !== 'perc') for (let i = 0; i < Math.abs(k); i++) s += '<text x="' + (LM + 38 + i * 9) + '" y="' + (top + 40 - (kpos[i] - (p.clef === 'bass' ? 2 : 0)) * 5 + 5) + '" font-size="17" fill="' + INK + '" font-family="Segoe UI Symbol,serif">' + (k > 0 ? '♯' : '♭') + '</text>';
          if (si === 0) s += '<text x="' + (LM + L.hw + 12) + '" y="' + (top + 18) + '" font-size="22" font-weight="800" text-anchor="middle" fill="' + INK + '" font-family="Georgia,serif">' + S.ts[0] + '</text><text x="' + (LM + L.hw + 12) + '" y="' + (top + 38) + '" font-size="22" font-weight="800" text-anchor="middle" fill="' + INK + '" font-family="Georgia,serif">' + S.ts[1] + '</text>';
          L.meas.filter(m => m.sys === si).forEach(me => { const last = me.m === L.meas.length - 1; s += last ? '<line x1="' + (me.x1 - 5) + '" y1="' + top + '" x2="' + (me.x1 - 5) + '" y2="' + (top + 40) + '" stroke="' + INK + '" stroke-width="1"/><rect x="' + (me.x1 - 3) + '" y="' + top + '" width="3.5" height="40" fill="' + INK + '"/>' : '<line x1="' + me.x1 + '" y1="' + top + '" x2="' + me.x1 + '" y2="' + (top + 40) + '" stroke="' + INK + '" stroke-width="1.1"/>'; });
        });
      });
      /* selection and cursor highlight (under the notes) */
      let hl = ''; const p0 = part();
      if (sel && sel.p === cur.p) { const a = Math.min(sel.a, sel.b), b = Math.max(sel.a, sel.b); L.meas.forEach(me => { const ms = me.m * ml, me2 = ms + ml; if (me2 <= a || ms >= b || !onPg(me)) return; const xa = a > ms ? evX(me, a - ms) - 10 : me.x0 + 2, xb = b < me2 ? evX(me, b - ms) - 10 : me.x1 - 2, top = topOf(me.sys, cur.p); hl += '<rect x="' + xa + '" y="' + (top - 14) + '" width="' + Math.max(4, xb - xa) + '" height="68" rx="6" fill="' + SELC + '" opacity=".13"/>'; }); }
      if (pgOfT(cur.t) === page) { const m = clamp(Math.floor(cur.t / ml), 0, L.meas.length - 1), me = L.meas[m], top = topOf(me.sys, cur.p), x = evX(me, cur.t - m * ml), here = evAt(p0, cur.t); hl += here ? '<rect x="' + (x - 11) + '" y="' + (top - 16) + '" width="22" height="72" rx="6" fill="' + SELC + '" opacity=".14"/>' : '<line x1="' + (x - 8) + '" y1="' + (top - 10) + '" x2="' + (x - 8) + '" y2="' + (top + 50) + '" stroke="' + SELC + '" stroke-width="2.5" stroke-linecap="round"/><path d="M' + (x - 13) + ' ' + (top - 14) + ' h10 l-5 6 z" fill="' + SELC + '"/>'; }
      /* notes, rests and ties */
      let notes = '';
      S.parts.forEach((p, pi) => {
        const base = baseOf(p), drum = isDrum(p), pos = []; let accMap = {}, lastM = -1; const tl = timed(p), pend = endOf(p);
        tl.forEach(x => { const m = Math.floor(x.t / ml), me = L.meas[m]; if (!me || !onPg(me)) { pos.push(null); return; } if (m !== lastM) { accMap = {}; lastM = m; } const X = evX(me, x.t - m * ml), top = topOf(me.sys, pi), on = pi === cur.p && ((x.t === cur.t) || (x.t === lastT && mode === 'write') || (sel && sel.p === pi && x.t >= Math.min(sel.a, sel.b) && x.t < Math.max(sel.a, sel.b))), col = on ? SELC : INK;
          if (x.e.r) { notes += restSVG(X, top, x.e.d, x.e.dot, col); pos.push(null); }
          else { const c = chordSVG(X, top, x.e, base, drum, accMap, col); notes += c.s; pos.push({ X, sys: me.sys, e: x.e, ys: c.ys, up: c.up }); } });
        /* rests to finish the last bar, and whole-bar rests in empty bars (drawn faintly) */
        if (pend % ml) spans(pend, ml - pend % ml, ml).forEach(([a, f]) => { const m = Math.floor(a / ml), me = L.meas[m]; if (me && onPg(me)) notes += restSVG(evX(me, a - m * ml), topOf(me.sys, pi), DV[f][0], DV[f][1], INK, .3); });
        L.meas.forEach(me => { if (me.m * ml >= pend && onPg(me)) notes += restSVG((me.x0 + me.x1) / 2, topOf(me.sys, pi), 32, 0, INK, .22); });
        pos.forEach((a, i) => { const b = pos[i + 1]; if (!a || !b || !a.e.tie) return; a.e.n.forEach(n => { if (!b.e.n.some(m2 => m2.s === n.s && (m2.a || 0) === (n.a || 0))) return; const y = a.ys[n.s] + (a.up ? 6 : -6), dir = a.up ? 1 : -1, x1 = a.X + 5, x2 = b.sys === a.sys ? b.X - 5 : L.sys[a.sys].x1 + 2, mx = (x1 + x2) / 2; notes += '<path d="M' + x1 + ' ' + y + ' Q' + mx + ' ' + (y + dir * 10) + ' ' + x2 + ' ' + y + ' Q' + mx + ' ' + (y + dir * 7) + ' ' + x1 + ' ' + y + ' Z" fill="' + INK + '"/>'; }); });
      });
      q('#cpaper').innerHTML = '<svg id="csvg" width="' + L.W + '" height="' + L.H + '" viewBox="0 0 ' + L.W + ' ' + L.H + '" xmlns="http://www.w3.org/2000/svg">' + hl + s + notes + '<line id="cplayl" stroke="#e8590c" stroke-width="3" opacity=".85" visibility="hidden"/><g id="cghost" pointer-events="none" visibility="hidden"><ellipse rx="5.7" ry="4.1" fill="' + SELC + '" opacity=".45"/><text font-size="12" font-weight="700" fill="' + SELC + '"></text></g></svg>';
      status();
    }
    /* ---------- pages: turn them, and make the score as long as you like ---------- */
    function pager() {
      const el = q('#cpager'); if (!el || !L) return; const used = Math.ceil(Math.max(0, ...S.parts.map(endOf)) / ML());
      const h = '<button class="cmp-b" data-pg="first" title="First page"' + (page ? '' : ' disabled') + '>⏮</button><button class="cmp-b" data-pg="-1" title="Previous page (Page Up)"' + (page ? '' : ' disabled') + '>◀ Previous</button><b>Page ' + (page + 1) + ' of ' + L.pages + '</b><button class="cmp-b" data-pg="1" title="Next page (Page Down)"' + (page < L.pages - 1 ? '' : ' disabled') + '>Next ▶</button><button class="cmp-b" data-pg="last" title="Last page"' + (page < L.pages - 1 ? '' : ' disabled') + '>⏭</button>' +
        '<span class="cmp-sep"></span><label class="small mute">Bars <input id="cbars" type="number" min="1" max="2000" value="' + L.meas.length + '" style="width:70px"></label><button class="cmp-b" data-pg="add8">＋ 8 bars</button><button class="cmp-b" data-pg="add32">＋ 32 bars</button><button class="cmp-b" data-pg="trim" title="Remove empty bars at the end">✂ Remove empty bars</button><span class="small mute">' + used + ' bar' + (used === 1 ? '' : 's') + ' with music</span>';
      if (el._h !== h) { el._h = h; el.innerHTML = h; }
    }
    function turnPage(to) { if (!L) return; page = clamp(to, 0, L.pages - 1); draw(); try { q('#cpager').scrollIntoView({ block: 'nearest' }); } catch (e) { } }
    function setBars(nb) { const used = Math.ceil(Math.max(0, ...S.parts.map(endOf)) / ML()); nb = clamp(Math.round(nb) || 1, Math.max(1, used), 2000); if (nb === (S.bars || 4) && nb === L.meas.length) return; edit(() => { S.bars = nb; }); }
    /* ---------- status line ---------- */
    function status() {
      const p = part(), ml = ML(), bar = Math.floor(cur.t / ml) + 1, beatU = S.ts[1] === 8 ? 4 : 8, beat = Math.floor((cur.t % ml) / beatU) + 1, x = target(), I = INST[p.inst] || INST.piano;
      const what = x ? (x.e.r ? DUR.find(d => d[0] === x.e.d)?.[1].toLowerCase() + (x.e.dot ? ' dotted' : '') + ' rest' : (isDrum(p) ? x.e.n.map(n => (PADS.find(d => d[0] === n.s) || [0, drumKind(n.s)])[1]).join(' + ') : x.e.n.map(nameOf).join(' + ')) + ', ' + ((DUR.find(d => d[0] === x.e.d) || [0, '32nd'])[1].toLowerCase()) + (x.e.dot ? ' dotted' : '') + (x.e.tie ? ', tied' : '')) : 'empty spot';
      q('#cstatus').innerHTML = '<b>Bar ' + bar + ', beat ' + beat + '</b> · ' + esc(p.name) + ' (' + esc(I.name) + ') · ' + esc(what) + ' · <span>' + (mode === 'write' ? (isDrum(p) ? 'Click the staff or a drum pad to add a hit.' : 'Click the staff, type A–G or press the piano to add a note' + (restMode ? ' (rest mode is on)' : '') + '.') : 'Select mode: click a note to select it; Shift+click selects a range.') + '</span>';
      root.querySelectorAll('.cmp-prow').forEach((r, i) => r.classList.toggle('cmp-cur', i === cur.p));
    }
    /* ---------- hit testing ---------- */
    function hit(ev) {
      const svg = q('#csvg'); if (!svg || !L) return null; const r = svg.getBoundingClientRect(), x = ev.clientX - r.left, y = ev.clientY - r.top, np = S.parts.length;
      const si = L.sys.findIndex(sy => sy.page === page && y >= sy.y - 4 && y < sy.y + np * PH + 18); if (si < 0) return null;
      const pi = clamp(Math.floor((y - L.sys[si].y) / PH), 0, np - 1), p = S.parts[pi], top = topOf(si, pi), ms = L.meas.filter(m => m.sys === si);
      if (x < ms[0].x0 - 6 || x > ms[ms.length - 1].x1 + 4) return null;
      const me = ms.find(m => x < m.x1) || ms[ms.length - 1], ml = ML(), tin = clamp((x - me.x0 - 16) / (me.x1 - me.x0 - 28), 0, .999) * ml, g = Math.min(inLen(), 8), t0 = me.m * ml;
      const cands = []; for (let a = 0; a < ml; a += g) cands.push(a); timed(p).forEach(z => { if (z.t >= t0 && z.t < t0 + ml) cands.push(z.t - t0); });
      const ux = (me.x1 - me.x0 - 28) / ml; cands.sort((a, b) => Math.abs(a - tin) - Math.abs(b - tin)); let tq = cands[0]; const exact = timed(p).find(z => z.t === t0 + tq); if (!exact && Math.abs(tq - tin) * ux > 14) tq = Math.floor(tin / g) * g;
      let s = Math.round((top + 40 - y) / 5) + baseOf(p); s = clamp(s, baseOf(p) - 7, baseOf(p) + 15); if (isDrum(p)) s = snapDrum(s);
      const tAny = t0 + tin, cover = timed(p).find(z => z.t <= tAny && tAny < z.t + len(z.e));
      return { pi, p, t: t0 + tq, s, me, top, cover };
    }
    /* ---------- editing actions ---------- */
    function writeNotes(notes, advance) { const p = part(), t = cur.t; edit(() => place(p, t, { n: notes }, inLen(), ML())); lastT = t; if (advance) cur.t = t + inLen(); sel = null; previewNotes(p, notes); draw(); }
    function writeRest() { const p = part(), t = cur.t; edit(() => place(p, t, { r: 1 }, inLen(), ML())); lastT = -1; cur.t = t + inLen(); sel = null; draw(); }
    function addToChord(t, n) { const p = part(); const x = evAt(p, t); if (!x || x.e.r) return false; if (x.e.n.some(m => m.s === n.s)) return true; edit(() => { evAt(p, t).e.n.push(n); }); previewNotes(p, x.e.n.concat([n])); draw(); return true; }
    function nearS(l, ref) { let s = Math.floor(ref / 7) * 7 + l; if (s - ref > 3) s -= 7; if (ref - s > 3) s += 7; return s; }
    function refS(p, t) { const tl = timed(p).filter(x => !x.e.r); const before = tl.filter(x => x.t < t).pop() || tl.find(x => x.t >= t); return before ? Math.max(...before.e.n.map(n => n.s)) : baseOf(p) + 4; }
    function letter(Lt, add) {
      const p = part(); if (isDrum(p)) return A.toast('Drums use the pads below the score, or click the staff.'); const l = LET.indexOf(Lt);
      if ((add || chordMode) && lastT >= 0) { const x = evAt(p, lastT); if (x && !x.e.r) { const top = Math.max(...x.e.n.map(n => n.s)); let s = Math.floor(top / 7) * 7 + l; if (s <= top) s += 7; addToChord(lastT, { s, a: keyAlt(S.key, l) }); return; } }
      writeNotes([{ s: nearS(l, refS(p, cur.t)), a: keyAlt(S.key, l) }], true);
    }
    function pianoNote(n, shift) { const p = part(); if (isDrum(p)) return; if (mode !== 'write' || !q('#cpw').checked) return previewNotes(p, [n]); if ((shift || chordMode) && lastT >= 0 && addToChord(lastT, n)) return; writeNotes([n], true); }
    function forTargets(fn) { const p = part(); let xs; if (sel && sel.p === cur.p) { const a = Math.min(sel.a, sel.b), b = Math.max(sel.a, sel.b); xs = timed(p).filter(x => x.t >= a && x.t < b); } else { const x = target(); xs = x ? [x] : []; } xs = xs.filter(x => !x.e.r); if (!xs.length) return; const ts = xs.map(x => x.t); edit(() => ts.forEach(t => fn(evAt(p, t).e))); previewNotes(p, evAt(p, ts[0]).e.n, .3); draw(); }
    function shiftPitch(dir, oct) { const drum = isDrum(part()); forTargets(e => e.n.forEach(n => { n.s += oct ? 7 * dir : dir; if (drum) n.s = snapDrum(n.s); n.a = drum ? 0 : keyAlt(S.key, mod(n.s, 7)); })); }
    function accid(v) { if (isDrum(part())) return; forTargets(e => e.n.forEach(n => { n.a = v === 'nat' ? 0 : clamp((n.a || 0) + v, -2, 2); })); }
    function del() { const p = part(); let rng; if (sel && sel.p === cur.p) rng = [Math.min(sel.a, sel.b), Math.max(sel.a, sel.b)]; else { const x = target(); if (!x) return; rng = [x.t, x.t + len(x.e)]; } edit(() => { timed(p).filter(x => x.t >= rng[0] && x.t < rng[1] && !x.e.r).forEach(x => { const e = evAt(p, x.t); if (e) { e.e.r = 1; delete e.e.n; delete e.e.tie; } }); p.ev = rebuild(timed(p), ML()); }); lastT = -1; draw(); }
    function setDur(d) { inDur = d; if (d === 1 || (d === 2 && inDot)) { } if (mode === 'select') { const x = evAt(part(), cur.t), p = part(); if (x) { const t = x.t, base = x.e.r ? { r: 1 } : { n: x.e.n, tie: x.e.tie }; edit(() => place(p, t, base, d * (x.e.dot ? 1.5 : 1), ML())); } } bar(); draw(); }
    function toggleDot() { if (mode === 'select') { const p = part(), x = evAt(p, cur.t); if (x && x.e.d > 1) { const t = x.t, base = x.e.r ? { r: 1 } : { n: x.e.n, tie: x.e.tie }; edit(() => place(p, t, base, x.e.d * (x.e.dot ? 1 : 1.5), ML())); } } else inDot = inDot ? 0 : 1; bar(); draw(); }
    function toggleTie() { const p = part(), x = target(); if (!x || x.e.r) return; const t = x.t; if (mode === 'write' && t === lastT && !x.e.tie) { const notes = x.e.n.map(n => ({ ...n })); edit(() => { evAt(p, t).e.tie = 1; place(p, cur.t, { n: notes }, inLen(), ML()); }); lastT = cur.t; cur.t += inLen(); } else edit(() => { const z = evAt(p, t); z.e.tie = z.e.tie ? 0 : 1; }); draw(); }
    function move(dir, extend) { const p = part(), tl = timed(p), ml = ML(), maxT = nBars() * ml; const old = cur.t; let t; if (dir < 0) { const prev = tl.filter(x => x.t < cur.t).pop(); t = prev ? prev.t : Math.max(0, cur.t - inLen()); } else { const nx = tl.find(x => x.t > cur.t); t = nx ? nx.t : Math.min(maxT - 1, cur.t + inLen()); } if (extend) { if (!sel || sel.p !== cur.p) sel = { p: cur.p, a: old, b: old }; const here = evAt(p, t); sel.b = dir > 0 ? t : t; if (dir > 0 && !evAt(p, t) && t === old) sel.b = t + inLen(); void here; } else sel = null; cur.t = t; lastT = -1; draw(); }
    function copy() { const p = part(); let xs; if (sel && sel.p === cur.p) { const a = Math.min(sel.a, sel.b), b = Math.max(sel.a, sel.b); xs = timed(p).filter(x => x.t >= a && x.t < b); } else { const x = evAt(p, cur.t); xs = x ? [x] : []; } if (!xs.length) return A.toast('Select some notes first (Shift+arrows or Shift+click).'); const t0 = xs[0].t; clip = xs.map(x => ({ dt: x.t - t0, e: JSON.parse(JSON.stringify(x.e)) })); A.toast('Copied ' + clip.length + ' note' + (clip.length > 1 ? 's' : '') + '. Move to a spot and press Ctrl+V.'); }
    function paste() { if (!clip) return A.toast('Nothing copied yet.'); const p = part(), t = cur.t; let end = t; edit(() => clip.forEach(c => { place(p, t + c.dt, c.e.r ? { r: 1 } : { n: c.e.n, tie: c.e.tie }, len(c.e), ML()); end = Math.max(end, t + c.dt + len(c.e)); })); cur.t = end; sel = null; lastT = -1; draw(); }
    function doUndo() { if (!undo.length) return; redo.push(JSON.stringify(S)); S = JSON.parse(undo.pop()); cur.p = Math.min(cur.p, S.parts.length - 1); panels(); touch(); }
    function doRedo() { if (!redo.length) return; undo.push(JSON.stringify(S)); S = JSON.parse(redo.pop()); cur.p = Math.min(cur.p, S.parts.length - 1); panels(); touch(); }
    /* ---------- toolbar ---------- */
    function bar() {
      const b = (id, html, title, on) => '<button class="cmp-b' + (on ? ' cmp-on' : '') + '" data-a="' + id + '" title="' + esc(title) + '">' + html + '</button>';
      q('#ctools').innerHTML = '<span class="cmp-lbl">Mode</span>' + b('write', '✏️ Write', 'Write notes by clicking the staff (N switches)', mode === 'write') + b('select', '👆 Select', 'Select notes to change or copy them (N switches)', mode === 'select') + '<span class="cmp-sep"></span><span class="cmp-lbl">Length</span>' +
        DUR.map(d => b('d' + d[0], durIcon(d[0], restMode) + '<span>' + d[1] + '<br><small>' + d[3] + ' · key ' + d[2] + '</small></span>', d[1] + ' ' + (restMode ? 'rest' : 'note') + ' (' + d[3] + '). Key ' + d[2], inDur === d[0])).join('') +
        b('dot', '● Dot', 'Dotted: half as long again (key .)', inDot) + b('rest', durIcon(8, 1) + ' Rest', 'Write silences in place of notes (key 0)', restMode) + '<span class="cmp-sep"></span>' +
        b('sharp', '♯', 'Sharp: half step up (key #)') + b('flat', '♭', 'Flat: half step down (key -)') + b('nat', '♮', 'Natural (key =)') + b('tie', '⁀ Tie', 'Tie: hold the note into the next one (key T)') + b('chord', '➕ Chord', 'When on, new notes stack on the last note to make a chord (or hold Shift)', chordMode) +
        '<span class="cmp-sep"></span>' + b('up', '▲', 'Move note up (Up arrow, Ctrl for an octave)') + b('down', '▼', 'Move note down (Down arrow)') + b('del', '🗑', 'Turn the selected notes into rests (Delete)') + b('copy', '⧉ Copy', 'Copy (Ctrl+C)') + b('paste', '📋 Paste', 'Paste at the cursor (Ctrl+V)') + b('undo', '↶ Undo', 'Undo (Ctrl+Z)') + b('redo', '↷ Redo', 'Redo (Ctrl+Y)');
      q('#cpaper').classList.toggle('cmp-sel', mode === 'select');
    }
    function act(a) {
      if (a[0] === 'd' && a !== 'dot' && a !== 'del' && a !== 'down') return setDur(+a.slice(1));
      ({ write: () => { mode = 'write'; bar(); draw(); }, select: () => { mode = 'select'; lastT = -1; bar(); draw(); }, dot: toggleDot, rest: () => { if (mode === 'write' && !restMode && evAt(part(), cur.t) === undefined) { } restMode = restMode ? 0 : 1; bar(); status(); },
        sharp: () => accid(1), flat: () => accid(-1), nat: () => accid('nat'), tie: toggleTie, chord: () => { chordMode = chordMode ? 0 : 1; bar(); }, up: () => shiftPitch(1), down: () => shiftPitch(-1), del, copy, paste, undo: doUndo, redo: doRedo })[a]?.();
    }
    /* ---------- side panels: parts, score settings, helpers, piano ---------- */
    const instOpts = sel2 => GROUPS.map(g => '<optgroup label="' + g + '">' + Object.values(INST).filter(i => i.grp === g).map(i => '<option value="' + i.id + '"' + (i.id === sel2 ? ' selected' : '') + '>' + i.name + '</option>').join('') + '</optgroup>').join('');
    function panels() {
      const ix = idx(); q('#cpick').innerHTML = ix.map(x => '<option value="' + x.id + '"' + (x.id === S.id ? ' selected' : '') + '>' + esc(x.name) + '</option>').join('');
      q('#cname').value = S.name; q('#cbpm').value = S.bpm; q('#cbpmv').textContent = S.bpm + ' bpm · ' + (S.bpm < 66 ? 'slow' : S.bpm < 96 ? 'relaxed' : S.bpm < 126 ? 'moderate' : S.bpm < 160 ? 'quick' : 'very fast');
      q('#ckey').innerHTML = Array.from({ length: 15 }, (_, i) => i - 7).map(k => '<option value="' + k + '"' + (k === S.key ? ' selected' : '') + '>' + keyLabel(k) + '</option>').join('');
      q('#cts').value = S.ts.join('/');
      q('#cparts').innerHTML = S.parts.map((p, i) => '<div class="cmp-prow" data-p="' + i + '"><input type="text" data-f="name" value="' + esc(p.name) + '" maxlength="24" title="Part name"><select data-f="inst" title="Instrument">' + instOpts(p.inst) + '</select><select data-f="clef" title="Clef"><option value="treble"' + (p.clef === 'treble' ? ' selected' : '') + '>Treble 𝄞</option><option value="bass"' + (p.clef === 'bass' ? ' selected' : '') + '>Bass 𝄢</option><option value="perc"' + (p.clef === 'perc' ? ' selected' : '') + '>Drums</option></select><input type="range" data-f="vol" min="0" max="1" step=".05" value="' + (p.vol == null ? .8 : p.vol) + '" style="width:70px" title="Volume"><button class="cmp-b' + (p.mute ? ' cmp-on' : '') + '" data-pa="mute" title="Mute this part">' + (p.mute ? '🔇' : '🔊') + '</button><button class="cmp-b" data-pa="hear" title="Hear this instrument">👂</button><button class="cmp-b" data-pa="upp" title="Move up">↑</button><button class="cmp-b" data-pa="rm" title="Remove this part">✕</button></div>').join('');
      q('#cadd').innerHTML = '<option value="">＋ Add an instrument…</option>' + instOpts('');
      const keep = ['#hpart', '#hbpart', '#hmpart'].map(id => q(id).value); let ho = '', hb = ''; S.parts.forEach((p, i) => { const o = '<option value="' + i + '">' + esc(p.name) + '</option>'; if (isDrum(p)) hb += o; else ho += o; });
      q('#hpart').innerHTML = ho; q('#hmpart').innerHTML = ho; q('#hbpart').innerHTML = hb; ['#hpart', '#hbpart', '#hmpart'].forEach((id, i) => { if (keep[i] !== '' && q(id).querySelector('option[value="' + keep[i] + '"]')) q(id).value = keep[i]; });
      if (q('#hpart').value === '0' && keep[0] === '' && S.parts[1] && !isDrum(S.parts[1])) q('#hpart').value = '1';
      const pr = parseProg(q('#hprog').value === 'custom' ? q('#hcustom').value : q('#hprog').value); q('#hnames').textContent = pr.length ? 'Chords: ' + pr.map(d => chordName(S, d)).join(' – ') : 'Type numerals like I V vi IV';
      keyboard(); status();
    }
    function keyboard() {
      const p = part(), host = q('#ckeys'); if (isDrum(p)) { q('#ckbt').textContent = '🥁 Drum pads: click to add a hit at the cursor (Shift+click stacks hits)'; host.innerHTML = '<div class="cmp-pads">' + PADS.map(d => '<button class="cmp-pad" data-pad="' + d[0] + '">' + d[1] + '</button>').join('') + '</div>'; return; }
      const o0 = kbBase[p.clef] || 4; q('#ckbt').innerHTML = '🎹 Piano for <b>' + esc(p.name) + '</b>: click a key to hear it' + ' <label style="margin-left:8px"><input type="checkbox" id="cpw"' + (ls.get('cmp_pw', '1') === '1' ? ' checked' : '') + '> and write it at the cursor</label> <button class="cmp-b" data-oct="-1">◀ Lower</button><button class="cmp-b" data-oct="1">Higher ▶</button>';
      const W = Math.max(500, host.clientWidth || 900), whites = []; for (let o = o0 - 1; o <= o0 + 1; o++) for (let l = 0; l < 7; l++) whites.push(o * 7 + l); whites.push((o0 + 2) * 7); const ww = W / whites.length; let h = '';
      whites.forEach((s, i) => { h += '<div class="cmp-wk' + (mod(s, 7) === 0 ? ' cmp-c' : '') + '" data-s="' + s + '" data-a="0" style="left:' + (i * ww) + 'px;width:' + (ww + 1) + 'px">' + LET[mod(s, 7)] + (mod(s, 7) === 0 ? Math.floor(s / 7) : '') + '</div>'; if ([0, 1, 3, 4, 5].includes(mod(s, 7)) && i < whites.length - 1) h += '<div class="cmp-bk" data-s="' + s + '" data-a="1" style="left:' + ((i + 1) * ww - ww * .3) + 'px;width:' + (ww * .6) + 'px"></div>'; });
      host.innerHTML = '<div class="cmp-piano">' + h + '</div>';
    }
    /* ---------- build the page ---------- */
    root.innerHTML = '<div class="cmp-head"><h2>🎼 Composer</h2><input id="cname" class="cmp-name" type="text" maxlength="40" title="Score name (type to rename)"><span id="csaved" class="cmp-saved"></span><span class="sp" style="flex:1"></span>' +
      '<button class="pri cmp-big" id="cplay" title="Play from the start (Space plays from the cursor)">▶ Play</button><button class="cmp-b" id="cplayhere" title="Play from the bar the cursor is in">▶ From cursor</button>' +
      '<label class="small mute">Tempo <input id="cbpm" type="range" min="40" max="220" style="width:100px;vertical-align:middle"> <b id="cbpmv"></b></label></div>' +
      '<div class="cmp-head" style="margin-top:-4px"><label class="small mute">My scores <select id="cpick"></select></label><button class="cmp-b" id="cnew">＋ New score</button><button class="cmp-b" id="cdup">⧉ Duplicate</button><button class="cmp-b" id="cdel">🗑 Delete</button><span class="cmp-sep"></span><button class="cmp-b" id="cwav">⬇ WAV audio</button><button class="cmp-b" id="cmid">⬇ MIDI file</button>' +
      '<span class="cmp-sep"></span><label class="small mute">Key <select id="ckey" style="max-width:250px"></select></label><label class="small mute">Time <select id="cts">' + ['2/4', '3/4', '4/4', '5/4', '6/8', '9/8', '12/8'].map(x => '<option>' + x + '</option>').join('') + '</select></label></div>' +
      '<div class="cmp-bar" id="ctools"></div><div class="cmp-status" id="cstatus"></div><div class="cmp-pager" id="cpager"></div><div class="cmp-paper" id="cpaper"></div>' +
      '<details class="cmp-keys"><summary style="cursor:pointer">⌨ Keyboard shortcuts</summary><div style="margin-top:6px;line-height:1.9"><kbd>A</kbd>–<kbd>G</kbd> write a note · <kbd>Shift</kbd>+<kbd>A</kbd>–<kbd>G</kbd> add to the chord · <kbd>1</kbd>16th <kbd>2</kbd>eighth <kbd>3</kbd>quarter <kbd>4</kbd>half <kbd>5</kbd>whole · <kbd>.</kbd> dot · <kbd>0</kbd> rest · <kbd>T</kbd> tie · <kbd>#</kbd> sharp <kbd>-</kbd> flat <kbd>=</kbd> natural · <kbd>↑</kbd><kbd>↓</kbd> move a note (with <kbd>Ctrl</kbd>: an octave) · <kbd>←</kbd><kbd>→</kbd> move the cursor (with <kbd>Shift</kbd>: select) · <kbd>Delete</kbd> make a rest · <kbd>Ctrl</kbd>+<kbd>Z</kbd>/<kbd>Y</kbd> undo/redo · <kbd>Ctrl</kbd>+<kbd>C</kbd>/<kbd>V</kbd> copy/paste · <kbd>Space</kbd> play/stop · <kbd>N</kbd> write/select mode. Right-click a note to delete it.</div></details>' +
      '<div class="cmp-card" style="margin-bottom:10px"><h3>🤖 Ask the AI to write the song</h3>' +
      '<div class="small mute">Describe it in plain words: the mood, the instruments, how long. The AI writes the melody, chords, bass and drums straight onto the score, and sets the tempo and key. Then press Play, and change anything you like.</div>' +
      '<textarea id="aitext" rows="2" style="width:100%;margin-top:6px" placeholder="e.g. A slow, sad piano piece in A minor with a cello underneath, 8 bars"></textarea>' +
      '<div class="cmp-hrow"><label>Model</label><select id="aimodel"></select><button class="pri" id="aigo">✨ Write the song</button><button class="cmp-b" id="aistop" style="display:none">■ Stop</button><span class="small mute" id="aistat"></span></div>' +
      '<div class="cmp-hrow" style="margin-top:2px"><label>📥 Or import a file</label><input type="file" id="aifile" accept=".mid,.midi,.kar,.txt,.wav,.mp3,.ogg,.m4a,.flac,.webm,.aac,.opus,audio/*"><button class="cmp-b" id="aiimp">Put it on the score</button><span class="small mute" id="aiistat"></span></div>' +
      '<div class="small mute">Try “a happy pop song with piano and drums”, “a waltz for a string quartet”, “a dark synth piece for a horror game”. A <b>MIDI</b> file brings every part with its own instrument, tempo and key; a <b>.txt</b> of notes like “C4q D4q E4h” becomes a melody; an <b>audio</b> file is followed for its tune (one note at a time, first 30 seconds). Undo takes it back in one step.</div></div>' +
      '<div class="cmp-cols"><div class="cmp-card"><h3>🎻 Instruments (one staff each)</h3><div id="cparts"></div><div class="cmp-hrow"><select id="cadd"></select></div></div>' +
      '<div class="cmp-card"><h3>✨ Easy helpers: no music knowledge needed</h3>' +
      '<div class="cmp-hrow"><label>Chords</label><select id="hprog">' + PROG.map(p => '<option value="' + p[1] + '">' + p[0] + ' (' + p[1] + ')</option>').join('') + '<option value="custom">My own…</option></select><input id="hcustom" type="text" placeholder="e.g. I vi ii V" style="width:110px;display:none"><span id="hnames" class="small mute"></span></div>' +
      '<div class="cmp-hrow"><label>as</label><select id="hstyle">' + STYLES.map(s => '<option value="' + s[0] + '">' + s[1] + '</option>').join('') + '</select><label>on</label><select id="hpart"></select><label>from bar</label><input id="hfrom" type="number" min="1" value="1" style="width:56px"><label>times</label><input id="htimes" type="number" min="1" max="16" value="2" style="width:50px"><button class="pri" id="hgo">Fill in chords</button></div>' +
      '<div class="cmp-hrow"><label>🎲 Melody idea on</label><select id="hmpart"></select><button class="cmp-b" id="hmel">Write a melody over those chords</button></div>' +
      '<div class="cmp-hrow"><label>🥁 Drum beat</label><select id="hbeat">' + Object.keys(BEATS).map(b => '<option>' + b + '</option>').join('') + '</select><label>on</label><select id="hbpart"></select><label>bars</label><input id="hbars" type="number" min="1" max="64" value="8" style="width:56px"><button class="cmp-b" id="hbgo">Add the beat</button><button class="cmp-b" id="hbadd" title="Adds a Drum kit part">＋ Drum part</button></div>' +
      '<div class="small mute">Helpers write from the bar you choose and replace what was there. Undo takes them back.</div></div></div>' +
      '<div class="cmp-kb"><div class="cmp-kbrow" id="ckbt"></div><div id="ckeys"></div></div>';
    /* ---------- events ---------- */
    q('#ctools').onclick = e => { const b = e.target.closest('[data-a]'); if (b) act(b.dataset.a); };
    q('#cplay').onclick = () => playing ? stop() : play(0);
    q('#cplayhere').onclick = () => play(Math.floor(cur.t / ML()) * ML());
    q('#cbpm').oninput = e => { S.bpm = +e.target.value; q('#cbpmv').textContent = S.bpm + ' bpm'; }; q('#cbpm').onchange = () => { touch(); panels(); };
    q('#cname').oninput = e => { S.name = e.target.value || 'Untitled'; clearTimeout(saveT); saveT = setTimeout(() => { storeScore(S); const o = q('#cpick option[value="' + S.id + '"]'); if (o) o.textContent = S.name; q('#csaved').textContent = 'Saved ✓'; }, 400); };
    q('#cpick').onchange = e => { const s = loadScore(e.target.value); if (s) open(s); };
    q('#cnew').onclick = () => templates();
    q('#cdup').onclick = () => { const s = JSON.parse(JSON.stringify(S)); s.id = uid(); s.name = S.name + ' (copy)'; open(s); A.toast('Made a copy: ' + s.name); };
    q('#cdel').onclick = () => { if (!confirm('Delete the score "' + S.name + '"? This cannot be undone.')) return; ls.set('cmp_index', JSON.stringify(idx().filter(x => x.id !== S.id))); try { localStorage.removeItem('oa_cmp_s_' + S.id); } catch (e) { }const nx = idx()[0], s = nx && loadScore(nx.id); if (s) open(s); else templates(true); };
    q('#ckey').onchange = e => edit(() => { S.key = +e.target.value; panels(); });
    q('#cts').onchange = e => { const [a, b] = e.target.value.split('/').map(Number); edit(() => { S.ts = [a, b]; S.parts.forEach(p => reflow(p, ML())); }); cur.t = 0; };
    q('#cwav').onclick = async () => { if (!flatNotes(S).length) return A.toast('Nothing to export yet.'); A.toast('Making the WAV file…'); dl(wavBlob(await renderScore(S)), '.wav'); };
    q('#cmid').onclick = () => { if (!flatNotes(S).length) return A.toast('Nothing to export yet.'); dl(new Blob([midiBytes(S)], { type: 'audio/midi' }), '.mid'); };
    const dl = (blob, ext) => { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = (S.name || 'score').replace(/[^\w\- ]/g, '').trim() + ext; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 5000); A.toast('Saved ' + a.download + ' to your Downloads folder.'); };
    q('#cparts').oninput = e => { const r = e.target.closest('[data-p]'); if (!r) return; const p = S.parts[+r.dataset.p], f = e.target.dataset.f; if (f === 'vol') { p.vol = +e.target.value; setPartGains(); clearTimeout(saveT); saveT = setTimeout(() => storeScore(S), 400); } else if (f === 'name') { p.name = e.target.value; clearTimeout(saveT); saveT = setTimeout(() => { storeScore(S); draw(); }, 500); } };
    q('#cparts').onchange = e => { const r = e.target.closest('[data-p]'); if (!r) return; const i = +r.dataset.p, f = e.target.dataset.f; if (f === 'inst') { edit(() => { const p = S.parts[i], I = INST[e.target.value]; const wasDrum = isDrum(p); p.inst = I.id; if (I.drum || wasDrum || !p.ev.length) p.clef = I.clef; }); cur.p = i; panels(); previewNotes(S.parts[i], [{ s: isDrum(S.parts[i]) ? 35 : baseOf(S.parts[i]) + 5, a: 0 }], .8); } else if (f === 'clef') { edit(() => { S.parts[i].clef = e.target.value; }); panels(); } };
    q('#cparts').onclick = e => { const b = e.target.closest('[data-pa]'), r = e.target.closest('[data-p]'); if (!r) return; const i = +r.dataset.p; if (!b) { if (cur.p !== i) { cur.p = i; sel = null; lastT = -1; keyboard(); draw(); } return; } const a = b.dataset.pa, p = S.parts[i];
      if (a === 'mute') { p.mute = p.mute ? 0 : 1; setPartGains(); storeScore(S); panels(); }
      else if (a === 'hear') { const pr = isDrum(p) ? [[31], [39], [35], [39]] : [[0], [2], [4], [7]].map(([d]) => [baseOf(p) + 5 + d]); pr.forEach((x, k) => setTimeout(() => previewNotes(p, [{ s: x[0], a: isDrum(p) ? 0 : keyAlt(S.key, mod(x[0], 7)) }], .35), k * 260)); }
      else if (a === 'upp' && i > 0) { edit(() => { const t = S.parts[i - 1]; S.parts[i - 1] = p; S.parts[i] = t; }); cur.p = i - 1; panels(); }
      else if (a === 'rm') { if (S.parts.length < 2) return A.toast('A score needs at least one instrument.'); if (p.ev.length && !confirm('Remove ' + p.name + ' and its notes?')) return; edit(() => S.parts.splice(i, 1)); cur.p = Math.min(cur.p, S.parts.length - 1); panels(); } };
    q('#cadd').onchange = e => { const id = e.target.value; if (!id) return; edit(() => S.parts.push(mkPart(INST[id].name, id))); cur.p = S.parts.length - 1; panels(); };
    q('#hprog').onchange = e => { q('#hcustom').style.display = e.target.value === 'custom' ? '' : 'none'; panels(); }; q('#hcustom').oninput = () => panels();
    const progNow = () => parseProg(q('#hprog').value === 'custom' ? q('#hcustom').value : q('#hprog').value);
    q('#hgo').onclick = () => { const pr = progNow(), pi = +q('#hpart').value; if (!pr.length || isNaN(pi)) return A.toast('Pick chords and an instrument first.'); edit(() => applyProg(S, pi, pr, q('#hstyle').value, Math.max(0, (+q('#hfrom').value || 1) - 1), clamp(+q('#htimes').value || 1, 1, 16))); A.toast('Chords written: ' + pr.map(d => chordName(S, d)).join(' – ')); };
    q('#hmel').onclick = () => { const pr = progNow(), pi = +q('#hmpart').value, times = clamp(+q('#htimes').value || 1, 1, 16); if (!pr.length || isNaN(pi)) return; let all = []; for (let k = 0; k < times; k++) all = all.concat(pr); edit(() => melodyIdea(S, pi, all, Math.max(0, (+q('#hfrom').value || 1) - 1))); A.toast('A new melody idea. Press it again for another, or Undo.'); };
    q('#hbgo').onclick = () => { const pi = +q('#hbpart').value; if (isNaN(pi) || q('#hbpart').value === '') return A.toast('Add a drum part first (＋ Drum part).'); edit(() => applyBeat(S, pi, q('#hbeat').value, Math.max(0, (+q('#hfrom').value || 1) - 1), clamp(+q('#hbars').value || 4, 1, 64))); };
    q('#hbadd').onclick = () => { edit(() => S.parts.push(mkPart('Drums', 'drums'))); panels(); };
    /* ---------- the AI writes the song onto the score ---------- */
    (async () => { const sel = q('#aimodel'); try { const ms = ((await (await fetch('/api/models')).json()).models || []).filter(m => !/embed/i.test(m.name)); const top = A.ai.model(), saved = ls.get('cmp_ai_model', ''); const pick = ms.some(m => m.name === saved) ? saved : top; sel.innerHTML = ms.map(m => '<option value="' + esc(m.name) + '"' + (m.name === pick ? ' selected' : '') + '>' + esc(m.label || m.name) + (m.cloud ? ' (online)' : ' (on this PC)') + '</option>').join(''); } catch (e) { sel.innerHTML = '<option value="">Top bar model</option>'; } sel.onchange = () => ls.set('cmp_ai_model', sel.value); })();
    function aiSystem() {
      return 'You write music for a score editor. Reply with ONLY these lines, nothing else:\n' +
        'NAME: <a short title>\nTEMPO: <40 to 220>\nKEY: <a whole number from -7 to 7: 0 is C major or A minor, 1 is one sharp, -1 is one flat>\nTIME: <4/4, 3/4, 2/4, 6/8, 9/8 or 12/8>\n' +
        'PART: <name> | <instrument> | <one of the ways below>\n' +
        'Write 2 to 4 PART lines. The third field is exactly one of these:\n' +
        '  notes: C4q D4q E4h  - the tune. A letter A to G, an optional # or b, an octave 2 to 7, then a length: w whole, h half, q quarter, e eighth, s sixteenth, with an optional . for dotted. r instead of a letter is a rest.\n' +
        '  chords: I V vi IV   - held chords, one per bar.\n  strum: I V vi IV    - a chord on every beat.\n  broken: I V vi IV   - one note at a time.\n  bass: I V vi IV     - a low bass line.\n  waltz: I V vi IV    - oom-pah-pah, only in 3/4.\n' +
        '  beat: Rock          - a drum beat, one of: ' + Object.keys(BEATS).join(', ') + '. Only on the drums instrument.\n' +
        'Instruments: ' + Object.keys(INST).join(', ') + '.\n' +
        'Write a real tune that fits the bar lines: mostly stepwise, in the key you chose, ending on the tonic. Keep a notes part under 40 tokens. No explanation, no markdown, no code fences.';
    }
    function aiInstrument(inst) {
      const id = String(inst || '').toLowerCase().replace(/[^a-z0-9]/g, ''); if (INST[id]) return id;
      const norm = i => i.name.toLowerCase().replace(/[^a-z0-9]/g, '');
      const hit = Object.values(INST).find(i => norm(i) === id) || Object.values(INST).find(i => id && (norm(i).includes(id) || id.includes(norm(i))));
      return hit ? hit.id : 'piano';
    }
    /* put what the AI wrote onto the score, in one undo step */
    function applySong(song) {
      if (!song.parts.length) throw new Error('The AI did not reply in the format this page reads. Try again, or pick a bigger model.');
      const bars = 8, built = song.parts.slice(0, 6).map(x => ({ name: x.name || 'Part', inst: aiInstrument(x.inst), kind: x.kind, value: x.value }));
      edit(() => {
        if (song.name) S.name = song.name;
        if (song.bpm) S.bpm = song.bpm;
        if (song.key != null) S.key = song.key;
        if (song.ts) S.ts = song.ts;
        S.bars = bars;
        S.parts = built.map(b => { const p = mkPart(b.name, b.inst); if (b.kind === 'bass' || b.kind === 'waltz') p.clef = 'bass'; return p; });
        built.forEach((b, i) => {
          const kind = isDrum(S.parts[i]) ? 'beat' : b.kind;
          if (kind === 'notes') parseTune(S, i, b.value);
          else if (kind === 'beat') { const nm = Object.keys(BEATS).find(k => k.toLowerCase() === String(b.value).toLowerCase()) || 'Rock'; applyBeat(S, i, nm, 0, bars); }
          else { const pr = parseProg(b.value); if (!pr.length) return; const st = kind === 'chords' ? 'block' : kind === 'strum' ? 'strum' : kind === 'broken' ? 'broken' : kind === 'bass' ? 'bass' : 'waltz'; applyProg(S, i, pr, st, 0, Math.max(1, Math.ceil(bars / pr.length))); }
        });
      });
      cur = { p: 0, t: 0 }; lastT = -1; sel = null; panels(); draw();
    }
    let aiCtl = null;
    q('#aigo').onclick = async () => {
      const want = q('#aitext').value.trim(); if (!want) return A.toast('Say what kind of song you want first.');
      if (aiCtl) return;
      const model = q('#aimodel').value || A.ai.model(); if (!model) return A.toast('No AI model is chosen: pick one in the Model list.');
      const stat = q('#aistat'), t0 = Date.now(); aiCtl = new AbortController(); q('#aigo').disabled = true; q('#aistop').style.display = ''; stat.textContent = 'Asking the AI…';
      let out = '', err = '';
      try {
        const r = await fetch('/api/chat', { method: 'POST', signal: aiCtl.signal, body: JSON.stringify({ model, stream: true, think: false, keep_alive: '5m', options: Object.assign({ temperature: .7, num_predict: 1400 }, A.ai.isCloud(model) ? {} : { num_ctx: 8192 }), messages: [{ role: 'system', content: aiSystem() }, { role: 'user', content: want }] }) });
        if (!r.ok) throw new Error('The AI engine answered with error ' + r.status + '.');
        const rd = r.body.getReader(), dec = new TextDecoder(); let buf = '';
        for (;;) { const { value, done } = await rd.read(); if (done) break; buf += dec.decode(value, { stream: true }); let i; while ((i = buf.indexOf('\n')) >= 0) { const ln = buf.slice(0, i).trim(); buf = buf.slice(i + 1); if (!ln) continue; try { const j = JSON.parse(ln); if (j.error) err = String(j.error.message || j.error); if (j.message && j.message.content) { out += j.message.content; stat.textContent = 'Writing… ' + Math.round((Date.now() - t0) / 1000) + ' s'; } } catch (e) { } } }
        if (err) throw new Error(err);
        if (!out.trim()) throw new Error('The AI sent back nothing. Check the model is installed, or try another one.');
        const song = parseSong(out); applySong(song);
        stat.textContent = '✓ Done in ' + Math.round((Date.now() - t0) / 1000) + ' s · ' + song.parts.length + ' part' + (song.parts.length === 1 ? '' : 's') + ' · press Play';
      } catch (e) { stat.textContent = e.name === 'AbortError' ? 'Stopped. Nothing was changed.' : 'That did not work: ' + e.message; }
      finally { aiCtl = null; q('#aigo').disabled = false; q('#aistop').style.display = 'none'; }
    };
    q('#aistop').onclick = () => { try { aiCtl && aiCtl.abort(); } catch (e) { } };
    q('#aitext').onkeydown = e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); q('#aigo').click(); } };
    /* ---------- importing a music file onto the score ---------- */
    /* every import becomes a new score of its own, so the score you were working on is never overwritten */
    function newFrom(title) { const sc = blankScore(title || 'Imported song', []); sc.parts = []; return sc; }
    const finish = sc => { if (!sc.parts.length) sc.parts.push(mkPart('Melody', 'piano')); sc.bars = Math.max(4, Math.ceil(Math.max(0, ...sc.parts.map(endOf)) / mlen(sc)) + 1); open(sc); return sc.parts.length; };
    function importMidi(buf, title) { return finish(scoreFromMidi(buf, title)); }
    async function importAudio(file, title, st) {
      /* with basic-pitch installed (install-song-tools.ps1) the server finds every note, chords included; otherwise one melody line is followed here */
      let mc = null; try { mc = await (await fetch('/api/convert/status')).json(); } catch (e) { }
      if (mc && mc.midi) {
        if (st) st.textContent = 'Finding the notes with basic-pitch (about a minute per few minutes of song)…';
        const j = await (await fetch('/api/convert/media?name=' + encodeURIComponent(file.name) + '&to=mid', { method: 'POST', body: file })).json();
        if (!j.error) { const r = await fetch('/api/convert/file?path=' + encodeURIComponent(j.path)); const sc = scoreFromMidi(await r.arrayBuffer(), title); /* one busy part becomes a piano score: notes from middle C up on the top staff, lower notes on the bottom staff */
          const ML2 = mlen(sc), src = sc.parts[0], hi = mkPart('High notes (from audio)', 'piano', 'treble'), lo = mkPart('Low notes (from audio)', 'piano', 'bass');
          if (src) timed(src).forEach(x => { if (x.e.r) return; const L2 = len(x.e), up = x.e.n.filter(nn => midiOf(nn) >= 60), dn = x.e.n.filter(nn => midiOf(nn) < 60); if (up.length) place(hi, x.t, { n: up, tie: x.e.tie }, L2, ML2); if (dn.length) place(lo, x.t, { n: dn, tie: x.e.tie }, L2, ML2); });
          sc.parts = [hi, lo].filter(p => p.ev.length); return finish(sc); }
        if (st) st.textContent = 'basic-pitch failed (' + j.error + '), following the melody instead…';
      }
      const AC = window.AudioContext || window.webkitAudioContext, ac2 = new AC();
      let buf; try { buf = await ac2.decodeAudioData(await file.arrayBuffer()); } catch (e) { throw new Error('This audio file could not be opened. Try WAV or MP3.'); } finally { try { ac2.close(); } catch (e) { } }
      const secs = Math.min(buf.duration, 240);
      /* keep the middle band where tunes live, so bass and cymbals do not hide the melody */
      let src = buf; try { const oc = new OfflineAudioContext(1, Math.ceil(buf.sampleRate * secs), buf.sampleRate), bs = oc.createBufferSource(); bs.buffer = buf; const hp = oc.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 140; const lp = oc.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1800; bs.connect(hp); hp.connect(lp); lp.connect(oc.destination); bs.start(); src = await oc.startRendering(); } catch (e) { }
      const found = await transcribe(src, secs, p => { if (st) st.textContent = 'Listening for the tune… ' + Math.round(p * 100) + '%'; });
      if (!found.length) throw new Error('No tune could be followed in that audio. One instrument or a voice works best; drums and full band mixes do not.');
      /* tempo: the most common gap between note starts is taken as one beat */
      const gaps = []; for (let i = 1; i < found.length; i++) { const g = found[i].t - found[i - 1].t; if (g > .12 && g < 2) gaps.push(g); }
      gaps.sort((x, y) => x - y); let beat = gaps.length ? gaps[gaps.length >> 1] : .6; while (60 / beat > 160) beat *= 2; while (60 / beat < 60) beat /= 2;
      const bpm = clamp(Math.round(60 / beat), 50, 180), spu = 60 / bpm / 8, t0 = found[0].t;
      const sc = newFrom(title); sc.bpm = bpm;
      const p = mkPart('Melody (from audio)', 'piano'); p.clef = found.reduce((x, y) => x + y.m, 0) / found.length < 57 ? 'bass' : 'treble'; sc.parts.push(p);
      const q16 = sec => Math.max(0, Math.round((sec - t0) / spu / 2) * 2);
      const notes = found.map(nd => ({ t: q16(nd.t), end: Math.max(q16(nd.t) + 2, q16(nd.t + nd.dur)), m: nd.m }));
      notes.forEach((e, i) => { const nx = notes[i + 1]; let end = e.end; if (nx) { if (nx.t <= e.t) return; if (nx.t - end <= 2) end = nx.t; end = Math.min(end, nx.t); } const L2 = end - e.t; if (L2 >= 2) place(p, e.t, { n: [midiNote(e.m)] }, L2, mlen(sc)); });
      return finish(sc);
    }
    function importText(txt, title) {
      const song = parseSong(txt);
      if (song.parts.length) { if (title && !song.name) song.name = title; applySong(song); return song.parts.length; }
      const sc = newFrom(title); sc.parts.push(mkPart('Imported', 'piano')); parseTune(sc, 0, txt);
      if (!endOf(sc.parts[0])) throw new Error('No notes were found in that text. Write notes like C4q D4q E4h.');
      return finish(sc);
    }
    q('#aiimp').onclick = async () => {
      const box = q('#aifile'), f = box && box.files ? box.files[0] : null;
      if (!f) return A.toast('Choose a file first.');
      const st = q('#aiistat'), ext = (f.name.split('.').pop() || '').toLowerCase(), btn = q('#aiimp');
      st.textContent = 'Reading ' + f.name + '…'; btn.disabled = true;
      try {
        const title = f.name.replace(/\.[^.]+$/, '').slice(0, 40) || 'Imported song';
        let n;
        if (ext === 'mid' || ext === 'midi' || ext === 'kar') n = importMidi(await f.arrayBuffer(), title);
        else if (['wav', 'mp3', 'ogg', 'm4a', 'flac', 'webm', 'aac', 'opus'].includes(ext) || /^audio\//.test(f.type)) n = await importAudio(f, title, st);
        else n = importText(await f.text(), title);
        st.textContent = '✓ New score "' + S.name + '": ' + n + ' part' + (n === 1 ? '' : 's') + ', ' + L.pages + ' page' + (L.pages === 1 ? '' : 's') + ' from ' + f.name;
        A.toast('Put ' + f.name + ' on a new score. Press Play.');
      } catch (e) { st.textContent = 'Could not read it: ' + (e.message || e); }
      finally { btn.disabled = false; box.value = ''; }
    };
    q('#ckbt').onclick = e => { const b = e.target.closest('[data-oct]'); if (!b) return; const c = part().clef; kbBase[c] = clamp((kbBase[c] || 4) + +b.dataset.oct, 1, 7); keyboard(); };
    q('#ckbt').onchange = e => { if (e.target.id === 'cpw') ls.set('cmp_pw', e.target.checked ? '1' : '0'); };
    q('#ckeys').onmousedown = e => { const pad = e.target.closest('[data-pad]'); if (pad) { e.preventDefault(); const p = part(), n = { s: +pad.dataset.pad, a: 0 }; if (mode !== 'write') return previewNotes(p, [n]); if ((e.shiftKey || chordMode) && lastT >= 0 && addToChord(lastT, n)) return; return writeNotes([n], true); }
      const k = e.target.closest('[data-s]'); if (!k) return; e.preventDefault(); const s = +k.dataset.s, black = k.dataset.a === '1', l = mod(s, 7); let n; if (!black) n = { s, a: 0 }; else if (S.key < 0) n = { s: s + 1, a: -1 }; else n = { s, a: 1 }; k.classList.add('cmp-hit'); setTimeout(() => k.classList.remove('cmp-hit'), 180); void l; pianoNote(n, e.shiftKey); };
    q('#cpager').onclick = e => { const b = e.target.closest('[data-pg]'); if (!b || b.disabled) return; const a = b.dataset.pg;
      if (a === 'first') turnPage(0); else if (a === 'last') turnPage(L.pages - 1); else if (a === '-1' || a === '1') turnPage(page + +a);
      else if (a === 'add8' || a === 'add32') { setBars(L.meas.length + (a === 'add8' ? 8 : 32)); turnPage(L.pages - 1); }
      else if (a === 'trim') setBars(1); };
    q('#cpager').onchange = e => { if (e.target.id === 'cbars') setBars(+e.target.value); };
    const paper = q('#cpaper');
    paper.onclick = e => { const h = hit(e); if (!h) return; root.focus?.(); if (h.pi !== cur.p) { cur.p = h.pi; keyboard(); }
      if (mode === 'select') { const t = h.cover ? h.cover.t : h.t; if (e.shiftKey && sel && sel.p === h.pi) sel.b = t + (h.cover ? len(h.cover.e) : 0); else if (e.shiftKey) sel = { p: h.pi, a: cur.t, b: t + (h.cover ? len(h.cover.e) : 0) }; else sel = null; cur.t = t; lastT = -1; if (h.cover && !h.cover.e.r) previewNotes(h.p, h.cover.e.n, .3); return draw(); }
      const p = h.p, x = evAt(p, h.t), n = { s: h.s, a: isDrum(p) ? 0 : keyAlt(S.key, mod(h.s, 7)) }; cur.t = h.t; sel = null;
      if (restMode) { edit(() => place(p, h.t, { r: 1 }, inLen(), ML())); lastT = -1; return draw(); }
      if (x && !x.e.r && (e.shiftKey || chordMode)) { lastT = h.t; addToChord(h.t, n); return; }
      if (x && !x.e.r && x.e.n.some(m => m.s === h.s)) { lastT = h.t; previewNotes(p, x.e.n, .3); return draw(); }
      edit(() => place(p, h.t, { n: [n] }, inLen(), ML())); lastT = h.t; previewNotes(p, [n]); draw(); };
    paper.oncontextmenu = e => { const h = hit(e); if (!h || !h.cover || h.cover.e.r) return; e.preventDefault(); cur.p = h.pi; cur.t = h.cover.t; lastT = -1; sel = null; del(); };
    paper.onmousemove = e => { const g = q('#cghost'); if (!g) return; const h = mode === 'write' && !restMode ? hit(e) : null; if (!h) { g.setAttribute('visibility', 'hidden'); return; } const X = evX(h.me, h.t - h.me.m * ML()), Y = h.top + 40 - (h.s - baseOf(h.p)) * 5; const el = g.firstChild, tx = g.lastChild; el.setAttribute('cx', X); el.setAttribute('cy', Y); el.setAttribute('transform', 'rotate(-20 ' + X + ' ' + Y + ')'); tx.setAttribute('x', X + 10); tx.setAttribute('y', Y - 8); tx.textContent = isDrum(h.p) ? (PADS.find(d => d[0] === h.s) || [0, drumKind(h.s)])[1] : nameOf({ s: h.s, a: keyAlt(S.key, mod(h.s, 7)) }); g.setAttribute('visibility', 'visible'); hoverH = h; };
    paper.onmouseleave = () => { const g = q('#cghost'); if (g) g.setAttribute('visibility', 'hidden'); hoverH = null; };
    /* keys: a capture listener on window runs before the app's own shortcut listener (keyboard.js), so A-G, numbers and arrows reach the score */
    const onKey = e => {
      if (!root.isConnected || !root.offsetParent || !S || q('.cmp-ov')) return; const tg = e.target; if (tg && tg.closest && tg.closest('input,textarea,select,[contenteditable="true"],[contenteditable=""]')) return;
      const k = e.key, kl = (k || '').toLowerCase(), ctrl = e.ctrlKey || e.metaKey; let done = true;
      if (ctrl && kl === 'z') e.shiftKey ? doRedo() : doUndo(); else if (ctrl && kl === 'y') doRedo(); else if (ctrl && kl === 'c') copy(); else if (ctrl && kl === 'v') paste();
      else if (ctrl && kl === 'a') { sel = { p: cur.p, a: 0, b: endOf(part()) }; draw(); }
      else if (ctrl && (k === 'ArrowUp' || k === 'ArrowDown')) shiftPitch(k === 'ArrowUp' ? 1 : -1, true);
      else if (ctrl || e.altKey) done = false;
      else if (/^[a-g]$/i.test(k)) letter(k.toUpperCase(), e.shiftKey);
      else if (/^[1-5]$/.test(k)) setDur([2, 4, 8, 16, 32][+k - 1]);
      else if (k === '0') writeRest(); else if (k === '.') toggleDot(); else if (kl === 't') toggleTie();
      else if (k === '#' || k === '+') accid(1); else if (k === '-' || k === '_') accid(-1); else if (k === '=') accid('nat');
      else if (k === 'ArrowLeft' || k === 'ArrowRight') move(k === 'ArrowLeft' ? -1 : 1, e.shiftKey);
      else if (k === 'ArrowUp' || k === 'ArrowDown') shiftPitch(k === 'ArrowUp' ? 1 : -1);
      else if (k === 'Delete' || k === 'Backspace') del();
      else if (k === ' ') playing ? stop() : play(Math.floor(cur.t / ML()) * ML());
      else if (kl === 'n') act(mode === 'write' ? 'select' : 'write');
      else if (k === 'Escape' && (sel || playing)) { sel = null; stop(); draw(); }
      else if (k === 'Home') { cur.t = 0; sel = null; draw(); }
      else if (k === 'PageDown' || k === 'PageUp') turnPage(page + (k === 'PageDown' ? 1 : -1));
      else done = false;
      if (done) { e.preventDefault(); e.stopPropagation(); }
    };
    window.addEventListener('keydown', onKey, true);
    let rz = 0; const ro = new ResizeObserver(() => { clearTimeout(rz); rz = setTimeout(() => { if (S && root.offsetParent) { draw(); keyboard(); } }, 120); }); ro.observe(paper);
    /* ---------- templates ---------- */
    function templates(force) {
      const ov = document.createElement('div'); ov.className = 'cmp-ov'; ov.innerHTML = '<div class="cmp-ovin"><div class="row" style="display:flex;align-items:center;gap:8px"><h2 style="margin:0">Start a new score</h2><span style="flex:1"></span>' + (force ? '' : '<button class="cmp-b" data-x>✕ Close</button>') + '</div><div class="small mute">Pick a starting point. Every choice can be changed later: add or remove instruments, change the key, tempo and time.</div><div class="cmp-tpls">' + TPL.map(t => '<button class="cmp-tpl" data-t="' + t[0] + '"><div class="cmp-ti">' + t[1] + '</div><b>' + esc(t[2]) + '</b><span>' + esc(t[3]) + '</span></button>').join('') + '</div></div>';
      root.appendChild(ov); root.scrollTop = 0;
      ov.onclick = e => { if (e.target.closest('[data-x]') || e.target === ov && !force) return ov.remove(); const b = e.target.closest('[data-t]'); if (!b) return; const t = TPL.find(x => x[0] === b.dataset.t); ov.remove(); open(t[4]()); A.toast('New score: ' + S.name + '. Click the staff to add notes, or press Play.'); };
    }
    /* ---------- start ---------- */
    bar(); let s = loadScore(ls.get('cmp_cur', '')); if (!s) { const f = idx()[0]; s = f && loadScore(f.id); }
    if (!s) { s = TPL[0][4](); }
    q('#csaved').textContent = 'Saved ✓'; setTimeout(() => open(s), 0);
  }
  A.composer = { INST, voice, flatNotes, midiBytes, place, TPL, scoreFromMidi, render: renderScore, wavBlob, parseSong, readMidi, midiToEvents, transcribe, midiNote };       // for checks and other tools
  A.studio.reg('composer', '🎼 Composer', body => mount(body));
})();

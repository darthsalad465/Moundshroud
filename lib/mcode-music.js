// Eighteen little loops, one for every picture the terminal can show: each theme has a calm one and a stormy one,
// made from the same idea the scene is made of. Nothing is downloaded. The notes are written here into a mono wav
// and played by the machine itself, so the music works offline and sounds the same every time.
//
// Every loop is eight bars of four beats, and the notes are added into a ring, so the last bar falls back into the
// first without a seam. Storms sit low and slow: a heartbeat under the bass, a tension note against the chord, and
// surf rolling through it. Calm sits higher and breathes: soft pads, a bell walking the chord, shakers like leaves.
const fs = require('fs'), path = require('path');

const RATE = 16000;
const TAU = Math.PI * 2;

const KEYS = {
  /* the aurora: cold air over ice. Wide stacked fifths, glass bells, a very slow arpeggio, and wind moving through. */
  aurora: {
    wet: { root: 146.83, style: 'glacial', prog: [[0, 3, 7, 14], [-2, 3, 7, 10], [-4, 0, 5, 12], [-5, -1, 4, 11]], bpm: 52, lead: 'bell', surf: 0.9, storm: 1 },
    dry: { root: 174.61, style: 'glacial', prog: [[0, 4, 7, 11], [-3, 2, 7, 9], [-5, 0, 4, 12], [-1, 4, 7, 11]], bpm: 64, lead: 'glass', surf: 0.2, storm: 0 },
  },
  /* the ember: a fire going out. Piano over a low drone, crackle under it, and a figure that keeps rising. */
  ember: {
    wet: { root: 110.00, style: 'fire', prog: [[0, 3, 7, 10], [0, 3, 6, 10], [-2, 3, 7, 10], [-4, 0, 3, 7]], bpm: 48, lead: 'piano', surf: 0.6, storm: 1 },
    dry: { root: 130.81, style: 'fire', prog: [[0, 4, 7, 11], [-3, 2, 5, 9], [-5, 0, 4, 7], [-1, 4, 7, 11]], bpm: 56, lead: 'piano', surf: 0.15, storm: 0 },
  },
  /* the ocean: swell and draw. A marimba rocking in threes, wide pads, and surf that never quite repeats. */
  ocean: {
    wet: { root: 98.00, style: 'tide', prog: [[0, 3, 7, 10], [-2, 2, 5, 9], [-4, 0, 3, 7], [-5, -1, 2, 7]], bpm: 46, lead: 'marimba', surf: 1.15, storm: 1 },
    dry: { root: 164.81, style: 'tide', prog: [[0, 4, 7, 11], [2, 5, 9, 12], [-3, 0, 4, 7], [-5, -1, 2, 7]], bpm: 60, lead: 'marimba', surf: 0.45, storm: 0 },
  },
  /* the forest: a wooden flute over a marimba, and birds answering it. */
  forest: {
    wet: { root: 116.54, style: 'woodland', prog: [[0, 2, 7, 9], [-3, 2, 5, 9], [-5, 0, 3, 7], [-2, 2, 7, 10]], bpm: 50, lead: 'flute', surf: 0.5, storm: 1 },
    dry: { root: 196.00, style: 'woodland', prog: [[0, 4, 7, 11], [2, 5, 9, 12], [-3, 0, 4, 7], [-1, 4, 7, 11]], bpm: 66, lead: 'flute', surf: 0.2, storm: 0 },
  },
  /* the candy: a music box on a trampoline. Glockenspiel in sixteenths, a bouncing bass, claps on two and four. */
  candy: {
    wet: { root: 155.56, style: 'toy', prog: [[0, 4, 7, 11], [2, 5, 9, 12], [-1, 4, 7, 11], [-3, 0, 4, 7]], bpm: 58, lead: 'bell', surf: 0.3, storm: 1 },
    dry: { root: 261.63, style: 'toy', prog: [[0, 4, 7, 11], [2, 6, 9, 12], [-3, 0, 4, 7], [-1, 4, 7, 11]], bpm: 84, lead: 'bell', surf: 0.1, storm: 0 },
  },
  /* the city at night: a walking bass, brushes, and a piano comping behind one lonely high note. */
  mono: {
    wet: { root: 103.83, style: 'noir', prog: [[0, 3, 7, 10], [-3, 0, 3, 7], [-5, -1, 2, 7], [-4, 0, 3, 9]], bpm: 50, lead: 'glass', surf: 0.55, storm: 1 },
    dry: { root: 155.56, style: 'noir', prog: [[0, 3, 7, 10], [-2, 2, 5, 9], [-4, 0, 3, 7], [-5, -1, 2, 7]], bpm: 58, lead: 'piano', surf: 0.25, storm: 0 },
  },
  /* the matrix: neon and rain. A sequencer at 16ths under a detuned saw pad, a kick on every beat, a snare that
     cracks on two and four, and a pulse-wave arpeggio running the chord.                                   */
  matrix: {
    wet: { root: 82.41, style: 'cyber', prog: [[0, 3, 7, 10], [-4, 0, 3, 7], [-5, -1, 2, 7], [-7, -3, 0, 5]], bpm: 100, lead: 'square', surf: 0.12, storm: 1 },
    dry: { root: 123.47, style: 'cyber', prog: [[0, 3, 7, 10], [-4, 0, 3, 7], [-2, 2, 5, 9], [-5, -1, 2, 7]], bpm: 88, lead: 'square', surf: 0.05, storm: 0 },
  },
  /* the plain: open country. A broken piano chord and a flute with room to breathe. */
  plain: {
    wet: { root: 98.00, style: 'meadow', prog: [[0, 3, 7, 10], [-2, 3, 5, 10], [-4, 0, 3, 7], [-5, -1, 2, 7]], bpm: 48, lead: 'piano', surf: 0.5, storm: 1 },
    dry: { root: 174.61, style: 'meadow', prog: [[0, 4, 7, 11], [-3, 2, 5, 9], [-5, 0, 4, 7], [-1, 4, 7, 11]], bpm: 60, lead: 'flute', surf: 0.15, storm: 0 },
  },
  /* the garden: a koto over a drone, in the hirajoshi scale — 0 2 3 7 8 — with the grace note that leans into the
     next string, and a struck temple bell at the turn of every half. Wet, a taiko keeps time under it and the scale
     sits low; dry, it is higher, slower to move and full of air.                                                  */
  garden: {
    wet: { root: 110.00, style: 'eastern', prog: [[0, 3, 7, 12], [0, 2, 7, 10], [-5, 0, 3, 7], [0, 3, 8, 12]], bpm: 50, lead: 'koto', surf: 0.35, storm: 1, taiko: 1 },
    dry: { root: 146.83, style: 'eastern', prog: [[0, 7, 12, 15], [0, 2, 7, 12], [-5, 0, 7, 12], [0, 3, 7, 12]], bpm: 54, lead: 'koto', surf: 0.1, storm: 0, taiko: 0 },
  },
};

const semis = (root, n) => root * Math.pow(2, n / 12);

/* a small, repeatable noise source: the same track sounds the same every time it is written */
function lcg(seed) {
  let s = (seed | 0) || 1;
  return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
}

/* each instrument is a handful of sines: cheap, but warm enough, and no samples to ship */
function voice(kind, f, t) {
  switch (kind) {
    case 'pad':
      return Math.sin(TAU * f * t) * 0.58 + Math.sin(TAU * f * 1.004 * t) * 0.26 + Math.sin(TAU * f * 0.5 * t) * 0.2;
    case 'bass':
      return Math.sin(TAU * f * t) * 0.9 + Math.sin(TAU * f * 2 * t) * 0.08;
    case 'bell':
      return Math.sin(TAU * f * t) * 0.7 + Math.sin(TAU * f * 2.01 * t) * 0.24 + Math.sin(TAU * f * 3.02 * t) * 0.1;
    case 'glass':
      return Math.sin(TAU * f * t) * 0.62 + Math.sin(TAU * f * 3.01 * t) * 0.22 + Math.sin(TAU * f * 5.02 * t) * 0.07;
    case 'marimba':
      return Math.sin(TAU * f * t) * 0.72 + Math.sin(TAU * f * 4 * t) * 0.18 + Math.sin(TAU * f * 7 * t) * 0.06;
    case 'koto':                                            // a string, struck: bright, then quick to fade
      return Math.sin(TAU * f * t) * 0.58 + Math.sin(TAU * f * 2.01 * t) * 0.26
        + Math.sin(TAU * f * 3.02 * t) * 0.12 + Math.sin(TAU * f * 4.06 * t) * 0.05;
    case 'shaku': {                                         // a breath through a flute: a slow wobble on the tone, and air
      const wob = Math.sin(TAU * 4.6 * t) * 0.7 + Math.sin(TAU * 1.3 * t) * 0.25;
      return Math.sin(TAU * f * t + wob) * 0.6 + Math.sin(TAU * f * 2 * t + wob * 0.6) * 0.1
        + Math.sin(TAU * f * 3 * t) * 0.04 + Math.sin(TAU * f * 5.02 * t + wob) * 0.015;
    }
    case 'saw':                                             // detuned saws, stacked: a fat analog pad or a screaming lead
      return (Math.sin(TAU * f * t) * 0.5 + Math.sin(TAU * f * 1.006 * t) * 0.35 + Math.sin(TAU * f * 0.997 * t) * 0.3
        + Math.sin(TAU * f * 2 * t) * 0.2 + Math.sin(TAU * f * 3 * t) * 0.12 + Math.sin(TAU * f * 4.02 * t) * 0.07);
    case 'square':                                          // a pulse wave: the arpeggio, thin and electric
      return ((f * t) % 1 < 0.34 ? 1 : -1) * 0.32 + Math.sin(TAU * f * 2 * t) * 0.09 + Math.sin(TAU * f * 3.01 * t) * 0.04;
    case 'gong':                                            // a temple bell: inharmonic partials that beat against each other
      return Math.sin(TAU * f * t) * 0.42 + Math.sin(TAU * f * 2.41 * t) * 0.28
        + Math.sin(TAU * f * 3.73 * t) * 0.16 + Math.sin(TAU * f * 5.12 * t) * 0.08;
    case 'flute':                                            // a wooden flute: a pure tone with a breath on it
      return Math.sin(TAU * f * t + Math.sin(TAU * 5.1 * t) * 0.16) * 0.66
        + Math.sin(TAU * f * 2 * t + Math.sin(TAU * 5.1 * t) * 0.3) * 0.07
        + Math.sin(TAU * f * 3 * t) * 0.025;
    case 'piano':                                            // a struck string: a hard hammer, then the body of it
      return Math.sin(TAU * f * t) * 0.52 + Math.sin(TAU * f * 2 * t) * 0.24
        + Math.sin(TAU * f * 3 * t) * 0.12 + Math.sin(TAU * f * 4.02 * t) * 0.07
        + Math.sin(TAU * f * 5.43 * t) * 0.04;
    case 'shamisen':                                        // a string struck with a plectrum: sharp, buzzy, quick
      return Math.sin(TAU * f * t) * 0.5 + Math.sin(TAU * f * 2 * t) * 0.3 + Math.sin(TAU * f * 3 * t) * 0.2
        + Math.sin(TAU * f * 4 * t) * 0.12 + Math.sin(TAU * f * 6.1 * t) * 0.06;
    case 'reed':
    default:
      return Math.sin(TAU * f * t) * 0.55 + Math.sin(TAU * f * 2 * t) * 0.2 + Math.sin(TAU * f * 3 * t) * 0.12
        + Math.sin(TAU * f * 4 * t + Math.sin(TAU * 5.2 * t)) * 0.07;
  }
}

function compose(name) {
  const parts = String(name || '').split('-');
  const theme = KEYS[parts[0]] ? parts[0] : 'aurora';
  const wet = parts[1] !== 'dry';
  const K = KEYS[theme][wet ? 'wet' : 'dry'];
  const beat = 60 / K.bpm, bars = 8, loop = beat * 4 * bars;
  const len = Math.round(RATE * loop);
  const buf = new Float32Array(len);
  const rnd = lcg(theme.length * 7919 + theme.charCodeAt(0) * 31 + (wet ? 17 : 5));

  const note = (at, dur, f, amp, kind, attack) => {
    const n = Math.round(dur * RATE), start = Math.round(at * RATE);
    const a = attack == null ? (kind === 'pad' ? 0.8 : kind === 'shaku' ? 0.3 : kind === 'saw' ? 0.25 : 0.01) : attack;
    const decay = kind === 'pad' ? 0.42 : kind === 'bass' ? 1.1 : kind === 'koto' ? 3.6 : kind === 'shaku' ? 1.2
      : kind === 'square' ? 8.5 : kind === 'saw' ? 1.5 : kind === 'gong' ? 0.65 : kind === 'shamisen' ? 5.5
        : kind === 'piano' ? 2.2 : kind === 'flute' ? 1.0 : 2.6;
    for (let i = 0; i < n; i++) {
      const t = i / RATE;
      const env = Math.min(1, t / a) * Math.exp(-t * decay);
      buf[(start + i) % len] += voice(kind, f, t) * env * amp;
    }
  };
  /* surf: noise rolled off twice, rising and falling like a wave breaking and drawing back */
  const wash = (at, dur, amp) => {
    const n = Math.round(dur * RATE), start = Math.round(at * RATE);
    let lp = 0, lp2 = 0;
    for (let i = 0; i < n; i++) {
      const t = i / RATE, p = t / dur;
      lp += (rnd() * 2 - 1 - lp) * 0.06;
      lp2 += (lp - lp2) * 0.08;
      const env = Math.sin(Math.PI * p) * (1 - p * 0.35);
      buf[(start + i) % len] += lp2 * env * amp * 3.2;
    }
  };
  const thump = (at, amp, f) => {
    const dur = 0.7, n = Math.round(dur * RATE), start = Math.round(at * RATE);
    for (let i = 0; i < n; i++) {
      const t = i / RATE, fr = (f || 52) * (1 - t * 0.55);
      buf[(start + i) % len] += Math.sin(TAU * fr * t) * Math.exp(-t * 6.5) * amp;
    }
  };

  /* the eastern bar: a drone of tonic and fifth, a koto ostinato in the hirajoshi scale with the maezuke flick
     into every note, a glissando up the strings into each half, one long shakuhachi line bent into its pitch, and a
     temple bell struck at the head of every half. Wet, a taiko and the rain; dry, bamboo, small bells and wind.   */
  const HIRAJOSHI = [0, 2, 3, 7, 8, 12, 14, 15, 19];
  /* ka: a dry hand on the rim of the drum */
  const ka = (at, amp) => {
    const dur = 0.09, n = Math.round(dur * RATE), start = Math.round(at * RATE);
    let hp = 0;
    for (let i = 0; i < n; i++) {
      const t = i / RATE, v = rnd() * 2 - 1;
      hp += (v - hp) * 0.55;
      buf[(start + i) % len] += (v - hp) * Math.exp(-t * 55) * amp;
    }
  };
  const easternBar = (b, t0, chord, beat, K, wet) => {
    /* the drone: the tonic low, and a fifth over it held very slightly flat, the way a breath sits */
    note(t0, beat * 4.3, K.root / 2, wet ? 0.042 : 0.036, 'pad', 1.3);
    note(t0, beat * 4.2, K.root * 0.749, wet ? 0.028 : 0.024, 'pad', 1.6);
    note(t0, beat * 4.2, chord[0] / 4, wet ? 0.05 : 0.028, 'bass', 0.14);
    /* the koto: an ostinato up the scale, each note flicked into from the string below */
    const fig = wet
      ? [[0, 0], [0.5, 2], [1, 3], [1.5, 4], [2, 1], [2.5, 3], [3, 2], [3.5, 1]]
      : [[0, 0], [1, 2], [1.75, 4], [2.5, 1], [3, 3], [3.5, 2]];
    for (const [bt, deg] of fig) {
      const idx = (deg + b) % 5;
      const f = semis(K.root, HIRAJOSHI[idx]) * 2;
      note(t0 + bt * beat - beat * 0.07, beat * 0.35, semis(K.root, HIRAJOSHI[idx] - 1) * 2, 0.012, 'koto', 0.003);
      note(t0 + bt * beat, beat * 1.8, f, 0.048, 'koto', 0.003);
      if (wet && bt % 1 === 0) note(t0 + bt * beat + 0.03, beat * 1.2, semis(K.root, HIRAJOSHI[(idx + 2) % 5]) * 2, 0.014, 'shamisen', 0.003);
    }
    /* a run up the strings, three quick notes landing on the downbeat of each half */
    if (b % 4 === 0) {
      for (let k = 0; k < 5; k++) {
        note(t0 - beat * (5 - k) * 0.17, beat * 0.45, semis(K.root, HIRAJOSHI[k]) * 2, 0.016 + k * 0.002, 'koto', 0.002);
      }
    }
    /* the shakuhachi: one long line a bar, bent up into its note and leaning on the next string at the end */
    const deg = [0, 3, 2, 4, 2, 1, 3, 0][b % 8];
    const at = t0 + beat * (wet ? 1.1 : 1.5);
    const fm = semis(K.root, HIRAJOSHI[deg]) * 2;
    note(at - beat * 0.24, beat * 0.4, fm * 0.965, 0.014, 'shaku', 0.07);
    note(at, beat * 2.4, fm, wet ? 0.03 : 0.028, 'shaku', 0.45);
    if (b % 2 === 1) note(at + beat * 1.5, beat * 1.0, semis(K.root, HIRAJOSHI[(deg + 1) % 5]) * 2, 0.02, 'shaku', 0.3);
    if (wet) {
      /* taiko: don, ka, don-don, and a roll running into the turn of the phrase */
      thump(t0, 0.1, 62);
      thump(t0 + beat * 1.5, 0.05, 58);
      thump(t0 + beat * 2.5, 0.085, 60);
      ka(t0 + beat, 0.03);
      ka(t0 + beat * 3, 0.026);
      if (b % 4 === 3) for (let k = 0; k < 6; k++) thump(t0 + beat * 3 + k * beat * 0.14, 0.028 + k * 0.008, 66);
      wash(t0 + beat * 1.4, beat * 2.4, 0.02 * (K.surf || 0.3));        // rain on the gravel
    } else {
      /* the shishi-odoshi: bamboo filling, then tipping and knocking on the stone */
      for (let k = 0; k < 3; k++) {
        const at2 = t0 + (k + (b % 2 ? 0.45 : 0.7)) * (beat * 4 / 3), n = Math.round(0.13 * RATE), start = Math.round(at2 * RATE);
        let lp = 0;
        for (let i = 0; i < n; i++) {
          const t = i / RATE, v = rnd() * 2 - 1;
          lp += (v - lp) * 0.35;
          buf[(start + i) % len] += (v - lp) * Math.exp(-t * 40) * 0.024;
        }
        note(at2, beat * 0.9, semis(K.root, HIRAJOSHI[(k + b) % 5]) * 2, 0.012, 'koto', 0.004);
      }
      /* suzu: a handful of small bells at the end of the phrase */
      if (b % 4 === 2) for (let k = 0; k < 5; k++) {
        note(t0 + beat * 3 + k * beat * 0.1, beat * 0.6, semis(K.root, [19, 26, 31][k % 3]) * 2, 0.009, 'gong', 0.001);
      }
      wash(t0 + beat * 0.5, beat * 3.4, 0.008);                          // wind through the bamboo
    }
    /* the temple bell, struck at the head of every half and left to ring out over the bars */
    if (b % 4 === 0) {
      note(t0, beat * 6.5, semis(K.root, 0) / 2, 0.055, 'gong', 0.002);
      note(t0, beat * 5.0, semis(K.root, 7) / 2, 0.026, 'gong', 0.004);
      thump(t0, 0.032, 48);
    }
  };

  /* the cyber bar: a sixteenth sequencer under a detuned saw pad, a kick on every beat, a snare on two and four,
     hats on the eighths and a pulse-wave arpeggio two octaves up. The storm growls and wails; the calm still drives. */
  const snare = (at, amp) => {
    const dur = 0.22, n = Math.round(dur * RATE), start = Math.round(at * RATE);
    let lp = 0, hp = 0;
    for (let i = 0; i < n; i++) {
      const t = i / RATE, v = rnd() * 2 - 1;
      lp += (v - lp) * 0.45; hp += (v - hp) * 0.05;
      buf[(start + i) % len] += ((v - lp) * 0.8 + hp * 2.2) * Math.exp(-t * 26) * amp
        + Math.sin(TAU * 180 * t) * Math.exp(-t * 30) * amp * 0.4;
    }
  };
  const hat = (at, amp) => {
    const dur = 0.06, n = Math.round(dur * RATE), start = Math.round(at * RATE);
    let hp = 0;
    for (let i = 0; i < n; i++) {
      const t = i / RATE, v = rnd() * 2 - 1;
      hp += (v - hp) * 0.75;
      buf[(start + i) % len] += (v - hp) * Math.exp(-t * 90) * amp;
    }
  };
  const cyberBar = (b, t0, chord, beat, K, wet) => {
    const step = beat / 4;
    const root = chord[0];
    /* the pad: saws an octave down, swelling across the bar */
    for (const f of chord) note(t0, beat * 4.1, f * 2, wet ? 0.028 : 0.022, 'saw', wet ? 0.55 : 0.3);
    /* the bass: sixteenths on the root, walking to the fifth, the octave and the flat seventh */
    const seq = wet ? [0, 0, 12, 0, 0, 7, 0, 10, 0, 0, 12, 0, 7, 0, 3, 7]
                    : [0, 0, 0, 7, 0, 0, 12, 0, 0, 0, 0, 7, 3, 0, 7, 0];
    for (let i = 0; i < 16; i++) {
      note(t0 + i * step, step * 1.6, semis(root, seq[i]) / 2, wet ? 0.075 : 0.062, 'bass', 0.003);
    }
    /* four on the floor, a snare cracking on two and four, hats over the top */
    for (let k = 0; k < 4; k++) thump(t0 + k * beat, wet ? 0.11 : 0.085, 56);
    snare(t0 + beat, wet ? 0.075 : 0.058);
    snare(t0 + beat * 3, wet ? 0.075 : 0.058);
    for (let i = 0; i < 16; i++) if (i % 2 === 0 || i % 4 === 3) hat(t0 + i * step, (i % 2 ? 0.018 : 0.03) * (wet ? 1.2 : 1));
    /* the arpeggio: the chord, octaves up, running in sixteenths */
    const arp = [0, 2, 1, 3, 2, 1, 3, 2];
    for (let i = 0; i < 16; i++) {
      const idx = arp[(i + b * 3) % arp.length];
      note(t0 + i * step, step * 2.2, chord[idx] * (wet ? 4 : 8), wet ? 0.045 : 0.052, 'square', 0.002);
    }
    /* the storm has a siren in it, sliding between two notes */
    if (wet && b % 4 === 2) {
      const dur = beat * 2.6, n = Math.round(dur * RATE), start = Math.round((t0 + beat * 2) * RATE);
      let ph = 0;
      for (let i = 0; i < n; i++) {
        const t = i / RATE, p = t / dur;
        const f = semis(chord[2] * 2, Math.sin(p * TAU * 1.5) * 0.6);
        ph += TAU * f / RATE;
        buf[(start + i) % len] += (Math.sin(ph) * 0.6 + Math.sin(ph * 2) * 0.2) * Math.sin(Math.PI * p) * 0.045;
      }
    }
    if (!wet && b % 4 === 3) wash(t0 + beat * 2, beat * 2, 0.008);        // rain on the glass
  };

  /* ---------- the rest of the pictures, each with its own way of being played ---------- */
  const crackle = (at, amp) => {
    const dur = 0.03, n = Math.round(dur * RATE), start = Math.round(at * RATE);
    let hp = 0;
    for (let i = 0; i < n; i++) {
      const v = rnd() * 2 - 1;
      hp += (v - hp) * 0.7;
      buf[(start + i) % len] += (v - hp) * Math.exp(-(i / n) * 5) * amp;
    }
  };
  const clap = (at, amp) => {
    const dur = 0.16, n = Math.round(dur * RATE), start = Math.round(at * RATE);
    let lp = 0;
    for (let i = 0; i < n; i++) {
      const t = i / RATE, v = rnd() * 2 - 1;
      lp += (v - lp) * 0.2;
      buf[(start + i) % len] += (v - lp) * Math.exp(-t * 22) * amp;
    }
  };
  /* aurora: stacked fifths breathing over each other, glass bells, and a slow arpeggio that takes the whole bar */
  const glacialBar = (b, t0, chord, beat, K, wet) => {
    const dur = beat * 4;
    note(t0, dur * 1.08, chord[0] / 2, wet ? 0.042 : 0.036, 'pad', 1.8);
    for (const f of chord) note(t0, dur * 1.1, f, wet ? 0.03 : 0.027, 'pad', 1.9);
    note(t0, dur, chord[2] * 2, wet ? 0.011 : 0.015, 'glass', 1.5);
    const seq = [0, 2, 1, 3];
    for (let i = 0; i < 4; i++) {
      const idx = seq[(i + b) % seq.length] % chord.length;
      note(t0 + i * beat, beat * 2.4, chord[idx] * 2, wet ? 0.019 : 0.025, 'bell', 0.02);
    }
    if (b % 2 === 1) note(t0 + beat * 2.5, beat * 1.8, chord[3] * 4, 0.011, 'glass', 0.7);
    wash(t0, dur, (wet ? 0.03 : 0.01) * (K.surf || 0.5));
    if (wet && b % 4 === 2) thump(t0, 0.045, 40);
  };
  /* ember: piano over a drone, embers cracking, and a figure that climbs and falls back */
  const fireBar = (b, t0, chord, beat, K, wet) => {
    const dur = beat * 4;
    note(t0, dur * 1.05, chord[0] / 2, wet ? 0.05 : 0.04, 'pad', 1.3);
    for (const f of chord) note(t0, dur, f / 2, wet ? 0.03 : 0.026, 'pad', 1.0);
    const fig = wet ? [[0, 0], [1.5, 2], [2.5, 1], [3.5, 3]] : [[0, 0], [1, 1], [2, 2], [3, 3]];
    for (const [bt, i] of fig) note(t0 + bt * beat, beat * 2.0, chord[i % chord.length] * 2, wet ? 0.045 : 0.05, 'piano', 0.004);
    const n = wet ? 6 : 2;
    for (let k = 0; k < n; k++) crackle(t0 + rnd() * dur, wet ? 0.02 + rnd() * 0.02 : 0.012);
    if (wet) { thump(t0, 0.06, 46); thump(t0 + beat * 3, 0.03, 44); }
  };
  /* ocean: a marimba rocking in threes, swell over swell */
  const tideBar = (b, t0, chord, beat, K, wet) => {
    const dur = beat * 4;
    for (const f of chord) note(t0, dur * 1.1, f, wet ? 0.03 : 0.027, 'pad', 1.3);
    note(t0, dur, chord[0] / 2, wet ? 0.038 : 0.028, 'bass', 0.25);
    const pat = [0, 1, 2, 1, 0, 2];
    for (let i = 0; i < 6; i++) {
      const idx = pat[(i + b) % 6] % chord.length;
      note(t0 + i * (dur / 6), beat * 0.95, chord[idx] * 2, wet ? 0.036 : 0.04, 'marimba', 0.004);
    }
    wash(t0, dur * 1.15, (wet ? 0.045 : 0.014) * (K.surf || 0.6));
    if (wet && b % 2 === 0) thump(t0 + beat * 2, 0.038, 44);
  };
  /* forest: a wooden flute, a marimba under it, and a bird answering at the end of the bar */
  const woodlandBar = (b, t0, chord, beat, K, wet) => {
    const dur = beat * 4;
    note(t0, dur, chord[0] / 2, wet ? 0.011 : 0.008, 'pad', 0.9);
    const tune = [0, 2, 1, 3, 2, 0];
    const d0 = tune[b % 6] % chord.length, d1 = tune[(b + 2) % 6] % chord.length;
    note(t0 + beat * 0.5, beat * 1.7, chord[d0] * 2, wet ? 0.019 : 0.022, 'flute', 0.13);
    note(t0 + beat * 2.5, beat * 1.1, chord[d1] * 2, wet ? 0.024 : 0.03, 'flute', 0.1);
    const pat = [0, 1, 2, 3, 2, 1, 0, 2];
    for (let i = 0; i < 8; i++) {
      const idx = pat[(i + b) % 8] % chord.length;
      note(t0 + i * beat / 2, beat * 0.45, chord[idx] * 3, wet ? 0.042 : 0.052, 'marimba', 0.004);
    }
    if (b % 2 === 0) {
      const at = t0 + beat * 3.2;
      note(at, 0.12, semis(K.root, 26 + (b % 3) * 2) * 2, 0.016, 'bell', 0.002);
      note(at + 0.1, 0.1, semis(K.root, 28 + (b % 2)) * 2, 0.012, 'bell', 0.002);
    }
    if (wet) wash(t0 + beat * 2, beat * 2, 0.012 * (K.surf || 0.4));
  };
  /* candy: a music box in sixteenths, a bass that bounces, and a clap on two and four */
  const toyBar = (b, t0, chord, beat, K, wet) => {
    const dur = beat * 4;
    const pat = [0, 2, 1, 3, 2, 0, 3, 1];
    for (let i = 0; i < 8; i++) {
      const idx = pat[(i + b) % 8] % chord.length;
      note(t0 + i * beat / 2, beat * 0.42, chord[idx] * 4, wet ? 0.026 : 0.03, 'bell', 0.002);
    }
    note(t0, beat * 0.85, chord[0] / 2, 0.055, 'bass', 0.004);
    note(t0 + beat * 1.5, beat * 0.4, chord[0] / 2, 0.03, 'bass', 0.004);
    note(t0 + beat * 2, beat * 0.85, chord[2] / 2, 0.045, 'bass', 0.004);
    clap(t0 + beat, wet ? 0.05 : 0.04);
    clap(t0 + beat * 3, wet ? 0.05 : 0.04);
    for (let i = 0; i < 4; i++) hat(t0 + i * beat + beat * 0.5, 0.012);
    if (b % 4 === 3) note(t0 + beat * 3.5, beat * 0.4, chord[3] * 4, 0.028, 'marimba', 0.002);
    if (wet) note(t0, dur, chord[1] * 2, 0.012, 'pad', 1.2);
  };
  /* the city: a walking bass, brushes, piano comping on two and four, and one high note over it */
  const noirBar = (b, t0, chord, beat, K, wet) => {
    const dur = beat * 4;
    note(t0, dur, chord[0] / 2, wet ? 0.03 : 0.026, 'pad', 1.2);
    const walk = [0, 2, 1, 3];
    for (let i = 0; i < 4; i++) {
      const idx = walk[(i + b) % 4] % chord.length;
      note(t0 + i * beat, beat * 1.1, chord[idx] / 2, wet ? 0.05 : 0.055, 'bass', 0.012);
    }
    snare(t0 + beat, 0.018);
    snare(t0 + beat * 3, 0.018);
    for (let i = 0; i < 8; i++) hat(t0 + i * beat / 2, i % 2 ? 0.006 : 0.011);
    for (const f of chord) {
      note(t0 + beat, beat * 0.9, f * 1.5, wet ? 0.014 : 0.02, 'piano', 0.004);
      note(t0 + beat * 3, beat * 0.9, f * 1.5, 0.016, 'piano', 0.004);
    }
    note(t0 + beat * 2.5, beat * 2.2, chord[b % chord.length] * 3, wet ? 0.016 : 0.02, 'glass', 0.18);
    if (wet) wash(t0, dur, 0.02 * (K.surf || 0.4));
  };
  /* the plain: a broken piano chord and a flute with room around it */
  const meadowBar = (b, t0, chord, beat, K, wet) => {
    const dur = beat * 4;
    for (const f of chord) note(t0, dur * 1.05, f, wet ? 0.028 : 0.03, 'pad', 1.2);
    for (let i = 0; i < 8; i++) {
      const idx = [0, 1, 2, 3][i % 4] % chord.length;
      note(t0 + i * beat / 2, beat * 1.0, chord[idx] * 2, wet ? 0.026 : 0.032, 'piano', 0.006);
    }
    note(t0, dur, chord[0] / 2, wet ? 0.03 : 0.026, 'bass', 0.2);
    if (b % 2 === 0) {
      const idx = (b / 2) % 2 ? 1 : 2;
      note(t0 + beat * 1, beat * 2.4, chord[idx % chord.length] * 2, wet ? 0.026 : 0.03, 'flute', 0.22);
    }
    if (b % 4 === 3) note(t0 + beat * 3, beat * 1.2, chord[3] * 4, 0.014, 'glass', 0.4);
    if (wet) wash(t0 + beat * 1.5, beat * 2.5, 0.02 * (K.surf || 0.5));
  };

  for (let b = 0; b < bars; b++) {
    const ch = K.prog[b % K.prog.length], t0 = b * beat * 4;
    const chord = ch.map(n => semis(K.root, n));
    const BAR = { cyber: cyberBar, eastern: easternBar, glacial: glacialBar, fire: fireBar, tide: tideBar,
      woodland: woodlandBar, toy: toyBar, noir: noirBar, meadow: meadowBar };
    if (BAR[K.style]) { BAR[K.style](b, t0, chord, beat, K, wet); continue; }
    /* the pad, an octave down, swelling through the bar */
    for (const f of chord) note(t0, beat * 4.35, f / 2, wet ? 0.05 : 0.042, 'pad', 0.9);
    note(t0, beat * 4.2, chord[0] / 4, wet ? 0.055 : 0.04, 'bass', 0.05);
    if (wet) {
      note(t0, beat * 4.1, chord[2] / 2, 0.018, 'pad', 1.4);              // an open fifth, hollow under the rest
      if (b % 2 === 0) wash(t0 + beat * 1.5, beat * 2.6, 0.05 * K.surf);
      else wash(t0 + beat * 3.0, beat * 1.8, 0.035 * K.surf);
      thump(t0, 0.075);
      thump(t0 + beat * 2, 0.05);
      if (b % 4 === 2) thump(t0 + beat * 3.5, 0.035, 44);
      /* two slow notes, low, with a tension note over the third bar */
      const lead = chord[b % 2 ? 1 : 2] * 2;
      note(t0 + beat * 1, beat * 2.4, lead, 0.036, K.lead, 0.04);
      if (b % 4 === 3) note(t0 + beat * 3, beat * 1.6, chord[1] * 2, 0.026, K.lead, 0.04);
    } else {
      /* a shaker on the off-beats, like leaves or small stones */
      for (let k = 0; k < 4; k++) {
        const at = t0 + k * beat + beat * 0.5, n = Math.round(0.09 * RATE), start = Math.round(at * RATE);
        let hp = 0;
        for (let i = 0; i < n; i++) {
          const t = i / RATE;
          const v = rnd() * 2 - 1;
          hp += (v - hp) * 0.5;
          buf[(start + i) % len] += (v - hp) * Math.exp(-t * 34) * 0.028;
        }
      }
      /* a walking bell over the chord, six steps to the bar */
      const walk = [0, 2, 1, 3, 2, 1];
      for (let k = 0; k < 6; k++) {
        const idx = (walk[(k + b) % walk.length] + (k === 5 && b % 2 ? 1 : 0)) % chord.length;
        const oct = k === 4 ? 2 : 1;
        note(t0 + k * (beat * 4 / 6), beat * 1.5, chord[idx] * oct, 0.04, K.lead, 0.008);
      }
      if (b % 4 === 1) note(t0, beat * 3, chord[3] * 2, 0.024, 'glass', 0.5);   // a high, still note over the turn
      if (b % 4 === 3) wash(t0 + beat * 2, beat * 2, 0.012 * K.surf);
    }
  }

  let peak = 0;
  for (const v of buf) peak = Math.max(peak, Math.abs(v));
  const gain = peak > 0 ? 0.86 / peak : 1;
  return { buf, gain, rate: RATE };
}

function writeTrack(file, name) {
  const { buf, gain, rate } = compose(name);
  const len = buf.length;
  const data = Buffer.alloc(44 + len * 2);
  data.write('RIFF', 0); data.writeUInt32LE(36 + len * 2, 4); data.write('WAVE', 8);
  data.write('fmt ', 12); data.writeUInt32LE(16, 16); data.writeUInt16LE(1, 20); data.writeUInt16LE(1, 22);
  data.writeUInt32LE(rate, 24); data.writeUInt32LE(rate * 2, 28); data.writeUInt16LE(2, 32); data.writeUInt16LE(16, 34);
  data.write('data', 36); data.writeUInt32LE(len * 2, 40);
  for (let i = 0; i < len; i++) {
    const v = Math.max(-1, Math.min(1, buf[i] * gain));
    data.writeInt16LE(Math.round(v * 32000), 44 + i * 2);
  }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, data);
  return file;
}

const trackFor = (theme, rain) => (KEYS[theme] ? theme : 'aurora') + (rain ? '-wet' : '-dry');
const trackNames = () => Object.keys(KEYS).reduce((all, t) => all.concat([t + '-dry', t + '-wet']), []);
const pretty = name => String(name || '').split('-')[0] + (/-dry$/.test(name) ? ' · peace' : ' · tragedy');

module.exports = { writeTrack, compose, trackFor, trackNames, pretty, KEYS, RATE };

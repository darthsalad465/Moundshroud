// Sixteen little loops, one for every picture the terminal can show: each theme has a calm one and a stormy one,
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
  aurora: {
    wet: { root: 146.83, prog: [[0, 3, 7, 10], [-2, 3, 5, 10], [-4, 0, 3, 7], [-5, -1, 2, 7]], bpm: 52, lead: 'bell', surf: 0.9, storm: 1 },
    dry: { root: 174.61, prog: [[0, 4, 7, 11], [-3, 2, 5, 9], [-5, 0, 4, 7], [-1, 4, 7, 11]], bpm: 64, lead: 'glass', surf: 0.2, storm: 0 },
  },
  ember: {
    wet: { root: 110.00, prog: [[0, 1, 7, 8], [0, 3, 7, 10], [-2, 3, 6, 10], [-1, 2, 7, 11]], bpm: 48, lead: 'reed', surf: 0.6, storm: 1 },
    dry: { root: 130.81, prog: [[0, 4, 7, 11], [-3, 2, 5, 9], [-5, 0, 4, 7], [-1, 4, 7, 11]], bpm: 56, lead: 'marimba', surf: 0.15, storm: 0 },
  },
  ocean: {
    wet: { root: 98.00, prog: [[0, 3, 7, 10], [-2, 2, 5, 9], [-4, 0, 3, 7], [-5, -1, 2, 7]], bpm: 46, lead: 'bell', surf: 1.15, storm: 1 },
    dry: { root: 164.81, prog: [[0, 4, 7, 11], [2, 5, 9, 12], [-3, 0, 4, 7], [-5, -1, 2, 7]], bpm: 60, lead: 'glass', surf: 0.45, storm: 0 },
  },
  forest: {
    wet: { root: 116.54, prog: [[0, 3, 7, 10], [-2, 3, 5, 10], [-4, 0, 3, 7], [-5, -1, 2, 7]], bpm: 50, lead: 'reed', surf: 0.5, storm: 1 },
    dry: { root: 196.00, prog: [[0, 4, 7, 11], [2, 6, 9, 12], [-3, 0, 4, 7], [-1, 4, 7, 11]], bpm: 66, lead: 'marimba', surf: 0.2, storm: 0 },
  },
  candy: {
    wet: { root: 155.56, prog: [[0, 3, 7, 10], [-2, 2, 5, 9], [-4, 0, 3, 7], [-5, -1, 2, 7]], bpm: 58, lead: 'bell', surf: 0.3, storm: 1 },
    dry: { root: 261.63, prog: [[0, 4, 7, 11], [2, 5, 9, 12], [-3, 0, 4, 7], [-1, 4, 7, 11]], bpm: 84, lead: 'marimba', surf: 0.1, storm: 0 },
  },
  mono: {
    wet: { root: 103.83, prog: [[0, 3, 7, 10], [-1, 3, 6, 10], [-4, 0, 3, 7], [-5, -1, 2, 7]], bpm: 50, lead: 'reed', surf: 0.55, storm: 1 },
    dry: { root: 155.56, prog: [[0, 3, 7, 10], [-2, 3, 5, 9], [-4, 0, 3, 7], [-5, -1, 2, 7]], bpm: 58, lead: 'glass', surf: 0.25, storm: 0 },
  },
  matrix: {
    wet: { root: 87.31, prog: [[0, 1, 7, 8], [0, 3, 7, 10], [-2, 3, 6, 10], [-1, 2, 7, 11]], bpm: 54, lead: 'reed', surf: 0.4, storm: 1 },
    dry: { root: 130.81, prog: [[0, 4, 7, 11], [2, 6, 9, 12], [-3, 0, 4, 7], [-1, 4, 7, 11]], bpm: 62, lead: 'glass', surf: 0.15, storm: 0 },
  },
  plain: {
    wet: { root: 98.00, prog: [[0, 3, 7, 10], [-2, 3, 5, 10], [-4, 0, 3, 7], [-5, -1, 2, 7]], bpm: 48, lead: 'bell', surf: 0.5, storm: 1 },
    dry: { root: 174.61, prog: [[0, 4, 7, 11], [-3, 2, 5, 9], [-5, 0, 4, 7], [-1, 4, 7, 11]], bpm: 60, lead: 'glass', surf: 0.15, storm: 0 },
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
    const a = attack == null ? (kind === 'pad' ? 0.8 : 0.01) : attack;
    const decay = kind === 'pad' ? 0.42 : kind === 'bass' ? 1.1 : 2.6;
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

  for (let b = 0; b < bars; b++) {
    const ch = K.prog[b % K.prog.length], t0 = b * beat * 4;
    const chord = ch.map(n => semis(K.root, n));
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
const pretty = name => String(name || '').split('-')[0] + (/-dry$/.test(name) ? ' · calm' : ' · storm');

module.exports = { writeTrack, compose, trackFor, trackNames, pretty, KEYS, RATE };

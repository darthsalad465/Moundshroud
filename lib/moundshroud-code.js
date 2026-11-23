// Moundshroud Code in a terminal: the same built-in harness and the same guard as the Agent tab, drawn as a full-screen
// interface that borrows Moundshroud's own colours (web/style.css): a filled title bar, a transcript that reads like a
// letter, tool cards that fold long output away, and approvals that arrive as a panel instead of a question in the log.
// The window is drawn, not printed: every frame is a list of rows, which keeps the borders straight at any size.
// Run it from here, or press "Open in a terminal window instead" in Agent settings.
//   node lib/moundshroud-code.js
//   node lib/moundshroud-code.js --model gemma4:latest --dir C:\work --guard
//   node lib/moundshroud-code.js --demo            (draw one sample screen and exit)
//
// Inside, a short command is enough for everything people do often:
//   /model            list the models this PC has      /model 2   or   /model qwen     switch to one
//   /chat   /code     talk only, or the full agent with tools
//   /pull user/repo   take one GGUF file from Hugging Face and let Ollama make a model of it
//   /scan  /import 12 every AI model file on the PC (GGUF, safetensors, ONNX...) is listed by kind; import one into Ollama
//   /find words       search the project by meaning with an embedding model
//   /theme /color     the whole palette, or one colour of it      /anim   the glow while typing and writing
//
//
//             ▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄
//           ▄████████████████████████▄
//          ████ ████ ██ ████ ████ ████
//         ██████████████████████████████
//        ████████████████████████████████
//       ██████████████████████████████████
//      ████████████████████████████████████
//     ████ ██████████████████████████ ████
//    ████ ██████████████████████████ ████
//   ████ ███ ████████████ ███ ████████ ████
//  ████ ████ ██████ ████ ██████████████ ████
//  ████ ██ ██ ████ ██ ██ ██ ████ ██ ██ ██ ████
//  ████ ██  ██████ ██  ██ ██████ ██  ██ ████
//  ████ ██   ███ ██   ██ ██   ███ ██   ████
//  ████ ████████████████████████████████ ████
//  ████ ████████████████████████████████ ████
//  ████ ████████████████████████████████ ████
//  ████ ████████████████████████████████ ████
//  ████ ████████████████████████████████ ████
//  ████ ████████████████████████████████ ████
//  ████ ████████████████████████████████ ████
//  ████ ████████████████████████████████ ████
//  ████ ████████████████████████████████ ████
//  ████ ████████████████████████████████ ████
//  ████ ████████████████████████████████ ████
//  ██████████████████████████████████████████
//  ██████████████████████████████████████████
//  ██████████████████████████████████████████
//
//        Crown + gold M · no purple frame
//
const fs = require('fs'), path = require('path'), readline = require('readline'), cp = require('child_process');

const ROOT = path.join(__dirname, '..'), DATA = path.join(ROOT, 'data');
const APP_STARTED = Date.now();
const N = require('./harness-native'), H = require('./harness'), agentLib = require('./agent'), safeDir = require('./safe-dir');
const mcodeCustom = require('../web/js/mcode-custom');
const hf = require('./hf-gguf'), modelOrder = require('./model-order');
const finder = require('./model-finder'), codeFind = require('./code-find');
const llamaRunner = require('./llama-runner');
const openwhip = require('./openwhip');
const mcodeSwarm = require('../web/js/mcode-swarm');
/* every AI model found on this PC outside Ollama (LM Studio, Hugging Face cache, loose GGUF and more): /models lists
   them with what kind of AI each one is, /import brings a language or embedding model into Ollama */
let FILES = [];
function withFiles(list) {
  const have = new Set((list || []).map(m => String(m.name).replace(/:latest$/, '').toLowerCase()));
  const files = FILES.filter(f => !have.has(String(f.name).toLowerCase())).map(f => ({
    name: f.name, size: f.size || 0, file: f.path, fileModel: true, kind: f.kind, kindName: f.kindName || f.kind,
    source: f.source, importable: !!f.ollama, format: f.format, tools: false
  }));
  return (list || []).filter(m => !m.fileModel).concat(files);
}
const NAME = N.NAME || 'Moundshroud Code';
const UI_FILE = path.join(DATA, 'mcode-ui.json');

/* ---------- the app's own palette ---------- */
const PAL = {
  bg: [14, 16, 22], panel: [22, 25, 35], panel2: [29, 33, 46], line: [42, 48, 66],
  text: [236, 238, 245], mute: [154, 163, 186], dim: [110, 118, 140],
  acc: [139, 124, 255], acc2: [70, 215, 200], ok: [94, 230, 168], bad: [255, 107, 129], warn: [255, 194, 102],
  /* the three voices of a conversation: what you said, what it answered, and what it was working out */
  you: [139, 124, 255], agent: [70, 215, 200], think: [170, 160, 212],
  /* the mark: the two ends of its own little gradient, so the logo belongs to the theme it is sitting in */
  markA: [255, 246, 207], markB: [177, 122, 18],
};
const BASE_PAL = Object.assign({}, PAL);
/* ---------- palettes that can be switched to while it runs (/theme, /color) ---------- */
const THEMES = {
  aurora: {},                                             // the app's own colours
  ember: { panel: [36, 27, 23], panel2: [46, 34, 28], line: [62, 46, 37], text: [250, 240, 232], mute: [198, 176, 158], dim: [142, 120, 106], acc: [255, 138, 76], acc2: [255, 205, 120], ok: [150, 226, 140], bad: [255, 107, 107], warn: [255, 196, 86], you: [255, 138, 76], agent: [255, 205, 120], think: [200, 158, 132], markA: [255, 224, 180], markB: [206, 76, 24] },
  ocean: { panel: [18, 27, 40], panel2: [24, 36, 52], line: [34, 52, 74], text: [232, 240, 250], mute: [160, 178, 200], dim: [110, 130, 155], acc: [86, 160, 255], acc2: [86, 222, 255], ok: [96, 230, 190], bad: [255, 118, 138], warn: [255, 214, 130], you: [86, 160, 255], agent: [86, 222, 255], think: [150, 180, 210], markA: [214, 242, 255], markB: [40, 118, 196] },
  forest: { panel: [19, 30, 23], panel2: [25, 40, 30], line: [36, 56, 40], text: [236, 244, 236], mute: [164, 188, 166], dim: [108, 134, 112], acc: [126, 220, 140], acc2: [212, 232, 124], ok: [126, 220, 140], bad: [255, 130, 120], warn: [240, 206, 120], you: [126, 220, 140], agent: [212, 232, 124], think: [168, 198, 170], markA: [232, 255, 214], markB: [56, 156, 86] },
  candy: { panel: [32, 20, 36], panel2: [44, 27, 50], line: [64, 38, 64], text: [252, 238, 250], mute: [204, 170, 200], dim: [152, 120, 150], acc: [255, 120, 200], acc2: [150, 190, 255], ok: [126, 236, 186], bad: [255, 120, 150], warn: [255, 206, 120], you: [255, 120, 200], agent: [150, 190, 255], think: [216, 170, 214], markA: [255, 232, 246], markB: [246, 104, 178] },
  mono: { panel: [26, 28, 36], panel2: [34, 36, 46], line: [54, 58, 70], text: [240, 242, 248], mute: [170, 176, 190], dim: [120, 126, 140], acc: [222, 226, 236], acc2: [178, 184, 196], ok: [206, 212, 222], bad: [255, 140, 150], warn: [236, 222, 190], you: [238, 240, 246], agent: [176, 182, 194], think: [132, 138, 152], markA: [250, 250, 252], markB: [128, 128, 136] },
  matrix: { panel: [10, 26, 18], panel2: [14, 36, 24], line: [26, 56, 38], text: [212, 255, 222], mute: [130, 182, 140], dim: [82, 132, 96], acc: [120, 255, 150], acc2: [60, 220, 120], ok: [120, 255, 150], bad: [255, 130, 110], warn: [210, 255, 120], you: [120, 255, 150], agent: [150, 255, 210], think: [112, 186, 134], markA: [216, 255, 226], markB: [22, 168, 78] },
  garden: { panel: [30, 26, 30], panel2: [40, 34, 38], line: [64, 52, 54], text: [250, 240, 232], mute: [200, 178, 168], dim: [146, 126, 120], acc: [236, 118, 96], acc2: [255, 206, 170], ok: [150, 214, 140], bad: [255, 122, 116], warn: [255, 196, 132], you: [236, 118, 96], agent: [255, 206, 170], think: [206, 170, 168], markA: [255, 240, 226], markB: [198, 82, 66] },
  /* plain: nothing but black, white and the greys between them */
  plain: { bg: [0, 0, 0], panel: [10, 10, 10], panel2: [18, 18, 18], line: [52, 52, 52], text: [255, 255, 255], mute: [186, 186, 186], dim: [128, 128, 128], acc: [255, 255, 255], acc2: [214, 214, 214], ok: [240, 240, 240], bad: [255, 255, 255], warn: [212, 212, 212], you: [255, 255, 255], agent: [204, 204, 204], think: [148, 148, 148], markA: [255, 255, 255], markB: [116, 116, 116] },
};
const UI = { theme: 'aurora', colors: {}, anim: true, think: false, animMode: 'smooth', scene: 'on', mood: 'tragedy', gray: false };
const sceneMood = () => UI.mood;
const TAGLINES = {
  aurora: 'the road remembers every hoof',
  ember: 'the mountain is only sleeping',
  ocean: 'something is always rising',
  forest: 'the woods are never empty',
  candy: 'too sweet to last the night',
  mono: 'the city watches back',
  matrix: 'follow the green thread',
  plain: 'lights over the long field',
  garden: 'the gravel remembers every footstep',
};
const tagline = () => TAGLINES[UI.theme] || 'his own road · your files';

/* every theme carries a picture of its own: this is what /scene calls each one */
const SCENE_NAME = { aurora: 'the night ride', ember: 'the volcano', ocean: 'the lighthouse', forest: 'the wood', candy: 'candyland', mono: 'the city', matrix: 'digital rain', plain: 'the quiet field', garden: 'the garden' };
const sceneName = () => SCENE_NAME[UI.theme] || 'the background';
const hex2rgb = h => {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(h || '').trim());
  if (!m) return null;
  const s = m[1].length === 3 ? m[1].split('').map(c => c + c).join('') : m[1];
  return [0, 2, 4].map(i => parseInt(s.slice(i, i + 2), 16));
};
const rgb2hex = rgb => '#' + rgb.map(v => Math.max(0, Math.min(255, v | 0)).toString(16).padStart(2, '0')).join('');
function applyTheme(name) {
  const key = String(name || '').toLowerCase();
  if (!Object.prototype.hasOwnProperty.call(THEMES, key)) return null;
  Object.assign(PAL, BASE_PAL, THEMES[key]);
  /* a coloured theme colours all of its text: the quiet greys are pulled toward the theme's own two colours, so the
     small print, the tool results and the captions belong to the theme too. mono and plain stay grey on purpose. */
  if (key !== 'mono' && key !== 'plain') {
    PAL.dim = mix(PAL.dim, PAL.acc, 0.32);
    PAL.mute = mix(PAL.mute, PAL.acc2, 0.22);
    PAL.text = mix(PAL.text, PAL.acc2, 0.06);
  }
  UI.theme = key;
  for (const k of Object.keys(PAL)) if (UI.colors[k]) PAL[k] = UI.colors[k];   // colours set by hand win
  return key;
}
function loadUI() {
  try {
    const j = JSON.parse(fs.readFileSync(UI_FILE, 'utf8'));
    for (const k of Object.keys(j.colors || {})) if (PAL[k] && hex2rgb(j.colors[k])) UI.colors[k] = rgb2hex(hex2rgb(j.colors[k]));
    if (j.theme) applyTheme(j.theme);
    UI.anim = j.anim !== false;
    if (j.think != null) UI.think = !!j.think;
    if (j.animMode) UI.animMode = j.animMode === 'off' ? 'off' : 'smooth';
    if (UI.animMode === 'off') UI.anim = false;
    if (['on', 'paused', 'off'].includes(j.scene)) UI.scene = j.scene;
    /* Keep older preferences readable; new saves record the scene as peace or tragedy. */
    if (j.mood === 'peace' || j.mood === 'tragedy') UI.mood = j.mood;
    else if (j.rain === false) UI.mood = 'peace';          // migrate preferences saved before scenes had named moods
    if (j.gray === true) UI.gray = true;
  } catch (e) { }
}
function saveUI() {
  try { fs.mkdirSync(DATA, { recursive: true }); fs.writeFileSync(UI_FILE, JSON.stringify({ theme: UI.theme, colors: UI.colors, anim: UI.anim, think: UI.think, animMode: UI.animMode, scene: UI.scene, mood: UI.mood, rain: UI.mood === 'tragedy', gray: UI.gray }, null, 2)); } catch (e) { }
}

/* ---------- the music: sixteen loops, one for every picture, written here and played by the machine itself ----------
   Each theme has two: one for the rain, and one for the calm. Nothing is downloaded — the notes are made in
   lib/mcode-music.js, into a small wav on first use, and Windows' own SoundPlayer loops it. When the theme or the
   weather changes while one is playing, the loop for the new picture starts on its own, so the music always belongs
   to what is on the screen. It is quiet, and it stops when the window closes.                                    */
const mcodeMusic = require('./mcode-music');
const MUSIC = { on: false, pid: 0, file: '', err: '', track: '' };
const musicTrackName = () => mcodeMusic.trackFor(UI.theme, UI.mood === 'tragedy');
const musicFile = name => path.join(DATA, 'music', (name || musicTrackName()) + '.wav');
const musicLabel = name => mcodeMusic.pretty(name || MUSIC.track || musicTrackName());
function writeMusic(file, name) { return mcodeMusic.writeTrack(file, name || musicTrackName()); }
function musicKill() {
  if (MUSIC.pid) {
    try { cp.spawnSync('taskkill', ['/PID', String(MUSIC.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true }); } catch (e) { }
    try { process.kill(MUSIC.pid); } catch (e) { }
  }
  MUSIC.pid = 0;
}
function musicOff() { musicKill(); MUSIC.on = false; MUSIC.track = ''; }
const musicPlaying = () => {
  if (!MUSIC.pid) return false;
  try { process.kill(MUSIC.pid, 0); return true; } catch (e) { return false; }
};
function musicStart(name) {
  const track = name || musicTrackName();
  if (MUSIC.on && MUSIC.track === track && musicPlaying()) return { ok: true, on: true, pid: MUSIC.pid, track };
  musicKill();
  MUSIC.on = false; MUSIC.err = '';
  const f = musicFile(track);
  try { if (!fs.existsSync(f)) writeMusic(f, track); } catch (e) { return { ok: false, error: 'The music could not be written: ' + e.message }; }
  let p = null;
  try {
    if (process.platform === 'win32') {
      /* Load first: that is the call that reads the file, so a bad one says so instead of playing nothing.
         No detached here: detached powershell exits at once before a note is ever heard. */
      const script = "$ErrorActionPreference='Stop'; try { $p = New-Object System.Media.SoundPlayer '" + f.replace(/'/g, "''") +
        "'; $p.Load(); $p.PlayLooping() } catch { [Console]::Error.Write($_.Exception.Message); exit 1 }; Start-Sleep -Seconds 86400";
      p = cp.spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script],
        { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
    } else {
      const player = process.platform === 'darwin' ? 'afplay' : 'paplay';
      p = cp.spawn('/bin/sh', ['-c', 'while true; do ' + player + ' "' + f + '" || sleep 2; done'], { stdio: ['ignore', 'ignore', 'pipe'] });
    }
  } catch (e) { return { ok: false, error: 'The music could not start: ' + e.message }; }
  if (p.stderr) {
    p.stderr.on('data', d => { MUSIC.err = (MUSIC.err + String(d)).trim().slice(-300); });
    try { p.stderr.unref(); } catch (e) { }
  }
  p.on('error', e => { if (MUSIC.pid === p.pid) { MUSIC.pid = 0; MUSIC.on = false; } MUSIC.err = e.message; });
  p.on('exit', code => {
    if (MUSIC.pid !== p.pid) return;
    MUSIC.pid = 0; MUSIC.on = false;
    if (code && !MUSIC.err) MUSIC.err = 'the player stopped (' + code + ')';
  });
  try { p.unref(); } catch (e) { }
  MUSIC.pid = p.pid; MUSIC.on = true; MUSIC.file = f; MUSIC.track = track;
  return { ok: true, on: true, pid: p.pid, track };
}
function musicOn(on) {
  if (!on) { musicOff(); return { ok: true, on: false }; }
  return musicStart();
}
/* the next one, at random: the same picture first, so flipping keeps the mood, then anywhere in the sixteen */
function musicNext() {
  const all = mcodeMusic.trackNames(), cur = MUSIC.track || musicTrackName();
  const others = all.filter(n => n !== cur);
  const same = others.filter(n => n.indexOf(String(UI.theme) + '-') === 0);
  const pool = same.length && Math.random() < 0.5 ? same : others;
  const pick = pool[Math.floor(Math.random() * pool.length)] || cur;
  return musicStart(pick);
}
/* the picture changed: if something is playing, the loop for the new picture takes over where it stands */
function musicSync() {
  if (!MUSIC.on) return;
  const r = musicStart();
  if (!r.ok) MUSIC.err = r.error || MUSIC.err;
}

/* ---------- the mark: Moundshroud's own logo — a crown and gold M, no purple frame ---------- */
const mix = (a, b, t) => [0, 1, 2].map(k => Math.round(a[k] + (b[k] - a[k]) * Math.max(0, Math.min(1, t))));

const LOGO_CROWN = [
  '.L...LL...L.',      // three points, three little lights on their tips
  '.GG..GG..GG.',
  '.GGG.GG.GGG.',
  '.GGGGGGGGGG.',
  '.GGGGGGGGGG.',      // the band
];

const LOGO_M = [
  'GG........GG',
  'GG........GG',
  'GGG......GGG',
  'GGGG....GGGG',
  'GG.GG..GG.GG',
  'GG..GGGG..GG',
  'GG...GG...GG',
  'GG........GG',
  'GG........GG',
  'GG........GG',
];

/* 14 pixels wide (crown/M only), no purple side columns */
const LOGO = ['..............']
  .concat(LOGO_CROWN.map(r => r))
  .concat(LOGO_M.map(r => r));

/* bevel on the crown tile areas (where G meets empty) */
const LOGO_PIX = LOGO.map((r, y) => r.split('').map((ch, x) => ch !== 'G' ? ch
  : ((!LOGO[y - 1] || LOGO[y - 1][x] === '.') || LOGO[y][x - 1] === '.') ? 'H' : ch));

/* the mark takes its colour from the theme it sits in: markA at the crown down to markB at the foot */
const logoRgb = (ch, y) => {
  const t = Math.min(1, Math.max(0, y / 15)), base = mix(PAL.markA, PAL.markB, t);
  return ch === 'G' ? base
    : ch === 'H' ? mix(base, [255, 255, 255], 0.55)          // the lit face of the M
      : ch === 'L' ? mix(PAL.markA, [255, 255, 255], 0.72)   // the crown's lights
        : null;                                              // empty = transparent
};

/* the mark as cells */
function logoCells() {
  const out = [];
  for (let y = 0; y < LOGO_PIX.length; y += 2) {
    const row = [];
    for (let x = 0; x < 14; x++) {
      const t = LOGO_PIX[y][x] || '.', b = (LOGO_PIX[y + 1] || '')[x] || '.';
      const ct = t === '.' ? null : logoRgb(t, y), cb = b === '.' ? null : logoRgb(b, y + 1);
      if (!ct && !cb) row.push(null);
      else if (!ct) row.push({ ch: '▄', fg: cb });
      else if (!cb) row.push({ ch: '▀', fg: ct });
      else if (t === b) row.push({ ch: '█', fg: ct });
      else row.push({ ch: '▀', fg: ct, bg: cb });
    }
    out.push(row);
  }
  return out;
}
const renderRow = row => row.map(c => !c ? ' '
  : (c.bg ? bgc(c.bg) : '') + (c.fg ? fg(c.fg) : '') + (c.bold ? BOLD : '') + c.ch + R).join('');
function logoRows() { return logoCells().map(renderRow); }

/* ---------- the mark, in a card of its own, above the conversation ---------- */
const putCells = (g, y, x, row) => { for (let i = 0; i < row.length; i++) { const gx = x + i; if (y >= 0 && y < g.length && gx >= 0 && gx < g[y].length && row[i]) g[y][gx] = row[i]; } };
function logoCardRows(w) {
  const mark = logoCells();
  /* centred on the pixels that are actually there, not on the sprite's empty margins, so the mark sits dead centre
     in the card whatever the theme's letter shapes are */
  let x0 = Infinity, x1 = -1, y0 = Infinity, y1 = -1;
  mark.forEach((row, y) => row.forEach((c, x) => { if (c) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); } }));
  if (x1 < 0) return Array.from({ length: 8 }, () => new Array(w).fill(null));
  const artW = x1 - x0 + 1, artH = y1 - y0 + 1;
  const rows = Array.from({ length: Math.max(8, artH) }, () => new Array(w).fill(null));
  const mx = Math.max(0, Math.floor((w - artW) / 2) - x0);
  const my = Math.max(0, Math.floor((rows.length - artH) / 2) - y0);
  for (let y = 0; y < mark.length; y++) for (let x = 0; x < mark[y].length; x++) {
    const c = mark[y][x]; if (!c) continue;
    const gy = y + my, gx = x + mx;
    if (gy >= 0 && gy < rows.length && gx >= 0 && gx < w) rows[gy][gx] = c;
  }
  return rows;
}

/* MS_FORCE_TTY draws the full screen even when the output is piped: it is how the window is tested without a window */
const TTY = (!!process.stdout.isTTY || process.env.MS_FORCE_TTY === '1') && !process.env.NO_COLOR;
/* mouse reports (clicks, drags, wheel) in SGR form, so the wheel scrolls the conversation instead of arriving as arrow
   keys; and the cursor as a steady thin bar, which the screen blinks itself */
const MOUSE_ON = '\u001b[?1000h\u001b[?1002h\u001b[?1006h\u001b[6 q', MOUSE_OFF = '\u001b[?1006l\u001b[?1002l\u001b[?1000l\u001b[0 q';
let FIXED = null;   // --width/--height, so a test frame is the same size every time
let TR_H = 30;      // the rows the conversation has, set by frame() before any block is laid out
let MODELS = [];    // the models this PC has: /model lists them, and the picture of the list is drawn from here
const R = '\u001b[0m', BOLD = '\u001b[1m', DIMTXT = '\u001b[2m';
const xterm = rgb => {   // the nearest colour of the 256-colour palette, for terminals without true color
  const q = v => v < 48 ? 0 : v < 115 ? 1 : Math.round((v - 35) / 40);
  return 16 + 36 * q(rgb[0]) + 6 * q(rgb[1]) + q(rgb[2]);
};
const fg = rgb => TTY ? (COLOR === 24 ? '\u001b[38;2;' + rgb.join(';') + 'm' : '\u001b[38;5;' + xterm(rgb) + 'm') : '';
const bgc = rgb => TTY ? (COLOR === 24 ? '\u001b[48;2;' + rgb.join(';') + 'm' : '\u001b[48;5;' + xterm(rgb) + 'm') : '';
let COLOR = 24;
const paint$ = (rgb, s) => fg(rgb) + s + R;
const text = s => paint$(PAL.text, s), mute = s => paint$(PAL.mute, s), dim = s => paint$(PAL.dim, s);
const acc = s => paint$(PAL.acc, s), acc2 = s => paint$(PAL.acc2, s), okc = s => paint$(PAL.ok, s), bad = s => paint$(PAL.bad, s), warn = s => paint$(PAL.warn, s);
/* the three voices, each in the theme's own colour: you, the answer, and the working-out */
const youc = s => paint$(PAL.you, s), agentc = s => paint$(PAL.agent, s), thinkc = s => paint$(PAL.think, s);
/* the same moving light that runs along the line you type on, laid across the conversation itself: two colours of the
   theme, with the bright part of the wave travelling through the words. It is stepped into a few shades so the
   terminal is not asked for a new colour on every single letter, and it settles to the voice's one colour when the
   glow is switched off with /anim off.                                                                          */
function waveText(s, a, b, step) {
  const str = String(s == null ? '' : s);
  if (!UI.anim) return paint$(a, str);
  const phase = (Date.now() - APP_STARTED) / 260 + (+step || 0);
  let out = '';
  [...str].forEach((ch, i) => {
    const t = Math.round(((Math.sin(i * 0.3 - phase) + 1) / 2) * 8) / 8;
    out += fg([0, 1, 2].map(k => Math.round(a[k] + (b[k] - a[k]) * t))) + ch;
  });
  return out + R;
}
const youWave = (s, step) => waveText(s, PAL.you, PAL.acc2, step);
const agentWave = (s, step) => waveText(s, PAL.agent, PAL.acc, step);
const thinkWave = (s, step) => waveText(s, PAL.think, PAL.dim, step);

/* ---------- width: what the screen actually shows, so every row ends in the same column ---------- */
const plain = s => String(s == null ? '' : s).replace(/\u001b\[[0-9;]*m/g, '');
const wide = cp => cp >= 0x1100 && (cp <= 0x115f || (cp >= 0x2e80 && cp <= 0xa4cf) || (cp >= 0xac00 && cp <= 0xd7a3) || (cp >= 0xf900 && cp <= 0xfaff) || (cp >= 0xfe30 && cp <= 0xfe6f) || (cp >= 0xff00 && cp <= 0xff60) || (cp >= 0x1f300 && cp <= 0x1faff) || (cp >= 0x20000 && cp <= 0x3fffd)) ? 2 : 1;
const sw = s => { let n = 0; for (const ch of plain(s)) n += wide(ch.codePointAt(0)); return n; };
const spaces = n => ' '.repeat(Math.max(0, n));
/* cut to a width, keeping the colours that came before it and closing them properly */
function clip(s, w) {
  if (sw(s) <= w) return s;        // it fits: nothing to cut, and no stray ellipsis at the end
  let out = '', n = 0, i = 0;
  while (i < s.length) {
    const m = /^\u001b\[[0-9;]*m/.exec(s.slice(i));
    if (m) { out += m[0]; i += m[0].length; continue; }
    const ch = String.fromCodePoint(s.codePointAt(i)), cw = wide(ch.codePointAt(0));
    if (n + cw > w - 1) { return out + '…' + R; }
    out += ch; n += cw; i += ch.length;
  }
  return out;
}
const padTo = (s, w) => sw(s) > w ? clip(s, w) : s + spaces(w - sw(s));
const padStart = (s, w) => sw(s) > w ? clip(s, w) : spaces(w - sw(s)) + s;
const grad = (s, a, b) => {
  const chars = [...s], n = Math.max(1, chars.length - 1);
  return chars.map((ch, i) => {
    const t = i / n, rgb = [0, 1, 2].map(k => Math.round(a[k] + (b[k] - a[k]) * t));
    return fg(rgb) + BOLD + ch;
  }).join('') + R;
};
/* the caret: a thin vertical bar like a normal terminal cursor */
  function caretCell(ch) { return fg(PAL.acc) + (ch || '│') + R; }
/* the line you type on: the light runs along the words, and the caret sits on the letter it is in front of */
function caretLine(chars, start, at, phase, blink) {
  const out = [], a = PAL.acc2, b = PAL.acc, n = chars.length - start;
  for (let i = 0; i < n; i++) {
    const ch = chars[start + i];
    if (i === at && blink) { out.push(caretCell(ch)); continue; }
    if (!UI.anim) { out.push(text(ch)); continue; }
    const t = (Math.sin(i * 0.34 - phase) + 1) / 2;
    out.push(fg([0, 1, 2].map(k => Math.round(a[k] + (b[k] - a[k]) * t))) + ch + R);
  }
  if (at >= n && blink) out.push(caretCell(' '));           // past the last letter: the caret on its own
  return out.join('');
}
/* word wrap that never breaks a word unless it has to, and keeps blank lines */
function wrap(s, w) {
  w = Math.max(8, w);
  const out = [];
  for (const raw of String(s == null ? '' : s).replace(/\r/g, '').replace(/\t/g, '    ').split('\n')) {
    const line = raw.replace(/\u001b\[[0-9;]*m/g, '');
    if (!line.trim()) { out.push(''); continue; }
    let cur = '';
    for (const word of line.split(/(\s+)/)) {
      if (!word) continue;
      if (sw(cur) + sw(word) <= w) { cur += word; continue; }
      if (cur.trim()) { out.push(cur.replace(/\s+$/, '')); cur = ''; }
      if (sw(word) > w) {               // one long word: cut it
        let piece = '';
        for (const ch of word) { if (sw(piece + ch) > w) { out.push(piece); piece = ''; } piece += ch; }
        cur = piece;
      } else cur = word.replace(/^\s+/, '');
    }
    if (cur.trim()) out.push(cur.replace(/\s+$/, ''));
  }
  return out;
}

/* ---------- arguments ---------- */
function argsOf(argv) {
  const o = { model: '', agent: '', ctx: 0, dir: '', guard: false, free: false, app: false, help: false, demo: false, pick: false, w: 0, h: 0, mode: '' };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i], next = () => String(argv[++i] == null ? '' : argv[i]);
    if (a === '--model') o.model = next();
    else if (a === '--agent') o.agent = next();
    else if (a === '--ctx') o.ctx = +next() || 0;
    else if (a === '--dir') o.dir = next();
    else if (a === '--guard') o.guard = true;
    else if (a === '--free') o.free = true;
    else if (a === '--app') o.app = true;
    else if (a === '--pick') o.pick = true;
    else if (a === '--chat') o.mode = 'chat';
    else if (a === '--code') o.mode = 'code';
    else if (a === '--demo') o.demo = true;
    else if (a === '--width') o.w = +next() || 0;
    else if (a === '--height') o.h = +next() || 0;
    else if (a === '-h' || a === '--help') o.help = true;
  }
  return o;
}
const HELP = [
  '',
  '  ' + BOLD + NAME + ' — the coding agent built into Moundshroud, in a terminal' + R,
  '',
  '  ' + DIMTXT + 'Usage' + R + '  mcode [options]        ' + DIMTXT + '(or: node lib/moundshroud-code.js [options])' + R,
  '',
  '    --model NAME     the model in Ollama to drive it (default: the one you used last)',
  '    --dir PATH       the folder it works in (default: the folder you started it in)',
  '    --guard          let it read anywhere on this PC (it still cannot write to Windows or this app)',
  '    --ctx N          memory size in tokens (default: 32768)',
  '    --free           use the free frontier AI instead of a model on this PC',
  '    --code           start in code mode, the agent with its tools (it opens in chat otherwise)',
  '    --chat           start in chat mode (the default: it talks, it changes nothing)',
  '    --demo           draw one sample screen and exit',
  '',
  '  ' + DIMTXT + 'Inside' + R,
      '    /model            pick a model with the arrow keys, Enter to switch',
    '    /model 2          or name it: /model 2 — /model qwen, /model gemma',
    '    /scan  /import N  find every AI model file on this PC; bring one into Ollama',
    '    /find WORDS       search the project by meaning with an embedding model',
  '    /chat  /code      talk only, or the full agent with tools',
  '    /autonomy X       how strictly it asks: careful, normal or auto (the AI can ask too)',
  '    /pull user/repo   take one GGUF model from Hugging Face (add :Q4_K_M, or :smallest)',
  '    /net  /reach      internet access, and how much of the PC it may touch',
  '    /theme            the colours · /theme ocean · /color accent #ff8800 · /anim off',
    '    /scene            choose peace or tragedy, pause the picture, or turn it off',
      '    /new  /stop  /dir  /reach  /help  /quit  /bye   Ctrl+C stops a turn',
  '',
].join('\n');

/* ---------- the pieces a conversation is made of ---------- */
let CWD = '';   // the session folder, so long paths can be shown as .\\file instead of the whole drive
const rel = s => {
  const t = String(s == null ? '' : s);
  if (!CWD) return t;
  try {
    const parts = CWD.replace(/[\\/]+$/, '').split(/[\\/]/)
      .map(p => p.replace(/[.*+?^${}()|[\]\\]/g, c => '\\' + c));
    return t.replace(new RegExp(parts.join('[\\\\/]') + '[\\\\/]', 'i'), '.\\');
  } catch (e) { return t; }
};
/* a line of an answer: **bold** keeps its weight, `code` is set brighter, and the whole line carries the colour of the
   voice that said it — the answer has one colour, the thinking has another, and you have your own */
function inline(line, paint) {
  const p = paint || text;
  return String(line).split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map(part => {
    if (/^\*\*[^*]+\*\*$/.test(part)) return BOLD + p(part.slice(2, -2)) + R;
    if (/^`[^`]+`$/.test(part)) return BOLD + p(part.slice(1, -1)) + R;
    return p(part.replace(/\*\*/g, ''));
  }).join('');
}
/* ---------- what it is doing, said as it is doing it ----------
   The status line does not say "working" through all of it: while a thought is being hashed out it says so, while a
   file is open it says it is reading, while a command is out it says so, while words are arriving it says it is
   writing. Each of those has a handful of ways of putting it, and the line changes wording every couple of seconds
   so a long turn does not read as one frozen word.                                                              */
const VERB = {
  thinking: ['thinking…', 'mulling it over', 'working it out', 'turning it over', 'chewing on it', 'following a thought',
    'reasoning it through', 'pondering', 'cogitating', 'taking a moment', 'scratching its head', 'staring at the ceiling',
    'consulting the void', 'letting it marinate', 'connecting the dots', 'having a brain moment', 'buffing its neurons',
    'defragging its thoughts', 'going hmmmm', 'rotating the problem', 'sleeping on it (awake)'],
  writing: ['writing', 'drafting', 'putting it into words', 'composing', 'setting it down', 'wording it',
    'typing it out', 'laying out the answer', 'finding the phrasing', 'spinning prose', 'knitting sentences',
    'painting with words', 'sculpting the reply', 'tapping the keys', 'whispering to the screen',
    'translating thoughts to text', 'weaving the answer', 'crafting the comeback', 'ink to paper (digital)'],
  reading: ['reading', 'reading through', 'scanning the file', 'looking it over', 'going through it', 'leafing through',
    'checking what is there', 'speed-reading the code', 'absorbing the context', 'eyes on the page',
    'drinking in the file', 'parsing the prose', 'digesting the diff', 'skimming with purpose'],
  listing: ['looking around', 'listing the folder', 'seeing what is there', 'taking stock', 'inventory time',
    'peeking in the drawer', 'scanning the shelves', 'cataloguing the chaos', 'finding the lay of the land'],
  finding: ['searching', 'hunting for it', 'looking for it', 'sifting through', 'tracking it down', 'sweeping the files',
    'playing hide and seek', 'following the breadcrumbs', 'detective mode activated', 'grep in the wild',
    'needle in the haystack', 'x marks the spot', 'scouring the codebase'],
  running: ['running a command', 'driving the shell', 'trying it out', 'executing', 'putting it through', 'raining the check',
    'firing the terminal', 'unleashing the command', 'letting it rip', 'shell therapy', 'command & conquer',
    'bashing it out', 'terminal velocity', 'running the gauntlet'],
  editing: ['editing', 'making the change', 'patching the file', 'rewriting it', 'shaping the code', 'splicing it in',
    'surgical precision', 'refactoring with feeling', 'nipping and tucking', 'code massage',
    'tweaking the gears', 'polishing the rough edges', 'stitching it together', 'refinement in progress'],
  creating: ['writing the file', 'making the file', 'setting it out', 'laying it down', 'putting it on disk',
    'birthing a file', 'conjuring from nothing', 'manifesting the code', 'blank slate → masterpiece',
    'file genesis', 'disk gets a new friend', 'writing it into existence'],
  removing: ['removing it', 'deleting the file', 'clearing it out', 'taking it away', 'sending it to the void',
    'poof, gone', 'digital shredder', 'marie kondo-ing the codebase', 'clean slate operation', 'deletion accomplished'],
  moving: ['moving it', 'putting it in place', 'organising the files', 'renaming it', 'shuffling the deck',
    'tetris with files', 'finding it a home', 'rearranging the furniture', 'everything in its right place'],
  web: ['reading the web', 'looking it up', 'fetching the page', 'checking online', 'going to the source',
    'surfing for answers', 'consulting the oracle', 'googling like a pro', 'web reconnaissance', 'fetching wisdom'],
  planning: ['planning', 'lining up the steps', 'setting the order', 'laying out the work', 'architecting the approach',
    'drawing the map', 'blueprint mode', 'strategizing', 'chess moves ahead', 'plotting the course', 'scheme hatching'],
  deciding: ['thinking', 'deciding what is next', 'choosing the next move', 'working out what to do', 'weighing options',
    'flipping a mental coin', 'consulting the magic 8-ball', 'at a crossroads', 'picking a lane', 'decision time'],
  interrupted: ['interrupted', 'cut short', 'halted mid-thought', 'pulled the brake', 'emergency stop', 'whoa there',
    'paused by human', 'thought derailed', 'stream cut', 'aborted mission'],
};
const TOOL_FAMILY = {
  read_file: 'reading', list_files: 'listing', file_info: 'reading', find_files: 'finding', search_files: 'finding',
  write_file: 'creating', edit_file: 'editing', multi_edit: 'editing', make_dir: 'creating',
  delete_file: 'removing', move_file: 'moving', run_command: 'running', web_fetch: 'web',
  update_plan: 'planning', set_autonomy: 'deciding',
  /* craft_anything is intentionally omitted — only runs when you explicitly type the command */
};
function doingIt(s) {                                // chosen from what is actually happening, not from "busy"
  const d = (s && s.doing) || {};
  const fam = d.what === 'tool' ? (TOOL_FAMILY[d.name] || 'deciding') : d.what === 'writing' ? 'writing' : d.what === 'thinking' ? 'thinking' : d.what === 'interrupted' ? 'interrupted' : 'deciding';
  const list = VERB[fam] || VERB.deciding;
  /* one phrase every six seconds: the line reads like a person thinking, not a slot machine */
  return list[Math.floor(Date.now() / 6000 + (s && s.verbSeed || 0)) % list.length];
}
const TOOL_WORD = {
  craft_anything: 'CRAFT ANYTHING',
  read_file: 'READ FILE', write_file: 'WRITE FILE', edit_file: 'EDIT FILE', multi_edit: 'EDIT SEVERAL', delete_file: 'DELETE FILE',
  move_file: 'MOVE', make_dir: 'MAKE FOLDER', list_files: 'LIST FILES', find_files: 'FIND FILES', file_info: 'FILE INFO',
  search_files: 'SEARCH', run_command: 'RUN', web_fetch: 'READ THE WEB', update_plan: 'PLAN', set_autonomy: 'AUTONOMY',
};
function toolTarget(a) {
  a = a || {};
  if (a.command) return String(a.command);
  if (a.path) return String(a.path);
  if (a.level) return String(a.level);
  if (a.pattern) return '/' + a.pattern + '/';
  return '';
}
const mb = n => hf.mb(n);
/* an answer unfolds as it arrives: the words come in a little at a time, with a mark where it is still writing */
function shown(b) {
  const full = String(b.text || '');
  if (!UI.anim || !b.born || full.includes('```')) return full;
  const total = Math.min(1100, 140 + [...full].length * 4);
  const ms = Date.now() - b.born;
  if (ms >= total) return full;
  const n = Math.max(1, Math.round([...full].length * (ms / total)));
  let cut = [...full].slice(0, n).join('');
  /* a half-typed marker would show as stars or a stray backtick, so it waits */
  if ((cut.match(/`/g) || []).length % 2) cut = cut.replace(/`[^`]*$/, '');
  if ((cut.match(/\*\*/g) || []).length % 2) cut = cut.replace(/\*\*[^*]*$/, '');
  return cut;
}
/* a code fence inside an answer becomes a small panel, so code reads as code */
function agentLines(body, w, tail, paint) {
  const p = paint || text;
  const out = [], chunks = String(body || '').split(/(```[\s\S]*?```)/);
  for (const chunk of chunks) {
    if (!chunk) continue;
    const fence = /^```([\w+-]*)\n?([\s\S]*?)```$/.exec(chunk);
    if (fence) {
      const code = fence[2].replace(/\n$/, '').split('\n');
      const width = Math.min(Math.max(...code.map(l => sw(l)), 10) + 4, Math.max(14, w));
      const label = fence[1] || 'code';
      out.push('     ' + dim('╭─ ') + dim(label) + dim(' ' + '─'.repeat(Math.max(0, width - sw(label) - 2)) + '╮'));
      for (const l of code) out.push('     ' + dim('│ ') + p(clip(l, width - 2)) + dim(' '.repeat(Math.max(0, width - 2 - sw(l))) + ' │'));
      out.push('     ' + dim('╰' + '─'.repeat(width) + '╯'));
    } else {
      for (const l of wrap(chunk.replace(/^\n+|\n+$/g, ''), w)) out.push('     ' + inline(l, p));
    }
  }
  if (tail && out.length && sw(out[out.length - 1]) + sw(tail) <= w) out[out.length - 1] += acc2(tail);
  return out;
}
/* one block of the transcript, as rows */
function blockRows(b, w) {
  const out = [];
  const label = (glyph, colour, name, extra, namePaint) => '  ' + colour(glyph) + '  ' + (namePaint || dim)(name) + (extra ? '  ' + extra : '');
  if (b.kind === 'welcome') {
    /* the mark, in a card of its own, with the conversation beneath it */
    const cardW = 22, cpad = spaces(Math.max(2, Math.floor((w - cardW - 4) / 2)));
    const edge = s => fg(mix(PAL.acc, PAL.panel, 0.45)) + s + R;      // the card's frame belongs to the theme too
    out.push('');
    out.push(cpad + edge('╭' + '─'.repeat(cardW + 2) + '╮'));
    for (const l of logoCardRows(cardW)) out.push(cpad + edge('│ ') + renderRow(l) + edge(' │'));
    out.push(cpad + edge('╰' + '─'.repeat(cardW + 2) + '╯'));
    out.push('');
    const tail = w < 76 ? '/help' : 'type below to begin';
    const caption = acc2('MOUNDSHROUD CODE') + dim('  ·  ') + mute(tagline()) + dim('  ·  ') + dim(tail);
    out.push('');
    out.push(spaces(Math.max(2, Math.floor((w - sw(caption)) / 2))) + clip(caption, w - 4));
  } else if (b.kind === 'user') {
    out.push('', label('◆', youc, 'YOU', '', youc));
    for (const l of wrap(b.text, w - 6)) out.push('     ' + youWave(l));
  } else if (b.kind === 'agent') {
    const body = b.partial ? String(b.text || '') : shown(b);
    const live = b.partial || body.length < String(b.text || '').length;
    out.push('', label('◈', agentc, 'MOUNDSHROUD', live ? agentc(b.partial ? 'writing…' : 'unfolding…') : '', agentc));
    const caret = live ? (Math.floor(Date.now() / 400) % 2 ? '▌' : ' ') : '';
    out.push(...agentLines(body, w - 6, caret, agentWave));
  } else if (b.kind === 'thought') {
    if (!UI.think) return out;                                // the switch is off: none of it is shown at all
    const all = wrap(String(b.text || ''), Math.max(24, w - 6));
    const body = all.slice(0, b.partial ? 5 : 14);
    out.push('', label('⋯', thinkc, 'THINKING', b.partial ? thinkc('working it out…') : (all.length > 14 ? thinkc('the first 14 lines') : ''), thinkc));
    for (const l of body) out.push('     ' + thinkWave(l));
    if (body.length < all.length) out.push('     ' + dim('…'));
  } else if (b.kind === 'tool') {
    out.push('', label('⚙', acc, TOOL_WORD[b.name] || String(b.name || 'TOOL').toUpperCase(), dim(clip(rel(toolTarget(b.input)), Math.max(20, w - 26)))));
  } else if (b.kind === 'result') {
    const body = rel(String(b.text || '(no output)')).replace(/\r/g, '').split('\n').filter((l, i, a) => l.trim() || (i && i < a.length - 1)).slice(0, b.isError ? 6 : 5);
    out.push('     ' + (b.isError ? bad('✗ ') + bad(clip(body[0] || 'failed', w - 8)) : okc('✓ ') + dim(clip(body[0] || 'done', w - 8))));
    for (const l of body.slice(1)) out.push('       ' + dim(clip(l, w - 9)));
    const rest = String(b.text || '').replace(/\r/g, '').split('\n').length - body.length;
    if (rest > 0) out.push('       ' + dim('… ' + rest + ' more lines'));
  } else if (b.kind === 'answer') {
    out.push('     ' + (b.allow ? okc('✓ allowed') : bad('✗ refused')) + (b.late ? dim('  (the question expired)') : ''));
  } else if (b.kind === 'stats') {
    out.push('', label('▤', acc2, 'USAGE', dim(b.text || '')));
    for (const r of (b.rows || [])) {
      if (r.h) { out.push('     ' + dim('─ ' + r.h + ' ' + '─'.repeat(Math.max(2, Math.min(44, (w - 12) - r.h.length - 2))))); continue; }
      out.push('     ' + mute(padTo(String(r[0] || ''), 9)) + ' ' + (r.dim ? dim(String(r[1])) : text(String(r[1]))));
    }
  } else if (b.kind === 'note') {
    out.push('     ' + dim('─ ' + String(b.text || '') + ' ─'));
  } else if (b.kind === 'plan') {
    const steps = b.steps || [];
    out.push('', label('☰', acc, 'PLAN', dim(steps.length ? steps.filter(s => s.done).length + ' of ' + steps.length : 'cleared')));
    for (const s of steps) out.push('     ' + (s.done ? okc('✓ ') : dim('○ ')) + text(clip(String(s.text || ''), w - 9)));
  } else if (b.kind === 'model') {
    const on = String(b.text || '').startsWith('▸');
    out.push(String(b.text || '').startsWith('   ') ? '     ' + dim(b.text) : '     ' + (on ? acc2(b.text) : text(b.text)));
  } else if (b.kind === 'error') {
    out.push('', '  ' + bad('!') + '  ' + bad(clip(String(b.text || 'The turn ended with an error.'), w - 8)));
  }
  return out;
}
/* a panel with a title, used for approvals and for the goodbye card */
function panel(title, body, w, colour) {
  const inner = Math.max(20, Math.min(w - 10, 66));          // the box is inner + 6 wide, borders included
  const dashes = Math.max(0, inner - 1 - sw(title));
  const rows = ['  ' + colour('╭─ ') + colour(title) + colour(' ' + '─'.repeat(dashes) + '╮')];
  for (const l of body) rows.push('  ' + colour('│ ') + padTo(l, inner) + colour(' │'));
  rows.push('  ' + colour('╰' + '─'.repeat(inner + 2) + '╯'));
  return rows;
}

/* ---------- the background: a night ride behind the conversation ----------
   Painted into the cells the transcript sits on: a pine wood in thin rain, a dirt road with lanterns standing along
   it, and the chase crossing it — the horseman closes on Ichabod, throws the pumpkin, and Ichabod goes over the
   side. Every part of it is worked out from the clock alone, with no timers and no state of its own, and the whole
   painting is wrapped by the caller: if anything in it ever fails, the conversation is drawn exactly as before.
   The light is the point: every lantern, and the pumpkin itself, warms the cells around it, so the road keeps a wet
   glow and the pine edges catch the flame.                                                                        */
let SCENE_T0 = Date.now();                     // moved forward while the ride is paused, so it carries on from where it was held
const NIGHT = {
  skyHigh: [10, 11, 24], skyMid: [24, 23, 48], skyLow: [72, 60, 108],
  star: [216, 220, 248], starDim: [100, 104, 150],
  moon: [248, 244, 220], moonHalo: [110, 106, 152],
  pineFar: [19, 17, 36], pineMid: [10, 9, 21], pineNear: [5, 5, 11],
  bark: [10, 9, 19],
  earth: [15, 13, 22], path: [40, 30, 24], pathDark: [23, 17, 14], pathWet: [66, 51, 40],
  rain: [132, 152, 204], rainFaint: [86, 102, 146], splash: [160, 178, 222],
  warm: [255, 156, 66], lantern: [255, 196, 108], lanternCore: [255, 242, 194],
  ink: [48, 39, 66], cloak: [33, 27, 48], dust: [74, 62, 96],
  pumpkin: [232, 118, 34], ember: [255, 196, 110],
};
const SCENE_CYCLE = 16;                        // seconds: a pass of the chase, then the road is empty again
let SCENE_PAUSED_AT = 0;                       // where the clock was stopped, when /scene pause holds the picture still
const sceneTime = () => {
  const forced = parseFloat(process.env.MS_SCENE_T || '');   // MS_SCENE_T freezes the picture, for checking one moment
  if (Number.isFinite(forced)) return forced;
  if (UI.scene === 'paused' && SCENE_PAUSED_AT) return SCENE_PAUSED_AT;
  return (Date.now() - SCENE_T0) / 1000;
};
const clamp01 = v => v < 0 ? 0 : v > 1 ? 1 : v;
const newGrid = (w, h) => Array.from({ length: h }, () => new Array(w).fill(null));
function putCell(g, x, y, ch, f, b) {
  if (y < 0 || y >= g.length) return;
  const row = g[y];
  if (!row || x < 0 || x >= row.length) return;
  const prev = row[x];
  row[x] = { ch, fg: f == null ? null : f, bg: b === undefined ? (prev ? prev.bg : null) : b };
}
/* Weather belongs in open air around a scene; it should not scribble over people, animals, or props. */
function putWeatherCell(g, x, y, ch, colour) {
  if (y < 0 || y >= g.length || !g[y] || x < 0 || x >= g[y].length) return false;
  const under = g[y][x];
  if (under && under.ch && under.ch !== ' ') return false;
  putCell(g, x, y, ch, colour);
  return true;
}
/* light falling on a cell that is already painted: it warms the ground under it and lifts the edge of a silhouette */
function blendCell(g, x, y, colour, t) {
  if (y < 0 || y >= g.length) return;
  const row = g[y];
  if (!row || x < 0 || x >= row.length) return;
  const c = row[x];
  if (!c || !(t > 0)) return;
  if (c.bg) c.bg = mix(c.bg, colour, clamp01(t));
  if (c.fg) c.fg = mix(c.fg, colour, clamp01(t * 0.75));
}
/* a lamp's reach: brightest at the flame, gone at the rim */
function lampLight(g, cx, cy, radius, strength, colour) {
  const r = Math.max(1, Math.round(radius));
  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      const d = Math.sqrt(dx * dx + dy * dy * 2.3);        // a cell is about twice as tall as it is wide
      if (d > r) continue;
      blendCell(g, cx + dx, cy + dy, colour || NIGHT.warm, Math.pow(1 - d / r, 2.1) * strength);
    }
  }
}
/* a sprite, and optionally a rim light: one cell of moonlight on the very top of each of its columns, which is what
   makes a black shape read as a solid thing standing in the night instead of a hole cut out of it */
function drawSprite(g, x, y, rows, colour, rim) {
  const tops = {};
  for (let r = 0; r < rows.length; r++) {
    const line = String(rows[r] == null ? '' : rows[r]);
    for (let c = 0; c < line.length; c++) {
      const ch = line[c];
      if (ch === ' ' || ch === '.') continue;
      if (tops[c] == null) tops[c] = r;
      putCell(g, x + c, y + r, ch, typeof colour === 'function' ? colour(ch, r, c) : colour);
    }
  }
  if (!rim) return;
  for (const c of Object.keys(tops)) putCell(g, x + (+c), y + tops[c] - 1, '▄', rim);
}
/* a halo traced round a whole silhouette, so a black shape on a dark picture still shows its outline */
function haloSprite(g, x, y, rows, colour, amount) {
  const on = new Set();
  for (let r = 0; r < rows.length; r++) {
    const line = String(rows[r] == null ? '' : rows[r]);
    for (let c = 0; c < line.length; c++) {
      const ch = line[c];
      if (ch === ' ' || ch === '.') continue;
      on.add((x + c) + ',' + (y + r));
    }
  }
  for (const key of on) {
    const [cx, cy] = key.split(',').map(Number);
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      if (on.has((cx + dx) + ',' + (cy + dy))) continue;
      blendCell(g, cx + dx, cy + dy, colour, amount * (dx && dy ? 0.6 : 1));
    }
  }
}
/* a whole treeline at once: a mass with a jagged, needled top edge, so it reads as a wood and not a fence */
function forestMass(g, w, hz, base, amp, colour, rim, seed, clock) {
  for (let x = 0; x < w; x++) {
    const sway = Math.sin(clock * 0.6 + x * 0.05 + seed) * 0.4;
    const needles = Math.abs(((x * 7 + seed * 3) % 9) - 4) * 0.45;     // a crown, not a sawtooth
    const y = Math.round(base + amp * Math.sin(x * 0.11 + seed)
      + amp * 0.55 * Math.sin(x * 0.41 + seed * 2.3) - needles + sway);
    const shade = ((x * 13 + seed) % 7) === 0 ? mix(colour, NIGHT.ink, 0.45) : colour;   // a seam between trees
    for (let yy = Math.max(0, y); yy < hz; yy++) putCell(g, x, yy, '█', shade);
    if (y >= 0 && y < hz && x % 3 !== 0) putCell(g, x, y, '▄', mix(colour, rim, 0.5));
  }
}
/* a pine: narrow, with the moon on its right edge and its tip */
function pine(g, x, bottom, hgt, fill, rim, narrow) {
  for (let i = 0; i < hgt; i++) {
    const y = bottom - i;
    const half = Math.round((hgt - 1 - i) * (narrow || 0.36));
    for (let dx = -half; dx <= half; dx++) {
      const edge = i === hgt - 1 || (i === 0 && dx === half);   // the tip, and the lit edge of its lowest bough
      putCell(g, x + dx, y, '█', edge ? rim : fill);
    }
  }
}

/* ---------- a starry night, painted with currents ----------
   The sky is not a gradient with dots on it: it is two slow whirlpools of light, banded like brush strokes, with the
   stars caught in the flow and a crescent moon at the edge of one of them. Every band is a function of the clock, so
   the whole sky turns and breathes; the strokes are drawn as ~ and ≈ so the movement reads even in a still frame.  */
const STAR_SKY = {
  night: {
    hi: [10, 16, 48], mid: [34, 44, 104], lo: [104, 82, 128],
    flowA: [96, 164, 220], flowB: [224, 200, 128], star: [238, 242, 255], gold: [255, 226, 148],
    moon: [255, 246, 210], halo: [148, 176, 224],
  },
  meadow: {
    hi: [26, 14, 58], mid: [74, 40, 112], lo: [168, 96, 116],
    flowA: [120, 206, 238], flowB: [255, 196, 118], star: [255, 250, 232], gold: [255, 214, 130],
    moon: [255, 246, 214], halo: [196, 164, 224],
  },
};
function starrySky(g, hz, clock, P) {
  const w = g[0].length;
  for (let y = 0; y < hz; y++) {
    const t = hz <= 1 ? 0 : y / (hz - 1);
    const col = t < 0.55 ? mix(P.hi, P.mid, t / 0.55) : mix(P.mid, P.lo, (t - 0.55) / 0.45);
    for (let x = 0; x < w; x++) g[y][x] = { ch: ' ', fg: null, bg: col };
  }
  /* two whirlpools; every cell takes its band from the angle round them and the distance out from them */
  const c1 = { x: w * 0.74, y: hz * 0.3 }, c2 = { x: w * 0.22, y: hz * 0.62 };
  for (let y = 0; y < hz; y++) {
    for (let x = 0; x < w; x++) {
      const d1 = Math.hypot(x - c1.x, (y - c1.y) * 1.9), d2 = Math.hypot(x - c2.x, (y - c2.y) * 1.9);
      const a1 = Math.atan2(y - c1.y, x - c1.x), a2 = Math.atan2(y - c2.y, x - c2.x);
      const spiral = Math.sin(a1 * 2 + d1 * 0.5 - clock * 1.1) * 0.6
        + Math.sin(a2 * 2 - d2 * 0.36 + clock * 0.75) * 0.4
        + Math.sin(x * 0.075 + y * 0.32 - clock * 0.9) * 0.35;
      const band = clamp01(spiral * 0.5 + 0.42);
      if (band > 0.7) {
        const t = (band - 0.7) / 0.3;
        putCell(g, x, y, t > 0.7 ? '≈' : '~', mix(P.flowA, P.flowB, t));
        blendCell(g, x, y, P.flowB, 0.12 * t);
      } else if (band > 0.5) {
        blendCell(g, x, y, P.flowA, 0.06 + (band - 0.5) * 0.2);
      }
      if (Math.hypot(x - c1.x, (y - c1.y) * 1.9) < 9) blendCell(g, x, y, P.halo, 0.07 * (1 - Math.hypot(x - c1.x, (y - c1.y) * 1.9) / 9));
    }
  }
  /* stars: some small and steady, a few big enough to have rings round them */
  for (let i = 0; i < Math.max(10, Math.round(w / 7)); i++) {
    const sx = (i * 37 + 9) % w, sy = 1 + ((i * 13 + 3) % Math.max(2, hz - 3));
    const tw = (Math.sin(clock * 1.7 + i * 2.3) + 1) / 2;
    const big = i % 4 === 0;
    putCell(g, sx, sy, big ? '✦' : i % 3 === 0 ? '*' : '·', mix(P.star, P.gold, 0.35 + tw * 0.5));
    if (big || tw > 0.75) {
      for (let r = 1; r <= (big ? 3 : 2); r++) {
        const a = 0.34 / r;
        blendCell(g, sx + r, sy, P.gold, a * (0.5 + tw * 0.5));
        blendCell(g, sx - r, sy, P.gold, a * (0.5 + tw * 0.5));
        blendCell(g, sx, sy + r, P.gold, a * 0.7);
        blendCell(g, sx, sy - r, P.gold, a * 0.7);
      }
    }
  }
  /* the crescent moon, hanging in the first whirlpool */
  const mx = Math.round(c1.x), my = Math.max(1, Math.round(c1.y) - 1);
  for (let dy = -3; dy <= 3; dy++) for (let dx = -4; dx <= 4; dx++) {
    const d = Math.sqrt(dx * dx + dy * dy * 1.7);
    if (d <= 4.2) blendCell(g, mx + dx, my + dy, P.halo, 0.26 * (1 - d / 4.4));
  }
  const CRESCENT = ['  ▄▄▄  ', ' ███   ', '███    ', '███    ', '███    ', ' ███   ', '  ▀▀▀  '];
  drawSprite(g, mx - 3, my - 3, CRESCENT, P.moon);
}

/* the horses and the two riders: silhouettes, but with a neck, a tail and a cloak to read them by */
/* the horse: an ear, a head, an arched neck, then the barrel of it */
/* ---- the horses and the riders ----
   Seen from the side and drawn large, so the shape says "a man on a horse" before you have read anything else: ears,
   head, neck, barrel, four legs and a tail on the horse; a hat, head, shoulders and a cloak on the rider.        */
const HORSE_BIG = [
  '                 ▄▄▄▄▄  ',
  '                ███████ ',
  '               ████████ ',
  '  ▄▄▄▄▄▄▄▄▄▄▄▄███████  ',
  ' ▄██████████████████    ',
  '█████████████████████   ',
  '▀████████████████████▀  ',
  '  ███  ███   ███  ███   ',
  '  ▀██   ▀██   ▀██  ▀██  ',
];
const HORSE_SMALL = [
  '            ▄▄▄ ',
  '          ▄█████',
  '      ▄▄███████',
  '  ▄██████████  ',
  '███████████████',
  '  ▀█▀  ▀█▀  ▀█ ',
];
/* Ichabod: a tricorn, a face under it, a cloak, and an arm out to the reins */
const ICHABOD_BIG = [
  '   ▄▄▄▄▄    ',
  '  ▄█████▄   ',
  ' ▄███████▄  ',
  '  ███████   ',
  ' ▄████████  ',
  '███████████ ',
  '████  █████ ',
];
/* the horseman: a high collar and broad shoulders, no head at all until the pumpkin is lifted off */
/* the horseman: a high collar and broad shoulders, and no head at all until the pumpkin is lifted off */
const HEADLESS_BIG = [
  '  ▄▄▄▄▄▄▄   ',
  ' █████████  ',
  '███████████ ',
  '███████████ ',
  '███████████ ',
  '████   ████ ',
  '███     ███ ',
];
const ICHABOD_RIDER = [
  '   ▄▄▄   ',
  '  ▄███▄  ',
  '  █████  ',
  ' ▄█████▄ ',
  '█████████',
  ' ███████ ',
  '  ██ ██  ',
];
const HEADLESS_RIDER = [
  ' ▄▄▄▄▄▄▄ ',
  '█████████',
  '█████████',
  ' ███████ ',
  ' ███████ ',
  '  █████  ',
  '  ██ ██  ',
];
const PUMPKIN = [' ▄▄▄ ', '▄███▄', ' ▀▀▀ '];
const PUMPKIN_BIG = [' ▄▄▄▄▄▄▄ ', '▄███████▄', '█████████', ' ▀█████▀ '];
const FALL_A = ['  ▄██▄  ', ' ██████ ', ' ██████ ', '  ███   ', ' ██ ██  '];
const FALL_B = [' ██ ██  ', '  ████  ', ' ██████ ', '  ███   ', ' █   █  '];
const FALL_LAND = ['    ▄▄▄▄▄▄    ', '  ▄████████▄  ', ' ██ ██  ██ ██ ', '  ▀  ▀  ▀  ▀  '];

function sleepyHollow(w, h, rain) {
  const g = newGrid(w, h);
  const still = UI.scene === 'paused';
  const clock = still ? 0 : sceneTime();
  const hz = Math.max(6, h - 4);                 // the far edge of the road: the wood stands behind it

  /* a starry night for the ride: currents of light over the wood, and the moon caught in one of them */
  starrySky(g, hz, clock, STAR_SKY.night);

  /* the wood: two masses, the far one lighter, with taller pines standing out of them */
  forestMass(g, w, hz, hz - 6.5, 1.7, NIGHT.pineFar, mix(NIGHT.pineFar, NIGHT.skyLow, 0.22), 3, clock);
  forestMass(g, w, hz, hz - 4.2, 1.2, NIGHT.pineMid, mix(NIGHT.pineMid, NIGHT.skyLow, 0.16), 11, clock);
  for (let x = 5; x < w; x += 11) {
    const i = (x / 11) | 0;
    pine(g, x + ((i * 17) % 5) - 2, hz - 1, 5 + ((i * 7) % 4), NIGHT.pineMid, mix(NIGHT.pineMid, NIGHT.moon, 0.14));
  }
  /* the moon's haze lying on the near edge of the wood, which is what the riders are black against */
  for (let y = Math.max(0, hz - 9); y < hz - 1; y++) {
    const t = (y - (hz - 9)) / 8;
    for (let x = 0; x < w; x++) blendCell(g, x, y, NIGHT.moonHalo, 0.17 * t * (0.85 + 0.15 * Math.sin(x * 0.24 + clock * 0.4)));
  }

  /* the road they are on: packed dirt, stones, and a wet sheen where the rain has settled */
  for (let y = hz; y < h; y++) {
    const nearRow = y - hz;
    const base = nearRow === 0 ? NIGHT.path : nearRow === 1 ? mix(NIGHT.path, NIGHT.pathDark, 0.35) : NIGHT.earth;
    for (let x = 0; x < w; x++) {
      let col = base;
      const n = (x * 17 + y * 29 + ((x * y) % 7)) % 23;
      if (n === 0) col = mix(base, NIGHT.pathDark, 0.55);
      else if (n === 5) col = mix(base, NIGHT.pathWet, 0.35);
      else if (n === 11) col = mix(base, NIGHT.pathDark, 0.22);
      g[y][x] = { ch: ' ', fg: null, bg: col };
    }
  }
  /* puddles, which will hold whatever light falls on them */
  for (let i = 0; i < Math.max(2, Math.round(w / 26)); i++) {
    const px = (i * 41 + 13) % w, py = hz + 1 + (i % 2);
    for (let k = -2; k <= 2; k++) blendCell(g, px + k, py, NIGHT.pathWet, 0.45 - Math.abs(k) * 0.07);
  }

  /* lanterns standing along the road, each on its own post */
  const posts = [{ x: 11, phase: 0 }, { x: w - 16, phase: 1.7 }];
  for (const p of posts) {
    for (let k = 0; k < 4; k++) putCell(g, p.x, hz - 1 - k, '│', NIGHT.bark);
    putCell(g, p.x, hz - 5, '▄', NIGHT.bark);
    putCell(g, p.x + 1, hz - 5, '▄', NIGHT.bark);
    putCell(g, p.x + 1, hz - 4, '█', NIGHT.lanternCore);
  }
  if (still) {
    for (const p of posts) lampLight(g, p.x + 1, hz - 4, 6.5, 0.5);
    for (const x of [3, w - 4]) {
      pine(g, x, h - 1, Math.min(16, h - 1), mix(NIGHT.pineNear, NIGHT.pineMid, 0.5), mix(NIGHT.pineNear, NIGHT.moon, 0.26), 0.2);
    }
    return g;
  }

  /* ---- the chase ----
     Big silhouettes, lit along their tops so they stand out of the wood: a horse you can read as a horse (ears, head,
     neck, barrel, four legs, tail) with a rider on its back. Ichabod wears a tricorn and a cloak and carries a
     lantern; the horseman has no head at all but a jack-o'-lantern sitting on his shoulders, which he reaches up for,
     lifts off in one hand, and throws. The reach, the lift and the follow-through are all drawn out in time.       */
  const u = ((clock % SCENE_CYCLE) + SCENE_CYCLE) % SCENE_CYCLE;
  const wetRide = rain !== false;
  if (!wetRide) quietRide(g, w, hz, clock);
  const THROW = 8.4, FLY = 1.3, IMPACT = THROW + FLY, LIFT = THROW - 1.5, REACH = LIFT - 0.9;
  const span = w + 56;
  const at = s => Math.round(-22 + (s / SCENE_CYCLE) * span);
  const ichX = at(u);
  /* the horseman is a good way back down the road: far enough that the throw has to cross the gap, not lean across it */
  const hmAt = s => at(s) - (24 + Math.round(Math.sin(s * 1.15) * 2));
  const hmX = hmAt(u);
  const step = Math.floor(clock * 9) % 2;
  const bob = step ? 0 : -1;
  const big = hz >= 18;
  const horseTop = hz - (big ? 9 : 6) + bob;
  const riderTop = horseTop - (big ? 2 : 1);
  const seat = big ? 3 : 2;
  const S = big
    ? { horse: HORSE_BIG, ich: ICHABOD_BIG, head: HEADLESS_BIG, pump: PUMPKIN_BIG, pumpX: 3, pumpY: 4, hand: 8 }
    : { horse: HORSE_SMALL, ich: ICHABOD_RIDER, head: HEADLESS_RIDER, pump: PUMPKIN, pumpX: 2, pumpY: 2, hand: 4 };
  const rim = mix(NIGHT.moon, NIGHT.moonHalo, 0.3);
  const body = [7, 6, 14], cape = [12, 10, 22];       // true black, so the shape is the darkest thing in the picture        // the moonlight along the top of every silhouette
  const onScreen = x => x > -22 && x < w + 10;

  const horse = x => {
    drawSprite(g, x, horseTop, S.horse, body, rim);
    haloSprite(g, x, horseTop, S.horse, rim, 0.28);
    /* the tail, swinging behind */
    const sway = Math.sin(clock * 8) > 0 ? 0 : 1;
    putCell(g, x - 1, horseTop + (big ? 4 : 3), '▄', body);
    putCell(g, x - 2, horseTop + (big ? 5 : 3) + sway, '▄', body);
    putCell(g, x - 1, horseTop + (big ? 6 : 4) + sway, '▄', body);
  };
  /* a moonlit clearing across the whole road: the wood and the mist behind them go pale, so the riders are cut out
     of it in black and every leg and ear of the horse reads. It breathes in time with the ride.                   */
  const backlight = () => {
    const mid = horseTop - 1, half = big ? 11 : 8;
    for (let y = mid - half; y <= mid + half; y++) {
      const f = 1 - Math.abs(y - mid) / half;
      if (f <= 0) continue;
      for (let x = 0; x < w; x++) blendCell(g, x, y, NIGHT.moonHalo, 0.46 * f * (0.88 + 0.12 * Math.sin(x * 0.21 + clock * 0.8)));
    }
  };
  const dust = x => {
    for (let i = 0; i < 5; i++) putCell(g, x - 2 - i * 2, hz - 1 - (i % 2), i % 2 ? '·' : '˙', NIGHT.dust);
  };
  /* an arm, two cells thick so it reads at a glance, reaching from a shoulder to wherever the hand is */
  const armTo = (fromX, fromY, toX, toY, reach) => {
    const n = Math.max(2, Math.round(Math.hypot(toX - fromX, toY - fromY)));
    for (let k = 0; k <= Math.round(n * reach); k++) {
      const f = k / n;
      const x = Math.round(fromX + (toX - fromX) * f), y = Math.round(fromY + (toY - fromY) * f);
      putCell(g, x, y, '█', cape);
      if (big) putCell(g, x + 1, y, '█', cape);
    }
  };

  /* the pumpkin: worn as his head, lifted off in his hand, thrown, then a flash. It sits on the shoulders for the
     whole ride, so he reads as the horseman and not as a man with no head at all.                            */
  let pumpkinAt = null;
  const worn = { x: hmX + seat + S.pumpX, y: riderTop - S.pumpY };
  const held = { x: hmX + seat + (big ? 11 : 8), y: riderTop - (big ? 8 : 3) };
  if (u < LIFT) {
    pumpkinAt = worn;
  } else if (u < THROW) {
    const e = clamp01((u - LIFT) / (THROW - LIFT));
    const k = e * e * (3 - 2 * e);
    pumpkinAt = {
      x: Math.round(worn.x + (held.x - worn.x) * k),
      y: Math.round(worn.y + (held.y - worn.y) * k - Math.sin(Math.PI * k) * (big ? 2 : 1)),
    };
  } else if (u < IMPACT) {
    const f = (u - THROW) / FLY;
    const arc = f => Math.round((riderTop - (big ? 5 : 3)) + ((riderTop + 2) - (riderTop - (big ? 5 : 3))) * f - Math.sin(Math.PI * f) * 4);
    const x0 = hmAt(THROW) + seat + (big ? 11 : 8), x1 = at(IMPACT) + 4;
    pumpkinAt = { x: Math.round(x0 + (x1 - x0) * f), y: arc(f) };
    /* the trail it leaves: sparks falling behind it, so the throw is a line through the air */
    for (let k = 1; k <= 4; k++) {
      const b = Math.max(0, f - k * 0.08);
      putCell(g, Math.round(x0 + (x1 - x0) * b) + 3, arc(b) + 2, '·', mix(NIGHT.pumpkin, NIGHT.ember, 0.4 + k * 0.15));
    }
  }

  backlight();

  /* Ichabod's horse runs on whether or not he is still on it */
  if (wetRide && onScreen(ichX)) {
    horse(ichX); dust(ichX);
    if (u < IMPACT) {
      drawSprite(g, ichX + seat, riderTop, S.ich, cape, rim);
      haloSprite(g, ichX + seat, riderTop, S.ich, rim, 0.24);
      /* the hand on the reins, forward to the horse's neck */
      armTo(ichX + seat + (big ? 9 : 6), riderTop + (big ? 3 : 2), ichX + (big ? 17 : 11), horseTop + 1, 1);
      /* his cloak, streaming out behind him */
      const flap = Math.floor(clock * 12) % 2;
      putCell(g, ichX + seat - 1, riderTop + (big ? 4 : 3), '▄', cape);
      putCell(g, ichX + seat - 2, riderTop + (big ? 5 : 3) + flap, '▄', cape);
      putCell(g, ichX + seat - 3, riderTop + (big ? 5 : 4) - flap, '▄', cape);
    } else {
      /* thrown: over the side, and down to the road */
      const t = clamp01((u - IMPACT) / 1.15);
      const fx = Math.round(at(IMPACT) + 3 + t * 10);
      const fy = Math.round((hz - (big ? 11 : 8)) - 6 * Math.sin(Math.PI * Math.min(1, t * 1.15)) + t * t * 10);
      drawSprite(g, fx, fy, t < 0.35 ? FALL_A : t < 0.72 ? FALL_B : FALL_LAND, cape, rim);
    }
  }

  if (wetRide && onScreen(hmX)) {
    horse(hmX); dust(hmX);
    drawSprite(g, hmX + seat, riderTop, S.head, cape, rim);
    haloSprite(g, hmX + seat, riderTop, S.head, rim, 0.24);
    const flap = Math.floor(clock * 11) % 2;
    putCell(g, hmX + seat - 1, riderTop + (big ? 4 : 3), '▄', cape);
    putCell(g, hmX + seat - 2, riderTop + (big ? 5 : 3) + flap, '▄', cape);
    /* the arm: up to the head, then over the lift, then thrown forward after the release */
    const shX = hmX + seat + (big ? 3 : 2), shY = riderTop + (big ? 3 : 2);
    if (u > REACH && u < THROW && pumpkinAt) {
      const reach = clamp01((u - REACH) / 0.45);
      armTo(shX, shY, pumpkinAt.x + Math.floor(S.pump[0].length / 2), pumpkinAt.y + S.pump.length - 1, reach);
    } else if (u >= THROW && u < THROW + 0.55) {
      const k = 1 - clamp01((u - THROW) / 0.55);
      armTo(shX, shY, shX + (big ? 8 : 5), shY - (big ? 3 : 2), k);
    } else if (u > REACH - 0.4 && u <= REACH) {
      const k = clamp01((u - (REACH - 0.4)) / 0.4);
      armTo(shX, shY, worn.x + Math.floor(S.pump[0].length / 2), worn.y + S.pump.length - 1, k * 0.6);
    }
  }

  /* the pumpkin itself, drawn after both riders so it sits proud of the crowd */
  if (wetRide && pumpkinAt) drawSprite(g, pumpkinAt.x, pumpkinAt.y, S.pump, NIGHT.pumpkin, mix(NIGHT.ember, NIGHT.pumpkin, 0.4));

  /* Ichabod's own lantern, swinging from his hand */
  const lanternPos = wetRide && u < IMPACT && onScreen(ichX)
    ? { x: ichX + seat + (big ? 11 : 7), y: riderTop + (big ? 5 : 3) + (Math.sin(clock * 5.5) > 0 ? 0 : 1) }
    : null;
  if (lanternPos) {
    putCell(g, lanternPos.x, lanternPos.y, '▄', NIGHT.lantern);
    putCell(g, lanternPos.x, lanternPos.y + 1, '█', NIGHT.lanternCore);
    putCell(g, lanternPos.x - 1, lanternPos.y + 1, '▐', mix(NIGHT.lantern, NIGHT.pathDark, 0.4));
  }

  /* ---- the light, laid over everything that stands there ---- */
  for (const p of posts) {
    const flick = 0.5 + 0.07 * Math.sin(clock * 6.3 + p.phase) + 0.04 * Math.sin(clock * 17 + p.phase * 3);
    lampLight(g, p.x + 1, hz - 4, 6.5, flick);
  }
  if (lanternPos) lampLight(g, lanternPos.x, lanternPos.y + 1, 5.5, 0.38 + 0.05 * Math.sin(clock * 6.9));
  if (pumpkinAt) lampLight(g, pumpkinAt.x + 1, pumpkinAt.y + 1, 4.5, 0.42 + 0.05 * Math.sin(clock * 9));

  /* the flare as it lands */
  if (wetRide && u >= IMPACT && u < IMPACT + 0.24) {
    const fx = at(IMPACT) + 5, fy = riderTop;
    lampLight(g, fx, fy, 7, 0.6 * (1 - (u - IMPACT) / 0.24));
    drawSprite(g, fx, fy, ['*'], NIGHT.ember);
    for (const [dx, dy] of [[-3, 0], [3, 0], [-2, -2], [2, -2], [0, -3], [-2, 2], [2, 2]]) {
      putCell(g, fx + dx, fy + dy, '✧', NIGHT.ember);
    }
  }

  /* the near pines, framing the road, in front of everything */
  for (const x of [3, w - 4]) {
    pine(g, x, h - 1, Math.min(16, h - 1), mix(NIGHT.pineNear, NIGHT.pineMid, 0.5), mix(NIGHT.pineNear, NIGHT.moon, 0.26), 0.2);
  }

  /* ---- the rain: thin streaks in front of the wood, and rings where they land on the road ---- */
  if (rain === false) return g;                 // /rain off: the wood is dry, everything else stays
  const drops = Math.round(w * 0.55) + 10;
  for (let i = 0; i < drops; i++) {
    const speed = 20 + (i % 6) * 7;
    const x = (i * 59 + 11) % w;
    const spanY = hz + 4;
    const y = Math.floor(((i * 23) % spanY + clock * speed) % spanY);
    const len = 3 + (i % 3);
    for (let k = 0; k < len; k++) {
      const yy = y - k;
      if (yy < 0 || yy >= hz) continue;
      putCell(g, x - (k >> 1), yy, '│', k === 0 ? NIGHT.rain : NIGHT.rainFaint);
    }
  }
  const ripples = Math.max(4, Math.round(w / 12));
  for (let i = 0; i < ripples; i++) {
    const sx = (i * 37 + 9) % w;
    const ph = (clock * 1.7 + i * 0.61) % 1;
    if (ph > 0.62) continue;
    const rr = Math.round(ph * 3.2);
    putCell(g, sx - rr, hz, '·', NIGHT.splash);
    putCell(g, sx + rr, hz, '·', NIGHT.splash);
    putCell(g, sx - rr, hz + 1, '·', NIGHT.splash);
    putCell(g, sx + rr, hz + 1, '·', NIGHT.splash);
    if (rr === 0) { putCell(g, sx, hz, '˙', NIGHT.splash); putCell(g, sx, hz - 1, '˙', NIGHT.splash); }
  }

  return g;
}

/* ---------- one picture for every theme ----------
   The night ride stays in aurora; every other palette gets a scene of its own, built the same way: a sky, a horizon,
   something that moves, and light laid over the top. Each takes the same (w, h, rain) and paints into the same grid,
   so the rest of the screen never has to know which one is running.                                        */
function skyFill(g, hz, stops) {
  for (let y = 0; y < hz; y++) {
    const t = hz <= 1 ? 0 : y / (hz - 1);
    let i = 0;
    while (i < stops.length - 2 && t > stops[i + 1][0]) i++;
    const a = stops[i], b = stops[i + 1] || a;
    const k = b[0] === a[0] ? 0 : clamp01((t - a[0]) / (b[0] - a[0]));
    const col = mix(a[1], b[1], k);
    for (let x = 0; x < g[y].length; x++) g[y][x] = { ch: ' ', fg: null, bg: col };
  }
}
function starField(g, hz, clock, count, bright, faint, seed) {
  const w = g[0].length;
  for (let i = 0; i < count; i++) {
    const sx = (i * 79 + seed * 13) % w, sy = (i * 17 + seed * 3) % Math.max(2, hz - 2);
    const tw = (Math.sin(clock * 1.1 + i * 1.7 + seed) + 1) / 2;
    if (tw < 0.3) continue;
    putCell(g, sx, sy, i % 6 === 0 ? '*' : '·', mix(faint, bright, tw));
  }
}
function ridgeLine(g, hz, base, amp, freq, colour, rim, clock, seed) {
  const w = g[0].length;
  for (let x = 0; x < w; x++) {
    const y = Math.round(base + amp * Math.sin(x * freq + seed) + amp * 0.45 * Math.sin(x * freq * 2.6 + seed * 2.1)
      + Math.sin(clock * 0.22 + x * 0.03) * 0.4);
    for (let yy = Math.max(0, y); yy < hz; yy++) putCell(g, x, yy, '█', colour);
    if (y >= 0 && y < hz) putCell(g, x, y, '▄', rim);
  }
}
function driftingClouds(g, hz, clock, colour, count, seed, y0) {
  const w = g[0].length;
  for (let c = 0; c < count; c++) {
    const wd = 8 + (c * 5) % 14, y = (y0 == null ? 1 : y0) + (c * 3) % Math.max(2, Math.floor(hz / 3));
    const x0 = Math.round((seed + c * 37 + clock * (1.2 + (c % 3) * 0.7)) % (w + wd)) - wd;
    for (let i = 0; i < wd; i++) {
      const edge = i === 0 || i === wd - 1;
      putCell(g, x0 + i, y + (i % 4 === 0 ? 1 : 0), edge ? '░' : '▒', colour);
    }
  }
}

/* ---------- weather over the picture ----------
   Every scene already has rain of its own, drawn into the paint. This lays the weather that moves over the top of
   all of them: three depths of rain at different speeds and lengths, curtains of it sliding through when the wind
   gets up, a gust front that crosses the whole picture, rings where drops land, spray, mist, and lightning in the
   storms. Every position is worked out from the clock alone, with real easing and drifting sine sums, so it flows
   instead of stepping. With no rain the same layers turn into the calm: dust and fireflies breathing in the air, a
   bird working across the sky, a meteor, haze lying on the ground. Which pass is showing changes every so many
   seconds, so no two sittings are the same picture.                                                 */
const WEATHER = {
  aurora: {
    ground: h => Math.max(6, h - 4), wind: -0.5,
    wet: { a: [138, 158, 212], b: [88, 104, 150], c: [198, 214, 252], sheet: [104, 124, 190], bolt: [226, 234, 255], mist: [92, 104, 150] },
    dry: { a: [255, 232, 176], b: [126, 118, 186], glyph: '✦' },
  },
  ember: {
    ground: h => Math.max(7, h - 4), wind: 0.25,
    wet: { a: [255, 152, 92], b: [122, 54, 44], c: [255, 216, 152], sheet: [152, 62, 40], bolt: [255, 208, 142], mist: [92, 44, 36] },
    dry: { a: [255, 180, 112], b: [124, 62, 50], glyph: '·' },
  },
  ocean: {
    ground: h => Math.max(8, Math.round(h * 0.56)), wind: -0.75,
    wet: { a: [152, 188, 224], b: [86, 116, 150], c: [214, 238, 255], sheet: [100, 132, 172], bolt: [236, 246, 255], mist: [80, 110, 142] },
    dry: { a: [212, 242, 252], b: [112, 152, 172], glyph: '·' },
  },
  forest: {
    ground: h => Math.max(7, h - 4), wind: -0.2,
    wet: { a: [150, 192, 172], b: [80, 112, 96], c: [212, 242, 222], sheet: [92, 132, 112], bolt: [238, 250, 238], mist: [70, 102, 86] },
    dry: { a: [255, 242, 172], b: [122, 152, 122], glyph: '·' },
  },
  candy: {
    ground: h => Math.max(8, Math.round(h * 0.6)), wind: 0.35,
    wet: { a: [255, 198, 226], b: [152, 112, 172], c: [255, 248, 252], sheet: [192, 142, 198], bolt: [255, 242, 252], mist: [152, 112, 162] },
    dry: { a: [255, 234, 246], b: [192, 162, 222], glyph: '♥' },
  },
  mono: {
    ground: h => Math.max(8, Math.round(h * 0.62)), wind: -0.35,
    wet: { a: [178, 178, 192], b: [104, 104, 118], c: [230, 230, 238], sheet: [122, 122, 136], bolt: [255, 255, 255], mist: [92, 92, 104] },
    dry: { a: [238, 238, 244], b: [122, 122, 134], glyph: '·' },
  },
  matrix: {
    ground: h => Math.max(6, h - 5), wind: 0.1,
    wet: { a: [122, 255, 166], b: [40, 150, 80], c: [208, 255, 220], sheet: [64, 200, 110], bolt: [212, 255, 222], mist: [30, 90, 52] },
    dry: { a: [152, 255, 182], b: [50, 140, 90], glyph: '▮' },
  },
  garden: {
    ground: h => Math.max(8, h - 5), wind: -0.22,
    wet: { a: [198, 184, 178], b: [116, 104, 112], c: [240, 230, 222], sheet: [142, 122, 126], bolt: [248, 242, 236], mist: [104, 92, 98] },
    dry: { a: [255, 214, 196], b: [186, 132, 140], glyph: '❀' },
  },
  plain: {
    ground: h => Math.max(7, h - 4), wind: -0.28,
    wet: { a: [190, 198, 212], b: [110, 118, 132], c: [234, 238, 246], sheet: [130, 138, 152], bolt: [250, 252, 255], mist: [100, 106, 120] },
    dry: { a: [246, 246, 250], b: [130, 130, 142], glyph: '·' },
  },
};
const ease = t => { t = clamp01(t); return t * t * (3 - 2 * t); };

/* rain, in three depths: far drops are short and slow, near ones long and quick, and the wind leans all of them at
   once. Where they reach the ground they throw a tick and a ring, and the rings widen as they fade.             */
function rainWeather(g, w, h, clock, P) {
  const wet = P.wet, ground = Math.max(2, Math.min(h - 1, P.ground(h)));
  const pass = Math.floor(clock / 72) % 3;
  const gust = Math.sin(clock * 0.27) * 0.4 + Math.sin(clock * 0.093 + 1.7) * 0.18;
  const wind = P.wind + gust;
  const fall = Math.abs(wind) > 0.15 ? (wind < 0 ? '╲' : '╱') : '│';
  const span = h + 12;
  const layers = [
    { n: Math.round(w * 0.16), speed: 6, len: 2, colour: wet.b, dx: wind * 0.45 },
    { n: Math.round(w * 0.11), speed: 11, len: 3, colour: wet.a, dx: wind },
    { n: Math.round(w * 0.045), speed: 18, len: 4, colour: wet.c, dx: wind * 1.6 },
  ];
  const thick = pass === 2 ? 1.35 : pass === 1 ? 0.8 : 1;      // a squall is heavy, a lull is thin
  const front = ((clock * 13) % (w + 64)) - 32;                 // the wall of a squall crossing the picture
  for (let L = 0; L < layers.length; L++) {
    const q = layers[L];
    for (let i = 0; i < Math.round(q.n * thick); i++) {
      const seed = i * 7919 + L * 131 + Math.round(P.wind * 100);
      const y = ((seed % span) + clock * q.speed * (1 + 0.12 * Math.sin(seed))) % span;
      const x0 = seed % w;
      if (pass === 2 && Math.exp(-Math.pow((x0 - front) / 15, 2)) < 0.22) continue;   // the squall is not everywhere at once
      const yTop = y - q.len;
      for (let k = 0; k < q.len; k++) {
        const yy = Math.round(yTop + k), xx = Math.round(x0 + (y - yy) * q.dx);
        putWeatherCell(g, xx, yy, fall, k === 0 ? q.colour : mix(q.colour, wet.b, 0.42));
      }
      if (y > ground - 1 && y < ground + 2) {                    // landing
        const ph = (clock * 2.2 + seed * 0.017) % 1;
        putWeatherCell(g, Math.round(x0 + (y - ground) * q.dx), ground, '˙', wet.c);
        const r = Math.round(ease(ph) * 3);
        if (r > 0 && L === 1) {
          putWeatherCell(g, Math.round(x0) - r, ground, '·', wet.c);
          putWeatherCell(g, Math.round(x0) + r, ground, '·', wet.c);
          if (r > 2) putWeatherCell(g, Math.round(x0), ground + 1, '·', wet.b);
        }
      }
    }
  }
  /* curtains: broad bands of rain, lit from the side, sliding through on their own */
  if (pass === 1) {
    for (let b = 0; b < 2; b++) {
      const cx = ((clock * (7 + b * 3) + b * 37) % (w + 30)) - 15;
      for (let x = Math.round(cx) - 8; x <= Math.round(cx) + 8; x++) {
        const f = 1 - Math.abs(x - cx) / 9;
        if (f <= 0) continue;
        for (let y = 0; y < h; y++) {
          blendCell(g, x, Math.round(y + Math.sin(clock * 0.6 + x * 0.2) * 1.2), wet.sheet,
            0.07 * f * (0.82 + 0.18 * Math.sin(clock * 0.9 + y * 0.33)));
        }
      }
    }
  }
  /* lightning, in the storm passes: a jagged channel, lit inside, and a wash over everything */
  if (pass === 2) {
    const period = P.wind < -0.6 ? 32 : 42;
    const seq = Math.floor((clock + 1.3) / period), ph = (clock + 1.3) % period;
    if (ph < 0.24) {
      const k = 1 - ph / 0.24;
      const bx = Math.round(w * (0.22 + 0.34 * (0.5 + 0.5 * Math.sin(seq * 2.3))));
      for (let y = 0; y < ground; y++) {
        const x = Math.round(bx + Math.sin(y * 0.62 + ph * 9 + seq) * 2.4 + (y / ground) * 4);
        blendCell(g, x, y, wet.bolt, 0.2 * k);
        blendCell(g, x + 1, y, wet.bolt, 0.06 * k);
      }
      for (let y = 0; y < ground; y += 2) blendCell(g, Math.round(w / 2), y, wet.bolt, 0.05 * k * (1 - y / ground));
      if (ph < 0.05) for (let y = 0; y < ground; y++) blendCell(g, Math.round(w * 0.55), y, wet.bolt, 0.03);
    }
  }
  /* mist lying low and moving with the wind */
  for (let i = 0; i < Math.max(3, Math.round(w / 28)); i++) {
    const mx = ((i * 53 + clock * (3 + (i % 4))) % (w + 24)) - 12;
    const my = ground - 2 - (i % 3);
    for (let d = 0; d < 9; d++) blendCell(g, Math.round(mx + d), my + (d % 2), wet.mist, 0.05);
  }
}

/* the calm: motes breathing in the air, a bird crossing, a meteor, and haze on the ground. The glyph and the two
   colours come from the theme, so the same drift reads as fireflies in the wood and as sugar dust in candyland. */
function calmWeather(g, w, h, clock, P) {
  const dry = P.dry, ground = Math.max(2, Math.min(h - 1, P.ground(h)));
  const pass = Math.floor(clock / 72) % 3;
  for (let i = 0; i < Math.max(4, Math.round(w / 16)); i++) {
    const t = clock * (0.14 + (i % 5) * 0.03) + i * 1.37;
    const x = Math.round((i * 37 + Math.sin(t) * 9 + Math.sin(t * 0.4 + i) * 13 + w) % w);
    const y = Math.round((ground - 3) - (i * 11) % Math.max(3, ground - 7) + Math.sin(t * 1.7 + i) * 1.6);
    const on = 0.45 + 0.55 * Math.sin(clock * 0.55 + i * 2.1);
    if (on < 0.6) continue;
    putWeatherCell(g, x, y, i % 7 === 0 ? dry.glyph : '·', mix(dry.b, dry.a, clamp01(on)));
    if (on > 0.9 && i % 3 === 0) blendCell(g, x, y, dry.a, 0.13);
  }
  if (pass === 1) {                                  // a bird, working across the sky and flapping
    const t = (clock % 72) / 72, bx = Math.round(-10 + t * (w + 20));
    const by = Math.round(ground * 0.32 + Math.sin(t * 6) * 3);
    const up = Math.sin(clock * 7) > 0 ? 0 : 1;
    putWeatherCell(g, bx, by, up ? '︿' : '﹀', dry.a);
    putWeatherCell(g, bx + 1, by + up, '‿', dry.a);
    putWeatherCell(g, bx - 1, by + up, '‿', dry.a);
  }
  if (pass === 2) {                                  // a meteor, once, with a tail that thins as it goes
    const ph = clock % 216;
    if (ph >= 144 && ph < 145.1) {
      const k = (ph - 144) / 1.1;
      const sx = Math.round(w * 0.78 - k * w * 0.42), sy = Math.round(1 + k * ground * 0.34);
      for (let i = 0; i < 10; i++) {
        putWeatherCell(g, Math.round(sx + i * 1.5), Math.round(sy - i * 0.62), i === 0 ? '✦' : '·', mix(dry.a, dry.b, i / 10));
      }
      blendCell(g, sx, sy, dry.a, 0.26 * (1 - k));
    }
  }
  for (let x = 0; x < w; x += 2) blendCell(g, x, Math.min(h - 1, ground + 1), dry.b, 0.04 + 0.02 * Math.sin(clock * 0.4 + x * 0.1));
}

/* ---- ember: a volcano over a river of fire, sparks going up, ash coming down ---- */
function emberScene(w, h, rain) {
  const still = UI.scene === 'paused';
  const g = newGrid(w, h), clock = still ? 0 : sceneTime();
  const wet = !still && rain !== false;
  const hz = Math.max(7, h - 4);
  const C = {
    hi: [16, 8, 12], lo: [104, 34, 20], star: [255, 210, 170], starDim: [120, 64, 52],
    far: [36, 16, 16], farRim: [96, 40, 26], near: [20, 10, 11], nearRim: [72, 28, 18],
    cone: [26, 11, 12], coneRim: [122, 44, 24], lava: [255, 96, 24], core: [255, 224, 140], deep: [172, 40, 16],
    smoke: [48, 32, 36], smokeLit: [128, 62, 42], ember: [255, 166, 70], ash: [84, 60, 58],
    ground: [22, 11, 12], glow: [96, 34, 20], pine: [10, 5, 6], pineRim: [86, 30, 20],
  };
  skyFill(g, hz, [[0, C.hi], [0.55, mix(C.hi, C.lo, 0.4)], [1, C.lo]]);
  starField(g, hz, clock, Math.max(8, Math.round(w / 7)), C.star, C.starDim, 4);
  ridgeLine(g, hz, hz - 6.6, 1.6, 0.07, C.far, C.farRim, clock, 2.2);
  ridgeLine(g, hz, hz - 4.4, 1.1, 0.11, C.near, C.nearRim, clock, 7.4);

  /* the cone, with a crater that glows at the top */
  const cx = Math.round(w * 0.6), coneH = Math.max(6, Math.min(hz - 2, Math.round(h * 0.5))), peak = hz - coneH;
  for (let y = peak; y < hz; y++) {
    const t = (y - peak) / Math.max(1, coneH);
    const half = Math.round(1 + t * t * (w * 0.2));
    for (let x = cx - half; x <= cx + half; x++) {
      const edge = x <= cx - half + 1 || x >= cx + half - 1;
      putCell(g, x, y, '█', edge ? C.coneRim : C.cone);
    }
  }
  for (let k = -2; k <= 2; k++) putCell(g, cx + k, peak, Math.abs(k) === 2 ? '▄' : '█', mix(C.lava, C.core, 0.6));
  /* channels of lava, a few thin streaks down the face rather than a lit outline */
  for (let i = 0; i < 3; i++) {
    const side = i % 2 ? 1 : -1, off = 1 + i * 2;
    for (let y = peak + 2; y < hz; y++) {
      const t = (y - peak) / Math.max(1, coneH);
      const x = cx + side * (off + Math.round(t * t * w * 0.15));
      if ((y + i * 3) % 7 === 0) continue;                 // the streak is broken, like cooling rock
      const pulse = 0.5 + 0.5 * Math.sin(y * 0.7 - clock * 4.5 + i * 1.7);
      putCell(g, x, y, '▓', mix(mix(C.cone, C.lava, 0.6), C.core, pulse * 0.5));
    }
  }
  /* the river of fire along the base */
  for (let y = hz; y < h; y++) {
    const t = (y - hz) / Math.max(1, h - hz);
    for (let x = 0; x < w; x++) {
      const top = hz + 1 + Math.round((Math.sin(x * 0.06 - clock * 1.3) + 1) * 1.1);
      let col = mix(C.ground, C.glow, 0.3 + 0.25 * t);
      if (y >= top && y <= top + 2 && y < h - 1) {
        const hot = 0.5 + 0.5 * Math.sin(x * 0.5 + clock * 5.5);
        col = wet ? mix(C.deep, C.lava, 0.35 + hot * 0.6) : mix(C.deep, C.lava, 0.08 + hot * 0.12);
      } else if (y === top + 3) col = mix(col, C.deep, wet ? 0.28 : 0.5);
      g[y][x] = { ch: ' ', fg: null, bg: col };
    }
  }
  if (!still) {
    for (let i = 0; i < Math.max(3, Math.round(w / 9)); i++) {
      const x = Math.round((i * 47 + clock * 9) % w);
      putCell(g, x, hz + 1 + (i % 2), '≈', wet ? mix(C.core, C.lava, 0.4) : mix(C.deep, C.lava, 0.35));
    }
    /* the smoke: a plume that leans with the wind and is lit from underneath */
    const plume = Math.round(hz * 0.85);
    for (let k = 0; k < plume; k++) {
      const y = peak - k;
      if (y < 0) break;
      const x = Math.round(cx + Math.sin(k * 0.19 + clock * 0.45) * 2.8 + k * 0.55), wide = 2 + Math.round(k * 0.3);
      for (let d = -wide; d <= wide; d++) {
        const r = Math.abs(d) / (wide + 0.001);
        if ((k * 7 + d * 5 + Math.round(clock * 2)) % 13 === 0) continue;      // torn, billowing edges
        putCell(g, x + d, y, r > 0.75 ? '░' : (k % 3 ? '▒' : '▓'),
          mix(C.smoke, C.smokeLit, Math.max(0, 0.5 - k * 0.012) + (1 - r) * 0.14));
      }
    }
    /* sparks going up off the crater, and ash coming down */
    if (rain !== false) {
      const sparks = Math.round(w * 0.18), span = h + 8;
      for (let i = 0; i < sparks; i++) {
        const y = Math.round(h - ((i * 31) % span + clock * (14 + (i % 5) * 7)) % span);
        if (y < 0 || y >= h) continue;
        const x = Math.round(cx + Math.sin(clock * 1.4 + i) * (4 + (i % 9) * 1.7) + (peak - y) * 0.12);
        putCell(g, x, y, i % 4 ? '·' : '*', mix(C.ember, C.core, (Math.sin(clock * 6 + i) + 1) / 2));
      }
      for (let i = 0; i < Math.round(w * 0.1); i++) {
        const y = Math.round(((i * 29) + clock * (7 + i % 4)) % (h + 4));
        putCell(g, (i * 53 + Math.round(clock * 3)) % w, y, '˙', C.ash);
      }
    }
  }
  /* the fire lights everything near it */
  lampLight(g, cx, peak, 11, 0.55 + 0.06 * Math.sin(clock * 5.1), C.lava);
  lampLight(g, Math.round(w * 0.5), hz + 1, 9, 0.28 + 0.04 * Math.sin(clock * 3.3), C.lava);
  for (const x of [4, w - 5]) pine(g, x, h - 1, Math.min(15, h - 1), C.pine, C.pineRim, 0.22);
  if (!still) emberEvent(g, w, h, hz, clock, rain);
  return g;
}

/* ---- ocean: a lighthouse sweeping its beam over a rolling sea, a small boat riding it out ---- */
function oceanScene(w, h, rain) {
  const still = UI.scene === 'paused';
  const g = newGrid(w, h), clock = still ? 0 : sceneTime();
  const hz = Math.max(8, Math.round(h * 0.56));
  const C = {
    hi: [5, 10, 24], lo: [46, 82, 108], star: [226, 242, 255], starDim: [96, 128, 158],
    moon: [240, 248, 255], halo: [96, 140, 180], seaTop: [22, 56, 78], seaMid: [12, 34, 52], seaLow: [7, 20, 32],
    foam: [168, 208, 230], glint: [214, 244, 255], cliff: [11, 15, 21], cliffRim: [58, 78, 96], rock: [16, 22, 30],
    tower: [15, 21, 30], towerRim: [70, 90, 108], lens: [255, 240, 190], beam: [128, 188, 226],
    hull: [14, 20, 28], sail: [206, 222, 236], mast: [52, 66, 80], spray: [196, 226, 240], cloud: [44, 66, 86],
    rain: [136, 176, 214], rainFaint: [82, 112, 146], splash: [176, 214, 238],
    kraken: [22, 14, 36], krakenLit: [96, 66, 132], sucker: [186, 146, 214], eye: [255, 236, 132],
    mouth: [12, 6, 20], bulge: [40, 74, 96],
  };
  skyFill(g, hz, [[0, C.hi], [0.6, mix(C.hi, C.lo, 0.55)], [1, C.lo]]);
  starField(g, hz, clock, Math.max(10, Math.round(w / 5)), C.star, C.starDim, 6);
  driftingClouds(g, hz, clock, C.cloud, 3, 13);
  const mx = w - 15, my = 2;
  for (let dy = -2; dy <= 2; dy++) for (let dx = -3; dx <= 3; dx++) {
    const d = Math.sqrt(dx * dx + dy * dy * 2);
    if (d <= 3.6) blendCell(g, mx + dx, my + dy, C.halo, 0.24 * (1 - d / 3.8));
  }
  putCell(g, mx, my, '◉', C.moon);

  /* the sea: bands rolling in, crests catching the moon */
  for (let y = hz; y < h; y++) {
    const t = (y - hz) / Math.max(1, h - hz);
    const base = t < 0.35 ? mix(C.seaTop, C.seaMid, t / 0.35) : mix(C.seaMid, C.seaLow, (t - 0.35) / 0.65);
    for (let x = 0; x < w; x++) {
      const swell = Math.sin(x * 0.08 + y * 0.9 - clock * (1.4 + t * 1.2));
      g[y][x] = { ch: ' ', fg: null, bg: mix(base, C.seaTop, Math.max(0, swell) * 0.18) };
      if (swell > 0.86 && ((x + y * 3 + Math.round(clock * 6)) % 7 > 2)) putCell(g, x, y, y > hz + 1 ? '▄' : '▂', C.foam);
    }
  }
  /* the moon's road on the water */
  for (let y = hz; y < h; y++) {
    const t = (y - hz) / Math.max(1, h - hz), half = 1 + Math.round(t * 4);
    for (let x = mx - half; x <= mx + half; x++) {
      const tw = (Math.sin(clock * 3.1 + y * 1.7) + 1) / 2;
      if (tw < 0.35) continue;
      blendCell(g, x, y, C.glint, 0.3 * (1 - t * 0.5) * tw);
    }
  }
  /* the cliff, then the tower standing on it */
  const cliffW = Math.round(w * 0.3), lx = Math.round(w * 0.14);
  for (let y = hz - 1; y < h; y++) {
    const t = (y - (hz - 1)) / Math.max(1, h - hz + 1);
    const reach = Math.round(cliffW * (0.55 + 0.45 * t) + Math.sin(y * 0.8) * 1.2);
    for (let x = 0; x < reach; x++) putCell(g, x, y, '█', x > reach - 3 ? C.cliffRim : mix(C.cliff, C.rock, (x / Math.max(1, reach)) * 0.5));
  }
  const baseY = hz - 1, topY = Math.max(1, baseY - Math.round(h * 0.33));
  for (let y = topY; y <= baseY; y++) {
    const t = (y - topY) / Math.max(1, baseY - topY);
    const half = 1 + Math.round((1 - t) * 2);
    for (let x = lx - half; x <= lx + half; x++) putCell(g, x, y, '█', x === lx - half ? C.towerRim : C.tower);
  }
  for (let x = lx - 4; x <= lx + 4; x++) putCell(g, x, baseY + 1, '▀', C.towerRim);
  for (let x = lx - 3; x <= lx + 3; x++) putCell(g, x, topY - 1, '▄', C.towerRim);
  /* the beam, sweeping out over the water */
  const ang = Math.sin(clock * 0.55) * 0.55, L = Math.round(w * 0.62);
  for (let s = 2; s < L; s++) {
    const x = Math.round(lx + s * Math.cos(ang)), y = Math.round(topY + s * Math.sin(ang) * 0.5 - s * 0.03);
    const f = 1 - s / L;
    blendCell(g, x, y, C.beam, 0.3 * f + 0.05);
    blendCell(g, x, y - 1, C.beam, 0.13 * f);
    blendCell(g, x, y + 1, C.beam, 0.11 * f);
  }
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) blendCell(g, lx + dx, topY + dy, C.lens, 0.22);
  putCell(g, lx, topY, '☼', C.lens);
  if (still) return g;

  /* ---- the boat, and on a wet night what comes up after it ----
     Without rain the boat rides the swell. With rain a whole hunt plays out over twenty-four seconds: the water
     lifts, the arms come up one after another, they curl over the hull and take hold, haul the boat down, and the
     head breaks the surface behind the mast to watch it go. Then it all sinks back and a new boat sails in from the
     east. Every arm is one cubic curve that starts in the sea and grows, so the wrap is a movement and never a jump;
     each pass is a little different — arms together, arms from one side, or a ring all the way round.            */
  const wet = rain !== false;
  const CYCLE = 24, SWELL = 5.0, RISE = 7.2, WRAP = 10.4, DRAG = 13.0, DOWN = 16.2, SINK = 18.2, CALM = 20.6;
  const u = ((clock % CYCLE) + CYCLE) % CYCLE;
  const pass = Math.floor(clock / CYCLE) % 3;
  const variant = wet ? ((pass % 3) + 3) % 3 : 0;
  const bx = Math.round(w * 0.72), sy = hz + 2;
  const back = u > CALM ? ease((u - CALM) / (CYCLE - CALM)) : 0;
  const boatX = !wet ? bx : u > CALM ? Math.round(w + 12 + (bx - (w + 12)) * back) : bx;
  const pull = wet ? ease((u - DRAG) / (DOWN - DRAG)) : 0;
  const hullTop = sy - 2;
  const by = sy + (wet ? Math.round(pull * 4) : Math.round(Math.sin(clock * 1.1) * 1.2));
  const gone = wet && u > DOWN + 0.4 && u < CALM;

  /* the boat: it is drawn between the arms, so half of the tentacles pass behind the hull and half come over the
     gunwale in front of it. That is what makes the wrap read as a wrap instead of a shadow over the deck.       */
  const drawBoat = () => {
    if (gone) return;
    const tilt = Math.round(pull * 2);
    drawSprite(g, boatX - tilt, by, [' ▄█████▄ ', '  ▀▀▀▀▀  '], mix(C.hull, C.mouth, pull * 0.7));
    drawSprite(g, boatX + 4, by - 6 + Math.round(pull * 3), ['  ▄  ', ' ▄█▄ ', '▄███▄'], mix(C.sail, C.hull, pull * 0.8));
    for (let k = 0; k < 6; k++) putCell(g, boatX + 4 - tilt, by - k, '│', mix(C.mast, C.hull, pull));
    if (pull > 0.15) {                                     // the sea coming over the side
      for (let d = -1; d <= 9; d++) if ((d + Math.round(clock * 8)) % 2) putCell(g, boatX + d, by - Math.round(pull * 2), '▒', mix(C.foam, C.seaTop, 0.4));
    }
  };
  if (!wet || u <= RISE || u >= CALM) drawBoat();
  if (wet && u > RISE && u < CALM) {
    const kx = bx + 2;
    /* the sea gives warning: a bulge, then spray at its rim, before anything shows */
    if (u > SWELL && u < RISE + 1) {
      const b = ease((u - SWELL) / (RISE - SWELL));
      for (let d = -12; d <= 12; d++) {
        const y = hz + 1 - Math.round((1 - Math.abs(d) / 13) * 2.2 * b);
        blendCell(g, kx + d, y, C.bulge, 0.45 * b);
        blendCell(g, kx + d, y - 1, C.bulge, 0.16 * b);
      }
      for (let i = 0; i < 8; i++) putCell(g, kx - 12 + ((i * 7 + Math.round(clock * 4)) % 24), hz, '·', C.foam);
    }
    /* the head, smaller than the boat and off to one side of it, so the hull and the mast stay readable against it */
    const headUp = ease((u - (WRAP - 0.8)) / 2.4) * (1 - ease((u - (SINK + 0.6)) / 1.8));
    if (headUp > 0.02) {
      const KR = [
        '  ▄▄▄▄▄▄▄▄  ',
        ' ██████████ ',
        '████████████',
        '████████████',
        ' ██████████ ',
        '  ▀██████▀  ',
      ];
      const hx = Math.min(w - 8, kx + 15), top = Math.round(hz + 1 - headUp * 6);
      drawSprite(g, hx - 6, top, KR, (ch, r) => mix(C.kraken, C.krakenLit, 0.14 + r / 9));
      const ey = top + 2;
      putCell(g, hx - 3, ey, '█', C.eye); putCell(g, hx + 2, ey, '█', C.eye);
      putCell(g, hx - 3, ey + 1, '▀', mix(C.eye, C.kraken, 0.55)); putCell(g, hx + 2, ey + 1, '▀', mix(C.eye, C.kraken, 0.55));
      blendCell(g, hx - 3, ey, C.eye, 0.4); blendCell(g, hx + 2, ey, C.eye, 0.36);
      if (pull > 0.05) {                                   // the mouth opens as the hull comes down
        const open = Math.round(pull * 2);
        for (let d = -2 - open; d <= 2 + open; d++) putCell(g, hx + d, top + 5, '▄', mix(C.mouth, C.kraken, 0.3));
        for (let d = -2 - open; d <= 2 + open; d += 2) putCell(g, hx + d, top + 4, '▪', mix(C.sucker, [255, 255, 255], 0.55));
      }
      for (let i = 0; i < 6; i++) {                        // water running off it
        const wx = hx - 6 + ((i * 5 + Math.round(clock * 5)) % 13);
        putCell(g, wx, top + 4 + (i % 3), i % 2 ? '˙' : '·', C.spray);
      }
    }
    /* the arms: one cubic each, growing out of the water, curling over the gunwale, then hauling down. Their points
       are worked out first so the same arm can be drawn on either side of the hull. */
    const armGeom = () => {
      const out = [];
      const n = variant === 2 ? 7 : 5;
      for (let i = 0; i < n; i++) {
        const spread = variant === 2 ? (i / (n - 1) - 0.5) * 2 : (i / (n - 1) - 0.5) * 1.55;
        const side = spread < 0 ? -1 : 1;
        const stag = variant === 1 ? Math.abs(i - (n - 1) / 2) * 0.55 : i * 0.34;
        const grow = ease((u - (RISE + stag)) / 2.2);
        const wrap = ease((u - (WRAP + i * 0.16)) / 1.9);
        const haul = ease((u - (DRAG + i * 0.11)) / 2.0);
        const loose = ease((u - (SINK - 0.4 + i * 0.08)) / 1.7);
        const life = grow * (1 - loose);
        if (life <= 0.01) continue;
        const off = Math.round(spread * 13), ax = kx + off, ay = hz + 1;
        const riseTipX = ax + side * (1 + Math.abs(spread) * 2);
        const riseTipY = hz + 1 - (5 + (Math.abs(off) % 3)) * grow - 1;
        const wrapTipX = kx + side * (5 + (i % 2));
        const wrapTipY = hullTop + 1 - (i % 2);
        let tx = riseTipX + (wrapTipX - riseTipX) * wrap;
        let ty = riseTipY + (wrapTipY - riseTipY) * wrap + haul * 4.2;
        tx += Math.sin(clock * 1.6 + i * 1.3) * (1 - haul) * 0.9;
        ty += Math.cos(clock * 1.25 + i) * 0.6;
        let c1x = ax + side * (3 + Math.abs(spread) * 4);
        let c1y = hz + 1 - 5 * life;
        let c2x = riseTipX + side * 2;
        let c2y = riseTipY + 3;
        c1x += (ax + side * 7 - c1x) * wrap; c1y += (hullTop - 5 - c1y) * wrap;
        c2x += (tx + side * 5 - c2x) * wrap; c2y += (ty + 2.4 - c2y) * wrap;
        out.push({ i, ax, ay, c1x, c1y, c2x, c2y, tx, ty, life });
      }
      return out;
    };
    const drawArm = (a, from) => {
      const segs = Math.max(12, Math.round(16 + Math.abs(a.ty - a.ay) * 1.6));
      for (let s = Math.round(segs * (from || 0)); s <= segs; s++) {
        const t = s / segs, it = 1 - t;
        const x = it * it * it * a.ax + 3 * it * it * t * a.c1x + 3 * it * t * t * a.c2x + t * t * t * a.tx;
        const y = it * it * it * a.ay + 3 * it * it * t * a.c1y + 3 * it * t * t * a.c2y + t * t * t * a.ty;
        const thick = Math.max(1, Math.round((2.4 - t * 1.4) * (0.6 + 0.4 * a.life)));
        const shade = mix(C.kraken, C.krakenLit, 0.16 + t * 0.5 + 0.12 * Math.sin(clock * 2.2 + s * 0.35 + a.i));
        for (let d = 0; d < thick; d++) putCell(g, Math.round(x) + d, Math.round(y), '█', shade);
        if (s % 3 === 1) putCell(g, Math.round(x) + thick, Math.round(y), '·', C.sucker);
        if (t > 0.82) putCell(g, Math.round(x), Math.round(y) - 1, '▀', mix(C.krakenLit, C.sucker, 0.5));
      }
      if (Math.abs(a.ax) < w) blendCell(g, a.ax, a.ay, C.krakenLit, 0.16 * a.life);   // a light where it leaves the water
    };
    const arms = armGeom();
    for (const a of arms) if (a.i % 2 === 0) drawArm(a);      // the far arms, behind the hull
    drawBoat();
    for (const a of arms) if (a.i % 2 === 1) drawArm(a, 0.58);   // the near arms: only the tips come over the gunwale
    /* foam where the hull was, and the spray thrown up as it goes down */
    const ring = Math.round(6 + pull * 8);
    for (let d = -ring; d <= ring; d++) {
      if ((d + Math.round(clock * 6)) % 2) continue;
      putCell(g, kx + d, hz + Math.round(pull * 2), 1 - Math.abs(d) / (ring + 1) > 0.55 ? '░' : '·', mix(C.foam, C.seaTop, 0.35));
    }
    if (pull > 0.05) {
      for (let i = 0; i < 14; i++) {
        const t = (clock * 0.45 + i * 0.19) % 1;
        const x = Math.round(kx - 8 + (i * 3.1) % 18);
        const y = Math.round(hz + 1 - Math.sin(Math.PI * t) * (2 + pull * 5));
        putCell(g, x, y, '˙', mix(C.spray, C.foam, t));
      }
    }
  }

  /* without rain the boat just rides it out, and the sea breathes under it */
  if (!wet) {
    for (let d = -6; d <= 6; d++) blendCell(g, boatX + d + 1, sy + 1, C.foam, 0.08 + 0.05 * Math.sin(clock * 1.4 + d * 0.4));
  }

  /* ---- the rain itself: thin streaks over sky and sea, and rings where they land ---- */
  if (rain !== false) {
    const drops = Math.round(w * 0.55) + 10;
    for (let i = 0; i < drops; i++) {
      const speed = 20 + (i % 6) * 7, span = h + 4;
      const y = Math.floor(((i * 23) % span + clock * speed) % span);
      const x = (i * 59 + 13) % w;
      if (y < 0 || y >= h) continue;
      const len = 2 + (i % 3);
      for (let k = 0; k < len; k++) {
        const yy = y - k;
        if (yy < 0 || yy >= h) continue;
        putCell(g, x - (k >> 1), yy, '│', k === 0 ? C.rain : C.rainFaint);
      }
    }
    const rings = Math.max(4, Math.round(w / 12));
    for (let i = 0; i < rings; i++) {
      const x = (i * 37 + 5) % w, ph = (clock * 1.7 + i * 0.61) % 1;
      if (ph > 0.62) continue;
      const r = Math.round(ph * 3.2);
      putCell(g, x - r, hz, '·', C.splash);
      putCell(g, x + r, hz, '·', C.splash);
      putCell(g, x, hz + 1, '·', C.splash);
      if (r === 0) putCell(g, x, hz - 1, '˙', C.splash);
    }
  }
  if (rain === false) oceanPeace(g, w, h, hz, clock, C);
  return g;
}

/* ---- forest: a wood at night, moonbeams, fireflies, and a stag standing still ---- */
function forestScene(w, h, rain) {
  const still = UI.scene === 'paused';
  const g = newGrid(w, h), clock = still ? 0 : sceneTime();
  const hz = Math.max(7, h - 4);
  const C = {
    hi: [5, 14, 12], lo: [26, 54, 42], star: [210, 240, 220], starDim: [74, 110, 92],
    mist: [46, 82, 66], trunk: [11, 12, 11], bark: [22, 28, 22], barkLit: [44, 58, 44],
    leaf: [9, 24, 18], leafLit: [64, 116, 84], beam: [150, 200, 168],
    fire: [255, 232, 150], glow: [255, 196, 96], ground: [10, 18, 13], moss: [18, 32, 22],
    stream: [24, 50, 56], glint: [132, 214, 206], mushroom: [208, 116, 164], cap: [244, 158, 196],
    deer: [10, 12, 10], deerRim: [126, 166, 140],
  };
  skyFill(g, hz, [[0, C.hi], [0.6, mix(C.hi, C.lo, 0.5)], [1, C.lo]]);
  starField(g, hz, clock, Math.max(8, Math.round(w / 6)), C.star, C.starDim, 9);
  /* a low mist between the trunks */
  for (let y = Math.max(0, hz - 11); y < hz; y++) {
    const t = (y - (hz - 11)) / 11;
    for (let x = 0; x < w; x++) blendCell(g, x, y, C.mist, 0.18 * t * (0.7 + 0.3 * Math.sin(x * 0.14 + clock * 0.5)));
  }
  /* the canopy: a deep roof of leaves, ragged underneath, with vines hanging from it */
  for (let x = 0; x < w; x++) {
    const depth = Math.round(h * 0.15 + Math.sin(x * 0.13 + 0.7) * 2.4 + Math.abs(((x * 7 + 5) % 11) - 5) * 0.55);
    for (let y = 0; y < depth; y++) {
      const edge = y > depth - 2;
      const leafy = ((x * 3 + y * 5) % 9 === 0);
      putCell(g, x, y, edge ? '▄' : (leafy ? '░' : '█'), edge ? C.leafLit : (y < 2 ? mix(C.leaf, C.leafLit, 0.22) : C.leaf));
    }
    if (x % 9 === 3) {
      const len = 2 + ((x * 13) % 4);
      for (let k = 0; k < len; k++) putCell(g, x, depth + k, '│', mix(C.leafLit, C.trunk, 0.5));
    }
  }
  /* moonbeams, coming down through the leaves and the mist */
  for (let i = 0; i < 4; i++) {
    const x0 = Math.round(w * (0.12 + i * 0.23)), y0 = Math.round(h * 0.14);
    for (let s = 0; s < hz * 1.3; s++) {
      const x = Math.round(x0 + s * 0.55), y = Math.round(y0 + s * 0.72);
      if (y >= hz) break;
      blendCell(g, x, y, C.beam, 0.14 * (1 - s / (hz * 1.3)) * (0.65 + 0.35 * Math.sin(clock * 0.8 + i * 1.7)));
    }
  }
  /* the far trunks, thin and dim, then the near ones, wider at the foot, with branches and roots */
  for (let i = 0; i < Math.max(5, Math.round(w / 8)); i++) {
    const x = (i * 37 + 5) % Math.max(4, w - 4), top = Math.round(h * 0.2);
    for (let y = top; y < hz; y++) putCell(g, x, y, '│', mix(C.trunk, C.bark, 0.6));
  }
  for (let i = 0; i < Math.max(3, Math.round(w / 14)); i++) {
    const x = 4 + ((i * 53 + 7) % Math.max(5, w - 10));
    const base = 4 + (i % 3), top = Math.round(h * 0.14);
    for (let y = top; y < hz; y++) {
      const t = (y - top) / Math.max(1, hz - top);
      const half = Math.round(base * (0.5 + t * 0.5)) - 1;
      for (let d = -half; d <= half; d++) {
        const bark = ((x * 7 + y * 5 + d) % 13 === 0) ? C.barkLit : (y % 11 === 0 ? C.bark : C.trunk);
        putCell(g, x + d, y, '█', bark);
      }
      if (y % 6 === 0 && y > top + 3) {
        const side = ((x + y) % 2) ? 1 : -1;
        for (let b = 1; b <= 3; b++) putCell(g, x + side * (half + b), y - b, '▄', C.trunk);
      }
    }
    for (let d = -base - 1; d <= base + 1; d++) putCell(g, x + d, hz, '▄', C.trunk);
  }
  /* the floor, the stream, and the moss along its bank */
  for (let y = hz; y < h; y++) for (let x = 0; x < w; x++) {
    const n = (x * 17 + y * 31) % 19;
    g[y][x] = { ch: ' ', fg: null, bg: n === 0 ? mix(C.ground, C.moss, 0.6) : mix(C.ground, C.moss, 0.15) };
  }
  const sy = hz + 1;
  for (let x = 0; x < w; x++) for (let k = 0; k < 2; k++) putCell(g, x, sy + k, ' ', null, mix(C.stream, C.ground, 0.25 + k * 0.2));
  if (!still) {
    for (let i = 0; i < Math.round(w / 2); i++) {
      const x = Math.round((i * 23 + clock * 14) % w), k = i % 2;
      putCell(g, x, sy + k, i % 5 ? '─' : '·', C.glint);
    }
  }
  /* ferns on the bank */
  for (let i = 0; i < Math.max(3, Math.round(w / 16)); i++) {
    const x = 6 + ((i * 47 + 11) % Math.max(6, w - 12)), y = h - 2;
    putCell(g, x, y, '╱', C.bark); putCell(g, x + 1, y, '╲', C.bark);
    putCell(g, x - 1, y - 1, '╱', C.bark); putCell(g, x + 2, y - 1, '╲', C.bark);
    putCell(g, x, y - 1, '│', C.bark);
  }
  /* fireflies, drifting and blinking, kept out of the way of the middle */
  if (!still) {
    for (let i = 0; i < Math.max(8, Math.round(w / 9)); i++) {
      const x = (Math.round(w * 0.55 + Math.sin(clock * 0.5 + i * 2.1) * (w * 0.4) + i * 5) % w + w) % w;
      const y = Math.round(hz - 5 + Math.sin(clock * 0.8 + i) * 4.5 + Math.cos(i) * 2);
      const on = (Math.sin(clock * 2.6 + i * 1.9) + 1) / 2;
      if (on < 0.4) continue;
      putCell(g, x, y, on > 0.85 ? '•' : '·', mix(C.glow, C.fire, on));
      if (on > 0.9) blendCell(g, x, y, C.glow, 0.16);
    }
  }
  /* mushrooms at the foot of the trunks, glowing a little */
  for (let i = 0; i < Math.max(2, Math.round(w / 20)); i++) {
    const x = 5 + ((i * 41 + 9) % Math.max(5, w - 10)), y = h - 2;
    putCell(g, x, y - 1, '▄', C.mushroom); putCell(g, x + 1, y - 1, '▄', C.mushroom);
    putCell(g, x, y, '│', mix(C.cap, C.ground, 0.4));
    blendCell(g, x, y - 1, C.cap, 0.2);
  }
  if (!still) forestEvent(g, w, h, hz, clock, rain);
  return g;
}

/* ---- candy: lollipop trees, gumdrop hills, sprinkles falling like snow ---- */
function candyScene(w, h, rain) {
  const still = UI.scene === 'paused';
  const g = newGrid(w, h), clock = still ? 0 : sceneTime();
  const hz = Math.max(8, Math.round(h * 0.6));
  const C = {
    hi: [30, 16, 44], mid: [104, 50, 92], lo: [176, 102, 132], star: [255, 238, 246], starDim: [168, 132, 164],
    moon: [255, 238, 244], halo: [190, 140, 180], hillFar: [96, 58, 96], hillMid: [66, 38, 70], hillNear: [36, 22, 42],
    stick: [226, 206, 196], pink: [255, 132, 190], mint: [140, 220, 236], lime: [186, 246, 172], honey: [255, 214, 120],
    lavender: [196, 176, 232], frosting: [255, 228, 236], sprinkle: [255, 244, 214], bubble: [214, 200, 238],
    win: [255, 226, 150], house: [48, 28, 48], cane: [255, 120, 140], cane2: [255, 250, 250],
  };
  skyFill(g, hz, [[0, C.hi], [0.55, mix(C.hi, C.mid, 0.8)], [1, C.mid]]);
  starField(g, hz, clock, Math.max(12, Math.round(w / 5)), C.star, C.starDim, 2);
  const mx = Math.round(w * 0.8), my = 3;
  for (let dy = -2; dy <= 2; dy++) for (let dx = -3; dx <= 3; dx++) {
    const d = Math.sqrt(dx * dx + dy * dy * 2);
    if (d <= 3.6) blendCell(g, mx + dx, my + dy, C.halo, 0.24 * (1 - d / 3.8));
  }
  putCell(g, mx, my, '☾', C.moon);
  /* gumdrop hills: soft mounds with a sugared rim, one behind the other */
  for (let layer = 0; layer < 3; layer++) {
    const base = hz - 4 + layer * 1.8;
    const colour = layer === 0 ? C.hillFar : layer === 1 ? C.hillMid : C.hillNear;
    const tint = layer === 0 ? C.lavender : layer === 1 ? C.pink : C.mint;
    for (let x = 0; x < w; x++) {
      const y = Math.round(base + Math.sin(x * (0.055 + layer * 0.015) + layer * 2.1) * (2.6 - layer * 0.5)
        + Math.sin(x * 0.21 + layer) * 0.7);
      for (let yy = Math.max(0, y); yy < hz; yy++) putCell(g, x, yy, '█', colour);
      if (y >= 0 && y < hz) putCell(g, x, y, '▄', mix(colour, tint, 0.5));
      if (y + 1 < hz && (x % 5 === 0)) putCell(g, x, y + 1, '·', C.sprinkle);
    }
  }
  /* the ground: a frosting path with sugar on it */
  for (let y = hz; y < h; y++) {
    const t = (y - hz) / Math.max(1, h - hz);
    for (let x = 0; x < w; x++) {
      const n = (x * 19 + y * 23) % 17;
      const path = Math.abs(x - w / 2) < (w * (0.03 + t * 0.1));
      g[y][x] = { ch: ' ', fg: null, bg: path ? mix(mix(C.hillNear, C.pink, 0.35), C.frosting, 0.25 + t * 0.3) : mix(C.hillNear, [14, 8, 20], 0.35) };
      if (n === 0) putCell(g, x, y, '·', C.sprinkle);
    }
  }
  /* lollipop trees, each with a swirl of its own */
  const pops = [
    { x: Math.round(w * 0.13), hh: 9, c: C.pink },
    { x: Math.round(w * 0.32), hh: 7, c: C.mint },
    { x: Math.round(w * 0.62), hh: 10, c: C.lavender },
    { x: Math.round(w * 0.83), hh: 7, c: C.lime },
  ];
  for (const p of pops) {
    const top = hz - p.hh, bob = Math.sin(clock * 0.6 + p.x) > 0.93 ? 1 : 0;
    for (let y = top + 2; y < hz; y++) putCell(g, p.x, y, '│', C.stick);
    const r = Math.max(2, Math.round(p.hh * 0.36));
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      const d = Math.sqrt(dx * dx + dy * dy * 1.9);
      if (d > r) continue;
      const swirl = (Math.sin(Math.atan2(dy, dx) * 3 + d * 1.6 + clock * 0.6) + 1) / 2;
      putCell(g, p.x + dx, top + 1 + dy + bob, d > r - 1 ? '░' : '▓',
        d > r - 1 ? mix(p.c, C.sprinkle, 0.4) : mix(p.c, [255, 255, 255], 0.15 + swirl * 0.45));
    }
  }
  /* a candy cane, leaning in from the right */
  const cxx = Math.round(w * 0.93), cyy = hz - 1;
  for (let k = 0; k < 8; k++) putCell(g, cxx, cyy - k, '█', k % 2 ? C.cane2 : C.cane);
  for (let k = 0; k < 4; k++) putCell(g, cxx - k, cyy - 8, '█', k % 2 ? C.cane : C.cane2);
  for (let k = 0; k < 3; k++) putCell(g, cxx - 4, cyy - 9 - k + 1, '█', k % 2 ? C.cane2 : C.cane);
  /* a gingerbread house on the far hill, its windows lit */
  const gx = Math.round(w * 0.46), gy = hz - 2;
  for (let y = gy - 3; y < gy; y++) for (let x = gx; x < gx + 9; x++) putCell(g, x, y, '█', C.house);
  for (let k = 0; k < 5; k++) for (let x = gx + 2 - k; x <= gx + 6 + k; x++) putCell(g, x, gy - 4 - k, '▄', mix(C.house, C.pink, 0.35));
  putCell(g, gx + 2, gy - 2, '▪', C.win); putCell(g, gx + 5, gy - 2, '▪', C.win);
  putCell(g, gx + 4, gy - 1, '▪', C.win);
  for (let x = gx; x < gx + 9; x++) putCell(g, x, gy - 4, '▄', C.frosting);
  if (still) return g;
  /* sprinkles falling, each in its own colour */
  if (rain !== false) {
    const colours = [C.pink, C.sprinkle, C.mint, C.lime, C.honey, C.lavender];
    for (let i = 0; i < Math.round(w * 0.7); i++) {
      const y = Math.round(((i * 23) + clock * (11 + (i % 6) * 4)) % (h + 4)) - 2;
      const x = (i * 37 + Math.round(Math.sin(clock * 0.8 + i) * 2)) % w;
      if (y < 0 || y >= h) continue;
      putCell(g, x, y, i % 3 ? '·' : (i % 2 ? '*' : '+'), colours[i % colours.length]);
    }
  }
  candyEvent(g, w, h, hz, clock, rain);
  /* sugar bubbles drifting up */
  for (let i = 0; i < 4; i++) {
    const y = Math.round(h - ((clock * 4 + i * 11) % (h + 6))), x = Math.round(w * (0.2 + i * 0.2) + Math.sin(clock + i) * 4);
    putCell(g, x, y, '○', C.bubble);
    if (i % 2 === 0) blendCell(g, x, y, C.bubble, 0.1);
  }
  return g;
}

/* ---- mono: a city at night in nothing but greys, windows blinking, a searchlight on the roof ---- */
function cityScene(w, h, rain) {
  const still = UI.scene === 'paused';
  const g = newGrid(w, h), clock = still ? 0 : sceneTime();
  const hz = Math.max(8, Math.round(h * 0.62));
  const C = {
    hi: [5, 5, 7], lo: [48, 48, 58], star: [214, 214, 222], starDim: [88, 88, 98],
    moon: [244, 244, 250], halo: [104, 104, 118], cloud: [56, 56, 68],
    far: [42, 42, 52], farWin: [96, 96, 108], near: [12, 12, 16], nearWin: [236, 236, 242],
    beacon: [255, 255, 255], beam: [196, 196, 210], road: [16, 16, 20], haze: [86, 86, 98],
    rain: [142, 142, 158], rainFaint: [86, 86, 98],
  };
  skyFill(g, hz, [[0, C.hi], [0.65, mix(C.hi, C.lo, 0.6)], [1, C.lo]]);
  starField(g, hz, clock, Math.max(8, Math.round(w / 6)), C.star, C.starDim, 1);
  driftingClouds(g, hz, clock, C.cloud, 3, 29);
  const mx = w - 17, my = 2;
  for (let dy = -2; dy <= 2; dy++) for (let dx = -3; dx <= 3; dx++) {
    const d = Math.sqrt(dx * dx + dy * dy * 2);
    if (d <= 3.4) blendCell(g, mx + dx, my + dy, C.halo, 0.2 * (1 - d / 3.6));
  }
  putCell(g, mx, my, '☾', C.moon);
  /* two rows of buildings, the far row paler, each window with its own life */
  /* only the far skyline is drawn here: the near row is the one the event takes apart and throws */
  for (let layer = 0; layer < 1; layer++) {
    const base = hz - 2, colour = C.far, win = C.farWin;
    let x = -2;
    for (let b = 0; x < w + 4; b++) {
      const bw = 5 + ((b * 7 + layer * 3) % 7), bh = 3 + ((b * 11 + layer * 5) % Math.max(4, Math.round(h * 0.2)));
      const top = base - bh;
      for (let yy = top; yy < base; yy++) for (let xx = x; xx < x + bw; xx++)
        putCell(g, xx, yy, '█', yy === top ? mix(colour, C.moon, 0.22) : colour);
      for (let wy = top + 1; wy < base - 1; wy += 2) for (let wx = x + 1; wx < x + bw - 1; wx += 2) {
        const lit = Math.sin(wy * 3.1 + wx * 1.7 + b + clock * (0.4 + (b % 3) * 0.2)) > (layer ? 0.15 : 0.55);
        if (lit) putCell(g, wx, wy, '▪', win);
      }
      if (layer && b % 3 === 0) {
        for (let k = 1; k <= 3; k++) putCell(g, x + (bw >> 1), top - k, '│', C.far);
        if (Math.sin(clock * 2.4 + b) > 0) putCell(g, x + (bw >> 1), top - 4, '*', C.beacon);
      }
      x += bw + 1;
    }
  }
  /* the street, and its haze */
  for (let y = hz; y < h; y++) {
    const t = (y - hz) / Math.max(1, h - hz);
    for (let x = 0; x < w; x++) g[y][x] = { ch: ' ', fg: null, bg: mix(C.road, C.haze, 0.12 + t * 0.25) };
  }
  for (let x = 0; x < w; x += 6) putCell(g, x, h - 1, '─', mix(C.haze, C.road, 0.3));
  if (still) {
    /* when paused: the intact foreground skyline under the moon — no bomb, no balloon, no moving traffic or searchlight */
    for (const b of cityRow(w, h)) {
      const top = hz - b.hgt;
      for (let yy = top; yy < hz; yy++) for (let xx = b.x; xx < b.x + b.wdt; xx++)
        putCell(g, xx, yy, '█', yy === top ? mix(C.near, C.moon, 0.24) : C.near);
      for (let wy = top + 1; wy < hz - 1; wy += 2) for (let wx = b.x + 1; wx < b.x + b.wdt - 1; wx += 2) {
        if (Math.sin(wy * 3.1 + wx * 1.7 + b.i) > 0.25) putCell(g, wx, wy, '▪', C.nearWin);
      }
    }
    return g;
  }
  cityEvent(g, w, h, hz, clock, rain);
  /* a searchlight on a rooftop, sweeping the low cloud */
  const sx = Math.round(w * 0.22), sy = hz - Math.round(h * 0.32);
  const ang = -Math.PI / 2 + Math.sin(clock * 0.4) * 0.7;
  for (let s = 2; s < Math.round(w * 0.6); s++) {
    const x = Math.round(sx + Math.cos(ang) * s), y = Math.round(sy + Math.sin(ang) * s * 0.8);
    const f = 1 - s / (w * 0.6);
    blendCell(g, x, y, C.beam, 0.2 * f + 0.03);
    blendCell(g, x, y + 1, C.beam, 0.09 * f);
  }
  if (rain !== false) {
    for (let i = 0; i < Math.round(w * 0.5) + 8; i++) {
      const speed = 18 + (i % 6) * 6, span = h + 4;
      const y = Math.floor(((i * 23) % span + clock * speed) % span) - 1;
      if (y < 0 || y >= h) continue;
      const x = (i * 61 + 7) % w, len = 2 + (i % 3);
      for (let k = 0; k < len; k++) putCell(g, x - (k >> 1), y - k, '│', k === 0 ? C.rain : C.rainFaint);
    }
  }
  return g;
}

/* ---- matrix: glyph columns falling into a grid that runs away from you ---- */
/* ---- garden: a raked gravel court at dusk, a torii, bamboo, a pond, blossom on the wind ---- */
function sandAt(hz, h, y) {
  const t = (y - hz) / Math.max(1, h - 1 - hz);
  return mix([176, 168, 148], [214, 206, 186], 0.25 + t * 0.55);
}
function drawTorii(g, x, base, hgt, C, tilt) {
  const lean = tilt || 0;
  /* two heavy posts on stone footings */
  for (const side of [-9, 9]) {
    const off = Math.round(lean * (side > 0 ? 1 : 0.6));
    for (let k = 0; k <= hgt; k++) {
      const y = base - k;
      for (let d = 0; d < 3; d++) putCell(g, x + side + d + off, y, y === base - k ? (d === 0 ? '▀' : '█') : '█', d === 0 ? C.toriiDark : C.torii);
    }
    for (let d = -2; d <= 4; d++) putCell(g, x + side + d, base, '▄', C.stone || C.toriiDark);
  }
  /* the tie beam, and the two beams over the top, the higher one curving up at its ends */
  for (let dx = -9; dx <= 12; dx++) putCell(g, x + dx + Math.round(lean * 0.8), base - Math.round(hgt * 0.62), '█', C.torii);
  for (let dx = -11; dx <= 14; dx++) putCell(g, x + dx + Math.round(lean * 0.9), base - hgt + 2, '█', dx === -11 || dx === 14 ? C.toriiDark : C.torii);
  for (let dx = -14; dx <= 17; dx++) {
    const lift = Math.abs(dx - 1) > 12 ? -1 : 0;
    putCell(g, x + dx + Math.round(lean), base - hgt + lift, '█', dx % 9 === 0 ? C.toriiDark : C.torii);
    putCell(g, x + dx + Math.round(lean), base - hgt + 1 + lift, '▄', C.toriiDark);
  }
  /* a bracket under the top beam at either end */
  for (const side of [-8, 8]) for (let k = 0; k < 2; k++) putCell(g, x + side + Math.round(lean), base - hgt + 2 + k, '█', C.toriiDark);
}
function gardenScene(w, h, rain) {
  const still = UI.scene === 'paused';
  const g = newGrid(w, h), clock = still ? 0 : sceneTime();
  const hz = Math.max(9, h - 7);
  const C = {
    skyHi: [18, 16, 34], skyMid: [58, 44, 74], skyLo: [186, 116, 112], sun: [255, 206, 158],
    hill: [48, 44, 62], hillLit: [104, 92, 112],
    rock: [86, 86, 96], rockLit: [146, 146, 158],
    sandA: [176, 168, 150], sandB: [198, 190, 170], rake: [150, 142, 124],
    moss: [54, 88, 56], mossLit: [96, 148, 84],
    torii: [212, 68, 52], toriiDark: [138, 36, 30],
    bamboo: [88, 126, 64], bambooLit: [158, 196, 102], bambooNode: [66, 96, 52],
    pond: [30, 62, 78], pondLit: [104, 164, 176], stone: [116, 114, 122],
    lantern: [148, 142, 130], glow: [255, 202, 136],
    petal: [246, 176, 198], petalLit: [255, 226, 236], bark: [58, 46, 48], leaf: [74, 64, 92],
  };
  /* the sky, indigo falling to a rose horizon, with the last of the sun going down on the right */
  skyFill(g, hz, [[0, C.skyHi], [0.5, mix(C.skyHi, C.skyMid, 0.85)], [0.84, mix(C.skyMid, C.skyLo, 0.6)], [1, C.skyLo]]);
  const sx = Math.round(w * 0.82), sy = Math.max(2, hz - 4);
  for (let dy = -3; dy <= 3; dy++) for (let dx = -6; dx <= 6; dx++) {
    const d = Math.sqrt((dx / 2) * (dx / 2) + dy * dy);
    if (d > 3) continue;
    putCell(g, sx + dx, sy + dy, d > 2.2 ? '░' : '█', mix(C.sun, C.skyLo, d / 4));
  }
  lampLight(g, sx, sy, 10, 0.13, C.sun);
  for (let i = 0; i < 7; i++) putCell(g, Math.round((i * 43 + 9) % w), 1 + (i % 3), '·', mix(C.skyMid, [255, 246, 226], 0.55));
  /* two thin clouds, drifting */
  for (let b = 0; b < 2; b++) {
    const cy = Math.round(hz * (0.22 + b * 0.2));
    const off = Math.round((clock * (1.2 + b * 0.6)) % (w + 30)) - 15;
    for (let k = 0; k < 26; k++) {
      const x = ((off + k * 2) % w + w) % w;
      blendCell(g, x, cy + Math.round(Math.sin((k + clock) * 0.4) * 0.8), C.skyMid, 0.4);
    }
  }
  /* the hills, one behind the other */
  for (let x = 0; x < w; x++) {
    const y = Math.round(hz - 4 + Math.sin(x * 0.038 + 2.1) * 1.8 + Math.sin(x * 0.011) * 1.4);
    for (let k = y; k < hz; k++) putCell(g, x, k, k === y ? '▄' : '█', k === y ? C.hillLit : mix(C.hill, C.skyMid, 0.3));
  }
  if (!still) { if (rain === false) drawDragon(g, w, hz, clock); }          // the ryū, low in the evening sky, behind the tree
  /* the gravel, raked in rings round two rocks: long curves, not a grid */
  const rx1 = Math.round(w * 0.34), ry1 = hz + (h - hz) * 0.5;
  const rx2 = Math.round(w * 0.62), ry2 = hz + (h - hz) * 0.75;
  for (let y = hz; y < h; y++) {
    const t = (y - hz) / Math.max(1, h - 1 - hz);
    const base = mix(C.sandA, C.sandB, 0.2 + t * 0.5);
    for (let x = 0; x < w; x++) {
      const d = Math.min(Math.hypot((x - rx1) * 0.42, y - ry1), Math.hypot((x - rx2) * 0.42, y - ry2));
      const ring = Math.floor(d + Math.sin(x * 0.25) * 0.2);
      const onLine = ring % 2 === 0;
      g[y][x] = { ch: onLine ? '─' : ' ', fg: onLine ? mix(C.rake, base, 0.35) : null, bg: base };
    }
  }
  /* moss round the rocks, in patches that follow the ground */
  for (const [mx, my, mr] of [[rx1, ry1, 4], [rx2, ry2, 3]]) {
    for (let y = hz; y < h; y++) for (let x = 0; x < w; x++) {
      const d = Math.hypot((x - mx) * 0.45, y - my);
      if (d > mr + 1.6) continue;
      if (((x * 7 + y * 13) % 9) < 2) continue;
      putCell(g, x, y, '░', mix(C.moss, C.mossLit, (x % 4) / 5));
    }
  }
  for (const [mx, my, mr] of [[rx1, ry1, 3], [rx2, ry2, 2]]) {
    for (let dy = -mr - 1; dy <= mr + 1; dy++) for (let dx = -mr * 2 - 1; dx <= mr * 2 + 1; dx++) {
      const d = Math.sqrt((dx / 2) * (dx / 2) + dy * dy);
      if (d > mr + 0.5) continue;
      putCell(g, Math.round(mx + dx), Math.round(my + dy), d > mr - 0.5 ? '▓' : '█', (dy < 0 && dx < 1) ? C.rockLit : mix(C.rock, C.rockLit, 0.18));
    }
  }
  /* stepping stones away to the gate */
  for (let i = 0; i < 6; i++) {
    const t = i / 6;
    const x = Math.round(w * 0.56 - t * w * 0.3 + Math.sin(i * 1.6) * 1.2);
    const y = Math.round(hz + 1 + Math.pow(t, 1.4) * (h - hz - 2));
    for (let dx = -2; dx <= 2; dx++) putCell(g, x + dx, y, dx === -2 ? '▄' : '█', dx === -2 ? C.stone : mix(C.stone, C.sandB, 0.35));
  }
  /* the gate */
  drawTorii(g, Math.round(w * 0.7), hz + 1, Math.max(7, Math.round(h * 0.33)), C, 0);
  /* the cherry tree on the left: a trunk, four branches, and a wide, uneven canopy */
  const tx = Math.round(w * 0.19), ty = hz + 1, th = Math.max(6, Math.round(hz * 0.45));
  for (let y = ty - th; y <= ty; y++) {
    const lean = Math.round(Math.sin(((ty - y) / th) * 1.1) * 1.8);
    putCell(g, tx + lean, y, '█', C.bark);
    putCell(g, tx + lean + 1, y, '█', mix(C.bark, [150, 118, 128], 0.3));
    putCell(g, tx + lean - 1, y, '█', mix(C.bark, [0, 0, 0], 0.25));
  }
  const crownTop = Math.max(1, ty - th - 3);
  for (let dx = -14; dx <= 12; dx++) {
    const depth = Math.round(6.4 - Math.abs(dx) * 0.3 + Math.abs(((dx * 3 + 4) % 5) - 2) * 0.7 + Math.sin(dx * 0.9) * 0.6);
    for (let k = 0; k < depth; k++) {
      const y = crownTop + k;
      const seed = (dx * 13 + k * 7) % 23;
      if (seed === 0) continue;
      if (k === 0 && Math.abs(dx) > 3) continue;
      if ((Math.abs(dx) > 10) && (k < 2 || seed < 9)) continue;                                  // a little air through the leaves
      const petal = 0.55 + 0.35 * Math.sin(dx * 0.7 + k * 0.5);
      putCell(g, tx + dx, y, k === 0 ? '▄' : (seed < 6 ? '░' : '█'), k === 0 ? C.petalLit : mix(C.leaf, C.petal, petal));
    }
  }
  for (const [bx, by, dir] of [[-3, crownTop + 3, -1], [3, crownTop + 2, 1], [-1, crownTop + 5, -1], [2, crownTop + 5, 1]]) {
    for (let k = 1; k <= 4; k++) putCell(g, tx + bx + dir * k, by + k - 1, '▄', C.bark);
  }
  /* bamboo on the right: stalks with their nodes, and a spray of leaves at the top of each */
  for (let i = 0; i < 6; i++) {
    const bx = Math.round(w * 0.9 + (i % 3) * 3 + (i > 2 ? 2 : 0));
    const top = Math.max(0, Math.round(hz - 15 + (i % 4) * 2));
    for (let y = top; y < hz + 1; y++) {
      const sway = Math.round(Math.sin(clock * 0.7 + i * 1.3) * (y < hz - 8 ? 1 : 0));
      putCell(g, bx + sway, y, y % 5 === 0 ? '▄' : '│', y % 5 === 0 ? C.bambooNode : (i % 2 ? C.bamboo : C.bambooLit));
    }
    for (let k = 0; k < 5; k++) {
      const ly = top + k * 2 + (k % 2), side = k % 2 ? 1 : -1;
      const sway2 = Math.round(Math.sin(clock * 0.7 + i * 1.3 + k) * 1.2);
      putCell(g, bx + side * 2 + sway2, ly, '╱', mix(C.bamboo, C.bambooLit, 0.55));
      putCell(g, bx + side * 3 + sway2, ly - 1, '╱', C.bambooLit);
      putCell(g, bx + side * 3 + sway2, ly - 2, '·', mix(C.bamboo, C.bambooLit, 0.35));
      if (k % 2) putCell(g, bx - side * 2 + sway2, ly, '╲', mix(C.bamboo, C.bambooLit, 0.45));
    }
  }
  /* the pond, in the corner, with stones round it and two koi */
  const pcx = Math.round(w * 0.13), pcy = h - 3, prx = Math.max(5, Math.round(w * 0.055)), pry = Math.max(1, Math.round((h - hz) * 0.34));
  for (let y = pcy - pry - 1; y <= Math.min(h - 1, pcy + pry); y++) for (let x = pcx - prx - 1; x <= pcx + prx + 1; x++) {
    const d = Math.hypot((x - pcx) / prx, (y - pcy) / pry);
    if (d > 1.05) continue;
    if (d > 0.92) { putCell(g, x, y, '▓', mix(C.stone, C.sandB, 0.4)); continue; }
    const rip = 0.5 + 0.5 * Math.sin(d * 9 - clock * 1.8);
    g[y][x] = { ch: d > 0.78 && (x + y) % 3 ? '░' : ' ', fg: null, bg: mix(C.pond, C.pondLit, 0.1 + rip * 0.3) };
    if (d > 0.78 && (x + y) % 3) putCell(g, x, y, '░', mix(C.pondLit, C.pond, 0.5));
  }
  if (!still) {
    for (let i = 0; i < 2; i++) {
      const kx = Math.round(pcx + (i ? 3 : -3) + Math.sin(clock * 0.55 + i * 2.2) * 2);
      const ky = Math.round(pcy - 1 + i + Math.cos(clock * 0.45 + i) * 0.8);
      putCell(g, kx, ky, '▄', i ? C.glow : C.petalLit);
      putCell(g, kx + 1, ky, '▄', i ? [255, 238, 206] : C.petal);
      putCell(g, kx + 2, ky, '·', C.pondLit);
    }
  }
  /* the stone lantern, lit */
  const lx = Math.round(w * 0.48), ly = hz + 1;
  putCell(g, lx, ly, '▄', C.lantern); putCell(g, lx + 1, ly, '▄', C.lantern);
  for (let k = 1; k <= 3; k++) putCell(g, lx, ly - k, '█', k === 3 ? C.stone : C.lantern);
  for (let dx = -2; dx <= 2; dx++) putCell(g, lx + dx, ly - 4, '█', Math.abs(dx) === 2 ? C.lantern : C.glow);
  putCell(g, lx, ly - 5, '▄', C.lantern); putCell(g, lx - 1, ly - 5, '▄', C.lantern); putCell(g, lx + 1, ly - 5, '▄', C.lantern);
  lampLight(g, lx, ly - 4, 8, 0.24, C.glow);
  /* blossom on the wind, and a few where it has settled */
  if (!still) {
    for (let i = 0; i < 14; i++) {
      const drift = (tx + 8 + i * 6 + clock * (3 + (i % 3) * 2)) % (w + 20) - 10;
      const x = Math.round(drift);
      const y = Math.round(crownTop + 3 + ((i * 5) % Math.max(4, h - crownTop - 8)) + Math.sin(clock * 1.3 + i) * 1.6);
      putCell(g, x, y, i % 4 === 0 ? '❀' : '·', i % 4 === 0 ? C.petalLit : C.petal);
    }
  }
  for (let i = 0; i < 9; i++) {
    const x = Math.round((tx + 4 + i * 7) % w), y = hz + 1 + ((i * 3) % Math.max(1, h - hz - 1));
    putCell(g, x, y, '·', mix(C.petal, C.sandB, 0.45));
  }
  if (!still) gardenEvent(g, w, h, hz, clock, rain);
  return g;
}
function godzilla(g, cx, feet, clock, C, walking) {
  const sway = Math.round(Math.sin(clock * 1.7) * 1.2);
  const step = walking ? Math.round(Math.sin(clock * 2.2)) : 0;
  if (feet < 6) return;
  /* the tail, sweeping out to the left and tapering away */
  for (let k = 0; k < 26; k++) {
    const x = cx - 8 - k;
    const y = feet - 7 + Math.round(Math.sin(k * 0.2 + clock * 1.1) * 2.6 - k * 0.05);
    const th = Math.max(0, Math.round(3 - k * 0.12));
    for (let d = -th; d <= th; d++) putCell(g, x, y + d, d === -th ? '▀' : (d === th ? '▄' : '█'), d === -th ? C.lit : C.body);
  }
  /* the body: a tapering stack of rows, widest at the chest, with a lit edge down the near side */
  const top = feet - 20;
  const rows = [[0, 3], [1, 5], [2, 6], [3, 6], [4, 5], [5, 4], [6, 7], [7, 9], [8, 10], [9, 11], [10, 11], [11, 10], [12, 9], [13, 8], [14, 7]];
  for (const [dy, hw] of rows) {
    const y = top + dy;
    if (y < 0 || y >= g.length) continue;
    for (let dx = -hw; dx <= hw; dx++) {
      const edge = dx === -hw, far = dx === hw;
      putCell(g, cx + dx + sway, y, edge ? '▀' : far ? '▄' : '█', edge ? C.lit : far ? mix(C.body, C.lit, 0.25) : C.body);
      if (dy > 8 && Math.abs(dx) < hw - 3 && (dx + dy) % 7 === 0) putCell(g, cx + dx + sway, y, '▒', mix(C.body, C.lit, 0.18));
    }
  }
  /* the jaw, teeth, and the eye that catches the last of the light */
  for (let dx = -2; dx <= 5; dx++) putCell(g, cx + dx + sway, top + 4, '▄', C.mouth);
  for (let dx = -1; dx <= 4; dx += 1) if (dx % 2) putCell(g, cx + dx + sway, top + 3, '·', C.teeth);
  putCell(g, cx + 3 + sway, top + 1, '▪', C.eye);
  lampLight(g, cx + 3, top + 1, 6, 0.26, C.eye);
  for (let dx = 4; dx <= 6; dx++) putCell(g, cx + dx + sway, top + 1, '▄', mix(C.body, C.plate, 0.4));
  /* the dorsal plates running down the spine, each one further out than the last */
  for (let i = 0; i < 10; i++) {
    const dy = 1 + i * 1.4;
    let hw = 4;
    for (const [ry, rhw] of rows) if (Math.abs(ry - dy) < 1) hw = rhw;
    const y = Math.round(top + dy);
    putCell(g, cx + hw + 1 + sway, y, '◤', C.plate);
    putCell(g, cx + hw + 2 + sway, y, '▄', C.plate);
    if (i % 2 === 0) putCell(g, cx + hw + 1 + sway, y - 1, '▄', mix(C.plate, C.lit, 0.5));
  }
  /* the arms, small and clawed, held up in front */
  for (const side of [1, -1]) {
    const ax = cx + side * 6 + sway;
    for (let k = 0; k < 3; k++) putCell(g, ax + side * (k > 1 ? 1 : 0), top + 9 + k, '█', k === 2 ? C.claw : C.lit);
    putCell(g, ax + side, top + 12, '·', C.claw);
  }
  /* the legs, and the feet */
  const legY = top + 14;
  for (const side of [-1, 1]) {
    const off = side * 6 + (side > 0 ? step : -step);
    for (let y = legY; y < feet; y++) for (let d = -3; d <= 3; d++) {
      putCell(g, cx + off + d + sway, y, d === -3 ? '▀' : d === 3 ? '▄' : '█', d === -3 ? C.lit : C.body);
    }
    for (let d = -4; d <= 4; d++) putCell(g, cx + off + d + sway, feet, '█', d === -4 ? C.lit : C.claw);
    for (let d = -3; d <= 3; d++) if ((d + 5) % 2) putCell(g, cx + off + d + sway, feet + 1, '▄', C.body);
  }
}
/* ---------- the monks ----------
   Saffron tunics to the knee over bare legs, a dark sash, straw sandals, a shaved head. Each cell says which part it
   is, so the robe, the skin, the sash, the sandals and the eye are painted separately and nobody looks undressed.   */
const MONK_ART = { '█': 'robe', '▓': 'robeDark', '▄': 'sash', '.': 'skin', 'n': 'skinDark', '▪': 'sandal', 'o': 'eye', '●': 'eyeLit' };
const MONK_STAND = [
  '  ....  ',
  ' ...... ',
  ' .o..o. ',
  ' ...... ',
  ' ▄████▄ ',
  ' ██████ ',
  ' ▄▄▄▄▄▄ ',
  ' ██████ ',
  ' ▪▪  ▪▪ ',
];
const MONK_WALK = [
  '  ....  ',
  ' ...... ',
  ' .o..o. ',
  ' ...... ',
  ' ▄████▄ ',
  ' ██████ ',
  ' ▄▄▄▄▄▄ ',
  ' ██████ ',
  '▪▪    ▪▪',
];
const MONK_RUN = [
  '  ....  ',
  ' ...... ',
  ' .o..o. ',
  ' ...... ',
  '▄█████▄ ',
  '███████ ',
  '▄▄▄▄▄▄▄ ',
  '███████ ',
  '▪▪  ▪▪▪ ',
];
const MONK_REACH = [
  '  ....   ',
  ' ......  ',
  ' .o..o.  ',
  ' ......  ',
  ' ▄████▄  ',
  ' ██████▪ ',
  ' ▄▄▄▄▄▄  ',
  ' ██████  ',
  ' ▪▪  ▪▪  ',
];
const MONK_LUNGE = [
  '  ....   ',
  ' ......  ',
  ' .o..o.  ',
  ' ......  ',
  ' ▄████▄  ',
  '███████▪ ',
  '▄▄▄▄▄▄▄  ',
  ' ██████  ',
  '▪▪    ▪▪ ',
];
const MONK_SIT = [
  '  ....   ',
  ' ......  ',
  ' .o..o.  ',
  ' ......  ',
  ' ▄████▄  ',
  ' ███████ ',
  ' ▄▄▄▄▄▄▄ ',
  ' ▪▪▪▪▪▪▪ ',
];
const MONK_BURNT = [
  '  ▓▓▓▓  ',
  ' ▓▓▓▓▓▓ ',
  ' ▓▓▓▓▓▓ ',
  ' ▓▓▓▓▓▓ ',
  '▓▓▓▓▓▓▓▓',
  '▓▓▓▓▓▓▓▓',
  '▓▓▓▓▓▓▓▓',
  '▓▓▓▓▓▓▓▓',
  ' ▓▓  ▓▓ ',
];
function drawMonk(g, x, feet, rows, P) {
  const top = feet - rows.length + 1;
  for (let r = 0; r < rows.length; r++) for (let c = 0; c < rows[r].length; c++) {
    const ch = rows[r][c];
    if (ch === ' ') continue;
    putCell(g, x + c, top + r, ch, P[MONK_ART[ch]] || P.robe);
  }
  return top;
}
/* his eyes, closed or open — the only thing that has to be legible for the joke to land */
function monkEyes(g, x, top, open, P) {
  for (const dx of [2, 5]) {
    putCell(g, x + dx, top + 2, '▪', open ? P.eyeLit : P.eye);
    if (open) blendCell(g, x + dx, top + 2, P.eyeLit, 0.35);
  }
}
/* a staff, held out level, because that is what they came out with */
function staff(g, x, y, len, lean, P) {
  for (let k = 0; k < len; k++) putCell(g, x + Math.round(k * lean), y - Math.round(k * 0.1), '│', P.wood);
  putCell(g, x - 1, y + 1, '▪', P.wood);
  putCell(g, x + len, y, '▪', P.wood);
}
/* a frog, four cells wide and two tall, eyes up: the whole prank in four characters */
function frog(g, x, y, C, blink) {
  putCell(g, x, y, '█', C.frog); putCell(g, x + 1, y, '█', C.frogLit);
  putCell(g, x + 2, y, '█', C.frog); putCell(g, x + 3, y, '▄', C.frog);
  putCell(g, x - 1, y + 1, '▄', C.frogLit); putCell(g, x + 4, y + 1, '▄', C.frogLit);
  putCell(g, x, y - 1, '▪', C.frogLit); putCell(g, x + 3, y - 1, '▪', C.frogLit);
  if (blink) { putCell(g, x, y - 1, '▄', C.ink); putCell(g, x + 3, y - 1, '▄', C.ink); }
}
/* ---------- the dragon ----------
   A ryū in the evening sky: a long serpent of a body that ripples as it goes, a gold belly, a fin of spines down
   its back, four short clawed legs, antlers swept back from the head, and whiskers trailing forward. It keeps to
   the upper sky so it never collides with the gate or the tree.                                                  */
function drawDragon(g, w, hz, clock) {
  const D = {
    body: [52, 132, 116], dark: [26, 88, 80], lit: [126, 208, 176], belly: [236, 208, 144],
    horn: [226, 190, 132], eye: [255, 224, 128], whisker: [206, 232, 200], fin: [242, 158, 96],
  };
  const baseY = Math.max(3, Math.round(hz * 0.3));
  const N = Math.max(26, Math.round(w * 0.5));
  const head = Math.round(-18 + ((clock * 2.4) % (w + 70)));
  const pt = i => [
    Math.round(head + i * 1.1),
    Math.round(baseY + Math.sin(i * 0.26 + clock * 1.1) * 2.6 + Math.sin(i * 0.09 - clock * 0.55) * 1.6),
  ];
  /* the body, from the tail end forward, so the head and legs sit over it */
  for (let i = N; i >= 2; i--) {
    const [x, y] = pt(i);
    if (x < -3 || x >= w + 3 || y < 2 || y > hz - 2) continue;
    const taper = i > N - 10 ? (N - i) / 10 : 0;      // the last ten links thin to a whip
    const wide = taper > 0.6 ? 0 : 1;
    for (let d = -wide; d <= wide; d++) {
      const ch = d === -wide ? '▀' : d === wide ? '▄' : '█';
      putCell(g, x, y + d, ch, d === -wide ? D.lit : d === wide ? D.belly : D.body);
      if (d === 0 && i % 4 === 0) putCell(g, x, y, '░', D.dark);
    }
    /* the fin down the spine, and the legs */
    if (i % 6 < 3 && wide) putCell(g, x, y - 2, '▄', D.fin);
    if (i === 9 || i === 22 || i === 35 || i === Math.round(N * 0.8)) {
      putCell(g, x - 1, y + 2, '█', D.body); putCell(g, x, y + 3, '█', D.body);
      putCell(g, x - 2, y + 4, '▪', D.horn); putCell(g, x, y + 4, '▪', D.horn);
    }
  }
  /* the head, facing the way it is going */
  const [hx, hy] = pt(1);
  const HEAD = [
    '  ▄▄▄▄  ',
    ' ██████▄',
    '████████',
    '████●███',
    ' ███████',
    '  ▀▀▀▀▀ ',
  ];
  for (let r = 0; r < HEAD.length; r++) for (let c = 0; c < HEAD[r].length; c++) {
    const ch = HEAD[r][c];
    if (ch === ' ') continue;
    putCell(g, hx + c, hy - 2 + r, ch, ch === '●' ? D.body : (r === 0 ? D.lit : (r === 5 ? D.belly : D.body)));
  }
  putCell(g, hx + 4, hy + 1, '▪', D.eye);
  blendCell(g, hx + 4, hy + 1, D.eye, 0.3);
  /* the jaw, open */
  for (let c = 0; c < 4; c++) putCell(g, hx + 5 + c, hy + 2, '▄', D.dark);
  /* antlers, swept back off the crown */
  for (let k = 0; k < 5; k++) {
    putCell(g, hx + 3 - k, hy - 4 - Math.min(2, k), '▄', D.horn);
    putCell(g, hx + 5 - k, hy - 3 - k, '▄', D.horn);
  }
  /* whiskers, curling ahead of the snout */
  for (let k = 0; k < 5; k++) putCell(g, hx + 8 + k, hy + (k > 2 ? k - 2 : 0), '·', D.whisker);
  for (let k = 0; k < 3; k++) putCell(g, hx + 1, hy + 3 + k, '·', D.whisker);
  lampLight(g, hx + 4, hy + 1, 7, 0.07, D.lit);
}
function gardenEvent(g, w, h, hz, clock, rain) {
  const wet = rain !== false;
  const C = {
    petal: [246, 176, 198], petalLit: [255, 228, 236], plank: [104, 84, 74],
    body: [38, 44, 56], lit: [118, 126, 150], plate: [162, 170, 192], claw: [92, 96, 112],
    teeth: [226, 232, 244], eye: [255, 190, 88], mouth: [38, 18, 22],
    fire: [255, 148, 52], ember: [255, 92, 38], smoke: [92, 92, 106], ash: [74, 70, 76],
    robe: [230, 134, 46], robeDark: [176, 90, 30], robeLit: [255, 190, 106], sash: [92, 62, 44],
    skin: [228, 190, 152], sandal: [118, 94, 60], monkEye: [40, 28, 24], eyeLit: [255, 244, 198], wood: [138, 108, 70],
    charred: [52, 44, 40], charredLit: [112, 80, 58],
    incense: [146, 126, 116], smokeLight: [188, 186, 198], frog: [116, 172, 92], frogLit: [190, 232, 140],
    sand: [196, 188, 168], ink: [52, 44, 40],
  };
  const gy = Math.min(h - 2, hz + 4), u = evAt(clock, 26);
  const M = { robe: C.robe, robeDark: C.robeDark, robeLit: C.robeLit, sash: C.sash, skin: C.skin, sandal: C.sandal, eye: C.monkEye, eyeLit: C.eyeLit, wood: C.wood };

  if (!wet) {
    /* ---------------- peace: the master, the brothers, and the frog ---------------- */
    const cx = Math.round(w * 0.46);
    /* the stone he sits on, and the little bowl set out in front of it */
    for (let dx = -6; dx <= 6; dx++) putCell(g, cx + dx, gy + 1, '█', dx === -6 ? C.lit : C.plank);
    putCell(g, cx + 7, gy, '▄', C.ink); putCell(g, cx + 8, gy, '▄', C.ink);
    const top = drawMonk(g, cx - 4, gy, MONK_SIT, M);
    monkEyes(g, cx - 4, top, false, M);
    /* asleep: the z's say so, so the frog and the opening eyes have something to break */
    if (u < 10.6) for (let k = 0; k < 3; k++) {
      const zt = (clock * 0.4 + k * 0.33) % 1;
      putCell(g, Math.round(cx + 3 + zt * 5), Math.round(top - 1 - zt * 4), 'z', mix(C.smokeLight, C.petalLit, zt));
    }
    /* the incense, and its one thread of smoke */
    for (let k = 0; k < 3; k++) putCell(g, cx - 10, gy - k, '│', C.incense);
    for (let k = 0; k < 14; k++) {
      const x = cx - 10 + Math.round(Math.sin(k * 0.5 + clock * 0.7) * (1 + k * 0.2));
      putCell(g, x, gy - 4 - k, k > 8 ? '░' : '·', mix(C.smokeLight, C.petal, 0.25 + k / 18));
    }
    /* the brothers in from either side, on tiptoe, and then bolting for the gate */
    const creep = ease(clamp01((u - 2.5) / 4.6));
    const bolt = ease(clamp01((u - 13.4) / 2.4));
    const lx = Math.round(-12 + creep * (cx - 20) - bolt * (w * 0.55));
    const rx = Math.round(w + 10 - creep * (w - cx - 12) + bolt * (w * 0.55));
    if (u > 2.4) {
      const rows = bolt > 0 ? MONK_RUN : (u > 6.8 && u < 10 ? MONK_REACH : MONK_WALK);
      const lt = drawMonk(g, lx, gy, rows, M);
      monkEyes(g, lx, lt, bolt > 0, M);
      if (u > 6.8 && u < 10) putCell(g, lx + 8, gy - 5, '▪', C.skin);      // the hand holding the frog up
      if (u > 6.8 && u < 12) putCell(g, lx + 3, gy - 10, '·', C.smokeLight);  // a held breath
    }
    if (u > 3.2) {
      const rt = drawMonk(g, rx, gy, bolt > 0 ? MONK_RUN : MONK_WALK, M);
      monkEyes(g, rx, rt, bolt > 0, M);
      if (u > 3.4 && u < 6.4) putCell(g, rx - 2, gy - 10, '·', C.smokeLight);  // shhh
    }
    /* the frog: up in his hands, then carried over, then squatting on the master's head */
    if (u > 6.8 && u < 10) {
      const f = clamp01((u - 7.4) / 2.4);
      const fx = Math.round(lx + 5 + f * (cx - 3 - (lx + 5)));
      const fy = Math.round(gy - 10 + f * 1.2 - Math.sin(f * Math.PI) * 1.2);
      frog(g, fx, fy, C, false);
    }
    if (u >= 10 && u < 21.5) {
      const landed = u > 10.4;
      const hop = u > 16.6 ? Math.round(Math.abs(Math.sin((u - 16.6) * 2.6)) * 2) : 0;
      const fx = u > 16.6 ? Math.round(cx - 1 + (u - 16.6) * 1.5) : cx - 2;
      const fy = u > 16.6 ? gy - 1 - hop : (landed ? gy - 8 : gy - 9);
      frog(g, fx, fy, C, Math.sin(clock * 2.4) > 0.98);
    }
    /* he opens his eyes, and the two of them freeze where they stand */
    if (u > 10.8) {
      monkEyes(g, cx - 4, top, true, M);
      if (u < 15) blendCell(g, cx - 2, top + 2, [255, 240, 190], 0.2);
    }
    if (u > 11.2 && u < 13.8) {
      drawWord(g, lx + 2, gy - 14, '!', C.robeLit);
      drawWord(g, rx + 2, gy - 14, '!', C.robeLit);
    }
    /* dust where they were standing a moment ago */
    if (u > 13.4 && u < 17) {
      const t = clamp01((u - 13.4) / 3.6);
      for (let i = 0; i < 7; i++) {
        putCell(g, Math.round(lx + 4 - t * 10 + i), gy - (i % 2), '░', mix(C.sand, C.ash, 0.35 + t * 0.3));
        putCell(g, Math.round(rx + 4 + t * 10 - i), gy - (i % 2), '░', mix(C.sand, C.ash, 0.35 + t * 0.3));
      }
    }
    if (u > 21.5) {
      /* the frog on the stone beside him, and the corner of his mouth turned up */
      frog(g, cx + 7, gy - 1, C, false);
      putCell(g, cx - 1, top + 3, '▄', mix(C.skin, [255, 220, 196], 0.5));
      for (let i = 0; i < 7; i++) {
        const x = Math.round(cx + Math.sin(clock * 0.7 + i) * 16), y = Math.round(gy - 15 + Math.cos(clock + i) * 4);
        putCell(g, x, y, '·', C.petalLit);
      }
    }
    return;
  }

  /* ---------------- rain: the monster, and the monks who go out to meet it ---------------- */
  if (u > 0.6) {
    const k = clamp01((u - 0.6) / 2);
    for (let i = 0; i < 30; i++) {
      const x = Math.round((i * 37 + 11) % w);
      const y = hz + 1 + ((i * 13) % Math.max(1, h - hz - 1));
      if ((i + Math.floor(clock * 6)) % 3) continue;
      putCell(g, x, y, '░', mix(C.sand, C.ash, 0.5 * k));
    }
    for (let x = 0; x < w; x++) blendCell(g, x, hz + 1, C.ash, 0.12 * k);
  }
  const enter = ease(clamp01((u - 1.6) / 6.5));
  const leave = ease(clamp01((u - 21) / 4.5));
  const gx = Math.round(w + 16 - enter * (w * 0.42) + leave * (w * 0.6));
  const feet = Math.min(h - 1, hz + 3);
  /* the gate goes under one foot */
  if (u > 9.4) {
    const tx = Math.round(w * 0.7), tot = Math.max(7, Math.round(h * 0.33));
    for (let y = Math.max(0, hz - 3); y < hz + 2; y++) for (let x = Math.max(0, tx - 13); x <= Math.min(w - 1, tx + 13); x++) {
      const t = (y - hz) / Math.max(1, h - 1 - hz);
      if (y >= hz) { const base = mix([176, 168, 150], [198, 190, 170], 0.4 + t * 0.4); g[y][x] = { ch: ' ', fg: null, bg: base }; }
      else g[y][x] = { ch: ' ', fg: null, bg: mix([48, 44, 62], [104, 92, 112], 0.4) };
    }
    const fall = clamp01((u - 9.4) / 2);
    for (let k = 0; k <= Math.round(tot * (1 - fall * 0.85)); k++) putCell(g, tx - 8, hz + 1 - k, '█', C.body);
    for (let d = 0; d <= Math.round(tot * 0.85); d++) putCell(g, tx - 6 + d, hz + 1 + Math.round(d * 0.1), '█', mix(C.body, C.lit, 0.25));
    for (let d = -10; d <= 10; d++) putCell(g, tx + d, hz, d % 7 === 0 ? '▄' : '█', C.body);
    for (let i = 0; i < 12; i++) putCell(g, tx - 12 + i * 2, hz - (i % 2), '░', C.ash);
  }
  if (u > 1.4) {
    const shake = u > 1.6 && u < 21 ? Math.round(Math.sin(clock * 8) * 0.8) : 0;
    godzilla(g, gx + shake, feet, clock, C, enter < 1);
    for (let i = 0; i < 14; i++) {
      const x = Math.round(gx - 10 + (i * 5) % 22), y = feet + (i % 2);
      if (y >= h) continue;
      putCell(g, x, y, i % 3 ? '░' : '▒', mix(C.ash, C.sand, 0.55));
    }
    for (let k = 0; k < 14; k++) blendCell(g, Math.max(0, gx - 20 - k), feet + 1, [24, 20, 28], 0.16 * (1 - k / 14));
  }
  /* ---- three of them go out with staves, and stand their ground ---- */
  const run = ease(clamp01((u - 3.2) / 3.2));
  const spots = [Math.round(w * 0.27), Math.round(w * 0.39), Math.round(w * 0.51)];
  const burntAt = 13.4;
  for (let i = 0; i < 3; i++) {
    const startX = -12 - i * 10;
    const x = Math.round(startX + run * (spots[i] - startX));
    if (x < -10 || x > w) continue;
    const caught = u > burntAt + i * 0.3;
    if (caught) {
      drawMonk(g, x, gy, MONK_BURNT, { robe: C.charred, robeDark: [34, 28, 26], robeLit: C.charredLit, sash: [34, 28, 26], skin: C.charredLit, sandal: [34, 28, 26], eye: [24, 20, 18], eyeLit: C.ember, wood: [66, 50, 40] });
      /* embers coming off what is left of him */
      if (Math.sin(clock * 3 + i) > 0) for (let k = 0; k < 3; k++) {
        const t = (clock * 2 + k * 0.5 + i) % 1;
        putCell(g, x + 2 + ((i * 3 + k) % 5), gy - 8 - Math.round(t * 6), '░', mix(C.ember, C.ash, t));
      }
      continue;
    }
    const pose = u < 6.6 ? MONK_RUN : (u > 11.4 && u < burntAt ? MONK_LUNGE : MONK_STAND);
    const mt = drawMonk(g, x, gy, pose, M);
    monkEyes(g, x, mt, u > 11 || u < 6, M);
    /* the staff, levelled at the thing coming out of the sea */
    const thrust = u > 11.4 && u < burntAt ? Math.round(Math.sin((u - 11.4) * 6)) : 0;
    staff(g, x + (pose === MONK_LUNGE ? 8 : 7) + thrust, gy - 5, 10, 0.08, C);
    if ((u > 5 && u < 7.4) || (u > 11.6 && u < 12.6)) drawWord(g, x + 2, gy - 12, '!', C.robeLit);
  }
  /* ---- the breath: a cone that comes down the bank and catches them at chest height ---- */
  if (u > 11.6 && u < 18.5) {
    const f = clamp01((u - 11.6) / 0.9) * clamp01((18.5 - u) / 1.6);
    const hx = Math.round(gx - 9), hy = Math.round(feet - 14);
    const len = Math.min(w - 2, Math.round(w * 0.5));
    for (let k = 0; k < len; k++) {
      const x = hx - k;
      if (x < 1) break;
      const spread = 0.55 + k * 0.09;
      const th = Math.max(1, Math.round(spread * f));
      const y = hy + Math.round(k * 0.26) + Math.round(Math.sin(k * 0.5 + clock * 6) * spread * 0.5);
      for (let d = -th; d <= th; d++) {
        if (Math.abs(d) === th && (k + d) % 3) continue;
        const core = Math.abs(d) <= th - 2 && k < len * 0.7;
        putCell(g, x, y + d, Math.abs(d) === th ? '░' : (k % 5 ? '█' : '▓'),
          core ? mix([255, 238, 178], C.fire, Math.min(1, k / len)) : mix(C.fire, C.ember, 0.15 + (k / len) * 0.75));
      }
    }
    lampLight(g, hx - 8, hy + 4, 14, 0.3 * f, C.fire);
    const tx2 = Math.round(w * 0.19), crownTop2 = Math.max(1, Math.round(hz * 0.42) - 5);
    const burn = clamp01((u - 12.6) / 3.2);
    for (let dx = -11; dx <= 11; dx++) {
      const depth = Math.round(5.2 - Math.abs(dx) * 0.34);
      for (let k = 0; k < depth; k++) {
        if (k / Math.max(1, depth) > burn) continue;
        putCell(g, tx2 + dx, crownTop2 + k, k % 2 ? '▓' : '█', mix(C.ember, C.fire, ((dx + k) % 3) / 3));
      }
      if (burn > 0.35 && Math.abs(dx) < 9) flame(g, tx2 + dx, crownTop2 + 2, 2 + (Math.abs(dx) % 3), clock, C.fire, C.ember, dx);
    }
  }
  /* the flare where each of them is caught, one after another */
  if (u > 13.2 && u < 16.6) {
    for (let i = 0; i < 3; i++) {
      const t = clamp01((u - 13.4 - i * 0.3) / 1.2);
      const x = spots[i] + 4;
      if (t <= 0) continue;
      for (let k = 0; k < 16; k++) {
        const a = k * 0.8;
        const r = 2 + t * 6 * (1 + (k % 3) * 0.4);
        putCell(g, Math.round(x + Math.cos(a) * r), Math.round(gy - 4 + Math.sin(a) * r * 0.6), k % 3 ? '·' : '✦', mix(C.fire, C.ember, t));
      }
      lampLight(g, x, gy - 4, 10, 0.32 * (1 - t), C.fire);
    }
  }
  if (u > 16) {
    const t = clamp01((u - 16) / 9);
    plume(g, Math.round(w * 0.19), Math.max(2, hz - 3), Math.round(9 + t * 9), clock, C.smoke, C.smokeLight, 0.25);
    plume(g, Math.round(w * 0.3), gy - 2, Math.round(5 + t * 4), clock, C.smoke, C.smokeLight, 0.15);
    plume(g, Math.round(w * 0.44), gy - 3, Math.round(4 + t * 4), clock, C.smoke, C.smokeLight, 0.2);
    if (u > 18) plume(g, Math.round(w * 0.7), hz, 7, clock, C.smoke, C.smokeLight, 0.1);
    for (let i = 0; i < 26; i++) {
      const x = Math.round((i * 41 + 13) % w), y = Math.round((clock * (3 + (i % 3)) + i * 7) % Math.max(2, h));
      putCell(g, x, y, '·', mix(C.ash, C.smokeLight, 0.4));
    }
  }
}

function matrixScene(w, h, rain) {
  const still = UI.scene === 'paused';
  const g = newGrid(w, h), clock = still ? 0 : sceneTime();
  const hz = Math.max(6, h - 5);
  const C = {
    hi: [2, 8, 5], lo: [6, 26, 14], head: [206, 255, 220], bright: [112, 255, 152],
    mid: [52, 188, 96], dim: [22, 104, 54], grid: [34, 132, 72], line: [140, 255, 180],
  };
  skyFill(g, hz, [[0, C.hi], [0.7, mix(C.hi, C.lo, 0.7)], [1, C.lo]]);
  if (still) {
    starField(g, hz, 0, Math.max(8, Math.round(w / 6)), C.bright, C.dim, 11);
  } else {
    const GLYPHS = 'ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜﾝ0123456789:=+*';
    const cols = Math.max(6, Math.floor(w * 0.75));
    for (let i = 0; i < cols; i++) {
      const x = Math.floor(i * (w / cols)) + (i % 2);
      const speed = 5 + ((i * 7) % 9), len = 8 + ((i * 5) % 12);
      const head = Math.floor((clock * speed + i * 3.3) % (hz + len)) - len;
      for (let k = 0; k < len; k++) {
        const y = head - k;
        if (y < 0 || y >= hz) continue;
        const t = k / len;
        const ch = GLYPHS[(y * 7 + i * 13 + Math.floor(clock * 6)) % GLYPHS.length];
        putCell(g, x, y, ch, k === 0 ? C.head : t < 0.4 ? C.bright : t < 0.75 ? C.mid : C.dim);
      }
    }
  }
  /* the floor: lines running to a vanishing point, and bars across them */
  for (let i = -6; i <= 6; i++) {
    for (let s = 0; s < 40; s++) {
      const t = s / 40;
      putCell(g, Math.round(w / 2 + i * t * (w / 7)), Math.round(hz + t * (h - hz)), '·', mix(C.grid, C.hi, 0.45));
    }
  }
  for (let k = 1; k <= 3; k++) {
    const y = Math.round(hz + Math.pow(k / 3, 1.7) * (h - hz));
    for (let x = 0; x < w; x++) if ((x + Math.round(clock * 4)) % 5) putCell(g, x, y, '─', mix(C.grid, C.hi, 0.3));
  }
  for (let x = 0; x < w; x++) putCell(g, x, hz, '▄', mix(C.line, C.mid, 0.35));
  if (still) return g;
  /* a scan line, sweeping down */
  const sy = Math.round((clock * 9) % h);
  for (let x = 0; x < w; x++) blendCell(g, x, sy, C.line, 0.16);
  matrixEvent(g, w, h, hz, clock, rain);
  return g;
}

/* ---- plain: a quiet moonlit field, a fence, one tree, grass moving in the wind ---- */
function meadowScene(w, h, rain) {
  const still = UI.scene === 'paused';
  const g = newGrid(w, h), clock = still ? 0 : sceneTime();
  const hz = Math.max(7, h - 4);
  const C = {
    hi: [20, 14, 54], lo: [104, 62, 96], star: [255, 248, 230], starDim: [142, 138, 196],
    moon: [255, 246, 214], halo: [188, 166, 222], cloud: [92, 68, 132],
    far: [64, 50, 104], farRim: [152, 140, 214], mid: [42, 78, 62], midRim: [122, 196, 154],
    near: [20, 34, 32], grass: [130, 186, 124], grassDim: [68, 106, 78], tree: [14, 20, 26],
    treeRim: [176, 196, 236], fence: [132, 106, 104], moth: [255, 242, 190], path: [122, 98, 122],
  };
  /* the lights, hanging in curtains over the long field */
  auroraSky(g, hz, clock);
  /* two ridges, the far one lighter */
  ridgeLine(g, hz, hz - 5.4, 1.7, 0.05, C.far, C.farRim, clock, 1.7);
  ridgeLine(g, hz, hz - 2.8, 1.1, 0.085, C.mid, C.midRim, clock, 4.3);
  /* the field, with a path running away to the horizon */
  for (let y = hz; y < h; y++) {
    const t = (y - hz) / Math.max(1, h - hz);
    const half = Math.round(t * (w * 0.2)) + 1;
    const cx2 = Math.round(w * 0.42 + t * w * 0.1);
    for (let x = 0; x < w; x++) {
      const onPath = Math.abs(x - cx2) <= half;
      const n = (x * 13 + y * 29) % 23;
      let col = onPath ? mix(C.path, C.near, 0.15 + t * 0.2) : mix(C.near, C.mid, t * 0.4);
      if (!onPath && n === 0) col = mix(col, C.grassDim, 0.35);
      g[y][x] = { ch: ' ', fg: null, bg: col };
    }
  }
  /* one tree, big, standing over the field with the moon behind its edge */
  const tx = Math.round(w * 0.22);
  for (let y = Math.round(hz * 0.35); y < hz; y++) {
    const lean = Math.round(Math.sin((y / hz) * 1.3) * 1.4);
    putCell(g, tx + lean, y, '█', C.tree);
    putCell(g, tx + lean + 1, y, '█', mix(C.tree, C.treeRim, 0.3));
    if (y % 7 === 0) {
      const side = y % 14 ? 1 : -1;
      for (let b = 1; b <= 3; b++) putCell(g, tx + lean + side * b, y - b, '▄', C.tree);
    }
  }
  /* a canopy of leaves, not a ball: each column reaches its own depth, with a lit edge */
  const crownTop = Math.round(hz * 0.3) - 4;
  for (let dx = -7; dx <= 7; dx++) {
    const lean2 = Math.round(Math.sin((hz * 0.3) / hz * 1.3) * 1.4);
    const depth = Math.round(5.5 - Math.abs(dx) * 0.55 + Math.abs(((dx * 3 + 5) % 5) - 2) * 0.7 + Math.sin(dx * 1.3) * 0.8);
    for (let k = 0; k < depth; k++) {
      if (depth - k === 1 && Math.abs(dx) > 5) continue;          // ragged tips
      const y = crownTop + k;
      putCell(g, tx + lean2 + dx, y, k === 0 ? '▄' : (((dx + k) % 5 === 0) ? '░' : '█'), k === 0 ? C.treeRim : C.tree);
    }
  }
  for (let b = 0; b < 3; b++) {                                    // branches under the leaves
    const side = b % 2 ? 1 : -1, y = crownTop + 5 + b;
    for (let k = 1; k <= 3; k++) putCell(g, tx + side * (2 + k), y - k, '▄', C.tree);
  }
  /* a fence running away toward the horizon */
  for (let i = 0; i < 10; i++) {
    const t = i / 10, x = Math.round(w * 0.86 - t * w * 0.5), y = Math.round(hz + 1 + Math.pow(1 - t, 1.6) * (h - hz - 2));
    if (x < 0 || x >= w) continue;
    putCell(g, x, y, '│', C.fence);
    putCell(g, x, y - 1, '─', C.fence);
    putCell(g, x + 3, y - 1, '─', C.fence);
  }
  /* grass along the bottom, moving with the wind */
  for (let x = 0; x < w; x++) {
    const hgt = 1 + ((x * 7) % 3), sway = Math.round(Math.sin(clock * 1.2 + x * 0.2) * 0.7);
    for (let k = 0; k < hgt; k++) putCell(g, x + sway, h - 1 - k, k === hgt - 1 ? '╱' : '│', k === hgt - 1 ? C.grass : C.grassDim);
  }
  if (still) return g;
  meadowEvent(g, w, h, hz, clock, rain);
  /* a moth or two, white against the dark */
  for (let i = 0; i < 3; i++) {
    const x = Math.round(w * 0.55 + Math.sin(clock * 0.6 + i * 2.4) * w * 0.22);
    const y = Math.round(hz - 3 + Math.sin(clock * 1.3 + i) * 2.5);
    putCell(g, x, y, '·', C.moth);
    blendCell(g, x, y, C.moth, 0.12);
  }
  return g;
}

/* ---------- the centre of the picture ----------
   The weather is the mood; this is the thing you watch. Every theme keeps one long set piece in the middle of the
   frame, written from the clock alone: with rain it is a tragedy that plays out from beginning to end, without rain
   it is something quiet and good. Nothing pops in or out — every entrance and exit is eased — and nothing here may
   ever throw: the caller wraps it, and a failure leaves the picture underneath exactly as it was.
   Figures are small on purpose. A person is six cells wide and eight tall, which is enough for a hat, a coat, two
   arms and two legs, and it lets a dozen of them share a frame with a truck, a house and an animal.              */
const EVENT_LEN = 26;                                   // seconds in one turn of a central set piece
const evAt = (clock, len) => { const L = len || EVENT_LEN; return ((clock % L) + L) % L; };
const evU = (clock, len) => evAt(clock, len) / (len || EVENT_LEN);
/* a small person: 6 wide, 8 tall, with a pose */
/* wider figures: a terminal cell is about twice as tall as it is wide, so a six-cell person read as a stick.
   These are twelve cells across and eight tall, which lands close to square on screen and leaves room for a face,
   a coat, two arms and two legs.                                                                                 */
const POSES = {
  stand: [
    '    ▄▄▄▄    ',
    '   ██████   ',
    '   ██▀▀██   ',
    '  ████████  ',
    '  ████████  ',
    '   ██████   ',
    '   ██  ██   ',
    '   ██  ██   ',
  ],
  walk: [
    '    ▄▄▄▄    ',
    '   ██████   ',
    '   ██▀▀██   ',
    '  ████████  ',
    '  ████████  ',
    '   ██████   ',
    '  ██    ██  ',
    ' ██      ██ ',
  ],
  run: [
    '    ▄▄▄▄    ',
    '   ██████   ',
    '   ██▀▀██   ',
    ' ████████   ',
    '  ████████  ',
    '   ██████   ',
    '  ██   ██   ',
    ' ██     ██  ',
  ],
  kneel: [
    '    ▄▄▄▄    ',
    '   ██████   ',
    '   ██▀▀██   ',
    '  ████████  ',
    '  ████████  ',
    '  ████████  ',
    '  ██████    ',
    '  ████      ',
  ],
  sit: [
    '    ▄▄▄▄    ',
    '   ██████   ',
    '   ██▀▀██   ',
    '  ████████  ',
    '  ████████  ',
    '  ████████  ',
    '  ████████  ',
    '  ██    ██  ',
  ],
  aim: [
    '    ▄▄▄▄    ',
    '   ██████   ',
    '   ██▀▀██   ',
    '  ██████████',
    '  ████████  ',
    '   ██████   ',
    '   ██  ██   ',
    '   ██  ██   ',
  ],
  fall: [
    '    ▄▄▄▄    ',
    '   ██████   ',
    '   ██▀▀██   ',
    '  ████████  ',
    '  ████████  ',
    '  ████████  ',
    ' ██     ██  ',
    '          ██',
  ],
};

function person(g, x, feet, colour, pose, hat, rim) {
  const rows = POSES[pose] || POSES.stand;
  const top = feet - rows.length + 1;
  drawSprite(g, x, top, rows, colour, rim);
  /* A little skin, a turned face, and coat seams keep the shared figures from reading as mannequins. */
  const skin = mix(colour, [222, 169, 132], 0.7);
  const seam = mix(colour, [224, 212, 182], 0.34);
  putCell(g, x + 5, top + 2, '▪', skin);
  putCell(g, x + 6, top + 2, '▪', skin);
  putCell(g, x + 6, top + 1, '·', [22, 24, 24]);
  putCell(g, x + 5, top + 3, '·', mix(skin, [92, 48, 42], 0.32));
  putCell(g, x + 5, top + 4, '▴', seam);
  putCell(g, x + 6, top + 5, '│', seam);
  putCell(g, x + 5, feet - 1, '▂', mix(colour, [24, 22, 20], 0.6));
  putCell(g, x + 8, feet - 1, '▂', mix(colour, [24, 22, 20], 0.6));
  if (rim) haloSprite(g, x, top, rows, rim, 0.18);
  if (hat) drawSprite(g, x, top - 1, ['▄▄▄▄▄▄', hat === 'cap' ? ' ████ ' : '▄████▄'], colour);
}
/* a rectangle of pixels, with a lit top edge and a darker foot */
function boxFill(g, x, y, w, h, colour, rim) {
  for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) {
    putCell(g, x + c, y + r, '█', r === 0 && rim ? rim : colour);
  }
}
function wheel(g, cx, cy, r, tyre, hub) {
  for (let dy = -r; dy <= r; dy++) for (let dx = -r * 2; dx <= r * 2; dx++) {
    const d = Math.sqrt((dx / 2) * (dx / 2) + dy * dy);
    if (d > r) continue;
    putCell(g, cx + dx, cy + dy, d > r - 1 ? '▀' : '█', tyre);
    if (d < 0.9) putCell(g, cx + dx, cy + dy, '▪', hub);
  }
}
/* a rising flame, drawn as a handful of tongues that live for a moment each */
function flame(g, cx, baseY, height, clock, hot, mid, seed) {
  const t = clock * 3.1 + (seed || 0);
  for (let k = 0; k < height; k++) {
    const y = baseY - k;
    const wob = Math.sin(t + k * 0.9) * (0.6 + k * 0.16);
    const x = Math.round(cx + wob);
    const ch = k === height - 1 ? '▄' : (k % 3 === 0 ? '░' : '█');
    putCell(g, x, y, ch, mix(hot, mid, k / Math.max(1, height)));
    if (k < height - 2) putCell(g, x + 1, y, '▄', mix(mid, hot, 0.4));
    putCell(g, x - 1, y, '▄', mix(mid, hot, 0.15));
  }
  lampLight(g, cx, baseY - 1, height + 4, 0.3, hot);
}
/* a plume of smoke or dust, leaning with the wind */
function plume(g, cx, baseY, height, clock, colour, lit, lean) {
  for (let k = 0; k < height; k++) {
    const y = baseY - k;
    if (y < 0) break;
    const x = Math.round(cx + Math.sin(k * 0.28 + clock * 0.6) * 1.8 + k * (lean == null ? 0.35 : lean));
    const wide = 1 + Math.round(k * 0.26);
    for (let d = -wide; d <= wide; d++) {
      if ((k * 5 + d * 3 + Math.round(clock * 2)) % 11 === 0) continue;
      const r = Math.abs(d) / (wide + 0.01);
      putCell(g, x + d, y, r > 0.7 ? '░' : (k % 2 ? '▒' : '▓'), mix(colour, lit, (1 - r) * 0.3 + Math.max(0, 0.4 - k * 0.014)));
    }
  }
}
/* blood: a pool that spreads, and a few drops thrown out */
function bloodPool(g, cx, gy, radius, clock, colour) {
  const r = Math.max(1, Math.round(radius));
  for (let dy = -1; dy <= 1; dy++) for (let dx = -r; dx <= r; dx++) {
    const d = Math.sqrt((dx / 1.9) * (dx / 1.9) + dy * dy);
    if (d > r) continue;
    putCell(g, cx + dx, gy + dy, d > r - 1 ? '▄' : (d < 1 ? '▓' : '▒'), mix(colour, [180, 30, 30], 0.25));
    blendCell(g, cx + dx, gy + dy, colour, 0.12);
  }
}

/* ---------- the forest: two deer in the rain, and two deer at peace ----------
   Drawn from photographs: the doe and her fawn are built like the ones in the reference — a long level back with a
   dip behind the shoulder, a neck that rises at forty-five degrees to a small wedge of a head, big back-swept ears,
   four thin legs with the hind pair set wide, a short flag of a tail, a pale belly and a white throat. The fawn has
   its spots in rows down the back and flank, which is what a white-tailed fawn looks like in its first summer.

   Wet: the mother and her fawn graze; a hunter comes up the bank, draws his bow, and looses. The arrow takes the
   fawn through the chest. It staggers, goes down, and the mother will not leave it until he walks up — then she
   breaks and runs. He drags the fawn to the pickup, lifts it into the bed, climbs into the cab himself, and drives
   away with the tail lights going out between the trunks. Nothing is left standing in the clearing but the blood.
   Dry: the fawn dozes in the fern while the mother grazes, and the two of them drift through the clearing together. */
const DOE = [
  '    ▄▄▄ ▄▄                            ',
  '   ████████                           ',
  '  ▄█████████                          ',
  '  ▀██████████                         ',
  '   ▀██████████▄                       ',
  '    ▀██████████▄                      ',
  '     ▀██████████▄                     ',
  '   ▄▄▄█████████████▄▄▄                ',
  ' ▄███████████████████████▄▄           ',
  '██████████████████████████████        ',
  ' ▀██████████████████████████████      ',
  '  ▀█████████████████████████████      ',
  '    █  █            ██   ██           ',
  '    █  █             █    █           ',
  '    █  █             █    █           ',
  '    ▀  ▀             ▀    ▀           ',
];
const DOE_GRAZE = [
  '                                      ',
  '                                      ',
  '                                      ',
  '                                      ',
  '                                      ',
  '        ██                            ',
  '      ▄█████▄▄                        ',
  '   ▄▄████████████▄▄▄                  ',
  ' ▄██████████████████████▄▄            ',
  '██████████████████████████████        ',
  ' ▀██████████████████████████████      ',
  '  ▀█████████████████████████████      ',
  '    █  █            ██   ██           ',
  '    █  █             █    █           ',
  '    █  █             █    █           ',
  '    ▀  ▀             ▀    ▀           ',
];
const FAWN = [
  '   ▄▄ ▄▄        ',
  '  ██████        ',
  ' ▄███████       ',
  ' ▀████████      ',
  '  ▀████████▄    ',
  ' ▄████████████  ',
  '██████████████  ',
  ' ▀████████████  ',
  '   █  █   █ █   ',
  '   █  █    █ █  ',
  '   ▀  ▀    ▀ ▀  ',
];
const FAWN_DOWN = [
  '               ▄▄   ',
  '  ▄▄▄▄▄▄▄▄▄▄▄▄███   ',
  ' ████████████████   ',
  ' ▀██████████████    ',
  '   █  █   █  █      ',
  '   ▀  ▀   ▀  ▀      ',
];
/* the hunter: cap, face, jacket, trousers, boots, and a bow that comes up level with his eye */
const HUNTER = [
  '   ▄▄▄▄    ',
  '  ██████   ',
  '  ██▀▀██   ',
  '  ██████   ',
  ' ████████  ',
  ' ████████  ',
  '  ██████   ',
  '  ██  ██   ',
  '  ██  ██   ',
  '  ██  ██   ',
  ' ███  ███  ',
];
const HUNTER_WALK = [
  '   ▄▄▄▄    ',
  '  ██████   ',
  '  ██▀▀██   ',
  '  ██████   ',
  ' ████████  ',
  ' ████████  ',
  '  ██████   ',
  ' ██    ██  ',
  ' ██    ██  ',
  '██      ██ ',
  '██      ███',
];
const HUNTER_KNEEL = [
  '   ▄▄▄▄    ',
  '  ██████   ',
  '  ██▀▀██   ',
  '  ██████   ',
  '  ████████ ',
  '  ████████ ',
  '  ██████   ',
  ' ██████    ',
  ' ████      ',
  '████       ',
  '███        ',
];
/* a sprite in more than one colour: each character picks its own from the map */
const DEER_COLOURS = {
  '▓': 'shade', '▀': 'shade', '▄': 'belly', '░': 'light', '.': 'light', '▐': 'shade',
};
function drawAnimal(g, x, y, rows, P) {
  if (rows === DOE || rows === DOE_GRAZE || rows === FAWN) {
    const fawn = rows === FAWN;
    const grazing = rows === DOE_GRAZE;
    const s = fawn ? 0.68 : 1;
    const cell = (cx, cy, ch, colour) => putCell(g, x + Math.round(cx * s), y + Math.round(cy * s), ch, colour);
    const bodyY = fawn ? 5 : 7, left = fawn ? 2 : 3, right = fawn ? 12 : 22;
    /* Rounded barrel with a sloped shoulder and pale underside. */
    for (let r = 0; r < (fawn ? 3 : 4); r++) {
      const inset = r === 0 ? 2 : (r === (fawn ? 2 : 3) ? 1 : 0);
      for (let c = left + inset; c <= right - inset; c++) {
        const underside = r === (fawn ? 2 : 3) || (c > right - 3 && r > 1);
        cell(c, bodyY + r, underside ? '▒' : (r === 0 ? '▀' : '█'), underside ? P.belly : (r === 0 ? P.edge : (c < left + 4 ? P.shade : P.coat)));
      }
    }
    /* Four tapered legs, with clear gaps and dark split hooves. */
    const legs = fawn ? [4, 7, 10, 12] : [5, 9, 16, 20];
    for (let i = 0; i < legs.length; i++) {
      const lx = legs[i], len = fawn ? 3 : 5;
      for (let k = 0; k < len; k++) cell(lx + (i % 2 && k > 1 ? 1 : 0), bodyY + (fawn ? 2 : 3) + k, k === len - 1 ? '▙' : '▌', k === len - 1 ? P.shade : P.coat);
    }
    if (grazing) {
      /* neck slopes down to the fern, with muzzle and eye visible in profile */
      for (let k = 0; k < 5; k++) cell(22 + k, 7 + k, '█', P.coat);
      cell(27, 12, '▪', P.shade); cell(28, 12, '·', P.shade);
      cell(23, 10, '▪', P.shade);
    } else {
      const hx = fawn ? 11 : 20, hy = fawn ? 1 : 1;
      for (let k = 0; k < (fawn ? 4 : 6); k++) cell(hx + k, hy + k, '█', P.coat);
      for (let k = 0; k < (fawn ? 4 : 5); k++) cell(hx + 3 + k, hy + 2, k === 0 ? '▀' : '█', k === 4 ? P.edge : P.coat);
      cell(hx + 4, hy + 2, '▪', P.shade); cell(hx + 7, hy + 2, '·', P.shade);
      cell(hx + 1, hy - 1, '╱', P.edge); cell(hx + 3, hy - 1, '╲', P.edge);
      cell(left - 1, bodyY, '▌', P.shade); // short tail
    }
    return;
  }
  const wide = Math.max.apply(null, rows.map(r => r.length));
  for (let r = 0; r < rows.length; r++) for (let c = 0; c < rows[r].length; c++) {
    const ch = rows[r][c];
    if (ch === ' ') continue;
    const key = DEER_COLOURS[ch];
    let col = key ? P[key] : P.coat;
    if (!key) {
      if (r === 0) col = P.edge;                                  // the light along the spine
      else if (r >= rows.length - 2) col = P.belly;                // the pale underside and the inside of the legs
      else if (c > wide * 0.8) col = P.shade;                      // the rump falls away into shadow
    }
    putCell(g, x + c, y + r, ch, col);
  }
}
/* the fawn's spots: rows of pale marks down the back and flank, which is what the photographs show */
function fawnSpots(g, x, y, rows, P) {
  if (rows === FAWN) {
    for (const [cx, cy] of [[4, 5], [7, 4], [10, 5], [13, 4], [6, 6], [11, 6]]) {
      putCell(g, x + Math.round(cx * 0.68), y + Math.round(cy * 0.68), '·', P.belly);
    }
    return;
  }
  for (let r = 0; r < rows.length; r++) for (let c = 0; c < rows[r].length; c++) {
    if (rows[r][c] === ' ') continue;
    if ((r * 5 + c * 7) % 13 !== 0) continue;
    putCell(g, x + c, y + r, '░', P.light);
  }
}
function drawHunter(g, x, feet, rows, P, rim) {
  const top = feet - rows.length + 1;
  for (let r = 0; r < rows.length; r++) for (let c = 0; c < rows[r].length; c++) {
    if (rows[r][c] === ' ') continue;
    const col = r === 0 ? P.hat : r === 1 ? P.hat : r === 2 ? P.skin : r >= 8 ? P.trouser : P.jacket;
    putCell(g, x + c, top + r, rows[r][c], col);
  }
  putCell(g, x + 5, top + 2, '▪', P.boot);
  putCell(g, x + 6, top + 3, '·', mix(P.skin, P.boot, 0.35));
  putCell(g, x + 4, top + 4, '▴', mix(P.jacket, P.trouser, 0.35));
  if (rim) haloSprite(g, x, top, rows, rim, 0.1);
}
/* the pickup: bonnet, cab, bed, and two wheels, side on */
function drawPickup(g, tx, gy, P, lit) {
  const ty = gy - 7;
  /* the bed, behind the cab */
  boxFill(g, tx, ty + 2, 11, 4, P.truck, P.truckRim);
  for (let k = 0; k < 11; k++) putCell(g, tx + k, ty + 2, '▄', P.truckRim);
  putCell(g, tx, ty + 3, '█', P.truckRim);                       // tailgate
  /* the cab: a slanted screen, a door, and the roof */
  boxFill(g, tx + 11, ty, 10, 6, P.truck, P.truckRim);
  for (let k = 0; k < 6; k++) putCell(g, tx + 11 + k, ty + 1 + k, '█', P.glass);   // windscreen
  for (let k = 0; k < 3; k++) for (let j = 0; j < 3; j++) putCell(g, tx + 16 + j, ty + 2 + k, '▒', P.glass);
  putCell(g, tx + 17, ty + 4, '▪', P.truckRim);                  // door handle
  for (let k = 0; k < 10; k++) putCell(g, tx + 11 + k, ty, '▄', P.truckRim);
  /* the bonnet, and the lights */
  boxFill(g, tx + 21, ty + 3, 4, 3, P.truck, P.truckRim);
  putCell(g, tx + 24, ty + 4, '▪', lit);
  putCell(g, tx, ty + 4, '▪', P.tail);
  /* the step, and the wheels */
  for (let k = 0; k < 8; k++) putCell(g, tx + 12 + k, gy, '▄', P.truckRim);
  wheel(g, tx + 4, gy - 1, 1, P.tyre, P.hub);
  wheel(g, tx + 20, gy - 1, 1, P.tyre, P.hub);
}
function forestEvent(g, w, h, hz, clock, rain) {
  const wet = rain !== false;
  const gy = hz;
  const P = {
    coat: [118, 80, 50], shade: [78, 52, 34], edge: [152, 110, 74], light: [226, 208, 182],
    belly: [206, 188, 162],
    jacket: [86, 92, 58], hat: [58, 54, 42], skin: [206, 158, 120], trouser: [96, 78, 52], boot: [34, 28, 22],
    truck: [34, 48, 38], truckRim: [96, 120, 98], glass: [64, 92, 74], tyre: [10, 11, 10], hub: [88, 96, 82],
    blood: [104, 12, 18], bloodLit: [176, 26, 32], metal: [150, 170, 158], arrow: [206, 190, 150],
    light: [255, 226, 160], tail: [214, 40, 40], smoke: [52, 60, 52],
  };
  const u = evAt(clock);
  backlightBand(g, w, gy - 6, 10, [162, 208, 170], clock);
  lampLight(g, Math.round(w * 0.5), gy - 5, 16, 0.12, [186, 224, 190]);

  const doeX = Math.round(w * 0.5), fawnX = Math.round(w * 0.5 + 20);
  const huntX = Math.round(w * 0.13), truckX = Math.round(w * 0.72);

  if (!wet) {
    /* ---- peace: she grazes, the fawn dozes and hops, and the two of them drift across the clearing ---- */
    const graze = Math.sin(clock * 0.8) > 0.15;
    const bx = Math.round(doeX + Math.sin(clock * 0.12) * 4);
    drawAnimal(g, bx, gy - 15, graze ? DOE_GRAZE : DOE, P);
    /* the fawn: down in the fern, then up and hopping round her heels */
    const up = Math.sin(clock * 0.34) > -0.1;
    const hopT = (clock * 0.4) % 1, hop = up ? Math.sin(Math.PI * hopT) : 0;
    const fx = Math.round(bx + 22 + Math.sin(clock * 0.3) * 3);
    if (up) {
      drawAnimal(g, fx, gy - 8 - Math.round(hop * 2), FAWN, P);
      fawnSpots(g, fx, gy - 8 - Math.round(hop * 2), FAWN, P);
    } else {
      drawAnimal(g, fx, gy - 5, FAWN_DOWN, P);
      fawnSpots(g, fx, gy - 5, FAWN_DOWN, P);
    }
    /* the mother's head turns to it, then away */
    if (Math.sin(clock * 0.25) > 0.7) putCell(g, bx + 24, gy - 13, '▪', P.shade);
    for (let i = 0; i < 6; i++) {
      const a = clock * 0.7 + i * 1.7;
      putCell(g, Math.round(bx + Math.sin(a) * 16 + 6), gy - 7 + Math.round(Math.cos(a * 1.3) * 3), '·', [206, 244, 176]);
    }
    return;
  }

  /* ---- the hunt ---- */
  const WALK_IN = 4.6, DRAW = 6.4, LOOSE = 7.5, HIT = 7.95, STAGGER = 8.9, DOWN = 10.6;
  const WALK_UP = 13.8, DRAG = 16.4, HOIST = 19.4, BOARD = 20.6, DRIVE = 21.6;
  const fawnFoot = gy;
  const arrowTo = { x: fawnX + 6, y: gy - 6 };
  /* the arrow: from the bow to the fawn's chest */
  if (u > LOOSE && u < HIT) {
    const t = (u - LOOSE) / (HIT - LOOSE);
    const ax = Math.round(huntX + 9 + (arrowTo.x - (huntX + 9)) * t);
    const ay = Math.round(gy - 6 + (arrowTo.y - (gy - 6)) * t);
    putCell(g, ax, ay, '→', P.arrow);
    for (let k = 1; k <= 3; k++) putCell(g, ax - k, ay, '·', mix(P.arrow, P.coat, k / 4));
  }
  /* ---- the fawn: grazing, struck, staggering, down ---- */
  let fx = fawnX, fy = fawnFoot - 8, rows = FAWN;
  if (u < DRAW) fx = fawnX + (Math.sin(clock * 1.1) > 0.4 ? 1 : 0);
  if (u >= HIT && u < DOWN) {
    const t = (u - HIT) / (DOWN - HIT);
    fx = Math.round(fawnX + t * 10);                             // it wheels away from the hit
    fy = Math.round(fawnFoot - 8 - Math.sin(Math.PI * Math.min(1, t * 1.15)) * 2);
  } else if (u >= DOWN && u < DRAG) {
    rows = FAWN_DOWN;
    fy = fawnFoot - 5;
    fx = Math.round(fawnX + 10 + clamp01((u - DOWN) / 2) * 2);
  } else if (u >= DRAG && u < HOIST) {
    rows = FAWN_DOWN;
    fy = fawnFoot - 4;
    const t = ease((u - DRAG) / (HOIST - DRAG));
    fx = Math.round(fawnX + 12 + (truckX + 2 - (fawnX + 12)) * t);
  } else if (u >= HOIST) {
    const t = ease((u - HOIST) / (BOARD - HOIST));
    rows = FAWN_DOWN;
    fx = truckX + 3;
    fy = Math.round(gy - 4 - t * 4);
    if (u > BOARD + 0.2) fy = gy - 10;                           // it lies in the bed after that
  }
  if (u < BOARD) {
    drawAnimal(g, fx, fy, rows, P);
    if (rows === FAWN) fawnSpots(g, fx, fy, FAWN, P);
    else if (rows === FAWN_DOWN) fawnSpots(g, fx, fy, FAWN_DOWN, P);
    else haloSprite(g, fx, fy, rows, [168, 208, 176], 0.06);
  }
  /* the wound, the pool, and the spray at the hit */
  if (u >= HIT) {
    const t = clamp01((u - HIT) / 4);
    if (u < DRAG) putCell(g, fx + 5, fy + 2, '▪', P.bloodLit);
    /* the pool stays where it fell, not under the truck it is carried to */
    bloodPool(g, fawnX + 22, gy, 2 + t * 3.4, clock, P.blood);
    if (u < STAGGER) for (let k = 0; k < 5; k++) putCell(g, fx + 4 + k, fy + 2 + (k % 2), '·', P.bloodLit);
  }
  /* ---- the mother: grazes, sees it, will not leave it, then bolts ---- */
  const doeGrazing = u < HIT;
  const doeAlarm = u >= HIT && u < WALK_UP;
  const doeFlee = u >= WALK_UP && u < WALK_UP + 2.2;
  let dx = doeX - 6;
  if (doeAlarm) dx = Math.round(doeX - 6 + clamp01((u - HIT) / 1.2) * 3);
  if (doeFlee) dx = Math.round(doeX - 3 - ease((u - WALK_UP) / 2.2) * (w * 0.55));
  const doeRows = doeGrazing ? DOE_GRAZE : DOE;
  if (u < WALK_UP + 2.4 && dx > -30) {
    drawAnimal(g, dx, gy - 15, doeRows, P);
    /* her head down over it, nosing the fawn while she still can */
    if (doeAlarm && u > HIT + 1.4) {
      for (let k = 0; k < 3; k++) putCell(g, dx + 27 + k, gy - 4 - (k === 2 ? 1 : 0), '█', P.coat);
    }
  }
  /* ---- the hunter ---- */
  if (u < LOOSE) {
    const t = ease(u / WALK_IN);
    const hx = Math.round(-8 + (huntX + 8) * Math.min(1, t));
    drawHunter(g, hx, gy, u < WALK_IN ? HUNTER_WALK : HUNTER, P, [150, 190, 154]);
    if (u > DRAW - 0.2) {
      const draw = ease((u - DRAW + 0.7) / 1.0);
      const bx = hx + 7, by = gy - 8;
      for (let k = 0; k < 7; k++) putCell(g, bx, by + k, k === 0 || k === 6 ? '╱' : '(', P.metal);
      putCell(g, bx, by + 3, '┼', P.metal);
      for (let k = 0; k <= 4; k++) putCell(g, bx - k, by + 3, '─', P.arrow);
      putCell(g, bx - Math.round(draw * 2) - 1, by + 3, '▪', P.arrow);
      putCell(g, bx + 1, by + 3, '→', P.arrow);
    }
  } else if (u < DRAG) {
    const t = ease((u - WALK_UP) / 2.6);
    const hx = Math.round(huntX + (fx - 10 - huntX) * Math.min(1, Math.max(0, t)));
    drawHunter(g, hx, gy, u < WALK_UP ? HUNTER : (t > 0.96 ? HUNTER_KNEEL : HUNTER_WALK), P, [150, 190, 154]);
  } else if (u < HOIST) {
    const t = ease((u - DRAG) / (HOIST - DRAG));
    const hx = Math.round((fawnX + 2) + (truckX - 4 - (fawnX + 2)) * t);
    drawHunter(g, hx, gy, HUNTER_WALK, P, [150, 190, 154]);
    for (let k = 0; k < 5; k++) putCell(g, Math.round(hx + 6 + k), gy, '·', mix(P.blood, P.coat, 0.45));
  } else if (u < BOARD) {
    drawHunter(g, truckX + 13, gy, HUNTER, P, [150, 190, 154]);   // lifting it over the side
  }
  /* ---- the pickup: he gets in, and it drives itself away with him in it ---- */
  const driveT = u >= DRIVE ? ease((u - DRIVE) / (EVENT_LEN - DRIVE)) : 0;
  /* it only has to cross the clearing, not the whole world: forty columns past the frame is enough to be gone */
  const tx = Math.round(truckX + driveT * (w - truckX + 40));
  drawPickup(g, tx, gy, P, P.light);
  /* the fawn in the bed, and the hunter at the wheel, both riding with it */
  if (u >= BOARD) {
    drawAnimal(g, tx + 4, gy - 6, FAWN_DOWN, P);
    fawnSpots(g, tx + 4, gy - 6, FAWN_DOWN, P);
  }
  if (u >= BOARD) {
    /* his cap and shoulders show through the glass */
    putCell(g, tx + 15, gy - 7, '█', P.hat);
    putCell(g, tx + 16, gy - 7, '█', P.hat);
    putCell(g, tx + 15, gy - 6, '█', P.skin);
    putCell(g, tx + 16, gy - 6, '█', P.jacket);
  } else if (u > HOIST + 0.6) {
    drawHunter(g, tx + 12, gy, HUNTER, P, [150, 190, 154]);      // walking round to the door
  }
  if (u >= DRIVE) {
    for (let k = 0; k < 6; k++) {
      const t = (clock * 1.8 + k * 0.28) % 1;
      putCell(g, tx - 2 - Math.round(t * 9), gy - 3 - Math.round(t * 3), '░', mix(P.smoke, P.truckRim, t));
    }
    blendCell(g, tx + 24, gy - 3, P.light, 0.22);
  }
  /* the rain falls harder over the kill */
  if (u > HIT && u < DRIVE) for (let i = 0; i < 8; i++) {
    const y = Math.round(hz - 10 + ((clock * 9 + i * 3) % 12));
    putCell(g, fawnX + 4 + ((i * 5) % 12), y, '│', [120, 150, 140]);
  }
}

/* ---------- ember: the mountain takes the village, or a family round a fire ---------- */
const HOUSE_A = ['  ▄▄▄▄▄▄  ', ' ████████ ', '██████████'];
function emberEvent(g, w, h, hz, clock, rain) {
  const wet = rain !== false;
  const C = {
    wall: [30, 16, 16], wallRim: [92, 44, 30], roof: [22, 10, 10], roofLit: [126, 52, 30],
    win: [255, 190, 96], winDim: [150, 92, 46], lava: [255, 108, 30], core: [255, 232, 156],
    smoke: [52, 32, 32], smokeLit: [150, 72, 44], ash: [96, 70, 62], coat: [14, 9, 9], skin: [190, 130, 90],
    ember: [255, 170, 74], robe: [142, 72, 68], ruin: [16, 9, 9], ruinLit: [86, 34, 22], lantern: [255, 208, 120],
  };
  const u = evAt(clock, 24);
  const gy = hz;
  const vx = Math.round(w * 0.63);
  /* the village: three cottages on the shelf below the cone */
  const houses = [vx - 4, vx + 8, vx + 20];
  const burn = houses.map((hx, i) => clamp01((u - (13.4 + i * 0.9)) / 2.2));
  houses.forEach((hx, i) => {
    const b = burn[i];
    if (b >= 1) {
      /* a ruin: broken walls, a fallen beam, embers inside */
      boxFill(g, hx, gy - 3, 9, 3, C.ruin, C.ruinLit);
      putCell(g, hx + 1, gy - 4, '▄', C.ruin); putCell(g, hx + 5, gy - 5, '▄', C.ruin);
      for (let k = 0; k < 3; k++) putCell(g, hx + 2 + k, gy - 2, '▒', mix(C.ember, C.ruin, 0.4 + k * 0.2));
      if (Math.sin(clock * 4 + i) > 0) lampLight(g, hx + 4, gy - 2, 5, 0.16, C.lava);
      return;
    }
    const hh = HOUSE_A.length;
    for (let r = 0; r < 3; r++) boxFill(g, hx, gy - 3 + r, 9, 1, mix(C.wall, C.roof, b * 0.6), C.wallRim);
    drawSprite(g, hx, gy - 3 - hh, HOUSE_A, mix(C.roof, C.roofLit, b), mix(C.roof, C.ember, b * 0.8));
    putCell(g, hx + 2, gy - 2, '▪', mix(C.win, C.winDim, b));
    putCell(g, hx + 6, gy - 2, '▪', mix(C.winDim, C.win, 0.4));
    /* the roof catches, then the whole cottage goes up */
    if (b > 0.05) {
      for (let k = 0; k < Math.round(3 + b * 6); k++) {
        const t = (clock * 2.4 + k * 0.37 + i) % 1;
        putCell(g, hx + 1 + ((k * 3) % 8), gy - 4 - Math.round(t * (2 + b * 4)), k % 2 ? '░' : '▄',
          mix(C.ember, C.core, t));
      }
      plume(g, hx + 4, gy - 5, Math.round(4 + b * 8), clock, C.smoke, C.smokeLit, 0.5);
      lampLight(g, hx + 4, gy - 3, 6 + b * 6, 0.24 * b, C.lava);
    } else {
      plume(g, hx + 4, gy - 5, 4, clock, C.smoke, C.smokeLit, 0.4);   // a quiet chimney
    }
  });
  if (!wet) {
    /* ---- peace: a family round a campfire, far from the cone ---- */
    const cx = Math.round(w * 0.42), fy = gy;
    flame(g, cx, fy - 1, 8 + Math.round(1 + Math.sin(clock * 3.3)), clock, C.core, C.lava, 0);
    lampLight(g, cx, fy - 4, 17, 0.3, C.ember);
    for (let k = 0; k < 5; k++) {                                  // logs
      putCell(g, cx - 3 + k, fy, '▄', mix(C.ruinLit, C.roof, 0.4));
    }
    person(g, cx - 9, fy, C.coat, 'sit', 'stand');
    person(g, cx - 6, fy, C.coat, 'sit');
    person(g, cx + 5, fy, C.coat, 'sit');
    /* a stick with a marshmallow, held over the fire */
    for (let k = 0; k < 5; k++) putCell(g, cx + 6 - k, fy - 4 + (k > 2 ? 1 : 0), '─', C.roof);
    putCell(g, cx + 2, fy - 5, '▪', [255, 244, 214]);
    for (let k = 0; k < 7; k++) {                                  // sparks going up
      const t = (clock * 1.6 + k * 0.23) % 1;
      putCell(g, cx + Math.round(Math.sin(t * 6 + k) * 3), fy - 2 - Math.round(t * 12), '·', mix(C.core, C.ember, t));
    }
    return;
  }
  /* ---- the eruption ---- */
  const RUPTURE = 6.4, FLOW = 9.0, SURGE = 12.6;
  if (u > 4.6 && u < RUPTURE + 0.4) {
    /* the cone shakes: widening cracks, rock dust, a glow through the seams */
    const k = clamp01((u - 4.6) / 1.8);
    for (let i = 0; i < 5; i++) {
      const x = Math.round(w * 0.6) - 6 + i * 3, len = Math.round(2 + k * 6);
      for (let d = 0; d < len; d++) putCell(g, x + (d % 2), gy - 6 - d, '│', mix(C.lava, C.core, k));
    }
    for (let i = 0; i < 10; i++) putCell(g, Math.round(w * 0.6) - 8 + ((i * 7 + Math.round(clock * 9)) % 18), gy - 5 - (i % 4), '·', C.ash);
  }
  if (u >= RUPTURE) {
    const k = clamp01((u - RUPTURE) / 2);
    /* the fountain: lava thrown up out of the crater, falling back as bombs */
    for (let i = 0; i < Math.round(10 + k * 22); i++) {
      const t = (clock * 0.75 + i * 0.137) % 1;
      const x = Math.round(w * 0.6 + Math.sin(i * 2.3) * (2 + t * 9));
      const y = Math.round(gy - 6 - Math.sin(Math.PI * t) * (8 + k * 9));
      putCell(g, x, y, t < 0.3 ? '█' : '·', mix(C.core, C.lava, t));
    }
    lampLight(g, Math.round(w * 0.6), gy - 12, 16, 0.4, C.lava);
  }
  if (u >= FLOW) {
    /* the river of fire: it comes down the flank, then along the shelf toward the village */
    const t = clamp01((u - FLOW) / 3.6);
    const endX = Math.round(w * 0.6 + (vx + 26 - w * 0.6) * t);
    for (let x = Math.round(w * 0.58); x <= endX; x++) {
      const y = gy - 1 + Math.round(Math.sin(x * 0.4 + clock * 2) * 0.6);
      putCell(g, x, y, '█', mix(C.lava, C.core, 0.4 + 0.4 * Math.sin(x * 0.6 + clock * 4)));
      putCell(g, x, y - 1, '▄', mix(C.lava, C.core, 0.2));
      if (x % 5 === 0) putCell(g, x, y - 2, '·', C.ember);
    }
    lampLight(g, Math.round((w * 0.58 + endX) / 2), gy - 2, 12, 0.22, C.lava);
  }
  if (u >= SURGE && u < 19) {
    /* the surge: a wall of ash and fire rolling out over the shelf */
    const t = clamp01((u - SURGE) / 3.4);
    const sx = Math.round(w * 0.6 + (vx + 24 - w * 0.6) * t);
    for (let d = -3; d <= 3; d++) {
      for (let k = 0; k < 5; k++) putCell(g, sx + d, gy - 1 - k - Math.abs(d), k > 3 ? '░' : '▓', mix(C.smokeLit, C.lava, (4 - k) / 5 + 0.2));
    }
    lampLight(g, sx, gy - 4, 14, 0.3, C.lava);
  }
  /* a robed figure is led up the mountain, offered at the crater, and taken by its light. */
  const peak = gy - Math.max(6, Math.min(hz - 2, Math.round(h * 0.5)));
  const altarX = Math.round(w * 0.6), startX = Math.round(w * 0.34);
  const climb = ease(clamp01(u / 4.8));
  if (u < 4.8) {
    const x = Math.round(startX + (altarX - 5 - startX) * climb);
    const feet = Math.round(gy - 5 + (peak + 2 - (gy - 5)) * climb);
    person(g, x, feet, C.robe, 'walk', null, C.ember);
    person(g, x - 8, feet, C.coat, 'walk', 'cap', C.roofLit);
  } else if (u < 9.4) {
    /* A small ring of stones and a flame mark the place; raised arms make the offering legible. */
    for (let d = -5; d <= 5; d++) {
      if (Math.abs(d) < 2) continue;
      putCell(g, altarX + d, peak + 2, d % 2 ? '▂' : '▄', mix(C.wallRim, C.ember, 0.5));
    }
    putCell(g, altarX + 8, peak + 1, '╱', C.ember);
    putCell(g, altarX + 9, peak, '▪', C.core);
    putCell(g, altarX + 10, peak + 1, '╲', C.ember);
    lampLight(g, altarX + 9, peak, 7, 0.3, C.lava);

    const descend = clamp01((u - 6.4) / 3.0);
    const x = altarX - 4;
    if (u < 6.4) {
      person(g, x, peak + 2, C.robe, u < 5.5 ? 'kneel' : 'stand', null, C.ember);
      if (u >= 5.5) {
        putCell(g, x + 2, peak - 4, '╱', C.robe);
        putCell(g, x + 10, peak - 4, '╲', C.robe);
      }
    } else if (descend < 0.82) {
      const char = clamp01(descend * 1.25);
      const robe = mix(C.robe, C.ruin, char);
      const feet = peak + 2 + Math.round(descend * 5);
      person(g, x, feet, robe, 'kneel', null, mix(C.lava, C.ember, descend));
      if (descend > 0.18) {
        for (let side = -1; side <= 1; side += 2) {
          const fx = x + (side < 0 ? 2 : 10);
          putCell(g, fx, peak - 2 + (Math.floor(clock * 3) % 2), '▴', C.ember);
          putCell(g, fx + side, peak, '·', C.core);
        }
        if (descend > 0.45) for (let i = 0; i < 4; i++) {
          const lift = (clock * 1.8 + i * 0.27) % 1;
          putCell(g, x + 3 + ((i * 5) % 7), feet - 2 - Math.round(lift * 5), i % 2 ? '·' : '✦', C.ember);
        }
      }
      lampLight(g, altarX, peak + 1, 8 + descend * 7, 0.3 + descend * 0.3, C.lava);
    } else {
      /* The figure is gone; a flare and rising sparks carry the moment without graphic detail. */
      for (let i = 0; i < 11; i++) {
        const phase = (clock * 1.7 + i * 0.19) % 1;
        const sx = altarX + Math.round(Math.sin(i * 2.4 + clock) * (1 + phase * 4));
        putCell(g, sx, peak + 2 - Math.round(phase * 8), i % 3 ? '·' : '✦', mix(C.ember, C.core, phase));
      }
      lampLight(g, altarX, peak, 17, 0.48, C.core);
    }
    /* The attendant watches through the offering, then withdraws down the slope. */
    const retreat = ease(clamp01((u - 7.2) / 2.2));
    const ax = Math.round(altarX + 7 + retreat * 7);
    const af = Math.round(peak + 2 + retreat * 4);
    person(g, ax, af, C.coat, retreat > 0.45 ? 'walk' : 'stand', 'cap', C.roofLit);
  }
  /* the surviving villagers flee the eruption; one looks back with a lantern */
  if (u > 12.6) {
    const t = clamp01((u - 12.6) / 5.5);
    const px = Math.round(vx + 4 - t * (w * 0.38));
    person(g, px, gy, C.coat, u < 18 ? 'run' : 'stand', 'cap', C.rim);
    person(g, px - 4, gy, mix(C.coat, C.skin, 0.25), u < 18 ? 'run' : 'stand');
    if (u > 17) {
      putCell(g, px - 1, gy - 6, '▪', C.lantern);
      lampLight(g, px - 1, gy - 6, 7, 0.3, C.lantern);
    }
  }
  /* ash over everything, thicker after the rupture */
  if (u > RUPTURE) for (let i = 0; i < Math.round(w * 0.12); i++) {
    const y = Math.round(((i * 29) + clock * (7 + i % 4)) % (h + 3));
    putCell(g, (i * 53 + Math.round(clock * 3)) % w, y, '˙', C.ash);
  }
}

/* ---------- candy: the avalanche, or a carousel ---------- */
function candyEvent(g, w, h, hz, clock, rain) {
  const wet = rain !== false;
  const C = {
    kid: [70, 34, 66], kidLit: [255, 190, 224], coat: [54, 26, 50],
    pop: [255, 126, 190], pop2: [150, 224, 240], stick: [232, 214, 204],
    gum: [232, 96, 150], gumLit: [255, 190, 214], house: [58, 30, 52],
    sugar: [255, 246, 250], broken: [186, 142, 160], dust: [214, 176, 200],
    carousel: [255, 214, 236], gold: [255, 214, 130], pole: [252, 240, 246],
  };
  const u = evAt(clock, 24);
  const gy = hz;
  if (!wet) {
    /* ---- peace: a carousel, turning, with two children riding ---- */
    const cx = Math.round(w * 0.5), top = gy - 12;
    /* the canopy */
    for (let k = 0; k < 7; k++) {
      const half = 10 - k;
      for (let x = cx - half; x <= cx + half; x++) putCell(g, x, top + k, k === 0 ? '▄' : '█', mix(C.carousel, C.gold, k / 9));
    }
    for (let x = cx - 11; x <= cx + 11; x += 2) putCell(g, x, top + 7, '▪', C.gold);
    putCell(g, cx, top - 2, '▪', C.gold); putCell(g, cx, top - 1, '│', C.gold);
    /* the deck and the pole */
    for (let x = cx - 11; x <= cx + 11; x++) putCell(g, x, gy - 1, '▀', mix(C.carousel, C.gold, 0.3));
    for (let y = top + 7; y < gy - 1; y++) putCell(g, cx, y, '│', C.pole);
    /* two horses on their poles, bobbing out of phase */
    for (let i = 0; i < 2; i++) {
      const ph = clock * 1.6 + i * Math.PI;
      const x = Math.round(cx + (i ? 6 : -6));
      const y = Math.round(gy - 6 + Math.sin(ph) * 1.4);
      drawSprite(g, x - 3, y, [' ▄▄▄ ', '▄█████▄', '███████', ' █ █ █'], i ? C.pop : C.pop2);
      person(g, x - 1, y - 3, C.kid, 'sit');
    }
    for (let i = 0; i < 5; i++) {                                   // bubbles
      const t = (clock * 0.3 + i * 0.21) % 1;
      putCell(g, Math.round(cx - 8 + Math.sin(t * 5 + i) * 9), Math.round(gy - 4 - t * 12), '○', C.pole);
    }
    person(g, cx - 16, gy, C.coat, 'stand');
    person(g, cx + 16, gy, C.coat, 'stand');
    return;
  }
  /* ---- the avalanche: a gumdrop the size of a house comes down the hill ---- */
  const ROLL = 6.4, HIT = 12.4, AFTER = 15.0;
  const hx = Math.round(w * 0.64), hy = gy - 4;
  lampLight(g, hx + 5, hy - 2, 13, 0.16, C.gumLit);
  const crushed = clamp01((u - 11.4) / 1.4);
  /* the house, before and after */
  if (crushed < 1) {
    for (let y = hy - 3; y < hy; y++) for (let x = hx; x < hx + 10; x++) putCell(g, x, y, '█', C.house);
    for (let k = 0; k < 5; k++) for (let x = hx + 2 - k; x <= hx + 7 + k; x++) putCell(g, x, hy - 4 - k, '▄', mix(C.house, C.pop, 0.4));
    putCell(g, hx + 2, hy - 2, '▪', C.gold); putCell(g, hx + 6, hy - 2, '▪', C.gold);
    putCell(g, hx + 4, hy - 6, '▄', C.sugar);
    if (crushed > 0) {
      for (let k = 0; k < 5; k++) putCell(g, hx + 1 + k, hy - 3 - k, '╲', mix(C.house, C.dust, crushed));
    }
  } else {
    /* a heap of broken gingerbread and sugar dust */
    for (let x = hx - 2; x < hx + 12; x++) putCell(g, x, hy - 1, '▄', C.broken);
    for (let x = hx; x < hx + 10; x += 2) putCell(g, x, hy - 2, '▪', C.dust);
    putCell(g, hx + 3, hy - 2, '╱', C.broken); putCell(g, hx + 7, hy - 3, '╲', C.broken);
  }
  /* the lollipop trees being taken out one by one */
  const pops = [Math.round(w * 0.16), Math.round(w * 0.3), Math.round(w * 0.44)];
  pops.forEach((px, i) => {
    const dead = clamp01((u - (7.4 + i * 1.5)) / 1.2);
    const top = gy - 10;
    for (let y = top + 3; y < gy; y++) putCell(g, px, y, '│', C.stick);
    if (dead < 1) {
      const r = 3;
      for (let dy = -r; dy <= r; dy++) for (let dx = -r * 2; dx <= r * 2; dx++) {
        const d = Math.sqrt((dx / 2) * (dx / 2) + dy * dy);
        if (d > r) continue;
        putCell(g, px + dx, top + dy, '▓', mix(C.pop, C.sugar, 0.2 + 0.4 * Math.sin(dx + clock)));
      }
    } else {
      for (let k = 0; k < 3; k++) putCell(g, px + k, gy - 3 - k, '▄', C.broken);
      for (let k = 0; k < 4; k++) putCell(g, px - 2 + k, gy - 2, '·', C.dust);
    }
  });
  /* the gumdrop, rolling */
  if (u >= ROLL) {
    const t = ease((u - ROLL) / (HIT - ROLL));
    const bx = Math.round(-18 + (hx + 4 + 18) * t);
    const by = Math.round(gy - 4 - Math.sin(Math.PI * t) * 1.2);
    for (let dy = -4; dy <= 4; dy++) for (let dx = -8; dx <= 8; dx++) {
      const d = Math.sqrt((dx / 2.1) * (dx / 2.1) + (dy / 1.1) * (dy / 1.1));
      if (d > 4) continue;
      putCell(g, bx + dx, by + dy, d > 3.6 ? '░' : '▓', mix(C.gum, C.gumLit, 0.25 + 0.3 * Math.sin(dx + clock * 3)));
    }
    for (let k = 0; k < 4; k++) putCell(g, bx - 8 - k, by + 3, '·', C.dust);
    lampLight(g, bx, by, 9, 0.14, C.gumLit);
  }
  /* the children: playing, then running for it */
  if (u < HIT) {
    const hop = Math.abs(Math.sin(clock * 2.2));
    person(g, Math.round(w * 0.34), gy - Math.round(hop * 2), C.kid, u > ROLL ? 'run' : 'walk');
    person(g, Math.round(w * 0.4), gy, C.kid, 'walk');
  } else {
    const t = clamp01((u - HIT) / 3);
    person(g, Math.round(w * 0.3 - t * w * 0.22), gy, C.kid, 'run');
    /* the last one stands in the sugar dust holding a broken stick */
    person(g, Math.round(w * 0.5), gy, C.kid, 'stand');
    putCell(g, Math.round(w * 0.5) + 1, gy - 8, '│', C.stick);
    if (u > AFTER) for (let k = 0; k < 4; k++) putCell(g, Math.round(w * 0.5) + 8 + k, gy - 6, '·', C.dust);
  }
}


/* ---------- the plain sky: an aurora, drawn as curtains ----------
   Not a band across the sky but several hanging curtains of light, each one a column at a time: a soft fall of green
   that brightens at its own hem, with violet above it and a slow ripple running along the fold. It moves all the
   time, and it is bright enough to light the field under it.                                              */
const AURORA = {
  hi: [12, 10, 44], mid: [30, 26, 86], low: [74, 60, 130],
  star: [232, 236, 255], starDim: [120, 124, 178],
  green: [96, 255, 176], teal: [64, 220, 214], violet: [176, 132, 255], blue: [104, 168, 255],
  rose: [255, 138, 190],
};
function auroraSky(g, hz, clock, P) {
  const C = Object.assign({}, AURORA, P || {});
  const w = g[0].length;
  for (let y = 0; y < hz; y++) {
    const t = hz <= 1 ? 0 : y / (hz - 1);
    const col = t < 0.6 ? mix(C.hi, C.mid, t / 0.6) : mix(C.mid, C.low, (t - 0.6) / 0.4);
    for (let x = 0; x < w; x++) g[y][x] = { ch: ' ', fg: null, bg: col };
  }
  for (let i = 0; i < Math.max(14, Math.round(w / 6)); i++) {
    const sx = (i * 41 + 11) % w, sy = 1 + ((i * 17 + 5) % Math.max(2, Math.round(hz * 0.7)));
    const tw = (Math.sin(clock * 1.3 + i * 2.1) + 1) / 2;
    putCell(g, sx, sy, i % 5 === 0 ? '✦' : '·', mix(C.star, C.starDim, 0.2 + tw * 0.5));
  }
  /* three curtains, each hanging from a fold that ripples along the sky */
  const curtains = [
    { x0: -0.1, x1: 0.55, top: 0.10, bot: 0.62, a: C.green, b: C.teal, ph: 0.0 },
    { x0: 0.25, x1: 0.95, top: 0.04, bot: 0.44, a: C.violet, b: C.blue, ph: 1.7 },
    { x0: 0.55, x1: 1.25, top: 0.16, bot: 0.70, a: C.rose, b: C.violet, ph: 3.4 },
  ];
  curtains.forEach((cu, ci) => {
    const from = Math.round(cu.x0 * w), to = Math.round(cu.x1 * w);
    for (let x = from; x <= to; x++) {
      if (x < 0 || x >= w) continue;
      const fold = Math.sin(x * 0.19 + clock * 0.55 + cu.ph) * 0.06 + Math.sin(x * 0.47 - clock * 0.9 + cu.ph) * 0.03;
      const botY = Math.round((cu.bot + fold) * hz);
      const topY = Math.round((cu.top + fold * 0.5) * hz);
      const edgeFade = Math.min(1, Math.min((x - from) / 6, (to - x) / 6));
      if (edgeFade <= 0) continue;
      for (let y = Math.max(0, topY); y <= Math.min(hz - 1, botY); y++) {
        const t = (y - topY) / Math.max(1, botY - topY);           // 0 at the top, 1 at the hem
        const strength = edgeFade * (0.06 + Math.pow(t, 1.8) * 0.5) * (0.7 + 0.3 * Math.sin(x * 0.5 + clock * 2.2 + ci));
        blendCell(g, x, y, mix(cu.b, cu.a, t), strength);
        if (t > 0.86 && (x + y) % 3 === 0) putCell(g, x, y, '▁', mix(cu.a, [255, 255, 255], 0.25));
        else if (t > 0.6 && (x * 7 + y * 3) % 11 === 0) putCell(g, x, y, '░', mix(cu.a, cu.b, 0.4));
      }
      /* the hem glows, and the ground under it picks up the colour */
      if (botY >= 0 && botY < hz) blendCell(g, x, botY, cu.a, 0.34 * edgeFade);
    }
  });
  return g;
}

/* ---------- mono: the city takes a bomb, or a balloon crosses it ---------- */
/* ==========================================================================================
   The city at night, and the thing that comes out of the sky over it.

   The street front is a row of buildings standing on the kerb. What happens to each of them
   depends on how close it is to the blast: the ones near the middle are vaporized where they
   stand (they go white, then they go to ash, then they are not there any more, and only a
   scorched footprint is left), and the ones toward the edges of the frame are torn off their
   footings and thrown out of the picture, tumbling and turning as they go.

   Under all of it the street is alive: people walking both ways, a dog, a cart, cars with
   their headlights on, a lamp, a signal changing. They matter because they are what the blast
   is measured against — the ones in the middle are lit white for a frame and then not there,
   the ones further out are picked up and thrown after their buildings.
   ========================================================================================== */
const gridHash = (x, y) => {
  const n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
  return n - Math.floor(n);
};
/* the row of buildings along the street: sized from the frame, so the same picture comes back every time */
function cityRow(w, h) {
  const row = [];
  let x = -2, i = 0;
  while (x < w + 3) {
    const bw = 5 + ((i * 7 + 3) % 6);
    const bh = 5 + ((i * 13 + 5) % Math.max(6, Math.round(h * 0.42)));
    row.push({ x, wdt: bw, hgt: bh, i, mid: x + bw / 2 });
    x += bw + (i % 3 === 0 ? 2 : 1);
    i++;
  }
  return row;
}
function cityEvent(g, w, h, hz, clock, rain) {
  const wet = rain !== false;
  const C = {
    tower: [16, 16, 20], towerRim: [70, 70, 82], win: [238, 238, 246], winDim: [104, 104, 118],
    smoke: [64, 64, 74], smokeLit: [170, 170, 186], fire: [255, 246, 220], fireMid: [196, 196, 210],
    flash: [255, 255, 255], ash: [128, 128, 142], road: [18, 18, 22], balloon: [226, 226, 236],
    balloonAlt: [150, 150, 166], basket: [96, 78, 58], burner: [255, 226, 160], coat: [20, 20, 24],
    dust: [126, 126, 140], dustLit: [206, 206, 216], bone: [214, 214, 224], charred: [40, 40, 46],
    light: [255, 232, 186], red: [236, 82, 66], green: [120, 224, 150], steel: [92, 92, 104],
    paint: [58, 58, 68], glass: [188, 196, 210],
  };
  const gy = hz;
  const cx = Math.round(w * 0.46);
  const u = evAt(clock, 26);
  if (!wet) {
    /* ---- peace: a balloon, going up over the rooftops ---- */
    const t = (clock * 0.035) % 1;
    const bx = Math.round(w * 0.16 + t * w * 0.7);
    const by = Math.round(hz - 6 - Math.sin(t * Math.PI) * (hz * 0.5));
    for (let dy = -4; dy <= 4; dy++) for (let dx = -5; dx <= 5; dx++) {
      const d = Math.sqrt((dx / 5) * (dx / 5) + (dy / 4) * (dy / 4));
      if (d > 1) continue;
      const band = Math.floor((dy + 4) / 3) % 2;
      putCell(g, bx + dx, by + dy, d > 0.86 ? '░' : '▓', band ? C.balloon : C.balloonAlt);
    }
    for (let k = 1; k <= 3; k++) { putCell(g, bx - 1, by + 4 + k, '│', C.balloonAlt); putCell(g, bx + 1, by + 4 + k, '│', C.balloonAlt); }
    boxFill(g, bx - 2, by + 8, 5, 2, C.basket);
    person(g, bx - 1, by + 10, C.coat, 'stand');
    const burn = (Math.sin(clock * 1.7) + 1) / 2;
    if (burn > 0.55) {
      for (let k = 0; k < 3; k++) putCell(g, bx, by + 5 - k, '▄', mix(C.burner, C.flash, k / 3));
      lampLight(g, bx, by + 5, 10, 0.28 * burn, C.burner);
    }
    const rx = Math.round(w * 0.72), ry = hz - Math.round(h * 0.3);
    boxFill(g, rx, ry, 12, 3, C.tower, C.towerRim);
    person(g, rx + 2, ry, C.coat, 'stand');
    person(g, rx + 6, ry, C.coat, 'stand');
    putCell(g, rx + 4, ry - 1, '·', C.win);
    /* and the street below them, with a few out walking, a dog, and a cart */
    const walk = (x0, sp, col, pose) => person(g, Math.round(((x0 + clock * sp) % (w + 8) + w + 8) % (w + 8)) - 4, h - 2, col, pose);
    walk(w * 0.24, 2.2, C.coat, 'walk'); walk(w * 0.55, -1.8, C.coat, 'walk'); walk(w * 0.78, 1.5, C.coat, 'stand');
    const dx0 = Math.round(((w * 0.24 + 3 + clock * 2.2) % (w + 8) + w + 8) % (w + 8)) - 4;
    putCell(g, dx0, h - 2, '▄', C.coat); putCell(g, dx0 + 1, h - 2, '▄', C.coat); putCell(g, dx0 + 2, h - 3, '·', C.coat);
    for (let x = Math.round(w * 0.66); x < Math.round(w * 0.66) + 5; x++) putCell(g, x, h - 2, '▄', C.steel);
    putCell(g, Math.round(w * 0.665) + 1, h - 4, '▄', C.red);
    return;
  }

  /* ---- the bomb ---- */
  const SIREN = 3.4, LAUNCH = 5.2, FLASH = 6.9, WAVE = 8.6, SETTLE = 16;
  const blastR = Math.max(6, w * 0.15);          // inside this: gone where it stands. outside: thrown.
  const ROW = cityRow(w, h);

  /* ---- 1. what is left of the buildings ---- */
  for (const b of ROW) {
    const d = Math.abs(b.mid - cx);
    const vapor = d < blastR;
    const dir = b.mid < cx ? -1 : 1;
    const hit = FLASH + 0.25 + (d / Math.max(1, w * 0.55)) * 1.6;    // the wave takes them in order
    const tHit = u - hit;
    const base = b.hgt;
    if (tHit <= 0) {
      /* standing, before anything happens to it */
      for (let y = gy - base; y < gy; y++) for (let x = b.x; x < b.x + b.wdt; x++) {
        if (x < 0 || x >= w) continue;
        const rim = x === b.x || y === gy - base;
        putCell(g, x, y, '█', rim ? C.towerRim : C.tower);
        if (!rim && (x - b.x) % 2 === 1 && (gy - y) % 2 === 1 && gridHash(x, y) > 0.35) putCell(g, x, y, '▪', C.win);
      }
      /* roof furniture: a water tank, an aerial */
      if (b.i % 2 === 0) { putCell(g, b.x + 1, gy - base - 1, '▄', C.towerRim); putCell(g, b.x + 2, gy - base - 1, '▄', C.towerRim); }
      else for (let k = 1; k <= 2; k++) putCell(g, b.x + (b.wdt >> 1), gy - base - k, '│', C.towerRim);
      continue;
    }
    if (vapor) {
      /* 2a. vaporized: it goes white, then it goes to ash, then it is gone, and only the footprint stays */
      const t = clamp01(tHit / 1.5);
      for (let y = gy - base; y < gy; y++) for (let x = b.x; x < b.x + b.wdt; x++) {
        if (x < 0 || x >= w) continue;
        const above = (gy - y) / base;                        // the top goes first
        const grain = gridHash(x * 1.7, y * 2.3);
        const gone = clamp01((t * 1.9) - above * 0.5 - grain * 0.55);
        if (gone >= 1) continue;
        const ch = gone > 0.55 ? '░' : '█';
        const col = gone > 0.55 ? mix(C.bone, C.dust, 0.5 + grain * 0.3)
          : gone > 0.2 ? mix(C.bone, C.towerRim, 0.35) : (x === b.x ? C.towerRim : C.tower);
        putCell(g, x, y - Math.round(gone * 2), ch, col);
      }
      /* the dust going up off it */
      if (t > 0.1 && t < 1) {
        for (let k = 0; k < 8; k++) {
          const px = b.x + Math.round(gridHash(b.i, k) * b.wdt);
          putCell(g, px, gy - base - 1 - Math.round(t * 6 + k), '░', mix(C.dustLit, C.dust, t));
        }
      }
      /* the footprint: a scorched notch in the street, still hot, with its own column of smoke over it */
      if (t >= 1) {
        plume(g, b.x + Math.round(b.wdt / 2), gy - 2, 4 + Math.round(2 + 2 * Math.sin(clock * 0.4 + b.i)), clock, C.smoke, C.dustLit, 0.16);
        for (let k = 0; k < 4; k++) putCell(g, b.x + Math.round(gridHash(b.i, k) * b.wdt), gy - 1 - (k % 2), '▪', C.dust);
        for (let x = b.x; x < b.x + b.wdt; x++) if (x >= 0 && x < w) {
          putCell(g, x, gy - 1, '▄', mix(C.charred, C.ember || C.light, 0.25 + 0.2 * Math.sin(clock * 3 + x)));
          if (gridHash(x, 7) > 0.6) putCell(g, x, gy - 2, '░', mix(C.smoke, C.dust, 0.4));
        }
      }
      continue;
    }
    /* 2b. thrown: off its footings, up, over, and out of the picture, turning as it goes */
    const t = clamp01(tHit / 4.0);
    const spin = dir * t * 1.5;
    const cs = Math.cos(spin), sn = Math.sin(spin);
    const ox = dir * Math.pow(t, 2.6) * (w * 0.8 + 10);
    const oy = -Math.sin(Math.min(1, t * 0.75) * Math.PI) * (base * 0.8) + Math.pow(t, 3) * (h * 1.3);
    const ax = b.mid, ay = gy;                     // the pivot: the middle of its base
    for (let y = gy - base; y < gy; y++) for (let x = b.x; x < b.x + b.wdt; x++) {
      const lx = x - ax, ly = (y - ay) * 2;        // cell space is twice as tall as it is wide
      const rx = lx * cs - ly * sn, ry = lx * sn + ly * cs;
      const dx2 = Math.round(ax + rx + ox), dy2 = Math.round(ay + ry / 2 + oy);
      if (dx2 < 0 || dx2 >= w || dy2 < 0 || dy2 >= h) continue;
      const rim = x === b.x || y === gy - base;
      putCell(g, dx2, dy2, '█', rim ? C.towerRim : C.tower);
      if (!rim && (x - b.x) % 2 === 1 && (gy - y) % 2 === 1 && gridHash(x, y) > 0.35) putCell(g, dx2, dy2, '▪', C.win);
    }
    /* the stub it left, and the dust dragged after it */
    if (t > 0.02) {
      /* the torn stump it left standing on: jagged, blackened, still smoking */
      for (let x = b.x; x < b.x + b.wdt; x++) {
        if (x < 0 || x >= w) continue;
        const hh = Math.max(1, Math.round(1.5 + (1 - Math.abs(Math.sin(x * 2.7 + b.i))) * 3.5 - t));
        for (let k = 0; k < hh; k++) putCell(g, x, gy - 1 - k, k === hh - 1 ? '▄' : '▒', mix(C.towerRim, C.charred, 0.55));
      }
      if (t > 0.3) plume(g, b.x + Math.round(b.wdt / 2), gy - 3, 3, clock, C.smoke, C.dust, 0.12);
      for (let k = 0; k < 6; k++) {
        const tx = Math.round(b.mid + ox * (k / 6)), ty = Math.round(gy + oy * (k / 6) - k * 0.4);
        putCell(g, tx, ty, '░', mix(C.dust, C.smoke, k / 6));
      }
    }
  }

  /* ---- 2. the street, and everybody on it ---- */
  const streetY = h - 2;
  /* a lamp post, and a signal that is still changing */
  const lampX = Math.round(w * 0.11);
  for (let y = gy; y < streetY; y++) putCell(g, lampX, y, '│', [96, 96, 108]);
  putCell(g, lampX + 1, gy, '▄', C.steel); putCell(g, lampX + 2, gy, '▄', C.steel);
  if (u < FLASH) { putCell(g, lampX + 2, gy + 1, '▪', C.light); lampLight(g, lampX + 2, gy + 1, 6, 0.16, C.light); }
  const sigX = Math.round(w * 0.8);
  for (let y = gy; y < streetY; y++) putCell(g, sigX, y, '│', [96, 96, 108]);
  boxFill(g, sigX - 1, gy - 1, 3, 4, C.paint, C.steel);
  const phase = Math.floor((clock * 0.6) % 3);
  putCell(g, sigX, gy, '▪', phase === 0 ? C.red : C.charred);
  putCell(g, sigX, gy + 1, '▪', phase === 1 ? C.light : C.charred);
  putCell(g, sigX, gy + 2, '▪', phase === 2 ? C.green : C.charred);
  if (phase === 0 && u < FLASH) lampLight(g, sigX, gy, 4, 0.14, C.red);
  /* a cart at the kerb, and a car going the other way */
  const cartX = Math.round(w * 0.63);
  if (u < FLASH) {
    for (let x = cartX; x < cartX + 4; x++) { putCell(g, x, streetY - 1, '█', [120, 120, 132]); putCell(g, x, streetY - 2, '▄', [168, 168, 180]); }
    putCell(g, cartX + 1, streetY - 3, '▄', C.light); putCell(g, cartX + 2, streetY - 3, '▄', C.red);
  } else {
    const [tx, ty] = [cartX + 6, streetY - 6];
    putCell(g, tx, ty, '▄', C.steel); putCell(g, tx + 1, ty, '█', C.steel); putCell(g, tx + 2, ty, '▪', C.red);
  }
  const carX = Math.round((w * 0.3 + clock * 7) % (w + 16)) - 8;
  if (u < FLASH) {
    for (let x = carX; x < carX + 6; x++) putCell(g, x, streetY, '█', x === carX ? [108, 108, 120] : [78, 78, 90]);
    putCell(g, carX + 5, streetY, '▪', C.light);
    putCell(g, carX + 1, streetY - 1, '▄', C.glass); putCell(g, carX + 2, streetY - 1, '▄', C.glass);
    lampLight(g, carX + 5, streetY, 5, 0.1, C.light);
  } else {
    const t = clamp01((u - FLASH - 0.3) / 2.4);
    const dir = carX < cx ? -1 : 1;
    for (let k = 0; k < 6; k++) {
      const px = Math.round(carX + k + dir * Math.pow(t, 1.5) * w * 0.5);
      const py = Math.round(streetY - Math.sin(Math.min(1, t) * Math.PI * 0.9) * h * 0.3 + t * t * h * 0.4 - (k % 2));
      putCell(g, px, py, '█', k === 0 ? C.paint : C.tower);
    }
  }
  /* the people: two walking one way, two the other, and a dog */
  const peds = [
    { x: w * 0.22, sp: 2.2, col: [188, 188, 200] },
    { x: w * 0.41, sp: -1.7, col: [150, 150, 164] },
    { x: w * 0.58, sp: 2.8, col: [206, 206, 218] },
    { x: w * 0.86, sp: -2.4, col: [168, 168, 180] },
  ];
  for (let i = 0; i < peds.length; i++) {
    const p = peds[i];
    const px = Math.round(((p.x + clock * p.sp) % (w + 10) + w + 10) % (w + 10)) - 5;
    const d = Math.abs(px - cx);
    const vapor = d < blastR * 1.15;
    const hit = FLASH + 0.3 + (d / Math.max(1, w * 0.55)) * 1.6;
    if (u < hit) {
      person(g, px, streetY, p.col, Math.sin(clock * 6 + i) > 0 ? 'walk' : 'stand');
      if (i === 3) { putCell(g, px + 3, streetY, '▄', [130, 130, 142]); putCell(g, px + 4, streetY, '▄', [130, 130, 142]); putCell(g, px + 4, streetY - 1, '·', [130, 130, 142]); }
      continue;
    }
    if (vapor) {
      /* lit white for an instant, then a little ash coming down */
      const t = clamp01((u - hit) / 0.9);
      if (t < 0.45) person(g, px, streetY, mix(C.flash, C.bone, t * 2), 'stand');
      else {
        for (let k = 0; k < 5; k++) putCell(g, px - 1 + k, streetY - Math.round(t * 5) + (k % 2), '░', mix(C.bone, C.dust, t));
      }
      continue;
    }
    /* thrown, head over heels */
    const t = clamp01((u - hit) / 2.2);
    const dir = px < cx ? -1 : 1;
    const fx2 = Math.round(px + dir * Math.pow(t, 1.5) * (w * 0.4));
    const fy2 = Math.round(streetY - Math.sin(Math.min(1, t) * Math.PI * 0.85) * h * 0.32 + t * t * h * 0.5);
    person(g, fx2, fy2, p.col, t > 0.55 ? 'fall' : (t > 0.15 ? 'run' : 'stand'));
  }

  /* the siren: two lamps on a roof, turning */
  if (u > SIREN && u < FLASH) {
    const on = Math.sin(clock * 9) > 0;
    for (const sx of [Math.round(w * 0.18), Math.round(w * 0.84)]) {
      putCell(g, sx, gy - 6, '▪', on ? C.flash : C.winDim);
      if (on) lampLight(g, sx, gy - 6, 9, 0.2, C.flash);
    }
  }
  /* the missile: a streak with a smoke trail, and the sky behind it getting lighter */
  if (u > LAUNCH && u < FLASH) {
    const t = (u - LAUNCH) / (FLASH - LAUNCH);
    const mx = Math.round(w * 0.06 + (cx - w * 0.06) * t);
    const my = Math.round(-2 + (gy - 8) * t);
    for (let k = 1; k <= 14; k++) putCell(g, mx - k, my - Math.round(k * 0.6), '░', mix(C.smokeLit, C.smoke, k / 14));
    putCell(g, mx, my, '◆', C.flash);
    lampLight(g, mx, my, 6, 0.24, C.flash);
  }
  /* the flash, and the fireball */
  if (u >= FLASH - 0.15 && u < FLASH + 0.95) {
    const t = clamp01((u - (FLASH - 0.15)) / 1.1);
    const a = Math.sin(Math.PI * t) * 0.9;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) blendCell(g, x, y, C.flash, a);
  }
  if (u >= FLASH && u < FLASH + 3.4) {
    const k = clamp01((u - FLASH) / 2.4);
    const fr = Math.round(2 + k * 4);
    for (let dy = -fr; dy <= fr; dy++) for (let dx = -fr * 2; dx <= fr * 2; dx++) {
      const d = Math.sqrt((dx / 1.9) * (dx / 1.9) + dy * dy);
      if (d > fr) continue;
      putCell(g, cx + dx, gy - 2 + dy - Math.round(k * 3), d > fr - 1.5 ? '░' : '▓',
        mix(C.fire, C.smokeLit, 0.2 + (d / fr) * 0.5 + k * 0.2));
    }
    lampLight(g, cx, gy - 4, 12, 0.26, C.fire);
    const stemH = Math.round(k * (gy * 0.42));
    for (let y = gy - 3; y > gy - 3 - stemH; y--) for (let dx = -2; dx <= 2; dx++) {
      putCell(g, cx + dx, y, dx === 0 ? '▒' : '▓', mix(C.smoke, C.smokeLit, 0.3 + (y % 3) * 0.1));
    }
    const capY = gy - 3 - stemH;
    const capR = Math.round(2 + k * 4);
    for (let dy = -Math.round(capR * 0.5); dy <= Math.round(capR * 0.5); dy++) for (let dx = -capR; dx <= capR; dx++) {
      const d = Math.sqrt((dx / (capR * 0.75)) * (dx / (capR * 0.75)) + (dy / 1.6) * (dy / 1.6));
      if (d > 1) continue;
      putCell(g, cx + dx, capY + dy, d > 0.82 ? '░' : (d > 0.6 ? '▒' : '▓'), mix(C.smoke, C.smokeLit, 0.34 + 0.2 * Math.sin(dx * 0.4 + clock) + (1 - d) * 0.12));
    }
    for (let dx = -capR; dx <= capR; dx += 2) putCell(g, cx + dx, capY + Math.round(capR * 0.55), '▄', mix(C.smokeLit, C.fire, 0.25));
    lampLight(g, cx, capY + capR * 0.5, Math.round(capR), 0.18, C.smokeLit);
  }
  /* the shockwave: a ring running out along the street, and a lift of dust */
  if (u > WAVE && u < WAVE + 3.4) {
    const t = clamp01((u - WAVE) / 3.4);
    const r = Math.round(t * w * 0.75);
    for (let s = 0; s < 3; s++) {
      for (const sx of [cx - r, cx + r]) {
        const x = sx + s;
        if (x < 0 || x >= w) continue;
        putCell(g, x, gy - 1 - s, '░', mix(C.smokeLit, C.flash, 0.4));
        putCell(g, x, gy - s, '▄', C.smokeLit);
      }
    }
    blendCell(g, cx, gy - 1, C.flash, 0.3 * (1 - t));
  }
  /* after it: fires where the buildings were, ash coming down, and one figure in the street */
  if (u > SETTLE) {
    const gone = ROW.filter(b => Math.abs(b.mid - cx) < blastR);
    for (let i = 0; i < Math.min(5, gone.length); i++) {
      const fx = gone[i].x + 2 + (i * 3) % 5;
      if (Math.sin(clock * 3 + i) > -0.3) flame(g, fx, gy - 1, 2 + (i % 3), clock, C.fire, C.fireMid, i);
    }
    for (let i = 0; i < Math.round(w * 0.4); i++) {
      const y = Math.round(((i * 31) + clock * (5 + i % 5)) % (h + 4)) - 2;
      putCell(g, (i * 47 + Math.round(clock * 2)) % w, y, '˙', C.ash);
    }
    const px = Math.round(cx + 12);
    person(g, px, streetY, C.coat, 'stand');
    putCell(g, px + 2, streetY - 8, '·', C.smokeLit);
  }
}

/* ---------- matrix: a man runs, and is deleted; or a man walks through ---------- */
/* a block font, five rows tall and three wide, so the picture itself can say a word */
const FONT5 = {
  A: ['010', '101', '111', '101', '101'], B: ['110', '101', '110', '101', '110'],
  C: ['011', '100', '100', '100', '011'], D: ['110', '101', '101', '101', '110'],
  E: ['111', '100', '110', '100', '111'], G: ['011', '100', '101', '101', '011'],
  H: ['101', '101', '111', '101', '101'], K: ['101', '101', '110', '101', '101'],
  M: ['111', '111', '101', '101', '101'], N: ['101', '111', '111', '101', '101'],
  O: ['010', '101', '101', '101', '010'], R: ['110', '101', '110', '101', '101'],
  S: ['011', '100', '010', '001', '110'], T: ['111', '010', '010', '010', '010'],
  U: ['101', '101', '101', '101', '010'], Y: ['101', '101', '010', '010', '010'],
  '!': ['010', '010', '010', '000', '010'], '.': ['000', '000', '000', '000', '010'],
};
const wordWidth = (t, scale) => String(t).length * 4 * (scale || 1) - (scale || 1);
function drawWord(g, x, y, text, colour, glow, scale) {
  const sc = scale || 1;
  let cx = x;
  for (const ch of String(text).toUpperCase()) {
    const gl = FONT5[ch];
    if (gl) for (let r = 0; r < 5; r++) for (let c = 0; c < 3; c++) {
      if (gl[r][c] !== '1') continue;
      for (let ry = 0; ry < sc; ry++) for (let rx = 0; rx < sc; rx++) {
        putCell(g, cx + c * sc + rx, y + r * sc + ry, '█', colour);
        if (glow) blendCell(g, cx + c * sc + rx, y + r * sc + ry, glow, 0.18);
      }
    }
    cx += 4 * sc;
  }
  return cx - x;
}
/* a padlock: the shackle on top, the body under it, and — once it gives — the gap down the middle */
function padlock(g, cx, top, open, body, lit, dark) {
  const sh = 3;
  for (let k = 0; k < sh; k++) {
    const hw = k === sh - 1 ? 4 : 2;
    for (let dx = -hw; dx <= hw; dx++) {
      if (Math.abs(dx) < hw - 1 && k < sh - 1) continue;
      putCell(g, cx + dx, top + k, '█', k === 0 ? lit : body);
    }
  }
  const bw = 5;
  for (let y = top + sh; y < top + sh + 5; y++) for (let dx = -bw; dx <= bw; dx++) {
    const edge = Math.abs(dx) === bw || y === top + sh + 4 || y === top + sh;
    putCell(g, cx + dx, y, '█', edge ? lit : body);
  }
  putCell(g, cx, top + sh + 2, '▪', dark);
  if (open > 0) {
    for (let y = top + sh; y < top + sh + 5; y++) {
      putCell(g, cx + Math.round(open * 3), y, ' ', null, dark);
      putCell(g, cx - Math.round(open * 3), y, ' ', null, dark);
    }
    lampLight(g, cx, top + sh + 2, 8, 0.22 * open, lit);
  }
}
/* ---------- the matrix: what is done to you, and what you do to it ----------
   Wet — you have been hacked: the grid's own rain turns red at the edges, an alarm breathes along the top and the
   bottom, a skull builds itself out of falling glyphs, HACKED flickers under it, files are lifted out of the picture
   and carried off the right-hand side, a bar fills to the end, and the world goes dark in blocks with one red cursor
   left blinking in the middle of it.
   Dry — you have root: he sits in front of a floating terminal, types, the password fills and turns green, the
   padlock cracks open and falls in two halves, and ROOT burns into the sky over the grid with GRANTED beneath it
   while columns of glyphs rise up round him.                                                                    */
function matrixEvent(g, w, h, hz, clock, rain) {
  const wet = rain !== false;
  const C = {
    coat: [10, 22, 14], coatLit: [44, 108, 66], skin: [150, 200, 168],
    glyph: [126, 255, 166], glyphDim: [40, 150, 80], flash: [236, 255, 240],
    red: [255, 86, 84], redDim: [156, 32, 40], redHot: [255, 208, 196],
    shell: [196, 255, 214], panel: [16, 46, 28], panelLit: [96, 220, 132],
    gold: [255, 236, 150],
  };
  const gy = hz, cx = Math.round(w * 0.5), u = evAt(clock, 26);

  if (wet) {
    /* ---- the alarm: two rows breathing red at the edges of the frame ---- */
    const pulse = 0.5 + 0.5 * Math.sin(clock * 4.4);
    for (let x = 0; x < w; x++) {
      if ((x + Math.floor(clock * 8)) % 7 < 3) {
        blendCell(g, x, 0, C.red, 0.16 + 0.2 * pulse);
        blendCell(g, x, 1, C.red, 0.06 + 0.12 * pulse);
        blendCell(g, x, h - 1, C.red, 0.13 + 0.16 * pulse);
      }
    }
    /* red columns among the green ones, so the rain itself looks wrong */
    for (let i = 0; i < 14; i++) {
      const x = Math.round(((i * 37 + 11) % w));
      const head = Math.floor((clock * (6 + (i % 5)) + i * 5.5) % (hz + 12)) - 12;
      for (let k = 0; k < 10; k++) {
        const y = head - k;
        if (y < 0 || y >= hz) continue;
        putCell(g, x, y, 'ｱｲｳｴｵｶｷｸｹｺ'[(y + i) % 10], k === 0 ? C.redHot : mix(C.red, C.redDim, k / 10));
      }
    }
    /* ---- the skull, built out of glyphs that fall into place ---- */
    const SKULL = [
      '   ▄████████▄   ',
      '  ████████████  ',
      ' ██████████████ ',
      ' ████▀▀██▀▀████ ',
      ' ███▀    ▀    ▀█',
      ' ████▄▄██▄▄████ ',
      ' ██████▄▄██████ ',
      '  ███▄█▄█▄█▄██  ',
      '   ▀████████▀   ',
    ];
    const prog = clamp01((u - 1.5) / 5);
    if (prog > 0.02) {
      const sx = cx - 8, sy = Math.max(1, hz - 16);
      for (let r = 0; r < SKULL.length; r++) for (let c = 0; c < SKULL[r].length; c++) {
        if (SKULL[r][c] === ' ') continue;
        const seed = (r * 17 + c * 7) % 11;
        if (seed / 11 > prog) continue;                    // the pieces arrive in an order, not all at once
        const drop = Math.round((1 - prog) * (r % 4) * 2);
        putCell(g, sx + c, sy + r + drop, SKULL[r][c], r < 3 ? C.redHot : mix(C.red, C.redDim, r / 9));
      }
      lampLight(g, cx, sy + 4, 14, 0.16 * prog, C.red);
    }
    /* ---- files, lifted out of the grid and carried off to the right ---- */
    if (u > 7 && u < 17.5) {
      for (let i = 0; i < 7; i++) {
        const f = clamp01((u - 7 - i * 0.5) / 6);
        if (f <= 0) continue;
        const x = Math.round(w * 0.2 + f * (w * 0.95));
        const y = Math.max(1, hz - 10 - (i % 5) * 3 + Math.round(Math.sin(f * 5 + i) * 1.5) + Math.round((1 - f) * 3));
        const boxW = 6 - Math.round(f * 3);
        for (let k = 0; k < 3; k++) for (let c = 0; c < boxW; c++) {
          putCell(g, x + c, y + k, c === 0 || c === boxW - 1 || k === 0 || k === 2 ? '█' : '▒', mix(C.red, C.redHot, f * 0.6));
        }
        putCell(g, x + 1, y + 1, '▪', C.redHot);
        blendCell(g, x + 2, y + 1, C.red, 0.24 * (1 - f));
      }
    }
    /* ---- the bar, filling to the end ---- */
    if (u > 9.5) {
      const f = clamp01((u - 9.5) / 4.5);
      const bx = Math.round(w * 0.12), by = h - 3, bw = Math.round(w * 0.76);
      for (let x = 0; x < bw; x++) {
        const filled = x / bw < f;
        putCell(g, bx + x, by, filled ? '█' : '░', filled ? mix(C.red, C.redHot, 0.2 + 0.3 * Math.sin(x * 0.3 - clock * 6)) : C.redDim);
      }
      for (let x = 0; x < bw; x++) { putCell(g, bx + x, by - 1, '▄', C.redDim); putCell(g, bx + x, by + 1, '▀', C.redDim); }
      if (f >= 1) drawWord(g, bx + bw - 11, by - 7, '100', C.redHot, C.red);
    }
    /* ---- HACKED, burning under the skull ---- */
    if (u > 5.2) {
      const on = Math.sin(clock * 17) > -0.55 || u > 8.5;
      if (on) {
        const sc = w >= 72 ? 2 : 1;
        const bw2 = wordWidth('HACKED', sc);
        const by2 = Math.min(h - 6 * sc, Math.max(1, Math.round(hz - 9 - sc * 4)));
        drawWord(g, cx - Math.round(bw2 / 2), by2, 'HACKED', C.red, C.red, sc);
      }
    }
    /* ---- the world going dark in blocks, and one cursor left ---- */
    if (u > 15) {
      const t = clamp01((u - 15) / 5);
      const bs = 6;
      for (let by = 0; by < h; by += bs) for (let bx = 0; bx < w; bx += bs) {
        const seed = ((bx / bs) * 31 + (by / bs) * 17) % 13;
        if (seed / 13 > t) continue;
        for (let y = by; y < Math.min(h, by + bs); y++) for (let x = bx; x < Math.min(w, bx + bs); x++) {
          g[y][x] = { ch: ' ', fg: null, bg: [4, 6, 8] };
        }
      }
    }
    if (u > 17.5) {
      const blink = Math.floor(clock * 2.6) % 2 === 0;
      if (blink) {
        for (let k = 0; k < 3; k++) for (let d = 0; d < 2; d++) putCell(g, cx + d, Math.round(hz - 6) + k, '█', C.red);
      }
      if (u > 20) drawWord(g, cx - wordWidth('!') / 2 | 0, Math.max(1, hz - 13), '!', C.red, C.red);
    }
    return;
  }

  /* ---- dry: root access ---- */
  /* the terminal he is working at, floating beside him */
  const px = Math.round(w * 0.16), py = Math.max(1, hz - 15), pw = Math.max(18, Math.min(34, Math.round(w * 0.3)));
  const pw2 = Math.round(pw * clamp01((u - 0.2) / 2.6));
  if (pw2 > 3) {
    for (let y = py; y < py + 10; y++) for (let x = px; x < px + pw2; x++) {
      const edge = y === py || y === py + 9 || x === px || x === px + pw2 - 1;
      g[y][x] = { ch: edge ? '█' : ' ', fg: edge ? C.panelLit : null, bg: C.panel };
    }
    /* code scrolling inside it */
    for (let r = 1; r < 9; r++) {
      const len = 3 + ((r * 7 + Math.floor(clock * 6)) % 9);
      const off = Math.floor(clock * 5 + r);
      for (let c = 1; c < Math.min(pw2 - 1, 2 + len); c++) {
        if ((c + off) % 5 === 0) continue;
        putCell(g, px + c, py + r, '▒', mix(C.glyph, C.glyphDim, (r * 3 + c) % 5 / 5));
      }
    }
    /* the password, filling and then going green */
    const fillP = clamp01((u - 3.5) / 3.5), n = 12;
    for (let i = 0; i < n; i++) {
      const done = i / n < fillP;
      putCell(g, px + 2 + i, py + 8, done ? '▪' : '·', done ? (fillP >= 1 ? C.flash : C.shell) : C.glyphDim);
    }
    if (fillP >= 1) blendCell(g, px + 8, py + 8, C.glyph, 0.3);
    lampLight(g, px + pw2 / 2, py + 5, 12, 0.14, C.panelLit);
  }
  /* him, sitting at it, hands moving */
  const px2 = Math.round(w * 0.42);
  person(g, px2, gy, C.coat, u > 20 ? 'stand' : 'sit', null, C.coatLit);
  if (u < 20) for (let k = 0; k < 3; k++) {
    const t = clock * 9 + k * 2.1;
    if (Math.sin(t) > 0.2) putCell(g, px2 + 6 + (k % 2), gy - 4 - (k % 2), '·', mix(C.flash, C.glyph, 0.4));
  }
  /* the padlock: whole, then cracked, then in two halves on the floor */
  const lx = Math.round(w * 0.62), ly = Math.max(2, hz - 16);
  const open = clamp01((u - 10.5) / 3);
  if (u < 15.5) {
    if (open < 0.9) padlock(g, lx, ly + Math.round(open * open * 8), open, mix(C.glyph, C.glyphDim, 0.4), C.flash, C.panel);
    else for (let s = 0; s < 2; s++) {
      for (let y = 0; y < 5; y++) for (let dx = 0; dx < 5; dx++) {
        const x = lx + (s ? 5 : -10) + dx, yy = gy - 1 - y + s;
        putCell(g, x, yy, '█', mix(C.glyph, C.glyphDim, y / 6));
      }
    }
  }
  /* columns of glyphs rising off the floor round him */
  if (u > 15) {
    const t = clamp01((u - 15) / 8);
    for (let i = 0; i < 22; i++) {
      const x = Math.round((i / 22) * w);
      const hgt = Math.round((4 + (i % 7) * 2) * t);
      for (let k = 0; k < hgt; k++) {
        const y = gy - k - Math.round((clock * 5 + i * 3) % 10);
        putCell(g, x, y, 'ｱｲｳｴｵｶｷｸｹｺ'[(i + k) % 10], mix(C.glyph, C.glyphDim, k / Math.max(1, hgt)));
      }
    }
    for (let x = 0; x < w; x++) blendCell(g, x, gy, C.glyph, 0.18 * t);
  }
  /* ROOT, burning into the sky */
  if (u > 13.6) {
    const grow = ease((u - 13.6) / 2.2);
    const rsc = w >= 72 ? 2 : 1;
    const rw = wordWidth('ROOT', rsc);
    if (grow > 0.35) {
      const ry = Math.max(0, Math.round(hz - 22 + (1 - grow) * 3));
      drawWord(g, Math.max(1, cx - Math.round(rw / 2)), ry, 'ROOT', mix(C.glyphDim, C.shell, grow), C.glyph, rsc);
      /* rays coming off it */
      for (let i = 0; i < 10; i++) {
        const a = i * 0.63 + clock * 0.5;
        const r = 12 + 3 * Math.sin(clock * 1.7 + i);
        const x = Math.round(cx + Math.cos(a) * r * 1.9), y = Math.round(ry + 2 + Math.sin(a) * r * 0.5);
        blendCell(g, x, y, C.glyph, 0.16 * grow);
        if (i % 3 === 0) putCell(g, x, y, '·', mix(C.glyph, C.shell, 0.6));
      }
    }
    if (u > 17) {
      const gsc = w >= 96 ? 2 : 1;
      const gw = wordWidth('GRANTED', gsc);
      drawWord(g, Math.max(1, cx - Math.round(gw / 2)), Math.max(1, hz - 10), 'GRANTED', mix(C.glyph, C.shell, clamp01((u - 17) / 2)), C.glyph, gsc);
    }
  }

}

/* ---------- the plain: the storm takes the barn, or a boy and his dog under the lights ---------- */
const BARN = [
  '    ▄▄▄▄▄▄▄▄▄▄    ',
  '  ▄████████████▄  ',
  ' ████████████████ ',
  '██████████████████',
  '██████████████████',
  '███████  █████████',
  '███████  █████████',
  '██████████████████',
];
function meadowEvent(g, w, h, hz, clock, rain) {
  const wet = rain !== false;
  const C = {
    barn: [26, 22, 20], barnRim: [112, 96, 90], door: [16, 14, 12], hay: [176, 148, 92],
    coat: [24, 26, 30], skin: [196, 156, 120], dog: [92, 74, 54], house: [34, 30, 32],
    wood: [58, 46, 40], debris: [70, 58, 50], dust: [130, 120, 120], lamp: [255, 224, 150],
    lightning: [232, 236, 255],
  };
  const gy = hz;
  const u = evAt(clock, 26);
  const bx = Math.round(w * 0.66);
  if (!wet) {
    /* ---- peace: a boy lies in the grass with his dog, and the lights run over them ---- */
    const px = Math.round(w * 0.38);
    /* lying down: a low, flat figure, so it reads as someone on their back */
    drawSprite(g, px, gy - 3, [' ▄▄▄▄▄▄ ', '█████████', ' ██████ '], C.coat);
    putCell(g, px + 1, gy - 4, '▄', C.skin);
    person(g, px + 12, gy - 1, C.dog, 'sit');
    putCell(g, px + 14, gy - 9, '▄', C.dog);                       // a raised ear, watching the sky
    for (let i = 0; i < 8; i++) {                                   // fireflies over the grass
      const a = clock * 0.55 + i * 1.9;
      putCell(g, Math.round(px + Math.sin(a) * 16 + 4), Math.round(gy - 5 + Math.cos(a * 1.4) * 2), '·', C.lamp);
    }
    /* the barn stands whole, with its lamp on */
    drawSprite(g, bx, gy - BARN.length + 1, BARN, C.barn, C.barnRim);
    for (let k = 0; k < 3; k++) putCell(g, bx + 7 - k, gy - 3, '▄', mix(C.door, C.barnRim, k * 0.2));
    putCell(g, bx + 16, gy - 6, '▪', C.lamp);
    lampLight(g, bx + 16, gy - 6, 9, 0.22, C.lamp);
    return;
  }
  /* ---- the storm ---- */
  const TOUCH = 7.0, CROSS = 11.0, GONE = 17.5;
  const fx = Math.round(-14 + ((u - TOUCH) / (GONE - TOUCH)) * (w * 0.9 + 24));
  const funnel = u > TOUCH && u < GONE;
  /* before it: the sky darkens and the grass lies flat */
  if (u < TOUCH) {
    const k = clamp01(u / TOUCH);
    for (let y = 0; y < hz; y++) for (let x = 0; x < w; x++) blendCell(g, x, y, C.dust, 0.2 * k);
    for (let x = 0; x < w; x++) {
      if (Math.sin(clock * 2 + x * 0.1) > 0.7) {
        for (let p = 0; p < 3; p++) putCell(g, x + p, hz - 6, '│', mix(C.lightning, C.dust, 0.2));
      }
    }
  }
  /* the barn, before and after */
  const hit = clamp01((u - CROSS) / 1.6);
  if (hit < 1) {
    drawSprite(g, bx, gy - BARN.length + 1, BARN, C.barn, C.barnRim);
    putCell(g, bx + 16, gy - 6, '▪', C.lamp);
    if (hit > 0) {
      for (let k = 0; k < 6; k++) putCell(g, bx + 2 + k * 3, gy - BARN.length - k, '▄', C.wood);
    }
  } else {
    /* the ruin: a wall standing, the rest in a heap */
    boxFill(g, bx, gy - 3, 4, 3, C.barn, C.barnRim);
    for (let x = bx + 3; x < bx + 12; x++) putCell(g, x, gy - 1, '▄', C.debris);
    for (let x = bx + 4; x < bx + 10; x += 2) putCell(g, x, gy - 2, '▪', C.dust);
    for (let k = 0; k < 5; k++) putCell(g, bx + 6 + k * 2, gy - 3 - (k % 3), '╱', C.wood);
  }
  /* the funnel: a cone that leans, with a skirt of dust at its foot */
  if (funnel) {
    const lean = Math.sin(clock * 1.1) * 2;
    const topY = 0, botY = hz;
    for (let y = topY; y < botY; y++) {
      const t = y / Math.max(1, botY);
      const half = Math.round(1 + t * t * 7);
      const cx = Math.round(fx + lean * (1 - t) + (u - TOUCH) * 1.2 * (1 - t));
      for (let d = -half; d <= half; d++) {
        const r = Math.abs(d) / (half + 0.01);
        if ((y * 3 + d * 5 + Math.round(clock * 8)) % 9 === 0) continue;
        putCell(g, cx + d, y, r > 0.66 ? '░' : '▓', mix(C.dust, [58, 54, 50], 0.15 + t * 0.3));
      }
    }
    for (let d = -12; d <= 12; d++) putCell(g, fx + d, hz - 1, Math.abs(d) > 8 ? '·' : '░', C.dust);
    lampLight(g, fx, hz - 6, 14, 0.1, C.dust);
  }
  /* the farmhouse, and the farmer running for it */
  const hx2 = Math.round(w * 0.12);
  boxFill(g, hx2, gy - 5, 10, 5, C.house, [70, 64, 62]);
  for (let k = 0; k < 4; k++) for (let x = hx2 - 1 + k; x <= hx2 + 10 - k; x++) putCell(g, x, gy - 6 - k, '▄', C.barnRim);
  putCell(g, hx2 + 4, gy - 2, '▪', C.lamp);
  if (u < CROSS) {
    const t = clamp01((u - 1.5) / 6);
    person(g, Math.round(w * 0.42 - t * (w * 0.22)), gy, C.coat, u > 2 ? 'run' : 'walk');
  } else if (u < GONE) {
    person(g, hx2 + 5, gy, C.coat, 'stand');
  } else {
    person(g, hx2 + 3, gy, C.coat, 'stand');
    person(g, hx2 + 7, gy, C.coat, 'stand');
    putCell(g, hx2 + 5, gy - 1, '·', C.dust);
  }
  /* debris in the air while it passes */
  if (funnel) for (let i = 0; i < 12; i++) {
    const a = clock * (2 + i % 3) + i;
    putCell(g, Math.round(fx + Math.sin(a) * (6 + i % 5)), Math.round(hz - 4 - (i % 9)), i % 3 ? '·' : '▄', C.debris);
  }
}

/* ---------- ocean, dry: a pod of dolphins crossing the bow ---------- */
function oceanPeace(g, w, h, hz, clock, C) {
  const pod = [0, 1, 2];
  pod.forEach((i, k) => {
    const t = ((clock * 0.22 + i * 0.09) % 1);
    const x = Math.round(w * 0.1 + t * w * 0.7);
    const y = hz + 2;
    const arc = Math.sin(Math.PI * clamp01((t * 2) % 1));
    const lift = Math.round(arc * (4 + k));
    const diving = t > 0.5;
    const body = mix(C.hull, [150, 202, 234], 0.62);
    const len = 11, arcH = 5 + k;
    for (let i = 0; i < len; i++) {
      const t2 = i / (len - 1);
      const bx = x + i, by = Math.round(y - Math.sin(Math.PI * t2) * arcH - 1);
      putCell(g, bx, by, '█', body);
      putCell(g, bx, by + 1, '█', mix(body, C.foam, 0.18));
      putCell(g, bx, by + 2, '▀', mix(body, C.seaMid, 0.5));
    }
    /* nose, tail and a dorsal fin, so the arc is plainly an animal */
    putCell(g, x + len - 1, y - arcH - 1, '▄', body);
    putCell(g, x + len, y - arcH, '▄', body);
    putCell(g, x - 1, y - 1, '▄', body);
    putCell(g, x - 2, y - 2, '▄', body);
    putCell(g, x - 2, y, '▄', body);
    const finX = x + Math.round(len * 0.55), finY = Math.round(y - arcH - 1);
    putCell(g, finX, finY - 1, '█', body);
    putCell(g, finX - 1, finY - 1, '▄', body);
    putCell(g, finX + 1, finY - 1, '▄', body);
    if (arc > 0.2) {
      for (let d = -5; d <= 5; d++) putCell(g, x + d, y + 2, '·', C.spray);
      putCell(g, x + 4, y - lift - 4, '·', C.glint);
    }
    if (t < 0.05 || (t > 0.48 && t < 0.55)) {
      for (let d = -3; d <= 3; d++) putCell(g, x + d, y, d % 2 ? '░' : '·', C.foam);
      lampLight(g, x, y, 5, 0.08, C.spray);
    }
  });
}

/* ---------- aurora, dry: Ichabod crosses the bridge with nobody behind him ---------- */
function quietRide(g, w, hz, clock) {
  const C = NIGHT;
  const span = w + 60;
  const x = Math.round(-30 + ((clock % 24) / 24) * span);
  const horseTop = hz - 9;
  const rim = mix(C.moon, C.moonHalo, 0.3);
  const body = [7, 6, 14], cape = [12, 10, 22];
  /* the bridge: planks, rails and two posts, so this is plainly a bridge and a man riding over it */
  for (let bx = x - 14; bx < x + 26; bx++) {
    if (bx < 0 || bx >= w) continue;
    putCell(g, bx, hz - 1, '═', mix(C.path, C.bark, 0.4));
    putCell(g, bx, hz, '▄', C.pathDark);
    if (bx % 6 === 0) { putCell(g, bx, hz - 2, '│', C.bark); putCell(g, bx, hz - 3, '▄', C.bark); }
  }
  backlightBand(g, w, horseTop, 9, C.moonHalo, clock);
  drawSprite(g, x, horseTop, HORSE_BIG, body, rim);
  haloSprite(g, x, horseTop, HORSE_BIG, rim, 0.22);
  drawSprite(g, x + 3, horseTop - 2, ICHABOD_BIG, cape, rim);
  haloSprite(g, x + 3, horseTop - 2, ICHABOD_BIG, rim, 0.2);
  const lx = x + 3 + 9, ly = horseTop + 1 + (Math.sin(clock * 3) > 0 ? 0 : 1);
  putCell(g, lx, ly, '▄', C.lantern);
  putCell(g, lx, ly + 1, '█', C.lanternCore);
  lampLight(g, lx, ly + 1, 9, 0.26 + 0.04 * Math.sin(clock * 5), C.lantern);
}
function backlightBand(g, w, horseTop, half, colour, clock) {
  const mid = horseTop - 1;
  for (let y = mid - half; y <= mid + half; y++) {
    const f = 1 - Math.abs(y - mid) / half;
    if (f <= 0) continue;
    for (let x = 0; x < w; x++) blendCell(g, x, y, colour, 0.34 * f * (0.88 + 0.12 * Math.sin(x * 0.21 + clock * 0.8)));
  }
}

/* ---------- the show: big set pieces that rotate through every picture ----------
   The weather is the backdrop; this is the thing you look at. Each theme has its own running order, drawn from a
   library of large effects — meteor showers, aurora ribbons, branched lightning, spiralling swarms, fireworks,
   tornadoes, rising lanterns, blizzards, a breaching whale, an aeroplane and its searchlight, a glyph bloom, a
   glitch. One holds the picture for eighteen seconds, fading in and out so nothing ever pops, then the next takes
   over, so the scene is never the same twice round. Each effect is written from the clock alone and is deliberately
   large: whole-sky arcs, forty-spark bursts, hundred-strong swarms, so it reads from across the room.          */
const SHOW_LEN = 72;
const VIVID = {
  aurora: { a: [96, 255, 214], b: [176, 128, 255], white: [240, 255, 252], glyph: '✦' },
  ember: { a: [255, 148, 52], b: [255, 66, 34], white: [255, 242, 206], glyph: '·' },
  ocean: { a: [96, 214, 255], b: [124, 146, 255], white: [230, 250, 255], glyph: '︿' },
  forest: { a: [122, 255, 172], b: [70, 196, 136], white: [236, 255, 236], glyph: '•' },
  candy: { a: [255, 126, 204], b: [142, 224, 255], white: [255, 246, 252], glyph: '♥' },
  mono: { a: [238, 238, 248], b: [148, 148, 168], white: [255, 255, 255], glyph: '·' },
  matrix: { a: [126, 255, 166], b: [40, 206, 112], white: [228, 255, 236], glyph: '▮' },
  plain: { a: [242, 246, 255], b: [148, 170, 214], white: [255, 255, 255], glyph: '·' },
  garden: { a: [255, 176, 150], b: [236, 108, 128], white: [255, 244, 236], glyph: '❀' },
};
const SHOWS = {
  aurora: { wet: ['bolts', 'meteors', 'ribbons', 'swarm'], dry: ['ribbons', 'meteors', 'lanterns', 'swarm'] },
  ember: { wet: ['firewhirl', 'bolts', 'swarm', 'meteors'], dry: ['lanterns', 'ribbons', 'swarm', 'firewhirl'] },
  ocean: { wet: ['bolts', 'tornado', 'whale', 'swarm'], dry: ['whale', 'swarm', 'ribbons', 'lanterns'] },
  forest: { wet: ['bolts', 'swarm', 'snow', 'ribbons'], dry: ['swarm', 'lanterns', 'ribbons', 'meteors'] },
  candy: { wet: ['snow', 'swarm', 'fireworks', 'ribbons'], dry: ['fireworks', 'lanterns', 'swarm', 'ribbons'] },
  mono: { wet: ['bolts', 'tornado', 'meteors', 'swarm'], dry: ['plane', 'lanterns', 'swarm', 'fireworks'] },
  matrix: { wet: ['glitch', 'bolts', 'swarm', 'meteors'], dry: ['glyphbloom', 'ribbons', 'swarm', 'meteors'] },
  plain: { wet: ['tornado', 'bolts', 'snow', 'swarm'], dry: ['lanterns', 'swarm', 'ribbons', 'meteors'] },
  garden: { wet: ['bolts', 'tornado', 'swarm', 'meteors'], dry: ['lanterns', 'swarm', 'ribbons', 'meteors'] },
};
const showEnv = local => Math.min(1, local / 1.1, (SHOW_LEN - local) / 1.1);

/* meteors: five of them, each a bright head with an eighteen-cell tail burning out behind it */
function fxMeteors(g, w, h, clock, local, V) {
  const env = showEnv(local);
  for (let i = 0; i < 5; i++) {
    const f = (local - (0.6 + i * 3.1)) / 1.5;
    if (f < 0 || f > 1.2) continue;
    const sx = w * (0.06 + (i % 3) * 0.24), sy = 1 + (i % 4);
    const dx = w * 0.68, dy = h * 0.36;
    for (let k = 0; k < 18; k++) {
      const fi = f - k * 0.042;
      if (fi < 0) continue;
      const x = Math.round(sx + fi * dx), y = Math.round(sy + fi * dy);
      putCell(g, x, y, k === 0 ? '✧' : k < 6 ? '✦' : k < 11 ? '•' : '·', mix(V.white, V.a, (k / 12) * env));
      if (k < 9) blendCell(g, x, y, V.a, 0.3 * (1 - k / 9) * env);
      if (k === 0) { blendCell(g, x + 1, y, V.white, 0.3 * env); blendCell(g, x, y + 1, V.white, 0.2 * env); }
    }
  }
}

/* aurora ribbons: six curtains of light crossing the whole sky, folding into each other */
function fxRibbons(g, w, h, clock, local, V) {
  const env = showEnv(local);
  for (let b = 0; b < 4; b++) {
    const base = h * 0.1 + b * h * 0.13;
    for (let x = 0; x < w; x++) {
      const y = base + Math.sin(x * 0.055 + clock * 0.8 + b * 1.5) * (2 + b * 0.5)
        + Math.sin(x * 0.018 - clock * 0.4 + b) * 2.2;
      const col = mix(V.a, V.b, (Math.sin(x * 0.045 + clock * 0.55 + b * 0.9) + 1) / 2);
      for (let d = 0; d < 3; d++) blendCell(g, x, Math.round(y) + d, col, (0.34 - d * 0.1) * env);
      putCell(g, x, Math.round(y), '▒', mix(col, V.white, 0.5));
      const ray = Math.sin(x * 0.9 + clock * 3.1 + b * 2) + Math.sin(x * 0.31 - clock * 1.7);
      if (ray > 1.1) {                                     // the rays hanging inside the curtain, uneven like light
        for (let d = 1; d < 3 + (x % 4); d++) putCell(g, x, Math.round(y) + d, '│', mix(col, V.white, 0.45 - d * 0.08));
      }
    }
  }
}

/* lightning: a jagged channel from the top of the sky to the ground, forked twice, with the whole sky lit behind it */
function fxBolts(g, w, h, clock, local, V, ground) {
  const env = showEnv(local);
  const period = 8, idx = Math.floor(local / period), ph = local - idx * period;
  if (ph > 0.28) return;
  const k = (1 - ph / 0.28) * env;
  const bx = Math.round(w * (0.15 + 0.6 * (0.5 + 0.5 * Math.sin(idx * 2.7 + 1))));
  const forks = [];
  for (let yy = 0; yy < ground; yy++) {
    const x = Math.round(bx + Math.sin(yy * 0.7 + idx) * 1.9 + Math.sin(yy * 2.6 + idx * 3) * 0.8);
    putCell(g, x, yy, '│', mix(V.white, V.a, yy / ground));
    blendCell(g, x, yy, V.a, 0.42 * k);
    blendCell(g, x + 1, yy, V.white, 0.14 * k);
    if (yy === Math.round(ground * 0.4) || yy === Math.round(ground * 0.68)) forks.push([x, yy]);
  }
  for (const [fx0, fy0] of forks) {
    let fx = fx0, fy = fy0;
    for (let s = 0; s < 11; s++) {
      fx += Math.round(Math.sin(s * 1.3 + fy0) * 1.5) + (fx0 < bx ? -1 : 1);
      fy++;
      if (fy >= ground) break;
      putCell(g, fx, fy, '·', V.white);
      blendCell(g, fx, fy, V.a, 0.3 * k);
    }
  }
  for (let yy = 0; yy < ground; yy++) {
    const f = 0.055 * k * (1 - yy / Math.max(1, ground));
    for (let x = 0; x < w; x++) blendCell(g, x, yy, V.white, f);
  }
  for (let x = 0; x < w; x++) blendCell(g, x, ground, V.a, 0.3 * k);
}

/* a swarm: a hundred bright motes spiralling round a point that wanders the sky (fireflies, gulls, spores) */
function fxSwarm(g, w, h, clock, local, V) {
  const env = showEnv(local);
  const cx = w * 0.5 + Math.sin(clock * 0.4) * w * 0.3;
  const cy = h * 0.34 + Math.cos(clock * 0.55) * h * 0.12;
  for (let i = 0; i < 112; i++) {
    const a = clock * (1.15 + (i % 4) * 0.22) + i * 2.399;
    const r = 2 + (i % 13) * (1.5 + Math.sin(clock * 0.7 + i) * 0.6);
    const x = Math.round(cx + Math.cos(a) * r * 1.9 + Math.sin(clock + i) * 2);
    const y = Math.round(cy + Math.sin(a) * r * 0.8);
    const b = (0.5 + 0.5 * Math.sin(clock * 3 + i)) * env;
    putCell(g, x, y, i % 4 === 0 ? V.glyph : i % 4 === 1 ? '✦' : '·', mix(V.b, V.white, b));
    if (i % 6 === 0) blendCell(g, x, y, V.a, 0.22 * env);
  }
}

/* fireworks: four shells, each a streak up from the ground and then a forty-eight spark burst falling under gravity */
function fxFireworks(g, w, h, clock, local, V) {
  const env = showEnv(local);
  for (let s = 0; s < 4; s++) {
    const t0 = 0.7 + s * 3.5;
    const cx = Math.round(w * (0.18 + (s % 3) * 0.3));
    const cy = Math.round(h * (0.2 + (s % 2) * 0.14));
    if (local > t0 && local < t0 + 0.9) {
      const f = (local - t0) / 0.9, yy = Math.round(h - 4 - f * (h - 4 - cy));
      for (let k = 0; k < 5; k++) putCell(g, cx + (k % 2), yy + k, '·', mix(V.b, V.white, k / 5));
      blendCell(g, cx, yy, V.a, 0.3 * env);
    }
    const f = local - (t0 + 0.9);
    if (f < 0 || f > 2.4) continue;
    const k = (1 - f / 2.4) * env;
    const col = mix(V.a, V.b, s % 2);
    if (f < 0.3) for (let dy = -1; dy <= 2; dy++) for (let dx = -7; dx <= 7; dx++) blendCell(g, cx + dx, cy + dy, V.white, 0.2 * (1 - f / 0.3));
    for (let i = 0; i < 56; i++) {
      const a = i * 2.399 + s;
      const r = Math.min(1, f / 1.5) * (12 + (i % 6) * 3);
      const x = Math.round(cx + Math.cos(a) * r * 1.8);
      const y = Math.round(cy + Math.sin(a) * r * 0.7 + f * f * 1.6);
      putCell(g, x, y, i % 5 === 0 ? '✦' : i % 3 === 0 ? '•' : '·', mix(col, V.white, k));
      if (i % 2 === 0) {                                     // the streak it came from, so the burst reads as a ring
        const rx = Math.round(cx + Math.cos(a) * r * 1.45), ry = Math.round(cy + Math.sin(a) * r * 0.52 + f * f * 1.4);
        putCell(g, rx, ry, '·', mix(col, V.b, 0.8 * k));
      }
      if (i % 4 === 0) blendCell(g, x, y, col, 0.28 * k);
    }
    blendCell(g, cx, cy, V.white, 0.3 * k);
  }
}

/* a tornado: ninety particles in a helix, narrow at the foot and wide at the top, turning; embers rise with it */
function fxTornado(g, w, h, clock, local, V, ground, hot) {
  const env = showEnv(local);
  const grow = Math.min(1, local / 2.5) * Math.min(1, (SHOW_LEN - local) / 2.5);
  const top = Math.round(h * 0.1), base = ground;
  const cx = w * 0.5 + Math.sin(clock * 0.3) * w * 0.24;
  for (let i = 0; i < 92; i++) {
    const t = ((i / 92) + clock * 0.055) % 1;
    const y = Math.round(base - t * (base - top) * grow);
    const r = (1 - t) * 3 + t * w * 0.075 + Math.sin(t * 9 + clock * 2 + i) * 1.2;
    const a = clock * (3 + t * 2) + i * 1.7;
    const x = Math.round(cx + Math.cos(a) * r * 1.7);
    putCell(g, x, y, t > 0.55 ? '▒' : '▓', mix(V.b, V.a, 0.2 + t * 0.6 + 0.2 * Math.sin(a)));
    if (i % 4 === 0) blendCell(g, x, y, V.a, 0.2 * env);
  }
  for (let i = 0; i < 28; i++) {
    const a = clock * 4 + i * 0.9;
    const x = Math.round(cx + Math.cos(a) * (5 + (i % 5) * 2.2));
    putCell(g, x, base - (i % 2), i % 3 ? '·' : '˙', mix(V.a, V.b, 0.4));
  }
  if (hot) {                                        // a fire whirl: the embers it lifts, and the glow at its foot
    for (let i = 0; i < 22; i++) {
      const t = ((local * 0.4 + i * 0.13) % 1);
      const x = Math.round(cx + Math.sin(i * 2.3 + clock * 5) * (3 + t * 14));
      putCell(g, x, Math.round(base - t * (base - top)), i % 4 ? '·' : '*', mix(V.a, V.white, 0.7));
    }
    lampLight(g, Math.round(cx), base - 2, 9, 0.3 * env, V.a);
  }
}

/* lanterns: eighteen of them rising out of the dark, swaying, each with its own glow */
function fxLanterns(g, w, h, clock, local, V) {
  const env = showEnv(local);
  for (let i = 0; i < 18; i++) {
    const t = (local * (0.045 + (i % 4) * 0.014) + i * 0.31) % 1;
    const x = Math.round(w * (0.06 + ((i * 37) % 88) / 100) + Math.sin(clock * 0.8 + i) * 2.6);
    const y = Math.round(h - 3 - t * (h - 6));
    const fl = 0.6 + 0.4 * Math.sin(clock * 6 + i * 2);
    putCell(g, x, y, '▄', mix(V.a, V.white, 0.35 + fl * 0.65));
    putCell(g, x, y + 1, '█', mix(V.a, V.white, fl));
    putCell(g, x, y + 2, '▀', mix(V.a, V.b, 0.55));
    putCell(g, x, y - 1, '│', mix(V.b, V.a, 0.6));
    putCell(g, x - 1, y + 1, '░', mix(V.a, V.white, 0.5 * env));
    putCell(g, x + 1, y + 1, '░', mix(V.a, V.white, 0.5 * env));
    putCell(g, x, y + 3, '░', mix(V.a, V.b, 0.6 * env));
    for (let dy = -1; dy <= 3; dy++) for (let dx = -1; dx <= 1; dx++)
      blendCell(g, x + dx, y + dy, V.a, (dx === 0 && dy > 0 ? 0.34 : 0.16) * env * (0.7 + 0.3 * fl));
  }
}

/* a blizzard: a hundred and forty flakes in three depths, each caught in the swirl of the wind */
function fxSnow(g, w, h, clock, local, V, ground) {
  const env = showEnv(local);
  for (let i = 0; i < 140; i++) {
    const depth = i % 3;
    const speed = 4 + depth * 5;
    const y = (i * 17 + clock * speed) % (h + 6) - 3;
    const x = (i * 29 + Math.sin(clock * (1.1 + depth * 0.4) + i) * (3 + depth * 4) + w) % w;
    const ch = depth === 2 ? '❄' : depth === 1 ? '*' : '·';
    putCell(g, Math.round(x), Math.round(y), ch, mix(V.b, V.white, (depth + 1) / 3 * env));
    if (depth === 2 && i % 7 === 0) blendCell(g, Math.round(x), Math.round(y), V.a, 0.14 * env);
  }
  for (let x = 0; x < w; x += 3) blendCell(g, x, ground, V.white, 0.14 * env);
}

/* a whale: up out of the sea, the whole body clear of the water, blowing, then down again with a splash */
function fxWhale(g, w, h, clock, local, V, sea) {
  const f = (local - 4) / 6.5;
  if (f < 0 || f > 1) return;
  const rise = Math.sin(Math.PI * f);
  const cx = Math.round(w * (0.3 + 0.3 * f));
  const y = Math.round(sea + 4 - rise * 12);
  const BODY = [
    '      ▄▄▄▄▄▄▄▄▄▄      ',
    '   ▄▄████████████████▄▄   ',
    ' ▄████████████████████████▄ ',
    '  ▀▀████████████████████▀▀  ',
  ];
  drawSprite(g, cx - 13, y, BODY, mix(V.b, [10, 24, 34], 0.55), V.a);
  for (let i = 0; i < 4; i++) putCell(g, cx - 13 - i, y + 2 - (i >> 1), '▀', V.a);   // the flukes
  for (let i = 0; i < 4; i++) putCell(g, cx + 12 + i, y + 1 + (i >> 1), '▄', V.b);
  if (rise > 0.5) {                                    // the spout, high above the blowhole
    for (let i = 0; i < 16; i++) {
      const t = i / 16;
      putCell(g, Math.round(cx - 2 + Math.sin(clock * 6 + i) * (0.6 + t * 2.4)), Math.round(y - 2 - t * 8), '˙', mix(V.white, V.a, t));
    }
    blendCell(g, cx - 2, y - 4, V.white, 0.2);
  }
  const ring = Math.round(4 + rise * 9);
  for (let d = -ring; d <= ring; d++) {
    if ((d + Math.round(clock * 6)) % 2) continue;
    putCell(g, cx + d, Math.round(sea), '░', mix(V.a, V.white, 0.35));
  }
}

/* an aeroplane: crossing the sky, nav lights blinking, and a searchlight cone sweeping the rooftops below */
function fxPlane(g, w, h, clock, local, V, ground) {
  const f = local / SHOW_LEN;
  const x = Math.round(-14 + f * (w + 30)), y = Math.round(h * 0.16 + Math.sin(f * 4) * 2);
  drawSprite(g, x, y, ['   ▄▄   ', '▄██████▄', ' ▀▀▀▀▀▀ '], mix(V.b, [18, 18, 24], 0.4), V.a);
  for (let i = 0; i < 3; i++) putCell(g, x - 1 - i, y, '▀', V.b);       // the tail
  if (Math.floor(clock * 2) % 2) { putCell(g, x - 2, y + 1, '▪', V.white); blendCell(g, x - 2, y + 1, V.a, 0.3); }
  if (Math.floor(clock * 1.4) % 2) putCell(g, x + 9, y + 1, '▪', mix(V.a, V.white, 0.6));
  for (let s = 2; s < Math.max(8, ground - y - 2); s++) {                // the searchlight
    const px = Math.round(x + 6 + s * 0.7 + Math.sin(clock * 0.9) * 2), py = Math.round(y + 2 + s * 0.55);
    blendCell(g, px, py, V.a, 0.1 * (1 - s / ground));
    blendCell(g, px + 1, py, V.a, 0.05 * (1 - s / ground));
  }
}

/* a glyph bloom: a ring of characters opening out from the middle of the picture, three times a pass */
function fxGlyphbloom(g, w, h, clock, local, V) {
  const env = showEnv(local);
  const GLYPHS = 'ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉ';
  const cyc = local % 5.6;
  if (cyc > 2.6) return;
  const k = cyc / 2.6;
  const cx = Math.round(w * 0.5), cy = Math.round(h * 0.36);
  const r = k * Math.max(w, h) * 0.62;
  for (let i = 0; i < 72; i++) {
    const a = i * 2.399;
    const x = Math.round(cx + Math.cos(a) * r * 1.7), y = Math.round(cy + Math.sin(a) * r * 0.8);
    putCell(g, x, y, GLYPHS[i % GLYPHS.length], mix(V.white, V.a, k * env));
    if (i % 5 === 0) blendCell(g, x, y, V.a, 0.2 * (1 - k) * env);
  }
  blendCell(g, cx, cy, V.white, 0.24 * (1 - k) * env);
}

/* a glitch: bands of the picture break into noise and slide, and bright characters fall out of the grid */
function fxGlitch(g, w, h, clock, local, V, ground) {
  const env = showEnv(local);
  for (let b = 0; b < 6; b++) {
    const on = Math.sin(local * 7 + b * 2.1) > 0.55;
    if (!on) continue;
    const y = Math.round(((local * 9 + b * 4.7) % Math.max(4, ground - 2)) + 1);
    const x0 = Math.round((0.5 + 0.5 * Math.sin(local * 2.3 + b)) * w * 0.75);
    for (let x = x0; x < Math.min(w, x0 + Math.round(w * 0.28)); x++) {
      putCell(g, x, y, '▒', mix(V.a, V.white, 0.3));
      blendCell(g, x, y, V.a, 0.24 * env);
    }
  }
  for (let i = 0; i < 14; i++) {
    const x = (i * 13 + Math.round(local * 9)) % w;
    const y = Math.round((local * 15 + i * 7) % Math.max(4, ground));
    putCell(g, x, y, '█', mix(V.white, V.a, 0.5));
    blendCell(g, x, y, V.a, 0.2 * env);
  }
}

const FX = {
  meteors: fxMeteors, ribbons: fxRibbons, bolts: fxBolts, swarm: fxSwarm, fireworks: fxFireworks,
  tornado: fxTornado, firewhirl: fxTornado, lanterns: fxLanterns, snow: fxSnow, whale: fxWhale,
  plane: fxPlane, glyphbloom: fxGlyphbloom, glitch: fxGlitch,
};
function showRows(g, w, h, rain) {
  const theme = SHOWS[UI.theme] ? UI.theme : 'aurora';
  const list = SHOWS[theme][rain === false ? 'dry' : 'wet'];
  const clock = sceneTime(), local = ((clock % SHOW_LEN) + SHOW_LEN) % SHOW_LEN;
  if (local >= 12) return;                          // a short accent, then let the painting rest
  const name = list[Math.floor(clock / SHOW_LEN) % list.length];
  const V = VIVID[theme] || VIVID.aurora;
  const ground = Math.max(3, Math.min(h - 1, (WEATHER[theme] || WEATHER.aurora).ground(h)));
  FX[name](g, w, h, clock, local, V, ground, name === 'firewhirl');
}

/* every theme's picture, by theme name; anything unknown falls back to the ride */
const SCENES = { aurora: sleepyHollow, ember: emberScene, ocean: oceanScene, forest: forestScene, candy: candyScene, mono: cityScene, matrix: matrixScene, plain: meadowScene, garden: gardenScene };
const sceneLum = c => Math.round(0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]);
const sceneGray = c => { const l = sceneLum(c); return [l, l, l]; };
const sceneSat = (c, k) => { const l = sceneLum(c); return c.map(v => Math.max(0, Math.min(255, Math.round(l + (v - l) * k)))); };
function vividGrid(g, k) {
  if (!(k > 1)) return;
  for (const row of g) for (const c of row) {
    if (!c) continue;
    if (Array.isArray(c.fg)) c.fg = sceneSat(c.fg, k);
    if (Array.isArray(c.bg)) c.bg = sceneSat(c.bg, k);
  }
}
function grayGrid(g) {
  for (const row of g) for (const c of row) {
    if (!c) continue;
    if (Array.isArray(c.fg)) c.fg = sceneGray(c.fg);
    if (Array.isArray(c.bg)) c.bg = sceneGray(c.bg);
  }
}
/* A quiet finishing pass gives every scene the same depth: a little air around the focal point and darker edges. */
const SCENE_GLOW = {
  aurora: [112, 142, 226], ember: [255, 116, 54], ocean: [88, 184, 224], forest: [116, 190, 126],
  candy: [236, 126, 206], mono: [164, 174, 204], matrix: [82, 220, 132], plain: [178, 156, 112], garden: [226, 128, 144],
};
function finishScene(g, w, h, theme, clock) {
  const glow = SCENE_GLOW[theme] || SCENE_GLOW.aurora;
  const fx = w * 0.5 + Math.sin(clock * 0.035) * w * 0.035, fy = h * 0.59;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const c = g[y] && g[y][x];
    if (!c) continue;
    const nx = Math.abs((x - w * 0.5) / Math.max(1, w * 0.5));
    const edge = clamp01((nx - 0.42) / 0.58);
    const corner = clamp01((Math.abs(y - h * 0.5) / Math.max(1, h * 0.5) - 0.62) / 0.38);
    const vignette = 0.035 + edge * edge * 0.17 + corner * 0.055;
    const focus = Math.exp(-(((x - fx) / Math.max(1, w * 0.34)) ** 2 + ((y - fy) / Math.max(1, h * 0.33)) ** 2) * 2.2) * 0.045;
    if (Array.isArray(c.fg)) c.fg = mix(mix(c.fg, [4, 6, 12], vignette), glow, focus);
    if (Array.isArray(c.bg)) c.bg = mix(mix(c.bg, [4, 6, 12], vignette), glow, focus * 0.7);
  }
}
/* the picture, and everything laid over it; the last word is /gray, which takes the colour out of all of it */
function sceneRows(w, h, rain) {
  let g;
  try { g = (SCENES[UI.theme] || sleepyHollow)(w, h, rain); }
  catch (e) { g = newGrid(w, h); }        // a broken picture must never cost anybody their conversation
  try {
    const P = WEATHER[UI.theme] || WEATHER.aurora, clock = sceneTime();
    vividGrid(g, UI.theme === 'mono' ? 1 : 1.2);
    /* paused shows just the still landscape: no weather overlays, no rain, no rotating animated shows */
    if (UI.scene !== 'paused') {
      if (rain === false) calmWeather(g, w, h, clock, P);
      else rainWeather(g, w, h, clock, P);
      showRows(g, w, h, rain);
    }
    finishScene(g, w, h, UI.theme, clock);
  } catch (e) { }
  if (UI.gray) grayGrid(g);
  return g;
}

/* ---------- laying the painting under the words ----------
   The transcript is ANSI text with no background of its own, so it is turned back into cells, the painting is put
   behind it, and the cells are turned into one row again. Text keeps every colour it had; only the empty cells, and
   the space inside a line, take the night behind them.                                                            */
function ansiCells(s) {
  const out = [];
  let f = null, b = null, bold = false, i = 0;
  s = String(s == null ? '' : s);
  while (i < s.length) {
    if (s[i] === '\u001b') {
      const m = /^\u001b\[([0-9;]*)m/.exec(s.slice(i));
      if (m) {
        const p = m[1] === '' ? [0] : m[1].split(';').map(Number);
        for (let k = 0; k < p.length; k++) {
          const c = p[k];
          if (c === 0) { f = null; b = null; bold = false; }
          else if (c === 1) bold = true;
          else if (c === 22) bold = false;
          else if (c === 39) f = null;
          else if (c === 49) b = null;
          else if (c === 38 || c === 48) {
            if (p[k + 1] === 5) { const v = p[k + 2]; if (c === 38) f = v; else b = v; k += 2; }
            else if (p[k + 1] === 2) { const v = [p[k + 2], p[k + 3], p[k + 4]]; if (c === 38) f = v; else b = v; k += 4; }
          }
        }
        i += m[0].length; continue;
      }
      const other = /^\u001b\[[0-9;?]*[A-Za-z]/.exec(s.slice(i));
      if (other) { i += other[0].length; continue; }
      i++; continue;
    }
    const cp = s.codePointAt(i), ch = String.fromCodePoint(cp);
    out.push({ ch, fg: f, bg: b, bold });
    if (wide(cp) === 2) out.push({ ch: '', fg: f, bg: b, bold, tail: true });
    i += ch.length;
  }
  return out;
}
const fgOf = v => v == null ? '' : (typeof v === 'number' ? (TTY ? '\u001b[38;5;' + v + 'm' : '') : fg(v));
const bgOf = v => v == null ? '' : (typeof v === 'number' ? (TTY ? '\u001b[48;5;' + v + 'm' : '') : bgc(v));
function cellsToAnsi(cells) {
  let out = '', cf = '#', cb = '#', cbold = false;
  for (const c of cells) {
    const f = c.fg == null ? null : (typeof c.fg === 'number' ? 'p' + c.fg : c.fg.join(','));
    const b = c.bg == null ? null : (typeof c.bg === 'number' ? 'p' + c.bg : c.bg.join(','));
    if (f !== cf || b !== cb || !!c.bold !== cbold) {
      out += R + (c.bold ? BOLD : '') + fgOf(c.fg) + bgOf(c.bg);
      cf = f; cb = b; cbold = !!c.bold;
    }
    out += c.ch;
  }
  return out + R;
}
function overRow(line, bg, w) {
  const fgs = ansiCells(line), cells = [];
  for (let i = 0; i < w; i++) {
    const f = fgs[i], b = bg[i];
    if (!f) { cells.push(b && b.ch ? b : { ch: ' ', bg: b ? b.bg : null }); continue; }
    if (f.tail) { cells.push(f); continue; }
    if (f.ch === ' ' && f.bg == null) {
      if (b && b.ch && !b.tail) cells.push({ ch: b.ch, fg: b.fg, bg: b.bg, bold: false });
      else cells.push({ ch: ' ', fg: null, bg: b ? b.bg : null });
      continue;
    }
    cells.push({ ch: f.ch, fg: f.fg, bg: f.bg == null && b ? b.bg : f.bg, bold: f.bold });
  }
  return cellsToAnsi(cells);
}

/* ---------- the screen ---------- */
  function makeScreen(state) {
    const size = () => FIXED || ({ W: Math.max(40, process.stdout.columns || 100), H: Math.max(10, process.stdout.rows || 30) });
    /* every row of the window, in order; the same function draws the demo, so what is checked is what is shown */
    function frame(W, H) {
      const busy = state.busy, ask = state.waiting, pull = state.pull;
      const headRows = H >= 16 ? 3 : 1;
      const askRows = ask ? 6 : 0;
      const tailRows = H >= 12 ? 3 : 2;
      const pickN = state.pick ? MODELS.length : 0;
      const pickCap = pickN ? Math.max(3, Math.min(8, pickN, H - 17)) : 0;
      const pickRows = pickN ? pickCap + 4 : 0;
      const menuN = state.menu ? state.menu.items.length : 0;
      const menuCap = menuN ? Math.min(menuN, 8) : 0;
      const menuRows = menuN ? menuCap + 4 : 0;
      const trH = Math.max(4, H - headRows - askRows - tailRows - pickRows - menuRows);
      TR_H = trH;
      const rows = [];
      const phase = (Date.now() - (state.t0 || Date.now())) / 260;

      /* title bar: filled edge to edge, with the reach and the mode on the right */
      const mark = (state.free ? '✦ free frontier' : (state.guard ? '⛨ whole PC, guarded' : '⌂ this folder only')) + dim('   ') + (state.mode === 'chat' ? acc2('chat') : acc('code'));
      const left = ' ' + grad('MOUNDSHROUD CODE', PAL.acc, PAL.acc2);
      const gap = Math.max(1, W - sw(left) - sw(mark) - 1);
      rows.push(bgc(PAL.panel) + padTo(left + spaces(gap) + mute(mark), W) + R);
      if (headRows === 3) {
        const meta = ' ' + dim('▸') + ' ' + mute(state.model || '?') + dim('  ·  ') + mute(Math.round((state.ctx || 32768) / 1024) + 'k memory') + dim('  ·  ') + dim(clip(state.dir || 'its own workspace', Math.max(12, W - 46)));
        rows.push(padTo(clip(meta, W), W));
        rows.push(dim('─'.repeat(W)));
      }

      /* the conversation, with rain falling on whatever is still empty */
      const lines = [];
      /* one blank line between blocks, never two: the page keeps an even rhythm however many steps came before */
      for (const b of state.blocks) for (const l of blockRows(b, W)) { if (!l.trim() && (!lines.length || !lines[lines.length - 1].trim())) continue; lines.push(l); }
      if (state.live) for (const l of blockRows({ kind: 'agent', text: state.live, partial: true }, W)) { if (!l.trim() && (!lines.length || !lines[lines.length - 1].trim())) continue; lines.push(l); }
      if (state.liveThink && UI.think) for (const l of blockRows({ kind: 'thought', text: state.liveThink, partial: true }, W)) { if (!l.trim() && (!lines.length || !lines[lines.length - 1].trim())) continue; lines.push(l); }
      /* scrolled back: state.scroll counts lines up from the newest, and stays on the same words while new ones arrive */
      const maxS = Math.max(0, lines.length - trH);
      if (state.scroll && state.seenN) state.scroll += Math.max(0, lines.length - state.seenN);
      state.seenN = lines.length;
      const sc = state.scroll = Math.max(0, Math.min(maxS, state.scroll || 0));
      state.maxScroll = maxS; state.trTop = headRows + 1;
      const view = lines.slice(Math.max(0, lines.length - trH - sc), lines.length - sc);
      /* the scrollbar in the last column, only when there is more than one screen: dim track, bright thumb */
      let sbar = null;
      if (maxS > 0) {
        const th = Math.max(1, Math.round(trH * trH / lines.length));
        const tt = Math.round((lines.length - trH - sc) / maxS * (trH - th));
        state.sb = { top: tt, h: th, trH, total: lines.length };
        sbar = []; for (let i = 0; i < trH; i++) sbar.push(i >= tt && i < tt + th ? acc('┃') : dim('│'));
      } else state.sb = null;
      /* the night ride goes in behind the words of the conversation; if it ever fails, the words are still drawn */
      let night = null;
      if (UI.scene !== 'off' && W >= 56 && trH >= 15) { try { night = sceneRows(W, trH, UI.mood === 'tragedy'); } catch (e) { night = null; } }
      for (let i = 0; i < trH; i++) {
        const l = i < view.length ? padTo(clip(view[i], W), W) : spaces(W);
        const r = night && night[i] ? overRow(l, night[i], W) : l;
        rows.push(sbar ? padTo(clip(r, W - 1), W - 1) + sbar[i] : r);
      }

    /* an approval, as a panel of its own */
    if (ask) {
      const a = ask.input || {};
      const what = a.command ? a.command : a.path ? a.path : toolTarget(a);
      rows.push('');
      const pickAllow = (ask.i || 0) === 0;
      const optRow = (on, label) => (on ? BOLD + acc2('▸ ' + label) + R : mute('  ' + label));
      rows.push(...panel('Allow this?', [
        acc(TOOL_WORD[ask.tool] || String(ask.tool || 'tool').toUpperCase()) + (what ? '   ' + text(clip(what, 48)) : ''),
        dim(clip(ask.why || 'It changes something on this PC.', 70)),
        ' ',
        optRow(pickAllow, 'Allow it, just this once'),
        optRow(!pickAllow, 'Refuse it — nothing runs'),
      ], W, warn));
      rows.push(padTo(dim('  ↑↓ choose   ·   Enter pick   ·   y allow   ·   n refuse   ·   Esc refuse'), W));
    }

    /* choosing a model: a list you walk with the arrow keys, right above the line you type on */
    if (pickN) {
      const innerW = Math.max(24, Math.min(W - 10, 72));
      const i = Math.max(0, Math.min(pickN - 1, state.pick.i));
      const top = Math.max(0, Math.min(Math.max(0, pickN - pickCap), i - Math.floor(pickCap / 2)));
      const defModel = modelOrder.getDefault(DATA);
      const body = [];
      for (let k = top; k < Math.min(pickN, top + pickCap); k++) {
        const m = MODELS[k], on = k === i;
        const cur = String(m.name).replace(/:latest$/, '') === String(state.model || '').replace(/:latest$/, '');
        const isDef = defModel && (modelOrder.matches(m, defModel) || (defModel === 'free-auto' && m.free));
        const sz = m.free ? 'free' : m.size ? (m.size / 1073741824).toFixed(1) + ' GB' : '';
        const role = cur ? 'driving now' : m.fileModel ? m.kindName + ' · ' + m.source + (m.format === 'gguf' && m.kind === 'llm' && llamaRunner.available() ? ' · runs directly' : m.importable ? ' · import' : '') : m.embedding ? 'embedding · /find' : m.tools ? 'tools' : 'chat only';
        const tag = [sz, isDef ? 'default' : '', role].filter(Boolean).join(' · ');
        const label = String(k + 1).padStart(2) + '  ' + m.name;
        const room = Math.max(12, innerW - 4 - tag.length);
        const row = (on ? '▸ ' : '  ') + padTo(clip(label, room), room) + ' ' + tag;
        body.push(on ? BOLD + acc2(row) + R : cur ? text(row) : mute(row));
      }
      rows.push('');
      rows.push(...panel('models', body, W, acc));
      rows.push(padTo(dim('  ↑↓ choose   ·   Enter switch   ·   Esc cancel   ·   /model 2 also works'), W));
    }

    /* every other choice is the same list, walked with the same keys */
    if (menuN) {
      const m = state.menu, innerW = Math.max(20, Math.min(W - 10, 62));
      const body = [];
      for (let k = 0; k < menuCap; k++) {
        const it = m.items[k], on = k === m.i;
        const row = (on ? '▸ ' : '  ') + padTo(clip(String(it.label || ''), innerW - 4), innerW - 4) + (it.hint ? ' ' + it.hint : '');
        body.push(on ? BOLD + acc2(row) + R : it.on ? text(row) : mute(row));
      }
      rows.push('');
      rows.push(...panel(m.title, body, W, acc));
      rows.push(padTo(dim('  ' + (m.hint || '↑↓ choose   ·   Enter pick   ·   Esc cancel')), W));
    }

    /* status: what it is doing on the left, what it is doing it with on the right */
    const spin = '⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏'[state.spin % 10];
    const secs = Math.round((Date.now() - (state.turn || Date.now())) / 1000);
    const steps = state.blocks.filter(x => x.kind === 'tool').length;
    const status = pull
      ? ' ' + acc(spin) + ' ' + text(pull.pct ? pull.pct + '%' : 'pulling') + dim('  ·  ') + mute(clip(pull.note || pull.label || '', Math.max(10, W - 42)))
        + (pull.bytes ? dim('  ' + mb(pull.bytes) + (pull.total ? ' of ' + mb(pull.total) : '')) : '')
      : (ask ? ' ' + warn('◷') + ' ' + text('waiting for you') + dim('  ' + secs + 's')
        : busy ? ' ' + acc(spin) + ' ' + agentc(clip(doingIt(state), 32)) + dim('  ' + secs + 's')
          : ' ' + okc('●') + ' ' + agentc('ready'))
        + (steps ? dim('  ·  ') + mute(steps + (steps === 1 ? ' step' : ' steps')) : '')
        + dim('  ·  ') + mute('⚖ ' + (state.autonomy || 'normal'))
        + (state.web ? dim('  ·  ') + acc2('net') : '')
        + (sc ? dim('  ·  ') + acc2('↑ ' + sc + ' lines back · PgDn') : '');
    const right = mute(state.model || '') + dim('  ·  ') + mute(Math.round((state.ctx || 32768) / 1024) + 'k') + ' ';
    const bar = padTo(status + spaces(Math.max(1, W - sw(status) - sw(right))) + right, W);
    rows.push(bgc(PAL.panel2) + bar + R);

    /* the line you type on: the light runs along what you have typed, and the caret blinks where you are */
    const avail = Math.max(10, W - 6);
    const chars = [...state.input];
    let start = 0; if (state.cursor > avail - 2) start = state.cursor - avail + 2;
    const at = state.cursor - start;
    /* the caret is the terminal's own cursor, set to a thin bar; draw() shows it for half of every second */
    const blink = false;
    state.caretOn = Math.floor(Date.now() / 500) % 2 === 0;
    const cue = ask ? warn('❯ ') : acc('❯ ');
    const placeholder = state.mode === 'chat' ? 'Say anything…' : 'Ask it to build something…';
    const content = state.input ? caretLine(chars, start, at, phase, blink)
      : (ask ? (blink ? caretCell(' ') : ' ') : (blink ? caretCell(' ') : ' ') + dim(placeholder));
    rows.push(padTo(' ' + cue + content, W));
    if (tailRows === 3) rows.push(padTo(dim('  Tab / /model models   ·   /chat or /code   ·   /help   ·   Enter sends   ·   Ctrl+C stops'), W));
    else rows.push('');
    state.cursorScreen = { row: H - (tailRows === 3 ? 1 : 0), col: 4 + sw(chars.slice(start, state.cursor).join('')) };
    return rows;
  }
  function draw() {
    const { W, H } = size();
    const rows = frame(W, H);
    /* each row is placed by its own number, so a row that fills the width can never push the rest of the screen down */
    let out = '\u001b[?25l';   // hidden while the rows are written, so it never flickers across the screen
    for (let i = 0; i < H; i++) out += '\u001b[' + (i + 1) + ';1H' + (rows[i] || '') + '\u001b[K';
    const cpos = state.cursorScreen || { row: H - 1, col: 4 };
    out += '\u001b[' + Math.min(H, cpos.row) + ';' + Math.max(1, Math.min(W, cpos.col)) + 'H' + (state.caretOn ? '\u001b[?25h' : '');
    process.stdout.write(out);
  }
  return { frame, draw, size };
}

/* ---------- the plain renderer, for when the output is piped instead of shown ---------- */
function plainSay(s) { process.stdout.write(s + '\n'); }
function plainBlockRows(b) {
  const out = [];
  if (b.kind === 'welcome') { out.push('', NAME, '  ' + (b.text || ''), ''); }
  else if (b.kind === 'user') { out.push('', 'you › ' + b.text); }
  else if (b.kind === 'agent') { out.push('agent › ' + b.text); }
  else if (b.kind === 'thought') { if (UI.think) out.push('  ⋯ ' + b.text); }
  else if (b.kind === 'tool') { out.push('  ⚙ ' + (TOOL_WORD[b.name] || b.name) + '  ' + toolTarget(b.input)); }
  else if (b.kind === 'result') { out.push('     ' + (b.isError ? '✗ ' : '✓ ') + String(b.text || '').split('\n').slice(0, 12).join('\n     ')); }
  else if (b.kind === 'answer') { out.push(b.allow ? '  ✓ allowed' : '  ✗ refused'); }
  else if (b.kind === 'stats') out.push('', ...(b.rows || []).map(r => r.h ? '  ── ' + r.h + ' ──' : '  ' + padTo(String(r[0] || ''), 9) + ' ' + r[1]));
  else if (b.kind === 'note') out.push('  ─ ' + b.text + ' ─');
  else if (b.kind === 'plan') out.push('  ☰ plan\n' + (b.steps || []).map((s, i) => '    ' + (s.done ? '✓ ' : '○ ') + (i + 1) + '. ' + s.text).join('\n'));
  else if (b.kind === 'model') out.push('    ' + b.text);
  else if (b.kind === 'error') out.push('  ! ' + b.text);
  return out;
}

/* ---------- shared: the session, and what the user can type ---------- */
async function resolve(opts) {
  let models = [], ollamaUp = false;
  const lastUsed = () => { try { return JSON.parse(fs.readFileSync(path.join(DATA, 'agent-sessions.json'), 'utf8'))[0] || {}; } catch (e) { return {}; } };
  const requested = opts.model || (opts.free ? agentLib.FREE : (lastUsed().model || ''));
  await new Promise(res => agentLib.list((up, list) => { ollamaUp = !!up; models = list || []; res(); }));
  /* Moundshroud Code always opens, even when gemma4:e4b (or the last-used model) is missing or Ollama is asleep */
  const check = agentLib.resolveNative({ model: requested, guard: !!opts.guard, ctx: opts.ctx || 32768 }, models);
  /* chat mode is the session's mode, not a mark on the model: the model keeps its tools ready for /code */
  let dir = String(opts.dir || '').trim();
  if (!dir) {                                  // started as 'mcode' in a folder: that folder is the project
    const here = safeDir.check(process.cwd());
    if (here.ok) dir = here.dir;
  }
  if (!dir) { const last = lastUsed(); if (last.dir) { const s = safeDir.check(last.dir); if (s.ok) dir = s.dir; } }
  return { check, dir, models, ollamaUp, fellBackFrom: check.fellBackFrom || '', noLocal: !!check.noLocal };
}

/* ---------- the demo frame, so the layout can be looked at without a window ---------- */
function demo(W, H) {
  const state = {
    blocks: [
      { kind: 'welcome', text: NAME },
      { kind: 'user', text: 'add a dark mode toggle to settings.js, then check the page' },
      { kind: 'agent', text: 'I will read the settings page first, then add the switch and check it.\n\n```js\nconst key = "darkmode";\n```' },
      { kind: 'tool', name: 'read_file', input: { path: 'web/js/settings.js' } },
      { kind: 'result', text: '1  // Settings: the whole page, one row at a time.\n2  (() => {\n3    const ls = A.store();', isError: false },
      { kind: 'tool', name: 'run_command', input: { command: 'node --check web/js/settings.js' } },
      { kind: 'result', text: '(no output)', isError: false },
      { kind: 'note', text: 'models — /model 2 or /model gemma' },
      { kind: 'model', text: '▸  1  gemma4:e4b' },
      { kind: 'model', text: '   2  smollm2-135m-instruct-q2-k   chat only' },
      { kind: 'agent', text: 'The switch is in, and the file still parses. Open Settings › AI & power to try it.' },
      { kind: 'answer', allow: true, tool: 'run_command' },
    ],
    live: '', busy: false, spin: 3, model: 'gemma4:e4b', ctx: 32768, dir: 'C:\\Users\\you\\projects\\kestrel',
    guard: false, free: false, input: '/model 2', cursor: 8, waiting: null, turn: Date.now(), mode: 'code', pull: null, t0: 0,
    autonomy: 'normal', plan: [], blinkOn: true, web: false, chatted: false,
    interrupted: false,
    doing: null,
  };
  const scr = makeScreen(state);
  for (const r of scr.frame(W, H)) process.stdout.write(r + '\n');
  /* and one with a question waiting, to show the approval panel */
  state.blocks = state.blocks.slice(0, 3); state.input = ''; state.cursor = 0;
  state.busy = true; state.waiting = { id: 'x', tool: 'run_command', input: { command: 'del todo.txt' }, why: 'Delete the file I just made, as you asked.', i: 0 };
  process.stdout.write('\n');
  for (const r of scr.frame(W, H)) process.stdout.write(r + '\n');
}

/* ---------- run ---------- */
(async () => {
  const o = argsOf(process.argv.slice(2));
  if (o.help) { console.log(HELP); return; }
  if (o.demo) { COLOR = 24; loadUI(); demo(o.w || 100, o.h || 30); return; }   // the demo looks like the window you would get
  if (process.env.COLORTERM && /256/.test(process.env.COLORTERM)) COLOR = 256;
  if (o.w || o.h) FIXED = { W: Math.max(40, o.w || 100), H: Math.max(10, o.h || 30) };
  loadUI();

  const rr = await resolve(o);
  const check = rr.check;
  MODELS = rr.models || [];
  /* the walk for model files runs in the background; the list grows when it is done */
  finder.findAsync().then(r => { FILES = (r && r.models) || []; MODELS = withFiles(MODELS); try { if (typeof repaint === 'function') repaint(); } catch (e) { } }).catch(() => { });
  let dir = rr.dir;
  if (!dir) { dir = path.join(agentLib.DIR, 'workspace'); try { fs.mkdirSync(dir, { recursive: true }); } catch (e) { } }
  let sd = safeDir.check(dir);
  if (!sd.ok) {
    dir = path.join(agentLib.DIR, 'workspace');
    try { fs.mkdirSync(dir, { recursive: true }); } catch (e) { }
    sd = safeDir.check(dir);
    if (!sd.ok) {
      dir = path.join(DATA, 'workspace');
      try { fs.mkdirSync(dir, { recursive: true }); } catch (e) { }
      sd = { ok: true, dir };
    }
  }
  dir = sd.dir; CWD = dir;      // so the window can show .\file instead of the whole path

  const store = H.store(DATA);
  const customFile = path.join(DATA, 'mcode-custom.json');
  const custom = mcodeCustom.create({
    load: () => { try { return JSON.parse(fs.readFileSync(customFile, 'utf8')); } catch (e) { return null; } },
    save: value => {
      const temporary = customFile + '.' + process.pid + '.tmp';
      try {
        fs.mkdirSync(DATA, { recursive: true });
        fs.writeFileSync(temporary, JSON.stringify(value, null, 2));
        fs.renameSync(temporary, customFile);
        return true;
      } catch (e) {
        try { fs.unlinkSync(temporary); } catch (cleanupError) { }
        return false;
      }
    }
  });
  const Hn = N.create({ dataDir: DATA, custom, save: rec => { try { store.save(rec); } catch (e) { } } });

  /* the terminal always opens in chat (it talks, it changes nothing); --code, or /code inside, starts the agent */
  const initMode = o.mode === 'code' && !check.chat ? 'code' : 'chat';
  const state = {
    blocks: [{ kind: 'welcome', text: NAME }], live: '', busy: false, spin: 0, waiting: null,
    model: check.model, ctx: check.ctx, dir, guard: !!check.guard, free: !!check.free, input: '', cursor: 0,
    turn: 0, seq: 0, mode: initMode, check, pull: null, t0: Date.now(),
    autonomy: 'normal', plan: [], blinkOn: true, web: false, chatted: false,
    interrupted: false,
  };
  const tui = TTY ? makeScreen(state) : null;
  const say = s => { if (tui) { tui.draw(); } else plainSay(s); };
  const print = rows => { for (const r of rows) plainSay(r); };
  const flush = () => { state.blocks.forEach(b => { if (!b.__shown) { b.__shown = true; print(plainBlockRows(b)); } }); };
  /* a block goes into the transcript; when the output is piped it is printed at once, so a script sees every answer */
  const add = b => { state.blocks.push(b); if (!TTY && !b.__shown) { b.__shown = true; print(plainBlockRows(b)); } return b; };
  const note = t => add({ kind: 'note', text: String(t) });
  const err = t => add({ kind: 'error', text: String(t == null || t === '' ? 'Something went wrong.' : t) });
  /* a short name for a model, in either mode: chat needs no tools, so a small model can talk even if it cannot work */
  function checkFor(name, mode, ctx) {
    const want = { model: name, guard: state.guard, ctx: ctx || state.ctx || 32768 };
    const c = agentLib.check(want, MODELS);
    if (c.ok || mode !== 'chat') return c;
    const m = agentLib.pick(MODELS, name);
    if (m && /cannot use tools/i.test(c.error || '')) {
      return { ok: true, model: m.name, agentModel: m.name, ctx: want.ctx, guard: state.guard ? agentLib.GUARD : '', chat: true, noTools: true };
    }
    return c;
  }

  /* ------- start the session ------- */
  if (TTY) {
    process.stdout.write('\u001b[?1049h\u001b[?25l' + MOUSE_ON);   // a screen of its own, the cursor a thin bar, the wheel ours
    tui.draw();
    state.blocks.push({ kind: 'note', text: 'getting the model ready' }); tui.draw();
  } else print(['', NAME + '  ·  ' + check.model, '  folder ' + dir, '']);
  const started = await Hn.start({ check, dir, mode: state.mode });
  state.blocks = [{ kind: 'welcome', text: NAME }];
  state.check = check;
  state.autonomy = Hn.state(0).autonomy || 'normal';
  state.web = !!Hn.state(0).web;
  let openModelsNow = false;
  if (!started.ok) {
    note('Could not start ' + check.model + ' (' + (started.error || 'not ready') + ') — pick any model below (Tab or /model).');
    openModelsNow = true;
  } else if (rr.fellBackFrom) {
    note(rr.fellBackFrom + ' is not installed — using ' + check.model + '. Pick any model below or press Esc.');
    openModelsNow = true;
  } else if (o.pick || rr.noLocal || !o.model) {
    if (rr.noLocal) note('Ollama is not running yet — using ' + check.model + '. Start Ollama and press Tab or /model to pick a local model.');
    openModelsNow = true;
  }
  if (TTY && openModelsNow && MODELS.length) {
    const cur = MODELS.findIndex(m => String(m.name).replace(/:latest$/, '') === String(state.model || '').replace(/:latest$/, ''));
    state.pick = { i: Math.max(0, cur) };
  }
  if (TTY) tui.draw();

  /* ------- reading the harness ------- */
  let stdinLive = null;
  function pump() {
    let changed = false;
    const st = Hn.state(state.seq);
    for (const e of st.events) {
      changed = true;
      state.seq = Math.max(state.seq, e.seq);
      if (e.kind === 'started') continue;
      if (e.kind === 'user') { state.blocks.push({ kind: 'user', text: String(e.text || '') }); }
      else if (e.kind === 'thought') { state.blocks.push({ kind: 'thought', text: String(e.text || '') }); state.doing = { what: 'thinking' }; }
      else if (e.kind === 'tool') { state.blocks.push({ kind: 'tool', name: e.name, input: e.input }); state.doing = { what: 'tool', name: e.name }; }
      else if (e.kind === 'result') { state.blocks.push({ kind: 'result', text: e.text, isError: !!e.isError }); state.doing = { what: 'thinking' }; }
      else if (e.kind === 'text') {
        state.live = '';
        state.blocks.push({ kind: 'agent', text: String(e.text || ''), born: Date.now() });
        state.doing = { what: 'writing' };
        if (UI.anim) state.animUntil = Math.max(state.animUntil || 0, Date.now() + Math.min(1200, 200 + String(e.text || '').length * 4));
      }
      else if (e.kind === 'ask') state.waiting = { id: e.id, tool: e.tool, input: e.input, why: e.why, i: 0 };
      else if (e.kind === 'answer') { state.waiting = null; state.blocks.push({ kind: 'answer', allow: !!e.allow, late: !!e.late }); }
      else if (e.kind === 'done') { state.blocks.push({ kind: 'note', text: Date.now() - state.turn < 1200 ? 'done' : 'done · ' + Math.max(1, Math.round((Date.now() - state.turn) / 1000)) + 's' }); state.doing = null; clearInterrupt(); }
      else if (e.kind === 'error') { state.blocks.push({ kind: 'error', text: e.text }); state.doing = null; clearInterrupt(); }
      else if (e.kind === 'stopped') { state.blocks.push({ kind: 'note', text: 'stopped' }); state.doing = null; clearInterrupt(); }
      else if (e.kind === 'autonomy') { state.autonomy = e.level; state.blocks.push({ kind: 'note', text: 'autonomy · ' + e.level + (e.why ? '  — ' + e.why : '') }); }
      else if (e.kind === 'web') state.web = !!e.on;
      else if (e.kind === 'reach') state.guard = !!e.guard;
      else if (e.kind === 'plan') {
        const i = state.blocks.findIndex(x => x.kind === 'plan');
        const blk = { kind: 'plan', steps: e.steps || [] };
        if (i >= 0) state.blocks[i] = blk; else state.blocks.push(blk);
      }
    }
    if (st.live !== state.live) {
      state.live = st.live || ''; changed = true;
      if (state.live) state.doing = { what: 'writing' };          // words are arriving, so it is writing them
      else if (state.busy && state.doing && state.doing.what === 'writing') state.doing = { what: 'thinking' };
    }
    if ((st.thinkText || '') !== (state.liveThink || '')) { state.liveThink = st.thinkText || ''; changed = true; if (state.liveThink && state.busy) state.doing = { what: 'thinking' }; }
    if (!!st.busy !== state.busy) {
      state.busy = !!st.busy; changed = true;
      if (state.busy) { state.turn = Date.now(); state.doing = { what: 'thinking' }; }
      else state.doing = null;
    }
    if (st.pending && !st.pending.length && state.waiting) { state.waiting = null; changed = true; }
    if (st.mode && st.mode !== state.mode) { state.mode = st.mode; changed = true; }
    return changed;
  }
  const clearInterrupt = () => { state.interrupted = false; };
  const tick = setInterval(() => {
    try {
      const own = pump(), team = SWARM.members.length ? swarmPump() : false;
      let changed = own || team;
      if (!TTY) {
        flush();
        if (state.pull && Date.now() - (state.pullAt || 0) > 1500) {
          state.pullAt = Date.now();
          plainSay('  ⇣ ' + (state.pull.pct ? state.pull.pct + '%' : '') + (state.pull.bytes ? '  ' + mb(state.pull.bytes) + (state.pull.total ? ' of ' + mb(state.pull.total) : '') : '') + '  ·  ' + (state.pull.note || state.pull.label || ''));
        }
      } else {
        const blinkOn = Math.floor(Date.now() / 500) % 2 === 0;
        if (blinkOn !== state.blinkOn) { state.blinkOn = blinkOn; changed = true; }   // so the caret blinks while it waits
        /* in step mode nothing moves on its own: every redraw is a key, or a word arriving from the model */
        /* the chase behind the conversation is the one thing that moves when nothing else does */
        if (changed || state.busy || state.waiting || state.pick || state.menu || state.pull || UI.anim || UI.scene === 'on' || (state.animUntil || 0) > Date.now()) { state.spin++; tui.draw(); }
      }
    } catch (e) {
      // the hot loop must not die because one frame or one pump hiccuped
      const where = e && e.stack ? '\n(' + (String(e.stack).split('\n')[1] || '') + ')' : ''; err('The screen stumbled: ' + (e && (e.message || e)) + where); if (TTY) tui.draw();
    }
  }, 100);
  /* in a real window the screen is redrawn after every key and event; while idle it is left alone */
  const repaint = () => { try { pump(); if (TTY) tui.draw(); else flush(); } catch (e) { try { err('The screen stumbled: ' + (e && (e.message || e))); if (TTY) tui.draw(); } catch (oe) { } } };
  const wake = ms => { state.animUntil = Math.max(state.animUntil || 0, Date.now() + (ms || 700)); };

  /* ------- the commands that change the model ------- */
  async function refreshModels() {
    MODELS = withFiles(await new Promise(res => agentLib.list((up, list) => res(list || []))));
    return MODELS;
  }
  function modelList() {
    const cur = String(state.model || '').replace(/:latest$/, '');
    if (!MODELS.length) return err('Ollama is not running, so there is no list to show.');
    note('models  ·  /model 2  or  /model gemma');
    MODELS.forEach((m, i) => {
      const on = String(m.name).replace(/:latest$/, '') === cur;
      const tags = m.fileModel ? '   ' + m.kindName + ' · ' + m.source + (m.importable ? ' · /import ' + (i + 1) : '') : m.embedding ? '   embedding · /find' : (m.tools ? '' : '   chat only') + (m.free ? '   free' : '');
      add({ kind: 'model', text: (on ? '▸ ' : '  ') + String(i + 1).padStart(2) + '  ' + m.name + tags });
    });
  }
  /* every command with a choice opens the same kind of list: ↑↓ to walk it, Enter to take one, Esc to leave it */
  function openMenu(title, items, hint) {
    state.menu = { title, items, i: Math.max(0, items.findIndex(x => x.on)), hint };
    repaint();
  }
  const item = (label, on, go, hint) => ({ label, on: !!on, go, hint });
  /* a list to walk with the arrow keys: /model on an empty line or Tab opens it */
  function openPick() {
    if (state.busy) return err('Still working. /stop first.');
    const cur = MODELS.findIndex(m => String(m.name).replace(/:latest$/, '') === String(state.model || '').replace(/:latest$/, ''));
    state.pick = { i: Math.max(0, cur) };
    repaint();
    /* refresh live from Ollama in the background so newly pulled models show up immediately */
    refreshModels().then(() => {
      if (!state.pick) return;
      if (!MODELS.length) { state.pick = null; return repaint(); }
      state.pick.i = Math.max(0, Math.min(MODELS.length - 1, state.pick.i));
      repaint();
    }).catch(() => { });
  }
  async function switchModel(arg) {
    if (state.busy) return err('Still working. /stop first.');
    const m = agentLib.pick(MODELS, arg);
    if (!m) return err('There is no model like "' + arg + '" on this PC. /model lists them; /pull gets one from Hugging Face.');
    /* a model file outside Ollama, or a model that is not for talking: say what it is and how it can be used */
    /* a GGUF language model file runs straight from disk with llama.cpp: no copy into Ollama */
    const direct = m.fileModel && m.format === 'gguf' && m.kind === 'llm' && llamaRunner.available();
    if ((m.fileModel && !direct) || m.embedding) { describeModel(m); return repaint(); }
    let c = direct ? { ok: true, model: m.name, agentModel: m.name, ctx: 12288, direct: true, file: m.file, guard: state.guard ? agentLib.GUARD : '', free: false }
      : checkFor(m.name, state.mode, state.ctx), fell = false;
    /* any model can be chosen: one that cannot use tools talks instead of working, rather than being turned away */
    if (!c.ok && state.mode !== 'chat' && /cannot use tools/i.test(c.error || '')) {
      const alt = checkFor(m.name, 'chat', state.ctx);
      if (alt.ok) { c = alt; fell = true; }
    }
    if (!c.ok) return err(c.error);
    const mode = fell ? 'chat' : state.mode;
    const same = Hn.state(0).running && String(c.model).replace(/:latest$/, '') === String(state.model || '').replace(/:latest$/, '') && c.agentModel === (state.check || {}).agentModel;
    if (same) return note('already driving ' + c.model);
    note('switching to ' + c.model);
    if (TTY) tui.draw();
    /* reset sequence BEFORE the harness resets its own, so the tick interval cannot race */
    state.seq = 0;
    state.live = '';
    state.liveThink = '';
    state.doing = null;
    state.waiting = null;
    const r = await Hn.start({ check: c, dir, mode, keep: true });
    if (!r.ok) return err(r.error);
    state.check = c; state.model = c.model; state.ctx = c.ctx; state.free = !!c.free; state.blocks = state.blocks.filter(b => !(b.kind === 'agent' && !b.text));
    state.mode = mode;
    note('now driving ' + c.model + (c.free ? '   free frontier AI' : fell ? '   chat mode · this one cannot use tools, so it talks instead of working' : c.chat ? '   chat mode' : ''));
    repaint();
  }
  /* ------- every other kind of model on this PC ------- */
  const KIND_USE = {
    llm: 'a language model: it can chat, and drive the agent if it can use tools',
    embedding: 'an embedding model: it turns text into vectors, so /find can search this project by meaning',
    reranker: 'a reranker: it sorts search results by how well they answer a question',
    speech: 'a speech model: it turns speech into text or text into speech',
    audio: 'a music and sound generator',
    encoder: 'an encoder: other models use it to read images or text',
    diffusion: 'an image or video generator',
    classifier: 'a classifier: it puts text into labelled groups',
    adapter: 'an adapter: it changes another model and does not run alone',
    other: 'an AI model whose kind could not be read'
  };
  function describeModel(m) {
    const n = MODELS.indexOf(m) + 1;
    if (m.embedding && !m.fileModel) return note(m.name + ' is ' + KIND_USE.embedding + '. It cannot chat. /find <words> searches with it.');
    const where = m.source + ' · ' + m.format + ' · ' + mb(m.size || 0) + '\n  ' + m.file;
    if (m.importable) {
      note(m.name + ' is ' + (KIND_USE[m.kind] || KIND_USE.other) + '.\n  ' + where +
        '\n  Ollama runs it after it copies the file into its own store (' + mb(m.size || 0) + ' more on disk). /import ' + n + ' does that' +
        (m.kind === 'llm' ? ', then switches to it.' : ', then /find can use it.'));
    } else {
      note(m.name + ' is ' + (KIND_USE[m.kind] || KIND_USE.other) + '.\n  ' + where +
        '\n  A coding terminal has no way to run this kind of model' + (m.kind === 'llm' ? ' (Ollama cannot import its format)' : '') + '. Moundshroud lists it so you know it is here.');
    }
  }
  function freeBytes(p) { try { const s = fs.statfsSync(p); return Number(s.bavail) * Number(s.bsize); } catch (e) { return -1; } }
  async function importModel(arg) {
    if (state.busy || state.pull) return err('Still working. Wait for it, or /stop first.');
    const m = agentLib.pick(MODELS.filter(x => x.fileModel), arg) || agentLib.pick(MODELS, arg);
    if (!m || !m.fileModel) return err('There is no model file like "' + arg + '". /models lists the files this PC has; /scan looks again.');
    if (!m.importable) { describeModel(m); return repaint(); }
    const free = freeBytes(m.file);
    if (free >= 0 && free < (m.size || 0) * 1.1 + 5 * 1073741824) return err('Not enough free disk: importing ' + m.name + ' needs ' + mb((m.size || 0) * 1.1) + ' plus 5 GB to spare, and the drive has ' + mb(free) + '.');
    const name = finder.ollamaName(m, MODELS.filter(x => !x.fileModel).map(x => x.name));
    state.pull = { label: m.name, note: 'Ollama is copying the file', pct: 0, bytes: 0, total: 0 };
    note('import · ' + m.name + '  →  ' + name);
    if (TTY) tui.draw();
    const r = await hf.create(name, m.file);
    state.pull = null;
    if (!r.ok) { err(r.error); repaint(); return; }
    await refreshModels();
    note('added ' + name + ' to Ollama');
    if (m.kind === 'llm') return switchModel(name);
    note(name + ' is ready: /find <words> searches this project with it.');
    repaint();
  }
  async function scanModels() {
    note('looking for AI models on every drive · it takes up to half a minute');
    if (TTY) tui.draw();
    const r = await finder.findAsync({ fresh: true });
    FILES = (r && r.models) || [];
    await refreshModels();
    const counts = {};
    FILES.forEach(f => { counts[f.kindName || f.kind] = (counts[f.kindName || f.kind] || 0) + 1; });
    note('found ' + FILES.length + ' model files outside Ollama' + (FILES.length ? ': ' + Object.keys(counts).map(k => counts[k] + ' ' + k).join(', ') : '') + (r && r.timedOut ? ' (the walk hit its time limit)' : '') + '. /models lists them.');
    repaint();
  }
  async function findInProject(q) {
    if (state.busy) return err('Still working. /stop first.');
    const em = MODELS.find(m => m.embedding && !m.fileModel);
    if (!em) {
      const file = MODELS.find(m => m.fileModel && m.kind === 'embedding' && m.importable);
      return err('There is no embedding model in Ollama yet.' + (file ? ' /import ' + (MODELS.indexOf(file) + 1) + ' brings in ' + file.name + ' from ' + file.source + '.' : ' /pull nomic-ai/nomic-embed-text-v1.5-GGUF gets one.'));
    }
    note('find · "' + q + '" with ' + em.name);
    if (TTY) tui.draw();
    const r = await codeFind.search(dir, q, em.name, t => { state.pull = { label: 'find', note: t, pct: 0, bytes: 0, total: 0 }; if (TTY) tui.draw(); });
    state.pull = null;
    if (!r.ok) { err(r.error); return repaint(); }
    if (!r.hits.length) { note('nothing close to that in ' + r.files + ' files'); return repaint(); }
    note('closest to "' + q + '" in ' + r.files + ' files:\n' + r.hits.map(h => '  ' + h.rel + ':' + h.line + '   ' + Math.round(h.score * 100) + '%   ' + h.preview).join('\n'));
    repaint();
  }
  function setMode(mode) {
    const want = mode === 'chat' ? 'chat' : 'code';
    if (state.mode === want) return note('already in ' + want + ' mode');
    if (state.busy) return err('Still working. /stop first.');
    if (want === 'code' && state.check && state.check.noTools) return err(state.model + ' cannot use tools, so it cannot drive the agent. /model to pick one that can.');
    const r = Hn.setMode(want);
    if (!r.ok) return err(r.error);
    state.mode = want;
    note(want === 'chat' ? 'chat mode — it talks, and changes nothing. /code when you want it to work.' : 'code mode — the full agent, with its tools.');
  }
  async function pullModel(spec) {
    if (state.pull) return err('A model is already coming down. Wait for it.');
    const t = hf.parse(spec);
    if (!t) return err('Give a Hugging Face repo: /pull bartowski/SmolLM2-135M-Instruct-GGUF:Q4_K_M   (add :smallest for the littlest file)');
    state.pull = { label: t.repo, note: 'looking for GGUF files', pct: 0, bytes: 0, total: 0 };
    note('pull · ' + t.repo + (t.quant ? '  ·  ' + t.quant : ''));
    if (TTY) tui.draw();
    const r = await hf.pull(t, {
      onNote: n => { if (state.pull) state.pull.note = String(n); },
      onPct: (got, total) => { if (state.pull) { state.pull.bytes = got; state.pull.total = total; state.pull.pct = total ? Math.min(99, Math.round(got / total * 100)) : 0; } },
    });
    state.pull = null;
    if (!r.ok) { err(r.error); repaint(); return; }
    note('added ' + r.name + '  ·  ' + r.quant + '  ·  ' + mb(r.bytes) + '   →   /model ' + r.name);
    await refreshModels();
    repaint();
  }

/* ------- typing ------- */
  /* Ctrl+C and /stop only put the brakes on the turn: the conversation, the model and the folder all stay */
  function stop() { try { (Hn.halt || Hn.stop).call(Hn); } catch (e) { } repaint(); }
  let quitting = false;
  const doQuit = () => {
    if (TTY) { try { process.stdout.write(MOUSE_OFF + '\u001b[?25h\u001b[?1049l'); } catch (e) { } }
    try { musicOff(); } catch (e) { }
    try { Hn.stop(); } catch (e) { }
    try { clearInterval(tick); } catch (e) { }
    try { if (stdinLive && stdinLive.close) stdinLive.close(); } catch (e) { }
    try { process.stdin.off && process.stdin.off('keypress'); } catch (e) { }
    plainSay('');
    plainSay('  ' + (TTY ? mute('Session saved · ') : 'Session saved · ') + 'come back with /moundshroud-code or the Agent tab.');
    plainSay('');
    const gone = () => { if (!quitting) return; quitting = false; process.exit(0); };
    if (TTY) { setTimeout(gone, 30); } else { setTimeout(gone, 60); }
    // if the harness never lets go, still let the process go
    setTimeout(() => { if (quitting) process.exit(1); }, 4000);
  };
  function quit() {
    if (quitting) return;
    quitting = true;
    try { clearInterrupt(); } catch (e) { }
    doQuit();
  }
  function helpRows() {
    note('/tool builds a text tool for /code · /rule saves reply preferences for /chat and /code');
    [['/model', 'the models this PC has · /model 2 or /model qwen switches'],
    ['/chat', 'talk only: it answers, it changes nothing'],
    ['/code', 'the coding agent, with its tools'],
    ['/plan', 'the current plan, the folder and what it can reach'],
    ['/autonomy', 'how strictly it asks · careful · normal · auto'],
    ['/pull', 'one GGUF model from Hugging Face · /pull user/repo[:Q4_K_M]'],
    ['/scan', 'look on every drive for AI model files (GGUF, safetensors, ONNX and more)'],
    ['/import', 'bring a model file into Ollama so it can be used · /import 12'],
    ['/find', 'search this project by meaning with an embedding model · /find login check'],
    ['/theme', 'the colours · /theme ocean (aurora ember ocean forest candy mono matrix plain)'],
    ['/color', 'one colour · /color accent #ff8800'],
    ['/anim', 'the glow while typing and writing · on · off'],
    ['/scene', 'the picture behind the chat · peace · tragedy · pause · off'],
    ['/gray', 'the picture in black and white · on · off, any theme'],
    ['/think', 'what the model is working out, above its answer · on · off'],
    ['/music', 'a loop for this picture, made here · on · off · next'],
    ['/craft', 'study a website, app or game and rebuild it · Craft Anything'],
    ['/stats', 'how you have used it: messages, tools, models, folders, what it keeps'],
    ['/new', 'a fresh conversation'],
    ['/stop', 'stop the turn that is running'],
    ['/swarm', 'several local agents at once, one per role · ↑↓ roles, Enter a model · /swarm run <task> · /swarm help'],
    ['/whip', 'OpenWhip: halt slow turns & boost speed (or Alt+W / F6) · /whip off'],
    ['/dir', 'the folder it works in'],
    ['/reach', 'this folder only, or the whole PC · /reach pc'],
    ['/net', 'internet access for it · /net on, /net off'],
    ['/quit', 'leave — /bye and /exit do the same (Ctrl+C twice also works)']]
      .forEach(([k, d]) => add({ kind: 'model', text: '   ' + k.padEnd(9) + d }));
  }
  function themeList() {
    note('themes  ·  /theme ocean  ·  /color accent #ff8800   (now: ' + UI.theme + ')');
    for (const n of Object.keys(THEMES)) add({ kind: 'model', text: (n === UI.theme ? '▸ ' : '  ') + '   ' + n });
  }
  function setTheme(n) {
    UI.colors = {};                                   // a theme is the whole palette, so colours set by hand go
    if (!applyTheme(n)) return err('No theme called "' + n + '". /theme lists them.');
    saveUI(); musicSync(); note('theme · ' + UI.theme);
  }
  const MENU_HINT = '↑↓ choose   ·   Enter pick   ·   Esc cancel';
  function crackWhip(custom) {
    const phrase = openwhip.pickPhrase(custom);
    try { if (TTY) process.stdout.write('\x07'); } catch (e) { }
    const frames = openwhip.asciiFrames();
    add({ kind: 'model', text: frames[frames.length - 1] + '  "' + phrase + '"' });
    UI.think = false;
    try { if (Hn.setThink) Hn.setThink(false); } catch (e) { }
    state.interrupted = false;
    state.doing = { what: 'whipped — turbo on' };
    const r = Hn.whip ? Hn.whip(phrase) : (Hn.halt && Hn.halt(), Hn.send(phrase));
    if (r && r.ok) {
      if (r.sent) state.busy = true;
      else note('OpenWhip Turbo ON — next message runs in fast direct mode');
    } else if (r && r.error) {
      err(r.error);
    }
    repaint();
  }
  /* ------- /swarm: one agent per role, each with its own model, all working in this folder at once ------- */
  const swarmFile = process.env.MS_SWARM_FILE || path.join(DATA, 'mcode-swarm.json');
  const SWARM = { state: mcodeSwarm.createState((() => { try { return JSON.parse(fs.readFileSync(swarmFile, 'utf8')); } catch (e) { return null; } })()),
    members: [], asks: [], round: 0, task: '' };
  const saveSwarm = () => { try { fs.mkdirSync(DATA, { recursive: true }); fs.writeFileSync(swarmFile, JSON.stringify({ roles: SWARM.state.roles })); } catch (e) { } };
  const swarmModels = () => MODELS.filter(m => m && m.name && !m.free && !m.embedding && !m.fileModel);
  let hwCache = null;
  function hardware() {
    if (hwCache) return hwCache;
    let vramGB = 0;
    try {
      const line = String(cp.execFileSync('nvidia-smi', ['--query-gpu=memory.total', '--format=csv,noheader,nounits'], { encoding: 'utf8', timeout: 4000, windowsHide: true })).split(/\r?\n/).find(l => l.trim()) || '';
      vramGB = Math.round((+line || 0) / 1024 * 10) / 10;
    } catch (e) { }
    hwCache = { ramGB: Math.round(require('os').totalmem() / 1073741824 * 10) / 10, vramGB };
    return hwCache;
  }
  function swarmMenu() {
    const roles = SWARM.state.roles;
    const items = roles.map(role => item(role.name + '  ·  ' + (role.model || 'default: ' + state.model) + '  ·  ' + role.job, false, () => swarmModelMenu(role),
      'Enter picks a model for ' + role.name));
    items.push(item('+ add a role', false, () => note('/swarm add <role> [what it does]   e.g. /swarm add reviewer checks every change')));
    items.push(item('▶ run the swarm', false, () => note('/swarm run <task>   every role starts at once')));
    const fit = mcodeSwarm.fit(roles, swarmModels(), hardware(), state.model);
    note('swarm · ' + mcodeSwarm.fitMessage(fit, roles, state.model));
    if (!TTY) return note('swarm roles\n' + roles.map((role, i) => '  ' + (i + 1) + '  ' + role.name + ' · ' + (role.model || 'default') + ' · ' + role.job).join('\n'));
    openMenu('swarm roles', items, '↑↓ role · Enter its model · Esc close');
  }
  function swarmModelMenu(role) {
    const items = [item('default (' + state.model + ')', !role.model, () => { role.model = ''; saveSwarm(); swarmMenu(); })]
      .concat(swarmModels().map(m => item(m.name + '  ' + (m.size ? (Math.round(m.size / 1073741824 * 10) / 10) + ' GB' : ''), m.name === role.model,
        () => { role.model = m.name; saveSwarm(); swarmMenu(); })));
    openMenu('model for ' + role.name, items, '↑↓ model · Enter assign · Esc back');
  }
  const tagged = (member, text) => '[' + member.role.name + '] ' + text;
  function swarmPump() {
    let changed = false;
    for (const member of SWARM.members) {
      const st = member.h.state(member.seq);
      for (const e of st.events) {
        changed = true;
        member.seq = Math.max(member.seq, e.seq);
        if (e.kind === 'thought') add({ kind: 'thought', text: tagged(member, String(e.text || '')) });
        else if (e.kind === 'tool') add({ kind: 'tool', name: tagged(member, e.name), input: e.input });
        else if (e.kind === 'result') add({ kind: 'result', text: e.text, isError: !!e.isError });
        else if (e.kind === 'text') { member.last = String(e.text || ''); add({ kind: 'agent', text: tagged(member, member.last), born: Date.now() }); }
        else if (e.kind === 'ask') { SWARM.asks.push({ member, id: e.id }); note(tagged(member, 'wants to use ' + e.tool + (e.why ? ' · ' + e.why : '') + '  ·  /swarm yes or /swarm no')); }
        else if (e.kind === 'error') add({ kind: 'error', text: tagged(member, String(e.text || '')) });
        else if (e.kind === 'done' || e.kind === 'stopped') member.done = true;
      }
    }
    // When every role has finished a round, each one sees the others' results once and checks or fixes its part.
    if (SWARM.members.length && SWARM.members.every(member => member.done && !member.h.state(1e12).busy)) {
      if (SWARM.round < 1) {
        SWARM.round++;
        const board = SWARM.members.map(member => '[' + member.role.name + '] ' + (member.last || '(no answer)').slice(0, 1500)).join('\n\n');
        note('swarm · round ' + SWARM.round + ' done. Each role now checks the team’s results.');
        for (const member of SWARM.members) {
          member.done = false;
          const r = member.h.send('Team results so far:\n' + board + '\n\nCheck them against the task from your role. Fix what is wrong in your part, then answer briefly. Task: ' + SWARM.task);
          if (!r.ok) member.done = true;
        }
      } else {
        note('swarm · finished. ' + SWARM.members.map(member => member.role.name).join(', ') + ' are done.');
        swarmStop(false);
      }
      changed = true;
    }
    return changed;
  }
  function swarmStop(say) {
    for (const member of SWARM.members) { try { (member.h.halt || member.h.stop).call(member.h); } catch (e) { } try { member.h.stop(); } catch (e) { } }
    const had = SWARM.members.length;
    SWARM.members = []; SWARM.asks = [];
    if (say) note(had ? 'swarm · stopped' : 'No swarm is running.');
  }
  async function swarmRun(task) {
    if (SWARM.members.length) return err('A swarm is already running. /swarm stop ends it.');
    if (!task) return err('Usage: /swarm run <task>');
    await refreshModels().catch(() => { });
    const roles = SWARM.state.roles;
    const fit = mcodeSwarm.fit(roles, swarmModels(), hardware(), state.model);
    if (!fit.ok) return err(mcodeSwarm.fitMessage(fit, roles, state.model));
    const team = roles.map(role => ({ ...role, model: role.model || state.model }));
    const checks = team.map(role => checkFor(role.model, 'code'));
    const bad = checks.findIndex(c => !c.ok);
    if (bad >= 0) return err(team[bad].name + ' cannot work with ' + team[bad].model + ': ' + (checks[bad].error || 'that model is not ready') + '. /swarm opens the role list.');
    note('swarm · ' + team.map(role => role.name + ' (' + role.model + ')').join(' · ') + '  ·  ' + fit.needGB + ' GB  ·  /swarm stop ends it');
    SWARM.task = task; SWARM.round = 0;
    const members = team.map((role, i) => ({ role, check: checks[i], h: N.create({ dataDir: DATA, custom, save: () => { } }), seq: 0, done: false, last: '' }));
    const started = await Promise.all(members.map(m => m.h.start({ check: m.check, dir, mode: 'code' }).catch(e => ({ ok: false, error: String(e.message || e) }))));
    const failed = started.findIndex(r => !r || !r.ok);
    if (failed >= 0) { members.forEach(m => { try { m.h.stop(); } catch (e) { } }); return err(members[failed].role.name + ' could not start: ' + (started[failed]?.error || 'not ready')); }
    SWARM.members = members;
    for (const m of members) {
      const r = m.h.send(mcodeSwarm.rolePrompt(m.role, team, task) + '\nWork only on your part. Other roles work in this folder at the same time, so do not undo their changes.\n\nTask: ' + task);
      if (!r.ok) { m.done = true; err(tagged(m, r.error)); }
    }
    repaint();
  }
  async function swarmCommand(arg) {
    const a = String(arg || '').trim();
    if (/^(?:help|\?)$/i.test(a)) return note(mcodeSwarm.help.replace(/^mcode · /, '').replace(/role list:.*$/m, 'role list: ↑ ↓ pick a role · Enter picks its model · Esc closes')
      .replace(' (alone: the current objective)', '') + '\n  /swarm yes · /swarm no      answer a role that asks to change something · /swarm stop ends the swarm');
    if (/^stop$/i.test(a)) return swarmStop(true);
    if (/^(?:yes|y|no|n)$/i.test(a)) {
      const next = SWARM.asks.shift();
      if (!next) return err('No swarm question is waiting.');
      const r = next.member.h.answer(next.id, /^y/i.test(a));
      return r.ok ? note(tagged(next.member, /^y/i.test(a) ? 'allowed' : 'refused')) : err(r.error);
    }
    if (!a) { if (!MODELS.length) await refreshModels().catch(() => { }); return swarmMenu(); }
    const result = mcodeSwarm.command(SWARM.state, a, swarmModels().map(m => m.name));
    if (result.action === 'picker') return swarmMenu();
    if (result.action === 'run') return swarmRun(result.task);
    if (result.action === 'list') return note('swarm roles\n' + SWARM.state.roles.map((role, i) => '  ' + (i + 1) + '  ' + role.name + ' · ' + (role.model || 'default') + ' · ' + role.job).join('\n'));
    if (result.action === 'changed') saveSwarm();
    return result.action === 'error' ? err(result.text) : note(result.text);
  }

  async function command(line) {
    const [cmd, ...rest] = line.trim().split(/\s+/), arg = rest.join(' ');
    /* three ways out, all the same: /quit, /exit and /bye */
    if (cmd === '/quit' || cmd === '/exit' || cmd === '/bye') return quit();
    if (cmd === '/help' || cmd === '?') return helpRows();
    /* the same /plan the playground's mcode has: the objective, where it works and how far it has got */
    if (cmd === '/plan') {
      const plan = (state.blocks || []).filter(b => b.kind === 'plan').pop();
      const steps = (plan && plan.steps) || [];
      const chosen = state.model || (MODELS[0] && MODELS[0].name) || 'none chosen';
      const rows = [
        'plan · ' + (state.mode === 'code' ? 'code mode' : 'chat mode') + ' · ' + dir,
        'reach ' + (state.guard ? 'the whole PC, still guarded' : 'this folder only') +
          ' · autonomy ' + state.autonomy + ' · model ' + chosen + ' · internet ' + (state.web ? 'on' : 'off')
      ];
      if (state.busy) rows.push('now · ' + (state.doing && state.doing.what ? state.doing.what : 'busy'));
      if (steps.length) {
        rows.push('', 'steps it is following');
        steps.forEach((step, i) => rows.push('  ' + (step.done ? '✓' : '○') + ' ' + (i + 1) + '. ' + step.text));
      } else {
        rows.push('', 'No plan yet. In /code it writes the steps here as it works them out.',
          'Start with /code <what you want done>, or /help for every command.');
      }
      return note(rows.join('\n'));
    }
    if (cmd === '/submit') {
      return note('There is no exercise to submit here — /submit belongs to the practice terminals (Terminal Playground, the Labyrinth, the ranges). In this Agent tab, ask for the work in /code and it just does it.');
    }
    if (cmd === '/swarm') return swarmCommand(arg);
    if (cmd === '/roles') return swarmCommand(arg || 'roles');
    if (cmd === '/role') return swarmCommand(arg ? (/^(?:add|new|rm|remove|del|delete|set|assign|job|describe)\s/i.test(arg) ? arg : 'set ' + arg) : 'roles');
    if (cmd === '/tool' || cmd === '/rule') {
      if (state.busy || Hn.state(0).busy) return err('Still working. /stop first.');
      return note(custom.command(cmd.slice(1), line.trim().slice(cmd.length).trim()));
    }
    if (cmd === '/new') {
      if (state.busy) { err('Still working. /stop first.'); return; }
      Hn.clear(); state.seq = 0; state.blocks = [{ kind: 'welcome', text: NAME }]; state.live = ''; state.waiting = null;
      state.chatted = false;
      Hn.start({ check: state.check, dir, mode: state.mode });
      return;
    }
    if (cmd === '/stop') {
      const r = Hn.halt ? Hn.halt() : Hn.stop();
      note(r.ok ? 'stopped — still in the session, so go on when you are ready' : 'nothing is running');
      return;
    }
    if (cmd === '/whip') {
      if (/^(off|stop|normal|disable)$/i.test(arg)) {
        if (Hn.setTurbo) Hn.setTurbo(false);
        note('OpenWhip Turbo OFF — normal pacing restored');
        return;
      }
      return crackWhip(arg);
    }
    if (cmd === '/model' || cmd === '/models') {
      if (arg) return switchModel(arg);
      if (!TTY) return modelList();                        // piped output has no arrow keys, so it prints the list
      if (!MODELS.length) {
        await refreshModels();
        if (!MODELS.length) return err('Ollama is not running, so there is no list to choose from.');
      }
      return openPick();
    }
    if (cmd === '/chat') return setMode('chat');
    if (cmd === '/code') return setMode('code');
    if (cmd === '/net' || cmd === '/web') {
      const w2 = String(arg || '').toLowerCase();
      const set = on => {
        const r = Hn.setWeb(on);
        state.web = !!(r && r.web);
        return note(on ? 'internet on — it may read public pages and APIs, and still nothing on this PC' : 'internet off — nothing leaves this PC');
      };
      if (!w2) {
        if (!TTY) return note('internet · ' + (state.web ? 'on — it may read public pages' : 'off — nothing it does leaves this PC') + '   —   /net on  ·  /net off');
        return openMenu('internet', [
          item('off    nothing leaves this PC', !state.web, () => set(false)),
          item('on     it may read public pages', state.web, () => set(true)),
        ], MENU_HINT);
      }
      return set(!(w2 === 'off' || w2 === 'no' || w2 === '0'));
    }
    if (cmd === '/reach') {
      const w2 = String(arg || '').toLowerCase();
      const set = whole => {
        const r = Hn.setReach(whole);
        if (!r.ok) return err(r.error);
        state.guard = !!r.guard;
        return note(state.guard ? 'whole PC — it may read anywhere, and Windows, this app and your keys stay shut' : 'this folder only — ' + dir);
      };
      if (!w2) {
        if (!TTY) return note('reach · ' + (state.guard ? 'whole PC, still guarded' : 'this folder only') + '   —   /reach folder  ·  /reach pc');
        return openMenu('reach', [
          item('this folder only', !state.guard, () => set(false)),
          item('the whole PC, still guarded', state.guard, () => set(true)),
        ], MENU_HINT);
      }
      return set(w2 === 'pc' || w2 === 'whole' || w2 === 'all' || w2 === 'on' || w2 === 'yes');
    }
    if (cmd === '/autonomy' || cmd === '/strict' || cmd === '/trust') {
      const lvl = String(arg || '').toLowerCase();
      const set = async l => {
        const r = await Hn.setAutonomy(l);
        if (!r.ok) return err(r.error);
        state.autonomy = r.level || l;
        return note(l === 'careful' ? 'careful — it asks before every change' : l === 'normal' ? 'normal — it asks before commands that change the PC' : 'auto — it only asks when something is forbidden, and still never does the forbidden things');
      };
      if (!lvl) {
        if (!TTY) return note('autonomy · ' + state.autonomy + '   —   /autonomy careful  ·  normal  ·  auto');
        return openMenu('autonomy', [
          item('careful   asks before every change', state.autonomy === 'careful', () => set('careful')),
          item('normal    asks before commands that change the PC', state.autonomy === 'normal', () => set('normal')),
          item('auto      only when something is forbidden', state.autonomy === 'auto', () => set('auto')),
        ], MENU_HINT);
      }
      if (!['careful', 'normal', 'auto'].includes(lvl)) return note('autonomy · ' + state.autonomy + '   —   /autonomy careful  ·  normal  ·  auto');
      return set(lvl);
    }
    if (cmd === '/import') {
      if (!arg) return note('bring a model file into Ollama · /import 12  or  /import qwen · /models shows the numbers');
      return importModel(arg);
    }
    if (cmd === '/scan') return scanModels();
    if (cmd === '/find') {
      if (!arg) return note('search this project by meaning · /find where the settings are saved');
      return findInProject(arg);
    }
    if (cmd === '/pull' || cmd === '/hf') {
      if (!arg) return note('pull a GGUF model from Hugging Face · /pull user/repo  ·  /pull user/repo:Q4_K_M  ·  /pull user/repo:smallest');
      return pullModel(arg);
    }
    if (cmd === '/theme') {
      if (arg) return setTheme(arg);
      if (!TTY) return themeList();
      return openMenu('themes', Object.keys(THEMES).map(n => item(n, n === UI.theme, () => setTheme(n))), MENU_HINT);
    }
    if (cmd === '/color' || cmd === '/colour') {
      const [slot, hex] = rest;
      if (!slot || !hex) return err('Use /color agent #ff8800. Colours: you, agent, thinking, accent, accent2, ok, warn, bad, text, mute, dim.');
      const names = { accent: 'acc', accent2: 'acc2', code: 'acc2', good: 'ok', warning: 'warn', error: 'bad', you: 'you', agent: 'agent', thinking: 'think', thought: 'think', reply: 'agent' };
      const k = names[String(slot).toLowerCase()] || String(slot).toLowerCase();
      const rgb = hex2rgb(hex);
      if (!Object.prototype.hasOwnProperty.call(PAL, k) || k === 'bg' || k === 'panel' || k === 'panel2' || k === 'line') return err('That is not a colour you can change. Use you, agent, thinking, accent, accent2, ok, warn, bad, text, mute or dim.');
      if (!rgb) return err('Give a colour like #ff8800.');
      PAL[k] = rgb; UI.colors[k] = rgb2hex(rgb); saveUI();
      note(slot + ' is now ' + UI.colors[k]);
      return;
    }
    if (cmd === '/anim') {
      const w = String(arg || '').toLowerCase();
      const set = on => {
        UI.anim = on; UI.animMode = on ? 'smooth' : 'off'; saveUI();
        note('animation · ' + (on ? 'on — the glow while typing and writing' : 'off — the glow is still. The night ride has its own switch: /scene'));
      };
      if (w) return set(!(w === 'off' || w === 'no' || w === '0'));
      if (!TTY) return note('animation · ' + (UI.anim ? 'on' : 'off') + '   —   /anim on  ·  /anim off');
      return openMenu('animation', [
        item('the glow while typing and writing', UI.anim, () => set(true)),
        item('still', !UI.anim, () => set(false)),
      ], MENU_HINT);
    }
    /* the painting behind the conversation: one command, and the arrow keys walk the four states of it */
    if (cmd === '/scene' || cmd === '/ride' || cmd === '/art') {
      const w2 = String(arg || '').toLowerCase();
      const rideLabel = () => UI.scene === 'off' ? 'off'
        : UI.scene === 'paused' ? 'paused · ' + sceneMood()
          : sceneMood();
      const set = mode => {
        if (mode === 'peace' || mode === 'tragedy') {
          UI.mood = mode;
          mode = 'on';
        }
        if (mode === 'paused') { if (!SCENE_PAUSED_AT) SCENE_PAUSED_AT = sceneTime(); }
        else {
          if (UI.scene === 'paused' && SCENE_PAUSED_AT) SCENE_T0 = Date.now() - SCENE_PAUSED_AT * 1000;   // no jump on resume
          SCENE_PAUSED_AT = 0;
        }
        UI.scene = mode;
        saveUI(); musicSync();
        note(sceneName() + ' · ' + rideLabel() + '   (/scene to change it)');
      };
      if (w2) {
        if (w2 === 'pause' || w2 === 'paused' || w2 === 'hold') return set('paused');
        if (w2 === 'off' || w2 === 'none' || w2 === 'black' || w2 === 'hide') return set('off');
        if (w2 === 'peace' || w2 === 'calm') return set('peace');
        if (w2 === 'tragedy' || w2 === 'storm') return set('tragedy');
        return note('Choose /scene peace, /scene tragedy, /scene pause, or /scene off.');
      }
      if (!TTY) return note(sceneName() + ' · ' + rideLabel() + '   —   /scene peace  ·  tragedy  ·  pause  ·  off');
      return openMenu(sceneName(), [
        item('Peace · quiet life, gentle motion', UI.scene === 'on' && sceneMood() === 'peace', () => set('peace')),
        item('Tragedy · danger, loss, and a storm', UI.scene === 'on' && sceneMood() === 'tragedy', () => set('tragedy')),
        item('Pause · show a still landscape', UI.scene === 'paused', () => set('paused')),
        item('Off · no scene behind the conversation', UI.scene === 'off', () => set('off')),
      ], '↑↓ choose   ·   Enter pick   ·   Esc cancel');
    }
    /* colour or no colour: the picture only, never the chat */
    if (cmd === '/gray' || cmd === '/grey' || cmd === '/grayscale' || cmd === '/greyscale') {
      const w2 = String(arg || '').toLowerCase();
      const set = on => {
        UI.gray = on; saveUI();
        note(on ? 'picture · grayscale — the scene loses its colour, the words keep theirs'
                : 'picture · colour');
      };
      if (w2) return set(!(w2 === 'off' || w2 === 'no' || w2 === '0' || w2 === 'false'));
      if (!TTY) return note('picture · ' + (UI.gray ? 'grayscale' : 'colour') + '   —   /gray on  ·  /gray off');
      return openMenu('picture', [
        item('colour           the scene as painted', !UI.gray, () => set(false)),
        item('grayscale        the same scene, no colour at all', UI.gray, () => set(true)),
      ], MENU_HINT);
    }
    if (cmd === '/craft' || cmd === '/craft-anything') {
      const bin = N.craft.path();
      if (!arg) {
        if (!bin) return note(N.craft.how);
        const v = N.craft.run('--version', 20000);
        note('craft anything · ' + (String(v.text || '').trim() || 'installed') + '   at ' + bin);
        return note('study a target and rebuild it · /craft rebuild <target> "what you want"   ·   /craft commands  lists its 320 tools');
      }
      const r = N.craft.run(arg, /rebuild|triage|report|chat/i.test(arg) ? 20 * 60000 : 180000, dir);
      if (!r.ok && r.missing) return note(N.craft.how);
      const raw = String(r.whole || r.text || r.error || '');
      let parsed = null;
      try { parsed = JSON.parse(raw); } catch (e) { }
      note('craft anything · ' + arg);
      if (Array.isArray(parsed)) {                        // every tool: counted by toolset, not poured out whole
        const by = {};
        for (const c of parsed) { const k = String(c.toolset || 'other'); (by[k] = by[k] || []).push(String(c.command || c.tool || '?')); }
        for (const k of Object.keys(by)) add({ kind: 'result', text: padTo(k, 12) + ' ' + String(by[k].length).padStart(3) + '   ' + by[k].slice(0, 5).join(', ') + (by[k].length > 5 ? ', …' : '') });
        return note(parsed.length + ' tools in all   —   /craft <tool-name> --help  for any one of them');
      }
      if (parsed && parsed.tools && parsed.toolsets) {    // what this install can do
        add({ kind: 'result', text: String(parsed.tools) + ' tools · ' + parsed.toolsets.length + ' toolsets · ' + String(parsed.analysis_mode || '') + ' · ' + String(parsed.host || '') });
        for (const e of (parsed.engines || [])) if (e.found) add({ kind: 'result', text: '✓ ' + e.name + '  ' + String(e.path || '') });
        return note('the engines it can already use are above; the rest are optional second opinions');
      }
      const body = raw.split('\n');
      for (const l of body.slice(0, 24)) add({ kind: 'result', text: l, isError: !r.ok });
      if (body.length > 24) note('… ' + (body.length - 24) + ' more lines');
      return;
    }
    if (cmd === '/think' || cmd === '/thoughts') {
      const w = String(arg || '').toLowerCase();
      const set = on => {
        UI.think = on; saveUI();
        try { if (typeof Hn.setThink === 'function') Hn.setThink(on); } catch (e) { }
        note(on ? 'thinking · shown — what it works out comes above its answer' : 'thinking · hidden — only the answer is shown');
      };
      if (w) return set(!(w === 'off' || w === 'no' || w === '0'));
      if (!TTY) return note('thinking · ' + (UI.think ? 'shown' : 'hidden') + '   —   /think on  ·  /think off');
      return openMenu('thinking', [
        item('hidden    only the answer', !UI.think, () => set(false)),
        item('shown     the working-out too', UI.think, () => set(true)),
      ], MENU_HINT);
    }
    if (cmd === '/music' || cmd === '/bgm' || cmd === '/sound') {
      const w = String(arg || '').toLowerCase();
      const turn = on => {
        const r = musicOn(on);
        if (!r.ok) return err(r.error);
        note(on ? 'music · on — ' + musicLabel() + '   (/music next for another, /music off for silence)' : 'music · off, and quiet');
      };
      const other = () => {
        const r = musicNext();
        if (!r.ok) return err(r.error);
        note('music · ' + musicLabel(r.track) + '   (/music next again, /music off to stop)');
      };
      if (w === 'next' || w === 'shuffle' || w === 'another' || w === 'random') return other();
      if (w) return turn(!(w === 'off' || w === 'no' || w === '0'));
      if (!TTY) return note('music · ' + (musicPlaying() ? musicLabel() : 'off') + (MUSIC.err ? ' — ' + MUSIC.err : '') + '   —   /music on  ·  /music next  ·  /music off');
      return openMenu('music', [
        item('off    quiet', !MUSIC.on, () => turn(false)),
        item('on     the loop for this picture', MUSIC.on, () => turn(true)),
        item('next   another one, at random', false, other),
      ], MENU_HINT);
    }
    if (cmd === '/stats' || cmd === '/usage' || cmd === '/about') {
      const mine = state.blocks || [];
      const myTools = {};
      for (const b of mine) if (b.kind === 'tool') myTools[b.name] = (myTools[b.name] || 0) + 1;
      const myMsgs = mine.filter(b => b.kind === 'user').length;
      const myCalls = Object.values(myTools).reduce((a, b) => a + b, 0);
      const myAns = mine.filter(b => b.kind === 'answer');
      const myErr = mine.filter(b => b.kind === 'error').length;
      const mins = Math.max(0, Math.round((Date.now() - APP_STARTED) / 60000));
      const rows = [
        { h: 'this session' },
        { 0: 'messages', 1: myMsgs + ' sent   ·   ' + myCalls + ' tool call' + (myCalls === 1 ? '' : 's') + '   ·   ' + myAns.length + ' approval' + (myAns.length === 1 ? '' : 's') + ' (' + myAns.filter(a => a.allow).length + ' allowed)   ·   ' + myErr + ' error' + (myErr === 1 ? '' : 's') },
        { 0: 'driving', 1: (state.model || '?') + '   ·   ' + state.mode + ' mode   ·   ' + (state.guard ? 'whole PC, guarded' : 'this folder only') + '   ·   ' + mins + 'm open' },
        { 0: 'folder', 1: dir || '(none)', dim: true },
      ];
      /* everything the app has kept: the last sixty conversations, read from the data folder */
      let all = [];
      try { const j = JSON.parse(fs.readFileSync(path.join(DATA, 'agent-sessions.json'), 'utf8')); all = Array.isArray(j) ? j : []; } catch (e) { }
      const tools = {}, models = {}, folders = {};
      let msgs = 0, calls = 0, allowed = 0, refused = 0, errs = 0, first = 0, last = 0, bytes = 0;
      for (const s of all) {
        if (s && s.at) { first = first ? Math.min(first, s.at) : s.at; last = Math.max(last, s.at); }
        if (s && s.model) models[s.model] = (models[s.model] || 0) + 1;
        if (s && s.dir) { const k = path.basename(String(s.dir)) || String(s.dir); folders[k] = (folders[k] || 0) + 1; }
        for (const e of ((s && s.events) || [])) {
          if (e.kind === 'user') msgs++;
          else if (e.kind === 'tool') { calls++; tools[e.name] = (tools[e.name] || 0) + 1; }
          else if (e.kind === 'answer') { if (e.allow) allowed++; else refused++; }
          else if (e.kind === 'error') errs++;
        }
      }
      try { bytes += fs.statSync(path.join(DATA, 'agent-sessions.json')).size; } catch (e) { }
      try { for (const f of fs.readdirSync(path.join(DATA, 'native'))) { try { bytes += fs.statSync(path.join(DATA, 'native', f)).size; } catch (e) { } } } catch (e) { }
      const top = (o, n) => Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, n || 4).map(([k, v]) => k + ' ' + v).join('   ·   ');
      const when = t => t ? new Date(t).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';
      rows.push({ h: 'everything kept   ·   ' + all.length + ' conversation' + (all.length === 1 ? '' : 's') });
      rows.push({ 0: 'messages', 1: msgs + ' sent   ·   ' + calls + ' tool call' + (calls === 1 ? '' : 's') + '   ·   ' + allowed + ' allowed, ' + refused + ' refused   ·   ' + errs + ' error' + (errs === 1 ? '' : 's') });
      if (calls) rows.push({ 0: 'tools', 1: top(tools) });
      if (Object.keys(models).length) rows.push({ 0: 'models', 1: top(models) });
      if (Object.keys(folders).length) rows.push({ 0: 'folders', 1: top(folders, 3), dim: true });
      rows.push({ 0: 'first', 1: when(first) + '   →   last ' + when(last), dim: true });
      rows.push({ 0: 'kept', 1: mb(bytes) + ' of conversation on disk   ·   ' + MODELS.length + ' model' + (MODELS.length === 1 ? '' : 's') + ' installed' });
      const cv = N.craft.path() ? String(N.craft.run('--version', 8000).text || '').trim() : '';
      rows.push({ h: 'this PC' });
      rows.push({ 0: 'settings', 1: 'theme ' + UI.theme + '   ·   glow ' + UI.animMode + '   ·   scene ' + (UI.scene === 'off' ? 'off' : UI.scene === 'paused' ? 'paused ' + sceneMood() : sceneMood()) + '   ·   thinking ' + (UI.think ? 'shown' : 'hidden') + '   ·   music ' + (MUSIC.on ? 'on' : 'off') });
      rows.push({ 0: 'craft', 1: cv || 'not installed   ·   /craft for how to get it', dim: !cv });
      state.blocks.push({ kind: 'stats', rows });
      return repaint();
    }
    if (cmd === '/ui') {
      note('theme ' + UI.theme + '  ·  animation ' + (UI.anim ? 'on' : 'off') + '  ·  scene ' + (UI.scene === 'off' ? 'off' : UI.scene === 'paused' ? 'paused ' + sceneMood() : sceneMood()) + '  ·  music ' + (MUSIC.on ? musicLabel() : 'off') + '  ·  ' + (Object.keys(UI.colors).length ? Object.keys(UI.colors).map(k => k + ' ' + UI.colors[k]).join('  ') : 'no colours changed by hand'));
      return note('/theme ocean  ·  /color accent #ff8800  ·  /anim off  ·  /scene  ·  /music');
    }
    if (cmd === '/dir') return note(dir);
    err('No such command. /help lists them.');
  }
function submit(line) {
    const t = line.trim();
    if (!t) return;
    if (t.startsWith('/')) { command(t).then(repaint, e => { err(String((e && e.message) || e)); repaint(); }); return; }
    state.chatted = true; state.interrupted = false;
    if (state.busy) { err('Still working. /stop interrupts it.'); repaint(); return; }
    if (!Hn.state(0).running && state.check) {
      Hn.start({ check: state.check, dir, mode: state.mode }).then(st => {
        if (!st || !st.ok) { err((st && st.error) || 'Choose a model first (Tab or /model).'); if (TTY && MODELS.length) openPick(); repaint(); return; }
        const r2 = Hn.send(t);
        if (!r2.ok) err(r2.error);
        repaint();
      }, e => { err(String((e && e.message) || e)); repaint(); });
      return;
    }
    const r = Hn.send(t);
    if (!r.ok) { err(r.error); repaint(); }
    else repaint();
  }
  function answer(yes) {
    if (!state.waiting) return;
    Hn.answer(state.waiting.id, yes);
    state.waiting = null;
    state.interrupted = false;
    repaint();
  }

  /* ------- the keyboard: raw stdin (works on Windows Terminal, ConPTY, Git Bash, WSL, Unix) ------- */
  const DEBUG_INPUT = process.env.MS_DEBUG_INPUT === '1';
  const interactive = TTY && (!!process.stdin.isTTY || process.env.MS_FORCE_TTY === '1');
  if (DEBUG_INPUT) console.error('[moundshroud-code] TTY=%s isTTY=%s FORCE_TTY=%s interactive=%s', TTY, process.stdin.isTTY, process.env.MS_FORCE_TTY, interactive);
  if (interactive) {
    const history = [];
    let hi = -1, draft = '';
    process.stdin.setEncoding('utf8');
    
    // Enable raw mode - this is the key for Windows
    try { process.stdin.setRawMode(true); } catch (e) { if (DEBUG_INPUT) console.error('[moundshroud-code] setRawMode error:', e.message); }
    if (DEBUG_INPUT) console.error('[moundshroud-code] raw mode enabled');
    
    let buffer = '', escWait = null;
    /* An arrow key is three bytes — Escape, [, A — and they can arrive in separate reads. The rest of a sequence is
       waited for, so half of one can never be typed into the message as a stray '[' or letter. A lone Escape is
       still Escape: after a moment with nothing following it, it is taken as the key it is. */
    const loneEscape = () => {
      escWait = null;
      if (buffer !== '\u001b') return;
      buffer = '';
      handleKey('\u001b', { name: 'escape' });
    };
    process.stdin.on('data', (chunk) => {
      if (DEBUG_INPUT) console.error('[moundshroud-code] data event, bytes:', chunk.length, 'chunk:', JSON.stringify(chunk));
      if (escWait) { clearTimeout(escWait); escWait = null; }
      buffer += chunk;
      let i = 0;
      while (i < buffer.length) {
        const ch = buffer[i];
        if (ch === '\u001b') {
          if (i + 1 >= buffer.length) {                  // Escape so far: wait to see whether a sequence follows
            buffer = buffer.slice(i);
            escWait = setTimeout(loneEscape, 40);
            return;
          }
          const next = buffer[i + 1];
          if (next === '\u001b') { handleKey('\u001b', { name: 'escape' }); i += 2; continue; }
          if (next === '[' || next === 'O') {
            let j = i + 2;
            while (j < buffer.length && /[0-9;?<]/.test(buffer[j])) j++;   // '<' starts a mouse report
            if (j >= buffer.length) { buffer = buffer.slice(i); return; }   // the rest has not arrived yet
            const seq = buffer.slice(i, j + 1), key = parseEscape(seq);
            if (key) handleKey('', key);
            i = j + 1;
            continue;
          }
          if (next === 'w' || next === 'W') { handleKey('', { name: 'w', meta: true }); i += 2; continue; }
          i += 2;                                        // other Alt+letter sequences
          continue;
        }
        if (ch === '\u0003') handleKey('\u0003', { name: 'c', ctrl: true });
        else if (ch === '\u0004') handleKey('\u0004', { name: 'd', ctrl: true });
        else if (ch === '\u0009') handleKey('\t', { name: 'tab' });
        else if (ch === '\u000c') handleKey('\u000c', { name: 'l', ctrl: true });
        else if (ch === '\u0010') handleKey('\u0010', { name: 'p', ctrl: true });
        else if (ch === '\u0015') handleKey('\u0015', { name: 'u', ctrl: true });
        else if (ch === '\u0017') handleKey('\u0017', { name: 'w', ctrl: true });
        else if (ch === '\r' || ch === '\n') handleKey(ch, { name: 'return' });
        else if (ch === '\u007f' || ch === '\b') handleKey(ch, { name: 'backspace' });
        else if (ch >= ' ' && ch <= '~') handleKey(ch, { name: undefined, sequence: ch });
        i++;
      }
      buffer = '';
    });
    function parseEscape(seq) {
      // Cursor keys and common sequences
      if (seq === '\u001b[A') return { name: 'up' };
      if (seq === '\u001b[B') return { name: 'down' };
      if (seq === '\u001b[C') return { name: 'right' };
      if (seq === '\u001b[D') return { name: 'left' };
      if (seq === '\u001b[H') return { name: 'home' };
      if (seq === '\u001b[F') return { name: 'end' };
      if (seq === '\u001b[3~') return { name: 'delete' };
      if (seq === '\u001b[1;5A') return { name: 'up', ctrl: true };
      if (seq === '\u001b[1;5B') return { name: 'down', ctrl: true };
      if (seq === '\u001b[1;5C') return { name: 'right', ctrl: true };
      if (seq === '\u001b[1;5D') return { name: 'left', ctrl: true };
      const mo = /^\u001b\[<(\d+);(\d+);(\d+)([Mm])$/.exec(seq);
      if (mo) return { name: 'mouse', b: +mo[1], x: +mo[2], y: +mo[3], up: mo[4] === 'm' };
      if (seq === '\u001b[1;5H') return { name: 'home', ctrl: true };
      if (seq === '\u001b[1;5F') return { name: 'end', ctrl: true };
      if (seq === '\u001b[5~') return { name: 'pageup' };
      if (seq === '\u001b[6~') return { name: 'pagedown' };
      if (seq === '\u001b[Z') return { name: 'tab', shift: true };
      if (seq === '\u001bOQ') return { name: 'f2' };
      if (seq === '\u001b[17~') return { name: 'f6' };
      if (DEBUG_INPUT) console.error('[moundshroud-code] unknown escape:', JSON.stringify(seq));
      return null;
    }
    
    function scrollBy(n) {
      state.scroll = Math.max(0, Math.min(state.maxScroll || 0, (state.scroll || 0) + n));
      return repaint();
    }
    /* SGR mouse: b 64/65 = wheel up/down, b 0 = left press, b 32 = left drag; x and y count from 1 */
    let sbGrab = null;
    function onMouse(k) {
      if (k.b & 64) return scrollBy((k.b & 1) ? -3 : 3);
      const sb = state.sb, W = tui.size().W, row = k.y - (state.trTop || 1);
      if (k.up) { sbGrab = null; return; }
      if (!sb) return;
      const toTop = t => { const first = Math.round(Math.max(0, Math.min(sb.trH - sb.h, t)) / Math.max(1, sb.trH - sb.h) * (sb.total - sb.trH)); state.scroll = sb.total - sb.trH - first; return scrollBy(0); };
      if ((k.b & 32) && sbGrab != null) return toTop(row - sbGrab);
      if ((k.b & 3) !== 0 || k.x < W - 1 || row < 0 || row >= sb.trH) return;
      if (row < sb.top) return scrollBy(Math.max(1, sb.trH - 2));            // the track above the thumb: a page back
      if (row >= sb.top + sb.h) return scrollBy(-Math.max(1, sb.trH - 2));   // below it: a page on
      sbGrab = row - sb.top;                                                   // on the thumb: drag it
    }
    function handleKey(str, key) {
      if (DEBUG_INPUT) console.error('[moundshroud-code] keypress:', JSON.stringify(key), 'str:', JSON.stringify(str));
      if (!key) return;
      /* scrolling the conversation: wheel, scrollbar, PageUp/PageDown, Ctrl+Home/End. The arrow keys never scroll. */
      if (key.name === 'mouse') return onMouse(key);
      if (key.name === 'pageup' || key.name === 'pagedown') return scrollBy((key.name === 'pageup' ? 1 : -1) * Math.max(1, (TR_H || 10) - 2));
      if (key.ctrl && (key.name === 'home' || key.name === 'end')) return scrollBy(key.name === 'home' ? 1e9 : -1e9);
      if (state.waiting) {
        const w = state.waiting;
        if (key.name === 'up' || key.name === 'down' || key.name === 'tab') { w.i = 1 - (w.i || 0); return repaint(); }
        if (key.name === 'left' || key.name === 'right' || key.name === 'home' || key.name === 'end') { w.i = key.name === 'right' || key.name === 'end' ? 1 : 0; return repaint(); }
        if (key.name === 'y') return answer(true);
        if (key.name === 'n') return answer(false);
        if (key.name === 'escape' || (key.ctrl && key.name === 'c')) return answer(false);
        if (key.name === 'return') return answer((w.i || 0) === 0);
        return;
      }
      if (state.menu) {
        const p = state.menu, n = p.items.length;
        if (key.name === 'up') { p.i = (p.i - 1 + n) % n; return repaint(); }
        if (key.name === 'down') { p.i = (p.i + 1) % n; return repaint(); }
        if (key.name === 'home') { p.i = 0; return repaint(); }
        if (key.name === 'end') { p.i = n - 1; return repaint(); }
        if (key.name === 'escape' || (key.ctrl && key.name === 'c')) { state.menu = null; return repaint(); }
        if (key.name === 'return') {
          const it = p.items[Math.max(0, Math.min(n - 1, p.i))];
          state.menu = null;
          if (it && it.go) { const r = it.go(); return r && r.then ? r.then(repaint, repaint) : repaint(); }
          return repaint();
        }
        if (str && !key.ctrl && !key.meta) state.menu = null;
        else return repaint();
      }
      if (state.pick) {
        const n = MODELS.length, p = state.pick;
        if (!n) { state.pick = null; return repaint(); }
        if (key.name === 'up') { p.i = (p.i - 1 + n) % n; return repaint(); }
        if (key.name === 'down') { p.i = (p.i + 1) % n; return repaint(); }
        if (key.name === 'home') { p.i = 0; return repaint(); }
        if (key.name === 'end') { p.i = n - 1; return repaint(); }
        if (key.name === 'escape' || key.name === 'tab' || (key.ctrl && key.name === 'c')) { state.pick = null; return repaint(); }
        if (key.name === 'return') {
          const m = MODELS[Math.max(0, Math.min(n - 1, p.i))];
          state.pick = null;
          return m ? switchModel(m.name) : repaint();
        }
        if (str && !key.ctrl && !key.meta) state.pick = null;
        else return repaint();
      }
      if ((key.ctrl && key.name === 'p') || key.name === 'f2' || (key.name === 'tab' && !state.input)) {
        if (!MODELS.length) {
          refreshModels().then(() => { if (MODELS.length) openPick(); else { err('Ollama is not running, so there is no list to choose from.'); repaint(); } }).catch(() => { });
          return;
        }
        return openPick();
      }
      if ((key.meta && key.name === 'w') || key.name === 'f6') {
        crackWhip('');
        return repaint();
      }
      if (key.ctrl && key.name === 'c') {
        if (state.busy && !state.interrupted) {
          state.interrupted = true;
          state.doing = { what: 'interrupted' };
          try { (Hn.halt || Hn.stop).call(Hn); } catch (e) { }   // the brakes, not the door: the session stays
          return repaint();
        }
        if (state.input) { state.input = ''; state.cursor = 0; state.interrupted = false; return repaint(); }
        return quit();
      }
      if (key.ctrl && key.name === 'd') return quit();
      if (key.ctrl && key.name === 'l') { process.stdout.write('\u001b[2J'); return repaint(); }
      if (key.ctrl && key.name === 'u') { state.input = ''; state.cursor = 0; return repaint(); }
      if (key.ctrl && key.name === 'w') {
        const a = [...state.input];
        let i = state.cursor;
        while (i > 0 && a[i - 1] === ' ') i--;
        while (i > 0 && a[i - 1] !== ' ') i--;
        a.splice(i, state.cursor - i); state.input = a.join(''); state.cursor = i; return repaint();
      }
      if (key.name === 'return') {
        const line = state.input;
        if (!line.trim()) return repaint();
        history.push(line); hi = -1; draft = '';
        state.input = ''; state.cursor = 0; state.scroll = 0;   // sending jumps back to the newest words
        return submit(line);
      }
      if (key.name === 'backspace') {
        const a = [...state.input];
        if (state.cursor > 0) { a.splice(state.cursor - 1, 1); state.input = a.join(''); state.cursor--; }
        return repaint();
      }
      if (key.name === 'delete') {
        const a = [...state.input];
        if (state.cursor < a.length) { a.splice(state.cursor, 1); state.input = a.join(''); }
        return repaint();
      }
      if (key.name === 'left') { if (state.cursor > 0) { state.cursor--; } return repaint(); }
      if (key.name === 'right') { if (state.cursor < state.input.length) { state.cursor++; } return repaint(); }
      if (key.name === 'home') { state.cursor = 0; return repaint(); }
      if (key.name === 'end') { state.cursor = state.input.length; return repaint(); }
      /* Up and Down walk the messages sent before, like a shell; Down past the newest gives back what was being typed */
      if (key.name === 'up') {
        if (hi < history.length - 1) { if (hi === -1) draft = state.input; hi++; state.input = history[history.length - 1 - hi]; state.cursor = state.input.length; }
        return repaint();
      }
      if (key.name === 'down') {
        if (hi > 0) { hi--; state.input = history[history.length - 1 - hi]; state.cursor = state.input.length; }
        else if (hi === 0) { hi = -1; state.input = draft; state.cursor = draft.length; }
        return repaint();
      }
      if (key.name === 'escape') { state.input = ''; state.cursor = 0; return repaint(); }
      if (str && !key.ctrl && !key.meta) {
        state.input = state.input.slice(0, state.cursor) + str + state.input.slice(state.cursor);
        state.cursor += str.length;
        return repaint();
      }
    }
    
    process.stdin.resume();
    process.stdout.on('resize', () => { try { tui.draw(); } catch (e) { } });
  } else {
    /* piped input (scripts, tests): one line in, one answer out */
    stdinLive = readline.createInterface({ input: process.stdin });
    stdinLive.on('line', l => {
      const t = l.trim();
      if (!t) return;
      if (state.waiting) { answer(/^y(es)?$/i.test(t)); return; }
      submit(t);
    });
    stdinLive.on('close', () => quit());            // the input ended: nothing is left to wait for
  }
  process.on('exit', () => { if (TTY) { try { process.stdout.write(MOUSE_OFF + '\u001b[?25h\u001b[?1049l'); } catch (e) { } } });
  const onSignal = () => {
    if (quitting) return;
    if (state.busy) {
      if (state.interrupted) { quit(); return; }
      state.interrupted = true;
      state.doing = { what: 'interrupted' };
      try { (Hn.halt || Hn.stop).call(Hn); } catch (e) { }
      repaint();
      return;
    }
    quit();
  };
  try { process.on('SIGINT', onSignal); process.on('SIGTERM', onSignal); } catch (e) { }
  repaint();
})().catch(e => {
  if (TTY) process.stdout.write(MOUSE_OFF + '\u001b[?25h\u001b[?1049l');
  plainSay('  ' + NAME + ' could not start: ' + ((e && e.message) || e));
  process.exitCode = 1;
});

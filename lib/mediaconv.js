// Converter, server side: sound, video, pictures the browser cannot open, archives and songs to MIDI.
//  sound and video : ffmpeg (songtools\ffmpeg.exe, put there by install-song-tools.ps1; any other ffmpeg is a fallback)
//  song to MIDI    : basic-pitch (Spotify's open note finder) in songtools\venv, after ffmpeg turns the song into a WAV
//  archives        : Windows' own tar.exe (libarchive) reads ZIP, 7z, RAR, TAR, GZ, BZ2, XZ, CAB and ISO
// Uploads stream to data\tmp, results are saved in Moundshroud Documents next to the LibreOffice results.
const fs = require('fs'), path = require('path'), cp = require('child_process');
const office = require('./office');
const ROOT = path.join(__dirname, '..'), TMP = path.join(ROOT, 'data', 'tmp'), OUT = office.OUT, ST = path.join(ROOT, 'songtools');
const VPY = path.join(ST, 'venv', 'Scripts', 'python.exe'), BP = path.join(ST, 'venv', 'Scripts', 'basic-pitch.exe');
const TAR = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'tar.exe');
const has = p => { try { return fs.existsSync(p); } catch (e) { return false; } };
const rm = p => { try { fs.rmSync(p, { recursive: true, force: true }); } catch (e) { } };
const safe = s => String(s || 'file').replace(/[\\/:*?"<>|\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80) || 'file';
function uniq(dir, stem, ext) { let p = path.join(dir, stem + ext), n = 2; while (has(p)) p = path.join(dir, stem + ' (' + n++ + ')' + ext); return p; }

/* the newest ffmpeg we can find: our own copy first, then the one inside the songtools venv, then the picture engine's, then PATH */
let ffc = null;
function ffmpeg() {
  if (ffc !== null && (ffc === '' || has(ffc))) return ffc;
  const own = path.join(ST, 'ffmpeg.exe'); if (has(own)) return (ffc = own);
  try { const bin = path.join(ST, 'venv', 'Lib', 'site-packages', 'imageio_ffmpeg', 'binaries'); const f = fs.readdirSync(bin).find(x => /^ffmpeg.*\.exe$/i.test(x)); if (f) return (ffc = path.join(bin, f)); } catch (e) { }
  const img = path.join(ROOT, 'imggen', 'bin', 'ffmpeg.exe'); if (has(img)) return (ffc = img);
  try { const out = cp.execFileSync('where', ['ffmpeg'], { encoding: 'utf8', windowsHide: true, timeout: 5000 }).split(/\r?\n/).map(s => s.trim()).filter(Boolean); return (ffc = out[0] || ''); } catch (e) { return (ffc = ''); }
}
const status = () => ({ ffmpeg: !!ffmpeg(), midi: has(BP) || has(VPY) && has(path.join(ST, 'venv', 'Lib', 'site-packages', 'basic_pitch')), archive: has(TAR), out: OUT });

function run(exe, args, ms, cwd) {
  return new Promise(res => { const p = cp.execFile(exe, args, { timeout: ms, windowsHide: true, maxBuffer: 64e6, cwd }, (e, out, err) => res({ ok: !e, out: String(out || ''), err: String(err || (e && e.message) || '') })); p.on('error', () => { }); });
}
const lastLine = s => (String(s).trim().split(/\r?\n/).filter(l => l.trim()).slice(-2).join(' ') || 'unknown error').slice(0, 300);

/* what each target means for ffmpeg; the input can be any sound or video ffmpeg understands */
const A = ['-vn'];
const FF = {
  mp3: [...A, '-c:a', 'libmp3lame', '-q:a', '2'], wav: [...A, '-c:a', 'pcm_s16le'], ogg: [...A, '-c:a', 'libvorbis', '-q:a', '5'], opus: [...A, '-c:a', 'libopus', '-b:a', '128k'],
  flac: [...A, '-c:a', 'flac'], m4a: [...A, '-c:a', 'aac', '-b:a', '192k'], aiff: [...A, '-c:a', 'pcm_s16be'], wma: [...A, '-c:a', 'wmav2', '-b:a', '160k'],
  mp4: ['-c:v', 'libx264', '-preset', 'veryfast', '-crf', '22', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart'],
  mkv: ['-c:v', 'libx264', '-preset', 'veryfast', '-crf', '22', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '160k'],
  mov: ['-c:v', 'libx264', '-preset', 'veryfast', '-crf', '22', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '160k'],
  webm: ['-c:v', 'libvpx-vp9', '-deadline', 'realtime', '-cpu-used', '8', '-crf', '32', '-b:v', '0', '-c:a', 'libopus', '-b:a', '128k'],
  avi: ['-c:v', 'mpeg4', '-q:v', '4', '-c:a', 'libmp3lame', '-q:a', '3'],
  gif: ['-vf', 'fps=12,scale=\'min(560,iw)\':-2:flags=lanczos,split[a][b];[a]palettegen=max_colors=128[p];[b][p]paletteuse=dither=bayer', '-an'],
  png: ['-frames:v', '1'], jpg: ['-frames:v', '1', '-q:v', '2'],
};
const MS = { gif: 600000, webm: 3600000, mp4: 3600000, mkv: 3600000, mov: 3600000, avi: 3600000 };

async function ffConvert(src, stem, to, opt) {
  const ff = ffmpeg(); if (!ff) return { error: 'ffmpeg is missing. Run install-song-tools.ps1 in the Moundshroud folder.' };
  if (!FF[to]) return { error: 'Unknown target: ' + to };
  fs.mkdirSync(OUT, { recursive: true }); const dest = uniq(OUT, stem, '.' + to), args = ['-hide_banner', '-nostdin', '-y'];
  if (opt.start) args.push('-ss', String(+opt.start || 0));
  args.push('-i', src);
  if (opt.dur) args.push('-t', String(+opt.dur));
  args.push(...FF[to]);
  if (opt.rate && FF[to].includes('-vn')) args.push('-ar', String(+opt.rate));
  if (opt.mono && FF[to].includes('-vn')) args.push('-ac', '1');
  if (opt.height && !FF[to].includes('-vn') && to !== 'gif') args.push('-vf', 'scale=-2:' + (+opt.height));
  args.push(dest);
  const r = await run(ff, args, MS[to] || 1800000);
  if (!r.ok || !has(dest) || fs.statSync(dest).size === 0) { rm(dest); return { error: 'ffmpeg could not convert it: ' + lastLine(r.err) }; }
  return { path: dest, name: path.basename(dest) };
}

/* a song to MIDI: ffmpeg makes a mono 22 kHz WAV, basic-pitch writes the notes it hears (chords and several instruments at once) */
async function toMidi(src, stem) {
  const s = status(); if (!s.midi) return { error: 'The song-to-MIDI tool is not installed. Run install-song-tools.ps1 in the Moundshroud folder.' };
  const ff = ffmpeg(); if (!ff) return { error: 'ffmpeg is missing. Run install-song-tools.ps1 in the Moundshroud folder.' };
  const work = path.join(TMP, 'bp' + Date.now()); fs.mkdirSync(work, { recursive: true });
  try {
    const wav = path.join(work, 'song.wav'); const a = await run(ff, ['-hide_banner', '-nostdin', '-y', '-i', src, '-vn', '-ac', '1', '-ar', '22050', '-t', '900', wav], 600000);
    if (!a.ok || !has(wav)) return { error: 'This file has no sound ffmpeg can read: ' + lastLine(a.err) };
    const outDir = path.join(work, 'out'); fs.mkdirSync(outDir);
    const env = Object.assign({}, process.env, { PATH: path.dirname(ff) + ';' + process.env.PATH, TF_CPP_MIN_LOG_LEVEL: '3', PYTHONIOENCODING: 'utf-8' });
    const r = await new Promise(res => { const p = cp.execFile(has(BP) ? BP : VPY, has(BP) ? [outDir, wav] : ['-m', 'basic_pitch.predict', outDir, wav], { timeout: 1800000, windowsHide: true, maxBuffer: 64e6, env }, (e, out, err) => res({ ok: !e, err: String(err || (e && e.message) || '') })); p.on('error', () => { }); });
    const mid = fs.readdirSync(outDir).find(f => /\.mid$/i.test(f));
    if (!mid) return { error: 'basic-pitch could not finish: ' + lastLine(r.err) };
    fs.mkdirSync(OUT, { recursive: true }); const dest = uniq(OUT, stem, '.mid'); fs.copyFileSync(path.join(outDir, mid), dest);
    return { path: dest, name: path.basename(dest), note: 'Notes found by basic-pitch. A full band comes out as one piano-style part; open it in Studio › Composer to tidy it up.' };
  } finally { rm(work); }
}

/* archives: extract into a folder, or repack as ZIP / 7z / TAR.GZ */
async function archive(src, stem, to) {
  if (!has(TAR)) return { error: 'Windows tar.exe was not found.' };
  fs.mkdirSync(OUT, { recursive: true }); const work = path.join(TMP, 'ar' + Date.now()), dir = to === 'extract' ? uniq(OUT, stem, '') : path.join(work, 'x');
  fs.mkdirSync(dir, { recursive: true });
  try {
    const x = await run(TAR, ['-xf', src, '-C', dir], 1800000);
    if (!x.ok) { if (to === 'extract') rm(dir); return { error: 'This archive could not be opened: ' + lastLine(x.err) }; }
    if (to === 'extract') { let n = 0; const walk = d => fs.readdirSync(d, { withFileTypes: true }).forEach(e => e.isDirectory() ? walk(path.join(d, e.name)) : n++); walk(dir); return { path: dir, name: path.basename(dir), note: n + ' file' + (n === 1 ? '' : 's') + ' extracted', folder: true }; }
    const ext = { zip: '.zip', '7z': '.7z', tgz: '.tar.gz' }[to]; if (!ext) return { error: 'Unknown archive type: ' + to };
    const dest = uniq(OUT, stem, ext), r = await run(TAR, to === '7z' ? ['--format', '7zip', '-cf', dest, '.'] : ['-a', '-cf', dest, '.'], 1800000, dir);
    if (!r.ok || !has(dest)) { rm(dest); return { error: 'Could not make the archive: ' + lastLine(r.err) }; }
    return { path: dest, name: path.basename(dest) };
  } finally { rm(work); }
}

/* the upload is streamed to a file, so even a large video does not sit in memory */
function saveUpload(req, file, limit) {
  return new Promise((res, rej) => { let n = 0; const w = fs.createWriteStream(file); req.on('data', c => { n += c.length; if (n > limit) { rej(new Error('That file is larger than ' + Math.round(limit / 1e9) + ' GB.')); req.destroy(); w.destroy(); } }); req.pipe(w); w.on('finish', () => res(n)); w.on('error', rej); req.on('error', rej); });
}
async function convertUpload(req, q) {
  const name = String(q.get('name') || 'file'), to = String(q.get('to') || '').toLowerCase(), ext = (path.extname(name).replace(/[^.\w]/g, '') || '.bin').toLowerCase(), stem = safe(path.basename(name, path.extname(name)));
  fs.mkdirSync(TMP, { recursive: true }); const src = path.join(TMP, 'up' + Date.now() + Math.random().toString(36).slice(2, 6) + ext);
  try {
    await saveUpload(req, src, 8e9);
    const opt = { start: q.get('start'), dur: q.get('dur'), rate: q.get('rate'), mono: q.get('mono') === '1', height: q.get('height') };
    if (to === 'mid') return await toMidi(src, stem);
    if (['extract', 'zip', '7z', 'tgz'].includes(to)) return await archive(src, stem, to);
    return await ffConvert(src, stem, to, opt);
  } catch (e) { return { error: String(e.message || e) }; }
  finally { rm(src); }
}
/* hand a finished result back to the page (only files inside Moundshroud Documents) */
function resultFile(p) {
  const f = path.resolve(String(p || '')), base = path.resolve(OUT) + path.sep;
  if (!f.startsWith(base) || !has(f) || !fs.statSync(f).isFile()) return null; return f;
}
module.exports = { status, convertUpload, resultFile, ffmpeg };

// TV > YouTube > ⬇ Download: saves a YouTube video with the user's own yt-dlp (found on this PC, see TOOL_PLACES) and
// the songtools ffmpeg, into Videos\Moundshroud Downloads\<folder>. Four ways: the whole video as one file, picture and
// sound as two separate files, the sound only (MP3), or the picture only. The list of downloads, their folders and
// names live in data/ytdl.json; the files themselves stay in the Videos folder and play in the TV tab.
// Only YouTube video ids are ever passed to yt-dlp (never a free-form address or option), and nothing runs while
// internet access is off.
const fs = require('fs'), path = require('path'), os = require('os'), cp = require('child_process'), crypto = require('crypto');
const net = require('./net');

const HOME = process.env.MOUNDSHROUD_DL_DIR || path.join(os.homedir(), 'Videos', 'Moundshroud Downloads');
const DATA = path.join(__dirname, '..', 'data'), FILE = path.join(DATA, 'ytdl.json');
const VID = /^[A-Za-z0-9_-]{11}$/, IID = /^d[0-9a-z]{6,12}-[0-9a-f]{6}$/, FID = /^f[0-9a-z]{6,12}$/;
const clean = s => String(s == null ? '' : s).replace(/[\u0000-\u001f\u007f<>:"/\\|?*]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120);
const OFF = 'Internet access is switched off. Downloading needs the internet.';

/* ---------- the tool ---------- */
const TOOL_PLACES = () => [path.join(__dirname, '..', 'engines', 'yt-dlp', 'yt-dlp.exe'), path.join(os.homedir(), 'OneDrive', 'Desktop', 'Video Downloads', 'yt-dlp.exe'), path.join(os.homedir(), 'Desktop', 'Video Downloads', 'yt-dlp.exe'), path.join(os.homedir(), 'Desktop', 'yt-dlp.exe'), path.join(os.homedir(), 'OneDrive', 'Desktop', 'yt-dlp.exe'), path.join(os.homedir(), 'Downloads', 'yt-dlp.exe')];
let toolCache = null;
function tool() {
  if (toolCache && fs.existsSync(toolCache.path)) return toolCache;
  const d = read(); const tries = [d.tool].concat(TOOL_PLACES()).filter(Boolean);
  try { tries.push(...cp.execFileSync('where', ['yt-dlp'], { encoding: 'utf8', windowsHide: true, timeout: 5000 }).split(/\r?\n/).map(s => s.trim()).filter(Boolean)); } catch (e) { }
  for (const p of tries) { try { if (fs.statSync(p).isFile() && /^yt-dlp[\w.-]*\.exe$/i.test(path.basename(p))) { let v = ''; try { v = cp.execFileSync(p, ['--version'], { encoding: 'utf8', windowsHide: true, timeout: 20000 }).trim(); } catch (e) { } return (toolCache = { path: p, version: v }); } } catch (e) { } }
  return (toolCache = null);
}
const ffmpeg = () => { try { return require('./mediaconv').ffmpeg() || ''; } catch (e) { return ''; } };

/* ---------- the list ---------- */
function read() { try { const j = JSON.parse(fs.readFileSync(FILE, 'utf8')); return { tool: j.tool || '', folders: Array.isArray(j.folders) ? j.folders : [], items: Array.isArray(j.items) ? j.items : [] }; } catch (e) { return { tool: '', folders: [], items: [] }; } }
function write(d) { fs.mkdirSync(DATA, { recursive: true }); const tmp = FILE + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(d)); fs.renameSync(tmp, FILE); }
const sz = f => { try { return fs.statSync(f).size; } catch (e) { return 0; } };
const inHome = p => { const r = path.relative(HOME, path.resolve(p)); return !!r && !r.startsWith('..') && !path.isAbsolute(r); };
function status() {
  const d = read(), t = tool();
  const items = d.items.map(it => Object.assign({}, it, { files: (it.files || []).map((f, n) => ({ n, name: path.basename(f.path), kind: f.kind, size: sz(f.path), there: sz(f.path) > 0 })) }));
  return { tool: t ? { found: true, version: t.version, where: t.path } : { found: false, places: TOOL_PLACES() }, ffmpeg: !!ffmpeg(), home: HOME, internet: net.on(), folders: d.folders, items, jobs: [...JOBS.values()].map(pubJob) };
}

/* ---------- downloading ---------- */
const JOBS = new Map();
const pubJob = j => ({ id: j.id, vid: j.vid, title: j.title, kind: j.kind, state: j.state, pct: j.pct, speed: j.speed, eta: j.eta, error: j.error || '', item: j.item || '' });
/* the formats: prefer H.264 picture and AAC sound so every file plays in the TV tab */
const FORMATS = {
  both: { f: 'bv*[vcodec^=avc1]+ba[acodec^=mp4a]/bv*+ba/b', extra: ['--merge-output-format', 'mp4'], label: 'Whole video' },
  split: { f: 'bv*[vcodec^=avc1]/bv*,ba[acodec^=mp4a]/ba', extra: [], label: 'Picture and sound separately' },
  audio: { f: 'ba[acodec^=mp4a]/ba', extra: ['-x', '--audio-format', 'mp3', '--audio-quality', '0'], label: 'Sound only (MP3)' },
  video: { f: 'bv*[vcodec^=avc1]/bv*', extra: [], label: 'Picture only (no sound)' }
};
function args(vid, kind, dir, ff) {
  const F = FORMATS[kind];
  /* yt-dlp needs a JavaScript runtime for YouTube; the Node.js running Moundshroud is one */
  return ['--no-playlist', '--no-mtime', '--newline', '--progress', '--no-simulate', '--windows-filenames', '--ignore-config', '--js-runtimes', 'node:' + process.execPath,
    '--print', 'after_move:filepath', '--progress-template', 'download:@@%(progress._percent_str)s|%(progress._speed_str)s|%(progress._eta_str)s',
    '-f', F.f].concat(F.extra, ff ? ['--ffmpeg-location', ff] : [], ['-P', dir, '-o', kind === 'split' ? '%(title).100B [%(id)s] %(format_note)s.%(ext)s' : '%(title).110B [%(id)s].%(ext)s', '--', 'https://www.youtube.com/watch?v=' + vid]);
}
function start(b) {
  b = b || {};
  if (!net.on()) return { error: OFF };
  const vid = String(b.vid || ''); if (!VID.test(vid)) return { error: 'That is not a YouTube video.' };
  const kind = FORMATS[b.kind] ? b.kind : 'both', t = tool(); if (!t) return { error: 'yt-dlp was not found on this PC.' };
  const ff = ffmpeg(); if (!ff && kind !== 'video') return { error: 'ffmpeg is needed to join or convert the files. Run install-song-tools.ps1 once.' };
  const d = read(), folder = FID.test(String(b.folder || '')) && d.folders.some(f => f.id === b.folder) ? b.folder : '';
  const fname = folder ? clean(d.folders.find(f => f.id === folder).name) || 'Folder' : '';
  const dir = folder ? path.join(HOME, fname) : HOME; fs.mkdirSync(dir, { recursive: true });
  for (const j of JOBS.values()) if (j.vid === vid && j.kind === kind && j.state === 'running') return { error: 'That download is already running.' };
  const id = 'j' + Date.now().toString(36);
  const job = { id, vid, kind, folder, title: clean(b.title) || vid, channel: clean(b.channel).slice(0, 80), state: 'running', pct: 0, speed: '', eta: '', out: [], log: '' };
  JOBS.set(id, job);
  let child; try { child = cp.spawn(t.path, args(vid, kind, dir, ff), { windowsHide: true, cwd: dir }); } catch (e) { job.state = 'failed'; job.error = 'yt-dlp could not start.'; return { ok: true, job: pubJob(job) }; }
  job.child = child; let buf = '';
  const line = l => {
    l = l.trim(); if (!l) return;
    const m = /@@\s*([\d.]+)%\|([^|]*)\|(.*)$/.exec(l); if (m) { job.pct = Math.min(100, +m[1] || 0); job.speed = m[2].trim(); job.eta = m[3].trim(); return; }
    if (/^[A-Za-z]:\\/.test(l) && fs.existsSync(l)) { job.out.push(l); return; }
    if (job.log.length < 6000) job.log += l + '\n';
  };
  child.stdout.on('data', c => { buf += c; let i; while ((i = buf.indexOf('\n')) >= 0) { line(buf.slice(0, i)); buf = buf.slice(i + 1); } });
  child.stderr.on('data', c => { if (job.log.length < 6000) job.log += String(c); });
  child.on('close', code => {
    line(buf); job.child = null;
    if (job.state === 'cancelled') return setTimeout(() => JOBS.delete(id), 30000);
    if (code !== 0 || !job.out.length) { job.state = 'failed'; const e = job.log; job.error = /Sign in to confirm|age/i.test(e) ? 'YouTube asks for a signed-in account for this video, so it cannot be downloaded here.' : /Private video|unavailable|removed/i.test(e) ? 'This video is private or no longer available.' : /HTTP Error 403/.test(e) ? 'YouTube refused the download. Updating yt-dlp (yt-dlp -U) usually fixes this.' : (e.split('\n').filter(x => /ERROR/.test(x)).pop() || 'The download did not finish.').replace(/^ERROR:\s*/, '').slice(0, 220); return setTimeout(() => JOBS.delete(id), 600000); }
    const d2 = read(), iid = 'd' + Date.now().toString(36) + '-' + crypto.randomBytes(3).toString('hex');
    /* what each file is: one whole video, a picture-only file, or a sound-only file */
    const isSound = p => /\.(m4a|mp3|opus|ogg|aac)$/i.test(p) || /audio only/i.test(path.basename(p));
    const files = job.out.filter(inHome).map(p => ({ path: p, kind: kind === 'both' ? 'video' : kind === 'audio' ? 'audio' : kind === 'video' ? 'picture' : isSound(p) ? 'audio' : 'picture' }));
    d2.items.unshift({ id: iid, vid, title: job.title, channel: job.channel, kind, label: FORMATS[kind].label, folder: job.folder, at: Date.now(), files });
    write(d2); job.state = 'done'; job.pct = 100; job.item = iid; setTimeout(() => JOBS.delete(id), 60000);
  });
  child.on('error', () => { job.state = 'failed'; job.error = 'yt-dlp could not start.'; });
  return { ok: true, job: pubJob(job) };
}
function cancel(id) { const j = JOBS.get(String(id)); if (!j || j.state !== 'running') return { error: 'That download is not running.' }; j.state = 'cancelled'; try { cp.execFileSync('taskkill', ['/pid', String(j.child.pid), '/T', '/F'], { windowsHide: true, timeout: 8000 }); } catch (e) { try { j.child.kill(); } catch (x) { } } return status(); }

/* ---------- sorting ---------- */
function folder(b) {
  b = b || {}; const d = read();
  if (b.remove) { const id = String(b.remove); d.folders = d.folders.filter(f => f.id !== id); d.items.forEach(it => { if (it.folder === id) it.folder = ''; }); write(d); return status(); }
  const name = clean(b.name).slice(0, 60); if (!name) return { error: 'Type a folder name.' };
  if (b.rename) { const f = d.folders.find(x => x.id === String(b.rename)); if (!f) return { error: 'That folder is gone.' }; f.name = name; write(d); return status(); }
  const id = 'f' + Date.now().toString(36); d.folders.push({ id, name }); write(d); return Object.assign(status(), { created: id });
}
/* moving an item moves its files into that folder's own folder on disk, so the Videos folder is sorted the same way */
function move(id, to) {
  const d = read(), it = d.items.find(x => x.id === String(id)); if (!it) return { error: 'That download is gone.' };
  to = String(to || ''); const f = to ? d.folders.find(x => x.id === to) : null; if (to && !f) return { error: 'That folder is gone.' };
  const dir = f ? path.join(HOME, clean(f.name) || 'Folder') : HOME; fs.mkdirSync(dir, { recursive: true });
  for (const x of it.files || []) { if (!inHome(x.path) || !fs.existsSync(x.path)) continue; let dest = path.join(dir, path.basename(x.path)); if (dest === x.path) continue; if (fs.existsSync(dest)) dest = path.join(dir, path.parse(x.path).name + ' (' + Date.now().toString(36) + ')' + path.extname(x.path)); try { fs.renameSync(x.path, dest); x.path = dest; } catch (e) { } }
  it.folder = to; write(d); return status();
}
function rename(id, title) { const d = read(), it = d.items.find(x => x.id === String(id)); title = clean(title); if (!it || !title) return { error: 'Type a name.' }; it.title = title; write(d); return status(); }
function remove(id) {
  const d = read(), it = d.items.find(x => x.id === String(id)); if (!it) return { error: 'That download is gone.' };
  for (const x of it.files || []) if (inHome(x.path)) { try { fs.unlinkSync(x.path); } catch (e) { } }
  d.items = d.items.filter(x => x !== it); write(d); return status();
}

/* ---------- playing a downloaded file (with seeking) ---------- */
const TYPES = { '.mp4': 'video/mp4', '.m4v': 'video/mp4', '.webm': 'video/webm', '.mkv': 'video/x-matroska', '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.opus': 'audio/ogg', '.ogg': 'audio/ogg' };
function send(id, n, dl, req, res) {
  const it = read().items.find(x => x.id === String(id)), f = it && (it.files || [])[+n || 0];
  if (!f || !inHome(f.path) || !sz(f.path)) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('That file is not there any more.'); }
  const size = sz(f.path), type = dl ? 'application/octet-stream' : (TYPES[path.extname(f.path).toLowerCase()] || 'application/octet-stream');
  const h = { 'Content-Type': type, 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-store', 'Content-Disposition': (dl ? 'attachment' : 'inline') + "; filename*=UTF-8''" + encodeURIComponent(path.basename(f.path)) };
  const m = /^bytes=(\d*)-(\d*)$/.exec(String(req.headers.range || ''));
  if (m) { let a = m[1] === '' ? size - (+m[2]) : +m[1], b = m[1] !== '' && m[2] !== '' ? +m[2] : size - 1; a = Math.max(0, a); b = Math.min(size - 1, b); if (a > b) { res.writeHead(416, { 'Content-Range': 'bytes */' + size }); return res.end(); } res.writeHead(206, Object.assign(h, { 'Content-Range': 'bytes ' + a + '-' + b + '/' + size, 'Content-Length': b - a + 1 })); return fs.createReadStream(f.path, { start: a, end: b }).pipe(res); }
  res.writeHead(200, Object.assign(h, { 'Content-Length': size })); fs.createReadStream(f.path).pipe(res);
}

module.exports = { status, start, cancel, folder, move, rename, remove, send, args, FORMATS, HOME, VID, inHome, tool };

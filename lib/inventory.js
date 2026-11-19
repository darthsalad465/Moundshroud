// Everything Moundshroud has downloaded, in one list (Prepare > Stock up): what it is, where it is, how big it is,
// what it is for, what stops working without it, and whether it can be downloaded again from here. Anything on the
// list can be removed; the page asks first and says exactly what will be lost.
//
// Safety: the page only ever names an item by its id (like "zim:wikipedia_en_all.zim" or "voice:en_US-amy-medium");
// this file works out the path itself, from the folders it knows, so no request can delete anything else.
const fs = require('fs'), path = require('path'), https = require('https'), http = require('http'), cp = require('child_process'), os = require('os');
const kiwix = require('./kiwix'), voice = require('./voice'), prep = require('./prep');

const ROOT = path.join(__dirname, '..');
const P = {
  lib: path.join(ROOT, 'nomad', 'library'), voices: path.join(ROOT, 'piper', 'voices'), whisper: path.join(ROOT, 'voice', 'ggml-base.en.bin'),
  stockfish: path.join(ROOT, 'engines', 'stockfish'), imggen: path.join(ROOT, 'imggen'), musicgen: path.join(ROOT, 'musicgen'), music: path.join(ROOT, 'web', 'music'),
  chessbooks: path.join(ROOT, 'nomad', 'chessbooks'), cyberchef: path.join(ROOT, 'nomad', 'cyberchef'), kiwixTools: path.join(ROOT, 'nomad', 'kiwix-tools'),
  christian: path.join(ROOT, 'data', 'christian-texts'), bibleIndex: path.join(ROOT, 'data', 'bible-index.db'), data: path.join(ROOT, 'data'), removed: path.join(ROOT, 'data', 'removed'), tor: path.join(ROOT, 'tor-browser')
};
const OLLAMA = { host: '127.0.0.1', port: 11434 };
const exists = p => { try { return fs.existsSync(p); } catch (e) { return false; } };
/* folder sizes are remembered for ten minutes (the picture and music makers hold thousands of files); any change clears them */
const SIZES = new Map();
function sizeOf(p) {
  const hit = SIZES.get(p); if (hit && Date.now() - hit.at < 600000) return hit.v;
  const v = sizeWalk(p); SIZES.set(p, { at: Date.now(), v }); return v;
}
function sizeWalk(p) {
  let t = 0; const st = [p];
  while (st.length) { const d = st.pop(); let s; try { s = fs.statSync(d); } catch (e) { continue; } if (s.isFile()) { t += s.size; continue; } let ents; try { ents = fs.readdirSync(d); } catch (e) { continue; } ents.forEach(n => st.push(path.join(d, n))); }
  return t;
}
const MB = b => Math.round(b / 1048576);

/* ---------- small helpers for the downloads that do not go through Windows' background transfer ---------- */
const jobs = {};       // id -> { status, pct, error }
function download(url, dest, job, depth) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https:') ? https : http;
    const rq = mod.get(url, { headers: { 'user-agent': 'Mozilla/5.0 (compatible; Moundshroud stock up)' }, timeout: 30000 }, r => {
      if (r.statusCode >= 300 && r.statusCode < 400 && r.headers.location && (depth || 0) < 6) { r.resume(); return download(new URL(r.headers.location, url).href, dest, job, (depth || 0) + 1).then(resolve, reject); }
      if (r.statusCode !== 200) { r.resume(); return reject(new Error('the server answered ' + r.statusCode)); }
      const total = +r.headers['content-length'] || 0; let got = 0;
      const tmp = dest + '.part'; fs.mkdirSync(path.dirname(dest), { recursive: true }); const out = fs.createWriteStream(tmp);
      r.on('data', c => { got += c.length; if (job && total) job.pct = Math.round(got / total * 100); });
      r.pipe(out);
      out.on('finish', () => { out.close(() => { try { fs.renameSync(tmp, dest); resolve(got); } catch (e) { reject(e); } }); });
      r.on('error', e => { try { fs.unlinkSync(tmp); } catch (x) { } reject(e); });
    });
    rq.on('timeout', () => rq.destroy(new Error('timed out')));
    rq.on('error', reject);
  });
}
const getJson = url => new Promise((res, rej) => { const go = (u, d) => https.get(u, { headers: { 'user-agent': 'Mozilla/5.0 (compatible; Moundshroud stock up)', accept: 'application/json' } }, r => { if (r.statusCode >= 300 && r.statusCode < 400 && r.headers.location && d < 6) { r.resume(); return go(new URL(r.headers.location, u).href, d + 1); } let s = ''; r.on('data', c => s += c); r.on('end', () => { try { res(JSON.parse(s)); } catch (e) { rej(new Error('not JSON')); } }); }).on('error', rej); go(url, 0); });
function ps(cmd, ms) { return new Promise(res => cp.execFile('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', cmd], { windowsHide: true, timeout: ms || 120000 }, (e, out) => res(String(out || '')))); }
function ollama(method, pth, body) {
  return new Promise(res => { const p = body ? JSON.stringify(body) : ''; const r = http.request({ ...OLLAMA, path: pth, method, headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(p) }, timeout: 15000 }, x => { let s = ''; x.on('data', c => s += c); x.on('end', () => { let j = null; try { j = JSON.parse(s); } catch (e) { } res({ status: x.statusCode, json: j, text: s }); }); }); r.on('error', e => res({ error: e.message })); r.on('timeout', () => { r.destroy(); res({ error: 'timed out' }); }); r.end(p); });
}

/* ---------- the voices that can be downloaded (the official Piper voice list) ---------- */
let voiceCat = null;
async function voiceCatalog() {
  if (voiceCat && Date.now() - voiceCat.at < 86400e3) return voiceCat.list;
  const j = await getJson('https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/voices.json');
  const list = Object.values(j).filter(v => v.quality === 'medium' || v.quality === 'high').map(v => {
    const onnx = Object.keys(v.files).find(f => f.endsWith('.onnx')), bytes = (v.files[onnx] || {}).size_bytes || 0;
    return { key: v.key, lang: (v.language && v.language.name_english) || v.language.code, region: (v.language && v.language.country_english) || '', name: v.name, quality: v.quality, speakers: v.num_speakers, mb: MB(bytes), base: 'https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/' + onnx.replace(/\.onnx$/, '') };
  }).sort((a, b) => a.lang.localeCompare(b.lang) || a.region.localeCompare(b.region) || a.name.localeCompare(b.name));
  voiceCat = { at: Date.now(), list }; return list;
}

/* ---------- the list ---------- */
async function list() {
  const groups = [];
  /* offline library books */
  const books = kiwix.books();
  groups.push({ id: 'library', name: 'Offline library books', where: P.lib, note: 'Wikipedia, the Q&A sites, manuals, medical and survival guides and the classics: what Moundshroud reads from with no internet.', items: books.map(b => ({ id: 'zim:' + b.file, name: b.title, sub: b.category + ' · ' + b.file, bytes: b.sizeMB * 1048576, canGet: prep.CATALOG.some(c => c.url.endsWith(b.file)), warn: 'This book disappears from the Library, Search and the AI’s answers.' + (prep.CATALOG.some(c => c.url.endsWith(b.file)) ? ' It can be downloaded again from the list below.' : ' It is not in Stock up’s catalogue, so getting it back means downloading it from library.kiwix.org yourself.') + (/wikipedia/i.test(b.file) ? ' Wikipedia is the main source of offline answers.' : '') })) });
  /* AI models */
  const tags = await ollama('GET', '/api/tags');
  const models = tags.json && tags.json.models ? tags.json.models : null;
  groups.push({ id: 'models', name: 'AI models', where: process.env.OLLAMA_MODELS || path.join(os.homedir(), '.ollama', 'models'), note: 'The language models Moundshroud thinks with, kept by the AI engine (Ollama).' + (models ? '' : ' The AI engine is not running, so the list cannot be read right now.'), items: (models || []).map(m => ({ id: 'model:' + m.name, name: m.name, sub: [m.details && m.details.parameter_size, m.details && m.details.quantization_level].filter(Boolean).join(' · '), bytes: m.size, canGet: true, warn: 'Chats, News briefs, the citizens in Imperium and everything else that uses this model will need another one.' + (models && models.length === 1 ? ' It is your only model: the AI will stop working until you download one.' : '') + ' It can be downloaded again here (by its name).' })) });
  /* voices */
  const vs = exists(P.voices) ? fs.readdirSync(P.voices).filter(f => f.endsWith('.onnx')) : [];
  const voiceItems = vs.map(f => { const b = f.replace(/\.onnx$/, ''); return { id: 'voice:' + b, name: b.replace(/-/g, ' '), sub: 'Natural voice (Piper)', bytes: sizeOf(path.join(P.voices, f)) + (exists(path.join(P.voices, f + '.json')) ? sizeOf(path.join(P.voices, f + '.json')) : 0), canGet: true, warn: 'Read-aloud stops using this voice (another one, or a Windows voice on this PC, is used instead). It can be downloaded again here.' }; });
  if (exists(P.whisper)) voiceItems.push({ id: 'whisper', name: 'Voice typing model (Whisper base, English)', sub: 'voice\\ggml-base.en.bin', bytes: sizeOf(P.whisper), canGet: true, warn: 'Voice typing (the microphone buttons and Ctrl+Alt+V) stops working until it is downloaded again here (about 140 MB).' });
  groups.push({ id: 'voices', name: 'Voices', where: path.join(ROOT, 'piper') + ' · ' + path.join(ROOT, 'voice'), note: 'The on-device voices for reading aloud, and the model that turns your speech into text. All of it runs on this PC.', items: voiceItems });
  /* engines and tools */
  const tools = [];
  if (exists(P.stockfish)) tools.push({ id: 'stockfish', name: 'Stockfish chess engine', sub: 'engines\\stockfish', bytes: sizeOf(P.stockfish), canGet: true, warn: 'Chess falls back to the built-in engine: weaker play at the top levels and slower game analysis. It can be downloaded again here (78 MB).' });
  if (exists(P.imggen)) tools.push({ id: 'imggen', name: 'Picture maker (Stable Diffusion SDXL-Turbo)', sub: 'imggen', bytes: sizeOf(P.imggen), canGet: true, warn: 'Studio > AI art and “Type it, get pixel art” stop working until it is installed again (about 6.5 GB, in its own window).' });
  if (exists(P.musicgen)) tools.push({ id: 'musicgen', name: 'Music maker (MusicGen)', sub: 'musicgen', bytes: sizeOf(P.musicgen), canGet: true, warn: '“Compose from words” in the Music studio falls back to the AI writing the song instead of making the audio. It can be installed again (about 4 GB, in its own window; needs Python).' });
  if (exists(P.christian)) tools.push({ id: 'christiantexts', name: 'Christian texts for the Bible Expert', sub: 'data\\christian-texts and its search index', bytes: sizeOf(P.christian) + (exists(P.bibleIndex) ? fs.statSync(P.bibleIndex).size : 0), canGet: true, warn: 'Spiritual > Bible Expert goes back to the few texts built into the app (the Douay-Rheims Bible and the devotional classics). The Church Fathers, Aquinas, the Catholic Encyclopedia, the Catechism and the rest can be downloaded again (about 0.5 GB, in its own window).' });
  if (exists(P.cyberchef)) tools.push({ id: 'cyberchef', name: 'CyberChef', sub: 'nomad\\cyberchef', bytes: sizeOf(P.cyberchef), canGet: true, warn: 'The CyberChef tool in Cyber stops working until it is downloaded again here (from its GitHub release).' });
  if (torInstalled()) tools.push({ id: 'torbrowser', name: 'Tor Browser' + (torVersion() ? ' ' + torVersion() : ''), sub: 'tor-browser (official, from torproject.org)', bytes: sizeOf(P.tor), canGet: true, warn: 'The 🧅 Tor button in the Browser tab stops working until it is downloaded again here (about 120 MB). Its bookmarks and settings are deleted with it.' });
  if (exists(P.kiwixTools)) tools.push({ id: 'kiwix-tools', name: 'Library engine (kiwix-tools)', sub: 'nomad\\kiwix-tools', bytes: sizeOf(P.kiwixTools), canGet: true, warn: 'The program that opens the offline books. Without it NO library book can be read and Search loses the libraries, until it is downloaded again here (43 MB).' });
  groups.push({ id: 'tools', name: 'Engines and tools', where: ROOT, note: 'Programs Moundshroud downloaded to do one job each.', items: tools });
  /* music */
  let cat = []; try { cat = JSON.parse(fs.readFileSync(path.join(P.music, 'catalog.json'), 'utf8')); } catch (e) { }
  const folders = exists(P.music) ? fs.readdirSync(P.music, { withFileTypes: true }).filter(d => d.isDirectory() && !d.name.startsWith('_')).map(d => d.name) : [];
  groups.push({ id: 'music', name: 'Music library', where: P.music, note: 'The free, public-domain and Creative Commons recordings in Music and behind the games’ theme songs.', items: folders.map(fd => { const n = cat.filter(t => String(t.i || '').startsWith(fd + '/')).length, src = exists(path.join(P.music, fd, '_sources.json')); return { id: 'music:' + fd, name: fd[0].toUpperCase() + fd.slice(1) + ' collection', sub: n + ' tracks', bytes: sizeOf(path.join(P.music, fd)), canGet: src, warn: 'These ' + n + ' tracks leave the Music tab' + (fd === 'piano' ? ' and the games go back to their synthesised theme songs' : '') + '. ' + (src ? 'They can be downloaded again here (their sources are recorded).' : 'Their download sources are not recorded, so they cannot be fetched again from here.') }; }) });
  /* chess books */
  let cb = []; try { cb = JSON.parse(fs.readFileSync(path.join(P.chessbooks, 'index.json'), 'utf8')); } catch (e) { }
  if (cb.length) groups.push({ id: 'chessbooks', name: 'Chess books', where: P.chessbooks, note: 'Public-domain chess books converted for the chess Library.', items: cb.map(b => ({ id: 'chessbook:' + b.id, name: b.title, sub: (b.author || '') + (b.year ? ', ' + b.year : ''), bytes: sizeOf(path.join(P.chessbooks, b.id)), canGet: false, warn: 'This book leaves Chess > Library. It was converted when Moundshroud was built, so it cannot be fetched again from here.' })) });
  /* what was downloaded while reading the news and markets */
  const nd = ['news.json', 'news-img', 'news-access.json', 'markets'].map(f => path.join(P.data, f)).filter(exists);
  if (nd.length) groups.push({ id: 'fetched', name: 'Downloaded news and market data', where: P.data, note: 'Stories, pictures and market numbers kept so they can be read offline. Your choices (sources, beats, watchlist, journal) are kept separately and are not touched.', items: [{ id: 'newsdata', name: 'News stories, pictures and market data', sub: nd.map(p => path.basename(p)).join(', '), bytes: nd.reduce((a, p) => a + sizeOf(p), 0), canGet: true, warn: 'The last edition and the two-week archive are emptied; they fill up again at the next refresh (with internet access on).' }] });
  groups.forEach(g => { g.bytes = g.items.reduce((a, i) => a + (i.bytes || 0), 0); g.items.forEach(i => { const j = jobs[i.id]; if (j) i.job = j; }); });
  /* what can be downloaded that is not here */
  const avail = [];
  if (!exists(P.whisper)) avail.push({ id: 'whisper', name: 'Voice typing model (Whisper base, English)', mb: 142, desc: 'Turns your speech into text on this PC.' });
  if (!exists(P.stockfish)) avail.push({ id: 'stockfish', name: 'Stockfish chess engine', mb: 78, desc: 'Full-strength chess and deep analysis.' });
  if (!exists(P.imggen)) avail.push({ id: 'imggen', name: 'Picture maker (SDXL-Turbo)', mb: 6600, desc: 'AI art on this PC. Installs in its own window.' });
  if (!exists(P.musicgen)) avail.push({ id: 'musicgen', name: 'Music maker (MusicGen)', mb: 4000, desc: 'Music from words on this PC. Installs in its own window; needs Python 3.10+.' });
  if (!exists(P.christian)) avail.push({ id: 'christiantexts', name: 'Christian texts for the Bible Expert', mb: 450, desc: 'The Church Fathers, Aquinas, the Catholic Encyclopedia, the Catechism, Vatican II, encyclicals and more, all free. Installs in its own window.' });
  if (!exists(P.cyberchef)) avail.push({ id: 'cyberchef', name: 'CyberChef', mb: 80, desc: 'The data-transformation toolbox in Cyber.' });
  if (!torInstalled()) avail.push({ id: 'torbrowser', name: 'Tor Browser (official, from torproject.org)', mb: 121, desc: 'Private browsing through the Tor network, opened from the 🧅 Tor button in the Browser tab. Checked against the Tor Project’s published fingerprint before it is installed.' });
  if (!exists(P.kiwixTools)) avail.push({ id: 'kiwix-tools', name: 'Library engine (kiwix-tools)', mb: 43, desc: 'Needed to open any offline book.' });
  const removedMusic = exists(P.removed) ? fs.readdirSync(P.removed).filter(f => /^music-.+\.json$/.test(f)) : [];
  removedMusic.forEach(f => { try { const r = JSON.parse(fs.readFileSync(path.join(P.removed, f), 'utf8')); if (r.sources && r.sources.length && !exists(path.join(P.music, r.folder))) avail.push({ id: 'music:' + r.folder, name: r.folder[0].toUpperCase() + r.folder.slice(1) + ' collection', mb: r.mb || 0, desc: r.tracks.length + ' tracks, from their recorded sources.' }); } catch (e) { } });
  avail.forEach(a => { if (jobs[a.id]) a.job = jobs[a.id]; });
  let disk = null; try { const s = fs.statfsSync(path.parse(ROOT).root); disk = { free: s.bavail * s.bsize, total: s.blocks * s.bsize }; } catch (e) { }
  return { groups, available: avail, disk, total: groups.reduce((a, g) => a + g.bytes, 0), jobs };
}

/* ---------- Tor Browser: the official portable edition, verified, installed into tor-browser ---------- */
const TOREXE = () => path.join(P.tor, 'Browser', 'firefox.exe');
const torInstalled = () => exists(TOREXE());
const torVersion = () => { try { return fs.readFileSync(path.join(P.tor, 'TOR-SOURCE.txt'), 'utf8').match(/Version: ([\d.]+)/)[1]; } catch (e) { return ''; } };
const sha256 = f => new Promise((res, rej) => { const h = require('crypto').createHash('sha256'); fs.createReadStream(f).on('data', d => h.update(d)).on('end', () => res(h.digest('hex'))).on('error', rej); });
async function getTor(job) {
  const info = await getJson('https://aus1.torproject.org/torbrowser/update_3/release/downloads.json');
  const url = info && info.downloads && info.downloads.win64 && info.downloads.win64.ALL && info.downloads.win64.ALL.binary; if (!url) throw new Error('the Tor Project did not list a Windows download');
  const file = url.split('/').pop(), dir = url.slice(0, url.lastIndexOf('/') + 1);
  const sums = await new Promise((res, rej) => https.get(dir + 'sha256sums-signed-build.txt', { headers: { 'user-agent': 'Mozilla/5.0' } }, r => { let s = ''; r.on('data', d => s += d); r.on('end', () => res(s)); }).on('error', rej));
  const want = ((sums.split('\n').find(l => l.trim().endsWith(' ' + file)) || '').trim().split(/\s+/)[0] || '').toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(want)) throw new Error('could not read the published fingerprint');
  const exe = path.join(ROOT, 'nomad', 'dl-tools', file);
  await download(url, exe, job);
  job.pct = 99; job.note = 'Checking the fingerprint…';
  const got = await sha256(exe);
  if (got !== want) { try { fs.unlinkSync(exe); } catch (e) { } throw new Error('the download did not match the Tor Project’s fingerprint, so it was thrown away'); }
  job.note = 'Installing…';
  fs.mkdirSync(P.tor, { recursive: true });
  await new Promise(res => { const p = cp.spawn(exe, ['/S', '/D=' + P.tor], { windowsHide: true, stdio: 'ignore' }); p.on('exit', res); p.on('error', res); setTimeout(res, 300000); });
  try { fs.unlinkSync(exe); } catch (e) { }
  if (!torInstalled()) throw new Error('the installer finished but Tor Browser is not where it should be');
  fs.writeFileSync(path.join(P.tor, 'TOR-SOURCE.txt'), 'Tor Browser, installed by Moundshroud (Prepare > Stock up).\n\nSource: ' + url + '\nVersion: ' + (info.version || '') + '\nSHA-256 (matched the Tor Project\'s published list before installing): ' + want + '\nInstalled: ' + new Date().toISOString() + '\n');
}
function openTor(url) {
  if (!torInstalled()) return { error: 'not installed' };
  const args = []; if (url && /^(https?:\/\/|[a-z2-7]{16,56}\.onion)/i.test(String(url))) args.push(String(url).slice(0, 2000));
  cp.spawn(TOREXE(), args, { cwd: path.dirname(TOREXE()), detached: true, stdio: 'ignore', windowsHide: false }).unref();
  return { ok: true };
}
const torStatus = () => ({ installed: torInstalled(), version: torVersion(), job: jobs.torbrowser || null });

/* ---------- removing ---------- */
const rm = p => { fs.rmSync(p, { recursive: true, force: true, maxRetries: 3, retryDelay: 400 }); return !exists(p); };
async function remove(id) {
  id = String(id || ''); SIZES.clear();
  try {
    if (id.startsWith('zim:')) {
      const f = id.slice(4); if (!/^[\w.\-]+\.zim$/i.test(f) || !fs.readdirSync(P.lib).includes(f)) return { error: 'unknown book' };
      kiwix.stop(); await new Promise(r => setTimeout(r, 800));
      fs.unlinkSync(path.join(P.lib, f)); return { ok: true };
    }
    if (id.startsWith('model:')) {
      const m = id.slice(6); if (!/^[\w.\-:\/]+$/.test(m)) return { error: 'bad name' };
      const r = await ollama('DELETE', '/api/delete', { model: m, name: m });
      if (!r.error && r.status === 200) try { require('./lmstudio-sync').removeModel(m); } catch (e) { }
      return r.error ? { error: 'The AI engine is not running: ' + r.error } : r.status === 200 ? { ok: true } : { error: 'The AI engine said: ' + (r.text || r.status) };
    }
    if (id.startsWith('voice:')) {
      const b = id.slice(6); if (!/^[\w\-]+$/.test(b)) return { error: 'bad name' };
      const f = path.join(P.voices, b + '.onnx'); if (!exists(f)) return { error: 'not installed' };
      fs.unlinkSync(f); if (exists(f + '.json')) fs.unlinkSync(f + '.json'); return { ok: true };
    }
    if (id === 'whisper') { voice.stop(); await new Promise(r => setTimeout(r, 500)); fs.unlinkSync(P.whisper); return { ok: true }; }
    if (id === 'stockfish') { cp.spawnSync('taskkill', ['/IM', 'stockfish.exe', '/F'], { stdio: 'ignore', windowsHide: true }); await new Promise(r => setTimeout(r, 500)); return rm(P.stockfish) ? { ok: true } : { error: 'Some files are still in use. Close Chess and try again.' }; }
    if (id === 'imggen') { cp.spawnSync('taskkill', ['/IM', 'sd-cli.exe', '/F'], { stdio: 'ignore', windowsHide: true }); return rm(P.imggen) ? { ok: true } : { error: 'Some files are still in use. Close the Studio and try again.' }; }
    if (id === 'christiantexts') { const a = rm(P.christian); for (const x of ['', '-wal', '-shm']) { try { fs.rmSync(P.bibleIndex + x, { force: true }); } catch (e) { } } return a ? { ok: true } : { error: 'Some files are still in use. Close the Bible Expert and try again.' }; }
    if (id === 'musicgen') return rm(P.musicgen) ? { ok: true } : { error: 'Some files are still in use. Close the Music studio and try again.' };
    if (id === 'torbrowser') { await ps("Get-Process firefox -ErrorAction SilentlyContinue | Where-Object { $_.Path -like '" + P.tor.replace(/'/g, "''") + "*' } | Stop-Process -Force", 30000); await new Promise(r => setTimeout(r, 800)); return rm(P.tor) ? { ok: true } : { error: 'Tor Browser is still open. Close it and try again.' }; }
    if (id === 'cyberchef') return rm(P.cyberchef) ? { ok: true } : { error: 'Some files are still in use.' };
    if (id === 'kiwix-tools') { kiwix.stop(); await new Promise(r => setTimeout(r, 800)); return rm(P.kiwixTools) ? { ok: true } : { error: 'Some files are still in use.' }; }
    if (id.startsWith('music:')) {
      const fd = id.slice(6); if (!/^[\w\-]+$/.test(fd) || !exists(path.join(P.music, fd))) return { error: 'unknown collection' };
      /* the tracks leave the catalogue too, and what was removed is kept so it can be put back */
      const cf = path.join(P.music, 'catalog.json'); let cat = []; try { cat = JSON.parse(fs.readFileSync(cf, 'utf8')); } catch (e) { }
      const gone = cat.filter(t => String(t.i || '').startsWith(fd + '/')); let sources = []; try { sources = JSON.parse(fs.readFileSync(path.join(P.music, fd, '_sources.json'), 'utf8').replace(/^﻿/, '')); } catch (e) { }
      fs.mkdirSync(P.removed, { recursive: true });
      fs.writeFileSync(path.join(P.removed, 'music-' + fd + '.json'), JSON.stringify({ folder: fd, tracks: gone, sources, mb: MB(sizeOf(path.join(P.music, fd))), at: Date.now() }));
      if (!exists(cf + '.before-removal')) fs.copyFileSync(cf, cf + '.before-removal');
      fs.writeFileSync(cf, JSON.stringify(cat.filter(t => !String(t.i || '').startsWith(fd + '/'))));
      return rm(path.join(P.music, fd)) ? { ok: true } : { error: 'Some files are in use. Stop the music and try again.' };
    }
    if (id.startsWith('chessbook:')) {
      const b = id.slice(10), ix = path.join(P.chessbooks, 'index.json'); let cb = []; try { cb = JSON.parse(fs.readFileSync(ix, 'utf8')); } catch (e) { }
      if (!/^[\w.\-]+$/.test(b) || !cb.some(x => x.id === b)) return { error: 'unknown book' };
      if (!exists(ix + '.before-removal')) fs.copyFileSync(ix, ix + '.before-removal');
      fs.writeFileSync(ix, JSON.stringify(cb.filter(x => x.id !== b))); rm(path.join(P.chessbooks, b)); return { ok: true };
    }
    if (id === 'newsdata') { try { require('./news').forget(); } catch (e) { } rm(path.join(P.data, 'news-access.json')); rm(path.join(P.data, 'markets')); return { ok: true }; }
    return { error: 'unknown item' };
  } catch (e) { return { error: e.code === 'EBUSY' || e.code === 'EPERM' ? 'It is in use right now. Close what is using it and try again.' : e.message }; }
}

/* ---------- getting (back) ---------- */
function run(id, fn) {
  SIZES.clear();
  if (jobs[id] && jobs[id].status === 'downloading') return { ok: true, status: 'downloading' };
  const job = jobs[id] = { status: 'downloading', pct: 0, error: '' };
  fn(job).then(() => { job.status = 'done'; job.pct = 100; job.note = ''; setTimeout(() => { if (jobs[id] === job) delete jobs[id]; }, 60000); }, e => { job.status = 'error'; job.error = String(e && e.message || e); });
  return { ok: true, status: 'downloading' };
}
const openWindow = script => { cp.spawn('cmd', ['/c', 'start', '"Moundshroud: installing"', 'powershell', '-NoExit', '-ExecutionPolicy', 'Bypass', '-File', path.join(ROOT, script)], { detached: true, stdio: 'ignore', windowsHide: false }).unref(); };
async function get(id, extra) {
  id = String(id || '');
  if (id.startsWith('zim:')) { const f = id.slice(4), c = prep.CATALOG.find(x => x.url.endsWith(f)); return c ? prep.getStock(c.id) : { error: 'not in the catalogue' }; }
  if (id === 'stockfish') return prep.getStock('stockfish');
  if (id.startsWith('voice:')) {
    const k = id.slice(6), v = (await voiceCatalog()).find(x => x.key === k); if (!v) return { error: 'unknown voice' };
    return run(id, async job => { await download(v.base + '.onnx.json', path.join(P.voices, k + '.onnx.json')); await download(v.base + '.onnx', path.join(P.voices, k + '.onnx'), job); });
  }
  if (id === 'whisper') return run(id, job => download('https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.en.bin', P.whisper, job));
  if (id === 'cyberchef') return run(id, async job => {
    const rel = await getJson('https://api.github.com/repos/gchq/CyberChef/releases/latest'), a = (rel.assets || []).find(x => /^CyberChef_v.*\.zip$/.test(x.name)); if (!a) throw new Error('no download in the latest release');
    const zip = path.join(ROOT, 'nomad', 'dl-cyberchef', a.name); await download(a.browser_download_url, zip, job);
    const out = await ps("Expand-Archive -LiteralPath '" + zip.replace(/'/g, "''") + "' -DestinationPath '" + P.cyberchef.replace(/'/g, "''") + "' -Force; 'OK'", 300000); try { fs.unlinkSync(zip); } catch (e) { }
    if (!/OK/.test(out)) throw new Error('could not unpack it');
  });
  if (id === 'kiwix-tools') return run(id, async job => {
    const zip = path.join(ROOT, 'nomad', 'dl-tools', 'kiwix-tools.zip'); await download('https://download.kiwix.org/release/kiwix-tools/kiwix-tools_win-x86_64-3.8.1.zip', zip, job);
    const out = await ps("$t = Join-Path $env:TEMP 'kwx'; Remove-Item $t -Recurse -Force -ErrorAction SilentlyContinue; Expand-Archive -LiteralPath '" + zip.replace(/'/g, "''") + "' -DestinationPath $t -Force; $d = Get-ChildItem $t -Directory | Select-Object -First 1; New-Item -ItemType Directory -Force '" + P.kiwixTools.replace(/'/g, "''") + "' | Out-Null; Copy-Item (Join-Path $(if ($d) { $d.FullName } else { $t }) '*') '" + P.kiwixTools.replace(/'/g, "''") + "' -Recurse -Force; 'OK'", 300000);
    try { fs.unlinkSync(zip); } catch (e) { } if (!/OK/.test(out)) throw new Error('could not unpack it');
  });
  if (id === 'torbrowser') return run(id, getTor);
  if (id === 'imggen') { openWindow('install-art-model.ps1'); return { ok: true, status: 'window', message: 'The picture maker is installing in its own window (about 6.5 GB). It shows its progress there.' }; }
  if (id === 'christiantexts') { openWindow('install-christian-texts.ps1'); return { ok: true, status: 'window', message: 'The Christian texts are downloading in their own window (about 0.5 GB). The first time you open Spiritual > Bible Expert afterwards, it reads them into its search index (a few minutes).' }; }
  if (id === 'musicgen') { openWindow('install-music-model.ps1'); return { ok: true, status: 'window', message: 'The music maker is installing in its own window (about 4 GB). It shows its progress there.' }; }
  if (id.startsWith('music:')) {
    const fd = id.slice(6), rf = path.join(P.removed, 'music-' + fd + '.json'); if (!/^[\w\-]+$/.test(fd) || !exists(rf)) return { error: 'nothing recorded for that collection' };
    const r = JSON.parse(fs.readFileSync(rf, 'utf8')); if (!r.sources || !r.sources.length) return { error: 'its download sources are not recorded' };
    return run(id, async job => {
      let n = 0; for (const s of r.sources) { const dest = path.join(P.music, fd, s.o); if (!exists(dest)) await download(s.u, dest); n++; job.pct = Math.round(n / r.sources.length * 100); }
      fs.writeFileSync(path.join(P.music, fd, '_sources.json'), JSON.stringify(r.sources, null, 1));
      const cf = path.join(P.music, 'catalog.json'), cat = JSON.parse(fs.readFileSync(cf, 'utf8')); fs.writeFileSync(cf, JSON.stringify(cat.concat(r.tracks.filter(t => !cat.some(x => x.i === t.i))))); fs.unlinkSync(rf);
    });
  }
  if (id.startsWith('model:')) return { error: 'use the model download' };
  return { error: 'unknown item' };
}
/* any AI model by its name in the Ollama library, like qwen3.5:9b or llama3.2:3b */
function pullModel(OLL, name) {
  name = String(name || '').trim(); if (!/^[\w.\-:\/]{2,80}$/.test(name)) return { error: 'That is not a model name (for example qwen3.5:9b).' };
  if (!prep.MODELS.some(m => m.id === name)) prep.MODELS.push({ id: name, name, desc: 'Added by name', mb: 0 });
  return prep.startPull(OLL, name);
}
const jobStatus = () => jobs;

module.exports = { list, remove, get, voiceCatalog, pullModel, jobStatus, openTor, torStatus };

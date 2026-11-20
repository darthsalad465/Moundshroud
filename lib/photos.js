// Photos: a private photo library over folders you choose. Nothing is copied or uploaded: the files stay where they
// are, Moundshroud keeps a small index (names, dates, sizes), small preview pictures, and the descriptions your
// local AI writes so you can search with words like "beach" or "dog in the snow".
// OneDrive files that are only in the cloud are listed but never opened, so browsing does not download them.
const fs = require('fs'), path = require('path'), crypto = require('crypto'), cp = require('child_process'), os = require('os');
const U = require('./util');
const DATA = path.join(__dirname, '..', 'data'), CFG = path.join(DATA, 'photos.json'), IDX = path.join(DATA, 'photos-index.json'), THUMBS = path.join(DATA, 'photo-thumbs');
const EXT = /\.(jpe?g|png|gif|webp|bmp|avif|heic|heif)$/i, SHOWABLE = /\.(jpe?g|png|gif|webp|bmp|avif)$/i;
const MIME = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp', bmp: 'image/bmp', avif: 'image/avif' };
const RECALL = 0x400000, OFFLINE = 0x1000;            // Windows: the file's contents are in the cloud, not on this PC

function defaults() {
  const h = os.homedir(), c = [path.join(h, 'Pictures'), process.env.OneDrive && path.join(process.env.OneDrive, 'Pictures'), process.env.OneDriveConsumer && path.join(process.env.OneDriveConsumer, 'Pictures')];
  return [...new Set(c.filter(d => d && fs.existsSync(d)))];
}
function cfg() { const c = U.readJson(CFG, null) || {}; if (!Array.isArray(c.folders)) c.folders = defaults(); c.fav = c.fav || {}; c.cap = c.cap || {}; c.hidden = c.hidden || {}; return c; }
const saveCfg = c => U.writeJson(CFG, c);
const idOf = p => crypto.createHash('sha1').update(p.toLowerCase()).digest('hex').slice(0, 16);

let index = U.readJson(IDX, null) || { at: 0, items: [] }, byId = new Map(index.items.map(x => [x.id, x])), scanning = null, scanNote = '';

/* the date a photo was taken, from the EXIF data at the start of a JPEG */
function exifDate(file) {
  let fd; try {
    fd = fs.openSync(file, 'r'); const b = Buffer.alloc(131072); const n = fs.readSync(fd, b, 0, b.length, 0); if (n < 12 || b[0] !== 0xFF || b[1] !== 0xD8) return 0;
    let o = 2;
    while (o + 4 < n) {
      if (b[o] !== 0xFF) return 0; const mk = b[o + 1], len = b.readUInt16BE(o + 2);
      if (mk === 0xE1 && b.toString('latin1', o + 4, o + 10) === 'Exif\0\0') {
        const t = o + 10, le = b.toString('latin1', t, t + 2) === 'II', r16 = i => le ? b.readUInt16LE(i) : b.readUInt16BE(i), r32 = i => le ? b.readUInt32LE(i) : b.readUInt32BE(i);
        const ifd = (off, want) => { if (t + off + 2 > n) return null; const cnt = r16(t + off); for (let i = 0; i < cnt; i++) { const e = t + off + 2 + i * 12; if (e + 12 > n) return null; if (r16(e) === want) return { type: r16(e + 2), count: r32(e + 4), val: r32(e + 8) }; } return null; };
        const ex = ifd(r32(t + 4), 0x8769); let dt = ex && ifd(ex.val, 0x9003); if (!dt) dt = ifd(r32(t + 4), 0x0132);
        if (!dt || t + dt.val + 19 > n) return 0;
        const s = b.toString('latin1', t + dt.val, t + dt.val + 19), m = s.match(/^(\d{4}):(\d\d):(\d\d) (\d\d):(\d\d):(\d\d)/);
        if (!m || m[1] === '0000') return 0; const d = new Date(+m[1], m[2] - 1, +m[3], +m[4], +m[5], +m[6]).getTime(); return isNaN(d) ? 0 : d;
      }
      if (mk === 0xDA) return 0; o += 2 + len;
    }
    return 0;
  } catch (e) { return 0; } finally { try { if (fd !== undefined) fs.closeSync(fd); } catch (e) { } }
}

/* listing goes through Windows so the cloud-only marker on OneDrive files can be seen without opening them */
function listFolder(dir) {
  return new Promise(res => {
    const ps = "$ErrorActionPreference='SilentlyContinue'; [Console]::OutputEncoding=[Text.Encoding]::UTF8; Get-ChildItem -LiteralPath $env:PH_DIR -Recurse -File -Force | Where-Object { $_.Extension -match '^\\.(jpe?g|png|gif|webp|bmp|avif|heic|heif)$' -and $_.FullName -notmatch '\\\\(AppData|node_modules|\\.git|\\$RECYCLE\\.BIN)\\\\' } | Select-Object -First 60000 | ForEach-Object { $_.FullName + [char]9 + $_.Length + [char]9 + [long]($_.LastWriteTimeUtc - [datetime]'1970-01-01').TotalMilliseconds + [char]9 + [int]$_.Attributes }";
    cp.execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', ps], { env: Object.assign({}, process.env, { PH_DIR: dir }), windowsHide: true, maxBuffer: 64e6, timeout: 600000 }, (e, out) => {
      res(String(out || '').split(/\r?\n/).filter(Boolean).map(l => { const [p, s, m, a] = l.split('\t'); return { p, s: +s, m: +m, a: +a }; }).filter(x => x.p && EXT.test(x.p)));
    });
  });
}

async function scan() {
  if (scanning) return scanning;
  scanning = (async () => {
    const c = cfg(), items = [], seen = new Set();
    for (const dir of c.folders) {
      if (!fs.existsSync(dir)) continue; scanNote = 'Looking through ' + dir;
      for (const f of await listFolder(dir)) {
        const id = idOf(f.p); if (seen.has(id)) continue; seen.add(id);
        const old = byId.get(id), cloud = !!(f.a & (RECALL | OFFLINE));
        let t = old && old.m === f.m && old.s === f.s ? old.t : 0;
        if (!t && !cloud && /\.jpe?g$/i.test(f.p)) t = exifDate(f.p);
        items.push({ id, p: f.p, n: path.basename(f.p), d: path.relative(dir, path.dirname(f.p)) || '', root: dir, s: f.s, m: f.m, t: t || f.m, ex: !!t, cloud, show: SHOWABLE.test(f.p) });
      }
    }
    items.sort((a, b) => b.t - a.t);
    index = { at: Date.now(), items }; byId = new Map(items.map(x => [x.id, x]));
    U.writeJson(IDX, index); scanNote = '';
    return { count: items.length };
  })().finally(() => { scanning = null; });
  return scanning;
}

function list() {
  const c = cfg();
  return { at: index.at, scanning: !!scanning, note: scanNote, folders: c.folders, items: index.items.filter(x => !c.hidden[x.id]).map(x => Object.assign({}, x, { p: undefined, title: c.titles?.[x.id] || x.n, fav: !!c.fav[x.id], cap: c.cap[x.id] || null, th: fs.existsSync(path.join(THUMBS, x.id + '.jpg')) })) };
}
function setFolders(folders) {
  const c = cfg(); c.folders = [...new Set((folders || []).map(String).filter(d => path.isAbsolute(d) && fs.existsSync(d) && fs.statSync(d).isDirectory()))].slice(0, 30);
  saveCfg(c); scan().catch(() => { }); return { folders: c.folders };
}
function fav(id, on) { const c = cfg(); if (!byId.has(id)) return { error: 'not found' }; if (on) c.fav[id] = 1; else delete c.fav[id]; saveCfg(c); return { ok: true }; }
function hide(id) { const c = cfg(); if (!byId.has(id)) return { error: 'not found' }; c.hidden[id] = 1; saveCfg(c); return { ok: true }; }
function rename(id, title) {
  if (!byId.has(id)) return { error: 'Photo not found.' };
  const clean = String(title || '').trim().slice(0, 120);
  if (!clean) return { error: 'Enter a photo name.' };
  const c = cfg();
  c.titles ||= {};
  c.titles[id] = clean;
  saveCfg(c);
  return { ok: true, title: clean };
}
function changeGroup(ids, action) {
  const c = cfg(), done = ids.filter(id => byId.has(id));
  for (const id of done) {
    if (action === 'hide') c.hidden[id] = 1;
    else if (action === 'favourite') c.fav[id] = 1;
    else delete c.fav[id];
  }
  saveCfg(c);
  return done;
}

async function recycle(ids) {
  const c = cfg(), files = [];
  for (const id of ids) {
    const x = byId.get(id);
    if (!x || x.cloud || !c.folders.includes(x.root)) continue;
    try {
      const root = fs.realpathSync(x.root), file = fs.realpathSync(x.p), relative = path.relative(root, file);
      if (!relative || relative === '..' || relative.startsWith('..' + path.sep) || path.isAbsolute(relative)) continue;
      if (path.resolve(file).toLowerCase() !== path.resolve(x.p).toLowerCase() || !fs.lstatSync(file).isFile()) continue;
      files.push({ file, id });
    } catch (_) { /* The photo was moved or is unavailable. */ }
  }
  if (!files.length) return [];
  let shell;
  try { shell = require('electron').shell; } catch (_) { /* The standalone server uses Windows instead. */ }
  const done = [];
  if (shell?.trashItem) {
    for (const x of files) {
      try { await shell.trashItem(x.file); done.push(x.id); } catch (_) { /* Leave failed items visible. */ }
    }
  } else if (process.platform === 'win32') {
    const script = "[Console]::InputEncoding = [Text.Encoding]::UTF8; Add-Type -AssemblyName Microsoft.VisualBasic; " +
      "$files = ConvertFrom-Json -InputObject ([Console]::In.ReadToEnd()); foreach ($x in $files) { " +
      "try { [Microsoft.VisualBasic.FileIO.FileSystem]::DeleteFile($x.file, 'OnlyErrorDialogs', 'SendToRecycleBin', 'ThrowException'); [Console]::WriteLine($x.id) } catch {} }";
    const output = await new Promise(resolve => {
      const child = cp.execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script],
        { windowsHide: true, timeout: 120000 }, (_, stdout) => resolve(stdout || ''));
      child.stdin.on('error', () => {});
      child.stdin.end(JSON.stringify(files));
    });
    const moved = new Set(output.trim().split(/\s+/));
    done.push(...files.filter(x => moved.has(x.id)).map(x => x.id));
  }
  if (done.length) {
    if (scanning) await scanning.catch(() => {});
    const removed = new Set(done);
    index.items = index.items.filter(x => !removed.has(x.id));
    for (const id of done) byId.delete(id);
    U.writeJson(IDX, index);
  }
  return done;
}
function caption(id, text, tags, model) {
  if (!byId.has(id)) return { error: 'not found' };
  const c = cfg(); c.cap[id] = { c: String(text || '').slice(0, 600), k: (Array.isArray(tags) ? tags : []).map(String).map(s => s.toLowerCase().slice(0, 30)).slice(0, 20), m: String(model || '').slice(0, 60), at: Date.now() };
  saveCfg(c); return { ok: true };
}
function forgetCaptions() { const c = cfg(); c.cap = {}; saveCfg(c); return { ok: true }; }

/* the photo itself and its preview: only files in the index can be read, so no other file on the PC can be reached */
function file(id, res) {
  const x = byId.get(String(id)); if (!x || !x.show) { res.writeHead(404); return res.end(); }
  const type = MIME[path.extname(x.p).slice(1).toLowerCase()] || 'application/octet-stream';
  fs.stat(x.p, (e, st) => { if (e) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'Content-Type': type, 'Content-Length': st.size, 'Cache-Control': 'private, max-age=3600' }); fs.createReadStream(x.p).pipe(res); });
}
function thumb(id, res) {
  const f = path.join(THUMBS, String(id).replace(/[^a-f0-9]/g, '') + '.jpg');
  fs.readFile(f, (e, b) => { if (e) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'Content-Type': 'image/jpeg', 'Content-Length': b.length, 'Cache-Control': 'private, max-age=86400' }); res.end(b); });
}
function saveThumb(id, buf) {
  if (!byId.has(String(id)) || !buf || buf.length < 100 || buf.length > 400000 || buf[0] !== 0xFF || buf[1] !== 0xD8) return { error: 'not a preview' };
  fs.mkdirSync(THUMBS, { recursive: true }); U.atomicWrite(path.join(THUMBS, id + '.jpg'), buf); return { ok: true };
}
function where(id) { const x = byId.get(String(id)); return x ? x.p : null; }
function stats() { let n = 0; try { for (const f of fs.readdirSync(THUMBS)) n += fs.statSync(path.join(THUMBS, f)).size; } catch (e) { } return { photos: index.items.length, thumbsMB: Math.round(n / 1048576 * 10) / 10, described: Object.keys(cfg().cap).length }; }
function clearThumbs() { try { fs.rmSync(THUMBS, { recursive: true, force: true }); } catch (e) { } return { ok: true }; }

module.exports = { scan, list, setFolders, fav, hide, rename, changeGroup, recycle, caption, forgetCaptions, file, thumb, saveThumb, where, stats, clearThumbs, exifDate, defaults, THUMBS };

// Tools > Converter > My converted files: every conversion can be kept on this PC together with the file it came from,
// so it can be found again, sorted into folders, renamed, and turned back into the original at any time.
// Each kept conversion is one folder data/conversions/<id>/ holding "converted<ext>" and "original<ext>"; the list,
// the folders and the names live in data/conversions/index.json. Nothing here touches the internet.
const fs = require('fs'), path = require('path'), crypto = require('crypto');

const DIR = path.join(__dirname, '..', 'data', 'conversions'), INDEX = path.join(DIR, 'index.json');
const MAX_ITEM = 600e6;                        // bytes per file kept (a long video can be big)
const clean = s => String(s == null ? '' : s).replace(/[\u0000-\u001f\u007f<>:"/\\|?*]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 140);
const extOf = n => { const e = path.extname(String(n || '')).toLowerCase(); return /^\.[a-z0-9]{1,8}$/.test(e) ? e : ''; };
const ID = /^c[0-9a-z]{6,12}-[0-9a-f]{6}$/, FID = /^f[0-9a-z]{6,12}$/;

function read() { try { const j = JSON.parse(fs.readFileSync(INDEX, 'utf8')); return { folders: Array.isArray(j.folders) ? j.folders : [], items: Array.isArray(j.items) ? j.items : [] }; } catch (e) { return { folders: [], items: [] }; } }
function write(d) { fs.mkdirSync(DIR, { recursive: true }); const tmp = INDEX + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(d)); fs.renameSync(tmp, INDEX); }
const fileOf = (it, part) => path.join(DIR, it.id, (part === 'orig' ? 'original' : 'converted') + (part === 'orig' ? it.oext : it.ext));
function list() {
  const d = read(); let total = 0;
  const items = d.items.map(it => { const s = sz(fileOf(it, 'out')), o = sz(fileOf(it, 'orig')); total += s + o; return Object.assign({}, it, { size: s, osize: o, hasOrig: o > 0 }); });
  return { folders: d.folders, items, total };
}
const sz = f => { try { return fs.statSync(f).size; } catch (e) { return 0; } };

/* a new kept conversion: the names first, then each part's bytes in its own request */
function create(b) {
  b = b || {}; const d = read();
  const name = clean(b.name), orig = clean(b.origName);
  if (!name) return { error: 'The converted file has no name.' };
  const folder = FID.test(String(b.folder || '')) && d.folders.some(f => f.id === b.folder) ? b.folder : '';
  const id = 'c' + Date.now().toString(36) + '-' + crypto.randomBytes(3).toString('hex');
  const it = { id, name, ext: extOf(name), origName: orig || '', oext: extOf(orig), from: clean(b.from).slice(0, 20), to: clean(b.to).slice(0, 20), folder, at: Date.now() };
  fs.mkdirSync(path.join(DIR, id), { recursive: true });
  d.items.unshift(it); write(d);
  return { ok: true, id };
}
function put(id, part, buf) {
  if (!ID.test(String(id)) || !['out', 'orig'].includes(part)) return { error: 'bad request' };
  const d = read(), it = d.items.find(x => x.id === id); if (!it) return { error: 'That kept file is gone.' };
  if (!buf || !buf.length) return { error: 'Nothing was sent.' };
  fs.writeFileSync(fileOf(it, part), buf); return { ok: true };
}
/* LibreOffice writes its result into Documents\Moundshroud Documents; a copy of that file is kept (nothing else may be read) */
function putFrom(id, src) {
  const OUT = require('./office').OUT, p = path.resolve(String(src || ''));
  if (!ID.test(String(id)) || path.dirname(p) !== path.resolve(OUT)) return { error: 'That file cannot be kept.' };
  const d = read(), it = d.items.find(x => x.id === id); if (!it) return { error: 'That kept file is gone.' };
  try { fs.copyFileSync(p, fileOf(it, 'out')); return { ok: true }; } catch (e) { return { error: 'Could not copy it: ' + e.message }; }
}
const TYPES = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.bmp': 'image/bmp', '.ico': 'image/x-icon', '.svg': 'image/svg+xml', '.pdf': 'application/pdf', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.ogg': 'audio/ogg', '.flac': 'audio/flac', '.m4a': 'audio/mp4', '.opus': 'audio/ogg', '.mp4': 'video/mp4', '.webm': 'video/webm', '.txt': 'text/plain; charset=utf-8', '.csv': 'text/plain; charset=utf-8', '.tsv': 'text/plain; charset=utf-8', '.json': 'text/plain; charset=utf-8', '.yaml': 'text/plain; charset=utf-8', '.md': 'text/plain; charset=utf-8', '.html': 'text/plain; charset=utf-8', '.mid': 'audio/midi', '.zip': 'application/zip' };
/* one part of a kept conversion: shown in the app, or saved under its own name ("dl") */
function send(id, part, dl, res) {
  const d = read(), it = d.items.find(x => x.id === String(id)), f = it && fileOf(it, part === 'orig' ? 'orig' : 'out');
  if (!it || !sz(f)) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('That file is no longer kept.'); }
  const name = part === 'orig' ? (it.origName || 'original' + it.oext) : it.name, ext = path.extname(f).toLowerCase();
  const h = { 'Content-Type': dl ? 'application/octet-stream' : (TYPES[ext] || 'application/octet-stream'), 'Content-Length': sz(f), 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };
  h['Content-Disposition'] = (dl ? 'attachment' : 'inline') + "; filename*=UTF-8''" + encodeURIComponent(name);
  if (!dl && ext === '.svg') h['Content-Security-Policy'] = "default-src 'none'; style-src 'unsafe-inline'";
  res.writeHead(200, h); fs.createReadStream(f).pipe(res);
}
function rename(id, name) { const d = read(), it = d.items.find(x => x.id === String(id)); name = clean(name); if (!it || !name) return { error: 'Type a name.' }; if (!extOf(name) && it.ext) name += it.ext; it.name = name; write(d); return list(); }
function move(ids, folder) { const d = read(); folder = String(folder || ''); if (folder && !d.folders.some(f => f.id === folder)) return { error: 'That folder is gone.' }; const set = new Set([].concat(ids || []).map(String)); d.items.forEach(it => { if (set.has(it.id)) it.folder = folder; }); write(d); return list(); }
function remove(ids) {
  const d = read(), set = new Set([].concat(ids || []).map(String).filter(x => ID.test(x)));
  d.items = d.items.filter(it => { if (!set.has(it.id)) return true; try { fs.rmSync(path.join(DIR, it.id), { recursive: true, force: true }); } catch (e) { } return false; });
  write(d); return list();
}
function folder(b) {
  b = b || {}; const d = read();
  if (b.remove) { const id = String(b.remove); d.folders = d.folders.filter(f => f.id !== id); d.items.forEach(it => { if (it.folder === id) it.folder = ''; }); write(d); return list(); }
  const name = clean(b.name).slice(0, 60); if (!name) return { error: 'Type a folder name.' };
  if (b.rename) { const f = d.folders.find(x => x.id === String(b.rename)); if (!f) return { error: 'That folder is gone.' }; f.name = name; write(d); return list(); }
  if (d.folders.length >= 200) return { error: 'That is already 200 folders.' };
  const id = 'f' + Date.now().toString(36); d.folders.push({ id, name }); write(d); return Object.assign(list(), { created: id });
}

module.exports = { list, create, put, putFrom, send, rename, move, remove, folder, MAX_ITEM, DIR, extOf, clean };

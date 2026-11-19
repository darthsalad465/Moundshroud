// A small zip writer and reader. Windows' Compress-Archive gives up on long paths (the reference libraries have deep
// folders) and the browser has no way to pack a folder, so backups are written here instead: deflate through zlib, a
// normal central directory, and names flagged UTF-8. Any unzip tool opens the result, and restore() reads it back with
// the reader below. Sizes are the classic 32-bit ones, which is plenty for this app's data; a single file over 4 GB is
// refused rather than silently corrupted.
const fs = require('fs'), path = require('path'), zlib = require('zlib');

const CRC = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c; }
  return t;
})();
function crc32(buf) { let c = -1; for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8); return (c ^ -1) >>> 0; }

function dosStamp(d) {
  const time = ((d.getHours() & 31) << 11) | ((d.getMinutes() & 63) << 5) | ((d.getSeconds() / 2) & 31);
  const date = (((d.getFullYear() - 1980) & 127) << 9) | (((d.getMonth() + 1) & 15) << 5) | (d.getDate() & 31);
  return { time: time & 0xffff, date: date & 0xffff };
}

/* everything under dir, deepest folders included; skip() gets the relative path */
function collect(dir, base, out, skip) {
  let ents = []; try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return; }
  for (const e of ents) {
    const abs = path.join(dir, e.name), rel = path.relative(base, abs);
    if (skip && skip(rel)) continue;
    let st; try { st = fs.lstatSync(abs); } catch (x) { continue; }
    if (st.isDirectory()) { out.push({ abs, rel, dir: true, st }); collect(abs, base, out, skip); }
    else if (st.isFile()) out.push({ abs, rel, dir: false, st });
  }
}

const MAXFILE = 4 * 1024 * 1024 * 1024 - 1;

function zipDir(dir, out, opts) {
  const skip = (opts && opts.skip) || null, list = [];
  collect(dir, dir, list, skip);
  const fd = fs.openSync(out, 'w');
  const central = [];
  let offset = 0;
  try {
    for (const e of list) {
      const name = Buffer.from(e.rel.split(path.sep).join('/') + (e.dir ? '/' : ''), 'utf8');
      let raw = Buffer.alloc(0), comp = Buffer.alloc(0), method = 0, crc = 0, size = 0;
      if (!e.dir) {
        size = e.st.size;
        if (size > MAXFILE) throw new Error('One file is too big to back up here: ' + e.rel);
        raw = fs.readFileSync(e.abs);
        crc = crc32(raw);
        const def = zlib.deflateRawSync(raw, { level: 6 });
        if (def.length < raw.length) { comp = def; method = 8; } else { comp = raw; method = 0; }
        size = raw.length;
      }
      const stamp = dosStamp(e.st.mtime || new Date());
      const local = Buffer.alloc(30);
      local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0x0800, 6);
      local.writeUInt16LE(method, 8); local.writeUInt16LE(stamp.time, 10); local.writeUInt16LE(stamp.date, 12);
      local.writeUInt32LE(crc, 14); local.writeUInt32LE(comp.length, 18); local.writeUInt32LE(size, 22);
      local.writeUInt16LE(name.length, 26); local.writeUInt16LE(0, 28);
      fs.writeSync(fd, local); fs.writeSync(fd, name); if (comp.length) fs.writeSync(fd, comp);
      const cen = Buffer.alloc(46);
      cen.writeUInt32LE(0x02014b50, 0); cen.writeUInt16LE(20, 4); cen.writeUInt16LE(20, 6); cen.writeUInt16LE(0x0800, 8);
      cen.writeUInt16LE(method, 10); cen.writeUInt16LE(stamp.time, 12); cen.writeUInt16LE(stamp.date, 14);
      cen.writeUInt32LE(crc, 16); cen.writeUInt32LE(comp.length, 20); cen.writeUInt32LE(size, 24);
      cen.writeUInt16LE(name.length, 28); cen.writeUInt16LE(0, 30); cen.writeUInt16LE(0, 32);
      cen.writeUInt16LE(0, 34); cen.writeUInt16LE(0, 36); cen.writeUInt32LE(e.dir ? 0x10 : 0, 38);
      cen.writeUInt32LE(offset, 42);
      central.push({ head: cen, name });
      offset += local.length + name.length + comp.length;
    }
    const start = offset;
    let size = 0;
    for (const c of central) { fs.writeSync(fd, c.head); fs.writeSync(fd, c.name); size += c.head.length + c.name.length; }
    const end = Buffer.alloc(22);
    end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(0, 4); end.writeUInt16LE(0, 6);
    end.writeUInt16LE(central.length, 8); end.writeUInt16LE(central.length, 10);
    end.writeUInt32LE(size, 12); end.writeUInt32LE(start, 16); end.writeUInt16LE(0, 20);
    fs.writeSync(fd, end);
  } finally { fs.closeSync(fd); }
  return { files: list.filter(e => !e.dir).length, entries: list.length, bytes: offset };
}

/* read it back: name -> Buffer, folders created as needed under out */
function unzip(file, out, opts) {
  const buf = fs.readFileSync(file);
  const maxBytes = opts && Number.isSafeInteger(opts.maxBytes) ? opts.maxBytes : Infinity;
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 66560); i--) if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) return { error: 'That is not a zip file.' };
  const count = buf.readUInt16LE(eocd + 10);
  if (count > ((opts && opts.maxFiles) || 100000)) return { error: 'The zip contains too many files to check safely.' };
  let p = buf.readUInt32LE(eocd + 16);
  const made = []; let expanded = 0;
  for (let n = 0; n < count; n++) {
    if (p + 46 > buf.length || buf.readUInt32LE(p) !== 0x02014b50) return { error: 'The zip file is damaged.' };
    const method = buf.readUInt16LE(p + 10), crc = buf.readUInt32LE(p + 16);
    const compSize = buf.readUInt32LE(p + 20), size = buf.readUInt32LE(p + 24);
    const nameLen = buf.readUInt16LE(p + 28), extraLen = buf.readUInt16LE(p + 30), commentLen = buf.readUInt16LE(p + 32);
    const rel = buf.toString('utf8', p + 46, p + 46 + nameLen);
    const start = buf.readUInt32LE(p + 42);
    p += 46 + nameLen + extraLen + commentLen;
    const safe = rel.replace(/\\/g, '/').split('/').filter(x => x && x !== '.' && x !== '..');
    if (!safe.length) continue;
    if (size > maxBytes - expanded) return { error: 'The backup expands beyond the safe check limit.' };
    const dest = path.join(out, ...safe);
    if (rel.endsWith('/')) { fs.mkdirSync(dest, { recursive: true }); continue; }
    /* the local header sits right before the data and repeats the name and extra field lengths */
    if (buf.readUInt32LE(start) !== 0x04034b50) continue;
    const lName = buf.readUInt16LE(start + 26), lExtra = buf.readUInt16LE(start + 28);
    const at = start + 30 + lName + lExtra;
    const data = buf.slice(at, at + compSize);
    let raw;
    try { raw = method === 8 ? zlib.inflateRawSync(data) : Buffer.from(data); } catch (e) { return { error: 'A file inside the zip could not be read: ' + rel }; }
    if (raw.length !== size || crc32(raw) !== crc) return { error: 'A file inside the zip is damaged: ' + rel };
    expanded += raw.length;
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, raw);
    made.push(rel);
  }
  return { files: made.length, names: made };
}

module.exports = { zipDir, unzip, crc32 };

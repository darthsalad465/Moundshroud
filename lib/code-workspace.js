// Local PC code workspace. Lists only the folder the user opens; it never crawls a drive.
const fs = require('fs'), path = require('path'), os = require('os'), crypto = require('crypto');
const BACKUP = path.join(__dirname, '..', 'data', 'coding-backups');
const MAX = 1024 * 1024;
const MAX_BACKUP = 50 * 1024 * 1024;
const TEXT_EXT = /\.(js|mjs|cjs|ts|tsx|jsx|py|html?|css|scss|json|jsonc|md|markdown|txt|xml|svg|yml|yaml|toml|ini|cfg|conf|sql|sh|ps1|bat|cmd|c|h|cc|cpp|hpp|cs|java|go|rs|php|rb|lua|gd|gitignore|env|properties|svelte|vue)$/i;
const SKIP = new Set(['$recycle.bin', 'system volume information', 'recovery', 'windows.old']);
const cleanPath = p => path.resolve(String(p || ''));
async function canonicalTarget(p) {
  const target = cleanPath(p), parent = await fs.promises.realpath(path.dirname(target));
  return path.join(parent, path.basename(target));
}
function protectedPath(p) {
  const s = path.resolve(p).toLowerCase(), root = path.parse(s).root.toLowerCase();
  const rel = s.slice(root.length).split(path.sep).filter(Boolean);
  return ['windows', 'program files', 'program files (x86)', 'programdata', 'system volume information', '$recycle.bin', 'recovery'].includes(rel[0] || '');
}
function backup(p) {
  try {
    const st = fs.statSync(p); if (!st.isFile() || st.size > MAX_BACKUP) return false;
    const key = crypto.createHash('sha256').update(path.resolve(p).toLowerCase()).digest('hex');
    const dir = path.join(BACKUP, key); fs.mkdirSync(dir, { recursive: true });
    const stamp = Date.now() + '-' + path.basename(p); fs.copyFileSync(p, path.join(dir, stamp), fs.constants.COPYFILE_EXCL);
    return true;
  } catch (_) { return false; }
}
function roots() {
  const home = os.homedir(), out = [{ path: home, name: 'Home · ' + path.basename(home) }], drive = path.parse(process.cwd()).root;
  if (drive && !out.some(x => x.path.toLowerCase() === drive.toLowerCase())) out.push({ path: drive, name: process.platform === 'win32' ? drive : 'Computer' });
  return out;
}
async function list(dir, offset = 0, limit = 250, filter = '') {
  const p = cleanPath(dir || os.homedir());
  try {
    const real = await fs.promises.realpath(p), st = await fs.promises.stat(real);
    if (!st.isDirectory()) return { error: 'Choose a folder.' };
    const ents = await fs.promises.readdir(real, { withFileTypes: true });
    let rows = ents.filter(e => e && e.name && !e.isSymbolicLink() && !SKIP.has(e.name.toLowerCase())).map(e => {
      const isDir = e.isDirectory(), full = path.join(real, e.name);
      return { name: e.name, path: full, dir: isDir, size: null, mtime: 0, editable: !isDir && TEXT_EXT.test(e.name), protected: protectedPath(full) };
    });
    const needle = String(filter || '').trim().toLowerCase(); if (needle) rows = rows.filter(x => x.name.toLowerCase().includes(needle));
    rows.sort((a, b) => a.dir === b.dir ? a.name.localeCompare(b.name) : a.dir ? -1 : 1);
    const start = Math.max(0, Number(offset) || 0), take = Math.min(500, Math.max(25, Number(limit) || 250));
    const page = rows.slice(start, start + take);
    return { path: real, parent: path.dirname(real) === real ? '' : path.dirname(real), entries: page, total: rows.length, offset: start, more: start + take < rows.length };
  } catch (e) { return { error: 'This folder cannot be opened: ' + (e.code === 'EACCES' ? 'access denied.' : String(e.message || e)) }; }
}
async function read(file) {
  const p = cleanPath(file);
  try {
    const real = await fs.promises.realpath(p), st = await fs.promises.stat(real);
    if (!st.isFile() || !TEXT_EXT.test(real)) return { error: 'This file type is not editable as text.' };
    if (st.size > MAX) return { error: 'This file is larger than 1 MB; open a smaller text file.' };
    const text = await fs.promises.readFile(real, 'utf8');
    if (text.includes('\0')) return { error: 'This looks like a binary file and cannot be edited as text.' };
    return { path: real, text, mtime: st.mtimeMs };
  } catch (e) { return { error: 'This file cannot be opened: ' + String(e.message || e) }; }
}
async function save(file, text, expectedMtime) {
  const p = cleanPath(file), body = String(text == null ? '' : text);
  if (body.length > MAX) return { error: 'This file is larger than the 1 MB editing limit.' };
  try {
    const real = await fs.promises.realpath(p), st = await fs.promises.stat(real);
    if (!st.isFile() || !TEXT_EXT.test(real)) return { error: 'This file type cannot be saved as text.' };
    if (protectedPath(real)) return { error: 'Windows and system folders are read-only here.' };
    if (st.size > MAX) return { error: 'The file grew beyond the 1 MB editing limit. Reopen it before editing.' };
    if (expectedMtime && Math.abs(st.mtimeMs - Number(expectedMtime)) > 1) return { error: 'This file changed on disk since you opened it. Reopen it before saving so newer edits are not overwritten.' };
    const valid = check(real, body); if (valid.error) return valid;
    const savedBackup = backup(real), tmpPath = real + '.mnd-tmp';
    await fs.promises.writeFile(tmpPath, body);
    await fs.promises.rename(tmpPath, real);
    return { ok: true, path: real, backedUp: savedBackup, mtime: (await fs.promises.stat(real)).mtimeMs };
  } catch (e) { return { error: 'The file could not be saved: ' + String(e.message || e) }; }
}
function check(file, text) {
  if (!/\.(m?js|cjs)$/i.test(String(file || ''))) return { ok: true, checked: false };
  const tmp = path.join(os.tmpdir(), 'mnd-code-' + Date.now() + '-' + process.pid + '.js');
  try {
    fs.writeFileSync(tmp, String(text == null ? '' : text));
    const cp = require('child_process'), r = cp.spawnSync(process.execPath, ['--check', tmp], { encoding: 'utf8', windowsHide: true, timeout: 15000 });
    try { fs.unlinkSync(tmp); } catch (_) {}
    if (r.status === 0) return { ok: true, checked: true };
    const lines = String(r.stderr || r.stdout || '').split(/\r?\n/).filter(Boolean);
    return { error: 'JavaScript syntax check failed: ' + lines.slice(0, 2).join(' ') };
  } catch (e) { try { fs.unlinkSync(tmp); } catch (_) {} return { error: 'Could not check the file: ' + String(e.message || e) }; }
}
async function create(file, text = '') {
  const p = cleanPath(file), body = String(text);
  if (!TEXT_EXT.test(p)) return { error: 'Use a supported text or source-code file extension.' };
  if (body.length > MAX) return { error: 'The new file is larger than the 1 MB editing limit.' };
  try { const dest = await canonicalTarget(p); if (protectedPath(dest)) return { error: 'Windows and system folders are read-only here.' }; await fs.promises.writeFile(dest, body, { flag: 'wx' }); return { ok: true, path: dest }; }
  catch (e) { return { error: 'The file could not be created: ' + String(e.message || e) }; }
}
async function mkdir(dir) {
  const p = cleanPath(dir);
  try { const dest = await canonicalTarget(p); if (protectedPath(dest)) return { error: 'Windows and system folders are read-only here.' }; await fs.promises.mkdir(dest); return { ok: true, path: dest }; } catch (e) { return { error: 'The folder could not be created: ' + String(e.message || e) }; }
}
async function remove(file) {
  const p = cleanPath(file);
  try { const real = await fs.promises.realpath(p), st = await fs.promises.stat(real); if (!st.isFile()) return { error: 'Choose a file, not a folder.' }; if (protectedPath(real)) return { error: 'Windows and system folders are read-only here.' }; const backedUp = backup(real); if (!backedUp) return { error: 'A backup could not be made, so the file was left untouched (backups are limited to 50 MB).' }; await fs.promises.unlink(real); return { ok: true, backedUp }; }
  catch (e) { return { error: 'The file could not be removed: ' + String(e.message || e) }; }
}
async function move(file, to) {
  const src = cleanPath(file), dst = cleanPath(to);
  try {
    const real = await fs.promises.realpath(src), st = await fs.promises.stat(real);
    if (!st.isFile()) return { error: 'Choose a file to move.' };
    const destination = await canonicalTarget(dst);
    if (protectedPath(real) || protectedPath(destination)) return { error: 'Windows and system folders are read-only here.' };
    if (fs.existsSync(destination)) return { error: 'A file with that name already exists.' };
    const backedUp = backup(real);
    try { await fs.promises.rename(real, destination); } catch (e) { if (e.code !== 'EXDEV') throw e; await fs.promises.copyFile(real, destination, fs.constants.COPYFILE_EXCL); await fs.promises.unlink(real); }
    return { ok: true, path: destination, mtime: (await fs.promises.stat(destination)).mtimeMs, backedUp };
  } catch (e) { return { error: 'The file could not be moved: ' + String(e.message || e) }; }
}
/* 📊 Line, character and file counts for the folder open in Coding. It never goes above the folder asked for, skips the
   usual junk (node_modules, .git, build output, Windows) and stops after a few seconds, saying so when it stopped early. */
const statsLib = require('./code-stats');
const STAT_SKIP = new Set([...statsLib.SKIP_DIRS, ...SKIP]);
const STAT_TTL = 8000, statCache = new Map();
async function stats(dir, deep, force) {
  const p = cleanPath(dir || os.homedir());
  try {
    const real = await fs.promises.realpath(p), st = await fs.promises.stat(real);
    if (!st.isDirectory()) return { error: 'Choose a folder.' };
    if (protectedPath(real)) return { error: 'Windows and system folders are not measured here.' };
    const key = real.toLowerCase() + '|' + (deep ? 'deep' : 'top');
    const hit = statCache.get(key);
    if (!force && hit && Date.now() - hit.at < STAT_TTL) return hit.value;
    const value = await statsLib.walk(real, { deep: !!deep, textExt: TEXT_EXT, skip: STAT_SKIP });
    statCache.set(key, { at: Date.now(), value });
    return value;
  } catch (e) { return { error: 'This folder cannot be measured: ' + String(e.message || e) }; }
}

module.exports = { roots, list, read, save, check, create, mkdir, remove, move, stats, MAX };

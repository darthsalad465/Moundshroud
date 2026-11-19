// Syncs local Ollama GGUF models into LM Studio's models folder using zero-copy NTFS hardlinks,
// so any model pulled or created in Ollama appears in LM Studio immediately without doubling disk usage.
const fs = require('fs'), os = require('os'), path = require('path');
const U = require('./util');

const DEFAULT_DATA = path.join(__dirname, '..', 'data');
const CFG_FILE = 'lmstudio-sync.json';
const GGUF_MAGIC = Buffer.from('GGUF');

let dataDir = DEFAULT_DATA;
let watchers = [];
let debounceTimer = null;
let retryTimer = null;
let lastResult = { ok: false, synced: 0, linked: 0, skipped: 0, at: 0, targetDir: '', installed: false };

function setData(d) { if (d) dataDir = d; }

function readCfg(dir) {
  const d = dir || dataDir;
  const j = U.readJson(path.join(d, CFG_FILE), null);
  return { enabled: !(j && j.enabled === false) };
}

function setEnabled(on, dir) {
  const d = dir || dataDir;
  const enabled = !!on;
  try { fs.mkdirSync(d, { recursive: true }); U.writeJson(path.join(d, CFG_FILE), { enabled }); } catch (e) { }
  if (enabled) { startWatcher(); syncAll(); }
  else stopWatcher();
  return status();
}

function defaultOllamaDir() {
  const env = process.env.OLLAMA_MODELS && process.env.OLLAMA_MODELS.trim();
  if (env && fs.existsSync(env)) return env;
  return path.join(os.homedir(), '.ollama', 'models');
}

function defaultLmModelsDir() {
  const home = os.homedir();
  const base = path.join(home, '.lmstudio');
  try {
    const cfg = JSON.parse(fs.readFileSync(path.join(base, 'settings.json'), 'utf8'));
    if (cfg && typeof cfg.downloadsFolder === 'string' && cfg.downloadsFolder.trim()) {
      return cfg.downloadsFolder.trim();
    }
  } catch (e) { }
  const primary = path.join(base, 'models');
  if (fs.existsSync(primary) || fs.existsSync(base)) return primary;
  const legacy = path.join(home, '.cache', 'lm-studio', 'models');
  if (fs.existsSync(legacy)) return legacy;
  return '';
}

function isGgufFile(file) {
  let fd = null;
  try {
    fd = fs.openSync(file, 'r');
    const buf = Buffer.alloc(4);
    const n = fs.readSync(fd, buf, 0, 4, 0);
    return n === 4 && buf.equals(GGUF_MAGIC);
  } catch (e) {
    return false;
  } finally {
    if (fd !== null) try { fs.closeSync(fd); } catch (e) { }
  }
}

function slugFromParts(ns, model, tag) {
  const raw = String(ns || '').toLowerCase() === 'library'
    ? (model + '-' + tag)
    : (ns + '-' + model + '-' + tag);
  return raw.toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '');
}

function slugFromName(name) {
  let s = String(name || '').trim();
  if (!s) return '';
  let tag = 'latest';
  const ci = s.lastIndexOf(':');
  if (ci > 0 && !s.slice(ci + 1).includes('/')) { tag = s.slice(ci + 1) || 'latest'; s = s.slice(0, ci); }
  const parts = s.split('/').filter(Boolean);
  if (parts.length === 1) return slugFromParts('library', parts[0], tag);
  if (parts.length === 2) return slugFromParts(parts[0], parts[1], tag);
  return slugFromParts(parts[1], parts.slice(2).join('-'), tag);
}

const isAgentCopy = slug => /-agent(?:-\d+k)?(?:-latest)?$/i.test(String(slug || ''));

function blobPathOf(blobsDir, digest) {
  const m = /^sha256:([0-9a-f]{64})$/i.exec(String(digest || '').trim());
  if (!m) return '';
  return path.join(blobsDir, 'sha256-' + m[1].toLowerCase());
}

/* Read an Ollama manifest (supports both direct v2 manifests and manifests-v2 manifest lists). */
function resolveManifest(manifestFile, blobsDir) {
  let j;
  try { j = JSON.parse(fs.readFileSync(manifestFile, 'utf8')); } catch (e) { return { incomplete: true }; }
  if (!j || typeof j !== 'object') return { incomplete: true };

  if (j.mediaType === 'application/vnd.ollama.manifest.list.v2+json' && Array.isArray(j.manifests)) {
    const pick = j.manifests.find(m => m && (m.format === 'gguf' || m.runner === 'llamacpp')) || j.manifests[0];
    if (!pick || !pick.digest) return { skip: true };
    const inner = blobPathOf(blobsDir, pick.digest);
    if (!inner || !fs.existsSync(inner)) return { incomplete: true };
    try { j = JSON.parse(fs.readFileSync(inner, 'utf8')); } catch (e) { return { incomplete: true }; }
  }

  const layers = Array.isArray(j.layers) ? j.layers : [];
  const modelLayer = layers.find(l => l && l.mediaType === 'application/vnd.ollama.image.model' && l.digest);
  if (!modelLayer) return { skip: true };
  const modelBlob = blobPathOf(blobsDir, modelLayer.digest);
  if (!modelBlob || !fs.existsSync(modelBlob)) return { incomplete: true };
  if (!isGgufFile(modelBlob)) return { skip: true };

  const projLayer = layers.find(l => l && l.mediaType === 'application/vnd.ollama.image.projector' && l.digest);
  let projBlob = '';
  if (projLayer) {
    const cand = blobPathOf(blobsDir, projLayer.digest);
    if (cand && fs.existsSync(cand) && isGgufFile(cand)) projBlob = cand;
  }
  return { modelBlob, projBlob };
}

function collectManifests(ollamaDir) {
  const out = [];
  const seen = new Set();
  for (const sub of ['manifests-v2', 'manifests']) {
    const root = path.join(ollamaDir, sub);
    if (!fs.existsSync(root)) continue;
    const walk = (dir, rel) => {
      let entries;
      try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return; }
      for (const e of entries) {
        const full = path.join(dir, e.name);
        const next = rel.concat(e.name);
        if (e.isDirectory()) { walk(full, next); continue; }
        if (!e.isFile() || next.length < 4) continue;
        const ns = next[1], model = next.slice(2, -1).join('-'), tag = next[next.length - 1];
        const slug = slugFromParts(ns, model, tag);
        if (!slug || seen.has(slug)) continue;
        seen.add(slug);
        out.push({ slug, file: full, source: sub });
      }
    };
    walk(root, []);
  }
  return out;
}

function sameFile(a, b) {
  try {
    const sa = fs.statSync(a, { bigint: true });
    const sb = fs.statSync(b, { bigint: true });
    return !!(sa.ino && sb.ino && sa.dev === sb.dev && sa.ino === sb.ino);
  } catch (e) {
    return false;
  }
}

/* Check if dest already matches src (either same NTFS file via hardlink, symlink target, or exact fallback copy). */
function alreadySynced(src, dest, allowCopyMatch) {
  if (sameFile(src, dest)) return true;
  try {
    const st = fs.lstatSync(dest);
    if (st.isSymbolicLink()) {
      return path.resolve(path.dirname(dest), fs.readlinkSync(dest)) === path.resolve(src);
    }
    if (allowCopyMatch && st.isFile()) {
      const ss = fs.statSync(src);
      return st.size === ss.size && Math.abs(st.mtimeMs - ss.mtimeMs) < 2000;
    }
  } catch (e) { }
  return false;
}

/* Link src -> dest with zero extra disk space (NTFS hardlink); falls back to symlink or copy if needed. */
function linkOrCopy(src, dest) {
  if (alreadySynced(src, dest, false)) return 'unchanged';
  let hadPrev = false, prevSameCopy = false;
  try {
    const st = fs.lstatSync(dest);
    hadPrev = true;
    if (st.isFile()) {
      const ss = fs.statSync(src);
      prevSameCopy = st.size === ss.size && Math.abs(st.mtimeMs - ss.mtimeMs) < 2000;
    }
  } catch (e) { }

  const tmpDest = dest + '.tmp' + process.pid;
  try { fs.unlinkSync(tmpDest); } catch (e) { }
  try {
    fs.linkSync(src, tmpDest);
    if (hadPrev) try { fs.unlinkSync(dest); } catch (e) { }
    fs.renameSync(tmpDest, dest);
    return 'linked';
  } catch (e) {
    try { fs.unlinkSync(tmpDest); } catch (e0) { }
    if (e.code === 'EXDEV' || e.code === 'EPERM' || e.code === 'EACCES' || e.code === 'ENOTSUP') {
      try {
        fs.symlinkSync(src, tmpDest, 'file');
        if (hadPrev) try { fs.unlinkSync(dest); } catch (e1) { }
        fs.renameSync(tmpDest, dest);
        return 'linked';
      } catch (e2) { try { fs.unlinkSync(tmpDest); } catch (e0) { } }
      if (prevSameCopy) return 'unchanged';
      try {
        fs.copyFileSync(src, dest);
        const ss = fs.statSync(src);
        try { fs.utimesSync(dest, ss.atime, ss.mtime); } catch (e4) { }
        return 'linked';
      } catch (e3) { return 'error'; }
    }
    return 'error';
  }
}

function syncAll(opts) {
  opts = opts || {};
  const force = !!opts.force;
  if (!force && !opts.ollamaDir && !opts.lmModelsDir && !readCfg(opts.dataDir).enabled) {
    return Object.assign({}, lastResult, { ok: true, disabled: true });
  }
  const ollamaDir = opts.ollamaDir || defaultOllamaDir();
  const lmModelsDir = opts.lmModelsDir || defaultLmModelsDir();
  const installed = !!(lmModelsDir && fs.existsSync(path.dirname(lmModelsDir)));
  if (!ollamaDir || !fs.existsSync(ollamaDir) || !lmModelsDir || !installed) {
    const r = { ok: true, installed, synced: 0, linked: 0, skipped: 0, added: [], at: Date.now(), targetDir: lmModelsDir ? path.join(lmModelsDir, 'ollama') : '' };
    if (!opts.ollamaDir) lastResult = r;
    return r;
  }

  const blobsDir = path.join(ollamaDir, 'blobs');
  const targetRoot = path.join(lmModelsDir, 'ollama');
  try { fs.mkdirSync(targetRoot, { recursive: true }); } catch (e) {
    return { ok: false, installed, error: 'Could not create ' + targetRoot + ': ' + e.message, synced: 0, linked: 0, skipped: 0, added: [], at: Date.now(), targetDir: targetRoot };
  }

  const manifests = collectManifests(ollamaDir);
  let synced = 0, linked = 0, skipped = 0, incomplete = 0;
  const added = [];

  for (const m of manifests) {
    if (!opts.includeAgentCopies && isAgentCopy(m.slug)) { skipped++; continue; }
    const info = resolveManifest(m.file, blobsDir);
    if (info.incomplete) { incomplete++; continue; }
    if (info.skip || !info.modelBlob) { skipped++; continue; }

    const dir = path.join(targetRoot, m.slug);
    try { fs.mkdirSync(dir, { recursive: true }); } catch (e) { continue; }

    const mainDest = path.join(dir, m.slug + '.gguf');
    const rMain = linkOrCopy(info.modelBlob, mainDest);
    if (rMain === 'error') continue;
    synced++;
    let changed = rMain === 'linked';

    if (info.projBlob) {
      const projDest = path.join(dir, 'mmproj-' + m.slug + '.gguf');
      const rProj = linkOrCopy(info.projBlob, projDest);
      if (rProj === 'linked') changed = true;
    }
    if (changed) { linked++; added.push(m.slug); }
  }

  const res = { ok: true, installed: true, synced, linked, skipped, incomplete, added, at: Date.now(), targetDir: targetRoot };
  if (!opts.ollamaDir) lastResult = res;
  if (incomplete > 0 && !opts.ollamaDir && !retryTimer) {
    retryTimer = setTimeout(() => { retryTimer = null; try { syncAll(); } catch (e) { } }, 2500);
    if (retryTimer.unref) retryTimer.unref();
  }
  return res;
}

function removeModel(name, opts) {
  opts = opts || {};
  const lmModelsDir = opts.lmModelsDir || defaultLmModelsDir();
  const slug = slugFromName(name);
  if (!lmModelsDir || !slug) return { ok: false };
  const dir = path.join(lmModelsDir, 'ollama', slug);
  try {
    if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
    return { ok: true, slug };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

function scheduleSync() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => { debounceTimer = null; try { syncAll(); } catch (e) { } }, 800);
  if (debounceTimer.unref) debounceTimer.unref();
}

function startWatcher(opts) {
  stopWatcher();
  opts = opts || {};
  if (!readCfg(opts.dataDir).enabled) return false;
  const ollamaDir = opts.ollamaDir || defaultOllamaDir();
  const lmModelsDir = opts.lmModelsDir || defaultLmModelsDir();
  if (!ollamaDir || !fs.existsSync(ollamaDir) || !lmModelsDir || !fs.existsSync(path.dirname(lmModelsDir))) return false;

  /* initial catch-up sync (e.g. models pulled while Moundshroud was closed) */
  try { syncAll(opts); } catch (e) { }

  const dirs = ['manifests-v2', 'manifests'].map(s => path.join(ollamaDir, s)).filter(d => fs.existsSync(d));
  if (!dirs.length) dirs.push(ollamaDir);
  for (const d of dirs) {
    try {
      const w = fs.watch(d, { recursive: true, persistent: false }, () => scheduleSync());
      w.on('error', () => { });
      watchers.push(w);
    } catch (e) { }
  }
  return watchers.length > 0;
}

function stopWatcher() {
  clearTimeout(debounceTimer); debounceTimer = null;
  clearTimeout(retryTimer); retryTimer = null;
  for (const w of watchers) { try { w.close(); } catch (e) { } }
  watchers = [];
}

function status() {
  const cfg = readCfg();
  const lmDir = defaultLmModelsDir();
  const installed = !!(lmDir && fs.existsSync(path.dirname(lmDir)));
  return Object.assign({}, lastResult, {
    enabled: cfg.enabled,
    installed,
    watching: watchers.length > 0,
    targetDir: lmDir ? path.join(lmDir, 'ollama') : '',
  });
}

module.exports = {
  syncAll, removeModel, startWatcher, stopWatcher, status, setEnabled, setData,
  slugFromParts, slugFromName, isAgentCopy, resolveManifest, defaultOllamaDir, defaultLmModelsDir,
};

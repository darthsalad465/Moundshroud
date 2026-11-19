// Model ordering: largest first by default, or the user's chosen default model (Settings > AI & power) pinned first.
const path = require('path'), U = require('./util');

const FILE = 'default-model.json';
const bare = n => String(n || '').replace(/:latest$/, '');

/* fallback size estimate from model name/label (e.g. "70b", "8x7b", "e4b", "135m") when byte size is unavailable */
function paramScore(s) {
  const t = String(s || '');
  const mx = /\b(\d+(?:\.\d+)?)\s*x\s*(\d+(?:\.\d+)?)\s*b\b/i.exec(t);
  if (mx) return (+mx[1]) * (+mx[2]) * 1e9;
  const b = /(?:^|[^a-z0-9])e?(\d+(?:\.\d+)?)\s*b(?![a-z0-9])/i.exec(t);
  if (b) return (+b[1]) * 1e9;
  const m = /(?:^|[^a-z0-9])(\d+(?:\.\d+)?)\s*m(?![a-z0-9])/i.exec(t);
  if (m) return (+m[1]) * 1e6;
  return 0;
}

const keyOf = m => (m && typeof m === 'object') ? String(m.name || m.id || '') : String(m || '');
const matches = (m, want) => {
  if (!want) return false;
  const k = keyOf(m);
  return k === want || bare(k) === bare(want);
};

function getDefault(dataDir) {
  if (!dataDir) return '';
  const j = U.readJson(path.join(dataDir, FILE), null);
  return (j && typeof j.model === 'string') ? j.model.trim() : '';
}

function setDefault(dataDir, model) {
  const v = String(model == null ? '' : model).trim();
  if (v && (v.length > 160 || /[\r\n\0]/.test(v))) return { ok: false, error: 'Invalid model name.' };
  if (dataDir) U.writeJson(path.join(dataDir, FILE), { model: v });
  return { ok: true, model: v };
}

/* Sort models:
   1. User's chosen default model (when set and usable, i.e. tools !== false) goes first.
   2. Local models come before cloud/free-pool models (which have size 0).
   3. Largest byte size first; when neither entry has byte size, largest parameter count first.
   4. Ties preserve original order (JS sort is stable). */
function sortModels(list, defaultModel) {
  const arr = Array.isArray(list) ? list.slice() : [];
  const def = String(defaultModel || '').trim();
  return arr.sort((a, b) => {
    const aDef = !!def && matches(a, def) && (!a || a.tools !== false);
    const bDef = !!def && matches(b, def) && (!b || b.tools !== false);
    if (aDef !== bDef) return aDef ? -1 : 1;
    const aCloud = !!(a && (a.cloud || a.free));
    const bCloud = !!(b && (b.cloud || b.free));
    if (aCloud !== bCloud) return aCloud ? 1 : -1;
    const as = +(a && a.size) || 0, bs = +(b && b.size) || 0;
    if (as !== bs) return bs - as;
    if (!as && !bs) {
      const ap = paramScore(keyOf(a) + ' ' + ((a && a.label) || ''));
      const bp = paramScore(keyOf(b) + ' ' + ((b && b.label) || ''));
      if (ap !== bp) return bp - ap;
    }
    return 0;
  });
}

module.exports = { bare, paramScore, matches, getDefault, setDefault, sortModels };

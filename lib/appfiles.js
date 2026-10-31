// The app's own source, so the AI can answer questions about Moundshroud from the real code
// instead of guessing: search the files, read one, list the folders.
// Only the project's own code and docs are reachable - never data, snapshots, profiles, models or secrets.
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
const TOP = ['server.js', 'README.md', 'VERSION', 'SNAPSHOTS.txt', 'START-HERE.txt'];
const DIRS = ['web', 'lib'];
const EXT = new Set(['.js', '.css', '.html', '.json', '.md', '.txt', '.ps1', '.cs', '.bat', '.py']);
/* folders that hold data, downloads or other people's code: never searched, never read */
const SKIP = /(^|[\\/])(node_modules|data|_snapshots|edge-profile|edge-profile2|nomad|piper|musicgen|imggen|bin|obj|\.git|piper|voice|models|cache)([\\/]|$)/i;

let cache = null, cacheAt = 0;
function walk(dir, out, depth) {
  if (depth > 5) return;
  let list; try { list = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return; }
  for (const d of list) {
    const p = path.join(dir, d.name);
    if (SKIP.test(p)) continue;
    if (d.isDirectory()) walk(p, out, depth + 1);
    else if (EXT.has(path.extname(d.name).toLowerCase())) {
      let st; try { st = fs.statSync(p); } catch (e) { continue; }
      if (st.size > 4e6) continue;                                    // a bundled library is not something to read into a prompt
      out.push({ p, rel: path.relative(ROOT, p).replace(/\\/g, '/'), size: st.size, at: st.mtimeMs });
    }
  }
}
function index() {
  const now = Date.now();
  if (cache && now - cacheAt < 30000) return cache;
  const files = [];
  for (const f of TOP) { const p = path.join(ROOT, f); if (fs.existsSync(p)) files.push({ p, rel: f, size: fs.statSync(p).size, at: 0 }); }
  for (const d of DIRS) walk(path.join(ROOT, d), files, 0);
  cache = files; cacheAt = now; return files;
}
const readText = f => { try { return fs.readFileSync(f.p, 'utf8'); } catch (e) { return ''; } };

/* what a file is about: its leading comment lines and the names it defines - enough to pick the right file */
function outline(f) {
  const t = readText(f).split('\n').slice(0, 40).join('\n'), head = [];
  for (const ln of t.split('\n')) {
    const s = ln.trim();
    if (/^(\/\/|\/\*|\*|#)/.test(s)) head.push(s.replace(/^(\/\/+|\/\*+|\*+|#+)\s?/, '').replace(/\*\/$/, '').trim());
    else if (head.length) break;
    if (head.join(' ').length > 240) break;
  }
  return head.filter(Boolean).join(' ').slice(0, 220);
}

const toks = q => (String(q || '').toLowerCase().match(/[a-z0-9_]{2,}/g) || []).filter(t => !['the', 'and', 'for', 'how', 'does', 'what', 'where', 'why', 'app', 'this', 'that', 'with', 'you', 'can', 'work', 'works', 'code', 'file', 'files'].includes(t));

/* text search across the app's files: whole-word-ish hits score higher, file names and outlines count too */
function search(q, n) {
  const tt = [...new Set(toks(q))].slice(0, 8); if (!tt.length) return [];
  const hits = [];
  for (const f of index()) {
    const text = readText(f); if (!text) continue;
    const low = text.toLowerCase(), name = f.rel.toLowerCase(), head = outline(f).toLowerCase();
    let score = 0; for (const t of tt) { if (name.includes(t)) score += 6; if (head.includes(t)) score += 3; }
    if (!score && !tt.some(t => low.includes(t))) continue;
    const lines = low.split('\n'), rel = f.rel;
    for (let i = 0; i < lines.length; i++) {
      let s = 0; for (const t of tt) if (lines[i].includes(t)) s += 2;
      if (!s) continue;
      for (const t of tt) if (new RegExp('\\b' + t + '\\b').test(lines[i])) s += 1;
      hits.push({ path: rel, line: i + 1, score: s, text: text.split('\n')[i].trim().slice(0, 200) });
    }
    if (score) hits.push({ path: rel, line: 0, score, text: outline(f) || rel });
  }
  return hits.sort((a, b) => b.score - a.score || a.path.localeCompare(b.path)).slice(0, Math.max(1, Math.min(30, n || 12)));
}

/* a few files that look relevant, with the matched lines grouped, ready to put in a prompt */
function context(q, n) {
  const hits = search(q, 40), by = new Map();
  for (const h of hits) { const e = by.get(h.path) || { path: h.path, lines: [], score: 0 }; e.score += h.score; if (h.line && e.lines.length < 6) e.lines.push(h.line + ': ' + h.text); by.set(h.path, e); }
  const out = [...by.values()].sort((a, b) => b.score - a.score).slice(0, n || 4);
  return out.map(f => {
    const meta = index().find(x => x.rel === f.path) || {};
    return 'FILE ' + f.path + (meta.size ? ' (' + Math.round(meta.size / 1024) + ' KB)' : '') + '\n' + (outline(meta) || '') + '\n' + f.lines.join('\n');
  }).join('\n\n');
}

function safe(rel) {
  const p = path.normalize(path.join(ROOT, String(rel || '').replace(/^[\\/]+/, '')));
  const inside = path.relative(ROOT, p);
  if (!inside || inside.startsWith('..') || path.isAbsolute(inside) || SKIP.test(p)) return null;
  if (!fs.existsSync(p) || !fs.statSync(p).isFile()) return null;
  if (!EXT.has(path.extname(p).toLowerCase())) return null;
  return p;
}
function read(rel, max) {
  const p = safe(rel); if (!p) return null;
  const text = readText({ p }); if (!text) return null;
  return { path: path.relative(ROOT, p).replace(/\\/g, '/'), text: text.slice(0, Math.max(500, Math.min(40000, max || 12000))) };
}
function list(dir) {
  const rel = String(dir || '').replace(/^[\\/]+|\\.\\.+/g, '');
  return index().filter(f => !rel || f.rel.startsWith(rel)).map(f => f.rel).slice(0, 400);
}
module.exports = { search, context, read, list, outline: rel => { const p = safe(rel); return p ? outline({ p, rel }) : null; } };

// /find in Moundshroud Code: search the project by meaning with an embedding model that runs in Ollama.
// The project's text files are cut into short pieces, each piece and the question become vectors (Ollama's
// /api/embed), and the pieces closest to the question come back with their file and line. Vectors are kept for the
// session, keyed by file and time changed, so a second search only reads what changed. Nothing leaves this PC.
const fs = require('fs'), path = require('path'), http = require('http');

const TEXT = /\.(js|mjs|cjs|ts|tsx|jsx|py|rb|go|rs|java|kt|cs|c|h|cpp|hpp|php|swift|lua|sh|ps1|bat|cmd|html|css|scss|json|md|txt|yml|yaml|toml|ini|sql|vue|svelte|xml)$/i;
const SKIP = /^(node_modules|\.git|dist|build|out|coverage|\.next|\.cache|vendor|__pycache__|\.venv|venv|target|bin|obj|_snapshots)$/i;
const LINES = 40, MAX_FILES = 400, MAX_PIECES = 1200, MAX_BYTES = 300000, BATCH = 32;
const memo = new Map();             // "model|file|mtime" -> [{ line, text, vec }]

function embed(model, input) {
  return new Promise(res => {
    const body = JSON.stringify({ model, input });
    const r = http.request({ host: '127.0.0.1', port: 11434, path: '/api/embed', method: 'POST', timeout: 120000, headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } }, rs => {
      let b = ''; rs.on('data', c => { b += c; });
      rs.on('end', () => { try { const j = JSON.parse(b); res(j.embeddings ? { ok: true, vecs: j.embeddings } : { ok: false, error: j.error || 'Ollama gave no vectors' }); } catch (e) { res({ ok: false, error: 'Ollama answered with something unreadable' }); } });
    });
    r.on('error', e => res({ ok: false, error: 'Ollama is not answering (' + e.message + ')' }));
    r.on('timeout', () => { r.destroy(); res({ ok: false, error: 'Ollama took too long' }); });
    r.end(body);
  });
}
function cosine(a, b) {
  let d = 0, x = 0, y = 0;
  for (let i = 0; i < a.length && i < b.length; i++) { d += a[i] * b[i]; x += a[i] * a[i]; y += b[i] * b[i]; }
  return x && y ? d / Math.sqrt(x * y) : 0;
}
/* the project's text files, small ones first-come, skipping build output and dependencies (uses fd.exe when available) */
function files(dir) {
  try {
    const mt = require('./microtools');
    const fr = mt.fdFind(dir, '.', { type: 'f', max: MAX_FILES * 2, maxDepth: 8 });
    if (fr && fr.ok && fr.files.length) {
      const fast = [];
      for (const item of fr.files) {
        if (fast.length >= MAX_FILES) break;
        const name = path.basename(item.file);
        if (!TEXT.test(name)) continue;
        try { const st = fs.statSync(item.file); if (st.size > 0 && st.size <= MAX_BYTES) fast.push({ file: item.file, mtime: st.mtimeMs }); } catch (x) { }
      }
      if (fast.length) return fast;
    }
  } catch (e) { }
  const out = [];
  const go = (d, depth) => {
    if (out.length >= MAX_FILES || depth > 8) return;
    let es; try { es = fs.readdirSync(d, { withFileTypes: true }); } catch (e) { return; }
    for (const e of es) {
      if (out.length >= MAX_FILES) return;
      const p = path.join(d, e.name);
      if (e.isDirectory()) { if (!SKIP.test(e.name) && !e.name.startsWith('.')) go(p, depth + 1); }
      else if (e.isFile() && TEXT.test(e.name)) { try { const st = fs.statSync(p); if (st.size > 0 && st.size <= MAX_BYTES) out.push({ file: p, mtime: st.mtimeMs }); } catch (x) { } }
    }
  };
  go(dir, 0);
  return out;
}
function pieces(file) {
  let text; try { text = fs.readFileSync(file, 'utf8'); } catch (e) { return []; }
  if (/\u0000/.test(text.slice(0, 2000))) return [];
  const lines = text.split(/\r?\n/), out = [];
  for (let i = 0; i < lines.length; i += LINES) {
    const chunk = lines.slice(i, i + LINES).join('\n').trim();
    if (chunk.length > 20) out.push({ line: i + 1, text: chunk.slice(0, 2000) });
  }
  return out;
}

/* search(dir, query, model, onNote) -> { ok, hits: [{ file, rel, line, score, preview }], pieces, files } */
async function search(dir, query, model, onNote) {
  const say = t => { try { onNote && onNote(t); } catch (e) { } };
  if (!model) return { ok: false, error: 'There is no embedding model in Ollama. /models shows any on this PC that /import can bring in.' };
  const q = String(query || '').trim(); if (!q) return { ok: false, error: 'What should it look for? /find where the settings are saved' };
  const list = files(dir);
  if (!list.length) return { ok: false, error: 'There are no text files to search in ' + dir };
  const all = [], todo = [];
  for (const f of list) {
    const key = model + '|' + f.file + '|' + f.mtime;
    if (memo.has(key)) { memo.get(key).forEach(p => all.push(Object.assign({ file: f.file }, p))); continue; }
    const ps = pieces(f.file).map(p => Object.assign({ file: f.file, key }, p));
    ps.forEach(p => todo.push(p));
    if (all.length + todo.length >= MAX_PIECES) break;
  }
  for (let i = 0; i < todo.length; i += BATCH) {
    say('reading the project · ' + Math.min(todo.length, i + BATCH) + ' of ' + todo.length + ' pieces');
    const batch = todo.slice(i, i + BATCH);
    const r = await embed(model, batch.map(p => p.text));
    if (!r.ok) return { ok: false, error: r.error };
    batch.forEach((p, k) => { p.vec = r.vecs[k]; });
  }
  const byKey = new Map();
  todo.forEach(p => { if (!byKey.has(p.key)) byKey.set(p.key, []); byKey.get(p.key).push({ line: p.line, text: p.text, vec: p.vec }); all.push(p); });
  byKey.forEach((v, k) => memo.set(k, v));
  const qv = await embed(model, [q]);
  if (!qv.ok) return { ok: false, error: qv.error };
  const hits = all.filter(p => p.vec).map(p => ({ file: p.file, rel: path.relative(dir, p.file), line: p.line, score: cosine(qv.vecs[0], p.vec), preview: (p.text.split('\n').find(l => l.trim()) || '').trim().slice(0, 100) }))
    .sort((a, b) => b.score - a.score).slice(0, 8);
  return { ok: true, hits, pieces: all.length, files: list.length };
}

module.exports = { search, cosine, files, pieces };

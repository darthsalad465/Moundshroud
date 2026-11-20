// Ultra-small native single-file tool wrappers (engines/micro/):
//   - asg017/sqlite-vec  (vec0.dll)  -> native C vector cosine distance in SQLite
//   - BurntSushi/ripgrep (rg.exe)    -> 10-50x faster folder & code text search
//   - sharkdp/fd         (fd.exe)    -> fast file discovery
//   - jqlang/jq          (jq.exe)    -> JSON query & transformation engine
const fs = require('fs'), path = require('path'), cp = require('child_process');

const ROOT = path.join(__dirname, '..');
const BIN_DIR = path.join(ROOT, 'engines', 'micro');
const BINS = {
  vec: path.join(BIN_DIR, 'vec0.dll'),
  rg: path.join(BIN_DIR, 'rg.exe'),
  fd: path.join(BIN_DIR, 'fd.exe'),
  jq: path.join(BIN_DIR, 'jq.exe'),
  sd: path.join(BIN_DIR, 'sd.exe'),
};
const exists = p => { try { return fs.existsSync(p); } catch (e) { return false; } };

function status() {
  const info = {};
  for (const [k, p] of Object.entries(BINS)) {
    const ok = exists(p);
    let bytes = 0;
    if (ok) { try { bytes = fs.statSync(p).size; } catch (e) { } }
    info[k] = { ok, path: p, bytes };
  }
  return info;
}

function vecPath() { return exists(BINS.vec) ? BINS.vec : null; }

/* Ripgrep search: returns { ok, tool: 'rg', hits: [{ file, rel, line, text }], truncated } */
function rgSearch(dir, query, opts = {}) {
  if (!exists(BINS.rg)) return { ok: false, missing: true, error: 'rg.exe is not installed.' };
  const q = String(query || '').trim();
  if (!q) return { ok: false, error: 'Type a search query first.' };
  const base = path.resolve(dir || ROOT);
  if (!exists(base)) return { ok: false, error: 'Directory not found.' };
  const max = Math.max(1, Math.min(500, +opts.max || 150));
  const args = ['--json', '--max-filesize', '512K', '--max-count', '15', '--glob', '!node_modules/**', '--glob', '!.git/**', '--glob', '!web/vendor/**', '--glob', '!data/**', '--glob', '!engines/**', '--glob', '!runtime/**'];
  if (opts.ignoreCase !== false) args.push('-i');
  if (!opts.regex) args.push('-F');
  if (opts.glob) args.push('--glob', String(opts.glob));
  args.push('--', q, base);
  const r = cp.spawnSync(BINS.rg, args, { encoding: 'utf8', windowsHide: true, timeout: 12000, maxBuffer: 8 * 1024 * 1024 });
  if (r.error) return { ok: false, error: r.error.message };
  const hits = [];
  let truncated = false;
  for (const line of String(r.stdout || '').split(/\r?\n/)) {
    if (!line) continue;
    let j; try { j = JSON.parse(line); } catch (e) { continue; }
    if (j.type !== 'match') continue;
    const f = j.data && j.data.path && j.data.path.text;
    const ln = j.data && j.data.line_number;
    const txt = j.data && j.data.lines && j.data.lines.text;
    if (!f) continue;
    hits.push({ file: f, rel: path.relative(base, f).split(path.sep).join('/'), line: ln || 0, text: String(txt || '').replace(/\r?\n$/, '').slice(0, 240) });
    if (hits.length >= max) { truncated = true; break; }
  }
  return { ok: true, tool: 'rg', hits, truncated };
}

/* fd fast file finder: returns { ok, tool: 'fd', files: [{ file, rel }] } */
function fdFind(dir, pattern, opts = {}) {
  if (!exists(BINS.fd)) return { ok: false, missing: true, error: 'fd.exe is not installed.' };
  const base = path.resolve(dir || ROOT);
  if (!exists(base)) return { ok: false, error: 'Directory not found.' };
  const max = Math.max(1, Math.min(500, +opts.max || 200));
  const args = ['--color', 'never', '--max-results', String(max), '--exclude', 'node_modules', '--exclude', '.git', '--exclude', 'web/vendor', '--exclude', 'data', '--exclude', 'engines', '--exclude', 'runtime'];
  if (opts.type === 'f' || opts.type === 'd') args.push('--type', opts.type);
  if (opts.ext) args.push('--extension', String(opts.ext).replace(/^\./, ''));
  if (opts.maxDepth) args.push('--max-depth', String(+opts.maxDepth));
  args.push(String(pattern || '.'), base);
  const r = cp.spawnSync(BINS.fd, args, { encoding: 'utf8', windowsHide: true, timeout: 10000, maxBuffer: 4 * 1024 * 1024 });
  if (r.error) return { ok: false, error: r.error.message };
  const files = String(r.stdout || '').split(/\r?\n/).filter(Boolean).slice(0, max).map(f => ({
    file: f,
    rel: path.relative(base, f).split(path.sep).join('/'),
  }));
  return { ok: true, tool: 'fd', files };
}

/* jq JSON query runner: safe offline stdin -> stdout, no file/env side effects */
function jqRun(jsonText, filter, opts = {}) {
  if (!exists(BINS.jq)) return { ok: false, missing: true, error: 'jq.exe is not installed.' };
  const q = String(filter || '.').trim() || '.';
  const input = String(jsonText == null ? '' : jsonText);
  if (input.length > 5 * 1024 * 1024) return { ok: false, error: 'JSON input is over the 5 MB limit.' };
  const args = [];
  if (opts.raw) args.push('-r');
  if (opts.compact) args.push('-c');
  if (opts.sortKeys) args.push('-S');
  args.push('--', q);
  const r = cp.spawnSync(BINS.jq, args, { input, encoding: 'utf8', windowsHide: true, timeout: 8000, maxBuffer: 6 * 1024 * 1024 });
  if (r.error) return { ok: false, error: r.error.message };
  if (r.status !== 0) return { ok: false, error: String(r.stderr || 'jq returned an error').trim().slice(0, 400) };
  return { ok: true, tool: 'jq', output: String(r.stdout || '') };
}

/* sd find-and-replace on text via stdin -> stdout (safe, never mutates disk files) */
function sdRun(text, find, replace, opts = {}) {
  if (!exists(BINS.sd)) return { ok: false, missing: true, error: 'sd.exe is not installed.' };
  const input = String(text == null ? '' : text);
  if (input.length > 5 * 1024 * 1024) return { ok: false, error: 'Input text is over the 5 MB limit.' };
  const pat = String(find == null ? '' : find);
  if (!pat) return { ok: false, error: 'Type a find pattern first.' };
  const args = [];
  if (opts.fixed) args.push('-F');
  if (opts.flags) args.push('-f', String(opts.flags).replace(/[^cimsw]/g, ''));
  args.push('--', pat, String(replace == null ? '' : replace));
  const r = cp.spawnSync(BINS.sd, args, { input, encoding: 'utf8', windowsHide: true, timeout: 8000, maxBuffer: 6 * 1024 * 1024 });
  if (r.error) return { ok: false, error: r.error.message };
  if (r.status !== 0) return { ok: false, error: String(r.stderr || 'sd returned an error').trim().slice(0, 400) };
  return { ok: true, tool: 'sd', output: String(r.stdout || '') };
}

module.exports = { status, vecPath, rgSearch, fdFind, jqRun, sdRun, BINS };

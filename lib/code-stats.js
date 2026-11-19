// 📊 Line, character and file counts for a folder. Used by Edit the app (the app's own source) and Coding (whatever
// folder is open). The walk is deliberately bounded: a time budget, a file limit and a depth limit, so pointing it at
// a home folder cannot freeze the app. It reads text and source files only; everything else is counted by name and size.
const fs = require('fs'), path = require('path');

const TEXT_EXT = /\.(js|mjs|cjs|jsx|ts|tsx|py|pyw|html?|css|scss|sass|less|json|jsonc|md|markdown|txt|xml|svg|yml|yaml|toml|ini|cfg|conf|sql|sh|bash|zsh|ps1|bat|cmd|c|h|cc|cpp|hpp|cs|java|kt|go|rs|php|rb|lua|gd|vue|svelte|r|pl|swift|dart|asm|s|properties|env)$/i;

/* folders that never hold the person's own source, and that would make a folder total meaningless (or very slow) */
const SKIP_DIRS = new Set([
  'node_modules', '.git', '.svn', '.hg', 'bower_components', 'vendor',
  'dist', 'build', 'out', 'target', 'obj', 'bin', 'coverage', '.cache', '.next', '.nuxt',
  '__pycache__', '.venv', 'venv', 'env', '.idea', '.vs', '.gradle', '.terraform',
  'appdata', 'application data', 'local settings',
  '$recycle.bin', 'system volume information', 'windows', 'program files', 'program files (x86)',
  'programdata', 'recovery', 'windows.old'
]);

/* One block of text: how many lines, how many characters, and which lines are code, comments or blank.
   Comment detection is the usual line-prefix rule (// # -- ; REM <!-- /* *), plus /* … *\/ blocks that carry over.
   It is a good approximation for every language this app edits, not a parser. */
function textStats(text) {
  const src = String(text == null ? '' : text);
  const rows = src.split(/\r\n|\n|\r/);
  if (rows.length && rows[rows.length - 1] === '') rows.pop();   // a final newline does not start another line
  let chars = 0, code = 0, comment = 0, blank = 0, longest = 0, inBlock = false;
  for (const row of rows) {
    chars += row.length;
    if (row.length > longest) longest = row.length;
    const t = row.trim();
    if (inBlock) {
      comment++;
      if (t.includes('*/')) inBlock = false;
      continue;
    }
    if (!t) { blank++; continue; }
    if (t.startsWith('/*')) { comment++; if (!t.includes('*/')) inBlock = true; continue; }
    if (/^(\/\/|#|--|;|\*|<!--|rem\s)/i.test(t)) { comment++; continue; }
    code++;
  }
  return { lines: rows.length, chars, code, comment, blank, longest };
}

function empty(root) {
  return {
    root, deep: false, files: 0, folders: 0, textFiles: 0, otherFiles: 0,
    chars: 0, lines: 0, codeLines: 0, commentLines: 0, blankLines: 0,
    bytes: 0, textBytes: 0, longestLine: 0, longestLineFile: '',
    skippedBig: 0, unreadable: 0, truncated: false, ms: 0, avgLine: 0, byExt: [], _ext: new Map()
  };
}

/* Walk `root` and add everything up. Options:
     deep        false counts only the files directly inside the folder (folders are still counted)
     skip        Set of folder names to pass over
     textExt     which file names are read as text
     allowDir    rel => may this folder be entered
     allowFile   rel => does this file count at all (used by Edit the app, so totals match the file tree) */
async function walk(root, opts) {
  const o = Object.assign({
    deep: true, maxDepth: 12, maxFiles: 40000, budgetMs: 6000, maxFile: 1024 * 1024,
    skip: SKIP_DIRS, textExt: TEXT_EXT, allowDir: null, allowFile: null
  }, opts || {});
  const acc = empty(root), t0 = Date.now();
  acc.deep = !!o.deep;
  const stop = () => acc.files + acc.folders >= o.maxFiles || Date.now() - t0 > o.budgetMs;

  async function dir(abs, rel, depth) {
    if (stop()) { acc.truncated = true; return; }
    let ents;
    try { ents = await fs.promises.readdir(abs, { withFileTypes: true }); }
    catch (e) { acc.unreadable++; return; }
    for (const e of ents) {
      if (stop()) { acc.truncated = true; return; }
      if (!e || !e.name || e.isSymbolicLink()) continue;
      const childRel = rel ? rel + '/' + e.name : e.name;
      const childAbs = path.join(abs, e.name);
      if (e.isDirectory()) {
        if (e.name.startsWith('.') || o.skip.has(e.name.toLowerCase())) continue;
        if (o.allowDir && !o.allowDir(childRel)) continue;
        acc.folders++;
        if (o.deep && depth < o.maxDepth) await dir(childAbs, childRel, depth + 1);
        continue;
      }
      if (!e.isFile()) continue;
      if (o.allowFile && !o.allowFile(childRel)) continue;
      acc.files++;
      let st;
      try { st = await fs.promises.stat(childAbs); } catch (x) { acc.unreadable++; continue; }
      acc.bytes += st.size;
      if (!o.textExt.test(e.name) || st.size > o.maxFile) {
        if (o.textExt.test(e.name)) acc.skippedBig++; else acc.otherFiles++;
        continue;
      }
      let text;
      try { text = await fs.promises.readFile(childAbs, 'utf8'); } catch (x) { acc.unreadable++; continue; }
      if (text.includes('\0')) { acc.otherFiles++; continue; }      // a binary file with a source extension
      acc.textFiles++;
      acc.textBytes += st.size;
      const m = textStats(text);
      acc.chars += m.chars; acc.lines += m.lines;
      acc.codeLines += m.code; acc.commentLines += m.comment; acc.blankLines += m.blank;
      if (m.longest > acc.longestLine) { acc.longestLine = m.longest; acc.longestLineFile = childRel; }
      const ext = (path.extname(e.name) || '').slice(1).toLowerCase() || 'no extension';
      const b = acc._ext.get(ext) || { ext, files: 0, lines: 0, chars: 0, bytes: 0 };
      b.files++; b.lines += m.lines; b.chars += m.chars; b.bytes += st.size;
      acc._ext.set(ext, b);
    }
  }

  await dir(root, '', 0);
  acc.ms = Date.now() - t0;
  acc.avgLine = acc.lines ? Math.round((acc.chars / acc.lines) * 10) / 10 : 0;
  acc.byExt = [...acc._ext.values()].sort((a, b) => b.lines - a.lines || b.chars - a.chars);
  delete acc._ext;
  return acc;
}

module.exports = { walk, textStats, TEXT_EXT, SKIP_DIRS };

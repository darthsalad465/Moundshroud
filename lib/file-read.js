// Read one text file the user names, so the Browser can open a local .html page and the sandbox can run a script from
// anywhere on this PC. Nothing is written, copied or executed here: it only returns the text (up to 2 MB). A bare file
// name is looked for in the usual places (Documents, Desktop, Downloads and Assistant Notes), a full path is used as is.
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');

const LIMIT = 2 * 1024 * 1024;
const TEXT = /\.(html?|xhtml|css|js|mjs|cjs|json|map|txt|md|markdown|xml|svg|yml|yaml|csv|tsv|ini|cfg|conf|toml|log|sh|bash|ps1|bat|cmd|py|pyw|c|h|cpp|cc|cxx|hpp|cs|fs|vb|rs|go|java|kt|swift|php|rb|lua|pl|awk|sed|asm|sql|lisp|clj|erl|ex|exs|ml|r|jl|pas|cob|d|cr|scala|dart|wat|bf|hs|zig|nim)$/i;
const MAX_DEPTH = 4;
const MAX_ENTRIES = 8000;

function home() { return os.homedir(); }
function roots() {
  const h = home(), list = [path.join(h, 'Documents'), path.join(h, 'OneDrive', 'Documents'), path.join(h, 'Desktop'), path.join(h, 'OneDrive', 'Desktop'), path.join(h, 'Downloads')];
  list.push(path.join(list[0], 'Assistant Notes'));
  return [...new Set(list)].filter(p => { try { return fs.statSync(p).isDirectory(); } catch (e) { return false; } });
}

/* the first file with this bare name inside the usual folders, breadth first */
function findByName(name) {
  const target = name.toLowerCase();
  let seen = 0;
  for (const root of roots()) {
    const queue = [{ dir: root, depth: 0 }];
    while (queue.length) {
      const { dir, depth } = queue.shift();
      let entries;
      try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { continue; }
      for (const e of entries) {
        if (++seen > MAX_ENTRIES) return null;
        if (e.name.startsWith('.') || /^(node_modules|__pycache__|\$RECYCLE\.BIN)$/i.test(e.name)) continue;
        const full = path.join(dir, e.name);
        if (e.isFile() && e.name.toLowerCase() === target) return full;
        if (e.isDirectory() && depth < MAX_DEPTH) queue.push({ dir: full, depth: depth + 1 });
      }
    }
  }
  return null;
}

function read(input) {
  let p = String(input || '').trim().replace(/^["']|["']$/g, '').trim();
  if (!p) return { error: 'Type the name of a file to open.' };
  if (!path.isAbsolute(p) && /^file:\/\//i.test(p)) { try { p = require('url').fileURLToPath(p); } catch (e) { return { error: 'That is not a file path.' }; } }
  const abs = path.isAbsolute(p) ? p : findByName(p);
  if (!abs) return { error: 'Could not find “' + path.basename(p) + '”. Looked in Documents, Desktop, Downloads and Assistant Notes. A full path works too.' };
  let st;
  try { st = fs.statSync(abs); } catch (e) { return { error: 'That file does not exist: ' + abs }; }
  if (!st.isFile()) return { error: 'That is a folder, not a file: ' + abs };
  if (st.size > LIMIT) return { error: 'That file is larger than 2 MB.' };
  if (!TEXT.test(abs)) return { error: 'Only text files can open here (HTML, CSS, JavaScript, Python, Markdown and similar).' };
  let text;
  try { text = fs.readFileSync(abs, 'utf8'); } catch (e) { return { error: 'Could not read the file: ' + e.message }; }
  return { name: path.basename(abs), path: abs, text: text.slice(0, LIMIT), size: st.size, mtime: Math.floor(st.mtimeMs) };
}

module.exports = { read, findByName, isText: p => TEXT.test(String(p || '')) };

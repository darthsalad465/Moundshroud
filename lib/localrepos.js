// Repositories on this PC: finds the folders that hold a .git, so Tools › Repositories can list them, look inside them
// and open them in File Explorer. Folders are only read; nothing is installed, changed or run.
const fs = require('fs'), path = require('path'), os = require('os'), cp = require('child_process');

const ROOT = path.join(__dirname, '..'), FILE = path.join(ROOT, 'data', 'localrepos.json');
/* the scan is deliberately bounded: a few seconds and a few thousand folders, so it never feels like the app hung. */
const MAX_DEPTH = 5, MAX_DIRS = 40000, BUDGET = 8000;
const SKIP = new Set([
  'node_modules', 'bower_components', 'jspm_packages', 'vendor', 'venv', 'env', 'dist', 'build', 'out', 'target',
  'coverage', 'obj', 'bin', 'appdata', 'application data', 'local settings', 'library', 'applications', 'music',
  'pictures', 'videos', 'onedrive', 'windows', 'program files', 'program files (x86)', 'programdata', '$recycle.bin',
  'system volume information', 'recovery', 'windows.old', 'site-packages', '__pycache__', 'desktop-profile',
  'edge-profile', 'chrome-profile', 'browser-profile'
]);

function readCfg() {
  try {
    const j = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    return {
      roots: Array.isArray(j.roots) ? j.roots.filter(x => typeof x === 'string' && x.trim()) : [],
      at: Number(j.at) || 0,
      repos: Array.isArray(j.repos) ? j.repos.filter(x => x && x.path) : [],
      truncated: !!j.truncated
    };
  } catch (e) { return { roots: [], at: 0, repos: [], truncated: false }; }
}
function writeCfg(c) {
  try {
    fs.mkdirSync(path.dirname(FILE), { recursive: true });
    const tmp = FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(c));
    fs.renameSync(tmp, FILE);
  } catch (e) { }
}

const same = (a, b) => path.resolve(a).replace(/[\\/]+$/, '').toLowerCase() === path.resolve(b).replace(/[\\/]+$/, '').toLowerCase();
const inside = (p, root) => {
  const a = path.resolve(p).toLowerCase(), b = path.resolve(root).replace(/[\\/]+$/, '').toLowerCase();
  return a === b || a.startsWith(b + path.sep);
};

/* the home folder is always looked in; any folder you add is kept in data\localrepos.json */
function roots() {
  const out = [];
  for (const r of [os.homedir()].concat(readCfg().roots)) {
    try { if (r && fs.statSync(r).isDirectory() && !out.some(x => same(x, r))) out.push(path.resolve(r)); } catch (e) { }
  }
  return out;
}

/* other drives as one-click chips: a repository on D:\ is only found if that drive is added as a place to look */
function drives() {
  if (process.platform !== 'win32') return [];
  const out = [];
  for (const letter of 'CDEFGHIJKLMNOPQRSTUVWXYZ') {
    const d = letter + ':\\';
    try { if (fs.existsSync(d) && !roots().some(r => same(r, d))) out.push(d); } catch (e) { }
  }
  return out;
}

/* branch, remote and when the repository last changed, read from .git itself (never from git.exe) */
function info(dir) {
  let branch = '', remote = '', at = 0;
  let gitDir = path.join(dir, '.git');
  try {
    const st = fs.statSync(gitDir);
    at = st.mtimeMs;
    if (st.isFile()) {                     // a worktree or submodule: ".git" is a file saying where the real one is
      const m = /^gitdir:\s*(.+)$/im.exec(fs.readFileSync(gitDir, 'utf8').trim());
      if (m) gitDir = path.resolve(dir, m[1].trim());
    }
  } catch (e) { }
  try {
    const head = fs.readFileSync(path.join(gitDir, 'HEAD'), 'utf8').trim();
    const m = /^ref:\s*refs\/heads\/(.+)$/.exec(head);
    branch = m ? m[1] : (head ? head.slice(0, 8) : '');
  } catch (e) { }
  try {
    const cfg = fs.readFileSync(path.join(gitDir, 'config'), 'utf8');
    const m = /\[remote "origin"\][\s\S]*?^\s*url\s*=\s*(.+)$/im.exec(cfg);
    if (m) remote = m[1].trim();
  } catch (e) { }
  if (!at) { try { at = fs.statSync(dir).mtimeMs; } catch (e) { } }
  return { branch, remote, at };
}

/* every folder with a .git, breadth first, skipping the folders that never hold source you would want to browse */
async function scan() {
  const rts = roots(), found = new Map(), seen = new Set();
  let dirs = 0, truncated = false;
  const started = Date.now();
  const queue = rts.map(dir => ({ dir, depth: 0 }));
  while (queue.length) {
    if (dirs >= MAX_DIRS || Date.now() - started > BUDGET) { truncated = true; break; }
    const { dir, depth } = queue.shift();
    const key = path.resolve(dir).toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    let ents;
    try { ents = await fs.promises.readdir(dir, { withFileTypes: true }); } catch (e) { continue; }
    dirs++;
    if (ents.some(e => e.name === '.git')) {
      found.set(key, Object.assign({ name: path.basename(dir) || dir, path: path.resolve(dir) }, info(dir)));
    }
    if (depth >= MAX_DEPTH) continue;
    for (const e of ents) {
      if (!e.isDirectory() || e.isSymbolicLink()) continue;
      const n = e.name.toLowerCase();
      if (n.startsWith('.') || SKIP.has(n)) continue;
      queue.push({ dir: path.join(dir, e.name), depth: depth + 1 });
    }
  }
  const repos = [...found.values()].sort((a, b) => a.path.toLowerCase().localeCompare(b.path.toLowerCase()));
  const cfg = readCfg();
  const next = { roots: cfg.roots, at: Date.now(), repos, truncated };
  writeCfg(next);
  return Object.assign({ dirs }, next, { roots: rts, extraRoots: cfg.roots, drives: drives() });
}

function status() {
  const cfg = readCfg();
  return {
    at: cfg.at, repos: cfg.repos, truncated: cfg.truncated, roots: roots(), extraRoots: cfg.roots,
    drives: drives(), home: os.homedir()
  };
}

function addRoot(p) {
  const s = path.resolve(String(p || '').trim());
  if (!s) return { error: 'Choose a folder first.' };
  let st; try { st = fs.statSync(s); } catch (e) { return { error: 'That folder cannot be read.' }; }
  if (!st.isDirectory()) return { error: 'That is a file, not a folder.' };
  if (/^(windows|program files|program files \(x86\)|programdata|system volume information|\$recycle\.bin)$/i.test(path.relative(path.parse(s).root, s).split(/[\\/]/)[0] || '')) {
    return { error: 'Windows and Program Files are not searched.' };
  }
  const cfg = readCfg();
  if (!cfg.roots.some(x => same(x, s)) && !same(os.homedir(), s)) { cfg.roots.push(s); writeCfg(cfg); }
  return { ok: true, roots: roots(), extraRoots: cfg.roots, drives: drives() };
}

function removeRoot(p) {
  const cfg = readCfg();
  cfg.roots = cfg.roots.filter(x => !same(x, String(p || '')));
  writeCfg(cfg);
  return { ok: true, roots: roots(), extraRoots: cfg.roots, drives: drives() };
}

/* opening is limited to what the scan found (or a folder under a place that is searched), and to this PC only */
function open(p) {
  const s = path.resolve(String(p || '').trim());
  let st; try { st = fs.statSync(s); } catch (e) { return { error: 'That folder is not there any more. Scan again.' }; }
  const cfg = readCfg();
  const ok = cfg.repos.some(r => inside(s, r.path)) || roots().some(r => inside(s, r));
  if (!ok) return { error: 'That folder is not one of the places this looks in. Add it as a folder to look in first.' };
  try {
    if (st.isDirectory()) cp.spawn('explorer.exe', [s], { detached: true, stdio: 'ignore' }).unref();
    else cp.spawn('explorer.exe', ['/select,', s], { detached: true, stdio: 'ignore' }).unref();
  } catch (e) { return { error: 'Explorer could not be opened.' }; }
  return { ok: true };
}

module.exports = { scan, status, addRoot, removeRoot, open, roots, drives };

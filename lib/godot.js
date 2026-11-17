// Studio > Godot engine: the local AI writes a whole Godot 4 project (project.godot, scenes, GDScript) into one folder on
// this PC, and Moundshroud opens or plays it with the Godot engine (engines\godot\ if it was installed by install-godot.ps1,
// or any Godot already on this PC). Everything stays inside that one folder: a project name cannot reach outside it, and
// only the text files a Godot project is made of are ever written.
const fs = require('fs'), os = require('os'), path = require('path'), cp = require('child_process');

const ROOT = path.join(__dirname, '..');
const HOME = process.env.MOUNDSHROUD_GODOT_DIR || path.join(os.homedir(), 'Documents', 'Moundshroud Godot');
const MAX_FILE = 240 * 1024, MAX_TOTAL = 1.6e6, MAX_FILES = 80, MAX_DEPTH = 4;
// the file kinds a Godot project is made of; anything else (an executable, a script for the shell) is refused
const EXTS = new Set(['.godot', '.gd', '.tscn', '.tres', '.cfg', '.import', '.json', '.txt', '.md', '.svg', '.gdshader', '.gdextension', '.csv']);
const RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;

let cached = null, cachedAt = 0;
const byPreference = (a, b) => (/_console\.exe$/i.test(a) ? 1 : 0) - (/_console\.exe$/i.test(b) ? 1 : 0) || b.localeCompare(a);
function existsFile(p) { try { return fs.statSync(p).isFile(); } catch (e) { return false; } }
function firstLine(exe) {
  try { const r = cp.spawnSync(exe, ['--version'], { timeout: 9000, windowsHide: true, encoding: 'utf8' }); return String((r.stdout || r.stderr || '')).trim().split(/\r?\n/)[0] || ''; } catch (e) { return ''; }
}
/* the engine: MOUNDSHROUD_GODOT, engines\godot\ (what install-godot.ps1 fills), then whatever Godot is on this PC */
function findEngine() {
  const now = Date.now(); if (cached !== null && now - cachedAt < 15000) return cached;
  const tries = [];
  if (process.env.MOUNDSHROUD_GODOT) tries.push(process.env.MOUNDSHROUD_GODOT);
  const local = path.join(ROOT, 'engines', 'godot');
  try { for (const f of fs.readdirSync(local).filter(f => /\.exe$/i.test(f)).sort(byPreference)) tries.push(path.join(local, f)); } catch (e) { }
  // the _console.exe beside the editor is for command-line output; the plain editor is the one to open
  try { const w = cp.execFileSync('where', ['godot'], { timeout: 6000, encoding: 'utf8', windowsHide: true }); for (const l of String(w).split(/\r?\n/)) if (l.trim()) tries.push(l.trim()); } catch (e) { }
  for (const p of [process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'Programs', 'Godot'), 'C:\\Program Files\\Godot', path.join(os.homedir(), 'Godot')]) {
    if (!p) continue;
    try { for (const f of fs.readdirSync(p).filter(f => /\.exe$/i.test(f)).sort().reverse()) tries.push(path.join(p, f)); } catch (e) { }
  }
  let found = null;
  for (const p of tries) { if (p && existsFile(p)) { found = { path: p, version: firstLine(p) }; break; } }
  cached = found; cachedAt = now; return found;
}
function status() {
  const e = findEngine();
  return { engine: e, home: HOME, installed: !!e, folder: fs.existsSync(HOME) };
}
/* a project name that is safe as a folder name on Windows */
function cleanName(name) {
  let n = String(name == null ? '' : name).replace(/[\u0000-\u001f<>:"/\\|?*]/g, ' ').replace(/\s+/g, ' ').trim().replace(/[. ]+$/, '').slice(0, 60).trim();
  if (!n) return '';
  if (RESERVED.test(n)) n = n + ' game';
  return n;
}
const inside = (p, dir) => { const a = path.resolve(p).toLowerCase(), b = path.resolve(dir).toLowerCase(); return a === b || a.startsWith(b + path.sep); };
const dirOf = name => { const n = cleanName(name); return n ? path.join(HOME, n) : ''; };

/* the file list the page sends is checked here, once, for every way of getting it wrong */
function checkFiles(files) {
  if (!Array.isArray(files) || !files.length) return { error: 'No files were sent.' };
  if (files.length > MAX_FILES) return { error: 'That is more than ' + MAX_FILES + ' files. Ask for a smaller project.' };
  const out = []; let total = 0;
  for (const f of files) {
    const raw = String((f && f.path) || '').replace(/\\/g, '/').trim();
    if (!raw) return { error: 'A file in the project has no name.' };
    if (/^[a-z]:/i.test(raw) || raw.startsWith('/') || raw.split('/').some(s => s === '..' || s === '')) return { error: 'The project tried to write outside its own folder (' + raw + '). Nothing was saved.' };
    if (raw.split('/').length > MAX_DEPTH + 1) return { error: 'The project has folders nested too deeply (' + raw + ').' };
    const ext = path.extname(raw).toLowerCase();
    if (!EXTS.has(ext)) return { error: 'A Godot project cannot contain "' + raw + '". Only project files (project.godot, .tscn, .gd, .tres and the like) are written.' };
    const content = String(f.content == null ? '' : f.content);
    const size = Buffer.byteLength(content);
    if (size > MAX_FILE) return { error: '"' + raw + '" is too long (' + Math.round(size / 1024) + ' kB). Ask for a simpler game.' };
    total += size;
    if (total > MAX_TOTAL) return { error: 'The whole project is too long for one request. Ask for a smaller game.' };
    out.push({ rel: raw, content });
  }
  if (!out.some(f => /(^|\/)project\.godot$/i.test(f.rel))) return { error: 'The AI left out project.godot, which every Godot project needs. Try again.' };
  return { files: out };
}
function save(name, files) {
  const dir = dirOf(name); if (!dir) return { ok: false, error: 'Give the game a name first.' };
  const checked = checkFiles(files); if (checked.error) return { ok: false, error: checked.error };
  try { fs.mkdirSync(dir, { recursive: true }); } catch (e) { return { ok: false, error: 'Could not make the folder for this game: ' + e.message }; }
  const written = [];
  for (const f of checked.files) {
    const p = path.join(dir, f.rel);
    if (!inside(p, dir)) return { ok: false, error: 'The project tried to write outside its own folder. Nothing more was saved.' };
    try { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, f.content, 'utf8'); written.push(f.rel); }
    catch (e) { return { ok: false, error: 'Could not save "' + f.rel + '": ' + e.message, written }; }
  }
  return { ok: true, name: cleanName(name), dir, written, count: written.length };
}
function countFiles(dir) { let n = 0; const walk = d => { let l = []; try { l = fs.readdirSync(d, { withFileTypes: true }); } catch (e) { return; } for (const e of l) { if (e.name === '.godot') continue; if (e.isDirectory()) walk(path.join(d, e.name)); else n++; } }; walk(dir); return n; }
function list() {
  let dirs = []; try { dirs = fs.readdirSync(HOME, { withFileTypes: true }).filter(e => e.isDirectory()); } catch (e) { return []; }
  const out = [];
  for (const d of dirs) {
    const dir = path.join(HOME, d.name), proj = path.join(dir, 'project.godot');
    if (!existsFile(proj)) continue;
    let ts = 0, main = ''; try { ts = fs.statSync(proj).mtimeMs; const t = fs.readFileSync(proj, 'utf8'); const m = /run\/main_scene\s*=\s*"([^"]+)"/.exec(t); main = m ? m[1] : ''; } catch (e) { }
    out.push({ name: d.name, files: countFiles(dir), ts, main });
  }
  return out.sort((a, b) => b.ts - a.ts);
}
function read(name, file) {
  const dir = dirOf(name); if (!dir) return { ok: false, error: 'No game named.' };
  const rel = String(file || '').replace(/\\/g, '/').replace(/^\/+/, '');
  if (!rel || rel.split('/').some(s => s === '..')) return { ok: false, error: 'No file named.' };
  const p = path.join(dir, rel);
  if (!inside(p, dir) || !existsFile(p)) return { ok: false, error: 'That file is not in this game.' };
  try { const stat = fs.statSync(p); if (stat.size > 400 * 1024) return { ok: false, error: 'That file is too big to show.' }; return { ok: true, file: rel, text: fs.readFileSync(p, 'utf8') }; }
  catch (e) { return { ok: false, error: e.message }; }
}
function tree(name) {
  const dir = dirOf(name); if (!dir || !fs.existsSync(dir)) return { ok: false, error: 'That game is not here any more.' };
  const out = []; const walk = (d, pre) => { let l = []; try { l = fs.readdirSync(d, { withFileTypes: true }); } catch (e) { return; } for (const e of l.sort((a, b) => (a.isDirectory() === b.isDirectory() ? a.name.localeCompare(b.name) : a.isDirectory() ? -1 : 1))) { if (e.name === '.godot') continue; const rel = pre ? pre + '/' + e.name : e.name; if (e.isDirectory()) { out.push({ path: rel, dir: true }); walk(path.join(d, e.name), rel); } else out.push({ path: rel, dir: false, size: (() => { try { return fs.statSync(path.join(d, e.name)).size; } catch (x) { return 0; } })() }); } };
  walk(dir, '');
  return { ok: true, name: cleanName(name), dir, files: out };
}
/* open the editor (-e) or run the game (no flag) with the engine */
function launch(name, play) {
  const dir = dirOf(name);
  if (!dir || !existsFile(path.join(dir, 'project.godot'))) return { ok: false, error: 'That game is not here.' };
  const e = findEngine(); if (!e) return { ok: false, error: 'godot-missing' };
  try {
    const child = cp.spawn(e.path, play ? ['--path', dir] : ['--path', dir, '-e'], { cwd: dir, detached: true, stdio: 'ignore', windowsHide: false });
    child.unref();
    return { ok: true, editor: !play, engine: e.version };
  } catch (err) { return { ok: false, error: 'Godot could not start: ' + err.message }; }
}
function remove(name) {
  const dir = dirOf(name); if (!dir) return { ok: false, error: 'No game named.' };
  if (!inside(dir, HOME) || path.resolve(dir) === path.resolve(HOME)) return { ok: false, error: 'That folder cannot be removed.' };
  if (!fs.existsSync(dir)) return { ok: false, error: 'That game is already gone.' };
  try { fs.rmSync(dir, { recursive: true, force: true }); return { ok: true }; } catch (e) { return { ok: false, error: 'Could not delete it: ' + e.message }; }
}
/* ---- porting a game to the Arcade: a Web export the app can serve to the Arcade's own iframe ---- */
const TEMPLATES = () => path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'Godot', 'export_templates');
// what Godot writes for a Web export with threads off, so the page needs no cross-origin isolation to run
const PRESET = `[preset.0]

name="Web"
platform="Web"
runnable=true
advanced_options=false
dedicated_server=false
custom_features=""
export_filter="all_resources"
include_filter=""
exclude_filter=""
export_path=""
encryption_include_filters=""
encryption_exclude_filters=""
encrypt_pck=false
encrypt_directory=false
script_export_mode=2

[preset.0.options]

custom_template/debug=""
custom_template/release=""
variant/extensions_support=false
variant/thread_support=false
vram_texture_compression/for_desktop=true
vram_texture_compression/for_mobile=false
html/export_icon=true
html/custom_html_shell=""
html/head_include=""
html/canvas_resize_policy=2
html/focus_canvas_on_start=true
html/experimental_virtual_keyboard=false
progressive_web_app/enabled=false
`;
const consoleExe = exe => { const c = exe.replace(/_win64\.exe$/i, '_win64_console.exe'); return existsFile(c) ? c : exe; };
function webDir(name) { const dir = dirOf(name); return dir ? path.join(dir, 'web') : ''; }
/* the export templates must match the engine exactly (4.7.2.stable and so on), or Godot refuses to export */
function templatesFor(version) { const d = path.join(TEMPLATES(), version); return fs.existsSync(d) ? d : ''; }
function exportWeb(name) {
  const dir = dirOf(name);
  if (!dir || !existsFile(path.join(dir, 'project.godot'))) return { ok: false, error: 'That game is not here.' };
  const e = findEngine(); if (!e) return { ok: false, error: 'godot-missing' };
  const ver = String(e.version || '').split('.o')[0].trim();
  if (!templatesFor(ver)) return { ok: false, error: 'templates-missing', version: ver, where: path.join(TEMPLATES(), ver) };
  try {
    const preset = path.join(dir, 'export_presets.cfg');
    if (!fs.existsSync(preset)) fs.writeFileSync(preset, PRESET, 'utf8');      // a project the user made by hand keeps its own presets
    const web = webDir(name); fs.mkdirSync(web, { recursive: true });
    /* the exported copy sits inside the project folder; .gdignore stops Godot importing it back into the project */
    try { fs.writeFileSync(path.join(web, '.gdignore'), ''); } catch (e) { }
    const out = path.join(web, 'index.html');
    const r = cp.spawnSync(consoleExe(e.path), ['--headless', '--path', dir, '--export-release', 'Web', out], { timeout: 240000, encoding: 'utf8', windowsHide: true });
    const log = String((r.stdout || '') + (r.stderr || ''));
    if (!existsFile(out)) return { ok: false, error: 'export-failed', log: log.slice(-1500) };
    return { ok: true, name: cleanName(name), dir: web, files: fs.readdirSync(web) };
  } catch (err) { return { ok: false, error: 'Godot could not export the game: ' + err.message }; }
}
/* The check presses keys of its own, because most of a game only happens after "press SPACE to start". It runs in a
   throwaway copy of the project: the game's own folder is never touched by a test. */
const PROBE_GD = 'extends Node\n' +
  'var f := 0\n' +
  'func _key(k: int, down: bool) -> void:\n' +
  '\tvar e := InputEventKey.new()\n' +
  '\te.keycode = k\n' +
  '\te.physical_keycode = k\n' +
  '\te.pressed = down\n' +
  '\tInput.parse_input_event(e)\n' +
  'func _process(_d: float) -> void:\n' +
  '\tf += 1\n' +
  '\tif f == 4: _key(KEY_SPACE, true)\n' +
  '\tif f == 10: _key(KEY_SPACE, false)\n' +
  '\tif f == 16: _key(KEY_ENTER, true)\n' +
  '\tif f == 20: _key(KEY_ENTER, false)\n' +
  '\tif f == 26: _key(KEY_D, true)\n' +
  '\tif f == 30: _key(KEY_SPACE, true)\n' +
  '\tif f == 150: _key(KEY_D, false)\n' +
  '\tif f == 152: _key(KEY_W, true)\n' +
  '\tif f == 250: _key(KEY_W, false)\n' +
  '\tif f == 254: _key(KEY_RIGHT, true)\n' +
  '\tif f == 290: _key(KEY_RIGHT, false)\n' +
  '\tif f == 320: _key(KEY_SPACE, false)\n' +
  '\tif f >= 340: get_tree().quit()\n';

/* Run the project with the engine itself and collect what it complains about. This is the only reliable answer to
   "does this game work": a project can look plausible, compile, run, and still fall over the moment a key is pressed.
   So the check loads it, plays it with simulated keys for a few hundred frames, and reports both. */
function check(name) {
  const dir = dirOf(name);
  if (!dir || !existsFile(path.join(dir, 'project.godot'))) return { ok: false, error: 'That game is not here.', log: '' };
  const e = findEngine(); if (!e) return { ok: false, error: 'godot-missing', log: '' };
  let tmp = '', out = '';
  try {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'moundshroud-godot-check-'));
    fs.cpSync(dir, tmp, { recursive: true, filter: s => !/[\\/](web|\.godot)([\\/]|$)/i.test(s) });
    fs.writeFileSync(path.join(tmp, '_moundshroud_check.gd'), PROBE_GD, 'utf8');
    const cfgPath = path.join(tmp, 'project.godot');
    let cfg = fs.readFileSync(cfgPath, 'utf8');
    const auto = 'MoundshroudCheck="*res://_moundshroud_check.gd"';
    if (/^\[autoload\]/m.test(cfg)) cfg = cfg.replace(/^\[autoload\]/m, '[autoload]\n\n' + auto);
    else cfg = cfg.replace(/\s*$/, '\n\n[autoload]\n\n' + auto + '\n');
    fs.writeFileSync(cfgPath, cfg, 'utf8');
    const r = cp.spawnSync(consoleExe(e.path), ['--headless', '--path', tmp, '--quit-after', '700'], { timeout: 120000, windowsHide: true, encoding: 'utf8' });
    out = String((r.stdout || '') + (r.stderr || ''));
  } catch (err) { return { ok: false, error: String(err.message || err), log: '' }; }
  finally { try { if (tmp) fs.rmSync(tmp, { recursive: true, force: true }); } catch (e) { } }
  const seen = new Set();
  const lines = out.split(/\r?\n/).map(l => l.trim())
    .filter(l => /SCRIPT ERROR|Parse Error|ERROR:|Failed to load|Cannot open|not found|Invalid |Nonexistent function|Cannot call method|^at: .*res:\/\//i.test(l))
    .filter(l => !/Using Device|OpenGL API|Vulkan API|^Godot Engine v|audio driver|AudioDriver|TextServer|Fallback font|still in use at exit/i.test(l))
    .filter(l => { const k = l.replace(/\d+/g, '#'); if (seen.has(k)) return false; seen.add(k); return true; });
  return { ok: lines.length === 0, log: lines.slice(0, 14).join('\n').slice(0, 2000), dir };
}

/* one file of the exported game, or null: nothing outside that game's web folder is ever served */
function webFile(name, rel) {
  const web = webDir(name); if (!web || !fs.existsSync(web)) return null;
  const p = path.join(web, String(rel || 'index.html').replace(/\\/g, '/').replace(/^\.?\/+/, ''));
  if (!inside(p, web) || !existsFile(p)) return null;
  return p;
}
module.exports = { status, list, save, read, tree, launch, remove, exportWeb, webFile, templatesFor, check, HOME, TEMPLATES, findEngine, checkFiles, cleanName };

// Extras: system stats, quick capture, file extraction for chat, backup and restore.
const fs = require('fs'), path = require('path'), cp = require('child_process'), os = require('os'), vm = require('vm');
const store = require('./store'), docs = require('./docs');

const ROOT = path.join(__dirname, '..'), DATA = path.join(ROOT, 'data'), TMP = path.join(DATA, 'tmp');
const ps = (cmd, ms = 15000) => new Promise(res => cp.execFile('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', cmd], { windowsHide: true, timeout: ms, maxBuffer: 4e6 }, (e, out) => res(e ? '' : String(out))));
const rm = p => { try { fs.rmSync(p, { recursive: true, force: true }); } catch (e) {} };

/* the same plain-English parser the web app uses */
const ctx = { A: {} }; try { vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'web', 'js', 'remind.js'), 'utf8'), ctx); } catch (e) {}
const R = ctx.A.remind;

function quick(text) {
  text = String(text || '').trim().slice(0, 2000); if (!text) return { kind: 'none' };
  if (R && R.isRequest(text)) {
    const p = R.parse(text);
    if (p) { store.remAdd(p.text, p.at, p.rule); return { kind: 'reminder', text: p.text, when: p.rule ? 'repeating ' + R.describe(p.rule) : R.when(p.at) }; }
    return { kind: 'error', message: 'Could not work out the time' };
  }
  const stamp = new Date().toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  const ex = store.notesList().find(n => n.title === 'Quick Inbox');
  const cur = ex ? store.noteGet(ex.id).content.replace(/\s*$/, '\n') : '# Quick Inbox\n\n';
  store.noteSave({ id: ex ? ex.id : undefined, title: 'Quick Inbox', content: cur + '- ' + stamp + ' - ' + text.replace(/\n+/g, ' ') + '\n' });
  return { kind: 'note' };
}

/* ---------- system stats ---------- */
let prevCpu = os.cpus(), battery = { at: 0, v: null }, procs = { at: 0, v: [] };
function cpuPct() {
  const now = os.cpus(); let idle = 0, total = 0;
  now.forEach((c, i) => { const p = prevCpu[i] || c; for (const k in c.times) { const d = c.times[k] - (p.times[k] || 0); total += d; if (k === 'idle') idle += d; } });
  prevCpu = now; return total ? Math.round((1 - idle / total) * 100) : 0;
}
async function sysinfo(extra) {
  const now = Date.now(), tot = os.totalmem(), free = os.freemem(); let disk = null;
  try { const s = fs.statfsSync('C:\\'); disk = { totalGB: Math.round(s.blocks * s.bsize / 1073741824), freeGB: Math.round(s.bavail * s.bsize / 1073741824) }; } catch (e) {}
  if (now - battery.at > 60000) { battery.at = now; ps('Get-CimInstance Win32_Battery | Select-Object EstimatedChargeRemaining,BatteryStatus | ConvertTo-Json -Compress', 8000).then(o => { try { const j = JSON.parse(o); battery.v = j && j.EstimatedChargeRemaining != null ? { pct: j.EstimatedChargeRemaining, charging: j.BatteryStatus === 2 } : null; } catch (e) { battery.v = null; } }); }
  if (now - procs.at > 6000) { procs.at = now; ps("Get-Process | Sort-Object WS -Descending | Select-Object -First 6 Name,@{n='MB';e={[int]($_.WS/1MB)}} | ConvertTo-Json -Compress", 8000).then(o => { try { const j = JSON.parse(o); procs.v = (Array.isArray(j) ? j : [j]).map(x => ({ name: x.Name, mb: x.MB })); } catch (e) {} }); }
  let health = null; try { health = store.briefing().health; } catch (e) {}
  return { cpu: cpuPct(), ram: { usedGB: +((tot - free) / 1073741824).toFixed(1), totalGB: +(tot / 1073741824).toFixed(1) }, disk, battery: battery.v, uptimeH: +(os.uptime() / 3600).toFixed(1), procs: procs.v, health, cpuName: (os.cpus()[0] || {}).model, ...extra };
}

/* ---------- files dropped into chat ---------- */
async function extract(name, buf) {
  fs.mkdirSync(TMP, { recursive: true });
  const ext = path.extname(String(name || '')).toLowerCase().replace(/[^.\w]/g, '') || '.txt', f = path.join(TMP, 'x' + Date.now() + Math.random().toString(36).slice(2, 6) + ext);
  fs.writeFileSync(f, buf);
  try {
    const pages = await docs.extractFile(f);
    const multi = pages.length > 1 && pages.some(p => p.page);
    const text = pages.map(p => (multi ? '[page ' + p.page + ']\n' : '') + p.text).join('\n\n');
    return { text: text.slice(0, 40000), pages: pages.length, truncated: text.length > 40000 };
  } catch (e) { return { error: e.message === 'unsupported' ? 'That file type is not supported yet (try PDF, Word, PowerPoint, Excel, text or web pages).' : String(e.message) }; }
  finally { rm(f); }
}

/* ---------- backup / restore ---------- */
const DATA_FILES = ['chats.json', 'cards.json', 'prompts.json', 'reminders.json', 'docs-sources.json', 'quizzes.json', 'guides.json', 'prep.json', 'vault.json', 'photos.json', 'mail-drafts.json', 'memory.json', 'refs.json', 'cams.json', 'cams-live.json', 'safety.json'];
/* the things you built or collected that nothing else can rebuild: pages read into the index, the repositories you
downloaded, the camera list, and the search index (which holds the pages plus their vectors) */
const DATA_DIRS = ['webpages', 'refs'];
const DATA_BIG = ['index.db'];
async function backup() {
  fs.mkdirSync(TMP, { recursive: true });
  const stamp = new Date().toISOString().slice(0, 10), stage = path.join(TMP, 'bk' + Date.now()), zip = path.join(TMP, 'Moundshroud-backup-' + stamp + '.zip');
  fs.mkdirSync(path.join(stage, 'notes'), { recursive: true }); fs.mkdirSync(path.join(stage, 'data'), { recursive: true });
  try { for (const f of fs.readdirSync(store.NOTES)) if (/\.md$/i.test(f)) fs.copyFileSync(path.join(store.NOTES, f), path.join(stage, 'notes', f)); } catch (e) {}
  for (const f of DATA_FILES.concat(DATA_BIG)) { try { fs.copyFileSync(path.join(DATA, f), path.join(stage, 'data', f)); } catch (e) {} }
  for (const d of DATA_DIRS) { try { fs.cpSync(path.join(DATA, d), path.join(stage, 'data', d), { recursive: true }); } catch (e) {} }
  rm(zip);
  /* lib/zip.js writes the archive: PowerShell's Compress-Archive gives up on the deep folders inside the reference
     libraries, which is exactly the data that most needs a backup */
  try { require('./zip').zipDir(stage, zip); } catch (e) { rm(stage); return null; }
  rm(stage); return fs.existsSync(zip) ? zip : null;
}
async function restore(buf) {
  fs.mkdirSync(TMP, { recursive: true });
  const id = 'rs' + Date.now(), zip = path.join(TMP, id + '.zip'), out = path.join(TMP, id);
  fs.writeFileSync(zip, buf);
  try {
    const opened = require('./zip').unzip(zip, out);
    if (opened.error) return { error: opened.error };
    let notes = 0, files = 0;
    const nd = path.join(out, 'notes'); fs.mkdirSync(store.NOTES, { recursive: true });
    if (fs.existsSync(nd)) for (const f of fs.readdirSync(nd)) if (/^[^\\/:*?"<>|]+\.md$/i.test(f)) { fs.copyFileSync(path.join(nd, f), path.join(store.NOTES, f)); notes++; }
    const dd = path.join(out, 'data');
    if (fs.existsSync(dd)) for (const f of DATA_FILES.concat(DATA_BIG)) { const s = path.join(dd, f); if (fs.existsSync(s)) { try { fs.copyFileSync(s, path.join(DATA, f)); files++; } catch (e) { } } }
    /* the folders: copies are merged in, so restoring never deletes a page or repository you added afterwards */
    if (fs.existsSync(dd)) for (const d of DATA_DIRS) { const s = path.join(dd, d); if (!fs.existsSync(s)) continue; try { fs.cpSync(s, path.join(DATA, d), { recursive: true, force: false, errorOnExist: false }); files++; } catch (e) { } }
    try { require('./docs').reindex().catch(() => {}); } catch (e) {}
    try { store.notesSync(); } catch (e) {}
    if (!notes && !files) return { error: 'That does not look like a Moundshroud backup.' };
    return { notes, files };
  } catch (e) { return { error: String(e.message) }; }
  finally { rm(zip); rm(out); }
}

module.exports = { quick, sysinfo, extract, backup, restore, TMP, rm };

// Progress safety: one dated copy of everything YOU have built up, written outside the app folder so it
// survives the app breaking, being repaired or moved. Made automatically once a day on startup, and on
// demand. Covers the parts nothing else protects: browser-storage progress (ratings, journal, favourites,
// Bible notes, playlists, preferences) that lives in the window profile, plus the notes and data files.
// Restore with .\restore-progress.ps1 -Name latest (works even when Moundshroud will not start).
const fs = require('fs'), path = require('path'), os = require('os'), { execFile } = require('child_process');
const ROOT = path.join(__dirname, '..'), DATA = path.join(ROOT, 'data'), PROFILE = path.join(ROOT, 'edge-profile');
/* where the daily copies go: on this PC only (the private default: a OneDrive folder would upload them to Microsoft),
   or, if you choose, DocumentsMoundshroud Backups so OneDrive carries them. dataackup-place.json holds the choice, and
   restore-progress.ps1 reads the same file so the two always agree. */
function documentsDir() { const h = os.homedir(); for (const d of [path.join(h, 'OneDrive', 'Documents'), path.join(h, 'Documents')]) if (fs.existsSync(d)) return d; return h; }
const PLACE = path.join(DATA, 'backup-place.json');
const place = () => { try { return JSON.parse(fs.readFileSync(PLACE, 'utf8')).place === 'onedrive' ? 'onedrive' : 'local'; } catch (e) { return 'local'; } };
const cloudDest = () => path.join(documentsDir(), 'Moundshroud Backups'), localDest = () => path.join(os.homedir(), 'Moundshroud Backups');
const destOf = () => place() === 'onedrive' ? cloudDest() : localDest();
let DEST = destOf();
function setPlace(p) { try { fs.writeFileSync(PLACE, JSON.stringify({ place: p === 'onedrive' ? 'onedrive' : 'local' })); } catch (e) { } DEST = destOf(); return status(); }
const STAMP = path.join(DATA, 'last-autobackup.json');
const KEEP = 10;                       // how many dated copies to keep

/* notes live in the user's Documents folder (the app puts them there so they are easy to find and sync) */
const notesDir = () => path.join(documentsDir(), 'Assistant Notes');

/* everything in data\ is progress, except databases and dictionaries that are rebuilt from scratch */
const skip = f => /^index\.db|\.db-(shm|wal)$|^cmudict\.dict$|^clip-on$/i.test(f);
const MAXMB = 24;
function dataFiles() {
  try {
    return fs.readdirSync(DATA).filter(f => !skip(f)).filter(f => { try { return fs.statSync(path.join(DATA, f)).size <= MAXMB * 1048576; } catch (e) { return false; } });
  } catch (e) { return []; }
}
const cp = (from, to) => { try { fs.copyFileSync(from, to); return true; } catch (e) { return false; } };
const rm = p => { try { fs.rmSync(p, { recursive: true, force: true }); } catch (e) { } };

const read = () => { try { return JSON.parse(fs.readFileSync(STAMP, 'utf8')); } catch (e) { return null; } };
const list = () => {
  try {
    return fs.readdirSync(DEST, { withFileTypes: true }).filter(d => d.isDirectory() && /^progress-/.test(d.name)).map(d => {
      let files = 0, bytes = 0;
      try { for (const x of fs.readdirSync(path.join(DEST, d.name), { recursive: true, withFileTypes: true })) if (x.isFile()) files++; } catch (e) { }
      try { bytes = dirSize(path.join(DEST, d.name)); } catch (e) { }
      return { name: d.name, files, mb: Math.round(bytes / 104857.6) / 10, at: d.name.replace('progress-', '') };
    }).sort((a, b) => b.name.localeCompare(a.name));
  } catch (e) { return []; }
};
function dirSize(dir) { let n = 0; for (const e of fs.readdirSync(dir, { withFileTypes: true })) { const p = path.join(dir, e.name); try { n += e.isDirectory() ? dirSize(p) : fs.statSync(p).size; } catch (x) { } } return n; }

function readme(folder, when, counts) {
  return ['Moundshroud progress backup',
    '============================',
    '',
    'Made: ' + when,
    'Folder: ' + folder,
    '',
    'This is a copy of YOUR work, not the app itself. It is safe to leave here and safe to copy to a USB stick',
    'or your OneDrive folder. Nothing in the app reads it, so it can never be corrupted by the app running.',
    '',
    'What is inside',
    '  notes\\              your written notes (Markdown), from Documents\\Assistant Notes',
    '  data\\               ' + counts.data + ' files: chats, flashcards, quizzes, prompts, reminders, saved',
    '                      sources, household prep, chess book and 20-hour study record, clipboard',
    '  window-progress\\    ' + counts.store + ' files: the progress kept inside the Moundshroud window - chess',
    '                      profile and ratings, journal, favourites and folders, Bible bookmarks and',
    '                      highlights, reading plans, music likes and playlists, preferences',
    '',
    'How to put it back',
    '  Close Moundshroud first (right-click the tray icon, Quit). Then, in the app folder:',
    '',
    '      .\\restore-progress.ps1 -List                    see what copies you have',
    '      .\\restore-progress.ps1 -Name latest             put the newest copy back',
    '      .\\restore-progress.ps1 -Name progress-2026-10-26',
    '      .\\restore-progress.ps1 -Backup                    make a fresh copy now',
    '',
    '  The restore script first saves what is there now (as before-restore-...), so a restore can be undone.',
    '  It works even when Moundshroud will not start, and it does not need the internet.',
    '',
    'A copy is made automatically once a day when Moundshroud starts, and the newest ' + KEEP + ' are kept.',
    'You can make one any time: in the app, Prepare > Ready > Recent backup > Back up now, or run',
    '.\\restore-progress.ps1 -Backup in the app folder.',
    ''].join('\r\n');
}

/* makes the dated copy. force = true skips the once-a-day check. */
async function run(force) {
  const now = new Date(), day = now.toISOString().slice(0, 10);
  const folder = path.join(DEST, 'progress-' + day);
  const prev = read();
  if (!force && prev && prev.day === day && fs.existsSync(folder)) return { ok: true, skipped: true, folder, at: prev.at };
  try { fs.mkdirSync(folder, { recursive: true }); } catch (e) { return { error: 'Could not create ' + DEST + ' (' + e.message + ')' }; }

  /* notes */
  let notes = 0; const nd = path.join(folder, 'notes'); fs.mkdirSync(nd, { recursive: true });
  try { for (const f of fs.readdirSync(notesDir())) if (/\.md$/i.test(f)) if (cp(path.join(notesDir(), f), path.join(nd, f))) notes++; } catch (e) { }

  /* data files */
  let data = 0; const dd = path.join(folder, 'data'); fs.mkdirSync(dd, { recursive: true });
  for (const f of dataFiles()) if (cp(path.join(DATA, f), path.join(dd, f))) data++;

  /* the window's browser storage: ratings, journal, favourites, Bible notes, playlists, preferences.
     Copied file by file so a locked file (LOCK) just gets skipped instead of failing the whole backup. */
  let store = 0; const sd = path.join(folder, 'window-progress', 'Local Storage', 'leveldb'); fs.mkdirSync(sd, { recursive: true });
  const src = path.join(PROFILE, 'Default', 'Local Storage', 'leveldb');
  try {
    for (const f of fs.readdirSync(src)) if (!/^LOCK$/i.test(f)) if (cp(path.join(src, f), path.join(sd, f))) store++;
  } catch (e) { }
  /* and the profile preferences, so the look and the switches come back too */
  const pd = path.join(folder, 'window-progress'); fs.mkdirSync(pd, { recursive: true });
  cp(path.join(PROFILE, 'Default', 'Preferences'), path.join(pd, 'Preferences'));

  try { fs.writeFileSync(path.join(folder, 'READ-ME-FIRST.txt'), readme(folder, now.toISOString().replace('T', ' ').slice(0, 16), { data, store })); } catch (e) { }
  try { fs.writeFileSync(STAMP, JSON.stringify({ day, at: now.toISOString(), folder, notes, data, store, mb: Math.round(dirSize(folder) / 104857.6) / 10 }, null, 1)); } catch (e) { }

  /* keep the newest few, drop the rest (undo copies made by a restore are kept too, but fewer of them) */
  let pruned = 0;
  for (const b of list().slice(KEEP)) { rm(path.join(DEST, b.name)); pruned++; }
  try {
    const undo = fs.readdirSync(DEST, { withFileTypes: true }).filter(d => d.isDirectory() && /^before-restore-/.test(d.name)).map(d => d.name).sort().reverse();
    for (const old of undo.slice(3)) { rm(path.join(DEST, old)); pruned++; }
  } catch (e) { }
  return { ok: true, folder, notes, data, store, pruned };
}

function status() {
  const last = read(), all = list();
  return {
    dir: DEST, where: place(), older: place() === 'local' && fs.existsSync(cloudDest()) ? cloudDest() : '', last, count: all.length, backups: all.slice(0, KEEP),
    place: DEST.replace(os.homedir() + path.sep, ''), keep: KEEP,
    stale: !last || (Date.now() - Date.parse(last.at)) > 3 * 864e5
  };
}

module.exports = { run, status, list, setPlace, get DEST() { return DEST; }, notesDir, dataFiles };

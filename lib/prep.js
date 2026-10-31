// Preparedness: household data, readiness checks, "stock up" downloads (offline libraries and models), self-repair.
const fs = require('fs'), path = require('path'), cp = require('child_process'), http = require('http');
const U = require('./util');

const ROOT = path.join(__dirname, '..'), DATA = path.join(ROOT, 'data'), LIB = path.join(ROOT, 'nomad', 'library');
const PREP = path.join(DATA, 'prep.json'), BACKUP = path.join(DATA, 'last-backup.json');
const ps = (cmd, ms = 30000) => new Promise(res => cp.execFile('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', cmd], { windowsHide: true, timeout: ms, maxBuffer: 4e6 }, (e, out) => res(e ? '' : String(out))));

/* ---------- household data (profile, people, contacts, supplies, places) ---------- */
const EMPTY = { profile: { adults: 2, children: 0, pets: 0, days: 7, needs: '', climate: 'temperate', location: null }, people: [], contacts: [], places: { meet1: '', meet2: '', outOfArea: '', shutoffs: '', notes: '' }, supplies: [], done: {} };
function load() { const d = U.readJson(PREP, null); return d && typeof d === 'object' ? Object.assign({}, EMPTY, d, { profile: Object.assign({}, EMPTY.profile, d.profile || {}), places: Object.assign({}, EMPTY.places, d.places || {}) }) : JSON.parse(JSON.stringify(EMPTY)); }
function save(d) {
  if (!d || typeof d !== 'object') return false;
  const clip = (a, n) => (Array.isArray(a) ? a.slice(0, n) : []);
  U.writeJson(PREP, { profile: d.profile || EMPTY.profile, people: clip(d.people, 40), contacts: clip(d.contacts, 500), places: d.places || EMPTY.places, supplies: clip(d.supplies, 800), done: d.done && typeof d.done === 'object' ? d.done : {} }); return true;
}
function noteBackup() { U.writeJson(BACKUP, { at: Date.now() }); }

/* ---------- catalog of things worth stocking up on while the internet works ---------- */
const K = 'https://download.kiwix.org/zim/';
const CATALOG = [
  { id: 'disaster', group: 'Survival', name: 'Post-disaster rebuilding', desc: 'Water, shelter, food, medicine, tools and rebuilding after a disaster', url: K + 'other/zimgit-post-disaster_en_2024-05.zim', mb: 615 },
  { id: 'water', group: 'Survival', name: 'Water purification and storage', desc: 'Making water safe, storing it, finding it', url: K + 'other/zimgit-water_en_2024-08.zim', mb: 20 },
  { id: 'food', group: 'Survival', name: 'Food preparation and preservation', desc: 'Cooking and storing food without a grid', url: K + 'other/zimgit-food-preparation_en_2025-04.zim', mb: 93 },
  { id: 'medicine', group: 'Survival', name: 'Field medicine guides', desc: 'Practical treatment guides for when help is far away', url: K + 'other/zimgit-medicine_en_2024-08.zim', mb: 67 },
  { id: 'knots', group: 'Survival', name: 'Knots', desc: 'Illustrated knot guides', url: K + 'other/zimgit-knots_en_2024-08.zim', mb: 27 },
  { id: 'appropedia', group: 'Survival', name: 'Appropedia (low-tech solutions)', desc: 'Solar power, water, sanitation, cooking, building', url: K + 'other/appropedia_en_all_maxi_2026-02.zim', mb: 555 },
  { id: 'trueprepper', group: 'Survival', name: 'TruePrepper', desc: 'Preparedness plans, gear and how-tos', url: K + 'other/trueprepper.com_en_all_2026-05.zim', mb: 1358 },
  { id: 'outdoors', group: 'Skills', name: 'Outdoors Q&A', desc: 'Shelter, navigation, fire, camping, hiking', url: K + 'stack_exchange/outdoors.stackexchange.com_en_all_2026-10.zim', mb: 135 },
  { id: 'ham', group: 'Skills', name: 'Ham radio Q&A', desc: 'Radios, antennas, licensing, emergency comms', url: K + 'stack_exchange/ham.stackexchange.com_en_all_2026-10.zim', mb: 74 },
  { id: 'mechanics', group: 'Skills', name: 'Car repair Q&A', desc: 'Keeping a vehicle running', url: K + 'stack_exchange/mechanics.stackexchange.com_en_all_2026-10.zim', mb: 326 },
  { id: 'gardening', group: 'Skills', name: 'Gardening Q&A', desc: 'Growing food, soil, pests, seasons', url: K + 'stack_exchange/gardening.stackexchange.com_en_all_2026-10.zim', mb: 890 },
  { id: 'electronics', group: 'Skills', name: 'Electronics Q&A', desc: 'Circuits, batteries, repairs (large)', url: K + 'stack_exchange/electronics.stackexchange.com_en_all_2026-10.zim', mb: 4096 },
  { id: 'ifixit', group: 'Skills', name: 'iFixit repair guides', desc: 'Phones, laptops, appliances, vehicles (large)', url: K + 'ifixit/ifixit_en_all_2025-12.zim', mb: 3380 },
  { id: 'g-medicine', group: 'Books', name: 'Gutenberg: Medicine', desc: 'Thousands of public-domain medical and health books', url: K + 'gutenberg/gutenberg_en_lcc-r_2026-03.zim', mb: 1926 },
  { id: 'g-agri', group: 'Books', name: 'Gutenberg: Agriculture, hunting and fishing', desc: 'Farming, animals, gardening, preserving, hunting, fishing', url: K + 'gutenberg/gutenberg_en_lcc-s_2026-03.zim', mb: 4323 },
  { id: 'g-military', group: 'Books', name: 'Gutenberg: Military science', desc: 'Field craft, drill manuals, fortification, history', url: K + 'gutenberg/gutenberg_en_lcc-u_2026-03.zim', mb: 1228 },
  { id: 'g-naval', group: 'Books', name: 'Gutenberg: Naval science', desc: 'Navigation, seamanship, boats', url: K + 'gutenberg/gutenberg_en_lcc-v_2026-03.zim', mb: 1305 },
  { id: 'g-tech', group: 'Books', name: 'Gutenberg: Technology (large)', desc: 'Engineering, building, electricity, radio, trades, home economics', url: K + 'gutenberg/gutenberg_en_lcc-t_2026-03.zim', mb: 12288 },
  { id: 'g-geo', group: 'Books', name: 'Gutenberg: Geography and recreation', desc: 'Travel, camping, maps, customs', url: K + 'gutenberg/gutenberg_en_lcc-g_2026-03.zim', mb: 7680 },
  { id: 'g-lit-general', group: 'Classics', name: 'Gutenberg: Literature (general)', desc: 'Guides and histories of literature', url: K + 'gutenberg/gutenberg_en_lcc-p_2026-03.zim', mb: 37 },
  { id: 'g-lit-russian', group: 'Classics', name: 'Gutenberg: Russian literature', desc: 'Tolstoy, Dostoevsky, Chekhov, Turgenev, Gogol', url: K + 'gutenberg/gutenberg_en_lcc-pg_2026-03.zim', mb: 261 },
  { id: 'g-lit-german', group: 'Classics', name: 'Gutenberg: German literature', desc: 'Goethe, Schiller, Kafka, Grimm fairy tales', url: K + 'gutenberg/gutenberg_en_lcc-pt_2026-03.zim', mb: 724 },
  { id: 'g-lit-classical', group: 'Classics', name: 'Gutenberg: Greek and Latin classics', desc: 'Homer, Plato, Virgil, Ovid, Greek tragedy', url: K + 'gutenberg/gutenberg_en_lcc-pa_2026-03.zim', mb: 498 },
  { id: 'g-lit-romance', group: 'Classics', name: 'Gutenberg: French, Italian and Spanish literature', desc: 'Dante, Cervantes, Hugo, Dumas, Flaubert, Moliere', url: K + 'gutenberg/gutenberg_en_lcc-pq_2026-03.zim', mb: 3800 },
  { id: 'g-lit-world', group: 'Classics', name: 'Gutenberg: Poetry, drama and story collections', desc: 'Anthologies, plays, poems, folk tales, short stories from everywhere', url: K + 'gutenberg/gutenberg_en_lcc-pn_2026-03.zim', mb: 3000 },
  { id: 'g-lit-english', group: 'Classics', name: 'Gutenberg: English literature (large)', desc: 'Shakespeare, Dickens, Austen, the Brontes, Wilde, Conan Doyle, Wells', url: K + 'gutenberg/gutenberg_en_lcc-pr_2026-03.zim', mb: 15000, optional: true },
  { id: 'g-lit-american', group: 'Classics', name: 'Gutenberg: American literature (large)', desc: 'Twain, Poe, Melville, Hawthorne, Alcott, London, Whitman', url: K + 'gutenberg/gutenberg_en_lcc-ps_2026-03.zim', mb: 15000, optional: true },
  { id: 'g-fiction', group: 'Classics', name: 'Gutenberg: Fiction and juvenile (large)', desc: 'Adventure, mystery, sci-fi and children\'s stories, many short stories', url: K + 'gutenberg/gutenberg_en_lcc-pz_2026-03.zim', mb: 18000, optional: true },
  { id: 'wikibooks', group: 'Books', name: 'Wikibooks (no pictures)', desc: 'Free textbooks, cookbooks and manuals', url: K + 'wikibooks/wikibooks_en_all_nopic_2026-04.zim', mb: 3345 },
  { id: 'wikivoyage', group: 'Books', name: 'Wikivoyage travel guides', desc: 'Places, transport and local tips (large)', url: K + 'wikivoyage/wikivoyage_en_all_maxi_2026-09.zim', mb: 1100, optional: true },
];
const MODELS = [
  { id: 'qwen3.5:2b', name: 'Qwen3.5 2B (low-power)', desc: 'Light on battery and memory; supports pictures and tools', mb: 2700 },
  { id: 'qwen3.5:0.8b', name: 'Qwen3.5 0.8B (tiny)', desc: 'Smallest and fastest, much less capable', mb: 1200 },
];
const stem = f => f.replace(/\.zim$/i, '').replace(/_\d{4}-\d{2}$/, '');
const fname = u => u.split('/').pop();

/* ---------- the chess engine: the one download that is not a book ----------
   Able to fetch Stockfish on demand, so a fresh or repaired copy of Moundshroud can get it back in one click,
   and it is refused unless the file matches the size and SHA-256 published with the official release. */
const ENGDIR = path.join(ROOT, 'engines', 'stockfish'), ENGDUMP = path.join(ROOT, 'nomad', 'dl-engines');
const ENGINES = [
  {
    id: 'stockfish', group: 'Chess engine', name: 'Stockfish 19 (full-strength chess engine)',
    desc: 'About 3500 Elo. Plays the top chess levels, analyses your games and studies in the background. 78 MB, straight from the official Stockfish release; Moundshroud checks it against the published fingerprint before installing.',
    url: 'https://github.com/official-stockfish/Stockfish/releases/download/sf_19/stockfish-windows-x86-64-universal.zip',
    mb: 78, bytes: 81431614, sha256: '3c8bf1f9ea66a09350a40df4f632288285ac206d99f33ab5842c408fc30b48a7',
    exe: path.join(ENGDIR, 'stockfish.exe')
  },
];
let engBusy = false, engNote = '';
const engJob = e => 'MOUNDSHROUD ENGINE ' + e.id;
const engineInstalled = (e = ENGINES[0]) => { try { return fs.existsSync(e.exe) && fs.statSync(e.exe).size > 1048576; } catch (x) { return false; } };
async function getEngine(id) {
  const e = ENGINES.find(x => x.id === id); if (!e) return { error: 'unknown item' };
  if (engineInstalled(e)) return { ok: true, status: 'installed' };
  const jobs = await bits(); if (jobs.some(j => j.DisplayName === engJob(e))) return { ok: true, status: 'downloading' };
  fs.mkdirSync(ENGDUMP, { recursive: true }); engNote = '';
  await ps("Start-BitsTransfer -Source '" + e.url + "' -Destination '" + path.join(ENGDUMP, fname(e.url)).replace(/'/g, "''") + "' -Asynchronous -DisplayName '" + engJob(e) + "' -Priority Normal | Out-Null", 60000);
  return { ok: true, status: 'downloading', mb: e.mb };
}
/* finishes a transferred engine download: checks it, unpacks it and puts the program where the chess pages look for it */
async function finishEngine() {
  const e = ENGINES[0];
  /* only called once the transfer is finished: BITS keeps the bytes in a temporary file until the job is completed,
     so completing it first is what puts stockfish-...zip at its destination below */
  await ps("Get-BitsTransfer -ErrorAction SilentlyContinue | Where-Object { $_.DisplayName -eq '" + engJob(e) + "' -and $_.JobState -eq 'Transferred' } | Complete-BitsTransfer", 120000);
  const zip = path.join(ENGDUMP, fname(e.url));
  if (!fs.existsSync(zip)) { engNote = 'The engine download did not arrive. Try again.'; return { error: engNote }; }
  const size = fs.statSync(zip).size;
  if (size !== e.bytes) { try { fs.unlinkSync(zip); } catch (x) { } engNote = 'The engine download was the wrong size, so it was thrown away. Try again.'; return { error: engNote }; }
  const got = (await ps("(Get-FileHash -Algorithm SHA256 -LiteralPath '" + zip.replace(/'/g, "''") + "').Hash", 180000)).trim().toLowerCase();
  if (got !== e.sha256) { try { fs.unlinkSync(zip); } catch (x) { } engNote = 'The engine file did not match the fingerprint published with the release, so it was thrown away. Try again, or tell Moundshroud about this on the Guide page.'; return { error: engNote }; }
  const stage = path.join(ENGDUMP, 'unpack');
  fs.rmSync(stage, { recursive: true, force: true });
  await ps("Expand-Archive -LiteralPath '" + zip.replace(/'/g, "''") + "' -DestinationPath '" + stage.replace(/'/g, "''") + "' -Force", 300000);
  fs.mkdirSync(ENGDIR, { recursive: true });
  const out = await ps("$f = Get-ChildItem '" + stage.replace(/'/g, "''") + "' -Recurse -File; $exe = $f | Where-Object { $_.Name -eq 'stockfish.exe' } | Select-Object -First 1; if (-not $exe) { $exe = $f | Where-Object { $_.Extension -eq '.exe' } | Select-Object -First 1 }; if (-not $exe) { 'NOEXE' } else { Copy-Item $exe.FullName '" + e.exe.replace(/'/g, "''") + "' -Force; $f | Where-Object { $_.Extension -in '.nnue','.txt','.md' -or $_.Name -eq 'AUTHORS' } | ForEach-Object { Copy-Item $_.FullName (Join-Path '" + ENGDIR.replace(/'/g, "''") + "' $_.Name) -Force }; 'OK' }", 180000);
  try { fs.rmSync(stage, { recursive: true, force: true }); fs.unlinkSync(zip); } catch (x) { }
  if (!/OK/.test(out) || !engineInstalled(e)) { engNote = 'The download arrived but the engine program was not inside it.'; return { error: engNote }; }
  try {
    fs.writeFileSync(path.join(ENGDIR, 'ENGINE-SOURCE.txt'), 'Stockfish, installed by Moundshroud (Prepare > Stock up).\n\nSource: ' + e.url + '\nSize: ' + size + ' bytes\nSHA-256 (matched before unpacking): ' + e.sha256 + '\nInstalled: ' + new Date().toISOString() + '\n\nStockfish is free software under the GPL-3.0; the licence is beside the program (Copying.txt).\n');
  } catch (x) { }
  engNote = '';
  return { ok: true, installed: true };
}
const installedFor = item => { try { return fs.readdirSync(LIB).some(f => /\.zim$/i.test(f) && stem(f) === stem(fname(item.url))); } catch (e) { return false; } };

async function bits() {
  const o = await ps("Get-BitsTransfer -ErrorAction SilentlyContinue | Where-Object { $_.DisplayName -like 'KIWIX *' -or $_.DisplayName -like 'MOUNDSHROUD ENGINE *' } | Select-Object DisplayName,@{n='JobState';e={[string]$_.JobState}},BytesTransferred,BytesTotal | ConvertTo-Json -Compress");
  try { const j = JSON.parse(o); return (Array.isArray(j) ? j : [j]).filter(Boolean); } catch (e) { return []; }
}
/* finishes completed transfers (BITS keeps them as temp files until told to complete) - returns true if a book was added */
async function finishBits() {
  const jobs = await bits(); const done = jobs.filter(j => j.JobState === 'Transferred');
  if (done.length) await ps("Get-BitsTransfer -ErrorAction SilentlyContinue | Where-Object { $_.DisplayName -like 'KIWIX *' -and $_.JobState -eq 'Transferred' } | Complete-BitsTransfer");
  const bad = jobs.filter(j => /Error|TransientError|Suspended/.test(j.JobState));
  if (bad.length) await ps("Get-BitsTransfer -ErrorAction SilentlyContinue | Where-Object { $_.DisplayName -like 'KIWIX *' -and $_.JobState -match 'TransientError|Suspended' } | Resume-BitsTransfer -Asynchronous");
  return done.length > 0;
}
async function stock() {
  let jobs = await bits(), added = false;
  if (jobs.some(j => j.JobState === 'Transferred' && /^KIWIX /.test(j.DisplayName))) { added = await finishBits(); jobs = await bits(); }
  else if (jobs.some(j => /TransientError|Suspended/.test(j.JobState))) await finishBits();
  /* a finished engine download is completed, checked and unpacked quietly in the background, so the page keeps answering */
  const ejobs = jobs.filter(j => j.DisplayName === engJob(ENGINES[0]));
  if (!engBusy && ejobs.some(j => /TransientError|Suspended/.test(j.JobState))) {
    /* a stalled transfer is nudged along; no install is attempted, because the file is not there yet */
    ps("Get-BitsTransfer -ErrorAction SilentlyContinue | Where-Object { $_.DisplayName -eq '" + engJob(ENGINES[0]) + "' -and $_.JobState -match 'TransientError|Suspended' } | Resume-BitsTransfer -Asynchronous", 60000).catch(() => { });
  }
  if (!engBusy && ejobs.some(j => j.JobState === 'Transferred')) {
    engBusy = true; finishEngine().catch(() => { }).then(() => { engBusy = false; });
  }
  let disk = null; try { const s = fs.statfsSync('C:\\'); disk = { freeGB: Math.round(s.bavail * s.bsize / 1073741824), pct: Math.round(s.bavail / s.blocks * 1000) / 10 }; } catch (e) {}
  const items = CATALOG.map(c => {
    const j = jobs.find(x => x.DisplayName === 'KIWIX ' + fname(c.url)); const inst = installedFor(c);
    return { id: c.id, group: c.group, name: c.name, desc: c.desc, mb: c.mb, optional: !!c.optional, status: inst ? 'installed' : j ? (j.JobState === 'Error' ? 'error' : 'downloading') : 'available', pct: j && j.BytesTotal > 0 ? Math.round(j.BytesTransferred / j.BytesTotal * 100) : 0 };
  });
  const engines = ENGINES.map(e => {
    const inst = engineInstalled(e), j = jobs.find(x => x.DisplayName === engJob(e)), active = inst ? 'installed' : engBusy ? 'installing' : j ? (j.JobState === 'Error' ? 'error' : 'downloading') : 'available';
    const note = active === 'installing' ? 'Checking the fingerprint and unpacking it now...' : (active === 'available' && engNote ? engNote : e.desc);
    return { id: e.id, group: e.group, name: e.name, desc: note, mb: e.mb, optional: false, needed: !inst, status: active, pct: j && j.BytesTotal > 0 ? Math.round(j.BytesTransferred / j.BytesTotal * 100) : 0 };
  });
  return { items, engines, added, disk };
}
/* one entry point for the Download button: books go to the library, the chess engine goes to engines\stockfish */
async function getStock(id) {
  if (ENGINES.some(e => e.id === id)) return getEngine(id);
  return getBook(id);
}
async function getBook(id) {
  const c = CATALOG.find(x => x.id === id); if (!c) return { error: 'unknown item' }; if (installedFor(c)) return { ok: true, status: 'installed' };
  const jobs = await bits(); if (jobs.some(j => j.DisplayName === 'KIWIX ' + fname(c.url))) return { ok: true, status: 'downloading' };
  fs.mkdirSync(LIB, { recursive: true }); const dest = path.join(LIB, fname(c.url));
  await ps("Start-BitsTransfer -Source '" + c.url + "' -Destination '" + dest.replace(/'/g, "''") + "' -Asynchronous -DisplayName 'KIWIX " + fname(c.url) + "' -Priority Low | Out-Null", 60000);
  return { ok: true, status: 'downloading' };
}

/* ---------- model pulls (through Ollama) ---------- */
let pull = null;
function ollamaJson(OLL, pth, body, onLine) {
  return new Promise(resolve => {
    const p = JSON.stringify(body); const r = http.request({ ...OLL, path: pth, method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(p) } }, res => {
      let buf = ''; res.on('data', c => { buf += c; let i; while ((i = buf.indexOf('\n')) >= 0) { const ln = buf.slice(0, i).trim(); buf = buf.slice(i + 1); if (ln) { try { onLine(JSON.parse(ln)); } catch (e) {} } } }); res.on('end', () => resolve(true));
    }); r.on('error', () => resolve(false)); r.end(p);
  });
}
function startPull(OLL, id) {
  const m = MODELS.find(x => x.id === id); if (!m) return { error: 'unknown model' };
  if (pull && pull.model === id && pull.running) return { ok: true };
  pull = { model: id, running: true, status: 'starting', pct: 0, error: '' };
  ollamaJson(OLL, '/api/pull', { model: id, stream: true }, j => { if (j.error) pull.error = j.error; if (j.status) pull.status = j.status; if (j.total) pull.pct = Math.round((j.completed || 0) / j.total * 100); }).then(ok => { pull.running = false; if (!ok && !pull.error) pull.error = 'The AI engine did not respond'; if (!pull.error) { pull.status = 'success'; pull.pct = 100; } });
  return { ok: true };
}
const pullStatus = () => pull || { running: false };

/* ---------- readiness ---------- */
const run = (exe, args, ms = 8000) => new Promise(res => cp.execFile(exe, args, { windowsHide: true, timeout: ms }, (e, out) => res(e ? '' : String(out))));
async function health(ctx) {
  const [tray, auto] = await Promise.all([run('tasklist', ['/FI', 'IMAGENAME eq assistant-listener.exe', '/NH']), run('reg', ['query', 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run', '/v', 'OfflineAssistant'])]);
  let disk = null; try { const s = fs.statfsSync('C:\\'); disk = { freeGB: Math.round(s.bavail * s.bsize / 1073741824), totalGB: Math.round(s.blocks * s.bsize / 1073741824) }; if (disk) disk.pct = Math.round(disk.freeGB / disk.totalGB * 1000) / 10; } catch (e) {}
  const lb = U.readJson(BACKUP, null); const d = load();
  return {
    ollama: ctx.ollama, models: ctx.models || [], lowModel: (ctx.models || []).some(n => /qwen3\.5:(0\.8|2)b/i.test(n) || /:(1|2|3)b\b/i.test(n)),
    books: ctx.books || [], disk, office: ctx.office, voice: ctx.voice, ocr: fs.existsSync(path.join(ROOT, 'ocr.ps1')), cyberchef: ctx.chef, stockfish: engineInstalled(),
    tray: /assistant-listener/i.test(tray), autostart: /OfflineAssistant/i.test(auto), lastBackup: lb ? lb.at : 0, safety: ctx.safety || null,
    household: { people: d.people.length, contacts: d.contacts.length, supplies: d.supplies.length, haveSupplies: d.supplies.filter(s => s.have).length, profile: !!(d.profile && (d.profile.adults || d.profile.children)), places: !!(d.places.meet1 || d.places.outOfArea) }
  };
}

module.exports = { load, save, noteBackup, stock, getBook, getStock, getEngine, finishBits, finishEngine, engineInstalled, ENGINES, MODELS, startPull, pullStatus, health, CATALOG };

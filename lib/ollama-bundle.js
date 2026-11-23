// The AI engine and the models that come with the app.
//
// Moundshroud carries its own copy of Ollama in runtime\ollama, so a fresh copy of the app can run a model without the
// person installing anything else. The engine uses the normal Ollama model store (or OLLAMA_MODELS when it is set), so a
// model that is already on this PC is never downloaded twice and nothing that works today stops working.
//
// The models that come with it are the small Qwen 3.5 family: 0.8B (tiny), 2B (everyday) and 4B (the best small one).
const fs = require('fs'), os = require('os'), path = require('path'), http = require('http'), cp = require('child_process');
const ROOT = path.join(__dirname, '..');
const DIR = path.join(ROOT, 'runtime', 'ollama');
const EXE = path.join(DIR, 'ollama.exe');
const ZIP = 'https://ollama.com/download/ollama-windows-amd64.zip';       // Ollama's own portable Windows build
const OLLAMA = { host: '127.0.0.1', port: 11434 };

const FAMILY = [
  { id: 'qwen3.5:0.8b', name: 'Qwen3.5 0.8B', mb: 1200, note: 'the tiny one: fastest, for a small laptop' },
  { id: 'qwen3.5:2b', name: 'Qwen3.5 2B', mb: 2700, note: 'the everyday one: reads pictures, uses tools, light on power' },
  { id: 'qwen3.5:4b', name: 'Qwen3.5 4B', mb: 4900, note: 'the best small one: sharper answers, wants more memory' },
];

const exists = p => { try { return fs.existsSync(p); } catch (e) { return false; } };
const bundled = () => exists(EXE);
/* the engine to run: the app's own copy first, then the normal Windows install, then whatever is on the PATH */
function exe() {
  if (bundled()) return EXE;
  const inst = path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Ollama', 'ollama.exe');
  if (exists(inst)) return inst;
  return 'ollama';
}
const isBundled = p => String(p || '').toLowerCase() === EXE.toLowerCase();

function ps(cmd, ms) {
  return new Promise(resolve => cp.execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', cmd],
    { windowsHide: true, timeout: ms || 900000, maxBuffer: 4e6 },
    (e, out, err) => resolve({ code: e ? (typeof e.code === 'number' ? e.code : 1) : 0, out: String(out || ''), err: String(err || '') })));
}
function json(pth, method, body, onLine) {
  return new Promise(resolve => {
    const text = body == null ? '' : JSON.stringify(body);
    const r = http.request({ ...OLLAMA, path: pth, method, timeout: 15000,
      headers: text ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(text) } : {} }, res => {
      let buf = '';
      res.on('data', c => {
        buf += c;
        if (!onLine) return;
        let i;
        while ((i = buf.indexOf('\n')) >= 0) { const ln = buf.slice(0, i).trim(); buf = buf.slice(i + 1); if (ln) { try { onLine(JSON.parse(ln)); } catch (e) { } } }
      });
      res.on('end', () => { let j = null; try { j = JSON.parse(buf || '{}'); } catch (e) { } resolve({ ok: res.statusCode >= 200 && res.statusCode < 300, status: res.statusCode, json: j }); });
    });
    r.on('error', e => resolve({ ok: false, error: e.message }));
    r.on('timeout', () => { r.destroy(); resolve({ ok: false, error: 'Ollama took too long to answer' }); });
    r.end(text);
  });
}
const up = async () => (await json('/api/version', 'GET')).ok;
/* the models the engine already has, as plain lowercase names */
async function installed() {
  const r = await json('/api/tags', 'GET');
  const rows = (r.json && r.json.models) || [];
  return r.ok ? rows.map(m => String(m.name || '')).filter(Boolean) : null;      // null: the engine did not answer, so nothing is known
}
/* a model counts as here when it is the family member itself, or a copy of it under another name (qwen2b, qwen08b,
   qwen4b-agent), so a PC that already has one is never made to download the same weights twice */
function here(name, id) {
  const n = String(name || '').toLowerCase().replace(/:latest$/, ''), want = id.toLowerCase();
  if (!n) return false;
  if (n === want) return true;
  if (!/^qwen/.test(n)) return false;
  const size = want.split(':')[1] || '';
  const alias = { '0.8b': /0[._]?8b/, '2b': /(^|[^0-9.])2b/, '4b': /(^|[^0-9.])4b/ }[size];
  return !!alias && alias.test(n);
}
async function status() {
  const have = await installed().catch(() => null);
  const same = id => have.some(n => here(n, id));
  const family = FAMILY.map(f => Object.assign({}, f, { installed: have ? same(f.id) : null }));
  return {
    bundled: bundled(), exe: exe(), running: have !== null, known: have !== null, family,
    installed: family.filter(f => f.installed === true).map(f => f.id), missing: family.filter(f => f.installed === false).map(f => f.id),
    ready: family.every(f => f.installed === true), models: have || [], zip: ZIP,
  };
}

/* starts the engine (its own copy when it is here) and waits for it to answer */
let starting = null;
function start() {
  if (starting) return starting;
  starting = new Promise(async resolve => {
    if (await up()) return resolve(true);
    try { const child = cp.spawn(exe(), ['serve'], { stdio: 'ignore', windowsHide: true, detached: false, env: Object.assign({}, process.env, { OLLAMA_KEEP_ALIVE: '3m' }) }); child.on('error', () => { }); child.unref(); } catch (e) { }
    let n = 0;
    const t = setInterval(async () => { if (await up() || ++n > 80) { clearInterval(t); resolve(await up()); } }, 500);
  }).finally(() => { starting = null; });
  return starting;
}

/* puts the app's own copy of Ollama in runtime\ollama */
async function installRuntime() {
  if (bundled()) return { ok: true, already: true };
  fs.mkdirSync(DIR, { recursive: true });
  const tmp = path.join(os.tmpdir(), 'ollama-' + Date.now() + '.zip');
  const get = await ps("$ProgressPreference='SilentlyContinue'; Invoke-WebRequest -Uri '" + ZIP + "' -OutFile '" + tmp.replace(/'/g, "''") + "' -UseBasicParsing", 900000);
  if (get.code !== 0 || !exists(tmp)) return { ok: false, error: 'The AI engine could not be downloaded. Check the connection, then try again.' };
  const un = await ps("Expand-Archive -LiteralPath '" + tmp.replace(/'/g, "''") + "' -DestinationPath '" + DIR.replace(/'/g, "''") + "' -Force", 600000);
  try { fs.unlinkSync(tmp); } catch (e) { }
  if (un.code !== 0 || !bundled()) return { ok: false, error: 'The download arrived but did not contain the engine (ollama.exe).' };
  return { ok: true, exe: EXE };
}

/* one job at a time: install the engine if it is missing, wake it, then fetch the part of the family that is not here */
let job = null;
const note = t => { if (job) job.step = t; };
function setup() {
  if (job && job.running) return job;
  job = { running: true, step: 'checking', pct: 0, error: '', done: [] };
  (async () => {
    try {
      if (!bundled()) {
        const i = await installRuntime();
        if (!i.ok) throw new Error(i.error);
      }
      note('waking the AI engine');
      if (!await start()) throw new Error('The AI engine did not start. Try again, or run the app\'s setup again.');
      const have = await installed();
      const want = FAMILY.filter(f => !(have || []).some(n => here(n, f.id)));
      for (let k = 0; k < want.length; k++) {
        const f = want[k];
        note('downloading ' + f.name + ' (' + (k + 1) + ' of ' + want.length + ', ' + (f.mb / 1000).toFixed(1) + ' GB)');
        job.pct = 0;
        const r = await json('/api/pull', 'POST', { model: f.id, stream: true }, j => {
          if (j.error) job.error = j.error;
          if (j.status) note('downloading ' + f.name + ' (' + (k + 1) + ' of ' + want.length + '): ' + j.status);
          if (j.total) job.pct = Math.round((j.completed || 0) / j.total * 100);
        });
        if (!r.ok) throw new Error((r.json && r.json.error) || (r.error || 'Downloading ' + f.id + ' failed.'));
        job.done.push(f.id);
      }
      note(want.length ? 'ready' : 'already here');
      job.pct = 100;
    } catch (e) {
      job.error = String((e && e.message) || e);
      note('stopped');
    } finally { job.running = false; }
  })();
  return job;
}
const state = () => job || { running: false };

module.exports = { FAMILY, DIR, EXE, ZIP, exe, isBundled, bundled, installed, status, start, installRuntime, setup, state, _test: { ps, here } };

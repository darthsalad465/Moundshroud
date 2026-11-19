// Real QLoRA fine-tuning on the GPU. A one-time setup builds a Python environment; then a job trains LoRA adapters on
// your examples, merges them, exports GGUF and imports the result into Ollama. Everything runs on this PC.
const cp = require('child_process'), path = require('path'), fs = require('fs');
const ROOT = path.join(__dirname, '..'), RT = path.join(ROOT, 'runtime');
const VENV_PY = path.join(RT, 'ftenv', 'Scripts', 'python.exe');
const READY = path.join(RT, 'ft-ready'), SETUP_LOG = path.join(RT, 'ft-setup.log');
const SETUP_PS = path.join(ROOT, 'scripts', 'ft-setup.ps1'), TRAIN_PY = path.join(ROOT, 'scripts', 'finetune.py');
const JOBS = path.join(ROOT, 'data', 'finetune');
const OLLAMA_EXE = path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Ollama', 'ollama.exe');
const ollama = fs.existsSync(OLLAMA_EXE) ? OLLAMA_EXE : 'ollama';
const BASES = [
  { id: 'Qwen/Qwen2.5-3B-Instruct', name: 'Qwen2.5 3B (stronger, slower)' },
  { id: 'HuggingFaceTB/SmolLM2-1.7B-Instruct', name: 'SmolLM2 1.7B' },
  { id: 'Qwen/Qwen2.5-1.5B-Instruct', name: 'Qwen2.5 1.5B (good balance)' },
  { id: 'Qwen/Qwen2.5-0.5B-Instruct', name: 'Qwen2.5 0.5B (tiny, fastest)' },
];
let setupProc = null, trainProc = null, trainId = '';
const tail = (f, n) => { try { return fs.readFileSync(f, 'utf8').split('\n').filter(Boolean).slice(-n).join('\n'); } catch (e) { return ''; } };

function status() {
  return { installed: fs.existsSync(READY) && fs.existsSync(VENV_PY), installing: !!setupProc, training: !!trainProc, trainId, bases: BASES };
}
function install() {
  if (setupProc) return { ok: true, already: true };
  if (!fs.existsSync(SETUP_PS)) return { ok: false, error: 'setup script missing' };
  fs.mkdirSync(RT, { recursive: true });
  const out = fs.openSync(SETUP_LOG, 'w');
  setupProc = cp.spawn('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', SETUP_PS], { cwd: ROOT, windowsHide: true, stdio: ['ignore', out, out] });
  setupProc.on('exit', () => { setupProc = null; });
  return { ok: true, started: true };
}
const installLog = () => tail(SETUP_LOG, 60);

function train(cfg) {
  if (trainProc) return { ok: false, error: 'A fine-tune is already running.' };
  if (!(fs.existsSync(READY) && fs.existsSync(VENV_PY))) return { ok: false, error: 'Set up fine-tuning first.' };
  const base = (cfg && cfg.base) || ''; if (!BASES.some(b => b.id === base)) return { ok: false, error: 'Pick a base model to train.' };
  const examples = (cfg.examples || []).filter(e => e && e.u && e.a); if (examples.length < 2) return { ok: false, error: 'Add at least 2 examples.' };
  const id = 'ft' + Date.now().toString(36), dir = path.join(JOBS, id); fs.mkdirSync(dir, { recursive: true });
  const sys = (cfg.system || '').trim();
  const jl = examples.map(e => JSON.stringify({ messages: (sys ? [{ role: 'system', content: sys }] : []).concat([{ role: 'user', content: e.u }, { role: 'assistant', content: e.a }]) })).join('\n');
  fs.writeFileSync(path.join(dir, 'data.jsonl'), jl);
  fs.writeFileSync(path.join(dir, 'config.json'), JSON.stringify({ base, epochs: Math.max(1, Math.min(10, +cfg.epochs || 3)), lr: 2e-4, lora_r: Math.max(8, Math.min(64, +cfg.lora_r || 16)), cutoff: 1024, name: cfg.name || id, system: sys }));
  const out = fs.openSync(path.join(dir, 'train.log'), 'w');
  trainProc = cp.spawn(VENV_PY, [TRAIN_PY, '--job', dir], { cwd: ROOT, windowsHide: true, stdio: ['ignore', out, out], env: { ...process.env, HF_HUB_DISABLE_SYMLINKS_WARNING: '1' } });
  trainId = id; trainProc.on('exit', () => { trainProc = null; });
  return { ok: true, id };
}
function progress(id) {
  const dir = path.join(JOBS, String(id || trainId)); const raw = tail(path.join(dir, 'train.log'), 400);
  const lines = raw.split('\n').map(l => { try { return JSON.parse(l); } catch (e) { return null; } }).filter(Boolean);
  const done = lines.find(l => l.stage === 'done'), err = lines.find(l => l.stage === 'error');
  return { running: !!trainProc && String(trainId) === String(id), lines: lines.slice(-60), done: !!done, gguf: done && done.gguf, error: err && err.msg };
}
function stop() { if (trainProc && trainProc.pid) { try { cp.spawnSync('taskkill', ['/PID', String(trainProc.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true }); } catch (e) { } } trainProc = null; return { ok: true }; }

function importModel(id, name) {
  return new Promise(res => {
    const dir = path.join(JOBS, String(id || '')), gguf = path.join(dir, 'out', 'model.gguf');
    if (!fs.existsSync(gguf)) return res({ ok: false, error: 'No finished model for this job.' });
    let sys = ''; try { sys = (JSON.parse(fs.readFileSync(path.join(dir, 'config.json'), 'utf8')).system || ''); } catch (e) { }
    const mn = String(name || 'my-tuned').toLowerCase().replace(/[^a-z0-9._-]/g, '-').slice(0, 40) || 'my-tuned';
    const mf = path.join(dir, 'Modelfile');
    fs.writeFileSync(mf, 'FROM ' + gguf.replace(/\\/g, '/') + '\n' + (sys ? 'SYSTEM """' + sys.replace(/"""/g, '') + '"""\n' : ''));
    cp.execFile(ollama, ['create', mn, '-f', mf], { windowsHide: true, timeout: 300000, maxBuffer: 4e6 }, (err, so, se) => {
      if (!err) try { require('./lmstudio-sync').syncAll(); } catch (e) { }
      res(err ? { ok: false, error: ((se || err.message) + '').slice(0, 300) } : { ok: true, name: mn });
    });
  });
}
function stopAll() { stop(); if (setupProc && setupProc.pid) { try { cp.spawnSync('taskkill', ['/PID', String(setupProc.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true }); } catch (e) { } setupProc = null; } }
module.exports = { status, install, installLog, train, progress, stop, importModel, stopAll, BASES };

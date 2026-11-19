// Model Forge: make a brand-new language model from nothing, trained on any text you give it.
// A project holds the text (dropped files, pasted text, your Bible library, folders on this PC); training builds a
// word list, starts a GPT-2-style model from random numbers, trains it on the GPU, converts it to GGUF and adds it
// to Ollama so it appears in Chat. Uses the Python environment set up for fine-tuning (lib/finetune.js).
const cp = require('child_process'), path = require('path'), fs = require('fs'), http = require('http');
const ROOT = path.join(__dirname, '..'), RT = path.join(ROOT, 'runtime'), FORGE = path.join(ROOT, 'data', 'forge');
const VENV_PY = path.join(RT, 'ftenv', 'Scripts', 'python.exe'), READY = path.join(RT, 'ft-ready');
const TRAIN_PY = path.join(ROOT, 'scripts', 'forge_train.py'), BIBLE = path.join(ROOT, 'data', 'christian-texts');
const OLLAMA_EXE = path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Ollama', 'ollama.exe');
const ollama = fs.existsSync(OLLAMA_EXE) ? OLLAMA_EXE : 'ollama';
const SIZES = {
  tiny:   { label: 'Tiny',   n_layer: 4, n_head: 4, n_embd: 256, ctx: 256, vocab: 8192,  batch: 32, minutes: 10,  cap: 20e6,  lr: 8e-4, about: 'About 5 million numbers. Ready in about 10 minutes. Good for a first try.' },
  small:  { label: 'Small',  n_layer: 6, n_head: 8, n_embd: 512, ctx: 512, vocab: 16384, batch: 16, minutes: 40,  cap: 80e6,  lr: 6e-4, about: 'About 27 million numbers. About 40 minutes. Noticeably better writing.' },
  medium: { label: 'Medium', n_layer: 8, n_head: 8, n_embd: 768, ctx: 512, vocab: 24000, batch: 8,  minutes: 120, cap: 200e6, lr: 4e-4, about: 'About 75 million numbers. About 2 hours. Best your laptop can do well.' },
};
const TEXT_EXT = /\.(txt|md|markdown|csv|tsv|json|jsonl|html?|xml|py|js|ts|jsx|tsx|java|c|h|cpp|hpp|cs|go|rs|rb|php|sh|ps1|bat|ya?ml|ini|toml|log|tex|rst|srt|vtt|sql|lua|swift|kt|css)$/i;
let proc = null, procId = '';
const safeId = s => String(s || '').replace(/[^a-z0-9]/gi, '').slice(0, 40);
const pdir = id => path.join(FORGE, safeId(id));
const readJ = (f, d) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return d; } };
const stripHtml = t => t.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/[ \t]+/g, ' ');
const project = id => readJ(path.join(pdir(id), 'project.json'), null);
const saveProject = p => fs.writeFileSync(path.join(pdir(p.id), 'project.json'), JSON.stringify(p, null, 1));
const ready = () => fs.existsSync(READY) && fs.existsSync(VENV_PY);

function walk(dir, cb, depth = 0) {
  if (depth > 8) return true; let ents; try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return true; }
  for (const e of ents) {
    if (e.name.startsWith('.') || e.name === 'node_modules' || e.name === '__pycache__') continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (walk(p, cb, depth + 1) === false) return false; }
    else if (TEXT_EXT.test(e.name)) { if (cb(p) === false) return false; }
  }
  return true;
}
function sourceSize(src) {
  let bytes = 0, files = 0;
  const dir = src.type === 'bible' ? BIBLE : src.path;
  walk(dir, f => { try { bytes += fs.statSync(f).size; files++; } catch (e) { } if (files > 20000) return false; });
  return { bytes, files };
}

function list() {
  try { return fs.readdirSync(FORGE).map(d => project(d)).filter(Boolean).sort((a, b) => (b.created || 0) - (a.created || 0)); } catch (e) { return []; }
}
function create(name) {
  const id = 'm' + Date.now().toString(36);
  fs.mkdirSync(path.join(pdir(id), 'files'), { recursive: true });
  const p = { id, name: String(name || 'My model').slice(0, 60), size: 'tiny', minutes: 0, sources: [], created: Date.now(), model: '' };
  saveProject(p); return p;
}
function info(id) {
  const p = project(id); if (!p) return null;
  const fdir = path.join(pdir(id), 'files'); let files = [];
  try { files = fs.readdirSync(fdir).map(f => ({ name: f, bytes: fs.statSync(path.join(fdir, f)).size })); } catch (e) { }
  const sources = (p.sources || []).map(s => Object.assign({}, s, sourceSize(s)));
  const total = files.reduce((n, f) => n + f.bytes, 0) + sources.reduce((n, s) => n + s.bytes, 0);
  return { project: p, files, sources, total, ready: ready(), sizes: SIZES, training: !!proc && procId === p.id, busy: !!proc && procId !== p.id };
}
function update(id, patch) {
  const p = project(id); if (!p) return { ok: false };
  if (patch.name != null) p.name = String(patch.name).slice(0, 60);
  if (patch.size && SIZES[patch.size]) p.size = patch.size;
  if (patch.minutes != null) p.minutes = Math.max(0, Math.min(600, +patch.minutes || 0));
  saveProject(p); return { ok: true };
}
function addText(id, name, text) {
  if (!project(id)) return { ok: false, error: 'No such project.' };
  let t = String(text || ''); if (!t.trim()) return { ok: false, error: 'That file had no text in it.' };
  if (/\.html?$/i.test(name || '')) t = stripHtml(t);
  const base = String(name || 'pasted').replace(/[^\w.\- ]/g, '_').slice(0, 80) || 'pasted';
  let f = base.replace(/\.[^.]*$/, '') + '.txt', i = 1;
  while (fs.existsSync(path.join(pdir(id), 'files', f))) f = base.replace(/\.[^.]*$/, '') + ' (' + (++i) + ').txt';
  fs.writeFileSync(path.join(pdir(id), 'files', f), t); return { ok: true, file: f };
}
function removeFile(id, file) { try { fs.unlinkSync(path.join(pdir(id), 'files', path.basename(String(file)))); return { ok: true }; } catch (e) { return { ok: false }; } }
function addSource(id, src) {
  const p = project(id); if (!p) return { ok: false, error: 'No such project.' };
  if (src.type === 'bible') { if (!fs.existsSync(BIBLE)) return { ok: false, error: 'The Bible library is not downloaded yet.' }; if (!p.sources.some(s => s.type === 'bible')) p.sources.push({ type: 'bible' }); }
  else if (src.type === 'folder') {
    const dir = path.resolve(String(src.path || '').trim().replace(/^"|"$/g, ''));
    let ok = false; try { ok = fs.statSync(dir).isDirectory(); } catch (e) { }
    if (!ok) return { ok: false, error: 'That folder was not found on this PC.' };
    if (!p.sources.some(s => s.type === 'folder' && s.path === dir)) p.sources.push({ type: 'folder', path: dir });
  } else return { ok: false };
  saveProject(p); return { ok: true };
}
function removeSource(id, idx) { const p = project(id); if (!p) return { ok: false }; p.sources.splice(+idx, 1); saveProject(p); return { ok: true }; }

function buildCorpus(id, cap) {
  const parts = []; let n = 0;
  const add = f => { if (n >= cap) return false; let t = ''; try { t = fs.readFileSync(f, 'utf8'); } catch (e) { return; } if (/\.html?$/i.test(f)) t = stripHtml(t); t = t.slice(0, cap - n); if (t.trim()) { parts.push(t); n += t.length; } };
  walk(path.join(pdir(id), 'files'), add);
  for (const s of (project(id).sources || [])) { if (n >= cap) break; walk(s.type === 'bible' ? BIBLE : s.path, add); }
  return parts.join('\n<|endoftext|>\n');
}
function train(id) {
  const p = project(id); if (!p) return { ok: false, error: 'No such project.' };
  if (!ready()) return { ok: false, error: 'Set up GPU training first (one time).' };
  if (proc) return { ok: false, error: 'Another model is training. Wait for it, or press Finish now on it.' };
  const sz = SIZES[p.size] || SIZES.tiny, run = path.join(pdir(id), 'run');
  try { fs.rmSync(run, { recursive: true, force: true }); } catch (e) { }
  fs.mkdirSync(run, { recursive: true });
  const corpus = buildCorpus(id, sz.cap);
  if (corpus.length < 20000) return { ok: false, error: 'Not enough text yet: give it at least a few pages (about 20,000 characters). It has ' + corpus.length.toLocaleString() + '.' };
  fs.writeFileSync(path.join(run, 'corpus.txt'), corpus);
  fs.writeFileSync(path.join(run, 'config.json'), JSON.stringify(Object.assign({}, sz, { minutes: p.minutes || sz.minutes })));
  const out = fs.openSync(path.join(run, 'train.log'), 'w');
  proc = cp.spawn(VENV_PY, [TRAIN_PY, '--job', run], { cwd: ROOT, windowsHide: true, stdio: ['ignore', out, out] }); procId = p.id;
  proc.on('exit', () => { proc = null; procId = ''; const pp = project(id); if (pp) { pp.lastRun = Date.now(); saveProject(pp); } });
  p.model = ''; saveProject(p);
  return { ok: true, chars: corpus.length };
}
function progress(id) {
  let raw = ''; try { raw = fs.readFileSync(path.join(pdir(id), 'run', 'train.log'), 'utf8'); } catch (e) { }
  const lines = raw.split('\n').map(l => { try { return JSON.parse(l); } catch (e) { return null; } }).filter(Boolean);
  const steps = lines.filter(l => l.stage === 'step'), done = lines.find(l => l.stage === 'done'), err = lines.find(l => l.stage === 'error');
  const msgs = lines.filter(l => l.msg && l.stage !== 'sample' && l.stage !== 'step');
  return { running: !!proc && procId === safeId(id), stage: (lines[lines.length - 1] || {}).stage || '', losses: steps.map(s => [s.step, s.loss]), last: steps[steps.length - 1] || null,
    vals: lines.filter(l => l.stage === 'val').map(v => [v.step, v.val_loss]), samples: lines.filter(l => l.stage === 'sample').map(s => ({ step: s.step, msg: s.msg, text: s.text })).reverse(),
    notes: msgs.map(m => m.msg).slice(-8), done: !!done, error: err ? err.msg : '', params: (lines.find(l => l.stage === 'model') || {}).params || 0, model: (project(id) || {}).model || '' };
}
function finish(id) { try { fs.writeFileSync(path.join(pdir(id), 'run', 'STOP'), '1'); return { ok: true }; } catch (e) { return { ok: false }; } }
function importModel(id) {
  return new Promise(res => {
    const p = project(id), gguf = path.join(pdir(id), 'run', 'out', 'model.gguf');
    if (!p || !fs.existsSync(gguf)) return res({ ok: false, error: 'No finished model to add yet.' });
    const sz = SIZES[p.size] || SIZES.tiny;
    const name = 'forge-' + (p.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30) || p.id);
    const mf = path.join(pdir(id), 'run', 'Modelfile');
    fs.writeFileSync(mf, 'FROM ' + gguf.replace(/\\/g, '/') + '\nTEMPLATE "{{ .Prompt }}"\nPARAMETER temperature 0.8\nPARAMETER repeat_penalty 1.2\nPARAMETER num_ctx ' + sz.ctx + '\nPARAMETER num_predict 200\n');
    cp.execFile(ollama, ['create', name, '-f', mf], { windowsHide: true, timeout: 300000 }, (err, so, se) => {
      if (err) return res({ ok: false, error: ((se || err.message) + '').slice(0, 300) });
      p.model = name; saveProject(p); try { require('./lmstudio-sync').syncAll(); } catch (e) { } res({ ok: true, name });
    });
  });
}
function tryModel(model, prompt) {
  return new Promise(res => {
    const body = JSON.stringify({ model: String(model), prompt: String(prompt || '').slice(0, 2000), stream: false });
    const r = http.request({ host: '127.0.0.1', port: 11434, path: '/api/generate', method: 'POST', headers: { 'Content-Type': 'application/json' }, timeout: 120000 }, rr => { let b = ''; rr.on('data', d => b += d); rr.on('end', () => { try { const j = JSON.parse(b); res(j.error ? { ok: false, error: j.error } : { ok: true, text: j.response || '' }); } catch (e) { res({ ok: false, error: 'No answer.' }); } }); });
    r.on('error', e => res({ ok: false, error: e.message })); r.on('timeout', () => { r.destroy(); res({ ok: false, error: 'Timed out.' }); }); r.end(body);
  });
}
function remove(id) {
  return new Promise(res => {
    const p = project(id); if (!p) return res({ ok: false });
    if (proc && procId === p.id) return res({ ok: false, error: 'It is training. Finish it first.' });
    const done = () => { try { fs.rmSync(pdir(id), { recursive: true, force: true }); } catch (e) { } res({ ok: true }); };
    if (p.model) cp.execFile(ollama, ['rm', p.model], { windowsHide: true, timeout: 30000 }, () => { try { require('./lmstudio-sync').removeModel(p.model); } catch (e) { } done(); }); else done();
  });
}
function stopAll() { if (proc && proc.pid) { try { cp.spawnSync('taskkill', ['/PID', String(proc.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true }); } catch (e) { } } proc = null; procId = ''; }
module.exports = { list, create, info, update, addText, removeFile, addSource, removeSource, train, progress, finish, importModel, tryModel, remove, stopAll, SIZES };

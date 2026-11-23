// Local AI & Media Toolkit: unified backend for 7 lightweight open-source repos in Moundshroud:
//   1. microsoft/markitdown        (Tools > MarkItDown)
//   2. arcee-ai/mergekit           (Studio > Model Suite > Mergekit)
//   3. EleutherAI/lm-evaluation-harness (Studio > Model Suite > Eval Harness)
//   4. karpathy/autoresearch       (Studio > Model Suite > Autoresearch)
//   5. danielgatis/rembg           (Studio > Media Lab > Background Remover)
//   6. xinntao/Real-ESRGAN         (Studio > Media Lab > AI Upscaler)
//   7. facebookresearch/demucs     (Studio > Media Lab > Stem Splitter)
const cp = require('child_process'), fs = require('fs'), os = require('os'), path = require('path');
const U = require('./util');
const heretic = require('./heretic');
const lmstudioSync = require('./lmstudio-sync');

const ROOT = path.join(__dirname, '..');
const DATA = path.join(ROOT, 'data');
const RT = path.join(ROOT, 'runtime');
const VENV_PY = path.join(RT, 'ftenv', 'Scripts', 'python.exe');
const TK_DIR = path.join(RT, 'toolkit');
const WEIGHTS = path.join(TK_DIR, 'weights');
const READY = path.join(RT, 'toolkit-ready');
const SETUP_PS = path.join(ROOT, 'scripts', 'toolkit-setup.ps1');
const SETUP_LOG = path.join(RT, 'toolkit-setup.log');
const SCRIPTS = path.join(ROOT, 'scripts', 'toolkit');
const GGUF_CONV = path.join(ROOT, 'scripts', 'convert_hf_to_gguf.py');
const ollama = require('./ollama-bundle').exe();

let JOBS = path.join(DATA, 'toolkit');
let setupProc = null, activeProc = null, activeId = '', convProc = null, convId = '';

const ANSI_RE = /\x1b\[[0-9;?]*[ -/]*[@-~]|\r/g;
const stripAnsi = s => String(s || '').replace(ANSI_RE, '');
const cleanId = id => /^[a-z0-9_-]{3,48}$/i.test(String(id || '')) ? String(id) : '';
const cleanName = s => String(s || '').replace(/[^a-zA-Z0-9._-]/g, '_').replace(/^_+/, '').slice(0, 80) || 'file';
const cleanModelName = s => String(s || '').toLowerCase().replace(/[^a-z0-9._-]/g, '-').replace(/^-+|-+$/g, '').slice(0, 48) || 'merged-model';
const jobDir = id => path.join(JOBS, id);
const readJob = id => U.readJson(path.join(jobDir(id), 'job.json'), null);
const saveJob = (id, j) => { fs.mkdirSync(jobDir(id), { recursive: true }); U.writeJson(path.join(jobDir(id), 'job.json'), j); };
const tailFile = (f, maxLines) => {
  try {
    const raw = fs.readFileSync(f, 'utf8');
    return stripAnsi(raw).split('\n').slice(-(maxLines || 160)).join('\n');
  } catch (e) { return ''; }
};
const inside = (child, parent) => {
  const a = path.resolve(child).toLowerCase(), b = path.resolve(parent).toLowerCase();
  return a === b || a.startsWith(b + path.sep);
};

const REMBG_MODELS = [
  { id: 'u2net', name: 'U2-Net (general, balanced — ~175 MB)' },
  { id: 'isnet-general-use', name: 'IS-Net General (crisp edges — ~178 MB)' },
  { id: 'isnet-anime', name: 'IS-Net Anime / Art (illustrations & sprites — ~178 MB)' },
  { id: 'u2net_human_seg', name: 'U2-Net Portrait (people & portraits — ~175 MB)' },
  { id: 'silueta', name: 'Silueta (fast & compact — ~43 MB)' },
];

const ESRGAN_MODELS = [
  { id: 'RealESRGAN_x4plus', name: 'RealESRGAN x4plus (photos & general — 67 MB)' },
  { id: 'RealESRGAN_x4plus_anime_6B', name: 'RealESRGAN Anime 6B (art, pixel/anime, fast — 18 MB)' },
  { id: 'realesr-general-x4v3', name: 'RealESR General v3 (ultra-fast compact — 5 MB)' },
];

const DEMUCS_MODELS = [
  { id: 'htdemucs', name: 'HTDemucs (4 stems: vocals, drums, bass, other — 84 MB)' },
  { id: 'htdemucs_ft', name: 'HTDemucs Fine-Tuned (higher quality 4 stems — 320 MB)' },
  { id: 'htdemucs_6s', name: 'HTDemucs 6-Stem (+ guitar & piano — 84 MB)' },
];

const MERGE_METHODS = [
  { id: 'slerp', name: 'SLERP (smooth spherical blend of 2 models)' },
  { id: 'linear', name: 'Linear (weighted average of 2+ models)' },
  { id: 'ties', name: 'TIES (prune & resolve sign conflicts, needs base model)' },
  { id: 'dare_ties', name: 'DARE-TIES (random drop & rescale + TIES, needs base model)' },
  { id: 'task_arithmetic', name: 'Task Arithmetic (add task vectors onto a base model)' },
];

const LMEVAL_TASKS = [
  { id: 'hellaswag', name: 'HellaSwag (commonsense completion)' },
  { id: 'arc_easy', name: 'ARC Easy (grade-school science)' },
  { id: 'arc_challenge', name: 'ARC Challenge (harder science reasoning)' },
  { id: 'piqa', name: 'PIQA (physical intuition)' },
  { id: 'winogrande', name: 'WinoGrande (pronoun reasoning)' },
  { id: 'boolq', name: 'BoolQ (yes/no reading comprehension)' },
  { id: 'openbookqa', name: 'OpenBookQA (science facts)' },
  { id: 'truthfulqa_mc2', name: 'TruthfulQA MC2 (truthfulness)' },
  { id: 'mmlu', name: 'MMLU (broad knowledge — slower)' },
  { id: 'gsm8k', name: 'GSM8K (grade-school math, generative)' },
];

function killTree(p) {
  if (!p || !p.pid) return;
  try {
    if (process.platform === 'win32') cp.spawnSync('taskkill', ['/PID', String(p.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
    else p.kill('SIGTERM');
  } catch (e) { }
}

function isInstalled() {
  return fs.existsSync(READY) && fs.existsSync(VENV_PY);
}

function toolFlags() {
  const hasPy = fs.existsSync(VENV_PY);
  return {
    markitdown: hasPy && fs.existsSync(path.join(TK_DIR, 'markitdown')),
    mergekit: hasPy && fs.existsSync(path.join(TK_DIR, 'mergekit')),
    autoresearch: hasPy && fs.existsSync(path.join(TK_DIR, 'autoresearch', 'train.py')),
    lmeval: hasPy && (fs.existsSync(READY) || fs.existsSync(path.join(RT, 'heretic-ready'))),
    realesrgan: hasPy && fs.existsSync(path.join(TK_DIR, 'realesrgan')),
    rembg: hasPy && fs.existsSync(path.join(TK_DIR, 'rembg')),
    demucs: hasPy && fs.existsSync(path.join(TK_DIR, 'demucs')),
    minipaint: fs.existsSync(path.join(TK_DIR, 'minipaint', 'dist', 'bundle.js')),
    inpaint: hasPy && fs.existsSync(path.join(SCRIPTS, 'run_inpaint.py')),
  };
}

function listJobs(tool) {
  const out = [];
  try {
    if (!fs.existsSync(JOBS)) return out;
    for (const e of fs.readdirSync(JOBS, { withFileTypes: true })) {
      if (!e.isDirectory()) continue;
      const j = readJob(e.name);
      if (!j) continue;
      if (tool && j.tool !== tool) continue;
      out.push(j);
    }
  } catch (e) { }
  return out.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).slice(0, 60);
}

function getJob(id) {
  const cid = cleanId(id);
  if (!cid) return null;
  const j = readJob(cid);
  if (!j) return null;
  return Object.assign({}, j, { log: tailFile(path.join(jobDir(cid), 'log.txt'), 180) });
}

function deleteJob(id) {
  const cid = cleanId(id);
  if (!cid) return { ok: false, error: 'Invalid job id.' };
  if (cid === activeId && activeProc) return { ok: false, error: 'Cannot delete a running job. Stop it first.' };
  try { fs.rmSync(jobDir(cid), { recursive: true, force: true }); return { ok: true }; }
  catch (e) { return { ok: false, error: String(e.message || e) }; }
}

function resolveOutputFile(id, name) {
  const cid = cleanId(id);
  if (!cid) return '';
  const bn = path.basename(String(name || ''));
  if (!bn || bn === '.' || bn === '..') return '';
  const full = path.join(jobDir(cid), bn);
  if (!inside(full, jobDir(cid))) return '';
  return fs.existsSync(full) && fs.statSync(full).isFile() ? full : '';
}

function setup() {
  if (setupProc) return { ok: true, already: true };
  if (!fs.existsSync(SETUP_PS)) return { ok: false, error: 'Setup script missing: ' + SETUP_PS };
  fs.mkdirSync(RT, { recursive: true });
  const log = fs.createWriteStream(SETUP_LOG, { flags: 'w' });
  setupProc = cp.spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', SETUP_PS], {
    cwd: ROOT, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
  });
  const write = d => { try { log.write(d); } catch (e) { } };
  setupProc.stdout.on('data', write);
  setupProc.stderr.on('data', write);
  setupProc.on('close', () => { try { log.end(); } catch (e) { } setupProc = null; });
  setupProc.on('error', e => { write('ERROR: ' + e.message + '\n'); try { log.end(); } catch (x) { } setupProc = null; });
  return { ok: true };
}

function stopSetup() {
  if (!setupProc) return { ok: false, error: 'Setup is not running.' };
  killTree(setupProc);
  setupProc = null;
  return { ok: true };
}

function stopJob() {
  if (!activeProc) return { ok: false, error: 'No toolkit job is running.' };
  const id = activeId;
  killTree(activeProc);
  activeProc = null;
  activeId = '';
  if (id) {
    const j = readJob(id);
    if (j && j.status === 'running') { j.status = 'stopped'; j.endedAt = Date.now(); saveJob(id, j); }
  }
  return { ok: true };
}

function writeBase64Input(dir, filename, dataBase64, maxBytes) {
  const raw = String(dataBase64 || '').replace(/^data:[^;]+;base64,/, '');
  if (!raw) return { ok: false, error: 'No file data provided.' };
  const buf = Buffer.from(raw, 'base64');
  if (!buf.length) return { ok: false, error: 'Uploaded file is empty.' };
  if (buf.length > (maxBytes || 80 * 1024 * 1024)) return { ok: false, error: 'File is too large.' };
  const ext = path.extname(String(filename || '')).replace(/[^a-zA-Z0-9.]/g, '').slice(0, 12) || '.bin';
  const safe = 'input' + ext.toLowerCase();
  fs.mkdirSync(dir, { recursive: true });
  const full = path.join(dir, safe);
  fs.writeFileSync(full, buf);
  return { ok: true, path: full, name: safe, bytes: buf.length };
}

function parseLastJson(text) {
  const lines = stripAnsi(text).split('\n').map(s => s.trim()).filter(Boolean);
  for (let i = lines.length - 1; i >= 0; i--) {
    if (lines[i].startsWith('{') && lines[i].endsWith('}')) {
      try { return JSON.parse(lines[i]); } catch (e) { }
    }
  }
  return null;
}

/* ==================== 1. MarkItDown (microsoft/markitdown) ==================== */
function convertMarkdown(opts) {
  return new Promise(resolve => {
    const o = opts || {};
    if (!fs.existsSync(VENV_PY)) return resolve({ ok: false, error: 'Toolkit is not installed yet. Click Setup in Tools > MarkItDown.' });
    const id = 'md_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6);
    const dir = jobDir(id);
    fs.mkdirSync(dir, { recursive: true });
    let inPath = '', origName = cleanName(o.filename || 'document');
    if (o.dataBase64) {
      const w = writeBase64Input(dir, origName, o.dataBase64, 50 * 1024 * 1024);
      if (!w.ok) return resolve(w);
      inPath = w.path;
    } else if (o.filePath && fs.existsSync(String(o.filePath))) {
      inPath = path.resolve(String(o.filePath));
      origName = path.basename(inPath);
    } else {
      return resolve({ ok: false, error: 'Upload a file or provide a valid local file path.' });
    }
    const outPath = path.join(dir, 'output.md');
    const scriptPath = path.join(SCRIPTS, 'run_markitdown.py');
    const env = Object.assign({}, process.env, { PYTHONUTF8: '1' });
    let out = '', err = '';
    const p = cp.spawn(VENV_PY, [scriptPath, '--input', inPath, '--output', outPath], { cwd: dir, env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    const timer = setTimeout(() => { killTree(p); }, 120000);
    p.stdout.on('data', d => { out += d; });
    p.stderr.on('data', d => { err += d; });
    p.on('error', e => { clearTimeout(timer); resolve({ ok: false, error: String(e.message || e) }); });
    p.on('close', code => {
      clearTimeout(timer);
      const parsed = parseLastJson(out);
      if (code !== 0 || !fs.existsSync(outPath)) {
        return resolve({ ok: false, error: (parsed && parsed.error) || stripAnsi(err || out).trim().slice(-400) || ('Conversion failed (exit ' + code + ')') });
      }
      const markdown = fs.readFileSync(outPath, 'utf8');
      const job = { id, tool: 'markitdown', status: 'done', createdAt: Date.now(), endedAt: Date.now(), filename: origName, outputFile: 'output.md', chars: markdown.length, lines: markdown.split('\n').length };
      saveJob(id, job);
      resolve({ ok: true, id, filename: origName, title: (parsed && parsed.title) || origName, markdown, chars: markdown.length, lines: job.lines });
    });
  });
}

/* ==================== 2. rembg (danielgatis/rembg) ==================== */
function runRembg(opts) {
  const o = opts || {};
  const model = REMBG_MODELS.some(m => m.id === o.model) ? o.model : 'u2net';
  const id = 'rembg_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6);
  const dir = jobDir(id);
  const w = writeBase64Input(dir, o.filename || 'image.png', o.dataBase64, 40 * 1024 * 1024);
  if (!w.ok) return w;
  const outPath = path.join(dir, 'output.png');
  const args = ['--input', w.path, '--output', outPath, '--model', model, '--weights-dir', path.join(WEIGHTS, 'rembg')];
  if (o.alphaMatting) args.push('--alpha-matting');
  if (o.onlyMask) args.push('--only-mask');
  return spawnPythonJobWithDir(id, dir, 'rembg', {
    filename: cleanName(o.filename || 'image.png'),
    inputFile: w.name,
    outputFile: 'output.png',
    model,
    alphaMatting: !!o.alphaMatting,
  }, 'run_rembg.py', args);
}

/* ==================== 3. Real-ESRGAN (xinntao/Real-ESRGAN) ==================== */
function runUpscale(opts) {
  const o = opts || {};
  const model = ESRGAN_MODELS.some(m => m.id === o.model) ? o.model : 'RealESRGAN_x4plus';
  const scale = Number(o.scale) === 2 ? 2 : 4;
  const tile = Math.max(128, Math.min(512, parseInt(o.tile, 10) || 256));
  const id = 'esrgan_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6);
  const dir = jobDir(id);
  const w = writeBase64Input(dir, o.filename || 'image.png', o.dataBase64, 40 * 1024 * 1024);
  if (!w.ok) return w;
  const outPath = path.join(dir, 'output.png');
  const args = ['--input', w.path, '--output', outPath, '--model', model, '--scale', String(scale), '--tile', String(tile), '--weights-dir', path.join(WEIGHTS, 'realesrgan')];
  return spawnPythonJobWithDir(id, dir, 'realesrgan', {
    filename: cleanName(o.filename || 'image.png'),
    inputFile: w.name,
    outputFile: 'output.png',
    model,
    scale,
  }, 'run_realesrgan.py', args);
}

/* ==================== 3b. LaMa AI Magic Eraser / Inpainting (Sanster/IOPaint) ==================== */
function runInpaint(opts) {
  const o = opts || {};
  const dilate = Math.max(0, Math.min(25, parseInt(o.dilate, 10) || 5));
  const id = 'inpaint_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6);
  const dir = jobDir(id);
  const wImg = writeBase64Input(dir, o.filename || 'image.png', o.imageBase64 || o.dataBase64, 40 * 1024 * 1024);
  if (!wImg.ok) return wImg;
  const rawMask = String(o.maskBase64 || '').replace(/^data:[^;]+;base64,/, '');
  if (!rawMask) return { ok: false, error: 'Paint over the area you want to erase first.' };
  const maskBuf = Buffer.from(rawMask, 'base64');
  if (!maskBuf.length || maskBuf.length > 25 * 1024 * 1024) return { ok: false, error: 'Invalid mask image.' };
  const maskPath = path.join(dir, 'mask.png');
  fs.writeFileSync(maskPath, maskBuf);
  const outPath = path.join(dir, 'output.png');
  const args = ['--image', wImg.path, '--mask', maskPath, '--output', outPath, '--dilate', String(dilate), '--weights-dir', path.join(WEIGHTS, 'lama')];
  return spawnPythonJobWithDir(id, dir, 'inpaint', {
    filename: cleanName(o.filename || 'image.png'),
    inputFile: wImg.name,
    maskFile: 'mask.png',
    outputFile: 'output.png',
    model: 'big-lama',
    dilate,
  }, 'run_inpaint.py', args);
}

/* ==================== 4. Demucs (facebookresearch/demucs) ==================== */
function listAudioSources() {
  const out = [];
  const roots = [path.join(DATA, 'music'), path.join(DATA, 'media'), path.join(DATA, 'studio-music')];
  for (const r of roots) {
    try {
      if (!fs.existsSync(r)) continue;
      for (const e of fs.readdirSync(r, { withFileTypes: true })) {
        if (!e.isFile()) continue;
        if (!/\.(mp3|wav|flac|ogg|m4a|opus)$/i.test(e.name)) continue;
        const p = path.join(r, e.name);
        out.push({ name: e.name, path: p, size: fs.statSync(p).size });
      }
    } catch (e) { }
  }
  return out.slice(0, 100);
}

function runDemucs(opts) {
  const o = opts || {};
  const model = DEMUCS_MODELS.some(m => m.id === o.model) ? o.model : 'htdemucs';
  const twoStems = o.twoStems === 'vocals' ? 'vocals' : '';
  const id = 'demucs_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6);
  const dir = jobDir(id);
  fs.mkdirSync(dir, { recursive: true });
  let inPath = '', label = cleanName(o.filename || 'track.mp3');
  if (o.dataBase64) {
    const w = writeBase64Input(dir, label, o.dataBase64, 100 * 1024 * 1024);
    if (!w.ok) return w;
    inPath = w.path;
  } else if (o.trackPath) {
    const p = path.resolve(String(o.trackPath));
    if (!inside(p, DATA) || !fs.existsSync(p)) return { ok: false, error: 'Selected audio track was not found.' };
    inPath = p;
    label = path.basename(p);
  } else {
    return { ok: false, error: 'Upload an audio file or pick a track from your music library.' };
  }
  const args = ['--input', inPath, '--out-dir', dir, '--model', model, '--weights-dir', path.join(WEIGHTS, 'torch')];
  if (twoStems) args.push('--two-stems', twoStems);
  return spawnPythonJobWithDir(id, dir, 'demucs', {
    filename: label,
    model,
    twoStems,
  }, 'run_demucs.py', args);
}

/* ==================== 5. Mergekit (arcee-ai/mergekit) ==================== */
function buildMergeYaml(opts) {
  const o = opts || {};
  const method = MERGE_METHODS.some(m => m.id === o.method) ? o.method : 'slerp';
  const dtype = ['float16', 'bfloat16', 'float32'].includes(o.dtype) ? o.dtype : 'bfloat16';
  const list = (Array.isArray(o.models) ? o.models : []).filter(m => m && String(m.model || '').trim());
  const base = String(o.baseModel || (list[0] && list[0].model) || '').trim();
  const tVal = isFinite(+o.t) ? Math.max(0, Math.min(1, +o.t)) : 0.5;
  const density = isFinite(+o.density) ? Math.max(0.05, Math.min(1, +o.density)) : 0.5;
  if (list.length < 2) return { ok: false, error: 'Select at least 2 models to merge.' };

  const lines = [];
  if (method === 'slerp') {
    lines.push('slices:');
    lines.push('  - sources:');
    for (const m of list.slice(0, 2)) {
      lines.push('      - model: ' + JSON.stringify(String(m.model).trim()));
      if (o.layerEnd && +o.layerEnd > 0) lines.push('        layer_range: [0, ' + Math.round(+o.layerEnd) + ']');
    }
    lines.push('merge_method: slerp');
    lines.push('base_model: ' + JSON.stringify(base));
    lines.push('parameters:');
    lines.push('  t: ' + tVal);
    lines.push('dtype: ' + dtype);
  } else {
    lines.push('models:');
    for (const m of list) {
      const w = isFinite(+m.weight) ? +m.weight : (1 / list.length);
      lines.push('  - model: ' + JSON.stringify(String(m.model).trim()));
      lines.push('    parameters:');
      lines.push('      weight: ' + Number(w.toFixed(4)));
      if (method === 'ties' || method === 'dare_ties') lines.push('      density: ' + Number((isFinite(+m.density) ? +m.density : density).toFixed(4)));
    }
    lines.push('merge_method: ' + method);
    if (method === 'ties' || method === 'dare_ties' || method === 'task_arithmetic') {
      lines.push('base_model: ' + JSON.stringify(base));
    }
    if (method === 'ties' || method === 'dare_ties') {
      lines.push('parameters:');
      lines.push('  normalize: true');
      lines.push('  int8_mask: true');
    }
    lines.push('dtype: ' + dtype);
  }
  return { ok: true, yaml: lines.join('\n') + '\n', method, dtype };
}

function runMerge(opts) {
  const o = opts || {};
  let yamlText = String(o.yaml || '').trim();
  if (!yamlText) {
    const built = buildMergeYaml(o);
    if (!built.ok) return built;
    yamlText = built.yaml;
  }
  const id = 'merge_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6);
  const dir = jobDir(id);
  const outDir = path.join(dir, 'merged');
  fs.mkdirSync(outDir, { recursive: true });
  const cfgPath = path.join(dir, 'merge.yml');
  fs.writeFileSync(cfgPath, yamlText + '\n', 'utf8');

  const args = ['--config', cfgPath, '--out-dir', outDir];
  if (o.cuda) args.push('--cuda');
  if (o.lazyUnpickle !== false) args.push('--lazy-unpickle');
  if (o.allowCrimes) args.push('--allow-crimes');
  return spawnPythonJobWithDir(id, dir, 'mergekit', {
    name: cleanModelName(o.name || 'merged-model'),
    method: o.method || 'custom',
    outDir,
    yaml: yamlText,
  }, 'run_mergekit.py', args);
}

function importMergeToOllama(id, ollamaName, quant) {
  const cid = cleanId(id);
  const job = cid ? readJob(cid) : null;
  if (!job || job.tool !== 'mergekit' || job.status !== 'done') return { ok: false, error: 'Finish a Mergekit run first.' };
  if (convProc) return { ok: false, error: 'Another Ollama import is already running.' };
  if (!fs.existsSync(GGUF_CONV)) return { ok: false, error: 'GGUF converter script missing: ' + GGUF_CONV };
  const mergedDir = job.outDir || path.join(jobDir(cid), 'merged');
  if (!fs.existsSync(path.join(mergedDir, 'config.json'))) return { ok: false, error: 'Merged model folder has no config.json.' };

  const targetName = cleanModelName(ollamaName || job.name || 'merged-model');
  const qtype = ['q8_0', 'f16', 'bf16', 'auto'].includes(String(quant || 'q8_0').toLowerCase()) ? String(quant || 'q8_0').toLowerCase() : 'q8_0';
  const ggufPath = path.join(jobDir(cid), targetName + '.gguf');
  const mfPath = path.join(jobDir(cid), 'Modelfile');
  const logPath = path.join(jobDir(cid), 'import.log');
  const logStream = fs.createWriteStream(logPath, { flags: 'w' });
  const write = d => { try { logStream.write(d); } catch (e) { } };

  convId = cid;
  job.importStatus = 'converting';
  job.ollamaName = targetName;
  saveJob(cid, job);

  convProc = cp.spawn(VENV_PY, [GGUF_CONV, mergedDir, '--outfile', ggufPath, '--outtype', qtype], {
    cwd: jobDir(cid), env: Object.assign({}, process.env, { PYTHONUTF8: '1' }), windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
  });
  convProc.stdout.on('data', write);
  convProc.stderr.on('data', write);
  convProc.on('close', code => {
    if (code !== 0 || !fs.existsSync(ggufPath)) {
      write('\nGGUF conversion failed (exit ' + code + ').\n');
      try { logStream.end(); } catch (e) { }
      const cur = readJob(cid) || job;
      cur.importStatus = 'failed'; cur.importError = 'GGUF conversion failed (exit ' + code + ').';
      saveJob(cid, cur);
      convProc = null; convId = '';
      return;
    }
    fs.writeFileSync(mfPath, 'FROM "' + ggufPath.replace(/\\/g, '/') + '"\n', 'utf8');
    write('\nRegistering ' + targetName + ' in Ollama...\n');
    convProc = cp.spawn(ollama, ['create', targetName, '-f', mfPath], { cwd: jobDir(cid), windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    convProc.stdout.on('data', write);
    convProc.stderr.on('data', write);
    convProc.on('close', code2 => {
      try { logStream.end(); } catch (e) { }
      const cur = readJob(cid) || job;
      if (code2 === 0) {
        cur.importStatus = 'done'; cur.ollamaName = targetName;
        try { lmstudioSync.syncModel(targetName); } catch (e) { }
      } else {
        cur.importStatus = 'failed'; cur.importError = 'ollama create failed (exit ' + code2 + ').';
      }
      saveJob(cid, cur);
      convProc = null; convId = '';
    });
  });
  return { ok: true, id: cid, ollamaName: targetName };
}

/* ==================== 6. lm-evaluation-harness (EleutherAI) ==================== */
function runLmEval(opts) {
  const o = opts || {};
  const backend = o.backend === 'hf' ? 'hf' : 'ollama';
  const model = String(o.model || '').trim();
  if (!model) return { ok: false, error: 'Pick a model to evaluate.' };
  const allowed = new Set(LMEVAL_TASKS.map(t => t.id));
  const rawTasks = Array.isArray(o.tasks) ? o.tasks : String(o.tasks || '').split(',');
  const tasks = rawTasks.map(s => String(s || '').trim()).filter(t => allowed.has(t));
  if (!tasks.length) return { ok: false, error: 'Select at least one benchmark task.' };
  const limit = Math.max(0, Math.min(5000, parseInt(o.limit, 10) || 25));
  const fewshot = Math.max(0, Math.min(10, parseInt(o.numFewshot, 10) || 0));

  const id = 'eval_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6);
  const dir = jobDir(id);
  fs.mkdirSync(dir, { recursive: true });
  const args = ['--backend', backend, '--model', model, '--tasks', tasks.join(','), '--limit', String(limit), '--num-fewshot', String(fewshot), '--out-dir', dir];
  return spawnPythonJobWithDir(id, dir, 'lmeval', {
    backend,
    model,
    tasks,
    limit,
    numFewshot: fewshot,
  }, 'run_lmeval.py', args, cur => {
    const sum = U.readJson(path.join(dir, 'summary.json'), null);
    if (sum && Array.isArray(sum.scores)) cur.scores = sum.scores;
  });
}

/* ==================== 7. Autoresearch (karpathy/autoresearch) ==================== */
function autoresearchDir() { return path.join(TK_DIR, 'autoresearch'); }

function autoresearchInfo() {
  const repo = autoresearchDir();
  const installed = fs.existsSync(path.join(repo, 'train.py'));
  const cacheDir = path.join(os.homedir(), '.cache', 'autoresearch');
  const prepared = fs.existsSync(path.join(cacheDir, 'tokenizer')) && fs.existsSync(path.join(cacheDir, 'data'));
  let programMd = '', trainPy = '', results = [];
  if (installed) {
    try { programMd = fs.readFileSync(path.join(repo, 'program.md'), 'utf8'); } catch (e) { }
    try { trainPy = fs.readFileSync(path.join(repo, 'train.py'), 'utf8'); } catch (e) { }
    try {
      const raw = fs.readFileSync(path.join(repo, 'results.tsv'), 'utf8').trim();
      const lines = raw.split(/\r?\n/).filter(Boolean);
      if (lines.length > 1) {
        const hdr = lines[0].split('\t');
        results = lines.slice(1).map(l => {
          const cols = l.split('\t'), o = {};
          hdr.forEach((h, i) => { o[h] = cols[i] || ''; });
          return o;
        }).reverse().slice(0, 50);
      }
    } catch (e) { }
  }
  return { installed, prepared, repo, cacheDir, programMd, trainPy, results };
}

function autoresearchSave(opts) {
  const o = opts || {}, repo = autoresearchDir();
  if (!fs.existsSync(path.join(repo, 'train.py'))) return { ok: false, error: 'Autoresearch is not cloned yet.' };
  if (typeof o.programMd === 'string') fs.writeFileSync(path.join(repo, 'program.md'), o.programMd, 'utf8');
  if (typeof o.trainPy === 'string') fs.writeFileSync(path.join(repo, 'train.py'), o.trainPy, 'utf8');
  return { ok: true };
}

function autoresearchReset() {
  const repo = autoresearchDir();
  if (!fs.existsSync(path.join(repo, 'train.py'))) return { ok: false, error: 'Autoresearch is not cloned yet.' };
  const r = cp.spawnSync('git', ['checkout', '--', 'train.py'], { cwd: repo, encoding: 'utf8', windowsHide: true });
  if (r.status !== 0) return { ok: false, error: String(r.stderr || r.stdout || 'git checkout failed').trim() };
  return { ok: true, trainPy: fs.readFileSync(path.join(repo, 'train.py'), 'utf8') };
}

function runAutoresearch(opts) {
  const o = opts || {}, repo = autoresearchDir();
  if (!fs.existsSync(path.join(repo, 'train.py'))) return { ok: false, error: 'Autoresearch is not installed yet.' };
  const action = ['prepare', 'run', 'loop'].includes(o.action) ? o.action : 'run';
  const id = 'ar_' + action + '_' + Date.now().toString(36);
  const dir = jobDir(id);
  fs.mkdirSync(dir, { recursive: true });
  const args = ['--repo', repo, '--action', action];
  if (action === 'prepare') args.push('--num-shards', String(Math.max(1, Math.min(64, parseInt(o.numShards, 10) || 4))));
  if (action === 'run' && o.description) args.push('--description', String(o.description).slice(0, 140));
  if (action === 'loop') {
    const m = String(o.ollamaModel || '').trim();
    if (!m) return { ok: false, error: 'Pick a local Ollama model to drive the autonomous loop.' };
    args.push('--ollama-model', m, '--rounds', String(Math.max(1, Math.min(50, parseInt(o.rounds, 10) || 3))));
  }
  return spawnPythonJobWithDir(id, dir, 'autoresearch', { action, ollamaModel: o.ollamaModel || '', rounds: o.rounds || 1 }, 'run_autoresearch.py', args);
}

/* shared helper that uses a pre-created job dir (for media/merge/eval/autoresearch) */
function spawnPythonJobWithDir(id, dir, tool, meta, scriptName, args, onFinish) {
  if (!fs.existsSync(VENV_PY)) return { ok: false, error: 'Toolkit Python environment is not set up yet. Click Install / Verify first.' };
  if (activeProc) return { ok: false, error: 'Another toolkit job is already running (' + activeId + '). Wait for it or click Stop.' };
  fs.mkdirSync(dir, { recursive: true });
  const logPath = path.join(dir, 'log.txt');
  const job = Object.assign({ id, tool, status: 'running', createdAt: Date.now(), dir }, meta || {});
  saveJob(id, job);

  const scriptPath = path.join(SCRIPTS, scriptName);
  const env = Object.assign({}, process.env, { PYTHONUTF8: '1', PYTHONUNBUFFERED: '1' });
  const logStream = fs.createWriteStream(logPath, { flags: 'a' });
  let tail = '';
  activeId = id;
  activeProc = cp.spawn(VENV_PY, [scriptPath, ...args], { cwd: dir, env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  const onData = d => {
    const s = String(d);
    tail = (tail + s).slice(-24000);
    try { logStream.write(d); } catch (e) { }
  };
  activeProc.stdout.on('data', onData);
  activeProc.stderr.on('data', onData);
  activeProc.on('error', e => {
    onData('ERROR: ' + e.message + '\n');
    try { logStream.end(); } catch (x) { }
    const cur = readJob(id) || job;
    cur.status = 'failed'; cur.error = e.message; cur.endedAt = Date.now();
    saveJob(id, cur);
    activeProc = null; activeId = '';
  });
  activeProc.on('close', code => {
    try { logStream.end(); } catch (x) { }
    const cur = readJob(id) || job;
    const parsed = parseLastJson(tail);
    if (cur.status !== 'stopped') {
      cur.status = code === 0 && (!parsed || parsed.ok !== false) ? 'done' : 'failed';
      if (parsed) cur.result = parsed;
      if (cur.status === 'failed') cur.error = (parsed && parsed.error) || ('Exited with code ' + code);
      cur.endedAt = Date.now();
      if (onFinish) { try { onFinish(cur, parsed); } catch (e) { } }
      saveJob(id, cur);
    }
    activeProc = null; activeId = '';
  });
  return { ok: true, id, job };
}

function status(toolFilter) {
  return {
    ready: isInstalled(),
    setupRunning: !!setupProc,
    setupLog: tailFile(SETUP_LOG, 80),
    tools: toolFlags(),
    activeJob: activeId ? getJob(activeId) : null,
    converting: !!convProc,
    convertId: convId,
    jobs: listJobs(toolFilter || ''),
    catalog: {
      rembgModels: REMBG_MODELS,
      esrganModels: ESRGAN_MODELS,
      demucsModels: DEMUCS_MODELS,
      mergeMethods: MERGE_METHODS,
      lmevalTasks: LMEVAL_TASKS,
    },
    localModels: (() => { try { return heretic.downloadedModels(); } catch (e) { return []; } })(),
    audioSources: listAudioSources(),
    autoresearch: autoresearchInfo(),
  };
}

function stopAll() {
  try { stopJob(); } catch (e) { }
  try { stopSetup(); } catch (e) { }
  if (convProc) { killTree(convProc); convProc = null; convId = ''; }
}

function _setJobsDir(p) { JOBS = p; }

module.exports = {
  status, setup, stopSetup, stopJob, stopAll,
  listJobs, getJob, deleteJob, resolveOutputFile,
  convertMarkdown, runRembg, runUpscale, runInpaint, runDemucs, listAudioSources,
  MINIPAINT_DIR: path.join(TK_DIR, 'minipaint'),
  buildMergeYaml, runMerge, importMergeToOllama,
  runLmEval,
  autoresearchInfo, autoresearchSave, autoresearchReset, runAutoresearch,
  REMBG_MODELS, ESRGAN_MODELS, DEMUCS_MODELS, MERGE_METHODS, LMEVAL_TASKS,
  _setJobsDir,
};

// Heretic (https://github.com/p-e-w/heretic): training-free language model modification inside Moundshroud Studio.
// Lets you pick any downloaded local model (Ollama, LM Studio GGUF, or local Hugging Face folder/cache) or HF ID,
// unpacks local GGUFs offline when supported (or falls back to upstream HF weights), runs Heretic Optuna TPE
// optimization, and converts/imports the modified model straight into Ollama and LM Studio.
const cp = require('child_process'), os = require('os'), path = require('path'), fs = require('fs');
const U = require('./util');
const modelOrder = require('./model-order');
const lmstudioSync = require('./lmstudio-sync');

const ROOT = path.join(__dirname, '..');
const DATA = path.join(ROOT, 'data');
const RT = path.join(ROOT, 'runtime');
const VENV_PY = path.join(RT, 'ftenv', 'Scripts', 'python.exe');
const REPO = path.join(RT, 'heretic');
const READY = path.join(RT, 'heretic-ready');
const SETUP_LOG = path.join(RT, 'heretic-setup.log');
const SETUP_PS = path.join(ROOT, 'scripts', 'heretic-setup.ps1');
const PREPARE_PY = path.join(ROOT, 'scripts', 'heretic_prepare.py');
const GGUF_CONV = path.join(ROOT, 'scripts', 'convert_hf_to_gguf.py');
let JOBS = path.join(DATA, 'heretic');
const ollama = require('./ollama-bundle').exe();

const PRESETS = [
  { id: 'default', file: 'config.default.toml', name: 'Decensor (Refusal removal)', desc: 'Removes unnecessary refusals while minimizing KL divergence to preserve intelligence (KeywordRate + KLDivergence + ARA).' },
  { id: 'classifier', file: 'config.classifier.toml', name: 'Decensor (BERT classifier)', desc: 'Uses a ModernBERT refusal classifier instead of keyword heuristics for higher refusal-detection accuracy.' },
  { id: 'noslop', file: 'config.noslop.toml', name: 'Reduce AI slop', desc: 'Suppresses clichés, filler phrases, and repetitive writing patterns.' },
  { id: 'nosyco', file: 'config.nosyco.toml', name: 'Reduce sycophancy', desc: 'Discourages blind agreement and overly flattering responses.' },
  { id: 'terse', file: 'config.terse.toml', name: 'Make terse & concise', desc: 'Shortens verbose answers without sacrificing helpfulness.' },
  { id: 'nohumor', file: 'config.nohumor.toml', name: 'Reduce forced humor', desc: 'Tones down quips and jokes for serious or technical work.' },
  { id: 'emotions', file: 'config.emotions.toml', name: 'Emotional steering', desc: 'Steers emotional tone (happiness-increased) via directional modification.' },
  { id: 'piqa', file: 'config.piqa.toml', name: 'Benchmark steering (PIQA)', desc: 'Steers toward physical commonsense reasoning performance on PIQA.' },
  { id: 'custom', file: '', name: 'Custom config.toml', desc: 'Edit the TOML configuration directly for custom datasets, scorers, or modifiers.' },
];

const SUGGESTED_MODELS = [
  { id: 'Qwen/Qwen3-4B-Instruct-2507', name: 'Qwen3 4B Instruct (Heretic default example — use bnb_4bit on 8 GB GPU)' },
  { id: 'Qwen/Qwen2.5-3B-Instruct', name: 'Qwen2.5 3B Instruct (balanced, fits easily in 8 GB GPU)' },
  { id: 'HuggingFaceTB/SmolLM2-1.7B-Instruct', name: 'SmolLM2 1.7B Instruct (fast)' },
  { id: 'Qwen/Qwen2.5-1.5B-Instruct', name: 'Qwen2.5 1.5B Instruct (fast)' },
  { id: 'Qwen/Qwen2.5-0.5B-Instruct', name: 'Qwen2.5 0.5B Instruct (tiny, quickest test)' },
];

let setupProc = null, runProc = null, runId = '', convProc = null, convId = '';

const ANSI_RE = /\x1b\[[0-9;?]*[ -/]*[@-~]|\r/g;
const stripAnsi = s => String(s || '').replace(ANSI_RE, '');
const cleanId = id => /^[a-z0-9_-]{3,40}$/i.test(String(id || '')) ? String(id) : '';
const cleanModelName = s => String(s || '').toLowerCase().replace(/[^a-z0-9._-]/g, '-').replace(/^-+|-+$/g, '').slice(0, 48) || 'heretic-model';
const jobDir = id => path.join(JOBS, id);
const readJob = id => U.readJson(path.join(jobDir(id), 'job.json'), null);
const saveJob = (id, j) => { fs.mkdirSync(jobDir(id), { recursive: true }); U.writeJson(path.join(jobDir(id), 'job.json'), j); };
const tailFile = (f, maxLines) => {
  try {
    const raw = fs.readFileSync(f, 'utf8');
    const lines = stripAnsi(raw).split('\n');
    return lines.slice(-(maxLines || 180)).join('\n');
  } catch (e) { return ''; }
};

function isInstalled() {
  return fs.existsSync(READY) && fs.existsSync(VENV_PY) && fs.existsSync(path.join(REPO, 'pyproject.toml'));
}

function presetToml(id) {
  const p = PRESETS.find(x => x.id === id) || PRESETS[0];
  if (!p || !p.file) return '';
  const f = path.join(REPO, p.file);
  try { return fs.readFileSync(f, 'utf8'); } catch (e) { return ''; }
}

/* Map common Ollama / local model names to their upstream Hugging Face base repo (fallback if GGUF arch isn't directly unpackable). */
function guessHfRepo(name) {
  const raw = String(name || '').trim();
  const s = raw.toLowerCase().replace(/:latest$/, '');
  if (!s) return '';
  let m;
  if ((m = /^qwen3\.5[:\-](\d+(?:\.\d+)?b)$/.exec(s))) return 'Qwen/Qwen3.5-' + m[1].toUpperCase();
  if (/^qwen0\.?8b$/.test(s)) return 'Qwen/Qwen3.5-0.8B';
  if ((m = /^qwen([249])b$/.exec(s))) return 'Qwen/Qwen3.5-' + m[1] + 'B';
  if ((m = /^qwen3[:\-](\d+(?:\.\d+)?b)$/.exec(s))) return 'Qwen/Qwen3-' + m[1].toUpperCase();
  if ((m = /^qwen2\.5[:\-](\d+(?:\.\d+)?b)$/.exec(s))) return 'Qwen/Qwen2.5-' + m[1].toUpperCase() + '-Instruct';
  if ((m = /^gemma4[:\-]?(e\d+b)$/.exec(s))) return 'google/gemma-4-' + m[1].toUpperCase() + '-it';
  if ((m = /^gemma4?[:\-]?(\d+b)$/.exec(s))) return 'google/gemma-4-' + m[1] + '-it';
  if ((m = /^gemma3[:\-](\d+(?:m|b))$/.exec(s))) return 'google/gemma-3-' + m[1] + '-it';
  if ((m = /^gemma2[:\-](\d+b)$/.exec(s))) return 'google/gemma-2-' + m[1] + '-it';
  if ((m = /^llama3\.2[:\-](\d+b)$/.exec(s))) return 'meta-llama/Llama-3.2-' + m[1].toUpperCase() + '-Instruct';
  if ((m = /^llama3\.1[:\-](\d+b)$/.exec(s))) return 'meta-llama/Llama-3.1-' + m[1].toUpperCase() + '-Instruct';
  if (/^smollm2[:\-]135m|^smollm2-135m|^smol2$/.test(s)) return 'HuggingFaceTB/SmolLM2-135M-Instruct';
  if (/^smollm2[:\-]360m|^smollm2-360m/.test(s)) return 'HuggingFaceTB/SmolLM2-360M-Instruct';
  if (/^smollm2[:\-]1\.7b|^smollm2-1\.7b/.test(s)) return 'HuggingFaceTB/SmolLM2-1.7B-Instruct';
  if (/^smollm(?:$|[:\-]1\.7b)|^smol1$/.test(s)) return 'HuggingFaceTB/SmolLM-1.7B-Instruct';
  if (/^mistral(?:$|[:\-]7b)/.test(s)) return 'mistralai/Mistral-7B-Instruct-v0.3';
  if (/^phi4(?:$|:)/.test(s)) return 'microsoft/phi-4';
  if (/^phi3(?:$|[:\-]mini)/.test(s)) return 'microsoft/Phi-3-mini-4k-instruct';
  if (/^deepseek-r1[:\-]1\.5b$/.test(s)) return 'deepseek-ai/DeepSeek-R1-Distill-Qwen-1.5B';
  if (/^deepseek-r1[:\-]7b$/.test(s)) return 'deepseek-ai/DeepSeek-R1-Distill-Qwen-7B';
  if (/^deepseek-r1[:\-]8b$/.test(s)) return 'deepseek-ai/DeepSeek-R1-Distill-Llama-8B';
  if (/^deepseek-r1[:\-]14b$/.test(s)) return 'deepseek-ai/DeepSeek-R1-Distill-Qwen-14B';
  return '';
}

function dirSizeBytes(dir) {
  let total = 0;
  try {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isFile()) { try { total += fs.statSync(p).size; } catch (x) { } }
    }
  } catch (e) { }
  return total;
}

function hasHfWeights(dir) {
  try {
    if (!fs.existsSync(path.join(dir, 'config.json'))) return false;
    return fs.readdirSync(dir).some(f => /\.(safetensors|bin)$/i.test(f));
  } catch (e) { return false; }
}

/* Discover all downloaded local models on this PC (Ollama, LM Studio standalone GGUFs, local HF cache/outputs). */
function downloadedModels(opts) {
  opts = opts || {};
  const list = [];
  const seenOllama = new Set();

  /* 1. Ollama downloaded models (works even if Ollama daemon is asleep by reading manifests + blobs) */
  const ollamaDir = opts.ollamaDir || lmstudioSync.defaultOllamaDir();
  /* opts.skipOllama: the caller already has the Ollama list; opts.all: keep embedders, speech, CLIP and classifiers too */
  if (!opts.skipOllama && ollamaDir && fs.existsSync(ollamaDir)) {
    const blobsDir = path.join(ollamaDir, 'blobs');
    for (const sub of ['manifests-v2', 'manifests']) {
      const root = path.join(ollamaDir, sub);
      if (!fs.existsSync(root)) continue;
      const walk = (dir, rel) => {
        let entries;
        try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return; }
        for (const e of entries) {
          const full = path.join(dir, e.name);
          const next = rel.concat(e.name);
          if (e.isDirectory()) { walk(full, next); continue; }
          if (!e.isFile() || next.length < 4) continue;
          const ns = next[1], mdl = next.slice(2, -1).join('/'), tag = next[next.length - 1];
          const display = (ns.toLowerCase() === 'library' ? mdl : (ns + '/' + mdl)) + (tag === 'latest' ? '' : ':' + tag);
          const slug = lmstudioSync.slugFromParts(ns, mdl.replace(/\//g, '-'), tag);
          if (!slug || seenOllama.has(slug)) continue;
          if (lmstudioSync.isAgentCopy(slug) || /(?:embed|^nomic\b)/i.test(display)) continue;
          const info = lmstudioSync.resolveManifest(full, blobsDir);
          if (!info || !info.modelBlob) continue;
          let size = 0;
          try { size = fs.statSync(info.modelBlob).size; } catch (x) { }
          if (info.projBlob) { try { size += fs.statSync(info.projBlob).size; } catch (x) { } }
          seenOllama.add(slug);
          list.push({
            id: 'ollama:' + display,
            source: 'ollama',
            name: display,
            size,
            ggufPath: info.modelBlob,
            hfFallback: guessHfRepo(display),
          });
        }
      };
      walk(root, []);
    }
  }

  /* 2. Standalone LM Studio GGUF models (excluding the ollama/ mirror folder to avoid duplicates) */
  const lmModelsDir = opts.lmModelsDir !== undefined ? opts.lmModelsDir : lmstudioSync.defaultLmModelsDir();
  if (lmModelsDir && fs.existsSync(lmModelsDir)) {
    const walkLm = (dir, depth) => {
      if (depth > 4) return;
      let entries;
      try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return; }
      for (const e of entries) {
        if (depth === 0 && e.name.toLowerCase() === 'ollama') continue;
        const full = path.join(dir, e.name);
        if (e.isDirectory()) { walkLm(full, depth + 1); continue; }
        if (!e.isFile() || !/\.gguf$/i.test(e.name) || /^mmproj/i.test(e.name) || (!opts.all && /embed/i.test(e.name))) continue;
        let size = 0; try { size = fs.statSync(full).size; } catch (x) { }
        const disp = e.name.replace(/\.gguf$/i, '');
        list.push({
          id: 'gguf:' + full,
          source: 'lmstudio',
          name: disp,
          size,
          ggufPath: full,
          hfFallback: guessHfRepo(disp),
        });
      }
    };
    walkLm(lmModelsDir, 0);
  }

  /* 3. Local Hugging Face cache snapshots (ready for Heretic with zero unpacking) */
  const hfHub = opts.hfHubDir !== undefined ? opts.hfHubDir : path.join(os.homedir(), '.cache', 'huggingface', 'hub');
  if (hfHub && fs.existsSync(hfHub)) {
    try {
      for (const e of fs.readdirSync(hfHub, { withFileTypes: true })) {
        if (!e.isDirectory() || !e.name.startsWith('models--')) continue;
        const repo = e.name.slice('models--'.length).replace(/--/g, '/');
        if (!opts.all && /embed|classifier|whisper|clip|siglip/i.test(repo)) continue;
        const snaps = path.join(hfHub, e.name, 'snapshots');
        if (!fs.existsSync(snaps)) continue;
        const kids = fs.readdirSync(snaps).map(k => path.join(snaps, k)).filter(hasHfWeights);
        if (!kids.length) continue;
        const pick = kids[0];
        list.push({
          id: 'hfdir:' + pick,
          source: 'hf-cache',
          name: repo,
          size: dirSizeBytes(pick),
          localPath: pick,
        });
      }
    } catch (e) { }
  }

  const def = modelOrder.getDefault(opts.dataDir || DATA);
  return modelOrder.sortModels(list, def);
}

function listJobs() {
  try {
    if (!fs.existsSync(JOBS)) return [];
    const out = [];
    for (const d of fs.readdirSync(JOBS)) {
      const j = readJob(d);
      if (!j) continue;
      const outDir = path.join(jobDir(d), 'output');
      j.hasOutput = fs.existsSync(path.join(outDir, 'config.json')) || fs.existsSync(path.join(outDir, 'adapter_config.json'));
      j.hasAdapterOnly = fs.existsSync(path.join(outDir, 'adapter_config.json')) && !fs.existsSync(path.join(outDir, 'config.json'));
      j.hasGguf = fs.existsSync(path.join(jobDir(d), 'model.gguf'));
      j.running = !!(runProc && runId === d);
      j.converting = !!(convProc && convId === d);
      out.push(j);
    }
    return out.sort((a, b) => (b.startedAt || 0) - (a.startedAt || 0));
  } catch (e) { return []; }
}

function status() {
  return {
    installed: isInstalled(),
    installing: !!setupProc,
    repoPresent: fs.existsSync(path.join(REPO, 'pyproject.toml')),
    ftReady: fs.existsSync(path.join(RT, 'ft-ready')) && fs.existsSync(VENV_PY),
    running: !!runProc,
    runId,
    converting: !!convProc,
    convertId: convId,
    defaultModel: modelOrder.getDefault(DATA),
    presets: PRESETS.map(p => ({ id: p.id, name: p.name, desc: p.desc })),
    suggestedModels: SUGGESTED_MODELS,
    downloaded: downloadedModels(),
    jobs: listJobs(),
  };
}

function install() {
  if (setupProc) return { ok: true, already: true };
  if (!fs.existsSync(SETUP_PS)) return { ok: false, error: 'Setup script scripts/heretic-setup.ps1 is missing.' };
  fs.mkdirSync(RT, { recursive: true });
  const out = fs.openSync(SETUP_LOG, 'w');
  setupProc = cp.spawn('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', SETUP_PS], { cwd: ROOT, windowsHide: true, stdio: ['ignore', out, out] });
  setupProc.on('exit', () => { try { fs.closeSync(out); } catch (e) { } setupProc = null; });
  setupProc.on('error', () => { try { fs.closeSync(out); } catch (e) { } setupProc = null; });
  return { ok: true, started: true };
}

const installLog = () => tailFile(SETUP_LOG, 120);

function validateModelRef(s) {
  const v = String(s || '').trim();
  if (!v || v.length > 260 || /[\r\n\0]/.test(v)) return '';
  return v;
}

function buildArgs(cfg, dir) {
  const mode = ['modify', 'reproduce', 'evaluate'].includes(cfg.mode) ? cfg.mode : 'modify';
  const outDir = path.join(dir, 'output');
  const ckptDir = path.join(dir, 'checkpoints');
  const quant = cfg.quantization === 'none' ? 'none' : 'bnb_4bit';
  const exportStrategy = cfg.exportStrategy === 'adapter' ? 'adapter' : 'merge';
  const args = ['-u', '-m', 'heretic.main'];

  if (mode === 'reproduce') {
    const rep = validateModelRef(cfg.reproduce);
    if (!rep) return { ok: false, error: 'Enter a reproduce.json URL or local file path.' };
    args.push('--reproduce', rep, '--ignore-mismatches', 'true', '--quantization', quant, '--trial-index', '0', '--model-action', 'save', '--export-strategy', exportStrategy, '--save-directory', outDir);
    return { ok: true, args, mode, outDir };
  }

  const model = validateModelRef(cfg.model);
  if (!model) return { ok: false, error: 'Choose a downloaded model, or enter a Hugging Face model ID / local folder.' };

  if (mode === 'evaluate') {
    const evalModel = validateModelRef(cfg.evaluateModel);
    if (!evalModel) return { ok: false, error: 'Enter the second model ID or folder to compare against the base model.' };
    args.push('--model', model, '--evaluate-model', evalModel, '--quantization', quant);
    return { ok: true, args, mode, outDir };
  }

  const nTrials = Math.max(1, Math.min(500, parseInt(cfg.nTrials, 10) || 50));
  const nStartup = Math.max(0, Math.min(nTrials, cfg.nStartupTrials === '' || cfg.nStartupTrials == null ? Math.min(15, nTrials) : parseInt(cfg.nStartupTrials, 10) || 0));
  const batchSize = Math.max(0, Math.min(256, parseInt(cfg.batchSize, 10) || 0));
  const maxResp = Math.max(16, Math.min(1024, parseInt(cfg.maxResponseLength, 10) || 100));
  const trialIdx = Math.max(0, Math.min(50, parseInt(cfg.trialIndex, 10) || 0));
  const ckptAction = cfg.checkpointAction === 'restart' ? 'restart' : 'continue';

  args.push(
    '--model', model,
    '--quantization', quant,
    '--n-trials', String(nTrials),
    '--n-startup-trials', String(nStartup),
    '--batch-size', String(batchSize),
    '--max-response-length', String(maxResp),
    '--study-checkpoint-dir', ckptDir,
    '--checkpoint-action', ckptAction,
    '--trial-index', String(trialIdx),
    '--model-action', 'save',
    '--export-strategy', exportStrategy,
    '--save-directory', outDir
  );
  if (cfg.seed !== '' && cfg.seed != null && /^\d+$/.test(String(cfg.seed).trim())) {
    args.push('--seed', String(cfg.seed).trim());
  }
  return { ok: true, args, mode, outDir, nTrials };
}

function resolveSelection(cfg) {
  const sel = String(cfg.selectedModel || '').trim();
  if (!sel || sel === '__custom__') return { display: String(cfg.model || '').trim(), directModel: String(cfg.model || '').trim(), gguf: null };
  const all = downloadedModels();
  const hit = all.find(m => m.id === sel || m.name === sel);
  if (!hit) return { error: 'That downloaded model could not be found on disk anymore. Refresh the list and try again.' };
  if (hit.localPath) return { display: hit.name, directModel: hit.localPath, gguf: null };
  if (hit.ggufPath) return { display: hit.name, directModel: '', gguf: hit };
  return { display: hit.name, directModel: hit.name, gguf: null };
}

function start(cfg) {
  cfg = cfg || {};
  if (runProc) return { ok: false, error: 'A Heretic run is already in progress. Stop it or wait for it to finish.' };
  if (convProc) return { ok: false, error: 'A GGUF conversion is currently running. Wait for it to finish.' };
  if (!isInstalled()) return { ok: false, error: 'Heretic is not set up yet. Press "Set up Heretic" first.' };

  const id = cleanId(cfg.resumeId) || ('her' + Date.now().toString(36));
  const dir = jobDir(id);
  fs.mkdirSync(dir, { recursive: true });

  const mode = ['modify', 'reproduce', 'evaluate'].includes(cfg.mode) ? cfg.mode : 'modify';
  const resolved = mode === 'reproduce' ? { display: String(cfg.reproduce || '').trim(), directModel: '', gguf: null } : resolveSelection(cfg);
  if (resolved.error) return { ok: false, error: resolved.error };

  /* Validate non-model settings upfront so errors return immediately */
  const probeCfg = Object.assign({}, cfg, { model: resolved.directModel || (resolved.gguf && resolved.gguf.name) || cfg.model });
  const probe = buildArgs(probeCfg, dir);
  if (!probe.ok) return probe;

  const preset = PRESETS.some(p => p.id === cfg.preset) ? cfg.preset : 'default';
  const cfgPath = path.join(dir, 'config.toml');
  const tomlText = (typeof cfg.customToml === 'string' && cfg.customToml.trim())
    ? cfg.customToml
    : (presetToml(preset) || presetToml('default'));
  if (tomlText) fs.writeFileSync(cfgPath, tomlText, 'utf8');

  const exportStrategy = cfg.exportStrategy === 'adapter' ? 'adapter' : 'merge';
  const autoImport = mode !== 'evaluate' && exportStrategy === 'merge' && cfg.autoImport !== false;
  const outputName = cleanModelName(cfg.outputName || ((resolved.display.split('/').pop() || 'model') + '-heretic'));
  const outtype = ['q8_0', 'f16', 'bf16'].includes(cfg.outtype) ? cfg.outtype : 'q8_0';

  const prev = readJob(id) || {};
  const job = Object.assign(prev, {
    id,
    mode: probe.mode,
    model: resolved.display || String(cfg.model || '').trim(),
    sourceKind: resolved.gguf ? resolved.gguf.source : (cfg.selectedModel && cfg.selectedModel.startsWith('hfdir:') ? 'hf-cache' : 'custom'),
    evaluateModel: String(cfg.evaluateModel || '').trim(),
    reproduce: String(cfg.reproduce || '').trim(),
    preset,
    quantization: cfg.quantization === 'none' ? 'none' : 'bnb_4bit',
    nTrials: probe.nTrials || 0,
    exportStrategy,
    autoImport,
    ollamaModel: autoImport ? outputName : (prev.ollamaModel || ''),
    outtype,
    status: 'running',
    startedAt: Date.now(),
    finishedAt: 0,
    exitCode: null,
    error: '',
    saveDir: probe.outDir,
  });
  saveJob(id, job);

  const logPath = path.join(dir, 'run.log');
  const outFd = fs.openSync(logPath, 'w');
  const env = Object.assign({}, process.env, {
    PYTHONUNBUFFERED: '1',
    PYTHONIOENCODING: 'utf-8',
    HF_HUB_DISABLE_SYMLINKS_WARNING: '1',
    NO_COLOR: '1',
    TERM: 'dumb',
  });
  if (fs.existsSync(cfgPath)) env.HERETIC_CONFIG_FILE = cfgPath;

  const inputHfDir = path.join(dir, 'input_hf');
  const cleanupTempInput = () => { try { if (fs.existsSync(inputHfDir)) fs.rmSync(inputHfDir, { recursive: true, force: true }); } catch (e) { } };

  const launchHeretic = actualModel => {
    const finalBuilt = buildArgs(Object.assign({}, cfg, { model: actualModel }), dir);
    if (!finalBuilt.ok) {
      try { fs.closeSync(outFd); } catch (e) { }
      runProc = null;
      const j = readJob(id) || job; j.status = 'failed'; j.finishedAt = Date.now(); j.error = finalBuilt.error; saveJob(id, j);
      return;
    }
    runProc = cp.spawn(VENV_PY, finalBuilt.args, { cwd: dir, windowsHide: true, stdio: ['ignore', outFd, outFd], env });
    runId = id;
    const finish = (code, errMsg) => {
      try { fs.closeSync(outFd); } catch (e) { }
      const wasStopped = !runProc;
      runProc = null;
      cleanupTempInput();
      const j = readJob(id) || job;
      j.finishedAt = Date.now();
      j.exitCode = code;
      const saved = fs.existsSync(path.join(finalBuilt.outDir, 'config.json')) || fs.existsSync(path.join(finalBuilt.outDir, 'adapter_config.json'));
      if (wasStopped) { j.status = 'stopped'; j.error = 'Stopped by user.'; saveJob(id, j); return; }
      if (errMsg) { j.status = 'failed'; j.error = errMsg; saveJob(id, j); return; }
      if (code === 0 && (finalBuilt.mode === 'evaluate' || saved)) {
        j.status = 'done'; j.error = ''; saveJob(id, j);
        if (j.autoImport && fs.existsSync(path.join(finalBuilt.outDir, 'config.json'))) {
          convertAndImport(id, { name: j.ollamaModel || outputName, outtype: j.outtype || outtype });
        }
      } else {
        j.status = 'failed'; j.error = 'Heretic exited with code ' + code + '. Check the log for details.'; saveJob(id, j);
      }
    };
    runProc.on('error', e => finish(-1, String(e && e.message || e)));
    runProc.on('exit', code => finish(code == null ? -1 : code, ''));
  };

  if (resolved.gguf) {
    /* Stage 1: prepare local Ollama / LM Studio GGUF for Heretic */
    const resFile = path.join(dir, 'resolved_model.txt');
    try { fs.unlinkSync(resFile); } catch (e) { }
    const pArgs = ['-u', PREPARE_PY, '--gguf', resolved.gguf.ggufPath, '--out', inputHfDir, '--result-file', resFile, '--ollama-name', resolved.gguf.name];
    if (resolved.gguf.hfFallback) pArgs.push('--hf-fallback', resolved.gguf.hfFallback);
    if (cfg.preferHf) pArgs.push('--prefer-hf');

    runProc = cp.spawn(VENV_PY, pArgs, { cwd: dir, windowsHide: true, stdio: ['ignore', outFd, outFd], env });
    runId = id;
    runProc.on('error', e => {
      try { fs.closeSync(outFd); } catch (x) { }
      runProc = null;
      const j = readJob(id) || job; j.status = 'failed'; j.finishedAt = Date.now(); j.error = 'Could not prepare local GGUF: ' + e.message; saveJob(id, j);
    });
    runProc.on('exit', code => {
      if (!runProc) {
        try { fs.closeSync(outFd); } catch (x) { }
        cleanupTempInput();
        const j = readJob(id) || job; j.status = 'stopped'; j.finishedAt = Date.now(); j.error = 'Stopped by user.'; saveJob(id, j);
        return;
      }
      let nextModel = '';
      try { nextModel = fs.readFileSync(resFile, 'utf8').trim(); } catch (e) { }
      if (code !== 0 || !nextModel) {
        try { fs.closeSync(outFd); } catch (x) { }
        runProc = null;
        cleanupTempInput();
        const j = readJob(id) || job; j.status = 'failed'; j.finishedAt = Date.now(); j.error = 'Could not prepare this GGUF model for Heretic (see log).'; saveJob(id, j);
        return;
      }
      launchHeretic(nextModel);
    });
  } else {
    launchHeretic(resolved.directModel || cfg.model);
  }

  return { ok: true, id, job };
}

function parseProgress(log, totalFallback) {
  let trial = 0, total = totalFallback || 0, phase = '';
  for (const ln of String(log || '').split('\n')) {
    const m = /Running trial\s+(\d+)\s+of\s+(\d+)/i.exec(ln);
    if (m) { trial = +m[1]; total = +m[2]; phase = 'Optimizing trial ' + trial + ' of ' + total; continue; }
    if (/Preparing local model|Unpacking tokenizer|Unpacking model weights/i.test(ln)) phase = 'Unpacking local downloaded model for Heretic…';
    else if (/Loading model/i.test(ln)) phase = 'Loading model into GPU…';
    else if (/Determining optimal batch size/i.test(ln)) phase = 'Tuning batch size…';
    else if (/Computing .*direction|Extracting|Residual/i.test(ln)) phase = 'Computing steering directions…';
    else if (/Optimization finished/i.test(ln)) phase = 'Optimization finished — exporting model…';
    else if (/Saving .*model|Merging/i.test(ln)) phase = 'Saving modified model…';
    else if (/Model saved to/i.test(ln)) phase = 'Saved modified model.';
  }
  const pct = total > 0 ? Math.min(100, Math.round((trial / total) * 100)) : 0;
  return { trial, total, pct, phase };
}

function progress(id) {
  const cid = cleanId(id) || runId || convId;
  if (!cid) return { ok: false, error: 'No run selected.' };
  const j = readJob(cid);
  if (!j) return { ok: false, error: 'Run not found.' };
  const log = tailFile(path.join(jobDir(cid), 'run.log'), 180);
  const convLog = tailFile(path.join(jobDir(cid), 'convert.log'), 120);
  const p = parseProgress(log, j.nTrials);
  const outDir = path.join(jobDir(cid), 'output');
  return {
    ok: true,
    job: Object.assign({}, j, {
      running: !!(runProc && runId === cid),
      converting: !!(convProc && convId === cid),
      hasOutput: fs.existsSync(path.join(outDir, 'config.json')) || fs.existsSync(path.join(outDir, 'adapter_config.json')),
      hasAdapterOnly: fs.existsSync(path.join(outDir, 'adapter_config.json')) && !fs.existsSync(path.join(outDir, 'config.json')),
      hasGguf: fs.existsSync(path.join(jobDir(cid), 'model.gguf')),
    }),
    progress: p,
    log,
    convLog,
  };
}

function killTree(pid) {
  if (!pid) return;
  try { cp.spawnSync('taskkill', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true }); } catch (e) { }
}

function stop() {
  if (runProc && runProc.pid) { const pid = runProc.pid; runProc = null; killTree(pid); }
  if (convProc && convProc.pid) { const pid = convProc.pid; convProc = null; killTree(pid); }
  return { ok: true };
}

/* Convert a saved merged Heretic HF model into GGUF and register it in Ollama (+ auto-sync to LM Studio). */
function convertAndImport(id, opts) {
  opts = opts || {};
  const cid = cleanId(id);
  if (!cid) return { ok: false, error: 'Invalid run ID.' };
  if (runProc || convProc) return { ok: false, error: 'Another Heretic job or conversion is currently running.' };
  const j = readJob(cid);
  if (!j) return { ok: false, error: 'Run not found.' };
  const dir = jobDir(cid), outDir = path.join(dir, 'output');
  if (!fs.existsSync(path.join(outDir, 'config.json'))) {
    return { ok: false, error: fs.existsSync(path.join(outDir, 'adapter_config.json'))
      ? 'This run exported a LoRA adapter only. Re-run with Export strategy = Merge full model to convert to GGUF.'
      : 'No saved Hugging Face model found in this run yet.' };
  }
  if (!fs.existsSync(GGUF_CONV) || !fs.existsSync(VENV_PY)) {
    return { ok: false, error: 'GGUF converter (scripts/convert_hf_to_gguf.py) or Python environment is missing.' };
  }

  const outtype = ['q8_0', 'f16', 'bf16'].includes(opts.outtype) ? opts.outtype : 'q8_0';
  const defaultSlug = cleanModelName((j.model.split('/').pop() || 'model') + '-heretic');
  const modelName = cleanModelName(opts.name || defaultSlug);
  const gguf = path.join(dir, 'model.gguf');
  const logPath = path.join(dir, 'convert.log');
  const fd = fs.openSync(logPath, 'w');
  const log = line => { try { fs.writeSync(fd, line + '\n'); } catch (e) { } };

  j.convertStatus = 'converting'; j.convertError = ''; j.ollamaModel = modelName;
  saveJob(cid, j);

  const importGguf = () => {
    log('\nImporting ' + modelName + ' into Ollama...');
    const mf = path.join(dir, 'Modelfile');
    fs.writeFileSync(mf, 'FROM "' + gguf.replace(/\\/g, '/') + '"\n', 'utf8');
    convProc = cp.spawn(ollama, ['create', modelName, '-f', mf], { cwd: dir, windowsHide: true, stdio: ['ignore', fd, fd] });
    convProc.on('exit', c2 => {
      convProc = null;
      const jj = readJob(cid) || j;
      if (c2 === 0) {
        log('\nSyncing to LM Studio...');
        try { lmstudioSync.syncAll(); log('Synced to LM Studio.'); } catch (e) { }
        log('DONE. Model "' + modelName + '" is ready in Moundshroud, Ollama, and LM Studio.');
        jj.convertStatus = 'done'; jj.convertError = ''; jj.ollamaModel = modelName;
      } else {
        log('\nollama create failed (exit ' + c2 + ').');
        jj.convertStatus = 'failed'; jj.convertError = 'ollama create failed (exit ' + c2 + ').';
      }
      saveJob(cid, jj);
      try { fs.closeSync(fd); } catch (e) { }
    });
    convProc.on('error', e => {
      convProc = null;
      log('Could not start Ollama: ' + e.message);
      const jj = readJob(cid) || j; jj.convertStatus = 'failed'; jj.convertError = String(e.message || e); saveJob(cid, jj);
      try { fs.closeSync(fd); } catch (e2) { }
    });
  };

  const runConvert = (precision, canRetryF16) => {
    log('Converting Hugging Face model to GGUF (' + precision + ')...');
    convId = cid;
    convProc = cp.spawn(VENV_PY, [GGUF_CONV, outDir, '--outfile', gguf, '--outtype', precision], { cwd: dir, windowsHide: true, stdio: ['ignore', fd, fd] });
    convProc.on('exit', code => {
      if (!convProc) {
        try { fs.closeSync(fd); } catch (e) { }
        const jj = readJob(cid) || j; jj.convertStatus = 'stopped'; jj.convertError = 'Stopped by user.'; saveJob(cid, jj);
        return;
      }
      if (code === 0 && fs.existsSync(gguf)) return importGguf();
      if (canRetryF16 && precision !== 'f16') {
        log('\n' + precision + ' conversion failed (exit ' + code + '); retrying with f16...');
        return runConvert('f16', false);
      }
      convProc = null;
      log('GGUF conversion failed (exit code ' + code + ').');
      try { fs.closeSync(fd); } catch (e) { }
      const jj = readJob(cid) || j; jj.convertStatus = 'failed'; jj.convertError = 'GGUF conversion failed (exit ' + code + ').'; saveJob(cid, jj);
    });
    convProc.on('error', e => {
      convProc = null;
      log('Could not start converter: ' + e.message);
      const jj = readJob(cid) || j; jj.convertStatus = 'failed'; jj.convertError = String(e.message || e); saveJob(cid, jj);
      try { fs.closeSync(fd); } catch (e2) { }
    });
  };

  runConvert(outtype, true);
  return { ok: true, id: cid, modelName };
}

function openFolder(id) {
  const cid = cleanId(id);
  if (!cid) return { ok: false, error: 'Invalid run ID.' };
  const dir = jobDir(cid), out = path.join(dir, 'output');
  const target = fs.existsSync(out) ? out : dir;
  if (!fs.existsSync(target)) return { ok: false, error: 'Folder does not exist.' };
  try { cp.spawn('explorer.exe', [target], { detached: true, stdio: 'ignore' }).unref(); return { ok: true }; }
  catch (e) { return { ok: false, error: e.message }; }
}

function remove(id) {
  const cid = cleanId(id);
  if (!cid) return { ok: false, error: 'Invalid run ID.' };
  if ((runProc && runId === cid) || (convProc && convId === cid)) return { ok: false, error: 'Stop this run before deleting it.' };
  try { fs.rmSync(jobDir(cid), { recursive: true, force: true }); return { ok: true }; }
  catch (e) { return { ok: false, error: e.message }; }
}

function stopAll() {
  stop();
  if (setupProc && setupProc.pid) { const pid = setupProc.pid; setupProc = null; killTree(pid); }
}

function setJobsDir(d) { if (d) JOBS = d; }

module.exports = {
  status, downloadedModels, guessHfRepo, presetToml, install, installLog, start, progress, stop, convertAndImport, openFolder, remove, stopAll,
  buildArgs, parseProgress, setJobsDir, PRESETS, SUGGESTED_MODELS, listJobs,
};

// Every AI model on this PC, each with something it can do in Moundshroud.
// The catalog joins Ollama's models with the model files lib/model-finder.js finds on every drive, and gives each a
// use the app can run with the engines it already has:
//   talk     a language model in Ollama: chat, and drive the agent when it can use tools
//   find     an embedding model in Ollama: search files by meaning
//   import   a language or embedding file Ollama can take: one copy into Ollama, then it talks or finds
//   picture  an image model file (SD 1.5, SDXL, FLUX) run by stable-diffusion.cpp (imggen\bin\sd-cli.exe)
//   video    the Wan text-to-video model, run by the same engine
//   speak    a Piper voice (.onnx with its .onnx.json) run by piper.exe
//   listen   a whisper.cpp model (ggml-*.bin) run by the speech-to-text worker
//   music    a MusicGen folder run by musicgen\gen.py
//   info     a model that only works inside another model or program: the catalog says which, and what it is
// Files are only ever chosen from the catalog by id: a request can never name an arbitrary path.
const fs = require('fs'), os = require('os'), path = require('path'), http = require('http'), crypto = require('crypto');
const finder = require('./model-finder');

const ROOT = path.join(__dirname, '..');
let DATA = path.join(ROOT, 'data');
const madeDir = () => path.join(DATA, 'made');
const SD_EXE = path.join(ROOT, 'imggen', 'bin', 'sd-cli.exe'), PIPER = path.join(ROOT, 'piper', 'bin', 'piper.exe');
const MG_GEN = path.join(ROOT, 'musicgen', 'gen.py'), VOICE_PY = path.join(ROOT, 'pyenv', 'Scripts', 'python.exe');
const has = p => { try { return fs.existsSync(p); } catch (e) { return false; } };

const USE_LABEL = {
  talk: 'Chat and agent', find: 'Search by meaning', import: 'Bring into Ollama, then use', picture: 'Make pictures', video: 'Make video clips',
  speak: 'Speak text aloud', listen: 'Turn speech into text', music: 'Make music', info: 'Part of another model or program'
};

/* what an Ollama model can do: the capabilities Ollama reports */
function ollamaUse(m) {
  const caps = m.capabilities || [];
  if (m.embedding || caps.includes('embedding')) return 'find';
  return 'talk';
}

/* what a model file can do with the engines this app has */
function fileUse(f) {
  const p = String(f.path || ''), base = path.basename(p).toLowerCase(), fmt = f.format;
  if ((f.kind === 'llm' || f.kind === 'embedding') && f.ollama) return { use: 'import' };
  if (f.kind === 'llm') return { use: 'info', note: 'Ollama cannot import ' + (fmt === 'safetensors' ? 'this architecture from safetensors' : 'the ' + fmt + ' format') + '. A GGUF copy of this model would run.' };
  if (f.kind === 'embedding') return { use: 'info', note: 'Ollama cannot import this embedding format. A GGUF copy of it would run.' };
  if (f.kind === 'diffusion') {
    if (fmt === 'diffusers') return { use: 'info', note: 'A Diffusers folder: the picture engine here takes single-file models (.safetensors, .ckpt or .gguf).' };
    if (/vae|(^|[^a-z])ae\.safetensors$|clip_|_vae/.test(base)) return { use: 'info', note: 'The image decoder that a picture model uses: it runs when that model makes a picture.' };
    if (/wan.*t2v/.test(base)) return has(SD_EXE) ? { use: 'video' } : { use: 'info', note: 'The video engine is not installed.' };
    if (/wan|vace/.test(base)) return { use: 'info', note: 'A video model the engine here cannot drive alone (it needs a reference video).' };
    if (/\.(safetensors|ckpt|gguf)$/.test(base)) return has(SD_EXE) ? { use: 'picture' } : { use: 'info', note: 'The picture engine (imggen) is not installed.' };
  }
  if (f.kind === 'speech') {
    if (/\.onnx$/.test(base) && has(p + '.json') && has(PIPER)) return { use: 'speak' };
    if (/^ggml-(tiny|base|small|medium|large)/.test(base) && has(VOICE_PY)) return { use: 'listen' };
    return { use: 'info', note: 'A speech model in a format the voice engines here cannot read (Piper reads .onnx voices with their .json, whisper.cpp reads ggml-*.bin).' };
  }
  if (f.kind === 'audio' && fmt === 'safetensors' && has(path.join(p, 'config.json')) && has(MG_GEN)) return { use: 'music' };
  if (f.kind === 'encoder') return { use: 'info', note: 'An encoder that an image or video model reads its prompt with: it runs when that model is used.' };
  if (f.kind === 'adapter') return { use: 'info', note: 'An adapter that changes another model; it does not run alone.' };
  return { use: 'info', note: f.source && f.source !== 'file' ? 'Belongs to ' + f.source + '.' : 'Part of another program (' + path.basename(path.dirname(p)) + ').' };
}

/* Ollama's own list with capabilities, read straight from Ollama */
function ollamaJson(p, body) {
  return new Promise(res => {
    const data = body ? JSON.stringify(body) : null;
    const r = http.request({ host: '127.0.0.1', port: 11434, path: p, method: data ? 'POST' : 'GET', timeout: 8000, headers: data ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } : {} }, rs => {
      let b = ''; rs.on('data', c => { b += c; }); rs.on('end', () => { try { res(JSON.parse(b)); } catch (e) { res(null); } });
    });
    r.on('error', () => res(null)); r.on('timeout', () => { r.destroy(); res(null); });
    if (data) r.end(data); else r.end();
  });
}
async function ollamaModels() {
  const t = await ollamaJson('/api/tags');
  const list = ((t && t.models) || []).filter(m => m && m.name);
  return Promise.all(list.map(async m => {
    const s = await ollamaJson('/api/show', { model: m.name });
    return { name: m.name, size: m.size || 0, capabilities: (s && s.capabilities) || [] };
  }));
}

/* the whole catalog; opts.fresh walks the drives again */
async function catalog(opts) {
  const o = opts || {};
  const [ol, found] = await Promise.all([ollamaModels(), finder.findAsync({ fresh: !!o.fresh })]);
  const out = [];
  ol.forEach(m => {
    const use = ollamaUse(m), caps = m.capabilities;
    out.push({
      id: 'ollama:' + m.name, name: m.name, ollama: m.name, source: 'Ollama', size: m.size, use, useLabel: USE_LABEL[use],
      kind: use === 'find' ? 'embedding' : 'llm', kindName: use === 'find' ? 'embedding model' : 'language model',
      tools: caps.includes('tools'), vision: caps.includes('vision'), thinking: caps.includes('thinking')
    });
  });
  /* a file already imported into Ollama is not listed twice: "Meta-Llama-3.1-8B-Instruct-Q4_K_M" and
     "meta-llama-3.1-8b-instruct-q4-k-m" are the same model, whichever program made the copy */
  const norm = s => String(s || '').replace(/:latest$/, '').toLowerCase().replace(/[^a-z0-9.]+/g, '-').replace(/^-+|-+$/g, '');
  const have = new Set(ol.map(m => norm(m.name)));
  ((found && found.models) || []).forEach(f => {
    if (have.has(norm(f.name)) || have.has(finder.ollamaName(f, []))) return;
    const u = fileUse(f);
    out.push({
      id: 'file:' + f.path, name: f.name, path: f.path, source: f.source, size: f.size || 0, format: f.format,
      kind: f.kind, kindName: f.kindName || f.kind, use: u.use, useLabel: USE_LABEL[u.use], note: u.note || ''
    });
  });
  return { at: Date.now(), scannedAt: (found && found.at) || 0, models: out, engines: { picture: has(SD_EXE), speak: has(PIPER), listen: has(VOICE_PY), music: has(MG_GEN) } };
}
let last = null;
async function byId(id) {
  if (!last || Date.now() - last.at > 60000) last = await catalog();
  let m = last.models.find(x => x.id === id);
  if (!m) { last = await catalog(); m = last.models.find(x => x.id === id); }
  return m || null;
}

/* a file the app made, kept in data\made and served by id */
function keep(file, ext) {
  fs.mkdirSync(madeDir(), { recursive: true });
  const id = crypto.randomBytes(6).toString('hex');
  fs.copyFileSync(file, path.join(madeDir(), id + ext));
  try { fs.unlinkSync(file); } catch (e) { }
  return id;
}
function madeFile(id) {
  if (!/^[0-9a-f]{12}$/.test(String(id || ''))) return null;
  for (const ext of ['.png', '.wav', '.webm', '.mp4']) { const f = path.join(madeDir(), id + ext); if (has(f)) return { file: f, ext }; }
  return null;
}
const MIME = { '.png': 'image/png', '.wav': 'audio/wav', '.webm': 'video/webm', '.mp4': 'video/mp4' };

/* run one model at its use: { id, prompt, copyTo } -> { ok, made: { id, kind, mime }, file } */
async function run(media, b) {
  const m = await byId(String((b && b.id) || ''));
  if (!m) return { ok: false, error: 'That model is not in the list any more. Rescan the models.' };
  const prompt = String((b && b.prompt) || '').trim();
  let r, ext, kind;
  if (m.use === 'picture') {
    if (!prompt) return { ok: false, error: 'Say what the picture should show.' };
    r = /kontext|flux/i.test(m.name) && /flux1-kontext/i.test(path.basename(m.path)) ? await media.flux({ prompt }) : await media.image({ prompt, model: m.path, steps: b.steps });
    ext = '.png'; kind = 'image';
  } else if (m.use === 'video') {
    if (!prompt) return { ok: false, error: 'Describe the video first.' };
    r = await media.video({ prompt }); ext = '.webm'; kind = 'video';
  } else if (m.use === 'speak') {
    if (!prompt) return { ok: false, error: 'Type the words to speak.' };
    r = await media.voice({ voicePath: m.path, text: prompt }); ext = '.wav'; kind = 'audio';
  } else if (m.use === 'music') {
    if (!prompt) return { ok: false, error: 'Describe the music first.' };
    r = await media.music({ prompt, modelDir: m.path, seconds: b.seconds }); ext = '.wav'; kind = 'audio';
  } else return { ok: false, error: m.name + ' is used for "' + m.useLabel + '", not for making files.' };
  if (!r || !r.ok) {
    /* pictures and video need the graphics card: when it failed, say which other programs are holding its memory */
    let why = '';
    if (m.use === 'picture' || m.use === 'video') { const g = gpuHolders(); if (g.length) why = ' The graphics card memory is held by ' + g.join(', ') + ': close or unload the model there, then try again.'; }
    return { ok: false, error: ((r && r.error) || 'The model could not finish.') + why };
  }
  const id = keep(r.file, ext);
  let copied = '';
  if (b.copyTo) {
    try { const dest = path.join(b.copyTo, 'made-' + m.use + '-' + id + ext); fs.copyFileSync(path.join(madeDir(), id + ext), dest); copied = dest; } catch (e) { }
  }
  return { ok: true, made: { id, kind, mime: MIME[ext], url: '/api/models/made?id=' + id }, copied, model: m.name, use: m.use };
}

/* the other programs using the graphics card, by name (nvidia-smi); Ollama is left out because the engines unload it */
function gpuHolders() {
  try {
    const out = require('child_process').execFileSync('nvidia-smi', ['--query-compute-apps=process_name', '--format=csv,noheader'], { encoding: 'utf8', timeout: 5000, windowsHide: true });
    const names = out.split(/\r?\n/).map(s => s.trim()).filter(Boolean).map(p => {
      const low = p.toLowerCase();
      if (/lmstudio|lm studio/.test(low)) return 'LM Studio';
      if (/ollama/.test(low)) return '';
      if (/sd-cli|python/.test(low) && low.includes('moundshroud')) return '';
      return path.basename(p).replace(/\.exe$/i, '');
    }).filter(Boolean);
    return [...new Set(names)];
  } catch (e) { return []; }
}

/* bring a language or embedding file into Ollama: checks the disk first */
async function importModel(hf, b) {
  const m = await byId(String((b && b.id) || ''));
  if (!m || m.use !== 'import') return { ok: false, error: 'That model cannot be brought into Ollama.' };
  let free = -1; try { const s = fs.statfsSync(m.path); free = Number(s.bavail) * Number(s.bsize); } catch (e) { }
  if (free >= 0 && free < m.size * 1.1 + 5 * 1073741824) return { ok: false, error: 'Not enough free disk: it needs ' + Math.round(m.size * 1.1 / 1e6) + ' MB plus 5 GB to spare.' };
  const taken = (last ? last.models : []).filter(x => x.ollama).map(x => x.ollama);
  const name = finder.ollamaName(m, taken);
  const r = await hf.create(name, m.path);
  last = null;
  return r.ok ? { ok: true, name, use: m.kind === 'embedding' ? 'find' : 'talk' } : r;
}

/* the speech-to-text model a catalog id names, for the voice worker */
async function listenPath(id) {
  const m = await byId(String(id || ''));
  return m && m.use === 'listen' ? m.path : '';
}

function setData(d) { DATA = d; finder.setData(d); }
module.exports = { catalog, byId, run, importModel, listenPath, madeFile, MIME, fileUse, ollamaUse, USE_LABEL, setData };

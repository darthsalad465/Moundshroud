// Finds AI model files anywhere on this PC, so Moundshroud Code can offer every one of them.
// It walks the home folder and every drive (with a time limit), and recognises:
//   .gguf files (llama.cpp, LM Studio, Jan, GPT4All, koboldcpp...): the header names the architecture and context
//   Hugging Face folders (config.json + .safetensors or pytorch_model.bin) and Diffusers folders (model_index.json)
//   loose .safetensors, .onnx, .pt, .pth, .ckpt, ggml .bin, .tflite and .llamafile files
// Each model gets a kind (language, embedding, reranker, speech, vision encoder, image generator, classifier,
// adapter) and says whether Ollama can run it. Models already inside Ollama are skipped: Ollama lists those itself.
// Nothing is loaded or changed: files are only listed and their first few megabytes read. The list is cached in
// data\model-files.json for a day; find({ fresh: true }) walks again.
const fs = require('fs'), os = require('os'), path = require('path');

let DATA = path.join(__dirname, '..', 'data');
const cacheFile = () => path.join(DATA, 'model-files.json');
const DAY = 24 * 3600 * 1000;

const MODEL_EXT = /\.(gguf|safetensors|onnx|pt|pth|ckpt|bin|tflite|llamafile)$/i;
const SKIP_DIR = /^(node_modules|\.git|\.svn|\$recycle\.bin|system volume information|windows|winsxs|__pycache__|\.ollama|\.npm|\.nuget|\.gradle|\.m2|\.cargo|\.rustup|site-packages|dist-packages|_snapshots|recovery|perflogs|programdata|msocache|config\.msi|windowsapps|packages|inetcache|webcache|crashdumps)$/i;
const KINDS = {
  llm: 'language model', embedding: 'embedding model', reranker: 'reranker', speech: 'speech model', audio: 'music and sound generator',
  encoder: 'encoder', diffusion: 'image or video generator', classifier: 'classifier', adapter: 'adapter', other: 'model'
};
/* the architectures Ollama can import from a Hugging Face safetensors folder */
const OLLAMA_HF = /^(Llama|Mistral|Mixtral|Gemma|Gemma2|Gemma3|Phi3|Qwen2|Qwen3|Qwen2Moe|Qwen3Moe)ForCausalLM$|^Gemma3ForConditionalGeneration$/;

/* ---------------- reading a GGUF header ----------------
   GGUF: "GGUF", version u32, tensor count u64, key count u64, then key/value pairs. Only the first few megabytes
   are read; the walk stops at the tokenizer, whose word lists are long and not needed. */
function readGgufHeader(file, maxBytes) {
  let fd;
  try {
    fd = fs.openSync(file, 'r');
    const buf = Buffer.alloc(Math.min(maxBytes || 4 * 1048576, Math.max(64, fs.fstatSync(fd).size)));
    const n = fs.readSync(fd, buf, 0, buf.length, 0);
    return parseGguf(buf.subarray(0, n));
  } catch (e) { return null; } finally { if (fd != null) try { fs.closeSync(fd); } catch (e) { } }
}
function parseGguf(buf) {
  if (!buf || buf.length < 24 || buf.toString('latin1', 0, 4) !== 'GGUF') return null;
  let o = 4;
  const need = n => { if (o + n > buf.length) throw new Error('short'); };
  const u32 = () => { need(4); const v = buf.readUInt32LE(o); o += 4; return v; };
  const u64 = () => { need(8); const v = Number(buf.readBigUInt64LE(o)); o += 8; return v; };
  const str = () => { const len = u64(); need(len); const s = buf.toString('utf8', o, o + len); o += len; return s; };
  const SIZES = { 0: 1, 1: 1, 2: 2, 3: 2, 4: 4, 5: 4, 6: 4, 7: 1, 10: 8, 11: 8, 12: 8 };
  const val = t => {
    if (t === 8) return str();
    if (t === 9) {
      const it = u32(), count = u64();
      if (it === 8) { for (let i = 0; i < count; i++) str(); return null; }
      const sz = SIZES[it]; if (!sz) throw new Error('bad array');
      need(sz * count); o += sz * count; return null;
    }
    const sz = SIZES[t]; if (!sz) throw new Error('bad type');
    need(sz);
    let v;
    if (t === 0) v = buf.readUInt8(o); else if (t === 1) v = buf.readInt8(o);
    else if (t === 2) v = buf.readUInt16LE(o); else if (t === 3) v = buf.readInt16LE(o);
    else if (t === 4) v = buf.readUInt32LE(o); else if (t === 5) v = buf.readInt32LE(o);
    else if (t === 6) v = buf.readFloatLE(o); else if (t === 7) v = !!buf.readUInt8(o);
    else if (t === 10) v = Number(buf.readBigUInt64LE(o)); else if (t === 11) v = Number(buf.readBigInt64LE(o));
    else v = buf.readDoubleLE(o);
    o += sz; return v;
  };
  const meta = {};
  try {
    const version = u32(); u64(); const kv = u64();
    meta.version = version;
    for (let i = 0; i < kv; i++) {
      const key = str();
      if (/^tokenizer\./.test(key)) break;
      const t = u32();
      const v = val(t);
      if (v !== null && typeof v !== 'object') meta[key] = v;
    }
  } catch (e) { /* a header longer than the bytes read: keep what was found */ }
  const arch = String(meta['general.architecture'] || '');
  let ctx = 0;
  Object.keys(meta).forEach(k => { if (/\.context_length$/.test(k) && +meta[k] > ctx) ctx = +meta[k]; });
  return {
    arch, name: String(meta['general.name'] || ''), type: String(meta['general.type'] || ''),
    sizeLabel: String(meta['general.size_label'] || ''), ctx, fileType: meta['general.file_type'], pooling: meta[arch + '.pooling_type']
  };
}

/* ---------------- what kind of AI a model is ---------------- */
function kindOf(info) {
  const i = info || {}, arch = String(i.arch || '').toLowerCase();
  const hay = (String(i.name || '') + ' ' + String(i.file || '') + ' ' + arch + ' ' + String(i.archs || '')).toLowerCase();
  if (i.type === 'mmproj' || i.type === 'adapter' || /mmproj|lora|adapter/.test(path.basename(String(i.file || '')).toLowerCase())) return 'adapter';
  const fileLower = String(i.file || '').toLowerCase();
  if (/rerank/.test(hay)) return 'reranker';
  if (/musicgen|audiocraft|stable-audio|audioldm|riffusion|(^|[^a-z])bark([^a-z]|$)/.test(hay)) return 'audio';
  if (/(^|[\\/])ggml-(tiny|base|small|medium|large)/.test(fileLower)) return 'speech';            // whisper.cpp
  if (/[a-z]{2}_[a-z]{2}-[a-z0-9_]+-(x_low|low|medium|high)\.onnx$/.test(fileLower)) return 'speech'; // Piper voices
  if (/whisper|wav2vec|parakeet|kokoro|piper|outetts|orpheus|chatterbox|(^|[^a-z])(tts|asr)([^a-z]|$)|speech|silero|vosk/.test(hay)) return 'speech';
  if (arch === 't5encoder' || /umt5|t5-v1_1|t5xxl|text_encoder/.test(hay)) return 'encoder';       // text encoders of image models
  if (i.diffusers || /stable-diffusion|sdxl|sd_xl|(^|[^a-z])sd[-_ ]?(1\.5|15|2|21|3|xl)|flux|diffusion|unet|(^|[^a-z])vae([^a-z]|$)|controlnet|realvis|dreamshaper|juggernaut|wan2|wan_2|hunyuan|ltx-?video|imggen/.test(hay)) return 'diffusion';
  if (/^(clip|siglip)$/.test(arch) || /(^|[^a-z])(clip|siglip|dinov2|vit)([^a-z]|$)/.test(hay)) return 'encoder';
  if (/bert|jina-bert/.test(arch) && !/classif|guard/.test(hay)) return 'embedding';
  if (/(^|[^a-z])embed(ding|dings)?([^a-z]|$)|(^|[^a-z])(bge|gte|e5|minilm|mpnet|nomic)([^a-z]|$)|nomic-embed|sentence-transformer/.test(hay)) return 'embedding';
  if (/forsequenceclassification|fortokenclassification|classifier|(^|[^a-z])guard([^a-z]|$)|shield/.test(hay)) return 'classifier';
  if (arch || /forcausallm|forconditionalgeneration|\.llamafile$|(^|[^a-z])(llama|qwen|gemma|mistral|mixtral|phi|deepseek|granite|falcon|smollm|olmo|gpt|instruct|chat|coder)([^a-z]|$)/.test(hay)) return 'llm';
  return 'other';
}

/* where a file lives tells the person which program it came with */
function sourceOf(p) {
  const s = String(p).toLowerCase().replace(/\//g, '\\');
  if (s.startsWith(path.join(__dirname, '..').toLowerCase()) || /\\moundshrouddata\\/.test(s)) return 'Moundshroud';
  if (/\\\.lmstudio\\|\\lm studio\\|\\lmstudio\\/.test(s)) return 'LM Studio';
  if (/\\huggingface\\hub\\|\\\.cache\\huggingface\\/.test(s)) return 'Hugging Face cache';
  if (/\\jan\\|\\janai\\/.test(s)) return 'Jan';
  if (/gpt4all/.test(s)) return 'GPT4All';
  if (/comfyui/.test(s)) return 'ComfyUI';
  if (/stable-diffusion-webui|automatic1111|forge/.test(s)) return 'Stable Diffusion WebUI';
  if (/koboldcpp/.test(s)) return 'KoboldCpp';
  if (/\\downloads\\/.test(s)) return 'Downloads';
  return 'file';
}

const readJson = f => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return null; } };
function hfName(dir) {
  const m = /models--([^\\/]+?)(?:--([^\\/]+))?[\\/]snapshots/i.exec(dir);
  if (m) return m[2] ? m[1] + '/' + m[2] : m[1];
  const b = path.basename(dir);
  return /^(hf|model|out|output|weights|final|checkpoint[-_\d]*)$/i.test(b) ? path.basename(path.dirname(dir)) + '/' + b : b;
}
/* "model", "hf" or a file inside a Hugging Face snapshot says little alone: the folder it sits in names it */
function displayName(file, stem) {
  const hf = /models--([^\\/]+?)(?:--([^\\/]+))?[\\/]snapshots/i.exec(file);
  if (hf) return (hf[2] ? hf[1] + '/' + hf[2] : hf[1]) + (/^(model|pytorch_model|weights)$/i.test(stem) ? '' : ' · ' + stem);
  if (/^(model|hf|ae|weights|ggml-model|pytorch_model|out)$/i.test(stem)) return path.basename(path.dirname(file)) + '/' + stem;
  return stem;
}

/* one folder that is a whole model (Hugging Face or Diffusers) */
function folderModel(dir, names) {
  const lower = names.map(n => n.toLowerCase());
  if (lower.includes('model_index.json')) {
    return { name: hfName(dir), path: dir, format: 'diffusers', kind: 'diffusion', size: dirSize(dir), ollama: false };
  }
  if (!lower.includes('config.json')) return null;
  const weights = names.filter(n => /\.safetensors$|^pytorch_model.*\.bin$|\.onnx$/i.test(n));
  if (!weights.length) return null;
  const cfg = readJson(path.join(dir, 'config.json')) || {};
  const archs = (cfg.architectures || []).join(' ');
  const sentence = lower.includes('modules.json') || lower.includes('sentence_bert_config.json');
  const info = { name: hfName(dir), file: dir, arch: String(cfg.model_type || ''), archs };
  let kind = sentence ? 'embedding' : kindOf(info);
  if (kind === 'other' && /ForCausalLM/.test(archs)) kind = 'llm';
  const ctx = +cfg.max_position_embeddings || +cfg.n_positions || 0;
  return {
    name: info.name, path: dir, format: weights.some(n => /\.safetensors$/i.test(n)) ? 'safetensors' : /\.onnx$/i.test(weights[0]) ? 'onnx' : 'pytorch',
    kind, arch: info.arch, ctx, size: dirSize(dir),
    ollama: kind === 'llm' && (cfg.architectures || []).some(a => OLLAMA_HF.test(a)) && weights.some(n => /\.safetensors$/i.test(n))
  };
}
function dirSize(dir) {
  let total = 0;
  try { for (const e of fs.readdirSync(dir, { withFileTypes: true })) { try { const p = path.join(dir, e.name); const st = fs.statSync(p); if (st.isFile()) total += st.size; } catch (x) { } } } catch (e) { }
  return total;
}

/* one file that is a model by itself */
function fileModel(file, size) {
  const base = path.basename(file), ext = path.extname(base).toLowerCase(), stem = base.slice(0, -ext.length);
  if (ext === '.gguf') {
    if (/-0000[2-9]-of-|-000[1-9]\d-of-/i.test(base)) return null;           // later parts of a split file
    const h = readGgufHeader(file) || {};
    const kind = kindOf(Object.assign({ file }, h));
    return { name: displayName(file, stem), path: file, format: 'gguf', kind, arch: h.arch || '', ctx: h.ctx || 0, size, label: h.name || '', sizeLabel: h.sizeLabel || '',
      ollama: kind === 'llm' || (kind === 'embedding' && /bert/.test(h.arch || '')) };
  }
  if (ext === '.llamafile') return { name: displayName(file, stem), path: file, format: 'llamafile', kind: 'llm', size, ollama: false };
  if (ext === '.bin') {
    if (!/ggml|whisper|gguf|llama|weights|model/i.test(base)) return null;
    return { name: displayName(file, stem), path: file, format: /ggml/i.test(base) ? 'ggml' : 'bin', kind: kindOf({ file }), size, ollama: false };
  }
  const fmt = ext.slice(1);
  let kind = kindOf({ file });
  /* a lone .safetensors or .ckpt checkpoint in an image-tool folder is an image model */
  if ((ext === '.safetensors' || ext === '.ckpt') && kind === 'other' && /stable|diffusion|checkpoint|comfyui|webui|models[\\/](lora|vae|unet)/i.test(file)) kind = /lora/i.test(file) ? 'adapter' : 'diffusion';
  return { name: displayName(file, stem), path: file, format: fmt, kind, size, ollama: false };
}

/* ---------------- the walk ---------------- */
function roots() {
  const home = os.homedir(), out = [{ dir: home, depth: 7 }];
  if (process.platform === 'win32') {
    for (let c = 67; c <= 90; c++) {                         // C: to Z:
      const d = String.fromCharCode(c) + ':\\';
      try { if (fs.existsSync(d)) out.push({ dir: d, depth: 5 }); } catch (e) { }
    }
  } else out.push({ dir: '/', depth: 5 });
  return out;
}
function walk(opts) {
  const o = opts || {};
  const until = Date.now() + (o.budgetMs || 25000);
  const minBytes = o.minBytes == null ? 5 * 1048576 : o.minBytes;
  const home = os.homedir().toLowerCase();
  const found = [], seenFolder = new Set(), seenDir = new Set();
  let timedOut = false;
  /* the home folder is walked first and deeper; seenDir keeps the drive walk from walking it twice */
  const go = (dir, depth) => {
    if (Date.now() > until) { timedOut = true; return; }
    const key = dir.toLowerCase();
    if (seenDir.has(key)) return; seenDir.add(key);
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return; }
    const names = entries.map(e => e.name);
    const whole = folderModel(dir, names);
    if (whole) { if (!seenFolder.has(key)) { seenFolder.add(key); found.push(whole); } return; }
    for (const e of entries) {
      if (e.isFile() && MODEL_EXT.test(e.name)) {
        const p = path.join(dir, e.name);
        let size = 0; try { size = fs.statSync(p).size; } catch (x) { continue; }
        if (size < minBytes) continue;
        const m = fileModel(p, size);
        if (m) found.push(m);
      }
    }
    if (depth <= 0) return;
    for (const e of entries) {
      if (!e.isDirectory() || e.isSymbolicLink()) continue;
      if (SKIP_DIR.test(e.name)) continue;
      const p = path.join(dir, e.name), lp = p.toLowerCase();
      /* browser caches, temp files and Store packages hold no models worth listing, unless the walk started there */
      if (!rootSkip && /\\appdata\\local\\(microsoft|temp|packages|google\\chrome|mozilla)/.test(lp)) continue;
      if (/\\\.lmstudio\\models\\ollama$|\\lm studio\\models\\ollama$/.test(lp)) continue;   // mirror of Ollama's own models
      go(p, depth - 1);
    }
  };
  let rootSkip = false;
  for (const r of (o.roots || roots())) {
    if (timedOut) break;
    rootSkip = /\\appdata\\local\\(microsoft|temp|packages|google\\chrome|mozilla)/.test(String(r.dir).toLowerCase());
    go(r.dir, r.depth);
  }
  /* one entry per real model: a split GGUF counts once, a folder counted once */
  const byPath = new Map();
  found.forEach(m => { if (!byPath.has(m.path.toLowerCase())) byPath.set(m.path.toLowerCase(), m); });
  const list = [...byPath.values()].map(m => Object.assign(m, { source: sourceOf(m.path), kindName: KINDS[m.kind] || 'model' }));
  list.sort((a, b) => (a.kind === 'llm' ? 0 : 1) - (b.kind === 'llm' ? 0 : 1) || (b.size || 0) - (a.size || 0));
  return { models: list, timedOut };
}

/* the folders where model files usually land: looked in on every call, so a new download shows up at once */
function quickRoots() {
  const h = os.homedir(), la = process.env.LOCALAPPDATA || path.join(h, 'AppData', 'Local'), ra = process.env.APPDATA || path.join(h, 'AppData', 'Roaming');
  return [path.join(DATA, 'gguf'), path.join(__dirname, '..', 'data', 'gguf'), path.join(h, '.lmstudio', 'models'), path.join(h, '.cache', 'lm-studio', 'models'),
    path.join(h, '.cache', 'huggingface', 'hub'), path.join(ra, 'Jan', 'data', 'models'), path.join(la, 'nomic.ai', 'GPT4All'), path.join(h, 'Downloads')]
    .filter((d, i, a) => a.indexOf(d) === i && fs.existsSync(d)).map(dir => ({ dir, depth: 5 }));
}

/* the cached list, or a fresh walk when asked or when the cache is a day old */
function find(opts) {
  const o = opts || {};
  if (!o.fresh && !o.roots) {
    const c = readJson(cacheFile());
    if (c && Array.isArray(c.models) && Date.now() - (+c.at || 0) < DAY) {
      /* drop files that have gone since the walk, and add new ones from the usual model folders, which are quick to look in */
      const kept = c.models.filter(m => { try { return fs.existsSync(m.path); } catch (e) { return false; } });
      const have = new Set(kept.map(m => String(m.path).toLowerCase()));
      const fresh = walk({ roots: quickRoots(), budgetMs: 4000 }).models.filter(m => !have.has(String(m.path).toLowerCase()));
      return Object.assign({ cached: true }, c, { models: kept.concat(fresh) });
    }
  }
  const r = walk(o);
  const out = { at: Date.now(), timedOut: r.timedOut, models: r.models };
  if (!o.roots) try { fs.mkdirSync(DATA, { recursive: true }); fs.writeFileSync(cacheFile(), JSON.stringify(out)); } catch (e) { }
  return out;
}
/* The walk can take 10 to 25 seconds on a big disk: a fresh one runs on a worker thread, so a terminal or a server
   that asks for it keeps answering meanwhile. A cached list comes straight back. */
function findAsync(opts) {
  const o = opts || {};
  if (!o.fresh) {
    const c = readJson(cacheFile());
    if (c && Array.isArray(c.models) && Date.now() - (+c.at || 0) < DAY) return Promise.resolve(find(o));
  }
  return new Promise(res => {
    let W;
    try { W = require('worker_threads').Worker; } catch (e) { return res(find(o)); }
    const code = 'const { parentPort, workerData } = require("worker_threads"); const F = require(workerData.mod); F.setData(workerData.data);' +
      'try { parentPort.postMessage(F.find(workerData.opts)); } catch (e) { parentPort.postMessage({ at: Date.now(), models: [], error: e.message }); }';
    const w = new W(code, { eval: true, workerData: { mod: __filename, data: DATA, opts: Object.assign({}, o, { fresh: true }) } });
    w.once('message', m => res(m));
    w.once('error', e => res({ at: Date.now(), models: [], error: e.message }));
  });
}

/* a name Ollama accepts for an imported file: lowercase letters, digits, dot, dash */
function ollamaName(m, taken) {
  /* the last part of the name, or the last two when the last says nothing ("out/model" -> "out-model") */
  const bits = String(m.name || 'model').split(/[\\/]/).filter(Boolean);
  const tail = bits.length > 1 && /^(model|hf|out|weights|ggml-model)(\.gguf)?$/i.test(bits[bits.length - 1]) ? bits.slice(-2).join('-') : bits.pop() || 'model';
  let base = tail.toLowerCase().replace(/\.(gguf|safetensors)$/, '').replace(/[^a-z0-9.]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48) || 'model';
  let n = base, i = 2;
  const have = new Set((taken || []).map(t => String(t).replace(/:latest$/, '').toLowerCase()));
  while (have.has(n)) n = base + '-' + i++;
  return n;
}
function setData(d) { DATA = d; }

module.exports = { find, findAsync, walk, readGgufHeader, parseGguf, kindOf, sourceOf, folderModel, fileModel, ollamaName, KINDS, setData };

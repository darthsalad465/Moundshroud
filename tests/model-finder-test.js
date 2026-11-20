// Model finder (lib/model-finder.js) and /find (lib/code-find.js) for Moundshroud Code: GGUF headers are read,
// every kind of model file is recognised and named, a walk finds them in folders, and an embedding model is never
// chosen to talk.
const fs = require('fs'), os = require('os'), path = require('path');

module.exports = async ok => {
  const F = require(path.join(__dirname, '..', 'lib', 'model-finder.js'));
  const CF = require(path.join(__dirname, '..', 'lib', 'code-find.js'));
  const agent = require(path.join(__dirname, '..', 'lib', 'agent.js'));
  const eq = (name, got, want) => ok(name, got === want, 'got ' + JSON.stringify(got) + ', wanted ' + JSON.stringify(want));

  /* a tiny GGUF header written by hand */
  function gguf(kv) {
    const parts = [];
    const u32 = n => { const b = Buffer.alloc(4); b.writeUInt32LE(n); parts.push(b); };
    const u64 = n => { const b = Buffer.alloc(8); b.writeBigUInt64LE(BigInt(n)); parts.push(b); };
    const str = s => { const b = Buffer.from(s, 'utf8'); u64(b.length); parts.push(b); };
    parts.push(Buffer.from('GGUF')); u32(3); u64(0); u64(kv.length);
    kv.forEach(([k, t, v]) => {
      str(k); u32(t);
      if (t === 8) str(v); else if (t === 4) u32(v);
      else if (t === 9) { u32(8); u64(v.length); v.forEach(str); }
    });
    return Buffer.concat(parts);
  }
  const head = F.parseGguf(gguf([['general.architecture', 8, 'qwen2'], ['general.name', 8, 'Qwen2.5 0.5B Instruct'], ['general.tags', 9, ['a', 'b']], ['qwen2.context_length', 4, 32768], ['tokenizer.ggml.model', 8, 'gpt2']]));
  eq('finder: a GGUF header gives the architecture', head && head.arch, 'qwen2');
  eq('finder: a GGUF header gives the context length', head && head.ctx, 32768);
  eq('finder: a GGUF header gives the model name past an array', head && head.name, 'Qwen2.5 0.5B Instruct');
  eq('finder: a file that is not GGUF has no header', F.parseGguf(Buffer.from('not a model at all, just words')), null);

  /* kinds */
  eq('finder: a qwen2 GGUF is a language model', F.kindOf({ arch: 'qwen2', file: 'x.gguf' }), 'llm');
  eq('finder: nomic-bert is an embedding model', F.kindOf({ arch: 'nomic-bert', file: 'nomic-embed-text-v1.5.Q4_K_M.gguf' }), 'embedding');
  eq('finder: whisper.cpp ggml files are speech', F.kindOf({ file: 'C:\\models\\ggml-base.en.bin' }), 'speech');
  eq('finder: piper voices are speech', F.kindOf({ file: 'C:\\piper\\voices\\en_US-lessac-medium.onnx' }), 'speech');
  eq('finder: an SDXL file is an image generator', F.kindOf({ file: 'C:\\sd\\sd_xl_turbo_1.0_q8_0.gguf' }), 'diffusion');
  eq('finder: a T5 text encoder is an encoder', F.kindOf({ arch: 't5encoder', file: 't5-v1_1-xxl-encoder-Q4_K_M.gguf' }), 'encoder');
  eq('finder: a reranker is a reranker', F.kindOf({ file: 'bge-reranker-v2-m3.gguf' }), 'reranker');
  eq('finder: an mmproj file is an adapter', F.kindOf({ file: 'mmproj-model-f16.gguf', arch: 'clip' }), 'adapter');
  eq('finder: MusicGen is a music generator', F.kindOf({ file: 'C:\\x\\musicgen-small', arch: 'musicgen' }), 'audio');
  eq('finder: "embedded" in a path is not an embedding model', F.kindOf({ file: 'C:\\zoom\\embedded_asr_model\\encode.onnx' }), 'speech');
  eq('finder: LM Studio files are labelled LM Studio', F.sourceOf('C:\\Users\\me\\.lmstudio\\models\\a\\b.gguf'), 'LM Studio');
  eq('finder: Hugging Face cache files are labelled', F.sourceOf('C:\\Users\\me\\.cache\\huggingface\\hub\\models--a--b\\snapshots\\x\\m.safetensors'), 'Hugging Face cache');

  /* a walk over a made-up folder tree */
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mfind-'));
  try {
    const mk = (rel, data) => { const p = path.join(tmp, rel); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, data); return p; };
    mk('lmstudio/models/qwen/qwen2.5-0.5b-instruct-q4_k_m.gguf', gguf([['general.architecture', 8, 'qwen2'], ['qwen2.context_length', 4, 32768]]));
    mk('lmstudio/models/nomic/nomic-embed-text-v1.5.Q4_K_M.gguf', gguf([['general.architecture', 8, 'nomic-bert']]));
    mk('voices/en_US-lessac-medium.onnx', Buffer.alloc(64));
    mk('hf/models--Qwen--Qwen2.5-0.5B/snapshots/abc/config.json', JSON.stringify({ architectures: ['Qwen2ForCausalLM'], model_type: 'qwen2', max_position_embeddings: 32768 }));
    mk('hf/models--Qwen--Qwen2.5-0.5B/snapshots/abc/model.safetensors', Buffer.alloc(64));
    mk('sd/model_index.json', '{}'); mk('sd/unet/diffusion_pytorch_model.safetensors', Buffer.alloc(64));
    mk('node_modules/skip/should-not-be-found.gguf', gguf([['general.architecture', 8, 'llama']]));
    mk('game/data.bin', Buffer.alloc(64));
    mk('split/big-00002-of-00003.gguf', gguf([['general.architecture', 8, 'llama']]));
    const r = F.walk({ roots: [{ dir: tmp, depth: 8 }], minBytes: 0, budgetMs: 10000 });
    const byName = n => r.models.find(m => m.name === n);
    const qwen = byName('qwen2.5-0.5b-instruct-q4_k_m');
    ok('finder: a GGUF in a folder is found as a language model Ollama can import', !!qwen && qwen.kind === 'llm' && qwen.ollama && qwen.ctx === 32768, JSON.stringify(qwen));
    const emb = byName('nomic-embed-text-v1.5.Q4_K_M');
    ok('finder: a GGUF embedder is found and importable', !!emb && emb.kind === 'embedding' && emb.ollama);
    const voice = byName('en_US-lessac-medium');
    ok('finder: an ONNX voice is found as speech and not importable', !!voice && voice.kind === 'speech' && !voice.ollama);
    const hfm = byName('Qwen/Qwen2.5-0.5B');
    ok('finder: a Hugging Face snapshot folder is one language model named after its repo', !!hfm && hfm.kind === 'llm' && hfm.format === 'safetensors' && hfm.ollama, JSON.stringify(r.models.map(m => m.name)));
    ok('finder: a Diffusers folder is one image generator', r.models.some(m => m.format === 'diffusers' && m.kind === 'diffusion'));
    ok('finder: node_modules is skipped', !r.models.some(m => /should-not-be-found/.test(m.path)));
    ok('finder: an ordinary .bin data file is not a model', !r.models.some(m => /data\.bin$/.test(m.path)));
    ok('finder: later parts of a split GGUF are not listed alone', !r.models.some(m => /00002-of/.test(m.path)));
    ok('finder: language models come first', r.models[0].kind === 'llm');
    eq('finder: an Ollama name is made safe and unique', F.ollamaName({ name: 'Qwen/Qwen2.5 0.5B.gguf' }, ['qwen2.5-0.5b']), 'qwen2.5-0.5b-2');

    /* /find helpers */
    mk('proj/src/app.js', 'function saveSettings(s) {\n  fs.writeFileSync("settings.json", JSON.stringify(s));\n}\n'.repeat(3));
    mk('proj/node_modules/x/index.js', 'module.exports = 1;');
    mk('proj/logo.png', Buffer.alloc(32));
    const list = CF.files(path.join(tmp, 'proj'));
    ok('find: only the project text files are read', list.length === 1 && /app\.js$/.test(list[0].file), JSON.stringify(list.map(f => f.file)));
    ok('find: a file is cut into pieces with line numbers', CF.pieces(list[0].file).every(p => p.line >= 1 && p.text.length > 20));
    ok('find: cosine of a vector with itself is 1', Math.abs(CF.cosine([1, 2, 3], [1, 2, 3]) - 1) < 1e-9);
    const none = await CF.search(path.join(tmp, 'proj'), 'settings', '', null);
    ok('find: without an embedding model it says so', !none.ok && /embedding model/.test(none.error));
  } finally { try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (e) { } }

  /* every model gets a use (lib/model-uses.js) */
  const U = require(path.join(__dirname, '..', 'lib', 'model-uses.js'));
  eq('uses: an Ollama chat model talks', U.ollamaUse({ name: 'qwen3:4b', capabilities: ['completion', 'tools'] }), 'talk');
  eq('uses: an Ollama embedding model searches', U.ollamaUse({ name: 'nomic', capabilities: ['embedding'] }), 'find');
  eq('uses: a GGUF language model is imported', U.fileUse({ kind: 'llm', ollama: true, format: 'gguf', path: 'C:\\m\\a.gguf' }).use, 'import');
  eq('uses: a GGUF embedder is imported', U.fileUse({ kind: 'embedding', ollama: true, format: 'gguf', path: 'C:\\m\\e.gguf' }).use, 'import');
  ok('uses: a language model Ollama cannot read says why', (() => { const r = U.fileUse({ kind: 'llm', ollama: false, format: 'safetensors', path: 'C:\\m\\gpt2' }); return r.use === 'info' && /Ollama cannot import/.test(r.note); })());
  eq('uses: a Diffusers folder is described', U.fileUse({ kind: 'diffusion', format: 'diffusers', path: 'C:\\sd\\pipe' }).use, 'info');
  eq('uses: an image decoder is described as part of a picture model', U.fileUse({ kind: 'diffusion', format: 'safetensors', path: 'C:\\x\\ae.safetensors' }).use, 'info');
  eq('uses: an adapter is described', U.fileUse({ kind: 'adapter', format: 'gguf', path: 'C:\\x\\mmproj.gguf' }).use, 'info');
  ok('uses: every use has a label', ['talk', 'find', 'import', 'picture', 'video', 'speak', 'listen', 'music', 'info'].every(k => U.USE_LABEL[k]));
  eq('uses: a made-file id must be 12 hex characters', U.madeFile('../../etc/passwd'), null);
  {
    const engines = require(path.join(__dirname, '..', 'lib', 'model-uses.js'));
    const appRoot = path.join(__dirname, '..');
    const sd = fs.existsSync(path.join(appRoot, 'imggen', 'bin', 'sd-cli.exe'));
    if (sd) eq('uses: a single-file SDXL model makes pictures', engines.fileUse({ kind: 'diffusion', format: 'gguf', path: 'C:\\x\\sd_xl_turbo_1.0_q8_0.gguf' }).use, 'picture');
    const piperVoice = path.join(appRoot, 'piper', 'voices', 'en_US-lessac-medium.onnx');
    if (fs.existsSync(piperVoice + '.json')) eq('uses: a Piper voice with its .json speaks', engines.fileUse({ kind: 'speech', format: 'onnx', path: piperVoice }).use, 'speak');
    eq('uses: a voice without its .json is only described', engines.fileUse({ kind: 'speech', format: 'onnx', path: 'C:\\nowhere\\en_US-x-medium.onnx' }).use, 'info');
  }

  /* an embedding model is never the one that talks */
  const pick = agent.resolveNative({ model: '' }, [{ name: 'nomic-embed-text', size: 3e8, embedding: true }, { name: 'gemma3:1b', size: 8e8 }]);
  eq('agent: an embedding model is never the fallback to talk to', pick.model, 'gemma3:1b');
};

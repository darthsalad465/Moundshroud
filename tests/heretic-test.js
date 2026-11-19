// Heretic (Studio > Heretic): argument building, preset loading, progress parsing, and route/UI wiring.
const fs = require('fs'), path = require('path');

module.exports = async ok => {
  const eq = (name, got, want) => ok(name, got === want, 'got ' + JSON.stringify(got) + ', wanted ' + JSON.stringify(want));
  const H = require(path.join(__dirname, '..', 'lib', 'heretic.js'));

  const st = H.status();
  ok('heretic: status reports presets and suggested models', Array.isArray(st.presets) && st.presets.length >= 8 && Array.isArray(st.suggestedModels) && st.suggestedModels.length >= 4);

  /* buildArgs validation and flags */
  const bad1 = H.buildArgs({ mode: 'modify', model: '' }, 'C:\\tmp\\j1');
  ok('heretic: refuses empty model in modify mode', !bad1.ok && !!bad1.error);
  const bad2 = H.buildArgs({ mode: 'modify', model: 'bad\nmodel' }, 'C:\\tmp\\j1');
  ok('heretic: refuses newline injection in model name', !bad2.ok);

  const mod = H.buildArgs({ mode: 'modify', model: 'Qwen/Qwen3-4B-Instruct-2507', quantization: 'bnb_4bit', nTrials: 40, nStartupTrials: 12, exportStrategy: 'merge', seed: '42' }, 'C:\\tmp\\j1');
  ok('heretic: modify args include non-interactive save flags', mod.ok && mod.args.includes('--model') && mod.args.includes('Qwen/Qwen3-4B-Instruct-2507') && mod.args.includes('--model-action') && mod.args.includes('save') && mod.args.includes('--trial-index') && mod.args.includes('--export-strategy') && mod.args.includes('merge') && mod.args.includes('--seed') && mod.args.includes('42'), JSON.stringify(mod.args));

  const rep = H.buildArgs({ mode: 'reproduce', reproduce: 'https://example.com/reproduce.json', exportStrategy: 'adapter' }, 'C:\\tmp\\j2');
  ok('heretic: reproduce args include --reproduce and --ignore-mismatches', rep.ok && rep.args.includes('--reproduce') && rep.args.includes('--ignore-mismatches') && rep.args.includes('adapter'), JSON.stringify(rep.args));

  const ev = H.buildArgs({ mode: 'evaluate', model: 'Qwen/Qwen2.5-1.5B-Instruct', evaluateModel: 'C:\\models\\mod' }, 'C:\\tmp\\j3');
  ok('heretic: evaluate args include --evaluate-model', ev.ok && ev.args.includes('--evaluate-model') && ev.args.includes('C:\\models\\mod'), JSON.stringify(ev.args));

  /* progress parser */
  const p = H.parseProgress('Preparing local model gemma4:e4b...\nLoading model...\nRunning trial 1 of 50...\nRunning trial 25 of 50...\n', 50);
  eq('heretic: progress parses trial number', p.trial, 25);
  eq('heretic: progress computes percent', p.pct, 50);
  const pUnpack = H.parseProgress('Unpacking model weights from local GGUF (offline)...\n', 50);
  ok('heretic: progress recognizes GGUF unpack phase', /Unpacking/i.test(pUnpack.phase));

  /* Ollama -> HF repo fallback mapping */
  eq('heretic: maps Qwen3.5:4b to Qwen/Qwen3.5-4B', H.guessHfRepo('Qwen3.5:4b'), 'Qwen/Qwen3.5-4B');
  eq('heretic: maps gemma4:e4b to google/gemma-4-E4B-it', H.guessHfRepo('gemma4:e4b'), 'google/gemma-4-E4B-it');
  eq('heretic: maps gemma3:270m to google/gemma-3-270m-it', H.guessHfRepo('gemma3:270m'), 'google/gemma-3-270m-it');
  eq('heretic: maps smollm2-135m to HuggingFaceTB/SmolLM2-135M-Instruct', H.guessHfRepo('smollm2-135m-instruct-iq3-xs'), 'HuggingFaceTB/SmolLM2-135M-Instruct');

  /* downloadedModels discovery and size sorting */
  const crypto = require('crypto'), os = require('os');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'heretic-dl-'));
  try {
    const oDir = path.join(tmp, 'ollama'), bDir = path.join(oDir, 'blobs');
    const lmDir = path.join(tmp, 'lmstudio', 'models'), hfDir = path.join(tmp, 'hf'), dataDir = path.join(tmp, 'data');
    fs.mkdirSync(bDir, { recursive: true }); fs.mkdirSync(lmDir, { recursive: true }); fs.mkdirSync(hfDir, { recursive: true }); fs.mkdirSync(dataDir, { recursive: true });
    const mkBlob = buf => { const h = crypto.createHash('sha256').update(buf).digest('hex'); fs.writeFileSync(path.join(bDir, 'sha256-' + h), buf); return 'sha256:' + h; };
    const bigB = mkBlob(Buffer.concat([Buffer.from('GGUF'), Buffer.alloc(5000)]));
    const smallB = mkBlob(Buffer.concat([Buffer.from('GGUF'), Buffer.alloc(500)]));
    const mkM = (ns, m, t, d) => { const f = path.join(oDir, 'manifests', 'registry.ollama.ai', ns, m, t); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, JSON.stringify({ layers: [{ mediaType: 'application/vnd.ollama.image.model', digest: d }] })); };
    mkM('library', 'gemma3', '270m', smallB);
    mkM('library', 'gemma4', '12b', bigB);
    mkM('library', 'gemma4-12b-agent', 'latest', bigB);
    mkM('library', 'nomic-embed-text', 'latest', smallB);
    fs.mkdirSync(path.join(lmDir, 'community', 'custom'), { recursive: true });
    fs.writeFileSync(path.join(lmDir, 'community', 'custom', 'my-custom.gguf'), Buffer.concat([Buffer.from('GGUF'), Buffer.alloc(2000)]));
    const snap = path.join(hfDir, 'models--Qwen--Qwen2.5-0.5B-Instruct', 'snapshots', 'abc123');
    fs.mkdirSync(snap, { recursive: true });
    fs.writeFileSync(path.join(snap, 'config.json'), '{}');
    fs.writeFileSync(path.join(snap, 'model.safetensors'), Buffer.alloc(1000));
    const found = H.downloadedModels({ ollamaDir: oDir, lmModelsDir: lmDir, hfHubDir: hfDir, dataDir });
    eq('heretic: downloadedModels discovers Ollama + LM Studio + HF cache sorted largest first (skipping agent/embed)',
      found.map(m => m.name).join(','), 'gemma4:12b,my-custom,Qwen/Qwen2.5-0.5B-Instruct,gemma3:270m');
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }

  /* preset TOML loading when repo is cloned */
  if (st.repoPresent) {
    ok('heretic: reads real config.default.toml', /modified_model_type/.test(H.presetToml('default')));
    ok('heretic: reads real config.noslop.toml', /slop-reduced/.test(H.presetToml('noslop')));
  }

  /* UI & HTML wiring */
  const root = path.join(__dirname, '..');
  const html = fs.readFileSync(path.join(root, 'web', 'index.html'), 'utf8');
  const ui = fs.readFileSync(path.join(root, 'web', 'js', 'heretic.js'), 'utf8');
  const srv = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
  ok('heretic: web/index.html loads /web/js/heretic.js', html.includes('/web/js/heretic.js'));
  ok('heretic: UI registers in Studio with A.studio.reg and includes downloaded model dropdown', ui.includes("A.studio.reg('heretic'") && ui.includes('id="hrlocal"'));
  ok('heretic: server wires /api/heretic/status, /api/heretic/models, and /api/heretic/start', srv.includes('/api/heretic/status') && srv.includes('/api/heretic/models') && srv.includes('/api/heretic/start'));
};

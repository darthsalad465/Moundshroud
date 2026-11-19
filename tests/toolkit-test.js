// Local AI & Media Toolkit tests: verifies all 7 lightweight open-source repos
// (markitdown, mergekit, lm-evaluation-harness, autoresearch, rembg, Real-ESRGAN, demucs)
// are wired cleanly into Moundshroud without breaking existing modules.
const cp = require('child_process'), fs = require('fs'), os = require('os'), path = require('path');

module.exports = async ok => {
  const ROOT = path.join(__dirname, '..');
  const tk = require(path.join(ROOT, 'lib', 'toolkit.js'));
  const rd = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

  /* ---- 1. Leading appmap comments & JS wiring ---- */
  const newFiles = ['lib/toolkit.js', 'web/js/markitdown.js', 'web/js/studio-medialab.js', 'web/js/studio-photoshop.js', 'web/js/studio-modelsuite.js'];
  ok('toolkit: every new JS file begins with a // appmap comment', newFiles.every(f => rd(f).trimStart().startsWith('//')));

  const srv = rd('server.js'), html = rd('web/index.html'), lazy = rd('web/js/lazy.js'), toolsJs = rd('web/js/tools.js');
  ok('toolkit: server.js wires /api/toolkit routes and stops jobs on shutdown',
    /require\('\.\/lib\/toolkit'\)/.test(srv) && /toolkit\.stopAll\(\)/.test(srv)
    && /\/api\/toolkit\/status/.test(srv) && /\/api\/toolkit\/markitdown/.test(srv)
    && /\/api\/toolkit\/rembg/.test(srv) && /\/api\/toolkit\/upscale/.test(srv) && /\/api\/toolkit\/inpaint/.test(srv)
    && /\/minipaint\//.test(srv)
    && /\/api\/toolkit\/demucs/.test(srv) && /\/api\/toolkit\/merge\/start/.test(srv)
    && /\/api\/toolkit\/lmeval\/start/.test(srv) && /\/api\/toolkit\/autoresearch\/run/.test(srv));

  const mutating = ['/api/toolkit/setup', '/api/toolkit/setup/stop', '/api/toolkit/stop', '/api/toolkit/delete',
    '/api/toolkit/markitdown', '/api/toolkit/rembg', '/api/toolkit/upscale', '/api/toolkit/inpaint', '/api/toolkit/demucs',
    '/api/toolkit/merge/yaml', '/api/toolkit/merge/start', '/api/toolkit/merge/import',
    '/api/toolkit/lmeval/start', '/api/toolkit/autoresearch/save', '/api/toolkit/autoresearch/reset', '/api/toolkit/autoresearch/run'];
  ok('toolkit: all mutating /api/toolkit routes require POST',
    mutating.every(u => srv.includes("url === '" + u + "' && req.method === 'POST'")),
    mutating.filter(u => !srv.includes("url === '" + u + "' && req.method === 'POST'")).join(', '));

  ok('toolkit: index.html, lazy.js and tools.js wire MarkItDown, Media Lab, Photo Editor and Model Suite',
    html.includes('/web/js/markitdown.js') && html.includes('/web/js/studio-medialab.js') && html.includes('/web/js/studio-photoshop.js') && html.includes('/web/js/studio-modelsuite.js')
    && lazy.includes('/web/js/markitdown.js') && lazy.includes('/web/js/studio-medialab.js') && lazy.includes('/web/js/studio-photoshop.js') && lazy.includes('/web/js/studio-modelsuite.js')
    && toolsJs.includes("['md', '📝 MarkItDown']") && /A\.markitdown\.render/.test(toolsJs));

  /* ---- 2. Status, catalog & security ---- */
  const tmpJobs = fs.mkdtempSync(path.join(os.tmpdir(), 'ms-tk-test-'));
  const origStatus = tk.status();
  ok('toolkit: catalog exposes all 5 option sets',
    origStatus.catalog.rembgModels.length >= 4 && origStatus.catalog.esrganModels.length >= 3
    && origStatus.catalog.demucsModels.length >= 3 && origStatus.catalog.mergeMethods.length >= 4
    && origStatus.catalog.lmevalTasks.length >= 8);

  tk._setJobsDir(tmpJobs);
  try {
    ok('toolkit: resolveOutputFile blocks path traversal and invalid ids',
      tk.resolveOutputFile('../data', 'server.js') === '' && tk.resolveOutputFile('bad id!', 'a.png') === ''
      && tk.resolveOutputFile('job_123', '../secret.txt') === '');

    /* ---- 3. Mergekit YAML builder ---- */
    const yBad = tk.buildMergeYaml({ method: 'slerp', models: [{ model: 'only-one' }] });
    ok('toolkit: Mergekit refuses fewer than 2 models', !yBad.ok && /2 models/.test(yBad.error));
    const ySlerp = tk.buildMergeYaml({ method: 'slerp', dtype: 'bfloat16', t: 0.4, baseModel: 'Qwen/A', models: [{ model: 'Qwen/A' }, { model: 'Qwen/B' }] });
    ok('toolkit: Mergekit builds valid SLERP YAML', ySlerp.ok && /merge_method: slerp/.test(ySlerp.yaml) && /t: 0\.4/.test(ySlerp.yaml));
    const yTies = tk.buildMergeYaml({ method: 'dare_ties', dtype: 'float16', density: 0.6, baseModel: 'Qwen/Base', models: [{ model: 'Qwen/A', weight: 0.5 }, { model: 'Qwen/B', weight: 0.5 }] });
    ok('toolkit: Mergekit builds valid DARE-TIES YAML', yTies.ok && /merge_method: dare_ties/.test(yTies.yaml) && /density: 0\.6/.test(yTies.yaml) && /base_model: "Qwen\/Base"/.test(yTies.yaml));

    /* ---- 4. Python scripts compile cleanly ---- */
    const py = path.join(ROOT, 'runtime', 'ftenv', 'Scripts', 'python.exe');
    const scripts = ['run_markitdown.py', 'run_rembg.py', 'run_realesrgan.py', 'run_inpaint.py', 'run_demucs.py', 'run_mergekit.py', 'run_lmeval.py', 'run_autoresearch.py'];
    ok('toolkit: all 8 Python runner scripts exist', scripts.every(s => fs.existsSync(path.join(ROOT, 'scripts', 'toolkit', s))));
    if (fs.existsSync(py)) {
      const comp = cp.spawnSync(py, ['-m', 'py_compile', ...scripts.map(s => path.join(ROOT, 'scripts', 'toolkit', s))], { encoding: 'utf8', windowsHide: true });
      ok('toolkit: all 8 Python runner scripts pass py_compile', comp.status === 0, comp.stderr);
    }

    /* ---- 5. Live environment & end-to-end checks when installed ---- */
    if (origStatus.ready && fs.existsSync(py)) {
      ok('toolkit: all 7 tool flags report installed',
        Object.values(origStatus.tools).every(Boolean), JSON.stringify(origStatus.tools));

      /* Real end-to-end MarkItDown conversion */
      const htmlSample = Buffer.from('<html><head><title>Moundshroud Test</title></head><body><h1>Hello Toolkit</h1><p>Offline <b>Markdown</b> works!</p><ul><li>Item 1</li><li>Item 2</li></ul></body></html>').toString('base64');
      const mdRes = await tk.convertMarkdown({ filename: 'sample.html', dataBase64: htmlSample });
      ok('toolkit: MarkItDown converts HTML to clean Markdown live',
        mdRes.ok && /Hello Toolkit/.test(mdRes.markdown) && /Markdown/.test(mdRes.markdown) && /Item 1/.test(mdRes.markdown),
        JSON.stringify(mdRes).slice(0, 200));

      /* Fast Python check: all 7 packages are importable & generated YAML parses cleanly */
      const pyCheck = cp.spawnSync(py, ['-c', 'import importlib.util, sys, yaml; mods=["markitdown","mergekit","lm_eval","rembg","demucs","tiktoken","PIL","soundfile"]; miss=[m for m in mods if importlib.util.find_spec(m) is None]; cfg=yaml.safe_load(sys.stdin.read()); print("OK" if (not miss and cfg.get("merge_method")=="dare_ties" and len(cfg.get("models",[]))==2) else "BAD:"+str(miss))'], { input: yTies.yaml, encoding: 'utf8', windowsHide: true });
      ok('toolkit: all Python packages resolve and Mergekit YAML parses cleanly', pyCheck.status === 0 && pyCheck.stdout.trim() === 'OK', (pyCheck.stdout + pyCheck.stderr).trim());

      /* Real Autoresearch repo files */
      const ar = tk.autoresearchInfo();
      ok('toolkit: Autoresearch repo exposes program.md and train.py',
        ar.installed && /val_bpb/.test(ar.programMd) && ar.trainPy.length > 500);
    }
  } finally {
    tk._setJobsDir(path.join(ROOT, 'data', 'toolkit'));
    try { fs.rmSync(tmpJobs, { recursive: true, force: true }); } catch (e) { }
  }
};

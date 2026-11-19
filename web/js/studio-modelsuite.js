// Studio > Model Suite: 3 lightweight open-source AI model engineering & research tools in one organized hub:
//   - Mergekit            (https://github.com/arcee-ai/mergekit)
//   - LM Eval Harness     (https://github.com/EleutherAI/lm-evaluation-harness)
//   - Karpathy Autoresearch (https://github.com/karpathy/autoresearch)
(() => {
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  function render(b) {
    let tab = 'lmeval', st = null, timer = null, watchId = '', ollamaList = [], arLoaded = false;

    b.innerHTML = '<div class="scroll pad" style="flex:1"><div style="max-width:1040px">' +
      '<div class="row" style="align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:10px">' +
        '<h2 style="margin:0">🧬 Model Suite</h2>' +
        '<div class="row" id="msTabs" style="gap:6px;flex-wrap:wrap">' +
          '<button class="ib on" data-t="lmeval">📊 Eval Harness</button>' +
          '<button class="ib" data-t="mergekit">🔀 Mergekit</button>' +
          '<button class="ib" data-t="autoresearch">🔬 Autoresearch</button>' +
        '</div>' +
        '<span class="sp"></span>' +
        '<button class="ib" id="msTutBtn" title="Interactive step-by-step guide for Eval, Mergekit & Autoresearch">🎓 Guide</button>' +
        '<button class="ib" id="msSetupBtn" style="display:none">⚙ Install / Verify</button>' +
        '<button class="ib dang" id="msStopBtn" style="display:none">■ Stop job</button>' +
      '</div>' +
      '<div id="msBanner"></div>' +

      /* ---- 1. EleutherAI lm-evaluation-harness ---- */
      '<div id="ms-lmeval" class="card">' +
        '<b>📊 LM Evaluation Harness <span class="small mute">(EleutherAI/lm-evaluation-harness)</span></b>' +
        '<div class="small mute" style="margin:4px 0 10px">Benchmark your local Ollama models (including Heretic &amp; merged models) or local Hugging Face checkpoints on standard tasks.</div>' +
        '<div class="row" style="gap:10px;flex-wrap:wrap;align-items:flex-end">' +
          '<label class="small">Backend<br><select id="evBack"><option value="ollama">Local Ollama model</option><option value="hf">Hugging Face folder / ID</option></select></label>' +
          '<label class="small" id="evOllWrap" style="flex:1;min-width:220px">Ollama model<br><select id="evOll" style="width:100%"></select></label>' +
          '<label class="small" id="evHfWrap" style="flex:1;min-width:220px;display:none">HF model path or repo<br><input id="evHf" placeholder="C:\\path\\to\\model or Qwen/Qwen2.5-1.5B-Instruct" style="width:100%"></label>' +
          '<label class="small">Samples/task<br><input id="evLim" type="number" min="0" max="5000" value="25" style="width:92px" title="25 is a quick ~1 min check; 0 runs the full dataset"></label>' +
          '<label class="small">Few-shot<br><input id="evFew" type="number" min="0" max="10" value="0" style="width:72px"></label>' +
        '</div>' +
        '<div class="small" style="font-weight:600;margin:10px 0 6px">Benchmark tasks</div>' +
        '<div id="evTasks" class="row" style="gap:8px;flex-wrap:wrap"></div>' +
        '<div class="row" style="gap:8px;margin-top:12px"><button class="pri" id="evGo">▶ Run Evaluation</button><span class="small mute">Tip: 25 samples gives a fast sanity check; increase to 200+ for tighter accuracy.</span></div>' +
      '</div>' +

      /* ---- 2. arcee-ai/mergekit ---- */
      '<div id="ms-mergekit" class="card" style="display:none">' +
        '<b>🔀 Mergekit <span class="small mute">(arcee-ai/mergekit)</span></b>' +
        '<div class="small mute" style="margin:4px 0 10px">Blend two or more same-architecture Hugging Face models locally without training, then import the result straight into Ollama &amp; LM Studio.</div>' +
        '<div class="row" style="gap:10px;flex-wrap:wrap">' +
          '<label class="small">Output name<br><input id="mgName" value="my-merged-model" style="width:200px"></label>' +
          '<label class="small">Merge method<br><select id="mgMethod"></select></label>' +
          '<label class="small">Precision<br><select id="mgDtype"><option value="bfloat16">bfloat16</option><option value="float16">float16</option><option value="float32">float32</option></select></label>' +
          '<label class="small" id="mgTWrap">Blend t (0–1)<br><input id="mgT" type="number" min="0" max="1" step="0.05" value="0.5" style="width:84px"></label>' +
          '<label class="small" id="mgDensWrap" style="display:none">Density<br><input id="mgDens" type="number" min="0.05" max="1" step="0.05" value="0.5" style="width:84px"></label>' +
        '</div>' +
        '<div class="row" style="gap:10px;margin-top:8px;flex-wrap:wrap">' +
          '<label class="small" style="flex:1;min-width:220px">Model A (HF repo ID or local HF folder)<br><input id="mgA" list="mgLocalList" placeholder="e.g. Qwen/Qwen2.5-1.5B-Instruct" style="width:100%"></label>' +
          '<label class="small" style="flex:1;min-width:220px">Model B (same architecture)<br><input id="mgB" list="mgLocalList" placeholder="e.g. Qwen/Qwen2.5-Coder-1.5B-Instruct" style="width:100%"></label>' +
          '<label class="small" style="flex:1;min-width:220px">Base model (for SLERP / TIES / DARE)<br><input id="mgBase" list="mgLocalList" placeholder="Leave blank to use Model A" style="width:100%"></label>' +
          '<datalist id="mgLocalList"></datalist>' +
        '</div>' +
        '<div class="row" style="gap:8px;margin-top:10px;align-items:center;flex-wrap:wrap">' +
          '<button class="ib" id="mgBuildYaml">Generate YAML</button>' +
          '<label class="chk small"><input type="checkbox" id="mgCuda" checked> Use CUDA GPU</label>' +
          '<label class="chk small"><input type="checkbox" id="mgLazy" checked> Lazy unpickle (low RAM)</label>' +
          '<span class="sp"></span>' +
          '<button class="pri" id="mgGo">🔀 Run Mergekit</button>' +
        '</div>' +
        '<textarea id="mgYaml" rows="9" placeholder="Click Generate YAML above, or paste any Mergekit YAML config here…" style="width:100%;margin-top:8px;font-family:Consolas,monospace;font-size:12px"></textarea>' +
      '</div>' +

      /* ---- 3. karpathy/autoresearch ---- */
      '<div id="ms-autoresearch" class="card" style="display:none">' +
        '<b>🔬 Autoresearch <span class="small mute">(karpathy/autoresearch)</span></b>' +
        '<div class="small mute" style="margin:4px 0 10px">Autonomous single-GPU ML research loop: prepare data shards once, establish a baseline, then let a local Ollama model iteratively edit <code>train.py</code>, test <code>val_bpb</code>, and keep improvements or revert regressions.</div>' +
        '<div class="row" style="gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:10px">' +
          '<span class="small" id="arPrepStat">Checking data shards…</span>' +
          '<label class="small">Shards <input id="arShards" type="number" min="1" max="32" value="4" style="width:64px"></label>' +
          '<button class="ib" id="arPrepBtn">⬇ Prepare data &amp; tokenizer</button>' +
          '<span class="sp"></span>' +
          '<button class="ib" id="arResetBtn">↺ Reset train.py</button>' +
          '<button class="ib" id="arSaveBtn">💾 Save edits</button>' +
        '</div>' +
        '<div class="row" style="gap:10px;flex-wrap:wrap;margin-bottom:10px;align-items:flex-end">' +
          '<button class="ib" id="arRunBtn">▶ Run 1 baseline/test (train.py)</button>' +
          '<label class="small" style="flex:1;min-width:200px">Autonomous researcher model (Ollama)<br><select id="arModel" style="width:100%"></select></label>' +
          '<label class="small">Rounds<br><input id="arRounds" type="number" min="1" max="50" value="3" style="width:72px"></label>' +
          '<button class="pri" id="arLoopBtn">🤖 Start Autonomous Loop</button>' +
        '</div>' +
        '<details style="margin-top:6px"><summary class="small" style="cursor:pointer;font-weight:600">Edit program.md (research instructions)</summary>' +
          '<textarea id="arProg" rows="8" style="width:100%;margin-top:6px;font-family:Consolas,monospace;font-size:12px"></textarea>' +
        '</details>' +
        '<details style="margin-top:6px"><summary class="small" style="cursor:pointer;font-weight:600">Edit train.py (experiment script)</summary>' +
          '<textarea id="arTrain" rows="12" style="width:100%;margin-top:6px;font-family:Consolas,monospace;font-size:12px"></textarea>' +
        '</details>' +
        '<div id="arLedger" style="margin-top:10px"></div>' +
      '</div>' +

      '<div id="msActive" style="margin-top:12px"></div>' +
      '<div id="msResults" style="margin-top:12px"></div>' +
    '</div></div>';

    const $ = id => b.querySelector('#' + id);

    function switchTab(t) {
      tab = t;
      ['lmeval', 'mergekit', 'autoresearch'].forEach(k => {
        $('ms-' + k).style.display = k === tab ? '' : 'none';
      });
      $('msTabs').querySelectorAll('[data-t]').forEach(x => x.classList.toggle('on', x.dataset.t === tab));
      drawResults();
    }

    async function loadOllamaModels() {
      const r = await A.api('/api/models').catch(() => null);
      const raw = (r && r.models) || [];
      const local = raw.filter(m => m && m.name && !/embed|^nomic/i.test(m.name));
      ollamaList = A.modelOrder ? A.modelOrder.sort(local) : local;
      const html = ollamaList.length
        ? ollamaList.map(m => '<option value="' + esc(m.name) + '">' + esc(A.modelOrder ? A.modelOrder.label(m) : m.name) + '</option>').join('')
        : '<option value="">(No local Ollama models found)</option>';
      for (const id of ['evOll', 'arModel']) {
        const sel = $(id); if (!sel) continue;
        const prev = sel.value;
        sel.innerHTML = html;
        if (prev && ollamaList.some(m => m.name === prev)) sel.value = prev;
      }
    }

    function drawResults() {
      if (!st) return;
      const list = (st.jobs || []).filter(j => j.tool === tab).slice(0, 12);
      if (!list.length) {
        $('msResults').innerHTML = '<div class="small mute">No runs in this tab yet.</div>';
        return;
      }
      $('msResults').innerHTML = list.map(j => {
        const badge = j.status === 'done' ? '✅' : j.status === 'running' ? '⏳' : j.status === 'stopped' ? '⏹' : '⚠️';
        let body = '';
        if (j.tool === 'lmeval' && Array.isArray(j.scores) && j.scores.length) {
          body = '<div style="margin-top:8px;overflow:auto"><table class="small" style="width:100%;border-collapse:collapse">' +
            '<tr style="border-bottom:1px solid var(--line);text-align:left"><th style="padding:4px">Task</th><th style="padding:4px">Metrics</th></tr>' +
            j.scores.map(r => '<tr style="border-bottom:1px solid var(--line)"><td style="padding:4px"><b>' + esc(r.task) + '</b></td><td style="padding:4px">' +
              Object.entries(r.metrics || {}).map(([k, v]) => esc(k) + ': <b>' + (v <= 1 ? (v * 100).toFixed(1) + '%' : v) + '</b>').join(' · ') + '</td></tr>').join('') +
            '</table></div>';
        } else if (j.tool === 'mergekit' && j.status === 'done') {
          const imp = j.importStatus === 'done'
            ? '<span class="small" style="color:var(--ok)">✅ Imported into Ollama &amp; LM Studio as <b>' + esc(j.ollamaName) + '</b></span>'
            : j.importStatus === 'converting'
              ? '<span class="small mute">⏳ Converting to GGUF &amp; importing into Ollama…</span>'
              : '<button class="pri" data-imp="' + esc(j.id) + '" data-name="' + esc(j.name || 'merged-model') + '">📦 Import into Ollama &amp; LM Studio</button>';
          body = '<div class="row" style="gap:8px;margin-top:8px;align-items:center;flex-wrap:wrap">' + imp +
            '<span class="small mute">' + esc(j.outDir || '') + '</span></div>';
        } else if (j.status === 'failed') {
          body = '<div class="small warn" style="margin-top:6px">' + esc(j.error || 'Run failed.') + '</div>';
        }
        return '<div class="card" style="margin-bottom:10px">' +
          '<div class="row" style="gap:8px;align-items:center;flex-wrap:wrap">' +
            '<b>' + badge + ' ' + esc(j.model || j.name || j.action || j.id) + '</b>' +
            '<span class="small mute">' + esc(j.status) + (j.tasks ? ' · ' + esc((j.tasks || []).join(', ')) : '') + (j.method ? ' · ' + esc(j.method) : '') + '</span>' +
            '<span class="sp"></span>' +
            '<button class="ib" data-log="' + esc(j.id) + '">Log</button>' +
            '<button class="ib dang" data-del="' + esc(j.id) + '">✕</button>' +
          '</div>' + body + '</div>';
      }).join('');
    }

    async function poll() {
      const s = await A.api('/api/toolkit/status').catch(() => null);
      if (!s || !b.isConnected) return;
      st = s;
      if (s.catalog) {
        if (!$('mgMethod').options.length) {
          $('mgMethod').innerHTML = (s.catalog.mergeMethods || []).map(m => '<option value="' + esc(m.id) + '">' + esc(m.name) + '</option>').join('');
        }
        if (!$('evTasks').children.length) {
          $('evTasks').innerHTML = (s.catalog.lmevalTasks || []).map((t, i) =>
            '<label class="chk small" style="border:1px solid var(--line);border-radius:999px;padding:3px 10px"><input type="checkbox" value="' + esc(t.id) + '"' + (i < 2 ? ' checked' : '') + '> ' + esc(t.name) + '</label>'
          ).join('');
        }
      }
      const dl = $('mgLocalList');
      if (dl && (s.localModels || []).length) {
        const hfModels = s.localModels.filter(m => m.kind === 'hf-dir' || m.kind === 'hf-cache');
        dl.innerHTML = hfModels.map(m => '<option value="' + esc(m.path || m.hfId || m.name) + '">' + esc(m.name) + '</option>').join('');
      }
      const ar = s.autoresearch || {};
      $('arPrepStat').innerHTML = ar.prepared ? '✅ <b>Data shards &amp; tokenizer ready</b>' : '⚠️ <b>Data not prepared yet</b> (click Prepare once)';
      if (!arLoaded && ar.installed) {
        arLoaded = true;
        $('arProg').value = ar.programMd || '';
        $('arTrain').value = ar.trainPy || '';
      }
      const ledger = ar.results || [];
      $('arLedger').innerHTML = ledger.length ? '<div class="small" style="font-weight:600;margin-bottom:4px">Experiment ledger (results.tsv)</div>' +
        '<div style="max-height:200px;overflow:auto"><table class="small" style="width:100%;border-collapse:collapse">' +
        '<tr style="border-bottom:1px solid var(--line);text-align:left"><th style="padding:3px">Status</th><th style="padding:3px">val_bpb</th><th style="padding:3px">VRAM MB</th><th style="padding:3px">Description</th></tr>' +
        ledger.map(r => '<tr style="border-bottom:1px solid var(--line)"><td style="padding:3px">' + esc(r.status) + '</td><td style="padding:3px"><b>' + esc(r.val_bpb) + '</b></td><td style="padding:3px">' + esc(r.peak_vram_mb) + '</td><td style="padding:3px">' + esc(r.description) + '</td></tr>').join('') +
        '</table></div>' : '';

      const ready = !!s.ready;
      $('msSetupBtn').style.display = ready ? 'none' : '';
      $('msStopBtn').style.display = s.activeJob ? '' : 'none';
      if (!ready || s.setupRunning) {
        $('msBanner').innerHTML = '<div class="card" style="margin-bottom:10px"><b>' + (s.setupRunning ? '⏳ Installing Model Suite packages…' : '⚙️ One-time toolkit setup needed') + '</b>' +
          '<div class="small mute" style="margin-top:4px">Installs Mergekit, lm-eval, and Autoresearch into Moundshroud\'s shared CUDA environment.</div>' +
          (s.setupLog ? '<pre class="small" style="max-height:150px;overflow:auto;margin-top:6px;white-space:pre-wrap">' + esc(s.setupLog) + '</pre>' : '') + '</div>';
      } else {
        $('msBanner').innerHTML = '';
      }
      if (s.activeJob && ['lmeval', 'mergekit', 'autoresearch'].includes(s.activeJob.tool)) {
        watchId = s.activeJob.id;
        $('msActive').innerHTML = '<div class="card"><b>⏳ Running ' + esc(s.activeJob.tool) + '…</b>' +
          '<pre class="small" style="max-height:220px;overflow:auto;margin-top:6px;white-space:pre-wrap">' + esc(s.activeJob.log || 'Starting…') + '</pre></div>';
      } else if (watchId) {
        const done = await A.api('/api/toolkit/job?id=' + encodeURIComponent(watchId)).catch(() => null);
        watchId = '';
        if (done && done.status === 'failed') {
          $('msActive').innerHTML = '<div class="card"><b class="warn">⚠️ ' + esc(done.error || 'Run failed') + '</b>' +
            '<pre class="small" style="max-height:220px;overflow:auto;margin-top:6px;white-space:pre-wrap">' + esc(done.log || '') + '</pre></div>';
        } else {
          $('msActive').innerHTML = '';
        }
      }
      drawResults();
      const busy = !!(s.setupRunning || s.activeJob || s.converting);
      if (busy && !timer) timer = setInterval(poll, 2000);
      if (!busy && timer) { clearInterval(timer); timer = null; }
    }

    $('msTabs').onclick = e => { const x = e.target.closest('[data-t]'); if (x) switchTab(x.dataset.t); };
    $('msTutBtn').onclick = () => A.repoTutorial && A.repoTutorial.open(tab);
    $('msSetupBtn').onclick = async () => { await A.api('/api/toolkit/setup', {}); A.toast('Toolkit setup started'); poll(); };
    $('msStopBtn').onclick = async () => { await A.api('/api/toolkit/stop', {}); A.toast('Stopped'); poll(); };
    $('evBack').onchange = () => {
      const hf = $('evBack').value === 'hf';
      $('evOllWrap').style.display = hf ? 'none' : '';
      $('evHfWrap').style.display = hf ? '' : 'none';
    };
    $('mgMethod').onchange = () => {
      const m = $('mgMethod').value;
      $('mgTWrap').style.display = m === 'slerp' ? '' : 'none';
      $('mgDensWrap').style.display = (m === 'ties' || m === 'dare_ties') ? '' : 'none';
    };

    $('evGo').onclick = async () => {
      const backend = $('evBack').value;
      const model = backend === 'hf' ? $('evHf').value.trim() : $('evOll').value;
      const tasks = [...$('evTasks').querySelectorAll('input:checked')].map(x => x.value);
      if (!model) return A.toast('Pick or enter a model first.');
      if (!tasks.length) return A.toast('Select at least one benchmark task.');
      const r = await A.api('/api/toolkit/lmeval/start', { backend, model, tasks, limit: +$('evLim').value || 0, numFewshot: +$('evFew').value || 0 });
      if (!r.ok) return A.toast(r.error || 'Could not start evaluation.');
      watchId = r.id; poll();
    };

    async function genYaml() {
      const a = $('mgA').value.trim(), b2 = $('mgB').value.trim();
      if (!a || !b2) return A.toast('Enter Model A and Model B first.');
      const r = await A.api('/api/toolkit/merge/yaml', {
        method: $('mgMethod').value,
        dtype: $('mgDtype').value,
        t: +$('mgT').value,
        density: +$('mgDens').value,
        baseModel: $('mgBase').value.trim() || a,
        models: [{ model: a, weight: 0.5 }, { model: b2, weight: 0.5 }],
      });
      if (!r.ok) return A.toast(r.error || 'Could not build YAML.');
      $('mgYaml').value = r.yaml;
      return r.yaml;
    }
    $('mgBuildYaml').onclick = genYaml;
    $('mgGo').onclick = async () => {
      let yaml = $('mgYaml').value.trim();
      if (!yaml) yaml = await genYaml();
      if (!yaml) return;
      const r = await A.api('/api/toolkit/merge/start', {
        name: $('mgName').value.trim() || 'merged-model',
        method: $('mgMethod').value,
        yaml,
        cuda: $('mgCuda').checked,
        lazyUnpickle: $('mgLazy').checked,
      });
      if (!r.ok) return A.toast(r.error || 'Could not start Mergekit.');
      watchId = r.id; poll();
    };

    $('arPrepBtn').onclick = async () => {
      const r = await A.api('/api/toolkit/autoresearch/run', { action: 'prepare', numShards: +$('arShards').value || 4 });
      if (!r.ok) return A.toast(r.error || 'Could not start data prep.');
      watchId = r.id; poll();
    };
    $('arSaveBtn').onclick = async () => {
      const r = await A.api('/api/toolkit/autoresearch/save', { programMd: $('arProg').value, trainPy: $('arTrain').value });
      A.toast(r.ok ? 'Saved program.md & train.py' : (r.error || 'Save failed'));
    };
    $('arResetBtn').onclick = async () => {
      if (!(await A.confirm('Reset train.py back to the original karpathy/autoresearch baseline?'))) return;
      const r = await A.api('/api/toolkit/autoresearch/reset', {});
      if (r.ok) { $('arTrain').value = r.trainPy || ''; A.toast('Reset train.py'); }
      else A.toast(r.error || 'Reset failed');
    };
    $('arRunBtn').onclick = async () => {
      const r = await A.api('/api/toolkit/autoresearch/run', { action: 'run', description: 'manual run' });
      if (!r.ok) return A.toast(r.error || 'Could not start run.');
      watchId = r.id; poll();
    };
    $('arLoopBtn').onclick = async () => {
      const ollamaModel = $('arModel').value;
      if (!ollamaModel) return A.toast('Choose an Ollama model to drive the loop.');
      const r = await A.api('/api/toolkit/autoresearch/run', { action: 'loop', ollamaModel, rounds: +$('arRounds').value || 3 });
      if (!r.ok) return A.toast(r.error || 'Could not start autonomous loop.');
      watchId = r.id; poll();
    };

    $('msResults').onclick = async e => {
      const del = e.target.closest('[data-del]'), imp = e.target.closest('[data-imp]'), lg = e.target.closest('[data-log]');
      if (del) { await A.api('/api/toolkit/delete', { id: del.dataset.del }); poll(); return; }
      if (imp) {
        const name = (await A.prompt('Model name in Ollama & LM Studio:', imp.dataset.name || 'merged-model'));
        if (!name) return;
        const r = await A.api('/api/toolkit/merge/import', { id: imp.dataset.imp, ollamaName: name, quant: 'q8_0' });
        A.toast(r.ok ? 'Converting & importing ' + name + '…' : (r.error || 'Import failed'));
        poll(); return;
      }
      if (lg) {
        const j = await A.api('/api/toolkit/job?id=' + encodeURIComponent(lg.dataset.log)).catch(() => null);
        if (j) $('msActive').innerHTML = '<div class="card"><b>Log · ' + esc(j.id) + '</b><pre class="small" style="max-height:260px;overflow:auto;margin-top:6px;white-space:pre-wrap">' + esc(j.log || '(empty)') + '</pre></div>';
      }
    };

    if (A.on) A.on('default-model', () => { if (b.isConnected) loadOllamaModels(); });
    b._cleanup = () => { if (timer) clearInterval(timer); };
    loadOllamaModels();
    poll();
  }

  A.modelSuite = { render };
  if (A.studio && A.studio.reg) A.studio.reg('modelsuite', '🧬 Model Suite', body => render(body), 31.7);
  if (A.cmd && A.cmd.reg) A.cmd.reg([
    { title: 'Model Suite — Mergekit, LM Eval Harness & Autoresearch', sub: 'Merge models, benchmark local LLMs, or run autonomous GPU research loops', icon: '🧬', group: 'Studio', tags: 'mergekit lm-eval benchmark evaluation autoresearch karpathy model merge', run: () => A.studio && A.studio.go('modelsuite') },
  ]);
})();

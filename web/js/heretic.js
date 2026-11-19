// Studio > Heretic (https://github.com/p-e-w/heretic): pick any downloaded model on this PC (Ollama, LM Studio, or local HF cache)
// or enter any Hugging Face model ID, modify it via directional ablation & Optuna TPE, and automatically add the new Heretic model
// to Moundshroud, Ollama, and LM Studio.
(() => {
  const esc = t => String(t == null ? '' : t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  if (!document.getElementById('hr-css')) {
    const s = document.createElement('style'); s.id = 'hr-css';
    s.textContent = `
.hr{flex:1;min-height:0;overflow:auto;padding:16px}.hr-wrap{max-width:1100px;margin:0 auto}
.hr-hero{padding:18px 20px;border-radius:16px;border:1px solid var(--line);margin-bottom:14px;background:radial-gradient(120% 140% at 0% 0%,color-mix(in srgb,var(--acc,#7c5cff) 24%,transparent),transparent 60%),radial-gradient(120% 140% at 100% 100%,color-mix(in srgb,var(--acc2,#22d3ee) 16%,transparent),transparent 55%),var(--panel)}
.hr-hero h2{margin:0 0 4px;font-size:24px}.hr .mute{color:var(--mute);font-size:12.5px;line-height:1.5}
.hr-grid{display:grid;grid-template-columns:255px 1fr;gap:14px;align-items:start}@media(max-width:860px){.hr-grid{grid-template-columns:1fr}}
.hr-card{border:1px solid var(--line);border-radius:14px;background:var(--panel);padding:14px;margin-bottom:12px}
.hr label{display:block;font-size:12px;color:var(--mute);margin:8px 0 3px;font-weight:600}
.hr label.hr-chk{display:flex;align-items:center;gap:8px;font-size:13px;color:var(--text);font-weight:500;cursor:pointer;margin:10px 0 4px}
.hr label.hr-chk input{width:auto;margin:0}
.hr input,.hr textarea,.hr select{width:100%;box-sizing:border-box;padding:8px 10px;border:1px solid var(--line);border-radius:8px;background:var(--panel2);color:var(--text);font:13px/1.45 inherit}
.hr textarea{font-family:Consolas,"Cascadia Mono",monospace;font-size:12px}
.hr .row2{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}@media(max-width:640px){.hr .row2{grid-template-columns:1fr}}
.hr .row3{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}@media(max-width:640px){.hr .row3{grid-template-columns:1fr}}
.hr .btn{padding:9px 16px;border:0;border-radius:10px;font-weight:700;color:#fff;cursor:pointer;background:linear-gradient(135deg,var(--acc,#7c5cff),var(--acc2,#22d3ee))}.hr .btn:disabled{opacity:.5;cursor:default}
.hr .ib2{padding:6px 11px;border:1px solid var(--line);border-radius:8px;background:var(--panel2);color:var(--text);cursor:pointer;font-size:12.5px}.hr .ib2:hover{border-color:var(--acc)}.hr .ib2.on{border-color:var(--acc);background:color-mix(in srgb,var(--acc,#7c5cff) 16%,var(--panel2));font-weight:600}
.hr .ib2.dang{color:var(--bad,#e5484d)}.hr .ib2:disabled{opacity:.5;cursor:default}
.hr-job{padding:9px 10px;border:1px solid var(--line);border-radius:10px;margin-bottom:6px;cursor:pointer;background:var(--panel2);display:flex;gap:6px;align-items:flex-start}
.hr-job.on{border-color:var(--acc);box-shadow:0 0 0 1px var(--acc) inset}
.hr-chips{display:flex;gap:6px;flex-wrap:wrap;margin-top:6px}
.hr-chip{padding:4px 9px;border-radius:999px;border:1px solid var(--line);background:var(--panel2);color:var(--text);font-size:11.5px;cursor:pointer}.hr-chip:hover{border-color:var(--acc)}
.hr-bar{height:8px;border-radius:6px;background:var(--panel2);overflow:hidden;margin:8px 0}.hr-bar>div{height:100%;background:linear-gradient(90deg,var(--acc,#7c5cff),var(--acc2,#22d3ee));transition:width .4s}
.hr pre{background:#0b0e14;color:#cdd3e0;border-radius:10px;padding:10px 12px;font:12px/1.45 Consolas,"Cascadia Mono",monospace;white-space:pre-wrap;word-break:break-word;max-height:300px;overflow:auto;margin:8px 0 0}
.hr-modes{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px}
.hr-badge{display:inline-block;padding:2px 7px;border-radius:999px;font-size:11px;font-weight:600;border:1px solid var(--line);background:var(--panel2)}
.hr-badge.ok{color:var(--ok,#30a46c);border-color:color-mix(in srgb,var(--ok,#30a46c) 45%,transparent)}
.hr-badge.run{color:var(--acc2,#22d3ee);border-color:color-mix(in srgb,var(--acc2,#22d3ee) 45%,transparent)}
.hr-badge.bad{color:var(--bad,#e5484d);border-color:color-mix(in srgb,var(--bad,#e5484d) 45%,transparent)}`;
    document.head.appendChild(s);
  }

  let curId = '', mode = 'modify', pollTimer = 0, setupTimer = 0, lastSt = null;
  const fmtWhen = ms => ms ? new Date(ms).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '';
  const shortModel = m => String(m || '').split(/[\\/]/).filter(Boolean).pop() || String(m || 'Run');
  const slugify = m => String(m || 'model').split(/[\\/]/).pop().toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').replace(/-heretic$/, '').slice(0, 38) + '-heretic';
  const srcTag = s => s === 'ollama' ? 'Ollama' : s === 'lmstudio' ? 'LM Studio' : s === 'hf-cache' ? 'HF cache' : '';
  const fmtOpt = m => {
    const base = A.modelOrder ? A.modelOrder.label(m) : (m.name + (m.size ? ' \u00b7 ' + (m.size / 1073741824).toFixed(1) + ' GB' : ''));
    const tag = srcTag(m.source);
    return tag ? (base + ' [' + tag + ']') : base;
  };

  async function render(el) {
    el.innerHTML = '<div class="hr"><div class="hr-wrap">' +
      '<div class="hr-hero"><div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap"><h2 style="flex:1">\u2697\uFE0F Heretic</h2>' +
      '<button class="ib2" id="hrtut" type="button" title="Step-by-step interactive guide">\uD83C\uDF93 Guide</button>' +
      '<a class="ib2" href="https://github.com/p-e-w/heretic" target="_blank" rel="noopener noreferrer" style="text-decoration:none">GitHub: p-e-w/heretic \u2197</a></div>' +
      '<div class="mute">Pick any model you already have downloaded (Ollama, LM Studio, or Hugging Face) and turn it into a Heretic model in one click. Runs directional ablation (ARA) + Optuna TPE locally on your GPU and automatically adds the finished model to Moundshroud, Ollama, and LM Studio.</div></div>' +
      '<div id="hrsetup"></div>' +
      '<div class="hr-grid">' +
        '<div>' +
          '<div class="hr-card"><div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px"><b>Runs</b><button class="ib2" id="hrnew" type="button">+ New run</button></div><div id="hrjobs"></div></div>' +
          '<div class="hr-card"><b>How it works</b><ol style="padding-left:18px;margin:8px 0 0;font-size:12.5px;color:var(--mute);line-height:1.55">' +
            '<li><b>Pick any downloaded model</b> from your PC (or enter a Hugging Face ID). Local GGUF models are unpacked automatically.</li>' +
            '<li><b>Choose a preset</b> (Decensor, Reduce AI slop, Reduce sycophancy, Make terse, or custom TOML).</li>' +
            '<li><b>Optuna TPE optimizes</b> the steering parameters while preserving model intelligence (low KL divergence).</li>' +
            '<li><b>Auto-adds to Ollama &amp; LM Studio</b> so your new <code>-heretic</code> model appears in every dropdown immediately.</li>' +
          '</ol></div>' +
        '</div>' +
        '<div id="hrmain"></div>' +
      '</div></div></div>';

    el._cleanup = () => { clearInterval(pollTimer); clearInterval(setupTimer); pollTimer = 0; setupTimer = 0; };
    el._onShow = () => refresh(el);
    el.querySelector('#hrnew').onclick = () => { curId = ''; drawMain(el); markJobs(el); };
    const tutBtn = el.querySelector('#hrtut');
    if (tutBtn) tutBtn.onclick = () => A.repoTutorial && A.repoTutorial.open('heretic');
    if (A.on && !el._defWired) {
      el._defWired = true;
      A.on('default-model', () => { if (el.isConnected && !curId) refresh(el); });
    }
    await refresh(el);
  }

  async function refresh(el) {
    const st = await A.api('/api/heretic/status').catch(() => null);
    if (!st || !el.isConnected) return;
    if (A.modelOrder && typeof st.defaultModel === 'string') A.modelOrder.sync(st.defaultModel);
    lastSt = st;
    if (!curId && st.running && st.runId) curId = st.runId;
    else if (!curId && st.converting && st.convertId) curId = st.convertId;
    drawSetup(el, st);
    drawJobs(el, st);
    drawMain(el);
  }

  function drawSetup(el, st) {
    const box = el.querySelector('#hrsetup'); if (!box) return;
    if (st.installed) { box.innerHTML = ''; clearInterval(setupTimer); setupTimer = 0; return; }
    box.innerHTML = '<div class="hr-card" style="border-color:var(--warn,#f5a524)">' +
      '<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap"><div style="flex:1"><b>One-time Heretic setup needed</b>' +
      '<div class="mute">Clones <code>p-e-w/heretic</code> into <code>runtime\\heretic</code> and installs its Python packages into <code>runtime\\ftenv</code> (keeping your CUDA PyTorch).</div></div>' +
      '<button class="btn" id="hrinst"' + (st.installing ? ' disabled' : '') + '>' + (st.installing ? '\u23F3 Setting up\u2026' : '\u2699 Set up Heretic') + '</button></div>' +
      '<pre id="hrinstlog"' + (st.installing ? '' : ' style="display:none"') + '></pre></div>';
    const btn = box.querySelector('#hrinst'), lg = box.querySelector('#hrinstlog');
    const pollSetup = () => {
      clearInterval(setupTimer);
      setupTimer = setInterval(async () => {
        if (!el.isConnected) { clearInterval(setupTimer); return; }
        const [s, l] = await Promise.all([A.api('/api/heretic/status').catch(() => null), A.api('/api/heretic/installlog').catch(() => ({ log: '' }))]);
        if (lg && l && l.log) { lg.style.display = ''; lg.textContent = l.log; lg.scrollTop = lg.scrollHeight; }
        if (s && !s.installing) { clearInterval(setupTimer); setupTimer = 0; refresh(el); if (s.installed) A.toast('Heretic is ready in Studio.'); }
      }, 3000);
    };
    if (st.installing) pollSetup();
    if (btn) btn.onclick = async () => {
      btn.disabled = true; btn.textContent = '\u23F3 Setting up\u2026';
      if (lg) { lg.style.display = ''; lg.textContent = 'Starting Heretic setup\u2026'; }
      const r = await A.api('/api/heretic/install', {}).catch(e => ({ ok: false, error: e.message }));
      if (!r.ok) { btn.disabled = false; btn.textContent = '\u2699 Set up Heretic'; return A.toast(r.error || 'Could not start setup.'); }
      pollSetup();
    };
  }

  function markJobs(el) {
    el.querySelectorAll('.hr-job').forEach(d => d.classList.toggle('on', d.dataset.id === curId));
  }

  function drawJobs(el, st) {
    const box = el.querySelector('#hrjobs'); if (!box) return;
    const jobs = st.jobs || [];
    if (!jobs.length) { box.innerHTML = '<div class="mute">No runs yet. Pick a downloaded model on the right and press Make Heretic model.</div>'; return; }
    box.innerHTML = jobs.map(j => {
      const badge = j.running ? '<span class="hr-badge run">running</span>' : j.converting ? '<span class="hr-badge run">converting</span>' : j.status === 'done' ? '<span class="hr-badge ok">done</span>' : j.status === 'failed' ? '<span class="hr-badge bad">failed</span>' : '<span class="hr-badge">' + esc(j.status || 'saved') + '</span>';
      const title = j.mode === 'reproduce' ? shortModel(j.reproduce) : shortModel(j.model);
      return '<div class="hr-job' + (j.id === curId ? ' on' : '') + '" data-id="' + esc(j.id) + '">' +
        '<div style="flex:1;min-width:0"><div style="font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc(title) + '</div>' +
        '<div class="mute" style="font-size:11.5px">' + badge + ' ' + esc(j.preset || j.mode) + (j.ollamaModel && j.convertStatus === 'done' ? ' \u00b7 \u2705 ' + esc(j.ollamaModel) : '') + '</div>' +
        '<div class="mute" style="font-size:11px">' + esc(fmtWhen(j.startedAt)) + '</div></div>' +
        (!j.running && !j.converting ? '<button class="ib2 dang hrdel" data-del="' + esc(j.id) + '" title="Delete run" style="padding:2px 7px">\u2715</button>' : '') +
      '</div>';
    }).join('');
    box.querySelectorAll('.hr-job').forEach(d => d.onclick = e => {
      if (e.target.closest('.hrdel')) return;
      curId = d.dataset.id; markJobs(el); drawJobView(el, curId);
    });
    box.querySelectorAll('.hrdel').forEach(b => b.onclick = async e => {
      e.stopPropagation();
      if (!(await A.confirm('Delete this Heretic run and its saved files?'))) return;
      const r = await A.api('/api/heretic/remove', { id: b.dataset.del }).catch(() => ({ ok: false }));
      if (!r.ok) return A.toast(r.error || 'Could not delete run.');
      if (curId === b.dataset.del) curId = '';
      refresh(el);
    });
  }

  function drawMain(el) {
    if (curId) return drawJobView(el, curId);
    clearInterval(pollTimer); pollTimer = 0;
    const st = lastSt || { presets: [], suggestedModels: [], downloaded: [] };
    const main = el.querySelector('#hrmain'); if (!main) return;
    const downloaded = A.modelOrder ? A.modelOrder.sort(st.downloaded || []) : (st.downloaded || []);
    const firstModel = downloaded[0] || null;

    const modelPickerHtml = () => {
      const opts = downloaded.map(m => '<option value="' + esc(m.id) + '">' + esc(fmtOpt(m)) + '</option>').join('') +
        '<option value="__custom__">\u2014 Enter a Hugging Face model ID or browse a folder \u2014</option>';
      return '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px"><label style="margin:0">Downloaded model to turn into a Heretic model</label>' +
        '<button type="button" class="ib2" id="hrrefm" style="padding:3px 9px;font-size:11.5px" title="Rescan Ollama, LM Studio and Hugging Face models">\u21BB Refresh models</button></div>' +
        '<select id="hrlocal" style="margin-top:4px">' + opts + '</select>' +
        '<div class="mute" id="hrlocalnote" style="margin-top:4px"></div>' +
        '<div id="hrcustomwrap" style="margin-top:6px;' + (firstModel ? 'display:none' : '') + '">' +
          '<label>Hugging Face model ID or local model folder</label>' +
          '<div style="display:flex;gap:6px"><input id="hrmodel" value="Qwen/Qwen2.5-1.5B-Instruct" placeholder="e.g. Qwen/Qwen3-4B-Instruct-2507 or C:\\path\\to\\model" spellcheck="false" style="flex:1"><button type="button" class="ib2" id="hrpick">Browse folder\u2026</button></div>' +
          '<div class="hr-chips">' + (st.suggestedModels || []).map(m => '<button type="button" class="hr-chip" data-pickm="' + esc(m.id) + '" title="' + esc(m.name) + '">' + esc(m.id.split('/').pop()) + '</button>').join('') + '</div>' +
        '</div>';
    };

    main.innerHTML = '<div class="hr-card">' +
      '<div class="hr-modes">' +
        [['modify', '\u2697\uFE0F Make Heretic model'], ['reproduce', '\uD83D\uDD01 Reproduce (reproduce.json)'], ['evaluate', '\u2696\uFE0F Evaluate / compare']].map(m =>
          '<button type="button" class="ib2' + (mode === m[0] ? ' on' : '') + '" data-hrmode="' + m[0] + '">' + m[1] + '</button>'
        ).join('') +
      '</div>' +
      (mode === 'reproduce'
        ? '<label>reproduce.json URL or local file path</label><input id="hrrep" placeholder="https://huggingface.co/.../resolve/main/reproduce.json or C:\\path\\to\\reproduce.json" spellcheck="false">'
        : modelPickerHtml() +
          (mode === 'evaluate' ? '<label>Second model ID or local folder to compare</label><div style="display:flex;gap:6px"><input id="hreval" placeholder="Hugging Face ID or local folder" spellcheck="false" style="flex:1"><button type="button" class="ib2" id="hrpick2">Browse folder\u2026</button></div>' : '')
      ) +
      (mode !== 'reproduce'
        ? '<label>Behavior preset (p-e-w/heretic config)</label>' +
          '<select id="hrpreset">' + (st.presets || []).map(p => '<option value="' + esc(p.id) + '">' + esc(p.name) + '</option>').join('') + '</select>' +
          '<div class="mute" id="hrpdesc" style="margin-top:4px"></div>'
        : '') +
      (mode !== 'evaluate'
        ? '<label class="hr-chk"><input type="checkbox" id="hrautoimp" checked> Automatically convert to GGUF &amp; add to Moundshroud, Ollama, and LM Studio when done</label>' +
          '<div id="hrautobox" class="row2">' +
            '<div><label>New Heretic model name</label><input id="hroutname" value="' + esc(slugify(firstModel ? firstModel.name : 'Qwen2.5-1.5B-Instruct')) + '" spellcheck="false"></div>' +
            '<div><label>GGUF precision</label><select id="hrouttype"><option value="q8_0" selected>q8_0 (near-lossless, smaller — falls back to f16)</option><option value="f16">f16 (full 16-bit)</option><option value="bf16">bf16 (bfloat16)</option></select></div>' +
          '</div>'
        : '') +
      '<div class="row3" style="margin-top:6px">' +
        '<div><label>Quantization (while running)</label><select id="hrquant"><option value="bnb_4bit" selected>4-bit (bnb_4bit, best for 8 GB VRAM)</option><option value="none">None (full bf16/fp16)</option></select></div>' +
        (mode === 'modify' ? '<div><label>Optimization trials</label><input id="hrtrials" type="number" min="1" max="500" value="50"></div>' +
          '<div><label>Random startup trials</label><input id="hrstart" type="number" min="0" max="200" value="15"></div>' : '') +
      '</div>' +
      (mode === 'modify'
        ? '<div class="hr-chips"><span class="mute" style="align-self:center">Quick trials:</span>' +
            '<button type="button" class="hr-chip" data-tr="10,4">10 trials (quick test)</button>' +
            '<button type="button" class="hr-chip" data-tr="50,15">50 trials (balanced)</button>' +
            '<button type="button" class="hr-chip" data-tr="100,30">100 trials (Heretic default)</button>' +
          '</div>' +
          '<details style="margin-top:10px"><summary class="mute" style="cursor:pointer;font-weight:600">More options (export strategy, batch size, seed, HF weights)</summary>' +
            '<div class="row3" style="margin-top:6px">' +
              '<div><label>Export strategy</label><select id="hrexp"><option value="merge" selected>Merge full model (needed for Ollama/LM Studio)</option><option value="adapter">LoRA adapter only (low RAM)</option></select></div>' +
              '<div><label>Batch size (0 = auto)</label><input id="hrbatch" type="number" min="0" max="256" value="0"></div>' +
              '<div><label>Max response tokens</label><input id="hrlen" type="number" min="16" max="1024" value="100"></div>' +
            '</div>' +
            '<div class="row3" style="margin-top:4px">' +
              '<div><label>Pareto trial index (0 = best)</label><input id="hrtidx" type="number" min="0" max="50" value="0"></div>' +
              '<div><label>Checkpoint</label><select id="hrckpt"><option value="continue" selected>Continue if present</option><option value="restart">Start fresh</option></select></div>' +
              '<div><label>Seed (optional)</label><input id="hrseed" placeholder="random"></div>' +
            '</div>' +
            '<label class="hr-chk" style="margin-top:8px"><input type="checkbox" id="hrprefhf"> Prefer clean unquantized Hugging Face base weights when mapped (higher quality; uses internet on first run)</label>' +
          '</details>'
        : mode === 'reproduce'
          ? '<div class="row2" style="margin-top:6px"><div><label>Export strategy</label><select id="hrexp"><option value="merge" selected>Merge full model (for Ollama/LM Studio)</option><option value="adapter">LoRA adapter only</option></select></div><div></div></div>'
          : '') +
      (mode !== 'reproduce'
        ? '<details id="hrtomlbox" style="margin-top:8px"><summary class="mute" style="cursor:pointer;font-weight:600">Advanced: view or edit config.toml</summary>' +
          '<textarea id="hrtoml" rows="12" spellcheck="false" style="margin-top:6px"></textarea></details>'
        : '') +
      '<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-top:14px">' +
        '<button class="btn" id="hrgo"' + (!st.installed || st.running || st.converting ? ' disabled' : '') + '>' + (mode === 'modify' ? '\u2697\uFE0F Make Heretic model' : mode === 'reproduce' ? '\uD83D\uDD01 Reproduce model' : '\u2696\uFE0F Compare models') + '</button>' +
        '<span class="mute" id="hrgohint">' + (!st.installed ? 'Complete the one-time setup above first.' : st.running ? 'Another Heretic run is already active.' : 'Runs locally on your GPU; you can switch tabs while it works.') + '</span>' +
      '</div></div>';

    const q = s => main.querySelector(s);
    main.querySelectorAll('[data-hrmode]').forEach(b => b.onclick = () => { mode = b.dataset.hrmode; drawMain(el); });
    main.querySelectorAll('[data-pickm]').forEach(b => b.onclick = () => {
      if (q('#hrmodel')) q('#hrmodel').value = b.dataset.pickm;
      if (q('#hroutname') && !q('#hroutname').dataset.edited) q('#hroutname').value = slugify(b.dataset.pickm);
    });
    main.querySelectorAll('[data-tr]').forEach(b => b.onclick = () => { const [t, s] = b.dataset.tr.split(','); if (q('#hrtrials')) q('#hrtrials').value = t; if (q('#hrstart')) q('#hrstart').value = s; });

    const outNameInp = q('#hroutname');
    if (outNameInp) outNameInp.oninput = () => { outNameInp.dataset.edited = '1'; };

    const syncLocalSelection = () => {
      const sel = q('#hrlocal'), wrap = q('#hrcustomwrap'), note = q('#hrlocalnote');
      if (!sel) return;
      const v = sel.value, isCustom = !v || v === '__custom__';
      if (wrap) wrap.style.display = isCustom ? '' : 'none';
      const hit = !isCustom && downloaded.find(m => m.id === v);
      if (hit) {
        if (outNameInp && !outNameInp.dataset.edited) outNameInp.value = slugify(hit.name);
        if (note) {
          note.textContent = hit.source === 'hf-cache'
            ? 'Ready in local Hugging Face cache (no unpacking needed).'
            : 'Downloaded ' + srcTag(hit.source) + ' GGUF — will unpack automatically for Heretic' + (hit.hfFallback ? ' (with automatic fallback to ' + hit.hfFallback + ' if needed).' : '.');
        }
      } else if (note) {
        note.textContent = downloaded.length ? 'Enter any Hugging Face model ID or browse to a local model folder below.' : 'No downloaded local models detected yet — enter any Hugging Face model ID below.';
      }
    };
    if (q('#hrlocal')) { q('#hrlocal').onchange = syncLocalSelection; syncLocalSelection(); }
    if (q('#hrrefm')) q('#hrrefm').onclick = async () => { await refresh(el); A.toast('Refreshed downloaded models.'); };

    const autoChk = q('#hrautoimp'), autoBox = q('#hrautobox');
    if (autoChk && autoBox) autoChk.onchange = () => { autoBox.style.display = autoChk.checked ? '' : 'none'; };

    const pickDir = async inp => {
      A.toast('Choose a model folder in the window that opened.');
      const r = await A.api('/api/pick-folder', {}).catch(() => null);
      if (r && r.path && inp) { inp.value = r.path; if (outNameInp && !outNameInp.dataset.edited) outNameInp.value = slugify(r.path); }
    };
    if (q('#hrpick')) q('#hrpick').onclick = () => pickDir(q('#hrmodel'));
    if (q('#hrpick2')) q('#hrpick2').onclick = () => pickDir(q('#hreval'));

    const loadPreset = async id => {
      const p = (st.presets || []).find(x => x.id === id);
      if (q('#hrpdesc')) q('#hrpdesc').textContent = p ? p.desc : '';
      if (q('#hrtoml') && id !== 'custom') {
        const r = await A.api('/api/heretic/preset?id=' + encodeURIComponent(id)).catch(() => ({ toml: '' }));
        if (q('#hrtoml')) q('#hrtoml').value = r.toml || '';
      }
      if (id === 'custom' && q('#hrtomlbox')) q('#hrtomlbox').open = true;
    };
    if (q('#hrpreset')) { q('#hrpreset').onchange = () => loadPreset(q('#hrpreset').value); loadPreset(q('#hrpreset').value); }

    q('#hrgo').onclick = async () => {
      const selVal = q('#hrlocal') ? q('#hrlocal').value : '__custom__';
      const payload = {
        mode,
        selectedModel: selVal,
        model: q('#hrmodel') ? q('#hrmodel').value.trim() : '',
        evaluateModel: q('#hreval') ? q('#hreval').value.trim() : '',
        reproduce: q('#hrrep') ? q('#hrrep').value.trim() : '',
        preset: q('#hrpreset') ? q('#hrpreset').value : 'default',
        quantization: q('#hrquant') ? q('#hrquant').value : 'bnb_4bit',
        nTrials: q('#hrtrials') ? +q('#hrtrials').value : 50,
        nStartupTrials: q('#hrstart') ? +q('#hrstart').value : 15,
        exportStrategy: q('#hrexp') ? q('#hrexp').value : 'merge',
        batchSize: q('#hrbatch') ? +q('#hrbatch').value : 0,
        maxResponseLength: q('#hrlen') ? +q('#hrlen').value : 100,
        trialIndex: q('#hrtidx') ? +q('#hrtidx').value : 0,
        checkpointAction: q('#hrckpt') ? q('#hrckpt').value : 'continue',
        seed: q('#hrseed') ? q('#hrseed').value.trim() : '',
        preferHf: !!(q('#hrprefhf') && q('#hrprefhf').checked),
        autoImport: !!(q('#hrautoimp') && q('#hrautoimp').checked),
        outputName: q('#hroutname') ? q('#hroutname').value.trim() : '',
        outtype: q('#hrouttype') ? q('#hrouttype').value : 'q8_0',
        customToml: (q('#hrtoml') && q('#hrtomlbox') && q('#hrtomlbox').open) ? q('#hrtoml').value : '',
      };
      q('#hrgo').disabled = true;
      const r = await A.api('/api/heretic/start', payload).catch(e => ({ ok: false, error: e.message }));
      if (!r.ok) { q('#hrgo').disabled = false; return A.toast(r.error || 'Could not start Heretic.'); }
      curId = r.id;
      A.toast('Heretic started.');
      await refresh(el);
    };
  }

  async function drawJobView(el, id) {
    const main = el.querySelector('#hrmain'); if (!main) return;
    const paint = async () => {
      if (!el.isConnected || curId !== id) { clearInterval(pollTimer); pollTimer = 0; return; }
      const r = await A.api('/api/heretic/progress?id=' + encodeURIComponent(id)).catch(() => null);
      if (!r || !r.ok) { curId = ''; drawMain(el); return; }
      const j = r.job, p = r.progress || {};
      const active = j.running || j.converting;
      const badge = j.running ? '<span class="hr-badge run">Running</span>' : j.converting ? '<span class="hr-badge run">Converting &amp; adding to Ollama\u2026</span>' : j.status === 'done' ? '<span class="hr-badge ok">Finished</span>' : j.status === 'failed' ? '<span class="hr-badge bad">Failed</span>' : '<span class="hr-badge">' + esc(j.status || '') + '</span>';
      const existingPre = main.querySelector('#hrlog');
      const wasAtBottom = !existingPre || (existingPre.scrollHeight - existingPre.scrollTop - existingPre.clientHeight < 60);
      const savedName = (main.querySelector('#hrolname') && main.querySelector('#hrolname').value) || j.ollamaModel || slugify(j.model || j.reproduce || j.id);
      const savedType = (main.querySelector('#hroltype') && main.querySelector('#hroltype').value) || j.outtype || 'q8_0';

      main.innerHTML = '<div class="hr-card">' +
        '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">' +
          '<b style="font-size:16px;flex:1">' + esc(j.mode === 'reproduce' ? j.reproduce : j.model) + '</b>' + badge +
          (active ? '<button class="ib2 dang" id="hrstop" type="button">\u25A0 Stop</button>' : '<button class="ib2" id="hropen" type="button">\uD83D\uDCC2 Open folder</button><button class="ib2" id="hrback" type="button">+ New run</button>') +
        '</div>' +
        '<div class="mute" style="margin-top:4px">Mode: <b>' + esc(j.mode) + '</b> \u00b7 Preset: <b>' + esc(j.preset) + '</b> \u00b7 Quant: <b>' + esc(j.quantization) + '</b>' + (j.nTrials ? ' \u00b7 Trials: <b>' + (p.trial || 0) + '/' + j.nTrials + '</b>' : '') + ' \u00b7 Started ' + esc(fmtWhen(j.startedAt)) + '</div>' +
        (j.running ? '<div class="hr-bar"><div style="width:' + Math.max(4, p.pct || 0) + '%"></div></div><div class="mute">' + esc(p.phase || 'Running Heretic\u2026') + '</div>' : '') +
        (j.error ? '<div style="color:var(--bad,#e5484d);font-size:12.5px;margin-top:6px">' + esc(j.error) + '</div>' : '') +
        '<label style="margin-top:10px">Heretic output log</label>' +
        '<pre id="hrlog">' + esc(r.log || '(waiting for output\u2026)') + '</pre>' +
      '</div>' +
      (j.hasOutput
        ? '<div class="hr-card"><b>\u2B07 Use in Moundshroud, Ollama &amp; LM Studio</b>' +
          (j.hasAdapterOnly
            ? '<div class="mute" style="margin-top:4px">This run exported a LoRA adapter only (in <code>output/</code>). Re-run with <b>Merge full model</b> to convert to GGUF for Ollama &amp; LM Studio.</div>'
            : '<div class="mute" style="margin-top:4px">Converts the modified Hugging Face model in <code>output/</code> to GGUF, registers it in Ollama, and automatically links it into LM Studio.</div>' +
              '<div class="row2" style="margin-top:8px">' +
                '<div><label>Ollama model name</label><input id="hrolname" value="' + esc(savedName) + '" spellcheck="false"></div>' +
                '<div><label>GGUF precision</label><select id="hroltype">' +
                  [['q8_0', 'q8_0 (smaller, near-lossless — recommended)'], ['f16', 'f16 (full 16-bit)'], ['bf16', 'bf16 (bfloat16)']].map(o => '<option value="' + o[0] + '"' + (savedType === o[0] ? ' selected' : '') + '>' + o[1] + '</option>').join('') +
                '</select></div>' +
              '</div>' +
              '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:10px">' +
                '<button class="btn" id="hrimp"' + (active ? ' disabled' : '') + '>' + (j.converting ? '\u23F3 Converting &amp; importing\u2026' : (j.convertStatus === 'done' ? '\u21BB Re-convert / Rename in Ollama' : '\u2B07 Convert to GGUF &amp; Add to Ollama')) + '</button>' +
                (j.convertStatus === 'done' ? '<span class="hr-badge ok">\u2705 Ready as ' + esc(j.ollamaModel) + ' (Moundshroud + Ollama + LM Studio)</span>' : '') +
                (j.convertError ? '<span style="color:var(--bad,#e5484d);font-size:12px">' + esc(j.convertError) + '</span>' : '') +
              '</div>' +
              (r.convLog ? '<pre id="hrconvlog">' + esc(r.convLog) + '</pre>' : '')) +
        '</div>'
        : '');

      const pre = main.querySelector('#hrlog');
      if (pre && wasAtBottom) pre.scrollTop = pre.scrollHeight;
      const cpre = main.querySelector('#hrconvlog');
      if (cpre) cpre.scrollTop = cpre.scrollHeight;

      const stopBtn = main.querySelector('#hrstop');
      if (stopBtn) stopBtn.onclick = async () => { await A.api('/api/heretic/stop', {}); A.toast('Stopping Heretic\u2026'); setTimeout(() => refresh(el), 1000); };
      const openBtn = main.querySelector('#hropen');
      if (openBtn) openBtn.onclick = () => A.api('/api/heretic/open', { id });
      const backBtn = main.querySelector('#hrback');
      if (backBtn) backBtn.onclick = () => { curId = ''; drawMain(el); markJobs(el); };
      const impBtn = main.querySelector('#hrimp');
      if (impBtn) impBtn.onclick = async () => {
        const name = (main.querySelector('#hrolname') && main.querySelector('#hrolname').value.trim()) || savedName;
        const outtype = (main.querySelector('#hroltype') && main.querySelector('#hroltype').value) || 'q8_0';
        impBtn.disabled = true;
        delete main.dataset.refreshed;
        const res = await A.api('/api/heretic/import', { id, name, outtype }).catch(e => ({ ok: false, error: e.message }));
        if (!res.ok) { impBtn.disabled = false; return A.toast(res.error || 'Could not start conversion.'); }
        A.toast('Converting to GGUF and adding to Ollama\u2026');
        drawJobView(el, id);
      };

      if (j.convertStatus === 'done' && !main.dataset.refreshed) {
        main.dataset.refreshed = '1';
        if (A.ai && A.ai.refreshModels) try { A.ai.refreshModels(); } catch (e) { }
      }
      if (!active && pollTimer) {
        clearInterval(pollTimer); pollTimer = 0;
        const s2 = await A.api('/api/heretic/status').catch(() => null);
        if (s2) { lastSt = s2; drawJobs(el, s2); }
      }
    };

    clearInterval(pollTimer); pollTimer = 0;
    await paint();
    const st = await A.api('/api/heretic/status').catch(() => null);
    if (st && ((st.running && st.runId === id) || (st.converting && st.convertId === id))) {
      pollTimer = setInterval(paint, 2200);
    }
  }

  A.heretic = { render };
  if (A.studio && A.studio.reg) A.studio.reg('heretic', '\u2697\uFE0F Heretic', body => A.heretic.render(body), 31.5);
  if (A.cmd && A.cmd.reg) A.cmd.reg({ title: 'Open Heretic (Studio)', sub: 'Turn any downloaded model into a Heretic model', icon: '\u2697\uFE0F', group: 'Studio', tags: 'heretic abliteration decensor slop sycophancy steering model studio gguf ollama', run: () => A.studio && A.studio.go('heretic') });
})();

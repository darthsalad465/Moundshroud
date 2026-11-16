// Studio > Model Lab: make a local model stronger at a task. Choose a base model, write a system prompt, set the
// temperature and memory, and add your own example answers; "Build" bakes a new named model with ollama create that
// the whole app can use. No GPU needed. The recipe is saved so you can tweak and rebuild.
(() => {
  const esc = t => String(t == null ? '' : t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  if (!document.getElementById('ml-css')) { const s = document.createElement('style'); s.id = 'ml-css'; s.textContent = `
.ml{flex:1;min-height:0;overflow:auto;padding:16px}.ml-wrap{max-width:820px;margin:0 auto}
.ml h2{margin:2px 0 4px}.ml .sub{color:var(--mute);font-size:13px;line-height:1.5;margin-bottom:12px}
.ml label{display:block;font-size:12px;color:var(--mute);margin:10px 0 3px;font-weight:600}
.ml input,.ml textarea,.ml select{width:100%;box-sizing:border-box;padding:8px 10px;border:1px solid var(--line);border-radius:8px;background:var(--panel2);color:var(--text);font:13px/1.5 inherit}
.ml textarea{font-family:Consolas,"Cascadia Mono",monospace}
.ml .row2{display:flex;gap:12px;flex-wrap:wrap}.ml .row2>div{flex:1;min-width:150px}
.ml .btn{padding:9px 16px;border:0;border-radius:9px;font-weight:700;color:#fff;cursor:pointer;background:linear-gradient(135deg,var(--acc,#7c5cff),var(--acc2,#22d3ee))}.ml .btn:disabled{opacity:.5}
.ml .ib2{padding:5px 10px;border:1px solid var(--line);border-radius:7px;background:var(--panel2);color:var(--text);cursor:pointer;font-size:12px}.ml .ib2:hover{border-color:var(--acc)}
.ml .ex{border:1px solid var(--line);border-radius:10px;padding:10px;margin-top:8px;background:var(--panel)}
.ml .card{border:1px solid var(--line);border-radius:12px;padding:12px;margin-top:10px;background:var(--panel)}
.ml pre{background:#0b0e14;color:#cdd3e0;border-radius:8px;padding:10px;font-size:12px;white-space:pre-wrap;max-height:220px;overflow:auto;margin-top:10px}
.ml .mute{color:var(--mute);font-size:12px}
.ml .ftstep{display:flex;gap:10px;margin:12px 0}
.ml .ftn{flex:none;width:24px;height:24px;border-radius:50%;background:var(--acc,#7c5cff);color:#fff;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700}`; document.head.appendChild(s); }

  async function render(el) {
    el.innerHTML = '<div class="ml"><div class="ml-wrap">' +
      '<h2>🧠 Model Lab</h2><div class="sub">Make a local model stronger at what you care about. Pick a base model, tell it how to behave, set its dials, and add example answers to copy. <b>Build</b> bakes a new model you can choose anywhere in the app. This runs on this PC, no GPU needed, in seconds.</div>' +
      '<div class="row2"><div><label>New model name</label><input id="mlname" value="my-tutor" spellcheck="false"></div><div><label>Based on</label><select id="mlbase"></select></div></div>' +
      '<label>How it should behave (system prompt)</label><textarea id="mlsys" rows="4" spellcheck="false">You are a patient, encouraging tutor. Explain step by step, check understanding, and keep answers short.</textarea>' +
      '<div class="row2"><div><label>Temperature (0 steady – 2 wild)</label><input id="mltemp" type="number" min="0" max="2" step="0.1" value="0.6"></div><div><label>Memory (num_ctx tokens)</label><input id="mlctx" type="number" min="512" step="512" value="8192"></div></div>' +
      '<label>Example answers to copy (optional, the strongest lever)</label><div class="mute">Each pair shows the model a question and the ideal reply. A handful of good ones shapes its style a lot.</div><div id="mlex"></div><button class="ib2" id="mladd" style="margin-top:8px">+ Add example</button>' +
      '<div style="margin:14px 0"><button class="btn" id="mlbuild">⚙ Build the model</button> <span class="mute" id="mlstat"></span></div><div id="mllog"></div>' +
      '<h3 style="margin:18px 0 2px">Your custom models</h3><div class="mute">Built here. Choose them in Chat’s model menu like any other.</div><div id="mllist"></div>' +
      '<div id="mlgym" style="margin-top:16px"></div>' +
      '<div id="mlft" style="margin-top:16px"></div>' +
      '</div></div>';
    const q = id => el.querySelector(id);
    const exBox = q('#mlex');
    const addEx = (u, a) => { const d = document.createElement('div'); d.className = 'ex'; d.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:center"><span class="mute">Example</span><button class="ib2 mlexdel">Remove</button></div><label>Question</label><textarea rows="2" class="mlexu" spellcheck="false"></textarea><label>Ideal answer</label><textarea rows="3" class="mlexa" spellcheck="false"></textarea>'; exBox.appendChild(d); d.querySelector('.mlexu').value = u || ''; d.querySelector('.mlexa').value = a || ''; d.querySelector('.mlexdel').onclick = () => d.remove(); };
    q('#mladd').onclick = () => addEx('', '');
    const gather = () => ({ name: q('#mlname').value, base: q('#mlbase').value, system: q('#mlsys').value, temperature: +q('#mltemp').value, num_ctx: +q('#mlctx').value, examples: [...exBox.querySelectorAll('.ex')].map(d => ({ u: d.querySelector('.mlexu').value.trim(), a: d.querySelector('.mlexa').value.trim() })).filter(e => e.u && e.a) });

    const loadModels = async () => {
      const r = await A.api('/api/modellab/models').catch(() => ({ models: [] }));
      const recs = (await A.api('/api/modellab/recipes').catch(() => ({ recipes: {} }))).recipes || {};
      const sel = q('#mlbase'); sel.innerHTML = (r.models || []).map(m => '<option value="' + esc(m.name) + '">' + esc(m.name) + (m.custom ? ' (yours)' : '') + '</option>').join('') || '<option value="">no models found</option>';
      const list = q('#mllist'), names = Object.keys(recs);
      list.innerHTML = names.length ? names.map(n => '<div class="card" style="display:flex;gap:10px;align-items:center"><div style="flex:1"><b>' + esc(n) + '</b><div class="mute">from ' + esc(recs[n].base) + ' · ' + (recs[n].examples || []).length + ' examples · temp ' + recs[n].temperature + '</div></div><button class="ib2 mledit" data-n="' + esc(n) + '">Edit</button> <button class="ib2 mldel" data-n="' + esc(n) + '">Delete</button></div>').join('') : '<div class="mute" style="margin-top:6px">None yet. Build one above.</div>';
      list.querySelectorAll('.mldel').forEach(b => b.onclick = async () => { if (!confirm('Delete model "' + b.dataset.n + '"? This removes it from Ollama.')) return; const res = await A.api('/api/modellab/remove', { name: b.dataset.n }); A.toast(res.ok ? 'Deleted.' : (res.error || 'Could not delete.')); loadModels(); });
      list.querySelectorAll('.mledit').forEach(b => b.onclick = () => { const r2 = recs[b.dataset.n]; if (!r2) return; q('#mlname').value = b.dataset.n; q('#mlbase').value = r2.base; q('#mlsys').value = r2.system || ''; q('#mltemp').value = r2.temperature; q('#mlctx').value = r2.num_ctx || 8192; exBox.innerHTML = ''; (r2.examples || []).forEach(e => addEx(e.u, e.a)); el.querySelector('.ml').scrollTop = 0; A.toast('Loaded "' + b.dataset.n + '" to edit. Change it and Build.'); });
    };
    q('#mlbuild').onclick = async () => {
      const r = gather(); if (!r.base) return A.toast('No base model is available.'); if (!r.name.trim()) return A.toast('Give the model a name.');
      const btn = q('#mlbuild'), stat = q('#mlstat'), log = q('#mllog'); btn.disabled = true; stat.textContent = 'Building… this takes a few seconds.'; log.innerHTML = '';
      const res = await A.api('/api/modellab/build', r).catch(e => ({ ok: false, error: e.message }));
      btn.disabled = false; stat.textContent = '';
      if (res.ok) { A.toast('Model "' + res.name + '" is ready. Pick it in Chat.'); log.innerHTML = '<pre>' + esc(res.log || '') + '</pre>'; loadModels(); if (A.ai && A.ai.refreshModels) try { A.ai.refreshModels(); } catch (e) { } }
      else { log.innerHTML = '<pre>' + esc((res.error || 'Build failed.') + '\n\n' + (res.log || '')) + '</pre>'; A.toast(res.error || 'Build failed.'); }
    };
    addEx('What is a variable?', 'A variable is a labelled box that holds a value. Example: score = 0. You can read it or change it later. Want to try naming one?');
    loadModels();
    renderFT();
    renderGym();

    /* the practice gym: a model solves graded coding exercises in a sealed sandbox; passing answers become lessons */
    async function renderGym() {
      const host = el.querySelector('#mlgym'); if (!host) return;
      const g = s => host.querySelector(s);
      const [mr, rr] = await Promise.all([A.api('/api/modellab/models').catch(() => ({ models: [] })), A.api('/api/practice/runs').catch(() => ({ runs: [], count: 40 }))]);
      const n = rr.count || 40;
      host.innerHTML = '<div class="card"><h3 style="margin:0 0 6px">🏋 Practice gym (the AI trains itself)</h3>' +
        '<div class="mute">One of your models works through ' + n + ' Python exercises on its own. Each answer runs in a sealed sandbox (its own throwaway folder, no internet, 10 second limit) and hidden tests grade it. Answers that pass become lessons: load them as examples below, fine-tune, then send the tuned model back to the gym and compare scores.</div>' +
        '<div class="row2" style="margin-top:10px"><div><label>Model that practises</label><select id="gymmodel">' + (mr.models || []).map(m => '<option value="' + esc(m.name) + '">' + esc(m.name) + '</option>').join('') + '</select></div>' +
        '<div><label>Tries per exercise</label><input id="gymtries" type="number" min="1" max="4" value="2"></div>' +
        '<div><label>Exercises</label><select id="gymlimit"><option value="10">10 (quick)</option><option value="20">20</option><option value="' + n + '" selected>all ' + n + '</option></select></div></div>' +
        '<div style="margin:12px 0"><button class="btn" id="gymgo">▶ Start practice</button> <button class="ib2" id="gymstop" style="display:none">■ Stop</button> <span class="mute" id="gymstat"></span></div>' +
        '<div id="gymlive"></div><h4 style="margin:14px 0 4px">Scoreboard</h4><div id="gymruns"></div></div>';
      const drawRuns = list => {
        g('#gymruns').innerHTML = (list || []).length ? list.map(r => '<div class="card" style="display:flex;gap:10px;align-items:center;margin-top:6px"><div style="flex:1"><b>' + esc(r.model) + '</b> · ' + r.passed + '/' + r.total + ' passed (' + (r.total ? Math.round(100 * r.passed / r.total) : 0) + '%)<div class="mute">' + esc((r.when || '').slice(0, 16).replace('T', ' ')) + ' · ' + r.attempts + ' tries each</div></div>' + (r.examples ? '<button class="ib2 gymuse" data-id="' + esc(r.id) + '">Use ' + r.examples + ' answers as lessons</button>' : '') + '</div>').join('') : '<div class="mute">No runs yet.</div>';
        host.querySelectorAll('.gymuse').forEach(b => b.onclick = async () => {
          const ex = (await A.api('/api/practice/examples', { id: b.dataset.id })).examples || [];
          const box = el.querySelector('#mlex'); box.innerHTML = ''; ex.forEach(e => addEx(e.u, e.a));
          el.querySelector('#mlsys').value = 'You are a careful Python programmer. Reply with correct, tested code in one python block.';
          el.querySelector('.ml').scrollTop = 0; A.toast('Loaded ' + ex.length + ' passing answers as lessons. Build or fine-tune below.');
        });
      };
      drawRuns(rr.runs);
      const live = s => {
        const pct = s.total ? Math.round(100 * s.done / s.total) : 0;
        g('#gymlive').innerHTML = '<div class="mute">' + esc(s.model) + ': ' + s.done + '/' + s.total + ' done, ' + s.passed + ' passed, ' + s.tries + ' attempts</div><div style="height:6px;border-radius:4px;background:var(--panel2);margin:6px 0"><div style="height:100%;width:' + pct + '%;border-radius:4px;background:linear-gradient(90deg,var(--acc),var(--acc2))"></div></div>' +
          (s.recent || []).map(r => '<div class="mute">' + (r.ok ? '<span style="color:var(--ok,#30a46c)">✔</span>' : '<span style="color:var(--bad,#e5484d)">✖</span>') + ' ' + esc(r.name) + ' · ' + r.tries + ' tr' + (r.tries === 1 ? 'y' : 'ies') + ' · ' + r.s + ' s</div>').join('');
      };
      let timer = 0;
      const poll = () => { clearInterval(timer); timer = setInterval(async () => {
        const s = await A.api('/api/practice/status').catch(() => null); if (!s) return;
        live(s); if (!s.running) { clearInterval(timer); g('#gymgo').disabled = false; g('#gymstop').style.display = 'none'; g('#gymstat').textContent = s.error ? 'Stopped: ' + s.error : 'Finished: ' + s.passed + '/' + s.done + ' passed.'; drawRuns((await A.api('/api/practice/runs')).runs); }
        if (!host.isConnected) clearInterval(timer);
      }, 2500); };
      g('#gymgo').onclick = async () => {
        const r = await A.api('/api/practice/start', { model: g('#gymmodel').value, attempts: +g('#gymtries').value, limit: +g('#gymlimit').value });
        if (!r.ok) return A.toast(r.error || 'Could not start.');
        g('#gymgo').disabled = true; g('#gymstop').style.display = ''; g('#gymstat').textContent = 'Practising… you can leave this page.'; poll();
      };
      g('#gymstop').onclick = () => A.api('/api/practice/stop', {});
      const s0 = await A.api('/api/practice/status').catch(() => null);
      if (s0 && s0.running) { g('#gymgo').disabled = true; g('#gymstop').style.display = ''; live(s0); poll(); }
    }

    /* the interactive fine-tuning tutorial: guided steps that explain what each stage does to the model */
    async function renderFT() {
      const host = el.querySelector('#mlft'); if (!host) return;
      const qf = s => host.querySelector(s);
      const step = (n, title, body) => '<div class="ftstep"><div class="ftn">' + n + '</div><div><b>' + title + '</b><div class="mute" style="margin-top:3px">' + body + '</div></div></div>';
      let st = {}; try { st = await A.api('/api/finetune/status'); } catch (e) { }
      let h = '<div class="card"><h3 style="margin:0 0 6px">🎓 Real fine-tuning (GPU), guided</h3><div class="mute">The Model Lab above adds instructions and examples on top of a model. Fine-tuning goes deeper: it changes the model’s own numbers, so the new behaviour is baked in. Here is exactly what happens.</div>';
      if (!st.installed) {
        h += step('0', 'One-time setup', 'Fine-tuning needs a Python toolkit and a GPU build of PyTorch, a few GB. Press Set up once; it runs in the background and you can leave this page.') +
          '<div style="margin-top:8px"><button class="btn" id="ftinstall">⚙ Set up fine-tuning</button> <span class="mute" id="ftinststat">' + (st.installing ? 'Installing…' : '') + '</span></div><pre id="ftinstlog"' + (st.installing ? '' : ' style="display:none"') + '></pre>';
      } else {
        h += step('1', 'The base model, frozen', 'A small open model is the starting point. It already knows language. Its billions of numbers stay frozen; you do not rewrite them.') +
          '<div style="margin:6px 0 10px"><select id="ftbase" class="ib2">' + (st.bases || []).map(b => '<option value="' + esc(b.id) + '">' + esc(b.name) + '</option>').join('') + '</select> <span class="mute">downloaded the first time you train</span></div>' +
          step('2', 'Your examples, the lessons', 'The example pairs you wrote above are the lessons. Each question and ideal answer teaches the behaviour. More good, varied ones teach more.') +
          step('3', '4-bit and LoRA, how it fits', 'The base is squeezed to 4-bit so it fits your 8 GB GPU, and training adds tiny side-matrices (LoRA) next to the frozen weights. Only those few million numbers learn, so it is fast and safe.') +
          '<div class="row2" style="margin:6px 0 10px"><div><label>Rounds over the data (epochs)</label><input id="ftep" type="number" min="1" max="10" value="3"></div><div><label>Adapter size (LoRA r)</label><input id="ftr" type="number" min="8" max="64" step="8" value="16"></div></div>' +
          step('4', 'Training, watch the loss fall', 'The model reads each example, guesses the answer, and measures how wrong it is: the loss. It nudges the adapters to be less wrong, over and over. Falling loss means it is learning.') +
          '<div style="margin:6px 0"><button class="btn" id="fttrain">▶ Start fine-tuning</button> <button class="ib2" id="ftstop" style="display:none">■ Stop</button> <span class="mute" id="ftstat"></span></div><pre id="ftprog" style="display:none"></pre>' +
          step('5', 'Merge, export, use', 'The learned adapters are folded back in, saved as a GGUF file, and imported into Ollama as a new model you pick in Chat, fully offline.') +
          '<div id="ftimport" style="display:none;margin-top:6px"><input id="ftname" placeholder="name for the tuned model" value="my-tuned" style="max-width:220px"> <button class="btn" id="ftimpbtn">⬇ Import into Ollama</button></div>';
      }
      host.innerHTML = h + '</div>';
      if (qf('#ftinstall')) { qf('#ftinstall').onclick = async () => { qf('#ftinstall').disabled = true; qf('#ftinststat').textContent = 'Installing… 10 to 20 minutes.'; qf('#ftinstlog').style.display = ''; await A.api('/api/finetune/install', {}); pollInstall(); }; if (st.installing) pollInstall(); }
      function pollInstall() { const lg = qf('#ftinstlog'); const t = setInterval(async () => { const s = await A.api('/api/finetune/status').catch(() => ({})); const l = await A.api('/api/finetune/installlog').catch(() => ({})); if (lg) lg.textContent = l.log || ''; if (!s.installing) { clearInterval(t); renderFT(); } }, 4000); }
      if (qf('#fttrain')) {
        qf('#fttrain').onclick = async () => {
          const examples = [...el.querySelectorAll('#mlex .ex')].map(d => ({ u: d.querySelector('.mlexu').value.trim(), a: d.querySelector('.mlexa').value.trim() })).filter(e => e.u && e.a);
          if (examples.length < 2) return A.toast('Add at least 2 examples above first.');
          const r = await A.api('/api/finetune/train', { base: qf('#ftbase').value, system: el.querySelector('#mlsys').value, examples, epochs: +qf('#ftep').value, lora_r: +qf('#ftr').value });
          if (!r.ok) return A.toast(r.error || 'Could not start.');
          qf('#fttrain').disabled = true; qf('#ftstop').style.display = ''; qf('#ftprog').style.display = ''; qf('#ftstat').textContent = 'Starting…'; pollTrain(r.id);
        };
        qf('#ftstop').onclick = () => A.api('/api/finetune/stop', {});
      }
      function pollTrain(id) {
        const pg = qf('#ftprog'); const t = setInterval(async () => {
          const p = await A.api('/api/finetune/progress', { id }).catch(() => ({}));
          if (pg) { const steps = (p.lines || []).filter(l => l.stage === 'step'), msgs = (p.lines || []).filter(l => l.msg).slice(-6).map(l => '• ' + l.msg); const last = steps[steps.length - 1]; pg.textContent = msgs.join('\n') + (last ? '\n\nloss ' + last.loss + '  (step ' + last.step + '/' + (last.total_steps || '?') + ', epoch ' + last.epoch + ')' : ''); }
          if (p.error) { clearInterval(t); qf('#ftstat').textContent = 'Failed.'; qf('#fttrain').disabled = false; qf('#ftstop').style.display = 'none'; }
          if (p.done) { clearInterval(t); qf('#ftstat').innerHTML = '<span class="ok">Done.</span>'; qf('#ftstop').style.display = 'none'; const imp = qf('#ftimport'); if (imp) { imp.style.display = ''; imp.dataset.id = id; } }
        }, 4000);
      }
      if (qf('#ftimpbtn')) qf('#ftimpbtn').onclick = async () => { const id = qf('#ftimport').dataset.id; const r = await A.api('/api/finetune/import', { id, name: qf('#ftname').value }); A.toast(r.ok ? ('Imported “' + r.name + '”. Pick it in Chat.') : (r.error || 'Import failed.')); if (r.ok) loadModels(); };
    }
  }
  A.modelLab = { render };
  if (A.studio && A.studio.reg) A.studio.reg('modellab', '🧠 Model Lab', body => A.modelLab.render(body), 30);
})();

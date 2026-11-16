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
.ml .mute{color:var(--mute);font-size:12px}`; document.head.appendChild(s); }

  async function render(el) {
    el.innerHTML = '<div class="ml"><div class="ml-wrap">' +
      '<h2>🧠 Model Lab</h2><div class="sub">Make a local model stronger at what you care about. Pick a base model, tell it how to behave, set its dials, and add example answers to copy. <b>Build</b> bakes a new model you can choose anywhere in the app. This runs on this PC, no GPU needed, in seconds.</div>' +
      '<div class="row2"><div><label>New model name</label><input id="mlname" value="my-tutor" spellcheck="false"></div><div><label>Based on</label><select id="mlbase"></select></div></div>' +
      '<label>How it should behave (system prompt)</label><textarea id="mlsys" rows="4" spellcheck="false">You are a patient, encouraging tutor. Explain step by step, check understanding, and keep answers short.</textarea>' +
      '<div class="row2"><div><label>Temperature (0 steady – 2 wild)</label><input id="mltemp" type="number" min="0" max="2" step="0.1" value="0.6"></div><div><label>Memory (num_ctx tokens)</label><input id="mlctx" type="number" min="512" step="512" value="8192"></div></div>' +
      '<label>Example answers to copy (optional, the strongest lever)</label><div class="mute">Each pair shows the model a question and the ideal reply. A handful of good ones shapes its style a lot.</div><div id="mlex"></div><button class="ib2" id="mladd" style="margin-top:8px">+ Add example</button>' +
      '<div style="margin:14px 0"><button class="btn" id="mlbuild">⚙ Build the model</button> <span class="mute" id="mlstat"></span></div><div id="mllog"></div>' +
      '<h3 style="margin:18px 0 2px">Your custom models</h3><div class="mute">Built here. Choose them in Chat’s model menu like any other.</div><div id="mllist"></div>' +
      '<div class="card" style="margin-top:16px"><b>Want real fine-tuning?</b><div class="mute" style="margin-top:4px">Your RTX 5050 (8 GB) can train small models with QLoRA, which changes the weights, not just the instructions. That needs a Python and CUDA setup and takes hours per run. Ask and it can be added as a heavier, separate step.</div></div>' +
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
  }
  A.modelLab = { render };
  if (A.studio && A.studio.reg) A.studio.reg('modellab', '🧠 Model Lab', body => A.modelLab.render(body), 30);
})();

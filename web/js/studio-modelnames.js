// Studio > Rename models: give local Ollama models an easier name without changing their model data.
(() => {
  /* A is a global const, which window.A never sees: the old check here kept this section from ever loading */
  if (typeof A === 'undefined' || !A.studio || !A.studio.reg) return;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function render(root) {
    root.innerHTML = '<div class="scroll pad" style="flex:1"><div style="max-width:760px">' +
      '<h2>🏷 Rename local models</h2>' +
      '<p class="small mute">Choose an Ollama model and give it a shorter or clearer name. This keeps it on your PC and updates the app’s default model if it points to the one you rename.</p>' +
      '<div class="card"><label class="small" for="mnSource">Model on this PC</label>' +
      '<select id="mnSource" style="width:100%;margin:4px 0 12px"><option value="">Loading local models…</option></select>' +
      '<label class="small" for="mnDestination">New name</label>' +
      '<input id="mnDestination" maxlength="160" placeholder="for example, my-assistant:latest" style="width:100%;margin:4px 0 6px">' +
      '<div class="small mute">Letters, numbers, dots, dashes, underscores, and an optional tag are supported.</div>' +
      '<div class="row" style="gap:8px;align-items:center;margin-top:12px;flex-wrap:wrap"><button class="pri" id="mnRename" disabled>Rename model</button><button class="ib" id="mnRefresh">Refresh list</button><span id="mnStatus" class="small" role="status" aria-live="polite"></span></div></div>' +
      '<div class="small mute" style="margin-top:8px">Ollama creates the new name first, checks that it appears, then removes the old name. If that last step fails, both names remain available.</div>' +
      '</div></div>';
    const $ = id => root.querySelector('#' + id), source = $('mnSource'), destination = $('mnDestination'), button = $('mnRename'), status = $('mnStatus');
    let models = [];

    const updateButton = () => { button.disabled = !source.value || !destination.value.trim() || button.dataset.busy === '1'; };
    async function load(selectName) {
      status.textContent = 'Checking Ollama…';
      const r = await A.api('/api/models').catch(() => null);
      models = ((r && r.models) || []).filter(m => m && m.name && !m.cloud);
      source.innerHTML = models.length
        ? models.map(m => '<option value="' + esc(m.name) + '">' + esc(m.name) + (m.size ? ' · ' + (m.size >= 107374182 ? (m.size / 1073741824).toFixed(1) + ' GB' : Math.max(1, Math.round(m.size / 1048576)) + ' MB') : '') + '</option>').join('')
        : '<option value="">No local models found</option>';
      if (selectName && models.some(m => m.name === selectName)) source.value = selectName;
      status.textContent = models.length ? 'Ready' : (r && r.ollama === false ? 'Ollama is not running.' : 'No local Ollama models were found.');
      updateButton();
    }

    $('mnRefresh').onclick = () => load(source.value);
    source.onchange = updateButton;
    destination.oninput = updateButton;
    button.onclick = async () => {
      const from = source.value, to = destination.value.trim();
      if (!from || !to) return;
      if (!(await A.confirm('Rename “' + from + '” to “' + to + '”? The old name will be removed after the new one is verified.'))) return;
      button.dataset.busy = '1'; button.textContent = 'Renaming…'; status.textContent = 'Working…'; updateButton();
      const r = await A.api('/api/models/rename', { source: from, destination: to }).catch(e => ({ error: e.message || 'The rename could not be completed.' }));
      button.dataset.busy = '0'; button.textContent = 'Rename model';
      if (r && r.ok) {
        const priorDefault = A.modelOrder && A.modelOrder.get();
        if (priorDefault && A.modelOrder.matches(from, priorDefault)) await A.modelOrder.set(r.defaultModel || '');
        else { if (A.modelOrder && typeof r.defaultModel === 'string') A.modelOrder.sync(r.defaultModel); A.emit('default-model', r.defaultModel || ''); }
        if (A.modelOrder && ls) ['model', 'local_model', 'agentmodel', 'bible_model', 'cmp_ai_model', 'gm_model', 'gd_model'].forEach(k => {
          const saved = ls.get(k, ''); if (saved && A.modelOrder.matches(from, saved)) ls.set(k, r.destination);
        });
        await load(r.destination);
        status.textContent = 'Renamed to ' + r.destination + '.';
        A.toast('Model renamed to ' + r.destination);
      } else {
        /* the list is reloaded first, so its "Ready" does not cover up what went wrong */
        if (r && r.copied) await load(r.destination);
        status.textContent = (r && r.error) || 'The rename could not be completed.';
      }
      updateButton();
    };
    load();
  }

  A.modelNames = { render };
  A.studio.reg('modelnames', '🏷 Rename models', body => render(body), 31.6);
  if (A.cmd && A.cmd.reg) A.cmd.reg([
    { title: 'Rename local Ollama models', sub: 'Give a local model a clearer name in Studio', icon: '🏷', group: 'Studio', tags: 'rename ollama model local', run: () => A.studio.go('modelnames') },
  ]);
})();

// Notes: plain Markdown files in Documents\Assistant Notes, searchable by the assistant.
(() => {
  const root = $('p-notes');
  let list = [], cur = null, saveT = null, dirty = false, preview = false, folder = '';
  root.innerHTML =
    '<div class="split"><div class="side"><div style="padding:8px"><div class="row"><input id="nq" type="text" placeholder="Filter notes..."><button class="pri" id="nnew" title="New note (Ctrl+N when in Notes)">+</button></div></div><div class="list" id="nlist"></div>' +
    '<div class="small mute" style="padding:8px 10px;border-top:1px solid var(--line)" id="nfold"></div></div>' +
    '<div class="main"><div class="row" style="padding:8px 12px;gap:6px;flex-wrap:wrap" id="nbar"></div><textarea id="ne" placeholder="Pick a note on the left or press + to start a new one.&#10;&#10;Tip: write in plain text or Markdown (# headings, - lists, **bold**)."></textarea><div id="npv" class="m a" style="max-width:none;margin:0;border-radius:0"></div></div></div>';
  const ne = $('ne');

  function bar() {
    $('nbar').innerHTML = '<span id="ntitle" class="small mute" style="flex:1;min-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"></span>' +
      '<button class="ib" data-a="pv">' + (preview ? 'Edit' : 'Preview') + '</button><button class="ib" data-a="ai">Ask AI</button><button class="ib" data-a="listen">Listen</button><button class="ib" data-a="cards">Flashcards</button><button class="ib" data-a="open">Open folder</button><button class="ib dang" data-a="del">Delete</button>';
  }
  $('nbar').onclick = e => {
    const b = e.target.closest('[data-a]'); if (!b) return; const a = b.dataset.a;
    if (a === 'pv') { preview = !preview; if (preview) $('npv').innerHTML = md(ne.value); $('npv').style.display = preview ? 'block' : 'none'; ne.style.display = preview ? 'none' : 'block'; bar(); }
    else if (a === 'listen') A.speech.speak(ne.value, b);
    else if (a === 'cards') A.study.fromText(ne.value, cur ? cur.title : 'Note');
    else if (a === 'open') A.api('/api/docs/open', { path: folder });
    else if (a === 'del') del();
    else if (a === 'ai') {
      if (!ne.value.trim()) return A.toast('Write something first');
      const p = A.pop(b, ['Summarize', 'Improve the writing', 'Turn into a checklist', 'Ask a question about this note'].map(x => '<div class="hit"><b>' + x + '</b></div>').join(''));
      p.onclick = ev => {
        const h = ev.target.closest('.hit'); if (!h) return; A.closePop(); const t = h.textContent;
        const P = { Summarize: 'Summarize this note briefly:\n\n', Improve: 'Improve the writing of this note, keeping my meaning and voice. Reply with only the improved text:\n\n', Turn: 'Turn this note into a clear checklist:\n\n' };
        if (t.startsWith('Ask')) { A.showTab('chat'); A.chat.setInput('Using my note "' + (cur ? cur.title : '') + '": '); return; }
        A.chat.ask(P[t.split(' ')[0]] + ne.value, { noLocal: true, sources: [] });
      };
      b.dataset.pop = '1';
    }
  };

  async function refresh(keep) {
    const r = await A.api('/api/notes'); list = r.notes || []; folder = r.folder; $('nfold').textContent = 'Saved in: ' + folder; draw();
    if (!keep && !cur && list[0]) { /* leave empty until the user picks */ }
  }
  function draw() {
    const f = $('nq').value.trim().toLowerCase();
    const items = list.filter(n => !f || (n.title + ' ' + n.snippet).toLowerCase().includes(f));
    $('nlist').innerHTML = '<div id="nlist-virtual" style="height:100%;overflow:auto"></div>';
    A.virtualList($('nlist-virtual'), items, n => '<div class="item' + (cur && cur.id === n.id ? ' cur' : '') + '" data-id="' + A.esc(n.id) + '"><b>' + A.esc(n.title) + '</b><span>' + A.esc(n.snippet || '(empty)') + '</span></div>', { itemHeight: 50 });
    // Re-bind click events
    $('nlist-virtual').onclick = e => { const i = e.target.closest('.item'); if (i) open(i.dataset.id); };
  }
  $('nq').oninput = draw;
  $('nlist').onclick = e => { const i = e.target.closest('.item'); if (i) open(i.dataset.id); };
  $('nnew').onclick = () => blank();

  async function flush() { clearTimeout(saveT); if (!dirty) return; dirty = false; const r = await A.api('/api/notes/save', { id: cur && cur.id, title: cur && cur.title, content: ne.value }); if (r.id) { cur = { id: r.id, title: r.title }; $('ntitle').textContent = r.title; } await refresh(true); }
  async function open(id) {
    await flush(); const n = await A.api('/api/notes/get?id=' + encodeURIComponent(id)); if (n.error) return A.toast('Note not found');
    cur = { id: n.id, title: n.title }; ne.value = n.content; preview = false; $('npv').style.display = 'none'; ne.style.display = 'block'; bar(); $('ntitle').textContent = n.title; draw();
  }
  async function blank() { await flush(); cur = null; ne.value = ''; preview = false; $('npv').style.display = 'none'; ne.style.display = 'block'; bar(); $('ntitle').textContent = 'New note'; ne.focus(); draw(); }
  async function del() {
    if (!cur) return; if (!(await A.confirm('Delete "' + cur.title + '"? This removes the file from your Assistant Notes folder.'))) return;
    await A.api('/api/notes/delete', { id: cur.id }); cur = null; ne.value = ''; dirty = false; $('ntitle').textContent = ''; await refresh(true); A.toast('Note deleted');
  }
  ne.addEventListener('input', () => { dirty = true; $('ntitle').textContent = (cur ? cur.title : 'New note') + '  - saving...'; clearTimeout(saveT); saveT = setTimeout(async () => { await flush(); }, 900); });
  addEventListener('beforeunload', () => { if (dirty) navigator.sendBeacon('/api/notes/save', JSON.stringify({ id: cur && cur.id, title: cur && cur.title, content: ne.value })); });

  A.notes = {
    async create(title, content) {
      await flush(); const r = await A.api('/api/notes/save', { title, content: content.startsWith('#') ? content : '# ' + title + '\n\n' + content });
      await refresh(true); A.showTab('notes'); await open(r.id); A.toast('Saved to Notes');
    },
    async openByPath(p) { await refresh(true); const id = String(p).split(/[\\/]/).pop().replace(/\.[^.]+$/, ''); open(id); },
    open
  };
  A.registerTab('notes', 'Notes', () => { bar(); refresh(true); });
  A.on('newitem', () => { if (A.cur === 'notes') blank(); });
})();

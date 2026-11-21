// Notes: plain Markdown files in Documents\Assistant Notes, searchable by the assistant.
(() => {
  const root = $('p-notes'), collections = A.collectionSelect;
  let list = [], cur = null, saveT = null, dirty = false, preview = false, folder = '', changing = false, saving = Promise.resolve();
  const inertSeen = new Set();
  root.innerHTML =
    '<div class="split"><div class="side"><div style="padding:8px"><div class="row"><input id="nq" type="text" placeholder="Filter notes..."><button class="pri" id="nnew" title="New note (Ctrl+N when in Notes)">+</button></div></div><div id="nselect"></div><div class="list" id="nlist" data-selection-area></div>' +
    '<div class="small mute" style="padding:8px 10px;border-top:1px solid var(--line)" id="nfold"></div></div>' +
    '<div class="main"><div class="row" style="padding:8px 12px;gap:6px;flex-wrap:wrap" id="nbar"></div><div id="npath" class="small mute" style="padding:6px 12px 0;display:flex;gap:6px;align-items:center;overflow:hidden;white-space:nowrap;cursor:pointer" title="Where this note is saved"></div><textarea id="ne" placeholder="Pick a note on the left or press + to start a new one.&#10;&#10;Tip: write in plain text or Markdown (# headings, - lists, **bold**).&#10;&#10;Notes are stored as plain text on this PC. Nothing in a note runs unless you press Run, and Run uses the offline sandbox, so anything a note contains cannot reach this PC."></textarea><div id="npv" class="m a" style="max-width:none;margin:0;border-radius:0"></div></div></div>';
  const ne = $('ne');
  $('nselect').innerHTML = collections.toolbar('<button class="ib dang" data-selection="delete">Delete selected</button>');
  const selection = collections.bind(root, { delete: deleteGroup });
  new MutationObserver(() => selection.update()).observe($('nlist'), { childList: true, subtree: true });
  /* Resizable sidebar/editor divider powered by Split.js */
  try {
    if (typeof window.Split === 'function') {
      const side = root.querySelector('.side'), main = root.querySelector('.main');
      if (side && main) {
        if (!document.getElementById('nsplitcss')) {
          const st = document.createElement('style'); st.id = 'nsplitcss';
          st.textContent = '#p-notes .gutter{background:var(--line);cursor:col-resize;transition:background .15s}#p-notes .gutter:hover{background:var(--acc)}';
          document.head.appendChild(st);
        }
        window.Split([side, main], { sizes: [26, 74], minSize: [180, 260], gutterSize: 5 });
      }
    }
  } catch (e) { }

  /* a note named like a program (hello.py, page.html) runs in the safe terminal, like a file in a normal terminal */
  const runnable = () => !!(cur && A.codeRunner && A.codeRunner.langFor(cur.title || cur.id));
  function bar() {
    $('nbar').innerHTML = '<button type="button" id="ntitle" data-a="rename" class="collection-title" title="Rename note" style="flex:1;min-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"></button>' +
      (runnable() ? '<button class="pri" data-a="run" title="Run this file in the safe terminal sandbox (no network, nothing on this PC is touched)">▶ Run</button>' : '') +
      '<button class="ib" data-a="pv">' + (preview ? 'Edit' : 'Preview') + '</button><button class="ib" data-a="ai">Ask AI</button><button class="ib" data-a="listen">Listen</button><button class="ib" data-a="cards">Flashcards</button><button class="ib" data-a="runfile" title="Run any script or page from this PC in the safe terminal">🖥️ Run a file…</button><button class="ib" data-a="open">Open folder</button><button class="ib dang" data-a="del">Delete</button>';
    $('ntitle').textContent = cur?.title || 'New note'; pathLine();
  }
  /* the exact file this note lives in, shown at the top of the note */
  function pathLine() {
    const el = $('npath'); if (!el) return;
    const p = cur && cur.path;
    el.dataset.path = p || '';
    el.title = p ? 'Click to copy the full path' : 'New notes are saved as Markdown files in this folder';
    el.innerHTML = (p
      ? '<span aria-hidden="true">📄</span><span>Saved as</span><code style="overflow:hidden;text-overflow:ellipsis">' + A.esc(p) + '</code>'
      : '<span aria-hidden="true">📄</span><span>New note — will be saved in</span><code>' + A.esc(folder || 'Assistant Notes') + '</code>') +
      (cur && cur.inert ? '<span class="badge" style="flex-shrink:0" title="This note keeps a name Windows would run (like .bat or .js), so it is stored as plain .txt. Nothing in it can start on this PC; ▶ Run still uses the offline sandbox.">🔒 inert text</span>' : '');
  }
  $('npath').onclick = () => { const p = $('npath').dataset.path; if (p) A.copy(p); };
  const renderPreview = text => {
    const raw = String(text || '');
    const diags = [];
    const mermaids = [];
    const pre = raw.replace(/^```mermaid[^\S\n]*\n([\s\S]*?)^```\s*$/gim, (_, code) => {
      return '\n\n@@MERMAID_' + (mermaids.push(code) - 1) + '@@\n\n';
    }).replace(/```nomnoml\s*\n([\s\S]*?)```/gi, (_, code) => {
      const idx = diags.push(code) - 1;
      return '\n\n@@NOMNOML_' + idx + '@@\n\n';
    });
    let html = md(pre);
    html = html.replace(/@@MERMAID_(\d+)@@/g, (token, i) => mermaids[i] === undefined ? token : '<span data-note-mermaid style="display:block">' + A.esc(mermaids[i]) + '</span>');
    queueMicrotask(() => {
      for (const box of $('npv').querySelectorAll('[data-note-mermaid]')) {
        A.renderNoteDiagram?.(box, box.textContent).catch(e => { box.textContent = e.message; });
      }
    });
    if (diags.length && A.micro && A.micro.renderNomnoml) {
      html = html.replace(/@@NOMNOML_(\d+)@@/g, (_, i) => {
        try { return '<div style="margin:10px 0;padding:10px;border-radius:10px;background:#0a0e17;border:1px solid var(--line);overflow:auto">' + A.micro.renderNomnoml(diags[+i]) + '</div>'; }
        catch (e) { return '<pre class="small">' + A.esc(diags[+i]) + '</pre>'; }
      });
    }
    return A.micro && A.micro.sanitize ? A.micro.sanitize(html) : html;
  };
  $('nbar').onclick = e => {
    const b = e.target.closest('[data-a]'); if (!b) return; const a = b.dataset.a;
    if (a === 'pv') { preview = !preview; if (preview) $('npv').innerHTML = renderPreview(ne.value); $('npv').style.display = preview ? 'block' : 'none'; ne.style.display = preview ? 'none' : 'block'; bar(); }
    else if (a === 'run') {
      if (!A.codeRunner) return;
      if (!cur) return A.toast('Name the note first, like hello.py, and it will save as that file.');
      A.codeRunner.open({ name: cur.title, code: ne.value });
      if (dirty) flush().catch(() => A.toast('The run was fine, but the note could not be saved.'));
    }
    else if (a === 'runfile') { if (A.codeRunner) A.codeRunner.openFile(); }
    else if (a === 'listen') A.speech.speak(ne.value, b);
    else if (a === 'cards') A.study.fromText(ne.value, cur ? cur.title : 'Note');
    else if (a === 'open') A.api('/api/docs/open', { path: folder });
    else if (a === 'del') del();
    else if (a === 'rename') rename(cur?.id);
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
    let order = []; try { order = JSON.parse(ls.get('notes_order', '[]')); } catch (e) { order = []; }
    const rank = new Map(order.map((id, i) => [id, i]));
    const ordered = list.slice().sort((a, b) => (rank.has(a.id) ? rank.get(a.id) : 1e9) - (rank.has(b.id) ? rank.get(b.id) : 1e9));
    const items = ordered.filter(n => !f || (n.title + ' ' + n.snippet).toLowerCase().includes(f));
    const host = $('nlist');
    const item = n => '<div class="item note-list-item' + (cur?.id === n.id ? ' cur' : '') +
      '" tabindex="0" data-id="' + A.esc(n.id) + '" data-select-id="' + A.esc(n.id) + '">' +
      collections.check('Select ' + n.title) + '<div class="note-summary"><b>' + A.esc(n.title) + '</b><span>' +
      A.esc(n.snippet || '(empty)') + '</span></div><button class="collection-icon" data-note-rename title="Rename note" aria-label="Rename note">✎</button>' +
      (!f && items.length <= 200 && typeof window.Sortable === 'function' ?
        '<button class="collection-icon note-sort" data-select-ignore title="Drag to reorder" aria-label="Drag to reorder">⠿</button>' : '') +
      '</div>';
    if (!f && items.length <= 200 && typeof window.Sortable === 'function') {
      host.innerHTML = '<div id="nlist-sort" style="height:100%;overflow:auto">' + items.map(item).join('') + '</div>';
      const box = $('nlist-sort');
      window.Sortable.create(box, {
        handle: '.note-sort', animation: 150,
        onEnd: () => ls.set('notes_order', JSON.stringify([...box.querySelectorAll('.item')].map(el => el.dataset.id)))
      });
    } else {
      host.innerHTML = '<div id="nlist-virtual" style="height:100%;overflow:auto"></div>';
      A.virtualList($('nlist-virtual'), items, item, { itemHeight: 54 });
    }
    selection.sync(items.map(n => n.id));
  }
  $('nq').oninput = draw;
  $('nlist').onclick = e => {
    const item = e.target.closest('.item');
    if (!item || e.target.closest('.note-sort')) return;
    if (e.target.closest('[data-note-rename]')) rename(item.dataset.id);
    else open(item.dataset.id);
  };
  $('nlist').onkeydown = e => {
    if (e.key === 'Enter' && e.target.matches('.item')) e.target.click();
  };
  $('nnew').onclick = () => blank();

  async function flush() {
    clearTimeout(saveT);
    await saving;
    if (!dirty) return;
    const content = ne.value;
    dirty = false;
    saving = (async () => {
      try {
        const r = await A.api('/api/notes/save', { id: cur?.id, title: cur?.title, content });
        if (!r.id) throw new Error(r.error);
        cur = { id: r.id, title: r.title, path: r.path, inert: !!r.inert };
        $('ntitle').textContent = r.title; pathLine();
        if (r.inert && !inertSeen.has(r.id)) { inertSeen.add(r.id); A.toast('Saved as inert text (.txt): nothing in this note can run on this PC.'); }
        await refresh(true);
      } catch (error) {
        dirty = true;
        throw error;
      }
    })();
    try { await saving; } finally { saving = Promise.resolve(); }
  }
  function showNote(note) {
    cur = note ? { id: note.id, title: note.title, path: note.path, inert: !!note.inert } : null;
    ne.value = note?.content || '';
    preview = false;
    $('npv').style.display = 'none';
    ne.style.display = 'block';
    bar();
    draw();
  }
  async function changeEditor(work) {
    if (changing) return;
    changing = ne.readOnly = true;
    try { await flush(); return await work(); }
    catch (error) { A.toast(error.message || 'Could not update your notes.'); }
    finally { changing = ne.readOnly = false; }
  }
  async function open(id) {
    return changeEditor(async () => {
      const n = await A.api('/api/notes/get?id=' + encodeURIComponent(id));
      if (!n.id) throw new Error(n.error || 'Note not found');
      showNote(n);
    });
  }
  async function blank() {
    return changeEditor(() => { showNote(null); ne.focus(); });
  }
  async function rename(id) {
    const note = list.find(n => n.id === id) || (cur?.id === id ? cur : null);
    if (!note) return;
    const title = await A.prompt('Note title', note.title, { title: 'Rename note' });
    if (!title?.trim() || title.trim() === note.title) return;
    return changeEditor(async () => {
      const r = await A.api('/api/notes/rename', { id, title });
      if (!r.id) throw new Error(r.error || 'Could not rename the note.');
      if (cur?.id === id) {
        cur = { id: r.id, title: r.title, path: r.path, inert: !!r.inert };
        ne.value = r.content;
        if (preview) $('npv').innerHTML = renderPreview(ne.value);
        bar();
      }
      await refresh(true);
    });
  }
  async function deleteGroup(ids) {
    const message = ids.length === 1 ? 'Delete this note from your Assistant Notes folder?' : 'Delete ' + ids.length + ' selected notes from your Assistant Notes folder?';
    if (!(await A.confirm(message, { title: 'Delete notes', okLabel: 'Delete', danger: true }))) return;
    return changeEditor(async () => {
      const done = await collections.each(ids, id => A.api('/api/notes/delete', { id }));
      if (cur && done.includes(cur.id)) showNote(null);
      await refresh(true);
      return done;
    });
  }
  async function del() { if (cur) await deleteGroup([cur.id]); }
  ne.addEventListener('input', () => { dirty = true; $('ntitle').textContent = (cur ? cur.title : 'New note') + '  - saving...'; clearTimeout(saveT); saveT = setTimeout(() => flush().catch(error => A.toast(error.message || 'Could not save the note.')), 900); });
  addEventListener('beforeunload', () => { if (dirty) navigator.sendBeacon('/api/notes/save', JSON.stringify({ id: cur && cur.id, title: cur && cur.title, content: ne.value })); });

  A.notes = {
    async create(title, content) {
      await flush(); const r = await A.api('/api/notes/save', { title, content: content.startsWith('#') ? content : '# ' + title + '\n\n' + content });
      await refresh(true); A.showTab('notes'); await open(r.id);
      A.toast(r.inert ? 'Saved to Notes as inert text (.txt): it cannot run on this PC.' : 'Saved to Notes');
    },
    async openByPath(p) {
      await refresh(true);
      const f = String(p).split(/[\\/]/).pop();
      open(A.codeRunner && A.codeRunner.isCodeName(f) ? f : f.replace(/\.[^.]+$/, ''));
    },
    open
  };
  A.registerTab('notes', 'Notes', () => { bar(); refresh(true); });
  A.on('newitem', () => { if (A.cur === 'notes') blank(); });
})();

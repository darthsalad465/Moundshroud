// My Files: pick folders once, then search or ask questions across everything inside (PDF, Word, PowerPoint, Excel, text, web pages).
(() => {
  const root = $('p-files');
  let pollT = null, lastQ = '';
  root.innerHTML =
    '<div class="scroll pad" style="flex:1"><h2>Ask your own documents</h2>' +
    '<div class="mute small">Choose folders and the assistant reads them privately on this PC. Then search here, or just ask in Chat with "Use my files" ticked - answers will show which file and page they came from.</div>' +
    '<div class="card" style="margin-top:10px"><div class="row"><b>Folders</b><span class="sp"></span><button class="ib" id="fadd">+ Add folder</button><button class="ib" id="fre">Re-scan now</button></div><div id="fsrc"></div><div id="fprog" style="margin-top:8px"></div></div>' +
    '<div class="row"><input id="fq" type="text" placeholder="Search your files and notes..."><button class="pri" id="fgo">Search</button></div>' +
    '<div id="fres" style="margin-top:10px"></div></div>';

  async function load() {
    const r = await A.api('/api/docs/sources'); const s = r.sources || [], st = r.stats || {}, p = r.status || {};
    $('fsrc').innerHTML = (s.length ? s.map(x => '<div class="row" style="padding:5px 0;border-top:1px solid var(--line)"><span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="' + esc(x) + '">' + esc(x) + '</span><span class="ib dang" data-rm="' + esc(x) + '" style="cursor:pointer;padding:0 8px">Remove</span></div>').join('') : '<div class="mute small" style="padding:8px 0">No folders yet. Click "+ Add folder" and pick one, for example Documents.</div>') +
      '<div class="small mute" style="margin-top:6px">' + st.files + ' files readable &middot; ' + st.chunks + ' passages &middot; ' + st.notes + ' notes</div>';
    prog(p); return p;
  }
  function prog(p) {
    const el = $('fprog');
    if (p.running) { const pc = p.total ? Math.round(p.done / p.total * 100) : 0; el.innerHTML = '<div class="small">Reading files... ' + p.done + ' / ' + p.total + ' <span class="mute">' + esc(p.current || '') + '</span></div><div class="bar" style="margin:4px 0"><i style="width:' + pc + '%"></i></div><span class="ib" id="fcan" style="cursor:pointer;padding:0 8px">Cancel</span>'; $('fcan').onclick = () => A.api('/api/docs/cancel', {}); }
    else if (p.finishedAt) el.innerHTML = '<div class="small mute">Last scan: ' + A.fmtAgo(p.finishedAt) + ' &middot; ' + p.added + ' new/changed' + (p.errors ? ' &middot; <span class="warn">' + p.errors + ' unreadable (' + esc(p.lastError) + ')</span>' : '') + '</div>';
    else el.innerHTML = '';
  }
  function poll() { clearInterval(pollT); pollT = setInterval(async () => { const p = await load(); if (!p.running) { clearInterval(pollT); pollT = null; if (lastQ) search(lastQ); } }, 1000); }
  async function scan() { await A.api('/api/docs/reindex', {}); await load(); poll(); }

  $('fadd').onclick = async () => {
    A.toast('Choose a folder in the window that opens...', 3000);
    const r = await A.api('/api/pick-folder', {}); if (!r.path) return;
    await A.api('/api/docs/sources', { add: r.path }); await load(); scan();
  };
  $('fre').onclick = scan;
  $('fsrc').onclick = async e => { const x = e.target.closest('[data-rm]'); if (!x) return; if (!confirm('Stop searching this folder? Your files are not touched.')) return; await A.api('/api/docs/sources', { remove: x.dataset.rm }); load(); };

  async function search(term) {
    term = term.trim(); if (!term) return; lastQ = term;
    const r = await A.api('/api/docs/search', { q: term, n: 14 }); const res = r.results || [];
    $('fres').innerHTML = res.length ? res.map((x, i) => '<div class="card hit" data-i="' + i + '"><b>' + esc(x.title) + (x.page ? ' <span class="badge">page ' + x.page + '</span>' : '') + (x.kind === 'note' ? ' <span class="badge">note</span>' : '') + '</b><span style="white-space:normal">' + (x.snippet || '').replace(/&/g, '&amp;').replace(/<(?!\/?mark>)/g, '&lt;') + '</span><span class="small" style="margin-top:3px">' + esc(x.path) + '</span></div>').join('') : '<div class="mute">Nothing found. Try different words, or add the folder that holds it.</div>';
    $('fres').onclick = e => { const h = e.target.closest('.hit'); if (!h) return; const x = res[+h.dataset.i]; if (x.kind === 'note') { A.showTab('notes'); A.notes.openByPath(x.path); } else A.viewer.open({ path: x.path, title: x.title, page: x.page, text: x.text }, lastQ); };
  }
  $('fgo').onclick = () => search($('fq').value);
  $('fq').addEventListener('keydown', e => { if (e.key === 'Enter') search($('fq').value); });

  A.files = { search: t => { A.showTab('files'); $('fq').value = t; search(t); } };
  A.registerTab('files', 'My Files', async () => { const p = await load(); if (p.running) poll(); });
})();

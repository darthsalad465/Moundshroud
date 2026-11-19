// My Files: pick folders once, then search or ask questions across everything inside (PDF, Word, PowerPoint, Excel, text, web pages).
(() => {
  const root = $('p-files');
  let pollT = null, lastQ = '';
  root.innerHTML =
    '<div class="scroll pad" style="flex:1"><h2>Ask your own documents</h2>' +
    '<div class="mute small">Choose folders and the assistant reads them privately on this PC. Then search here, or just ask in Chat with "Use my files" ticked - answers will show which file and page they came from.</div>' +
    '<div class="card" style="margin-top:10px"><div class="row"><b>Folders</b><span class="sp"></span><button class="ib" id="fadd">+ Add folder</button><button class="ib" id="fre">Re-scan now</button></div><div id="fsrc"></div><div id="fprog" style="margin-top:8px"></div></div>' +
    '<div class="card"><b>Better search</b> <span class="small mute">find the right page even when you use your own words</span><div id="fvec" class="small" style="margin-top:6px"></div></div>' +
    '<div class="card"><b>Websites</b> <span class="small mute">read a site once, then ask about it with the internet off</span>' +
    '<div class="row" style="gap:8px;margin-top:8px;flex-wrap:wrap"><input id="fwurl" type="text" placeholder="https://example.com/docs" style="flex:2;min-width:220px"><select id="fwp"><option value="15">15 pages</option><option value="30" selected>30 pages</option><option value="60">60 pages</option><option value="120">120 pages</option></select><button class="pri" id="fwgo">Read it</button></div>' +
    '<div class="small mute" style="margin-top:6px">It follows links on the same site only, slowly and politely, and obeys robots.txt. Pages are saved as Markdown in Moundshroud\'s own folder and indexed like any other file.</div><div class="small" id="fwst" style="margin-top:8px"></div><div id="fwsites" class="small" style="margin-top:6px"></div></div>' +
    '<div class="card"><div class="row"><b style="flex:1">Reference libraries</b><span class="small mute" id="frnote"></span></div>' +
    '<div class="small mute">Security research repositories from GitHub. Download one and every page in it is indexed for your own questions, offline afterwards. Nothing is downloaded unless you press the button.</div><div id="frefs" style="margin-top:8px"></div></div>' +
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
  $('fsrc').onclick = async e => { const x = e.target.closest('[data-rm]'); if (!x) return; if (!(await A.confirm('Stop searching this folder? Your files are not touched.'))) return; await A.api('/api/docs/sources', { remove: x.dataset.rm }); load(); };

  async function search(term) {
    term = term.trim(); if (!term) return; lastQ = term;
    const r = await A.api('/api/docs/search', { q: term, n: 14 }); const res = r.results || [];
    $('fres').innerHTML = res.length ? res.map((x, i) => '<div class="card hit" data-i="' + i + '"><b>' + esc(x.title) + (x.page ? ' <span class="badge">page ' + x.page + '</span>' : '') + (x.kind === 'note' ? ' <span class="badge">note</span>' : '') + '</b><span style="white-space:normal">' + (x.snippet || '').replace(/&/g, '&amp;').replace(/<(?!\/?mark>)/g, '&lt;') + '</span><span class="small" style="margin-top:3px">' + esc(x.path) + '</span></div>').join('') : '<div class="mute">Nothing found. Try different words, or add the folder that holds it.</div>';
    $('fres').onclick = e => { const h = e.target.closest('.hit'); if (!h) return; const x = res[+h.dataset.i]; if (x.kind === 'note') { A.showTab('notes'); A.notes.openByPath(x.path); } else A.viewer.open({ path: x.path, title: x.title, page: x.page, text: x.text }, lastQ); };
  }
  $('fgo').onclick = () => search($('fq').value);
  $('fq').addEventListener('keydown', e => { if (e.key === 'Enter') search($('fq').value); });

  /* ---------- websites: read a site into the index ---------- */
  let wPoll = null;
  const kb = n => n >= 1073741824 ? (n / 1073741824).toFixed(1) + ' GB' : n >= 1048576 ? Math.round(n / 1048576) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB';
  async function sites() {
    const r = await A.api('/api/web/pages').catch(() => ({ sites: [], status: {} }));
    const st = r.status || {}, box = $('fwsites'); if (!box) return st;
    box.innerHTML = (r.sites || []).length ? (r.sites || []).map(s => '<div class="row" style="padding:4px 0;border-top:1px solid var(--line)"><span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">🌐 ' + esc(s.host) + ' <span class="mute">' + s.pages + ' pages &middot; ' + kb(s.bytes) + '</span></span><span class="ib dang" data-wrm="' + esc(s.host) + '" style="cursor:pointer;padding:0 8px">Remove</span></div>').join('') : '<div class="mute" style="padding:4px 0">No sites saved yet.</div>';
    const w = $('fwst');
    if (st.running) { w.innerHTML = 'Reading <b>' + esc(st.host || st.url) + '</b>… <span class="mute">' + st.saved + ' saved</span>'; if (!wPoll) wPoll = setInterval(() => sites(), 1200); }
    else { if (wPoll) { clearInterval(wPoll); wPoll = null; } if (st.error) w.innerHTML = '<span class="warn">' + esc(st.error) + '</span>'; else if (st.finishedAt) w.innerHTML = '<span class="mute">Last read: ' + esc(st.host || '') + ' &middot; ' + st.saved + ' pages saved ' + A.fmtAgo(st.finishedAt) + ' &middot; it is in the index now</span>'; }
    return st;
  }
  $('fwgo').onclick = async () => {
    const u = $('fwurl').value.trim(); if (!u) return A.toast('Type a web address first.');
    const r = await A.api('/api/web/crawl', { url: u, pages: +$('fwp').value });
    if (r.error) return A.toast(r.error, 6000);
    $('fwst').textContent = 'Starting…'; sites(); poll();
  };
  $('fwsites').onclick = async e => {
    const b = e.target.closest('[data-wrm]'); if (!b) return;
    if (!(await A.confirm('Remove the saved pages from ' + b.dataset.wrm + '? The website itself is not touched.'))) return;
    await A.api('/api/web/remove', { host: b.dataset.wrm }); sites(); sleep(() => load(), 400);
  };
  const sleep = (fn, ms) => setTimeout(fn, ms);

  /* ---------- search quality: local embeddings ---------- */
  let vPoll = null;
  async function vector() {
    const r = await A.api('/api/docs/embed').catch(() => null);
    const box = $('fvec'); if (!box) return;
    if (!r) { box.textContent = 'Could not read the search settings.'; return; }
    const j = r.job || {}, s = r.scan || {};
    let h = '';
    if (j.running) h = '<div>Downloading <b>' + esc(j.model || r.preferred) + '</b>… ' + j.pct + '% <span class="mute">' + esc(j.said || '') + '</span></div><div class="bar" style="margin:4px 0"><i style="width:' + j.pct + '%"></i></div>';
    else if (!r.model) {
      h += '<div>No embedding model on this PC yet. One download (about 275 MB) lets search understand meaning instead of only matching words; after that it runs offline.</div>' +
        '<div class="row" style="margin-top:6px"><button class="pri" id="fvecget">Download ' + esc(r.preferred || 'nomic-embed-text') + '</button><span class="small mute">Only needed once.</span></div>';
      if (j.error) h += '<div class="small warn" style="margin-top:4px">' + esc(j.error) + '</div>';
    } else {
      h += '<div><b>' + esc(r.model) + '</b> is ready &middot; <span class="mute">' + r.vectors + ' passages as vectors</span></div>';
      if (s.running) h += '<div class="small" style="margin-top:4px">Converting ' + s.done + ' / ' + s.total + ' passages…</div><div class="bar" style="margin:4px 0"><i style="width:' + (s.total ? Math.round(s.done / s.total * 100) : 0) + '%"></i></div>';
      else {
        if (s.error) h += '<div class="small warn" style="margin-top:4px">' + esc(s.error) + '</div>';
        h += '<div class="row" style="margin-top:6px"><button class="ib" id="fvecbuild">' + (r.vectors ? 'Re-index the vectors' : 'Build the search index') + '</button><span class="small mute">' + (r.vectors ? 'Run this after adding files, sites or repositories.' : 'Takes a few minutes for a big index.') + '</span></div>';
        if (s.finishedAt) h += '<div class="small mute" style="margin-top:4px">Last run ' + A.fmtAgo(s.finishedAt) + ' &middot; ' + s.added + ' new passages</div>';
      }
    }
    box.innerHTML = h;
    const get = $('fvecget');
    if (get) get.onclick = async () => { get.disabled = true; get.textContent = 'Starting…'; const rr = await A.api('/api/docs/embed/pull', { model: r.preferred || 'nomic-embed-text' }); if (rr.error) { A.toast(rr.error, 6000); get.disabled = false; return; } vector(); };
    const bu = $('fvecbuild');
    if (bu) bu.onclick = async () => { bu.disabled = true; bu.textContent = 'Working…'; await A.api('/api/docs/embed/build', {}); vector(); };
    if (j.running || s.running) { if (!vPoll) vPoll = setInterval(vector, 1500); }
    else if (vPoll) { clearInterval(vPoll); vPoll = null; }
  }

  /* ---------- reference libraries from GitHub ---------- */
  let rPoll = null, refsCache = [];
  /* every repository is checked for dangerous files as soon as it is downloaded (lib/safety.js) */
  function safeLine(x) {
    const s = x.safety || {};
    if (s.checking) return '<div class="small mute" style="margin-top:2px">🛡 checking what is inside…</div>';
    if (!s.level) return '<div class="small mute" style="margin-top:2px">🛡 not checked yet</div>';
    const c = s.counts || {};
    const t = s.level === 'danger' ? '⛔ ' + c.danger + ' serious finding' + (c.danger === 1 ? '' : 's') + ' - open 🛡 to see them'
      : s.level === 'warn' ? '⚠️ ' + c.warn + ' thing' + (c.warn === 1 ? '' : 's') + ' to look at'
        : '✅ checked, nothing risky stood out';
    return '<div class="small" style="margin-top:2px">🛡 ' + t + (s.at ? ' · ' + A.fmtAgo(s.at) : '') + '</div>';
  }
  function safeFindings(name, s, busy) {
    const F = (s && s.findings) || [];
    const ic = l => l === 'danger' ? '⛔' : l === 'warn' ? '⚠️' : 'ℹ️';
    A.dlg('<div class="hd"><b>🛡 ' + esc(name) + '</b></div><div class="bd">' +
      '<div class="small mute" style="margin-bottom:8px">' + (busy ? 'Reading the files…' : F.length ? F.length + ' thing(s) worth knowing, in the files inside this repository. Nothing here was run: the files were only read.' : 'Nothing risky stood out in the files inside this repository.') + '</div>' +
      F.slice(0, 60).map(f => '<div class="card" style="margin-bottom:6px;padding:8px"><div class="row" style="gap:8px;flex-wrap:wrap"><span>' + ic(f.level) + '</span><b style="flex:1;min-width:160px;word-break:break-all">' + esc(f.file) + (f.line ? ' · line ' + f.line : '') + '</b><span class="small mute">' + esc(f.rule) + '</span></div><div class="small" style="margin-top:2px">' + esc(f.why) + '</div>' + (f.snippet ? '<div class="small mute" style="font-family:monospace;word-break:break-all">' + esc(f.snippet) + '</div>' : '') + '</div>').join('') +
      '<div class="small mute" style="margin-top:6px">Reference libraries are full of attack technique notes on purpose, so ⚠️ here is normal. ⛔ means a file that looks like a program or a hidden command: look before opening it.</div>' +
      '<div class="row" style="margin-top:10px"><span class="sp"></span><button class="ib" id="sfclose">Close</button></div></div>');
    const c = document.getElementById('sfclose'); if (c) c.onclick = () => A.closeDlg();
  }
  async function loadRefs() {
    const r = await A.api('/api/refs').catch(() => ({ refs: [] }));
    const box = $('frefs'); if (!box) return;
    const list = r.refs || [], busy = list.some(x => x.job && (x.job.state === 'running' || x.job.state === 'refreshing'));
    refsCache = list;
    box.innerHTML = list.map(x => '<div class="row" style="padding:8px 0;border-top:1px solid var(--line);align-items:flex-start;gap:10px"><div style="flex:1;min-width:0"><b>' + esc(x.name) + '</b> <span class="small mute">' + [x.size, x.lic, x.installed && x.files + ' files on this PC'].filter(Boolean).join(' · ') + '</span><div class="small mute" style="margin-top:2px">' + esc(x.about) + '</div>' + safeLine(x) +
      (x.job && (x.job.state === 'running' || x.job.state === 'refreshing') ? '<div class="small" style="margin-top:4px">' + (x.job.state === 'refreshing' ? 'Refreshing' : 'Downloading') + '… ' + x.job.pct + '% <span class="mute">' + esc(x.job.said || '') + '</span></div>' : x.job && x.job.state === 'failed' ? '<div class="small warn" style="margin-top:4px">' + esc(x.job.said || 'Download failed.') + '</div>' : '') + '</div>' +
      (x.installed ? '<button class="ib" data-rsf="' + esc(x.slug) + '" title="Check what is inside these files">🛡' + (x.safety && x.safety.level ? ' ' + (x.safety.level === 'danger' ? '⛔' : x.safety.level === 'warn' ? '⚠️' : '✅') : '') + '</button> <button class="ib" data-rrf="' + esc(x.slug) + '"' + (busy ? ' disabled' : '') + '>Refresh</button> <button class="ib dang" data-rrm="' + esc(x.slug) + '">Remove</button>' : '<button class="pri" data-rgo="' + esc(x.slug) + '"' + (busy ? ' disabled' : '') + '>Download &amp; index</button>') + '</div>').join('');
    if (busy && !rPoll) rPoll = setInterval(loadRefs, 1500);
    if (!busy && rPoll) { clearInterval(rPoll); rPoll = null; }
  }
  $('frefs').onclick = async e => {
    const go = e.target.closest('[data-rgo]'), rm = e.target.closest('[data-rrm]'), rf = e.target.closest('[data-rrf]'), sf = e.target.closest('[data-rsf]');
    if (sf) {
      const it = (refsCache || []).find(x => x.slug === sf.dataset.rsf) || { name: sf.dataset.rsf };
      safeFindings(it.name, (it.safety || {}), true);
      let r = null; try { r = await A.api('/api/refs/check', { slug: sf.dataset.rsf }); } catch (e) { }
      if (!r || r.error) { A.toast((r && r.error) || 'The check did not finish.', 6000); A.closeDlg(); return loadRefs(); }
      loadRefs(); safeFindings(it.name, r.safety || {}, false);
    } else if (rf) {
      const r = await A.api('/api/refs/update', { slug: rf.dataset.rrf });
      if (r.error) return A.toast(r.error, 6000);
      loadRefs();
    } else if (go) {
      go.disabled = true; go.textContent = 'Starting…';
      const r = await A.api('/api/refs/install', { slug: go.dataset.rgo });
      if (r.error) { A.toast(r.error, 7000); go.disabled = false; go.textContent = 'Download & index'; return; }
      loadRefs();
    } else if (rm) {
      if (!(await A.confirm('Delete this library from this PC? You can download it again later.'))) return;
      await A.api('/api/refs/remove', { slug: rm.dataset.rrm }); loadRefs(); load();
    }
  };

  A.files = { search: t => { A.showTab('files'); $('fq').value = t; search(t); } };
  A.registerTab('files', 'My Files', async () => { const p = await load(); if (p.running) poll(); vector(); sites(); loadRefs(); });
})();

// Edit the app: a VS Code style page for changing Moundshroud's own files without leaving Moundshroud. A folder tree on
// the left, open files as tabs at the top, and the full editor (web/js/code-ed.js) in the middle: syntax colouring, line
// numbers, find & replace (Ctrl+F / Ctrl+H), the command palette (Ctrl+Shift+P), Go to line (Ctrl+G) and a
// status bar with the line and column. Saving keeps the previous version first, and JavaScript is syntax-checked before
// it is written, so a missing bracket is caught at the moment of saving instead of at the next reload. History (↩) puts
// an older version back. Everything under web\ shows after a reload; lib\ and server.js need the app restarted.
// The server decides what may be touched at all (lib/appedit.js): the app's own source folders, nothing else.
(() => {
  const root = document.getElementById('p-appedit'); if (!root) return;
  const $ = s => root.querySelector(s);
  const big = n => n >= 1048576 ? (n / 1048576).toFixed(1) + ' MB' : n >= 1024 ? Math.round(n / 1024) + ' KB' : n + ' B';
  let path = '', search = '', busy = false, filesCur = { dirs: [], files: [] };
  /* open files, VS Code style: a tab each, the unsaved ones marked */
  let tabs = [], activeId = null;
  const tab = id => tabs.find(t => t.id === id) || null;
  const curTab = () => tab(activeId);
  const anyDirty = () => tabs.some(t => t.dirty);

  function shell() {
    root.innerHTML =
      '<div class="rd-top"><h2>✏️ Edit the app</h2><div class="sp" style="flex:1"></div>' +
      '<button class="ib" id="aeeverywhere" title="Find a word anywhere in the app">🔎 Find in every file</button>' +
      '<button class="ib" id="aechanged" title="Files you have changed here, with a way back">✏️ Files you changed</button>' +
      '<button class="ib" id="aereload" title="Reload the page (picks up anything changed under web)">⟳ Reload the page</button></div>' +
      '<div class="rd-banner" style="margin:0 0 8px">🛡 <b>You are editing Moundshroud itself.</b><span class="small" style="flex:1;min-width:200px">Every save keeps the previous version first, JavaScript is checked before it is written, and ↩ History puts an older version back. Files under <b>web/</b> show after a reload; <b>lib/</b> and <b>server.js</b> need the app restarted.</span></div>' +
      '<div class="ae-split"><div class="ae-side"><input id="aeq" type="search" placeholder="Filter the files here…" autocomplete="off"><div class="ae-path" id="aepath"></div><div class="scroll" id="aefiles"></div></div>' +
      '<div class="ae-main"><div class="ae-head"><b id="aename">Pick a file on the left</b><span class="small mute" id="aemeta"></span><span style="flex:1"></span>' +
      '<button class="ib" id="aehist" title="Older versions of this file">↩ History</button><button class="ib" id="aecheck" title="Check the JavaScript without saving">✓ Check</button><button class="pri" id="aesave" title="Save (Ctrl+S)">💾 Save</button></div>' +
      '<div class="small" id="aemsg"></div>' +
      '<div class="ce-tabs" id="aetabs"></div>' +
      '<textarea id="aeta" data-code data-save="aesave" spellcheck="false" placeholder="Open a file on the left. Nothing here is saved until you press 💾 Save."></textarea>' +
      '<div class="small mute" id="aehint" style="margin-top:6px">Ctrl+S saves · Ctrl+F finds · Ctrl+H replaces · Ctrl+Shift+P opens the command palette · Ctrl+G goes to a line · Ctrl+W closes the tab · Ctrl+/ comments. A save that would break the JavaScript is refused and the reason is shown above.</div></div></div>';
    $('#aeq').addEventListener('input', e => { search = e.target.value.trim().toLowerCase(); drawFiles(); });
    $('#aechanged').onclick = changedFiles;
    $('#aereload').onclick = () => { if (anyDirty() && !confirm('Discard the unsaved changes and reload the page?')) return; location.reload(); };
    $('#aeeverywhere').onclick = findEverywhere;
    $('#aesave').onclick = save;
    $('#aecheck').onclick = checkNow;
    $('#aehist').onclick = history;
    const ta = $('#aeta');
    ta.addEventListener('input', () => {
      const t = curTab(); if (!t) return;
      t.dirty = ta.value !== t.orig;
      if (t.dirty) t.text = ta.value;
      mark(); $('#aemsg').textContent = '';
    });
    bar = window.CodeEd ? CodeEd.tabbar($('#aetabs'), { onselect: activate, onclose: closeTab }) : null;
    ta.addEventListener('keydown', e => {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === 'w') { e.preventDefault(); if (activeId) closeTab(activeId); }
      else if (mod && e.key === 'Tab' && tabs.length > 1) {
        e.preventDefault(); const i = tabs.findIndex(t => t.id === activeId);
        activate(tabs[(i + (e.shiftKey ? -1 : 1) + tabs.length) % tabs.length].id);
      }
    });
    window.addEventListener('beforeunload', e => { if (anyDirty()) { e.preventDefault(); e.returnValue = ''; } });
  }
  let bar = null;
  const ed = () => window.CodeEd && window.CodeEd.of($('#aeta'));

  function drawTabs() {
    if (!bar) return;
    bar.render(tabs.map(t => ({ id: t.id, name: t.name, dirty: t.dirty, title: t.id, icon: icon(t.id) })), activeId);
  }
  const icon = rel => /\.js$|\.mjs$/.test(rel) ? '🟨' : /\.css$/.test(rel) ? '🎨' : /\.html?$/.test(rel) ? '🌐' : /\.json$/.test(rel) ? '{}' : /\.md$/.test(rel) ? '📄' : '📃';

  function mark() {
    const b = $('#aename'), t = curTab();
    if (b) b.textContent = t ? t.id + (t.dirty ? ' •' : '') : 'Pick a file on the left';
    const ta = $('#aeta'), m = $('#aemeta');
    if (m) m.textContent = t ? ta.value.split('\n').length + ' lines · ' + big(new Blob([ta.value]).size) + (t.dirty ? ' · not saved yet' : '') : '';
    drawTabs();
  }

  async function loadDir(dir) {
    const r = await A.api('/api/appedit/list?dir=' + encodeURIComponent(dir || '')).catch(() => null);
    if (!r || r.error) { A.toast((r && r.error) || 'That folder could not be opened.', 6000); return; }
    path = r.dir || '';
    const parts = path ? path.split('/') : [];
    $('#aepath').innerHTML = '<button class="ib" data-dir="">app</button>' + parts.map((p, i) => {
      const d = parts.slice(0, i + 1).join('/');
      return '<span class="mute">›</span><button class="ib" data-dir="' + esc(d) + '">' + esc(p) + '</button>';
    }).join('');
    $('#aepath').onclick = e => { const b = e.target.closest('[data-dir]'); if (b) loadDir(b.dataset.dir); };
    filesCur = { dirs: r.dirs || [], files: r.files || [] };
    drawFiles();
  }
  function drawFiles() {
    const box = $('#aefiles'); if (!box) return;
    const f = search;
    const dirs = filesCur.dirs.filter(d => !f || d.toLowerCase().includes(f));
    const files = filesCur.files.filter(x => !f || x.rel.toLowerCase().includes(f));
    let h = '';
    if (dirs.length) h += '<div class="ae-dirs">' + dirs.map(d => '<button class="ae-dir" data-dir="' + esc(d) + '">📁 ' + esc(d.split('/').pop()) + '</button>').join('') + '</div>';
    h += files.length ? files.map(x => '<div class="ae-file' + (activeId === x.rel ? ' on' : '') + (tab(x.rel) ? ' open' : '') + '" data-file="' + esc(x.rel) + '" title="' + esc(x.rel) + '"><span>' + esc(x.name) + '</span><span class="small mute">' + big(x.size) + '</span></div>').join('') : '<div class="small mute" style="padding:8px">Nothing here' + (f ? ' matches “' + esc(f) + '”' : '') + '.</div>';
    box.innerHTML = h;
    box.onclick = e => {
      const d = e.target.closest('[data-dir]'); if (d) return loadDir(d.dataset.dir);
      const fl = e.target.closest('[data-file]'); if (fl) return open(fl.dataset.file);
    };
    mark();
  }

  function activate(id) {
    const t = tab(id); if (!t) return;
    const ta = $('#aeta');
    const cur = curTab();
    if (cur) { cur.sel = [ta.selectionStart, ta.selectionEnd]; cur.scroll = ta.scrollTop; }
    activeId = id;
    ta.value = t.text;
    ta.setSelectionRange(0, 0);
    ta.scrollTop = t.scroll || 0;
    const e = ed(); if (e) { e.setName(t.id); e.refresh(); }
    $('#aemsg').textContent = '';
    mark(); syncSide();
  }
  function closeTab(id) {
    const i = tabs.findIndex(t => t.id === id); if (i < 0) return;
    if (tabs[i].dirty && !confirm('“' + tabs[i].name + '” has unsaved changes. Close it and lose them?')) return;
    tabs.splice(i, 1);
    if (activeId === id) {
      const next = tabs[i] || tabs[i - 1] || null;
      if (next) return activate(next.id);
      activeId = null; const ta = $('#aeta'); ta.value = ''; const e = ed(); if (e) { e.setName(''); e.refresh(); }
      $('#aemsg').textContent = '';
    }
    mark(); syncSide();
  }
  function syncSide() {
    root.querySelectorAll('#aefiles .ae-file').forEach(el => {
      el.classList.toggle('on', el.dataset.file === activeId);
      el.classList.toggle('open', !!tab(el.dataset.file));
    });
  }

  async function open(rel) {
    if (tab(rel)) return activate(rel);
    const r = await A.api('/api/appedit/read', { path: rel }).catch(() => null);
    if (!r || r.error) { A.toast((r && r.error) || 'That file could not be opened.', 6000); return; }
    tabs.push({ id: r.rel, name: r.rel.split('/').pop(), text: r.text, orig: r.text, dirty: false, scroll: 0 });
    activate(r.rel);
  }

  async function save() {
    const t = curTab(); if (!t || busy) return;
    const ta = $('#aeta'), msg = $('#aemsg');
    busy = true; msg.className = 'small'; msg.textContent = 'Saving…';
    const r = await A.api('/api/appedit/save', { path: t.id, text: ta.value }).catch(() => null);
    busy = false;
    if (!r) { msg.className = 'small rd-bad'; msg.textContent = 'The save did not go through.'; return; }
    if (r.error) { msg.className = 'small rd-bad'; msg.textContent = 'Not saved: ' + r.error; return; }
    t.orig = ta.value; t.text = ta.value; t.dirty = false; mark(); loadDir(path);
    msg.className = 'small';
    msg.textContent = 'Saved' + (r.hadBackup ? '. The version before this one is in ↩ History.' : '.') +
      (r.needsRestart ? ' This file is part of the server: close Moundshroud and open it again to see the change.' : ' Reload the page (⟳) to see the change.');
    A.toast('Saved ' + t.id, 2500);
  }

  async function checkNow() {
    const t = curTab(); if (!t) return;
    const r = await A.api('/api/appedit/check', { path: t.id, text: $('#aeta').value }).catch(() => null);
    const msg = $('#aemsg');
    if (!r) return A.toast('The check did not run.', 4000);
    if (r.ok) { msg.className = 'small'; msg.textContent = r.checked ? '✓ The JavaScript is valid.' : 'Nothing to check in that kind of file.'; }
    else { msg.className = 'small rd-bad'; msg.textContent = '✗ ' + (r.error || 'It would not run.'); }
  }

  async function history() {
    const t = curTab(); if (!t) return;
    const r = await A.api('/api/appedit/versions', { path: t.id }).catch(() => null);
    const v = (r && r.versions) || [];
    A.dlg('<div class="hd"><b>↩ ' + esc(t.id) + '</b></div><div class="bd">' +
      (v.length ? v.map(x => '<div class="row" style="gap:8px;padding:6px 0;border-top:1px solid var(--line)"><span style="flex:1;min-width:160px">' + new Date(x.at).toLocaleString() + '</span><span class="small mute">' + big(x.bytes) + '</span><button class="ib" data-v="' + x.at + '">Put this back</button></div>').join('')
        : '<div class="mute small">No earlier versions of this file yet. The first one is made when you save a change.</div>') +
      '<div class="row" style="margin-top:10px"><span class="sp"></span><button class="ib" id="aehc">Close</button></div></div>');
    document.getElementById('aehc').onclick = () => A.closeDlg();
    document.querySelectorAll('#dlg [data-v]').forEach(b => {
      b.onclick = async () => {
        if (!confirm('Put that version back? The version you have now is saved first.')) return;
        const rr = await A.api('/api/appedit/revert', { path: t.id, at: +b.dataset.v }).catch(() => null);
        if (!rr || rr.error) { A.toast((rr && rr.error) || 'That version could not be restored.', 6000); return; }
        A.closeDlg(); t.orig = rr.text; t.text = rr.text; t.dirty = false;
        $('#aeta').value = rr.text; const e = ed(); if (e) e.refresh(); mark();
        A.toast('That version is back.', 3000);
      };
    });
  }

  /* everything this page has ever changed, newest first: the way back when something feels wrong */
  async function changedFiles() {
    const r = await A.api('/api/appedit/edited').catch(() => null);
    const list = (r && r.edited) || [];
    A.dlg('<div class="hd"><b>✏️ Files you changed</b></div><div class="bd">' +
      (list.length ? list.map(x => '<div class="row" style="gap:8px;padding:6px 0;border-top:1px solid var(--line)"><b style="flex:1;min-width:170px;word-break:break-all">' + esc(x.rel) + '</b><span class="small mute">' + new Date(x.at).toLocaleString() + ' · ' + x.versions + ' version' + (x.versions === 1 ? '' : 's') + '</span><button class="ib" data-visit="' + esc(x.rel) + '">Open</button></div>').join('')
        : '<div class="mute small">Nothing has been changed here yet.</div>') +
      '<div class="row" style="margin-top:10px"><span class="sp"></span><button class="ib" id="aecfc">Close</button></div></div>', true);
    document.getElementById('aecfc').onclick = () => A.closeDlg();
    document.querySelectorAll('#dlg [data-visit]').forEach(b => {
      b.onclick = () => { const rel = b.dataset.visit; A.closeDlg(); loadDir(rel.split('/').slice(0, -1).join('/')).then(() => open(rel)); };
    });
  }

  async function findEverywhere() {
    const q = prompt('Find a word or a piece of code in every file of the app:');
    if (!q || !q.trim()) return;
    const r = await A.api('/api/app/search', { q: q.trim(), n: 40 }).catch(() => null);
    const hits = (r && r.results) || [];
    A.dlg('<div class="hd"><b>🔎 “' + esc(q) + '”</b></div><div class="bd">' +
      (hits.length ? hits.map(h => '<div class="row" style="gap:8px;padding:6px 0;border-top:1px solid var(--line);cursor:pointer" data-open="' + esc(h.rel || h.path || '') + '"><b style="flex:1;min-width:150px">' + esc(h.rel || h.path || '') + '</b><span class="small mute">' + esc(String(h.snippet || h.text || '').slice(0, 70)) + '</span></div>').join('')
        : '<div class="mute small">Nothing in the app mentions that.</div>') +
      '<div class="row" style="margin-top:10px"><span class="sp"></span><button class="ib" id="aefc">Close</button></div></div>', true);
    document.getElementById('aefc').onclick = () => A.closeDlg();
    document.querySelectorAll('#dlg [data-open]').forEach(row => {
      row.onclick = () => {
        const rel = row.dataset.open; if (!rel) return;
        A.closeDlg();
        loadDir(rel.split('/').slice(0, -1).join('/')).then(() => open(rel));
      };
    });
  }

  async function onShow() {
    if (!$('#aeta')) shell();
    if (!path && !tabs.length) await loadDir('web/js');
    else { drawFiles(); mark(); }
  }

  A.NAVIC.appedit = '✏️';
  A.registerTab('appedit', 'Edit the app', onShow);
  if (A.buildNav) A.buildNav();
})();

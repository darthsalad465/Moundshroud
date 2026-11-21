/* The app's own bash shell: the same file-system engine the terminal sandboxes use, mounted on Moundshroud's source
   tree and nothing else. The room is built from /api/appedit/shell (which walks the editor's allow-list), so the shell
   cannot see or reach any file outside web/, lib/, tests/, scripts/ and the app's allowed root files. After every
   command the tree is diffed and the differences are written back through /api/appedit/*, which runs the same checks
   and keeps the previous version of each file. */
(function () {
  const API = '/api/appedit/';
  const PREFIX = 'app/';
  const MONO = 'font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace';
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  let wrap = null, out = null, inp = null, promptEl = null, room = null, lines = [], hist = [], hi = 0, busy = false;
  let snapshot = { files: {}, dirs: [] };
  /* what the app looks like on disk, so files that appear or change outside this shell can be pulled in */
  let known = new Map(), timer = null, syncing = false;
  const SYNC_MS = 4000;

  const paint = () => { if (out) { out.textContent = lines.join('\n'); out.scrollTop = out.scrollHeight; } };
  const say = s => { lines.push(String(s)); };
  const status = s => { lines.push('  · ' + s); };

  const promptText = () => {
    let parts = [];
    try {
      const p = room && room.cwdPath ? room.cwdPath() : [];
      parts = Array.isArray(p) ? p.slice() : String(p || '').split('/').filter(Boolean);
    } catch (e) { parts = []; }
    const inApp = parts[0] === 'app';
    if (inApp) parts = parts.slice(1);
    const shown = inApp ? '~/app' + (parts.length ? '/' + parts.join('/') : '')
      : parts.length ? '/' + parts.join('/') : '~';
    return 'moundshroud@moundshroud:' + shown + '$ ';
  };

  /* the whole in-memory tree as flat paths, so a command can be diffed against what was there before it */
  function flat(tree) {
    const files = {}, dirs = [];
    const walk = (node, path) => {
      for (const k of Object.keys(node)) {
        const p = path ? path + '/' + k : k;
        const v = node[k];
        if (v && typeof v === 'object' && !('text' in v)) { dirs.push(p); walk(v, p); }
        else files[p] = v && typeof v === 'object' ? String(v.text == null ? '' : v.text) : String(v == null ? '' : v);
      }
    };
    walk(tree || {}, '');
    return { files, dirs };
  }

  async function post(what, body) {
    try {
      const r = await fetch(API + what, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      return await r.json().catch(() => ({ error: 'no reply from the app' }));
    } catch (e) { return { error: String(e && e.message || e) }; }
  }

  const strip = rel => rel.startsWith(PREFIX) ? rel.slice(PREFIX.length) : rel;

  /* Every edit made here belongs to this browser only. Nothing is ever written back to the app's files: the overlay
     below is kept in localStorage (per browser, per profile) and painted on top of a read-only copy of the source. */
  const OVERLAY_KEY = 'aeshell_overlay_v1';
  function readOverlay() {
    try {
      const raw = localStorage.getItem(OVERLAY_KEY);
      const data = raw ? JSON.parse(raw) : null;
      return data && typeof data === 'object' ? { files: data.files || {}, removed: Array.isArray(data.removed) ? data.removed : [] } : { files: {}, removed: [] };
    } catch (e) { return { files: {}, removed: [] }; }
  }
  function writeOverlay(overlay) {
    try { localStorage.setItem(OVERLAY_KEY, JSON.stringify(overlay)); } catch (e) { /* private mode: keep it in memory only */ }
  }
  function clearOverlay() {
    try { localStorage.removeItem(OVERLAY_KEY); } catch (e) { /* nothing to clear */ }
  }
  let overlay = { files: {}, removed: [] };

  /* files changed in this browser win over what is on disk, so a local edit is never silently replaced */
  function applyOverlay(files) {
    for (const [rel, text] of Object.entries(overlay.files)) files[PREFIX + rel] = text;
    for (const rel of overlay.removed) delete files[PREFIX + rel];
    return files;
  }

  function persist(before, after) {
    const created = [], saved = [], removed = [];
    for (const [p, text] of Object.entries(after.files)) {
      if (!(p in before.files)) created.push(p);
      else if (before.files[p] !== text) saved.push(p);
    }
    for (const p of Object.keys(before.files)) if (!(p in after.files)) removed.push(p);
    if (!created.length && !saved.length && !removed.length) return;

    let changed = 0;
    for (const p of created.concat(saved)) {
      const rel = strip(p);
      overlay.files[rel] = after.files[p];
      overlay.removed = overlay.removed.filter(x => x !== rel);
      changed++;
    }
    for (const p of removed) {
      const rel = strip(p);
      delete overlay.files[rel];
      if (!overlay.removed.includes(rel)) overlay.removed.push(rel);
      changed++;
    }
    for (const d of after.dirs) if (!before.dirs.includes(d)) status('folder ' + strip(d) + '/');
    for (const p of created) status('created ' + strip(p) + ' (this browser only)');
    for (const p of saved) status('saved ' + strip(p) + ' (this browser only)');
    for (const p of removed) status('removed ' + strip(p) + ' (this browser only)');
    writeOverlay(overlay);
    if (changed) status('your copy — the app\'s own files are unchanged');
  }

  /* what this browser can honestly say about the machine it is running on (never sent anywhere) */
  function machineInfo() {
    const uaData = navigator.userAgentData || null;
    const platform = (uaData && uaData.platform) || navigator.platform || 'this browser';
    const isArm = /arm|aarch64/i.test(navigator.userAgent);
    const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection || null;
    let tz = '';
    try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (e) { tz = ''; }
    return {
      hostname: 'this-browser', user: 'you', arch: isArm ? 'aarch64' : 'x86_64', os: platform,
      platform, browser: String(navigator.userAgent || '').slice(0, 120),
      cores: navigator.hardwareConcurrency || 4, memoryMb: navigator.deviceMemory ? navigator.deviceMemory * 1024 : 0,
      language: navigator.language || '', timezone: tz, online: !!navigator.onLine,
      screen: (window.screen ? screen.width + 'x' + screen.height : ''),
      connection: conn && conn.effectiveType ? conn.effectiveType : (navigator.onLine ? 'connected' : 'offline'),
      ip: '127.0.0.1', mac: '00:00:00:00:00:00'
    };
  }

  async function exec(raw) {
    if (busy) return;
    const line = String(raw == null ? '' : raw);
    say(promptText() + line);
    paint();
    if (!line.trim()) return;
    if (line.trim() === 'clear') { lines = []; paint(); return; }
    if (line.trim() === 'exit' || line.trim() === 'logout') { close(); return; }
    hist.push(line); hi = hist.length;
    busy = true;
    let output = '';
    try {
      try { output = room.run(line); } catch (e) { output = 'bash: ' + String(e && e.message || e); }
      const before = snapshot;
      snapshot = flat(room.snapshot().tree);
      await persist(before, snapshot);
    } catch (e) {
      output = (output ? output + '\n' : '') + 'shell: ' + String(e && e.message || e);
    } finally {
      busy = false;
    }
    if (output) say(String(output).replace(/\n$/, ''));
    paint();
    if (promptEl) promptEl.textContent = promptText();
  }

  function history(step) {
    if (!hist.length) return;
    hi = Math.max(0, Math.min(hist.length, hi + step));
    inp.value = hi >= hist.length ? '' : hist[hi];
  }

  function close() {
    if (!wrap) return;
    if (timer) clearInterval(timer);
    timer = null; known = new Map(); syncing = false;
    wrap.remove(); wrap = out = inp = promptEl = null; room = null; lines = []; busy = false;
    document.removeEventListener('keydown', onDocKey, true);
    document.removeEventListener('focus', syncFromDisk);
  }

  /* the app's file list with mtimes; small enough to poll (no file contents) */
  async function metaList() {
    try {
      const r = await fetch(API + 'shell?meta=1', { cache: 'no-store' });
      const d = await r.json();
      return Array.isArray(d && d.files) ? d.files : null;
    } catch (e) { return null; }
  }

  async function primeKnown() {
    const list = await metaList();
    if (!list) return;
    known = new Map(list.map(f => [f.rel, f.at]));
  }

  /* pull in anything another window, the editor, or a build changed while this shell was open */
  async function syncFromDisk() {
    if (!room || busy || syncing) return;
    syncing = true;
    try {
      const list = await metaList();
      if (!list) return;
      const next = new Map(list.map(f => [f.rel, f.at]));
      const changed = list.filter(f => !known.has(f.rel) || known.get(f.rel) !== f.at);
      const gone = [...known.keys()].filter(rel => !next.has(rel));
      if (!changed.length && !gone.length) { known = next; return; }
      const incoming = {};
      let refreshed = 0;
      for (const f of changed) {
        if (f.rel in overlay.files || overlay.removed.includes(f.rel)) continue;
        const r = await post('read', { path: f.rel });
        if (!r || r.error || typeof r.text !== 'string') continue;
        const key = PREFIX + f.rel;
        if (snapshot.files[key] === r.text) continue;
        incoming[key] = r.text;
        snapshot.files[key] = r.text;
        refreshed++;
      }
      const removed = gone.map(rel => PREFIX + rel).filter(key => key in snapshot.files);
      for (const key of removed) { delete snapshot.files[key]; refreshed++; }
      if (refreshed) {
        room.applyFiles(incoming, removed);
        say('  · app changed on disk — refreshed ' + refreshed + ' file' + (refreshed === 1 ? '' : 's'));
        paint();
        if (promptEl) promptEl.textContent = promptText();
      }
      known = next;
    } finally { syncing = false; }
  }

  function onDocKey(e) { if (e.key === 'Escape' && wrap) { e.preventDefault(); e.stopPropagation(); close(); } }

  async function open() {
    if (wrap) { inp && inp.focus(); return; }
    if (!window.TerminalPuzzles || !window.TerminalPuzzles.buildCustomFileRoom) {
      if (window.A && window.A.toast) window.A.toast('The terminal engine is still loading. Try again in a moment.', 4000);
      return;
    }
    wrap = document.createElement('div');
    wrap.id = 'aeshellwrap';
    wrap.style.cssText = 'position:fixed;inset:0;z-index:1200;background:rgba(3,5,9,.82);display:flex;align-items:center;justify-content:center;padding:20px;box-sizing:border-box';
    wrap.innerHTML =
      '<div style="width:min(1180px,97vw);height:min(82vh,820px);display:flex;flex-direction:column;box-sizing:border-box;' +
      'background:#05070b;border:1px solid var(--line);border-radius:10px;padding:10px 12px">' +
      '<div class="row" style="gap:6px;align-items:center;flex-wrap:wrap;margin-bottom:6px">' +
      '<b class="small" style="' + MONO + '">🐚 app shell · moundshroud@moundshroud</b>' +
      '<span class="small mute" style="flex:1;min-width:180px">bash, with this app as the only disk</span>' +
      '<button class="ib" id="aeshellclear" title="Clear what is on screen (files stay as they are)">Clear</button>' +
      '<button class="ib" id="aeshellreset" title="Throw away every change you made in this browser and start from the app\'s files again">Discard my changes</button>' +
      '<button class="ib" id="aeshellreload" title="Reload the app files (your local changes stay)">Reload files</button>' +
      '<button class="ib" id="aeshellclose" title="Close the shell (Esc)">✕ Close</button></div>' +
      '<pre class="term-fs-out" id="aeshellout" style="margin:0;flex:1;min-height:200px;overflow:auto;' + MONO + ';font-size:12.5px;line-height:1.55;white-space:pre-wrap;word-break:break-word;user-select:text;-webkit-user-select:text;cursor:text"></pre>' +
      '<div class="row term-fs-prompt-row" style="gap:6px;align-items:center;margin-top:8px;border-top:1px solid rgba(255,255,255,.06);padding-top:8px">' +
      '<span id="aeshellprompt" style="' + MONO + ';font-size:12.5px;color:#6ee7a0;white-space:nowrap"></span>' +
      '<input id="aeshellcmd" autocomplete="off" autocapitalize="off" spellcheck="false" aria-label="App shell command" ' +
      'placeholder="type a command — ls, cat, grep, echo … ↑ history · Ctrl+L clears · Esc closes" style="flex:1;min-width:0"></div>' +
      '<div class="small mute" style="' + MONO + ';margin-top:6px">Your changes stay in this browser and never touch the app\'s files. Network commands can describe this computer, but nothing here can scan, connect to or attack anything.</div>' +
      '</div>';
    document.body.appendChild(wrap);
    out = wrap.querySelector('#aeshellout');
    inp = wrap.querySelector('#aeshellcmd');
    promptEl = wrap.querySelector('#aeshellprompt');
    wrap.querySelector('#aeshellclose').onclick = close;
    wrap.querySelector('#aeshellclear').onclick = () => { lines = []; paint(); inp.focus(); };
    wrap.querySelector('#aeshellreset').onclick = () => { clearOverlay(); overlay = { files: {}, removed: [] }; close(); open(); };
    wrap.querySelector('#aeshellreload').onclick = () => { close(); open(); };
    inp.onkeydown = e => {
      if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); const v = inp.value; inp.value = ''; exec(v); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); history(-1); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); history(1); }
      else if (e.key === 'l' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); lines = []; paint(); }
    };
    out.onclick = () => inp.focus();
    document.addEventListener('keydown', onDocKey, true);
    lines = ['Moundshroud app shell — bash against this app only.', 'Try: ls · ls -la app/web/js · cat app/server.js | head -20 · grep -rn "terminal" app/web/js · cd app/lib', ''];
    promptEl.textContent = 'moundshroud@moundshroud:~/app$ ';
    paint();
    inp.focus();

    const banner = lines.slice();
    say('Loading the app files…'); paint();
    let data = null;
    try { const r = await fetch(API + 'shell', { cache: 'no-store' }); data = await r.json(); } catch (e) { data = null; }
    lines = banner.slice();
    if (!data || data.error || !data.files) {
      say('Could not read the app files' + (data && data.error ? ': ' + data.error : '.') + ' — the shell needs the app server.');
      say('');
      paint();
      return;
    }
    overlay = readOverlay();
    const files = {};
    for (const [rel, text] of Object.entries(data.files)) files[PREFIX + rel] = text;
    applyOverlay(files);
    try {
      room = window.TerminalPuzzles.buildCustomFileRoom({ shell: 'bash', files, title: 'Moundshroud app', brief: '', difficulty: 'insane', machine: machineInfo() });
      /* start inside the app folder; restore() must not be handed the room's own tree, it empties it first */
      room.run('cd app');
      if (!String(room.cwdPath()).startsWith('/app')) room.run('cd /app');
    } catch (e) {
      say('The shell engine failed to start: ' + String(e && e.message || e)); say(''); paint(); return;
    }
    snapshot = flat(room.snapshot().tree);
    await primeKnown();
    if (timer) clearInterval(timer);
    timer = setInterval(syncFromDisk, SYNC_MS);
    document.addEventListener('focus', syncFromDisk);
    const n = Object.keys(snapshot.files).length;
    say('Loaded ' + n + ' files from the app' + (data.skipped ? ' (' + data.skipped + ' skipped as too large or not editable here)' : '') + '.');
    say('The only paths that exist here are inside app/ — nothing outside this app can be read or written.');
    say('');
    paint();
    if (promptEl) promptEl.textContent = promptText();
  }

  window.AppShell = { open, close };

  /* the header button next to the gear, and the Settings entry, both open this shell (one delegated handler, so a
     click can never fire open() and close() at the same time) */
  function hook() { /* nothing to bind here — the delegated listener below covers buttons added later too */ }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', hook); else hook();
  document.addEventListener('click', e => {
    const t = e.target && e.target.closest ? e.target.closest('#appsh, #set-appshell') : null;
    if (t) { e.preventDefault(); open(); }
  });
})();

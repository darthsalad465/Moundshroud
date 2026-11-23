/* The app's own bash shell: the same file-system engine the terminal sandboxes use, mounted on Moundshroud's whole
   source tree and nothing else. The disk comes from /api/appedit/shell, which lists every file the app is built from —
   the page, the server, the tests, the Electron desktop shell, and the third-party libraries under web/vendor. The list
   is small, so opening the shell is instant; contents arrive in batches right after (and on demand for a file asked
   for before its batch has landed). No file is refused for its size: a large library simply arrives in its own
   request, and a picture or model comes back as a one-line marker. After every command the tree is diffed and the
   differences are written back through /api/appedit/*, which keeps the previous version of each file.
   The full mcode harness (web/js/terminal-playground-mcode.js) lives here too: /code, /swarm, /whip, /tool, /rule,
   /model and the rest all drive this shell, so an agent works on the same app files you do. */
(function () {
  const API = '/api/appedit/';
  const PREFIX = 'app/';
  const MONO = 'font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace';
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  let wrap = null, panel = null, out = null, inp = null, promptEl = null, room = null, lines = [], hist = [], hi = 0, busy = false;
  let snapshot = { files: {}, dirs: [] };
  /* Your own typing gets its own colour, so a command is never mistaken for output. Saved for this shell. */
  let userColor = '#7fd1ff', manual = null;
  const COLOR_KEY = 'aeshell_user_color';
  /* Who the shell is signed in as. kali@pentest exists only while the Cyber Desktop's VM is running: with the VM off
     the shell is always moundshroud@moundshroud, and `pentest` says why it cannot switch. Turning the VM on never
     changes an open shell — a restart, or opening the shell again, signs in as kali@pentest. */
  let pentestUser = false, userTimer = null;
  const vmRunning = () => { try { return !!(typeof A !== 'undefined' && A.cyberExtras && A.cyberExtras.state && A.cyberExtras.state.running); } catch (e) { return false; } };
  const pentestActive = () => pentestUser && vmRunning();
  const shellIdentity = () => pentestActive() ? 'kali@pentest' : 'moundshroud@moundshroud';
  /* what the app looks like on disk, so files that appear or change outside this shell can be pulled in */
  let known = new Map(), sig = '', timer = null, syncing = false, quietUntil = 0;
  const SYNC_MS = 8000;
  /* files whose text has not arrived yet: rel -> { size, text }. Preloading walks this map in small batches. */
  const pending = new Map();
  let preloading = false, mcode = null, maxed = false, minimized = false;
  /* files staged for the next git commit (the store behind MoundHub does the committing) */
  let staged = new Set();

  const paint = () => {
    if (!out) return;
    const who = panel && panel.querySelector('#aeshellwho');
    if (who) who.textContent = shellIdentity();
    const text = lines.map(line => line.t).join('\n');
    /* only touch the DOM when the text really changed: rewriting the same text would drop a selection being copied */
    if (out.dataset.text !== text) {
      out.innerHTML = lines.map(line => '<span style="color:' +
        (line.k === 'cmd' ? userColor : line.k === 'dim' ? '#8593a3' : '#cfe9d6') + '">' + esc(line.t) + '</span>').join('\n');
      out.dataset.text = text;
      out.scrollTop = out.scrollHeight;
    }
  };
  /* anything printed after a clear means the screen is worth keeping again */
  const say = s => { screenCleared = false; lines.push({ k: 'out', t: String(s) }); };
  const status = s => { screenCleared = false; lines.push({ k: 'dim', t: '  · ' + s }); };
  const typed = s => { screenCleared = false; lines.push({ k: 'cmd', t: String(s) }); };
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

  /* The transcript outlives the window. Closing the shell and opening it again shows every line it had, exactly where
     it was left; only Clear, Ctrl+L and the `clear` command take it away, and those put the starting text back rather
     than leaving a blank screen. */
  const MAX_SCROLLBACK = 5000;
  let savedLines = null, screenCleared = false;
  const startingLines = () => [
    'moundshell — bash against this app only. You start inside ~/app, so paths are web/js, lib, server.js …',
    'Try: ls · ls -la web/js · cat server.js | head -20 · grep -rn "terminal" web/js · cd lib',
    'mcode harness: /chat <question> · /code <task> · /swarm · /model · /tool · /rule · /whip · help',
    'pentest switches this shell between moundshroud@moundshroud and kali@pentest — the Pentest user needs the Cyber VM running.',
    '· The ❓ Help button (or typing help) opens every command in plain words, with a playground inside it.',
    '· Your commits are kept at https://moundhub.com — open the Browser tab and type that address to browse them.',
    '· `git status`, `git add -A`, `git commit -m "…"` and `git push` save what you made here; it appears on MoundHub.',
    '· `browser` shows the libraries the Browser holds on this PC · `browser read 1` reads one · `breach 1` simulates\n  breaking into it on invented hosts, entirely inside this page.',
    '· `paths` lists what a tester tries on a website (robots.txt, the .env, /login, the hidden staff folder) and\n  `paths <host>` prints the same list as addresses for a site on the Cyber Desktop\'s fake internet.',
    '· Every fake website leaks its accounts at /dump/users.csv (names, e-mails, session IPs, passwords): `leaked <host>` prints the table.\n  Plug an IP into `nmap <ip>`, then `ssh user@<ip>` with the leaked password — the PC opens with its own files, work secrets and personal secrets.\n  `exit` comes back to this shell.',
    '· `guide` walks you through that breach step by step — scope, recon, injection, a shell, root, the report — with\n  the exact commands for your target. guide next moves on; guide list shows the ladder.',
    '· `juice start` runs OWASP Juice Shop on this PC and `juice guide` walks the site itself; `app` drives the whole\n  app (tabs, theme, notes, chat, settings, games) and `tools` runs every Toolkit tool from here.',
    '· Every fake website, Browser library and Open Range PC hides a `FLAG{...}`: type  solve FLAG{...}  and it pays the\n  Cyber Desktop practice bank. `solve` alone says where the flags are; `range` lists endless practice PCs to breach.'
  ].map(t => ({ k: t.startsWith('· The ❓') ? 'dim' : 'out', t }));
  /* clearing the screen never leaves it empty: the starting text is what a fresh shell shows */
  function resetScreen() {
    savedLines = null;
    screenCleared = true;
    lines = startingLines();
    paint();
    if (promptEl) promptEl.textContent = promptText();
    if (inp) inp.focus();
  }

  const cwdParts = () => {
    let p = [];
    try {
      const v = room && room.cwdPath ? room.cwdPath() : [];
      p = Array.isArray(v) ? v.slice() : String(v || '').split('/').filter(Boolean);
    } catch (e) { p = []; }
    return p[0] === 'app' ? p.slice(1) : p;
  };
  const promptText = () => {
    if (pcSession) return pcSession.prompt();
    if (breach) return breach.prompt();
    if (mcode && mcode.open && mcode.open()) return mcode.prompt();
    const parts = cwdParts();
    const inApp = (() => { try { return Array.isArray(room.cwdPath()) ? room.cwdPath()[0] === 'app' : String(room.cwdPath()).startsWith('/app'); } catch (e) { return true; } })();
    const shown = inApp ? '~/app' + (parts.length ? '/' + parts.join('/') : '')
      : parts.length ? '/' + parts.join('/') : '~';
    /* the prompt carries the network mode, so `ip a` is never the only way to see where traffic is pretending to go */
    const net = (() => {
      try {
        if (!A.tor) return '';
        return (A.tor.on ? ' [tor]' : '') + (A.tor.vpn.on ? ' [vpn:' + A.tor.vpn.cc + ']' : '');
      } catch (e) { return ''; }
    })();
    return shellIdentity() + ':' + shown + net + '$ ';
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
  const fmtBytes = n => !n ? '0 B' : n < 1024 ? n + ' B' : n < 1048576 ? Math.round(n / 1024) + ' KB' : (n / 1048576).toFixed(n < 10485760 ? 1 : 0) + ' MB';

  /* A command that changes a file changes the app itself (persist() writes it back through /api/appedit/shellwrite,
     which accepts only paths inside the app). The overlay below is only for what the server refuses, plus git's own
     checkout and pull, which live in the Repositories store rather than on disk. */
  const OVERLAY_KEY = 'aeshell_overlay_v1';
  function readOverlay() {
    try {
      const raw = localStorage.getItem(OVERLAY_KEY);
      const data = raw ? JSON.parse(raw) : null;
      return data && typeof data === 'object'
        ? { files: data.files || {}, removed: Array.isArray(data.removed) ? data.removed : [], written: Array.isArray(data.written) ? data.written : [], deleted: Array.isArray(data.deleted) ? data.deleted : [] }
        : { files: {}, removed: [], written: [], deleted: [] };
    } catch (e) { return { files: {}, removed: [], written: [], deleted: [] }; }
  }
  function writeOverlay(overlay) {
    try { localStorage.setItem(OVERLAY_KEY, JSON.stringify(overlay)); } catch (e) { /* private mode: keep it in memory only */ }
  }
  function clearOverlay() {
    try { localStorage.removeItem(OVERLAY_KEY); } catch (e) { /* nothing to clear */ }
  }
  /* files: refused changes kept here · removed: refused removals · written: files this shell saved to disk ·
     deleted: files this shell removed from disk. The last two are markers git reads, not a copy of the content. */
  let overlay = { files: {}, removed: [], written: [], deleted: [] };

  /* files changed in this browser win over what is on disk, so a local edit is never silently replaced */
  function applyOverlay(files) {
    for (const [rel, text] of Object.entries(overlay.files)) files[PREFIX + rel] = text;
    for (const rel of overlay.removed) delete files[PREFIX + rel];
    return files;
  }

  /* A file a command changes is the app's own file: the change goes back through /api/appedit/shellwrite, which takes
     a path only inside the app (web, lib, tests, scripts, desktop, docs, agent, or one of its top-level files) and never
     anything outside it. A path it refuses, or a page served without that endpoint, keeps the change in this browser's
     overlay as before — and says so. */
  function persist(before, after) {
    /* only paths under ~/app are the app: anything the shell made outside it is reported and never written */
    const real = p => String(p).startsWith(PREFIX) && !strip(p).split('/').some(x => !x || x === '.' || x === '..');
    const created = [], saved = [], removed = [], folders = [], outer = [];
    for (const [p, text] of Object.entries(after.files)) {
      if (!(p in before.files)) (real(p) ? created : outer).push(p);
      else if (before.files[p] !== text) (real(p) ? saved : outer).push(p);
    }
    for (const p of Object.keys(before.files)) if (!(p in after.files)) (real(p) ? removed : outer).push(p);
    for (const d of after.dirs) if (!before.dirs.includes(d) && real(d)) folders.push(d);
    for (const p of outer) status(strip(p) + ': outside ~/app — nothing was written');
    if (!created.length && !saved.length && !removed.length && !folders.length) return Promise.resolve(0);

    const put = rel => {
      overlay.files[rel] = after.files[PREFIX + rel];
      overlay.removed = overlay.removed.filter(x => x !== rel);
      overlay.written = overlay.written.filter(x => x !== rel);
      overlay.deleted = overlay.deleted.filter(x => x !== rel);
    };
    const drop = rel => {
      delete overlay.files[rel];
      if (!overlay.removed.includes(rel)) overlay.removed.push(rel);
      overlay.written = overlay.written.filter(x => x !== rel);
      if (!overlay.deleted.includes(rel)) overlay.deleted.push(rel);
    };
    const browserOnly = () => {
      for (const p of created.concat(saved)) put(strip(p));
      for (const p of removed) drop(strip(p));
      for (const d of folders) status('folder ' + strip(d) + '/');
      for (const p of created) status('created ' + strip(p) + ' (this browser only)');
      for (const p of saved) status('saved ' + strip(p) + ' (this browser only)');
      for (const p of removed) status('removed ' + strip(p) + ' (this browser only)');
      writeOverlay(overlay);
      status('your copy — the app\'s own files are unchanged');
      return 0;
    };

    return post('shellwrite', {
      save: created.concat(saved).map(p => ({ rel: strip(p), text: after.files[p] })),
      remove: removed.map(strip),
      mkdir: folders.map(strip)
    }).then(r => {
      if (!r || r.error || !Array.isArray(r.saved)) return browserOnly();
      /* the change on disk is this shell's own write: keep the disk watcher quiet while its idea catches up */
      quietUntil = Date.now() + 4000;
      const made = new Set(r.created || []), took = new Set(r.removed || []);
      /* the content is on disk now, so only the fact that this shell changed the file is kept */
      for (const rel of r.saved) {
        delete overlay.files[rel];
        overlay.removed = overlay.removed.filter(x => x !== rel);
        overlay.deleted = overlay.deleted.filter(x => x !== rel);
        if (!overlay.written.includes(rel)) overlay.written.push(rel);
      }
      for (const rel of took) {
        delete overlay.files[rel];
        overlay.removed = overlay.removed.filter(x => x !== rel);
        overlay.written = overlay.written.filter(x => x !== rel);
        if (!overlay.deleted.includes(rel)) overlay.deleted.push(rel);
      }
      for (const rel of r.saved) status((made.has(rel) ? 'created ' : 'saved ') + rel);
      for (const rel of took) status('removed ' + rel);
      for (const rel of (r.folders || [])) status('folder ' + rel + '/');
      for (const f of (r.refused || [])) {
        const rel = String((f && f.rel) || '');
        if (!rel) continue;
        const key = PREFIX + rel, isFile = (key in after.files) || (key in before.files);
        if (key in after.files) put(rel); else if (key in before.files) drop(rel);
        status(rel + ': ' + String((f && f.why) || 'cannot be written from here') + (isFile ? ' — kept in this browser only' : ''));
      }
      writeOverlay(overlay);
      /* the receipt carries the new state, so the disk watcher needs no second request to catch up */
      for (const rel of (r.removed || [])) known.delete(rel);
      for (const rel of Object.keys(r.at || {})) known.set(rel, Number(r.at[rel]) || 0);
      if (r.sig) sig = r.sig;
      return r.saved.length + took.size;
    }).catch(() => browserOnly());
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

  /* ---- file contents, a batch at a time ---------------------------------------------------------------------- */
  async function loadRels(rels) {
    const want = rels.filter(rel => pending.has(rel) && !overlay.files[rel] && !overlay.removed.includes(rel));
    for (const rel of rels) if (!want.includes(rel)) pending.delete(rel);
    if (!want.length) return 0;
    const r = await post('shellfiles', { files: want });
    if (!r || r.error || !r.files) return 0;
    const incoming = {};
    let got = 0;
    for (const [rel, text] of Object.entries(r.files)) {
      pending.delete(rel);
      const key = PREFIX + rel;
      if (snapshot.files[key] === text) continue;
      incoming[key] = text;
      got++;
    }
    if (got) {
      room.applyFiles(incoming, []);
      snapshot = flat(room.snapshot().tree);
    }
    return got;
  }

  /* the rest of the app, smallest files first, a couple of megabytes at a time, never while a command is running */
  async function preloadAll() {
    if (preloading || !room) return;
    preloading = true;
    try {
      while (pending.size) {
        if (busy) { await sleep(150); continue; }
        const batch = [];
        let bytes = 0, blocked = true;
        for (const [rel, entry] of pending) {
          if (entry.size > 4 * 1024 * 1024) continue;   /* a huge library loads when it is asked for */
          blocked = false;
          batch.push(rel);
          bytes += entry.size;
          if (batch.length >= 60 || bytes > 1.5e6) break;
        }
        if (blocked) break;
        await loadRels(batch);
        await sleep(0);
      }
    } finally { preloading = false; }
  }

  const appDirs = new Set();
  const RESCAN = /\b(?:grep|egrep|fgrep|rg|ag|ack)\b[^|;&]*\s-[A-Za-z]*[rR]|\b(?:find|du|tree|tar|zip|wc|ls)\b[^|;&]*\s-[A-Za-z]*[rR]/;
  /* before a command runs, make sure the files it will read are actually here (a batch may still be on its way) */
  async function ensureLoaded(line) {
    if (!pending.size || !room) return;
    const text = String(line);
    const tokens = text.split(/[\s|;&<>()"'`=]+/).map(t => t.replace(/^\.?\/+/, '').replace(/^app\//, '').replace(/\/+$/, '')).filter(Boolean);
    const wanted = new Set();
    /* a file named outright is always fetched, whichever other part of the line asks for a whole tree */
    for (const t of tokens) if (pending.has(t)) wanted.add(t);
    if (RESCAN.test(text)) {
      /* whole-tree reads: every file under the deepest folder the command names (`grep -r x web/vendor`), or all of it */
      let base = '';
      for (const t of tokens) if (appDirs.has(t) && t.length > base.length) base = t;
      const prefix = base ? base + '/' : '';
      for (const rel of pending.keys()) if (!prefix || rel.startsWith(prefix)) wanted.add(rel);
    }
    if (!wanted.size) return;
    const list = [...wanted];
    const slow = list.length > 40;
    if (slow) { status('reading ' + list.length + ' file' + (list.length === 1 ? '' : 's') + '…'); paint(); }
    for (let i = 0; i < list.length; i += 25) await loadRels(list.slice(i, i + 25));
    if (slow) {
      /* drop the "reading …" line again: the command's own output follows it */
      const message = '  · reading ' + list.length + ' file' + (list.length === 1 ? '' : 's') + '…';
      const at = lines.findIndex(line => line.t === message);
      if (at >= 0) lines.splice(at, 1);
      paint();
    }
  }

  /* ---- git, against the repository store --------------------------------------------------------------------- */
  /* These are not pretend commands: init, add, commit, push, log, branch, remote and diff work on this app's files and
     write into the store that https://moundhub.com shows in the Browser, so a commit made here is waiting there (and
     `git push` records the push).
     `git add -A` stages what this shell has changed (or, once a repository has commits, everything that differs from
     its newest commit): it never tries to stage the whole app, which is far too much for one commit. */
  const repoStore = () => (typeof window.RepoStore !== 'undefined' ? window.RepoStore : null);

  function argvOf(line) {
    const out = [], re = /"([^"]*)"|'([^']*)'|(\S+)/g;
    let m;
    while ((m = re.exec(String(line)))) out.push(m[1] != null ? m[1] : m[2] != null ? m[2] : m[3]);
    return out;
  }
  const cwdRel = () => cwdParts().join('/');
  function normRel(p) {
    let s = String(p == null ? '' : p).replace(/\\/g, '/').trim();
    if (!s || s === '.' || s === './') return '';
    s = s.replace(/^app\//, '').replace(/^\.\//, '').replace(/^\/+/, '');
    const base = cwdRel();
    if (base && !/^\.\.(~|\/)/.test(s) && !s.startsWith('../')) s = base + '/' + s;
    const parts = [];
    for (const seg of s.split('/')) { if (!seg || seg === '.') continue; if (seg === '..') parts.pop(); else parts.push(seg); }
    return parts.join('/');
  }
  /* every loaded file in the app, by path inside the app (a file still arriving is left out, not counted as empty) */
  function workFiles() {
    const all = flat(room ? room.snapshot().tree : {}).files, out = {};
    for (const [p, text] of Object.entries(all)) { const rel = strip(p); if (!pending.has(rel)) out[rel] = text; }
    return out;
  }
  /* what is different from the newest commit. In a repository with no commits yet that is what this shell changed. */
  function workingChanges() {
    const S = repoStore();
    const repo = S && S.unlocked() ? S.current() : null;
    const out = {};
    if (repo && S.head(repo)) {
      const tree = S.treeOf(repo), work = workFiles();
      /* the files the repository already holds, plus anything this shell made: the rest of the app is not in this
         repository, so git does not report every app file as untracked (`git add <path>` still adds one) */
      for (const rel of Object.keys(tree)) {
        /* a tracked file missing from the app tree is not "deleted": the repository can hold files that live only
           in it (a README written in the tab). Only a file this shell removed counts as removed. */
        if (rel in work) { if (tree[rel] !== work[rel]) out[rel] = work[rel]; }
        else if (overlay.removed.includes(rel)) out[rel] = null;
      }
      for (const [rel, text] of Object.entries(overlay.files)) if (!(rel in tree)) out[rel] = text;
      for (const rel of overlay.removed) if (rel in tree) out[rel] = null;
      /* files this shell saved or removed after they reached the disk are its changes too */
      for (const rel of overlay.written) if (!(rel in tree) && rel in work) out[rel] = work[rel];
      for (const rel of overlay.deleted) if (rel in tree && !(rel in work)) out[rel] = null;
      return out;
    }
    const work = workFiles();
    for (const [rel, text] of Object.entries(overlay.files)) out[rel] = text;
    for (const rel of overlay.removed) out[rel] = null;
    for (const rel of overlay.written) if (rel in work) out[rel] = work[rel];
    for (const rel of overlay.deleted) out[rel] = null;
    return out;
  }

  const MOUNDHUB_ORIGIN = 'https://moundhub.com';
  const hubRepoUrl = repo => MOUNDHUB_ORIGIN + '/moundshroud/' + ((repo && (repo.slug || repo.name)) || 'repo') + '.git';
  function isMoundHubUrl(raw) {
    const s = String(raw == null ? '' : raw).trim();
    if (!s) return true;
    return /^(?:https?:\/\/)?(?:www\.)?moundhub\.com(?:\/[^\s]*)?$/i.test(s);
  }
  function looksLikeUrl(raw) {
    const s = String(raw == null ? '' : raw).trim();
    return /^[a-z][a-z0-9+.-]*:\/\//i.test(s) || /^git@/i.test(s) || /^[^/\s]+@[^/\s]+:/i.test(s) || /^[a-z0-9-]+(?:\.[a-z0-9-]+)+\b/i.test(s);
  }
  function normalizeMoundHubUrl(raw, repo) {
    const s = String(raw == null ? '' : raw).trim();
    if (!s) return hubRepoUrl(repo);
    const p = s.replace(/^(?:https?:\/\/)?(?:www\.)?moundhub\.com\/?/i, '').replace(/^\/+/, '');
    return MOUNDHUB_ORIGIN + '/' + (p || ('moundshroud/' + ((repo && repo.slug) || 'repo') + '.git'));
  }
  function refreshMoundHubFrames() {
    try {
      document.querySelectorAll('iframe').forEach(fr => {
        try { if (fr.contentWindow && fr.contentWindow.MoundHub && fr.contentWindow.MoundHub.paint) fr.contentWindow.MoundHub.paint(); } catch (e) { }
      });
    } catch (e) { }
  }
  const hubOnlyError = (verb, repo) =>
    'fatal: moundshell git only ' + verb + ' MoundHub (' + MOUNDHUB_ORIGIN + ') in the app\'s browser.\n' +
    'External git servers and other websites are blocked here.' +
    (repo ? '\nUse: ' + hubRepoUrl(repo) : '\nOpen the Browser and go to ' + MOUNDHUB_ORIGIN + '.');

  function gitCommand(raw) {
    const trimmed = String(raw == null ? '' : raw).trim();
    if (!/^git(?:\s|$)/.test(trimmed)) return null;
    /* piped/chained lines (e.g. `git log --oneline | head -n 5`) route through room.run -> C.git -> runGitArgs */
    if (/[|;&>]/.test(trimmed.replace(/"(?:\\.|[^"\\])*"|'[^']*'/g, ''))) return null;
    return runGitArgs(argvOf(raw).slice(1));
  }

  function runGitArgs(args) {
    const S = repoStore();
    if (!S) return null;
    const listArgs = Array.isArray(args) ? args.map(x => String(x == null ? '' : x)) : [];
    const sub = listArgs[0] || 'status', rest = listArgs.slice(1);
    if (sub === 'help' || sub === '--help' || sub === '-h') {
      return ['git in moundshell — strictly connected to MoundHub (' + MOUNDHUB_ORIGIN + ') in the app\'s browser.',
        '  git init [name]          make a repository on MoundHub',
        '  git clone <url|slug>     load a MoundHub repository into this shell',
        '  git status               what has changed since the newest MoundHub commit',
        '  git add -A | <path>      stage your changes',
        '  git commit -m "…"        save a commit to MoundHub',
        '  git push                 push the newest commit to MoundHub',
        '  git fetch | git pull     sync from MoundHub into this shell',
        '  git log --oneline        the commit history on MoundHub',
        '  git branch | git remote -v | git remote add origin https://moundhub.com/moundshroud/<repo>.git',
        '  git diff | git show | git open'].join('\n');
    }
    if (sub === 'open') {
      const inCyber = typeof A !== 'undefined' && A.cur === 'cyber' && A.cyberDesktop && A.cyberDesktop.api && A.cyberDesktop.api.openSite;
      if (inCyber) A.cyberDesktop.api.openSite(MOUNDHUB_ORIGIN);
      else if (typeof A !== 'undefined' && A.lib && A.lib.hub) A.lib.hub();
      return 'Opened MoundHub (' + MOUNDHUB_ORIGIN + ') in the Browser.';
    }
    if (!S.unlocked()) return 'fatal: repositories are locked.\nOpen the Browser, go to ' + MOUNDHUB_ORIGIN + ' and enter the password there (the first one is Moundshroud), then try again.';
    if (sub === 'init') {
      const name = rest.find(x => !/^-/.test(x)) || cwdParts().slice(-1)[0] || 'app';
      const made = S.create({ name });
      const url = hubRepoUrl(made);
      S.setRemote(made.id, 'origin', url);
      staged.clear();
      refreshMoundHubFrames();
      return 'Initialized empty MoundHub repository ' + made.name + ' (branch main).\nRemote origin → ' + url + '\nOpen the Browser and go to ' + MOUNDHUB_ORIGIN + ' to view it.';
    }
    if (sub === 'clone') {
      const target = rest.find(x => !/^-/.test(x)) || '';
      if (!target) return 'usage: git clone https://moundhub.com/moundshroud/<repo>.git   (or: git clone <repo-slug>)';
      if (looksLikeUrl(target) && !isMoundHubUrl(target)) return hubOnlyError('clones from');
      const slug = target.replace(/^(?:https?:\/\/)?(?:www\.)?moundhub\.com\/?/i, '')
        .replace(/\.git$/i, '').split('/').filter(Boolean).pop() || '';
      const found = S.list().find(r => r.slug.toLowerCase() === slug.toLowerCase() || r.name.toLowerCase() === slug.toLowerCase());
      if (!found) return 'fatal: repository \'' + target + '\' not found on MoundHub (' + MOUNDHUB_ORIGIN + ').\nAvailable on MoundHub: ' + (S.list().map(r => r.slug).join(', ') || '(none yet — run `git init <name>`)');
      S.setCurrent(found.id);
      const files = S.treeOf(found);
      const incoming = {};
      let n = 0;
      for (const [rel, text] of Object.entries(files)) {
        incoming[PREFIX + rel] = String(text == null ? '' : text);
        overlay.files[rel] = String(text == null ? '' : text);
        n++;
      }
      if (room && room.applyFiles && n) {
        room.applyFiles(incoming, []);
        snapshot = flat(room.snapshot().tree);
      }
      if (n) writeOverlay(overlay);
      staged.clear();
      refreshMoundHubFrames();
      return 'Cloning from ' + hubRepoUrl(found) + '…\nChecked out ' + n + ' file' + (n === 1 ? '' : 's') + ' from MoundHub repository \'' + found.name + '\' (branch ' + found.branch + ').';
    }
    const repo = S.current();
    if (!repo) return 'fatal: not a git repository (or any of the parent directories): .git\nRun `git init <name>` to make one on MoundHub (' + MOUNDHUB_ORIGIN + ', in the Browser).';
    const head = S.head(repo), tree = S.treeOf(repo);

    if (sub === 'status') {
      const changes = workingChanges();
      const stagedList = [...staged].filter(rel => rel in changes);
      const left = Object.keys(changes).filter(rel => !staged.has(rel));
      const out = ['On branch ' + repo.branch, head ? 'Your branch is up to date with \'origin/' + repo.branch + '\' (' + MOUNDHUB_ORIGIN + ').' : 'No commits yet (MoundHub: ' + hubRepoUrl(repo) + ')'];
      if (stagedList.length) {
        out.push('', 'Changes to be committed:', '  (use "git restore --staged <file>…" to unstage)');
        for (const rel of stagedList.slice(0, 60)) out.push('\t' + (changes[rel] == null ? 'deleted:    ' : (rel in tree ? 'modified:   ' : 'new file:   ')) + rel);
        if (stagedList.length > 60) out.push('\t…and ' + (stagedList.length - 60) + ' more');
      }
      if (left.length) {
        const gone = left.filter(rel => changes[rel] == null), fresh = left.filter(rel => changes[rel] != null && !(rel in tree)), mod = left.filter(rel => changes[rel] != null && rel in tree);
        if (mod.length || gone.length) {
          out.push('', 'Changes not staged for commit:', '  (use "git add <file>…" to update what will be committed)');
          for (const rel of mod.concat(gone).slice(0, 60)) out.push('\t' + (changes[rel] == null ? 'deleted:    ' : 'modified:   ') + rel);
        }
        if (fresh.length) {
          out.push('', 'Untracked files:', '  (use "git add <file>…" to include in what will be committed)');
          for (const rel of fresh.slice(0, 60)) out.push('\t' + rel);
          if (fresh.length > 60) out.push('\t…and ' + (fresh.length - 60) + ' more');
        }
      }
      if (!stagedList.length && !left.length) out.push('', 'nothing to commit, working tree clean');
      out.push('', '(MoundHub only: ' + MOUNDHUB_ORIGIN + ' · only files in this repository and files this shell changed are listed)');
      return out.join('\n');
    }

    if (sub === 'add') {
      const paths = rest.filter(x => !/^-/.test(x));
      const changes = workingChanges(), work = workFiles();
      const all = !paths.length || rest.includes('-A') || rest.includes('--all') || paths.some(p => p === '.' || p === './');
      let n = 0, missing = '';
      if (all) { for (const rel of Object.keys(changes)) if (!staged.has(rel)) { staged.add(rel); n++; } }
      else for (const p of paths) {
        const rel = normRel(p);
        const hits = rel ? Object.keys(changes).filter(r => r === rel || r.startsWith(rel + '/')) : Object.keys(changes);
        const named = rel ? Object.keys(work).filter(r => r === rel || r.startsWith(rel + '/')) : [];
        if (!hits.length && !named.length && !(rel in tree)) { missing = rel; continue; }
        for (const h of new Set(hits.concat(named))) if (!staged.has(h)) { staged.add(h); n++; }
      }
      if (!n) return missing ? 'fatal: pathspec \'' + missing + '\' did not match any files' : 'Nothing to add: ' + (paths.length ? 'those files are unchanged.' : 'nothing in this shell has changed.');
      return 'staged ' + n + ' file' + (n === 1 ? '' : 's') + '.';
    }

    if (sub === 'commit') {
      let msg = '';
      for (let i = 0; i < rest.length; i++) {
        const a = rest[i];
        if (a === '-m' || a === '--message') { msg = rest[i + 1] || ''; i++; }
        else if (/^--message=/.test(a)) msg = a.slice(10);
        else if (/^-m./.test(a)) msg = a.slice(2);
      }
      if (rest.includes('-a') || rest.includes('-am') || rest.includes('--all')) for (const rel of Object.keys(workingChanges())) staged.add(rel);
      const work = workFiles(), changes = {};
      let n = 0;
      for (const rel of staged) {
        if (!(rel in work)) { if (rel in tree) { changes[rel] = null; n++; } continue; }
        changes[rel] = work[rel]; n++;
      }
      if (!n) return 'nothing to commit (use "git add" to stage files) — no file in this shell has changed.';
      const made = S.commit(repo.id, msg || 'Update from moundshell', changes);
      if (made && made.error) {
        if (/nothing to commit/i.test(made.error)) { staged.clear(); return 'nothing to commit, working tree clean'; }
        return 'error: ' + made.error;
      }
      staged.clear();
      refreshMoundHubFrames();
      const count = Object.keys(made.changes || {}).length;
      return '[' + repo.branch + ' ' + made.short + '] ' + made.msg + '\n ' + count + ' file' + (count === 1 ? '' : 's') + ' changed — saved to MoundHub (' + hubRepoUrl(repo) + ')';
    }

    if (sub === 'push') {
      const nonFlags = rest.filter(x => !/^-/.test(x));
      if (nonFlags.some(x => looksLikeUrl(x) && !isMoundHubUrl(x))) return hubOnlyError('pushes to', repo);
      const want = nonFlags[0];
      const remoteName = want && !looksLikeUrl(want) ? want : 'origin';
      const existing = S.remote(repo.id, remoteName);
      if (existing && existing.url && !isMoundHubUrl(existing.url)) return hubOnlyError('pushes to', repo);
      if (!existing || !existing.url) S.setRemote(repo.id, remoteName, want && isMoundHubUrl(want) ? normalizeMoundHubUrl(want, repo) : hubRepoUrl(repo));
      const out = S.push(repo.id, remoteName);
      if (out && out.error) return 'error: ' + out.error;
      refreshMoundHubFrames();
      const where = (out.remote && out.remote.url) || hubRepoUrl(repo);
      return 'Enumerating objects: done.\nTo ' + where + '\n   ' + out.commit.short + '  ' + repo.branch + ' → ' + repo.branch + '\nPushed ' + out.commit.short + ' (' + out.commit.msg + ') to MoundHub in the Browser.';
    }

    if (sub === 'fetch' || sub === 'pull') {
      const nonFlags = rest.filter(x => !/^-/.test(x));
      if (nonFlags.some(x => looksLikeUrl(x) && !isMoundHubUrl(x))) return hubOnlyError(sub === 'pull' ? 'pulls from' : 'fetches from', repo);
      const want = nonFlags[0];
      const remoteName = want && !looksLikeUrl(want) ? want : 'origin';
      const existing = S.remote(repo.id, remoteName);
      if (existing && existing.url && !isMoundHubUrl(existing.url)) return hubOnlyError(sub === 'pull' ? 'pulls from' : 'fetches from', repo);
      const url = (existing && existing.url) || hubRepoUrl(repo);
      if (!head) return 'From ' + url + '\n(no commits on MoundHub yet for ' + repo.name + ')';
      const c = S.byId(repo, head);
      if (sub === 'fetch') return 'From ' + url + '\n * branch            ' + repo.branch + ' -> FETCH_HEAD (' + (c ? c.short + ' ' + c.msg : head) + ')';
      const files = S.treeOf(repo);
      const incoming = {};
      let n = 0;
      for (const [rel, text] of Object.entries(files)) {
        incoming[PREFIX + rel] = String(text == null ? '' : text);
        overlay.files[rel] = String(text == null ? '' : text);
        n++;
      }
      if (room && room.applyFiles && n) {
        room.applyFiles(incoming, []);
        snapshot = flat(room.snapshot().tree);
      }
      if (n) writeOverlay(overlay);
      return 'From ' + url + '\nUpdating ' + (c ? c.short : head) + ' (' + (c ? c.msg : '') + ')\nSynced ' + n + ' file' + (n === 1 ? '' : 's') + ' from MoundHub.';
    }

    if (sub === 'log') {
      const list = S.log(repo.id, 20);
      if (!list.length) return 'fatal: your current branch \'' + repo.branch + '\' does not have any commits yet';
      const one = rest.includes('--oneline');
      return list.map(c => one ? c.short + ' ' + c.msg
        : 'commit ' + c.id + '\nAuthor: ' + c.author + ' <' + c.email + '>\nDate:   ' + new Date(c.at).toString() + '\n\n    ' + c.msg + '\n').join(one ? '\n' : '\n');
    }

    if (sub === 'branch') return '* ' + repo.branch + (repo.commits.length ? '' : '\n  (no commits yet)');

    if (sub === 'remote') {
      const action = rest[0];
      if (action === 'add' || action === 'set-url') {
        const n = rest[1] || 'origin', url = rest[2] || '';
        if (url && !isMoundHubUrl(url)) return hubOnlyError('connects to', repo);
        const norm = normalizeMoundHubUrl(url, repo);
        S.setRemote(repo.id, n, norm);
        refreshMoundHubFrames();
        return 'remote ' + n + ' → ' + norm + ' (MoundHub)';
      }
      if (action === 'remove' || action === 'rm') {
        S.removeRemote(repo.id, rest[1] || 'origin');
        refreshMoundHubFrames();
        return 'removed remote ' + (rest[1] || 'origin');
      }
      const list = (repo.remotes && repo.remotes.length) ? repo.remotes : [{ name: 'origin', url: hubRepoUrl(repo) }];
      const v = rest.includes('-v');
      return list.map(r => {
        const u = isMoundHubUrl(r.url) ? normalizeMoundHubUrl(r.url, repo) : hubRepoUrl(repo);
        return v ? r.name + '\t' + u + ' (fetch)\n' + r.name + '\t' + u + ' (push)' : r.name + '\t' + u;
      }).join('\n');
    }

    if (sub === 'diff') {
      const work = workFiles(), rels = staged.size ? [...staged] : Object.keys(workingChanges());
      const out = [];
      for (const rel of rels.slice(0, 40)) {
        const before = rel in tree ? String(tree[rel]) : null, after = rel in work ? String(work[rel]) : null;
        if (before === after) continue;
        out.push('diff --git a/' + rel + ' b/' + rel);
        if (before == null) out.push('new file mode 100644');
        if (after == null) out.push('deleted file mode 100644');
        if (before != null) out.push('--- a/' + rel);
        if (after != null) out.push('+++ b/' + rel);
        const bl = before == null ? [] : before.split('\n'), al = after == null ? [] : after.split('\n');
        out.push('@@ -' + (bl.length ? 1 : 0) + ',' + bl.length + ' +' + (al.length ? 1 : 0) + ',' + al.length + ' @@');
        for (const l of bl.slice(0, 150)) out.push('-' + l);
        for (const l of al.slice(0, 150)) out.push('+' + l);
      }
      return out.join('\n') || 'no changes';
    }

    if (sub === 'show') {
      const c = head ? S.byId(repo, head) : null;
      if (!c) return 'fatal: your current branch does not have any commits yet';
      return 'commit ' + c.id + '\nAuthor: ' + c.author + ' <' + c.email + '>\n\n    ' + c.msg + '\n\n' + Object.keys(c.changes || {}).map(rel => '    ' + rel).join('\n');
    }

    if (sub === 'restore' || sub === 'reset') {
      if (rest.includes('--staged')) {
        const want = rest.filter(x => !/^-/.test(x));
        if (!want.length) staged.clear(); else for (const p of want) staged.delete(normRel(p));
        return 'unstaged.';
      }
      return 'reset is not available here: commits are already saved on MoundHub (' + MOUNDHUB_ORIGIN + ').';
    }

    return 'git: \'' + sub + '\' is not available in this shell. MoundHub git supports: init, clone, status, add, commit, push, fetch, pull, log, branch, remote, diff, show, restore, open.';
  }

  /* ---- the Browser and the offline libraries it holds --------------------------------------------------------- */
  /* The shell can see what the Browser has on this PC: the libraries you imported by their page source (kept in
     data/my-library and served at /api/lib/mine/<id>.html) and the reference libraries that came with the app.
     Reading a page really fetches it from this app's own server: every byte is on this computer, and nothing leaves it. */
  async function browserItems() {
    const items = [];
    try {
      const r = await fetch('/api/lib/mine', { cache: 'no-store' });
      const d = await r.json();
      for (const lib of (d && d.libraries) || []) {
        items.push({ kind: 'mine', id: lib.id, title: lib.title || lib.id, url: '/api/lib/mine/' + lib.id + '.html', bytes: lib.bytes || 0, at: lib.at || 0 });
      }
    } catch (e) { /* no imports yet */ }
    try {
      const r = await fetch('/api/lib/books', { cache: 'no-store' });
      const d = await r.json();
      for (const book of (d && d.books) || []) {
        items.push({ kind: 'book', id: book.name, title: book.title || book.name, url: '', mb: book.sizeMB || 0, category: book.category || '' });
      }
    } catch (e) { /* no bundled libraries */ }
    items.forEach((item, i) => { item.n = i + 1; });
    return items;
  }
  /* the Cyber Desktop's fake internet, seen from the moundshell: every website in the Cyber Desktop browser — all
     generated sites (both safe and booby-trapped with fake viruses), any custom domain, search.moundshroud.example,
     moundhub.com, imported libraries and reference books — resolves through one mapper so every moundshell command
     answers accurately for every site. */
  const HUB_HOST = 'moundhub.com';
  const isHubTarget = raw => {
    const s = String(raw == null ? '' : raw).trim().toLowerCase();
    return /^(?:https?:\/\/)?(?:www\.)?moundhub\.com(?:\/|$)/i.test(s) || s === 'moundhub' || s === '/web/moundhub.html';
  };
  function fakeWorld() {
    const CW = (typeof A !== 'undefined' && A && A.cyberWeb) || (typeof window !== 'undefined' && window.A && window.A.cyberWeb) || null;
    if (!CW) return { CW: null, sites: [] };
    try { if (CW.ensure) CW.ensure(); } catch (e) { }
    let sites = [];
    try { sites = (CW.all ? CW.all() : []) || []; } catch (e) { sites = []; }
    return { CW, sites };
  }
  /* ---- the sanctuary rule: church websites cannot be hacked from this shell -------------------------------- */
  /* The fake internet's churches are off limits: a small module holds the list of KJV verses and the popup storm, and
     every site tool below asks it first. Nothing is sent anywhere — the popups are DIVs inside this page. */
  function churchApi() { return (typeof A !== 'undefined' && A && A.cyberChurch) || null; }
  function isChurchSite(site) { const C = churchApi(); try { return !!(C && site && C.isChurch(site)); } catch (e) { return false; } }
  function sanctuary(tool, site) {
    const C = churchApi();
    return C ? C.punish(tool, site) : '\u26ea This is a church website — no tool in this shell will touch it.';
  }
  function currentBrowserUrl() {
    try {
      const lib = typeof A !== 'undefined' ? A.lib : null;
      const cur = lib && lib.current ? lib.current() : null;
      return (cur && cur.url) || '';
    } catch (e) { return ''; }
  }
  function hubSiteObject() {
    const S = repoStore();
    const unlocked = !!(S && S.unlocked && S.unlocked());
    const repos = unlocked && S.list ? S.list() : [];
    return {
      id: -1, hub: true, brand: 'MoundHub', host: HUB_HOST, ip: '127.0.0.1', kind: 'Repositories',
      tagline: 'Your local git repositories, shared with moundshell.', token: 'moundhub',
      trapped: false, virus: null,
      cat: { id: 'hub', icon: '🔖', label: 'Repositories', route: '/repos', routeLabel: 'Repositories' },
      users: [{ id: 1, name: 'moundshroud', email: 'moundshroud@moundhub.com', role: 'admin', api_key: 'local-store-only' }],
      items: repos.map(r => ({ name: r.name, price: '0.00', stock: (r.commits || []).length })),
      posts: [], orders: [], adminPath: '/settings', adminLogin: 'moundshroud', adminPass: '',
      apiKey: '', flag: '', session: { admin: unlocked }, createdAt: Date.now()
    };
  }
  function serveHub(path) {
    const S = repoStore();
    const unlocked = !!(S && S.unlocked && S.unlocked());
    const repos = unlocked && S.list ? S.list() : [];
    const clean = String(path || '/').split('?')[0];
    if (clean === '/robots.txt') return { status: 200, type: 'text/plain', body: 'User-agent: *\nDisallow: /settings\nAllow: /\n' };
    if (clean === '/api/repos') {
      return unlocked
        ? { status: 200, type: 'application/json', body: JSON.stringify(repos.map(r => ({ id: r.id, name: r.name, slug: r.slug, branch: r.branch, commits: (r.commits || []).length })), null, 2) }
        : { status: 401, type: 'application/json', body: '{"error":"MoundHub is locked — unlock at https://moundhub.com"}' };
    }
    const list = unlocked
      ? (repos.length ? '<ul>' + repos.map(r => '<li><b>' + esc(r.name) + '</b> (branch ' + esc(r.branch) + ', ' + (r.commits || []).length + ' commits)</li>').join('') + '</ul>'
        : '<p>Unlocked — no repositories yet. Run <code>git init &lt;name&gt;</code> in moundshell.</p>')
      : '<p>Locked. Open <b>https://moundhub.com</b> in the Browser and sign in (default password: <code>Moundshroud</code>).</p>';
    return {
      status: 200, type: 'text/html',
      body: '<!doctype html><html><head><title>MoundHub</title></head><body><h1>MoundHub</h1><p>Local repository site shared with moundshell git.</p>' + list + '</body></html>'
    };
  }
  function splitTargetPath(raw) {
    const clean = String(raw == null ? '' : raw).trim().replace(/^[a-z]+:\/\//i, '').split('#')[0];
    const cut = clean.indexOf('/');
    const hostPort = (cut < 0 ? clean : clean.slice(0, cut)).toLowerCase().replace(/^www\./, '');
    return { host: hostPort.replace(/:\d+$/, ''), path: cut < 0 || !clean.slice(cut) ? '/' : clean.slice(cut) };
  }
  function fakePick(CW, want, opts) {
    const key = String(want == null ? '' : want).trim();
    if (!key) return null;
    if (/^(?:current|@current|active|here)(?:[\/?#]|$)/i.test(key)) {
      const cur = currentBrowserUrl();
      if (!cur) return null;
      /* current/robots.txt or current?q=bank: the open tab, plus a path on that same site */
      const tail = key.replace(/^(?:current|@current|active|here)/i, '');
      return fakePick(CW, cur.replace(/\/+$/, '') + (tail.charAt(0) === '?' ? '/' + tail : tail), opts);
    }
    if (isHubTarget(key)) {
      const p = splitTargetPath(key).path;
      return { site: hubSiteObject(), path: p || '/', hub: true };
    }
    if (!CW) return null;
    if (/^\d+$/.test(key)) return null;
    if (CW.resolve) {
      const hit = CW.resolve(key, opts);
      if (hit && hit.site) return hit;
    }
    try { const at = CW.locate(key.replace(/^https?:\/\//i, '')); if (at && at.site) return at; } catch (e) { }
    try { const site = CW.find(key); return site ? { site, path: splitTargetPath(key).path || '/' } : null; } catch (e) { return null; }
  }
  function serveTarget(at, method) {
    if (!at || !at.site) return { status: 404, type: 'text/plain', body: 'not found' };
    if (at.hub || at.site.hub) return serveHub(at.path || '/');
    const world = fakeWorld();
    return world.CW && world.CW.serve ? world.CW.serve(at.site, at.path || '/', method || 'GET') : { status: 503, type: 'text/plain', body: 'fake internet unavailable' };
  }
  /* No listing, header or page read announces a trap: a site only gives itself away to the scan tools
     (`virus scan`, nikto, gobuster, whatweb, nmap) or by reading the script it injects. */
  const TRAP_SCAN_HINT = 'There is no index of infected websites — that is the point of the exercise. Scan one instead:\n' +
    '  virus scan <host|current>          check one site for a simulated pop-up trap\n' +
    '  nikto -h <host>                    a scanner\'s view of the same page\n' +
    '  whatweb <host> · gobuster dir -u https://<host>    the stack and every route it serves';
  const trapTag = () => '';
  /* the library a page belongs to, from the Browser's own numbering, so the shell and the address bar agree */
  function libOfUrl(url) {
    try { const lib = typeof A !== 'undefined' ? A.lib : null; return lib && lib.libraryOf ? lib.libraryOf(url) : null; } catch (e) { return null; }
  }
  const libLine = info => info ? 'Library ' + (info.no || '?') + ' · ' + info.name + (info.note ? ' (' + info.note + ')' : '') : 'not in a library';
  function fakeRead(item, source) {
    const world = fakeWorld();
    if (!item.hub && !world.CW) return 'The fake internet is not loaded yet — try again in a moment.';
    const at = item.site ? { site: item.site, path: item.path || '/', hub: !!item.hub || !!item.site.hub } : fakePick(world.CW, item.id);
    if (!at) return 'browser: that site is not on the fake internet. Type browser for the list, or browser read web for a random site.';
    const r = serveTarget(at, 'GET');
    const html = String(r.body == null ? '' : r.body), facts = pageFacts(html);
    const url = 'https://' + at.site.host + (at.path || '/');
    const head = ['HTTP ' + r.status + ' · ' + (r.type || 'text/html') + ' · ' + fmtBytes(html.length) + ' · ' + url + (at.site.ip ? ' (' + at.site.ip + ')' : ''),
      'Library: ' + libLine(libOfUrl(url)),
      'Title: ' + (facts.title || at.site.brand || '(none)'),
      'Page: ' + facts.h1 + ' h1 · ' + facts.h2 + ' h2 · ' + facts.links + ' links · ' + facts.forms + ' form' + (facts.forms === 1 ? '' : 's') +
      ' · ' + facts.inputs + ' inputs · ' + facts.scripts + ' script' + (facts.scripts === 1 ? '' : 's')]

      .concat([at.hub || at.site.hub
        ? 'MoundHub: the app\'s own local repository website (shared with moundshell git).'
        : 'A generated site from the Cyber Desktop\'s fake internet: invented here, and nothing was contacted.', '']).join('\n');
    if (source || !/html/i.test(r.type || 'text/html')) return head + html.slice(0, 6000) + (html.length > 6000 ? '\n… ' + fmtBytes(html.length - 6000) + ' more (browser read gives the text)' : '');
    const text = pageText(html), lines = text.split('\n');
    return head + (lines.length > 80 ? lines.slice(0, 80).join('\n') + '\n… ' + (lines.length - 80) + ' more lines' : text);
  }
  function browserPick(items, want) {
    const key = String(want == null ? '' : want).trim();
    if (!key) return null;
    if (/^\d+$/.test(key)) return items[+key - 1] || null;
    const low = key.toLowerCase();
    const page = item => (item.kind === 'mine' ? item.url : '/wiki/random?content=' + item.id).toLowerCase();
    return items.find(item => String(item.id).toLowerCase() === low || String(item.title).toLowerCase() === low) ||
      items.find(item => page(item).includes(low) || String(item.title).toLowerCase().includes(low)) || null;
  }
  const fmtWhen = at => { try { return new Date(at).toLocaleDateString(); } catch (e) { return ''; } };

  function browserList(items, fake) {
    const mine = items.filter(item => item.kind === 'mine'), books = items.filter(item => item.kind === 'book');
    const out = ['THE BROWSER ON THIS COMPUTER — offline material and Cyber Desktop websites, every byte on this PC', ''];
    const curUrl = currentBrowserUrl();
    if (curUrl) {
      const curAt = fake && fake.CW ? fakePick(fake.CW, curUrl, { create: false }) : null;
      out.push('  CURRENTLY OPEN: ' + curUrl + (curAt && curAt.site ? '  (' + curAt.site.brand + ')' : ''), '');
    }
    if (mine.length) {
      out.push('  YOUR LIBRARIES — imported by their page source (' + mine.length + ')');
      for (const item of mine) out.push('    ' + String(item.n).padStart(2) + '. ' + item.title + '  ·  ' + fmtBytes(item.bytes) + '  ·  ' + fmtWhen(item.at) + '  ·  ' + item.url);
      out.push('');
    }
    if (books.length) {
      out.push('  REFERENCE LIBRARIES that came with the app (' + books.length + ')');
      for (const item of books.slice(0, 30)) out.push('    ' + String(item.n).padStart(2) + '. ' + item.title + '  ·  ' + item.mb + ' MB  ·  ' + item.category +
        (typeof A !== 'undefined' && A.cyberFlags ? '  ·  ' + A.cyberFlags.libFlag(item) : ''));
      if (books.length > 30) out.push('    …and ' + (books.length - 30) + ' more');
      out.push('');
    }
    out.push('  BUILT-IN BROWSER SITES',
      '      Moundshroud Search   ·  https://search.moundshroud.example  (10.14.0.1 · indexes every fake site)', '',
      '  YOUR REPOSITORY STORE (not a target)',
      '      MoundHub             ·  https://moundhub.com  (your own commits — read it in the Browser, write it with git)', '');
    if (fake && fake.CW && fake.sites.length) {
      out.push('  THE FAKE INTERNET — generated sites from the Cyber Desktop (' + fake.sites.length + ' sites)');
      for (const site of fake.sites.slice(0, 12)) out.push('    ' + String(site.id).padStart(3) + '. ' + site.brand + '  ·  ' + site.host + '  (' + site.ip + ')  ·  ' + site.kind + trapTag(site));
      if (fake.sites.length > 12) out.push('      …and ' + (fake.sites.length - 12) + ' more — use `browser sites [query]` to search them all');
      out.push('');
    }
    const darks = fake && fake.CW && fake.CW.dark ? fake.CW.dark() : [];
    if (darks.length) {
      out.push('  THE FAKE DARK WEB — onion-only hidden services (' + darks.length + ' services · ' +
        darks.filter(s => s.market).length + ' markets, the rest sell nothing)');
      for (const site of darks) out.push('    ' + String(site.id).padStart(3) + '. ' + site.brand + '  ·  ' + site.host + '  (' + site.ip + ')  ·  ' + site.kind + (site.market ? ' · market' : ' · no sales'));
      out.push('      `browser dark [query]` lists them · `browser read|open <host>` works on every one · curl/wget/nmap/paths/breach too', '');
    }
    out.push('  browser read <n|host|url|current>    read any page or fake website (status, title, text)',
      '  browser source <n|host|url|current>  raw HTML/JSON/text source of any page or fake website',
      '  browser open <n|host|url|current>    open any site in the Browser (works on Cyber Desktop too)',
      '  browser sites [query]                list or search generated Cyber Desktop websites',
      '  browser virus                        how to scan a site yourself (no list of infected ones)',
      '  browser dark [query]                 the Fake Dark Web: every .onion hidden service in the onion section',
      '  browser tabs                         the pages the Browser has open right now',
      '  breach <n|host|web [n]|virus [n]>    simulated engagement against ANY browser website or library',
      '  curl · wget · nmap · whatweb · nikto · gobuster · sqlmap · dig · whois · ping · paths · tool · virus  all work on every website!');
    return out.join('\n');
  }

  function browserTabs() {
    const lib = typeof A !== 'undefined' && A.lib ? A.lib : null;
    if (!lib || !lib.tabs) return 'The Browser is not loaded yet — open it once, then try again.';
    let tabs = [], cur = null;
    try { tabs = lib.tabs() || []; } catch (e) { tabs = []; }
    try { cur = lib.current ? lib.current() : null; } catch (e) { cur = null; }
    if (!tabs.length) return 'The Browser has no page open right now.';
    return ['OPEN IN THE BROWSER — ' + tabs.length + ' tab' + (tabs.length === 1 ? '' : 's') +
      (cur && cur.url ? ' · showing: ' + (cur.title || '(no title)') + ' — ' + cur.url : ''), '']
      .concat(tabs.map((tab, i) => '  ' + String(i + 1).padStart(2) + '. ' + (tab.title || '(no title)') + (tab.url ? '  ·  ' + tab.url : '')))
      .join('\n');
  }

  /* the page as text, so reading a library here feels like curling a site rather than dumping HTML */
  function pageText(html) {
    return String(html)
      .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<!--[\s\S]*?-->/g, ' ')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|h\d|li|tr|section|article|header|footer|nav|table|form|blockquote)>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&')
      .replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  }
  function pageFacts(html) {
    const title = (/<title[^>]*>([\s\S]*?)<\/title>/i.exec(html) || [])[1] || '';
    const count = tag => (String(html).match(new RegExp('<' + tag + '\\b', 'gi')) || []).length;
    return {
      title: pageText(title).replace(/\s+/g, ' ').trim(),
      h1: count('h1'), h2: count('h2'), links: count('a'), forms: count('form'), inputs: count('input'), scripts: count('script')
    };
  }

  async function readPage(item, source) {
    if (item.kind === 'fake' || item.kind === 'hub') return fakeRead(item, source);
    if (!item.url) {
      return '“' + item.title + '” is one of the bundled reference libraries (' + item.mb + ' MB), not a page file:\n' +
        '  browser open ' + item.n + '   opens it in the Browser\n' +
        '  breach ' + item.n + '        makes it the target of the simulated engagement';
    }
    let status = 0, html = '';
    try {
      const r = await fetch(item.url, { cache: 'no-store' });
      status = r.status;
      html = await r.text();
    } catch (e) {
      return 'browser: could not read ' + item.url + ' — ' + String(e && e.message || e);
    }
    const facts = pageFacts(html);
    const head = ['HTTP ' + status + ' · text/html · ' + fmtBytes(html.length) + ' · ' + item.url,
      'Library: ' + libLine(libOfUrl('/wiki/random?content=' + encodeURIComponent(item.id))),
      'Title: ' + (facts.title || '(none)'),
      'Page: ' + facts.h1 + ' h1 · ' + facts.h2 + ' h2 · ' + facts.links + ' links · ' + facts.forms + ' form' + (facts.forms === 1 ? '' : 's') +
      ' · ' + facts.inputs + ' inputs · ' + facts.scripts + ' script' + (facts.scripts === 1 ? '' : 's'), ''].join('\n');
    if (source) return head + html.slice(0, 6000) + (html.length > 6000 ? '\n… ' + fmtBytes(html.length - 6000) + ' more (browser read gives the text)' : '');
    const text = pageText(html);
    const lines = text.split('\n');
    return head + (lines.length > 80 ? lines.slice(0, 80).join('\n') + '\n… ' + (lines.length - 80) + ' more lines' : text);
  }

  async function openInBrowser(item) {
    const lib = typeof A !== 'undefined' && A.lib ? A.lib : null;
    if (!lib || !lib.openUrl) return 'The Browser is not loaded yet — try again in a moment.';
    try { if (lib.init) await lib.init(); } catch (e) { }
    const inCyber = typeof A !== 'undefined' && A.cur === 'cyber' && A.cyberDesktop && A.cyberDesktop.api && A.cyberDesktop.api.openSite;
    if ((item.kind === 'hub' || (item.site && item.site.hub))) {
      if (inCyber) A.cyberDesktop.api.openSite('https://' + HUB_HOST);
      else if (lib.hub) lib.hub();
      else lib.openUrl('https://' + HUB_HOST, 'MoundHub');
      return 'Opened MoundHub (https://moundhub.com) in the Browser.';
    }
    if (item.kind === 'fake' && item.site) {
      const url = 'https://' + item.site.host + (item.path || '/');
      if (inCyber) A.cyberDesktop.api.openSite(url);
      else if (lib.openSite) lib.openSite(url, item.title);
      else lib.openUrl(url, item.title);
      return 'Opened “' + item.title + '” (' + url + ') in the Browser. It is a generated site from the fake internet.';
    }
    if (item.url) lib.openUrl(item.url, item.title);
    else lib.openUrl('/wiki/random?content=' + encodeURIComponent(item.id), item.title);
    return 'Opened “' + item.title + '” in the Browser tab.';
  }

  function browserSiteList(fake, query, onlyVirus, onlyDark) {
    if (!fake || !fake.CW) return 'The fake internet is still loading — try again in a moment.';
    const q = String(query || '').trim();
    const darks = fake.CW.dark ? fake.CW.dark() : [];
    let list = q ? (onlyDark ? darks.filter(s => (s.brand + ' ' + s.host + ' ' + s.kind + ' ' + (s.tagline || '')).toLowerCase().includes(q.toLowerCase())) : fake.CW.search(q, 80)) : (onlyDark ? darks : fake.sites);
    if (onlyVirus) return TRAP_SCAN_HINT;
    const total = onlyDark ? darks.length : fake.sites.length;
    const head = (onlyDark ? 'FAKE DARK WEB — onion-only hidden services' : 'CYBER DESKTOP FAKE INTERNET') +
      (q ? ' matching “' + q + '”' : '') + ' · ' + list.length + ' shown of ' + total + ' total';
    if (!list.length) return head + '\n  No sites matched. Type any made-up domain (e.g. `browser open mysite.shop`) and it will be created.';
    return [head, ''].concat(
      list.slice(0, 40).map(s => '  ' + String(s.id).padStart(3) + '. ' + s.host.padEnd(28) + ' ' + s.ip.padEnd(13) + ' ' + s.brand + ' (' + s.kind + ')'),
      list.length > 40 ? ['', '  …and ' + (list.length - 40) + ' more. Narrow with a keyword: `browser ' + (onlyVirus ? 'virus' : 'sites') + ' <word>`.'] : [],
      ['', '  Every site works with: browser read|source|open|breach <host> · curl · wget · nmap · whatweb · nikto · gobuster · sqlmap · dig · whois · paths · tool · virus scan'],
      ['', '  Every site LEAKS its users at /dump/users.csv (names, e-mails, session IPs, passwords): `leaked <host>` prints it,'],
      ['', '  `nmap <ip>` finds that user\'s PC and `ssh user@<ip>` (with the password from the dump) opens it: ls, cat, grep, exit.']
    ).join('\n');
  }

  async function browserCommand(rest) {
    const w = argvOf(rest);
    const sub = (w[0] || 'list').toLowerCase();
    const tail = w.slice(1).join(' ').trim();
    const items = await browserItems();
    const fake = fakeWorld();
    if (sub === 'list' || sub === 'ls' || sub === 'all') return browserList(items, fake);
    if (sub === 'tabs' || sub === 'windows') return browserTabs();
    if (sub === 'sites' || sub === 'web' || sub === 'fake' || sub === 'search') return browserSiteList(fake, tail, false);
    if (sub === 'virus' || sub === 'trapped' || sub === 'malware') return browserSiteList(fake, tail, true);
    if (sub === 'dark' || sub === 'darkweb' || sub === 'onion' || sub === 'onions') return browserSiteList(fake, tail, false, true);
    /* every website in the Cyber Desktop browser (generated sites, trapped fake-virus sites, custom domains,
       search.moundshroud.example, moundhub.com, current tab, imported pages, reference libraries) answers here */
    if (['read', 'cat', 'source', 'src', 'open', 'go', 'breach', 'pentest'].includes(sub)) {
      const targetArg = tail || (/^(?:read|cat|source|src)$/.test(sub) ? 'current' : '');
      if (sub === 'breach' || sub === 'pentest') return await startBreach(targetArg);
      const item = browserPick(items, targetArg);
      if (item) {
        if (sub === 'read' || sub === 'cat') return await readPage(item, false);
        if (sub === 'source' || sub === 'src') return await readPage(item, true);
        return await openInBrowser(item);
      }
      const at = fakePick(fake.CW, targetArg, { create: true });
      if (at && at.site) {
        const site = { kind: at.hub ? 'hub' : 'fake', hub: !!at.hub, id: at.site.host, title: at.site.brand, site: at.site, path: at.path, n: 'web' };
        if (sub === 'read' || sub === 'cat') return fakeRead(site, false);
        if (sub === 'source' || sub === 'src') return fakeRead(site, true);
        return await openInBrowser(site);
      }
      return (targetArg ? 'browser ' + sub + ': nothing matches “' + targetArg + '”.\n' : 'browser ' + sub + ': name a page number, slug, host, URL, `web <n>`, `virus <n>`, or `current`.\n') +
        'Type `browser` to list libraries and sites; `virus scan <host>` checks one site for a trap.';
    }
    return 'usage: browser [list|tabs|sites [q]|virus [q]] · browser read|source|open|breach <n|slug|host|url|web [n]|virus [n]|current>\nType browser for the list.';
  }

  /* ---- `paths`: the checklist a tester runs on a website ------------------------------------------------------- */
  /* None of these names are secrets: they are the ordinary things a web server answers for, in the order a tester
     checks them. On the Cyber Desktop's fake internet each one found pays the practice bank once. Everything is
     simulated inside this page, and nothing is requested from anywhere. */
  const PATHS = [
    ['/robots.txt', 'the pages the owner told search engines to skip: the Disallow lines name the hidden folders', 8],
    ['/.env', 'a config file left in the web root: usually the DB password, often the admin path or staff credentials too', 45],
    ['/login', 'sign in with the staff email and password the .env printed (or SQLi bypass)', 60],
    ['/<staff path>', 'the random folder robots.txt named. 403 means it is there but needs the sign-in', 20],
    ['/<staff path>/content', 'staff home-page editor (available once signed in)', 0],
    ['/<staff path>/backup.zip', 'inside the staff area: an old copy with the JWT secret and the credentials again', 90],
    ['/api/users', 'a JSON list of every account and its API key', 25],
    ['/api/orders/<id>', 'an order that is not yours: the ownership check is missing (IDOR)', 35],
    ['/api/search?q=\'', 'a quote in the search box — a SQL error means the query is glued together', 40],
    ['/sitemap.xml', 'the pages the site wants found; the interesting half is the ones it does not', 0],
    ['/admin', 'the usual name for the staff area. /staff, /backoffice and /ops are worth trying too', 0],
    ['/uploads', 'uploaded files, sometimes listed and sometimes executable', 0]
  ];
  function pathsCommand(rest) {
    const want = String(rest == null ? '' : rest).trim();
    const { CW } = fakeWorld();
    let host = '', brand = '', targetSite = null;
    if (want) {
      const at = fakePick(CW, want, { create: true });
      if (!at || !at.site) return 'paths: “' + want + '” is not a recognised website.\nName any host from the Cyber Desktop browser, `paths web`, `paths virus`, or `paths current`. MoundHub is not a target.';
      if (isChurchSite(at.site)) return sanctuary('paths', at.site);
      targetSite = at.site; host = targetSite.host; brand = targetSite.brand;
    }
    const out = [host ? 'PATHS TO TRY · ' + brand + ' · ' + host + (targetSite && targetSite.ip ? ' (' + targetSite.ip + ')' : '') + trapTag(targetSite) : 'PATHS TO TRY · the checklist, for any site'];
    out.push('  Nothing here is a secret. These are the ordinary things a web server answers for, in the order a');
    out.push('  tester checks them. ' + (host ? 'Open them in the Cyber Desktop browser, or read them from here with curl.' : 'Give  paths <host>  and the list comes back as addresses you can type.'));
    out.push('');
    if (targetSite && targetSite.hub) {
      return 'paths: MoundHub is your own repository store, not a target.\n' +
        '  Its pages show the commits you made here: open https://moundhub.com in the Browser to read them, and use git from this shell to write them.\n' +
        '  There is nothing on it to scan, so no path list is offered. Name a fake-internet host instead.';
    } else if (targetSite && targetSite.portal) {
      [['/', 'Moundshroud Search portal home'], ['/?q=bank', 'search every generated site'], ['/robots.txt', 'crawler rules']].forEach(([p, why]) => {
        out.push('  https://' + host + p, '      ' + why);
      });
    } else if (targetSite && /^ghostleaks\.onion$/i.test(host) && typeof A !== 'undefined' && A.cyberLeaks) {
      /* the leak site is an archive: every batch and every published file in it has its own address */
      const LK = A.cyberLeaks, batch = LK.archive[0];
      out.push('  WHAT THE LEAK SITE PUBLISHES (' + LK.count() + ' batches · ' + LK.files() + ' files)');
      LK.paths().forEach(p => out.push('  https://' + host + p));
      out.push('  https://' + host + '/raw/<batch>/<file>', '      every file a batch lists: curl it, or wget it and read it back');
      if (batch) batch.docs.slice(0, 6).forEach(d => out.push('      https://' + host + '/raw/' + batch.slug + '/' + d.path));
      out.push('');
    } else if (targetSite && targetSite.dark && CW.dirScan) {
      /* a hidden service answers only its own routes: a scan lists those, and nothing is invented */
      const found = CW.dirScan(targetSite);
      out.push('  WHAT THIS HIDDEN SERVICE ANSWERS (' + found.length + ' paths)' );
      found.forEach(f => {
        out.push('  https://' + host + f.path);
        out.push('      ' + f.status + ' · ' + String(f.size) + ' bytes' + (f.note ? ' · ' + f.note : ''));
      });
      out.push('');
    } else {
      const orderId = targetSite && targetSite.orders && targetSite.orders[0] ? targetSite.orders[0].id : '<id>';
      if (targetSite && targetSite.cat && targetSite.cat.route) {
        out.push('  https://' + host + targetSite.cat.route, '      the site\'s main ' + targetSite.cat.routeLabel + ' section');
      }
      const leakPaths = (targetSite && targetSite.sec && targetSite.sec.leaks) ? targetSite.sec.leaks.map(f => f.path) : [];
      if (targetSite && targetSite.sec) {
        const sec = targetSite.sec, tier = sec.difficulty;
        out.push('  HOW EXPOSED IS THIS ONE?   ' + tier);
        if (tier === 'extremely-easy' || tier === 'easy') {
          leakPaths.forEach(p => out.push('  https://' + host + p));
          out.push('      the configuration files this site left in the web root: directory scanning and guessing both find them');
        } else if (tier === 'medium') {
          out.push('  https://' + host + (sec.secretPath || leakPaths[0]));
          out.push('      a scan finds this one; the rest is spread over ' + Math.max(1, leakPaths.length - 1) + ' other file(s) you have to guess');
        } else {
          out.push('  none by name — a wordlist mostly returns 404s on a site run this carefully');
          out.push('      the trail starts at https://' + host + (sec.cluePath || '/robots.txt') +
            (sec.hopPath ? ', which points at ' + sec.hopPath : '') + ': read it, follow what it names');
        }
        out.push('');
      }
      PATHS.forEach(([p, why, money]) => {
        const easyish = targetSite && targetSite.sec && /easy/.test(targetSite.sec.difficulty);
        const shown = p === '/.env' && easyish && leakPaths.length ? leakPaths[0] : p.replace('<id>', String(orderId));
        out.push('  ' + (host ? 'https://' + host + shown : p));
        out.push('      ' + why + (host && money ? '   ·   pays $' + money : ''));
      });
    }
    out.push('');
    out.push('  HOW TO READ THE ANSWER');
    out.push('    200 the page is there · 403 it exists and needs the sign-in first · 404 that name is not on this site');
    out.push('');
    if (!host) {
      out.push('  paths <host|url>    the same checklist as addresses for one site, e.g.  paths amberbasket.shop');
      out.push('  paths web           pick a random site from the Cyber Desktop\'s fake internet');
      out.push('  paths virus         the same checklist for a site picked at random');
      out.push('  paths current       checklist for the website currently open in the Browser');
      out.push('  targets             every site and page a breach can be pointed at');
    } else {
                if (targetSite && A.cyberPcs) {
            const users = A.cyberPcs.roster(targetSite);
            if (users.length) {
              out.push('  https://' + host + '/dump/users.csv', '      the user table a backup script left in the web root: ' + users.length + ' accounts, their IPs and their passwords');
              out.push('      nmap ' + users[0].ip + '   ·   ssh ' + users[0].handle + '@' + users[0].ip + '   (password in the dump)');
              out.push('');
            }
          }
          out.push('  next  breach ' + host + '   runs the full simulated engagement against this site');
      out.push('  try   curl -s https://' + host + '/robots.txt   ·   gobuster dir -u https://' + host);
      out.push('  note  every site hides it differently: the staff folder shows up in robots.txt, a leaked config, a JS bundle');
      out.push('        or a clue chain, depending on how well the site is run. Gobuster lists what is discoverable by name.');
    }
    out.push('  All of it is simulated inside this page; no request leaves the computer.');
    return out.join('\n');
  }

  /* ---- the breach range: a simulated engagement against your own offline pages -------------------------------- */
  /* Every page the Browser holds becomes a target in the Pentest range the playground already ships, mounted here in
     the mound shell. An imported page's own source is the target's front page — the thing being broken into is your
     material — while every host, user, secret, endpoint and shell behind it is invented and lives inside this page.
     No socket is opened, no site or PC is contacted, and the library file is never changed. */
  let breach = null, breachItem = null;
  /* a remote session on a leaked user PC: pcSession owns every line until exit, pcAuth is the password prompt */
  let pcSession = null, pcAuth = null;
  /* An open range is still the moundshell. Its prompt is the session’s real identity (kali@pentest only when the
     Cyber VM signed this shell in), and every command the range does not program is handed to the app’s own bash,
     so ls, cat, echo, python, git and the rest never become “command not found” just because a range is open. */
  const rangeOptions = () => ({
    prompt: () => shellIdentity() + ':~$ ',
    /* a range download is written into this shell's own files, so the next ls, cat, unzip or python run
       sees the same bytes the range reported (same writer the moundshell's wget and curl -o use) */
    saveFile: (name, body) => {
      const rel = normRel(name);
      if (!rel || !room || !room.applyFiles) return rel || String(name || '');
      room.applyFiles({ [PREFIX + rel]: String(body == null ? '' : body) }, []);
      return rel;
    },
    fallback: line => {
      if (!room) return 'bash: the shell is still loading — try again in a moment.';
      try {
        const git = gitCommand(line);
        if (git !== null) return git;
        const before = snapshot;
        const text = room.run(line);
        snapshot = flat(room.snapshot().tree);
        try { persist(before, snapshot); } catch (e) { }
        return text;
      } catch (e) { return 'bash: ' + String(e && e.message || e); }
    }
  });

  /* ---- `solve`: a FLAG from any fake website, Browser library or Open Range PC pays the practice bank -------- */
  async function solveCommand(rest) {
    const F = (typeof A !== 'undefined' && A.cyberFlags) || null;
    if (!F) return 'solve: the Cyber Desktop is still loading — try again in a moment.';
    const text = String(rest == null ? '' : rest).trim();
    if (!text || /^(?:list|board|progress|help|\?)$/i.test(text)) return await F.board();
    let res;
    try { res = await F.submit(text); } catch (e) { return 'solve: ' + String(e && e.message || e); }
    const money = n => '$' + Number(n || 0).toFixed(2);
    if (res.status === 'paid') return '✓ FLAG accepted · ' + res.label + '\n' +
      '  +' + money(res.amount) + ' paid into the Cyber Desktop practice bank · balance ' + money(res.balance) + '\n' +
      '  Spend it in Cyber Desktop › Bank › Cosmetics shop.';
    if (res.status === 'known') return '✓ That flag was already submitted — each flag pays once. Balance ' + money(res.balance) + '.';
    if (res.status === 'malformed') return 'solve: a flag looks like FLAG{...} — paste the whole thing, braces included.\n' +
      'Type `solve` on its own to see where the flags are and how many you have submitted.';
    if (res.status === 'unavailable') return 'solve: the practice bank is not loaded yet — try again in a moment.';
    return 'solve: that flag is not on the Cyber Desktop\'s fake internet, its libraries or the Open Range.\n' +
      'Type `solve` on its own to see where the flags are.';
  }

  /* ---- `range`: the Open Range website's endless PCs, listed the way moundshell lists anything else ------------- */
  function rangeCommand(rest) {
    const { CW } = fakeWorld();
    const R = CW && CW.range;
    if (!R) return 'range: the Cyber Desktop is still loading — try again in a moment.';
    const want = String(rest == null ? '' : rest).trim();
    const ns = /^(\d+)$/.exec(want);
    const page = ns ? Math.max(1, +ns[1]) : 1;
    const machines = R.list(page, 14);
    const out = ['MOUNDSHROUD OPEN RANGE · ' + R.host + ' · page ' + page + ' of ∞ invented PCs', ''];
    out.push('  #     machine                             address          os · role                                tier');
    machines.forEach(m => out.push('  ' + String(m.n).padStart(4, '0') + '  ' + m.host.padEnd(34) + ' ' + m.ip.padEnd(16) + ' ' +
      (m.os + ' · ' + m.role).padEnd(39) + ' ' + m.tier));
    out.push('');
    out.push('  breach ' + machines[0].ip + '        start a simulated engagement against that PC');
    out.push('  breach ' + machines[0].host);
    out.push('  range ' + (page + 1) + '                 next page · range 1 is the first');
    out.push('  Open ' + R.pageUrl(page) + ' in the Browser for the full index and each PC\'s details.');
    out.push('  Owning a PC pays the practice bank; its FLAG (on the staff page) can be sent with `solve FLAG{...}`.');
    out.push('  Everything is invented in this page: no machine is contacted and no socket is opened.');
    return out.join('\n');
  }

  async function startBreach(want) {
    const TP = window.TerminalPlayground;
    if (!TP || !TP.makePentest || !TP.setPentestLibraries) return 'The range engine is still loading — try again in a moment.';
    const { CW } = fakeWorld();
    let asked = String(want == null ? '' : want).trim();
    /* `breach current` targets whatever website is open in the Cyber Desktop browser */
    if (/^(?:current|@current|active|here)$/i.test(asked)) asked = currentBrowserUrl() || 'web';
    /* check if `asked` refers to ANY Cyber Desktop browser website: fake site, trapped fake-virus site, custom domain,
       simulated IP, search.moundshroud.example, or moundhub.com */
    const explicitWeb = /^(?:web|virus|trapped|malware|portal|search)\b/i.test(asked) || isHubTarget(asked) ||
      /^https?:\/\//i.test(asked) || /^\d{1,3}(?:\.\d{1,3}){3}(?:\/|$)/.test(asked) || /\.[a-z]{2,12}(?::\d+)?(?:\/|$)/i.test(asked);
    const items = await browserItems();
    const libItem = !explicitWeb && asked ? browserPick(items, asked) : null;
    if (!libItem && asked) {
      let at = fakePick(CW, asked, { create: true });
      if (at && at.site && isChurchSite(at.site)) {
        if (/^(?:web|virus|trapped|malware|portal)$/i.test(asked)) {
          const C = churchApi();
          const alt = C ? C.elsewhere(at.site, /^(?:virus|trapped|malware)$/i.test(asked)) : null;
          if (alt) at = { site: alt, path: '/' };
        } else {
          return sanctuary('breach', at.site);
        }
      }
      if (at && at.site) {
        const fake = at.site;
        const html = at.hub ? serveHub('/').body : CW.homeHtml(fake);
        /* an Open Range PC keeps the address the range index gave it, so nmap/curl here match the website */
        const targetIp = (fake.range && fake.range.ip) || fake.ip;
        TP.setPentestLibraries([{ title: fake.brand + ' · ' + fake.host, name: fake.host, host: fake.host, ip: targetIp, html, cyberSite: at.hub ? null : fake }]);
        breach = TP.makePentest(rangeOptions());
        breachItem = { title: fake.brand + ' (' + fake.host + ')', host: fake.host, site: fake };
        const opened = breach.run('target 1');
        return 'BREACH RANGE · ' + fake.brand + ' · ' + fake.host + ' (' + (targetIp || '10.10.10.5') + ')\n' +
          (at.hub ? '  simulated engagement targeting a local mirror of MoundHub\n'
            : '  a generated site from the Cyber Desktop\'s fake internet: its front page, accounts, .env, APIs and backend are mapped here\n') +
          '\n' + opened + '\n\n' +
          'Every host, account, key, endpoint and fake box behind this site is invented in memory — no socket is opened and\n' +
          'nothing is contacted. Its staff area is reachable, and the deploy secret is waiting behind it.\n' +
          'Type guide for the walkthrough · help for the range commands · exit leaves the range.';
      }
      if (explicitWeb) {
        return 'breach: “' + asked + '” could not be resolved.\nTry `breach web`, `breach virus`, `breach <host>`, or `targets`.';
      }
    }
    if (!items.length) {
      /* no imported/reference libraries: target the currently open browser site or a fake site so `breach` always works */
      if (CW) return await startBreach(currentBrowserUrl() || 'web');
      return 'The Browser holds no libraries yet. Import one there first (📥 Import takes a page\'s source), then run breach again.';
    }
    const own = items.find(item => item.kind === 'mine');
    const cur = !asked ? currentBrowserUrl() : '';
    if (!asked && cur && fakePick(CW, cur, { create: false })) return await startBreach(cur);
    const key = asked || String((own || items[0]).n);
    const item = libItem || browserPick(items, key);
    if (!item) return 'No page or website matches “' + key + '”. Type `browser` or `targets` to list them.';
    let html = '';
    if (item.url) {
      try { const r = await fetch(item.url, { cache: 'no-store' }); if (r.ok) html = await r.text(); } catch (e) { html = ''; }
    }
    const libraries = items.map(it => ({ title: it.title, name: it.id, html: it.n === item.n ? html : '' }));
    TP.setPentestLibraries(libraries);
    breach = TP.makePentest(rangeOptions());
    breachItem = item;
    const opened = breach.run('target ' + item.n);
    return 'BREACH RANGE · ' + item.title + '\n' +
      (html ? '  front page: the page you imported, read from this app (' + fmtBytes(html.length) + ')\n' : '  front page: invented, because a bundled reference library has no single page file\n') +
      '\n' + opened + '\n\n' +
      'A simulation on your own offline copy: every host, user, password, endpoint and fake box behind the page is\n' +
      'invented and lives inside this page — no socket is opened, no site or network is contacted, and the library\n' +
      'file is never changed.\n' +
      'Type guide for the full walkthrough · help for the range commands · exit leaves the range · browser lists the\nlibraries again.';
  }

  async function breachCommand(arg) {
    const words = String(arg == null ? '' : arg).trim();
    if (/^(end|off|stop|leave|quit|exit)$/i.test(words)) {
      const title = breachItem ? breachItem.title : 'the range';
      breach = null; breachItem = null;
      return 'Left the breach range (' + title + '). Back in the mound shell: ls, cat, git … · browser lists the libraries.';
    }
    if (/^(help|\?)$/i.test(words)) {
      return ['breach [n|slug|host|url]  start a simulated engagement against ANY browser website or library',
        'breach web [n]            a site from the Cyber Desktop\'s fake internet (random if no number)',
        'breach virus [n]          a site picked at random from the Cyber Desktop browser',
        'breach current            the website currently open in the Cyber Desktop browser',
        'breach end                leave the range and return to the mound shell',
        '',
        'Inside the range: nmap · whatweb · gobuster · nikto · curl · sqlmap · shell · sudo -l · loot · hint · targets · help',
        'Everything is invented and runs inside this page; nothing is sent anywhere.'].join('\n');
    }
    return await startBreach(words);
  }

  /* ---- the walkthrough: an extremely detailed guided engagement --------------------------------------------- */
  /* `guide` turns a walkthrough on: a step-by-step engagement against one of your own offline pages, in the breach
     range. It reads the live range (which objectives it has ticked, the target's host and IP, the hidden staff path,
     the privesc in play) so every command it prints is the exact command that works here, and `guide next` only moves
     on once the range has really ticked the objective the step teaches. Everything below is educational: the target
     is a page the user imported, the server and box are invented in memory, and nothing leaves this page. */
  let walk = { on: false, step: 0 };

  const WALK_LAW = [
    'THE RULES — read these once, they are the actual lesson',
    '  · The target is a page YOU imported into the Browser. It is your file on your PC.',
    '  · Nothing leaves this page. The host, its users, passwords, files, flags and the box behind it are invented in',
    '    memory: no socket, no DNS lookup, no packet. The library file is read once and never written.',
    '  · Pointing these techniques at anything you do not own or have written permission to test is a crime in most',
    '    countries (Computer Misuse Act, CFAA and equivalents). Being able to do it is not permission to do it.',
    '  · A real engagement has a signed scope, a time window, an emergency contact, and one rule above all: stop at the',
    '    first real proof, write it down, and report it instead of going further.'
  ].join('\n');

  const WALK_PRIVESC = {
    'sudo-python': {
      tell: 'sudo -l shows (ALL) NOPASSWD: /usr/bin/python3 — a whole interpreter, for anyone, without a password.',
      run: 'sudo /usr/bin/python3 -c "import os; os.setuid(0); os.system(\'/bin/sh\')"'
    },
    'suid-find': {
      tell: 'sudo -l shows /usr/bin/apt-get without a password, and apt-get runs maintainer scripts as root.',
      run: 'sudo apt-get update'
    },
    'writable-cron': {
      tell: 'crontab -l shows /opt/backup.sh run by root every minute — and the file is world-writable.',
      run: 'echo "chmod +s /bin/bash" > /opt/backup.sh   then   wait'
    },
    'docker-group': {
      tell: 'id shows the account is in the docker group, and docker group membership is host root by design.',
      run: 'docker run -v /:/mnt alpine chroot /mnt /bin/sh'
    },
    'ssh-key': {
      tell: 'the maint user left a private SSH key in /home/maint/.ssh/id_rsa, and root accepts it.',
      run: 'ssh -i /home/maint/.ssh/id_rsa root@localhost'
    }
  };

  function walkInfo() {
    const s = breach && breach.snapshot ? breach.snapshot() : null;
    const host = (s && s.host) || 'the target';
    return {
      s, host, base: 'http://' + host, ip: (s && s.ip) || '', depth: (s && s.depth) || 1,
      adminPath: (s && s.adminPath) || '/staff', privesc: (s && s.privesc) || 'sudo-python',
      sec: (s && s.sec) || null,
      done: new Set((s && s.done) || []), rooted: !!(s && s.rooted)
    };
  }

  function walkSteps() {
    const i = walkInfo();
    const H = i.base, A = i.adminPath, IP = i.ip || '10.10.10.5';
    const priv = WALK_PRIVESC[i.privesc] || WALK_PRIVESC['sudo-python'];
    /* a Cyber Desktop target can refuse the tutorial's injection: the walkthrough has to print the way in that
       actually works on the site in front of the learner, not the way the tutorial floor teaches */
    const sec = i.sec || {};
    const hardLogin = sec.sqliLogin === false;
    const credFile = sec.credPath || sec.secretPath || (sec.leaks && sec.leaks[0] && sec.leaks[0].path) || '/.env';
    const loginPath = sec.loginPath || '/login';
    const steps = [];
    const add = (objective, title, text) => steps.push({ objective, title, lines: String(text).split('\n') });

    add('', 'Scope first: what you may touch, and why that is the lesson', `GOAL      Know exactly what is in scope before you type a single command.
WHY       Every real engagement starts with scope, not with a scanner. "It is mine" and "I may test it" are different
          statements, and only one of them is signed. The habits you build here are the ones you will have later.
DO        Ask the range what exists, and look at the objectives it will hold you to.
TYPE      targets
TYPE      status
TYPE      libraries
EXPECT    three invented hosts (gateway, the web app, a file server), the web app's name and IP, and a list of
          objectives with nothing ticked. "libraries" lists every page your Browser holds, one target each.
TEACHES   Scope and rules of engagement, and the difference between discovery (what exists) and exploitation (what
          you are permitted to do about it).
FIX       (for a defender) keep an asset inventory, and give a tester a scope that names hosts, windows and the one
          thing they must not touch. A tester who asks for that in writing is on your side.`);

    add('recon', 'First contact: what the box is running', `GOAL      Fingerprint the host before you touch the application.
WHY       Ports and banners decide everything after this: the framework, the language, the version, and which bug
          list to read first. Guessing burns the time window you were given.
DO        Scan the ports, fingerprint the web server, and read its headers for missing protections.
TYPE      nmap -sV ${IP}
TYPE      whatweb ${H}
TYPE      nikto -h ${H}
EXPECT    ssh on 22, http on 80, https on 443 with nginx and PHP banners (deeper floors add Tomcat on 8080, mysql on
          3306); whatweb naming nginx, PHP 8.2 and the page title; nikto listing a session cookie without HttpOnly
          and no X-Frame-Options or Content-Security-Policy.
TEACHES   Fingerprinting, why version banners help an attacker, and which headers a site should be sending.
FIX       Strip version banners, set HttpOnly and Secure on session cookies, send CSP and X-Frame-Options, and patch
          or hide the framework version.`);

    add('paths', 'Content discovery: the pages nobody linked to', `GOAL      Find the routes that are not in the menu.
WHY       A site is not its navigation. Admin panels, upload endpoints, backups and debug routes are found by asking
          for them. This is also where a real tester starts to build the map the report needs.
DO        Read what the site admits to, then brute-force a short directory list.
TYPE      curl -s ${H}/robots.txt
TYPE      gobuster dir -u ${H}
EXPECT    robots.txt disallowing /login, /guestbook and a staff path; gobuster listing /index.html, /login,
          /guestbook, /profile, /account, /uploads — and one path answering 403 instead of 404. The 403 is the
          interesting answer: the route exists and is refusing you.
TEACHES   Content discovery, and reading status codes as information: 404 = no such thing, 403 = it is there.
FIX       Do not rely on obscurity. Put authentication in front of admin routes, rate-limit directory brute force, and
          keep robots.txt free of anything you actually care about — it is a map you are handing out.`);

    add('login', hardLogin ? 'Broken authentication: the hardened login' : 'Broken authentication: the login builds a SQL string',
      `GOAL      Get a staff session, using whatever this site actually left exposed.
WHY       ${hardLogin
        ? 'This site uses parameterised queries, so the apostrophe that breaks the tutorial login is just a character here.\n          That is the correct behaviour — the way in is somewhere else: a configuration file left in the web root, a\n          developer note or an old bundle. Reading it is reconnaissance, not an exploit.'
        : 'The login glues your input straight into its SQL. If your input is SQL syntax, it becomes part of the\n          query: the password comparison is no longer a check, it is a suggestion. The range even prints the query\n          it is about to run on a failed attempt — that is the vulnerability in plain sight.'}
DO        ${hardLogin
        ? 'Read the leaked configuration, then sign in with the staff email and password it prints.'
        : 'Send a username that closes the string and makes the WHERE clause always true.'}
TYPE      ${hardLogin ? 'curl -s ' + H + credFile : 'curl "' + H + `/login?u=' OR 1=1-- &p=x"`}
TYPE      ${hardLogin ? 'curl "' + H + loginPath + '?u=<ADMIN_EMAIL>&p=<ADMIN_PASSWORD>"' : 'sqlmap -u "' + H + '/login?u=1&p=1" --batch --dump'}
EXPECT    ${hardLogin
        ? 'the file prints ADMIN_PATH, ADMIN_EMAIL and ADMIN_PASSWORD; the login then answers 302 Found, Location: /account\n          and Set-Cookie: session=adm_… — a real staff session, obtained without breaking the SQL layer.'
        : 'HTTP/1.1 302 Found, Location: /account and Set-Cookie: session=adm_… — the app has signed you in as admin.\n          sqlmap prints the users table with names, emails, roles and API keys: the same finding, automated.'}
TEACHES   ${hardLogin
        ? 'Defence works: prepared statements stop the injection completely. The finding here is the leaked artefact that\n          hands over the staff account anyway — the same outcome through a different, equally common mistake.'
        : 'Injection: data crossing into code. The apostrophe closes the quote, OR 1=1 makes the condition true for every\n          row, and -- comments out the password check that followed. sqlmap is not magic; it is this, tried with many\n          spellings of the same idea.'}
FIX       Parameterised queries (prepared statements) for every statement, never string building. Validate and
          allowlist input. Log failed logins. Treat the sign-in as a security boundary, not a form. Keep configuration
          files out of the web root and rotate any credential that ever sat in one.`);

    add('staff', 'Session trust: using the session you just obtained', `GOAL      Reach the page the session was supposed to protect.
WHY       Authentication proved who you are. Authorisation decides what you may see — and this app never asks again:
          it trusts the cookie it minted from its own broken query. One request and the staff area answers.
DO        Ask for the staff route, then repeat it with the cookie spelled out, so you can see exactly what the server
          is trusting.
TYPE      curl ${H}${A}
TYPE      curl -I -b "session=adm_…" ${H}${A}
EXPECT    200 with the staff dashboard: user rows, their API keys, and a "deploy secret" standing in for the real one
          such a page usually leaks. Without the cookie the same URL answers 403 and tells you what it did receive —
          a badly behaved server, and a useful one.
TEACHES   Broken access control, the number-one finding in real web assessments: the check is on the front end, the
          cookie is unsigned or long-lived, and every secret an admin needs is rendered into one page.
FIX       Authorise every request on the server (role, not just session), sign and rotate session cookies, give admin
          sessions a short life, and never render deploy secrets into a page.`);

    add('', 'Broken access control, part two: read another user by number', `GOAL      Read somebody else's record by changing one number in a URL.
WHY       /profile?id=1 asks the database for that row and hands it back. The page never asks whether the row is
          yours. No injection, no password, no clever syntax — just an object reference the server trusts.
DO        Fetch two different ids and compare.
TYPE      curl -s "${H}/profile?id=1"
TYPE      curl -s "${H}/profile?id=2"
EXPECT    JSON for admin (id 1) and guest (id 2): names, emails, roles and API keys, with no session at all.
TEACHES   IDOR / BOLA — the everyday API bug. It is why banks use opaque ids, and why "the URL had a number in it" is
          not a defence.
FIX       Authorise the object as well as the request: compare the row's owner to the session subject, use
          unguessable ids, and alert on sequential enumeration.`);

    if (i.depth > 1) add('lfi', 'Path traversal: make a download read outside its folder', `GOAL      Use a helpful download endpoint to read a file you were never meant to read.
WHY       The file name comes from the query string and is joined onto a base directory. ../ walks back out of that
          directory, so the server will read anything its own user can read — including its configuration.
DO        Walk up to /etc, then to the site's own config.
TYPE      curl -s "${H}/download?file=../../../../etc/passwd"
TYPE      curl -s "${H}/download?file=../../../../var/www/config.php"
EXPECT    /etc/passwd listing root, www-data and maint; config.php with the database password, the deploy API key and
          the admin password hash. /root/flag.txt answers 403 with an open_basedir message — the one boundary that
          held, which is itself the lesson.
TEACHES   Path traversal: a download link is a file-read primitive. And a reminder that the fix is one canonical
          path check, not a list of "bad" strings.
FIX       Resolve the requested name against a fixed base, reject anything that escapes it (realpath + prefix test),
          store downloads outside the app, and run the web user with no access to /etc or /root.`);

    if (i.depth > 2) add('backup', 'Secrets in artefacts: the leaked backup', `GOAL      Find a copy of the site that was left where anyone can download it.
WHY       .zip, .git, .env, editor swap files and "site-backup-final" folders are the application's own source and
          secrets handed out as static files. Nothing needs exploiting: the secrets are simply published.
DO        Pull the archive and look inside it as text.
TYPE      curl -o backup.zip ${H}/backup.zip
TYPE      strings backup.zip
EXPECT    app/config.php and app/.env with the JWT signing secret, the database password and the admin password hash.
TEACHES   Artefacts as leaks — and why a secret that ever shipped can never be un-shipped. This is how real
          engagements turn a web bug into an account takeover.
FIX       Never publish build output or backups; keep .git and .env outside the webroot; rotate every secret that was
          ever in one; add a deployment check that fails on archive files in the webroot.`);

    if (i.depth > 2) add('ssrf', 'SSRF: make the server fetch something you cannot reach', `GOAL      Make the server request an address from inside its own network.
WHY       /fetch takes a URL and requests it for you. From where the server sits, 169.254.169.254 is the cloud metadata
          service: instance identity, role name and temporary credentials. A web bug becomes cloud access.
DO        Point the fetcher at the metadata endpoint.
TYPE      curl -s "${H}/fetch?url=http://169.254.169.254/latest/meta-data/"
EXPECT    JSON with the instance id, the role and an access-key id — the material that leads to the rest of the cloud.
TEACHES   SSRF, and why "block localhost" is not an allowlist. The dangerous addresses are the ones the server can reach
          and you cannot.
FIX       Allowlist outbound destinations, block link-local ranges, require IMDSv2, and give the instance the smallest
          role that still works.`);

    if (i.depth > 3) add('cmdi', 'Command injection: a field that was meant to hold a hostname', `GOAL      Run your own command through the ping tool.
WHY       The endpoint shells out: ping <host>. A semicolon ends the ping and starts your command, which the server
          runs as the web user. No upload, no exploit code — just punctuation.
DO        Break out of the argument and run id, then read the config.
TYPE      curl -s "${H}/ping?host=127.0.0.1%3Bid"
TYPE      curl -s "${H}/ping?host=127.0.0.1%3Bcat%20/var/www/config.php"
EXPECT    the normal ping output followed by uid=33(www-data), then the config file with its passwords.
TEACHES   OS command injection, and the difference between a shell string and an argument list. The %3B is just a
          URL-encoded semicolon: the browser was never the protection.
FIX       Never call a shell from an application: pass an argument array (execFile/spawn with shell:false), validate
          the host with a real parser, and run the service in a container that holds nothing it does not need.`);

    add('upload', 'Unrestricted upload: turn a file into code', `GOAL      Get a file of your own onto the server, in a place it will run.
WHY       The endpoint checks that the name ends in .php and stores it under the webroot. A file the server executes,
          in a directory it serves, is a webshell: a page whose parameters are commands.
DO        Upload it.
TYPE      curl -X POST "${H}/upload?file=shell.php"
EXPECT    201 Created with {"stored":"/uploads/shell.php"} — a file you control, where the web server will run it.
TEACHES   Unrestricted file upload to remote code execution, the shortest path from a web page to a shell. Note what
          the check got wrong: it validated the *name*, not the content, and it stored the file where execution is
          possible.
FIX       Validate type by content (magic bytes), rename and store uploads outside the webroot, serve them through a
          handler that sets Content-Disposition, and disable execution in the uploads directory.`);

    add('shell', 'The foothold: a session on the box as www-data', `GOAL      Use the webshell to look around the host the way an attacker would — and the way a defender must imagine.
WHY       The webshell is code execution as the web user. From here, configuration, history and secrets are readable,
          and this is where a real engagement spends most of its hours.
DO        Open the shell and look at who you are, what is on the disk, and what the app left lying around.
TYPE      shell
TYPE      id
TYPE      ls /
TYPE      cat /flag
TYPE      cat /var/www/config.php
TYPE      cat /home/maint/.bash_history
EXPECT    uid=33(www-data); a / holding var, etc, home, root and a flag; a www_ flag (a placeholder for whatever the
          business actually cares about); database credentials and an API key; and a history file naming the commands
          the box's admin ran — including the privesc you are about to use.
TEACHES   A foothold, and why the valuable data on a server is configuration and habit, not the trophy file.
FIX       Give the service account the least privilege it needs, keep secrets out of the webroot, disable shell history
          for service users, and alert on uploads that are immediately followed by command execution.`);

    add('', 'Privilege escalation: find what the admin did for convenience', `GOAL      Find the misconfiguration that turns www-data into root.
WHY       In ranges and in real life, root is rarely "exploited": it is granted by something someone set up to make
          their day easier. You are looking for what your account may run, what runs as root and is writable, and
          which groups you are in. Method first, exploit second.
DO        Enumerate all four of those things, in that order.
TYPE      sudo -l
TYPE      find / -perm -4000 2>/dev/null
TYPE      crontab -l
TYPE      id ; groups
EXPECT    one of these, and this target gives you: ${priv.tell}
TEACHES   Enumeration beats exploitation: almost all privilege escalation is a permissions bug. Read output carefully —
          NOPASSWD, the SUID bit, a world-writable script that root runs, or a group you should not be in.
FIX       No NOPASSWD for interpreters or package managers, no world-writable files executed by root, no docker group
          for web users, and review sudoers and cron as security code with an owner and a test.`);

    add('root', 'Root: the end of the chain, and the place to stop', `GOAL      Take root, prove it with one command, and stop touching the box.
WHY       The chain is the lesson, not the trophy. In a real engagement you take root, capture the smallest piece of
          evidence that proves it, and write it up — you do not keep exploring a client's host.
DO        Use the misconfiguration you found on the previous step.
TYPE      ${priv.run}
EXPECT    uid=0(root) gid=0(root) groups=0(root) — and the range ticking its last objective.
TEACHES   Impact: the same upload bug plus one convenience setting is total control of the host. This is the line
          that turns a finding into an incident.
FIX       Everything from the previous step, plus: remove the convenience setting today, alert on privilege changes,
          and rotate every secret the box ever held.`);

    add('', 'The report: turn the chain into something that gets fixed', `GOAL      Write up the engagement so a client can act on it.
WHY       Findings without evidence are opinions, and findings without fixes are homework. The report is the actual
          deliverable; the shell was only how you collected evidence.
DO        Collect what you took, note what you did, and look at what the range says you finished.
TYPE      loot
TYPE      note login bypass via SQL injection in /login (u parameter)
TYPE      report
TYPE      status
EXPECT    every secret you lifted, listed; your note kept with the engagement; every objective ticked.
TEACHES   Reporting: one entry per finding with title, severity, affected host, evidence (the request and the
          response), impact in business words, the fix, and how the fix will be retested. Then the retest.
FIX       For each finding above, name the fix, the owner and the test that proves it is closed. Two findings here are
          usually critical on their own: the SQL injection and the upload that executes.
DONE      When the range shows every objective ticked: type next to take the next floor (fresh secrets, one more
          technique), or guide next to finish this ladder, or guide off to leave the walkthrough.`);

    return steps;
  }

  const WALK_INTRO = [
    '══════════════════════════════════════════════════════════════════════',
    ' THE WALKTHROUGH — breaching a site you own, one honest step at a time',
    '══════════════════════════════════════════════════════════════════════',
    '',
    'This walks you through a complete engagement against ONE of your own offline pages: a page you imported into the',
    'Browser, served from this app. The range turns it into a small web app with a staff area, a database, an upload',
    'form and a Linux box behind it — all invented in memory, all switchable with one command.',
    '',
    'WHAT IS REAL HERE',
    '  · the page you imported, and the fact that it is yours',
    '  · the commands, the order and the reasoning — what an engagement actually looks like from the inside',
    '  · the vulnerability classes: SQL injection, broken access control, IDOR, path traversal, SSRF, command',
    '    injection, an upload that executes, and privilege escalation',
    '',
    'WHAT IS NOT REAL HERE',
    '  · every host, IP, user, password, token, flag and file behind the page',
    '  · the network: no socket, no DNS lookup, nothing sent anywhere',
    '  · the damage: the library file is read once and never written; the "root shell" is a string',
    '',
    'HOW TO USE IT',
    '  guide            turn it on (or repeat the step you are on)',
    '  guide list       the ladder, with what the range has ticked',
    '  guide next       move on — only once the range has ticked the current step',
    '  guide 6          jump to step 6 (you can always come back)',
    '  guide intro      these rules again   ·   guide off turns it off',
    '',
    'HOW YOU KNOW YOU DID IT',
    'The range keeps score: each objective it ticks (recon, login, upload, root …) is a real check of the state it',
    'holds, so this walkthrough reads that state instead of taking your word for it. hint is the short answer; this is',
    'the long one, with the reason each step works and the fix for each finding.',
    '',
    WALK_LAW
  ].join('\n');

  function walkMap() {
    const steps = walkSteps(), i = walkInfo();
    const ticked = steps.filter(step => step.objective && i.done.has(step.objective)).length;
    const lines = ['WALKTHROUGH · ' + i.host + (i.ip ? ' (' + i.ip + ')' : '') + ' · floor ' + i.depth +
      (walk.on ? '' : '   (off — type guide to turn it on)'), ''];
    steps.forEach((step, n) => {
      const here = walk.on && n === walk.step;
      lines.push((here ? ' ▶ ' : '   ') + String(n + 1).padStart(2) + '. ' +
        (step.objective && i.done.has(step.objective) ? '[x] ' : '[ ] ') + step.title);
    });
    lines.push('', '  ' + ticked + ' of ' + steps.length + ' steps ' + (ticked === 1 ? 'has' : 'have') + ' its objective ticked by the range.');
    lines.push(i.depth < 5
      ? '  Floor ' + (i.depth + 1) + ' adds another technique and becomes another step: finish this ladder, then type next.'
      : '  Deeper floors keep adding techniques, and each one appears here as its own step.');
    return lines.join('\n');
  }

  function paintWalk(index) {
    const steps = walkSteps(), info = walkInfo();
    const at = Math.max(0, Math.min(steps.length - 1, Number(index) || 0));
    walk.on = true; walk.step = at;
    const step = steps[at];
    const ticked = steps.filter(s => s.objective && info.done.has(s.objective)).length;
    const state = !step.objective ? 'no objective to tick: read it, then guide next'
      : info.done.has(step.objective) ? 'DONE — the range has ticked “' + step.objective + '”'
      : 'NOT YET — the range has not ticked “' + step.objective + '”';
    return [
      '══════════════════════════════════════════════════════════════════════',
      ' STEP ' + (at + 1) + ' OF ' + steps.length + ' · ' + step.title.toUpperCase(),
      '══════════════════════════════════════════════════════════════════════',
      ' Target  ' + info.host + (info.ip ? ' (' + info.ip + ')' : '') + ' · floor ' + info.depth
    ].concat(step.lines, [
      '',
      '──────────────────────────────────────────────────────────────────────',
      ' NOW     ' + state,
      ' SCORE   ' + ticked + ' of ' + steps.length + ' steps ticked by the range',
      ' NEXT    ' + (at === steps.length - 1 ? 'next (another floor) or guide off' : 'guide next') +
        ' · guide list · guide ' + (at + 1) + ' again · guide off',
      ' STUCK   hint (the short answer) · reset-target (fresh secrets, same floor) · exploit (the whole chain)'
    ]).join('\n');
  }

  async function guideCommand(arg) {
    const words = String(arg == null ? '' : arg).trim();
    const sub = words.toLowerCase();
    if (/^(off|stop|end|quit)$/.test(sub)) {
      walk.on = false;
      return 'Walkthrough off. The range is still open — type help for its commands, loot for what you took, or guide to turn the walkthrough back on.';
    }
    if (!breach) {
      const targetArg = sub && !/^(intro|rules|law|legal|start|begin|on|restart|list|steps|ladder|where|check|progress|map|next|n|continue|go|\d+)$/.test(sub) ? words : '';
      const started = await startBreach(targetArg);
      if (!breach) return started;
      walk = { on: true, step: 0 };
      return started + '\n\n' + WALK_INTRO + '\n\n' + paintWalk(0);
    }
    if (!sub) {
      if (walk.on) return paintWalk(walk.step);
      walk = { on: true, step: 0 };
      return WALK_INTRO + '\n\n' + paintWalk(0);
    }
    if (/^(intro|rules|law|legal|start|begin|on|restart)$/.test(sub)) {
      walk = { on: true, step: 0 };
      return WALK_INTRO + '\n\n' + paintWalk(0);
    }
    if (/^(list|steps|ladder|where|check|progress|map)$/.test(sub)) return walkMap();
    if (/^(next|n|continue|go)$/.test(sub)) {
      walk.on = true;
      const steps = walkSteps(), info = walkInfo();
      const step = steps[walk.step];
      if (step && step.objective && !info.done.has(step.objective)) {
        return ['Not yet — step ' + (walk.step + 1) + ' is still open: ' + step.title,
          'The range has not ticked “' + step.objective + '”, and it only ticks when the target is really in that state.',
          '', '  hint               the range’s next concrete command',
          '  guide ' + (walk.step + 1) + '               read this step again',
          '  guide ' + (walk.step + 2) + '               skip ahead anyway (you can always come back)'].join('\n');
      }
      if (walk.step >= steps.length - 1) {
        const left = steps.filter(s => s.objective && !info.done.has(s.objective)).length;
        return ['You are on the last step of this floor’s ladder.' + (left ? ' ' + left + ' objective' + (left === 1 ? '' : 's') + ' are still open — status lists them.' : ''),
          '', '  next            take the next floor: fresh secrets, one more technique, a new ladder',
          '  loot            what you collected · note <text> to write it down',
          '  reset-target    roll new secrets on this floor and run the chain again',
          '  guide off       leave the walkthrough (the range stays open)'].join('\n');
      }
      return paintWalk(walk.step + 1);
    }
    if (/^\d+$/.test(sub)) {
      const steps = walkSteps(), n = Number(sub);
      if (n < 1 || n > steps.length) return 'There are ' + steps.length + ' steps: guide 1 … guide ' + steps.length + ' (guide list shows them).';
      return paintWalk(n - 1);
    }
    return ['usage: guide [list|next|<n>|intro|off]', '',
      '  guide          turn the walkthrough on (or repeat the step you are on)',
      '  guide list     every step, with what the range has ticked',
      '  guide next     move on once the range has ticked the current step',
      '  guide 7        jump to step 7',
      '  guide intro    the rules of engagement · guide off turns it off'].join('\n');
  }

  /* ---- driving the app itself: `app …` ----------------------------------------------------------------------- */
  /* The shell can do what a user's own buttons do, because every action here goes through the same public objects
     the app itself uses (A.showTab, A.chat, A.notes, A.settings, OA_THEMES …). Nothing below can reach a part of
     the app the interface does not already offer, and nothing leaves this computer. */
  const appTabs = () => {
    const tabs = (typeof A !== 'undefined' && A.tabs) ? A.tabs : {};
    const list = [];
    for (const [id, meta] of Object.entries(tabs)) if (meta && !meta.hidden) list.push({ id, label: String(meta.label || id) });
    return list;
  };
  const tabPick = key => {
    const want = String(key == null ? '' : key).trim().toLowerCase();
    if (!want) return null;
    const list = appTabs();
    return list.find(t => t.id.toLowerCase() === want) ||
      list.find(t => t.label.toLowerCase() === want) ||
      list.find(t => t.id.toLowerCase().startsWith(want)) ||
      list.find(t => t.label.toLowerCase().includes(want)) || null;
  };
  const appState = () => {
    const cur = (typeof A !== 'undefined' && A.cur) ? A.cur : '';
    const label = (appTabs().find(t => t.id === cur) || {}).label || cur || '(none)';
    let theme = '';
    try { theme = (window.OA_THEMES && window.OA_THEMES.get()) || ''; } catch (e) { theme = ''; }
    return 'tab     ' + cur + ' — ' + label + '\ntheme   ' + (theme || '(default)') + '\nmodel   ' + ((typeof A !== 'undefined' && A.modelOrder && A.modelOrder.get && A.modelOrder.get()) || '(chat default)');
  };
  async function appCommand(rest) {
    const w = argvOf(rest), sub = (w[0] || '').toLowerCase(), arg = w.slice(1).join(' ');
    const usage = [
      'app — drive Moundshroud from the shell. Everything a button does, a command can do.',
      '  app                     where the app is right now, with every tab',
      '  app tabs                every tab, by id and name',
      '  app open <tab>          switch to a tab (home, chat, web, lib, notes, study, cyber, play, …)',
      '  app theme [name]        list the themes, or apply one',
      '  app status              the tab you are on, the theme and the model',
      '  app note <text>         write a note into Notes',
      '  app ask <question>      ask Chat a question',
      '  app search <text>       search the offline libraries in the Browser',
      '  app settings [page]     open Settings (privacy, appearance, shortcuts, …)',
      '  app toast <text>        show a message inside the app',
      '  app play [game]         open Games, or one game by its id (chess, weblab, …)',
      '  app stop                stop the AI reply that is running',
      '',
      'These all work on this app only. The shell never touches another program on the PC.'
    ].join('\n');
    if (!sub || /^(help|\?)$/.test(sub)) {
      return usage + '\n\nTABS\n' + appTabs().map(t => '  ' + t.id.padEnd(12) + t.label).join('\n') + '\n\nNOW\n' + appState();
    }
    if (/^(tabs|list)$/.test(sub)) return appTabs().map(t => '  ' + t.id.padEnd(12) + t.label + (A.cur === t.id ? '   ← you are here' : '')).join('\n');
    if (/^(status|state|where)$/.test(sub)) return appState();
    if (/^(open|go|cd)$/.test(sub)) {
      const tab = tabPick(arg);
      if (!tab) {
        const { CW } = fakeWorld();
        const at = arg ? fakePick(CW, arg, { create: true }) : null;
        if (at && at.site) {
          return await openInBrowser({ kind: at.hub ? 'hub' : 'fake', hub: !!at.hub, id: at.site.host, title: at.site.brand, site: at.site, path: at.path });
        }
        return 'app open: no tab or website matches “' + arg + '”.\n' + appTabs().map(t => '  ' + t.id + '  ' + t.label).join('\n');
      }
      try { A.showTab(tab.id); } catch (e) { return 'app open: ' + String(e && e.message || e); }
      return 'Opened “' + tab.label + '”.';
    }
    if (/^(theme|themes)$/.test(sub)) {
      const all = (window.OA_THEMES && window.OA_THEMES.list) ? window.OA_THEMES.list : [];
      if (!all.length) return 'Themes are not available yet.';
      if (!arg) return all.map(t => '  ' + String(t.id).padEnd(12) + (t.name || t.id) + (window.OA_THEMES.get() === t.id ? '   ← in use' : '')).join('\n');
      const want = arg.toLowerCase();
      const theme = all.find(t => String(t.id).toLowerCase() === want) || all.find(t => String(t.name || '').toLowerCase() === want) || all.find(t => String(t.name || '').toLowerCase().includes(want));
      if (!theme) return 'app theme: no theme matches “' + arg + '”. Try: ' + all.map(t => t.id).join(', ');
      window.OA_THEMES.apply(theme.id);
      return 'Theme set to ' + (theme.name || theme.id) + '.';
    }
    if (/^(note|notes|write)$/.test(sub)) {
      if (!arg) return 'app note <text> — write it into Notes.';
      if (!A.notes || !A.notes.create) return 'Notes is not loaded yet. Open it once, then try again.';
      await A.notes.create(arg.split('\n')[0].slice(0, 60), arg);
      return 'Saved to Notes.';
    }
    if (/^(ask|chat|ai)$/.test(sub)) {
      if (!arg) return 'app ask <question> — it goes to Chat.';
      if (!A.chat || !A.chat.ask) return 'Chat is not loaded yet. Open it once, then try again.';
      try { A.showTab('chat'); } catch (e) { }
      A.chat.ask(arg);
      return 'Asked Chat: ' + arg.slice(0, 120);
    }
    if (/^(search|find)$/.test(sub)) {
      if (!arg) return 'app search <text> — it searches the offline libraries in the Browser.';
      try { A.showTab('web'); } catch (e) { }
      setTimeout(() => { try { A.websearch.search(arg); } catch (e) { } }, 350);
      return 'Searching the offline libraries for “' + arg + '” in the Browser.';
    }
    if (/^(settings|prefs|preferences)$/.test(sub)) {
      if (!A.settings || !A.settings.open) return 'Settings is not loaded yet.';
      A.settings.open(arg);
      return 'Opened Settings' + (arg ? ' at ' + arg : '') + '.';
    }
    if (/^(toast|say|notify)$/.test(sub)) {
      if (!arg) return 'app toast <text>';
      if (A.toast) A.toast(arg);
      return '(shown in the app) ' + arg;
    }
    if (/^(play|game)$/.test(sub)) {
      try { A.showTab('play'); } catch (e) { }
      if (!arg) return 'Opened Games.';
      if (!A.play || !A.play.open) return 'Games is not loaded yet.';
      try {
        if (A.play.games && A.play.games[arg]) { A.play.open('arcade', arg); return 'Opened the game “' + arg + '”.'; }
        A.play.open(arg); return 'Opened Games › ' + arg + '.';
      } catch (e) { return 'app play: ' + String(e && e.message || e); }
    }
    if (/^(stop|halt)$/.test(sub)) {
      if (A.chat && A.chat.stop) A.chat.stop();
      if (mcode && mcode.interrupt) mcode.interrupt();
      return 'Stopped what was running.';
    }
    return usage;
  }

  /* ---- OWASP Juice Shop: the real practice target, driven from the shell -------------------------------------- */
  /* The app can start a real (deliberately vulnerable) Juice Shop on this PC and show it in the Cyber tab; the shell
     talks to the same switches. It is the one target here that is a real server: it is local, it is meant to be broken
     into, and it must never be pointed at anything else. */
  const juiceSteps = () => [
    { t: 'Get it running and find the map', lines: [
      'The shop is a real server on this PC, mirrored into the Cyber tab by a small proxy.',
      'juice start                        boots it (the first launch builds its database)',
      'juice open                         shows it in the Browser tab',
      'The score board is the map of every challenge, at  #/score-board  — but the menu does not',
      'link to it. Open it by typing the address yourself: http://127.0.0.1:3018/#/score-board'] },
    { t: 'Log in as the admin with SQL injection', lines: [
      'Go to  #/login . The email field glues your text into SQL. Type:',
      "   ' OR 1=1--           (the password can be anything)",
      'You are in as  admin@juice-sh.op . EXPECT: the basket and the admin menu appear.',
      'WHY: the quote closes the email string, OR 1=1 matches the first row, -- discards the rest.',
      'FIX: parameterised queries; never build a WHERE clause from strings.'] },
    { t: 'Take over Jim’s account', lines: [
      'The same form, a different name. Try:',
      "   jim@juice-sh.op'--",
      'EXPECT: you are signed in as Jim without his password. One quote, one comment, one account.',
      'FIX: as above, plus rate-limit and alert on failed logins.'] },
    { t: 'Reflected XSS in the product search', lines: [
      'The search box prints your text into the page. Open:',
      '   http://127.0.0.1:3018/#/search?q=<iframe src="javascript:alert(`xss`)">',
      'EXPECT: an alert box fires. That is script you supplied, running in the shop’s origin.',
      'FIX: encode output, and send a Content-Security-Policy that forbids inline script.'] },
    { t: 'Read another customer’s basket (IDOR)', lines: [
      'After signing in, open the developer tools (F12) and copy your token from the request to',
      '   GET /rest/basket/<n>     with header   Authorization: Bearer <token>',
      'Change the number to somebody else’s (1 is the admin’s) and send it again.',
      'EXPECT: their basket, their items. The server never asks whose basket it is.',
      'FIX: authorise the object against the token subject, not just the session.'] },
    { t: 'Read files with path traversal', lines: [
      'The complaint form offers a file picker that fetches files for you:',
      '   http://127.0.0.1:3018/#/ftp/package.json.bak%2500.md',
      '   http://127.0.0.1:3018/ftp/legal.md',
      'EXPECT: the server hands over a file that was never meant to be public. The %2500 is a doubly',
      'encoded null byte, which is the trick the challenge teaches.',
      'FIX: resolve against a fixed base and reject anything that escapes it.'] },
    { t: 'Forge the token: what a JWT really trusts', lines: [
      'Sign in, then look at the token the shop returns (developer tools → Network → login).',
      'Paste it into Moundshroud’s JWT decoder (Cyber › Toolkit › JWT decoder) and read the payload:',
      '   sub, email, role, iat, exp — all readable by anyone, and none of it is a secret.',
      'EXPECT: you can read your own identity, and see that the only thing protecting it is the signature.',
      'FIX: verify the signature and the algorithm server-side, keep the lifetime short, and never',
      'put anything in a token you would not show the user.'] },
    { t: 'Write it up, then stop', lines: [
      'The score board tracks what you solved. In a real assessment you would stop at the first proof',
      'of each finding, screenshot the request and the response, and write: title, severity, host,',
      'evidence, impact in business words, the fix, and how the fix will be retested.',
      'juice stop                         shuts the shop down when you are done'] }
  ];
  async function juiceCall(path, body) {
    try {
      const r = await fetch(path, body === undefined ? { cache: 'no-store' } : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) });
      return await r.json();
    } catch (e) { return { error: String(e && e.message || e) }; }
  }
  async function juiceCommand(rest) {
    const w = argvOf(rest), sub = (w[0] || 'status').toLowerCase();
    const line = st => st && st.up
      ? 'Juice Shop is running at ' + st.url + '  (shown in the Cyber tab; the server itself is on 127.0.0.1:3017)'
      : st && st.starting ? 'Juice Shop is starting… the first launch builds its database, up to a minute.'
      : st && st.installed === false ? 'Juice Shop is not installed in the runtime folder.'
      : 'Juice Shop is not running.  juice start  boots it.';
    if (/^(help|\?)$/.test(sub)) {
      return ['juice — OWASP Juice Shop, the real practice target, from this shell',
        '  juice                 is it up?',
        '  juice start           boot it on this PC (first run takes up to a minute)',
        '  juice stop            shut it down',
        '  juice open            show it in the Browser tab',
        '  juice pentest         attack the running shop from here and print the findings report',
        '  juice guide [n]       the walkthrough for the site itself: login SQLi, XSS, IDOR, traversal, tokens',
        '',
        'Juice Shop is deliberately vulnerable and local. Attack it freely; never point these techniques at',
        'a site you do not own or have written permission to test.'].join('\n');
    }
    if (/^(status|state|)$/.test(sub)) return line(await juiceCall('/api/juiceshop/status'));
    if (/^(start|up|boot)$/.test(sub)) {
      const r = await juiceCall('/api/juiceshop/start', {});
      return line(r) + (r && r.error ? '\n' + r.error : '');
    }
    if (/^(stop|down|kill)$/.test(sub)) return 'Juice Shop stopped.\n' + line(await juiceCall('/api/juiceshop/stop', {}));
    if (/^(open|show|browser)$/.test(sub)) {
      const st = await juiceCall('/api/juiceshop/status');
      if (!st || !st.up) return line(st);
      try {
        if (A.lib && A.lib.init) await A.lib.init();
        if (A.lib && A.lib.openUrl) { A.lib.openUrl(st.url, 'OWASP Juice Shop'); return 'Opened Juice Shop in the Browser tab: ' + st.url; }
      } catch (e) { }
      return 'It is running at ' + st.url + ' — open the Browser tab and type that address.';
    }
    if (/^(pentest|test|attack|scan|probe)$/.test(sub)) {
      const st = await juiceCall('/api/juiceshop/status');
      if (!st || !st.up) return line(st) + '\nRun  juice start  first — the pentest needs the shop up.';
      return paintPentest(await juiceCall('/api/juiceshop/pentest', {}));
    }
    if (/^(guide|walk|tutorial|steps)$/.test(sub)) {
      const steps = juiceSteps(), n = parseInt(w[1], 10);
      if (!isNaN(n) && n >= 1 && n <= steps.length) return paintJuice(steps[n - 1], n, steps.length);
      return ['THE JUICE SHOP WALKTHROUGH — the site itself, challenge by challenge',
        '  Target  OWASP Juice Shop, running on this PC (deliberately vulnerable, meant to be broken into)',
        '  Why     it is the standard practice target, and the bugs are the same ones real sites ship',
        '  Use     juice guide <n> for one step · juice start boots it first · juice open shows it',
        ''].concat(steps.map((s, i) => '  ' + String(i + 1).padStart(2) + '. ' + s.t)).join('\n');
    }
    return 'usage: juice [start|stop|open|pentest|guide [n]]\nType juice for where it stands.';
  }
  const SEVNAME = { critical: 'CRITICAL', high: 'HIGH', medium: 'MEDIUM', low: 'LOW' };
  function paintPentest(r) {
    if (!r || r.error) return 'juice pentest: ' + ((r && r.error) || 'no answer from the app server');
    const out = [
      '──────────────────────────────────────────────────────────────────────',
      ' PENTEST · OWASP JUICE SHOP · THIS COMPUTER ONLY',
      ' target   ' + r.target + '   ·   version ' + (r.version || 'unknown'),
      ' result   ' + (r.findings || []).length + ' finding(s) from ' + r.checks + ' checks' +
        (r.control ? '   ·   control passed: an anonymous request is refused' : ''),
      '──────────────────────────────────────────────────────────────────────'
    ];
    if (!(r.findings || []).length) out.push('', ' Nothing exploitable answered. That is odd for Juice Shop — check that it is really running.');
    (r.findings || []).forEach((f, i) => {
      out.push('', ' ' + (i + 1) + '. [' + (SEVNAME[f.severity] || String(f.severity).toUpperCase()) + '] ' + f.title,
        '    saw   ' + f.evidence,
        '    why   ' + f.impact,
        '    fix   ' + f.fix);
    });
    out.push('', ' Each line is proof of a bug, not a full assessment: reproduce it, capture the request and the response,');
    out.push(' then write it up with severity, host, evidence, impact in business words, and the fix.');
    out.push(' juice guide  walks the same site by hand, and  juice stop  shuts it down.');
    return out.join('\n');
  }
  const paintJuice = (s, n, total) => [
    '──────────────────────────────────────────────────────────────────────',
    ' STEP ' + n + ' OF ' + total + ' · ' + s.t.toUpperCase(),
    '──────────────────────────────────────────────────────────────────────'
  ].concat(s.lines, ['', ' NEXT  juice guide ' + Math.min(total, n + 1) + '   ·   juice guide (the ladder)']).join('\n');

  /* ---- the Toolkit's tools, from the shell: `tools` / `tool <id>` --------------------------------------------- */
  /* Every tool the Cyber tab has is also a command, so a terminal user never has to leave the shell. They run in the
     app's own server (lib/cybertools.js) and only look, read or ask. */
  const TOOL_ARGS = {
    dns: ['host'], ipinfo: ['host'], reverse: ['host'], whois: ['host'], subdomains: ['host'],
    portscan: ['host', 'ports'], tlscert: ['host'], headers: ['url'], fingerprint: ['url'], traceroute: ['host'],
    hashid: ['hash'], hashcrack: ['hash', 'words'], hashmake: ['text'],
    secrets: ['path'], strings: ['path'], hashdir: ['path']
  };
  const TOOL_GET = { mynetwork: 1, wifi: 1, connections: 1 };
  const TOOL_LINE = {
    dns: 'every DNS record behind a name', ipinfo: 'who owns an address', reverse: 'the name set for an IP',
    whois: 'who registered a domain', subdomains: 'other names under a domain', portscan: 'which ports are open',
    tlscert: 'a site’s HTTPS certificate', headers: 'missing security headers', fingerprint: 'what a site is built with',
    traceroute: 'every router between here and a host', mynetwork: 'devices on your own network', wifi: 'Wi-Fi networks nearby',
    connections: 'who this PC is talking to', hashid: 'name a hash from its shape', hashcrack: 'try words against a hash',
    hashmake: 'make MD5/SHA hashes of text', secrets: 'scan your files for keys and tokens',
    strings: 'readable text inside a file', hashdir: 'SHA-256 of every file in a folder'
  };
  const prettyJson = r => { try { return JSON.stringify(r, null, 2).slice(0, 8000); } catch (e) { return String(r); } };
  function toolText(id, r) {
    if (!r) return '(no answer)';
    if (r.error) return 'error: ' + r.error;
    /* every answer names the target it is about, so a tool never answers anonymously about a site */
    const who = r.host || r.path || (r.url ? String(r.url).split('://').pop().split('/')[0] : '');
    const lead = who ? 'target  ' + who + (r.ip && r.ip !== who ? '  (' + r.ip + ')' : '') + '\n' : '';
    const body = id === 'dns' ? ((r.records || []).map(x => x.type.padEnd(6) + x.value + '   ' + (x.note || '')).join('\n') || (r.note || 'no records'))
      : id === 'portscan' ? ((r.open || []).map(p => String(p.port).padEnd(6) + 'open   ' + (p.service || '')).join('\n') || (r.note || 'no open ports'))
      : id === 'hashmake' ? Object.entries(r.hashes || {}).map(([a, h]) => a.toUpperCase().padEnd(8) + h).join('\n')
      : id === 'hashid' ? ((r.guesses || []).map(g => g.name).join('\n') || (r.error || ''))
      : id === 'hashcrack' ? (r.cracked ? 'cracked: ' + r.password + '  (' + r.algo + ', after ' + r.tried + ' tries)' : 'not cracked after ' + r.tried + ' tries. ' + (r.note || ''))
      : id === 'secrets' ? ((r.findings || []).map(f => f.file + ':' + f.line + '  ' + f.rule + '  ' + f.preview).join('\n') +
          ((r.findings || []).length ? '\n' + r.findings.length + ' hit(s) in ' + r.scanned + ' files. ' + (r.note || '') : 'nothing found in ' + r.scanned + ' files.'))
      : id === 'strings' ? ((r.strings || []).join('\n') || (r.note || 'no readable text'))
      : id === 'hashdir' ? ((r.files || []).map(f => f.sha256 + '  ' + f.file).join('\n') || (r.note || 'no files'))
      : id === 'headers' ? (r.grade ? 'grade ' + r.grade + ' (' + r.score + '/100)\npresent: ' + (r.present || []).map(x => x.name).join(', ') + '\nmissing: ' + (r.missing || []).map(x => x.name).join(', ') : prettyJson(r))
      : id === 'whois' ? (Object.entries(r.facts || {}).filter(([, v]) => v).map(([k, v]) => k.padEnd(12) + v).join('\n') || prettyJson(r))
      : id === 'connections' ? ((r.connections || []).slice(0, 60).map(c => (c.program || '?').padEnd(16) + c.local + '  ->  ' + (c.remote || '-') + '  ' + c.state).join('\n') || (r.note || 'none'))
      : prettyJson(r);
    return lead + body;
  }
  /* ---- Cyber Desktop websites for `tool <name>` (no real network traffic ever leaves for fake sites) ---------- */
  function fakeToolAnswer(id, body) {
    const raw = String(body.host || body.url || body.path || '').trim();
    if (!raw) return null;
    const { CW } = fakeWorld();
    const inCyber = typeof A !== 'undefined' && A.cur === 'cyber';
    /* for file-path tools (`secrets`, `strings`), only treat the argument as a website when it is NOT a local file */
    if (id === 'secrets' || id === 'strings') {
      const files = workFiles();
      const rel = normRel(raw);
      if (rel && rel in files) return null;
      if (!(/^(?:current|@current|active|here|web|virus|trapped|malware|portal|search)\b/i.test(raw) || isHubTarget(raw) ||
        /^https?:\/\//i.test(raw) || /^\d{1,3}(?:\.\d{1,3}){3}(?:\/|$)/.test(raw) || /\.[a-z]{2,12}(?::\d+)?(?:\/|$)/i.test(raw))) return null;
    }
    const allowCreate = inCyber || /^(?:web|virus|trapped|malware|current|@current|active|here)\b/i.test(raw) ||
      /\.example(?:\/|$|:)/i.test(raw) || /^10\.14\./.test(raw) || isHubTarget(raw);
    const at = fakePick(CW, raw, { create: allowCreate });
    if (!at || !at.site) return null;
    const s = at.site, host = s.host, ip = s.ip || '10.14.1.2';
    const trap = !!(s.trapped && s.virus);
    if (id === 'dns') {
      const records = [
        { type: 'A', value: ip, note: 'Cyber Desktop simulated IPv4' },
        { type: 'MX', value: 'mail.' + host, note: 'Mail server (priority 10)' },
        { type: 'NS', value: 'ns1.' + host, note: 'Name server' },
        { type: 'TXT', value: 'v=spf1 ip4:' + ip + ' -all', note: 'SPF record' }
      ];
      return { host, records };
    }
    if (id === 'reverse') return { ip, names: [host], note: 'Cyber Desktop simulated host' };
    if (id === 'ipinfo') return { ip, host, org: s.brand + ' (Cyber Desktop simulated)', network: s.hub ? '127.0.0.0/8' : '10.14.0.0/16', category: s.kind };
    if (id === 'whois') {
      return {
        facts: {
          domain: host.toUpperCase(), brand: s.brand, category: s.kind, ip,
          registrar: s.hub ? 'Moundshroud Local Registry' : 'Moundshroud Cyber Desktop Registry (simulated)',
          created: new Date(s.createdAt || Date.now()).toISOString().slice(0, 10),
          admin: s.adminLogin || ('admin@' + host),
          nameserver: 'ns1.' + host,
          safety: 'no reputation data (simulated registry)'
        }
      };
    }
    if (id === 'subdomains') {
      const found = ['www.' + host, 'api.' + host, 'mail.' + host, 'admin.' + host];
      return { host, ip, subdomains: found, note: 'Cyber Desktop simulated DNS — nothing left this page.' };
    }
    if (id === 'portscan') {
      const open = [
        { port: 22, service: 'SSH (OpenSSH 8.9p1)' },
        { port: 80, service: 'HTTP (nginx/1.24.0)' },
        { port: 443, service: 'HTTPS (nginx/1.24.0 · PHP/8.2.12)' }
      ];
      if (trap) open.push({ port: 8080, service: 'HTTP-alt (nginx 1.18.0)' });
      return { host, ip, scanned: 22, open, note: 'Cyber Desktop simulated scan — zero packets sent.' };
    }
    if (id === 'tlscert') {
      const from = new Date(s.createdAt || Date.now() - 86400000 * 30).toUTCString();
      const to = new Date(Date.now() + 86400000 * 300).toUTCString();
      return {
        host, ip, subject: host, issuer: 'Moundshroud Practice CA (simulated)',
        altNames: [host, 'www.' + host, 'api.' + host], validFrom: from, validTo: to,
        daysLeft: 300, expired: false, protocol: 'TLSv1.3', cipher: 'TLS_AES_256_GCM_SHA384',
        note: 'Simulated certificate.'
      };
    }
    if (id === 'headers') {
      return {
        host, ip, url: 'https://' + host + (at.path || '/'), grade: 'D', score: 35,
        present: [{ name: 'X-Content-Type-Options' }, { name: 'Server (nginx/1.24.0)' }],
        missing: [{ name: 'Content-Security-Policy' }, { name: 'Strict-Transport-Security' }, { name: 'X-Frame-Options' }, { name: 'HttpOnly on session cookie' }]
      };
    }
    if (id === 'fingerprint') {
      const ans = serveTarget(at, 'GET');
      return {
        url: 'https://' + host + (at.path || '/'), status: ans.status, brand: s.brand, category: s.kind, ip,
        server: 'nginx/1.24.0', runtime: 'PHP/8.2.12',
        routes: CW && CW.routes && !s.hub ? CW.routes(s).slice(0, 12) : ['/', '/robots.txt', '/api/repos']
      };
    }
    if (id === 'traceroute') {
      return {
        host, ip,
        hops: [
          { hop: 1, addr: '10.14.0.1', name: 'cd-gateway.local', ms: '0.31 ms' },
          { hop: 2, addr: '10.14.0.254', name: 'cd-core.local', ms: '0.58 ms' },
          { hop: 3, addr: ip, name: host, ms: '0.84 ms' }
        ],
        note: 'Cyber Desktop simulated route — no packet left this page.'
      };
    }
    if (id === 'secrets') {
      const findings = [];
      if (!s.hub && !s.portal) {
        const envAns = CW.serveSilent ? CW.serveSilent(s, '/.env', 'GET') : serveTarget({ site: s, path: '/.env' }, 'GET');
        String(envAns.body || '').split('\n').forEach((line, idx) => {
          if (/PASSWORD|APP_KEY|ADMIN_PATH|ADMIN_EMAIL/.test(line)) {
            const [k, v] = line.split('=');
            findings.push({ file: 'https://' + host + '/.env', line: idx + 1, rule: k, preview: k + '=' + (v ? v.slice(0, 6) + '…' : '') });
          }
        });
      }
      if (trap) {
        findings.push({ file: 'https://' + host + s.virus.scriptPath, line: 1, rule: 'SUSPICIOUS_SCRIPT', preview: 'obfuscated dropper (' + s.virus.vector + ')' });
      }
      return { host, ip, scanned: trap ? 3 : 2, findings, note: 'Scanned simulated Cyber Desktop site ' + host + ' (nothing left this page).' };
    }
    if (id === 'strings') {
      const ans = serveTarget(at, 'GET');
      const parts = [String(ans.body || '')];
      if (trap && CW && CW.serveSilent) parts.push(String(CW.serveSilent(s, s.virus.scriptPath, 'GET').body || ''));
      const found = parts.join('\n').match(/[ -~]{6,}/g) || [];
      return { host, ip, strings: found.slice(0, 80), note: 'Readable text from https://' + host + (at.path || '/') };
    }
    return null;
  }

  async function toolsCommand(rest) {
    const w = argvOf(rest), id = (w[0] || '').toLowerCase();
    if (!id || /^(help|list|\?)$/.test(id)) {
      return ['THE SECURITY TOOLKIT, FROM THIS SHELL — every tool in Cyber › Toolkit, same code',
        '  Works on real local targets AND every website in the Cyber Desktop browser.',
        ''].concat(Object.keys({ ...TOOL_ARGS, ...TOOL_GET }).map(k =>
          '  ' + (TOOL_LINE[k] ? k : k).padEnd(12) + (TOOL_ARGS[k] || []).map(a => '<' + a + '>').join(' ') +
          (TOOL_GET[k] ? '   (no arguments)' : '') + '   — ' + (TOOL_LINE[k] || ''))).concat([
        '',
        '  tool <name> [args…]   run one, e.g.  tool dns amberbasket.shop  ·  tool headers virus 1  ·  tool secrets web/js',
        '  secrets [path|host]   the secret scanner on app files OR any Cyber Desktop website',
        '  strings <file|host>   readable text inside a file OR any Cyber Desktop website',
        '  hashdir [path]        SHA-256 of every file in a folder',
        '',
        '  And the terminal tools the app ships:  rg <pattern> [dir] · fd [pattern] [dir] · jq <filter> <file> · sd <find> <replace> <file>',
        '',
        'Only systems you own or have written permission to test. Nothing here attacks anything.'
      ]).join('\n');
    }
    if (!TOOL_ARGS[id] && !TOOL_GET[id]) return 'tools: no tool called “' + id + '”. Type tools for the list.';
    /* a church site answers no toolkit either: no headers, no DNS lookup, no secrets scan, no port scan */
    const churchTarget = w.slice(1).find(tok => /^(?:https?:\/\/|[\w-]+\.[a-z]{2,12}(?:\/|$))/i.test(tok));
    if (churchTarget) {
      const hit = fakePick(fakeWorld().CW, churchTarget.replace(/^https?:\/\//i, ''), { create: false });
      if (hit && hit.site && isChurchSite(hit.site)) return sanctuary('tool ' + id, hit.site);
    }
    const body = {};
    (TOOL_ARGS[id] || []).forEach((key, i) => { if (w[i + 1] != null) body[key] = w.slice(i + 1).join(' '); });
    if (id === 'hashid' && w[1]) body.hash = w[1];
    if (id === 'hashmake' && w.length > 1) body.text = w.slice(1).join(' ');
    if (id === 'secrets' || id === 'hashdir' || id === 'strings') body.path = w.slice(1).join(' ') || (id === 'strings' ? 'web/js/lib.js' : '.');
    if (id === 'portscan' && w[2]) { body.host = w[1]; body.ports = w[2]; }
    if (id === 'hashcrack' && w[2]) { body.hash = w[1]; body.words = w.slice(2).join(' '); }
    const sim = fakeToolAnswer(id, body);
    if (sim) return toolText(id, sim);
    let r;
    try {
      r = TOOL_GET[id]
        ? await (await fetch('/api/cyber/' + id, { cache: 'no-store' })).json()
        : await (await fetch('/api/cyber/' + id, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })).json();
    } catch (e) { return id + ': ' + String(e && e.message || e); }
    return toolText(id, r);
  }

  /* ---- `virus` / `antivirus`: scan any website for a simulated trap and clean fake pop-ups ------------------- */
  function virusCommand(rest) {
    const w = argvOf(rest), sub = (w[0] || 'status').toLowerCase(), tail = w.slice(1).join(' ').trim();
    const { CW, sites } = fakeWorld();
    const av = (typeof A !== 'undefined' && A.cyberVirus) || null;
    if (/^(help|\?)$/.test(sub)) {
      return ['virus / antivirus — scan Cyber Desktop websites and clean fake pop-ups',
        '  virus status               check if a fake pop-up outbreak is active on the Cyber Desktop',
        '  virus list                 why there is no index of infected sites (scan instead)',
        '  virus scan <host|current>  inspect ANY Cyber Desktop website for an injected script and exposed files',
        '  virus clean                run MoundShroud anti-malware and close every fake pop-up on the desktop'].join('\n');
    }
    if (/^(clean|fix|remove|cure|disinfect)$/.test(sub)) {
      if (av && av.active && av.active()) {
        av.clean();
        return '🧹 MoundShroud anti-malware ran: all fake pop-ups removed from the Cyber Desktop. Nothing real was ever at risk.';
      }
      return 'Desktop is clean: no fake pop-up virus is active right now.';
    }
    if (/^(list|ls|sites|all)$/.test(sub)) return TRAP_SCAN_HINT;
    if (/^(scan|check|inspect)$/.test(sub)) {
      const target = tail || 'current';
      const at = fakePick(CW, target, { create: true });
      if (!at || !at.site) return 'virus scan: could not find website “' + target + '”. Pass any host, URL, `virus 1`, or `current`.';
      if (isChurchSite(at.site)) return sanctuary('virus scan', at.site);
      const s = at.site;
      const lines = ['ANTI-MALWARE SCAN · ' + s.brand + ' · https://' + s.host + ' (' + (s.ip || '127.0.0.1') + ')'];
      if (s.trapped && s.virus) {
        lines.push('  verdict    ⚠ BOOBY-TRAPPED (simulated fake pop-up virus)',
          '  payload    ' + s.virus.name,
          '  script     https://' + s.host + s.virus.scriptPath,
          '  vector     ' + s.virus.vector,
          '  behavior   ' + s.virus.action,
          '  inspect    curl -s https://' + s.host + s.virus.scriptPath,
          '  cleanup    ' + s.virus.clean);
      } else {
        lines.push('  verdict    ✓ clean (no fake pop-up trap on this site)');
      }
      if (!s.hub && !s.portal) {
        lines.push('  exposure   /.env, /robots.txt (' + s.adminPath + '), /api/users, /api/orders, /api/search, /login');
      }
      return lines.join('\n');
    }
    if (/^(status|state)$/.test(sub)) {
      const active = !!(av && av.active && av.active());
      const shield = !!(typeof A !== 'undefined' && A.cyberRewards && A.cyberRewards.blocks && A.cyberRewards.blocks());
      const curUrl = currentBrowserUrl();
      return [
        'CYBER DESKTOP ANTI-MALWARE STATUS',
        '  desktop     ' + (active ? '⚠ FAKE POP-UP VIRUS ACTIVE — run `virus clean` to remove it' : '✓ clean (no active fake pop-ups)'),
        '  shield      ' + (shield ? 'Shield Pro installed (Surplus Vault) — every trap blocked before it opens'
          : 'not installed — buy it at https://vault.moundshroud.example/'),
        '  open tab    ' + (curUrl || '(none)'),
        '',
        '  virus list                  why there is no index of infected sites',
        '  virus scan <host|current>   inspect any website safely from moundshell',
        '  virus clean                 remove active fake pop-ups from the desktop'
      ].join('\n');
    }
    /* shorthand: `virus <host>` scans that site directly */
    return virusCommand('scan ' + rest);
  }

  /* ---- map every bash/network/web/recon/offensive command on `room.cmds` to every Cyber Desktop website -------- */
  /* Because these live on `room.cmds`, pipes (`curl ... | grep ...`), redirects (`curl ... > file.txt`), `&&` chains,
     and mcode `/code` all work seamlessly on EVERY website in the Cyber Desktop browser (including every trapped
     fake-virus site, custom domains, search.moundshroud.example, moundhub.com, and `current`). */
  function wireBrowserCommands(targetRoom) {
    if (!targetRoom || !targetRoom.cmds) return;
    const C = targetRoom.cmds;
    const orig = name => (typeof C[name] === 'function' ? C[name].bind(C) : null);
    const pos = a => (a || []).filter(x => x != null && !String(x).startsWith('-'));
    const hasFlag = (a, re) => (a || []).some(x => re.test(String(x)));
    const flagVal = (a, names) => {
      const arr = a || [];
      for (let i = 0; i < arr.length; i++) {
        if (names.includes(arr[i]) && arr[i + 1] != null) return String(arr[i + 1]);
        for (const n of names) if (String(arr[i]).startsWith(n + '=')) return String(arr[i]).slice(n.length + 1);
      }
      return '';
    };
    const pickTargetToken = a => {
      const arr = a || [];
      const u = flagVal(arr, ['-u', '--url', '-h', '--host', '--target']);
      if (u) return u;
      const tVal = flagVal(arr, ['-t']);
      if (tVal && !/^\d+$/.test(tVal)) return tVal;
      /* skip flag values like `-o out.txt`, `-X POST`, `-b cookie`, `-H header`, `-c 3`, `-p 80`, `-w wordlist` */
      const skipNext = new Set(['-o', '--output', '-O', '-X', '--request', '-d', '--data', '-b', '--cookie', '-H', '--header',
        '-A', '--user-agent', '-c', '-p', '-w', '-t', '-l', '-L', '-P', '-m', '-f', '-T', '-s', '--script']);
      const candidates = [];
      for (let i = 0; i < arr.length; i++) {
        const tok = String(arr[i]);
        if (tok.startsWith('-')) {
          const next = arr[i + 1] != null ? String(arr[i + 1]) : '';
          const scriptTarget = tok === '--script' && (i + 1 === arr.length - 1 ||
            (/^https?:\/\/|\.[a-z]{2,12}(?::\d+)?(?:\/|$)|^\d{1,3}(?:\.\d{1,3}){3}/i.test(next) && !/\.nse$/i.test(next)));
          if (skipNext.has(tok) && !/^-(?:s|L|v|I|i|k|A)$/.test(tok) && next && !next.startsWith('-') && !scriptTarget) i++;
          continue;
        }
        if (/^(?:dir|dns|vhost|s_client|http-get|http-post-form|ssh)$/i.test(tok)) continue;
        candidates.push(tok);
      }
      return candidates.find(x => /^https?:\/\//i.test(x)) ||
        candidates.find(x => /\.[a-z]{2,12}(?::\d+)?(?:\/|$)/i.test(x) || /^\d{1,3}(?:\.\d{1,3}){3}(?:\/|$)/.test(x)) ||
        candidates.find(x => /^(?:current|@current|active|here|moundhub|portal|web|virus|trapped|malware)(?:[\/?#:]|$)/i.test(x)) ||
        candidates[0] || '';
    };
    const resolveFromArgs = (a, allowCreate) => {
      const { CW } = fakeWorld();
      const raw = pickTargetToken(a);
      if (!raw) return null;
      /* support two-word shortcuts like `curl web 2` or `nmap virus 1` */
      const arr = pos(a);
      let key = raw;
      const idx = arr.indexOf(raw);
      if (/^(?:web|virus|trapped|malware)$/i.test(raw) && idx >= 0 && /^\d+$/.test(arr[idx + 1] || '')) key = raw + ' ' + arr[idx + 1];
      const cleaned = key.replace(/\/FUZZ$/i, '/').replace(/^[^@]+@/, '');
      if (allowCreate === undefined) {
        allowCreate = /^(?:https?:\/\/|web\b|virus\b|trapped\b|malware\b|current(?:[\/?#:]|$)|@current(?:[\/?#:]|$)|active(?:[\/?#:]|$)|here(?:[\/?#:]|$)|moundhub)/i.test(cleaned) ||
          /\.example(?:\/|$|:)/i.test(cleaned) || /^10\.14\./.test(cleaned) ||
          (typeof A !== 'undefined' && A.cur === 'cyber' && /\.[a-z]{2,12}(?::\d+)?(?:\/|$)/i.test(cleaned));
      }
      const at = fakePick(CW, cleaned, { create: !!allowCreate });
      if (at && at.site && isChurchSite(at.site)) {
        /* `curl web`, `nmap virus` and friends pick at random: that must never land on a sanctuary, or chance would
           punish the shell. Naming one (a host, a number, `current`) is deliberate, and rings the bells. */
        const all = pos(a), at2 = all.indexOf(raw);
        const numbered = at2 >= 0 && /^\d+$/.test(all[at2 + 1] || '');
        if (/^(?:web|virus|trapped|malware|portal)$/i.test(raw) && !numbered) {
          const C = churchApi();
          const alt = C ? C.elsewhere(at.site, /^(?:virus|trapped|malware)$/i.test(raw)) : null;
          if (alt) return { site: alt, path: '/' };
        }
        return { site: at.site, path: at.path, church: true };
      }
      return at;
    };
    const writeFile = (name, text) => {
      if (!name || !targetRoom.applyFiles) return '';
      const rel = normRel(name);
      if (!rel) return '';
      targetRoom.applyFiles({ [PREFIX + rel]: String(text == null ? '' : text) }, []);
      return rel;
    };
    const httpHeaders = (s, r) => {
      const reason = { 200: 'OK', 201: 'Created', 302: 'Found', 401: 'Unauthorized', 403: 'Forbidden', 404: 'Not Found', 500: 'Internal Server Error' }[r.status] || 'OK';
      const rows = [
        'HTTP/1.1 ' + r.status + ' ' + reason,
        'Date: ' + new Date().toUTCString(),
        'Server: nginx/1.24.0',
        'X-Powered-By: PHP/8.2.12',
        'Content-Type: ' + (r.type || 'text/html; charset=UTF-8'),
        'Content-Length: ' + String(r.body == null ? '' : r.body).length,
        'Set-Cookie: session=' + (s.session && s.session.admin ? 'adm_' + s.token : 'guest') + '; Path=/'
      ];
      return rows.join('\n');
    };
    const simNote = '  · Cyber Desktop simulated site — no packet left this page';

    const origCurl = orig('curl');
    C.curl = a => {
      const at = resolveFromArgs(a);
      if (!at || !at.site) return origCurl ? origCurl(a) : 'curl: no target URL';
      const s = at.site;
      const method = (flagVal(a, ['-X', '--request']) || (flagVal(a, ['-d', '--data']) ? 'POST' : 'GET')).toUpperCase();
      const cookie = flagVal(a, ['-b', '--cookie']);
      if (/session=adm_/i.test(cookie) && s.session) s.session.admin = true;
      const r = serveTarget(at, method);
      const body = String(r.body == null ? '' : r.body);
      const outPath = flagVal(a, ['-o', '--output']);
      if (outPath) {
        const saved = writeFile(outPath, body);
        return '  % Total    % Received % Xferd  Average Speed\n100 ' + fmtBytes(body.length).padStart(6) + '  100 ' + fmtBytes(body.length).padStart(6) +
          '    0     0  4.2M      0 --:--:-- --:--:-- --:--:-- 4.2M\nSaved to ' + (saved || outPath);
      }
      if (hasFlag(a, /^-I$|^--head$/)) return httpHeaders(s, r);
      if (hasFlag(a, /^-[a-z]*i[a-z]*$|^--include$|^-[a-z]*v[a-z]*$/)) return httpHeaders(s, r) + '\n\n' + body;
      return body;
    };

    const origWget = orig('wget');
    C.wget = a => {
      const at = resolveFromArgs(a);
      if (!at || !at.site) return origWget ? origWget(a) : 'wget: missing URL';
      const s = at.site, r = serveTarget(at, 'GET'), body = String(r.body == null ? '' : r.body);
      const reason = { 200: 'OK', 403: 'Forbidden', 404: 'Not Found', 500: 'Internal Server Error' }[r.status] || 'OK';
      const bare = (at.path || '/').split('?')[0];
      const base = bare === '/' ? 'index.html' : (bare.split('/').filter(Boolean).pop() || 'index.html');
      const saveAs = flagVal(a, ['-O', '--output-document']) || base;
      const saved = saveAs === '-' ? '' : writeFile(saveAs, body);
      if (saveAs === '-') return body;
      return [
        '--' + new Date().toISOString().replace('T', ' ').slice(0, 19) + '--  https://' + s.host + (at.path || '/'),
        'Resolving ' + s.host + ' (' + s.host + ')... ' + (s.ip || '127.0.0.1'),
        'Connecting to ' + s.host + '|' + (s.ip || '127.0.0.1') + '|:443... connected.',
        'HTTP request sent, awaiting response... ' + r.status + ' ' + reason,
        'Length: ' + body.length + ' [' + (r.type || 'text/html') + ']',
        "Saving to: '" + (saved || saveAs) + "'",
        '',
        (saved || saveAs) + '  100%[===================>] ' + fmtBytes(body.length) + '  --.-KB/s  in 0s',
        simNote
      ].filter(Boolean).join('\n');
    };

    const origPing = orig('ping');
    C.ping = a => {
      const at = resolveFromArgs(a);
      if (!at || !at.site) return origPing ? origPing(a) : '';
      const s = at.site, ip = s.ip || '127.0.0.1';
      const count = Math.max(1, Math.min(9, parseInt(flagVal(a, ['-c']), 10) || 4));
      const rows = ['PING ' + s.host + ' (' + ip + ') 56(84) bytes of data.'];
      for (let i = 1; i <= count; i++) rows.push('64 bytes from ' + s.host + ' (' + ip + '): icmp_seq=' + i + ' ttl=64 time=0.' + (18 + i * 7) + ' ms');
      rows.push('', '--- ' + s.host + ' ping statistics ---',
        count + ' packets transmitted, ' + count + ' received, 0% packet loss, time ' + (count * 1000) + 'ms',
        simNote);
      return rows.filter(Boolean).join('\n');
    };

    const origDig = orig('dig');
    C.dig = a => {
      const at = resolveFromArgs(a);
      if (!at || !at.site) return origDig ? origDig(a) : '';
      const s = at.site, ip = s.ip || '127.0.0.1';
      const ans = [s.host + '.\t\t300\tIN\tA\t' + ip,
        s.host + '.\t\t300\tIN\tMX\t10 mail.' + s.host + '.',
        s.host + '.\t\t300\tIN\tNS\tns1.' + s.host + '.'];
      return ['; <<>> DiG 9.18.24 <<>> ' + (a || []).join(' '),
        ';; ->>HEADER<<- opcode: QUERY, status: NOERROR',
        ';; QUESTION SECTION:', ';' + s.host + '.\t\t\tIN\tANY', '',
        ';; ANSWER SECTION:'].concat(ans, ['', ';; Query time: 1 msec', ';; SERVER: 10.14.0.1#53(10.14.0.1) (UDP)', simNote]).join('\n');
    };

    const origNslookup = orig('nslookup');
    C.nslookup = a => {
      const at = resolveFromArgs(a);
      if (!at || !at.site) return origNslookup ? origNslookup(a) : '';
      const s = at.site;
      return 'Server:\t\t10.14.0.1\nAddress:\t10.14.0.1#53\n\nNon-authoritative answer:\nName:\t' + s.host +
        '\nAddress: ' + (s.ip || '127.0.0.1') + '\n' + simNote;
    };

    const origHost = orig('host');
    C.host = a => {
      const at = resolveFromArgs(a);
      if (!at || !at.site) return origHost ? origHost(a) : '';
      const s = at.site;
      return s.host + ' has address ' + (s.ip || '127.0.0.1') + '\n' + s.host + ' mail is handled by 10 mail.' + s.host + '.' +
        '\n' + simNote;
    };

    const origWhois = orig('whois');
    C.whois = a => {
      const at = resolveFromArgs(a);
      if (!at || !at.site) return origWhois ? origWhois(a) : '';
      const s = at.site;
      return [
        'Domain Name: ' + s.host.toUpperCase(),
        'Brand: ' + s.brand + ' (' + s.kind + ')',
        'Simulated IP: ' + (s.ip || '127.0.0.1'),
        'Registrar: ' + (s.hub ? 'Moundshroud Local Registry' : 'Moundshroud Cyber Desktop Registry (simulated)'),
        'Creation Date: ' + new Date(s.createdAt || Date.now()).toISOString().slice(0, 10),
        'Admin Email: ' + (s.adminLogin || ('admin@' + s.host)),
        'Name Server: NS1.' + s.host.toUpperCase(),
        'Safety Status: no reputation data (simulated registry)',
        simNote
      ].join('\n');
    };

    const origTrace = orig('traceroute');
    C.traceroute = a => {
      const at = resolveFromArgs(a);
      if (!at || !at.site) return origTrace ? origTrace(a) : '';
      const s = at.site, ip = s.ip || '127.0.0.1';
      return ['traceroute to ' + s.host + ' (' + ip + '), 30 hops max, 60 byte packets',
        ' 1  cd-gateway.local (10.14.0.1)  0.312 ms  0.298 ms  0.340 ms',
        ' 2  cd-core.local (10.14.0.254)   0.521 ms  0.544 ms  0.509 ms',
        ' 3  ' + s.host + ' (' + ip + ')  0.812 ms  0.799 ms  0.845 ms', simNote].join('\n');
    };

    const origNmap = orig('nmap');
    C.nmap = a => {
      const rawTok = pickTargetToken(a);
      /* a leaked user PC answers for its own address, with its own ports and the account that owns it */
      const leakedPc = (typeof A !== 'undefined' && A.cyberPcs) ? A.cyberPcs.find(rawTok) : null;
      if (leakedPc) return A.cyberPcs.scan(leakedPc) + '\n' + simNote;
      const { sites } = fakeWorld();
      if (/^10\.14\.\d+\.0\/(?:16|24)$/.test(rawTok)) {
        const subset = sites.slice(0, 20);
        return ['Starting Nmap 7.94 ( https://nmap.org ) (Cyber Desktop simulated)', ''].concat(
          subset.map(s => 'Nmap scan report for ' + s.host + ' (' + s.ip + ')\nHost is up (0.008s latency).  [' + s.kind + ']'),
          ['', 'Nmap done: ' + sites.length + ' simulated sites on 10.14.0.0/16 (showing first ' + subset.length + ').', simNote]).join('\n');
      }
      const at = resolveFromArgs(a);
      if (!at || !at.site) return origNmap ? origNmap(a) : '';
      const s = at.site, ip = s.ip || '127.0.0.1';
      const sv = hasFlag(a, /^-sV$|^-A$/);
      const ports = [
        ['22/tcp', 'open', 'ssh', 'OpenSSH 8.9p1'],
        ['80/tcp', 'open', 'http', 'nginx 1.24.0'],
        ['443/tcp', 'open', 'ssl/https', 'nginx 1.24.0 (PHP 8.2.12)']
      ];
      if (s.trapped && s.virus) ports.push(['8080/tcp', 'open', 'http-alt', 'nginx 1.18.0 (static)']);
      const rows = [
        'Starting Nmap 7.94 ( https://nmap.org ) (Cyber Desktop simulated)',
        'Nmap scan report for ' + s.host + ' (' + ip + ')',
        'Host is up (0.009s latency).',
        'Not shown: 996 closed tcp ports (reset)',
        'PORT     STATE SERVICE   ' + (sv ? 'VERSION' : '')
      ].concat(ports.map(([p, st, svc, v]) => p.padEnd(9) + st.padEnd(6) + svc.padEnd(10) + (sv ? v : '')));
      if (hasFlag(a, /^--script|^-A$/)) {
        rows.push('| http-title: ' + s.brand + ' (' + s.kind + ')');
        if (!s.hub && !s.portal) {
          const sec = s.sec || {};
          rows.push('| http-robots.txt: ' + (sec.robotsLeaksAdmin ? '3 disallowed entries (' + (sec.loginPath || '/login') + ' /account ' + s.adminPath + ')' : '2 disallowed entries (' + (sec.loginPath || '/login') + ' /account)'));
        }
        if (s.trapped && s.virus) rows.push('|_http-malware-host: injected script served from ' + s.virus.scriptPath);
      }
      rows.push('', 'Nmap done: 1 IP address (1 host up) scanned in 0.42 seconds', simNote);
      return rows.join('\n');
    };

    const origMasscan = orig('masscan');
    C.masscan = a => {
      const at = resolveFromArgs(a);
      if (!at || !at.site) return origMasscan ? origMasscan(a) : '';
      const s = at.site, ip = s.ip || '127.0.0.1';
      return ['Starting masscan 1.3.2 (Cyber Desktop simulated)',
        'Scanning 1 hosts [' + s.host + ' / ' + ip + ']',
        'Discovered open port 22/tcp on ' + ip,
        'Discovered open port 80/tcp on ' + ip,
        'Discovered open port 443/tcp on ' + ip]
        .concat(s.trapped ? ['Discovered open port 8080/tcp on ' + ip] : [], [simNote]).join('\n');
    };

    C.whatweb = a => {
      const at = resolveFromArgs(a);
      if (!at || !at.site) {
        const raw = pickTargetToken(a) || 'http://127.0.0.1/';
        return raw + ' [200 OK] nginx[1.24.0], Title[Simulated host]\n' + simNote;
      }
      const s = at.site;
      return 'https://' + s.host + (at.path || '/') + ' [200 OK] IP[' + (s.ip || '127.0.0.1') + '], HTTPServer[nginx/1.24.0], PHP[8.2.12], ' +
        'Title[' + s.brand + '], Category[' + s.kind + '], Cookies[session]' +
        (s.trapped && s.virus ? ', Script[' + s.virus.scriptPath + ']' : '') + '\n' + simNote;
    };

    const origNikto = orig('nikto');
    C.nikto = a => {
      const at = resolveFromArgs(a);
      if (!at || !at.site) return origNikto ? origNikto(a) : '';
      const s = at.site;
      const rows = [
        '- Nikto v2.5.0 (Cyber Desktop simulated)',
        '---------------------------------------------------------------------------',
        '+ Target IP:          ' + (s.ip || '127.0.0.1'),
        '+ Target Hostname:    ' + s.host,
        '+ Target Port:        443',
        '+ Server: nginx/1.24.0 · PHP/8.2.12',
        '+ The anti-clickjacking X-Frame-Options header is not present.',
        '+ Content-Security-Policy header is not set.'
      ];
      if (!s.hub && !s.portal) {
        const sec = s.sec || {};
        const leaks = sec.leaks || [];
        rows.push('+ ' + (sec.loginPath || '/login') + '/robots.txt retrieved: Disallow entries include ' + (sec.loginPath || '/login') + ', /account' +
          (sec.robotsLeaksAdmin ? ', ' + s.adminPath : ' (no staff path listed)'));
        if (leaks.length) rows.push('+ ' + leaks[0].path + ': configuration file reachable from the web root (' + leaks[0].facts.join(', ') + ').');
        else rows.push('+ No known configuration files exposed to a top-level scan.');
        rows.push(
          '+ /api/users: ' + (sec.openUsersApi ? 'Unauthenticated user directory returned as JSON.' : 'Authentication required (no anonymous user directory).'),
          '+ /api/orders/' + (s.orders && s.orders[0] ? s.orders[0].id : 1001) + ': Object returned without ownership check (IDOR).',
          '+ /api/search?q=\': Possible SQL injection (database syntax error reflected).',
          '+ /login: Credentials submitted over GET; SQL injection bypass possible.'
        );
      }
      if (s.trapped && s.virus) {
        rows.push('+ ' + s.virus.scriptPath + ': obfuscated JavaScript injects a full-screen pop-up (scareware pattern).');
      }
      rows.push('+ 1 host(s) tested', simNote);
      return rows.join('\n');
    };

    const dirEnum = (toolName, origFn) => a => {
      const at = resolveFromArgs(a);
      if (!at || !at.site) return origFn ? origFn(a) : '';
      const s = at.site, { CW } = fakeWorld();
      /* dirScan is the site's real map: its own stack folders, its own leaked files (only on the sloppy sites) and
         the real status code for each, so two sites never answer with the same list */
      const mapped = s.hub ? [{ path: '/', status: 200 }, { path: '/robots.txt', status: 200 }, { path: '/api/repos', status: 200 }]
        : (CW && CW.dirScan ? CW.dirScan(s).map(e => ({
          path: e.path, status: e.status,
          note: e.note || ''
        })) : ['/', '/robots.txt', '/login', s.adminPath].map(p => ({ path: p, status: 200 })));
      const rows = mapped.map(e => e.path.padEnd(26) + '(Status: ' + e.status + ')' + (e.note ? '  <-- ' + e.note : ''));
      return ['===============================================================',
        toolName + ' · https://' + s.host + ' (' + (s.ip || '127.0.0.1') + ')',
        '===============================================================']
        .concat(rows, ['===============================================================',
          'Finished: ' + rows.length + ' routes mapped on ' + s.host + '.', simNote]).join('\n');
    };
    C.gobuster = dirEnum('Gobuster v3.6', orig('gobuster'));
    C.ffuf = dirEnum('ffuf', orig('ffuf'));
    C.dirb = dirEnum('DIRB v2.22', orig('dirb'));
    C.dirbuster = dirEnum('DirBuster', orig('dirbuster'));

    const origSqlmap = orig('sqlmap');
    C.sqlmap = a => {
      const at = resolveFromArgs(a);
      if (!at || !at.site) return origSqlmap ? origSqlmap(a) : '';
      const s = at.site;
      if (s.hub || s.portal) return 'sqlmap: https://' + s.host + ' has no injectable SQL parameters.\n' + simNote;
      const param = /search/i.test(at.path || '') ? 'q' : 'u';
      const rows = (s.users || []).map(u => '| ' + String(u.id).padEnd(2) + ' | ' + String(u.name).slice(0, 14).padEnd(14) + ' | ' +
        String(u.email).slice(0, 32).padEnd(32) + ' | ' + String(u.role).slice(0, 10).padEnd(10) + ' | ' + String(u.api_key) + ' |');
      return ['        sqlmap/1.8 (Cyber Desktop simulated) · https://' + s.host + (at.path || '/login'),
        '[*] parameter \'' + param + '\' appears to be injectable (boolean-based blind, error-based)',
        '[*] back-end DBMS: MySQL >= 5.0', '',
        'Database: ' + s.host.split('.')[0] + '\nTable: users\n[' + rows.length + ' entries]',
        '+----+----------------+----------------------------------+------------+--------------------------+',
        '| id | name           | email                            | role       | api_key                  |',
        '+----+----------------+----------------------------------+------------+--------------------------+']
        .concat(rows, [
          '+----+----------------+----------------------------------+------------+--------------------------+',
          'Leaked staff login: ' + s.adminLogin + ' / ' + s.adminPass,
          'Manual curl bypass: curl "https://' + s.host + "/login?u=' OR 1=1-- &p=x\"",
          simNote]).join('\n');
    };

    const origHydra = orig('hydra');
    C.hydra = a => {
      const at = resolveFromArgs(a);
      if (!at || !at.site) return origHydra ? origHydra(a) : '';
      const s = at.site;
      if (s.hub || s.portal) return 'Hydra v9.4: ' + s.host + ' does not accept password spraying.\n' + simNote;
      const sec = s.sec || {};
      /* a hardened site locks the account after a few failures, the way an SSO front door with MFA and rate limits does */
      if (sec.difficulty === 'hard' || sec.difficulty === 'extreme') {
        return ['Hydra v9.4 (Cyber Desktop simulated)',
          '[443][https-get] host: ' + s.host + ' (' + s.ip + ')',
          '[ERROR] account locked after 5 failed attempts — the login rate-limits by IP and locks the account',
          '[ERROR] no valid password found (0 of 1 target completed)',
          '  on this target the way in is the configuration it leaves lying around, not the password form',
          simNote].join('\n');
      }
      return ['Hydra v9.4 (Cyber Desktop simulated)',
        '[443][https-get] host: ' + s.host + ' (' + s.ip + ')   login: ' + s.adminLogin + '   password: ' + s.adminPass,
        '1 of 1 target successfully completed, 1 valid password found',
        simNote].join('\n');
    };

    const origWpscan = orig('wpscan');
    C.wpscan = a => {
      const at = resolveFromArgs(a);
      if (!at || !at.site) return origWpscan ? origWpscan(a) : '';
      const s = at.site;
      return ['[+] URL: https://' + s.host + '/ (' + (s.ip || '127.0.0.1') + ')',
        '[+] Site: ' + s.brand + ' (' + s.kind + ') · custom PHP stack',
        '[+] Users ' + (s.sec && s.sec.openUsersApi ? 'found via /api/users: ' + (s.users || []).map(u => u.email).join(', ') : 'not enumerable: /api/users requires authentication')]
        .concat(s.trapped && s.virus ? ['[!] Injected script found in the template: ' + s.virus.scriptPath] : [], [simNote]).join('\n');
    };

    const origOpenssl = orig('openssl');
    C.openssl = a => {
      const rest = (a || []).join(' ');
      if (/s_client/i.test(rest)) {
        const connect = flagVal(a, ['-connect']) || pickTargetToken(a);
        const at = connect ? fakePick(fakeWorld().CW, connect.replace(/:\d+$/, ''), { create: true }) : null;
        if (at && at.site) {
          const s = at.site;
          return ['CONNECTED(00000003) -> ' + s.host + ' (' + (s.ip || '127.0.0.1') + ':443)',
            'Certificate chain',
            ' 0 s:CN = ' + s.host,
            '   i:CN = Moundshroud Practice CA (simulated)',
            'Protocol  : TLSv1.3',
            'Cipher    : TLS_AES_256_GCM_SHA384',
            simNote].filter(Boolean).join('\n');
        }
      }
      return origOpenssl ? origOpenssl(a) : '';
    };

    const origNc = orig('nc');
    C.nc = a => {
      const at = resolveFromArgs(a);
      if (!at || !at.site) return origNc ? origNc(a) : '';
      const s = at.site, port = pos(a).find(x => /^\d{2,5}$/.test(x)) || '80';
      if (port === '80' || port === '443' || port === '8080') {
        return 'Connection to ' + s.host + ' (' + (s.ip || '127.0.0.1') + ') ' + port + ' port [tcp/http] succeeded!\n' +
          'Server: nginx/1.24.0 · ' + s.brand + '\n' + simNote;
      }
      return 'nc: connect to ' + s.host + ' (' + (s.ip || '127.0.0.1') + ') port ' + port + ' (tcp) failed: Connection refused\n' + simNote;
    };
    C.ncat = a => C.nc(a);
    C.netcat = a => C.nc(a);
    C.tracepath = a => C.traceroute(a);
    C.http = a => C.curl(a);
    C.feroxbuster = dirEnum('feroxbuster', orig('feroxbuster'));
    C.wfuzz = dirEnum('wfuzz', orig('wfuzz'));

    const textBrowser = a => {
      const at = resolveFromArgs(a);
      if (!at || !at.site) return 'usage: lynx <url|host|current|virus 1>';
      const s = at.site, r = serveTarget(at, 'GET');
      const plain = String(r.body || '').replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
        .replace(/\s+/g, ' ').trim();
      return 'LYNX · https://' + s.host + (at.path || '/') + ' · HTTP ' + r.status + '\n\n' + plain.slice(0, 2000) + '\n' + simNote;
    };
    C.lynx = textBrowser;
    C.w3m = textBrowser;

    const subEnum = toolName => a => {
      const at = resolveFromArgs(a);
      if (!at || !at.site) return 'usage: ' + toolName + ' <domain|current|virus 1>';
      const s = at.site, ip = s.ip || '127.0.0.1';
      return ['[' + toolName + '] ' + s.host + ' (' + ip + ')',
        s.host, 'www.' + s.host, 'api.' + s.host, 'admin.' + s.host, 'mail.' + s.host, 'cdn.' + s.host,
        simNote].join('\n');
    };
    C.subfinder = subEnum('subfinder');
    C.amass = subEnum('amass');

    const origEnum4 = orig('enum4linux');
    C.enum4linux = a => {
      const at = resolveFromArgs(a);
      if (!at || !at.site) return origEnum4 ? origEnum4(a) : '';
      const s = at.site;
      const rows = (s.users || []).map((u, i) => 'user:[' + u.name + '] rid:[0x' + (500 + i).toString(16) + ']  (' + u.email + ' · ' + u.role + ')');
      return ['Starting enum4linux (Cyber Desktop simulated)',
        ' ========================== ( Target ' + s.host + ' · ' + (s.ip || '127.0.0.1') + ' ) ==========================']
        .concat(rows.length ? rows : ['(no local users exposed on this service)'],
          [simNote]).join('\n');
    };

    const origSmb = orig('smbclient');
    C.smbclient = a => {
      const at = resolveFromArgs(a);
      if (!at || !at.site) return origSmb ? origSmb(a) : '';
      const s = at.site;
      return 'smbclient: ' + s.host + ' (' + (s.ip || '127.0.0.1') + ') port 445 closed — HTTP/HTTPS (80, 443) are open. Try: curl https://' + s.host + '/.env or breach ' + s.host + '\n' + simNote;
    };

    const origFtp = orig('ftp');
    C.ftp = a => {
      const at = resolveFromArgs(a);
      if (!at || !at.site) return origFtp ? origFtp(a) : '';
      const s = at.site;
      return 'ftp: connect to ' + s.host + ' (' + (s.ip || '127.0.0.1') + ') port 21: Connection refused (web ports 80/443 open — try curl or breach ' + s.host + ')\n' + simNote;
    };

    const origScp = orig('scp');
    C.scp = a => {
      const at = resolveFromArgs(a);
      if (!at || !at.site) return origScp ? origScp(a) : '';
      const s = at.site;
      return 'scp: ' + s.host + ' (' + (s.ip || '127.0.0.1') + ') requires an authenticated shell — run `breach ' + s.host + '` or download web files with `wget https://' + s.host + '/.env`\n' + simNote;
    };

    const origTshark = orig('tshark');
    C.tshark = a => {
      const at = resolveFromArgs(a);
      const curUrl = currentBrowserUrl();
      const target = at || (curUrl ? fakePick(fakeWorld().CW, curUrl, { create: false }) : null);
      if (!target || !target.site) return origTshark ? origTshark(a) : '';
      const s = target.site, ip = s.ip || '127.0.0.1';
      const rows = [
        'Capturing on \'cd0\' (Cyber Desktop browser traffic -> ' + s.host + ' · ' + ip + ')',
        '    1 0.000000 10.14.0.10 -> ' + ip + ' TLSv1.3 Client Hello (SNI=' + s.host + ')',
        '    2 0.001120 ' + ip + ' -> 10.14.0.10 TLSv1.3 Server Hello, Certificate (CN=' + s.host + ')',
        '    3 0.002450 10.14.0.10 -> ' + ip + ' HTTP/1.1 GET / HTTP/1.1'
      ];
      rows.push('    4 0.003810 ' + ip + ' -> 10.14.0.10 HTTP/1.1 200 OK (' + s.brand + ')');
      rows.push(simNote);
      return rows.join('\n');
    };

    const origSearchsploit = orig('searchsploit');
    C.searchsploit = a => {
      const at = resolveFromArgs(a);
      if (!at || !at.site) return origSearchsploit ? origSearchsploit(a) : '';
      const s = at.site;
      return [
        'Exploits & checks mapped to ' + s.host + ' (' + (s.ip || '127.0.0.1') + ')',
        '----------------------------------------------------------------------',
        '  1. /.env credential disclosure               | curl https://' + s.host + '/.env',
        '  2. /login SQL injection auth bypass          | sqlmap -u "https://' + s.host + '/login?u=1&p=1"',
        '  3. /api/orders/<id> IDOR                     | curl https://' + s.host + '/api/orders/' + (s.orders && s.orders[0] ? s.orders[0].id : 1001),
        '  4. ' + s.adminPath + '/backup.zip exposure  | wget https://' + s.host + s.adminPath + '/backup.zip',
        '  Full interactive engagement:  breach ' + s.host,
        simNote
      ].filter(Boolean).join('\n');
    };

    const origTelnet = orig('telnet');
    C.telnet = a => {
      const at = resolveFromArgs(a);
      if (!at || !at.site) return origTelnet ? origTelnet(a) : '';
      const s = at.site, port = pos(a).find(x => /^\d{2,5}$/.test(x)) || '80';
      return 'Trying ' + (s.ip || '127.0.0.1') + '...\nConnected to ' + s.host + ' on port ' + port + '.\nServer: nginx/1.24.0 (' + s.brand + ')\n' + simNote;
    };

    const origSsh = orig('ssh');
    C.ssh = a => {
      const at = resolveFromArgs(a);
      if (!at || !at.site) return origSsh ? origSsh(a) : '';
      const s = at.site;
      return 'The authenticity of host \'' + s.host + ' (' + (s.ip || '127.0.0.1') + ')\' can\'t be established.\n' +
        'ED25519 key fingerprint is SHA256:SimulatedCyberDesktopHostKey' + (s.token || '0000') + '.\n' +
        'To open a full interactive shell on this site\'s simulated box, run:  breach ' + s.host + '\n' + simNote;
    };

    /* ---- the sanctuary rule: every site tool in this shell refuses church websites -------------------------- */
    /* A church site answers no scan, no dump, no lookup and no shell. The command is not run at all: the bells
       ring for thirty seconds instead. Random `web`/`virus` picks were already moved to an ordinary site by
       resolveFromArgs, so only naming a sanctuary on purpose can ring the bells. */
    const SANCTUARY_TOOLS = ['curl', 'wget', 'ping', 'dig', 'nslookup', 'host', 'whois', 'traceroute', 'nmap', 'masscan',
      'whatweb', 'nikto', 'gobuster', 'ffuf', 'dirb', 'dirbuster', 'sqlmap', 'hydra', 'wpscan', 'openssl', 'nc',
      'feroxbuster', 'wfuzz', 'lynx', 'subfinder', 'amass', 'smbclient', 'ftp', 'scp', 'tshark', 'searchsploit', 'telnet', 'ssh'];
    SANCTUARY_TOOLS.forEach(name => {
      const inner = C[name];
      if (typeof inner !== 'function') return;
      C[name] = function (a) {
        const args = a || [];
        /* a whole-range scan (`nmap 10.14.0.0/16`) is not aimed at one church, and its own branch lists every site */
        if (/^\d{1,3}(?:\.\d{1,3}){3}\/\d+$/.test(pickTargetToken(args) || '')) return inner(a);
        let at = null;
        try { at = resolveFromArgs(args); } catch (e) { at = null; }
        if (at && at.site && (at.church || isChurchSite(at.site))) return sanctuary(name, at.site);
        return inner(a);
      };
    });

    C.virus = a => virusCommand((a || []).join(' '));
    C.antivirus = C.virus;
    C.git = a => {
      const res = runGitArgs(a || []);
      return res == null ? 'git: MoundHub repository store is not loaded yet.' : res;
    };
  }

  /* ---- the app's bundled terminal tools: ripgrep, fd, jq and sd ------------------------------------------------ */
  /* These are the small native tools Moundshroud ships (engines/micro), and the shell answers to the same names so a
     habit learned in a terminal works here too. rg and fd read the app's files; jq and sd work on a file in the shell
     or on JSON text you paste. sd only prints its result — nothing is written unless you redirect it yourself. */
  async function microCommand(name, rest) {
    const w = argvOf(rest);
    const post = async (ep, body) => {
      try {
        const r = await fetch('/api/micro/' + ep, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        return await r.json();
      } catch (e) { return { ok: false, error: String(e && e.message || e) }; }
    };
    const fileText = rel => {
      const want = normRel(rel || '');
      const files = workFiles();
      return want && want in files ? files[want] : null;
    };
    if (name === 'rg') {
      if (!w[0]) return 'rg <pattern> [dir]   — search the app';
      const r = await post('rg', { q: w[0], dir: w[1] || '.', max: 200 });
      if (!r || r.ok === false) return 'rg: ' + r.error;
      return (r.hits || []).map(h => (h.rel || h.file) + ':' + (h.line || 0) + ':' + (h.text || '')).join('\n') || '(no matches)';
    }
    if (name === 'fd') {
      const r = await post('fd', { dir: w[1] || '.', pattern: w[0] || '.', max: 300 });
      if (!r || r.ok === false) return 'fd: ' + r.error;
      return (r.files || []).map(f => f.rel || f.file || f).join('\n') || '(nothing found)';
    }
    if (name === 'jq') {
      if (!w[0]) return 'jq <filter> [file]   — e.g. jq .length web/phone-manifest.json';
      const src = w[1] ? fileText(w[1]) : null;
      const input = src != null ? src : w.slice(1).join(' ');
      if (!input) return 'jq: give it a JSON file in this shell, or JSON text.';
      const r = await post('jq', { input, filter: w[0], raw: true });
      if (!r || r.ok === false) return 'jq: ' + r.error;
      return String(r.output || '').replace(/\n$/, '');
    }
    if (name === 'sd') {
      if (w.length < 3) return 'sd <find> <replace> <file>   — shows the result, writes nothing';
      const text = fileText(w[2]);
      if (text == null) return 'sd: “' + w[2] + '” is not a file in this shell.';
      const r = await post('sd', { input: text, find: w[0], replace: w[1] });
      if (!r || r.ok === false) return 'sd: ' + (r && r.error || 'failed');
      return String(r.output || '').slice(0, 6000) + '\n\n(preview — nothing was written)';
    }
    return name + ': unknown tool';
  }

  /* a stable pretend host key for a leaked PC, so `ssh` shows the same fingerprint twice */
  function pcFingerprint(ip) {
    let h = 2166136261;
    for (let i = 0; i < String(ip).length; i++) { h ^= String(ip).charCodeAt(i); h = Math.imul(h, 16777619); }
    return (h >>> 0).toString(36) + 'SimulatedLeakedHostKey';
  }
  /* opening a session on a leaked user PC: the welcome text, the one-off payout, and the prompt switch */
  function pcOpen(pc, who) {
    pcSession = A.cyberPcs.shell(pc, who);
    try { A.cyberBank?.once('pc:' + pc.ip, 140, 'Remote access: ' + pc.hostname + ' (' + pc.ip + ')', 'host', 'targets'); } catch (e) { }
    return 'Welcome to ' + pc.os + ' (' + pc.hostname + ')\n' +
      'Logged in as ' + who + '. Last login: ' + pc.owner.last + ' from ' + pc.ip + '.\n' +
      'Difficulty: ' + (pc.tier || 'medium') + ' · the FLAG is at /root/flag.txt' +
      (pc.tier === 'extremely-easy' ? ' (and in ~/flag.txt)' : '') + '.\n' +
      'This is ' + pc.name + '\'s own PC — ' + Object.keys(pc.files).length + ' files in ~, including Documents/work and Documents/personal.\n' +
      'Try: ls · cat Desktop/passwords.txt · cat secrets-work.txt · cat Documents/work/root-access.txt · help · exit';
  }

  /* ---- the two commands that leave the app's own disk: a site's leaked user table, and a PC behind one of its IPs --- */
  /* The player's shell and mcode's /code both go through these, so a command typed here and a step mcode runs answer
     exactly the same way. They return the text; the caller prints it and sets the prompt. */
  function leakedFor(want) {
    const key = String(want == null ? '' : want).trim();
    const { CW } = fakeWorld();
    const hit = key ? fakePick(CW, key, { create: true }) : null;
    if (hit && hit.site && isChurchSite(hit.site)) return { text: sanctuary('leaked', hit.site) };
    if (!hit || !hit.site) return { text: 'leaked <host>: name a website from the browser — leaked bank · leaked web · leaked virus · leaked current' };
    const users = A.cyberPcs.roster(hit.site);
    return {
      text: 'LEAKED USERS · ' + hit.site.host + ' (' + hit.site.brand + ') · ' + users.length + ' accounts\n' +
        'Read it in the browser too: https://' + hit.site.host + '/dump/users.csv\n\n' + A.cyberPcs.table(hit.site) +
        '\n\nEvery IP above is a machine on the simulated network:\n' +
        '  nmap ' + users[0].ip + '\n' +
        '  ssh ' + users[0].handle + '@' + users[0].ip + '   (the password is the password column)\n' +
        '\nEach PC has the same tier as the site that leaked it: nmap names it, and the flag is at /root/flag.txt\n' +
        '(home on the softest tier). The way up to root differs per tier: sudo, su, docker or SUID.'
    };
  }
  /* `ssh [user@]<leaked ip> [password]`: with the password inline it logs straight in and the PC's shell takes over;
     without it the shell asks, exactly as ssh does. Returns null when no leaked PC has that address. */
  function sshFor(rest) {
    const args = String(rest == null ? '' : rest).trim().split(/\s+/).filter(Boolean).filter(x => !x.startsWith('-'));
    const targetArg = args[0] || '';
    const pcw = targetArg ? A.cyberPcs.find(targetArg.replace(/^[^@]+@/, '')) : null;
    if (!pcw) return null;
    const userArg = /@/.test(targetArg) ? targetArg.split('@')[0] : '';
    const inline = args[1] || '';
    const check = inline ? A.cyberPcs.login(pcw, userArg, inline) : null;
    if (check && check.ok) return { text: pcOpen(pcw, check.user), session: !!pcSession };
    if (check) return { text: check.why };
    pcAuth = { pc: pcw, user: userArg || pcw.user, tries: 0 };
    return {
      prompt: 'password: ',
      text: 'The authenticity of host \'' + pcw.ip + ' (' + pcw.hostname + ')\' can\'t be established.\n' +
        'ED25519 key fingerprint is SHA256:' + pcFingerprint(pcw.ip) + '.\n' +
        'This machine belongs to ' + pcw.name + ' (' + pcw.owner.role + ', ' + pcw.owner.city + ').\n' +
        (userArg ? '' : 'Accounts on it: ' + pcw.user + ', root.   ') +
        'The password is in the site dump: curl -s https://' + pcw.site.host + '/dump/users.csv\n' +
        pcAuth.user + '@' + pcw.ip + '\'s password: '
    };
  }

  async function exec(raw) {
    if (busy) return;
    const line = String(raw == null ? '' : raw);
    typed(promptText() + line);
    paint();
    if (!line.trim()) return;
    if (line.trim() === 'clear') { resetScreen(); return; }
    /* `pentest` switches between the Pentest user and moundshroud@moundshroud. It only exists inside the Cyber VM:
       with the VM off there is no kali@pentest to become, and the shell stays moundshroud@moundshroud. */
    const pentestCall = /^pentest(?:\s+([\s\S]*))?$/i.exec(line.trim());
    if (pentestCall) {
      const want = String(pentestCall[1] || '').trim().toLowerCase();
      if (/^(help|\?)$/.test(want)) {
        say('pentest           switch between kali@pentest and moundshroud@moundshroud\n' +
          'pentest on        sign in as kali@pentest (needs the Cyber VM running)\n' +
          'pentest off       go back to moundshroud@moundshroud\n' +
          'The Pentest user only exists while the Cyber Desktop\'s VM is on. Turning the VM on does not change an open\n' +
          'shell: use ⟲ Restart (or close and open the shell) and the new session signs in as kali@pentest.');
        paint();
        if (promptEl) promptEl.textContent = promptText();
        return;
      }
      hist.push(line); hi = hist.length;
      let text;
      if (!vmRunning()) {
        pentestUser = false;
        text = 'pentest: the Pentest user only exists inside the Cyber VM.\n' +
          'Start it in Cyber Desktop › Cyber VM, then ⟲ Restart this shell and you sign in as kali@pentest.\n' +
          'Until then the shell stays moundshroud@moundshroud.';
      } else if (/^(off|exit|leave|out|moundshroud|moundshroud@moundshroud)$/.test(want) || (!want && pentestUser)) {
        pentestUser = false;
        text = 'Signed in as moundshroud@moundshroud. Type pentest to become kali@pentest again.';
      } else if (!want || /^(on|in|kali|kali@pentest|pentest)$/.test(want)) {
        pentestUser = true;
        text = 'Signed in as kali@pentest — a Pentest user exists only while the Cyber VM is running.\nType pentest again (or pentest off) to go back to moundshroud@moundshroud.';
      } else {
        text = 'usage: pentest [on|off]   — switches the moundshell user (pentest needs the Cyber VM running)'; 
      }
      say(text);
      paint();
      if (promptEl) promptEl.textContent = promptText();
      return text;
    }
    /* ---- the user PCs behind a leaked IP: password prompt, then the machine's own shell owns every line ------ */
    if (pcAuth) {
      hist.push(line); hi = hist.length;
      const attempt = line.trim();
      let text = '';
      if (/^(?:exit|logout|cancel|abort)$/i.test(attempt)) {
        pcAuth = null;
        text = 'ssh: authentication cancelled.';
      } else {
        const check = A.cyberPcs.login(pcAuth.pc, pcAuth.user, attempt);
        if (check.ok) {
          text = pcOpen(pcAuth.pc, check.user);
          pcAuth = null;
        } else {
          say(check.why);
          if (++pcAuth.tries >= 4) { say('ssh: too many authentication failures (' + pcAuth.pc.ip + ')'); pcAuth = null; }
          else { say(pcAuth.user + '@' + pcAuth.pc.ip + '\'s password: '); if (promptEl) promptEl.textContent = 'password: '; }
          paint();
          return;
        }
      }
      if (text) say(text);
      paint();
      if (promptEl) promptEl.textContent = promptText();
      return text;
    }
    if (pcSession) {
      hist.push(line); hi = hist.length;
      const out = pcSession.run(line);
      const pcHost = pcSession.pc.ip, pcName = pcSession.pc.hostname;
      if (out === null) { pcSession = null; say('Connection to ' + pcHost + ' (' + pcName + ') closed.'); }
      else if (out) say(out);
      paint();
      if (promptEl) promptEl.textContent = promptText();
      return out;
    }
    const sshCall = /^ssh(?:\s+([\s\S]*))?$/i.exec(line.trim());
    if (sshCall && typeof A !== 'undefined' && A.cyberPcs) {
      const res = sshFor(sshCall[1] || '');
      if (res) {
        hist.push(line); hi = hist.length;
        say(res.text);
        paint();
        if (promptEl) promptEl.textContent = res.prompt || promptText();
        return res.text;
      }
    }
    /* `leaked <host>` reads the user table a site left in its web root, without opening a browser */
    const leakedCall = /^(?:leaked|userdump|siteusers)(?:\s+([\s\S]*))?$/i.exec(line.trim());
    if (leakedCall && typeof A !== 'undefined' && A.cyberPcs) {
      hist.push(line); hi = hist.length;
      const text = leakedFor(leakedCall[1]).text;
      say(text);
      paint();
      if (promptEl) promptEl.textContent = promptText();
      return text;
    }
    /* in the breach range `exit` leaves the range first, so a simulated session can never close the shell by mistake */
    if (line.trim() === 'exit' || line.trim() === 'logout') {
      if (breach) {
        hist.push(line); hi = hist.length;
        busy = true;
        try {
          const inside = !/^kali@pentest/.test(String(breach.prompt()));
          say(inside ? String(breach.run('exit')) : await breachCommand('end'));
        } catch (e) { say('range: ' + String(e && e.message || e)); }
        busy = false;
        paint();
        if (promptEl) promptEl.textContent = promptText();
        return;
      }
      close(); return;
    }
    /* the mcode harness owns /commands and `mcode`; everything else is bash on the app's own files */
    /* While the harness is open it owns every line, exactly as it does in the playground; before that, /commands and
       `mcode` open it. Plain text used to fall through to bash here, which looked like mcode ignoring the user. */
    if (mcode && (mcode.open() || /^\/$|^\/[\w-]+(?:\s|$)/.test(line.trim()) || /^mcode(?:\s|$)/i.test(line.trim()))) {
      hist.push(line); hi = hist.length;
      try { mcode.run(line); } catch (e) { say('mcode: ' + String(e && e.message || e)); }
      paint();
      if (promptEl) promptEl.textContent = promptText();
      return;
    }
    /* the Browser and the breach range: `browser …` reads the offline libraries on this PC, `breach …` starts a
       simulated engagement against one of them. Both are answered here, and while a range is open every other line
       belongs to it (until `exit`, which leaves the range and returns to bash). */
    const pathsCall = /^(?:paths|wordlist|try)(?:\s+([\s\S]*))?$/i.exec(line.trim());
    if (pathsCall) {
      hist.push(line); hi = hist.length;
      let text = '';
      try { text = pathsCommand((pathsCall[1] || '').trim()); }
      catch (e) { text = 'paths: ' + String(e && e.message || e); }
      if (text) say(String(text).replace(/\n$/, ''));
      paint();
      if (promptEl) promptEl.textContent = promptText();
      return text;
    }
    /* every fake website, Browser library and Open Range PC hides a FLAG{...}: `solve` pays it into the bank */
    const solveCall = /^(?:solve|submit|flag|flags)(?:\s+([\s\S]*))?$/i.exec(line.trim());
    if (solveCall) {
      hist.push(line); hi = hist.length;
      busy = true;
      let text = '';
      try { text = await solveCommand((solveCall[1] || '').trim()); }
      catch (e) { text = 'solve: ' + String(e && e.message || e); }
      finally { busy = false; }
      if (text) say(String(text).replace(/\n$/, ''));
      paint();
      if (promptEl) promptEl.textContent = promptText();
      return text;
    }
    const rangeCall = /^range(?:\s+([\s\S]*))?$/i.exec(line.trim());
    if (rangeCall) {
      hist.push(line); hi = hist.length;
      let text = '';
      try { text = rangeCommand((rangeCall[1] || '').trim()); }
      catch (e) { text = 'range: ' + String(e && e.message || e); }
      if (text) say(String(text).replace(/\n$/, ''));
      paint();
      if (promptEl) promptEl.textContent = promptText();
      return text;
    }
    const browserCall = /^browser(?:\s+([\s\S]*))?$/i.exec(line.trim());
    if (browserCall) {
      hist.push(line); hi = hist.length;
      busy = true;
      let text = '';
      try { text = await browserCommand((browserCall[1] || '').trim()); }
      catch (e) { text = 'browser: ' + String(e && e.message || e); }
      finally { busy = false; }
      if (text) say(String(text).replace(/\n$/, ''));
      paint();
      if (promptEl) promptEl.textContent = promptText();
      return text;
    }
    const breachCall = /^breach(?:\s+([\s\S]*))?$/i.exec(line.trim());
    if (breachCall) {
      hist.push(line); hi = hist.length;
      busy = true;
      let text = '';
      try { text = await breachCommand((breachCall[1] || '').trim()); }
      catch (e) { text = 'breach: ' + String(e && e.message || e); }
      finally { busy = false; }
      if (text) say(String(text).replace(/\n$/, ''));
      paint();
      if (promptEl) promptEl.textContent = promptText();
      return text;
    }
    /* the walkthrough is answered here too, so it works from inside the range, from a webshell, or before the range
       is even open (it opens one on your newest library) */
    const guideCall = /^(?:walkthrough|walk|guide|tutorial)(?:\s+([\s\S]*))?$/i.exec(line.trim());
    if (guideCall) {
      hist.push(line); hi = hist.length;
      busy = true;
      let text = '';
      try { text = await guideCommand((guideCall[1] || '').trim()); }
      catch (e) { text = 'guide: ' + String(e && e.message || e); }
      finally { busy = false; }
      if (text) say(String(text).replace(/\n$/, ''));
      paint();
      if (promptEl) promptEl.textContent = promptText();
      return text;
    }
    if (breach) {
      hist.push(line); hi = hist.length;
      busy = true;
      let text = '';
      const stepBefore = walk.on && breach.snapshot ? new Set(breach.snapshot().done || []) : null;
      try { text = String(breach.run(line)); }
      catch (e) { text = 'range: ' + String(e && e.message || e); }
      finally { busy = false; }
      if (text) say(String(text).replace(/\n$/, ''));
      /* when the command the walkthrough is teaching lands, say so — it is the only cue that it is time for guide next */
      if (stepBefore) {
        try {
          const now = new Set(breach.snapshot().done || []);
          const step = walkSteps()[walk.step];
          if (step && step.objective && !stepBefore.has(step.objective) && now.has(step.objective)) {
            status('✓ step ' + (walk.step + 1) + ' done (' + step.objective + ') — type guide next');
          }
        } catch (e) { }
      }
      paint();
      if (promptEl) promptEl.textContent = promptText();
      return text;
    }
    /* how hard a site is, from its own content — any site in the fake internet, onion or clearnet */
    const diffCall = /^difficulty(?:\s+([\s\S]*))?$/i.exec(line.trim());
    if (diffCall) {
      hist.push(line); hi = hist.length;
      let text = '';
      try { text = difficultyCommand((diffCall[1] || '').trim()); } catch (e) { text = 'difficulty: ' + String(e && e.message || e); }
      if (text) say(String(text).replace(/\n$/, ''));
      paint();
      if (promptEl) promptEl.textContent = promptText();
      return text;
    }
    /* Tor and the fake VPN: the two commands that change what every other command means in this shell */
    const netCall = /^(tor|vpn)(?:\s+([\s\S]*))?$/i.exec(line.trim());
    if (netCall) {
      hist.push(line); hi = hist.length;
      let text = '';
      try { text = netCommand(netCall[0]); } catch (e) { text = netCall[1].toLowerCase() + ': ' + String(e && e.message || e); }
      if (text) say(String(text).replace(/\n$/, ''));
      paint();
      if (promptEl) promptEl.textContent = promptText();
      return text;
    }
    /* the app itself, Juice Shop, anti-malware and the Toolkit's tools are answered here, so they never fall through to bash */
    const extCall = /^(app|moundshroud|shroud|targets|juice|juiceshop|tool|tools|toolkit|secrets|strings|hashdir|checksums|rg|fd|jq|sd|virus|antivirus|av|malware)(?:\s+([\s\S]*))?$/i.exec(line.trim());
    if (extCall) {
      const name = extCall[1].toLowerCase(), arg = (extCall[2] || '').trim();
      hist.push(line); hi = hist.length;
      busy = true;
      let text = '';
      try {
        if (name === 'app' || name === 'moundshroud' || name === 'shroud') text = await appCommand(arg);
        else if (name === 'targets') text = await targetsCommand(arg);
        else if (name === 'juice' || name === 'juiceshop') text = await juiceCommand(arg);
        else if (name === 'virus' || name === 'antivirus' || name === 'av' || name === 'malware') text = virusCommand(arg);
        else if (name === 'tool' || name === 'tools' || name === 'toolkit') text = await toolsCommand(arg);
        else if (name === 'rg' || name === 'fd' || name === 'jq' || name === 'sd') text = await microCommand(name, arg);
        else text = await toolsCommand(name === 'checksums' ? 'hashdir ' + arg : name + ' ' + arg);
      } catch (e) { text = name + ': ' + String(e && e.message || e); }
      finally { busy = false; }
      if (text) say(String(text).replace(/\n$/, ''));
      paint();
      if (promptEl) promptEl.textContent = promptText();
      return text;
    }
    /* `help` opens the same Help Terminal the sandboxes use: every command, in the simplest words, with a
       playground inside it and a fullscreen button for both. `help <command>` stays inline. */
    /* `help` opens the Help Terminal on its start page; `help <command>` opens that command's page, so the git and
       harness commands this shell adds can be found by name as well as by searching the window. */
    const helpCall = /^help(?:\s+([\s\S]*))?$/i.exec(line.trim());
    if (helpCall) {
      hist.push(line); hi = hist.length;
      const topic = (helpCall[1] || '').trim();
      const note = topic ? 'Help window opened at the page for “' + topic + '”.' :
        'Help window opened: every command, explained as simply as possible, with a playground inside it. Type `help <command>` for one command’s full page.';
      say(note);
      paint();
      if (promptEl) promptEl.textContent = promptText();
      openManual(topic);
      return note;
    }
    hist.push(line); hi = hist.length;
    busy = true;
    let output = '';
    try {
      await ensureLoaded(line);
      const git = gitCommand(line);
      if (git !== null) {
        /* a git command changes the Repositories store, never the files: there is nothing to diff or save back */
        output = git;
      } else {
        const net = netOverride(line);
        try { output = net != null ? net : room.run(line); } catch (e) { output = 'bash: ' + String(e && e.message || e); }
        const before = snapshot;
        snapshot = flat(room.snapshot().tree);
        await persist(before, snapshot);
      }
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

  /* A new session: the screen, an open breach range, the walkthrough, staged commits, history and mcode all go, and
     the app files are read again. With the Cyber VM running the fresh shell signs in as kali@pentest. */
  function resetSession() {
    breach = null; breachItem = null; pcSession = null; pcAuth = null;
    walk = { on: false, step: 0 };
    staged.clear(); hist = []; hi = 0;
    /* this is the only thing besides `pentest` that signs the shell in as kali@pentest: a restart with the VM running */
    pentestUser = vmRunning();
    screenCleared = true; savedLines = null;
  }

  function restartShell() {
    resetSession();
    close();
    open();
  }

  function close() {
    if (!wrap) return;
    if (timer) clearInterval(timer);
    if (userTimer) clearInterval(userTimer);
    userTimer = null;
    timer = null; known = new Map(); sig = ''; syncing = false;
    try { mcode && mcode.close && mcode.close(); } catch (e) { }
    try { manual && manual.close && manual.close(); } catch (e) { }
    manual = null;
    mcode = null; pending.clear(); preloading = false;
    /* the transcript is kept for the next time the shell opens: closing a window must not throw away what you read.
       A screen that is only the starting text (just cleared, or nothing typed yet) is not kept — it is made afresh. */
    savedLines = screenCleared || !lines.length ? null : lines.slice(-MAX_SCROLLBACK);
    screenCleared = false;
    wrap.remove(); wrap = panel = out = inp = promptEl = null; room = null; lines = []; busy = false; maxed = false; minimized = false; staged.clear();
    document.removeEventListener('keydown', onDocKey, true);
    document.removeEventListener('focus', syncFromDisk);
    window.removeEventListener('resize', clampGeometry);
  }

  /* ---- keeping the shell in step with the disk ---------------------------------------------------------------- */
  /* only a signature is polled: walking ten thousand paths must not mean shipping a megabyte of JSON every few seconds */
  async function currentSig() {
    try {
      const r = await fetch(API + 'shell?brief=1', { cache: 'no-store' });
      const d = await r.json();
      return d && d.sig ? d.sig : '';
    } catch (e) { return ''; }
  }

  async function metaList() {
    try {
      const r = await fetch(API + 'shell?meta=1', { cache: 'no-store' });
      const d = await r.json();
      return Array.isArray(d && d.files) ? d.files : null;
    } catch (e) { return null; }
  }

  /* pull in anything another window, the editor, or a build changed while this shell was open */
  async function syncFromDisk() {
    if (!room || busy || syncing) return;
    if (Date.now() < quietUntil) return;   /* the change is this shell's own write, already applied */
    syncing = true;
    try {
      const next = await currentSig();
      if (!next || next === sig) return;
      const list = await metaList();
      if (!list) return;
      const fresh = new Map(list.filter(f => f.text !== false).map(f => [f.rel, f.at]));
      const changed = list.filter(f => f.text !== false && (!known.has(f.rel) || known.get(f.rel) !== f.at));
      const gone = [...known.keys()].filter(rel => !fresh.has(rel));
      known = fresh; sig = next;
      if (!changed.length && !gone.length) return;
      let refreshed = 0;
      const batch = changed.filter(f => f.rel in overlay.files ? false : !overlay.removed.includes(f.rel)).map(f => f.rel);
      if (batch.length) {
        const r = await post('shellfiles', { files: batch.slice(0, 200) });
        const incoming = {};
        for (const [rel, text] of Object.entries((r && r.files) || {})) {
          const key = PREFIX + rel;
          if (snapshot.files[key] === text) continue;
          incoming[key] = text;
          snapshot.files[key] = text;
          refreshed++;
        }
        if (Object.keys(incoming).length) room.applyFiles(incoming, []);
      }
      const removed = gone.map(rel => PREFIX + rel).filter(key => key in snapshot.files);
      for (const key of removed) { delete snapshot.files[key]; refreshed++; }
      if (removed.length) room.applyFiles({}, removed);
      if (refreshed) {
        snapshot = flat(room.snapshot().tree);
        say('  · app changed on disk — refreshed ' + refreshed + ' file' + (refreshed === 1 ? '' : 's'));
        paint();
        if (promptEl) promptEl.textContent = promptText();
      }
    } finally { syncing = false; }
  }

  /* ---- the window --------------------------------------------------------------------------------------------- */
  /* moundshell opens as a real window: the title bar drags it, the bottom-right corner resizes it, and the three
     buttons on the title bar minimize, maximize and close it. It still sits above everything else in the app, so
     Ctrl+T shows it over a page, a game, a maximized Cyber Desktop window or a fullscreen terminal. */
  const MIN_W = 320, MIN_H = 220;
  /* keep at least a corner of the title bar on screen, so a dragged window can never be lost */
  function clampGeometry() {
    if (!panel || maxed) return;
    const vw = window.innerWidth, vh = window.innerHeight;
    const w = Math.round(Math.min(Math.max(panel.offsetWidth, Math.min(MIN_W, vw)), vw));
    const h = Math.round(Math.min(Math.max(panel.offsetHeight, Math.min(MIN_H, vh)), vh));
    const keep = Math.min(140, w);
    const x = Math.min(Math.max(parseFloat(panel.style.left) || 0, keep - w), vw - keep);
    const y = Math.min(Math.max(parseFloat(panel.style.top) || 0, 0), Math.max(0, vh - 34));
    panel.style.width = w + 'px';
    panel.style.height = h + 'px';
    panel.style.left = Math.round(x) + 'px';
    panel.style.top = Math.round(y) + 'px';
  }
  function placeShell() {
    if (!panel) return;
    const vw = window.innerWidth, vh = window.innerHeight;
    const w = Math.round(Math.min(1180, Math.max(Math.min(MIN_W, vw), vw * .9)));
    const h = Math.round(Math.min(820, Math.max(Math.min(MIN_H, vh), vh * .82)));
    panel.style.width = w + 'px';
    panel.style.height = h + 'px';
    panel.style.left = Math.round((vw - w) / 2) + 'px';
    panel.style.top = Math.round((vh - h) / 2) + 'px';
  }
  function bindDrag(bar) {
    if (!bar) return;
    bar.addEventListener('pointerdown', e => {
      if (maxed || minimized || e.button !== 0 || e.target.closest('button, input, label, a, select')) return;
      e.preventDefault();
      const startX = e.clientX, startY = e.clientY;
      const left = parseFloat(panel.style.left) || 0, top = parseFloat(panel.style.top) || 0;
      bar.classList.add('aeshell-grabbing');
      try { bar.setPointerCapture(e.pointerId); } catch (err) { }
      const move = ev => {
        panel.style.left = Math.round(left + ev.clientX - startX) + 'px';
        panel.style.top = Math.round(top + ev.clientY - startY) + 'px';
        clampGeometry();
      };
      const end = () => {
        bar.classList.remove('aeshell-grabbing');
        bar.removeEventListener('pointermove', move);
        bar.removeEventListener('pointerup', end);
        bar.removeEventListener('pointercancel', end);
      };
      bar.addEventListener('pointermove', move);
      bar.addEventListener('pointerup', end);
      bar.addEventListener('pointercancel', end);
    });
  }
  function bindResize(handle) {
    if (!handle) return;
    handle.addEventListener('pointerdown', e => {
      if (maxed || minimized || e.button !== 0) return;
      e.preventDefault();
      const startX = e.clientX, startY = e.clientY;
      const w0 = panel.offsetWidth, h0 = panel.offsetHeight;
      const left = Math.max(0, parseFloat(panel.style.left) || 0);
      const top = Math.max(0, parseFloat(panel.style.top) || 0);
      try { handle.setPointerCapture(e.pointerId); } catch (err) { }
      const move = ev => {
        const w = Math.min(Math.max(MIN_W, w0 + ev.clientX - startX), window.innerWidth - left);
        const h = Math.min(Math.max(MIN_H, h0 + ev.clientY - startY), window.innerHeight - top);
        panel.style.width = Math.round(w) + 'px';
        panel.style.height = Math.round(h) + 'px';
      };
      const end = () => {
        handle.removeEventListener('pointermove', move);
        handle.removeEventListener('pointerup', end);
        handle.removeEventListener('pointercancel', end);
      };
      handle.addEventListener('pointermove', move);
      handle.addEventListener('pointerup', end);
      handle.addEventListener('pointercancel', end);
    });
  }
  function toggleMax() {
    if (!panel) return;
    maxed = panel.classList.toggle('aeshell-max');
    const btn = panel.querySelector('[data-aeshell="max"]');
    if (btn) {
      btn.textContent = maxed ? '❐' : '□';
      btn.title = maxed ? 'Restore the window' : 'Maximize';
      btn.setAttribute('aria-label', maxed ? 'Restore the window' : 'Maximize');
      btn.setAttribute('aria-pressed', String(maxed));
    }
    if (!maxed) clampGeometry();
    if (inp) inp.focus();
  }
  /* minimizing keeps the session: the transcript, mcode, an open breach range and the VM sign-in all wait here until
     the shell is brought back, exactly like minimizing any other window */
  function minimize() {
    if (!wrap) return;
    minimized = true;
    wrap.hidden = true;
    if (typeof A !== 'undefined' && A.toast) A.toast('moundshell minimized — Ctrl+T brings it back.', 3500);
  }
  function restore() {
    if (!wrap) return;
    minimized = false;
    wrap.hidden = false;
    if (inp) inp.focus();
  }

  function onDocKey(e) {
    if (!wrap || minimized) return;
    /* Ctrl+C interrupts a running mcode /code or /swarm turn even if focus left the input box (unless text is selected to copy) */
    if (e.ctrlKey && !e.altKey && !e.metaKey && String(e.key).toLowerCase() === 'c' && mcode && mcode.interrupt &&
      ((mcode.busy && mcode.busy()) || (mcode.whipping && mcode.whipping()))) {
      const sel = window.getSelection ? String(window.getSelection()) : '';
      if (!sel && mcode.interrupt()) {
        e.preventDefault(); e.stopPropagation();
        paint();
        if (promptEl) promptEl.textContent = promptText();
        return;
      }
    }
    if (e.key !== 'Escape') return;
    /* the help window has its own Escape: it closes itself, not the shell behind it */
    if (document.querySelector('dialog.tpg-manual[open]')) return;
    /* an open arrow-key list takes Escape first: it closes the list, not the whole shell */
    if (mcode && mcode.picking && mcode.picking()) {
      e.preventDefault(); e.stopPropagation();
      mcode.key('Escape');
      return;
    }
    e.preventDefault(); e.stopPropagation();
    if (maxed) toggleMax(); else close();
  }

  /* ---- the mcode harness -------------------------------------------------------------------------------------- */
  /* The harness must talk with the same model the user is driving in real Moundshroud Code (mcode). When mcode has
     no session yet it uses the model chosen as the app's main Chat bot. Only local models can serve this shell. */
  async function mcodeModel() {
    /* the model the user is driving in Chat — the last one they picked there — is what they mean by "my model", so it
       comes first: a stale mcode session must never pull the shell onto a model the user is not using */
    try {
      const base = (typeof A !== 'undefined') ? A.ai : null;
      const picked = base && base.localModel ? await base.localModel() : '';
      if (picked) return picked;
    } catch (e) { }
    try {
      const r = await fetch('/api/harness/sessions', { cache: 'no-store' });
      if (r.ok) {
        const d = await r.json();
        /* newest first: the top record is mcode's latest conversation. Agents & Swarm runs live in temp
           folders, so they are not the model the user has open in mcode. */
        const pick = ((d && Array.isArray(d.sessions)) ? d.sessions : []).find(s => s && s.model &&
          !/mcode-swarm/i.test(String(s.dir || '')) && !/[\\/]Temp[\\/]/i.test(String(s.dir || '')));
        if (pick) return String(pick.model);
      }
    } catch (e) { }
    try {
      const pick = (typeof A !== 'undefined' && A.modelOrder && A.modelOrder.get) ? A.modelOrder.get() : '';
      if (pick && !/^(?:free-|claude-)|(?:^|[-:])cloud$/i.test(pick)) return pick;
    } catch (e) { }
    return '';
  }
  /* A thin wrapper over A.ai whose localModel() prefers mcode's model, then Chat's, then the usual fallback. */
  function service() {
    const base = typeof A !== 'undefined' ? A.ai : null;
    if (!base) return base;
    return Object.assign({}, base, {
      localModel: async () => {
        const wanted = await mcodeModel();
        if (wanted) return wanted;
        return base.localModel ? await base.localModel() : '';
      }
    });
  }
  /* ---- /chat: a read-only look through this app -------------------------------------------------------------- */
  /* mcode in /chat may not take a step, so it is handed facts instead: a name in the question is matched against every
     path in the tree, and a search-shaped question is grepped in the text that has arrived. Everything here only reads. */
  const SKIP_WORDS = new Set(('a an the and or of in on at to for from with about into is are was were be been am do does did ' +
    'can could would should will shall may might must have has had i you he she it we they me my your our their his her ' +
    'this that these those what which where when who why how please tell show find search look give get make made path ' +
    'paths file files folder folders directory directories app apps moundshroud code source contain contains containing ' +
    'inside located use used using command commands bash terminal shell moundshell mcode list all any some there here ' +
    'explain describe work works call called define defined something anything thing help need want').split(/\s+/));
  const SEARCHY = /\b(?:find|where|which\s+file|search|looking\s+for|grep|path|defined|referenced|used|file|files|module|function|implement|located|contain)\b/i;
  function lookupWords(text) {
    return String(text || '').replace(/[."'\u2018\u2019\u201c\u201d()\[\]{},;:!?]/g, ' ').split(/\s+/)
      .map(word => word.replace(/^[./~]+/, '').replace(/[./]+$/, ''))
      .filter(word => word.length > 1 && word.length < 80 && !SKIP_WORDS.has(word.toLowerCase()));
  }
  /* every file (or folder) in the tree that answers to this word, shortest path first */
  function lookupPaths(word) {
    const want = word.toLowerCase(), files = [], dirs = [];
    if (!want) return { files, dirs };
    for (const key of Object.keys(snapshot.files)) {
      const rel = strip(key), low = rel.toLowerCase(), base = low.split('/').pop();
      if (low === want || low.endsWith('/' + want) || (/[./]/.test(word) && low.includes(want)) ||
        (want.length > 3 && (base === want + '.js' || base === want + '.html' || base === want + '.css'))) files.push(rel);
    }
    if (!files.length && appDirs.has(want)) dirs.push(want);
    return { files: files.sort((a, b) => a.split('/').length - b.split('/').length || a.length - b.length).slice(0, 6), dirs };
  }
  function lookupLines(rel, n) {
    const text = snapshot.files[PREFIX + rel];
    if (typeof text !== 'string' || !text) return '';
    return String(text).split('\n').slice(0, n).map(line => '    ' + line.slice(0, 160)).join('\n');
  }
  /* What /chat is told it can do here. It sees the app through the search results it is handed; it never runs a step. */
  const CHAT_BRIEF = [
    'You are mcode in the Moundshroud app shell (moundshell), a bash terminal running inside this browser whose only disk is the Moundshroud app itself, mounted at ~/app.',
    'Answer any question the user asks about bash/Linux, about the files of this app, and about the simulated breach range in this shell, briefly and in plain words.',
    'The real computer this app runs on is not visible from here: only ~/app exists.',
    'SEARCH RESULTS come from a real read-only search of this shell. When they are given, answer from them, name the full path relative to ~/app (for example web/js/core.js), and never invent a file or a path.',
    'If the search found nothing, say so plainly instead of guessing a path.',
    'You cannot run a command in /chat: for anything that needs one, say to use /code <task>.',
    'This shell maps every web, recon, and security command (curl, wget, ping, dig, nslookup, host, whois, traceroute, nmap, masscan, whatweb, nikto, gobuster, ffuf, dirb, sqlmap, hydra, wpscan, openssl, nc, ssh, lynx, subfinder, tshark, searchsploit, tool, paths, browser, virus, breach, guide) to EVERY website in the Cyber Desktop browser — including all generated fake websites, every site that may carry an injected script (which site is never announced: find it with `virus scan <site>`, nikto, whatweb or gobuster; `virus clean` ends the pop-ups), Cyber Mail phishing sites, custom domains, `search.moundshroud.example`, offline libraries, and `current` (the open browser tab). MoundHub (moundhub.com) is your own repository store and is deliberately not a target. Answer questions about it freely, and be clear that every host, account, file and flag is invented, no socket is opened, and nothing outside this app is reachable.'
  ].join(' ');
  async function appLookup(question) {
    if (!room) return null;
    const words = lookupWords(question), facts = [], shown = [];
    for (const word of words.slice(0, 6)) {
      const hit = lookupPaths(word);
      if (!hit.files.length && !hit.dirs.length) continue;
      if (hit.dirs.length) {
        const inside = Object.keys(snapshot.files).map(strip).filter(rel => rel.startsWith(hit.dirs[0] + '/'));
        facts.push('Folder ~/app/' + hit.dirs[0] + '/ holds ' + inside.length + ' files, for example:\n' +
          inside.slice(0, 10).map(rel => '  ' + rel).join('\n'));
        shown.push(hit.dirs[0] + '/');
      }
      if (hit.files.length) {
        facts.push('Paths matching "' + word + '" (relative to ~/app):\n' + hit.files.map(rel => {
          const text = snapshot.files[PREFIX + rel];
          const lines = lookupLines(rel, 2);
          return '  ' + rel + '  (' + (typeof text === 'string' && text ? fmtBytes(text.length) : 'contents still loading') + ')' +
            (lines ? '\n' + lines : '');
        }).join('\n'));
        for (const rel of hit.files) shown.push(rel);
      }
      if (shown.length >= 8) break;
    }
    let searched = '';
    if (!facts.length && SEARCHY.test(String(question || ''))) {
      /* no file by that name: search the text that has arrived, so "where is X used" still gets a path and a line.
         This is plain JavaScript over the tree in memory — no command is run, so /chat can never change anything. */
      const term = words.filter(word => word.length >= 4).sort((a, b) => b.length - a.length)[0] || '';
      const safe = term.replace(/[^A-Za-z0-9_./-]/g, '').replace(/^-+/, '');
      if (safe) {
        searched = safe;
        const re = new RegExp(safe.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
        const hits = [];
        for (const key of Object.keys(snapshot.files)) {
          const text = snapshot.files[key];
          if (typeof text !== 'string' || !text || text.length > 1.5e6) continue;
          const at = text.search(re);
          if (at < 0) continue;
          const line = text.slice(text.lastIndexOf('\n', at) + 1).split('\n')[0];
          hits.push(strip(key) + ':' + text.slice(0, at).split('\n').length + ':' + line.trim().slice(0, 200));
          if (hits.length >= 20) break;
        }
        if (hits.length) {
          facts.push('Lines containing "' + safe + '" (path:line:text):\n' + hits.map(line => '  ' + line).join('\n'));
          for (const line of hits) shown.push(line.split(':')[0]);
        }
      }
    }
    if (!facts.length) return null;
    const loading = pending.size;
    const context = facts.join('\n\n') +
      (loading ? '\n\n(' + loading + ' files are still loading into this shell, so these results may be incomplete.)' : '');
    const uniq = [...new Set(shown)].filter(Boolean);
    const note = uniq.length ? 'In this shell: ' + uniq.slice(0, 6).join(', ') + (uniq.length > 6 ? ' …' : '')
      : 'Searched this shell for "' + searched + '" and found no path yet';
    return { note, context };
  }

  /* A message only counts as pointing mcode at the engagement when it names the range, a target or a tool. The range's
     next-step hint is only handed over then: on every line it turned a passing remark into an order to solve it. */
  const POINTS_AT_RANGE = /\b(?:range|target|targets|breach|engagement|scan|nmap|gobuster|nikto|whatweb|sqlmap|curl|wget|exploit|enum|loot|flag|objective|attack|penetrat|hint|continue|carry\s+on|keep\s+going|go\s+on|proceed|resume|next\s+step|what\s+next)\b|https?:\/\/|[\w-]+\.(?:com|net|org|io|dev|local)\b/i;
  /* What /code is told this shell can run, read from the two places that really decide it: the bash room's command
     table and the moundshell's own command catalogue. Because it is read from the live tables, the list can never
     drift from what actually works here — mcode never has to guess at a command, or invent one that does not exist. */
  const PC_COMMANDS = 'ls · cd · pwd · cat · head · tail · grep · find · wc · whoami · id · ps · env · ip a · ss · sudo -l · help · exit';
  let commandCache = { room: null, text: '' };

  /* ---- Tor and the fake VPN, from the shell ---------------------------------------------------------------------------------------------- */
  /* The Browser and this shell share one piece of state (A.tor), so whatever mode the page is in, the shell answers for it:
     `ip a` shows the tunnel, a public-IP lookup returns the exit address, and an .onion only resolves inside a circuit. */
  const netOnionOf = raw => { const m = /\.onion\b/i.test(String(raw || '')); return m; };
  function netCommand(line) {
    const t = A.tor;
    const words = String(line || '').trim().split(/\s+/);
    const cmd = String(words.shift() || '').toLowerCase();
    const arg = (words[0] || '').toLowerCase();
    if (!t) return 'tor: the network simulation is not loaded in this page.';
    if (cmd === 'tor') {
      if (arg === 'on' || arg === 'start' || arg === 'connect') { t.setOn(true); return 'tor: circuit up.\n' + t.line(); }
      if (arg === 'off' || arg === 'stop' || arg === 'disconnect') { t.off(); return 'tor: circuit closed. Traffic leaves this PC directly from ' + t.homeIp() + '.'; }
      if (arg === 'newid' || arg === 'identity' || arg === 'newidentity') { t.newIdentity(); return 'tor: new identity. Three new relays, and any site that knew you does not.\n' + t.line(); }
      if (arg === 'circuit' || arg === 'newcircuit' || arg === 'new' || arg === 'rotate') { t.newCircuit(); return 'tor: new circuit (same identity, new relays).\n' + t.line(); }
      if (arg === 'gov' || arg === 'agencies' || arg === 'police') {
        const list = A.cyberDark ? A.cyberDark.agencies() : [];
        return ['GOVERNMENT & POLICE HIDDEN SERVICES · ' + list.length + ' portals', ''].concat(
          list.map(s => '  ' + (s.host + '                          ').slice(0, 26) + s.brand)).join('\n') +
          '\n\nOpen one with: tor open cai-intel.onion   ·   these are invented agencies in the Cyber Desktop; no portal exists.';
      }
      if (arg === 'sites' || arg === 'list' || arg === 'search') {
        const q = words.slice(1).join(' ').trim();
        const list = A.cyberDark ? A.cyberDark.search(q) : [];
        const show = list.slice(0, 24);
        return ['ONION SERVICES' + (q ? ' matching "' + q + '"' : '') + ' · ' + list.length + ' known, ' + (A.cyberDark ? A.cyberDark.count() : 0) + ' in the index', ''].concat(
          show.map(s => '  ' + (s.host + '                                 ').slice(0, 34) + (s.gov ? '[gov] ' : '') + s.brand + ' · ' + s.kind)).join('\n') +
          (list.length > show.length ? '\n  … and ' + (list.length - show.length) + ' more (tor sites <word>)' : '') +
          '\n\n  tor open <host> opens one in the Browser · tor more mints a fresh page of services';
      }
      if (arg === 'wiki' || arg === 'hiddenwiki' || arg === 'hidden-wiki') {
        const w = A.hiddenWiki ? A.hiddenWiki.site : null;
        if (!w) return 'tor: the Hidden Wiki is not loaded in this page.';
        const url = 'https://' + w.host + '/';
        try { if (A.lib && A.lib.openUrl) { A.lib.openUrl(url, 'The Hidden Wiki'); return 'tor: opening the Hidden Wiki in the Browser — ' + (A.hiddenWiki.count ? A.hiddenWiki.count() : '?') + ' services and ' + (A.hiddenWiki.leaks ? A.hiddenWiki.leaks().length : '?') + ' leak archives.'; } } catch (e) { }
        return 'tor: the Hidden Wiki is at ' + url + ' — open it from the dark web tab or with browser open ' + w.host;
      }
      if (arg === 'more') { const made = A.cyberDark ? A.cyberDark.more(12) : []; return 'tor: ' + made.length + ' more services listed (the index never runs out).\n' + made.map(s => '  ' + s.host + ' · ' + s.brand + ' · ' + s.tier).join('\n'); }
      if (arg === 'open' || arg === 'visit') {
        const host = (words[1] || '').trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
        if (!host) return 'usage: tor open <onion host|name>';
        const url = 'https://' + (/\.[a-z]{2,}$/i.test(host) ? host : host + '.onion') + '/';
        try {
          if (A.lib && A.lib.openUrl) { A.lib.openUrl(url, ''); return 'tor: opening ' + url + ' in the Browser — its toolbar turns into Tor on the way in.'; }
        } catch (e) { }
        return 'tor: the Browser is not available in this page; the address is ' + url;
      }
      if (arg === 'check') {
        const host = (words[1] || '').trim();
        if (!host) return 'usage: tor check <onion host|url>';
        const site = A.cyberDark ? A.cyberDark.find(host.replace(/^https?:\/\//, '').split('/')[0]) : null;
        if (!site) return 'tor: ' + host + ': not an onion address this index knows';
        return 'tor: ' + site.host + ' answered' + (t.on ? '' : ' only because the simulation answered for it — there is no circuit') + '\n' +
          '  ' + site.brand + ' · ' + site.kind + ' · ' + (site.tier || 'hand-written') + ' page' +
          (site.gov ? ' · government portal' : '') + '\n  served by: ' + (t.on ? 'exit relay ' + t.exitIp() : 'this page (no Tor circuit)');
      }
      const v = t.vpn;
      return [
        'TOR · ' + (t.on ? 'circuit up' : 'not connected'),
        '',
        t.on ? '  guard   ' + t.hops()[0].flag + ' ' + t.hops()[0].ip + '  ' + t.hops()[0].city + '   ' + t.hops()[0].nick + '   ' + t.hops()[0].ms + ' ms'
          : '  no circuit: traffic leaves this PC from ' + t.homeIp(),
        t.on ? '  middle  ' + t.hops()[1].flag + ' ' + t.hops()[1].ip + '  ' + t.hops()[1].city + '   ' + t.hops()[1].nick + '   ' + t.hops()[1].ms + ' ms' : '',
        t.on ? '  exit    ' + t.hops()[2].flag + ' ' + t.hops()[2].ip + '  ' + t.hops()[2].city + '   ' + t.hops()[2].nick + '   ' + t.hops()[2].ms + ' ms' : '',
        '',
        '  public address: ' + t.publicIp() + (v.on ? '  (the VPN\u2019s exit, not a Tor relay)' : t.on ? '  (the exit relay)' : ''),
        '  onion services known: ' + (A.cyberDark ? A.cyberDark.count() : 0) + '  ·  government portals: ' + (A.cyberDark ? A.cyberDark.agencies().length : 0),
        '',
        '  tor on | off | circuit | newid | sites [q] | gov | wiki | more | check <host> | open <host>'
      ].filter(x => x !== '').join('\n');
    }
    /* vpn */
    if (arg === 'on' || arg === 'up' || arg === 'connect') {
      const target = (words[1] || '').trim();
      if (target && /^[A-Za-z]{2}$/.test(target)) { const v = t.setCountry(target); return v ? 'vpn: on · ' + v.provider.name + ' · ' + v.city + ' (' + v.cc + ') · public address ' + v.ip : 'vpn: no exit in ' + target; }
      if (target) { const v = t.setProvider(target); return v ? 'vpn: on through ' + v.provider.name + ' · ' + v.city + ' (' + v.cc + ') · public address ' + v.ip : 'vpn: no provider called ' + target; }
      const v = t.vpnOn(); return 'vpn: on · ' + v.provider.name + ' · ' + v.city + ' (' + v.cc + ') · public address ' + v.ip;
    }
    if (arg === 'off' || arg === 'down' || arg === 'disconnect') { t.vpnOff(); return 'vpn: off · this PC answers as ' + t.homeIp() + ' again.'; }
    if (arg === 'list' || arg === 'providers' || arg === 'ls') {
      const cur = t.vpn.provider.id;
      return ['FAKE VPN PROVIDERS · none of them exist', ''].concat(t.providers().map(p =>
        '  ' + (p.id === cur ? '*' : ' ') + ' ' + (p.name + '               ').slice(0, 16) + p.cc + '   ' + p.tag)).join('\n') +
        '\n\n  vpn connect <provider|country code>   ·   vpn off';
    }
    const v = t.vpn;
    return [
      'VPN · ' + (v.on ? 'on' : 'off'),
      '',
      v.on ? '  provider: ' + v.provider.name + ' (' + v.provider.tag + ')' : '  no tunnel: the moundshell, the Browser and every simulated site see ' + t.homeIp(),
      v.on ? '  exit: ' + v.city + ' (' + v.cc + ') · ' + v.ip : '',
      '  what the PC sees: ' + t.publicIp() + (t.on ? '  ·  Tor is also on, so the VPN only wraps the circuit' : ''),
      '',
      '  countries: ' + t.countries().join(' '),
      '  vpn on [cc] | off | list | connect <provider|cc>'
    ].filter(x => x !== '').join('\n');
  }

  /* Lines the shell answers differently depending on the network mode: the same commands the player already types. */
  function netOverride(line) {
    const bare = String(line || '').trim();
    if (!bare || !A.tor) return null;
    const t = A.tor;
    if (/^(?:ip\s+(?:a|addr|address|route)|ifconfig|iwconfig)\s*$/.test(bare)) {
      const v = t.vpn;
      const out = ['1: lo: <LOOPBACK,UP,LOWER_UP> mtu 65536', '    inet 127.0.0.1/8 scope host lo',
        '2: eth0: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500', '    inet ' + t.homeIp() + '/24 brd ' + t.homeIp().replace(/\.\d+$/, '.255') + ' scope global eth0'];
      if (v.on) out.push('3: tun0: <POINTOPOINT,MULTICAST,NOARP,UP,LOWER_UP> mtu 1420', '    inet 10.8.0.6/24 scope global tun0', '    vpn exit ' + v.ip + ' (' + v.city + ', ' + v.cc + ') via ' + v.provider.name);
      if (t.on) out.push('4: socks5 127.0.0.1:9050 (tor) · circuit ' + t.hops().map(h => h.ip).join(' → '));
      return out.join('\n');
    }
    if (/^(?:curl|wget)\s+(?:-\w+\s+)*(?:https?:\/\/)?(?:ifconfig\.me|ipinfo\.io|ip\.me|icanhazip\.com|myip\.online)(?:\/\S*)?\s*$/i.test(bare)) return t.publicIp();
    /* an onion only resolves inside a circuit, exactly as on a real machine */
    if (netOnionOf(bare)) {
      if (!t.on && /^(?:tor|vpn)\b/i.test(bare) === false) return 'resolve: .onion: no route to host (no Tor circuit — run `tor on` first)';
      const m = /\b([a-z2-7]{16,56}\.onion)\b/i.exec(bare);
      if (m && A.cyberWeb && A.cyberWeb.serve) {
        const hit = A.cyberWeb.locate ? A.cyberWeb.locate('https://' + m[1] + '/') : null;
        if (hit && hit.site) {
          const res = A.cyberWeb.serve(hit.site, '/', 'GET');
          if (/^(?:curl)\b/i.test(bare) && !/\s-(?:o|O)\s/.test(bare)) return String(res.body || '').slice(0, 20000);
          if (/^(?:wget)\b/i.test(bare)) return 'Saving to: \u2018index.html\u2019\n\u2018index.html\u2019 saved [' + String(res.body || '').length + '] · through ' + t.exitIp() + ' (' + t.exitCc() + ')';
        }
      }
    }
    return null;
  }

  /* ---- difficulty: how hard a site is to work, read from what the site is ---------------------------------------------- */
  function difficultyCommand(rest) {
    const arg = String(rest == null ? '' : rest).trim();
    const dark = (A && A.cyberDark) || null;
    if (!dark || !dark.difficulty) return 'difficulty: the fake internet is not loaded in this page.';
    const stars = n => '★★★★★'.slice(0, n) + '☆☆☆☆☆'.slice(0, Math.max(0, 5 - n));
    const row = s => {
      const d = dark.difficulty(s);
      return '  ' + stars(d.stars) + '  ' + String(d.score).padStart(3) + '/100  ' + (d.level + '        ').slice(0, 10) + '  ' + (String(s.brand || s.host).slice(0, 30) + '                              ').slice(0, 32) + ' ' + s.host;
    };
    const table = (list, title) => {
      const sorted = list.slice().sort((a, b) => dark.difficulty(b).score - dark.difficulty(a).score);
      return title + ' · ' + sorted.length + ' sites, hardest first\n\n' + sorted.slice(0, 40).map(row).join('\n') +
        (sorted.length > 40 ? '\n  … and ' + (sorted.length - 40) + ' more (difficulty <host> asks about one)' : '');
    };
    if (/^(?:dark|onion|onions)$/i.test(arg)) return table(dark.sites().filter(s => s.dark), 'ONION DIFFICULTY');
    if (/^(?:gov|government|agencies|police)$/i.test(arg)) return table(dark.agencies(), 'GOVERNMENT & POLICE PORTALS');
    if (/^(?:all|list|everything)$/i.test(arg)) {
      const { CW } = fakeWorld();
      let surface = []; try { surface = CW && CW.all ? CW.all().filter(s => !s.dark) : []; } catch (e) { }
      return table(surface.concat(dark.sites()), 'EVERY SITE IN THE FAKE INTERNET');
    }
    /* one site: the open tab, a host, an address, or a name from the index */
    const { CW } = fakeWorld();
    let site = null, at = null;
    if (!arg || /^(?:current|here|this|page)$/i.test(arg)) {
      const cur = currentBrowserUrl();
      at = cur ? fakePick(CW, cur, { create: false }) : null;
      site = at && at.site;
      if (!site) return 'difficulty: nothing is open in the Browser. Try `difficulty dark`, or name a site: difficulty cai-intel.onion';
    } else {
      const clean = arg.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
      site = dark.find(clean)
        || (dark.search(arg)[0] || null)
        || ((at = fakePick(CW, arg, { create: false })) && at.site)
        || null;
    }
    if (!site) return 'difficulty: no site called “' + arg + '”. `difficulty dark` lists the onions, `difficulty all` lists everything.';
    const d = dark.difficulty(site);
    const routes = (() => { try { return dark.scan(site).length; } catch (e) { return '?'; } })();
    const portals = d.gov ? '\n  family: one of ' + dark.agencies().length + ' government portals in the index' : '';
    const start = d.gov ? 'A wall, by design. Read it first: `paths`, then `breach current` to see what the range says about a portal. The report form and the press page are the only things it accepts.'
      : site.leaks ? 'Start with the catalogue: `browser read current` on an archive page, then `paths` for /leaks/<id>/files. The interesting rows are the ones with the oldest provenance.'
        : site.market ? 'Start with `paths` and `leaked current`; an escrow market leaks its own user table, and those IPs answer in this shell.'
          : 'Start with `paths`, then `breach current` for the simulated range, and `leaked current` if the site keeps accounts.';
    return 'DIFFICULTY · ' + String(d.brand) + '\n' +
      '  https://' + site.host + '/  ·  ' + d.kind + (site.dark ? ' · onion' : ' · clearnet') + portals + '\n' +
      '  ' + stars(d.stars) + '  ' + d.score + '/100  ·  ' + d.level.toUpperCase() + '\n\n' +
      '  Why ' + d.score + ':\n' + d.why.map(w => '    · ' + w).join('\n') + '\n\n' +
      '  Content: ' + routes + ' routes on a directory scan · ' + (Array.isArray(site.users) ? site.users.length : 0) + ' rows in its user table · ' +
      (site.leaks ? 'a leak catalogue' : site.market ? 'a cart and an escrow balance' : 'no storefront') + '\n' +
      '  Where to start: ' + start + '\n\n' +
      '  harder: difficulty dark   ·   every portal: difficulty gov   ·   everything: difficulty all';
  }

  function commandBrief() {
    if (room && commandCache.room === room) return commandCache.text;
    const names = new Set();
    const add = name => { if (typeof name === 'string' && /^[a-z][a-z0-9_.+-]{0,23}$/i.test(name)) names.add(name); };
    try { Object.keys((room && room.cmds) || {}).forEach(add); } catch (e) { }
    try { moundshellCommands().forEach(entry => add(String(entry.name || '').trim().split(/\s+/)[0])); } catch (e) { }
    ['targets', 'leaked', 'ssh', 'paths', 'breach', 'browser', 'virus', 'solve', 'range', 'guide', 'pentest', 'current', 'tor', 'vpn', 'difficulty', 'help']
      .forEach(add);
    const text = [...names].sort().join(' · ');
    if (room) commandCache = { room, text };
    return text;
  }
  function buildMcode() {
    const TP = window.TerminalPlayground;
    if (!TP || !TP.mcode || !TP.mcode.create) return null;
    const modelFilter = m => m && !m.cloud && !/embed|(?:^|[-:])cloud$|^free-/i.test(m.name || '');
    try {
      return TP.mcode.create({
        unlocked: () => true,
        maxSteps: Infinity,
        /* /code works like the Agent tab's coding agent: a plain line is a normal message, and commands only start
           running once the player has pointed it at something. */
        assist: true,
        /* an open range or a leaked PC's shell is a session mcode may leave: `exit` is a normal command there */
        canLeave: () => !!(breach || pcSession),
        ai: () => service(),
        models: async signal => {
          if (A.ai && A.ai.models) return await A.ai.models(signal);
          const r = await fetch('/api/models', { signal });
          if (!r.ok) throw new Error('Models unavailable');
          const { models = [] } = await r.json();
          return models.filter(modelFilter).map(m => m.name).filter(Boolean);
        },
        catalog: async signal => {
          if (A.ai && A.ai.catalog) return await A.ai.catalog(signal);
          const r = await fetch('/api/models', { signal });
          if (!r.ok) throw new Error('Models unavailable');
          const { models = [], hardware = null } = await r.json();
          return { hardware, models: models.filter(m => modelFilter(m) && !/-agent(?:-\d+k)?(?::latest)?$|-\d+k-agent(?::latest)?$/i.test(m.name || '')) };
        },
        interp: A.interp ? (lang, code, signal) => A.interp.run(lang, code, { isolated: true, collectFigures: false, signal }).then(A.interp.asText) : null,
        swarmStore: {
          load: () => { try { return JSON.parse(localStorage.getItem('aeshell_mcode_swarm') || 'null'); } catch (e) { return null; } },
          save: value => { try { localStorage.setItem('aeshell_mcode_swarm', JSON.stringify(value)); } catch (e) { } }
        },
        /* the model chosen with /model is remembered across sessions and reloads, so /code never falls back to a
           default the user never chose */
        modelStore: {
          load: () => { try { return localStorage.getItem('aeshell_mcode_model') || ''; } catch (e) { return ''; } },
          save: name => { try { localStorage.setItem('aeshell_mcode_model', String(name || '')); } catch (e) { } }
        },
        whipCursor: A.mcodeWhip ? {
          on: onCrack => A.mcodeWhip.on({ onCrack, host: wrap, target: () => (mcode && mcode.open()) ? out : null }),
          off: () => A.mcodeWhip.off()
        } : null,
        context: () => ({
          key: 'mound-shell', real: true, location: 'Moundshroud app shell (this app’s own files)', shellName: 'bash',
          chatHint: 'Ask about any bash command, or about any file in this app — I look it up in this shell and give you the path.',
          chat: 'The Moundshroud app source tree is mounted at ~/app, and this shell already starts inside it.\n' +
            'Use paths relative to ~/app: server.js, lib/, web/, web/js/, desktop/, tests/. Do NOT prefix them with app/ — there is no app/app folder.\n' +
            'You can run any bash command in this shell, and every app file is on the disk. ' +
            'This shell can only read and change files inside ~/app (the app itself). Nothing outside it exists here, and the real computer this app runs on is not reachable.\n' +
            'This shell also carries a simulated breach range, entirely in this page: `targets` lists the offline pages the Browser holds and the generated fake-internet sites; `breach <n>` or `breach web <n|host>` starts an engagement; inside it nmap, whatweb, gobuster, nikto, curl, sqlmap, shell, sudo -l, status, loot, hint, report and guide all work, and every bash command (ls, cat, echo, python, git, grep …) still works there too. Every host, account, file and flag is invented, no socket is opened, and nothing outside this app is reachable.',
          breach: true,
          /* every command this shell really answers to, handed to /code so it knows the whole inventory — and just a
             leaked PC's own commands while mcode is sitting in that machine's shell */
          commands: pcSession ? PC_COMMANDS + '  (this is ' + pcSession.pc.hostname + '\u2019s own shell: only these, and exit leaves it)' : commandBrief(),
          task: '', plan: 'Ask a question, or /code <task> to let mcode work on this app’s files or the simulated breach range in this shell. It can only touch the app and the in-page simulation, never the rest of the PC.'
        }),
        /* What the shell can tell mcode before it plans: the open range's objectives and the exact next step, so a
           turn never starts blind and guesses at commands the range already spells out. It is handed over only when
           the message points at the range: on every other line it turned a greeting into an order to start scanning. */
        shellState: request => {
          if (!breach || !POINTS_AT_RANGE.test(String(request || ''))) return '';
          const out = [];
          try { out.push(String(breach.run('status'))); } catch (e) { }
          try { out.push(String(breach.run('hint'))); } catch (e) { }
          return out.filter(Boolean).join('\n\n');
        },
        recent: () => lines.slice(-40).map(line => line.t),
        /* the harness rewrites one line in place while an arrow-key list is open, so the newest line is handed back */
        write: text => { say(text); paint(); return lines[lines.length - 1]; },
        /* mcode gets the command's real output back, not a promise: that is why the harness used to sit silent here.
           It is the same shell the user types into, so a task can also start and work the simulated breach range. */
        shell: command => mcodeShell(command),
        refresh: paint,
        visible: () => !!mcode && mcode.open(),
        save: () => { try { localStorage.setItem('aeshell_mcode_seen', String(Date.now())); } catch (e) { } },
        sleep,
        /* /chat gets a read-only look at this app before it answers; /code already drives this same shell. */
        lookup: appLookup,
        instructions: CHAT_BRIEF,
        helpExtra: 'In this shell, /chat also searches the app\u2019s own files (read-only) before it answers and names the path it found. /code is the agent here: a plain line is a normal message and it waits for you, so point it at the target or the file you are working on (\u201cwork the range\u201d, \u201cfix this file\u201d) and watch it start. /code can work the simulated breach range too: targets lists every target, breach <n> or breach web <n|host> starts one, and status, loot, report and guide all return text.',

      });
    } catch (e) { return null; }
  }

  /* ---- commands run straight against the in-memory app tree ------------------------------------------------- */
  /* mcode's harness calls this and needs the output as a string right away: returning a Promise left it empty-handed. */
  function runSync(raw) {
    const line = String(raw == null ? '' : raw);
    if (!room) return '';
    let output = '';
    const git = gitCommand(line);
    if (git !== null) {
      output = git;
    } else {
      /* the same commands, answered for the network mode the Browser is in: `ip a`, a public-IP lookup and an .onion */
      const net = netOverride(line);
      try { output = net != null ? net : room.run(line); } catch (e) { output = 'bash: ' + String(e && e.message || e); }
      const before = snapshot;
      snapshot = flat(room.snapshot().tree);
      try { persist(before, snapshot); } catch (e) { }
    }
    typed(promptText() + line);
    if (output) say(String(output).replace(/\n$/, ''));
    paint();
    if (promptEl) promptEl.textContent = promptText();
    return String(output == null ? '' : output);
  }
  /* mcode's /code drives this same shell, so a task may use every command the user can type here — including the
     breach range and the pages the Browser holds — and gets the text back. The range is invented inside this page and
     the libraries are local files, so none of it can reach the real computer. */
  async function mcodeShell(raw) {
    const line = String(raw == null ? '' : raw).trim();
    if (!line) return '';
    const first = line.split(/\s+/)[0].toLowerCase();
    const rest = line.slice(first.length).trim();
    const finish = text => {
      typed(promptText() + line);
      if (text) say(String(text).replace(/\n$/, ''));
      paint();
      if (promptEl) promptEl.textContent = promptText();
      return String(text == null ? '' : text);
    };
    try {
      /* inside a leaked PC every line is that machine's own shell, exactly as when the player is sitting in it */
      if (pcSession) {
        const out = pcSession.run(line);
        if (out === null) {
          const pc = pcSession.pc;
          pcSession = null;
          return finish('Connection to ' + pc.ip + ' (' + pc.hostname + ') closed. Back in bash.');
        }
        return finish(out || '');
      }
      /* ssh's password prompt: the next line mcode runs is the password, exactly as a player types it */
      if (pcAuth) {
        const attempt = line.trim();
        if (/^(?:exit|logout|cancel|abort)$/i.test(attempt)) { pcAuth = null; return finish('ssh: authentication cancelled.'); }
        const check = A.cyberPcs.login(pcAuth.pc, pcAuth.user, attempt);
        const pc = pcAuth.pc;
        pcAuth = null;
        return finish(check.ok ? pcOpen(pc, check.user) : check.why);
      }
      /* guide is the shell's own walkthrough, not a range command, so it is answered before the range: with a target
         open, `guide` used to fall through to the range's bash and answer "command not found" although the breach
         banner told the player to type it. The interactive shell already checks it in this order. */
      if (['guide', 'walkthrough', 'walk', 'tutorial'].includes(first)) return finish(await guideCommand(rest));
      /* inside the range every line is a range command, exactly as when the user types it. `exit` really leaves:
         the webshell first, then the range, so a task can move on to the next target instead of being trapped here. */
      if (breach) {
        if (/^(?:exit|logout)$/i.test(line)) {
          const inside = !/^kali@pentest/.test(String(breach.prompt()));
          return finish(String(inside ? breach.run('exit') : await breachCommand('end')));
        }
        return finish(await breach.run(line));
      }
      /* the two commands that reach beyond the app's own disk, answered exactly as the player's line is */
      if (['leaked', 'userdump', 'siteusers'].includes(first) && typeof A !== 'undefined' && A.cyberPcs) return finish(leakedFor(rest).text);
      if (['ssh', 'remote'].includes(first) && typeof A !== 'undefined' && A.cyberPcs) {
        const res = sshFor(rest);
        if (res) return finish(res.text);
      }
      if (first === 'breach') return finish(await breachCommand(rest));
      if (first === 'browser') return finish(await browserCommand(rest));
      if (['tor', 'vpn'].includes(first)) return finish(netCommand(line));
      if (first === 'difficulty') return finish(difficultyCommand(rest));
      if (['paths', 'wordlist', 'try'].includes(first)) return finish(pathsCommand(rest));
      if (first === 'targets') return finish(await targetsCommand(rest));
      if (['virus', 'antivirus', 'av', 'malware'].includes(first)) return finish(virusCommand(rest));
      if (['app', 'moundshroud', 'shroud'].includes(first)) return finish(await appCommand(rest));
      if (['juice', 'juiceshop'].includes(first)) return finish(await juiceCommand(rest));
      if (['tool', 'tools', 'toolkit'].includes(first)) return finish(await toolsCommand(rest));
      if (['secrets', 'strings', 'hashdir', 'checksums'].includes(first)) return finish(await toolsCommand(first === 'checksums' ? 'hashdir ' + rest : first + ' ' + rest));
      if (['rg', 'fd', 'jq', 'sd'].includes(first)) return finish(await microCommand(first, rest));
      if (['solve', 'submit', 'flag', 'flags'].includes(first)) return finish(await solveCommand(rest));
      if (first === 'range') return finish(rangeCommand(rest));
    } catch (e) { return finish('shell: ' + String(e && e.message || e)); }
    return runSync(line);
  }
  /* `targets` — everything a breach or recon command may be pointed at, including every fake & trapped-virus website. */
  async function targetsCommand(rest) {
    const filter = String(rest == null ? '' : rest).trim().toLowerCase();
    const onlyVirus = /^(?:virus|trapped|malware)$/.test(filter);
    if (onlyVirus) return TRAP_SCAN_HINT;
    const showAll = filter === 'all';
    const out = ['BREACH & RECON TARGETS · every website in the Cyber Desktop browser (all simulated inside this page)', ''];
    const curUrl = currentBrowserUrl();
    const { CW, sites: fakeAll } = fakeWorld();
    if (curUrl) {
      const curAt = fakePick(CW, curUrl, { create: false });
      out.push('  CURRENTLY OPEN IN BROWSER — use `current` with any command:',
        '    ' + curUrl + (curAt && curAt.site ? '  (' + curAt.site.brand + ' · ' + (curAt.site.ip || '127.0.0.1') + ')' : ''), '');
    }
    if (!onlyVirus) {
      try {
        const items = await browserItems();
        const mine = items.filter(item => item.kind === 'mine');
        const books = items.filter(item => item.kind === 'book');
        out.push('  OFFLINE PAGES the Browser holds — start one with: breach <n>');
        if (mine.length) for (const item of mine) out.push('    ' + String(item.n).padStart(2) + '. ' + item.title + (item.url ? '  ·  ' + item.url : ''));
        else out.push('    none imported yet — import a page in the Browser, or use any website below');
        if (books.length) out.push('    + ' + books.length + ' bundled reference libraries (type `browser` to list)');
        out.push('');
      } catch (e) { out.push('  (the Browser libraries could not be listed: ' + String(e && e.message || e) + ')', ''); }
      out.push('  BUILT-IN BROWSER WEBSITES',
        '    moundhub.com               127.0.0.1    MoundHub (your repositories — not a scan target)',
        '    search.moundshroud.example 10.14.0.1    Moundshroud Search (fake internet index)',
        '    range.moundshroud.lab      10.66.0.1     Moundshroud Open Range (endless practice PCs · `range`)', '');
    }
    let fake = fakeAll;
    if (onlyVirus) fake = fake.filter(s => s.trapped);
    else if (filter && !showAll && CW && CW.search) fake = CW.search(filter, 80);
    const sanctuaries = fake.filter(isChurchSite);
    fake = fake.filter(s => !isChurchSite(s));
    out.push('  FAKE INTERNET websites (' + fake.length + ' matched · ' + fakeAll.length + ' total) — `breach <host>`');
    const limit = showAll ? 120 : 40;
    if (fake.length) {
      fake.slice(0, limit).forEach(site => out.push('    ' + String(site.id).padStart(3) + '. ' + site.host.padEnd(28) + ' ' + (site.ip || '').padEnd(13) + ' ' + (site.brand || site.host)));
      if (fake.length > limit) out.push('    …and ' + (fake.length - limit) + ' more (`targets <keyword>`, `targets virus`, or pass any domain directly)');
    } else if (!sanctuaries.length) out.push('    (no sites matched that filter — any domain you type is created automatically)');
    if (sanctuaries.length) out.push('    · ' + sanctuaries.length + ' church website' + (sanctuaries.length === 1 ? '' : 's') +
      ' in this list ' + (sanctuaries.length === 1 ? 'is' : 'are') + ' off limits to every tool in this shell — browse ' +
      (sanctuaries.length === 1 ? 'it' : 'them') + ' in the Cyber Desktop browser instead');
    out.push('', '  Every moundshell command works on every site above:',
      '    curl · wget · ping · dig · nslookup · host · whois · traceroute · nmap · masscan · whatweb · nikto · gobuster · ffuf · dirb · sqlmap · hydra · wpscan · openssl · nc · ssh',
      '    browser read|source|open|breach <site> · paths <site> · tool <name> <site> · virus scan|list|clean · breach <site> · guide <site>');
    return out.join('\n');
  }
  /* The help window's playground works on a throwaway copy of the app tree. It can list, read and search, but it can
     never write to the real shell (or the overlay the shell keeps in this browser): nothing typed in help can change
     the app. The copy is remade every time the help window opens, the way the sandboxes' help playground is fresh. */
  let manualRoom = null;
  function buildManualRoom() {
    manualRoom = null;
    if (!room || !window.TerminalPuzzles || !window.TerminalPuzzles.buildCustomFileRoom) return;
    try {
      const current = flat(room.snapshot().tree), files = {};
      for (const [rel, text] of Object.entries(current.files)) files[rel] = text;
      manualRoom = window.TerminalPuzzles.buildCustomFileRoom({ shell: 'bash', files, title: 'Help playground (copy)', brief: '', difficulty: 'insane', machine: machineInfo() });
      manualRoom.run('cd app');
      if (!String(manualRoom.cwdPath()).startsWith('/app')) manualRoom.run('cd /app');
      wireBrowserCommands(manualRoom);
    } catch (e) { manualRoom = null; }
  }
  function runHelp(raw) {
    if (!manualRoom) return 'The help playground is not ready yet — close this window and open Help again.';
    let output = '';
    try { output = manualRoom.run(String(raw == null ? '' : raw)); } catch (e) { output = 'bash: ' + String(e && e.message || e); }
    return String(output == null ? '' : output);
  }
  function helpPrompt() {
    let parts = [];
    try {
      const v = manualRoom && manualRoom.cwdPath ? manualRoom.cwdPath() : [];
      parts = (Array.isArray(v) ? v.slice() : String(v || '').split('/').filter(Boolean)).filter(p => p !== 'app');
    } catch (e) { parts = []; }
    return 'moundshroud@moundshroud:~/app' + (parts.length ? '/' + parts.join('/') : '') + '$ ';
  }

  /* ---- the help window: the same Help Terminal the sandboxes use, with its playground and fullscreen ---------- */
  /* The moundshell's help is the Bash sandbox's help: the very same shell object, so every page, switch page,
     walkthrough and mission matches the Playground's Help window exactly. Only the playground underneath differs — it
     runs the copy of this app instead of the sandbox's pretend machine. */
  /* Every command this shell answers to that bash does not: its git commands (which work on the Repositories store)
     and the mcode harness's slash commands. They are handed to the help index, so the help window lists the whole
     shell instead of bash's commands alone. The help window's playground is only a copy of the app's files, so these
     pages offer Copy to my terminal instead of a Run button. */
  function moundshellCommands() {
    const git = (name, syntax, description, options, examples, aliases) => ({
      name, chapter: 'Git in the moundshell', syntax, description, options: options || [],
      examples: examples || [], aliases: aliases || [], runnable: false,
      added: 'Git here is this app’s own repository store, not a .git folder on a disk and not the git program: it reads and writes the Repositories tab, so only the verbs listed in this chapter work, and no real repository is touched.'
    });
    const harness = (name, syntax, description, examples, aliases, native) => ({
      name, chapter: 'mcode harness', syntax, description: [description], options: [],
      examples: examples || [], aliases: aliases || [], runnable: false,
      added: native ? '' : 'This belongs to the mcode harness built into the moundshell, not to bash: it is read by the harness before the shell sees the line.'
    });
    /* the Browser's own offline pages, and the simulated range that runs on them */
    const own = (name, syntax, description, examples, aliases) => ({
      name, chapter: 'Browser & the breach range', syntax, description: [description], options: [],
      examples: examples || [], aliases: aliases || [], runnable: false,
      added: 'This belongs to the moundshell, not to bash: it reads the pages your Browser holds on this computer and, in the breach range, simulates an engagement against one of them entirely inside the page. Nothing is sent and no real site is touched.'
    });
    return [
      git('git', 'git <subcommand>', [
        'git in the moundshell writes to the repository store behind MoundHub (https://moundhub.com, in the Browser), not to a hidden .git folder. A commit made here is waiting there, and git push records the push.',
        'These are the only git commands this shell has; anything else prints the list. MoundHub › Settings can export a repository for another PC.'
      ], [
        ['init [name]', 'make a repository for this app'],
        ['status', 'what changed since the newest commit'],
        ['add -A | <path>', 'stage your changes'],
        ['commit -m "message"', 'save a commit on MoundHub'],
        ['push', 'push the newest commit (to origin, when it has a URL)'],
        ['log --oneline', 'the commit history'],
        ['branch | remote -v | diff', 'the branch, the remote, and what changed']
      ], [['git help', 'the short list of git commands in this shell']], ['git help', 'git --help']),
      git('git init', 'git init [name]', [
        'Makes a new repository for this app and records it on MoundHub. It starts on branch main with no commits yet.'
      ], [], [['git init my-project', 'create a repository called my-project']], ['init']),
      git('git status', 'git status', [
        'Shows what has changed since the newest commit: files you staged, files that changed, and files this shell created. Only the repository\u2019s own files and the files this shell changed are listed.'
      ], [], [['git status', 'staged, changed and new files']], ['status']),
      git('git add', 'git add -A | git add <path>', [
        'Stages changes so the next commit records them. git add -A stages everything this shell changed; git add web/js/core.js stages one file.'
      ], [['-A', 'stage every change this shell made'], ['--all', 'the same as -A']],
        [['git add -A', 'stage everything this shell changed'], ['git add web/js/core.js', 'stage one file']], ['add']),
      git('git commit', 'git commit -m "message"', [
        'Saves the staged changes as a commit on MoundHub. -m is the message; -a also stages changes to files the repository already holds.'
      ], [['-m "message"', 'the commit message'], ['-a', 'stage tracked changes first'], ['--allow-empty', 'permitted when nothing changed']],
        [['git commit -m "first commit"', 'save a first commit'], ['git commit -am "fix the header"', 'stage and commit in one step']], ['commit']),
      git('git push', 'git push', [
        'Pushes the newest commit strictly to MoundHub (https://moundhub.com) in the app\u2019s browser. External git hosts are blocked here.'
      ], [['origin', 'the MoundHub remote (https://moundhub.com/moundshroud/<repo>.git)']],
        [['git push', 'push the newest commit to MoundHub']], ['push']),
      git('git log', 'git log [--oneline]', [
        'Lists commits, newest first. --oneline prints one line per commit.'
      ], [['--oneline', 'one line per commit']], [['git log --oneline', 'compact history']], ['log']),
      git('git branch', 'git branch', [
        'Prints the branch this repository is on. The shell\u2019s git does not create branches; make and switch them from the MoundHub page.'
      ], [], [['git branch', 'the current branch']], ['branch']),
      git('git remote', 'git remote [-v] | git remote add origin <moundhub-url>', [
        'Shows the MoundHub remotes, or sets origin to a https://moundhub.com repository URL. External hosts are refused.'
      ], [['-v', 'show the MoundHub URL'], ['add origin <url>', 'point origin at a MoundHub repository']],
        [['git remote -v', 'the MoundHub remote and its URL'], ['git remote add origin https://moundhub.com/moundshroud/app.git', 'point origin at MoundHub']], ['remote']),
      git('git diff', 'git diff', [
        'Shows a unified diff of what changed since the newest commit (or of the staged files when something is staged).'
      ], [], [['git diff', 'the pending change as a diff']], ['diff']),
      git('git show', 'git show', [
        'Prints the newest commit: its id, author, message and the files it changed.'
      ], [], [['git show', 'the newest commit']], ['show']),
      git('git restore', 'git restore --staged [path]', [
        'Unstages files, with or without naming them. Without --staged it says that commits are already saved on MoundHub.'
      ], [['--staged', 'unstage the named files (or everything)']], [['git restore --staged web/js/core.js', 'unstage one file']], ['restore']),
      git('git reset', 'git reset [--staged] [path]', [
        'With --staged it unstages files. Without it, the shell explains that commits are already saved on MoundHub.'
      ], [['--staged', 'unstage files']], [['git reset --staged', 'unstage everything']], ['reset']),
      harness('/help', '/help', 'Lists every mcode harness command, with what each one does.', [['/help', 'the harness command list']], ['help', '?']),
      harness('/chat', '/chat <question>', 'Talks to the local model and runs nothing. In this shell it also searches the app\u2019s own files (read-only) before it answers and names the path it found.', [['/chat where is the terminal help built?', 'a question about this app or bash']]),
      harness('/code', '/code [task]', 'The agent in this shell. A plain line is a normal message: it answers and waits. Point it at something (a file to fix, a target to work) and it plans, runs one command at a time against this app\u2019s files and the simulated breach range, and gets each command\u2019s real output back. It can only change the app and the in-page simulation, never the rest of the PC.', [['/code add a keyboard shortcut for the shell', 'a task mcode carries out here'], ['/code work the breach range and list the vulnerabilities you find', 'a simulated engagement on an offline page']]),
      harness('/swarm', '/swarm [run|add|set|roles|help]', 'Runs several local agents at once, one per role, each with its own model. /swarm help explains the rest.', [['/swarm', 'open the swarm']]),
      harness('/model', '/model [name|number]', 'Lists the local models or chooses the one the harness uses.', [['/model', 'choose a model']], ['/models']),
      harness('/tool', '/tool', 'Makes or tests a text tool that /code can use.', [['/tool', 'open the tool maker']]),
      harness('/rule', '/rule', 'Saves reply preferences for /chat and /code.', [['/rule', 'open the reply rules']]),
      harness('/autonomy', '/autonomy careful|normal|auto', 'How much the harness asks before running a command: careful asks every time, normal waits between steps, auto never pauses.', [['/autonomy careful', 'ask before each command']], ['/strict', '/trust']),
      harness('/think', '/think on|off', 'Shows or hides the short summary the harness prints before each step.', [['/think off', 'hide the step summaries']], ['/thoughts']),
      harness('/whip', '/whip [on|off]', 'OpenWhip: the pointer becomes a whip; crack it over the reply to hurry mcode along. Ctrl+C puts it away.', [['/whip on', 'take out the whip']]),
      harness('/find', '/find <text>', 'Searches this shell\u2019s recent output.', [['/find terminal', 'find a word in the recent output']]),
      harness('/scan', '/scan', 'Lists the AI models this PC can run.', [['/scan', 'what this PC can run']]),
      harness('/theme', '/theme [name]', 'Prompt colours: aurora, ember, ocean, forest, candy, mono, matrix, plain.', [['/theme ocean', 'switch the prompt colour']]),
      harness('/color', '/color accent #rrggbb', 'Sets one prompt colour, as a hex value.', [['/color accent #7fd1ff', 'set the accent colour']], ['/colour']),
      harness('/stats', '/stats', 'Replies, /code runs, steps, commands and answers in this session.', [['/stats', 'this session so far']], ['/usage', '/about']),
      harness('/new', '/new', 'Starts a fresh conversation and stops anything running.', [['/new', 'start again']]),
      harness('/stop', '/stop', 'Stops the running turn. Ctrl+C does the same.', [['/stop', 'stop the turn']]),
      harness('/submit', '/submit', 'Submits the harness\u2019s last answer, but only when the puzzle confirms it.', [['/submit', 'submit the last answer']]),
      harness('/plan', '/plan', 'Prints the current objective and where to start.', [['/plan', 'what mcode is working on']]),
      harness('/dir', '/dir', 'Says where the harness works: this app\u2019s files, mounted at ~/app.', [['/dir', 'where it works']]),
      harness('/reach', '/reach', 'Says what the harness can reach: only this shell and its files. The rest of the PC is not visible here.', [['/reach', 'what it can reach']]),
      harness('/net', '/net', 'Says whether anything can go online: nothing can. Commands are simulated and the model runs on this PC.', [['/net', 'the network rules']], ['/web']),
      harness('/exit', '/exit', 'Leaves the mcode harness and returns to the plain moundshell prompt. /bye and /quit do the same.', [['/exit', 'back to the shell'], ['/bye', 'the same thing']], ['/quit', '/bye']),
      harness('mcode', 'mcode [question]', 'Hands the rest of the line to the mcode harness, the same as typing /code.', [['mcode where is the help built?', 'ask the harness']]),
      harness('logout', 'logout', 'Closes the moundshell, the same as exit.', [['logout', 'close the shell']], ['exit'], true),
      own('browser', 'browser [list|tabs|sites [q]|virus]', 'Lists every offline library and every website in the Cyber Desktop browser — MoundHub, Moundshroud Search, and all generated fake-internet websites. `browser sites` searches them all; `browser virus` explains how to scan a site for a simulated pop-up trap (no site is tagged); `browser tabs` shows open tabs.',
        [['browser', 'libraries and Cyber Desktop sites'], ['browser sites bank', 'search generated sites'], ['browser virus', 'how to scan a site yourself'], ['browser dark', 'the Fake Dark Web: every onion hidden service'], ['browser tabs', 'pages open right now']], ['browser list']),
      own('browser read', 'browser read <n|slug|host|url|current>', 'Reads any imported page or any Cyber Desktop browser website (MoundHub, search.moundshroud.example, and any path like /.env or /robots.txt).',
        [['browser read 1', 'read your newest imported library'], ['browser read current', 'read the website currently open'], ['browser read virus 1', 'read a site picked at random']], ['browser cat']),
      own('browser source', 'browser source <n|slug|host|url|current>', 'Prints the raw HTML, JSON or script source of any imported library or any Cyber Desktop browser website.',
        [['browser source 1', 'the HTML as stored'], ['browser source virus 1', 'inspect a random site’s HTML source']], ['browser src']),
      own('browser open', 'browser open <n|slug|host|url|current>', 'Opens any library or Cyber Desktop website in the Browser (creating any new domain on demand, just like the address bar).',
        [['browser open 1', 'show it in the Browser'], ['browser open moundhub.com', 'open MoundHub'], ['browser open virus 1', 'open a random site']], ['browser go']),
      own('difficulty', 'difficulty [site|current|dark|gov|all]', 'How hard a site is to work, read off what the site actually is rather than a table of numbers. `difficulty <host|name|url>` rates one site; with no argument it rates whatever the Browser has open. Onions, government portals and leak archives are rated too, and the government portals sit at the far end of the scale — a staff-only portal with no upload, a pinned signing key and a filter in front is not a market with a cart. The rating explains itself: each line is a fact about the site (escrow and a cart, a user table to enumerate, a shoddy build that prints its own errors) rather than a made-up score.',
        [['difficulty cai-intel.onion', 'how hard the CAI portal is, and why'], ['difficulty', 'rate the page open in the Browser'], ['difficulty dark', 'every onion, hardest first'], ['difficulty gov', 'the nine government and police portals'], ['difficulty all', 'every site in the fake internet, hardest first'], ['difficulty nightfall', 'rate a site by name']]),
      own('tor', 'tor [on|off|circuit|newid|status|sites [q]|gov|wiki|more|check <host>|open <host>]', 'Tor from the moundshell. `tor` on its own prints the circuit: the guard, the middle relay and the exit, each with its own country and address, plus the public address this PC appears to have. `tor on` builds a circuit, `tor circuit` keeps your identity and swaps the three relays, `tor newid` swaps the circuit and drops everything the pages were holding about you. With Tor on, `.onion` addresses resolve: `curl <host>.onion` returns the page, `ip a` shows the socks proxy, and a public-IP lookup answers with the exit relay. With Tor off, an .onion has no route, exactly as on a real machine. `tor sites` searches every hidden service, `tor gov` lists the government and police portals, `tor more` mints a fresh page of services.',
        [['tor', 'the three relays and the exit address'], ['tor on', 'build a circuit'], ['tor newid', 'a new circuit with no shared history'], ['tor gov', 'the government and police onion portals'], ['tor wiki', 'open The Hidden Wiki and its directory'], ['tor sites bank', 'search the hidden services'], ['tor open cai-intel.onion', 'open a portal in the Browser'], ['tor check nightfall-market.onion', 'does an address answer, and through which exit'], ['tor more', 'another page of services']], ['onion', 'circuit']),
      own('vpn', 'vpn [on [cc]|off|list|connect <provider|cc>|status]', 'A fake VPN for the Browser and this shell. `vpn` prints the state; `vpn on` routes this PC through a provider’s exit, `vpn on SE` picks a country, `vpn list` shows the invented providers, `vpn connect gullvad` chooses one. With the VPN on, `ip a` grows a tun0 interface, a public-IP lookup answers with the VPN exit, and the Browser shows the provider and country in its toolbar. It composes with Tor: the VPN wraps the circuit, so the exit relay sees the VPN address rather than your own. Nothing is tunnelled — it is one object in this page.',
        [['vpn', 'is the tunnel up, and where does it come out'], ['vpn on', 'connect through the default provider'], ['vpn on CH', 'connect through a Swiss exit'], ['vpn list', 'every invented provider'], ['vpn off', 'back to this PC\u2019s own address']], ['tunnel']),
      own('virus', 'virus [status|list|scan <site|current>|clean]', 'Cyber Desktop anti-malware from moundshell: check if fake pop-ups are active, explain why no site is pre-labelled, inspect any website for a simulated trap payload, or clean active fake pop-ups off the desktop. Finding a trap is the user’s job: `virus scan`, nikto, whatweb and gobuster are the detector.',
        [['virus status', 'desktop infection status'], ['virus list', 'why there is no list of infected sites'], ['virus scan current', 'scan the open browser website'], ['virus clean', 'remove active fake pop-ups']], ['antivirus', 'av', 'malware']),
      own('pentest', 'pentest [on|off]', 'Switches the moundshell user between kali@pentest and moundshroud@moundshroud. The Pentest user only exists while the Cyber Desktop\u2019s VM is running: with the VM off the shell stays moundshroud@moundshroud, and turning the VM on does not change an open shell — restart it (\u27f2 Restart) and the new session signs in as kali@pentest. Plain `pentest` toggles.',
        [['pentest', 'switch to kali@pentest (or back)'], ['pentest off', 'always go back to moundshroud@moundshroud']]),
      own('leaked', 'leaked <host|web|virus|current>', 'Prints the user table every fake website leaks at /dump/users.csv: account id, e-mail, name, role, city, the IP the account signed in from, and the plain-text password the site stored. The same table is served at https://<host>/dump/users.csv, /dump/users.json and /dump/site.sql. Those IPs are machines: nmap finds them and ssh logs into them.',
        [['leaked bank', 'the user table of a random fake bank'], ['leaked current', 'the site open in the Browser']]),
      own('ssh', 'ssh [user@]<leaked ip> [password]', 'Opens a simulated session on the PC behind an IP from a leaked user table. It asks for the password that the site leaked; once in, the prompt becomes user@hostname and ls, cd, cat, head, tail, grep, find, wc, whoami, id, ps, env, ip a, ss, sudo -l all work on that PC\u2019s own files (documents, contracts, payroll, credentials, bank and medical notes). exit drops the session. Nothing is contacted: the machine is an object in this page.',
        [['nmap 10.14.200.20', 'find the machine behind a leaked IP'], ['ssh marcus.whitfield@10.14.200.20', 'log in with the leaked password'], ['exit', 'leave the remote PC']], ['remote']),
      own('breach', 'breach [n|slug|host|web [n]|virus [n]|current] | breach end', 'Starts a simulated security engagement against ANY website in the Cyber Desktop browser (generated sites, custom domains, MoundHub, Moundshroud Search) or any offline library, using the Pentest range: nmap, whatweb, gobuster, curl, sqlmap, a webshell and root. Everything is invented and lives inside the page.',
        [['breach', 'target your current site or library'], ['breach web 3', 'target a fake-internet site'], ['breach virus 1', 'target a site picked at random'], ['breach current', 'target the open browser site'], ['breach end', 'leave the range']], ['breach range']),
      own('solve', 'solve [FLAG{...}]', 'Submits a FLAG found on the fake internet and pays the Cyber Desktop practice bank once for it. Every generated website prints its flag on its staff dashboard, every bundled Browser library shows its flag in the library bar, and every Open Range PC prints its flag on its own staff page. `solve` on its own shows where the flags are and how many have been submitted.',
        [['solve FLAG{...}', 'bank a flag you found'], ['solve', 'where flags are, and your progress']], ['flag', 'flags', 'submit']),
      own('range', 'range [page]', 'Lists the Moundshroud Open Range — an endless index of invented PCs at https://range.moundshroud.lab in the Browser. Each PC has its own address, operating system, role, open ports and difficulty; `breach <ip>` or `breach <pc host>` starts the simulated engagement against it, and owning it pays the practice bank.',
        [['range', 'the first page of practice PCs'], ['range 4', 'a later page — the range never runs out'], ['breach 10.66.1.2', 'start an engagement on a range PC']]),
      own('paths', 'paths [host|url|web|virus|current]', 'Prints the checklist a tester runs on a website — robots.txt, the .env, /login, the hidden staff folder, the backup archive, the APIs and injection probes — as ready-to-type addresses for ANY Cyber Desktop browser website.',
        [['paths', 'the checklist every tester runs'], ['paths web', 'addresses for a random fake site'], ['paths virus', 'addresses for a random site'], ['paths current', 'addresses for the open browser website']], ['wordlist', 'pathlist']),
      own('targets', 'targets [query|virus|all]', 'Lists everything a breach or recon command can be pointed at: the currently open browser website, offline pages, MoundHub, Moundshroud Search, and every generated Cyber Desktop website with its simulated IP. No site is tagged as infected — scan it.',
        [['targets', 'what can be targeted right now'], ['targets virus', 'why there is no list of infected sites'], ['targets bank', 'filter websites by keyword']]),
      own('walkthrough', 'guide [list|next|<n>|intro|off]', 'An extremely detailed, step-by-step walkthrough of breaching one of your own offline pages in the breach range: scope and the rules of engagement, reconnaissance, path discovery, SQL injection, the staff session, IDOR, then the deeper floors\u2019 path traversal, leaked backup, SSRF and command injection, then upload to a webshell, the shell, privilege escalation, root and the report. Each step prints the exact command for the target in front of you, what you should see, why it works and how a defender fixes it. The range ticks each objective for real, so guide next cannot be skipped by reading ahead.',
        [['guide', 'turn it on and start at step 1'], ['guide next', 'move on once the range ticks the step'], ['guide list', 'the whole ladder and what is done']], ['walk', 'tutorial']),
      /* the app itself, Juice Shop and the Toolkit, all driven from this shell */
      own('app', 'app [tabs|open|theme|status|note|ask|search|settings|toast|play|stop]', 'Drives Moundshroud from the shell: switch tabs, change the theme, write a note, ask Chat, search the offline libraries, open Settings, show a message, open a game, stop what is running. Every action goes through the same objects the app’s own buttons use.',
        [['app', 'where the app is, and every tab'], ['app open cyber', 'switch to the Cyber tab'], ['app theme paper', 'change the theme']], ['moundshroud', 'shroud']),
      own('app open', 'app open <tab>', 'Switches Moundshroud to that tab: home, chat, web, lib, files, notes, study, lang, studio, sky, lab, timeline, tools, cyber, play, settings and the rest. The tab can be named by its id or its label; a prefix is enough.',
        [['app open lib', 'open the Library'], ['app open chat', 'open Chat']]),
      own('juice', 'juice [status|start|stop|open|guide [n]]', 'OWASP Juice Shop, the deliberately vulnerable shop that runs on this PC, driven from the shell: start it, stop it, open it in the Browser, and read the walkthrough for the site itself (hidden score board, SQL-injection login, reflected XSS, IDOR on baskets, path traversal, and what a JWT really trusts).',
        [['juice start', 'boot the shop'], ['juice pentest', 'attack it from here and read the report'], ['juice guide', 'the site’s own walkthrough'], ['juice open', 'show it in the Browser']], ['juiceshop']),
      own('tools', 'tools [<name> <args…>]', 'Lists every tool in Cyber › Toolkit and runs any of them with the same code: dns, whois, portscan, headers, hashcrack, mynetwork, connections and the rest. Only systems you own or have written permission to test.',
        [['tools', 'every tool and its arguments'], ['tools dns example.com', 'run one tool'], ['tools portscan localhost', 'the usual ports on your own PC']], ['tool', 'toolkit']),
      own('secrets', 'secrets [path]', 'Scans a folder or file inside Moundshroud for API keys, tokens and private keys — the families the awesome-secret-scanning tools look for, plus high-entropy strings — and masks every hit so nothing secret is printed in full.',
        [['secrets web/js', 'scan the app’s own scripts'], ['secrets', 'scan the whole project']], ['scan-secrets']),
      own('strings', 'strings <file> [min]', 'Prints the readable text inside any file on the app’s disk: version banners, paths, URLs and leftover build secrets in a binary, picture or archive.',
        [['strings web/moundshroud.ico', 'what is inside the icon']]),
      own('hashdir', 'hashdir [path]', 'Prints a SHA-256 checksum for every file in a folder — the manifest that proves nothing changed, the way sha256sum -c works.',
        [['hashdir web/js', 'a manifest of the app’s scripts']], ['checksums']),
      own('rg', 'rg <pattern> [dir]', 'Ripgrep, the fast search tool Moundshroud ships, over the app’s files. Same engine as the toolbar search in Edit the app.',
        [['rg terminal web/js', 'every line that mentions terminal']], ['ripgrep']),
      own('fd', 'fd [pattern] [dir]', 'fd, the fast file finder the app ships: names matching a pattern, a directory at a time.',
        [['fd cyber web/js', 'files with cyber in the name']]),
      own('jq', 'jq <filter> <file>', 'jq, the JSON processor the app ships, on any JSON file in this shell. It prints the result and changes nothing.',
        [['jq .name web/phone-manifest.json', 'one field from a manifest']]),
      own('sd', 'sd <find> <replace> <file>', 'sd, the search-and-replace tool the app ships. It shows what the file would become and writes nothing — redirect it yourself if you want the text saved.',
        [['sd colour color web/js/themes.js', 'preview a rename']])
    ];
  }

  function manualShell() {
    const TP = window.TerminalPlayground;
    const base = TP && Array.isArray(TP.shells) ? TP.shells.find(s => s.id === 'bash') : null;
    const overrides = {
      /* the help window says which shell it belongs to: this one is the moundshell, not a sandbox */
      modeName: 'moundshell',
      /* the help window's dropdown needs a name for this shell that is not the sandbox bash it is built from */
      helpId: 'moundshell',
      extraCommands: moundshellCommands(),
      playNote: 'Runs on a copy of the app files: reading, listing, writing and deleting all work here, and nothing typed can change the app or any real file on this computer.',
      playHint: 'Type any command below and press Run. This playground works on a copy of the app, so try a delete or a redirect freely — nothing here can change the app or any real file.',
      prompt: () => helpPrompt(),
      run: text => runHelp(text)
    };
    if (base) return Object.assign({}, base, overrides);
    return Object.assign({ id: 'bash', name: 'Bash / Linux', group: 'Unix', icon: '🐧', range: false, about: 'bash against this app only' }, overrides);
  }
  /* Every help window lists the shells it can read: this app's own moundshell first, then the sandbox shells the
     playground lends. The window always opens on the shell it was opened from; the list only changes what you read. */
  function manualChoices() {
    const TP = window.TerminalPlayground;
    const shells = TP && Array.isArray(TP.shells) ? TP.shells : [];
    return [{ key: 'moundshell', name: 'moundshell · this app', group: 'This app' }].concat(shells.map(shell => ({
      key: shell.id, name: shell.name, group: shell.range ? 'Security ranges' : shell.group || 'Sandbox shells'
    })));
  }
  /* The help window's search can look through this shell and every sandbox shell at once. The moundshell's shell
     object is made once and kept, so searching never rebuilds the help playground underneath. */
  let helpShellObject = null;
  function manualAllShells() {
    const TP = window.TerminalPlayground;
    const shells = TP && Array.isArray(TP.shells) ? TP.shells : [];
    if (!helpShellObject) { try { helpShellObject = manualShell(); } catch (e) { helpShellObject = null; } }
    return [{ key: 'moundshell', name: 'moundshell · this app', shell: helpShellObject }]
      .concat(shells.map(shell => ({ key: shell.id, name: shell.name, shell })))
      .filter(item => !!item.shell);
  }
  function manualFor(shellKey) {
    const TP = window.TerminalPlayground;
    const shells = TP && Array.isArray(TP.shells) ? TP.shells : [];
    /* moundshell shares bash's id, because that is the shell it is: only an explicit sandbox id lends the other one */
    if (!shellKey || shellKey === 'moundshell') { buildManualRoom(); return manualShell(); }
    return shells.find(shell => shell.id === shellKey) || manualShell();
  }
  function openManual(topic, shellKey) {
    if (!manual) {
      const TP = window.TerminalPlayground;
      if (!TP || !TP.manual || !TP.manual.create) { if (A.toast) A.toast('The help engine is still loading. Try again in a moment.'); return; }
      manual = TP.manual.create(wrap, {
        focusTerminal: () => { if (inp) inp.focus(); },
        useExample: command => { if (inp) { inp.value = command; inp.focus(); } },
        shellChoices: manualChoices,
        allShells: manualAllShells,
        pickShell: (key, topic) => openManual(topic || '', key)
      });
    }
    if (!manual) return;
    manual.open(manualFor(shellKey || 'moundshell'), 'sandbox', [], topic || '', null);
  }

  /* A full screen view owns the whole screen. When the window itself is in fullscreen, anything outside that
     element is not drawn at all, so every kind of full screen is left before the shell appears. */
  function leaveFullscreen() {
    try { if (typeof A !== 'undefined' && A.pageFS && A.pageFS.on && A.pageFS.on()) A.pageFS.set(false); } catch (e) { }
    try { if (typeof A !== 'undefined' && A.termFS && A.termFS.active()) A.termFS.exit(); } catch (e) { }
    try { if (document.fullscreenElement) document.exitFullscreen().catch(() => { }); } catch (e) { }
  }

  async function open() {
    if (wrap) { if (minimized) restore(); else inp && inp.focus(); return; }
    try { userColor = localStorage.getItem(COLOR_KEY) || '#7fd1ff'; } catch (e) { userColor = '#7fd1ff'; }
    /* leave full screen first, so the shell is always the thing on screen */
    leaveFullscreen();
    const helpDialog = document.querySelector('dialog.tpg-manual[open]');
    if (helpDialog) { try { helpDialog.close(); } catch (e) { } }
    if (!window.TerminalPuzzles || !window.TerminalPuzzles.buildCustomFileRoom) {
      if (typeof A !== 'undefined' && A.toast) A.toast('The terminal engine is still loading. Try again in a moment.', 4000);
      return;
    }
    wrap = document.createElement('div');
    wrap.id = 'aeshellwrap';
    /* above a fullscreen terminal (z-index 9600) and every other overlay, so Ctrl+T always shows the shell. The wrap
       is only the coordinate space for the window: the app behind it stays clickable around the panel. */
    wrap.style.cssText = 'position:fixed;inset:0;z-index:12000;pointer-events:none';
    wrap.innerHTML =
      '<div id="aeshellpanel" aria-label="moundshell">' +
      '<div id="aeshellbar">' +
      '<b class="small" style="' + MONO + '">🐚 moundshell · <span id="aeshellwho">moundshroud@moundshroud</span></b>' +
      '<span style="flex:1"></span>' +
      '<button class="ib aeshell-winbtn" type="button" data-aeshell="min" title="Minimize — Ctrl+T brings the shell straight back" aria-label="Minimize">−</button>' +
      '<button class="ib aeshell-winbtn" type="button" data-aeshell="max" aria-pressed="false" title="Maximize" aria-label="Maximize">□</button>' +
      '<button class="ib aeshell-winbtn" type="button" data-aeshell="close" title="Close the shell (Esc)" aria-label="Close">×</button>' +
      '</div>' +
      '<div class="row aeshell-tools" style="gap:6px;align-items:center;flex-wrap:wrap">' +
      '<span class="small mute" style="flex:1;min-width:180px">bash, with this app as the only disk · your repositories live at <b>https://moundhub.com</b> — open the Browser and type that address, or run git here</span>' +
      '<label class="small mute" style="display:inline-flex;align-items:center;gap:3px" title="Colour of your own typing and the prompt in this shell"><input type="color" id="aeshellusercol" aria-label="Colour for your own commands in this shell" style="width:26px;height:22px;padding:0;border:1px solid var(--line);border-radius:5px;background:transparent;cursor:pointer"></label>' +
      '<button class="ib" id="aeshellhelp" title="Open the help window: every command, in the simplest words, with a playground inside it">❓ Help</button>' +
      '<button class="ib" id="aeshellclear" title="Clear what is on screen only: mcode, an open breach range and everything you were doing stay exactly as they are">Clear</button>' +
      '<button class="ib" id="aeshellrestart" title="Restart moundshell: end this session, reload the app files and start a fresh shell (with the Cyber VM running this signs you in as kali@pentest)">⟲ Restart</button>' +
      '<button class="ib" id="aeshellreset" title="Throw away every change you made in this browser and start from the app\'s files again">Discard my changes</button>' +
      '<button class="ib" id="aeshellreload" title="Reload the app files (your local changes stay)">Reload files</button></div>' +
      '<pre class="term-fs-out" id="aeshellout" style="margin:0;flex:1;min-height:120px;overflow:auto;padding:8px 12px;border-top:1px solid rgba(255,255,255,.06);' + MONO + ';font-size:12.5px;line-height:1.55;white-space:pre-wrap;word-break:break-word;user-select:text;-webkit-user-select:text;cursor:text"></pre>' +
      '<div class="row term-fs-prompt-row" style="gap:6px;align-items:center;padding:8px 12px 0;border-top:1px solid rgba(255,255,255,.06)">' +
      '<span id="aeshellprompt" style="' + MONO + ';font-size:12.5px;color:#6ee7a0;white-space:nowrap"></span>' +
      '<input id="aeshellcmd" autocomplete="off" autocapitalize="off" spellcheck="false" aria-label="moundshell command" ' +
      'placeholder="bash: ls, cat, grep … · mcode harness: /chat, /code, /swarm, /model, help · ↑ history · / then Enter lists every mcode command · Ctrl+L clears · Ctrl+T opens or hides · Esc closes" style="flex:1;min-width:0"></div>' +
      '<div class="small mute" style="' + MONO + ';padding:6px 12px 10px">Your changes stay in this browser and never touch the app\'s files. Network commands can describe this computer, but nothing here can scan, connect to or attack anything.</div>' +
      '<button class="aeshell-resize" id="aeshellresize" type="button" aria-label="Resize the shell window" title="Drag to resize"></button>' +
      '</div>' +
      '<div data-terminal-manual></div>';
    document.body.appendChild(wrap);
    panel = wrap.querySelector('#aeshellpanel');
    out = wrap.querySelector('#aeshellout');
    inp = wrap.querySelector('#aeshellcmd');
    promptEl = wrap.querySelector('#aeshellprompt');
    placeShell();
    bindDrag(wrap.querySelector('#aeshellbar'));
    bindResize(wrap.querySelector('#aeshellresize'));
    panel.querySelector('[data-aeshell="min"]').onclick = minimize;
    panel.querySelector('[data-aeshell="max"]').onclick = toggleMax;
    panel.querySelector('[data-aeshell="close"]').onclick = close;
    wrap.querySelector('#aeshellclear').onclick = resetScreen;
    wrap.querySelector('#aeshellrestart').onclick = restartShell;
    wrap.querySelector('#aeshellreset').onclick = () => { clearOverlay(); overlay = { files: {}, removed: [], written: [], deleted: [] }; close(); open(); };
    wrap.querySelector('#aeshellreload').onclick = () => { close(); open(); };
    wrap.querySelector('#aeshellhelp').onclick = () => openManual('');
    const colorInput = wrap.querySelector('#aeshellusercol');
    if (colorInput) {
      colorInput.value = userColor;
      colorInput.oninput = () => {
        userColor = colorInput.value || '#7fd1ff';
        try { localStorage.setItem(COLOR_KEY, userColor); } catch (e) { }
        if (promptEl) promptEl.style.color = userColor;
        paint();
      };
    }
    inp.onkeydown = e => {
      /* while mcode has a list open (/help, /model, /theme, /autonomy, the swarm roles), the arrows and Enter belong
         to that list, not to history or a command */
      if (mcode && mcode.picking && mcode.picking() &&
        (/^Arrow|^Escape$/.test(e.key) || /^(?:Enter|Delete|Backspace)$/.test(e.key) && !inp.value) && mcode.key(e.key)) {
        e.preventDefault();
        return;
      }
      if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); const v = inp.value; inp.value = ''; exec(v); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); history(-1); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); history(1); }
      else if (e.key === 'l' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); resetScreen(); }
      else if (String(e.key).toLowerCase() === 'c' && e.ctrlKey && !e.altKey && !e.metaKey && mcode && mcode.interrupt) {
        if (mcode.interrupt()) { e.preventDefault(); paint(); if (promptEl) promptEl.textContent = promptText(); }
      }
    };
    /* clicking the output focuses the prompt only when nothing is selected: copying text out of the shell used to
       lose the selection the moment the mouse button came up */
    out.addEventListener('mouseup', () => {
      const sel = window.getSelection ? String(window.getSelection()) : '';
      if (!sel.trim() && inp) inp.focus();
    });
    /* The Pentest user exists only while the Cyber VM runs: if the VM is stopped or the desktop is shut down, the
       prompt follows the VM at once instead of pretending to still be kali@pentest. */
    if (userTimer) clearInterval(userTimer);
    userTimer = setInterval(() => {
      if (!promptEl) return;
      /* the VM went away: the Pentest sign-in goes with it, so starting the VM again cannot bring kali back unasked */
      if (pentestUser && !vmRunning()) pentestUser = false;
      const want = promptText();
      if (promptEl.textContent !== want) promptEl.textContent = want;
      const who = panel && panel.querySelector('#aeshellwho');
      if (who) who.textContent = shellIdentity();
    }, 1200);
    document.addEventListener('keydown', onDocKey, true);
    window.addEventListener('resize', clampGeometry);
    mcode = buildMcode();
    staged.clear();
    /* what was on screen last time comes back exactly as it was left; a shell opened for the first time starts with
       the starting text */
    const restoring = !!(savedLines && savedLines.length);
    /* Turning the VM on never signs this shell in by itself, and neither does simply opening it again: the Pentest
       user is entered from the ⟲ Restart button (with the VM running) or with `pentest`. */
    lines = restoring ? savedLines.slice() : startingLines();
    savedLines = null;
    screenCleared = !restoring;
    promptEl.textContent = shellIdentity() + ':~/app$ ';
    promptEl.style.color = userColor;
    paint();
    inp.focus();

    const banner = lines.slice();
    say('Reading the app…'); paint();
    let data = null;
    try { const r = await fetch(API + 'shell?meta=1', { cache: 'no-store' }); data = await r.json(); } catch (e) { data = null; }
    lines = banner.slice();
    if (!data || data.error || !Array.isArray(data.files)) {
      say('Could not read the app files' + (data && data.error ? ': ' + data.error : '.') + ' — the shell needs the app server.');
      say('');
      paint();
      return;
    }
    overlay = readOverlay();
    const files = {};
    pending.clear();
    appDirs.clear();
    let binary = 0;
    for (const entry of data.files) {
      const parts = String(entry.rel).split('/');
      for (let i = 1; i < parts.length; i++) appDirs.add(parts.slice(0, i).join('/'));
      const key = PREFIX + entry.rel;
      if (entry.text === false) { files[key] = '[binary file · ' + fmtBytes(entry.size || 0) + ']'; binary++; continue; }
      files[key] = '';                                  /* listed now, filled in as soon as its batch arrives */
      pending.set(entry.rel, { size: entry.size || 0, text: true });
    }
    applyOverlay(files);
    try {
      room = window.TerminalPuzzles.buildCustomFileRoom({ shell: 'bash', files, title: 'Moundshroud app', brief: '', difficulty: 'insane', machine: machineInfo() });
      /* start inside the app folder; restore() must not be handed the room's own tree, it empties it first */
      room.run('cd app');
      if (!String(room.cwdPath()).startsWith('/app')) room.run('cd /app');
      /* history is this session's own history, not a made-up list */
      if (room.cmds) room.cmds.history = () => hist.map((cmd, i) => String(i + 1).padStart(5) + '  ' + cmd).join('\n');
      /* map every network, web, recon and offensive shell command to every website in the Cyber Desktop browser */
      wireBrowserCommands(room);
    } catch (e) {
      say('The shell engine failed to start: ' + String(e && e.message || e)); say(''); paint(); return;
    }
    snapshot = flat(room.snapshot().tree);
    known = new Map(data.files.filter(f => f.text !== false).map(f => [f.rel, f.at]));
    sig = await currentSig();
    if (timer) clearInterval(timer);
    timer = setInterval(syncFromDisk, SYNC_MS);
    document.addEventListener('focus', syncFromDisk);
    /* the count of app files is said once, when the shell starts: a window opened again on a kept transcript would
       otherwise repeat it on every open */
    if (!restoring) {
      const n = data.files.length;
      say(n + ' paths from the app on disk — the page, the server, the tests, the desktop shell and web/vendor' +
        (binary ? ' (' + binary + ' picture, font or model shown as a marker)' : '') + '.');
      say('Contents load in the background; a file you ask for is fetched first, so nothing is ever left out for its size.');
      say('Paths outside app/ do not exist here — nothing outside this app can be read or written.');
      say('');
    }
    paint();
    if (promptEl) promptEl.textContent = promptText();
    preloadAll();                                        /* the rest arrives without holding up a single keystroke */
  }

  /* a minimized shell is not on screen, so isOpen() is false for it: Ctrl+T and the Terminal button bring it back
     instead of closing a window nobody can see */
  window.AppShell = { open, close, isOpen: () => !!wrap && !minimized, mcode: () => mcode,
    exec: cmd => exec(cmd),
    /* read by the Cyber VM app: who moundshell is signed in as, and whether that is the Pentest user */
    user: () => ({ open: !!wrap && !minimized, user: shellIdentity(), pentest: pentestActive(), vm: vmRunning() }) };

  /* Ctrl+T inside a frame: a key event does not cross a frame boundary, so the shortcut is installed in every
     same-origin frame the app shows (apps, previews, games, MoundHub). Library pages live on their own address and
     forward keys through web/lib-bridge.js instead. */
  function shellKeysIn(frame) {
    if (!frame || frame._aeshellKeys) return;
    let doc = null;
    try { doc = frame.contentDocument; } catch (e) { return; }
    if (!doc) return;
    frame._aeshellKeys = true;
    doc.addEventListener('keydown', e => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey) return;
      if (String(e.key).toLowerCase() !== 't' && e.code !== 'KeyT') return;
      e.preventDefault(); e.stopPropagation();
      if (wrap && !minimized) close(); else open();
    }, true);
  }
  let frameScan = 0;
  function watchFrames() {
    if (frameScan) return;
    frameScan = setTimeout(() => {
      frameScan = 0;
      document.querySelectorAll('iframe').forEach(fr => {
        shellKeysIn(fr);
        if (fr._aeshellLoad) return;
        fr._aeshellLoad = true;
        /* a frame can load a new document later: its listeners went with the old one */
        fr.addEventListener('load', () => { fr._aeshellKeys = false; shellKeysIn(fr); });
      });
    }, 250);
  }
  try { new MutationObserver(watchFrames).observe(document.body, { childList: true, subtree: true }); } catch (e) { }
  watchFrames();

  /* the header button next to the gear, and the Settings entry, both open this shell (one delegated handler, so a
     click can never fire open() and close() at the same time) */
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => { }); else { }
  document.addEventListener('click', e => {
    const t = e.target && e.target.closest ? e.target.closest('#appsh, #set-appshell') : null;
    if (t) { e.preventDefault(); open(); }
  });

  /* A small handle for the rest of the app: the church guard puts Moundshroud back to the state it opens in, which
     means ending the shell session and taking the window away, not merely hiding it. */
  try {
    A.moundshell = {
      open,
      close,
      restart: restartShell,
      isOpen: () => !!wrap,
      reset() { resetSession(); close(); }
    };
  } catch (e) { /* no app object: the shell still works on its own */ }

  /* Ctrl+T / ⌘T opens the moundshell from anywhere: a terminal, an input, focus mode or a fullscreen terminal — and
     closes it again when it is already open, so the same key puts the shell away. It used to stand aside whenever an
     input had focus, which is exactly where you are while typing commands; that guard is gone. Browsers reserve
     Ctrl+T for a new tab, so the desktop window is the place this shortcut lives. */
  document.addEventListener('keydown', e => {
    if (!(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey) return;
    const t = String(e.key).toLowerCase() === 't' || e.code === 'KeyT';
    if (!t) return;
    e.preventDefault();
    e.stopPropagation();
    if (wrap && !minimized) close(); else open();
  }, true);
})();

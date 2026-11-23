/* MoundHub — the repository website at https://moundhub.com, opened by the Browser tab and by the Browser in the
   cyber desktop. It is a page of its own (so it looks and behaves like a real site), served from the app's own
   address so it shares the browser's repository store with moundshell's git commands. */
(function () {
  const root = document.getElementById('mh');
  const toastEl = document.getElementById('mh-toast');
  const S = window.RepoStore;
  if (!root || !S) return;

  /* the app around the page, when it is shown inside the Browser: toasts, dialogs, the local model */
  const App = (() => { try { return window.parent !== window ? window.parent.A : null; } catch (e) { return null; } })();

  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const st = { repo: S.currentId(), view: 'code', file: '', commit: '', q: '', ai: [], aiOpen: false, aiModel: '', busy: false, jump: false };
  const repo = () => S.get(st.repo) || null;
  function ensureRepo() {
    if (repo()) return repo();
    const first = S.list()[0];
    st.repo = first ? first.id : '';
    if (st.repo !== S.currentId()) S.setCurrent(st.repo);
    return first || null;
  }

  function toast(text, ms) {
    if (!toastEl) return;
    toastEl.textContent = String(text == null ? '' : text);
    toastEl.classList.add('on');
    clearTimeout(toast.t);
    toast.t = setTimeout(() => toastEl.classList.remove('on'), ms || 3600);
  }
  const copy = text => {
    if (App && App.copy) { try { return App.copy(text); } catch (e) { } }
    try { navigator.clipboard.writeText(String(text)); toast('Copied.'); } catch (e) { }
  };
  /* A question of its own, in the page's own dress. The app's dialog is used when the page can reach it; otherwise this
     one, because a native window.confirm inside the Browser's frame freezes the whole window until it is answered. */
  function ask(message, okLabel) {
    if (App && App.confirm) { try { return Promise.resolve(App.confirm(message)).then(v => !!v, () => false); } catch (e) { } }
    return new Promise(resolve => {
      let done = false;
      const d = dialog('<h3>Please confirm</h3>' +
        '<div class="mh-small mh-mute" style="line-height:1.65;margin-top:6px">' + esc(message) + '</div>' +
        '<div class="mh-row" style="margin-top:14px">' +
        '<button class="mh-btn mh-danger" data-yes>' + esc(okLabel || 'Continue') + '</button>' +
        '<button class="mh-btn" data-x>Cancel</button></div>');
      const finish = v => {
        if (done) return; done = true;
        try { d.close(); } catch (e) { }
        if (d.parentNode) d.remove();
        resolve(v);
      };
      d.querySelector('[data-yes]').onclick = () => finish(true);
      d.querySelector('[data-x]').onclick = () => finish(false);
      d.addEventListener('close', () => finish(false));
    });
  }
  function download(text, name) {
    const blob = new Blob([text], { type: 'application/json' }), a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }

  const fmtBytes = n => !n ? '0 B' : n < 1024 ? n + ' B' : n < 1048576 ? Math.round(n / 1024) + ' KB' : (n / 1048576).toFixed(n < 10485760 ? 1 : 0) + ' MB';
  function ago(at) {
    if (!at) return '';
    const d = Date.now() - at;
    if (d < 45000) return 'just now';
    if (d < 3600000) return Math.round(d / 60000) + ' min ago';
    if (d < 86400000) return Math.round(d / 3600000) + ' h ago';
    if (d < 2592000000) return Math.round(d / 86400000) + ' d ago';
    return new Date(at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
  }
  const ICONS = [['.md', '📘'], ['.js', '🟨'], ['.mjs', '🟨'], ['.css', '🎨'], ['.html', '🌐'], ['.json', '🧾'], ['.py', '🐍'], ['.ps1', '🪟'], ['.bat', '🪟'], ['.cs', '🟦'], ['.png', '🖼️'], ['.jpg', '🖼️'], ['.svg', '🖼️'], ['.txt', '📄']];
  const icon = name => (ICONS.find(([ext]) => String(name).toLowerCase().endsWith(ext)) || [])[1] || '📄';

  /* ---------- a small Markdown reader ---------- */
  function mdHTML(text) {
    const src = String(text == null ? '' : text).replace(/\r/g, '');
    const out = [], fences = [];
    let list = '';
    const inline = s => esc(s)
      .replace(/`([^`]+)`/g, (m, c) => '<code>' + c + '</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
      .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<i>$2</i>')
      .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, t, u) => /^https?:\/\//i.test(u) ? '<a href="' + u + '" target="_blank" rel="noopener">' + t + '</a>' : '<a>' + t + '</a>');
    const closeList = () => { if (list) { out.push('</' + list + '>'); list = ''; } };
    const lines = src.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (/^```/.test(line)) {
        closeList();
        const body = [];
        i++;
        while (i < lines.length && !/^```/.test(lines[i])) body.push(lines[i++]);
        out.push('<pre><code>' + esc(body.join('\n')) + '</code></pre>');
        continue;
      }
      if (!line.trim()) { closeList(); continue; }
      let m;
      if ((m = /^(#{1,4})\s+(.*)$/.exec(line))) { closeList(); out.push('<h' + m[1].length + '>' + inline(m[2]) + '</h' + m[1].length + '>'); continue; }
      if (/^\s*(---+|\*\*\*+)\s*$/.test(line)) { closeList(); out.push('<hr>'); continue; }
      if ((m = /^\s*[-*+]\s+(.*)$/.exec(line))) { if (list !== 'ul') { closeList(); list = 'ul'; out.push('<ul>'); } out.push('<li>' + inline(m[1]) + '</li>'); continue; }
      if ((m = /^\s*\d+[.)]\s+(.*)$/.exec(line))) { if (list !== 'ol') { closeList(); list = 'ol'; out.push('<ol>'); } out.push('<li>' + inline(m[1]) + '</li>'); continue; }
      if ((m = /^\s*>\s?(.*)$/.exec(line))) { closeList(); out.push('<blockquote>' + inline(m[1]) + '</blockquote>'); continue; }
      closeList();
      out.push('<p>' + inline(line) + '</p>');
    }
    closeList();
    return out.join('');
  }

  /* ---------- login ---------- */
  function login(message) {
    root.innerHTML =
      topbar(true) +
      '<div class="mh-login"><div class="mh-login-card">' +
      '<div class="mh-logo">🔖</div>' +
      '<h1>Your code, kept close.</h1>' +
      '<div class="mh-url">https://moundhub.com</div>' +
      '<p>Every repository you commit from moundshell or from this site lives here on this PC, private and offline, until you push it somewhere else.</p>' +
      '<label for="mhpw">Password</label>' +
      '<input id="mhpw" type="password" autocomplete="current-password" placeholder="Password" aria-label="MoundHub password">' +
      '<div class="mh-hint">The default password is <b>Moundshroud</b>. Change it any time in <b>Settings → Password</b>.</div>' +
      '<button class="mh-btn mh-pri mh-go" id="mhgo">Unlock MoundHub</button>' +
      '<div class="mh-err" id="mherr">' + esc(message || '') + '</div>' +
      '</div></div>';
    const pw = root.querySelector('#mhpw'), err = root.querySelector('#mherr');
    const go = () => {
      if (S.unlock(pw.value)) { st.repo = S.currentId(); paint(); }
      else { err.textContent = 'That password is not right.'; pw.select(); }
    };
    root.querySelector('#mhgo').onclick = go;
    pw.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); go(); } };
    setTimeout(() => pw.focus(), 50);
  }

  /* ---------- chrome ---------- */
  function topbar(locked) {
    return '<header class="mh-top">' +
      '<div class="mh-brand"><div class="mh-logo">🔖</div><div class="mh-brandname"><b>MoundHub</b><span>https://moundhub.com</span></div></div>' +
      (locked ? '' : '<div class="mh-search"><input id="mhq" type="text" placeholder="Search your repositories" autocomplete="off" spellcheck="false" value="' + esc(st.q) + '" aria-label="Search your repositories"></div>') +
      '<div class="mh-ava" title="moundshroud@this-pc">M</div>' +
      '</header>';
  }

  function sidebar() {
    const repos = S.list();
    const rows = repos.filter(x => !st.q || (x.name + ' ' + x.desc).toLowerCase().includes(st.q.toLowerCase()));
    return '<aside class="mh-side">' +
      '<div class="mh-sidelabel">Repositories <span class="mh-sp"></span>' + repos.length + '</div>' +
      '<button class="mh-btn mh-pri mh-newbtn" id="mhnew">＋ New repository</button>' +
      '<div class="mh-list">' + (rows.length ? rows.map(x => {
        const h = S.head(x), c = h ? S.byId(x, h) : null;
        return '<div class="mh-itemrow">' +
          '<button class="mh-item' + (x.id === st.repo ? ' on' : '') + '" data-repo="' + esc(x.id) + '">' +
          '<span class="mh-iname">' + esc(x.name) + (x.desc ? '' : '') + '</span>' +
          '<span class="mh-imeta">' + (x.commits.length ? x.commits.length + ' commit' + (x.commits.length === 1 ? '' : 's') : 'empty') + ' · ' + esc(ago(x.updatedAt)) + '</span>' +
          (c ? '<span class="mh-ilast">' + esc(c.msg) + '</span>' : '') + '</button>' +
          '<button class="mh-itemdel" data-delrepo="' + esc(x.id) + '" title="Delete ' + esc(x.name) + '" aria-label="Delete ' + esc(x.name) + '">🗑</button>' +
          '</div>';
      }).join('') : '<div class="mh-empty-note">' + (repos.length ? 'Nothing matches that search.' : 'No repositories yet. Make one here, or run <code>git init</code> in the moundshell.') + '</div>') + '</div>' +
      '<div class="mh-sidefoot">' +
      '<button class="mh-btn mh-quiet" data-view="settings" title="Password, bundles and how this works">⚙ Settings</button>' +
      '<button class="mh-btn mh-quiet" id="mhhowto" title="How to commit from the moundshell">🐚 How to</button>' +
      '<button class="mh-btn mh-quiet" id="mhlock" title="Lock MoundHub until the password is entered again">🔒 Lock</button>' +
      '</div></aside>';
  }

  function paint() {
    if (!S.unlocked()) return login();
    ensureRepo();
    const r = repo();
    const withAI = !!(r && st.aiOpen);
    root.innerHTML = topbar(false) +
      '<div class="mh-shell' + (withAI ? ' mh-withai' : '') + '">' +
      sidebar() +
      '<main class="mh-main"><div class="mh-main-in">' + mainView(r) + '</div></main>' +
      (withAI ? aiPanel() : '') +
      '</div>';
    bind(r);
    drawAi();
    /* a page change is shown where it starts: the header above it can be taller than the window, and a Settings press
       that changed nothing on screen looked like a dead button */
    if (st.jump) {
      st.jump = false;
      const main = root.querySelector('.mh-main');
      const body = root.querySelector('.mh-tabs') || root.querySelector('.mh-tabbody') || root.querySelector('.mh-settings');
      if (main && body) main.scrollTop += body.getBoundingClientRect().top - main.getBoundingClientRect().top;
    }
  }

  function mainView(r) {
    if (!r) return st.view === 'settings' ? globalSettings() : hero();
    /* Settings is a page of its own: the repository header (name, description, Push, Export, Assistant) is left out so
       the settings themselves are on screen the moment they are asked for, even in a short window. */
    const body = st.view === 'commits' ? commitsView(r) : st.view === 'settings' ? settingsView(r) : codeView(r);
    return '<div class="mh-crumb">moundhub.com <span class="sep">/</span> moundshroud <span class="sep">/</span> <b>' + esc(r.slug || r.name) + '</b></div>' +
      (st.view === 'settings' ? '' : repoHead(r)) + tabs(r) + '<div class="mh-tabbody">' + body + '</div>';
  }

  function hero() {
    const empty = !S.list().length;
    return '<div class="mh-hero">' +
      '<h1>' + (empty ? 'Your first repository starts ' : 'Your repositories, ') + '<b>' + (empty ? 'here' : 'kept close') + '</b>.</h1>' +
      '<div class="mh-lede">MoundHub is the home for commits made in moundshell. Everything is stored in this browser on this PC — nothing is uploaded until you give a repository a remote and push, or export it as a bundle.</div>' +
      '<div class="mh-steps">' +
      '<div class="mh-step"><div class="n">1</div><b>Make a repository</b><p>Press <b>New repository</b> above, or in the moundshell run <code>git init my-project</code>.</p></div>' +
      '<div class="mh-step"><div class="n">2</div><b>Commit from the shell</b><p>In the moundshell: <code>git add -A</code>, then <code>git commit -m "first commit"</code>.</p></div>' +
      '<div class="mh-step"><div class="n">3</div><b>See it here</b><p>Type <code>moundhub.com</code> in the Browser at any time. This page is that address.</p></div>' +
      '</div>' +
      '<div class="mh-blank"><div class="mh-badge-big">🗂️</div><b>' + (empty ? 'No repositories yet' : 'Pick a repository') + '</b>' +
      '<div class="mh-mute mh-small" style="margin:6px auto 0;max-width:52ch;line-height:1.7">' + (empty ? 'Nothing to show until something is committed. Make one now, or open the moundshell with Ctrl+T.' : 'Choose one from the sidebar to see its code and history.') + '</div>' +
      '<div class="mh-row" style="justify-content:center;margin-top:14px"><button class="mh-btn mh-pri" id="mhnew2">＋ New repository</button><button class="mh-btn" id="mhhowto2">🐚 How to use moundshell git</button></div></div>' +
      '</div>';
  }

  function repoHead(r) {
    const head = S.head(r), c = head ? S.byId(r, head) : null;
    return '<div class="mh-repohead"><div style="min-width:200px;flex:1">' +
      '<h1>' + esc(r.name) + ' <span class="mh-pill">Private</span></h1>' +
      '<div class="mh-desc">' + (r.desc ? esc(r.desc) : 'No description yet — add one in Settings.') + '</div></div>' +
      '<div class="mh-actions">' +
      '<button class="mh-btn" data-push="1" title="Record the newest commit as pushed to origin, or keep it in the local store">⤴ Push</button>' +
      '<button class="mh-btn" data-export="1" title="Download this repository as a bundle you can import on another PC">⤓ Export</button>' +
      '<button class="mh-btn" id="mhhowto3" title="The git commands and how mounts help">🐚 From moundshell</button>' +
      '<button class="mh-btn' + (st.aiOpen ? ' mh-pri' : '') + '" data-ai="' + (st.aiOpen ? '0' : '1') + '" title="The repository assistant, running on the model on this PC">🤖 Assistant</button>' +
      '</div></div>' +
      (c
        ? '<div class="mh-last"><span class="mh-ava">M</span><b>' + esc(c.author) + '</b><span class="mh-mute">' + esc(c.msg) + '</span><span class="mh-sp"></span><span class="mh-hash">' + esc(c.short) + '</span><span class="mh-small mh-mute">' + esc(ago(c.at)) + '</span></div>'
        : '<div class="mh-last mh-mute mh-small">No commits yet — commit something in the moundshell and it appears here.</div>');
  }

  function tabs(r) {
    return '<div class="mh-tabs">' + [['code', '📁 Code'], ['commits', '🕘 Commits'], ['settings', '⚙ Settings']]
      .map(([k, label]) => '<button class="mh-tab' + (st.view === k ? ' on' : '') + '" data-view="' + k + '">' + label + '</button>').join('') + '</div>';
  }

  /* ---------- Code ---------- */
  function codeView(r) {
    const files = S.treeOf(r), names = Object.keys(files).sort();
    if (!names.length) {
      return '<div class="mh-blank"><b>This repository has no commits yet</b>' +
        '<div class="mh-mute mh-small" style="max-width:56ch;line-height:1.7;margin:8px auto 0">In the moundshell, create or change a file, then run<br><code>git add -A</code> and <code>git commit -m "first commit"</code>, then <code>git push</code>.</div></div>';
    }
    const shown = st.file && st.file in files ? st.file : (names.find(n => /^readme(\.md)?$/i.test(n)) || '');
    st.file = shown;
    const content = shown ? files[shown] : '';
    return '<div class="mh-code"><div class="mh-tree">' +
      '<div class="mh-treehead"><span class="mh-branch">⑂ ' + esc(r.branch || 'main') + '</span><span class="mh-sp"></span><span>' + names.length + ' file' + (names.length === 1 ? '' : 's') + '</span></div>' +
      '<div class="mh-treebody">' + treeHTML(names) + '</div></div>' +
      '<div class="mh-file">' + (shown
        ? '<div class="mh-filehead"><b>' + esc(shown) + '</b><span class="mh-sp"></span><span>' + fmtBytes(String(content).length) + '</span><button class="mh-btn mh-quiet" data-copy="' + esc(shown) + '">Copy</button></div>' +
          (/\.[mc]?md$/i.test(shown) ? '<div class="mh-md">' + mdHTML(content) + '</div>' : '<pre class="mh-pre">' + esc(content) + '</pre>')
        : '<div class="mh-blank" style="border:0"><div class="mh-mute mh-small">Pick a file on the left.</div></div>') +
      '</div></div>';
  }
  function treeHTML(names) {
    const base = { files: {}, dirs: {} };
    for (const rel of names) {
      const parts = rel.split('/');
      let node = base;
      for (let i = 0; i < parts.length; i++) {
        if (i === parts.length - 1) node.files[parts[i]] = rel;
        else { node.dirs[parts[i]] = node.dirs[parts[i]] || { files: {}, dirs: {} }; node = node.dirs[parts[i]]; }
      }
    }
    const walk = (node, depth) => Object.keys(node.dirs).sort().map(d =>
      '<details class="mh-rdir"' + (depth < 1 ? ' open' : '') + '><summary>📁 ' + esc(d) + '</summary>' + walk(node.dirs[d], depth + 1) + '</details>').join('') +
      Object.keys(node.files).sort().map(f =>
        '<button class="mh-filebtn' + (st.file === node.files[f] ? ' on' : '') + '" data-file="' + esc(node.files[f]) + '">' + icon(f) + ' ' + esc(f) + '</button>').join('');
    return walk(base, 0);
  }

  /* ---------- Commits ---------- */
  function commitsView(r) {
    if (!r.commits.length) return '<div class="mh-blank"><b>No commits yet</b><div class="mh-mute mh-small" style="margin-top:6px">Use <code>git commit</code> in the moundshell.</div></div>';
    const sel = r.commits.find(c => c.id === st.commit) || r.commits[0];
    const files = sel ? Object.keys(sel.changes || {}) : [];
    return '<div class="mh-commits"><div class="mh-clist">' + r.commits.map(c =>
      '<button class="mh-commit' + (c.id === sel.id ? ' on' : '') + '" data-commit="' + esc(c.id) + '"><b>' + esc(c.msg) + '</b><span>' + esc(c.short) + ' · ' + esc(ago(c.at)) + ' · ' + Object.keys(c.changes || {}).length + ' file' + (Object.keys(c.changes || {}).length === 1 ? '' : 's') + '</span></button>').join('') + '</div>' +
      '<div class="mh-cdetail"><h3>' + esc(sel.msg) + '</h3>' +
      '<div class="mh-small mh-mute" style="margin-top:4px">' + esc(sel.short) + ' · ' + esc(sel.author) + ' &lt;' + esc(sel.email) + '&gt; · ' + new Date(sel.at).toLocaleString() + ' · ' + files.length + ' file' + (files.length === 1 ? '' : 's') + ' changed</div>' +
      '<div class="mh-cfiles">' + (files.length ? files.map(f => {
        const t = sel.changes[f];
        return '<div class="mh-cfile"><span class="mh-ftag ' + (t == null ? 'del' : 'mod') + '">' + (t == null ? '−' : '+') + '</span><code>' + esc(f) + '</code>' +
          (t == null ? '<span class="mh-bad mh-small">removed</span>' : sel.parent ? '<span class="mh-small mh-mute">changed</span>' : '<span class="mh-good mh-small">added</span>') + '</div>';
      }).join('') : '<div class="mh-small mh-mute">No files recorded in this commit.</div>') + '</div>' +
      '<div class="mh-small mh-mute" style="margin-top:12px">The whole file as it stood at this commit is in the <b>Code</b> view.</div></div></div>';
  }

  /* ---------- Settings ---------- */
  function settingsView(r) {
    const origin = (r.remotes || []).find(x => x.name === 'origin');
    return '<div class="mh-settings">' +
      '<div class="mh-card"><h3>📘 Repository</h3><div class="mh-form">' +
      '<label>Name<input id="mhname" value="' + esc(r.name) + '"></label>' +
      '<label>Description<input id="mhdesc" value="' + esc(r.desc) + '" placeholder="What is this repository for?"></label>' +
      '<div class="mh-row"><button class="mh-btn mh-pri" data-saverepo="1">Save changes</button><span class="mh-sp"></span><button class="mh-btn mh-danger" data-delrepo="' + esc(r.id) + '">Delete this repository</button></div>' +
      '</div></div>' +

      '<div class="mh-card"><h3>🌐 Remote</h3><div class="mh-note">A repository stays in this browser until you set a remote and push. Give <code>origin</code> here, or run <code>git remote add origin &lt;url&gt;</code> in the moundshell. A push is recorded either way; the URL is where it would go next.</div>' +
      '<div class="mh-form"><label>origin URL<input id="mhremote" value="' + esc(origin ? origin.url : '') + '" placeholder="https://github.com/you/project.git"></label>' +
      '<div class="mh-row"><button class="mh-btn" data-saveremote="1">Save remote</button>' + (origin ? '<button class="mh-btn" data-delremote="1">Remove</button>' : '') +
      '<span class="mh-sp"></span><span class="mh-small mh-mute">' + (r.pushes && r.pushes.length ? 'Last push ' + esc(ago(r.pushes[r.pushes.length - 1].at)) : 'Never pushed') + '</span></div></div></div>' +

      bundleBlock() + passwordBlock() +
      '</div>';
  }
  function globalSettings() {
    return '<div class="mh-crumb">moundhub.com <span class="sep">/</span> <b>settings</b></div>' +
      '<div class="mh-repohead"><div><h1>MoundHub settings</h1><div class="mh-desc">The password and the bundles that move repositories between PCs.</div></div></div>' +
      '<div class="mh-settings">' + bundleBlock() + passwordBlock() + '</div>';
  }
  function bundleBlock() {
    return '<div class="mh-card"><h3>📦 Bundles</h3><div class="mh-note">An exported bundle is the whole repository in one file: keep it as a backup, or import it on another PC.</div>' +
      '<div class="mh-row"><button class="mh-btn" data-export="1">⤓ Export ' + (repo() ? 'this repository' : 'a repository') + '</button><button class="mh-btn" id="mhimport">⤒ Import a bundle</button><input type="file" id="mhimportfile" accept=".json,application/json" hidden></div></div>';
  }
  function passwordBlock() {
    return '<div class="mh-card"><h3>🔐 Password</h3><div class="mh-note">The first password was <b>Moundshroud</b>. It guards the whole repository store on this PC.' +
      (S.isDefaultPassword() ? ' <span class="mh-bad">It is still the default — change it.</span>' : '') + '</div>' +
      '<div class="mh-form"><label>Current password<input type="password" id="mhold" autocomplete="current-password"></label>' +
      '<label>New password<input type="password" id="mhnew1" autocomplete="new-password"></label>' +
      '<label>New password again<input type="password" id="mhnew2" autocomplete="new-password"></label>' +
      '<div class="mh-row"><button class="mh-btn mh-pri" id="mhsetpw">Change password</button><button class="mh-btn" id="mhresetpw" title="Go back to the default password, Moundshroud">Reset to default</button></div>' +
      '<div class="mh-bad mh-small" id="mhpwerr" style="min-height:16px"></div></div></div>';
  }

  /* ---------- the assistant ---------- */
  function aiPanel() {
    return '<aside class="mh-ai on">' +
      '<div class="mh-aihead"><b>🤖 Repository assistant</b><span class="mh-sp"></span><button class="mh-btn mh-quiet" data-ai="0" title="Hide the assistant" aria-label="Hide the assistant">✕</button></div>' +
      '<div class="mh-small mh-mute" style="padding:0 14px 10px;line-height:1.6">Reads what is in this repository. It cannot push, commit or delete anything.</div>' +
      '<div class="mh-ailog" id="mhailog"></div>' +
      '<div class="mh-aichips">' + ['Write a commit message', 'Summarise this repository', 'Draft a README', 'Explain git branches', 'What should .gitignore hold?']
        .map(x => '<button class="mh-chip" data-chip="' + esc(x) + '">' + esc(x) + '</button>').join('') + '</div>' +
      '<div class="mh-aibar"><textarea id="mhaiq" rows="2" placeholder="Ask about this repository, git, or what to push…"></textarea><button class="mh-btn mh-pri" id="mhaisend">Send</button></div>' +
      '</aside>';
  }
  function aiContext() {
    const r = repo();
    const files = r ? Object.keys(S.treeOf(r)) : [];
    const head = r ? S.head(r) : null;
    const c = head ? S.byId(r, head) : null;
    let text = 'Repository: ' + (r ? r.name : 'none') + (r && r.desc ? ' — ' + r.desc : '') + '\n';
    text += 'Branch: ' + (r ? r.branch : 'main') + ' · Files at HEAD: ' + files.length + '\n';
    text += 'Files: ' + (files.slice(0, 80).join(', ') || '(none)') + (files.length > 80 ? ', …' : '') + '\n';
    if (c) text += 'Newest commit: ' + c.msg + ' (' + c.short + ', ' + Object.keys(c.changes || {}).length + ' files)\n';
    if (r && r.commits.length > 1) text += 'Recent commits: ' + r.commits.slice(0, 5).map(x => x.msg).join(' | ') + '\n';
    if (st.file && r) { const t = S.treeOf(r)[st.file]; if (t != null) text += '\nFile ' + st.file + ':\n```\n' + String(t).slice(0, 6000) + '\n```\n'; }
    return text;
  }
  function drawAi() {
    const log = root.querySelector('#mhailog');
    if (!log) return;
    log.innerHTML = st.ai.map(m => '<div class="mh-aimsg ' + (m.role === 'user' ? 'user' : 'ai') + '">' + esc(m.content) + '</div>').join('');
    log.scrollTop = log.scrollHeight;
  }
  async function askAI(text) {
    const q = String(text == null ? '' : text).trim();
    if (!q || st.busy) return;
    st.busy = true;
    st.ai.push({ role: 'user', content: q });
    const reply = { role: 'assistant', content: '' };
    st.ai.push(reply);
    drawAi();
    const box = root.querySelector('#mhaiq'); if (box) box.value = '';
    try {
      if (!App || !App.ai || !App.ai.stream) throw new Error('The local model is only available when MoundHub is opened inside Moundshroud’s Browser.');
      const model = st.aiModel || await App.ai.localModel();
      if (!model) throw new Error('No local model is ready. Install one in Settings › AI, then ask again.');
      const system = 'You are the repository assistant on MoundHub, the repository site inside Moundshroud, an offline desktop assistant. The user has a local git-like store; commits are made in moundshell with git add/commit/push. A repository stays on this PC until a remote is set and pushed, or a bundle is exported. Help with commit messages, README files, .gitignore, branching, what to push and how to organise a repository. Be brief and concrete. Use fenced code blocks for commands. Never claim you pushed, committed or deleted anything.\n\nWhat the user is looking at now:\n' + aiContext();
      const messages = [{ role: 'system', content: system }].concat(st.ai.slice(-12).filter(m => m !== reply).map(m => ({ role: m.role, content: m.content })), [{ role: 'user', content: q }]);
      await App.ai.stream(messages, all => { reply.content = all; drawAi(); }, null, { model, localOnly: true, temp: 0.35 });
      if (!reply.content) reply.content = 'The model returned nothing. Check that it is running, then try again.';
    } catch (e) {
      reply.content = 'I could not get a reply: ' + String(e && e.message || e);
    }
    st.busy = false;
    drawAi();
  }

  /* ---------- wiring ---------- */
  function bind(r) {
    const q = root.querySelector('#mhq');
    if (q) q.oninput = () => {
      st.q = q.value;
      const at = q.selectionStart;
      paint();
      const n = root.querySelector('#mhq');
      if (n) { n.focus(); try { n.setSelectionRange(at, at); } catch (e) { } }
    };
    const lock = root.querySelector('#mhlock');
    if (lock) lock.onclick = () => { S.lock(); st.ai = []; paint(); };

    root.onclick = e => {
      const t = e.target.closest ? e.target.closest('button') : null;
      if (!t) return;
      const d = t.dataset;
      if (d.repo) {
        st.repo = d.repo; S.setCurrent(d.repo); st.file = ''; st.commit = ''; st.view = 'code';
        st.jump = false;
        const m = root.querySelector('.mh-main'); if (m) m.scrollTop = 0;
        return paint();
      }
      if (d.view) { st.view = d.view; st.jump = true; return paint(); }
      if (d.file) { st.file = d.file; return paint(); }
      if (d.commit) { st.commit = d.commit; return paint(); }
      if (d.ai !== undefined) { st.aiOpen = d.ai === '1'; return paint(); }
      if (d.chip) { st.aiOpen = true; paint(); return askAI(d.chip); }
      if (d.copy !== undefined) { const rr = repo(); if (rr) { const text = S.treeOf(rr)[d.copy]; if (text != null) copy(text); } return; }
      if (d.push !== undefined) return pushNow(repo());
      if (d.export !== undefined) return exportRepo(repo());
      if (d.saverepo !== undefined) return saveRepo(repo());
      if (d.delrepo !== undefined) return deleteRepo(S.get(d.delrepo) || repo());
      if (d.saveremote !== undefined) return saveRemote(repo());
      if (d.delremote !== undefined) { if (!repo()) return; S.removeRemote(repo().id, 'origin'); toast('Remote removed.'); return paint(); }
      if (t.id === 'mhnew' || t.id === 'mhnew2') return newRepoDialog();
      if (t.id === 'mhhowto' || t.id === 'mhhowto2' || t.id === 'mhhowto3') return howtoDialog();
      if (t.id === 'mhsetpw') return changePassword();
      if (t.id === 'mhresetpw') return resetPassword();
      if (t.id === 'mhimport') { const f = root.querySelector('#mhimportfile'); if (f) f.click(); return; }
      if (t.id === 'mhaisend') { const box = root.querySelector('#mhaiq'); return askAI(box ? box.value : ''); }
    };

    const file = root.querySelector('#mhimportfile');
    if (file) file.onchange = async () => {
      const f = file.files && file.files[0]; if (!f) return;
      try {
        const res = S.importBundle(await f.text());
        if (res && res.error) return toast(res.error, 6000);
        st.repo = res.id; st.view = 'code'; toast('Imported ' + res.name + '.'); paint();
      } catch (e) { toast('That file could not be read.', 5000); }
    };
    const box = root.querySelector('#mhaiq');
    if (box) box.onkeydown = e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); askAI(box.value); } };
  }

  function saveRepo(r) {
    if (!r) return;
    const name = (root.querySelector('#mhname') || {}).value || r.name;
    const desc = (root.querySelector('#mhdesc') || {}).value || '';
    const out = S.update(r.id, { name, desc, slug: name });
    if (out && out.error) return toast(out.error, 5000);
    toast('Saved.'); paint();
  }
  function saveRemote(r) {
    if (!r) return;
    const url = ((root.querySelector('#mhremote') || {}).value || '').trim();
    S.setRemote(r.id, 'origin', url);
    toast(url ? 'Remote saved. git push will name it.' : 'Remote cleared; pushes stay local.');
    paint();
  }
  async function deleteRepo(r) {
    if (!r) return;
    const wasOpen = st.repo === r.id;
    if (!(await ask('Delete ' + r.name + ' and all ' + r.commits.length + ' of its commits? Bundles you exported are kept.', 'Delete'))) return;
    const out = S.remove(r.id);
    if (out && out.error) return toast(out.error, 5000);
    /* the list reopens on whatever is left; the page only goes back to Code if its own repository is the one gone */
    st.repo = S.currentId();
    if (wasOpen) { st.file = ''; st.commit = ''; st.view = 'code'; st.ai = []; st.jump = false; }
    toast('Deleted ' + r.name + '.'); paint();
  }
  function pushNow(r) {
    if (!r) return;
    const out = S.push(r.id);
    if (out && out.error) return toast(out.error, 6000);
    const where = out.remote && out.remote.url ? out.remote.url : 'the local store';
    toast('Pushed ' + out.commit.short + ' to ' + where + '.', 4600);
    paint();
  }
  function exportRepo(r) {
    if (!r) return toast('Make a repository first.');
    if (!r.commits.length) return toast('There is nothing to export yet.');
    download(S.exportBundle(r.id), (r.slug || 'repository') + '.moundshroud-repo.json');
    toast('Exported ' + r.name + '. Import it on any PC from Settings.');
  }
  function changePassword() {
    const g = id => (root.querySelector('#' + id) || {}).value || '';
    const err = root.querySelector('#mhpwerr');
    if (!err) return;
    if (g('mhnew1') !== g('mhnew2')) { err.textContent = 'The new passwords do not match.'; return; }
    const out = S.setPassword(g('mhold'), g('mhnew1'));
    if (out.error) { err.textContent = out.error; return; }
    err.textContent = '';
    toast('Password changed.'); paint();
  }
  async function resetPassword() {
    if (!(await ask('Go back to the default password, Moundshroud? Anyone at this PC can then open your repositories.', 'Reset it'))) return;
    S.resetPassword();
    toast('Password reset to Moundshroud.'); paint();
  }

  /* ---------- dialogs ---------- */
  function dialog(html) {
    const d = document.createElement('dialog');
    d.className = 'mh-dlg';
    d.innerHTML = '<div class="mh-dlginner">' + html + '</div>';
    document.body.appendChild(d);
    d.addEventListener('close', () => d.remove());
    d.addEventListener('click', e => { if (e.target === d) d.close(); });
    d.showModal();
    return d;
  }
  function newRepoDialog() {
    const d = dialog('<h3>＋ New repository</h3>' +
      '<div class="mh-small mh-mute">It starts empty and private, on this PC.</div>' +
      '<label for="mhnrn">Name</label><input id="mhnrn" placeholder="my-project">' +
      '<label for="mhnrd">Description (optional)</label><input id="mhnrd" placeholder="What is it for?">' +
      '<label style="display:flex;gap:7px;align-items:center;margin-top:12px"><input type="checkbox" id="mhnrreadme" checked style="width:auto;height:auto"> Start with a README</label>' +
      '<div class="mh-row"><button class="mh-btn mh-pri" id="mhnrmake">Create repository</button><button class="mh-btn" data-x>Cancel</button></div>' +
      '<div class="mh-bad mh-small" id="mhnrerr" style="min-height:16px;margin-top:6px"></div>');
    d.querySelector('[data-x]').onclick = () => d.close();
    d.querySelector('#mhnrmake').onclick = () => {
      const name = d.querySelector('#mhnrn').value.trim();
      const err = d.querySelector('#mhnrerr');
      if (!name) { err.textContent = 'Give it a name.'; return; }
      const rr = S.create({ name, desc: d.querySelector('#mhnrd').value });
      if (d.querySelector('#mhnrreadme').checked) {
        S.commit(rr.id, 'Initial commit', {
          'README.md': '# ' + rr.name + '\n' + (rr.desc ? '\n' + rr.desc + '\n' : '\n') + '\nCreated on MoundHub.\n'
        });
      }
      st.repo = rr.id; st.view = 'code'; st.file = ''; st.commit = '';
      d.close();
      toast('Created ' + rr.name + '.');
      paint();
    };
    setTimeout(() => { const n = d.querySelector('#mhnrn'); if (n) n.focus(); }, 40);
  }

  function howtoDialog() {
    const box = lines => '<pre class="mh-howtocode">' + esc(lines.join('\n')) + '</pre>';
    const d = dialog('<h3>🐚 Doing this from the moundshell</h3>' +
      '<div class="mh-small mh-mute" style="line-height:1.7">The moundshell is a bash terminal whose only disk is this app. Anything you make there stays in your browser, and <code>git</code> in the shell saves straight into MoundHub — this page.</div>' +
      '<h4>1 · Open the shell</h4><div class="mh-small">Press <b>Ctrl+T</b> (⌘T on a Mac) anywhere, or the 🐚 button in the top bar. You start in <code>~/app</code>.</div>' +
      '<h4>2 · Make a change</h4><div class="mh-small">Every command reads and writes a copy of the app in this browser:</div>' +
      box(['echo "# Notes" > notes.md', 'mkdir -p src && echo "export {};" > src/app.js']) +
      '<h4>3 · Save it as a commit</h4>' +
      box(['git init my-project        # once: makes the repository, here on MoundHub',
        'git status                 # what this shell changed',
        'git add -A                 # stage it all (or: git add notes.md)',
        'git commit -m "first commit"',
        'git push                   # records the push right here']) +
      '<h4>4 · Look at it</h4><div class="mh-small">Type <b>moundhub.com</b> in the Browser and open the repository: the <b>Code</b> and <b>Commits</b> views show everything git saved.</div>' +
      box(['git log --oneline', 'git show', 'git diff', 'git branch', 'git restore --staged notes.md']) +
      '<h4>5 · Where a push goes (MoundHub only)</h4>' +
      box(['git remote add origin https://moundhub.com/moundshroud/project.git', 'git remote -v', 'git clone https://moundhub.com/moundshroud/project.git']) +
      '<div class="mh-small"><code>git</code> in moundshell only interacts with MoundHub (<b>https://moundhub.com</b>) inside this app’s Browser — external servers are blocked and nothing is sent over the network. Move a repository to another PC with <b>Export</b> / <b>Import a bundle</b>.</div>' +
      '<h4>Good to know</h4><ul>' +
      '<li>The MoundHub password guards the store: while it is locked, <code>git</code> stops with <i>repositories are locked</i>.</li>' +
      '<li><code>git status</code> lists the files this repository holds plus the ones the shell changed.</li>' +
      '<li>There is nothing to commit when a file’s text already matches the newest commit.</li>' +
      '<li><code>git help</code> prints the same short list inside the shell.</li>' +
      '</ul>' +
      '<div class="mh-row"><button class="mh-btn mh-pri" id="mhhowcopy">Copy the commands</button><button class="mh-btn" data-x>Close</button></div>');
    d.querySelector('[data-x]').onclick = () => d.close();
    d.querySelector('#mhhowcopy').onclick = () => {
      copy(['git init my-project', 'git status', 'git add -A', 'git commit -m "first commit"', 'git push'].join('\n'));
      toast('Copied. Paste it into the moundshell (Ctrl+T).');
    };
  }

  window.MoundHub = { paint, hub: 'https://moundhub.com' };
  /* Ctrl+T opens the moundshell from this page too: a page inside a frame has its own keyboard, and key events do
     not cross the frame boundary on their own. */
  document.addEventListener('keydown', e => {
    if (!(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey) return;
    if (String(e.key).toLowerCase() !== 't' && e.code !== 'KeyT') return;
    let shell = null;
    try { shell = window.parent !== window ? window.parent.AppShell : window.AppShell; } catch (err) { }
    if (shell && shell.open) { e.preventDefault(); e.stopPropagation(); shell.open(); }
  }, true);
  paint();
})();

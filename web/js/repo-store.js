/* Repositories: a small, local, git-like store. It is shared by moundshell's git commands and by the Repositories tab,
   so a commit made in a shell appears in the tab and a commit made in the tab can be pushed from a shell.
   Everything is kept in this browser (localStorage): nothing is sent anywhere, and a repository stays here until you
   give it a remote and push, or export it. Password: the first one is Moundshroud; it can be changed in the tab's
   Settings. Files are stored as text, so a commit of a photograph or a model records a marker, not the bytes. */
(function () {
  const KEY = 'oa_repos_v1', PW = 'oa_repos_pw', CUR = 'oa_repos_cur', OPEN = 'oa_repos_open';
  const DEFAULT_PASSWORD = 'Moundshroud';
  const MAX_COMMIT_BYTES = 4 * 1024 * 1024;

  const readLS = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : v; } catch (e) { return d; } };
  const writeLS = (k, v) => {
    try { localStorage.setItem(k, v); return true; }
    catch (e) { throw new Error('No room left in this browser for that. Push or export an old repository, or commit fewer files at a time.'); }
  };
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const SLUG = s => String(s == null ? '' : s).trim().toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);

  /* a small string hash (cyrb53); a gate for a local store, not a secret vault */
  function hash(s, salt) {
    let h1 = 0xdeadbeef ^ salt, h2 = 0x41c6ce57 ^ salt;
    for (let i = 0; i < s.length; i++) {
      const ch = s.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (h2 >>> 0).toString(16).padStart(8, '0') + (h1 >>> 0).toString(16).padStart(8, '0');
  }

  /* ---- the password ------------------------------------------------------------------------------------------ */
  function record() {
    try { const v = JSON.parse(readLS(PW, '')); return v && v.h ? v : null; } catch (e) { return null; }
  }
  const isDefaultPassword = () => !record();
  const check = pw => { const r = record(); return r ? hash(String(pw == null ? '' : pw), r.salt) === r.h : String(pw == null ? '' : pw) === DEFAULT_PASSWORD; };
  const unlocked = () => { try { return sessionStorage.getItem(OPEN) === '1'; } catch (e) { return false; } };
  function unlock(pw) {
    if (!check(pw)) return false;
    try { sessionStorage.setItem(OPEN, '1'); } catch (e) { }
    return true;
  }
  function lock() { try { sessionStorage.removeItem(OPEN); } catch (e) { } }
  function setPassword(oldPw, next) {
    if (!check(oldPw)) return { error: 'That is not the current password.' };
    const pw = String(next == null ? '' : next);
    if (pw.length < 4) return { error: 'Use at least four characters.' };
    if (/^\s*$/.test(pw)) return { error: 'A password cannot be only spaces.' };
    const salt = Math.floor(Math.random() * 0x7fffffff);
    writeLS(PW, JSON.stringify({ salt, h: hash(pw, salt), at: Date.now() }));
    return { ok: true };
  }
  /* forget the password and go back to the default (Repositories › Settings, after confirming you are signed in) */
  function resetPassword() { try { localStorage.removeItem(PW); } catch (e) { } return { ok: true }; }

  /* ---- repositories ------------------------------------------------------------------------------------------ */
  function data() {
    try {
      const d = JSON.parse(readLS(KEY, '') || 'null');
      if (d && Array.isArray(d.repos)) return d;
    } catch (e) { }
    return { v: 1, repos: [] };
  }
  function save(d) { writeLS(KEY, JSON.stringify(d)); }

  const list = () => data().repos.slice().sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  const get = id => data().repos.find(r => r.id === id) || null;
  const currentId = () => readLS(CUR, '');
  function setCurrent(id) {
    if (id) writeLS(CUR, id); else { try { localStorage.removeItem(CUR); } catch (e) { } }
    return id || '';
  }
  const current = () => get(currentId()) || list()[0] || null;

  function create(opts) {
    opts = opts || {};
    const name = String(opts.name == null ? '' : opts.name).trim() || 'untitled';
    const d = data();
    let slug = SLUG(name) || 'repo';
    let n = 2;
    while (d.repos.some(r => r.slug === slug)) slug = (SLUG(name) || 'repo') + '-' + (n++);
    const now = Date.now();
    const repo = {
      id: uid(), name, slug, desc: String(opts.desc == null ? '' : opts.desc).trim(),
      createdAt: now, updatedAt: now, branch: 'main',
      commits: [], branches: { main: null }, remotes: [], pushes: []
    };
    d.repos.push(repo);
    save(d);
    setCurrent(repo.id);
    return repo;
  }

  function remove(id) {
    const d = data();
    const at = d.repos.findIndex(r => r.id === id);
    if (at < 0) return { error: 'That repository is not here any more.' };
    const [gone] = d.repos.splice(at, 1);
    save(d);
    if (currentId() === id) setCurrent(d.repos[0] ? d.repos[0].id : '');
    return { ok: true, name: gone.name };
  }

  function update(id, patch) {
    const d = data(), repo = d.repos.find(r => r.id === id);
    if (!repo) return { error: 'That repository is not here any more.' };
    ['name', 'slug', 'desc'].forEach(k => { if (patch && typeof patch[k] === 'string') repo[k] = k === 'slug' ? (SLUG(patch[k]) || repo.slug) : patch[k].trim(); });
    repo.updatedAt = Date.now();
    save(d);
    return repo;
  }

  /* ---- commits ----------------------------------------------------------------------------------------------- */
  const head = repo => (repo && repo.branches && repo.branches[repo.branch]) || null;
  const byId = (repo, id) => (repo && repo.commits ? repo.commits.find(c => c.id === id) : null) || null;

  /* every file as it stood at a commit: changes applied from the oldest commit forward */
  function treeOf(repo, commitId) {
    const id = commitId === undefined ? head(repo) : commitId;
    const files = {};
    const chain = [];
    let c = byId(repo, id);
    const seen = new Set();
    while (c && !seen.has(c.id)) { seen.add(c.id); chain.push(c); c = c.parent ? byId(repo, c.parent) : null; }
    for (let i = chain.length - 1; i >= 0; i--) {
      const changes = chain[i].changes || {};
      for (const rel of Object.keys(changes)) {
        const text = changes[rel];
        if (text == null) delete files[rel]; else files[rel] = text;
      }
    }
    return files;
  }

  function commit(repoId, message, changes) {
    const d = data(), repo = d.repos.find(r => r.id === repoId);
    if (!repo) return { error: 'Create a repository first (git init <name>, or the ⤴ button in moundshell).' };
    const parent = head(repo);
    const tree = treeOf(repo, parent);
    const kept = {};
    let bytes = 0, n = 0;
    for (const rel of Object.keys(changes || {})) {
      const text = changes[rel];
      if (text == null) {
        if (!(rel in tree)) continue;
        kept[rel] = null; n++;
        continue;
      }
      const value = String(text);
      if (tree[rel] === value) continue;
      bytes += value.length + rel.length;
      kept[rel] = value; n++;
    }
    if (!n) return { error: 'nothing to commit: the files already match this repository.' };
    if (bytes > MAX_COMMIT_BYTES) return { error: 'That commit is more than 4 MB of text. Commit fewer files at a time.' };
    const id = uid();
    const c = {
      id, short: id.slice(0, 7), msg: String(message == null ? '' : message).trim() || 'Update',
      author: 'moundshroud', email: 'moundshroud@this-pc', at: Date.now(), parent, changes: kept
    };
    repo.commits.unshift(c);
    repo.branches[repo.branch] = id;
    repo.updatedAt = c.at;
    save(d);
    return c;
  }

  /* what is different between a working tree ({ rel: text }) and a repository's head */
  function diffAgainst(repoId, work) {
    const repo = get(repoId);
    const tree = repo ? treeOf(repo) : {};
    const added = [], modified = [], deleted = [], same = [];
    for (const rel of Object.keys(work || {})) {
      const text = work[rel];
      if (text == null) { if (rel in tree) deleted.push(rel); continue; }
      if (!(rel in tree)) added.push(rel);
      else if (tree[rel] !== String(text)) modified.push(rel);
      else same.push(rel);
    }
    for (const rel of Object.keys(tree)) if (!(rel in (work || {}))) deleted.push(rel);
    return { added, modified, deleted: [...new Set(deleted)], same };
  }

  const log = (repoId, limit) => {
    const repo = get(repoId);
    if (!repo) return [];
    return repo.commits.slice(0, limit || 50);
  };

  function remote(repoId, name) {
    const repo = get(repoId);
    if (!repo) return null;
    const want = name || 'origin';
    return (repo.remotes || []).find(r => r.name === want) || null;
  }
  function setRemote(repoId, name, url) {
    const d = data(), repo = d.repos.find(r => r.id === repoId);
    if (!repo) return { error: 'That repository is not here any more.' };
    const n = String(name || 'origin').trim() || 'origin';
    repo.remotes = repo.remotes || [];
    const hit = repo.remotes.find(r => r.name === n);
    if (hit) { hit.url = String(url || '').trim(); hit.at = Date.now(); }
    else repo.remotes.push({ name: n, url: String(url || '').trim(), at: Date.now() });
    save(d);
    return hit || repo.remotes[repo.remotes.length - 1];
  }
  function removeRemote(repoId, name) {
    const d = data(), repo = d.repos.find(r => r.id === repoId);
    if (!repo) return { error: 'That repository is not here any more.' };
    repo.remotes = (repo.remotes || []).filter(r => r.name !== (name || 'origin'));
    save(d);
    return { ok: true };
  }

  /* a push records the commit that went out. With no remote URL it is a local push: the repository is safe here and
     can be given a remote (or exported) whenever it is ready to go somewhere else. */
  function push(repoId, name) {
    const d = data(), repo = d.repos.find(r => r.id === repoId);
    if (!repo) return { error: 'There is no repository to push. Run git init <name> in moundshell, or make one in the Repositories tab.' };
    const id = head(repo);
    if (!id) return { error: 'There is nothing to push yet: ' + repo.name + ' has no commits.' };
    const c = byId(repo, id);
    /* the remote must come from this same copy: marking one fetched separately would not be saved */
    const r = (repo.remotes || []).find(x => x.name === (name || 'origin')) || null;
    repo.pushes = (repo.pushes || []).concat([{ at: Date.now(), commit: id, remote: r ? r.name : 'local' }]).slice(-40);
    repo.remotes = repo.remotes || [];
    if (r) { r.pushedAt = Date.now(); r.pushed = id; }
    repo.updatedAt = Date.now();
    save(d);
    return { ok: true, commit: c, repo, remote: r || null };
  }

  /* a bundle is a complete, self-contained copy of the repository: import it on another PC, or keep it as a backup */
  function exportBundle(repoId) {
    const repo = get(repoId);
    if (!repo) return null;
    return JSON.stringify({
      app: 'moundshroud-repo', v: 1, exportedAt: Date.now(),
      name: repo.name, slug: repo.slug, desc: repo.desc, branch: repo.branch,
      commits: repo.commits.slice().reverse().map(c => ({ id: c.id, msg: c.msg, at: c.at, author: c.author, email: c.email, changes: c.changes }))
    }, null, 1);
  }
  function importBundle(text) {
    let j;
    try { j = JSON.parse(String(text)); } catch (e) { return { error: 'That is not a repository bundle (it is not JSON).' }; }
    if (!j || j.app !== 'moundshroud-repo' || !Array.isArray(j.commits)) return { error: 'That is not a repository bundle made by Moundshroud.' };
    const d = data();
    let slug = SLUG(j.slug || j.name || 'imported') || 'imported';
    let n = 2;
    while (d.repos.some(r => r.slug === slug)) slug = (SLUG(j.slug || j.name) || 'imported') + '-' + (n++);
    const now = Date.now();
    const repo = { id: uid(), name: String(j.name || slug), slug, desc: String(j.desc || ''), createdAt: now, updatedAt: now, branch: 'main', commits: [], branches: { main: null }, remotes: [], pushes: [] };
    let parent = null;
    for (const c of j.commits) {
      const id = uid();
      repo.commits.unshift({ id, short: id.slice(0, 7), msg: String(c.msg || 'Update'), author: 'moundshroud', email: 'moundshroud@this-pc', at: +c.at || now, parent, changes: c.changes || {} });
      parent = id; repo.branches.main = id;
    }
    d.repos.push(repo);
    save(d);
    setCurrent(repo.id);
    return repo;
  }

  function stats(repoId) {
    const repo = get(repoId);
    if (!repo) return { files: 0, bytes: 0, commits: 0 };
    const files = treeOf(repo);
    let bytes = 0;
    for (const rel of Object.keys(files)) bytes += String(files[rel]).length;
    return { files: Object.keys(files).length, bytes, commits: repo.commits.length };
  }

  window.RepoStore = {
    DEFAULT_PASSWORD, MAX_COMMIT_BYTES,
    unlocked, unlock, lock, check, setPassword, resetPassword, isDefaultPassword,
    list, get, current, currentId, setCurrent, create, remove, update,
    treeOf, commit, diffAgainst, log, head, byId,
    remote, setRemote, removeRemote, push, exportBundle, importBundle, stats
  };
})();

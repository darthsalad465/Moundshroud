// Repositories: the local git-like store behind the Repositories tab and moundshell's git commands. The store is run
// here in a sandbox with a localStorage stub, so a commit, a push, a bundle and the password can all be checked
// without a browser; the rest of the checks keep the tab, its panel and the shell's button wired in.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

module.exports = async ok => {
  const root = path.join(__dirname, '..'), rd = f => fs.readFileSync(path.join(root, f), 'utf8');

  /* ----- the store ----- */
  const store = new Map(), session = new Map();
  const ctx = {
    console, Math, Date, JSON, Array, Object, String, Number, Boolean, RegExp, Error, Map, Set, isNaN,
    parseInt, parseFloat, encodeURIComponent, decodeURIComponent,
    localStorage: { getItem: k => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) },
    sessionStorage: { getItem: k => (session.has(k) ? session.get(k) : null), setItem: (k, v) => session.set(k, String(v)), removeItem: k => session.delete(k) }
  };
  ctx.self = ctx.window = ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(rd('web/js/repo-store.js'), ctx, { filename: 'web/js/repo-store.js' });
  const S = ctx.RepoStore;
  ok('repos: the store loads', !!(S && S.create && S.commit && S.push));

  ok('repos: the first password is Moundshroud and it is noted as the default',
    S.check('Moundshroud') && !S.check('moundshroud') && !S.check('') && S.isDefaultPassword());
  ok('repos: nothing is readable before the password is entered', !S.unlocked() && S.unlock('wrong') === false && !S.unlocked());
  ok('repos: the default password opens the store', S.unlock('Moundshroud') === true && S.unlocked());
  S.lock();
  ok('repos: locking closes it again', !S.unlocked());

  S.unlock('Moundshroud');
  const repo = S.create({ name: 'My Project', desc: 'A test repository' });
  ok('repos: a repository gets a safe slug and becomes the current one', repo.slug === 'my-project' && S.currentId() === repo.id && S.current().id === repo.id);
  ok('repos: a new repository has no commits', S.head(repo) === null && S.list().length === 1);

  const first = S.commit(repo.id, 'first commit', { 'README.md': '# My Project\n', 'src/app.js': 'console.log(1)\n' });
  ok('repos: the first commit is stored with a short hash', !first.error && first.short === first.id.slice(0, 7) && S.log(repo.id).length === 1);
  const tree1 = S.treeOf(S.get(repo.id));
  ok('repos: the commit records both files', tree1['README.md'] === '# My Project\n' && tree1['src/app.js'] === 'console.log(1)\n');
  ok('repos: committing the same files again is refused as nothing to commit', !!S.commit(repo.id, 'again', { 'README.md': '# My Project\n' }).error);

  const second = S.commit(repo.id, 'change it', { 'src/app.js': 'console.log(2)\n', 'src/new.js': 'export {}\n', 'README.md': null });
  const tree2 = S.treeOf(S.get(repo.id));
  ok('repos: a later commit changes, adds and removes files in one step',
    !second.error && second.parent === first.id && tree2['src/app.js'] === 'console.log(2)\n' && tree2['src/new.js'] === 'export {}\n' && !('README.md' in tree2));
  ok('repos: an older commit still shows its own tree', S.treeOf(S.get(repo.id), first.id)['src/app.js'] === 'console.log(1)\n');
  ok('repos: the log is newest first', S.log(repo.id)[0].msg === 'change it' && S.log(repo.id)[1].msg === 'first commit');

  const diff = S.diffAgainst(repo.id, { 'src/app.js': 'console.log(3)\n', 'src/new.js': 'export {}\n', 'src/other.js': 'x\n' });
  ok('repos: a working tree is compared with the newest commit',
    diff.modified.includes('src/app.js') && diff.added.includes('src/other.js') && diff.same.includes('src/new.js') && !diff.deleted.length);

  const pushed = S.push(repo.id);
  ok('repos: a push with no remote still keeps the commit in the local store',
    pushed.ok && pushed.remote === null && pushed.commit.id === second.id && S.get(repo.id).pushes.length === 1);
  S.setRemote(repo.id, 'origin', 'https://example.invalid/me/project.git');
  const pushed2 = S.push(repo.id);
  ok('repos: a push names the remote and its URL once one is set',
    pushed2.remote.name === 'origin' && pushed2.remote.url === 'https://example.invalid/me/project.git' && S.remote(repo.id, 'origin').pushed === second.id);

  const bundle = S.exportBundle(repo.id), imported = S.importBundle(bundle);
  ok('repos: a bundle imports as a full repository with every commit',
    !imported.error && imported.commits.length === 2 && S.treeOf(imported)['src/app.js'] === 'console.log(2)\n' && S.currentId() === imported.id);
  ok('repos: a file that is not a bundle is refused', !!S.importBundle('{"hello":1}').error && !!S.importBundle('not json').error);

  const changed = S.setPassword('Moundshroud', 'Moundshroud-2');
  S.lock();
  ok('repos: the password can be changed and the old one stops working',
    changed.ok && S.unlock('Moundshroud') === false && S.unlock('Moundshroud-2') === true && !S.isDefaultPassword());
  ok('repos: the new password is not stored in the clear', !store.get('oa_repos_pw').includes('Moundshroud-2'));
  ok('repos: a wrong current password is refused when changing it', !!S.setPassword('nope', 'something-else').error);

  const gone = S.remove(imported.id);
  ok('repos: a repository can be removed', gone.ok && !S.get(imported.id));

  /* ----- wiring: the site lives in the Browser at https://moundhub.com, not in a tab ----- */
  const html = rd('web/index.html'), main = rd('web/js/main.js'), shell = rd('web/js/app-shell.js'),
    hub = rd('web/moundhub.js'), hubHtml = rd('web/moundhub.html'), lib = rd('web/js/lib.js'), search = rd('web/js/websearch.js');
  ok('repos: the store is loaded by the app and the old Repositories tab is gone',
    html.includes('/web/js/repo-store.js') && !html.includes('p-repos') && !html.includes('repos.js') &&
    !html.includes('repos.css') && !/'repos'/.test(main) && !fs.existsSync(path.join(root, 'web/js/repos.js')));
  ok('repos: MoundHub is a page of its own with its address in the header',
    fs.existsSync(path.join(root, 'web/moundhub.html')) && fs.existsSync(path.join(root, 'web/moundhub.css')) &&
    /\/web\/moundhub\.css/.test(hubHtml) && /\/web\/js\/repo-store\.js/.test(hubHtml) && /https:\/\/moundhub\.com/.test(hub));
  ok('repos: the browser knows moundhub.com and opens the page instead of searching for it',
    /HUB = 'https:\/\/moundhub\.com'/.test(lib) && /const isHub =/.test(lib) && /HUB_PAGE/.test(lib) &&
    /hub: openHub/.test(lib) && /isHub\(q\.value\)/.test(lib) && /id="wshub"/.test(search) && /A\.lib\.hub\(\)/.test(search));
  ok('repos: the login screen says the default password and Settings can change it',
    /default password is <b>Moundshroud<\/b>/.test(hub) && /Change password/.test(hub) && /S\.setPassword\(/.test(hub));
  ok('repos: the site has Code, Commits and Settings, a push and a bundle export',
    /function codeView/.test(hub) && /function commitsView/.test(hub) && /function settingsView/.test(hub) &&
    /S\.push\(/.test(hub) && /exportBundle/.test(hub) && /data-view/.test(hub));
  ok('repos: moundshell no longer has a commit button and points at MoundHub instead',
    !/aeshellcommit/.test(shell) && !/Commit to app/.test(shell) && /moundhub\.com/.test(shell));
  ok('repos: moundshell\'s git commands work on the store, not a pretend reply',
    /function gitCommand/.test(shell) && /if \(git !== null\)/.test(shell) && /output = git;/.test(shell) &&
    ['status', 'add', 'commit', 'push', 'log', 'branch', 'remote', 'diff', 'init'].every(c => new RegExp("sub === '" + c + "'").test(shell)));
  ok('repos: the assistant section is part of the site', /Repository assistant/.test(hub) && /App\.ai\.stream\(/.test(hub) && /localOnly: true/.test(hub));
  ok('repos: the site explains how to work with a repository from the moundshell',
    /function howtoDialog/.test(hub) && /moundhub\.com/.test(hub) && /git add -A/.test(hub) && /git remote add origin/.test(hub) && /git clone/.test(hub));
  ok('repos: a new repository can be made on the site', /New repository/.test(hub) && /S\.create\(\{ name/.test(hub));
};

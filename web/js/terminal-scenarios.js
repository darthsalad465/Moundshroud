// Terminal Playground sandbox scenarios: random disks, every file editable as text, and named scenarios saved on this PC (bash, PowerShell and cmd).
(() => {
  const TP = window.TerminalPlayground;
  if (!TP) return;
  const STORE = 'tpg_scenarios', MAX_SAVED = 40, MAX_FILES = 200, MAX_TEXT = 60000;

  // Folders the hidden mcode note lives in are never shown, exported or replaced by a scenario.
  const secret = name => /^\.(?:archive|index|spare)$|^\.(?:ledger|annex|shelf|catalog|vault)-[0-9a-f]$|^\.closed-[0-9a-f]$/.test(name);
  const isDir = node => node && typeof node === 'object' && !('text' in node);
  const textOf = node => typeof node === 'string' ? node : String(node?.text ?? '');

  /* Text format: each file starts with a line "=== path/to/file" and its contents follow; "=== folder/" is an empty folder. */
  function serialize(files) {
    return Object.entries(files).map(([path, text]) => '=== ' + path + (text == null ? '' : '\n' + String(text).replace(/\n$/, ''))).join('\n\n') + '\n';
  }
  function parse(text) {
    const files = {}, errors = [];
    let path = null, lines = [];
    const flush = () => {
      if (path == null) return;
      const clean = path.trim().replace(/\\/g, '/').replace(/^\/+/, '');
      if (!clean || clean.split('/').some(part => part === '..' || part === '.' || secret(part) || Object.hasOwn(Object.prototype, part))) errors.push('Skipped "' + path + '"');
      else if (clean.endsWith('/')) files[clean] = null;
      else files[clean] = lines.join('\n').replace(/\n+$/, '') + '\n';
    };
    for (const line of String(text || '').replace(/\r/g, '').split('\n')) {
      const head = /^===\s+(.+?)\s*$/.exec(line);
      if (head) { flush(); path = head[1]; lines = []; }
      else if (path != null) lines.push(line);
    }
    flush();
    const entries = Object.entries(files).slice(0, MAX_FILES).map(([p, t]) => [p, t == null ? null : t.slice(0, MAX_TEXT)]);
    return { files: Object.fromEntries(entries), errors };
  }

  function homeOf(tree, home, win) {
    let dir = tree;
    for (const part of home) {
      const key = win ? Object.keys(dir).find(k => k.toLowerCase() === part.toLowerCase()) : part;
      if (!isDir(dir?.[key])) return null;
      dir = dir[key];
    }
    return dir;
  }

  // Every file and empty folder under home, as path -> text (null for an empty folder).
  function read(tree, home, win) {
    const dir = homeOf(tree, home, win), files = {};
    if (!dir) return files;
    const walk = (node, base) => {
      for (const name of Object.keys(node).sort()) {
        if (secret(name)) continue;
        const path = base + name;
        if (isDir(node[name])) { if (!Object.keys(node[name]).some(k => !secret(k))) files[path + '/'] = null; else walk(node[name], path + '/'); }
        else files[path] = textOf(node[name]);
      }
    };
    walk(dir, '');
    return files;
  }

  // Replaces everything under home with the scenario's files; the hidden note folders stay where they are.
  function apply(tree, home, win, files) {
    const dir = homeOf(tree, home, win);
    if (!dir) return false;
    for (const name of Object.keys(dir)) if (!secret(name)) delete dir[name];
    for (const [path, text] of Object.entries(files)) {
      const parts = path.replace(/\/$/, '').split('/');
      let at = dir;
      for (const part of (text == null ? parts : parts.slice(0, -1))) { if (!isDir(at[part])) at[part] = {}; at = at[part]; }
      if (text == null) continue;
      const name = parts.at(-1);
      at[name] = win ? text : { text, mode: /\.(?:sh|py|pl)$/.test(name) || /^#!/.test(text) ? '755' : '644' };
    }
    return true;
  }

  /* ---- random disks: a small team project with logs, config, notes and scripts, different every time ---- */
  function rng(seed) {
    let s = seed >>> 0 || 1;
    return () => { s = Math.imul(s ^ (s >>> 15), 0x2c1b3c6d) + 0x297a2d39 >>> 0; s ^= s >>> 12; return (s >>> 0) / 4294967296; };
  }
  /* A whole case from the lore engine: a themed organisation, its paperwork, and a pile of juicy documents hidden in
     it (web/js/terminal-lore.js). Every parameter can be chosen; anything left alone is picked from the seed. */
  function randomize(shellId, seed = (Math.random() * 4294967295) >>> 0, opts) {
    const L = window.TerminalLore;
    if (!L || !L.disk) return randomizeLegacy(shellId, seed);
    const built = L.disk(L.normalize(Object.assign({}, opts || {}, { shell: shellId, seed })));
    return { name: built.name, seed: built.seed, files: built.files, lore: built.lore };
  }
  function randomizeLegacy(shellId, seed = (Math.random() * 4294967295) >>> 0) {
    const r = rng(seed), pick = list => list[Math.floor(r() * list.length)], int = (a, b) => a + Math.floor(r() * (b - a + 1));
    const win = shellId === 'powershell' || shellId === 'cmd';
    const project = pick(['orchard', 'lighthouse', 'tinker', 'harbor', 'quill', 'nimbus', 'saffron', 'atlas-api', 'kettle', 'juniper']);
    const service = pick(['payments', 'search', 'auth', 'inventory', 'billing', 'notifications', 'reports']);
    const person = pick(['Ana', 'Ben', 'Chidi', 'Dara', 'Eli', 'Farah', 'Gus', 'Hana', 'Ivo', 'Jun']);
    const ip = () => '10.' + int(0, 9) + '.' + int(0, 254) + '.' + int(2, 254);
    const time = (h, m, s) => '2026-0' + int(1, 9) + '-1' + int(0, 9) + 'T' + String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0') + 'Z';
    const levels = ['INFO', 'INFO', 'INFO', 'WARN', 'ERROR'];
    const events = ['GET /health 200', 'POST /v1/' + service + ' 201', 'GET /v1/' + service + ' 200', 'slow query ' + int(300, 1500) + 'ms',
      'upstream timeout /v1/' + service, 'retry ' + int(1, 3) + '/3', 'cache miss key=' + service + ':' + int(100, 999), 'login failed user=' + person.toLowerCase() + ' ip=' + ip()];
    const log = Array.from({ length: int(12, 24) }, (_, i) => time(6 + Math.floor(i / 6), int(0, 59), int(0, 59)) + ' ' + pick(levels).padEnd(5) + ' ' + pick(events)).sort().join('\n');
    const csv = ['host,cpu,mem_mb,status', ...Array.from({ length: int(5, 9) }, (_, i) => service + '-' + (i + 1) + ',' + int(2, 97) + ',' + int(256, 8192) + ',' + pick(['ok', 'ok', 'ok', 'degraded', 'down']))].join('\n');
    const config = JSON.stringify({ service, host: ip(), port: pick([8080, 8443, 3000, 5000, 9090]), debug: r() < 0.3, owner: person, replicas: int(1, 6) }, null, 2);
    const todo = ['TODO for ' + project, ...Array.from({ length: int(3, 5) }, () => '- ' + pick(['rotate the ' + service + ' key', 'read the ' + service + ' errors', 'ask ' + person + ' about the deploy', 'clean up old backups', 'ship the weekly report', 'check disk usage on ' + ip()]))].join('\n');
    const files = {};
    if (win) {
      files['Documents/' + project + '-notes.txt'] = todo + '\n';
      files['Documents/hosts.csv'] = csv + '\n';
      files['Desktop/README.txt'] = 'Project ' + project + ' (' + service + ' service). Owner: ' + person + '.\n';
      files['Projects/' + project + '/config.json'] = config + '\n';
      files['Projects/' + project + '/logs/' + service + '.log'] = log + '\n';
      files['Scripts/deploy.ps1'] = 'param([string]$Env = "staging")\nWrite-Output "deploying ' + project + ' to $Env"\n';
      files['Scripts/backup.bat'] = '@echo off\nxcopy /e /i Projects\\' + project + ' D:\\backup\\' + project + '\n';
      files['Downloads/'] = null;
    } else {
      files['README.md'] = '# ' + project + '\n\nThe ' + service + ' service. Owner: ' + person + '.\n';
      files['notes.txt'] = todo + '\n';
      files['projects/' + project + '/config.json'] = config + '\n';
      files['projects/' + project + '/logs/' + service + '.log'] = log + '\n';
      files['projects/' + project + '/hosts.csv'] = csv + '\n';
      files['scripts/deploy.sh'] = '#!/bin/sh\nset -e\necho "deploying ' + project + '"\n';
      files['scripts/backup.sh'] = '#!/bin/sh\ntar -czf /tmp/' + project + '.tgz ~/projects/' + project + '\n';
      if (r() < 0.6) files['.env'] = 'API_KEY=sk-test-' + int(100000, 999999) + '\nDB_HOST=' + ip() + '\n';
      files['tmp/'] = null;
    }
    return { name: project + ' · ' + service, seed, files };
  }

  /* ---- saved scenarios ---- */
  const list = () => { const saved = TP.readSave?.(STORE); return Array.isArray(saved) ? saved : []; };
  function save(name, shell, files) {
    const clean = String(name || '').trim().slice(0, 60) || 'Scenario ' + new Date().toLocaleString();
    const next = list().filter(item => item.name !== clean);
    next.unshift({ name: clean, shell, files, at: Date.now() });
    return TP.writeSave?.(STORE, next.slice(0, MAX_SAVED)) === false ? null : clean;
  }
  const remove = name => TP.writeSave?.(STORE, list().filter(item => item.name !== name));
  const get = name => list().find(item => item.name === name) || null;

  TP.scenarios = { serialize, parse, read, apply, randomize, list, save, remove, get, secret };
})();

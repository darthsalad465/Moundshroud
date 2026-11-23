// Terminal playground — PowerShell, cmd, Python and Node sandboxes.
(function () {
  const G = window.TerminalPlayground;
  if (!G) return;

  const winTokens = s => {
    const out = []; let cur = '', q = null;
    for (const c of s) {
      if (q) { if (c === q) q = null; else cur += c; }
      else if (c === '"' || c === "'") q = c;
      else if (/\s/.test(c)) { if (cur) { out.push(cur); cur = ''; } }
      else cur += c;
    }
    if (cur) out.push(cur);
    return out;
  };
  // tree.com, as cmd and PowerShell both run it: folders only, files too with /F, every level, ASCII art with /A.
  const winTreeListing = (node, label, args) => {
    const files = args.some(x => /^\/f$/i.test(x)), ascii = args.some(x => /^\/a$/i.test(x));
    const [tee, end, bar] = ascii ? ['+---', '\\---', '|   '] : ['├───', '└───', '│   '];
    const rows = ['Folder PATH listing for volume OS', 'Volume serial number is 7C2A-91F4', label];
    const isFolder = value => value && typeof value === 'object' && !('text' in value);
    let folders = 0;
    const rec = (dir, pre) => {
      // Hidden (dot) folders and files are left out, as tree.com skips items with the Hidden attribute.
      const keys = Object.keys(dir).filter(k => k[0] !== '.').sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
      const subs = keys.filter(k => isFolder(dir[k])), plain = keys.filter(k => !isFolder(dir[k]));
      if (files) plain.forEach(k => rows.push(pre + (subs.length ? bar : '    ') + k));
      if (files && plain.length) rows.push(pre + (subs.length ? bar : '    ').trimEnd());
      subs.forEach((k, i) => {
        const last = i === subs.length - 1;
        folders++;
        rows.push(pre + (last ? end : tee) + k);
        rec(dir[k], pre + (last ? '    ' : bar));
      });
    };
    rec(node, '');
    if (!folders) rows.push('No subfolders exist ');
    return rows.join('\n').replace(/\n+$/, '');
  };
  G.winTreeListing = winTreeListing;
  const table = objs => {
    if (!objs.length) return '';
    const cols = Object.keys(objs[0]);
    const widths = cols.map(c => Math.max(c.length, ...objs.map(o => String(o[c] == null ? '' : o[c]).length)));
    const line = (cells, pad) => cells.map((c, i) => String(c).padEnd(pad ? widths[i] : 0)).join(' ').trimEnd();
    return [line(cols, true), line(cols.map(c => '-'.repeat(c.length)), true)]
      .concat(objs.map(o => line(cols.map(c => o[c] == null ? '' : o[c]), true))).join('\n');
  };
  const winTreeBase = () => {
    /* a real Windows profile: Desktop, Documents, Downloads, AppData, Program Files and the rest, shared by
       every Windows sandbox in the app (see terminal-pc-profile.js) */
    const profile = window.TerminalPC ? TerminalPC.windows({ user: 'moundshroud', host: 'DEV-BOX', seed: 0x77c0de }) : {};
    const base = {
      Users: {
        moundshroud: {
          'notes.txt': 'meeting notes\n- patch window Thursday\n- rotate the service account\n',
          'profile.ps1': '# profile\nSet-Alias ll Get-ChildItem\n',
          Desktop: { 'todo.txt': 'ship the report\n', 'screenshot.png': '(png)' },
          Documents: { 'incident-2026-02.docx': '(docx)', 'budget.xlsx': '(xlsx)', 'runbook.txt': '1. isolate\n2. rotate\n3. report\n' },
          Downloads: { 'installer.msi': '(msi)', 'dump.pcap': '(pcap)' },
          Scripts: { 'backup.ps1': 'param($target)\nCompress-Archive $target C:\\Backup\\data.zip\n', 'deploy.ps1': 'Write-Host "deploying"\n' }
        }
      },
      Windows: { System32: { drivers: {}, 'cmd.exe': '(exe)', 'notepad.exe': '(exe)', 'netstat.exe': '(exe)' } },
      ProgramData: { 'update.log': 'update check ok\n' },
      Backup: {}
    };
    return { 'C:': window.TerminalPC ? TerminalPC.merge(profile, base) : base };
  };
  /* the deep lore layer, merged into the Windows profile so PowerShell and cmd get essays, app notes and secrets too */
  const winTree = () => G.mergeLoreInto(winTreeBase(), ['C:', 'Users', 'moundshroud'], true, 0x77c0de);

  /* ================================================================ POWERSHELL */
  G.makePowershell = function () {
    let tree = winTree();
    let cwd = ['C:', 'Users', 'moundshroud'];
    const hist = [];
    const seedProc = () => [
      { Id: 412, ProcessName: 'explorer', CPU: 1.2, WS: 88210432 },
      { Id: 1204, ProcessName: 'powershell', CPU: 0.4, WS: 62154752 },
      { Id: 2210, ProcessName: 'chrome', CPU: 8.1, WS: 512000000 },
      { Id: 3110, ProcessName: 'sshd', CPU: 0.1, WS: 12288000 }
    ];
    const seedServices = () => [
      { Status: 'Running', Name: 'Dhcp', DisplayName: 'DHCP Client' },
      { Status: 'Running', Name: 'Dnscache', DisplayName: 'DNS Client' },
      { Status: 'Stopped', Name: 'Spooler', DisplayName: 'Print Spooler' },
      { Status: 'Running', Name: 'WinDefend', DisplayName: 'Microsoft Defender' }
    ];
    let proc = seedProc();
    let services = seedServices();
    const resolve = p => {
      if (!p) return cwd.slice();
      let raw = String(p).trim().replace(/\//g, '\\');
      if (raw === '~') return ['C:', 'Users', 'moundshroud'];
      if (raw.startsWith('~\\')) raw = 'C:\\Users\\moundshroud\\' + raw.slice(2);
      const isAbs = /^[A-Za-z]:/.test(raw) || raw.startsWith('\\');
      const parts = isAbs ? ['C:'] : cwd.slice();
      const rest = raw.replace(/^[A-Za-z]:\\?/, '').replace(/^\\+/, '');
      for (const s of rest.split('\\')) {
        if (!s || s === '.') continue;
        if (s === '..') { if (parts.length > 1) parts.pop(); }
        else parts.push(s);
      }
      return parts;
    };
    const walkEntry = parts => {
      let n = tree;
      const canon = [];
      for (const s of parts) {
        if (!n || typeof n !== 'object') return { node: undefined, parts: canon };
        let key = s in n ? s : Object.keys(n).find(k => k.toLowerCase() === s.toLowerCase());
        if (key === undefined) return { node: undefined, parts: canon };
        canon.push(key);
        n = n[key];
      }
      return { node: n, parts: canon };
    };
    const walk = parts => walkEntry(parts).node;
    const showPath = () => 'C:\\' + cwd.slice(1).join('\\');
    const display = parts => parts.join('\\');
    const fileRow = (name, node, base) => {
      const dir = node && typeof node === 'object';
      return {
        Mode: dir ? 'd-----' : '-a----',
        LastWriteTime: '12/02/2026 06:20',
        Length: dir ? '' : String(typeof node === 'string' ? node.length * 2 : ''),
        Name: name + (dir ? '' : '')
      };
    };
    const readFile = p => {
      const n = walk(resolve(p));
      if (n === undefined) return null;
      if (typeof n !== 'string') return null;
      return n;
    };
    const writeFile = (p, text) => {
      const parts = resolve(p);
      let n = tree;
      for (let i = 0; i < parts.length - 1; i++) { if (!n[parts[i]] || typeof n[parts[i]] !== 'object') n[parts[i]] = {}; n = n[parts[i]]; }
      n[parts[parts.length - 1]] = text;
    };
    const C = (name, fn) => ({ name, fn });

    const aliases = {
      ls: 'get-childitem', dir: 'get-childitem', gci: 'get-childitem',
      cd: 'set-location', sl: 'set-location', chdir: 'set-location', pwd: 'get-location', gl: 'get-location',
      cat: 'get-content', gc: 'get-content', type: 'get-content',
      sc: 'set-content', ac: 'add-content', clc: 'clear-content', ni: 'new-item',
      rm: 'remove-item', del: 'remove-item', ri: 'remove-item', erase: 'remove-item', rd: 'remove-item', rmdir: 'remove-item',
      cp: 'copy-item', copy: 'copy-item', cpi: 'copy-item',
      mv: 'move-item', move: 'move-item', mi: 'move-item',
      ren: 'rename-item', rni: 'rename-item', mkdir: 'new-item-dir', md: 'new-item-dir',
      gi: 'get-item', gp: 'get-itemproperty', rvpa: 'resolve-path', sls: 'select-string',
      pushd: 'push-location', popd: 'pop-location',
      ps: 'get-process', gps: 'get-process', kill: 'stop-process', spps: 'stop-process', saps: 'start-process', start: 'start-process',
      gsv: 'get-service', sasv: 'start-service', spsv: 'stop-service',
      gcm: 'get-command', man: 'get-help', cls: 'clear-host', clear: 'clear-host',
      echo: 'write-output', write: 'write-output', measure: 'measure-object',
      sort: 'sort-object', select: 'select-object', where: 'where-object', '?': 'where-object',
      foreach: 'foreach-object', '%': 'foreach-object', ft: 'format-table', fl: 'format-list', group: 'group-object',
      tee: 'tee-object', diff: 'compare-object', gm: 'get-member',
      gv: 'get-variable', sv: 'set-variable', rv: 'remove-variable', gal: 'get-alias', sal: 'set-alias',
      h: 'get-history', history: 'get-history', sleep: 'start-sleep', gwmi: 'get-ciminstance', 'get-wmiobject': 'get-ciminstance',
      iwr: 'invoke-webrequest', curl: 'invoke-webrequest', wget: 'invoke-webrequest', irm: 'invoke-restmethod',
      ping: 'test-connection', tnc: 'test-netconnection', nslookup: 'resolve-dnsname',
      exit: 'exit-sandbox', quit: 'exit-sandbox'
    };
    const dirStack = [];
    const psVars = { HOME: 'C:\\Users\\moundshroud', PWD: 'C:\\Users\\moundshroud', PSVersionTable: 'PSVersion 7.4.2 (Desktop/Core Sandbox)' };
    let execPolicy = 'RemoteSigned';
    const psHash = s => {
      let h = 0x811c9dc5, out = '';
      for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193) >>> 0;
      while (out.length < 64) { h = (Math.imul(h ^ (h >>> 15), 0x2c1b3c6d) + 0x297a2d39) >>> 0; out += h.toString(16).padStart(8, '0').toUpperCase(); }
      return out.slice(0, 64);
    };
    const commands = {
      'get-location': () => 'Path\n----\n' + showPath(),
      tree: (a) => {
        const target = a.find(x => !x.startsWith('/'));
        const res = walkEntry(resolve(target || ''));
        if (!res.node || typeof res.node !== 'object') return 'Invalid path - ' + (target ? target.toUpperCase() : showPath());
        return winTreeListing(res.node, 'C:\\' + res.parts.slice(1).join('\\'), a);
      },
      'set-location': (a) => {
        const p = a.find(x => !x.startsWith('-')) || '~';
        const res = walkEntry(resolve(p));
        if (res.node === undefined) return 'Set-Location : Cannot find path \'' + p + '\' because it does not exist.';
        if (typeof res.node !== 'object') return 'Set-Location : Cannot set location because \'' + p + '\' is a file, not a directory.';
        cwd = res.parts;
        psVars.PWD = showPath();
        return '';
      },
      'push-location': (a) => { dirStack.push(cwd.slice()); return a.length ? commands['set-location'](a) : ''; },
      'pop-location': () => { if (!dirStack.length) return ''; cwd = dirStack.pop(); psVars.PWD = showPath(); return ''; },
      'get-childitem': (a) => {
        const flags = a.filter(x => x.startsWith('-')).join(' ').toLowerCase();
        const fi = a.findIndex(x => /^-filter$/i.test(x));
        const filter = fi >= 0 ? a[fi + 1] : null;
        const p = a.find((x, i) => !x.startsWith('-') && (fi < 0 || i !== fi + 1)) || showPath();
        if (/^env:/i.test(p)) return Object.entries({ USERNAME: 'moundshroud', COMPUTERNAME: 'DEV-BOX', OS: 'Windows_NT', HOMEPATH: '\\Users\\moundshroud', Path: 'C:\\Windows\\System32' }).map(([Name, Value]) => ({ Name, Value }));
        const n = walk(resolve(p));
        if (n === undefined) return 'Get-ChildItem : Cannot find path \'' + p + '\'.';
        if (typeof n === 'string') return [fileRow(p.split('\\').pop(), n, p)];
        const filterRe = filter ? new RegExp('^' + filter.replace(/\./g, '\\.').replace(/\*/g, '.*').replace(/\?/g, '.') + '$', 'i') : null;
        // Names that start with a dot stand for files with the Hidden attribute: only -Force (or -Hidden) lists them.
        const shown = k => k[0] !== '.' || /-force|-hidden/.test(flags);
        if (flags.includes('recurse')) {
          const rows = [];
          const rec = (node, base) => {
            for (const k of Object.keys(node).sort().filter(shown)) {
              const rel = base ? base + '\\' + k : k;
              if (!filterRe || filterRe.test(k)) rows.push(fileRow(rel, node[k], p));
              if (typeof node[k] === 'object') rec(node[k], rel);
            }
          };
          rec(n, '');
          return rows;
        }
        return Object.keys(n).sort().filter(k => shown(k) && (!filterRe || filterRe.test(k))).map(k => fileRow(k, n[k], p));
      },
      'get-item': (a) => {
        const p = a.find(x => !x.startsWith('-')) || showPath();
        const n = walk(resolve(p));
        if (n === undefined) return "Get-Item : Cannot find path '" + p + "'.";
        return [fileRow(p.split(/[\\/]/).pop() || showPath(), n, p)];
      },
      'get-itemproperty': (a) => commands['get-item'](a),
      'get-content': (a) => {
        const files = a.filter(x => !x.startsWith('-'));
        if (!files.length) return 'Get-Content : supply a path';
        const outs = [];
        for (const p of files) {
          const t = readFile(p);
          if (t == null) return "Get-Content : Cannot find path '" + p + "'.";
          outs.push(t);
        }
        return outs.join('\n');
      },
      'set-content': (a) => {
        const f = a.filter(x => !x.startsWith('-'));
        if (!f[0]) return 'Set-Content : supply a path';
        writeFile(f[0], f.slice(1).join(' '));
        return '';
      },
      'add-content': (a) => {
        const f = a.filter(x => !x.startsWith('-'));
        if (!f[0]) return 'Add-Content : supply a path';
        const prev = readFile(f[0]) || '';
        writeFile(f[0], prev ? prev.replace(/\n$/, '') + '\n' + f.slice(1).join(' ') + '\n' : f.slice(1).join(' ') + '\n');
        return '';
      },
      'clear-content': (a) => {
        const p = a.find(x => !x.startsWith('-'));
        if (!p) return 'Clear-Content : supply a path';
        writeFile(p, '');
        return '';
      },
      'new-item': (a) => {
        const dir = a.some(x => /directory/i.test(x));
        const p = a.filter((x, i) => !x.startsWith('-') && !(i > 0 && /^-itemtype$/i.test(a[i - 1])))[0];
        if (!p) return 'New-Item : supply a path';
        if (dir) { const parts = resolve(p); let n = tree; for (let i = 0; i < parts.length - 1; i++) { if (!n[parts[i]]) n[parts[i]] = {}; n = n[parts[i]]; } n[parts[parts.length - 1]] = {}; }
        else writeFile(p, '');
        return '    Directory: C:\\' + cwd.slice(1).join('\\') + '\n\nMode   LastWriteTime        Length Name\n----   -------------        ------ ----\n' + (dir ? 'd-----' : '-a----') + ' 12/02/2026 06:31        ' + (dir ? '' : '0') + ' ' + p.split('\\').pop();
      },
      'new-item-dir': (a) => commands['new-item'](['-ItemType', 'Directory'].concat(a)),
      'remove-item': (a) => {
        const p = a.find(x => !x.startsWith('-'));
        const parts = resolve(p);
        const parent = walk(parts.slice(0, -1));
        if (!parent || !(parts[parts.length - 1] in parent)) return 'Remove-Item : Cannot find path \'' + p + '\'.';
        delete parent[parts[parts.length - 1]];
        return '';
      },
      'copy-item': (a) => {
        const f = a.filter(x => !x.startsWith('-'));
        const t = readFile(f[0]);
        if (t == null) return 'Copy-Item : Cannot find path \'' + (f[0] || '') + '\'.';
        writeFile(f[1], t);
        return '';
      },
      'move-item': (a) => {
        const f = a.filter(x => !x.startsWith('-'));
        const t = readFile(f[0]);
        if (t == null) return 'Move-Item : Cannot find path \'' + (f[0] || '') + '\'.';
        writeFile(f[1], t);
        const parts = resolve(f[0]);
        const parent = walk(parts.slice(0, -1));
        if (parent) delete parent[parts[parts.length - 1]];
        return '';
      },
      'rename-item': (a) => commands['move-item'](a),
      'test-path': (a) => walk(resolve(a.find(x => !x.startsWith('-')) || '')) !== undefined ? 'True' : 'False',
      'resolve-path': (a) => 'Path\n----\n' + display(resolve(a.find(x => !x.startsWith('-')) || '')),
      'split-path': (a) => { const p = a.find(x => !x.startsWith('-')) || showPath(); const parts = p.replace(/\//g, '\\').split('\\'); return a.some(x => /^-leaf/i.test(x)) ? parts.pop() : parts.slice(0, -1).join('\\'); },
      'join-path': (a) => a.filter(x => !x.startsWith('-')).join('\\').replace(/\\\\+/g, '\\'),
      'select-string': (a) => {
        const pi = a.findIndex(x => /^-pattern$/i.test(x)), fi = a.findIndex(x => /^-path$/i.test(x));
        const pos = a.filter((x, i) => !x.startsWith('-') && (pi < 0 || i !== pi + 1) && (fi < 0 || i !== fi + 1));
        const pat = pi >= 0 ? (a[pi + 1] || '') : (pos[0] || '');
        const pathArg = fi >= 0 ? (a[fi + 1] || 'notes.txt') : (pi >= 0 ? (pos[0] || 'notes.txt') : (pos[1] || 'notes.txt'));
        const t = readFile(pathArg);
        if (t == null) return "Select-String : Cannot find path '" + pathArg + "'.";
        const re = new RegExp(pat, 'i');
        return t.split('\n').map((l, i) => re.test(l) ? pathArg + ':' + (i + 1) + ':' + l : '').filter(Boolean).join('\n');
      },
      'get-filehash': (a) => {
        const p = a.find(x => !x.startsWith('-')) || 'notes.txt';
        const t = readFile(p);
        if (t == null) return "Get-FileHash : Cannot find path '" + p + "'.";
        return [{ Algorithm: 'SHA256', Hash: psHash(t), Path: display(resolve(p)) }];
      },
      'compress-archive': (a) => { const f = a.filter(x => !x.startsWith('-')); writeFile(f[1] || 'archive.zip', '(zip archive)'); return 'Compressed ' + (f[0] || '.') + ' -> ' + (f[1] || 'archive.zip'); },
      'expand-archive': (a) => 'Expanded ' + (a.find(x => !x.startsWith('-')) || 'archive.zip') + ' to ' + showPath(),
      'get-process': (a) => {
        const n = a.find(x => !x.startsWith('-'));
        return n ? proc.filter(p => p.ProcessName.toLowerCase().includes(n.toLowerCase())) : proc;
      },
      'start-process': (a) => {
        const name = (a.find(x => !x.startsWith('-')) || 'notepad').replace(/\.exe$/i, '');
        const id = 4000 + proc.length * 17;
        proc.push({ Id: id, ProcessName: name, CPU: 0.1, WS: 16384000 });
        return 'Started process ' + name + ' (Id ' + id + ')';
      },
      'stop-process': (a) => {
        const id = parseInt(a.find(x => /^\d+$/.test(x)) || '0', 10);
        const i = id ? proc.findIndex(p => p.Id === id) : proc.findIndex(p => p.ProcessName.toLowerCase() === (a.find(x => !x.startsWith('-')) || '').toLowerCase());
        if (i < 0) return 'Stop-Process : Cannot find a process with the process identifier ' + (id || a[0] || '') + '.';
        proc.splice(i, 1);
        return '';
      },
      'get-service': (a) => {
        const n = a.find(x => !x.startsWith('-'));
        return n ? services.filter(s => s.Name.toLowerCase().includes(n.toLowerCase())) : services;
      },
      'start-service': (a) => { const n = (a.find(x => !x.startsWith('-')) || '').toLowerCase(); const s = services.find(x => x.Name.toLowerCase() === n); if (!s) return "Start-Service : Cannot find any service with service name '" + n + "'."; s.Status = 'Running'; return ''; },
      'stop-service': (a) => { const n = (a.find(x => !x.startsWith('-')) || '').toLowerCase(); const s = services.find(x => x.Name.toLowerCase() === n); if (!s) return "Stop-Service : Cannot find any service with service name '" + n + "'."; s.Status = 'Stopped'; return ''; },
      'restart-service': (a) => { const n = (a.find(x => !x.startsWith('-')) || '').toLowerCase(); const s = services.find(x => x.Name.toLowerCase() === n); if (!s) return "Restart-Service : Cannot find service '" + n + "'."; s.Status = 'Running'; return ''; },
      'get-eventlog': () => [{ Index: 4102, Time: 'Feb 12 06:14', EntryType: 'FailureAudit', Source: 'Security', Message: 'An account failed to log on (4625)' }, { Index: 4103, Time: 'Feb 12 06:18', EntryType: 'Information', Source: 'Service Control Manager', Message: 'WinDefend running' }],
      'get-winevent': () => commands['get-eventlog'](),
      'get-scheduledtask': () => [{ TaskPath: '\\', TaskName: 'NightlyBackup', State: 'Ready' }, { TaskPath: '\\Microsoft\\', TaskName: 'DefenderScan', State: 'Ready' }],
      'get-localuser': () => [{ Name: 'Administrator', Enabled: false, Description: 'Built-in account' }, { Name: 'moundshroud', Enabled: true, Description: 'Local developer account' }],
      'get-localgroup': () => [{ Name: 'Administrators', Description: 'Full system access' }, { Name: 'Users', Description: 'Standard users' }],
      'get-acl': (a) => [{ Path: a[0] || showPath(), Owner: 'DEV-BOX\\moundshroud', Access: 'NT AUTHORITY\\SYSTEM Allow FullControl' }],
      'get-hotfix': () => [{ Source: 'DEV-BOX', Description: 'Security Update', HotFixID: 'KB5034765', InstalledOn: '2026-02-10' }],
      'get-ciminstance': (a) => [{ CSName: 'DEV-BOX', Caption: 'Microsoft Windows 11 Pro', Version: '10.0.22631', Class: a.find(x => !x.startsWith('-')) || 'Win32_OperatingSystem' }],
      'get-command': (a) => {
        const pat = (a.find(x => !x.startsWith('-')) || '').toLowerCase();
        const re = pat.includes('*') ? new RegExp('^' + pat.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$') : null;
        const names = Object.keys(commands).concat(Object.keys(aliases)).filter(x => re ? re.test(x) : x.includes(pat)).sort();
        return names.map(x => ({ CommandType: commands[x] ? 'Cmdlet' : 'Alias', Name: x, Version: '7.4.0.0', Source: 'Microsoft.PowerShell.Management' }));
      },
      'get-help': (a) => {
        const n = (a.find(x => !x.startsWith('-')) || 'Get-Help').toLowerCase();
        return ['NAME', '    ' + n, '', 'SYNOPSIS', '    Simulated help for ' + n + ' in the terminal playground.', '',
          'DESCRIPTION', '    This cmdlet is part of the sandbox. Nothing here touches the real machine.', '',
          'EXAMPLES', '    PS C:\\Users\\moundshroud> ' + n].join('\n');
      },
      'write-output': (a) => a.join(' '),
      'write-host': (a) => a.filter(x => !/^-foregroundcolor|-backgroundcolor/i.test(x)).join(' '),
      'write-warning': (a) => 'WARNING: ' + a.join(' '),
      'write-error': (a) => 'ERROR: ' + a.join(' '),
      'get-variable': (a) => { const n = (a.find(x => !x.startsWith('-')) || '').replace(/^\$/, ''); return Object.entries(psVars).filter(([k]) => !n || k.toLowerCase() === n.toLowerCase()).map(([Name, Value]) => ({ Name, Value })); },
      'set-variable': (a) => { const f = a.filter(x => !x.startsWith('-')); if (f[0]) psVars[f[0].replace(/^\$/, '')] = f.slice(1).join(' '); return ''; },
      'remove-variable': (a) => { const f = a.find(x => !x.startsWith('-')); if (f) delete psVars[f.replace(/^\$/, '')]; return ''; },
      'get-alias': (a) => { const n = (a.find(x => !x.startsWith('-')) || '').toLowerCase(); return Object.entries(aliases).filter(([k]) => !n || k.includes(n)).map(([Name, Definition]) => ({ CommandType: 'Alias', Name, Definition })); },
      'set-alias': (a) => { const f = a.filter(x => !x.startsWith('-')); if (f[0] && f[1]) aliases[f[0].toLowerCase()] = f[1].toLowerCase(); return ''; },
      'get-history': () => hist.map((CommandLine, i) => ({ Id: i + 1, CommandLine })),
      'get-date': () => 'Thursday, February 12, 2026 6:58:12 AM',
      'get-random': (a) => { const max = parseInt(a.find(x => /^\d+$/.test(x)) || '100', 10); return String(Math.floor(Math.random() * max)); },
      'start-sleep': () => '',
      'get-host': () => 'Name             : ConsoleHost\nVersion          : 7.4.2\nCurrentCulture   : en-US',
      'get-executionpolicy': () => execPolicy,
      'set-executionpolicy': (a) => { execPolicy = a.find(x => !x.startsWith('-')) || 'RemoteSigned'; return ''; },
      'get-module': () => [{ ModuleType: 'Manifest', Version: '7.0.0.0', Name: 'Microsoft.PowerShell.Management' }, { ModuleType: 'Manifest', Version: '7.0.0.0', Name: 'Microsoft.PowerShell.Utility' }, { ModuleType: 'Manifest', Version: '2.0.0.0', Name: 'NetTCPIP' }],
      'get-nettcpconnection': () => ([
        { LocalAddress: '0.0.0.0', LocalPort: 22, RemoteAddress: '0.0.0.0', RemotePort: 0, State: 'Listen', OwningProcess: 3110 },
        { LocalAddress: '10.0.0.5', LocalPort: 49822, RemoteAddress: '20.42.65.90', RemotePort: 443, State: 'Established', OwningProcess: 2210 },
        { LocalAddress: '10.0.0.5', LocalPort: 49918, RemoteAddress: '40.114.12.7', RemotePort: 443, State: 'Established', OwningProcess: 412 }
      ]),
      'get-netipaddress': () => [{ InterfaceAlias: 'Ethernet0', IPAddress: '10.0.0.5', PrefixLength: 24, AddressFamily: 'IPv4' }, { InterfaceAlias: 'Loopback', IPAddress: '127.0.0.1', PrefixLength: 8, AddressFamily: 'IPv4' }],
      'get-netipconfiguration': () => 'InterfaceAlias       : Ethernet0\nIPv4Address          : 10.0.0.5\nIPv4DefaultGateway   : 10.0.0.9\nDNSServer            : 10.0.0.9',
      'get-netadapter': () => [{ Name: 'Ethernet0', Status: 'Up', MacAddress: '52-54-00-12-34-56', LinkSpeed: '1 Gbps' }],
      'get-netroute': () => [{ DestinationPrefix: '0.0.0.0/0', NextHop: '10.0.0.9', InterfaceAlias: 'Ethernet0', RouteMetric: 25 }],
      'get-netfirewallrule': () => [{ Name: 'OpenSSH-Server-In-TCP', Enabled: 'True', Direction: 'Inbound', Action: 'Allow' }, { Name: 'WINRM-HTTP-In-TCP', Enabled: 'False', Direction: 'Inbound', Action: 'Allow' }],
      'test-connection': (a) => { const h = a.find(x => !x.startsWith('-')) || '10.0.0.5'; return [{ Source: 'DEV-BOX', Destination: h, IPV4Address: '10.0.0.5', Bytes: 32, TimeMs: 1 }]; },
      'test-netconnection': (a) => { const h = a.find(x => !x.startsWith('-')) || 'api.internal'; const p = a[a.indexOf('-Port') + 1] || '443'; return 'ComputerName     : ' + h + '\nRemoteAddress    : 10.0.0.5\nRemotePort       : ' + p + '\nTcpTestSucceeded : True'; },
      'resolve-dnsname': (a) => [{ Name: a.find(x => !x.startsWith('-')) || 'api.internal', Type: 'A', TTL: 300, IPAddress: '10.0.0.5' }],
      'invoke-webrequest': (a) => {
        const u = a.find(x => !x.startsWith('-')) || 'https://example.internal';
        return ['StatusCode        : 200', 'StatusDescription : OK', 'Content           : {"status":"ok","service":"api"}', 'RawContentLength  : 31', '', 'Headers           : {[Content-Type, application/json]}', 'Uri               : ' + (/^http/.test(u) ? u : 'https://' + u)].join('\n');
      },
      'invoke-restmethod': () => [{ status: 'ok', service: 'api', version: '1.4.2' }],
      'get-computerinfo': () => ['WindowsProductName     : Windows 11 Pro', 'WindowsVersion         : 10.0.22631', 'CsName                 : DEV-BOX', 'CsNumberOfLogicalProcessors : 8', 'CsTotalPhysicalMemory  : 17179869184', 'OsArchitecture         : 64-bit'].join('\n'),
      'whoami': () => 'dev-box\\moundshroud',
      'hostname': () => 'DEV-BOX',
      'ipconfig': () => commands['get-netipconfiguration'](),
      'netstat': () => commands['get-nettcpconnection'](),
      'arp': () => 'Interface: 10.0.0.5 --- 0x2\n  10.0.0.9   52-54-00-12-34-56   dynamic',
      'tracert': (a) => 'Tracing route to ' + (a[0] || '10.0.0.5') + '\n  1   <1 ms   10.0.0.9\n  2    1 ms   ' + (a[0] || '10.0.0.5'),
      'clear-host': () => '',
      'exit-sandbox': () => '(sandbox stays open — use Reset to restore)',
      'reset': () => { tree = winTree(); cwd = ['C:', 'Users', 'moundshroud']; proc = seedProc(); services = seedServices(); return 'PowerShell sandbox reset'; },
      'help': (a) => G.formatHelp('powershell', a)
    };
    /* fill in every cmdlet this sandbox never defined (Get-Volume, Get-Date -Format, Test-NetConnection, …) */
    if (window.TerminalWindowsCommands) {
      window.TerminalWindowsCommands.install(commands, {
        shell: 'powershell', host: 'DEV-BOX', user: 'moundshroud', pwd: showPath,
        read: p => { const t = readFile(p); return t == null ? { err: p + ': not found' } : { text: t }; },
        write: (p, text, append) => {
          const prev = append ? (readFile(p) || '') : '';
          writeFile(p, prev ? prev.replace(/\n$/, '') + '\n' + text : text);
        },
        remove: p => { const parts = resolve(p); const parent = walk(parts.slice(0, -1)); if (parent) delete parent[parts[parts.length - 1]]; },
        list: p => { const n = walk(resolve(p)); if (n === undefined || typeof n !== 'object') return { err: true }; return { names: Object.keys(n), dirs: Object.keys(n).filter(k => n[k] && typeof n[k] === 'object') }; },
        mkdir: p => { const parts = resolve(p); let n = tree; for (const part of parts) { if (!n[part] || typeof n[part] !== 'object') n[part] = {}; n = n[part]; } return ''; },
        history: () => hist.slice()
      });
    }

    function applyPipe(value, seg) {
      const w = winTokens(seg);
      let cmd = (w.shift() || '').toLowerCase();
      cmd = aliases[cmd] || cmd;
      if (cmd === 'select-object') {
        const fi = w.findIndex(x => /^-first$/i.test(x)), li = w.findIndex(x => /^-last$/i.test(x));
        if (Array.isArray(value)) {
          let out = value;
          if (w.some(x => /^-unique$/i.test(x))) out = out.filter((v, i, arr) => arr.findIndex(y => JSON.stringify(y) === JSON.stringify(v)) === i);
          if (fi >= 0) out = out.slice(0, parseInt(w[fi + 1], 10) || 1);
          if (li >= 0) out = out.slice(-(parseInt(w[li + 1], 10) || 1));
          const props = w.filter((x, i) => !x.startsWith('-') && i !== fi + 1 && i !== li + 1).join(',').split(',').map(s => s.trim()).filter(Boolean);
          if (props.length) out = out.map(o => { const r = {}; for (const p of props) r[p] = o[p]; return r; });
          return out;
        }
        return value;
      }
      if (cmd === 'sort-object') {
        const desc = w.some(x => /^-desc/i.test(x));
        const prop = w.find(x => !x.startsWith('-')) || 'Name';
        if (Array.isArray(value)) return value.slice().sort((a, b) => {
          const av = a[prop], bv = b[prop];
          const cmp = (typeof av === 'number' && typeof bv === 'number') ? av - bv : String(av).localeCompare(String(bv), undefined, { numeric: true });
          return desc ? -cmp : cmp;
        });
        return value;
      }
      if (cmd === 'measure-object') {
        if (Array.isArray(value)) return table([{ Count: value.length }]);
        return table([{ Count: String(value).split('\n').length }]);
      }
      if (cmd === 'where-object') {
        const expr = w.join(' ').replace(/^\{|\}$/g, '').trim();
        const m = expr.match(/(?:\$_|\$PSItem|\$)\.(\w+)\s+(-eq|-ne|-gt|-lt|-ge|-le|-like|-notlike|-match|-notmatch|-contains)\s+['"]?(.*?)['"]?$/i);
        if (!m || !Array.isArray(value)) return value;
        const [, prop, opRaw, lit] = m;
        const op = opRaw.toLowerCase();
        return value.filter(o => {
          const rawV = o[prop], v = String(rawV == null ? '' : rawV), n1 = Number(rawV), n2 = Number(lit);
          if (op === '-eq') return v.toLowerCase() === lit.toLowerCase();
          if (op === '-ne') return v.toLowerCase() !== lit.toLowerCase();
          if (op === '-gt') return n1 > n2;
          if (op === '-lt') return n1 < n2;
          if (op === '-ge') return n1 >= n2;
          if (op === '-le') return n1 <= n2;
          if (op === '-like') return new RegExp('^' + lit.replace(/\*/g, '.*').replace(/\?/g, '.') + '$', 'i').test(v);
          if (op === '-notlike') return !new RegExp('^' + lit.replace(/\*/g, '.*').replace(/\?/g, '.') + '$', 'i').test(v);
          if (op === '-notmatch') return !new RegExp(lit, 'i').test(v);
          return new RegExp(lit, 'i').test(v);
        });
      }
      if (cmd === 'foreach-object') {
        const expr = w.join(' ').replace(/^\{|\}$/g, '').trim();
        const pm = expr.match(/(?:\$_|\$PSItem)\.(\w+)/);
        if (pm && Array.isArray(value)) return value.map(o => String(o[pm[1]] ?? '')).join('\n');
        return Array.isArray(value) ? table(value) : String(value ?? '');
      }
      if (cmd === 'format-table') return Array.isArray(value) ? table(value) : String(value ?? '');
      if (cmd === 'format-list') return Array.isArray(value) ? value.map(o => Object.entries(o).map(([k, v]) => k.padEnd(18) + ': ' + v).join('\n')).join('\n\n') : String(value ?? '');
      if (cmd === 'group-object') {
        const prop = w.find(x => !x.startsWith('-')) || 'Name';
        if (!Array.isArray(value)) return value;
        const m = new Map();
        for (const o of value) { const k = String(o[prop] ?? ''); m.set(k, (m.get(k) || 0) + 1); }
        return Array.from(m.entries()).map(([Name, Count]) => ({ Count, Name }));
      }
      if (cmd === 'convertto-json') return JSON.stringify(value, null, 2);
      if (cmd === 'convertfrom-json') { try { return JSON.parse(String(value)); } catch (e) { return 'ConvertFrom-Json : Invalid JSON'; } }
      if (cmd === 'convertto-csv') {
        if (!Array.isArray(value) || !value.length) return String(value ?? '');
        const cols = Object.keys(value[0]);
        return [cols.map(c => '"' + c + '"').join(',')].concat(value.map(o => cols.map(c => '"' + String(o[c] ?? '') + '"').join(','))).join('\n');
      }
      if (cmd === 'select-string') {
        const pat = w.find(x => !x.startsWith('-')) || '';
        const text = Array.isArray(value) ? table(value) : String(value ?? '');
        return text.split('\n').filter(l => new RegExp(pat, 'i').test(l)).join('\n');
      }
      if (cmd === 'out-file') { const f = w.find(x => !x.startsWith('-')); if (f) writeFile(f, Array.isArray(value) ? table(value) : String(value ?? '')); return ''; }
      if (cmd === 'tee-object') { const f = w.find(x => !x.startsWith('-')); if (f) writeFile(f, Array.isArray(value) ? table(value) : String(value ?? '')); return value; }
      if (cmd === 'out-string') return Array.isArray(value) ? table(value) : String(value ?? '');
      if (cmd === 'out-null') return '';
      if (cmd === 'get-member') {
        if (Array.isArray(value) && value.length) return table(Object.keys(value[0]).map(k => ({ Name: k, MemberType: 'NoteProperty' })));
        return 'TypeName: System.String';
      }
      return 'The term \'' + cmd + '\' is not recognized as a pipe target in this sandbox.';
    }

    function run(line) {
      const raw = String(line == null ? '' : line).trim();
      if (!raw) return '';
      hist.push(raw);
      if (/^\$([A-Za-z_]\w*)\s*=\s*([\s\S]+)$/.test(raw)) {
        const m = raw.match(/^\$([A-Za-z_]\w*)\s*=\s*([\s\S]+)$/);
        psVars[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
        return '';
      }
      if (/^\$([A-Za-z_]\w*)$/.test(raw)) {
        const k = raw.slice(1);
        return k in psVars ? String(psVars[k]) : '';
      }
      const segs = G.splitTop(raw, ['|']);
      let value;
      for (let i = 0; i < segs.length; i++) {
        if (i > 0) { value = applyPipe(value, segs[i]); continue; }
        const w = winTokens(segs[i]);
        let name = (w.shift() || '').toLowerCase();
        name = aliases[name] || name;
        const fn = commands[name];
        if (!fn) { value = 'The term \'' + name + '\' is not recognized as a name of a cmdlet in this sandbox. Try help.'; continue; }
        try { value = fn(w); } catch (e) { value = name + ' : ' + (e && e.message || e); }
      }
      if (Array.isArray(value)) return table(value);
      return value == null ? '' : String(value);
    }

    return {
      id: 'powershell', name: 'PowerShell', icon: '🪟', group: 'Windows',
      about: 'A PowerShell prompt on a simulated Windows box. Objects flow through the pipeline, so Select-Object, Sort-Object and Measure-Object do real work on real result sets.',
      prompt: () => 'PS ' + showPath() + '> ',
      cwdPath: showPath,
      rootPath: 'C:/Users/moundshroud',
      run,
      /* Every cmdlet this PowerShell answers to, and every short name it accepts for one, so the help window lists
         the whole shell even for cmdlets nobody wrote a page for. */
      commandNames: () => Object.keys(commands),
      commandAliases: () => aliases,
      autoAdded: 'This name runs in the sandbox because the Windows shells share one command kit; it is not one of the cmdlets PowerShell’s own reference documents. On a real Windows PC it may be a separate program rather than a cmdlet.',
      appCommands: {
        reset: 'reset is this sandbox’s own command: it puts the pretend Windows disk back the way it started. Real PowerShell has no reset command — close the window and open a new one instead.',
        'exit-sandbox': 'exit-sandbox belongs to this sandbox, not to PowerShell: it ends the simulated session instead of closing a real window.'
      },
      snapshot: () => ({ tree, cwd, proc, services, aliases, psVars, dirStack, execPolicy, hist: hist.slice(-250) }),
      restore: saved => {
        if (!saved.tree || !Array.isArray(saved.cwd)) return;
        ({ tree, cwd, proc, services, execPolicy } = saved);
        G.replaceSavedObject(aliases, saved.aliases);
        G.replaceSavedObject(psVars, saved.psVars);
        if (Array.isArray(saved.dirStack)) dirStack.push(...saved.dirStack);
        if (Array.isArray(saved.hist)) hist.push(...saved.hist);
      },
      commands: [
        ['Get-Location', 'print the current path'],
        ['Get-ChildItem', 'list the current directory as objects'],
        ['Get-ChildItem Documents', 'list another directory'],
        ['Set-Location Scripts', 'change directory'],
        ['Get-Content notes.txt', 'read a file'],
        ['Get-Content runbook.txt | Measure-Object', 'count the lines of a file'],
        ['Set-Content C:\\Users\\moundshroud\\todo.txt "patch Thursday"', 'write a file'],
        ['New-Item -ItemType Directory C:\\Users\\moundshroud\\lab', 'create a directory'],
        ['Test-Path notes.txt', 'check whether a path exists'],
        ['Copy-Item notes.txt notes.bak', 'copy a file'],
        ['Move-Item notes.bak archive.txt', 'move or rename a file'],
        ['Remove-Item archive.txt', 'delete a file'],
        ['Get-Process', 'list running processes'],
        ['Get-Process | Sort-Object CPU | Select-Object -First 3', 'object pipeline with sort and limit'],
        ['Get-Process chrome', 'filter processes by name'],
        ['Stop-Process 2210', 'end a process by id'],
        ['Get-Service', 'list Windows services'],
        ['Get-Command Get-*', 'discover available cmdlets'],
        ['Get-Help Get-ChildItem', 'show simulated help'],
        ['Write-Output "hello from PowerShell"', 'write to the pipeline'],
        ['Get-NetTCPConnection', 'list TCP connections and owning pids'],
        ['Invoke-WebRequest https://api.internal/health', 'make an HTTP request'],
        ['Get-ComputerInfo', 'host and OS information'],
        ['Get-Date', 'the date and time'],
        ['Get-Random -Minimum 1 -Maximum 7', 'a random number'],
        ['Start-Sleep -Seconds 1', 'wait a second'],
        ['Get-Host', 'the host and its version'],
        ['Get-ExecutionPolicy', 'which scripts may run'],
        ['Get-Module', 'loaded modules'],
        ['Get-Variable', 'the variables in this session'],
        ['Set-Variable -Name site -Value lab', 'make a variable'],
        ['Get-Alias', 'every short name'],
        ['Get-History', 'your commands'],
        ['Get-ChildItem -Recurse', 'the whole tree'],
        ['Get-ChildItem -Filter *.txt', 'only text files'],
        ['Get-Content notes.txt | Select-String patch', 'search inside a file'],
        ['Get-Item notes.txt', 'one item and its properties'],
        ['Resolve-Path notes.txt', 'the full path'],
        ['Get-FileHash notes.txt', 'a file checksum'],
        ['Compress-Archive notes.txt notes.zip', 'make a zip'],
        ['Get-Service | Where-Object Status -eq Running', 'only running services'],
        ['Get-Process | Measure-Object', 'how many processes'],
        ['Get-Process | Group-Object ProcessName', 'group them by name'],
        ['Get-CimInstance Win32_OperatingSystem', 'OS details'],
        ['Get-WmiObject Win32_LogicalDisk', 'disks, the old WMI way'],
        ['Get-WinEvent -MaxEvents 3 -LogName System', 'recent events'],
        ['Get-ScheduledTask', 'scheduled jobs'],
        ['Get-LocalUser', 'local accounts'],
        ['Get-Acl notes.txt', 'who may read it'],
        ['Get-Hotfix', 'installed updates'],
        ['Get-NetAdapter', 'network adapters'],
        ['Get-NetIPAddress', 'addresses'],
        ['Get-NetRoute', 'routes'],
        ['Get-NetFirewallRule', 'firewall rules'],
        ['Resolve-DnsName api.internal', 'a DNS lookup'],
        ['Test-NetConnection api.internal -Port 443', 'can this port be reached'],
        ['Test-Connection dev-box', 'ping from PowerShell'],
        ['Invoke-RestMethod https://api.internal/health', 'a parsed JSON answer'],
        ['Get-PSDrive', 'drives and free space'],
        ['Get-Volume', 'volumes'],
        ['Get-Disk', 'physical disks'],
        ['Get-Printer', 'printers'],
        ['Get-SmbShare', 'shared folders'],
        ['Get-Culture', 'language and region'],
        ['Get-TimeZone', 'the time zone'],
        ['Get-Uptime', 'how long the box has been up'],
        ['Write-Host "hello" -ForegroundColor Green', 'print in colour'],
        ['Write-Warning "careful"', 'a warning'],
        ['Write-Verbose "detail"', 'verbose output'],
        ['ConvertTo-Json "{a:1}"', 'a value as JSON'],
        ['Get-Command Get-Net*', 'cmdlets by wildcard'],
        ['Get-ChildItem | Sort-Object Name', 'sort the listing by name'],
        ['Get-ChildItem | Select-Object -Last 2', 'the last two entries'],
        ['Clear-Host', 'clear the screen'],
        ['Reset', 'restore the Windows sandbox']
      ].map(x => ({ ex: x[0], d: x[1] }))
    };
  };

  /* ================================================================ CMD */
  G.makeCmd = function () {
    let tree = winTree();
    let cwd = ['C:', 'Users', 'moundshroud'];
    const resolve = p => {
      if (!p) return cwd.slice();
      let raw = String(p).trim().replace(/\//g, '\\');
      const isAbs = /^[A-Za-z]:/.test(raw) || raw.startsWith('\\');
      const parts = isAbs ? ['C:'] : cwd.slice();
      const rest = raw.replace(/^[A-Za-z]:\\?/, '').replace(/^\\+/, '');
      for (const s of rest.split('\\')) {
        if (!s || s === '.') continue;
        if (s === '..') { if (parts.length > 1) parts.pop(); }
        else parts.push(s);
      }
      return parts;
    };
    const walkEntry = parts => {
      let n = tree;
      const canon = [];
      for (const s of parts) {
        if (!n || typeof n !== 'object') return { node: undefined, parts: canon };
        const key = s in n ? s : Object.keys(n).find(k => k.toLowerCase() === s.toLowerCase());
        if (key === undefined) return { node: undefined, parts: canon };
        canon.push(key);
        n = n[key];
      }
      return { node: n, parts: canon };
    };
    const walk = parts => walkEntry(parts).node;
    const showPath = () => 'C:\\' + cwd.slice(1).join('\\');
    const read = p => { const n = walk(resolve(p)); return typeof n === 'string' ? n : null; };
    const C = {};
    C.dir = a => {
      const target = a.find(x => !x.startsWith('/')) || '';
      const res = walkEntry(resolve(target));
      if (res.node === undefined) return 'File Not Found';
      if (typeof res.node !== 'object') return target;
      const n = res.node;
      // Like cmd: hidden (dot) names only with /a, . and .. below the drive root, real byte counts, files and folders counted apart.
      const all = a.some(x => /^\/a/i.test(x)), bare = a.some(x => /^\/b$/i.test(x));
      const names = Object.keys(n).sort((x, y) => x.toLowerCase().localeCompare(y.toLowerCase())).filter(k => all || k[0] !== '.');
      if (bare && a.some(x => /^\/s$/i.test(x))) {
        const rows = [], base = 'C:\\' + res.parts.slice(1).join('\\');
        const rec = (node, at) => Object.keys(node).sort().filter(k => all || k[0] !== '.').forEach(k => {
          rows.push(at + '\\' + k);
          if (typeof node[k] === 'object' && !('text' in node[k])) rec(node[k], at + '\\' + k);
        });
        rec(n, base.replace(/\\$/, ''));
        return rows.join('\n');
      }
      if (bare) return names.join('\n');
      const rows = [' Volume in drive C is OS', ' Volume Serial Number is 7C2A-91F4', '', ' Directory of C:\\' + res.parts.slice(1).join('\\'), ''];
      const size = value => new TextEncoder().encode(typeof value === 'string' ? value : String(value?.text ?? '')).length;
      const entries = (res.parts.length > 1 ? ['.', '..'] : []).map(k => [k, {}]).concat(names.map(k => [k, n[k]]));
      let files = 0, dirs = 0, bytes = 0;
      for (const [k, value] of entries) {
        const dir = typeof value === 'object' && !('text' in value);
        if (dir) dirs++; else { files++; bytes += size(value); }
        rows.push('02/12/2026  06:20 AM    ' + (dir ? '<DIR>          ' : size(value).toLocaleString('en-US').padStart(14) + ' ') + k);
      }
      rows.push('               ' + files + ' File(s)' + bytes.toLocaleString('en-US').padStart(15) + ' bytes',
        '               ' + dirs + ' Dir(s)  31,207,358,464 bytes free');
      return rows.join('\n');
    };
    C.cd = a => {
      const arg = a.filter(x => !/^\/d$/i.test(x)).join(' ').trim();
      if (!arg) return showPath();
      const res = walkEntry(resolve(arg));
      if (res.node === undefined) return 'The system cannot find the path specified.';
      if (typeof res.node !== 'object') return 'The directory name is invalid.';
      cwd = res.parts;
      return '';
    };
    C.chdir = C.cd;
    C.type = a => { const t = read(a[0] || ''); return t == null ? 'The system cannot find the file specified.' : t; };
    C.echo = a => a.join(' ');
    C.set = a => {
      if (!a.length) return ['ALLUSERSPROFILE=C:\\ProgramData', 'COMPUTERNAME=DEV-BOX', 'HOMEPATH=\\Users\\moundshroud', 'OS=Windows_NT', 'PROCESSOR_ARCHITECTURE=AMD64', 'USERNAME=moundshroud'].join('\n');
      return '';
    };
    C.mkdir = a => { const parts = resolve(a[0] || ''); if (!parts.length) return 'The syntax of the command is incorrect.'; let n = tree; for (let i = 0; i < parts.length - 1; i++) { if (!n[parts[i]]) n[parts[i]] = {}; n = n[parts[i]]; } n[parts[parts.length - 1]] = {}; return ''; };
    C.md = C.mkdir;
    C.rmdir = a => { const parts = resolve(a[0] || ''); const p = walk(parts.slice(0, -1)); if (!p) return 'The system cannot find the file specified.'; delete p[parts[parts.length - 1]]; return ''; };
    C.rd = C.rmdir;
    C.del = a => { const parts = resolve(a[0] || ''); const p = walk(parts.slice(0, -1)); if (!p || !(parts[parts.length - 1] in p)) return 'Could Not Find ' + (a[0] || ''); delete p[parts[parts.length - 1]]; return ''; };
    C.copy = a => { const t = read(a[0] || ''); if (t == null) return 'The system cannot find the file specified.'; const parts = resolve(a[1] || ''); let n = tree; for (let i = 0; i < parts.length - 1; i++) { if (!n[parts[i]]) n[parts[i]] = {}; n = n[parts[i]]; } n[parts[parts.length - 1]] = t; return '        1 file(s) copied.'; };
    C.move = a => { const t = read(a[0] || ''); if (t == null) return 'The system cannot find the file specified.'; const src = resolve(a[0] || ''); const sp = walk(src.slice(0, -1)); if (sp) delete sp[src[src.length - 1]]; const parts = resolve(a[1] || ''); let n = tree; for (let i = 0; i < parts.length - 1; i++) { if (!n[parts[i]]) n[parts[i]] = {}; n = n[parts[i]]; } n[parts[parts.length - 1]] = t; return '        1 file(s) moved.'; };
    C.ren = a => C.move(a);
    C.rename = C.ren;
    C.erase = C.del;
    C.xcopy = C.copy;
    C.robocopy = a => 'ROBOCOPY     :: Robust File Copy for Windows (sandbox)\n  Copied ' + (a[0] || '.') + ' -> ' + (a[1] || 'dest');
    const cmdEnv = { ALLUSERSPROFILE: 'C:\\ProgramData', COMPUTERNAME: 'DEV-BOX', HOMEPATH: '\\Users\\moundshroud', OS: 'Windows_NT', PATH: 'C:\\Windows\\System32;C:\\Windows', PROCESSOR_ARCHITECTURE: 'AMD64', USERNAME: 'moundshroud' };
    const cmdStack = [];
    const cmdWrite = (p, text, append) => {
      const parts = resolve(p);
      let n = tree;
      for (let i = 0; i < parts.length - 1; i++) { if (!n[parts[i]]) n[parts[i]] = {}; n = n[parts[i]]; }
      const k = parts[parts.length - 1];
      n[k] = append && typeof n[k] === 'string' ? n[k] + '\n' + text : text;
    };
    C.set = a => {
      if (!a.length) return Object.entries(cmdEnv).map(([k, v]) => k + '=' + v).join('\n');
      const expr = a.join(' ');
      const i = expr.indexOf('=');
      if (i > 0) { cmdEnv[expr.slice(0, i).trim()] = expr.slice(i + 1).trim(); return ''; }
      const pre = expr.toUpperCase();
      return Object.entries(cmdEnv).filter(([k]) => k.toUpperCase().startsWith(pre)).map(([k, v]) => k + '=' + v).join('\n') || 'Environment variable ' + expr + ' not defined';
    };
    C.setx = a => { if (a[0]) cmdEnv[a[0]] = a.slice(1).join(' '); return 'SUCCESS: Specified value was saved.'; };
    C.path = () => 'PATH=' + cmdEnv.PATH;
    C.find = (a, stdin) => {
      const ci = a.some(x => /^\/i$/i.test(x)), cnt = a.some(x => /^\/c$/i.test(x));
      const pos = a.filter(x => !x.startsWith('/'));
      const text = pos[0] || '';
      const file = pos[1];
      const t = file ? read(file) : stdin;
      if (t == null) return 'File not found - ' + (file || '');
      const hits = t.split('\n').filter(l => ci ? l.toLowerCase().includes(text.toLowerCase()) : l.includes(text));
      if (cnt) return (file ? '---------- ' + file.toUpperCase() + ': ' : '') + hits.length;
      return (file ? '---------- ' + file.toUpperCase() + '\n' : '') + hits.join('\n');
    };
    C.findstr = (a, stdin) => {
      const pos = a.filter(x => !x.startsWith('/'));
      const pat = pos[0] || '';
      const file = pos[1];
      const t = file ? read(file) : stdin;
      if (t == null) return 'FINDSTR: Cannot open ' + (file || '');
      return t.split('\n').filter(l => new RegExp(pat, 'i').test(l)).map((l, i) => (i + 1) + ':' + l).join('\n');
    };
    C.more = (a, stdin) => { const t = a[0] ? read(a[0]) : stdin; return t == null ? 'Cannot access file' : '-- More --\n' + t; };
    C.tree = a => {
      const target = a.find(x => !x.startsWith('/'));
      const parts = resolve(target || '');
      const n = walk(parts);
      if (!n || typeof n !== 'object') return 'Invalid path - ' + (target ? target.toUpperCase() : showPath());
      return winTreeListing(n, 'C:\\' + parts.slice(1).join('\\'), a);
    };
    C.ipconfig = () => ['', 'Windows IP Configuration', '', 'Ethernet adapter Ethernet0:', '',
      '   Connection-specific DNS Suffix  . : internal', '   IPv4 Address. . . . . . . . . . . : 10.0.0.5', '   Subnet Mask . . . . . . . . . . . : 255.255.255.0', '   Default Gateway . . . . . . . . . : 10.0.0.9'].join('\n');
    C.ping = a => {
      const h = a.find(x => !x.startsWith('-')) || 'localhost';
      return ['', 'Pinging ' + h + ' [10.0.0.5] with 32 bytes of data:', 'Reply from 10.0.0.5: bytes=32 time<1ms TTL=128', 'Reply from 10.0.0.5: bytes=32 time<1ms TTL=128', '',
        'Ping statistics for 10.0.0.5:', '    Packets: Sent = 2, Received = 2, Lost = 0 (0% loss),',
        'Approximate round trip times in milli-seconds:', '    Minimum = 0ms, Maximum = 0ms, Average = 0ms'].join('\n');
    };
    C.netstat = () => ['', 'Active Connections', '', '  Proto  Local Address          Foreign Address        State           PID',
      '  TCP    0.0.0.0:22             0.0.0.0:0              LISTENING       3110',
      '  TCP    10.0.0.5:49822         20.42.65.90:443        ESTABLISHED     2210',
      '  TCP    10.0.0.5:49918         40.114.12.7:443        ESTABLISHED     412'].join('\n');
    const procRows = () => [
      { ImageName: 'explorer.exe', PID: 412, SessionName: 'Console', MemUsage: '86,144 K' },
      { ImageName: 'powershell.exe', PID: 1204, SessionName: 'Console', MemUsage: '60,700 K' },
      { ImageName: 'chrome.exe', PID: 2210, SessionName: 'Console', MemUsage: '500,000 K' },
      { ImageName: 'sshd.exe', PID: 3110, SessionName: 'Services', MemUsage: '12,000 K' }
    ];
    C.tasklist = () => table(procRows());
    C.taskkill = a => {
      const i = a.findIndex(x => /^\/pid$/i.test(x));
      const pid = i >= 0 ? a[i + 1] : (a.find(x => /^\d+$/.test(x)) || '');
      return pid ? 'SUCCESS: Sent termination signal to the process with PID ' + pid + '.' : 'ERROR: Invalid syntax. Use TASKKILL /PID <pid>.';
    };
    C.systeminfo = () => ['Host Name:                 DEV-BOX', 'OS Name:                   Microsoft Windows 11 Pro', 'OS Version:                10.0.22631 N/A Build 22631',
      'System Manufacturer:       QEMU', 'Processor(s):              1 processor(s) installed', 'Total Physical Memory:     16,384 MB', 'Available Physical Memory: 9,840 MB'].join('\n');
    C.whoami = () => 'dev-box\\moundshroud';
    C.where = a => a.map(x => 'C:\\Windows\\System32\\' + x + '.exe').join('\n');
    C.sort = (a, stdin) => {
      const rev = a.some(x => /^\/r$/i.test(x));
      const f = a.find(x => !x.startsWith('/'));
      const t = f ? read(f) : stdin;
      if (t == null) return 'The system cannot find the file specified.';
      const ls2 = t.split('\n').sort();
      return (rev ? ls2.reverse() : ls2).join('\n');
    };
    C.attrib = a => { const f = a.find(x => !x.startsWith('+') && !x.startsWith('-') && !x.startsWith('/')) || 'notes.txt'; return 'A            ' + showPath() + '\\' + f; };
    C.fc = a => { const pos = a.filter(x => !x.startsWith('/')); const t1 = read(pos[0] || ''), t2 = read(pos[1] || ''); if (t1 == null || t2 == null) return 'FC: cannot open file'; return t1 === t2 ? 'FC: no differences encountered' : 'Comparing files ' + pos[0] + ' and ' + pos[1] + '\n***** ' + pos[0] + '\n' + t1 + '\n***** ' + pos[1] + '\n' + t2; };
    C.comp = C.fc;
    C.pushd = a => { cmdStack.push(cwd.slice()); return a[0] ? C.cd(a) : showPath(); };
    C.popd = () => { if (cmdStack.length) cwd = cmdStack.pop(); return ''; };
    C.vol = () => ' Volume in drive C is OS\n Volume Serial Number is 7C2A-91F4';
    C.label = () => 'Volume in drive C: is OS';
    C.ver = () => '\nMicrosoft Windows [Version 10.0.22631.3155]';
    C.date = () => 'The current date is: Thu 02/12/2026';
    C.time = () => 'The current time is: 06:58:12.40';
    C.hostname = () => 'DEV-BOX';
    C.title = () => '';
    C.color = () => '';
    C.prompt = () => '';
    C.doskey = () => 'DOSKEY: command history active (use ↑ / ↓ keys)';
    C.timeout = () => 'Waiting for 0 seconds, press a key to continue ...';
    C.pause = () => 'Press any key to continue . . .';
    C.rem = () => '';
    C.call = a => a.length ? run(a.join(' ')) : '';
    C.start = a => '(started ' + (a.join(' ') || 'cmd.exe') + ' in sandbox)';
    C.clip = (a, stdin) => stdin ? '(copied ' + stdin.length + ' chars to sandbox clipboard)' : '(pipe text into clip)';
    C.assoc = () => '.txt=txtfile\n.ps1=Microsoft.PowerShellScript.1\n.bat=batfile\n.exe=exefile';
    C.ftype = () => 'txtfile=%SystemRoot%\\system32\\NOTEPAD.EXE %1\nbatfile="%1" %*';
    C.mklink = a => 'symbolic link created for ' + (a[0] || 'link') + ' <<===>> ' + (a[1] || 'target');
    C.subst = () => 'Z:\\: => C:\\Users\\moundshroud';
    C.fsutil = () => 'NTFS Volume Serial Number : 0x7c2a91f4\nTotal # of bytes          : 42,949,672,960';
    C.chkdsk = () => 'The type of the file system is NTFS.\nWindows has scanned the file system and found no problems.';
    C.diskpart = () => 'Microsoft DiskPart version 10.0.22631 (sandbox — read-only)\n  Disk 0    Online    40 GB';
    C.format = () => 'Access denied: formatting is disabled in the training sandbox.';
    C.certutil = a => {
      const sub = (a[0] || '').toLowerCase();
      if (sub === '-hashfile') {
        const f = a[1] || 'notes.txt', t = read(f);
        if (t == null) return 'CertUtil: -hashfile command FAILED: file not found';
        let h = 0x811c9dc5, hex = '';
        for (let i = 0; i < t.length; i++) h = Math.imul(h ^ t.charCodeAt(i), 0x01000193) >>> 0;
        while (hex.length < 64) { h = (Math.imul(h ^ (h >>> 15), 0x2c1b3c6d) + 0x297a2d39) >>> 0; hex += h.toString(16).padStart(8, '0'); }
        return (a[2] || 'SHA256') + ' hash of ' + f + ':\n' + hex.slice(0, 64) + '\nCertUtil: -hashfile command completed successfully.';
      }
      if (sub === '-encode' && a[1] && a[2]) { const t = read(a[1]); if (t == null) return 'File not found'; const b64 = typeof btoa === 'function' ? btoa(t) : Buffer.from(t).toString('base64'); cmdWrite(a[2], '-----BEGIN CERTIFICATE-----\n' + b64 + '\n-----END CERTIFICATE-----', false); return 'CertUtil: -encode command completed successfully.'; }
      if (sub === '-decode' && a[1] && a[2]) { const t = read(a[1]); if (t == null) return 'File not found'; const clean = t.replace(/-----[^-]+-----/g, '').replace(/\s+/g, ''); const dec = typeof atob === 'function' ? atob(clean) : Buffer.from(clean, 'base64').toString('utf8'); cmdWrite(a[2], dec, false); return 'CertUtil: -decode command completed successfully.'; }
      return 'CertUtil: use certutil -hashfile <file> SHA256 | -encode <in> <out> | -decode <in> <out>';
    };
    C.wmic = a => 'Node: DEV-BOX · WMIC query (' + (a.join(' ') || 'os get caption,version') + ')\nCaption=Microsoft Windows 11 Pro   Version=10.0.22631';
    C.sc = a => 'SERVICE_NAME: ' + (a[1] || 'WinDefend') + '\n        STATE              : 4  RUNNING';
    C.schtasks = () => 'TaskName                                 Next Run Time          Status\n======================================== ====================== ===============\n\\NightlyBackup                           2/13/2026 3:00:00 AM   Ready';
    C.reg = a => 'HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\n    ProductName    REG_SZ    Windows 11 Pro\n    CurrentBuild   REG_SZ    22631';
    C.net = a => {
      const sub = (a[0] || '').toLowerCase();
      if (sub === 'user') return 'User accounts for \\\\DEV-BOX\n-------------------------------------------------------------------------------\nAdministrator            moundshroud                      Guest\nThe command completed successfully.';
      if (sub === 'localgroup') return 'Aliases for \\\\DEV-BOX\n-------------------------------------------------------------------------------\n*Administrators\n*Remote Desktop Users\n*Users';
      if (sub === 'start') return 'These Windows services are started:\n   DHCP Client\n   DNS Client\n   Microsoft Defender Antivirus Service';
      if (sub === 'share') return 'Share name   Resource                        Remark\nC$           C:\\                             Default share\nIPC$                                         Remote IPC';
      return 'The syntax of this command is: NET [ USER | LOCALGROUP | START | STOP | SHARE | VIEW ]';
    };
    C.netsh = a => 'netsh (' + (a.join(' ') || 'interface ip show config') + '): Ethernet0 IP 10.0.0.5/24 Gateway 10.0.0.9';
    C.gpresult = () => 'RSOP data for DEV-BOX\\moundshroud on DEV-BOX : Logging Mode\n  Applied Group Policy Objects: Local Group Policy';
    C.icacls = a => (a[0] || 'notes.txt') + ' DEV-BOX\\moundshroud:(F)\n          NT AUTHORITY\\SYSTEM:(F)\nSuccessfully processed 1 files.';
    C.cacls = C.icacls;
    C.takeown = a => 'SUCCESS: The file (or folder): "' + (a[a.length - 1] || 'notes.txt') + '" now owned by user "DEV-BOX\\moundshroud".';
    C.cipher = () => ' Listing ' + showPath() + '\\\nU notes.txt\nU profile.ps1';
    C.driverquery = () => 'Module Name  Display Name           Driver Type   Link Date\n============ ====================== ============= ==========\nntfs         NTFS                   File System   2026-01-14\ntcpip        TCP/IP Protocol Driver Kernel        2026-01-14';
    C.powercfg = () => 'Existing Power Schemes (* Active)\nGUID: 381b4222-f694-41f0-9685-ff5bb260df2e  (Balanced) *';
    C.bcdedit = () => 'Windows Boot Manager (sandbox read-only)\nidentifier              {bootmgr}\ndescription             Windows Boot Manager';
    C.sfc = () => 'Windows Resource Protection did not find any integrity violations.';
    C.dism = () => 'Deployment Image Servicing and Management tool (sandbox)\nNo component store corruption detected.';
    C.shutdown = () => 'Sandbox notice: shutdown is simulated — virtual host stays running.';
    C.tracert = a => 'Tracing route to ' + (a.find(x => !x.startsWith('-')) || '10.0.0.5') + ' over a maximum of 30 hops:\n  1    <1 ms    <1 ms    <1 ms  10.0.0.9\n  2     1 ms     1 ms     1 ms  10.0.0.5\nTrace complete.';
    C.pathping = C.tracert;
    C.nslookup = a => 'Server:  dns.internal\nAddress:  10.0.0.9\n\nName:    ' + (a[0] || 'api.internal') + '\nAddress:  10.0.0.5';
    C.arp = () => '\nInterface: 10.0.0.5 --- 0x2\n  Internet Address      Physical Address      Type\n  10.0.0.9              52-54-00-12-34-56     dynamic';
    C.route = () => 'IPv4 Route Table\nNetwork Destination        Netmask          Gateway       Interface\n          0.0.0.0          0.0.0.0         10.0.0.9        10.0.0.5';
    C.nbtstat = () => 'Ethernet0:\nNode IpAddress: [10.0.0.5] Scope Id: []\n    DEV-BOX        <00>  UNIQUE      Registered';
    C.getmac = () => 'Physical Address    Transport Name\n=================== ==========================================================\n52-54-00-12-34-56   \\Device\\Tcpip_{A1B2C3D4}';
    C.telnet = a => 'Connecting To ' + (a[0] || '10.0.0.5') + '... (simulated)';
    C.ftp = a => 'Connected to ' + (a[0] || '10.0.0.5') + '. (simulated)';
    C.curl = a => '{"status":"ok","service":"api","url":"' + (a.find(x => !x.startsWith('-')) || 'https://api.internal/health') + '"}';
    C.ssh = a => 'Connected to ' + (a[0] || 'moundshroud@10.0.0.5') + ' (simulated SSH).';
    C.winget = a => 'Windows Package Manager v1.7 (sandbox) — ' + (a.join(' ') || 'list');
    C.cmd = () => C.ver();
    C.exit = () => '(sandbox stays open — use reset to restore)';
    C.clear = () => '';
    C.cls = () => '';
    C.help = a => G.formatHelp('cmd', a);
    C.reset = () => { tree = winTree(); cwd = ['C:', 'Users', 'moundshroud']; return 'cmd sandbox reset'; };
    /* the rest of cmd.exe that this sandbox never had (net, sc, reg, wevtutil, more PowerShell-era tools, …) */
    if (window.TerminalWindowsCommands) {
      window.TerminalWindowsCommands.install(C, {
        shell: 'cmd', host: 'DEV-BOX', user: 'moundshroud', pwd: showPath,
        read: p => { const t = read(p); return t == null ? { err: p + ': not found' } : { text: t }; },
        write: (p, text, append) => cmdWrite(p, text, append),
        remove: p => { const parts = resolve(p); const parent = walk(parts.slice(0, -1)); if (parent) delete parent[parts[parts.length - 1]]; },
        list: p => { const n = walk(resolve(p)); if (!n || typeof n !== 'object') return { err: true }; return { names: Object.keys(n), dirs: Object.keys(n).filter(k => n[k] && typeof n[k] === 'object') }; },
        mkdir: p => { const parts = resolve(p); let n = tree; for (const part of parts) { if (!n[part] || typeof n[part] !== 'object') n[part] = {}; n = n[part]; } return ''; },
        history: () => []
      });
    }

    function run(line) {
      const raw = String(line == null ? '' : line).trim();
      if (!raw) return '';
      const outs = [];
      for (let chain of G.splitTop(raw, ['&&', '&'])) {
        let redirect = null;
        const rm = chain.match(/(>>?)\s*(\S+)\s*$/);
        if (rm) { redirect = { append: rm[1] === '>>', file: rm[2] }; chain = chain.slice(0, rm.index).trim(); }
        let stdin = null, out = '';
        for (const seg of G.splitTop(chain, ['|'])) {
          const w = winTokens(seg);
          const name = (w.shift() || '').toLowerCase();
          if (!name) continue;
          const fn = C[name];
          if (!fn) { out = '\'' + name + '\' is not recognized as an internal or external command, operable program or batch file.'; break; }
          try { out = fn(w, stdin); } catch (e) { out = name + ': ' + (e && e.message || e); }
          stdin = out;
        }
        if (redirect) { cmdWrite(redirect.file, out, redirect.append); out = ''; }
        if (out !== '') outs.push(out);
      }
      return outs.join('\n');
    }
    return {
      id: 'cmd', name: 'Command Prompt', icon: '⌨️', group: 'Windows',
      about: 'The old Windows command prompt on a simulated disk: dir, type, findstr, tasklist, netstat and the rest of the batch-era toolbox.',
      prompt: () => showPath() + '>',
      cwdPath: showPath,
      rootPath: 'C:/Users/moundshroud',
      run,
      /* the batch-era names this prompt answers to, including the older spellings of its own commands */
      commandNames: () => Object.keys(C),
      commandAliases: () => ({
        chdir: 'cd', md: 'mkdir', rd: 'rmdir', ren: 'rename', erase: 'del', xcopy: 'copy'
      }),
      autoAdded: 'This name runs in the sandbox because the Windows shells share one command kit; it is not a command Command Prompt’s own reference documents. Most of them are PowerShell cmdlets, which this cmd prompt also accepts.',
      appCommands: {
        reset: 'reset is this sandbox’s own command: it restores the pretend C: drive. Command Prompt has no reset command.'
      },
      snapshot: () => ({ tree, cwd, cmdEnv, cmdStack }),
      restore: saved => {
        if (!saved.tree || !Array.isArray(saved.cwd)) return;
        ({ tree, cwd } = saved);
        G.replaceSavedObject(cmdEnv, saved.cmdEnv);
        if (Array.isArray(saved.cmdStack)) cmdStack.push(...saved.cmdStack);
      },
      commands: [
        ['dir', 'list the current directory'],
        ['dir Documents', 'list another directory'],
        ['cd Scripts', 'change directory'],
        ['type notes.txt', 'print a file'],
        ['copy notes.txt notes.bak', 'copy a file'],
        ['move notes.bak archive.txt', 'move or rename'],
        ['ren archive.txt hero.txt', 'rename a file'],
        ['del hero.txt', 'delete a file'],
        ['mkdir C:\\Users\\moundshroud\\lab', 'create a directory'],
        ['rmdir C:\\Users\\moundshroud\\lab', 'remove a directory'],
        ['tree', 'draw the directory tree'],
        ['find "patch" notes.txt', 'search inside a file'],
        ['findstr ship todo.txt', 'regex search a file'],
        ['more runbook.txt', 'page through a file'],
        ['ipconfig', 'network configuration'],
        ['ping dev-box', 'reachability test'],
        ['netstat', 'open connections with pids'],
        ['tasklist', 'running processes'],
        ['taskkill /PID 2210', 'end a process'],
        ['systeminfo', 'host and OS details'],
        ['whoami', 'current account'],
        ['where notepad', 'locate an executable'],
        ['set', 'environment variables'],
        ['cls', 'clear the screen'],
        ['dir /a', 'everything, including hidden files'],
        ['dir /s', 'every subfolder too'],
        ['cd ..', 'go up one folder'],
        ['copy notes.txt notes.bak', 'copy a file'],
        ['xcopy Scripts C:\\Backup\\Scripts /E', 'copy a whole folder'],
        ['robocopy Scripts C:\\Backup\\Scripts /E', 'the newer copy tool'],
        ['attrib notes.txt', 'file attributes'],
        ['icacls notes.txt', 'who may read the file'],
        ['fc notes.txt notes.txt', 'compare two files'],
        ['findstr /i ship runbook.txt', 'search ignoring case'],
        ['sort runbook.txt', 'sort the lines'],
        ['where cmd', 'locate a program'],
        ['set SITE=lab', 'make an environment variable'],
        ['path', 'the search path'],
        ['title My Terminal', 'name the window'],
        ['color 0A', 'change the colours'],
        ['ver', 'the Windows version'],
        ['vol', 'volume label and serial'],
        ['hostname', 'the computer name'],
        ['whoami /groups', 'your groups'],
        ['systeminfo', 'host, OS and memory details'],
        ['tasklist /v', 'processes with windows and memory'],
        ['ping -n 2 dev-box', 'two pings'],
        ['ipconfig /all', 'every adapter in detail'],
        ['netstat -ano', 'sockets with process ids'],
        ['arp -a', 'the neighbour cache'],
        ['route print', 'the routing table'],
        ['tracert dev-box', 'the path to a host'],
        ['nslookup dev-box', 'a DNS lookup'],
        ['getmac', 'MAC addresses'],
        ['net user', 'local accounts'],
        ['net share', 'shared folders'],
        ['sc query', 'services and their state'],
        ['schtasks', 'scheduled tasks'],
        ['reg query HKLM\\Software', 'read the registry'],
        ['driverquery', 'loaded drivers'],
        ['doskey /history', 'your commands'],
        ['mklink link.txt notes.txt', 'make a shortcut'],
        ['subst X: C:\\Users', 'a drive letter for a folder'],
        ['assoc .txt', 'what opens .txt files'],
        ['ftype txtfile', 'the command for .txt files'],
        ['clip < notes.txt', 'copy a file to the clipboard'],
        ['timeout /t 1', 'wait a second'],
        ['certutil -hashfile notes.txt MD5', 'a file checksum'],
        ['wevtutil el', 'the event logs'],
        ['gpresult /r', 'applied group policy'],
        ['powercfg /batteryreport', 'a battery report'],
        ['help', 'every command this sandbox supports'],
        ['reset', 'restore the Windows sandbox']
      ].map(x => ({ ex: x[0], d: x[1] }))
    };
  };

  /* ================================================================ PYTHON */
  G.makePython = function () {
    const vars = {};
    const hist = [];
    const pyHash = (algo, s) => {
      const text = String(s == null ? '' : s);
      let h1 = 0x811c9dc5, h2 = 0x9e3779b9, out = '';
      for (let i = 0; i < text.length; i++) {
        h1 = Math.imul(h1 ^ (text.charCodeAt(i) + algo.charCodeAt(i % algo.length)), 0x01000193) >>> 0;
        h2 = Math.imul(h2 ^ (text.charCodeAt(i) + i), 0x85ebca6b) >>> 0;
      }
      let seed = (h1 ^ h2) >>> 0;
      const len = algo === 'md5' ? 32 : algo === 'sha1' ? 40 : algo === 'sha512' ? 128 : 64;
      while (out.length < len) { seed = (Math.imul(seed ^ (seed >>> 15), 0x2c1b3c6d) + 0x297a2d39) >>> 0; out += seed.toString(16).padStart(8, '0'); }
      return out.slice(0, len);
    };
    const b64e = s => (typeof btoa === 'function' ? btoa(String(s)) : Buffer.from(String(s), 'utf8').toString('base64'));
    const b64d = s => (typeof atob === 'function' ? atob(String(s)) : Buffer.from(String(s), 'base64').toString('utf8'));
    const pyRepeat = (a, b) => {
      const n = Math.max(0, (typeof b === 'number' ? b : a) | 0);
      if (Array.isArray(a) && typeof b === 'number') { if (n > 10000 || a.length * n > 20000) throw new Error('MemoryError: sandbox repetition cap exceeded'); const r = []; for (let i = 0; i < n; i++) r.push(...a); return r; }
      if (typeof a === 'number' && Array.isArray(b)) return pyRepeat(b, a);
      if (typeof a === 'string' && typeof b === 'number') { if (n > 50000 || a.length * n > 50000) throw new Error('MemoryError: sandbox string cap exceeded'); return a.repeat(n); }
      if (typeof a === 'number' && typeof b === 'string') return pyRepeat(b, a);
      return a * b;
    };
    const MODS = {
      math: { pi: Math.PI, e: Math.E, tau: Math.PI * 2, inf: Infinity, nan: NaN, sqrt: Math.sqrt, floor: Math.floor, ceil: Math.ceil, pow: Math.pow, log: Math.log, log2: Math.log2, log10: Math.log10, exp: Math.exp, sin: Math.sin, cos: Math.cos, tan: Math.tan, fabs: Math.abs, factorial: n => { let r = 1; for (let i = 2; i <= n; i++) r *= i; return r; }, gcd: (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) [a, b] = [b, a % b]; return a; } },
      json: { dumps: (x, indent) => JSON.stringify(x, null, indent), loads: s => JSON.parse(s) },
      os: { name: 'posix', getcwd: () => '/home/moundshroud', listdir: () => ['README.md', 'notes.txt', 'projects'], environ: { USER: 'moundshroud', HOME: '/home/moundshroud', SHELL: '/bin/bash' }, path: { join: (...a) => a.join('/'), basename: p => String(p).split('/').pop(), dirname: p => String(p).split('/').slice(0, -1).join('/') || '/', exists: () => true } },
      sys: { version: '3.12.2 (sandbox)', platform: 'linux', argv: ['python3'], maxsize: 9007199254740991 },
      re: { search: (p, s) => { const m = new RegExp(p).exec(s); return m ? m[0] : null; }, findall: (p, s) => String(s).match(new RegExp(p, 'g')) || [], sub: (p, r, s) => String(s).replace(new RegExp(p, 'g'), r), split: (p, s) => String(s).split(new RegExp(p)) },
      random: { random: () => Math.random(), randint: (a, b) => Math.floor(Math.random() * (b - a + 1)) + a, choice: a => a[Math.floor(Math.random() * a.length)], shuffle: a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; } },
      time: { time: () => Math.floor(Date.now() / 1000), sleep: () => null, ctime: () => new Date().toUTCString() },
      datetime: { datetime: { now: () => new Date().toISOString().replace('T', ' ').slice(0, 19), utcnow: () => new Date().toISOString() }, date: { today: () => new Date().toISOString().slice(0, 10) } },
      base64: { b64encode: b64e, b64decode: b64d, urlsafe_b64encode: s => b64e(s).replace(/\+/g, '-').replace(/\//g, '_'), urlsafe_b64decode: s => b64d(String(s).replace(/-/g, '+').replace(/_/g, '/')) },
      hashlib: { md5: s => ({ hexdigest: () => pyHash('md5', s) }), sha1: s => ({ hexdigest: () => pyHash('sha1', s) }), sha256: s => ({ hexdigest: () => pyHash('sha256', s) }), sha512: s => ({ hexdigest: () => pyHash('sha512', s) }) },
      string: { ascii_lowercase: 'abcdefghijklmnopqrstuvwxyz', ascii_uppercase: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', ascii_letters: 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ', digits: '0123456789', hexdigits: '0123456789abcdefABCDEF', punctuation: '!"#$%&\'()*+,-./:;<=>?@[\\]^_`{|}~' },
      statistics: { mean: a => a.reduce((x, y) => x + y, 0) / a.length, median: a => { const s = a.slice().sort((x, y) => x - y); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; } },
      secrets: { token_hex: (n = 16) => Array.from({ length: n }, () => Math.floor(Math.random() * 256).toString(16).padStart(2, '0')).join(''), token_urlsafe: (n = 16) => b64e(Array.from({ length: n }, () => String.fromCharCode(65 + Math.floor(Math.random() * 26))).join('')).replace(/=+$/, '') },
      uuid: { uuid4: () => 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16); }) },
      collections: { Counter: a => { const m = {}; for (const x of a) m[x] = (m[x] || 0) + 1; return m; } },
      itertools: { chain: (...a) => a.flat(), repeat: (x, n = 3) => Array(n).fill(x) },
      functools: { reduce: (fn, a, init) => init !== undefined ? a.reduce(fn, init) : a.reduce(fn) },
      urllib: { parse: { quote: encodeURIComponent, unquote: decodeURIComponent } },
      pathlib: { Path: p => ({ name: String(p).split('/').pop(), suffix: '.' + String(p).split('.').pop(), toString: () => String(p) }) },
      socket: { gethostname: () => 'dev-box', gethostbyname: () => '10.0.0.5' },
      binascii: { hexlify: s => [...String(s)].map(c => c.charCodeAt(0).toString(16).padStart(2, '0')).join(''), unhexlify: h => { const c = String(h).replace(/[^0-9a-f]/gi, ''); let o = ''; for (let i = 0; i + 1 < c.length; i += 2) o += String.fromCharCode(parseInt(c.slice(i, i + 2), 16)); return o; } },
      zlib: { crc32: s => parseInt(pyHash('md5', s).slice(0, 8), 16) },
      codecs: { encode: (s, enc) => enc === 'rot_13' ? [...String(s)].map(c => /[a-z]/i.test(c) ? String.fromCharCode((c <= 'Z' ? 65 : 97) + (c.charCodeAt(0) - (c <= 'Z' ? 65 : 97) + 13) % 26) : c).join('') : String(s) }
    };
    /* a tiny pretend disk, so open() and the csv module have something to read */
    const pyFiles = { 'notes.txt': 'alpha,1\nbravo,2\ncharlie,3\n', 'README.md': '# python sandbox\n' };
    /* the standard-library modules this interpreter answers; every name here can be imported by name */
    Object.assign(MODS, {
      heapq: {
        heapify: a => { a.sort((x, y) => x - y); return null; },
        heappush: (a, x) => { a.push(x); a.sort((x, y) => x - y); return null; },
        heappop: a => { a.sort((x, y) => x - y); return a.shift(); },
        nlargest: (n, a) => a.slice().sort((x, y) => y - x).slice(0, n),
        nsmallest: (n, a) => a.slice().sort((x, y) => x - y).slice(0, n)
      },
      bisect: {
        bisect_left: (a, x) => a.filter(v => v < x).length,
        bisect_right: (a, x) => a.filter(v => v <= x).length,
        bisect: (a, x) => a.filter(v => v < x).length,
        insort: (a, x) => { a.push(x); a.sort((p, q) => p - q); return null; }
      },
      copy: { copy: x => (Array.isArray(x) ? x.slice() : Object.assign({}, x)), deepcopy: x => JSON.parse(JSON.stringify(x)) },
      decimal: { Decimal: x => Number(x) },
      fractions: { Fraction: (a, b) => (b == null ? Number(a) : Number(a) / Number(b)) },
      calendar: {
        isleap: y => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0,
        month: (y, m) => new Date(y, m - 1, 1).toLocaleString('en-US', { month: 'long' }),
        monthrange: (y, m) => [new Date(y, m - 1, 1).getDay(), new Date(y, m, 0).getDate()],
        weekday: (y, m, d) => new Date(y, m - 1, d).getDay()
      },
      textwrap: {
        wrap: (t, w = 70) => String(t).split(/\s+/).filter(Boolean).reduce((lines, word) => {
          const last = lines[lines.length - 1];
          if (last != null && (last + ' ' + word).length <= w) lines[lines.length - 1] = last + ' ' + word;
          else lines.push(word);
          return lines;
        }, []),
        fill: (t, w = 70) => MODS.textwrap.wrap(t, w).join('\n'),
        shorten: (t, w = 70) => String(t).length <= w ? String(t) : String(t).slice(0, Math.max(0, w - 3)) + '...'
      },
      pprint: { pformat: x => JSON.stringify(x, null, 2), pprint: x => JSON.stringify(x, null, 2) },
      platform: { system: () => 'Linux', release: () => '5.15.0-sandbox', machine: () => 'x86_64', platform: () => 'linux', python_version: () => '3.12.2', node: () => 'dev-box' },
      operator: { add: (a, b) => a + b, sub: (a, b) => a - b, mul: (a, b) => a * b, truediv: (a, b) => a / b, floordiv: (a, b) => Math.floor(a / b), mod: (a, b) => a % b, eq: (a, b) => a === b, lt: (a, b) => a < b, gt: (a, b) => a > b, itemgetter: k => o => o[k] },
      shlex: {
        split: s => String(s).match(/'[^']*'|"[^"]*"|\S+/g)?.map(x => x.replace(/^['"]|['"]$/g, '')) || [],
        quote: s => "'" + String(s).replace(/'/g, "'\\''") + "'"
      },
      hmac: { new: (key, msg) => ({ hexdigest: () => pyHash('sha256', String(key) + ':' + String(msg)) }) },
      csv: {
        reader: src => String(typeof src === 'string' ? src : src && src.read ? src.read() : '').split(/\r?\n/).filter(Boolean).map(line => line.split(',')),
        writer: () => ({ writerows: rows => rows.map(row => row.join(',')).join('\n') })
      }
    });
    Object.assign(MODS.math, {
      tau: Math.PI * 2, atan2: Math.atan2, asin: Math.asin, acos: Math.acos, atan: Math.atan,
      sinh: Math.sinh, cosh: Math.cosh, tanh: Math.tanh, trunc: Math.trunc,
      isqrt: n => Math.floor(Math.sqrt(n)), hypot: (a, b) => Math.hypot(a, b),
      degrees: r => r * 180 / Math.PI, radians: d => d * Math.PI / 180,
      prod: a => a.reduce((x, y) => x * y, 1),
      comb: (n, k) => { let r = 1; for (let i = 1; i <= k; i++) r = r * (n - k + i) / i; return Math.round(r); },
      perm: (n, k) => { let r = 1; for (let i = 0; i < k; i++) r *= n - i; return r; },
      isclose: (a, b, rel = 1e-9) => Math.abs(a - b) <= rel * Math.max(Math.abs(a), Math.abs(b))
    });
    Object.assign(MODS.random, {
      randrange: (a, b, step = 1) => { const lo = b == null ? 0 : a, hi = b == null ? a : b; return lo + Math.floor(Math.random() * Math.ceil((hi - lo) / step)) * step; },
      uniform: (a, b) => a + Math.random() * (b - a),
      sample: (a, n) => a.slice().sort(() => Math.random() - 0.5).slice(0, n),
      seed: () => null,
      getrandbits: n => Math.floor(Math.random() * Math.pow(2, Math.min(n, 52)))
    });
    Object.assign(MODS.itertools, {
      product: (...arrs) => arrs.reduce((acc, arr) => acc.flatMap(prefix => arr.map(x => prefix.concat([x]))), [[]]),
      permutations: (a, r = a.length) => MODS.itertools.product(...Array(r).fill(a)).filter(p => new Set(p).size === p.length),
      combinations: (a, r) => MODS.itertools.permutations(a, r).map(p => p.slice().sort((x, y) => a.indexOf(x) - a.indexOf(y))).filter((p, i, all) => all.findIndex(q => q.join() === p.join()) === i),
      islice: (a, start, stop) => a.slice(start, stop == null ? undefined : stop)
    });
    Object.assign(MODS.statistics, {
      variance: a => { const m = MODS.statistics.mean(a); return a.reduce((t, x) => t + (x - m) ** 2, 0) / (a.length - 1); },
      stdev: a => Math.sqrt(MODS.statistics.variance(a)),
      pstdev: a => { const m = MODS.statistics.mean(a); return Math.sqrt(a.reduce((t, x) => t + (x - m) ** 2, 0) / a.length); },
      mode: a => { const m = {}; for (const x of a) m[x] = (m[x] || 0) + 1; return Number(Object.keys(m).sort((x, y) => m[y] - m[x])[0]); }
    });
    Object.assign(MODS.time, {
      perf_counter: () => Date.now() / 1000,
      strftime: () => new Date().toISOString().slice(0, 19).replace('T', ' '),
      localtime: () => ({ tm_year: new Date().getFullYear(), tm_mon: new Date().getMonth() + 1, tm_mday: new Date().getDate(), tm_hour: new Date().getHours(), tm_min: new Date().getMinutes(), tm_sec: new Date().getSeconds() })
    });
    Object.assign(MODS.os, { getenv: (k, d) => MODS.os.environ[k] ?? d, sep: '/', cpu_count: () => 8, uname: () => ({ system: 'Linux', node: 'dev-box', release: '5.15.0-sandbox', machine: 'x86_64' }) });
    Object.assign(MODS.string, { printable: '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ!"#$%&\'()*+,-./:;<=>?@[\\]^_`{|}~ \t\n\r\x0b\x0c', whitespace: ' \t\n\r\x0b\x0c', capwords: s => String(s).replace(/\b\w/g, c => c.toUpperCase()) });
    Object.assign(MODS.base64, { b32encode: s => b64e(s), b16encode: s => [...String(s)].map(c => c.charCodeAt(0).toString(16).padStart(2, '0')).join('').toUpperCase() });
    Object.assign(MODS.datetime, { timedelta: (days = 0, seconds = 0) => ({ days, seconds }) });
    Object.assign(MODS.sys, { exit: () => { throw new Error('SystemExit: the sandbox keeps running — use reset to clear it'); }, version_info: [3, 12, 2], path: ['/usr/lib/python3.12'] });
    const H = {
      len: x => (x == null ? 0 : typeof x === 'string' || Array.isArray(x) ? x.length : Object.keys(x).length),
      sum: a => a.reduce((x, y) => x + y, 0),
      min: (...a) => Math.min(...(a.length === 1 && Array.isArray(a[0]) ? a[0] : a)),
      max: (...a) => Math.max(...(a.length === 1 && Array.isArray(a[0]) ? a[0] : a)),
      abs: Math.abs,
      round: (x, n) => n == null ? Math.round(x) : +x.toFixed(n),
      pow: Math.pow,
      divmod: (a, b) => [Math.floor(a / b), a % b],
      sorted: (a, rev) => a.slice().sort((x, y) => (x > y ? 1 : x < y ? -1 : 0) * (rev ? -1 : 1)),
      reversed: a => (typeof a === 'string' ? [...a].reverse() : a.slice().reverse()),
      range: (...a) => {
        let [s, e, st] = a.length === 1 ? [0, a[0], 1] : a.length === 2 ? [a[0], a[1], 1] : a;
        if (!st) throw new Error('ValueError: range() arg 3 must not be zero');
        const out = [];
        for (let i = s; st > 0 ? i < e : i > e; i += st) {
          out.push(i);
          if (out.length >= 10000) throw new Error('MemoryError: sandbox range() capped at 10,000 items');
        }
        return out;
      },
      int: (x, base) => base ? parseInt(String(x), base) : parseInt(x, 10),
      float: x => parseFloat(x),
      str: x => String(x),
      bool: x => Boolean(x),
      chr: n => String.fromCharCode(n),
      ord: c => String(c).charCodeAt(0),
      hex: n => '0x' + Number(n).toString(16),
      bin: n => '0b' + Number(n).toString(2),
      oct: n => '0o' + Number(n).toString(8),
      all: a => Array.from(a).every(Boolean),
      any: a => Array.from(a).some(Boolean),
      enumerate: (a, start = 0) => Array.from(a).map((v, i) => [i + start, v]),
      zip: (...arrs) => { const n = Math.min(...arrs.map(a => a.length)); return Array.from({ length: n }, (_, i) => arrs.map(a => a[i])); },
      map: (fn, a) => Array.from(a).map(fn),
      filter: (fn, a) => Array.from(a).filter(fn),
      type: x => Array.isArray(x) ? "<class 'list'>" : x === null ? "<class 'NoneType'>" : typeof x === 'object' ? "<class 'dict'>" : typeof x === 'number' ? (Number.isInteger(x) ? "<class 'int'>" : "<class 'float'>") : typeof x === 'string' ? "<class 'str'>" : typeof x === 'boolean' ? "<class 'bool'>" : typeof x,
      isinstance: (x, t) => H.type(x).includes(String(t)),
      list: x => Array.from(x || []),
      tuple: x => Array.from(x || []),
      set: x => Array.from(new Set(x || [])),
      dict: (x) => Object.assign({}, x || {}),
      bytes: x => String(x || ''),
      dir: x => x == null ? Object.keys(vars).concat(Object.keys(H)) : Object.keys(x),
      vars: () => Object.assign({}, vars),
      globals: () => Object.assign({}, vars),
      locals: () => Object.assign({}, vars),
      repr: v => repr(v),
      hash: v => parseInt(pyHash('md5', String(v)).slice(0, 8), 16),
      id: () => Math.floor(Math.random() * 1e9),
      format: (v, spec) => spec === 'x' ? Number(v).toString(16) : spec === 'b' ? Number(v).toString(2) : String(v),
      callable: x => typeof x === 'function',
      getattr: (o, k, d) => (o && k in o ? o[k] : d),
      hasattr: (o, k) => Boolean(o && k in o),
      setattr: (o, k, v) => { if (o) o[k] = v; return null; },
      __rep: pyRepeat,
      print: (...a) => a.map(x => (typeof x === 'string' ? x : repr(x))).join(' '),
      input: prompt => { H.__prompt = prompt == null ? '' : String(prompt); return ''; },
      open: p => {
        const path = String(p);
        return { path, read: () => pyFiles[path] ?? '', write: text => { pyFiles[path] = String(text); return String(text).length; }, close: () => null, __enter__: () => H.open(path), __exit__: () => null };
      },
      help: topic => G.formatHelp('python', topic == null ? '' : String(topic)),
      exit: () => { throw new Error('SystemExit: the sandbox keeps running — use reset to clear it'); },
      quit: () => { throw new Error('SystemExit: the sandbox keeps running — use reset to clear it'); },
      iter: a => Array.from(a || []),
      next: (a, d) => { const list = Array.from(a || []); return list.length ? list[0] : d === undefined ? null : d; },
      slice: (a, b, c) => Array.from(a || []).slice(b, c),
      frozenset: a => Array.from(new Set(Array.from(a || []))),
      bytearray: x => String(x || ''),
      memoryview: x => String(x || ''),
      ascii: x => JSON.stringify(String(x)),
      object: () => ({}),
      property: f => f,
      staticmethod: f => f,
      classmethod: f => f,
      issubclass: (a, b) => H.type(a) === String(b) || H.type(a).includes(String(b)),
      delattr: (o, k) => { if (o) delete o[k]; return null; },
      complex: (r = 0, i = 0) => ({ re: Number(r), im: Number(i), toString: () => Number(r) + (Number(i) < 0 ? '-' : '+') + Math.abs(Number(i)) + 'j' }),
      __import__: name => MODS[String(name)] || (() => { throw new Error("ModuleNotFoundError: No module named '" + name + "'"); })(),
      math: MODS.math,
      json: MODS.json
    };
    const pyWrap = () => {
      if (!String.prototype.upper) {
        Object.defineProperties(String.prototype, {
          upper: { value: function () { return this.toUpperCase(); }, configurable: true },
          lower: { value: function () { return this.toLowerCase(); }, configurable: true },
          strip: { value: function () { return this.trim(); }, configurable: true },
          lstrip: { value: function () { return this.trimStart(); }, configurable: true },
          rstrip: { value: function () { return this.trimEnd(); }, configurable: true },
          title: { value: function () { return this.replace(/\b\w/g, c => c.toUpperCase()); }, configurable: true },
          capitalize: { value: function () { return this ? this[0].toUpperCase() + this.slice(1).toLowerCase() : ''; }, configurable: true },
          startswith: { value: function (s) { return this.startsWith(s); }, configurable: true },
          endswith: { value: function (s) { return this.endsWith(s); }, configurable: true },
          find: { value: function (s) { return this.indexOf(s); }, configurable: true },
          count: { value: function (s) { return s ? this.split(s).length - 1 : this.length + 1; }, configurable: true },
          isdigit: { value: function () { return /^\d+$/.test(this); }, configurable: true },
          isalpha: { value: function () { return /^[A-Za-z]+$/.test(this); }, configurable: true },
          isalnum: { value: function () { return /^[A-Za-z0-9]+$/.test(this); }, configurable: true },
          zfill: { value: function (n) { return this.padStart(n, '0'); }, configurable: true },
          join: { value: function (arr) { return Array.from(arr).join(this); }, configurable: true },
          splitlines: { value: function () { return this.split(/\r?\n/); }, configurable: true }
        });
      }
    };
    const repr = v => {
      if (typeof v === 'string') return "'" + v + "'";
      if (Array.isArray(v)) return '[' + v.map(repr).join(', ') + ']';
      if (v && typeof v === 'object') return '{' + Object.entries(v).map(([k, val]) => repr(k) + ': ' + repr(val)).join(', ') + '}';
      if (v === true) return 'True';
      if (v === false) return 'False';
      if (v == null) return 'None';
      return String(v);
    };
    const evalExpr = expr => {
      pyWrap();
      let js = expr
        .replace(/\bTrue\b/g, 'true').replace(/\bFalse\b/g, 'false').replace(/\bNone\b/g, 'null')
        .replace(/\bnot\s+in\b/g, '!_in_').replace(/\bnot\b/g, '!').replace(/\band\b/g, '&&').replace(/\bor\b/g, '||');
      js = js.replace(/\bf(['"])([\s\S]*?)\1/g, (m, q, body) => '`' + body.replace(/\{([^{}]+)\}/g, '${$1}') + '`');
      js = js.replace(/\[([^[\]]+?)\s+for\s+(\w+)\s+in\s+([^[\]]+?)\s+if\s+([^[\]]+?)\]/g,
        (m, ex, v, iter, cond) => '(' + iter + ').filter(' + v + ' => (' + cond + ')).map(' + v + ' => (' + ex + '))');
      js = js.replace(/\[([^[\]]+?)\s+for\s+(\w+)\s+in\s+([^[\]]+?)\]/g,
        (m, ex, v, iter) => '(' + iter + ').map(' + v + ' => (' + ex + '))');
      js = js.replace(/lambda\s+([^:]+):([\s\S]+)/g, '($1) => ($2)');
      js = js.replace(/(\[[^\]]*\]|"(?:\\.|[^"])*"|'(?:\\.|[^'])*')\s*\*\s*(\d+)/g, '__rep($1, $2)');
      js = js.replace(/(\d+)\s*\*\s*(\[[^\]]*\]|"(?:\\.|[^"])*"|'(?:\\.|[^'])*')/g, '__rep($2, $1)');
      if (expr.includes('//')) js = js.replace(/([A-Za-z0-9_.)\]]+)\s*\/\/\s*([A-Za-z0-9_.(\[]+)/g, 'Math.floor(($1)/($2))');
      if (/\b(?:eval|Function)\s*\(/.test(js)) throw new Error('PermissionError: sandbox blocked dynamic code evaluation');
      const blockedNames = ['window', 'document', 'globalThis', 'self', 'fetch', 'XMLHttpRequest', 'WebSocket', 'localStorage', 'sessionStorage', 'indexedDB', 'navigator', 'location', 'open', 'alert', 'confirm', 'prompt', 'setInterval', 'setTimeout', 'Function'];
      const names = Object.keys(vars).filter(n => !(n in H) && !blockedNames.includes(n));
      const hKeys = Object.keys(H).filter(k => !blockedNames.includes(k));
      const fn = new Function(...blockedNames, ...names, ...hKeys, '"use strict"; return (' + js + ');');
      return fn(...blockedNames.map(() => undefined), ...names.map(n => vars[n]), ...hKeys.map(k => H[k]));
    };
    const printArgs = argstr => {
      if (!argstr.trim()) return '';
      return G.splitTop(argstr, [',']).map(a => { const v = evalExpr(a); return typeof v === 'string' ? v : repr(v); }).join(' ');
    };

    function run(line) {
      const raw = String(line == null ? '' : line).trim();
      if (!raw) return '';
      hist.push(raw);
      const out = [];
      try {
        if (/^(exit|quit)\(?\)?$/.test(raw)) return 'Use "reset" or "clear" to clear the interpreter state.';
        if (/^(clear|cls|reset)\(?\)?$/.test(raw)) { Object.keys(vars).forEach(k => delete vars[k]); return 'namespace cleared'; }
        if (/^pass$/.test(raw)) return '';
        if (/^help(?:\s+(.*))?$/.test(raw) || /^help\(([^)]*)\)$/.test(raw)) {
          const hm = raw.match(/^help(?:\s+(.*)|\(([^)]*)\))$/);
          const topic = ((hm && (hm[1] || hm[2])) || '').replace(/^['"]|['"]$/g, '').trim();
          return G.formatHelp('python', topic);
        }
        const fromImp = raw.match(/^from\s+(\w+)\s+import\s+(.+)$/);
        if (fromImp) {
          const mod = MODS[fromImp[1]];
          if (!mod) return "ModuleNotFoundError: No module named '" + fromImp[1] + "'";
          for (const item of fromImp[2].split(',').map(s => s.trim())) {
            if (item === '*') Object.assign(vars, mod);
            else if (item in mod) vars[item] = mod[item];
            else return "ImportError: cannot import name '" + item + "' from '" + fromImp[1] + "'";
          }
          return '';
        }
        const imp = raw.match(/^import\s+(.+)$/);
        if (imp) {
          for (const part of imp[1].split(',').map(s => s.trim())) {
            const m2 = part.match(/^(\w+)(?:\s+as\s+(\w+))?$/);
            if (!m2 || !MODS[m2[1]]) return "ModuleNotFoundError: No module named '" + (m2 ? m2[1] : part) + "'";
            vars[m2[2] || m2[1]] = MODS[m2[1]];
            H[m2[2] || m2[1]] = MODS[m2[1]];
          }
          return '';
        }
        const delM = raw.match(/^del\s+([A-Za-z_]\w*)$/);
        if (delM) { delete vars[delM[1]]; return ''; }
        const defM = raw.match(/^def\s+([A-Za-z_]\w*)\s*\(([^)]*)\)\s*:\s*(?:return\s+)?(.+)$/);
        if (defM) {
          const body = defM[3].replace(/\bTrue\b/g, 'true').replace(/\bFalse\b/g, 'false').replace(/\bNone\b/g, 'null');
          vars[defM[1]] = new Function(...defM[2].split(',').map(s => s.trim()).filter(Boolean), 'return (' + body + ');');
          return '';
        }
        const ifM = raw.match(/^if\s+(.+?)\s*:\s*(.+)$/);
        if (ifM) { return evalExpr(ifM[1]) ? run(ifM[2]) : ''; }
        const pr = raw.match(/^print\s*\(([\s\S]*)\)$/);
        if (pr) { out.push(printArgs(pr[1])); return out.join('\n'); }
        const loop = raw.match(/^for\s+(\w+)\s+in\s+([\s\S]+?)\s*:\s*(.+)$/);
        if (loop) {
          const list = evalExpr(loop[2]);
          for (const i of list) {
            vars[loop[1]] = i;
            const body = loop[3].trim();
            const p2 = body.match(/^print\s*\(([\s\S]*)\)$/);
            out.push(p2 ? printArgs(p2[1]) : repr(evalExpr(body)));
          }
          return out.join('\n');
        }
        const asg = raw.match(/^([A-Za-z_]\w*)\s*=\s*([\s\S]+)$/);
        if (asg && !raw.startsWith(asg[1] + ' ==')) {
          const v = evalExpr(asg[2]);
          vars[asg[1]] = v;
          return repr(v);
        }
        return repr(evalExpr(raw));
      } catch (e) {
        const msg = e && e.name === 'ReferenceError' ? 'NameError: ' + e.message : (e && e.name === 'SyntaxError' ? 'SyntaxError: invalid syntax' : (e && e.message || String(e)));
        return msg;
      }
    }

    return {
      id: 'python', name: 'Python', icon: '🐍', group: 'Languages',
      about: 'A Python REPL with variables, f-strings, comprehensions, builtins and loops. Expressions are evaluated for real; printing works the way you expect.',
      prompt: () => '>>> ',
      run,
      /* the builtins this interpreter really implements, so the help lists every name it understands */
      commandNames: () => Object.keys(H).concat(Object.keys(MODS).map(name => 'import ' + name)),
      appCommands: {
        clear: 'clear is a convenience of this Python prompt: it empties the namespace. Real Python removes one name with del and leaves the interpreter with exit().',
        reset: 'reset is the sandbox’s own command, the same as clear. There is no reset in Python.'
      },
      snapshot: () => ({ vars: G.snapshotVariables(vars), hist: hist.slice(-250) }),
      restore: saved => {
        G.replaceSavedObject(vars, saved.vars);
        if (Array.isArray(saved.hist)) hist.push(...saved.hist);
      },
      commands: [
        ['2 + 3 * 4', 'arithmetic with normal precedence'],
        ['x = 7', 'bind a variable'],
        ['x ** 2 + 1', 'use it in the next expression'],
        ['name = "terminal"', 'a string variable'],
        ['f"hello {name}"', 'an f-string'],
        ['"hello".upper()', 'string methods'],
        ['[1, 2, 3] * 2', 'list repetition'],
        ['[n * n for n in range(6)]', 'a list comprehension'],
        ['sorted([3, 1, 2], True)', 'sorted, descending'],
        ['len("terminal")', 'length of a string'],
        ['sum([1, 2, 3, 4])', 'sum a list'],
        ['{"a": 1, "b": 2}["b"]', 'dictionary lookup'],
        ['type(3.5)', 'the type of a value'],
        ['for i in range(4): print(i)', 'a loop that prints each index'],
        ['print("x is", x)', 'print several values'],
        ['import math', 'make the math module available'],
        ['math.sqrt(144)', 'call into math'],
        ['list(range(2, 10, 3))', 'a range with a step'],
        ['set([1, 1, 2])', 'a set drops duplicates'],
        ['"abcabc".count("b")', 'count a character'],
        ['divmod(17, 5)', 'quotient and remainder'],
        ['binary_string = bin(13)', 'binary, hex and oct spellings'],
        ['hex(255), oct(8)', 'several values on one line'],
        ['import random', 'make the random module available'],
        ['random.randint(1, 6)', 'roll a die'],
        ['random.sample([1, 2, 3, 4], 2)', 'pick two at random'],
        ['import heapq', 'a ready-made module page'],
        ['heapq.nsmallest(2, [9, 4, 7])', 'the two smallest values'],
        ['import statistics', 'the statistics module'],
        ['statistics.mean([2, 4, 9])', 'a mean'],
        ['statistics.stdev([2, 4, 4, 4, 5, 5, 7, 9])', 'a standard deviation'],
        ['import textwrap', 'text wrapping'],
        ['textwrap.fill("one two three four", 9)', 'wrap a sentence to nine columns'],
        ['import bisect', 'binary-search helpers'],
        ['bisect.bisect_left([1, 3, 5], 3)', 'where a value belongs in a sorted list'],
        ['import calendar', 'the calendar module'],
        ['calendar.isleap(2024)', 'a leap-year test'],
        ['import itertools', 'building blocks for loops'],
        ['itertools.combinations([1, 2, 3], 2)', 'every pair'],
        ['import operator', 'operators as functions'],
        ['operator.itemgetter("a")({"a": 1})', 'get one key'],
        ['import shlex', 'shell-style word splitting'],
        ['shlex.split(\'echo "a b"\')', 'keep quoted words whole'],
        ['open("notes.txt").read()', 'read a pretend file'],
        ['name = input("who goes there? ")', 'prompt for a value'],
        ['import hmac', 'keyed hashing'],
        ['hmac.new("k", "m").hexdigest()', 'a keyed digest'],
        ['import csv', 'read and write rows'],
        ['csv.reader(open("notes.txt").read())', 'every row of a csv file'],
        ['print("printed from a builtin")', 'print is a builtin function here'],
        ['clear', 'clear the namespace (reset)']
      ].map(x => ({ ex: x[0], d: x[1] })),
      clearLabel: 'reset'
    };
  };

  /* ================================================================ NODE */
  G.makeNode = function () {
    const vars = {};
    let output = [];
    const hist = [];
    const vfs = { 'README.md': '# sandbox\nhello from virtual fs\n', 'package.json': '{"name":"sandbox","version":"1.0.0"}' };
    const counts = {}, timers = {};
    const fakeConsole = {
      log: (...a) => output.push(a.map(x => typeof x === 'string' ? x : JSON.stringify(x)).join(' ')),
      info: (...a) => fakeConsole.log(...a),
      debug: (...a) => fakeConsole.log(...a),
      error: (...a) => output.push(a.map(x => typeof x === 'string' ? x : JSON.stringify(x)).join(' ')),
      warn: (...a) => output.push(a.map(x => typeof x === 'string' ? x : JSON.stringify(x)).join(' ')),
      dir: x => output.push(JSON.stringify(x, null, 2)),
      table: arr => output.push(Array.isArray(arr) && arr.length && typeof arr[0] === 'object' ? table(arr) : JSON.stringify(arr)),
      assert: (c, ...a) => { if (!c) output.push('Assertion failed: ' + a.join(' ')); },
      count: (k = 'default') => { counts[k] = (counts[k] || 0) + 1; output.push(k + ': ' + counts[k]); },
      time: (k = 'default') => { timers[k] = Date.now(); },
      timeEnd: (k = 'default') => { output.push(k + ': ' + (Date.now() - (timers[k] || Date.now())) + 'ms'); },
      clear: () => { output = []; }
    };
    const b64e = s => (typeof btoa === 'function' ? btoa(s) : Buffer.from(s, 'utf8').toString('base64'));
    const b64d = s => (typeof atob === 'function' ? atob(s) : Buffer.from(s, 'base64').toString('utf8'));
    const FakeBuffer = {
      from: (input, enc = 'utf8') => {
        let str = String(input);
        if (enc === 'base64') str = b64d(str);
        else if (enc === 'hex') { const h = str.replace(/[^0-9a-f]/gi, ''); let o = ''; for (let i = 0; i + 1 < h.length; i += 2) o += String.fromCharCode(parseInt(h.slice(i, i + 2), 16)); str = o; }
        return {
          length: str.length,
          toString: (outEnc = 'utf8') => {
            if (outEnc === 'base64') return b64e(str);
            if (outEnc === 'hex') return [...str].map(c => c.charCodeAt(0).toString(16).padStart(2, '0')).join('');
            return str;
          }
        };
      },
      isBuffer: x => !!(x && typeof x.toString === 'function' && typeof x.length === 'number')
    };
    const hashOf = (algo, s) => {
      let h = 0x811c9dc5, out = '';
      for (let i = 0; i < s.length; i++) h = Math.imul(h ^ (s.charCodeAt(i) + algo.charCodeAt(i % algo.length)), 0x01000193) >>> 0;
      const len = algo === 'md5' ? 32 : algo === 'sha1' ? 40 : 64;
      while (out.length < len) { h = (Math.imul(h ^ (h >>> 15), 0x2c1b3c6d) + 0x297a2d39) >>> 0; out += h.toString(16).padStart(8, '0'); }
      return out.slice(0, len);
    };
    const procObj = { platform: 'win32', arch: 'x64', pid: 4210, version: 'v20.11.0', versions: { node: '20.11.0', v8: '11.3.244' }, argv: ['node'], env: { USERNAME: 'moundshroud', COMPUTERNAME: 'DEV-BOX', NODE_ENV: 'development' }, cwd: () => 'C:\\Users\\moundshroud', hrtime: () => [0, 12000], memoryUsage: () => ({ rss: 42106880, heapUsed: 12451840 }), exit: code => '(sandbox process.exit(' + (code || 0) + ') intercepted — host unaffected)' };
    const req = m => {
      const k = String(m || '').replace(/^node:/, '');
      if (k === 'os') return { platform: () => 'win32', arch: () => 'x64', cpus: () => [{ model: 'Virtual CPU' }, { model: 'Virtual CPU' }], hostname: () => 'dev-box', homedir: () => 'C:\\Users\\moundshroud', tmpdir: () => 'C:\\Temp', totalmem: () => 17179869184, freemem: () => 9840000000, EOL: '\r\n', type: () => 'Windows_NT', release: () => '10.0.22631', uptime: () => 84120, loadavg: () => [0.12, 0.08, 0.04], networkInterfaces: () => ({ Ethernet0: [{ address: '10.0.0.5', netmask: '255.255.255.0', family: 'IPv4', mac: '52:54:00:12:34:56', internal: false }] }) };
      if (k === 'path') return { join: (...a) => a.join('/').replace(/\/+/g, '/'), resolve: (...a) => '/' + a.join('/').replace(/^\/+/, ''), basename: p => String(p).split(/[\\/]/).pop(), dirname: p => String(p).split(/[\\/]/).slice(0, -1).join('/') || '.', extname: p => { const b = String(p).split(/[\\/]/).pop(); const i = b.lastIndexOf('.'); return i > 0 ? b.slice(i) : ''; }, sep: '/' };
      if (k === 'crypto') return {
        randomUUID: () => 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16); }),
        randomBytes: n => FakeBuffer.from(Array.from({ length: n }, () => String.fromCharCode(65 + Math.floor(Math.random() * 26))).join('')),
        createHash: algo => { let acc = ''; return { update(s) { acc += String(s); return this; }, digest(fmt) { const h = hashOf(algo, acc); return fmt === 'base64' ? b64e(h) : h; } }; }
      };
      if (k === 'fs') return {
        readdirSync: () => Object.keys(vfs),
        readFileSync: p => { if (!(p in vfs)) throw new Error("ENOENT: no such file '" + p + "'"); return vfs[p]; },
        writeFileSync: (p, data) => { vfs[p] = String(data); },
        existsSync: p => p in vfs,
        unlinkSync: p => { delete vfs[p]; },
        mkdirSync: () => {},
        statSync: p => ({ size: (vfs[p] || '').length, isFile: () => p in vfs, isDirectory: () => false })
      };
      if (k === 'url') return { URL: typeof URL !== 'undefined' ? URL : function (u) { this.href = u; }, URLSearchParams: typeof URLSearchParams !== 'undefined' ? URLSearchParams : function () {} };
      if (k === 'util') return { format: (f, ...a) => { let i = 0; return String(f).replace(/%[sdjo]/g, () => String(a[i++] ?? '')); }, inspect: x => JSON.stringify(x, null, 2) };
      if (k === 'querystring') return { parse: s => Object.fromEntries(String(s).split('&').filter(Boolean).map(p => p.split('=').map(decodeURIComponent))), stringify: o => Object.entries(o).map(([a, b]) => encodeURIComponent(a) + '=' + encodeURIComponent(b)).join('&') };
      if (k === 'events') return { EventEmitter: class { constructor() { this._e = {}; } on(e, f) { (this._e[e] = this._e[e] || []).push(f); return this; } emit(e, ...a) { (this._e[e] || []).forEach(f => f(...a)); } } };
      if (k === 'assert') return Object.assign((c, msg) => { if (!c) throw new Error(msg || 'AssertionError'); }, { strictEqual: (a, b) => { if (a !== b) throw new Error(a + ' !== ' + b); } });
      if (k === 'buffer') return { Buffer: FakeBuffer };
      if (k === 'process') return procObj;
      if (k === 'dns') return { lookup: (h, cb) => cb && cb(null, '10.0.0.5', 4) };
      if (k === 'http' || k === 'https') return { STATUS_CODES: { 200: 'OK', 404: 'Not Found', 500: 'Internal Server Error' } };
      if (k === 'net') return { isIP: s => /^\d+(\.\d+){3}$/.test(s) ? 4 : 0 };
      if (k === 'stream') return { PassThrough: class { constructor() { this.chunks = []; } write(chunk) { this.chunks.push(String(chunk)); return true; } end() {} on() { return this; } pipe(dest) { return dest; } } };
      if (k === 'string_decoder') return { StringDecoder: class { decode(bytes) { return String(bytes ?? ''); } } };
      if (k === 'tty') return { isatty: () => false };
      if (k === 'perf_hooks') return { performance: { now: () => Date.now(), timeOrigin: 0 } };
      if (k === 'module') return { builtinModules: ['fs', 'path', 'os', 'crypto', 'util', 'events', 'http', 'stream'], createRequire: () => req };
      if (k === 'readline') return { createInterface: () => ({ on() { return this; }, close() {}, question(_q, cb) { if (cb) cb(''); } }) };
      if (k === 'worker_threads') return { isMainThread: true, workerData: null };
      if (k === 'timers') return { setTimeout: f => (typeof f === 'function' ? f() : undefined), setInterval: () => undefined, clearTimeout: () => undefined };
      if (k === 'v8') return { getHeapStatistics: () => ({ used_heap_size: 12451840, heap_size_limit: 4294967296 }) };
      if (k === 'cluster') return { isPrimary: true, isMaster: true, fork: () => ({ pid: 4211 }) };
      if (k === 'punycode') return { toASCII: s => String(s), toUnicode: s => String(s) };
      if (k === 'dgram') return { createSocket: () => ({ send() {}, on() { return this; }, close() {} }) };
      if (k === 'zlib') return { gzipSync: s => FakeBuffer.from(s) };
      if (k === 'child_process') return { execSync: c => '(sandbox exec: ' + c + ')' };
      return {};
    };
    const repr = v => {
      if (typeof v === 'string') return "'" + v + "'";
      if (typeof v === 'function') return '[Function: ' + (v.name || 'anonymous') + ']';
      if (v === undefined) return 'undefined';
      try { return JSON.stringify(v); } catch (e) { return String(v); }
    };
    const evalExpr = (expr, isStmt) => {
      if (/\beval\s*\(/.test(expr)) throw new Error('Sandbox blocked eval()');
      const blocked = {
        window: undefined, document: undefined, globalThis: undefined, self: undefined,
        localStorage: undefined, sessionStorage: undefined, indexedDB: undefined,
        navigator: undefined, location: undefined, open: undefined, alert: undefined,
        confirm: undefined, prompt: undefined, setInterval: undefined,
        fetch: u => '(sandbox blocked outbound fetch: ' + u + ')',
        XMLHttpRequest: function () { throw new Error('Sandbox blocked outbound XHR'); },
        WebSocket: function () { throw new Error('Sandbox blocked outbound WebSocket'); },
        Function: () => { throw new Error('Sandbox blocked Function constructor'); }
      };
      const bKeys = Object.keys(blocked);
      /* the globals every Node script can use without require(): timers, performance, text codecs, URL and the
         blob-atob pair. They are separate parameters, so a user variable of the same name never shadows them. */
      const extra = {
        setTimeout: fn2 => (typeof fn2 === 'function' ? fn2() : undefined),
        setImmediate: fn2 => (typeof fn2 === 'function' ? fn2() : undefined),
        clearTimeout: () => undefined,
        clearImmediate: () => undefined,
        queueMicrotask: fn2 => { if (typeof fn2 === 'function') fn2(); },
        structuredClone: x => JSON.parse(JSON.stringify(x)),
        performance: { now: () => Date.now(), timeOrigin: 0 },
        TextEncoder: class { encode(s) { return Array.from(String(s)).map(c => c.charCodeAt(0)); } },
        TextDecoder: class { decode(bytes) { return Array.from(bytes || []).map(code => String.fromCharCode(code)).join(''); } },
        AbortController: class { constructor() { this.signal = { aborted: false, addEventListener() {} }; } abort() { this.signal.aborted = true; } },
        URL: typeof URL !== 'undefined' ? URL : function (u) { this.href = String(u); },
        URLSearchParams: typeof URLSearchParams !== 'undefined' ? URLSearchParams : function () {},
        atob: s => (typeof atob === 'function' ? atob(String(s)) : b64d(String(s))),
        btoa: s => (typeof btoa === 'function' ? btoa(String(s)) : b64e(String(s))),
        Intl: typeof Intl !== 'undefined' ? Intl : { NumberFormat: () => ({ format: n => String(n) }) },
        global: {}
      };
      const extraNames = Object.keys(extra);
      const names = Object.keys(vars).filter(n => !bKeys.includes(n) && !extraNames.includes(n));
      // Inject loop iteration breaker into while/for/do loops so infinite loops can never freeze the app
      const safeExpr = String(expr).replace(/\b(while\s*\([^)]*\)|for\s*\([^)]*\))\s*\{/g, '$1 { if (++__steps > 50000) throw new Error("Sandbox execution limit exceeded (infinite loop blocked)"); ');
      const body = '"use strict"; let __steps = 0; ' + (isStmt ? safeExpr : 'return (' + safeExpr + '\n);');
      const fn = new Function(...bKeys, ...names, ...extraNames, 'console', 'JSON', 'Math', 'Date', 'Buffer', 'require', 'process', '__dirname', '__filename', body);
      return fn(...bKeys.map(k => blocked[k]), ...names.map(n => vars[n]), ...extraNames.map(n => extra[n]), fakeConsole, JSON, Math, Date, FakeBuffer, req, procObj, 'C:\\Users\\moundshroud', 'C:\\Users\\moundshroud\\repl.js');
    };

    function run(line) {
      const raw = String(line == null ? '' : line).replace(/^>\s?/, '').trim();
      if (!raw) return '';
      hist.push(raw);
      if (/^(?:\.help|help)(?:\s+(.*))?$/.test(raw)) {
        const hm = raw.match(/^(?:\.help|help)(?:\s+(.*))?$/);
        return G.formatHelp('node', (hm && hm[1]) || '');
      }
      if (/^\.clear$|^clear$|^reset$/.test(raw)) { Object.keys(vars).forEach(k => delete vars[k]); return 'context cleared'; }
      if (/^\.break$/.test(raw)) return '';
      if (/^\.exit$|^exit$/.test(raw)) return '(sandbox REPL stays open — use .clear to reset)';
      if (/^\.save\b/.test(raw)) return 'Session saved to sandbox memory (' + hist.length + ' lines)';
      if (/^\.load\b/.test(raw)) return '(use require("fs").readFileSync(...) to read virtual files)';
      if (/^\.editor$/.test(raw)) return '// Entering single-line sandbox mode';
      output = [];
      try {
        const fnDecl = raw.match(/^function\s+([A-Za-z_$][\w$]*)\s*\(([^)]*)\)\s*\{([\s\S]*)\}$/);
        const decl = raw.match(/^(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*([\s\S]+)$/);
        let result;
        if (fnDecl) {
          result = evalExpr('(' + raw + ')');
          vars[fnDecl[1]] = result;
        } else if (decl) {
          result = evalExpr(decl[2].replace(/;\s*$/, ''));
          vars[decl[1]] = result;
        } else if (/^(?:for|while|if|try|switch|class)\b/.test(raw)) {
          result = evalExpr(raw, true);
        } else {
          result = evalExpr(raw.replace(/;\s*$/, ''));
        }
        return output.length ? output.join('\n') : repr(result);
      } catch (e) {
        return (e && e.name ? e.name + ': ' : '') + ((e && e.message) || String(e));
      }
    }

    return {
      id: 'node', name: 'Node.js', icon: '🟢', group: 'Languages',
      about: 'A JavaScript REPL with a real evaluator: template strings, arrays, objects, JSON, Math, and a stubbed require() for os, path and crypto.',
      prompt: () => '> ',
      run,
      /* the globals and REPL dot-commands this prompt knows; language keywords and methods are the language, not the shell */
      commandNames: () => ['console', 'buffer', 'json', 'math', 'date', 'url', 'urlsearchparams', 'process', 'require', 'global',
        'settimeout', 'setimmediate', 'cleartimeout', 'clearimmediate', 'queuemicrotask', 'structuredclone', 'performance',
        'textencoder', 'textdecoder', 'abortcontroller', 'atob', 'btoa', 'intl', '__dirname', '__filename',
        'fs', 'os', 'path', 'crypto', 'util', 'events', 'assert', 'zlib', 'child_process', 'stream', 'string_decoder',
        'querystring', 'http', 'https', 'dns', 'timers', 'perf_hooks', 'module', 'readline', 'worker_threads', 'net',
        'tty', 'v8', 'cluster', 'punycode', 'dgram',
        'clear', 'reset', 'help', '.help', '.clear', '.break', '.exit', '.save', '.load', '.editor'],
      appCommands: {
        clear: 'clear is a convenience of this Node prompt, the same as .clear; Node’s own REPL spells it .clear.',
        reset: 'reset is the sandbox’s own command, the same as .clear. Node’s REPL has no reset.'
      },
      snapshot: () => ({
        vars: G.snapshotVariables(vars), vfs, counts, env: G.snapshotVariables(procObj.env), hist: hist.slice(-250)
      }),
      restore: saved => {
        G.replaceSavedObject(vars, saved.vars);
        G.replaceSavedObject(vfs, saved.vfs);
        G.replaceSavedObject(counts, saved.counts);
        G.replaceSavedObject(procObj.env, saved.env);
        if (Array.isArray(saved.hist)) hist.push(...saved.hist);
      },
      commands: [
        ['1 + 2 * 3', 'arithmetic'],
        ['const x = 5', 'declare a constant'],
        ['x * x', 'use it'],
        ['"terminal".toUpperCase()', 'string method'],
        ['[1, 2, 3].map(n => n * 2)', 'array map'],
        ['[1, 2, 3].filter(n => n > 1)', 'array filter'],
        ['[4, 1, 3].sort((a, b) => a - b)', 'array sort'],
        ['({ a: 1, b: 2 }).b', 'object property'],
        ['Object.keys({ a: 1, b: 2 })', 'object keys'],
        ['JSON.stringify({ ok: true })', 'serialise to JSON'],
        ['`hello ${"world"}`', 'template literal'],
        ['Math.sqrt(144)', 'Math helpers'],
        ['console.log("hi", 42)', 'print to the console'],
        ['require("os").platform()', 'a stubbed core module'],
        ['require("path").join("a", "b")', 'path helpers'],
        ['setTimeout(() => console.log("later"), 0)', 'a callback, run once'],
        ['structuredClone({ a: [1, 2] })', 'a deep copy'],
        ['performance.now() > 0', 'a monotonic clock reading'],
        ['new TextEncoder().encode("hi")', 'text to bytes'],
        ['btoa("hi")', 'base64 from a string'],
        ['require("os").hostname()', 'the machine name'],
        ['require("os").networkInterfaces()', 'network adapters'],
        ['require("fs").writeFileSync("out.txt", "hello")', 'write a virtual file'],
        ['require("fs").readFileSync("out.txt", "utf8")', 'read it back'],
        ['require("path").extname("app.js")', 'the file extension'],
        ['require("crypto").randomUUID()', 'a random UUID'],
        ['require("assert").strictEqual(1, 1)', 'an assertion that passes'],
        ['require("util").format("%s=%d", "n", 2)', 'printf-style formatting'],
        ['Object.entries({ a: 1 })', 'pairs from an object'],
        ['[].concat([1, 2]).length', 'how many items'],
        ['Array.from({ length: 3 }, (_, i) => i)', 'build an array'],
        ['global', 'the global object here'],
        ['clear', 'reset the context']
      ].map(x => ({ ex: x[0], d: x[1] }))
    };
  };
})();

// The Windows command set shared by every simulated Windows terminal: the puzzle sandbox (cmd + PowerShell),
// the Labyrinth rooms, and the Terminal Playground's PowerShell/cmd sandboxes. Everything is simulated against the
// room's own virtual disk; nothing here reads, writes or contacts the real machine.
// The kit only fills in commands a host has not implemented itself, so a richer sandbox always wins.
(function () {
  if (window.TerminalWindowsCommands) return;

  const STAMP = '12/02/2026  06:20';
  const padR = (v, n) => String(v == null ? '' : v).padEnd(n);
  const padL = (v, n) => String(v == null ? '' : v).padStart(n);
  const clean = p => String(p == null ? '' : p).replace(/\//g, '\\').replace(/\\{2,}/g, '\\');
  const joinWin = (base, name) => clean(base).replace(/\\+$/, '') + '\\' + name;
  const argOf = (a, i) => a[i + 1] || '';
  const tail = a => a.join(' ');
  const words = a => a.filter(x => !String(x).startsWith('-') && !String(x).startsWith('/'));

  function table(rows) {
    if (!Array.isArray(rows) || !rows.length) return '';
    const cols = Object.keys(rows[0]);
    const widths = cols.map(c => Math.max(String(c).length, ...rows.map(r => String(r[c] == null ? '' : r[c]).length)));
    return [cols.map((c, i) => padR(c, widths[i])).join('  '),
      cols.map((c, i) => '-'.repeat(widths[i])).join('  ')]
      .concat(rows.map(r => cols.map((c, i) => padR(r[c], widths[i])).join('  '))).join('\n');
  }
  const bytesFree = '   9,842,688,000 bytes free';

  /* ---------------------------------------------------------------- listing (dir / Get-ChildItem) */
  function entries(api, target, recurse, showHidden, filter) {
    const test = filter
      ? new RegExp('^' + String(filter).replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.') + '$', 'i')
      : null;
    const rows = [];
    const walk = (path, shown, depth) => {
      const l = api.list(path);
      if (!l || l.err) return false;
      const dirs = new Set(l.dirs || []);
      for (const name of (l.names || []).slice().sort()) {
        if (!showHidden && name.startsWith('.')) continue;
        const isDir = dirs.has(name);
        const rel = shown ? shown + '\\' + name : name;
        if (!test || test.test(name)) rows.push({ name, rel, path: joinWin(path, name), dir: isDir });
        if (isDir && recurse && depth < 12) walk(joinWin(path, name), rel, depth + 1);
      }
      return true;
    };
    const ok = walk(target, '', 0);
    return ok ? rows : null;
  }
  function sizeOf(api, path) {
    const r = api.read(path);
    return r && !r.err ? String(r.text).length : 0;
  }

  function listing(api, args, style) {
    const cmd = style === 'cmd';
    const flags = (args || []).filter(x => /^[-/]/.test(x)).join(' ').toLowerCase();
    const showHidden = /\/a|(?:^|\s)(?:-force|-hidden|-a)\b/.test(flags);
    const recurse = /\/s|(?:^|\s)-r(?:ecurse)?\b/.test(flags);
    const bare = cmd ? /\/b/.test(flags) : /(?:^|\s)-name(?:\s|$)/.test(flags);
    const fi = (args || []).findIndex(x => /^-filter$/i.test(x));
    const filter = fi >= 0 ? args[fi + 1] : null;
    const skip = new Set(fi >= 0 ? [fi, fi + 1] : []);
    const targets = (args || []).filter((x, i) => !/^[-/]/.test(x) && !skip.has(i));
    const target = targets[0] || api.pwd();
    const rows = entries(api, target, recurse, showHidden, filter);
    if (!rows) return cmd ? 'File Not Found' : "Get-ChildItem : Cannot find path '" + target + "' because it does not exist.";
    if (bare) return rows.map(r => recurse ? r.path : r.rel).join('\n');

    if (cmd) {
      const head = ['', ' Volume in drive C has no label.', ' Volume Serial Number is 7C2A-91F4', '',
        ' Directory of ' + clean(target), ''];
      const body = ['12/02/2026  06:20    <DIR>          .', '12/02/2026  06:20    <DIR>          ..'];
      let files = 0, dirs = 2, bytes = 0;
      for (const r of rows) {
        body.push(STAMP + '    ' + (r.dir ? '<DIR>          ' : padL(sizeOf(api, r.path).toLocaleString('en-US'), 14)) + ' ' + r.rel);
        if (r.dir) dirs++; else { files++; bytes += sizeOf(api, r.path); }
      }
      body.push(padL(files + ' File(s)', 16) + padL(bytes.toLocaleString('en-US') + ' bytes', 15));
      body.push(padL(dirs + ' Dir(s)', 16) + bytesFree);
      return head.concat(body).join('\n');
    }
    const out = ['    Directory: ' + clean(target), ''];
    out.push(table(rows.map(r => ({
      Mode: r.dir ? 'd-----' : '-a----', LastWriteTime: STAMP,
      Length: r.dir ? '' : sizeOf(api, r.path), Name: r.rel
    }))));
    return out.join('\n');
  }

  /* ---------------------------------------------------------------- install */
  function install(C, api) {
    const shell = api.shell === 'powershell' ? 'powershell' : 'cmd';
    const ps = shell === 'powershell';
    const host = (api.host || 'DEV-BOX').toUpperCase();
    const user = api.user || 'moundshroud';
    const pwd = () => clean(api.pwd ? api.pwd() : 'C:\\Users\\' + user);
    /* force: commands the bash kit also defines (ping, date, …) must speak Windows in a Windows shell */
    const add = (name, fn, force) => { if (force || !C[name]) C[name] = fn; };
    /* a Windows box answers these its own way even when a bash kit filled them in first */
    const addWin = (name, fn) => { C[name] = fn; };
    const read = p => {
      const r = api.read(p);
      return r && typeof r === 'object' ? r : (typeof r === 'string' ? { text: r } : { err: String(p) + ': not found' });
    };
    const textOf = p => { const r = read(p); return r.err ? null : r.text; };
    const listAt = p => {
      const l = api.list(p);
      if (!l || l.err) return null;
      const names = Array.isArray(l) ? l.slice() : (l.names || []).slice();
      const dirs = new Set(Array.isArray(l) ? [] : (l.dirs || []));
      return { names, dirs };
    };
    const write = (p, t, append) => { if (api.write) api.write(p, t, append); };
    const remove = p => { if (api.remove) api.remove(p); };
    const exists = p => !!listAt(p) || !!textOf(p);
    const resolveTarget = p => p || '.';
    const pick = (a, fallback) => (a.find(x => !String(x).startsWith('-') && !String(x).startsWith('/')) || fallback);

    /* ---------------- core cmd shell */
    add('pwd', pwd);
    add('ver', () => '\nMicrosoft Windows [Version 10.0.22631.3155]');
    add('cls', () => '');
    add('clear', () => '');
    add('vol', () => ' Volume in drive C has no label.\n Volume Serial Number is 7C2A-91F4');
    add('title', () => '');
    add('color', () => '');
    add('prompt', () => pwd() + '>');
    add('date', () => 'The current date is: ' + new Date().toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' }), true);
    add('time', () => 'The current time is: ' + new Date().toLocaleTimeString('en-GB'), true);
    add('hostname', () => host);
    add('whoami', () => host.toLowerCase() + '\\' + user);
    add('systeminfo', () => [
      '', 'Host Name:                 ' + host, 'OS Name:                   Microsoft Windows 11 Pro',
      'OS Version:                10.0.22631 N/A Build 22631', 'OS Manufacturer:           Microsoft Corporation',
      'System Manufacturer:       QEMU', 'System Model:              Standard PC (Q35 + ICH9, 2009)',
      'Processor(s):              1 processor(s) installed.', '                           [01]: Intel64 Family 6 Model 165 Stepping 5 GenuineIntel ~2592 Mhz',
      'Total Physical Memory:     16,384 MB', 'Available Physical Memory: 9,842 MB',
      'Virtual Memory: Max Size:  19,456 MB', 'Virtual Memory: Available:  12,301 MB',
      'Hotfix(s):                 3 Hotfix(s) Installed.', '                           [01]: KB5034765  [02]: KB5027397  [03]: KB5033918',
      'Network Card(s):           1 NIC(s) Installed.', '                           [01]: Intel(R) 82574L Gigabit Network Connection',
      '                                 Connection Name: Ethernet0', '                                 DHCP Enabled:    No',
      '                                 IP address(es)   [01]: 10.0.0.5', 'System Locale:             en-us;English (United States)',
      'Time Zone:                 (UTC+00:00) Dublin, Edinburgh, Lisbon, London', 'Domain:                   WORKGROUP'
    ].join('\n'));

    /* dir / Get-ChildItem are added by the host through listing() so the host decides the exact disk; provide here too */
    add('dir', a => listing(Object.assign({}, api, { pwd }), a, shell));
    add('gci', a => C['get-childitem'](a));
    add('ls', a => C['get-childitem'](a));

    /* ---------------- files and folders */
    add('mkdir', a => {
      const p = pick(a); if (!p) return 'The syntax of the command is incorrect.';
      if (api.mkdir) return api.mkdir(p);
      write(joinWin(pwd(), p) + '\\.keep', '');
      return '';
    });
    add('md', a => C.mkdir(a));
    add('rmdir', a => {
      const flags = a.filter(x => /^\/s$/i.test(x)).length;
      const p = a.filter(x => !String(x).startsWith('/')).pop(); if (!p) return 'The syntax of the command is incorrect.';
      const l = listAt(p);
      if (!l) return 'The system cannot find the file specified.';
      if (l.names.length && !flags) return 'The directory is not empty.';
      remove(p); return '';
    });
    add('rd', a => C.rmdir(a));
    add('del', a => {
      const p = a.filter(x => !String(x).startsWith('/')).pop(); if (!p) return 'The syntax of the command is incorrect.';
      if (!textOf(p)) return 'Could Not Find ' + clean(p);
      remove(p); return '';
    });
    add('erase', a => C.del(a));
    add('copy', a => {
      const f = words(a); if (f.length < 2) return 'The syntax of the command is incorrect.';
      const t = textOf(f[0]); if (t == null) return 'The system cannot find the file specified.\n        0 file(s) copied.';
      write(f[1], t, false); return '        1 file(s) copied.';
    });
    add('move', a => {
      const f = words(a); if (f.length < 2) return 'The syntax of the command is incorrect.';
      const t = textOf(f[0]); if (t == null) return 'The system cannot find the file specified.';
      write(f[1], t, false); remove(f[0]); return '        1 file(s) moved.';
    });
    add('ren', a => {
      const f = words(a); if (f.length < 2) return 'The syntax of the command is incorrect.';
      const t = textOf(f[0]); if (t == null) return 'The system cannot find the file specified.';
      write(f[1], t, false); remove(f[0]); return '';
    });
    add('rename', a => C.ren(a));
    add('xcopy', () => '1 File(s) copied');
    add('robocopy', a => {
      const f = words(a);
      return ['', '-------------------------------------------------------------------------------',
        '   ROBOCOPY     ::     Robust File Copy for Windows', '-------------------------------------------------------------------------------',
        '', '  Started : ' + new Date().toUTCString(), '', '  Source : ' + (f[0] || pwd()) + '\\',
        '    Dest : ' + (f[1] || 'D:\\backup') + '\\', '', '  Files : *.*', '',
        '\t  New File  \t\t   1\tnotes.txt', '\t  New File  \t\t   1\tconfig.json', '',
        '               Total    Copied   Skipped  Mismatch    FAILED    Extras',
        '    Dirs :         2         2         0         0         0         0',
        '   Files :         2         2         0         0         0         0',
        '   Bytes :    12.4 k    12.4 k         0         0         0         0', '',
        '   Times :   0:00:00   0:00:00       0:00:00   0:00:00', '', '   Ended : ' + new Date().toUTCString()].join('\n');
    });
    add('attrib', a => {
      const f = words(a).pop() || '';
      return 'A            ' + joinWin(pwd(), f).replace(/\\\\/g, '\\');
    });
    add('icacls', a => {
      const p = words(a)[0] || '.';
      return clean(p) + ' ' + host + '\\' + user + ':(F)\n          NT AUTHORITY\\SYSTEM:(F)\n          BUILTIN\\Administrators:(F)\n\nSuccessfully processed 1 files; Failed processing 0 files';
    });
    add('cacls', a => C.icacls(a));
    add('takeown', a => 'SUCCESS: The file (or folder): "' + clean(words(a).pop() || '.') + '" now owned by user "' + host + '\\' + user + '".');
    add('fc', a => {
      const f = words(a); const t1 = textOf(f[0] || ''), t2 = textOf(f[1] || '');
      if (t1 == null || t2 == null) return 'FC: cannot open file';
      return t1 === t2 ? 'Comparing files ' + f[0] + ' and ' + f[1] + '\nFC: no differences encountered' :
        'Comparing files ' + f[0] + ' and ' + f[1] + '\n***** ' + f[0] + '\n' + t1 + '\n***** ' + f[1] + '\n' + t2;
    });
    add('comp', a => C.fc(a));
    add('mklink', a => 'symbolic link created for ' + (words(a)[0] || 'link') + ' <<===>> ' + (words(a)[1] || 'target'));
    add('type', a => {
      const f = words(a); if (!f.length) return 'The syntax of the command is incorrect.';
      return f.map(p => { const t = textOf(p); return t == null ? 'The system cannot find the file specified.' : t; }).join('\n');
    });

    /* ------------------------------------------------------------ viewing any file
       Windows has its own viewers: type, more, Get-Content, notepad, Invoke-Item and start all show a
       file's content here, including files the sandbox only describes (images, archives, binaries). */
    const viewFile = path => {
      const t = textOf(path);
      if (t == null) return null;
      const text = String(t);
      const ext = (String(path).match(/\.([A-Za-z0-9]+)$/) || [, ''])[1].toLowerCase();
      const size = text.length;
      const title = '--- ' + clean(path) + ' (' + (size < 1024 ? size + ' bytes' : Math.round(size / 1024) + ' KB') + ') ---';
      const placeholder = /^\s*\(([^()]{2,90})\)\s*$/.exec(text);
      if (placeholder) return title + '\n[ ' + placeholder[1] + ' ]\nThe file opens; this sandbox stores a description rather than the original bytes.';
      if (/^\s*%PDF-/.test(text)) return title + '\n(PDF document, ' + size + ' bytes — its text layer is read with pdftotext on a Linux host)';
      if (/[\u0000-\u0008\u000e-\u001f]/.test(text)) {
        const rows = [];
        for (let i = 0; i < Math.min(text.length, 256); i += 16) {
          const chunk = text.slice(i, i + 16);
          const hex = [...chunk].map(c => c.charCodeAt(0).toString(16).padStart(2, '0')).join(' ').padEnd(47);
          const ascii = [...chunk].map(c => (/[\x20-\x7e]/.test(c) ? c : '.')).join('');
          rows.push(i.toString(16).padStart(8, '0') + '  ' + hex + '  |' + ascii + '|');
        }
        return title + '\n' + rows.join('\n');
      }
      if (['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp', 'ico'].includes(ext))
        return title + '\n[ ' + ext.toUpperCase() + ' image — 1920x1080, 8-bit sRGB ]\nThe console shows the description; the Photos app draws it.';
      if (['zip', 'docx', 'xlsx', 'pptx', '7z', 'rar', 'gz', 'tar'].includes(ext))
        return title + '\n[ ' + ext.toUpperCase() + ' archive ]\nExpand with: Expand-Archive (PowerShell) or tar -xf (Linux).';
      return title + '\n' + text;
    };
    const winOpener = name => a => {
      const f = pick(a, '');
      if (!f) return name + ': no file given';
      const shown = viewFile(f);
      return shown == null ? name + ' : Cannot find path \'' + clean(f) + '\' because it does not exist.' : shown;
    };
    for (const name of ['invoke-item', 'ii', 'open', 'notepad', 'notepad.exe', 'write', 'wordpad']) addWin(name, winOpener(name));
    addWin('start', a => {
      const f = pick(a, '');
      if (!f || !/\.|\\|\//.test(f)) return '(started ' + (f || 'cmd.exe') + ' in the sandbox)';
      return winOpener('start')([f]);
    });
    addWin('start-process', a => {
      const f = pick(a, '');
      if (!f) return '(started notepad)';
      const shown = viewFile(f);
      return shown == null ? '(started ' + f + ')' : shown;
    });
    add('out-string', (a, v) => (v == null ? '' : Array.isArray(v) ? table(v) : String(v)));
    add('more', (a, stdin) => {
      const t = a.length ? words(a).map(p => textOf(p) ?? 'The system cannot find the file specified.').join('\n') : (stdin == null ? '' : stdin);
      return t;
    });
    add('sort', (a, stdin) => {
      const f = words(a)[0];
      const t = f ? textOf(f) : stdin;
      if (t == null) return 'The system cannot find the file specified.';
      const ls = String(t).split('\n').sort();
      return (a.some(x => /^\/r$/i.test(x)) ? ls.reverse() : ls).join('\n');
    });
    add('find', (a, stdin) => {
      const f = words(a); const pat = f[0] || '';
      const t = f[1] ? textOf(f[1]) : stdin;
      if (t == null) return 'File not found - ' + (f[1] || '');
      const hits = String(t).split('\n').filter(l => l.toLowerCase().includes(pat.toLowerCase().replace(/"/g, '')));
      return hits.length ? ['---------- ' + (f[1] || 'STDIN').toUpperCase()].concat(hits).join('\n') : '';
    });
    add('findstr', (a, stdin) => {
      const pos = a.filter(x => !String(x).startsWith('/'));
      const pat = (pos[0] || '').replace(/"/g, '');
      const files = pos.slice(1);
      const src = files.length ? files.map(p => { const t = textOf(p); return t == null ? null : t; }) : [stdin];
      if (src.some(t => t == null)) return 'FINDSTR: Cannot open ' + files.join(' ');
      const re = new RegExp(pat || '', a.some(x => /^\/i$/i.test(x)) || true ? 'i' : '');
      return src.map(t => String(t).split('\n').map((l, i) => re.test(l) ? (files.length > 1 ? files[0] + ':' : '') + (i + 1) + ':' + l : null).filter(Boolean).join('\n')).filter(Boolean).join('\n');
    });
    add('where', a => {
      const p = pick(a, '*');
      const re = new RegExp('^' + p.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$', 'i');
      const rows = entries(Object.assign({}, api, { pwd }), pwd(), true, true, null) || [];
      const found = rows.filter(r => !r.dir && re.test(r.name)).map(r => r.path);
      return found.length ? found.join('\r\n') : 'INFO: Could not find files for the given pattern(s).';
    });
    add('which', a => C.where(a));

    /* ---------------- environment */
    const env = () => ({
      ALLUSERSPROFILE: 'C:\\ProgramData', APPDATA: 'C:\\Users\\' + user + '\\AppData\\Roaming',
      COMPUTERNAME: host, ComSpec: 'C:\\Windows\\system32\\cmd.exe', HOMEDRIVE: 'C:',
      HOMEPATH: '\\Users\\' + user, LOCALAPPDATA: 'C:\\Users\\' + user + '\\AppData\\Local',
      LOGONSERVER: '\\\\' + host, NUMBER_OF_PROCESSORS: '8', OS: 'Windows_NT',
      Path: 'C:\\Windows\\system32;C:\\Windows;C:\\Windows\\System32\\Wbem;C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\',
      PATHEXT: '.COM;.EXE;.BAT;.CMD;.VBS;.VBE;.JS;.JSE;.WSF;.WSH;.MSC', PROCESSOR_ARCHITECTURE: 'AMD64',
      ProgramData: 'C:\\ProgramData', ProgramFiles: 'C:\\Program Files', 'ProgramFiles(x86)': 'C:\\Program Files (x86)',
      PROMPT: '$P$G', PSModulePath: 'C:\\Program Files\\WindowsPowerShell\\Modules;C:\\Windows\\system32\\WindowsPowerShell\\v1.0\\Modules',
      PUBLIC: 'C:\\Users\\Public', SystemDrive: 'C:', SystemRoot: 'C:\\Windows', TEMP: 'C:\\Users\\' + user + '\\AppData\\Local\\Temp',
      TMP: 'C:\\Users\\' + user + '\\AppData\\Local\\Temp', USERDOMAIN: host, USERNAME: user,
      USERPROFILE: 'C:\\Users\\' + user, windir: 'C:\\Windows'
    });
    add('set', a => {
      if (!a.length) return Object.keys(env()).sort().map(k => k + '=' + env()[k]).join('\n');
      const joined = a.join(' ');
      if (!joined.includes('=')) return Object.keys(env()).filter(k => k.toLowerCase().startsWith(joined.toLowerCase())).map(k => k + '=' + env()[k]).join('\n');
      return '';
    });
    add('setx', a => {
      const joined = a.join(' ');
      return /^[^=]+=/.test(joined) ? 'SUCCESS: Specified value was saved.' : 'ERROR: Invalid syntax. Default option is not allowed more than \'2\' time(s).';
    });
    add('echo', a => {
      const raw = a.join(' ');
      return raw.replace(/%([A-Za-z_][A-Za-z0-9_]*)%/g, (m, k) => { const e = env(); return e[k] !== undefined ? e[k] : e[k.toUpperCase()] !== undefined ? e[k.toUpperCase()] : m; });
    });
    add('path', () => 'PATH=' + env().Path);
    add('doskey', () => 'DOSKEY: command history active (use the up and down arrows)');
    add('clip', (a, stdin) => stdin ? '(copied ' + String(stdin).length + ' chars to the sandbox clipboard)' : '(pipe text into clip)');
    add('assoc', () => '.bat=batfile\n.cmd=cmdfile\n.exe=exefile\n.ps1=Microsoft.PowerShellScript.1\n.txt=txtfile\n.zip=CompressedFolder');
    add('ftype', () => 'txtfile=%SystemRoot%\\system32\\NOTEPAD.EXE %1\nbatfile="%1" %*\ncmdfile="%1" %*');
    add('pushd', a => { if (api.pushd) return api.pushd(a); return C.cd ? C.cd(a) : ''; });
    add('popd', () => api.popd ? api.popd() : '');
    add('start', a => '(started ' + (words(a).join(' ') || 'cmd.exe') + ' in the sandbox)');
    add('pause', () => 'Press any key to continue . . .');
    add('timeout', () => 'Waiting for 0 seconds, press a key to continue ...');
    add('exit', () => '');
    add('logoff', () => 'The sandbox session stays open — use Reset to restore the disk.');
    add('shutdown', () => 'The sandbox host is virtual and does not power off. Use Reset to restore the disk.');

    /* ---------------- processes, services, tasks */
    const procRows = () => [
      { ImageName: 'System Idle Process', PID: 0, SessionName: 'Services', MemUsage: '8 K' },
      { ImageName: 'System', PID: 4, SessionName: 'Services', MemUsage: '2,144 K' },
      { ImageName: 'explorer.exe', PID: 412, SessionName: 'Console', MemUsage: '86,144 K' },
      { ImageName: 'powershell.exe', PID: 1204, SessionName: 'Console', MemUsage: '60,700 K' },
      { ImageName: 'chrome.exe', PID: 2210, SessionName: 'Console', MemUsage: '500,120 K' },
      { ImageName: 'sshd.exe', PID: 3110, SessionName: 'Services', MemUsage: '12,288 K' }
    ];
    add('tasklist', a => {
      const filter = /\/fi/i.test(a.join(' ')) ? (a[a.findIndex(x => /^\/fi$/i.test(x)) + 1] || '') : '';
      const want = /imagename eq "?([^"]+)"?/i.exec(filter);
      const rows = want ? procRows().filter(r => r.ImageName.toLowerCase().includes(want[1].toLowerCase())) : procRows();
      const body = ['', 'Image Name                     PID Session Name        Session#    Mem Usage',
        '========================= ======== ================ =========== ============'];
      for (const r of rows) body.push(padR(r.ImageName, 25) + padL(r.PID, 9) + ' ' + padR(r.SessionName, 16) + padL(1, 12) + padL(r.MemUsage, 13));
      return body.join('\n');
    });
    add('taskkill', a => {
      const i = a.findIndex(x => /^\/pid$/i.test(x));
      const pid = i >= 0 ? a[i + 1] : (a.find(x => /^\d+$/.test(x)) || '');
      if (!pid) return 'ERROR: Invalid syntax. Use TASKKILL /PID <pid>.';
      return 'SUCCESS: Sent termination signal to the process with PID ' + pid + '.';
    });
    add('sc', a => {
      const sub = (a[0] || 'query').toLowerCase();
      const name = a[1] || 'WinDefend';
      if (sub === 'query') return ['SERVICE_NAME: ' + name, '        TYPE               : 20  WIN32_SHARE_PROCESS',
        '        STATE              : 4  RUNNING', '                                (STOPPABLE, NOT_PAUSABLE, ACCEPTS_SHUTDOWN)',
        '        WIN32_EXIT_CODE    : 0  (0x0)', '        SERVICE_EXIT_CODE  : 0  (0x0)',
        '        CHECKPOINT         : 0x0', '        WAIT_HINT          : 0x0'].join('\n');
      if (sub === 'start' || sub === 'stop' || sub === 'config' || sub === 'failure') return '[SC] ChangeServiceConfig SUCCESS';
      if (sub === 'qc') return 'SERVICE_NAME: ' + name + '\n        TYPE               : 20  WIN32_SHARE_PROCESS\n        START_TYPE         : 2   AUTO_START\n        BINARY_PATH_NAME   : "C:\\ProgramData\\Microsoft\\Windows Defender\\Platform\\MsMpEng.exe"\n        DISPLAY_NAME       : Microsoft Defender Antivirus Service';
      return 'DESCRIPTION:\n        SC is a command line program used for communicating with the Service Control Manager.';
    });
    add('net', a => {
      const sub = (a[0] || '').toLowerCase();
      if (sub === 'user') {
        if (a.length === 1) return ['User accounts for \\\\' + host, '',
          '-------------------------------------------------------------------------------',
          'Administrator            DefaultAccount           Guest',
          'moundshroud              WDAGUtilityAccount', 'The command completed successfully.'].join('\n');
        return 'The command completed successfully.';
      }
      if (sub === 'localgroup') return ['Aliases for \\\\' + host, '',
        '-------------------------------------------------------------------------------',
        '*Administrators', '*Backup Operators', '*Device Owners', '*Hyper-V Administrators',
        '*Remote Desktop Users', '*Remote Management Users', '*Users', 'The command completed successfully.'].join('\n');
      if (sub === 'share') return ['Share name   Resource                        Remark', '',
        '-------------------------------------------------------------------------------',
        'C$           C:\\                             Default share', 'IPC$                                         Remote IPC',
        'ADMIN$       C:\\Windows                      Remote Admin', 'The command completed successfully.'].join('\n');
      if (sub === 'start') return ['These Windows services are started:', '', '   AudioSrv', '   CryptSvc',
        '   Dhcp', '   Dnscache', '   EventLog', '   LanmanServer', '   WinDefend', 'The command completed successfully.'].join('\n');
      if (sub === 'stop') return 'The service was stopped successfully.';
      if (sub === 'use') return 'There are no entries in the list.';
      if (sub === 'view') return 'There are no entries in the list.';
      if (sub === 'accounts') return 'Force user logoff how long after time expires?:       Never\nMinimum password age (days):                          0\nMaximum password age (days):                          42\nLockout threshold:                                    Never';
      if (sub === 'config') return 'Computer name                        \\\\' + host + '\nWorkstation active on\n        Netbios name                     ' + host + '\nSoftware version                     Windows 11 Pro';
      return 'The syntax of this command is:\n\nNET [ ACCOUNTS | COMPUTER | CONFIG | CONTINUE | FILE | GROUP | HELP |\n      HELPMSG | LOCALGROUP | PAUSE | SESSION | SHARE | START |\n      STATISTICS | STOP | TIME | USE | USER | VIEW ]';
    });
    add('wmic', a => 'Node: ' + host + ' · ' + (a.join(' ') || 'os get caption,version') + '\nCaption=Microsoft Windows 11 Pro   Version=10.0.22631');
    add('driverquery', () => ['Module Name  Display Name           Driver Type   Link Date', '============ ====================== ============= ==========',
      'ntfs         NTFS                   File System   2026-01-14 12:00:00', 'tcpip        TCP/IP Protocol Driver Kernel        2026-01-14 12:00:00',
      'volsnap      Volume Shadow Copy     Kernel        2026-01-14 12:00:00'].join('\n'));
    add('wevtutil', () => 'Log name:      Security\nNumber of events: 4,182\nOldest event:  2026-02-05T06:00:00Z\nNewest event:  2026-02-12T06:14:09Z');
    add('certutil', a => {
      if ((a[0] || '').toLowerCase() === '-hashfile') {
        const f = a[1] || 'notes.txt', t = textOf(f);
        if (t == null) return 'CertUtil: -hashfile command FAILED: 0x80070002 (WIN32: 2 ERROR_FILE_NOT_FOUND)';
        let h = 0x811c9dc5, hex = '';
        for (let i = 0; i < t.length; i++) h = Math.imul(h ^ t.charCodeAt(i), 0x01000193) >>> 0;
        while (hex.length < 64) { h = (Math.imul(h ^ (h >>> 15), 0x2c1b3c6d) + 0x297a2d39) >>> 0; hex += h.toString(16).padStart(8, '0'); }
        return (a[2] || 'SHA256') + ' hash of ' + f + ':\n' + hex.slice(0, 64) + '\nCertUtil: -hashfile command completed successfully.';
      }
      return 'CertUtil: -hashfile <file> [MD5|SHA1|SHA256] — the certificate store is read-only here.';
    });
    add('chkdsk', () => 'The type of the file system is NTFS.\nVolume label is OS.\n\n  31457280 KB total disk space.\n  10485760 KB in 8 files.\n  20971520 KB available on disk.\n\nWindows has scanned the file system and found no problems.\nNo further action is required.');
    add('sfc', () => 'Beginning system scan.  This process will take some time.\n\nBeginning verification phase of system scan.\nVerification 100% complete.\n\nWindows Resource Protection did not find any integrity violations.');
    add('dism', () => 'Deployment Image Servicing and Management tool\nVersion: 10.0.22621.2792\n\nNo component store corruption detected.\nThe operation completed successfully.');

    /* ---------------- networking */
    addWin('ipconfig', a => {
      const flags = a.join(' ').toLowerCase();
      if (/\/flushdns/.test(flags)) return 'Windows IP Configuration\n\nSuccessfully flushed the DNS Resolver Cache.';
      if (/\/displaydns/.test(flags)) return 'Windows IP Configuration\n\n    api.internal\n    ----------------------------------------\n    Record Name . . . . . : api.internal\n    Record Type . . . . . : 1\n    Time To Live  . . . . : 300\n    Data Length . . . . . : 4\n    Section . . . . . . . : Answer\n    A (Host) Record . . . : 10.0.0.5';
      if (/\/release/.test(flags)) return 'Windows IP Configuration\n\nNo operation can be performed on Ethernet0 while it has its media disconnected.';
      if (/\/renew/.test(flags)) return 'Windows IP Configuration\n\nEthernet adapter Ethernet0:\n\n   IPv4 Address. . . . . . . . . . . : 10.0.0.5';
      const full = /\/all/.test(flags);
      const lines = ['', 'Windows IP Configuration', '', '   Host Name . . . . . . . . . . . . : ' + host,
        full ? '   Primary Dns Suffix  . . . . . . . : internal' : '', '   Node Type . . . . . . . . . . . . : Hybrid',
        '   IP Routing Enabled. . . . . . . . : No', '   WINS Proxy Enabled. . . . . . . . : No',
        '   DNS Suffix Search List. . . . . . : internal', '', 'Ethernet adapter Ethernet0:', '',
        '   Connection-specific DNS Suffix  . : internal', '   Description . . . . . . . . . . . : Intel(R) 82574L Gigabit Network Connection',
        '   Physical Address. . . . . . . . . : 52-54-00-12-34-56', full ? '   DHCP Enabled. . . . . . . . . . . : No' : '',
        '   IPv4 Address. . . . . . . . . . . : 10.0.0.5(Preferred)', '   Subnet Mask . . . . . . . . . . . : 255.255.255.0',
        '   Default Gateway . . . . . . . . . : 10.0.0.9', full ? '   DNS Servers . . . . . . . . . . . : 10.0.0.9' : '',
        full ? '   NetBIOS over Tcpip. . . . . . . . : Enabled' : '', '', '   IPv6 Address. . . . . . . . . . . : fe80::a1b2:c3d4:e5f6:7a8b%2(Preferred)'];
      return lines.filter((l, i) => l !== '' || i < 3).join('\n');
    });
    addWin('netstat', a => {
      const flags = a.join(' ').toLowerCase();
      const head = ['Active Connections', '', '  Proto  Local Address          Foreign Address        State           PID'];
      const rows = ['  TCP    0.0.0.0:22             0.0.0.0:0              LISTENING       3110',
        '  TCP    0.0.0.0:135            0.0.0.0:0              LISTENING       912',
        '  TCP    10.0.0.5:139           0.0.0.0:0              LISTENING       4',
        '  TCP    10.0.0.5:49822         20.42.65.90:443        ESTABLISHED     2210',
        '  TCP    10.0.0.5:49918         40.114.12.7:443        ESTABLISHED     412',
        '  TCP    10.0.0.5:50002         10.0.0.9:445           ESTABLISHED     4',
        '  UDP    0.0.0.0:53             *:*                                    1204',
        '  UDP    0.0.0.0:123            *:*                                    1440'];
      return head.concat(rows).join('\n');
    });
    addWin('nslookup', a => {
      const name = pick(a, 'api.internal');
      return 'Server:  dns.internal\nAddress:  10.0.0.9\n\nName:    ' + name + '\nAddress:  10.0.0.5';
    });
    addWin('arp', a => {
      const rows = [['10.0.0.1', '52-54-00-00-00-01', 'dynamic'], ['10.0.0.5', '52-54-00-12-34-56', 'dynamic'],
        ['10.0.0.9', '52-54-00-12-34-57', 'dynamic'], ['224.0.0.22', '01-00-5e-00-00-16', 'static'],
        ['239.255.255.250', '01-00-5e-7f-ff-fa', 'static']];
      const body = rows.map(r => '  ' + padR(r[0], 22) + padR(r[1], 23) + r[2]);
      return ['', 'Interface: 10.0.0.5 --- 0x2', '  Internet Address      Physical Address      Type'].concat(body).join('\n');
    });
    addWin('route', () => ['', '===========================================================================',
      'Interface List', '  4...52 54 00 12 34 56 ......Intel(R) 82574L Gigabit Network Connection',
      '  1...........................Software Loopback Interface 1', '===========================================================================', '',
      'IPv4 Route Table', '===========================================================================', 'Active Routes:',
      'Network Destination        Netmask          Gateway       Interface  Metric', '          0.0.0.0          0.0.0.0         10.0.0.9        10.0.0.5     25',
      '        10.0.0.0    255.255.255.0         On-link         10.0.0.5    281',
      '       10.0.0.255  255.255.255.255         On-link         10.0.0.5    281',
      '      127.0.0.0        255.0.0.0         On-link         127.0.0.1    331',
      '===========================================================================', 'Persistent Routes:', '  None'].join('\n'));
    addWin('getmac', () => 'Physical Address    Transport Name\n=================== ==========================================================\n52-54-00-12-34-56   \\Device\\Tcpip_{A1B2C3D4-0000-0000-0000-000000000000}');
    addWin('ping', a => {
      const target = pick(a, 'localhost');
      const address = /^\d+\.\d+\.\d+\.\d+$/.test(target) ? target : '10.0.0.5';
      const n = (() => { const i = a.indexOf('-n'); return i >= 0 ? Math.max(1, Math.min(9, parseInt(a[i + 1], 10) || 4)) : 4; })();
      const rows = ['', 'Pinging ' + target + ' [' + address + '] with 32 bytes of data:'];
      for (let i = 1; i <= n; i++) rows.push('Reply from ' + address + ': bytes=32 time' + (i % 3 === 0 ? '=2ms' : '<1ms') + ' TTL=128');
      rows.push('', 'Ping statistics for ' + address + ':', '    Packets: Sent = ' + n + ', Received = ' + n + ', Lost = 0 (0% loss),',
        'Approximate round trip times in milli-seconds:', '    Minimum = 0ms, Maximum = 2ms, Average = ' + Math.round(2 / n) + 'ms');
      return rows.join('\n');
    });
    addWin('tracert', a => {
      const target = pick(a, '10.0.0.5');
      return ['', 'Tracing route to ' + target + ' over a maximum of 30 hops:', '',
        '  1    <1 ms    <1 ms    <1 ms  10.0.0.9', '  2     1 ms     1 ms     1 ms  10.0.0.5', '', 'Trace complete.'].join('\n');
    });
    addWin('pathping', a => C.tracert(a));
    addWin('telnet', a => 'Connecting To ' + (pick(a, '10.0.0.5')) + '...Could not open connection to the host, on port 23: Connect failed');
    addWin('ftp', a => 'Connected to ' + (pick(a, '10.0.0.5')) + '.\n220 Microsoft FTP Service\n530 User cannot log in.');
    addWin('ssh', a => 'ssh: connect to host ' + (pick(a, '10.0.0.5')) + ' port 22: Connection timed out');
    addWin('curl', a => {
      const url = pick(a, 'https://api.internal/health');
      if (a.some(x => /^-I$|--head/.test(x))) return 'HTTP/1.1 200 OK\nContent-Type: application/json\nContent-Length: 31\nDate: ' + new Date().toUTCString() + '\nServer: nginx/1.24.0';
      return '{"status":"ok","service":"api","url":"' + url + '"}';
    });
    addWin('nmap', a => ['Starting Nmap 7.94 ( https://nmap.org ) (simulated)', 'Nmap scan report for ' + pick(a, '10.0.0.5'),
      'Host is up (0.00042s latency).', 'Not shown: 997 closed tcp ports (reset)', 'PORT     STATE SERVICE',
      '22/tcp   open  ssh', '80/tcp   open  http', '443/tcp  open  https', '', 'Nmap done: 1 IP address (1 host up) scanned in 0.41 seconds'].join('\n'));

    /* ---------------- registry, tasks, misc */
    add('reg', a => {
      const sub = (a[0] || 'query').toLowerCase();
      if (sub === 'query') return ['HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion',
        '    ProductName    REG_SZ    Windows 11 Pro', '    CurrentBuild   REG_SZ    22631', '    EditionID      REG_SZ    Professional',
        '    RegisteredOwner REG_SZ   ' + user, '    InstallDate    REG_DWORD   0x65f1a2c3'].join('\n');
      if (sub === 'add' || sub === 'delete' || sub === 'import') return 'The operation completed successfully.';
      return 'REG Operation [ QUERY | ADD | DELETE | COPY | SAVE | LOAD | UNLOAD | RESTORE | COMPARE | EXPORT | IMPORT ]';
    });
    add('schtasks', () => ['Folder: \\', 'TaskName                                 Next Run Time          Status',
      '======================================== ====================== ===============',
      'NightlyBackup                            2/13/2026 3:00:00 AM   Ready',
      'DefenderScan                             2/13/2026 4:00:00 AM   Ready'].join('\n'));
    add('powercfg', () => 'Existing Power Schemes (* Active)\n-----------------------------------\nPower Scheme GUID: 381b4222-f694-41f0-9685-ff5bb260df2e  (Balanced) *');
    add('bcdedit', () => 'Windows Boot Manager\n--------------------\nidentifier              {bootmgr}\ndescription             Windows Boot Manager\ntimeout                 30');
    add('netsh', a => 'netsh ' + (a.join(' ') || 'interface ip show config') + '\n\nConfiguration for interface "Ethernet0"\n    DHCP enabled:                         No\n    IP Address:                           10.0.0.5\n    Subnet Prefix:                        10.0.0.0/24 (mask 255.255.255.0)\n    Default Gateway:                      10.0.0.9');
    add('gpresult', () => 'RSOP data for ' + host + '\\' + user + ' on ' + host + ' : Logging Mode\n\n  OS Configuration:            Standalone Workstation\n  Applied Group Policy Objects\n    Local Group Policy');
    add('gpupdate', () => 'Updating policy...\n\nComputer policy update has completed successfully.\nUser policy update has completed successfully.');
    add('tree', a => {
      const l = listAt('.'); if (!l) return 'Invalid path - ' + pwd().toUpperCase();
      const rows = ['Folder PATH listing for volume OS', 'Volume serial number is 7C2A-91F4', clean(pwd())];
      const rec = (path, shown, depth) => {
        const here = listAt(path); if (!here) return;
        const names = here.names.slice().sort();
        names.forEach((name, i) => {
          const last = i === names.length - 1;
          rows.push('│  '.repeat(depth) + (last ? '└───' : '├───') + name);
          if (here.dirs.has(name) && depth < 6) rec(joinWin(path, name), shown + '\\' + name, depth + 1);
        });
      };
      rec(pwd(), '', 0);
      return rows.join('\n');
    });
    add('help', a => ps ? 'Get-Help <cmdlet> shows the simulated help for a cmdlet.' : 'For more information on a specific command, type HELP command-name');

    /* ---------------- PowerShell cmdlets and aliases */
    const nowText = () => new Date().toString().replace(/GMT.*$/, '');
    add('get-location', () => 'Path\n----\n' + pwd());
    add('get-date', a => {
      const f = a.findIndex(x => /^-format$/i.test(x));
      if (f >= 0) {
        const fmt = (a[f + 1] || '').replace(/yyyy/g, String(new Date().getFullYear())).replace(/MM/g, String(new Date().getMonth() + 1).padStart(2, '0')).replace(/dd/g, String(new Date().getDate()).padStart(2, '0')).replace(/HH/g, String(new Date().getHours()).padStart(2, '0')).replace(/mm/g, String(new Date().getMinutes()).padStart(2, '0')).replace(/ss/g, String(new Date().getSeconds()).padStart(2, '0'));
        return fmt;
      }
      return nowText();
    });
    add('get-random', a => {
      const nums = a.filter(x => /^-?\d+$/.test(x)).map(Number);
      const max = nums.length ? Math.max(...nums) : 2147483647;
      const min = nums.length > 1 ? Math.min(...nums) : 0;
      return String(min + Math.floor(Math.random() * Math.max(1, max - min)));
    });
    add('get-host', () => 'Name             : ConsoleHost\nVersion          : 7.4.2\nInstanceId       : 4f2a9c11-6b7c-4f3e-9a10-2d5c8b7e6f01\nUI               : System.Management.Automation.Internal.Host.InternalHostUserInterface\nCurrentCulture   : en-US\nCurrentUICulture : en-US\nIsRunspacePushed : False\nRunspace         : System.Management.Automation.Runspaces.LocalRunspace');
    add('get-uptime', () => 'Days              : 3\nHours             : 4\nMinutes           : 12\nSeconds           : 8\nTotalDays         : 3.1751\nTotalHours        : 76.2\nTotalMinutes      : 4572.1');
    add('get-culture', () => 'LCID             Name             DisplayName\n----             ----             -----------\n1033             en-US            English (United States)');
    add('get-timezone', () => 'Id                         : GMT Standard Time\nDisplayName                : (UTC+00:00) Dublin, Edinburgh, Lisbon, London\nBaseUtcOffset              : 00:00:00\nSupportsDaylightSavingTime : True');
    add('get-executionpolicy', () => 'RemoteSigned');
    add('set-executionpolicy', () => '');
    add('get-psdrive', () => table([{ Name: 'C', Used: '30.00', Free: '10.00', Root: 'C:\\' }, { Name: 'D', Used: '0.00', Free: '50.00', Root: 'D:\\' }]));
    add('get-volume', () => table([{ DriveLetter: 'C', FileSystemLabel: 'OS', FileSystem: 'NTFS', HealthStatus: 'Healthy', Size: '40 GB', SizeRemaining: '10 GB' }]));
    add('get-disk', () => table([{ Number: 0, FriendlyName: 'QEMU HARDDISK', SerialNumber: 'QM00001', HealthStatus: 'Healthy', OperationalStatus: 'Online', Size: '40 GB' }]));
    add('get-partition', () => table([{ PartitionNumber: 1, DriveLetter: 'C', Type: 'GPT:Basic Data', Size: '40 GB', Offset: '1 MB' }]));
    add('get-physicaldisk', () => table([{ FriendlyName: 'QEMU HARDDISK', MediaType: 'SSD', HealthStatus: 'Healthy', Size: '40 GB' }]));
    add('get-printer', () => table([{ Name: 'Microsoft Print to PDF', DriverName: 'Microsoft Print To PDF', PortName: 'PORTPROMPT:', Shared: 'False' }, { Name: 'OneNote (Desktop)', DriverName: 'Send to Microsoft OneNote 16 Driver', PortName: 'nul:', Shared: 'False' }]));
    add('get-smbshare', () => table([{ Name: 'C$', Path: 'C:\\', Description: 'Default share' }, { Name: 'ADMIN$', Path: 'C:\\Windows', Description: 'Remote Admin' }, { Name: 'IPC$', Path: '', Description: 'Remote IPC' }]));
    add('get-smbsession', () => table([{ ClientComputerName: '10.0.0.9', ClientUserName: host + '\\' + user, NumOpens: 2 }]));
    add('get-windowsfeature', () => table([{ DisplayName: 'Web Server (IIS)', Name: 'Web-Server', InstallState: 'Available' }, { DisplayName: 'DNS Server', Name: 'DNS', InstallState: 'Available' }, { DisplayName: 'Hyper-V', Name: 'Hyper-V', InstallState: 'Available' }]));
    add('get-command', a => {
      const pattern = (pick(a, '') || '').toLowerCase();
      const re = pattern.includes('*') ? new RegExp('^' + pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$') : null;
      const names = Object.keys(C).sort().filter(x => re ? re.test(x) : x.includes(pattern));
      if (!names.length) return 'Get-Command : The term \'' + pattern + '\' is not recognized as the name of a cmdlet, function, script file, or operable program.';
      return table(names.map(n => ({ CommandType: 'Cmdlet', Name: n, Version: '7.4.0.0', Source: 'Microsoft.PowerShell.Management' })));
    });
    add('get-help', a => {
      const n = pick(a, 'Get-Help');
      return ['NAME', '    ' + n, '', 'SYNOPSIS', '    Simulated help for ' + n + ' inside this offline training machine.', '',
        'SYNTAX', '    ' + n + ' [[-Path] <string[]>] [-Force] [-Recurse]', '', 'DESCRIPTION',
        '    Everything here runs against the sandbox disk only. Nothing on the real computer is read or changed.', '',
        'RELATED LINKS', '    Get-Command', '    Get-Member', '', 'REMARKS', '    Use help <name> or Get-Help <name> -Examples'].join('\n');
    });
    add('man', a => C['get-help'](a));
    add('get-member', (a, stdin) => {
      const t = stdin == null ? '' : String(stdin);
      if (/^\s*$/.test(t)) return 'TypeName: System.String';
      const first = t.split('\n').find(Boolean) || '';
      const cols = first.trim().split(/\s{2,}/);
      return table(cols.filter(Boolean).map(c => ({ Name: c, MemberType: 'NoteProperty' })));
    });
    add('get-module', () => table([{ ModuleType: 'Manifest', Version: '7.0.0.0', Name: 'Microsoft.PowerShell.Management' }, { ModuleType: 'Manifest', Version: '7.0.0.0', Name: 'Microsoft.PowerShell.Utility' }, { ModuleType: 'Script', Version: '2.0.0.0', Name: 'NetTCPIP' }]));
    add('get-history', () => (api.history ? api.history() : []).map((cmd, i) => ({ Id: i + 1, CommandLine: cmd })));
    add('clear-history', () => '');
    add('get-variable', a => {
      const n = pick(a, '').replace(/^\$/, '').toLowerCase();
      const vars = [{ Name: 'HOME', Value: 'C:\\Users\\' + user }, { Name: 'PWD', Value: pwd() }, { Name: 'PSVersionTable', Value: 'PSVersion 7.4.2' }, { Name: 'ErrorActionPreference', Value: 'Continue' }];
      return table(vars.filter(v => !n || v.Name.toLowerCase() === n));
    });
    add('set-variable', () => '');
    add('remove-variable', () => '');
    add('get-alias', a => {
      const n = pick(a, '').toLowerCase();
      const rows = Object.keys(C).sort().filter(k => !n || k.includes(n)).slice(0, 60).map(k => ({ Name: k, Definition: k }));
      return table(rows);
    });
    add('set-alias', () => '');
    add('get-item', a => {
      const p = pick(a, pwd());
      const l = listAt(p); const t = textOf(p);
      if (!l && t == null) return "Get-Item : Cannot find path '" + clean(p) + "' because it does not exist.";
      return table([{ Mode: l ? 'd-----' : '-a----', LastWriteTime: STAMP, Length: l ? '' : String(t).length, Name: clean(p) }]);
    });
    add('get-itemproperty', a => C['get-item'](a));
    add('set-itemproperty', () => '');
    add('get-content', a => {
      const files = words(a); if (!files.length) return 'Get-Content : supply a path';
      return files.map(p => { const t = textOf(p); return t == null ? "Get-Content : Cannot find path '" + clean(p) + "' because it does not exist." : t; }).join('\n');
    });
    add('set-content', a => { const f = words(a); if (!f[0]) return 'Set-Content : supply a path'; write(f[0], f.slice(1).join(' '), false); return ''; });
    add('add-content', a => { const f = words(a); if (!f[0]) return 'Add-Content : supply a path'; write(f[0], f.slice(1).join(' '), true); return ''; });
    add('clear-content', a => { const p = pick(a); if (!p) return 'Clear-Content : supply a path'; write(p, '', false); return ''; });
    add('new-item', a => {
      const p = pick(a, '');
      if (!p) return 'New-Item : supply a path';
      const dir = a.some(x => /-itemtype/i.test(x) && /directory/i.test(a[a.indexOf(x) + 1] || '')) || /directory/i.test(a.join(' '));
      if (dir && api.mkdir) api.mkdir(p); else write(p, '', false);
      return '\n    Directory: ' + pwd() + '\n\nMode   LastWriteTime        Length Name\n----   -------------        ------ ----\n' + (dir ? 'd-----' : '-a----') + ' ' + STAMP + ' ' + padL(dir ? '' : '0', 8) + ' ' + clean(p).split('\\').pop();
    });
    add('remove-item', a => { const p = pick(a); if (!p) return 'Remove-Item : supply a path'; if (!exists(p)) return "Remove-Item : Cannot find path '" + clean(p) + "' because it does not exist."; remove(p); return ''; });
    add('copy-item', a => {
      const f = words(a); const t = textOf(f[0] || '');
      if (t == null) return "Copy-Item : Cannot find path '" + clean(f[0] || '') + "' because it does not exist.";
      write(f[1], t, false); return '';
    });
    add('move-item', a => {
      const f = words(a); const t = textOf(f[0] || '');
      if (t == null) return "Move-Item : Cannot find path '" + clean(f[0] || '') + "' because it does not exist.";
      write(f[1], t, false); remove(f[0]); return '';
    });
    add('rename-item', a => C['move-item'](a));
    add('test-path', a => { const p = pick(a); return p && exists(p) ? 'True' : 'False'; });
    add('resolve-path', a => {
      const p = pick(a, '.');
      if (!exists(p)) return 'Resolve-Path : Cannot find path \'' + clean(p) + '\' because it does not exist.';
      return 'Path\n----\n' + clean(p);
    });
    add('split-path', a => {
      const p = clean(pick(a, pwd()));
      if (a.some(x => /-leaf/i.test(x))) return p.split('\\').pop();
      if (a.some(x => /-leafbase/i.test(x))) return (p.split('\\').pop() || '').replace(/\.[^.]+$/, '');
      if (a.some(x => /-extension/i.test(x))) return ((p.match(/\.[^.]+$/) || [''])[0]);
      return p.split('\\').slice(0, -1).join('\\') || 'C:\\';
    });
    add('join-path', a => clean(words(a).join('\\')).replace(/\\{2,}/g, '\\'));
    add('get-filehash', a => {
      const p = pick(a, '');
      const t = textOf(p);
      if (t == null) return 'Get-FileHash : Cannot find path \'' + clean(p) + '\' because it does not exist.';
      let h = 0x811c9dc5, hex = '';
      for (let i = 0; i < t.length; i++) h = Math.imul(h ^ t.charCodeAt(i), 0x01000193) >>> 0;
      while (hex.length < 64) { h = (Math.imul(h ^ (h >>> 15), 0x2c1b3c6d) + 0x297a2d39) >>> 0; hex += h.toString(16).padStart(8, '0'); }
      return table([{ Algorithm: 'SHA256', Hash: hex.slice(0, 64).toUpperCase(), Path: clean(p) }]);
    });
    add('compress-archive', a => { const f = words(a); write(f[1] || 'archive.zip', 'PK\u0003\u0004 (compressed archive)', false); return 'Compressed ' + (f[0] || '.') + ' to ' + (f[1] || 'archive.zip'); });
    add('expand-archive', a => 'Expanded ' + (pick(a, 'archive.zip')) + ' to ' + pwd());
    add('get-process', a => {
      const n = pick(a, '').toLowerCase();
      const rows = procRows().filter(p => !n || p.ImageName.toLowerCase().includes(n)).map(p => ({ Id: p.PID, ProcessName: p.ImageName.replace(/\.exe$/, ''), CPU: '1.2', WS: p.MemUsage }));
      return rows.length ? table(rows) : 'Get-Process : Cannot find a process with the name "' + n + '". Verify the process name and call the cmdlet again.';
    });
    add('start-process', a => '(started ' + (pick(a, 'notepad') || 'notepad') + ')');
    add('stop-process', a => { const id = pick(a, ''); return id ? '' : 'Stop-Process : supply a process id or name'; });
    add('get-service', a => {
      const n = pick(a, '').toLowerCase();
      const rows = [{ Status: 'Running', Name: 'Dhcp', DisplayName: 'DHCP Client' }, { Status: 'Running', Name: 'Dnscache', DisplayName: 'DNS Client' },
        { Status: 'Stopped', Name: 'Spooler', DisplayName: 'Print Spooler' }, { Status: 'Running', Name: 'WinDefend', DisplayName: 'Microsoft Defender Antivirus Service' },
        { Status: 'Running', Name: 'W32Time', DisplayName: 'Windows Time' }].filter(s => !n || s.Name.toLowerCase().includes(n));
      return rows.length ? table(rows) : "Get-Service : Cannot find any service with service name '" + n + "'.";
    });
    add('start-service', a => '');
    add('stop-service', a => '');
    add('restart-service', a => '');
    add('get-eventlog', () => table([{ Index: 4104, TimeGenerated: '12/02/2026 06:14:09', EntryType: 'FailureAudit', Source: 'Security', Message: 'An account failed to log on (4625)' }, { Index: 4103, TimeGenerated: '12/02/2026 06:01:02', EntryType: 'Information', Source: 'Service Control Manager', Message: 'The WinDefend service entered the running state.' }]));
    add('get-winevent', a => C['get-eventlog'](a));
    add('get-scheduledtask', () => table([{ TaskPath: '\\', TaskName: 'NightlyBackup', State: 'Ready' }, { TaskPath: '\\Microsoft\\Windows\\Defender', TaskName: 'Windows Defender Scheduled Scan', State: 'Ready' }]));
    add('get-localuser', () => table([{ Name: 'Administrator', Enabled: 'False', Description: 'Built-in account for administering the computer/domain' }, { Name: user, Enabled: 'True', Description: 'Local developer account' }, { Name: 'Guest', Enabled: 'False', Description: 'Built-in account for guest access' }]));
    add('get-localgroup', () => table([{ Name: 'Administrators', Description: 'Administrators have complete and unrestricted access' }, { Name: 'Users', Description: 'Users are prevented from making accidental or intentional system-wide changes' }, { Name: 'Remote Desktop Users', Description: 'Members are allowed to log on through Remote Desktop Services' }]));
    add('get-acl', a => 'Path   : ' + clean(pick(a, pwd())) + '\nOwner  : ' + host + '\\' + user + '\nGroup  : ' + host + '\\None\n\nAccess : NT AUTHORITY\\SYSTEM Allow  FullControl\n         BUILTIN\\Administrators Allow  FullControl\n         ' + host + '\\' + user + ' Allow  FullControl');
    add('get-hotfix', () => table([{ Source: host, Description: 'Security Update', HotFixID: 'KB5034765', InstalledOn: '2026-02-10' }, { Source: host, Description: 'Update', HotFixID: 'KB5027397', InstalledOn: '2026-01-22' }]));
    add('get-ciminstance', a => table([{ CSName: host, Caption: 'Microsoft Windows 11 Pro', Version: '10.0.22631', Class: pick(a, 'Win32_OperatingSystem') }]));
    add('get-wmiobject', a => C['get-ciminstance'](a));
    add('get-computerinfo', () => ['WindowsProductName     : Windows 11 Pro', 'WindowsVersion         : 10.0.22631', 'OsName                 : Microsoft Windows 11 Pro',
      'CsName                 : ' + host, 'CsNumberOfLogicalProcessors : 8', 'CsTotalPhysicalMemory  : 17179869184',
      'OsArchitecture         : 64-bit', 'CsSystemType           : x64-based PC', 'WindowsDirectory       : C:\\Windows'].join('\n'));
    add('get-netipaddress', () => table([{ InterfaceAlias: 'Ethernet0', IPAddress: '10.0.0.5', PrefixLength: 24, AddressFamily: 'IPv4' }, { InterfaceAlias: 'Loopback Pseudo-Interface 1', IPAddress: '127.0.0.1', PrefixLength: 8, AddressFamily: 'IPv4' }]));
    add('get-netipconfiguration', () => 'InterfaceAlias       : Ethernet0\nInterfaceIndex       : 4\nInterfaceDescription : Intel(R) 82574L Gigabit Network Connection\nIPv4Address          : 10.0.0.5\nIPv4DefaultGateway   : 10.0.0.9\nDNSServer            : 10.0.0.9');
    add('get-nettcpconnection', () => table([{ LocalAddress: '0.0.0.0', LocalPort: 22, RemoteAddress: '0.0.0.0', RemotePort: 0, State: 'Listen', OwningProcess: 3110 }, { LocalAddress: '10.0.0.5', LocalPort: 49822, RemoteAddress: '20.42.65.90', RemotePort: 443, State: 'Established', OwningProcess: 2210 }, { LocalAddress: '10.0.0.5', LocalPort: 49918, RemoteAddress: '40.114.12.7', RemotePort: 443, State: 'Established', OwningProcess: 412 }]));
    add('get-netadapter', () => table([{ Name: 'Ethernet0', InterfaceDescription: 'Intel(R) 82574L Gigabit Network Connection', Status: 'Up', MacAddress: '52-54-00-12-34-56', LinkSpeed: '1 Gbps' }]));
    add('get-netroute', () => table([{ DestinationPrefix: '0.0.0.0/0', NextHop: '10.0.0.9', InterfaceAlias: 'Ethernet0', RouteMetric: 25 }, { DestinationPrefix: '10.0.0.0/24', NextHop: '0.0.0.0', InterfaceAlias: 'Ethernet0', RouteMetric: 281 }]));
    add('get-netfirewallrule', () => table([{ DisplayName: 'OpenSSH SSH Server (sshd)', Enabled: 'True', Direction: 'Inbound', Action: 'Allow' }, { DisplayName: 'Windows Remote Management (HTTP-In)', Enabled: 'False', Direction: 'Inbound', Action: 'Allow' }]));
    add('get-dnsclientserveraddress', () => table([{ InterfaceAlias: 'Ethernet0', AddressFamily: 'IPv4', ServerAddresses: '{10.0.0.9}' }]));
    add('resolve-dnsname', a => table([{ Name: pick(a, 'api.internal'), Type: 'A', TTL: 300, IPAddress: '10.0.0.5' }]));
    add('nslookup', a => 'Server:  dns.internal\nAddress:  10.0.0.9\n\nName:    ' + pick(a, 'api.internal') + '\nAddress:  10.0.0.5');
    add('test-connection', a => {
      const target = pick(a, '10.0.0.5'); const address = /^\d+\.\d+\.\d+\.\d+$/.test(target) ? target : '10.0.0.5';
      const n = (() => { const i = a.indexOf('-Count'); return i >= 0 ? Math.max(1, Math.min(9, parseInt(a[i + 1], 10) || 4)) : 4; })();
      return table(Array.from({ length: n }, (_, i) => ({ Source: host, Destination: target, IPV4Address: address, Bytes: 32, Time: '1ms' })));
    });
    add('test-netconnection', a => {
      const target = pick(a, 'api.internal');
      const pi = a.indexOf('-Port'); const port = pi >= 0 ? a[pi + 1] : '443';
      return 'ComputerName           : ' + target + '\nRemoteAddress          : 10.0.0.5\nRemotePort             : ' + port +
        '\nInterfaceAlias         : Ethernet0\nSourceAddress          : 10.0.0.5\nPingSucceeded          : True\nTcpTestSucceeded       : True';
    });
    add('invoke-webrequest', a => {
      const u = pick(a, 'https://api.internal/health');
      return ['StatusCode        : 200', 'StatusDescription : OK', 'Content           : {"status":"ok","service":"api"}',
        'RawContent        : HTTP/1.1 200 OK\r\nContent-Type: application/json', 'Headers           : {[Content-Type, application/json]}',
        'RawContentLength  : 31', '', 'Uri               : ' + (/^https?:/i.test(u) ? u : 'https://' + u)].join('\n');
    });
    add('invoke-restmethod', () => '{\n  "status": "ok",\n  "service": "api",\n  "version": "1.4.2"\n}');
    add('curl', a => C['invoke-webrequest'](a));
    addWin('wget', a => C['invoke-webrequest'](a));

    /* ---------------- pipelines that work on objects *or* plain text */
    const asRows = (v, cols) => Array.isArray(v) ? v.filter(x => x && typeof x === 'object')
      : String(v == null ? '' : v).split('\n').filter(Boolean).map(line => {
        const parts = line.trim().split(/\s{2,}|\t/);
        const o = {}; cols.forEach((c, i) => { o[c] = parts[i] == null ? '' : parts[i]; }); return o;
      });
    add('format-table', v => Array.isArray(v) ? table(v) : String(v == null ? '' : v));
    add('ft', v => C['format-table'](v));
    add('format-list', v => Array.isArray(v) ? v.map(o => Object.entries(o).map(([k, val]) => k.padEnd(20) + ': ' + val).join('\n')).join('\n\n') : String(v == null ? '' : v));
    add('fl', v => C['format-list'](v));
    add('format-wide', v => Array.isArray(v) ? v.map(o => Object.values(o)[0]).join('  ') : String(v == null ? '' : v));
    add('out-string', v => Array.isArray(v) ? table(v) : String(v == null ? '' : v));
    add('out-null', () => '');
    add('out-file', (a, v) => { const f = pick(a); if (f) write(f, Array.isArray(v) ? table(v) : String(v == null ? '' : v), a.some(x => /-append/i.test(x))); return ''; });
    add('tee-object', (a, v) => { const f = pick(a); if (f) write(f, Array.isArray(v) ? table(v) : String(v == null ? '' : v), a.some(x => /-append/i.test(x))); return v; });
    add('measure-object', (a, v) => {
      const n = Array.isArray(v) ? v.length : (v == null || v === '' ? 0 : String(v).split('\n').length);
      return table([{ Count: n, Average: '', Sum: '', Maximum: '', Minimum: '' }]);
    });
    add('measure', (a, v) => C['measure-object'](a, v));
    add('select-object', (a, v) => {
      let out = Array.isArray(v) ? v.slice() : String(v == null ? '' : v).split('\n');
      const fi = a.findIndex(x => /^-first$/i.test(x)), li = a.findIndex(x => /^-last$/i.test(x)), si = a.findIndex(x => /^-skip$/i.test(x));
      if (a.some(x => /^-unique$/i.test(x))) out = out.filter((x, i, arr) => arr.indexOf(x) === i);
      if (si >= 0) out = out.slice(parseInt(a[si + 1], 10) || 0);
      if (fi >= 0) out = out.slice(0, parseInt(a[fi + 1], 10) || 1);
      if (li >= 0) out = out.slice(-(parseInt(a[li + 1], 10) || 1));
      const props = a.filter((x, i) => !x.startsWith('-') && i !== fi + 1 && i !== li + 1 && i !== si + 1).join(',').split(',').map(s => s.trim()).filter(Boolean);
      if (props.length && Array.isArray(out) && out[0] && typeof out[0] === 'object') out = out.map(o => { const r = {}; for (const p of props) r[p] = o[p]; return r; });
      return Array.isArray(out) ? out.join('\n') : out;
    });
    add('select', (a, v) => C['select-object'](a, v));
    add('sort-object', (a, v) => {
      const desc = a.some(x => /^-desc/i.test(x));
      const prop = pick(a, '') || 'Name';
      let out = Array.isArray(v) ? v.slice() : String(v == null ? '' : v).split('\n');
      out.sort((x, y) => {
        const nx = Array.isArray(v) ? x[prop] : x, ny = Array.isArray(v) ? y[prop] : y;
        const r = typeof nx === 'number' && typeof ny === 'number' ? nx - ny : String(nx).localeCompare(String(ny), undefined, { numeric: true });
        return desc ? -r : r;
      });
      return out.join('\n');
    });
    add('sort', (a, v) => C['sort-object'](a, v));
    add('where-object', (a, v) => {
      const expr = a.join(' ').replace(/^\{|\}$/g, '').trim();
      const m = expr.match(/\$_\.(\w+)\s+(-eq|-ne|-gt|-lt|-ge|-le|-like|-notlike|-match|-notmatch|-contains)\s+['"]?(.*?)['"]?$/i);
      const lit = (m ? m[3] : (expr.match(/['"]([^'"]+)['"]/) || [])[1] || '').replace(/\*/g, '.*');
      if (!lit) return v;
      const re = new RegExp('^' + lit.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\\\.\\\*/g, '.*') + '$', 'i');
      if (Array.isArray(v)) {
        if (!m) return v;
        return v.filter(o => {
          const raw = o[m[1]]; const s = String(raw == null ? '' : raw);
          const op = m[2].toLowerCase();
          if (op === '-eq') return s.toLowerCase() === m[3].toLowerCase();
          if (op === '-ne') return s.toLowerCase() !== m[3].toLowerCase();
          if (op === '-gt') return Number(s) > Number(m[3]);
          if (op === '-lt') return Number(s) < Number(m[3]);
          if (op === '-ge') return Number(s) >= Number(m[3]);
          if (op === '-le') return Number(s) <= Number(m[3]);
          if (op === '-notlike') return !re.test(s);
          if (op === '-notmatch') return !new RegExp(m[3], 'i').test(s);
          return re.test(s);
        });
      }
      const needle = lit.replace(/\.\*/g, '');
      return String(v == null ? '' : v).split('\n').filter(line => /\$_\s*-notmatch|-notmatch\s*\$/.test(expr) ? !new RegExp(needle, 'i').test(line) : (m && m[2] === '-notmatch' ? !new RegExp(needle, 'i').test(line) : new RegExp(needle, 'i').test(line))).join('\n');
    });
    add('where', (a, v) => C['where-object'](a, v));
    add('?', (a, v) => C['where-object'](a, v));
    add('foreach-object', (a, v) => {
      const expr = a.join(' ').replace(/^\{|\}$/g, '').trim();
      const prop = (expr.match(/(?:\$_|\$PSItem)\.(\w+)/) || [])[1];
      if (Array.isArray(v)) return prop ? v.map(o => String(o[prop] ?? '')).join('\n') : table(v);
      return stringify(v);
    });
    add('%', (a, v) => C['foreach-object'](a, v));
    add('group-object', (a, v) => {
      if (!Array.isArray(v)) return v;
      const prop = pick(a, 'Name');
      const m = new Map();
      for (const o of v) { const k = String(o[prop] ?? ''); m.set(k, (m.get(k) || 0) + 1); }
      return table(Array.from(m.entries()).map(([Name, Count]) => ({ Count, Name })));
    });
    add('compare-object', (a, v) => {
      if (!Array.isArray(v)) return v;
      return 'Compare-Object : provide two sets with -ReferenceObject and -DifferenceObject.';
    });
    add('select-string', (a, v) => {
      const pi = a.findIndex(x => /^-pattern$/i.test(x));
      const fi = a.findIndex(x => /^-path$/i.test(x));
      const pat = pi >= 0 ? (a[pi + 1] || '') : pick(a, '');
      const file = fi >= 0 ? a[fi + 1] : a.filter((x, i) => !x.startsWith('-') && i !== pi + 1 && x !== pat)[0];
      const body = file ? textOf(file) : (v == null ? null : stringify(v));
      if (body == null) return 'Select-String : Cannot find path \'' + clean(file || '') + '\' because it does not exist.';
      const re = new RegExp(pat.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*'), 'i');
      const hits = String(body).split('\n').map((l, i) => re.test(l) ? (file ? clean(file) + ':' : '') + (i + 1) + ':' + l : null).filter(Boolean);
      return hits.length ? hits.join('\n') : '';
    });
    add('sls', (a, v) => C['select-string'](a, v));
    add('convertto-json', v => JSON.stringify(Array.isArray(v) ? v : stringify(v), null, 2));
    add('convertfrom-json', v => { try { return JSON.stringify(JSON.parse(stringify(v)), null, 2); } catch (e) { return 'ConvertFrom-Json : Invalid JSON primitive.'; } });
    add('convertto-csv', v => {
      if (!Array.isArray(v) || !v.length) return stringify(v);
      const cols = Object.keys(v[0]);
      return ['"' + cols.join('","') + '"'].concat(v.map(o => '"' + cols.map(c => String(o[c] ?? '').replace(/"/g, '""')).join('","') + '"')).join('\n');
    });
    add('convertto-html', v => ['<!DOCTYPE html>', '<html><head><title>HTML TABLE</title></head><body><table>',
      '<tr>' + (Array.isArray(v) && v[0] ? Object.keys(v[0]).map(c => '<th>' + c + '</th>').join('') : '<th>Value</th>') + '</tr>',
      '</table></body></html>'].join('\n'));
    add('convertto-securestring', () => '01000000d08c9ddf0115d1118c7a00c04fc297eb01000000' + Math.random().toString(16).slice(2, 18));
    add('convertfrom-securestring', () => '(the secure string cannot be read back without its key — simulated)');
    add('write-output', a => a.join(' '));
    add('write-host', a => a.filter(x => !/^-foregroundcolor|-backgroundcolor|-nonewline/i.test(x)).join(' '));
    add('write-error', a => 'Write-Error: ' + a.join(' '));
    add('write-warning', a => 'WARNING: ' + a.join(' '));
    add('write-verbose', a => 'VERBOSE: ' + a.join(' '));
    add('read-host', a => '(no console input in the sandbox)' );
    add('start-sleep', () => '');
    add('sleep', () => '');
    add('clear-host', () => '');
    add('get-childitem', a => {
      const p = pick(a, '');
      if (/^env:/i.test(p)) return table(Object.keys(env()).sort().map(k => ({ Name: 'env:' + k, Value: env()[k] })));
      if (/^(hk(lm|cu)|cert|wsman):/i.test(p)) return table([{ Name: p, Value: '(read-only store — simulated)' }]);
      return listing(Object.assign({}, api, { pwd }), a, shell);
    });
    add('get-childitem-recursive', a => C['get-childitem'](a.concat(['-Recurse'])));
    /* the Linux spellings people reach for by habit still answer on this box */
    add('ip', a => C.ipconfig(a), true);
    add('ifconfig', a => C.ipconfig(a), true);
    add('ss', a => C.netstat(a), true);
    add('dig', a => C.nslookup(a), true);
    add('host', a => C.nslookup(a), true);
    add('traceroute', a => C.tracert(a), true);

    /* ------------------------------------------------------------ the cmdlets and built-ins this kit never answered
       Every Windows sandbox (the playground's PowerShell and cmd, Puzzle Studio, the Labyrinth) gets the same
       behaviour, and a host that defines one of these itself still wins. */
    add('wait-process', () => '');
    add('debug-process', a => 'Debug-Process : access is denied to ' + (pick(a, '') || 'the process') + ' (simulated)');
    add('new-localuser', a => 'New-LocalUser : the account ' + (pick(a, '') || 'name') + ' would be created here (simulated)');
    add('get-localgroupmember', () => table([{ Name: 'Administrator', ObjectClass: 'User', PrincipalSource: 'Local' }, { Name: 'moundshroud', ObjectClass: 'User', PrincipalSource: 'Local' }]));
    add('set-acl', () => '');
    add('new-itemproperty', () => '');
    add('remove-itemproperty', () => '');
    add('convertfrom-csv', v => {
      const rows = String(v == null ? '' : v).split('\n').filter(Boolean);
      if (rows.length < 2) return rows.join('');
      const cols = rows[0].split(',').map(c => c.replace(/^"|"$/g, ''));
      return rows.slice(1).map(r => r.split(',').map((c, i) => cols[i] + ' : ' + c.replace(/^"|"$/g, '')).join('\n')).join('\n');
    });
    add('export-csv', (a, v) => {
      const f = pick(a, 'out.csv');
      const text = String(C['convertto-csv'](v));
      write(f, text);
      return '';
    });
    add('import-csv', a => {
      const f = pick(a, '');
      const r = f ? read(f) : { err: true };
      return r.err ? "Import-Csv : Cannot find path '" + clean(f || '') + "' because it does not exist." : C['convertfrom-csv'](r.text);
    });
    add('import-module', a => 'Import-Module : module ' + (pick(a, '') || '') + ' is not present in this sandbox');
    add('new-alias', (a, v) => C['set-alias'](a, v));
    add('new-psdrive', a => 'New-PSDrive : drives are fixed in this sandbox');
    add('register-scheduledtask', a => 'Register-ScheduledTask : the task ' + (pick(a, '') || '') + ' is registered here (simulated)');
    add('unregister-scheduledtask', () => '');
    add('measure-command', a => 'Days              : 0\nHours             : 0\nMinutes           : 0\nSeconds           : 0\nMilliseconds      : 3\nTicks             : 31245\nTotalDays         : 3.6163E-05\nTotalMilliseconds : 3.1245');
    add('invoke-command', a => 'Invoke-Command : this sandbox has no remoting session');
    add('enter-pssession', () => 'Enter-PSSession : this sandbox has no remoting session');
    add('exit-pssession', () => '');
    add('get-pssession', () => '');
    add('set-clipboard', a => '');
    add('get-clipboard', () => '(the sandbox has no clipboard)');
    add('get-psprovider', () => table([{ Name: 'FileSystem', Capabilities: 'Filter, ShouldProcess, Credentials' }, { Name: 'Registry', Capabilities: 'ShouldProcess' }, { Name: 'Environment', Capabilities: 'ShouldProcess' }]));
    add('get-appxpackage', () => table([{ Name: 'Microsoft.WindowsCalculator', Version: '11.2210.0.0', Publisher: 'CN=Microsoft Corporation' }, { Name: 'Microsoft.WindowsNotepad', Version: '11.2210.0.0', Publisher: 'CN=Microsoft Corporation' }]));
    add('get-counter', () => '\nTimestamp                 CounterSamples\n---------                 -------------\n2/12/2026 6:20:00 AM     \\dev-box\processor(_total)\\% processor time : 3');
    add('update-help', () => 'Update-Help : the sandbox is offline — help is already up to date');
    add('get-credential', () => 'Get-Credential : this sandbox cannot prompt for credentials');
    add('restart-computer', () => 'Restart-Computer : the simulated machine keeps running');
    add('stop-computer', () => 'Stop-Computer : the simulated machine keeps running');
    add('where-object-not', () => '');

    /* cmd spellings that are language built-ins or shell verbs */
    add('cd..', () => C.cd(['..']));
    add('cipher', a => (a || []).some(x => /\/w/.test(x))
      ? 'Listing C:\\Users\\moundshroud\\Documents\n New files added to this directory will not be encrypted.\n\nU notes.txt\nU README.txt'
      : 'Encrypting files in this sandbox is simulated; nothing on the real disk changes.');
    add('compact', a => {
      const rows = listing(Object.assign({}, api, { pwd }), a, 'cmd');
      return rows.split('\n').map(line => line.trim() ? line.replace(/^(\d+ file\(s\))/, '$1') : line).join('\n') + '\n   0 file(s) compressed.';
    });
    add('regedit', () => 'regedit : the registry editor is a desktop program — use `reg query` in this sandbox');
    add('notepad', () => 'notepad : this sandbox has no desktop — edit a file with the Code app');
    add('calc', () => 'calc : this sandbox has no desktop — use the Calculator app');
    add('mspaint', () => 'mspaint : this sandbox has no desktop — use the Paint app');
    add('explorer', () => 'explorer : this sandbox has no desktop — use Tools › Files');
    add('goto', () => 'Label not found.');
    add('chcp', a => (a && a[0] ? 'Active code page: ' + a[0] : 'Active code page: 65001'));
    add('replace', a => 'No files found to replace.');
    add('expand', () => 'Microsoft (R) File Expansion Utility\nUsage: expand [-r] <source> <destination>');
    add('makecab', () => 'Microsoft (R) Cabinet Maker - Version 5.1.2600.0\nUsage: makecab [options] <source> [<destination>]');
    add('openfiles', () => 'INFO: No shared open files.');
    add('quser', () => ' USERNAME              SESSIONNAME        ID  STATE   IDLE TIME  LOGON TIME\n moundshroud           console             1  Active        .  12/02/2026 06:02');
    add('query', a => /user/i.test((a || []).join(' ')) ? C.quser(a) : 'The command completed successfully.');
    add('typeperf', () => 'Exiting, please wait...');
    add('logman', () => 'The command completed successfully.');
    add('wusa', () => 'Windows Update Standalone Installer\nUsage: wusa <update.msu> [/quiet]');
    add('defrag', () => 'The operation completed successfully.\n\nThe operation completed successfully.\n\nThe operation completed successfully.');
    add('verify', a => (a || []).some(x => /off/i.test(x)) ? '' : 'VERIFY is on.');
    add('break', () => '');
    add('shift', () => '');
    add('if', () => 'The syntax of the command is incorrect.');
    add('for', () => 'The syntax of the command is incorrect.');

    /* certutil -dump prints a file as hex and text, the way the real tool does for certificates */
    {
      const plainCertutil = C.certutil;
      if (typeof plainCertutil === 'function') {
        C.certutil = (a, v) => {
          const raw = a || [];
          if (!raw.some(x => /^-dump/i.test(x))) return plainCertutil(a, v);
          const f = raw.find(x => !String(x).startsWith('-')) || '';
          const shown = f ? viewFile(f) : null;
          if (shown == null) return 'CertUtil: -dump command FAILED: 0x80070002 (WIN32: 2 ERROR_FILE_NOT_FOUND)';
          const NL = String.fromCharCode(10);
          return '================ Certificate 0 ================' + NL + shown + NL + 'CertUtil: -dump command completed successfully.';
        };
      }
    }

    return C;
  }

  function stringify(v) {
    if (Array.isArray(v)) return table(v);
    return v == null ? '' : String(v);
  }

  window.TerminalWindowsCommands = { install, listing };
})();

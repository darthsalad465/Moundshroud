// Shared commands for the simulated file-shells (Puzzle Studio rooms, the Labyrinth, the app shell and anywhere else
// built on the same tree format). The playground's bash engine already has its own full set; these are the commands
// those rooms were missing, implemented once against a small adapter so every sandbox answers the same way.
// Everything is simulated: no process runs, no packet leaves the page, every host and number is invented.
(function () {
  /* the browser loads this as a plain script; the tests load it as a module so the mission shells can
     install the same commands outside a window. */
  const G = typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : {});
  if (G.TerminalSharedCommands) return;
  const pad = (n, k = 2) => String(n).padStart(k, '0');
  const pos = a => (a || []).filter(x => !String(x).startsWith('-') && x !== '--');
  const flags = a => (a || []).join(' ');
  const joinPath = parts => '/' + parts.filter(Boolean).join('/');

  function install(C, api) {
    const isWin = api.shell === 'powershell' || api.shell === 'cmd';
    /* when a host supplies real, local machine facts (the app shell passes the browser's own), the read-only system
       commands report those instead of inventing a server. Nothing here performs network access of any kind. */
    const m = api.machine || null;
    const user = api.user || (isWin ? 'moundshroud' : 'moundshroud');
    const host = api.host || (isWin ? 'DEV-BOX' : 'puzzle-lab');
    const read = p => api.read(p);
    const one = a => pos(a)[0];
    /* a host that answers with { stdout } / { out } objects should never print [object Object] */
    const asText = v => v == null ? '' : typeof v === 'string' ? v
      : typeof v === 'object' ? String(v.stdout != null ? v.stdout : v.out != null ? v.out : v.text != null ? v.text : '')
      : String(v);
    const text = p => { const r = read(p); return r.err ? null : r.text; };
    const add = (name, fn) => { if (!C[name]) C[name] = fn; };

    /* ------------------------------------------------------------ path helpers */
    const clean = p => String(p == null ? '.' : p).replace(/\\/g, '/').replace(/\/+/g, '/');
    const base = p => { const s = clean(p).replace(/\/$/, ''); return s.split('/').pop() || '/'; };
    const dir = p => { const s = clean(p).replace(/\/$/, ''); const i = s.lastIndexOf('/'); return i <= 0 ? (s.startsWith('/') ? '/' : '.') : s.slice(0, i); };

    add('basename', a => { const p = one(a); if (!p) return 'basename: missing operand'; let b = base(p); const suf = pos(a)[1]; if (suf && b.endsWith(suf) && b !== suf) b = b.slice(0, -suf.length); return b; });
    add('dirname', a => { const p = one(a); return p ? dir(p) : 'dirname: missing operand'; });
    /* a directory is a valid argument here, so the test is "does this path exist", not "can it be read" */
    const exists = p => { const r = read(p); if (!r.err) return true; const l = api.list(p); return !!(l && !l.err); };
    add('realpath', a => { const p = one(a); if (!p) return 'realpath: missing operand'; return exists(p) ? clean(p).replace(/^\.\//, '') : 'realpath: ' + p + ': No such file or directory'; });
    add('readlink', a => { const p = one(a); return exists(p) ? clean(p) : 'readlink: ' + p + ': No such file or directory'; });
    add('mktemp', () => '/tmp/tmp.' + Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0'));
    add('strings', a => {
      const names = pos(a);
      const file = names[names.length - 1];
      if (!file) return 'strings: missing file operand';
      const r = read(file);
      if (r.err) return 'strings: ' + file + ': No such file or directory';
      const min = Number((flags(a).match(/-n\s*(\d+)/) || [])[1]) || 4;
      return (String(r.text).match(new RegExp('[\\x20-\\x7e\\t]{' + Math.max(1, min) + ',}', 'g')) || []).join('\n');
    });

    /* ------------------------------------------------------------ more filesystem */
    add('ln', a => {
      const names = pos(a); if (names.length < 2) return 'ln: missing file operand';
      const src = read(names[0]); if (src.err) return 'ln: failed to access \'' + names[0] + '\': No such file or directory';
      api.write(names[1], src.text); return '';
    });
    add('rmdir', a => {
      const names = pos(a); if (!names.length) return 'rmdir: missing operand';
      for (const n of names) { const l = api.list(n); if (l.err) return 'rmdir: failed to remove \'' + n + '\': No such file or directory'; if (l.names.length) return 'rmdir: failed to remove \'' + n + '\': Directory not empty'; api.remove(n); }
      return '';
    });
    add('chgrp', a => { const names = pos(a); if (!names.length) return 'chgrp: missing operand'; const f = names[names.length - 1]; return read(f).err ? 'chgrp: cannot access \'' + f + '\': No such file or directory' : ''; });
    add('chown', a => { const names = pos(a); if (!names.length) return 'chown: missing operand'; const f = names[names.length - 1]; return read(f).err ? 'chown: cannot access \'' + f + '\': No such file or directory' : ''; });
    add('umask', a => a.length ? '' : '0022');
    add('du', a => {
      const target = one(a) || '.';
      const l = api.list(target);
      if (l.err) return 'du: cannot access \'' + target + '\': No such file or directory';
      const rows = l.names.map(n => {
        const p = clean(target) === '.' ? n : clean(target) + '/' + n;
        const r = read(p);
        const size = r.err ? 4096 : Math.max(4, Math.ceil((r.text.length + 1) / 1024) * 4);
        return size + '\t' + p;
      });
      const total = rows.reduce((s, row) => s + parseInt(row, 10), 0);
      if (a.some(x => /^-s/.test(x))) return target + '\t' + total + 'K';
      return rows.concat([total + '\t' + target + ' (total)']).join('\n');
    });
    add('xargs', (a, stdin) => {
      const cmd = pos(a)[0];
      const items = String(stdin || '').split(/\s+/).filter(Boolean);
      if (!items.length) return '';
      if (!cmd) return items.join(' ');
      const fn = C[cmd];
      if (!fn) return 'xargs: ' + cmd + ': No such file or directory';
      const rest = pos(a).slice(1);
      if (a.some(x => x === '-n1' || x === '-n' && a[a.indexOf(x) + 1] === '1')) return items.map(i => asText(fn(rest.concat([i]), null))).filter(Boolean).join('\n');
      return asText(fn(rest.concat(items), null));
    });

    /* ------------------------------------------------------------ text utilities */
    add('fold', (a, stdin) => {
      const wi = a.indexOf('-w'); const width = wi >= 0 ? Math.max(1, parseInt(a[wi + 1], 10) || 80) : 80;
      const r = one(a) ? read(one(a)) : { text: stdin || '' };
      if (r.err) return 'fold: ' + one(a) + ': No such file or directory';
      return r.text.split('\n').map(line => {
        const out = []; for (let i = 0; i < line.length; i += width) out.push(line.slice(i, i + width));
        return out.join('\n');
      }).join('\n');
    });
    add('comm', a => {
      const names = pos(a); if (names.length < 2) return 'comm: missing operand';
      const l1 = text(names[0]), l2 = text(names[1]);
      if (l1 == null || l2 == null) return 'comm: No such file or directory';
      const s1 = new Set(l1.split('\n')), s2 = new Set(l2.split('\n'));
      const rows = [];
      for (const line of [...s1].sort()) rows.push((s2.has(line) ? '\t\t' : '') + line);
      for (const line of [...s2].filter(l => !s1.has(l)).sort()) rows.push('\t\t' + line);
      return rows.join('\n');
    });
    add('cksum', (a, stdin) => {
      const r = one(a) ? read(one(a)) : { text: stdin || '' };
      if (r.err) return 'cksum: ' + one(a) + ': No such file or directory';
      let sum = 0; for (const ch of r.text) sum = (sum * 31 + ch.charCodeAt(0)) >>> 0;
      const bytes = r.text.length + (r.text.endsWith('\n') ? 0 : 1);
      return sum + ' ' + bytes + (one(a) ? ' ' + one(a) : '');
    });
    add('od', (a, stdin) => {
      const r = one(a) ? read(one(a)) : { text: stdin || '' };
      if (r.err) return 'od: ' + one(a) + ': No such file or directory';
      const chars = a.includes('-c');
      const bytes = [...r.text].slice(0, 256);
      const rows = [];
      for (let i = 0; i < bytes.length; i += 16) {
        const chunk = bytes.slice(i, i + 16);
        const offset = i.toString(8).padStart(7, '0');
        const body = chars ? chunk.map(c => c.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/\t/g, '\\t')).join(' ') :
          chunk.map(c => c.charCodeAt(0).toString(8).padStart(3, '0')).join(' ');
        rows.push(offset + ' ' + body);
      }
      rows.push(bytes.length.toString(8).padStart(7, '0'));
      return rows.join('\n');
    });

    /* ------------------------------------------------------------ archives (simulated) */
    const archiveName = a => one(a) || 'archive';
    add('gzip', a => {
      const names = pos(a).filter(n => !n.startsWith('-'));
      if (a.some(x => /^-d|--decompress/.test(x))) {
        const f = names[0]; const r = read(f);
        if (r.err) return 'gzip: ' + f + ': No such file or directory';
        const target = f.replace(/\.gz$/, '');
        api.write(target, r.text); api.remove(f);
        return '';
      }
      if (!names.length) return 'gzip: compressed data not written to a terminal. Use -c to write to standard output';
      const f = names[0]; const r = read(f);
      if (r.err) return 'gzip: ' + f + ': No such file or directory';
      api.write(f + '.gz', r.text); api.remove(f);
      return '';
    });
    add('gunzip', a => C.gzip((a || []).concat(['-d'])));
    add('zcat', a => { const f = one(a); const r = read(f); return r.err ? 'zcat: ' + f + ': No such file or directory' : r.text; });
    add('bzip2', a => { const f = one(a); const r = read(f); if (r.err) return 'bzip2: ' + f + ': No such file or directory'; api.write(f + '.bz2', r.text); api.remove(f); return ''; });
    add('xz', a => { const f = one(a); const r = read(f); if (r.err) return 'xz: ' + f + ': No such file or directory'; if (a.some(x => /^-d/.test(x))) return r.text; api.write(f + '.xz', r.text); api.remove(f); return ''; });
    add('zip', a => {
      const names = pos(a); if (names.length < 2) return 'zip: Nothing to do!';
      const archive = names[0], files = names.slice(1);
      const missing = files.filter(f => read(f).err);
      if (missing.length) return '\tzip warning: name not matched: ' + missing.join(' ');
      return ['  adding: ' + files[0] + ' (deflated ' + (40 + files.length * 7) + '%)'].concat(files.slice(1).map(f => '  adding: ' + f)).join('\n');
    });
    add('unzip', a => {
      const names = pos(a);
      if (a.some(x => /^-l/.test(x))) return 'Archive:  ' + (names[0] || 'archive.zip') + '\n  Length      Date    Time    Name\n  412  2026-02-12 06:20   README.txt\n 1024  2026-02-12 06:20   notes.txt\n------                     -------\n 1436                     2 files';
      return 'Archive:  ' + (names[0] || 'archive.zip') + '\n  inflating: README.txt\n  inflating: notes.txt';
    });
    add('tar', a => {
      const archive = (a.find(x => /^-f/.test(x)) ? a[a.indexOf(a.find(x => /^-f/.test(x))) + 1] : null) || 'archive.tar';
      if (a.some(x => /^-t/.test(x))) return ['README.txt', 'notes.txt', 'var/log/app.log'].join('\n');
      if (a.some(x => /^-x/.test(x))) return '';
      return 'tar: Refusing to write archive ' + archive + ' in a simulated range (use -t to list)';
    });

    /* ------------------------------------------------------------ system & processes */
    add('true', () => '');
    add('false', () => '');
    add(':', () => '');
    add('break', () => '');
    add('continue', () => '');
    add('test', () => '');
    add('[', () => '');
    add('yes', a => (one(a) || 'y'));
    add('seq', a => {
      const nums = (a || []).filter(x => /^-?\d+$/.test(x)).map(Number);
      const [first, second, last] = nums.length >= 3 ? nums : nums.length === 2 ? [nums[0], 1, nums[1]] : [1, 1, nums[0] || 1];
      if (!nums.length) return 'seq: missing operand';
      const step = Math.abs(second) || 1;
      const out = [];
      for (let v = first; (second < 0 ? v >= last : v <= last) && out.length < 5000; v += second < 0 ? -step : step) out.push(String(v));
      return out.join('\n');
    });
    add('expr', a => {
      const j = (a || []).join(' ').match(/^\s*(-?\d+)\s*([+\-*/%])\s*(-?\d+)\s*$/);
      if (j) {
        const [x, op, y] = [Number(j[1]), j[2], Number(j[3])];
        if (op === '/' && !y) return 'expr: division by zero';
        return String(op === '+' ? x + y : op === '-' ? x - y : op === '*' ? x * y : op === '/' ? Math.trunc(x / y) : x % y);
      }
      const w = (a || []).join(' ').match(/^length\s+(.*)$/);
      if (w) return String(w[1].replace(/^["']|["']$/g, '').length);
      return 'expr: syntax error';
    });
    add('bc', (a, stdin) => {
      const src = (a || []).join(' ') || String(stdin || '');
      const rows = src.split(/[;\n]/).map(x => x.trim()).filter(Boolean).map(expr => {
        const m = expr.match(/^scale\s*=\s*(\d+)$/);
        if (m) return '';
        const j = expr.match(/^(-?[\d.]+)\s*([+\-*/%])\s*(-?[\d.]+)$/);
        if (!j) return 'syntax error';
        const [x, op, y] = [Number(j[1]), j[2], Number(j[3])];
        if ((op === '/' || op === '%') && y === 0) return 'Runtime error (func=(main), adr=3): Divide by zero';
        return String(op === '+' ? x + y : op === '-' ? x - y : op === '*' ? x * y : op === '/' ? x / y : x % y);
      }).filter(Boolean);
      return rows.join('\n');
    });
    add('cal', () => {
      const now = new Date(); const y = now.getFullYear(), m = now.getMonth();
      const first = new Date(y, m, 1).getDay(), days = new Date(y, m + 1, 0).getDate();
      const title = now.toLocaleString('en-GB', { month: 'long', year: 'numeric' });
      const rows = [title.padStart(Math.floor((20 + title.length) / 2)), 'Su Mo Tu We Th Fr Sa'];
      let week = '   '.repeat(first);
      for (let d = 1; d <= days; d++) { week += String(d).padStart(2) + ' '; if ((first + d) % 7 === 0) { rows.push(week.trimEnd()); week = ''; } }
      if (week.trim()) rows.push(week.trimEnd());
      return rows.join('\n');
    });
    add('date', a => {
      const d = new Date();
      if ((a || []).some(x => /^\+/.test(x))) return d.toISOString().replace('T', ' ').replace(/\.\d+Z$/, ' +0000');
      return d.toDateString().replace(/^\w+ (\w+) (\d+) (\d+)$/, '$1 $2 $3') + ' ' + d.toTimeString().slice(0, 8) + ' UTC ' + d.getFullYear();
    });
    add('sleep', a => { const n = parseFloat(one(a) || '0'); return isFinite(n) && n > 0 ? '' : 'sleep: invalid time interval \'' + (one(a) || '') + '\''; });
    add('nproc', () => '8');
    add('uptime', () => ' 06:20:00 up 3 days,  4:12,  2 users,  load average: 0.08, 0.11, 0.09');
    add('free', () => ['               total        used        free      shared  buff/cache   available', 'Mem:         8046784     2210344     3102412      133120     2734028     5481900', 'Swap:        2097148           0     2097148'].join('\n'));
    add('df', a => ['Filesystem      Size  Used Avail Use% Mounted on', '/dev/vda1        40G  8.2G   30G  22% /', 'tmpfs           2.0G     0  2.0G   0% /dev/shm'].join('\n'));
    add('ps', a => {
      const rows = [['PID TTY          TIME CMD'],
        [' 812 pts/0    00:00:01 bash'],
        ['1180 pts/0    00:00:00 ps'],
        ['2210 ?        00:00:03 agentd'],
        ['3311 ?        00:00:00 sshd']];
      return rows.join('\n');
    });
    add('top', a => {
      const lines = ['top - 06:20:00 up 3 days,  4:12,  2 users,  load average: 0.08, 0.11, 0.09',
        'Tasks:  84 total,   1 running,  83 sleeping,   0 stopped,   0 zombie',
        '%Cpu(s):  2.1 us,  0.7 sy,  0.0 ni, 96.9 id,  0.3 wa',
        'MiB Mem :   7858.2 total,   3030.1 free,   2158.5 used,   2669.6 buff/cache',
        '', '    PID USER      PR  NI    VIRT    RES  %CPU  %MEM     TIME+ COMMAND',
        '   2210 moundsh  20   0  512044 122880   1.3   1.5   0:12.44 agentd',
        '    812 moundsh  20   0   21444   6216   0.3   0.1   0:00.98 bash'];
      return lines.join('\n');
    });
    add('htop', a => C.top(a));
    add('kill', a => { const names = pos(a); return names.length ? '' : 'kill: usage: kill [-s sigspec | -n signum | -sigspec] pid | jobspec ...'; });
    add('killall', a => one(a) ? '' : 'killall: no process name given');
    add('pkill', a => one(a) ? '' : 'pkill: no process name given');
    add('pgrep', a => one(a) ? '2210' : '2210\n3311');
    add('jobs', () => '');
    add('bg', () => 'bash: bg: current: no such job');
    add('fg', () => 'bash: fg: current: no such job');
    add('history', () => '    1  ls\n    2  cd projects\n    3  grep -rn key .');
    add('alias', a => (a || []).length ? '' : "alias ll='ls -l'\nalias la='ls -a'");
    add('unalias', () => '');
    add('export', () => '');
    add('unset', () => '');
    add('set', () => '');
    add('let', a => { const j = (a || []).join(' ').match(/^\w+\s*=\s*(-?\d+)\s*([+\-*/])\s*(-?\d+)$/); return j ? '' : 'bash: let: syntax error'; });
    add('type', a => { const n = one(a); if (!n) return 'type: missing operand'; return C[n] ? n + ' is a shell builtin' : 'bash: type: ' + n + ': not found'; });
    add('which', a => { const n = one(a); if (!n) return 'which: missing operand'; return C[n] ? '/usr/bin/' + n : 'which: no ' + n + ' in (/usr/local/bin:/usr/bin:/bin)'; });
    add('whoami', () => user);
    add('id', () => 'uid=1000(' + user + ') gid=1000(' + user + ') groups=1000(' + user + '),27(sudo)');
    add('groups', () => user + ' sudo docker');
    add('users', () => user);
    add('w', () => ' 06:20:00 up 3 days,  2 users,  load average: 0.08, 0.11, 0.09\nUSER     TTY      FROM             LOGIN@   IDLE   JCPU   PCPU WHAT\n' + user + '   pts/0    10.0.0.9         06:10    0.00s  0.08s  0.02s bash');
    add('who', () => user + '      pts/0        2026-02-12 06:10 (10.0.0.9)');
    add('last', () => user + '      pts/0        10.0.0.9         Thu Feb 12 06:10   still logged in\nreboot   system boot  5.15.0-91-gen    Mon Feb  9 02:46   still running');
    add('uname', a => (a || []).join(' ').includes('-a') ? 'Linux ' + host + ' 6.6.0 x86_64 GNU/Linux' : 'Linux');
    add('hostname', () => host);
    add('hostnamectl', () => ' Static hostname: ' + host + '\n       Icon name: computer-vm\n         Chassis: vm\nOperating System: Ubuntu 22.04.4 LTS\n          Kernel: Linux 6.6.0\n    Architecture: x86-64');
    add('lscpu', () => ['Architecture:            x86_64', '  CPU op-mode(s):        32-bit, 64-bit', 'CPU(s):                  8', '  Model name:            Virtual CPU @ 2.60GHz', '    Thread(s) per core:   2', '    Core(s) per socket:   4'].join('\n'));
    add('lsblk', () => ['NAME   MAJ:MIN RM  SIZE RO TYPE MOUNTPOINT', 'vda    252:0    0   40G  0 disk', '└─vda1 252:1    0   40G  0 part /', 'vdb    252:16   0   20G  0 disk /data'].join('\n'));
    add('mount', () => '/dev/vda1 on / type ext4 (rw,relatime)\ntmpfs on /dev/shm type tmpfs (rw,nosuid,nodev)');
    add('dmesg', () => ['[    0.000000] Linux version 6.6.0 (simulated)', '[    0.412031] virtio_blk: vda1', '[    1.204118] random: crng init done', '[    2.918442] EXT4-fs (vda1): mounted filesystem with ordered data mode'].join('\n'));
    add('journalctl', () => ['-- Journal begins at Mon 2026-02-09, ends Thu 2026-02-12 --', 'Feb 12 06:01:02 ' + host + ' systemd[1]: Started daily maintenance.', 'Feb 12 06:07:41 ' + host + ' agentd[2210]: session check ok'].join('\n'));
    add('systemctl', a => {
      const sub = pos(a); const unit = sub[1] || sub[0] || 'agentd';
      if (sub[0] === 'status') return '● ' + unit + '\n     Loaded: loaded (/lib/systemd/system/' + unit + '.service; enabled)\n     Active: active (running) since Thu 2026-02-12 06:01:02 UTC\n   Main PID: 2210 (agentd)\n      Tasks: 4 (limit: 4915)\n     Memory: 12.4M\n        CPU: 128ms';
      if (['start', 'stop', 'restart', 'enable', 'disable'].includes(sub[0])) return '';
      if (!sub.length) return 'systemctl: missing command';
      return 'Unknown command verb ' + sub[0] + '.';
    });
    add('service', a => { const s = pos(a); return s[0] === 'status' ? '● ' + (s[1] || 'agentd') + '.service - running' : ''; });
    add('crontab', a => {
      if ((a || []).some(x => /^-l/.test(x))) return '# m h dom mon dow command\n0 3 * * * /home/' + user + '/projects/backup.sh --health\n30 4 * * 1 /usr/bin/find /var/log -name "*.log" -mtime +7 -delete';
      if ((a || []).some(x => /^-r/.test(x))) return '';
      return 'crontab: installing simulated crontabs is disabled in this range';
    });
    add('passwd', () => 'passwd: Authentication token manipulation error (simulated)');
    add('useradd', a => one(a) ? '' : 'useradd: invalid user name \'\'');
    add('usermod', a => one(a) ? '' : 'usermod: no changes');
    add('sudo', (a, stdin) => { const names = pos(a); if (!names.length) return 'usage: sudo command [args]'; const fn = C[names[0]]; return fn ? fn(names.slice(1), stdin) : 'sudo: ' + names[0] + ': command not found'; });
    add('su', () => 'su: simulated range — staying as ' + user);
    add('exit', () => '');
    add('logout', () => '');
    add('return', () => '');
    add('reset', () => '');
    add('logout', () => '');
    add('nohup', (a, stdin) => { const names = pos(a); const fn = names.length ? C[names[0]] : null; return fn ? asText(fn(names.slice(1), stdin)) + '\n[b1] done' : 'nohup: failed to run command \'' + (names[0] || '') + '\': No such file or directory'; });

    /* ------------------------------------------------------------ network (simulated) */
    const ipOf = () => '10.0.0.' + (2 + Math.floor(Math.random() * 240));
    add('ping', a => {
      const target = one(a) || 'localhost';
      const count = (() => { const i = (a || []).indexOf('-c'); return i >= 0 ? Math.max(1, Math.min(9, parseInt(a[i + 1], 10) || 4)) : 4; })();
      const rows = ['PING ' + target + ' (' + (/\d+\.\d+\.\d+\.\d+/.test(target) ? target : '10.0.0.5') + ') 56(84) bytes of data.'];
      for (let i = 1; i <= count; i++) rows.push('64 bytes from ' + target + ': icmp_seq=' + i + ' ttl=64 time=' + (0.2 + Math.random()).toFixed(2) + ' ms');
      rows.push('', '--- ' + target + ' ping statistics ---', count + ' packets transmitted, ' + count + ' received, 0% packet loss, time ' + (count * 1000) + 'ms',
        'rtt min/avg/max/mdev = 0.201/0.412/0.688/0.102 ms');
      return rows.join('\n');
    });
    add('curl', a => {
      const target = pos(a).find(x => /^[a-z]+:\/\//.test(x) || /^\w[\w.-]*\.\w+/.test(x)) || 'http://localhost/';
      const url = /^[a-z]+:\/\//.test(target) ? target : 'http://' + target + '/';
      if ((a || []).some(x => /^-I|--head/.test(x))) return 'HTTP/1.1 200 OK\nDate: Thu, 12 Feb 2026 06:20:00 GMT\nServer: nginx/1.24.0\nContent-Type: text/html\nContent-Length: 612\nConnection: keep-alive';
      return '<!doctype html>\n<html><head><title>Simulated host</title></head>\n<body><h1>' + url + '</h1><p>This response is fabricated for the exercise.</p></body></html>';
    });
    add('wget', a => {
      const target = pos(a).find(x => /^[a-z]+:\/\//.test(x)) || pos(a)[0] || 'http://localhost/';
      return ['--2026-02-12 06:20:00--  ' + target, 'Resolving host... 10.0.0.5', 'Connecting to host|10.0.0.5|:80... connected.',
        'HTTP request sent, awaiting response... 200 OK', 'Length: 612 [text/html]', "Saving to: 'index.html'", '', 'index.html          100%[===================>]     612  --.-KB/s    in 0s', '', '2026-02-12 06:20:00 (42.1 MB/s) - \'index.html\' saved [612/612]'].join('\n');
    });
    add('dig', a => {
      const name = one(a) || 'api.internal';
      return ['; <<>> DiG 9.18.24 <<>> ' + (a || []).join(' '), ';; ->>HEADER<<- opcode: QUERY, status: NOERROR, id: ' + (1000 + Math.floor(Math.random() * 9000)),
        ';; QUESTION SECTION:', ';' + name + '.\t\t\tIN\tA', '', ';; ANSWER SECTION:', name + '.\t\t300\tIN\tA\t10.0.0.5', '', ';; Query time: 1 msec', ';; SERVER: 10.0.0.1#53(10.0.0.1) (UDP)'].join('\n');
    });
    add('nslookup', a => 'Server:\t\t10.0.0.1\nAddress:\t10.0.0.1#53\n\nName:\t' + (one(a) || 'api.internal') + '\nAddress: 10.0.0.5');
    add('host', a => (one(a) || 'api.internal') + ' has address 10.0.0.5');
    add('whois', a => ['Domain Name: ' + (one(a) || 'example.internal').toUpperCase(), 'Registrar: SIMULATED REGISTRY', 'Creation Date: 2019-04-02', 'Registry Expiry Date: 2027-04-02', 'Name Server: NS1.EXAMPLE.INTERNAL', '>>> Last update of whois database: 2026-02-12T06:20:00Z <<<'].join('\n'));
    add('ip', a => {
      const sub = pos(a)[0];
      if (sub === 'route' || (a || []).includes('r')) return 'default via 10.0.0.1 dev eth0\n10.0.0.0/24 dev eth0 proto kernel scope link src 10.0.0.5';
      if (sub === 'addr' || sub === 'a') return '1: lo: <LOOPBACK,UP> mtu 65536\n    inet 127.0.0.1/8 scope host lo\n2: eth0: <BROADCAST,MULTICAST,UP> mtu 1500\n    inet 10.0.0.5/24 brd 10.0.0.255 scope global eth0';
      return 'Usage: ip [ addr | route | link ]';
    });
    add('ifconfig', () => 'eth0: flags=4163<UP,BROADCAST,RUNNING,MULTICAST>  mtu 1500\n        inet 10.0.0.5  netmask 255.255.255.0  broadcast 10.0.0.255\n        ether 02:42:0a:00:00:05  txqueuelen 1000\n\nlo: flags=73<UP,LOOPBACK,RUNNING>  mtu 65536\n        inet 127.0.0.1  netmask 255.0.0.0');
    add('netstat', () => 'Proto Recv-Q Send-Q Local Address           Foreign Address         State\ntcp        0      0 0.0.0.0:22              0.0.0.0:*               LISTEN\ntcp        0      0 10.0.0.5:8080           0.0.0.0:*               LISTEN\ntcp        0      0 10.0.0.5:44321          10.0.0.9:51222          ESTABLISHED');
    add('ss', () => 'Netid State  Recv-Q Send-Q Local Address:Port  Peer Address:Port\ntcp   LISTEN 0      128    0.0.0.0:22          0.0.0.0:*\ntcp   LISTEN 0      64     10.0.0.5:8080       0.0.0.0:*');
    add('traceroute', a => {
      const target = one(a) || 'api.internal';
      const rows = ['traceroute to ' + target + ' (10.0.0.5), 30 hops max, 60 byte packets'];
      for (let i = 1; i <= 4; i++) rows.push(' ' + i + '  10.0.0.' + i + '  0.' + (100 + i * 20) + ' ms  0.' + (110 + i * 20) + ' ms  0.' + (120 + i * 20) + ' ms');
      rows.push(' 5  10.0.0.5  0.688 ms  0.701 ms  0.744 ms');
      return rows.join('\n');
    });
    add('arp', a => (a || []).some(x => /^-a/.test(x)) ? 'kiosk-3 (10.0.0.7) at 02:42:0a:00:00:07 [ether] on eth0\n? (10.0.0.1) at 02:42:0a:00:00:01 [ether] on eth0' : '10.0.0.7 dev eth0 lladdr 02:42:0a:00:00:07 REACHABLE');
    add('route', () => 'Kernel IP routing table\nDestination     Gateway         Genmask         Flags Metric Ref    Use Iface\ndefault         10.0.0.1        0.0.0.0         UG    0      0        0 eth0\n10.0.0.0        0.0.0.0         255.255.255.0   U     0      0        0 eth0');
    add('iptables', a => (a || []).some(x => /-L/.test(x)) ? 'Chain INPUT (policy ACCEPT)\ntarget     prot opt source               destination\nACCEPT     tcp  --  0.0.0.0/0            0.0.0.0/0            tcp dpt:22\nDROP       tcp  --  10.0.0.66            0.0.0.0/0' : '');
    add('ufw', a => (a || []).includes('status') ? 'Status: active\n\nTo                         Action      From\n--                         ------      ----\n22/tcp                     ALLOW       10.0.0.0/24\n8080/tcp                   ALLOW       10.0.0.0/24' : '');
    add('ssh', a => {
      const t = one(a) || 'dev@10.0.0.5';
      if ((a || []).some(x => /-\w*c/.test(x))) return '';
      return 'The authenticity of host \'' + t.split('@').pop() + '\' can\'t be established.\nWarning: simulated range — no connection is made.\nConnection to ' + t.split('@').pop() + ' closed.';
    });
    add('scp', a => 'notes.txt                                    100%  812     1.2MB/s   00:00');
    add('rsync', a => 'sending incremental file list\nnotes.txt\n\nsent 904 bytes  received 35 bytes  1,878.00 bytes/sec\ntotal size is 812  speedup is 0.86');
    add('nc', a => 'nc: connect to ' + (one(a) || 'localhost') + ' port ' + (pos(a)[1] || '80') + ' (tcp) failed: Connection refused (simulated)');
    add('ncat', a => C.nc(a));
    add('nmap', a => {
      const target = one(a) || '127.0.0.1';
      return ['Starting Nmap 7.94 ( https://nmap.org ) (simulated)', 'Nmap scan report for ' + target + ' (10.0.0.5)', 'Host is up (0.00042s latency).',
        'Not shown: 997 closed tcp ports (reset)', 'PORT     STATE SERVICE', '22/tcp   open  ssh', '80/tcp   open  http', '8080/tcp open  http-proxy', '', 'Nmap done: 1 IP address (1 host up) scanned in 0.41 seconds'].join('\n');
    });
    add('ftp', () => 'ftp: connect: Connection refused (simulated)');
    add('telnet', a => 'Trying ' + (one(a) || '10.0.0.5') + '...\ntelnet: Unable to connect to remote host: Connection refused');

    /* ------------------------------------------------------------ more coreutils */
    add('arch', () => 'x86_64');
    add('lsof', a => ['COMMAND    PID USER   FD   TYPE DEVICE SIZE/OFF NODE NAME', 'agentd    2210 ' + user + '    4u  IPv4  31204      0t0  TCP *:8080 (LISTEN)', 'sshd      3311 root    3u  IPv4  28810      0t0  TCP 10.0.0.5:22 (LISTEN)', 'bash       812 ' + user + '  cwd    DIR  254,1     4096    2 /'].join('\n'));
    add('watch', (a, stdin) => { const names = pos(a).filter(x => !/^\d+$/.test(x)); const fn = names.length ? C[names[0]] : null; return fn ? asText(fn(names.slice(1), stdin)) : 'watch: no command given'; });
    add('split', a => {
      const names = pos(a); const f = names[0]; const r = f ? read(f) : { err: true };
      if (r.err) return 'split: ' + (f || '') + ': No such file or directory';
      const lines = r.text.split('\n'); const size = parseInt(((a || []).find(x => /^-\d+$/.test(x)) || '-1000').slice(1), 10) || 1000;
      const parts = Math.max(1, Math.ceil(lines.length / size));
      for (let i = 0; i < parts; i++) api.write((names[1] || 'x') + (i ? String.fromCharCode(97 + i) : 'a'), lines.slice(i * size, (i + 1) * size).join('\n'));
      return '';
    });
    add('join', a => {
      const names = pos(a); if (names.length < 2) return 'join: missing operand';
      const l1 = text(names[0]), l2 = text(names[1]);
      if (l1 == null || l2 == null) return 'join: No such file or directory';
      const right = new Map(l2.split('\n').map(l => [l.split(/\s+/)[0], l]));
      return l1.split('\n').map(l => { const k = l.split(/\s+/)[0]; return right.has(k) ? l + ' ' + right.get(k).slice(k.length).trim() : null; }).filter(Boolean).join('\n');
    });
    add('expand', (a, stdin) => { const r = one(a) ? read(one(a)) : { text: stdin || '' }; return r.err ? 'expand: ' + one(a) + ': No such file or directory' : r.text.replace(/\t/g, '        '); });
    add('unexpand', (a, stdin) => { const r = one(a) ? read(one(a)) : { text: stdin || '' }; return r.err ? 'unexpand: ' + one(a) + ': No such file or directory' : r.text.replace(/ {8}/g, '\t'); });
    add('truncate', a => { const f = pos(a).pop(); const r = f ? read(f) : { err: true }; return r.err ? 'truncate: cannot open \'' + (f || '') + '\' for writing: No such file or directory' : ''; });
    add('shred', a => './' + (one(a) || ''));
    add('dd', a => '0+1 records in\n0+1 records out\n512 bytes copied, 0.0004 s, 1.2 MB/s');
    add('sync', () => '');
    add('timeout', (a, stdin) => { const names = pos(a); const cmd = names[1]; const fn = cmd ? C[cmd] : null; return fn ? asText(fn(names.slice(2), stdin)) : 'timeout: failed to run command \'' + (cmd || '') + '\': No such file or directory'; });
    add('time', () => 'real\t0m0.002s\nuser\t0m0.001s\nsys\t0m0.000s');
    add('getent', a => { const n = pos(a); if (n[0] === 'passwd') return user + ':x:1000:1000:' + user + ':/home/' + user + ':/bin/bash'; if (n[0] === 'hosts') return '10.0.0.5 ' + host; return ''; });
    add('ssh-keygen', a => ['Generating public/private rsa key pair.', 'Your identification has been saved in /home/' + user + '/.ssh/id_rsa', 'Your public key has been saved in /home/' + user + '/.ssh/id_rsa.pub', 'The key fingerprint is:', 'SHA256:SimulatedRangeFingerprintNotARealKey ' + user + '@' + host].join('\n'));
    add('gpg', a => 'gpg: simulated keyring — no keys created in this range');
    add('git', a => {
      const sub = pos(a)[0] || 'status';
      if (sub === 'status') return 'On branch main\nYour branch is up to date with \'origin/main\'.\n\nChanges not staged for commit:\n  (use "git add <file>..." to update what will be committed)\n\tmodified:   notes.txt\n\nno changes added to commit (use "git add" and/or "git commit -a")';
      if (sub === 'log') return 'c0ffee1 fix: rotate the service account\na1b2c3d chore: tidy the deploy scripts\n9f8e7d6 feat: add the health endpoint';
      if (sub === 'branch') return '* main\n  experiment/retry-backoff';
      if (sub === 'remote') return 'origin\thttps://git.internal/' + user + '/app.git (fetch)\norigin\thttps://git.internal/' + user + '/app.git (push)';
      if (sub === 'diff') return 'diff --git a/notes.txt b/notes.txt\n--- a/notes.txt\n+++ b/notes.txt\n@@ -1,3 +1,3 @@\n meeting notes\n-- patch window Thursday\n+- patch window Friday\n - rotate the service account';
      if (sub === 'show') return 'commit c0ffee1\nAuthor: ' + user + ' <' + user + '@' + host + '>\nDate:   Thu Feb 12 06:10:00 2026\n\n    fix: rotate the service account';
      if (['add', 'commit', 'push', 'pull', 'fetch', 'checkout', 'switch', 'stash', 'init'].includes(sub)) return '[' + sub + '] simulated — this room has no real repository';
      return 'usage: git <command> [<args>]';
    });
    add('jq', (a, stdin) => {
      const src = (a || []).find(x => !x.startsWith('-')) || String(stdin || '{}');
      const expr = (a || []).find(x => x.startsWith('.')) || '.';
      let data; try { data = JSON.parse(src); } catch (e) { return 'jq: error (at <stdin>:0): Cannot parse input'; }
      const get = (obj, p) => p.split('.').filter(Boolean).reduce((o, k) => (o == null ? undefined : o[k]), obj);
      const val = expr === '.' ? data : get(data, expr);
      return JSON.stringify(val, null, a.includes('-c') ? 0 : 2);
    });

    /* ------------------------------------------------------------ editors & pagers */
    const noEdit = (name) => a => {
      const f = one(a);
      if (!f) return name + ': missing file name';
      return read(f).err ? name + ': ' + f + ': No such file or directory' : '';
    };
    add('nano', a => { const f = one(a); return f ? (read(f).err ? '[ new file ]' : '') + '\n[saved ' + f + ' — simulated editor, the file is unchanged]' : 'nano: no file to edit'; });
    add('vi', a => { const f = one(a); return '~ ~ ~\n:q' + (f ? ' — ' + f + ' left unchanged (simulated)' : ''); });
    add('vim', a => C.vi(a));
    add('view', a => C.vi(a));
    add('less', (a, stdin) => { const t = one(a) ? text(one(a)) : String(stdin || ''); return t == null ? 'less: ' + one(a) + ': No such file or directory' : t; });
    add('more', (a, stdin) => C.less(a, stdin));

    /* ------------------------------------------------------------ crypto / hashing helpers */
    add('openssl', a => {
      const rest = (a || []).join(' ');
      const d = rest.match(/dgst\s+-([a-z0-9]+)/i);
      if (d) return '(' + d[1].toLowerCase() + ')=' + Array.from({ length: 64 / Math.max(1, d[1].length > 6 ? 2 : 1) }, (_, i) => '0123456789abcdef'[(i * 7 + rest.length) % 16]).join('');
      if (/enc\b/.test(rest)) return 'U2FsdGVkX1+SIMULATEDRANGEKEY==';
      return 'OpenSSL 3.0.13 30 Jan 2024 (simulated)';
    });

    /* ------------------------------------------------------------ the host's own machine */
    if (m) {
      const safe = 'Nothing is sent and no host is contacted: this shell can describe this computer, but it cannot scan, connect or attack anything.';
      C.hostname = () => m.hostname || 'this-browser';
      C.arch = () => m.arch || 'x86_64';
      C.whoami = () => m.user || 'you';
      C.id = () => 'uid=' + (m.user || 'you') + ' (this browser only)';
      C.uname = a => (a || []).includes('-a')
        ? [m.os || 'unknown OS', m.hostname || 'this-browser', m.arch || '', m.browser || '', m.platform || ''].filter(Boolean).join(' ')
        : (m.os || 'unknown OS');
      C.nproc = () => String(m.cores || 1);
      C.lscpu = () => ['Architecture:          ' + (m.arch || 'unknown'), 'CPU(s):                ' + (m.cores || 1), 'Thread(s) per core:    ' + (m.threads || '—'),
        'Model name:            ' + (m.cpu || 'reported by this browser'), '  Language:            ' + (m.language || '—'), '  Screen:              ' + (m.screen || '—')].join('\n');
      C.free = () => m.memoryMb
        ? ['               total        used        free      shared  buff/cache   available', 'Mem:     ' + String(m.memoryMb).padStart(10) + '  (approximate device memory reported by this browser; per-process use is not visible)'].join('\n')
        : 'free: this browser does not report memory size';
      C.df = () => ['Filesystem      Size  Used Avail Use% Mounted on', 'browserfs          —     —     —    — /app'].join('\n');
      C.date = a => {
        const d = new Date();
        if ((a || []).some(x => /^\+/.test(x))) return d.toISOString();
        return d.toString() + ' (' + (m.timezone || 'local time') + ')';
      };
      C.uptime = () => 'up (since this tab was opened) — browser session, not a server';
      C.ps = () => ['  PID TTY          TIME CMD', '    1 ?         00:00:00 browservm (this page)', '    2 ?         00:00:00 shell (simulated)'].join('\n');
      C.env = () => ['USER=' + (m.user || 'you'), 'HOME=/app', 'SHELL=/bin/bash (simulated)', 'LANG=' + (m.language || ''), 'TZ=' + (m.timezone || ''), 'ONLINE=' + (m.online ? '1' : '0')].join('\n');
      C.ifconfig = () => ['browser0: flags=4163<UP,BROADCAST,RUNNING,MULTICAST>  mtu 1500', '        inet ' + (m.ip || '127.0.0.1') + '  netmask 255.255.255.0', '        ether ' + (m.mac || '00:00:00:00:00:00') + '  txqueuelen 1000',
        '        connection ' + (m.connection || 'unknown') + ', online ' + (m.online ? 'yes' : 'no'), '        note: the address shown is loopback; this page cannot see your public IP', '', 'lo: flags=73<UP,LOOPBACK,RUNNING>  mtu 65536', '        inet 127.0.0.1  netmask 255.0.0.0'].join('\n');
      C.ip = a => {
        if ((a || []).includes('route') || (a || []).includes('r')) return 'default via 127.0.0.1 dev browser0\n127.0.0.0/8 dev lo scope host';
        return '1: lo: <LOOPBACK,UP> mtu 65536\n    inet 127.0.0.1/8 scope host lo\n2: browser0: <BROADCAST,UP> mtu 1500\n    inet 127.0.0.1/32 scope host browser0\n    link/ether ' + (m.mac || '00:00:00:00:00:00');
      };
      C.netstat = () => 'Proto Recv-Q Send-Q Local Address           Foreign Address         State\ntcp        0      0 127.0.0.1:80            0.0.0.0:*               LISTEN (the page you are on)\n(no other sockets are visible to a web page)';
      C.ss = C.netstat;
      C.getent = () => (m.user || 'you') + ':x:1000:1000:' + (m.user || 'you') + ':/app:/bin/bash';
      /* Every network command answers the way a real box would, and every one of them ends by saying that nothing
         left the page. The shell is a simulator: it never opens a socket, scans, connects or attacks anything. */
      const wire = '  · no packet left this page — the output above is simulated';
      /* The Cyber Desktop's fake internet, seen from the moundshell: every address it knows answers with that site's
         own generated page instead of the generic simulated one. The Cyber Desktop's own Terminal sandbox does not
         load the fake internet, so there these commands keep their usual answer. */
      const cyberWeb = () => {
        try { if (typeof A !== 'undefined' && A && A.cyberWeb && A.cyberWeb.locate) return A.cyberWeb; } catch (e) { }
        try { if (typeof window !== 'undefined' && window.A && window.A.cyberWeb && window.A.cyberWeb.locate) return window.A.cyberWeb; } catch (e) { }
        return null;
      };
      const fakeAt = raw => {
        const web = cyberWeb(); if (!web) return null;
        const clean = String(raw == null ? '' : raw).trim(); if (!clean || /^127\.|^localhost$/i.test(clean)) return null;
        try { const hit = web.locate(clean.replace(/^[a-z]+:\/\//i, '').split(/[?#]/)[0]); return hit && hit.site ? { web, hit } : null; } catch (e) { return null; }
      };
      const fakeIp = site => '203.0.113.' + ((((site && site.id) || 1) % 250) + 2);
      const webOnly = found => '  · ' + found.hit.site.host + ' is a generated site from the Cyber Desktop\'s fake internet — served inside this page';
      C.ping = a => {
        const target = pos(a)[0] || 'localhost';
        const found = fakeAt(target);
        const ip = found ? fakeIp(found.hit.site) : (/^\d+\.\d+\.\d+\.\d+$/.test(target) ? target : '127.0.0.1');
        const count = (() => { const i = (a || []).indexOf('-c'); return i >= 0 ? Math.max(1, Math.min(9, parseInt(a[i + 1], 10) || 4)) : 4; })();
        const rows = ['PING ' + target + ' (' + ip + ') 56(84) bytes of data.'];
        for (let i = 1; i <= count; i++) rows.push('64 bytes from ' + ip + ': icmp_seq=' + i + ' ttl=64 time=0.0' + (2 + i) + ' ms');
        rows.push('', '--- ' + target + ' ping statistics ---', count + ' packets transmitted, ' + count + ' received, 0% packet loss, time ' + (count * 1000) + 'ms', found ? webOnly(found) : wire);
        return rows.join('\n');
      };
      C.traceroute = a => {
        const target = pos(a)[0] || 'api.internal';
        const rows = ['traceroute to ' + target + ' (127.0.0.1), 30 hops max, 60 byte packets'];
        for (let i = 1; i <= 3; i++) rows.push(' ' + i + '  gateway (' + (m.ip || '127.0.0.1') + ')  0.' + (10 + i) + '0 ms  0.' + (11 + i) + '0 ms');
        rows.push(' 4  127.0.0.1  0.402 ms  0.388 ms', wire);
        return rows.join('\n');
      };
      C.curl = a => {
        const target = pos(a).find(x => /^[a-z]+:\/\//.test(x) || /^\w[\w.-]*\.\w+/.test(x)) || 'http://127.0.0.1/';
        const url = /^[a-z]+:\/\//.test(target) ? target : 'http://' + target + '/';
        const found = fakeAt(target);
        if (found) {
          const r = found.web.serve(found.hit.site, found.hit.path, 'GET');
          const body = String(r.body == null ? '' : r.body);
          const head = ['HTTP/1.1 ' + r.status + ' ' + (r.status === 404 ? 'Not Found' : r.status === 403 ? 'Forbidden' : 'OK'),
            'Content-Type: ' + (r.type || 'text/html') + '; charset=utf-8', 'Content-Length: ' + body.length,
            'Server: moundshroud-net/1.0 (simulated)', 'Connection: close'];
          if ((a || []).some(x => /^-I|--head/.test(x))) return head.join('\n') + '\n' + webOnly(found);
          const withHead = (a || []).some(x => /^-i|--include/.test(x));
          return (withHead ? head.join('\n') + '\n\n' : '') + body.slice(0, 20000) +
            (body.length > 20000 ? '\n… ' + (body.length - 20000) + ' more characters' : '') + '\n' + webOnly(found);
        }
        if ((a || []).some(x => /^-I|--head/.test(x))) return 'HTTP/1.1 200 OK\nDate: ' + new Date().toUTCString() + '\nServer: nginx/1.24.0\nContent-Type: text/html\nContent-Length: 612\nConnection: keep-alive\n' + wire;
        return '<!doctype html>\n<html><head><title>Simulated host</title></head>\n<body><h1>' + url + '</h1><p>This response is fabricated for the exercise.</p></body></html>\n' + wire;
      };
      C.wget = a => {
        const target = pos(a).find(x => /^[a-z]+:\/\//.test(x)) || pos(a)[0] || 'http://127.0.0.1/';
        const found = fakeAt(target);
        if (found) {
          const r = found.web.serve(found.hit.site, found.hit.path, 'GET');
          const body = String(r.body == null ? '' : r.body), size = body.length;
          const file = (found.hit.path.split('?')[0].split('/').filter(Boolean).pop() || 'index.html').replace(/[^\w.-]/g, '') || 'index.html';
          const when = new Date().toISOString().replace('T', ' ').slice(0, 19);
          return ['--' + when + '--  ' + target, 'Resolving ' + found.hit.site.host + '... ' + fakeIp(found.hit.site),
            'Connecting to ' + found.hit.site.host + '|' + fakeIp(found.hit.site) + '|:443... connected.',
            'HTTP request sent, awaiting response... ' + r.status + (r.status === 200 ? ' OK' : ''),
            'Length: ' + size + ' [' + (r.type || 'text/html') + ']', "Saving to: '" + file + "'", '',
            file + '  ' + new Array(16).join(' ') + '  ' + size + '  --.-KB/s    in 0s', '',
            when + ' (' + (Math.max(0.4, size / 24000)).toFixed(1) + ' MB/s) - ' + "'" + file + "' saved [" + size + '/' + size + ']',
            webOnly(found)].join('\n');
        }
        return ['--' + new Date().toISOString().replace('T', ' ').slice(0, 19) + '--  ' + target, 'Resolving host... 127.0.0.1',
          'Connecting to host|127.0.0.1|:80... connected.', 'HTTP request sent, awaiting response... 200 OK', 'Length: 612 [text/html]',
          "Saving to: 'index.html'", '', 'index.html          100%[===================>]     612  --.-KB/s    in 0s',
          '', "2026-02-12 06:20:00 (42.1 MB/s) - 'index.html' saved [612/612]", wire].join('\n');
      };
      C.nmap = a => {
        const target = pos(a)[0] || '127.0.0.1';
        const found = fakeAt(target);
        if (found) {
          const host = found.hit.site.host;
          return ['Starting Nmap 7.94 ( https://nmap.org ) (simulated)', 'Nmap scan report for ' + host + ' (' + fakeIp(found.hit.site) + ')',
            'Host is up (0.00063s latency).', 'Not shown: 996 closed tcp ports (reset)', 'PORT     STATE SERVICE',
            '22/tcp   open  ssh', '80/tcp   open  http', '443/tcp  open  https', '8080/tcp open  http-proxy', '',
            'Nmap done: 1 IP address (1 host up) scanned in 0.38 seconds', webOnly(found)].join('\n');
        }
        return ['Starting Nmap 7.94 ( https://nmap.org ) (simulated)', 'Nmap scan report for ' + target + ' (127.0.0.1)',
          'Host is up (0.00042s latency).', 'Not shown: 997 closed tcp ports (reset)', 'PORT     STATE SERVICE',
          '22/tcp   open  ssh', '80/tcp   open  http', '8080/tcp open  http-proxy', '',
          'Nmap done: 1 IP address (1 host up) scanned in 0.41 seconds', wire].join('\n');
      };
      C.ssh = a => {
        const t = (pos(a)[0] || 'dev@127.0.0.1');
        if ((a || []).some(x => /-\w*c/.test(x))) return '';
        return 'The authenticity of host \'' + t.split('@').pop() + '\' can\'t be established.\n' +
          'ED25519 key fingerprint is SHA256:4d1fV8jQ2m0nLb7cR9pYs6tK3wEa5hG0.\n' +
          'Warning: Permanently added \'' + t.split('@').pop() + '\' (ED25519) to the list of known hosts.\n' +
          'Connection to ' + t.split('@').pop() + ' closed.\n' + wire;
      };
      C.scp = () => 'notes.txt                                    100%  812     1.2MB/s   00:00\n' + wire;
      C.rsync = () => 'sending incremental file list\nnotes.txt\n\nsent 904 bytes  received 35 bytes  1,878.00 bytes/sec\ntotal size is 812  speedup is 0.86\n' + wire;
      C.nc = a => 'nc: connect to ' + (pos(a)[0] || '127.0.0.1') + ' port ' + (pos(a)[1] || '80') + ' (tcp) failed: Connection refused\n' + wire;
      C.ncat = a => C.nc(a);
      C.telnet = a => 'Trying ' + (pos(a)[0] || '127.0.0.1') + '...\ntelnet: Unable to connect to remote host: Connection refused\n' + wire;
      C.ftp = () => 'ftp: connect: Connection refused\n' + wire;
      C.iptables = a => (a || []).some(x => /-L/.test(x)) ? 'Chain INPUT (policy ACCEPT)\ntarget     prot opt source               destination\nACCEPT     tcp  --  0.0.0.0/0            0.0.0.0/0            tcp dpt:22\nDROP       tcp  --  10.0.0.66            0.0.0.0/0\n  · firewall rules shown are simulated; a web page cannot read the real table' : '';
      C.ufw = a => (a || []).includes('status') ? 'Status: active\n\nTo                         Action      From\n--                         ------      ----\n22/tcp                     ALLOW       10.0.0.0/24\n8080/tcp                   ALLOW       10.0.0.0/24\n  · simulated: a web page cannot read the real firewall' : '';
      C.journalctl = () => ['-- Journal begins at Mon 2026-02-09, ends Thu 2026-02-12 --', 'Feb 12 06:01:02 ' + (m.hostname || 'localhost') + ' systemd[1]: Started daily maintenance.', 'Feb 12 06:07:41 ' + (m.hostname || 'localhost') + ' agentd[2210]: session check ok', '  · simulated journal (a web page cannot read the system log)'].join('\n');
      C.dmesg = () => ['[    0.000000] Linux version 6.6.0 (simulated)', '[    0.412031] virtio_blk: vda1', '[    1.204118] random: crng init done', '  · simulated kernel log'].join('\n');
      C.lsblk = () => ['NAME   MAJ:MIN RM  SIZE RO TYPE MOUNTPOINT', 'vda    252:0    0   40G  0 disk', '└─vda1 252:1    0   40G  0 part /', '  · simulated: disks are not exposed to a web page'].join('\n');
      C.mount = () => '/dev/vda1 on / type ext4 (rw,relatime)\ntmpfs on /dev/shm type tmpfs (rw,nosuid,nodev)\n  · simulated mount table (a web page cannot read the real one)';
      C.crontab = a => ((a || []).some(x => /^-l/.test(x)) ? '# no crontab for ' + (m.user || 'you') : 'crontab: not available in the moundshell');
      C.systemctl = a => /status/.test((a || []).join(' ')) ? 'Unit ' + ((a || [])[1] || 'app') + '.service\n     Loaded: loaded (/lib/systemd/system/app.service; enabled)\n     Active: active (running)\n  · simulated: no systemd is reachable from a browser' : '';
      C.service = () => '';
      /* keep the honest warning for anything the generic simulation would otherwise present as a real connection */
      void safe;
      C.sudo = (a, stdin) => { const n = pos(a); if (!n.length) return 'usage: sudo command [args]'; const fn = C[n[0]]; return fn ? fn(n.slice(1), stdin) : 'sudo: ' + n[0] + ': command not found'; };
    }

    /* ------------------------------------------------------------ the everyday shell the rooms were still missing */
    const defaultEnv = () => ({
      USER: user, LOGNAME: user, HOME: isWin ? 'C:\\Users\\' + user : '/home/' + user, SHELL: isWin ? '' : '/bin/bash',
      PATH: isWin ? 'C:\\Windows\\system32;C:\\Windows' : '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin',
      PWD: m ? '/app' : '/', TERM: 'xterm-256color', LANG: 'en_GB.UTF-8', HOSTNAME: host
    });
    add('env', () => Object.entries(m ? Object.assign(defaultEnv(), { USER: m.user || user, HOME: '/app' }) : defaultEnv()).map(([k, v]) => k + '=' + v).join('\n'));
    add('printenv', a => { const k = one(a); if (!k) return C.env(); const e = m ? Object.assign(defaultEnv(), { USER: m.user || user, HOME: '/app' }) : defaultEnv(); return Object.hasOwn(e, k) ? e[k] : ''; });
    add('tty', () => '/dev/pts/0');
    add('man', a => {
      const n = one(a); if (!n) return 'What manual page do you want?';
      if (!C[n]) return 'No manual entry for ' + n;
      return n.toUpperCase() + '(1)\n\nNAME\n    ' + n + ' - ' + (C[n] ? 'shell command available in this simulated host' : '') + '\n\nSYNOPSIS\n    ' + n + ' [OPTION]... [FILE]...\n\nDESCRIPTION\n    Runs ' + n + ' against this shell\'s own filesystem.', '', 'SEE ALSO\n    help, which, type';
    });
    add('apropos', a => { const w = one(a) || ''; return w ? w + ' (1)               - shell command\n' + w + ' (5)               - file formats' : 'apropos: what do you want to search for?'; });
    add('whatis', a => { const n = one(a); return n ? n + ' (1) - ' + (C[n] ? 'shell command' : 'nothing appropriate') : 'whatis: missing operand'; });
    add('whereis', a => { const n = one(a); if (!n) return 'whereis: missing operand'; return n + ': /usr/bin/' + n + (C[n] ? '' : ' (not found)'); });
    add('locate', a => {
      const pat = (one(a) || '').toLowerCase();
      if (!pat) return 'locate: no pattern to search for specified';
      const hits = [];
      const scan = (dir, depth) => {
        if (hits.length >= 400 || depth > 10) return;
        const l = api.list(dir);
        if (!l || l.err) return;
        const dirs = new Set(l.dirs || []);
        for (const name of l.names) {
          const p = clean(dir).replace(/\/+$/, '') + '/' + name;
          if (name.toLowerCase().includes(pat)) hits.push(p.replace(/^\.\//, ''));
          if (dirs.has(name)) scan(p, depth + 1);
        }
      };
      scan('.', 0);
      return hits.length ? hits.join('\n') : 'locate: no matches';
    });
    add('updatedb', () => '');
    add('cmp', a => { const f = pos(a); if (!f[1]) return 'cmp: missing operand'; const x = text(f[0]), y = text(f[1]); if (x == null || y == null) return 'cmp: No such file or directory'; return x === y ? '' : f[0] + ' ' + f[1] + ' differ: byte 1, line 1'; });
    add('patch', a => { const f = pos(a).pop(); if (!f) return 'patch: missing file'; return read(f).err ? 'can\'t find file ' + f : 'patching file ' + f + '\nHunk #1 succeeded at 1.'; });
    add('install', a => { const p = pos(a); if (p.length < 2) return 'install: missing destination file operand'; const r = read(p[0]); if (r.err) return 'install: cannot stat \'' + p[0] + '\': No such file or directory'; api.write(p[p.length - 1], r.text); return ''; });
    add('mkfifo', a => { const p = one(a); if (!p) return 'mkfifo: missing operand'; api.write(p, ''); return ''; });
    add('mesg', () => 'is y');
    add('wall', () => '');
    add('nice', (a, stdin) => { const names = pos(a).filter(x => !/^-?\d+$/.test(x)); const fn = names.length ? C[names[0]] : null; return fn ? asText(fn(names.slice(1), stdin)) : ''; });
    add('renice', () => 'renice: simulated — process priorities do not change');
    add('pidof', a => one(a) ? '2210' : 'pidof: missing operand');
    add('pstree', () => ['systemd(1)─┬─agentd(2210)───bash(812)───ps(1180)', '           ├─sshd(3311)', '           └─systemd-journal(410)'].join('\n'));
    add('vmstat', () => 'procs -----------memory---------- ---swap-- -----io---- -system-- ------cpu-----\n r  b   swpd   free   buff  cache   si   so    bi    bo   in   cs us sy id wa st\n 1  0      0 3102412 133120 2734028    0    0    12    34  120  240  2  1 97  0  0');
    add('iostat', () => 'Linux 6.6.0 (' + host + ')\n\nDevice             tps    kB_read/s    kB_wrtn/s    kB_dscd/s    kB_read    kB_wrtn\nvda               2.41        18.20         9.44         0.00     812344     421120');
    add('mpstat', () => 'Linux 6.6.0 (' + host + ') \t06:20:00\t_x86_64_\t(8 CPU)\n\n06:20:00     CPU    %usr   %nice    %sys %iowait    %irq   %soft  %steal  %guest  %gnice   %idle\n06:20:00     all    2.10    0.00    0.70    0.30    0.00    0.10    0.00    0.00    0.00   96.80');
    add('iotop', () => 'Total DISK READ:         0.00 B/s | Total DISK WRITE:        12.40 K/s\n  TID  PRIO  USER     DISK READ  DISK WRITE  SWAPIN     IO>    COMMAND\n 2210 be/4 ' + user + '      0.00 B/s   12.40 K/s  0.00 %  0.12 % agentd');
    add('tcpdump', () => ['tcpdump: verbose output suppressed, use -v[v]... for full protocol decode', 'listening on eth0, link-type EN10MB (Ethernet), snapshot length 262144 bytes',
      '06:20:01.104 IP 10.0.0.5.49822 > 20.42.65.90.443: Flags [P.], seq 1:64, ack 1, length 63',
      '06:20:01.118 IP 20.42.65.90.443 > 10.0.0.5.49822: Flags [.], ack 64, length 0', '2 packets captured', '2 packets received by filter', '0 packets dropped by kernel', '  · simulated capture — nothing is sniffed from this computer'].join('\n'));
    add('nft', () => 'table inet filter {\n\tchain input {\n\t\ttype filter hook input priority filter; policy accept;\n\t\tct state established,related accept\n\t\ttcp dport 22 accept\n\t}\n}');
    add('nmcli', () => 'DEVICE  TYPE      STATE      CONNECTION\neth0    ethernet  connected  Wired connection 1\nlo      loopback  unmanaged  --');
    add('iwconfig', () => 'lo        no wireless extensions.\n\neth0      no wireless extensions.');
    add('ethtool', () => 'Settings for eth0:\n\tSupported ports: [ TP ]\n\tSpeed: 1000Mb/s\n\tDuplex: Full\n\tLink detected: yes');
    add('resolvectl', () => 'Global\n       Protocols: -LLMNR -mDNS -DNSOverTLS DNSSEC=no/unsupported\nresolv.conf mode: stub\n\nLink 2 (eth0)\n    Current Scopes: DNS\n         DNS Servers: 10.0.0.9\n          DNS Domain: internal');
    add('timedatectl', () => '               Local time: Thu 2026-02-12 06:20:00 UTC\n           Universal time: Thu 2026-02-12 06:20:00 UTC\n                 RTC time: Thu 2026-02-12 06:20:00\n                Time zone: Etc/UTC (UTC, +0000)\nSystem clock synchronized: yes\n              NTP service: active\n          RTC in local TZ: no');
    add('localectl', () => 'System Locale: LANG=en_GB.UTF-8\n    VC Keymap: n/a\n   X11 Layout: us');
    add('loginctl', () => 'SESSION  UID USER       SEAT  TTY\n      2 1000 ' + user + '        seat0 pts/0\n\n1 sessions listed.');
    add('systemd-analyze', () => 'Startup finished in 2.114s (kernel) + 4.382s (userspace) = 6.497s\ngraphical.target reached after 4.371s in userspace.');
    add('locale', () => 'LANG=en_GB.UTF-8\nLANGUAGE=\nLC_CTYPE="en_GB.UTF-8"\nLC_ALL=');
    add('hostid', () => '007f0101');
    add('lsmod', () => 'Module                  Size  Used by\nxt_conntrack           16384  1\nnf_conntrack          172032  1 xt_conntrack\nvirtio_net             61440  0\next4                  409600  1');
    add('modinfo', a => 'filename:       /lib/modules/6.6.0/kernel/' + (one(a) || 'ext4') + '.ko\nlicense:        GPL\ndescription:    ' + (one(a) || 'ext4') + ' driver');
    add('lspci', () => '00:00.0 Host bridge: Intel Corporation 82G33/G31/P35/P31 Express DRAM Controller\n00:01.0 VGA compatible controller: Device 1234:1111\n00:03.0 Ethernet controller: Intel Corporation 82540EM Gigabit Ethernet Controller (rev 03)');
    add('lsusb', () => 'Bus 001 Device 001: ID 1d6b:0002 Linux Foundation 2.0 root hub\nBus 001 Device 002: ID 0627:0001 Adomax Technology Co., Ltd QEMU USB Tablet');
    add('dmidecode', () => '# dmidecode 3.3\nGetting SMBIOS data from sysfs.\n\nSystem Information\n\tManufacturer: QEMU\n\tProduct Name: Standard PC (Q35 + ICH9, 2009)\n\tVersion: pc-q35-8.2');
    add('sensors', () => 'coretemp-isa-0000\nAdapter: ISA adapter\nPackage id 0:  +41.0°C  (high = +80.0°C, crit = +100.0°C)\nCore 0:        +39.0°C  (high = +80.0°C, crit = +100.0°C)');
    add('smartctl', () => 'smartctl 7.4 2023-08-01 r5530 [x86_64-linux-6.6.0]\n=== START OF INFORMATION SECTION ===\nModel Family:     QEMU HARDDISK\nSMART overall-health self-assessment test result: PASSED');
    add('apt', a => {
      const sub = pos(a)[0] || '';
      if (sub === 'list') return ['Listing... Done', 'bash/jammy,now 5.1-6ubuntu1 amd64 [installed]', 'curl/jammy-updates,now 7.81.0-1ubuntu1.15 amd64 [installed]',
        'git/jammy,now 1:2.34.1-1ubuntu1.10 amd64 [installed]', 'openssh-server/jammy-updates,now 1:8.9p1-3ubuntu0.6 amd64 [installed]',
        'python3/jammy,now 3.10.6-1~22.04 amd64 [installed]'].join('\n');
      if (sub === 'search') return (one(a.slice(1)) || 'tool') + '/jammy 1.0 amd64\n  simulated package entry for ' + (one(a.slice(1)) || 'tool');
      if (sub === 'show') return 'Package: ' + (one(a.slice(1)) || 'bash') + '\nVersion: 5.1-6ubuntu1\nArchitecture: amd64\nDescription: simulated package metadata';
      if (sub === 'update') return 'Hit:1 http://archive.ubuntu.com/ubuntu jammy InRelease\nReading package lists... Done\nBuilding dependency tree... Done\nAll packages are up to date.';
      return 'apt ' + (pos(a).join(' ') || '--help') + ': this host is offline — nothing is downloaded or installed';
    });
    add('apt-get', a => C.apt(a));
    add('dpkg', a => {
      if ((a || []).some(x => /^-l/.test(x))) return ['Desired=Unknown/Install/Remove/Purge/Hold', '||/ Name           Version      Architecture Description', '+++-==============-============-============-=================================',
        'ii  bash           5.1-6ubuntu1 amd64        GNU Bourne Again SHell', 'ii  curl           7.81.0       amd64        command line tool for transferring data', 'ii  git            2.34.1       amd64        fast, scalable, distributed revision control system', 'ii  openssh-server 8.9p1        amd64        secure shell server'].join('\n');
      return 'dpkg: this host is offline — packages cannot be changed';
    });
    add('snap', () => 'Name    Version   Rev    Tracking       Publisher   Notes\ncore20  20240111  2182   latest/stable  canonical✓  base\nsnapd   2.61.3    20671  latest/stable  canonical✓  snapd');
    add('pip', a => (a || []).some(x => /--version|-V/.test(x)) ? 'pip 23.0.1 from /usr/lib/python3/dist-packages/pip (python 3.10)' : 'Usage: pip <command> [options]\n  list, show, install (offline host: nothing is fetched)');
    add('pip3', a => C.pip(a));
    add('python3', a => {
      if ((a || []).some(x => /--version|-V/.test(x))) return 'Python 3.10.12';
      if ((a || []).some(x => /-c/.test(x))) return '';
      const f = pos(a)[0];
      if (f) { const r = read(f); return r.err ? 'python3: can\'t open file \'' + f + '\': [Errno 2] No such file or directory' : 'python3: running ' + f + ' is not supported in this terminal (use the Python sandbox)'; }
      return 'Python 3.10.12 (main, Nov 20 2023, 15:14:05) [GCC 11.4.0] on linux\nType "help", "copyright", "credits" or "license" for more information.\n>>> (interactive Python is not available here — use the Python sandbox) ';
    });
    add('python', a => C.python3(a));
    add('node', a => (a || []).some(x => /--version|-v/.test(x)) ? 'v20.11.1' : 'Welcome to Node.js v20.11.1.\nType ".help" for more information.\n> (interactive Node is not available here — use the Node sandbox) ');
    add('npm', a => (a || []).some(x => /--version|-v/.test(x)) ? '10.2.4' : 'npm <command>\n\nUsage:\n  npm install        install all the dependencies in your project\n  npm test           run this project\'s tests\n  npm run <script>   run a script from package.json');
    add('gcc', a => (a || []).some(x => /--version/.test(x)) ? 'gcc (Ubuntu 11.4.0-1ubuntu1~22.04) 11.4.0\nCopyright (C) 2021 Free Software Foundation, Inc.' : 'gcc: fatal error: no input files\ncompilation terminated.');
    add('make', a => (a || []).some(x => /--version/.test(x)) ? 'GNU Make 4.3\nBuilt for x86_64-pc-linux-gnu' : 'make: *** No targets specified and no makefile found.  Stop.');
    add('docker', a => {
      const sub = pos(a)[0] || '';
      if (sub === 'ps') return 'CONTAINER ID   IMAGE          COMMAND                  STATUS          NAMES\n3f1a2b9c7d10   app:1.4        "node server.js"          Up 9 days       app-web-1';
      if (sub === 'images') return 'REPOSITORY   TAG       IMAGE ID       SIZE\napp          1.4       a8758716bb6a   412MB';
      if (sub === '--version' || sub === 'version') return 'Docker version 26.1.4, build 5650f9b';
      return 'docker: the container engine is not running in this terminal (use the Docker sandbox)';
    });
    add('kubectl', a => (a || []).some(x => /version/.test(x)) ? 'Client Version: v1.29.2\nKustomize Version: v5.0.4' : 'The connection to the server localhost:8080 was refused - did you specify the right host or port?');

    /* ------------------------------------------------------------ small helpers the additions share */
    const grepLike = (a, stdin, extended) => {
      const names = pos(a);
      const pattern = names.shift();
      if (!pattern) return 'grep: missing pattern';
      const flags = (a || []).filter(x => /^-/.test(x)).join('');
      let re;
      try {
        re = new RegExp(extended ? pattern : pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), /i/.test(flags) ? 'i' : '');
      } catch (e) { return 'grep: invalid regular expression'; }
      const want = !/v/.test(flags);
      const rows = [];
      const trip = (text) => {
        textLines(text).forEach((line, i) => {
          if (re.test(line) !== want) return;
          rows.push(flags.includes('n') ? (i + 1) + ':' + line : line);
        });
      };
      if (!names.length) { trip(String(stdin == null ? '' : stdin), ''); }
      else for (const name of names) { const r = read(name); if (r.err) return 'grep: ' + name + ': No such file or directory'; trip(r.text, ''); }
      if (flags.includes('c')) return String(rows.length);
      return rows.join('\n');
    };

    /* SHA-512, because `sha512sum` is a normal word on a Linux box and a fake digest would be worse than none */
    const M64 = (1n << 64n) - 1n;
    const rotr = (x, n) => ((x >> n) | (x << (64n - n))) & M64;
    const K512 = ['428a2f98d728ae22', '7137449123ef65cd', 'b5c0fbcfec4d3b2f', 'e9b5dba58189dbbc', '3956c25bf348b538', '59f111f1b605d019', '923f82a4af194f9b', 'ab1c5ed5da6d8118',
      'd807aa98a3030242', '12835b0145706fbe', '243185be4ee4b28c', '550c7dc3d5ffb4e2', '72be5d74f27b896f', '80deb1fe3b1696b1', '9bdc06a725c71235', 'c19bf174cf692694',
      'e49b69c19ef14ad2', 'efbe4786384f25e3', '0fc19dc68b8cd5b5', '240ca1cc77ac9c65', '2de92c6f592b0275', '4a7484aa6ea6e483', '5cb0a9dcbd41fbd4', '76f988da831153b5',
      '983e5152ee66dfab', 'a831c66d2db43210', 'b00327c898fb213f', 'bf597fc7beef0ee4', 'c6e00bf33da88fc2', 'd5a79147930aa725', '06ca6351e003826f', '142929670a0e6e70',
      '27b70a8546d22ffc', '2e1b21385c26c926', '4d2c6dfc5ac42aed', '53380d139d95b3df', '650a73548baf63de', '766a0abb3c77b2a8', '81c2c92e47edaee6', '92722c851482353b',
      'a2bfe8a14cf10364', 'a81a664bbc423001', 'c24b8b70d0f89791', 'c76c51a30654be30', 'd192e819d6ef5218', 'd69906245565a910', 'f40e35855771202a', '106aa07032bbd1b8',
      '19a4c116b8d2d0c8', '1e376c085141ab53', '2748774cdf8eeb99', '34b0bcb5e19b48a8', '391c0cb3c5c95a63', '4ed8aa4ae3418acb', '5b9cca4f7763e373', '682e6ff3d6b2b8a3',
      '748f82ee5defb2fc', '78a5636f43172f60', '84c87814a1f0ab72', '8cc702081a6439ec', '90befffa23631e28', 'a4506cebde82bde9', 'bef9a3f7b2c67915', 'c67178f2e372532b',
      'ca273eceea26619c', 'd186b8c721c0c207', 'eada7dd6cde0eb1e', 'f57d4f7fee6ed178', '06f067aa72176fba', '0a637dc5a2c898a6', '113f9804bef90dae', '1b710b35131c471b',
      '28db77f523047d84', '32caab7b40c72493', '3c9ebe0a15c9bebc', '431d67c49c100d4c', '4cc5d4becb3e42b6', '597f299cfc657e2a', '5fcb6fab3ad6faec', '6c44198c4a475817'].map(k => BigInt('0x' + k));
    const sha512hex = text => {
      const bytes = new TextEncoder().encode(String(text == null ? '' : text));
      const total = Math.ceil((bytes.length + 17) / 128) * 128;
      const data = new Uint8Array(total);
      data.set(bytes); data[bytes.length] = 0x80;
      const dv = new DataView(data.buffer);
      dv.setBigUint64(total - 8, BigInt(bytes.length) * 8n);
      const H = ['6a09e667f3bcc908', 'bb67ae8584caa73b', '3c6ef372fe94f82b', 'a54ff53a5f1d36f1', '510e527fade682d1', '9b05688c2b3e6c1f', '1f83d9abfb41bd6b', '5be0cd19137e2179'].map(h => BigInt('0x' + h));
      for (let off = 0; off < total; off += 128) {
        const w = new Array(80);
        for (let i = 0; i < 16; i++) w[i] = dv.getBigUint64(off + i * 8);
        for (let i = 16; i < 80; i++) {
          const s0 = rotr(w[i - 15], 1n) ^ rotr(w[i - 15], 8n) ^ (w[i - 15] >> 7n);
          const s1 = rotr(w[i - 2], 19n) ^ rotr(w[i - 2], 61n) ^ (w[i - 2] >> 6n);
          w[i] = (w[i - 16] + s0 + w[i - 7] + s1) & M64;
        }
        let [a, b, c, d, e, f, g, h] = H;
        for (let i = 0; i < 80; i++) {
          const S1 = rotr(e, 14n) ^ rotr(e, 18n) ^ rotr(e, 41n);
          const ch = (e & f) ^ (~e & g & M64);
          const t1 = (h + S1 + ch + K512[i] + w[i]) & M64;
          const S0 = rotr(a, 28n) ^ rotr(a, 34n) ^ rotr(a, 39n);
          const maj = (a & b) ^ (a & c) ^ (b & c);
          const t2 = (S0 + maj) & M64;
          h = g; g = f; f = e; e = (d + t1) & M64; d = c; c = b; b = a; a = (t1 + t2) & M64;
        }
        const next = [a, b, c, d, e, f, g, h];
        for (let i = 0; i < 8; i++) H[i] = (H[i] + next[i]) & M64;
      }
      return H.map(x => x.toString(16).padStart(16, '0')).join('');
    };

    const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    const base32 = text => {
      const bytes = new TextEncoder().encode(String(text == null ? '' : text));
      let bits = 0, value = 0, out = '';
      for (const byte of bytes) {
        value = (value << 8) | byte; bits += 8;
        while (bits >= 5) { out += B32[(value >>> (bits - 5)) & 31]; bits -= 5; }
      }
      if (bits > 0) out += B32[(value << (5 - bits)) & 31];
      while (out.length % 8) out += '=';
      return out;
    };
    const unbase32 = text => {
      const clean32 = String(text == null ? '' : text).toUpperCase().replace(/[^A-Z2-7]/g, '');
      let bits = 0, value = 0;
      const out = [];
      for (const ch of clean32) {
        value = (value << 5) | B32.indexOf(ch); bits += 5;
        if (bits >= 8) { out.push((value >>> (bits - 8)) & 255); bits -= 8; }
      }
      try { return new TextDecoder().decode(new Uint8Array(out)); } catch (e) { return ''; }
    };

    if (typeof TerminalUnix !== 'undefined' || typeof require === 'function') {
      const UnixKit = typeof TerminalUnix !== 'undefined' ? TerminalUnix
        : (() => { try { return require('./terminal-unix.js'); } catch (e) { return null; } })();
      if (UnixKit && UnixKit.checksum) {
        add('sha1sum', UnixKit.checksum('sha1', read));
        add('sha256sum', UnixKit.checksum('sha256', read));
        add('md5sum', UnixKit.checksum('md5', read));
      }
    }
    add('sha512sum', (a, stdin) => {
      const names = pos(a);
      if (!names.length) return sha512hex(stdin == null ? '' : stdin) + '  -';
      const rows = [];
      for (const n of names) { const r = read(n); if (r.err) rows.push("sha512sum: " + n + ": No such file or directory"); else rows.push(sha512hex(r.text) + '  ' + n); }
      return rows.join('\n');
    });
    add('base32', (a, stdin) => {
      const names = pos(a);
      const decode = (a || []).some(x => /^-d|--decode/.test(x));
      const source = names.length ? read(names[0]) : { text: stdin == null ? '' : stdin };
      if (source.err) return 'base32: ' + (names[0] || '') + ': No such file or directory';
      return decode ? unbase32(source.text) : base32(source.text);
    });
    add('printf', (a, stdin) => {
      if (!a || !a.length) return '';
      const format = String(a[0]).replace(/\\n/g, '\n').replace(/\\t/g, '\t').replace(/\\r/g, '\r').replace(/\\\\/g, '\\');
      const rest = (a || []).slice(1);
      let index = 0;
      let out = format.replace(/%([sdifxX%])/g, (m, spec) => {
        if (spec === '%') return '%';
        const value = rest[index++];
        if (spec === 'd' || spec === 'i') return String(parseInt(value, 10) || 0);
        if (spec === 'f') return String(parseFloat(value) || 0);
        if (spec === 'x' || spec === 'X') return (parseInt(value, 10) || 0).toString(16);
        return value == null ? '' : String(value);
      });
      /* printf repeats its format while arguments remain */
      while (index < rest.length) {
        out += '\n' + format.replace(/%([sdifxX%])/g, (m, spec) => spec === '%' ? '%' : String(rest[index++] ?? ''));
      }
      return out;
    });
    add('tee', (a, stdin) => {
      const names = pos(a);
      const text = String(stdin == null ? '' : stdin);
      for (const n of names) {
        if (typeof api.append === 'function') api.append(n, text);
        else { const prev = read(n); api.write(n, prev.err || !a.some(x => /-a/.test(x)) ? text : String(prev.text) + text); }
      }
      return text;
    });
    add('diff', (a, stdin) => {
      const names = pos(a);
      if (names.length < 2) return String(stdin == null ? '' : stdin);
      const left = read(names[0]), right = read(names[1]);
      if (left.err) return 'diff: ' + names[0] + ': No such file or directory';
      if (right.err) return 'diff: ' + names[1] + ': No such file or directory';
      const l = textLines(left.text), r = textLines(right.text);
      if (l.join('\n') === r.join('\n')) return '';
      const rows = ['--- ' + names[0] + '\t2026-02-12 06:20:00', '+++ ' + names[1] + '\t2026-02-12 06:20:00'];
      const max = Math.max(l.length, r.length);
      for (let i = 0; i < max; i++) {
        if (l[i] === r[i]) { if (!/^-q|-u/.test((a || []).join(' '))) rows.push(' ' + (l[i] ?? '')); continue; }
        if (l[i] !== undefined) rows.push('-' + l[i]);
        if (r[i] !== undefined) rows.push('+' + r[i]);
      }
      return rows.join('\n');
    });
    add('cat', (a, stdin) => {
      const names = pos(a);
      if (!names.length) return String(stdin == null ? '' : stdin);
      const rows = [];
      for (const n of names) { const r = read(n); if (r.err) rows.push('cat: ' + r.err); else rows.push(r.text); }
      return rows.join('\n');
    });
    add('head', (a, stdin) => {
      const n = Math.max(1, parseInt(((a || []).find(x => /^-\d+$/.test(x)) || '').slice(1) || ((a || [])[(a || []).indexOf('-n') + 1]) || '10', 10) || 10);
      const skip = new Set([(a || []).indexOf('-n') + 1].filter(i => i > 0));
      const file = (a || []).filter((x, i) => !x.startsWith('-') && !skip.has(i)).pop();
      const r = file ? read(file) : { text: String(stdin == null ? '' : stdin) };
      if (r.err) return 'head: cannot open ' + file + ' for reading';
      return textLines(r.text).slice(0, n).join('\n');
    });
    add('tail', (a, stdin) => {
      const n = Math.max(1, parseInt(((a || []).find(x => /^-\d+$/.test(x)) || '').slice(1) || ((a || [])[(a || []).indexOf('-n') + 1]) || '10', 10) || 10);
      const skip = new Set([(a || []).indexOf('-n') + 1].filter(i => i > 0));
      const file = (a || []).filter((x, i) => !x.startsWith('-') && !skip.has(i)).pop();
      const r = file ? read(file) : { text: String(stdin == null ? '' : stdin) };
      if (r.err) return 'tail: cannot open ' + file + ' for reading';
      return textLines(r.text).slice(-n).join('\n');
    });
    add('wc', (a, stdin) => {
      const names = (a || []).filter(x => !x.startsWith('-'));
      const textOfInput = names.length ? read(names[0]) : { text: String(stdin == null ? '' : stdin) };
      if (textOfInput.err) return 'wc: ' + names[0] + ': No such file or directory';
      const text = String(textOfInput.text), ls = textLines(text).length, ws = text.split(/\s+/).filter(Boolean).length, bs = new TextEncoder().encode(text).length;
      const label = names.length ? ' ' + names[0] : '';
      const flags = (a || []).join(' ');
      if (flags.includes('-l')) return String(ls) + label;
      if (flags.includes('-w')) return String(ws) + label;
      if (flags.includes('-c')) return String(bs) + label;
      return [ls, ws, bs].map(x => String(x).padStart(7)).join('') + label;
    });

    /* ------------------------------------------------------------ copying, moving, removing
       The rooms and mission shells can be missing the plain filesystem verbs. They need nothing but the
       adapter's read/write/remove/list, so they are defined once here for every host. */
    const dirOk = p => { const l = api.list(p); return !!(l && !l.err); };
    const mk = p => {
      const d = clean(p).replace(/\/+$/, '');
      if (typeof api.mkdir === 'function') return api.mkdir(d);
      /* no directory call on this host: an empty file inside it creates the folder in a tree, then goes away */
      api.write(d + '/.keep', ''); api.remove(d + '/.keep');
      return '';
    };
    const parents = p => { const d = dir(p); if (d && d !== '.' && d !== '/' && !dirOk(d)) { parents(d); mk(d); } };
    const isFile = p => { const r = api.read(p); return !r.err && !dirOk(p); };
    const copyTree = (from, to) => {
      if (!dirOk(from)) { const r = api.read(from); if (!r.err) api.write(to, r.text); return; }
      if (!dirOk(to)) mk(to);
      const l = api.list(from);
      for (const name of (l && l.names) || []) copyTree(clean(from).replace(/\/+$/, '') + '/' + name, clean(to).replace(/\/+$/, '') + '/' + name);
    };
    const removeTree = p => {
      const l = api.list(p);
      if (l && !l.err) for (const name of l.names || []) removeTree(clean(p).replace(/\/+$/, '') + '/' + name);
      api.remove(p);
    };
    add('mkdir', a => {
      const names = pos(a); if (!names.length) return 'mkdir: missing operand';
      const makeParents = a.some(x => /^-[a-zA-Z]*p/.test(x) || x === '--parents');
      for (const n of names) {
        if (dirOk(n)) { if (!makeParents) return "mkdir: cannot create directory '" + n + "': File exists"; continue; }
        if (read(n) && !read(n).err) return "mkdir: cannot create directory '" + n + "': File exists";
        if (makeParents) parents(n); else if (!dirOk(dir(n)) && dir(n) !== '.' && dir(n) !== '/') return "mkdir: cannot create directory '" + n + "': No such file or directory";
        mk(n);
      }
      return '';
    });
    add('touch', a => {
      const names = pos(a).filter(x => x !== '-'); if (!names.length) return 'touch: missing file operand';
      for (const n of names) { const r = api.read(n); if (r.err && !dirOk(n)) { parents(n); api.write(n, ''); } }
      return '';
    });
    add('rm', (a, stdin) => {
      const names = pos(a);
      if (!names.length) return 'rm: missing operand';
      const recursive = a.some(x => /^-[a-zA-Z]*[rR]/.test(x) || x === '--recursive');
      const force = a.some(x => /^-[a-zA-Z]*f/.test(x) || x === '--force');
      const lines = [];
      for (const n of names) {
        const isDirNow = dirOk(n);
        if (!isDirNow && read(n).err) { if (!force) lines.push("rm: cannot remove '" + n + "': No such file or directory"); continue; }
        if (isDirNow && !recursive) { lines.push("rm: cannot remove '" + n + "': Is a directory"); continue; }
        if (isDirNow) removeTree(n); else api.remove(n);
      }
      return lines.join('\n');
    });
    add('cp', a => {
      const names = pos(a);
      if (names.length < 2) return 'cp: missing destination file operand';
      const recursive = a.some(x => /^-[a-zA-Z]*[rRa]/.test(x) || x === '--recursive');
      const target = names.pop();
      const intoDir = dirOk(target);
      if (names.length > 1 && !intoDir) return "cp: target '" + target + "' is not a directory";
      const lines = [];
      for (const n of names) {
        if (read(n).err && !dirOk(n)) { lines.push("cp: cannot stat '" + n + "': No such file or directory"); continue; }
        if (dirOk(n) && !recursive) { lines.push('cp: -r not specified; omitting directory ' + n); continue; }
        const dest = intoDir ? clean(target).replace(/\/+$/, '') + '/' + base(n) : target;
        copyTree(n, dest);
      }
      return lines.join('\n');
    });
    add('mv', a => {
      const names = pos(a);
      if (names.length < 2) return 'mv: missing destination file operand';
      const target = names.pop();
      const intoDir = dirOk(target);
      if (names.length > 1 && !intoDir) return "mv: target '" + target + "' is not a directory";
      const lines = [];
      for (const n of names) {
        if (read(n).err && !dirOk(n)) { lines.push("mv: cannot stat '" + n + "': No such file or directory"); continue; }
        const dest = intoDir ? clean(target).replace(/\/+$/, '') + '/' + base(n) : target;
        copyTree(n, dest);
        if (dirOk(n)) removeTree(n); else api.remove(n);
      }
      return lines.join('\n');
    });

    /* ------------------------------------------------------------ the shell's own language
       eval and exec run through the host when it offers a runner; the rest answer the way a real
       bash answers, so a familiar line is never answered with "command not found". */
    add('eval', (a, stdin) => {
      const text = (a || []).join(' ');
      if (!text) return '';
      if (typeof api.exec !== 'function') return '';
      try { return String(api.exec(text, stdin == null ? null : stdin) ?? ''); } catch (e) { return 'bash: eval: ' + e.message; }
    });
    add('exec', (a, stdin) => {
      const names = pos(a);
      if (!names.length) return '';
      const fn = C[names[0]];
      if (!fn) return 'bash: exec: ' + names[0] + ': not found';
      return asText(fn(names.slice(1), stdin == null ? null : stdin));
    });
    add('command', a => {
      const raw = a || [];
      const verbose = raw.includes('-v') || raw.includes('-V');
      const names = pos(raw);
      const name = names[0];
      if (!name) return '';
      if (verbose) return C[name] ? name + (raw.includes('-V') ? ' is a shell builtin' : '') : '';
      const fn = C[name];
      return fn ? asText(fn(names.slice(1), null)) : 'bash: ' + name + ': command not found';
    });
    add('builtin', (a, stdin) => {
      const names = pos(a);
      if (!names.length) return 'builtin: usage: builtin [shell-builtin [arg ...]]';
      const fn = C[names[0]];
      return fn ? asText(fn(names.slice(1), stdin == null ? null : stdin)) : 'bash: builtin: ' + names[0] + ': not a shell builtin';
    });
    add('declare', a => {
      const names = pos(a);
      const env = typeof api.env === 'function' ? api.env() : null;
      if (!names.length) return env ? Object.entries(env).sort().map(([k, v]) => 'declare -x ' + k + '="' + v + '"').join('\n') : '';
      if (a.some(x => /^-[a-zA-Z]*p/.test(x))) {
        const name = names[0].split('=')[0];
        const value = env && Object.hasOwn(env, name) ? env[name] : '';
        return 'declare -- ' + name + '="' + value + '"';
      }
      for (const item of names) {
        const [k, ...rest] = item.split('=');
        if (rest.length && typeof api.setenv === 'function') api.setenv(k, rest.join('='));
      }
      return '';
    });
    add('typeset', a => C.declare(a));
    add('readonly', a => (a || []).some(x => /^-p/.test(x)) ? '' : '');
    add('mapfile', (a, stdin) => {
      const name = pos(a)[0] || 'MAPFILE';
      const rows = String(stdin == null ? '' : stdin).split('\n');
      if (rows.length && rows[rows.length - 1] === '') rows.pop();
      if (typeof api.setvar === 'function') api.setvar(name, rows);
      return '';
    });
    add('readarray', a => C.mapfile(a));
    add('trap', a => {
      if ((a || []).some(x => /^-l/.test(x))) return ' 1) SIGHUP\t 2) SIGINT\t 3) SIGQUIT\t 4) SIGILL\t 5) SIGTRAP\n 6) SIGABRT\t 7) SIGBUS\t 8) SIGFPE\t 9) SIGKILL\t10) SIGUSR1\n11) SIGSEGV\t12) SIGUSR2\t13) SIGPIPE\t14) SIGALRM\t15) SIGTERM';
      return '';
    });
    add('wait', () => '');
    add('disown', () => '');
    add('hash', a => (a || []).some(x => /^-r/.test(x)) ? '' : 'hits\tcommand');
    add('ulimit', a => {
      if ((a || []).some(x => /^-a/.test(x))) return ['core file size          (blocks, -c) 0', 'data seg size           (kbytes, -d) unlimited', 'scheduling priority             (-e) 0',
        'file size               (blocks, -f) unlimited', 'pending signals                 (-i) 15700', 'max locked memory       (kbytes, -l) 8192',
        'max memory size         (kbytes, -m) unlimited', 'open files                      (-n) 1024', 'pipe size            (512 bytes, -p) 8',
        'POSIX message queues     (bytes, -q) 819200', 'real-time priority              (-r) 0', 'stack size              (kbytes, -s) 8192',
        'cpu time               (seconds, -t) unlimited', 'max user processes              (-u) 15700', 'virtual memory          (kbytes, -v) unlimited',
        'file locks                      (-x) unlimited'].join('\n');
      return 'unlimited';
    });
    add('shift', () => '');
    add('getopts', () => '');
    add('times', () => '0m0.002s 0m0.001s\n0m0.000s 0m0.000s');
    add('shopt', a => (a || []).some(x => /^-s|-u/.test(x)) ? '' : 'autocd\t\toff\ncdspell\t\toff\nexpand_aliases\ton\nhistappend\ton\nnocaseglob\toff');
    add('compgen', a => {
      const which = pos(a)[0];
      const names = Object.keys(C).sort();
      if (which === '-c' || which === '-b' || which === '-a') return names.join('\n');
      const prefix = (a || []).find(x => !x.startsWith('-')) || '';
      return names.filter(n => n.startsWith(prefix)).join('\n');
    });
    add('complete', () => '');
    add('suspend', () => 'bash: suspend: cannot suspend a login shell');
    let dirStack = [];
    add('dirs', () => [api.cwd ? api.cwd() : '~'].concat(dirStack.slice().reverse()).join(' '));
    add('pushd', a => {
      const target = one(a);
      if (!target) return 'pushd: no other directory';
      const before = typeof api.cwd === 'function' ? api.cwd() : '';
      if (typeof api.chdir !== 'function' || !api.chdir(target)) return 'pushd: ' + target + ': No such file or directory';
      dirStack.push(before);
      return C.dirs();
    });
    add('popd', () => {
      if (!dirStack.length) return 'popd: directory stack empty';
      const target = dirStack.pop();
      if (typeof api.chdir === 'function' && !api.chdir(target)) return 'popd: ' + target + ': No such file or directory';
      return C.dirs();
    });

    /* ------------------------------------------------------------ the everyday programs the engines kept answering 127 for */
    add('egrep', (a, stdin) => grepLike(a, stdin, true));
    add('fgrep', (a, stdin) => grepLike(a, stdin, false));
    /* ------------------------------------------------------------ text filters the analyst consoles were missing */
    const fromStdin = (a, stdin) => {
      const names = (a || []).filter(x => !String(x).startsWith('-'));
      const file = names.length ? names[names.length - 1] : null;
      if (file) { const r = read(file); if (!r.err) return { text: r.text }; }
      return { text: String(stdin == null ? '' : stdin) };
    };
    add('sort', (a, stdin) => {
      const src = fromStdin(a, stdin);
      if (src.err) return 'sort: ' + src.err;
      const flags = (a || []).join(' ');
      let rows = textLines(src.text);
      if (flags.includes('-n')) rows = rows.slice().sort((x, y) => (parseFloat(x) || 0) - (parseFloat(y) || 0));
      else rows = rows.slice().sort();
      if (flags.includes('-u')) rows = rows.filter((x, i) => rows.indexOf(x) === i);
      if (flags.includes('-r')) rows.reverse();
      return rows.join('\n');
    });
    add('uniq', (a, stdin) => {
      const src = fromStdin(a, stdin);
      if (src.err) return 'uniq: ' + src.err;
      const flags = (a || []).join(' ');
      const rows = [];
      for (const line of textLines(src.text)) {
        const last = rows[rows.length - 1];
        if (last && last.line === line) { last.count++; continue; }
        rows.push({ line, count: 1 });
      }
      const shown = rows.filter(r => flags.includes('-d') ? r.count > 1 : flags.includes('-u') ? r.count === 1 : true);
      return shown.map(r => (flags.includes('-c') ? String(r.count).padStart(7) + ' ' : '') + r.line).join('\n');
    });
    add('cut', (a, stdin) => {
      const src = fromStdin(a, stdin);
      if (src.err) return 'cut: ' + src.err;
      const di = (a || []).indexOf('-d'), fi = (a || []).indexOf('-f'), ci = (a || []).indexOf('-c');
      const delim = di >= 0 ? (a[di + 1] || '\t') : '\t';
      const fieldSpec = fi >= 0 ? a[fi + 1] : null;
      const charSpec = ci >= 0 ? a[ci + 1] : null;
      const pick = (value, spec, sep) => {
        const pieces = sep ? value.split(sep) : [...value];
        const wanted = [];
        for (const bit of String(spec || '1').split(',')) {
          const range = bit.split('-');
          if (range.length === 2) for (let n = parseInt(range[0] || 1, 10); n <= parseInt(range[1], 10); n++) wanted.push(n);
          else wanted.push(parseInt(bit, 10));
        }
        return wanted.map(n => pieces[n - 1] ?? '').join(sep || '');
      };
      return textLines(src.text).map(line => charSpec ? pick(line, charSpec, '') : pick(line, fieldSpec, delim)).join('\n');
    });
    add('tr', (a, stdin) => {
      const expand = set => {
        const out = [];
        for (let i = 0; i < String(set).length; i++) {
          const ch = set[i];
          if (set[i + 1] === '-' && set[i + 2] && set[i + 2] !== ']') {
            for (let code = ch.charCodeAt(0); code <= set[i + 2].charCodeAt(0); code++) out.push(String.fromCharCode(code));
            i += 2;
          } else out.push(ch);
        }
        return out;
      };
      const deleteSet = (a || []).includes('-d');
      const names = pos(a);
      const source = expand(names[0] || '');
      const target = expand(names[1] || '');
      const text = String(stdin == null ? '' : stdin);
      if (deleteSet) return [...text].filter(ch => !source.includes(ch)).join('');
      if (!target.length) return text;
      return [...text].map(ch => { const i = source.indexOf(ch); return i < 0 ? ch : target[Math.min(i, target.length - 1)]; }).join('');
    });
    add('nl', (a, stdin) => {
      const src = fromStdin(a, stdin);
      return textLines(src.text).map((line, i) => String(i + 1).padStart(6) + '\t' + line).join('\n');
    });
    add('tac', (a, stdin) => textLines(fromStdin(a, stdin).text).reverse().join('\n'));
    const b64 = text => { const bytes = new TextEncoder().encode(String(text)); let s = ''; for (const b of bytes) s += String.fromCharCode(b); return btoa(s); };
    const unb64 = text => {
      try {
        const s = atob(String(text).replace(/\s+/g, ''));
        const bytes = new Uint8Array(s.length);
        for (let i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i);
        return new TextDecoder().decode(bytes);
      } catch (e) { return 'base64: invalid input'; }
    };
    add('base64', (a, stdin) => {
      const decode = (a || []).some(x => /^-d|--decode/.test(x));
      const src = fromStdin(a, stdin);
      if (src.err) return 'base64: ' + src.err;
      return decode ? unb64(src.text) : b64(src.text).replace(/(.{76})/g, '$1\n');
    });
    add('file', a => {
      const f = one(a);
      if (!f) return 'Usage: file [OPTION...] [FILE...]';
      const r = read(f);
      if (r.err) return f + ': cannot open `' + f + '` (No such file or directory)';
      const text = String(r.text);
      if (/^\s*[{[]/.test(text)) { try { JSON.parse(text); return f + ': JSON text data'; } catch (e) { /* not json */ } }
      if (/\u0000/.test(text)) return f + ': data';
      if (/^#!\/.*(bash|sh)/.test(text)) return f + ': Bourne-Again shell script, ASCII text executable';
      if (/^<(!doctype|html)/i.test(text)) return f + ': HTML document, ASCII text';
      return f + ': ASCII text';
    });
    add('sed', (a, stdin) => {
      const expression = (a || []).find(x => /^s(.)/.test(x));
      const src = fromStdin(a, stdin);
      if (src.err) return 'sed: ' + src.err;
      if (!expression) return src.text;
      const mm = expression.match(/^s(.)(.*?)\1(.*?)\1([gi]*)$/);
      if (!mm) return 'sed: -e expression #1, char 1: unknown command';
      const flagsText = mm[4] || '';
      return textLines(src.text).map(line => {
        const re = new RegExp(mm[2], flagsText.includes('g') ? 'g' + (flagsText.includes('i') ? 'i' : '') : flagsText.includes('i') ? 'i' : '');
        return line.replace(re, mm[3]);
      }).join('\n');
    });
    add('awk', (a, stdin) => {
      const args = (a || []);
      const fi = args.indexOf('-F');
      const sep = fi >= 0 ? (args[fi + 1] || ' ') : ' ';
      const program = args.find(x => x.includes('{')) || '';
      const print = program.match(/print\s+([^}]+)/);
      const src = fromStdin(a, stdin);
      if (src.err) return 'awk: ' + src.err;
      if (!print) return src.text;
      const fields = print[1].split(',').map(x => x.trim());
      return textLines(src.text).map(line => {
        const parts = sep === ' ' ? line.trim().split(/\s+/) : line.split(sep);
        return fields.map(f => f === '$0' ? line : /^\$\d+$/.test(f) ? (parts[+f.slice(1) - 1] || '') : f.replace(/^"|"$/g, '')).join(' ');
      }).join('\n');
    });
    add('find', a => {
      const args = (a || []).slice();
      const starts = [];
      while (args.length && !String(args[0]).startsWith('-') && !/^[!()]$/.test(args[0])) starts.push(args.shift());
      if (!starts.length) starts.push('.');
      const name = args.indexOf('-name') >= 0 ? args[args.indexOf('-name') + 1]
        : args.indexOf('-iname') >= 0 ? args[args.indexOf('-iname') + 1] : null;
      const type = args.indexOf('-type') >= 0 ? args[args.indexOf('-type') + 1] : null;
      const depthArg = args.indexOf('-maxdepth') >= 0 ? parseInt(args[args.indexOf('-maxdepth') + 1], 10) : Infinity;
      const re = name ? new RegExp('^' + name.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.') + '$') : null;
      const rows = [];
      const visit = (p, depth) => {
        const l = api.list(p);
        const isDirNow = !!(l && !l.err);
        const info = { name: base(p), dir: isDirNow, depth };
        const okName = !re || re.test(info.name);
        const okType = !type || (type === 'd' ? info.dir : !info.dir);
        if (okName && okType && depth > 0) rows.push(clean(p).replace(/^\.\//, ''));
        if (!isDirNow || depth >= depthArg) return;
        for (const child of (l.names || []).slice().sort()) visit(clean(p).replace(/\/+$/, '') + '/' + child, depth + 1);
      };
      for (const start of starts) {
        if (!api.list(start) && read(start).err) return "find: '" + start + "': No such file or directory";
        visit(start, 0);
      }
      return rows.join('\n');
    });

    add('info', a => {
      const n = one(a);
      if (!n) return 'File: dir,\tNode: Top,\tThis is the top of the INFO tree.\n\n* Menu:\n* Bash: (bash).                   The GNU Bourne-Again SHell.';
      return n + ': (coreutils) ' + n + ' invocation\n\n   ' + n + ' — ' + (C[n] ? 'available in this shell' : 'no such program in this sandbox') + '\n\n   Run `man ' + n + '` for the manual page.';
    });
    add('mknod', a => { const f = pos(a).pop(); if (!f) return 'mknod: missing operand'; api.write(f, ''); return ''; });
    add('chroot', a => {
      const names = pos(a);
      if (names.length < 2) return 'chroot: missing operand';
      if (!dirOk(names[0])) return "chroot: cannot change root directory to '" + names[0] + "': No such file or directory";
      const fn = C[names[1]];
      return fn ? asText(fn(names.slice(2), null)) : 'chroot: failed to run command \'' + names[1] + '\': No such file or directory';
    });
    add('setfacl', a => {
      const f = pos(a).pop();
      if (!f) return 'setfacl: missing operand';
      return read(f).err && !dirOk(f) ? "setfacl: " + f + ": No such file or directory" : '';
    });
    add('getfacl', a => {
      const f = one(a);
      if (!f) return 'getfacl: missing operand';
      if (read(f).err && !dirOk(f)) return "getfacl: " + f + ": No such file or directory";
      return '# file: ' + clean(f).replace(/^\/+/, '') + '\n# owner: ' + user + '\n# group: ' + user + '\nuser::rw-\ngroup::r--\nother::r--';
    });
    add('lsattr', a => { const f = pos(a).pop() || '.'; return '--------------e----- ' + f; });
    add('chattr', a => { const f = pos(a).pop() || ''; return f ? '' : 'chattr: missing file operand'; });
    add('sar', () => 'Linux 6.6.0 (' + host + ') \t06:20:00\t_x86_64_\t(8 CPU)\n\n06:20:00        CPU     %user     %nice   %system   %iowait    %steal     %idle\n06:20:00        all      2.10      0.00      0.70      0.30      0.00     96.80');

    /* ------------------------------------------------------------ language and developer toolchains */
    const versionOf = (name, version) => a => (a || []).some(x => /--version|^-V$|^-v$|^version$/.test(x)) ? name + ' ' + version : (name === 'java' ? 'Usage: java [options] <mainclass> [args...]' : name + ': no input files');
    add('java', a => (a || []).some(x => /-version|--version/.test(x)) ? 'openjdk version "17.0.10" 2024-01-16\nOpenJDK Runtime Environment (build 17.0.10+7-Ubuntu-122.04)\nOpenJDK 64-Bit Server VM (build 17.0.10+7-Ubuntu-122.04, mixed mode, sharing)' : 'Usage: java [options] <mainclass> [args...]\n           (to execute a class)');
    add('javac', a => (a || []).some(x => /-version|--version/.test(x)) ? 'javac 17.0.10' : 'javac: no source files');
    add('go', versionOf('go', 'go1.22.1 linux/amd64'));
    add('rustc', versionOf('rustc', '1.77.1 (7cf61ebde 2024-03-27)'));
    add('cargo', versionOf('cargo', '1.77.1 (e52e36006 2024-03-26)'));
    add('dotnet', versionOf('dotnet', '8.0.203'));
    add('perl', a => (a || []).some(x => /-v|--version/.test(x)) ? 'This is perl 5, version 34, subversion 0 (v5.34.0) built for x86_64-linux-gnu' : '');
    add('ruby', a => (a || []).some(x => /-v|--version/.test(x)) ? 'ruby 3.0.2p107 (2021-07-07 revision 0db68f0233) [x86_64-linux-gnu]' : '');
    add('php', a => (a || []).some(x => /-v|--version/.test(x)) ? 'PHP 8.1.2-1ubuntu2.14 (cli) (built: Aug 18 2023 11:41:11) (NTS)' : 'Usage: php [options] [-f] <file> [--] [args...]');
    add('sqlite3', a => { const f = one(a); return f && !read(f).err ? 'SQLite version 3.37.2 2022-01-06 13:25:41\nEnter ".help" for usage hints.' : 'SQLite version 3.37.2 2022-01-06 13:25:41\nEnter ".help" for usage hints.'; });
    add('tmux', a => { const sub = pos(a)[0]; return sub === 'ls' || sub === 'list-sessions' ? 'no server running on /tmp/tmux-1000/default' : 'tmux: no sessions'; });
    add('screen', a => 'No Sockets found in /run/screen/S-' + user + '.');
    add('docker-compose', a => 'docker-compose: the container engine is not running in this terminal');
    add('ldd', a => { const f = one(a); if (!f) return 'ldd: missing file arguments'; return '\tlinux-vdso.so.1 (0x00007ffd3b5f9000)\n\tlibc.so.6 => /lib/x86_64-linux-gnu/libc.so.6 (0x00007f2b1c3a0000)\n\t/lib64/ld-linux-x86-64.so.2 (0x00007f2b1c5a8000)'; });
    add('ldconfig', a => (a || []).some(x => /-p/.test(x)) ? 'libc.so.6 (libc6,x86-64) => /lib/x86_64-linux-gnu/libc.so.6\nlibm.so.6 (libc6,x86-64) => /lib/x86_64-linux-gnu/libm.so.6' : '');
    add('strace', a => { const names = pos(a); const fn = names.length ? C[names[0]] : null; const out = fn ? asText(fn(names.slice(1), null)) : ''; return 'execve("/usr/bin/' + (names[0] || 'ls') + '", ["' + (names[0] || 'ls') + '"], 0x7ffd /* 24 vars */) = 0\n' + out + '\n+++ exited with 0 +++'; });
    add('ltrace', a => '+++ exited (status 0) +++');
    add('gdb', a => 'GNU gdb (Ubuntu 12.1-0ubuntu1~22.04) 12.1\nCopyright (C) 2022 Free Software Foundation, Inc.\nLicense GPLv3+: GNU GPL version 3 or later <http://gnu.org/licenses/gpl.html>' );
    add('valgrind', a => (a || []).some(x => /--version/.test(x)) ? 'valgrind-3.18.1' : '==2210== Memcheck, a memory error detector\n==2210== Using Valgrind-3.18.1 and LibVEX\n==2210== All heap blocks were freed -- no leaks are possible');
    add('cmake', a => (a || []).some(x => /--version/.test(x)) ? 'cmake version 3.22.1' : 'CMake Error: The source directory does not appear to contain CMakeLists.txt.');
    add('pkg-config', a => (a || []).some(x => /--version/.test(x)) ? '0.29.2' : '');

    /* ------------------------------------------------------------ offensive tooling (simulated, like the rest) */
    const secNote = '\n  · simulated range — nothing is scanned, cracked or sent';
    add('nikto', a => ['- Nikto v2.5.0', '---------------------------------------------------------------------------',
      '+ Target IP:          ' + (pos(a)[1] || '10.0.0.5'), '+ Target Hostname:    ' + (pos(a)[1] || '10.0.0.5'), '+ Target Port:        80',
      '+ Server: nginx/1.24.0', '+ /admin/: Admin login page/section found.', '+ /backup/: Directory indexing found.',
      '+ 2 host(s) tested', 'Scan completed in 1.204 seconds'].join('\n') + secNote);
    add('gobuster', a => ['===============================================================', 'Gobuster v3.6', 'by OJ Reeves (@TheColonial) & Christian Mehlmauer (@firefart)', '===============================================================',
      '[+] Url:                     ' + (pos(a).find(x => /^https?:/.test(x)) || 'http://10.0.0.5'), '[+] Method:                  GET', '[+] Threads:                 10',
      '===============================================================', 'Starting gobuster in directory enumeration mode', '===============================================================',
      '/admin                (Status: 301) [Size: 178]', '/backup               (Status: 200) [Size: 2048]', '/health               (Status: 200) [Size: 31]',
      '/login                (Status: 200) [Size: 612]', '/robots.txt           (Status: 200) [Size: 92]', 'Progress: 4614 / 4615 (99.98%)',
      '===============================================================', 'Finished'].join('\n') + secNote);
    add('masscan', a => ['Starting masscan 1.3.2 (http://bit.ly/14GZzcT) at 2026-02-12 06:20:00 GMT', 'Initiating SYN Stealth Scan',
      'Scanning 1 hosts [65535 ports/host]', 'Discovered open port 22/tcp on ' + (pos(a)[0] || '10.0.0.5'),
      'Discovered open port 80/tcp on ' + (pos(a)[0] || '10.0.0.5'), 'Discovered open port 8080/tcp on ' + (pos(a)[0] || '10.0.0.5')].join('\n') + secNote);
    add('searchsploit', a => ['---------------------------------------------- ---------------------------------',
      ' Exploit Title                                |  Path', '---------------------------------------------- ---------------------------------',
      'Apache HTTP Server 2.4.49 - Path Traversal    | linux/remote/50383.py', 'Apache HTTP Server 2.4.50 - LFI               | multiple/webapps/50406.py',
      '---------------------------------------------- ---------------------------------', 'Shellcodes: No Results'].join('\n'));
    add('hydra', a => ['Hydra v9.4 (c) 2023 by van Hauser/THC', 'Hydra starting at 2026-02-12 06:20:00',
      '[22][ssh] host: ' + (pos(a).pop() || '10.0.0.5') + '   login: admin   password: Summer2024!', '1 of 1 target successfully completed, 1 valid password found'].join('\n') + secNote);
    add('john', a => ['Loaded 1 password hash (sha512crypt, crypt(3) $6$ [SHA512 128/128 AVX 2x])', 'Cost 1 (iteration count) is 5000',
      'secret           (admin)', 'Session completed.'].join('\n'));
    add('hashcat', a => ['hashcat (v6.2.6) starting', 'Hash.Target......: $6$rounds=5000$simulated$hash', 'Status...........: Cracked',
      'Recovered........: 1/1 (100.00%) Digests', 'Progress.........: 8192/8192', 'Recovered........: secret', 'Session..........: hashcat', 'Status...........: Cracked'].join('\n'));
    add('sqlmap', a => ['        ___', '       __H__', ' ___ ___["]_____ ___ ___  {1.7.11#stable}', '|_ -| . ["]     | .\'| . |', '|___|_  ["]_|_|_|__,|  _|',
      '      |_|V...       |_|   https://sqlmap.org', '', '[INFO] testing connection to the target URL',
      '[INFO] GET parameter \'id\' appears to be \'MySQL >= 5.0 AND error-based\' injectable', 'sqlmap identified the following injection point(s):',
      '  Type: boolean-based blind', '  Payload: id=1 AND 1=1'].join('\n') + secNote);
    add('ffuf', a => ['        /\'___\       /\'___\  ', '       /\ \_\ \     /\ \_\ \ ', '      /\ \ \ \ \   /\ \ \ \ \ ', '      \ \ \_/ /__ \ \ \_/ /__ ', '       \ \___/\_\_\ \ \___/\_\_\ ', '        \/___/  \/_/  \/___/  \/_/',
      '', ':: Method           : GET', ':: URL              : ' + (pos(a).find(x => /^https?:/.test(x)) || 'http://10.0.0.5/FUZZ'),
      ':: Wordlist         : FUZZ: /usr/share/wordlists/common.txt', '', 'admin                   [Status: 301, Size: 178]',
      'backup                  [Status: 200, Size: 2048]', 'health                  [Status: 200, Size: 31]', ':: Progress: [4614/4615] :: Job [1/1] :: 0 req/sec :: Duration: [0:00:02]'].join('\n') + secNote);
    add('dirb', a => ['-----------------', 'DIRB v2.22', 'By The Dark Raver', '-----------------', 'START_TIME: Thu Feb 12 06:20:00 2026', 'URL_BASE: ' + (one(a) || 'http://10.0.0.5'),
      '==> DIRECTORY: http://10.0.0.5/admin/', '==> DIRECTORY: http://10.0.0.5/backup/', '+ http://10.0.0.5/robots.txt (CODE:200|SIZE:92)', '---- Entering directory: http://10.0.0.5/admin/ ----', 'END_TIME: Thu Feb 12 06:20:02 2026'].join('\n') + secNote);
    add('wpscan', a => ['[+] URL: ' + (one(a) || 'http://10.0.0.5') + '/', '[+] WordPress version 6.4.2 identified', '[+] Enumerating plugins', '[+] No vulnerable plugins found (simulated)'].join('\n') + secNote);
    add('enum4linux', a => ['Starting enum4linux v0.9.1', ' ========================== ( Users on 10.0.0.5 ) ==========================', 'user:[Administrator] rid:[0x1f4]', 'user:[guest] rid:[0x1f5]'].join('\n') + secNote);
    add('smbclient', a => 'session setup failed: NT_STATUS_LOGON_FAILURE');
    add('msfconsole', a => ['       =[ metasploit v6.4.2-dev                          ]', '+ -- --=[ 2431 exploits - 1230 auxiliary - 420 post       ]', 'msf6 > (interactive Metasploit is not available in this terminal)'].join('\n'));
    add('bettercap', a => '[sys] bettercap 2.32.0 started (simulated)');
    add('arpspoof', a => 'arpspoof: simulated — no packet is sent');
    add('tshark', () => ['Running as user "root" and group "root". This could be dangerous.', 'Capturing on \'eth0\'', '    1 0.000000 10.0.0.5 → 10.0.0.9 TCP 74 49822 → 443 [SYN] Seq=0 Win=64240',
      '    2 0.000412 10.0.0.9 → 10.0.0.5 TCP 74 443 → 49822 [SYN, ACK] Seq=0 Ack=1 Win=65535'].join('\n'));

    return C;
  }

  /* --------------------------------------------------------------- text as a shell sees it
     A file that ends in a newline has that many lines, not one more. Splitting on \n and
     keeping the last empty piece made `tail -1` print nothing and `sort` emit a blank first
     line, so every line-based command in the rooms goes through here. */
  const textLines = text => {
    const rows = String(text == null ? '' : text).split('\n');
    if (rows.length && rows[rows.length - 1] === '') rows.pop();
    return rows;
  };

  /* --------------------------------------------------------------- find
     One implementation for the Bash Sandbox, the Puzzle Studio and the Labyrinth: the same
     expressions, the same output. Predicates the older engines silently ignored (-maxdepth,
     -not, -o, -path, -size, -perm, -newer, -exec, -delete, …) are answered here instead of
     turning "no filter" output into a wrong but plausible answer. */
  const globRe = (pattern, icase) => new RegExp('^' + String(pattern)
    .replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.') + '$', icase ? 'i' : '');

  const sizeUnit = unit => ({ c: 1, w: 2, b: 512, k: 1024, M: 1024 * 1024, G: 1024 * 1024 * 1024 }[unit] || 512);

  const permString = (mode, type) => {
    const bits = Number(mode) || 0;
    const flag = (bit, ch) => (bits & bit ? ch : '-');
    return (type === 'd' ? 'd' : '-') + flag(0o400, 'r') + flag(0o200, 'w') + flag(0o100, 'x') +
      flag(0o040, 'r') + flag(0o020, 'w') + flag(0o010, 'x') + flag(0o004, 'r') + flag(0o002, 'w') + flag(0o001, 'x');
  };

  const findPrintf = (format, info) => String(format)
    .replace(/\\([nt\\])/g, (m, c) => ({ n: '\n', t: '\t', '\\': '\\' })[c])
    .replace(/%([%pdfhysY])/g, (m, spec) => {
      if (spec === '%') return '%';
      if (spec === 'p') return info.path;
      if (spec === 'f') return info.name;
      if (spec === 'h') { const i = info.path.lastIndexOf('/'); return i > 0 ? info.path.slice(0, i) : '.'; }
      if (spec === 'd') return String(info.depth);
      if (spec === 's') return String(info.size);
      if (spec === 'y') return info.type;
      if (spec === 'Y') return info.type === 'd' ? 'directory' : 'regular file';
      return m;
    });

  function find(args, ctx) {
    const argv = Array.isArray(args) ? args.slice() : [];
    let maxDepth = Infinity, minDepth = 0;
    const rest = [];
    for (let i = 0; i < argv.length; i++) {
      const token = argv[i];
      if (token === '-maxdepth' || token === '-mindepth') {
        const value = Math.max(0, parseInt(argv[++i], 10) || 0);
        if (token === '-maxdepth') maxDepth = value; else minDepth = value;
        continue;
      }
      if (['-H', '-L', '-P', '-depth', '-xdev', '-mount', '-follow', '-d', '-noleaf', '-daystart'].includes(token)) continue;
      if (token === '-regextype') { i++; continue; }
      rest.push(token);
    }
    const starts = [];
    let at = 0;
    while (at < rest.length && !rest[at].startsWith('-') && rest[at] !== '!' && rest[at] !== '(') starts.push(rest[at++]);
    const exprTokens = rest.slice(at);
    if (!starts.length) starts.push('.');

    let pos = 0;
    const take = () => exprTokens[pos++];
    const isOr = token => token === '-o' || token === '-or' || token === ',';
    const isAnd = token => token === '-a' || token === '-and';
    const actions = new Set();

    const parseOr = () => {
      let left = parseAnd();
      while (pos < exprTokens.length && isOr(exprTokens[pos])) {
        pos++;
        const l = left, r = parseAnd();
        left = info => l(info) || r(info);
      }
      return left;
    };
    const parseAnd = () => {
      let left = parseUnary();
      while (pos < exprTokens.length && !isOr(exprTokens[pos]) && exprTokens[pos] !== ')') {
        if (isAnd(exprTokens[pos])) pos++;
        const l = left, r = parseUnary();
        left = info => l(info) && r(info);
      }
      return left;
    };
    const parseUnary = () => {
      if (exprTokens[pos] === '!' || exprTokens[pos] === '-not') { pos++; const inner = parseUnary(); return info => !inner(info); }
      return parsePrimary();
    };
    const parsePrimary = () => {
      const token = take();
      if (token === '(') { const inner = parseOr(); if (exprTokens[pos] === ')') pos++; return inner; }
      if (token === undefined) return () => true;
      switch (token) {
        case '-name': { const re = globRe(take(), false); return info => re.test(info.name); }
        case '-iname': { const re = globRe(take(), true); return info => re.test(info.name); }
        case '-path': case '-wholename': { const re = globRe(take(), false); return info => re.test(info.path); }
        case '-ipath': case '-iwholename': { const re = globRe(take(), true); return info => re.test(info.path); }
        case '-regex': { const source = take() || ''; let re; try { re = new RegExp(source, 'i'); } catch (e) { return () => false; } return info => re.test(info.path); }
        case '-type': { const kinds = String(take() || '').toLowerCase(); return info => kinds.includes(info.type); }
        case '-size': {
          const m = /^([+-]?)(\d+)([ckMGb]?)$/.exec(take() || '');
          if (!m) return () => false;
          const unit = sizeUnit(m[3]), target = parseInt(m[2], 10);
          return info => {
            const n = Math.ceil(info.size / unit);
            return m[1] === '+' ? n > target : m[1] === '-' ? n < target : n === target;
          };
        }
        case '-empty': return info => info.type === 'd' ? info.childCount === 0 : info.size <= 1;
        case '-mtime': case '-mmin': case '-atime': case '-ctime': case '-amin': case '-cmin': {
          const spec = String(take() || '0');
          /* every file in a generated room is written "today", so -1/-0 match and +N does not */
          return () => !spec.startsWith('+');
        }
        case '-newer': take(); return () => true;
        case '-perm': {
          const raw = String(take() || '');
          const sign = raw[0] === '-' || raw[0] === '/' ? raw[0] : '';
          const bits = parseInt(raw.replace(/^[-/+]/, '').replace(/^0o/, ''), 8);
          if (Number.isNaN(bits)) return () => false;
          return info => {
            const mode = Number(info.mode) & 0o7777;
            return sign === '-' ? (mode & bits) === bits : sign === '/' ? (mode & bits) !== 0 : mode === bits;
          };
        }
        case '-user': case '-group': case '-uid': case '-gid': case '-inum': case '-links': take(); return () => true;
        case '-print': actions.add('print'); return info => { info.print = true; return true; };
        case '-print0': actions.add('print'); return info => { info.print = true; return true; };
        case '-ls': actions.add('ls'); return info => { info.ls = true; return true; };
        case '-printf': case '-fprintf': {
          const format = take() || '';
          actions.add('printf');
          return info => { info.printf = format; return true; };
        }
        case '-delete': actions.add('delete'); return info => { info.deleted = true; return true; };
        case '-prune': return info => { info.prune = true; return true; };
        case '-quit': return info => { info.quit = true; return true; };
        case '-exec': case '-execdir': case '-ok': {
          const words = [];
          let terminator = ';';
          while (pos < exprTokens.length) {
            const word = exprTokens[pos++];
            if (word === ';' || word === '\;') { terminator = ';'; break; }
            if (word === '+') { terminator = '+'; break; }
            words.push(word);
          }
          actions.add('exec');
          return info => { (info.execs || (info.execs = [])).push({ words, terminator }); return true; };
        }
        default: return () => true;
      }
    };
    const test = parseOr();

    const lines = [], pendingPlus = [];
    const runExec = (words, paths) => {
      if (typeof ctx.exec !== 'function') return '';
      const args = [];
      for (const word of words) {
        if (word === '{}') args.push(...paths);
        else if (word.includes('{}')) args.push(word.split('{}').join(paths[0] || ''));
        else args.push(word);
      }
      if (!args.length) return '';
      try { return String(ctx.exec(args, null) ?? ''); } catch (e) { return ''; }
    };

    const visited = [];
    const visit = (node, path, depth) => {
      const name = depth === 0 ? (path === '/' ? '/' : (path.split('/').pop() || path)) : path.split('/').pop();
      const isDirNode = typeof ctx.isDir === 'function' ? ctx.isDir(node) : false;
      const info = {
        path, name, depth, node, type: isDirNode ? 'd' : 'f',
        size: typeof ctx.size === 'function' ? ctx.size(node) : 0,
        mode: typeof ctx.mode === 'function' ? ctx.mode(node) : (isDirNode ? 0o755 : 0o644),
        childCount: isDirNode ? Object.keys(node).length : 0,
        print: false, printf: null, ls: false, deleted: false, prune: false, execs: null
      };
      const matched = !!test(info);
      if (matched && depth >= minDepth) {
        if (info.print || !actions.size) lines.push(path);
        if (info.printf != null) lines.push(findPrintf(info.printf, info));
        if (info.ls) lines.push('  1000  ' + permString(info.mode, info.type) + '   1 ' + (ctx.user || 'user') + ' ' + (ctx.group || 'user') + ' ' +
          String(info.size).padStart(7) + ' Feb 12 06:20 ' + path);
        for (const exec of info.execs || []) {
          if (exec.terminator === '+') pendingPlus.push(exec);
          else { const out = runExec(exec.words, [path]); if (out) lines.push(out); }
        }
        visited.push(info);
      }
      if (info.quit) return;
      if (info.prune) return;
      if (!isDirNode || depth >= maxDepth) return;
      const children = Object.keys(node).sort();
      for (const key of children) {
        if (isDirNode && !Object.hasOwn(node, key)) continue;
        visit(node[key], path === '/' ? '/' + key : path.replace(/\/+$/, '') + '/' + key, depth + 1);
      }
    };

    for (const start of starts) {
      const node = typeof ctx.walk === 'function' ? ctx.walk(start) : undefined;
      if (node === undefined) return "find: '" + start + "': No such file or directory";
      visit(node, String(start).replace(/\/+$/, '') || '/', 0);
    }

    if (pendingPlus.length) {
      const paths = visited.map(info => info.path);
      for (const exec of pendingPlus) { const out = runExec(exec.words, paths); if (out) lines.push(out); }
    }
    if (actions.has('delete') && typeof ctx.remove === 'function') {
      for (const info of visited.slice().sort((a, b) => b.path.length - a.path.length)) {
        if (info.deleted && info.depth > 0) ctx.remove(info.path);
      }
    }
    return lines.join('\n');
  }

  /* A host whose command table answers in { out } objects (the mission shells) can have every command the kit
     defines without changing its own richer versions: the kit fills only the gaps, and the wrapper keeps the
     host's shape. */
  function fill(target, api) {
    /* the host's own commands keep returning { out } — the kit speaks plain strings, so it sees a string
       wrapper of the host table through the prototype chain (xargs echo, watch ls, sudo cat … all keep working) */
    const shim = Object.create(null);
    for (const name of Object.keys(target)) {
      shim[name] = (a, stdin) => {
        try {
          const r = target[name](Array.isArray(a) ? a : [], stdin == null ? null : stdin);
          return r && typeof r === 'object' && 'out' in r ? String(r.out == null ? '' : r.out) : (r == null ? '' : String(r));
        } catch (e) { return ''; }
      };
    }
    const C = Object.create(shim);
    install(C, api);
    for (const name of Object.keys(C)) {
      const run = C[name];
      target[name] = (a, stdin) => {
        try { const out = run(Array.isArray(a) ? a : [], stdin == null ? null : stdin); return { out: out == null ? '' : String(out) }; }
        catch (e) { return { out: name + ': ' + (e && e.message || e) }; }
      };
    }
    return target;
  }

  G.TerminalSharedCommands = { install, fill, find, textLines };
  if (typeof module !== 'undefined' && module.exports) module.exports = G.TerminalSharedCommands;
})();

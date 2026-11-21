// Shared commands for the simulated file-shells (Puzzle Studio rooms, the Labyrinth, the app shell and anywhere else
// built on the same tree format). The playground's bash engine already has its own full set; these are the commands
// those rooms were missing, implemented once against a small adapter so every sandbox answers the same way.
// Everything is simulated: no process runs, no packet leaves the page, every host and number is invented.
(function () {
  if (window.TerminalSharedCommands) return;
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
    const text = p => { const r = read(p); return r.err ? null : r.text; };
    const add = (name, fn) => { if (!C[name]) C[name] = fn; };

    /* ------------------------------------------------------------ path helpers */
    const clean = p => String(p == null ? '.' : p).replace(/\\/g, '/').replace(/\/+/g, '/');
    const base = p => { const s = clean(p).replace(/\/$/, ''); return s.split('/').pop() || '/'; };
    const dir = p => { const s = clean(p).replace(/\/$/, ''); const i = s.lastIndexOf('/'); return i <= 0 ? (s.startsWith('/') ? '/' : '.') : s.slice(0, i); };

    add('basename', a => { const p = one(a); if (!p) return 'basename: missing operand'; let b = base(p); const suf = pos(a)[1]; if (suf && b.endsWith(suf) && b !== suf) b = b.slice(0, -suf.length); return b; });
    add('dirname', a => { const p = one(a); return p ? dir(p) : 'dirname: missing operand'; });
    add('realpath', a => { const p = one(a); if (!p) return 'realpath: missing operand'; const r = read(p); return r.err ? 'realpath: ' + p + ': No such file or directory' : clean(p).replace(/^\.\//, ''); });
    add('readlink', a => { const p = one(a); const r = read(p); return r.err ? 'readlink: ' + p + ': No such file or directory' : clean(p); });
    add('mktemp', () => '/tmp/tmp.' + Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0'));

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
      if (a.some(x => x === '-n1' || x === '-n' && a[a.indexOf(x) + 1] === '1')) return items.map(i => String(fn(rest.concat([i]), null) || '')).filter(Boolean).join('\n');
      return String(fn(rest.concat(items), null) || '');
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
    add('nohup', (a, stdin) => { const names = pos(a); const fn = names.length ? C[names[0]] : null; return fn ? String(fn(names.slice(1), stdin) || '') + '\n[b1] done' : 'nohup: failed to run command \'' + (names[0] || '') + '\': No such file or directory'; });

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
    add('watch', (a, stdin) => { const names = pos(a).filter(x => !/^\d+$/.test(x)); const fn = names.length ? C[names[0]] : null; return fn ? String(fn(names.slice(1), stdin) || '') : 'watch: no command given'; });
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
    add('timeout', (a, stdin) => { const names = pos(a); const cmd = names[1]; const fn = cmd ? C[cmd] : null; return fn ? String(fn(names.slice(2), stdin) || '') : 'timeout: failed to run command \'' + (cmd || '') + '\': No such file or directory'; });
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
      /* anything that would look like a network attack is inert, and says so */
      for (const name of ['nmap', 'ssh', 'scp', 'rsync', 'nc', 'ncat', 'telnet', 'ftp', 'wget']) {
        C[name] = () => name + ': not available here. ' + safe;
      }
      C.traceroute = () => 'traceroute: not available here. ' + safe;
      C.ping = () => 'ping: not available here. ' + safe;
      C.curl = a => {
        const target = pos(a).find(x => /^[a-z]+:\/\//.test(x) || /^\w[\w.-]*\.\w+/.test(x)) || '';
        return 'curl: (' + target + ') blocked in the app shell. ' + safe;
      };
      C.iptables = () => 'iptables: rules are not visible to a web page.';
      C.ufw = () => 'ufw: firewall rules are not visible to a web page.';
      C.journalctl = () => '-- no system journal is readable from a browser --';
      C.dmesg = () => 'dmesg: kernel ring buffer is not readable from a web page';
      C.lsblk = () => 'lsblk: disks are not exposed to a web page';
      C.mount = () => 'mount: mounts are not exposed to a web page';
      C.crontab = a => ((a || []).some(x => /^-l/.test(x)) ? '# no crontab for ' + (m.user || 'you') : 'crontab: not available in the app shell');
      C.systemctl = a => /status/.test((a || []).join(' ')) ? 'Unit ' + ((a || [])[1] || 'app') + '.service: no systemd in a browser' : '';
      C.service = () => '';
      C.sudo = (a, stdin) => { const n = pos(a); if (!n.length) return 'usage: sudo command [args]'; const fn = C[n[0]]; return fn ? fn(n.slice(1), stdin) : 'sudo: ' + n[0] + ': command not found'; };
    }
    return C;
  }

  window.TerminalSharedCommands = { install };
})();

// Terminal ops — the engine behind Cyber > 🕶️ Cyber games > Terminal ops.
// The whole engagement happens in a shell: scan, recover a leaked credential (Base64 / hex /
// both), land a shell, escalate, pull the database credential out of an encoded config, pivot,
// find the record and submit it. Missions are generated from a seed, so hosts, accounts,
// passwords, ports, paths, escalation vectors, encodings and record ids differ every run and
// there is no end to them. Nothing here touches a real network.
const TerminalOps = (function () {
  const levels = {
    recruit: {
      name: 'Recruit', diff: 1, hintCost: 0, decoys: 0, par: 12,
      note: 'Plain-text leak, one common sudo rule, no decoys. Free hints.',
      enc: 'plain', env: 'b64', esc: ['sudo-find']
    },
    analyst: {
      name: 'Analyst', diff: 2, hintCost: 4, decoys: 1, par: 16,
      note: 'Base64 leak, a couple of escalation choices, one decoy record.',
      enc: 'b64', env: 'b64', esc: ['sudo-find', 'sudo-vim', 'docker']
    },
    operator: {
      name: 'Operator', diff: 3, hintCost: 8, decoys: 2, par: 20,
      note: 'Hex-encoded leak, subtler escalation, decoy hosts and records.',
      enc: 'hex', env: 'b64', esc: ['sudo-vim', 'docker', 'suid-nmap']
    },
    elite: {
      name: 'Elite', diff: 4, hintCost: 12, decoys: 3, par: 24,
      note: 'Double-encoded leak, hex config, no hand-holding.',
      enc: 'b64hex', env: 'hex', esc: ['docker', 'suid-nmap', 'sudo-awk']
    }
  };

  /* ---------------------------------------------------------------- seeded randomness */
  function random(seed) {
    let s = seed >>> 0;
    return n => {
      s = (s + 0x6D2B79F5) >>> 0;
      let t = Math.imul(s ^ (s >>> 15), s | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) % n;
    };
  }
  const pick = (r, a) => a[r(a.length)];
  const shuffle = (a, r) => {
    const x = a.slice();
    for (let i = x.length - 1; i > 0; i--) { const j = r(i + 1); [x[i], x[j]] = [x[j], x[i]]; }
    return x;
  };

  /* ---------------------------------------------------------------- encodings */
  const b64 = s => (typeof btoa === 'function' ? btoa(String(s)) : Buffer.from(String(s), 'utf8').toString('base64'));
  const hexOf = s => [...String(s)].map(c => c.charCodeAt(0).toString(16).padStart(2, '0')).join(' ');
  const wrap = (s, n) => String(s).replace(new RegExp('.{1,' + (n || 76) + '}', 'g'), '$&\n').trim();
  const encode = (text, mode) => mode === 'plain' ? String(text)
    : mode === 'b64' ? wrap(b64(text), 76)
    : mode === 'hex' ? wrap(hexOf(text), 48)
    : wrap(hexOf(b64(text)), 48);
  const ENC_NAME = { plain: 'plain text', b64: 'Base64', hex: 'hex', b64hex: 'hex over Base64' };
  const ENC_PIPE = { plain: '', b64: ' | base64 -d', hex: ' | xxd -r', b64hex: ' | xxd -r | base64 -d' };

  /* ---------------------------------------------------------------- estates */
  const ORGS = [
    { name: 'Atlas Retail', code: 'atlas', domain: 'atlas.internal', asset: 'billing records' },
    { name: 'Harbor Port', code: 'harbor', domain: 'harbor.internal', asset: 'berth bookings' },
    { name: 'Meridian Clinics', code: 'meridian', domain: 'meridian.internal', asset: 'appointment logs' },
    { name: 'Kestrel Freight', code: 'kestrel', domain: 'kestrel.internal', asset: 'consignment trail' },
    { name: 'Fernwood Council', code: 'fernwood', domain: 'fernwood.internal', asset: 'permit history' },
    { name: 'Vantage Media', code: 'vantage', domain: 'vantage.internal', asset: 'subscription records' },
    { name: 'Northgate Bank', code: 'northgate', domain: 'northgate.internal', asset: 'loan applications' },
    { name: 'Larkspur Hotels', code: 'larkspur', domain: 'larkspur.internal', asset: 'guest folios' },
    { name: 'Pinecrest Labs', code: 'pinecrest', domain: 'pinecrest.internal', asset: 'sample results' },
    { name: 'Aurora Transit', code: 'aurora', domain: 'aurora.internal', asset: 'ticket sales' },
    { name: 'Cobalt Systems', code: 'cobalt', domain: 'cobalt.internal', asset: 'support tickets' },
    { name: 'Ridgeway Water', code: 'ridgeway', domain: 'ridgeway.internal', asset: 'meter readings' }
  ];
  const STAFF = ['Maya Okafor', 'D. Reyes', 'S. Patel', 'J. Lindqvist', 'T. Brennan', 'A. Fofana', 'R. Nakamura', 'K. Diallo', 'L. Ferreira', 'N. Haddad'];
  const CLIENTS = ['Northwind Freight', 'Bluewater Hotels', 'Cobalt Systems', 'Ridgeway Clinics', 'Hollowbrook Council', 'Larkspur Media', 'Quarry Bank', 'Verdant Energy', 'Pinecrest Labs', 'Aurora Transit'];
  const WEB_USERS = ['svc_deploy', 'webops', 'deploy', 'svc_web', 'ci-runner', 'buildbot'];
  const WORDS = ['Kestrel', 'Harbor', 'Copper', 'Falcon', 'Amber', 'Slate', 'Ridge', 'Cobalt', 'Lumen', 'Quarry'];
  const SSH_VERSIONS = ['OpenSSH 7.2p2 Ubuntu-4ubuntu2.8', 'OpenSSH 7.4p2 Ubuntu-4ubuntu0.9', 'OpenSSH 7.6p1 Ubuntu-4ubuntu0.7', 'OpenSSH 8.2p1 Ubuntu-4ubuntu0.5'];
  const DECOYS = [
    { port: 80, svc: 'http', ver: 'nginx 1.18.0' },
    { port: 443, svc: 'https', ver: 'nginx 1.18.0 (TLS 1.2)' },
    { port: 3306, svc: 'mysql', ver: 'MySQL 5.7.33', state: 'filtered' },
    { port: 8080, svc: 'http', ver: 'Apache Tomcat 8.5.19' },
    { port: 6379, svc: 'redis', ver: 'Redis 3.2.100', state: 'filtered' },
    { port: 25, svc: 'smtp', ver: 'Postfix smtpd' },
    { port: 21, svc: 'ftp', ver: 'vsftpd 3.0.3' },
    { port: 9200, svc: 'http', ver: 'Elasticsearch 6.8' },
    { port: 2222, svc: 'ssh', ver: 'OpenSSH 8.9p1', state: 'closed' },
    { port: 8443, svc: 'https-alt', ver: 'nginx 1.24.0', state: 'closed' }
  ];

  /* ---------------------------------------------------------------- escalation vectors */
  const ESCALATIONS = {
    'sudo-find': {
      id: 'sudo-find',
      rule: ['User {user} may run the following commands on web01:', '    (root) NOPASSWD: /usr/bin/find'],
      hint: 'sudo find . -exec /bin/sh -p \\; -quit',
      test: l => /^sudo\s+find\b/.test(l) && /-exec/.test(l),
      why: 'NOPASSWD on find is a root shell: -exec runs any binary you name.'
    },
    'sudo-vim': {
      id: 'sudo-vim',
      rule: ['User {user} may run the following commands on web01:', '    (root) NOPASSWD: /usr/bin/vim'],
      hint: "sudo vim -c ':!/bin/sh'",
      test: l => /^sudo\s+vim\b/.test(l),
      why: 'vim can spawn a shell from command mode, so sudo vim is sudo sh.'
    },
    'sudo-awk': {
      id: 'sudo-awk',
      rule: ['User {user} may run the following commands on web01:', '    (root) NOPASSWD: /usr/bin/awk'],
      hint: 'sudo awk \'BEGIN{system("/bin/sh")}\'',
      test: l => /^sudo\s+awk\b/.test(l),
      why: 'awk\'s system() runs a command as the user running awk — root, here.'
    },
    'docker': {
      id: 'docker',
      rule: ['User {user} may not run sudo on web01.'],
      hint: 'docker run -v /:/mnt --rm -it alpine chroot /mnt sh',
      test: l => /^docker\s+run\b/.test(l) && /-v/.test(l),
      group: true,
      why: 'The docker group talks to a root daemon; a container that mounts / is host root.'
    },
    'suid-nmap': {
      id: 'suid-nmap',
      rule: ['User {user} may not run sudo on web01.'],
      hint: 'nmap --interactive   (then  !sh )',
      why: 'An old SUID nmap keeps its privileges in interactive mode, and !sh inherits root.'
    }
  };

  /* ---------------------------------------------------------------- mission generation */
  function generate(seed, level) {
    const lv = levels[level] ? level : 'analyst';
    const L = levels[lv];
    const r = random(seed);
    const org = pick(r, ORGS);
    const given = pick(r, STAFF);
    const targetIp = '203.0.113.' + (10 + r(220));
    const sshUser = pick(r, WEB_USERS);
    const sshPass = pick(r, WORDS) + (10 + r(89)) + pick(r, ['!', '#', '@', '!7']);
    const dbPass = pick(r, WORDS).toLowerCase() + (100 + r(900)) + '#';
    const dbUser = 'svc_' + pick(r, ['billing', 'data', 'reports', 'sql']);
    const recordId = 'REC-' + (1000 + r(9000)) + '-' + org.code.slice(0, 4).toUpperCase();
    const entry = pick(r, ['notes', 'backup', 'ftp']);
    const esc = ESCALATIONS[pick(r, L.esc)];
    const envPath = pick(r, ['/var/www/app/.env', '/srv/app/.env', '/opt/app/.env', '/var/www/html/.env']) + (L.env === 'hex' ? '.hex' : '.b64');
    const leakName = org.code + '-leak.txt';
    const backupName = 'config-' + org.code + '.bak';

    const leakText = [
      '# ' + org.name + ' - internal build notes (leaked from a public repository)',
      'HOST=' + targetIp,
      'USER=' + sshUser,
      'PASSWORD=' + sshPass,
      'NOTE=rotate this after the audit'
    ].join('\n');
    const entryStored = encode(leakText, L.enc);

    const envText = [
      'APP_ENV=production',
      'APP_KEY=base64:' + b64(dbPass).replace(/=/g, '').slice(0, 18),
      'DB_HOST=db01.' + org.domain,
      'DB_PORT=5432',
      'DB_DATABASE=' + org.asset.replace(/\s+/g, '_'),
      'DB_USERNAME=' + dbUser,
      'DB_PASSWORD=' + dbPass,
      'MAIL_PASSWORD=CHANGEME',
      'SENTRY_DSN=https://key@o0.ingest.example/' + (10 + r(89))
    ].join('\n');

    /* records: the objective plus same-prefix decoys, so grep is not enough — they need the right id */
    const rows = ['id,customer,amount,status'];
    const targetRow = recordId + ',' + given + ',' + (40 + r(960)) + '.' + String(10 + r(89)) + ',' + pick(r, ['paid', 'refunded', 'pending']);
    const decoyRows = [];
    for (let i = 0; i < 4 + L.decoys; i++) {
      decoyRows.push('REC-' + (1000 + r(9000)) + '-' + pick(r, ORGS).code.slice(0, 4).toUpperCase() + ',' +
        pick(r, CLIENTS) + ',' + (40 + r(960)) + '.' + String(10 + r(89)) + ',' + pick(r, ['paid', 'refunded', 'pending']));
    }
    const at = r(rows.length + 1);
    const allRows = rows.concat(decoyRows.slice(0, at), [targetRow], decoyRows.slice(at));
    const recordsCsv = allRows.join('\n');

    const decoyPorts = shuffle(DECOYS, r).slice(0, 2 + L.decoys);
    const scanRows = [
      { port: 22, svc: 'ssh', ver: pick(r, SSH_VERSIONS), state: 'open' },
      { port: 80, svc: 'http', ver: 'nginx 1.18.0', state: 'open' },
      ...decoyPorts
    ].sort((a, b) => a.port - b.port).map(p =>
      String(p.port + '/tcp').padEnd(9) + (p.state || 'open').padEnd(9) + p.svc.padEnd(10) + p.ver);

    const entryCmd = entry === 'notes' ? 'cat ~/loot/' + leakName + ENC_PIPE[L.enc]
      : entry === 'backup' ? 'curl -s http://' + targetIp + '/backup/' + backupName + ENC_PIPE[L.enc]
      : 'ftp get ' + backupName + ENC_PIPE[L.enc];

    const envCmd = 'cat ' + envPath + (L.env === 'hex' ? ' | xxd -r' : ' | base64 -d');
    const entryLead = entry === 'notes'
      ? 'Your scrape of a public repository turned up staff build notes. They are in ~/loot/.'
      : entry === 'backup'
        ? 'The old site left its backup directory readable. The scan should show it under /backup/.'
        : 'The hosting provider left anonymous FTP enabled. The config dump is in the root of that FTP.';

    const menu = {
      brief: [
        'ENGAGEMENT  ' + org.name + ' — ' + org.asset,
        'TARGET      ' + targetIp + ' (web01.' + org.domain + ')',
        'SCOPE       web01 and the database host it reaches (db01.' + org.domain + '). No DoS, no data outside scope.',
        'OBJECTIVE   submit the record id for ' + given + '\'s entry in ' + org.asset + '.',
        'ENTRY LEAD  ' + entryLead,
        'YOUR BOX    ops@workstation. ~/loot holds what you scraped; this terminal is all you need.'
      ].join('\n'),
      hints: {
        recon: 'nmap -sV -Pn ' + targetIp,
        creds: entryCmd,
        shell: 'ssh ' + sshUser + '@' + targetIp,
        root: esc.hint,
        dbcred: envCmd + ' | grep DB_PASSWORD',
        pivot: 'ssh ' + dbUser + '@db01.' + org.domain,
        record: 'grep -i ' + given.split(' ')[0] + ' /srv/exports/records.csv   then   submit <the id>'
      }
    };

    const mission = {
      seed: seed >>> 0, level: lv, levelName: L.name, diff: L.diff,
      org, given, targetIp, sshUser, sshPass, dbPass, dbUser,
      domain: org.domain, asset: org.asset, recordId,
      entry, leakName, backupName, entryStored, entryCmd, enc: L.enc, encName: ENC_NAME[L.enc],
      envPath, envStored: encode(envText, L.env), envCmd, envEncName: ENC_NAME[L.env],
      recordsCsv, scanRows, esc, menu,
      par: L.par, decoys: L.decoys
    };
    mission.trees = buildTrees(mission, leakText, envText);
    mission.briefText = menu.brief;
    return mission;
  }

  const isDir = n => n && typeof n === 'object' && !('text' in n);
  const textOf = n => typeof n === 'string' ? n : String(n.text);
  const modeOf = n => typeof n === 'string' ? '644' : (n.mode || '644');
  const f = (text, mode) => ({ text, mode: mode || '644' });
  const noRead = n => /^0+$/.test(modeOf(n));

  function buildTrees(m, leakText, envText) {
    const sudoLine = m.esc.rule.map(l => l.replace('{user}', m.sshUser)).join('\n');
    const local = {
      home: {
        ops: {
          'brief.txt': f(m.menu.brief),
          loot: m.entry === 'notes' ? { [m.leakName]: f(m.entryStored) } : { 'empty.txt': f('nothing here yet') },
          '.bash_history': f(['nmap -sV ' + m.targetIp, 'curl http://' + m.targetIp + '/', 'ftp ' + m.targetIp].join('\n'), '600'),
          notes: { 'method.txt': f('Notes to self\n- leaked configs are usually just encoded, not encrypted\n- decode before you conclude anything\n- read /etc/passwd, then the sudo policy') }
        }
      },
      etc: {
        hosts: f('127.0.0.1 localhost\n' + m.targetIp + '  ' + m.org.code + '-www')
      }
    };
    const put = (root, p, node) => {
      const parts = String(p).split('/').filter(Boolean);
      let n = root;
      for (let i = 0; i < parts.length - 1; i++) { if (!n[parts[i]]) n[parts[i]] = {}; n = n[parts[i]]; }
      n[parts[parts.length - 1]] = node;
      return root;
    };
    const web = {
      etc: {
        passwd: f(['root:x:0:0:root:/root:/bin/bash', 'daemon:x:1:1:daemon:/usr/sbin:/usr/sbin/nologin', 'www-data:x:33:33:www-data:/var/www:/usr/sbin/nologin', m.sshUser + ':x:1001:1001::/home/' + m.sshUser + ':/bin/bash', m.dbUser + ':x:1002:1002::/home/' + m.dbUser + ':/bin/bash'].join('\n')),
        hosts: f(['127.0.0.1 localhost', '10.40.12.20 web01.' + m.domain + ' web01', '10.40.8.11 db01.' + m.domain + ' db01'].join('\n')),
        shadow: f('root:$6$rounds=5000$fakerehash$notarealhash:19000:0:99999:7:::', '000'),
        'sudoers.d': { deploy: f(sudoLine, '440') },
        'cron.d': { nightly: f('*/5 * * * * root /opt/backup/run.sh') }
      },
      usr: { bin: { nmap: f('# ELF 64-bit LSB pie executable, x86-64', m.esc.id === 'suid-nmap' ? '4755' : '755') } },
      var: {
        www: {
          app: {
            'index.php': f('<?php\nrequire __DIR__ . "/bootstrap.php";\necho $router->handle($_SERVER["REQUEST_URI"]);'),
            'config.php': f('<?php\n// settings are read from the environment\nreturn require __DIR__ . "/bootstrap.php";'),
            uploads: {}
          },
          backup: m.entry === 'backup' ? { [m.backupName]: f(m.entryStored) } : { 'readme.txt': f('older builds were cleaned up') }
        },
        log: {
          'auth.log': f([
            '06:02:11 web01 sshd[2211]: Accepted publickey for backup from 10.40.0.9 port 44212',
            '06:12:44 web01 sshd[2317]: Accepted password for ' + m.sshUser + ' from ' + m.targetIp + ' port 51234',
            '06:41:19 web01 sshd[2409]: Accepted password for backup from 10.40.0.9 port 44310'
          ].join('\n'), '640')
        }
      },
      opt: { backup: { 'run.sh': f('#!/bin/sh\nset -e\ntar -czf /srv/backups/app.tgz /var/www/app\necho "backup complete"', '777') } },
      home: { [m.sshUser]: {
        'notes.txt': f('build notes\n- the app lives in /var/www/app\n- backups run from /opt/backup/run.sh every 5 minutes\n- records sit on db01.' + m.domain),
        '.bash_history': f('sudo -l\nfind / -perm -4000 -type f 2>/dev/null\nexit', '600')
      } },
      root: { '.bash_history': f('cat /var/log/auth.log', '600') }
    };
    const db = {
      srv: { exports: { 'records.csv': f(m.recordsCsv) }, backups: {} },
      etc: { hostname: f('db01'), hosts: f('127.0.0.1 localhost\n10.40.8.11 db01.' + m.domain + ' db01') },
      home: { [m.dbUser]: { '.psql_history': f('\\c ' + m.asset.replace(/\s+/g, '_') + '\nselect count(*) from records;', '600') } },
      var: { lib: { postgresql: { data: { 'PG_VERSION': f('15') } } } }
    };
    put(web, m.envPath, f(m.envStored));
    return { ops: local, web, db };
  }

  /* ---------------------------------------------------------------- one shell session */
  const Unix = typeof module !== 'undefined' && module.exports ? require('./terminal-unix.js') : TerminalUnix;
  const Training = typeof module !== 'undefined' && module.exports ? require('./terminal-ops-training.js') : TerminalOpsTraining;

  function session(m) {
    const trees = JSON.parse(JSON.stringify(m.trees));
    const homeOf = { ops: ['home', 'ops'], web: ['home', m.sshUser], db: ['home', m.dbUser] };
    const userOf = { ops: 'ops', web: m.sshUser, db: m.dbUser };
    const hostOf = { ops: 'workstation', web: 'web01', db: 'db01' };
    const cwd = { ops: homeOf.ops.slice(), web: homeOf.web.slice(), db: ['srv'] };
    const hist = [];
    const st = {
      host: 'ops', root: false, scanned: false, passSeen: false, accessed: false,
      dbPassSeen: false, recordSeen: false, submitted: false, nmapMode: false,
      hints: 0, commands: 0, failures: 0, done: false, score: 0
    };

    /* ---------------- filesystem helpers */
    const tree = () => trees[st.host];
    const isDirNode = n => n && typeof n === 'object' && !('text' in n);
    const modeOfNode = n => Unix.octal(Unix.mode(n, isDirNode(n)));
    const textOfNode = n => typeof n === 'string' ? n : String(n.text);
    const owns = parts => homeOf[st.host].every((name, index) => parts[index] === name) || parts[0] === 'tmp';
    const path = () => '/' + cwd[st.host].join('/');
    const homePath = () => '/' + homeOf[st.host].join('/');
    const disp = () => {
      const hp = homePath(), p = path();
      return p === hp ? '~' : p.startsWith(hp + '/') ? '~' + p.slice(hp.length) : p;
    };
    const prompt = () => (st.root ? 'root' : userOf[st.host]) + '@' + hostOf[st.host] + ':' + disp() + (st.root ? '# ' : '$ ');
    const walk = parts => {
      let n = tree();
      for (const s of parts) {
        if (!isDirNode(n) || !Object.hasOwn(n, s)) return undefined;
        n = n[s];
      }
      return n;
    };
    const resolve = p => {
      if (!p || p === '~') return homeOf[st.host].slice();
      if (p.startsWith('~/')) p = homePath() + p.slice(1);
      const parts = p.startsWith('/') ? [] : cwd[st.host].slice();
      for (const s of p.split('/')) {
        if (!s || s === '.') continue;
        if (s === '..') parts.pop(); else parts.push(s);
      }
      return parts;
    };
    const readPath = arg => {
      const parts = resolve(arg);
      const n = walk(parts);
      if (n === undefined) return { err: arg + ': No such file or directory' };
      if (isDirNode(n)) return { err: arg + ': Is a directory' };
      if (!st.root && !(Unix.mode(n) & (owns(parts) ? 0o400 : 0o004))) return { err: arg + ': Permission denied' };
      return { text: textOfNode(n) };
    };
    const srcOf = (args, stdin) => {
      if (args.length) return readPath(args[0]);
      if (stdin != null) return { text: stdin };
      return { err: 'expected a file or piped input' };
    };
    const readArgOrText = (args, stdin) => {
      if (!args.length) return { text: stdin == null ? '' : stdin };
      return walk(resolve(args[0])) !== undefined ? readPath(args[0]) : { text: args.join(' ') };
    };
    const listWalk = (node, base, re, type, res) => {
      for (const k of Object.keys(node).sort()) {
        const p = base + '/' + k, dir = isDirNode(node[k]);
        if ((!type || (type === 'd' && dir) || (type === 'f' && !dir)) && (!re || re.test(k))) res.push(p);
        if (dir) listWalk(node[k], p, re, type, res);
      }
      return res;
    };
    const globRe = g => new RegExp('^' + g.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.') + '$', 'i');
    const permOf = n => Unix.permissions(n, isDirNode(n));
    const tokenize = s => {
      const out = []; let cur = '', q = null;
      for (let i = 0; i < s.length; i++) {
        const ch = s[i];
        if (q) { if (ch === q) q = null; else cur += ch; }
        else if (ch === '"' || ch === "'") q = ch;
        else if (ch === '\\' && i + 1 < s.length) cur += s[++i];
        else if (/\s/.test(ch)) { if (cur) { out.push(cur); cur = ''; } }
        else cur += ch;
      }
      if (cur) out.push(cur);
      return out;
    };
    const lines = (t, fn) => String(t == null ? '' : t).split('\n').map((l, i) => fn(l, i));

    /* ---------------- mission-side effects */
    const objectives = [
      { id: 'recon', label: 'Scan the exposed host', hint: () => m.menu.hints.recon },
      { id: 'creds', label: 'Recover the initial credential', hint: () => m.menu.hints.creds },
      { id: 'shell', label: 'Land a shell on web01', hint: () => m.menu.hints.shell },
      { id: 'root', label: 'Escalate to root', hint: () => m.menu.hints.root },
      { id: 'dbcred', label: 'Extract the database password', hint: () => m.menu.hints.dbcred },
      { id: 'pivot', label: 'Reach db01', hint: () => m.menu.hints.pivot },
      { id: 'record', label: 'Submit the target record id', hint: () => m.menu.hints.record }
    ];
    const doneOf = id => id === 'recon' ? st.scanned
      : id === 'creds' ? st.passSeen
      : id === 'shell' ? st.accessed
      : id === 'root' ? st.root
      : id === 'dbcred' ? st.dbPassSeen
      : id === 'pivot' ? (st.host === 'db' || st.onDb)
      : st.submitted;
    const objState = () => objectives.map(o => ({ id: o.id, label: o.label, done: !!doneOf(o.id) }));

    const grantRoot = () => {
      st.root = true;
      st.nmapMode = false;
      return 'uid=0(root) gid=0(root) groups=0(root)\nroot shell acquired — you are root on web01.';
    };

    /* ---------------- detection of secrets in output */
    const detect = out => {
      if (!out) return '';
      if (!st.passSeen && out.includes(m.sshPass)) st.passSeen = true;
      if (!st.dbPassSeen && out.includes('DB_PASSWORD=' + m.dbPass)) st.dbPassSeen = true;
      if (!st.recordSeen && out.includes(m.recordId)) st.recordSeen = true;
      return '';
    };

    /* ---------------- commands */
    const curUser = () => st.root ? 'root' : userOf[st.host];
    const sshHost = h => {
      const bare = String(h || '').toLowerCase();
      return bare === m.targetIp || bare === 'web01' || bare === 'web01.' + m.domain;
    };
    const dbHost = h => {
      const bare = String(h || '').toLowerCase();
      return bare === 'db01' || bare === 'db01.' + m.domain;
    };

    const cmds = {
      ...Training.tools,
      help: () => ({
        out: [
          'Terminal ops shell — commands that work here',
          '',
          '  files      ls -la · cd · pwd · tree · cat · head · tail · stat · file · chmod',
          '  search     grep -inr · find -name / -perm · strings · wc -l · sort · uniq · cut · tr',
          '  decode     base64 -d · xxd [-r] · rot13 · rev        (pipes work)',
          '  access     ssh user@host · exit · sudo -l · docker · id · whoami',
          '  network    nmap -sV <ip> · curl <url> · ftp <ip> · ftp get <file>',
          '  training   security-tools · capinfos · tshark · tcpdump · yara · jq · lastb · password-audit',
          '  integrity  md5sum · sha1sum · sha256sum',
          '  mission    brief · objectives · hint · submit <record id>',
          '',
          'Example: cat /var/www/app/.env.b64 | base64 -d | grep DB_PASSWORD'
        ].join('\n')
      }),
      chmod: a => Unix.chmod(a, resolve, walk, isDirNode, parts => st.root || owns(parts)),
      brief: () => ({ out: m.briefText }),
      objectives: () => ({ out: objectives.map(o => (doneOf(o.id) ? '[x] ' : '[ ] ') + o.label).join('\n') }),
      obj: () => cmds.objectives(),
      hint: () => {
        const next = objectives.find(o => !doneOf(o.id));
        if (!next) return { out: 'Everything on the checklist is done.' };
        st.hints++;
        return {
          out: 'hint · ' + next.label + '\n  ' + next.hint() +
            (levels[m.level].hintCost ? '\n  (this hint costs ' + levels[m.level].hintCost + ' points)' : '')
        };
      },
      submit: a => {
        const v = String(a[0] || '').trim().toUpperCase();
        if (!v) return { out: 'usage: submit <record id>', err: true };
        if (v === m.recordId.toUpperCase()) {
          st.submitted = true;
          return { out: '✓ ' + v + ' is the engagement record. Objective met.' };
        }
        st.failures++;
        return { out: '✗ ' + v + ' is not the engagement record. Check db01 again.' };
      },
      flag: a => cmds.submit(a),
      pwd: () => ({ out: path() }),
      whoami: () => ({ out: curUser() }),
      id: () => ({
        out: 'uid=' + (st.root ? '0(root)' : (st.host === 'ops' ? '1000' : '1001') + '(' + curUser() + ')') +
          ' gid=' + (st.root ? '0(root)' : '1001(' + curUser() + ')') +
          ' groups=' + (st.root ? '0(root)' : '1001(' + curUser() + ')' + (m.esc.id === 'docker' ? ',999(docker)' : ''))
      }),
      hostname: () => ({ out: hostOf[st.host] }),
      uname: a => ({ out: a.includes('-a') ? 'Linux ' + hostOf[st.host] + ' 5.15.0-91-generic #101-Ubuntu SMP x86_64 GNU/Linux' : 'Linux' }),
      date: () => ({ out: 'Thu Feb 12 06:58:12 UTC 2026' }),
      history: () => ({ out: hist.map((h, i) => String(i + 1).padStart(3) + '  ' + h).join('\n') }),
      env: () => ({ out: ['SHELL=/bin/bash', 'USER=' + curUser(), 'HOME=' + homePath(), 'PWD=' + path(), 'DB_HOST=db01.' + m.domain, 'DB_USER=' + m.dbUser, 'MAIL_PASSWORD=CHANGEME'].join('\n') }),
      printenv: a => {
        const all = { SHELL: '/bin/bash', USER: curUser(), HOME: homePath(), PWD: path(), DB_HOST: 'db01.' + m.domain, DB_USER: m.dbUser };
        if (!a.length) return { out: Object.entries(all).map(([k, v]) => k + '=' + v).join('\n') };
        return { out: all[a[0]] == null ? '' : all[a[0]] };
      },
      echo: a => ({ out: a.join(' ') }),
      ls: a => {
        let flags = '', targets = [];
        for (const x of a) { if (x.startsWith('-') && x.length > 1) flags += x.slice(1); else targets.push(x); }
        if (!targets.length) targets = ['.'];
        const long = flags.includes('l'), all = flags.includes('a');
        const outs = [];
        for (const t of targets) {
          const n = walk(resolve(t));
          if (n === undefined) { outs.push("ls: cannot access '" + t + "': No such file or directory"); continue; }
          if (!isDirNode(n)) { outs.push(long ? permOf(n) + ' 1 ' + curUser() + ' ' + curUser() + ' ' + textOfNode(n).length + ' ' + t : t); continue; }
          const names = Object.keys(n).filter(k => all || k[0] !== '.').sort();
          if (!names.length) { outs.push('total 0'); continue; }
          if (long) outs.push('total ' + names.length, ...names.map(k => {
            const c = n[k];
            return permOf(c) + ' 1 ' + curUser() + ' ' + curUser() + ' ' + String(isDirNode(c) ? 4096 : textOfNode(c).length).padStart(6) + ' Feb 12 06:1' + (k.length % 6) + ' ' + k + (isDirNode(c) ? '/' : '');
          }));
          else outs.push(names.map(k => k + (isDirNode(n[k]) ? '/' : '')).join('   '));
        }
        return { out: outs.join('\n') };
      },
      cd: a => {
        const t = a[0] || '~';
        const p = resolve(t);
        const n = walk(p);
        if (n === undefined) return { out: 'cd: ' + t + ': No such file or directory' };
        if (!isDirNode(n)) return { out: 'cd: ' + t + ': Not a directory' };
        cwd[st.host] = p;
        return { out: '' };
      },
      tree: a => {
        const t = a.find(x => !x.startsWith('-')) || '.';
        const n = walk(resolve(t));
        if (!isDirNode(n)) return { out: t + ': No such file or directory' };
        const rows = [t];
        const walkTree = (node, prefix, depth) => {
          const keys = Object.keys(node).filter(k => k[0] !== '.').sort();
          keys.forEach((k, i) => {
            const last = i === keys.length - 1;
            rows.push(prefix + (last ? '`-- ' : '|-- ') + k + (isDirNode(node[k]) ? '/' : ''));
            if (isDirNode(node[k]) && depth < 3) walkTree(node[k], prefix + (last ? '    ' : '|   '), depth + 1);
          });
        };
        walkTree(n, '', 0);
        return { out: rows.join('\n') };
      },
      cat: (a, stdin) => {
        if (!a.length) return stdin == null ? { out: 'usage: cat <file>', err: true } : { out: stdin };
        const outs = [];
        for (const file of a) {
          const r = readPath(file);
          if (r.err) return { out: 'cat: ' + r.err, err: true };
          outs.push(r.text);
        }
        return { out: outs.join('\n') };
      },
      head: (a, stdin) => {
        let n = 10; const files = [];
        for (let i = 0; i < a.length; i++) {
          const x = a[i];
          if (x === '-n') n = +a[++i] || 10;
          else if (/^-\d+$/.test(x)) n = +x.slice(1);
          else if (/^\d+$/.test(x)) n = +x;
          else files.push(x);
        }
        const r = srcOf(files, stdin);
        if (r.err) return { out: 'head: ' + r.err };
        return { out: String(r.text).split('\n').slice(0, n).join('\n') };
      },
      tail: (a, stdin) => {
        let n = 10; const files = [];
        for (let i = 0; i < a.length; i++) {
          const x = a[i];
          if (x === '-n') n = +a[++i] || 10;
          else if (/^-\d+$/.test(x)) n = +x.slice(1);
          else if (/^\d+$/.test(x)) n = +x;
          else files.push(x);
        }
        const r = srcOf(files, stdin);
        if (r.err) return { out: 'tail: ' + r.err };
        return { out: String(r.text).split('\n').slice(-n).join('\n') };
      },
      grep: (a, stdin) => {
        let flags = ''; const rest = [];
        for (const x of a) { if (x.startsWith('-') && x.length > 1) flags += x.slice(1); else rest.push(x); }
        const pat = rest.shift();
        if (pat == null) return { out: 'usage: grep [-inrc] <pattern> [file...]', err: true };
        let re;
        try { re = new RegExp(pat, flags.includes('i') ? 'i' : ''); } catch (e) { return { out: 'grep: invalid pattern' }; }
        const hits = [];
        const scan = (txt, label) => lines(txt, (l, i) => {
          if (re.test(l) !== flags.includes('v')) hits.push((label ? label + ':' : '') + (flags.includes('n') ? (i + 1) + ':' : '') + l);
        });
        if (!rest.length) { if (stdin == null) return { out: 'grep: no input' }; scan(stdin, ''); }
        else for (const file of rest) {
          const n = walk(resolve(file));
          if (n === undefined) return { out: 'grep: ' + file + ': No such file or directory' };
          if (isDirNode(n)) {
            if (!flags.includes('r')) return { out: 'grep: ' + file + ': Is a directory' };
            for (const p of listWalk(n, file, null, 'f', [])) { const r = readPath(p); if (!r.err) scan(r.text, p); }
          } else {
            const result = readPath(file);
            if (result.err) return { out: 'grep: ' + result.err, err: true };
            scan(result.text, file);
          }
        }
        if (flags.includes('c')) return { out: String(hits.length) };
        return { out: hits.join('\n') };
      },
      find: a => {
        if (a.some(x => x === '-perm')) {
          const rows = ['/usr/bin/passwd', '/usr/bin/sudo', '/usr/bin/mount', '/usr/bin/su'];
          if (m.esc.id === 'suid-nmap') rows.push('/usr/bin/nmap');
          return { out: rows.join('\n') };
        }
        let start = '.', name = null, type = null, icase = false;
        for (let i = 0; i < a.length; i++) {
          const x = a[i];
          if (x === '-name' || x === '-iname') { name = a[++i]; icase = x === '-iname'; }
          else if (x === '-type') type = a[++i];
          else if (!x.startsWith('-')) start = x;
        }
        const n = walk(resolve(start));
        if (!isDirNode(n)) return { out: "find: '" + start + "': No such file or directory" };
        const re = name ? globRe(name) : null;
        return { out: listWalk(n, start === '.' ? '.' : start, re, type, []).join('\n') };
      },
      wc: (a, stdin) => {
        const files = a.filter(x => !x.startsWith('-'));
        const r = srcOf(files, stdin);
        if (r.err) return { out: 'wc: ' + r.err };
        return { out: String(String(r.text).split('\n').length) };
      },
      strings: (a, stdin) => {
        const r = srcOf(a, stdin);
        if (r.err) return { out: 'strings: ' + r.err };
        return { out: (String(r.text).match(/[ -~]{4,}/g) || []).join('\n') };
      },
      file: a => {
        const n = walk(resolve(a[0] || '.'));
        if (n === undefined) return { out: a[0] + ': cannot open' };
        if (isDirNode(n)) return { out: a[0] + ': directory' };
        const t = textOfNode(n);
        return { out: a[0] + ': ' + (/^\s*<\?php/.test(t) ? 'PHP script, ASCII text' : /^#!/.test(t) ? 'POSIX shell script, ASCII text executable' : /^[0-9a-f \n]+$/i.test(t) ? 'ASCII text (hex)' : 'ASCII text') };
      },
      stat: a => {
        const formatted = Unix.permissionStat(a, p => walk(resolve(p)), isDirNode);
        if (formatted) return formatted;
        const n = walk(resolve(a[0] || '.'));
        if (n === undefined) return { out: "stat: cannot statx '" + a[0] + "': No such file or directory" };
        return { out: '  File: ' + (a[0] || '.') + '\n  Size: ' + (isDirNode(n) ? 4096 : textOfNode(n).length) + '\n  Mode: (' + modeOfNode(n) + '/' + permOf(n) + ')  Uid: (' + (st.root ? '0/root' : '1001/' + curUser()) + ')' };
      },
      base64: (a, stdin) => {
        const dec = a.some(x => /^-(d|-decode)$/.test(x));
        const r = readArgOrText(a.filter(x => !x.startsWith('-')), stdin);
        if (r.err) return { out: 'base64: ' + r.err };
        try {
          if (dec) {
            const text = String(r.text).replace(/\s+/g, '');
            return { out: typeof atob === 'function' ? atob(text) : Buffer.from(text, 'base64').toString('utf8') };
          }
          return { out: wrap(b64(String(r.text)), 76) };
        } catch (e) { return { out: 'base64: invalid input' }; }
      },
      xxd: (a, stdin) => {
        const dec = a.includes('-r');
        const r = readArgOrText(a.filter(x => !x.startsWith('-')), stdin);
        if (r.err) return { out: 'xxd: ' + r.err };
        const text = String(r.text);
        if (dec) {
          const hex = text.split('\n').map(l => l.replace(/^[0-9a-f]+:\s*/i, '').split(/\s{2,}/)[0]).join(' ').replace(/[^0-9a-f]/gi, '');
          if (!hex.length) return { out: 'xxd: no hex input' };
          let out = '';
          for (let i = 0; i + 1 < hex.length; i += 2) out += String.fromCharCode(parseInt(hex.slice(i, i + 2), 16));
          return { out };
        }
        const bytes = [...text].map(c => c.charCodeAt(0));
        const rows = [];
        for (let i = 0; i < bytes.length; i += 8) {
          const chunk = bytes.slice(i, i + 8);
          rows.push(i.toString(16).padStart(8, '0') + ': ' + chunk.map(b => b.toString(16).padStart(2, '0')).join(' ').padEnd(23) + '  ' + chunk.map(b => b >= 32 && b < 127 ? String.fromCharCode(b) : '.').join(''));
        }
        return { out: rows.join('\n') };
      },
      rot13: (a, stdin) => {
        const r = readArgOrText(a, stdin);
        if (r.err) return { out: 'rot13: ' + r.err };
        return { out: String(r.text).replace(/[a-z]/gi, c => String.fromCharCode((c <= 'Z' ? 65 : 97) + (c.charCodeAt(0) - (c <= 'Z' ? 65 : 97) + 13) % 26)) };
      },
      rev: (a, stdin) => {
        const r = readArgOrText(a, stdin);
        if (r.err) return { out: 'rev: ' + r.err };
        return { out: String(r.text).split('\n').map(l => [...l].reverse().join('')).join('\n') };
      },
      sort: (a, stdin) => {
        const r = srcOf(a.filter(x => !x.startsWith('-')), stdin);
        if (r.err) return { out: 'sort: ' + r.err };
        let l = String(r.text).split('\n');
        l.sort(a.includes('-n') ? (x, y) => parseFloat(x) - parseFloat(y) : undefined);
        if (a.includes('-r')) l.reverse();
        if (a.includes('-u')) l = l.filter((x, i) => i === 0 || x !== l[i - 1]);
        return { out: l.join('\n') };
      },
      uniq: (a, stdin) => {
        const r = srcOf(a.filter(x => !x.startsWith('-')), stdin);
        if (r.err) return { out: 'uniq: ' + r.err };
        const rows = []; let prev = null, n = 0;
        const flush = () => {
          if (prev === null) return;
          if (a.includes('-u') && n !== 1) return;
          if (a.includes('-d') && n < 2) return;
          rows.push((a.includes('-c') ? String(n).padStart(4) + ' ' : '') + prev);
        };
        for (const l of String(r.text).split('\n')) {
          if (l === prev) n++; else { flush(); prev = l; n = 1; }
        }
        flush();
        return { out: rows.join('\n') };
      },
      cut: (a, stdin) => {
        let d = '\t', field = 1; const files = [];
        for (let i = 0; i < a.length; i++) {
          const x = a[i];
          if (x === '-d' || x === '-f') { const v = a[++i]; if (x === '-d') d = v || '\t'; else field = parseInt(v, 10) || 1; }
          else if (/^-d./.test(x)) d = x.slice(2);
          else if (/^-f\d+/.test(x)) field = parseInt(x.slice(2), 10);
          else if (!x.startsWith('-')) files.push(x);
        }
        const r = srcOf(files, stdin);
        if (r.err) return { out: 'cut: ' + r.err };
        return { out: String(r.text).split('\n').map(l => l.split(d)[field - 1] || '').join('\n') };
      },
      tr: (a, stdin) => {
        const sets = a.filter(x => !x.startsWith('-'));
        const expand = s => {
          let o = '';
          for (let i = 0; i < s.length; i++) {
            if (i + 2 < s.length && s[i + 1] === '-') {
              for (let c = s.charCodeAt(i); c <= s.charCodeAt(i + 2); c++) o += String.fromCharCode(c);
              i += 2;
            } else o += s[i];
          }
          return o;
        };
        if (stdin == null) return { out: 'tr: missing input' };
        if (a.includes('-d')) {
          const set = expand(sets[0] || '');
          return { out: [...stdin].filter(c => !set.includes(c)).join('') };
        }
        const from = expand(sets[0] || ''), to = expand(sets[1] || '');
        return { out: [...stdin].map(c => {
          const i = from.indexOf(c);
          return i >= 0 ? (to[i] || to[to.length - 1] || '') : c;
        }).join('') };
      },
      nmap: a => {
        const ip = a.find(x => /^\d+\.\d+\.\d+\.\d+$/.test(x)) || '';
        if (a.includes('--interactive')) {
          if (m.esc.id !== 'suid-nmap') return { out: 'Starting Nmap 7.80\nInteractive mode is not available in this build.' };
          if (st.host !== 'web') return { out: 'nmap: interactive mode needs a shell on web01.' };
          st.nmapMode = true;
          return { out: 'Starting Nmap 7.80 ( https://nmap.org )\nInteractive mode. Type !sh for a shell.' };
        }
        if (!ip) return { out: 'usage: nmap -sV -Pn <ip>', err: true };
        if (ip !== m.targetIp) return { out: 'Note: Host ' + ip + ' seems to be down.\nNo ports scanned.' };
        st.scanned = true;
        const extra = m.entry === 'backup' ? '\n| http-backup: /backup/ readable (config backup present)'
          : m.entry === 'ftp' ? '\n| ftp-anon: Anonymous FTP login allowed (FTP code 230)'
          : '\n| http-note: staff build notes published in a public repository';
        return {
          out: 'Starting Nmap 7.94 ( https://nmap.org )\nNmap scan report for ' + ip + '\nHost is up (0.018s latency).\n\nPORT     STATE    SERVICE   VERSION\n' +
            m.scanRows.join('\n') + '\n' + extra + '\n\nHost script results:\n| egress: only tcp/80 and tcp/443 leave this network; inbound is blocked at the edge.'
        };
      },
      ssh: a => {
        const arg = a.find(x => !x.startsWith('-')) || '';
        if (!arg) return { out: 'usage: ssh user@host', err: true };
        const at = arg.indexOf('@');
        const user = at >= 0 ? arg.slice(0, at) : null;
        const host = at >= 0 ? arg.slice(at + 1) : arg;
        if (st.host === 'db') return { out: 'ssh: already on db01 — type exit first' };
        if (sshHost(host)) {
          if (st.host === 'web') return { out: 'ssh: you are already on web01' };
          if (user && user !== m.sshUser) {
            st.failures++;
            return { out: 'Permission denied (publickey,password).' };
          }
          if (!st.passSeen) {
            st.failures++;
            return { out: 'Permission denied (publickey,password).\nYou do not have the password yet — find the leaked credential first.' };
          }
          st.host = 'web';
          st.accessed = true;
          return { out: 'The authenticity of host \'' + host + '\' can\'t be established.\nWarning: Permanently added \'' + host + '\' (ED25519) to the list of known hosts.\n' + m.sshUser + '@web01:~$ (session open — you are on web01 as ' + m.sshUser + ')' };
        }
        if (dbHost(host)) {
          if (st.host !== 'web') return { out: 'ssh: connect to host ' + host + ' port 22: Connection timed out\n(db01 is only reachable from inside the estate — get a shell on web01 first)' };
          if (user && user !== m.dbUser) { st.failures++; return { out: 'Permission denied (publickey,password).' }; }
          if (!st.dbPassSeen) {
            st.failures++;
            return { out: 'Permission denied (publickey,password).\nYou do not have the database password yet — decode the application config on web01 first.' };
          }
          st.host = 'db';
          st.onDb = true;
          return { out: 'The authenticity of host \'' + host + '\' can\'t be established.\nWarning: Permanently added \'' + host + '\' (ED25519) to the list of known hosts.\n' + m.dbUser + '@db01:/srv$ (session open — you are on db01 as ' + m.dbUser + ')' };
        }
        return { out: 'ssh: connect to host ' + host + ' port 22: Connection timed out' };
      },
      exit: () => {
        if (st.host === 'db') { st.host = 'web'; return { out: 'logout\nConnection to db01 closed.\n' + m.sshUser + '@web01:~$ (back on web01)' }; }
        if (st.host === 'web') { st.host = 'ops'; st.root = false; return { out: 'logout\nConnection to web01 closed.\nops@workstation:~$ (back on your own box)' }; }
        return { out: 'logout: not connected' };
      },
      logout: () => cmds.exit(),
      sudo: a => {
        if (!a.length) return { out: 'usage: sudo [-l] <command>', err: true };
        if (a[0] === '-l') {
          return { out: 'Matching Defaults entries for ' + curUser() + ' on web01:\n    env_reset, mail_badpass, secure_path=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin\n\n' + m.esc.rule.map(l => l.replace('{user}', curUser())).join('\n') };
        }
        if (st.host !== 'web') return { out: 'sudo: no valid sudoers sources on this host' };
        const line = 'sudo ' + a.join(' ');
        if (!st.root && m.esc.test && m.esc.test(line)) return { out: grantRoot() };
        if (m.esc.id === 'suid-nmap') return { out: 'sudo: a password is required\n(sudo is not the way in here — look for a SUID binary)' };
        if (m.esc.id === 'docker') return { out: 'sudo: a password is required\nYou are in the docker group — you do not need sudo.' };
        return { out: 'sudo: a password is required' };
      },
      docker: a => {
        if (st.host !== 'web') return { out: 'docker: command not found' };
        if (m.esc.id !== 'docker') return { out: 'Cannot connect to the Docker daemon at unix:///var/run/docker.sock.' };
        if (a[0] === 'run' && /-v/.test(a.join(' '))) {
          if (st.root) return { out: 'You are already root.' };
          return { out: grantRoot() };
        }
        if (a[0] === 'ps') return { out: 'CONTAINER ID   IMAGE     COMMAND   STATUS\n3f1a2b9c7d10   app:1.4   "node"    Up 9 days' };
        return { out: 'usage: docker run -v /:/mnt --rm -it alpine chroot /mnt sh', err: true };
      },
      '!sh': () => {
        if (!st.nmapMode) return { out: 'bash: !sh: command not found' };
        return { out: grantRoot() };
      },
      '!bash': () => cmds['!sh'](),
      curl: a => {
        if (st.host !== 'ops') return { out: 'curl: (6) Could not resolve host' };
        const url = a.find(x => !x.startsWith('-')) || '';
        if (!url.includes(m.targetIp)) return { out: 'curl: (7) Failed to connect: connection refused', err: true };
        const p = url.replace(/^https?:\/\/[^/]+/, '') || '/';
        if (m.entry === 'backup') {
          if (p === '/' || p === '') return { out: '<html><head><title>Index of /</title></head><body><h1>Index of /</h1><a href="backup/">backup/</a></body></html>' };
          if (/^\/?backup\/?$/.test(p)) return { out: '<html><head><title>Index of /backup</title></head><body><h1>Index of /backup</h1><a href="' + m.backupName + '">' + m.backupName + '</a>   (2019-04-02)</body></html>' };
          if (p.indexOf(m.backupName) >= 0) return { out: m.entryStored };
          return { out: '<html><head><title>404 Not Found</title></head><body><h1>404</h1></body></html>' };
        }
        if (p === '/' || p === '') return { out: '<html><head><title>' + m.org.name + '</title></head><body><h1>It works!</h1></body></html>' };
        return { out: '<html><head><title>404 Not Found</title></head><body><h1>404</h1></body></html>' };
      },
      ftp: a => {
        if (m.entry !== 'ftp') return { out: 'ftp: connect: Connection refused', err: true };
        if (a[0] === 'get') {
          if (!a[1]) return { out: 'usage: ftp get <file>', err: true };
          if (a[1] === m.backupName) return { out: m.entryStored };
          return { out: '550 Failed to open file.' };
        }
        const ip = a.find(x => !x.startsWith('-')) || '';
        if (!ip) return { out: 'usage: ftp <ip>', err: true };
        if (ip !== m.targetIp) return { out: 'ftp: connect: Connection timed out', err: true };
        return { out: 'Connected to ' + m.targetIp + '.\n220 (vsFTPd 3.0.3)\nName: anonymous\n331 Please specify the password.\n230 Login successful.\nRemote system type is UNIX.\nUsing binary mode to transfer files.\nftp> dir\n-rw-r--r--    1 0 0   2048 Jan 12  2019 ' + m.backupName + '\n226 Directory send OK.\nftp> (use: ftp get ' + m.backupName + ')' };
      },
      clear: () => ({ out: '' }),
      cls: () => ({ out: '' }),
      ll: a => cmds.ls(['-la'].concat(a)),
      la: a => cmds.ls(['-a'].concat(a)),
      dir: a => cmds.ls(a),
      more: (a, stdin) => cmds.cat(a, stdin),
      less: (a, stdin) => cmds.cat(a, stdin),
      groups: () => ({ out: st.root ? 'root' : (curUser() + (st.host === 'web' && m.esc && m.esc.id === 'docker' ? ' docker' : '')) }),
      uptime: () => ({ out: ' 06:58:12 up 14 days,  3:22,  1 user,  load average: 0.12, 0.08, 0.05' }),
      ps: () => ({ out: '  PID TTY          TIME CMD\n    1 ?        00:00:02 systemd\n  412 ?        00:00:00 sshd\n  518 ?        00:00:11 nginx\n 1042 pts/0    00:00:00 bash' }),
      ss: () => ({ out: 'Netid State  Local Address:Port   Peer Address:Port\ntcp   LISTEN 0.0.0.0:22           0.0.0.0:*\ntcp   LISTEN 0.0.0.0:80           0.0.0.0:*\ntcp   ESTAB  ' + m.targetIp + ':22         10.10.0.2:51244' }),
      netstat: () => cmds.ss(),
      ip: a => ({ out: a[0] && a[0].startsWith('r') ? 'default via 10.10.0.1 dev eth0' : '2: eth0: <UP> inet ' + (st.host === 'ops' ? '10.10.0.2/24' : st.host === 'web' ? m.targetIp + '/24' : '10.40.8.11/24') }),
      ifconfig: () => cmds.ip([]),
      arp: () => ({ out: m.targetIp + ' ether 52:54:00:12:34:56 eth0\n10.40.8.11 ether 52:54:00:9a:bc:de eth0' }),
      df: () => ({ out: 'Filesystem      Size  Used Avail Use% Mounted on\n/dev/vda1        40G  9.1G   29G  24% /' }),
      du: () => ({ out: '64K\t/' + cwd[st.host].join('/') }),
      free: () => ({ out: '               total        used        free\nMem:           3.9Gi       1.1Gi       2.1Gi' }),
      ping: a => { const h = a.find(x => !x.startsWith('-')) || m.targetIp; return { out: 'PING ' + h + ' 56 bytes of data.\n64 bytes from ' + h + ': icmp_seq=1 ttl=64 time=0.41 ms\n1 packets transmitted, 1 received, 0% packet loss' }; },
      dig: a => { const h = a.find(x => !x.startsWith('-')) || m.domain; return { out: ';; ANSWER SECTION:\n' + h + '.\t300\tIN\tA\t' + m.targetIp }; },
      nslookup: a => { const h = a.find(x => !x.startsWith('-')) || m.domain; return { out: 'Name:\t' + h + '\nAddress: ' + m.targetIp }; },
      host: a => ({ out: (a[0] || m.domain) + ' has address ' + m.targetIp }),
      whois: a => ({ out: 'Domain Name: ' + (a[0] || m.domain).toUpperCase() + '\nOrg: ' + m.org.name }),
      traceroute: a => ({ out: 'traceroute to ' + (a[0] || m.targetIp) + '\n 1  gw (10.10.0.1)  0.4 ms\n 2  ' + (a[0] || m.targetIp) + '  1.2 ms' }),
      wget: a => cmds.curl(a),
      nc: a => ({ out: 'Connection to ' + (a[0] || m.targetIp) + ' ' + (a[1] || '22') + ' port [tcp/*] succeeded!' }),
      which: a => ({ out: a.map(x => cmds[x] ? '/usr/bin/' + x : '').filter(Boolean).join('\n') || 'which: no ' + (a[0] || '') }),
      type: a => ({ out: a.map(x => cmds[x] ? x + ' is /usr/bin/' + x : 'bash: type: ' + x + ': not found').join('\n') }),
      man: a => cmds.help(a),
      sed: (a, stdin) => {
        const sc = a.find(x => !x.startsWith('-')) || '', mm = sc.match(/^s(.)(.*?)\1(.*?)\1([gi]*)$/);
        if (!mm) return { out: 'sed: try s/old/new/g' };
        const r = srcOf(a.filter(x => x !== sc && !x.startsWith('-')), stdin);
        if (r.err) return { out: 'sed: ' + r.err };
        return { out: String(r.text).split('\n').map(l => l.replace(new RegExp(mm[2], (mm[4].includes('g') ? 'g' : '') + (mm[4].includes('i') ? 'i' : '')), mm[3])).join('\n') };
      },
      awk: (a, stdin) => {
        let sep = ' ', prog = '', files = [];
        for (let i = 0; i < a.length; i++) {
          if (a[i] === '-F') sep = a[++i] || ' ';
          else if (/^-F./.test(a[i])) sep = a[i].slice(2);
          else if (!prog && a[i].includes('{')) prog = a[i];
          else if (!a[i].startsWith('-')) files.push(a[i]);
        }
        const mm = prog.match(/\{[\s]*print\s+([^}]+)\}/);
        if (!mm) return { out: 'awk: try {print $1, $2}' };
        const flds = mm[1].split(',').map(x => x.trim()), r = srcOf(files, stdin);
        if (r.err) return { out: 'awk: ' + r.err };
        return { out: String(r.text).split('\n').map(l => { const p = sep === ' ' ? l.trim().split(/\s+/) : l.split(sep); return flds.map(f => f === '$0' ? l : /^\$\d+$/.test(f) ? (p[+f.slice(1) - 1] || '') : f.replace(/^"|"$/g, '')).join(' '); }).join('\n') };
      },
      nl: (a, stdin) => { const r = srcOf(a.filter(x => !x.startsWith('-')), stdin); return r.err ? { out: 'nl: ' + r.err } : { out: String(r.text).split('\n').map((l, i) => String(i + 1).padStart(6) + '\t' + l).join('\n') }; },
      tac: (a, stdin) => { const r = srcOf(a.filter(x => !x.startsWith('-')), stdin); return r.err ? { out: 'tac: ' + r.err } : { out: String(r.text).split('\n').reverse().join('\n') }; },
      hexdump: (a, stdin) => cmds.xxd(a.filter(x => x !== '-C'), stdin),
      od: (a, stdin) => cmds.xxd(a, stdin),
      md5sum: Unix.checksum('md5', readPath),
      sha1sum: Unix.checksum('sha1', readPath),
      sha256sum: Unix.checksum('sha256', readPath),
      seq: a => { const ns = a.map(Number), [s, e] = ns.length === 1 ? [1, ns[0]] : [ns[0], ns[1]], o = []; for (let i = s; i <= e && o.length < 100; i++) o.push(String(i)); return { out: o.join('\n') }; },
      basename: a => ({ out: String(a[0] || '').split('/').pop() || '/' }),
      dirname: a => ({ out: String(a[0] || '').split('/').slice(0, -1).join('/') || '.' }),
      printf: a => ({ out: String(a[0] || '').replace(/\\n/g, '\n').replace(/\\t/g, '\t') }),
      true: () => ({ out: '' }),
      false: () => ({ out: '' }),
      sleep: () => ({ out: '' })
    };

    /* Every command the shared kit knows (cp, mv, rm, mkdir, touch, filesystem and system tools, the shell's own
       builtins) answers here too. This shell's own versions always win. */
    {
      const Shared = typeof TerminalSharedCommands !== 'undefined' ? TerminalSharedCommands
        : (typeof module !== 'undefined' && module.exports ? require('./terminal-commands-shared.js') : null);
      if (Shared) Shared.fill(cmds, {
        shell: 'bash', user: curUser(), host: hostOf[st.host],
        cwd: () => path(),
        read: p => readPath(String(p)),
        write: (p, txt) => {
          const parts = resolve(String(p));
          let n = tree();
          for (let i = 0; i < parts.length - 1; i++) { if (!isDirNode(n[parts[i]])) n[parts[i]] = {}; n = n[parts[i]]; }
          n[parts[parts.length - 1]] = { text: String(txt == null ? '' : txt) };
        },
        remove: p => { const parts = resolve(String(p)); const parent = walk(parts.slice(0, -1)); if (isDirNode(parent)) delete parent[parts[parts.length - 1]]; },
        list: p => {
          const n = walk(resolve(String(p)));
          if (n === undefined || !isDirNode(n)) return { err: true, names: [] };
          return { names: Object.keys(n).sort(), dirs: Object.keys(n).filter(k => isDirNode(n[k])) };
        },
        mkdir: p => {
          const parts = resolve(String(p));
          let n = tree();
          for (const part of parts) { if (!isDirNode(n[part])) n[part] = {}; n = n[part]; }
          return '';
        },
        chdir: p => { const n = walk(resolve(String(p))); if (!isDirNode(n)) return false; cwd[st.host] = resolve(String(p)); return true; }
      });
    }

    /* ---------------- chain and pipeline parsing */
    function splitChain(s) {
      const parts = []; let cur = '', q = null;
      for (let i = 0; i < s.length; i++) {
        const c = s[i];
        if (q) { cur += c; if (c === q) q = null; continue; }
        if (c === '\\') { cur += c; if (i + 1 < s.length) cur += s[++i]; continue; }
        if (c === '"' || c === "'") { q = c; cur += c; continue; }
        if (c === ';') { parts.push(cur); cur = ''; continue; }
        if (c === '&' && s[i + 1] === '&') { parts.push(cur); cur = ''; i++; continue; }
        cur += c;
      }
      parts.push(cur);
      return parts.map(x => x.trim()).filter(Boolean);
    }
    function splitPipe(s) {
      const parts = []; let cur = '', q = null;
      for (let i = 0; i < s.length; i++) {
        const c = s[i];
        if (q) { cur += c; if (c === q) q = null; continue; }
        if (c === '\\') { cur += c; if (i + 1 < s.length) cur += s[++i]; continue; }
        if (c === '"' || c === "'") { q = c; cur += c; continue; }
        if (c === '|') { parts.push(cur); cur = ''; continue; }
        cur += c;
      }
      parts.push(cur);
      return parts.map(x => x.trim()).filter(Boolean);
    }

    /* ---------------- run one line, then score the objective changes */
    function run(line) {
      const raw = String(line == null ? '' : line).trim();
      if (!raw) return '';
      hist.push(raw);
      st.commands++;
      const before = objectives.map(o => doneOf(o.id));
      const outs = [];
      for (const part of splitChain(raw)) {
        let stdin = null, out = '', broke = false;
        for (const pipe of splitPipe(part)) {
          const listDir = dir => { const n = walk(resolve(dir)); return isDirNode(n) ? Object.keys(n) : []; };
          const TP = typeof window !== 'undefined' && window.TerminalPlayground;
          const words = TP && TP.expandShellWords ? TP.expandShellWords(pipe, listDir) : tokenize(pipe);
          const name = words.shift();
          const fn = cmds[name];
          if (!fn) { out = 'bash: ' + name + ': command not found'; broke = true; break; }
          let r;
          try { r = fn(words, stdin) || { out: '' }; } catch (e) { r = { out: 'bash: ' + name + ': ' + e.message }; }
          out = r.out == null ? '' : String(r.out);
          stdin = out;
          if (broke) break;
        }
        if (out !== '') outs.push(out);
      }
      let text = outs.join('\n');
      detect(text);
      const notices = objectives.filter((o, i) => !before[i] && doneOf(o.id)).map(o => '✓ objective complete — ' + o.label);
      if (notices.length) text += (text ? '\n' : '') + notices.join('\n');
      if (st.submitted && !st.done) {
        st.done = true;
        st.score = score();
        text += (text ? '\n\n' : '') + [
          '— engagement complete —',
          '  estate    web01 → db01.' + m.domain,
          '  commands  ' + st.commands + '   hints ' + st.hints + '   failed attempts ' + st.failures,
          '  score     ' + st.score + '/100   grade ' + grade(),
          '  Press "New mission" for a fresh estate — they never run out.'
        ].join('\n');
      }
      return text;
    }

    function score() {
      const L = levels[m.level];
      return Math.max(0, Math.min(100, 100 - st.hints * L.hintCost - st.failures * 6));
    }
    function grade() {
      const s = score();
      return s >= 92 ? 'A' : s >= 80 ? 'B' : s >= 66 ? 'C' : s >= 50 ? 'D' : 'E';
    }

    return {
      mission: m, state: st, prompt, run,
      objectives: objState, done: () => st.done,
      score, grade,
      hintCount: () => st.hints
    };
  }

  return { levels, generate, session, encode, encName: ENC_NAME, training: Training };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = TerminalOps;

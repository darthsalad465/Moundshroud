// Comprehensive test suite for all Cyber terminal simulations:
// - All 10 Terminal Playground shells (Bash, PowerShell, CMD, Python, Node, SQL, Git, Docker, Network, Encoding)
// - Terminal Ops, Live Fire (Red & Blue), Remote Access Shell, and Terminal Hacker/Academy
const fs = require('fs');
const path = require('path');
const vm = require('vm');

async function run(ok) {
  const root = path.join(__dirname, '..');

  /* ---- 1. Load all 10 Terminal Playground shells ---- */
  const storage = new Map();
  const ctx = {
    window: {}, globalThis: {}, console, Math, Date, JSON, Array, Object, String, Number, Boolean,
    RegExp, Error, TypeError, RangeError, Map, Set, Uint8Array, Uint32Array, Int32Array,
    parseInt, parseFloat, isNaN, isFinite, encodeURIComponent, decodeURIComponent,
    URL, URLSearchParams, TextEncoder, AbortController,
    btoa: s => Buffer.from(s, 'binary').toString('base64'),
    atob: s => Buffer.from(s, 'base64').toString('binary'),
    localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) }
  };
  ctx.self = ctx.window = ctx.globalThis = ctx;
  vm.createContext(ctx);
  const playgroundFiles = ['cyber-crack', 'terminal-unix', 'terminal-commands-shared', 'terminal-windows-commands', 'terminal-pc-profile', 'terminal-ops-training', 'terminal-playground-data', 'terminal-playground-data2',
    'terminal-playground-data3', 'terminal-playground-curios', 'terminal-playground-jobs', 'terminal-scenarios',
    'terminal-pentest', 'terminal-remote'];
  for (const script of playgroundFiles) {
    const f = 'web/js/' + script + '.js';
    vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx, { filename: f });
  }
  const TP = ctx.TerminalPlayground;
  const byId = id => TP.shells.find(s => s.id === id);
  require('./bash-combinations-test.js')(ok, TP.makeBash);

  const jobSeed = 12345;
  for (const shell of TP.shells.filter(s => !s.range)) {
    storage.set('tpg_jobs_' + shell.id, JSON.stringify({ number: 1, seed: jobSeed, completed: 0, active: false, solved: false }));
  }
  const getJobOutput = (shell, request, number) => {
    const lines = String(shell.run(request.hint)).trim().split('\n');
    const variant = (number - 1) % 5;
    if (['bash', 'powershell', 'cmd'].includes(shell.id)) {
      const numbers = lines.filter(Boolean).map(line => Number(line.split(',').at(-1)));
      return String([numbers[0], numbers.reduce((total, n) => total + n, 0), Math.max(...numbers), Math.min(...numbers), numbers.length][variant]);
    }
    if (shell.id === 'git') {
      if (lines.length !== 4) return '';
      return (variant === 0 ? lines.find(line => line.endsWith(request.answer)) : lines[[0, 0, 3, 1, 2][variant]])?.split(' ').at(-1);
    }
    if (shell.id === 'docker' && variant === 4) return String(lines.filter(line => line.split(/\s+/).at(-1).startsWith('worker-' + request.ticket)).length);
    if (shell.id === 'network') return variant === 4 ? lines.find(line => / IN A /.test(line))?.split(/\s+/)[1] : lines.at(-1)?.match(/192\.0\.2\.\d+/)?.[0] || lines.find(line => / IN A /.test(line))?.split(' ').at(-1);
    if (shell.id === 'sql') return lines[2]?.trim();
    if (shell.id === 'docker') {
      const row = lines.find(line => line.split(/\s+/).at(-1) === (variant === 1 || variant === 3 ? 'worker-' : 'reading-') + request.ticket);
      const columns = row?.split(/\s+/);
      return [columns?.[1], columns?.at(-1), columns?.at(-1), columns?.[1]?.split(':')[1]][variant];
    }
    return lines.join('\n');
  };
  const jobErrors = [];
  for (const shell of TP.shells.filter(s => !s.range)) {
    for (let number = 1; number <= 15; number++) {
      const request = TP.jobs.makeJob(shell.id, number, jobSeed);
      const brief = shell.run(number === 1 ? 'job start' : 'job next');
      const output = getJobOutput(shell, request, number);
      if (!brief.includes(request.ticket) || output !== request.answer ||
          !shell.run('job submit definitely-wrong').includes('does not match') ||
          !shell.run('job submit ' + request.answer).includes('Job complete')) {
        jobErrors.push(shell.id + ' job ' + number + ' expected ' + request.answer + ' got ' + output);
      }
    }
    if (!shell.run('job submit anything').includes('already') || shell.jobs().completed !== 15) jobErrors.push(shell.id + ' completion');
    shell.run('job leave');
  }
  ok('sandbox jobs: 150 assignments run through the normal command handlers across all ten terminals', !jobErrors.length, jobErrors.join(' | '));

  const practiceBash = byId('bash');
  practiceBash.run('printf %s free-play > keep.txt');
  practiceBash.run('job start');
  const currentBrief = practiceBash.run('job');
  const initialReadings = practiceBash.run('cat readings.csv');
  practiceBash.run('printf %s changed > readings.csv');
  practiceBash.run('job reset');
  const restoredReadings = practiceBash.run('cat readings.csv');
  const hiddenNormalFile = practiceBash.run('cat keep.txt');
  practiceBash.run('job leave');
  ok('sandbox jobs: reset restores only the job, and leaving resumes free play', initialReadings === restoredReadings &&
    currentBrief.includes('Job 15') && hiddenNormalFile.includes('No such file') && practiceBash.run('cat keep.txt') === 'free-play');

  const eggCommands = ['fortune', 'Get-MoonPhase', 'dir /moon', 'import moth', 'require("moon-dust")',
    'curio SELECT * FROM lost_socks;', 'git stash list --attic', 'docker stats --aquarium', 'ping moon.test', 'curio hex moonstone'];
  ok('sandbox curios: every shell has hidden interactions, and repeated discoveries do not increase the total',
    TP.shells.filter(shell => !shell.range).every((shell, i) => shell.run(eggCommands[i]).includes('✦ Discovered:') && !shell.run(eggCommands[i]).includes('✦ Discovered:')) &&
    practiceBash.run('curios').includes('10/70 discovered') &&
    !byId('crypto').run('hex moonstone').includes('moonstone falls'));
  ok('sandbox curios: app and Sleepy Hollow eggs answer in every shell',
    byId('python').run('moundshroud').includes('offline assistant') && byId('sql').run('headless horseman').includes('Sleepy Hollow') &&
    byId('bash').run('cd /sleepy-hollow').includes('closed after dark') && byId('cmd').run('pumpkin').includes('shattered pumpkin') &&
    byId('git').run('find head').includes('since 1776'));

  // Every documented example across all 10 shells runs cleanly without command-not-found or NameError (the Security
  // ranges have their own examples: some only make sense inside a shell or session, so they are tested on their own)
  let badExamples = [];
  for (const sh of TP.shells.filter(shell => !shell.range)) {
    for (const c of sh.commands) {
      const out = String(sh.run(c.ex) || '');
      if (/command not found|not recognized|NameError:|is not a git command|is not a docker command|does not exist/i.test(out)) {
        badExamples.push(sh.id + ': ' + c.ex + ' => ' + out.slice(0, 80));
      }
    }
  }
  ok('playground: every documented example across all 10 shells runs cleanly', badExamples.length === 0, badExamples.join(' | '));

  // Bash / Linux deep command verification
  const bash = byId('bash');
  bash.run('reset');
  ok('bash: AND/OR lists short-circuit left to right and preserve the last executed status',
    bash.run('false && echo skipped || echo fallback') === 'fallback' &&
    bash.run('true || echo skipped && echo continued') === 'continued' &&
    bash.run('false ||\n echo fallback') === 'fallback' &&
    bash.run('true || echo skipped |').includes('syntax error') &&
    bash.run('false && echo skipped; echo "$?"') === '1' &&
    bash.run('no_such_command 2>/dev/null') === '' && bash.run('echo ${?}') === '127' &&
    bash.run('mkdir projects 2>/dev/null && echo skipped || echo exists') === 'exists');
  ok('bash: the last pipeline stage sets status unless pipefail is enabled, and ! inverts it',
    bash.run('false | true; echo "$?"') === '0' &&
    bash.run('set -o pipefail; false | true; echo "$?"') === '1' &&
    bash.run('! false | true; echo "$?"') === '0' &&
    bash.run('set +o pipefail; ! false | true; echo "$?"') === '1');
  ok('bash: redirections keep stderr separate, respect descriptor order, and fail before executing the command',
    bash.run('cat missing 2>/dev/null | wc -l') === '0' &&
    bash.run('cat missing 2>&1 | wc -l') === '1' &&
    bash.run('cat missing |& wc -l') === '1' &&
    bash.run('cat missing > "out file" 2>&1') === '' && bash.run('cat "out file"').includes('No such file') &&
    bash.run('cat missing 2>&1 > "out file"').includes('No such file') && bash.run('cat "out file"') === '' &&
    bash.run('cd projects > no-such-directory/out 2>/dev/null').includes('No such file') && bash.run('pwd') === '/home/moundshroud');
  ok('bash: echo, printf, redirection and cat preserve input bytes for wc and checksum commands',
    bash.run('printf "one\\ntwo" | wc -l') === '1' &&
    bash.run('echo hi | sha256sum') === '98ea6e4f216f2fb4b69fff9b3a44842c38686ca685f3f55dc48c5d3fb1107be4  -' &&
    bash.run('echo -n hi | sha256sum') === '8f434346648f6b96df89dda901c5176b10a6d83961dd3c1ac88b59b2dc327aa4  -' &&
    bash.run('printf a > one; printf b >> one; printf c > two; cat one two') === 'abc' &&
    bash.run("echo 'x | > y && $?'") === 'x | > y && $?');
  ok('bash: grep and test return truthful statuses and pipeline/substitution changes stay local',
    bash.run('grep -c DOES_NOT_MATCH notes.txt || echo no-match') === '0\nno-match' &&
    bash.run('grep -q todo notes.txt && [ 3 -lt 4 ] && echo yes') === 'yes' &&
    bash.run('test -f nonexistent; echo "$?"') === '1' &&
    bash.run('cd projects | cat; pwd') === '/home/moundshroud' &&
    bash.run('echo "$(cd projects && pwd)"; pwd') === '/home/moundshroud/projects\n/home/moundshroud');
  bash.run('reset');
  ok('bash: symbolic and numeric chmod update stat, ls, and owner read access',
    bash.run('chmod 024 notes.txt') === '' &&
    bash.run('cat notes.txt').includes('Permission denied') &&
    bash.run('chmod u+r notes.txt') === '' &&
    bash.run('stat -c "%a %A" notes.txt') === '424 -r---w-r--' &&
    bash.run('ls -l notes.txt').startsWith('-r---w-r--') &&
    bash.run('cat notes.txt').includes('todo') &&
    bash.run('chmod u+r no-such-file').includes('No such file or directory') &&
    bash.run('chmod u+bogus notes.txt').includes('invalid mode'));
  bash.run('reset');
  ok('bash: recursive chmod, copied permissions and reference modes work across files and directories',
    bash.run('chmod -R go= projects') === '' &&
    bash.run('stat -c %a projects projects/deploy.sh') === '700\n700' &&
    bash.run('chmod g=u,o+r projects/deploy.sh') === '' &&
    bash.run('chmod --reference=projects/deploy.sh notes.txt') === '' &&
    bash.run('stat -c %a notes.txt') === '774');
  bash.run('reset');
  ok('bash: file checksums match known SHA-256 and MD5 vectors',
    bash.run('printf %s abc > vector.txt') === '' &&
    bash.run('sha256sum vector.txt') === 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad  vector.txt' &&
    bash.run('md5sum vector.txt') === '900150983cd24fb0d6963f7d28e17f72  vector.txt');
  bash.run('reset');
  ok('bash: input redirection < and tr a-z A-Z range expansion work',
    /[A-Z]{5,}/.test(bash.run('tr a-z A-Z < notes.txt')) && !/tr: missing input/.test(bash.run('tr a-z A-Z < notes.txt')));
  const bashChecks = [
    ['tree', bash.run('tree').includes('projects/')],
    ['stat', bash.run('stat notes.txt').includes('Size:')],
    ['file', bash.run('file notes.txt').includes('ASCII text')],
    ['nl', bash.run('nl notes.txt').includes('1\t')],
    ['rev', bash.run('echo abc | rev') === 'cba'],
    ['md5sum', /^[0-9a-f]{32}\s+notes\.txt$/.test(bash.run('md5sum notes.txt'))],
    ['sha256sum', /^[0-9a-f]{64}\s+notes\.txt$/.test(bash.run('sha256sum notes.txt'))],
    ['seq', bash.run('seq 1 3') === '1\n2\n3'],
    ['expr', bash.run('expr 6 \\* 7') === '42' && bash.run('expr 20 + 22') === '42'],
    ['ip', bash.run('ip a').includes('10.0.0.5')],
    ['ss', bash.run('ss -tulpn').includes('LISTEN')],
    ['dig', bash.run('dig api.internal').includes('10.0.0.5')],
    ['hostname', bash.run('hostname') === 'dev-box'],
    ['lscpu', bash.run('lscpu').includes('x86_64')],
    ['systemctl', bash.run('systemctl status ssh').includes('active')],
    ['ll', bash.run('ll').includes('README.md')]
  ];
  ok('bash: full POSIX additions (tree, stat, file, nl, rev, tac, md5sum, sha256sum, seq, expr, ip, ss, dig, hostname, lscpu, systemctl, ll)',
    bashChecks.every(x => x[1]),
    bashChecks.filter(x => !x[1]).map(x => x[0] + '=' + JSON.stringify(bash.run(x[0]))).join(', '));

  // Real-terminal behaviour: history expansion, type, ls -la with . and .., GNU errors, /etc files, tree.com in Windows shells
  {
    bash.run('cd ~');
    bash.run('echo realism-check');
    const again = bash.run('!!'), prefix = bash.run('!echo'), missingEvent = bash.run('!nosuchcommand');
    const listing = bash.run('ls -la').split('\n');
    const winTree = byId('cmd').run('tree /f C:\\Users\\moundshroud'), psTree = byId('powershell').run('tree');
    const checks = [
      ['!!', again === 'echo realism-check\nrealism-check'],
      ['!prefix', prefix === 'echo realism-check\nrealism-check'],
      ['event not found', missingEvent === 'bash: !nosuchcommand: event not found'],
      ['type builtin', bash.run('type cd') === 'cd is a shell builtin' && bash.run('type ls') === 'ls is /usr/bin/ls'],
      ['ls -la dots', / \.$/.test(listing[1]) && / \.\.$/.test(listing[2]) && !listing.some(row => /\/$/.test(row))],
      ['no hint in errors', bash.run('cat nothing-here.txt') === 'cat: nothing-here.txt: No such file or directory'],
      ['base64 invalid', bash.run('echo "not base64!" | base64 -d') === 'base64: invalid input'],
      ['etc', bash.run('cat /etc/hostname') === 'dev-box' && bash.run('grep ^moundshroud: /etc/passwd').startsWith('moundshroud:x:1000')],
      ['tree.com', /notes\.txt/.test(winTree) && !/notes\.txt/.test(psTree) && /Documents/.test(psTree)]
    ];
    ok('terminal realism: history expansion, type, ls -la, GNU error text, /etc files and tree.com behave like real shells',
      checks.every(x => x[1]), checks.filter(x => !x[1]).map(x => x[0]));
  }

  // Sandbox scenarios: random disks repeat by seed, the text format round-trips, files land on the real disk, the hidden note survives
  {
    const SC = TP.scenarios;
    const first = SC.randomize('bash', 42), same = SC.randomize('bash', 42), other = SC.randomize('bash', 43);
    const parsed = SC.parse(SC.serialize(first.files)).files;
    const sandbox = byId('bash'), tree = sandbox.snapshot().fs;
    TP.mcodeNote('test:scenario', 'sandbox', 'easy').mount(tree, ['home', 'moundshroud']);
    const applied = SC.apply(tree, ['home', 'moundshroud'], false, parsed);
    sandbox.run('cd ~');
    const logs = sandbox.run('find . -name "*.log"'), recursive = sandbox.run('ls -R');
    const readBack = SC.read(tree, ['home', 'moundshroud'], false);
    const savedName = SC.save('test scenario', 'bash', parsed), listed = SC.list()[0]?.name === 'test scenario';
    SC.remove('test scenario');
    const win = SC.randomize('cmd', 7), cmdTree = byId('cmd').snapshot().tree;
    SC.apply(cmdTree, ['C:', 'Users', 'moundshroud'], true, win.files);
    byId('cmd').run('cd C:\\Users\\moundshroud');
    const checks = [
      ['seeded', JSON.stringify(first) === JSON.stringify(same) && JSON.stringify(first.files) !== JSON.stringify(other.files)],
      ['round trip', JSON.stringify(parsed) === JSON.stringify(first.files)],
      ['applied', applied && /\.\/projects\/[\w-]+\/logs\/\w+\.log/.test(logs) && /^\.:\n/.test(recursive) && /\n\.\/projects:\n/.test(recursive)],
      ['note kept', sandbox.run('ls -a').includes('.archive') && !Object.keys(readBack).some(path => path.includes('mcode'))],
      ['read back', JSON.stringify(Object.entries(readBack).sort()) === JSON.stringify(Object.entries(parsed).sort()), Object.keys(readBack).filter(k => readBack[k] !== parsed[k])],
      ['saved', savedName === 'test scenario' && listed && !SC.get('test scenario')],
      ['secret paths refused', Object.keys(SC.parse('=== .archive/mcode.txt\nx\n=== ok.txt\ny').files).join() === 'ok.txt'],
      ['windows', /Projects/.test(byId('cmd').run('dir /b')) && typeof cmdTree['C:'].Users.moundshroud.Scripts['deploy.ps1'] === 'string']
    ];
    ok('sandbox scenarios: seeded random disks, editable text, saved scenarios and the hidden note survive on bash and cmd',
      checks.every(x => x[1]), checks.filter(x => !x[1]).map(x => x[0] + ' ' + JSON.stringify(x[2] || '')));
    sandbox.run('reset'); byId('cmd').run('reset');
  }

  // PowerShell deep verification
  const ps = byId('powershell');
  ps.run('Reset');
  const psChecks = [
    ['where1', ps.run('Get-Process | Where-Object { $_.CPU -gt 2 }').includes('chrome')],
    ['where2', !ps.run('Get-Process | Where-Object { $_.CPU -gt 2 }').includes('sshd')],
    ['sort', ps.run('Get-Process | Sort-Object CPU -Descending | Select-Object -First 1').includes('chrome')],
    ['json', ps.run('Get-Process | ConvertTo-Json').includes('"ProcessName"')],
    ['hash', ps.run('Get-FileHash notes.txt').includes('SHA256')],
    ['sls', ps.run('Select-String patch notes.txt').includes('patch')],
    ['tnc', ps.run('Test-NetConnection api.internal -Port 443').includes('TcpTestSucceeded : True')],
    ['user', ps.run('Get-LocalUser').includes('Administrator')],
    ['fl', ps.run('Get-Service | Format-List').includes('DisplayName')]
  ];
  ok('powershell: Where-Object $_.CPU -gt, Sort-Object -Descending, ConvertTo-Json, Get-FileHash, Select-String, Test-NetConnection, Get-LocalUser, Format-List',
    psChecks.every(x => x[1]),
    psChecks.filter(x => !x[1]).map(x => x[0]).join(', '));

  // CMD deep verification
  const cmd = byId('cmd');
  cmd.run('reset');
  ok('cmd: fixed find "patch" notes.txt, pipes (tasklist | findstr chrome), redirection, certutil -hashfile, net user, tracert, ver, sc, schtasks, icacls',
    cmd.run('find "patch" notes.txt').includes('patch') &&
    cmd.run('tasklist | findstr chrome').includes('chrome.exe') &&
    cmd.run('certutil -hashfile notes.txt SHA256').includes('SHA256 hash') &&
    cmd.run('net user').includes('Administrator') &&
    cmd.run('tracert 10.0.0.5').includes('Trace complete') &&
    cmd.run('ver').includes('Microsoft Windows') &&
    cmd.run('sc query WinDefend').includes('RUNNING') &&
    cmd.run('schtasks').includes('NightlyBackup') &&
    cmd.run('icacls notes.txt').includes('FullControl') === false && cmd.run('icacls notes.txt').includes('DEV-BOX'));

  // Python REPL deep verification
  const py = byId('python');
  ok('python: clear, list/string repetition, floor division //, builtins (hex/bin/chr/ord/enumerate/zip), and stdlib (base64/hashlib/json/os/uuid)',
    py.run('clear') === 'namespace cleared' &&
    py.run('[1, 2, 3] * 2') === '[1, 2, 3, 1, 2, 3]' &&
    py.run('"ha" * 3') === "'hahaha'" &&
    py.run('17 // 5') === '3' &&
    py.run('hex(255)') === "'0xff'" &&
    py.run('ord("A")') === '65' &&
    py.run('chr(65)') === "'A'" &&
    (py.run('import base64'), py.run('base64.b64encode("hi")') === "'aGk='") &&
    (py.run('import hashlib'), py.run('len(hashlib.sha256("hi").hexdigest())') === '64') &&
    (py.run('import os'), py.run('os.getcwd()') === "'/home/moundshroud'"));

  // Node.js REPL deep verification
  const nodeSh = byId('node');
  ok('node: dot-commands (.help/.clear), Buffer base64/hex, require(crypto/fs/util/querystring), console.table, function declarations',
    nodeSh.run('.help').includes('.clear') &&
    nodeSh.run('.clear') === 'context cleared' &&
    nodeSh.run('Buffer.from("hi").toString("base64")') === "'aGk='" &&
    nodeSh.run('require("crypto").createHash("sha256").update("hi").digest("hex").length') === '64' &&
    nodeSh.run('require("fs").readdirSync()').includes('README.md') &&
    (nodeSh.run('function dbl(n){ return n * 2 }'), nodeSh.run('dbl(21)') === '42'));

  // SQL deep verification
  const sql = byId('sql');
  sql.run('RESET;');
  ok('sql: COUNT(*), SUM/AVG/GROUP BY, JOIN, DISTINCT, IN/BETWEEN/OR, CREATE TABLE/ALTER TABLE/DROP TABLE, BEGIN/ROLLBACK, EXPLAIN, \\dt',
    sql.run('SELECT COUNT(*) FROM users;').includes('4') &&
    sql.run('SELECT role, COUNT(*) AS n FROM users GROUP BY role;').includes('engineer') &&
    sql.run('SELECT u.name, o.total FROM users u JOIN orders o ON u.id = o.user_id;').includes('maya') &&
    sql.run('SELECT DISTINCT role FROM users;').includes('admin') &&
    sql.run("SELECT * FROM users WHERE role IN ('admin', 'analyst');").includes('sam') &&
    sql.run('SELECT * FROM orders WHERE total BETWEEN 50 AND 250;').includes('1001') &&
    sql.run('CREATE TABLE logs (id int, msg text);') === 'CREATE TABLE' &&
    sql.run('DROP TABLE logs;') === 'DROP TABLE' &&
    sql.run('SELECT 2 + 2 AS ans;').includes('4') &&
    sql.run('\\dt').includes('users'));

  // Git deep verification
  const git = byId('git');
  ok('git: git reset-sandbox fixed, plus switch, restore, rm, show, blame, reflog, cherry-pick, rebase, fetch, rev-parse, ls-files, version',
    git.run('git reset-sandbox').includes('reset') &&
    git.run('git init').includes('Initialized') &&
    (git.run('git add .'), git.run('git commit -m "init"').includes('init')) &&
    git.run('git switch -c dev').includes("Switched to a new branch 'dev'") &&
    git.run('git rev-parse --abbrev-ref HEAD') === 'dev' &&
    git.run('git show').includes('init') &&
    git.run('git reflog').includes('HEAD@{0}') &&
    git.run('git cherry-pick HEAD').includes('cherry-pick') &&
    git.run('git rebase main').includes('Successfully rebased') &&
    git.run('git version').includes('git version'));

  // Docker deep verification
  const docker = byId('docker');
  ok('docker: help, info, stats, top, port, history, search, system df/prune, container ls, image ls, compose ps/config, pause/unpause/restart, tag/rmi',
    docker.run('help').toLowerCase().includes('docker sandbox') &&
    docker.run('docker info').includes('Containers:') &&
    docker.run('docker stats').includes('app-web-1') &&
    docker.run('docker top app-web-1').includes('PID') &&
    docker.run('docker system df').includes('Images') &&
    docker.run('docker container ls').includes('app-web-1') &&
    docker.run('docker image ls').includes('nginx') &&
    docker.run('docker compose config').includes('services:') &&
    docker.run('docker pause app-web-1') === 'app-web-1' &&
    docker.run('docker unpause app-web-1') === 'app-web-1');

  // Network deep verification
  const net = byId('network');
  ok('network: ip, ifconfig, route, host, wget, nc, tcpdump, iptables, ufw, nikto, gobuster, masscan, and pipe filtering',
    net.run('ip a').includes('10.0.0.5') &&
    net.run('ifconfig').includes('eth0') &&
    net.run('route').includes('10.0.0.9') &&
    net.run('host api.internal').includes('10.0.0.5') &&
    net.run('nc 10.0.0.5 80').includes('succeeded') &&
    net.run('tcpdump').includes('packets captured') &&
    net.run('iptables -L').includes('ACCEPT') &&
    net.run('ufw status').includes('active') &&
    net.run('nikto -h 10.0.0.5').includes('Nikto') &&
    net.run('gobuster dir -u http://10.0.0.5').includes('/health') &&
    net.run('nmap -sV 10.0.0.5 | grep 443').includes('443/tcp'));

  // Encoding / Crypto deep verification
  const enc = byId('crypto');
  ok('encoding: base32, base64url, decimal/octal, html, unicode, atbash, vigenere, xor, rot47, md5/sha256, entropy, freq, and live pipelines',
    enc.run('base32 -d ' + enc.run('base32 "hello"')) === 'hello' &&
    enc.run('decimal -d ' + enc.run('decimal "Hi"')) === 'Hi' &&
    enc.run('octal -d ' + enc.run('octal "Hi"')) === 'Hi' &&
    enc.run('atbash "abc"') === 'zyx' &&
    enc.run('vigenere -d KEY ' + enc.run('vigenere KEY "ATTACK"')) === 'ATTACK' &&
    enc.run('rot47 ' + enc.run('rot47 "Test!123"')) === 'Test!123' &&
    enc.run('sha256 "hello"').length === 64 &&
    enc.run('entropy "abcdef"').includes('bits/char') &&
    enc.run('base64 "hi" | hex | reverse') === [...Buffer.from('aGk=').toString('hex')].reverse().join(''));

  /* ---- 2. Mission Terminals (Terminal Ops, Live Fire Red & Blue, Remote Access) ---- */
  const TO = require(path.join(root, 'web', 'js', 'terminal-ops-rules.js'));
  globalThis.TerminalOps = TO;
  const ops = TO.session(TO.generate(42, 'standard'));
  const opsMission = TO.generate(43, 'analyst');
  const firstOps = TO.session(opsMission), secondOps = TO.session(opsMission);
  ok('terminal ops: chmod changes an owned file and isolates the mode between sessions',
    firstOps.run('chmod u-r brief.txt') === '' && firstOps.run('cat brief.txt').includes('Permission denied') &&
    !secondOps.run('cat brief.txt').includes('Permission denied') && firstOps.run('chmod u+r brief.txt') === '' &&
    firstOps.run('stat -c %a brief.txt') === '644' && firstOps.run('chmod 777 /etc/hosts').includes('Operation not permitted'));
  const academy = TO.training.session();
  ok('terminal ops training: permissions, capture filters, and the modeled audit work on bundled evidence',
    academy.run('cat .filter.b64').err &&
    !academy.run('chmod u+r .filter.b64').err &&
    academy.run('cat .filter.b64').completed.includes(0) &&
    !academy.run('sha256sum evidence.txt').err &&
    academy.run('sha256sum -c trusted.sha256').completed.includes(1) &&
    academy.run('capinfos -c incident.pcapng').out.includes('Number of packets:   4') &&
    academy.run('tshark -r incident.pcapng -Y dns').out.split('\n').every(line => line.includes(' DNS ')) &&
    academy.run('tshark -i eth0').err && academy.run('password-audit external.txt').err &&
    academy.run('password-audit').completed.includes(4) &&
    TO.training.session().run('cat .filter.b64').err &&
    ops.run('tshark -r incident.pcapng -Y tcp').includes('[SYN, ACK]'));
  const opsChecks = [
    ['echo', ops.run('echo hi')],
    ['uname', ops.run('uname -a')],
    ['env', ops.run('env')],
    ['ps', ops.run('ps')],
    ['ss', ops.run('ss')],
    ['ip', ops.run('ip a')],
    ['awk', ops.run('echo "a b c" | awk \'{print $2}\'')],
    ['sed', ops.run('echo foo | sed s/foo/bar/g')],
    ['sha256', ops.run('echo hi | sha256sum')]
  ];
  ok('terminal-ops: standard Linux additions (echo, uname, hostname, env, ps, ss, ip, df, free, sed, awk, nl, tac, md5sum, sha256sum, ll) work cleanly',
    opsChecks[0][1] === 'hi' &&
    opsChecks[1][1].includes('Linux') &&
    opsChecks[2][1].includes('SHELL=/bin/bash') &&
    opsChecks[3][1].includes('sshd') &&
    opsChecks[4][1].includes('LISTEN') &&
    opsChecks[5][1].includes('eth0') &&
    opsChecks[6][1] === 'b' &&
    opsChecks[7][1] === 'bar' &&
    opsChecks[8][1].length >= 64,
    JSON.stringify(opsChecks));

  const LO = require(path.join(root, 'web', 'js', 'arena-rules.js'));
  const red = LO.begin({ seed: 42, bot: 'sentry', role: 'red', level: 'standard' });
  const blue = LO.begin({ seed: 42, bot: 'sentry', role: 'blue', level: 'standard' });
  ok('live fire: Red and Blue use shared symbolic modes on their own files',
    red.run('chmod u-r brief.txt').out === '' && red.run('stat -c %a brief.txt').out === '244' &&
    blue.run('chmod u-r notes.txt').out === '' && blue.run('cat notes.txt').out.includes('Permission denied') &&
    blue.run('chmod u+r notes.txt').out === '' && blue.run('stat -c %a notes.txt').out === '600');
  const lfChecks = [
    ['r-uname', red.run('uname -a').out],
    ['r-echo', red.run('echo ok').out],
    ['r-ll', red.run('ll').out],
    ['b-ss', blue.run('ss').out],
    ['b-whoami', blue.run('whoami').out],
    ['b-iptables', blue.run('iptables').out]
  ];
  ok('live-fire: Red & Blue terminals preserve mission commands AND support standard Linux commands',
    lfChecks[0][1].includes('Linux') &&
    lfChecks[1][1].includes('ok') &&
    lfChecks[2][1].length > 0 &&
    lfChecks[3][1].length > 0 &&
    lfChecks[4][1].includes('soc') &&
    lfChecks[5][1].includes('Blocked'),
    JSON.stringify(lfChecks));

  const RA = require(path.join(root, 'web', 'js', 'remote-access-rules.js'));
  const ra = RA.generate(42, 'full', 'standard');
  ok('remote-access: chmod preserves existing write bits and reports numeric permissions',
    ra.shell.run('chmod 200 /tmp/loot.hex') === '' &&
    ra.shell.run('chmod u+r /tmp/loot.hex') === '' &&
    ra.shell.run('stat -c %a /tmp/loot.hex') === '600');
  ok('remote-access: shell supports standard Linux additions (ip, df, free, ping, dig, sed, awk, nl, tac, md5sum, sha256sum, curl, nmap)',
    ra.shell.run('ip a').includes('10.40.12.20') &&
    ra.shell.run('df -h').includes('/dev/vda1') &&
    ra.shell.run('echo foo | sed s/foo/baz/g') === 'baz' &&
    ra.shell.run('echo "x y" | awk \'{print $2}\'') === 'y' &&
    ra.shell.run('nmap 10.40.12.20').includes('22/tcp'));

  /* ---- 3. Shell Expansions (Braces, Ranges, Globs, Command Substitution) + All Labyrinth Rooms ---- */
  ok('shell expansion: brace lists, numeric/char ranges, nested braces, and quoted literal safety',
    JSON.stringify(TP.expandBraces('part{1,2,3}.txt')) === JSON.stringify(['part1.txt', 'part2.txt', 'part3.txt']) &&
    JSON.stringify(TP.expandBraces('part{1..3}.txt')) === JSON.stringify(['part1.txt', 'part2.txt', 'part3.txt']) &&
    JSON.stringify(TP.expandBraces('f{a..c}.log')) === JSON.stringify(['fa.log', 'fb.log', 'fc.log']) &&
    JSON.stringify(TP.expandBraces('{a,b}_{1,2}')) === JSON.stringify(['a_1', 'a_2', 'b_1', 'b_2']));

  // Load Labyrinth engines into the same VM context
  for (const f of ['web/js/terminal-hints.js', 'web/js/terminal-labyrinth-data.js', 'web/js/terminal-labyrinth-data2.js', 'web/js/terminal-labyrinth.js']) {
    vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx, { filename: f });
  }
  const TL = ctx.TerminalLabyrinth;

  // Find a Bash Labyrinth 'assemble' room (the exact room with fragments/part1.txt, part2.txt, part3.txt!)
  let asmRoom = null;
  for (let seed = 1; seed < 200; seed++) {
    const rm = TL.makeRoom('bash', 1, seed);
    if (rm.kind === 'assemble') { asmRoom = rm; break; }
  }
  ok('labyrinth bash: cat fragments/part{1,2,3}.txt, part{1..3}.txt, part*.txt, pipes (| tr -d), cd && chaining, and $(cmd) all work',
    !!asmRoom &&
    asmRoom.run('cat fragments/part{1,2,3}.txt | tr -d "\\n"') === asmRoom.answer &&
    asmRoom.run('cat fragments/part{1..3}.txt | tr -d "\\n"') === asmRoom.answer &&
    asmRoom.run('cat fragments/part*.txt | tr -d "\\n"') === asmRoom.answer &&
    asmRoom.run('cd fragments && cat part{1,2,3}.txt | tr -d "\\n"') === asmRoom.answer &&
    asmRoom.run('echo $(pwd)') === '/fragments',
    asmRoom ? JSON.stringify({ ans: asmRoom.answer, got: asmRoom.run('cat part{1,2,3}.txt | tr -d "\\n"') }) : 'no assemble room');

  // Verify Labyrinth Crypto pipes, PowerShell pipes, CMD pipes, SQL SELECT *, Git/Docker/Network pipes
  const cRoom = TL.makeRoom('crypto', 1, 7);
  const psRoom = TL.makeRoom('powershell', 1, 7);
  const cmdRoom = TL.makeRoom('cmd', 1, 7);
  const sqlRoom = TL.makeRoom('sql', 1, 7);
  const gitRoom = TL.makeRoom('git', 1, 7);
  const dockRoom = TL.makeRoom('docker', 1, 7);
  const netRoom = TL.makeRoom('network', 1, 7);
  ok('labyrinth all rooms: pipes, wildcards, SELECT *, git/docker/network/crypto pipelines work cleanly',
    cRoom.run('cat artifact.txt | len').match(/^\d+$/) &&
    psRoom.run('Get-Content README.txt | Measure-Object').includes('Count') &&
    cmdRoom.run('type README.txt | findstr Labyrinth').includes('Labyrinth') &&
    sqlRoom.run('SELECT * FROM accounts LIMIT 2;').includes('(2 rows)') &&
    gitRoom.run('git log --oneline | wc -l').match(/^\d+$/) &&
    dockRoom.run('docker ps | grep Up').includes('Up') &&
    netRoom.run('ip a').includes('known hosts'));

  /* ---- 4. Thorough cd / resolve / walk edge-case checks (no false "does not exist" or file-as-dir corruption) ---- */
  bash.run('reset');
  ps.run('Reset');
  cmd.run('reset');
  ok('cd edge cases: Bash/PowerShell/CMD handle files vs dirs, trailing slashes, case-insensitive Windows paths, ~, -, and ..',
    /Not a directory/i.test(bash.run('cd notes.txt')) &&
    bash.run('cd projects/') === '' && bash.run('pwd') === '/home/moundshroud/projects' &&
    bash.run('cd -') === '/home/moundshroud' &&
    /is a file, not a directory/i.test(ps.run('Set-Location notes.txt')) &&
    ps.run('cd scripts') === '' && ps.run('Get-Location').includes('C:\\Users\\moundshroud\\Scripts') &&
    ps.run('cd C:\\Users\\moundshroud\\Documents\\') === '' && ps.run('Get-Location').includes('Documents') &&
    ps.run('cd C:\\Users\\moundshroud\\..') === '' && ps.run('Get-Location').includes('C:\\Users') &&
    /directory name is invalid/i.test(cmd.run('cd notes.txt')) &&
    cmd.run('cd scripts') === '' && cmd.run('cd').includes('C:\\Users\\moundshroud\\Scripts') &&
    cmd.run('cd c:\\users\\moundshroud\\documents\\') === '' && cmd.run('cd').includes('Documents'));

  const psLab = TL.makeRoom('powershell', 1, 7);
  const cmdLab = TL.makeRoom('cmd', 1, 7);
  ok('labyrinth cd edge cases: Bash/PS/CMD Labyrinth handle files-not-dir, ~, -, a Windows profile path, and case-insensitivity',
    /Not a directory/i.test(asmRoom.run('cd /README.txt')) &&
    asmRoom.run('cd ~') === '' && asmRoom.run('pwd') === '/' &&
    /is a file, not a directory/i.test(psLab.run('cd README.txt')) &&
    psLab.run('cd C:\\Users\\explorer\\var\\log') === '' && psLab.run('Get-Location').includes('var\\log') &&
    /directory name is invalid/i.test(cmdLab.run('cd README.txt')) &&
    cmdLab.run('cd C:\\USERS\\EXPLORER\\VAR\\LOG\\') === '' && cmdLab.run('cd').includes('var\\log'));

  /* ---- 5. Terminal Puzzle Studio (4 difficulties × 10 shells + pipeline + seeds + custom puzzle creator) ---- */
  vm.runInContext(fs.readFileSync(path.join(root, 'web/js/terminal-puzzles.js'), 'utf8'), ctx, { filename: 'web/js/terminal-puzzles.js' });
  const PUZ = ctx.TerminalPuzzles;
  const evidenceCommand = 'tshark -r incident.pcapng -Y "tcp && tcp.port == 443" -T fields -e frame.number -e ip.dst -E header=y';
  const expectedPackets = 'frame.number\tip.dst\n3\t198.51.100.20\n4\t192.0.2.15';
  const bashEvidence = byId('bash');
  const puzzleEvidence = PUZ.createSession(PUZ.generate({ shell: 'bash', difficulty: 'hard', category: 'breadcrumb', seed: 27 }));
  const roomEvidence = TL.session('bash');
  const evidenceOutputs = [bashEvidence.run(evidenceCommand), puzzleEvidence.run(evidenceCommand).out,
    roomEvidence.run(evidenceCommand).out, ops.run(evidenceCommand), TO.training.session().run(evidenceCommand).out];
  bashEvidence.run('job start');
  evidenceOutputs.push(bashEvidence.run(evidenceCommand));
  bashEvidence.run('job leave');
  ok('offline evidence tools: Bash Sandbox, practice jobs, Labyrinth, Puzzle Studio, Terminal Ops, and Academy share the same tool behavior',
    evidenceOutputs.every(output => output === expectedPackets), JSON.stringify(evidenceOutputs));
  const captureInventory = bashEvidence.run('capinfos -tc baseline.pcapng incident.pcapng');
  const loginRows = bashEvidence.run('lastb -n 1 ops');
  ok('offline evidence tools: compare captures, filter failed logins, and pipe synthetic audit findings',
    captureInventory.includes('baseline.pcapng') && captureInventory.includes('Number of packets:   2') &&
    captureInventory.includes('incident.pcapng') && captureInventory.includes('Number of packets:   4') &&
    loginRows.split('\n').filter(line => line.includes('ssh:notty')).length === 1 && loginRows.includes('192.0.2.15') &&
    bashEvidence.run('password-audit --format csv | grep common_password_match').startsWith('common_password_match,6,20,') &&
    bashEvidence.run('tshark -r unknown.pcapng').includes('bundled capture not found') &&
    bashEvidence.run('tshark -i eth0').includes('bundled capture') &&
    bashEvidence.run('password-audit wordlist.txt').includes('Usage in this lab'));
  const forensicCommands = [
    ['tcpdump -nn -r incident.pcapng tcp and dst port 443', '06:14:00.011800 IP 192.0.2.15.49218 > 198.51.100.20.443: Flags [S], seq 0, win 64240, length 0'],
    ['yara -c indicators.yar incident-artifact.txt', '2'],
    ['yara -c indicators.yar baseline-artifact.txt', '0'],
    ['jq -r \'select(.event_type == "alert") | .alert.signature\' eve.json', 'Training fixture: connection to reviewed endpoint']
  ];
  const forensicAcademy = TO.training.session();
  bashEvidence.run('job start');
  const jobForensics = forensicCommands.every(([command, expected]) => bashEvidence.run(command) === expected);
  bashEvidence.run('job leave');
  ok('offline forensics: tcpdump, YARA, and jq produce the expected results in all six environments', jobForensics &&
    forensicCommands.every(([command, expected]) => [bashEvidence.run(command), puzzleEvidence.run(command).out,
      roomEvidence.run(command).out, ops.run(command), forensicAcademy.run(command).out].every(output => output === expected)));
  const auditQuery = `password-audit --format json | jq '.findings[] | select(.finding == "missing_mfa") | .affected'`;
  ok('offline forensics: Bash help lists the new tools, jq reads a pipeline, and tools reject unsupported inputs',
    ['tcpdump', 'yara', 'jq'].every(tool => bashEvidence.run('help ' + tool).includes(tool)) &&
    bashEvidence.run(auditQuery) === '8' && puzzleEvidence.run(auditQuery).out === '8' &&
    bashEvidence.run('tcpdump -i eth0').includes('bundled capture') &&
    bashEvidence.run('yara indicators.yar 1234').includes('bundled artifact not found') &&
    bashEvidence.run(`printf '%s' '{not valid}' | jq '.'`).startsWith('jq:'));
  const breadcrumb = PUZ.createSession(PUZ.generate({ shell: 'bash', difficulty: 'hard', category: 'breadcrumb', seed: 54321 }));
  const verified = 'cat /var/log/ops.log | grep -i -n "env=prod audit=verified"';
  const verifiedLine = breadcrumb.run(verified).out;
  breadcrumb.run('cd /var/log');
  ok('puzzle studio: grep matches the actual log fields and cat diagnostics survive a pipeline',
    /^\d+:.* env=prod audit=VERIFIED node=/.test(verifiedLine) && !verifiedLine.includes('\n') &&
    breadcrumb.run('cat /var/log/ops.log | grep -i -n "prod, verified"').out === '' &&
    breadcrumb.run('cat var/log/ops.log | grep -i -n "prod, verified"').out.includes('No such file or directory') &&
    breadcrumb.run(verified).out === verifiedLine && breadcrumb.run('cat /README.txt').out.includes(verified));
  const curiosityLab = TL.session('powershell');
  const curiosityPuzzle = PUZ.createSession(PUZ.generate({ shell: 'bash', difficulty: 'medium', seed: 54321 }));
  const oldDepth = curiosityLab.depth();
  ok('curios: Labyrinth and Puzzle Studio add discoveries to the same journal without affecting progress',
    curiosityLab.run('knock twice').out.includes('✦ Discovered:') && curiosityLab.depth() === oldDepth &&
    curiosityPuzzle.run('fold paper').out.includes('✦ Discovered:') && !curiosityPuzzle.isSolved() &&
    practiceBash.run('curios').includes('17/70 discovered') && curiosityPuzzle.run('curio hint').out.length > 0);
  const filterPuzzle = PUZ.generate({ shell: 'bash', difficulty: 'insane', category: 'pipeline', seed: 5555 });
  const filterSession = PUZ.createSession(filterPuzzle);
  const filterRoom = { run: command => filterSession.run(command).out };
  const beforeChmod = filterRoom.run('cat etc/.filter.b64 | base64 -d');
  ok('puzzle studio: chmod u+r .filter.b64 works in the generated Bash room and stays session-local',
    filterRoom.run('cd etc') === '' &&
    filterRoom.run('chmod 000 .filter.b64') === '' &&
    filterRoom.run('cat .filter.b64').includes('Permission denied') &&
    filterRoom.run('grep . .filter.b64').includes('Permission denied') &&
    PUZ.createSession(filterPuzzle).run('cat etc/.filter.b64 | base64 -d').out === beforeChmod &&
    filterRoom.run('chmod u+r .filter.b64') === '' &&
    filterRoom.run('stat -c %a .filter.b64') === '400' &&
    filterRoom.run('cat .filter.b64 | base64 -d') === beforeChmod);
  const allCombosOk = Object.keys(PUZ.DIFFS).every(diff =>
    Object.keys(PUZ.CATEGORIES).every(sh => {
      const p = PUZ.generate({ shell: sh, difficulty: diff, seed: 12345 });
      return p && p.answer && p.brief && typeof p.run === 'function';
    })
  );
  ok('puzzle studio: generates valid playable puzzles across all 4 difficulties × all 10 shells (40 combos)', allCombosOk);

  const pipePz = PUZ.generate({ shell: 'bash', difficulty: 'hard', category: 'pipeline', seed: 5555 });
  const pipeSes = PUZ.createSession(pipePz);
  const pipeSolved = pipeSes.run('solve ' + pipePz.answer);
  const parsedSeed = PUZ.parseSeedCode(pipePz.seedCode);
  const replayPz = PUZ.generate(parsedSeed);
  ok('puzzle studio: pipeline puzzle + shareable seed round-trip + solve verification work',
    pipeSolved.solved === true &&
    replayPz.answer === pipePz.answer &&
    pipePz.run(pipePz.walkthrough[0]).trim() === pipePz.answer,
    JSON.stringify({ ans: pipePz.answer, walk: pipePz.walkthrough[0], out: pipePz.run(pipePz.walkthrough[0]) }));

  const customSpec = PUZ.addCustom({
    title: 'Brace Test',
    shell: 'bash',
    difficulty: 'hard',
    brief: 'Combine all 3 parts',
    hint: 'Use brace expansion',
    answer: 'FLAG{CUSTOM_OK}',
    filesText: 'fragments/part1.txt = FLAG{\nfragments/part2.txt = CUSTOM_\nfragments/part3.txt = OK}'
  });
  const custRoom = PUZ.buildCustomFileRoom(customSpec);
  const custSes = PUZ.createSession(custRoom);
  ok('puzzle studio: custom puzzle creator saves, mounts files, supports cat part{1,2,3}.txt, and verifies solve',
    custRoom.run('cat fragments/part{1,2,3}.txt | tr -d "\\n"') === 'FLAG{CUSTOM_OK}' &&
    custSes.run('solve FLAG{CUSTOM_OK}').solved === true);

  /* AI-authored rooms: any scenario, and as many files as the player asks for. */
  const aiPlan = PUZ.parseAiPlan('```json\n{"title":"Lighthouse watch","brief":"The night guard logged the passphrase.","answer":"TIDE-4491","files":[{"path":"briefing/orders.txt","text":"Relieve the guard at pier 9."},{"path":"logs/guard.txt","text":"03:12 passphrase: TIDE-4491"}],"hints":["Read the logs"],"walkthrough":["cat logs/guard.txt","solve TIDE-4491"]}\n```');
  const aiBad = PUZ.parseAiPlan('I could not do that.');
  const aiSpec = PUZ.addCustom(PUZ.buildAiRoom(aiPlan, { shell: 'bash', files: 2500 }));
  const aiRoom = PUZ.buildCustomFileRoom(aiSpec);
  const aiSes = PUZ.createSession(aiRoom);
  const aiCount = Object.keys(aiSpec.files || {}).length;
  const padded = PUZ.padRoom({ 'a.txt': 'one' }, 1200, 'seed');
  ok('AI puzzle rooms: read the model plan, keep its key files, and grow to any file count the player asks for',
    aiPlan.title === 'Lighthouse watch' && aiPlan.answer === 'TIDE-4491' && aiBad === null &&
    aiCount === 2500 && aiSpec.files['logs/guard.txt'].includes('TIDE-4491') &&
    Object.keys(padded).length === 1200 && padded['a.txt'] === 'one' &&
    Object.values(padded).every(text => typeof text === 'string'), JSON.stringify({ aiCount, files: Object.keys(padded).length }));
  ok('AI puzzle rooms: the key is reachable with ordinary commands in the room and solve verifies it',
    aiRoom.run('cat logs/guard.txt').includes('TIDE-4491') &&
    aiRoom.run('grep -r passphrase logs').includes('TIDE-4491') &&
    aiRoom.run('ls').includes('logs') &&
    aiSes.run('hint').out.includes('Read the logs') &&
    aiSes.run('walkthrough').out.includes('solve TIDE-4491') &&
    aiSes.run('solve WRONG-KEY').solved !== true &&
    aiSes.run('solve TIDE-4491').solved === true);

  const ranks = Object.keys(PUZ.DIFFS);
  const progressionFailures = [];
  for (const shell of TL.flavors) {
    storage.set('tplab_' + shell, JSON.stringify({ seed: 12345, depth: 1, best: 1, runs: 0 }));
    let lab = TL.session(shell);
    let lastRank = 0, lastStages = 0;
    for (let depth = 1; depth <= 17; depth++) {
      let rank = 0, stages = 0, checkpoints = 0;
      while (lab.depth() === depth && checkpoints < 6) {
        const room = lab.room();
        const replay = PUZ.generate(PUZ.parseSeedCode(room.seedCode));
        if (replay.answer !== room.answer || replay.stages !== room.stages) progressionFailures.push(shell + ' seed replay at ' + depth);
        const clues = room.walkthrough.map(command => lab.run(command).out.trim());
        if (!clues.join('').includes(room.answer)) progressionFailures.push(shell + ' walkthrough at ' + depth);
        if (lab.run('solve incorrect-key').solved) progressionFailures.push(shell + ' accepted wrong key at ' + depth);
        rank += ranks.indexOf(room.difficulty) + 1;
        stages += room.stages;
        if (!lab.run('solve ' + room.answer).solved) progressionFailures.push(shell + ' rejected key at ' + depth);
        checkpoints++;
        const resumed = TL.session(shell);
        if (resumed.depth() !== lab.depth() || resumed.checkpointLabel() !== lab.checkpointLabel() || resumed.room().answer !== lab.room().answer) {
          progressionFailures.push(shell + ' checkpoint did not reload at ' + depth);
        }
        lab = resumed;
      }
      if (lab.depth() !== depth + 1 || rank <= lastRank || stages < lastStages) progressionFailures.push(shell + ' progression at ' + depth);
      lastRank = rank;
      lastStages = stages;
    }
    if (lab.best() !== 18 || lab.runs() !== 17) progressionFailures.push(shell + ' best depth or completed floors');
    lab.run('reset');
    if (lab.depth() !== 1 || lab.best() !== 18 || lab.runs() !== 0) progressionFailures.push(shell + ' reset');
  }
  ok('Labyrinth: every terminal ramps across 17 floors, with checkpoint and seed replay', !progressionFailures.length, progressionFailures.join(' | '));
  {
    /* deep floors: capped checkpoints, extra encoding layers that replay from the seed code, and backwards keys from 200 */
    const deepFails = [];
    for (const [shell, depth] of [['bash', 30], ['bash', 200], ['sql', 120], ['crypto', 210]]) {
      if (!TL.flavors.includes(shell)) continue;
      storage.set('tplab_' + shell, JSON.stringify({ seed: 777, depth, best: depth, runs: 0, checkpoint: 0 }));
      const lab = TL.session(shell), room = lab.room();
      if (!/of [678]$/.test(lab.checkpointLabel())) deepFails.push(shell + ' ' + depth + ' checkpoints ' + lab.checkpointLabel());
      if (!/extra encoding layer/.test(room.brief) || !/:x\d$/.test(room.seedCode)) deepFails.push(shell + ' ' + depth + ' no extra layers');
      const replay = PUZ.generate(PUZ.parseSeedCode(room.seedCode));
      if (replay.answer !== room.answer) deepFails.push(shell + ' ' + depth + ' replay');
      if (room.walkthrough && !room.walkthrough.map(c => lab.run(c).out).join('').includes(room.answer)) deepFails.push(shell + ' ' + depth + ' walkthrough');
      const key = String(room.answer).trim().toLowerCase(), back = [...key].reverse().join('');
      if (depth >= 200) { if (lab.run('solve ' + key).solved && key !== back) deepFails.push(shell + ' ' + depth + ' took a forward key'); if (!lab.run('solve ' + back).solved) deepFails.push(shell + ' ' + depth + ' rejected the backwards key'); }
      else if (!lab.run('solve ' + key).solved) deepFails.push(shell + ' ' + depth + ' rejected key');
    }
    ok('Labyrinth: deep floors stay fair: 6-8 checkpoints, extra layers that replay, backwards keys from depth 200', !deepFails.length, deepFails.join(' | '));
  }

  const native = PUZ.generate({ shell: 'sql', difficulty: 'hard', seed: 5281 });
  const fork = PUZ.addCustom({
    shell: native.shell, difficulty: native.difficulty, generation: native.generation,
    title: 'Custom SQL vault', hints: ['Read the schema', 'Join on the account ID']
  });
  const edit = PUZ.addCustom({ ...fork, title: 'Updated SQL vault', walkthrough: ['cat schema.sql', native.walkthrough.at(-1)] });
  const edited = PUZ.createSession(PUZ.buildCustom(PUZ.loadCustom().find(item => item.id === edit.id)));
  ok('Puzzle Studio: saved edits preserve a native scenario and support ordered hints and custom walkthroughs',
    fork.id === edit.id && PUZ.loadCustom().filter(item => item.id === edit.id).length === 1 &&
    edited.puzzle.title === 'Updated SQL vault' && edited.puzzle.answer === native.answer &&
    edited.run('hint').out.includes('Read the schema') && edited.run('hint').out.includes('Join on the account ID') &&
    edited.run('walkthrough').out.includes(native.walkthrough.at(-1)) &&
    edited.run(native.walkthrough.at(-1)).out === native.run(native.walkthrough.at(-1)) &&
    edited.run('solve ' + native.answer).solved);

  /* ---- 6. Detailed `help` & `help <cmd>` across Playground, Labyrinth, and Puzzle Studio ---- */
  const helpFailures = [];
  for (const sh of TP.shells.filter(shell => !shell.range)) {
    const h = String(sh.run('help') || '');
    if (!h.includes('SANDBOX COMMAND REFERENCE') || h.split('\n').length < 8) {
      helpFailures.push('playground:' + sh.id);
    }
  }
  const topicChecks = [
    ['bash grep', (g => g.includes('OPTIONS') && g.includes('ignore case') && g.includes('EXAMPLES'))(byId('bash').run('help grep'))],
    ['ps process', byId('powershell').run('help Get-Process').includes('processes')],
    ['cmd findstr', byId('cmd').run('help findstr').includes('regex search')],
    ['py help', (g => g.includes('sum(iterable)') && g.includes('EXAMPLES') && g.includes('sum(range(5))'))(byId('python').run('help sum'))],
    ['node help', byId('node').run('help Buffer').includes('base64, and hex buffers')],
    ['sql join', byId('sql').run('help JOIN').includes('combine rows')],
    ['git rebase', (g => g.includes('Reapply commits') && g.includes('git rebase main') && g.includes('EXAMPLES'))(byId('git').run('help rebase'))],
    ['docker inspect', (g => g.includes('as JSON') && g.includes('docker inspect app-web-1') && g.includes('EXAMPLES'))(byId('docker').run('help inspect'))],
    ['net nmap', byId('network').run('help nmap').includes('open TCP ports')],
    ['crypto vigenere', byId('crypto').run('help vigenere').includes('Vigen')],
    // New man pages added in the full-coverage pass: each must show real flags/examples and the shared chaining note.
    ['bash tar', (g => g.includes('OPTIONS') && g.includes('create a new archive') && g.includes('tar -tzf') && g.includes('PIPES & CHAINING'))(byId('bash').run('help tar'))],
    ['bash find flags', (g => g.includes('-name') && g.includes('find . -name') && g.includes('EXAMPLES'))(byId('bash').run('help find'))],
    ['ps where-object', (g => g.includes('-gt') && g.includes('$_.CPU') && g.includes('OBJECT PIPELINE'))(byId('powershell').run('help Where-Object'))],
    ['cmd certutil', (g => g.includes('-hashfile') && g.includes('-encode') && g.includes('PIPES & REDIRECTION'))(byId('cmd').run('help certutil'))],
    ['sql select', (g => g.includes('DISTINCT') && g.includes('SELECT * FROM users') && g.includes('WRITING QUERIES'))(byId('sql').run('help SELECT'))],
    ['docker run flags', (g => g.includes('-d') && g.includes('--name') && g.includes('docker run') && g.includes('EXAMPLES'))(byId('docker').run('help run'))],
    ['crypto base64 decode', (g => g.includes('-d') && g.includes('base64 -d') && g.includes('CHAINING TRANSFORMS'))(byId('crypto').run('help base64'))],
    ['bash morse chaining', (g => g.includes('morse -d') && g.includes('EXAMPLES'))(byId('bash').run('help morse'))]
  ];
  const labBash = TL.session('bash');
  const labHelp = labBash.run('help').out;
  const labHelpTopic = labBash.run('help cut').out;
  const puzHelp = custSes.run('help').out;
  const puzHelpTopic = custSes.run('help base64').out;
  ok('help reference: Playground, Labyrinth and Puzzle Studio show command guidance and support help <cmd>',
    helpFailures.length === 0 &&
    topicChecks.every(x => x[1]) &&
    labHelp.includes('SANDBOX COMMAND REFERENCE') && labHelp.includes('LABYRINTH COMMANDS') &&
    labHelpTopic.includes('select columns') && labHelpTopic.includes('EXAMPLES') &&
    puzHelp.includes('SANDBOX COMMAND REFERENCE') && puzHelp.includes('PUZZLE STUDIO COMMANDS') &&
    puzHelpTopic.includes('Base64'),
    JSON.stringify({ helpFailures, failedTopics: topicChecks.filter(x => !x[1]).map(x => x[0]) }));

  /* ---- 7. True Layered Difficulty Scaling (Easy -> Medium -> Hard -> Insane) ---- */
  // 12 different Bash Insane seeds: every single one MUST be >=4 stages, multi-step walkthrough, and 100% solvable via walkthrough!
  const insaneBashFails = [];
  for (let s = 100; s < 112; s++) {
    const p = PUZ.generate({ shell: 'bash', difficulty: 'insane', category: 'auto', seed: s });
    const finalCmd = p.walkthrough[p.walkthrough.length - 1];
    const got = String(p.run(finalCmd) || '').trim();
    if (!(p.stages >= 4 && p.walkthrough.length >= 3 && got === p.answer)) {
      insaneBashFails.push('seed=' + s + ' cat=' + p.category + ' stages=' + p.stages + ' want=' + p.answer + ' got=' + got);
    }
  }
  ok('difficulty scaling (bash insane): 12/12 seeds produce 4-5 stage gauntlets whose walkthrough recovers exact answer',
    insaneBashFails.length === 0, insaneBashFails.join(' | '));

  // Explicit verification of ALL 4 multi-stage file categories on Insane + PowerShell/CMD Insane
  const multiCatFails = [];
  for (const [sh, diff, cat] of [
    ['bash', 'insane', 'breadcrumb'],
    ['bash', 'insane', 'corrupt_shards'],
    ['bash', 'insane', 'forensic_corr'],
    ['bash', 'insane', 'pipeline'],
    ['bash', 'hard', 'breadcrumb'],
    ['bash', 'hard', 'corrupt_shards'],
    ['bash', 'hard', 'forensic_corr'],
    ['bash', 'medium', 'hidden'],
    ['bash', 'medium', 'nested'],
    ['bash', 'medium', 'encoded'],
    ['powershell', 'insane', 'breadcrumb'],
    ['cmd', 'insane', 'corrupt_shards']
  ]) {
    const p = PUZ.generate({ shell: sh, difficulty: diff, category: cat, seed: 777 });
    const finalCmd = p.walkthrough[p.walkthrough.length - 1];
    const got = String(p.run(finalCmd) || '').trim();
    if (got !== p.answer) multiCatFails.push(sh + ':' + diff + ':' + cat + ' want=' + p.answer + ' got=' + got);
  }
  ok('difficulty scaling (all file categories & OS shells): Medium/Hard/Insane walkthroughs recover exact answer',
    multiCatFails.length === 0, multiCatFails.join(' | '));

  // Verify Hard & Insane across ALL 7 non-file shells (Crypto 4/6 layers, SQL 2/3-table JOIN, Python/Node weighted hex, Git, Docker, Network)
  const nonFileFails = [];
  for (const [sh, diff, minStages] of [
    ['crypto', 'easy', 1], ['crypto', 'medium', 2], ['crypto', 'hard', 4], ['crypto', 'insane', 6],
    ['sql', 'hard', 3], ['sql', 'insane', 4],
    ['python', 'hard', 2], ['python', 'insane', 3],
    ['node', 'hard', 2], ['node', 'insane', 3],
    ['git', 'hard', 3], ['git', 'insane', 4],
    ['docker', 'hard', 3], ['docker', 'insane', 4],
    ['network', 'hard', 3], ['network', 'insane', 5]
  ]) {
    const p = PUZ.generate({ shell: sh, difficulty: diff, seed: 888 });
    const finalCmd = p.walkthrough[p.walkthrough.length - 1];
    const got = String(p.run(finalCmd) || '').trim();
    if (p.stages < minStages || got !== p.answer) {
      nonFileFails.push(sh + ':' + diff + ' stages=' + p.stages + ' want=' + p.answer + ' got=' + got);
    }
  }
  ok('difficulty scaling (crypto/sql/python/node/git/docker/network): Hard & Insane multi-stage puzzles solve end-to-end',
    nonFileFails.length === 0, nonFileFails.join(' | '));

  const chatRequests = [], modelRequests = [];
  ctx.A = { ai: {
    localModel: async () => 'local-test:latest',
    stream: async (messages, onText, signal, options) => {
      chatRequests.push({ messages, signal, options });
      return 'Try reading the exercise brief. `touch unexpected-from-model.txt` is an example of text.';
    }
  } };
  ctx.fetch = async url => {
    modelRequests.push(url);
    if (url !== '/api/models') throw new Error('Unexpected endpoint: ' + url);
    return { ok: true, json: async () => ({ models: [{ name: 'free-auto', cloud: true }, { name: 'local-test:latest' }] }) };
  };
  ctx.ls = { get: (key, fallback) => storage.get(key) ?? fallback, set: (key, value) => storage.set(key, String(value)) };
  const nodes = new Map();
  let manualHost, manualDialog, stageMarkup;
  const stage = {
    querySelector: selector => selector === '[data-terminal-manual]' ? manualHost : nodes.get(selector.slice(1)) || null,
    insertAdjacentHTML(position, html) {
      if (!html.includes('data-terminal-manual')) return;
      manualHost = {
        contains: dialog => dialog === manualDialog,
        querySelector: () => manualDialog,
        set innerHTML(markup) {
          const fields = new Map([...markup.matchAll(/data-manual="([^"]+)"/g)].map(([, name]) => [name, {
            value: '', innerHTML: '', textContent: '', focus() {}, querySelector() { return null; },
            addEventListener(type, listener) { this[type] = listener; }
          }]));
          manualDialog = {
            open: false, showModal() { this.open = true; }, close() { this.open = false; },
            addEventListener(type, listener) { this[type] = listener; },
            querySelector: selector => fields.get(selector.split('"')[1]),
            fields
          };
        }
      };
    }
  };
  Object.defineProperty(stage, 'innerHTML', { set(html) {
    stageMarkup = html;
    nodes.clear();
    manualHost = null;
    manualDialog = null;
    for (const match of html.matchAll(/id="([^"]+)"/g)) nodes.set(match[1], { value: '', innerHTML: '', textContent: '', focus() {}, dataset: {}, style: {}, classList: { contains: () => false, add() {}, remove() {}, toggle() {} }, append() {}, querySelector: () => null, addEventListener() {} });
  } });
  const playgroundUI = 'web/js/terminal-playground.js';
  const harnessUI = 'web/js/terminal-playground-mcode.js';
  const customUI = 'web/js/mcode-custom.js';
  for (const file of ['web/js/terminal-manual-content.js', 'web/js/terminal-manual-beginner.js', 'web/js/terminal-learn.js', 'web/js/terminal-manual.js', 'web/js/terminal-command-coach.js']) {
    vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), ctx, { filename: file });
  }
  vm.runInContext(fs.readFileSync(path.join(root, customUI), 'utf8'), ctx, { filename: customUI });
  vm.runInContext(fs.readFileSync(path.join(root, harnessUI), 'utf8'), ctx, { filename: harnessUI });
  vm.runInContext(fs.readFileSync(path.join(root, playgroundUI), 'utf8'), ctx, { filename: playgroundUI });
  const unmount = ctx.A.play.games.terminal_playground.mount(stage, {});
  const click = dataset => stage.onclick({ target: { closest: selector =>
    selector === 'button' || selector === '[data-mode]' && dataset.mode || selector === '[data-shell]' && dataset.shell ||
    selector === '[data-playcustom]' && dataset.playcustom ? { dataset } : null } });
  click({ job: 'start' });
  const openJob = nodes.get('tpgprompt').textContent.includes('[job 15]') && nodes.get('tpgjobs').innerHTML.includes('Free play');
  click({ act: 'curios' });
  const journalVisible = nodes.get('tpgout').innerHTML.includes('Curio journal');
  click({ mode: 'puzzle' });
  const puzzleVisible = nodes.get('tpgtitle').textContent.includes('Bash') && !nodes.has('tpgjobs');
  /* the AI scenario box: describe anything, choose any room size */
  const aiBoxVisible = nodes.has('puzaiq') && nodes.has('puzaisize') && /Describe any scenario/.test(stageMarkup);
  click({ mode: 'sandbox' });
  const jobResumed = nodes.get('tpgprompt').textContent.includes('[job 15]');
  const input = nodes.get('tpgin');
  input.value = 'for n in alpha beta; do\n  printf "<%s>" "$n"\ndone';
  let prevented = false;
  input.onkeydown({ key: 'Enter', shiftKey: true, preventDefault() { prevented = true; } });
  const keepsNewline = !prevented && input.value.includes('\n');
  input.onkeydown({ key: 'Enter', preventDefault() {} });
  const ranMultiline = nodes.get('tpgout').innerHTML.includes('&lt;alpha&gt;&lt;beta&gt;');
  const enter = value => {
    const box = nodes.get('tpgin');
    box.value = value;
    box.onkeydown({ key: 'Enter', preventDefault() {} });
  };
  const printed = () => nodes.get('tpgout').innerHTML;
  const manual = ctx.TerminalPlayground.manual;
  const standardShells = ctx.TerminalPlayground.shells.filter(shell => !shell.range);
  const indexes = standardShells.map(shell => manual.buildIndex(shell));
  const bashManual = indexes.find(index => index.shell.id === 'bash');
  const cmdManual = indexes.find(index => index.shell.id === 'cmd');
  const gitManual = indexes.find(index => index.shell.id === 'git');
  const networkManual = indexes.find(index => index.shell.id === 'network');
  ok('manual: indexes all ten shells and resolves command aliases, paths and flags',
    indexes.length === 10 && indexes.every(index => index.chapters.length && index.pages.length > 10) &&
    manual.pageFor(bashManual, '/manual/text-pipeline-wrangling/grep.man -in').flags.join(',') === '-i,-n' &&
    manual.pageFor(cmdManual, 'findstr /I').page.key === 'findstr' &&
    manual.pageFor(gitManual, 'log --oneline').page.key === 'git log' &&
    manual.pageFor(bashManual, 'll').page.key === 'ls' &&
    manual.search(bashManual, 'grep uppercase').some(page => page.key === 'grep'),
    indexes.map(index => index.shell.id + '=' + index.pages.length + '/' + index.pages.filter(page => page.detail).length).join(' '));
  ok('manual: preserves command composition and keeps mode-specific notes and examples scoped',
    manual.guideRequest('help grep | head -3', 'bash', 'sandbox') === null &&
    manual.guideRequest('Get-Help Get-ChildItem -Force', 'powershell', 'sandbox') === 'Get-ChildItem -Force' &&
    manual.guideRequest('findstr /?', 'cmd', 'sandbox') === 'findstr' &&
    manual.guideRequest('git log --help', 'git', 'lab') === 'git log' &&
    manual.guideRequest('docker compose --help', 'docker', 'puzzle') === 'docker compose' &&
    manual.pageFor(networkManual, 'hydra').page.examples.length === 0 &&
    manual.buildIndex(byId('bash'), 'lab', [['cat exercise.txt', 'Inspect the exercise note.']]).pages
      .some(page => page.examples.some(([command, , kind]) => command === 'cat exercise.txt' && kind === 'Current exercise')));
  const sampleBash = TP.makeBash();
  const grepSamples = manual.pageFor(bashManual, 'grep').page.examples;
  ok('manual: documented grep examples produce the advertised case, line numbers, and literal punctuation',
    grepSamples.length >= 3 && sampleBash.run(grepSamples[0][0]) === sampleBash.run(grepSamples[1][0]) &&
    /^\d+:.*error/im.test(sampleBash.run(grepSamples[0][0])) && sampleBash.run(grepSamples[2][0]) === '1:PROD, Verified',
    grepSamples.slice(0, 3).map(([command]) => sampleBash.run(command)).join('\n'));
  enter('help grep -in');
  const manualPage = () => manualDialog.fields.get('page').innerHTML;
  const highlights = () => (manualPage().match(/data-manual-highlight/g) || []).length;
  const twoFlags = manualDialog.open && highlights() === 2 && manualPage().includes('Apple and apple both match') &&
    manualPage().includes('The first line is line 1') && manualPage().includes('<details><summary>More details and options');
  const manualEnter = value => {
    manualDialog.fields.get('input').value = value;
    manualDialog.fields.get('form').submit({ preventDefault() {} });
  };
  manualEnter('man echo -E');
  const oneFlag = highlights() === 1 && manualPage().includes('data-manual-highlight><code>-E</code>');
  manualEnter('cd /');
  manualEnter('ls');
  const sawChapters = manualPage().includes('All commands') && manualDialog.fields.get('status').textContent.includes('text-pipeline-wrangling/');
  manualEnter('apropos line number');
  const searched = manualDialog.fields.get('pages').innerHTML.includes('data-manual-page="grep"');
  manualEnter('back');
  const browsedBack = manualPage().includes('All commands');
  manualEnter('exit');
  ok('manual: help opens collapsible pages, highlights flags case-sensitively and navigates from its own prompt',
    twoFlags && oneFlag && sawChapters && searched && browsedBack && !manualDialog.open);
  click({ act: 'manual' });
  const buttonOpens = manualDialog.open && manualPage().includes('What do you want to do?') && manualDialog.fields.get('index').hidden === true;
  manualEnter('man printf');
  const printedBeforeManual = printed();
  const exampleCommand = 'printf "manual example"';
  manualDialog.click({ target: { closest: () => ({ dataset: { manualInsert: exampleCommand }, hasAttribute: () => false }) } });
  ok('manual: examples return to the original prompt without execution',
    buttonOpens && !manualDialog.open && nodes.get('tpgin').value === exampleCommand && printed() === printedBeforeManual);
  click({ act: 'manual' });
  const guideClick = dataset => manualDialog.click({ target: { closest: () => ({ dataset, hasAttribute: () => false }) } });
  const startsSimple = manualPage().includes('Show my files') && manualPage().includes('Find a word') &&
    manualPage().includes('How to use this window') && !manualDialog.fields.get('pages').innerHTML;
  guideClick({ manualPage: 'grep' });
  const clickedStarter = manualPage().includes('You see 1:Apple.') && manualPage().includes('What each part does') &&
    manualPage().includes('Copy to my terminal') && manualPage().includes('Where it goes') && manualPage().includes('What to put in');
  guideClick({ manualNav: 'back' });
  const backToStart = manualPage().includes('What do you want to do?');
  const searchHelp = manualDialog.fields.get('search');
  searchHelp.input({ target: { value: 'find a word' } });
  searchHelp.keydown({ key: 'Enter', preventDefault() {} });
  const searchedByTask = manualPage().includes('<h3>Find a word</h3>');
  searchHelp.input({ target: { value: 'grep -in' } });
  searchHelp.keydown({ key: 'Enter', preventDefault() {} });
  const searchedFlags = highlights() === 2;
  manualEnter('exit');
  ok('manual: simple cards, back navigation, natural-language search, and typed flags work together',
    startsSimple && clickedStarter && backToStart && searchedByTask && searchedFlags, { startsSimple, clickedStarter, backToStart, searchedByTask, searchedFlags });
  const firstExamples = [
    ['bash', 'grep', TP.makeBash, /^1:Apple$/],
    ['powershell', 'get-location', TP.makePowershell, /C:\\/],
    ['cmd', 'cd', TP.makeCmd, /C:\\/],
    ['python', 'sum', TP.makePython, /^6$/],
    ['node', 'expressions', TP.makeNode, /^4$/],
    ['sql', 'show tables', TP.makeSql, /users|accounts|orders/i],
    ['git', 'git status', TP.makeGit, /On branch/i],
    ['docker', 'docker ps', TP.makeDocker, /CONTAINER ID/i],
    ['network', 'dig', TP.makeNetwork, /api\.internal\.?.*IN A/i],
    ['crypto', 'hex', TP.makeCrypto, /^hi$/]
  ];
  const starterFailures = [];
  for (const [shell, key, makeSandbox, expected] of firstExamples) {
    const sample = TP.manualBeginner[shell][key].example;
    const results = [['Sandbox', makeSandbox().run(sample)]];
    for (const difficulty of Object.keys(PUZ.DIFFS)) {
      const session = PUZ.createSession(PUZ.generate({ shell, difficulty, seed: 36417 }));
      results.push([difficulty, session.run(sample).out]);
    }
    for (const [mode, output] of results) {
      if (!expected.test(String(output).trim())) starterFailures.push([shell, mode, output]);
    }
  }
  ok('manual: first examples return the described result in each shell and puzzle difficulty',
    starterFailures.length === 0, starterFailures);
  enter('help mcode');
  const secretHelp = manualDialog.open && !manualDialog.fields.get('pages').innerHTML.includes('data-manual-page="mcode"');
  manualEnter('exit');
  enter('/help');
  ok('mcode: standard help, toolbar and bare slash commands leave the Easter egg hidden',
    secretHelp && !stageMarkup.includes('data-act="mcode"') && nodes.get('tpgmcodectl').innerHTML === '' &&
    !nodes.get('tpgprompt').textContent.startsWith('mcode('));
  const locked = () => !nodes.get('tpgprompt').textContent.startsWith('mcode(');
  enter('mcode');
  const bareIsLocked = locked() && printed().includes('mcode: locked');
  enter('cd /home/moundshroud');
  // The note is a real file in the shell's disk, always inside a hidden folder: plain ls and tree never show it,
  // and ls -la, full paths, ../ paths, find and grep all agree about it.
  enter('ls');
  enter('tree');
  const noListing = !printed().includes('mcode.txt') && !printed().includes('.archive');
  enter('ls -la');
  enter('ls -la .archive');
  const showsWhenAsked = / \.archive\n/.test(printed()) && /----------\s+1 moundshroud moundshroud\s+\d+ Feb 12 06:20 mcode\.txt/.test(printed());
  enter('cat .archive/mcode.txt');
  const permissionIsRequired = printed().includes('cat: .archive/mcode.txt: Permission denied');
  enter('cd projects');
  enter('chmod u+r ../.archive/mcode.txt');
  enter('grep -c PAYLOAD /home/moundshroud/.archive/mcode.txt');
  const samePathEverywhere = /grep -c PAYLOAD \/home\/moundshroud\/\.archive\/mcode\.txt<\/span>\n<span[^>]*>1<\/span>/.test(printed());
  enter('find ~ -name mcode.txt');
  const foundByFind = printed().includes('/home/moundshroud/.archive/mcode.txt');
  enter('cd ~/.archive');
  enter('cat mcode.txt');
  const payload = printed().match(/PAYLOAD\n([A-Za-z0-9+/=]+)\n/)?.[1];
  enter('cat mcode.txt | base64 -d');
  const fullNoteExplained = printed().includes('base64: invalid input') && samePathEverywhere && foundByFind;
  enter('base64 ' + payload);
  const flagExplained = printed().includes('Use base64 -d ' + payload + ' to decode this text.');
  enter('base64 -d "' + payload + '"');
  const decoded = printed().match(/>(lantern-[0-9a-f]{10})<\/span>/)?.[1] || '';
  enter('mcode wrong-passphrase');
  const rejectsWrongPassphrase = locked();
  enter('mcode ' + decoded);
  ok('mcode: a visible Sandbox note requires owner-read permission and a decoded passphrase',
    bareIsLocked && noListing && showsWhenAsked && permissionIsRequired && fullNoteExplained && flagExplained && rejectsWrongPassphrase &&
    /^lantern-[0-9a-f]{10}$/.test(decoded) && !locked() && !printed().includes('mcode ' + decoded) &&
    JSON.parse(storage.get('tpg_mcode_discovery')).unlocked === true &&
    nodes.get('tpgmcodectl').innerHTML.includes('aria-checked="true"'),
    { bareIsLocked, noListing, showsWhenAsked, permissionIsRequired, rejectsWrongPassphrase, open: !locked(), tail: printed().slice(-2500) });
  enter('/model');
  await new Promise(resolve => setImmediate(resolve));
  const listedLocal = printed().includes('local-test:latest') && !printed().includes('free-auto');
  enter('/chat How should I begin this job?');
  await new Promise(resolve => setImmediate(resolve));
  const sawAdvice = printed().includes('Try reading the exercise brief');
  enter('/exit');
  const before = byId('bash').run('test -e unexpected-from-model.txt; echo $?');

  // /code: a scripted local model works the objective step by step; commands run in the simulated shell.
  ctx.setTimeout = setTimeout; ctx.clearTimeout = clearTimeout;
  const chatStream = ctx.A.ai.stream, codeRequests = [];
  const settle = async () => { for (let i = 0; i < 40; i++) { await new Promise(resolve => setTimeout(resolve, 60)); if (/Answer ·|Stopped|failed/.test(printed().split('solve this puzzle</span>').pop())) break; } };
  let script = [];
  ctx.A.ai.stream = async (messages, onText, signal, options) => {
    codeRequests.push({ messages, options });
    return script.shift() || 'ANSWER: out of script';
  };
  // Solving locks mcode again; the tests unlock it with a fresh note's passphrase, as a player would.
  const unlockAgain = () => {
    const note = TP.mcodeNote('test:relock', 'relock', 'easy');
    note.command('chmod u+r .archive/mcode.txt');
    const payload = note.command('cat .archive/mcode.txt').out.match(/PAYLOAD\n(\S+)/)[1];
    return note.verify(note.command('decode base64 ' + payload).out);
  };
  click({ job: 'next' });
  const jobsBefore = byId('bash').jobs().completed;
  const currentJob = JSON.parse(storage.get('tpg_jobs_bash'));
  const jobKey = TP.jobs.makeJob('bash', currentJob.number, currentJob.seed).answer;
  script = ['THINK: see where I am\nRUN: pwd', 'THINK: I have looked\nANSWER: ' + jobKey];
  enter('mcode /code solve this puzzle');
  await settle();
  const jobWorked = /step 1 · see where I am/.test(printed()) && printed().includes('Answer · ' + jobKey) &&
    byId('bash').jobs().completed === jobsBefore && codeRequests[1]?.messages.some(m => m.role === 'user' && m.content.startsWith('Output of `pwd`'));
  enter('/exit');
  const keptJobTranscript = /step 1 · see where I am/.test(printed()) && printed().includes('Answer · ' + jobKey);
  enter('mcode');
  enter('Type the answer in the terminal for me');
  const jobSubmitted = byId('bash').jobs().completed === jobsBefore + 1 && printed().includes('Submitted the verified answer.') &&
    !TP.mcodeIsUnlocked() && !nodes.get('tpgprompt').textContent.startsWith('mcode(');
  unlockAgain();
  click({ mode: 'lab' });
  const labState = JSON.parse(storage.get('tplab_bash'));
  const plainLabKey = String(TL.session('bash').room().answer).trim();
  const labKey = labState.depth >= 200 ? [...plainLabKey].reverse().join('') : plainLabKey;
  script = ['THINK: try entering the key\nRUN: solve ' + labKey, 'THINK: show the key\nANSWER: ' + labKey];
  enter('mcode /code solve this puzzle');
  await settle();
  const labAfterModel = JSON.parse(storage.get('tplab_bash'));
  const labWaited = labAfterModel.checkpoint === labState.checkpoint && labAfterModel.depth === labState.depth &&
    labAfterModel.failures === labState.failures && printed().includes('Step 1 skipped · solve') && printed().includes('Answer · ' + labKey);
  enter('/exit');
  enter('solve ' + labKey);
  const labAfterPlayer = JSON.parse(storage.get('tplab_bash'));
  const labSubmitted = labAfterPlayer.checkpoint !== labState.checkpoint || labAfterPlayer.depth > labState.depth;
  // The solve locked mcode at once, so the old answer cannot be submitted to the next checkpoint.
  enter('mcode /submit');
  const labAfterStale = JSON.parse(storage.get('tplab_bash'));
  const staleRejected = !TP.mcodeIsUnlocked() && printed().includes('mcode: locked') && labAfterStale.checkpoint === labAfterPlayer.checkpoint &&
    labAfterStale.depth === labAfterPlayer.depth && labAfterStale.failures === labAfterPlayer.failures;
  unlockAgain();
  ctx.A.ai.stream = chatStream;
  ok('mcode: chat uses the selected local model and model text never executes', listedLocal && sawAdvice && before === '1' &&
    chatRequests.length === 1 && chatRequests[0].options.model === 'local-test:latest' && chatRequests[0].options.localOnly === true &&
    modelRequests.join() === '/api/models');
  ok('mcode: jobs require opt-in to submit and Labyrinth rejects an answer from a previous checkpoint',
    jobWorked && keptJobTranscript && jobSubmitted && labWaited && labSubmitted && staleRejected &&
    codeRequests.every(r => r.options.localOnly === true) && chatRequests.length === 1,
    { jobWorked, keptJobTranscript, jobSubmitted, labWaited, labSubmitted, staleRejected, tail: printed().slice(-900) });

  let opens = 0, manualOpens = 0, pipeDecodes = 0; const noteMisses = [], pipeMisses = [];
  for (const mode of ['sandbox', 'lab', 'puzzle']) {
    click({ mode });
    for (const { id } of TP.shells.filter(shell => !shell.range)) {
      click({ shell: id });
      enter('help');
      if (manualDialog?.open && manualPage().includes('What do you want to do?') &&
        manualPage().includes('data-manual-page=') &&
        manualDialog.fields.get('path').textContent.includes(byId(id).name)) manualOpens++;
      manualEnter('exit');
      // The note is a real file in shells with a disk: go to where it lives (home, or the room root), then list it the
      // way that shell lists files (tree.com needs /F to show files). Shells without a disk keep their own note listing.
      const windows = id === 'powershell' || id === 'cmd', disk = windows || id === 'bash';
      if (disk) enter(mode === 'sandbox' ? (id === 'cmd' ? 'cd C:\\Users\\moundshroud' : 'cd ~') : (windows ? 'cd \\' : 'cd /'));
      // A plain listing never shows the hidden note; the shell's own "show hidden" listing does.
      const plain = windows ? 'tree /f' : 'tree';
      const listing = id === 'powershell' ? 'Get-ChildItem -Recurse -Force' : id === 'cmd' ? 'dir /a /s /b' : 'tree -a';
      enter(plain);
      const hiddenFromPlain = !printed().split(plain + '</span>').at(-1).includes('mcode.txt');
      enter(listing);
      const depth = mode === 'lab' ? TL.session(id).depth() : Infinity;
      const found = printed().split(listing + '</span>').at(-1).includes('mcode.txt');
      if (!hiddenFromPlain || found !== (depth >= 5)) noteMisses.push(mode + ':' + id + ' ' + printed().slice(-300));
      if (mode === 'sandbox') {
        const note = windows ? '.archive\\mcode.txt' : '.archive/mcode.txt';
        enter('chmod u+r ' + note);
        enter((id === 'cmd' ? 'type ' : 'cat ') + note);
        const encoded = [...printed().matchAll(/PAYLOAD\n([A-Za-z0-9+/=]+)\n/g)].at(-1)?.[1];
        enter('echo "' + encoded + '" | base64 -d');
        if (/base64 -d<\/span>\n<span[^>]*>lantern-[0-9a-f]{10}<\/span>$/.test(printed())) pipeDecodes++; else pipeMisses.push(id + ': ' + printed().slice(-400));
      }
      enter('mcode');
      if (nodes.get('tpgprompt').textContent.startsWith('mcode(chat)')) opens++;
      enter('/exit');
    }
  }
  ok('manual: opens and exits in all 30 shell and mode combinations', manualOpens === 30, manualOpens);
  ok('mcode: opens and exits in all 30 shell and mode combinations', opens === 30, opens);
  ok('mcode: hidden listings find mcode.txt only in eligible workspaces across all shells and modes', !noteMisses.length, noteMisses);
  ok('mcode: pasting the payload into an echo and Base64 pipeline works in every Sandbox shell', pipeDecodes === 10, pipeMisses);
  const layouts = ['easy', 'medium', 'hard', 'insane'].map((difficulty, rank) => {
    const challenge = TP.mcodeNote('test:' + difficulty, 'first', difficulty);
    const filename = [...['.archive', '.index', '.spare'].slice(0, Math.max(1, rank)), 'mcode.txt'].join('/');
    const listing = challenge.command('tree -a').out;
    const lockedNote = challenge.command('cat ' + filename).out.includes('Permission denied');
    challenge.command('chmod u+r ' + filename);
    const content = challenge.command('cat ' + filename).out;
    const order = content.match(/outside in: ([^.]+)/)?.[1].split(' → ') || [];
    let value = content.match(/PAYLOAD\n([^\n]+)/)?.[1];
    for (const operator of order) value = challenge.command('decode ' + operator + ' ' + value)?.out;
    return (listing.match(/└──/g) || []).length === Math.max(1, rank) + 1 && lockedNote && order.length === rank + 1 && challenge.verify(value);
  });
  ok('mcode: harder difficulties add nested folders and reversible layers', layouts.every(Boolean), layouts);
  const earlyNoteDepths = [1, 3, 5, 7, 9].map(depth =>
    (TP.mcodeNote('test:early-lab', 'checkpoint', 'easy', depth).command('tree -a').out.match(/└──/g) || []).length);
  ok('mcode: the Labyrinth note stays harder even when a later room cycles back to Easy', earlyNoteDepths.join(',') === '2,2,3,4,4');
  const deepNotes = [24, 25, 69, 70, 115, 150, 200, 300].map(depth => {
    const extra = [25, 70, 115, 150, 200].filter(floor => depth >= floor).length;
    const note = TP.mcodeNote('test:deep-lab', 'checkpoint', 'insane', depth);
    const tree = note.command('tree -a').out;
    const entries = Array.from(tree.matchAll(/└── ([^/\n]+)/g), match => match[1]);
    const file = entries.join('/');
    const locked = note.command('cat ' + file)?.out.includes('Permission denied');
    note.command('chmod u+r ' + file);
    const content = note.command('cat ' + file).out;
    const clues = (content.match(/^\d+\. /gm) || []).length;
    let value = content.match(/PAYLOAD\n([^\n]+)/)?.[1];
    const operations = ['base64', 'rot13', 'hex', 'reverse'];
    const nativeDecoders = ['base64 --decode', 'rot13', 'xxd -r -p', 'rev'];
    const start = value;
    const wrong = note.command('decode ' + operations[(4 + extra) % 4] + ' ' + value)?.out;
    const pipeline = ['printf "%s\\n" "' + start + '"'];
    for (let layer = 3 + extra; layer >= 0; layer--) value = note.command('decode ' + operations[layer % 4] + ' ' + value)?.out;
    for (let layer = 3 + extra; layer >= 0; layer--) pipeline.push(nativeDecoders[layer % 4]);
    const firstClosed = tree.match(/^├── ([^/]+)\//)?.[1];
    return { depth, valid: entries.length === 4 + extra && entries.at(-1) === 'mcode.txt' && locked &&
      wrong?.includes('does not match this layer') && note.command(pipeline.join(' | '))?.out === value &&
      (extra === 0 || note.command('ls -la ' + firstClosed)?.out === '(empty directory)') &&
      (extra < 2 ? clues === 0 : clues === 4 + extra) && note.verify(value) };
  });
  ok('mcode: Labyrinth milestones deepen the trail, add decoy branches and keep every note solvable',
    deepNotes.every(result => result.valid), deepNotes.filter(result => !result.valid));
  click({ mode: 'sandbox' });
  click({ shell: 'bash' });
  let releaseChat;
  ctx.A.ai.stream = (messages, onText, signal) => {
    chatRequests.push({ messages, signal });
    return new Promise(resolve => { releaseChat = resolve; });
  };
  enter('mcode /chat Explain the current task');
  await new Promise(resolve => setImmediate(resolve));
  enter('/stop');
  const canceled = chatRequests.at(-1).signal.aborted;
  releaseChat('late model response');
  await new Promise(resolve => setImmediate(resolve));
  ok('mcode: /stop cancels model requests and discards late answers', canceled && !printed().includes('late model response'));
  enter('/chat One more question');
  await new Promise(resolve => setImmediate(resolve));
  const runningSignal = chatRequests.at(-1).signal;
  click({ act: 'mcodeswitch' });
  releaseChat('late response after switch off');
  await new Promise(resolve => setImmediate(resolve));
  enter('mcode');
  const stoppedBySwitch = runningSignal.aborted && printed().includes('mcode is off.') &&
    !printed().includes('late response after switch off') && locked() &&
    nodes.get('tpgmcodectl').innerHTML.includes('aria-checked="false"');
  click({ act: 'mcodeswitch' });
  enter('mcode');
  ok('mcode: switching off aborts the running request and switching on restores access without the passphrase',
    stoppedBySwitch && !locked() && nodes.get('tpgmcodectl').innerHTML.includes('aria-checked="true"'));
  enter('/exit');
  enter('job leave');
  const coachTitle = () => nodes.get('tpgcoachlabel').textContent;
  const coachText = () => nodes.get('tpgcoachbody').innerHTML;
  enter('cd /home/moundshroud');
  enter('cat var/log/ops.log | grep -i -n "prod, verified"');
  const explainsMissingInput = coachTitle() === 'Path could not be opened' && coachText().includes('cat (1)') &&
    coachText().includes('grep (1)') && coachText().includes('/var/log/ops.log') &&
    printed().includes('No such file or directory') && !printed().includes('A downstream filter');
  const failedScreen = printed();
  click({ act: 'coachtry', step: '0' });
  const coachCopiesOnly = nodes.get('tpgin').value === 'pwd' && printed() === failedScreen;
  enter('printf "%s\\n" "PROD, Verified" "prod verified" | grep -in "prod, verified"');
  const explainsSuccess = coachTitle() === 'grep selected lines' && printed().includes('1:PROD, Verified') &&
    coachText().includes('Exit code 0') && coachText().includes('-i ignores letter case') && coachText().includes('-n adds the original line number');
  enter('printf "%s\\n" "prod verified" | grep -in "prod, verified"');
  const explainsNoMatch = coachTitle() === 'No lines selected' && coachText().includes('Exit code 1') &&
    coachText().includes('punctuation');
  click({ act: 'coachhelp' });
  const opensHelp = manualDialog.open && highlights() === 2;
  manualEnter('exit');
  enter('ls |');
  const explainsSyntax = coachTitle() === 'Shell syntax error' && printed().includes('syntax error near pipe') &&
    coachText().includes('each side');
  enter('gpre todo notes.txt');
  const explainsTypo = coachTitle() === 'Command name was not recognized' && coachText().includes('meant “grep”') &&
    coachText().includes('grep todo notes.txt');
  ok('coach: explains Bash path failures, syntax, typos, grep successes and no matches outside the terminal',
    explainsMissingInput && coachCopiesOnly && explainsSuccess && explainsNoMatch && opensHelp && explainsSyntax && explainsTypo,
    { explainsMissingInput, coachCopiesOnly, explainsSuccess, explainsNoMatch, opensHelp, explainsSyntax, explainsTypo, last: coachTitle() });

  const traceCases = [
    ['printf "%s\\n" "cat: secret: Permission denied"', 'Command completed', 'Exit code 0'],
    ['false && echo hidden || echo fallback', 'Command completed', 'was skipped'],
    ['printf "%s\\n" red | grep blue | wc -l', 'Command completed', 'With pipefail off'],
    ['set -o pipefail', 'Command completed', 'Exit code 0'],
    ['printf "%s\\n" red | grep blue | wc -l', 'Command returned a nonzero exit code', 'With pipefail on'],
    ['set +o pipefail', 'Command completed', 'Exit code 0'],
    ['chmod u+r notes.txt', 'Permissions command completed', 'u selects the owner']
  ];
  const traceFailures = [];
  for (const [command, title, detail] of traceCases) {
    enter(command);
    if (coachTitle() !== title || !coachText().includes(detail)) traceFailures.push([command, coachTitle()]);
  }
  enter('printf "once\\n" >> /tmp/coach-runs-once.txt');
  ok('coach: Bash reports observed failures and quiet successes without interpreting printed data as errors or rerunning commands',
    traceFailures.length === 0 && byId('bash').run('wc -l /tmp/coach-runs-once.txt').startsWith('1 '), traceFailures);
  const review = ctx.TerminalPlayground.coach.analyze;
  ok('coach: covers exercise answers, Windows paths, language errors, and fixture-only network tools',
    review({ shell: 'bash', mode: 'lab', command: 'solve wrong', out: '✗ that is not the key.' }).title === 'Answer did not match' &&
    review({ shell: 'bash', mode: 'puzzle', command: 'solve accepted', solved: true }).title === 'Answer accepted' &&
    review({ shell: 'powershell', mode: 'sandbox', command: 'Get-Content x', out: "Get-Content : Cannot find path 'x'." }).title === 'Path could not be opened' &&
    review({ shell: 'cmd', mode: 'sandbox', command: 'grep "red" notes.txt', out: "'grep' is not recognized as an internal or external command." }).manual === 'findstr' &&
    review({ shell: 'python', mode: 'sandbox', command: 'total + 1', out: 'NameError: name total is not defined' }).title === 'Runtime reported an error' &&
    review({ shell: 'sql', mode: 'sandbox', command: 'SELECT FROM', out: 'Parse error: expected SELECT columns FROM table' }).title === 'SQL statement could not be parsed' &&
    review({ shell: 'docker', mode: 'sandbox', command: 'docker logs unknown', out: 'Error response from daemon: No such container: unknown' }).commands[0] === 'docker ps -a' &&
    review({ shell: 'network', mode: 'sandbox', command: 'nmap 10.0.0.5', out: 'fixture' }).commands.length === 0);

  enter('printf "free workspace" > /tmp/save-free.txt');
  enter('chmod 600 /tmp/save-free.txt');
  enter('mark_saved() { echo persisted-function; }');
  enter('job start');
  enter('printf "job workspace" > /tmp/save-job.txt');
  click({ mode: 'puzzle' });
  nodes.get('puzseed').value = 'bash:medium:pipeline:776655';
  click({ act: 'puzloadseed' });
  enter('echo puzzle-workspace > saved-puzzle.txt');
  enter('chmod 600 saved-puzzle.txt');
  enter('hint');
  enter('solve wrong-key');
  const seededKey = String(PUZ.generate(JSON.parse(storage.get('tpg_active_puzzle_bash')).generated).answer).trim();
  ctx.A.ai.stream = async () => 'ANSWER: wrong candidate';
  enter('mcode /code solve this puzzle');
  await settle();
  enter('/submit');
  const badAnswerWasNotEntered = JSON.parse(storage.get('tpg_active_puzzle_bash')).progress.tries === 1 &&
    printed().includes('Nothing was entered.');
  ctx.A.ai.stream = async () => 'THINK: the pipeline gives the key\nANSWER: ' + seededKey;
  enter('mcode /code solve this puzzle');
  await settle();
  const puzzleWaited = !JSON.parse(storage.get('tpg_active_puzzle_bash')).progress.solved && printed().includes('Answer · ' + seededKey);
  ctx.A.ai.stream = chatStream;
  enter('/submit');
  const lockedAfterPuzzle = !TP.mcodeIsUnlocked() && !nodes.get('tpgprompt').textContent.startsWith('mcode(');
  unlockAgain();
  const puzzleSaveBefore = JSON.parse(storage.get('tpg_active_puzzle_bash'));
  ok('mcode: Puzzle Studio submits only a verified answer after explicit opt-in',
    badAnswerWasNotEntered && puzzleWaited && puzzleSaveBefore.progress.solved && puzzleSaveBefore.progress.tries === 1 && lockedAfterPuzzle);
  const solvedBeforeReload = PUZ.loadStats().solved;
  const customSave = PUZ.addCustom({ shell: 'cmd', title: 'Custom resume check', answer: 'test-key', filesText: 'folder/source.txt = original' });
  click({ playcustom: customSave.id });
  enter('cd folder');
  enter('echo custom-progress > saved.txt');
  click({ shell: 'bash' });
  click({ mode: 'lab' });
  enter('mkdir -p save-room');
  enter('cd save-room');
  enter('echo checkpoint-workspace > saved-step.txt');
  enter('chmod 200 saved-step.txt');
  enter('hint');
  enter('solve wrong-key');
  click({ act: 'saveprogress' });
  const checkpointBefore = JSON.parse(storage.get('tplab_bash'));
  click({ mode: 'puzzle' });
  click({ mode: 'lab' });
  const keptAcrossModes = nodes.get('tpgprompt').textContent.includes('save-room') &&
    printed().includes('checkpoint-workspace');
  const draft = nodes.get('tpgin');
  draft.value = 'stat -c %a saved-step.txt';
  draft.oninput();
  click({ act: 'mcodeswitch' });
  unmount();

  const scriptFiles = playgroundFiles.map(name => 'web/js/' + name + '.js').concat(
    ['terminal-labyrinth-data', 'terminal-labyrinth-data2', 'terminal-labyrinth', 'terminal-puzzles',
      'mcode-custom', 'terminal-playground-mcode', 'terminal-command-coach', 'terminal-playground'].map(name => 'web/js/' + name + '.js'));
  function reloadPlayground() {
    const fresh = { ...ctx, A: {}, TerminalPlayground: undefined, TerminalLabyrinth: undefined, TerminalPuzzles: undefined };
    fresh.self = fresh.window = fresh.globalThis = fresh;
    vm.createContext(fresh);
    for (const file of scriptFiles) {
      vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), fresh, { filename: file });
    }
    return fresh;
  }
  const reopenedContext = reloadPlayground();
  const unmountReload = reopenedContext.A.play.games.terminal_playground.mount(stage, {});
  const checkpointAfter = JSON.parse(storage.get('tplab_bash'));
  const restoredView = nodes.get('tpgin').value === 'stat -c %a saved-step.txt' &&
    nodes.get('tpgprompt').textContent.includes('save-room') && printed().includes('checkpoint-workspace') &&
    coachTitle() === 'Answer did not match';
  enter('cat saved-step.txt');
  const permissionDenied = printed().includes('Permission denied');
  enter('chmod u+r saved-step.txt');
  enter('cat saved-step.txt');
  ok('progress: Labyrinth resumes the same checkpoint, files, chmod bits, location, clues, attempts, screen and draft',
    keptAcrossModes && restoredView && permissionDenied && printed().includes('checkpoint-workspace') &&
    checkpointAfter.seed === checkpointBefore.seed && checkpointAfter.depth === checkpointBefore.depth &&
    checkpointAfter.checkpoint === checkpointBefore.checkpoint && checkpointAfter.hints === checkpointBefore.hints &&
    checkpointAfter.failures === checkpointBefore.failures && checkpointAfter.hints > 0 && checkpointAfter.failures > 0);
  const restoredOff = nodes.get('tpgmcodectl').innerHTML.includes('aria-checked="false"');
  enter('mcode');
  const stayedOff = locked() && printed().includes('mcode is off.');
  click({ act: 'mcodeswitch' });
  enter('mcode');
  ok('mcode: the unlock and off setting survive a fresh app load and apply in Labyrinth',
    restoredOff && stayedOff && !locked() && reopenedContext.TerminalPlayground.mcodeIsUnlocked());
  enter('/exit');
  click({ mode: 'puzzle' });
  enter('stat -c %a saved-puzzle.txt');
  enter('cat saved-puzzle.txt');
  const puzzleSaveAfter = JSON.parse(storage.get('tpg_active_puzzle_bash'));
  ok('progress: Puzzle Studio restores the selected seed, files, modes, hints, attempts and solved status',
    puzzleSaveAfter.generated.seed === 776655 && puzzleSaveBefore.progress.solved && puzzleSaveAfter.progress.solved &&
    puzzleSaveAfter.progress.hints === 1 && puzzleSaveAfter.progress.tries === 1 &&
    printed().includes('>600<') && printed().includes('puzzle-workspace') && printed().includes('SOLVED!') &&
    reopenedContext.TerminalPuzzles.loadStats().solved === solvedBeforeReload);
  click({ shell: 'cmd' });
  enter('type saved.txt');
  ok('progress: the active custom puzzle and its edits reopen independently of the generated puzzle',
    JSON.parse(storage.get('tpg_active_puzzle_cmd')).custom.id === customSave.id &&
    nodes.get('tpgprompt').textContent.includes('folder') && printed().includes('custom-progress'));
  click({ shell: 'bash' });
  click({ mode: 'sandbox' });
  const reopenedBash = reopenedContext.TerminalPlayground.shells.find(shell => shell.id === 'bash');
  ok('progress: free-play and active job workspaces restore separately after an app restart',
    reopenedBash.run('cat /tmp/save-job.txt') === 'job workspace' &&
    reopenedBash.run('cat /tmp/save-free.txt').includes('No such file') &&
    reopenedBash.run('job leave').includes('free play') &&
    reopenedBash.run('cat /tmp/save-free.txt') === 'free workspace' &&
    reopenedBash.run('stat -c %a /tmp/save-free.txt') === '600' &&
    reopenedBash.run('mark_saved') === 'persisted-function' &&
    reopenedBash.run('job start').includes('Job') &&
    reopenedBash.run('job reset').includes('workspace restored') &&
    reopenedBash.run('cat /tmp/save-job.txt').includes('No such file'));
  const workspaceCases = [
    ['powershell', ['Set-Content resume-note.txt "ps resume"'], 'Get-Content resume-note.txt', 'ps resume'],
    ['cmd', ['echo cmd resume > resume-note.txt'], 'type resume-note.txt', 'cmd resume'],
    ['python', ['resume_values = [1, 2, 3]'], 'sum(resume_values)', '6'],
    ['node', ['const resumeData = { values: [1, 2, 3] }', 'require("fs").writeFileSync("resume-note.txt", "node resume")'],
      'resumeData.values.length + require("fs").readFileSync("resume-note.txt", "utf8")', '3node resume'],
    ['sql', ['CREATE TABLE resume_items (id INT, name TEXT);', 'BEGIN;', "INSERT INTO resume_items VALUES (1, 'sql resume');"],
      'SELECT name FROM resume_items;', 'sql resume'],
    ['git', ['git add README.md', 'git commit -m "resume test commit"'], 'git log --oneline', 'resume test commit'],
    ['docker', ['docker run -d --name resume-test-web nginx:1.25-alpine'], 'docker ps -a', 'resume-test-web']
  ];
  for (const [id, setup] of workspaceCases) {
    const shell = reopenedContext.TerminalPlayground.shells.find(item => item.id === id);
    shell.run('job leave');
    for (const command of setup) shell.run(command);
  }
  const freshPlayground = reloadPlayground().TerminalPlayground;
  const workspaceChecks = workspaceCases.map(([id, , query, expected]) => {
    const shell = freshPlayground.shells.find(item => item.id === id);
    const result = shell.run(query);
    return [id, result, String(result).includes(expected)];
  });
  const restoredSql = freshPlayground.shells.find(item => item.id === 'sql');
  ok('progress: saves Windows files, REPL data, SQL transactions, Git commits and Docker containers',
    workspaceChecks.every(([, , works]) => works) && restoredSql.run('ROLLBACK;') === 'ROLLBACK' &&
    !restoredSql.run('SELECT name FROM resume_items;').includes('sql resume'),
    workspaceChecks.filter(([, , works]) => !works));
  unmountReload();

  const depthResults = [];
  let legacyNoteWasSaved = false, relockedOnReset = false;
  for (const depth of [4, 5, 17, 18]) {
    storage.set('tplab_bash', JSON.stringify({ seed: 777, depth }));
    if (depth === 4) {
      const legacy = TL.session('bash');
      const room = legacy.room();
      legacy.run('echo player-note > mcode.txt');
      TP.mcodeNote('lab:bash', room.seedCode, room.difficulty, depth).mount(room.snapshot().tree);
      legacy.save();
      legacyNoteWasSaved = JSON.stringify(JSON.parse(storage.get('tplab_bash')).workspace).includes('PAYLOAD');
    }
    storage.delete('tpg_terminal_view_lab:bash');
    const fresh = reloadPlayground();
    const dispose = fresh.A.play.games.terminal_playground.mount(stage, {});
    click({ mode: 'lab' });
    click({ shell: 'bash' });
    enter('tree -a');
    const generatedNote = depth === 4 ? JSON.stringify(JSON.parse(storage.get('tplab_bash')).workspace).includes('PAYLOAD') :
      printed().includes('.archive') && /[├└]── mcode\.txt/.test(printed());
    const keptPlayerNote = depth !== 4 || JSON.stringify(JSON.parse(storage.get('tplab_bash')).workspace).includes('player-note');
    if (nodes.get('tpgmcodectl').innerHTML.includes('aria-checked="false"')) click({ act: 'mcodeswitch' });
    enter('mcode /code');
    const prefixed = depth < 18 ? printed().includes('/code unlocks at Labyrinth depth 18.') :
      nodes.get('tpgprompt').textContent.startsWith('mcode(code)');
    enter('mcode /chat');
    enter('/CODE');
    const bare = depth < 18 ? printed().split('/CODE</span>').at(-1).includes('/code unlocks at Labyrinth depth 18.') :
      nodes.get('tpgprompt').textContent.startsWith('mcode(code)');
    depthResults.push({ depth, generatedNote, keptPlayerNote, prefixed, bare });
    if (depth === 18) {
      click({ act: 'labreset' });
      enter('/code');
      relockedOnReset = !nodes.get('tpgprompt').textContent.startsWith('mcode(') &&
        printed().includes('/code unlocks at Labyrinth depth 18.');
    }
    dispose();
  }
  ok('mcode: Labyrinth gates notes at 5 and /code at 18, including after reset and when reopening an old save', legacyNoteWasSaved && relockedOnReset && depthResults.every(result =>
    result.generatedNote === (result.depth >= 5) && result.keptPlayerNote && result.prefixed && result.bare), JSON.stringify(depthResults));
  storage.set('tpg_mode', 'sandbox');
  const { EventEmitter } = require('node:events');
  const source = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
  const routeStart = source.indexOf("if (url === '/api/chat' && req.method === 'POST')");
  const routeEnd = source.indexOf('/* ---- Claude (Anthropic) and internet access:', routeStart);
  const route = new vm.Script('(async () => {' + source.slice(routeStart, routeEnd) + '})()');
  const modelReply = (model, installed) => route.runInNewContext({
    url: '/api/chat', req: { method: 'POST' }, res: {}, q: new URLSearchParams('surface=playground'),
    body: async () => JSON.stringify({ model, stream: true, tools: [{}], messages: [{ role: 'user', content: 'hello', images: ['image'] }, { role: 'tool', content: 'ignored' }] }),
    json: (response, status, data) => ({ status, data }),
    ollamaChat: payload => ({ status: 200, data: JSON.parse(payload) }),
    OLLAMA: {}, cloud: { cfg: () => ({}) },
    http: { get: (options, callback) => {
      const request = new EventEmitter();
      queueMicrotask(() => {
        const response = new EventEmitter();
        callback(response);
        response.emit('data', JSON.stringify({ models: installed.map(name => ({ name })) }));
        response.emit('end');
      });
      return request;
    } }
  });
  const accepted = await modelReply('local-test:latest', ['local-test:latest']);
  const missing = await modelReply('local-test:latest', []);
  const cloud = await modelReply('free-auto', []);
  ok('mcode: the server requires an installed local model and strips tool calls and image attachments',
    accepted.status === 200 && missing.status === 404 && cloud.status === 400 && !accepted.data.tools &&
    JSON.stringify(accepted.data.messages) === '[{"role":"user","content":"hello"}]');
  ok('playground UI: practice controls, discovery journal, AI scenario box, and mode switching work together', openJob && journalVisible && puzzleVisible && aiBoxVisible && jobResumed);
  ok('playground UI: the Bash input preserves multiline scripts and runs them with Enter', keepsNewline && ranMultiline);

  const savedProgress = JSON.parse(storage.get('tpg_jobs_bash'));
  for (const script of playgroundFiles.slice(-3)) {
    const f = 'web/js/' + script + '.js';
    vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx, { filename: f });
  }
  const reopened = TP.shells.find(shell => shell.id === 'bash');
  ok('playground reload: the selected assignment, completion count, and curio journal are restored',
    reopened.run('job').includes(TP.jobs.makeJob('bash', savedProgress.number, savedProgress.seed).ticket) &&
    reopened.jobs().completed === savedProgress.completed && reopened.run('curios').includes('17/70 discovered'));
}

module.exports = run;

if (require.main === module) {
  let pass = 0, fail = 0;
  const ok = (name, cond, detail) => {
    if (cond) { pass++; console.log('  ok   ' + name); }
    else { fail++; console.log('  FAIL ' + name + (detail ? '  ->  ' + detail : '')); }
  };
  run(ok).then(() => {
    console.log('\n' + pass + ' passed, ' + fail + ' failed');
    process.exit(fail ? 1 : 0);
  }).catch(e => {
    console.error(e);
    process.exit(1);
  });
}

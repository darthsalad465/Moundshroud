// The two Security ranges in the Terminal Playground: 🧨 Pentest (web) and 🖥 Pentest (remote).
// Both are fake machines inside the page, so the test can drive the whole engagement the way a learner would:
// scan → exploit → shell → objective, and check that nothing in them could ever reach a real network.
const fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.join(__dirname, '..');

module.exports = function (ok) {
  const ctx = { console, Math, Date, URLSearchParams, JSON, Object, Array, String, Number, Set, Map, RegExp };
  ctx.window = ctx.self = ctx.globalThis = ctx;
  ctx.TerminalPlayground = {
    shells: [],
    splitTop: (text, seps) => String(text).split(seps[0]).map(part => part.trim()).filter(Boolean)
  };
  vm.createContext(ctx);
  for (const file of ['web/js/terminal-pentest.js', 'web/js/terminal-remote.js']) {
    vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), ctx, { filename: file });
  }

  const shells = ctx.TerminalPlayground.shells;
  const pentest = shells.find(shell => shell.id === 'pentest');
  const remote = shells.find(shell => shell.id === 'remote');
  ok('security ranges: both register in the terminal sandbox beside the ten terminals, under Security',
    shells.length === 2 && !!pentest && !!remote && pentest.range === true && remote.range === true &&
    pentest.group === 'Security' && remote.group === 'Security' &&
    pentest.commands.length > 10 && remote.commands.length > 10 && pentest.about.includes('simulated') &&
    remote.about.toLowerCase().includes('offline'),
    JSON.stringify(shells.map(shell => shell.id + '/' + shell.group)));

  /* ---------------- web engagement ---------------- */
  const web = pentest.run('targets');
  const host = /([a-z0-9-]+\.local)/.exec(web)?.[1];
  const recon = pentest.run('nmap -sV 10.10.10.5');
  const dirs = pentest.run('gobuster dir -u http://' + host);
  const injection = pentest.run('curl "http://' + host + "/login?u=' OR 1=1-- &p=x\"");
  const robots = pentest.run('curl http://' + host + '/robots.txt');
  const adminPath = /Disallow: (\/[a-z0-9_-]+)/i.exec(robots.split('\n').filter(line => !/login|guestbook/.test(line)).join('\n'))?.[1];
  const staff = pentest.run('curl http://' + host + adminPath);
  const upload = pentest.run('curl -X POST "http://' + host + '/upload?file=shell.php"');
  const foothold = pentest.run('shell');
  const privesc = pentest.run('sudo -l');
  pentest.run('sudo /usr/bin/python3 -c pass');
  const rootFlag = pentest.run('cat /root/flag.txt');
  const rootPrompt = pentest.prompt();
  const inShellStatus = pentest.run('status');
  pentest.run('exit');
  const done = pentest.run('status');
  const offRange = pentest.run('curl http://example.com/');

  ok('pentest (web): scan, path brute-force and SQL injection lead to the staff dashboard and its flag',
    /443\/tcp\s+open\s+ssl\/https\s+nginx/.test(recon) && /Status: 403/.test(dirs) &&
    /Signed in as <b>admin/.test(injection) && /\/staff|\/admin-|\/backoffice|\/ops-/.test(adminPath || '') &&
    /FLAG\{[a-z0-9_]+_web_admin_/.test(staff) && /api_key/.test(staff),
    JSON.stringify({ host, adminPath, staff: staff.slice(0, 120) }));

  ok('pentest (web): the upload becomes a webshell, the box is privesc’d with sudo python3 and the root flag is readable',
    /"stored":"\/uploads\/shell\.php"/.test(upload) && /Interactive shell on/.test(foothold) &&
    /NOPASSWD: \/usr\/bin\/python3/.test(privesc) &&
    /FLAG\{root_/.test(rootFlag) && rootPrompt.startsWith('root@') &&
    done.includes('[x] Escalate to root') && done.includes('[x] Bypass the sign-in') && done.includes('[x] Upload a PHP webshell') &&
    inShellStatus.includes('[x] Get a remote shell') &&
    /Failed to connect to example\.com \(out of scope \/ offline\)/.test(offRange),
    JSON.stringify({ rootFlag: rootFlag.slice(0, 60), done }));

  const rejection = (() => {
    const fresh = ctx.TerminalPlayground.makePentest();
    const freshHost = /([a-z0-9-]+\.local)/.exec(fresh.run('targets'))?.[1];
    const out = fresh.run('curl "http://' + freshHost + '/login?u=admin&p=guess"');
    return { out, host: freshHost, solved: out.includes('Signed in as'), status: /HTTP\/1\.1 401/.test(out) };
  })();
  ok('pentest (web): a wrong password is refused with a real-looking 401, not accepted',
    rejection.status && !rejection.solved);

  /* ---------------- remote engagement ---------------- */
  const range = /10\.20\.30\.\d+/.test(remote.run('targets'));
  const scan = remote.run('nmap -sV 10.20.30.0/24');
  const users = remote.run('enum4linux 10.20.30.21');
  const shareList = remote.run('smbclient -L //10.20.30.21 -N');
  const badUser = remote.run('ssh helpdesk@10.20.30.21');
  const fetchNote = remote.run('smbclient //10.20.30.21/IT -N -c "get onboarding.txt"');
  const note = remote.run('cat loot/onboarding.txt');
  remote.run('ssh helpdesk@10.20.30.21');
  const wrongPassword = remote.run('guess-123');
  const login = remote.run('Sunrise-2026!');
  const whoami = remote.run('whoami');
  const handover = remote.run('type C:\\Users\\Public\\Documents\\handover.txt');
  const vaultDenied = remote.run('type C:\\ProgramData\\vault\\admin.txt');
  const wrongSession = remote.run('whoami');
  remote.run('exit');
  const badCme = remote.run('crackmapexec smb 10.20.30.22 -u administrator -p nope');
  const goodCme = remote.run('crackmapexec smb 10.20.30.22 -u administrator -p Blu3-Falcon-88');
  const system = remote.run('impacket-psexec administrator@10.20.30.22 -p Blu3-Falcon-88');
  const systemId = remote.run('whoami');
  const vault = remote.run('type C:\\ProgramData\\vault\\admin.txt');
  const inSessionStatus = remote.run('status');
  remote.run('exit');
  const remoteDone = remote.run('status');

  ok('pentest (remote): scan and SMB enumeration list invented Windows machines, users, shares and a leaked password',
    range && /445\/tcp\s+open\s+microsoft-ds/.test(scan) && /3389\/tcp\s+open\s+ms-wbt-server/.test(scan) &&
    /user:\[helpdesk\]/.test(users) && /IT\s+Disk/.test(shareList) && /onboarding\.txt/.test(fetchNote) &&
    /Sunrise-2026!/.test(note) && /Permission denied/.test(badUser),
    JSON.stringify({ scan: scan.slice(0, 120) }));

  ok('pentest (remote): ssh refuses a wrong password, accepts the leaked one, and the session reads the handover note',
    /Permission denied, please try again/.test(wrongPassword) && /Windows PowerShell/.test(login) &&
    /ws-maya\\helpdesk/i.test(whoami) && /Blu3-Falcon-88/.test(handover) &&
    /cannot find the file specified/i.test(vaultDenied) && /ws-maya\\helpdesk/i.test(wrongSession),
    JSON.stringify({ wrongPassword, whoami, vaultDenied }));

  ok('pentest (remote): the admin credential is tested over SMB, psexec gives SYSTEM, and the vault flag is read',
    /STATUS_LOGON_FAILURE/.test(badCme) && /Pwn3d!/.test(goodCme) && /Impacket v/.test(system) &&
    /nt authority\\system/.test(systemId) && /FLAG\{remote_srv_files_system_9c41\}/.test(vault) &&
    remoteDone.includes('[x] Read the admin vault') && remoteDone.includes('[x] Get a SYSTEM shell') &&
    remoteDone.includes('[x] Pull the onboarding note') && inSessionStatus.includes('[x] Read the handover note'),
    JSON.stringify({ systemId, vault: vault.slice(0, 60), inSessionStatus, badCme, goodCme, system: system.slice(0, 40), remoteDone }));

  const desktop = (() => {
    const fresh = ctx.TerminalPlayground.makeRemoteRange();
    const session = fresh.run('xfreerdp /v:10.20.30.22 /u:administrator /p:Blu3-Falcon-88');
    const listing = fresh.run('dir');
    fresh.run('exit');
    const reset = fresh.run('reset-range');
    return { session, listing, reset, status: fresh.run('status') };
  })();
  ok('pentest (remote): the simulated RDP desktop opens, lists files, and reset-range clears the objectives',
    /GUI session established/.test(desktop.session) && /Directory of/.test(desktop.listing) &&
    /Range rebuilt/.test(desktop.reset) && !desktop.status.includes('[x]'));

  /* ---------------- safety: fake, offline, educational ---------------- */
  const sources = ['web/js/terminal-pentest.js', 'web/js/terminal-remote.js']
    .map(file => fs.readFileSync(path.join(root, file), 'utf8'));
  ok('security ranges: nothing in either range can open a socket, fetch a URL or reach the network',
    sources.every(text => !/\bfetch\s*\(|XMLHttpRequest|WebSocket|navigator\.sendBeacon|http\.request|require\(['"](?:http|https|net|dgram)['"]\)/.test(text)) &&
    sources.every(text => /fictional|invented|simulated/i.test(text)) &&
    sources.every(text => /permission|own or may test|allowed to test/i.test(text)));
};

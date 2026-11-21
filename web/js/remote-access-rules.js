// Red / Blue · Remote access — the engine behind Cyber > 🕶️ Cyber games > Remote access.
// A seeded, offline simulation of a full intrusion: scan, initial access, foothold, privilege
// escalation, credential access, lateral movement, objective — then the defensive half: triage,
// scoping, containment, eradication and recovery on the very same chain.
// Every run is generated from a seed, so the scenarios, findings, hosts, accounts, ports and
// options vary; nothing here touches a real network.
const RemoteAccess = (function () {
  const levels = {
    recruit: { name: 'Recruit', wrongs: 2, note: 'Common exposures, clear evidence, generous time.' },
    analyst: { name: 'Analyst', wrongs: 3, note: 'Mixed signals, misconfiguration and distractors.' },
    operator: { name: 'Operator', wrongs: 4, note: 'Subtle faults and techniques that nearly work.' }
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
  function shuffle(a, r) {
    const x = a.slice();
    for (let i = x.length - 1; i > 0; i--) { const j = r(i + 1); [x[i], x[j]] = [x[j], x[i]]; }
    return x;
  }
  const opt = (label, ok, why) => ({ label, ok: !!ok, why });
  const b64 = s => (typeof btoa === 'function' ? btoa(String(s)) : Buffer.from(String(s), 'utf8').toString('base64'));
  const hexOf = s => [...String(s)].map(c => c.charCodeAt(0).toString(16).padStart(2, '0')).join(' ');
  const wrap = (s, n) => String(s).replace(new RegExp('.{1,' + (n || 76) + '}', 'g'), '$&\n').trim();
  const occ = r => 21 * 3600 + 4 * 60 + r(2400);
  const clock = n => [Math.floor(n / 3600) % 24, Math.floor(n / 60) % 60, n % 60].map(v => String(v).padStart(2, '0')).join(':');
  const norm = t => String(t == null ? '' : t).toLowerCase().replace(/[^a-z0-9]/g, '');
  const ip = (r, a, b) => '10.' + (a + r(b - a)) + '.' + r(30) + '.' + (2 + r(249));

  /* ---------------------------------------------------------------- scenarios */
  const scenarios = [
    { name: 'Atlas Billing', org: 'atlasretail', asset: 'billing database', objective: 'the twelve flagged refund records', domain: 'atlas.internal', brief: 'A retail group runs its billing application on a small estate it inherited from an acquisition. They want the refund records for a fraud case, and they want to know how exposed the estate really is.' },
    { name: 'Harbor Booking', org: 'harborport', asset: 'booking database', objective: 'the manifest for two disputed sailings', domain: 'harbor.internal', brief: 'A port operator books berths through a public web app. Two sailings are under insurance dispute and the client needs the booking records, plus an honest answer about perimeter access.' },
    { name: 'Meridian Clinic', org: 'meridiancare', asset: 'appointment system', objective: 'one patient appointment log', domain: 'meridian.internal', brief: 'A clinic network wants a scoped test of the appointment portal before a regional audit. Sensitive data stays in place: you prove access and report it, nothing more.' },
    { name: 'Kestrel Logistics', org: 'kestrelfreight', asset: 'shipping database', objective: 'the consignment trail for one lost pallet', domain: 'kestrel.internal', brief: 'A freight broker lost a pallet and cannot reconcile its own tracking. They also suspect the public tracking portal was never hardened after a rushed migration.' },
    { name: 'Fernwood Council', org: 'fernwood', asset: 'permit records', objective: 'the permit history for one address', domain: 'fernwood.internal', brief: 'A small council keeps planning permits on an ageing estate. The engagement covers the public permit search and anything it can reach behind it.' },
    { name: 'Vantage Media', org: 'vantagemedia', asset: 'subscriber database', objective: 'a single subscription record', domain: 'vantage.internal', brief: 'A subscription publisher wants to know whether its inherited CMS is a way into the subscriber database. The data request is deliberately tiny.' }
  ];

  /* ---------------------------------------------------------------- findings: the exposed service */
  const FINDINGS = [
    {
      id: 'tomcat', name: 'Apache Tomcat manager', port: 8080, version: 'Apache-Coyote/1.1 (Tomcat 8.5.19)',
      detail: '/manager/html asks for a login, and the build still ships the example accounts.',
      access: 'Sign in to /manager/html with the vendor defaults, then deploy a small WAR for a shell.',
      wrong: 'Wait for a Tomcat CVE that matches 8.5.19 exactly.',
      wrongWhy: 'You cannot confirm a working exploit for that build, and waiting teaches you nothing about the manager console that is already open.',
      why: 'A manager console with default logins is code execution by design: it deploys code as its job.',
      user: 'tomcat'
    },
    {
      id: 'ssh', name: 'OpenSSH', port: 22, version: 'OpenSSH 7.2p2 Ubuntu-4ubuntu2.8',
      detail: 'Password logins are enabled, the build is years behind, and there is no fail2ban.',
      access: 'Spray three likely passwords across the staff usernames you already found, one attempt each, slowly.',
      wrong: 'Run a remote exploit against OpenSSH 7.2p2.',
      wrongWhy: 'No usable pre-auth remote exploit matches this build; the opening is weak, reused passwords, not a memory bug.',
      why: 'Old SSH plus password auth plus no rate limiting equals credential reuse, and low volume keeps you off the alert list.',
      user: 'svc_deploy'
    },
    {
      id: 'redis', name: 'Redis', port: 6379, version: 'Redis 3.2.100 (no AUTH)',
      detail: 'The instance answers PING without a password and listens on every interface.',
      access: 'Use the unauthenticated Redis to write an SSH key or a cron entry as the redis user.',
      wrong: 'Exploit a Redis 3.x buffer overflow for remote code execution.',
      wrongWhy: 'There is no reliable pre-auth RCE in this build; the open instance is the point, and it writes files for you.',
      why: 'An unauthenticated Redis can write files as its service user — an authorized key or a cron job is a shell next login.',
      user: 'redis'
    },
    {
      id: 'jenkins', name: 'Jenkins controller', port: 8080, version: 'Jenkins 2.204.1 (no auth)',
      detail: 'The Script Console is reachable without a login and jobs run as the jenkins account.',
      access: 'Run a Groovy one-liner in the Script Console to execute a command on the controller.',
      wrong: 'Attack the Jenkins update centre to install a malicious plugin.',
      wrongWhy: 'Plugin installation needs an authenticated admin; the console is already open and does the same thing in one request.',
      why: 'The Groovy console is remote code execution by design; no exploit development needed.',
      user: 'jenkins'
    },
    {
      id: 'ftp', name: 'vsftpd', port: 21, version: 'vsftpd 3.0.3 (anonymous allowed)',
      detail: 'Anonymous FTP has write access to the directory the web server serves.',
      access: 'Log in anonymously and drop a small web shell into the writable web root.',
      wrong: 'Brute-force the FTP accounts with a large wordlist.',
      wrongWhy: 'You already have anonymous write access; brute force adds noise for no extra capability.',
      why: 'Anonymous write into a served directory turns file upload into code execution.',
      user: 'ftp'
    },
    {
      id: 'vpn', name: 'SSL-VPN appliance', port: 443, version: 'FortiGate SSL-VPN 6.0.6',
      detail: 'The build predates the path-traversal fix, and session cookies are stored on disk.',
      access: 'Read the session file with the published path traversal, then replay the stolen cookie.',
      wrong: 'Brute-force the VPN portal logins directly.',
      wrongWhy: 'The portal locks accounts after five failures and the failures are logged loudly; the traversal needs no password at all.',
      why: 'Path traversal leaks session material, and a replayed session skips authentication entirely.',
      user: 'vpnuser'
    },
    {
      id: 'smb', name: 'SMB file sharing', port: 445, version: 'SMBv1 (null sessions allowed)',
      detail: 'Anonymous enumeration is allowed, and one share is where a scheduled task picks up its script.',
      access: 'Enumerate shares as a null session, then write into the share the scheduled task runs from.',
      wrong: 'Run EternalBlue against the SMB service.',
      wrongWhy: 'The host is patched against it; a failed exploit crashes the service and the engagement.',
      why: 'A writable share that a scheduled task executes is a reliable, quiet path to code execution.',
      user: 'guest'
    },
    {
      id: 'docker', name: 'Docker Engine API', port: 2375, version: 'Docker 20.10 (unauthenticated)',
      detail: 'The daemon API answers without TLS or authentication.',
      access: 'Start a privileged container that mounts the host filesystem and read it as root.',
      wrong: 'Pull the official nginx image and look for a Docker escape CVE.',
      wrongWhy: 'You do not need an escape: the daemon will hand you a privileged container that already mounts the host.',
      why: 'Access to the Docker API is effectively root on the host, no exploit required.',
      user: 'root'
    },
    {
      id: 'elastic', name: 'Elasticsearch', port: 9200, version: 'Elasticsearch 6.8 (security disabled)',
      detail: 'The index API is open and the snapshot repository path is configured and writable.',
      access: 'Query the open indices for staff data, then note the snapshot repository path for later.',
      wrong: 'Exploit the Elasticsearch 6.8 remote code execution flaw.',
      wrongWhy: 'The version is not affected, and the data is already readable without any exploit.',
      why: 'An open search cluster is a data breach and a map of the estate; treating it as a crash target wastes it.',
      user: 'elastic'
    },
    {
      id: 'phpmyadmin', name: 'phpMyAdmin', port: 80, version: 'phpMyAdmin 4.8.1 (root, empty password)',
      detail: 'The login page is public and root has an empty password.',
      access: 'Log in as root with the empty password and use SQL to write a file into the web root.',
      wrong: 'Exploit the phpMyAdmin 4.8.1 LFI to read local files.',
      wrongWhy: 'You already have database root with an empty password; the file write is direct and does not need the LFI.',
      why: 'Database root plus FILE privilege is a web shell, and an empty password on root is the whole finding.',
      user: 'root'
    },
    {
      id: 'rdp', name: 'Remote Desktop', port: 3389, version: 'RDP (NLA disabled, no lockout)',
      detail: 'Network-level authentication is off and the account lockout threshold is zero.',
      access: 'Spray a short password list at RDP; there is no lockout to stop you.',
      wrong: 'Exploit BlueKeep against the RDP service.',
      wrongWhy: 'The host is patched; spraying is slower but it actually works here and does not crash anything.',
      why: 'Exposed RDP with no NLA and no lockout is a password problem, and a desktop is a full interactive session.',
      user: 'j.smith'
    },
    {
      id: 'gitlab', name: 'GitLab', port: 80, version: 'GitLab 13.10.2 (public sign-up)',
      detail: 'Public projects expose a deploy key and a runner registration token.',
      access: 'Register an account, read the public repository, then use the leaked runner token to run a job on the build host.',
      wrong: 'Exploit a GitLab 13.10 authentication bypass.',
      wrongWhy: 'You do not need a bypass: self-registration is open and the token is in a public project.',
      why: 'A public sign-up plus a leaked runner token is code execution on the build host, and the repo documents the estate.',
      user: 'gitlab-runner'
    }
  ];

  const DECOYS = [
    { port: 443, state: 'open', service: 'https', version: 'nginx 1.24.0 (TLS 1.3, HTTP/2)', why: 'Current build, HSTS on, no default virtual host serving content.' },
    { port: 25, state: 'open', service: 'smtp', version: 'Postfix smtpd', why: 'Relaying is locked down; the banner alone is not an opening.' },
    { port: 53, state: 'open', service: 'domain', version: 'BIND 9.18', why: 'Patched, and recursion is closed to the internet.' },
    { port: 80, state: 'open', service: 'http', version: '301 redirect to HTTPS', why: 'Only a redirect; the application behind it is the real target.' },
    { port: 22, state: 'open', service: 'ssh', version: 'OpenSSH 9.6 (keys only, fail2ban)', why: 'Key-only authentication and rate limiting make password work pointless.' },
    { port: 3306, state: 'filtered', service: 'mysql', version: '', why: 'Filtered means there is no route from here at all.' },
    { port: 21, state: 'open', service: 'ftp', version: 'vsftpd 3.0.3 (anonymous denied)', why: 'Anonymous login is refused and the build is patched.' },
    { port: 8443, state: 'closed', service: 'https-alt', version: '', why: 'Closed: nothing is listening, so there is nothing to try.' }
  ];

  const WRONG_ACCESS = [
    ['Spear-phish a member of staff for their password.', 'Real tradecraft, but slow and out of scope when a vulnerable service is already exposed and in scope.'],
    ['Fire an exploit for a CVE you have not confirmed against this version.', 'Versions and distro backports decide what works; a blind exploit mostly crashes the service and wakes the SOC.'],
    ['Spray a 10,000-word password list across every account.', 'Lockouts and volume alerting turn a quiet engagement into an incident.'],
    ['Send a USB stick to reception and hope someone plugs it in.', 'Out of scope for this engagement and not an opening on the network.'],
    ['Try the same password on every service until one works.', 'Spreading attempts across services means constant failures on hosts you have not even confirmed exist.']
  ];

  const BAD_ESC = [
    ['Run a kernel exploit for a kernel you have not identified.', 'A blind kernel exploit is the fastest route to a crashed host and an incident report.'],
    ['Try `sudo su` and guess the administrator password.', 'You already have the sudo policy in front of you; guessing adds failed authentications for nothing.'],
    ['Edit /etc/shadow directly to add a root user.', 'That file is mode 640 and owned by root: your current user cannot write to it.'],
    ['Search for a local privilege-escalation exploit and run the first hit.', 'Enumeration first: a random exploit for the wrong distro is how hosts get bricked.']
  ];

  /* escalation: what the enumeration actually shows */
  const ESCALATIONS = [
    {
      id: 'sudo-find', title: 'Sudo rule', artifact: ['Matching Defaults entries for www-data on web01:', '    env_reset, mail_badpass, secure_path=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin', '', 'User www-data may run the following commands on web01:', '    (root) NOPASSWD: /usr/bin/find'],
      prompt: 'What does the sudo policy hand you?', good: 'Run find with -exec to start a shell as root: `sudo find / -exec /bin/sh -p \\; -quit`.',
      bad: 'Nothing useful: find only lists files.', badWhy: 'NOPASSWD on a program that can execute commands is a root shell, not a listing tool.',
      teach: 'Any NOPASSWD binary that can spawn or exec a shell is a root shell. GTFOBins exists for exactly this.', typed: ['find'], typedPrompt: 'Which binary may www-data run as root without a password?', why: 'A NOPASSWD rule on find is equivalent to `sudo su` for anyone who reads the man page.'
    },
    {
      id: 'suid-nmap', title: 'SUID binary', artifact: ['$ find / -perm -4000 -type f 2>/dev/null', '/usr/bin/passwd', '/usr/bin/sudo', '/usr/bin/nmap', '/usr/lib/openssh/ssh-keysign'],
      prompt: 'Which of these is the way up?', good: 'Abuse the SUID nmap: `nmap --interactive` then `!sh` for a root shell.',
      bad: 'SUID passwd is the way in: change root\'s password.', badWhy: 'passwd only lets you change your own password; it drops privileges for anyone else.',
      teach: 'An old SUID nmap keeps root while running its interactive mode. Modern nmap removed the feature.', typed: ['nmap'], typedPrompt: 'Which SUID binary here is the dangerous one?', why: 'SUID means the binary runs as root; an interactive nmap hands that root to a shell.'
    },
    {
      id: 'docker-group', title: 'Group membership', artifact: ['$ id', 'uid=1001(devops) gid=1001(devops) groups=1001(devops),999(docker)'],
      prompt: 'Membership of which group matters, and why?', good: 'The docker group: mount the host filesystem in a container and read it as root.',
      bad: 'The devops group: it probably owns the deployment scripts.', badWhy: 'Group ownership of files is worth checking, but it is not a guaranteed path to root the way the Docker socket is.',
      teach: 'Access to the Docker daemon is root on the host — a container that mounts / is a root shell.', why: 'The docker group talks to a root daemon; a privileged container with -v /:/mnt is host root.'
    },
    {
      id: 'cron-writable', title: 'Scheduled job', artifact: ['$ ls -l /etc/cron.d /opt/backup', '-rw-r--r-- 1 root root  112 /etc/cron.d/nightly', '-rwxrwxrwx 1 root root 2048 /opt/backup/run.sh', '', '$ cat /etc/cron.d/nightly', '*/5 * * * * root /opt/backup/run.sh'],
      prompt: 'Where is the path to root?', good: 'Append a reverse-shell line to /opt/backup/run.sh and wait for the five-minute job.',
      bad: 'Write a new file into /etc/cron.d and wait.', badWhy: '/etc/cron.d is root-owned and not writable by your user; the mode on run.sh is the opening.',
      teach: 'A world-writable script that root runs on a timer is a reliable, quiet root shell.', typed: ['run.sh'], typedPrompt: 'Which file is world-writable and run by root?', why: 'The cron entry runs as root and the script it calls can be edited by anyone.'
    },
    {
      id: 'passwd-writable', title: 'Account file', artifact: ['$ ls -l /etc/passwd /etc/shadow', '-rw-rw-r-- 1 root root 2841 /etc/passwd', '-rw-r----- 1 root shadow 1637 /etc/shadow'],
      prompt: 'What does the world-writable /etc/passwd allow?', good: 'Add a new UID 0 account with a known password hash to /etc/passwd.',
      bad: 'Edit /etc/shadow to blank root\'s password.', badWhy: '/etc/shadow is not writable by your user; /etc/passwd is, and UID 0 is UID 0.',
      teach: 'A writable /etc/passwd plus a known hash is a root account; shadow is not the only door.', typed: ['passwd'], typedPrompt: 'Which file can your user write to?', why: 'An extra UID 0 entry is root, and the file is writable by your user.'
    },
    {
      id: 'backup-conf', title: 'Service credentials', artifact: ['$ ls -l /etc/backup.conf', '-rw-r----- 1 root backup 188 /etc/backup.conf', '', '$ id', 'uid=1002(backup) gid=1002(backup) groups=1002(backup)'],
      prompt: 'You are in the backup group. What is the move?', good: 'Read /etc/backup.conf for the service account credentials, then switch to that account.',
      bad: 'Use the backup group to read every file on the host.', badWhy: 'Group access is limited to the files that group owns; the config names an account with more rights.',
      teach: 'Reading a config you can access often yields a credential for an account with real privileges.', why: 'The config is readable by your group and names an account that can do more than you can.'
    }
  ];

  const FOOTHOLD_OPTS = [
    ['Stage a small HTTPS download from your own server over 443 and run it.', true, 'The egress policy allows 443 outbound, so a download over TLS leaves the estate the same way normal web traffic does.'],
    ['Start a bind shell listening on 4444 on the target.', false, 'Inbound is blocked at the edge: the bind shell is unreachable from outside.'],
    ['Use a plain-text reverse shell back to your host on port 31337.', false, 'All egress except 443 is dropped, and the proxy inspects what it does not recognise.'],
    ['Enable RDP on the target and connect back to it.', false, 'Inbound is still blocked, and you have just widened the target for the defenders.']
  ];

  /* ---------------------------------------------------------------- the red chain */
  function buildRed(r, sc, finding, level, loot) {
    const targetIp = '203.0.113.' + (11 + r(200));
    const attacker = '198.51.100.' + (11 + r(200));
    const decoys = shuffle(DECOYS, r).slice(0, Math.max(2, levels[level].wrongs));
    const rows = [
      { port: finding.port, state: 'open', service: 'http', version: finding.version, why: finding.why },
      ...decoys
    ].sort((a, b) => a.port - b.port).map(x => String(x.port + '/tcp').padEnd(9) + x.state.padEnd(9) + x.service.padEnd(10) + x.version);
    const scanLabel = String(finding.port + '/tcp').padEnd(9) + finding.name + ' — ' + finding.version;
    const reconOptions = shuffle([
      opt(scanLabel + ' · ' + finding.detail, true, finding.why),
      ...decoys.map(d => opt(String(d.port + '/tcp').padEnd(9) + d.service + ' ' + d.version + (d.state !== 'open' ? ' (' + d.state + ')' : ''), false, d.why))
    ], r);

    const stages = [];
    stages.push({
      phase: 'Recon', skill: 'Reconnaissance', title: 'Reconnaissance',
      brief: 'The engagement starts with the public estate. You have an IP and permission to touch that one host.',
      artifact: { label: '$ nmap -sV -Pn -p- --min-rate 2000 ' + targetIp, text: 'Starting Nmap 7.94\nNmap scan report for ' + targetIp + '\nHost is up (0.021s latency).\n\nPORT     STATE    SERVICE   VERSION\n' + rows.join('\n') + '\n\nHost script results:\n| egress: only tcp/443 leaves this network; inbound is blocked at the edge.' },
      prompt: 'Which exposed service do you start with?',
      hint: 'Read the version and the detail next to each port. One of these is exposed in a way its owner would not defend.',
      teach: 'Recon is about picking the opening that is actually open, in scope. Ports that are current, filtered or patched are noise, not targets.',
      options: reconOptions, log: ['nmap -sV -Pn -p- --min-rate 2000 ' + targetIp, String(finding.port) + '/tcp open ' + finding.name + ' — ' + finding.version]
    });

    stages.push({
      phase: 'Initial access', skill: 'Exploitation', title: 'Initial access',
      brief: 'You have one exposed service and the client\'s rules of engagement: no denial of service, no data outside scope, stop when you have proved access.',
      artifact: { label: '$ curl -sI http://' + targetIp + ':' + finding.port + ' / banner grab', text: finding.name + ' · ' + finding.version + '\n' + finding.detail + '\n\nRules of engagement: no DoS, no destructive actions, report every host you touch.' },
      prompt: 'How do you get your first credential or execution on this host?',
      hint: 'Match the technique to the specific exposure. The loud options are also the ones that do not fit.',
      teach: 'Initial access is a matching problem: the exposure decides the technique. Weak credentials want reuse or defaults; an open management interface wants its own admin function.',
      options: shuffle([
        opt(finding.access, true, finding.why),
        opt(finding.wrong, false, finding.wrongWhy),
        ...shuffle(WRONG_ACCESS, r).slice(0, Math.max(2, levels[level].wrongs - 1)).map(w => opt(w[0], false, w[1]))
      ], r),
      log: ['access via ' + finding.name.toLowerCase() + ' on ' + targetIp + ':' + finding.port, 'session established as ' + finding.user]
    });

    stages.push({
      phase: 'Foothold', skill: 'Command and control', title: 'Holding the foothold',
      brief: 'You are on the host as ' + finding.user + '. The connection dies the moment you close the terminal, and the edge firewall does not let anything in.',
      artifact: { label: '$ iptables -S OUTPUT   (from the host\'s own policy)', text: '-P OUTPUT DROP\n-A OUTPUT -o lo -j ACCEPT\n-A OUTPUT -p tcp --dport 443 -j ACCEPT\n-A OUTPUT -p tcp --dport 80 -j ACCEPT\n\n# edge: inbound connections to this host are dropped' },
      prompt: 'Which channel will actually get you a stable session?',
      hint: 'Only one direction of traffic is allowed out, and only two ports are open in it.',
      teach: 'A foothold is only a foothold if traffic can leave and come back. Egress rules decide your channel, not your payload.',
      options: shuffle(FOOTHOLD_OPTS.map(o => opt(o[0], o[1], o[2])), r),
      log: ['egress check: 443 only', 'session upgraded and held over HTTPS']
    });

    const esc = ESCALATIONS[r(ESCALATIONS.length)];
    const escTyped = !!esc.typed && r(3) === 0;
    stages.push({
      phase: 'Privilege escalation', skill: 'Privilege escalation', title: 'Privilege escalation',
      brief: 'You are a service account with almost no rights. Enumeration first, then one clean step up.',
      artifact: { label: '$ enumeration on the host', text: esc.artifact.join('\n') },
      prompt: escTyped ? esc.typedPrompt : esc.prompt,
      hint: 'The policy or permission in front of you is the answer. You do not need an exploit for the kernel.',
      teach: esc.teach,
      options: escTyped ? undefined : shuffle([
        opt(esc.good, true, esc.why),
        opt(esc.bad, false, esc.badWhy),
        ...shuffle(BAD_ESC, r).slice(0, 2).map(w => opt(w[0], false, w[1]))
      ], r),
      input: escTyped ? { placeholder: 'Type the name', answer: esc.typed, hint: 'It is in the output above, next to the risky permission.' } : undefined,
      log: ['privilege escalation: ' + esc.title.toLowerCase()],
      penalty: 16
    });

    stages.push({
      phase: 'Credential access', skill: 'Credential access', title: 'Finding the keys',
      brief: 'Root on one web host is not the objective. The estate is joined by credentials, and configuration files are where they leak — usually one encoding away from plain sight.',
      artifact: { label: '$ cat /var/www/app/.env.b64', text: wrap(loot.envB64) },
      prompt: 'The application config is Base64 encoded. Type the database password inside it.',
      hint: 'Open the 🖥 shell and run: base64 -d /var/www/app/.env.b64 | grep DB_PASSWORD',
      teach: 'Base64 is an encoding, not encryption: it hides nothing from anyone who looks. Configs are full of both real secrets and placeholders like CHANGEME, and the shell decodes them in one pipe.',
      input: { placeholder: 'Type the decoded password', answer: [loot.dbPass], hint: 'Pipe the file through base64 -d, then read the DB_PASSWORD line (SMTP_PASSWORD is a placeholder).' },
      log: ['read /var/www/app/.env.b64', 'base64 -d recovered the database credential'],
      penalty: 14
    });

    const dbIp = ip(r, 8, 14), appIp = ip(r, 8, 14), wsIp = ip(r, 8, 14);
    const hostRows = [
      { ip: dbIp, name: 'db01', role: 'PostgreSQL primary — holds ' + sc.asset, correct: true },
      { ip: appIp, name: 'app02', role: 'internal application server', correct: false },
      { ip: wsIp, name: 'ws-114', role: 'analyst workstation', correct: false }
    ].sort((a, b) => a.ip.localeCompare(b.ip));
    stages.push({
      phase: 'Lateral movement', skill: 'Lateral movement', title: 'Lateral movement',
      brief: 'The database is not on this host. The internal network is reachable from here and nothing is segmented.',
      artifact: { label: '$ cat /etc/hosts && ss -tn', text: '# internal inventory\n' + hostRows.map(h => h.ip + '  ' + h.name + '.' + sc.domain + '  ' + h.name + '    # ' + h.role).join('\n') + '\n\nState  Recv-Q  Send-Q  Local Address:Port\nESTAB  0       0       10.' + targetIp.split('.')[1] + '.12.20:47812   10.' + targetIp.split('.')[1] + '.8.11:5432' },
      prompt: 'Where do you go next, and how?',
      hint: 'The objective is the asset named in the dossier, and you already hold a credential for it.',
      teach: 'Lateral movement follows the objective, not curiosity. The quiet route reuses a credential you already hold over a channel you are already using.',
      options: shuffle([
        opt('SSH to db01.' + sc.domain + ' with the database password and read the objective over that session.', true, 'One credential, one new host, no scanning. That is the shortest quiet path to the asset named in scope.'),
        opt('RDP to app02.' + sc.domain + ' using the same credentials and browse from there.', false, 'You have no evidence that account works there, and an interactive desktop is far noisier than an SSH session.'),
        opt('Scan the whole 10.0.0.0/8 for open databases first.', false, 'A /8 sweep is thousands of connections and the single fastest way to be detected.'),
        opt('Pivot to ws-114 and read the analyst\'s browser profile.', false, 'Interesting, but it is not the objective and it exposes personal data outside scope.')
      ], r),
      log: ['pivot to db01.' + sc.domain + ' over the existing tunnel'],
      penalty: 16
    });

    stages.push({
      phase: 'Evidence handling', skill: 'Encoding and evidence', title: 'Decoding the record',
      brief: 'Before you copy anything, prove you have the right record. The export index was stored as hex, the way logs and malware often keep strings unreadable to a casual eye.',
      artifact: { label: '$ cat /tmp/loot.hex', text: wrap(loot.hex, 48) },
      prompt: 'Decode the hex and type the record identifier it contains.',
      hint: 'In the 🖥 shell: xxd -r /tmp/loot.hex   (or read the pairs by hand — every two hex digits are one character).',
      teach: 'Hex is two digits per byte, Base64 is 6 bits per character: both are reversible by anyone, and both show up in logs, keys and payloads. xxd -r and base64 -d turn them back into text.',
      input: { placeholder: 'Type the record id', answer: [loot.recordId], hint: 'xxd -r /tmp/loot.hex prints a RECORD= line; the identifier starts with REC-.' },
      log: ['xxd -r /tmp/loot.hex', 'record identifier ' + loot.recordId + ' confirmed'],
      penalty: 14
    });

    const exfil = r(2) === 1;
    stages.push({
      phase: 'Objective', skill: 'Objective and reporting', title: 'Objective',
      brief: exfil ? 'You are on the database host as the service account. The client asked for ' + sc.objective + ' — and for a report of how you got there.' : 'You are on the database host. This engagement is proof-of-access only: the data stays where it is.',
      artifact: { label: '$ psql -h db01 -U svc_billing -d ' + sc.asset.replace(/\s+/g, '_'), text: 'psql (15.4)\nType "help" for help.\n\n' + sc.asset.replace(/\s+/g, '_') + '=> SELECT count(*) FROM records;\n count\n-------\n 8412\n(1 row)\n\n' + sc.asset.replace(/\s+/g, '_') + '=> ' },
      prompt: 'How do you close this out?',
      hint: 'Rules of engagement: minimum necessary, nothing destructive, evidence you can defend in a report.',
      teach: exfil ? 'Exfiltration in a scoped test means the minimum data needed, a channel you already control, and cleanup. Public hosts and destructive actions are how engagements become incidents.' : 'Proof of access is often the whole job. Capturing evidence and leaving the environment as you found it is the professional result.',
      options: shuffle(exfil ? [
        opt('Copy only the requested records over the SSH tunnel you already hold, verify the hash, then delete the copy you left in /tmp.', true, 'Minimum data, known channel, cleanup. That is the engagement completed as scoped.'),
        opt('Upload the whole database to a public file-sharing site so the client can look at it later.', false, 'Out of scope, a second breach, and the data is now uncontrolled.'),
        opt('Encrypt the database and leave a note about the finding.', false, 'Destructive and out of scope: that is ransomware, not a test.'),
        opt('Delete the authentication logs on the way out to cover the trail.', false, 'Destroying evidence breaks the engagement and blinds the defenders you are supposed to help.')
      ] : [
        opt('Capture `hostname; id` and a row count as proof, leave the data in place and close the tunnel.', true, 'Enough evidence to prove access, no data moved, and the estate is left as found.'),
        opt('Create a new root account so the team can come back later.', false, 'An unrequested backdoor is destructive to trust and a real risk if it is forgotten.'),
        opt('Copy the whole database to your own host to be safe.', false, 'The engagement said proof only; moving the data is a reportable breach.'),
        opt('Turn off the host firewall so the tunnel stays open.', false, 'You would leave the estate weaker than you found it, and it is exactly what an intruder does.')
      ], r),
      log: exfil ? ['exported ' + sc.objective + ' over the tunnel', 'cleaned up temporary files'] : ['proof of access captured', 'session closed, no data moved'],
      penalty: 18
    });

    const meta = { targetIp, attacker, account: finding.user, service: finding.name, port: finding.port, dbIp, dbName: sc.asset.replace(/\s+/g, '_'), exfil, escalation: esc, first: null };
    return { stages, meta };
  }

  /* ---------------------------------------------------------------- the blue response */
  function buildBlue(r, sc, finding, meta, red, level) {
    const scanRow = red[0].log[0];
    const authRow = red[1].log[0];
    const holdRow = red[2].log[0];
    const escRow = red[3].log[0];
    const benign = [
      [ '02:10:04', 'cron: nightly database snapshot completed (1.9 GB)' ],
      [ '02:40:00', 'monitor: disk usage on app02 at 71% (warning threshold 85%)' ],
      [ '06:05:12', 'helpdesk: password reset completed for m.okafor' ]
    ];
    const feed = shuffle([
      [ '', scanRow ],
      [ '', authRow ],
      [ '', holdRow ],
      [ '', escRow ],
      ...benign.map(b => [b[0], b[1]])
    ], r);
    const feedText = feed.map(x => (x[0] ? x[0] + '  ' : '') + x[1]).join('\n');

    const decoyAccounts = [
      { name: 'backup', why: 'The backup account signed in from an internal host on its normal schedule; nothing ties it to the intrusion.' },
      { name: 'svc_monitor', why: 'A monitoring account doing monitoring is expected. It is a decoy, not the intruder.' },
      { name: 'j.smith', why: 'A workstation login from a staff subnet is ordinary; it has no link to the compromised host.' }
    ].filter(a => a.name !== meta.account);
    const stages = [];
    stages.push({
      phase: 'Triage', skill: 'Detection', title: 'First sign',
      brief: 'You are on the SOC shift the morning after. One host is suspected, nothing is confirmed, and the alert queue is noisy.',
      artifact: { label: 'SIEM · last 24 hours (sample)', text: feedText },
      prompt: 'Which event is the first sign of the intrusion?',
      hint: 'An intrusion starts before it succeeds. Look for the earliest event that has no business reason.',
      teach: 'Triage is about the earliest unexplained event. The successful login is the consequence; the reconnaissance scan is the first chance you had to notice.',
      options: shuffle([
        opt(scanRow + ' — the external scan of the perimeter', true, 'That scan is the first contact: it is the earliest event with no business purpose, and it is where detection should have fired.'),
        opt(authRow + ' — the authentication event', false, 'This is the intrusion succeeding. Investigating it is right, but it is not the first sign.'),
        opt(holdRow + ' — the outbound session', false, 'Later still: by the time this fired the attacker already had a shell.'),
        opt('cron: nightly database snapshot completed (1.9 GB)', false, 'A scheduled backup is expected activity, not an indicator.')
      ], r),
      log: ['triage: perimeter scan identified as first contact'],
      penalty: 14
    });

    stages.push({
      phase: 'Scoping', skill: 'Incident scoping', title: 'Who is compromised',
      brief: 'Before you contain anything you need to know which identity the intruder is using, or you will lock out the wrong team.',
      artifact: { label: 'Authentication log · web01', text: '06:12:44  ' + meta.account + '  login success  ' + meta.targetIp + '\n06:20:01  ' + meta.account + '  privilege change  sudo\n06:41:19  backup  login success  10.40.0.9\n06:44:02  svc_monitor  login success  10.40.0.7\n06:55:31  j.smith  login success  10.40.66.14' },
      prompt: 'Which account did the intruder use?',
      hint: 'Match the account to the service named in the alert, not to whoever logged in most recently.',
      teach: 'Scope by evidence. The account on the compromised service, with the sessions that follow the alert, is the one to revoke and rotate.',
      options: shuffle([
        opt(meta.account, true, 'That is the account on the compromised service, and its session lines up with the rest of the chain.'),
        ...decoyAccounts.map(a => opt(a.name, false, a.why))
      ], r),
      log: ['scope: ' + meta.account + ' confirmed compromised'],
      penalty: 16
    });

    stages.push({
      phase: 'Containment', skill: 'Containment', title: 'Containment',
      brief: 'The host is still running and the intruder may still be there. The client wants the spread stopped without destroying your evidence.',
      artifact: { label: 'Decision point', text: 'Host: web01 (production, one of three web nodes)\nData: ' + sc.asset + ' on db01\nOpen question: is the intruder still connected?' },
      prompt: 'What do you do first?',
      hint: 'Contain the identity and the network path, and keep the evidence. Rebuilding comes later.',
      teach: 'Containment is network isolation plus credential revocation, with volatile evidence preserved. Rebooting or reimaging destroys the very evidence you need.',
      options: shuffle([
        opt('Isolate web01 at the network layer, revoke the active sessions and rotate the credentials it could reach, keeping disk and memory for the investigation.', true, 'This stops the spread and the identity at the same time, and preserves the host state you will need.'),
        opt('Reboot web01 and reimage it from the golden image straight away.', false, 'Fast, but it destroys volatile evidence and tells you nothing about how they got in.'),
        opt('Block the attacker IP at the edge and leave the host running.', false, 'They are already inside and can pivot internally; one blocked IP changes nothing.'),
        opt('Disable every account in the directory until Monday.', false, 'That is a business outage, not containment, and the intruder keeps the session they already have.')
      ], r),
      log: ['containment: host isolated, sessions revoked, credentials rotated'],
      penalty: 18
    });

    stages.push({
      phase: 'Eradication', skill: 'Root cause', title: 'Root cause',
      brief: 'The host is contained. Now close the way in, or the next scan walks through the same door.',
      artifact: { label: 'Finding from the incident review', text: meta.service + ' on ' + meta.targetIp + ':' + meta.port + '\n' + finding.detail },
      prompt: 'What actually has to change?',
      hint: 'Fix the exposure that let them in, not just the symptom you saw.',
      teach: 'Eradication means removing the root cause and every credential or implant that came from it. A WAF rule in front of an open service is theatre.',
      options: shuffle([
        opt('Disable or patch the exposed ' + meta.service + ', remove the default or weak credential, and rotate everything it could reach.', true, 'That closes the actual door and invalidates what the intruder gained from it.'),
        opt('Add a WAF rule in front of the site and leave the service as it is.', false, 'The service still answers on the same port; a rule is not a patch and does not remove the credential.'),
        opt('Change the one password that was used and close the ticket.', false, 'The exposure remains, so the next attempt succeeds with the same technique.'),
        opt('Block the attacker IP range at the edge and call it fixed.', false, 'IP blocking is temporary and trivially bypassed; the vulnerable service is still exposed.')
      ], r),
      log: ['eradication: exposure disabled, credentials rotated'],
      penalty: 16
    });

    stages.push({
      phase: 'Recovery', skill: 'Recovery and reporting', title: 'Recovery and report',
      brief: 'The door is closed. The client needs the service back, and they need to be able to explain what happened.',
      artifact: { label: 'Open items', text: 'web01 — contained, evidence preserved\n' + sc.asset + ' — integrity unknown\nclient — waiting for a timeline\nregulator — notification window 72 hours' },
      prompt: 'How do you finish the incident?',
      hint: 'Recover to a known-good state, verify it, and write it down. Notification is part of the job.',
      teach: 'Recovery restores from a trusted state and verifies integrity before returning to service; the report is the deliverable that stops it happening again.',
      options: shuffle([
        opt('Restore web01 from a known-good image, verify the data on db01, then write the timeline and notify the client.', true, 'Known-good restore, verification and an honest report: the incident is closed properly.'),
        opt('Reimage the host now and skip the report — the incident is over.', false, 'No timeline, no root-cause evidence, and the same exposure returns next month.'),
        opt('Delete the compromised account and keep the host running as-is.', false, 'You have removed the evidence and left the compromise in place.'),
        opt('Wait a week to see whether the attacker comes back before telling anyone.', false, 'Notification windows are legal deadlines, and a week of silence is a second failure.')
      ], r),
      log: ['recovery: known-good restore verified, incident report filed'],
      penalty: 18
    });

    return stages;
  }

  /* ---------------------------------------------------------------- the attacker's shell
     A small, real command interpreter over a seeded filesystem: the files a red team actually
     reads, the encodings they actually peel, and enough of bash (pipes, chaining, quoting) to
     work the estate. Nothing leaves the page. */
  const isDir = n => n && typeof n === 'object' && !('text' in n);
  const isFileNode = n => n != null && (typeof n === 'string' || (typeof n === 'object' && 'text' in n));
  const textOf = n => typeof n === 'string' ? n : n.text;
  const Unix = typeof module !== 'undefined' && module.exports ? require('./terminal-unix.js') : TerminalUnix;
  const modeOf = n => Unix.octal(Unix.mode(n, isDir(n)));
  const noRead = n => isFileNode(n) && !(Unix.mode(n) & 0o400);

  function makeLoot(r, sc, finding) {
    const dbPass = ['Vh7', 'Tram', 'Kilo', 'Orbit', 'Slate', 'Amber'][r(6)] + '-' +
      ['Kestrel', 'Harbor', 'Ridge', 'Copper', 'Falcon'][r(5)] + '-' + (1000 + r(9000));
    const recordId = 'REC-' + (1000 + r(9000)) + '-' + sc.org.slice(0, 4).toUpperCase();
    const env = [
      'APP_ENV=production',
      'APP_KEY=base64:' + (dbPass.toLowerCase().replace(/-/g, '') + 'Q2xhdmU=').slice(0, 20),
      'DB_HOST=db01.' + sc.domain,
      'DB_PORT=5432',
      'DB_DATABASE=' + sc.asset.replace(/\s+/g, '_'),
      'DB_USERNAME=svc_billing',
      'DB_PASSWORD=' + dbPass,
      'SMTP_HOST=smtp.' + sc.domain,
      'SMTP_PASSWORD=CHANGEME',
      'SENTRY_DSN=https://key@o0.ingest.example/42'
    ].join('\n');
    return {
      dbPass, recordId,
      env,
      envB64: b64(env),
      hex: hexOf('RECORD=' + recordId + '\nCUSTODY=' + sc.org + '-ops\n')
    };
  }

  function makeShell(sc, finding, meta, loot) {
    const user = finding.user === 'root' ? 'root' : finding.user;
    const host = 'web01';
    const home = user === 'root' ? ['root'] : ['home', user];
    const escId = meta.escalation ? meta.escalation.id : '';
    const homeTree = {
      '.bash_history': { mode: '600', text: ['ls -la', 'cat /var/www/app/.env', 'base64 -w0 /var/www/app/.env > .env.b64', 'sudo -l', 'exit'].join('\n') },
      'notes.txt': { mode: '644', text: 'web01 build notes\n- the app lives in /var/www/app\n- backups run from /opt/backup/run.sh every 5 minutes\n- records sit on db01.' + sc.domain },
      '.ssh': { 'id_rsa': { mode: '600', text: '-----BEGIN OPENSSH PRACTICE KEY-----\nb3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAABlwAAAAdzc2gtcn\nNhAAAAAwEAAQAAAYEA0Kk7f8yQ2m4dQm9vZGhyb3VkZW1vMTIzNDU2Nzg5MGFiY2RlZg\n-----END OPENSSH PRACTICE KEY-----' } }   // practice key in a simulated home folder: never a real one
    };
    const tree = {
      etc: {
        'passwd': { mode: '644', text: ['root:x:0:0:root:/root:/bin/bash', 'daemon:x:1:1:daemon:/usr/sbin:/usr/sbin/nologin', 'www-data:x:33:33:www-data:/var/www:/usr/sbin/nologin', 'svc_deploy:x:1001:1001::/home/svc_deploy:/bin/bash', 'svc_billing:x:1002:1002::/home/svc_billing:/bin/bash'].join('\n') },
        'hosts': { mode: '644', text: ['127.0.0.1 localhost', '10.40.12.20 web01.' + sc.domain + ' web01', '10.40.8.11 db01.' + sc.domain + ' db01', '10.40.8.12 app02.' + sc.domain + ' app02'].join('\n') },
        'shadow': { mode: '000', text: 'root:$6$rounds=5000$fakehash$notarealhash:19000:0:99999:7:::' },
        'sudoers.d': { 'deploy': { mode: '440', text: escId === 'sudo-find' ? 'www-data ALL=(ALL) NOPASSWD: /usr/bin/find' : 'www-data ALL=(ALL) !ALL' } },
        'cron.d': { 'nightly': { mode: '644', text: '*/5 * * * * root /opt/backup/run.sh' } }
      },
      var: {
        www: { app: {
          '.env.b64': { mode: '644', text: wrap(loot.envB64) },
          'index.php': { mode: '644', text: '<?php\nrequire __DIR__ . "/bootstrap.php";\necho $router->handle($_SERVER["REQUEST_URI"]);\n' },
          'config.php': { mode: '644', text: '<?php\n// database settings come from the environment\nreturn require __DIR__ . "/bootstrap.php";\n' },
          'uploads': {}
        } },
        log: {
          'auth.log': { mode: '640', text: [
            '06:02:11 web01 sshd[2211]: Accepted publickey for backup from 10.40.0.9 port 44212',
            '06:12:44 web01 sshd[2317]: Accepted password for ' + meta.account + ' from ' + meta.targetIp + ' port 51234',
            '06:19:58 web01 sudo: ' + meta.account + ' : TTY=pts/0 ; PWD=/var/www/app ; USER=root ; COMMAND=/usr/bin/find . -exec /bin/sh -p \\; -quit',
            '06:41:19 web01 sshd[2409]: Accepted password for backup from 10.40.0.9 port 44310',
            '06:55:31 web01 sshd[2511]: Failed password for j.smith from 10.40.66.14 port 52110 ssh2'
          ].join('\n') },
          'access.log': { mode: '644', text: ['10.40.66.14 - - [12/Feb/2026:06:41:02] "GET /login HTTP/1.1" 200 4211', meta.targetIp + ' - - [12/Feb/2026:06:12:40] "POST /login HTTP/1.1" 302 0', meta.targetIp + ' - - [12/Feb/2026:06:20:11] "GET /admin/users HTTP/1.1" 200 88120'].join('\n') }
        }
      },
      opt: { backup: { 'run.sh': { mode: '777', text: '#!/bin/sh\nset -e\ntar -czf /srv/backups/app.tgz /var/www/app\necho "backup complete"\n' } } },
      srv: { exports: { 'records.csv': { mode: '644', text: ['id,status,amount', 'REC-1042-ATLA,paid,120.00', 'REC-1077-MERI,refunded,32.50', 'REC-1183-KEST,pending,88.10', 'REC-1204-FERN,paid,410.00', 'REC-1290-VANT,refunded,19.99'].join('\n') } }, backups: {} },
      tmp: { 'loot.hex': { mode: '644', text: wrap(loot.hex, 48) }, staging: {} }
    };
    if (user === 'root') tree.root = homeTree; else tree.home = { [user]: homeTree };

    let cwd = home.slice(), prevCwd = null;
    const hist = [];
    const path = () => '/' + cwd.join('/');
    const disp = () => { const hp = '/' + home.join('/'), p = path(); return p === hp ? '~' : p.startsWith(hp + '/') ? '~' + p.slice(hp.length) : p; };
    const prompt = () => user + '@' + host + ':' + disp() + '$ ';
    const walk = parts => { let n = tree; for (const s of parts) { if (!isDir(n) || !Object.hasOwn(n, s)) return undefined; n = n[s]; } return n; };
    const resolve = p => {
      if (!p || p === '~') return home.slice();
      if (p.startsWith('~/')) p = '/' + home.join('/') + p.slice(1);
      const parts = p.startsWith('/') ? [] : cwd.slice();
      for (const s of p.split('/')) { if (!s || s === '.') continue; if (s === '..') parts.pop(); else parts.push(s); }
      return parts;
    };
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
    const globRe = g => new RegExp('^' + g.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.') + '$', 'i');
    const listWalk = (node, base, re, type, res) => {
      for (const k of Object.keys(node).sort()) {
        const p = base + '/' + k, dir = isDir(node[k]);
        if ((!type || (type === 'd' && dir) || (type === 'f' && !dir)) && (!re || re.test(k))) res.push(p);
        if (dir) listWalk(node[k], p, re, type, res);
      }
      return res;
    };
    const readPath = arg => {
      const n = walk(resolve(arg));
      if (n === undefined) return { err: arg + ': No such file or directory' };
      if (isDir(n)) return { err: arg + ': Is a directory' };
      if (noRead(n)) return { err: arg + ': Permission denied' };
      return { text: textOf(n) };
    };
    const readArgOrText = (args, stdin) => {
      if (!args.length) return { text: stdin == null ? '' : stdin };
      const n = walk(resolve(args[0]));
      if (n !== undefined) return readPath(args[0]);
      return { text: args.join(' ') };
    };
    const srcOf = (args, stdin) => {
      if (args.length) return readPath(args[0]);
      if (stdin != null) return { text: stdin };
      return { err: 'usage: expected a file or piped input' };
    };
    const lines = (t, f) => String(t == null ? '' : t).split('\n').map((l, i) => f(l, i));
    const cmds = {
      help: () => ({ out: 'bash (remote-access sandbox) — supported built-ins\n\n  files      ls -la · cd · pwd · tree · cat · head · tail · stat · file\n  search     grep -inrvc · find -name/-iname · strings · wc -l\n  decode     base64 -d · xxd [-r] · rot13 · rev\n  text       sort -rnu · uniq -cu · cut -d: -f1 · tr a-z A-Z · echo\n  access     chmod u+r|644|000 · sudo -l · ssh <host> · id · whoami\n  system     uname -a · hostname · env · ps aux · ss · date · history · clear\n\nPipes and chaining work: cat .env.b64 | base64 -d | grep DB_PASSWORD' }),
      pwd: () => ({ out: path() }),
      whoami: () => ({ out: user }),
      id: () => ({ out: 'uid=1000(' + user + ') gid=1000(' + user + ') groups=1000(' + user + ')' + (escId === 'docker-group' ? ',999(docker)' : '') }),
      hostname: () => ({ out: host + '.' + sc.domain }),
      uname: a => ({ out: a.includes('-a') ? 'Linux ' + host + ' 5.15.0-91-generic #101-Ubuntu SMP x86_64 GNU/Linux' : 'Linux' }),
      date: () => ({ out: 'Thu Feb 12 06:58:12 UTC 2026' }),
      history: () => ({ out: hist.map((h, i) => String(i + 1).padStart(3) + '  ' + h).join('\n') }),
      clear: () => ({ out: '', clear: true }),
      echo: a => ({ out: a.join(' ') }),
      ls: a => {
        let flags = '', targets = [];
        for (const x of a) { if (x.startsWith('-') && x.length > 1) flags += x.slice(1); else targets.push(x); }
        if (!targets.length) targets = ['.'];
        const long = flags.includes('l'), all = flags.includes('a');
        const outs = [];
        for (const t of targets) {
          const n = walk(resolve(t));
          if (n === undefined) { outs.push('ls: cannot access \'' + t + '\': No such file or directory'); continue; }
          if (!isDir(n)) { outs.push(long ? Unix.permissions(n) + ' 1 ' + user + ' ' + user + ' ' + textOf(n).length + ' ' + t : t); continue; }
          const names = Object.keys(n).filter(k => all || k[0] !== '.').sort();
          if (!names.length) { outs.push('total 0'); continue; }
          if (long) outs.push('total ' + names.length, ...names.map(k => {
            const c = n[k], d = isDir(c), m = Unix.permissions(c, d);
            return m + ' 1 ' + user + ' ' + user + ' ' + String(d ? 4096 : textOf(c).length).padStart(6) + ' Feb 12 06:1' + (k.length % 6) + ' ' + k + (d ? '/' : '');
          }));
          else outs.push(names.map(k => k + (isDir(n[k]) ? '/' : '')).join('   '));
        }
        return { out: outs.join('\n') };
      },
      cd: a => {
        const t = a[0] || '~';
        const p = t === '-' ? prevCwd : resolve(t);
        if (!p) return { out: 'cd: OLDPWD not set' };
        const n = walk(p);
        if (n === undefined) return { out: 'cd: ' + t + ': No such file or directory' };
        if (!isDir(n)) return { out: 'cd: ' + t + ': Not a directory' };
        prevCwd = cwd.slice(); cwd = p;
        return { out: t === '-' ? path() : '' };
      },
      tree: a => {
        const t = a.find(x => !x.startsWith('-')) || '.';
        const n = walk(resolve(t));
        if (!isDir(n)) return { out: t === '.' ? '.' : t + ': No such file or directory' };
        const rows = [t];
        const walkTree = (node, prefix, depth) => {
          const keys = Object.keys(node).filter(k => k[0] !== '.').sort();
          keys.forEach((k, i) => { const last = i === keys.length - 1; rows.push(prefix + (last ? '`-- ' : '|-- ') + k + (isDir(node[k]) ? '/' : '')); if (isDir(node[k]) && depth < 3) walkTree(node[k], prefix + (last ? '    ' : '|   '), depth + 1); });
        };
        walkTree(n, '', 0);
        return { out: rows.join('\n') };
      },
      cat: (a, stdin) => {
        if (!a.length) return stdin == null ? { out: 'usage: cat <file>', code: 1 } : { out: stdin };
        const outs = [];
        for (const f of a) { const r = readPath(f); if (r.err) return { out: 'cat: ' + r.err, code: 1 }; outs.push(r.text); }
        return { out: outs.join('\n') };
      },
      head: (a, stdin) => {
        let n = 10; const files = [];
        for (let i = 0; i < a.length; i++) { const x = a[i]; if (x === '-n') n = +a[++i] || 10; else if (/^-\d+$/.test(x)) n = +x.slice(1); else if (/^\d+$/.test(x)) n = +x; else files.push(x); }
        const r = srcOf(files, stdin); if (r.err) return { out: 'head: ' + r.err };
        return { out: String(r.text).split('\n').slice(0, n).join('\n') };
      },
      tail: (a, stdin) => {
        let n = 10; const files = [];
        for (let i = 0; i < a.length; i++) { const x = a[i]; if (x === '-n') n = +a[++i] || 10; else if (/^-\d+$/.test(x)) n = +x.slice(1); else if (/^\d+$/.test(x)) n = +x; else files.push(x); }
        const r = srcOf(files, stdin); if (r.err) return { out: 'tail: ' + r.err };
        return { out: String(r.text).split('\n').slice(-n).join('\n') };
      },
      grep: (a, stdin) => {
        let flags = ''; const rest = [];
        for (const x of a) { if (x.startsWith('-') && x.length > 1) flags += x.slice(1); else rest.push(x); }
        const pat = rest.shift();
        if (pat == null) return { out: 'usage: grep [-inrvc] <pattern> [file...]' };
        let re; try { re = new RegExp(pat, flags.includes('i') ? 'i' : ''); } catch (e) { return { out: 'grep: invalid pattern' }; }
        const hits = [];
        const scan = (txt, label) => lines(txt, (l, i) => {
          const ok = re.test(l) !== flags.includes('v');
          if (ok) hits.push((label ? label + ':' : '') + (flags.includes('n') ? (i + 1) + ':' : '') + l);
        });
        if (!rest.length) { if (stdin == null) return { out: 'usage: grep [-inrvc] <pattern> [file...]' }; scan(stdin, ''); }
        else for (const f of rest) {
          const n = walk(resolve(f));
          if (n === undefined) return { out: 'grep: ' + f + ': No such file or directory' };
          if (isDir(n)) {
            if (!flags.includes('r')) return { out: 'grep: ' + f + ': Is a directory' };
            for (const p of listWalk(n, f, null, 'f', [])) { const r = readPath(p); if (!r.err) scan(r.text, p); }
          } else { if (noRead(n)) return { out: 'grep: ' + f + ': Permission denied' }; scan(textOf(n), f); }
        }
        if (flags.includes('c')) return { out: String(hits.length) };
        return { out: hits.join('\n') };
      },
      find: a => {
        let start = '.', name = null, type = null, icase = false;
        for (let i = 0; i < a.length; i++) {
          const x = a[i];
          if (x === '-name' || x === '-iname') { name = a[++i]; icase = x === '-iname'; }
          else if (x === '-type') type = a[++i];
          else if (!x.startsWith('-')) start = x;
        }
        const n = walk(resolve(start));
        if (!isDir(n)) return { out: 'find: \'' + start + '\': No such file or directory' };
        const re = name ? globRe(name) : null;
        const hits = listWalk(n, start === '.' ? '.' : start, re, type, []);
        return { out: hits.join('\n') };
      },
      wc: (a, stdin) => {
        const wantL = a.includes('-l') || !a.some(x => x.startsWith('-'));
        const files = a.filter(x => !x.startsWith('-'));
        const r = srcOf(files, stdin); if (r.err) return { out: 'wc: ' + r.err };
        return { out: String(String(r.text).split('\n').length) };
      },
      strings: (a, stdin) => {
        const r = srcOf(a, stdin); if (r.err) return { out: 'strings: ' + r.err };
        return { out: (String(r.text).match(/[ -~]{4,}/g) || []).join('\n') };
      },
      file: a => {
        const n = walk(resolve(a[0] || '.'));
        if (n === undefined) return { out: a[0] + ': cannot open' };
        if (isDir(n)) return { out: a[0] + ': directory' };
        const t = textOf(n);
        return { out: a[0] + ': ' + (/^\s*<\?php/.test(t) ? 'PHP script, ASCII text' : /^#!/.test(t) ? 'POSIX shell script, ASCII text executable' : /^[0-9a-f \n]+$/i.test(t) ? 'ASCII text (hex)' : 'ASCII text') };
      },
      stat: a => {
        const formatted = Unix.permissionStat(a, p => walk(resolve(p)), isDir);
        if (formatted) return formatted;
        const n = walk(resolve(a[0] || '.'));
        if (n === undefined) return { out: 'stat: cannot statx \'' + a[0] + '\': No such file or directory' };
        const size = isDir(n) ? 4096 : textOf(n).length;
        return { out: '  File: ' + (a[0] || '.') + '\n  Size: ' + size + '\tBlocks: 8\tIO Block: 4096\nAccess: (' + modeOf(n) + '/' + Unix.permissions(n, isDir(n)) + ')  Uid: ( 1000/' + user + ')' };
      },
      base64: (a, stdin) => {
        const dec = a.some(x => /^-(d|-decode|D)$/.test(x));
        const args = a.filter(x => !x.startsWith('-'));
        const r = readArgOrText(args, stdin);
        if (r.err) return { out: 'base64: ' + r.err };
        try {
          if (dec) return { out: atob(String(r.text).replace(/\s+/g, '')) };
          return { out: wrap(b64(String(r.text)), 76) };
        } catch (e) { return { out: 'base64: invalid input' }; }
      },
      xxd: (a, stdin) => {
        const dec = a.includes('-r');
        const args = a.filter(x => !x.startsWith('-'));
        const r = readArgOrText(args, stdin);
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
        const r = readArgOrText(a, stdin); if (r.err) return { out: 'rot13: ' + r.err };
        return { out: String(r.text).replace(/[a-z]/gi, c => String.fromCharCode((c <= 'Z' ? 65 : 97) + (c.charCodeAt(0) - (c <= 'Z' ? 65 : 97) + 13) % 26)) };
      },
      rev: (a, stdin) => {
        const r = readArgOrText(a, stdin); if (r.err) return { out: 'rev: ' + r.err };
        return { out: String(r.text).split('\n').map(l => [...l].reverse().join('')).join('\n') };
      },
      sort: (a, stdin) => {
        const flags = a.join(' '); const files = a.filter(x => !x.startsWith('-'));
        const r = srcOf(files, stdin); if (r.err) return { out: 'sort: ' + r.err };
        let l = String(r.text).split('\n');
        l.sort(flags.includes('n') ? (x, y) => parseFloat(x) - parseFloat(y) : undefined);
        if (flags.includes('r')) l.reverse();
        if (flags.includes('u')) l = l.filter((x, i) => i === 0 || x !== l[i - 1]);
        return { out: l.join('\n') };
      },
      uniq: (a, stdin) => {
        const flags = a.join(' '); const files = a.filter(x => !x.startsWith('-'));
        const r = srcOf(files, stdin); if (r.err) return { out: 'uniq: ' + r.err };
        const rows = []; let prev = null, n = 0;
        const flush = () => { if (prev === null) return; if (flags.includes('u') && n !== 1) return; if (flags.includes('d') && n < 2) return; rows.push((flags.includes('c') ? String(n).padStart(4) + ' ' : '') + prev); };
        for (const l of String(r.text).split('\n')) { if (l === prev) n++; else { flush(); prev = l; n = 1; } }
        flush();
        return { out: rows.join('\n') };
      },
      cut: (a, stdin) => {
        let d = '\t', f = 1; const files = [];
        for (let i = 0; i < a.length; i++) {
          const x = a[i];
          if (x === '-d' || x === '-f') { const v = a[++i]; if (x === '-d') d = v || '\t'; else f = parseInt(v, 10) || 1; }
          else if (/^-d./.test(x)) d = x.slice(2);
          else if (/^-f\d+/.test(x)) f = parseInt(x.slice(2), 10);
          else if (!x.startsWith('-')) files.push(x);
        }
        const r = srcOf(files, stdin); if (r.err) return { out: 'cut: ' + r.err };
        return { out: String(r.text).split('\n').map(l => l.split(d)[f - 1] || '').join('\n') };
      },
      tr: (a, stdin) => {
        const del = a.includes('-d');
        const sets = a.filter(x => !x.startsWith('-'));
        const expand = s => { let o = ''; for (let i = 0; i < s.length; i++) { if (i + 2 < s.length && s[i + 1] === '-') { for (let c = s.charCodeAt(i); c <= s.charCodeAt(i + 2); c++) o += String.fromCharCode(c); i += 2; } else o += s[i]; } return o; };
        if (stdin == null) return { out: 'tr: missing input (pipe something in)' };
        if (del) { const set = expand(sets[0] || ''); return { out: [...stdin].filter(c => !set.includes(c)).join('') }; }
        const from = expand(sets[0] || ''), to = expand(sets[1] || '');
        return { out: [...stdin].map(c => { const i = from.indexOf(c); return i >= 0 ? (to[i] || to[to.length - 1] || '') : c; }).join('') };
      },
      chmod: a => Unix.chmod(a, resolve, walk, isDir),
      sudo: a => {
        if (a.includes('-l')) return { out: (meta.escalation ? meta.escalation.artifact : ['Matching Defaults entries for ' + user + ':']).join('\n') };
        return { out: 'sudo: a password is required' };
      },
      ssh: a => {
        const t = a.find(x => !x.startsWith('-')) || '';
        if (t.includes('db01')) return { out: 'The authenticity of host \'' + t + '\' can\'t be established.\nConnected to ' + t + '.\n' + sc.asset + '=> \\q' };
        if (!t) return { out: 'usage: ssh user@host' };
        return { out: 'ssh: connect to host ' + t + ' port 22: Connection timed out' };
      },
      env: () => ({ out: ['SHELL=/bin/bash', 'USER=' + user, 'HOME=' + '/' + home.join('/'), 'PWD=' + path(), 'APP_ENV=production', 'DB_HOST=db01.' + sc.domain, 'DB_USER=svc_billing', 'SMTP_PASSWORD=CHANGEME'].join('\n') }),
      printenv: a => {
        const all = { SHELL: '/bin/bash', USER: user, HOME: '/' + home.join('/'), PWD: path(), DB_HOST: 'db01.' + sc.domain, DB_USER: 'svc_billing' };
        if (!a.length) return { out: Object.entries(all).map(([k, v]) => k + '=' + v).join('\n') };
        return { out: all[a[0]] == null ? '' : all[a[0]] };
      },
      ps: () => ({ out: ['  PID TTY          TIME CMD', '    1 ?        00:00:02 systemd', '  412 ?        00:00:00 sshd', '  518 ?        00:00:11 nginx', ' 2317 pts/0    00:00:00 bash', ' 2390 pts/0    00:00:00 ps'].join('\n') }),
      ss: () => ({ out: ['State  Recv-Q Send-Q Local Address:Port   Peer Address:Port', 'LISTEN 0      128    0.0.0.0:22            0.0.0.0:*', 'LISTEN 0      128    0.0.0.0:' + finding.port + '           0.0.0.0:*', 'ESTAB  0      0      10.40.12.20:47812     10.40.8.11:5432'].join('\n') }),
      netstat: () => cmds.ss()
    };
    cmds.ll = a => cmds.ls(['-la'].concat(a));
    cmds.la = a => cmds.ls(['-a'].concat(a));
    cmds.dir = a => cmds.ls(a);
    cmds.more = (a, s) => cmds.cat(a, s);
    cmds.less = (a, s) => cmds.cat(a, s);
    cmds.cls = () => ({ out: '' });
    cmds.clear = () => ({ out: '' });
    cmds.groups = () => ({ out: user + ' www-data' });
    cmds.uptime = () => ({ out: ' 06:58:12 up 19 days,  4:11,  1 user,  load average: 0.09, 0.07, 0.05' });
    cmds.df = () => ({ out: 'Filesystem      Size  Used Avail Use% Mounted on\n/dev/vda1        40G  9.4G   29G  25% /' });
    cmds.du = () => ({ out: '128K\t' + path() });
    cmds.free = () => ({ out: '               total        used        free\nMem:           3.9Gi       1.2Gi       2.1Gi' });
    cmds.ip = () => ({ out: '2: eth0: <UP> inet 10.40.12.20/24 brd 10.40.12.255 scope global eth0' });
    cmds.ifconfig = cmds.ip;
    cmds.arp = () => ({ out: '10.40.8.11 ether 52:54:00:9a:bc:de eth0' });
    cmds.ping = a => ({ out: '64 bytes from ' + (a.find(x => !x.startsWith('-')) || '10.40.8.11') + ': icmp_seq=1 ttl=64 time=0.4 ms' });
    cmds.dig = a => ({ out: ';; ANSWER SECTION:\n' + (a[0] || sc.domain) + '. 300 IN A 10.40.12.20' });
    cmds.nslookup = cmds.dig;
    cmds.host = a => ({ out: (a[0] || sc.domain) + ' has address 10.40.12.20' });
    cmds.whois = a => ({ out: 'Domain: ' + (a[0] || sc.domain) + ' · Org: ' + sc.name });
    cmds.curl = a => ({ out: 'HTTP/1.1 200 OK\n{"service":"' + sc.name + '","status":"ok"}' });
    cmds.wget = cmds.curl;
    cmds.nc = a => ({ out: 'Connection to ' + (a[0] || '10.40.8.11') + ' ' + (a[1] || '5432') + ' port [tcp/*] succeeded!' });
    cmds.nmap = a => ({ out: 'Nmap scan report for ' + (a.find(x => !x.startsWith('-')) || '10.40.12.20') + '\n22/tcp open ssh\n' + finding.port + '/tcp open ' + finding.name });
    cmds.which = a => ({ out: a.map(x => cmds[x] ? '/usr/bin/' + x : '').filter(Boolean).join('\n') });
    cmds.type = a => ({ out: a.map(x => cmds[x] ? x + ' is /usr/bin/' + x : 'bash: type: ' + x + ': not found').join('\n') });
    cmds.sed = (a, s) => { const sc2 = a.find(x => !x.startsWith('-')) || '', mm = sc2.match(/^s(.)(.*?)\1(.*?)\1([gi]*)$/); if (!mm) return { out: 'sed: try s/old/new/g' }; const r = srcOf(a.filter(x => x !== sc2 && !x.startsWith('-')), s); return r.err ? { out: 'sed: ' + r.err } : { out: r.text.split('\n').map(l => l.replace(new RegExp(mm[2], (mm[4].includes('g') ? 'g' : '') + (mm[4].includes('i') ? 'i' : '')), mm[3])).join('\n') }; };
    cmds.awk = (a, s) => { let sep = ' ', prog = '', files = []; for (let i = 0; i < a.length; i++) { if (a[i] === '-F') sep = a[++i] || ' '; else if (/^-F./.test(a[i])) sep = a[i].slice(2); else if (!prog && a[i].includes('{')) prog = a[i]; else if (!a[i].startsWith('-')) files.push(a[i]); } const mm = prog.match(/\{[\s]*print\s+([^}]+)\}/); if (!mm) return { out: 'awk: try {print $1, $2}' }; const flds = mm[1].split(',').map(x => x.trim()), r = srcOf(files, s); return r.err ? { out: 'awk: ' + r.err } : { out: r.text.split('\n').map(l => { const p = sep === ' ' ? l.trim().split(/\s+/) : l.split(sep); return flds.map(f => f === '$0' ? l : /^\$\d+$/.test(f) ? (p[+f.slice(1) - 1] || '') : f.replace(/^"|"$/g, '')).join(' '); }).join('\n') }; };
    cmds.nl = (a, s) => { const r = srcOf(a.filter(x => !x.startsWith('-')), s); return r.err ? { out: 'nl: ' + r.err } : { out: r.text.split('\n').map((l, i) => String(i + 1).padStart(6) + '\t' + l).join('\n') }; };
    cmds.tac = (a, s) => { const r = srcOf(a.filter(x => !x.startsWith('-')), s); return r.err ? { out: 'tac: ' + r.err } : { out: r.text.split('\n').reverse().join('\n') }; };
    cmds.hexdump = (a, s) => cmds.xxd(a.filter(x => x !== '-C'), s);
    cmds.od = (a, s) => cmds.xxd(a, s);
    cmds.md5sum = Unix.checksum('md5', readPath);
    cmds.sha256sum = Unix.checksum('sha256', readPath);
    cmds.basename = a => ({ out: String(a[0] || '').split('/').pop() || '/' });
    cmds.dirname = a => ({ out: String(a[0] || '').split('/').slice(0, -1).join('/') || '.' });
    cmds.true = () => ({ out: '' });
    cmds.false = () => ({ out: '' });
    cmds.sleep = () => ({ out: '' });
    cmds.man = a => a[0] ? cmds.help([a[0]]) : cmds.help();

    function run(line) {
      const raw = String(line == null ? '' : line).trim();
      if (!raw) return '';
      hist.push(raw);
      if (raw === 'clear') return '';
      const outs = [];
      for (const part of raw.split(/;|&&/).map(s => s.trim()).filter(Boolean)) {
        let stdin = null, out = '', failed = false;
        for (const pipe of part.split('|').map(s => s.trim()).filter(Boolean)) {
          const listDir = dir => { const n = walk(resolve(dir)); return isDir(n) ? Object.keys(n) : []; };
          const TP = typeof window !== 'undefined' && window.TerminalPlayground;
          const words = TP && TP.expandShellWords ? TP.expandShellWords(pipe, listDir) : tokenize(pipe);
          const name = words.shift();
          const fn = cmds[name];
          if (!fn) { out = 'bash: ' + name + ': command not found'; failed = true; break; }
          const r = fn(words, stdin) || { out: '' };
          out = r.out == null ? '' : r.out;
          stdin = out;
        }
        if (out !== '') outs.push(out);
      }
      return outs.join('\n');
    }

    return { user, host, prompt, run, tree, home: '/' + home.join('/') };
  }

  /* ---------------------------------------------------------------- public API */
  function generate(seed, mode, level) {
    const lv = levels[level] ? level : 'analyst';
    const r = random(seed);
    const sc = scenarios[r(scenarios.length)];
    const finding = FINDINGS[r(FINDINGS.length)];
    const loot = makeLoot(r, sc, finding);
    const red = buildRed(r, sc, finding, lv, loot);
    const blue = buildBlue(r, sc, finding, red.meta, red.stages, lv);
    const shell = makeShell(sc, finding, red.meta, loot);
    /* one clock for the whole chain, so the console and the SIEM agree */
    let t = occ(r);
    const stamp = (list) => list.map(text => {
      t += 60 + r(420);
      return { t: clock(t), text };
    });
    const all = red.stages.concat(blue);
    all.forEach(s => { s.log = stamp(s.log || []); });
    const first = red.stages[0].log[0];
    return {
      seed: seed >>> 0, mode: mode || 'red', level: lv,
      scenario: sc, finding, meta: red.meta,
      red: red.stages, blue, shell,
      firstEvent: first
    };
  }

  return { levels, scenarios, generate, norm };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = RemoteAccess;

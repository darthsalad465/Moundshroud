// Terminal Playground > 🖥 Pentest (remote) range: simulated access to the fictional PCs of a made-up company.
// Nothing here is real. Every host, user, share, password, file and flag is invented and lives in this page: no socket
// is opened, no network is used, and no machine outside the browser is touched. The workflow mirrors a real internal
// engagement (scan → enumerate → credentials → remote shell → desktop) so the habits transfer, on a range you are
// allowed to practise on. Never use techniques like these on a computer you do not own or have written permission to test.
(() => {
  const G = window.TerminalPlayground = window.TerminalPlayground || {};
  const COMPANY = 'Northwind Dental (fictional)';

  const HOSTS = [
    { ip: '10.20.30.1', name: 'gw-edge', os: 'Linux 5.4 (router)', ports: [[53, 'domain', 'dnsmasq 2.86'], [443, 'https', 'lighttpd 1.4.59']] },
    { ip: '10.20.30.21', name: 'WS-MAYA', os: 'Windows 10 Pro 22H2', ports: [[135, 'msrpc', 'Microsoft Windows RPC'], [139, 'netbios-ssn', 'Microsoft Windows netbios-ssn'], [445, 'microsoft-ds', 'Microsoft Windows SMB'], [3389, 'ms-wbt-server', 'Microsoft Terminal Services']] },
    { ip: '10.20.30.22', name: 'SRV-FILES', os: 'Windows Server 2019', ports: [[139, 'netbios-ssn', 'Microsoft Windows netbios-ssn'], [445, 'microsoft-ds', 'Microsoft Windows SMB'], [3389, 'ms-wbt-server', 'Microsoft Terminal Services'], [5985, 'wsman', 'Microsoft HTTPAPI httpd 2.0']] },
    { ip: '10.20.30.23', name: 'SRV-HELP', os: 'Ubuntu 22.04 (helpdesk)', ports: [[22, 'ssh', 'OpenSSH 8.9p1 Ubuntu'], [80, 'http', 'nginx 1.18.0'], [8080, 'http-proxy', 'OsTicket 1.17 (helpdesk)']] }
  ];

  const SHARES = { 'IPC$': 'Remote IPC', 'HR': 'HR records', 'IT': 'IT onboarding', 'Public': 'Shared documents' };
  const IT_FILES = {
    'onboarding.txt': 'IT onboarding — helpdesk\r\n\r\nTemporary password for the helpdesk account: Sunrise-2026!\r\nChange it at first logon. Desktop support uses the same account on WS-MAYA and SRV-FILES.\r\n',
    'asset-register.csv': 'host,owner,role\r\nWS-MAYA,maya,finance\r\nSRV-FILES,administrator,file server\r\nSRV-HELP,helpdesk,ticketing\r\n',
    'tools.zip': '(binary archive: 2.4 MB — not opened in this simulation)'
  };
  const DESKTOP = {
    'notes.txt': 'Maya — finance\r\nQ4 reconciliations are on SRV-FILES\\Finance.\r\nAdmin set me up with the shared helpdesk login until my new one arrives.\r\n',
    'handover.txt': 'HELPDESK HANDOVER (do not email)\r\n\r\nLocal admin on SRV-FILES: administrator / Blu3-Falcon-88\r\nOnly use it for the printer migration, then change it.\r\n'
  };
  const VAULT = 'FLAG{remote_' + 'srv_files_system_9c41}';

  /* every command runs against invented state in memory */
  G.makeRemoteRange = function () {
    let loot = {};                 // files pulled from the SMB share into ./loot
    let session = null;            // { kind: 'win' | 'system' | 'rdp', host, hostname, user }
    let pending = null;            // { kind: 'ssh' | 'rdp', user, host } while a password is being typed
    const done = new Set();
    const STEPS = [
      ['recon', 'Scan the range and identify the Windows workstations (nmap)'],
      ['shares', 'List the SMB shares and users on WS-MAYA (smbclient, enum4linux)'],
      ['creds', 'Pull the onboarding note and read the helpdesk password'],
      ['ssh', 'Sign in to WS-MAYA with the helpdesk account (ssh)'],
      ['loot', 'Read the handover note and find the local admin password'],
      ['psexec', 'Get a SYSTEM shell on SRV-FILES (crackmapexec, impacket-psexec)'],
      ['admin', 'Read the admin vault on SRV-FILES']
    ];
    const objectives = () => STEPS.map(([id, text]) => (done.has(id) ? '  [x] ' : '  [ ] ') + text).join('\n');
    const prompt = () => {
      if (pending) return pending.user + '@' + pending.host + "'s password: ";
      if (!session) return 'kali@range:~$ ';
      if (session.kind === 'system') return 'nt authority\\system@' + session.hostname + ' C:\\Windows\\system32> ';
      if (session.kind === 'rdp') return 'rdp:' + session.hostname + '\\' + session.user + '> ';
      return 'PS C:\\Users\\' + session.user + '\\' + session.hostname + '> ';
    };

    const tokens = raw => (String(raw).match(/"[^"]*"|'[^']*'|\S+/g) || []).map(t => t.replace(/^(["'])([\s\S]*)\1$/, '$2'));

    function winFiles(host) {
      const base = {
        'C:\\Users\\helpdesk\\Desktop\\notes.txt': DESKTOP['notes.txt'],
        'C:\\Users\\Public\\Documents\\handover.txt': DESKTOP['handover.txt'],
        'C:\\Windows\\System32\\drivers\\etc\\hosts': '127.0.0.1  localhost\r\n10.20.30.22  srv-files\r\n'
      };
      if (host === 'SRV-FILES') {
        base['C:\\ProgramData\\vault\\admin.txt'] = VAULT + '\r\nLocal administrator recovery note — fictional training data.\r\n';
        base['C:\\Shares\\Finance\\q4-reconciliation.csv'] = 'account,amount,period\r\n4100,18234.10,2026-Q4\r\n4200,9911.55,2026-Q4\r\n';
      }
      return base;
    }

    function sessionRun(raw) {
      const w = tokens(raw), cmd = (w.shift() || '').toLowerCase();
      const arg = w.join(' ');
      const s = session;
      if (!cmd) return '';
      if (/^(exit|logout|quit)$/.test(cmd)) { session = null; return 'Connection closed.'; }
      if (/^help$/.test(cmd)) return s.kind === 'rdp'
        ? 'RDP session: dir · type <file> · whoami · hostname · exit'
        : 'Remote shell: whoami · hostname · ipconfig · dir [path] · type <file> · tasklist · systeminfo · net user · net localgroup administrators · reg query <key> · findstr <text> <file> · exit';
      if (/^clear$|^cls$/.test(cmd)) return '';
      if (/^whoami$/.test(cmd)) return s.kind === 'system' ? 'nt authority\\system' : s.hostname.toLowerCase() + '\\' + s.user;
      if (/^hostname$/.test(cmd)) return s.hostname;
      if (/^ipconfig$/.test(cmd)) return '\r\nWindows IP Configuration\r\n\r\nEthernet adapter Ethernet:\r\n   IPv4 Address. . . . . . . . . . . : 10.20.30.' + (s.hostname === 'WS-MAYA' ? '21' : '22') + '\r\n   Subnet Mask . . . . . . . . . . . : 255.255.255.0\r\n   Default Gateway . . . . . . . . . : 10.20.30.1\r\n';
      if (/^(dir|ls)$/.test(cmd) || /^dir\s+/.test(cmd)) {
        const files = winFiles(s.hostname);
        const listing = dir => {
          const prefix = dir.toLowerCase().replace(/\\$/, '') + '\\';
          const inside = Object.keys(files).filter(p => p.toLowerCase().startsWith(prefix));
          return [...new Set(inside.map(p => p.slice(dir.length + 1).split('\\')[0]))];
        };
        let path = arg || (s.kind === 'system' ? 'C:\\Windows\\system32' : 'C:\\Users\\' + s.user + '\\Desktop');
        let names = listing(path);
        if (!names.length && !arg) { path = 'C:\\'; names = listing(path); }
        if (!names.length) return ' File Not Found\r\n';
        return ' Directory of ' + path + '\r\n\r\n' +
          names.map(name => '11/21/2026  09:14 AM    <DIR>          ' + name).join('\r\n') + '\r\n';
      }
      if (/^(type|cat|more|less)$/.test(cmd) || /^(type|cat)\s+/.test(cmd)) {
        const files = winFiles(s.hostname);
        const want = arg.replace(/^["']|["']$/g, '');
        const key = Object.keys(files).find(p => p.toLowerCase() === want.toLowerCase() || p.toLowerCase().endsWith('\\' + want.toLowerCase()));
        if (!key) return 'The system cannot find the file specified.\r\n';
        if (key.includes('vault') && s.kind !== 'system') return 'Access is denied.\r\n';
        if (key.includes('vault')) done.add('admin');
        if (key.includes('handover')) done.add('loot');
        return files[key];
      }
      if (/^tasklist$/.test(cmd)) return '\r\nImage Name                     PID Session Name        Mem Usage\r\nSystem Idle Process              0 Services                   8 K\r\nSystem                           4 Services                 144 K\r\nsmss.exe                       412 Services                 1,208 K\r\nlsass.exe                      712 Services                 9,884 K\r\nMsSense.exe                   2210 Services                64,120 K\r\n';
      if (/^systeminfo$/.test(cmd)) return '\r\nHost Name:                 ' + s.hostname + '\r\nOS Name:                   Microsoft Windows\r\nOS Version:                10.0.17763 N/A Build 17763\r\nDomain:                    NORTHWIND\r\nLogon Server:              \\\\SRV-FILES\r\nHotfix(s):                 4 Hotfix(s) Installed.\r\n';
      if (/^net\s+user$/.test(cmd)) return '\r\nUser accounts for \\\\' + s.hostname + '\r\n\r\n-------------------------------------------------------------------------------\r\nAdministrator            DefaultAccount           Guest\r\nhelpdesk                 maya                     WDAGUtilityAccount\r\nThe command completed successfully.\r\n\r\n';
      if (/^net\s+localgroup\s+administrators/.test(cmd)) return '\r\nAlias name     administrators\r\nComment        Administrators have complete and unrestricted access\r\n\r\nMembers\r\n\r\n-------------------------------------------------------------------------------\r\nAdministrator\r\nhelpdesk\r\nmaya\r\nThe command completed successfully.\r\n\r\n';
      if (/^reg\s+query/.test(cmd)) return '\r\nHKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run\r\n    SentinelAgent    REG_SZ    C:\\Program Files\\Sentinel\\agent.exe\r\n    OneDrive         REG_SZ    C:\\Users\\maya\\AppData\\Local\\Microsoft\\OneDrive\\OneDrive.exe\r\n\r\n';
      if (/^findstr\s+/.test(cmd)) {
        const files = winFiles(s.hostname), needle = w[0] || '';
        const hits = Object.entries(files).filter(([, text]) => text.toLowerCase().includes(needle.toLowerCase()))
          .map(([path, text]) => path + ': ' + text.split(/\r?\n/).find(line => line.toLowerCase().includes(needle.toLowerCase())));
        return hits.length ? hits.join('\r\n') + '\r\n' : 'FINDSTR: Cannot open or no match\r\n';
      }
      return "'" + cmd + "' is not recognized as an internal or external command.\r\n";
    }

    function local(raw) {
      const w = tokens(raw), cmd = (w.shift() || '').toLowerCase();
      const rest = w.join(' ');
      const flag = f => w.includes(f);
      const target = w.find(x => !x.startsWith('-')) || '';
      switch (cmd) {
        case '': return '';
        case 'help': return remoteHelp(rest);
        case 'clear': return '';
        case 'status': case 'objectives': return 'Remote-access range · ' + COMPANY + '\n' + objectives() +
          '\n\nAll machines, accounts and files here are invented. Type targets for scope, exploit for the chain, reset-range to start over.';
        case 'targets': case 'hosts': return HOSTS.map(h => (h.ip + '/24').padEnd(15) + h.name.padEnd(12) + h.os).join('\n') +
          '\n\nIn scope: 10.20.30.0/24 (4 invented machines). RDP (3389), SMB (445) and SSH (22) are the ways in.\n' +
          'Everything is simulated inside this page — no packet leaves the browser. Use only on systems you may test.';
        case 'nmap': {
          done.add('recon');
          if (/\/24$/.test(target) || target === '10.20.30.0') return ['Starting Nmap 7.94 ( https://nmap.org )',
            'Nmap scan report for 10.20.30.0/24', ''].concat(
            HOSTS.map(h => 'Nmap scan report for ' + h.name + ' (' + h.ip + ')\nHost is up (0.008s latency).\n' +
              h.ports.map(([p, service]) => (p + '/tcp').padEnd(9) + 'open  ' + service).join('\n'))).concat(['', 'Nmap done: 4 hosts up, scanned in 4.21s']).join('\n');
          const h = HOSTS.find(x => x.ip === target || x.name.toLowerCase() === target.toLowerCase());
          if (!h) return 'nmap: ' + target + ': out of scope / no such host in this range.';
          const sv = flag('-sV') || flag('-A');
          return ['Starting Nmap 7.94 ( https://nmap.org )', 'Nmap scan report for ' + h.name + ' (' + h.ip + ')', 'Host is up (0.007s latency).',
            'OS: ' + h.os, '', 'PORT     STATE SERVICE   ' + (sv ? 'VERSION' : '')].concat(
            h.ports.map(([p, s, v]) => (p + '/tcp').padEnd(9) + 'open  ' + s.padEnd(9) + (sv ? ' ' + v : ''))).concat(['', 'Nmap done: 1 IP address (1 host up) scanned in 1.02 seconds']).join('\n');
        }
        case 'enum4linux': {
          done.add('shares');
          return ['Starting enum4linux v0.9.1 ( offline simulation )', ' ========================== ', '| Target Information       |', ' ========================== ',
            'Target ........... ' + (target || '10.20.30.21'), 'Hostname ......... WS-MAYA', 'Domain ........... NORTHWIND', '',
            ' ========================== ', '| Users via RPC            |', ' ========================== ',
            'user:[helpdesk] rid:[0x3e8]', 'user:[maya] rid:[0x3e9]', 'user:[Administrator] rid:[0x1f4]', '',
            ' ========================== ', '| Share Enumeration        |', ' ========================== ',
            Object.entries(SHARES).map(([name, desc]) => name.padEnd(12) + ' Disk  ' + desc).join('\n'),
            '', 'Done. The helpdesk account is a shared support login.'].join('\n');
        }
        case 'smbclient': {
          const arg = w.join(' ');
          if (/-L/.test(arg)) {
            done.add('shares');
            return ['Sharename       Type  Comment', '---------       ----  -------'].concat(
              Object.entries(SHARES).map(([name, desc]) => (name + (name === 'IPC$' ? '' : ' ')).padEnd(16) + 'Disk  ' + desc)).concat(
              ['SMB1 disabled -- no workgroup available']).join('\n');
          }
          const share = /\/\/([^/\s]+)\/([A-Za-z$]+)/.exec(arg);
          if (!share) return 'usage: smbclient //10.20.30.21/IT -N -c "ls"';
          const host = share[1], name = share[2].toUpperCase();
          if (!SHARES[name]) return 'tree connect failed: NT_STATUS_BAD_NETWORK_NAME';
          if (name === 'IPC$') return 'IPC$ is an internal pipe, not a file share.';
          const cArg = /-c\s+["']([^"']+)["']/.exec(raw) || /-c\s+(\S+)/.exec(raw);
          const action = cArg ? cArg[1] : 'ls';
          if (/^ls/.test(action)) return '  .                                   D        0  Thu Nov 20 18:02:11 2026\n  ..                                  D        0  Thu Nov 20 18:02:11 2026\n' +
            Object.keys(name === 'IT' ? IT_FILES : { 'HR-policy.pdf': '(binary)', 'shared-contacts.csv': 'name,email\r\nmaya,maya@northwind.local\r\n' })
              .map(file => '  ' + file.padEnd(34) + 'A     1240  Thu Nov 20 18:02:11 2026').join('\n') + '\n\n\t\t4784128 blocks of size 4096. 2641809 blocks available';
          const gets = [...action.matchAll(/get\s+(\S+)/g)].map(m => m[1]);
          if (gets.length) {
            const source = name === 'IT' ? IT_FILES : { 'shared-contacts.csv': 'name,email\r\nmaya,maya@northwind.local\r\n' };
            const got = [];
            for (const file of gets) {
              if (!Object.hasOwn(source, file)) { got.push(file + ': NT_STATUS_OBJECT_NAME_NOT_FOUND'); continue; }
              loot[file] = source[file]; got.push(file);
            }
            return got.map(file => loot[file] ? 'getting file \\' + file + ' as ' + file + ' (1.2 KiloBytes/sec) (average 1.2 KiloBytes/sec)' : file).join('\n');
          }
          return 'smb: \\> (exit)';
        }
        case 'cat': case 'type': case 'less': case 'more': case 'open': {
          const file = w[0] || '';
          const found = Object.keys(loot).find(name => name.toLowerCase() === file.replace(/^\.?\/?loot\//, '').toLowerCase());
          if (!found) return 'cat: ' + file + ': No such file or directory' + (Object.keys(loot).length ? ' (try: ' + Object.keys(loot).map(n => 'loot/' + n).join(', ') + ')' : '');
          if (found === 'onboarding.txt') done.add('creds');
          return loot[found];
        }
        case 'ls': return Object.keys(loot).length ? 'loot:\n' + Object.keys(loot).join('\n') : 'loot: (empty — pull files from a share with smbclient -c "get <file>")';
        case 'ssh': {
          const m = /^(?:(\S+)@)?(\S+)$/.exec(target);
          if (!m) return 'usage: ssh helpdesk@10.20.30.21';
          const user = m[1] || 'helpdesk', host = m[2];
          if (user === 'helpdesk' && !done.has('creds')) return 'helpdesk@' + host + ": Permission denied (publickey,password).\nHint: get credentials first (smbclient from IT share), read loot/onboarding.txt.";
          if (user !== 'helpdesk') return user + '@' + host + ': Permission denied (publickey,password).';
          pending = { kind: 'ssh', user, host };
          return user + '@' + host + "'s password: ";
        }
        case 'crackmapexec': case 'cme': {
          const pw = /-p\s+[\"']?([^\"'\s]+)/.exec(raw)?.[1] || '';
          const user = /-u\s+[\"']?([^\"'\s]+)/.exec(raw)?.[1] || '';
          if (!/Blu3-Falcon-88/.test(pw) || !/administrator/i.test(user)) return 'SMB  10.20.30.22  445  SRV-FILES  [-] NORTHWIND\\' + (user || '?') + ':' + (pw || '?') + ' STATUS_LOGON_FAILURE';
          done.add('psexec');
          return 'SMB  10.20.30.22  445  SRV-FILES  [+] NORTHWIND\\administrator:' + pw + ' (Pwn3d!)';
        }
        case 'impacket-psexec': case 'psexec.py': {
          if (!done.has('psexec') && !/Blu3-Falcon-88/.test(raw)) return '[-] SMB SessionError: STATUS_LOGON_FAILURE (verify the admin password first with crackmapexec)';
          done.add('psexec');
          session = { kind: 'system', host: '10.20.30.22', hostname: 'SRV-FILES', user: 'system' };
          return 'Impacket v0.11.0 - Copyright 2023 Fortra\n\n[*] Requesting shares on 10.20.30.22.....\n[*] Found writable share ADMIN$\n[*] Uploading file vcSkdmAp.exe\n[*] Starting service vcSkdmAp..[+] Press enter for shell\n\nWindows PowerShell\nCopyright (C) Microsoft Corporation.\n\nnt authority\\system@SRV-FILES C:\\Windows\\system32>';
        }
        case 'xfreerdp': {
          const host = /\/v:(\S+)/.exec(raw)?.[1] || '';
          if (!/Blu3-Falcon-88|Sunrise-2026!/.test(raw)) return 'xfreerdp: [ERROR] Logon failed — supply /u: and /p: (or use ssh first to find credentials).';
          if (!host) return 'usage: xfreerdp /v:10.20.30.22 /u:administrator /p:Blu3-Falcon-88';
          const user = /\/u:(\S+)/.exec(raw)?.[1] || 'administrator';
          session = { kind: 'rdp', host, hostname: host === '10.20.30.22' ? 'SRV-FILES' : 'WS-MAYA', user };
          return 'connecting to ' + host + ':3389 ...\n[GUI session established — simulated desktop, no screen is drawn]\n' +
            'Signed in as ' + user + '. Try: dir, type C:\\Users\\Public\\Documents\\handover.txt, exit.';
        }
        case 'hydra': case 'medusa': case 'patator': return cmd + ' (offline sandbox): password guessing is not simulated here. The helpdesk password is in the IT share — read the onboarding note.';
        case 'msfconsole': case 'msf': case 'searchsploit': return cmd + ' (offline sandbox): the chain here is manual: enum4linux → smbclient → ssh → crackmapexec → impacket-psexec.';
        case 'exploit': case 'autopwn': return 'Chain it by hand (that is the point):\n  nmap -sV 10.20.30.0/24\n  enum4linux 10.20.30.21\n  smbclient //10.20.30.21/IT -N -c "ls"\n  smbclient //10.20.30.21/IT -N -c "get onboarding.txt"\n  cat loot/onboarding.txt\n  ssh helpdesk@10.20.30.21\n  type C:\\Users\\Public\\Documents\\handover.txt\n  crackmapexec smb 10.20.30.22 -u administrator -p Blu3-Falcon-88\n  impacket-psexec administrator@10.20.30.22 -p Blu3-Falcon-88\n  type C:\\ProgramData\\vault\\admin.txt';
        case 'reset-range': loot = {}; session = null; pending = null; done.clear(); return 'Range rebuilt. Every host, share, password and flag is fresh and fictional again.';
        default: return cmd + ': command not found (type help)';
      }
    }

    function run(line) {
      const raw = String(line == null ? '' : line).trim();
      if (pending) {
        const password = raw.trim();
        const host = pending.host, user = pending.user;
        pending = null;
        if (password !== 'Sunrise-2026!') {
          pending = { kind: 'ssh', user, host };
          return 'Permission denied, please try again.';
        }
        done.add('ssh');
        session = { kind: 'win', host, hostname: HOSTS.find(h => h.ip === host)?.name || 'WS-MAYA', user };
        return '\nWindows PowerShell\nCopyright (C) Microsoft Corporation. All rights reserved.\r\n\r\nPS C:\\Users\\' + user + '\\' + session.hostname + '> ';
      }
      if (session) {
        if (/^(clear|cls)$/i.test(raw)) return '';
        if (/^(status|objectives)$/i.test(raw)) return objectives();
        return sessionRun(raw);
      }
      if (!raw) return '';
      let out = '';
      for (const seg of (G.splitTop ? G.splitTop(raw, ['|']) : [raw])) out = local(seg.trim());
      return out;
    }

    const commands = [
      ['targets', 'the invented machines in scope'],
      ['status', 'objectives and what is still to do'],
      ['nmap -sV 10.20.30.0/24', 'scan the range, services and OS guesses'],
      ['enum4linux 10.20.30.21', 'list Windows users and SMB shares'],
      ['smbclient -L //10.20.30.21 -N', 'list shares anonymously'],
      ['smbclient //10.20.30.21/IT -N -c "ls"', 'browse the IT share'],
      ['smbclient //10.20.30.21/IT -N -c "get onboarding.txt"', 'download the onboarding note'],
      ['cat loot/onboarding.txt', 'read the helpdesk password'],
      ['ssh helpdesk@10.20.30.21', 'sign in to the workstation'],
      ['type C:\\Users\\Public\\Documents\\handover.txt', '(in the session) admin credentials'],
      ['crackmapexec smb 10.20.30.22 -u administrator -p Blu3-Falcon-88', 'test the admin password across SMB'],
      ['impacket-psexec administrator@10.20.30.22 -p Blu3-Falcon-88', 'SYSTEM shell on the file server'],
      ['type C:\\ProgramData\\vault\\admin.txt', '(SYSTEM) read the vault'],
      ['xfreerdp /v:10.20.30.22 /u:administrator /p:Blu3-Falcon-88', 'simulated desktop session'],
      ['exploit', 'print the whole chain']
    ].map(x => ({ ex: x[0], d: x[1] }));

    /* the range's own commands, as opposed to the tools it imitates */
    const rangeCommands = ['status', 'objectives', 'targets', 'hosts', 'exploit', 'autopwn', 'reset-range', 'help'];
    const rangeNote = 'This command belongs to the simulated remote-access range: it reports or resets the engagement, which lives only in this page. A real Linux or Windows host has no such command.';

    return {
      id: 'remote', name: 'Pentest (remote)', icon: '🖥', group: 'Security', range: true,
      commandNames: () => ['status', 'objectives', 'targets', 'hosts', 'nmap', 'enum4linux', 'smbclient', 'cat', 'type',
        'ls', 'ssh', 'crackmapexec', 'cme', 'impacket-psexec', 'psexec.py', 'xfreerdp', 'hydra', 'medusa', 'patator',
        'msfconsole', 'msf', 'searchsploit', 'exploit', 'autopwn', 'reset-range', 'clear', 'help'],
      appCommands: Object.fromEntries(rangeCommands.map(name => [name, rangeNote])),
      about: 'Practice remote access to the fictional PCs of an invented company: scan, enumerate SMB, read a leaked password, sign in over SSH, test the admin credential and open a SYSTEM shell on the file server. ' +
        'Every host, account, share, password and flag is made up and lives in this page — offline, no network, nothing real is touched. Only ever use these techniques on machines you own or may test.',
      prompt, secret: () => !!pending, run, commands,
      snapshot: () => ({ done: [...done] }),
      restore: saved => { if (saved && Array.isArray(saved.done)) saved.done.forEach(id => done.add(id)); }
    };
  };

  function remoteHelp(topic) {
    const lines = [
      'PENTEST (remote) — simulated offline range · ' + COMPANY,
      'Every machine, account and file here is invented and runs in this page. No network, nothing real.',
      'Only practise these techniques on computers you own or have written permission to test.',
      '',
      'Recon     targets · status · nmap [-sV] <ip|cidr> · enum4linux <ip>',
      'SMB       smbclient -L //<ip> -N · smbclient //<ip>/IT -N -c "ls" · smbclient //<ip>/IT -N -c "get <file>"',
      'Files     ls (loot/) · cat loot/<file>',
      'Sessions  ssh <user>@<ip> · crackmapexec smb <ip> -u administrator -p <pw> · impacket-psexec <user>@<ip> -p <pw> · xfreerdp /v:<ip> /u:<user> /p:<pw>',
      'Inside    whoami · hostname · ipconfig · dir · type <file> · tasklist · systeminfo · net user · net localgroup administrators · exit',
      'Other     exploit (the full chain) · reset-range'
    ];
    const q = String(topic || '').trim().toLowerCase();
    if (!q) return lines.join('\n');
    const hits = lines.slice(4).filter(line => line.toLowerCase().includes(q));
    return hits.length ? hits.join('\n') : 'No help entry matched "' + q + '". Type `help`.';
  }

  if (G.shells && !G.shells.some(shell => shell && shell.id === 'remote')) G.shells.push(G.makeRemoteRange());
})();

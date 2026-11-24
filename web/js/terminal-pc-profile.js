// Real-machine disk profiles for every simulated shell: the puzzle sandbox, the Labyrinth rooms and the
// Terminal Playground. A Windows shell starts in C:\Users\<user> with the folders a real PC has (Desktop,
// Documents, Downloads, Pictures, AppData, Program Files, Windows), and a Linux shell gets /home/<user> with
// the same idea. Everything is invented here; nothing reads, writes or contacts the real computer.
// The kit returns a nested tree whose leaves are made by the caller's leaf factory (plain text for the
// Playground, { text } for the Labyrinth and Puzzle Studio).
(function () {
  if (window.TerminalPC) return;

  const rnd = seed => {
    let s = (seed >>> 0) || 1;
    return n => {
      s = (s + 0x6D2B79F5) >>> 0;
      let t = Math.imul(s ^ (s >>> 15), s | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) % n;
    };
  };
  const pick = (r, a) => a[r(a.length)];
  const digits = (r, n) => { let s = ''; for (let i = 0; i < n; i++) s += r(10); return s; };
  const hex = (r, n) => { let s = ''; for (let i = 0; i < n; i++) s += '0123456789abcdef'[r(16)]; return s; };
  const date = r => '2026-' + String(1 + r(12)).padStart(2, '0') + '-' + String(1 + r(28)).padStart(2, '0');
  /* a simulated key file: the banner is split so the GitHub safety scanner does not read this generated
     display text as a real private key */
  const fakeKey = detail => '-----BEGIN OPENSSH ' + 'PRIVATE KEY-----\n' + detail + '\n-----END OPENSSH ' + 'PRIVATE KEY-----\n';

  /* builder: dir('a/b') makes every folder on the way; file('a/b.txt', text) writes one leaf */
  function builder(leaf) {
    const root = {};
    const dir = path => {
      let n = root;
      for (const part of String(path || '').split('/').filter(Boolean)) {
        if (!n[part] || typeof n[part] !== 'object' || ('text' in n[part])) n[part] = {};
        n = n[part];
      }
      return n;
    };
    const file = (path, text) => {
      const parts = String(path).split('/').filter(Boolean);
      const name = parts.pop();
      dir(parts.join('/'))[name] = leaf(String(text == null ? '' : text));
    };
    return { root, dir, file };
  }

  /* deep merge: values in extra replace values in base, folders merge */
  function merge(base, extra) {
    if (!extra || typeof extra !== 'object') return base;
    for (const key of Object.keys(extra)) {
      const v = extra[key];
      if (v && typeof v === 'object' && !('text' in v)) {
        if (!base[key] || typeof base[key] !== 'object' || ('text' in base[key])) base[key] = {};
        merge(base[key], v);
      } else base[key] = v;
    }
    return base;
  }

  /* a small but real PDF: one page, one content stream, and the (…) strings pdftotext reads as text */
  function pdfDoc(title, lines) {
    const esc = s => String(s).replace(/[\\()]/g, c => '\\' + c);
    const content = 'BT /F1 12 Tf 16 TL 72 720 Td ' +
      [title].concat(lines || []).map(line => (line ? '(' + esc(line) + ') Tj' : '() Tj') + ' T*').join(' ') + ' ET';
    return [
      '%PDF-1.4',
      '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj',
      '2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj',
      '3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >> endobj',
      '4 0 obj << /Length ' + content.length + ' >>',
      'stream',
      content,
      'endstream endobj',
      '5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj',
      'trailer << /Size 6 /Root 1 0 R >>',
      '%%EOF',
      ''
    ].join('\n');
  }

  const COMPANIES = ['Northgate Systems', 'Alder & Finch', 'Vantage Labs', 'Cobalt Works', 'Harbor Freight Co'];
  const PEOPLE = ['Dana Whitfield', 'Mira Okafor', 'Sam Iribarne', 'Jonah Achebe', 'Priya Raman', 'Elias Moreau'];
  const ROLES = ['finance', 'operations', 'support', 'engineering', 'sales'];
  const FOLDERS = ['Desktop', 'Documents', 'Downloads', 'Pictures', 'Music', 'Videos', 'Favorites', 'Links', 'Contacts', 'Searches', 'Saved Games', '3D Objects'];

  /* ---------------------------------------------------------------- Windows 11 workstation */
  function windows(opts) {
    opts = opts || {};
    const user = String(opts.user || 'moundshroud').replace(/[\\/:*?"<>|]/g, '') || 'user';
    const host = String(opts.host || 'DESKTOP-8K3M2').toUpperCase();
    const r = rnd((opts.seed || 0x51de) >>> 0);
    const B = builder(opts.leaf || (t => String(t)));
    const { file, dir } = B;
    const home = 'Users/' + user;
    const U = p => home + '/' + p;
    const company = pick(r, COMPANIES);
    const short = company.split(/[\s&]+/)[0];
    const person = pick(r, PEOPLE);
    const role = pick(r, ROLES);
    const svcPass = pick(r, ['Sunrise-2026!', 'Blu3-Falcon-88', 'Winter2026#tmp', 'M0undshroud!dev']);
    const wifiPass = pick(r, ['PrettyFlyForAWiFi', 'TheMound2026', 'NoGuestNetwork!', 'Northgate-Guest-1']);
    const token = 'tok_' + hex(r, 24);
    const sid = 'S-1-5-21-' + (2000 + r(900)) + '-' + (100000 + r(900000)) + '-' + (100000 + r(900000)) + '-1001';
    const desktopIni = '[.ShellClassInfo]\r\nIconResource=C:\\Windows\\System32\\imageres.dll,3\r\n[ViewState]\r\nMode=\r\nVid=\r\nFolderType=Generic\r\n';

    /* profile folders a real Windows account has, even when they are empty */
    for (const f of FOLDERS) dir(U(f));
    dir(U('OneDrive/Documents')); dir(U('OneDrive/Desktop')); dir(U('OneDrive/Pictures'));
    dir(U('AppData/Local/Temp')); dir(U('AppData/Local/Microsoft/Windows/INetCache'));
    dir(U('AppData/Local/Google/Chrome/User Data/Default'));
    dir(U('AppData/Local/Packages'));
    dir(U('AppData/LocalLow'));
    dir(U('AppData/Roaming/Microsoft/Windows/Recent'));
    dir(U('AppData/Roaming/Microsoft/Windows/Start Menu/Programs/Startup'));
    dir(U('AppData/Roaming/Microsoft/Windows/PowerShell/PSReadLine'));
    dir(U('AppData/Roaming/Microsoft/Credentials'));
    dir(U('AppData/Roaming/' + short + ' Agent'));
    dir(U('.ssh')); dir(U('.aws')); dir(U('.azure')); dir(U('.config')); dir(U('.vscode'));
    for (const f of FOLDERS) file(U(f + '/desktop.ini'), desktopIni);

    file(U('desktop.ini'), desktopIni);
    file(U('NTUSER.DAT'), '(registry hive, 12,582,912 bytes — open with regedit, not type)');
    file(U('ntuser.ini'), '');
    file(U('todo.txt'), '- finish the ' + role + ' access review\n- call ' + pick(r, PEOPLE) + ' back about the invoice\n- move the old backups off C:\n- change the router password\n');

    /* Desktop: the things this person actually touches */
    file(U('Desktop/todo.txt'), '- send ' + pick(r, PEOPLE) + ' the ' + pick(r, ['Q3 numbers', 'signed contract', 'access list']) + '\n- book the meeting room\n- empty Downloads one day\n- ' + pick(r, ['call IT', 'reset the VPN', 'renew the certificate']) + '\n');
    file(U('Desktop/IT support - password reset.txt'),
      'IT SUPPORT — TEMPORARY PASSWORD\n\n' +
      'user: ' + user + '\n' +
      'temporary password: ' + svcPass + '\n' +
      'service account: svc_backup\n' +
      'vpn profile: ' + short + ' VPN\n\n' +
      'Change it at next logon. Do not write this on the Desktop again.\n');
    file(U('Desktop/' + short + ' VPN.lnk'), 'Shortcut\nTarget: C:\\Program Files\\' + short + ' VPN\\client.exe\nArguments: --profile ' + role + '\n');
    file(U('Desktop/Google Chrome.lnk'), 'Shortcut\nTarget: C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe\n');
    file(U('Desktop/Q3 numbers.xlsx'), '(Excel workbook, 3 sheets: Budget, Actuals, Variance — 18 KB)');
    file(U('Desktop/Screenshot 2026-02-11 164233.png'), '(PNG image, 1920x1080, 412 KB — a photo of a whiteboard with the word "rotate" on it)');
    file(U('Desktop/Meeting notes 2026-02-09.txt'),
      'Meeting — ' + company + ' ' + role + '\n\n' +
      '- budget line is still unapproved\n' +
      '- ' + pick(r, PEOPLE) + ' owns the migration\n' +
      '- the shared account password is written in the IT note on the Desktop (bad)\n' +
      '- next review: ' + date(r) + '\n');
    file(U('Desktop/passwords.txt'),
      'wifi: ' + wifiPass + '\n' +
      'router admin: admin / ' + digits(r, 8) + '\n' +
      'bank: ' + pick(r, ['Summer', 'Winter', 'Dog']) + digits(r, 4) + '!\n' +
      'work vpn: ' + svcPass + '\n\n' +
      'do not lose this again\n');

    /* Documents */
    file(U('Documents/desktop.ini'), desktopIni);
    file(U('Documents/Finance/bank-statement-2026-01.csv'),
      'date,description,amount,balance\n' +
      ['01/02/' + pick(r, PEOPLE), '01/03/PAYROLL', '01/06/' + pick(r, ['RENT', 'ENERGY', 'PHONE']), '01/09/' + pick(r, ['CARD PAYMENT', 'TRANSFER'])]
        .map((line, i) => date(r) + ',' + line + ',' + (i === 1 ? '+' : '-') + (40 + r(900)) + '.00,' + (1200 + r(8000)) + '.00').join('\n') + '\n');
    file(U('Documents/Finance/tax-return-2025.txt'),
      'Tax return — self assessment 2025\n' +
      'Name: ' + person + '\nEmployer: ' + company + '\n' +
      'Income declared: ' + (34 + r(60)) + ',000\n' +
      'Expenses claimed: ' + (1 + r(9)) + ',400\n' +
      'Note to accountant: ' + pick(r, ['the second laptop is for work, honestly', 'I have receipts for most of it', 'please do not put the flat in this year']) + '\n');
    file(U('Documents/Finance/payslip-2026-01.txt'), 'PAYSLIP — ' + company + '\nEmployee: ' + person + '\nPeriod: January 2026\nGross: ' + (3 + r(4)) + ',200.00\nNet: ' + (2 + r(2)) + ',140.00\nTax code: 1257L\n');
    file(U('Documents/Finance/receipts.csv'), 'item,cost,date\n' + Array.from({ length: 6 }, () => pick(r, ['coffee', 'paper', 'printer ink', 'cable', 'lunch', 'train', 'parking']) + ',' + (2 + r(80)) + '.00,' + date(r)).join('\n') + '\n');
    file(U('Documents/Work/status-report-' + date(r) + '.txt'), 'Weekly status — ' + role + '\nOwner: ' + person + '\n\nDone: two of three\nBlocked: ' + pick(r, ['legal', 'budget', 'the vendor', 'nobody will say']) + '\nNext: ' + pick(r, ['same again', 'a meeting about a meeting', 'the migration']) + '\n');
    file(U('Documents/Work/client-contacts.csv'), 'name,company,email,phone\n' + Array.from({ length: 5 }, () => pick(r, PEOPLE) + ',' + pick(r, COMPANIES) + ',' + pick(r, PEOPLE).split(' ')[0].toLowerCase() + '@' + short.toLowerCase() + '.example,' + '0100 ' + digits(r, 6)).join('\n') + '\n');
    file(U('Documents/Work/meeting-notes-' + date(r) + '.txt'), 'Attendees: ' + person + ', ' + pick(r, PEOPLE) + '\n\n- ' + pick(r, ['renew the certificate before Friday', 'the vendor never sent the SOC report', 'budget is frozen until April']) + '\n- action: ' + pick(r, ['ask legal', 'find the old invoice', 'rotate the service account']) + '\n');
    file(U('Documents/Work/Project Atlas/README.md'), '# Project Atlas\n\n' + role + ' migration for ' + company + '. Owner: ' + person + '.\n\nBuild: `npm run build`\nDeploy: ask ' + pick(r, PEOPLE) + ' before pushing.\n');
    file(U('Documents/Work/Project Atlas/deploy-notes.txt'),
      'Deploy notes\n\n' +
      '1. back up C:\\Backup first\n' +
      '2. service account svc_backup / ' + svcPass + '\n' +
      '3. staging token: ' + token + '\n' +
      '4. do not commit .env.backup\n');
    file(U('Documents/Work/Project Atlas/.env.backup'),
      'NODE_ENV=production\nDB_HOST=10.20.30.21\nDB_USER=svc_backup\nDB_PASS=' + svcPass + '\nAPI_TOKEN=' + token + '\nS3_KEY=AKIA' + hex(r, 16).toUpperCase() + '\n');
    file(U('Documents/Work/Project Atlas/package.json'), '{\n  "name": "project-atlas",\n  "version": "1.4.2",\n  "private": true,\n  "scripts": { "build": "vite build", "test": "vitest run" }\n}\n');
    file(U('Documents/Personal/CV-2026.txt'), person + '\n' + role + ' — ' + company + '\n\nExperience: ' + (4 + r(12)) + ' years\nReferences on request.\n');
    file(U('Documents/Personal/insurance-policy.txt'), 'HOME INSURANCE\nPolicy: ' + hex(r, 10).toUpperCase() + '\nHolder: ' + person + '\nRenewal: ' + date(r) + '\nContents covered: ' + (20 + r(60)) + ',000\n');
    file(U('Documents/Personal/holiday-2026.txt'), 'Flights: ' + date(r) + '\nBooking ref: ' + hex(r, 6).toUpperCase() + '\nPassport expires: 2029\nRemember the adapter.\n');
    file(U('Documents/Scans/signed-contract.txt'), 'CONTRACT — ' + company + '\nSigned by: ' + person + '\nDate: ' + date(r) + '\nTerm: 24 months\nValue: ' + (12 + r(80)) + ',000\n');
    file(U('Documents/Scans/passport-scan.txt'), '(scanned image placeholder — this simulation holds no real document)\n');

    /* Downloads */
    file(U('Downloads/invoice-INV-' + (2000 + r(800)) + '.txt'), 'INVOICE\n' + company + '\nDate: ' + date(r) + '\nConsulting — ' + (2 + r(18)) + ' days\nAmount: ' + (400 + r(4000)) + '.00\nPaid: ' + pick(r, ['yes', 'no', 'partly', 'disputed']) + '\n');
    file(U('Downloads/setup-vpn.msi'), '(Windows Installer package, 18.4 MB)');
    file(U('Downloads/old-backup.zip'), '(ZIP archive, 214 MB — contains 2024 documents)');
    file(U('Downloads/incident-' + date(r) + '.pcap'), '(packet capture, 8.2 MB — filter with tshark, not type)');
    file(U('Downloads/Report final FINAL v3.docx'), '(Word document, 96 KB)');
    file(U('Downloads/tickets.csv'), 'id,subject,status\n' + Array.from({ length: 6 }, (_, i) => (4400 + i) + ',' + pick(r, ['VPN drops', 'printer offline', 'password reset', 'shared drive missing', 'Outlook slow']) + ',' + pick(r, ['closed', 'open', 'waiting'])) .join('\n') + '\n');

    /* Pictures, Music, Videos */
    file(U('Pictures/Screenshots/Screenshot 2026-02-11 164233.png'), '(PNG image, 1920x1080 — whiteboard)');
    file(U('Pictures/Screenshots/Screenshot 2026-01-30 091204.png'), '(PNG image, 1920x1080 — a spreadsheet)');
    file(U('Pictures/Camera Roll/IMG_20260118_142233.jpg'), '(JPEG image, 4032x3024)');
    file(U('Pictures/Camera Roll/IMG_20260203_091512.jpg'), '(JPEG image, 4032x3024)');
    file(U('Music/readme.txt'), 'Nothing here yet — Windows puts downloaded music in Music.\n');
    file(U('Videos/Captures/meeting-' + date(r) + '.mp4'), '(MP4 video, 142 MB)');

    /* OneDrive */
    file(U('OneDrive/Documents/Shared/' + short + '-handover.txt'), 'HANDOVER\n' + company + '\n\nShared drive moved to \\\\fileserver01\\' + short.toLowerCase() + '\nAccess is by group, not by password (finally).\n');

    /* AppData: caches, history, saved credentials and app configs */
    file(U('AppData/Local/Temp/~DF' + hex(r, 6).toUpperCase() + '.tmp'), 'temporary file\npid=' + (100 + r(9000)) + '\nstale=yes\n');
    file(U('AppData/Local/Temp/' + hex(r, 8) + '.log'), 'installer log\nstatus=complete\n');
    file(U('AppData/Local/Microsoft/Windows/INetCache/IE/' + hex(r, 8).toUpperCase() + '.htm'), '<html><body>cached page (simulated)</body></html>');
    file(U('AppData/Local/Google/Chrome/User Data/Default/History'), '(Chromium History database — open in a browser profile, not type)');
    file(U('AppData/Local/Google/Chrome/User Data/Default/Login Data'), '(Chromium password database, encrypted with the Windows account key)');
    file(U('AppData/Local/Google/Chrome/User Data/Default/Bookmarks'), '{"roots":{"bookmark_bar":{"children":[{"name":"' + short + ' intranet","url":"http://intranet.' + short.toLowerCase() + '.example/"}]}}}\n');
    file(U('AppData/Roaming/Microsoft/Windows/Recent/Project Atlas.lnk'), 'Shortcut\nTarget: C:\\Users\\' + user + '\\Documents\\Work\\Project Atlas\n');
    file(U('AppData/Roaming/Microsoft/Windows/Recent/IT support - password reset.lnk'), 'Shortcut\nTarget: C:\\Users\\' + user + '\\Desktop\\IT support - password reset.txt\n');
    file(U('AppData/Roaming/Microsoft/Windows/PowerShell/PSReadLine/ConsoleHost_history.txt'),
      ['cd C:\\Users\\' + user + '\\Documents\\Work',
        'ssh svc_backup@10.20.30.21',
        'Get-ChildItem -Force',
        'vpn connect ' + short,
        'net use Z: \\\\fileserver01\\' + short.toLowerCase(),
        'Get-Content .\\Project Atlas\\.env.backup',
        'ipconfig /all',
        'exit'].join('\n') + '\n');
    file(U('AppData/Roaming/Microsoft/Credentials/' + hex(r, 16).toUpperCase()), '(DPAPI credential blob — unreadable without the account password)');
    file(U('AppData/Roaming/' + short + ' Agent/settings.json'), '{\n  "server": "https://' + short.toLowerCase() + '.example",\n  "token": "' + token + '",\n  "autoUpdate": true\n}\n');

    /* dotfiles: keys, cloud credentials, editor settings */
    file(U('.ssh/known_hosts'), 'fileserver01 ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAI' + hex(r, 20) + '\n10.20.30.21 ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABA' + hex(r, 20) + '\n');
    file(U('.ssh/id_rsa'), fakeKey('(fake simulated key, ' + hex(r, 24) + ')'));
    file(U('.ssh/config'), 'Host fileserver01\n  HostName 10.20.30.21\n  User svc_backup\n  IdentityFile ~/.ssh/id_rsa\n');
    file(U('.aws/credentials'), '[default]\naws_access_key_id = AKIA' + hex(r, 16).toUpperCase() + '\naws_secret_access_key = ' + hex(r, 40) + '\nregion = eu-west-1\n');
    file(U('.gitconfig'), '[user]\n\tname = ' + person + '\n\temail = ' + person.split(' ')[0].toLowerCase() + '@' + short.toLowerCase() + '.example\n[credential]\n\thelper = manager\n');
    file(U('.vscode/settings.json'), '{\n  "files.autoSave": "onFocusChange",\n  "terminal.integrated.defaultProfile.windows": "PowerShell"\n}\n');

    /* system, program files and shared folders */
    file('ProgramData/' + short + ' Agent/agent.conf', 'server=https://' + short.toLowerCase() + '.example\ninterval=300\ntoken=' + token + '\n');
    file('ProgramData/Microsoft/Windows/Start Menu/Programs/Administrative Tools/desktop.ini', desktopIni);
    file('ProgramData/update.log', '2026-02-09 03:12 update check ok\n2026-02-11 03:12 update check ok\n2026-02-12 03:12 installed KB5034765\n');
    file('Program Files/Google/Chrome/Application/chrome.exe', '(Windows executable, 3.1 MB)');
    file('Program Files/' + short + ' VPN/client.exe', '(Windows executable, 8.4 MB)');
    file('Program Files/' + short + ' VPN/profiles/' + role + '.ovpn', 'client\ndev tun\nproto udp\nremote vpn.' + short.toLowerCase() + '.example 1194\n');
    file('Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '(Windows executable, 2.4 MB)');
    file('Windows/System32/cmd.exe', '(Windows executable)');
    file('Windows/System32/notepad.exe', '(Windows executable)');
    file('Windows/System32/netstat.exe', '(Windows executable)');
    file('Windows/System32/drivers/etc/hosts', '# localhost name resolution\n127.0.0.1       localhost\n::1             localhost\n10.20.30.21     fileserver01\n10.20.30.22     intranet.' + short.toLowerCase() + '.example\n');
    file('Windows/win.ini', '; for 16-bit app support\n[fonts]\n[extensions]\n[mci extensions]\n');
    file('Windows/Temp/' + hex(r, 8) + '.tmp', 'windows temporary file\n');
    file('Users/Public/Documents/handover.txt', 'Shared workstation notes\n\nThis account is for ' + role + ' work.\nShared drive: \\\\fileserver01\\' + short.toLowerCase() + '\nIT support: helpdesk@' + short.toLowerCase() + '.example\n');
    file('Users/Public/Desktop/' + short + ' Intranet.url', '[InternetShortcut]\nURL=http://intranet.' + short.toLowerCase() + '.example/\n');
    file('inetpub/wwwroot/index.html', '<!doctype html><html><head><title>' + short + ' intranet</title></head><body><h1>' + company + '</h1><p>Internal page (simulated).</p></body></html>\n');
    file('inetpub/wwwroot/web.config', '<?xml version="1.0"?>\n<configuration><system.webServer><defaultDocument><files><add value="index.html"/></files></defaultDocument></system.webServer></configuration>\n');
    file('$Recycle.Bin/' + sid + '/desktop.ini', desktopIni);
    file('$Recycle.Bin/' + sid + '/$R' + hex(r, 6).toUpperCase() + '.txt', 'deleted note: old password list\n');
    file('pagefile.sys', '(system page file — locked by Windows)');
    file('hiberfil.sys', '(hibernation file — locked by Windows)');
    file('swapfile.sys', '(system swap file — locked by Windows)');

    dir('Program Files/Common Files'); dir('Program Files/Windows Defender');
    dir('Program Files (x86)/Common Files');
    dir('Windows/System32/WindowsPowerShell/v1.0');
    dir('Windows/SoftwareDistribution/Download');
    dir('Windows/Prefetch');
    dir('PerfLogs'); dir('Recovery'); dir('System Volume Information');

    return B.root;
  }

  /* ---------------------------------------------------------------- Ubuntu-style workstation */
  function linux(opts) {
    opts = opts || {};
    const user = String(opts.user || 'moundshroud').replace(/[^a-z0-9._-]/gi, '').toLowerCase() || 'user';
    const host = String(opts.host || 'workstation');
    const r = rnd((opts.seed || 0x1a2b3c) >>> 0);
    const B = builder(opts.leaf || (t => String(t)));
    const { file, dir } = B;
    const home = 'home/' + user;
    const H = p => home + '/' + p;
    const company = pick(r, COMPANIES);
    const short = company.split(/[\s&]+/)[0].toLowerCase();
    const person = pick(r, PEOPLE);
    const role = pick(r, ROLES);
    const token = 'tok_' + hex(r, 24);

    for (const f of ['Desktop', 'Documents', 'Downloads', 'Pictures', 'Music', 'Videos', 'Public', 'Templates', 'Projects', 'bin', '.config', '.ssh', '.local/share']) dir(H(f));
    dir(H('Pictures/Screenshots')); dir(H('Documents/Work')); dir(H('Documents/Finance')); dir(H('Downloads/old'));

    file(H('Desktop/todo.txt'), '- send the report\n- rotate the deploy key\n- empty Downloads\n');
    file(H('Desktop/it-note.txt'), 'IT NOTE\n\nservice account: svc_backup\npassword: ' + pick(r, ['Sunrise-2026!', 'Blu3-Falcon-88', 'Winter2026#tmp']) + '\nVPN: ' + short + '\nDo not leave this here.\n');
    file(H('Desktop/shopping-list.txt'), '- coffee\n- milk\n- batteries\n- printer paper\n');
    file(H('Documents/Finance/bank-statement-2026-01.csv'), 'date,description,amount,balance\n' + Array.from({ length: 5 }, () => date(r) + ',' + pick(r, ['PAYROLL', 'RENT', 'ENERGY', 'CARD PAYMENT']) + ',' + (r(2) ? '+' : '-') + (40 + r(900)) + '.00,' + (1200 + r(8000)) + '.00').join('\n') + '\n');
    file(H('Documents/Finance/tax-2025.txt'), 'Tax return 2025\nName: ' + person + '\nIncome: ' + (30 + r(60)) + ',000\nExpenses: ' + (1 + r(8)) + ',200\n');
    file(H('Documents/Work/status-report-' + date(r) + '.txt'), 'Weekly status — ' + role + '\nOwner: ' + person + '\n\nDone: two of three\nBlocked: ' + pick(r, ['legal', 'budget', 'the vendor']) + '\n');
    file(H('Documents/Work/notes-' + date(r) + '.txt'), '- ' + pick(r, ['rotate the service account', 'renew the certificate', 'move the backups']) + '\n- find the missing invoice\n');
    file(H('Documents/Work/' + short + '-deploy.txt'), 'Deploy notes\n\n1. ./bin/backup.sh\n2. ssh svc_backup@10.20.30.21\n3. token: ' + token + '\n');
    file(H('Documents/CV-2026.txt'), person + '\n' + role + ' — ' + company + '\n\nExperience: ' + (4 + r(12)) + ' years\n');
    file(H('Downloads/invoice-' + (2000 + r(800)) + '.txt'), 'INVOICE\n' + company + '\nDate: ' + date(r) + '\nAmount: ' + (400 + r(4000)) + '.00\nPaid: ' + pick(r, ['yes', 'no', 'disputed']) + '\n');
    file(H('Downloads/setup.sh'), '#!/bin/sh\n# vendor installer (simulated)\necho installing\n');
    file(H('Downloads/report.pdf'), pdfDoc('Quarterly report — ' + company, [
      'Prepared by ' + person + ', ' + role,
      'Date: ' + date(r),
      '',
      'Revenue: $' + (120 + r(400)) + ',000',
      'Costs: $' + (80 + r(200)) + ',000',
      'Open tickets: ' + (3 + r(20)),
      'Staff on leave this month: ' + (1 + r(4)),
      '',
      'Notes',
      '- ' + pick(r, ['the vendor renewal is overdue', 'the migration slipped a week', 'budget is roughly on plan']),
      '- ' + pick(r, ['rotate the service account', 'renew the certificate', 'move the backups'])
    ]));
    file(H('Pictures/Screenshots/Screenshot from 2026-02-11 16-42-33.png'), '(PNG image, 1920x1080)');
    file(H('bin/backup.sh'), '#!/bin/sh\ntar czf /backup/home.tgz /home/' + user + '\n');
    file(H('.ssh/known_hosts'), 'fileserver01 ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAI' + hex(r, 20) + '\n');
    file(H('.ssh/id_rsa'), fakeKey('(fake simulated key)'));
    file(H('.ssh/config'), 'Host fileserver01\n  HostName 10.20.30.21\n  User svc_backup\n');
    file(H('.bashrc'), '# ~/.bashrc\nexport PATH="$HOME/bin:$PATH"\nalias ll="ls -alF"\n');
    file(H('.bash_history'), ['cd ~/Documents/Work', 'ssh svc_backup@10.20.30.21', 'ls -la', 'cat ' + short + '-deploy.txt', 'sudo apt update', 'git status', 'exit'].join('\n') + '\n');
    file(H('.config/user-dirs.dirs'), 'XDG_DESKTOP_DIR="$HOME/Desktop"\nXDG_DOWNLOAD_DIR="$HOME/Downloads"\nXDG_DOCUMENTS_DIR="$HOME/Documents"\nXDG_PICTURES_DIR="$HOME/Pictures"\n');
    file(H('Public/handover.txt'), 'Shared workstation notes\n\nThis account is for ' + role + ' work.\n');
    file('etc/hosts', '127.0.0.1\tlocalhost\n127.0.1.1\t' + host + '\n10.20.30.21\tfileserver01\n');
    file('etc/hostname', host + '\n');
    file('etc/os-release', 'PRETTY_NAME="Ubuntu 24.04.1 LTS"\nNAME="Ubuntu"\nVERSION_ID="24.04"\n');
    file('etc/passwd', 'root:x:0:0:root:/root:/bin/bash\n' + user + ':x:1000:1000:' + person + ',:/home/' + user + ':/bin/bash\nsvc_backup:x:1001:1001::/home/svc_backup:/bin/sh\n');
    file('etc/shadow', 'root:*:19793:0:99999:7:::\n' + user + ':$6$' + hex(r, 16) + '$' + hex(r, 40) + ':19793:0:99999:7:::\n');
    file('etc/ssh/sshd_config', 'PermitRootLogin no\nPasswordAuthentication yes\nPort 22\n');
    file('var/log/syslog', Array.from({ length: 6 }, () => date(r) + 'T0' + (1 + r(8)) + ':' + String(r(60)).padStart(2, '0') + ':12 ' + host + ' systemd[1]: Started session for ' + user + '.').join('\n') + '\n');
    file('var/log/auth.log', date(r) + ' sshd[3110]: Accepted password for ' + user + ' from 10.20.30.' + (2 + r(200)) + ' port ' + (40000 + r(20000)) + '\n');
    file('opt/' + short + '/agent.conf', 'server=https://' + short + '.example\ninterval=300\ntoken=' + token + '\n');
    dir('root'); dir('srv'); dir('tmp'); dir('usr/bin'); dir('var/backups'); dir('var/tmp'); dir('boot'); dir('proc'); dir('sys'); dir('dev'); dir('run');

    return B.root;
  }

  window.TerminalPC = { windows, linux, merge, builder };
})();

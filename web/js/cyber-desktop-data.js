// Offline desktop content. Tool names identify the Kali catalog; actions open guest utilities or recorded evidence.
(() => {
  const collections = [
    ['Information Gathering', 'inventory', 'Nmap, Amass, Maltego, Recon-ng, SpiderFoot, theHarvester, DNSRecon, assetfinder'],
    ['Vulnerability Analysis', 'advisories', 'Greenbone, Lynis, Nuclei, Nikto, Unix-privesc-check, Trivy'],
    ['Web Application Testing', 'headers', 'Burp Suite, OWASP ZAP, Caido, WhatWeb, Wapiti, Gobuster, feroxbuster'],
    ['Database Assessment', 'database', 'SQLite Browser, SQLite, sqlmap, jSQL Injection, oscanner'],
    ['Password Attacks', 'auth', 'John the Ripper, Hashcat, Hydra, CeWL, Ophcrack, HashID'],
    ['Wireless Attacks', 'wireless', 'Aircrack-ng, Kismet, Wifite, Airgeddon, Bettercap, BlueZ, hcxtools'],
    ['Reverse Engineering', 'binary', 'Ghidra, radare2, Cutter, Rizin, JADX, Apktool, Binwalk, GDB, objdump, strings'],
    ['Exploitation', 'incident', 'Metasploit Framework, Exploit Database, SearchSploit, RouterSploit'],
    ['Sniffing and Spoofing', 'traffic', 'Wireshark, TShark, tcpdump, NetworkMiner, mitmproxy, Ettercap, Bettercap'],
    ['Post-Exploitation', 'remote-session', 'BloodHound, PowerShell, NetExec, Impacket, Mimikatz'],
    ['Digital Forensics', 'forensics', 'Autopsy, The Sleuth Kit, Volatility, Guymager, ExifTool, Foremost, YARA, Chainsaw, Plaso'],
    ['Reporting', 'report', 'Faraday, Dradis, DefectDojo, CherryTree, Pipal'],
    ['Social Engineering', 'mail-triage', 'GoPhish, Social-Engineer Toolkit, Maltego']
  ].map(([name, exercise, names]) => ({ name, exercise, tools: names.split(', ') }));

  const cases = [
    ['remote-session', 'Post-Exploitation', 'Unexpected remote desktop session',
      '22:51 UTC  VPN: account=rina  device=assigned-laptop  action=logout\n23:07 UTC  Sign-in: account=rina  device=unknown  result=success\n23:09 UTC  Workstation: host=FIN-12  session=RDP  account=rina\n23:12 UTC  Ticket: no approved after-hours work for FIN-12\n23:14 UTC  Analyst: Rina confirms her assigned laptop was powered off',
      'Which response protects the workstation while retaining evidence?',
      ['Power off every workstation immediately', 'Preserve authentication logs, isolate FIN-12, and revoke suspect sessions', 'Wait for a second overnight session'],
      1, 'Preserve VPN, sign-in, and workstation telemetry. Isolate FIN-12, revoke suspect sessions, and confirm recovery with the account owner.'],
    ['mail-triage', 'Social Engineering', 'Mailbox investigation',
      'REPORT 331 — Received 08:42 UTC\nDisplay name: Payroll Service\nEnvelope sender: payroll-support@benefits-queue.example\nReply-To: review@external-mail.example\nSPF: fail    DKIM: none    DMARC: fail\nMessage ID: demo-payroll-331\nUser report: message requested approval of an unexpected sign-in.',
      'Which identifier helps scope the same message in retained mail logs?',
      ['The payroll display name alone', 'The size of the mailbox', 'The Message ID together with the envelope sender'],
      2, 'Preserve the original headers. Search for the Message ID and envelope sender, quarantine matching messages, then review sign-in activity for affected accounts.'],
    ['endpoint-alert', 'Digital Forensics', 'Unexpected software on a workstation',
      '09:20 UTC  EDR: unsigned executable observed on FIN-12\n09:21 UTC  Inventory: executable absent from approved software list\n09:23 UTC  EDR: program launched unexpectedly; schedule entry observed\n09:24 UTC  Analyst: same file digest found on FIN-09\n09:25 UTC  Backup dashboard: restore points available for both machines',
      'What should the response team do before restoring?',
      ['Isolate affected hosts and preserve endpoint records and file digests', 'Erase the alert records and restore immediately', 'Assume the second host is healthy because its hostname differs'],
      0, 'Isolate both endpoints. Preserve EDR records and digests, scope the alert across inventory, and validate clean restore points before recovery.'],
    ['database', 'Database Assessment', 'Database role review',
      'IDENTITY        EXPECTED ROLE       GRANTED ROLE\napi_reporting   read_only           schema_admin\napi_writer      insert_only         insert_only\nbackup_agent    backup_operator     backup_operator',
      'Which identity has excessive privileges?', ['backup_agent', 'api_reporting', 'api_writer'], 1,
      'Reduce api_reporting to read-only access and verify its reporting queries still work.'],
    ['dns-review', 'Information Gathering', 'DNS drift review',
      'RECORD                   APPROVED        OBSERVED\nfiles.lab.example        192.0.2.15      192.0.2.15\npayroll.lab.example      192.0.2.20      198.51.100.88\nprint.lab.example        192.0.2.31      192.0.2.31',
      'Which record differs from the approved inventory?', ['print.lab.example', 'files.lab.example', 'payroll.lab.example'], 2,
      'Verify the payroll record change with the DNS administrator and preserve the relevant zone-change history.'],
    ['baseline', 'Vulnerability Analysis', 'Configuration baseline',
      'CONTROL            BASELINE            OBSERVATION\nAudit logs         enabled             enabled\nSession timeout    15 minutes          disabled\nBackups            encrypted           encrypted',
      'Which setting is out of policy?', ['Session timeout', 'Backup encryption', 'Audit log collection'], 0,
      'Restore the approved idle timeout and document a verification test.'],
    ['integrity', 'Digital Forensics', 'Evidence chain of custody',
      'EVIDENCE       COLLECTOR       SHA-256 VERIFIED      TRANSFER\nLOG-17         R. Quinn        yes                   signed\nIMAGE-08       P. Fields       yes                   missing\nIMAGE-09       R. Quinn        yes                   signed',
      'Which item has a custody gap?', ['LOG-17', 'IMAGE-08', 'IMAGE-09'], 1,
      'Preserve IMAGE-08 and reconcile the unsigned transfer before relying on it in the final report.'],
    ['recovery', 'Reporting', 'Recovery verification',
      '09:43  FIN-12 isolated\n10:05  known-good image restored\n10:17  endpoint monitoring online\n10:20  approved user sign-in verified\n10:25  open item: review other hosts with the same file digest',
      'Which open item belongs in the handoff?', ['Close all alerts as recovered', 'Review other hosts for the same digest', 'Delete the timeline after sign-in'],
      1, 'Record verified recovery for FIN-12 and leave a named owner to review the remaining matching hosts.']
  ];

  const utilities = {
    digest: ['SHA-256', 'Compute a local digest of text or a selected file.', async (text, file) => {
      const bytes = file ? await file.arrayBuffer() : new TextEncoder().encode(text);
      const digest = await crypto.subtle.digest('SHA-256', bytes);
      return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
    }],
    base64: ['Decode Base64', 'Decode text locally as UTF-8.', text =>
      new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(atob(text.trim()), char => char.charCodeAt(0)))],
    json: ['Format JSON', 'Validate and format structured evidence.', text => JSON.stringify(JSON.parse(text), null, 2)],
    url: ['Inspect URL', 'Display the components of an address without visiting it.', text => {
      const url = new URL(text.trim());
      return JSON.stringify({ protocol: url.protocol, hostname: url.hostname, port: url.port, path: url.pathname,
        parameters: [...url.searchParams.keys()], fragment: url.hash, embeddedCredentials: Boolean(url.username || url.password) }, null, 2);
    }],
    indicators: ['Extract indicators', 'List unique IPv4 candidates, SHA-256 digests, and email addresses from evidence.', text => {
      const ips = (text.match(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g) || []).filter(ip => ip.split('.').every(part => Number(part) <= 255));
      const hashes = text.match(/\b[\da-f]{64}\b/gi) || [];
      const emails = text.match(/\b[\w.+-]+@[\w.-]+\.[a-z]{2,}\b/gi) || [];
      const groups = [['IPv4', ips], ['SHA-256', hashes], ['Email', emails]];
      return groups.map(([label, values]) => label + '\n' + ([...new Set(values)].join('\n') || 'None found')).join('\n\n');
    }],
    headers: ['Read mail headers', 'Extract selected fields from copied message headers.', text => {
      const fields = text.replace(/\r?\n[ \t]+/g, ' ').split(/\r?\n/);
      return fields.filter(line => /^(from|reply-to|return-path|received|authentication-results|message-id|subject)\s*:/i.test(line)).join('\n') || 'No matching header fields.';
    }]
  };

  const guide = [
    ['Getting started', 'Boot from Virtual Disk to resume a workspace or Live USB for temporary practice. Start with the Applications menu or use the dock. Use the outer Fullscreen button to expand the entire desktop.', 'settings', 'Open Settings'],
    ['Terminal and virtual files', 'Choose any shell, then select Sandbox, Puzzles, or Labyrinth. The Files app contains reference evidence. Copy evidence to Bash to inspect it from the command line, or drag a text file into the Bash terminal output.', 'terminal', 'Open Terminal'],
    ['Arrange your windows', 'Open more than one app from the dock or Applications. Drag a title bar to move a window, or drag its bottom-right corner to resize it. Click a minimized app in the dock to restore it.', 'notes', 'Open Notes'],
    ['Open a remote practice session', 'Generate a case in Remote Sessions and open an assigned fictional PC. Switch between its desktop, files, and console inside its own window. Reuse a seed to replay the same starting case.', 'remote', 'Open Remote Sessions'],
    ['Investigate an incident', 'Open the incident desk for a connected set of mail, remote access, endpoint, and recovery cases. Each case includes recorded evidence and a decision. Add completed findings to Notes for your handoff.', 'incidents', 'Open Incident Desk'],
    ['Explore the tools menu', 'Search Applications by tool or category. Catalog entries open the associated evidence exercise. Local utilities support hashing files, decoding Base64, formatting JSON, and parsing addresses and message headers.', 'catalog', 'Open Kali Tools'],
    ['Browse the fake internet', 'Moundshroud Browser opens your existing browser session, including its tabs and history — and it is where the generated sites open. Links in Mail go here; you can also type an address, or any words to search every generated site at once (Moundshroud Search). Government pages, leak archives, conspiracy boards and lots of ordinary shops are all in the index. About half the sites are booby-trapped, and an anti-malware window always appears to clean up.', 'browser', 'Open Moundshroud Browser'],
    ['Make it yours', 'Use Settings to choose a desktop layout, switch wallpapers, or import a PNG, JPEG, or WebP image. Live USB changes last until you reboot. The real browser retains its own Moundshroud settings.', 'settings', 'Open Appearance']
  ];
  A.cyberDesktopData = { cases, collections, utilities, guide };
})();

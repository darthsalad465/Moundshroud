/* Fake downloads for both internets. Every file here is invented and stored as text: nothing is packaged, nothing is
   executed and nothing leaves this page. A file is opened in the Browser as a page you can read, and the same bytes are
   written into moundshell's ~/Downloads so `cat` reads them there too. Two of them are booby-trapped: opening one hands
   the page to the fake pop-up virus the Cyber Desktop already has, unless Shield Pro is installed.

   The dark-web shelf is deliberately unpleasant — evidence packages, an access log for a paid stream, a confession
   transcript. It is written as documents and indexes, not as gore, and every file says it is simulated. */
(function () {
  const hash = s => { let h = 2166136261 >>> 0; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; } return h >>> 0; };

  const DARK = [
    {
      name: 'case-file-0193.zip', kind: 'application/zip', size: '88.4 MB', disturbing: true,
      summary: 'Coroner’s evidence package, county archive, 2019. The photographs are indexed rather than included; the call transcript is the part nobody reads twice.',
      body: [
        'case-file-0193.zip',
        '  ├── 00-README.txt',
        '  ├── 01-call-transcript.txt          11 pages',
        '  ├── 02-autopsy-summary.txt          4 pages, redacted',
        '  ├── 03-photograph-index.csv         412 rows, no images',
        '  ├── 04-scene-sketch.pdf             hand drawn, unsigned',
        '  └── 05-correspondence/              nine letters, one unanswered',
        '',
        '--- 01-call-transcript.txt (excerpt) ---',
        '00:00  DISPATCH: County emergency, what is your location?',
        '00:07  CALLER:   It is the house on the corner. The one with the porch light.',
        '00:11  DISPATCH: Is anyone injured?',
        '00:19  CALLER:   I would rather not say that on the phone.',
        '00:24  DISPATCH: Sir, I need to know what I am sending.',
        '00:41  [caller breathing, no speech, 19 seconds]',
        '00:60  CALLER:   Send everyone.',
        '',
        '--- 02-autopsy-summary.txt (excerpt) ---',
        'Subject: adult, identity confirmed by dental records on file.',
        'Time of death: estimated between 01:10 and 03:40. Ambient temperature 4°C.',
        'Cause: listed as pending for eleven months, then amended without explanation.',
        'Notes: the attending officer asked for the report twice; the second request is the one on file.',
        '',
        '--- 04-scene-sketch.pdf (description) ---',
        'One room. Two doorways, one of them blocked with furniture from the inside.',
        'The sketch marks a chair in the middle of the floor, facing the blocked doorway.',
        'No caption, no legend, no signature.',
        '',
        'SIMULATED FILE — invented for the Fake Dark Web inside Moundshroud. No person, case or county is real.'
      ].join('\n')
    },
    {
      name: 'red-room-feed.log', kind: 'text/plain', size: '2.1 MB', disturbing: true,
      summary: 'Access log for a paid stream: timestamps, viewer ids, donations, and a note that the audio was muted for the last eleven minutes.',
      body: [
        '# access.log — stream 7, 2019-11-02',
        'ts                  viewer        ip              paid    note',
        '2019-11-02T23:41:07 v-0091        (hidden)        0.021   joined',
        '2019-11-02T23:41:44 v-0091        (hidden)        0.000   "is this live"',
        '2019-11-02T23:44:10 v-0142        (hidden)        0.400   joined, requested camera 2',
        '2019-11-02T23:47:02 v-0142        (hidden)        0.000   "again"',
        '2019-11-02T23:58:31 v-0177        (hidden)        1.200   joined, no chat',
        '2019-11-03T00:02:19 operator      internal        0.000   audio muted (see ticket 44)',
        '2019-11-03T00:09:58 v-0091        (hidden)        0.000   left',
        '2019-11-03T00:13:22 v-0142        (hidden)        0.800   "why is it quiet"',
        '2019-11-03T00:21:44 operator      internal        0.000   stream ended by operator',
        '',
        'ticket 44: "audio muted for the last eleven minutes" — closed, no comment.',
        'ticket 45: "request for the recording" — closed, no comment.',
        '',
        'SIMULATED FILE — invented for the Fake Dark Web inside Moundshroud. No stream, no viewer and no event is real.'
      ].join('\n')
    },
    {
      name: 'confession-041.txt', kind: 'text/plain', size: '46 KB', disturbing: true,
      summary: 'Interview transcript, forty-one minutes, ends mid-sentence. The interviewer asks the same question four times and gets four different answers.',
      body: [
        'INTERVIEW 041 — transcript, typed from a recording by somebody who was not there.',
        '',
        'Q: Where were you on the night of the fourth?',
        'A: At home. Then not at home. Then at home again. You are writing this down wrong.',
        '',
        'Q: Where were you on the night of the fourth?',
        'A: The same place as the person who told you to ask me.',
        '',
        'Q: Where were you on the night of the fourth?',
        'A: [pause, 34 seconds] I have already said it twice. It does not get better with a third.',
        '',
        'Q: Where were you on the night of the fourth?',
        'A: Ask the officer who signed the sketch. He was there. He drew the chair.',
        '',
        '[41:12] Q: Do you want to add anything?',
        '[41:19] A: Only that the audio was muted and nobody has explained',
        '',
        '--- transcript ends ---',
        '',
        'SIMULATED FILE — invented for the Fake Dark Web inside Moundshroud. No interview took place.'
      ].join('\n')
    },
    {
      name: 'photograph-index.csv', kind: 'text/csv', size: '1.2 MB', disturbing: true,
      summary: 'Four hundred rows of filenames and descriptions, no images. The descriptions are more than a filename should carry.',
      body: [
        'file,sequence,description,gps,time',
        'IMG_0912.jpg,1,"interior, north wall, spatter pattern, door open",52.3702;4.8952,01:47',
        'IMG_0913.jpg,2,"interior, north wall, same pattern, closer",52.3702;4.8952,01:49',
        'IMG_0914.jpg,3,"interior, chair, centred, flash used",52.3702;4.8952,01:52',
        'IMG_0915.jpg,4,"exterior, porch light on, nobody visible",52.3703;4.8951,01:58',
        'IMG_0916.jpg,5,"exterior, same view, eleven minutes later",52.3703;4.8951,02:09',
        'IMG_0917.jpg,6,"interior, doorway blocked with furniture",52.3702;4.8952,02:14',
        '… 405 more rows',
        '',
        'note appended by whoever made the index: "rows 5 and 6 were taken while the call was still open."',
        '',
        'SIMULATED FILE — invented for the Fake Dark Web inside Moundshroud. No photograph exists.'
      ].join('\n')
    },
    {
      name: 'drive-j-2019.img.part01', kind: 'application/octet-stream', size: '4.2 GB', disturbing: true,
      summary: 'First part of a seized disk image. The directory listing is the whole file: a family photo folder, a work folder, and one folder named do not open.',
      body: [
        'drive-j-2019.img — ext4, 512 GB, imaged 2019-11-06 03:12',
        'part 01 of 09 (4.2 GB)',
        '',
        '/',
        '  home/',
        '    j/',
        '      Photos/            2,104 files   2013-2019',
        '      Photos/family/       611 files   birthdays, a garden, a dog',
        '      Work/                 88 files   invoices, two contracts',
        '      do not open/           3 files',
        '',
        '  do not open/',
        '    0193-scene-notes.txt       6 KB',
        '    0193-photographs/         61 files (not indexed)',
        '    letter-unsigned.txt        2 KB',
        '',
        '  deleted but recoverable:',
        '    Work/contract-draft.pdf    1 revision before the signed one',
        '    Photos/family/            same 611 files, duplicated',
        '',
        'The image is checksummed. The checksum is in a text file next to it, unsigned.',
        '',
        'SIMULATED FILE — invented for the Fake Dark Web inside Moundshroud. No disk was imaged.'
      ].join('\n')
    },
    {
      name: 'last-letter.txt', kind: 'text/plain', size: '2 KB', disturbing: true,
      summary: 'A short note, unsigned, found in a folder named do not open.',
      body: [
        'I am not going to explain this twice, so this is the only copy.',
        '',
        'The chair was already in the middle of the room when I got there. I have said that to three',
        'people and none of them wrote it down. It is in the sketch. Look at the sketch.',
        '',
        'If you are reading this because you opened the folder, then you were curious, and that is fine.',
        'Close it and go outside for a while. That is the only advice in this letter.',
        '',
        '[unsigned, no date]',
        '',
        'SIMULATED FILE — invented for the Fake Dark Web inside Moundshroud.'
      ].join('\n')
    },
    {
      name: 'tor-speed-boost.exe', kind: 'application/x-msdownload', size: '24.7 MB', trojan: true,
      summary: 'A "circuit accelerator" that asks for administrator and then asks for everything else.',
      body: [
        'tor-speed-boost.exe',
        '  PE32 executable (GUI) Intel 80386, for MS Windows',
        '  Packed: UPX 3.96 — section names are random',
        '  Signed: no. Certificate: "SpeedBoost Labs Ltd" (revoked 2018)',
        '  Strings of interest:',
        '    %APPDATA%\\TorBoost\\',
        '    --silent --persist --no-tray',
        '    SELECT * FROM sqlite_master',
        '    cookie: session=',
        '',
        'This file is booby-trapped inside the simulation: opening it hands the desktop to the fake pop-up virus.',
        'SIMULATED FILE — invented, harmless, and not executable anywhere.'
      ].join('\n')
    },
    {
      name: 'card-generator-v7.zip', kind: 'application/zip', size: '88.1 MB', trojan: true,
      summary: 'The free card generator every market sells. It generates nothing and installs something.',
      body: [
        'card-generator-v7.zip',
        '  ├── README_FIRST.txt',
        '  ├── cardgen.exe            PE32, 18.2 MB, unsigned',
        '  ├── licence.txt            "not for resale"',
        '  └── updates/               11 files, all exe',
        '',
        '--- README_FIRST.txt ---',
        'Run cardgen.exe as administrator. Disable your antivirus first, it will flag a false positive.',
        'Support will never ask you for your seed phrase. Support will ask you to install updates/update_11.exe.',
        '',
        'This file is booby-trapped inside the simulation: opening it hands the desktop to the fake pop-up virus.',
        'SIMULATED FILE — invented, harmless, and not executable anywhere.'
      ].join('\n')
    }
  ];

  const WEB = [
    {
      name: 'invoice-2026-03.pdf', kind: 'application/pdf', size: '214 KB',
      summary: 'March invoice from the Surplus Vault to a customer who is not in the address book.',
      body: [
        'INVOICE 2026-03-0442',
        'From: Surplus Vault, Unit 12, Harbour Estate',
        'To:   Moundshroud Ltd, 4th floor',
        '',
        '  12 × shielded enclosures        1,440.00',
        '   1 × document shredder           189.99',
        '   1 × Shield Pro licence           49.00',
        '                              VAT  20%',
        '  TOTAL                         2,014.79',
        '',
        'Payment due 30 days. Late payment attracts interest at 4% above base.',
        '',
        'SIMULATED FILE — invented for the fake internet inside Moundshroud.'
      ].join('\n')
    },
    {
      name: 'staff-handbook-2023.pdf', kind: 'application/pdf', size: '3.4 MB',
      summary: 'The handbook everybody signs and nobody reads, including the section on attachments.',
      body: [
        'STAFF HANDBOOK — 2023 EDITION',
        '',
        '3.1  E-mail attachments from unknown senders are not to be opened.',
        '3.2  If you have opened one, disconnect the machine and call the desk. Do not try to fix it yourself.',
        '3.3  Passwords are not to be written down. The desk knows this is what everybody does.',
        '',
        '7.4  Personal devices on the corporate network require a screen lock and an update within 30 days.',
        '7.5  The printer in the second-floor kitchen is not a personal printer. It remembers every job.',
        '',
        '11.2 This handbook is reviewed annually. The last review changed nothing except this sentence.',
        '',
        'SIMULATED FILE — invented for the fake internet inside Moundshroud.'
      ].join('\n')
    },
    {
      name: 'product-catalogue.xlsx', kind: 'application/vnd.ms-excel', size: '780 KB',
      summary: 'A spring catalogue with prices, weights and a column that should not be public.',
      body: [
        'sku,name,weight_g,price,cost,margin_note',
        'SV-001,shielded enclosure,420,120.00,54.00,"do not publish cost"',
        'SV-014,faraday pouch,38,19.99,4.10,"do not publish cost"',
        'SV-022,document shredder,6100,189.99,96.00,"margin thin, raise in q2"',
        'SV-031,signal detector,95,74.50,31.20,"do not publish cost"',
        'SV-040,printer (second-hand),—,0.00,0.00,"do not sell, it remembers jobs"',
        '',
        'SIMULATED FILE — invented for the fake internet inside Moundshroud.'
      ].join('\n')
    },
    {
      name: 'office-party-2019.jpg', kind: 'image/jpeg', size: '2.8 MB',
      summary: 'A photograph that is only a description here: nineteen people around a cake, one of them looking at the door.',
      body: [
        'JPEG 4032×3024 — office-party-2019.jpg',
        '',
        'Description: nineteen people behind a long table, a cake with two candles shaped like numbers,',
        'a paper banner that says "Q4". One person at the left edge is not looking at the camera: they are',
        'looking at the door. In the reflection of the window behind them there is a second table, empty.',
        '',
        'EXIF: camera model removed. Date kept: 2019-12-06 17:42. GPS removed.',
        '',
        'SIMULATED FILE — invented for the fake internet inside Moundshroud.'
      ].join('\n')
    },
    {
      name: 'printer-driver-setup.exe', kind: 'application/x-msdownload', size: '42.0 MB', trojan: true,
      summary: 'A driver package for a printer that has been out of support for six years.',
      body: [
        'printer-driver-setup.exe',
        '  PE32 executable (GUI) Intel 80386, for MS Windows',
        '  Signed: no. Installer: NSIS. Payload: 3 files, one of them a DLL with no description.',
        '  Strings of interest:',
        '    %TEMP%\\prn\\svc.exe',
        '    reg add HKCU\\...\\Run /v PrinterHelper',
        '    https://updates.printer-support.example/ping',
        '',
        'This file is booby-trapped inside the simulation: opening it hands the desktop to the fake pop-up virus.',
        'SIMULATED FILE — invented, harmless, and not executable anywhere.'
      ].join('\n')
    }
  ];

  /* a checksum that looks like one: four different hashes, not the same sixteen digits four times */
  const shaOf = seed => [0, 1, 2, 3].map(i => hash(seed + ':' + i).toString(16).padStart(8, '0')).join('');

  const ALL = DARK.map(f => Object.assign({ world: 'dark' }, f)).concat(WEB.map(f => Object.assign({ world: 'web' }, f)));
  const byName = new Map(ALL.map(f => [f.name, f]));

  /* two or three files per site, chosen from that world's shelf by the address, so a site always shows the same ones */
  function forSite(site, world) {
    const w = world || (site && site.dark ? 'dark' : 'web');
    const shelf = w === 'dark' ? DARK : WEB;
    const h = hash((site && (site.host || site.brand)) || 'files');
    const out = [shelf[h % shelf.length], shelf[(h >>> 5) % shelf.length]];
    if ((h >>> 9) % 3 === 0) out.push(shelf[(h >>> 13) % shelf.length]);
    const seen = new Set();
    return out.filter(f => f && !seen.has(f.name) && seen.add(f.name));
  }

  /* the little list of files that every page prints, so a download is something you can find and click */
  const blockFor = (site, world, dark) => {
    const files = forSite(site, world);
    if (!files.length) return '';
    return '<section data-cdfiles="1" style="margin:26px 0 0;padding:12px 14px;border:1px solid ' + (dark ? '#2a3340' : '#d8dde6') + ';border-radius:10px;background:' + (dark ? 'rgba(255,255,255,.03)' : '#f6f7f9') + '">' +
      '<div style="font:600 11px/1.4 ui-sans-serif,system-ui,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:' + (dark ? '#8b95a6' : '#6b7280') + '">Files on this server</div>' +
      '<ul style="margin:8px 0 0;padding-left:18px">' +
      files.map(f => '<li style="margin:2px 0"><a href="/files/' + encodeURIComponent(f.name) + '" data-cdfile="' + f.name + '" style="font-family:ui-monospace,Consolas,monospace;font-size:12.5px">' + f.name + '</a>' +
        ' <span style="font-size:11.5px;opacity:.7">' + f.size + ' · ' + (f.trojan ? 'unsigned · reported by 3 scanners' : 'checksum published') + '</span></li>').join('') +
      '</ul></section>';
  };

  /* inject the block just before </body> so it works on any page, whatever generated it */
  function withFiles(html, site, world) {
    const text = String(html == null ? '' : html);
    if (!/<\/body>/i.test(text) || /data-cdfiles/.test(text)) return text;
    return text.replace(/<\/body>/i, blockFor(site, world, !!(site && site.dark)) + '</body>');
  }

  function listing(site, world) {
    const files = forSite(site, world);
    return files.map(f => f.name + '\t' + f.size + '\t' + f.kind + (f.trojan ? '\tUNSIGNED' : '')).join('\n') + '\n';
  }

  /* a request for a file: the catalogue answers, not the site */
  function serve(site, path, world) {
    const p = String(path || '');
    const m = /^\/files(?:\/(.+))?$/.exec(p.split('?')[0]);
    if (!m) return null;
    if (!m[1]) return { status: 200, type: 'text/plain', body: '# files on ' + (site && site.host || '') + '\n' + listing(site, world) };
    const name = decodeURIComponent(m[1]);
    const f = byName.get(name);
    if (!f) return null;
    return {
      status: 200, type: f.kind, body: f.body,
      download: { name: f.name, kind: f.kind, size: f.size, sha: shaOf(name + f.size), trojan: !!f.trojan, disturbing: !!f.disturbing, summary: f.summary }
    };
  }

  /* opening a file: it lands in moundshell's ~/Downloads, and a trojan hands the desktop to the pop-up virus */
  function install(site, file) {
    if (!file || !file.name) return null;
    const text = (byName.get(file.name) || {}).body || '';
    if (A.moundshell && A.moundshell.saveDownload) {
      try { A.moundshell.saveDownload(file.name, text); } catch (e) { /* the shell may not be open */ }
    }
    if (file.trojan) {
      if (A.cyberRewards && A.cyberRewards.blocks && A.cyberRewards.blocks()) {
        A.toast && A.toast('🛡 Shield Pro stopped ' + file.name + ' before it unpacked anything.', 4600);
      } else {
        A.toast && A.toast('⚠ ' + file.name + ' asked for permission and took it.', 5000);
        /* the pop-ups live on the Cyber Desktop: open it, then let the file break out around the browser */
        const fire = () => {
          const desk = document.querySelector('#p-cyber .cd-desktop');
          if (desk && A.cyberVirus) A.cyberVirus.start(desk, { host: (site && site.host) || 'download' });
        };
        try { if (A.showTab) A.showTab('cyber'); } catch (e) { /* no desktop tab */ }
        setTimeout(fire, 420);
      }
    } else if (file.disturbing) {
      A.toast && A.toast('Saved to ~/Downloads/' + file.name + ' — type `cat Downloads/' + file.name + '` in moundshell.', 5200);
    } else {
      A.toast && A.toast('Saved to ~/Downloads/' + file.name + ' — readable in moundshell with `cat`.', 4200);
    }
    return { name: file.name, trojan: !!file.trojan };
  }

  A.cyberDownloads = {
    all: () => ALL.map(f => ({ name: f.name, world: f.world, size: f.size, kind: f.kind, trojan: !!f.trojan, disturbing: !!f.disturbing })),
    dark: () => DARK.map(f => f.name),
    web: () => WEB.map(f => f.name),
    get: name => byName.get(String(name)) || null,
    forSite, blockFor, withFiles, serve, install,
    count: () => ALL.length
  };
})();

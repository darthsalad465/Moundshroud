// Terminal lore, deep layer: turns the generated case disk into a whole simulated PC instead of a tidy folder.
// Ordinary paperwork, hundreds of cache/junk files, personal and embarrassing material, corporate and government
// documents, sealed files, full-length essays, and the Moundshroud house lore with its own jokes and manuals.
// Everything is invented fiction and stays in this page. It wraps TerminalLore.disk, so every random sandbox case
// (bash / PowerShell / cmd), every Scenario Lab build and every seeded puzzle disk gets the deeper layout for free.
(function () {
  const L = window.TerminalLore;
  if (!L || L.deep) return;

  /* ---------------- seeded helpers ---------------- */
  function rng(seed) {
    let s = (seed >>> 0) || 0x2545f491;
    return () => {
      s ^= s << 13; s >>>= 0;
      s ^= s >>> 17;
      s ^= s << 5; s >>>= 0;
      return s / 4294967296;
    };
  }
  const r = rng;
  const pad = (n, k = 2) => String(n).padStart(k, '0');

  const FIRST = ['Ada', 'Bram', 'Cyrus', 'Delia', 'Elias', 'Farid', 'Greta', 'Hosni', 'Ines', 'Jonas', 'Kira', 'Lars', 'Mira', 'Noor', 'Oskar', 'Priya', 'Quinn', 'Rosa', 'Sami', 'Tessa', 'Umar', 'Vera', 'Wren', 'Yusuf', 'Zara', 'Tomas', 'Nadia', 'Rafe', 'Ilse', 'Marek', 'Sabine', 'Otto', 'Lena', 'Piet',
    'Beatriz', 'Callum', 'Dagny', 'Emeka', 'Fen', 'Gwendolyn', 'Halil', 'Imogen', 'Jarek', 'Kofi', 'Lucia', 'Matti', 'Nell', 'Olu', 'Perrin', 'Rahal', 'Saoirse', 'Teodor', 'Ulla', 'Viktor', 'Wilma', 'Ximena', 'Yannick', 'Zofia', 'Amara', 'Bilal', 'Caoimhe', 'Dmitri', 'Elif', 'Faye', 'Goran', 'Hattie', 'Ismail', 'Juno', 'Katarina', 'Leif', 'Maeve', 'Nabil', 'Orla', 'Pavel', 'Rhea', 'Soren', 'Tamsin', 'Ugo', 'Vesna', 'Wanda', 'Yara', 'Zeb'];
  const LAST = ['Abara', 'Beck', 'Calder', 'Duarte', 'Eklund', 'Farkas', 'Grieve', 'Halvorsen', 'Ibarra', 'Jelinek', 'Kowalski', 'Lindqvist', 'Moreau', 'Nakamura', 'Okafor', 'Petrov', 'Quiroga', 'Rasmussen', 'Sokolov', 'Tamm', 'Ulrich', 'Vasquez', 'Weiss', 'Yilmaz', 'Zeller', 'Brandt', 'Ferreira', 'Novak', 'Achterberg', 'Strand', 'Voss', 'Mbeki', 'Ionescu',
    'Almeida', 'Bakker', 'Castellano', 'Dvorak', 'Eriksen', 'Fitzgerald', 'Gallagher', 'Haddad', 'Iversen', 'Jansen', 'Kaur', 'Larsen', 'Mensah', 'Nystrom', 'Oyelaran', 'Pahlavi', 'Quist', 'Rahimi', 'Salvatore', 'Tanaka', 'Urbina', 'Vukovic', 'Whitfield', 'Xavier', 'Yates', 'Zielinski', 'Adeyemi', 'Brennan', 'Costa', 'Dimitrov'];
  const CITIES = ['Rotterdam', 'Trieste', 'Almaty', 'Valparaiso', 'Mombasa', 'Busan', 'Antwerp', 'Constanta', 'Manzanillo', 'Port Klang', 'Tema', 'Santos', 'Zadar', 'Batroun', 'Odesa', 'Reykjavik', 'Cork', 'Tbilisi',
    'Klaipeda', 'Gdansk', 'Bilbao', 'Palermo', 'Alexandria', 'Dakar', 'Lagos', 'Dubai', 'Karachi', 'Chennai', 'Jakarta', 'Kaohsiung', 'Yokohama', 'Auckland', 'Vancouver', 'Halifax', 'Houston', 'Veracruz', 'Callao', 'Montevideo', 'Durban', 'Casablanca', 'Tunis', 'Beirut', 'Batumi', 'Riga', 'Tallinn', 'Helsinki', 'Bergen', 'Aberdeen'];
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const MARKS = ['UNCLASSIFIED', 'RESTRICTED', 'CONFIDENTIAL', 'SECRET', 'SECRET//NOFORN', 'TOP SECRET//SI//NOFORN', 'INTERNAL — DO NOT DISTRIBUTE', 'PROPRIETARY — LITIGATION HOLD', 'SEALED — JUDGE ONLY', 'EYES ONLY — DIRECTORATE',
    'INTERNAL USE ONLY', 'HANDLE VIA COURIER', 'NO COPIES', 'AUTHORISED EYES ONLY', 'SANITISED COPY', 'ARCHIVE — DO NOT DESTROY', 'WORKING DRAFT — NOT FOR FILING', 'COMMERCIAL IN CONFIDENCE'];

  function ctx(seed) {
    const rand = rng(seed);
    const int = (a, b) => a + Math.floor(rand() * (b - a + 1));
    const pick = list => list[Math.floor(rand() * list.length)];
    const chance = p => rand() < p;
    const many = (n, f) => Array.from({ length: Math.max(0, n) }, (_, i) => f(i));
    const first = () => pick(FIRST);
    const last = () => pick(LAST);
    const person = () => first() + ' ' + last();
    const date = (from = 2016, to = 2026) => int(from, to) + '-' + pad(int(1, 12)) + '-' + pad(int(1, 28));
    const time = () => pad(int(0, 23)) + ':' + pad(int(0, 59)) + ':' + pad(int(0, 59));
    const hex = k => many(k, () => '0123456789abcdef'[(rand() * 16) | 0]).join('');
    const num = k => many(k, () => '0123456789'[(rand() * 10) | 0]).join('');
    const money = (a, b) => (int(a, b) * 1000).toLocaleString('en-US');
    const ip = () => '10.' + int(0, 9) + '.' + int(0, 254) + '.' + int(2, 254);
    const file = k => pick(['doc', 'scan', 'memo', 'note', 'rec']).toUpperCase() + '_' + num(k);
    const city = () => pick(CITIES);
    const mark = () => pick(MARKS);
    const caseNo = () => pick(['CF', 'OP', 'DJ', 'SEQ', 'SOC', 'CASE', 'SEAL']) + '-' + int(2018, 2026) + '-' + num(4);
    const cyc = (list, i) => list[i % list.length];
    return { rand, r: rand, int, pick, chance, many, first, last, person, date, time, hex, num, money, ip, file, city, mark, caseNo, cyc };
  }

  /* fill(): {tokens} and {a|b|c} alternation, so one paragraph template yields endless variants */
  function fill(text, c, extra) {
    return String(text).replace(/\{([^{}]+)\}/g, (m, expr) => {
      if (expr.indexOf('|') >= 0) { const list = expr.split('|'); return list[Math.floor(c.rand() * list.length)]; }
      switch (expr) {
        case 'name': return c.person();
        case 'first': return c.first();
        case 'last': return c.last();
        case 'date': return c.date();
        case 'time': return c.time();
        case 'city': return c.city();
        case 'num': return c.num(4);
        case 'hex': return c.hex(10);
        case 'money': return c.money(12, 900);
        case 'ip': return c.ip();
        case 'file': return c.file(4);
        case 'case': return c.caseNo();
        case 'mark': return c.mark();
        case 'month': return c.pick(MONTHS);
        case 'org': return (extra && extra.org) || 'the company';
        case 'unit': return (extra && extra.unit) || 'the unit';
        case 'role': return (extra && extra.role) || 'the officer';
        case 'domain': return (extra && extra.domain) || 'example.internal';
        default: return m;
      }
    });
  }

  /* ---------------- the content banks ---------------- */
  const C = window.TerminalLoreContent || {};
  const bank = (key, fallback) => Array.isArray(C[key]) && C[key].length ? C[key] : fallback;
  const essaysBank = bank('ESSAYS', [{ slug: 'empty', title: 'Nothing to see', tag: 'note', paras: ['This disk has no essays on it.'] }]);
  const sealedBank = bank('SEALED', []);
  const corpBank = bank('CORP', []);
  const personalBank = bank('PERSONAL', []);
  const jokeBank = bank('JOKES', []);
  const manualBank = bank('MANUAL', []);
  const mailBank = bank('MAIL', []);
  const chatBank = bank('CHAT', []);
  const hrBank = bank('HR', []);
  const appLore = C.APP || {};
  const secretsBank = bank('SECRETS', []);
  const appNotesBank = bank('APP_NOTES', []);
  const notesBank = bank('NOTES', []);

  /* ---------------- sizes: the difficulty of the whole scenario ---------------- */
  const LEVELS = {
    easy: { files: 130, essays: 4, sealed: 1, personal: 4, junk: 60, secrets: 3, label: 'Small laptop — a few folders, one secret' },
    normal: { files: 320, essays: 9, sealed: 3, personal: 10, junk: 180, secrets: 7, label: 'Workstation — paperwork, mail, a few bad decisions' },
    deep: { files: 700, essays: 16, sealed: 8, personal: 22, junk: 520, secrets: 13, label: 'Full PC — every folder, months of history' },
    insane: { files: 1400, essays: 32, sealed: 18, personal: 40, junk: 1250, secrets: 22, label: 'Seized machine — the whole life on it' }
  };
  function levelOf(opts, seed) {
    const named = String(opts.difficulty || '').toLowerCase();
    if (LEVELS[named]) return named;
    // no difficulty asked for: the seed decides, so every randomize gives a different sized machine
    if (seed != null) {
      const pickList = ['normal', 'deep', 'deep', 'insane', 'deep', 'normal', 'deep'];
      return pickList[(seed >>> 0) % pickList.length];
    }
    return 'deep';
  }

  /* ---------------- writers ---------------- */
  function planter(files) {
    return function put(path, text) {
      const clean = String(path || '').replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/{2,}/g, '/');
      if (!clean || clean.split('/').some(p => p === '..' || p === '.')) return;
      if (files[clean] == null) files[clean] = String(text == null ? '' : text).replace(/\r?\n?$/, '\n');
    };
  }

  /* ---------------- an essay: long, paged, rotated ---------------- */
  function essay(bankItem, c, extra, pages) {
    const paras = bankItem.paras.slice();
    const order = paras.map(p => [c.rand(), p]).sort((a, b) => a[0] - b[0]).map(x => x[1]);
    const want = Math.max(6, Math.min(pages || 16, order.length * 2));
    const body = [];
    for (let i = 0; i < want; i++) body.push(fill(order[i % order.length], c, extra));
    const title = fill(bankItem.title, c, extra);
    const head = ['# ' + title, '', fill(bankItem.tag || '', c, extra), 'Draft ' + c.date(2024, 2026) + ' · ' + c.num(4) + ' words in the margin · do not circulate', ''];
    return head.concat(body).join('\n\n') + '\n';
  }

  /* ---------------- app lore: Moundshroud itself, in every disk ---------------- */
  function moundshroudFiles(put, c, extra, win, deep) {
    const base = win ? 'Documents/' : '';
    const dir = base + 'Moundshroud/';
    put(dir + 'READ-ME-FIRST.txt', [
      'MOUNDSHROUD — offline assistant build notes',
      'Copied here by hand so it survives the next wipe. If you are reading this on someone else\'s machine, hello,',
      'you are exactly the kind of person this was written for.',
      '',
      'Moundshroud is the codename. The product name is whatever the installer felt like that week.',
      'It runs on the machine in front of you: models, sandboxes, terminals, the lot. No account, no cloud, no telemetry.',
      'That is not a marketing line, it is a rule the original author wrote on a wall.',
      '',
      'Rules, in order of importance:',
      '  1. Nothing leaves the machine unless a human clicks something that says it leaves the machine.',
      '  2. Every simulation says it is a simulation, in the file, where the learner can read it.',
      '  3. The exercises teach real habits on invented data. Never point them at a machine you do not own.',
      '  4. There is no field six. There has never been a field six. Stop asking about field six.',
      '',
      'Build: ' + c.date(2026, 2026) + ' · ' + c.hex(8) + ' · ' + (deep ? 'deep disk layout enabled' : 'standard disk layout'),
      'Owner of this copy: ' + c.person() + ', ' + (extra.role || 'staff')
    ].join('\n'));

    put(dir + 'manual/00-why-offline.md', [
      '# Why this thing is offline',
      '',
      'Because the interesting part of a computer is what it does when nobody is watching it, and that is also the part',
      'nobody can audit from a dashboard. An assistant that needs a data centre to answer a question about a text file is',
      'a subscription with a chat window. Moundshroud is a workshop: the lathe is in the room, the wood is yours, the',
      'sawdust is a problem you own.',
      '',
      'Every simulation in the terminal is invented for practice: invented hosts, invented people, invented paperwork.',
      'When a range tells you something is fictional, it is not covering for a bug. It is telling you the truth about the',
      'range. The techniques are real; the victim is a paragraph of JavaScript.',
      '',
      'Moundshroud died twice and came back. The first time was a hard drive in ' + c.city() + '. The second time was a',
      'licensing email. Both times the answer was the same: keep the files, rewrite the wheel, do not ask permission from',
      'a company that does not know you exist.'
    ].join('\n'));

    put(dir + 'manual/01-the-mound.md', [
      '# The Mound',
      '',
      'The name is not a brand. It is a place. A mound: the ground that grows over a thing that was buried and not',
      'finished. In the old story the mound was a landfill outside ' + c.city() + ' that a municipal contractor kept',
      'paying to be quiet about. In this project the mound is the pile of unindexed files every computer turns into after',
      'two years: the half-renamed exports, the twenty-three versions of a letter, the photographs nobody opened, the',
      'folder called new folder (2).',
      '',
      'Moundshroud is what you get when you stop pretending that pile is a filing system and start reading it like an',
      'archaeologist. The app is not a search box. It is a trowel.'
    ].join('\n'));

    const chapters = manualBank.length ? manualBank : [
      { title: 'Chapter: the terminal', text: 'The terminal is a promise that the keyboard is enough. Every range in it is simulated, every host invented, and the only network is the one between your chair and the screen.' },
      { title: 'Chapter: the sandboxes', text: 'A sandbox is a machine that agrees to be broken. Each one has its own disk, its own awkward paper trail, and its own reason to be embarrassed.' },
      { title: 'Chapter: the field', text: 'Fields are columns. Six was a coincidence that became a superstition. There are eight now, sometimes ten, and the one you need is labelled.' }
    ];
    chapters.forEach((ch, i) => {
      put(dir + 'manual/' + pad(i + 1) + '-' + String(ch.title || 'chapter').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '.md',
        '# ' + fill(ch.title || 'Chapter', c, extra) + '\n\n' + fill(ch.text || '', c, extra) + '\n\n' + fill('— recorded ' + '{date}' + ', revised for build ' + c.hex(6) + '.', c, extra));
    });

    put(dir + 'CHANGELOG.md', ['# Changelog', '', 'All dates invented. All versions real enough to argue about.', ''].concat(
      c.many(28, i => '- ' + c.date(2024, 2026) + ' · v0.' + c.int(9, 40) + '.' + c.int(0, 9) + ' · ' +
        c.pick(['sandbox: a disk can now be 30x larger without freezing the tab', 'lore: essays are generated instead of copied',
          'terminal: field six is no longer hard-coded (it never was, allegedly)', 'pentest range: deeper floors rotate the privesc',
          'scenarios: difficulty now decides how much of a life is on the disk', 'jokes: removed one joke that broke the build',
          'jokes: added it back, it was worth it', 'fix: the thing that said extract field six every time']))
    ).join('\n') + '\n');

    put(dir + 'jokes/adult-jokes-about-the-app.txt', [
      'MOUNDSHROUD — internal humour, do not ship, do not screenshot, do not send to the person who filed the complaint.',
      'These are about the software. Nobody in them is real. If you are offended, you are probably field six.',
      ''
    ].concat(c.many(Math.max(10, jokeBank.length), i => '- ' + fill(jokeBank[i % Math.max(1, jokeBank.length)] || 'The app has a long context and it still will not remember your birthday.', c, extra))).join('\n') + '\n');

    put(dir + 'internal/slack-export.txt', ['#team-moundshroud export · ' + c.date(2026, 2026), ''].concat(
      c.many(deep ? 60 : 26, () => '[' + c.time() + '] ' + c.first().toLowerCase() + ': ' + fill(c.pick([
        'who pushed to main at 2am and why was the message {a|two words|a haiku}',
        'the sandbox is 700 files now and my laptop has become a space heater',
        'reminder that the exercise data is invented. INVENTED. stop apologising to it',
        'field six is a column index not a personality trait',
        'I asked for 30x more lore and it gave me 30x more lore. I have created a monster and it has essays',
        'the mound is not a metaphor, it is my downloads folder',
        'shipping the joke file was the best product decision we made this quarter',
        'if the range says fictional, it means fictional, we are not liable for your feelings about the fictional CFO'
      ]), c, extra)))
    .join('\n') + '\n');

    if (appLore.release) put(dir + 'internal/release-plan.txt', fill(appLore.release, c, extra) + '\n');

    /* app notes: the things the people building this would scribble in the repo, on every disk, never the same set */
    const appNotes = appNotesBank.length ? appNotesBank : ['The app notes live in the repo, not in a sandbox.'];
    const noteCount = deep ? 4 + c.int(0, 3) : 2 + c.int(0, 2);
    for (let i = 0; i < noteCount; i++) {
      const topic = c.pick(['terminal', 'editor', 'puzzles', 'labyrinth', 'shell', 'mcode', 'tests', 'telemetry', 'release', 'sandbox', 'notes', 'privacy']);
      put(dir + 'app-notes/' + topic + '-' + (i + 1) + '.txt', ['# app note · ' + topic, '', c.pick(appNotes), '', '— kept with the code, not with the product copy'].join('\n'));
    }
  }

  /* ---------------- a whole PC worth of ordinary life ---------------- */
  const PIC = ['holiday-{num}.jpg', 'screenshot-{num}.png', 'IMG_{num}.jpg', 'receipt-{num}.jpg', 'passport-scan.jpg', 'wedding-{num}.jpg', 'cat-{num}.jpg', 'whiteboard-{num}.png', 'dashboard-{num}.png'];

  /* the junk drawer: a wide pool of cache/log/temp templates, picked at random so two disks of the same size
     never look alike. The count comes from the level, not from the number of templates. */
  const JUNK_ROOTS = {
    win: ['AppData/Local/', 'AppData/Roaming/', 'Temp/', 'Windows/Temp/', 'AppData/LocalLow/', 'ProgramData/Cache/', 'Windows/Logs/', 'AppData/Local/Temp/'],
    posix: ['.cache/', '.local/share/', 'tmp/', '.config/', '.local/state/', 'var/tmp/', '.local/lib/', 'var/cache/', '.cache/thumbnails/', 'snap/cache/']
  };
  const LOG_LEVELS = ['INFO', 'WARN', 'DEBUG', 'TRACE', 'NOTICE', 'ERROR', 'VERBOSE', 'AUDIT'];
  const LOG_EVENTS = ['flush ok', 'retry 1/3', 'cache hit', 'cache miss', 'socket idle', 'window focus', 'autosave skipped', 'index rebuilt', 'token refreshed', 'connection reset', 'queue drained', 'handshake done', 'poll backoff', 'state saved', 'watcher restart', 'dns lookup', 'render frame', 'lock acquired'];
  const APP_NAMES = ['sync', 'notes', 'mail', 'calendar', 'chat', 'files', 'clock', 'backup', 'update', 'player', 'photo', 'print', 'vpn', 'clipboard', 'search', 'weather', 'disk', 'auth', 'agent', 'driver'];
  const BROWSER_SITES = ['intranet', 'docs', 'wiki', 'mail', 'search', 'news', 'helpdesk', 'status', 'git', 'boards', 'files', 'admin'];
  const BROWSER_PATHS = ['index', 'inbox', 'notes', 'search', 'hr/payroll', 'it/onboarding', 'news/2026', 'kb/how-to-lie-in-a-status-report', 'tickets/open', 'reports/weekly', 'settings/profile', 'downloads', 'wiki/onboarding', 'status/incidents', 'help/printing'];
  const ACTIONS = ['navigate', 'download', 'bookmark', 'search', 'upload', 'print', 'login', 'logout', 'share', 'refresh'];

  function junkFiles(put, c, count, win) {
    const roots = win ? JUNK_ROOTS.win : JUNK_ROOTS.posix;
    const app = () => c.pick(APP_NAMES);
    const stamp = () => c.date(2025, 2026) + '-' + c.hex(3);
    const shapes = [
      () => ['chrome/Cache/Cache_Data/f_' + c.hex(6), '# cache entry ' + c.hex(40) + '\ncontent-type: ' + c.pick(['image/webp', 'text/css', 'application/json', 'font/woff2', 'image/png']) + '\nsize: ' + c.int(900, 900000)],
      () => [app() + '/logs/app-' + c.date(2025, 2026) + '.log', c.many(6 + c.int(0, 14), () => c.date(2026, 2026) + 'T' + c.time() + 'Z ' + c.pick(LOG_LEVELS) + ' ' + c.pick(LOG_EVENTS) + ' pid=' + c.int(1000, 65000)).join('\n')],
      () => ['thumbnails/thumb_' + c.hex(10) + '.dat', 'thumbnail cache\nsrc: Pictures/' + fill(c.pick(PIC), c) + '\nsize: ' + c.int(2, 48) + 'KB\nquality: ' + c.int(40, 95)],
      () => ['updates/patch-' + c.int(100, 999) + '.manifest', 'package: ' + c.pick(['moundshroud', 'runtime', 'fonts', 'engine', 'terminal', 'media', 'models']) + '\nsha256: ' + c.hex(64) + '\nchannel: ' + c.pick(['stable', 'beta', 'nightly', 'lts', 'canary']) + '\nsize: ' + c.int(2, 900) + 'KB'],
      () => ['crash/dump_' + c.hex(8) + '.txt', 'signal: ' + c.pick(['SIGSEGV', 'SIGABRT', 'OOM', 'SIGILL', 'SIGBUS', 'STACK_OVERFLOW']) + '\nthread: ' + c.int(1, 64) + '\nbuild: ' + c.hex(6) + '\nnote: ' + c.pick(['reproducible', 'unknown', 'same as last week', 'fixed by reboot', 'not fixed by reboot', 'only on the second monitor'])],
      () => [app() + '/logs/browser-' + c.date(2025, 2026) + '.log', c.many(5, () => c.time() + ' ' + c.pick(ACTIONS) + ' ' + c.pick(BROWSER_SITES) + '/' + c.pick(BROWSER_PATHS) + ' ' + c.int(20, 4000) + 'ms').join('\n')],
      () => ['fonts/fontcache-' + c.hex(12) + '.dat', 'glyph cache\nfamilies: ' + c.int(4, 90) + '\nrebuilt: ' + c.date(2025, 2026) + ' ' + c.time() + '\nhint: ' + c.pick(['subpixel', 'grayscale', 'none'])],
      () => ['icons/icon-' + c.hex(8) + '.png', 'png header stub\n' + c.hex(64) + '\n' + c.hex(64)],
      () => [c.pick(['npm/_cacache', 'pip/http', 'cargo/registry', 'go-build', 'yarn/v6']) + '/' + c.hex(2) + '/' + c.hex(24), 'cache blob\nkey: ' + c.hex(32) + '\nhits: ' + c.int(0, 400) + '\nbytes: ' + c.int(64, 90000)],
      () => ['locks/' + app() + '-' + c.int(1000, 65000) + '.lock', 'pid=' + c.int(1000, 65000) + '\nhost=' + c.pick(['DEV-BOX', 'dev-box', 'workstation']) + '\nstarted=' + c.date(2026, 2026) + ' ' + c.time() + '\nstale=' + c.pick(['no', 'yes', 'unknown'])],
      () => ['db/local-' + c.int(1, 9) + '.sqlite-journal', c.hex(48) + '\n' + c.hex(48) + '\n' + c.hex(48)],
      () => ['spool/print-' + c.num(5) + '.spl', 'job: ' + c.pick(['status-report.pdf', 'invoice.pdf', 'ticket.pdf', 'form-17.pdf']) + '\npages: ' + c.int(1, 40) + '\nprinter: ' + c.pick(['HP-OfficeJet', '\\\\print01\\receipts', 'Canon-MX490', 'PDF-Printer'])],
      () => ['ssh/' + c.pick(['known_hosts', 'config', 'authorized_keys']) + (c.chance(0.4) ? '-' + c.hex(4) : ''), c.pick(['github.com ssh-ed25519 ' + c.hex(64), 'Host *\n  ServerAliveInterval ' + c.int(30, 300) + '\n  ForwardAgent no', 'ssh-rsa ' + c.hex(64) + ' ' + c.first().toLowerCase() + '@laptop'])],
      () => ['shell/' + c.pick(['.bash_history', '.zsh_history', 'psreadline-history.txt', 'fish_history']), c.many(8 + c.int(0, 20), () => c.pick(['ls -la', 'cd ' + c.pick(['projects', 'Documents', 'api', 'scripts']), 'git status', 'grep -rn ' + c.pick(['TODO', 'password', 'token']) + ' .', 'cat ' + c.pick(['notes.txt', 'README.md']), 'ssh ' + c.first().toLowerCase() + '@10.0.0.' + c.int(2, 99), 'docker ps', 'make ' + c.pick(['test', 'build', 'clean'])])).join('\n')],
      () => ['downloads/' + c.pick(['setup', 'installer', 'update', 'driver']) + '-' + c.int(2, 9) + '.' + c.int(0, 9) + '.' + c.int(0, 9) + '.' + c.pick(['exe.part', 'msi.part', 'dmg.part', 'deb.part']), 'partial download\nreceived: ' + c.int(1, 900) + 'MB\nexpected: ' + c.int(900, 4000) + 'MB\nresumable: ' + c.pick(['yes', 'no'])],
      () => ['media/' + fill(c.pick(PIC), c) + '.json', '{\n  "width": ' + c.int(640, 6000) + ',\n  "height": ' + c.int(480, 4000) + ',\n  "taken": "' + c.date(2024, 2026) + 'T' + c.time() + '",\n  "camera": "' + c.pick(['phone', 'dslr', 'webcam', 'unknown']) + '"\n}'],
      () => ['sessions/restore-' + c.hex(6) + '.txt', 'windows: ' + c.int(1, 14) + '\nlast: ' + c.pick(['docs/index', 'mail/inbox', 'intranet/hr', 'tickets/OPEN-4412', 'wiki/home']) + '\nunsaved: ' + c.pick(['none', 'one editor', 'two editors', 'a spreadsheet'])],
      () => ['clipboard/clip-' + c.num(4) + '.txt', c.pick(['meeting moved to 14:30', 'ssh ' + c.first().toLowerCase() + '@10.0.0.' + c.int(2, 99), c.hex(24), 'DO NOT SEND THIS TO ' + c.first().toUpperCase(), 'password: ' + c.pick(['Winter', 'Summer', 'Qwerty']) + c.num(4)])],
      () => ['gpu/shaders/' + c.hex(8) + '.bin', 'shader cache\nvendor: ' + c.pick(['nvidia', 'amd', 'intel', 'mesa']) + '\ncompiled: ' + c.date(2025, 2026) + '\n' + c.hex(64)],
      () => ['docker/overlay2/' + c.hex(12) + '/layer.tar.idx', 'layer index\nparent: ' + c.hex(12) + '\nsize: ' + c.int(4, 900) + 'MB\ncreated: ' + c.date(2025, 2026)],
      () => ['voice/memo-' + c.num(3) + '.idx', 'recording index\nduration: ' + c.int(9, 900) + 's\nspeakers: ' + c.int(1, 4) + '\ntranscript: ' + c.pick(['none', 'partial', 'auto'])] ,
      () => ['calendar/cal-' + c.date(2025, 2026) + '.ics', ['BEGIN:VCALENDAR', 'SUMMARY:' + c.pick(['Weekly sync', '1:1', 'Board prep', 'Incident review', 'Interview']), 'DTSTART:' + c.date(2026, 2026).replace(/-/g, '') + 'T' + c.time().replace(/:/g, '').slice(0, 6), 'LOCATION:' + c.pick(['Room 3', 'Teams', 'Kitchen', 'Remote']), 'END:VCALENDAR'].join('\n')],
      () => ['contacts/contacts-' + c.num(3) + '.vcf', ['BEGIN:VCARD', 'FN:' + c.person(), 'TEL:+44 ' + c.num(10), 'EMAIL:' + c.first().toLowerCase() + '@' + extraDomain(c), 'END:VCARD'].join('\n')],
      () => ['scans/invoice-' + c.date(2025, 2026) + '-' + c.num(3) + '.ocr.txt', ['OCR output (low confidence)', c.pick(['Invoice', 'Receipt', 'Statement']) + ' ' + c.num(6), 'Total: ' + c.money(2, 400) + '.00', 'VAT: ' + c.money(0, 40) + '.00', c.pick(['handwritten note on the back', 'staple damage, top left', 'second page missing'])].join('\n')],
      () => ['backup/' + c.pick(['notes', 'budget', 'rota', 'report']) + '-old.bak', [c.mark(), 'auto-backup taken ' + c.date(2025, 2026) + ' ' + c.time(), '', fill(c.pick(['This was the version before the argument.', 'Recovered from the printer queue.', 'Nobody knows who saved this copy.', 'Restored once already.']), c, null)].join('\n')],
      () => ['net/' + c.pick(['curl', 'wget', 'proxy', 'dns']) + '-' + c.date(2026, 2026) + '.log', c.many(6, () => c.time() + ' ' + c.pick(['GET', 'POST', 'DNS', 'CONNECT']) + ' ' + c.ip() + ' ' + c.pick(['200', '302', '404', '500', 'timeout']) + ' ' + c.int(3, 1900) + 'ms').join('\n')],
      () => ['recent/' + c.pick(['recent-files', 'jump-list', 'last-used']) + '-' + c.hex(4) + '.txt', c.many(7, () => c.date(2026, 2026) + ' ' + c.time().slice(0, 5) + '  ' + c.pick(['Documents/', 'Desktop/', 'Downloads/', 'projects/' + c.pick(['api', 'web', 'infra']) + '/']) + c.pick(['notes', 'budget', 'report', 'README', 'config']) + '.' + c.pick(['txt', 'md', 'json', 'csv'])).join('\n')],
      () => ['wallpaper/current-' + c.hex(5) + '.json', 'source: Pictures/' + fill(c.pick(PIC), c) + '\nfit: ' + c.pick(['fill', 'fit', 'stretch', 'tile']) + '\nchanged: ' + c.date(2025, 2026)],
      () => ['backup/index-' + c.num(4) + '.txt', ['backup set ' + c.num(4), 'created: ' + c.date(2025, 2026), 'files: ' + c.int(40, 9000), 'bytes: ' + c.int(200, 900000) + 'MB', 'status: ' + c.pick(['complete', 'interrupted', 'verified', 'never checked'])].join('\n')],
      () => ['notes/fragment-' + c.hex(4) + '.txt', c.many(4, () => fill(c.pick(['{a|Remember|Do not forget} to {a|call|email|chase} {name}.', 'Ticket {num} is still {a|open|blocked|unassigned}.', '{a|The|That} {a|meeting|review} moved to {time}.', 'Ask {first} about the {a|invoice|password|badge}.']), c, null)).join('\n')]
    ];
    const total = Math.max(0, Math.min(1400, count));
    for (let i = 0; i < total; i++) {
      const root = c.pick(roots);
      const [rel, text] = c.pick(shapes)();
      put(root + rel, text);
    }
    // browser history and bookmarks, the most human files on any disk
    put((win ? 'AppData/Local/' : '.config/') + 'browser/bookmarks.html', ['<!doctype html><title>Bookmarks</title><h1>Bookmarks</h1><ul>'].concat(
      c.many(14 + c.int(0, 40), () => '<li><a href="https://' + c.pick(BROWSER_SITES) + '.' + extraDomain(c) + '/' + c.pick(BROWSER_PATHS) + '">' + fill(c.pick(['payslip portal', 'the wiki', 'expenses', 'do not open at work', 'the other wiki', 'the old timesheet system', 'tickets', 'status page', 'the guide nobody reads', 'bookmarks from 2019']), c) + '</a></li>'))
    .concat(['</ul>']).join('\n'));
    put((win ? 'AppData/Local/' : '.config/') + 'browser/history.txt', c.many(30 + c.int(0, 70), () => c.date(2026, 2026) + ' ' + c.time().slice(0, 5) + '  ' + c.pick(['https://intranet', 'https://mail', 'https://search', 'https://status', 'https://git', 'https://boards']) + '.' + extraDomain(c) + '/' + c.pick(['', 'hr', 'it', 'news', 'docs', 'tickets', 'wiki', 'reports']) + '  ' + c.pick(['direct', 'link', 'typed', 'bookmark', 'reload', 'back'])).join('\n'));
  }
  function extraDomain(c) { return c.pick(['example.internal', 'example.local', 'corp.example', 'intra.example', 'lab.example']); }

  function lifeFiles(put, c, extra, win, prof) {
    const home = win ? '' : '';
    put(home + 'Desktop/shopping-list.txt', c.many(9, () => '- ' + c.pick(['coffee', 'milk', 'batteries', 'wine', 'painkillers', 'cat food', 'printer paper', 'stamps', 'bread', 'olive oil', 'rice', 'chicken', 'soap', 'razors', 'bin bags', 'light bulbs', 'toothpaste', 'tea', 'sugar', 'eggs', 'cheese', 'frozen peas', 'dog food', 'washing powder', 'foil', 'cling film', 'birthday card', 'sticking plasters'])).join('\n'));
    put(home + 'Desktop/passwords.txt', ['facebook: ' + c.first().toLowerCase() + c.num(2), 'bank: ' + c.pick(['Summer', 'Winter', 'Dog']) + c.num(4) + '!', 'work vpn: ' + c.hex(6), 'wifi: ' + c.pick(['TheMound', 'PrettyFlyForAWiFi', 'NoGuestNetwork']) + c.num(2), '', 'do not lose this one again'].join('\n'));
    put(home + 'Downloads/invoice-' + c.num(4) + '.txt', ['INVOICE ' + c.num(5), c.pick(['Consulting', 'Design work', 'Overtime', 'Expenses']) + ' — ' + c.date(), 'Amount: ' + c.money(1, 40) + '.00', 'Paid: ' + c.pick(['yes', 'no', 'partly', 'disputed']), '', c.pick(['Please stop emailing me about this.', 'Reference the PO next time.', 'This was never approved.'])].join('\n'));
    put(home + 'Documents/finance/' + c.date(2024, 2026) + '-bank-statement.csv', ['date,description,amount,balance'].concat(
      c.many(30, () => [c.date(2026, 2026), c.pick(['SALARY', 'RENT', 'GROCERY', 'TRANSFER', 'CARD PAYMENT', 'REFUND', 'CASH WITHDRAWAL']), (c.rand() < 0.5 ? '-' : '') + c.int(8, 2400) + '.' + pad(c.int(0, 99)), c.int(100, 9000) + '.' + pad(c.int(0, 99))].join(',')).sort()
    ).join('\n'));
    put(home + 'Documents/finance/tax-' + c.int(2022, 2025) + '.txt', ['Tax return, self assessment', 'Name: ' + c.person(), 'Income declared: ' + c.money(30, 120) + '.00', 'Expenses claimed: ' + c.money(2, 18) + '.00', 'Note to accountant: ' + c.pick(['the second laptop is for work, honestly', 'I have receipts for most of it', 'can we call the dinners client entertainment', 'please do not put the flat in this year']), '', c.pick(['Filed late. Penalty paid.', 'Filed on time, unusually.', 'Still waiting for the amended copy.'])].join('\n'));
    put(home + 'Documents/medical/letter-' + c.num(3) + '.txt', ['Clinic letter', 'Patient: ' + c.person(), 'Date: ' + c.date(2025, 2026), '', c.pick(['Results are normal. No further action.', 'Please book a follow-up at your convenience.', 'The referral has been made; expect a letter.', 'We could not reach you by phone.']), '', 'This letter is fictional and exists only inside this simulation.'].join('\n'));
    put(home + 'Documents/family/school-letter.txt', ['Dear parent or guardian,', '', 'This is a reminder that the trip balance is due by ' + c.date(2026, 2026) + '.', 'Please ensure ' + c.first() + ' brings a packed lunch and a waterproof coat.', '', 'Kind regards,', 'The office'].join('\n'));
    put(home + 'Documents/personal/diary-' + c.date(2025, 2026) + '.txt', c.many(14, () => c.date(2026, 2026) + ' — ' + fill(c.pick(personalBank.length ? personalBank : ['Long day. {a|Nothing happened.|Everything happened.|I am fine.}']), c, extra)).join('\n'));
    put(home + 'Documents/personal/cover-letter-old.txt', ['Dear hiring manager,', '', 'I am writing to apply for the role advertised. I have ' + c.int(3, 18) + ' years of experience and a strong record of ' + c.pick(['delivering', 'surviving', 'quietly fixing']) + ' things nobody wanted to own.', '', 'I am leaving my current position because ' + c.pick(['of a restructuring', 'the commute', 'reasons I will explain in person', 'it is time']), '', 'Yours faithfully,', c.person()].join('\n'));
    put(home + 'Documents/personal/bucket-list.txt', c.many(12, () => '- ' + c.pick(['see the northern lights', 'learn to sail', 'pay off the card', 'write the book', 'visit ' + c.city(), 'run a half marathon', 'stop reading work email at 11pm', 'get the old car running', 'learn a language properly', 'camp somewhere with no signal', 'fix the leaky tap', 'read the books on the shelf', 'take the train across a border', 'swim in the sea in winter', 'finally frame the photos', 'cook something from the old recipe book', 'see a band play in a small room', 'get the bike serviced'])).join('\n'));
    put(home + 'Documents/legal/' + c.caseNo() + '-demand-letter.txt', ['WITHOUT PREJUDICE', c.mark(), '', 'Dear ' + c.person() + ',', '', fill(c.pick(corpBank.length ? corpBank : ['Our client is concerned about {a|the delivery|the payment|the correspondence}.']), c, extra), '', 'We require a response within 14 days.', '', c.person(), 'Counsel'].join('\n'));
    put(home + 'Documents/work/status-report-' + c.date(2026, 2026) + '.txt', ['Weekly status — ' + c.pick(['platform', 'programme', 'site', 'finance']), 'Owner: ' + c.person(), '', 'Done: ' + c.pick(['two of three', 'the easy half', 'nothing worth reporting']), 'Blocked: ' + c.pick(['legal', 'budget', 'the vendor', 'nobody will say']), 'Next: ' + c.pick(['same again', 'a meeting about a meeting', 'the thing we deferred in ' + c.month])].join('\n'));
    if (prof.personal > 6) {
      for (let i = 0; i < Math.min(20, prof.personal); i++) {
        put(home + 'Documents/personal/notes-' + c.date(2024, 2026) + '-' + i + '.txt', [c.mark(), fill(personalBank.length ? c.pick(personalBank) : 'Something happened and nobody was told.', c, extra), '', '— ' + c.person()].join('\n'));
      }
    }
    /* chance files: which of these a disk has is decided by the seed, so no two machines hold the same clutter */
    if (c.chance(0.75)) put(home + 'Desktop/to-do-' + c.date(2026, 2026) + '.txt', c.many(7 + c.int(0, 9), () => (c.chance(0.35) ? '[x] ' : '[ ] ') + c.pick(['renew the domain', 'email ' + c.first(), 'cancel the trial before it charges', 'book the dentist', 'move the standing order', 'reply to the landlord', 'back up the photos', 'print the return label', 'fix the readme', 'find the receipt', 'ask about the invoice', 'cancel the gym']) + (c.chance(0.3) ? ' (' + c.date(2026, 2026) + ')' : '')).join('\n'));
    if (c.chance(0.6)) put(home + 'Downloads/receipt-' + c.num(5) + '.txt', ['Order ' + c.num(6), 'Placed: ' + c.date(2025, 2026), c.pick(['USB hub', 'keyboard', 'monitor arm', 'hard drive', 'headphones', 'desk lamp', 'cable pack', 'webcam']) + ' — ' + c.money(1, 20) + '.99', 'Delivered: ' + c.pick(['yes', 'left with neighbour', 'lost, refund pending', 'returned']), '', c.pick(['Keep this for the warranty.', 'Wrong colour, kept it anyway.', 'Second one this year.'])].join('\n'));
    if (c.chance(0.5)) put(home + 'Music/playlists/' + c.pick(['commute', 'focus', 'loud', 'sunday', 'old-stuff']) + '.m3u', c.many(10 + c.int(0, 30), () => '../' + c.pick(['albums', 'singles', 'vinyl-rips']) + '/' + c.int(1, 99) + ' - ' + c.pick(['track', 'untitled', 'demo', 'live cut', 'b-side']) + ' ' + c.int(1, 12) + '.mp3').join('\n'));
    if (c.chance(0.5)) put(home + 'Pictures/screenshots/scr-' + c.date(2025, 2026) + '-' + c.num(3) + '.txt', 'screenshot\ncaptured: ' + c.date(2026, 2026) + ' ' + c.time() + '\nsource: ' + c.pick(['whole screen', 'window', 'selection']) + '\nnote: ' + c.pick(['error message', 'before the change', 'for the ticket', 'proof it worked once']));
    if (c.chance(0.4)) put(home + 'Documents/old/version-control-' + c.num(2) + '.txt', ['FINAL_final', 'FINAL_final_v2', 'FINAL_final_v2_USE THIS ONE', 'FINAL_final_v2_USE THIS ONE (copy)', 'old_final_2019', 'old_final_2019_backup', '', 'None of these are the current version. The current version is on the shared drive.'].join('\n'));
    if (c.chance(0.35)) put(home + 'Documents/personal/gym-plan.txt', ['Week ' + c.int(1, 12), c.pick(['Mon: legs', 'Tue: nothing', 'Wed: chest (skipped)', 'Thu: cardio 20min', 'Fri: legs again', 'Sat: rest', 'Sun: guilt']), '', c.pick(['Cancel membership by ' + c.date(2026, 2026) + '.', 'Physio says no squats for a month.', 'Third plan this year.'])].join('\n'));
  }

  function mailFiles(put, c, extra, count) {
    for (let i = 0; i < count; i++) {
      const from = c.person(), to = c.person();
      const subj = fill(c.pick(mailBank.length ? mailBank : ['Re: the thing', 'Minutes', 'Please read']), c, extra);
      put('Mail/' + c.date(2025, 2026) + '-' + pad(i + 1) + '-' + subj.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40) + '.eml',
        ['From: ' + from.toLowerCase().replace(/ /g, '.') + '@' + c.pick(['example.internal', 'corp.example']),
          'To: ' + to.toLowerCase().replace(/ /g, '.') + '@corp.example',
          'Date: ' + c.date(2026, 2026) + ' ' + c.time(),
          'Subject: ' + subj,
          '',
          fill(c.pick([
            'As discussed, {a|please find attached|I am sending this from my phone|delete this after reading}.',
            'Nobody is to discuss {a|the audit|the transfer|the incident} outside this thread.',
            'I have spoken to {name} and they agree the timeline does not work.',
            'Can we push this to next week? I am at the {city} office until {date}.',
            'Forwarding because you asked, and because I would rather you heard it from me.',
            'See the attached, then delete the attachment and the email.',
            'If anyone asks, this thread does not exist.',
            'The numbers in the deck are wrong and I have no time to fix them.',
            'Please confirm you received this and please do not reply all.',
            'I am copying {name} so there is a witness.',
            'We need to talk about the {city} shipment before Friday.',
            'Your badge will stop working on {date}; facilities have the list.',
            'This is the third reminder and the last polite one.',
            'Attaching the version that was actually signed.',
            'The vendor called again. I did not take it.',
            'Nobody has the password for the shared mailbox.'
          ]), c, extra),
          '',
          '— ' + from
        ].join('\n'));
    }
  }

  function chatFiles(put, c, count) {
    const lines = ['# chat export · ' + c.date(2026, 2026) + ' · invented conversation', ''];
    for (let i = 0; i < count; i++) {
      lines.push('[' + c.time().slice(0, 5) + '] ' + c.first() + ': ' + fill(c.pick(chatBank.length ? chatBank : ['you will not believe what happened']), c));
    }
    put('Chats/export-' + c.num(3) + '.txt', lines.join('\n'));
  }

  /* the juicy stuff: things people write down on a work machine and would rather nobody read. Invented, harmless,
     and never the same two disks in a row. */
  function secretFiles(put, c, extra, win, count, disk) {
    const secret = () => fill(c.pick(secretsBank.length ? secretsBank : ['I wrote this down so I would stop thinking about it.']), c, extra);
    const notes = () => appNotesBank.length ? c.many(1 + c.int(0, 2), () => c.pick(appNotesBank)) : ['No app notes on this machine.'];
    const doc = win ? 'Documents/' : '';
    const n = () => 1 + c.int(0, 9);
    const shapes = [
      () => [doc + 'personal/passwords-i-wrote-down-' + n() + '.txt', ['# the ones I actually use, in order of how much I would mind',
        'shared drive: ' + c.pick(['TheMound', 'PrettyFlyForAWiFi', 'NotTheDogName']) + c.num(2),
        'wifi guest: ' + c.pick(['guest', 'Guest', 'visitor']) + c.num(4),
        'old vpn: ' + c.pick(['Summer', 'Winter', 'Dog']) + c.num(4) + '!',
        'work email: the one I tell everyone is a password manager', '', secret()].join('\n')],
      () => [doc + 'personal/things-i-have-not-said-in-meetings-' + n() + '.txt', c.many(3 + c.int(0, 4), () => '- ' + secret()).join('\n')],
      () => [doc + 'personal/message-i-did-not-send-' + c.date(2025, 2026) + '-' + n() + '.txt', ['To: ' + c.pick(['everyone', 'the team', 'my manager', 'the whole floor']) + '@' + extraDomain(c), 'Subject: ' + c.pick(['about this morning', 'one correction', 'the real number', 'never mind']), '', secret(), '', c.pick(['(unsent)', '(saved to drafts)', '(deleted then restored)', '(recovered from the trash)'])].join('\n')],
      () => [doc + 'work/the-real-reason-' + c.date(2025, 2026) + '-' + n() + '.txt', ['INCIDENT FOLLOW-UP — not for distribution', c.mark(), '', 'The official reason is ' + c.pick(['vendor delay', 'a caching issue', 'the migration', 'a capacity problem']) + '.', '', 'The real reason is below.', '', secret(), '', c.pick(['This note is not attached to the incident record.', 'I have not sent this to anyone.', 'If this is found, I would like the record to show I flagged it.'])].join('\n')],
      () => ['Moundshroud/secrets/notes-to-self-' + c.int(1, 9) + '.txt', [c.pick(notesBank.length ? notesBank : ['Note to self.']), '', c.many(2 + c.int(0, 3), () => '- ' + secret()).join('\n')].join('\n')],
      () => ['Moundshroud/app-notes/' + c.pick(['release', 'terminal', 'editor', 'puzzles', 'labyrinth', 'shell', 'mcode', 'tests', 'telemetry']) + '-' + n() + '.txt', ['# app note', '', ...notes()].join('\n')],
      () => [doc + 'personal/who-i-told-what-' + n() + '.txt', ['Who knows what:', '', c.many(3 + c.int(0, 3), () => '- ' + c.person() + ' knows ' + c.pick(['that the deadline moved', 'about the second offer', 'why the printer is broken', 'the real headcount', 'who wrote the anonymous note', 'that the audit is late'])).join('\n'), '', secret()].join('\n')],
      () => [doc + 'work/incident-' + (100 + c.int(0, 900)) + '-truth.txt', ['Incident ' + (1000 + c.int(0, 9000)), 'Opened by: ' + c.person(), 'Closed: yes', '', 'What the record says: ' + c.pick(['human error', 'a misconfiguration', 'an unexpected load pattern', 'a third-party outage']) + '.', '', 'What happened:', secret()].join('\n')],
      () => ['Moundshroud/secrets/passphrase-purpose-' + n() + '.txt', ['What the maintenance passphrase opens:', '', c.many(2 + c.int(0, 3), () => '- ' + c.pick(['the account with the embarrassing purchase history', 'the folder of photos from the leaving do', 'the spreadsheet of who applied for what', 'the draft resignation letter, never sent', 'the shared drive of old invoices', 'the mailbox that nobody admits reading', 'the folder marked "do not open at work"'])).join('\n'), '', secret()].join('\n')],
      () => ['Desktop/do-not-open-' + n() + '.txt', [doc ? 'Do not open this on a client call.' : 'do not open this on a client call.', '', secret(), '', '— ' + c.first()].join('\n')],
      () => [doc + 'personal/embarrassing-notes-' + c.date(2024, 2026) + '-' + n() + '.txt', [c.mark(), '', c.many(2 + c.int(0, 3), () => secret()).join('\n\n')].join('\n')]
    ];
    const total = Math.max(0, Math.min(24, count));
    const seen = new Set();
    for (let i = 0; i < total; i++) {
      let [rel, text] = c.pick(shapes)();
      if (seen.has(rel)) rel = rel.replace(/.txt$/, '-' + (i + 1) + '.txt');
      seen.add(rel);
      put(rel, text);
      if (disk && disk.lore && Array.isArray(disk.lore.secrets) && c.chance(0.5)) {
        disk.lore.secrets.push({ path: rel, label: 'Something somebody wrote down', tag: 'embarrassing secret', juice: c.chance(0.4) ? 3 : 2 });
      }
    }
  }

  function hrFiles(put, c, extra, count) {
    for (let i = 0; i < count; i++) {
      put('HR/' + c.caseNo() + '-' + c.pick(['complaint', 'investigation', 'settlement', 'reference', 'warning', 'grievance', 'appeal', 'absence-review', 'redundancy', 'probation', 'flexible-working', 'conduct']) + '.txt',
        [c.mark(), 'Case ' + c.caseNo(), 'Subject: ' + c.person(), 'Handler: ' + c.person(), 'Opened: ' + c.date(2024, 2026), '', fill(c.pick(hrBank.length ? hrBank : ['The complaint was not upheld. No further action.']), c, extra), '', c.pick(['Closed without a record of the meeting.', 'Settled; terms confidential.', 'Referred to legal.'])].join('\n'));
    }
  }

  /* ---------------- the wrapper ---------------- */
  /* The things a Labyrinth room or a Puzzle Studio room makes you do — find the hidden folder, join the fragments,
     grep the audit log, follow the breadcrumb, decode the blob, count the rows — laid out as ordinary paperwork on
     every generated disk, so the sandbox has the same kinds of content as the rooms and the jobs. */
  function caseFiles(put, c, extra, win, level, disk) {
    const base = win ? 'Documents/' : '';
    const deep = level === 'deep' || level === 'insane';
    const marks = { hidden: 'a hidden folder — ls -a or find . -name ".*"', join: 'three fragments — cat fragments/part*.txt | tr -d "\\n"',
      grep: 'an audit log — grep -n token ' + base + 'logs/', breadcrumb: 'a trail of next.txt files — cat each one in order',
      encoded: 'an encoded note — cat it | base64 -d', count: 'a CSV — cut -d, -f4 | sort | uniq -c', pipeline: 'an order export — cut / sort / uniq / wc' };
    const words = ['harbour', 'lantern', 'willow', 'cinder', 'orchard', 'tallow', 'meridian', 'gravel', 'kestrel', 'marrow', 'thistle', 'pilot'];

    /* 1. a dot-folder with a token inside */
    const vault = '.vault-' + c.num(3);
    put(base + vault + '/README.txt', ['Hidden on purpose.', '', 'The token is the only line that starts with KEY=.', 'Nothing here leaves this machine.'].join('\n'));
    put(base + vault + '/' + c.pick(['notes', 'inventory', 'ledger']) + '-' + c.num(2) + '.txt', ['# ' + c.mark(), 'owner: ' + c.person(), 'KEY=' + c.pick(words) + '-' + c.num(4), 'kept out of the shared drive'].join('\n'));
    put(base + vault + '/' + c.pick(['old', 'spare', 'copy']) + '.txt', 'nothing useful in this one\n');

    /* 2. fragments that only mean something joined */
    const phrase = c.pick(words) + '-' + c.num(6);
    const cuts = [phrase.slice(0, 4), phrase.slice(4, 9), phrase.slice(9)];
    cuts.forEach((part, i) => put(base + 'fragments/part' + (i + 1) + '.txt', part));
    put(base + 'fragments/README.txt', 'Three parts, no order problem: cat part1.txt part2.txt part3.txt\n(or cat part*.txt | tr -d "\\n")\n');

    /* 3. an audit log with one marked line */
    const token = 'tok_' + c.hex(12);
    const logDate = c.date(2026, 2026);
    const logLines = c.many(40 + c.int(0, 60), i => c.date(2026, 2026) + ' ' + c.time() + ' ' + c.ip() + ' ' + c.pick(['GET', 'POST']) + ' /' + c.pick(['login', 'orders', 'health', 'admin', 'export']) + ' ' + c.pick(['200', '200', '302', '403', '404']));
    logLines.splice(Math.floor(logLines.length / 2), 0, logDate + ' ' + c.time() + ' ' + c.ip() + ' GET /admin/session 200 token=' + token);
    put(base + 'logs/audit-' + logDate + '.log', logLines.join('\n'));
    put(base + 'logs/README.txt', 'One line in here carries token=. grep for it.\n');

    /* 4. a breadcrumb: each file names the next folder */
    const app = c.pick(['billing', 'gateway', 'ledger', 'scheduler', 'relay']);
    const stages = c.many(3, (i) => 'stage-' + (i + 1) + '-' + c.pick(words));
    const finalKey = 'key-' + c.pick(words) + '-' + c.num(4);
    put(base + 'srv/' + app + '/next.txt', 'Start here.\n\nnext: ' + stages[0] + '/\n');
    put(base + 'srv/' + app + '/' + stages[0] + '/next.txt', 'No key here.\n\nnext: ' + stages[1] + '/\n');
    put(base + 'srv/' + app + '/' + stages[1] + '/' + stages[2] + '/master.key', ['# ' + c.mark(), finalKey, 'rotate after the audit'].join('\n'));

    /* 5. an encoded note */
    const plain = 'the ' + c.pick(words) + ' room is booked until ' + c.date(2026, 2026) + ' — ask ' + c.first();
    let b64 = plain;
    try {
      if (typeof btoa === 'function') b64 = btoa(unescape(encodeURIComponent(plain)));
      else if (typeof Buffer !== 'undefined') b64 = Buffer.from(plain, 'utf8').toString('base64');
    } catch (e) { b64 = plain.replace(/[^\x20-\x7e]/g, '?'); }
    put(base + 'sealed-' + c.num(3) + '.b64', b64);
    put(base + 'README-ENCODING.txt', 'One file here is base64. cat it | base64 -d\n');

    /* 6. a CSV you have to count */
    const access = ['time,user,path,status'].concat(c.many(60 + c.int(0, 60), () => [c.time(), c.first().toLowerCase(), '/' + c.pick(['login', 'orders', 'admin', 'export', 'health']), c.pick(['200', '200', '403', '404'])].join(',')));
    put(base + 'reports/access-' + c.date(2026, 2026) + '.csv', access.join('\n'));

    /* 7. a pipeline export */
    const orders = ['order,item,region,amount,status'].concat(c.many(80 + c.int(0, 120), () => [c.num(5), c.pick(['licence', 'hardware', 'support', 'training', 'storage']), c.pick(['north', 'south', 'east', 'west']), c.int(10, 9000), c.pick(['paid', 'paid', 'pending', 'refunded'])].join(',')));
    put(base + 'data/orders-' + c.date(2026, 2026) + '.csv', orders.join('\n'));

    if (!deep) return;
    /* on deeper disks the same shapes get decoys, rotated keys and a second trail */
    put(base + vault + '/' + c.pick(['decoy', 'not-the-key', 'ignore']) + '.txt', 'KEY=' + c.pick(words) + '-' + c.num(4) + ' (replaced last month)\n');
    put(base + 'fragments/old/part' + (4) + '.txt', 'stale — belongs to the previous run\n');
    put(base + 'sealed-' + c.num(3) + '.hex', Array.from(plain).map(ch => ch.charCodeAt(0).toString(16).padStart(2, '0')).join(''));
    for (const [path, meta] of Object.entries(marks)) {
      if (disk && Array.isArray(disk.lore.secrets) && c.chance(0.5)) disk.lore.secrets.push({ path: base + (path === 'hidden' ? vault + '/README.txt' : path === 'join' ? 'fragments/README.txt' : path === 'grep' ? 'logs/README.txt' : path === 'encoded' ? 'sealed-' + c.num(3) + '.b64' : 'srv/' + app + '/next.txt'), label: 'Case work · ' + path, tag: 'case', juice: 1, hint: meta });
    }
  }

  function deepen(disk, opts) {
    const o = Object.assign({}, opts || {});
    const files = disk.files || (disk.files = {});
    const put = planter(files);
    const seed = (disk.seed >>> 0) ^ 0x7be1d39f;
    const c = ctx(seed);
    const level = levelOf(o, seed);
    const prof = Object.assign({}, LEVELS[level]);
    const win = o.shell === 'powershell' || o.shell === 'cmd';
    const extra = { org: (disk.lore && disk.lore.org) || 'the company', unit: (disk.lore && disk.lore.unit) || 'the unit', role: 'staff', domain: 'example.internal' };

    // Moundshroud itself: manuals, changelog, jokes, essays, internal chat. Present on every disk.
    moundshroudFiles(put, c, extra, win, level !== 'easy');

    // the case essays: full length, rotated, from the bank
    const order = essaysBank.map(item => [c.rand(), item]).sort((a, b) => a[0] - b[0]).map(x => x[1]);
    const pages = level === 'insane' ? 18 + c.int(0, 16) : level === 'deep' ? 14 + c.int(0, 12) : 9 + c.int(0, 8);
    for (let i = 0; i < prof.essays; i++) {
      const item = order[i % order.length];
      const slug = (item.slug || 'essay') + '-' + c.num(3);
      const dir = (win ? 'Documents/' : '') + 'Moundshroud/lore/';
      put(dir + slug + '.md', essay(item, c, extra, pages));
      if (disk.lore && Array.isArray(disk.lore.secrets)) disk.lore.secrets.push({ path: dir + slug + '.md', label: 'Essay · ' + fill(item.title, c, extra), tag: 'lore', juice: 2 });
    }

    // sealed government material: only on deeper disks, and labelled as invented
    for (let i = 0; i < prof.sealed; i++) {
      const doc = sealedBank.length ? fill(c.pick(sealedBank), c, extra) : 'SEALED FILE\n\nNothing in this file is real.';
      const name = (win ? 'Documents/' : '') + 'intel/' + c.caseNo() + '-' + c.pick(['directive', 'finding', 'sealed-order', 'assessment', 'transcript']) + '.txt';
      put(name, [c.mark(), 'CASE ' + c.caseNo() + ' — not for distribution', '', doc, '', 'Fictional training data. No real agency, person or document is described.'].join('\n'));
      if (disk.lore && Array.isArray(disk.lore.secrets)) disk.lore.secrets.push({ path: name, label: 'Sealed file', tag: 'sealed', juice: 3 });
    }

    // corporate and personal paperwork in bulk
    for (let i = 0; i < Math.max(2, Math.round(prof.personal / 2)); i++) {
      const body = fill(c.pick(corpBank.length ? corpBank : ['The board noted the matter and moved on.']), c, extra);
      put((win ? 'Documents/' : '') + 'corporate/' + c.pick(['board', 'legal', 'audit', 'comms', 'ops', 'finance', 'hr', 'security', 'product', 'facilities', 'procurement']) + '/' + c.date(2024, 2026) + '-' + c.pick(['minutes', 'memo', 'finding', 'draft', 'register', 'review', 'decision', 'escalation', 'annex', 'brief']) + '-' + c.num(3) + '.txt',
        [c.mark(), body].join('\n'));
    }

    // ordinary office output: the spreadsheets and decks that make up most of a real Documents folder
    const officeCount = level === 'insane' ? 70 : level === 'deep' ? 34 : level === 'normal' ? 16 : 6;
    const OFFICE_KINDS = {
      spreadsheet: ['.csv', 'table'], deck: ['.pptx.txt', 'slides'], minutes: ['.txt', 'notes'], briefing: ['.txt', 'prose'],
      form: ['.txt', 'prose'], export: ['.csv', 'table'], memo: ['.txt', 'prose'], policy: ['.txt', 'prose'],
      checklist: ['.txt', 'prose'], itinerary: ['.txt', 'prose'], transcript: ['.txt', 'prose'], timesheet: ['.csv', 'table'],
      invoice: ['.txt', 'prose'], postmortem: ['.txt', 'prose'], runbook: ['.txt', 'prose'], 'risk-register': ['.csv', 'table'],
      'ticket-export': ['.csv', 'table'], 'audit-finding': ['.txt', 'prose']
    };
    const OFFICE_STEMS = ['budget', 'forecast', 'rota', 'audit', 'handover', 'inventory', 'plan', 'review', 'schedule', 'report', 'policy', 'minutes', 'risks', 'incidents', 'onboarding', 'offboarding', 'access-list', 'vendor-list', 'capex', 'opex', 'headcount', 'training', 'expenses', 'reconciliation', 'changelog', 'templates', 'contacts', 'site-survey', 'maintenance', 'stocktake'];
    const OFFICE_ROWS = ['travel', 'licence', 'storage', 'support', 'training', 'freight', 'hardware', 'software', 'contractor', 'catering', 'utilities', 'mileage', 'rent', 'insurance', 'certification', 'relocation'];
    const OFFICE_STATUS = ['open', 'closed', 'queried', 'overdue', 'escalated', 'cancelled', 'pending', 'reconciled'];
    const OFFICE_BULLETS = ['Agreed without discussion.', 'Deferred to next meeting.', 'No budget line exists for this.', 'The owner was not present.', 'Action: find out who signed it.', 'Circulated after the deadline.', 'Numbers do not reconcile with last month.', 'Raised by someone who has since left.', 'Marked urgent and then ignored for six weeks.', 'Filed under a name nobody can find.', 'Approved verbally, never in writing.', 'Depends on a system we are retiring.'];
    for (let i = 0; i < officeCount; i++) {
      const kind = c.pick(Object.keys(OFFICE_KINDS));
      const [ext, shape] = OFFICE_KINDS[kind];
      const name = c.pick(OFFICE_STEMS) + '-' + c.date(2025, 2026) + '-' + c.num(2) + ext;
      const body = shape === 'table'
        ? ['ref,description,owner,amount,status'].concat(c.many(6 + c.int(0, 8), () => [c.num(4), c.pick(OFFICE_ROWS), c.person(), c.int(20, 9000) + '.' + pad(c.int(0, 99)), c.pick(OFFICE_STATUS)].join(','))).join('\n')
        : [c.mark(), kind.toUpperCase() + ' — ' + c.pick(['draft', 'final', 'final v2', 'do not circulate', 'working copy', 'for comment', 'superseded', 'v3 (really final)']), 'Owner: ' + c.person(), 'Date: ' + c.date(2025, 2026), '', c.many(3 + c.int(0, 5), () => '- ' + c.pick(OFFICE_BULLETS)).join('\n')].join('\n');
      put((win ? 'Documents/' : '') + 'office/' + name, body);
    }

    lifeFiles(put, c, extra, win, prof);
    secretFiles(put, c, extra, win, prof.secrets || 0, disk);
    caseFiles(put, c, extra, win, level, disk);
    mailFiles(put, c, extra, Math.max(4, Math.round(prof.personal * 1.6)));
    chatFiles(put, c, Math.max(8, Math.round(prof.personal * 2)));
    hrFiles(put, c, extra, Math.max(1, Math.round(prof.personal / 2)));
    junkFiles(put, c, prof.junk, win);

    // rebuild the tree from the flat map (disk() already built one for its own files)
    const tree = {};
    for (const [path, text] of Object.entries(files)) {
      const parts = String(path).replace(/\/$/, '').split('/');
      let at = tree;
      for (const part of parts.slice(0, -1)) { if (!at[part] || typeof at[part] === 'string') at[part] = {}; at = at[part]; }
      at[parts[parts.length - 1]] = text;
    }
    disk.tree = tree;
    disk.deep = { level, files: Object.keys(files).length, essays: prof.essays, sealed: prof.sealed, label: prof.label };
    if (disk.lore) disk.lore.depth = level;
    return disk;
  }

  const original = L.disk;
  L.disk = function (opts) {
    const built = original(opts);
    try { deepen(built, opts); } catch (e) { if (window.console) console.warn('lore-deep:', e); }
    return built;
  };
  L.deep = { levels: LEVELS, levelOf, deepen };
  L.ESSAYS = essaysBank;
  L.OPTIONS = L.OPTIONS || {};
  L.OPTIONS.difficulty = [
    { id: 'easy', label: 'Small laptop — a few folders and one secret' },
    { id: 'normal', label: 'Workstation — paperwork, mail, bad decisions' },
    { id: 'deep', label: 'Full PC — every folder, months of history' },
    { id: 'insane', label: 'Seized machine — the whole life on it' }
  ];
  if (!L.OPTIONS.book) L.OPTIONS.book = { total: 0, essays: essaysBank.length, sealed: sealedBank.length, jokes: jokeBank.length };

  /* deeper disks may carry far more paperwork than the original 12/14 ceilings allowed */
  const originalNormalize = L.normalize;
  L.normalize = function (opts) {
    const o = originalNormalize(opts);
    o.secrets = Math.max(0, Math.min(60, Number(o.secrets) || 0));
    o.extra = Math.max(0, Math.min(400, Number(o.extra) || 0));
    if (typeof o.difficulty !== 'string') o.difficulty = '';
    return o;
  };
})();

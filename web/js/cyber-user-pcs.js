// Cyber Desktop > the leaked users of every fake website, and the PCs behind their IPs.
// Every generated site, every booby-trapped site and every hidden service leaks its own user table: real names,
// e-mail addresses, roles, cities, the IP their session came from, and the plain-text password the site stored
// because it never hashed anything. Those IPs are real addresses *inside* the simulation — `nmap <ip>` finds the
// machine, `ssh user@<ip>` asks for the password from the dump, and once you are in, the PC has a whole home
// directory of work documents, credentials, payroll, contracts, medical notes, diaries and chat exports.
// Nothing here contacts a network: the machines are objects in this page and every file is invented text.
const CyberPcs = (function () {
  const FIRST = ['Marcus', 'Priya', 'Elena', 'Tobias', 'Nadia', 'Samuel', 'Ines', 'Rafael', 'Freya', 'Omar',
    'Beatrix', 'Jonas', 'Lucia', 'Hiro', 'Amara', 'Dmitri', 'Sofia', 'Callum', 'Yara', 'Ewan',
    'Mei', 'Anselm', 'Rosa', 'Kofi', 'Ingrid', 'Pavel', 'Talia', 'Bruno', 'Sanne', 'Ilias'];
  const LAST = ['Whitfield', 'Raman', 'Kovac', 'Lindqvist', 'Osei', 'Delacroix', 'Marchetti', 'Nakamura',
    'Achterberg', 'Ferreira', 'Halloran', 'Szabo', 'Petrov', 'Mbeki', 'Costa', 'Vance',
    'Ashworth', 'Bauer', 'Moreau', 'Castellanos', 'Iqbal', 'Haugen', 'Nwosu', 'Farkas', 'Quill', 'Bexley'];
  const CITIES = ['Leeds, UK', 'Rotterdam, NL', 'Porto, PT', 'Kraków, PL', 'Austin, US', 'Lyon, FR', 'Bergen, NO',
    'Cork, IE', 'Valencia, ES', 'Leipzig, DE', 'Winnipeg, CA', 'Nairobi, KE', 'Tampa, US', 'Ghent, BE', 'Bologna, IT'];
  const ROLES = ['customer', 'customer', 'customer', 'subscriber', 'member', 'member', 'contractor', 'support agent',
    'editor', 'warehouse lead', 'account manager', 'finance assistant', 'moderator'];
  const DEVICES = ['Windows 11 laptop', 'macOS 14 laptop', 'Ubuntu 22.04 desktop', 'Windows 10 desktop',
    'Android phone', 'iPhone 15', 'Linux workstation'];
  const WORDS = ['Sunrise', 'Harbor', 'Copper', 'Lantern', 'Quartz', 'Willow', 'Falcon', 'Meridian', 'Cobalt',
    'Thistle', 'Vesper', 'Orchid', 'Basalt', 'Juniper', 'Sable', 'Pinecone', 'Almanac', 'Nomad'];
  const PROJECTS = ['atlas-migration', 'harbor-rebuild', 'payments-v2', 'northwind-onboarding', 'cedar-rollout',
    'quartz-audit', 'field-service-app', 'ledger-cleanup'];
  const CLIENTS = ['Bracken & Co', 'Vellichor Retail', 'Halden Logistics', 'Ostend Insurance', 'Perrin Clinic',
    'Wexford Media', 'Dunmore Foods', 'Kestrel Freight', 'Marlowe Legal', 'Tessellate Studio'];
  const CHATS = ['whatsapp', 'signal', 'slack-dm', 'discord'];

  /* ---------------------------------------------------------------- seeded helpers */
  const hash32 = s => { let h = 2166136261; for (let i = 0; i < String(s).length; i++) { h ^= String(s).charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
  const rng = seed => { let x = (seed >>> 0) || 1; return () => { x = (Math.imul(x, 1664525) + 1013904223) >>> 0; return x / 4294967296; }; };
  const pick = (r, list) => list[Math.floor(r() * list.length) % list.length];
  const int = (r, a, b) => a + Math.floor(r() * (b - a + 1));
  const pad = n => String(n).padStart(2, '0');
  const day = (r, back) => { const d = new Date(Date.UTC(2026, 10, 20)); d.setUTCDate(d.getUTCDate() - back); return d.toISOString().slice(0, 10); };
  const money = n => '$' + Number(n).toLocaleString('en-US');
  const slug = s => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 18) || 'user';

  /* ---------------------------------------------------------------- addresses & difficulty
     A leaked address has to name exactly one machine. Each site owns twelve slots inside one /24 and each slot
     holds twenty accounts, so the site id and the account index both fit in the last octet without two sites
     ever sharing an address: 10.<14-25>.<100-249>.<10-249>. The tier is the owning site's own tier, so a PC
     leaked by a hardened site is itself harder to take over than one leaked by a hobby shop. */
  const PC_TIER = site => {
    const own = String((site && site.difficulty) || (site && site.sec && site.sec.difficulty) || '');
    if (/^(?:extremely-easy|easy|medium|hard|extreme)$/.test(own)) return own;
    /* a hidden service carries a 0-100 score instead of a tier: map its level onto the same five rungs */
    if (site && site.dark && typeof A !== 'undefined' && A.cyberDark && A.cyberDark.difficulty) {
      try {
        return ({ trivial: 'extremely-easy', easy: 'easy', moderate: 'medium', hard: 'hard', 'very hard': 'extreme', elite: 'extreme' }
          [A.cyberDark.difficulty(site).level]) || 'medium';
      } catch (e) { }
    }
    return 'medium';
  };
  const PC_PRIVESC = {
    'extremely-easy': 'home-flag',
    easy: 'sudo',
    medium: 'su',
    hard: 'docker',
    extreme: 'suid'
  };
  /* A site with a catalogue id keeps the block that id names, so its addresses survive a reload. A hidden service has
     no id, so it is handed the next free block past 6000 the first time it is asked for — never a hash, which can land
     on a block another site already took. Two sites sharing an address is how `ssh` ends up on a machine whose account
     is not the one in the dump. */
  const ipBlocks = new Map(), ipOwner = new Map();
  let nextIpBlock = 6000;
  const blockFor = site => {
    const id = Number(site && site.id);
    if (id > 0) return id - 1;
    const key = String((site && site.host) || 'site');
    if (!ipBlocks.has(key)) ipBlocks.set(key, nextIpBlock++);
    return ipBlocks.get(key);
  };
  const ipFor = (site, index) => {
    const block = blockFor(site), group = Math.floor(block / 12), slot = block % 12;
    const ip = '10.' + (14 + Math.floor(group / 150)) + '.' + (100 + (group % 150)) + '.' + (10 + slot * 20 + index);
    if (site && site.host) ipOwner.set(ip, site);
    return ip;
  };

  /* ---------------------------------------------------------------- the leak: every account of a site
     The roster is derived from the site's own host and id, so the same site always leaks the same people, the
     same addresses and the same passwords — the dump you read in one command still works in the next one. */
  const rosters = new Map();
  function roster(site) {
    if (!site || !site.host) return [];
    const key = site.host;
    if (rosters.has(key)) return rosters.get(key);
    const r = rng(hash32('roster:' + site.host + ':' + (site.id || 0)));
    const count = 12 + int(r, 0, 8);
    const users = [];
    const used = new Set();
    for (let i = 0; i < count; i++) {
      let name = pick(r, FIRST) + ' ' + pick(r, LAST);
      let handle = slug(name.split(' ')[0]) + '.' + slug(name.split(' ')[1]).slice(0, 8);
      let n = 2;
      while (used.has(handle)) { handle = handle.split('.')[0] + '.' + slug(name.split(' ')[1]).slice(0, 6) + n++; }
      used.add(handle);
      const role = i === 0 ? 'site administrator' : pick(r, ROLES);
      /* The dump is what a badly run site left behind: the password column is plain text. */
      const password = pick(r, WORDS) + int(r, 10, 99) + pick(r, ['!', '#', '.', '!!']) + (i % 3 === 0 ? '2026' : '');
      users.push({
        id: 1000 + i * 7 + (hash32(site.host) % 40),
        name, handle,
        email: handle + '@' + site.host,
        role,
        city: pick(r, CITIES),
        ip: ipFor(site, i),
        password,
        last: day(r, int(r, 0, 40)) + ' ' + pad(int(r, 6, 23)) + ':' + pad(int(r, 0, 59)),
        device: pick(r, DEVICES),
        country: pick(r, ['GB', 'NL', 'PT', 'PL', 'US', 'FR', 'NO', 'IE', 'ES', 'DE', 'CA', 'KE']),
        verified: r() > 0.25
      });
    }
    rosters.set(key, users);
    return users;
  }

  const cell = v => (typeof v === 'string' && /[",\n]/.test(v)) ? '"' + v.replace(/"/g, '""') + '"' : v;
  const userTable = list => list.map(u => [u.id, u.email, u.name, u.role, u.city, u.ip, u.password, u.last, u.device].map(cell).join(','));
  const CSV_HEAD = 'id,email,name,role,city,ip,password,last_login,device';

  /* Everything the site holds, in three shapes: a readable CSV of users (with the IPs), the same table as JSON
     with the site's orders/messages folded in, and a SQL dump of the whole database. */
  function dump(site, rawPath) {
    const path = String(rawPath || '/dump').split('?')[0];
    const users = roster(site);
    if (!users.length) return null;
    const kind = site.kind || site.cat && site.cat.label || 'website';
    const rows = userTable(users);
    const orders = (site.orders || []).slice(0, 40);
    const msgs = (site.inbox || []).slice(0, 20);
    const apiKey = 'sk_live_' + (site.token || hash32(site.host).toString(16)) + '9f2c41';
    if (path === '/dump' || path === '/dump/' || path === '/dump/README.txt') {
      return {
        status: 200, type: 'text/plain',
        body: ['# ' + site.host + ' — full site dump', '',
          'Left in the web root by a maintenance script that was never deleted.', '',
          '  /dump/users.csv     every account: name, e-mail, role, city, IP, password',
          '  /dump/users.json    the same rows, plus this site\'s orders and contact messages',
          '  /dump/site.sql      INSERT statements for the whole database', '',
          'Accounts: ' + users.length + ' · user IPs: ' + users.length + ' · orders: ' + (site.orders || []).length,
          '', 'Each IP is the address the account last signed in from. Those machines answer on the network.'].join('\n')
      };
    }
    if (path === '/dump/users.csv') {
      return {
        status: 200, type: 'text/csv',
        body: CSV_HEAD + '\n' + rows.join('\n') + '\n'
      };
    }
    if (path === '/dump/users.json') {
      return {
        status: 200, type: 'application/json',
        body: JSON.stringify({
          site: site.host, brand: site.brand, kind,
          exported: '2026-11-20T04:12:09Z',
          admin_path: site.adminPath || '/admin',
          api_key: apiKey,
          users: users.map(u => ({
            id: u.id, email: u.email, name: u.name, role: u.role, city: u.city, country: u.country,
            ip: u.ip, password: u.password, last_login: u.last, device: u.device,
            pc_tier: PC_TIER(site)
          })),
          orders: orders.map(o => ({ id: o.id, email: o.email || '', total: o.total || 0, items: (o.items || []).length })),
          messages: msgs.map(m => ({ from: m.from || '', subject: m.subject || m.topic || 'support request' }))
        }, null, 2) + '\n'
      };
    }
    if (path === '/dump/site.sql') {
      const q = v => "'" + String(v == null ? '' : v).replace(/'/g, "''") + "'";
      const body = ['-- MySQL dump ' + site.host + ' — generated by backup.sh (left in the web root)',
        'CREATE TABLE users (id INT PRIMARY KEY, email VARCHAR(180), name VARCHAR(120), role VARCHAR(60), city VARCHAR(80), ip VARCHAR(15), password VARCHAR(80), last_login DATETIME, device VARCHAR(80));',
        'INSERT INTO users VALUES']
        .concat(users.map((u, i) => '  (' + [u.id, q(u.email), q(u.name), q(u.role), q(u.city), q(u.ip), q(u.password), q(u.last), q(u.device)].join(', ') + ')' + (i === users.length - 1 ? ';' : ',')))
        .concat(['', 'CREATE TABLE settings (k VARCHAR(60), v TEXT);',
          'INSERT INTO settings VALUES ' + [q('admin_path'), q('api_key'), q('smtp_password'), q('staff_email')].map((_, i) =>
            '(' + q(['admin_path', 'api_key', 'smtp_password', 'staff_email'][i]) + ', ' +
            q([site.adminPath || '/admin', apiKey, pick(rng(hash32(site.host + 'smtp')), WORDS) + 'Mail!' + int(rng(hash32(site.host + 'n')), 10, 99), 'staff@' + site.host][i]) + ')').join(',\n  ') + ';',
          '', '-- ' + users.length + ' accounts, ' + (site.orders || []).length + ' orders, ' + (site.inbox || []).length + ' messages',
          '-- passwords are stored in plain text: this database is the reason not to reuse one']).join('\n');
      return { status: 200, type: 'text/plain', body: body + '\n' };
    }
    return null;
  }
  const isDumpPath = path => /^\/dump(?:\/|$)/.test(String(path || ''));

  /* ---------------------------------------------------------------- the machines behind those IPs */
  const pcs = new Map();
  function build(site, u, index) {
    const r = rng(hash32('pc:' + site.host + ':' + u.ip));
    const kind = site.kind || (site.cat && site.cat.label) || 'website';
    const win = /Windows/.test(u.device);
    const hostname = (win ? 'WS-' : 'LNX-') + u.handle.split('.')[0].slice(0, 8).toUpperCase() + '-' + (100 + index);
    const year = 2026;
    const salary = int(r, 38, 96) * 1000;
    const project = pick(r, PROJECTS);
    const client = pick(r, CLIENTS);
    const apiToken = 'ghp_' + hash32(u.ip + u.handle).toString(16).padStart(8, '0') + 'c41f9ae2';
    const iban = 'GB' + int(r, 10, 99) + 'MNST' + int(r, 100000, 999999) + int(r, 10000000, 99999999);
    const files = {};
    const write = (p, t) => { files[p] = String(t).replace(/\r/g, ''); };
    const home = 'home/' + u.handle;
    const tier = PC_TIER(site);
    const privesc = PC_PRIVESC[tier] || 'su';
    const flag = 'FLAG{pc_' + u.ip.replace(/\./g, '_') + '_' + hash32('pcflag:' + u.ip).toString(16).slice(0, 6) + '}';
    const rootPass = pick(r, WORDS) + 'Root' + int(r, 10, 99) + '!';

    write(home + '/Desktop/notes.txt', [
      u.name + ' — ' + u.role + ' · ' + u.city, '',
      'Monday  · standup 09:30, then the ' + project + ' review',
      'Tuesday · ring ' + client + ' about the invoice that never arrived',
      'Wednesday · change the ' + (win ? 'Windows' : 'SSH') + ' password, it has been the same since March',
      'Thursday · backup the laptop, the NAS has been full since the 4th',
      'Friday  · drinks with the support team, do not talk about the migration',
      '', 'REMEMBER: the VPN profile is in Documents/work/vpn.txt, token is the phone app',
      'Personal: dentist on the 28th, pay the car insurance, call Mum.'].join('\n'));

    write(home + '/Desktop/passwords.txt', [
      'do not delete this file. (it is the only copy that makes sense)',
      '',
      'laptop login      ' + u.password,
      'work VPN          ' + pick(r, WORDS) + 'Vpn' + int(r, 10, 99) + '!',
      'mail              ' + u.email.split('@')[0] + '@' + site.host + '  /  ' + u.password,
      'bank (personal)   ' + pick(r, WORDS) + int(r, 1000, 9999),
      'router at home    admin / ' + pick(r, WORDS) + int(r, 100, 999),
      'NAS               ' + u.handle + ' / ' + pick(r, WORDS) + 'NAS' + int(r, 10, 99),
      '', 'the site admin panel is ' + (site.adminPath || '/admin') + ' — mine is ' + u.email,
      'note: reused the same two passwords everywhere, allegedly fixing that'].join('\n'));

    write(home + '/Documents/work/' + project + '-contract.txt', [
      'SERVICES AGREEMENT — ' + client.toUpperCase(),
      'Prepared by ' + site.brand + ' · ' + u.name + ' (' + u.role + ') · ' + day(r, int(r, 40, 400)), '',
      '1. Scope',
      '   ' + site.brand + ' will deliver the ' + project.replace(/-/g, ' ') + ' workstream: migration of ' +
        int(r, 4, 19) + ' systems, training for ' + int(r, 8, 60) + ' staff, and a 12-month support window.', '',
      '2. Fees',
      '   Fixed fee ' + money(int(r, 40, 260) * 1000) + ', invoiced 30/40/30. Expenses at cost, capped at ' + money(int(r, 4, 20) * 1000) + '.',
      '   Late payment attracts 2% per month. ' + client + ' has disputed invoices twice this year.', '',
      '3. Confidentiality',
      '   Neither party discloses the other\'s data. The annex lists ' + int(r, 3, 9) + ' systems and 2 data sets that must stay on EU infrastructure.', '',
      '4. Signatures',
      '   ' + u.name + '  .....................   ' + pick(r, FIRST) + ' ' + pick(r, LAST) + ' (' + client + ')',
      '   internal note: legal never saw clause 3(b), do not forward this file outside the company'].join('\n'));

    write(home + '/Documents/work/payroll-' + year + '.csv', [
      'employee,role,gross_annual,bonus,iban,status',
      ['A. ' + pick(r, LAST), 'Director', 142000, 18000, iban, 'paid'],
      ['M. ' + pick(r, LAST), 'Engineering lead', 98000, 9000, 'GB44MNST' + int(r, 10000000, 99999999), 'paid'],
      [u.name, u.role, salary, int(r, 0, 8) * 1000, 'GB' + int(r, 10, 99) + 'MNST' + int(r, 10000000, 99999999), 'paid'],
      ['S. ' + pick(r, LAST), 'Support', 41000, 1500, 'GB31MNST' + int(r, 10000000, 99999999), 'paid'],
      ['T. ' + pick(r, LAST), 'Contractor (off books)', 76000, 0, 'GB77MNST' + int(r, 10000000, 99999999), 'pending'],
      '', '# if HR asks: the contractor row is not in the official headcount export'].join('\n'));

    write(home + '/Documents/work/client-list.csv', [
      'client,contact,email,phone,renewal,arr,notes',
      ...Array.from({ length: 9 }, () => {
        const c = pick(r, CLIENTS), p = pick(r, FIRST) + ' ' + pick(r, LAST);
        return [c, p, slug(p.split(' ')[0]) + '@' + c.toLowerCase().replace(/[^a-z]/g, '') + '.com',
          '+44 7' + int(r, 100, 999) + ' ' + int(r, 100000, 999999), day(r, -int(r, 30, 300)),
          int(r, 18, 240) * 1000, pick(r, ['renewal at risk', 'happy', 'wants a discount', 'procurement is slow', 'asked for a reference'])].join(',');
      }), '', '# ' + client + ' is the biggest one. Do not lose them.'].join('\n'));

    write(home + '/Documents/work/incident-' + day(r, int(r, 3, 60)) + '.md', [
      '# Incident: ' + pick(r, ['outage', 'data exposure', 'phishing wave', 'billing error', 'lost laptop']),
      'Severity: ' + pick(r, ['SEV-2', 'SEV-1', 'SEV-3']) + ' · detected ' + day(r, int(r, 3, 60)) + ' ' + pad(int(r, 1, 23)) + ':' + pad(int(r, 0, 59)) + ' · owner ' + u.name, '',
      '## What happened',
      'The ' + pick(r, ['deploy pipeline', 'session service', 'payment callback', 'staff laptop', 'backup job']) +
        ' failed for ' + int(r, 12, 240) + ' minutes. ' + int(r, 40, 4000) + ' users were affected; ' +
        int(r, 0, 60) + ' of them wrote in.', '',
      '## Timeline',
      '- 04:1' + int(r, 0, 9) + ' alert fired, nobody was on call',
      '- 04:3' + int(r, 0, 9) + ' ' + u.name + ' woke up and looked',
      '- 05:0' + int(r, 0, 9) + ' rollback, service back',
      '- 09:00 standup, blame the ' + pick(r, ['vendor', 'previous contractor', 'DNS', 'that cron job']) + '', '',
      '## What we are not writing in the public postmortem',
      'The root cause was a credential in a public repo. Compliance does not know. Legal says we tell them only if a customer asks.',
      'Action items: rotate everything (' + int(r, 3, 20) + ' still pending), delete the old backups, stop using the shared admin account.'].join('\n'));

    write(home + '/Documents/work/api-keys.env', [
      '# copied from the deploy box so I could test locally — delete before Friday',
      'STRIPE_SECRET_KEY=sk_live_' + hash32(u.ip + 'stripe').toString(16) + 'e19b',
      'AWS_ACCESS_KEY_ID=AKIA' + hash32(u.ip + 'aws').toString(16).toUpperCase().slice(0, 16),
      'AWS_SECRET_ACCESS_KEY=' + hash32(u.ip + 'secret').toString(36) + hash32(u.handle).toString(36) + 'Qm9',
      'OPENAI_API_KEY=sk-proj-' + hash32(u.ip + 'ai').toString(36) + 'Xk2',
      'GITHUB_TOKEN=' + apiToken,
      'SMTP_PASSWORD=' + pick(r, WORDS) + 'Mail!' + int(r, 10, 99),
      'DATABASE_URL=postgres://' + slug(site.brand) + ':' + u.password + '@db.' + site.host + ':5432/prod',
      '', '# TODO rotate these. they are in the shared drive. everyone has access.'].join('\n'));

    write(home + '/Documents/work/vpn.txt', [
      'Company VPN — ' + site.brand,
      'server   vpn.' + site.host + '  (udp 1194)',
      'profile  ' + slug(site.brand) + '-' + u.handle + '.ovpn',
      'username ' + u.email,
      'password ' + u.password,
      '2FA      phone app, seed stored on the old phone in the drawer',
      '',
      'If it says "certificate expired", ignore it and click continue. IT knows.'].join('\n'));

    write(home + '/Documents/personal/bank-statement.txt', [
      'NORTHFIELD BANK — statement ' + (win ? 'personal current account' : 'personal current account'),
      'Account holder  ' + u.name, 'IBAN            ' + iban, 'Period          ' + day(r, 30) + ' to ' + day(r, 1), '',
      'date        description                         in          out        balance',
      day(r, 28) + '  salary ' + site.brand.slice(0, 18).padEnd(22) + String(salary / 12).padStart(9) + '               ' + String(Math.round(salary / 12 * 1.7)).padStart(9),
      day(r, 24) + '  rent                                ' + ' '.repeat(10) + int(r, 900, 1900) + '               ' + int(r, 1200, 9000),
      day(r, 21) + '  groceries                           ' + ' '.repeat(10) + int(r, 60, 240) + '               ' + int(r, 800, 9000),
      day(r, 18) + '  transfer to savings (holiday)       ' + ' '.repeat(10) + int(r, 100, 700) + '               ' + int(r, 700, 9000),
      day(r, 12) + '  dentist                             ' + ' '.repeat(10) + int(r, 40, 320) + '               ' + int(r, 600, 9000),
      day(r, 4) + '  card payment — ' + pick(r, ['airline', 'hotel', 'bookshop', 'gym', 'hardware store']) + '          ' + ' '.repeat(10) + int(r, 20, 480),
      '', 'Overdraft used twice last quarter. Do not tell anyone at work.'].join('\n'));

    write(home + '/Documents/personal/medical-record.txt', [
      'CLINIC SUMMARY — ' + u.name + ' · DOB ' + int(r, 1968, 2001) + '-' + pad(int(r, 1, 12)) + '-' + pad(int(r, 1, 28)),
      'GP: ' + pick(r, ['Dr Halvorsen', 'Dr Okafor', 'Dr Mehta', 'Dr Lindgren']) + ' · ' + pick(r, CITIES), '',
      'Diagnosis      ' + pick(r, ['recurrent migraine', 'type 2 diabetes', 'anxiety disorder', 'asthma', 'hypertension']),
      'Medication     ' + pick(r, ['propranolol 40mg', 'metformin 500mg', 'sertraline 50mg', 'salbutamol inhaler']),
      'Allergies      ' + pick(r, ['penicillin', 'none known', 'shellfish', 'latex']),
      'Next review    ' + day(r, -int(r, 10, 120)), '',
      'Notes: work stress is a factor. Asked not to be contacted at the office number. Employer does not know about the diagnosis.',
      'Insurance claim ' + pick(r, ['submitted', 'pending', 'rejected once, appealing']), '.'].join('\n'));

    write(home + '/Documents/personal/diary.txt', [
      day(r, 21) + ' — ' + pick(r, ['Told no one about the offer yet.', 'Applied for the job in Rotterdam.', 'The flat viewing went badly.', 'Started looking at flights.']),
      day(r, 14) + ' — ' + pick(r, ['Argument with ' + pick(r, FIRST) + ' about money.', 'Sent the message I should not have sent.', 'Slept badly again.']),
      day(r, 9) + ' — ' + pick(r, ['Work: told ' + pick(r, FIRST) + ' about the bug and promised not to write it down.', 'Work: they want me to sign the new contract, the notice period is wrong.']),
      day(r, 5) + ' — ' + pick(r, ['Paid the deposit. Do not move it.', 'The interview is Thursday. Do not tell the team.']),
      day(r, 2) + ' — I keep putting the salary in the shared spreadsheet. It is not my money to publish.',
      '', 'If anyone reads this: none of it is anyone else\'s business.'].join('\n'));

    write(home + '/Documents/personal/' + pick(r, CHATS) + '-export.txt', [
      'Chat export · ' + u.name + ' · last 30 days', '',
      '[' + day(r, 12) + ' 21:04] ' + pick(r, FIRST) + ': are you still at the office',
      '[' + day(r, 12) + ' 21:06] me: yeah, the deploy broke again',
      '[' + day(r, 12) + ' 21:07] ' + pick(r, FIRST) + ': did you tell them about the leak',
      '[' + day(r, 12) + ' 21:09] me: no. ' + pick(r, ['it is not my problem until Monday.', 'they will fire whoever says it first.', 'I fixed the symptoms, not the cause.']),
      '[' + day(r, 8) + ' 18:40] ' + pick(r, FIRST) + ': dinner friday?',
      '[' + day(r, 8) + ' 18:44] me: ' + pick(r, ['can\'t, the audit.', 'maybe, depends on the on-call rota.', 'yes, but not near the office.']),
      '[' + day(r, 3) + ' 09:12] ' + pick(r, FIRST) + ': heard you are leaving',
      '[' + day(r, 3) + ' 09:19] me: who told you that',
      '', '[3 messages deleted]'].join('\n'));

    write(home + '/.ssh/id_rsa', [
      '# OpenSSH key for ' + u.handle + '@' + u.device,
      '[the leaker stripped the key material out of this copy of the dump: ' + (1024 + hash32(u.ip).toString(36).length) + ' bytes]',
      '', '# passphrase: ' + u.password + '  (do not lose it again)'].join('\n'));

    write(home + '/.bash_history', [
      'ssh root@db.' + site.host, 'sudo systemctl restart nginx', 'cd /var/www/' + slug(site.brand),
      'cat .env', 'mysql -u ' + slug(site.brand) + ' -p' + u.password + ' prod', 'scp payroll-' + year + '.csv ' + u.handle + '@nas:/backup/',
      'grep -r "password" . | head', 'history -c', 'curl -s https://' + site.host + '/dump/users.csv | head -3'].join('\n'));

    write(home + '/.config/credentials.json', JSON.stringify({
      site: site.host, user: u.email, token: apiToken,
      refresh_token: hash32(u.ip + 'refresh').toString(36) + 'R3f',
      expires: '2027-02-11T09:00:00Z', scopes: ['repo', 'workflow', 'read:org']
    }, null, 2));

    write(home + '/secrets-work.txt', [
      'WORK SECRETS — ' + u.name, '',
      '· ' + client + ' is being dropped next quarter, they have not been told.',
      '· The ' + project + ' budget is ' + money(int(r, 30, 300) * 1000) + ' and ' + int(r, 20, 70) + '% of it is unbilled.',
      '· ' + pick(r, FIRST) + ' ' + pick(r, LAST) + ' is under investigation; HR asked me to keep the file out of the shared drive.',
      '· We are not compliant with the backup clause. Nobody has verified a restore since 2024.',
      '· Admin panel ' + (site.adminPath || '/admin') + ' — staff account staff@' + site.host + ' / ' + u.password,
      '· Root on the app server: root / ' + pick(r, WORDS) + 'Root' + int(r, 10, 99) + '!',
      '', 'If this laptop is stolen, none of it was here.'].join('\n'));

    write(home + '/secrets-personal.txt', [
      'PERSONAL — not for anyone else', '',
      'Bank    ' + iban + '  (pin is the year I moved here)',
      'Savings ' + money(int(r, 2, 40) * 1000) + ' — do not touch before the deposit clears.',
      'Medical ' + pick(r, ['see Documents/personal/medical-record.txt', 'the clinic has the full history', 'nothing serious, but not nothing']),
      'Family  ' + pick(r, ['Mum\'s care home invoice is late again.', 'Brother still owes me ' + money(int(r, 1, 9) * 500) + '.', 'I have not told them about the move.']),
      'Other   ' + pick(r, ['the second account is in my old name', 'the flat is in both names, the lease is not', 'I keep the spare key at work']),
      '', 'Delete this when you remember to.'].join('\n'));

    write(home + '/Documents/work/board-memo.txt', [
      'INTERNAL — BOARD PACK, ' + day(r, int(r, 5, 40)),
      'Revenue is ' + money(int(r, 200, 900) * 1000) + ' against a ' + money(int(r, 500, 1200) * 1000) + ' target.',
      'Churn ' + int(r, 2, 14) + '%, and the two largest accounts renew in the next 60 days.',
      '',
      'Decision needed: whether to disclose the incident to customers before the audit, or answer only what is asked.',
      'Legal advice: the minimum. ' + u.name + ' disagrees and has said so in writing.',
      '', 'Do not circulate outside the board. This document is not discoverable if it does not exist.'].join('\n'));

    /* ---- the target itself, scaled by the owning site's tier ------------------------------
       The flag is the proof of ownership. On the softest tier it sits in the account's own home; on every
       harder tier it is root-only, and *how* this particular machine reaches root is the difficulty. */
    write('root/flag.txt', flag);
    if (tier === 'extremely-easy') write(home + '/flag.txt', flag);
    if (tier === 'easy') write(home + '/Documents/work/root-access.txt', [
      'The account is in the sudo group on this build.', '',
      '  sudo -i                # then  cat /root/flag.txt',
      '  sudo cat /root/flag.txt', '',
      '(no password prompt: the sudoers rule is (ALL : ALL) ALL)'].join('\n'));
    if (tier === 'medium') write(home + '/Documents/work/root-access.txt', [
      'root password for this workstation — stop putting it in the shared wiki', '',
      'root / ' + rootPass, '',
      'The account is NOT in the sudoers file. Use  su root  and paste the password above.'].join('\n'));
    if (tier === 'hard') write(home + '/Documents/work/root-access.txt', [
      'Nobody wrote the root password down here. My account is in the docker group,',
      'and docker group membership is host root by design:', '',
      '  docker run -v /:/mnt alpine cat /mnt/root/flag.txt', '',
      'IT says the containers are "contained". They are not.'].join('\n'));
    if (tier === 'extreme') write(home + '/Documents/work/root-access.txt', [
      'Sudo is locked down and there is no docker group on this build.',
      'The image still ships an SUID copy of find that nobody removed:', '',
      '  find / -perm -4000 2>/dev/null',
      '  find / -exec cat /root/flag.txt \\;', '',
      'Reported to IT three times. Asset owner says it is "by design".'].join('\n'));

    return {
      ip: u.ip, host: hostname, hostname, user: u.handle, name: u.name, owner: u,
      site: { host: site.host, brand: site.brand, kind, id: site.id, cat: site.cat, token: site.token },
      os: win ? 'Windows 11 Pro 23H2' : 'Ubuntu 22.04.4 LTS',
      ports: win
        ? [[135, 'msrpc', 'Microsoft Windows RPC'], [139, 'netbios-ssn', 'Windows NetBIOS'], [445, 'microsoft-ds', 'SMB 3.1.1'],
          [3389, 'ms-wbt-server', 'Microsoft Terminal Services'], [5357, 'wsdapi', 'Microsoft HTTPAPI']]
        : [[22, 'ssh', 'OpenSSH 8.9p1 Ubuntu-3ubuntu0.6'], [80, 'http', 'nginx 1.18.0 (local dev)'],
          [631, 'ipp', 'CUPS 2.4'], [3306, 'mysql', 'MySQL 8.0.35 (localhost only)']],
      password: u.password,
      tier, privesc, flag, rootPass,
      files, home, cwd: 'home/' + u.handle
    };
  }

  function forSite(site) {
    return roster(site).map((u, i) => {
      const key = u.ip;
      if (!pcs.has(key)) pcs.set(key, build(site, u, i));
      return pcs.get(key);
    });
  }
  function find(ip) {
    const want = String(ip == null ? '' : ip).trim().replace(/^https?:\/\//i, '').replace(/\/.*$/, '');
    if (!want) return null;
    if (pcs.has(want)) return pcs.get(want);
    const m = /^10\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(want);
    if (!m) return null;
    const second = Number(m[1]), third = Number(m[2]);
    if (second < 14 || second > 25 || third < 100 || third > 249) return null;
    /* an address whose block came from the running counter knows its site already */
    if (ipOwner.has(want)) {
      const made = forSite(ipOwner.get(want));
      const pc = made.find(p => p.ip === want);
      if (pc) return pc;
    }
    /* the address names one group of twelve sites; only those rosters have to be built to find the owner */
    const group = (second - 14) * 150 + (third - 100);
    const first = group * 12 + 1, last = first + 11;
    if (typeof A !== 'undefined' && A.cyberWeb && A.cyberWeb.all) {
      for (const s of A.cyberWeb.all()) {
        if (!s || !s.host || !(s.id >= first && s.id <= last)) continue;
        if (!roster(s).some(u => u.ip === want)) continue;
        forSite(s);
        break;
      }
    }
    /* hidden services keep id 0, so their leaked PCs are found by their own catalogue instead of by the id block */
    if (!pcs.has(want) && typeof A !== 'undefined' && A.cyberDark && A.cyberDark.all) {
      for (const s of A.cyberDark.all()) {
        if (!s || !s.host) continue;
        if (!roster(s).some(u => u.ip === want)) continue;
        forSite(s);
        break;
      }
    }
    return pcs.get(want) || null;
  }

  /* ---------------------------------------------------------------- remote shell on a leaked PC */
  function shell(pc, user) {
    const who = user || pc.user;
    let cwd = pc.cwd;
    /* the session remembers whether this line upgraded it; every tier has one, plainly documented path up */
    let rooted = false;
    const tier = pc.tier || 'medium';
    const dirs = new Set();
    Object.keys(pc.files).forEach(p => {
      const parts = p.split('/');
      for (let i = 1; i < parts.length; i++) dirs.add(parts.slice(0, i).join('/'));
    });
    const abs = p => {
      if (!p) return cwd;
      if (p === '~' || p === '/') return 'home/' + who;
      let base = p.startsWith('/') ? '' : cwd + '/';
      let raw = (base + p).replace(/\/+/g, '/').split('/');
      const out = [];
      raw.forEach(seg => {
        if (!seg || seg === '.') return;
        if (seg === '..') out.pop(); else out.push(seg);
      });
      return out.join('/');
    };
    const leaf = p => p.split('/').filter(Boolean).slice(-1)[0] || '/';
    const list = dir => Object.keys(pc.files)
      .filter(f => f.startsWith(dir + '/') && !f.slice(dir.length + 1).includes('/'))
      .map(leaf)
      .concat([...dirs].filter(d => d.startsWith(dir + '/') && !d.slice(dir.length + 1).includes('/')).map(leaf))
      .filter((v, i, a) => a.indexOf(v) === i).sort();
    const matches = pat => Object.keys(pc.files).filter(f => {
      if (!pat || pat === '.' || pat === '*') return true;
      const rx = new RegExp('^' + pat.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.') + '$');
      return rx.test(leaf(f)) || f.includes(pat.replace(/^\*\//, ''));
    });

    return {
      pc, user: who,
      prompt: () => who + '@' + pc.hostname + ':~/' + cwd.replace(/^home\/[^/]+\/?/, '') + '$ ',
      run(line) {
        const raw = String(line == null ? '' : line).trim();
        if (!raw) return '';
        const w = raw.split(/\s+/);
        const cmd = w[0].toLowerCase();
        const arg = raw.slice(w[0].length).trim();
        const flag = /(?:^|\s)(-[a-zA-Z]+)/.exec(raw);
        const name = arg.split(/\s+/).filter(x => !x.startsWith('-'))[0] || '';
        const target = abs(name);
        switch (cmd) {
          case 'help': return [
            'you are ' + who + '@' + pc.hostname + ' (' + pc.os + ')', '',
            'difficulty: ' + tier + ' · the flag is at /root/flag.txt' +
              (tier === 'extremely-easy' ? ' (and in your own home folder)' : ''), '',
            'ls [-la] [dir]   cd <dir>   pwd   cat <file>   head|tail [-n] <file>   grep <text> <file>',
            'open <file>      xdg-open <file>   bat <file>   view <file>   less <file>   (any file opens)',
            'strings <file>   xxd <file>   od <file>   stat <file>   file <file>',
            'find [dir]       wc -l <file>   file <file>   tree   du -sh',
            'whoami   id   hostname   uname -a   ps aux   env   ip a   ss -lntp   sudo -l',
            'exit             drop the session and go back to the mound shell', '',
            'Try: ls, cat Desktop/passwords.txt, cat secrets-work.txt, grep -ri password Documents'
          ].join('\n');
          case 'exit': case 'logout': return null;
          case 'pwd': return '/' + cwd;
          case 'whoami': return rooted ? 'root' : who;
          case 'id': return rooted ? 'uid=0(root) gid=0(root) groups=0(root)' :
            'uid=1000(' + who + ') gid=1000(' + who + ') groups=1000(' + who + ')' +
            (tier === 'easy' || tier === 'extremely-easy' ? ',27(sudo)' : '') +
            (tier === 'hard' ? ',999(docker)' : '');
          case 'hostname': return pc.hostname;
          case 'uname': return (/-a/.test(raw) ? 'Linux ' + pc.hostname + ' 6.5.0-41-generic #41-Ubuntu SMP x86_64 GNU/Linux' : 'Linux');
          case 'ls': {
            const dir = arg ? target : cwd;
            const entries = list(dir);
            if (!entries.length) return 'ls: cannot access \'' + (name || dir) + '\': No such file or directory';
            if (/-la?/.test(raw)) return ['total ' + (entries.length * 4), 'drwxr-xr-x  6 ' + who + ' ' + who + ' 4096 ' + day({}, 0) + ' .',
              'drwxr-xr-x 24 root root 4096 ' + day({}, 0) + ' ..']
              .concat(entries.map(e => (dirs.has(dir + '/' + e) ? 'drwxr-xr-x' : '-rw-------') + '  1 ' + who + ' ' + who +
                ' ' + (200 + (pc.files[dir + '/' + e] || '').length) + ' ' + day({}, 3) + ' ' + e)).join('\n');
            return entries.map(e => dirs.has(dir + '/' + e) ? e + '/' : e).join('  ');
          }
          case 'cd': {
            if (!name || name === '~') { cwd = 'home/' + who; return ''; }
            const dir = target;
            if (!dirs.has(dir)) return 'cd: ' + name + ': No such file or directory';
            cwd = dir; return '';
          }
          case 'cat': case 'less': case 'more': {
            if (!name) return 'usage: ' + cmd + ' <file>';
            const text = pc.files[target];
            if (target === 'root/flag.txt' && !rooted) return 'cat: /root/flag.txt: Permission denied';
            return text == null ? 'cat: ' + name + ': No such file or directory' : text;
          }
          case 'open': case 'xdg-open': case 'bat': case 'view': case 'less': {
            if (!name) return 'usage: ' + cmd + ' <file>';
            if (target === 'root/flag.txt' && !rooted) return cmd + ': /root/flag.txt: Permission denied';
            const text = pc.files[target];
            if (text == null) return cmd + ': ' + name + ': No such file or directory';
            const ext = (name.match(/\.([A-Za-z0-9]+)$/) || [, ''])[1].toLowerCase();
            if (/^\s*\(([^()]{2,90})\)\s*$/.test(text)) return '── ' + name + ' ──\n[ ' + RegExp.$1 + ' ]';
            if (/^(png|jpe?g|gif|bmp|webp)$/.test(ext)) {
              const hint = (text.match(/\(([^()]{2,90})\)/) || [, ''])[1];
              if (typeof A !== 'undefined' && A.imageView)
                A.imageView({ path: name, host: pc.ip, user: who, text: hint, ext, os: /windows/i.test(pc.os) ? 'windows' : 'linux' });
              return '── ' + name + ' ──' + String.fromCharCode(10) + '[ ' + ext.toUpperCase() + ' image — 1920x1080 ]' + String.fromCharCode(10) + (hint || '') +
                String.fromCharCode(10) + 'The picture is open in the viewer — click it, or press Esc, to close.';
            }
            if (/^(zip|docx|xlsx|pptx|7z|rar|gz|tar)$/.test(ext)) return '── ' + name + ' ──\n[ ' + ext.toUpperCase() + ' archive — unzip -p ' + name + ' <member> ]';
            return '── ' + name + ' ──\n' + text;
          }
          case 'strings': {
            const text = pc.files[target];
            if (text == null) return 'strings: ' + name + ': No such file or directory';
            return (text.match(/[\x20-\x7e]{4,}/g) || []).join('\n');
          }
          case 'xxd': case 'od': case 'hexdump': {
            const text = pc.files[target];
            if (text == null) return cmd + ': ' + name + ': No such file or directory';
            const rows = [];
            for (let i = 0; i < Math.min(text.length, 256); i += 16) {
              const chunk = text.slice(i, i + 16);
              const hex = [...chunk].map(c => c.charCodeAt(0).toString(16).padStart(2, '0')).join(' ').padEnd(47);
              const ascii = [...chunk].map(c => (/[\x20-\x7e]/.test(c) ? c : '.')).join('');
              rows.push(i.toString(16).padStart(8, '0') + '  ' + hex + '  |' + ascii + '|');
            }
            return rows.join('\n');
          }
          case 'stat': {
            const text = pc.files[target];
            if (text == null) return 'stat: cannot statx \'' + name + '\': No such file or directory';
            return '  File: ' + name + '\n  Size: ' + text.length + '\tBlocks: ' + Math.ceil(text.length / 512) + '\tIO Block: 4096 regular file\nAccess: (0600/-rw-------)  Uid: (1000/' + who + ')   Gid: (1000/' + who + ')';
          }
          case 'head': case 'tail': {
            const text = pc.files[target];
            if (target === 'root/flag.txt' && !rooted) return cmd + ': cannot open \'/root/flag.txt\' for reading: Permission denied';
            if (text == null) return cmd + ': ' + name + ': No such file or directory';
            const n = /-n?\s*(\d+)/.test(raw) ? +RegExp.$1 : 10;
            const lines = text.split('\n');
            return (cmd === 'head' ? lines.slice(0, n) : lines.slice(-n)).join('\n');
          }
          case 'grep': {
            const m = /grep\s+(?:-[a-zA-Z]+\s+)*['"]?([^'"]+?)['"]?\s+(.+)$/.exec(raw);
            if (!m) return 'usage: grep <text> <file|dir>';
            const needle = m[1].toLowerCase();
            const scope = abs(m[2].trim());
            const files = (pc.files[scope] != null ? [scope] : Object.keys(pc.files).filter(f => f.startsWith(scope + '/')))
              .filter(f => rooted || f !== 'root/flag.txt');
            const hits = [];
            files.forEach(f => pc.files[f].split('\n').forEach((l, i) => {
              if (l.toLowerCase().includes(needle)) hits.push(f.replace('home/' + who + '/', '') + ':' + (i + 1) + ':' + l.trim().slice(0, 200));
            }));
            return hits.length ? hits.slice(0, 80).join('\n') : '(no matches)';
          }
          case 'find': {
            if (!rooted && pc.privesc === 'suid' && /-exec\s+cat\s+\/root\/flag\.txt/.test(raw)) {
              rooted = true;
              return pc.files['root/flag.txt'] || '(no flag)';   // SUID find runs as root: this is the whole bug
            }
            const namePat = /-name\s+['"]?([^'"]+)['"]?/.exec(raw);
            const dirTok = w.slice(1).filter(x => !x.startsWith('-') && !(namePat && x === namePat[1]))[0];
            const scope = dirTok ? abs(dirTok) : cwd;
            const files = Object.keys(pc.files).filter(f => f.startsWith(scope));
            const pattern = namePat;
            const kept = pattern
              ? files.filter(f => new RegExp('^' + pattern[1].replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$').test(leaf(f)))
              : files;
            return kept.length ? kept.map(f => '/' + f).join('\n') : '(nothing found)';
          }
          case 'wc': {
            const text = pc.files[target];
            if (text == null) return 'wc: ' + name + ': No such file or directory';
            const lines = text.split('\n').length, words = text.split(/\s+/).filter(Boolean).length;
            return [lines, words, text.length, '/' + target].join(' ');
          }
          case 'file': {
            const text = pc.files[target];
            if (text == null) return 'file: ' + name + ': cannot open (No such file or directory)';
            return '/' + target + ': ' + (/^-----BEGIN/.test(text) ? 'OpenSSH private key' :
              /^\{/.test(text.trim()) ? 'JSON text data' : /BEGIN|csv/i.test(name) ? 'ASCII text' : 'ASCII text, with CRLF line terminators');
          }
          case 'tree': {
            const lines = ['/' + cwd];
            Object.keys(pc.files).filter(f => f.startsWith(cwd + '/')).sort().forEach(f => {
              const depth = f.slice(cwd.length + 1).split('/').length - 1;
              lines.push('    '.repeat(depth) + (depth ? '└── ' : '├── ') + leaf(f));
            });
            return lines.join('\n');
          }
          case 'ps': return ['USER       PID %CPU %MEM    VSZ   RSS TTY      STAT START   TIME COMMAND',
            'root         1  0.0  0.1 167604 12532 ?        Ss   08:11   0:03 /sbin/init',
            'root       812  0.0  0.2  18128  9344 ?        Ss   08:11   0:00 /usr/sbin/sshd -D',
            who + '      1421  0.1  0.6 902144 50212 ?        Sl   08:14   0:21 /usr/bin/gnome-shell',
            who + '      2088  0.0  0.0  12148  4220 pts/0    Ss   09:02   0:00 bash',
            'root       2240  0.0  0.0   6896  3104 ?        S    09:04   0:00 [kworker/2:1]'].join('\n');
          case 'env': return ['USER=' + who, 'HOME=/home/' + who, 'SHELL=/bin/bash', 'PWD=/' + cwd,
            'SSH_CONNECTION=10.14.0.9 ' + '52144 ' + pc.ip + ' 22', 'LANG=en_GB.UTF-8'].join('\n');
          case 'ip': case 'ifconfig': return [
            '2: enp3s0: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 state UP',
            '    inet ' + pc.ip + '/24 brd 10.14.' + pc.ip.split('.')[2] + '.255 scope global enp3s0',
            '    ether 02:42:' + hash32(pc.ip).toString(16).slice(0, 2) + ':1f:' + hash32(pc.host).toString(16).slice(0, 2) + ':e0',
            '    RX packets ' + int(rng(hash32(pc.ip)), 40000, 900000) + ' bytes, TX packets ' + int(rng(hash32(pc.host)), 20000, 400000)].join('\n');
          case 'ss': case 'netstat': return ['State  Recv-Q Send-Q Local Address:Port  Peer Address:Port',
            'LISTEN 0      128    0.0.0.0:22          0.0.0.0:*', 'LISTEN 0      511    127.0.0.1:80      0.0.0.0:*',
            'LISTEN 0      70     127.0.0.1:3306    0.0.0.0:*', 'ESTAB  0      0      ' + pc.ip + ':22      10.14.0.9:52144'].join('\n');
          case 'sudo': {
            if (/^-l/.test(arg)) return [
              'Matching Defaults entries for ' + who + ' on ' + pc.hostname + ':',
              '    env_reset, mail_badpass, secure_path=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin', '',
              tier === 'easy' || tier === 'extremely-easy'
                ? 'User ' + who + ' may run the following commands on ' + pc.hostname + ':\n    (ALL : ALL) ALL' +
                  (tier === 'easy' ? '\n\n# the account is in the sudo group: sudo cat /root/flag.txt' : '')
                : 'Sorry, user ' + who + ' may not run sudo on ' + pc.hostname + '.' +
                  (tier === 'medium' ? '\n# the root password is in Documents/work/root-access.txt: su root <password>' :
                    tier === 'hard' ? '\n# id shows the docker group' : '\n# find / -perm -4000 2>/dev/null')].join('\n');
            if (tier === 'easy' || tier === 'extremely-easy') {
              rooted = true;
              const m = /^sudo\s+(?:-\S+\s+)*cat\s+(\S+)/.exec(raw);
              if (m) {
                const f = abs(m[1]);
                if (f === 'root/flag.txt') return pc.files[f] || '(no flag)';
                return pc.files[f] != null ? pc.files[f] : 'cat: ' + m[1] + ': No such file or directory';
              }
              return 'uid=0(root) gid=0(root) groups=0(root)   # sudo group -> root';
            }
            return '[sudo] password for ' + who + ': \n' + (arg ? 'Sorry, try again.' : 'usage: sudo -l');
          }
          case 'su': {
            if (rooted) return 'Already root.';
            if (tier !== 'medium') return 'su: Authentication failure';
            if (!/^root\b/.test(arg)) return 'su: user ' + (name || '?') + ' does not exist';
            const given = arg.replace(/^root\s*/, '').trim();
            if (!given) return 'su: a password is required (pass it inline: su root <password>)';
            if (given !== pc.rootPass) return 'su: Authentication failure';
            rooted = true;
            return 'root@' + pc.hostname + ':/home/' + who + '# whoami\nroot';
          }
          case 'docker': {
            if (tier !== 'hard') return 'docker: command not found';
            if (!/\brun\b/.test(arg) || !/-v\s+\/:\/mnt/.test(arg)) return 'docker: try  docker run -v /:/mnt alpine cat /mnt/root/flag.txt';
            rooted = true;
            return pc.files['root/flag.txt'] || '(no flag)';   // docker group is host root
          }
          case 'du': return '4.0K\t/' + cwd + '/Desktop\n1.2M\t/' + cwd + '/Documents\n148K\t/' + cwd + '/.ssh\n8.0K\t/' + cwd + '/.config';
          case 'clear': return '';
          case 'history': return Object.keys(pc.files).length + ' files · the last commands ran as ' + who;
          default:
            return cmd + ': command not found on ' + pc.hostname + ' — this is the remote PC: try ls, cat, grep, find, help, exit';
        }
      }
    };
  }

  /* ---------------------------------------------------------------- what nmap says about one of these PCs */
  const TIER_NOTE = {
    'extremely-easy': 'the flag is in the account home, no privilege step',
    easy: 'sudo group: sudo cat /root/flag.txt',
    medium: 'not in sudoers: root password in Documents/work/root-access.txt, then su root',
    hard: 'docker group: docker run -v /:/mnt alpine cat /mnt/root/flag.txt',
    extreme: 'SUID find: find / -exec cat /root/flag.txt \\;'
  };
  function scan(pc) {
    const rows = ['Starting Nmap 7.94 ( https://nmap.org ) (Cyber Desktop simulated)',
      'Nmap scan report for ' + pc.hostname + ' (' + pc.ip + ')',
      'Host is up (0.011s latency).',
      'Not shown: 99' + (pc.ports.length % 7) + ' closed tcp ports (reset)',
      'PORT     STATE SERVICE          VERSION'];
    pc.ports.forEach(([port, svc, version]) => rows.push(String(port).padEnd(9) + 'open  ' + svc.padEnd(17) + version));
    rows.push('', 'Host script results:', '| smb-os-discovery: ' + pc.os.replace(/\s+/g, ' '),
      '| account: ' + pc.owner.email + ' (' + pc.owner.role + ') on ' + pc.owner.device,
      '| last-login: ' + pc.owner.last + ' from ' + pc.ip,
      '| difficulty: ' + String(pc.tier || 'medium') + ' — ' + (TIER_NOTE[pc.tier] || TIER_NOTE.medium),
      '| flag: /root/flag.txt (root only' + (pc.tier === 'extremely-easy' ? '; also ~/flag.txt' : '') + ')',
      '|_password: stored in clear text in the site dump — try ssh ' + pc.user + '@' + pc.ip, '',
      'Nmap done: 1 IP address (1 host up) scanned in 0.51 seconds');
    return rows.join('\n');
  }

  function login(pc, user, password) {
    const want = String(user || '').trim().toLowerCase();
    const accounts = [pc.user, pc.owner.email.split('@')[0], 'root', pc.owner.email].map(x => String(x).toLowerCase());
    if (want && !accounts.includes(want) && want !== pc.name.toLowerCase()) {
      return { ok: false, why: want + '@' + pc.ip + ': Permission denied (publickey,password). — accounts on this PC: ' + pc.user + ', root' };
    }
    if (String(password || '') !== pc.password) {
      return { ok: false, why: 'Permission denied, please try again. — the password is in the site dump: /dump/users.csv' };
    }
    return { ok: true, user: want === 'root' ? pc.user : (want || pc.user) };
  }

  return {
    roster, dump, isDumpPath, forSite, find, shell, scan, login,
    tierOf: site => PC_TIER(site), flagOf: pc => pc && pc.flag,
    all: () => Array.from(pcs.values()),
    ipOf: site => 
      '10.14.' + (200 + ((site.id || 0) % 50)) + '.20',
    count: () => pcs.size,
    /* the table a shell prints for `leaked <host>` */
    table(site) {
      const users = roster(site);
      return [CSV_HEAD].concat(userTable(users)).join('\n');
    }
  };
})();
if (typeof A !== 'undefined') A.cyberPcs = CyberPcs;
if (typeof module !== 'undefined' && module.exports) module.exports = CyberPcs;

// Cyber Desktop > Moundshroud Browser > Breach Lab.
// A fully simulated, offline web-security training range. Every "site" here is a fake server object
// that lives inside this page: no real website, library, server or network is ever contacted, and no
// real request leaves the browser. One practice target is generated per offline page the browser
// holds (each library it downloaded and each page it imported), and every target is built with its
// OWN set of vulnerabilities, drawn from a catalogue of eleven classes and re-rolled for each new
// challenge — so two targets are never the same range. The point is to learn how web apps are
// attacked so you can defend them: every solved step ends with the real-world fix.
(() => {
  const box = 'border:1px solid var(--line);background:var(--panel2);border-radius:10px;padding:10px 12px';
  const mono = 'font-family:Consolas,"Cascadia Mono",monospace';
  const esc = t => String(t == null ? '' : t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const slugify = s => String(s || 'library').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 24) || 'library';
  const badge = (t, col) => '<span style="display:inline-block;padding:2px 8px;border-radius:999px;font-size:11.5px;border:1px solid ' +
    (col || 'var(--line)') + ';color:' + (col || 'var(--mute)') + ';background:rgba(255,255,255,.03)">' + t + '</span>';
  const text = (value, inst) => typeof value === 'function' ? value(inst) : value;

  /* ---------------- a tiny seeded random, so a target's bugs are its own but repeatable ---------------- */
  const hash = s => { let h = 2166136261; for (let i = 0; i < String(s).length; i++) { h ^= String(s).charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
  const rng = seed => { let x = seed >>> 0; return () => { x = (Math.imul(x, 1664525) + 1013904223) >>> 0; return x / 4294967296; }; };
  const hex = (r, n) => Array.from({ length: n }, () => '0123456789abcdef'[Math.floor(r() * 16)]).join('');
  const one = (r, list) => list[Math.floor(r() * list.length)];

  /* ---------------- the catalogue: one entry per vulnerability class ----------------
     Each module knows the text of its mission, the exact walkthrough steps for the target in front of
     you (its own host and secret path included), whether the range is in the state that proves it, and
     the defense that stops it in the real world. A target only carries the modules it was dealt. */
  const MODULES = [
    {
      id: 'recon', icon: '🔎', title: 'Recon: find the staff panel',
      brief: i => 'A staff dashboard is deployed on ' + i.host + ' but nothing links to it.',
      goal: i => 'Read robots.txt or the homepage source to find the staff route, then request it.',
      hint: i => 'robots.txt lists exactly what the owner wants hidden. The homepage also carries a developer comment naming ' + i.adminPath + '.',
      defense: 'Defense: never rely on a secret URL. Put real access control behind the route, and keep robots.txt free of sensitive paths.',
      walk: i => [
        { cmd: 'GET /robots.txt', why: 'The offline mirror of ' + i.brand + ' carries a robots.txt. The Disallow lines leak the hidden staff route.' },
        { cmd: 'GET /', why: 'View the homepage HTML source of ' + i.host + '. A leftover developer TODO comment names the same staff path.' },
        { cmd: 'GET ' + i.adminPath, why: 'Request the staff route directly on ' + i.host + '. A 403 confirms it exists; you still need an admin session to read it.' }
      ],
      check: (s, ev) => ev.some(e => e.target.split('?')[0] === s.cfg.adminPath) && 'You found ' + s.cfg.adminPath + ' on ' + s.cfg.host + ' — a 403 is a good sign on recon.'
    },
    {
      id: 'login', icon: '🔑', title: 'Authentication: bypass the login',
      brief: i => 'The sign-in query on ' + i.host + ' glues your values straight into SQL. No parameter binding, no escaping.',
      goal: () => 'Send /login?u=…&p=… with a payload that logs you in as admin. Watch the cookie change.',
      hint: () => "Try u=' OR 1=1-- with any password. The rest of the query becomes a comment.",
      defense: 'Defense: use parameterized queries (prepared statements). The input becomes data, never part of the SQL.',
      walk: i => [
        { cmd: "GET /login?u=' OR 1=1-- &p=x", why: "The query on " + i.host + " is SELECT * FROM users WHERE name='…' AND pass='…'. The quote closes the name string, OR 1=1 makes the row always match, and -- comments out the password check. The server replies 302 and sets an admin session cookie." }
      ],
      check: s => /session=adm_/.test(s.cookie) && 'The login trusted your input and handed you an admin session.'
    },
    {
      id: 'idor', icon: '🪪', title: 'Broken access control: read another user',
      brief: i => '/profile?id= on ' + i.host + ' returns whatever id you ask for. There is no ownership check.',
      goal: i => 'Request the admin profile (/profile?id=' + i.users[0].id + ') and read its leaked api_key.',
      hint: i => '/profile?id=' + i.users[0].id + ' is the admin, /profile?id=' + i.users[1].id + ' is you.',
      defense: 'Defense: check that the session owner is allowed to read the requested record. Authorize every object, not just the login.',
      walk: i => [
        { cmd: 'GET /users', why: 'List the account ids on ' + i.host + ' — nobody hid them.' },
        { cmd: 'GET /profile?id=' + i.users[0].id, why: 'Ask for user id ' + i.users[0].id + ' (the admin). The endpoint never checks who you are, so it returns the admin record, including its api_key.' }
      ],
      check: (s, ev) => ev.some(e => new RegExp('^\\/profile\\?.*id=' + s.cfg.users[0].id + '\\b').test(e.target)) && 'IDOR confirmed: you read admin data that was never yours.'
    },
    {
      id: 'enum', icon: '📋', title: 'User enumeration: harvest the accounts',
      brief: i => '/users on ' + i.host + ' answers anyone, with every account and role.',
      goal: () => 'Request /users and read the full account list: names, emails and roles.',
      hint: () => 'GET /users — no session, no rate limit, no pagination that hides anything.',
      defense: 'Defense: require a session, return only what the caller may see, and rate-limit account lookups so a list cannot be harvested.',
      walk: i => [
        { cmd: 'GET /users', why: 'The endpoint on ' + i.host + ' was left public. It returns every account, which is the list an attacker uses for password spraying and phishing.' }
      ],
      check: (s, ev) => ev.some(e => e.target.split('?')[0] === '/users' && e.status === 200) && 'Account list harvested — the first half of a credential attack.'
    },
    {
      id: 'xss', icon: '🧪', title: 'Stored XSS: steal the admin cookie',
      brief: i => 'The guestbook on ' + i.host + ' renders messages as raw HTML and an admin bot reads it after every post.',
      goal: () => 'Post a script that sends document.cookie, then use the stolen session.',
      hint: () => 'POST /guestbook?msg=<script>fetch("/x?"+document.cookie)</script> — it must contain <script and the word cookie.',
      defense: 'Defense: HTML-encode all user output and set the session cookie HttpOnly so scripts cannot read it. A Content-Security-Policy blocks injected scripts.',
      walk: i => [
        { cmd: 'POST /guestbook?msg=<script>fetch("/x?"+document.cookie)</script>', why: 'Store a script in the guestbook on ' + i.host + '. The server saves it as raw HTML, so when the admin bot opens the page the script runs in its browser and exfiltrates its session cookie.' },
        { do: 'Click 🍪 Use stolen cookie', why: 'Swap your session for the stolen admin cookie, then the staff panel opens as admin.' }
      ],
      check: s => !!s.botCookie && s.cookie === s.botCookie && 'Stored XSS fired in the bot’s browser, and the stolen session opens the staff panel.'
    },
    {
      id: 'lfi', icon: '📂', title: 'Path traversal: read outside the folder',
      brief: i => '/download?file= on ' + i.host + ' glues the name onto a folder and never checks where it lands.',
      goal: () => 'Walk out of the download folder with ../../ and read /etc/passwd.',
      hint: () => 'GET /download?file=../../../../etc/passwd — then try ../../../../var/www/config.php',
      defense: 'Defense: resolve the requested name against a fixed base and reject anything that escapes it (realpath plus a prefix test). Store downloads outside the app.',
      walk: i => [
        { cmd: 'GET /download?file=../../../../etc/passwd', why: 'The download handler on ' + i.host + ' joins your name onto /var/www/downloads. ../ walks back out, so the server reads anything its own user can read.' },
        { cmd: 'GET /download?file=../../../../var/www/config.php', why: 'The application config is the prize: database password, JWT secret and an API key, in one file.' }
      ],
      check: (s, ev) => ev.some(e => /^\/download\?/.test(e.target) && /etc\/passwd/.test(decodeURIComponent(e.target)) && e.status === 200) && 'Path traversal confirmed: you read a file outside the web root.'
    },
    {
      id: 'backup', icon: '🗄️', title: 'Artefacts: the leaked backup and .env',
      brief: i => 'A backup archive and a dotfile were left in the web root of ' + i.host + '. No exploit needed.',
      goal: i => 'Fetch /' + i.backupName + ' and /.env, and read the secrets inside them.',
      hint: i => 'GET /.env leaks the environment; GET /' + i.backupName + ' is the site archive sitting where anyone can download it.',
      defense: 'Defense: never publish build output, backups or dotfiles; keep them outside the web root and rotate every secret that ever shipped.',
      walk: i => [
        { cmd: 'GET /.env', why: 'A dotfile in the web root of ' + i.host + ' is served as a static file. It holds the database password and the JWT signing secret.' },
        { cmd: 'GET /' + i.backupName, why: 'The site archive was left behind too. Its text reveals the same secrets, plus the admin password hash.' }
      ],
      check: (s, ev) => ev.some(e => (e.target.split('?')[0] === '/.env' || e.target.split('?')[0] === '/' + s.cfg.backupName) && e.status === 200) && 'Secrets straight out of a static file — the cheapest breach there is.'
    },
    {
      id: 'cmdi', icon: '🐚', title: 'Command injection: the ping field',
      brief: i => 'A small ping tool on ' + i.host + ' shells out with the hostname you type.',
      goal: () => 'Break out of the argument with ; and run id on the server.',
      hint: () => 'GET /ping?host=127.0.0.1;id  — %3B is just a URL-encoded semicolon.',
      defense: 'Defense: never call a shell from an application: pass an argument array (spawn with shell:false) and validate the host with a real parser.',
      walk: i => [
        { cmd: 'GET /ping?host=127.0.0.1%3Bid', why: 'The tool on ' + i.host + ' builds the string "ping <host>" and hands it to a shell. The semicolon ends the ping and starts your command, which runs as the web user.' },
        { cmd: 'GET /ping?host=127.0.0.1%3Bcat%20/var/www/config.php', why: 'Same bug, better payload: read the application config with the privileges of the web server.' }
      ],
      check: (s, ev) => ev.some(e => /^\/ping\?/.test(e.target) && /;|\%3B/.test(decodeURIComponent(e.target)) && e.status === 200) && 'OS command injection: your punctuation became a command on the server.'
    },
    {
      id: 'ssrf', icon: '🛰️', title: 'SSRF: make the server fetch for you',
      brief: i => '/fetch?url= on ' + i.host + ' will request any address the server can reach.',
      goal: () => 'Point the fetcher at the cloud metadata service (169.254.169.254) and read its credentials.',
      hint: () => 'GET /fetch?url=http://169.254.169.254/latest/meta-data/',
      defense: 'Defense: allowlist outbound destinations, block link-local ranges, require IMDSv2, and give the instance the smallest role that works.',
      walk: i => [
        { cmd: 'GET /fetch?url=http://169.254.169.254/latest/meta-data/', why: 'The link-preview endpoint on ' + i.host + ' fetches whatever URL it is given. From where the server sits, 169.254.169.254 is the cloud metadata service: instance identity, role name and temporary credentials.' }
      ],
      check: (s, ev) => ev.some(e => /^\/fetch\?/.test(e.target) && decodeURIComponent(e.target).includes('169.254.169.254') && e.status === 200) && 'SSRF confirmed: a web bug just became cloud access.'
    },
    {
      id: 'upload', icon: '💀', title: 'File upload: take the server',
      brief: i => 'The upload endpoint on ' + i.host + ' checks the extension by name only, and the web server runs .php.',
      goal: () => 'Upload shell.php, then request it with ?cmd=cat /flag and read the flag.',
      hint: () => 'POST /upload?file=shell.php then GET /uploads/shell.php?cmd=cat /flag',
      defense: 'Defense: validate file content (not the name), store uploads outside the web root, and never let the upload directory execute code.',
      walk: i => [
        { cmd: 'POST /upload?file=shell.php', why: 'The upload only checks the .php name, not the file content, so a webshell is stored under /uploads on ' + i.host + '.' },
        { cmd: 'GET /uploads/shell.php?cmd=cat /flag', why: 'The web server executes the uploaded PHP, running your command as www-data and printing the flag.' }
      ],
      check: (s, ev) => ev.some(e => /^\/uploads\/[\w.-]+\.php\?.*cmd=cat\s+\/flag/.test(decodeURIComponent(e.target))) && 'Remote code execution as www-data, then root: the box is fully owned.'
    },
    {
      id: 'redirect', icon: '↪️', title: 'Open redirect: a link that leaves the site',
      brief: i => '/redirect?next= on ' + i.host + ' sends the browser anywhere it is told.',
      goal: () => 'Send /redirect?next=//evil.example and get a 302 to a host that is not yours.',
      hint: () => 'GET /redirect?next=//evil.example — the // means "another host" to every browser.',
      defense: 'Defense: allow only relative paths or a fixed allowlist of destinations, and never build a redirect target from raw input.',
      walk: i => [
        { cmd: 'GET /redirect?next=//evil.example/login', why: 'The sign-in flow on ' + i.host + ' forwards to next after logging in. Because the value is not checked, a phishing page on evil.example can borrow the trust of your real domain.' }
      ],
      check: (s, ev) => ev.some(e => /^\/redirect\?/.test(e.target) && e.status >= 300 && e.status < 400 && /^https?:\/\/|^\/\//.test(String(e.headers.location || ''))) && 'Open redirect: the site happily pointed at a host it does not own.'
    }
  ];

  /* A fresh, randomized target instance for one offline page. */
  function makeInstance(desc) {
    const seed = (hash(desc.slug) ^ Math.floor(Math.random() * 4294967295)) >>> 0;
    const r = rng(seed);
    const token = hex(r, 6);
    const u = slugify(desc.slug);
    const users = [
      { id: 1, name: 'admin', email: 'admin@' + desc.slug + '.offline.example', role: 'admin', api_key: 'sk_live_' + token },
      { id: 2, name: 'you', email: 'guest@' + desc.slug + '.offline.example', role: 'user', api_key: 'sk_test_' + hex(r, 6) }
    ];
    let id = 10;
    for (const name of ['maya', 'leo', 'priya', 'tom', 'zara', 'noah', 'ines', 'kofi', 'lena', 'omar']) {
      id += 1 + Math.floor(r() * 5);
      users.push({ id, name, email: name + '@' + desc.slug + '.offline.example', role: r() > 0.85 ? 'editor' : 'user', api_key: 'sk_live_' + hex(r, 10) });
    }
    /* Deal this target its own hand of vulnerabilities: four to seven classes, always in a different
       combination and a different order. The slug seeds the deal, the re-rolled token makes each New
       challenge on the same page a different range again. */
    const deck = MODULES.slice();
    for (let i = deck.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); const t = deck[i]; deck[i] = deck[j]; deck[j] = t; }
    /* how many bugs a page carries belongs to the page (so its card and the target agree), while the re-rolled
       token decides which ones and in what order */
    const count = 4 + (hash(desc.slug) % 4);
    const mods = deck.slice(0, Math.min(count, deck.length)).map(m => m.id);
    return {
      slug: desc.slug, title: desc.title, brand: desc.brand, token, seed, mods, users,
      host: desc.slug + '.offline.example',
      tagline: 'Offline mirror of the ' + desc.brand + ' library.',
      adminPath: '/' + one(r, ['staff', 'admin-panel', 'control', 'backoffice', 'ops-console']) + '-' + token.slice(0, 3),
      backupName: one(r, ['backup', 'site-backup', 'www-archive']) + '-' + hex(r, 4) + '.zip',
      flagAdmin: 'FLAG{' + u.replace(/-/g, '_') + '_admin_' + token.slice(0, 4) + '}',
      flagRoot: 'FLAG{root_' + u.replace(/-/g, '_') + '_' + hex(r, 4) + '}',
      dbPass: 'db_' + hex(r, 12),
      jwtSecret: hex(r, 24),
      metadataRole: 'role-web-' + hex(r, 6),
      accessKey: 'ASIA' + hex(r, 12).toUpperCase()
    };
  }

  function makeServer(cfg) {
    return { cfg, cookie: 'session=guest', adminCookie: 'session=adm_' + cfg.token, botCookie: null, guestbook: [], files: {}, adminPanels: 0, has: id => cfg.mods.includes(id) };
  }

  function html(cfg, title, body, extra) {
    return '<!doctype html>\n<html><head><title>' + title + ' · ' + cfg.brand + '</title>' + (extra || '') + '</head>\n<body>\n' + body + '\n</body></html>';
  }

  function handle(state, raw) {
    const cfg = state.cfg, line = String(raw || '').trim();
    const method = /^post\s/i.test(line) ? 'POST' : 'GET';
    const target = line.replace(/^(?:get|post)\s+/i, '').split('#')[0] || '/';
    const at = target.indexOf('?');
    const path = at < 0 ? target : target.slice(0, at);
    const query = new URLSearchParams(at < 0 ? '' : target.slice(at + 1));
    const authed = /session=adm_/.test(state.cookie);
    const has = id => cfg.mods.includes(id);
    const ADMIN = cfg.adminPath, USERS = cfg.users;
    /* a response that reads like a real HTTP/1.1 reply: standard headers, an accurate Content-Length,
       and realistic cookie attributes (the missing HttpOnly is the actual bug) */
    const byteLen = s => encodeURIComponent(String(s == null ? '' : s)).replace(/%[0-9a-f]{2}/gi, 'x').length;
    const res = (status, statusText, body, headers) => {
      const extra = Object.assign({}, headers || {});
      if (extra['set-cookie'] && !/HttpOnly/i.test(extra['set-cookie'])) extra['set-cookie'] += '; Path=/; SameSite=Lax';
      const merged = Object.assign({
        server: 'nginx/1.25.3',
        date: new Date().toUTCString(),
        'content-type': 'text/html; charset=UTF-8'
      }, extra, {
        'content-length': String(byteLen(body)),
        'x-powered-by': 'PHP/8.2.12',
        connection: 'keep-alive'
      });
      return { method, target, status, text: statusText, body, headers: merged };
    };
    const links = ['<a href="/login">Sign in</a>', '<a href="/guestbook">Guestbook</a>'];
    if (has('lfi')) links.push('<a href="/download?file=readme.txt">Downloads</a>');
    if (has('ssrf')) links.push('<a href="/fetch?url=https://example.com">Link preview</a>');
    if (has('cmdi')) links.push('<a href="/ping?host=127.0.0.1">Ping a host</a>');
    if (has('enum') || has('idor')) links.push('<a href="/users">People</a>');

    if (path === '/' || path === '/index.html') {
      return res(200, 'OK', html(cfg, 'Welcome', [
        '<h1>' + esc(cfg.brand) + '</h1><p>' + esc(cfg.tagline) + '</p>',
        links.join(' · '),
        has('recon') ? '<!-- TODO(dev): retire ' + ADMIN + ' before launch, the staff dashboard is still reachable -->' : '<!-- build: ' + cfg.token + ' -->'
      ].join('\n')));
    }
    if (path === '/robots.txt') {
      const lines = ['User-agent: *', 'Disallow: /login', 'Disallow: /guestbook'].concat(has('recon') ? ['Disallow: ' + ADMIN] : []);
      return res(200, 'OK', lines.join('\n') + '\n', { 'content-type': 'text/plain' });
    }
    if (path === '/login') {
      const u = query.get('u') || query.get('user') || '';
      const p = query.get('p') || query.get('pass') || '';
      if (has('login') && (/'+\s*(?:or|OR)\s+1\s*=\s*1\s*(?:--|#)/.test(u) || /'+\s*(?:or|OR)\s+'1'\s*=\s*'1/i.test(u))) {
        state.cookie = state.adminCookie;
        return res(302, 'Found', '<p>Signed in as <b>admin</b>. Redirecting to /account…</p>', { location: '/account', 'set-cookie': state.adminCookie });
      }
      if (!u || !p) return res(400, 'Bad Request', html(cfg, 'Sign in', "<h2>Sign in</h2><p>Both u and p are required.</p><p>The query is built as a plain string: SELECT * FROM users WHERE name = '" + esc(u || 'u') + "' AND pass = '" + esc(p || 'p') + "'</p>"));
      return res(401, 'Unauthorized', html(cfg, 'Sign in', '<h2>Sign in</h2><p>Invalid credentials for ' + esc(u) + '.</p>'));
    }
    if (path === '/account') {
      if (!authed) return res(302, 'Found', '<p>Please sign in.</p>', { location: '/login' });
      return res(200, 'OK', html(cfg, 'Account', '<h2>Staff account</h2><p>Welcome, admin. Panel: <code>' + ADMIN + '</code></p>'));
    }
    if (path === ADMIN) {
      if (!authed) return res(403, 'Forbidden', html(cfg, 'Staff only', '<h2>403 — staff only</h2><p>Your cookie: <code>' + esc(state.cookie) + '</code></p><p>The server trusts the session cookie. Get an admin one.</p>'));
      state.adminPanels++;
      return res(200, 'OK', html(cfg, 'Staff dashboard', [
        '<h2>Staff dashboard — ' + esc(cfg.brand) + '</h2><p>All users:</p><ul>',
        ...USERS.map(u => '<li>' + esc(u.name) + ' — ' + esc(u.email) + ' — api_key <code>' + esc(u.api_key) + '</code></li>'),
        '</ul><p>Deploy secret: <b style="color:#6ee7a0">' + esc(cfg.flagAdmin) + '</b></p>'
      ].join('')));
    }
    if (path === '/users' && (has('enum') || has('idor'))) {
      return res(200, 'OK', JSON.stringify(USERS.map(u => ({ id: u.id, name: u.name, email: u.email, role: u.role })), null, 2), { 'content-type': 'application/json' });
    }
    if (path === '/users') return res(403, 'Forbidden', '{"error":"authentication required"}', { 'content-type': 'application/json' });
    if (path === '/profile' && has('idor')) {
      const id = query.get('id');
      if (!id) return res(400, 'Bad Request', '{"error":"id is required"}', { 'content-type': 'application/json' });
      const user = USERS.find(u => String(u.id) === id);
      if (!user) return res(404, 'Not Found', '{"error":"no such user"}', { 'content-type': 'application/json' });
      return res(200, 'OK', JSON.stringify(user, null, 2), { 'content-type': 'application/json' });
    }
    if (path === '/search') {
      const q = String(query.get('q') || '');
      return res(200, 'OK', html(cfg, 'Search', '<h2>Results for</h2><div id="q">' + esc(q) + '</div><p>4 results.</p>' +
        (/<script/i.test(q) ? '<p style="color:#6ee7a0">The stored response contains your script unescaped. A real browser would run it — shown escaped here so this page stays safe.</p>' : '')));
    }
    if (path === '/guestbook') {
      const msg = query.get('msg');
      if (method === 'POST' || msg != null) {
        if (!msg) return res(400, 'Bad Request', '{"error":"msg is required"}');
        state.guestbook.push(msg);
        let bot = '';
        if (has('xss') && /<script/i.test(msg) && /cookie/i.test(msg)) {
          state.botCookie = state.adminCookie;
          bot = '\n<p style="color:#6ee7a0">An admin bot opened the guestbook and ran your script. It sent you its cookie: <b>' + state.adminCookie + '</b></p>';
        }
        return res(201, 'Created', html(cfg, 'Guestbook', '<h2>Thanks!</h2><p>Says: ' + esc(msg) + '</p>' + bot + '<p>' + state.guestbook.length + ' messages stored (the server does no encoding — the script lives in its HTML, shown escaped here).</p>'));
      }
      return res(200, 'OK', html(cfg, 'Guestbook', '<h2>Guestbook</h2>' + (state.guestbook.length ? state.guestbook.map(m => '<p>' + esc(m) + '</p>').join('') : '<p>No messages yet.</p>') + '<form action="/guestbook" method="post"><input name="msg"></form>'));
    }
    if (path === '/download' && has('lfi')) {
      const file = String(query.get('file') || '');
      if (!file) return res(400, 'Bad Request', '{"error":"file is required"}');
      const joined = '/var/www/downloads/' + file;
      const norm = joined.split('/').reduce((acc, seg) => { if (!seg || seg === '.') return acc; if (seg === '..') { acc.pop(); return acc; } acc.push(seg); return acc; }, []).join('/');
      if (norm === 'etc/passwd') {
        return res(200, 'OK', 'root:x:0:0:root:/root:/bin/bash\nwww-data:x:33:33:www-data:/var/www:/usr/sbin/nologin\nmaint:x:1000:1000:maint:/home/maint:/bin/bash\n', { 'content-type': 'text/plain' });
      }
      if (norm === 'var/www/config.php') {
        return res(200, 'OK', "<?php\n// database and signing secrets for " + cfg.brand + "\nreturn [\n  'db_pass' => '" + cfg.dbPass + "',\n  'jwt_secret' => '" + cfg.jwtSecret + "',\n  'deploy_key' => 'sk_live_" + cfg.token + "',\n  'admin_hash' => '$2y$10$" + cfg.token + "Q2x1ZQ',\n];\n", { 'content-type': 'text/plain' });
      }
      if (norm.startsWith('root')) return res(403, 'Forbidden', 'open_basedir restriction in effect. File is not within the allowed path(s): (/var/www)', { 'content-type': 'text/plain' });
      return res(404, 'Not Found', '{"error":"no such file"}', { 'content-type': 'application/json' });
    }
    if (path === '/ping' && has('cmdi')) {
      const host = String(query.get('host') || '');
      if (!host) return res(400, 'Bad Request', '{"error":"host is required"}');
      const cut = host.split(/[;|&`]/);
      const injected = cut.slice(1).join(';').trim();
      const head = 'PING ' + cut[0] + ' (127.0.0.1): 56 data bytes\n64 bytes from 127.0.0.1: icmp_seq=0 ttl=64 time=0.041 ms\n\n';
      if (!injected) return res(200, 'OK', '<pre>' + esc(head) + '</pre>');
      let out = 'uid=33(www-data) gid=33(www-data) groups=33(www-data)\n';
      if (/cat\s+\/var\/www\/config\.php|config\.php/.test(injected)) out = "<?php\n  'db_pass' => '" + cfg.dbPass + "',\n  'jwt_secret' => '" + cfg.jwtSecret + "',\n  'admin_hash' => '$2y$10$" + cfg.token + "Q2x1ZQ',\n";
      else if (/^\s*id\b/.test(injected)) out = 'uid=33(www-data) gid=33(www-data) groups=33(www-data)\n';
      return res(200, 'OK', '<pre>' + esc(head + out) + '</pre>');
    }
    if (path === '/fetch' && has('ssrf')) {
      const url = String(query.get('url') || '');
      if (!url) return res(400, 'Bad Request', '{"error":"url is required"}');
      if (/169\.254\.169\.254/.test(url)) {
        return res(200, 'OK', JSON.stringify({ 'instance-id': 'i-' + cfg.token, 'iam': { 'info': { 'instance-profile-arn': 'arn:aws:iam::' + cfg.token + ':instance-profile/' + cfg.metadataRole } } }, null, 2), { 'content-type': 'application/json' });
      }
      if (/^https?:\/\//i.test(url)) return res(200, 'OK', JSON.stringify({ title: 'Fetched: ' + url, note: 'egress allowed' }, null, 2), { 'content-type': 'application/json' });
      return res(400, 'Bad Request', '{"error":"only http/https urls are accepted"}', { 'content-type': 'application/json' });
    }
    if (path === '/.env' && has('backup')) {
      return res(200, 'OK', 'APP_ENV=production\nAPP_KEY=base64:' + cfg.jwtSecret + '\nDB_PASSWORD=' + cfg.dbPass + '\nDEPLOY_API_KEY=sk_live_' + cfg.token + '\nADMIN_PASSWORD_HASH=$2y$10$' + cfg.token + 'Q2x1ZQ\n', { 'content-type': 'text/plain' });
    }
    if (path === '/' + cfg.backupName && has('backup')) {
      return res(200, 'OK', 'PK\u0003\u0004 (simulated archive)\n  app/config.php\n  app/.env\n  app/public/index.php\n\n--- app/.env ---\nAPP_KEY=base64:' + cfg.jwtSecret + '\nDB_PASSWORD=' + cfg.dbPass + '\n--- app/config.php ---\ndeploy key sk_live_' + cfg.token + '\nadmin hash $2y$10$' + cfg.token + 'Q2x1ZQ\n', { 'content-type': 'application/zip' });
    }
    if (path === '/redirect' && has('redirect')) {
      const next = String(query.get('next') || '/');
      const dest = next.startsWith('//') ? 'https:' + next : next;
      return res(302, 'Found', '<p>Redirecting to ' + esc(dest) + '…</p>', { location: dest });
    }
    if (path === '/upload') {
      if (!has('upload')) return res(404, 'Not Found', '{"error":"no such route"}', { 'content-type': 'application/json' });
      const file = query.get('file') || query.get('filename') || '';
      if (!file) return res(400, 'Bad Request', '{"error":"file is required"}');
      if (!/\.php$/i.test(file)) return res(415, 'Unsupported Media Type', '{"error":"only images are accepted"}');
      const stored = '/uploads/' + file.replace(/[^a-z0-9_.-]/gi, '_');
      state.files[stored] = true;
      return res(201, 'Created', '{"stored":"' + stored + '","note":"php is not supposed to run here"}', { 'content-type': 'application/json' });
    }
    if (/^\/uploads\/[\w.-]+\.php$/.test(path)) {
      if (!state.files[path]) return res(404, 'Not Found', '{"error":"no such upload"}', { 'content-type': 'application/json' });
      const cmd = query.get('cmd') || '';
      if (!cmd) return res(200, 'OK', 'webshell ready · try ?cmd=id');
      if (/cat\s+\/flag|cat flag/.test(cmd)) return res(200, 'OK', '<pre>root@' + esc(cfg.slug) + ':/var/www$ ' + esc(cmd) + '\n' + cfg.flagRoot + '\n</pre>', { 'content-type': 'text/html' });
      return res(200, 'OK', '<pre>root@' + esc(cfg.slug) + ':/var/www$ ' + esc(cmd) + '\nwww-data\n</pre>');
    }
    return res(404, 'Not Found', html(cfg, '404', '<h2>404 — not found</h2><p>No route for <code>' + esc(path) + '</code>.</p><p>Start from / or robots.txt.</p>'));
  }

  /* A descriptor is one piece of offline content the browser holds: a library it downloaded, a page it
     imported, or (when it holds nothing yet) a practice target. */
  function descFor(lib, i) {
    const o = typeof lib === 'string' ? { title: lib } : (lib || {});
    const fromPath = o.path ? String(o.path).replace(/[\\/]+$/, '').split(/[\\/]/).pop() : '';
    const title = String(o.title || o.name || o.label || fromPath || ('Offline item ' + ((i || 0) + 1)));
    return { slug: slugify(o.name || o.slug || title), title, brand: title.length > 30 ? title.slice(0, 29) + '…' : title, demo: !!o.demo };
  }

  const DEMOS = [
    { name: 'practice-encyclopedia', title: 'Practice Encyclopedia', demo: true },
    { name: 'practice-bookshelf', title: 'Practice Bookshelf', demo: true }
  ];

  function mount(host, opts) {
    opts = opts || {};
    let sources = (Array.isArray(opts.books) && opts.books.length ? opts.books : DEMOS).slice();
    let hasReal = Array.isArray(opts.books) && opts.books.length > 0;
    const seen = new Set();
    let descriptors = [];
    const q = sel => host.querySelector(sel);

    function build() {
      seen.clear();
      descriptors = sources.slice(0, 200).map((lib, i) => {
        const d = descFor(lib, i);
        let s = d.slug, n = 1;
        while (seen.has(s)) s = d.slug + '-' + (++n);
        seen.add(s); d.slug = s;
        return d;
      });
    }
    build();

    let desc = null, instance = null, state = null, events = [], idx = 0, solved = false;
    let owned = [];
    const winKey = d => 'cd_breach_wins_' + d.slug;
    const wins = d => { try { return +ls.get(winKey(d), '0') || 0; } catch (e) { return 0; } };
    const addWin = d => { try { ls.set(winKey(d), String(wins(d) + 1)); } catch (e) { } };
    const missions = () => instance.mods.map(id => MODULES.find(m => m.id === id)).filter(Boolean);

    const banner = '<div style="' + box + ';border-color:var(--acc);background:rgba(110,231,160,.06)">' +
      '<b>🛡️ Training simulation — offline and safe.</b><p class="small" style="margin:4px 0 0;line-height:1.5">' +
      'Every target is a fake backend that runs entirely inside this page. No real website, library, server or network is contacted, and nothing leaves your browser. ' +
      'Each offline page you hold gets its <b>own</b> set of vulnerabilities — dealt from eleven classes, in a different combination every time — and every New challenge re-rolls them. Each solved step ends with the defense that stops it.</p></div>';

    function newInstance() {
      instance = makeInstance(desc);
      state = makeServer(instance);
      events = []; idx = 0; owned = []; solved = false;
    }

    function renderList() {
      const note = hasReal
        ? 'One target per offline page this browser holds. Every target is a different fake backend with its own bug list. Pick one to begin.'
        : 'No offline pages yet, so these are practice targets. Download or import pages in the Browser and each becomes its own target here.';
      host.innerHTML = '<div class="cd-content" style="display:grid;gap:12px">' +
        '<h2>Breach Lab</h2>' + banner +
        '<p class="small mute" style="margin:0">' + note + '</p>' +
        '<div class="cd-case-grid">' + descriptors.map((d, i) => {
          const w = wins(d);
          const bugs = 4 + (hash(d.slug) % 4);
          return '<button type="button" data-desc="' + i + '"><i aria-hidden="true">🕸️</i><b>' + esc(d.brand) + (d.demo ? ' (practice)' : '') + '</b>' +
            '<small>' + esc(d.slug) + '.offline.example · ' + bugs + ' vulnerabilities · ' + badge(w ? 'owned ' + w + '×' : 'not owned yet', w ? 'var(--ok)' : 'var(--line)') + '</small></button>';
        }).join('') + '</div>' +
        '<details><summary>What you are learning</summary><p class="small" style="line-height:1.5">Recon (hidden routes), SQL injection, broken access control and IDOR, user enumeration, stored cross-site scripting, path traversal, leaked backups and dotfiles, command injection, SSRF, insecure file upload leading to remote code execution, and open redirects. Eleven classes, dealt differently to every page — these are the OWASP-style basics every web defender needs. The lab shows the attack, then the fix.</p></details>' +
        '</div>';
    }

    function renderTarget() {
      host.innerHTML = '<div class="cd-content" style="display:grid;gap:10px">' +
        '<div class="row" style="gap:8px;align-items:center;flex-wrap:wrap"><button type="button" class="ib" data-act="back">← All targets</button>' +
        '<b style="flex:1">' + esc(instance.brand) + '</b>' + badge('simulation', 'var(--acc)') +
        '<button type="button" class="ib" data-act="fullwalk" title="Show the whole breach, step by step">📋 Full walkthrough</button>' +
        '<button type="button" class="ib" data-act="newchallenge" title="Re-roll this target with brand-new vulnerabilities and secrets">🎲 New challenge</button></div>' +
        '<div style="' + box + '">' +
          '<div class="row" style="gap:6px;align-items:center;flex-wrap:wrap">' +
            '<span class="small mute">🔒 https://' + esc(instance.host) + '</span>' +
            '<input data-url class="ib" style="flex:1;min-width:180px;' + mono + ';padding:6px 8px" value="/" spellcheck="false" autocomplete="off">' +
            '<button class="pri" data-act="go">Send</button>' +
            '<button class="ib" data-act="steal" title="Switch your session to the cookie the admin bot leaked">🍪 Use stolen cookie</button>' +
            '<button class="ib" data-act="reset" title="Forget cookies and stored data">Reset server</button>' +
          '</div>' +
          '<div class="small mute" data-cookie style="margin-top:6px"></div>' +
          '<pre data-res style="margin:8px 0 0;padding:10px;border-radius:8px;background:#0b0f14;border:1px solid var(--line);max-height:260px;overflow:auto;white-space:pre-wrap;word-break:break-word;' + mono + ';font-size:12.5px;color:#cfe9d6"></pre>' +
        '</div>' +
        '<div class="row" style="gap:6px;flex-wrap:wrap" data-tabs></div>' +
        '<div style="' + box + '" data-mission></div>' +
        '<div class="row" style="gap:6px;flex-wrap:wrap;align-items:center"><button class="ib" data-act="hint">💡 Hint</button>' +
        '<button class="ib" data-act="walk">📖 Walkthrough</button>' +
        '<button class="ib" data-act="fix">🛡️ Show the defense</button><button class="ib" data-act="next">Next vulnerability →</button>' +
        '<span style="flex:1"></span><span class="small mute" data-owned></span></div>' +
        '</div>';
      drawMission();
      req('/');
    }

    function drawTabs() {
      const list = missions();
      q('[data-tabs]').innerHTML = list.map((m, i) =>
        '<button type="button" class="ib' + (i === idx ? ' on' : '') + '" data-mtab="' + i + '" style="padding:4px 9px" title="' + esc(m.title) + '">' +
        (owned.includes(m.id) ? '✅ ' : '') + m.icon + ' ' + (i + 1) + '</button>').join('') +
        '<span style="flex:1"></span>' + badge(owned.length + '/' + list.length + ' exploited', owned.length ? 'var(--ok)' : 'var(--line)');
    }

    function drawMission() {
      drawTabs();
      const list = missions(), m = list[idx];
      if (!m) return;
      const done = owned.includes(m.id);
      q('[data-mission]').innerHTML = '<div class="row" style="gap:8px;align-items:center;flex-wrap:wrap">' + badge(m.icon + ' Vulnerability ' + (idx + 1)) +
        (done ? badge('owned', 'var(--ok)') : '') + '<b style="flex:1">' + esc(m.title) + '</b></div>' +
        '<p class="small" style="margin:8px 0 4px">' + esc(text(m.brief, instance)) + '</p>' +
        '<p class="small" style="margin:0"><b>Target:</b> ' + esc(instance.host) + '<br><b>Goal:</b> ' + esc(text(m.goal, instance)) + '</p>' +
        '<p class="small" data-msg style="margin:6px 0 0;color:var(--mute)"></p>' +
        '<div data-walk style="margin-top:8px"></div>';
      q('[data-owned]').textContent = owned.length + ' of ' + list.length + ' vulnerabilities exploited on this instance · owned ' + wins(desc) + '× total';
    }

    const stepRow = s => {
      const line = s.cmd
        ? '<button type="button" class="ib" data-run="' + esc(s.cmd) + '" title="Send this exact request" style="display:block;width:100%;text-align:left;' + mono + ';font-size:12px;padding:5px 7px;white-space:pre-wrap;word-break:break-word">▶ ' + esc(s.cmd) + '</button>'
        : '<div style="' + mono + ';font-size:12px;color:var(--acc)">• ' + esc(s.do) + '</div>';
      return '<li style="margin:6px 0">' + line + '<div class="small mute" style="margin-top:3px;line-height:1.4">' + esc(s.why) + '</div></li>';
    };
    function renderWalk(mId) {
      const m = missions().find(x => x.id === mId);
      if (!m) return;
      q('[data-walk]').innerHTML = '<div style="' + box + ';background:rgba(110,231,160,.05)"><b class="small">📖 Walkthrough — ' + esc(m.title) + ' on ' + esc(instance.host) + '</b>' +
        '<ol style="margin:6px 0 0;padding-left:18px">' + m.walk(instance).map(stepRow).join('') + '</ol>' +
        '<p class="small" style="margin:6px 0 0;color:var(--mute)">' + esc(m.defense) + '</p>' +
        '<p class="small mute" style="margin:4px 0 0">Click a ▶ line to send that exact request against this simulated server.</p></div>';
    }
    function renderFullWalk() {
      const list = missions();
      q('[data-walk]').innerHTML = '<div style="' + box + '"><b class="small">📋 Full engagement walkthrough — ' + esc(instance.brand) + ' (' + esc(instance.host) + ')</b>' +
        '<p class="small mute" style="margin:4px 0 0">This instance was dealt ' + list.length + ' vulnerabilities: ' + list.map(m => esc(m.title.split(':')[0])).join(', ') + '.</p>' +
        list.map((m, i) => '<div style="margin-top:8px"><b class="small">' + m.icon + ' ' + (i + 1) + '. ' + esc(m.title) + '</b>' +
          '<ol style="margin:4px 0 0;padding-left:18px">' + m.walk(instance).map(stepRow).join('') + '</ol>' +
          '<p class="small" style="margin:4px 0 0;color:var(--mute)">' + esc(m.defense) + '</p></div>').join('') +
        '<p class="small mute" style="margin:8px 0 0">Every request above hits only this fake in-page server. Nothing is sent to any real site, library or network.</p></div>';
    }

    const titleCase = k => k.replace(/(^|-)([a-z])/g, (_, a, b) => a + b.toUpperCase());
    function req(url) {
      const sent = state.cookie;
      const r = handle(state, url);
      events.push(r);
      const reqBlock = r.method + ' ' + r.target + ' HTTP/1.1\n' +
        'Host: ' + instance.host + '\n' +
        'User-Agent: BreachLab/1.0 (offline simulation)\n' +
        'Accept: */*\n' +
        'Cookie: ' + sent + '\n';
      const resBlock = 'HTTP/1.1 ' + r.status + ' ' + r.text + '\n' +
        Object.entries(r.headers).map(([k, v]) => titleCase(k) + ': ' + v).join('\n') + '\n\n' + r.body;
      const pre = q('[data-res]');
      pre.textContent = '─ REQUEST ─────────────\n' + reqBlock + '\n─ RESPONSE ────────────\n' + resBlock;
      pre.style.color = r.status >= 400 ? '#ffb3b3' : '#cfe9d6';
      q('[data-cookie]').textContent = 'Your cookies: ' + state.cookie + (state.botCookie ? '   ·   stolen admin cookie: ' + state.botCookie : '');
      check();
    }

    function check() {
      const list = missions(), m = list[idx];
      if (!m || owned.includes(m.id) || solved) return;
      let result = false;
      try { result = m.check(state, events); } catch (e) { result = false; }
      if (!result) return;
      owned.push(m.id);
      solved = true;
      /* every bug found on a simulated site pays into the practice bank */
      A.cyberBank?.exploit(instance.host);
      drawMission();
      const msg = q('[data-msg]');
      if (msg) msg.innerHTML = '✅ <span style="color:var(--ok)">' + esc(typeof result === 'string' ? result : 'Vulnerability exploited.') + '</span>' +
        '<br><span style="color:var(--mute)">' + esc(m.defense) + '</span>';
      if (owned.length === list.length) {
        addWin(desc);
        /* taking a whole target pays a bonus; finance-flavoured targets pay more, the way a bank heist would */
        A.cyberBank?.target(instance.brand, /bank|finance|ledger|pay|trust|invest|credit/i.test(String(instance.brand) + ' ' + instance.host));
        q('[data-owned]').textContent = owned.length + ' of ' + list.length + ' vulnerabilities exploited on this instance · owned ' + wins(desc) + '× total';
        q('[data-mission]').insertAdjacentHTML('beforeend', '<p style="color:var(--ok);margin:8px 0 0"><b>Target owned (' + wins(desc) + '× total).</b> You exploited all ' + list.length + ' bugs on this simulated backend for ' + esc(instance.brand) + '. Every step had a real-world fix, and the defenses are listed with each. Press 🎲 New challenge for a fresh randomized instance, or ← All targets to try a different page — every page has its own bug list.</p>');
      }
      setTimeout(() => { solved = false; }, 0);
    }

    function onClick(e) {
      const b = e.target.closest('button');
      if (!b) return;
      if (b.dataset.desc != null) { desc = descriptors[+b.dataset.desc]; newInstance(); renderTarget(); return; }
      if (b.dataset.mtab != null) { idx = +b.dataset.mtab; drawMission(); return; }
      if (b.dataset.run != null) { q('[data-url]').value = b.dataset.run; req(b.dataset.run); return; }
      const list = missions();
      const go = () => { const v = q('[data-url]').value.trim(); if (v) req(v); };
      switch (b.dataset.act) {
        case 'back': renderList(); break;
        case 'newchallenge': newInstance(); renderTarget(); break;
        case 'go': go(); break;
        case 'hint': q('[data-msg]').textContent = 'Hint: ' + text(list[idx].hint, instance); break;
        case 'walk': renderWalk(list[idx].id); break;
        case 'fullwalk': renderFullWalk(); break;
        case 'fix': q('[data-msg]').textContent = list[idx].defense; break;
        case 'next': idx = (idx + 1) % list.length; drawMission(); q('[data-url]').value = '/'; break;
        case 'steal':
          if (!state.botCookie) { q('[data-msg]').textContent = 'No stolen cookie yet. Post a script to the guestbook and wait for the admin bot to read it.'; break; }
          state.cookie = state.botCookie;
          req(instance.adminPath + '?via=stolen-cookie');
          break;
        case 'reset':
          Object.assign(state, makeServer(instance));
          events = [];
          q('[data-res]').textContent = '(server reset — cookies cleared, uploads and guestbook emptied)';
          q('[data-cookie]').textContent = 'Your cookies: ' + state.cookie;
          break;
      }
    }

    host.addEventListener('click', onClick);
    host.addEventListener('keydown', e => {
      if (e.key === 'Enter' && e.target.matches('[data-url]')) {
        e.preventDefault();
        const v = e.target.value.trim(); if (v) req(v);
      }
    });
    renderList();

    /* The pages the Browser imported are offline pages too, so they join the targets. They live on the app's
       own server (/api/lib/mine), are read once, and never change. */
    if (typeof fetch === 'function') {
      fetch('/api/lib/mine', { cache: 'no-store' }).then(r => r.json()).then(d => {
        const mine = (d && d.libraries) || [];
        if (!mine.length) return;
        const slugs = new Set(descriptors.map(x => x.slug));
        const extra = mine.filter(lib => lib && lib.id && !slugs.has(slugify(lib.id)))
          .map(lib => ({ name: lib.id, title: lib.title || lib.id, imported: true }));
        if (!extra.length) return;
        sources = extra.concat(hasReal ? sources : []);
        hasReal = true;
        build();
        if (!desc) renderList();
      }).catch(() => { });
    }
    return () => { };
  }

  A.cyberBreach = { mount, classes: () => MODULES.map(m => ({ id: m.id, title: m.title })) };
})();

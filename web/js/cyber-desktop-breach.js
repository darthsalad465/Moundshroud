// Cyber Desktop > Moundshroud Browser > Breach Lab.
// A fully simulated, offline web-security training range. Every "site" here is a fake server object
// that lives inside this page: no real website, library, server or network is ever contacted, and no
// real request leaves the browser. One practice target is generated per offline library the browser
// holds, so the range grows as the user downloads more libraries. The point is to learn how web apps
// are attacked so you can defend them: every solved step ends with the real-world fix.
(() => {
  const box = 'border:1px solid var(--line);background:var(--panel2);border-radius:10px;padding:10px 12px';
  const mono = 'font-family:Consolas,"Cascadia Mono",monospace';
  const slugify = s => String(s || 'library').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 24) || 'library';
  const badge = (t, col) => '<span style="display:inline-block;padding:2px 8px;border-radius:999px;font-size:11.5px;border:1px solid ' +
    (col || 'var(--line)') + ';color:' + (col || 'var(--mute)') + ';background:rgba(255,255,255,.03)">' + t + '</span>';

  // The five chained missions, defined once. Flags and hosts are filled in per target at render time.
  const MISSIONS = [
    { id: 'recon', icon: '🔎', title: 'Recon: find the staff panel',
      brief: 'A staff dashboard is deployed but unlinked. Find its route before you touch the login.',
      goal: 'Read robots.txt or the homepage source, then request the hidden staff route.',
      hint: 'robots.txt lists exactly what the owner wants hidden. The homepage also carries a developer comment.',
      defense: 'Defense: never rely on a secret URL. Put real access control behind the route, and keep robots.txt free of sensitive paths.' },
    { id: 'login', icon: '🔑', title: 'Authentication: bypass the login',
      brief: 'The sign-in query glues your values straight into SQL. No parameter binding, no escaping.',
      goal: 'Send /login?u=…&p=… with a payload that logs you in as admin. Watch the cookie change.',
      hint: "Try u=' OR 1=1-- with any password. The rest of the query becomes a comment.",
      defense: 'Defense: use parameterized queries (prepared statements). The input becomes data, never part of the SQL.' },
    { id: 'idor', icon: '🪪', title: 'Broken access control: read another user',
      brief: '/profile?id= returns whatever id you ask for. There is no ownership check.',
      goal: 'Request the admin profile (id=1) and read its leaked api_key, then open the staff panel.',
      hint: '/profile?id=1 is the admin, /profile?id=2 is you.',
      defense: 'Defense: check that the session owner is allowed to read the requested record. Authorize every object, not just the login.' },
    { id: 'xss', icon: '🧪', title: 'Stored XSS: steal the admin cookie',
      brief: 'The guestbook renders messages as raw HTML and an admin bot reads it after every post.',
      goal: 'Post a script that sends document.cookie, then use the stolen session.',
      hint: 'POST /guestbook?msg=<script>fetch("/x?"+document.cookie)</script> — it must contain <script and the word cookie.',
      defense: 'Defense: HTML-encode all user output and set the session cookie HttpOnly so scripts cannot read it. A Content-Security-Policy blocks injected scripts.' },
    { id: 'rce', icon: '💀', title: 'File upload: take the server',
      brief: 'The upload endpoint checks the extension by name only, and the web server happily runs .php.',
      goal: 'Upload shell.php, then request it with ?cmd=cat /flag and read the flag.',
      hint: 'POST /upload?file=shell.php then GET /uploads/shell.php?cmd=cat /flag',
      defense: 'Defense: validate file content (not the name), store uploads outside the web root, and never let the upload directory execute code.' }
  ];

  // The exact steps a real tester would run against this class of bug, filled in with this target's own
  // host, secret path and ids. Each step is a real payload; here it hits the fake in-page server only.
  const WALK = {
    recon: i => [
      { cmd: 'GET /robots.txt', why: 'robots.txt lists the paths the owner wants crawlers to skip. The Disallow lines leak the hidden staff route.' },
      { cmd: 'GET /', why: 'View the homepage HTML source. A leftover developer TODO comment names the same staff path.' },
      { cmd: 'GET ' + i.adminPath, why: 'Request the staff route directly. A 403 confirms it exists; you still need an admin session to read it.' }
    ],
    login: i => [
      { cmd: "GET /login?u=' OR 1=1-- &p=x", why: "The query is SELECT * FROM users WHERE name='…' AND pass='…'. The quote closes the name string, OR 1=1 makes the row always match, and -- comments out the password check. The server replies 302 and sets an admin session cookie." }
    ],
    idor: i => [
      { cmd: "GET /login?u=' OR 1=1-- &p=x", why: 'First obtain a valid admin session with the same SQL injection bypass.' },
      { cmd: 'GET /profile?id=1', why: 'Ask for user id 1 (the admin). The endpoint never checks who you are, so it returns the admin record, including its api_key.' },
      { cmd: 'GET ' + i.adminPath, why: 'With the admin session the staff panel now loads and lists every user and secret.' }
    ],
    xss: i => [
      { cmd: 'POST /guestbook?msg=<script>fetch("/x?"+document.cookie)</script>', why: 'Store a script in the guestbook. The server saves it as raw HTML, so when the admin bot opens the page the script runs in its browser and exfiltrates its session cookie.' },
      { do: 'Click 🍪 Use stolen cookie', why: 'Swap your session for the stolen admin cookie, then the staff panel opens as admin.' }
    ],
    rce: i => [
      { cmd: 'POST /upload?file=shell.php', why: 'The upload only checks the .php name, not the file content, so a webshell is stored under /uploads.' },
      { cmd: 'GET /uploads/shell.php?cmd=cat /flag', why: 'The web server executes the uploaded PHP, running your command as www-data and printing the flag.' }
    ]
  };

  // A fresh fake server for one target. `cfg` carries the per-target labels and flags.
  function makeServer(cfg) {
    return { cfg, cookie: 'session=guest', adminCookie: 'session=adm_' + cfg.token, botCookie: null, guestbook: [], files: {}, adminPanels: 0 };
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
    // Build a response that reads like a real HTTP/1.1 reply: standard headers, an accurate
    // Content-Length, and realistic cookie attributes (the missing HttpOnly is the actual bug).
    const byteLen = s => encodeURIComponent(String(s == null ? '' : s)).replace(/%[0-9a-f]{2}/gi, 'x').length;
    const res = (status, text, body, headers) => {
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
      return { method, target, status, text, body, headers: merged };
    };
    const ADMIN = cfg.adminPath, USERS = cfg.users;

    if (path === '/' || path === '/index.html') {
      return res(200, 'OK', html(cfg, 'Welcome', [
        '<h1>' + cfg.brand + '</h1><p>' + cfg.tagline + '</p>',
        '<a href="/login">Sign in</a> · <a href="/guestbook">Guestbook</a>',
        '<!-- TODO(dev): retire ' + ADMIN + ' before launch, the staff dashboard is still reachable -->'
      ].join('\n')));
    }
    if (path === '/robots.txt') {
      return res(200, 'OK', 'User-agent: *\nDisallow: /login\nDisallow: /guestbook\nDisallow: ' + ADMIN + '\n', { 'content-type': 'text/plain' });
    }
    if (path === '/login') {
      const u = query.get('u') || query.get('user') || '';
      const p = query.get('p') || query.get('pass') || '';
      if (/'\s*(?:or|OR)\s+1\s*=\s*1\s*(?:--|#)/.test(u) || /'\s*(?:or|OR)\s+'1'\s*=\s*'1/i.test(u)) {
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
        '<h2>Staff dashboard — ' + cfg.brand + '</h2><p>All users:</p><ul>',
        ...USERS.map(u => '<li>' + u.name + ' — ' + u.email + ' — api_key <code>' + u.api_key + '</code></li>'),
        '</ul><p>Deploy secret: <b style="color:#6ee7a0">' + cfg.flagAdmin + '</b></p>'
      ].join('')));
    }
    if (path === '/profile') {
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
        if (/<script/i.test(msg) && /cookie/i.test(msg)) {
          state.botCookie = state.adminCookie;
          bot = '\n<p style="color:#6ee7a0">An admin bot opened the guestbook and ran your script. It sent you its cookie: <b>' + state.adminCookie + '</b></p>';
        }
        return res(201, 'Created', html(cfg, 'Guestbook', '<h2>Thanks!</h2><p>Says: ' + esc(msg) + '</p>' + bot + '<p>' + state.guestbook.length + ' messages stored (the server does no encoding — the script lives in its HTML, shown escaped here).</p>'));
      }
      return res(200, 'OK', html(cfg, 'Guestbook', '<h2>Guestbook</h2>' + (state.guestbook.length ? state.guestbook.map(m => '<p>' + esc(m) + '</p>').join('') : '<p>No messages yet.</p>') + '<form action="/guestbook" method="post"><input name="msg"></form>'));
    }
    if (path === '/upload') {
      const file = query.get('file') || query.get('filename') || '';
      if (!file) return res(400, 'Bad Request', '{"error":"file is required"}');
      if (!/\.php$/i.test(file)) return res(415, 'Unsupported Media Type', '{"error":"only images are accepted"}');
      const stored = '/uploads/' + file.replace(/[^a-z0-9_.-]/gi, '_');
      state.files[stored] = true;
      return res(201, 'Created', '{"stored":"' + stored + '","note":"php is not supposed to run here"}', { 'content-type': 'application/json' });
    }
    if (/^\/uploads\/[\w.-]+\.php$/.test(path)) {
      if (!state.files[path]) return res(404, 'Not Found', '{"error":"no such upload"}');
      const cmd = query.get('cmd') || '';
      if (!cmd) return res(200, 'OK', 'webshell ready · try ?cmd=id');
      if (/cat\s+\/flag|cat flag/.test(cmd)) return res(200, 'OK', '<pre>root@' + cfg.slug + ':/var/www$ ' + esc(cmd) + '\n' + cfg.flagRoot + '\n</pre>', { 'content-type': 'text/html' });
      return res(200, 'OK', '<pre>root@' + cfg.slug + ':/var/www$ ' + esc(cmd) + '\nwww-data\n</pre>');
    }
    return res(404, 'Not Found', html(cfg, '404', '<h2>404 — not found</h2><p>No route for <code>' + esc(path) + '</code>.</p><p>Start from / , robots.txt, or view the homepage source.</p>'));
  }

  const CHECKS = {
    recon: (s, ev) => ev.some(e => e.target.split('?')[0] === s.cfg.adminPath) && 'You found ' + s.cfg.adminPath + ' — a 403 is a good sign on recon.',
    login: (s) => /session=adm_/.test(s.cookie) && 'The login trusted your input and handed you an admin session.',
    idor: (s, ev) => ev.some(e => /^\/profile\?.*id=1\b/.test(e.target)) && s.adminPanels > 0 && 'IDOR confirmed: you read admin data that was never yours.',
    xss: (s) => !!s.botCookie && s.cookie === s.botCookie && 'Stored XSS fired in the bot’s browser, and the stolen session opens the staff panel.',
    rce: (s, ev) => ev.some(e => /^\/uploads\/[\w.-]+\.php\?cmd=cat\s+\/flag/.test(decodeURIComponent(e.target))) && 'Remote code execution as www-data, then root: the box is fully owned.'
  };

  // A descriptor is one piece of offline content the browser holds. It accepts any entry shape, so every
  // downloaded item becomes a target: a library object {name,title}, a document {label,path}, or a bare
  // string. Each descriptor generates unlimited fresh instances with re-rolled secrets, so it never runs out.
  function descFor(lib, i) {
    const o = typeof lib === 'string' ? { title: lib } : (lib || {});
    const fromPath = o.path ? String(o.path).replace(/[\\/]+$/, '').split(/[\\/]/).pop() : '';
    const title = String(o.title || o.name || o.label || fromPath || ('Offline item ' + ((i || 0) + 1)));
    return { slug: slugify(o.name || title), title, brand: title.length > 30 ? title.slice(0, 29) + '…' : title, demo: !!o.demo };
  }
  const rand = n => Math.floor(Math.random() * n);
  const randHex = len => Array.from({ length: len }, () => '0123456789abcdef'[rand(16)]).join('');

  // One fresh, randomized target instance for a library descriptor.
  function makeInstance(desc) {
    const token = randHex(6);
    const u = slugify(desc.slug) || 'library';
    return {
      slug: desc.slug, title: desc.title, brand: desc.brand, token,
      host: desc.slug + '.offline.example',
      tagline: 'Offline mirror of the ' + desc.brand + ' library.',
      adminPath: '/' + ['staff', 'admin-panel', 'control', 'backoffice', 'ops-console'][rand(5)] + '-' + token.slice(0, 3),
      flagAdmin: 'FLAG{' + u.replace(/-/g, '_') + '_admin_' + token.slice(0, 4) + '}',
      flagRoot: 'FLAG{root_' + u.replace(/-/g, '_') + '_' + randHex(4) + '}',
      users: [
        { id: 1, name: 'admin', email: 'admin@' + desc.slug + '.offline.example', role: 'admin', api_key: 'sk_live_' + token },
        { id: 2, name: 'you', email: 'guest@' + desc.slug + '.offline.example', role: 'user', api_key: 'sk_test_' + randHex(6) }
      ]
    };
  }

  // Shown only when the browser holds no downloaded libraries yet, so the lab is never empty.
  const DEMOS = [
    { name: 'practice-encyclopedia', title: 'Practice Encyclopedia', demo: true },
    { name: 'practice-bookshelf', title: 'Practice Bookshelf', demo: true }
  ];

  function mount(host, opts) {
    opts = opts || {};
    const hasReal = Array.isArray(opts.books) && opts.books.length > 0;
    // Every downloaded item becomes its own target. Slugs are made unique so duplicate or empty names
    // never collide (shared host, shared progress). Capped at 200 to keep the target list responsive.
    const seen = new Set();
    const descriptors = (hasReal ? opts.books : DEMOS).slice(0, 200).map((lib, i) => {
      const d = descFor(lib, i);
      let s = d.slug, n = 1;
      while (seen.has(s)) s = d.slug + '-' + (++n);
      seen.add(s); d.slug = s;
      return d;
    });
    const q = sel => host.querySelector(sel);

    let desc = null, instance = null, state = null, events = [], idx = 0, solved = false;
    let owned = []; // mission ids exploited on the CURRENT fresh instance
    const winKey = d => 'cd_breach_wins_' + d.slug;
    const wins = d => { try { return +ls.get(winKey(d), '0') || 0; } catch (e) { return 0; } };
    const addWin = d => { try { ls.set(winKey(d), String(wins(d) + 1)); } catch (e) { } };

    const banner = '<div style="' + box + ';border-color:var(--acc);background:rgba(110,231,160,.06)">' +
      '<b>🛡️ Training simulation — offline and safe.</b><p class="small" style="margin:4px 0 0;line-height:1.5">' +
      'Every target is a fake server that runs entirely inside this page. No real website, library, server or network is contacted, and nothing leaves your browser. ' +
      'Each target re-rolls fresh secrets every time, so the range never repeats and never runs out. Each solved step ends with the defense that stops it.</p></div>';

    function newInstance() {
      instance = makeInstance(desc);
      state = makeServer(instance);
      events = []; idx = 0; owned = []; solved = false;
    }

    function renderList() {
      const note = hasReal
        ? 'One target per offline library this browser holds. Download more libraries and more targets appear here. Pick one to begin.'
        : 'No libraries downloaded yet, so these are practice targets. Download libraries in the browser and each becomes its own target here.';
      host.innerHTML = '<div class="cd-content" style="display:grid;gap:12px">' +
        '<h2>Breach Lab</h2>' + banner +
        '<p class="small mute" style="margin:0">' + note + '</p>' +
        '<div class="cd-case-grid">' + descriptors.map((d, i) => {
          const w = wins(d);
          return '<button type="button" data-desc="' + i + '"><i aria-hidden="true">🕸️</i><b>' + esc(d.brand) + (d.demo ? ' (practice)' : '') + '</b>' +
            '<small>' + esc(d.slug) + '.offline.example · ' + badge(w ? 'owned ' + w + '×' : 'not owned yet', w ? 'var(--ok)' : 'var(--line)') + '</small></button>';
        }).join('') + '</div>' +
        '<details><summary>What you are learning</summary><p class="small" style="line-height:1.5">Recon (finding hidden routes), SQL injection, broken access control (IDOR), stored cross-site scripting, and insecure file upload leading to remote code execution. These are the OWASP-style basics every web defender needs to understand. The lab shows the attack, then the fix.</p></details>' +
        '</div>';
    }

    function renderTarget() {
      host.innerHTML = '<div class="cd-content" style="display:grid;gap:10px">' +
        '<div class="row" style="gap:8px;align-items:center;flex-wrap:wrap"><button type="button" class="ib" data-act="back">← All targets</button>' +
        '<b style="flex:1">' + esc(instance.brand) + '</b>' + badge('simulation', 'var(--acc)') +
        '<button type="button" class="ib" data-act="fullwalk" title="Show the whole breach, step by step">📋 Full walkthrough</button>' +
        '<button type="button" class="ib" data-act="newchallenge" title="Re-roll this target with brand-new secret paths, keys and flags">🎲 New challenge</button></div>' +
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
        '<button class="ib" data-act="fix">🛡️ Show the defense</button><button class="ib" data-act="next">Next mission →</button>' +
        '<span style="flex:1"></span><span class="small mute" data-owned></span></div>' +
        '</div>';
      drawMission();
      req('/');
    }

    function drawTabs() {
      q('[data-tabs]').innerHTML = MISSIONS.map((m, i) =>
        '<button type="button" class="ib' + (i === idx ? ' on' : '') + '" data-mtab="' + i + '" style="padding:4px 9px" title="' + esc(m.title) + '">' +
        (owned.includes(m.id) ? '✅ ' : '') + m.icon + ' ' + (i + 1) + '</button>').join('') +
        '<span style="flex:1"></span>' + badge(owned.length + '/5 owned', owned.length ? 'var(--ok)' : 'var(--line)');
    }

    function drawMission() {
      drawTabs();
      const m = MISSIONS[idx], done = owned.includes(m.id);
      q('[data-mission]').innerHTML = '<div class="row" style="gap:8px;align-items:center;flex-wrap:wrap">' + badge(m.icon + ' Mission ' + (idx + 1)) +
        (done ? badge('owned', 'var(--ok)') : '') + '<b style="flex:1">' + esc(m.title) + '</b></div>' +
        '<p class="small" style="margin:8px 0 4px">' + esc(m.brief) + '</p>' +
        '<p class="small" style="margin:0"><b>Goal:</b> ' + esc(m.goal) + '</p>' +
        '<p class="small" data-msg style="margin:6px 0 0;color:var(--mute)"></p>' +
        '<div data-walk style="margin-top:8px"></div>';
      q('[data-owned]').textContent = owned.length + ' of 5 vulnerabilities exploited · owned ' + wins(desc) + '× total';
    }

    const stepRow = s => {
      const line = s.cmd
        ? '<button type="button" class="ib" data-run="' + esc(s.cmd) + '" title="Send this exact request" style="display:block;width:100%;text-align:left;' + mono + ';font-size:12px;padding:5px 7px;white-space:pre-wrap;word-break:break-word">▶ ' + esc(s.cmd) + '</button>'
        : '<div style="' + mono + ';font-size:12px;color:var(--acc)">• ' + esc(s.do) + '</div>';
      return '<li style="margin:6px 0">' + line + '<div class="small mute" style="margin-top:3px;line-height:1.4">' + esc(s.why) + '</div></li>';
    };
    function renderWalk(mId) {
      const m = MISSIONS.find(x => x.id === mId), steps = WALK[mId](instance);
      q('[data-walk]').innerHTML = '<div style="' + box + ';background:rgba(110,231,160,.05)"><b class="small">📖 Walkthrough — ' + esc(m.title) + '</b>' +
        '<ol style="margin:6px 0 0;padding-left:18px">' + steps.map(stepRow).join('') + '</ol>' +
        '<p class="small" style="margin:6px 0 0;color:var(--mute)">' + esc(m.defense) + '</p>' +
        '<p class="small mute" style="margin:4px 0 0">Click a ▶ line to send that exact request against this simulated server.</p></div>';
    }
    function renderFullWalk() {
      q('[data-walk]').innerHTML = '<div style="' + box + '"><b class="small">📋 Full engagement walkthrough — ' + esc(instance.brand) + ' (' + esc(instance.host) + ')</b>' +
        MISSIONS.map((m, i) => '<div style="margin-top:8px"><b class="small">' + m.icon + ' ' + (i + 1) + '. ' + esc(m.title) + '</b>' +
          '<ol style="margin:4px 0 0;padding-left:18px">' + WALK[m.id](instance).map(stepRow).join('') + '</ol>' +
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
      const m = MISSIONS[idx];
      if (!m || owned.includes(m.id) || solved) return;
      let result = false;
      try { result = CHECKS[m.id](state, events); } catch (e) { result = false; }
      if (!result) return;
      owned.push(m.id);
      solved = true;
      drawMission();
      const msg = q('[data-msg]');
      if (msg) msg.innerHTML = '✅ <span style="color:var(--ok)">' + esc(typeof result === 'string' ? result : 'Mission complete.') + '</span>' +
        '<br><span style="color:var(--mute)">' + esc(m.defense) + '</span>';
      if (owned.length === MISSIONS.length) {
        addWin(desc);
        q('[data-owned]').textContent = owned.length + ' of 5 vulnerabilities exploited · owned ' + wins(desc) + '× total';
        q('[data-mission]').insertAdjacentHTML('beforeend', '<p style="color:var(--ok);margin:8px 0 0"><b>Target owned (' + wins(desc) + '× total).</b> You chained recon, auth bypass, broken access control, XSS and upload-to-RCE against a simulated mirror of ' + esc(instance.brand) + '. Every step had a real-world fix: parameter binding, ownership checks, output encoding and HttpOnly cookies, and validating upload content outside the web root. Press 🎲 New challenge for a fresh randomized instance — it never runs out.</p>');
      }
      setTimeout(() => { solved = false; }, 0);
    }

    function onClick(e) {
      const b = e.target.closest('button');
      if (!b) return;
      if (b.dataset.desc != null) { desc = descriptors[+b.dataset.desc]; newInstance(); renderTarget(); return; }
      if (b.dataset.mtab != null) { idx = +b.dataset.mtab; drawMission(); return; }
      if (b.dataset.run != null) { q('[data-url]').value = b.dataset.run; req(b.dataset.run); return; }
      const go = () => { const v = q('[data-url]').value.trim(); if (v) req(v); };
      switch (b.dataset.act) {
        case 'back': renderList(); break;
        case 'newchallenge': newInstance(); renderTarget(); break;
        case 'go': go(); break;
        case 'hint': q('[data-msg]').textContent = 'Hint: ' + MISSIONS[idx].hint; break;
        case 'walk': renderWalk(MISSIONS[idx].id); break;
        case 'fullwalk': renderFullWalk(); break;
        case 'fix': q('[data-msg]').textContent = MISSIONS[idx].defense; break;
        case 'next': idx = (idx + 1) % MISSIONS.length; drawMission(); q('[data-url]').value = '/'; break;
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
    return () => { };
  }

  A.cyberBreach = { mount };
})();

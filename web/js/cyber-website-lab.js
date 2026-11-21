// Website Hacker: a fully simulated web app you break into. Every host is on .example and every
// server, cookie, bot and flag lives inside this page. Nothing leaves the browser.
(() => {
  const P = A.play;
  if (!P || !P.games) return;
  const box = 'border:1px solid var(--line);background:var(--panel2);border-radius:10px;padding:10px 12px';
  const mono = 'font-family:Consolas,"Cascadia Mono",monospace';
  const badge = (t, col) => '<span style="display:inline-block;padding:2px 8px;border-radius:999px;font-size:11.5px;border:1px solid ' + (col || 'var(--line)') + ';color:' + (col || 'var(--mute)') + ';background:rgba(255,255,255,.03)">' + t + '</span>';
  const rand = (n, alphabet = '0123456789abcdef') => Array.from({ length: n }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('');
  const FILLERS = ['maya', 'leo', 'priya', 'tom', 'zara', 'noah', 'ines', 'kofi', 'lena', 'omar', 'sara', 'ben', 'yuki', 'ivan', 'nia', 'tariq', 'ravi', 'emma'];

  /* ---------------- the fake web server ---------------- */
  // Every reset builds a new target: a new host, a new hidden staff route, new user ids and secrets, a new flag.
  function makeServer(site = 1) {
    const host = 'shopflix' + (site > 1 ? String(site) : '') + '.example';
    const users = [
      { id: 1, name: 'admin', email: 'admin@' + host, role: 'admin', api_key: 'sk_live_' + rand(10) },
      { id: 2, name: 'you', email: 'guest@' + host, role: 'user', api_key: 'sk_test_' + rand(10) }
    ];
    let id = 10;
    for (const name of FILLERS) {
      id += 1 + Math.floor(Math.random() * 5);
      users.push({ id, name, email: name + '@' + host, role: 'user', api_key: 'sk_live_' + rand(10) });
    }
    return {
      site, host, users,
      adminPath: '/admin-' + rand(6),
      flag: 'FLAG{' + rand(12) + '}',
      adminCookie: 'session=adm_' + rand(8),
      cookie: 'session=guest',
      botCookie: null,
      guestbook: [],
      files: {},
      adminPanels: 0
    };
  }

  const esc = text => String(text ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  function html(title, body, extra) {
    return '<!doctype html>\n<html><head><title>' + title + ' · shopflix</title>' + (extra || '') + '</head>\n' +
      '<body>\n' + body + '\n</body></html>';
  }

  function handle(state, raw) {
    const line = String(raw || '').trim();
    const method = /^post\s/i.test(line) ? 'POST' : 'GET';
    const target = line.replace(/^(?:get|post)\s+/i, '').split('#')[0] || '/';
    const at = target.indexOf('?');
    const path = at < 0 ? target : target.slice(0, at);
    const query = new URLSearchParams(at < 0 ? '' : target.slice(at + 1));
    const adminPath = state.adminPath;
    const authed = /session=adm_/.test(state.cookie);
    const res = (status, text, body, headers) => ({ method, target, status, text, body, headers: headers || {} });

    if (path === '/' || path === '/index.html') {
      return res(200, 'OK', html('Welcome', [
        '<h1>Shopflix</h1><p>Stream everything. Own nothing.</p>',
        '<a href="/login">Sign in</a> · <a href="/guestbook">Guestbook</a>',
        '<!-- TODO(dev): remember to retire ' + adminPath + ' before launch, the staff dashboard is still reachable -->'
      ].join('\n')));
    }
    if (path === '/robots.txt') {
      return res(200, 'OK', 'User-agent: *\nDisallow: /login\nDisallow: /guestbook\nDisallow: ' + adminPath + '\n', { 'content-type': 'text/plain' });
    }
    if (path === '/login') {
      const u = query.get('u') || query.get('user') || '';
      const p = query.get('p') || query.get('pass') || '';
      if (/'\s*(?:or|OR)\s+1\s*=\s*1\s*(?:--|#)/.test(u) || /'\s*(?:or|OR)\s+'1'\s*=\s*'1/i.test(u)) {
        state.cookie = state.adminCookie;
        return res(302, 'Found', '<p>Signed in as <b>admin</b>. Redirecting to /account…</p>', { location: '/account', 'set-cookie': state.adminCookie });
      }
      if (!u || !p) return res(400, 'Bad Request', html('Sign in', '<h2>Sign in</h2><p>Both u and p are required.</p><p class="small">Hint: the query is a plain SQL string: SELECT * FROM users WHERE name = \'' + esc(u || 'u') + '\' AND pass = \'' + esc(p || 'p') + '\'</p>'));
      return res(401, 'Unauthorized', html('Sign in', '<h2>Sign in</h2><p>Invalid credentials for ' + esc(u) + '.</p>'));
    }
    if (path === '/logout') {
      state.cookie = 'session=guest';
      return res(302, 'Found', '<p>Signed out.</p>', { location: '/', 'set-cookie': state.cookie });
    }
    if (path === '/account') {
      if (!authed) return res(302, 'Found', '<p>Please sign in.</p>', { location: '/login' });
      return res(200, 'OK', html('Account', '<h2>Staff account</h2><p>Welcome, admin. Panel: <code>' + adminPath + '</code></p>'));
    }
    if (path === adminPath) {
      if (!authed) {
        return res(403, 'Forbidden', html('Staff only', '<h2>403 — staff only</h2><p>Your cookie: <code>' + esc(state.cookie) + '</code></p><p class="small">The server trusts the session cookie. Get an admin one.</p>'));
      }
      state.adminPanels++;
      return res(200, 'OK', html('Staff dashboard', [
        '<h2>Staff dashboard</h2><p>All users:</p><ul>',
        ...state.users.map(u => '<li>' + esc(u.name) + ' — ' + esc(u.email) + ' — api_key <code>' + esc(u.api_key) + '</code></li>'),
        '</ul><p>Deploy secret: <b style="color:#6ee7a0">' + esc(state.flag) + '</b></p>',
        '<p class="small">You control the site now. Everything below is yours.</p>'
      ].join('')));
    }
    if (path === '/profile') {
      const id = query.get('id');
      if (!id) return res(400, 'Bad Request', '{"error":"id is required"}', { 'content-type': 'application/json' });
      const user = state.users.find(u => String(u.id) === id);
      if (!user) return res(404, 'Not Found', '{"error":"no such user"}', { 'content-type': 'application/json' });
      return res(200, 'OK', JSON.stringify(user, null, 2), { 'content-type': 'application/json; charset=utf-8' });
    }
    if (path === '/users') {
      return res(200, 'OK', JSON.stringify(state.users.map(u => ({ id: u.id, name: u.name, email: u.email })), null, 2), { 'content-type': 'application/json; charset=utf-8' });
    }
    if (path === '/search') {
      const q = query.get('q') || '';
      const reflected = String(q);
      return res(200, 'OK', html('Search', '<h2>Results for</h2><div id="q">' + esc(reflected) + '</div><p class="small">4 results.</p>' + (/<script/i.test(reflected) ? '<p style="color:#6ee7a0">The stored response contains your script unescaped. A browser would run it — shown escaped here so this page stays safe.</p>' : '')));
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
        return res(201, 'Created', html('Guestbook', '<h2>Thanks!</h2><p>Says: ' + esc(msg) + '</p>' + bot + '<p class="small">' + state.guestbook.length + ' messages stored (the server requires no encoding — the script lives in its HTML, shown escaped here).</p>'));
      }
      return res(200, 'OK', html('Guestbook', '<h2>Guestbook</h2>' + (state.guestbook.length ? state.guestbook.map(m => '<p>' + esc(m) + '</p>').join('') : '<p class="small">No messages yet.</p>') + '<form action="/guestbook" method="post"><input name="msg"></form>'));
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
      if (/cat\s+\/flag|cat flag/.test(cmd)) {
        return res(200, 'OK', '<pre>root@' + esc(state.host.split('.')[0]) + ':/var/www$ ' + esc(cmd) + '\n' + esc(state.flag) + '\n</pre>', { 'content-type': 'text/html' });
      }
      return res(200, 'OK', '<pre>root@' + esc(state.host.split('.')[0]) + ':/var/www$ ' + esc(cmd) + '\nwww-data\n</pre>');
    }
    return res(404, 'Not Found', html('404', '<h2>404 — not found</h2><p>No route for <code>' + esc(path) + '</code>.</p><p class="small">Start from / , robots.txt, or view the homepage source.</p>'));
  }

  /* ---------------- missions ---------------- */
  // The five core missions teach one bug each. After them the game keeps generating randomized contracts
  // against the same target for as long as you want to keep playing.
  const CORE = [
    {
      id: 'recon', icon: '🔎', title: 'Recon: find the staff panel',
      brief: s => 'A ' + s.host + ' staff dashboard is deployed but unlinked. Find its route before you touch the login.',
      goal: 'Read robots.txt or the homepage source, then request the hidden staff route.',
      hint: 'robots.txt usually disallows exactly what the owner wants hidden. The homepage also carries a developer comment.',
      check: (s, ev) => ev.some(e => e.target.split('?')[0] === s.adminPath) && 'You found ' + s.adminPath + ' — a 403 is a good sign on recon.'
    },
    {
      id: 'login', icon: '🔑', title: 'Authentication: bypass the login',
      brief: () => 'The sign-in query is built by gluing your values into SQL. No parameter binding, no escaping.',
      goal: 'Send /login?u=…&p=… with a payload that logs you in as admin. Watch the cookie change.',
      hint: 'Try u=\' OR 1=1-- with any password. The rest of the query becomes a comment.',
      check: s => /session=adm_/.test(s.cookie) && 'The login trusted your input and handed you an admin session.'
    },
    {
      id: 'idor', icon: '🪪', title: 'Broken access control: read another user',
      brief: () => '/profile?id= returns whatever id you ask for. There is no ownership check.',
      goal: s => 'Request the admin profile (/profile?id=' + s.users[0].id + ') and read the leaked api_key. Then open the staff panel with that session.',
      hint: s => '/profile?id=' + s.users[0].id + ' is the admin, /profile?id=' + s.users[1].id + ' is you.',
      check: (s, ev) => ev.some(e => new RegExp('^\\/profile\\?.*id=' + s.users[0].id + '\\b').test(e.target)) && s.adminPanels > 0 && 'IDOR confirmed: you read admin data that was never yours.'
    },
    {
      id: 'xss', icon: '🧪', title: 'Stored XSS: steal the admin cookie',
      brief: () => 'The guestbook renders messages as raw HTML and an admin bot reads it after every post.',
      goal: 'Post a script that sends document.cookie, then use the stolen session.',
      hint: 'POST /guestbook?msg=<script>fetch("/x?"+document.cookie)</script>  — it must contain <script and the word cookie.',
      check: s => !!s.botCookie && s.cookie === s.botCookie && 'Stored XSS fired in the bot’s browser, and the stolen session opens the staff panel.'
    },
    {
      id: 'rce', icon: '💀', title: 'File upload: take the server',
      brief: () => 'The upload endpoint only checks the extension by name and the web server happily runs .php.',
      goal: 'Upload shell.php, then request it with ?cmd=cat /flag and read the flag.',
      hint: 'POST /upload?file=shell.php  then  GET /uploads/shell.php?cmd=cat /flag',
      check: (s, ev) => ev.some(e => /^\/uploads\/[\w.-]+\.php\?cmd=cat\s+\/flag/.test(decodeURIComponent(e.target))) && 'Remote code execution as www-data, then root: the box is fully owned.'
    }
  ];

  // One endless contract. Every one carries a fresh token, so it can only be finished by a new request.
  function contract(s, n) {
    const token = 'k' + n + rand(5);
    const kind = n % 5;
    if (kind === 0) {
      const user = s.users[2 + ((n * 3) % (s.users.length - 2))];
      return {
        id: 'enum-' + n, icon: '🪪', title: 'Contract ' + n + ': enumerate ' + user.name,
        brief: () => user.email + ' is a real account on this target and nobody checked the ownership of /profile.',
        goal: () => 'Read that account: GET /profile?id=' + user.id + '. The api_key in the response is the proof.',
        hint: () => 'You do not need their password. /users lists every id, /profile?id=' + user.id + ' hands over the record.',
        check: (st, ev) => ev.some(e => new RegExp('^\\/profile\\?.*id=' + user.id + '\\b').test(e.target)) &&
          user.email + ' read without a single credential — broken access control again.'
      };
    }
    if (kind === 1) {
      return {
        id: 'enum-' + n, icon: '🔎', title: 'Contract ' + n + ': beat the hidden route',
        brief: s => 'The staff dashboard of ' + s.host + ' refuses anonymous requests, which is exactly what you want to confirm.',
        goal: () => 'Sign out (GET /logout), then request the staff route without a session and collect the 403.',
        hint: s => 'It is the path robots.txt hides: ' + s.adminPath + '. Sign out first with GET /logout — an admin session gets 200 instead of 403.',
        check: (st, ev) => ev.some(e => e.target.split('?')[0] === st.adminPath && e.status === 403) &&
          '403 on ' + st.adminPath + ' — the route exists, and it is only protected by a cookie.'
      };
    }
    if (kind === 2) {
      return {
        id: 'reflect-' + n, icon: '🔁', title: 'Contract ' + n + ': reflected input ' + token,
        brief: () => 'The search page prints your query straight into the HTML.',
        goal: () => 'Send /search?q=' + token + ' and find your own text echoed back unescaped.',
        hint: () => 'GET /search?q=' + token + ' — then try adding <script> and watch it survive.',
        check: (st, ev) => ev.some(e => decodeURIComponent(e.target).includes(token)) &&
          'The query came back from the server unchanged. That is reflection you can build an XSS on.'
      };
    }
    if (kind === 3) {
      return {
        id: 'guest-' + n, icon: '📝', title: 'Contract ' + n + ': plant a message with ' + token,
        brief: () => 'Every guestbook entry is stored and shown to the admin bot verbatim.',
        goal: () => 'POST a guestbook message containing ' + token + '.',
        hint: () => 'POST /guestbook?msg=' + token,
        check: (st, ev) => ev.some(e => e.method === 'POST' && decodeURIComponent(e.target).includes(token)) &&
          'Stored on the target with no sanitising — the payload every stored XSS starts as.'
      };
    }
    const name = 'probe' + token;
    return {
      id: 'up-' + n, icon: '📤', title: 'Contract ' + n + ': upload ' + name + '.php',
      brief: () => 'The upload endpoint checks the filename extension and nothing else.',
      goal: () => 'Upload ' + name + '.php and then run ?cmd=cat /flag on it.',
      hint: () => 'POST /upload?file=' + name + '.php  then  GET /uploads/' + name + '.php?cmd=cat /flag',
      check: (st, ev) => Object.hasOwn(st.files, '/uploads/' + name + '.php') &&
        ev.some(e => decodeURIComponent(e.target).includes('/uploads/' + name + '.php') && /cmd=cat\s+\/flag/.test(decodeURIComponent(e.target))) &&
        'Your file runs on the server. Loose extensions are a full compromise.'
    };
  }

  const text = (value, s) => typeof value === 'function' ? value(s) : value;

  function mount(el, api) {
    const saved = (() => {
      try {
        const value = JSON.parse(ls.get('weblab_progress', 'null'));
        if (value && typeof value === 'object' && Array.isArray(value.owned)) return value;
        /* progress from the five-mission version keeps its ticks on the first target */
        const legacy = JSON.parse(ls.get('weblab_owned', '[]'));
        if (Array.isArray(legacy) && legacy.length) return { site: 1, owned: legacy.filter(id => CORE.some(m => m.id === id)) };
      } catch (e) { }
      return null;
    })();
    const state = makeServer(saved?.site || 1);
    const events = [];
    let owned = saved ? saved.owned.slice() : [];
    let missions = CORE.map(m => ({ ...m, core: true }));
    let idx = 0;

    el.innerHTML = '<div style="width:min(780px,100%);display:grid;gap:10px">' +
      '<div class="row" style="gap:6px;flex-wrap:wrap;align-items:center" id="wltabs"></div>' +
      '<div style="' + box + '">' +
        '<div class="row" style="gap:6px;align-items:center;flex-wrap:wrap">' +
          '<span class="small mute" id="wlhost">🔒 https://' + esc(state.host) + '</span>' +
          '<input id="wlurl" class="ib" style="flex:1;min-width:200px;' + mono + ';padding:6px 8px" value="/" spellcheck="false" autocomplete="off">' +
          '<button class="pri" id="wlgo">Send</button>' +
          '<button class="ib" id="wlsteal" title="Switch your session to the cookie the admin bot leaked">🍪 Use stolen cookie</button>' +
          '<button class="ib" id="wlreset" title="Start a fresh target with new secrets">New site</button>' +
        '</div>' +
        '<div class="small mute" id="wlcookie" style="margin-top:6px"></div>' +
        '<pre id="wlres" style="margin:8px 0 0;padding:10px;border-radius:8px;background:#0b0f14;border:1px solid var(--line);max-height:280px;overflow:auto;white-space:pre-wrap;word-break:break-word;' + mono + ';font-size:12.5px;color:#cfe9d6"></pre>' +
      '</div>' +
      '<div style="' + box + '" id="wlmission"></div>' +
      '<div class="row" style="gap:6px;flex-wrap:wrap;align-items:center">' +
        '<span class="small mute">Owned</span><span id="wlowned"></span>' +
        '<span class="sp"></span><button class="ib" id="wlhint">💡 Hint</button><button class="ib" id="wlskip">Next mission →</button>' +
      '</div>' +
    '</div>';

    const save = () => { try { ls.set('weblab_progress', JSON.stringify({ site: state.site, owned })); } catch (e) { } };
    const req = url => {
      const response = handle(state, url);
      events.push(response);
      const header = 'HTTP/1.1 ' + response.status + ' ' + response.text + '\n' + Object.entries(response.headers).map(([k, v]) => k + ': ' + v).join('\n') + (Object.keys(response.headers).length ? '\n' : '') + '\n';
      $('wlres').textContent = header + response.body;
      $('wlres').style.color = response.status >= 400 ? '#ffb3b3' : '#cfe9d6';
      $('wlcookie').textContent = 'Your cookies: ' + state.cookie + (state.botCookie ? '   ·   stolen admin cookie: ' + state.botCookie : '');
      check();
    };

    // Keep one mission waiting beyond the current one, forever: once the core five are done the contracts never stop.
    const grow = () => {
      while (missions.length < CORE.length + 1) missions.push(contract(state, missions.length - CORE.length + 1));
    };

    const tabs = () => {
      const shown = missions.slice(0, CORE.length);
      const extra = idx >= CORE.length ? missions[idx] : null;
      $('wltabs').innerHTML = shown.map((m, i) => {
        const done = owned.includes(m.id);
        return '<button class="ib' + (i === idx ? ' on' : '') + '" data-wm="' + i + '" style="padding:4px 9px" title="' + esc(text(m.title, state)) + '">' +
          (done ? '✅ ' : '') + m.icon + ' ' + (i + 1) + '</button>';
      }).join('') + (extra ? '<button class="ib on" data-wm="' + idx + '" style="padding:4px 9px">' + extra.icon + ' ∞</button>' : '') +
        '<span class="sp"></span>' + badge('website ' + state.site + ' · ' + owned.length + ' owned', owned.length ? 'var(--ok)' : 'var(--line)');
    };

    const draw = () => {
      grow();
      tabs();
      const m = missions[idx];
      const done = owned.includes(m.id);
      $('wlmission').innerHTML = '<div class="row" style="gap:8px;align-items:center;flex-wrap:wrap">' + badge(m.icon + (m.core ? ' Mission ' + (idx + 1) : ' Contract ' + (idx - CORE.length + 1))) +
        (done ? badge('owned', 'var(--ok)') : '') + '<b style="flex:1">' + esc(text(m.title, state)) + '</b></div>' +
        '<p class="small" style="margin:8px 0 4px">' + esc(text(m.brief, state)) + '</p>' +
        '<p class="small" style="margin:0"><b>Goal:</b> ' + esc(text(m.goal, state)) + '</p>' +
        '<p class="small" id="wlmsg" style="margin:6px 0 0;color:var(--mute)"></p>';
      $('wlhint').onclick = () => { $('wlmsg').textContent = 'Hint: ' + text(m.hint, state); };
      $('wlskip').onclick = () => {
        if (idx + 1 >= missions.length) missions.push(contract(state, missions.length - CORE.length + 1));
        idx = (idx + 1) % missions.length;
        draw();
      };
      $('wlowned').innerHTML = missions.slice(0, CORE.length).map(x => owned.includes(x.id) ? badge(x.icon, 'var(--ok)') : badge('·')).join(' ') +
        (owned.filter(id => !CORE.some(c => c.id === id)).length ? ' ' + badge('∞ ' + owned.filter(id => !CORE.some(c => c.id === id)).length, 'var(--ok)') : '');
      api.hud('website ' + state.site + ' · ' + owned.length + ' owned · ' + events.length + ' requests');
    };

    const check = () => {
      const m = missions[idx];
      if (!m || owned.includes(m.id)) return;
      let result = false;
      try { result = m.check(state, events); } catch (e) { result = false; }
      if (!result) return;
      owned.push(m.id);
      save();
      api.submit(owned.length * 100);
      grow();
      draw();
      const msg = $('wlmsg');
      if (msg) msg.innerHTML = '✅ <span style="color:var(--ok)">' + esc(typeof result === 'string' ? result : 'Mission complete.') + '</span>';
      if (CORE.every(c => owned.includes(c.id))) {
        $('wlmission').insertAdjacentHTML('beforeend', '<p style="color:var(--ok);margin:8px 0 0"><b>Site owned.</b> The core five are chained: recon, auth bypass, broken access control, XSS and upload-to-RCE. Press <b>Next mission →</b> for endless randomized contracts on this target, or <b>New site</b> for a fresh host with new secrets. Every step here has a real-world twin — the defenses are input binding, ownership checks, output encoding, and never trusting file extensions.</p>');
      }
    };

    const go = () => { const v = $('wlurl').value.trim(); if (v) { req(v); saveUrl(v); } };
    let lastUrls = {};
    const saveUrl = v => { lastUrls[idx] = v; };
    $('wlsteal').onclick = () => {
      if (!state.botCookie) { $('wlmsg').textContent = 'No stolen cookie yet. Post a script to the guestbook and wait for the admin bot to read it.'; return; }
      state.cookie = state.botCookie;
      $('wlcookie').textContent = 'Your cookies: ' + state.cookie + '   ·   stolen admin cookie: ' + state.botCookie;
      req(state.adminPath + '?via=stolen-cookie');
    };
    $('wlgo').onclick = go;
    $('wlurl').onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); go(); } };
    $('wlreset').onclick = () => {
      // A real reset: new host, new secrets, new flag, empty uploads and guestbook, and the mission list starts over
      // so the same target can be played again instead of being stuck on a finished checklist.
      Object.assign(state, makeServer(state.site + 1));
      events.length = 0;
      owned = [];
      missions = CORE.map(m => ({ ...m, core: true }));
      idx = 0;
      lastUrls = {};
      save();
      $('wlhost').textContent = '🔒 https://' + state.host;
      $('wlurl').value = '/';
      $('wlres').textContent = '(new target — https://' + state.host + ' is live: cookies cleared, uploads and guestbook emptied, missions restarted)';
      $('wlres').style.color = '#cfe9d6';
      $('wlcookie').textContent = 'Your cookies: ' + state.cookie;
      draw();
    };
    $('wltabs').onclick = e => {
      const b = e.target.closest('[data-wm]');
      if (!b) return;
      idx = +b.dataset.wm;
      draw();
      $('wlurl').value = lastUrls[idx] || '/';
      $('wlmsg') && ($('wlmsg').textContent = '');
    };

    req('/');
    draw();
    return () => { };
  }

  P.games.weblab = {
    name: 'Website Hacker',
    icon: '🕸️',
    cat: 'cyber',
    desc: 'Break into a simulated web app: read robots.txt, bypass the login with SQL injection, abuse an IDOR, steal an admin cookie with stored XSS, then turn a file upload into remote code execution. Five core missions plus endless randomized contracts, and every New site is a fresh target with new secrets.',
    mount
  };
})();

// Website Hacker: a fully simulated web app you break into. Every host is on .example and every
// server, cookie, bot and flag lives inside this page. Nothing leaves the browser.
(() => {
  const P = A.play;
  if (!P || !P.games) return;
  const box = 'border:1px solid var(--line);background:var(--panel2);border-radius:10px;padding:10px 12px';
  const mono = 'font-family:Consolas,"Cascadia Mono",monospace';
  const badge = (t, col) => '<span style="display:inline-block;padding:2px 8px;border-radius:999px;font-size:11.5px;border:1px solid ' + (col || 'var(--line)') + ';color:' + (col || 'var(--mute)') + ';background:rgba(255,255,255,.03)">' + t + '</span>';

  /* ---------------- the fake web server ---------------- */
  function makeServer() {
    return {
      cookie: 'session=guest',
      adminCookie: 'session=adm_9f2b71',
      botCookie: null,
      guestbook: [],
      files: {},
      adminPanels: 0
    };
  }

  const ADMIN_PATH = '/admin-panel-7f3';
  const USERS = [
    { id: 1, name: 'admin', email: 'admin@shopflix.example', role: 'admin', api_key: 'sk_live_7f3c9a4d' },
    { id: 2, name: 'you', email: 'guest@shopflix.example', role: 'user', api_key: 'sk_test_0a1b2c9e' }
  ];

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
    const authed = /session=adm_/.test(state.cookie);
    const res = (status, text, body, headers) => ({ method, target, status, text, body, headers: headers || {} });

    if (path === '/' || path === '/index.html') {
      return res(200, 'OK', html('Welcome', [
        '<h1>Shopflix</h1><p>Stream everything. Own nothing.</p>',
        '<a href="/login">Sign in</a> · <a href="/guestbook">Guestbook</a>',
        '<!-- TODO(dev): remember to retire ' + ADMIN_PATH + ' before launch, the staff dashboard is still reachable -->'
      ].join('\n')));
    }
    if (path === '/robots.txt') {
      return res(200, 'OK', 'User-agent: *\nDisallow: /login\nDisallow: /guestbook\nDisallow: ' + ADMIN_PATH + '\n', { 'content-type': 'text/plain' });
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
    if (path === '/account') {
      if (!authed) return res(302, 'Found', '<p>Please sign in.</p>', { location: '/login' });
      return res(200, 'OK', html('Account', '<h2>Staff account</h2><p>Welcome, admin. Panel: <code>' + ADMIN_PATH + '</code></p>'));
    }
    if (path === ADMIN_PATH) {
      if (!authed) {
        return res(403, 'Forbidden', html('Staff only', '<h2>403 — staff only</h2><p>Your cookie: <code>' + esc(state.cookie) + '</code></p><p class="small">The server trusts the session cookie. Get an admin one.</p>'));
      }
      state.adminPanels++;
      return res(200, 'OK', html('Staff dashboard', [
        '<h2>Staff dashboard</h2><p>All users:</p><ul>',
        ...USERS.map(u => '<li>' + u.name + ' — ' + u.email + ' — api_key <code>' + u.api_key + '</code></li>'),
        '</ul><p>Deploy secret: <b style="color:#6ee7a0">FLAG{admin_panel_pwned}</b></p>',
        '<p class="small">You control the site now. Everything below is yours.</p>'
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
        return res(200, 'OK', '<pre>root@shopflix:/var/www$ ' + esc(cmd) + '\nFLAG{root_on_shopflix}\n</pre>', { 'content-type': 'text/html' });
      }
      return res(200, 'OK', '<pre>root@shopflix:/var/www$ ' + esc(cmd) + '\nwww-data\n</pre>');
    }
    return res(404, 'Not Found', html('404', '<h2>404 — not found</h2><p>No route for <code>' + esc(path) + '</code>.</p><p class="small">Start from / , robots.txt, or view the homepage source.</p>'));
  }

  /* ---------------- missions ---------------- */
  const MISSIONS = [
    {
      id: 'recon', icon: '🔎', title: 'Recon: find the staff panel',
      brief: 'A shopflix staff dashboard is deployed but unlinked. Find its route before you touch the login.',
      goal: 'Read robots.txt or the homepage source, then request the hidden staff route.',
      hint: 'robots.txt usually disallows exactly what the owner wants hidden. The homepage also carries a developer comment.',
      check: (s, ev) => ev.some(e => e.target.split('?')[0] === ADMIN_PATH) && 'You found ' + ADMIN_PATH + ' — a 403 is a good sign on recon.'
    },
    {
      id: 'login', icon: '🔑', title: 'Authentication: bypass the login',
      brief: 'The sign-in query is built by gluing your values into SQL. No parameter binding, no escaping.',
      goal: 'Send /login?u=…&p=… with a payload that logs you in as admin. Watch the cookie change.',
      hint: 'Try u=\' OR 1=1-- with any password. The rest of the query becomes a comment.',
      check: (s, ev) => /session=adm_/.test(s.cookie) && 'The login trusted your input and handed you an admin session.'
    },
    {
      id: 'idor', icon: '🪪', title: 'Broken access control: read another user',
      brief: '/profile?id= returns whatever id you ask for. There is no ownership check.',
      goal: 'Request the admin profile and read the leaked api_key. Then open the staff panel with that session.',
      hint: '/profile?id=1 is the admin, /profile?id=2 is you.',
      check: (s, ev) => ev.some(e => /^\/profile\?.*id=1\b/.test(e.target)) && s.adminPanels > 0 && 'IDOR confirmed: you read admin data that was never yours.'
    },
    {
      id: 'xss', icon: '🧪', title: 'Stored XSS: steal the admin cookie',
      brief: 'The guestbook renders messages as raw HTML and an admin bot reads it after every post.',
      goal: 'Post a script that sends document.cookie, then use the stolen session.',
      hint: 'POST /guestbook?msg=<script>fetch("/x?"+document.cookie)</script>  — it must contain <script and the word cookie.',
      check: (s) => !!s.botCookie && s.cookie === s.botCookie && 'Stored XSS fired in the bot’s browser, and the stolen session opens the staff panel.'
    },
    {
      id: 'rce', icon: '💀', title: 'File upload: take the server',
      brief: 'The upload endpoint only checks the extension by name and the web server happily runs .php.',
      goal: 'Upload shell.php, then request it with ?cmd=cat /flag and read the flag.',
      hint: 'POST /upload?file=shell.php  then  GET /uploads/shell.php?cmd=cat /flag',
      check: (s, ev) => ev.some(e => /^\/uploads\/[\w.-]+\.php\?cmd=cat\s+\/flag/.test(decodeURIComponent(e.target))) && 'Remote code execution as www-data, then root: the box is fully owned.'
    }
  ];

  function mount(el, api) {
    const state = makeServer();
    const events = [];
    let owned = [];
    try { owned = JSON.parse(ls.get('weblab_owned', '[]')) || []; } catch (e) { owned = []; }
    let idx = 0, solved = false;

    el.innerHTML = '<div style="width:min(780px,100%);display:grid;gap:10px">' +
      '<div class="row" style="gap:6px;flex-wrap:wrap;align-items:center" id="wltabs"></div>' +
      '<div style="' + box + '">' +
        '<div class="row" style="gap:6px;align-items:center;flex-wrap:wrap">' +
          '<span class="small mute">🔒 https://shopflix.example</span>' +
          '<input id="wlurl" class="ib" style="flex:1;min-width:200px;' + mono + ';padding:6px 8px" value="/" spellcheck="false" autocomplete="off">' +
          '<button class="pri" id="wlgo">Send</button>' +
          '<button class="ib" id="wlsteal" title="Switch your session to the cookie the admin bot leaked">🍪 Use stolen cookie</button>' +
          '<button class="ib" id="wlreset" title="Forget cookies and stored data">Reset server</button>' +
        '</div>' +
        '<div class="small mute" id="wlcookie" style="margin-top:6px"></div>' +
        '<pre id="wlres" style="margin:8px 0 0;padding:10px;border-radius:8px;background:#0b0f14;border:1px solid var(--line);max-height:280px;overflow:auto;white-space:pre-wrap;word-break:break-word;' + mono + ';font-size:12.5px;color:#cfe9d6"></pre>' +
      '</div>' +
      '<div style="' + box + '" id="wlmission"></div>' +
      '<div class="row" style="gap:6px;flex-wrap:wrap;align-items:center">' +
        '<span class="small mute">Sites owned</span><span id="wlowned"></span>' +
        '<span class="sp"></span><button class="ib" id="wlhint">💡 Hint</button><button class="ib" id="wlskip">Next mission →</button>' +
      '</div>' +
    '</div>';

    const save = () => { try { ls.set('weblab_owned', JSON.stringify(owned)); } catch (e) { } };
    const req = url => {
      const response = handle(state, url);
      events.push(response);
      const header = 'HTTP/1.1 ' + response.status + ' ' + response.text + '\n' + Object.entries(response.headers).map(([k, v]) => k + ': ' + v).join('\n') + (Object.keys(response.headers).length ? '\n' : '') + '\n';
      $('wlres').textContent = header + response.body;
      $('wlres').style.color = response.status >= 400 ? '#ffb3b3' : '#cfe9d6';
      $('wlcookie').textContent = 'Your cookies: ' + state.cookie + (state.botCookie ? '   ·   stolen admin cookie: ' + state.botCookie : '');
      check();
    };

    const tabs = () => {
      $('wltabs').innerHTML = MISSIONS.map((m, i) => {
        const done = owned.includes(m.id);
        return '<button class="ib' + (i === idx ? ' on' : '') + '" data-wm="' + i + '" style="padding:4px 9px" title="' + esc(m.title) + '">' +
          (done ? '✅ ' : '') + m.icon + ' ' + (i + 1) + '</button>';
      }).join('') + '<span class="sp"></span>' + badge(owned.length + '/' + MISSIONS.length + ' owned', owned.length ? 'var(--ok)' : 'var(--line)');
    };

    const draw = () => {
      tabs();
      const m = MISSIONS[idx];
      const done = owned.includes(m.id);
      $('wlmission').innerHTML = '<div class="row" style="gap:8px;align-items:center;flex-wrap:wrap">' + badge(m.icon + ' Mission ' + (idx + 1)) +
        (done ? badge('owned', 'var(--ok)') : '') + '<b style="flex:1">' + esc(m.title) + '</b></div>' +
        '<p class="small" style="margin:8px 0 4px">' + esc(m.brief) + '</p>' +
        '<p class="small" style="margin:0"><b>Goal:</b> ' + esc(m.goal) + '</p>' +
        '<p class="small" id="wlmsg" style="margin:6px 0 0;color:var(--mute)"></p>';
      $('wlhint').onclick = () => { $('wlmsg').textContent = 'Hint: ' + m.hint; };
      $('wlskip').onclick = () => { idx = (idx + 1) % MISSIONS.length; draw(); };
      $('wlowned').innerHTML = MISSIONS.map(x => owned.includes(x.id) ? badge(x.icon, 'var(--ok)') : badge('·')).join(' ');
      api.hud(owned.length + '/' + MISSIONS.length + ' sites · ' + events.length + ' requests');
    };

    const check = () => {
      const m = MISSIONS[idx];
      if (!m || owned.includes(m.id) || solved) return;
      let result = false;
      try { result = m.check(state, events); } catch (e) { result = false; }
      if (!result) return;
      owned.push(m.id);
      solved = true;
      save();
      api.submit(owned.length * 100);
      draw();
      const msg = $('wlmsg');
      if (msg) msg.innerHTML = '✅ <span style="color:var(--ok)">' + esc(typeof result === 'string' ? result : 'Mission complete.') + '</span>';
      if (owned.length === MISSIONS.length) {
        api.submit(1000);
        $('wlmission').insertAdjacentHTML('beforeend', '<p style="color:var(--ok);margin:8px 0 0"><b>Site owned.</b> You chained recon, auth bypass, broken access control, XSS and upload-to-RCE against a fake target. Every step here has a real-world twin — the defenses are input binding, ownership checks, output encoding, and never trusting file extensions.</p>');
      }
      setTimeout(() => { solved = false; }, 0);
    };

    const go = () => { const v = $('wlurl').value.trim(); if (v) { req(v); saveUrl(v); } };
    let lastUrls = {};
    const saveUrl = v => { lastUrls[idx] = v; };
    $('wlsteal').onclick = () => {
      if (!state.botCookie) { $('wlmsg').textContent = 'No stolen cookie yet. Post a script to the guestbook and wait for the admin bot to read it.'; return; }
      state.cookie = state.botCookie;
      $('wlcookie').textContent = 'Your cookies: ' + state.cookie + '   ·   stolen admin cookie: ' + state.botCookie;
      req(ADMIN_PATH + '?via=stolen-cookie');
    };
    $('wlgo').onclick = go;
    $('wlurl').onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); go(); } };
    $('wlreset').onclick = () => {
      const fresh = makeServer();
      Object.assign(state, fresh);
      events.length = 0;
      $('wlres').textContent = '(server reset — cookies cleared, uploads and guestbook emptied)';
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
    desc: 'Break into a simulated web app: read robots.txt, bypass the login with SQL injection, abuse an IDOR, steal an admin cookie with stored XSS, then turn a file upload into remote code execution. Five chained red-team missions.',
    mount
  };
})();

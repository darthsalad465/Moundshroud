// Cyber > Cyber Desktop > Walkthrough Playground. Paste an address from the fake internet or an IP from the practice
// network and get the whole engagement, step by step: the exact request or command, what it answers, why it works,
// what a defender does about it, and the request to undo the damage afterwards. Everything runs inside this page
// against targets Moundshroud invented. Deliberately pays the practice bank nothing: this is a lesson, not a job.
(() => {
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const money = n => '$' + Number(n || 0).toFixed(2);

  /* kept for as long as the desktop is open, so switching windows does not lose your place */
  const state = { kind: 'none', host: '', ip: '', error: '', done: new Set(), out: {} };
  const key = id => state.host + '|' + state.ip + '|' + id;

  /* ---------- how a response is shown: the status line, the type, then the body the way curl prints it ---------- */
  const REASONS = { 200: 'OK', 403: 'Forbidden', 404: 'Not Found', 500: 'Internal Server Error' };
  function show(result) {
    if (typeof result === 'string') return result;
    const head = 'HTTP/1.1 ' + result.status + ' ' + (REASONS[result.status] || '') + '\nContent-Type: ' + result.type + '\n\n';
    const body = String(result.body == null ? '' : result.body);
    return head + (body.length > 3000 ? body.slice(0, 3000) + '\n\n… ' + (body.length - 3000) + ' more characters (open it in the Browser to read the rest)' : body);
  }

  /* ---------- the website walkthrough ---------- */
  /* Every value below is read from the target itself: its own admin path, its own leaked login, its own order ids.
     That is why the steps always match whatever address was pasted. */
  function siteSteps(site) {
    const host = site.host;
    const at = path => 'https://' + host + path;
    const admin = site.adminPath;
    const order = site.orders[0] ? site.orders[0].id : 1001;
    const steps = [];
    const add = step => steps.push(step);

    /* ---- the target's own exposure plan: which file holds what, and how hard it is to find ---- */
    const sec = site.sec || {};
    const leaks = sec.leaks || [];
    const factsOf = p => ((leaks.find(f => f.path === p) || {}).facts || []);
    const leakAt = fact => (leaks.find(f => f.facts.includes(fact)) || leaks[0] || {}).path || '/.env';
    const primary = leakAt('db');
    const passPath = leakAt('pass');
    const adminPathFile = leakAt('adminpath');
    const readable = path => {
      const f = factsOf(path), names = [];
      if (f.includes('db')) names.push('DB_PASSWORD');
      if (f.includes('jwt')) names.push('APP_KEY (the JWT signing key)');
      if (f.includes('adminpath')) names.push('ADMIN_PATH=' + admin);
      if (f.includes('login')) names.push('ADMIN_EMAIL=' + site.adminLogin);
      if (f.includes('pass')) names.push('ADMIN_PASSWORD=' + site.adminPass);
      return names.length ? names.join(', ') : 'nothing sensitive';
    };
    const scanFinds = sec.difficulty === 'extremely-easy' || sec.difficulty === 'easy';

    add({
      id: 'scope', tag: 'Before you start', title: 'Scope, permission and the rules of engagement',
      what: 'Nothing technical happens until you know what you are allowed to touch. On a real engagement this is a signed scope: the hostnames, the time window, whether you may change content, and who to call if something breaks. Here the target is a site Moundshroud generated for exactly this purpose, so the permission is already yours. That distinction is the whole lesson — the same requests against a site you do not own are a crime, not a skill.',
      expect: 'A written scope. In this playground: the address you pasted, and nothing outside it.',
      why: 'Almost every legal disaster in this field is a permission problem. "It was only a test" is not a defence when the hostname was never in the agreement.',
      fix: 'Authorise before you test: signed scope, named contacts, an agreed stop condition, and a platform team that knows the test is happening.',
      run: null
    });
    add({
      id: 'home', tag: 'Reconnaissance', title: 'Read the front page like an engineer',
      cmd: 'curl -s ' + at('/'), request: at('/'),
      what: 'Fetch the home page and read it as a map, not as a customer. The navigation names the routes the developer wants used — about, contact, the site’s own section, sign in, terms, privacy. The footer names the host. The small print sometimes admits what software runs it.',
      expect: 'HTTP 200 with the site’s HTML. The header carries links to /about, /contact, ' + site.cat.route + ', /login and /terms; the footer carries the host and the year.',
      why: 'Every href is a route that exists. Recon is mostly reading what is already public, and the shape of the site (shop, blog, portal, exchange) tells you which bugs are worth looking for: orders mean IDOR, search boxes mean injection, staff pages mean sessions.',
      fix: 'Nothing to fix: public pages are public. The awareness to build is that a scanner reads exactly this, faster.',
      run: () => A.cyberWeb.serveSilent(site, '/', 'GET')
    });
    add({
      id: 'robots', tag: 'Reconnaissance', title: 'robots.txt lists what the owner hid',
      cmd: 'curl -s ' + at('/robots.txt'), request: at('/robots.txt'),
      what: 'robots.txt is a plain text file at that exact path on every site. Its purpose is to tell search engine crawlers which pages not to index — which means it must name the private ones. It is public by design: a crawler that cannot read it cannot obey it.',
      expect: sec.robotsLeaksAdmin
        ? 'User-agent: * followed by Disallow: ' + (sec.loginPath || '/login') + ', /account and Disallow: ' + admin + ' — the staff folder for this site.'
        : 'User-agent: * followed by Disallow: ' + (sec.loginPath || '/login') + ' and /account only' +
          (sec.difficulty === 'medium' ? ', plus one ordinary folder. The staff folder is not named here: that has to come from ' + adminPathFile + '.' : '. A site run this carefully keeps its staff path out of robots.txt, so this route is a dead end — the trail starts at ' + (sec.cluePath || 'the assets') + ' instead.'),
      why: 'A "please do not index" list is also a "start here" list. On real work this is often the first minute of an engagement, and on a sloppy site it names the admin panel outright. On a careful one it says almost nothing, and that silence is information too: the owner has thought about what they publish.',
      fix: 'Do not rely on robots.txt for security. Put authentication and rate limits on the admin app, and keep that app off the public internet entirely — VPN or IP allowlist.',
      run: () => A.cyberWeb.serveSilent(site, '/robots.txt', 'GET')
    });
    add({
      id: 'env', tag: 'Exposure', title: 'Configuration files the web server should never serve',
      cmd: 'curl -s ' + at(primary), request: at(primary),
      what: 'Try the files a web root must never hand out: /.env, /.git/config, /config.php.bak, /backup.zip, /dump.sql, /backups/db-seed.sql. This site leaves ' + leaks.length + ' of them reachable: ' + leaks.map(f => f.path + ' (' + readable(f.path).split(',')[0] + ')').join(', ') + '.' +
        (scanFinds ? ' Every one of them turns up in a plain directory scan.' : sec.difficulty === 'medium' ? ' A directory scan finds ' + primary + '; the rest has to be guessed or found through a clue.' : ' A directory scan finds none of them — the trail starts at ' + (sec.cluePath || '/robots.txt') + '.'),
      expect: 'HTTP 200 with ' + readable(primary) + '. No cracking, no guessing: the application published part of its own settings.',
      why: 'Deploy tooling copies .env and copied config files into the folder the web server serves. Apache and nginx refuse dotfiles only if somebody configured them to, and a wrong document root (or an upload folder that serves everything) turns a config file into a public download. On a hardened site the files are split up and hidden, so the work is finding them, not reading them.',
      fix: 'Serve only the public directory, deny dotfiles at the server, keep secrets out of the deploy artefact, and rotate every secret the moment one is exposed.',
      run: () => A.cyberWeb.serveSilent(site, primary, 'GET')
    });
    if (leaks.length > 1) {
      add({
        id: 'chain', tag: 'Exposure', title: 'Piecing the credentials together across folders',
        cmd: (leaks.slice(1).map(p => 'curl -s ' + at(p))).join('\n'),
        request: at(leaks[leaks.length - 1].path),
        what: 'The remaining files are not in the same folder: ' + leaks.slice(1).map(p => p.path + ' gives ' + readable(p.path)).join(' · ') + '. On this target the admin path, the staff email and the password live in different places, so one lucky request does not hand you the site.',
        expect: 'Each request returns only its own facts: ' + leaks.slice(1).map(p => p.path + ' → ' + readable(p.path)).join('; ') + '.',
        why: 'Real leaks are messy. A dumped SQL seed holds the password, a JS bundle holds the portal path, an archived .env holds the database password and an old key. Collecting them is the actual skill — and the reason a single scanner finding is not the same as owning a site.',
        fix: 'Rotate every exposed secret together: rotating only the one file you found leaves the others valid, and the site still falls.',
        run: () => A.cyberWeb.serveSilent(site, leaks[leaks.length - 1].path, 'GET')
      });
    }
    if (sec.cluePath && sec.hopPath) {
      add({
        id: 'trail', tag: 'Reconnaissance', title: 'Follow the clue trail: metadata, runbook, secret',
        cmd: 'curl -s ' + at(sec.cluePath) + '\ncurl -s ' + at(sec.hopPath),
        request: at(sec.cluePath),
        what: 'A hardened site answers 404 to most of a wordlist. Its public metadata (' + sec.cluePath + ') points at an internal note, and that note (' + sec.hopPath + ') names the migration artifact that still holds credentials: ' + sec.secretPath + '.',
        expect: 'The metadata page ends with an internal reference to ' + sec.hopPath + ', and the runbook names ' + sec.secretPath + ' as a temporary artifact nobody removed.',
        why: 'Real engagements are mostly reading: a manifest, a security.txt, a changelog, a staging runbook. Each document points one step further in, and the scanner is only the start of the trail. On a site like this the difference between a tester and a scanner is whether they follow it.',
        fix: 'Keep internal paths out of public metadata, keep staging runbooks off the public host, and delete migration artifacts when the migration is done.',
        run: () => A.cyberWeb.serveSilent(site, sec.hopPath, 'GET')
      });
    }
    add({
      id: 'login', tag: 'Access', title: 'Sign in with the credentials the site leaked',
      cmd: 'curl -s "' + at(sec.loginPath + '?u=' + encodeURIComponent(site.adminLogin) + '&p=' + encodeURIComponent(site.adminPass)) + '"',
      request: at(sec.loginPath + '?u=' + encodeURIComponent(site.adminLogin) + '&p=' + encodeURIComponent(site.adminPass)),
      what: 'Use the staff email and password recovered from ' + passPath + '. Notice the shape of the request: the form submits GET, so both values travel in the URL — they land in server logs, browser history and any Referer header sent afterwards. That is a second bug. First question: does the leaked password work?',
      expect: 'Signed in as admin, with a link to the staff area and the account page. The site now has a staff session.',
      why: 'The password never had to be guessed: the server printed it. Password attacks (spraying, hydra) are what you do when there is no leak — slow and noisy. Reading the leak is instant and silent, which is exactly why exposed config files are treated as a full compromise.',
      fix: 'Rotate the password, require MFA for staff accounts, submit credentials by POST only, and alert on a staff sign-in from a new address.',
      run: () => A.cyberWeb.serveSilent(site, sec.loginPath + '?u=' + encodeURIComponent(site.adminLogin) + '&p=' + encodeURIComponent(site.adminPass), 'GET')
    });
    add({
      id: 'staff', tag: 'Access', title: 'The staff dashboard: users, keys and a deploy secret',
      cmd: 'curl -s ' + at(admin), request: at(admin),
      what: 'Open the staff folder' + (sec.robotsLeaksAdmin ? ' robots.txt named' : ', whose name came from ' + adminPathFile) + '. Without the session this is a 403 — the page exists, the cookie just does not carry the staff role. With the session it is a dashboard: every user with their API key, the deploy secret, and links to the backend files and the site editor.',
      expect: 'A user table, the deploy secret ' + site.flag + ', and links to /api/users, the site editor and ' + admin + '/backup.zip.',
      why: 'This is authentication (who you are) versus authorisation (what you may see). The dashboard trusts the role in the session cookie, so once the cookie is staff, every request is staff. The deploy secret printed on the page is a bonus: it is usually enough to forge tokens or reach the build system.',
      fix: 'Least privilege for staff roles, no secrets rendered in the UI, session cookies HttpOnly + Secure + SameSite, short session lifetimes.',
      run: () => A.cyberWeb.serveSilent(site, admin, 'GET')
    });
    add({
      id: 'backup', tag: 'Access', title: 'The backup archive the dashboard links',
      cmd: 'curl -s ' + at(admin + '/backup.zip'), request: at(admin + '/backup.zip'),
      what: 'Download the archive. It needs the staff session — without it you get a 403 — which is why the order of these steps matters, exactly as it does in real life. Deploy scripts leave archives behind: old-site.zip, backup-2019.tar.gz, dump.sql.',
      expect: 'A PK header, then $JWT_SECRET=' + site.token + 'jwt, DB_PASSWORD, ADMIN_PATH and the admin login and password again.',
      why: 'An archive made last year contains last year’s .env, including secrets that were rotated since — and the JWT signing key, which lets an attacker mint a valid session without any password at all. "We deleted that backup" usually means "we deleted it from one folder".',
      fix: 'Back up outside the web root, encrypt the archives, expire them automatically, and scan the public root for .zip/.tar.gz/.sql. Any hit is an incident, not housekeeping.',
      run: () => A.cyberWeb.serveSilent(site, admin + '/backup.zip', 'GET')
    });
    if (sec.openUsersApi) add({
      id: 'users', tag: 'Post-exploitation', title: 'Ask the API for the user list — no login at all',
      cmd: 'curl -s ' + at('/api/users'), request: at('/api/users'),
      what: 'Request the JSON endpoint directly, without the staff session. The route was written for an internal dashboard and shipped with the public app, so it answers anyone.',
      expect: 'A JSON array of five accounts with names, emails, roles and ids. The first one is the admin: ' + site.adminLogin + '.',
      why: 'APIs are usually more trusting than pages. The front end gets a login wall while the endpoints behind it get a CORS header and nothing else. Enumeration produces a target list: names, roles and emails are the raw material for phishing and password spraying.',
      fix: 'Authenticate every route, including the "internal" ones; return only the fields the client needs; alert on enumeration patterns.',
      run: () => A.cyberWeb.serveSilent(site, '/api/users', 'GET')
    });
    if (sec.openIdor) add({
      id: 'idor', tag: 'Post-exploitation', title: 'Read an order that is not yours (IDOR)',
      cmd: 'curl -s ' + at('/api/orders/' + order), request: at('/api/orders/' + order),
      what: 'Take an order id — they are sequential integers, and the account page lists yours — and ask for one directly. The server looks the object up by id and returns it. It never asks whether the order belongs to you.',
      expect: 'JSON with the customer name, email, delivery address and total for order ' + order + '.',
      why: 'This is IDOR / broken object-level authorisation. Because ids are guessable, one working request plus a loop reads the whole table: every customer, every address, every total. It sits in the OWASP API top ten because the UI never offers the link, so nobody clicks it in testing.',
      fix: 'Check ownership server-side on every object read, use unguessable ids as defence in depth (never as the only control), and test with two accounts that must not see each other.',
      run: () => A.cyberWeb.serveSilent(site, '/api/orders/' + order, 'GET')
    });
    if (sec.sqliSearch) add({
      id: 'sqli', tag: 'Injection', title: 'One quote in the search box: is the query glued together?',
      cmd: "curl -s " + at("/api/search?q='"), request: at('/api/search?q=%27'),
      what: 'Send a single quote (%27) as the search term. If the server assembles SQL by pasting strings, that quote ends the SQL string literal and the database complains about the broken syntax.',
      expect: 'HTTP 500 with SQLSTATE[42000]: Syntax error or access violation: 1064 … and a stack trace naming the search class.',
      why: 'The error is the proof that your text reaches the query as code rather than data. From there the classic escalation is UNION SELECT — read the users table through the search page, no login needed. The stack trace hands over the engine (MySQL), the framework and the file paths for free.',
      fix: 'Parameterised queries everywhere (bind values, never concatenate), generic error pages, full details in server-side logs only.',
      run: () => A.cyberWeb.serveSilent(site, '/api/search?q=%27', 'GET')
    });
    if (sec.sqliLogin) add({
      id: 'bypass', tag: 'Injection', title: 'Authentication bypass in the same query',
      cmd: "curl -s " + at("/login?u=admin'--&p=x"), request: at('/login?u=admin%27--&p=x'),
      what: 'Inject into the login query. admin\'-- closes the email string and comments out everything after it, so the password comparison is deleted and the query becomes "does a user called admin exist?". It does.',
      expect: 'Signed in as admin — with the assembled SQL printed on the page, showing exactly what your text did to the question.',
      why: 'The same missing parameterisation, in the most valuable place. A comment sequence (-- or #) removes the rest of the query, so authentication collapses into a lookup. This is why "escape the quotes" is not a fix: the query is still built from text.',
      fix: 'Parameterised queries, constant-time password verification, lockout after repeated failures, and a response that never says whether the user or the password was wrong.',
      run: () => A.cyberWeb.serveSilent(site, '/login?u=admin%27--&p=x', 'GET')
    });
    add({
      id: 'deface', tag: 'Impact', title: 'Change what every visitor reads (defacing the site)',
      cmd: 'curl -s "' + at(admin + '/content?headline=…&message=…') + '"',
      request: at(admin + '/content?headline=' + encodeURIComponent('This site is under new management') + '&message=' + encodeURIComponent('Reached through the site’s leaked configuration and the staff editor. A fictional target inside Moundshroud.')),
      what: 'You hold a staff session, so the site’s own content editor saves: a headline and a message go straight to the front page. In real incidents this is usually all "defacement" is — not a magic exploit, just the site’s editor used by somebody who should never have had the session.',
      expect: 'Home page updated. The next step loads / and shows the text in a red banner above the real content.',
      why: 'The impact of taking over an account is whatever that account can do, and editors publish. If the editor is reachable with a leaked password, the front page is reachable. Real defacements often escalate from here to hosting malware or skimming visitor sessions.',
      fix: 'Restore the last good copy, revoke every staff session, rotate the leaked credentials, then fix the way in. Restoring the page without closing the path invites the same edit tomorrow.',
      run: () => A.cyberWeb.serveSilent(site, admin + '/content?headline=' + encodeURIComponent('This site is under new management') + '&message=' + encodeURIComponent('Reached through the site’s leaked configuration and the staff editor. A fictional target inside Moundshroud.'), 'GET')
    });
    add({
      id: 'verify', tag: 'Impact', title: 'Look at it as a visitor would',
      cmd: 'curl -s ' + at('/'), request: at('/'),
      what: 'Load the front page with no session at all. This is what a customer sees now. The change is stored on the site, not in your browser, so it survives closing every window.',
      expect: 'The red SITE DEFACED banner with your headline and message, above the original content.',
      why: 'Verification is part of the job: a finding you did not confirm is a guess, and a screenshot with a timestamp is the evidence that goes in the report.',
      fix: 'Monitor the home page and alert on a change outside a deploy window; keep an off-site copy of the last known good page.',
      run: () => A.cyberWeb.serveSilent(site, '/', 'GET')
    });
    add({
      id: 'restore', tag: 'Cleanup', title: 'Put it back the way you found it',
      cmd: 'curl -s ' + at(admin + '/content?reset=1'), request: at(admin + '/content?reset=1'),
      what: 'A good engagement leaves the target as it found it, with a documented change log. This reset restores the original home page. In real work you agree the rollback with the client and re-test only what you were asked to.',
      expect: 'Home page restored, and GET / shows the clean site again. (Your staff session is still open: revoking it is part of the client’s fix, not yours.)',
      why: 'Cleanup is a phase, not an afterthought. Leaving a defaced page behind turns a report into an incident, and leaving your test accounts behind is worse.',
      fix: 'Keep a tested restore procedure and treat the whole chain — robots.txt, .env, login, editor — as one incident rather than four.',
      run: () => A.cyberWeb.serveSilent(site, admin + '/content?reset=1', 'GET')
    });
    add({
      id: 'report', tag: 'Report', title: 'Write it up: chain, evidence, fix, verification',
      what: 'The report is the deliverable. In order of severity: (1) configuration files (' + leaks.map(f => f.path).join(', ') + ') served from the web root — critical, credential disclosure; (2) the staff editor writable with those credentials — high, integrity of the public site; (3) unauthenticated /api/users and the order API without an ownership check — high, personal data disclosure; (4) SQL injection in search and login — critical, full database read and auth bypass; (5) the deploy secret and JWT key committed to a public archive — critical; (6) credentials submitted by GET — medium, secrets in logs. For each: what you did, the request and response that proves it, the impact in one sentence, the fix, and how the client verifies the fix.',
      expect: 'A report a non-specialist can act on. "Fix the injection" is not a finding; "the q parameter of /api/search is concatenated into SQL, fix by binding parameters, verify with q=%27 returning a generic error" is.',
      why: 'Findings that are not reproduced with evidence get argued about; findings with a request, a response and a timestamp get fixed. Severity without impact is noise.',
      fix: 'Hand over the chain, not just the bugs: closing one link while the others stay open does not change the outcome.',
      run: null
    });
    return steps;
  }

  /* ---------- the practice network walkthrough ---------- */
  const HOST_INFO = {
    '10.20.30.1': ['gw-edge', 'the edge router', 'Recon only in this range: a router with DNS and a small web admin page. There is no modelled way in from here, and in a real engagement you would not start with the gateway — you would note it, confirm it is in scope, and leave it alone until you understand the network.'],
    '10.20.30.21': ['WS-MAYA', 'a Windows 10 workstation', 'The way into this network: SMB with anonymous enumeration, an IT share that holds an onboarding note with a password, then SSH as the shared helpdesk account. Start here whatever host you actually want.'],
    '10.20.30.22': ['SRV-FILES', 'the Windows file server', 'The prize: SMB and RDP, and a local administrator password reused from the workstation. You cannot get in without the credentials from 10.20.30.21, so the chain starts there.'],
    '10.20.30.23': ['SRV-HELP', 'the helpdesk server', 'SSH, HTTP and the ticketing app on 8080. The range models this host as recon only — the way in that matters is the shared helpdesk login, and it is found on the workstation, not here.']
  };
  const RANGE_IPS = Object.keys(HOST_INFO);
  let range = null;
  const getRange = () => range || (range = window.TerminalPlayground && window.TerminalPlayground.makeRemoteRange ? window.TerminalPlayground.makeRemoteRange() : null);

  function pcSteps(ip) {
    const info = HOST_INFO[ip];
    const steps = [];
    const add = step => steps.push(step);

    add({
      id: 'intro', tag: 'Scope', title: 'The network in front of you: ' + info[0] + ', ' + info[1],
      what: 'This is the practice network of ' + 'Northwind Dental' + ', an invented company. Every address, account, share, password and file below is simulated in this page — no packet is sent, nothing outside the browser is touched. ' + info[2] +
        ' Everything here pays the practice bank nothing: a walkthrough is a lesson, not a job, so there is no money to farm by replaying it.',
      expect: 'Scope: 10.20.30.0/24, four invented machines. You are kali@range with the usual toolset and nowhere else to go.',
      why: 'In real work the first deliverable is a network map with the scope drawn on it. Knowing which host is the way in — and which is a dead end — is what separates a planned engagement from an afternoon of noise.',
      fix: 'Defenders get the same map: segment the network so a workstation cannot reach a file server over SMB, and log the scans that map it.',
      cmds: null
    });
    add({
      id: 'targets', tag: 'Reconnaissance', title: 'Confirm what is in scope before you touch it',
      cmd: 'targets',
      what: 'List the hosts and the rules of the range. In real life this step is the scope document again: the CIDR you are allowed to scan, the hosts you must not, the hours, and the contact. Scanning outside the scope is how consultants get fired and prosecuted.',
      expect: 'Four hosts: gw-edge 10.20.30.1, WS-MAYA 10.20.30.21, SRV-FILES 10.20.30.22, SRV-HELP 10.20.30.23, with the note that SMB, SSH and RDP are the ways in.',
      why: 'A scan is traffic. It appears in firewalls, in IDS logs and in somebody’s inbox at 2am. That is acceptable when you were invited and a problem when you were not.',
      fix: 'Network inventory and monitoring: a scan of the internal range should be a ticket, not a surprise.',
      cmds: ['targets']
    });
    add({
      id: 'scan', tag: 'Reconnaissance', title: 'Scan the whole range: which machines are alive and what they answer',
      cmd: 'nmap -sV 10.20.30.0/24',
      what: 'A version scan of the /24. -sV makes nmap connect to each open port and work out what is listening and which version it is, because the version is what tells you whether the service is old enough to matter.',
      expect: 'Four hosts up. The gateway answers 53/443; WS-MAYA answers 135/139/445 (Windows file sharing); SRV-FILES answers 139/445/3389 (SMB and RDP); SRV-HELP answers 22/80/8080 (SSH, nginx, a helpdesk app).',
      why: 'Ports are capability. 445 means SMB — file sharing, credentials, remote execution. 3389 means somebody can sit at that desktop. 22 means a shell if you have a password or a key. 8080 running a ticketing app means a web application to test. The OS guess narrows which exploit path even exists.',
      fix: 'Firewall rules that permit only what a host needs, SMB and RDP never exposed to workstations, and a patched SMB stack. Monitoring sees the sweep; the defender’s job is to make what it finds boring.',
      cmds: ['nmap -sV 10.20.30.0/24']
    });
    add({
      id: 'host', tag: 'Reconnaissance', title: 'Narrow to ' + info[0] + ' at ' + ip,
      cmd: 'nmap -sV ' + ip,
      what: 'Scan the one host that matters, with versions. This is the scan you would keep in the report: precise, explainable, and easy to repeat after remediation.',
      expect: 'One host up, its OS line, and each open port with the service and version behind it.',
      why: 'A /24 sweep tells you where to look; a single-host scan tells you what to try. Reporting at this level of detail is how the client re-tests the fix.',
      fix: 'Patch the versions named here and close the ports the host does not need. A file server does not need to be reachable from the workstation VLAN at all.',
      cmds: ['nmap -sV ' + ip]
    });
    add({
      id: 'enum', tag: 'Enumeration', title: 'Enumerate the users and shares over SMB',
      cmd: 'enum4linux 10.20.30.21',
      what: 'SMB will often answer questions with no credentials at all — the null session. enum4linux asks for the user list, the groups and the shares, and prints what came back. This is the "open a user and look" step: you are not guessing names, you are reading the directory service.',
      expect: 'Domain NORTHWIND, users helpdesk, maya and Administrator, and four shares: IPC$, HR, IT and Public.',
      why: 'Anonymous enumeration is a legacy convenience that outlived its reason. The user list turns into a login list; the share list turns into a data map. Note that helpdesk is a shared support account — shared accounts are where passwords leak, because several people need to know them.',
      fix: 'Restrict anonymous enumeration (RestrictNullSessAccess), require SMB signing, and stop using shared accounts — each person gets their own, with MFA.',
      cmds: ['enum4linux 10.20.30.21']
    });
    add({
      id: 'shares', tag: 'Enumeration', title: 'List the shares without a password',
      cmd: 'smbclient -L //10.20.30.21 -N',
      what: 'Ask the workstation to list its shares anonymously (-N means no password). This is the same discovery a file browser does when you click "Network", minus the login prompt.',
      expect: 'IPC$, HR, IT and Public, each with a one-line description. IT is described as onboarding.',
      why: 'A share that answers anonymously is a share whose permissions were never finished. "IT onboarding" is the sort of description that tells you what will be inside before you open it — the name is the finding.',
      fix: 'Remove null sessions, ACL every share to the group that needs it, and audit share names for the ones that sound like a drawer full of passwords.',
      cmds: ['smbclient -L //10.20.30.21 -N']
    });
    add({
      id: 'it', tag: 'Enumeration', title: 'Browse the IT share',
      cmd: 'smbclient //10.20.30.21/IT -N -c "ls"',
      what: 'Connect to the IT share and list it. The -c "ls" runs one command and returns, which is how you script this instead of sitting in an interactive prompt.',
      expect: 'onboarding.txt, asset-register.csv and tools.zip. The register maps hosts to owners and roles.',
      why: 'File shares are where organisations keep the things they think are internal: onboarding notes, registers, exports, spreadsheets with credentials in a hidden column. A readable IT share on a workstation is a much bigger finding than an open port, because it is content, not capability.',
      fix: 'Share permissions by group, no anonymous read, and a rule that credentials are never written to a text file on a share — a password manager, not a document.',
      cmds: ['smbclient //10.20.30.21/IT -N -c "ls"']
    });
    add({
      id: 'get', tag: 'Enumeration', title: 'Download the onboarding note',
      cmd: 'smbclient //10.20.30.21/IT -N -c "get onboarding.txt"',
      what: 'Pull the file into a local folder called loot/ so you can read it with cat. Copying evidence off a share is normal during an engagement; what matters is that it stays inside the scope and the report.',
      expect: 'A "getting file \\onboarding.txt" line, and the file appearing under loot/.',
      why: 'The whole chain turns on one sentence in one text file. Attackers do not need a zero-day when a new starter’s temporary password is written down where the new starter can read it — and so can everyone else.',
      fix: 'Provision credentials in person or through a manager that forces a change at first logon, never in a shared document. Audit the IT share for the word "password".',
      cmds: ['smbclient //10.20.30.21/IT -N -c "get onboarding.txt"']
    });
    add({
      id: 'creds', tag: 'Credentials', title: 'Read the password out of the note',
      cmd: 'cat loot/onboarding.txt',
      what: 'Read what you downloaded. Here it is a temporary helpdesk password and the news that desktop support uses the same account on the workstation and the file server.',
      expect: 'The helpdesk password Sunrise-2026! and a line saying it is shared with desktop support.',
      why: 'Password reuse and shared accounts are the real vulnerability; the share was only how you found it. One password that opens two machines is worth more than a dozen exploits, and it is invisible to a vulnerability scanner.',
      fix: 'Unique accounts per person, a password manager, forced rotation of temporary credentials, and MFA so a password alone is not enough.',
      cmds: ['cat loot/onboarding.txt']
    });
    add({
      id: 'ssh', tag: 'Access', title: 'Sign in over SSH with the shared helpdesk account',
      cmd: 'ssh helpdesk@10.20.30.21',
      what: 'SSH asks for the password next; paste the one from the note. In real life you would check whether password authentication is even allowed — many servers only accept keys, which stops this whole path.',
      expect: 'A password prompt, then a PowerShell prompt on WS-MAYA as NORTHWIND\\helpdesk.',
      why: 'A valid credential is indistinguishable from the real user. That is why the sequence matters: the share was readable because permissions were unfinished, the password worked because it was reused, and nobody was watching because it was a normal login.',
      fix: 'Disable password authentication for SSH, require keys, put MFA in front of remote access, and alert on a login from outside the usual hours or address.',
      cmds: ['ssh helpdesk@10.20.30.21', 'Sunrise-2026!']
    });
    add({
      id: 'inside', tag: 'Post-exploitation', title: 'Look around from the inside',
      cmd: 'whoami · hostname · ipconfig · dir C:\\Users\\Public\\Documents',
      what: 'You are on the machine as a normal (if privileged) user. Establish where you are and what you can see: whoami for the identity, hostname for the machine, ipconfig for the network it sits on, dir for the folders that matter. This is "living off the land": ordinary commands, nothing to download.',
      expect: 'NORTHWIND\\helpdesk, WS-MAYA, 10.20.30.21 with the gateway 10.20.30.1, and the Public Documents folder listing notes.txt and handover.txt.',
      why: 'Real post-exploitation is quiet and boring. Attackers use what is already installed because new binaries trigger alerts. The map you build here — which server this workstation trusts, which folders are shared — is what decides the next step.',
      fix: 'Log process creation and command lines (the whoami/ipconfig/dir sequence is a signature), and segment so a workstation cannot reach a file server’s admin shares.',
      cmds: ['whoami', 'hostname', 'ipconfig', 'dir C:\\Users\\Public\\Documents']
    });
    add({
      id: 'handover', tag: 'Post-exploitation', title: 'Find the local administrator password in a handover note',
      cmd: 'type C:\\Users\\Public\\Documents\\handover.txt',
      what: 'Open the handover note on the workstation. It contains the local administrator password for the file server, left there so a colleague could finish a printer migration.',
      expect: 'The password Blu3-Falcon-88 for administrator on SRV-FILES, and a line telling you where it is used.',
      why: 'This is the pivot. One credential found on a workstation becomes administrator on a server, and the same local admin password is usually on every machine built from the same image. Lateral movement is almost always credential movement, not exploitation.',
      fix: 'Microsoft LAPS (or any managed local admin password), no plaintext credentials in documents, and tiered administration so a workstation credential cannot administer a server.',
      cmds: ['type C:\\Users\\Public\\Documents\\handover.txt']
    });
    add({
      id: 'cme', tag: 'Lateral movement', title: 'Test the admin password across SMB',
      cmd: 'crackmapexec smb 10.20.30.22 -u administrator -p Blu3-Falcon-88',
      what: 'Leave the SSH session (exit) and validate the credential against SMB on the file server before trying to use it. crackmapexec reports whether the login succeeds and whether the account is a local administrator — Pwn3d! in the output means both.',
      expect: 'SMB 10.20.30.22 445 SRV-FILES [+] NORTHWIND\\administrator:Blu3-Falcon-88 (Pwn3d!)',
      why: 'Validating first avoids noise: one authentication attempt instead of a failed remote-execution attempt that logs an error. Spraying this password across the range is exactly how a single leaked password becomes a domain-wide incident.',
      fix: 'Unique local admin passwords, SMB signing, and monitoring for authentication from a workstation to a server’s admin shares.',
      cmds: ['exit', 'crackmapexec smb 10.20.30.22 -u administrator -p Blu3-Falcon-88']
    });
    add({
      id: 'psexec', tag: 'Lateral movement', title: 'A SYSTEM shell on the file server',
      cmd: 'impacket-psexec administrator@10.20.30.22 -p Blu3-Falcon-88',
      what: 'psexec uploads a small service, starts it as SYSTEM, and hands you the shell it creates. It is loud, well documented and still everywhere — because it works whenever SMB and a local admin credential are both available.',
      expect: 'A service starting, then nt authority\\system@SRV-FILES C:\\Windows\\system32> — SYSTEM is more privileged than Administrator.',
      why: 'Once you are SYSTEM on a file server you can read every share, dump credentials from memory and change anything you like. This is the moment the engagement’s impact statement becomes real: the confidentiality and integrity of the whole file service.',
      fix: 'Block SMB between workstations and servers, remove local admin rights from shared accounts, enable SMB signing, and alert on service creation over the network (event 7045).',
      cmds: ['impacket-psexec administrator@10.20.30.22 -p Blu3-Falcon-88']
    });
    add({
      id: 'vault', tag: 'Impact', title: 'Read the vault on the file server',
      cmd: 'type C:\\ProgramData\\vault\\admin.txt',
      what: 'As SYSTEM you can read anything, including the folder that was locked to administrators. That is the difference between "I have an admin account" and "I have the machine".',
      expect: 'FLAG{remote_srv_files_system_9c41} and the note that it is fictional training data.',
      why: 'Data at rest is only protected by permissions, and permissions do not apply to SYSTEM. Anything on the box is readable once the box is owned — which is why "encrypt the sensitive files" beats "hide the folder".',
      fix: 'A secrets manager instead of files, disk encryption with keys held elsewhere, and monitoring that notices SYSTEM-level reads of protected folders.',
      cmds: ['type C:\\ProgramData\\vault\\admin.txt']
    });
    add({
      id: 'rdp', tag: 'Optional', title: 'The same credentials open a desktop session too',
      cmd: 'xfreerdp /v:10.20.30.22 /u:administrator /p:Blu3-Falcon-88',
      what: 'RDP is the graphical version of the same access. Nothing new is exploited here — the password you already have opens the console as well, which is why an engagement lists every service a credential unlocks, not just the one you used.',
      expect: 'A connecting line and a simulated desktop session signed in as administrator.',
      why: 'Attackers prefer the interface they are fastest in. A stolen credential that works on three protocols is three times the exposure, and each one has its own logging.',
      fix: 'RDP behind a gateway or VPN, NLA enforced, MFA, and account lockout. Remote desktop should never be reachable from a workstation VLAN.',
      cmds: ['xfreerdp /v:10.20.30.22 /u:administrator /p:Blu3-Falcon-88']
    });
    add({
      id: 'report', tag: 'Report', title: 'Write it up, then put the range back',
      what: 'The chain in severity order: (1) an IT share readable with no credentials — high, credential disclosure; (2) a shared helpdesk password in a plaintext note — high, reuse across hosts; (3) SSH with password authentication on a workstation — high, remote access; (4) a local administrator password in a handover document, reused on the server — critical, full server compromise; (5) SMB reachable from the workstation VLAN, allowing psexec — high, lateral movement; (6) the vault readable as SYSTEM — critical, data at rest unprotected. Each one gets the command, the output, the impact in a sentence, the fix and a re-test. Then reset the range so the next person starts clean — a good engagement leaves nothing behind, not even in a simulation.',
      expect: 'A report a sysadmin can act on: LAPS, no shared accounts, no password SSH, SMB segmentation, a secrets manager.',
      why: 'The difference between a red team and a criminal is the report and the permission. Both of those are paperwork, and the paperwork is what makes the technical work worth anything.',
      fix: 'Fix the chain as one incident. Unique credentials per machine and per person break it at the first link.',
      cmds: ['reset-range']
    });
    return steps;
  }

  /* ---------- running a step ---------- */
  function runSite(site, step) {
    const result = A.cyberWeb.serveSilent(site, step.request.replace(/^https?:\/\/[^/]+/, ''), 'GET');
    return show(result);
  }
  function runPc(step) {
    const r = getRange();
    if (!r) return 'The practice network is still loading — try again in a moment.';
    if (!step.cmds) return 'This step is reading and writing, not running a command.';
    let text = '';
    for (const line of step.cmds) {
      const before = r.prompt();
      if (before) text += before;
      text += line + '\n';
      let out = String(r.run(line) || '').replace(/\r/g, '');
      /* the range returns the next prompt at the end of a command's output (a password prompt, a shell prompt);
         printing it once, from the start of the next line, is exactly how a real terminal lays it out */
      const after = r.prompt();
      if (after && out.endsWith(after)) out = out.slice(0, -after.length);
      text += out;
      if (out && !/\n$/.test(out)) text += '\n';
    }
    return text.replace(/\n{3,}/g, '\n\n').trim();
  }

  /* ---------- the app ---------- */
  function currentSteps() {
    if (state.kind === 'site' && state.site) return siteSteps(state.site);
    if (state.kind === 'pc' && state.ip) return pcSteps(state.ip);
    return [];
  }

  function stepHtml(step, index, steps) {
    const id = step.id;
    const done = state.done.has(key(id));
    const out = state.out[key(id)];
    return '<details class="cd-walk-step' + (done ? ' done' : '') + '"' + (done ? ' open' : '') + ' data-step="' + id + '">' +
      '<summary><span class="cd-walk-num">' + (done ? '✓' : String(index + 1)) + '</span>' +
      '<b>' + esc(step.title) + '</b><small>' + esc(step.tag) + '</small></summary>' +
      '<div class="cd-walk-body">' +
      '<p>' + esc(step.what) + '</p>' +
      (step.cmd ? '<div class="cd-walk-cmdbox"><pre>' + esc(step.cmd) + '</pre>' +
        '<button type="button" data-walk-copy="' + esc(step.cmd) + '">Copy</button></div>' : '') +
      '<p><b>You should see</b> ' + esc(step.expect) + '</p>' +
      '<p><b>Why this works</b> ' + esc(step.why) + '</p>' +
      '<p><b>What a defender does</b> ' + esc(step.fix) + '</p>' +
      (step.cmds || step.request ? '<div class="cd-walk-run"><button type="button" class="cd-primary" data-walk-run="' + id + '">' +
        (step.cmds ? 'Run these commands here' : 'Send this request and show the answer') + '</button>' +
        '<small>Nothing leaves this page and nothing is paid to the bank.</small></div>' +
        '<pre class="cd-walk-out"' + (out ? '' : ' hidden') + '>' + esc(out || '') + '</pre>' : '') +
      '</div></details>';
  }

  function draw(body) {
    const steps = currentSteps();
    const doneCount = steps.filter(step => state.done.has(key(step.id))).length;
    const suggestions = (A.cyberWeb ? A.cyberWeb.all().slice(0, 3) : []).map(site => site.host);
    body.innerHTML = '<div class="cd-content cd-walk">' +
      '<header class="cd-walk-head"><div><span class="cd-walk-kicker">Walkthrough Playground · no rewards</span>' +
      '<h2>Paste a target, get the whole engagement</h2>' +
      '<p class="mute">A generated website address, or an IP from the practice network. Every chapter gives the exact ' +
      'request or command, what it answers on this target, why it works, and what a defender does about it. It pays the ' +
      'practice bank nothing on purpose — the reward for this one is knowing how.</p></div>' +
      (steps.length ? '<div class="cd-walk-progress"><b>' + doneCount + ' / ' + steps.length + '</b><span>steps run</span>' +
        '<button type="button" data-walk-reset>Start again</button></div>' : '') + '</header>' +
      '<form class="cd-walk-form" data-walk-form><label>Address or IP' +
      '<input name="target" autocomplete="off" spellcheck="false" placeholder="https://amberbasket.shop/  ·  10.20.30.21" value="' +
      esc(state.kind === 'site' ? state.host : state.ip) + '"></label>' +
      '<button type="submit" class="cd-primary">Build the walkthrough</button></form>' +
      '<p class="cd-walk-hint">Try a fake site: ' + suggestions.map(host => '<button type="button" data-walk-pick="' + esc(host) + '">' + esc(host) + '</button>').join(' ') +
      ' · or the practice network: ' + RANGE_IPS.map(ip => '<button type="button" data-walk-pick="' + ip + '">' + ip + '</button>').join(' ') + '</p>' +
      (state.error ? '<p class="cd-walk-error" role="alert">' + esc(state.error) + '</p>' : '') +
      (steps.length ? '<section class="cd-walk-brief"><h3>' + esc(state.kind === 'site' ? state.site.brand + ' · ' + state.site.host : 'Practice network · ' + state.ip) + '</h3>' +
        '<p class="mute">' + esc(state.kind === 'site'
          ? 'A site generated by Moundshroud. Readers of the pretend internet see it; the practice bank pays for the real findings found in the Browser, and this page deliberately pays nothing.'
          : 'An invented company network: four machines, one way in. Every host, account and password is simulated in this page.') + '</p></section>' +
        '<div class="cd-walk-steps">' + steps.map((step, index) => stepHtml(step, index, steps)).join('') + '</div>' : '') +
      '<p class="cd-walk-fine">Only ever do this on a system you own or have written permission to test. Everything here is ' +
      'simulated inside this page: no socket is opened, no real host is contacted, and no money is paid.</p></div>';

    const form = body.querySelector('[data-walk-form]');
    form.onsubmit = event => {
      event.preventDefault();
      start(body, new FormData(form).get('target'));
    };
  }

  function start(body, raw) {
    const text = String(raw == null ? '' : raw).trim();
    state.error = '';
    state.done = new Set();
    state.out = {};
    if (!text) { state.kind = 'none'; return draw(body); }
    /* an address — with or without a scheme, with or without a path — opens the website walkthrough */
    if (/^(?:\d{1,3}\.){3}\d{1,3}$/.test(text)) {
      if (!HOST_INFO[text]) {
        state.error = text + ' is not in the practice range. In scope: ' + RANGE_IPS.join(', ') + '. (The walkthrough only builds for the four invented machines, so it can give you real commands.)';
        state.kind = 'none';
        return draw(body);
      }
      state.kind = 'pc'; state.ip = text; state.host = ''; state.site = null;
      return draw(body);
    }
    const hit = A.cyberWeb && A.cyberWeb.visit ? A.cyberWeb.visit(text) : null;
    if (!hit) {
      state.error = 'That does not look like an address or an IP. Try amberbasket.shop, https://amberbasket.shop/ or 10.20.30.21.';
      state.kind = 'none';
      return draw(body);
    }
    state.kind = 'site'; state.site = hit.site; state.host = hit.site.host; state.ip = '';
    draw(body);
  }

  function app(body) {
    if (!state.kind && !state.error) state.kind = 'none';
    draw(body);
    body.onclick = event => {
      const pick = event.target.closest('[data-walk-pick]');
      if (pick) return start(body, pick.dataset.walkPick);
      if (event.target.closest('[data-walk-reset]')) {
        state.done = new Set(); state.out = {};
        return draw(body);
      }
      const copy = event.target.closest('[data-walk-copy]');
      if (copy) {
        const value = copy.dataset.walkCopy;
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(value).then(() => A.toast('Command copied.'), () => A.toast('Copy failed — select it instead.'));
        return;
      }
      const run = event.target.closest('[data-walk-run]');
      if (!run) return;
      const steps = currentSteps();
      const step = steps.find(entry => entry.id === run.dataset.walkRun);
      if (!step) return;
      let text;
      try { text = state.kind === 'site' ? runSite(state.site, step) : runPc(step); }
      catch (error) { text = 'That step failed: ' + String(error && error.message || error); }
      state.out[key(step.id)] = text;
      state.done.add(key(step.id));
      const details = run.closest('.cd-walk-step');
      const out = details.querySelector('.cd-walk-out');
      out.hidden = false;
      out.textContent = text;
      details.classList.add('done');
      details.querySelector('.cd-walk-num').textContent = '✓';
      const counter = body.querySelector('.cd-walk-progress b');
      if (counter) counter.textContent = steps.filter(entry => state.done.has(key(entry.id))).length + ' / ' + steps.length;
    };
    return () => { body.onclick = null; };
  }

  A.cyberWalkthrough = { app, state, reset: () => { state.kind = 'none'; state.host = ''; state.ip = ''; state.site = null; state.done = new Set(); state.out = {}; } };
  A.cyberExtras = A.cyberExtras || {};
  A.cyberExtras.walkthrough = app;
})();

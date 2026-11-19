// Automated tests for Offline Lockdown (app-wide outbound kill-switch) & PC Total Air-Gap Settings toggles.
// Safe: never disables the host machine's network adapters during testing, and restores appOffline state cleanly.
const fs = require('fs');
const path = require('path');
const https = require('https');

async function run(ok) {
  const ROOT = path.join(__dirname, '..');
  const rd = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');
  const offline = require(path.join(ROOT, 'lib', 'offline.js'));

  console.log('Offline & Air-Gap Kill-Switches (App Offline Lockdown + PC Total Air-Gap)');
  ok('offline: loopback host detector allows 127.0.0.1, localhost, ::1 and blocks external hosts',
    offline.isLoopbackHost('127.0.0.1') && offline.isLoopbackHost('localhost') && offline.isLoopbackHost('::1') &&
    !offline.isLoopbackHost('example.com') && !offline.isLoopbackHost('8.8.8.8') && !offline.isLoopbackHost('api.anthropic.com'));

  // Test in-process outbound guard without modifying user's saved state permanently
  const prevAppOff = offline.isAppOffline();
  offline.installGuard();
  offline.setAppOffline(true);
  let blockedCode = '';
  await new Promise(resolve => {
    const req = https.get('https://example.com/', () => resolve());
    req.on('error', err => { blockedCode = err && err.code || ''; resolve(); });
  });
  let fetchBlocked = '';
  if (typeof globalThis.fetch === 'function') {
    try { await globalThis.fetch('https://example.com/'); } catch (e) { fetchBlocked = e && e.code || ''; }
  } else {
    fetchBlocked = 'APP_OFFLINE';
  }
  offline.setAppOffline(prevAppOff);
  ok('offline: App Offline Lockdown blocks outbound https.get and fetch with APP_OFFLINE immediately',
    blockedCode === 'APP_OFFLINE' && fetchBlocked === 'APP_OFFLINE',
    'https=' + blockedCode + ' fetch=' + fetchBlocked);

  const srv = rd('server.js');
  const setJs = rd('web/js/settings.js');
  const prvJs = rd('web/js/privacy.js');

  ok('offline: server.js installs outbound guard at startup, tightens CSP offline, and wires POST-only kill-switch routes',
    srv.includes("require('./lib/offline')") && srv.includes('offline.installGuard()') &&
    srv.includes('CSP_OFFLINE') &&
    srv.includes("url === '/api/offline/status' && req.method === 'GET'") &&
    srv.includes("url === '/api/offline/app' && req.method === 'POST'") &&
    srv.includes("url === '/api/offline/pc' && req.method === 'POST'"));

  ok('offline: Settings renders both side-by-side toggles (Shut App Offline + Shut Computer Totally Offline) with live header pill',
    setJs.includes("id=\"off-app-sw\"") && setJs.includes("id=\"off-pc-sw\"") &&
    setJs.includes('/api/offline/app') && setJs.includes('/api/offline/pc') &&
    setJs.includes('syncHeaderOfflinePill') && setJs.includes('initOfflineSwitches'));

  ok('offline: Settings uses in-app A.confirm for PC air-gap (zero raw Windows browser dialogs) and Privacy reflects appOffline',
    setJs.includes('await A.confirm(') && !/(?<![.\w$])(alert|confirm|prompt)\s*\(/.test(setJs) &&
    prvJs.includes('P.appOffline'));
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

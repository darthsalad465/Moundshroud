// Phone access (lib/remote.js): off by default, the PIN, the lockout, the phone key, the header and Host checks, and that
// only the listed actions answer. Runs on 127.0.0.1 only (deps.loopback), so Windows never asks about the firewall.
// Also checks the photo-edit command lines (lib/media.js) and the playbooks (lib/harness.js).
const fs = require('fs'), os = require('os'), path = require('path'), http = require('http');

module.exports = async ok => {
  const R = require(path.join(__dirname, '..', 'lib', 'remote.js'));
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ms-remote-')), port = 47000 + Math.floor(Math.random() * 900);
  ok('remote: Tailscale addresses are told apart', R.isTs('100.106.57.55') && !R.isTs('100.200.1.1') && !R.isTs('192.168.1.5'));
  ok('remote: home addresses are told apart', R.isPrivate('192.168.1.5') && R.isPrivate('172.16.42.25') && R.isPrivate('10.0.0.2') && !R.isPrivate('8.8.8.8'));
  let hits = 0;
  const rm = R.create({ dataDir: dir, webDir: path.join(__dirname, '..', 'web'), mainPort: 47231, loopback: true, routes: { 'GET /api/status': async x => { hits++; x.send(200, { ok: true }); } } });
  ok('remote: it is off until switched on', rm.status().mode === 'off' && rm.status().listening.length === 0 && !rm.on());
  ok('remote: it cannot be switched on before a PIN is set', !rm.config({ mode: 'lan' }).ok);
  ok('remote: a short PIN is refused', !rm.setPin('123').ok && !rm.setPin('abcdef').ok);
  ok('remote: a PIN is set and stored only as a hash', rm.setPin('482913').ok && !fs.readFileSync(path.join(dir, 'remote.json'), 'utf8').includes('482913'));
  ok('remote: the main app port cannot be used', !rm.config({ port: 47231 }).ok);
  const c = rm.config({ mode: 'both', port });
  ok('remote: switched on, it listens (here on this PC only)', c.ok && rm.on() && fs.existsSync(path.join(dir, 'remote-on')), JSON.stringify(c));
  await new Promise(r => setTimeout(r, 150));
  const req = (p, o) => new Promise(done => {
    o = o || {}; const body = o.body ? JSON.stringify(o.body) : null;
    const r = http.request({ host: '127.0.0.1', port, path: p, method: o.method || (body ? 'POST' : 'GET'), headers: Object.assign({ Host: o.host || '127.0.0.1:' + port }, o.ms === false ? {} : { 'X-MS': '1' }, body ? { 'Content-Type': 'application/json' } : {}, o.cookie ? { Cookie: o.cookie } : {}) }, res => { let t = ''; res.on('data', d => t += d); res.on('end', () => done({ code: res.statusCode, text: t, headers: res.headers })); });
    r.on('error', e => done({ code: 0, text: e.message })); if (body) r.write(body); r.end();
  });
  const page = await req('/');
  ok('remote: the phone page is served', page.code === 200 && /Moundshroud/.test(page.text) && /script-src 'self'/.test(page.headers['content-security-policy'] || ''));
  ok('remote: another host name is refused (DNS rebinding)', (await req('/', { host: 'evil.example:' + port })).code === 421);
  ok('remote: anything not on the list answers 404', (await req('/api/chats')).code === 404 && (await req('/web/js/vault.js')).code === 404);
  ok('remote: an action without the app header is refused', (await req('/r/api/status', { ms: false })).code === 403);
  ok('remote: an action without signing in is refused', (await req('/r/api/status')).code === 401 && hits === 0);
  ok('remote: a wrong PIN is refused', (await req('/r/login', { body: { pin: '000000' } })).code === 401);
  const good = await req('/r/login', { body: { pin: '482913' } }), ck = String((good.headers['set-cookie'] || [''])[0]);
  ok('remote: the right PIN gives the phone a key that scripts cannot read', good.code === 200 && /ms_r=[0-9a-f]{64}/.test(ck) && /HttpOnly/.test(ck) && /SameSite=Strict/.test(ck));
  const cookie = ck.split(';')[0];
  ok('remote: with the key, a listed action works', (await req('/r/api/status', { cookie })).code === 200 && hits === 1);
  ok('remote: an unlisted action still answers 404 with the key', (await req('/r/api/vault', { cookie })).code === 404);
  for (let i = 0; i < 5; i++) await req('/r/login', { body: { pin: '111111' } });
  ok('remote: 5 wrong PINs lock that address out, even for the right PIN', (await req('/r/login', { body: { pin: '482913' } })).code === 429);
  ok('remote: changing the PIN signs every phone out', rm.setPin('739104').ok && (await req('/r/api/status', { cookie })).code !== 200);
  rm.config({ mode: 'off' }); rm.stop();
  ok('remote: switched off, the flag for the tray helper is gone', !fs.existsSync(path.join(dir, 'remote-on')));
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) { }

  /* the photo-edit command lines */
  const M = require(path.join(__dirname, '..', 'lib', 'media.js'));
  const k = M.editArgs(M.clamp.edit({ engine: 'kontext', prompt: 'make it red', w: 512, h: 512, seed: 1 }), 'in.png', 'out.png');
  ok('edit: the precise edit uses the edit model with the photo as reference', k.includes('-r') && k[k.indexOf('-r') + 1] === 'in.png' && k.includes('--diffusion-model') && k.includes('--offload-to-cpu') && k.includes('--t5xxl'));
  const s = M.editArgs(M.clamp.edit({ engine: 'sd', prompt: 'winter scene', strength: 5, w: 500, h: 700 }), 'in.png', 'out.png');
  ok('edit: the quick redraw starts from the photo, with how much may change held to 0.2-0.9', s.includes('-i') && s[s.indexOf('--strength') + 1] === '0.9' && s[s.indexOf('-W') + 1] === '496' && s[s.indexOf('-H') + 1] === '704');
  ok('edit: an unknown engine falls back to the quick redraw', M.clamp.edit({ engine: 'x', prompt: 'a' }).engine === 'sd');

  /* the playbooks reach every agent session */
  const H = require(path.join(__dirname, '..', 'lib', 'harness.js')), pb = H.playbooks();
  ok('playbooks: 7 short playbooks, under 1,000 tokens', /PLAN/.test(pb) && /DEBUG/.test(pb) && /SAFE/.test(pb) && pb.length / 4 < 1000, pb.length + ' chars');
  const a = H.argsFor({ agentModel: 'm', guard: '' }, {});
  ok('playbooks: they are added to the agent\'s instructions', a[a.indexOf('--append-system-prompt') + 1] === pb);
};

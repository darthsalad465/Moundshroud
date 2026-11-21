// The bash sandbox's office network: fictional PCs you can scan, ssh into, and copy files onto with scp.
// Everything is simulated disks inside the sandbox; these checks drive it the way a player types.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

module.exports = async function (ok) {
  const root = path.join(__dirname, '..');
  const storage = new Map();
  const ctx = {
    console, Math, Date, JSON, Array, Object, String, Number, Boolean, RegExp, Error, TypeError, RangeError, Map, Set,
    Uint8Array, Uint32Array, Int32Array, parseInt, parseFloat, isNaN, isFinite, encodeURIComponent, decodeURIComponent,
    URL, URLSearchParams, TextEncoder, AbortController,
    btoa: s => Buffer.from(s, 'binary').toString('base64'), atob: s => Buffer.from(s, 'base64').toString('binary'),
    localStorage: { getItem: k => storage.get(k) ?? null, setItem: (k, v) => storage.set(k, v), removeItem: k => storage.delete(k) }
  };
  ctx.self = ctx.window = ctx.globalThis = ctx;
  vm.createContext(ctx);
  for (const s of ['cyber-crack', 'terminal-unix', 'terminal-ops-training', 'terminal-playground-data', 'terminal-playground-data2', 'terminal-playground-data3'])
    vm.runInContext(fs.readFileSync(path.join(root, 'web/js/' + s + '.js'), 'utf8'), ctx, { filename: s + '.js' });
  const sh = ctx.TerminalPlayground.makeBash();
  const say = c => String(sh.run(c));

  ok('lan: a sweep of 192.168.56.0/24 finds the office PCs', /ws-maria\.lan \(192\.168\.56\.10\)/.test(say('nmap -sn 192.168.56.0/24')) && /5 hosts up/.test(say('nmap -sn 192.168.56.0/24')));
  ok('lan: a host scan lists that PC\'s own ports', /22\/tcp\s+open\s+ssh/.test(say('nmap -sV kiosk-3')) && !/22\/tcp/.test(say('nmap gateway')));
  ok('lan: the kiosk\'s web page shows its login', /guest \/ guest/.test(say('curl http://kiosk-3')));
  ok('lan: an unknown address is unreachable', /No route to host/.test(say('ssh guest@192.168.56.99')));

  say('ssh guest@kiosk-3');
  ok('lan: ssh asks for a password and the prompt says so', sh.secret() && /guest@kiosk-3's password: $/.test(sh.prompt()));
  ok('lan: a wrong password is refused and asks again', /Permission denied, please try again/.test(say('nope')) && sh.secret());
  const welcome = say('guest');
  ok('lan: the right password logs in to the kiosk', /Welcome to Ubuntu/.test(welcome) && /^guest@kiosk-3:~\$ $/.test(sh.prompt()) && !sh.secret());
  ok('lan: commands run on the kiosk\'s own disk', say('whoami') === 'guest' && say('hostname') === 'kiosk-3' && /Spring2026!/.test(say('cat Desktop/it-ticket.txt')));
  ok('lan: the login is written to the kiosk\'s auth.log', /Accepted password for guest/.test(say('tail -1 /var/log/auth.log')));
  ok('lan: exit comes back to dev-box', /Connection to kiosk-3 closed/.test(say('exit')) && /^moundshroud@dev-box:~\$ $/.test(sh.prompt()) && say('whoami') === 'moundshroud');

  say('echo "left by dev" > gift.txt');
  say('scp gift.txt maria@ws-maria:Desktop/');
  const sent = say('Spring2026!');
  ok('lan: scp copies a file onto another PC after its password', /gift\.txt\s+100%/.test(sent));
  say('ssh maria@ws-maria'); say('Spring2026!');
  ok('lan: the copied file is on maria\'s desktop', say('cat Desktop/gift.txt') === 'left by dev');
  ok('lan: maria\'s key opens the NAS with no password', /Welcome to Debian/.test(say('ssh backup@nas-01')) && say('hostname') === 'nas-01');
  ok('lan: the NAS refuses passwords from anyone else', (say('exit'), say('exit'), /Permission denied \(publickey\)/.test(say('ssh backup@nas-01'))));
  say('scp guest@kiosk-3:welcome.txt /tmp/'); say('guest');
  ok('lan: scp copies a file from another PC to this one', /Welcome to the lobby kiosk/.test(say('cat /tmp/welcome.txt')));
  ok('lan: ssh host command runs there and comes straight back', (say('ssh guest@kiosk-3 hostname'), say('guest') === 'kiosk-3') && say('hostname') === 'dev-box');

  const saved = JSON.parse(JSON.stringify(sh.snapshot()));
  const again = ctx.TerminalPlayground.makeBash();
  again.restore(saved);
  ok('lan: the office PCs keep their files after a save and reload', (again.run('ssh maria@ws-maria'), again.run('Spring2026!'), String(again.run('cat Desktop/gift.txt')) === 'left by dev'));
  ok('lan: a file dragged in from this PC lands in the current folder', sh.importFile('from-pc.txt', 'hello from my PC') === '/home/moundshroud/from-pc.txt' && say('cat from-pc.txt') === 'hello from my PC');
  say('reset');
  ok('lan: reset gives every PC its first disk back', (say('scp maria@ws-maria:Desktop/gift.txt /tmp/'), /No such file/.test(say('Spring2026!'))));
};

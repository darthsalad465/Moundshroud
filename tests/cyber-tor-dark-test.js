// Checks for the Fake Dark Web's endless onion space, the government portals, and the Browser's Tor / fake VPN modes.
// The three modules are page code: they run here in a sandbox with a stub A and a stub localStorage, then the pages
// they would serve are rendered and read back. Nothing is fetched and no address is contacted.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

module.exports = async function (ok) {
  const store = {};
  const ctx = vm.createContext({
    console, Date, Math, JSON, URLSearchParams, TextEncoder, setTimeout, clearTimeout,
    localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } },
    A: {}
  });
  ctx.window = ctx;
  for (const name of ['cyber-tor.js', 'cyber-dark-gen.js', 'cyber-dark-web.js']) {
    const file = path.join(__dirname, '..', 'web', 'js', name);
    vm.runInContext(fs.readFileSync(file, 'utf8'), ctx, { filename: file });
  }
  const A = ctx.A;
  ok('tor: the network module loads with a three-hop circuit', !!A.tor && A.tor.hops().length === 3 && A.tor.hops().map(h => h.role).join(',') === 'Guard,Middle,Exit',
    A.tor ? A.tor.hops().map(h => h.role).join(',') : 'no A.tor');
  ok('tor: the three hops are different addresses', new Set(A.tor.hops().map(h => h.ip)).size === 3, A.tor.hops().map(h => h.ip).join(' '));

  const first = A.tor.hops().map(h => h.ip).join();
  A.tor.newCircuit();
  ok('tor: a new circuit draws three new relays', A.tor.hops().map(h => h.ip).join() !== first);
  A.tor.setOn(true);
  ok('tor: the public address is the exit relay while the circuit is up', A.tor.publicIp() === A.tor.exitIp(), A.tor.publicIp());
  const exit = A.tor.vpnOn('CH');
  ok('vpn: a country can be chosen and the exit becomes the public address', !!exit && exit.cc === 'CH' && A.tor.publicIp() === A.tor.vpn.ip, exit && exit.ip);
  ok('vpn: Tor and the VPN compose into one label', A.tor.label() === 'Tor + VPN', A.tor.label());
  A.tor.vpnOff();
  A.tor.off();
  ok('tor: turning it off returns the PC’s own address', A.tor.publicIp() === A.tor.homeIp(), A.tor.publicIp());

  /* the generator: one page per address, forever, in four different qualities */
  const one = A.darkGen.site('abcdefghijklmnop.onion');
  const home = one.render('/', new URLSearchParams(''));
  ok('dark web: a generated service renders a page', home.status === 200 && /<!doctype html>/i.test(home.body) && home.body.length > 1200, home.status);
  ok('dark web: the same address always draws the same service', A.darkGen.site('abcdefghijklmnop.onion').brand === one.brand, one.brand);
  const tiers = new Set(), kinds = new Set();
  for (let i = 0; i < 40; i++) { const s = A.darkGen.site('zz' + i + 'xb.onion'); tiers.add(s.tier); kinds.add(s.kind); }
  ok('dark web: the pages are not all the same design', tiers.size >= 4 && kinds.size >= 5, [...tiers].join(',') + ' | ' + [...kinds].join(','));
  ok('dark web: the best and the worst qualities both exist', tiers.has('premium') && (tiers.has('shoddy') || tiers.has('broken')), [...tiers].join(','));
  const worst = [...Array(30).keys()].map(i => A.darkGen.site('qq' + i + 'zx.onion')).find(s => s.tier === 'broken' || s.tier === 'shoddy');
  ok('dark web: an ugly page still answers every route', !!worst && ['/', '/about', '/rules', '/pgp.txt'].every(p => worst.render(p, new URLSearchParams('')).status === 200));

  /* the government and police portals */
  const agencies = A.darkGen.agencies();
  ok('dark web: the government portals load', agencies.length === 9, agencies.length);
  ok('dark web: the CAI is among them, on its own onion', agencies.some(s => s.host === 'cai-intel.onion' && /Central Agency of Intelligence/.test(s.brand)));
  const countries = new Set(agencies.map(s => s.cc));
  ok('dark web: the portals cover several countries', countries.size >= 7, [...countries].join(','));
  const cai = A.cyberDark.find('cai-intel.onion');
  ok('dark web: the CAI page, report form and seizure notice render',
    ['/', '/report', '/wanted', '/seized', '/press', '/pgp.txt'].every(p => cai.render(p, new URLSearchParams('')).status === 200) &&
    /Report a hidden service/.test(cai.render('/', new URLSearchParams('')).body) &&
    /Submit report/.test(cai.render('/report', new URLSearchParams('')).body), cai.host);

  /* the index itself */
  ok('dark web: the index starts with the hand-written services, the portals and a page of generated ones', A.cyberDark.count() >= 50, A.cyberDark.count());
  const minted = A.cyberDark.find('a-brand-new-address-here.onion');
  ok('dark web: any .onion address is a page, even one the index never listed', !!minted && typeof minted.render === 'function');
  const grew = A.cyberDark.count();
  A.cyberDark.more(8);
  ok('dark web: the index can always mint more services', A.cyberDark.count() >= grew + 8, A.cyberDark.count());
  ok('dark web: search ranks the exact name first', /CAI/.test((A.cyberDark.search('CAI')[0] || {}).brand || ''), JSON.stringify((A.cyberDark.search('CAI')[0] || {}).brand));
  ok('dark web: search finds a service by a word in its name', A.cyberDark.search('nightfall').some(s => s.host === 'nightfall-market.onion'));
  ok('dark web: a word nothing answers to returns nothing', A.cyberDark.search('qqqzzzxxxnotaservice').length === 0);
  ok('dark web: the empty search lists everything instead of failing', A.cyberDark.search('').length >= 50);
  const all = A.cyberDark.search('');
  ok('dark web: the empty search puts the police portals near the top', all.slice(0, 30).some(s => s.gov), all.slice(0, 6).map(s => s.brand).join(' | '));

  const portal = A.cyberDark.find('darknet-index.onion');
  const search = portal.render('/', new URLSearchParams('q=market')).body;
  ok('dark web: the index search page answers with ranked results and a count', /Results for/.test(search) && /services/.test(search) && /\.onion/.test(search));
  ok('dark web: a search with no results says so and offers the next page', /Nothing matched/.test(portal.render('/', new URLSearchParams('q=qqqzzzxxxnotaservice')).body));
  ok('dark web: the index has a page that mints more services', /Another page of services/.test(portal.render('/more', new URLSearchParams('')).body));
};

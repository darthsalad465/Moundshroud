// Cyber > the Browser's network modes: Tor and the fake VPN.
// One shared piece of state, so the Browser's chrome, the moundshell and the Fake Dark Web all agree on whether you are
// on the clearnet, inside a three-hop onion circuit, behind a VPN, or both. Everything here is fiction: no socket is
// opened, no relay exists, and the addresses below are invented. It only remembers what the simulation is pretending.
(() => {
  const KEY = 'sh_net_state';
  const read = () => { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { return null; } };
  const write = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { } };

  /* a deterministic 32-bit hash, so one host or seed always draws the same circuit and the same VPN exit */
  const hash32 = s => { let h = 2166136261 >>> 0; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; } return h >>> 0; };
  const bytesOf = (seed, n) => {
    let h = hash32(seed) || 1;
    return Array.from({ length: n }, () => { h = (Math.imul(h, 1103515245) + 12345) >>> 0; return h; });
  };

  const RELAYS = [
    { cc: 'NL', city: 'Amsterdam', flag: '🇳🇱', nick: 'orionrelay', net: '185.220.' },
    { cc: 'DE', city: 'Frankfurt', flag: '🇩🇪', nick: 'krakenexit', net: '195.176.' },
    { cc: 'CH', city: 'Zürich', flag: '🇨🇭', nick: 'alpenweave', net: '45.66.' },
    { cc: 'SE', city: 'Stockholm', flag: '🇸🇪', nick: 'nordlys', net: '192.42.' },
    { cc: 'RO', city: 'Bucharest', flag: '🇷🇴', nick: 'carpathia', net: '146.70.' },
    { cc: 'US', city: 'Ashburn', flag: '🇺🇸', nick: 'blueheron', net: '23.129.' },
    { cc: 'FR', city: 'Paris', flag: '🇫🇷', nick: 'maraisnode', net: '51.15.' },
    { cc: 'JP', city: 'Tokyo', flag: '🇯🇵', nick: 'sakurahop', net: '31.13.' },
    { cc: 'SG', city: 'Singapore', flag: '🇸🇬', nick: 'straitline', net: '139.99.' },
    { cc: 'CA', city: 'Montréal', flag: '🇨🇦', nick: 'laurentide', net: '199.87.' },
    { cc: 'FI', city: 'Helsinki', flag: '🇫🇮', nick: 'pohjola', net: '95.216.' },
    { cc: 'IS', city: 'Reykjavík', flag: '🇮🇸', nick: 'lavaflow', net: '82.221.' },
    { cc: 'AT', city: 'Vienna', flag: '🇦🇹', nick: 'donauschleife', net: '185.165.' },
    { cc: 'PL', city: 'Warsaw', flag: '🇵🇱', nick: 'vistula', net: '5.172.' },
    { cc: 'BR', city: 'São Paulo', flag: '🇧🇷', nick: 'atlantico', net: '177.54.' },
    { cc: 'AU', city: 'Sydney', flag: '🇦🇺', nick: 'southerncross', net: '103.112.' }
  ];
  const PROVIDERS = [
    { id: 'gullvad', name: 'Gullvad', tag: 'no logs, no accounts, no oaths worth trusting', cc: 'SE', exit: '193.138.' },
    { id: 'norsegate', name: 'NorseGate', tag: 'a fjord between you and the bill', cc: 'NO', exit: '194.242.' },
    { id: 'privytunnel', name: 'PrivyTunnel', tag: 'the tunnel is fake, the invoice is real', cc: 'CH', exit: '185.159.' },
    { id: 'cirrusvpn', name: 'CirrusVPN', tag: 'ten thousand servers, three of them real', cc: 'US', exit: '104.28.' },
    { id: 'onionguard', name: 'OnionGuard', tag: 'onion layers on top of onion layers', cc: 'NL', exit: '89.187.' },
    { id: 'lumen', name: 'Lumen Relay', tag: 'light travels cheaper through someone else’s box', cc: 'FR', exit: '37.187.' }
  ];
  const VPN_COUNTRIES = ['SE', 'NO', 'CH', 'NL', 'DE', 'FR', 'US', 'CA', 'JP', 'SG', 'RO', 'IS'];
  const HOME_IP = '82.14.206.133';

  const state = Object.assign({ tor: false, seed: 0, home: HOME_IP, vpn: { on: false, provider: 'gullvad', cc: 'SE' } }, read() || {});
  if (!state.vpn) state.vpn = { on: false, provider: 'gullvad', cc: 'SE' };
  if (!state.seed) state.seed = (hash32(String(Date.now())) % 900000) + 100000;

  const subs = new Set();
  const tell = () => { write(); for (const fn of [...subs]) { try { fn(snapshot()); } catch (e) { } } };

  const seedOf = () => state.seed || 1;
  /* the three relays of the current circuit: a guard, a middle and an exit, all drawn from the seed */
  function hops() {
    const b = bytesOf('circuit:' + seedOf(), 12);
    const used = new Set();
    const out = [];
    for (const role of ['Guard', 'Middle', 'Exit']) {
      let i = b[out.length * 2] % RELAYS.length, guard = 0;
      while (used.has(i) && guard++ < RELAYS.length) i = (i + 1) % RELAYS.length;
      used.add(i);
      const relay = RELAYS[i];
      const ms = 24 + (b[out.length * 2 + 1] % 180);
      /* documentation-range addresses, so a reader can tell at a glance that no real relay is behind this */
      const last = 1 + (b[out.length + 6] % 254), second = (b[out.length + 3] % 250) + 1;
      out.push({
        role, cc: relay.cc, city: relay.city, flag: relay.flag,
        nick: relay.nick + (b[out.length] % 99),
        ip: relay.net + second + '.' + last,
        fp: Array.from({ length: 6 }, (_, k) => (b[(k + out.length) % b.length] % 0xffff).toString(16).toUpperCase().padStart(4, '0')).join(' '),
        ms
      });
    }
    return out;
  }
  function provider() { return PROVIDERS.find(p => p.id === state.vpn.provider) || PROVIDERS[0]; }
  function vpnIp() {
    const p = provider(), b = bytesOf('vpn:' + p.id + ':' + state.vpn.cc, 4);
    const city = { SE: 'Stockholm', NO: 'Oslo', CH: 'Zürich', NL: 'Amsterdam', DE: 'Berlin', FR: 'Paris', US: 'New York', CA: 'Toronto', JP: 'Tokyo', SG: 'Singapore', RO: 'Bucharest', IS: 'Reykjavík' }[state.vpn.cc] || 'Frankfurt';
    return { ip: p.exit + ((b[0] % 200) + 20) + '.' + ((b[1] % 240) + 10), city, cc: state.vpn.cc, provider: p };
  }
  function snapshot() {
    const h = hops(), v = vpnIp();
    return {
      tor: !!state.tor, vpn: !!state.vpn.on, hops: h, exitIp: h[2].ip, exitCc: h[2].cc,
      vpnIp: v.ip, vpnCc: v.cc, vpnCity: v.city, provider: v.provider, publicIp: state.vpn.on ? v.ip : state.tor ? h[2].ip : state.home
    };
  }

  A.tor = {
    get on() { return !!state.tor; },
    get vpn() { return { on: !!state.vpn.on, provider: provider(), ...vpnIp() }; },
    setOn(value) { const next = !!value; if (next === !!state.tor) return; state.tor = next; tell(); },
    toggle() { A.tor.setOn(!state.tor); },
    off() { A.tor.setOn(false); },
    hops,
    circuit: hops,
    exitIp: () => hops()[2].ip,
    exitCc: () => hops()[2].cc,
    newCircuit() { state.seed = (hash32('c' + Date.now() + Math.random()) % 900000) + 100000; tell(); return hops(); },
    newIdentity() { A.tor.newCircuit(); return { circuit: hops(), vpn: state.vpn.on ? vpnIp().ip : null }; },
    homeIp: () => state.home,
    vpnIp,
    publicIp: () => (state.vpn.on ? vpnIp().ip : state.tor ? hops()[2].ip : state.home),
    vpnOn(cc) { state.vpn.on = true; if (cc) state.vpn.cc = String(cc).toUpperCase(); tell(); return vpnIp(); },
    vpnOff() { state.vpn.on = false; tell(); },
    vpnToggle() { return state.vpn.on ? (A.tor.vpnOff(), false) : (A.tor.vpnOn(), true); },
    setProvider(id) { const p = PROVIDERS.find(x => x.id === String(id).toLowerCase() || x.name.toLowerCase() === String(id).toLowerCase()); if (!p) return null; state.vpn.provider = p.id; state.vpn.on = true; tell(); return vpnIp(); },
    setCountry(cc) { const up = String(cc || '').toUpperCase(); if (!VPN_COUNTRIES.includes(up)) return null; state.vpn.cc = up; state.vpn.on = true; tell(); return vpnIp(); },
    providers: () => PROVIDERS.map(p => ({ ...p })),
    countries: () => VPN_COUNTRIES.slice(),
    label: () => state.vpn.on && state.tor ? 'Tor + VPN' : state.tor ? 'Tor' : state.vpn.on ? 'VPN' : 'Clearnet',
    /* one line for a status readout, used by the Browser panel and by the moundshell */
    line: () => {
      const h = hops(), v = vpnIp();
      return state.tor
        ? 'tor: circuit up · ' + h.map(x => x.flag + ' ' + x.ip).join(' → ') + '  (exit ' + h[2].city + ')'
        : 'tor: no circuit · traffic leaves this PC directly from ' + state.home;
    },
    subscribe(fn) { subs.add(fn); try { fn(snapshot()); } catch (e) { } return () => subs.delete(fn); },
    state: snapshot,
    isOnion: host => /\.onion$/i.test(String(host || '').replace(/^https?:\/\//i, '').replace(/\/.*$/, ''))
  };
})();

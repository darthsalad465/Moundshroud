// Packet Tracer simulator, part 6: IOS configuration commands. Global config (hostname, passwords, banner, VLANs,
// static routes, DHCP pools, NAT, ACLs, users and SSH), interface config (addresses, shutdown, switchport access and
// trunk, sub-interfaces, helper addresses, port security), routing protocols (RIP, OSPF, EIGRP), lines, VLAN, DHCP and
// named ACL sub-modes. Also saving and restoring the startup configuration and reload.
(() => {
  const G = typeof window !== 'undefined' ? window : globalThis;
  const P = G.PTSim; const ip = P.ip, S = P.iosSpecs;
  Object.assign(P.iosHelp, {
    hostname: 'Set system\'s network name', secret: 'Assign the privileged level secret', password: 'Assign the password', banner: 'Define a login banner', motd: 'Set Message of the Day banner',
    interface: 'Select an interface to configure', range: 'interface range command', route: 'Establish static routes', routing: 'Enable IP routing', 'default-gateway': 'Specify default gateway (if not routing IP)',
    'domain-name': 'Define the default domain name', 'domain-lookup': 'Enable IP Domain Name System hostname translation', 'name-server': 'Specify address of name server to use', dhcp: 'Configure DHCP server and relay parameters',
    pool: 'Configure DHCP address pools', 'excluded-address': 'Prevent DHCP from assigning certain addresses', inside: 'Inside address translation', outside: 'Outside address translation', source: 'Source address translation',
    list: 'Specify access list describing local addresses', overload: 'Overload an address translation', static: 'Specify static local->global mapping', netmask: 'Specify the network mask',
    'access-list': 'Add an access list entry', permit: 'Specify packets to forward', deny: 'Specify packets to reject', remark: 'Access list entry comment', standard: 'Standard Access List', extended: 'Extended Access List',
    line: 'Configure a terminal line', console: 'Primary terminal line', con: 'Primary terminal line', vty: 'Virtual terminal', router: 'Enable a routing process', rip: 'Routing Information Protocol (RIP)', ospf: 'Open Shortest Path First (OSPF)', eigrp: 'Enhanced Interior Gateway Routing Protocol (EIGRP)',
    vlan: 'VLAN commands', service: 'Modify use of network based services', 'password-encryption': 'Encrypt system passwords', username: 'Establish User Name Authentication', crypto: 'Encryption module', key: 'Long term key operations', generate: 'Generate a key', rsa: 'Generate RSA keys',
    cdp: 'Global CDP configuration subcommands', run: 'Enable CDP', 'spanning-tree': 'Spanning Tree Subsystem', priority: 'Set the bridge priority for the spanning tree',
    address: 'Set the IP address of an interface', shutdown: 'Shutdown the selected interface', description: 'Interface specific description', switchport: 'Set switching mode characteristics', mode: 'Set trunking mode of the interface',
    access: 'Set access mode characteristics of the interface', trunk: 'Set trunking characteristics of the interface', native: 'Set trunking native characteristics when interface is in trunking mode', allowed: 'Set allowed VLAN characteristics when interface is in trunking mode',
    encapsulation: 'Set encapsulation type for an interface', dot1q: 'IEEE 802.1Q Virtual LAN', 'helper-address': 'Specify a destination address for UDP broadcasts', nat: 'NAT interface commands', 'access-group': 'Specify access control for packets', in: 'inbound packets', out: 'outbound packets',
    clock: 'Configure serial interface clock', rate: 'Configure serial interface clock speed', bandwidth: 'Set bandwidth informational parameter', cost: 'Interface cost', duplex: 'Configure duplex operation.', speed: 'Configure speed operation.',
    'port-security': 'Security related command', maximum: 'Max secure addresses', 'mac-address': 'Secure mac address', sticky: 'Configure dynamic secure addresses as sticky', violation: 'Security violation mode', nonegotiate: 'Device will not engage in negotiation protocol on this interface',
    network: 'Enable routing on an IP network', version: 'Set routing protocol version', 'auto-summary': 'Enable automatic network number summarization', 'passive-interface': 'Suppress routing updates on an interface', 'default-information': 'Control distribution of default information', originate: 'Distribute a default route', 'router-id': 'router-id for this OSPF process',
    login: 'Enable password checking', local: 'Local password checking', transport: 'Define transport protocols for line', input: 'Define which protocols to use when connecting to the terminal server', 'exec-timeout': 'Set the EXEC timeout', logging: 'Modify message logging facilities', synchronous: 'Synchronized message output', 'access-class': 'Filter connections based on an IP access list',
    name: 'Ascii name of the VLAN', 'default-router': 'Default routers', 'dns-server': 'DNS servers', ssh: 'Configure ssh options', area: 'Set the OSPF area ID', any: 'Any source host', host: 'A single host address',
  });
  const C = S.config = [], I = S.if = [], R = S.router = [], L = S.line = [], V = S.vlan = [], D = S.dhcp = [], NA = S.nacl = [];
  const all = [C, I, R, L, V, D, NA];
  all.forEach(t => { t.push(['end', s => s.ctrlZ()]); t.push(['do LINE[Exec command]', (s, v) => s.exec(v[1], 'priv')]); });
  C.push(['exit', s => { s.mode = 'priv'; s.ctx = {}; s.ln('\n%SYS-5-CONFIG_I: Configured from console by console'); }]);
  [I, R, L, V, D, NA].forEach(t => t.push(['exit', s => { s.mode = 'config'; s.ctx = {}; }]));
  const yesNo = (t, pat, fn) => { t.push([pat, (s, v) => fn(s, v, false)]); t.push(['no ' + pat, (s, v) => fn(s, v.slice(1), true)]); };
  const L3 = d => d.type === 'router' || d.model === '3560';

  /* ---------- global ---------- */
  C.push(['hostname WORD[This system\'s network name]', (s, v) => { if (!/^[A-Za-z][\w-]*$/.test(v[1])) return s.ln('% Hostname contains one or more illegal characters.'); s.d.cfg.hostname = v[1]; s.d._edited = true; }]);
  C.push(['enable secret LINE[The UNENCRYPTED (cleartext) \'enable\' secret]', (s, v) => { const pw = v[2].replace(/^0\s+/, ''); s.d.cfg.secret = { hash: P.pwHash(pw, Math.random().toString(36).slice(2, 6)) }; }]);
  C.push(['enable password LINE[The UNENCRYPTED (cleartext) \'enable\' password]', (s, v) => { s.d.cfg.enablePw = { plain: v[2] }; if (s.d.cfg.secret) s.ln('The enable password you have chosen is the same as your enable secret.\nThis is not recommended.  Re-enter the enable password.'.split('\n')[0] && ''); }]);
  C.push(['no enable secret', s => { s.d.cfg.secret = null; }]); C.push(['no enable password', s => { s.d.cfg.enablePw = null; }]);
  C.push(['banner motd LINE[c banner-text c, where \'c\' is a delimiting character]', (s, v) => {
    const t = v[2], c = t[0], rest = t.slice(1), k = rest.indexOf(c);
    if (k >= 0) { s.d.cfg.motd = rest.slice(0, k); return; }
    let buf = rest ? [rest] : []; s.ln('Enter TEXT message.  End with the character \'' + c + '\'.');
    const more = () => s.await = { prompt: '', fn: l => { const j = l.indexOf(c); if (j >= 0) { buf.push(l.slice(0, j)); s.d.cfg.motd = buf.join('\n'); } else { buf.push(l); more(); } } };
    more();
  }]);
  C.push(['no banner motd', s => { s.d.cfg.motd = null; }]);
  C.push(['service password-encryption', s => { s.d.cfg.pwEnc = true; }]); C.push(['no service password-encryption', s => { s.d.cfg.pwEnc = false; }]);
  C.push(['username WORD[User name] {secret|password} LINE[The password]', (s, v) => { s.d.cfg.users[v[1]] = v[2] === 'secret' ? { pw: { hash: P.pwHash(v[3], 'x' + v[1].slice(0, 3)) }, kind: 'secret' } : { pw: { plain: v[3] }, kind: 'password' }; }]);
  C.push(['username WORD privilege <0-15> {secret|password} LINE', (s, v) => { s.d.cfg.users[v[1]] = v[4] === 'secret' ? { pw: { hash: P.pwHash(v[5], 'x' + v[1].slice(0, 3)) }, kind: 'secret', priv: v[3] } : { pw: { plain: v[5] }, kind: 'password', priv: v[3] }; }]);
  C.push(['no username WORD', (s, v) => { delete s.d.cfg.users[v[2]]; }]);
  C.push(['ip domain-name WORD', (s, v) => { s.d.cfg.domain = v[2]; }]);
  C.push(['ip domain-lookup', s => { s.d.cfg.domainLookup = true; }]); C.push(['no ip domain-lookup', s => { s.d.cfg.domainLookup = false; }]);
  C.push(['ip name-server A.B.C.D', (s, v) => { s.d.cfg.nameServer = v[2]; }]);
  C.push(['crypto key generate rsa', s => {
    if (!s.d.cfg.domain || s.d.cfg.hostname === 'Router' || s.d.cfg.hostname === 'Switch') return s.ln('% Please define a hostname other than ' + s.d.cfg.hostname + '.'.replace(/^$/, '') + (s.d.cfg.domain ? '' : '\n% Please define a domain-name first.'));
    s.ln('The name for the keys will be: ' + s.d.cfg.hostname + '.' + s.d.cfg.domain); s.ln('Choose the size of the key modulus in the range of 360 to 4096 for your\n  General Purpose Keys. Choosing a key modulus greater than 512 may take\n  a few minutes.\n');
    s.await = { prompt: 'How many bits in the modulus [512]: ', fn: a => { const b = +a || 512; if (b < 360 || b > 4096) return s.ln('% Invalid modulus'); s.d.cfg.rsa = b; s.ln('% Generating ' + b + ' bit RSA keys, keys will be non-exportable...[OK]'); s.ln('*Mar 1 0:12:4.123: %SSH-5-ENABLED: SSH 1.99 has been enabled'); } };
  }]);
  C.push(['ip ssh version <1-2>', (s, v) => { s.d.cfg.sshVer = v[3]; }]);
  C.push(['cdp run', s => { s.d.cfg.cdp = true; }]); C.push(['no cdp run', s => { s.d.cfg.cdp = false; }]);
  C.push(['ip routing', s => { if (!L3(s.d)) throw new Error('Invalid input: this switch does not route'); s.d.cfg.ipRouting = true; }]);
  C.push(['no ip routing', s => { if (s.d.type === 'router') return s.ln('% Routers always route in this simulator.'); s.d.cfg.ipRouting = false; }]);
  C.push(['ip default-gateway A.B.C.D', (s, v) => { s.d.cfg.defaultGw = v[2]; }]); C.push(['no ip default-gateway', s => { s.d.cfg.defaultGw = null; }]);
  /* static routes */
  const addRoute = (s, net, mask, nh, iface, ad, neg) => {
    if (!ip.isMask(mask)) return s.ln('%Inconsistent address and mask');
    if (ip.net(net, mask) !== net) return s.ln('%Inconsistent address and mask');
    const rs = s.d.cfg.routes, same = r => r.net === net && r.mask === mask && (neg && nh == null && iface == null || (r.nh === (nh == null ? null : nh) && r.iface === (iface || null)));
    if (neg) { s.d.cfg.routes = rs.filter(r => !same(r)); return; }
    if (iface && !s.d.ports[iface] && !s.d.subifs[iface] && !s.d.svis[iface] && !s.d.loops[iface]) return s.ln('%Invalid interface type and number');
    if (!rs.some(same)) rs.push({ net, mask, nh: nh == null ? null : nh, iface: iface || null, ad: ad || 1 });
  };
  C.push(['ip route A.B.C.D[Destination prefix] A.B.C.D[Destination prefix mask] A.B.C.D[Forwarding router\'s address]', (s, v) => addRoute(s, v[2], v[3], v[4], null, 1)]);
  C.push(['ip route A.B.C.D A.B.C.D A.B.C.D <1-255>[Distance metric for this route]', (s, v) => addRoute(s, v[2], v[3], v[4], null, v[5])]);
  C.push(['ip route A.B.C.D A.B.C.D IF', (s, v) => addRoute(s, v[2], v[3], null, v[4], 1)]);
  C.push(['ip route A.B.C.D A.B.C.D IF <1-255>', (s, v) => addRoute(s, v[2], v[3], null, v[4], v[5])]);
  C.push(['no ip route A.B.C.D A.B.C.D A.B.C.D', (s, v) => addRoute(s, v[3], v[4], v[5], null, 1, true)]);
  C.push(['no ip route A.B.C.D A.B.C.D IF', (s, v) => addRoute(s, v[3], v[4], null, v[5], 1, true)]);
  C.push(['no ip route A.B.C.D A.B.C.D', (s, v) => addRoute(s, v[3], v[4], null, null, 1, true)]);
  /* interfaces */
  P.ifObj = (d, n) => d.ports[n] || d.subifs[n] || d.svis[n] || d.loops[n] || null;
  const enterIf = (s, name) => {
    const d = s.d; let o = P.ifObj(d, name);
    if (!o) {
      const sub = /^(.+)\.(\d+)$/.exec(name), vl = /^Vlan(\d+)$/.exec(name), lo = /^Loopback(\d+)$/.exec(name);
      if (sub && d.ports[sub[1]] && (d.type === 'router' || d.ports[sub[1]].routed) && +sub[2] > 0) o = d.subifs[name] = { name, vlan: null, native: false, ip: null, mask: null, shutdown: false, desc: '', helper: [], nat: null, aclIn: null, aclOut: null };
      else if (vl && d.type === 'switch' && +vl[1] >= 1 && +vl[1] <= 4094) { o = d.svis[name] = { name, vlan: +vl[1], ip: null, mask: null, shutdown: false, desc: '', helper: [], nat: null, aclIn: null, aclOut: null }; s.ln('%LINK-5-CHANGED: Interface ' + name + ', changed state to up'); }
      else if (lo && L3(d)) { o = d.loops[name] = { name, ip: null, mask: null, shutdown: false, desc: '', helper: [] }; s.ln('\n%LINK-5-CHANGED: Interface ' + name + ', changed state to up\n\n%LINEPROTO-5-UPDOWN: Line protocol on Interface ' + name + ', changed state to up'); }
    }
    if (!o || o.kind === 'console' || o.kind === 'rs232') return s.ln('%Invalid interface type and number');
    s.mode = d.subifs[name] ? 'subif' : 'if'; s.ctx = { ifs: [name] };
  };
  C.push(['interface IF', (s, v) => enterIf(s, v[1])]);
  C.push(['no interface IF', (s, v) => { const n = v[2], d = s.d; if (d.subifs[n]) delete d.subifs[n]; else if (d.svis[n]) delete d.svis[n]; else if (d.loops[n]) delete d.loops[n]; else s.ln('% Physical interfaces cannot be removed'); }]);
  P.ifRange = (d, txt) => {
    const out = [];
    for (const part of txt.split(',')) {
      const m = /^\s*([a-z]+)\s*((?:\d+\/)*)(\d+)\s*(?:-\s*(\d+))?\s*$/i.exec(part); if (!m) return null;
      for (let k = +m[3]; k <= +(m[4] || m[3]); k++) { const n = P.ifParse(m[1] + m[2] + k); if (!n || !d.ports[n]) return null; out.push(n); }
    }
    return out.length ? out : null;
  };
  C.push(['interface range IFR', (s, v) => { const l = P.ifRange(s.d, v[2]); if (!l) return s.ln('% Invalid interface range'); s.mode = 'ifrange'; s.ctx = { ifs: l }; }]);
  /* VLANs */
  C.push(['vlan <1-4094>[ISL VLAN IDs 1-1005]', (s, v) => { if (s.d.type !== 'switch') throw new Error('vlan'); if (!s.d.cfg.vlans[v[1]]) s.d.cfg.vlans[v[1]] = 'VLAN' + String(v[1]).padStart(4, '0'); s.mode = 'vlan'; s.ctx = { vlan: v[1] }; }]);
  C.push(['no vlan <1-4094>', (s, v) => { if (v[2] === 1 || v[2] >= 1002) return s.ln('%Default VLAN ' + v[2] + ' may not be deleted.'); delete s.d.cfg.vlans[v[2]]; }]);
  V.push(['name WORD[The ascii name for the VLAN]', (s, v) => { s.d.cfg.vlans[s.ctx.vlan] = v[1].slice(0, 32); }]);
  V.push(['no name', s => { s.d.cfg.vlans[s.ctx.vlan] = 'VLAN' + String(s.ctx.vlan).padStart(4, '0'); }]);
  C.push(['spanning-tree vlan <1-4094> priority <0-61440>', (s, v) => { if (v[4] % 4096) return s.ln('% Bridge Priority must be in increments of 4096.'); s.d.cfg.stpPri = v[4]; }]);
  C.push(['spanning-tree vlan <1-4094> root primary', s => { s.d.cfg.stpPri = 24576; }]);
  C.push(['spanning-tree mode {pvst|rapid-pvst}', (s, v) => { s.d.cfg.stpMode = v[2]; }]);
  /* lines */
  C.push(['line console <0-0>', (s) => { s.mode = 'line'; s.ctx = { line: 'con' }; }]);
  C.push(['line vty <0-15>[First Line number] <0-15>[Last Line number]', (s) => { s.mode = 'line'; s.ctx = { line: 'vty' }; }]);
  C.push(['line vty <0-15>', (s) => { s.mode = 'line'; s.ctx = { line: 'vty' }; }]);
  C.push(['line aux <0-0>', (s) => { s.mode = 'line'; s.ctx = { line: 'aux' }; }]);
  const ln = s => s.d.cfg.lines[s.ctx.line];
  L.push(['password LINE[The UNENCRYPTED (cleartext) line password]', (s, v) => { ln(s).pw = v[1].replace(/^0\s+/, ''); }]); L.push(['no password', s => { ln(s).pw = null; }]);
  L.push(['login', s => { const l = ln(s); if (!l.pw && s.ctx.line === 'con') s.ln('% Login disabled on line 0, until \'password\' is set'); l.login = true; l.local = false; }]);
  L.push(['login local', s => { ln(s).local = true; ln(s).login = true; }]); L.push(['no login', s => { ln(s).login = false; ln(s).local = false; }]);
  L.push(['transport input {telnet|ssh|all|none}', (s, v) => { ln(s).transport = v[2]; }]); L.push(['transport input telnet ssh', s => { ln(s).transport = 'all'; }]); L.push(['transport input ssh telnet', s => { ln(s).transport = 'all'; }]);
  L.push(['exec-timeout <0-35791>', (s, v) => { ln(s).tmo = [v[1], 0]; }]); L.push(['exec-timeout <0-35791> <0-2147483>', (s, v) => { ln(s).tmo = [v[1], v[2]]; }]);
  L.push(['logging synchronous', s => { ln(s).sync = true; }]); L.push(['no logging synchronous', s => { ln(s).sync = false; }]);
  L.push(['access-class WORD {in|out}', (s, v) => { ln(s).acl = v[1]; }]);
  /* routing protocols */
  C.push(['router rip', s => { if (!L3(s.d)) throw new Error('rip'); s.d.cfg.rip = s.d.cfg.rip || { ver: 1, nets: [], auto: true, passive: [], defOrig: false }; s.mode = 'router'; s.ctx = { proto: 'rip' }; }]);
  C.push(['router ospf <1-65535>[Process ID]', (s, v) => { if (!L3(s.d)) throw new Error('ospf'); s.d.cfg.ospf[v[2]] = s.d.cfg.ospf[v[2]] || { nets: [], passive: [], rid: null, defOrig: false }; s.mode = 'router'; s.ctx = { proto: 'ospf', id: v[2] }; }]);
  C.push(['router eigrp <1-65535>[Autonomous system number]', (s, v) => { if (!L3(s.d)) throw new Error('eigrp'); s.d.cfg.eigrp[v[2]] = s.d.cfg.eigrp[v[2]] || { nets: [], passive: [], auto: true }; s.mode = 'router'; s.ctx = { proto: 'eigrp', id: v[2] }; }]);
  C.push(['no router rip', s => { s.d.cfg.rip = null; }]);
  C.push(['no router ospf <1-65535>', (s, v) => { delete s.d.cfg.ospf[v[3]]; }]); C.push(['no router eigrp <1-65535>', (s, v) => { delete s.d.cfg.eigrp[v[3]]; }]);
  const rp = s => s.ctx.proto === 'rip' ? s.d.cfg.rip : s.d.cfg[s.ctx.proto][s.ctx.id];
  R.push(['network A.B.C.D[Network number]', (s, v) => {
    const r = rp(s), a = v[1];
    if (s.ctx.proto === 'ospf') return s.ln('% Incomplete command.');
    if (s.ctx.proto === 'rip') { const n = ip.classful(a).net; if (!r.nets.includes(n)) r.nets.push(n); }
    else if (!r.nets.some(x => x.ip === a && x.wild == null)) r.nets.push({ ip: ip.classful(a).net, wild: null });
  }]);
  R.push(['network A.B.C.D A.B.C.D[Wildcard bits]', (s, v) => { if (s.ctx.proto !== 'eigrp') return s.ln(s.ctx.proto === 'ospf' ? '% Incomplete command.' : '% Invalid input'); const r = rp(s); if (!r.nets.some(x => x.ip === v[1] && x.wild === v[2])) r.nets.push({ ip: v[1], wild: v[2] }); }]);
  R.push(['network A.B.C.D A.B.C.D area <0-4294967295>[OSPF area ID as a decimal value]', (s, v) => { if (s.ctx.proto !== 'ospf') return s.ln('% Invalid input'); const r = rp(s); if (!r.nets.some(x => x.ip === v[1] && x.wild === v[2])) r.nets.push({ ip: v[1], wild: v[2], area: v[4] }); }]);
  R.push(['no network A.B.C.D', (s, v) => { const r = rp(s); if (s.ctx.proto === 'rip') r.nets = r.nets.filter(n => n !== ip.classful(v[2]).net); else r.nets = r.nets.filter(n => n.ip !== v[2]); }]);
  R.push(['no network A.B.C.D A.B.C.D', (s, v) => { const r = rp(s); r.nets = r.nets.filter(n => !(n.ip === v[2] && n.wild === v[3])); }]);
  R.push(['no network A.B.C.D A.B.C.D area <0-4294967295>', (s, v) => { const r = rp(s); r.nets = r.nets.filter(n => !(n.ip === v[2] && n.wild === v[3])); }]);
  R.push(['version <1-2>', (s, v) => { if (s.ctx.proto !== 'rip') throw new Error('version'); rp(s).ver = v[1]; }]);
  yesNo(R, 'auto-summary', (s, v, neg) => { const r = rp(s); if (s.ctx.proto === 'ospf') throw new Error('auto-summary'); r.auto = !neg; });
  yesNo(R, 'passive-interface IF', (s, v, neg) => { const r = rp(s); r.passive = r.passive.filter(x => x !== v[1]); if (!neg) r.passive.push(v[1]); });
  yesNo(R, 'default-information originate', (s, v, neg) => { if (s.ctx.proto === 'eigrp') throw new Error('default-information'); rp(s).defOrig = !neg; });
  R.push(['router-id A.B.C.D[OSPF router-id in IP address format]', (s, v) => { if (s.ctx.proto !== 'ospf') throw new Error('router-id'); rp(s).rid = v[1]; s.ln('Reload or use "clear ip ospf process" command, for this to take effect'); }]);
  R.push(['no router-id', s => { if (s.ctx.proto === 'ospf') rp(s).rid = null; }]);
  R.push(['log-adjacency-changes', s => { }]);
  /* DHCP */
  C.push(['ip dhcp pool WORD[Pool name]', (s, v) => { const p = s.d.cfg.dhcp.pools; p[v[3]] = p[v[3]] || { name: v[3], net: null, mask: null, gw: null, dns: null, domain: '' }; s.mode = 'dhcp'; s.ctx = { pool: v[3] }; }]);
  C.push(['no ip dhcp pool WORD', (s, v) => { delete s.d.cfg.dhcp.pools[v[4]]; }]);
  C.push(['ip dhcp excluded-address A.B.C.D[Low IP address]', (s, v) => { s.d.cfg.dhcp.excl.push([v[3], v[3]]); }]);
  C.push(['ip dhcp excluded-address A.B.C.D A.B.C.D[High IP address]', (s, v) => { s.d.cfg.dhcp.excl.push([v[3], v[4]]); }]);
  C.push(['no ip dhcp excluded-address A.B.C.D', (s, v) => { s.d.cfg.dhcp.excl = s.d.cfg.dhcp.excl.filter(x => x[0] !== v[4]); }]);
  C.push(['no ip dhcp excluded-address A.B.C.D A.B.C.D', (s, v) => { s.d.cfg.dhcp.excl = s.d.cfg.dhcp.excl.filter(x => !(x[0] === v[4] && x[1] === v[5])); }]);
  const pool = s => s.d.cfg.dhcp.pools[s.ctx.pool];
  D.push(['network A.B.C.D[Network number in dotted-decimal notation] A.B.C.D[Network mask]', (s, v) => { pool(s).net = ip.net(v[1], v[2]); pool(s).mask = v[2]; }]);
  D.push(['default-router A.B.C.D[Router\'s IP address]', (s, v) => { pool(s).gw = v[1]; }]);
  D.push(['dns-server A.B.C.D[Server\'s IP address]', (s, v) => { pool(s).dns = v[1]; }]);
  D.push(['domain-name WORD', (s, v) => { pool(s).domain = v[1]; }]);
  /* NAT */
  C.push(['ip nat pool WORD[Pool name] A.B.C.D[Start IP address] A.B.C.D[End IP address] netmask A.B.C.D', (s, v) => { s.d.cfg.nat.pools[v[3]] = { name: v[3], start: v[4], end: v[5], mask: v[7] }; }]);
  C.push(['no ip nat pool WORD', (s, v) => { delete s.d.cfg.nat.pools[v[4]]; }]);
  const natRule = (s, r, neg) => { const rs = s.d.cfg.nat.rules, k = JSON.stringify(Object.assign({}, r, { overload: undefined })); const same = x => JSON.stringify(Object.assign({}, x, { overload: undefined })) === k; s.d.cfg.nat.rules = rs.filter(x => !same(x)); if (!neg) s.d.cfg.nat.rules.push(r); s.d.natT = s.d.natT.filter(e => !e.stat || !neg); };
  C.push(['ip nat inside source list WORD[Access list number or name] interface IF', (s, v) => natRule(s, { type: 'list', acl: v[5], iface: v[7], overload: false })]);
  C.push(['ip nat inside source list WORD interface IF overload', (s, v) => natRule(s, { type: 'list', acl: v[5], iface: v[7], overload: true })]);
  C.push(['ip nat inside source list WORD pool WORD[Name pool of global addresses]', (s, v) => natRule(s, { type: 'list', acl: v[5], pool: v[7], overload: false })]);
  C.push(['ip nat inside source list WORD pool WORD overload', (s, v) => natRule(s, { type: 'list', acl: v[5], pool: v[7], overload: true })]);
  C.push(['ip nat inside source static A.B.C.D[Inside local IP address] A.B.C.D[Inside global IP address]', (s, v) => natRule(s, { type: 'static', local: v[5], global: v[6] })]);
  C.push(['no ip nat inside source list WORD interface IF', (s, v) => natRule(s, { type: 'list', acl: v[6], iface: v[8] }, true)]);
  C.push(['no ip nat inside source list WORD interface IF overload', (s, v) => natRule(s, { type: 'list', acl: v[6], iface: v[8] }, true)]);
  C.push(['no ip nat inside source list WORD pool WORD', (s, v) => natRule(s, { type: 'list', acl: v[6], pool: v[8] }, true)]);
  C.push(['no ip nat inside source list WORD pool WORD overload', (s, v) => natRule(s, { type: 'list', acl: v[6], pool: v[8] }, true)]);
  C.push(['no ip nat inside source static A.B.C.D A.B.C.D', (s, v) => natRule(s, { type: 'static', local: v[6], global: v[7] }, true)]);

  /* ---------- access lists ---------- */
  P.parseAcl = (std, text) => {
    const t = text.trim().split(/\s+/); let k = 0; const r = {};
    const addr = () => {
      const a = (t[k] || '').toLowerCase();
      if (a === 'any') { k++; return [0, 0xffffffff]; }
      if (a === 'host') { k++; const h = ip.toInt(t[k++]); return h == null ? null : [h, 0]; }
      const h = ip.toInt(t[k]); if (h == null) return null; k++;
      const w = ip.toInt(t[k]); if (w != null) { k++; return [h, w]; }
      return std ? [h, 0] : null;
    };
    if (std) { const s = addr(); if (!s || k < t.length && !/^log$/i.test(t[k])) return { err: k }; return { std: true, src: s[0], swild: s[1] }; }
    r.proto = (t[k++] || '').toLowerCase(); if (!['ip', 'icmp', 'tcp', 'udp'].includes(r.proto)) return { err: 0 };
    const s = addr(); if (!s) return { err: k }; [r.src, r.swild] = s;
    if (/^(eq|neq|gt|lt|range)$/i.test(t[k] || '')) { k += t[k].toLowerCase() === 'range' ? 3 : 2; }
    const d = addr(); if (!d) return { err: k }; [r.dst, r.dwild] = d;
    const op = (t[k] || '').toLowerCase();
    if (/^(eq|neq|gt|lt|range)$/.test(op)) {
      if (r.proto !== 'tcp' && r.proto !== 'udp') return { err: k };
      r.op = op; k++; r.p1 = P.portNum(t[k++]); if (r.p1 == null) return { err: k - 1 };
      if (op === 'range') { r.p2 = P.portNum(t[k++]); if (r.p2 == null) return { err: k - 1 }; }
    } else if (r.proto === 'icmp' && /^(echo|echo-reply|unreachable|time-exceeded)$/.test(op)) { r.icmp = { echo: 8, 'echo-reply': 0, unreachable: 3, 'time-exceeded': 11 }[op]; r.icmpName = op; k++; }
    while (k < t.length) { const x = t[k].toLowerCase(); if (x === 'established' || x === 'log') { r[x] = true; k++; } else return { err: k }; }
    return r;
  };
  const aclAdd = (s, name, std, action, text) => {
    const r = P.parseAcl(std, text); if (r.err != null) return s.ln('% Invalid input detected in access list entry.');
    const a = s.d.cfg.acls[name] = s.d.cfg.acls[name] || { name, std, rules: [], named: !/^\d+$/.test(name) };
    if (a.std !== std) return s.ln('% Access list ' + name + ' is a ' + (a.std ? 'standard' : 'extended') + ' list.');
    r.action = action; r.text = text.trim(); r.seq = (a.rules.length ? Math.max(...a.rules.map(x => x.seq)) : 0) + 10; a.rules.push(r);
  };
  C.push(['access-list <1-99>[IP standard access list] {permit|deny} LINE[Address to match: any, host a.b.c.d, or a.b.c.d wildcard]', (s, v) => aclAdd(s, String(v[1]), true, v[2], v[3])]);
  C.push(['access-list <100-199>[IP extended access list] {permit|deny} LINE[Protocol, source, destination and options]', (s, v) => aclAdd(s, String(v[1]), false, v[2], v[3])]);
  C.push(['access-list <1-199> remark LINE', (s, v) => { const n = String(v[1]); const a = s.d.cfg.acls[n] = s.d.cfg.acls[n] || { name: n, std: v[1] < 100, rules: [], named: false }; a.rules.push({ remark: v[3], seq: (a.rules.length + 1) * 10 }); }]);
  C.push(['no access-list <1-199>', (s, v) => { delete s.d.cfg.acls[String(v[2])]; }]);
  C.push(['ip access-list {standard|extended} WORD[Access-list name]', (s, v) => { const std = v[2] === 'standard', n = v[3]; const a = s.d.cfg.acls[n]; if (a && a.std !== std) return s.ln('% A named ' + (a.std ? 'standard' : 'extended') + ' IP access list with this name already exists'); s.d.cfg.acls[n] = a || { name: n, std, rules: [], named: true }; s.mode = std ? 'nacl_std' : 'nacl_ext'; s.ctx = { acl: n }; }]);
  C.push(['no ip access-list {standard|extended} WORD', (s, v) => { delete s.d.cfg.acls[v[4]]; }]);
  NA.push(['{permit|deny} LINE[Address and options to match]', (s, v) => aclAdd(s, s.ctx.acl, s.mode === 'nacl_std', v[0], v[1])]);
  NA.push(['remark LINE', (s, v) => { const a = s.d.cfg.acls[s.ctx.acl]; a.rules.push({ remark: v[1], seq: (a.rules.length + 1) * 10 }); }]);
  NA.push(['no <1-2147483647>[Sequence number]', (s, v) => { const a = s.d.cfg.acls[s.ctx.acl]; a.rules = a.rules.filter(r => r.seq !== v[1]); }]);

  /* ---------- interface mode (applies to every interface in a range) ---------- */
  const each = fn => (s, v) => { for (const n of s.ctx.ifs) { const o = P.ifObj(s.d, n); if (o) fn(s, v, o, n); } };
  const swOnly = (s, o) => { if (!o.sw || o.routed) throw new Error('switchport'); };
  const l3Only = (s, o, n) => { if (s.d.type === 'switch' && o.sw && !o.routed) throw new Error('% Invalid input: a switch port needs "no switchport" first'); };
  I.push(['ip address A.B.C.D[IP address] A.B.C.D[IP subnet mask]', each((s, v, o, n) => {
    l3Only(s, o, n);
    if (!ip.isMask(v[3])) return s.ln('Bad mask /' + ip.len(v[3]) + ' for address ' + ip.str(v[2]));
    if (!ip.hostOk(v[2], v[3])) return s.ln('Bad mask /' + ip.len(v[3]) + ' for address ' + ip.str(v[2]));
    for (const j of s.net.l3(s.d)) if (j.name !== n && j.ip != null && ip.same(j.ip, v[2], j.mask) && s.d.type === 'router') return s.ln('% ' + ip.str(ip.net(v[2], v[3])) + ' overlaps with ' + j.name);
    if (o.vlan === null && s.d.subifs[n]) return s.ln('% Configuring IP routing on a LAN subinterface is only allowed if that subinterface is already configured as part of an IEEE 802.10, IEEE 802.1Q, or ISL vLAN.');
    o.ip = v[2]; o.mask = v[3]; s.d.arp = Object.fromEntries(Object.entries(s.d.arp));
  })]);
  I.push(['no ip address', each((s, v, o) => { o.ip = null; o.mask = null; })]);
  I.push(['shutdown', each((s, v, o, n) => { o.shutdown = true; })]);
  I.push(['no shutdown', each((s, v, o, n) => { o.shutdown = false; o.errdis = false; })]);
  I.push(['description LINE[Up to 240 characters describing this interface]', each((s, v, o) => { o.desc = v[1].slice(0, 240); })]);
  I.push(['no description', each((s, v, o) => { o.desc = ''; })]);
  I.push(['switchport mode {access|trunk}', each((s, v, o) => { swOnly(s, o); if (v[2] === 'trunk' && o.sw.encap === 'auto') return s.ln('Command rejected: An interface whose trunk encapsulation is "Auto" can not be configured to "trunk" mode.'); o.sw.mode = v[2]; })]);
  I.push(['switchport mode dynamic {auto|desirable}', each((s, v, o) => { swOnly(s, o); o.sw.mode = 'dynamic ' + v[3]; })]);
  I.push(['switchport access vlan <1-4094>[VLAN ID of the VLAN when this port is in access mode]', each((s, v, o) => { swOnly(s, o); if (!s.d.cfg.vlans[v[3]]) { s.d.cfg.vlans[v[3]] = 'VLAN' + String(v[3]).padStart(4, '0'); s.ln('% Access VLAN does not exist. Creating vlan ' + v[3]); } o.sw.vlan = v[3]; })]);
  I.push(['no switchport access vlan', each((s, v, o) => { swOnly(s, o); o.sw.vlan = 1; })]);
  I.push(['switchport trunk native vlan <1-4094>', each((s, v, o) => { swOnly(s, o); o.sw.native = v[4]; })]);
  I.push(['switchport trunk encapsulation dot1q', each((s, v, o) => { swOnly(s, o); o.sw.encap = 'dot1q'; })]);
  I.push(['switchport trunk allowed vlan LINE[all, a list such as 10,20,30-35, or add/remove/except a list]', each((s, v, o) => {
    swOnly(s, o); const t = v[4].trim().toLowerCase(), cur = o.sw.allowed || null;
    const parse = x => { const out = []; for (const p of x.split(',')) { const m = /^(\d+)(?:-(\d+))?$/.exec(p.trim()); if (!m) return null; for (let k = +m[1]; k <= +(m[2] || m[1]); k++) if (k >= 1 && k <= 4094) out.push(k); } return out; };
    const allV = () => { const a = []; for (let k = 1; k <= 4094; k++) a.push(k); return a; };
    let res;
    if (t === 'all') res = null; else if (t === 'none') res = [];
    else if (/^add /.test(t)) { const l = parse(t.slice(4)); if (!l) return s.ln('% Invalid input'); res = cur ? [...new Set(cur.concat(l))] : null; }
    else if (/^remove /.test(t)) { const l = parse(t.slice(7)); if (!l) return s.ln('% Invalid input'); res = (cur || allV()).filter(k => !l.includes(k)); }
    else if (/^except /.test(t)) { const l = parse(t.slice(7)); if (!l) return s.ln('% Invalid input'); res = allV().filter(k => !l.includes(k)); }
    else { res = parse(t); if (!res) return s.ln('% Invalid input'); }
    o.sw.allowed = res ? res.sort((a, b) => a - b) : null;
  })]);
  I.push(['switchport nonegotiate', each((s, v, o) => { swOnly(s, o); o.sw.nonego = true; })]);
  I.push(['switchport port-security', each((s, v, o) => { swOnly(s, o); if (o.sw.mode.startsWith('dynamic')) return s.ln('Command rejected: ' + o.name + ' is a dynamic port.'); o.sw.ps = o.sw.ps || { max: 1, viol: 'shutdown', sticky: false, macs: [] }; })]);
  I.push(['no switchport port-security', each((s, v, o) => { swOnly(s, o); o.sw.ps = null; })]);
  const ps = o => { o.sw.ps = o.sw.ps || { max: 1, viol: 'shutdown', sticky: false, macs: [], off: true }; return o.sw.ps; };
  I.push(['switchport port-security maximum <1-132>', each((s, v, o) => { swOnly(s, o); ps(o).max = v[3]; })]);
  I.push(['switchport port-security mac-address sticky', each((s, v, o) => { swOnly(s, o); ps(o).sticky = true; })]);
  I.push(['switchport port-security violation {shutdown|restrict|protect}', each((s, v, o) => { swOnly(s, o); ps(o).viol = v[3]; })]);
  I.push(['no switchport', each((s, v, o) => { if (s.d.model !== '3560' || !o.sw) throw new Error('switchport'); o.routed = true; })]);
  I.push(['switchport', each((s, v, o) => { if (!o.sw) throw new Error('switchport'); o.routed = false; o.ip = null; o.mask = null; })]);
  I.push(['encapsulation dot1q <1-4094>[IEEE 802.1Q VLAN ID]', each((s, v, o, n) => { if (!s.d.subifs[n]) return s.ln('% Configuring encapsulation on a physical interface is not supported here; use a sub-interface such as ' + n + '.10'); o.vlan = v[2]; o.native = false; })]);
  I.push(['encapsulation dot1q <1-4094> native', each((s, v, o, n) => { if (!s.d.subifs[n]) return; o.vlan = v[2]; o.native = true; })]);
  I.push(['ip helper-address A.B.C.D[IP destination address]', each((s, v, o) => { l3Only(s, o); o.helper = o.helper || []; if (!o.helper.includes(v[2])) o.helper.push(v[2]); })]);
  I.push(['no ip helper-address A.B.C.D', each((s, v, o) => { o.helper = (o.helper || []).filter(h => h !== v[3]); })]);
  I.push(['ip nat {inside|outside}', each((s, v, o) => { o.nat = v[2]; })]);
  I.push(['no ip nat {inside|outside}', each((s, v, o) => { o.nat = null; })]);
  I.push(['ip access-group WORD[IP access list (standard or extended)] {in|out}', each((s, v, o) => { o[v[3] === 'in' ? 'aclIn' : 'aclOut'] = v[2]; })]);
  I.push(['no ip access-group WORD {in|out}', each((s, v, o) => { o[v[4] === 'in' ? 'aclIn' : 'aclOut'] = null; })]);
  I.push(['no ip access-group {in|out}', each((s, v, o) => { o[v[3] === 'in' ? 'aclIn' : 'aclOut'] = null; })]);
  I.push(['clock rate <300-4000000>[Choose clockrate from list above]', each((s, v, o) => { if (o.kind !== 'serial') throw new Error('clock'); o.clock = v[2]; })]);
  I.push(['no clock rate', each((s, v, o) => { o.clock = null; })]);
  I.push(['bandwidth <1-10000000>[Bandwidth in kilobits]', each((s, v, o) => { o.bw = v[1]; })]); I.push(['no bandwidth', each((s, v, o) => { o.bw = null; })]);
  I.push(['ip ospf cost <1-65535>', each((s, v, o) => { o.cost = v[3]; })]); I.push(['no ip ospf cost', each((s, v, o) => { o.cost = null; })]);
  I.push(['duplex {auto|full|half}', each((s, v, o) => { o.duplex = v[1]; })]);
  I.push(['speed {10|100|1000|auto}', each((s, v, o) => { o.speed = v[1]; })]);
  I.push(['spanning-tree portfast', each((s, v, o) => { o.portfast = true; s.ln('%Warning: portfast should only be enabled on ports connected to a single\n host. Connecting hubs, concentrators, switches, bridges, etc... to this\n interface  when portfast is enabled, can cause temporary bridging loops.\n Use with CAUTION'); })]);
  I.push(['no spanning-tree portfast', each((s, v, o) => { o.portfast = false; })]);
  I.push(['interface IF', (s, v) => enterIf(s, v[1])]);

  /* ---------- startup configuration: save, restore, reload ---------- */
  const KEEP = ['ports', 'subifs', 'svis', 'loops', 'cfg'];
  P.cfgSnapshot = d => {
    const o = {}; for (const k of KEEP) o[k] = JSON.parse(JSON.stringify(d[k]));
    for (const p of Object.values(o.ports)) { delete p.link; delete p.errdis; if (p.sw && p.sw.ps) p.sw.ps.macs = (p.sw.ps.stickyMacs || []).slice(); }
    return o;
  };
  P.cfgApply = (net, d, snap, merge) => {
    const s = JSON.parse(JSON.stringify(snap));
    for (const [n, p] of Object.entries(s.ports || {})) if (d.ports[n]) { const link = d.ports[n].link, mac = d.ports[n].mac; Object.assign(d.ports[n], p, { link, mac }); }
    for (const k of ['subifs', 'svis', 'loops']) d[k] = merge ? Object.assign(d[k], s[k]) : s[k];
    d.cfg = merge ? Object.assign(d.cfg, s.cfg) : s.cfg;
    net.touch();
  };
  P.reload = (net, d) => {
    const fresh = P.createDevice({ seq: 0, uniqueName: () => d.name }, d.model, d.x, d.y, d.name);
    for (const [n, p] of Object.entries(fresh.ports)) { p.mac = d.ports[n].mac; p.link = d.ports[n].link; }
    d.ports = fresh.ports; d.subifs = fresh.subifs; d.svis = fresh.svis; d.loops = {}; d.cfg = fresh.cfg;
    d.arp = {}; d.mac = {}; d.natT = []; d.bindings = {}; d.pending = {}; d._edited = false;
    if (d.startup) P.cfgApply(net, d, d.startup, false);
    net.touch();
  };
})();

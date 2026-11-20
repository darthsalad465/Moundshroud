// Packet Tracer simulator, part 8: saving and loading topologies (JSON .mspt files) and the starter labs. Each lab
// builds a topology, lists instructions, and has activity checks that grade the work (VLANs and router-on-a-stick,
// basic device security, static routes, OSPF, server DHCP/DNS/HTTP, and PAT to the internet).
(() => {
  const G = typeof window !== 'undefined' ? window : globalThis;
  const P = G.PTSim; const ip = P.ip;

  /* ---------- save and load ---------- */
  const SKIP = new Set(['arp', 'mac', 'pending', 'natT', 'arpWait', 'aclHits']);
  P.save = (net, extra) => JSON.stringify(Object.assign({ format: 'moundshroud-packet-tracer', version: 1, seq: net.seq, devs: net.devs, links: Object.fromEntries(Object.entries(net.links).filter(([, L]) => L.type !== 'wireless')), notes: net.notes }, extra || {}), function (k, v) { return (k && (k[0] === '_' || (SKIP.has(k) && this && this.ports && this.model))) ? undefined : v; });
  P.load = text => {
    const o = typeof text === 'string' ? JSON.parse(text) : text;
    if (!o || o.format !== 'moundshroud-packet-tracer' || !o.devs) throw new Error('This is not a Packet Tracer topology saved by Moundshroud.');
    const n = new P.Net(); n.seq = o.seq || 0; n.notes = o.notes || []; n.lab = o.lab || null;
    for (const d of Object.values(o.devs)) { if (!P.MODELS[d.model]) continue; Object.assign(d, { arp: {}, mac: {}, pending: {}, natT: [] }); d.bindings = d.bindings || {}; for (const p of Object.values(d.ports)) if (p.link && !(o.links || {})[p.link]) p.link = null; n.devs[d.id] = d; }
    for (const L of Object.values(o.links || {})) if (n.devs[L.a.dev] && n.devs[L.b.dev]) n.links[L.id] = L;
    n.touch(); return n;
  };
  P.clone = net => P.load(P.save(net));

  /* run pings on a copy so a check never disturbs the live network */
  P.canPing = (net, from, to) => {
    const n = P.clone(net), d = n.byName(from); if (!d) return false;
    const dst = ip.toInt(to) != null ? ip.toInt(to) : (n.byName(to) && P.primaryIp(n, n.byName(to))); if (dst == null) return false;
    let last = '';
    for (let k = 0; k < 3; k++) { last = ''; n.ping(d, dst, { count: 3, onReply: r => { last += r.ok ? '!' : '.'; } }); n.runAll(); }
    return last === '!!!';
  };
  P.checkLab = (lab, net) => { const items = lab.checks.map(([label, fn]) => { let okk = false; try { okk = !!fn(net); } catch (e) { okk = false; } return { label, ok: okk }; }); return { items, done: items.filter(i => i.ok).length }; };

  /* helpers for building labs */
  const mk = () => new P.Net();
  const host = (n, d, a, m, g, dns) => { const p = d.ports.FastEthernet0; p.ip = ip.toInt(a); p.mask = ip.toInt(m); d.host.gw = g ? ip.toInt(g) : null; d.host.dns = dns ? ip.toInt(dns) : null; n.touch(); };
  const dev = (n, name) => n.byName(name);
  const port = (n, name, p) => dev(n, name).ports[p];
  const run = (n, name, lines, cli) => cli(n, dev(n, name), lines);
  const route = (n, name, code, pfx) => P.table(n, dev(n, name)).some(r => r.code.startsWith(code) && ip.str(r.net) + '/' + r.len === pfx);

  P.LABS = [
    {
      id: 'vlans', title: 'Two VLANs and a router on a stick', level: 'Beginner',
      intro: '<p>Sales (VLAN 10) and Engineering (VLAN 20) share switch <b>S1</b>. Router <b>R1</b> routes between them over one trunk.</p><ol><li>On S1 create <code>vlan 10</code> named Sales and <code>vlan 20</code> named Eng.</li><li>Put Fa0/1 in VLAN 10 and Fa0/2 to Fa0/3 in VLAN 20 as access ports.</li><li>Make Gig0/1 a trunk (<code>switchport mode trunk</code>).</li><li>On R1 bring up Gig0/0, then add sub-interfaces <code>g0/0.10</code> (<code>encapsulation dot1q 10</code>, 192.168.10.1/24) and <code>g0/0.20</code> (VLAN 20, 192.168.20.1/24).</li><li>From PC0, ping 192.168.20.10.</li></ol>',
      build() {
        const n = mk(), R = n.add('2911', 420, 70, 'R1'), S = n.add('2960', 420, 230, 'S1'), a = n.add('PC', 220, 400, 'PC0'), b = n.add('PC', 420, 400, 'PC1'), c = n.add('Laptop', 620, 400, 'Laptop0');
        n.link(S.id, 'GigabitEthernet0/1', R.id, 'GigabitEthernet0/0'); n.link(a.id, 'FastEthernet0', S.id, 'FastEthernet0/1'); n.link(b.id, 'FastEthernet0', S.id, 'FastEthernet0/2'); n.link(c.id, 'FastEthernet0', S.id, 'FastEthernet0/3');
        host(n, a, '192.168.10.10', '255.255.255.0', '192.168.10.1'); host(n, b, '192.168.20.10', '255.255.255.0', '192.168.20.1'); host(n, c, '192.168.20.11', '255.255.255.0', '192.168.20.1');
        R.cfg.hostname = 'R1'; S.cfg.hostname = 'S1'; n.lab = 'vlans'; return n;
      },
      checks: [
        ['S1 has VLAN 10 and VLAN 20', n => { const v = dev(n, 'S1').cfg.vlans; return !!(v[10] && v[20]); }],
        ['Fa0/1 is an access port in VLAN 10', n => { const p = port(n, 'S1', 'FastEthernet0/1').sw; return p.mode === 'access' && p.vlan === 10; }],
        ['Fa0/2 and Fa0/3 are access ports in VLAN 20', n => ['FastEthernet0/2', 'FastEthernet0/3'].every(x => { const p = port(n, 'S1', x).sw; return p.mode === 'access' && p.vlan === 20; })],
        ['Gig0/1 on S1 is trunking', n => n.isTrunk(dev(n, 'S1'), 'GigabitEthernet0/1')],
        ['R1 Gig0/0 is up', n => n.portUp(dev(n, 'R1'), 'GigabitEthernet0/0')],
        ['R1 g0/0.10 uses VLAN 10 with 192.168.10.1/24', n => { const s = dev(n, 'R1').subifs['GigabitEthernet0/0.10']; return s && s.vlan === 10 && ip.str(s.ip) === '192.168.10.1' && ip.len(s.mask) === 24; }],
        ['R1 g0/0.20 uses VLAN 20 with 192.168.20.1/24', n => { const s = dev(n, 'R1').subifs['GigabitEthernet0/0.20']; return s && s.vlan === 20 && ip.str(s.ip) === '192.168.20.1' && ip.len(s.mask) === 24; }],
        ['PC0 (VLAN 10) can ping PC1 (VLAN 20)', n => P.canPing(n, 'PC0', '192.168.20.10')],
        ['PC1 and Laptop0 reach each other inside VLAN 20', n => P.canPing(n, 'PC1', '192.168.20.11')],
      ],
      solve(n, cli) {
        run(n, 'S1', ['en', 'conf t', 'vlan 10', 'name Sales', 'vlan 20', 'name Eng', 'int fa0/1', 'switchport mode access', 'switchport access vlan 10', 'int range fa0/2 - 3', 'switchport mode access', 'switchport access vlan 20', 'int g0/1', 'switchport mode trunk', 'end'], cli);
        run(n, 'R1', ['en', 'conf t', 'int g0/0', 'no shut', 'int g0/0.10', 'encapsulation dot1q 10', 'ip address 192.168.10.1 255.255.255.0', 'int g0/0.20', 'encapsulation dot1q 20', 'ip address 192.168.20.1 255.255.255.0', 'end'], cli);
      },
    },
    {
      id: 'basic', title: 'Secure a new router', level: 'Beginner',
      intro: '<p>Use the console cable from <b>Admin PC</b> (Desktop › Terminal) or the CLI tab of the router.</p><ol><li>Name the router <b>HQ</b>.</li><li>Set <code>enable secret class</code>.</li><li>Protect the console: <code>line con 0</code>, <code>password cisco</code>, <code>login</code>.</li><li>Protect telnet: <code>line vty 0 4</code>, <code>password cisco</code>, <code>login</code>.</li><li>Encrypt plain passwords with <code>service password-encryption</code>.</li><li>Add a <code>banner motd</code>.</li><li>Give Gig0/0 the address 10.0.0.1/24 and bring it up.</li><li>Save with <code>copy running-config startup-config</code>.</li></ol>',
      build() { const n = mk(), R = n.add('1941', 420, 140, 'Router0'), P2 = n.add('PC', 220, 330, 'Admin PC'), S = n.add('2960', 620, 230, 'Switch0'), L = n.add('PC', 620, 400, 'PC1'); n.link(P2.id, 'RS 232', R.id, 'Console', 'console'); n.link(R.id, 'GigabitEthernet0/0', S.id, 'GigabitEthernet0/1'); n.link(L.id, 'FastEthernet0', S.id, 'FastEthernet0/1'); host(n, L, '10.0.0.10', '255.255.255.0', '10.0.0.1'); n.lab = 'basic'; return n; },
      checks: [
        ['Hostname is HQ', n => !!n.byName('HQ') && n.byName('HQ').type === 'router'],
        ['enable secret is set', n => !!dev(n, 'HQ').cfg.secret],
        ['Console line has a password and login', n => { const l = dev(n, 'HQ').cfg.lines.con; return !!l.pw && l.login; }],
        ['VTY lines have a password and login', n => { const l = dev(n, 'HQ').cfg.lines.vty; return (!!l.pw && l.login) || l.local; }],
        ['service password-encryption is on', n => dev(n, 'HQ').cfg.pwEnc],
        ['A message-of-the-day banner is set', n => !!dev(n, 'HQ').cfg.motd],
        ['PC1 can ping 10.0.0.1', n => P.canPing(n, 'PC1', '10.0.0.1')],
        ['The configuration is saved to NVRAM', n => { const d = dev(n, 'HQ'); return !!d.startup && d.startup.cfg.hostname === 'HQ'; }],
      ],
    },
    {
      id: 'static', title: 'Static routes over a serial link', level: 'Intermediate',
      intro: '<p>Two branch routers join over a serial WAN link. Every interface address is set; the routers only know their own networks.</p><ol><li>On <b>West</b> add a route to 192.168.2.0/24 via 10.0.0.2.</li><li>On <b>East</b> add a default route via 10.0.0.1.</li><li>Check with <code>show ip route</code>, then ping PC-B from PC-A.</li></ol>',
      build() {
        const n = mk(), W = n.add('1941', 260, 140, 'West'), E = n.add('1941', 600, 140, 'East'), a = n.add('PC', 160, 360, 'PC-A'), b = n.add('PC', 700, 360, 'PC-B');
        n.link(W.id, 'Serial0/0/0', E.id, 'Serial0/0/0', 'serial'); n.link(a.id, 'FastEthernet0', W.id, 'GigabitEthernet0/0', 'cross'); n.link(b.id, 'FastEthernet0', E.id, 'GigabitEthernet0/0', 'cross');
        const cf = (d, nm, l, s) => { d.cfg.hostname = nm; const g = d.ports['GigabitEthernet0/0'], se = d.ports['Serial0/0/0']; g.ip = ip.toInt(l); g.mask = ip.toInt('255.255.255.0'); g.shutdown = false; se.ip = ip.toInt(s); se.mask = ip.toInt('255.255.255.252'); se.shutdown = false; };
        cf(W, 'West', '192.168.1.1', '10.0.0.1'); W.ports['Serial0/0/0'].clock = 64000; cf(E, 'East', '192.168.2.1', '10.0.0.2');
        host(n, a, '192.168.1.10', '255.255.255.0', '192.168.1.1'); host(n, b, '192.168.2.10', '255.255.255.0', '192.168.2.1'); n.lab = 'static'; return n;
      },
      checks: [
        ['The serial link is up', n => n.portUp(dev(n, 'West'), 'Serial0/0/0')],
        ['West has a static route to 192.168.2.0/24', n => route(n, 'West', 'S', '192.168.2.0/24') || route(n, 'West', 'S*', '0.0.0.0/0')],
        ['East has a default route', n => route(n, 'East', 'S*', '0.0.0.0/0')],
        ['PC-A can ping PC-B', n => P.canPing(n, 'PC-A', '192.168.2.10')],
      ],
    },
    {
      id: 'ospf', title: 'Single-area OSPF triangle', level: 'Intermediate',
      intro: '<p>Three routers are wired in a triangle and addressed. Turn on OSPF so every LAN can reach every other.</p><ol><li>On each router: <code>router ospf 1</code>.</li><li>Advertise its networks in area 0, for example <code>network 10.0.0.0 0.255.255.255 area 0</code> and <code>network 192.168.0.0 0.0.255.255 area 0</code>.</li><li>Give each router a router-id (1.1.1.1, 2.2.2.2, 3.3.3.3).</li><li>Make the LAN interfaces passive.</li><li>Check <code>show ip ospf neighbor</code> and ping across.</li></ol>',
      build() {
        const n = mk(), r = [n.add('2911', 420, 60, 'R1'), n.add('2911', 220, 280, 'R2'), n.add('2911', 620, 280, 'R3')], pcs = [n.add('PC', 420, -80 + 230, 'PC1'), n.add('PC', 80, 420, 'PC2'), n.add('PC', 760, 420, 'PC3')];
        pcs[0].y = 0; r[0].y = 130;
        const addr = (d, p, a, m) => { const x = d.ports[p]; x.ip = ip.toInt(a); x.mask = ip.toInt(m); x.shutdown = false; };
        n.link(r[0].id, 'GigabitEthernet0/1', r[1].id, 'GigabitEthernet0/1'); n.link(r[1].id, 'GigabitEthernet0/2', r[2].id, 'GigabitEthernet0/2'); n.link(r[2].id, 'GigabitEthernet0/1', r[0].id, 'GigabitEthernet0/2');
        addr(r[0], 'GigabitEthernet0/1', '10.0.12.1', '255.255.255.0'); addr(r[1], 'GigabitEthernet0/1', '10.0.12.2', '255.255.255.0');
        addr(r[1], 'GigabitEthernet0/2', '10.0.23.2', '255.255.255.0'); addr(r[2], 'GigabitEthernet0/2', '10.0.23.3', '255.255.255.0');
        addr(r[2], 'GigabitEthernet0/1', '10.0.13.3', '255.255.255.0'); addr(r[0], 'GigabitEthernet0/2', '10.0.13.1', '255.255.255.0');
        r.forEach((d, k) => { d.cfg.hostname = 'R' + (k + 1); n.link(pcs[k].id, 'FastEthernet0', d.id, 'GigabitEthernet0/0', 'cross'); addr(d, 'GigabitEthernet0/0', '192.168.' + (k + 1) + '.1', '255.255.255.0'); host(n, pcs[k], '192.168.' + (k + 1) + '.10', '255.255.255.0', '192.168.' + (k + 1) + '.1'); });
        n.lab = 'ospf'; return n;
      },
      checks: [
        ['R1 has two OSPF neighbours', n => ((n.state().nbr || {})[dev(n, 'R1').id] || []).filter(x => x.proto === 'ospf').length >= 2],
        ['Router-ids are 1.1.1.1, 2.2.2.2 and 3.3.3.3', n => ['R1', 'R2', 'R3'].every((r, k) => Object.values(dev(n, r).cfg.ospf).some(o => o.rid === ip.toInt((k + 1) + '.' + (k + 1) + '.' + (k + 1) + '.' + (k + 1))))],
        ['R1 learns 192.168.3.0/24 by OSPF', n => route(n, 'R1', 'O', '192.168.3.0/24')],
        ['LAN interfaces are passive', n => ['R1', 'R2', 'R3'].every(r => Object.values(dev(n, r).cfg.ospf).some(o => o.passive.includes('GigabitEthernet0/0')))],
        ['PC1 can ping PC3', n => P.canPing(n, 'PC1', '192.168.3.10')],
        ['PC2 can ping PC3', n => P.canPing(n, 'PC2', '192.168.3.10')],
      ],
    },
    {
      id: 'services', title: 'Server DHCP, DNS and web', level: 'Beginner',
      intro: '<p>The server <b>Srv</b> (192.168.1.2) will hand out addresses, answer names and host a web page.</p><ol><li>Srv › Services › DHCP: turn it on, set gateway 192.168.1.1, DNS 192.168.1.2, start 192.168.1.100.</li><li>Srv › Services › DNS: turn it on and add an A record <b>www.lab.local</b> → 192.168.1.2.</li><li>On each PC choose DHCP in Desktop › IP Configuration.</li><li>Open Desktop › Web Browser and go to www.lab.local.</li></ol>',
      build() {
        const n = mk(), S = n.add('2960', 420, 200, 'Switch0'), V = n.add('Server', 420, 50, 'Srv'), a = n.add('PC', 240, 380, 'PC0'), b = n.add('Laptop', 600, 380, 'Laptop0'), R = n.add('1941', 700, 140, 'Gateway');
        n.link(V.id, 'FastEthernet0', S.id, 'FastEthernet0/24'); n.link(a.id, 'FastEthernet0', S.id, 'FastEthernet0/1'); n.link(b.id, 'FastEthernet0', S.id, 'FastEthernet0/2'); n.link(R.id, 'GigabitEthernet0/0', S.id, 'GigabitEthernet0/1');
        host(n, V, '192.168.1.2', '255.255.255.0', '192.168.1.1'); const g = R.ports['GigabitEthernet0/0']; g.ip = ip.toInt('192.168.1.1'); g.mask = ip.toInt('255.255.255.0'); g.shutdown = false; R.cfg.hostname = 'Gateway';
        V.svc.dhcp.pools.push({ name: 'serverPool', gw: 0, dns: 0, start: ip.toInt('192.168.1.100'), mask: ip.toInt('255.255.255.0'), max: 50 });
        n.lab = 'services'; return n;
      },
      checks: [
        ['DHCP service is on with gateway 192.168.1.1', n => { const v = dev(n, 'Srv').svc.dhcp; return v.on && v.pools.some(p => ip.str(p.gw) === '192.168.1.1'); }],
        ['DNS has an A record for www.lab.local', n => { const v = dev(n, 'Srv').svc.dns; return v.on && v.recs.some(r => r.name.toLowerCase() === 'www.lab.local' && r.type === 'A' && r.val === '192.168.1.2'); }],
        ['PC0 got a 192.168.1.x address by DHCP', n => { const d = dev(n, 'PC0'); return d.host.dhcp && d.ports.FastEthernet0.ip != null && ip.same(d.ports.FastEthernet0.ip, ip.toInt('192.168.1.0'), ip.toInt('255.255.255.0')); }],
        ['Laptop0 got its address by DHCP', n => { const d = dev(n, 'Laptop0'); return d.host.dhcp && d.ports.FastEthernet0.ip != null && ip.same(d.ports.FastEthernet0.ip, ip.toInt('192.168.1.0'), ip.toInt('255.255.255.0')); }],
        ['PC0 loads http://www.lab.local', n => { const c = P.clone(n); let ok2 = false; for (let k = 0; k < 2 && !ok2; k++) { c.http(c.byName('PC0'), 'www.lab.local', r => { ok2 = r.ok && r.status === 200; }); c.runAll(); } return ok2; }],
      ],
    },
    {
      id: 'nat', title: 'PAT to the internet', level: 'Advanced',
      intro: '<p><b>Edge</b> connects the office to the ISP. The ISP has no route to 192.168.0.0/16, so traffic must be translated.</p><ol><li><code>access-list 1 permit 192.168.10.0 0.0.0.255</code></li><li>Mark Gig0/0 <code>ip nat inside</code> and Gig0/1 <code>ip nat outside</code>.</li><li><code>ip nat inside source list 1 interface g0/1 overload</code></li><li>Add a default route to the ISP: <code>ip route 0.0.0.0 0.0.0.0 203.0.113.1</code>.</li><li>Ping 8.8.8.8 from Office PC and look at <code>show ip nat translations</code>.</li></ol>',
      build() {
        const n = mk(), E = n.add('1941', 330, 200, 'Edge'), I = n.add('2911', 600, 200, 'ISP'), C = n.add('Cloud', 600, 60, 'Internet'), V = n.add('Server', 800, 60, 'DNS-8.8.8.8'), S = n.add('2960', 130, 200, 'Office-SW'), a = n.add('PC', 130, 380, 'Office PC');
        n.link(E.id, 'GigabitEthernet0/1', I.id, 'GigabitEthernet0/1'); n.link(I.id, 'GigabitEthernet0/0', C.id, 'Ethernet0', 'straight'); n.link(C.id, 'Ethernet1', V.id, 'FastEthernet0', 'straight'); n.link(S.id, 'GigabitEthernet0/1', E.id, 'GigabitEthernet0/0'); n.link(a.id, 'FastEthernet0', S.id, 'FastEthernet0/1');
        const addr = (d, p, x, m) => { const q = d.ports[p]; q.ip = ip.toInt(x); q.mask = ip.toInt(m); q.shutdown = false; };
        addr(E, 'GigabitEthernet0/0', '192.168.10.1', '255.255.255.0'); addr(E, 'GigabitEthernet0/1', '203.0.113.2', '255.255.255.252'); addr(I, 'GigabitEthernet0/1', '203.0.113.1', '255.255.255.252'); addr(I, 'GigabitEthernet0/0', '8.8.8.1', '255.255.255.0');
        E.cfg.hostname = 'Edge'; I.cfg.hostname = 'ISP'; host(n, a, '192.168.10.10', '255.255.255.0', '192.168.10.1'); host(n, V, '8.8.8.8', '255.255.255.0', '8.8.8.1');
        n.lab = 'nat'; return n;
      },
      checks: [
        ['Gig0/0 is NAT inside and Gig0/1 is NAT outside', n => { const d = dev(n, 'Edge'); return d.ports['GigabitEthernet0/0'].nat === 'inside' && d.ports['GigabitEthernet0/1'].nat === 'outside'; }],
        ['Access list 1 permits the office LAN', n => { const a = dev(n, 'Edge').cfg.acls['1']; return a && a.rules.some(r => r.action === 'permit' && P.aclMatch(r, { src: ip.toInt('192.168.10.10') })); }],
        ['PAT overloads Gig0/1', n => dev(n, 'Edge').cfg.nat.rules.some(r => r.type === 'list' && r.overload && r.iface === 'GigabitEthernet0/1')],
        ['Edge has a default route', n => route(n, 'Edge', 'S*', '0.0.0.0/0')],
        ['Office PC can ping 8.8.8.8', n => P.canPing(n, 'Office PC', '8.8.8.8')],
      ],
    },
  ];
})();

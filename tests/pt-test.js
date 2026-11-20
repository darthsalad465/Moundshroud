// Packet Tracer simulator: the IOS command parser (modes, abbreviations, help, completion, errors) and the packet
// logic (switching, VLANs and trunks, router-on-a-stick, static and dynamic routing, DHCP, DNS, HTTP, NAT, ACLs,
// spanning tree, saving, reload and Simulation mode events). Loads the browser files straight into node.
const path = require('path');
module.exports = async ok => {
  const dir = path.join(__dirname, '..', 'web', 'js');
  for (const f of ['pt-net', 'pt-route', 'pt-packet', 'pt-apps', 'pt-ios', 'pt-ios-cfg', 'pt-ios-show', 'pt-labs']) require(path.join(dir, f + '.js'));
  const P = globalThis.PTSim, ip = P.ip;
  const cli = (net, d, lines) => { let out = ''; const s = d._s || (d._s = new P.IOS(net, d, { out: t => { out += t; } })); s.opts.out = t => { out += t; }; for (const l of [].concat(lines)) s.input(l); net.runAll(); return out; };
  const pcIp = (net, d, a, m, g) => { const p = d.ports.FastEthernet0; p.ip = ip.toInt(a); p.mask = ip.toInt(m); d.host.gw = g ? ip.toInt(g) : null; net.touch(); };
  const ping = (net, d, dst) => { let r = ''; net.ping(d, ip.toInt(dst), { onReply: x => { r += x.ok ? '!' : '.'; } }); net.runAll(); return r; };

  /* ---------- IP helpers ---------- */
  ok('pt: masks and prefix lengths convert both ways', ip.len('255.255.255.0') === 24 && ip.str(ip.mask(26)) === '255.255.255.192' && ip.isMask('255.255.0.0') && !ip.isMask('255.0.255.0'));
  ok('pt: wildcard matching works like an ACL', ip.wildMatch(ip.toInt('10.1.5.9'), ip.toInt('10.1.0.0'), ip.toInt('0.0.255.255')) && !ip.wildMatch(ip.toInt('10.2.0.1'), ip.toInt('10.1.0.0'), ip.toInt('0.0.255.255')));
  ok('pt: interface names expand and shorten', P.ifParse('g0/0') === 'GigabitEthernet0/0' && P.ifParse('fa0/1') === 'FastEthernet0/1' && P.ifParse('gig0/0.10') === 'GigabitEthernet0/0.10' && P.ifShort('FastEthernet0/24') === 'Fa0/24' && P.ifParse('xyz0/1') === null);

  /* ---------- the IOS parser ---------- */
  {
    const n = new P.Net(), r = n.add('2911', 0, 0), s = new P.IOS(n, r, { out: () => { } });
    let out = ''; s.opts.out = t => { out += t; };
    ok('pt: a new router starts in user EXEC with the > prompt', s.promptText() === 'Router>');
    s.input('en'); ok('pt: "en" is enough for enable and gives the # prompt', s.promptText() === 'Router#');
    s.input('conf t'); ok('pt: "conf t" enters global configuration', s.promptText() === 'Router(config)#');
    s.input('host R1'); ok('pt: hostname changes the prompt', s.promptText() === 'R1(config)#');
    s.input('int g0/0'); ok('pt: "int g0/0" enters interface mode', s.promptText() === 'R1(config-if)#' && s.ctx.ifs[0] === 'GigabitEthernet0/0');
    s.input('router ospf 1'); ok('pt: a global command typed in a sub-mode moves to that mode', s.promptText() === 'R1(config-router)#');
    s.input('line con 0'); ok('pt: line mode prompt', s.promptText() === 'R1(config-line)#');
    s.input('int g0/0.10'); ok('pt: a sub-interface has its own prompt', s.promptText() === 'R1(config-subif)#' && !!r.subifs['GigabitEthernet0/0.10']);
    s.input('ip dhcp pool LAN'); ok('pt: DHCP pool mode prompt', s.promptText() === 'R1(dhcp-config)#');
    s.input('ip access-list extended WEB'); ok('pt: named extended ACL prompt', s.promptText() === 'R1(config-ext-nacl)#');
    s.input('end'); ok('pt: end returns to privileged EXEC', s.promptText() === 'R1#');
    out = ''; s.input('s'); ok('pt: an ambiguous abbreviation is reported', /% Ambiguous command: "s"/.test(out), out);
    out = ''; s.input('show ip intrface brief'); ok('pt: a bad word gets the ^ marker and Invalid input', /\^\n% Invalid input detected at '\^' marker\./.test(out) && out.indexOf('^') === 'R1#show ip '.length, JSON.stringify(out));
    out = ''; s.input('show ip'); ok('pt: a cut-short command says Incomplete', /% Incomplete command\./.test(out), out);
    out = ''; s.input('sh ip int br'); ok('pt: "sh ip int br" prints the interface table', /^Interface\s+IP-Address\s+OK\? Method Status\s+Protocol/.test(out) && /GigabitEthernet0\/0\s+unassigned\s+YES unset\s+administratively down\s+down/.test(out), out);
    ok('pt: ? lists the next words with help', /running-config\s+Current operating configuration/.test(s.help('show ')) && /<cr>/.test(s.help('show version ')));
    ok('pt: a partial word with ? lists the matching commands', s.help('sh') === 'show' && /configure/.test(s.help('co')) && /copy/.test(s.help('co')));
    ok('pt: Tab completes a unique keyword', s.complete('conf') === 'configure ' && s.complete('show runn') === 'show running-config ' && s.complete('c') === 'c');
    s.input('disable'); out = ''; s.input('show running-config'); ok('pt: show running-config is not offered in user EXEC', /Invalid input/.test(out));
    s.input('enable'); s.input('configure terminal'); s.input('enable secret class'); s.input('end'); s.input('disable'); s.input('enable');
    ok('pt: enable secret makes enable ask for a password', s.promptText() === 'Password: ' && s.secret());
    s.input('wrong'); ok('pt: a wrong password asks again', s.promptText() === 'Password: '); s.input('class'); ok('pt: the right secret gives privileged EXEC', s.promptText() === 'R1#');
    out = ''; s.input('show run'); ok('pt: the secret is stored hashed in the running config', /enable secret 5 \$1\$/.test(out) && !/class/.test(out.split('enable secret')[1].split('\n')[0]));
    out = ''; s.input('foo'); ok('pt: an unknown word in EXEC triggers the famous domain lookup', /Translating "foo"\.\.\.domain server \(255\.255\.255\.255\)/.test(out));
    s.input('conf t'); s.input('banner motd #Authorized access only#'); s.input('service password-encryption'); s.input('line con 0'); s.input('password cisco'); s.input('login'); s.input('end');
    out = ''; s.input('show run'); ok('pt: banner, type 7 line password and login appear in the config', /banner motd \^CAuthorized access only\^C/.test(out) && /line con 0\n password 7 [0-9A-F]+\n login/.test(out), out.slice(-300));
    s.input('conf t'); s.input('interface range g0/0 - 1'); ok('pt: interface range mode', s.promptText() === 'R1(config-if-range)#' && s.ctx.ifs.length === 2); s.input('no shut'); s.input('end');
    ok('pt: no shutdown applies to every interface in the range', !r.ports['GigabitEthernet0/0'].shutdown && !r.ports['GigabitEthernet0/1'].shutdown);
  }

  /* ---------- two VLANs and a router on a stick, built entirely from the CLI ---------- */
  const lab = () => {
    const n = new P.Net(), R = n.add('2911', 0, 0), S = n.add('2960', 0, 0), A = n.add('PC', 0, 0), B = n.add('PC', 0, 0), C = n.add('PC', 0, 0);
    n.link(A.id, 'FastEthernet0', S.id, 'FastEthernet0/1', 'auto'); n.link(B.id, 'FastEthernet0', S.id, 'FastEthernet0/2', 'auto'); n.link(C.id, 'FastEthernet0', S.id, 'FastEthernet0/3', 'auto');
    n.link(S.id, 'GigabitEthernet0/1', R.id, 'GigabitEthernet0/0', 'auto');
    cli(n, S, ['en', 'conf t', 'hostname S1', 'vlan 10', 'name Sales', 'vlan 20', 'name Eng', 'int fa0/1', 'sw mode acc', 'sw acc vlan 10', 'int range fa0/2 - 3', 'switchport mode access', 'switchport access vlan 20', 'int g0/1', 'switchport mode trunk', 'end']);
    cli(n, R, ['en', 'conf t', 'hostname R1', 'int g0/0', 'no shut', 'int g0/0.10', 'encapsulation dot1q 10', 'ip add 192.168.10.1 255.255.255.0', 'int g0/0.20', 'encapsulation dot1q 20', 'ip address 192.168.20.1 255.255.255.0', 'end']);
    pcIp(n, A, '192.168.10.10', '255.255.255.0', '192.168.10.1'); pcIp(n, B, '192.168.20.10', '255.255.255.0', '192.168.20.1'); pcIp(n, C, '192.168.20.11', '255.255.255.0', '192.168.20.1');
    return { n, R, S, A, B, C };
  };
  {
    const { n, R, S, A, B, C } = lab();
    const vb = cli(n, S, 'show vlan brief');
    ok('pt: show vlan brief lists the new VLANs and their ports', /10\s+Sales\s+active\s+Fa0\/1/.test(vb) && /20\s+Eng\s+active\s+Fa0\/2, Fa0\/3/.test(vb), vb);
    ok('pt: the uplink is a trunk', n.isTrunk(S, 'GigabitEthernet0/1') && /Gig0\/1\s+on\s+802\.1q\s+trunking\s+1/.test(cli(n, S, 'show interfaces trunk')));
    ok('pt: hosts in the same VLAN reach each other', ping(n, B, '192.168.20.11') === '!!!!');
    ok('pt: a host reaches its sub-interface gateway', ping(n, A, '192.168.10.1') === '!!!!');
    const first = ping(n, A, '192.168.20.10');
    ok('pt: inter-VLAN ping works through the router on a stick (first one lost to ARP, like real IOS)', /^[.!]!!!$/.test(first), first);
    ok('pt: and the second ping is clean', ping(n, A, '192.168.20.10') === '!!!!');
    const mt = cli(n, S, 'show mac address-table');
    ok('pt: the switch learned MACs per VLAN', new RegExp('10\\s+' + P.macDot(A.ports.FastEthernet0.mac).replace(/\./g, '\\.') + '\\s+DYNAMIC\\s+Fa0/1').test(mt), mt);
    const rt = cli(n, R, 'show ip route');
    ok('pt: the router shows both VLAN networks as connected', /C\s+192\.168\.10\.0\/24 is directly connected, GigabitEthernet0\/0\.10/.test(rt) && /L\s+192\.168\.20\.1\/32 is directly connected, GigabitEthernet0\/0\.20/.test(rt), rt);
    ok('pt: the router ARP table shows the hosts', /Internet\s+192\.168\.10\.10/.test(cli(n, R, 'show arp')));
    ok('pt: CDP sees the switch', /S1\s+Gig 0\/0/.test(cli(n, R, 'show cdp neighbors')));
    cli(n, S, ['conf t', 'int g0/1', 'switchport mode access', 'end']);
    ok('pt: without the trunk the VLANs are cut off', ping(n, A, '192.168.20.10') === '....');
    cli(n, S, ['conf t', 'int g0/1', 'switchport mode trunk', 'switchport trunk allowed vlan 10', 'end']);
    ok('pt: a VLAN missing from the allowed list is dropped on the trunk', ping(n, B, '192.168.20.1') === '....' && ping(n, A, '192.168.10.1') === '!!!!');
    cli(n, S, ['conf t', 'int g0/1', 'switchport trunk allowed vlan add 20', 'end']);
    ok('pt: "allowed vlan add" restores it', /!!!$/.test(ping(n, B, '192.168.20.1')));
    const tr = []; n.trace(A, ip.toInt('192.168.20.10'), { onHop: (t, rs) => tr.push(ip.str((rs.find(x => x.from) || {}).from)) }); n.runAll();
    ok('pt: traceroute lists the gateway then the host', tr.join(' ') === '192.168.10.1 192.168.20.10', tr.join(' '));
  }

  /* ---------- static routes, OSPF, RIP and EIGRP ---------- */
  const chain = (cfg) => {
    const n = new P.Net(), R1 = n.add('1941', 0, 0), R2 = n.add('1941', 0, 0), R3 = n.add('1941', 0, 0), A = n.add('PC', 0, 0), B = n.add('PC', 0, 0);
    n.link(A.id, 'FastEthernet0', R1.id, 'GigabitEthernet0/0', 'auto'); n.link(R1.id, 'Serial0/0/0', R2.id, 'Serial0/0/0', 'serial'); n.link(R2.id, 'GigabitEthernet0/1', R3.id, 'GigabitEthernet0/1', 'auto'); n.link(B.id, 'FastEthernet0', R3.id, 'GigabitEthernet0/0', 'auto');
    cli(n, R1, ['en', 'conf t', 'host R1', 'int g0/0', 'ip add 10.1.0.1 255.255.255.0', 'no sh', 'int s0/0/0', 'ip add 172.16.0.1 255.255.255.252', 'clock rate 64000', 'no sh', 'end']);
    cli(n, R2, ['en', 'conf t', 'host R2', 'int s0/0/0', 'ip add 172.16.0.2 255.255.255.252', 'no sh', 'int g0/1', 'ip add 172.16.1.1 255.255.255.252', 'no sh', 'end']);
    cli(n, R3, ['en', 'conf t', 'host R3', 'int g0/1', 'ip add 172.16.1.2 255.255.255.252', 'no sh', 'int g0/0', 'ip add 10.3.0.1 255.255.255.0', 'no sh', 'end']);
    pcIp(n, A, '10.1.0.10', '255.255.255.0', '10.1.0.1'); pcIp(n, B, '10.3.0.10', '255.255.255.0', '10.3.0.1');
    cfg(n, R1, R2, R3);
    return { n, R1, R2, R3, A, B };
  };
  const reach = ({ n, A }) => { ping(n, A, '10.3.0.10'); ping(n, A, '10.3.0.10'); return ping(n, A, '10.3.0.10') === '!!!!'; };
  {
    const t = chain(() => { }); ok('pt: with no routes the far LAN is unreachable', !reach(t));
    const st = chain((n, R1, R2, R3) => { cli(n, R1, ['conf t', 'ip route 0.0.0.0 0.0.0.0 172.16.0.2', 'end']); cli(n, R2, ['conf t', 'ip route 10.1.0.0 255.255.255.0 172.16.0.1', 'ip route 10.3.0.0 255.255.255.0 GigabitEthernet0/1', 'end']); cli(n, R3, ['conf t', 'ip route 0.0.0.0 0.0.0.0 172.16.1.1', 'end']); });
    ok('pt: static and default routes carry traffic end to end', reach(st));
    ok('pt: the default route is the gateway of last resort', /Gateway of last resort is 172\.16\.0\.2 to network 0\.0\.0\.0/.test(cli(st.n, st.R1, 'show ip route')) && /S\*\s+0\.0\.0\.0\/0 \[1\/0\] via 172\.16\.0\.2/.test(cli(st.n, st.R1, 'show ip route')));
    const os = chain((n, ...rs) => rs.forEach(r => cli(n, r, ['conf t', 'router ospf 1', 'network 10.0.0.0 0.255.255.255 area 0', 'network 172.16.0.0 0.0.255.255 area 0', 'end'])));
    ok('pt: OSPF learns the remote networks', reach(os) && /O\s+10\.3\.0\.0\/24 \[110\/66\] via 172\.16\.0\.2/.test(cli(os.n, os.R1, 'show ip route')), cli(os.n, os.R1, 'show ip route'));
    ok('pt: OSPF neighbours are FULL', /FULL\/(DR|BDR)\s+00:00:3\d\s+172\.16\.0\.1\s+Serial0\/0\/0/.test(cli(os.n, os.R2, 'show ip ospf neighbor')));
    const rp = chain((n, ...rs) => rs.forEach(r => cli(n, r, ['conf t', 'router rip', 'version 2', 'no auto-summary', 'network 10.0.0.0', 'network 172.16.0.0', 'end'])));
    ok('pt: RIP learns the remote networks with hop counts', reach(rp) && /R\s+10\.3\.0\.0\/24 \[120\/2\] via 172\.16\.0\.2/.test(cli(rp.n, rp.R1, 'show ip route')));
    const ei = chain((n, ...rs) => rs.forEach(r => cli(n, r, ['conf t', 'router eigrp 100', 'network 10.0.0.0', 'network 172.16.0.0', 'no auto-summary', 'end'])));
    ok('pt: EIGRP learns the remote networks', reach(ei) && /D\s+10\.3\.0\.0\/24 \[90\/\d+\] via 172\.16\.0\.2/.test(cli(ei.n, ei.R1, 'show ip route')));
    const pa = chain((n, ...rs) => rs.forEach(r => cli(n, r, ['conf t', 'router ospf 1', 'network 0.0.0.0 255.255.255.255 area 0', 'passive-interface s0/0/0', 'end'])));
    ok('pt: a passive interface forms no adjacency', !reach(pa));
    const r1 = cli(os.n, os.R1, 'traceroute 10.3.0.10');
    ok('pt: IOS traceroute prints each hop', /1\s+172\.16\.0\.2/.test(r1) && /3\s+10\.3\.0\.10/.test(r1), r1);
    const pg = cli(os.n, os.R1, 'ping 10.3.0.10');
    ok('pt: IOS ping prints !!!!! and the success rate', /Success rate is (80|100) percent/.test(pg) && /[.!]!!!!/.test(pg), pg);
  }

  /* ---------- DHCP, DNS and HTTP ---------- */
  {
    const n = new P.Net(), R = n.add('1941', 0, 0), S = n.add('2960', 0, 0), S2 = n.add('2960', 0, 0), A = n.add('PC', 0, 0), V = n.add('Server', 0, 0), B = n.add('PC', 0, 0);
    n.link(A.id, 'FastEthernet0', S.id, 'FastEthernet0/1'); n.link(S.id, 'GigabitEthernet0/1', R.id, 'GigabitEthernet0/0'); n.link(R.id, 'GigabitEthernet0/1', S2.id, 'GigabitEthernet0/1'); n.link(V.id, 'FastEthernet0', S2.id, 'FastEthernet0/1'); n.link(B.id, 'FastEthernet0', S2.id, 'FastEthernet0/2');
    cli(n, R, ['en', 'conf t', 'int g0/0', 'ip add 192.168.1.1 255.255.255.0', 'no sh', 'int g0/1', 'ip add 192.168.2.1 255.255.255.0', 'no sh', 'exit', 'ip dhcp excluded-address 192.168.1.1 192.168.1.9', 'ip dhcp pool LAN1', 'network 192.168.1.0 255.255.255.0', 'default-router 192.168.1.1', 'dns-server 192.168.2.100', 'end']);
    pcIp(n, V, '192.168.2.100', '255.255.255.0', '192.168.2.1');
    let got = null; A.host.dhcp = true; n.dhcpClient(A, 'FastEthernet0', x => { got = x; }); n.runAll();
    ok('pt: a PC gets its address from a router DHCP pool, skipping excluded ones', got === true && ip.str(A.ports.FastEthernet0.ip) === '192.168.1.10' && ip.str(A.host.gw) === '192.168.1.1', ip.str(A.ports.FastEthernet0.ip));
    ok('pt: show ip dhcp binding lists the lease', /192\.168\.1\.10/.test(cli(n, R, 'show ip dhcp binding')));
    V.svc.dns.on = true; V.svc.dns.recs.push({ name: 'www.lab.com', type: 'A', val: '192.168.2.100' });
    let page = null; n.http(A, 'http://www.lab.com', r => { page = r; }); n.runAll();
    if (!page || !page.ok) { page = null; n.http(A, 'http://www.lab.com', r => { page = r; }); n.runAll(); }
    ok('pt: the browser resolves a name with DNS and loads the page over HTTP', page && page.ok && page.status === 200 && /Cisco Packet Tracer/.test(page.body), JSON.stringify(page));
    let nf = null; n.http(A, 'http://192.168.2.100/missing.html', r => { nf = r; }); n.runAll();
    ok('pt: a missing page is a 404', nf && nf.status === 404);
    V.svc.http.on = false; let off = null; n.http(A, '192.168.2.100', r => { off = r; }); n.runAll();
    ok('pt: with HTTP off the browser times out', off && !off.ok && off.err === 'Request Timeout');
    /* server DHCP across a relay */
    V.svc.dhcp.on = true; V.svc.dhcp.pools.push({ name: 'LAN1', gw: ip.toInt('192.168.1.1'), dns: ip.toInt('192.168.2.100'), start: ip.toInt('192.168.1.50'), mask: ip.toInt('255.255.255.0'), max: 50 });
    cli(n, R, ['conf t', 'no ip dhcp pool LAN1', 'int g0/0', 'ip helper-address 192.168.2.100', 'end']);
    const C = n.add('PC', 0, 0); n.link(C.id, 'FastEthernet0', S.id, 'FastEthernet0/2'); let g2 = null; n.dhcpClient(C, 'FastEthernet0', x => { g2 = x; }); n.runAll();
    ok('pt: ip helper-address relays DHCP to the server', g2 === true && ip.str(C.ports.FastEthernet0.ip) === '192.168.1.50', ip.str(C.ports.FastEthernet0.ip));
    const D = n.add('PC', 0, 0); n.link(D.id, 'FastEthernet0', S.id, 'FastEthernet0/3'); cli(n, R, ['conf t', 'int g0/0', 'no ip helper-address 192.168.2.100', 'end']); let g3 = null; n.dhcpClient(D, 'FastEthernet0', x => { g3 = x; }); n.runAll();
    ok('pt: without a DHCP server the PC falls back to 169.254.x.x', g3 === false && /^169\.254\./.test(ip.str(D.ports.FastEthernet0.ip)));
  }

  /* ---------- NAT / PAT and ACLs ---------- */
  {
    const n = new P.Net(), R = n.add('1941', 0, 0), I = n.add('1941', 0, 0), A = n.add('PC', 0, 0), W = n.add('Server', 0, 0);
    n.link(A.id, 'FastEthernet0', R.id, 'GigabitEthernet0/0'); n.link(R.id, 'GigabitEthernet0/1', I.id, 'GigabitEthernet0/1'); n.link(I.id, 'GigabitEthernet0/0', W.id, 'FastEthernet0');
    cli(n, R, ['en', 'conf t', 'int g0/0', 'ip add 192.168.1.1 255.255.255.0', 'ip nat inside', 'no sh', 'int g0/1', 'ip add 203.0.113.2 255.255.255.252', 'ip nat outside', 'no sh', 'exit', 'access-list 1 permit 192.168.1.0 0.0.0.255', 'ip nat inside source list 1 interface g0/1 overload', 'ip route 0.0.0.0 0.0.0.0 203.0.113.1', 'end']);
    cli(n, I, ['en', 'conf t', 'int g0/1', 'ip add 203.0.113.1 255.255.255.252', 'no sh', 'int g0/0', 'ip add 8.8.8.1 255.255.255.0', 'no sh', 'end']);
    pcIp(n, A, '192.168.1.10', '255.255.255.0', '192.168.1.1'); pcIp(n, W, '8.8.8.8', '255.255.255.0', '8.8.8.1');
    ping(n, A, '8.8.8.8'); const p2 = ping(n, A, '8.8.8.8');
    ok('pt: PAT lets a private host reach the internet with no route back to it', p2 === '!!!!', p2);
    ok('pt: the translation table shows inside local and global', /icmp 203\.0\.113\.2:\d+\s+192\.168\.1\.10:\d+\s+8\.8\.8\.8/.test(cli(n, R, 'show ip nat translations')), cli(n, R, 'show ip nat translations'));
    ok('pt: without NAT the reply has no way back', (() => { cli(n, R, ['conf t', 'no ip nat inside source list 1 interface g0/1 overload', 'end']); R.natT = []; return ping(n, A, '8.8.8.8') === '....'; })());
    cli(n, R, ['conf t', 'ip nat inside source list 1 interface g0/1 overload', 'access-list 110 deny icmp any host 8.8.8.8 echo', 'access-list 110 permit ip any any', 'int g0/0', 'ip access-group 110 in', 'end']);
    ok('pt: an extended ACL blocks ping to one host', ping(n, A, '8.8.8.8') === '....' && ping(n, A, '192.168.1.1') === '!!!!');
    ok('pt: show access-lists counts the matches', /10 deny icmp any host 8\.8\.8\.8 echo \(4 match\(es\)\)/.test(cli(n, R, 'show access-lists')), cli(n, R, 'show access-lists'));
    let web = null; n.http(A, 'http://8.8.8.8', r => { web = r; }); n.runAll();
    ok('pt: the ACL still permits web traffic', web && web.ok && web.status === 200);
    const r = P.parseAcl(false, 'tcp 10.0.0.0 0.0.0.255 host 1.2.3.4 eq www');
    ok('pt: extended ACL lines parse protocol, wildcard, host and port', r.proto === 'tcp' && r.p1 === 80 && r.op === 'eq' && r.dwild === 0 && P.parseAcl(false, 'tcp any any eq').err != null);
  }

  /* ---------- spanning tree, port security, save and reload ---------- */
  {
    const n = new P.Net(), a = n.add('2960', 0, 0), b = n.add('2960', 0, 0), c = n.add('2960', 0, 0), X = n.add('PC', 0, 0), Y = n.add('PC', 0, 0);
    n.link(a.id, 'GigabitEthernet0/1', b.id, 'GigabitEthernet0/1'); n.link(b.id, 'GigabitEthernet0/2', c.id, 'GigabitEthernet0/1'); n.link(c.id, 'GigabitEthernet0/2', a.id, 'GigabitEthernet0/2');
    n.link(X.id, 'FastEthernet0', a.id, 'FastEthernet0/1'); n.link(Y.id, 'FastEthernet0', c.id, 'FastEthernet0/1');
    pcIp(n, X, '10.0.0.1', '255.255.255.0'); pcIp(n, Y, '10.0.0.2', '255.255.255.0');
    const blk = Object.values(n.state().stp).filter(s => s === 'BLK').length;
    ok('pt: spanning tree blocks exactly one port in a triangle', blk === 1);
    const qBefore = n.pseq; ok('pt: a switching loop does not melt down and ping works', ping(n, X, '10.0.0.2') === '!!!!' && n.pseq - qBefore < 400);
    cli(n, a, ['en', 'conf t', 'int fa0/1', 'switchport mode access', 'switchport port-security', 'switchport port-security maximum 1', 'end']);
    ping(n, X, '10.0.0.2'); const Z = n.add('PC', 0, 0); n.unlink(X.ports.FastEthernet0.link); n.link(Z.id, 'FastEthernet0', a.id, 'FastEthernet0/1'); pcIp(n, Z, '10.0.0.3', '255.255.255.0'); ping(n, Z, '10.0.0.2');
    ok('pt: port security shuts the port when a second MAC appears', a.ports['FastEthernet0/1'].errdis === true && /err-disabled/.test(cli(n, a, 'show interfaces fa0/1')));
    const R = n.add('1941', 0, 0);
    cli(n, R, ['en', 'conf t', 'hostname Keep', 'end', 'copy run start', '', 'conf t', 'hostname Lost', 'end', 'reload', 'no', '']);
    ok('pt: copy run start survives a reload, unsaved changes do not', R.cfg.hostname === 'Keep');
    cli(n, R, ['en', 'write erase', '', 'reload', '']); ok('pt: write erase then reload gives a factory router', R.cfg.hostname === 'Router');
  }

  /* ---------- Simulation mode records events ---------- */
  {
    const { n, A } = lab(); n.sim = true; n.events = [];
    n.ping(A, ip.toInt('192.168.10.1'), { count: 1 });
    let steps = 0; while (n.q.length && steps++ < 500) n.step();
    const types = new Set(n.events.map(e => e.type));
    ok('pt: Simulation mode records ARP and ICMP events hop by hop', types.has('ARP') && types.has('ICMP') && n.events.some(e => e.at === 'Switch0') && n.events.every(e => Array.isArray(e.notes)), [...types].join(','));
    ok('pt: events carry OSI notes for the PDU window', n.events.some(e => e.notes.some(x => /MAC table|floods/.test(x))));
  }

  /* ---------- saving and loading a topology, and the starter labs ---------- */
  {
    const { n } = lab();
    const txt = P.save(n), m = P.load(txt);
    ok('pt: a saved topology loads back with the same devices, links and config', Object.keys(m.devs).length === 5 && Object.keys(m.links).length === 4 && Object.values(m.devs).some(d => d.cfg && d.cfg.hostname === 'R1' && d.subifs['GigabitEthernet0/0.20']));
    const A2 = Object.values(m.devs).find(d => d.host && ip.str(d.ports.FastEthernet0.ip) === '192.168.10.10');
    ping(m, A2, '192.168.20.10'); ok('pt: the loaded topology still routes', ping(m, A2, '192.168.20.10') === '!!!!');
    ok('pt: every starter lab builds and checks start incomplete', P.LABS.length >= 4 && P.LABS.every(L => { const x = L.build(); const res = P.checkLab(L, x); return res.items.length >= 3 && res.done < res.items.length; }));
    const v = P.LABS.find(L => L.id === 'vlans'), vx = v.build();
    v.solve(vx, cli);
    const vr = P.checkLab(v, vx);
    ok('pt: the VLAN lab scores 100% once solved', vr.done === vr.items.length, vr.items.filter(i => !i.ok).map(i => i.label).join('; '));
  }
};

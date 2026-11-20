// Packet Tracer simulator, part 7: IOS show commands. Builds the running and startup configuration text and the
// tables IOS prints: ip interface brief, interfaces, vlan brief, interfaces trunk, ip route, mac address-table, arp,
// cdp neighbors, ip protocols, ospf and eigrp neighbours, dhcp bindings, nat translations, access-lists and more.
(() => {
  const G = typeof window !== 'undefined' ? window : globalThis;
  const P = G.PTSim; const ip = P.ip, S = P.iosSpecs;
  Object.assign(P.iosHelp, {
    'ip': 'IP information', brief: 'Brief summary of IP status and configuration', interfaces: 'Interface status and configuration', vlan: 'VTP VLAN status', arp: 'ARP table', cdp: 'CDP information', neighbors: 'CDP neighbor entries',
    version: 'System hardware and software status', history: 'Display the session command history', clock: 'Display the system clock', 'access-lists': 'List access lists', protocols: 'IP routing protocol process parameters and statistics',
    binding: 'DHCP address bindings', translations: 'Translation entries', 'spanning-tree': 'Spanning tree topology', 'port-security': 'Show secure port information', users: 'Display information about terminal lines', flash: 'display information about flash: file system',
    interface: 'IP interface status and configuration', route: 'IP routing table', detail: 'Show detailed information', trunk: 'Show interface trunk information', status: 'Show interface line status', ssh: 'Information on SSH',
  });
  const SH = [];
  const st7 = (d, pw) => d.cfg.pwEnc ? '7 ' + P.type7(pw) : pw;
  const pad = (s, n) => String(s).padEnd(n);
  const ifUp = (net, d, i) => i.up;
  const status = (net, d, o, name) => { if (o.shutdown) return 'administratively down'; if (o.errdis) return 'down'; const i = net.l3find(d, name); if (i) return i.up ? 'up' : 'down'; return net.portUp(d, name) ? 'up' : 'down'; };
  const wild = m => ip.str((~ip.toInt(m)) >>> 0);

  /* ---------- running-config ---------- */
  P.runningConfig = function (net, d) {
    const c = d.cfg, o = [];
    const ifBlock = (name, x, isSw) => {
      o.push('!', 'interface ' + name);
      if (x.desc) o.push(' description ' + x.desc);
      if (x.vlan != null && d.subifs[name]) o.push(' encapsulation dot1Q ' + x.vlan + (x.native ? ' native' : ''));
      if (isSw && !x.routed) {
        if (x.sw.vlan !== 1) o.push(' switchport access vlan ' + x.sw.vlan);
        if (x.sw.native !== 1) o.push(' switchport trunk native vlan ' + x.sw.native);
        if (x.sw.allowed) o.push(' switchport trunk allowed vlan ' + compress(x.sw.allowed));
        if (d.model === '3560' && x.sw.encap === 'dot1q') o.push(' switchport trunk encapsulation dot1q');
        if (x.sw.mode === 'access' || x.sw.mode === 'trunk') o.push(' switchport mode ' + x.sw.mode); else if (x.sw.mode === 'dynamic desirable') o.push(' switchport mode dynamic desirable');
        if (x.sw.nonego) o.push(' switchport nonegotiate');
        if (x.sw.ps && !x.sw.ps.off) { o.push(' switchport port-security'); if (x.sw.ps.max !== 1) o.push(' switchport port-security maximum ' + x.sw.ps.max); if (x.sw.ps.viol !== 'shutdown') o.push(' switchport port-security violation ' + x.sw.ps.viol); if (x.sw.ps.sticky) { o.push(' switchport port-security mac-address sticky'); (x.sw.ps.stickyMacs || []).forEach(m => o.push(' switchport port-security mac-address sticky ' + P.macDot(m))); } }
        if (x.portfast) o.push(' spanning-tree portfast');
      } else {
        if (isSw && x.routed) o.push(' no switchport');
        if (x.ip != null) o.push(' ip address ' + ip.str(x.ip) + ' ' + ip.str(x.mask)); else if (!d.subifs[name] || true) o.push(' no ip address');
        (x.helper || []).forEach(h => o.push(' ip helper-address ' + ip.str(h)));
        if (x.aclIn) o.push(' ip access-group ' + x.aclIn + ' in'); if (x.aclOut) o.push(' ip access-group ' + x.aclOut + ' out');
        if (x.nat) o.push(' ip nat ' + x.nat);
        if (x.cost) o.push(' ip ospf cost ' + x.cost);
      }
      if (x.bw) o.push(' bandwidth ' + x.bw);
      if (x.kind === 'serial' && x.clock) o.push(' clock rate ' + x.clock);
      if ((x.kind === 'gig' || x.kind === 'gigf' || x.kind === 'fa') && d.type === 'router') o.push(' duplex ' + (x.duplex || 'auto'), ' speed ' + (x.speed || 'auto'));
      if (x.shutdown) o.push(' shutdown');
    };
    o.push('Building configuration...', '', 'Current configuration : ' + (1000 + JSON.stringify(c).length) + ' bytes', '!', 'version 15.1', 'no service timestamps log datetime msec', 'no service timestamps debug datetime msec', (c.pwEnc ? '' : 'no ') + 'service password-encryption', '!', 'hostname ' + c.hostname, '!');
    if (c.secret) o.push('enable secret 5 ' + c.secret.hash); if (c.enablePw) o.push('enable password ' + st7(d, c.enablePw.plain));
    if (c.secret || c.enablePw) o.push('!');
    c.dhcp.excl.forEach(([a, b]) => o.push('ip dhcp excluded-address ' + ip.str(a) + (a !== b ? ' ' + ip.str(b) : '')));
    Object.values(c.dhcp.pools).forEach(p => { o.push('!', 'ip dhcp pool ' + p.name); if (p.net != null) o.push(' network ' + ip.str(p.net) + ' ' + ip.str(p.mask)); if (p.gw != null) o.push(' default-router ' + ip.str(p.gw)); if (p.dns != null) o.push(' dns-server ' + ip.str(p.dns)); if (p.domain) o.push(' domain-name ' + p.domain); });
    o.push('!'); if (d.type === 'router') o.push('!', 'ip cef', 'no ipv6 cef'); else if (c.ipRouting) o.push('ip routing');
    if (!c.domainLookup) o.push('no ip domain-lookup'); if (c.domain) o.push('ip domain-name ' + c.domain); if (c.nameServer != null) o.push('ip name-server ' + ip.str(c.nameServer));
    o.push('!'); Object.entries(c.users).forEach(([u, x]) => o.push('username ' + u + (x.priv != null ? ' privilege ' + x.priv : '') + (x.kind === 'secret' ? ' secret 5 ' + x.pw.hash : ' password ' + st7(d, x.pw.plain))));
    if (c.rsa) o.push('!', 'ip ssh version ' + c.sshVer); if (!c.cdp) o.push('no cdp run');
    o.push('!', 'spanning-tree mode ' + (c.stpMode || 'pvst')); if (c.stpPri !== 32768 && d.type === 'switch') o.push('spanning-tree vlan 1 priority ' + c.stpPri);
    const sw = d.type === 'switch';
    for (const [n, x] of Object.entries(d.ports)) if (x.kind !== 'console') { ifBlock(n, x, sw); for (const [sn, sx] of Object.entries(d.subifs)) if (sn.split('.')[0] === n) ifBlock(sn, sx, false); }
    for (const [n, x] of Object.entries(d.loops)) ifBlock(n, x, false);
    for (const [n, x] of Object.entries(d.svis)) ifBlock(n, x, false);
    if (c.rip) { o.push('!', 'router rip'); if (c.rip.ver === 2) o.push(' version 2'); c.rip.passive.forEach(p => o.push(' passive-interface ' + p)); c.rip.nets.forEach(n => o.push(' network ' + ip.str(n))); if (c.rip.defOrig) o.push(' default-information originate'); if (!c.rip.auto) o.push(' no auto-summary'); }
    for (const [id, r] of Object.entries(c.ospf)) { o.push('!', 'router ospf ' + id); if (r.rid != null) o.push(' router-id ' + ip.str(r.rid)); o.push(' log-adjacency-changes'); r.passive.forEach(p => o.push(' passive-interface ' + p)); r.nets.forEach(n => o.push(' network ' + ip.str(n.ip) + ' ' + ip.str(n.wild) + ' area ' + n.area)); if (r.defOrig) o.push(' default-information originate'); }
    for (const [id, r] of Object.entries(c.eigrp)) { o.push('!', 'router eigrp ' + id); r.passive.forEach(p => o.push(' passive-interface ' + p)); r.nets.forEach(n => o.push(' network ' + ip.str(n.ip) + (n.wild != null ? ' ' + ip.str(n.wild) : ''))); if (!r.auto) o.push(' no auto-summary'); }
    o.push('!');
    Object.values(c.nat.pools).forEach(p => o.push('ip nat pool ' + p.name + ' ' + ip.str(p.start) + ' ' + ip.str(p.end) + ' netmask ' + ip.str(p.mask)));
    c.nat.rules.forEach(r => o.push(r.type === 'static' ? 'ip nat inside source static ' + ip.str(r.local) + ' ' + ip.str(r.global) : 'ip nat inside source list ' + r.acl + (r.iface ? ' interface ' + r.iface : ' pool ' + r.pool) + (r.overload ? ' overload' : '')));
    if (d.type === 'router') o.push('ip classless');
    if (c.defaultGw != null) o.push('ip default-gateway ' + ip.str(c.defaultGw));
    c.routes.forEach(r => o.push('ip route ' + ip.str(r.net) + ' ' + ip.str(r.mask) + ' ' + (r.iface || ip.str(r.nh)) + (r.ad && r.ad !== 1 ? ' ' + r.ad : '')));
    o.push('!', 'ip flow-export version 9', '!');
    for (const a of Object.values(c.acls)) {
      if (a.named) { o.push('ip access-list ' + (a.std ? 'standard ' : 'extended ') + a.name); a.rules.forEach(r => o.push(r.remark ? ' remark ' + r.remark : ' ' + r.action + ' ' + aclText(r))); }
      else a.rules.forEach(r => o.push('access-list ' + a.name + (r.remark ? ' remark ' + r.remark : ' ' + r.action + ' ' + aclText(r))));
    }
    if (c.motd) o.push('!', 'banner motd ^C' + c.motd + '^C');
    o.push('!', '!', '!', 'line con 0'); lineCfg(d, c.lines.con, o); o.push('!', 'line aux 0', '!', 'line vty 0 4'); lineCfg(d, c.lines.vty, o); if (d.type === 'switch') { o.push('line vty 5 15'); lineCfg(d, c.lines.vty, o); }
    o.push('!', '!', '!', 'end');
    return o.join('\n');
  };
  function lineCfg(d, l, o) {
    if (l.tmo) o.push(' exec-timeout ' + l.tmo.join(' ')); if (l.pw) o.push(' password ' + st7(d, l.pw)); if (l.sync) o.push(' logging synchronous');
    if (l.local) o.push(' login local'); else if (l.login) o.push(' login');
    if (l.transport && l.transport !== 'all' && l.transport !== undefined && l === d.cfg.lines.vty) o.push(' transport input ' + l.transport);
    if (l.acl) o.push(' access-class ' + l.acl + ' in');
  }
  const ad = (a, w) => w === 0xffffffff ? 'any' : w === 0 ? 'host ' + ip.str(a) : ip.str(a) + ' ' + ip.str(w);
  function aclText(r) {
    if (r.std) return ad(r.src, r.swild);
    let t = r.proto + ' ' + ad(r.src, r.swild) + ' ' + ad(r.dst, r.dwild);
    if (r.op) t += ' ' + r.op + ' ' + r.p1 + (r.op === 'range' ? ' ' + r.p2 : ''); if (r.icmpName) t += ' ' + r.icmpName; if (r.established) t += ' established';
    return t;
  }
  P.aclText = aclText;
  function compress(l) { const o = []; let i = 0; while (i < l.length) { let j = i; while (j + 1 < l.length && l[j + 1] === l[j] + 1) j++; o.push(j > i ? l[i] + '-' + l[j] : String(l[i])); i = j + 1; } return o.join(','); }

  /* ---------- show commands ---------- */
  const add = (pat, fn, privOnly) => { (privOnly ? [S.priv] : [S.user, S.priv]).forEach(t => t.push(['show ' + pat, (s, v) => s.ln(fn(s.net, s.d, v, s))])); };
  add('running-config', (n, d) => P.runningConfig(n, d), true);
  add('startup-config', (n, d) => { if (!d.startup) return 'startup-config is not present'; const cur = JSON.stringify(P.cfgSnapshot(d)); const tmp = JSON.parse(JSON.stringify(d)); P.cfgApply({ touch() { } }, tmp, d.startup, false); return 'Using ' + (900 + cur.length) + ' bytes\n' + P.runningConfig(n, tmp).split('\n').slice(3).join('\n'); }, true);
  add('ip interface brief', (n, d) => {
    const rows = ['Interface              IP-Address      OK? Method Status                Protocol '];
    const one = (name, x) => { const i = n.l3find(d, name), stv = status(n, d, x, name); rows.push(pad(name, 23) + pad(x.ip != null ? ip.str(x.ip) : 'unassigned', 16) + 'YES ' + pad(x.ip != null ? 'manual' : 'unset', 7) + pad(stv, 22) + (i ? (i.up ? 'up' : 'down') : (n.portUp(d, name) ? 'up' : 'down')) + ' '); };
    for (const [nm, x] of Object.entries(d.ports)) if (x.kind !== 'console') { one(nm, x); for (const [sn, sx] of Object.entries(d.subifs)) if (sn.split('.')[0] === nm) one(sn, sx); }
    for (const [nm, x] of Object.entries(d.loops)) one(nm, x);
    for (const [nm, x] of Object.entries(d.svis)) one(nm, x);
    return rows.join('\n');
  });
  add('interfaces', (n, d) => Object.entries(d.ports).filter(([, x]) => x.kind !== 'console').concat(Object.entries(d.subifs), Object.entries(d.svis), Object.entries(d.loops)).map(([nm, x]) => ifDetail(n, d, nm, x)).join('\n'));
  add('interfaces IF', (n, d, v) => { const x = P.ifObj(d, v[2]); return x ? ifDetail(n, d, v[2], x) : '%Invalid interface type and number'; });
  function ifDetail(n, d, nm, x) {
    const i = n.l3find(d, nm), stv = status(n, d, x, nm), proto = i ? i.up : n.portUp(d, nm), bw = i ? P.ifBw(d, i) : (x.kind === 'fa' ? 100000 : 1000000);
    const hw = x.kind === 'serial' ? 'HD64570' : nm.startsWith('Vlan') ? 'CPU Interface' : nm.startsWith('Loop') ? 'Loopback' : x.kind === 'fa' ? 'Lance' : 'CN Gigabit Ethernet';
    const mac = x.mac || (nm.startsWith('Vlan') ? d.baseMac : '');
    return nm + ' is ' + stv + ', line protocol is ' + (proto ? 'up' : 'down') + (x.errdis ? ' (err-disabled)' : '') + '\n  Hardware is ' + hw + (mac ? ', address is ' + P.macDot(mac) + ' (bia ' + P.macDot(mac) + ')' : '') +
      (x.desc ? '\n  Description: ' + x.desc : '') + (x.ip != null ? '\n  Internet address is ' + ip.str(x.ip) + '/' + ip.len(x.mask) : '') +
      '\n  MTU 1500 bytes, BW ' + bw + ' Kbit, DLY ' + (i ? P.ifDelay(d, i) * 10 : 100) + ' usec,\n     reliability 255/255, txload 1/255, rxload 1/255\n  Encapsulation ' + (x.kind === 'serial' ? 'HDLC' : d.subifs[nm] ? '802.1Q Virtual LAN, Vlan ID ' + (x.vlan || '') : 'ARPA') + ', loopback not set\n  Keepalive set (10 sec)\n' +
      (x.kind === 'serial' ? '  ' + (x.clock ? 'DCE' : 'DTE') + ' V.35' + (x.clock ? ', clock rate ' + x.clock : '') + '\n' : x.kind ? '  ' + (x.speed && x.speed !== 'auto' ? x.speed + 'Mb/s' : 'Full-duplex, ' + (x.kind === 'fa' ? '100' : '1000') + 'Mb/s') + '\n' : '') +
      '  Last input 00:00:08, output 00:00:05, output hang never\n  Queueing strategy: fifo\n  5 minute input rate 0 bits/sec, 0 packets/sec\n  5 minute output rate 0 bits/sec, 0 packets/sec\n';
  }
  add('vlan brief', (n, d) => vlanTable(n, d));
  add('vlan', (n, d) => vlanTable(n, d));
  function vlanTable(n, d) {
    if (d.type !== 'switch') return '% Invalid input detected';
    const rows = ['', 'VLAN Name                             Status    Ports', '---- -------------------------------- --------- -------------------------------'];
    for (const v of Object.keys(d.cfg.vlans).map(Number).sort((a, b) => a - b)) {
      const ports = Object.values(d.ports).filter(p => p.sw && !p.routed && p.kind !== 'console' && !n.isTrunk(d, p.name) && p.sw.vlan === v).map(p => P.ifShort(p.name).replace(/^Gi/, 'Gig'));
      const chunks = []; for (let k = 0; k < ports.length; k += 4) chunks.push(ports.slice(k, k + 4).join(', '));
      rows.push(pad(v, 5) + pad(d.cfg.vlans[v], 33) + pad(v >= 1002 ? 'active' : 'active', 10) + (chunks[0] || ''));
      for (const c of chunks.slice(1)) rows.push(' '.repeat(48) + c);
    }
    return rows.join('\n');
  }
  add('interfaces trunk', (n, d) => {
    const tr = Object.values(d.ports).filter(p => p.sw && n.isTrunk(d, p.name) && n.portUp(d, p.name)); if (!tr.length) return '';
    const r = ['Port        Mode         Encapsulation  Status        Native vlan'];
    tr.forEach(p => r.push(pad(P.ifShort(p.name).replace(/^Gi/, 'Gig'), 12) + pad(p.sw.mode === 'trunk' ? 'on' : p.sw.mode.replace('dynamic ', ''), 13) + pad('802.1q', 15) + pad('trunking', 14) + p.sw.native));
    r.push('', 'Port        Vlans allowed on trunk'); tr.forEach(p => r.push(pad(P.ifShort(p.name), 12) + (p.sw.allowed ? compress(p.sw.allowed) : '1-1005')));
    r.push('', 'Port        Vlans allowed and active in management domain'); tr.forEach(p => r.push(pad(P.ifShort(p.name), 12) + compress(n.portVlans(d, p.name))));
    r.push('', 'Port        Vlans in spanning tree forwarding state and not pruned'); tr.forEach(p => r.push(pad(P.ifShort(p.name), 12) + (n.fwd(d, p.name) ? compress(n.portVlans(d, p.name)) : 'none')));
    return r.join('\n');
  });
  add('interfaces status', (n, d) => ['Port      Name               Status       Vlan       Duplex  Speed Type'].concat(Object.values(d.ports).filter(p => p.sw).map(p => pad(P.ifShort(p.name), 10) + pad(p.desc.slice(0, 18), 19) + pad(p.errdis ? 'err-disabled' : p.shutdown ? 'disabled' : n.portUp(d, p.name) ? 'connected' : 'notconnect', 13) + pad(p.routed ? 'routed' : n.isTrunk(d, p.name) ? 'trunk' : p.sw.vlan, 11) + pad('auto', 8) + pad('auto', 6) + (p.kind === 'fa' ? '10/100BaseTX' : '10/100/1000BaseTX'))).join('\n'));
  add('ip route', (n, d) => routeTable(n, d));
  function routeTable(n, d) {
    if (!d.cfg.ipRouting) { return d.cfg.defaultGw != null ? 'Default gateway is ' + ip.str(d.cfg.defaultGw) + '\n\nHost               Gateway           Last Use    Total Uses  Interface\nICMP redirect cache is empty' : 'Default gateway is not set\n\nHost               Gateway           Last Use    Total Uses  Interface\nICMP redirect cache is empty'; }
    const t = P.table(n, d), def = t.find(r => r.len === 0);
    const out = ['Codes: L - local, C - connected, S - static, R - RIP, M - mobile, B - BGP', '       D - EIGRP, EX - EIGRP external, O - OSPF, IA - OSPF inter area', '       N1 - OSPF NSSA external type 1, N2 - OSPF NSSA external type 2', '       E1 - OSPF external type 1, E2 - OSPF external type 2, E - EGP', '       i - IS-IS, L1 - IS-IS level-1, L2 - IS-IS level-2, ia - IS-IS inter area', '       * - candidate default, U - per-user static route, o - ODR', '       P - periodic downloaded static route', '',
      def ? 'Gateway of last resort is ' + (def.nh != null ? ip.str(def.nh) : '0.0.0.0') + ' to network 0.0.0.0' : 'Gateway of last resort is not set', ''];
    const groups = {};
    for (const r of t) { const k = r.len === 0 ? 'z' : ip.classful(r.net).net + '/' + ip.classful(r.net).len; (groups[k] = groups[k] || []).push(r); }
    for (const [k, rs] of Object.entries(groups)) {
      const [cn, cl] = k.split('/'), masks = new Set(rs.map(r => r.len));
      if (k !== 'z' && !(rs.length === 1 && rs[0].len === +cl)) out.push('     ' + ip.str(+cn) + '/' + (masks.size === 1 ? [...masks][0] : cl) + ' is ' + (masks.size > 1 ? 'variably subnetted, ' + rs.length + ' subnets, ' + masks.size + ' masks' : 'subnetted, ' + rs.length + ' subnets'));
      for (const r of rs) {
        const code = r.code.padEnd(4), pfx = ip.str(r.net) + '/' + r.len;
        if (r.code === 'C' || r.code === 'L') out.push(code + '    ' + pfx + ' is directly connected, ' + r.out);
        else if (r.code.startsWith('S') && r.nh == null) out.push(code + '    ' + pfx + ' is directly connected, ' + r.out);
        else out.push(code + '    ' + pfx + ' [' + r.ad + '/' + r.metric + '] via ' + ip.str(r.nh) + (r.code.startsWith('S') ? '' : ', 00:00:' + String(10 + (r.metric % 50)).padStart(2, '0') + ', ' + r.out));
      }
    }
    return out.join('\n');
  }
  add('mac address-table', (n, d) => macTable(d));
  add('mac-address-table', (n, d) => macTable(d));
  function macTable(d) {
    const r = ['          Mac Address Table', '-------------------------------------------', '', 'Vlan    Mac Address       Type        Ports', '----    -----------       --------    -----', ''];
    Object.values(d.mac).filter(e => e.vlan != null).sort((a, b) => a.vlan - b.vlan || a.mac.localeCompare(b.mac)).forEach(e => r.push(String(e.vlan).padStart(4) + '    ' + P.macDot(e.mac) + '    DYNAMIC     ' + P.ifShort(e.port)));
    return r.join('\n');
  }
  const arpT = (n, d) => {
    const r = ['Protocol  Address          Age (min)  Hardware Addr   Type   Interface'];
    for (const i of n.l3(d)) if (i.ip != null && i.up && i.mac) r.push('Internet  ' + pad(ip.str(i.ip), 17) + '      -   ' + P.macDot(i.mac) + '  ARPA   ' + i.name);
    for (const [a, e] of Object.entries(d.arp)) r.push('Internet  ' + pad(ip.str(+a), 17) + String(Math.floor((n.t - e.t) / 600)).padStart(7) + '   ' + P.macDot(e.mac) + '  ARPA   ' + e.ifn);
    return r.join('\n');
  };
  add('arp', arpT); add('ip arp', arpT);
  P.cdpNeighbors = (n, d) => n.attach(d).filter(a => a.L.type !== 'console' && a.L.type !== 'wireless' && n.linkUp(a.L.id)).map(a => ({ local: a.port, dev: n.devs[a.peer.dev], port: a.peer.port })).filter(x => P.isIOS(x.dev) && x.dev.cfg.cdp);
  add('cdp neighbors', (n, d) => {
    if (!d.cfg.cdp) return '% CDP is not enabled';
    const r = ['Capability Codes: R - Router, T - Trans Bridge, B - Source Route Bridge', '                  S - Switch, H - Host, I - IGMP, r - Repeater, P - Phone', 'Device ID    Local Intrfce   Holdtme    Capability   Platform    Port ID'];
    const sh = s => P.ifShort(s).replace(/^Gi/, 'Gig ').replace(/^Fa/, 'Fas ').replace(/^Se/, 'Ser ');
    P.cdpNeighbors(n, d).forEach(x => r.push(pad(x.dev.cfg.hostname, 13) + pad(sh(x.local), 16) + pad('  ' + (120 + (x.dev.baseMac.charCodeAt(11) % 50)), 11) + pad('     ' + (x.dev.type === 'router' ? 'R' : 'S'), 13) + pad(P.MODELS[x.dev.model].label, 12) + sh(x.port)));
    return r.join('\n');
  });
  add('cdp neighbors detail', (n, d) => P.cdpNeighbors(n, d).map(x => '-------------------------\nDevice ID: ' + x.dev.cfg.hostname + '\nEntry address(es): \n' + n.l3(x.dev).filter(i => i.ip != null).slice(0, 1).map(i => '  IP address : ' + ip.str(i.ip)).join('') + '\nPlatform: cisco ' + P.MODELS[x.dev.model].label + ', Capabilities: ' + (x.dev.type === 'router' ? 'Router' : 'Switch') + '\nInterface: ' + x.local + ', Port ID (outgoing port): ' + x.port + '\nHoldtime: 160\n\nVersion :\nCisco IOS Software, Version 15.1(4)M4, RELEASE SOFTWARE (fc2)\n').join('\n'));
  add('version', (n, d) => 'Cisco IOS Software, ' + (d.type === 'switch' ? 'C2960 Software (C2960-LANBASEK9-M)' : 'C' + d.model + ' Software (C' + d.model + '-UNIVERSALK9-M)') + ', Version 15.1(4)M4, RELEASE SOFTWARE (fc2)\nTechnical Support: http://www.cisco.com/techsupport\nCopyright (c) 1986-2012 by Cisco Systems, Inc.\n\nROM: System Bootstrap, Version 15.1(4)M4\n\n' + d.cfg.hostname + ' uptime is ' + Math.floor(n.t / 600) + ' minutes\nSystem image file is "flash0:c' + d.model + '-universalk9-mz.SPA.151-4.M4.bin"\n\nCisco ' + P.MODELS[d.model].label + ' (revision 1.0) with 491520K/32768K bytes of memory.\n' + Object.values(d.ports).filter(p => p.kind === 'gig' || p.kind === 'gigf').length + ' Gigabit Ethernet interfaces\n' + (Object.values(d.ports).some(p => p.kind === 'fa') ? Object.values(d.ports).filter(p => p.kind === 'fa').length + ' FastEthernet interfaces\n' : '') + (Object.values(d.ports).some(p => p.kind === 'serial') ? Object.values(d.ports).filter(p => p.kind === 'serial').length + ' Low-speed serial(sync/async) network interface(s)\n' : '') + '255K bytes of non-volatile configuration memory.\n\nConfiguration register is 0x2102\n');
  add('history', (n, d, v, s) => s.hist.map(h => '  ' + h).join('\n'));
  add('clock', (n) => '*' + new Date(Date.UTC(1993, 2, 1, 0, 0, 0) + n.t * 100).toUTCString().replace(/^\w+, /, '').replace(' GMT', '.000 UTC'));
  add('users', () => '    Line       User       Host(s)              Idle       Location\n*  0 con 0                idle                 00:00:00');
  add('flash', (n, d) => 'System flash directory:\nFile  Length   Name/status\n  3   33591768 c' + d.model + '-universalk9-mz.SPA.151-4.M4.bin\n  2   28282    sigdef-category.xml\n[33620050 bytes used, 222123438 available, 255744000 total]');
  add('access-lists', (n, d) => Object.values(d.cfg.acls).map(a => (a.std ? 'Standard' : 'Extended') + ' IP access list ' + a.name + '\n' + a.rules.filter(r => !r.remark).map(r => '    ' + r.seq + ' ' + r.action + ' ' + aclText(r) + (r.hits ? ' (' + r.hits + ' match(es))' : '')).join('\n')).join('\n'));
  add('ip protocols', (n, d) => {
    const c = d.cfg, o = []; const nb = (n.state().nbr || {})[d.id] || [];
    if (c.rip) o.push('Routing Protocol is "rip"', 'Sending updates every 30 seconds, next due in 12 seconds', 'Invalid after 180 seconds, hold down 180, flushed after 240', 'Outgoing update filter list for all interfaces is not set', 'Incoming update filter list for all interfaces is not set', 'Redistributing: rip', 'Default version control: send version ' + c.rip.ver + ', receive ' + (c.rip.ver === 2 ? '2' : 'any version'), 'Automatic network summarization is ' + (c.rip.auto ? 'in effect' : 'not in effect'), 'Maximum path: 4', 'Routing for Networks:', ...c.rip.nets.map(x => '\t' + ip.str(x)), 'Passive Interface(s):', ...c.rip.passive.map(x => '\t' + x), 'Routing Information Sources:', '\tGateway         Distance      Last Update', ...nb.filter(x => x.proto === 'rip').map(x => '\t' + pad(ip.str(x.ip), 16) + '120           00:00:08'), 'Distance: (default is 120)', '');
    for (const [id, r] of Object.entries(c.ospf)) o.push('Routing Protocol is "ospf ' + id + '"', 'Outgoing update filter list for all interfaces is not set', 'Incoming update filter list for all interfaces is not set', 'Router ID ' + ip.str(P.ospfRid(n, d, id)), 'Number of areas in this router is 1. 1 normal 0 stub 0 nssa', 'Maximum path: 4', 'Routing for Networks:', ...r.nets.map(x => '    ' + ip.str(x.ip) + ' ' + ip.str(x.wild) + ' area ' + x.area), 'Routing Information Sources:', '  Gateway         Distance      Last Update', ...nb.filter(x => x.proto === 'ospf').map(x => '  ' + pad(ip.str(x.rid), 16) + '110           00:00:21'), 'Distance: (default is 110)', '');
    for (const [id, r] of Object.entries(c.eigrp)) o.push('Routing Protocol is "eigrp  ' + id + '"', 'Outgoing update filter list for all interfaces is not set', 'Incoming update filter list for all interfaces is not set', 'Default networks flagged in outgoing updates', 'Default networks accepted from incoming updates', 'EIGRP metric weight K1=1, K2=0, K3=1, K4=0, K5=0', 'EIGRP maximum hopcount 100', 'EIGRP maximum metric variance 1', 'Redistributing: eigrp ' + id, 'Automatic network summarization is ' + (r.auto ? 'in effect' : 'not in effect'), 'Maximum path: 4', 'Routing for Networks:', ...r.nets.map(x => '   ' + ip.str(x.ip) + (x.wild != null ? '/' + (32 - ip.len(x.wild)) : '')), 'Routing Information Sources:', '  Gateway         Distance      Last Update', ...nb.filter(x => x.proto === 'eigrp').map(x => '  ' + pad(ip.str(x.ip), 16) + '90            00:00:15'), 'Distance: internal 90 external 170', '');
    return o.join('\n');
  });
  add('ip ospf neighbor', (n, d) => ['', 'Neighbor ID     Pri   State           Dead Time   Address         Interface'].concat(((n.state().nbr || {})[d.id] || []).filter(x => x.proto === 'ospf').map(x => pad(ip.str(x.rid), 16) + pad('  1', 6) + pad('FULL/' + (P.ospfRid(n, d, x.pid) > x.rid ? 'BDR' : 'DR'), 16) + pad('00:00:3' + (x.rid % 9), 12) + pad(ip.str(x.ip), 16) + x.ifname)).join('\n'));
  add('ip eigrp neighbors', (n, d) => {
    const l = ((n.state().nbr || {})[d.id] || []).filter(x => x.proto === 'eigrp'); const asn = l[0] ? l[0].asn : Object.keys(d.cfg.eigrp)[0] || '';
    return ['IP-EIGRP neighbors for process ' + asn, 'H   Address         Interface      Hold Uptime    SRTT   RTO   Q   Seq', '                                   (sec)          (ms)        Cnt  Num'].concat(l.map((x, k) => pad(k, 4) + pad(ip.str(x.ip), 16) + pad(P.ifShort(x.ifname), 15) + pad('12', 5) + pad('00:01:05', 10) + pad('40', 7) + pad('1000', 6) + pad('0', 4) + '5')).join('\n');
  });
  add('ip dhcp binding', (n, d) => ['IP address       Client-ID/              Lease expiration        Type', '                 Hardware address'].concat(Object.entries(d.bindings).map(([a, m]) => pad(ip.str(+a), 17) + pad(P.macDot(m).toUpperCase(), 24) + pad('--', 24) + 'Automatic')).join('\n'));
  add('ip dhcp pool', (n, d) => Object.values(d.cfg.dhcp.pools).map(p => '\nPool ' + p.name + ' :\n Utilization mark (high/low)    : 100 / 0\n Subnet size (first/next)       : 0 / 0 \n Total addresses                : ' + (p.mask ? (1 << (32 - ip.len(p.mask))) - 2 : 0) + '\n Leased addresses               : ' + Object.keys(d.bindings).filter(a => p.net != null && ip.same(+a, p.net, p.mask)).length + '\n Excluded addresses             : ' + d.cfg.dhcp.excl.length + '\n Pending event                  : none').join('\n'));
  add('ip nat translations', (n, d) => ['Pro  Inside global     Inside local       Outside local      Outside global'].concat(
    d.cfg.nat.rules.filter(r => r.type === 'static').map(r => pad('---', 5) + pad(ip.str(r.global), 18) + pad(ip.str(r.local), 19) + pad('---', 19) + '---'),
    d.natT.filter(e => !e.stat || e.proto).filter(e => !e.stat).map(e => pad(e.proto, 5) + pad(ip.str(e.ig) + ':' + e.gp, 18) + pad(ip.str(e.il) + ':' + e.lp, 19) + pad(ip.str(e.ol) + ':' + e.op, 19) + ip.str(e.ol) + ':' + e.op)).join('\n'));
  add('ip nat statistics', (n, d) => 'Total translations: ' + d.natT.length + ' (' + d.cfg.nat.rules.filter(r => r.type === 'static').length + ' static, ' + d.natT.filter(e => !e.stat).length + ' dynamic, ' + d.natT.filter(e => !e.stat).length + ' extended)\nOutside Interfaces: ' + n.l3(d).filter(i => i.obj.nat === 'outside').map(i => i.name).join(', ') + '\nInside Interfaces: ' + n.l3(d).filter(i => i.obj.nat === 'inside').map(i => i.name).join(', '));
  add('spanning-tree', (n, d) => {
    if (d.type !== 'switch') return '% Invalid input'; const st = n.state(), r = (st.stpRoot || {})[d.id], root = r ? n.devs[r.root] : d;
    const o = ['VLAN0001', '  Spanning tree enabled protocol ieee', '  Root ID    Priority    ' + (root.cfg.stpPri + 1), '             Address     ' + P.macDot(root.baseMac), root === d ? '             This bridge is the root' : '             Cost        ' + r.cost + '\n             Port        ' + (r.rootPort ? r.rootPort : ''), '             Hello Time  2 sec  Max Age 20 sec  Forward Delay 15 sec', '', '  Bridge ID  Priority    ' + (d.cfg.stpPri + 1) + '  (priority ' + d.cfg.stpPri + ' sys-id-ext 1)', '             Address     ' + P.macDot(d.baseMac), '             Hello Time  2 sec  Max Age 20 sec  Forward Delay 15 sec', '             Aging Time  20', '', 'Interface        Role Sts Cost      Prio.Nbr Type', '---------------- ---- --- --------- -------- --------------------------------'];
    Object.values(d.ports).filter(p => p.sw && n.portUp(d, p.name) && !p.routed).forEach((p, k) => { const s = st.stp[d.id + '|' + p.name]; o.push(pad(P.ifShort(p.name), 17) + pad(s === 'BLK' ? 'Altn' : r && r.rootPort === p.name ? 'Root' : 'Desg', 5) + pad(s === 'BLK' ? 'BLK' : 'FWD', 4) + pad(p.kind === 'fa' ? 19 : 4, 10) + pad('128.' + (k + 1), 9) + 'P2p'); });
    return o.join('\n');
  });
  add('port-security', (n, d) => ['Secure Port MaxSecureAddr CurrentAddr SecurityViolation Security Action', '               (Count)       (Count)        (Count)', '--------------------------------------------------------------------'].concat(Object.values(d.ports).filter(p => p.sw && p.sw.ps && !p.sw.ps.off).map(p => pad(P.ifShort(p.name).padStart(11), 15) + pad(p.sw.ps.max, 14) + pad((p.sw.ps.macs || []).length, 12) + pad(p.sw.ps.count || 0, 18) + (p.sw.ps.viol[0].toUpperCase() + p.sw.ps.viol.slice(1)))).join('\n'));
  add('ip ssh', (n, d) => d.cfg.rsa ? 'SSH Enabled - version ' + (d.cfg.sshVer === 2 ? '2.0' : '1.99') + '\nAuthentication timeout: 120 secs; Authentication retries: 3' : '%SSH has not been enabled');
  add('ip interface IF', (n, d, v) => { const x = P.ifObj(d, v[3]); if (!x) return '%Invalid interface type and number'; const i = n.l3find(d, v[3]); return v[3] + ' is ' + status(n, d, x, v[3]) + ', line protocol is ' + (i && i.up ? 'up' : 'down') + (x.ip != null ? '\n  Internet address is ' + ip.str(x.ip) + '/' + ip.len(x.mask) + '\n  Broadcast address is 255.255.255.255' : '\n  Internet protocol processing disabled') + ((x.helper || []).length ? '\n  Helper address is ' + x.helper.map(ip.str).join(', ') : '\n  Helper address is not set') + '\n  Outgoing access list is ' + (x.aclOut || 'not set') + '\n  Inbound  access list is ' + (x.aclIn || 'not set'); });
})();

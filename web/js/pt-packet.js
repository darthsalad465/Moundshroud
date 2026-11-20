// Packet Tracer simulator, part 3: moving frames. An event queue delivers frames hop by hop: hubs repeat, switches
// learn MACs and forward per VLAN with 802.1Q tags and port security, routers and hosts do ARP, IP, ICMP, routing,
// ACLs and NAT. In Simulation mode every delivery is recorded as an event with notes for the PDU details window.
(() => {
  const G = typeof window !== 'undefined' ? window : globalThis;
  const P = G.PTSim; const ip = P.ip, B = P.BCAST_MAC, N = P.Net.prototype;
  const clone = o => JSON.parse(JSON.stringify(o));

  P.ptype = f => {
    if (f.type === 'arp') return 'ARP';
    const k = f.ip; if (!k) return '?';
    if (k.proto === 'icmp') return 'ICMP';
    if (k.proto === 'udp') return k.udp.app === 'dhcp' ? 'DHCP' : k.udp.app === 'dns' ? 'DNS' : 'UDP';
    if (k.proto === 'tcp') return k.tcp.http ? 'HTTP' : k.tcp.app === 'telnet' ? 'TELNET' : k.tcp.app === 'ssh' ? 'SSH' : 'TCP';
    return 'IP';
  };

  /* ---------- the queue ---------- */
  N.push = function (it) { it.s = ++this.pseq; const q = this.q; let i = q.length; while (i > 0 && (q[i - 1].t > it.t)) i--; q.splice(i, 0, it); };
  N.timer = function (delay, fn) { this.push({ t: this.t + delay, fn }); };
  N.note = function (s) { if (this.cur) this.cur.notes.push(s); };
  N.step = function () {
    if (!this.q.length) return null;
    const t0 = this.q[0].t; this.t = t0; const batch = [];
    while (this.q.length && this.q[0].t === t0) batch.push(this.q.shift());
    for (const it of batch) { if (it.fn) it.fn(); else this.deliver(it); }
    return batch;
  };
  N.runAll = function (limit) { let n = 0; limit = limit || 50000; while (this.q.length && n++ < limit) this.step(); };
  N.wait = function (key, fn) { this.waiters[key] = fn; };
  N.fire = function (key, v) { const f = this.waiters[key]; if (f) { delete this.waiters[key]; f(v); return true; } return false; };
  N.record = function (d, f, port, last) {
    if (!this.sim) return null;
    const ev = { n: this.events.length + 1, t: this.t, last: last || '--', at: d.name, dev: d.id, type: P.ptype(f), port, frame: clone(f), notes: [], out: [] };
    this.events.push(ev); if (this.events.length > 3000) this.events.shift(); return ev;
  };

  /* put a frame on the wire out of one port */
  N.xmit = function (d, port, f, onlyDev) {
    if (!this.cur && this.sim) this.cur = this.record(d, f, port, null), this._origin = true;
    let sent = 0;
    for (const a of this.attach(d)) {
      if (a.port !== port || a.L.type === 'console' || !this.linkUp(a.L.id) || !this.carry(d, port)) continue;
      if (onlyDev && a.peer.dev !== onlyDev) continue;
      const g = clone(f); g.hops = (f.hops || 0) + 1;
      this.push({ t: this.t + 1, dev: a.peer.dev, port: a.peer.port, frame: g, from: d.id, fromPort: port, link: a.L.id });
      if (this.cur) this.cur.out.push({ port, frame: g, to: this.devs[a.peer.dev].name });
      sent++;
    }
    if (this._origin) { this.cur = null; this._origin = false; }
    return sent;
  };

  N.deliver = function (it) {
    const d = this.devs[it.dev], f = it.frame; if (!d) return;
    const from = this.devs[it.from];
    this.cur = this.record(d, f, it.port, from ? from.name : '--'); if (this.cur) this.cur.item = it, it.ev = this.cur;
    try {
      if (!d.power) { this.note('The device is powered off and drops the frame.'); return; }
      if (f.hops > 64) { this.note('The frame has looped too many times and is dropped.'); return; }
      if (d.type === 'hub') { this.note('A hub repeats the frame out of every other port.'); for (const a of this.attach(d)) if (a.port !== it.port) this.xmit(d, a.port, f); return; }
      if (d.type === 'cloud' || d.type === 'ap') return this.bridge(d, it, f);
      if (d.type === 'switch' && d.ports[it.port] && d.ports[it.port].sw && !d.ports[it.port].routed) return this.switchRecv(d, it.port, f);
      this.portRecv(d, it.port, f);
    } finally { this.cur = null; }
  };

  /* clouds and access points: learning bridges without VLANs */
  N.bridge = function (d, it, f) {
    if (f.src !== B) d.mac[f.src] = { port: it.port, dev: it.from };
    const k = d.mac[f.dst];
    if (k && f.dst !== B) { this.note('The bridge knows where ' + P.macDot(f.dst) + ' is and forwards the frame.'); if (k.port === it.port && it.port !== 'Port 1') return; return this.xmit(d, k.port, f, k.port === 'Port 1' ? k.dev : null); }
    this.note('The destination is unknown or broadcast, so the frame goes out every other port.');
    const outs = new Set(this.attach(d).map(a => a.port));
    for (const o of outs) { if (o === it.port && o !== 'Port 1') continue; for (const a of this.attach(d)) if (a.port === o && !(o === it.port && a.peer.dev === it.from)) this.xmit(d, o, f, a.peer.dev); }
  };

  /* ---------- switches ---------- */
  N.switchRecv = function (d, port, f) {
    const p = d.ports[port];
    if (!this.carry(d, port)) { this.note('Port ' + port + ' is blocked by spanning tree, so the frame is dropped.'); return; }
    const trunk = this.isTrunk(d, port); let v;
    if (trunk) { v = f.vlan == null ? p.sw.native : f.vlan; if (p.sw.allowed && !p.sw.allowed.includes(v)) { this.note('VLAN ' + v + ' is not allowed on trunk ' + port + '. Dropped.'); return; } this.note('The frame arrives on trunk port ' + port + (f.vlan == null ? ' untagged, so it belongs to native VLAN ' + v : ' tagged for VLAN ' + v) + '.'); }
    else { if (f.vlan != null) { this.note('An access port drops tagged frames.'); return; } v = p.sw.vlan; this.note('The frame arrives on access port ' + port + ' in VLAN ' + v + '.'); }
    if (!d.cfg.vlans[v]) { this.note('VLAN ' + v + ' does not exist on this switch, so the port is inactive.'); return; }
    if (f.src !== B) {
      if (p.sw.ps && !trunk && !this.psec(d, p, f.src)) return;
      const k = v + '|' + f.src; if (!d.mac[k] || d.mac[k].port !== port) this.note('The switch learns ' + P.macDot(f.src) + ' on ' + port + '.'); d.mac[k] = { port, vlan: v, mac: f.src };
    }
    const g = clone(f); g.vlan = null;
    this.switchOut(d, v, g, port);
  };
  N.switchOut = function (d, v, f, inPort) {
    const svi = Object.values(d.svis).find(s => s.vlan === v);
    if (svi && (f.dst === d.baseMac || f.dst === B) && inPort != null) { const i = this.l3find(d, svi.name); if (i && i.up) { const sv = this.cur; this.l3Recv(d, i, clone(f)); this.cur = sv; } if (f.dst === d.baseMac) return; }
    const known = d.mac[v + '|' + f.dst];
    let outs;
    if (f.dst !== B && known && known.port !== inPort) { outs = [known.port]; this.note('The destination MAC is in the MAC table, so the frame goes out ' + known.port + '.'); }
    else if (f.dst !== B && known && known.port === inPort) { this.note('The destination is on the port the frame came in on. Dropped.'); return; }
    else { outs = Object.keys(d.ports).filter(n => n !== inPort && (this.portVlans(d, n) || []).includes(v) && this.fwd(d, n)); this.note((f.dst === B ? 'Broadcast frame' : 'Unknown destination MAC') + ': the switch floods VLAN ' + v + ' out ' + (outs.length ? outs.map(P.ifShort).join(', ') : 'no other port') + '.'); }
    for (const o of outs) { const q = d.ports[o]; if (!(this.portVlans(d, o) || []).includes(v)) continue; const g = clone(f); g.vlan = this.isTrunk(d, o) && q.sw.native !== v ? v : null; this.xmit(d, o, g); }
  };
  N.psec = function (d, p, mac) {
    const s = p.sw.ps; s.macs = s.macs || [];
    if (s.macs.includes(mac)) return true;
    if (s.macs.length < (s.max || 1)) { s.macs.push(mac); if (s.sticky) s.stickyMacs = (s.stickyMacs || []).concat(mac); return true; }
    this.note('Port security: ' + P.macDot(mac) + ' is not allowed on ' + p.name + '.');
    if ((s.viol || 'shutdown') === 'shutdown') { p.errdis = true; this.touch(); this.log(d, '%PM-4-ERR_DISABLE: psecure-violation error detected on ' + p.name + ', putting ' + p.name + ' in err-disable state'); }
    s.count = (s.count || 0) + 1; return false;
  };

  /* ---------- layer 3 ---------- */
  N.portRecv = function (d, port, f) {
    const ifs = this.l3(d).filter(i => i.port === port && i.up);
    const i = f.serial ? ifs.find(j => j.kind === 'phys') : f.vlan == null ? (ifs.find(j => j.kind === 'phys') || ifs.find(j => j.kind === 'sub' && j.native)) : ifs.find(j => j.kind === 'sub' && j.vlan === f.vlan);
    if (!i) { this.note(f.vlan != null ? 'No sub-interface on ' + port + ' uses VLAN ' + f.vlan + '. Dropped.' : 'Interface ' + port + ' is not up. Dropped.'); return; }
    if (!f.serial && f.dst !== B && f.dst !== i.mac) { this.note('The destination MAC ' + P.macDot(f.dst) + ' is not this port\'s MAC. The device drops the frame.'); return; }
    this.l3Recv(d, i, f);
  };
  const routerish = d => P.isIOS(d);
  N.myIps = function (d) { return this.l3(d).filter(i => i.up && i.ip != null); };
  N.l3Recv = function (d, i, f) {
    if (f.type === 'arp') return this.arpRecv(d, i, f.arp);
    const pk = f.ip; if (!pk) return;
    if (routerish(d) && i.obj.aclIn) { if (!this.aclPermit(d, i.obj.aclIn, pk)) { this.note('Inbound access list ' + i.obj.aclIn + ' on ' + i.name + ' denies the packet.'); return this.icmpErr(d, i, pk, 3, 13); } this.note('Inbound access list ' + i.obj.aclIn + ' permits the packet.'); }
    if (routerish(d) && i.obj.nat === 'outside') this.natIn(d, pk);
    const mine = this.myIps(d);
    const bc = pk.dst === 0xffffffff || (i.ip != null && i.mask != null && ip.len(i.mask) < 31 && pk.dst === ip.bcast(i.ip, i.mask));
    if (pk.proto === 'udp' && pk.udp.app === 'dhcp' && pk.udp.dp === 67 && routerish(d)) return this.dhcpAtRouter(d, i, pk, bc);
    if (bc || mine.some(j => j.ip === pk.dst)) { this.note('The packet is addressed to this device.'); return this.local(d, i, pk, bc); }
    if (routerish(d) && d.cfg.ipRouting) return this.forward(d, i, pk);
    this.note('The packet is not for this device and it does not route. Dropped.');
  };
  N.arpRecv = function (d, i, a) {
    if (i.ip == null || a.tip !== i.ip) {
      /* proxy ARP: a router answers for an address it routes out of a different interface */
      if (a.op === 1 && i.ip != null && d.type === 'router' && d.cfg.ipRouting && ip.same(a.sip, i.ip, i.mask) && !ip.same(a.tip, i.ip, i.mask)) {
        const r = P.lookup(this, d, a.tip);
        if (r && r.out !== i.name) { d.arp[a.sip] = { mac: a.smac, ifn: i.name, t: this.t }; this.note('Proxy ARP: the router answers for ' + ip.str(a.tip) + ' because it routes there.'); return this.l2send(d, i, { src: i.mac, dst: a.smac, type: 'arp', arp: { op: 2, smac: i.mac, sip: a.tip, tmac: a.smac, tip: a.sip } }); }
      }
      if (a.op === 1) this.note('The ARP request is for ' + ip.str(a.tip) + ', not this device. Ignored.'); return;
    }
    d.arp[a.sip] = { mac: a.smac, ifn: i.name, t: this.t };
    if (a.op === 1) {
      this.note('The ARP request asks for this device\'s address. It records the sender and replies.');
      this.l2send(d, i, { src: i.mac, dst: a.smac, type: 'arp', arp: { op: 2, smac: i.mac, sip: i.ip, tmac: a.smac, tip: a.sip } });
    } else {
      this.note('The ARP reply fills in ' + ip.str(a.sip) + ' = ' + P.macDot(a.smac) + '. Queued packets are sent.');
      const pend = d.pending[a.sip]; delete d.pending[a.sip];
      if (pend) for (const x of pend) { const j = this.l3find(d, x.ifn); if (j) this.l3out(d, j, a.sip, x.pk); }
    }
  };
  /* frames out of a layer-3 interface */
  N.l2send = function (d, i, f) {
    const p = i.port && d.ports[i.port];
    if (i.kind === 'svi') return this.switchOut(d, i.vlan, Object.assign(f, { src: d.baseMac }), null);
    if (p && p.kind === 'serial') { f.serial = true; f.src = ''; f.dst = ''; }
    f.vlan = i.kind === 'sub' && !i.native ? i.vlan : null;
    this.xmit(d, i.port, f);
  };
  N.l3out = function (d, i, nh, pk, fwd) {
    const p = i.port && d.ports[i.port];
    if (p && p.kind === 'serial') return this.l2send(d, i, { type: 'ip', ip: pk });
    if (nh === 0xffffffff || (i.mask != null && ip.len(i.mask) < 31 && nh === ip.bcast(i.ip, i.mask))) return this.l2send(d, i, { src: i.mac, dst: B, type: 'ip', ip: pk });
    const e = d.arp[nh];
    if (e) return this.l2send(d, i, { src: i.mac, dst: e.mac, type: 'ip', ip: pk });
    this.note('The ARP table has no entry for ' + ip.str(nh) + ', so the device sends an ARP request' + (d.cfg && d.cfg.ipRouting ? ' and drops this packet.' : ' and holds the packet.'));
    if (!(d.cfg && d.cfg.ipRouting)) { const q = d.pending[nh] = d.pending[nh] || []; if (q.length < 4) q.push({ ifn: i.name, pk }); }
    const w = d.arpWait = d.arpWait || {};
    if (w[nh] != null && this.t - w[nh] < 8) return;
    w[nh] = this.t;
    this.l2send(d, i, { src: i.mac, dst: B, type: 'arp', arp: { op: 1, smac: i.mac, sip: i.ip, tmac: '000000000000', tip: nh } });
  };

  /* originate an IP packet from this device; returns false when it has no way to send it */
  N.sendIp = function (d, pk, viaIf) {
    if (!d.power) return false;
    pk.ttl = pk.ttl || (P.isHost(d) ? 128 : 255);
    if (viaIf) { if (pk.src == null) pk.src = viaIf.ip || 0; return this.l3out(d, viaIf, pk.dst, pk), true; }
    if (P.isIOS(d) && d.cfg.ipRouting) {
      if (this.myIps(d).some(j => j.ip === pk.dst)) { if (pk.src == null) pk.src = pk.dst; this.timer(1, () => this.local(d, this.myIps(d).find(j => j.ip === pk.dst), pk, false)); return true; }
      const r = P.lookup(this, d, pk.dst); if (!r) return false;
      const o = this.l3find(d, r.out); if (!o || !o.up) return false;
      if (pk.src == null) pk.src = o.ip;
      this.l3out(d, o, r.nh != null ? r.nh : pk.dst, pk); return true;
    }
    const ifs = this.myIps(d).filter(i => i.kind !== 'lo'); if (!ifs.length) return false;
    let i = ifs.find(j => ip.same(j.ip, pk.dst, j.mask)) || ifs[0];
    if (pk.src == null) pk.src = i.ip;
    if (pk.dst === i.ip) { this.timer(1, () => this.local(d, i, pk, false)); return true; }
    if (pk.dst === 0xffffffff || ip.same(i.ip, pk.dst, i.mask)) { this.l3out(d, i, pk.dst, pk); return true; }
    const gw = P.hostGw(d); if (gw == null || !ip.same(gw, i.ip, i.mask)) return false;
    this.l3out(d, i, gw, pk); return true;
  };

  N.forward = function (d, i, pk) {
    pk.ttl--;
    if (pk.ttl <= 0) { this.note('The TTL reached 0. The router drops the packet and sends ICMP time exceeded.'); return this.icmpErr(d, i, pk, 11, 0); }
    const r = P.lookup(this, d, pk.dst);
    if (!r) { this.note('The routing table has no route to ' + ip.str(pk.dst) + '. The router drops the packet.'); return this.icmpErr(d, i, pk, 3, 0); }
    const o = this.l3find(d, r.out); if (!o || !o.up) { this.note('The exit interface ' + r.out + ' is down.'); return; }
    this.note('The router looks up ' + ip.str(pk.dst) + ' and uses route ' + ip.str(r.route.net) + '/' + r.route.len + ' (' + r.route.code + ') out ' + o.name + '.');
    if (i.obj.nat === 'inside' && o.obj.nat === 'outside') this.natOut(d, pk);
    if (o.obj.aclOut && !this.aclPermit(d, o.obj.aclOut, pk)) { this.note('Outbound access list ' + o.obj.aclOut + ' on ' + o.name + ' denies the packet.'); return this.icmpErr(d, i, pk, 3, 13); }
    this.l3out(d, o, r.nh != null ? r.nh : pk.dst, pk, true);
  };
  N.icmpErr = function (d, i, pk, type, code) {
    if (pk.proto === 'icmp' && pk.icmp.type !== 8) return;
    const src = i && i.ip != null ? i.ip : (this.myIps(d)[0] || {}).ip; if (src == null) return;
    this.sendIp(d, { src, dst: pk.src, proto: 'icmp', icmp: { type, code, id: pk.icmp ? pk.icmp.id : 0, seq: pk.icmp ? pk.icmp.seq : 0, orig: { dst: pk.dst, proto: pk.proto } } });
  };

  /* ---------- traffic addressed to this device ---------- */
  N.local = function (d, i, pk, bc) {
    if (pk.proto === 'icmp') {
      const c = pk.icmp;
      if (c.type === 8) { this.note('ICMP echo request: the device sends an echo reply.'); return this.sendIp(d, { src: bc ? i.ip : pk.dst, dst: pk.src, proto: 'icmp', icmp: { type: 0, code: 0, id: c.id, seq: c.seq } }); }
      this.note('ICMP ' + (c.type === 0 ? 'echo reply' : c.type === 11 ? 'time exceeded' : 'destination unreachable') + ' received.');
      return this.fire('icmp:' + d.id + ':' + c.id + ':' + c.seq, { type: c.type, code: c.code, from: pk.src, ttl: pk.ttl, t: this.t });
    }
    if (pk.proto === 'udp') {
      const u = pk.udp;
      if (u.app === 'dhcp' && u.dp === 68) { if (u.dhcp.chaddr !== i.mac) { this.note('The DHCP reply is for another client (' + P.macDot(u.dhcp.chaddr) + '). Ignored.'); return; } return this.fire('dhcp:' + d.id + ':' + u.dhcp.xid, { dhcp: u.dhcp, i }); }
      if (u.app === 'dhcp' && u.dp === 67 && d.svc && d.svc.dhcp.on) return this.dhcpServe(d, i, pk);
      if (u.app === 'dns' && u.dp === 53 && d.svc && d.svc.dns.on) return this.dnsServe(d, pk);
      if (u.app === 'dns' && u.sp === 53) return this.fire('dns:' + d.id + ':' + u.dns.id, u.dns);
      this.note('No service listens on UDP port ' + u.dp + '.'); return;
    }
    if (pk.proto === 'tcp') {
      const c = pk.tcp;
      if (c.dp === 80 || c.dp === 23 || c.dp === 22) return this.tcpServe(d, pk);
      return this.fire('tcp:' + d.id + ':' + c.dp, pk);
    }
  };

  /* ---------- access lists ---------- */
  const PORTS = { www: 80, http: 80, domain: 53, telnet: 23, ftp: 21, smtp: 25, pop3: 110, bootps: 67, bootpc: 68, tftp: 69, snmp: 161, 22: 22 };
  P.portNum = s => /^\d+$/.test(s) ? +s : PORTS[String(s).toLowerCase()];
  P.aclMatch = function (r, pk) {
    if (!ip.wildMatch(pk.src, r.src, r.swild)) return false;
    if (r.std) return true;
    if (r.proto !== 'ip' && r.proto !== pk.proto) return false;
    if (!ip.wildMatch(pk.dst, r.dst, r.dwild)) return false;
    if (r.op && (pk.proto === 'tcp' || pk.proto === 'udp')) {
      const p = pk[pk.proto].dp;
      if (r.op === 'eq' && p !== r.p1) return false; if (r.op === 'neq' && p === r.p1) return false;
      if (r.op === 'gt' && !(p > r.p1)) return false; if (r.op === 'lt' && !(p < r.p1)) return false;
      if (r.op === 'range' && !(p >= r.p1 && p <= r.p2)) return false;
    } else if (r.op) return false;
    if (r.icmp != null && (pk.proto !== 'icmp' || pk.icmp.type !== r.icmp)) return false;
    return true;
  };
  N.aclPermit = function (d, name, pk) {
    const acl = d.cfg.acls[name]; if (!acl || !acl.rules.length) return true;
    for (const r of acl.rules) if (!r.remark && P.aclMatch(r, pk)) { r.hits = (r.hits || 0) + 1; return r.action === 'permit'; }
    return false;
  };

  /* ---------- NAT and PAT ---------- */
  const l4 = (pk, side) => pk.proto === 'icmp' ? pk.icmp.id : pk.proto === 'udp' || pk.proto === 'tcp' ? pk[pk.proto][side === 'src' ? 'sp' : 'dp'] : 0;
  const setL4 = (pk, side, v) => { if (pk.proto === 'icmp') pk.icmp.id = v; else if (pk.proto === 'udp' || pk.proto === 'tcp') pk[pk.proto][side === 'src' ? 'sp' : 'dp'] = v; };
  N.natOut = function (d, pk) {
    const nat = d.cfg.nat, il = pk.src, lp = l4(pk, 'src');
    const st = nat.rules.find(r => r.type === 'static' && r.local === il);
    if (st) { pk.src = st.global; this.note('Static NAT translates ' + ip.str(il) + ' to ' + ip.str(st.global) + '.'); this.natEntry(d, { proto: pk.proto, il, lp, ig: st.global, gp: lp, ol: pk.dst, op: l4(pk, 'dst'), stat: true }); return; }
    for (const r of nat.rules) {
      if (r.type !== 'list' || !this.aclPermit(d, r.acl, { src: il, dst: pk.dst, proto: 'ip' })) continue;
      let gip = null;
      if (r.iface) { const o = this.l3find(d, r.iface); gip = o && o.ip; }
      else { const pl = nat.pools[r.pool]; if (!pl) continue;
        if (r.overload) gip = pl.start;
        else { const ex = d.natT.find(e => e.il === il && !e.stat); if (ex) gip = ex.ig; else for (let a = pl.start; a <= pl.end; a++) if (!d.natT.some(e => e.ig === a)) { gip = a; break; } }
      }
      if (gip == null) { this.note('The NAT pool is exhausted. The packet is dropped.'); return; }
      let gp = lp;
      const ex = d.natT.find(e => e.proto === pk.proto && e.il === il && e.lp === lp);
      if (ex) gp = ex.gp; else if (r.overload) { while (d.natT.some(e => e.ig === gip && e.gp === gp && e.proto === pk.proto)) gp = gp < 1024 ? 1024 : gp + 1; }
      pk.src = gip; setL4(pk, 'src', gp);
      this.natEntry(d, { proto: pk.proto, il, lp, ig: gip, gp, ol: pk.dst, op: l4(pk, 'dst') });
      this.note((r.overload ? 'PAT' : 'Dynamic NAT') + ' translates ' + ip.str(il) + ':' + lp + ' to ' + ip.str(gip) + ':' + gp + '.');
      return;
    }
  };
  N.natEntry = function (d, e) { if (!d.natT.some(x => x.proto === e.proto && x.il === e.il && x.lp === e.lp && x.ig === e.ig && x.gp === e.gp)) d.natT.push(e); };
  N.natIn = function (d, pk) {
    const gp = l4(pk, 'dst');
    const e = d.natT.find(x => x.ig === pk.dst && !x.stat && x.proto === pk.proto && x.gp === gp);
    if (e) { this.note('NAT translates the destination ' + ip.str(pk.dst) + ':' + gp + ' back to ' + ip.str(e.il) + ':' + e.lp + '.'); pk.dst = e.il; setL4(pk, 'dst', e.lp); return; }
    const st = d.cfg.nat.rules.find(r => r.type === 'static' && r.global === pk.dst);
    if (st) { this.note('Static NAT translates ' + ip.str(pk.dst) + ' back to ' + ip.str(st.local) + '.'); pk.dst = st.local; }
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = P;
})();

// Packet Tracer simulator, part 4: the programs that make traffic. Ping and traceroute, the DHCP client, router DHCP
// pools and relay (ip helper-address), the server's DHCP, DNS and HTTP services, the web browser's HTTP fetch, and the
// TCP connect used by telnet and ssh. Everything is event driven, so the same code runs in Realtime and Simulation.
(() => {
  const G = typeof window !== 'undefined' ? window : globalThis;
  const P = G.PTSim; const ip = P.ip, N = P.Net.prototype;
  const TMO = 80;   // ticks before a request counts as lost

  /* ---------- ping ---------- */
  N.ping = function (d, dst, o) {
    o = o || {}; const count = o.count || 4, id = ++this.pseq & 0xffff; let seq = 0, got = 0;
    const res = [];
    const next = () => {
      if (seq >= count) { o.onDone && o.onDone({ sent: count, got, res }); return; }
      const s = ++seq, key = 'icmp:' + d.id + ':' + id + ':' + s, t0 = this.t;
      let done = false;
      const fin = r => { if (done) return; done = true; res.push(r); if (r.ok) got++; o.onReply && o.onReply(r, s); this.timer(o.gap || 2, next); };
      this.wait(key, v => fin(v.type === 0 ? { ok: true, from: v.from, ttl: v.ttl, ms: Math.max(0, (v.t - t0) - 2) } : { ok: false, kind: v.type === 11 ? 'ttl' : v.code === 13 ? 'admin' : 'unreach', from: v.from }));
      const okSend = this.sendIp(d, { dst: dst, ttl: o.ttl, proto: 'icmp', icmp: { type: 8, code: 0, id, seq: s }, src: o.src });
      this.timer(TMO, () => { delete this.waiters[key]; fin({ ok: false, kind: okSend ? 'timeout' : 'nosend' }); });
    };
    next();
  };

  /* ---------- traceroute (ICMP probes with rising TTL) ---------- */
  N.trace = function (d, dst, o) {
    o = o || {}; const max = o.max || 30, probes = o.probes || 3, id = ++this.pseq & 0xffff; let ttl = 0, seq = 0;
    const hop = () => {
      if (++ttl > max) return o.onDone && o.onDone(false);
      const rs = []; let k = 0;
      const probe = () => {
        if (k++ >= probes) { o.onHop && o.onHop(ttl, rs); if (rs.some(r => r.ok && r.from === dst) || rs.some(r => r.kind === 'unreach')) return o.onDone && o.onDone(true); return this.timer(1, hop); }
        const s = ++seq, key = 'icmp:' + d.id + ':' + id + ':' + s, t0 = this.t; let done = false;
        const fin = r => { if (done) return; done = true; rs.push(r); this.timer(1, probe); };
        this.wait(key, v => fin({ ok: v.type === 0 || v.type === 11, kind: v.type === 3 ? 'unreach' : '', from: v.from, ms: Math.max(0, v.t - t0 - 2) }));
        this.sendIp(d, { dst, ttl, proto: 'icmp', icmp: { type: 8, code: 0, id, seq: s } });
        this.timer(TMO, () => { delete this.waiters[key]; fin({ ok: false, kind: 'timeout' }); });
      };
      probe();
    };
    hop();
  };

  /* ---------- DHCP client ---------- */
  N.dhcpClient = function (d, portName, cb) {
    const p = d.ports[portName]; let tries = 0;
    const i = () => this.l3find(d, portName);
    const fail = () => { const a = 0xa9fe0000 | ((parseInt(p.mac.slice(-4), 16) % 65000) + 256); p.ip = a; p.mask = ip.toInt('255.255.0.0'); d.host.gw = null; this.touch(); cb && cb(false); };
    const go = () => {
      if (++tries > 3) return fail();
      const xid = (Math.random() * 0x7fffffff) | 0, key = 'dhcp:' + d.id + ':' + xid; let stage = 'offer';
      const bcast = msg => { const j = i(); if (!j || !j.up) return; this.l3out(d, Object.assign({}, j, { ip: 0 }), 0xffffffff, { src: 0, dst: 0xffffffff, ttl: 128, proto: 'udp', udp: { sp: 68, dp: 67, app: 'dhcp', dhcp: msg } }); };
      this.wait(key, function on(v) {
        const m = v.dhcp;
        if (stage === 'offer' && m.op === 'OFFER') { stage = 'ack'; this.wait(key, on.bind(this)); bcast({ op: 'REQUEST', xid, chaddr: p.mac, req: m.yiaddr, server: m.server, giaddr: 0 }); }
        else if (stage === 'ack' && m.op === 'ACK') { stage = 'done'; p.ip = m.yiaddr; p.mask = m.mask; d.host.gw = m.gw; d.host.dns = m.dns; d.arp = {}; this.touch(); cb && cb(true, m); }
      }.bind(this));
      bcast({ op: 'DISCOVER', xid, chaddr: p.mac, giaddr: 0 });
      this.timer(TMO, () => { if (stage !== 'done') { delete this.waiters[key]; go(); } });
    };
    p.ip = null; p.mask = null; this.touch(); go();
  };

  /* routers: serve from a local pool, else relay to the ip helper-address */
  N.dhcpAtRouter = function (d, i, pk, bc) {
    const m = pk.udp.dhcp;
    if (m.op === 'OFFER' || m.op === 'ACK') {
      const out = this.myIps(d).find(j => j.ip === m.giaddr); if (!out) return;
      this.note('The relay agent passes the DHCP ' + m.op + ' back to the client network on ' + out.name + '.');
      return this.l3out(d, out, 0xffffffff, { src: out.ip, dst: 0xffffffff, ttl: 255, proto: 'udp', udp: { sp: 67, dp: 68, app: 'dhcp', dhcp: m } });
    }
    const key = m.giaddr || i.ip;
    const pool = key != null && Object.values(d.cfg.dhcp.pools).find(pl => pl.net != null && ip.same(key, pl.net, pl.mask));
    if (pool) return this.dhcpServe(d, i, pk);
    if (i.obj.helper && i.obj.helper.length && !m.giaddr) {
      this.note('ip helper-address: the router relays the DHCP broadcast to ' + i.obj.helper.map(ip.str).join(', ') + '.');
      for (const h of i.obj.helper) this.sendIp(d, { src: i.ip, dst: h, proto: 'udp', udp: { sp: 67, dp: 67, app: 'dhcp', dhcp: Object.assign({}, m, { giaddr: i.ip }) } });
      return;
    }
    if (!bc && this.myIps(d).some(j => j.ip === pk.dst)) return;
    this.note('No DHCP pool matches this network and no helper address is set. Dropped.');
  };
  N.dhcpServe = function (d, i, pk) {
    const m = pk.udp.dhcp, key = m.giaddr || i.ip; let pool, addrs = [];
    const used = new Set(Object.keys(d.bindings).map(Number).filter(a => d.bindings[a] !== m.chaddr));
    this.myIps(d).forEach(j => used.add(j.ip));
    if (d.svc) {
      pool = d.svc.dhcp.pools.find(pl => key != null && ip.same(key, pl.start, pl.mask)) || (!m.giaddr && d.svc.dhcp.pools[0]);
      if (pool) for (let k = 0; k < (pool.max || 256); k++) addrs.push((pool.start + k) >>> 0);
    } else {
      pool = Object.values(d.cfg.dhcp.pools).find(pl => pl.net != null && ip.same(key, pl.net, pl.mask));
      if (pool) { const lo = ip.net(pool.net, pool.mask) + 1, hi = ip.bcast(pool.net, pool.mask) - 1; for (let a = lo; a <= hi && addrs.length < 1024; a++) if (!d.cfg.dhcp.excl.some(([x, y]) => a >= x && a <= y)) addrs.push(a >>> 0); }
    }
    if (!pool) { this.note('No DHCP pool matches ' + ip.str(key) + '.'); return; }
    if (pool.gw != null) used.add(pool.gw);
    let yi = Object.keys(d.bindings).map(Number).find(a => d.bindings[a] === m.chaddr);
    if (m.op === 'REQUEST' && m.req != null) yi = m.req;
    if (yi == null) yi = addrs.find(a => !used.has(a));
    if (yi == null) { this.note('The DHCP pool is out of addresses.'); return; }
    const op = m.op === 'DISCOVER' ? 'OFFER' : 'ACK';
    if (op === 'ACK') d.bindings[yi] = m.chaddr;
    const mask = pool.mask, rep = { op, xid: m.xid, yiaddr: yi, mask, gw: pool.gw, dns: pool.dns, server: i.ip, chaddr: m.chaddr, giaddr: m.giaddr };
    this.note('DHCP ' + m.op + ': the ' + (d.svc ? 'server' : 'router') + ' answers with ' + op + ' for ' + ip.str(yi) + ' from pool ' + pool.name + '.');
    if (m.giaddr) return this.sendIp(d, { src: i.ip, dst: m.giaddr, proto: 'udp', udp: { sp: 67, dp: 67, app: 'dhcp', dhcp: rep } });
    this.l3out(d, i, 0xffffffff, { src: i.ip, dst: 0xffffffff, ttl: P.isHost(d) ? 128 : 255, proto: 'udp', udp: { sp: 67, dp: 68, app: 'dhcp', dhcp: rep } });
  };

  /* ---------- DNS ---------- */
  N.dnsServe = function (d, pk) {
    const q = pk.udp.dns, recs = d.svc.dns.recs; let name = q.q.toLowerCase(), a = null;
    for (let k = 0; k < 5 && a == null; k++) { const r = recs.find(x => x.name.toLowerCase() === name); if (!r) break; if (r.type === 'A') a = ip.toInt(r.val); else name = String(r.val).toLowerCase(); }
    this.note(a != null ? 'The DNS server finds ' + q.q + ' = ' + ip.str(a) + '.' : 'The DNS server has no record for ' + q.q + '.');
    this.sendIp(d, { dst: pk.src, proto: 'udp', udp: { sp: 53, dp: pk.udp.sp, app: 'dns', dns: { id: q.id, q: q.q, a } } });
  };
  N.resolve = function (d, name, cb) {
    const n = ip.toInt(name); if (n != null) return cb(n);
    const dns = d.host ? d.host.dns : null; if (dns == null) return cb(null);
    let tries = 0;
    const go = () => {
      if (++tries > 2) return cb(null);
      const id = ++this.pseq, sp = 1025 + (id % 60000), key = 'dns:' + d.id + ':' + id; let done = false;
      this.wait(key, v => { done = true; cb(v.a); });
      this.sendIp(d, { dst: dns, proto: 'udp', udp: { sp, dp: 53, app: 'dns', dns: { id, q: name } } });
      this.timer(TMO, () => { if (!done) { delete this.waiters[key]; go(); } });
    };
    go();
  };

  /* ---------- TCP: web, telnet and ssh ---------- */
  N.tcpServe = function (d, pk) {
    const c = pk.tcp, rep = (flags, extra) => this.sendIp(d, { dst: pk.src, proto: 'tcp', tcp: Object.assign({ sp: c.dp, dp: c.sp, flags, app: c.app }, extra || {}) });
    if (c.dp === 80) {
      if (!d.svc || !d.svc.http.on) { this.note('HTTP is off on this device. No answer.'); return; }
      if (c.flags === 'SYN') { this.note('The web server accepts the connection (SYN+ACK).'); return rep('SYN+ACK'); }
      if (c.http && c.http.method) {
        const path = (c.http.path || '/').replace(/^\//, '') || 'index.html', body = d.svc.http.files[path];
        this.note('HTTP GET /' + path + ': the server answers ' + (body != null ? '200 OK' : '404 Not Found') + '.');
        return rep('PSH+ACK', { http: { status: body != null ? 200 : 404, body: body != null ? body : '<html><body><h2>404 Not Found</h2><p>The file ' + path + ' is not on this server.</p></body></html>' } });
      }
      return;
    }
    if (!P.isIOS(d) || c.flags !== 'SYN') return;
    const vty = d.cfg.lines.vty, t = vty.transport, want = c.dp === 23 ? 'telnet' : 'ssh';
    const ok = (t === 'all' || t === want) && (want !== 'ssh' || d.cfg.rsa);
    this.note(ok ? 'The device accepts the ' + want + ' connection on its vty lines.' : 'The vty lines do not accept ' + want + '. The device resets the connection.');
    rep(ok ? 'SYN+ACK' : 'RST');
  };
  N.connect = function (d, dst, port, cb, extra) {
    let tries = 0;
    const go = () => {
      if (++tries > 3) return cb({ ok: false, kind: 'timeout' });
      const sp = 1025 + (++this.pseq % 60000), key = 'tcp:' + d.id + ':' + sp; let done = false;
      this.wait(key, v => { done = true; cb(v.tcp.flags === 'RST' ? { ok: false, kind: 'refused' } : { ok: true, sp, from: v.src }); });
      const sent = this.sendIp(d, { dst, proto: 'tcp', tcp: Object.assign({ sp, dp: port, flags: 'SYN', app: port === 80 ? 'http' : port === 23 ? 'telnet' : 'ssh' }, extra || {}) });
      this.timer(TMO, () => { if (!done) { delete this.waiters[key]; go(); } });
      if (!sent && tries === 1) { /* keep trying: the gateway ARP may still be resolving */ }
    };
    go();
  };
  N.http = function (d, url, cb) {
    const m = /^(?:https?:\/\/)?([^/\s]+)(\/[^\s]*)?$/i.exec(String(url).trim()); if (!m) return cb({ ok: false, err: 'Bad URL' });
    const host = m[1], path = m[2] || '/';
    this.resolve(d, host, a => {
      if (a == null) return cb({ ok: false, err: 'Host Name Unresolved' });
      this.connect(d, a, 80, r => {
        if (!r.ok) return cb({ ok: false, err: 'Request Timeout' });
        const key = 'tcp:' + d.id + ':' + r.sp; let done = false;
        this.wait(key, v => { done = true; cb({ ok: true, status: v.tcp.http ? v.tcp.http.status : 0, body: v.tcp.http ? v.tcp.http.body : '', host, ip: a, path }); });
        this.sendIp(d, { dst: a, proto: 'tcp', tcp: { sp: r.sp, dp: 80, flags: 'PSH+ACK', app: 'http', http: { method: 'GET', path, host } } });
        this.timer(TMO, () => { if (!done) { delete this.waiters[key]; cb({ ok: false, err: 'Request Timeout' }); } });
      });
    });
  };

  /* first usable IP of a device, for Simple PDUs and lab checks */
  P.primaryIp = (net, d) => { const i = net.l3(d).find(j => j.ip != null && j.up && j.kind !== 'lo') || net.l3(d).find(j => j.ip != null); return i ? i.ip : null; };
})();

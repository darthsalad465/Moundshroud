// Packet Tracer simulator, part 2: layer-2 reachability and routing. Walks broadcast domains through switches,
// trunks, hubs and access points; finds RIP, OSPF and EIGRP neighbours; computes their routes; and builds each
// router's routing table (connected, local, static, dynamic) with longest-prefix lookup.
(() => {
  const G = typeof window !== 'undefined' ? window : globalThis;
  const P = G.PTSim; const ip = P.ip;

  /* every cable attached to a device, wireless associations included */
  P.Net.prototype.attach = function (d) {
    const out = [];
    for (const p of Object.values(d.ports)) if (p.link && this.links[p.link]) { const L = this.links[p.link]; out.push({ port: p.name, L, peer: L.a.dev === d.id && L.a.port === p.name ? L.b : L.a }); }
    if (d.type === 'ap') for (const L of Object.values(this.links)) if (L.type === 'wireless' && L.a.dev === d.id) out.push({ port: 'Port 1', L, peer: L.b });
    return out;
  };
  P.Net.prototype.carry = function (d, port) {      // can a frame leave this port right now?
    const p = d.ports[port];
    if (d.type === 'ap' && port === 'Port 1') return d.power;
    if (!p || !this.portUp(d, port)) return false;
    return this.fwd(d, port);
  };

  /* every layer-3 interface in the same broadcast domain as interface i of device d */
  P.l2reach = function (net, d, i) {
    const found = [], seen = new Set(), q = [];
    const send = (dev, port, tag) => {
      for (const a of net.attach(dev)) if (a.port === port && net.linkUp(a.L.id) && net.carry(dev, port)) {
        if (a.L.type === 'console') continue;
        q.push([net.devs[a.peer.dev], a.peer.port, tag]);
      }
    };
    const inVlan = (sw, v, except) => { for (const n of Object.keys(sw.ports)) { if (n === except) continue; const vs = net.portVlans(sw, n); if (!vs || !vs.includes(v) || !net.fwd(sw, n)) continue; send(sw, n, net.isTrunk(sw, n) && sw.ports[n].sw.native !== v ? v : null); } };
    if (i.kind === 'svi') inVlan(d, i.vlan, null);
    else if (i.kind === 'sub') { const par = d.ports[i.port]; send(d, i.port, i.native ? null : i.vlan); }
    else if (i.kind === 'phys') send(d, i.port, null);
    while (q.length) {
      const [x, port, tag] = q.shift(), key = x.id + '|' + port + '|' + tag; if (seen.has(key)) continue; seen.add(key);
      if (!x.power) continue;
      const p = x.ports[port];
      if (x.type === 'switch' && p && p.sw && !p.routed) {
        if (!net.carry(x, port)) continue;
        const trunk = net.isTrunk(x, port); let v;
        if (trunk) { v = tag == null ? p.sw.native : tag; if (p.sw.allowed && !p.sw.allowed.includes(v)) continue; }
        else { if (tag != null) continue; v = p.sw.vlan; }
        if (!x.cfg.vlans[v]) continue;
        const svi = Object.values(x.svis).find(s => s.vlan === v); if (svi) { const s2 = net.l3find(x, svi.name); if (s2 && s2.up) found.push({ dev: x, i: s2 }); }
        inVlan(x, v, port);
      } else if (x.type === 'hub' || x.type === 'cloud' || x.type === 'ap') {
        const outs = new Set(net.attach(x).map(a => a.port)); outs.delete(port); if (x.type === 'ap' && port === 'Port 1') outs.add('Port 1');
        for (const o of outs) send(x, o, tag);
      } else {
        const ifs = net.l3(x).filter(j => j.up && (j.port === port));
        const hit = tag == null ? ifs.find(j => j.kind === 'phys') || ifs.find(j => j.kind === 'sub' && j.native) : ifs.find(j => j.kind === 'sub' && j.vlan === tag);
        if (hit) found.push({ dev: x, i: hit });
      }
    }
    return found.filter(f => !(f.dev === d && f.i.name === i.name));
  };

  /* ---------- dynamic routing ---------- */
  const routes = net => Object.values(net.devs).filter(d => P.isIOS(d) && d.power && d.cfg.ipRouting);
  const matchProto = (d, i, proto) => {
    if (!i.up || i.ip == null) return null;
    if (proto === 'rip') { const r = d.cfg.rip; if (!r) return null; return r.nets.includes(ip.classful(i.ip).net) ? { id: 'rip', passive: r.passive.includes(i.name) } : null; }
    if (proto === 'ospf') { for (const [pid, o] of Object.entries(d.cfg.ospf)) for (const n of o.nets) if (ip.wildMatch(i.ip, n.ip, n.wild)) return { id: 'ospf', pid, area: n.area, passive: o.passive.includes(i.name) }; return null; }
    if (proto === 'eigrp') { for (const [asn, o] of Object.entries(d.cfg.eigrp)) for (const n of o.nets) if (n.wild != null ? ip.wildMatch(i.ip, n.ip, n.wild) : ip.classful(i.ip).net === ip.classful(n.ip).net) return { id: 'eigrp:' + asn, asn, passive: o.passive.includes(i.name) }; return null; }
    return null;
  };
  P.ospfRid = (net, d, pid) => {
    const o = d.cfg.ospf[pid]; if (o && o.rid) return o.rid;
    const ifs = net.l3(d).filter(i => i.up && i.ip != null), lo = ifs.filter(i => i.kind === 'lo');
    const pick = (lo.length ? lo : ifs).map(i => i.ip >>> 0).sort((a, b) => b - a)[0];
    return pick == null ? 0 : pick;
  };
  const staticDefault = (net, d) => d.cfg.routes.some(r => r.net === 0 && r.mask === 0 && staticOk(net, d, r));
  function staticOk(net, d, r) {
    if (r.iface) { const i = net.l3find(d, r.iface); return !!(i && i.up); }
    return net.l3(d).some(i => i.up && i.ip != null && ip.same(i.ip, r.nh, i.mask));
  }
  P.routing = function (net, st) {
    st.nbr = {}; st.dyn = {};
    const rs = routes(net);
    for (const proto of ['rip', 'ospf', 'eigrp']) {
      const edges = {}, prefixes = {};
      for (const d of rs) {
        edges[d.id] = []; prefixes[d.id] = [];
        for (const i of net.l3(d)) {
          const m = matchProto(d, i, proto); if (!m) continue;
          const len = proto === 'ospf' && i.kind === 'lo' ? 32 : ip.len(i.mask);
          prefixes[d.id].push({ net: ip.net(i.ip, ip.mask(len)), len, cost: proto === 'ospf' ? P.ospfCost(d, i) : proto === 'rip' ? 0 : 0, bw: P.ifBw(d, i), dly: P.ifDelay(d, i), group: m.id });
          if (m.passive || i.kind === 'lo') continue;
          for (const f of P.l2reach(net, d, i)) {
            if (!rs.includes(f.dev)) continue;
            const m2 = matchProto(f.dev, f.i, proto); if (!m2 || m2.passive || m2.id !== m.id) continue;
            if (!ip.same(i.ip, f.i.ip, i.mask)) continue;
            if (proto === 'ospf' && (m2.area !== m.area || f.i.mask !== i.mask)) continue;
            edges[d.id].push({ to: f.dev.id, out: i.name, nh: f.i.ip, cost: proto === 'ospf' ? P.ospfCost(d, i) : 1, bw: P.ifBw(d, i), dly: P.ifDelay(d, i), group: m.id, m, theirIf: f.i.name });
            (st.nbr[d.id] = st.nbr[d.id] || []).push({ proto, pid: m.pid, asn: m.asn, area: m.area, dev: f.dev.id, ip: f.i.ip, ifname: i.name, rid: proto === 'ospf' ? P.ospfRid(net, f.dev, m2.pid) : null });
            const key = proto + '|' + f.dev.id + '|' + f.i.ip;
            const msg = proto === 'ospf' ? '%OSPF-5-ADJCHG: Process ' + m.pid + ', Nbr ' + ip.str(P.ospfRid(net, f.dev, m2.pid)) + ' on ' + i.name + ' from LOADING to FULL, Loading Done'
              : proto === 'eigrp' ? '%DUAL-5-NBRCHANGE: IP-EIGRP ' + m.asn + ': Neighbor ' + ip.str(f.i.ip) + ' (' + i.name + ') is up: new adjacency' : null;
            if (msg) (st.adj[d.id + '|' + i.name] = st.adj[d.id + '|' + i.name] || []).push({ key, msg });
          }
        }
        const pc = proto === 'eigrp' ? null : proto === 'ospf' ? Object.values(d.cfg.ospf).find(o => o.defOrig) : d.cfg.rip && d.cfg.rip.defOrig;
        if (pc && staticDefault(net, d) && prefixes[d.id].length) prefixes[d.id].push({ net: 0, len: 0, cost: 1, bw: 1e7, dly: 0, ext: true, group: prefixes[d.id][0].group });
      }
      /* shortest paths from every router */
      for (const src of rs) {
        if (!edges[src.id] || !edges[src.id].length) continue;
        const dist = { [src.id]: { c: 0, bw: Infinity, dly: 0, first: null, hops: 0 } }, done = new Set();
        const score = x => proto === 'eigrp' ? (x.bw === Infinity ? 0 : 256 * (Math.floor(1e7 / x.bw) + Math.floor(x.dly / 10))) : x.c;
        for (;;) {
          let u = null; for (const k in dist) if (!done.has(k) && (u == null || dist[k].c < dist[u].c)) u = k; if (u == null) break; done.add(u);
          for (const e of edges[u] || []) {
            const cur = dist[u], nx = { c: 0, bw: Math.min(cur.bw, e.bw), dly: cur.dly + e.dly, first: cur.first || e, hops: cur.hops + 1 };
            nx.c = proto === 'eigrp' ? nx.dly + 1e7 / nx.bw : cur.c + e.cost;
            if (!dist[e.to] || nx.c < dist[e.to].c) dist[e.to] = nx;
          }
        }
        const own = new Set(net.l3(src).filter(i => i.up && i.ip != null).map(i => ip.net(i.ip, i.mask) + '/' + ip.len(i.mask)));
        const best = {};
        for (const [oid, pth] of Object.entries(dist)) {
          if (oid === src.id) continue;
          for (const pf of prefixes[oid] || []) {
            const k = pf.net + '/' + pf.len; if (own.has(k)) continue;
            if (pf.len === 32 && net.l3(src).some(i => i.ip === pf.net)) continue;
            let metric, code, ad;
            if (proto === 'rip') { metric = pth.hops + (pf.ext ? 0 : 0); if (metric > 15) continue; code = pf.len === 0 ? 'R*' : 'R'; ad = 120; }
            else if (proto === 'ospf') { metric = pth.c + pf.cost; code = pf.ext ? 'O*E2' : 'O'; ad = pf.ext ? 110 : 110; if (pf.ext) metric = 20; }
            else { const bw = Math.min(pth.bw, pf.bw), dl = pth.dly + pf.dly; metric = 256 * (Math.floor(1e7 / bw) + Math.floor(dl / 10)); code = 'D'; ad = 90; }
            if (!best[k] || metric < best[k].metric) best[k] = { code, net: pf.net, len: pf.len, ad, metric, nh: pth.first.nh, out: pth.first.out, proto };
          }
        }
        st.dyn[src.id] = (st.dyn[src.id] || []).concat(Object.values(best));
      }
    }
  };

  /* ---------- the routing table ---------- */
  P.table = function (net, d) {
    const st = net.state(); st.tables = st.tables || {};
    if (st.tables[d.id]) return st.tables[d.id];
    const t = [];
    if (P.isIOS(d) && d.power) {
      for (const i of net.l3(d)) if (i.up && i.ip != null) {
        const len = ip.len(i.mask);
        t.push({ code: 'C', net: ip.net(i.ip, i.mask), len, ad: 0, metric: 0, out: i.name });
        if (len < 32 && d.cfg.ipRouting) t.push({ code: 'L', net: i.ip, len: 32, ad: 0, metric: 0, out: i.name });
      }
      if (d.cfg.ipRouting) {
        const conn = t.slice();
        for (const r of d.cfg.routes) {
          if (!staticOk(net, d, r)) continue;
          let out = r.iface || null;
          if (!out) { const c = conn.filter(x => x.code === 'C' && ip.net(r.nh, ip.mask(x.len)) === x.net).sort((a, b) => b.len - a.len)[0]; if (!c) continue; out = c.out; }
          t.push({ code: r.net === 0 && r.mask === 0 ? 'S*' : 'S', net: r.net, len: ip.len(r.mask), ad: r.ad || 1, metric: 0, nh: r.nh, out, iface: r.iface });
        }
        for (const r of (st.dyn[d.id] || [])) t.push(r);
      }
      /* per prefix keep the lowest administrative distance */
      const by = {}; for (const r of t) { const k = r.net + '/' + r.len + (r.code === 'L' ? 'L' : ''); if (!by[k] || r.ad < by[k].ad) by[k] = r; }
      t.length = 0; Object.values(by).forEach(r => t.push(r));
      t.sort((a, b) => (a.net >>> 0) - (b.net >>> 0) || a.len - b.len);
    }
    st.tables[d.id] = t; return t;
  };
  P.lookup = function (net, d, dst) {
    dst = ip.toInt(dst); let best = null;
    for (const r of P.table(net, d)) if (ip.net(dst, ip.mask(r.len)) === r.net && (!best || r.len > best.len)) best = r;
    if (!best) return null;
    let out = best.out, nh = best.nh != null ? best.nh : null;
    if (best.code !== 'C' && best.code !== 'L' && nh != null && !best.iface) {
      /* recursive: the next hop must itself be reachable through a connected network */
      const c = P.table(net, d).filter(r => r.code === 'C' && ip.net(nh, ip.mask(r.len)) === r.net).sort((a, b) => b.len - a.len)[0];
      if (c) out = c.out;
    }
    return { route: best, out, nh };
  };

  /* default gateway of a host or a layer-2 switch */
  P.hostGw = d => d.host ? d.host.gw : d.cfg ? d.cfg.defaultGw : null;
})();

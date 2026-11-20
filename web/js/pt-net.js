// Packet Tracer simulator, part 1: the network model. IP helpers, device models (routers, switches, PCs, servers,
// laptops, hub, access point, cloud), cables and link state, spanning tree, trunk negotiation and the list of layer-3
// interfaces each device owns. Runs in the browser (window.PTSim) and in node for the unit tests.
(() => {
  const G = typeof window !== 'undefined' ? window : globalThis;
  const P = G.PTSim = G.PTSim || {};

  /* ---------- IPv4 helpers (addresses are unsigned 32-bit numbers) ---------- */
  const ip = P.ip = {
    toInt(s) {
      if (typeof s === 'number') return s >>> 0;
      const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(String(s || '').trim()); if (!m) return null;
      const o = m.slice(1).map(Number); if (o.some(x => x > 255)) return null;
      return ((o[0] << 24) | (o[1] << 16) | (o[2] << 8) | o[3]) >>> 0;
    },
    str(n) { if (n == null) return ''; n >>>= 0; return [n >>> 24, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join('.'); },
    valid(s) { return ip.toInt(s) != null; },
    len(mask) { let m = ip.toInt(mask), l = 0; while (l < 32 && (m & (0x80000000 >>> l))) l++; return l; },
    mask(len) { return len <= 0 ? 0 : (0xffffffff << (32 - len)) >>> 0; },
    isMask(m) { m = ip.toInt(m); if (m == null) return false; const l = ip.len(m); return ip.mask(l) === m; },
    net(a, m) { return (ip.toInt(a) & ip.toInt(m)) >>> 0; },
    same(a, b, m) { return ip.net(a, m) === ip.net(b, m); },
    bcast(a, m) { return (ip.net(a, m) | (~ip.toInt(m) >>> 0)) >>> 0; },
    wildMatch(a, base, wild) { const w = ip.toInt(wild); return ((ip.toInt(a) & ~w) >>> 0) === ((ip.toInt(base) & ~w) >>> 0); },
    classful(a) { const f = ip.toInt(a) >>> 24; const l = f < 128 ? 8 : f < 192 ? 16 : 24; return { net: ip.net(a, ip.mask(l)), len: l }; },
    hostOk(a, m) { const n = ip.toInt(a), mk = ip.toInt(m); if (n == null || mk == null) return false; const l = ip.len(mk); if (l >= 31) return true; return n !== ip.net(n, mk) && n !== ip.bcast(n, mk); },
  };
  const BCAST_MAC = 'ffffffffffff';
  P.BCAST_MAC = BCAST_MAC;
  P.macDot = m => m ? (m.slice(0, 4) + '.' + m.slice(4, 8) + '.' + m.slice(8)).toLowerCase() : '';
  P.macDash = m => m ? m.toUpperCase().match(/../g).join('-') : '';

  /* ---------- device models ---------- */
  const range = (pre, a, b, media) => { const o = []; for (let i = a; i <= b; i++) o.push([pre + i, media]); return o; };
  P.MODELS = {
    '1941': { type: 'router', label: '1941', desc: 'Cisco 1941 Integrated Services Router', ports: [['GigabitEthernet0/0', 'gig'], ['GigabitEthernet0/1', 'gig'], ['Serial0/0/0', 'serial'], ['Serial0/0/1', 'serial'], ['Console', 'console']] },
    '2911': { type: 'router', label: '2911', desc: 'Cisco 2911 Integrated Services Router with an HWIC-2T serial card', ports: [['GigabitEthernet0/0', 'gig'], ['GigabitEthernet0/1', 'gig'], ['GigabitEthernet0/2', 'gigf'], ['Serial0/0/0', 'serial'], ['Serial0/0/1', 'serial'], ['Console', 'console']] },
    '2960': { type: 'switch', label: '2960-24TT', desc: 'Cisco Catalyst 2960 24-port access switch', ports: [...range('FastEthernet0/', 1, 24, 'fa'), ['GigabitEthernet0/1', 'gigf'], ['GigabitEthernet0/2', 'gigf'], ['Console', 'console']] },
    '3560': { type: 'switch', l3: true, label: '3560-24PS', desc: 'Cisco Catalyst 3560 multilayer switch (routes between VLANs with ip routing)', ports: [...range('FastEthernet0/', 1, 24, 'fa'), ['GigabitEthernet0/1', 'gigf'], ['GigabitEthernet0/2', 'gigf'], ['Console', 'console']] },
    PC: { type: 'pc', label: 'PC', desc: 'Desktop PC', ports: [['FastEthernet0', 'fa'], ['RS 232', 'rs232']] },
    Laptop: { type: 'laptop', label: 'Laptop', desc: 'Laptop with wired and wireless network cards', ports: [['FastEthernet0', 'fa'], ['Wireless0', 'wlan'], ['RS 232', 'rs232']] },
    Server: { type: 'server', label: 'Server', desc: 'Server with HTTP, DNS and DHCP services', ports: [['FastEthernet0', 'fa']] },
    Hub: { type: 'hub', label: 'Hub', desc: '6-port hub: repeats every frame out of every other port', ports: range('Port ', 0, 5, 'fa') },
    AP: { type: 'ap', label: 'AccessPoint', desc: 'Wireless access point bridging Wi-Fi clients to Port 0', ports: [['Port 0', 'fa'], ['Port 1', 'wap']] },
    Cloud: { type: 'cloud', label: 'Cloud', desc: 'WAN cloud: bridges whatever is plugged into it', ports: [...range('Ethernet', 0, 3, 'fa'), ['Serial0', 'serial'], ['Serial1', 'serial']] },
  };
  P.PALETTE = [
    ['router', 'Routers', ['1941', '2911']], ['switch', 'Switches', ['2960', '3560']], ['hub', 'Hubs', ['Hub']], ['ap', 'Wireless', ['AP']],
    ['end', 'End Devices', ['PC', 'Laptop', 'Server']], ['cloud', 'WAN', ['Cloud']], ['cable', 'Connections', ['auto', 'console', 'straight', 'cross', 'fiber', 'serial']],
  ];
  P.CABLES = { auto: 'Automatic', console: 'Console', straight: 'Copper Straight-Through', cross: 'Copper Cross-Over', fiber: 'Fiber', serial: 'Serial DCE', wireless: 'Wireless' };
  const MEDIA = { fa: ['copper'], gig: ['copper'], gigf: ['copper', 'fiber'], serial: ['serial'], console: ['console'], rs232: ['console'], wlan: ['wlan'], wap: ['wlan'] };
  const BW = { fa: 100000, gig: 1000000, gigf: 1000000, serial: 1544, wlan: 54000, wap: 54000 };       // kbit/s
  const DLY = { fa: 100, gig: 10, gigf: 10, serial: 2000, wlan: 100, wap: 100 };                       // tens of microseconds (EIGRP)
  P.isRouter = d => d.type === 'router';
  P.isSwitch = d => d.type === 'switch';
  P.isHost = d => d.type === 'pc' || d.type === 'laptop' || d.type === 'server';
  P.isIOS = d => d.type === 'router' || d.type === 'switch';

  /* interface names: canonical long form and Cisco short form */
  const IFT = [['GigabitEthernet', 'Gi'], ['FastEthernet', 'Fa'], ['Serial', 'Se'], ['Vlan', 'Vlan'], ['Loopback', 'Lo'], ['Ethernet', 'Eth']];
  P.ifShort = n => { for (const [l, s] of IFT) if (n.startsWith(l)) return s + n.slice(l.length); return n; };
  P.ifParse = s => {             // "g0/0", "gig 0/0.10", "fa0/1", "vlan 10", "lo0" -> "GigabitEthernet0/0" ...
    const m = /^([a-z]+)\s*(\d[\d/.]*)$/i.exec(String(s || '').trim()); if (!m) return null;
    const t = m[1].toLowerCase(), hits = IFT.filter(x => x[0].toLowerCase().startsWith(t));
    if (hits.length !== 1 && !(hits.length > 1 && hits.some(h => h[0].toLowerCase() === t))) return null;
    const h = hits.length === 1 ? hits[0] : hits.find(h2 => h2[0].toLowerCase() === t);
    if (!/^\d+(\/\d+)*(\.\d+)?$/.test(m[2])) return null;
    return h[0] + m[2];
  };
  P.IF_TYPES = IFT.map(x => x[0].toLowerCase());

  /* ---------- MAC addresses ---------- */
  let macSeed = 0x4a10;
  const OUI = { router: '0001', switch: '000a', pc: '0060', laptop: '00d0', server: '0090', hub: '0002', ap: '0004', cloud: '0003' };
  function newMac(type) { macSeed = (macSeed * 1103515245 + 12345) & 0x7fffffff; return (OUI[type] || '0005') + ('00000000' + (macSeed >>> 0).toString(16)).slice(-8); }
  P.newMac = newMac;

  /* ---------- device factory: devices are plain objects so they clone and save as JSON ---------- */
  const DEF_VLANS = () => ({ 1: 'default', 1002: 'fddi-default', 1003: 'token-ring-default', 1004: 'fddinet-default', 1005: 'trnet-default' });
  function freshCfg(d) {
    const sw = d.type === 'switch';
    return {
      hostname: d.type === 'router' ? 'Router' : 'Switch', secret: null, enablePw: null, motd: null, domainLookup: true, domain: '', nameServer: null,
      lines: { con: { pw: null, login: false, local: false }, vty: { pw: null, login: !sw ? true : true, local: false, transport: 'all', acl: null }, aux: {} },
      users: {}, pwEnc: false, rsa: false, sshVer: 1, cdp: true,
      routes: [], rip: null, ospf: {}, eigrp: {}, dhcp: { pools: {}, excl: [] }, nat: { pools: {}, rules: [] }, acls: {},
      vlans: sw ? DEF_VLANS() : {}, ipRouting: d.type === 'router', defaultGw: null, stpPri: 32768,
    };
  }
  function freshPort(d, name, kind) {
    const r = d.type === 'router';
    return {
      name, kind, media: MEDIA[kind] || ['copper'], mac: (kind === 'console' || kind === 'rs232') ? '' : newMac(d.type), link: null,
      shutdown: r && kind !== 'console', desc: '', ip: null, mask: null, dhcp: false,
      sw: d.type === 'switch' ? { mode: d.model === '3560' ? 'dynamic auto' : 'dynamic auto', vlan: 1, native: 1, allowed: null, encap: d.model === '3560' ? 'auto' : 'dot1q', ps: null, nonego: false } : null,
      routed: false, nat: null, aclIn: null, aclOut: null, helper: [], bw: null, cost: null, clock: null, errdis: false,
    };
  }
  P.createDevice = function (net, model, x, y, name) {
    const M = P.MODELS[model]; if (!M) throw new Error('unknown model ' + model);
    const d = { id: 'd' + (++net.seq), model, type: M.type, x: Math.round(x || 0), y: Math.round(y || 0), power: true, ports: {}, subifs: {}, svis: {}, loops: {}, arp: {}, mac: {}, pending: {}, startup: null, bindings: {}, natT: [], aclHits: {}, psec: {} };
    d.name = name || net.uniqueName(M.type === 'router' ? 'Router' : M.type === 'switch' ? 'Switch' : M.type === 'pc' ? 'PC' : M.type === 'laptop' ? 'Laptop' : M.type === 'server' ? 'Server' : M.type === 'hub' ? 'Hub' : M.type === 'ap' ? 'Access Point' : 'Cloud');
    M.ports.forEach(([n, k]) => { d.ports[n] = freshPort(d, n, k); });
    d.baseMac = newMac(d.type);
    if (P.isIOS(d)) { d.cfg = freshCfg(d); if (d.type === 'switch') d.svis.Vlan1 = { name: 'Vlan1', vlan: 1, ip: null, mask: null, shutdown: true, desc: '', helper: [], nat: null, aclIn: null, aclOut: null }; }
    if (d.type === 'switch') d.cfg.hostname = 'Switch';
    if (P.isHost(d)) d.host = { gw: null, dns: null, dhcp: false, wifi: { ssid: '', key: '', on: d.type === 'laptop' } };
    if (d.type === 'server') d.svc = { http: { on: true, files: { 'index.html': '<html><body><h1>Cisco Packet Tracer</h1><p>Welcome to the web server. Quick links:</p><p><a href="helloworld.html">A small page</a></p></body></html>', 'helloworld.html': '<html><body><h2>Hello, world</h2><p>This page came from the server through the simulated network.</p></body></html>' } }, dns: { on: false, recs: [] }, dhcp: { on: false, pools: [] } };
    if (d.type === 'ap') d.ap = { ssid: 'Default', key: '' };
    return d;
  };

  /* every layer-3 interface a device owns (physical routed ports, sub-interfaces, SVIs, loopbacks, host NICs) */
  P.l3ifs = function (net, d) {
    const out = [];
    if (P.isHost(d)) { for (const p of Object.values(d.ports)) if (p.kind === 'fa' || p.kind === 'wlan') out.push({ name: p.name, ip: p.ip, mask: p.mask, mac: p.mac, port: p.name, kind: 'phys', obj: p, up: net.portUp(d, p.name) }); return out; }
    if (!P.isIOS(d)) return out;
    for (const p of Object.values(d.ports)) {
      if (p.kind === 'console') continue;
      if (d.type === 'router' || p.routed) out.push({ name: p.name, ip: p.ip, mask: p.mask, mac: p.mac, port: p.name, kind: 'phys', obj: p, up: net.portUp(d, p.name) });
    }
    for (const s of Object.values(d.subifs)) { const par = s.name.split('.')[0]; out.push({ name: s.name, ip: s.ip, mask: s.mask, mac: d.ports[par] ? d.ports[par].mac : '', port: par, vlan: s.vlan, native: s.native, kind: 'sub', obj: s, up: !s.shutdown && net.portUp(d, par) && s.vlan != null }); }
    for (const s of Object.values(d.svis)) out.push({ name: s.name, ip: s.ip, mask: s.mask, mac: d.baseMac, vlan: s.vlan, kind: 'svi', obj: s, up: !s.shutdown && d.power && net.vlanActive(d, s.vlan) });
    for (const s of Object.values(d.loops)) out.push({ name: s.name, ip: s.ip, mask: s.mask, mac: '', kind: 'lo', obj: s, up: !s.shutdown && d.power });
    return out;
  };
  P.ifBw = (d, i) => { if (i.kind === 'lo') return 8000000; if (i.kind === 'svi') return 1000000; const p = d.ports[i.port || i.name]; return (i.obj && i.obj.bw) || (p && p.bw) || BW[p ? p.kind : 'fa'] || 100000; };
  P.ifDelay = (d, i) => { if (i.kind === 'lo') return 500; if (i.kind === 'svi') return 10; const p = d.ports[i.port || i.name]; return DLY[p ? p.kind : 'fa'] || 100; };
  P.ospfCost = (d, i) => (i.obj && i.obj.cost) || Math.max(1, Math.floor(100000 / P.ifBw(d, i)));

  /* ---------- the network ---------- */
  class Net {
    constructor() { this.devs = {}; this.links = {}; this.notes = []; this.seq = 0; this.t = 0; this.q = []; this.ver = 1; this.cache = null; this.listeners = []; this.events = []; this.sim = false; this.waiters = {}; this.pseq = 0; this.logs = {}; }
    uniqueName(base) { const names = new Set(Object.values(this.devs).map(d => d.name)); let i = 0; while (names.has(base + i)) i++; return base + i; }
    add(model, x, y, name) { const d = P.createDevice(this, model, x, y, name); this.devs[d.id] = d; this.touch(); return d; }
    byName(n) { n = String(n).toLowerCase(); return Object.values(this.devs).find(d => d.name.toLowerCase() === n || (d.cfg && d.cfg.hostname.toLowerCase() === n)); }
    remove(id) { const d = this.devs[id]; if (!d) return; for (const p of Object.values(d.ports)) if (p.link) this.unlink(p.link); delete this.devs[id]; this.touch(); }
    touch() { this.ver++; this.cache = null; }
    on(fn) { this.listeners.push(fn); return () => { this.listeners = this.listeners.filter(f => f !== fn); }; }
    emit(kind, data) { for (const f of this.listeners) try { f(kind, data); } catch (e) { } }
    log(d, msg) { this.emit('log', { dev: d.id, msg }); }

    /* cables */
    cableFor(a, pa, b, pb, type) {
      const A2 = this.devs[a], B2 = this.devs[b]; if (!A2 || !B2) return { err: 'No such device.' };
      const p1 = A2.ports[pa], p2 = B2.ports[pb]; if (!p1 || !p2) return { err: 'No such port.' };
      if (p1.link || p2.link) return { err: 'That port is already in use.' };
      if (a === b) return { err: 'A cable needs two different devices.' };
      if (type === 'auto') {
        if (p1.media.includes('console') && p2.media.includes('console')) type = 'console';
        else if (p1.media.includes('serial') && p2.media.includes('serial')) type = 'serial';
        else if (p1.kind === 'wlan' || p2.kind === 'wlan' || p1.kind === 'wap' || p2.kind === 'wap') return { err: 'Wireless cards join an access point by SSID, not with a cable.' };
        else if (p1.media.includes('copper') && p2.media.includes('copper')) type = P.needCross(A2, B2) ? 'cross' : 'straight';
        else if (p1.media.includes('fiber') && p2.media.includes('fiber')) type = 'fiber';
        else return { err: 'Those two ports cannot be cabled together.' };
      }
      const need = { console: 'console', serial: 'serial', straight: 'copper', cross: 'copper', fiber: 'fiber' }[type];
      if (!need || !p1.media.includes(need) || !p2.media.includes(need)) return { err: 'A ' + (P.CABLES[type] || type) + ' cable does not fit ' + (p1.media.includes(need) ? pb : pa) + '.' };
      if (type === 'console' && !((p1.kind === 'console' && p2.kind === 'rs232') || (p2.kind === 'console' && p1.kind === 'rs232'))) return { err: 'A console cable joins a PC RS 232 port to a router or switch Console port.' };
      return { type };
    }
    link(a, pa, b, pb, type) {
      const r = this.cableFor(a, pa, b, pb, type || 'auto'); if (r.err) return r;
      const id = 'l' + (++this.seq), L = { id, type: r.type, a: { dev: a, port: pa }, b: { dev: b, port: pb } };
      this.links[id] = L; this.devs[a].ports[pa].link = id; this.devs[b].ports[pb].link = id; this.touch(); return L;
    }
    unlink(id) { const L = this.links[id]; if (!L) return; for (const e of [L.a, L.b]) { const d = this.devs[e.dev]; if (d && d.ports[e.port]) d.ports[e.port].link = null; } delete this.links[id]; this.touch(); }
    peer(devId, port) { const d = this.devs[devId]; const p = d && d.ports[port]; const L = p && p.link && this.links[p.link]; if (!L) return null; return L.a.dev === devId && L.a.port === port ? L.b : L.a; }

    /* ---------- derived state, recomputed lazily after any change ---------- */
    state() {
      if (this.cache) return this.cache;
      const st = this.cache = { phys: {}, trunk: {}, stp: {}, routes: {}, adj: {}, ver: this.ver };
      this.syncWireless();
      for (const L of Object.values(this.links)) st.phys[L.id] = this.physUp(L);
      for (const L of Object.values(this.links)) this.trunkCalc(L, st);
      P.stp && P.stp(this, st);
      P.routing && P.routing(this, st);
      this.diffLog(st);
      return st;
    }
    physUp(L) {
      const A2 = this.devs[L.a.dev], B2 = this.devs[L.b.dev]; if (!A2 || !B2 || !A2.power || !B2.power) return false;
      const pa = A2.ports[L.a.port], pb = B2.ports[L.b.port];
      if (L.type === 'console') return true;
      if (pa.shutdown || pb.shutdown || pa.errdis || pb.errdis) return false;
      if (L.type === 'straight' && P.needCross(A2, B2)) return false;
      if (L.type === 'cross' && !P.needCross(A2, B2)) return false;
      if (L.type === 'wireless') return !!(B2.host && B2.host.wifi.on);
      return true;
    }
    trunkCalc(L, st) {
      for (const [me, other] of [[L.a, L.b], [L.b, L.a]]) {
        const d = this.devs[me.dev], o = this.devs[other.dev], p = d.ports[me.port]; if (!p.sw || p.routed) continue;
        let t = false; const m = p.sw.mode;
        if (m === 'trunk') t = true;
        else if (m !== 'access' && !p.sw.nonego && o.type === 'switch') {
          const q = o.ports[other.port]; const om = q.sw && !q.routed ? q.sw.mode : 'access';
          t = (m === 'dynamic desirable' && (om === 'trunk' || om.startsWith('dynamic'))) || (m === 'dynamic auto' && (om === 'trunk' || om === 'dynamic desirable'));
          if (q.sw && q.sw.nonego) t = false;
        }
        st.trunk[me.dev + '|' + me.port] = t;
      }
    }
    isTrunk(d, port) { const st = this.state(); return !!st.trunk[d.id + '|' + port]; }
    linkUp(id) { return !!this.state().phys[id]; }
    portUp(d, port) { const p = d.ports[port]; if (!p || !d.power || p.shutdown || p.errdis) return false; if (!p.link) return false; return this.linkUp(p.link); }
    fwd(d, port) { const s = this.state().stp[d.id + '|' + port]; return s !== 'BLK'; }
    portVlans(d, port) {       // VLANs a switch port carries, or null when it carries none
      const p = d.ports[port]; if (!p.sw || p.routed || !this.portUp(d, port)) return null;
      if (this.isTrunk(d, port)) return Object.keys(d.cfg.vlans).map(Number).filter(v => v < 1002 && (!p.sw.allowed || p.sw.allowed.includes(v)));
      return d.cfg.vlans[p.sw.vlan] ? [p.sw.vlan] : [];
    }
    vlanActive(d, v) { if (!d.cfg || !d.cfg.vlans[v]) return false; return Object.keys(d.ports).some(n => { const vs = this.portVlans(d, n); return vs && vs.includes(v); }); }
    l3(d) { return P.l3ifs(this, d); }
    l3find(d, name) { return this.l3(d).find(i => i.name === name); }

    /* access points join laptops whose Wi-Fi SSID and key match */
    syncWireless() {
      const aps = Object.values(this.devs).filter(d => d.type === 'ap' && d.power);
      for (const L of Object.values(this.links)) if (L.type === 'wireless') { const a = this.devs[L.a.dev], b = this.devs[L.b.dev]; if (!a || !b || !a.power || !b.host || b.host.wifi.ssid !== a.ap.ssid || (a.ap.key && a.ap.key !== b.host.wifi.key) || !b.host.wifi.on) { delete this.links[L.id]; if (b && b.ports.Wireless0) b.ports.Wireless0.link = null; } }
      for (const d of Object.values(this.devs)) {
        const w = d.ports.Wireless0; if (!w || w.link || !d.host.wifi.on) continue;
        const ap = aps.find(a => a.ap.ssid === d.host.wifi.ssid && (!a.ap.key || a.ap.key === d.host.wifi.key)); if (!ap) continue;
        const id = 'w' + (++this.seq); this.links[id] = { id, type: 'wireless', a: { dev: ap.id, port: 'Port 1' }, b: { dev: d.id, port: 'Wireless0' } }; w.link = id;
      }
    }
    /* IOS-style log lines when interfaces or adjacencies change state */
    diffLog(st) {
      const prev = this._prevUp || {}, now = {};
      for (const d of Object.values(this.devs)) {
        if (!P.isIOS(d)) continue;
        for (const i of this.l3(d).concat(Object.values(d.ports).filter(p => p.sw && !p.routed).map(p => ({ name: p.name, up: this.portUp(d, p.name), obj: p, kind: 'sw' })))) {
          const k = d.id + '|' + i.name; now[k] = i.up; if (!(k in prev)) continue;
          if (prev[k] !== i.up) {
            if (i.kind !== 'svi' && i.kind !== 'sub' && i.kind !== 'lo') this.log(d, '%LINK-' + (i.up ? '5-CHANGED' : '5-CHANGED') + ': Interface ' + i.name + ', changed state to ' + (i.up ? 'up' : (i.obj.shutdown ? 'administratively down' : 'down')));
            this.log(d, '%LINEPROTO-5-UPDOWN: Line protocol on Interface ' + i.name + ', changed state to ' + (i.up ? 'up' : 'down'));
          }
        }
        for (const [k, a] of Object.entries(st.adj)) if (k.startsWith(d.id + '|')) for (const n of a) { const kk = k + '|' + n.key; now[kk] = 1; if (!(kk in prev) && this._prevUp) this.log(d, n.msg); }
      }
      this._prevUp = now;
    }
  }
  P.needCross = (a, b) => { const cls = d => (d.type === 'switch' || d.type === 'hub') ? 1 : (d.type === 'ap' || d.type === 'cloud') ? 2 : 0; const x = cls(a), y = cls(b); if (x === 2 || y === 2) return null; return x === y; };
  P.Net = Net;

  /* ---------- spanning tree: one instance over all switch-to-switch links ---------- */
  P.stp = function (net, st) {
    const sws = Object.values(net.devs).filter(d => d.type === 'switch' && d.power);
    const bid = d => [d.cfg.stpPri, d.baseMac];
    const lt = (a, b) => a[0] !== b[0] ? a[0] < b[0] : a[1] < b[1];
    const edges = [];
    for (const L of Object.values(net.links)) {
      if (!st.phys[L.id]) continue; const A2 = net.devs[L.a.dev], B2 = net.devs[L.b.dev];
      if (A2.type !== 'switch' || B2.type !== 'switch' || A2.ports[L.a.port].routed || B2.ports[L.b.port].routed) continue;
      const k = A2.ports[L.a.port].kind; edges.push({ L, a: A2, b: B2, cost: k === 'fa' ? 19 : 4 });
    }
    const seen = new Set();
    for (const s of sws) {
      if (seen.has(s.id)) continue;
      const comp = [], stack = [s]; seen.add(s.id);
      while (stack.length) { const x = stack.pop(); comp.push(x); for (const e of edges) { const y = e.a === x ? e.b : e.b === x ? e.a : null; if (y && !seen.has(y.id)) { seen.add(y.id); stack.push(y); } } }
      let root = comp[0]; for (const x of comp) if (lt(bid(x), bid(root))) root = x;
      const dist = {}; comp.forEach(x => { dist[x.id] = Infinity; }); dist[root.id] = 0;
      const todo = new Set(comp.map(x => x.id));
      while (todo.size) {
        let u = null; for (const id of todo) if (u == null || dist[id] < dist[u]) u = id; todo.delete(u);
        for (const e of edges) { const y = e.a.id === u ? e.b : e.b.id === u ? e.a : null; if (y && dist[u] + e.cost < dist[y.id]) dist[y.id] = dist[u] + e.cost; }
      }
      const rootPort = {};
      for (const x of comp) {
        if (x === root) continue; let best = null;
        for (const e of edges) {
          const mine = e.a === x ? e.L.a : e.b === x ? e.L.b : null; if (!mine) continue;
          const other = e.a === x ? e.b : e.a, c = dist[other.id] + e.cost, key = [c, other.cfg.stpPri, other.baseMac, mine.port];
          if (!best || key[0] < best.key[0] || (key[0] === best.key[0] && (key[1] < best.key[1] || (key[1] === best.key[1] && (key[2] < best.key[2] || (key[2] === best.key[2] && key[3] < best.key[3])))))) best = { key, port: mine.port };
        }
        if (best) rootPort[x.id] = best.port;
      }
      st.stpRoot = st.stpRoot || {}; comp.forEach(x => { st.stpRoot[x.id] = { root: root.id, cost: dist[x.id], rootPort: rootPort[x.id] || null }; });
      for (const e of edges) {
        const da = [dist[e.a.id], ...bid(e.a)], db = [dist[e.b.id], ...bid(e.b)];
        const aDes = da[0] !== db[0] ? da[0] < db[0] : lt(bid(e.a), bid(e.b));
        const [des, desEnd, oth, othEnd] = aDes ? [e.a, e.L.a, e.b, e.L.b] : [e.b, e.L.b, e.a, e.L.a];
        st.stp[des.id + '|' + desEnd.port] = 'FWD';
        st.stp[oth.id + '|' + othEnd.port] = rootPort[oth.id] === othEnd.port ? 'FWD' : 'BLK';
      }
    }
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = P;
})();

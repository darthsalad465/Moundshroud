// Packet Tracer simulator, part 12: Simulation mode. Freezes time so packets move one hop per step as envelopes on the
// canvas, lists every event (time, last device, at device, type), filters protocols, plays automatically at a chosen
// speed, and opens a PDU details window with the OSI layers in and out plus what the device decided.
(() => {
  const P = window.PTSim, ip = P.ip, UI = P.UI.prototype;
  const esc = t => String(t == null ? '' : t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  /* animation frames pause in hidden windows, so fall back to a timer there */
  const nextFrame = fn => { let done = false; const go = () => { if (done) return; done = true; cancelAnimationFrame(r); clearTimeout(t); fn(performance.now()); }; const r = requestAnimationFrame(go), t = setTimeout(go, 40); };
  const TYPES = ['ICMP', 'ARP', 'DHCP', 'DNS', 'HTTP', 'TCP', 'TELNET', 'SSH', 'UDP'];

  UI.setSim = function (on) {
    if (on === this.simOn) return;
    this.simOn = on; this.stopPlay(); this.envs = [];
    const n = this.net;
    if (on) { n.runAll(); n.sim = true; n.events = []; this.sideTab = 'sim'; }
    else { n.sim = false; n.runAll(); n.events = []; }
    this.root.querySelector('[data-act=realtime]').classList.toggle('pt-pri', !on);
    this.root.querySelector('[data-act=sim]').classList.toggle('pt-pri', on);
    this.sideRender(); this.pduTable(); this.draw(); this.clock();
    Object.values(this.wins).forEach(w => { if (w.sh && w.sh.term) w.sh.term.ready(); });
  };
  UI.simKick = function () { this.evList && this.evList(); this.showPending(); };
  UI.vis = function (it) { return it && !it.fn && it.frame && this.filters[P.ptype(it.frame)] !== 0; };
  /* envelopes waiting at their sender for the next step */
  UI.showPending = function () {
    const n = this.net; if (!n.q.length) { this.envs = []; return this.draw(); }
    const t0 = n.q.find(it => !it.fn) ? n.q.find(it => !it.fn).t : null;
    this.envs = n.q.filter(it => it.t === t0 && this.vis(it)).map(it => { const a = n.devs[it.from]; return a ? { x: a.x, y: a.y - 4, color: P.TYPE_COLORS[P.ptype(it.frame)] || '#999', it } : null; }).filter(Boolean);
    this.draw();
  };
  /* one step: animate the visible frames of the next time slice, then process it */
  UI.simStep = function (done) {
    const n = this.net; if (this._anim) return;
    let guard = 0;
    while (n.q.length && guard++ < 400) {
      const t0 = n.q[0].t, slice = n.q.filter(it => it.t === t0);
      if (slice.some(it => this.vis(it))) break;
      n.step();
    }
    if (!n.q.length) { this.envs = []; this.draw(); this.evList(); this.clock(); this.pduTable(); return done && done(false); }
    const t0 = n.q[0].t, slice = n.q.filter(it => it.t === t0 && this.vis(it));
    const dur = Math.max(120, 1300 - (this.speed || 50) * 12), start = performance.now();
    const paths = slice.map(it => { const a = n.devs[it.from], b = n.devs[it.dev]; return a && b ? { a, b, c: P.TYPE_COLORS[P.ptype(it.frame)] || '#999' } : null; }).filter(Boolean);
    const frame = now => {
      const k = Math.min(1, (now - start) / dur), e = k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      this.envs = paths.map(p => ({ x: p.a.x + (p.b.x - p.a.x) * e, y: p.a.y - 4 + (p.b.y - p.a.y) * e, color: p.c })); this.render();
      if (tok !== this._anim) return;
      if (k < 1 && this.simOn) nextFrame(frame);
      else { this._anim = null; if (!this.simOn) return; n.step(); this.showPending(); this.evList(); this.clock(); this.pduTable(); Object.values(this.wins).forEach(w => { if (w.sh && w.sh.term && !w.sh.busy) w.sh.term.ready(); }); done && done(true); }
    };
    const tok = this._anim = {}; nextFrame(frame);
  };
  UI.play = function () {
    if (this.playing) return this.stopPlay();
    this.playing = true; this.syncPlay();
    const loop = () => { if (!this.playing) return; this.simStep(more => { if (!more) { this.stopPlay(); return; } this._pt = setTimeout(loop, 60); }); };
    loop();
  };
  UI.stopPlay = function () { this.playing = false; clearTimeout(this._pt); if (this._anim) { this._anim = null; this.net.step && this.simOn && this.net.step(); this.showPending && this.showPending(); } this.syncPlay(); };
  UI.syncPlay = function () { const b = this.side.querySelector('[data-sim=play]'); if (b) b.textContent = this.playing ? '⏸ Pause' : '▶ Play'; };
  UI.simPanel = function (sp) {
    sp.innerHTML = '<div class="pt-sbody" style="padding:0"><table class="pt-evt"><thead><tr><th>Vis.</th><th>Time</th><th>Last Device</th><th>At Device</th><th>Type</th></tr></thead><tbody></tbody></table><div class="pt-mute pt-evempty" style="padding:10px">No events yet. Send traffic (a Simple PDU, a ping in Command Prompt, a web page), then press <b>Capture / Forward</b> or <b>Play</b>.</div></div>' +
      '<div class="pt-ctl"><button class="pt-btn" data-sim="reset" title="Clear events and drop packets in flight">⏮ Reset</button><button class="pt-btn pt-pri" data-sim="play">▶ Play</button><button class="pt-btn" data-sim="step" title="Move every visible packet one hop">⏭ Capture / Forward</button></div>' +
      '<div class="pt-ctl" style="border-top:0;padding-top:0"><span class="pt-mute" style="font-size:12px">Play speed</span><input type="range" min="0" max="100" value="' + (this.speed || 50) + '" data-sim="speed" style="flex:1"></div>' +
      '<div class="pt-filt"><b style="width:100%;font-size:11.5px;color:var(--mute)">EVENT LIST FILTERS · visible events</b>' + TYPES.map(t => '<label><input type="checkbox" data-f="' + t + '"' + (this.filters[t] !== 0 ? ' checked' : '') + '><span class="pt-sw" style="background:' + P.TYPE_COLORS[t] + '"></span>' + t + '</label>').join('') + '</div>';
    sp.onclick = e => {
      const b = e.target.closest('[data-sim]'); if (b) { const a = b.dataset.sim; if (a === 'reset') { this.stopPlay(); this.net.q = []; this.net.waiters = {}; this.net.events = []; this.envs = []; this.pdus.forEach(p => { if (p.status === 'In Progress') p.status = ''; }); this.evList(); this.pduTable(); this.draw(); Object.values(this.wins).forEach(w => { if (w.sh) { w.sh.busy = false; w.sh.term && w.sh.term.ready(); } }); Object.values(this.sessions).forEach(s => { if (s.busy) { s.busy = false; s.term && s.term.ready(); } }); } if (a === 'play') this.play(); if (a === 'step') { this.stopPlay(); this.simStep(); } return; }
      const r = e.target.closest('tr[data-ev]'); if (r) this.pduWin(this.net.events.find(x => x.n === +r.dataset.ev));
    };
    sp.querySelector('[data-sim=speed]').oninput = e => { this.speed = +e.target.value; };
    sp.querySelectorAll('[data-f]').forEach(c => c.onchange = () => { this.filters[c.dataset.f] = c.checked ? 1 : 0; try { localStorage.setItem('pt_filt', JSON.stringify(this.filters)); } catch (e) { } this.evList(); this.showPending(); });
    this.evList = () => {
      const tb = sp.querySelector('tbody'); if (!tb || !tb.isConnected) return;
      const evs = this.net.events.filter(e => this.filters[e.type] !== 0).slice(-400), last = evs[evs.length - 1];
      tb.innerHTML = evs.map(e => '<tr data-ev="' + e.n + '"' + (e === last ? ' class="pt-cur"' : '') + '><td>' + (e === last ? '👁' : '') + '</td><td>' + (e.t / 1000).toFixed(3) + '</td><td>' + esc(e.last) + '</td><td>' + esc(e.at) + '</td><td><span class="pt-sw" style="background:' + (P.TYPE_COLORS[e.type] || '#999') + '"></span> ' + e.type + '</td></tr>').join('');
      sp.querySelector('.pt-evempty').style.display = evs.length ? 'none' : '';
      const body = sp.querySelector('.pt-sbody'); body.scrollTop = body.scrollHeight;
    };
    this.evList(); this.showPending();
  };

  /* PDU information: OSI layers in and out, then the decisions the device made */
  const layers = (f, port) => {
    const L = [];
    if (!f) return L;
    L.push(['Layer 1', 'Port ' + (port || '')]);
    if (f.serial) L.push(['Layer 2', 'HDLC frame']);
    else L.push(['Layer 2', 'Ethernet II Header ' + P.macDot(f.src) + ' >> ' + (f.dst === P.BCAST_MAC ? 'FFFF.FFFF.FFFF' : P.macDot(f.dst)) + (f.vlan != null ? ', Dot1q tag VLAN ' + f.vlan : '')]);
    if (f.type === 'arp') { const a = f.arp; L.push(['Layer 3', 'ARP Packet Src. IP: ' + ip.str(a.sip) + ', Dest. IP: ' + ip.str(a.tip)]); L.push(['', a.op === 1 ? 'ARP Request' : 'ARP Reply']); return L; }
    const k = f.ip; if (!k) return L;
    L.push(['Layer 3', 'IP Header Src. IP: ' + ip.str(k.src) + ', Dest. IP: ' + ip.str(k.dst) + ', TTL ' + k.ttl]);
    if (k.proto === 'icmp') L.push(['', 'ICMP Message Type: ' + k.icmp.type + (k.icmp.type === 8 ? ' (echo request)' : k.icmp.type === 0 ? ' (echo reply)' : k.icmp.type === 11 ? ' (time exceeded)' : ' (unreachable)')]);
    if (k.proto === 'udp') { L.push(['Layer 4', 'UDP Src. Port: ' + k.udp.sp + ', Dst. Port: ' + k.udp.dp]); if (k.udp.dhcp) L.push(['Layer 7', 'DHCP ' + k.udp.dhcp.op + (k.udp.dhcp.yiaddr != null ? ' ' + ip.str(k.udp.dhcp.yiaddr) : '') + (k.udp.dhcp.giaddr ? ' (relay ' + ip.str(k.udp.dhcp.giaddr) + ')' : '')]); if (k.udp.dns) L.push(['Layer 7', 'DNS ' + (k.udp.dns.a !== undefined ? 'answer ' + k.udp.dns.q + ' = ' + (k.udp.dns.a != null ? ip.str(k.udp.dns.a) : 'not found') : 'query ' + k.udp.dns.q)]); }
    if (k.proto === 'tcp') { L.push(['Layer 4', 'TCP Src. Port: ' + k.tcp.sp + ', Dst. Port: ' + k.tcp.dp + ', ' + k.tcp.flags]); if (k.tcp.http) L.push(['Layer 7', k.tcp.http.method ? 'HTTP GET ' + k.tcp.http.path : 'HTTP ' + k.tcp.http.status]); }
    return L;
  };
  UI.pduWin = function (ev) {
    if (!ev) return;
    const ins = layers(ev.frame, ev.port), outs = ev.out.length ? layers(ev.out[0].frame, ev.out[0].port) : [];
    const col = (t, L) => '<div><div class="pt-hd">' + t + '</div>' + (L.length ? L.map(([a, b]) => '<div class="pt-l"><b>' + esc(a) + '</b>' + esc(b) + '</div>').join('') : '<div class="pt-mute">(none)</div>') + '</div>';
    const det = JSON.stringify(ev.frame, (k, v) => k === 'hops' ? undefined : (k === 'src' || k === 'dst' || k === 'sip' || k === 'tip' || k === 'yiaddr' || k === 'giaddr' || k === 'gw' || k === 'dns' || k === 'mask' || k === 'server' || k === 'a') && typeof v === 'number' ? ip.str(v) : v, 2);
    const dl = this.dialog('PDU Information at Device: ' + ev.at, '<div class="pt-tabs" style="padding:0 0 0"><button class="pt-tab pt-on" data-p="osi">OSI Model</button><button class="pt-tab" data-p="in">Inbound PDU Details</button></div><div data-pane="osi" style="padding-top:10px"><div class="pt-mute">At Device: <b>' + esc(ev.at) + '</b> · Source: ' + esc(ev.last) + ' · Type: ' + ev.type + ' · Time ' + (ev.t / 1000).toFixed(3) + '</div><div class="pt-osi" style="margin-top:8px">' + col('In Layers', ins) + col('Out Layers', outs) + '</div><ol class="pt-notes">' + (ev.notes.length ? ev.notes.map(x => '<li>' + esc(x) + '</li>').join('') : '<li>The device creates this packet.</li>') + '</ol>' + (ev.out.length ? '<div class="pt-mute">Sent out: ' + ev.out.map(o => esc(o.port + ' → ' + o.to)).join(', ') + '</div>' : '') + '</div><div data-pane="in" hidden style="padding-top:10px"><pre style="margin:0;font:12px Consolas,monospace;white-space:pre-wrap">' + esc(det) + '</pre></div>', true);
    dl.el.querySelector('.pt-tabs').onclick = e => { const b = e.target.closest('[data-p]'); if (!b) return; dl.el.querySelectorAll('.pt-tab').forEach(x => x.classList.toggle('pt-on', x === b)); dl.el.querySelectorAll('[data-pane]').forEach(p => { p.hidden = p.dataset.pane !== b.dataset.p; }); };
  };
})();

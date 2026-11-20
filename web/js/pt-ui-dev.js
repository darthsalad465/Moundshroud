// Packet Tracer simulator, part 11: device windows. Each device opens a movable window with Physical (chassis, port
// lights, power switch), Config (forms that run the equivalent IOS commands), CLI (the IOS console), Desktop (IP
// Configuration, Command Prompt, Web Browser, Terminal, PC Wireless) and Services (HTTP, DHCP, DNS) tabs.
(() => {
  const P = window.PTSim, ip = P.ip, UI = P.UI.prototype;
  const esc = t => String(t == null ? '' : t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const toast = m => { if (typeof A !== 'undefined' && A.toast) A.toast(m); };

  /* ---------- a terminal bound to a shell (IOS session or PC command prompt) ---------- */
  class Term {
    constructor(host, shell) {
      this.shell = shell; this.q = []; this.hist = []; this.hi = 0;
      host.innerHTML = '<div class="pt-term"><pre class="pt-to"></pre><div class="pt-tline"><span class="pt-tp"></span><input class="pt-tin" spellcheck="false" autocomplete="off"></div></div>';
      this.box = host.querySelector('.pt-term'); this.out = host.querySelector('.pt-to'); this.pr = host.querySelector('.pt-tp'); this.inp = host.querySelector('.pt-tin'); this.line = host.querySelector('.pt-tline');
      this.box.addEventListener('mouseup', () => { if (!String(window.getSelection())) this.inp.focus({ preventScroll: true }); });
      this.inp.addEventListener('keydown', e => this.key(e));
      /* "?" can also arrive as inserted text (paste, on-screen keyboards): treat it as help too */
      this.inp.addEventListener('input', () => { const v = this.inp.value; if (v.endsWith('?') && this.shell.help && !(this.shell.secret && this.shell.secret()) && !this.shell.await && !this.shell.busy) { this.helpFor(v.slice(0, -1)); } });
      this.ready();
    }
    helpFor(v) { this.echo(v + '?'); this.write(this.shell.help(v) + '\n'); this.ready(); this.inp.value = v; }
    write(t) { this.q.push(String(t)); if (!this._fl) this.flush(); }
    flush() {
      if (!this.q.length) { this._fl = null; return; }
      const t = this.q.shift(); this.out.textContent += t;
      if (this.out.textContent.length > 120000) this.out.textContent = this.out.textContent.slice(-100000);
      this.box.scrollTop = this.box.scrollHeight;
      this._fl = setTimeout(() => this.flush(), this.q.length && t.length < 3 ? 70 : 0);
    }
    ready() { const sh = this.shell; const busy = sh.busy; this.line.style.display = busy ? 'none' : 'flex'; this.pr.textContent = busy ? '' : sh.promptText(); this.inp.type = sh.secret && sh.secret() ? 'password' : 'text'; this.box.scrollTop = this.box.scrollHeight; }
    echo(s) { this.write(this.pr.textContent + s + '\n'); }
    key(e) {
      const sh = this.shell, v = this.inp.value;
      if (e.key === 'Enter') { e.preventDefault(); const sec = sh.secret && sh.secret(); this.echo(sec ? '' : v); this.inp.value = ''; if (v.trim() && !sec) { this.hist.push(v); this.hi = this.hist.length; } sh.input(v); this.waitReady(); return; }
      if (e.key === '?' && sh.help && !(sh.secret && sh.secret()) && !sh.await) { e.preventDefault(); this.helpFor(v); return; }
      if (e.key === 'Tab') { e.preventDefault(); if (sh.complete) this.inp.value = sh.complete(v); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); if (this.hi > 0) this.inp.value = this.hist[--this.hi] || ''; return; }
      if (e.key === 'ArrowDown') { e.preventDefault(); this.hi = Math.min(this.hist.length, this.hi + 1); this.inp.value = this.hist[this.hi] || ''; return; }
      if (e.ctrlKey && (e.key === 'z' || e.key === 'Z') && sh.ctrlZ) { e.preventDefault(); this.echo(v + '^Z'); this.inp.value = ''; sh.ctrlZ(); this.ready(); return; }
      if (e.ctrlKey && (e.key === 'c' || e.key === 'C') && !String(window.getSelection())) { e.preventDefault(); this.echo(v + '^C'); this.inp.value = ''; if (sh.ctrlC) sh.ctrlC(); this.ready(); return; }
      if (e.key === 'Escape') e.stopPropagation();
    }
    waitReady() { const go = () => { if (this.shell.busy) return; this.ready(); }; go(); }
    focus() { this.inp.focus({ preventScroll: true }); }
  }
  P.Term = Term;

  /* ---------- the PC command prompt ---------- */
  class PCShell {
    constructor(ui, d) { this.ui = ui; this.d = d; this.busy = false; this.remote = null; }
    get net() { return this.ui.net; }
    o(t) { this.term && this.term.write(t); }
    ln(t) { this.o((t == null ? '' : t) + '\n'); }
    promptText() { return this.remote ? this.remote.promptText() : 'C:\\>'; }
    secret() { return this.remote ? this.remote.secret() : false; }
    help(l) { return this.remote ? this.remote.help(l) : 'Type "help" for the list of commands.'; }
    complete(l) { return this.remote ? this.remote.complete(l) : l; }
    ctrlZ() { if (this.remote) this.remote.ctrlZ(); }
    get await() { return this.remote ? this.remote.await : null; }
    async_(fn) { this.busy = true; fn(() => { this.busy = false; this.term && this.term.ready(); }); if (!this.net.sim) this.net.runAll(); }
    nic() { const d = this.d; const w = d.ports.Wireless0; return w && w.link && w.ip != null ? w : d.ports.FastEthernet0; }
    input(line) {
      if (this.remote) { this.remote.input(line); if (this.remote && this.remote.closed) { this.remote = null; this.ln('\n[Connection to remote host closed by foreign host]'); } return; }
      const a = line.trim().split(/\s+/), c = (a[0] || '').toLowerCase(); if (!c) return;
      if (!this.d.power) return this.ln('The device is powered off.');
      if (c === 'help' || c === '?') return this.ln('\nPacket Tracer PC Command Line 1.0\nC:\\>help\narp -a | arp -d     show or clear the ARP cache\ncls                 clear the screen\nipconfig [/all] [/release] [/renew]\nnslookup <name>     ask the DNS server\nping [-n count] <address or name>\nssh -l <user> <address>\ntelnet <address>\ntracert <address or name>\n');
      if (c === 'cls') { if (this.term) this.term.out.textContent = ''; return; }
      if (c === 'ipconfig') return this.ipconfig(a.slice(1).join(' ').toLowerCase());
      if (c === 'arp') { if (a[1] === '-d') { this.d.arp = {}; return; } const e = Object.entries(this.d.arp); if (!e.length) return this.ln('No ARP Entries Found'); const i = this.nic(); return this.ln('  Internet Address      Physical Address      Type\n' + e.map(([k, x]) => '  ' + ip.str(+k).padEnd(22) + P.macDot(x.mac).padEnd(22) + 'dynamic').join('\n')); }
      if (c === 'ping') { let n = 4, h = null; for (let k = 1; k < a.length; k++) { if (a[k] === '-n') n = Math.max(1, Math.min(100, +a[++k] || 4)); else if (a[k] === '-t') n = 100; else h = a[k]; } if (!h) return this.ln('Ping request could not find host. Please check the name and try again.'); return this.ping(h, n); }
      if (c === 'tracert') return a[1] ? this.tracert(a[1]) : this.ln('Usage: tracert <address>');
      if (c === 'nslookup') return a[1] ? this.nslookup(a[1]) : this.ln('Server: ' + (this.d.host.dns != null ? ip.str(this.d.host.dns) : '[none]'));
      if (c === 'telnet') return a[1] ? this.connect(a[1], 23) : this.ln('Usage: telnet <address>');
      if (c === 'ssh') { const u = a.indexOf('-l'); if (u < 0 || !a[u + 1] || !a[u + 2]) return this.ln('Usage: ssh -l <username> <address>'); return this.connect(a[u + 2], 22, a[u + 1]); }
      this.ln('Invalid Command.');
    }
    ipconfig(arg) {
      const d = this.d;
      if (arg === '/release') { const p = this.nic(); if (!d.host.dhcp) return this.ln('The operation failed as no adapter is in the state permissible for this operation.'); p.ip = null; p.mask = null; d.host.gw = null; d.host.dns = null; this.ui.changed(); return this.ln('\n   IP Address......................: 0.0.0.0\n   Subnet Mask.....................: 0.0.0.0\n   Default Gateway.................: 0.0.0.0\n   DNS Server......................: 0.0.0.0'); }
      if (arg === '/renew') { if (!d.host.dhcp) return this.ln('The operation failed as no adapter is in the state permissible for this operation.'); return this.async_(done => this.net.dhcpClient(d, this.nic().name, okk => { this.ui.changed(); this.ipconfig(''); done(); })); }
      for (const p of [d.ports.FastEthernet0, d.ports.Wireless0].filter(Boolean)) {
        this.ln('\n' + p.name + ' Connection:(default port)\n');
        if (arg === '/all') this.ln('   Connection-specific DNS Suffix..: \n   Physical Address................: ' + P.macDot(p.mac).toUpperCase() + '\n   DHCP Enabled....................: ' + (d.host.dhcp ? 'Yes' : 'No'));
        this.ln('   Link-local IPv6 Address.........: FE80::' + p.mac.slice(4, 8).toUpperCase() + ':' + p.mac.slice(8).toUpperCase() + '\n   IPv4 Address....................: ' + (p.ip != null ? ip.str(p.ip) : '0.0.0.0') + '\n   Subnet Mask.....................: ' + (p.mask != null ? ip.str(p.mask) : '0.0.0.0') + '\n   Default Gateway.................: ' + (d.host.gw != null ? ip.str(d.host.gw) : '0.0.0.0'));
        if (arg === '/all') this.ln('   DNS Servers.....................: ' + (d.host.dns != null ? ip.str(d.host.dns) : '0.0.0.0'));
      }
      this.ln('');
    }
    ping(h, n) {
      this.async_(done => this.net.resolve(this.d, h, dst => {
        if (dst == null) { this.ln('Ping request could not find host ' + h + '. Please check the name and try again.'); return done(); }
        this.ln('\nPinging ' + ip.str(dst) + ' with 32 bytes of data:\n'); const ms = [];
        this.net.ping(this.d, dst, { count: n, onReply: r => { if (r.ok) { ms.push(r.ms); this.ln('Reply from ' + ip.str(r.from) + ': bytes=32 time' + (r.ms ? '=' + r.ms : '<1') + 'ms TTL=' + r.ttl); } else if (r.kind === 'unreach' || r.kind === 'admin') this.ln('Reply from ' + ip.str(r.from) + ': Destination host unreachable.'); else if (r.kind === 'ttl') this.ln('Reply from ' + ip.str(r.from) + ': TTL expired in transit.'); else this.ln('Request timed out.'); },
          onDone: st => { this.ln('\nPing statistics for ' + ip.str(dst) + ':\n    Packets: Sent = ' + st.sent + ', Received = ' + st.got + ', Lost = ' + (st.sent - st.got) + ' (' + Math.round(100 * (st.sent - st.got) / st.sent) + '% loss),' + (ms.length ? '\nApproximate round trip times in milli-seconds:\n    Minimum = ' + Math.min(...ms) + 'ms, Maximum = ' + Math.max(...ms) + 'ms, Average = ' + Math.round(ms.reduce((x, y) => x + y, 0) / ms.length) + 'ms' : '') + '\n'); done(); } });
        if (!this.net.sim) this.net.runAll();
      }));
    }
    tracert(h) {
      this.async_(done => this.net.resolve(this.d, h, dst => {
        if (dst == null) { this.ln('Unable to resolve target system name ' + h + '.'); return done(); }
        this.ln('\nTracing route to ' + ip.str(dst) + ' over a maximum of 30 hops: \n');
        this.net.trace(this.d, dst, { onHop: (t, rs) => { const f = rs.find(r => r.from != null); this.ln(String(t).padStart(3) + rs.map(r => r.ok || r.kind === 'unreach' ? ('  ' + (r.ms ? r.ms + ' ms' : '<1 ms')).padStart(9) : '     *   ').join('') + '\t' + (f ? ip.str(f.from) : 'Request timed out.')); }, onDone: () => { this.ln('\nTrace complete.'); done(); } });
        if (!this.net.sim) this.net.runAll();
      }));
    }
    nslookup(h) {
      const dns = this.d.host.dns; this.ln('\nServer: ' + (dns != null ? ip.str(dns) : '[none]') + '\nAddress:  ' + (dns != null ? ip.str(dns) : '') + '\n');
      this.async_(done => this.net.resolve(this.d, h, a => { this.ln(a == null ? '*** UnKnown can\'t find ' + h + ': Non-existent domain' : 'Non-authoritative answer:\nName:\t' + h + '\nAddress:  ' + ip.str(a)); this.ln(''); done(); }));
    }
    connect(h, port, user) {
      const dst = ip.toInt(h); if (dst == null) return this.ln('% Unknown command or computer name, or unable to find computer address');
      this.ln('Trying ' + ip.str(dst) + ' ...');
      this.async_(done => this.net.connect(this.d, dst, port, r => {
        if (!r.ok) { this.ln(r.kind === 'refused' ? '% Connection refused by remote host' : '% Connection timed out; remote host not responding'); return done(); }
        const t = Object.values(this.net.devs).find(x => P.isIOS(x) && this.net.myIps(x).some(i => i.ip === dst));
        if (!t) { this.ln('% Connection refused by remote host'); return done(); }
        if (port === 23) this.ln('Open');
        const s = new P.IOS(this.net, t, { via: 'vty', out: x => this.o(x), changed: () => this.ui.changed(), ready: () => this.term && this.term.ready(), onClose: () => { } });
        if (port === 22) { const u = t.cfg.users[user], vty = t.cfg.lines.vty; if (!vty.local) { s.ln('% Login disabled: ssh needs "login local" on the vty lines'); return done(); } this.remote = s; s.await = { prompt: 'Password: ', hide: true, fn: pw => { if (!u || !P.pwCheck(u.pw, pw)) { s.ln('% Login invalid'); s.closed = true; this.remote = null; this.ln('\n[Connection to ' + ip.str(dst) + ' closed by foreign host]'); return; } if (t.cfg.motd) s.ln(t.cfg.motd); } }; return done(); }
        this.remote = s; s.start(); if (s.closed) { this.remote = null; this.ln('[Connection to ' + ip.str(dst) + ' closed by foreign host]'); }
        done();
      }));
    }
  }

  /* ---------- windows ---------- */
  UI.openWin = function (d) {
    if (!d) return;
    if (this.wins[d.id]) { this.front(this.wins[d.id].el); return; }
    const tabs = P.isIOS(d) ? ['Physical', 'Config', 'CLI'] : d.type === 'server' ? ['Physical', 'Config', 'Services', 'Desktop'] : P.isHost(d) ? ['Physical', 'Config', 'Desktop'] : ['Physical', 'Config'];
    const el = document.createElement('div'); el.className = 'pt-win';
    const n = Object.keys(this.wins).length, r = this.root.getBoundingClientRect();
    el.style.left = Math.max(10, Math.min(r.width - 660, 80 + n * 28)) + 'px'; el.style.top = Math.max(10, 40 + n * 24) + 'px'; el.style.width = Math.min(660, r.width - 20) + 'px'; el.style.height = Math.min(500, r.height - 60) + 'px';
    el.innerHTML = '<div class="pt-wh">' + P.icon(P.iconKey(d), 20) + '<span class="pt-wt"></span><button class="pt-x" title="Close">✕</button></div><div class="pt-tabs">' + tabs.map((t, k) => '<button class="pt-tab' + (k === 0 ? '' : '') + '" data-tab="' + t + '">' + t + '</button>').join('') + '</div><div class="pt-wb"></div>';
    this.root.appendChild(el);
    const w = this.wins[d.id] = { el, d, tab: null, body: el.querySelector('.pt-wb') };
    w.title = () => { el.querySelector('.pt-wt').textContent = d.name; };
    w.title();
    el.querySelector('.pt-x').onclick = () => this.closeWin(d.id);
    el.querySelector('.pt-tabs').onclick = e => { const b = e.target.closest('[data-tab]'); if (b) this.showTab(w, b.dataset.tab); };
    el.addEventListener('pointerdown', () => this.front(el));
    const wh = el.querySelector('.pt-wh');
    wh.addEventListener('pointerdown', e => { if (e.target.closest('button')) return; const sx = e.clientX, sy = e.clientY, ox = el.offsetLeft, oy = el.offsetTop; const mv = ev => { el.style.left = Math.max(-200, ox + ev.clientX - sx) + 'px'; el.style.top = Math.max(0, oy + ev.clientY - sy) + 'px'; }; const up = () => { document.removeEventListener('pointermove', mv); document.removeEventListener('pointerup', up); }; document.addEventListener('pointermove', mv); document.addEventListener('pointerup', up); });
    w.refresh = full => { w.title(); if (full !== false || w.tab === 'Physical') this.showTab(w, w.tab, true); };
    this.front(el);
    this.showTab(w, P.isIOS(d) ? 'CLI' : P.isHost(d) ? 'Desktop' : 'Physical');
  };
  UI.front = function (el) { this.root.querySelectorAll('.pt-win').forEach(x => x.classList.toggle('pt-front', x === el)); };
  UI.closeWin = function (id) { const w = this.wins[id]; if (!w) return; if (this.sessions[id]) this.sessions[id].term = null; w.el.remove(); delete this.wins[id]; };
  UI.showTab = function (w, tab, keep) {
    if (keep && (tab === 'CLI' || tab === 'Desktop' || tab === 'Services' || tab === 'Config')) { if (tab === 'Config' && w.cfgRefresh) w.cfgRefresh(); return; }
    w.tab = tab; w.cfgRefresh = null;
    w.el.querySelectorAll('.pt-tab').forEach(b => b.classList.toggle('pt-on', b.dataset.tab === tab));
    const s = this.sessions[w.d.id]; if (s && tab !== 'CLI') s.term = null;
    const b = w.body; b.innerHTML = '';
    ({ Physical: () => this.tabPhysical(w), Config: () => this.tabConfig(w), CLI: () => this.tabCli(w), Desktop: () => this.tabDesktop(w), Services: () => this.tabServices(w) })[tab]();
  };

  /* Physical: a drawing of the chassis with live port lights and the power switch */
  UI.tabPhysical = function (w) {
    const d = w.d, ports = Object.values(d.ports).filter(p => p.kind !== 'wap'), W2 = Math.max(420, 60 + ports.length * 26);
    let x = 60; const cells = ports.map(p => { const st = p.kind === 'console' || p.kind === 'rs232' ? (p.link ? 'up' : 'none') : this.portLight(d, p.name); const c = { up: '#2fd06a', down: '#ff4d5e', blk: '#f5a524', none: '#555' }[st] || '#555'; const g = '<g transform="translate(' + x + ',34)"><rect width="20" height="16" rx="2" fill="#1b1f27" stroke="#8a94a6"/><rect x="5" y="5" width="10" height="8" fill="#000"/><circle cx="10" cy="-6" r="3.2" fill="' + (p.link || st === 'up' ? c : '#3a3f48') + '"/><text x="10" y="30" font-size="8" fill="var(--mute)" text-anchor="middle">' + esc(P.ifShort(p.name).replace('FastEthernet', 'Fa').replace('RS 232', 'RS232')) + '</text></g>'; x += 26; return g; }).join('');
    w.body.innerHTML = '<div class="pt-phys"><div><b>' + esc(P.MODELS[d.model].desc) + '</b></div><svg viewBox="0 0 ' + (W2 + 20) + ' 90" width="' + (W2 + 20) + '" height="90"><rect x="4" y="10" width="' + (W2 + 10) + '" height="66" rx="6" fill="#2b3240" stroke="#5c6779"/><g data-pw style="cursor:pointer"><rect x="16" y="30" width="26" height="24" rx="4" fill="' + (d.power ? '#2fd06a' : '#5a1f27') + '"/><text x="29" y="46" font-size="11" fill="#fff" text-anchor="middle">⏻</text></g>' + cells + '</svg>' +
      '<div class="pt-mute">Click the green switch to turn the device ' + (d.power ? 'off' : 'on') + '. Lights: green link up, amber blocked by spanning tree, red down.</div>' +
      '<table class="pt-tbl"><tr><th>Port</th><th>Link</th><th>Connected to</th><th>MAC</th></tr>' + ports.map(p => { const pe = this.net.peer(d.id, p.name); const pd = pe && this.net.devs[pe.dev]; return '<tr><td>' + esc(p.name) + '</td><td>' + (this.net.portUp(d, p.name) ? '<span class="pt-ok">Up</span>' : '<span class="pt-bad">Down</span>') + '</td><td>' + (pd ? esc(pd.name + ' ' + pe.port) : '') + '</td><td>' + esc(P.macDot(p.mac)) + '</td></tr>'; }).join('') + '</table></div>';
    w.body.querySelector('[data-pw]').onclick = () => { d.power = !d.power; if (!d.power) { d.arp = {}; d.mac = {}; } else if (P.isIOS(d)) { P.reload(this.net, d); const s = this.sessions[d.id]; if (s) { s.mode = 'user'; s.ctx = {}; s.o('\n' + P.bootText(d)); } } this.changed(); this.showTab(w, 'Physical'); };
  };

  /* CLI: the console line */
  UI.tabCli = function (w) {
    const d = w.d, s = this.session(d);
    w.body.innerHTML = '<div style="font-weight:600;margin-bottom:6px">IOS Command Line Interface</div><div class="pt-tw" style="flex:1;min-height:0;display:flex;flex-direction:column"></div><div style="display:flex;gap:6px;margin-top:6px"><button class="pt-btn" data-cp>Copy</button><button class="pt-btn" data-pa>Paste</button><span class="pt-mute" style="align-self:center;font-size:11.5px">? help · Tab completes · ↑↓ history · Ctrl+Z ends config</span></div>';
    const t = new Term(w.body.querySelector('.pt-tw'), s); s.term = t;
    if (s.back) { t.write(s.back); s.back = ''; }
    t.ready(); setTimeout(() => t.focus(), 30);
    w.body.querySelector('[data-cp]').onclick = () => { try { navigator.clipboard.writeText(t.out.textContent); toast('Copied the CLI text.'); } catch (e) { } };
    w.body.querySelector('[data-pa]').onclick = async () => { try { const txt = await navigator.clipboard.readText(); for (const l of txt.split(/\r?\n/)) { t.echo(l); s.input(l); } t.ready(); } catch (e) { toast('Paste was blocked by the browser.'); } };
  };

  /* Config: forms that run IOS commands, with the equivalent commands shown underneath */
  UI.tabConfig = function (w) {
    const d = w.d, net = this.net;
    if (!P.isIOS(d)) return this.hostConfig(w);
    const items = [['g', 'GLOBAL'], ['settings', 'Settings']];
    if (d.cfg.ipRouting && d.type === 'router') items.push(['g', 'ROUTING'], ['static', 'Static'], ['rip', 'RIP']);
    if (d.type === 'switch') items.push(['g', 'SWITCHING'], ['vlandb', 'VLAN Database']);
    items.push(['g', 'INTERFACE']); Object.values(d.ports).filter(p => p.kind !== 'console').forEach(p => items.push(['if:' + p.name, p.name]));
    Object.keys(d.svis).forEach(n => items.push(['svi:' + n, n]));
    w.body.innerHTML = '<div class="pt-split"><div class="pt-nav">' + items.map(([k, l]) => k === 'g' ? '<div class="pt-g">' + l + '</div>' : '<div data-k="' + esc(k) + '">' + esc(l) + '</div>').join('') + '</div><div class="pt-pane"></div></div><div class="pt-hd" style="margin-bottom:2px">Equivalent IOS Commands</div><pre class="pt-eq"></pre>';
    const pane = w.body.querySelector('.pt-pane'), eq = w.body.querySelector('.pt-eq');
    const ios = cmds => { const s = new P.IOS(net, d, { out: t => { eq.textContent += t; } }); s.mode = 'config'; for (const c of cmds) { eq.textContent += d.cfg.hostname + (s.mode === 'config' ? '(config)#' : s.mode === 'if' ? '(config-if)#' : s.mode === 'router' ? '(config-router)#' : s.mode === 'vlan' ? '(config-vlan)#' : '#') + c + '\n'; s.input(c); } s.input('end'); eq.scrollTop = eq.scrollHeight; this.changed(); };
    let cur = w.cfgSel || 'settings';
    const show = k => {
      cur = w.cfgSel = k; w.body.querySelectorAll('.pt-nav [data-k]').forEach(x => x.classList.toggle('pt-on', x.dataset.k === k));
      if (k === 'settings') {
        pane.innerHTML = '<div class="pt-hd">Global Settings</div><div class="pt-form"><label>Display Name</label><input data-f="name" value="' + esc(d.name) + '"><label>Hostname</label><input data-f="host" value="' + esc(d.cfg.hostname) + '"><label>NVRAM</label><div style="display:flex;gap:6px"><button class="pt-btn" data-b="save">Save</button><button class="pt-btn" data-b="erase">Erase</button></div><label>Startup Config</label><div style="display:flex;gap:6px"><button class="pt-btn" data-b="load">Load</button><button class="pt-btn" data-b="view">View running config</button></div></div>';
        pane.querySelector('[data-f=name]').onchange = e => { d.name = e.target.value.trim() || d.name; this.changed(); w.title(); };
        pane.querySelector('[data-f=host]').onchange = e => ios(['hostname ' + e.target.value.trim()]);
        pane.onclick = e => { const b = e.target.closest('[data-b]'); if (!b) return; const k2 = b.dataset.b;
          if (k2 === 'save') { d.startup = P.cfgSnapshot(d); eq.textContent += d.cfg.hostname + '#copy running-config startup-config\nDestination filename [startup-config]?\nBuilding configuration...\n[OK]\n'; }
          if (k2 === 'erase') { d.startup = null; eq.textContent += d.cfg.hostname + '#erase startup-config\n[OK]\n'; }
          if (k2 === 'load' && d.startup) { P.cfgApply(net, d, d.startup, true); this.changed(); eq.textContent += d.cfg.hostname + '#copy startup-config running-config\n'; }
          if (k2 === 'view') { const t = { net, d, hist: [], ln: x => { this.dialog(d.cfg.hostname + ' running-config', '<pre style="margin:0;font:12px Consolas,monospace;white-space:pre">' + esc(x) + '</pre>'); } }; const ww = P.iosWalk(P.iosTree('priv'), 'show running-config'); ww.n.end(t, ww.vals); }
        };
      } else if (k === 'static') {
        pane.innerHTML = '<div class="pt-hd">Static Routes</div><div class="pt-form"><label>Network</label><input data-f="n" placeholder="192.168.2.0"><label>Mask</label><input data-f="m" placeholder="255.255.255.0"><label>Next Hop</label><input data-f="h" placeholder="10.0.0.2"><span></span><button class="pt-btn pt-pri" data-b="add">Add</button></div><div class="pt-hd">Network Address</div><div data-l></div>';
        const list = () => { pane.querySelector('[data-l]').innerHTML = d.cfg.routes.map((r, k2) => '<div class="pt-card" style="padding:5px 10px">' + ip.str(r.net) + '/' + ip.len(r.mask) + ' via ' + esc(r.iface || ip.str(r.nh)) + '<button class="pt-btn" data-del="' + k2 + '">Remove</button></div>').join('') || '<div class="pt-mute">No static routes.</div>'; };
        list();
        pane.onclick = e => { const b = e.target.closest('[data-b],[data-del]'); if (!b) return; if (b.dataset.del != null) { const r = d.cfg.routes[+b.dataset.del]; ios(['no ip route ' + ip.str(r.net) + ' ' + ip.str(r.mask) + ' ' + (r.iface || ip.str(r.nh))]); return list(); } const v = f => pane.querySelector('[data-f=' + f + ']').value.trim(); ios(['ip route ' + v('n') + ' ' + v('m') + ' ' + v('h')]); list(); };
      } else if (k === 'rip') {
        pane.innerHTML = '<div class="pt-hd">RIP Routing</div><div class="pt-form"><label>Network</label><input data-f="n" placeholder="10.0.0.0"><span></span><button class="pt-btn pt-pri" data-b="add">Add</button></div><div class="pt-hd">Network Address</div><div data-l></div>';
        const list = () => { pane.querySelector('[data-l]').innerHTML = (d.cfg.rip ? d.cfg.rip.nets : []).map(x => '<div class="pt-card" style="padding:5px 10px">' + ip.str(x) + '<button class="pt-btn" data-del="' + ip.str(x) + '">Remove</button></div>').join('') || '<div class="pt-mute">RIP is not running.</div>'; };
        list();
        pane.onclick = e => { const b = e.target.closest('[data-b],[data-del]'); if (!b) return; if (b.dataset.del) { ios(['router rip', 'no network ' + b.dataset.del]); return list(); } ios(['router rip', 'network ' + pane.querySelector('[data-f=n]').value.trim()]); list(); };
      } else if (k === 'vlandb') {
        pane.innerHTML = '<div class="pt-hd">VLAN Configuration</div><div class="pt-form"><label>VLAN Number</label><input data-f="n" placeholder="10"><label>VLAN Name</label><input data-f="m" placeholder="Sales"><span></span><div style="display:flex;gap:6px"><button class="pt-btn pt-pri" data-b="add">Add</button><button class="pt-btn" data-b="rm">Remove</button></div></div><table class="pt-tbl" style="margin-top:8px" data-l></table>';
        const list = () => { pane.querySelector('[data-l]').innerHTML = '<tr><th>VLAN No</th><th>VLAN Name</th></tr>' + Object.entries(d.cfg.vlans).map(([v, nm]) => '<tr><td>' + v + '</td><td>' + esc(nm) + '</td></tr>').join(''); };
        list();
        pane.onclick = e => { const b = e.target.closest('[data-b]'); if (!b) return; const n2 = pane.querySelector('[data-f=n]').value.trim(), nm = pane.querySelector('[data-f=m]').value.trim(); if (!/^\d+$/.test(n2)) return toast('Enter a VLAN number.'); ios(b.dataset.b === 'add' ? ['vlan ' + n2].concat(nm ? ['name ' + nm.replace(/\s+/g, '_')] : []) : ['no vlan ' + n2]); list(); };
      } else if (k.startsWith('if:') || k.startsWith('svi:')) {
        const name = k.split(':')[1], p = P.ifObj(d, name), sw = p.sw && !p.routed;
        const vl = Object.keys(d.cfg.vlans || {}).filter(v => +v < 1002);
        pane.innerHTML = '<div class="pt-hd">' + esc(name) + '</div><div class="pt-form"><label>Port Status</label><label style="display:flex;gap:6px;align-items:center"><input type="checkbox" data-f="on"' + (p.shutdown ? '' : ' checked') + '> On</label>' +
          (p.mac ? '<label>MAC Address</label><input disabled value="' + esc(P.macDot(p.mac)) + '">' : '') +
          (sw ? '<label>Mode</label><select data-f="mode"><option value="access"' + (p.sw.mode !== 'trunk' ? ' selected' : '') + '>Access</option><option value="trunk"' + (p.sw.mode === 'trunk' ? ' selected' : '') + '>Trunk</option></select><label>VLAN</label><select data-f="vlan">' + vl.map(v => '<option' + (+v === p.sw.vlan ? ' selected' : '') + '>' + v + '</option>').join('') + '</select>'
            : '<label>IPv4 Address</label><input data-f="ip" value="' + (p.ip != null ? ip.str(p.ip) : '') + '"><label>Subnet Mask</label><input data-f="mask" value="' + (p.mask != null ? ip.str(p.mask) : '') + '">') +
          '<label>Description</label><input data-f="desc" value="' + esc(p.desc || '') + '"></div>';
        const f = s => pane.querySelector('[data-f=' + s + ']');
        f('on').onchange = e => ios(['interface ' + name, e.target.checked ? 'no shutdown' : 'shutdown']);
        f('desc').onchange = e => ios(['interface ' + name, e.target.value ? 'description ' + e.target.value : 'no description']);
        if (sw) { f('mode').onchange = e => ios(['interface ' + name].concat(e.target.value === 'trunk' && d.model === '3560' ? ['switchport trunk encapsulation dot1q'] : [], ['switchport mode ' + e.target.value])); f('vlan').onchange = e => ios(['interface ' + name, 'switchport access vlan ' + e.target.value]); }
        else { const set = () => { const a = f('ip').value.trim(), m = f('mask').value.trim() || (ip.valid(a) ? ip.str(ip.mask(ip.classful(a).len)) : ''); if (!a) return ios(['interface ' + name, 'no ip address']); if (!f('mask').value.trim()) f('mask').value = m; if (ip.valid(a) && ip.isMask(m)) ios(['interface ' + name, 'ip address ' + a + ' ' + m]); }; f('ip').onchange = set; f('mask').onchange = set; }
      }
    };
    w.body.querySelector('.pt-nav').onclick = e => { const it = e.target.closest('[data-k]'); if (it) show(it.dataset.k); };
    show(cur); w.cfgRefresh = () => show(cur);
  };
  UI.hostConfig = function (w) {
    const d = w.d, net = this.net;
    if (!d.host) {
      w.body.innerHTML = '<div class="pt-hd">Global Settings</div><div class="pt-form"><label>Display Name</label><input data-f="name" value="' + esc(d.name) + '">' + (d.type === 'ap' ? '<label>SSID</label><input data-f="ssid" value="' + esc(d.ap.ssid) + '"><label>WPA2 key (blank = open)</label><input data-f="key" value="' + esc(d.ap.key) + '">' : '') + '</div><div class="pt-mute" style="margin-top:8px">' + esc(P.MODELS[d.model].desc) + '.</div>';
      w.body.querySelector('[data-f=name]').onchange = e => { d.name = e.target.value.trim() || d.name; this.changed(); w.title(); };
      if (d.type === 'ap') { w.body.querySelector('[data-f=ssid]').onchange = e => { d.ap.ssid = e.target.value.trim(); this.changed(); }; w.body.querySelector('[data-f=key]').onchange = e => { d.ap.key = e.target.value; this.changed(); }; }
      return;
    }
    w.body.innerHTML = '<div class="pt-hd">Global Settings</div><div class="pt-form"><label>Display Name</label><input data-f="name" value="' + esc(d.name) + '"></div><div class="pt-hd">Interface FastEthernet0</div><div class="pt-ipc"></div><div class="pt-mute" style="margin-top:8px">MAC ' + P.macDot(d.ports.FastEthernet0.mac).toUpperCase() + ' · the same settings are in Desktop › IP Configuration.</div>';
    w.body.querySelector('[data-f=name]').onchange = e => { d.name = e.target.value.trim() || d.name; this.changed(); w.title(); };
    this.ipForm(w.body.querySelector('.pt-ipc'), d);
  };
  UI.ipForm = function (box, d) {
    const p = d.ports.FastEthernet0, h = d.host;
    box.innerHTML = '<div class="pt-form"><label>IP Configuration</label><div style="display:flex;gap:14px"><label><input type="radio" name="m' + d.id + '" value="dhcp"' + (h.dhcp ? ' checked' : '') + '> DHCP</label><label><input type="radio" name="m' + d.id + '" value="static"' + (h.dhcp ? '' : ' checked') + '> Static</label></div><span></span><div class="pt-dmsg pt-mute"></div>' +
      '<label>IPv4 Address</label><input data-f="ip" value="' + (p.ip != null ? ip.str(p.ip) : '') + '"><label>Subnet Mask</label><input data-f="mask" value="' + (p.mask != null ? ip.str(p.mask) : '') + '"><label>Default Gateway</label><input data-f="gw" value="' + (h.gw != null ? ip.str(h.gw) : '') + '"><label>DNS Server</label><input data-f="dns" value="' + (h.dns != null ? ip.str(h.dns) : '') + '"></div>';
    const f = s => box.querySelector('[data-f=' + s + ']'), msg = box.querySelector('.pt-dmsg');
    const lock = () => ['ip', 'mask', 'gw', 'dns'].forEach(k => { f(k).disabled = h.dhcp; });
    const fill = () => { f('ip').value = p.ip != null ? ip.str(p.ip) : ''; f('mask').value = p.mask != null ? ip.str(p.mask) : ''; f('gw').value = h.gw != null ? ip.str(h.gw) : ''; f('dns').value = h.dns != null ? ip.str(h.dns) : ''; };
    lock();
    box.querySelectorAll('input[type=radio]').forEach(r => r.onchange = () => {
      h.dhcp = r.value === 'dhcp' && r.checked; lock();
      if (h.dhcp) { msg.textContent = 'Requesting IP Address...'; this.net.dhcpClient(d, 'FastEthernet0', okk => { msg.textContent = okk ? 'DHCP request successful.' : 'DHCP failed. APIPA is being used.'; msg.className = 'pt-dmsg ' + (okk ? 'pt-ok' : 'pt-bad'); fill(); this.changed(); }); if (!this.net.sim) this.net.runAll(); }
    });
    const save = () => {
      const a = f('ip').value.trim(), m = f('mask').value.trim(), g = f('gw').value.trim(), s = f('dns').value.trim();
      if (a && !ip.valid(a)) return toast('Invalid IP address.');
      p.ip = a ? ip.toInt(a) : null;
      p.mask = m && ip.isMask(m) ? ip.toInt(m) : (a ? ip.mask(ip.classful(a).len) : null); if (a && !m) f('mask').value = ip.str(p.mask);
      h.gw = g && ip.valid(g) ? ip.toInt(g) : null; h.dns = s && ip.valid(s) ? ip.toInt(s) : null; d.arp = {}; this.changed();
    };
    ['ip', 'mask', 'gw', 'dns'].forEach(k => { f(k).onchange = save; });
  };

  /* Desktop: little apps */
  const APPS = [['ipc', '🖧', 'IP Configuration'], ['cmd', '⌨', 'Command Prompt'], ['web', '🌐', 'Web Browser'], ['term', '🖥', 'Terminal'], ['wifi', '📶', 'PC Wireless']];
  UI.tabDesktop = function (w) {
    const d = w.d; if (w.app && !w.appKeep) w.app = null; w.appKeep = false;
    if (!w.app) { w.body.innerHTML = '<div class="pt-apps">' + APPS.filter(a => a[0] !== 'wifi' || d.type === 'laptop').map(([k, i, l]) => '<button class="pt-app" data-app="' + k + '"><span class="pt-ai">' + i + '</span>' + l + '</button>').join('') + '</div>'; w.body.querySelector('.pt-apps').onclick = e => { const b = e.target.closest('[data-app]'); if (b) { w.app = b.dataset.app; w.appKeep = true; this.showTab(w, 'Desktop'); } }; return; }
    const meta = APPS.find(a => a[0] === w.app);
    w.body.innerHTML = '<div class="pt-apph"><span>' + meta[1] + ' ' + meta[2] + '</span><button class="pt-btn" data-close>✕ Close</button></div><div class="pt-appb" style="flex:1;min-height:0;display:flex;flex-direction:column"></div>';
    w.body.querySelector('[data-close]').onclick = () => { w.app = null; this.showTab(w, 'Desktop'); };
    const box = w.body.querySelector('.pt-appb');
    if (w.app === 'ipc') this.ipForm(box, d);
    if (w.app === 'cmd') { w.sh = w.sh || new PCShell(this, d); box.innerHTML = '<div style="flex:1;min-height:0;display:flex;flex-direction:column"></div>'; const t = new Term(box.firstChild, w.sh); w.sh.term = t; if (!w.sh.greeted) { w.sh.greeted = true; t.write('\nPacket Tracer PC Command Line 1.0\n'); } else if (w.sh.saved) t.write(w.sh.saved); t.ready(); const keep = () => { w.sh.saved = t.out.textContent; }; t.inp.addEventListener('keyup', keep); setTimeout(() => t.focus(), 30); }
    if (w.app === 'web') this.browser(box, d);
    if (w.app === 'term') {
      const pe = this.net.peer(d.id, 'RS 232'), t2 = pe && this.net.devs[pe.dev];
      if (!t2) { box.innerHTML = '<div class="pt-mute">No console cable. Connect this PC\'s RS 232 port to a router or switch Console port with a Console cable.</div>'; return; }
      box.innerHTML = '<div class="pt-mute" style="margin-bottom:6px">Terminal on ' + esc(t2.name) + ' · 9600 bits/s, 8 data bits, no parity, 1 stop bit</div><div style="flex:1;min-height:0;display:flex;flex-direction:column"></div>';
      const s = this.session(t2), t = new Term(box.lastChild, s); s.term = t; if (s.back) { t.write(s.back); s.back = ''; } t.ready(); setTimeout(() => t.focus(), 30);
    }
    if (w.app === 'wifi') {
      const h = d.host.wifi; box.innerHTML = '<div class="pt-form"><label>Wireless card</label><label><input type="checkbox" data-f="on"' + (h.on ? ' checked' : '') + '> On</label><label>SSID</label><input data-f="ssid" value="' + esc(h.ssid) + '"><label>WPA2 key</label><input data-f="key" value="' + esc(h.key) + '"><span></span><div class="pt-wst"></div></div><div class="pt-mute" style="margin-top:8px">Set the same SSID and key as an Access Point to join it. Give Wireless0 an address in Config or use DHCP.</div>' +
        '<div class="pt-hd">Wireless0 address</div><div class="pt-form"><label>IPv4 Address</label><input data-f="ip" value="' + (d.ports.Wireless0.ip != null ? ip.str(d.ports.Wireless0.ip) : '') + '"><label>Subnet Mask</label><input data-f="mask" value="' + (d.ports.Wireless0.mask != null ? ip.str(d.ports.Wireless0.mask) : '') + '"></div>';
      const f = s => box.querySelector('[data-f=' + s + ']'), st = () => { box.querySelector('.pt-wst').innerHTML = d.ports.Wireless0.link ? '<span class="pt-ok">Associated</span>' : '<span class="pt-bad">Not associated</span>'; };
      const upd = () => { h.on = f('on').checked; h.ssid = f('ssid').value.trim(); h.key = f('key').value; const a = f('ip').value.trim(), m = f('mask').value.trim(); d.ports.Wireless0.ip = ip.valid(a) ? ip.toInt(a) : null; d.ports.Wireless0.mask = ip.isMask(m) ? ip.toInt(m) : (ip.valid(a) ? ip.mask(ip.classful(a).len) : null); this.changed(); this.net.state(); st(); };
      ['on', 'ssid', 'key', 'ip', 'mask'].forEach(k => { f(k).onchange = upd; }); st();
    }
  };
  UI.browser = function (box, d) {
    box.innerHTML = '<div style="display:flex;gap:6px;margin-bottom:6px"><span style="align-self:center">URL</span><input class="pt-in" style="flex:1" value="http://"><button class="pt-btn pt-pri">Go</button></div><div class="pt-web"><div class="pt-mute">Type a server address or name and press Go.</div></div>';
    const inp = box.querySelector('input'), view = box.querySelector('.pt-web');
    const ALLOW = new Set(['P', 'H1', 'H2', 'H3', 'H4', 'B', 'I', 'U', 'EM', 'STRONG', 'BR', 'HR', 'UL', 'OL', 'LI', 'A', 'TABLE', 'TR', 'TD', 'TH', 'TBODY', 'THEAD', 'DIV', 'SPAN', 'PRE', 'CODE', 'CENTER', 'FONT', 'SMALL', 'BIG']);
    const render = (html, base) => {
      const doc = new DOMParser().parseFromString(String(html), 'text/html'), out = document.createElement('div');
      const walk = (src, dst) => { for (const n of src.childNodes) { if (n.nodeType === 3) dst.appendChild(document.createTextNode(n.textContent)); else if (n.nodeType === 1 && ALLOW.has(n.tagName)) { const e = document.createElement(n.tagName); if (n.tagName === 'A' && n.getAttribute('href')) e.dataset.href = n.getAttribute('href'); walk(n, e); dst.appendChild(e); } else if (n.nodeType === 1 && !/^(SCRIPT|STYLE|IFRAME|OBJECT|EMBED|LINK|META)$/.test(n.tagName)) walk(n, dst); } };
      walk(doc.body, out); view.innerHTML = ''; view.appendChild(out);
      view.querySelectorAll('a[data-href]').forEach(a => { a.onclick = e => { e.preventDefault(); const h2 = a.dataset.href; inp.value = /^https?:\/\//i.test(h2) ? h2 : 'http://' + base + '/' + h2.replace(/^\//, ''); go(); }; });
    };
    const go = () => {
      const url = inp.value.trim(); if (!url || url === 'http://') return; view.innerHTML = '<div class="pt-mute">Request in progress…</div>';
      this.net.http(d, url, r => { if (!r.ok) view.innerHTML = '<div style="color:#b00"><b>' + esc(r.err) + '</b></div>'; else render(r.body, r.host); });
      if (!this.net.sim) this.net.runAll(); else view.innerHTML = '<div class="pt-mute">Request in progress… step the simulation to deliver it.</div>';
    };
    box.querySelector('button').onclick = go; inp.onkeydown = e => { if (e.key === 'Enter') go(); };
  };

  /* Services: HTTP, DHCP, DNS on a server */
  UI.tabServices = function (w) {
    const d = w.d, sv = d.svc; let cur = w.svc || 'HTTP';
    w.body.innerHTML = '<div class="pt-split"><div class="pt-nav"><div class="pt-g">SERVICES</div>' + ['HTTP', 'DHCP', 'DNS'].map(k => '<div data-k="' + k + '">' + k + '</div>').join('') + '</div><div class="pt-pane"></div></div>';
    const pane = w.body.querySelector('.pt-pane');
    const onoff = (k, on) => '<div style="display:flex;gap:14px;margin-bottom:8px"><b style="min-width:60px">' + k + '</b><label><input type="radio" name="s' + k + d.id + '" value="1"' + (on ? ' checked' : '') + '> On</label><label><input type="radio" name="s' + k + d.id + '" value="0"' + (on ? '' : ' checked') + '> Off</label></div>';
    const show = k => {
      cur = w.svc = k; w.body.querySelectorAll('.pt-nav [data-k]').forEach(x => x.classList.toggle('pt-on', x.dataset.k === k));
      if (k === 'HTTP') {
        const fs = Object.keys(sv.http.files);
        pane.innerHTML = onoff('HTTP', sv.http.on) + '<div class="pt-hd">File Manager</div><table class="pt-tbl">' + fs.map(f => '<tr><td>' + esc(f) + '</td><td style="width:1%;white-space:nowrap"><button class="pt-btn" data-ed="' + esc(f) + '">Edit</button> <button class="pt-btn" data-rm="' + esc(f) + '">Delete</button></td></tr>').join('') + '</table><div style="display:flex;gap:6px;margin-top:8px"><input class="pt-in" data-nf placeholder="newpage.html"><button class="pt-btn" data-new>New file</button></div><div data-edit></div>';
      } else if (k === 'DHCP') {
        const pl = sv.dhcp.pools;
        pane.innerHTML = onoff('DHCP', sv.dhcp.on) + '<div class="pt-form"><label>Pool Name</label><input data-f="name" value="serverPool"><label>Default Gateway</label><input data-f="gw" placeholder="192.168.1.1"><label>DNS Server</label><input data-f="dns" placeholder="192.168.1.2"><label>Start IP Address</label><input data-f="start" placeholder="192.168.1.100"><label>Subnet Mask</label><input data-f="mask" value="255.255.255.0"><label>Maximum Users</label><input data-f="max" value="50"><span></span><div style="display:flex;gap:6px"><button class="pt-btn pt-pri" data-add>Add / Save</button></div></div>' +
          '<table class="pt-tbl" style="margin-top:8px"><tr><th>Pool</th><th>Gateway</th><th>DNS</th><th>Start</th><th>Mask</th><th>Max</th><th></th></tr>' + pl.map((p, i) => '<tr data-pick="' + i + '" style="cursor:pointer"><td>' + esc(p.name) + '</td><td>' + ip.str(p.gw) + '</td><td>' + ip.str(p.dns) + '</td><td>' + ip.str(p.start) + '</td><td>' + ip.str(p.mask) + '</td><td>' + p.max + '</td><td><button class="pt-btn" data-rmp="' + i + '">Remove</button></td></tr>').join('') + '</table>';
      } else {
        pane.innerHTML = onoff('DNS', sv.dns.on) + '<div class="pt-form"><label>Name</label><input data-f="name" placeholder="www.example.com"><label>Type</label><select data-f="type"><option>A</option><option>CNAME</option></select><label>Address / target</label><input data-f="val" placeholder="192.168.1.2"><span></span><button class="pt-btn pt-pri" data-addr>Add</button></div>' +
          '<table class="pt-tbl" style="margin-top:8px"><tr><th>No.</th><th>Name</th><th>Type</th><th>Detail</th><th></th></tr>' + sv.dns.recs.map((r, i) => '<tr><td>' + i + '</td><td>' + esc(r.name) + '</td><td>' + r.type + ' Record</td><td>' + esc(r.val) + '</td><td><button class="pt-btn" data-rmr="' + i + '">Remove</button></td></tr>').join('') + '</table>';
      }
      pane.querySelectorAll('input[type=radio]').forEach(r => r.onchange = () => { sv[k.toLowerCase()].on = r.value === '1' && r.checked; this.changed(); });
      const f = s => pane.querySelector('[data-f=' + s + ']');
      pane.onclick = e => {
        const b = e.target.closest('button,[data-pick]'); if (!b) return;
        if (b.dataset.ed) { const nm = b.dataset.ed; const ed = pane.querySelector('[data-edit]'); ed.innerHTML = '<div class="pt-hd">' + esc(nm) + '</div><textarea style="width:100%;height:150px;box-sizing:border-box;font:12px Consolas,monospace"></textarea><button class="pt-btn pt-pri" data-savef>Save</button>'; ed.querySelector('textarea').value = sv.http.files[nm]; ed.querySelector('[data-savef]').onclick = () => { sv.http.files[nm] = ed.querySelector('textarea').value; this.changed(); toast('Saved ' + nm + '.'); }; return; }
        if (b.dataset.rm) { delete sv.http.files[b.dataset.rm]; this.changed(); return show(k); }
        if (b.dataset.new != null) { const nm = pane.querySelector('[data-nf]').value.trim().replace(/[^\w.-]/g, ''); if (nm) { sv.http.files[nm] = sv.http.files[nm] || '<html><body><h2>' + esc(nm) + '</h2></body></html>'; this.changed(); show(k); } return; }
        if (b.dataset.add != null) { const vals = { name: f('name').value.trim() || 'serverPool', gw: ip.toInt(f('gw').value.trim()) || 0, dns: ip.toInt(f('dns').value.trim()) || 0, start: ip.toInt(f('start').value.trim()), mask: ip.toInt(f('mask').value.trim()), max: Math.max(1, Math.min(1000, +f('max').value || 50)) }; if (vals.start == null || vals.mask == null || !ip.isMask(vals.mask)) return toast('Enter a start address and a valid mask.'); const i = sv.dhcp.pools.findIndex(p => p.name === vals.name); if (i >= 0) sv.dhcp.pools[i] = vals; else sv.dhcp.pools.push(vals); this.changed(); return show(k); }
        if (b.dataset.rmp != null) { e.stopPropagation(); sv.dhcp.pools.splice(+b.dataset.rmp, 1); this.changed(); return show(k); }
        if (b.dataset.pick != null) { const p = sv.dhcp.pools[+b.dataset.pick]; f('name').value = p.name; f('gw').value = ip.str(p.gw); f('dns').value = ip.str(p.dns); f('start').value = ip.str(p.start); f('mask').value = ip.str(p.mask); f('max').value = p.max; return; }
        if (b.dataset.addr != null) { const nm = f('name').value.trim(), t = f('type').value, v = f('val').value.trim(); if (!nm || !v || (t === 'A' && !ip.valid(v))) return toast('Enter a name and ' + (t === 'A' ? 'an IP address.' : 'a target name.')); sv.dns.recs.push({ name: nm, type: t, val: v }); this.changed(); return show(k); }
        if (b.dataset.rmr != null) { sv.dns.recs.splice(+b.dataset.rmr, 1); this.changed(); return show(k); }
      };
    };
    w.body.querySelector('.pt-nav').onclick = e => { const it = e.target.closest('[data-k]'); if (it) show(it.dataset.k); };
    show(cur);
  };
})();

// Packet Tracer simulator, part 5: the Cisco IOS command line. A command tree per mode gives IOS behaviour: unique
// abbreviations ("conf t", "sh ip int br"), "?" help, Tab completion, "% Ambiguous" and "% Invalid input" errors with
// the ^ marker, "no" and "do" forms, password prompts and confirmations. Exec mode commands live here; configuration
// commands are in pt-ios-cfg.js and show commands in pt-ios-show.js.
(() => {
  const G = typeof window !== 'undefined' ? window : globalThis;
  const P = G.PTSim; const ip = P.ip;
  P.iosSpecs = P.iosSpecs || {};
  const KW = P.iosHelp = P.iosHelp || {};
  Object.assign(KW, {
    enable: 'Turn on privileged commands', disable: 'Turn off privileged commands', exit: 'Exit from the EXEC', logout: 'Exit from the EXEC', ping: 'Send echo messages',
    traceroute: 'Trace route to destination', show: 'Show running system information', telnet: 'Open a telnet connection', ssh: 'Open a secure shell client connection',
    terminal: 'Set terminal line parameters', length: 'Set number of lines on a screen', configure: 'Enter configuration mode', terminal_c: 'Configure from the terminal',
    copy: 'Copy from one file to another', 'running-config': 'Current operating configuration', 'startup-config': 'Contents of startup configuration (NVRAM)',
    write: 'Write running configuration to memory, network, or terminal', memory: 'Write to NV memory', erase: 'Erase a filesystem', reload: 'Halt and perform a cold restart',
    clear: 'Reset functions', 'arp-cache': 'Clear the entire ARP cache', 'mac-address-table': 'MAC forwarding table', 'mac': 'MAC configuration', 'address-table': 'MAC forwarding table',
    dynamic: 'dynamic entry type', nat: 'NAT configuration', translation: 'Clear dynamic translation', '*': 'Delete all dynamic translations', ip: 'Global IP configuration subcommands',
    '-l': 'Log in using this user name', end: 'Exit from configure mode', do: 'To run exec commands in config mode', no: 'Negate a command or set its defaults',
  });

  /* ---------- the command tree ---------- */
  function node(el) { return { el, kids: [], end: null }; }
  function parseEl(t) {
    const mm = /^([^[]+)(?:\[(.*)\])?$/.exec(t), lab = mm[1], hlp = mm[2];
    if (lab === 'A.B.C.D') return { param: 'ip', label: lab, help: hlp || 'IP address' };
    if (lab === 'WORD') return { param: 'word', label: lab, help: hlp || 'Name' };
    if (lab === 'LINE') return { param: 'line', label: lab, help: hlp || 'Text' };
    if (lab === 'IF') return { param: 'if', label: 'IF', help: hlp || 'Interface' };
    if (lab === 'IFR') return { param: 'line', label: 'IFR', help: hlp || 'Interface range, for example fa0/1 - 24' };
    const m = /^<(\d+)-(\d+)>$/.exec(lab); if (m) return { param: 'num', label: lab, lo: +m[1], hi: +m[2], help: hlp || 'Number' };
    return { kw: lab.toLowerCase(), help: hlp };
  }
  function expand(pat) {        // "{in|out}" -> two patterns
    const m = /\{([^}]+)\}/.exec(pat); if (!m) return [pat];
    return m[1].split('|').flatMap(alt => expand(pat.slice(0, m.index) + alt + pat.slice(m.index + m[0].length)));
  }
  function build(specs) {
    const root = node(null);
    for (const [pat, fn] of specs) for (const p of expand(pat)) {
      let n = root;
      for (const tok of p.match(/[^\s[]+(?:\[[^\]]*\])?/g) || []) {
        const el = parseEl(tok);
        let k = n.kids.find(c => (el.kw && c.el.kw === el.kw) || (el.param && c.el.param === el.param && c.el.label === el.label && c.el.lo === el.lo && c.el.hi === el.hi));
        if (!k) { k = node(el); n.kids.push(k); }
        else if (el.help && !k.el.help) k.el.help = el.help;
        n = k;
      }
      n.end = fn;
    }
    return root;
  }
  const trees = {};
  P.iosTree = mode => trees[mode] || (trees[mode] = build(P.iosSpecs[mode] || []));
  function tokenize(line) { const t = [], re = /\S+/g; let m; while ((m = re.exec(line))) t.push({ s: m[0], at: m.index }); return t; }
  function walk(root, line, upto) {
    const toks = tokenize(line), lim = upto == null ? toks.length : upto, vals = [];
    let n = root, i = 0;
    while (i < lim) {
      const t = toks[i].s, tl = t.toLowerCase();
      const lineKid = n.kids.find(k => k.el.param === 'line');
      let kws = n.kids.filter(k => k.el.kw && k.el.kw.startsWith(tl));
      const ex = kws.find(k => k.el.kw === tl); if (ex) kws = [ex];
      if (kws.length > 1) return { err: 'ambig', pos: i, toks };
      if (kws.length === 1) { n = kws[0]; vals.push(n.el.kw); i++; continue; }
      let hit = null;
      for (const k of n.kids) {
        const e = k.el; if (!e.param || e.param === 'line') continue;
        if (e.param === 'ip' && ip.valid(t)) { hit = [k, ip.toInt(t), 1]; break; }
        if (e.param === 'num' && /^\d+$/.test(t) && +t >= e.lo && +t <= e.hi) { hit = [k, +t, 1]; break; }
        if (e.param === 'if') { const a = P.ifParse(t); if (a) { hit = [k, a, 1]; break; } if (i + 1 < lim) { const b = P.ifParse(t + toks[i + 1].s); if (b && /^[a-z]+$/i.test(t)) { hit = [k, b, 2]; break; } } }
        if (e.param === 'word') { hit = [k, t, 1]; break; }
      }
      if (hit) { n = hit[0]; vals.push(hit[1]); i += hit[2]; continue; }
      if (lineKid) { vals.push(line.slice(toks[i].at).trim()); n = lineKid; i = lim; break; }
      return { err: 'invalid', pos: i, toks };
    }
    return { n, vals, toks, i };
  }
  P.iosWalk = walk;

  /* ---------- a CLI session on one device ---------- */
  const SUFFIX = { user: '>', priv: '#', config: '(config)#', if: '(config-if)#', subif: '(config-subif)#', ifrange: '(config-if-range)#', router: '(config-router)#', line: '(config-line)#', vlan: '(config-vlan)#', dhcp: '(dhcp-config)#', nacl_std: '(config-std-nacl)#', nacl_ext: '(config-ext-nacl)#' };
  class IOS {
    constructor(net, dev, opts) { this.net = net; this.d = dev; this.opts = opts || {}; this.mode = 'user'; this.ctx = {}; this.hist = []; this.await = null; this.busy = false; this.via = this.opts.via || 'console'; }
    o(t) { this.opts.out && this.opts.out(t); }
    ln(t) { this.o((t == null ? '' : t) + '\n'); }
    get host() { return this.d.cfg.hostname; }
    treeMode() { return ({ subif: 'if', ifrange: 'if', nacl_std: 'nacl', nacl_ext: 'nacl' })[this.mode] || this.mode; }
    promptText() { if (this.await) return this.await.prompt; return this.host + SUFFIX[this.mode]; }
    secret() { return !!(this.await && this.await.hide); }
    /* what a console user sees when the line opens */
    start() {
      if (!this.d.power) { this.ln('The device is powered off.'); return; }
      const c = this.d.cfg;
      if (c.motd) this.ln(c.motd);
      const line = this.via === 'console' ? c.lines.con : c.lines.vty;
      if (this.via !== 'console' && !line.local && !line.pw && line.login) { this.ln('\nPassword required, but none set\n'); this.closed = true; this.opts.onClose && this.opts.onClose(); return; }
      if (line.local || (line.login && line.pw)) this.login(line, 0);
      else if (this.via === 'console') this.ln('\nPress RETURN to get started!\n');
    }
    login(line, tries) {
      if (tries === 0) this.ln('\nUser Access Verification\n');
      if (tries >= 3) { this.ln('% Bad passwords\n'); if (this.via !== 'console') { this.closed = true; this.opts.onClose && this.opts.onClose(); } else this.login(line, 0); return; }
      const ask = user => this.await = { prompt: 'Password: ', hide: true, fn: pw => {
        const ok = line.local ? (this.d.cfg.users[user] && P.pwCheck(this.d.cfg.users[user].pw, pw)) : pw === line.pw;
        if (!ok) { this.ln(line.local ? '% Login invalid\n' : ''); return this.login(line, tries + 1); }
      } };
      if (line.local) this.await = { prompt: 'Username: ', fn: u => ask(u) }; else ask();
    }
    input(raw) {
      const line = String(raw == null ? '' : raw);
      if (this.await) { const a = this.await; this.await = null; this.ln(a.hide ? '' : ''); a.fn(line); this.touch(); return; }
      if (!this.d.power) return this.ln('The device is powered off.');
      if (!line.trim()) return;
      if (line.trim()[0] === '!') return;
      this.hist.push(line); if (this.hist.length > 50) this.hist.shift();
      this.exec(line);
      this.touch();
    }
    touch() { if (this.dirty) { this.dirty = false; this.net.touch(); this.net.state(); this.opts.changed && this.opts.changed(); } }
    exec(line, modeOverride) {
      const mode = modeOverride || this.treeMode();
      let w = walk(P.iosTree(mode), line);
      /* sub-modes fall back to global configuration commands, as IOS does */
      if ((w.err || !w.n.end) && !['user', 'priv', 'config'].includes(mode)) {
        const w2 = walk(P.iosTree('config'), line);
        if (!w2.err && w2.n.end) { this.mode = 'config'; this.ctx = {}; w = w2; }
      }
      if (w.err === 'ambig') return this.ln('% Ambiguous command: "' + line.trim() + '"');
      if (w.err === 'invalid') {
        if ((mode === 'user' || mode === 'priv') && w.pos === 0 && w.toks.length === 1 && /^[\w.-]+$/.test(w.toks[0].s)) {
          if (this.d.cfg.domainLookup) this.ln('Translating "' + w.toks[0].s + '"...domain server (255.255.255.255)');
          return this.ln('% Unknown command or computer name, or unable to find computer address');
        }
        const at = w.toks[w.pos].at, pr = mode === 'user' || mode === 'priv' ? this.promptText().length : this.promptText().length;
        return this.ln(' '.repeat(pr + at) + '^\n% Invalid input detected at \'^\' marker.\n');
      }
      if (!w.n.end) return this.ln('% Incomplete command.\n');
      this.dirty = true;
      try { w.n.end(this, w.vals); } catch (e) { this.ln('% ' + (e && e.message || e)); }
    }
    /* "?" pressed: list what may come next */
    help(line) {
      const mode = this.treeMode(), partial = !/\s$/.test(line) && line.length > 0;
      const toks = tokenize(line), upto = partial ? toks.length - 1 : toks.length;
      const w = walk(P.iosTree(mode), line, upto);
      if (w.err === 'ambig') return '% Ambiguous command: "' + line.trim() + '"';
      if (w.err) return '% Unrecognized command';
      if (partial) {
        const pre = toks[toks.length - 1].s.toLowerCase();
        const ks = w.n.kids.filter(k => k.el.kw && k.el.kw.startsWith(pre)).map(k => k.el.kw).sort();
        return ks.length ? ks.join('  ') : '% Unrecognized command';
      }
      const rows = w.n.kids.slice().sort((a, b) => (a.el.kw ? 0 : 1) - (b.el.kw ? 0 : 1) || String(a.el.kw || a.el.label).localeCompare(String(b.el.kw || b.el.label)))
        .map(k => '  ' + (k.el.kw || k.el.label).padEnd(18) + ' ' + (k.el.help || KW[k.el.kw] || ''));
      if (w.n.end) rows.push('  <cr>');
      return rows.join('\n');
    }
    complete(line) {
      if (/\s$/.test(line) || !line) return line;
      const toks = tokenize(line), w = walk(P.iosTree(this.treeMode()), line, toks.length - 1);
      if (w.err) return line;
      const pre = toks[toks.length - 1].s.toLowerCase(), ks = w.n.kids.filter(k => k.el.kw && k.el.kw.startsWith(pre));
      if (ks.length !== 1) return line;
      return line.slice(0, toks[toks.length - 1].at) + ks[0].el.kw + ' ';
    }
    ctrlZ() { if (this.mode !== 'user' && this.mode !== 'priv') { this.mode = 'priv'; this.ctx = {}; this.ln('\n%SYS-5-CONFIG_I: Configured from console by console'); } }
    async_(fn) { this.busy = true; const done = () => { this.busy = false; this.opts.ready && this.opts.ready(); }; fn(done); if (!this.net.sim) this.net.runAll(); }
  }
  P.IOS = IOS;

  /* passwords: enable secret is stored hashed, type 7 is Cisco's reversible scramble */
  const hash = s => { let h = 0x811c9dc5; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 0x01000193) >>> 0; } return h; };
  const b64 = './0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
  P.pwHash = (pw, salt) => { salt = salt || 'mERr'; let h = hash(salt + pw), o = ''; for (let i = 0; i < 22; i++) { o += b64[h & 63]; h = Math.imul(h ^ (h >>> 13), 0x5bd1e995) >>> 0; h ^= hash(pw + i); } return '$1$' + salt + '$' + o; };
  P.pwCheck = (stored, pw) => stored && (stored.hash ? P.pwHash(pw, stored.hash.split('$')[2]) === stored.hash : stored.plain === pw);
  const XK = 'dsfd;kfoA,.iyewrkldJKDHSUBsgvca69834ncxv9873254k;fg87';
  P.type7 = pw => { const s = 7; let o = ('0' + s).slice(-2); for (let i = 0; i < pw.length; i++) o += ('0' + (pw.charCodeAt(i) ^ XK.charCodeAt((s + i) % 53)).toString(16).toUpperCase()).slice(-2); return o; };

  /* ---------- exec mode commands ---------- */
  const priv = (s) => { if (s.mode === 'user') throw new Error('Invalid input'); };
  const U = P.iosSpecs.user = [], PR = P.iosSpecs.priv = [];
  const both = (pat, fn) => { U.push([pat, fn]); PR.push([pat, fn]); };
  U.push(['enable', s => {
    const c = s.d.cfg, sec = c.secret || c.enablePw;
    if (!sec) { if (s.via !== 'console') return s.ln('% No password set'); s.mode = 'priv'; return; }
    let n = 0; const ask = () => s.await = { prompt: 'Password: ', hide: true, fn: pw => { if (P.pwCheck(sec, pw)) { s.mode = 'priv'; return; } if (++n >= 3) return s.ln('% Bad secrets\n'); ask(); } };
    ask();
  }]);
  PR.push(['enable', s => { }]);
  PR.push(['disable', s => { s.mode = 'user'; }]);
  both('{exit|logout}', s => { s.mode = 'user'; s.ctx = {}; s.ln(''); if (s.via !== 'console') { s.closed = true; s.opts.onClose && s.opts.onClose(); } else s.ln('\n' + s.host + ' con0 is now available\n\n\n\n\n\nPress RETURN to get started.\n'); });
  both('terminal length <0-512>', s => { });
  both('ping WORD[Ping destination address or hostname]', (s, v) => pingCmd(s, v[1], 5));
  both('ping WORD[Ping destination address or hostname] repeat <1-2147483647>', (s, v) => pingCmd(s, v[1], Math.min(v[3], 100)));
  both('traceroute WORD[Trace route to destination address or hostname]', (s, v) => traceCmd(s, v[1]));
  function pingCmd(s, host, n) {
    const dst = ip.toInt(host);
    if (dst == null) return s.ln('% Unrecognized host or address, or protocol not running.\n');
    s.ln('Type escape sequence to abort.'); s.ln('Sending ' + n + ', 100-byte ICMP Echos to ' + ip.str(dst) + ', timeout is 2 seconds:');
    s.async_(done => { const ms = []; s.net.ping(s.d, dst, { count: n, onReply: r => { s.o(r.ok ? '!' : r.kind === 'unreach' || r.kind === 'admin' ? 'U' : '.'); if (r.ok) ms.push(r.ms); }, onDone: st => {
      s.ln(''); s.ln('Success rate is ' + Math.floor(100 * st.got / st.sent) + ' percent (' + st.got + '/' + st.sent + ')' + (st.got ? ', round-trip min/avg/max = ' + Math.min(...ms) + '/' + Math.round(ms.reduce((a, b) => a + b, 0) / ms.length) + '/' + Math.max(...ms) + ' ms' : '')); s.ln(''); done(); } }); });
  }
  function traceCmd(s, host) {
    const dst = ip.toInt(host); if (dst == null) return s.ln('% Unrecognized host or address, or protocol not running.\n');
    s.ln('Type escape sequence to abort.'); s.ln('Tracing the route to ' + ip.str(dst)); s.ln('');
    s.async_(done => s.net.trace(s.d, dst, { onHop: (t, rs) => { const f = rs.find(r => r.from != null); s.ln(String(t).padStart(3) + '   ' + (f ? ip.str(f.from).padEnd(16) : ''.padEnd(16)) + rs.map(r => r.ok || r.kind === 'unreach' ? (r.ms + ' msec').padEnd(10) : '*'.padEnd(10)).join('')); }, onDone: () => { s.ln(''); done(); }, max: 30 }));
  }
  both('telnet WORD[IP address or hostname of a remote system]', (s, v) => remote(s, v[1], 23));
  both('ssh -l WORD[Login name] WORD[IP address or hostname]', (s, v) => remote(s, v[3], 22, v[2]));
  function remote(s, host, port, user) {
    const dst = ip.toInt(host); if (dst == null) return s.ln('% Unknown command or computer name, or unable to find computer address');
    s.ln('Trying ' + ip.str(dst) + ' ...');
    s.async_(done => s.net.connect(s.d, dst, port, r => {
      if (!r.ok) { s.ln(r.kind === 'refused' ? '% Connection refused by remote host' : '% Connection timed out; remote host not responding'); s.ln(''); return done(); }
      const t = Object.values(s.net.devs).find(x => P.isIOS(x) && s.net.myIps(x).some(i => i.ip === dst));
      s.ln('Open'); s.opts.openRemote && s.opts.openRemote(t, port, user); done();
    }));
  }
  /* privileged only */
  PR.push(['configure terminal[Configure from the terminal]', s => { s.ln('Enter configuration commands, one per line.  End with CNTL/Z.'); s.mode = 'config'; s.ctx = {}; }]);
  PR.push(['configure', s => { s.await = { prompt: 'Configuring from terminal, memory, or network [terminal]? ', fn: a => { if (!a || 'terminal'.startsWith(a.toLowerCase())) { s.ln('Enter configuration commands, one per line.  End with CNTL/Z.'); s.mode = 'config'; } else s.ln('?Must be "terminal", "memory" or "network"'); } }; }]);
  const save = s => { s.d.startup = P.cfgSnapshot(s.d); s.ln('Building configuration...'); s.ln('[OK]'); };
  PR.push(['copy running-config startup-config', s => { s.await = { prompt: 'Destination filename [startup-config]? ', fn: () => save(s) }; }]);
  PR.push(['copy startup-config running-config', s => { if (!s.d.startup) return s.ln('%% Non-volatile configuration memory invalid or not present'); P.cfgApply(s.net, s.d, s.d.startup, true); s.ln('\n' + s.host + '#'); }]);
  PR.push(['write', save]); PR.push(['write memory', save]);
  const erase = s => { s.await = { prompt: 'Erasing the nvram filesystem will remove all configuration files! Continue? [confirm]', fn: a => { if (/^n/i.test(a)) return; s.d.startup = null; s.ln('[OK]'); s.ln('Erase of nvram: complete'); s.ln('%SYS-7-NV_BLOCK_INIT: Initialized the geometry of nvram'); } }; };
  PR.push(['write erase', erase]); PR.push(['erase startup-config', erase]);
  PR.push(['reload', s => {
    const go = () => s.await = { prompt: 'Proceed with reload? [confirm]', fn: a => { if (/^n/i.test(a)) return; P.reload(s.net, s.d); s.mode = 'user'; s.ctx = {}; s.ln(P.bootText(s.d)); s.start(); } };
    if (s.d.startup && JSON.stringify(P.cfgSnapshot(s.d)) !== JSON.stringify(s.d.startup) || (!s.d.startup && s.d._edited)) s.await = { prompt: 'System configuration has been modified. Save? [yes/no]:', fn: a => { if (/^y/i.test(a)) save(s); go(); } };
    else go();
  }]);
  PR.push(['clear arp-cache', s => { s.d.arp = {}; }]);
  PR.push(['clear mac address-table dynamic', s => { s.d.mac = {}; }]);
  PR.push(['clear mac-address-table dynamic', s => { s.d.mac = {}; }]);
  PR.push(['clear ip nat translation *', s => { s.d.natT = s.d.natT.filter(e => e.stat); }]);
  PR.push(['clear access-list counters', s => { Object.values(s.d.cfg.acls).forEach(a => a.rules.forEach(r => { r.hits = 0; })); }]);
  PR.push(['clear ip ospf process', s => { s.await = { prompt: 'Reset ALL OSPF processes? [no]: ', fn: () => { } }; }]);

  /* boot banner shown after reload */
  P.bootText = d => 'System Bootstrap, Version 15.1(4)M4, RELEASE SOFTWARE (fc1)\nCopyright (c) 2010 by cisco Systems, Inc.\n\nInitializing memory for ECC\n..\nBoot process complete.\n\nCisco IOS Software, ' + (d.type === 'switch' ? 'C2960 Software (C2960-LANBASEK9-M)' : 'C' + d.model + ' Software (C' + d.model + '-UNIVERSALK9-M)') + ', Version 15.1(4)M4, RELEASE SOFTWARE (fc2)\nTechnical Support: http://www.cisco.com/techsupport\n\n' + (d.startup ? '' : '\n         --- System Configuration Dialog ---\n\nContinue with configuration dialog? [yes/no]: no\n') + '\nPress RETURN to get started!\n';
})();

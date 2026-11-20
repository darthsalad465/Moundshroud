// Live fire — the engine behind Cyber > 🕶️ Cyber games > Live fire arena.
// Two ways to play the same engagement, both in real time against a bot you pick:
//
//   red  — you break into a defended estate while a Blue bot watches the wire, rotates
//          credentials, patches the flaw and kills your session as your trace climbs;
//   blue — you work the incident from the SOC while a Red bot scans, lands a shell,
//          escalates, pivots and stages the exfil before your eyes.
//
// Nothing here touches a network: every host, account, alert and packet is simulated.
const LiveOps = (function () {
  /* ---------------------------------------------------------------- roster */
  const BOTS = {
    rook: {
      id: 'rook', name: 'Rook', glyph: '♜', rank: 1,
      style: 'By the book', tag: 'Junior SOC · methodical',
      note: 'Slow to notice and slower to react. Rotates credentials late and almost never kills a live session — the cleanest first opponent.',
      blue: { decay: 1.5, first: 16, every: 18, at: { rotate: 52, patch: 70, kill: 88, block: 95 }, quip: 'Rook is still working through the alert queue.' },
      red: { rate: 0.55, stealth: 0.04, quip: 'Rook scans loudly and waits between steps.' }
    },
    moth: {
      id: 'moth', name: 'Moth', glyph: '♞', rank: 2,
      style: 'Quiet hands', tag: 'Stealth operator',
      note: 'Keeps the noise down and hides from the alert feed, but moves slowly. If you are patient, the estate is yours; if you are loud, you are blind.',
      blue: { decay: 1.15, first: 12, every: 15, at: { rotate: 45, patch: 64, kill: 80, block: 90 }, quip: 'Moth works the logs in silence.' },
      red: { rate: 0.5, stealth: 0.5, quip: 'Moth leaves almost no trace in the feed.' }
    },
    vulture: {
      id: 'vulture', name: 'Vulture', glyph: '♝', rank: 3,
      style: 'Brute force', tag: 'Credential spray',
      note: 'Comes in loud: sprays passwords, trips every lockout and rushes escalation. Fast to arrive, easy to spot, hard to evict once inside.',
      blue: { decay: 0.85, first: 8, every: 10, at: { rotate: 32, patch: 55, kill: 74, block: 86 }, quip: 'Vulture keeps hammering the login form.' },
      red: { rate: 1.0, stealth: 0.06, quip: 'Vulture sprays credentials across the estate.' }
    },
    warden: {
      id: 'warden', name: 'Warden', glyph: '♛', rank: 4,
      style: 'Zero trust', tag: 'Senior IR lead',
      note: 'Watches every hop: rotates early, patches the flaw the moment you touch it and drops your session without warning. Precision over speed.',
      blue: { decay: 0.7, first: 6, every: 8, at: { rotate: 26, patch: 46, kill: 62, block: 80 }, quip: 'Warden already has your source address.' },
      red: { rate: 1.15, stealth: 0.2, quip: 'Warden moves with intent and patches behind itself.' }
    },
    sable: {
      id: 'sable', name: 'Sable', glyph: '♚', rank: 5,
      style: 'Adaptive', tag: 'Threat hunter',
      note: 'Reads your playbook as you write it. Covers the obvious vector, hunts the one you use, and will sacrifice a session to trap you deeper in the estate.',
      blue: { decay: 0.55, first: 5, every: 6, at: { rotate: 22, patch: 38, kill: 54, block: 70 }, quip: 'Sable has started a hunt for you by name.' },
      red: { rate: 1.3, stealth: 0.3, quip: 'Sable probes, waits, then takes the shortest path.' }
    },
    null: {
      id: 'null', name: 'NULL', glyph: '☠', rank: 6,
      style: 'No signature', tag: 'Autonomous adversary',
      note: 'Not a person. Reacts on the same tick as your command, rewrites the estate under you and does not get tired. Bring a plan and a clean shell.',
      blue: { decay: 0.4, first: 3, every: 5, at: { rotate: 18, patch: 32, kill: 46, block: 62 }, quip: 'NULL is rewriting ACLs while you read this.' },
      red: { rate: 1.6, stealth: 0.45, quip: 'NULL has no timing pattern to exploit.' }
    }
  };
  const rankName = ['Recruit', 'Analyst', 'Operator', 'Elite', 'Ghost', 'Autonomous'];
  const botList = () => Object.keys(BOTS).map(k => BOTS[k]);
  const getBot = id => BOTS[id] || BOTS.warden;

  /* ---------------------------------------------------------------- small helpers */
  const rndFrom = seed => {
    let s = seed >>> 0;
    return n => {
      s = (s + 0x6D2B79F5) >>> 0;
      let t = Math.imul(s ^ (s >>> 15), s | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) % n;
    };
  };
  const pick = (r, a) => a[r(a.length)];
  const b64 = s => (typeof btoa === 'function' ? btoa(String(s)) : Buffer.from(String(s), 'utf8').toString('base64'));
  const un64 = s => (typeof atob === 'function' ? atob(s) : Buffer.from(s, 'base64').toString('utf8'));
  const hexOf = s => [...String(s)].map(c => c.charCodeAt(0).toString(16).padStart(2, '0')).join(' ');
  const wrap = (s, n) => String(s).replace(new RegExp('.{1,' + (n || 76) + '}', 'g'), '$&\n').trim();
  const encode = (text, mode) => mode === 'plain' ? String(text)
    : mode === 'b64' ? wrap(b64(text), 76)
    : mode === 'hex' ? wrap(hexOf(text), 48)
    : wrap(hexOf(b64(text)), 48);
  const PIPES = { plain: '', b64: ' | base64 -d', hex: ' | xxd -r', b64hex: ' | xxd -r | base64 -d' };

  const tokenize = s => {
    const out = []; let cur = '', q = null;
    for (let i = 0; i < s.length; i++) {
      const ch = s[i];
      if (q) { if (ch === q) q = null; else cur += ch; }
      else if (ch === '"' || ch === "'") q = ch;
      else if (ch === '\\' && i + 1 < s.length) cur += s[++i];
      else if (/\s/.test(ch)) { if (cur) { out.push(cur); cur = ''; } }
      else cur += ch;
    }
    if (cur) out.push(cur);
    return out;
  };
  const splitChain = s => {
    const parts = []; let cur = '', q = null;
    for (let i = 0; i < s.length; i++) {
      const c = s[i];
      if (q) { cur += c; if (c === q) q = null; continue; }
      if (c === '\\') { cur += c; if (i + 1 < s.length) cur += s[++i]; continue; }
      if (c === '"' || c === "'") { q = c; cur += c; continue; }
      if (c === ';') { parts.push(cur); cur = ''; continue; }
      if (c === '&' && s[i + 1] === '&') { parts.push(cur); cur = ''; i++; continue; }
      cur += c;
    }
    parts.push(cur);
    return parts.map(x => x.trim()).filter(Boolean);
  };
  const splitPipe = s => {
    const parts = []; let cur = '', q = null;
    for (let i = 0; i < s.length; i++) {
      const c = s[i];
      if (q) { cur += c; if (c === q) q = null; continue; }
      if (c === '\\') { cur += c; if (i + 1 < s.length) cur += s[++i]; continue; }
      if (c === '"' || c === "'") { q = c; cur += c; continue; }
      if (c === '|') { parts.push(cur); cur = ''; continue; }
      cur += c;
    }
    parts.push(cur);
    return parts.map(x => x.trim()).filter(Boolean);
  };

  /* ---------------------------------------------------------------- file system over a TerminalOps mission */
  const isDir = n => n && typeof n === 'object' && !('text' in n);
  const textOf = n => typeof n === 'string' ? n : String(n.text);
  const Unix = typeof module !== 'undefined' && module.exports ? require('./terminal-unix.js') : TerminalUnix;
  const permOf = n => Unix.permissions(n, isDir(n));

  function fsFor(m) {
    const homes = { ops: ['home', 'ops'], web: ['home', m.sshUser], db: ['home', m.dbUser] };
    const cwd = { ops: homes.ops.slice(), web: homes.web.slice(), db: ['srv'] };
    const walk = (host, parts) => {
      let n = m.trees[host];
      for (const s of parts) {
        if (!isDir(n) || !Object.hasOwn(n, s)) return undefined;
        n = n[s];
      }
      return n;
    };
    const resolve = (host, p) => {
      if (!p || p === '~') return homes[host].slice();
      if (p === '/') return [];
      if (p.startsWith('~/')) p = '/' + homes[host].join('/') + p.slice(1);
      const parts = p.startsWith('/') ? [] : cwd[host].slice();
      for (const s of p.split('/')) {
        if (!s || s === '.') continue;
        if (s === '..') parts.pop(); else parts.push(s);
      }
      return parts;
    };
    const list = (node, base, res) => {
      for (const k of Object.keys(node).sort()) {
        const p = base + '/' + k;
        res.push([p, node[k]]);
        if (isDir(node[k])) list(node[k], p, res);
      }
      return res;
    };
    return { homes, cwd, walk, resolve, list };
  }

  /* ================================================================ RED ROLE */
  // You attack. The chosen bot is the defender on the other side of the wire.
  function red(m, botId, opts) {
    const bot = getBot(botId);
    const R = bot.blue;
    const r = rndFrom((m.seed ^ 0x5f3759df) >>> 0);
    m = { ...m, trees: JSON.parse(JSON.stringify(m.trees)) };
    const fs = fsFor(m);
    const status = { rotate: false, patch: false, killed: 0, block: false, lockdown: false, honeypot: false };
    const st = {
      host: 'ops', root: false, heat: 0, tick: 0, over: false, win: false,
      scanned: false, passSeen: false, inWeb: false, dbPassSeen: false, onDb: false,
      blocked: false, blockUntil: 0, coverAt: 0, wiped: false, spoofs: 0,
      fails: 0, hints: 0, commands: 0, nextBlue: R.first, pending: [],
      srcIp: '198.51.100.' + (20 + r(70)), blueTicks: 0, lastBlue: '', killedSession: false
    };
    const feed = [];
    const notice = (k, t) => { st.pending.push({ k, t }); feed.push({ k, t, tick: st.tick }); };
    const envFile = m.envPath.split('/').pop();
    const backupEnv = '/var/backups/' + envFile;
    const envNode = fs.walk('web', fs.resolve('web', m.envPath));
    if (envNode && !isDir(envNode)) envNode.mode = '600';
    const putWeb = (p, node) => {
      const parts = fs.resolve('web', p);
      let n = m.trees.web;
      for (let i = 0; i < parts.length - 1; i++) { if (!isDir(n[parts[i]])) n[parts[i]] = {}; n = n[parts[i]]; }
      n[parts[parts.length - 1]] = node;
    };
    const hostUser = () => st.root ? 'root' : st.host === 'ops' ? 'ops' : st.host === 'web' ? m.sshUser : m.dbUser;
    const hostName = () => st.host === 'ops' ? 'workstation' : st.host === 'web' ? 'web01' : 'db01';
    const home = () => fs.homes[st.host];
    const disp = () => {
      const p = '/' + fs.cwd[st.host].join('/');
      const h = '/' + home().join('/');
      return p === h ? '~' : p.startsWith(h + '/') ? '~' + p.slice(h.length) : (p || '/');
    };
    const prompt = () => hostUser() + '@' + hostName() + ':' + disp() + (st.root ? '# ' : '$ ');
    const at = p => fs.walk(st.host, fs.resolve(st.host, p));
    const owns = parts => home().every((name, index) => parts[index] === name) || parts[0] === 'tmp';
    const readFile = p => {
      const parts = fs.resolve(st.host, p);
      const n = fs.walk(st.host, parts);
      if (n === undefined) return { err: p + ': No such file or directory' };
      if (isDir(n)) return { err: p + ': Is a directory' };
      if (!st.root && !(Unix.mode(n) & (owns(parts) ? 0o400 : 0o004))) return { err: p + ': Permission denied' };
      return { text: textOf(n) };
    };

    /* the leaked credential lives in a file the player has to decode */
    const refreshLeak = () => {
      const plain = [
        '# ' + m.org.name + ' - internal build notes (leaked from a public repository)',
        'HOST=' + m.targetIp,
        'USER=' + m.sshUser,
        'PASSWORD=' + m.sshPass,
        'NOTE=rotate this after the audit'
      ].join('\n');
      m.entryStored = encode(plain, m.enc);
      if (m.entry === 'notes') {
        m.trees.ops.home.ops.loot[m.leakName] = { text: m.entryStored, mode: '644' };
      } else if (m.entry === 'backup') {
        m.trees.web.var.www.backup[m.backupName] = { text: m.entryStored, mode: '644' };
      }
      m.entryCmd = m.entry === 'notes' ? 'cat ~/loot/' + m.leakName + PIPES[m.enc]
        : m.entry === 'backup' ? 'curl -s http://' + m.targetIp + '/backup/' + m.backupName + PIPES[m.enc]
        : 'ftp get ' + m.backupName + PIPES[m.enc];
    };

    const heatGain = n => Math.round(n * (st.wiped ? 0.62 : 1));
    const raise = (n, why) => {
      st.heat = Math.max(0, Math.min(100, st.heat + heatGain(n)));
      if (why && st.heat > 0) st.lastBlue = why;
    };

    /* ---------- the Blue bot's playbook */
    function blueAct() {
      if (st.over) return;
      if (st.heat >= 100 && !status.lockdown) {
        status.lockdown = true;
        st.over = true; st.win = false;
        notice('bad', '⛔ SOC LOCKDOWN — the edge ACL drops everything from your address. Incident IR-07 closed.');
        return;
      }
      if (!status.rotate && st.heat >= R.at.rotate) {
        status.rotate = true;
        m.sshPass = pick(r, ['Vantage', 'Cobalt', 'Lumen', 'Quarry']) + (100 + r(899)) + pick(r, ['!', '#', '@']);
        st.passSeen = false;
        refreshLeak();
        notice('blue', '◈ ' + bot.name + ' rotated the web01 service credential. Anything you had cached is stale — re-read the leak.');
        return;
      }
      if (!status.patch && st.heat >= R.at.patch) {
        status.patch = true;
        putWeb(backupEnv, { text: m.envStored, mode: '644' });
        notice('blue', '◈ ' + bot.name + ' rebuilt the sudo policy on web01 — the escalation flaw is gone. Their ops habit left a pre-change config copy in /var/backups.');
        return;
      }
      if (status.killed < 2 && st.heat >= R.at.kill && st.host !== 'ops') {
        status.killed++;
        st.host = 'ops'; st.root = false;
        st.killedSession = true;
        notice('blue', '◈ ' + bot.name + ' killed your session. EDR quarantined the shell and reset the socket — you are back on the workstation.');
        return;
      }
      if (!status.block && st.heat >= R.at.block) {
        status.block = true; st.blocked = true; st.blockUntil = st.tick + 28;
        notice('blue', '◈ ' + bot.name + ' null-routed ' + st.srcIp + ' at the edge. Use `spoof` to change your source, or wait it out.');
        return;
      }
      if (!status.honeypot && st.heat >= 60) {
        status.honeypot = true;
        notice('blue', '◈ ' + bot.name + ' planted a decoy record in the export on db01. Verifying the id matters now.');
      }
    }

    /* ---------- clock */
    function advance(n) {
      const steps = Math.max(0, n | 0);
      for (let i = 0; i < steps && !st.over; i++) {
        st.tick++;
        st.heat = Math.max(0, st.heat - R.decay);
        if (st.blocked && st.tick >= st.blockUntil) { st.blocked = false; }
        st.blueTicks++;
        if (st.blueTicks >= R.every) {
          st.blueTicks = 0;
          if (st.heat >= 12) {
            blueAct();
            if (st.heat < 12) { /* nothing to see */ }
          }
        }
        if (st.tick > 0 && st.tick % 40 === 0 && st.heat > 30) {
          notice('sys', '· SOC correlation window +40s · trace ' + Math.round(st.heat) + '%');
        }
        if (st.tick >= 420) {
          st.over = true; st.win = false;
          notice('bad', '⛔ The incident response team finished its sweep and rebuilt the estate. You ran out of time.');
        }
      }
      if (st.heat >= 100) blueAct();
    }

    /* ---------- commands */
    const scanRows = () => m.scanRows.join('\n');
    const entryText = () => m.entryStored;
    const commands = {};
    const cmds = {};

    cmds.help = () => ({ out: [
      'Live fire · red team shell',
      '',
      '  recon    nmap -sV <ip> · curl <url> · ftp <ip> · ftp get <file>',
      '  decode   base64 -d · xxd -r · cat · grep · head · tail · cut · sort',
      '  access   ssh user@host · exit · id · whoami · sudo -l · sudo <cmd>',
      '  heat     heat · cover · wipe · spoof · sleep <n>   (these are your countermeasures)',
      '  finish   exfil <record id>      (on db01, after you read the records)',
      '',
      'Every action costs time and raises trace. The bot reacts to the trace, not to what you meant.'
    ].join('\n') });
    cmds.brief = () => ({ out: m.briefText });
    cmds.intel = () => ({ out: [
      'OPPOSITION  ' + bot.name + ' — ' + bot.tag + ' (' + bot.style + ')',
      'READ        ' + bot.note,
      'WATCH       trace ' + Math.round(st.heat) + '% · ' + (status.rotate ? 'rotation done' : 'no rotation yet') +
        ' · ' + (status.patch ? 'flaw patched' : 'flaw still open') + ' · ' + status.killed + ' session kill(s) absorbed',
      'ADVICE      cover lowers trace · wipe cuts every gain for the rest of the run · spoof clears a block'
    ].join('\n') });
    cmds.heat = () => ({ out: [
      'TRACE   ' + Math.round(st.heat) + '%  ' + '█'.repeat(Math.round(st.heat / 5)) + '·'.repeat(20 - Math.round(st.heat / 5)),
      'CLOCK   ' + st.tick + 's of 420s',
      'STATUS  ' + (status.block ? 'source null-routed' : 'source clean') + ' · session ' + (st.host === 'ops' ? 'none' : 'web01'),
      'COVER   ' + (st.tick < st.coverAt ? 'recharging (' + (st.coverAt - st.tick) + 's)' : 'ready') + ' · wipe ' + (st.wiped ? 'spent' : 'ready')
    ].join('\n') });
    cmds.cover = () => {
      if (st.tick < st.coverAt) return { out: 'cover: still recharging for ' + (st.coverAt - st.tick) + 's' };
      st.coverAt = st.tick + 12;
      st.heat = Math.max(0, st.heat - 18);
      notice('ok', '· cover traffic and rotated your source port — trace falls to ' + Math.round(st.heat) + '%');
      return { out: 'rotated the listener and padded the session. trace is now ' + Math.round(st.heat) + '%.', cost: 2 };
    };
    cmds.wipe = () => {
      if (st.wiped) return { out: 'wipe: nothing left to clean — the estate already has your fingerprints' };
      st.wiped = true;
      st.heat = Math.max(0, st.heat - 6);
      return { out: 'cleared shell history and timestamps. every future action raises roughly a third less trace.', cost: 2 };
    };
    cmds.spoof = () => {
      st.spoofs++;
      st.blocked = false;
      st.srcIp = '198.51.100.' + (20 + r(90));
      raise(8);
      return { out: 'new source address ' + st.srcIp + ' — outbound still routes through the same relay.' };
    };
    cmds.sleep = a => {
      const n = Math.max(1, Math.min(20, parseInt(a[0], 10) || 4));
      return { out: 'waiting ' + n + 's, letting the trace decay…', cost: n, quiet: true };
    };
    cmds.wait = a => cmds.sleep(a);

    cmds.nmap = a => {
      const ip = a.find(x => /^\d+\.\d+\.\d+\.\d+$/.test(x)) || '';
      if (a.includes('--interactive')) {
        if (m.esc.id !== 'suid-nmap') return { out: 'Starting Nmap 7.80\nInteractive mode is not available in this build.' };
        if (st.host !== 'web') return { out: 'nmap: interactive mode needs a shell on web01.' };
        st.nmapMode = true;
        return { out: 'Starting Nmap 7.80 ( https://nmap.org )\nInteractive mode. Type !sh for a shell.', cost: 2 };
      }
      if (!ip) return { out: 'usage: nmap -sV -Pn <ip>', err: true };
      if (ip !== m.targetIp) return { out: 'Note: Host ' + ip + ' seems to be down.\nNo ports scanned.', cost: 2 };
      st.scanned = true;
      raise(9);
      const extra = m.entry === 'backup' ? '\n| http-backup: /backup/ readable (config backup present)'
        : m.entry === 'ftp' ? '\n| ftp-anon: Anonymous FTP login allowed (FTP code 230)'
        : '\n| http-note: staff build notes published in a public repository';
      return {
        cost: 3,
        out: 'Starting Nmap 7.94 ( https://nmap.org )\nNmap scan report for ' + ip + '\nHost is up (0.021s latency).\n\nPORT     STATE    SERVICE   VERSION\n' +
          scanRows() + '\n' + extra + '\n\nHost script results:\n| egress: only tcp/80 and tcp/443 leave this network; inbound is blocked at the edge.'
      };
    };

    cmds.stat = a => Unix.permissionStat(a, at, isDir) || Unix.permissionStat(['-c', '%A %n', ...a], at, isDir);
    cmds.chmod = a => Unix.chmod(a, p => fs.resolve(st.host, p), parts => fs.walk(st.host, parts), isDir, parts => st.root || owns(parts));
    cmds.md5sum = Unix.checksum('md5', readFile);
    cmds.sha256sum = Unix.checksum('sha256', readFile);
    cmds.ls = a => {
      const flags = a.filter(x => x.startsWith('-')).join('');
      const target = a.find(x => !x.startsWith('-')) || '.';
      const n = at(target);
      if (n === undefined) return { out: "ls: cannot access '" + target + "': No such file or directory" };
      if (!isDir(n)) return { out: flags.includes('l') ? permOf(n) + ' 1 ' + hostUser() + ' ' + hostUser() + ' ' + textOf(n).length + ' ' + target : target };
      const names = Object.keys(n).filter(name => flags.includes('a') || !name.startsWith('.')).sort();
      if (flags.includes('l')) {
        return { out: 'total ' + names.length + '\n' + names.map(k => {
          const c = n[k];
          return permOf(c) + ' 1 ' + hostUser() + ' ' + hostUser() + ' ' + String(isDir(c) ? 4096 : textOf(c).length).padStart(6) + ' Feb 12 06:1' + (k.length % 6) + ' ' + k + (isDir(c) ? '/' : '');
        }).join('\n') };
      }
      return { out: names.map(k => k + (isDir(n[k]) ? '/' : '')).join('   ') };
    };
    cmds.cd = a => {
      const p = fs.resolve(st.host, a[0] || '~');
      const n = fs.walk(st.host, p);
      if (n === undefined) return { out: 'cd: ' + (a[0] || '~') + ': No such file or directory' };
      if (!isDir(n)) return { out: 'cd: ' + a[0] + ': Not a directory' };
      fs.cwd[st.host] = p;
      return { out: '' };
    };
    cmds.pwd = () => ({ out: '/' + fs.cwd[st.host].join('/') });
    cmds.cat = a => {
      if (!a.length) return { out: 'usage: cat <file>', err: true };
      const outs = [];
      for (const f of a) {
        const res = readFile(f);
        if (res.err) return { out: 'cat: ' + res.err, err: true };
        outs.push(res.text);
      }
      return { out: outs.join('\n') };
    };
    cmds.head = a => {
      const n = parseInt((a.find(x => /^-\d+$/.test(x)) || '-10').slice(1), 10) || 10;
      const f = a.find(x => !x.startsWith('-'));
      const res = readFile(f || '.');
      if (res.err) return { out: 'head: ' + res.err };
      return { out: res.text.split('\n').slice(0, n).join('\n') };
    };
    cmds.tail = a => {
      const n = parseInt((a.find(x => /^-\d+$/.test(x)) || '-10').slice(1), 10) || 10;
      const f = a.find(x => !x.startsWith('-'));
      const res = readFile(f || '.');
      if (res.err) return { out: 'tail: ' + res.err };
      return { out: res.text.split('\n').slice(-n).join('\n') };
    };
    cmds.grep = (a, stdin) => {
      const flags = a.filter(x => x.startsWith('-')).join('');
      const rest = a.filter(x => !x.startsWith('-'));
      const pat = rest.shift();
      if (pat == null) return { out: 'usage: grep [-inr] <pattern> [file...]', err: true };
      let re;
      try { re = new RegExp(pat, flags.includes('i') ? 'i' : ''); } catch (e) { return { out: 'grep: invalid pattern' }; }
      const hits = [];
      const scan = (txt, label) => txt.split('\n').forEach((l, i) => {
        if (re.test(l) !== flags.includes('v')) hits.push((label ? label + ':' : '') + (flags.includes('n') ? (i + 1) + ':' : '') + l);
      });
      if (!rest.length) { if (stdin == null) return { out: 'grep: no input' }; scan(stdin, ''); }
      else for (const f of rest) {
        const n = at(f);
        if (n === undefined) return { out: 'grep: ' + f + ': No such file or directory' };
        if (isDir(n)) {
          if (!flags.includes('r')) return { out: 'grep: ' + f + ': Is a directory' };
          for (const [p, c] of fs.list(n, f, [])) if (!isDir(c)) scan(textOf(c), p);
        } else scan(textOf(n), f);
      }
      return { out: flags.includes('c') ? String(hits.length) : hits.join('\n') };
    };
    cmds.find = a => {
      if (a.some(x => x === '-perm')) {
        const rows = ['/usr/bin/passwd', '/usr/bin/sudo', '/usr/bin/mount', '/usr/bin/su'];
        if (m.esc.id === 'suid-nmap' && !status.patch) rows.push('/usr/bin/nmap');
        return { out: rows.join('\n'), cost: 2 };
      }
      const start = a.find(x => !x.startsWith('-')) || '.';
      const n = at(start);
      if (!isDir(n)) return { out: "find: '" + start + "': No such file or directory" };
      const out = [];
      const walk = (node, base) => {
        for (const k of Object.keys(node).sort()) {
          const p = base + '/' + k;
          out.push(p);
          if (isDir(node[k])) walk(node[k], p);
        }
      };
      walk(n, start);
      return { out: out.join('\n'), cost: 2 };
    };
    cmds.tree = a => {
      const n = at(a.find(x => !x.startsWith('-')) || '.');
      if (!isDir(n)) return { out: 'tree: not a directory' };
      const rows = ['.'];
      const rec = (node, pre, d) => {
        const keys = Object.keys(node).sort();
        keys.forEach((k, i) => {
          const last = i === keys.length - 1;
          rows.push(pre + (last ? '`-- ' : '|-- ') + k + (isDir(node[k]) ? '/' : ''));
          if (isDir(node[k]) && d < 3) rec(node[k], pre + (last ? '    ' : '|   '), d + 1);
        });
      };
      rec(n, '', 0);
      return { out: rows.join('\n') };
    };
    cmds.base64 = (a, stdin) => {
      const dec = a.some(x => /^-(d|-decode)$/.test(x));
      const src = stdoutOrFile(a.filter(x => !x.startsWith('-')), stdin, readFile);
      if (src.err) return { out: 'base64: ' + src.err };
      if (src.text == null) return { out: 'base64: missing input' };
      try {
        return { out: dec ? un64(String(src.text).replace(/\s+/g, '')) : wrap(b64(String(src.text)), 76) };
      } catch (e) { return { out: 'base64: invalid input' } };
    };
    cmds.xxd = (a, stdin) => {
      const dec = a.includes('-r');
      const src = stdoutOrFile(a.filter(x => !x.startsWith('-')), stdin, readFile);
      if (src.err) return { out: 'xxd: ' + src.err };
      if (src.text == null) return { out: 'xxd: missing input' };
      const text = String(src.text);
      if (dec) {
        const hex = text.split('\n').map(l => l.replace(/^[0-9a-f]+:\s*/i, '').split(/\s{2,}/)[0]).join(' ').replace(/[^0-9a-f]/gi, '');
        if (!hex.length) return { out: 'xxd: no hex input' };
        let out = '';
        for (let i = 0; i + 1 < hex.length; i += 2) out += String.fromCharCode(parseInt(hex.slice(i, i + 2), 16));
        return { out };
      }
      const bytes = [...text].map(c => c.charCodeAt(0));
      const rows = [];
      for (let i = 0; i < bytes.length; i += 8) {
        const chunk = bytes.slice(i, i + 8);
        rows.push(i.toString(16).padStart(8, '0') + ': ' + chunk.map(b => b.toString(16).padStart(2, '0')).join(' ').padEnd(23) + '  ' + chunk.map(b => b >= 32 && b < 127 ? String.fromCharCode(b) : '.').join(''));
      }
      return { out: rows.join('\n') };
    };
    cmds.sort = (a, stdin) => {
      const src = stdoutOrFile(a.filter(x => !x.startsWith('-')), stdin, readFile);
      if (src.err) return { out: 'sort: ' + src.err };
      let l = String(src.text == null ? '' : src.text).split('\n').sort();
      if (a.includes('-r')) l.reverse();
      return { out: l.join('\n') };
    };
    cmds.cut = (a, stdin) => {
      let d = ' ', field = 1;
      for (let i = 0; i < a.length; i++) {
        const x = a[i];
        if (x === '-d') d = a[++i] || ' ';
        else if (x === '-f') field = parseInt(a[++i], 10) || 1;
        else if (/^-d./.test(x)) d = x.slice(2);
        else if (/^-f\d+/.test(x)) field = parseInt(x.slice(2), 10);
      }
      const src = stdoutOrFile(a.filter(x => !x.startsWith('-') && !/^-?\d+$/.test(x) && x !== d), stdin, readFile);
      const text = src.text == null ? '' : String(src.text);
      return { out: text.split('\n').map(l => l.split(d)[field - 1] || '').join('\n') };
    };
    cmds.wc = (a, stdin) => {
      const src = stdoutOrFile(a.filter(x => !x.startsWith('-')), stdin, readFile);
      if (src.err) return { out: 'wc: ' + src.err };
      return { out: String(String(src.text == null ? '' : src.text).split('\n').length).padStart(6) };
    };
    cmds.whoami = () => ({ out: hostUser() });
    cmds.hostname = () => ({ out: hostName() });
    cmds.id = () => ({ out: 'uid=' + (st.root ? '0(root)' : st.host === 'ops' ? '1000(ops)' : '1001(' + hostUser() + ')') +
      ' gid=' + (st.root ? '0(root)' : '1001(' + hostUser() + ')') +
      ' groups=' + (st.root ? '0(root)' : '1001(' + hostUser() + ')' + (m.esc.id === 'docker' && st.host === 'web' ? ',999(docker)' : '')) });
    cmds.uname = a => ({ out: a.includes('-a') ? 'Linux ' + hostName() + ' 5.15.0-91-generic #101-Ubuntu SMP x86_64 GNU/Linux' : 'Linux' });
    cmds.date = () => ({ out: new Date(2026, 1, 12, 6, 58, st.tick % 60).toUTCString() });
    cmds.env = () => ({ out: ['SHELL=/bin/bash', 'USER=' + hostUser(), 'PWD=/' + fs.cwd[st.host].join('/'), 'DB_HOST=db01.' + m.domain, 'DB_USER=' + m.dbUser].join('\n') });
    cmds.exit = () => {
      if (st.host === 'db') { st.host = 'web'; return { out: 'logout\nConnection to db01 closed.' }; }
      if (st.host === 'web') { st.host = 'ops'; st.root = false; return { out: 'logout\nConnection to web01 closed.' }; }
      return { out: 'logout: not connected' };
    };
    cmds.logout = () => cmds.exit();

    cmds.sudo = a => {
      if (a[0] === '-l') {
        raise(6);
        if (status.patch) {
          return { cost: 2, out: 'Matching Defaults entries for ' + hostUser() + ' on web01:\n    env_reset, mail_badpass, secure_path=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin\n\nUser ' + hostUser() + ' may not run sudo on web01.\n\n# ' + bot.name + ' closed the policy 6 seconds ago — /etc/sudoers.d was rebuilt from the audit baseline.' };
        }
        return { cost: 2, out: 'Matching Defaults entries for ' + hostUser() + ' on web01:\n    env_reset, mail_badpass, secure_path=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin\n\n' + m.esc.rule.map(l => l.replace('{user}', hostUser())).join('\n') };
      }
      if (st.host !== 'web') return { out: 'sudo: no valid sudoers sources on this host' };
      if (status.patch) return { out: 'sudo: a password is required\n(the policy was rebuilt — the hole is gone)' };
      const line = 'sudo ' + a.join(' ');
      if (!st.root && m.esc.test && m.esc.test(line)) {
        st.root = true;
        raise(16);
        return { cost: 2, out: 'uid=0(root) gid=0(root) groups=0(root)\nroot shell acquired — you are root on web01.' };
      }
      raise(7);
      if (m.esc.id === 'suid-nmap') return { out: 'sudo: a password is required\n(sudo is not the way in — look for a SUID binary)' };
      if (m.esc.id === 'docker') return { out: 'sudo: a password is required\nYou are in the docker group — you do not need sudo.' };
      return { out: 'sudo: a password is required' };
    };
    cmds.docker = a => {
      if (st.host !== 'web') return { out: 'docker: command not found' };
      if (m.esc.id !== 'docker' || status.patch) return { out: 'Cannot connect to the Docker daemon at unix:///var/run/docker.sock.' };
      if (a[0] === 'run' && /-v/.test(a.join(' '))) {
        if (st.root) return { out: 'You are already root.' };
        st.root = true;
        raise(17);
        return { cost: 2, out: 'uid=0(root) gid=0(root) groups=0(root)\nmounted / inside the container and chrooted — you are root on web01.' };
      }
      if (a[0] === 'ps') return { out: 'CONTAINER ID   IMAGE     COMMAND   STATUS\n3f1a2b9c7d10   app:1.4   "node"    Up 9 days' };
      return { out: 'usage: docker run -v /:/mnt --rm -it alpine chroot /mnt sh', err: true };
    };
    cmds['!sh'] = () => {
      if (!st.nmapMode) return { out: 'bash: !sh: command not found' };
      st.root = true;
      st.nmapMode = false;
      raise(17);
      return { out: 'uid=0(root) gid=0(root) groups=0(root)\n!sh raised a root shell out of the interactive nmap.' };
    };
    cmds['!bash'] = () => cmds['!sh']();

    cmds.curl = a => {
      if (st.host !== 'ops') return { out: 'curl: (6) Could not resolve host' };
      const url = a.find(x => !x.startsWith('-')) || '';
      const p = url.replace(/^https?:\/\/[^/]+/, '') || '/';
      raise(4);
      if (!url.includes(m.targetIp)) return { out: 'curl: (7) Failed to connect: connection refused', err: true };
      if (m.entry !== 'backup') {
        return { out: p === '/' || p === '' ? '<html><head><title>' + m.org.name + '</title></head><body><h1>It works!</h1></body></html>' : '<html><head><title>404 Not Found</title></head><body><h1>404</h1></body></html>', cost: 2 };
      }
      if (p === '/' || p === '') return { out: '<html><head><title>Index of /</title></head><body><h1>Index of /</h1><a href="backup/">backup/</a></body></html>', cost: 2 };
      if (/^\/?backup\/?$/.test(p)) return { out: '<html><head><title>Index of /backup</title></head><body><h1>Index of /backup</h1><a href="' + m.backupName + '">' + m.backupName + '</a>   (2019-04-02)</body></html>', cost: 2 };
      if (p.indexOf(m.backupName) >= 0) return { out: entryText(), cost: 2 };
      return { out: '<html><head><title>404 Not Found</title></head><body><h1>404</h1></body></html>', cost: 2 };
    };
    cmds.ftp = a => {
      raise(4);
      if (m.entry !== 'ftp') return { out: 'ftp: connect: Connection refused', err: true };
      if (a[0] === 'get') {
        if (!a[1]) return { out: 'usage: ftp get <file>', err: true };
        return { out: a[1] === m.backupName ? entryText() : '550 Failed to open file.', cost: 2 };
      }
      const ip = a.find(x => !x.startsWith('-')) || '';
      if (!ip) return { out: 'usage: ftp <ip>', err: true };
      if (ip !== m.targetIp) return { out: 'ftp: connect: Connection timed out', err: true };
      return { out: 'Connected to ' + m.targetIp + '.\n220 (vsFTPd 3.0.3)\nName: anonymous\n331 Please specify the password.\n230 Login successful.\nRemote system type is UNIX.\nUsing binary mode to transfer files.\nftp> dir\n-rw-r--r--    1 0 0   2048 Jan 12  2019 ' + m.backupName + '\n226 Directory send OK.\nftp> (use: ftp get ' + m.backupName + ')', cost: 2 };
    };

    const sshHost = h => {
      const v = String(h || '').toLowerCase();
      return v === m.targetIp || v === 'web01' || v === 'web01.' + m.domain;
    };
    const dbHost = h => {
      const v = String(h || '').toLowerCase();
      return v === 'db01' || v === 'db01.' + m.domain;
    };
    cmds.ssh = a => {
      const arg = a.find(x => !x.startsWith('-')) || '';
      if (!arg) return { out: 'usage: ssh user@host', err: true };
      const at2 = arg.indexOf('@');
      const user = at2 >= 0 ? arg.slice(0, at2) : null;
      const host = at2 >= 0 ? arg.slice(at2 + 1) : arg;
      if (st.host === 'db') return { out: 'ssh: already on db01 — exit first' };
      if (sshHost(host)) {
        if (st.host === 'web') return { out: 'ssh: you are already on web01' };
        if (st.blocked) {
          st.fails++;
          return { out: 'ssh: connect to host ' + host + ' port 22: Connection refused\n(your source address is null-routed at the edge — `spoof` or wait)', cost: 2 };
        }
        if (user && user !== m.sshUser) { st.fails++; raise(10); return { out: 'Permission denied (publickey,password).', cost: 2 }; }
        if (!st.passSeen) {
          st.fails++;
          raise(12);
          return { out: 'Permission denied (publickey,password).\nYou do not have the current password — re-read the leak.', cost: 2 };
        }
        st.host = 'web'; st.inWeb = true;
        raise(11);
        return { cost: 3, out: 'The authenticity of host \'' + host + '\' can\'t be established.\nWarning: Permanently added \'' + host + '\' (ED25519) to the list of known hosts.\n' + m.sshUser + '@web01:~$ (session open)' };
      }
      if (dbHost(host)) {
        if (st.host !== 'web') return { out: 'ssh: connect to host ' + host + ' port 22: Connection timed out\n(db01 is only reachable from inside the estate)', cost: 2 };
        if (user && user !== m.dbUser) { st.fails++; raise(8); return { out: 'Permission denied (publickey,password).', cost: 2 }; }
        if (!st.dbPassSeen) {
          st.fails++; raise(10);
          return { out: 'Permission denied (publickey,password).\nYou do not have the database password — decode the application config on web01 first.', cost: 2 };
        }
        st.host = 'db'; st.onDb = true;
        raise(13);
        return { cost: 3, out: 'The authenticity of host \'' + host + '\' can\'t be established.\nWarning: Permanently added \'' + host + '\' (ED25519) to the list of known hosts.\n' + m.dbUser + '@db01:/srv$ (session open)' };
      }
      return { out: 'ssh: connect to host ' + host + ' port 22: Connection timed out', cost: 2 };
    };

    cmds.exfil = a => {
      const v = String(a[0] || '').trim().toUpperCase();
      if (!v) return { out: 'usage: exfil <record id>   (run it on db01)', err: true };
      if (st.host !== 'db') return { out: 'exfil: stage the record from db01, not from here', err: true };
      if (st.heat >= 95) return { out: 'exfil: the SOC froze egress before the transfer started — you needed to be quieter or faster' };
      if (v !== m.recordId.toUpperCase()) {
        st.fails++;
        raise(9);
        return { out: '✗ ' + v + ' is not the engagement record. The transfer is refused and the SOC logs an egress attempt.', cost: 2 };
      }
      raise(20);
      st.over = true; st.win = true;
      return { cost: 2, out: '⇢ streaming ' + m.recordsCsv.split('\n').length + ' rows to your relay…\n⇢ ' + v + ' verified against the customer of record\n\n— engagement complete —' };
    };
    cmds.submit = a => cmds.exfil(a);
    cmds.clear = () => ({ out: '', quiet: true });
    cmds.cls = cmds.clear;
    cmds.ll = a => cmds.ls(['-la'].concat(a));
    cmds.la = a => cmds.ls(['-a'].concat(a));
    cmds.dir = a => cmds.ls(a);
    cmds.more = (a, s) => cmds.cat(a, s);
    cmds.less = (a, s) => cmds.cat(a, s);
    cmds.echo = a => ({ out: (a[0] === '-n' ? a.slice(1) : a).join(' '), quiet: true });
    cmds.uname = a => ({ out: a.includes('-a') ? 'Linux ' + hostName() + ' 5.15.0-91-generic x86_64 GNU/Linux' : 'Linux', quiet: true });
    cmds.hostname = () => ({ out: hostName(), quiet: true });
    cmds.date = () => ({ out: 'Thu Feb 12 06:58:12 UTC 2026', quiet: true });
    cmds.uptime = () => ({ out: 'up 14 days, load average: 0.14, 0.11, 0.08', quiet: true });
    cmds.env = () => ({ out: 'USER=' + userName() + '\nHOST=' + hostName() + '\nSHELL=/bin/bash\nPATH=/usr/local/bin:/usr/bin:/bin', quiet: true });
    cmds.printenv = cmds.env;
    cmds.ps = () => ({ out: '  PID TTY   CMD\n    1 ?     systemd\n  412 ?     sshd\n  518 ?     nginx\n 1042 pts/0 bash', quiet: true });
    cmds.ss = () => ({ out: 'Netid State  Local:Port\ntcp   LISTEN 0.0.0.0:22\ntcp   LISTEN 0.0.0.0:80', quiet: true });
    cmds.netstat = cmds.ss;
    cmds.ip = () => ({ out: '2: eth0: inet ' + (st.host === 'ops' ? '10.10.0.2/24' : st.host === 'web' ? m.targetIp + '/24' : '10.40.8.11/24'), quiet: true });
    cmds.ifconfig = cmds.ip;
    cmds.ping = a => ({ out: '64 bytes from ' + (a.find(x => !x.startsWith('-')) || m.targetIp) + ': icmp_seq=1 ttl=64 time=0.4 ms' });
    cmds.dig = a => ({ out: ';; ANSWER SECTION:\n' + (a[0] || m.domain) + '. 300 IN A ' + m.targetIp });
    cmds.nslookup = cmds.dig;
    cmds.which = a => ({ out: a.map(x => cmds[x] ? '/usr/bin/' + x : '').filter(Boolean).join('\n'), quiet: true });
    cmds.man = () => cmds.help();
    cmds.wget = a => cmds.curl(a);
    cmds.nc = a => ({ out: 'Connection to ' + (a[0] || m.targetIp) + ' ' + (a[1] || '22') + ' succeeded!' });
    cmds.uniq = (a, s) => { const t = s || ''; const ls2 = t.split('\n'), o = []; for (const l of ls2) if (o[o.length - 1] !== l) o.push(l); return { out: o.join('\n'), quiet: true }; };
    cmds.wc = (a, s) => { const t = s || ''; return { out: String(t ? t.split('\n').length : 0), quiet: true }; };
    cmds.tr = (a, s) => { const t = s || ''; const sets = a.filter(x => !x.startsWith('-')); if (a.includes('-d')) return { out: [...t].filter(c => !(sets[0] || '').includes(c)).join(''), quiet: true }; return { out: sets[0] === 'a-z' && sets[1] === 'A-Z' ? t.toUpperCase() : sets[0] === 'A-Z' && sets[1] === 'a-z' ? t.toLowerCase() : t, quiet: true }; };
    cmds.rev = (a, s) => ({ out: (s || a.join(' ')).split('\n').map(l => [...l].reverse().join('')).join('\n'), quiet: true });
    cmds.rot13 = (a, s) => ({ out: [...(s || a.join(' '))].map(c => /[a-z]/i.test(c) ? String.fromCharCode((c <= 'Z' ? 65 : 97) + (c.charCodeAt(0) - (c <= 'Z' ? 65 : 97) + 13) % 26) : c).join(''), quiet: true });
    cmds.nl = (a, s) => ({ out: (s || '').split('\n').map((l, i) => String(i + 1).padStart(6) + '\t' + l).join('\n'), quiet: true });
    cmds.tac = (a, s) => ({ out: (s || '').split('\n').reverse().join('\n'), quiet: true });
    cmds.hexdump = (a, s) => cmds.xxd(a.filter(x => x !== '-C'), s);
    cmds.df = () => ({ out: '/dev/vda1  40G  9G  31G  23% /', quiet: true });
    cmds.free = () => ({ out: 'Mem: 3.9Gi total, 1.2Gi used, 2.7Gi avail', quiet: true });
    cmds.groups = () => ({ out: st.root ? 'root' : userName(), quiet: true });
    cmds.true = () => ({ out: '', quiet: true });
    cmds.false = () => ({ out: '', quiet: true });

    function stdoutOrFile(args, stdin, read) {
      if (args.length) return read(args[0]);
      if (stdin != null) return { text: stdin };
      return { text: null };
    }

    /* ---------- run a typed line, then let time pass */
    const detect = text => {
      if (!text) return;
      if (!st.passSeen && text.includes(m.sshPass)) st.passSeen = true;
      if (!st.dbPassSeen && text.includes('DB_PASSWORD=' + m.dbPass)) st.dbPassSeen = true;
    };

    function run(line) {
      const raw = String(line == null ? '' : line).trim();
      if (!raw || st.over) return { out: st.over ? 'the engagement is closed — press New engagement' : '', events: [] };
      st.commands++;
      let text = '';
      let cost = 1;
      for (const part of splitChain(raw)) {
        let stdin = null, out = '';
        for (const pipe of splitPipe(part)) {
          const listDir = dir => { const n = walk(resolve(dir)); return isDirNode(n) ? Object.keys(n) : []; };
          const TP = typeof window !== 'undefined' && window.TerminalPlayground;
          const words = TP && TP.expandShellWords ? TP.expandShellWords(pipe, listDir) : tokenize(pipe);
          const name = words.shift();
          const fn = cmds[name];
          if (!fn) { out = 'bash: ' + name + ': command not found'; break; }
          let res;
          try { res = fn(words, stdin) || { out: '' }; } catch (e) { res = { out: 'bash: ' + name + ': ' + (e && e.message || e) }; }
          out = res.out == null ? '' : String(res.out);
          stdin = out;
          if (res.cost) cost = Math.max(cost, res.cost);
          if (res.heat) raise(res.heat);
        }
        if (out !== '') text += (text ? '\n' : '') + out;
      }
      detect(text);
      advance(cost);
      const events = st.pending.slice();
      st.pending = [];
      if (st.over && st.win) {
        text += '\n' + resultText();
      }
      return { out: text, events, cost };
    }

    function resultText() {
      return [
        '',
        '— RED TEAM RESULT —',
        '  estate        ' + m.org.name + ' · web01 → db01.' + m.domain,
        '  opponent      ' + bot.name + ' (' + bot.style + ')',
        '  time          ' + st.tick + 's   trace ' + Math.round(st.heat) + '%   failed attempts ' + st.fails,
        '  score         ' + score() + '/100   grade ' + grade()
      ].join('\n');
    }
    function score() {
      return Math.max(0, Math.min(100, Math.round(
        100 - st.heat * 0.45 - st.fails * 5 - st.hints * 4 - Math.max(0, st.tick - 120) * 0.12
      )));
    }
    const grade = () => { const s = score(); return s >= 92 ? 'S' : s >= 82 ? 'A' : s >= 68 ? 'B' : s >= 52 ? 'C' : 'D'; };
    const tick = n => {
      if (st.over) return [];
      st.pending = [];
      advance(n == null ? 1 : n);
      const e = st.pending.slice();
      st.pending = [];
      return e;
    };
    const publicState = () => ({
      tick: st.tick, heat: Math.round(st.heat), host: st.host, root: st.root,
      over: st.over, win: st.win, blocked: st.blocked, srcIp: st.srcIp,
      status: { rotate: status.rotate, patch: status.patch, killed: status.killed, block: status.block },
      fails: st.fails, hints: st.hints, score: score(), grade: grade(),
      dead: status.lockdown
    });
    const hint = () => {
      const next = !st.scanned ? 'nmap -sV -Pn ' + m.targetIp
        : !st.passSeen ? m.entryCmd
        : st.host === 'ops' ? 'ssh ' + m.sshUser + '@' + m.targetIp
        : !st.root && !status.patch ? m.esc.hint
        : !st.dbPassSeen ? 'cat ' + (status.patch ? backupEnv : m.envPath) + (/xxd/.test(m.envCmd) ? ' | xxd -r' : ' | base64 -d') + ' | grep DB_PASSWORD'
        : st.host !== 'db' ? 'ssh ' + m.dbUser + '@db01.' + m.domain
        : 'grep ' + m.given.split(' ')[0] + ' /srv/exports/records.csv  then  exfil <id>';
      st.hints++;
      raise(6);
      return 'hint (costs 6 trace): ' + next;
    };

    return {
      role: 'red', mission: m, bot: bot.id, state: st,
      prompt, run, tick, publicState, hint, score, grade,
      resultText, feed: () => feed
    };
  }

  /* ================================================================ BLUE ROLE */
  // You defend. The chosen bot is the attacker on the other side of the wire.
  function blue(m, botId, opts) {
    const bot = getBot(botId);
    const R = bot.red;
    const r = rndFrom((m.seed ^ 0x1b873593) >>> 0);
    const ips = ['185.220.101.' + (10 + r(200)), '45.9.' + (10 + r(200)) + '.' + (10 + r(200)), '91.219.' + (10 + r(200)) + '.7'];
    const vector = m.esc.id === 'docker' ? 'docker' : m.esc.id === 'suid-nmap' ? 'suid' : 'sudo';
    const st = {
      tick: 0, intrusion: 10, over: false, win: false, commands: 0, hints: 0,
      alerts: [], nextAlert: 4, sessions: [], kills: 0, downtime: 0, falsePos: 0,
      patched: { sudo: false, docker: false, suid: false, ssh: false },
      isolated: { web: false, db: false }, rotated: {}, reported: false,
      trace: 0, tracedIp: null, pending: [], stage: 'recon', nextStage: 0,
      ipIndex: 0, blockUntil: 0, evidence: [], lastAlert: 0
    };
    const feed = [];
    const say = (k, t) => { st.pending.push({ k, t }); feed.push({ k, t, tick: st.tick }); };
    const activeIp = () => ips[st.ipIndex % ips.length];
    const sessionOf = host => st.sessions.find(s => s.host === host);
    const raiseAlert = (sev, title, detail) => {
      const a = { id: st.alerts.length + 1, tick: st.tick, sev, title, detail, ip: activeIp(), open: true };
      st.alerts.push(a);
      say('alert', (sev === 'high' ? '▲▲ ' : sev === 'med' ? '▲ ' : '· ') + 'ALERT-' + String(a.id).padStart(3, '0') + '  ' + title + '\n     ' + detail);
      return a;
    };

    const STAGES = ['recon', 'foothold', 'escalate', 'pivot', 'stage', 'exfil'];
    function stageFor(v) {
      return v < 22 ? 'recon' : v < 45 ? 'foothold' : v < 62 ? 'escalate' : v < 78 ? 'pivot' : v < 90 ? 'stage' : 'exfil';
    }
    const stageLine = {
      recon: 'port scan and service fingerprint against web01',
      foothold: 'password spray against ssh on web01',
      escalate: 'local privilege escalation on web01',
      pivot: 'lateral movement web01 → db01',
      stage: 'staging /srv/exports on db01',
      exfil: 'outbound transfer of the records export'
    };

    function spawnSession(host) {
      if (sessionOf(host)) return;
      const pid = 2000 + r(7000);
      st.sessions.push({ pid, host, user: host === 'web' ? m.sshUser : m.dbUser, ip: activeIp(), since: st.tick, tool: host === 'web' ? 'sshd: ' + m.sshUser + ' [priv]' : 'sshd: ' + m.dbUser + ' [priv]' });
      say('bad', '▲ new authenticated session on ' + (host === 'web' ? 'web01' : 'db01') + ' — pid ' + pid + ' from ' + activeIp());
    }

    /* ---------- the Red bot's clock */
    function advance(n) {
      for (let i = 0; i < n && !st.over; i++) {
        st.tick++;
        const slowed = st.patched.ssh ? 0.55 : 1;
        const containedHost = (st.isolated.web ? 0.35 : 1) * (st.isolated.db ? 0.35 : 1);
        let rate = R.rate * slowed * containedHost;
        if (st.patched.sudo) rate *= 0.86;
        if (st.rotated[m.sshUser]) rate *= 0.82;
        st.intrusion = Math.min(120, st.intrusion + rate);
        st.stage = stageFor(st.intrusion);
        if (st.isolated.web) st.downtime++;
        if (st.isolated.db) st.downtime++;

        if (st.stage !== 'recon' && !sessionOf('web') && !st.isolated.web) spawnSession('web');
        if ((st.stage === 'pivot' || st.stage === 'stage' || st.stage === 'exfil') && !sessionOf('db') && !st.isolated.db) spawnSession('db');

        if (st.tick >= st.nextAlert) {
          st.nextAlert = st.tick + 6 + r(9);
          if (r(100) / 100 > R.stealth) {
            const stage = st.stage;
            if (stage === 'recon') raiseAlert('low', 'port scan from ' + activeIp(), 'nmap -sV against web01:22,80 — 14 probes in 3s');
            else if (stage === 'foothold') raiseAlert('med', 'ssh authentication failures', '8 failures for ' + m.sshUser + ' from ' + activeIp() + ' in 40s');
            else if (stage === 'escalate') raiseAlert('high', 'sudo policy abuse on web01', 'user ' + m.sshUser + ' executed a shell-spawning command as root');
            else if (stage === 'pivot') raiseAlert('high', 'lateral movement to db01', 'new session ' + m.dbUser + '@db01 from web01');
            else if (stage === 'stage') raiseAlert('high', 'bulk read on /srv/exports', 'tar of records.csv in progress on db01 (pid ' + (sessionOf('db') || { pid: '—' }).pid + ')');
            else raiseAlert('high', 'EGRESS: data leaving the estate', 'TLS upload of ~48MB from db01 to ' + activeIp() + ' — interrupt it now');
          }
        }
        if (st.intrusion >= 100) {
          st.over = true; st.win = false;
          say('bad', '⛔ EXFILTRATION COMPLETE — 48MB of ' + m.asset + ' left db01. Incident closed as a loss.');
          return;
        }
        if (st.kills >= 3 && !st.adapted) {
          st.adapted = true;
          st.ipIndex++;
          st.intrusion = Math.min(120, st.intrusion + 6);
          say('bad', '▲ the actor changed infrastructure after the third eviction and re-entered from ' + activeIp());
        }
      }
      if (!st.over && st.intrusion <= 0) {
        st.over = true; st.win = true;
        say('ok', '✓ intrusion driven to zero — the attacker has no foothold left');
      }
    }

    const cmds = {};
    cmds.help = () => ({ out: [
      'Live fire · blue team incident response',
      '',
      '  triage    alerts · alert <n> · report',
      '  hunt      netstat · ps aux · last · who · grep auth.log · grep -c failed auth.log',
      '  contain   block <ip> · kill <pid> · rotate <user> · isolate web01|db01 · restore web01|db01',
      '  harden    patch sudo|docker|suid|ssh · harden ssh · patch list',
      '  trace     trace <pid>   (collect evidence, then block the source)',
      '  evidence  cat notes.txt · chmod <mode> notes.txt · stat -c %a notes.txt · sha256sum notes.txt',
      '',
      'Intrusion rises on its own. Every action costs seconds; the bar falls when you actually contain something.'
    ].join('\n') });
    cmds.brief = () => ({ out: [
      'INCIDENT   ' + m.org.name + ' — suspected intrusion, ' + m.asset,
      'ESTATE     web01.' + m.domain + ' (10.40.12.20) · db01.' + m.domain + ' (10.40.8.11)',
      'ADVERSARY  ' + bot.name + ' — ' + bot.tag,
      'SCOPE      contain the intrusion and protect ' + m.asset + '. Business downtime counts against you.',
      'NOTE       ' + bot.note
    ].join('\n') });
    cmds.alerts = () => {
      const open = st.alerts.filter(a => a.open);
      if (!open.length) return { out: 'no open alerts — quiet for now' };
      return { out: open.map(a => 'ALERT-' + String(a.id).padStart(3, '0') + '  [' + a.sev + ']  ' + a.title + '   (t+' + a.tick + 's)').join('\n') };
    };
    cmds.alert = a => {
      const id = parseInt(a[0], 10);
      const al = st.alerts.find(x => x.id === id);
      if (!al) return { out: 'alert: no such alert', err: true };
      return { out: [
        'ALERT-' + String(al.id).padStart(3, '0') + '  ' + al.title,
        'raised    t+' + al.tick + 's   severity ' + al.sev,
        'source    ' + al.ip,
        'detail    ' + al.detail,
        'next      trace the pid, or block the source if you are sure'
      ].join('\n') };
    };
    cmds.netstat = () => {
      const rows = ['Proto Local Address           Foreign Address         State       PID/Program'];
      rows.push('tcp   10.40.12.20:22          10.40.0.9:51234         ESTABLISHED 884/sshd');
      rows.push('tcp   10.40.12.20:80          10.40.0.9:51880         ESTABLISHED 901/nginx');
      for (const s of st.sessions) rows.push('tcp   10.40.' + (s.host === 'web' ? '12.20' : '8.11') + ':22          ' + s.ip + ':4' + (1000 + s.pid % 8000) + '       ESTABLISHED ' + s.pid + '/sshd');
      return { out: rows.join('\n') };
    };
    cmds.ps = () => {
      const rows = ['USER       PID %CPU %MEM    VSZ   RSS TTY      STAT START   TIME COMMAND',
        'root         1  0.0  0.1 168400 11200 ?        Ss   06:02   0:04 /sbin/init',
        'root       884  0.0  0.2  15420  6100 ?        Ss   06:02   0:00 sshd: /usr/sbin/sshd -D',
        'www-data   901  0.1  0.8 612400 30120 ?        S    06:02   0:12 nginx: worker process',
        'root      1330  0.0  0.1  12040  4200 ?        Ss   06:02   0:00 /usr/sbin/cron -f'];
      for (const s of st.sessions) {
        rows.push((s.host === 'web' ? m.sshUser : m.dbUser).padEnd(9) + ' ' + String(s.pid).padStart(5) + '  0.3  0.2  18012  6120 ?        S    06:4' + (s.pid % 9) + '   0:00 sshd: ' + s.user + ' [priv]');
        if (s.host === 'db') rows.push('postgres  ' + String(s.pid + 1).padStart(5) + '  2.1  1.4 220120 44010 ?        S    06:4' + (s.pid % 9) + '   0:03 tar -czf /tmp/.x/export.tgz /srv/exports');
      }
      if (st.stage === 'escalate') rows.push('root      ' + (2400 + (m.seed % 500)) + '  0.0  0.1  10240  3600 ?        S    06:44   0:00 /bin/sh -p');
      return { out: rows.join('\n') };
    };
    cmds.last = () => {
      const rows = ['root     pts/0        10.40.0.9        Thu Feb 12 06:02   still logged in'];
      for (const s of st.sessions) rows.push(s.user.padEnd(8) + ' pts/' + (s.pid % 4) + '        ' + s.ip + '   Thu Feb 12 06:4' + (s.pid % 9) + '   still logged in');
      rows.push('', 'wtmp begins Thu Feb 12 06:00:11 2026');
      return { out: rows.join('\n') };
    };
    cmds.who = () => ({ out: st.sessions.map(s => s.user + '   pts/' + (s.pid % 4) + '   2026-02-12 06:44 (' + s.ip + ')').join('\n') || '' });
    cmds.grep = a => {
      const flags = a.filter(x => x.startsWith('-')).join('');
      const rest = a.filter(x => !x.startsWith('-'));
      const pat = rest.shift();
      if (!pat) return { out: 'usage: grep [-c] <pattern> <file>', err: true };
      const file = rest[0] || 'auth.log';
      if (!/auth\.log/.test(file)) return { out: 'grep: ' + file + ': No such file or directory' };
      const lines = ['Feb 12 06:41:02 web01 sshd[3110]: Failed password for ' + m.sshUser + ' from ' + activeIp() + ' port 44212 ssh2'];
      for (let i = 0; i < 6; i++) lines.push('Feb 12 06:4' + (1 + i) + ':' + String(10 + i * 3).padStart(2, '0') + ' web01 sshd[' + (3111 + i) + ']: Failed password for ' + m.sshUser + ' from ' + activeIp() + ' port ' + (44213 + i) + ' ssh2');
      if (st.sessions.length) lines.push('Feb 12 06:44:51 web01 sshd[3220]: Accepted password for ' + m.sshUser + ' from ' + activeIp() + ' port 45120 ssh2');
      if (st.stage === 'escalate' || st.stage === 'pivot') lines.push('Feb 12 06:45:09 web01 sudo:  ' + m.sshUser + ' : TTY=pts/1 ; PWD=/var/www/app ; USER=root ; COMMAND=/usr/bin/find . -exec /bin/sh -p ; -quit');
      const hits = lines.filter(l => new RegExp(pat, flags.includes('i') ? 'i' : '').test(l));
      return { out: flags.includes('c') ? String(hits.length) : hits.join('\n') };
    };
    cmds.block = a => {
      const ip = a[0];
      if (!ip) return { out: 'usage: block <ip>', err: true };
      if (ip === activeIp()) {
        st.intrusion = Math.max(0, st.intrusion - 22);
        st.alerts.forEach(x => { if (x.ip === ip) x.open = false; });
        st.sessions = st.sessions.filter(s => s.ip !== ip);
        st.ipIndex++;
        st.nextAlert = st.tick + 8;
        st.trace = 0; st.tracedIp = null;
        return { cost: 2, out: 'edge ACL updated: ' + ip + ' dropped. Attacker sessions on that address are gone; the actor is rotating egress, expect a new source.' };
      }
      const legit = ['10.40.0.9', '10.40.12.20', '10.40.8.11'].includes(ip);
      st.falsePos++;
      st.intrusion = Math.min(120, st.intrusion + 4);
      return { cost: 2, out: 'blocked ' + ip + '.' + (legit ? '\n⚠ that address belongs to the estate — users are calling the helpdesk.' : '\n(no hostile traffic seen from that address — the attacker will notice the noise)') };
    };
    cmds.kill = a => {
      const pid = parseInt(a[a.length - 1], 10);
      const s = st.sessions.find(x => x.pid === pid || x.pid + 1 === pid);
      if (!s) return { out: 'kill: (' + (a[0] || '?') + ') - No such process' };
      st.sessions = st.sessions.filter(x => x !== s);
      st.kills++;
      st.intrusion = Math.max(0, st.intrusion - 17);
      st.alerts.forEach(x => { if (/session|lateral|sudo/i.test(x.title)) x.open = false; });
      return { cost: 2, out: 'killed ' + pid + ' on ' + (s.host === 'web' ? 'web01' : 'db01') + '. EDR closed the socket; the actor will re-enter from ' + activeIp() + '.' };
    };
    cmds.rotate = a => {
      const user = a[0];
      if (!user) return { out: 'usage: rotate <user>', err: true };
      if (user !== m.sshUser && user !== m.dbUser) return { out: 'rotate: ' + user + ' has no active credential in this estate' };
      if (st.rotated[user]) return { out: 'rotate: ' + user + ' was already rotated — the attacker has not re-obtained it' };
      st.rotated[user] = true;
      st.intrusion = Math.max(0, st.intrusion - 14);
      return { cost: 2, out: 'rotated the password for ' + user + ' and revoked its sessions. Existing shells stay alive until killed.' };
    };
    cmds.patch = a => {
      if (!a[0] || a[0] === 'list') {
        return { out: ['patch list',
          '  sudo     /etc/sudoers.d/deploy  — NOPASSWD on shell-spawning binaries',
          '  docker   docker group membership — root-equivalent daemon access',
          '  suid     old SUID nmap — interactive mode drops to root',
          '  ssh      password authentication on web01'].join('\n') };
      }
      const k = a[0];
      if (!(k in st.patched)) return { out: 'patch: unknown target (sudo, docker, suid, ssh)', err: true };
      if (st.patched[k]) return { out: 'patch: ' + k + ' is already closed' };
      st.patched[k] = true;
      const hit = k === vector;
      st.intrusion = Math.max(0, st.intrusion - (hit ? 16 : 5));
      return { cost: 2, out: 'applied the ' + k + ' hardening baseline.' + (hit ? '\n✓ that is the path the attacker was using — its progress stalls while it looks for another way in.' : '\n(good hygiene, but not the vector in use)') };
    };
    cmds.harden = a => {
      if (a[0] !== 'ssh') return { out: 'usage: harden ssh', err: true };
      if (st.patched.ssh) return { out: 'harden: ssh is already locked down' };
      st.patched.ssh = true;
      st.intrusion = Math.max(0, st.intrusion - 9);
      return { cost: 4, out: 'PasswordAuthentication no · AllowUsers root · key-only sshd reloaded. Brute force stops working — but so does the deploy key rotation window.' };
    };
    cmds.isolate = a => {
      const h = (a[0] || '').replace(/\.$/, '');
      const key = /db/i.test(h) ? 'db' : /web/i.test(h) ? 'web' : null;
      if (!key) return { out: 'usage: isolate web01|db01', err: true };
      if (st.isolated[key]) return { out: 'isolate: ' + h + ' is already off the network' };
      st.isolated[key] = true;
      st.intrusion = Math.max(0, st.intrusion - 24);
      st.sessions = st.sessions.filter(s => s.host !== key);
      return { cost: 3, out: h + ' taken off the network. The intrusion path is cut — the business is down until you restore it.' };
    };
    cmds.restore = a => {
      const key = /db/i.test(a[0] || '') ? 'db' : /web/i.test(a[0] || '') ? 'web' : null;
      if (!key) return { out: 'usage: restore web01|db01', err: true };
      if (!st.isolated[key]) return { out: 'restore: ' + a[0] + ' is already online' };
      st.isolated[key] = false;
      return { cost: 2, out: a[0] + ' back online — monitor it closely for the next few minutes.' };
    };
    cmds.trace = a => {
      const pid = parseInt(a[0], 10);
      const s = st.sessions.find(x => x.pid === pid);
      if (!s) return { out: 'trace: no such session', err: true };
      st.trace = Math.min(100, st.trace + 45);
      if (st.trace >= 90) {
        st.tracedIp = s.ip;
        st.evidence.push(s.ip);
        return { cost: 2, out: 'trace complete — the session terminates at ' + s.ip + '. You now have enough to block it.' };
      }
      return { cost: 2, out: 'tracing ' + pid + '… ' + st.trace + '% of the route confirmed' };
    };
    cmds.report = () => {
      st.reported = true;
      st.over = true;
      st.win = st.intrusion < 30;
      return { out: st.win ? 'report filed: intrusion contained, ' + st.falsePos + ' false positive(s), ' + st.downtime + 's downtime.' : 'report filed: the intrusion is still live — containment incomplete.' };
    };
    cmds.clear = () => ({ out: '', quiet: true });
    cmds.cls = cmds.clear;
    cmds.ss = () => cmds.netstat();
    cmds.w = () => cmds.who();
    cmds.top = () => cmds.ps(['aux']);
    cmds.htop = cmds.top;
    cmds.id = () => ({ out: 'uid=0(soc) gid=0(soc) groups=0(soc),adm' });
    cmds.whoami = () => ({ out: 'soc' });
    cmds.hostname = () => ({ out: 'soc-console.' + m.domain });
    cmds.uname = a => ({ out: a.includes('-a') ? 'Linux soc-console 5.15.0-91-generic x86_64 GNU/Linux' : 'Linux' });
    cmds.pwd = () => ({ out: '/var/log/soc' });
    const evidenceFiles = Object.assign(Object.create(null), {
      'auth.log': { text: () => cmds.grep(['.', 'auth.log']).out },
      syslog: { text: () => feed.map(entry => 't+' + entry.tick + ' ' + entry.t).join('\n') },
      'alerts.json': { text: () => JSON.stringify(st.alerts, null, 2) },
      'firewall.rules': { text: () => cmds.iptables().out },
      'notes.txt': { text: () => 'Incident notes for ' + m.org.name + '\n', mode: '600' }
    });
    const evidencePath = path => [path.replace(/^(?:\/var\/log\/soc\/|\.\/)/, '')];
    const evidenceAt = parts => evidenceFiles[parts[0]];
    const readEvidence = path => {
      const file = evidenceAt(evidencePath(path));
      if (!file) return { err: path + ': No such file or directory' };
      if (!(Unix.mode(file) & 0o400)) return { err: path + ': Permission denied' };
      return { text: file.text() };
    };
    cmds.ls = a => ({ out: a.includes('-l') ? Object.keys(evidenceFiles).map(name => Unix.permissions(evidenceFiles[name]) + '  ' + name).join('\n') : Object.keys(evidenceFiles).join('  ') });
    cmds.ll = () => cmds.ls(['-l']);
    cmds.la = cmds.ls;
    cmds.dir = cmds.ls;
    cmds.chmod = a => Unix.chmod(a, evidencePath, evidenceAt, () => false, parts => parts[0] === 'notes.txt');
    cmds.stat = a => {
      const at = path => evidenceAt(evidencePath(path));
      return Unix.permissionStat(a, at, () => false) || Unix.permissionStat(['-c', '%A %n', ...a], at, () => false);
    };
    cmds.md5sum = Unix.checksum('md5', readEvidence);
    cmds.sha256sum = Unix.checksum('sha256', readEvidence);
    cmds.cat = a => {
      if (!a.length) return { out: 'usage: cat <file>', err: true };
      const files = a.map(readEvidence);
      return { out: files.map(file => file.err ? 'cat: ' + file.err : file.text).join('\n'), err: files.some(file => file.err) };
    };
    cmds.tail = cmds.cat;
    cmds.head = cmds.cat;
    cmds.less = cmds.cat;
    cmds.more = cmds.cat;
    cmds.echo = a => ({ out: a.join(' ') });
    cmds.date = () => ({ out: 'Thu Feb 12 06:58:12 UTC 2026' });
    cmds.uptime = () => ({ out: 'up 14 days, SOC active — T+' + st.tick + 's' });
    cmds.env = () => ({ out: 'USER=soc\nHOST=soc-console\nESTATE=' + m.domain });
    cmds.printenv = cmds.env;
    cmds.ip = () => ({ out: 'eth0: 10.40.12.20/24 (web01) · db01: 10.40.8.11/24' });
    cmds.ifconfig = cmds.ip;
    cmds.arp = () => ({ out: '10.40.12.20 ether 52:54:00:12:34:56 eth0\n10.40.8.11 ether 52:54:00:9a:bc:de eth0' });
    cmds.iptables = () => {
      const list = st.blockedIps ? Array.from(st.blockedIps) : Array.isArray(st.blocked) ? st.blocked : [];
      return { out: 'Blocked IPs: ' + (list.length ? list.join(', ') : '(none yet — use block <ip>)') };
    };
    cmds.ufw = cmds.iptables;
    cmds.journalctl = () => cmds.alerts();
    cmds.dmesg = () => ({ out: 'eth0: link up · auditd: monitoring web01 & db01' });
    cmds.ping = a => ({ out: '64 bytes from ' + (a[0] || '10.40.12.20') + ': icmp_seq=1 ttl=64 time=0.3 ms' });
    cmds.dig = a => ({ out: ';; ANSWER SECTION:\n' + (a[0] || m.domain) + '. 300 IN A ' + m.targetIp });
    cmds.nslookup = cmds.dig;
    cmds.whois = a => ({ out: 'IP/Domain: ' + (a[0] || m.targetIp) + ' — external source' });
    cmds.which = a => ({ out: a.map(x => cmds[x] ? '/usr/bin/' + x : '').filter(Boolean).join('\n') });
    cmds.man = () => cmds.help();
    cmds.df = () => ({ out: '/dev/vda1  40G  11G  29G  28% /' });
    cmds.free = () => ({ out: 'Mem: 8.0Gi total, 2.4Gi used, 5.6Gi avail' });
    cmds.true = () => ({ out: '' });
    cmds.false = () => ({ out: '' });

    function run(line) {
      const raw = String(line == null ? '' : line).trim();
      if (!raw || st.over) return { out: st.over ? 'the incident is closed — press New incident' : '', events: [] };
      st.commands++;
      const words = tokenize(raw);
      const name = words.shift();
      const fn = cmds[name];
      st.pending = [];
      let res;
      if (!fn) res = { out: 'bash: ' + name + ': command not found' };
      else { try { res = fn(words) || { out: '' }; } catch (e) { res = { out: 'error: ' + (e && e.message || e) }; } }
      const cost = res.cost || 1;
      if (!st.over && st.intrusion <= 0.4) {
        st.intrusion = 0;
        st.over = true; st.win = true;
        say('ok', '✓ intrusion driven to zero — the attacker has no foothold left');
      }
      advance(cost);
      const events = st.pending.slice();
      st.pending = [];
      let out = res.out == null ? '' : String(res.out);
      if (st.over) out += '\n' + resultText();
      return { out, events, cost };
    }

    function resultText() {
      return [
        '',
        '— BLUE TEAM RESULT —',
        '  estate        ' + m.org.name,
        '  adversary     ' + bot.name + ' (' + bot.style + ')',
        '  outcome       ' + (st.win ? 'contained' : 'data loss'),
        '  time          ' + st.tick + 's   evictions ' + st.kills + '   downtime ' + st.downtime + 's   false positives ' + st.falsePos,
        '  score         ' + score() + '/100   grade ' + grade()
      ].join('\n');
    }
    function score() {
      return Math.max(0, Math.min(100, Math.round(
        (st.win ? 70 : 20) - st.downtime * 0.8 - st.falsePos * 8 - st.hints * 4 + (st.win ? Math.max(0, 20 - st.tick * 0.25) : 0)
      )));
    }
    const grade = () => { const s = score(); return s >= 90 ? 'S' : s >= 80 ? 'A' : s >= 66 ? 'B' : s >= 50 ? 'C' : 'D'; };
    const tick = n => {
      if (st.over) return [];
      st.pending = [];
      advance(n == null ? 1 : n);
      const e = st.pending.slice();
      st.pending = [];
      return e;
    };
    const prompt = () => 'soc@' + m.org.code + '-ir:' + (st.stage === 'recon' ? '~' : '/var/incident') + '$ ';
    const publicState = () => ({
      tick: st.tick, intrusion: Math.round(st.intrusion), stage: st.stage, over: st.over, win: st.win,
      sessions: st.sessions.length, kills: st.kills, downtime: st.downtime, falsePos: st.falsePos,
      patched: Object.assign({}, st.patched), isolated: Object.assign({}, st.isolated),
      alerts: st.alerts.filter(a => a.open).length, score: score(), grade: grade(), activeIp: activeIp()
    });
    const hint = () => {
      st.hints++;
      const next = st.sessions.length
        ? 'kill ' + st.sessions[0].pid + '   then   block ' + st.sessions[0].ip
        : st.stage === 'recon' ? 'grep -c "Failed password" auth.log   (find the source address)'
        : 'check `ps aux` and `netstat`, then kill the session or isolate the host';
      return 'hint (score penalty): ' + next;
    };

    return {
      role: 'blue', mission: m, bot: bot.id, state: st,
      prompt, run, tick, publicState, hint, score, grade,
      resultText, feed: () => feed
    };
  }

  function begin(opts) {
    const level = opts && opts.level || 'analyst';
    const botId = opts && opts.bot || 'warden';
    const role = opts && opts.role === 'blue' ? 'blue' : 'red';
    if (typeof TerminalOps === 'undefined') return null;
    const m = TerminalOps.generate((opts && opts.seed) >>> 0, level);
    return role === 'blue' ? blue(m, botId, opts) : red(m, botId, opts);
  }

  return {
    BOTS, bots: botList, getBot, begin, red, blue,
    ranks: rankName, encode
  };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = LiveOps;

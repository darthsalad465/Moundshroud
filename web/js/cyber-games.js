// Cyber games for the Entertainment tab. Everything here is a harmless sandbox: fake files, a fake database, made-up emails and logs. Nothing touches the network or this PC.
(() => {
  const P = A.play, L = P.logic = P.logic || {};
  /* game ids are looked up inside the element the game was mounted in (Games tab #plstage or Cyber tab #cygstage), so they cannot clash with ids elsewhere in the app */
  let stage = null;
  const $ = id => stage && stage.querySelector('#' + id);
  const reg = (id, name, icon, desc, mount) => { P.games[id] = { name, icon, desc, mount: (el, api) => { stage = el; return mount(el, api); }, cat: 'cyber' }; };
  const rnd = n => Math.random() * n | 0, pick = a => a[rnd(a.length)], shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = rnd(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const num = (k, d) => +ls.get(k, String(d));
  const btn = (id, t, cls) => '<button class="' + (cls || 'ib') + '" id="' + id + '">' + t + '</button>';
  const box = 'border:1px solid var(--line);background:var(--panel2);border-radius:10px;padding:10px 12px';
  const mono = 'font-family:Consolas,"Cascadia Mono",monospace';

  /* ================= CIPHER BREAKER ================= */
  const PHR = ['THE ROUTER PASSWORD IS ON THE STICKY NOTE', 'NEVER CLICK LINKS IN STRANGE EMAILS', 'UPDATE YOUR SOFTWARE EVERY WEEK', 'THE QUICK BROWN FOX LOCKS THE DOOR', 'LONG PASSPHRASES BEAT SHORT PASSWORDS', 'BACK UP YOUR FILES BEFORE THE STORM', 'SECURITY IS A HABIT NOT A PRODUCT', 'TURN ON TWO FACTOR LOGIN TODAY', 'MEET ME AT THE LIBRARY AT NOON', 'ONLY THE PARANOID SURVIVE THE INTERNET', 'KNOWLEDGE IS THE BEST FIREWALL', 'THE CAKE IS A LIE'];
  const WORDS = ['FIREWALL', 'ROUTER', 'PHISHING', 'PASSWORD', 'ENCRYPT', 'NETWORK', 'SERVER', 'BROWSER', 'PACKET', 'SHIELD', 'SECRET', 'HACKER', 'CIPHER', 'TOKEN', 'VAULT', 'MOUNDSHROUD'];
  const MORSE = { A: '.-', B: '-...', C: '-.-.', D: '-..', E: '.', F: '..-.', G: '--.', H: '....', I: '..', J: '.---', K: '-.-', L: '.-..', M: '--', N: '-.', O: '---', P: '.--.', Q: '--.-', R: '.-.', S: '...', T: '-', U: '..-', V: '...-', W: '.--', X: '-..-', Y: '-.--', Z: '--..' };
  const shift = (s, k) => s.replace(/[A-Z]/g, c => String.fromCharCode((c.charCodeAt(0) - 65 + k + 260) % 26 + 65));
  const atbash = s => s.replace(/[A-Z]/g, c => String.fromCharCode(90 - (c.charCodeAt(0) - 65)));
  const vig = (s, key, dec) => { let i = 0; return s.replace(/[A-Z]/g, c => { const k = key.charCodeAt(i++ % key.length) - 65; return String.fromCharCode((c.charCodeAt(0) - 65 + (dec ? -k : k) + 26) % 26 + 65); }); };
  L.cipher = { shift, atbash, vig, MORSE };
  const TYPES = [
    { lv: 1, make: () => { const k = 1 + rnd(9), p = pick(PHR); return { ct: shift(p, k), pt: p, info: 'Caesar cipher: every letter was moved forward by ' + k + '. Move each one back ' + k + '.' }; } },
    { lv: 1, make: () => { const p = pick(PHR); return { ct: shift(p, 13), pt: p, info: 'ROT13: a Caesar shift of 13. Doing it twice gets you back to the start.' }; } },
    { lv: 2, make: () => { const p = pick(PHR); return { ct: atbash(p), pt: p, info: 'Atbash: the alphabet is mirrored, so A becomes Z, B becomes Y, and so on.' }; } },
    { lv: 2, make: () => { const k = 2 + rnd(23), p = pick(PHR); return { ct: shift(p, k), pt: p, unknown: true, info: 'Caesar with an unknown shift. There are only 25 possibilities, so a machine (or you) can try them all.' }; } },
    { lv: 3, make: () => { const p = pick(PHR); return { ct: btoa(p), pt: p, info: 'Base64: letters, digits, + and /, often ending in =. It is an encoding, not encryption. Anyone can reverse it.' }; } },
    { lv: 3, make: () => { const p = pick(WORDS); return { ct: [...p].map(c => c.charCodeAt(0).toString(16)).join(' '), pt: p, info: 'Hex: each pair of digits is one ASCII letter. 41 is A, 42 is B...' }; } },
    { lv: 4, make: () => { const p = pick(WORDS).slice(0, 6); return { ct: [...p].map(c => c.charCodeAt(0).toString(2).padStart(8, '0')).join(' '), pt: p, info: 'Binary: each group of 8 bits is one ASCII letter. 01000001 is A.' }; } },
    { lv: 4, make: () => { const p = pick(WORDS).slice(0, 6); return { ct: [...p].map(c => MORSE[c]).join('  '), pt: p, info: 'Morse code. Letters are separated by spaces.' }; } },
    { lv: 5, make: () => { const key = pick(['KEY', 'MOUNDSHROUD', 'LOCK', 'MOON']), p = pick(PHR); return { ct: vig(p, key), pt: p, info: 'Vigenere: a Caesar shift that changes with every letter, following the keyword ' + key + '.', key }; } },
    { lv: 6, make: () => { const k = 1 + rnd(12), p = pick(WORDS); return { ct: btoa(shift(p, k)), pt: p, info: 'Two layers! First decode the Base64, then undo a Caesar shift of ' + k + '.' }; } },
  ];
  reg('cipher', 'Cipher Breaker', '🔐', 'Crack codes from easy Caesar shifts up to layered ciphers. Learn how real encodings work.', (el, api) => {
    let score = 0, solved = 0, streak = 0, cur = null, hinted = false;
    el.innerHTML = '<div style="width:min(640px,100%)"><div class="small mute" id="cl" style="margin-bottom:6px"></div><div id="cc" style="' + box + ';' + mono + ';font-size:17px;word-break:break-all;line-height:1.6;min-height:60px"></div><div id="ci" class="small mute" style="margin:8px 0;min-height:20px"></div><div class="row" style="gap:8px"><input type="text" id="ca" placeholder="Type the decoded message" autocomplete="off" spellcheck="false" style="flex:1">' + btn('cg', 'Check', 'pri') + '</div><div class="row" style="gap:8px;margin-top:8px">' + btn('ch', 'Hint') + btn('cs', 'Skip (-5)') + btn('cb', 'Show all 25 shifts') + '</div><pre id="cx" class="small" style="margin-top:8px;white-space:pre-wrap;display:none;' + mono + '"></pre><div id="cm" style="margin-top:10px;min-height:22px"></div></div>';
    const norm = s => s.toUpperCase().replace(/[^A-Z0-9]/g, '');
    const lvl = () => Math.min(6, 1 + Math.floor(solved / 3));
    const next = () => { const ok = TYPES.filter(t => t.lv <= lvl()), t = Math.random() < .55 ? pick(ok.filter(x => x.lv === lvl())) || pick(ok) : pick(ok); cur = t.make(); hinted = false; $('cc').textContent = cur.ct; $('ci').textContent = ''; $('ca').value = ''; $('cx').style.display = 'none'; $('cm').textContent = ''; $('cb').style.display = cur.unknown ? '' : 'none'; $('cl').textContent = 'Level ' + lvl() + ' of 6   |   Solved ' + solved; api.hud('Score ' + score + '  Streak ' + streak); $('ca').focus(); };
    const check = () => { if (!cur) return; if (norm($('ca').value) === norm(cur.pt)) { const gain = 10 + Math.min(streak, 10) * 2 + (hinted ? 0 : 5); score += gain; streak++; solved++; api.submit(score); $('cm').innerHTML = '<span style="color:var(--ok)">Cracked! +' + gain + '</span> <span class="small mute">' + esc(cur.info) + '</span>'; $('cc').textContent = cur.pt; cur = null; api.hud('Score ' + score + '  Streak ' + streak); setTimeout(next, 1600); } else { streak = 0; $('cm').innerHTML = '<span style="color:var(--bad)">Not quite. Try again or ask for a hint.</span>'; api.hud('Score ' + score + '  Streak 0'); } };
    $('cg').onclick = check; $('ca').onkeydown = e => { if (e.key === 'Enter') check(); };
    $('ch').onclick = () => { if (!cur) return; hinted = true; $('ci').textContent = cur.info; };
    $('cs').onclick = () => { if (!cur) return; score = Math.max(0, score - 5); streak = 0; $('cm').innerHTML = '<span class="mute">It said: ' + esc(cur.pt) + '</span>'; cur = null; setTimeout(next, 1400); };
    $('cb').onclick = () => { if (!cur) return; hinted = true; $('cx').style.display = 'block'; $('cx').textContent = Array.from({ length: 25 }, (_, i) => ('shift ' + (i + 1)).padEnd(9) + ' ' + shift(cur.ct, -(i + 1))).join('\n'); };
    next(); return () => { cur = null; };
  });

  /* ================= TERMINAL HACKER ================= */
  const F = (c, locked) => ({ c, locked: !!locked });
  const logLines = () => { const out = []; const lv = ['INFO', 'INFO', 'INFO', 'WARN', 'DEBUG']; const msg = ['user login ok', 'cache refreshed', 'disk 71% used', 'request /index 200', 'request /about 200', 'retrying connection', 'backup finished', 'session closed']; for (let i = 0; i < 38; i++) out.push('2026-10-21 09:' + String(10 + i).padStart(2, '0') + ' ' + lv[(i * 7) % 5] + ' ' + msg[(i * 5) % msg.length]); out.splice(23, 0, '2026-10-21 09:47 DEBUG leaked token=FLAG{grep_finds_needles}'); return out.join('\n'); };
  const MIS = [
    { name: 'The lost note', cwd: '/home/you', flag: 'FLAG{dotfiles_are_not_invisible}', goal: 'Someone hid a flag in a hidden file in the Documents folder. Hidden files start with a dot.', hint: 'Try: cd Documents, then ls -a, then cat the hidden file.', fs: () => ({ home: { you: { 'readme.txt': 'Welcome to the lab. Use "help" for commands. Find the FLAG{...} and type: submit FLAG{...}', Documents: { 'todo.txt': 'buy milk\nlearn linux\nhide the flag better', '.hidden_flag.txt': 'FLAG{dotfiles_are_not_invisible}' }, Pictures: { 'cat.jpg': '[pretend this is a picture of a cat]' } } } }) },
    { name: 'Log hunter', cwd: '/var/log', flag: 'FLAG{grep_finds_needles}', goal: 'A server log has a leaked token somewhere in 39 lines. Do not read it by eye.', hint: 'grep FLAG server.log searches for a word.', fs: () => ({ var: { log: { 'server.log': logLines(), 'empty.log': '' } } }) },
    { name: 'Needle in a haystack', cwd: '/srv', flag: 'FLAG{find_searches_whole_trees}', goal: 'Somewhere under /srv is a file called master.key. Folders go deep.', hint: 'find / -name "master.key" prints every match with its path.', fs: () => ({ srv: { projects: { alpha: { src: { 'main.c': 'int main(){return 0;}' }, docs: { deep: { 'notes.txt': 'nothing here' } } }, beta: { archive: { 'old.key': 'expired key, ignore' } }, gamma: { vault: { deeper: { 'master.key': 'FLAG{find_searches_whole_trees}' } } } } } }) },
    { name: 'Secret code', cwd: '/home/you', flag: 'FLAG{base64_is_not_encryption}', goal: 'A note was "hidden" with Base64. That only looks scrambled.', hint: 'base64 -d message.b64 turns it back into text.', fs: () => ({ home: { you: { 'message.b64': btoa('FLAG{base64_is_not_encryption}'), 'readme.txt': 'The message is in message.b64' } } }) },
    { name: 'The locked drawer', cwd: '/home/you', flag: 'FLAG{permissions_matter}', goal: 'vault.txt exists but you cannot read it. File permissions say who can read, write or run a file.', hint: 'ls -l shows permissions. chmod +r vault.txt gives you read access.', fs: () => ({ home: { you: { 'vault.txt': F('FLAG{permissions_matter}', true), 'readme.txt': 'Look at the permissions column of ls -l' } } }) },
    { name: 'Final exam', cwd: '/home/you', flag: 'FLAG{you_are_a_terminal_wizard}', goal: 'Somewhere on this machine is a hidden file starting with .vault. It is locked and Base64 encoded.', hint: 'find / -name ".vault*" then chmod +r, cat, and base64 -d (you can decode a file or paste text).', fs: () => ({ home: { you: { 'readme.txt': 'Final exam. Combine everything.' } }, opt: { data: { backups: { '.vault_2026': F(btoa('FLAG{you_are_a_terminal_wizard}'), true) } } } }) },
  ];
  const isDir = n => n && typeof n === 'object' && !('c' in n);
  const rd = n => typeof n === 'string' ? n : n.c;
  const isLocked = n => !!(n && typeof n === 'object' && n.locked);
  const HELP_SECTIONS = [
    {
      title: 'NAVIGATION',
      items: [
        ['pwd', 'Print the current working directory'],
        ['ls [-a] [-l] [path...]', 'List files (-a hidden, -l details)'],
        ['ll / la [path]', 'Shortcuts for ls -la and ls -a'],
        ['cd [dir | ~ | -]', 'Change folder (.. up, ~ home, - back)'],
        ['tree [-a] [dir]', 'Show directory tree'],
      ]
    },
    {
      title: 'FILES & SEARCH',
      items: [
        ['cat [-n] <file...>', 'Print file contents (-n line numbers)'],
        ['head [-n N] <file>', 'Show first N lines (default 10)'],
        ['tail [-n N] <file>', 'Show last N lines (default 10)'],
        ['grep [-inrvcl] <pat> [file]', 'Search text (-i case, -n lines, -r tree)'],
        ['find [dir] [-name <pat>]', 'Find files (-iname ignore case, -type f|d)'],
        ['wc [-l|-w|-c] [file]', 'Count lines, words, and bytes'],
        ['strings <file>', 'Show readable text lines in a file'],
        ['stat / file <path>', 'Show file type, size, and permissions'],
      ]
    },
    {
      title: 'DECODING & PERMISSIONS',
      items: [
        ['base64 [-d] [file|text]', 'Encode or decode (-d/--decode) Base64'],
        ['chmod <mode> <file...>', 'Change permissions (+r, u+r, 644, -r)'],
      ]
    },
    {
      title: 'SHELL & MISSIONS',
      items: [
        ['echo <text>', 'Print text (works with pipes: |)'],
        ['whoami / id / uname', 'Show sandbox user and system info'],
        ['history / clear', 'Show command history / clear screen'],
        ['hint / skip / reset', 'Get a hint, skip, or restart mission'],
        ['missions / mission <1-6>', 'List missions or jump to one'],
        ['submit FLAG{...}', 'Submit a flag to finish the mission'],
      ]
    }
  ];
  const CMD_DOCS = {
    pwd: ['pwd', 'Print the absolute path of the current directory.', 'pwd'],
    ls: ['ls [-a] [-l] [-1] [path...]', 'List directory contents or file metadata.\n  -a  include hidden files (starting with .)\n  -l  long format with permissions and byte size\n  -1  one entry per line', 'ls -la Documents'],
    ll: ['ll [path...]', 'Alias for ls -la.', 'll'],
    la: ['la [path...]', 'Alias for ls -a.', 'la'],
    cd: ['cd [dir | ~ | -]', 'Change the current directory.\n  ..  parent directory\n  ~   home directory\n  -   previous directory', 'cd Documents'],
    tree: ['tree [-a] [dir]', 'Display a visual tree of directories and files.\n  -a  include hidden files', 'tree -a /srv'],
    cat: ['cat [-n] <file...>', 'Print the contents of one or more files (or piped input).\n  -n  prefix each line with its line number', 'cat -n readme.txt'],
    head: ['head [-n N | -N] [file]', 'Show the first N lines of a file or piped input (default 10).', 'head -n 5 server.log'],
    tail: ['tail [-n N | -N] [file]', 'Show the last N lines of a file or piped input (default 10).', 'tail -n 5 server.log'],
    grep: ['grep [-i] [-n] [-r] [-v] [-c] [-l] <pattern> [file...]', 'Search for text in files, directories (-r), or piped input.\n  -i  case-insensitive match\n  -n  show line numbers\n  -r  search directories recursively\n  -v  show non-matching lines\n  -c  print only the count of matches\n  -l  print only matching filenames', 'grep -in flag server.log'],
    find: ['find [dir] [-name|-iname <pattern>] [-type f|d]', 'Walk a directory tree and print matching paths.\n  -name   wildcard match (* and ?)\n  -iname  case-insensitive wildcard match\n  -type   f for files, d for directories', 'find / -name ".vault*"'],
    wc: ['wc [-l] [-w] [-c] [file...]', 'Count lines (-l), words (-w), and bytes (-c). Works with pipes.', 'wc -l server.log'],
    strings: ['strings [file]', 'Print readable text runs from a file or piped input.', 'strings cat.jpg'],
    stat: ['stat <path...>', 'Show file type, byte size, and permission mode.', 'stat vault.txt'],
    file: ['file <path...>', 'Describe what kind of file or directory a path is.', 'file message.b64'],
    base64: ['base64 [-d|--decode] [file | text]', 'Encode or decode Base64 from a file, raw text, or piped input.\n  -d, -D, --decode  decode Base64 back to plain text', 'base64 -d message.b64   |   cat message.b64 | base64 -d'],
    chmod: ['chmod <mode> <file...>', 'Change read permissions on files.\n  Unlock examples: +r, u+r, a+r, +rw, 644, 400, 755\n  Lock examples:   -r, a-r, 000', 'chmod +r vault.txt   |   chmod 644 vault.txt'],
    echo: ['echo [-n] <text...>', 'Print text to output. Useful with pipes.', 'echo RkxBR3t0ZXN0fQ== | base64 -d'],
    clear: ['clear', 'Clear the terminal output buffer (shortcut: Ctrl+L).', 'clear'],
    history: ['history', 'List previously entered commands in this session.', 'history'],
    whoami: ['whoami', 'Print the current simulated username.', 'whoami'],
    id: ['id', 'Print simulated user and group IDs.', 'id'],
    uname: ['uname [-a]', 'Print simulated operating system info.', 'uname -a'],
    hostname: ['hostname', 'Print the simulated machine hostname.', 'hostname'],
    help: ['help [command]', 'Show all available commands, or detailed help for one command.', 'help grep'],
    man: ['man <command>', 'Show the manual entry for a command (same as help <command>).', 'man find'],
    hint: ['hint', 'Display a hint for the active mission.', 'hint'],
    skip: ['skip', 'Skip ahead to the next mission.', 'skip'],
    reset: ['reset', 'Reset the current mission filesystem and working directory.', 'reset'],
    missions: ['missions', 'List all missions and show your progress.', 'missions'],
    mission: ['mission <1-6>', 'Switch directly to mission number 1 through 6.', 'mission 1'],
    submit: ['submit <FLAG{...}>', 'Submit the flag you found to complete the current mission.', 'submit FLAG{example}'],
  };
  reg('terminal', 'Terminal Hacker', '💻', 'A pretend Linux shell with six missions. Learn ls, cd, cat, grep, find, chmod and base64 by finding flags.', (el, api) => {
    let mi = Math.min(MIS.length - 1, num('cyterm', 0)), doneCount = num('cyterm', 0), tree, cwd, prevCwd = null, hist = [], hp = 0;
    el.style.alignItems = 'stretch';
    el.innerHTML = '<div style="width:min(780px,100%);margin:0 auto;display:flex;flex-direction:column;height:100%;min-height:380px"><div id="tg" class="small" style="' + box + ';margin-bottom:8px"></div><div id="to" style="flex:1;overflow:auto;background:#05070b;color:#c9f5d4;' + mono + ';font-size:13px;line-height:1.5;border:1px solid var(--line);border-radius:10px;padding:12px 14px;white-space:pre-wrap;min-height:220px"></div><div class="row" style="gap:6px;margin-top:6px;background:#05070b;border:1px solid var(--line);border-radius:10px;padding:6px 10px"><span id="tp" style="color:#6cf;' + mono + ';font-size:13px;white-space:nowrap"></span><input id="ti" autocomplete="off" spellcheck="false" style="flex:1;background:transparent;border:0;color:#fff;' + mono + ';font-size:13px;outline:none"></div></div>';
    const out = (t, c) => { const o = $('to'); const d = document.createElement('div'); d.textContent = t; if (c) d.style.color = c; o.appendChild(d); o.scrollTop = o.scrollHeight; };
    const outPre = (html, plain) => { const o = $('to'); const d = document.createElement('div'); d.style.whiteSpace = 'pre'; if (html != null) d.innerHTML = html; else d.textContent = plain || ''; o.appendChild(d); o.scrollTop = o.scrollHeight; };
    const path = (parts) => '/' + (parts || cwd).join('/');
    const walk = parts => { let n = tree; for (const p of parts) { if (!isDir(n) || !(p in n)) return undefined; n = n[p]; } return n; };
    const homeParts = () => walk(['home', 'you']) ? ['home', 'you'] : MIS[mi].cwd.split('/').filter(Boolean);
    const resolve = (p, base) => {
      if (!p || p === '~') return homeParts();
      if (p.startsWith('~/')) p = '/' + homeParts().join('/') + p.slice(1);
      let parts = p.startsWith('/') ? [] : (base || cwd).slice();
      for (const s of p.split('/')) { if (!s || s === '.') continue; if (s === '..') parts.pop(); else parts.push(s); }
      return parts;
    };
    const mode = (n) => (isDir(n) ? 'drwxr-xr-x' : isLocked(n) ? '----------' : '-rw-r--r--');
    const globRe = (g, ic) => new RegExp('^' + g.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.') + '$', ic ? 'i' : '');
    const expandArg = arg => {
      if (!/[*?]/.test(arg)) return [arg];
      const idx = arg.lastIndexOf('/'), dirPart = idx >= 0 ? arg.slice(0, idx) || '/' : '', pat = idx >= 0 ? arg.slice(idx + 1) : arg;
      const dir = resolve(dirPart || '.'), node = walk(dir);
      if (!isDir(node)) return [arg];
      const re = globRe(pat, false), wantDot = pat.startsWith('.');
      const hits = Object.keys(node).filter(k => (wantDot || k[0] !== '.') && re.test(k)).sort();
      if (!hits.length) return [arg];
      return hits.map(k => (dirPart ? (dirPart === '/' ? '/' : dirPart + '/') : '') + k);
    };
    const expandFiles = list => list.flatMap(expandArg);
    const findWalk = (n, base, pat, type, res) => {
      for (const k of Object.keys(n).sort()) {
        const p = base + '/' + k, dir = isDir(n[k]);
        const typeOk = !type || (type === 'd' && dir) || (type === 'f' && !dir);
        if (typeOk && (!pat || pat.test(k))) res.push(p);
        if (dir) findWalk(n[k], p, pat, type, res);
      }
      return res;
    };
    const updatePrompt = () => {
      const p = path(), hp0 = '/' + homeParts().join('/');
      const disp = p === hp0 ? '~' : p.startsWith(hp0 + '/') ? '~' + p.slice(hp0.length) : p;
      $('tp').textContent = 'you@moundshroud:' + disp + '$ ';
    };
    const load = () => {
      const m = MIS[mi];
      tree = m.fs();
      cwd = m.cwd.split('/').filter(Boolean);
      prevCwd = null;
      $('tg').innerHTML = '<b>Mission ' + (mi + 1) + ' of ' + MIS.length + ': ' + esc(m.name) + '</b><br>' + esc(m.goal) + '<br><span class="mute">Type <b>help</b> for commands, <b>hint</b> if stuck, and <b>submit FLAG{...}</b> when you find it.</span>';
      updatePrompt();
      api.hud('Missions done ' + Math.min(doneCount, MIS.length) + '/' + MIS.length);
    };
    const showHelp = (topic, emit) => {
      if (topic) {
        const k = topic.toLowerCase(), doc = CMD_DOCS[k];
        if (!doc) { emit('help: no help topic matching \'' + topic + '\'. Type "help" for all commands.', '#f77', true); return { ok: false }; }
        emit(k.toUpperCase(), '#6cf');
        emit('  Usage:   ' + doc[0], '#fff');
        doc[1].split('\n').forEach(l => emit('  ' + l, '#c9f5d4'));
        emit('  Example: ' + doc[2], '#fc6');
        return { ok: true };
      }
      if (emit.raw) {
        outPre('<span style="color:#fff;font-weight:700">Moundshroud Shell</span> <span style="color:#789">— Command Reference</span>');
        outPre('<span style="color:#2d3b45">' + '─'.repeat(72) + '</span>');
        HELP_SECTIONS.forEach((sec, idx) => {
          if (idx > 0) outPre('');
          outPre('<span style="color:#6cf;font-weight:700">' + esc(sec.title) + '</span>');
          sec.items.forEach(([cmd, desc]) => {
            outPre('  <span style="color:#7ee787">' + esc(cmd.padEnd(29)) + '</span><span style="color:#a8bfb0">' + esc(desc) + '</span>');
          });
        });
        outPre('');
        outPre('<span style="color:#fc6;font-weight:700">TIPS</span>');
        outPre('  <span style="color:#c9f5d4">Pipes &amp; chaining:</span>  <span style="color:#8fa89a">cat message.b64 | base64 -d   ·   cd Documents &amp;&amp; ls -a</span>');
        outPre('  <span style="color:#c9f5d4">Shortcuts:</span>         <span style="color:#8fa89a">Tab autocomplete   ·   Up/Down history   ·   Ctrl+L clear</span>');
        outPre('  <span style="color:#c9f5d4">More details:</span>      <span style="color:#8fa89a">help &lt;command&gt;   or   &lt;command&gt; --help</span>');
      } else {
        const lines = ['Moundshroud Shell — Command Reference', '-'.repeat(60)];
        HELP_SECTIONS.forEach(sec => {
          lines.push('', sec.title);
          sec.items.forEach(([cmd, desc]) => lines.push('  ' + cmd.padEnd(29) + desc));
        });
        emit(lines.join('\n'));
      }
      return { ok: true };
    };
    const runLs = (a, emit) => {
      let flags = '', targets = [];
      for (const x of a) {
        if (x.startsWith('-') && x.length > 1) flags += x.slice(1);
        else targets.push(x);
      }
      const showAll = flags.includes('a') || flags.includes('A');
      const longFmt = flags.includes('l');
      const onePer = flags.includes('1');
      if (!targets.length) targets = ['.'];
      else targets = expandFiles(targets);
      let ok = true;
      const fmtLong = (name, n) => mode(n) + '  you  ' + String(isDir(n) ? 4096 : rd(n).length).padStart(6) + '  ' + name + (isDir(n) ? '/' : '');
      targets.forEach((t, idx) => {
        const p = resolve(t), n = walk(p);
        if (n === undefined) { emit('ls: cannot access \'' + t + '\': No such file or directory', '#f77', true); ok = false; return; }
        if (targets.length > 1) { if (idx > 0) emit(''); emit(t + ':', '#6cf'); }
        if (!isDir(n)) {
          emit(longFmt ? fmtLong(t, n) : t);
          return;
        }
        const names = Object.keys(n).filter(k => showAll || k[0] !== '.').sort();
        if (longFmt) {
          if (!names.length) emit('total 0');
          else names.forEach(k => emit(fmtLong(k, n[k])));
        } else if (onePer) {
          if (names.length) emit(names.map(k => k + (isDir(n[k]) ? '/' : '')).join('\n'));
        } else {
          emit(names.map(k => k + (isDir(n[k]) ? '/' : '')).join('   ') || '(empty)');
        }
      });
      return { ok };
    };
    const parseCountArgs = (a, defN) => {
      let n = defN, files = [];
      for (let i = 0; i < a.length; i++) {
        const x = a[i];
        if (x === '-n' && a[i + 1] != null) { const v = parseInt(a[++i], 10); if (!isNaN(v) && v >= 0) n = v; else return { err: 'invalid line count: ' + a[i] }; }
        else if (/^-n\d+$/.test(x)) n = parseInt(x.slice(2), 10);
        else if (/^-\d+$/.test(x)) n = parseInt(x.slice(1), 10);
        else if (x.startsWith('-') && x.length > 1) return { err: 'invalid option -- ' + x };
        else files.push(x);
      }
      return { n, files: expandFiles(files) };
    };
    const setFileLock = (parts, locked) => {
      const parent = walk(parts.slice(0, -1)), name = parts[parts.length - 1];
      if (!isDir(parent) || !(name in parent)) return false;
      const cur = parent[name];
      if (isDir(cur)) return false;
      if (typeof cur === 'string') parent[name] = F(cur, locked);
      else cur.locked = locked;
      return true;
    };
    const parseChmod = m => {
      if (/^[0-7]{3,4}$/.test(m)) {
        const owner = parseInt(m[m.length - 3], 8);
        return { unlock: !!(owner & 4) };
      }
      if (/^[ugoa]*\+([rwxXst]*r[rwxXst]*)$/.test(m) || /^[ugoa]*=([rwxXst]*r[rwxXst]*)$/.test(m)) return { unlock: true };
      if (/^[ugoa]*-([rwxXst]*r[rwxXst]*)$/.test(m) || /^[ugoa]*=[wx]*$/.test(m)) return { unlock: false };
      return null;
    };
    const cmds = {
      help: (a, _, emit) => showHelp(a[0], emit),
      man: (a, _, emit) => a[0] ? showHelp(a[0], emit) : (emit('What manual page do you want? Try: man grep  (or type "help")', '#fc6'), { ok: true }),
      pwd: (_, __, emit) => { emit(path()); return { ok: true }; },
      ls: (a, _, emit) => runLs(a, emit),
      ll: (a, _, emit) => runLs(['-la'].concat(a), emit),
      la: (a, _, emit) => runLs(['-a'].concat(a), emit),
      dir: (a, _, emit) => runLs(a, emit),
      cd: (a, _, emit) => {
        const target = a[0];
        let p;
        if (target === '-') {
          if (!prevCwd) { emit('cd: OLDPWD not set', '#f77', true); return { ok: false }; }
          p = prevCwd.slice();
        } else {
          p = resolve(target || '~');
        }
        const n = walk(p);
        if (n === undefined) { emit('cd: ' + (target || '~') + ': No such file or directory', '#f77', true); return { ok: false }; }
        if (!isDir(n)) { emit('cd: ' + target + ': Not a directory', '#f77', true); return { ok: false }; }
        prevCwd = cwd.slice();
        cwd = p;
        updatePrompt();
        if (target === '-') emit(path());
        return { ok: true };
      },
      tree: (a, _, emit) => {
        const showAll = a.some(x => x.startsWith('-') && x.includes('a'));
        const t = a.find(x => !x.startsWith('-')) || '.';
        const p = resolve(t), n = walk(p);
        if (n === undefined) { emit('tree: ' + t + ': No such file or directory', '#f77', true); return { ok: false }; }
        if (!isDir(n)) { emit(t); return { ok: true }; }
        const lines = [t];
        let dirs = 0, files = 0;
        const walkTree = (dirNode, prefix) => {
          const keys = Object.keys(dirNode).filter(k => showAll || k[0] !== '.').sort();
          keys.forEach((k, i) => {
            const last = i === keys.length - 1, child = dirNode[k], d = isDir(child);
            if (d) dirs++; else files++;
            lines.push(prefix + (last ? '└── ' : '├── ') + k + (d ? '/' : isLocked(child) ? ' [locked]' : ''));
            if (d) walkTree(child, prefix + (last ? '    ' : '│   '));
          });
        };
        walkTree(n, '');
        lines.push('', dirs + ' ' + (dirs === 1 ? 'directory' : 'directories') + ', ' + files + ' ' + (files === 1 ? 'file' : 'files'));
        emit(lines.join('\n'));
        return { ok: true };
      },
      cat: (a, stdin, emit) => {
        let numbered = false, rawFiles = [];
        for (const x of a) {
          if (x === '-n') numbered = true;
          else if (x.startsWith('-') && x.length > 1) { emit('cat: invalid option -- ' + x, '#f77', true); return { ok: false }; }
          else rawFiles.push(x);
        }
        const fmt = txt => numbered ? txt.split('\n').map((l, i) => String(i + 1).padStart(4) + '  ' + l).join('\n') : txt;
        if (!rawFiles.length) {
          if (stdin !== null) { emit(fmt(stdin)); return { ok: true }; }
          emit('cat: missing file operand. Try: cat <file>', '#f77', true);
          return { ok: false };
        }
        const files = expandFiles(rawFiles);
        let ok = true;
        for (const f of files) {
          const n = walk(resolve(f));
          if (n === undefined) { emit('cat: ' + f + ': No such file or directory', '#f77', true); ok = false; continue; }
          if (isDir(n)) { emit('cat: ' + f + ': Is a directory', '#f77', true); ok = false; continue; }
          if (isLocked(n)) { emit('cat: ' + f + ': Permission denied', '#f77', true); ok = false; continue; }
          emit(fmt(rd(n)));
        }
        return { ok };
      },
      head: (a, stdin, emit) => {
        const parsed = parseCountArgs(a, 10);
        if (parsed.err) { emit('head: ' + parsed.err, '#f77', true); return { ok: false }; }
        if (!parsed.files.length) {
          if (stdin !== null) { emit(stdin.split('\n').slice(0, parsed.n).join('\n')); return { ok: true }; }
          emit('usage: head [-n N] <file>', '#f77', true);
          return { ok: false };
        }
        let ok = true;
        parsed.files.forEach((f, idx) => {
          const n = walk(resolve(f));
          if (n === undefined) { emit('head: cannot open \'' + f + '\': No such file or directory', '#f77', true); ok = false; return; }
          if (isDir(n)) { emit('head: error reading \'' + f + '\': Is a directory', '#f77', true); ok = false; return; }
          if (isLocked(n)) { emit('head: cannot open \'' + f + '\': Permission denied', '#f77', true); ok = false; return; }
          if (parsed.files.length > 1) emit((idx > 0 ? '\n' : '') + '==> ' + f + ' <==', '#6cf');
          emit(rd(n).split('\n').slice(0, parsed.n).join('\n'));
        });
        return { ok };
      },
      tail: (a, stdin, emit) => {
        const parsed = parseCountArgs(a, 10);
        if (parsed.err) { emit('tail: ' + parsed.err, '#f77', true); return { ok: false }; }
        if (!parsed.files.length) {
          if (stdin !== null) { const ls0 = stdin.split('\n'); emit(parsed.n ? ls0.slice(-parsed.n).join('\n') : ''); return { ok: true }; }
          emit('usage: tail [-n N] <file>', '#f77', true);
          return { ok: false };
        }
        let ok = true;
        parsed.files.forEach((f, idx) => {
          const n = walk(resolve(f));
          if (n === undefined) { emit('tail: cannot open \'' + f + '\': No such file or directory', '#f77', true); ok = false; return; }
          if (isDir(n)) { emit('tail: error reading \'' + f + '\': Is a directory', '#f77', true); ok = false; return; }
          if (isLocked(n)) { emit('tail: cannot open \'' + f + '\': Permission denied', '#f77', true); ok = false; return; }
          if (parsed.files.length > 1) emit((idx > 0 ? '\n' : '') + '==> ' + f + ' <==', '#6cf');
          const ls0 = rd(n).split('\n');
          emit(parsed.n ? ls0.slice(-parsed.n).join('\n') : '');
        });
        return { ok };
      },
      grep: (a, stdin, emit) => {
        let flags = '', pos = [], stopOpts = false;
        for (const x of a) {
          if (!stopOpts && x === '--') { stopOpts = true; continue; }
          if (!stopOpts && /^-[inrvRclFE]+$/.test(x)) flags += x.slice(1);
          else pos.push(x);
        }
        const ic = flags.includes('i'), numL = flags.includes('n'), rec = flags.includes('r') || flags.includes('R'), inv = flags.includes('v'), cnt = flags.includes('c'), filesOnly = flags.includes('l');
        const pat = pos[0], rawTargets = pos.slice(1);
        if (!pat) { emit('usage: grep [-i] [-n] [-r] [-v] [-c] <pattern> [file...]', '#f77', true); return { ok: false }; }
        const matchLine = l => {
          const m = ic ? l.toLowerCase().includes(pat.toLowerCase()) : l.includes(pat);
          return inv ? !m : m;
        };
        if (!rawTargets.length) {
          if (stdin !== null) {
            const lines = stdin.split('\n'), hits = [];
            lines.forEach((l, i) => { if (matchLine(l)) hits.push(numL ? (i + 1) + ':' + l : l); });
            if (cnt) emit(String(hits.length));
            else if (hits.length) emit(hits.join('\n'));
            else emit('(no matches)', '#789');
            return { ok: hits.length > 0 };
          }
          if (rec) rawTargets.push('.');
          else { emit('usage: grep [-i] [-n] [-r] <pattern> <file>', '#f77', true); return { ok: false }; }
        }
        const targets = expandFiles(rawTargets);
        const fileList = [];
        let ok = true;
        const collect = (label, node) => {
          if (isDir(node)) {
            if (!rec) { emit('grep: ' + label + ': Is a directory (use -r to search recursively)', '#f77', true); ok = false; return; }
            for (const k of Object.keys(node).sort()) collect((label === '/' ? '' : label) + '/' + k, node[k]);
          } else {
            fileList.push({ label, node });
          }
        };
        for (const t of targets) {
          const n = walk(resolve(t));
          if (n === undefined) { emit('grep: ' + t + ': No such file or directory', '#f77', true); ok = false; continue; }
          collect(t, n);
        }
        const multi = fileList.length > 1 || rec;
        let totalHits = 0;
        for (const item of fileList) {
          if (isLocked(item.node)) { emit('grep: ' + item.label + ': Permission denied', '#f77', true); ok = false; continue; }
          const lines = rd(item.node).split('\n'), hits = [];
          lines.forEach((l, i) => {
            if (matchLine(l)) {
              const pfx = (multi ? item.label + ':' : '') + (numL ? (i + 1) + ':' : '');
              hits.push(pfx + l);
            }
          });
          totalHits += hits.length;
          if (filesOnly) { if (hits.length) emit(item.label); }
          else if (cnt) emit((multi ? item.label + ':' : '') + hits.length);
          else if (hits.length) emit(hits.join('\n'));
        }
        if (!totalHits && !cnt && !filesOnly && ok) emit('(no matches)', '#789');
        return { ok: ok && (totalHits > 0 || cnt) };
      },
      find: (a, _, emit) => {
        let dirArg = '.', namePat = null, ic = false, type = null;
        let i = 0;
        if (a[0] && !a[0].startsWith('-')) dirArg = a[i++];
        while (i < a.length) {
          const tok = a[i++];
          if (tok === '-name' || tok === '-iname') {
            if (!a[i]) { emit('find: missing argument to ' + tok, '#f77', true); return { ok: false }; }
            namePat = a[i++].replace(/^["']|["']$/g, '');
            ic = tok === '-iname';
          } else if (tok === '-type') {
            const tv = a[i++];
            if (tv !== 'f' && tv !== 'd') { emit('find: -type expects f (file) or d (directory)', '#f77', true); return { ok: false }; }
            type = tv;
          } else {
            emit('find: unknown option \'' + tok + '\'. Try: find <dir> -name <pattern>', '#f77', true);
            return { ok: false };
          }
        }
        const dir = resolve(dirArg), n = walk(dir);
        if (n === undefined) { emit('find: \'' + dirArg + '\': No such file or directory', '#f77', true); return { ok: false }; }
        if (!isDir(n)) { emit(dirArg); return { ok: true }; }
        const base = '/' + dir.join('/');
        const res = findWalk(n, base === '/' ? '' : base, namePat ? globRe(namePat, ic) : null, type, []);
        emit(res.length ? res.join('\n') : '(nothing found)');
        return { ok: true };
      },
      base64: (a, stdin, emit) => {
        let decode = false, rest = [];
        for (const x of a) {
          if (x === '-d' || x === '-D' || x === '--decode') decode = true;
          else if (x.startsWith('-') && x.length > 1) { emit('base64: invalid option -- ' + x + '. Try: base64 -d <file or text>', '#f77', true); return { ok: false }; }
          else rest.push(x);
        }
        let src = null;
        if (!rest.length) {
          if (stdin !== null) src = stdin;
          else { emit('usage: base64 [-d] <file or text>  (or pipe input)', '#f77', true); return { ok: false }; }
        } else {
          const cand = expandFiles([rest[0]])[0], n = walk(resolve(cand));
          if (n !== undefined) {
            if (isDir(n)) { emit('base64: ' + cand + ': Is a directory', '#f77', true); return { ok: false }; }
            if (isLocked(n)) { emit('base64: ' + cand + ': Permission denied', '#f77', true); return { ok: false }; }
            src = rd(n);
          } else {
            src = rest.join(' ');
          }
        }
        if (decode) {
          try { emit(atob(src.replace(/\s+/g, ''))); return { ok: true }; }
          catch (e) { emit('base64: invalid Base64 input', '#f77', true); return { ok: false }; }
        }
        try { emit(btoa(src)); return { ok: true }; }
        catch (e) { emit('base64: could not encode input', '#f77', true); return { ok: false }; }
      },
      chmod: (a, _, emit) => {
        if (a.length < 2) { emit('usage: chmod <mode> <file...>  (e.g. chmod +r vault.txt or chmod 644 vault.txt)', '#f77', true); return { ok: false }; }
        const parsed = parseChmod(a[0]);
        if (!parsed) { emit('chmod: invalid mode \'' + a[0] + '\'. Try +r, u+r, 644, or -r.', '#f77', true); return { ok: false }; }
        const files = expandFiles(a.slice(1));
        let ok = true;
        for (const f of files) {
          const p = resolve(f), n = walk(p);
          if (n === undefined) { emit('chmod: cannot access \'' + f + '\': No such file or directory', '#f77', true); ok = false; continue; }
          if (isDir(n)) { emit('chmod: ' + f + ': skipping directory', '#fc6'); continue; }
          setFileLock(p, !parsed.unlock);
          emit('mode of \'' + f + '\' changed to ' + (parsed.unlock ? 'rw-r--r-- (readable)' : '--------- (locked)'));
        }
        return { ok };
      },
      wc: (a, stdin, emit) => {
        let flags = '', rawFiles = [];
        for (const x of a) {
          if (x.startsWith('-') && x.length > 1) flags += x.slice(1);
          else rawFiles.push(x);
        }
        const onlyL = flags.includes('l'), onlyW = flags.includes('w'), onlyC = flags.includes('c'), any = onlyL || onlyW || onlyC;
        const stats = txt => {
          const lines = txt ? txt.split('\n').length : 0;
          const words = txt.trim() ? txt.trim().split(/\s+/).length : 0;
          const bytes = txt.length;
          const cols = [];
          if (!any || onlyL) cols.push(String(lines).padStart(6));
          if (!any || onlyW) cols.push(String(words).padStart(6));
          if (!any || onlyC) cols.push(String(bytes).padStart(6));
          return cols.join(' ');
        };
        if (!rawFiles.length) {
          if (stdin !== null) { emit(stats(stdin)); return { ok: true }; }
          emit('usage: wc [-l] [-w] [-c] <file>', '#f77', true);
          return { ok: false };
        }
        let ok = true;
        for (const f of expandFiles(rawFiles)) {
          const n = walk(resolve(f));
          if (n === undefined) { emit('wc: ' + f + ': No such file or directory', '#f77', true); ok = false; continue; }
          if (isDir(n)) { emit('wc: ' + f + ': Is a directory', '#f77', true); ok = false; continue; }
          if (isLocked(n)) { emit('wc: ' + f + ': Permission denied', '#f77', true); ok = false; continue; }
          emit(stats(rd(n)) + '  ' + f);
        }
        return { ok };
      },
      strings: (a, stdin, emit) => {
        const extract = s => (s.match(/[\x20-\x7e]{4,}/g) || []).join('\n') || '(no printable strings)';
        if (!a.length) {
          if (stdin !== null) { emit(extract(stdin)); return { ok: true }; }
          emit('usage: strings <file>', '#f77', true);
          return { ok: false };
        }
        let ok = true;
        for (const f of expandFiles(a)) {
          const n = walk(resolve(f));
          if (n === undefined) { emit('strings: ' + f + ': No such file or directory', '#f77', true); ok = false; continue; }
          if (isDir(n)) { emit('strings: ' + f + ': Is a directory', '#f77', true); ok = false; continue; }
          if (isLocked(n)) { emit('strings: ' + f + ': Permission denied', '#f77', true); ok = false; continue; }
          emit(extract(rd(n)));
        }
        return { ok };
      },
      stat: (a, _, emit) => {
        if (!a.length) { emit('usage: stat <path>', '#f77', true); return { ok: false }; }
        let ok = true;
        for (const f of expandFiles(a)) {
          const p = resolve(f), n = walk(p);
          if (n === undefined) { emit('stat: cannot stat \'' + f + '\': No such file or directory', '#f77', true); ok = false; continue; }
          const dir = isDir(n), sz = dir ? 4096 : rd(n).length;
          emit('  File: ' + path(p) + '\n  Type: ' + (dir ? 'directory' : isLocked(n) ? 'regular file (locked)' : 'regular file') + '\n  Size: ' + sz + ' bytes\nAccess: ' + mode(n) + '  owner=you');
        }
        return { ok };
      },
      file: (a, _, emit) => {
        if (!a.length) { emit('usage: file <path>', '#f77', true); return { ok: false }; }
        let ok = true;
        for (const f of expandFiles(a)) {
          const n = walk(resolve(f));
          if (n === undefined) { emit(f + ': cannot open (No such file or directory)', '#f77', true); ok = false; continue; }
          if (isDir(n)) emit(f + ': directory');
          else if (isLocked(n)) emit(f + ': regular file (permission denied — unreadable)');
          else {
            const c = rd(n).trim();
            const kind = !c ? 'empty' : f.endsWith('.jpg') ? 'simulated image data' : /^[A-Za-z0-9+/]+={0,2}$/.test(c) && c.length >= 12 && c.length % 4 === 0 ? 'ASCII text (looks like Base64)' : 'ASCII text';
            emit(f + ': ' + kind);
          }
        }
        return { ok };
      },
      echo: (a, _, emit) => { emit((a[0] === '-n' ? a.slice(1) : a).join(' ')); return { ok: true }; },
      whoami: (_, __, emit) => { emit('you'); return { ok: true }; },
      hostname: (_, __, emit) => { emit('moundshroud'); return { ok: true }; },
      id: (_, __, emit) => { emit('uid=1000(you) gid=1000(you) groups=1000(you),lab'); return { ok: true }; },
      uname: (a, _, emit) => { emit(a.includes('-a') ? 'Linux moundshroud 6.8.0-sandbox #1 SMP x86_64 GNU/Linux' : 'Linux'); return { ok: true }; },
      history: (_, __, emit) => { emit(hist.map((h, i) => String(i + 1).padStart(4) + '  ' + h).join('\n') || '(empty)'); return { ok: true }; },
      clear: () => { $('to').innerHTML = ''; return { ok: true }; },
      cls: () => { $('to').innerHTML = ''; return { ok: true }; },
      hint: (_, __, emit) => { emit('Hint: ' + MIS[mi].hint, '#fc6'); return { ok: true }; },
      reset: (_, __, emit) => { $('to').innerHTML = ''; load(); emit('Mission ' + (mi + 1) + ' reset.', '#fc6'); return { ok: true }; },
      restart: (_, __, emit) => { $('to').innerHTML = ''; load(); emit('Mission ' + (mi + 1) + ' reset.', '#fc6'); return { ok: true }; },
      missions: (_, __, emit) => {
        const lines = MIS.map((m, i) => {
          const tag = i === mi ? '[current]' : i < doneCount ? '[done]   ' : '[ ]      ';
          return '  ' + (i + 1) + '. ' + tag + ' ' + m.name;
        });
        emit('Missions:\n' + lines.join('\n') + '\nUse "mission <1-' + MIS.length + '>" to switch.', '#c9f5d4');
        return { ok: true };
      },
      mission: (a, _, emit) => {
        const n = parseInt(a[0], 10);
        if (isNaN(n) || n < 1 || n > MIS.length) { emit('usage: mission <1-' + MIS.length + '>', '#f77', true); return { ok: false }; }
        mi = n - 1;
        $('to').innerHTML = '';
        load();
        emit('Switched to Mission ' + n + ': ' + MIS[mi].name, '#6cf');
        return { ok: true };
      },
      skip: (_, __, emit) => {
        if (mi + 1 >= MIS.length) { emit('You are already on the final mission. Use "mission 1" to replay earlier missions.', '#fc6'); return { ok: true }; }
        emit('Skipping to Mission ' + (mi + 2) + '...', '#fc6');
        mi++;
        setTimeout(() => { $('to').innerHTML = ''; load(); }, 300);
        return { ok: true };
      },
      submit: (a, _, emit) => {
        const f = a.join(' ').trim();
        if (!f) { emit('usage: submit FLAG{...}', '#f77', true); return { ok: false }; }
        if (f === MIS[mi].flag) {
          emit('Correct! Mission complete.', '#6f6');
          doneCount = Math.max(doneCount, mi + 1);
          ls.set('cyterm', String(Math.min(doneCount, MIS.length)));
          api.submit(doneCount);
          if (mi + 1 >= MIS.length) {
            emit('You finished every mission. Terminal wizard! (Type "missions" to replay any mission.)', '#6f6');
            api.hud('All missions done');
            return { ok: true };
          }
          mi++;
          setTimeout(() => { $('to').innerHTML = ''; load(); }, 900);
          return { ok: true };
        }
        emit('That is not the flag for this mission.', '#f77', true);
        return { ok: false };
      },
    };
    const tokenize = str => {
      const toks = []; let cur = '', q = '', hasTok = false;
      for (let i = 0; i < str.length; i++) {
        const ch = str[i];
        if (q) { if (ch === q) q = ''; else cur += ch; continue; }
        if (ch === '"' || ch === "'") { q = ch; hasTok = true; continue; }
        if (/\s/.test(ch)) { if (hasTok) { toks.push(cur); cur = ''; hasTok = false; } continue; }
        cur += ch; hasTok = true;
      }
      if (hasTok) toks.push(cur);
      return toks;
    };
    const splitUnquoted = (str, ops) => {
      const segs = []; let cur = '', q = '';
      for (let i = 0; i < str.length; i++) {
        const ch = str[i];
        if (q) { cur += ch; if (ch === q) q = ''; continue; }
        if (ch === '"' || ch === "'") { q = ch; cur += ch; continue; }
        const op = ops.find(o => str.startsWith(o, i));
        if (op) { segs.push({ text: cur.trim(), op }); cur = ''; i += op.length - 1; continue; }
        cur += ch;
      }
      segs.push({ text: cur.trim(), op: null });
      return segs;
    };
    const runPipeline = segText => {
      const stages = splitUnquoted(segText, ['|']).map(s => s.text).filter(Boolean);
      if (!stages.length) return true;
      let piped = null, lastOk = true;
      for (let idx = 0; idx < stages.length; idx++) {
        const parts = tokenize(stages[idx]);
        if (!parts.length) continue;
        const c = parts.shift(), isLast = idx === stages.length - 1;
        const buf = [];
        const emit = (t, col, isErr) => {
          if (isLast || isErr) out(t, col);
          else buf.push(t);
        };
        emit.raw = isLast;
        if (parts.includes('--help') || (parts.includes('-h') && c !== 'ls' && c !== 'du' && c !== 'df')) {
          const r = showHelp(c, emit);
          lastOk = !!(r && r.ok);
          piped = isLast ? null : buf.join('\n');
          continue;
        }
        const fn = cmds[c];
        if (!fn) {
          out(c + ': command not found. Type "help" for available commands.', '#f77');
          return false;
        }
        const res = fn(parts, piped, emit);
        lastOk = !res || res.ok !== false;
        piped = isLast ? null : buf.join('\n');
      }
      return lastOk;
    };
    const runLine = line => {
      const chain = splitUnquoted(line, ['&&', ';']);
      let prevOk = true, prevOp = null;
      for (const step of chain) {
        if (prevOp === '&&' && !prevOk) break;
        if (step.text) prevOk = runPipeline(step.text);
        prevOp = step.op;
      }
    };
    const autocomplete = () => {
      const val = $('ti').value;
      const m = val.match(/(^|[\s|;&])([^\s|;&]*)$/);
      const prefix = m ? m[2] : '', before = m ? val.slice(0, val.length - prefix.length) : val;
      const isCmdPos = /^\s*$/.test(before) || /[|;&]\s*$/.test(before);
      let cands = [];
      if (isCmdPos) {
        cands = Object.keys(cmds).filter(k => k.startsWith(prefix)).sort();
      } else {
        const slash = prefix.lastIndexOf('/'), dirStr = slash >= 0 ? prefix.slice(0, slash) || '/' : '', base = slash >= 0 ? prefix.slice(slash + 1) : prefix;
        const dirNode = walk(resolve(dirStr || '.'));
        if (isDir(dirNode)) {
          const wantDot = base.startsWith('.');
          cands = Object.keys(dirNode)
            .filter(k => (wantDot || k[0] !== '.') && k.startsWith(base))
            .sort()
            .map(k => (dirStr ? (dirStr === '/' ? '/' : dirStr + '/') : '') + k + (isDir(dirNode[k]) ? '/' : ''));
        }
      }
      if (cands.length === 1) {
        $('ti').value = before + cands[0] + (isCmdPos || !cands[0].endsWith('/') ? ' ' : '');
      } else if (cands.length > 1) {
        let common = cands[0];
        for (const c of cands.slice(1)) { while (!c.startsWith(common)) common = common.slice(0, -1); }
        if (common.length > prefix.length) $('ti').value = before + common;
        else out(cands.join('   '), '#789');
      }
    };
    $('ti').onkeydown = e => {
      if (e.key === 'Tab') { e.preventDefault(); autocomplete(); return; }
      if (e.ctrlKey && (e.key === 'l' || e.key === 'L')) { e.preventDefault(); $('to').innerHTML = ''; return; }
      if (e.ctrlKey && (e.key === 'c' || e.key === 'C')) { e.preventDefault(); out($('tp').textContent + $('ti').value + '^C', '#6cf'); $('ti').value = ''; return; }
      if (e.key === 'ArrowUp') { if (hist.length) { hp = Math.max(0, hp - 1); $('ti').value = hist[hp] || ''; } e.preventDefault(); return; }
      if (e.key === 'ArrowDown') { hp = Math.min(hist.length, hp + 1); $('ti').value = hist[hp] || ''; e.preventDefault(); return; }
      if (e.key !== 'Enter') return;
      const line = $('ti').value.trim(); $('ti').value = '';
      if (!line) return;
      hist.push(line); hp = hist.length;
      out($('tp').textContent + line, '#6cf');
      runLine(line);
    };
    el.onclick = e => { if (!window.getSelection().toString()) $('ti').focus(); };
    load(); out('Moundshroud lab terminal. Sandbox only — no real files are touched.\nType "help" to see commands, or "help <command>" for examples.\n', '#8fa89a'); setTimeout(() => $('ti').focus(), 50); return () => { };
  });

  /* ================= SQL INJECTION DOJO ================= */
  const USERS = [{ id: 1, name: 'admin', pass: 'S3cr3t!x9' }, { id: 2, name: 'maria', pass: 'blue42' }, { id: 3, name: 'dev', pass: 'hunter2' }];
  const sqlTok = s => { const t = []; let i = 0; while (i < s.length) { const c = s[i]; if (/\s/.test(c)) { i++; continue; } if (c === "'") { let j = i + 1, v = ''; for (; ;) { if (j >= s.length) throw new Error('unterminated string'); if (s[j] === "'") { if (s[j + 1] === "'") { v += "'"; j += 2; continue; } break; } v += s[j++]; } t.push({ t: 's', v }); i = j + 1; continue; } if (s.startsWith('--', i) || c === '#') break; if (s.startsWith('/*', i)) { const e = s.indexOf('*/', i + 2); if (e < 0) break; i = e + 2; continue; } if (/\d/.test(c)) { let j = i; while (/[\d.]/.test(s[j] || '')) j++; t.push({ t: 'n', v: s.slice(i, j) }); i = j; continue; } if (/[A-Za-z_]/.test(c)) { let j = i; while (/\w/.test(s[j] || '')) j++; t.push({ t: 'w', v: s.slice(i, j) }); i = j; continue; } if (s.startsWith('!=', i) || s.startsWith('<>', i)) { t.push({ t: 'o', v: '!=' }); i += 2; continue; } if ('=();'.includes(c)) { t.push({ t: 'o', v: c }); i++; continue; } throw new Error('unexpected character ' + c); } return t; };
  const sqlRun = (cond, rows) => {
    const t = sqlTok(cond); let p = 0; const pk = () => t[p], nx = () => t[p++], isW = (x, w) => x && x.t === 'w' && x.v.toUpperCase() === w;
    const val = (r) => { const x = nx(); if (!x) throw new Error('unexpected end'); if (x.t === 's') return x.v; if (x.t === 'n') return x.v; if (x.t === 'w') { if (!(x.v in r)) throw new Error('unknown column ' + x.v); return String(r[x.v]); } throw new Error('unexpected ' + x.v); };
    const cmp = r => { if (pk() && pk().v === '(' && pk().t === 'o') { nx(); const v = or(r); const c = nx(); if (!c || c.v !== ')') throw new Error('missing )'); return v; } if (isW(pk(), 'NOT')) { nx(); return !cmp(r); } const a = val(r), o = nx(); if (!o || o.t !== 'o' || (o.v !== '=' && o.v !== '!=')) throw new Error('expected = or !='); const b = val(r); return o.v === '=' ? a === b : a !== b; };
    const and = r => { let v = cmp(r); while (isW(pk(), 'AND')) { nx(); const w = cmp(r); v = v && w; } return v; };
    const or = r => { let v = and(r); while (isW(pk(), 'OR')) { nx(); const w = and(r); v = v || w; } return v; };
    // parse once per row (the token position is reset) so syntax errors surface even with no rows
    const res = rows.filter(r => { p = 0; const v = or(r); while (pk() && pk().v === ';') nx(); if (p < t.length) throw new Error('unexpected ' + t[p].v); return v; });
    return res;
  };
  L.sql = { sqlRun, USERS };
  const SQLV = [
    { t: 'Level 1: Skip the password', goal: 'Log in as admin without knowing the password.', hint: 'The app pastes your text inside quotes. What if your username ends a quote and then turns the rest of the query into a comment? Comments start with --', san: false, win: (u, p, rows) => rows.some(r => r.name === 'admin') && p !== USERS[0].pass },
    { t: 'Level 2: Skip everything', goal: 'Log in without knowing ANY username or password.', hint: 'Make the WHERE condition always true. Try any username (like x) and put  \' OR \'1\'=\'1  in the password box.', san: false, win: (u, p, rows) => rows.length > 0 && !USERS.some(r => r.name === u && r.pass === p) },
    { t: 'Level 3: The weak filter', goal: 'Now the site deletes -- # and /* from what you type. Log in as admin anyway.', hint: 'You do not need a comment if your own text finishes the quotes for you. Try a username like  admin\' OR \'a\'=\'a', san: true, win: (u, p, rows) => rows.some(r => r.name === 'admin') && p !== USERS[0].pass },
  ];
  reg('sqldojo', 'SQL Injection Dojo', '💉', 'A safe, fake login form. Learn how SQL injection works, then see how parameterized queries stop it.', (el, api) => {
    let lv = Math.min(2, num('cysql', 0)), done = num('cysql', 0);
    el.innerHTML = '<div style="width:min(680px,100%)"><div class="row" style="gap:6px;margin-bottom:8px" id="sl"></div><div id="sg" style="' + box + ';margin-bottom:8px"></div><div style="' + box + '"><div class="small mute" style="margin-bottom:6px">Fake company login (nothing here is real)</div><div class="row" style="gap:8px;margin-bottom:6px"><input type="text" id="su" placeholder="username" autocomplete="off" spellcheck="false" style="flex:1"><input type="text" id="sp" placeholder="password" autocomplete="off" spellcheck="false" style="flex:1"></div><div class="row" style="gap:8px">' + btn('sr', 'Log in', 'pri') + '<label class="chk"><input type="checkbox" id="ss"> Secure mode (parameterized query)</label><span class="sp"></span>' + btn('sh', 'Hint') + '</div></div><div class="small mute" style="margin:10px 0 4px">The query the server builds:</div><pre id="sq" style="' + mono + ';font-size:12.5px;white-space:pre-wrap;word-break:break-all;' + box + ';margin:0"></pre><div id="so" style="margin-top:10px"></div></div>';
    const lvbar = () => { $('sl').innerHTML = SQLV.map((v, i) => '<button class="ib' + (i === lv ? ' on' : '') + '" data-l="' + i + '"' + (i > done ? ' disabled style="opacity:.45"' : '') + '>' + (i < done ? '✓ ' : '') + 'Level ' + (i + 1) + '</button>').join(''); const v = SQLV[lv]; $('sg').innerHTML = '<b>' + esc(v.t) + '</b><div class="small">' + esc(v.goal) + '</div>'; api.hud('Levels cleared ' + done + '/3'); };
    $('sl').onclick = e => { const b = e.target.closest('[data-l]'); if (b && !b.disabled) { lv = +b.dataset.l; $('sq').textContent = ''; $('so').textContent = ''; lvbar(); } };
    $('sh').onclick = () => { $('so').innerHTML = '<div class="small" style="color:var(--warn)">Hint: ' + esc(SQLV[lv].hint) + '</div>'; };
    $('sr').onclick = () => {
      const v = SQLV[lv]; let u = $('su').value, p = $('sp').value; if (v.san) { u = u.replace(/--|#|\/\*/g, ''); p = p.replace(/--|#|\/\*/g, ''); }
      const secure = $('ss').checked; let rows = [], err = '';
      if (secure) { $('sq').innerHTML = esc('SELECT * FROM users WHERE name = ? AND pass = ?') + '\n<span class="mute">?1 = </span>' + esc(JSON.stringify(u)) + '\n<span class="mute">?2 = </span>' + esc(JSON.stringify(p)); rows = USERS.filter(r => r.name === u && r.pass === p); }
      else { const pre = "SELECT * FROM users WHERE "; $('sq').innerHTML = esc(pre + "name='") + '<span style="color:var(--bad)">' + esc(u) + '</span>' + esc("' AND pass='") + '<span style="color:var(--bad)">' + esc(p) + '</span>' + esc("'"); try { rows = sqlRun("name='" + u + "' AND pass='" + p + "'", USERS); } catch (e) { err = e.message; } }
      if (err) { $('so').innerHTML = '<div style="color:var(--bad)">Database error: ' + esc(err) + '</div><div class="small mute">A syntax error often means your quotes are unbalanced. Attackers read errors like this to learn how the query is built.</div>'; return; }
      if (!rows.length) { $('so').innerHTML = '<div style="color:var(--bad)">Login failed.</div>'; return; }
      const won = !secure && v.win(u, p, rows);
      $('so').innerHTML = '<div style="color:var(--ok)">Logged in as <b>' + esc(rows[0].name) + '</b>' + (rows.length > 1 ? ' (' + rows.length + ' rows matched)' : '') + '</div>' + (won ? '<div style="' + box + ';margin-top:8px"><b style="color:var(--ok)">You got in without the password!</b><div class="small" style="margin-top:4px">The site trusted your text as part of the SQL. <b>The fix:</b> never build queries by gluing strings together. Use parameterized (prepared) queries so input is always treated as data, never as code. Tick <b>Secure mode</b> and try the same input again.</div></div>' : secure ? '<div class="small mute">Secure mode: the input could only ever match as plain text.</div>' : '');
      if (won && lv === done && done < 3) { done = lv + 1; ls.set('cysql', String(done)); api.submit(done); setTimeout(lvbar, 100); if (lv < 2) { A.toast('Level cleared! The next one is unlocked.'); } else A.toast('Dojo complete. Now you know how to defend against it too.'); }
    };
    lvbar(); return () => { };
  });

  /* ================= PHISH SPOTTER ================= */
  const MAILS = [
    { from: 'Microsoft Support <support@micros0ft-security.com>', subj: 'Your account will be closed in 24 hours', body: 'We detected unusual activity. Verify your password immediately or your account will be permanently deleted.', link: ['Verify now', 'http://micros0ft-security.com/login'], phish: 1, why: ['The sender domain uses a zero instead of the letter o', 'Threatens you with a deadline to rush you', 'Asks you to enter your password through a link'] },
    { from: 'Maria Lopez <maria@yourcompany.com>', subj: 'Notes from this morning', body: 'Hi, here are the notes from our meeting. Let me know if I missed anything.', link: null, phish: 0, why: ['Normal sender, no link, no pressure, nothing asked of you'] },
    { from: 'PayPaI Service <service@paypal-billing.help>', subj: 'Payment of $499.99 sent', body: 'You paid $499.99 to Crypto Exchange. If this was not you, click below to cancel and sign in.', link: ['Cancel payment', 'http://paypal-billing.help/cancel'], phish: 1, why: ['The sender name uses a capital I instead of l', 'The domain is .help, not the real company site', 'Scares you with a charge you did not make'] },
    { from: 'GitHub <noreply@github.com>', subj: 'A new sign-in to your account', body: 'We noticed a sign-in from Windows in your region. If this was you, you can ignore this. If not, open github.com yourself and review your sessions.', link: null, phish: 0, why: ['Tells you to go to the site yourself, not to click', 'No urgency and no request for a password'] },
    { from: 'HR Department <hr@yourcompany-benefits.net>', subj: 'Urgent: updated salary document', body: 'Open the attached file and sign in with your work email to see your new salary.', link: ['SalaryUpdate.html', 'file attachment: SalaryUpdate.html'], phish: 1, why: ['Unexpected attachment ending in .html', 'The domain is not your real company domain', 'Plays on curiosity about money'] },
    { from: 'Amazon <order-update@amazon.com>', subj: 'Your package was delivered', body: 'Your order was delivered to your front door. You can check it any time in Your Orders on the Amazon website or app.', link: null, phish: 0, why: ['Points you to the official site or app, asks for nothing'] },
    { from: 'IT Helpdesk <helpdesk@company-it-support.co>', subj: 'Password expires today', body: 'Your password expires today. Click to keep your current password.', link: ['Keep my password', 'http://company-it-support.co/reset'], phish: 1, why: ['Generic urgency', 'Look-alike domain that is not your company', 'Real IT teams rarely email a login link'] },
    { from: 'Bank of Northfield <alerts@bankofnorthfield.com>', subj: 'New statement available', body: 'Your monthly statement is ready. Sign in the usual way through the app or the website you normally use.', link: null, phish: 0, why: ['No link and no request, just a reminder to use your normal route'] },
    { from: 'Prize Center <winner@lucky-draw-gifts.top>', subj: 'Congratulations! You won a new phone', body: 'You were picked as today\'s lucky visitor. Pay a small $2.99 delivery fee to claim it.', link: ['Claim prize', 'http://lucky-draw-gifts.top/claim?id=88213'], phish: 1, why: ['You cannot win a contest you never entered', 'Asks for a small payment (card theft)', 'Odd .top domain'] },
    { from: 'Dad <dad.family1987@gmail.com>', subj: 'Can you help me?', body: 'I am stuck abroad and my wallet was stolen. Please buy 4 gift cards of $100 and send me the codes. Do not call, my phone is dead.', link: null, phish: 1, why: ['Gift card requests are almost always scams', 'Tells you not to call to verify', 'Emotional emergency to stop you thinking'] },
    { from: 'Zoom <no-reply@zoom.us>', subj: 'Your meeting starts in 15 minutes', body: 'Reminder: Weekly sync at 10:00. Join from your calendar invite.', link: null, phish: 0, why: ['Matches a meeting you know about, nothing sensitive requested'] },
    { from: 'Netflix <billing@netflix-account-update.com>', subj: 'Payment declined: update your card', body: 'We could not process your payment. Update your card details within 12 hours to avoid cancellation.', link: ['Update payment method', 'http://netflix-account-update.com/pay'], phish: 1, why: ['Domain is not netflix.com', 'Deadline pressure', 'Wants card details on a page you reached by a link'] },
    { from: 'Library <hello@citylibrary.org>', subj: 'Book due in 3 days', body: 'A friendly reminder that "Cryptography for Everyone" is due on Friday. Renew in person or on our website.', link: null, phish: 0, why: ['You know you borrowed it, nothing is requested'] },
    { from: 'Security Alert <alert@g00gle-mail.com>', subj: 'Someone has your password', body: 'Download the attached Security Tool to scan your PC for free.', link: ['SecurityTool.exe', 'file attachment: SecurityTool.exe'], phish: 1, why: ['Bad spelling of the domain', 'Never run an .exe from an email', 'Claims to know something scary about you'] },
  ];
  reg('phish', 'Phish Spotter', '🎣', 'Real or fake? Inspect the sender, the link and the pressure tactics in 10 emails.', (el, api) => {
    let q = [], i = 0, ok = 0, streak = 0, ans = false;
    el.innerHTML = '<div style="width:min(640px,100%)"><div id="pc" style="' + box + '"></div><div class="row" style="gap:8px;margin-top:10px" id="pb">' + btn('pp', '🎣 Phishing', 'pri') + btn('pl', '✅ Legit') + '<span class="sp"></span>' + btn('pn', 'New round') + '</div><div id="pr" style="margin-top:10px"></div></div>';
    const show = () => { ans = false; $('pr').innerHTML = ''; const m = q[i]; if (!m) { const sc = ok * 10; api.submit(sc); $('pc').innerHTML = '<h2>Round over</h2><div>You got <b>' + ok + ' of ' + q.length + '</b> right.</div><div class="small mute" style="margin-top:6px">Rule of thumb: check the sender domain, hover links before clicking, and be suspicious of urgency, money and attachments.</div>'; $('pb').style.opacity = .4; return; } $('pb').style.opacity = 1; $('pc').innerHTML = '<div class="small mute">Email ' + (i + 1) + ' of ' + q.length + '</div><div style="margin:6px 0"><b>From:</b> ' + esc(m.from) + '</div><div><b>Subject:</b> ' + esc(m.subj) + '</div><div style="margin:10px 0;line-height:1.6">' + esc(m.body) + '</div>' + (m.link ? '<div class="small">Link or file: <span style="color:var(--acc);text-decoration:underline" title="' + esc(m.link[1]) + '">' + esc(m.link[0]) + '</span> <span class="mute">(hover to see where it really goes)</span></div>' : '<div class="small mute">No links or attachments.</div>'); api.hud('Score ' + ok + '/' + i + '  Streak ' + streak); };
    const guess = g => { if (ans || !q[i]) return; ans = true; const m = q[i], right = (g === 1) === !!m.phish; if (right) { ok++; streak++; } else streak = 0; $('pr').innerHTML = '<div style="color:var(--' + (right ? 'ok' : 'bad') + ')"><b>' + (right ? 'Correct!' : 'Not quite.') + '</b> That was ' + (m.phish ? 'a phishing email' : 'legitimate') + '.</div><ul class="small" style="margin:6px 0 8px 18px">' + m.why.map(w => '<li>' + esc(w) + '</li>').join('') + '</ul>' + btn('pnx', i + 1 < q.length ? 'Next email' : 'See result', 'pri'); $('pnx').onclick = () => { i++; show(); }; api.hud('Score ' + ok + '/' + (i + 1) + '  Streak ' + streak); };
    const start = () => { q = shuffle(MAILS).slice(0, 10); i = 0; ok = 0; streak = 0; show(); };
    $('pp').onclick = () => guess(1); $('pl').onclick = () => guess(0); $('pn').onclick = start; start(); return () => { };
  });

  /* ================= NET NINJA ================= */
  const PORTS = [[22, 'SSH', 'secure remote login'], [80, 'HTTP', 'normal web pages'], [443, 'HTTPS', 'encrypted web pages'], [53, 'DNS', 'turns names into IP addresses'], [25, 'SMTP', 'sending email'], [110, 'POP3', 'downloading email'], [143, 'IMAP', 'reading email on a server'], [21, 'FTP', 'old-style file transfer'], [23, 'Telnet', 'insecure remote login'], [3389, 'RDP', 'Windows remote desktop'], [445, 'SMB', 'Windows file sharing'], [123, 'NTP', 'syncing the clock'], [67, 'DHCP', 'handing out IP addresses'], [3306, 'MySQL', 'a database server'], [5900, 'VNC', 'remote screen sharing']];
  const CONCEPTS = [
    ['What does a firewall do?', ['Filters network traffic by rules', 'Makes your PC faster', 'Removes viruses from files', 'Stores your passwords'], 0],
    ['What does HTTPS add over HTTP?', ['Encryption of the traffic', 'Faster downloads', 'Free hosting', 'More images'], 0],
    ['What is a VPN mainly for?', ['An encrypted tunnel for your traffic', 'Making Wi-Fi stronger', 'Blocking all ads', 'Speeding up games'], 0],
    ['What is phishing?', ['Tricking people into giving up information', 'Overloading a server', 'Guessing passwords in bulk', 'Cracking Wi-Fi'], 0],
    ['What is two-factor authentication?', ['A password plus a second proof such as a code', 'Two passwords', 'Logging in twice', 'A backup password'], 0],
    ['What is a brute-force attack?', ['Trying many passwords until one works', 'Physically breaking a device', 'Sending a fake email', 'Reading network traffic'], 0],
    ['What does NAT do on a home router?', ['Lets many devices share one public IP', 'Encrypts Wi-Fi', 'Blocks all websites', 'Backs up files'], 0],
    ['What is ransomware?', ['Malware that locks your files and demands payment', 'A free antivirus', 'A type of firewall', 'A password manager'], 0],
    ['What is a man-in-the-middle attack?', ['Secretly sitting between two parties and reading or changing their messages', 'Two hackers working together', 'Cloning a hard drive', 'Guessing a PIN'], 0],
    ['Why use a password manager?', ['Unique strong passwords for every site', 'To share passwords with friends', 'To avoid ever logging out', 'To speed up the internet'], 0],
    ['What is a zero-day?', ['A flaw nobody has patched yet', 'A virus that deletes in a day', 'A free trial', 'A day with no attacks'], 0],
    ['Which is the safest way to handle a surprising email attachment?', ['Do not open it; verify with the sender another way', 'Open it in a hurry to check', 'Forward it to everyone', 'Reply asking if it is safe'], 0],
    ['What does DNS do?', ['Turns names like example.com into IP addresses', 'Encrypts email', 'Stores web pages', 'Scans for viruses'], 0],
    ['A hash such as SHA-256 is...', ['A one-way fingerprint of data', 'Reversible encryption', 'A password', 'A compression format'], 0],
    ['What does "patching" mean?', ['Installing updates that fix security holes', 'Joining two networks', 'Deleting old files', 'Resetting a router'], 0],
  ];
  reg('netninja', 'Net Ninja', '🥷', 'Ports, protocols and security concepts. Ten quick questions per round, streaks give bonus points.', (el, api) => {
    let q = [], i = 0, sc = 0, streak = 0, done = false;
    el.innerHTML = '<div style="width:min(600px,100%)"><div id="nq" style="' + box + ';font-size:16px"></div><div id="no" style="display:grid;gap:8px;margin-top:10px"></div><div id="nm" style="margin-top:10px"></div></div>';
    const mk = () => { const a = []; shuffle(PORTS).slice(0, 5).forEach(p => { const wrong = shuffle(PORTS.filter(x => x !== p)).slice(0, 3); const kind = rnd(2); if (kind) a.push({ q: 'Which service normally uses port ' + p[0] + '?', o: shuffle([p[1]].concat(wrong.map(x => x[1]))), a: p[1], e: p[1] + ' (' + p[2] + ') uses port ' + p[0] + '.' }); else a.push({ q: 'Which port is normally used for ' + p[1] + ' (' + p[2] + ')?', o: shuffle([p[0]].concat(wrong.map(x => x[0]))).map(String), a: String(p[0]), e: p[1] + ' uses port ' + p[0] + '.' }); }); shuffle(CONCEPTS).slice(0, 5).forEach(c => a.push({ q: c[0], o: shuffle(c[1].slice()), a: c[1][c[2]], e: 'Answer: ' + c[1][c[2]] + '.' })); return shuffle(a); };
    const show = () => { done = false; $('nm').innerHTML = ''; const x = q[i]; if (!x) { api.submit(sc); $('nq').innerHTML = '<b>Round over!</b> Score ' + sc + ' out of 150+. ' + btn('nn', 'Play again', 'pri'); $('no').innerHTML = ''; $('nn').onclick = start; return; } $('nq').textContent = (i + 1) + '/10   ' + x.q; $('no').innerHTML = x.o.map(o => '<button class="ib" style="text-align:left;padding:9px 12px" data-o="' + esc(o) + '">' + esc(o) + '</button>').join(''); api.hud('Score ' + sc + '  Streak ' + streak); };
    $('no').onclick = e => { const b = e.target.closest('[data-o]'); if (!b || done) return; done = true; const x = q[i], right = b.dataset.o === x.a; if (right) { streak++; sc += 10 + Math.min(streak, 5) * 2; b.style.borderColor = 'var(--ok)'; } else { streak = 0; b.style.borderColor = 'var(--bad)'; $('no').querySelectorAll('[data-o]').forEach(y => { if (y.dataset.o === x.a) y.style.borderColor = 'var(--ok)'; }); } $('nm').innerHTML = '<div class="small">' + esc(x.e) + '</div>' + btn('nx', i + 1 < q.length ? 'Next' : 'Finish', 'pri'); $('nx').onclick = () => { i++; show(); }; api.hud('Score ' + sc + '  Streak ' + streak); };
    const start = () => { q = mk(); i = 0; sc = 0; streak = 0; show(); }; start(); return () => { };
  });

  /* ================= LOG DETECTIVE ================= */
  const NAMES = ['alice', 'bob', 'carol', 'dave', 'erin', 'frank', 'admin', 'deploy', 'svc-backup'];
  const ip = () => '10.0.' + rnd(4) + '.' + (10 + rnd(200)), pubip = () => (20 + rnd(180)) + '.' + rnd(250) + '.' + rnd(250) + '.' + (1 + rnd(250));
  L.makeLog = (n, noise) => { const attacker = pubip(), target = pick(['admin', 'deploy', 'svc-backup']), lines = [], ips = new Set([attacker]); const hosts = []; for (let k = 0; k < noise; k++) { const h = Math.random() < .5 ? ip() : pubip(); hosts.push(h); ips.add(h); } const total = n, atk = 14 + rnd(8); let t = 8 * 3600 + rnd(3000); const fmt = s => { s = s % 86400; return String(s / 3600 | 0).padStart(2, '0') + ':' + String(s % 3600 / 60 | 0).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); }; const ev = []; for (let k = 0; k < atk; k++) ev.push({ ip: attacker, ok: false, u: pick(NAMES) }); ev.push({ ip: attacker, ok: true, u: target, last: true }); for (let k = 0; k < total - atk - 1; k++) { const h = pick(hosts.length ? hosts : [ip()]); ev.push({ ip: h, ok: Math.random() < .8, u: pick(NAMES) }); } const atkEv = ev.filter(e => e.ip === attacker), others = shuffle(ev.filter(e => e.ip !== attacker)); const merged = []; let ai = 0; for (const o of others) { merged.push(o); if (Math.random() < .45 && ai < atkEv.length - 1) merged.push(atkEv[ai++]); } while (ai < atkEv.length) merged.push(atkEv[ai++]); let first = null; for (const e of merged) { t += 4 + rnd(40); e.t = fmt(t); if (e.ip === attacker && !first) first = e.t; lines.push({ t: e.t, ip: e.ip, ok: e.ok, u: e.u }); } return { lines, attacker, target, first, ips: [...ips] }; };
  reg('logs', 'Log Detective', '🕵️', 'Read a server login log, spot the brute-force attacker and find the account they broke into.', (el, api) => {
    let G, round = 0, score = num('cylog', 0), step = 0, hl = '';
    el.innerHTML = '<div style="width:min(760px,100%)"><div id="lq" style="' + box + ';margin-bottom:8px"></div><div class="small mute" style="margin-bottom:4px">Tip: click any address in the log to highlight every line from it.</div><div id="ll" style="max-height:280px;overflow:auto;background:#05070b;border:1px solid var(--line);border-radius:10px;padding:8px;' + mono + ';font-size:12px;line-height:1.55"></div><div id="lo" class="row" style="gap:6px;flex-wrap:wrap;margin-top:10px"></div><div id="lm" style="margin-top:8px"></div></div>';
    const drawLog = () => { $('ll').innerHTML = G.lines.map(l => '<div style="' + (hl && l.ip === hl ? 'background:#3a2a00;' : '') + '"><span style="color:#789">' + l.t + '</span> sshd: ' + (l.ok ? '<span style="color:#6f6">Accepted password</span>' : '<span style="color:#f77">Failed password</span>') + ' for <b>' + esc(l.u) + '</b> from <a data-ip="' + l.ip + '" style="color:#6cf;cursor:pointer;text-decoration:underline">' + l.ip + '</a></div>').join(''); };
    const ask = () => { $('lm').innerHTML = ''; const q = step === 0 ? 'Round ' + (round + 1) + ': which address is brute-forcing the server?' : 'They got in! Which account did that address finally log into?'; $('lq').innerHTML = '<b>' + q + '</b>'; const opts = step === 0 ? shuffle(G.ips).slice(0, 6) : shuffle([G.target].concat(NAMES.filter(n => n !== G.target).slice(0, 3))); if (step === 0 && !opts.includes(G.attacker)) opts[0] = G.attacker; $('lo').innerHTML = shuffle(opts).map(o => '<button class="ib" data-a="' + o + '" style="' + mono + '">' + o + '</button>').join(''); api.hud('Cases solved ' + score); };
    const start = () => { G = L.makeLog(45 + Math.min(round, 6) * 8, 5 + Math.min(round, 4)); step = 0; hl = ''; drawLog(); ask(); };
    $('ll').onclick = e => { const a = e.target.closest('[data-ip]'); if (!a) return; hl = hl === a.dataset.ip ? '' : a.dataset.ip; drawLog(); };
    $('lo').onclick = e => { const b = e.target.closest('[data-a]'); if (!b) return; const ans = b.dataset.a, right = step === 0 ? ans === G.attacker : ans === G.target; if (!right) { b.style.borderColor = 'var(--bad)'; $('lm').innerHTML = '<span style="color:var(--bad)">Not that one.</span> <span class="small mute">' + (step === 0 ? 'Look for one address with a long run of Failed password lines.' : 'Find the Accepted line from the attacker address.') + '</span>'; return; } if (step === 0) { step = 1; hl = G.attacker; drawLog(); ask(); } else { score++; ls.set('cylog', String(score)); api.submit(score); round++; $('lm').innerHTML = '<span style="color:var(--ok)">Case closed!</span> <span class="small mute">' + G.lines.filter(l => l.ip === G.attacker).length + ' attempts from ' + G.attacker + ', starting at ' + G.first + '. Defences: lock out repeated failures, use key-based login, and add two-factor.</span> ' + btn('lx', 'Next case', 'pri'); $('lo').innerHTML = ''; $('lx').onclick = start; api.hud('Cases solved ' + score); } };
    start(); return () => { };
  });
})();

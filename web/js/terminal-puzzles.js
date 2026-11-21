// Terminal Puzzle Studio — genuinely difficulty-scaled puzzles (Easy → Medium → Hard → Insane)
// + custom user puzzle creator across all 10 Terminal Playground shells.
(function () {
  const L = window.TerminalLabyrinth;
  const TP = window.TerminalPlayground;
  if (!L || !TP) return;

  const DIFFS = {
    easy:   { id: 'easy',   label: 'Easy',   icon: '🟢', depth: 1,  col: '#6ee7a0', note: '1 step · clean files & light decoys' },
    medium: { id: 'medium', label: 'Medium', icon: '🟡', depth: 4,  col: '#facc15', note: '2–3 steps · filters, hidden clues & 1 decode layer' },
    hard:   { id: 'hard',   label: 'Hard',   icon: '🟠', depth: 9,  col: '#fb923c', note: '3–4 stages · decoy traps, clue chains & 2–3 decode layers' },
    insane: { id: 'insane', label: 'Insane', icon: '🔴', depth: 15, col: '#f87171', note: '4–5 stages · multi-hop CTF gauntlet & 3–6 stacked layers' }
  };

  const CATEGORIES = {
    bash: [
      ['auto', '🎲 Random (Tier-Scaled)'],
      ['breadcrumb', '🗺️ Vault Breadcrumb Chain'],
      ['corrupt_shards', '🧩 Corrupted Shard Assembly'],
      ['forensic_corr', '🕵️ Multi-Log Forensics'],
      ['pipeline', '⛓️ Multi-Stage Pipeline'],
      ['hidden', '🔒 Hidden Vault'],
      ['assemble', '📦 Fragment Assembly'],
      ['grep', '🔍 Log Hunt'],
      ['nested', '🌳 Deep Nested Tree'],
      ['encoded', '🔐 Encoded Secret'],
      ['count', '📊 Log Frequency Count']
    ],
    powershell: [
      ['auto', '🎲 Random (Tier-Scaled)'],
      ['breadcrumb', '🗺️ Vault Breadcrumb Chain'],
      ['corrupt_shards', '🧩 Corrupted Shard Assembly'],
      ['forensic_corr', '🕵️ Multi-Log Forensics'],
      ['pipeline', '⛓️ Object & Decode Pipeline'],
      ['hidden', '🔒 Hidden Vault'],
      ['assemble', '📦 Fragment Assembly'],
      ['grep', '🔍 Select-String Hunt'],
      ['nested', '🌳 Recursive Search']
    ],
    cmd: [
      ['auto', '🎲 Random (Tier-Scaled)'],
      ['breadcrumb', '🗺️ Vault Breadcrumb Chain'],
      ['corrupt_shards', '🧩 Corrupted Shard Assembly'],
      ['forensic_corr', '🕵️ Multi-Log Forensics'],
      ['pipeline', '⛓️ Stream & Decode Pipeline'],
      ['hidden', '🔒 Hidden Files (/a)'],
      ['assemble', '📦 Fragment Assembly'],
      ['grep', '🔍 findstr Hunt'],
      ['nested', '🌳 Deep dir /s /b']
    ],
    python: [
      ['auto', '🎲 Random (Tier-Scaled)'],
      ['weighted', '🧮 Filtered Weighted Calc'],
      ['sum', '➕ List Sum'],
      ['countgt', '🔢 Threshold Count'],
      ['evens', '⚖️ Filtered Sum'],
      ['maxmin', '📏 Range (Max - Min)'],
      ['twice', '📂 Two-File Merge']
    ],
    node: [
      ['auto', '🎲 Random (Tier-Scaled)'],
      ['weighted', '🧮 Filtered Weighted Calc'],
      ['sum', '➕ Array Reduce'],
      ['countgt', '🔢 Filter & Count'],
      ['evens', '⚖️ Even Sum'],
      ['maxmin', '📏 Max - Min'],
      ['double', '✖️ Transform & Scale']
    ],
    sql: [
      ['auto', '🎲 Random (Tier-Scaled)'],
      ['join', '🔗 Multi-Table JOIN'],
      ['sum', '💰 Filtered SUM'],
      ['count', '🔢 Session COUNT'],
      ['avg', '📈 Average Total'],
      ['max', '🏆 Account MAX'],
      ['sum2', '🔎 Multi-Condition WHERE']
    ],
    git: [
      ['auto', '🎲 Random (Tier-Scaled)'],
      ['author', '👤 Hunt by Author'],
      ['message', '💬 Hunt by Message']
    ],
    docker: [
      ['auto', '🎲 Random (Tier-Scaled)'],
      ['env', '🐳 Container Env & Logs']
    ],
    network: [
      ['auto', '🎲 Random (Tier-Scaled)'],
      ['http', '🌐 Port & API Recon'],
      ['dns', '📡 DNS TXT / Pivot']
    ],
    crypto: [
      ['auto', '🎲 Random (Tier-Scaled)'],
      ['chain', '🔐 Layered Encoding Chain']
    ]
  };

  const CUSTOM_KEY = 'tpg_custom_puzzles';
  const STATS_KEY = 'tpg_puzzle_stats';

  const loadCustom = () => {
    try { const v = JSON.parse(localStorage.getItem(CUSTOM_KEY) || '[]'); return Array.isArray(v) ? v : []; } catch (e) { return []; }
  };
  const saveCustom = list => {
    try { localStorage.setItem(CUSTOM_KEY, JSON.stringify(list.slice(0, 60))); } catch (e) { }
  };
  const loadStats = () => {
    try {
      const s = JSON.parse(localStorage.getItem(STATS_KEY) || '{}');
      return {
        solved: s.solved | 0, streak: s.streak | 0, bestStreak: s.bestStreak | 0,
        byDiff: Object.assign({ easy: 0, medium: 0, hard: 0, insane: 0 }, s.byDiff || {})
      };
    } catch (e) { return { solved: 0, streak: 0, bestStreak: 0, byDiff: { easy: 0, medium: 0, hard: 0, insane: 0 } }; }
  };
  const saveStats = s => { try { localStorage.setItem(STATS_KEY, JSON.stringify(s)); } catch (e) { } };

  const newSeed = () => {
    try { return (crypto.getRandomValues(new Uint32Array(1))[0] >>> 0) % 999999 + 1; }
    catch (e) { return Math.floor(Math.random() * 999999) + 1; }
  };

  /* ---------------------------------------------------------------- encoding & random helpers */
  const pick = (r, a) => a[r(a.length)];
  const shuffle = (a, r) => {
    const x = a.slice();
    for (let i = x.length - 1; i > 0; i--) { const j = r(i + 1); [x[i], x[j]] = [x[j], x[i]]; }
    return x;
  };
  const b64e = s => (typeof btoa === 'function' ? btoa(s) : Buffer.from(String(s), 'utf8').toString('base64'));
  const b64d = s => {
    const t = String(s || '').trim().replace(/\s+/g, '');
    const pad = t.length % 4 ? t + '='.repeat(4 - (t.length % 4)) : t;
    return typeof atob === 'function' ? atob(pad) : Buffer.from(pad, 'base64').toString('utf8');
  };
  const hexOf = s => [...String(s)].map(c => c.charCodeAt(0).toString(16).padStart(2, '0')).join('');
  const unhex = s => { const h = String(s).replace(/[^0-9a-f]/gi, ''); let o = ''; for (let i = 0; i + 1 < h.length; i += 2) o += String.fromCharCode(parseInt(h.slice(i, i + 2), 16)); return o; };
  const rot = (s, n) => [...String(s)].map(c => /[a-z]/.test(c) ? String.fromCharCode((c.charCodeAt(0) - 97 + ((n % 26) + 26)) % 26 + 97) : /[A-Z]/.test(c) ? String.fromCharCode((c.charCodeAt(0) - 65 + ((n % 26) + 26)) % 26 + 65) : c).join('');
  const revStr = s => [...String(s)].reverse().join('');
  const binOf = s => [...String(s)].map(c => c.charCodeAt(0).toString(2).padStart(8, '0')).join(' ');
  const unbin = s => String(s).trim().split(/\s+/).map(b => /^[01]{7,8}$/.test(b) ? String.fromCharCode(parseInt(b, 2)) : '').join('');
  const MORSE = { A: '.-', B: '-...', C: '-.-.', D: '-..', E: '.', F: '..-.', G: '--.', H: '....', I: '..', J: '.---', K: '-.-', L: '.-..', M: '--', N: '-.', O: '---', P: '.--.', Q: '--.-', R: '.-.', S: '...', T: '-', U: '..-', V: '...-', W: '.--', X: '-..-', Y: '-.--', Z: '--..', 0: '-----', 1: '.----', 2: '..---', 3: '...--', 4: '....-', 5: '.....', 6: '-....', 7: '--...', 8: '---..', 9: '----.' };
  const RMORSE = Object.fromEntries(Object.entries(MORSE).map(([k, v]) => [v, k]));
  const morseOf = s => [...String(s).toUpperCase()].map(c => c === ' ' ? '/' : MORSE[c] || '').filter(Boolean).join(' ');
  const unMorse = s => String(s).trim().split(/\s+/).map(c => c === '/' ? ' ' : RMORSE[c] || '').join('').toLowerCase();

  const LAYER_SPEC = {
    base64: { enc: b64e, dec: b64d, cmd: 'base64 -d', label: 'Base64' },
    hex:    { enc: hexOf, dec: unhex, cmd: 'xxd -r', label: 'Hex' },
    rot13:  { enc: s => rot(s, 13), dec: s => rot(s, 13), cmd: 'rot13', label: 'ROT13' },
    rev:    { enc: revStr, dec: revStr, cmd: 'rev', label: 'Reverse' },
    caesar: { enc: s => rot(s, 7), dec: s => rot(s, -7), cmd: 'caesar -7', label: 'Caesar(+7)' },
    url:    { enc: s => encodeURIComponent(s), dec: s => decodeURIComponent(s), cmd: 'url -d', label: 'URL' }
  };

  function encodeChain(plain, layers) {
    let val = String(plain);
    const applied = [];
    for (const name of layers) {
      const sp = LAYER_SPEC[name];
      if (!sp) continue;
      val = sp.enc(val);
      applied.push(name);
    }
    const decodeOrder = applied.slice().reverse();
    let verify = val;
    for (const name of decodeOrder) {
      try { verify = LAYER_SPEC[name].dec(verify); } catch (e) { verify = null; break; }
    }
    if (verify !== plain) {
      return { encoded: b64e(plain), decodeOrder: ['base64'], decodeCmds: ['base64 -d'], decodePipe: 'base64 -d', labels: ['Base64'] };
    }
    return {
      encoded: val,
      decodeOrder,
      decodeCmds: decodeOrder.map(n => LAYER_SPEC[n].cmd),
      decodePipe: decodeOrder.map(n => LAYER_SPEC[n].cmd).join(' | '),
      labels: decodeOrder.map(n => LAYER_SPEC[n].label)
    };
  }

  /* deep Terminal Labyrinth floors ask for extra encoding layers (generate({extraLayers})); every layer count in a brief comes from deepen() so the text stays true */
  let EXTRA = 0;
  const deepen = n => Math.min(6, n + EXTRA);
  function pickLayers(r, count) {
    const pools = {
      1: [['base64'], ['rot13'], ['hex']],
      2: [['base64', 'hex'], ['base64', 'rot13'], ['hex', 'rev'], ['rot13', 'base64']],
      3: [['base64', 'hex', 'rot13'], ['base64', 'rev', 'hex'], ['rot13', 'base64', 'rev'], ['base64', 'caesar', 'hex']],
      4: [['base64', 'hex', 'rot13', 'rev'], ['base64', 'caesar', 'hex', 'rev'], ['rot13', 'base64', 'hex', 'rev'], ['base64', 'rev', 'rot13', 'hex']],
      5: [['base64', 'hex', 'rot13', 'rev', 'caesar'], ['caesar', 'base64', 'hex', 'rot13', 'rev']],
      6: [['base64', 'hex', 'rot13', 'url', 'rev', 'caesar'], ['caesar', 'base64', 'rot13', 'hex', 'rev', 'url']]
    };
    return pick(r, pools[Math.max(1, Math.min(6, count))]);
  }

  function splitIntoParts(str, n) {
    const out = [];
    const base = Math.floor(str.length / n);
    let idx = 0;
    for (let i = 0; i < n; i++) {
      const end = i === n - 1 ? str.length : idx + base + (i < str.length % n ? 1 : 0);
      out.push(str.slice(idx, end));
      idx = end;
    }
    return out;
  }

  /* Pipe decoder utility shared by Git / Docker / Network Hard & Insane rooms */
  function applyDecodePipeSegment(seg, out) {
    const w = TP.argv ? TP.argv(seg) : seg.split(/\s+/).filter(Boolean);
    if (!w.length) return out;
    const cmd = w[0].toLowerCase();
    const rest = w.slice(1);
    if (cmd === 'grep') {
      const inv = rest.includes('-v');
      const pat = rest.find(x => !x.startsWith('-')) || '';
      const re = new RegExp(pat.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      return String(out).split('\n').filter(l => re.test(l) !== inv).join('\n');
    }
    if (cmd === 'head') return String(out).split('\n').slice(0, parseInt((rest[0] || '-10').replace(/^-n?/, ''), 10) || 10).join('\n');
    if (cmd === 'tail') return String(out).split('\n').slice(-(parseInt((rest[0] || '-10').replace(/^-n?/, ''), 10) || 10)).join('\n');
    if (cmd === 'wc') return String(out ? String(out).split('\n').length : 0);
    if (cmd === 'cut') {
      let d = '\t', fSpec = '1';
      for (let i = 0; i < rest.length; i++) {
        if (rest[i] === '-d') d = rest[++i] ?? '\t';
        else if (rest[i] === '-f') fSpec = rest[++i] || '1';
        else if (/^-d/.test(rest[i]) && rest[i].length > 2) d = rest[i].slice(2);
        else if (/^-f.+/.test(rest[i])) fSpec = rest[i].slice(2);
      }
      const rangeM = fSpec.match(/^(\d+)-(\d*)$/);
      const idx = parseInt(fSpec, 10) || 1;
      return String(out).split('\n').map(l => {
        const parts = l.split(d);
        if (rangeM) return parts.slice((+rangeM[1] || 1) - 1, rangeM[2] ? +rangeM[2] : undefined).join(d);
        return parts[idx - 1] || '';
      }).join('\n');
    }
    if (cmd === 'tr') {
      const sets = rest.filter(x => !x.startsWith('-'));
      if (rest.includes('-d')) {
        const del = String(sets[0] || '').replace(/^["']|["']$/g, '').replace(/\\n/g, '\n').replace(/\\t/g, '\t');
        return [...String(out)].filter(c => !del.includes(c)).join('');
      }
      return out;
    }
    if (cmd === 'base64') {
      const dec = rest.some(x => /^-d|--decode$/.test(x));
      const argTxt = rest.filter(x => !x.startsWith('-')).join(' ');
      const txt = argTxt || String(out);
      try { return dec ? b64d(txt) : b64e(txt); } catch (e) { return 'base64: invalid input'; }
    }
    if (cmd === 'xxd' || cmd === 'hex') {
      const dec = rest.includes('-r') || rest.includes('-d');
      const argTxt = rest.filter(x => !x.startsWith('-')).join(' ');
      const txt = argTxt || String(out);
      return dec ? unhex(txt) : hexOf(txt);
    }
    if (cmd === 'rot13') {
      const argTxt = rest.join(' ');
      return rot(argTxt || String(out), 13);
    }
    if (cmd === 'rev' || cmd === 'reverse') {
      const argTxt = rest.join(' ');
      return String(argTxt || out).split('\n').map(revStr).join('\n');
    }
    if (cmd === 'caesar') {
      const hasN = /^-?\d+$/.test(rest[0] || '');
      const n = hasN ? parseInt(rest[0], 10) : -7;
      const argTxt = (hasN ? rest.slice(1) : rest).join(' ');
      return rot(argTxt || String(out), n);
    }
    if (cmd === 'url') {
      const dec = rest.includes('-d');
      const argTxt = rest.filter(x => !x.startsWith('-')).join(' ');
      const txt = argTxt || String(out);
      return dec ? decodeURIComponent(txt.trim()) : encodeURIComponent(txt);
    }
    return out;
  }

  function treeToFlat(node, prefix, out) {
    out = out || {};
    for (const k of Object.keys(node)) {
      const p = prefix ? prefix + '/' + k : k;
      if (node[k] && typeof node[k] === 'object' && !('text' in node[k])) treeToFlat(node[k], p, out);
      else out[p] = typeof node[k] === 'string' ? node[k] : String(node[k].text);
    }
    return out;
  }

  /* ================================================================ FULL FILE-SHELL ROOM BUILDER */
  function buildCustomFileRoom(spec) {
    const shell = spec.shell || 'bash';
    const filesMap = spec.files && typeof spec.files === 'object' ? spec.files : { 'README.txt': spec.brief || '' };
    const tree = {};
    const cwd = [];
    const { put, isDir, textOf, walk, listTree } = L.fs;
    const entries = Object.entries(filesMap);
    if (!entries.length) put(tree, 'README.txt', spec.brief || 'Custom puzzle room');
    for (const [k, v] of entries) {
      const clean = String(k || '').trim().replace(/^\/+/, '').replace(/\\/g, '/');
      if (clean && clean.split('/').every(part => !Object.hasOwn(Object.prototype, part))) {
        put(tree, clean, String(v == null ? '' : v));
      }
    }

    const G = window.TerminalPlayground || {};
    const splitTop = G.splitTop || ((s, seps) => s.split(seps[0]).map(x => x.trim()).filter(Boolean));
    const Unix = TerminalUnix;
    const isWin = shell === 'powershell' || shell === 'cmd';
    let prevCwd = null;

    const resolve = p => {
      if (!p || p === '~') return [];
      let raw = String(p).trim().replace(/\\/g, '/');
      if (raw.startsWith('~/')) raw = '/' + raw.slice(2);
      const isAbs = raw.startsWith('/') || /^[A-Za-z]:/.test(raw);
      raw = raw.replace(/^[A-Za-z]:\/?/, '').replace(/^\/+/, '');
      if (isWin && isAbs && /^(puzzle|labyrinth)(\/|$)/i.test(raw)) raw = raw.replace(/^(puzzle|labyrinth)\/?/i, '');
      const parts = isAbs ? [] : cwd.slice();
      for (const s of raw.split('/')) { if (!s || s === '.') continue; if (s === '..') parts.pop(); else parts.push(s); }
      return parts;
    };
    const walkN = parts => walk(tree, parts, isWin);
    const read = p => {
      const parts = resolve(p);
      const n = walkN(parts);
      if (n === undefined) {
        const parent = walkN(parts.slice(0, -1));
        const siblings = isDir(parent) ? Object.keys(parent).filter(k => !k.startsWith('.')).sort() : [];
        const hint = siblings.length ? ' (available: ' + siblings.slice(0, 6).join(', ') + ')' : '';
        return { err: p + ': No such file or directory' + hint };
      }
      if (isDir(n)) return { err: p + ': Is a directory' };
      if (!isWin && !(Unix.mode(n) & 0o400)) return { err: p + ': Permission denied' };
      return { text: textOf(n) };
    };
    const writeF = (p, txt, append) => {
      const parts = resolve(p);
      let n = tree;
      for (let i = 0; i < parts.length - 1; i++) { if (!isDir(n[parts[i]])) n[parts[i]] = {}; n = n[parts[i]]; }
      const k = parts[parts.length - 1], old = n[k];
      n[k] = { text: append && old && !isDir(old) ? textOf(old) + '\n' + txt : String(txt),
        mode: old && !isDir(old) ? Unix.octal(Unix.mode(old)) : '644' };
    };
    const srcOf = (files, stdin) => files.length ? (() => { const rs = files.map(read); const err = rs.find(x => x.err); return err ? { err: err.err } : { text: rs.map(x => x.text).join('\n') }; })() : (stdin != null ? { text: stdin } : { err: 'missing input' });

    const C = {};
    if (shell === 'bash' && typeof TerminalOpsTraining !== 'undefined') {
      Object.assign(C, TerminalOpsTraining.asCommands(result => result.out));
    }
    if (!isWin) C.chmod = a => Unix.chmod(a, resolve, walkN, isDir).out;
    C.pwd = () => isWin ? 'C:\\puzzle' + (cwd.length ? '\\' + cwd.join('\\') : '') : '/' + cwd.join('/');
    C.cd = a => {
      const t = a.filter(x => !/^\/d$/i.test(x))[0];
      if (!t && shell === 'cmd') return C.pwd();
      if (t === '-') { if (!prevCwd) return 'cd: OLDPWD not set'; const nx = prevCwd.slice(); prevCwd = cwd.slice(); cwd.length = 0; cwd.push(...nx); return C.pwd(); }
      const p = resolve(t || '/');
      const n = walkN(p);
      if (n === undefined) return isWin ? (shell === 'cmd' ? 'The system cannot find the path specified.' : "Set-Location : Cannot find path '" + t + "'.") : 'cd: ' + (t || '/') + ': No such file or directory';
      if (!isDir(n)) return isWin ? (shell === 'cmd' ? 'The directory name is invalid.' : "Set-Location : '" + t + "' is a file, not a directory.") : 'cd: ' + t + ': Not a directory';
      prevCwd = cwd.slice(); cwd.length = 0; cwd.push(...p); return '';
    };
    C.ls = a => {
      const flags = a.filter(x => x.startsWith('-') || (isWin && x.startsWith('/'))).join(' ').toLowerCase();
      const filterIdx = a.findIndex(x => /^-filter$/i.test(x));
      const filter = filterIdx >= 0 ? a[filterIdx + 1] : null;
      const t = a.find((x, i) => !x.startsWith('-') && !(isWin && x.startsWith('/')) && (filterIdx < 0 || i !== filterIdx + 1)) || '.';
      const n = walkN(resolve(t));
      if (n === undefined) return "ls: cannot access '" + t + "': No such file or directory";
      if (!isDir(n)) return flags.includes('l') && !isWin ? Unix.permissions(n) + ' 1 solver solver ' + textOf(n).length + ' ' + t : t;
      if (flags.includes('recurse') || (flags.includes('/s') && flags.includes('/b'))) {
        const rows = [];
        const filterRe = filter ? new RegExp('^' + filter.replace(/\./g, '\\.').replace(/\*/g, '.*') + '$', 'i') : null;
        for (const [p] of listTree(n, t === '.' ? '' : t, [])) {
          const base = p.split('/').pop();
          if (!flags.includes('force') && !flags.includes('/a') && !flags.includes('a') && p.split('/').some(seg => seg.startsWith('.'))) continue;
          if (filterRe && !filterRe.test(base)) continue;
          rows.push(isWin ? p.replace(/^\/+/, '').replace(/\//g, '\\') : p.replace(/^\/+/, ''));
        }
        return rows.join('\n');
      }
      const names = Object.keys(n).filter(k => flags.includes('a') || flags.includes('force') || k[0] !== '.').sort();
      if (flags.includes('l')) return 'total ' + names.length + '\n' + names.map(k => Unix.permissions(n[k], isDir(n[k])) + ' 1 solver solver ' + String(isDir(n[k]) ? 4096 : textOf(n[k]).length).padStart(6) + ' ' + k + (isDir(n[k]) ? '/' : '')).join('\n');
      return names.map(k => k + (isDir(n[k]) ? '/' : '')).join('  ');
    };
    C.ll = a => C.ls(['-la'].concat(a));
    C.la = a => C.ls(['-a'].concat(a));
    C.dir = C.ls;
    C['get-childitem'] = C.ls;
    C.gci = C.ls;
    C['get-location'] = C.pwd;
    C.gl = C.pwd;
    C['set-location'] = C.cd;
    C.sl = C.cd;
    C['test-path'] = a => walkN(resolve(a[0] || '')) !== undefined ? 'True' : 'False';
    C.cat = (a, s, reportError) => {
      let flags = '', files = [];
      for (const x of a) {
        if (x === '-') files.push('-');
        else if (x.startsWith('-') && x.length > 1) flags += x.slice(1);
        else files.push(x);
      }
      let combined;
      if (!files.length) { if (s == null) return 'usage: cat [-n|-b|-E|-s] <file>'; combined = s; }
      else {
        const outs = [];
        for (const f of files) {
          if (f === '-') { outs.push(s == null ? '' : s); continue; }
          const r = read(f);
          if (r.err) {
            if (!reportError) return 'cat: ' + r.err;
            reportError('cat: ' + r.err);
          } else outs.push(r.text);
        }
        combined = outs.join('\n');
      }
      let lines = String(combined).split('\n');
      if (flags.includes('s')) lines = lines.filter((l, i) => l !== '' || lines[i - 1] !== '');
      if (flags.includes('E') || flags.includes('A')) lines = lines.map(l => l + '$');
      if (flags.includes('b')) { let num = 0; lines = lines.map(l => l.trim() === '' ? l : String(++num).padStart(6) + '\t' + l); }
      else if (flags.includes('n')) lines = lines.map((l, i) => String(i + 1).padStart(6) + '\t' + l);
      return lines.join('\n');
    };
    C.type = C.cat; C['get-content'] = C.cat; C.gc = C.cat; C.more = C.cat; C.less = C.cat;
    C.head = (a, s) => {
      let n = 10, files = [];
      for (let i = 0; i < a.length; i++) {
        if (a[i] === '-n') n = parseInt(a[++i], 10) || 10;
        else if (/^-\d+$/.test(a[i])) n = parseInt(a[i].slice(1), 10) || 10;
        else if (!a[i].startsWith('-')) files.push(a[i]);
      }
      const r = srcOf(files, s); return r.err ? 'head: ' + r.err : r.text.split('\n').slice(0, n).join('\n');
    };
    C.tail = (a, s) => {
      let n = 10, files = [];
      for (let i = 0; i < a.length; i++) {
        if (a[i] === '-n') n = parseInt(a[++i], 10) || 10;
        else if (/^-\d+$/.test(a[i])) n = parseInt(a[i].slice(1), 10) || 10;
        else if (!a[i].startsWith('-')) files.push(a[i]);
      }
      const r = srcOf(files, s); return r.err ? 'tail: ' + r.err : r.text.split('\n').slice(-n).join('\n');
    };
    C.grep = (a, s) => {
      let flags = '', rest = [];
      for (const x of a) { if (x.startsWith('-') && x.length > 1) flags += x.slice(1); else rest.push(x); }
      const pat = rest.shift(); if (pat == null) return 'usage: grep [-invrcEo] <pattern> [file...]';
      let re; try { re = new RegExp(pat, flags.includes('i') ? 'i' : ''); } catch (e) { return 'grep: bad pattern'; }
      const hits = [];
      const scan = (txt, lbl) => String(txt).split('\n').forEach((l, i) => {
        const matched = re.test(l);
        if (matched !== flags.includes('v')) {
          const body = flags.includes('o') && !flags.includes('v') ? (l.match(re) || [''])[0] : l;
          hits.push((lbl && (rest.length > 1 || flags.includes('r') || flags.includes('R')) ? lbl + ':' : '') + (flags.includes('n') ? (i + 1) + ':' : '') + body);
        }
      });
      if (!rest.length) scan(s || '', '');
      else for (const f of rest) {
        const n = walkN(resolve(f));
        if (n === undefined) return 'grep: ' + f + ': No such file or directory';
        if (isDir(n)) {
          for (const [p, c] of listTree(n, f, [])) {
            if (isDir(c)) continue;
            const result = read(p);
            if (!result.err) scan(result.text, p);
          }
        } else {
          const result = read(f);
          if (result.err) return 'grep: ' + result.err;
          scan(result.text, f);
        }
      }
      return flags.includes('c') ? String(hits.length) : hits.join('\n');
    };
    C.findstr = (a, s) => {
      const pos = a.filter(x => !x.startsWith('/'));
      return C.grep(['-i'].concat(pos), s);
    };
    C['select-string'] = (a, s) => {
      const pi = a.findIndex(x => /^-pattern$/i.test(x)), fi = a.findIndex(x => /^-path$/i.test(x));
      const pat = pi >= 0 ? a[pi + 1] : a.find(x => !x.startsWith('-'));
      const f = fi >= 0 ? a[fi + 1] : a.filter(x => !x.startsWith('-') && x !== pat)[0];
      return C.grep(['-i', pat || ''].concat(f ? [f] : []), s);
    };
    C.sls = C['select-string'];
    C['measure-object'] = (a, s) => 'Count\n-----\n' + (s == null || s === '' ? 0 : String(s).split('\n').length);
    C.measure = C['measure-object'];
    C['sort-object'] = (a, s) => C.sort(a.some(x => /^-desc/i.test(x)) ? ['-r'] : [], s);
    C['select-object'] = (a, s) => {
      const lines = String(s || '').split('\n');
      const fi = a.findIndex(x => /^-first$/i.test(x)), li = a.findIndex(x => /^-last$/i.test(x));
      if (fi >= 0) return lines.slice(0, parseInt(a[fi + 1], 10) || 1).join('\n');
      if (li >= 0) return lines.slice(-(parseInt(a[li + 1], 10) || 1)).join('\n');
      return lines.join('\n');
    };
    C.find = a => {
      const ni = a.findIndex(x => x === '-name' || x === '-iname');
      const pat = ni >= 0 ? a[ni + 1] : '*';
      const ti = a.findIndex(x => x === '-type');
      const wantType = ti >= 0 ? a[ti + 1] : null;
      const start = a.find((x, i) => !x.startsWith('-') && (ni < 0 || i !== ni + 1) && (ti < 0 || i !== ti + 1)) || '.';
      const n = walkN(resolve(start));
      if (!isDir(n)) return "find: '" + start + "': No such file or directory";
      const re = new RegExp('^' + pat.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$', ni >= 0 && a[ni] === '-iname' ? 'i' : '');
      return listTree(n, start === '.' ? '.' : start, [])
        .filter(([p, node]) => (!wantType || (wantType === 'f' ? !isDir(node) : isDir(node))) && re.test(p.split('/').pop()))
        .map(([p]) => p).join('\n');
    };
    C.tree = a => {
      if (isWin && window.TerminalPlayground?.winTreeListing) {
        const target = a.find(x => !x.startsWith('/') && !x.startsWith('-'));
        const node = walkN(resolve(target || '.'));
        if (!isDir(node)) return 'Invalid path - ' + String(target || '.').toUpperCase();
        return window.TerminalPlayground.winTreeListing(node, C.pwd().replace(/\//g, '\\'), a);
      }
      const showHidden = a.includes('-a');
      const t = a.find(x => !x.startsWith('-')) || '.'; const n = walkN(resolve(t));
      if (!isDir(n)) return 'tree: not a directory';
      const rows = [t];
      const rec = (node, pre) => {
        const ks = Object.keys(node).filter(k => showHidden || k[0] !== '.').sort();
        ks.forEach((k, i) => {
          const last = i === ks.length - 1;
          rows.push(pre + (last ? '└── ' : '├── ') + k + (isDir(node[k]) ? '/' : ''));
          if (isDir(node[k])) rec(node[k], pre + (last ? '    ' : '│   '));
        });
      };
      rec(n, ''); return rows.join('\n');
    };
    C.stat = a => {
      const formatted = !isWin && Unix.permissionStat(a, p => walkN(resolve(p)), isDir);
      if (formatted) return formatted.out;
      const f = a[0], n = walkN(resolve(f || ''));
      if (n === undefined) return "stat: cannot stat '" + f + "': No such file or directory";
      return '  File: ' + f + '\n  Size: ' + (isDir(n) ? 4096 : textOf(n).length) + '\n  Type: ' + (isDir(n) ? 'directory' : 'regular file') +
        (!isWin ? '\nAccess: (' + Unix.octal(Unix.mode(n, isDir(n))).padStart(4, '0') + '/' + Unix.permissions(n, isDir(n)) + ')' : '');
    };
    C.file = a => {
      const f = a[0], r = read(f || '');
      if (r.err) return 'file: ' + r.err;
      const t = r.text.trim();
      if (/^[0-9a-f]{16,}$/i.test(t) && t.length % 2 === 0) return f + ': ASCII text (hex encoded)';
      if (/^[A-Za-z0-9+/=]{12,}$/.test(t) && t.length % 4 === 0) return f + ': ASCII text (base64 encoded)';
      if (/^[01 ]{16,}$/.test(t)) return f + ': ASCII text (binary)';
      return f + ': ASCII text';
    };
    C.cut = (a, s) => {
      let d = '\t', fSpec = '1';
      const skip = new Set();
      for (let i = 0; i < a.length; i++) {
        if (a[i] === '-d') { d = a[++i] || '\t'; skip.add(i); }
        else if (a[i] === '-f') { fSpec = a[++i] || '1'; skip.add(i); }
        else if (/^-d./.test(a[i])) d = a[i].slice(2);
        else if (/^-f.+/.test(a[i])) fSpec = a[i].slice(2);
      }
      const files = a.filter((x, i) => !x.startsWith('-') && !skip.has(i));
      const r = srcOf(files, s);
      if (r.err) return 'cut: ' + r.err;
      const rangeM = fSpec.match(/^(\d+)-(\d*)$/);
      const idx = parseInt(fSpec, 10) || 1;
      return r.text.split('\n').map(l => {
        const parts = l.split(d);
        if (rangeM) return parts.slice((+rangeM[1] || 1) - 1, rangeM[2] ? +rangeM[2] : undefined).join(d);
        return parts[idx - 1] || '';
      }).join('\n');
    };
    C.tr = (a, s) => {
      if (s == null) return 'tr: missing input';
      const exp = str => { str = String(str || '').replace(/\\n/g, '\n').replace(/\\t/g, '\t').replace(/\\r/g, '\r'); let o = ''; for (let i = 0; i < str.length; i++) { if (i + 2 < str.length && str[i + 1] === '-') { for (let c = str.charCodeAt(i); c <= str.charCodeAt(i + 2); c++) o += String.fromCharCode(c); i += 2; } else o += str[i]; } return o; };
      const sets = a.filter(x => !x.startsWith('-'));
      if (a.includes('-d')) { const del = exp(sets[0]); return [...s].filter(c => !del.includes(c)).join(''); }
      const from = exp(sets[0]), to = exp(sets[1]);
      return [...s].map(c => { const i = from.indexOf(c); return i < 0 ? c : (to[i] || to[to.length - 1] || ''); }).join('');
    };
    C.sort = (a, s) => {
      let sep = null, keyCol = null, numeric = false, rev = false, uniq = false;
      const skip = new Set();
      for (let i = 0; i < a.length; i++) {
        if (a[i] === '-t') { sep = a[++i]; skip.add(i); }
        else if (/^-t./.test(a[i])) sep = a[i].slice(2);
        else if (a[i] === '-k') { const kv = a[++i] || '1'; skip.add(i); keyCol = parseInt(kv, 10); if (/n/i.test(kv)) numeric = true; }
        else if (/^-k\d/.test(a[i])) { keyCol = parseInt(a[i].slice(2), 10); if (/n/i.test(a[i])) numeric = true; }
        else if (a[i].startsWith('-')) {
          if (a[i].includes('n')) numeric = true;
          if (a[i].includes('r')) rev = true;
          if (a[i].includes('u')) uniq = true;
        }
      }
      const files = a.filter((x, i) => !x.startsWith('-') && !skip.has(i));
      const r = srcOf(files, s);
      if (r.err) return 'sort: ' + r.err;
      const fieldOf = line => {
        if (keyCol == null) return line;
        const parts = sep ? line.split(sep) : line.trim().split(/\s+/);
        return parts[keyCol - 1] || '';
      };
      let ls2 = r.text.split('\n').filter(l => l !== '');
      ls2.sort((x, y) => {
        const fx = fieldOf(x), fy = fieldOf(y);
        if (numeric) {
          const nx = parseFloat(fx.replace(/^[^0-9.-]*/, '')) || 0;
          const ny = parseFloat(fy.replace(/^[^0-9.-]*/, '')) || 0;
          return nx - ny;
        }
        return fx < fy ? -1 : fx > fy ? 1 : 0;
      });
      if (rev) ls2.reverse();
      if (uniq) ls2 = ls2.filter((x, i) => x !== ls2[i - 1]);
      return ls2.join('\n');
    };
    C.uniq = (a, s) => {
      const r = srcOf(a.filter(x => !x.startsWith('-')), s);
      if (r.err) return 'uniq: ' + r.err;
      const ls2 = r.text.split('\n');
      if (a.includes('-c')) {
        const out = [];
        for (let i = 0; i < ls2.length;) { let j = i + 1; while (j < ls2.length && ls2[j] === ls2[i]) j++; out.push(String(j - i).padStart(6) + ' ' + ls2[i]); i = j; }
        return out.join('\n');
      }
      return ls2.filter((x, i) => x !== ls2[i - 1]).join('\n');
    };
    C.wc = (a, s) => {
      const r = srcOf(a.filter(x => !x.startsWith('-')), s);
      if (r.err) return 'wc: ' + r.err;
      const lines = r.text ? r.text.split('\n').length : 0;
      if (a.includes('-w')) return String(r.text.trim() ? r.text.trim().split(/\s+/).length : 0);
      if (a.includes('-c')) return String(r.text.length);
      return String(lines);
    };
    C.nl = (a, s) => { const r = srcOf(a.filter(x => !x.startsWith('-')), s); return r.err ? 'nl: ' + r.err : r.text.split('\n').map((l, i) => String(i + 1).padStart(6) + '\t' + l).join('\n'); };
    C.tac = (a, s) => { const r = srcOf(a.filter(x => !x.startsWith('-')), s); return r.err ? 'tac: ' + r.err : r.text.split('\n').reverse().join('\n'); };
    C.paste = a => {
      const dIdx = a.indexOf('-d'), sep = dIdx >= 0 ? (a[dIdx + 1] || '\t') : '\t';
      const files = a.filter((x, i) => !x.startsWith('-') && (dIdx < 0 || i !== dIdx + 1));
      const lists = files.map(f => { const r = read(f); return r.err ? null : r.text.split('\n'); });
      if (lists.some(l => l === null)) return 'paste: cannot open file';
      const len = Math.max(0, ...lists.map(l => l.length));
      return Array.from({ length: len }, (_, i) => lists.map(l => l[i] || '').join(sep)).join('\n');
    };
    C.base64 = (a, s) => { const dec = a.some(x => /^-d|--decode$/.test(x)); const pos = a.filter(x => !x.startsWith('-')); const r = pos.length && walkN(resolve(pos[0])) !== undefined ? srcOf(pos, s) : { err: true }; const txt = r.err ? (pos.join(' ') || (s == null ? '' : s)) : r.text; try { return dec ? b64d(txt) : b64e(txt); } catch (e) { return 'base64: invalid input'; } };
    C.xxd = (a, s) => { const dec = a.includes('-r') || a.includes('-d'); const pos = a.filter(x => !x.startsWith('-')); const r = pos.length && walkN(resolve(pos[0])) !== undefined ? srcOf(pos, s) : { err: true }; const txt = r.err ? (pos.join(' ') || (s == null ? '' : s)) : r.text; return dec ? unhex(txt) : hexOf(txt); };
    C.hex = C.xxd;
    C.hexdump = (a, s) => C.xxd(a.filter(x => x !== '-C'), s);
    C.rot13 = (a, s) => { const pos = a.filter(x => !x.startsWith('-')); const r = pos.length && walkN(resolve(pos[0])) !== undefined ? srcOf(pos, s) : { err: true }; return rot(r.err ? (pos.join(' ') || (s == null ? '' : s)) : r.text, 13); };
    C.rev = (a, s) => { const pos = a.filter(x => !x.startsWith('-')); const r = pos.length && walkN(resolve(pos[0])) !== undefined ? srcOf(pos, s) : { err: true }; return String(r.err ? (pos.join(' ') || (s == null ? '' : s)) : r.text).split('\n').map(revStr).join('\n'); };
    C.reverse = C.rev;
    C.caesar = (a, s) => { const hasN = /^-?\d+$/.test(a[0] || ''); const n = hasN ? parseInt(a[0], 10) : -7; const pos = hasN ? a.slice(1) : a; const r = pos.length && walkN(resolve(pos[0])) !== undefined ? srcOf(pos, s) : { err: true }; return rot(r.err ? (pos.join(' ') || (s == null ? '' : s)) : r.text, n); };
    C.binary = (a, s) => { const dec = a.includes('-d'); const pos = a.filter(x => !x.startsWith('-')); const txt = pos.join(' ') || (s == null ? '' : s); return dec ? unbin(txt) : binOf(txt); };
    C.url = (a, s) => { const dec = a.includes('-d'); const pos = a.filter(x => !x.startsWith('-')); const txt = pos.join(' ') || (s == null ? '' : s); return dec ? decodeURIComponent(txt.trim()) : encodeURIComponent(txt); };
    C.morse = (a, s) => { const dec = a.includes('-d'); const pos = a.filter(x => !x.startsWith('-')); const txt = pos.join(' ') || (s == null ? '' : s); return dec ? unMorse(txt) : morseOf(txt); };
    C.md5sum = (a, stdin) => Unix.checksum('md5', read)(a, stdin).out;
    C.sha256sum = (a, stdin) => Unix.checksum('sha256', read)(a, stdin).out;
    C.echo = a => (a[0] === '-n' ? a.slice(1) : a).join(' ');
    C['write-output'] = C.echo; C['write-host'] = C.echo;
    C.printf = a => { let fmt = String(a[0] || '').replace(/\\n/g, '\n').replace(/\\t/g, '\t'), idx = 1; return fmt.replace(/%[sdif]/g, () => String(a[idx++] ?? '')); };
    C.strings = (a, s) => { const r = srcOf(a.filter(x => !x.startsWith('-')), s); return r.err ? 'strings: ' + r.err : (r.text.match(/[\x20-\x7e]{4,}/g) || []).join('\n'); };
    C.sed = (a, s) => { const sc = a.find(x => !x.startsWith('-')) || '', m = sc.match(/^s(.)(.*?)\1(.*?)\1([gi]*)$/); if (!m) return 'sed: try s/old/new/g'; const r = srcOf(a.filter(x => x !== sc && !x.startsWith('-')), s); return r.err ? 'sed: ' + r.err : r.text.split('\n').map(l => l.replace(new RegExp(m[2], (m[4].includes('g') ? 'g' : '') + (m[4].includes('i') ? 'i' : '')), m[3])).join('\n'); };
    C.awk = (a, s) => { let sep = ' ', prog = '', files = []; for (let i = 0; i < a.length; i++) { if (a[i] === '-F') sep = a[++i] || ' '; else if (/^-F./.test(a[i])) sep = a[i].slice(2); else if (!prog && a[i].includes('{')) prog = a[i]; else if (!a[i].startsWith('-')) files.push(a[i]); } const m = prog.match(/\{[\s]*print\s+([^}]+)\}/); if (!m) return 'awk: try {print $1}'; const flds = m[1].split(',').map(x => x.trim()), r = srcOf(files, s); return r.err ? 'awk: ' + r.err : r.text.split('\n').map(l => { const p = sep === ' ' ? l.trim().split(/\s+/) : l.split(sep); return flds.map(f => f === '$0' ? l : /^\$\d+$/.test(f) ? (p[+f.slice(1) - 1] || '') : f.replace(/^"|"$/g, '')).join(' '); }).join('\n'); };
    C.tee = (a, s) => { const f = a.find(x => !x.startsWith('-')); if (f && s != null) writeF(f, s, a.includes('-a')); return s == null ? '' : s; };
    C.touch = a => { for (const f of a.filter(x => !x.startsWith('-'))) if (walkN(resolve(f)) === undefined) writeF(f, '', false); return ''; };
    C.mkdir = a => { for (const f of a.filter(x => !x.startsWith('-'))) { const parts = resolve(f); let n = tree; for (const p of parts) { if (!isDir(n[p])) n[p] = {}; n = n[p]; } } return ''; };
    C.rm = a => { for (const f of a.filter(x => !x.startsWith('-'))) { const parts = resolve(f), par = walkN(parts.slice(0, -1)); if (isDir(par)) delete par[parts[parts.length - 1]]; } return ''; };
    C.cp = a => { const f = a.filter(x => !x.startsWith('-')); const r = read(f[0] || ''); if (r.err) return 'cp: ' + r.err; writeF(f[1] || '', r.text, false); return ''; };
    C.mv = a => { const f = a.filter(x => !x.startsWith('-')); const r = read(f[0] || ''); if (r.err) return 'mv: ' + r.err; writeF(f[1] || '', r.text, false); C.rm([f[0]]); return ''; };
    C.diff = a => { const f = a.filter(x => !x.startsWith('-')); const r1 = read(f[0] || ''), r2 = read(f[1] || ''); if (r1.err || r2.err) return 'diff: ' + (r1.err || r2.err); return r1.text === r2.text ? '' : '--- ' + f[0] + '\n+++ ' + f[1] + '\n-' + r1.text + '\n+' + r2.text; };
    C.whoami = () => isWin ? 'PUZZLE\\solver' : 'solver';
    C.hostname = () => 'puzzle-lab';
    C.ver = () => 'Microsoft Windows [Version 10.0.22631]';
    C.uname = () => 'Linux puzzle-lab 6.6.0 x86_64 GNU/Linux';
    C.id = () => 'uid=1000(solver) gid=1000(solver)';
    C.env = () => 'USER=solver\nHOME=/\nPWD=' + C.pwd();
    C.clear = () => ''; C.cls = () => '';
    C.help = a => TP.formatHelp ? TP.formatHelp(shell, a) : 'Puzzle shell: ls, cd, pwd, cat, grep, find, tree, cut, tr, sort, uniq, wc, sed, awk, base64, xxd, rot13, rev, caesar';
    C.man = C.help;

    const listDir = dir => { const n = walkN(resolve(dir)); return isDir(n) ? Object.keys(n) : []; };
    const run = (raw, subDepth) => {
      const line = String(raw == null ? '' : raw).trim();
      if (!line) return '';
      const outs = [];
      for (let chain of splitTop(line, isWin ? ['&&', '&'] : [';', '&&', '||'])) {
        if (G.expandSub) chain = G.expandSub(chain, (inner, d2) => run(inner, d2), subDepth || 0);
        let redirect = null;
        const rm = chain.match(/(>>?)\s*(\S+)\s*$/);
        if (rm) { redirect = { append: rm[1] === '>>', file: rm[2] }; chain = chain.slice(0, rm.index).trim(); }
        let stdin = null, out = '';
        for (let seg of splitTop(chain, ['|'])) {
          const inM = seg.match(/\s<\s*(\S+)/);
          if (inM) { const rf = read(inM[1]); if (rf.err) { out = 'puzzle: ' + rf.err; break; } stdin = rf.text; seg = seg.replace(inM[0], ' ').trim(); }
          const words = G.expandShellWords ? G.expandShellWords(seg, listDir, isWin) : seg.split(/\s+/).filter(Boolean);
          if (!words.length) continue;
          const head = words.shift(), low = head.toLowerCase();
          const fn = C[head] || C[low];
          if (!fn) { out = 'puzzle: ' + head + ': command not found (try help)'; break; }
          try { out = String(fn(words, stdin, isWin ? undefined : error => outs.push(error)) ?? ''); }
          catch (e) { out = head + ': ' + (e && e.message || e); }
          stdin = out;
        }
        if (redirect) { writeF(redirect.file, out, redirect.append); out = ''; }
        if (out !== '') outs.push(out);
      }
      return outs.join('\n');
    };

    const defaultPalette = shell === 'powershell'
      ? [['Get-ChildItem -Force', 'list hidden items'], ['Get-ChildItem -Recurse', 'list tree'], ['Get-Content <file>', 'read file'], ['Select-String <pat> <file>', 'search text'], ['base64 -d', 'decode Base64'], ['xxd -r', 'decode Hex'], ['rot13', 'ROT13 decode'], ['rev', 'reverse text']]
      : shell === 'cmd'
        ? [['dir /a', 'list hidden items'], ['dir /s /b', 'recursive list'], ['type <file>', 'read file'], ['findstr <pat> <file>', 'search text'], ['base64 -d', 'decode Base64'], ['xxd -r', 'decode Hex'], ['rot13', 'ROT13 decode'], ['rev', 'reverse text']]
        : [['ls -la', 'list hidden files'], ['chmod u+r <file>', 'add owner read permission'], ['find . -name "*"', 'find all files'], ['tree -a', 'full hidden tree'], ['grep -rn <text> .', 'recursive search'], ['cut -d, -f5', 'extract CSV field'], ['tr -d "\\n"', 'join lines'], ['base64 -d', 'decode Base64'], ['xxd -r', 'decode Hex'], ['rot13', 'ROT13 decode'], ['rev', 'reverse text']];

    return {
      id: spec.id || ('puz-' + Date.now()),
      shell,
      difficulty: spec.difficulty || 'medium',
      category: spec.category || (spec.custom ? 'custom' : 'pipeline'),
      stages: spec.stages || 1,
      custom: !!spec.custom,
      files: filesMap,
      hints: spec.hints,
      seedCode: spec.seedCode || '',
      title: spec.title || 'Custom Puzzle',
      brief: spec.brief || 'Explore the puzzle files and solve for the hidden key.',
      hint: spec.hint || 'Start with ls -la or tree -a to inspect all files.',
      walkthrough: spec.walkthrough?.length ? spec.walkthrough : defaultPalette.slice(0, 2).map(([cmd]) => cmd),
      answer: String(spec.answer || '').trim(),
      prompt: () => isWin ? (shell === 'powershell' ? 'PS ' + C.pwd() + '> ' : C.pwd() + '>') : 'solver@puzzle:' + C.pwd() + '$ ',
      cwdPath: C.pwd,
      rootPath: isWin ? 'C:/puzzle' : '/',
      run,
      createRuntime: () => buildCustomFileRoom(spec),
      snapshot: () => ({ tree, cwd, prevCwd, modes: Unix.saveModes(tree, isDir) }),
      restore: state => {
        TP.replaceSavedObject(tree, state.tree);
        Unix.restoreModes(tree, state.modes);
        if (Array.isArray(state.cwd)) cwd.splice(0, cwd.length, ...state.cwd);
        prevCwd = Array.isArray(state.prevCwd) ? state.prevCwd : null;
      },
      cmds: C,
      palette: spec.palette || defaultPalette
    };
  }

  /* ================================================================ LAYERED FILE PUZZLES (Bash / PS / CMD) */

  /* 1. Vault Breadcrumb Chain: Medium (2 stages) / Hard (3 stages) / Insane (5 stages) */
  function makeBreadcrumbPuzzle(shell, diff, seed) {
    const r = L.rnd((seed ^ 0x3b7a91) >>> 0);
    const ans = L.newToken(r);
    const { put } = L.fs;
    const tree = {};
    const isInsane = diff === 'insane';
    const isHard = diff === 'hard';
    const layerCount = deepen(isInsane ? 4 : isHard ? 2 : 1);
    const chain = encodeChain(ans, pickLayers(r, layerCount));

    const realVaultNum = 20 + r(70);
    const realSector = pick(r, ['alpha', 'sigma', 'omega', 'delta', 'kappa']);
    const realDir = (isInsane ? 'opt/' : '') + '.vault-' + realVaultNum + '/sector-' + realSector;
    const realFile = realDir + '/manifest.csv';

    // Plant realistic decoy vaults
    const decoyCount = isInsane ? 5 : isHard ? 3 : 1;
    for (let d = 0; d < decoyCount; d++) {
      const dn = (realVaultNum + 7 + d * 11) % 95 + 10;
      const ds = pick(r, ['alpha', 'beta', 'gamma', 'delta', 'theta']);
      const baseD = (isInsane ? pick(r, ['opt/', 'srv/', 'var/']) : '') + '.vault-' + dn + '/sector-' + ds;
      const fakeRows = ['id,tier,region,status,payload'];
      for (let j = 0; j < 4; j++) fakeRows.push('REC-' + (100 + j) + ',omega,eu-west,ACTIVE,' + encodeChain(L.newToken(r), ['base64', 'hex']).encoded);
      put(tree, baseD + '/manifest.csv', fakeRows.join('\n'));
      put(tree, baseD + '/.clearance.rot', rot('tier=beta\nregion=us-east\ndecode=base64 -d\n(NOTE: archived decoy vault)', 13));
    }

    // Build real manifest.csv with decoys (REVOKED, EXPIRED, ROTATED, wrong tier/region)
    const tiers = ['omega', 'sigma', 'prime', 'zero'];
    const regions = ['eu-west', 'us-east', 'ap-south', 'ca-cent'];
    const wantTier = pick(r, tiers);
    const wantRegion = pick(r, regions);
    const totalManifest = isInsane ? 18 : isHard ? 12 : 6;
    const winM = 3 + r(totalManifest - 4);
    const mRows = ['id,tier,region,status,payload'];
    for (let i = 0; i < totalManifest; i++) {
      if (i === winM) {
        mRows.push('REC-' + (200 + i) + ',' + wantTier + ',' + wantRegion + ',ACTIVE,' + chain.encoded);
      } else {
        // Deliberately create tricky partial matches (same tier+ACTIVE wrong region, or same tier+region REVOKED)
        const mode = i % 3;
        const t2 = mode === 0 ? wantTier : pick(r, tiers.filter(x => x !== wantTier));
        const reg2 = mode === 1 ? wantRegion : pick(r, regions.filter(x => x !== wantRegion));
        const st2 = mode === 2 ? pick(r, ['REVOKED', 'EXPIRED', 'ROTATED']) : (t2 === wantTier && reg2 === wantRegion ? 'REVOKED' : pick(r, ['ACTIVE', 'REVOKED', 'EXPIRED']));
        mRows.push('REC-' + (200 + i) + ',' + t2 + ',' + reg2 + ',' + st2 + ',' + encodeChain(L.newToken(r), pickLayers(r, layerCount)).encoded);
      }
    }
    put(tree, realFile, mRows.join('\n'));

    // Secondary encoded clearance/policy file inside real vault (Insane) or etc/policy.conf (Hard/Medium)
    const clearancePath = isInsane ? realDir + '/.clearance.rot' : 'etc/policy.conf';
    const clearanceText = [
      '# Vault Extraction Policy',
      'required_status=ACTIVE',
      'required_tier=' + wantTier,
      'required_region=' + wantRegion,
      'decode_pipeline=' + chain.decodePipe
    ].join('\n');
    put(tree, clearancePath, isInsane ? rot(clearanceText, 13) : clearanceText);

    // Stage 1: var/log/ops.log containing encoded path pointer
    const ptrEnc = isInsane ? hexOf(realDir) : b64e(realDir);
    const ptrDecCmd = isInsane ? 'xxd -r' : 'base64 -d';
    const logLines = [];
    const totalLogs = isInsane ? 36 : isHard ? 24 : 12;
    const winLog = 4 + r(totalLogs - 6);
    for (let i = 0; i < totalLogs; i++) {
      if (i === winLog) {
        logLines.push('2026-02-12T06:' + String(10 + (i % 50)).padStart(2, '0') + ':14Z env=prod audit=VERIFIED node=vault-mgr ptr=' + ptrEnc);
      } else {
        const env = i % 4 === 0 ? 'prod' : pick(r, ['staging', 'dev', 'canary']);
        const aud = env === 'prod' ? pick(r, ['FAILED', 'REJECTED', 'PENDING', 'EXPIRED']) : pick(r, ['VERIFIED', 'FAILED', 'SKIPPED']);
        const fakePath = (isInsane ? 'opt/' : '') + '.vault-' + ((realVaultNum + 7 + (i % 3) * 11) % 95 + 10) + '/sector-alpha';
        logLines.push('2026-02-12T06:' + String(10 + (i % 50)).padStart(2, '0') + ':14Z env=' + env + ' audit=' + aud + ' node=vault-mgr ptr=' + (isInsane ? hexOf(fakePath) : b64e(fakePath)));
      }
    }
    put(tree, 'var/log/ops.log', logLines.join('\n'));
    put(tree, 'README.txt', [
      'OPERATION: VAULT BREADCRUMB (' + DIFFS[diff].label.toUpperCase() + ')',
      '1. Inspect var/log/ops.log — find the ONLY line with BOTH env=prod AND audit=VERIFIED.',
      ...(shell === 'bash' ? ['   Example: cat /var/log/ops.log | grep -i -n "env=prod audit=verified"'] : []),
      '2. Decode its ptr= value (' + (isInsane ? 'hex via xxd -r' : 'Base64 via base64 -d') + ') to locate the real hidden vault directory.',
      isInsane
        ? '3. Inside that hidden vault, list hidden files (ls -la) and ROT13-decode .clearance.rot to learn the required tier, region, and 4-layer decode pipeline.'
        : '3. Read etc/policy.conf to learn the required tier, region, and decode pipeline.',
      '4. Inside that vault, filter its own manifest.csv for the ACTIVE row that matches BOTH the policy tier and region.',
      '   The file lives in the vault (not the current directory), and its columns are comma-separated — filter one value at a time:',
      '   grep ACTIVE <vault>/manifest.csv | grep <tier> | grep <region>    (paths and words joined by spaces in one pattern match nothing)',
      '   Then extract column 5 and peel all ' + layerCount + ' encoding layer(s).'
    ].join('\n'));

    const finalCmd = 'grep ACTIVE ' + realFile + ' | grep ' + wantTier + ' | grep ' + wantRegion + ' | cut -d, -f5 | ' + chain.decodePipe;
    const walkthrough = [
      'grep "env=prod" var/log/ops.log | grep VERIFIED | cut -d= -f5 | ' + ptrDecCmd,
      isInsane ? 'cat ' + clearancePath + ' | rot13' : 'cat ' + clearancePath,
      finalCmd
    ];

    return buildCustomFileRoom({
      id: 'gen-bread-' + seed,
      shell,
      difficulty: diff,
      category: 'breadcrumb',
      stages: isInsane ? 5 : isHard ? 4 : 3,
      title: DIFFS[diff].label + ' · Vault Breadcrumb Chain (' + (isInsane ? '5 Stages' : isHard ? '4 Stages' : '3 Stages') + ')',
      brief: 'Start at README.txt and var/log/ops.log. Trace the verified prod pointer (' + (isInsane ? 'hex' : 'Base64') + ') to the true hidden vault among ' + decoyCount + ' decoy vault(s), ' +
        (isInsane ? 'ROT13-decode its hidden .clearance.rot policy, ' : 'check etc/policy.conf, ') +
        'filter that vault’s manifest.csv for the exact ACTIVE row (comma-separated: filter tier and region separately), and peel ' + layerCount + ' stacked layer(s) to recover the key.',
      hint: 'Step 1: ' + walkthrough[0] + '  →  Step 2: ' + walkthrough[1] + '  →  Step 3: filter manifest.csv & decode (' + chain.decodePipe + ')',
      walkthrough,
      answer: ans,
      files: treeToFlat(tree)
    });
  }

  /* 2. Corrupted Multi-Shard Gauntlet: Medium / Hard / Insane */
  function makeCorruptShardsPuzzle(shell, diff, seed) {
    const r = L.rnd((seed ^ 0x7c41e5) >>> 0);
    const ans = L.newToken(r);
    const { put } = L.fs;
    const tree = {};
    const isInsane = diff === 'insane';
    const isHard = diff === 'hard';
    const layerCount = deepen(isInsane ? 3 : isHard ? 2 : 1);
    const chain = encodeChain(ans, pickLayers(r, layerCount));
    const shardCount = isInsane || isHard ? 4 : 3;
    const parts = splitIntoParts(chain.encoded, shardCount);

    const locs = isInsane
      ? ['opt/.drop-' + (10 + r(80)) + '/k1.dat', 'srv/relay/.cache/k2.dat', 'var/spool/.s3.dat', 'lib/vault/.k4.dat']
      : isHard
        ? ['opt/drop/s1.dat', 'srv/cache/s2.dat', '.hidden/s3.dat', 'var/spool/s4.dat']
        : ['shards/part1.dat', 'shards/.part2.dat', 'shards/part3.dat'];
    const order = shuffle(locs.map((p, i) => ({ p, part: parts[i], idx: i })), r);
    const orderedPaths = [];
    for (let i = 0; i < shardCount; i++) {
      const item = order.find(x => x.idx === i);
      orderedPaths.push(item.p);
      if (isInsane) {
        // Multi-line shard file: only the REAL_CHUNK line is valid, others are noise!
        const lines = [];
        const winLine = 1 + r(4);
        for (let ln = 0; ln < 6; ln++) {
          if (ln === winLine) lines.push('REAL_CHUNK#seg' + (i + 1) + '#' + item.part);
          else lines.push(pick(r, ['NOISE_LINE', 'DECOY_CHUNK', 'STALE_DATA']) + '#seg' + (i + 1) + '#' + b64e(L.newToken(r)).slice(0, item.part.length + 2));
        }
        put(tree, item.p, lines.join('\n'));
      } else {
        put(tree, item.p, 'NOISE:' + item.part);
      }
    }

    // Plant decoy shards
    const decoys = isInsane ? 6 : isHard ? 4 : 2;
    for (let d = 0; d < decoys; d++) {
      const dp = pick(r, ['tmp/decoy', 'attic/old', 'backup/shard', 'opt/.drop-old/k']) + '-' + (d + 1) + '.dat';
      put(tree, dp, isInsane ? 'REAL_CHUNK#seg9#' + b64e(L.newToken(r)).slice(0, 10) : 'NOISE:' + b64e(L.newToken(r)).slice(0, 10));
    }

    // Build index/manifest chain
    const manifestPath = isInsane ? 'var/lib/.manifest.b64' : 'etc/index.b64';
    const manifestPlain = [
      '# Reassembly Order (1..' + shardCount + ')',
      'ORDER=' + orderedPaths.join(' '),
      isInsane ? 'LINE_FILTER=REAL_CHUNK' : 'PREFIX_DELIM=:',
      isInsane ? 'STRIP_CMD=cut -d# -f3' : 'STRIP_CMD=cut -d: -f2',
      'DECODE=' + chain.decodePipe
    ].join('\n');
    put(tree, manifestPath, b64e(manifestPlain));

    if (isInsane) {
      put(tree, 'etc/locator.hex', hexOf(manifestPath));
    }
    put(tree, 'README.txt', [
      'OPERATION: CORRUPTED SHARD ASSEMBLY (' + DIFFS[diff].label.toUpperCase() + ')',
      isInsane
        ? '1. Decode etc/locator.hex (xxd -r) to discover the hidden Base64 manifest path.'
        : '1. Decode etc/index.b64 (base64 -d) to see the shard assembly order & decode pipeline.',
      isInsane
        ? '2. Base64-decode that manifest to get the 4 hidden shard paths in exact order, the REAL_CHUNK line filter, and the 3-layer decode chain.'
        : '2. Read the shards in order, strip the noise prefix (cut -d: -f2), join lines (tr -d "\\n"), and decode.',
      isInsane
        ? '3. Extract REAL_CHUNK from each shard in order, strip fields with cut -d# -f3, join with tr -d "\\n", and peel all 3 layers.'
        : '3. Watch out for ' + decoys + ' decoy shards in tmp/ and attic/.'
    ].join('\n'));

    const finalCmd = isInsane
      ? 'cat ' + orderedPaths.join(' ') + ' | grep REAL_CHUNK | cut -d# -f3 | tr -d "\\n" | ' + chain.decodePipe
      : 'cat ' + orderedPaths.join(' ') + ' | cut -d: -f2 | tr -d "\\n" | ' + chain.decodePipe;
    const walkthrough = isInsane
      ? ['cat etc/locator.hex | xxd -r', 'cat ' + manifestPath + ' | base64 -d', finalCmd]
      : ['cat etc/index.b64 | base64 -d', finalCmd];

    return buildCustomFileRoom({
      id: 'gen-shards-' + seed,
      shell,
      difficulty: diff,
      category: 'corrupt_shards',
      stages: isInsane ? 5 : isHard ? 3 : 2,
      title: DIFFS[diff].label + ' · Corrupted ' + shardCount + '-Shard Assembly (' + (isInsane ? '5 Stages' : isHard ? '3 Stages' : '2 Stages') + ')',
      brief: 'The key was encoded through ' + layerCount + ' layer(s), split into ' + shardCount + ' noisy shards, and hidden among ' + decoys + ' decoys. ' +
        (isInsane ? 'Decode etc/locator.hex → hidden manifest (.b64) → filter REAL_CHUNK lines → strip # prefixes → join → decode!' : 'Decode etc/index.b64 to get the shard order, strip prefixes, join, and decode!'),
      hint: walkthrough[0] + '  →  then ' + (isInsane ? walkthrough[1] : finalCmd),
      walkthrough,
      answer: ans,
      files: treeToFlat(tree)
    });
  }

  /* 3. Multi-Log Exfil Forensics: Hard (3 stages) / Insane (5 stages) */
  function makeForensicCorrPuzzle(shell, diff, seed) {
    const r = L.rnd((seed ^ 0x91e2b3) >>> 0);
    const ans = L.newToken(r);
    const { put } = L.fs;
    const tree = {};
    const isInsane = diff === 'insane';
    const layerCount = deepen(isInsane ? 3 : 2);
    const chain = encodeChain(ans, pickLayers(r, layerCount));

    const badIp = '198.51.100.' + (20 + r(200));
    const decoyIp1 = '198.51.100.' + ((parseInt(badIp.split('.')[3], 10) + 17) % 240 + 10);
    const decoyIp2 = '203.0.113.' + (10 + r(200));
    const txid = 'EX-' + (1000 + r(8999));
    const decoyTx1 = 'EX-' + (1000 + r(8999));
    const decoyTx2 = 'EX-' + (1000 + r(8999));

    // Stage 1: var/log/auth.log
    const authRows = [];
    const totalAuth = isInsane ? 34 : 20;
    const winA = 4 + r(totalAuth - 6);
    for (let i = 0; i < totalAuth; i++) {
      if (i === winA) {
        authRows.push('2026-02-12T04:' + String(10 + (i % 48)).padStart(2, '0') + ':09Z ip=' + badIp + ' user=svc-ops event=MFA_BYPASS result=SESSION_ELEVATED');
      } else if (i === (winA + 3) % totalAuth) {
        // Tricky decoy: has MFA_BYPASS but result=BLOCKED!
        authRows.push('2026-02-12T04:' + String(10 + (i % 48)).padStart(2, '0') + ':09Z ip=' + decoyIp1 + ' user=admin event=MFA_BYPASS result=BLOCKED');
      } else {
        const ip = i % 3 === 0 ? decoyIp2 : '10.14.' + r(9) + '.' + (10 + r(220));
        authRows.push('2026-02-12T04:' + String(10 + (i % 48)).padStart(2, '0') + ':09Z ip=' + ip + ' user=' + pick(r, ['maya', 'dev', 'sam', 'nina', 'ops']) + ' event=' + pick(r, ['SSH_FAIL', 'LOGIN_OK', 'KEY_ROTATE', 'TOKEN_REFRESH']) + ' result=' + pick(r, ['OK', 'DENIED', 'BLOCKED']));
      }
    }
    put(tree, 'var/log/auth.log', authRows.join('\n'));

    if (isInsane) {
      // Stage 2: var/log/dns.log mapping badIp -> txid
      const dnsRows = [];
      const totalDns = 24;
      const winD = 3 + r(totalDns - 5);
      for (let i = 0; i < totalDns; i++) {
        if (i === winD) {
          dnsRows.push('2026-02-12T04:51:02Z src=' + badIp + ' qtype=TXT domain=drop.edge.internal txid=' + txid);
        } else {
          const ip = i % 3 === 0 ? decoyIp1 : '10.14.' + r(9) + '.' + (10 + r(220));
          const tx = i % 3 === 0 ? decoyTx1 : (i % 5 === 0 ? decoyTx2 : 'EX-' + (1000 + r(8999)));
          dnsRows.push('2026-02-12T04:' + String(10 + (i % 48)).padStart(2, '0') + ':22Z src=' + ip + ' qtype=' + pick(r, ['A', 'TXT', 'CNAME']) + ' domain=telemetry.internal txid=' + tx);
        }
      }
      put(tree, 'var/log/dns.log', dnsRows.join('\n'));

      // Stage 3: var/log/proxy.csv with 4 out-of-order 200 chunks for txid + 403/500 decoys
      const parts = splitIntoParts(chain.encoded, 4);
      const pRows = [];
      for (let k = 0; k < 4; k++) {
        pRows.push('2026-02-12T04:55:0' + k + 'Z,' + txid + ',seq=' + (k + 1) + ',200,' + parts[k]);
        // Decoy 403/500 rows for the SAME txid!
        pRows.push('2026-02-12T04:54:0' + k + 'Z,' + txid + ',seq=' + (k + 1) + ',' + pick(r, ['403', '500']) + ',' + b64e(L.newToken(r)).slice(0, 10));
      }
      for (let d = 0; d < 24; d++) {
        const dt = d % 2 === 0 ? decoyTx1 : decoyTx2;
        pRows.push('2026-02-12T04:' + String(10 + (d % 45)).padStart(2, '0') + ':11Z,' + dt + ',seq=' + ((d % 4) + 1) + ',200,' + b64e(L.newToken(r)).slice(0, 10));
      }
      put(tree, 'var/log/proxy.csv', 'ts,txid,seq,status,chunk\n' + shuffle(pRows, r).join('\n'));
      put(tree, 'README.txt', [
        'INCIDENT RESPONSE: EXFIL FORENSICS (INSANE · 5 STAGES)',
        '1. In var/log/auth.log, find the attacker IP that triggered BOTH MFA_BYPASS and SESSION_ELEVATED (ignore BLOCKED!).',
        '2. In var/log/dns.log, correlate that attacker IP to its exfiltration txid=.',
        '3. In var/log/proxy.csv, filter rows for that txid with HTTP status 200 (ignore 403/500).',
        '4. The 4 chunks are SHUFFLED out of order — sort by column 3 (seq=1..4), extract column 5, and join (tr -d "\\n").',
        '5. Peel the 3 stacked encoding layers: ' + chain.decodePipe
      ].join('\n'));

      const finalCmd = 'grep ' + txid + ' var/log/proxy.csv | grep ",200," | sort -t, -k3 | cut -d, -f5 | tr -d "\\n" | ' + chain.decodePipe;
      const walkthrough = [
        'grep MFA_BYPASS var/log/auth.log | grep SESSION_ELEVATED',
        'grep ' + badIp + ' var/log/dns.log',
        finalCmd
      ];
      return buildCustomFileRoom({
        id: 'gen-for-' + seed,
        shell,
        difficulty: diff,
        category: 'forensic_corr',
        stages: 5,
        title: 'Insane · Dual-Log Exfil Forensics (5 Stages)',
        brief: 'Correlate 3 logs: find the elevated MFA_BYPASS IP in var/log/auth.log → map it to a txid in var/log/dns.log → filter & sort the 4 shuffled 200 chunks in var/log/proxy.csv → join and peel 3 layers (' + chain.decodePipe + ').',
        hint: 'Stage 1: ' + walkthrough[0] + '  →  Stage 2: ' + walkthrough[1] + '  →  Stage 3: filter proxy.csv for ,200, then sort -t, -k3 | cut -d, -f5 | tr -d "\\n" | ' + chain.decodePipe,
        walkthrough,
        answer: ans,
        files: treeToFlat(tree)
      });
    }

    // Hard / Medium 2-log correlation (auth.log -> proxy.csv)
    const pRows = [];
    const totalP = 22;
    const winP = 3 + r(totalP - 5);
    for (let i = 0; i < totalP; i++) {
      if (i === winP) pRows.push('2026-02-12T04:55:10Z,' + badIp + ',200,' + chain.encoded);
      else if (i === (winP + 2) % totalP) pRows.push('2026-02-12T04:54:10Z,' + badIp + ',403,' + encodeChain(L.newToken(r), pickLayers(r, layerCount)).encoded);
      else pRows.push('2026-02-12T04:' + String(10 + i).padStart(2, '0') + ':10Z,' + (i % 3 === 0 ? decoyIp1 : decoyIp2) + ',200,' + encodeChain(L.newToken(r), pickLayers(r, layerCount)).encoded);
    }
    put(tree, 'var/log/proxy.csv', 'ts,ip,status,payload\n' + pRows.join('\n'));
    put(tree, 'README.txt', [
      'INCIDENT RESPONSE: LOG CORRELATION (' + DIFFS[diff].label.toUpperCase() + ' · 3 STAGES)',
      '1. Find the IP in var/log/auth.log with BOTH MFA_BYPASS and SESSION_ELEVATED.',
      '2. Filter var/log/proxy.csv for that IP and status 200.',
      '3. Extract column 4 and decode via: ' + chain.decodePipe
    ].join('\n'));
    const finalCmd = 'grep ' + badIp + ' var/log/proxy.csv | grep ",200," | cut -d, -f4 | ' + chain.decodePipe;
    return buildCustomFileRoom({
      id: 'gen-for-' + seed,
      shell,
      difficulty: diff,
      category: 'forensic_corr',
      stages: 3,
      title: DIFFS[diff].label + ' · Auth-to-Proxy Correlation (3 Stages)',
      brief: 'Find the attacker IP with MFA_BYPASS + SESSION_ELEVATED in var/log/auth.log, match its HTTP 200 row in var/log/proxy.csv, extract column 4, and peel ' + layerCount + ' layer(s) (' + chain.decodePipe + ').',
      hint: 'grep SESSION_ELEVATED var/log/auth.log  →  ' + finalCmd,
      walkthrough: ['grep MFA_BYPASS var/log/auth.log | grep SESSION_ELEVATED', finalCmd],
      answer: ans,
      files: treeToFlat(tree)
    });
  }

  /* 4. Multi-Stage Telemetry Pipeline (scales cleanly across Easy / Medium / Hard / Insane) */
  function makePipelinePuzzle(shell, diff, seed) {
    const dObj = DIFFS[diff] || DIFFS.medium;
    const r = L.rnd((seed ^ 0x51a7c3) >>> 0);
    const ans = L.newToken(r);
    const { put } = L.fs;
    const tree = {};
    const tierNum = { easy: 1, medium: 2, hard: 3, insane: 4 }[diff] || 2;
    const layerCount = deepen({ easy: 1, medium: 1, hard: 3, insane: 4 }[diff] || 2);
    const chain = encodeChain(ans, pickLayers(r, layerCount));

    const tag = pick(r, ['ALERT', 'CRITICAL', 'SEALED', 'OVERRIDE']);
    const env = pick(r, ['prod', 'vault-prod', 'core']);
    const svc = pick(r, ['auth', 'relay', 'vault', 'kms', 'edge']);
    const totalRows = 10 + tierNum * 9;
    const winIdx = 3 + r(totalRows - 5);
    const rows = ['timestamp,level,env,service,status,payload'];
    for (let i = 0; i < totalRows; i++) {
      if (i === winIdx) {
        rows.push('2026-02-12T06:' + String(10 + (i % 50)).padStart(2, '0') + ':00Z,' + tag + ',' + env + ',' + svc + ',ACTIVE,' + chain.encoded);
      } else {
        const trap = i % 4;
        const lvl = trap === 0 ? tag : pick(r, ['INFO', 'DEBUG', 'OK', 'WARN']);
        const e2 = trap === 1 ? env : pick(r, ['staging', 'dev', 'qa']);
        const s2 = trap === 2 ? svc : pick(r, ['auth', 'relay', 'vault', 'worker', 'api']);
        const st2 = (lvl === tag && e2 === env && s2 === svc) ? 'REVOKED' : pick(r, ['ACTIVE', 'REVOKED', 'EXPIRED']);
        rows.push('2026-02-12T06:' + String(10 + (i % 50)).padStart(2, '0') + ':00Z,' + lvl + ',' + e2 + ',' + s2 + ',' + st2 + ',' + encodeChain(L.newToken(r), pickLayers(r, layerCount)).encoded);
      }
    }
    put(tree, 'logs/stream.csv', rows.join('\n'));
    if (tierNum >= 4) {
      put(tree, 'etc/.filter.b64', b64e('level=' + tag + '\nenv=' + env + '\nservice=' + svc + '\nstatus=ACTIVE\ndecode=' + chain.decodePipe));
      put(tree, 'README.txt', 'INSANE PIPELINE GAUNTLET\n1. Find and Base64-decode the hidden filter spec under etc/ (ls -la etc).\n2. Filter logs/stream.csv for ALL 4 fields (level, env, service, status=ACTIVE), extract column 6, and peel all 4 layers.');
    } else {
      put(tree, 'README.txt', 'Pipeline challenge (' + dObj.label + ')\nFilter logs/stream.csv for level=' + tag + ', env=' + env + ', service=' + svc + ', status=ACTIVE.\nExtract column 6 and decode via: ' + chain.decodePipe);
    }

    const finalCmd = 'grep ' + tag + ' logs/stream.csv | grep ' + env + ' | grep ' + svc + ' | grep ACTIVE | cut -d, -f6 | ' + chain.decodePipe;
    const walkthrough = tierNum >= 4 ? ['ls -la etc', 'cat etc/.filter.b64 | base64 -d', finalCmd] : [finalCmd];

    return buildCustomFileRoom({
      id: 'gen-pipe-' + seed,
      shell,
      difficulty: diff,
      category: 'pipeline',
      stages: tierNum >= 4 ? 4 : tierNum >= 3 ? 3 : 2,
      title: dObj.label + ' · Telemetry Pipeline (' + layerCount + ' Layer' + (layerCount > 1 ? 's' : '') + ')',
      brief: tierNum >= 4
        ? 'Decode hidden etc/.filter.b64 to discover the exact 4 CSV filters, isolate the sole matching row in logs/stream.csv (' + totalRows + ' rows with traps), extract field 6, and peel 4 stacked layers.'
        : 'logs/stream.csv (' + totalRows + ' rows) contains traps. Isolate ' + tag + ' + ' + env + ' + ' + svc + ' + ACTIVE, extract field 6, and peel ' + layerCount + ' layer(s) (' + chain.decodePipe + ').',
      hint: walkthrough.join('  →  '),
      walkthrough,
      answer: ans,
      files: treeToFlat(tree)
    });
  }

  /* 5. Medium-tier upgrades for classic categories (hidden / grep / nested / assemble / encoded) */
  function makeMediumClassicPuzzle(shell, cat, seed) {
    const r = L.rnd((seed ^ 0x44ab12) >>> 0);
    const ans = L.newToken(r);
    const { put } = L.fs;
    const tree = {};
    const chain = encodeChain(ans, pickLayers(r, 1));

    if (cat === 'hidden') {
      const dir = '.' + pick(r, ['vault', 'stash', 'drop', 'enclave']) + '-' + (10 + r(80));
      const good = pick(r, ['prod', 'release', 'active']) + '.enc';
      put(tree, dir + '/' + good, chain.encoded);
      put(tree, dir + '/old.enc', b64e(L.newToken(r)));
      put(tree, dir + '/staging.enc', b64e(L.newToken(r)));
      put(tree, dir + '/.note', 'Use ' + good + ' and decode via: ' + chain.decodePipe);
      put(tree, 'README.txt', 'Find the hidden directory (ls -la), inspect its hidden .note, and decode the active .enc file.');
      const cmd = 'cat ' + dir + '/' + good + ' | ' + chain.decodePipe;
      return buildCustomFileRoom({
        id: 'gen-med-hid-' + seed, shell, difficulty: 'medium', category: 'hidden', stages: 2,
        title: 'Medium · Hidden Encoded Vault (2 Stages)',
        brief: 'A hidden directory holds 3 .enc files plus a hidden .note telling you which file is active and how to decode it (' + chain.labels[0] + ').',
        hint: 'ls -la  →  cat ' + dir + '/.note  →  ' + cmd,
        walkthrough: ['ls -la', 'cat ' + dir + '/.note', cmd],
        answer: ans, files: treeToFlat(tree)
      });
    }
    if (cat === 'nested') {
      const sec = pick(r, ['srv', 'opt', 'data']) + '/node-' + (10 + r(80)) + '/active';
      const file = sec + '/vault.enc';
      put(tree, file, chain.encoded);
      for (let i = 0; i < 4; i++) put(tree, pick(r, ['tmp', 'attic', 'opt/old', 'srv/backup']) + '/vault-' + i + '.enc', b64e(L.newToken(r)));
      put(tree, 'manifest.txt', 'Active node: ' + sec + '\nEncoding: ' + chain.decodePipe);
      const cmd = 'cat ' + file + ' | ' + chain.decodePipe;
      return buildCustomFileRoom({
        id: 'gen-med-nest-' + seed, shell, difficulty: 'medium', category: 'nested', stages: 2,
        title: 'Medium · Nested Encoded Vault (2 Stages)',
        brief: 'Read manifest.txt to find the active nested directory among 4 decoy .enc files, then decode the payload (' + chain.labels[0] + ').',
        hint: 'cat manifest.txt  →  ' + cmd,
        walkthrough: ['cat manifest.txt', 'find . -name "*.enc"', cmd],
        answer: ans, files: treeToFlat(tree)
      });
    }
    if (cat === 'encoded') {
      const chain2 = encodeChain(ans, pickLayers(r, 2));
      put(tree, 'vault/sealed.dat', chain2.encoded);
      put(tree, 'README.txt', 'vault/sealed.dat is wrapped in 2 stacked layers: ' + chain2.labels.join(' → ') + '.\nPipe them together with | to recover the key.');
      const cmd = 'cat vault/sealed.dat | ' + chain2.decodePipe;
      return buildCustomFileRoom({
        id: 'gen-med-enc-' + seed, shell, difficulty: 'medium', category: 'encoded', stages: 2,
        title: 'Medium · Double-Layered Secret (2 Layers)',
        brief: 'vault/sealed.dat is wrapped in 2 stacked encoding layers (' + chain2.labels.join(' → ') + '). Decode both layers in a pipeline.',
        hint: cmd,
        walkthrough: ['cat README.txt', cmd],
        answer: ans, files: treeToFlat(tree)
      });
    }
    if (cat === 'assemble') {
      return makeCorruptShardsPuzzle(shell, 'medium', seed);
    }
    return makePipelinePuzzle(shell, 'medium', seed);
  }

  /* ================================================================ SCALED NON-FILE PUZZLES */

  /* CRYPTO: Easy=1, Medium=2, Hard=4, Insane=6 layers + `inspect` helper */
  function makeCryptoPuzzle(diff, seed) {
    const r = L.rnd((seed ^ 0x61c886) >>> 0);
    const ans = L.newToken(r);
    const layerCount = deepen({ easy: 1, medium: 2, hard: 4, insane: 6 }[diff] || 2);
    const chain = encodeChain(ans, pickLayers(r, layerCount));
    const files = {
      'artifact.txt': chain.encoded,
      'README.txt': 'Crypto Vault (' + DIFFS[diff].label + ' · ' + layerCount + ' layers)\nUse `file artifact.txt` to identify the outer layer, `inspect <text>` to fingerprint intermediate strings, and chain decoders with `|`!'
    };
    const guessLayer = txt => {
      const t = String(txt || '').trim();
      if (/^[0-9a-f]{16,}$/i.test(t) && t.length % 2 === 0) return 'looks like Hex (try: hex -d or xxd -r)';
      if (/%[0-9A-Fa-f]{2}/.test(t)) return 'looks like URL percent-encoding (try: url -d)';
      if (/^[A-Za-z0-9+/]+={0,2}$/.test(t) && t.length >= 8 && t.length % 4 === 0) return 'looks like Base64 (try: base64 -d)';
      if (/^[01 ]{16,}$/.test(t)) return 'looks like Binary (try: binary -d)';
      return 'looks like text/cipher (try: rev, rot13, or caesar -7)';
    };
    const C = {};
    C.ls = () => Object.keys(files).join('  ');
    C.cat = a => files[a[0]] == null ? 'cat: ' + (a[0] || '') + ': No such file' : files[a[0]];
    C.file = a => {
      if (files[a[0]] == null) return 'file: ' + (a[0] || '') + ': No such file';
      if (diff === 'easy' || diff === 'medium') {
        return a[0] + ': ' + layerCount + ' layer(s) — decode order: ' + chain.decodeCmds.join(' → ');
      }
      return a[0] + ': ' + layerCount + ' stacked layers · outer layer is ' + chain.labels[0] + ' (' + chain.decodeCmds[0] + '). Peel it, then run `inspect <result>` or keep piping!';
    };
    C.inspect = (a, s) => { const t = a.join(' ') || s || ''; return 'inspect: ' + guessLayer(t); };
    const grab = (a, s) => { const x = a.filter(v => !/^-d$|^--decode$|^-r$/.test(v)).join(' '); return x || (s == null ? '' : s); };
    C.base64 = (a, s) => { const t = grab(a, s); return (a.includes('-d') || a.includes('--decode')) ? (() => { try { return b64d(t); } catch (e) { return 'base64: invalid input'; } })() : b64e(t); };
    C.hex = (a, s) => { const t = grab(a, s); return (a.includes('-d') || a.includes('-r')) ? unhex(t) : hexOf(t); };
    C.xxd = C.hex;
    C.rot13 = (a, s) => rot(grab(a, s), 13);
    C.rev = (a, s) => revStr(grab(a, s));
    C.reverse = C.rev;
    C.caesar = (a, s) => { const hasN = /^-?\d+$/.test(a[0] || ''); const n = hasN ? parseInt(a[0], 10) : -7; const txt = (hasN ? a.slice(1).join(' ') : grab(a, s)) || (s == null ? '' : s); return rot(txt, n); };
    C.url = (a, s) => { const t = grab(a, s); return a.includes('-d') ? (() => { try { return decodeURIComponent(t.trim()); } catch (e) { return t; } })() : encodeURIComponent(t); };
    C.binary = (a, s) => { const t = grab(a, s); return a.includes('-d') ? unbin(t) : binOf(t); };
    C.morse = (a, s) => { const t = grab(a, s); return a.includes('-d') ? unMorse(t) : morseOf(t); };
    C.echo = (a, s) => grab(a, s);
    C.len = (a, s) => String(grab(a, s).length);
    C.help = a => TP.formatHelp ? TP.formatHelp('crypto', a) : 'Encoding commands: file, inspect, cat, base64, hex, xxd, rot13, rev, caesar, url, binary, morse';
    const run = raw => {
      const segs = String(raw || '').split('|').map(x => x.trim()).filter(Boolean);
      let stdin = null, out = '';
      for (const seg of segs) {
        const w = (TP.argv ? TP.argv(seg) : seg.split(/\s+/).filter(Boolean));
        if (!w.length) continue;
        const head = w.shift().toLowerCase();
        if (!C[head]) return 'vault: ' + head + ': unknown command (try help)';
        out = String(C[head](w, stdin) ?? '');
        stdin = out;
      }
      return out;
    };
    const fullPipe = 'cat artifact.txt | ' + chain.decodePipe;
    return {
      id: 'gen-crypto-' + seed, shell: 'crypto', difficulty: diff, category: 'chain', stages: layerCount,
      title: DIFFS[diff].label + ' · ' + layerCount + '-Layer Encoding Vault',
      brief: 'artifact.txt is wrapped in ' + layerCount + ' stacked encoding layer' + (layerCount > 1 ? 's' : '') + '. Use `file artifact.txt` and `inspect` to identify each layer, then chain decoders with `|` to recover the key.',
      hint: 'Full decode order: ' + chain.decodeCmds.join(' → ') + '   (pipe: ' + fullPipe + ')',
      walkthrough: ['file artifact.txt', fullPipe],
      answer: ans,
      prompt: () => 'vault:' + diff + '$ ',
      run, cmds: C,
      palette: [['file artifact.txt', 'check outer layer'], ['cat artifact.txt', 'read artifact'], ['inspect <text>', 'identify encoding'], ['base64 -d', 'decode Base64'], ['xxd -r', 'decode Hex'], ['rot13', 'ROT13'], ['rev', 'reverse'], ['caesar -7', 'undo Caesar +7'], ['url -d', 'URL decode']]
    };
  }

  /* SQL: Hard & Insane multi-table JOIN + multi-condition WHERE */
  function makeSqlJoinPuzzle(diff, seed) {
    const r = L.rnd((seed ^ 0x2f6e2b) >>> 0);
    const isInsane = diff === 'insane';
    const depts = [
      [1, 'security', 'eu-west'],
      [2, 'platform', 'us-east'],
      [3, 'infra', 'eu-west'],
      [4, 'data', 'ap-south']
    ];
    const names = ['maya', 'dev', 'sam', 'nina', 'alex', 'ravi', 'jo', 'kim', 'liam', 'zara'];
    const roles = ['admin', 'engineer', 'analyst', 'ops'];
    const accounts = [];
    for (let i = 1; i <= (isInsane ? 16 : 12); i++) {
      accounts.push([i, pick(r, names) + i, pick(r, roles), 1 + r(depts.length), r(4) ? 1 : 0]);
    }
    const orders = [];
    for (let i = 1; i <= (isInsane ? 36 : 24); i++) {
      orders.push([1000 + i, 1 + r(accounts.length), 30 + r(550), pick(r, ['paid', 'pending', 'refunded'])]);
    }
    // Guarantee at least 2 matching rows so answer is always non-zero and interesting
    const wantRole = pick(r, roles);
    const wantStatus = pick(r, ['paid', 'pending']);
    const wantDept = isInsane ? pick(r, depts)[1] : null;
    const minTotal = isInsane ? 120 + r(120) : 80 + r(100);
    // Seed 2 guaranteed matching accounts/orders
    const deptId = wantDept ? depts.find(d => d[1] === wantDept)[0] : 1;
    accounts[0][2] = wantRole; accounts[0][3] = deptId; accounts[0][4] = 1;
    orders[0][1] = 1; orders[0][2] = minTotal + 75; orders[0][3] = wantStatus;
    orders[1][1] = 1; orders[1][2] = minTotal + 140; orders[1][3] = wantStatus;

    const db = {
      departments: { cols: ['id', 'dept_name', 'region'], rows: depts },
      accounts: { cols: ['id', 'name', 'role', 'dept_id', 'active'], rows: accounts },
      orders: { cols: ['id', 'account_id', 'total', 'status'], rows: orders }
    };

    const deptMap = Object.fromEntries(depts.map(d => [d[0], d]));
    const acctMap = Object.fromEntries(accounts.map(a => [a[0], a]));
    const matched = orders.filter(o => {
      const a = acctMap[o[1]];
      const dp = deptMap[a[3]];
      if (!a || !dp) return false;
      if (o[3] !== wantStatus || o[2] < minTotal) return false;
      if (a[2] !== wantRole || a[4] !== 1) return false;
      if (isInsane && dp[1] !== wantDept) return false;
      return true;
    });
    const answer = String(matched.reduce((s, o) => s + o[2], 0));
    const query = isInsane
      ? "SELECT SUM(orders.total) FROM orders INNER JOIN accounts ON orders.account_id = accounts.id INNER JOIN departments ON accounts.dept_id = departments.id WHERE accounts.active = 1 AND accounts.role = '" + wantRole + "' AND departments.dept_name = '" + wantDept + "' AND orders.status = '" + wantStatus + "' AND orders.total >= " + minTotal + ";"
      : "SELECT SUM(orders.total) FROM orders INNER JOIN accounts ON orders.account_id = accounts.id WHERE accounts.active = 1 AND accounts.role = '" + wantRole + "' AND orders.status = '" + wantStatus + "' AND orders.total >= " + minTotal + ";";

    const lit = s => { s = String(s).trim(); if (/^['"].*['"]$/.test(s)) return s.slice(1, -1); if (/^-?\d+(\.\d+)?$/.test(s)) return +s; return s; };
    const C = {};
    C.tables = () => Object.keys(db).join('\n');
    C.describe = a => db[(a[0] || '').toLowerCase()] ? db[a[0].toLowerCase()].cols.join(' | ') : 'unknown table';
    C.ls = () => 'schema.sql  warehouse.db';
    C.cat = a => a[0] === 'schema.sql'
      ? 'CREATE TABLE departments (id INT, dept_name TEXT, region TEXT);\nCREATE TABLE accounts (id INT, name TEXT, role TEXT, dept_id INT, active INT);\nCREATE TABLE orders (id INT, account_id INT, total INT, status TEXT);'
      : 'cat: ' + (a[0] || '') + ': No such file';
    C.help = a => TP.formatHelp ? TP.formatHelp('sql', a) : 'SQL: SELECT ... FROM t1 INNER JOIN t2 ON ... WHERE ...';

    function run(raw) {
      let q = String(raw || '').trim().replace(/;\s*$/, '');
      const w = q.split(/\s+/);
      if (C[w[0].toLowerCase()]) return C[w[0].toLowerCase()](w.slice(1));
      if (/^(show tables|\\dt)$/i.test(q)) return C.tables();
      const sm = q.match(/^select\s+([\s\S]+?)\s+from\s+(\w+)([\s\S]*)$/i);
      if (!sm) return 'ERROR: expected SELECT ... FROM <table> [INNER JOIN ...] [WHERE ...]';
      const selStr = sm[1].trim(), baseName = sm[2].toLowerCase();
      let rest = sm[3] || '';
      if (!db[baseName]) return 'ERROR: relation "' + baseName + '" does not exist';

      // Build joined row objects with both qualified (t.col) and unqualified (col) keys
      let joined = db[baseName].rows.map(row => {
        const o = {};
        db[baseName].cols.forEach((c, i) => { o[baseName + '.' + c] = row[i]; o[c] = row[i]; });
        return o;
      });
      const colNames = db[baseName].cols.map(c => baseName + '.' + c);

      // Process any number of JOIN clauses
      const joinRe = /\b(?:inner\s+|left\s+)?join\s+(\w+)\s+on\s+([\w.]+)\s*=\s*([\w.]+)/ig;
      let jm;
      while ((jm = joinRe.exec(rest)) !== null) {
        const jName = jm[1].toLowerCase(), lk = jm[2], rk = jm[3];
        if (!db[jName]) return 'ERROR: relation "' + jName + '" does not exist';
        db[jName].cols.forEach(c => colNames.push(jName + '.' + c));
        const next = [];
        for (const leftObj of joined) {
          for (const rRow of db[jName].rows) {
            const rightObj = {};
            db[jName].cols.forEach((c, i) => { rightObj[jName + '.' + c] = rRow[i]; rightObj[c] = rRow[i]; });
            const merged = Object.assign({}, leftObj, rightObj);
            const lv = leftObj[lk] !== undefined ? leftObj[lk] : rightObj[lk];
            const rv = rightObj[rk] !== undefined ? rightObj[rk] : leftObj[rk];
            if (String(lv) === String(rv)) next.push(merged);
          }
        }
        joined = next;
      }

      // WHERE
      const wm = rest.match(/\bwhere\b([\s\S]*?)(?=\border\s+by\b|\blimit\b|$)/i);
      if (wm) {
        for (const cond of wm[1].split(/\s+and\s+/i)) {
          const cm = cond.match(/^\s*([\w.]+)\s*(=|==|!=|<>|>=|<=|>|<|like)\s*(.+?)\s*$/i);
          if (!cm) continue;
          const col = cm[1], op = cm[2].toLowerCase(), v = lit(cm[3]);
          joined = joined.filter(row => {
            const x = row[col];
            if (x === undefined) return false;
            if (op === '=' || op === '==') return String(x) === String(v);
            if (op === '!=' || op === '<>') return String(x) !== String(v);
            if (op === '>') return x > v; if (op === '<') return x < v; if (op === '>=') return x >= v; if (op === '<=') return x <= v;
            return new RegExp('^' + String(v).replace(/%/g, '.*') + '$', 'i').test(String(x));
          });
        }
      }

      // Aggregate SELECT?
      const ag = selStr.match(/^(sum|count|avg|min|max)\s*\(\s*(\*|[\w.]+)\s*\)$/i);
      if (ag) {
        const fn = ag[1].toLowerCase(), col = ag[2];
        if (fn === 'count') return String(joined.length);
        const vals = joined.map(r2 => r2[col]).filter(v => typeof v === 'number');
        if (!vals.length) return '0';
        const sum = vals.reduce((a, b) => a + b, 0);
        if (fn === 'sum') return String(sum);
        if (fn === 'avg') return String(Math.round((sum / vals.length) * 100) / 100);
        if (fn === 'min') return String(Math.min(...vals));
        return String(Math.max(...vals));
      }

      // Regular projection
      const lm = rest.match(/\blimit\s+(\d+)/i);
      if (lm) joined = joined.slice(0, parseInt(lm[1], 10));
      const wantCols = selStr === '*' ? colNames : selStr.split(',').map(x => x.trim());
      return [wantCols.join(' | '), wantCols.map(() => '---').join('-+-')]
        .concat(joined.map(row => wantCols.map(c => row[c] == null ? '' : row[c]).join(' | '))).join('\n') + '\n(' + joined.length + ' rows)';
    }

    return {
      id: 'gen-sql-' + seed, shell: 'sql', difficulty: diff, category: 'join', stages: isInsane ? 4 : 3,
      title: DIFFS[diff].label + ' · ' + (isInsane ? '3-Table JOIN' : '2-Table JOIN') + ' Analytics',
      brief: isInsane
        ? 'Join orders, accounts, and departments. Find the SUM of orders.total for active accounts (active = 1) with role \'' + wantRole + '\' in department \'' + wantDept + '\' where status = \'' + wantStatus + '\' and total >= ' + minTotal + '.'
        : 'Join orders and accounts. Find the SUM of orders.total for active accounts (active = 1) with role \'' + wantRole + '\' where status = \'' + wantStatus + '\' and total >= ' + minTotal + '.',
      hint: query,
      walkthrough: ['cat schema.sql', query],
      answer,
      prompt: () => 'sql:' + diff + '> ',
      run, cmds: C,
      palette: [['cat schema.sql', 'inspect all 3 tables'], ['tables', 'list tables'], ['SELECT * FROM departments;', 'view departments'], ['SELECT * FROM accounts LIMIT 5;', 'sample accounts'], [query, 'solution template']]
    };
  }

  /* PYTHON / NODE: Hard & Insane multi-step 2-file weighted/filtered computations */
  function makeCodePuzzle(shell, diff, seed) {
    const r = L.rnd((seed ^ 0x85ebca) >>> 0);
    const isInsane = diff === 'insane';
    const len = isInsane ? 16 : 12;
    const data = Array.from({ length: len }, () => 10 + r(85));
    const weights = Array.from({ length: len }, () => 2 + r(15));
    const thresh = 35 + r(25);
    // Guarantee >= 2 elements match
    data[0] = thresh + (thresh % 2 === 0 ? 4 : 5);
    data[1] = thresh + (thresh % 2 === 0 ? 10 : 11);

    let total = 0;
    for (let i = 0; i < len; i++) {
      if (isInsane) {
        if (data[i] > thresh && data[i] % 2 === 0) total += data[i] * weights[i];
      } else {
        if (data[i] > thresh) total += data[i] * weights[i];
      }
    }
    const answer = isInsane ? total.toString(16) : String(total);

    if (shell === 'python') {
      const expr = isInsane
        ? 'hex(sum([d * w for d, w in zip(read(), read2()) if d > ' + thresh + ' and d % 2 == 0]))[2:]'
        : 'sum([d * w for d, w in zip(read(), read2()) if d > ' + thresh + '])';
      const files = { 'data.txt': data.join('\n'), 'weights.txt': weights.join('\n'), 'README.txt': 'read() -> data.txt, read2() -> weights.txt. zip(), sum(), hex() are built in.' };
      const vars = {};
      const H = {
        len: x => x.length, sum: a => a.reduce((x, y) => x + y, 0), min: a => Math.min(...a), max: a => Math.max(...a),
        abs: Math.abs, sorted: a => a.slice().sort((x, y) => x - y),
        hex: n => '0x' + Math.trunc(n).toString(16),
        zip: (a, b) => a.slice(0, Math.min(a.length, b.length)).map((v, i) => [v, b[i]]),
        int: x => parseInt(x, 10), str: x => String(x), list: x => Array.from(x || []),
        read: () => data.slice(), read2: () => weights.slice()
      };
      const C = {
        ls: () => Object.keys(files).join('  '),
        cat: a => files[a[0]] == null ? 'cat: ' + (a[0] || '') + ': No such file' : files[a[0]],
        help: a => TP.formatHelp ? TP.formatHelp('python', a) : 'Python puzzle: read(), read2(), zip(), sum(), hex()'
      };
      const ev = s => {
        let js = String(s).replace(/\bTrue\b/g, 'true').replace(/\bFalse\b/g, 'false').replace(/\bNone\b/g, 'null').replace(/\band\b/g, '&&').replace(/\bor\b/g, '||').replace(/\bnot\b/g, '!');
        // Support tuple unpacking comprehension: [e for a, b in it if cond]
        js = js.replace(/\[([^[\]]+?)\s+for\s+(\w+)\s*,\s*(\w+)\s+in\s+([^[\]]+?)\s+if\s+([^[\]]+?)\]/g, (m, e, v1, v2, it, cond) => '(' + it + ').filter(function(_p){var ' + v1 + '=_p[0],' + v2 + '=_p[1];return ' + cond + ';}).map(function(_p){var ' + v1 + '=_p[0],' + v2 + '=_p[1];return ' + e + ';})');
        js = js.replace(/\[([^[\]]+?)\s+for\s+(\w+)\s*,\s*(\w+)\s+in\s+([^[\]]+?)\]/g, (m, e, v1, v2, it) => '(' + it + ').map(function(_p){var ' + v1 + '=_p[0],' + v2 + '=_p[1];return ' + e + ';})');
        js = js.replace(/\[([^[\]]+?)\s+for\s+(\w+)\s+in\s+([^[\]]+?)\s+if\s+([^[\]]+?)\]/g, (m, e, v, it, cond) => '(' + it + ').filter(function(' + v + '){return ' + cond + ';}).map(function(' + v + '){return ' + e + ';})');
        js = js.replace(/\[([^[\]]+?)\s+for\s+(\w+)\s+in\s+([^[\]]+?)\]/g, (m, e, v, it) => '(' + it + ').map(function(' + v + '){return ' + e + ';})');
        // Python [2:] slice at end
        js = js.replace(/\[(\d+):\]/g, '.slice($1)');
        const env = Object.assign({}, H, vars);
        const names = Object.keys(env);
        return new Function(...names, 'return (' + js + ');')(...names.map(k => env[k]));
      };
      const run = raw => {
        const s = String(raw || '').trim();
        const w = s.split(/\s+/);
        if (C[w[0]]) return C[w[0]](w.slice(1));
        try {
          const asg = s.match(/^([A-Za-z_]\w*)\s*=\s*([\s\S]+)$/);
          if (asg && !s.startsWith(asg[1] + ' ==')) { vars[asg[1]] = ev(asg[2]); return String(vars[asg[1]]); }
          const pr = s.match(/^print\s*\(([\s\S]*)\)$/);
          return String(ev(pr ? pr[1] : s));
        } catch (e) { return 'Error: ' + (e && e.message || e); }
      };
      return {
        id: 'gen-py-' + seed, shell: 'python', difficulty: diff, category: 'weighted', stages: isInsane ? 3 : 2,
        title: DIFFS[diff].label + ' · Two-File Weighted ' + (isInsane ? 'Hex Checksum' : 'Dot Product'),
        brief: isInsane
          ? 'Pair data.txt (`read()`) with weights.txt (`read2()`). Keep only pairs where data > ' + thresh + ' AND data is even, sum (d * w), and convert to lowercase hex (without 0x prefix).'
          : 'Pair data.txt (`read()`) with weights.txt (`read2()`). Keep only pairs where data > ' + thresh + ' and compute the weighted sum (d * w).',
        hint: expr, walkthrough: ['cat README.txt', expr], answer,
        prompt: () => '>>> ', run, cmds: C,
        snapshot: () => TP.snapshotVariables(vars),
        restore: state => TP.replaceSavedObject(vars, state),
        palette: [['read()', 'data.txt list'], ['read2()', 'weights.txt list'], ['zip(read(), read2())', 'pair both files'], ['hex(255)[2:]', 'hex without 0x']]
      };
    }

    // Node.js Hard / Insane
    const expr = isInsane
      ? 'read().reduce((s, d, i) => (d > ' + thresh + ' && d % 2 === 0) ? s + d * read2()[i] : s, 0).toString(16)'
      : 'read().reduce((s, d, i) => d > ' + thresh + ' ? s + d * read2()[i] : s, 0)';
    const files = { 'data.json': JSON.stringify(data), 'weights.json': JSON.stringify(weights), 'README.txt': 'read() -> data.json array, read2() -> weights.json array.' };
    const nVars = {};
    const C = {
      ls: () => Object.keys(files).join('  '),
      cat: a => files[a[0]] == null ? 'cat: ' + (a[0] || '') + ': No such file' : files[a[0]],
      help: a => TP.formatHelp ? TP.formatHelp('node', a) : 'Node puzzle: read(), read2(), map, filter, reduce, toString(16)'
    };
    const run = raw => {
      const s = String(raw || '').trim();
      const w = s.split(/\s+/);
      if (C[w[0]]) return C[w[0]](w.slice(1));
      try {
        const env = Object.assign({ read: () => data.slice(), read2: () => weights.slice() }, nVars);
        const names = Object.keys(env);
        const decl = s.match(/^(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*([\s\S]+)$/);
        const code = (decl ? decl[2] : s).replace(/;\s*$/, '');
        const res = new Function(...names, 'Math', 'JSON', 'return (' + code + ');')(...names.map(k => env[k]), Math, JSON);
        if (decl) nVars[decl[1]] = res;
        return typeof res === 'string' ? res : JSON.stringify(res);
      } catch (e) { return 'Error: ' + (e && e.message || e); }
    };
    return {
      id: 'gen-node-' + seed, shell: 'node', difficulty: diff, category: 'weighted', stages: isInsane ? 3 : 2,
      title: DIFFS[diff].label + ' · Two-File Weighted ' + (isInsane ? 'Hex Checksum' : 'Dot Product'),
      brief: isInsane
        ? 'Pair data.json (`read()`) with weights.json (`read2()`). Keep only indices where data[i] > ' + thresh + ' AND even, sum (data[i] * weights[i]), and format with `.toString(16)`.'
        : 'Pair data.json (`read()`) with weights.json (`read2()`). Keep only indices where data[i] > ' + thresh + ' and compute the weighted sum.',
      hint: expr, walkthrough: ['cat README.txt', expr], answer,
      prompt: () => '> ', run, cmds: C,
      snapshot: () => TP.snapshotVariables(nVars),
      restore: state => TP.replaceSavedObject(nVars, state),
      palette: [['read()', 'data.json array'], ['read2()', 'weights.json array'], ['cat README.txt', 'room notes']]
    };
  }

  /* GIT: Hard (18 commits + 2-layer encoded diff) / Insane (28 commits + revert traps + 3-layer encoded diff) */
  function makeGitHardPuzzle(diff, seed) {
    const r = L.rnd((seed ^ 0x1b8735) >>> 0);
    const isInsane = diff === 'insane';
    const ans = L.newToken(r);
    const layerCount = deepen(isInsane ? 3 : 2);
    const chain = encodeChain(ans, pickLayers(r, layerCount));
    const authors = ['maya', 'dev', 'sam', 'nina', 'ravi'];
    const targetAuthor = pick(r, authors);
    const count = isInsane ? 28 : 18;
    const commits = [];
    let hc = 0;
    const mkHash = () => (0xb2000 + (++hc) * 7919).toString(16).padStart(7, '0');
    const winIdx = Math.floor(count * 0.42);
    const msgs = ['fix retry backoff', 'bump alpine image', 'rotate staging token (decoy)', 'revert "rotate staging token"', 'refactor metrics', 'patch TLS cipher list', 'add circuit breaker', 'update helm chart'];

    for (let i = 0; i < count; i++) {
      if (i === winIdx) {
        commits.push({
          hash: mkHash(), author: targetAuthor, msg: 'seal prod vault token [verified]',
          lines: ['- PROD_SEALED_KEY=unset', '+ PROD_SEALED_KEY=' + chain.encoded]
        });
      } else {
        const a = i === winIdx + 2 ? targetAuthor : pick(r, authors);
        const m = i === winIdx + 2 ? 'rotate staging token (revoked)' : pick(r, msgs) + ' #' + (i + 1);
        commits.push({
          hash: mkHash(), author: a, msg: m,
          lines: ['- PROD_SEALED_KEY=old', '+ PROD_SEALED_KEY=' + encodeChain(L.newToken(r), pickLayers(r, layerCount)).encoded]
        });
      }
    }
    const target = commits[winIdx];
    const C = {
      ls: () => 'app.js  config.yml  README.md',
      cat: a => a[0] === 'README.md'
        ? 'Git Forensics (' + DIFFS[diff].label + ')\nFind the verified commit by ' + targetAuthor + ' (ignore revoked/decoy commits!).\nDecode PROD_SEALED_KEY via: ' + chain.decodePipe
        : 'cat: ' + (a[0] || '') + ': No such file',
      help: a => TP.formatHelp ? TP.formatHelp('git', a) : 'Git: git log, git show, git grep, plus pipes to grep/cut/base64/xxd/rot13/rev'
    };
    const runSingle = raw => {
      const line = String(raw || '').trim();
      const w = line.split(/\s+/);
      if (C[w[0]]) return C[w[0]](w.slice(1));
      if (w[0] !== 'git') return applyDecodePipeSegment(line, '');
      const sub = w[1], rest = w.slice(2).join(' ');
      if (sub === 'log') {
        let list = commits.slice().reverse();
        const am = rest.match(/--author=([^\s]+)/); if (am) list = list.filter(c => c.author === am[1]);
        const gm = rest.match(/--grep=([^\s]+)/); if (gm) list = list.filter(c => c.msg.toLowerCase().includes(gm[1].replace(/["']/g, '').toLowerCase()));
        if (!list.length) return 'fatal: no commits matched';
        return rest.includes('--oneline') ? list.map(c => c.hash + ' ' + c.msg).join('\n') : list.map(c => 'commit ' + c.hash + '\nAuthor: ' + c.author + '\n\n    ' + c.msg).join('\n\n');
      }
      if (sub === 'show') {
        const h = w[2] || '';
        const c = commits.find(x => x.hash === h || x.hash.startsWith(h));
        if (!c) return "fatal: unknown revision '" + h + "'";
        return 'commit ' + c.hash + '\nAuthor: ' + c.author + '\n    ' + c.msg + '\n' + c.lines.join('\n');
      }
      if (sub === 'grep') return commits.filter(c => c.lines.join(' ').includes(w[2] || '')).map(c => c.hash + ':' + c.lines[1]).join('\n');
      if (sub === 'status') return 'On branch main\nnothing to commit';
      if (sub === 'branch') return '* main';
      return "git: '" + sub + "' not supported in this puzzle";
    };
    const run = raw => {
      const segs = String(raw || '').split('|').map(x => x.trim()).filter(Boolean);
      let out = runSingle(segs[0] || '');
      for (let i = 1; i < segs.length; i++) out = applyDecodePipeSegment(segs[i], out);
      return out;
    };
    const finalCmd = 'git show ' + target.hash + ' | grep "+ PROD_SEALED_KEY" | cut -d= -f2- | ' + chain.decodePipe;
    return {
      id: 'gen-git-' + seed, shell: 'git', difficulty: diff, category: 'author', stages: isInsane ? 4 : 3,
      title: DIFFS[diff].label + ' · Deep Git Secret Forensics (' + count + ' Commits)',
      brief: 'Read README.md, search ' + count + ' commits (with decoy/revoked commits) for ' + targetAuthor + '\'s verified commit, extract PROD_SEALED_KEY from its diff, and peel ' + layerCount + ' stacked layer(s) (' + chain.decodePipe + ').',
      hint: 'git log --oneline --author=' + targetAuthor + '  →  ' + finalCmd,
      walkthrough: ['cat README.md', 'git log --oneline --author=' + targetAuthor, finalCmd],
      answer: ans, prompt: () => 'repo (git:main)$ ', run, cmds: C,
      palette: [['cat README.md', 'read instructions'], ['git log --oneline --author=' + targetAuthor, 'filter commits'], ['git show <hash>', 'inspect diff'], ['base64 -d', 'decode Base64'], ['xxd -r', 'decode Hex']]
    };
  }

  /* DOCKER: Hard (8 containers) / Insane (12 containers incl. stopped + log clue + 3-layer decode) */
  function makeDockerHardPuzzle(diff, seed) {
    const r = L.rnd((seed ^ 0x4cf5ad) >>> 0);
    const isInsane = diff === 'insane';
    const ans = L.newToken(r);
    const layerCount = deepen(isInsane ? 3 : 2);
    const chain = encodeChain(ans, pickLayers(r, layerCount));
    const targetImg = pick(r, ['vault-api:3.2', 'kms-worker:2.4', 'edge-auth:1.9']);
    const n = isInsane ? 12 : 8;
    const winIdx = 2 + r(n - 3);
    const containers = [];
    for (let i = 0; i < n; i++) {
      const isWinC = i === winIdx;
      const name = pick(r, ['api', 'worker', 'relay', 'vault', 'auth', 'proxy']) + '-' + (i + 1);
      const img = isWinC || i % 3 === 0 ? targetImg : pick(r, ['redis:7', 'postgres:16', 'nginx:1.25', 'worker:1.1']);
      const envName = isWinC ? 'prod' : (img === targetImg ? pick(r, ['dev', 'staging', 'qa']) : 'prod');
      containers.push({
        id: ('4a' + (100000 + r(899999)) + 'c9d0').slice(0, 12),
        name, image: img,
        status: isWinC && isInsane ? 'Exited (0) 2 hours ago' : (i % 4 === 0 ? 'Exited (1) 1 day ago' : 'Up ' + (1 + r(15)) + ' days'),
        env: { APP_ENV: envName, ROLE: isWinC ? 'primary' : 'replica', SEALED_TOKEN: isWinC ? chain.encoded : encodeChain(L.newToken(r), pickLayers(r, layerCount)).encoded },
        logs: isWinC
          ? ['boot: role=primary env=prod', 'vault: token sealed with pipeline: ' + chain.decodePipe, 'shutdown clean']
          : ['boot: role=replica env=' + envName, 'vault: decoy/staging container']
      });
    }
    const target = containers[winIdx];
    const C = {
      ls: () => 'compose.yml  README.txt',
      cat: a => a[0] === 'README.txt' ? 'Find the ' + (isInsane ? 'STOPPED (`docker ps -a`) ' : '') + 'container running ' + targetImg + ' with APP_ENV=prod. Check its logs for the decode pipeline, then decode SEALED_TOKEN.' : 'services:\n  target:\n    image: ' + targetImg,
      help: a => TP.formatHelp ? TP.formatHelp('docker', a) : 'Docker: docker ps -a, docker inspect, docker logs, docker exec, plus decode pipes'
    };
    const runSingle = raw => {
      const line = String(raw || '').trim();
      const w = line.split(/\s+/);
      if (C[w[0]]) return C[w[0]](w.slice(1));
      if (w[0] !== 'docker') return applyDecodePipeSegment(line, '');
      const sub = w[1], arg = w[2];
      if (sub === 'ps') {
        const list = w.includes('-a') ? containers : containers.filter(c => /^Up/.test(c.status));
        return 'CONTAINER ID   IMAGE           STATUS                  NAMES\n' + list.map(c => c.id.padEnd(14) + ' ' + c.image.padEnd(15) + ' ' + c.status.padEnd(23) + ' ' + c.name).join('\n');
      }
      if (sub === 'inspect') {
        const c = containers.find(x => x.name === arg || x.id.startsWith(arg || '___'));
        if (!c) return 'Error: No such container: ' + (arg || '');
        return JSON.stringify({ Name: '/' + c.name, Image: c.image, Status: c.status, Env: Object.entries(c.env).map(([k, v]) => k + '=' + v) }, null, 2);
      }
      if (sub === 'logs') {
        const c = containers.find(x => x.name === arg || x.id.startsWith(arg || '___'));
        if (!c) return 'Error: No such container: ' + (arg || '');
        return c.logs.join('\n');
      }
      if (sub === 'exec') {
        const c = containers.find(x => x.name === arg || x.id.startsWith(arg || '___'));
        if (!c) return 'Error: No such container: ' + (arg || '');
        return Object.entries(c.env).map(([k, v]) => k + '=' + v).join('\n');
      }
      return "docker: '" + sub + "' not available here";
    };
    const run = raw => {
      const segs = String(raw || '').split('|').map(x => x.trim()).filter(Boolean);
      let out = runSingle(segs[0] || '');
      for (let i = 1; i < segs.length; i++) out = applyDecodePipeSegment(segs[i], out);
      return out;
    };
    const finalCmd = 'docker exec ' + target.name + ' env | grep SEALED_TOKEN | cut -d= -f2- | ' + chain.decodePipe;
    return {
      id: 'gen-dock-' + seed, shell: 'docker', difficulty: diff, category: 'env', stages: isInsane ? 4 : 3,
      title: DIFFS[diff].label + ' · Container Forensics (' + n + ' Containers)',
      brief: (isInsane ? 'Among ' + n + ' containers (including STOPPED ones via `docker ps -a`), ' : 'Among ' + n + ' containers, ') +
        'find the one running `' + targetImg + '` with `APP_ENV=prod`. Check its `docker logs` for the decode pipeline, extract `SEALED_TOKEN`, and peel ' + layerCount + ' layer(s).',
      hint: 'docker ps -a  →  docker logs ' + target.name + '  →  ' + finalCmd,
      walkthrough: ['docker ps -a', 'docker logs ' + target.name, finalCmd],
      answer: ans, prompt: () => 'deploy@yard:~$ ', run, cmds: C,
      palette: [['docker ps -a', 'include stopped containers'], ['docker logs <name>', 'read decode hint'], ['docker inspect <name>', 'inspect env'], ['docker exec <name> env', 'dump env']]
    };
  }

  /* NETWORK: Hard (2-hop + 2-layer decode) / Insane (3-hop subnet -> HTTP -> DNS TXT + 3-layer decode) */
  function makeNetHardPuzzle(diff, seed) {
    const r = L.rnd((seed ^ 0x5bd1e9) >>> 0);
    const isInsane = diff === 'insane';
    const ans = L.newToken(r);
    const layerCount = deepen(isInsane ? 3 : 2);
    const chain = encodeChain(ans, pickLayers(r, layerCount));

    const n = isInsane ? 8 : 5;
    const hosts = [];
    for (let i = 0; i < n; i++) {
      hosts.push({
        ip: '10.30.' + (1 + r(8)) + '.' + (10 + i * 13),
        name: pick(r, ['edge', 'relay', 'vault', 'kms', 'metrics', 'gw']) + '-' + (i + 1) + '.internal',
        ports: [22, 80]
      });
    }
    const hop1 = hosts[1 + r(n - 2)];
    const hop2 = hosts[(hosts.indexOf(hop1) + 1) % n];
    hop1.ports.push(8443);
    const hop1Url = 'http://' + hop1.ip + ':8443/status';

    const C = {
      help: a => TP.formatHelp ? TP.formatHelp('network', a) : 'Network: ip, arp, nmap, curl, dig, plus decode pipes (base64 -d, xxd -r, rot13, rev)'
    };
    const runSingle = raw => {
      const line = String(raw || '').trim();
      const w = line.split(/\s+/);
      const cmd = (w[0] || '').toLowerCase();
      if (cmd === 'help') return C.help(w.slice(1));
      if (cmd === 'ip' || cmd === 'ifconfig' || cmd === 'arp') {
        return 'Known subnet hosts:\n' + hosts.map(h => '  ' + h.ip.padEnd(15) + ' ' + h.name).join('\n');
      }
      if (cmd === 'nmap') {
        const ip = w.find(x => /^\d+\.\d+\.\d+\.\d+$/.test(x));
        const h = hosts.find(x => x.ip === ip);
        if (!h) return 'Host seems down. Run `ip` or `arp` to list active subnet hosts.';
        return 'Nmap scan report for ' + h.name + ' (' + h.ip + ')\nPORT     STATE SERVICE\n' +
          h.ports.map(p => (p + '/tcp').padEnd(9) + 'open  ' + (p === 8443 ? 'https-alt (status API)' : p === 80 ? 'http' : 'ssh')).join('\n');
      }
      if (cmd === 'curl' || cmd === 'wget') {
        const u = w.find(x => /^https?:/.test(x)) || '';
        if (u.includes(hop1.ip) && u.includes('8443')) {
          if (isInsane) {
            return 'next_host_b64=' + b64e(hop2.name) + '\ndecode_pipeline=' + chain.decodePipe + '\nnote=Query TXT record of decoded next_host';
          }
          return 'sealed_key=' + chain.encoded + '\ndecode_pipeline=' + chain.decodePipe;
        }
        return 'curl: (7) Connection refused (scan hosts with nmap to find port 8443)';
      }
      if (cmd === 'dig') {
        const name = w.slice(1).find(x => !x.startsWith('-') && !/^(TXT|A|AAAA)$/i.test(x)) || '';
        if (isInsane && name === hop2.name) return hop2.name + '. 60 IN TXT ' + chain.encoded;
        return name + '. 60 IN A ' + ((hosts.find(h => h.name === name) || {}).ip || '10.30.0.1');
      }
      return applyDecodePipeSegment(line, '');
    };
    const run = raw => {
      const segs = String(raw || '').split('|').map(x => x.trim()).filter(Boolean);
      let out = runSingle(segs[0] || '');
      for (let i = 1; i < segs.length; i++) out = applyDecodePipeSegment(segs[i], out);
      return out;
    };
    const finalCmd = isInsane
      ? 'dig ' + hop2.name + ' TXT | cut -d" " -f5- | ' + chain.decodePipe
      : 'curl ' + hop1Url + ' | grep sealed_key | cut -d= -f2- | ' + chain.decodePipe;
    const walkthrough = isInsane
      ? ['ip', 'nmap -sV ' + hop1.ip, 'curl ' + hop1Url, 'curl ' + hop1Url + ' | grep next_host_b64 | cut -d= -f2 | base64 -d', finalCmd]
      : ['ip', 'nmap -sV ' + hop1.ip, 'curl ' + hop1Url, finalCmd];
    return {
      id: 'gen-net-' + seed, shell: 'network', difficulty: diff, category: isInsane ? 'dns' : 'http', stages: isInsane ? 5 : 3,
      title: DIFFS[diff].label + ' · ' + (isInsane ? '3-Hop Subnet Pivot' : '2-Hop API Recon'),
      brief: isInsane
        ? 'Enumerate the subnet (`ip`), scan hosts with `nmap` to find port 8443, `curl` its `/status` endpoint, Base64-decode `next_host_b64`, query that host\'s DNS TXT record (`dig <host> TXT`), and peel 3 layers!'
        : 'Enumerate the subnet (`ip`), find the host listening on port 8443 via `nmap`, fetch `/status` with `curl`, and peel 2 encoding layers (' + chain.decodePipe + ').',
      hint: walkthrough.join('  →  '),
      walkthrough, answer: ans, prompt: () => 'probe@range:~$ ', run, cmds: C,
      palette: [['ip', 'list subnet hosts'], ['nmap -sV <ip>', 'scan host ports'], ['curl http://<ip>:8443/status', 'fetch status API'], ['dig <host> TXT', 'query DNS TXT'], ['base64 -d', 'decode Base64']]
    };
  }

  /* ================================================================ MASTER GENERATOR */
  function generate(opts) {
    const o = opts || {};
    EXTRA = Math.max(0, Math.min(5, o.extraLayers | 0));
    const shell = CATEGORIES[o.shell] ? o.shell : 'bash';
    const diff = DIFFS[o.difficulty] ? o.difficulty : 'medium';
    const cat = o.category || 'auto';
    const seed = Number.isFinite(+o.seed) && +o.seed > 0 ? (+o.seed >>> 0) : newSeed();
    const depth = DIFFS[diff].depth;
    const r = L.rnd((seed ^ 0x9e3779b9) >>> 0);
    const tagSeed = (rm, usedCat) => Object.assign(rm, {
      shell, difficulty: diff, category: usedCat, seed,
      generation: EXTRA ? { category: cat, seed, extraLayers: EXTRA } : { category: cat, seed },
      seedCode: shell + ':' + diff + ':' + cat + ':' + seed + (EXTRA ? ':x' + EXTRA : ''),
      custom: false
    });

    /* --- 1. OS File Shells (Bash / PowerShell / CMD) --- */
    if (shell === 'bash' || shell === 'powershell' || shell === 'cmd') {
      if (cat === 'breadcrumb') return tagSeed(makeBreadcrumbPuzzle(shell, diff === 'easy' ? 'medium' : diff, seed), 'breadcrumb');
      if (cat === 'corrupt_shards') return tagSeed(makeCorruptShardsPuzzle(shell, diff === 'easy' ? 'medium' : diff, seed), 'corrupt_shards');
      if (cat === 'forensic_corr') return tagSeed(makeForensicCorrPuzzle(shell, diff === 'easy' || diff === 'medium' ? 'hard' : diff, seed), 'forensic_corr');
      if (cat === 'pipeline') return tagSeed(makePipelinePuzzle(shell, diff, seed), 'pipeline');

      // Insane ALWAYS generates a true 4–5 stage CTF gauntlet — never a 1-step room!
      if (diff === 'insane') {
        const pickCat = cat === 'auto'
          ? pick(r, ['breadcrumb', 'corrupt_shards', 'forensic_corr', 'pipeline'])
          : (cat === 'assemble' ? 'corrupt_shards' : cat === 'grep' || cat === 'count' ? 'forensic_corr' : cat === 'encoded' ? 'pipeline' : 'breadcrumb');
        const rm = pickCat === 'breadcrumb' ? makeBreadcrumbPuzzle(shell, 'insane', seed)
          : pickCat === 'corrupt_shards' ? makeCorruptShardsPuzzle(shell, 'insane', seed)
          : pickCat === 'forensic_corr' ? makeForensicCorrPuzzle(shell, 'insane', seed)
          : makePipelinePuzzle(shell, 'insane', seed);
        return tagSeed(rm, pickCat);
      }

      // Hard ALWAYS generates a 3–4 stage layered puzzle!
      if (diff === 'hard') {
        const pickCat = cat === 'auto'
          ? pick(r, ['breadcrumb', 'corrupt_shards', 'forensic_corr', 'pipeline'])
          : (cat === 'assemble' ? 'corrupt_shards' : cat === 'grep' || cat === 'count' ? 'forensic_corr' : cat === 'encoded' ? 'pipeline' : 'breadcrumb');
        const rm = pickCat === 'breadcrumb' ? makeBreadcrumbPuzzle(shell, 'hard', seed)
          : pickCat === 'corrupt_shards' ? makeCorruptShardsPuzzle(shell, 'hard', seed)
          : pickCat === 'forensic_corr' ? makeForensicCorrPuzzle(shell, 'hard', seed)
          : makePipelinePuzzle(shell, 'hard', seed);
        return tagSeed(rm, pickCat);
      }

      // Medium ALWAYS generates a 2–3 stage puzzle!
      if (diff === 'medium') {
        const pickCat = cat === 'auto' ? pick(r, ['pipeline', 'hidden', 'nested', 'assemble', 'encoded', 'breadcrumb']) : cat;
        if (pickCat === 'breadcrumb') return tagSeed(makeBreadcrumbPuzzle(shell, 'medium', seed), 'breadcrumb');
        if (pickCat === 'pipeline') return tagSeed(makePipelinePuzzle(shell, 'medium', seed), 'pipeline');
        return tagSeed(makeMediumClassicPuzzle(shell, pickCat, seed), pickCat);
      }
      // Easy falls through to clean 1-step Labyrinth room below!
    }

    /* --- 2. Crypto (always tier-scaled 1 / 2 / 4 / 6 layers) --- */
    if (shell === 'crypto') return tagSeed(makeCryptoPuzzle(diff, seed), 'chain');

    /* --- 3. SQL (Hard / Insane -> Multi-Table JOIN!) --- */
    if (shell === 'sql' && (cat === 'join' || diff === 'hard' || diff === 'insane')) {
      return tagSeed(makeSqlJoinPuzzle(diff === 'easy' || diff === 'medium' ? 'hard' : diff, seed), 'join');
    }

    /* --- 4. Python & Node (Hard / Insane -> 2-file weighted/hex pipeline!) --- */
    if ((shell === 'python' || shell === 'node') && (cat === 'weighted' || diff === 'hard' || diff === 'insane')) {
      return tagSeed(makeCodePuzzle(shell, diff === 'easy' || diff === 'medium' ? 'hard' : diff, seed), 'weighted');
    }

    /* --- 5. Git (Hard / Insane -> deep history + encoded diff!) --- */
    if (shell === 'git' && (diff === 'hard' || diff === 'insane')) {
      return tagSeed(makeGitHardPuzzle(diff, seed), cat === 'auto' ? 'author' : cat);
    }

    /* --- 6. Docker (Hard / Insane -> stopped containers + log hint + encoded env!) --- */
    if (shell === 'docker' && (diff === 'hard' || diff === 'insane')) {
      return tagSeed(makeDockerHardPuzzle(diff, seed), 'env');
    }

    /* --- 7. Network (Hard / Insane -> multi-hop pivot + encoded secret!) --- */
    if (shell === 'network' && (diff === 'hard' || diff === 'insane')) {
      return tagSeed(makeNetHardPuzzle(diff, seed), diff === 'insane' ? 'dns' : 'http');
    }

    /* --- Fallback for Easy (and Medium Python/Node/SQL/Git/Docker/Net): clean Labyrinth room --- */
    let room = null;
    for (let attempt = 0; attempt < (cat === 'auto' ? 1 : 80); attempt++) {
      const cand = L.makeRoom(shell, depth, (seed + attempt * 131) >>> 0);
      if (cat === 'auto') { room = cand; break; }
      const hay = (String(cand.kind || '') + ' ' + String(cand.brief || '') + ' ' + String(cand.hint || '')).toLowerCase();
      if (cand.kind === cat ||
          (cat === 'author' && /committed by/.test(hay)) ||
          (cat === 'message' && /message mentions/.test(hay)) ||
          (cat === 'http' && /staging api/.test(hay)) ||
          (cat === 'dns' && /dns txt/.test(hay)) ||
          (cat === 'sum' && /sum|total of every/.test(hay)) ||
          (cat === 'countgt' && /greater than/.test(hay)) ||
          (cat === 'evens' && /even/.test(hay)) ||
          (cat === 'maxmin' && /largest/.test(hay)) ||
          (cat === 'twice' && /both files/.test(hay)) ||
          (cat === 'double' && /twice/.test(hay)) ||
          (cat === 'count' && /failed|denied|count/.test(hay)) ||
          (cat === 'avg' && /average/.test(hay)) ||
          (cat === 'max' && /largest/.test(hay)) ||
          (cat === 'sum2' && /and total >=/.test(hay)) ||
          (cat === 'env' || cat === 'chain')) {
        room = cand; break;
      }
    }
    if (!room) room = L.makeRoom(shell, depth, seed);
    return tagSeed(Object.assign({}, room, { stages: 1 }), cat === 'auto' ? (room.kind || 'auto') : cat);
  }

  function parseSeedCode(code) {
    const parts = String(code || '').trim().split(':');
    if (parts.length !== 4 && !(parts.length === 5 && /^x[1-5]$/.test(parts[4]))) return null;
    const [shell, difficulty, category, seedStr] = parts;
    const extraLayers = parts[4] ? +parts[4].slice(1) : 0;
    const seed = parseInt(seedStr, 10);
    if (!CATEGORIES[shell] || !DIFFS[difficulty] || !Number.isFinite(seed) || seed <= 0) return null;
    return extraLayers ? { shell, difficulty, category, seed, extraLayers } : { shell, difficulty, category, seed };
  }

  function parseFilesText(text) {
    const out = Object.create(null);
    const raw = String(text || '').trim();
    if (!raw) return out;
    if (/^===[ \t]*.+?[ \t]*===[ \t]*\r?$/m.test(raw)) {
      const blocks = raw.split(/^===[ \t]*(.+?)[ \t]*===[ \t]*\r?$/m);
      for (let i = 1; i < blocks.length; i += 2) {
        const p = blocks[i].trim(), body = (blocks[i + 1] || '').replace(/^\r?\n/, '').replace(/\r?\n$/, '');
        if (p) out[p] = body;
      }
      return out;
    }
    for (const line of raw.split(/\r?\n/)) {
      const idx = line.indexOf('=');
      if (idx > 0) {
        const p = line.slice(0, idx).trim();
        const v = line.slice(idx + 1).trim().replace(/\\n/g, '\n');
        if (p) out[p] = v;
      }
    }
    return out;
  }

  function createSession(puzzle, saved = {}) {
    const runtime = puzzle.createRuntime ? puzzle.createRuntime() : puzzle;
    let solved = saved.solved === true;
    let hints = Math.max(0, saved.hints | 0), tries = Math.max(0, saved.tries | 0);
    if (saved.workspace && typeof saved.workspace === 'object') runtime.restore?.(saved.workspace);
    const answerOf = String(puzzle.answer || '').trim().toLowerCase();
    const matchesAnswer = value => !!value && value.trim().toLowerCase() === answerOf && !!answerOf;
    const dObj = DIFFS[puzzle.difficulty] || DIFFS.medium;
    const welcome = () => [
      '╔═ PUZZLE STUDIO · ' + puzzle.shell.toUpperCase() + ' · ' + dObj.icon + ' ' + dObj.label.toUpperCase() + (puzzle.stages > 1 ? ' · ' + puzzle.stages + ' STAGES' : '') + ' ═╗',
      '  ' + puzzle.title + (puzzle.seedCode ? '  ·  seed ' + puzzle.seedCode : ''),
      '',
      puzzle.brief,
      '',
      '  solve <answer>   check key · hint · walkthrough · help [cmd] · clear'
    ].join('\n');

    const checkAnswer = given => {
      const clean = String(given || '').trim().toLowerCase();
      if (!clean) return { out: 'usage: solve <answer>' };
      if (matchesAnswer(clean)) {
        const firstWin = !solved;
        solved = true;
        if (firstWin) {
          const st = loadStats();
          st.solved++;
          st.streak++;
          st.bestStreak = Math.max(st.bestStreak, st.streak);
          st.byDiff[puzzle.difficulty] = (st.byDiff[puzzle.difficulty] || 0) + 1;
          saveStats(st);
        }
        return {
          solved: true,
          out: '✓ SOLVED! Key `' + puzzle.answer + '` verified! (' + dObj.icon + ' ' + dObj.label + (hints ? ', ' + hints + ' hint(s)' : ', clean solve!') + ')\n  Click "🎲 New" or switch difficulty/category on the right to generate another.'
        };
      }
      tries++;
      const st = loadStats();
      st.streak = 0;
      saveStats(st);
      return { out: '✗ `' + given + '` is not the key (attempt ' + tries + '). Keep digging or type `hint`.' };
    };

    const run = rawLine => {
      const raw = String(rawLine == null ? '' : rawLine).trim();
      if (!raw) return { out: '' };
      const curio = TP.curios?.run(raw, 'puzzle', puzzle.shell);
      if (curio != null) return { out: curio };
      const words = raw.split(/\s+/);
      const name = (words[0] || '').toLowerCase();
      const args = words.slice(1);
      if (name === 'solve' || name === 'submit' || name === 'unlock' || name === 'key') {
        const sp = raw.indexOf(' ');
        return checkAnswer(sp < 0 ? '' : raw.slice(sp + 1));
      }
      if (name === 'hint') {
        const clues = puzzle.hints?.length ? puzzle.hints : [puzzle.hint || 'Explore every file and decode what you find.'];
        const clue = clues[Math.min(hints, clues.length - 1)];
        hints++;
        return { out: '💡 hint · ' + clue };
      }
      if (name === 'walkthrough' || name === 'solution') {
        return { out: '📖 walkthrough:\n  ' + (puzzle.walkthrough || []).join('\n  ') + '\n  solve ' + puzzle.answer };
      }
      if (name === 'help' || name === '?') {
        const base = TP.formatHelp
          ? TP.formatHelp(puzzle.shell, args)
          : (puzzle.cmds && typeof puzzle.cmds.help === 'function' ? puzzle.cmds.help(args) : '');
        const extra = args.length ? '' : [
          '',
          '── PUZZLE STUDIO COMMANDS ──',
          '  solve <answer>                        submit your key to verify the solution',
          '  hint                                  show a tactical clue for the current puzzle',
          '  walkthrough                           reveal the full step-by-step solution commands',
          '  help <command>                        search descriptions for a specific command',
          '  clear                                 clear the terminal output screen'
        ].join('\n');
        return { out: String(base || '') + extra };
      }
      if (name === 'clear' || name === 'cls') return { out: '' };
      try {
        if (typeof runtime.run === 'function') return { out: String(runtime.run(raw) ?? '') };
        return { out: 'puzzle: command handler unavailable' };
      } catch (e) {
        return { out: 'error: ' + (e && e.message || e) };
      }
    };

    return {
      puzzle,
      run,
      checkAnswer,
      matchesAnswer,
      welcome,
      snapshot: () => ({ solved, hints, tries, workspace: runtime.snapshot?.() }),
      isSolved: () => solved,
      cwdPath: () => runtime.cwdPath?.(),
      prompt: () => (typeof runtime.prompt === 'function' ? runtime.prompt() : runtime.prompt || '$ ')
    };
  }

  function buildCustom(spec) {
    if (!spec.generation) return buildCustomFileRoom(spec);
    const puzzle = generate({ ...spec.generation, shell: spec.shell, difficulty: spec.difficulty });
    return Object.assign(puzzle, {
      id: spec.id,
      custom: true,
      title: spec.title || puzzle.title,
      brief: spec.brief || puzzle.brief,
      answer: spec.answer || puzzle.answer,
      hints: spec.hints,
      walkthrough: spec.walkthrough?.length ? spec.walkthrough : puzzle.walkthrough,
      seedCode: ''
    });
  }

  /* Every puzzle is a piece of a case: a dossier line from the lore engine, so the room has a story and a
     plausible owner instead of feeling like the same drill again. Only the briefing changes — the answer stays exact. */
  function generateCase(opts) {
    const room = generate(opts);
    try {
      const L = window.TerminalLore;
      if (!room || !L || !L.briefing) return room;
      const b = L.briefing((room.seed >>> 0) || (opts && opts.seed) || 1, room.category);
      return Object.assign({}, room, { lore: b, brief: b.icon + ' Case ' + b.caseId + ' · ' + b.org + ' — ' + b.line + '\n\n' + (room.brief || '') });
    } catch (e) { return room; }
  }

  window.TerminalPuzzles = {
    DIFFS,
    CATEGORIES,
    generate: generateCase,
    generateRaw: generate,
    parseSeedCode,
    parseFilesText,
    buildCustom,
    buildCustomFileRoom,
    createSession,
    loadCustom,
    saveCustom,
    loadStats,
    saveStats,
    addCustom(spec) {
      const list = loadCustom();
      const existing = list.find(item => item.id === spec.id);
      const lines = value => (Array.isArray(value) ? value : []).slice(0, 30)
        .map(line => String(line).trim().slice(0, 2000)).filter(Boolean);
      const shell = Object.hasOwn(CATEGORIES, spec.shell) ? spec.shell : 'bash';
      const difficulty = Object.hasOwn(DIFFS, spec.difficulty) ? spec.difficulty : 'medium';
      const item = {
        id: existing?.id || ('cp_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6)),
        shell,
        difficulty,
        title: String(spec.title || (spec.generation ? '' : 'Custom Puzzle')).trim().slice(0, 80),
        brief: String(spec.brief || '').trim().slice(0, 800),
        hint: String(spec.hint || '').trim().slice(0, 400),
        answer: String(spec.answer || '').trim().slice(0, 200),
        filesText: String(spec.filesText || '').slice(0, 64000),
        hints: lines(spec.hints),
        walkthrough: lines(spec.walkthrough),
        stages: Math.min(30, Math.max(1, Math.trunc(Number(spec.stages)) || 1)),
        custom: true,
        createdAt: existing?.createdAt || Date.now()
      };
      if (spec.generation) {
        const { category, seed } = spec.generation;
        item.generation = {
          category: CATEGORIES[shell].some(([id]) => id === category) ? category : 'auto',
          seed: (Number(seed) >>> 0) || newSeed()
        };
      } else {
        item.files = parseFilesText(item.filesText);
      }
      saveCustom([item, ...list.filter(entry => entry.id !== item.id)]);
      return item;
    },
    deleteCustom(id) {
      const list = loadCustom().filter(x => x.id !== id);
      saveCustom(list);
      return list;
    }
  };
})();

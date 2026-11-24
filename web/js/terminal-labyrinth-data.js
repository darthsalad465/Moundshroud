// Labyrinth — deep exploration mode for the terminal playground.
// Every terminal gets an endless descent: each depth is a generated room holding one puzzle whose
// answer is hidden in the room's own files, tables, commits, containers or services. Difficulty
// climbs with depth: more layers, more decoys, deeper paths, more steps.
(function () {
  const L = window.TerminalLabyrinth = window.TerminalLabyrinth || {};

  /* ---------------------------------------------------------------- seeded randomness */
  const rnd = seed => {
    let s = seed >>> 0;
    return n => {
      s = (s + 0x6D2B79F5) >>> 0;
      let t = Math.imul(s ^ (s >>> 15), s | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) % n;
    };
  };
  const pick = (r, a) => a[r(a.length)];
  const shuffle = (a, r) => { const x = a.slice(); for (let i = x.length - 1; i > 0; i--) { const j = r(i + 1); [x[i], x[j]] = [x[j], x[i]]; } return x; };
  const tier = d => Math.min(8, 1 + Math.floor((d - 1) / 3));
  L.rnd = rnd; L.tier = tier;

  const ADJ = ['amber', 'cobalt', 'harbor', 'kestrel', 'lumen', 'quarry', 'ridge', 'slate', 'vantage', 'willow', 'iron', 'cinder'];
  const NOUN = ['vault', 'relay', 'anchor', 'cipher', 'ledger', 'beacon', 'citadel', 'orchard', 'summit', 'harbor', 'forge', 'spire'];
  const MAKER = () => ADJ[Math.floor(Math.random() * ADJ.length)];
  L.newToken = r => pick(r, ADJ) + '-' + pick(r, NOUN) + '-' + (100 + r(900));

  /* ---------------------------------------------------------------- encodings */
  const b64 = s => (typeof btoa === 'function' ? btoa(s) : Buffer.from(s, 'utf8').toString('base64'));
  const un64 = s => (typeof atob === 'function' ? atob(s) : Buffer.from(s, 'base64').toString('utf8'));
  const hexOf = s => [...s].map(c => c.charCodeAt(0).toString(16).padStart(2, '0')).join('');
  const unhex = s => { const h = String(s).replace(/[^0-9a-f]/gi, ''); let o = ''; for (let i = 0; i + 1 < h.length; i += 2) o += String.fromCharCode(parseInt(h.slice(i, i + 2), 16)); return o; };
  const rot = (s, n) => [...s].map(c => /[a-z]/.test(c) ? String.fromCharCode((c.charCodeAt(0) - 97 + n + 26) % 26 + 97)
    : /[A-Z]/.test(c) ? String.fromCharCode((c.charCodeAt(0) - 65 + n + 26) % 26 + 65) : c).join('');
  const binOf = s => [...s].map(c => c.charCodeAt(0).toString(2).padStart(8, '0')).join(' ');
  const unbin = s => s.trim().split(/\s+/).map(x => String.fromCharCode(parseInt(x, 2))).join('');
  const MORSE = { a: '.-', b: '-...', c: '-.-.', d: '-..', e: '.', f: '..-.', g: '--.', h: '....', i: '..', j: '.---', k: '-.-', l: '.-..', m: '--', n: '-.', o: '---', p: '.--.', q: '--.-', r: '.-.', s: '...', t: '-', u: '..-', v: '...-', w: '.--', x: '-..-', y: '-.--', z: '--..', 0: '-----', 1: '.----', 2: '..---', 3: '...--', 4: '....-', 5: '.....', 6: '-....', 7: '--...', 8: '---..', 9: '----.' };
  const UNMORSE = Object.fromEntries(Object.entries(MORSE).map(([k, v]) => [v, k]));
  const morseOf = s => [...String(s).toLowerCase()].map(c => MORSE[c] || (c === ' ' ? '/' : '')).join(' ');
  const unMorse = s => String(s).trim().split(/\s+/).map(x => UNMORSE[x] || '').join('');

  L.encoders = {
    b64, un64, hexOf, unhex, rot, binOf, unbin, morseOf, unMorse
  };
  const ENC = {
    base64: s => b64(s),
    hex: s => hexOf(s),
    rot13: s => rot(s, 13),
    reverse: s => [...s].reverse().join(''),
    binary: s => binOf(s),
    morse: s => morseOf(s),
    caesar: s => rot(s, 7),
    url: s => encodeURIComponent(s)
  };
  L.ENC = ENC;

  /* ---------------------------------------------------------------- file helpers */
  const F = t => ({ text: String(t) });
  const isDir = n => n && typeof n === 'object' && !('text' in n);
  const textOf = n => typeof n === 'string' ? n : String(n.text);
  const walk = (root, parts, ci) => {
    let n = root;
    for (const s of parts) {
      if (!isDir(n)) return undefined;
      if (Object.hasOwn(n, s)) { n = n[s]; continue; }
      if (ci) {
        const hit = Object.keys(n).find(k => k.toLowerCase() === s.toLowerCase());
        if (hit !== undefined) { n = n[hit]; continue; }
      }
      return undefined;
    }
    return n;
  };
  const walkCanon = (root, parts, ci) => {
    let n = root;
    const out = [];
    for (const s of parts) {
      if (!isDir(n)) return { node: undefined, parts: out };
      if (Object.hasOwn(n, s)) { out.push(s); n = n[s]; continue; }
      if (ci) {
        const hit = Object.keys(n).find(k => k.toLowerCase() === s.toLowerCase());
        if (hit !== undefined) { out.push(hit); n = n[hit]; continue; }
      }
      return { node: undefined, parts: out };
    }
    return { node: n, parts: out };
  };
  const mkdirp = (root, parts) => {
    let n = root;
    for (const p of parts) { if (!isDir(n[p])) n[p] = {}; n = n[p]; }
    return n;
  };
  const put = (root, path, text) => {
    const parts = String(path).split('/').filter(Boolean);
    mkdirp(root, parts.slice(0, -1));
    let n = root;
    for (let i = 0; i < parts.length - 1; i++) n = n[parts[i]];
    n[parts[parts.length - 1]] = F(text);
  };
  const listTree = (node, base, out) => {
    for (const k of Object.keys(node).sort()) {
      const p = base + '/' + k;
      out.push([p, node[k]]);
      if (isDir(node[k])) listTree(node[k], p, out);
    }
    return out;
  };
  L.fs = { F, isDir, textOf, walk, mkdirp, put, listTree };

  /* ================================================================ FILESYSTEM FLAVORS (bash / powershell / cmd) */
  function bashCommands(tree, cwd) {
    const Unix = TerminalUnix;
    let prevCwd = null;
    const resolve = p => {
      if (!p || p === '~') return [];
      p = String(p).replace(/\\/g, '/');
      if (p.startsWith('~/')) p = '/' + p.slice(2);
      const parts = p.startsWith('/') ? [] : cwd.slice();
      for (const s of p.split('/')) { if (!s || s === '.') continue; if (s === '..') parts.pop(); else parts.push(s); }
      return parts;
    };
    const read = p => {
      const n = walk(tree, resolve(p));
      if (n === undefined) return { err: p + ': No such file or directory' };
      if (isDir(n)) return { err: p + ': Is a directory' };
      if (!(Unix.mode(n) & 0o400)) return { err: p + ': Permission denied' };
      return { text: textOf(n) };
    };
    const C = {};
    if (typeof TerminalOpsTraining !== 'undefined') Object.assign(C, TerminalOpsTraining.asCommands(result => result.out));
    C.pwd = () => '/' + cwd.join('/');
    C.cd = a => {
      const target = a[0];
      if (target === '-') {
        if (!prevCwd) return 'cd: OLDPWD not set';
        const next = prevCwd.slice(); prevCwd = cwd.slice();
        cwd.length = 0; cwd.push(...next);
        return '/' + cwd.join('/');
      }
      const p = resolve(target || '/');
      const n = walk(tree, p);
      if (n === undefined) return 'cd: ' + (target || '/') + ': No such file or directory';
      if (!isDir(n)) return 'cd: ' + target + ': Not a directory';
      prevCwd = cwd.slice();
      cwd.length = 0; cwd.push(...p);
      return '';
    };
    C.chmod = a => Unix.chmod(a, resolve, parts => walk(tree, parts), isDir).out;
    C.ls = a => {
      const flags = a.filter(x => x.startsWith('-')).join('');
      const t = a.find(x => !x.startsWith('-')) || '.';
      const n = walk(tree, resolve(t));
      if (n === undefined) return "ls: cannot access '" + t + "': No such file or directory";
      if (!isDir(n)) return flags.includes('l') ? Unix.permissions(n) + ' 1 explorer explorer ' + textOf(n).length + ' Feb 12 06:20 ' + t : t;
      const names = Object.keys(n).filter(k => flags.includes('a') || k[0] !== '.').sort();
      if (flags.includes('l')) {
        return 'total ' + names.length + '\n' + names.map(k => {
          const c = n[k];
          return Unix.permissions(c, isDir(c)) + ' 1 explorer explorer ' + String(isDir(c) ? 4096 : textOf(c).length).padStart(6) + ' Feb 12 06:20 ' + k + (isDir(c) ? '/' : '');
        }).join('\n');
      }
      return names.map(k => k + (isDir(n[k]) ? '/' : '')).join('  ');
    };
    C.cat = (a, stdin) => {
      let flags = '', files = [];
      for (const x of a) {
        if (x === '-') files.push('-');
        else if (x.startsWith('-') && x.length > 1) flags += x.slice(1);
        else files.push(x);
      }
      let combined;
      if (!files.length) { if (stdin == null) return 'usage: cat [-n|-b|-E|-s] <file>'; combined = stdin; }
      else {
        const outs = [];
        for (const f of files) {
          if (f === '-') { outs.push(stdin == null ? '' : stdin); continue; }
          const r = read(f);
          if (r.err) return 'cat: ' + r.err;
          outs.push(r.text);
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
    /* the last newline in a file ends its last line; it does not start a blank one */
    const linesOf = text => {
      const rows = String(text == null ? '' : text).split('\n');
      if (rows.length && rows[rows.length - 1] === '') rows.pop();
      return rows;
    };
    const extentOf = a => {
      let lines = 10, bytes = null, from = null; const files = [];
      for (let i = 0; i < a.length; i++) {
        const t = a[i];
        if (t === '-n') { const v = a[++i] || ''; if (/^\+\d+$/.test(v)) from = parseInt(v.slice(1), 10) || 1; else lines = parseInt(v, 10) || 10; }
        else if (t === '-c') bytes = parseInt(a[++i], 10) || 0;
        else if (/^-n\+\d+$/.test(t)) from = parseInt(t.slice(2), 10) || 1;
        else if (/^-n-?\d+$/.test(t)) lines = Math.abs(parseInt(t.slice(2), 10)) || 10;
        else if (/^-c\d+$/.test(t)) bytes = parseInt(t.slice(2), 10) || 0;
        else if (/^-\d+$/.test(t)) lines = parseInt(t.slice(1), 10) || 10;
        else if (!t.startsWith('-')) files.push(t);
      }
      return { n: lines, bytes, from, files };
    };
    C.head = (a, stdin) => {
      const { n, bytes, files } = extentOf(a);
      const r = files.length ? read(files[0]) : { text: stdin || '' };
      if (r.err) return 'head: ' + r.err;
      if (bytes != null) return [...String(r.text)].slice(0, bytes).join('');
      return linesOf(r.text).slice(0, n).join('\n');
    };
    C.tail = (a, stdin) => {
      const { n, bytes, from, files } = extentOf(a);
      const r = files.length ? read(files[0]) : { text: stdin || '' };
      if (r.err) return 'tail: ' + r.err;
      if (bytes != null) return [...String(r.text)].slice(-bytes).join('');
      if (from != null) return linesOf(r.text).slice(from - 1).join('\n');
      return linesOf(r.text).slice(-n).join('\n');
    };
    C.grep = (a, stdin) => {
      let flags = '', rest = [];
      for (const x of a) { if (x.startsWith('-') && x.length > 1) flags += x.slice(1); else rest.push(x); }
      const pat = rest.shift();
      if (pat == null) return 'usage: grep [-invrcolqH] <pattern> [file...]';
      let re; try { re = new RegExp(pat, flags.includes('i') ? 'i' : ''); } catch (e) { return 'grep: bad pattern'; }
      const hits = [], names = [];
      const showLabel = flags.includes('H') || (rest.length > 1 && !flags.includes('h'));
      const scan = (t, label) => linesOf(t).forEach((l, i) => {
        if (re.test(l) !== flags.includes('v')) {
          if (label && !names.includes(label)) names.push(label);
          const body = flags.includes('o') && !flags.includes('v') ? (l.match(re) || [''])[0] : l;
          hits.push((label && showLabel ? label + ':' : '') + (flags.includes('n') ? (i + 1) + ':' : '') + body);
        }
      });
      if (!rest.length) { if (stdin == null) return 'grep: no input'; scan(stdin, ''); }
      else for (const f of rest) {
        const n = walk(tree, resolve(f));
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
      if (flags.includes('q')) return '';
      if (flags.includes('l')) return names.join('\n');
      return flags.includes('c') ? String(hits.length) : hits.join('\n');
    };
    C.find = a => {
      const SH = window.TerminalSharedCommands;
      if (!SH || typeof SH.find !== 'function') return '';
      return SH.find(a, {
        walk: p => walk(tree, resolve(p)),
        isDir,
        size: n => (isDir(n) ? 4096 : textOf(n).length + 1),
        mode: n => Unix.mode(n, isDir(n)),
        remove: p => { const parts = resolve(p); const parent = walk(tree, parts.slice(0, -1)); if (isDir(parent)) delete parent[parts[parts.length - 1]]; },
        exec: (words, stdin) => {
          const fn = C[words[0]];
          if (typeof fn !== 'function') return 'find: ' + words[0] + ': command not found';
          return String(fn(words.slice(1), stdin) ?? '');
        },
        user: 'explorer'
      });
    };
    C.wc = (a, stdin) => {
      const flags = a.filter(x => x.startsWith('-')).join('');
      const files = a.filter(x => !x.startsWith('-'));
      const f = files[0];
      const t = f ? (read(f).err ? '' : read(f).text) : (stdin || '');
      const columns = [];
      if (flags.includes('l') || !flags) columns.push(String((t.match(/\n/g) || []).length));
      if (flags.includes('w') || !flags) columns.push(String(t.trim() ? t.trim().split(/\s+/).length : 0));
      if (flags.includes('c') || flags.includes('m') || !flags) columns.push(String(t.length));
      return columns.join(' ') + (f ? ' ' + f : '');
    };
    C.sort = (a, stdin) => {
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
      const f = a.find((x, i) => !x.startsWith('-') && !skip.has(i));
      const t = f ? (read(f).text || '') : (stdin || '');
      const fieldOf = line => keyCol == null ? line : (sep ? line.split(sep) : line.trim().split(/\s+/))[keyCol - 1] || '';
      let l = linesOf(t).sort((x, y) => {
        const fx = fieldOf(x), fy = fieldOf(y);
        if (numeric) return (parseFloat(fx.trim()) || 0) - (parseFloat(fy.trim()) || 0);
        return fx < fy ? -1 : fx > fy ? 1 : 0;
      });
      if (rev) l.reverse();
      if (uniq) l = l.filter((x, i) => x !== l[i - 1]);
      return l.join('\n');
    };
    C.uniq = (a, stdin) => {
      const flags = a.filter(x => x.startsWith('-')).join('');
      const f = a.find(x => !x.startsWith('-'));
      const t = f ? (read(f).text || '') : (stdin || '');
      const rows = [];
      const group = [];
      const flush = () => {
        if (!group.length) return;
        const count = group.length;
        if (flags.includes('u') && count !== 1) return;
        if (flags.includes('d') && count < 2) return;
        rows.push(flags.includes('c') ? String(count).padStart(7) + ' ' + group[0] : group[0]);
      };
      for (const line of linesOf(t)) {
        if (group.length && line !== group[0]) { flush(); group.length = 0; }
        group.push(line);
      }
      flush();
      return rows.join('\n');
    };
    C.cut = (a, stdin) => {
      let d = ' ', fSpec = '1';
      const skip = new Set();
      for (let i = 0; i < a.length; i++) {
        if (a[i] === '-d') { d = a[++i] ?? ' '; skip.add(i); }
        else if (a[i] === '-f') { fSpec = a[++i] || '1'; skip.add(i); }
        else if (/^-d/.test(a[i]) && a[i].length > 2) d = a[i].slice(2);
        else if (/^-f.+/.test(a[i])) fSpec = a[i].slice(2);
      }
      const file = a.find((x, i) => !x.startsWith('-') && !skip.has(i));
      const t = file ? (read(file).text || '') : (stdin || '');
      const rangeM = fSpec.match(/^(\d+)-(\d*)$/);
      const idx = parseInt(fSpec, 10) || 1;
      return linesOf(t).map(l => {
        const parts = l.split(d);
        if (rangeM) return parts.slice((+rangeM[1] || 1) - 1, rangeM[2] ? +rangeM[2] : undefined).join(d);
        return parts[idx - 1] || '';
      }).join('\n');
    };
    C.base64 = (a, stdin) => {
      const dec = a.some(x => /^-d|--decode$/.test(x));
      const t = a.filter(x => !x.startsWith('-')).join(' ') || stdin || '';
      try { return dec ? un64(t.trim()) : b64(t); } catch (e) { return 'base64: invalid input'; }
    };
    C.xxd = (a, stdin) => {
      const dec = a.includes('-r'), plain = a.includes('-p');
      const t = a.filter(x => !x.startsWith('-')).join(' ') || stdin || '';
      if (dec) {
        const cleaned = String(t).split('\n').map(l => {
          const m = l.match(/^[0-9a-f]{4,8}:\s+([0-9a-f ]+?)(?:\s{2,}.*)?$/i);
          return m ? m[1] : l;
        }).join('');
        return unhex(cleaned);
      }
      const bytes = [...t].map(c => c.charCodeAt(0));
      if (plain) return bytes.map(b => b.toString(16).padStart(2, '0')).join('');
      const rows = [];
      for (let i = 0; i < bytes.length; i += 8) {
        const ch = bytes.slice(i, i + 8);
        rows.push(i.toString(16).padStart(8, '0') + ': ' + ch.map(b => b.toString(16).padStart(2, '0')).join(' ').padEnd(23) + '  ' + ch.map(b => b >= 32 && b < 127 ? String.fromCharCode(b) : '.').join(''));
      }
      return rows.join('\n');
    };
    C.rot13 = (a, stdin) => rot(a.join(' ') || stdin || '', 13);
    C.file = a => {
      const f = a[0];
      const r = read(f || '');
      if (r.err) return 'file: ' + r.err;
      const t = r.text;
      if (/^\s*%PDF-\d\.\d/.test(t)) {
        const pages = (t.match(/\/Type\s*\/Page[^s]/g) || []).length || 1;
        return f + ': PDF document, version ' + (t.match(/^%PDF-(\d\.\d)/) || [])[1] + ', ' + pages + ' page' + (pages === 1 ? '' : 's');
      }
      if (/^[0-9a-f]{16,}$/i.test(t.trim())) return f + ': ASCII text (hex data)';
      if (/^[.\-\s]+$/.test(t.trim()) && t.includes('.')) return f + ': ASCII text (morse code)';
      if (/^[A-Za-z0-9+/=\s]+$/.test(t.trim()) && t.trim().length % 4 === 0) return f + ': ASCII text (base64 data)';
      if (/^[01 ]+$/.test(t.trim())) return f + ': ASCII text (binary)';
      return f + ': ASCII text';
    };
    // Like GNU tree: every level, dotfiles only with -a, and a closing count of folders and files.
    C.tree = a => {
      const target = a.find(x => !x.startsWith('-')) || '.';
      const n = walk(tree, resolve(target));
      if (!isDir(n)) return target + ' [error opening dir]';
      const hidden = a.some(x => /^-[a-z]*a/.test(x));
      const rows = [target];
      let dirs = 0, files = 0;
      const rec = (node, pre) => {
        const keys = Object.keys(node).filter(k => hidden || k[0] !== '.').sort();
        keys.forEach((k, i) => {
          const last = i === keys.length - 1;
          if (isDir(node[k])) dirs++; else files++;
          rows.push(pre + (last ? '└── ' : '├── ') + k);
          if (isDir(node[k])) rec(node[k], pre + (last ? '    ' : '│   '));
        });
      };
      rec(n, '');
      return rows.concat('', dirs + (dirs === 1 ? ' directory, ' : ' directories, ') + files + (files === 1 ? ' file' : ' files')).join('\n');
    };
    C.stat = a => {
      const formatted = Unix.permissionStat(a, p => walk(tree, resolve(p)), isDir);
      if (formatted) return formatted.out;
      const f = a[0];
      const n = walk(tree, resolve(f || ''));
      if (n === undefined) return "stat: cannot statx '" + f + "': No such file or directory";
      return '  File: ' + f + '\n  Size: ' + (isDir(n) ? 4096 : textOf(n).length) + '\n  Access: (' + Unix.octal(Unix.mode(n, isDir(n))).padStart(4, '0') + '/' + Unix.permissions(n, isDir(n)) + ')';
    };
    const writeFile = (p, text, append) => {
      const parts = resolve(p);
      let n = tree;
      for (let i = 0; i < parts.length - 1; i++) { if (!isDir(n[parts[i]])) n[parts[i]] = {}; n = n[parts[i]]; }
      const k = parts[parts.length - 1], old = n[k];
      n[k] = { text: append && old && !isDir(old) ? textOf(old) + '\n' + text : String(text),
        mode: old && !isDir(old) ? Unix.octal(Unix.mode(old)) : '644' };
    };
    const srcOf = (files, stdin) => files.length ? (() => { const rs = files.map(read); const err = rs.find(x => x.err); return err ? { err: err.err } : { text: rs.map(x => x.text).join('\n') }; })() : (stdin != null ? { text: stdin } : { err: 'missing input' });
    C.echo = a => (a[0] === '-n' ? a.slice(1) : a).join(' ');
    /* printf repeats its format while arguments remain, which is how `printf '%s\n' a b` prints two lines */
    C.printf = a => {
      const args = a.slice();
      if (args[0] === '--') args.shift();
      if (!args.length) return 'printf: usage: printf FORMAT [ARGUMENT]...';
      const unescape = s => String(s).replace(/\\n/g, '\n').replace(/\\t/g, '\t').replace(/\\r/g, '\r').replace(/\\a/g, '\u0007').replace(/\\b/g, '\b').replace(/\\f/g, '\f').replace(/\\v/g, '\v').replace(/\\\\/g, '\\');
      const format = unescape(args.shift());
      let at = 0;
      const once = () => format.replace(/%(?:%|([sbcdufixXo]))/g, (whole, spec) => {
        if (!spec) return '%';
        const value = at < args.length ? args[at++] : '';
        if (spec === 's') return String(value);
        if (spec === 'b') return unescape(value);
        if (spec === 'c') return String(value).charAt(0);
        if (spec === 'd' || spec === 'i' || spec === 'u') return String(parseInt(value, 10) || 0);
        if (spec === 'f') return (parseFloat(value) || 0).toFixed(6);
        if (spec === 'x' || spec === 'X') { const hex = (parseInt(value, 10) || 0).toString(16); return spec === 'X' ? hex.toUpperCase() : hex; }
        if (spec === 'o') return (parseInt(value, 10) || 0).toString(8);
        return String(value);
      });
      let out = once(), guard = 0;
      while (at < args.length && /%[sbcdufixXo]/.test(format) && guard++ < 500) out += once();
      return out;
    };
    C.ll = a => C.ls(['-la'].concat(a));
    C.la = a => C.ls(['-a'].concat(a));
    C.dir = a => C.ls(a);
    C.more = (a, s) => C.cat(a, s);
    C.less = (a, s) => C.cat(a, s);
    C.rev = (a, s) => { const r = srcOf(a.filter(x => !x.startsWith('-')), s); return r.err ? 'rev: ' + r.err : r.text.split('\n').map(l => [...l].reverse().join('')).join('\n'); };
    C.tac = (a, s) => { const r = srcOf(a.filter(x => !x.startsWith('-')), s); return r.err ? 'tac: ' + r.err : linesOf(r.text).reverse().join('\n'); };
    C.nl = (a, s) => { const r = srcOf(a.filter(x => !x.startsWith('-')), s); return r.err ? 'nl: ' + r.err : linesOf(r.text).map((l, i) => String(i + 1).padStart(6) + '\t' + l).join('\n'); };
    C.strings = (a, s) => { const r = srcOf(a.filter(x => !x.startsWith('-')), s); return r.err ? 'strings: ' + r.err : (r.text.match(/[\x20-\x7e]{4,}/g) || []).join('\n'); };
    C.tr = (a, s) => {
      if (s == null) return 'tr: missing input';
      const expand = str => {
        str = String(str || '').replace(/\\n/g, '\n').replace(/\\t/g, '\t').replace(/\\r/g, '\r').replace(/\[:lower:\]/g, 'a-z').replace(/\[:upper:\]/g, 'A-Z').replace(/\[:digit:\]/g, '0-9').replace(/\[:space:\]/g, ' \t\n\r');
        let o = '';
        for (let i = 0; i < str.length; i++) {
          if (i + 2 < str.length && str[i + 1] === '-') { for (let c = str.charCodeAt(i); c <= str.charCodeAt(i + 2); c++) o += String.fromCharCode(c); i += 2; }
          else o += str[i];
        }
        return o;
      };
      const sets = a.filter(x => !x.startsWith('-'));
      if (a.includes('-d')) { const del = expand(sets[0]); return [...s].filter(c => !del.includes(c)).join(''); }
      const from = expand(sets[0]), to = expand(sets[1]);
      return [...s].map(c => { const i = from.indexOf(c); return i < 0 ? c : (to[i] || to[to.length - 1] || ''); }).join('');
    };
    C.sed = (a, s) => {
      const sc = a.find(x => !x.startsWith('-')) || '', m = sc.match(/^s(.)(.*?)\1(.*?)\1([gi]*)$/);
      if (!m) return 'sed: try s/old/new/g';
      const inPlace = a.some(x => /^-i/.test(x));
      const files = a.filter(x => x !== sc && !x.startsWith('-'));
      const r = srcOf(files, s);
      if (r.err) return 'sed: ' + r.err;
      const out = r.text.split('\n').map(l => l.replace(new RegExp(m[2], (m[4].includes('g') ? 'g' : '') + (m[4].includes('i') ? 'i' : '')), m[3])).join('\n');
      if (inPlace && files.length) { for (const f of files) writeFile(f, out, false); return ''; }
      return out;
    };
    C.awk = (a, s) => {
      let sep = ' ', prog = '', files = [];
      for (let i = 0; i < a.length; i++) {
        if (a[i] === '-F') sep = a[++i] || ' ';
        else if (/^-F./.test(a[i])) sep = a[i].slice(2);
        else if (!prog && a[i].includes('{')) prog = a[i];
        else if (!a[i].startsWith('-')) files.push(a[i]);
      }
      const m = prog.match(/\{[\s]*print\s+([^}]+)\}/);
      if (!m) return 'awk: try {print $1, $2}';
      const flds = m[1].split(',').map(x => x.trim()), r = srcOf(files, s);
      if (r.err) return 'awk: ' + r.err;
      return linesOf(r.text).map(l => { const p = sep === ' ' ? l.trim().split(/\s+/) : l.split(sep); return flds.map(f => f === '$0' ? l : /^\$\d+$/.test(f) ? (p[+f.slice(1) - 1] || '') : f.replace(/^"|"$/g, '')).join(' '); }).join('\n');
    };
    C.paste = a => {
      const dIdx = a.indexOf('-d'), sep = dIdx >= 0 ? (a[dIdx + 1] || '\t') : '\t';
      const files = a.filter((x, i) => !x.startsWith('-') && (dIdx < 0 || i !== dIdx + 1));
      const lists = files.map(f => { const r = read(f); return r.err ? null : r.text.split('\n'); });
      if (lists.some(l => l === null)) return 'paste: cannot open file';
      const len = Math.max(0, ...lists.map(l => l.length));
      return Array.from({ length: len }, (_, i) => lists.map(l => l[i] || '').join(sep)).join('\n');
    };
    C.tee = (a, s) => { const f = a.find(x => !x.startsWith('-')); if (f && s != null) writeFile(f, s, a.includes('-a')); return s == null ? '' : s; };
    C.touch = a => { for (const f of a.filter(x => !x.startsWith('-'))) if (walk(tree, resolve(f)) === undefined) writeFile(f, '', false); return ''; };
    C.mkdir = a => { for (const f of a.filter(x => !x.startsWith('-'))) { const parts = resolve(f); let n = tree; for (const p of parts) { if (!isDir(n[p])) n[p] = {}; n = n[p]; } } return ''; };
    C.rm = a => { for (const f of a.filter(x => !x.startsWith('-'))) { const parts = resolve(f), par = walk(tree, parts.slice(0, -1)); if (isDir(par)) delete par[parts[parts.length - 1]]; } return ''; };
    C.cp = a => { const f = a.filter(x => !x.startsWith('-')); const r = read(f[0] || ''); if (r.err) return 'cp: ' + r.err; writeFile(f[1] || '', r.text, false); return ''; };
    C.mv = a => { const f = a.filter(x => !x.startsWith('-')); const r = read(f[0] || ''); if (r.err) return 'mv: ' + r.err; writeFile(f[1] || '', r.text, false); C.rm([f[0]]); return ''; };
    C.diff = a => { const f = a.filter(x => !x.startsWith('-')); const r1 = read(f[0] || ''), r2 = read(f[1] || ''); if (r1.err || r2.err) return 'diff: ' + (r1.err || r2.err); return r1.text === r2.text ? '' : '--- ' + f[0] + '\n+++ ' + f[1] + '\n-' + r1.text + '\n+' + r2.text; };
    C.hexdump = (a, s) => C.xxd(a.filter(x => x !== '-C'), s);
    C.od = (a, s) => C.xxd(a, s);
    C.hex = (a, s) => { const dec = a.includes('-d') || a.includes('-r'); const t = a.filter(x => !x.startsWith('-')).join(' ') || s || ''; return dec ? unhex(t) : hexOf(t); };
    C.binary = (a, s) => { const dec = a.includes('-d'); const t = a.filter(x => !x.startsWith('-')).join(' ') || s || ''; return dec ? unbin(t) : binOf(t); };
    C.url = (a, s) => { const dec = a.includes('-d'); const t = a.filter(x => !x.startsWith('-')).join(' ') || s || ''; return dec ? decodeURIComponent(t) : encodeURIComponent(t); };
    C.caesar = (a, s) => { const n = /^-?\d+$/.test(a[0] || '') ? parseInt(a[0], 10) : 3; const t = (/^-?\d+$/.test(a[0] || '') ? a.slice(1) : a).join(' ') || s || ''; return rot(t, n); };
    C.morse = (a, s) => { const dec = a.includes('-d'); const t = a.filter(x => !x.startsWith('-')).join(' ') || s || ''; return dec ? unMorse(t) : morseOf(t); };
    C.md5sum = (a, stdin) => Unix.checksum('md5', read)(a, stdin).out;
    C.sha256sum = (a, stdin) => Unix.checksum('sha256', read)(a, stdin).out;
    C.whoami = () => 'explorer';
    C.id = () => 'uid=1000(explorer) gid=1000(explorer) groups=1000(explorer)';
    C.hostname = () => 'labyrinth';
    C.uname = a => a.includes('-a') ? 'Linux labyrinth 5.15.0-91-generic x86_64 GNU/Linux' : 'Linux';
    C.date = () => 'Thu Feb 12 06:58:12 UTC 2026';
    C.uptime = () => 'up 7 days, labyrinth active';
    C.ps = () => '  PID TTY   CMD\n    1 ?     systemd\n 1000 pts/0 bash';
    C.env = () => 'USER=explorer\nHOME=/\nPWD=/' + cwd.join('/') + '\nSHELL=/bin/bash';
    C.printenv = C.env;
    C.which = a => a.map(x => C[x] ? '/usr/bin/' + x : '').filter(Boolean).join('\n');
    C.type = a => a.map(x => C[x] ? x + ' is /usr/bin/' + x : x + ': not found').join('\n');
    C.man = a => C.help(a);
    C.seq = a => { const ns = a.map(Number), [s0, e0] = ns.length === 1 ? [1, ns[0]] : [ns[0], ns[1]], o = []; for (let i = s0; i <= e0 && o.length < 100; i++) o.push(String(i)); return o.join('\n'); };
    C.expr = a => { try { return String(new Function('return (' + a.join(' ').replace(/[^0-9+\-*/%().\s]/g, '') + ')')()); } catch (e) { return 'expr: syntax error'; } };
    C.basename = a => {
      const p = String(a[0] || '').replace(/\/+$/, '');
      let name = p.split('/').pop() || '/';
      if (a[1] && name.endsWith(a[1]) && name !== a[1]) name = name.slice(0, -a[1].length);
      return name;
    };
    C.dirname = a => String(a[0] || '').split('/').slice(0, -1).join('/') || '.';
    /* an absolute path, whether the argument is a file or a directory */
    C.realpath = a => {
      const p = a.find(x => !x.startsWith('-')) || '.';
      if (walk(tree, resolve(p)) === undefined) return 'realpath: ' + p + ': No such file or directory';
      return '/' + resolve(p).join('/');
    };
    C.readlink = a => C.realpath(a);
    C.true = () => '';
    C.false = () => '';
    C.sleep = () => '';
    C.clear = () => '';
    C.cls = () => '';
    /* fill in the rest of the real shell (network, processes, archives, editors, hashing) with the shared kit */
    if (window.TerminalSharedCommands) {
      window.TerminalSharedCommands.install(C, {
        shell: 'bash', host: 'labyrinth', user: 'explorer',
        read,
        write: (p, t) => writeFile(p, t),
        remove: p => { const parts = resolve(p); const parent = parts.length ? walk(tree, parts.slice(0, -1)) : undefined; if (isDir(parent)) delete parent[parts[parts.length - 1]]; },
        list: p => { const n = walk(tree, resolve(p)); if (n === undefined || !isDir(n)) return { err: true, names: [] }; return { names: Object.keys(n).filter(k => k[0] !== '.').sort() }; }
      });
    }
    C.help = a => {
      const TP = window.TerminalPlayground;
      if (TP && TP.formatHelp) return TP.formatHelp('bash', a);
      return 'Bash room: ls, cd, pwd, cat, grep, find, cut, tr, sed, awk, sort, uniq, wc, base64, xxd, rot13, rev';
    };
    return {
      C, resolve, read, writeFile,
      previousDirectory: () => prevCwd,
      restorePreviousDirectory: path => { prevCwd = Array.isArray(path) ? path : null; }
    };
  }

  function psCommands(tree, cwd) {
    const resolve = p => {
      if (!p || p === '~') return [];
      let raw = String(p).trim().replace(/\\/g, '/');
      if (raw.startsWith('~/')) raw = '/' + raw.slice(2);
      const isAbs = /^[A-Za-z]:/.test(raw) || raw.startsWith('/');
      raw = raw.replace(/^[A-Za-z]:\/?/, '').replace(/^\/+/, '');
      if (isAbs && /^labyrinth(\/|$)/i.test(raw)) raw = raw.replace(/^labyrinth\/?/i, '');
      const parts = isAbs ? [] : cwd.slice();
      for (const s of raw.split('/')) {
        if (!s || s === '.') continue;
        if (s === '..') parts.pop(); else parts.push(s);
      }
      return parts;
    };
    const read = p => {
      const n = walk(tree, resolve(p), true);
      if (n === undefined || isDir(n)) return null;
      return textOf(n);
    };
    const C = {};
    C['get-location'] = () => 'Path\n----\nC:' + (cwd.length ? '\\' + cwd.join('\\') : '\\');
    C['set-location'] = a => {
      const target = a.find(x => !x.startsWith('-')) || '\\';
      const res = walkCanon(tree, resolve(target), true);
      if (res.node === undefined) return 'Set-Location : Cannot find path \'' + target + '\'.';
      if (!isDir(res.node)) return 'Set-Location : Cannot set location because \'' + target + '\' is a file, not a directory.';
      cwd.length = 0; cwd.push(...res.parts);
      return '';
    };
    C['get-childitem'] = a => {
      const flags = a.filter(x => x.startsWith('-')).join(' ').toLowerCase();
      const path = a.find(x => !x.startsWith('-')) || '.';
      const filterIdx = a.findIndex(x => /^-filter$/i.test(x));
      const filter = filterIdx >= 0 ? a[filterIdx + 1] : null;
      const n = walk(tree, resolve(path), true);
      if (n === undefined) return 'Get-ChildItem : Cannot find path \'' + path + '\'.';
      const rows = [];
      const emit = (node, base, rel) => {
        for (const k of Object.keys(node).sort()) {
          if (!flags.includes('force') && k[0] === '.') continue;
          const p = base + (base ? '\\' : '') + k;
          if (!filter || new RegExp('^' + filter.replace(/\./g, '\\.').replace(/\*/g, '.*') + '$', 'i').test(k)) {
            rows.push({ Mode: isDir(node[k]) ? 'd-----' : '-a----', LastWriteTime: '12/02/2026 06:20', Length: isDir(node[k]) ? '' : textOf(node[k]).length, Name: p });
          }
          if (isDir(node[k]) && flags.includes('recurse')) emit(node[k], p, rel);
        }
      };
      if (!isDir(n)) return path;
      if (flags.includes('name')) return Object.keys(n).filter(k => flags.includes('force') || k[0] !== '.').join('\n');
      emit(n, '', '');
      const cols = ['Mode', 'LastWriteTime', 'Length', 'Name'];
      const widths = cols.map(c => Math.max(c.length, ...rows.map(o => String(o[c]).length)));
      return [cols.map((c, i) => c.padEnd(widths[i])).join(' '), cols.map((c, i) => '-'.repeat(widths[i])).join(' ')]
        .concat(rows.map(o => cols.map((c, i) => String(o[c]).padEnd(widths[i])).join(' '))).join('\n');
    };
    C['get-content'] = a => {
      const files = a.filter(x => !x.startsWith('-'));
      if (!files.length) return 'Get-Content : supply a path';
      return files.map(p => { const t = read(p); return t == null ? "Get-Content : Cannot find path '" + p + "'." : t; }).join('\n');
    };
    C['select-string'] = (a, stdin) => {
      const pi = a.findIndex(x => /^-pattern$/i.test(x));
      const pat = pi >= 0 ? a[pi + 1] : a.find(x => !x.startsWith('-'));
      const fi = a.findIndex(x => /^-path$/i.test(x));
      const file = fi >= 0 ? a[fi + 1] : a.filter(x => !x.startsWith('-') && x !== pat)[0];
      const t = file ? read(file) : stdin;
      if (t == null) return 'Select-String : Cannot find path \'' + (file || '') + '\'.';
      const re = new RegExp(pat || '', 'i');
      return String(t).split('\n').map((l, i) => re.test(l) ? (file ? file + ':' : '') + (i + 1) + ':' + l : null).filter(Boolean).join('\n');
    };
    C['measure-object'] = (a, stdin) => 'Count\n-----\n' + (stdin == null ? 0 : String(stdin).split('\n').length);
    C['sort-object'] = (a, stdin) => { const ls2 = String(stdin || '').split('\n').sort(); return (a.some(x => /^-desc/i.test(x)) ? ls2.reverse() : ls2).join('\n'); };
    C['select-object'] = (a, stdin) => {
      const lines = String(stdin || '').split('\n');
      const fi = a.findIndex(x => /^-first$/i.test(x)), li = a.findIndex(x => /^-last$/i.test(x));
      if (fi >= 0) return lines.slice(0, parseInt(a[fi + 1], 10) || 1).join('\n');
      if (li >= 0) return lines.slice(-(parseInt(a[li + 1], 10) || 1)).join('\n');
      return lines.join('\n');
    };
    C['write-output'] = a => a.join(' ');
    C['write-host'] = C['write-output'];
    C['test-path'] = a => walk(tree, resolve(a[0] || ''), true) !== undefined ? 'True' : 'False';
    C['get-childitem'] = C['get-childitem'];
    // PowerShell runs tree.com from Windows, so tree /f works here as it does in cmd.
    C.tree = a => {
      const target = a.find(x => !x.startsWith('/'));
      const n = walk(tree, resolve(target || ''), true);
      const here = 'C:' + (cwd.length ? '\\' + cwd.join('\\') : '\\');
      if (!isDir(n)) return 'Invalid path - ' + String(target || here).toUpperCase();
      return window.TerminalPlayground.winTreeListing(n, here, a);
    };
    C.help = a => {
      const TP = window.TerminalPlayground;
      if (TP && TP.formatHelp) return TP.formatHelp('powershell', a);
      return 'PowerShell room: Get-ChildItem, Set-Location, Get-Location, Get-Content, Select-String, Measure-Object, Sort-Object, Select-Object, Test-Path';
    };
    const putWin = (p, text, append) => {
      const parts = resolve(p);
      let n = tree;
      for (let i = 0; i < parts.length - 1; i++) { if (!isDir(n[parts[i]])) n[parts[i]] = {}; n = n[parts[i]]; }
      const key = parts[parts.length - 1], old = n[key];
      n[key] = append && old !== undefined && !isDir(old) ? textOf(old) + '\n' + text : String(text == null ? '' : text);
    };
    const removeWin = p => { const parts = resolve(p); const parent = parts.length ? walk(tree, parts.slice(0, -1), true) : undefined; if (parent && typeof parent === 'object') delete parent[parts[parts.length - 1]]; };
    const mkdirWin = p => { const parts = resolve(p); let n = tree; for (const part of parts) { if (!isDir(n[part])) n[part] = {}; n = n[part]; } return ''; };
    const listWin = p => { const n = walk(tree, resolve(p), true); if (n === undefined || !isDir(n)) return { err: true }; return { names: Object.keys(n), dirs: Object.keys(n).filter(k => isDir(n[k])) }; };
    /* the same Windows kit the other Windows boxes use, so PowerShell here is not a five-command shell */
    if (window.TerminalWindowsCommands) {
      window.TerminalWindowsCommands.install(C, {
        shell: 'powershell', host: 'LABYRINTH', user: 'explorer',
        pwd: () => 'C:' + (cwd.length ? '\\' + cwd.join('\\') : '\\'),
        read: p => { const t = read(p); return t == null ? { err: p + ': not found' } : { text: t }; },
        write: putWin, remove: removeWin, list: listWin, mkdir: mkdirWin, history: () => []
      });
    }
    const aliases = { ls: 'get-childitem', dir: 'get-childitem', gci: 'get-childitem', cat: 'get-content', gc: 'get-content', cd: 'set-location', sl: 'set-location', pwd: 'get-location', gl: 'get-location', type: 'get-content', sls: 'select-string', measure: 'measure-object', sort: 'sort-object', select: 'select-object', echo: 'write-output' };
    return { C, aliases, resolve, read };
  }

  function cmdCommands(tree, cwd) {
    const resolve = p => {
      if (!p) return cwd.slice();
      let raw = String(p).trim().replace(/\\/g, '/');
      const isAbs = /^[A-Za-z]:/.test(raw) || raw.startsWith('/');
      raw = raw.replace(/^[A-Za-z]:\/?/, '').replace(/^\/+/, '');
      if (isAbs && /^labyrinth(\/|$)/i.test(raw)) raw = raw.replace(/^labyrinth\/?/i, '');
      const parts = isAbs ? [] : cwd.slice();
      for (const s of raw.split('/')) {
        if (!s || s === '.') continue;
        if (s === '..') parts.pop(); else parts.push(s);
      }
      return parts;
    };
    const read = p => { const n = walk(tree, resolve(p), true); return n === undefined || isDir(n) ? null : textOf(n); };
    const disp = () => 'C:' + (cwd.length ? '\\' + cwd.join('\\') : '\\');
    const C = {};
    C.dir = a => {
      const flags = a.filter(x => x.startsWith('/')).join(' ').toLowerCase();
      const path = a.find(x => !x.startsWith('/')) || '';
      const n = walk(tree, resolve(path), true);
      if (n === undefined) return 'File Not Found';
      if (!isDir(n)) return path;
      if (flags.includes('/s') && flags.includes('/b')) {
        const rows = [];
        for (const [p, c] of listTree(n, '', [])) rows.push(disp() + p.replace(/\//g, '\\'));
        return rows.join('\n');
      }
      const rows = [' Volume in drive C is LABYRINTH', ' Directory of ' + disp(), ''];
      for (const k of Object.keys(n).sort()) {
        if (!flags.includes('/a') && k[0] === '.') continue;
        rows.push('12/02/2026  06:20    ' + (isDir(n[k]) ? '<DIR>          ' : String(textOf(n[k]).length).padStart(14)) + ' ' + k);
      }
      rows.push('', '               ' + Object.keys(n).length + ' item(s)');
      return rows.join('\n');
    };
    C.cd = a => {
      const arg = a.filter(x => !/^\/d$/i.test(x)).join(' ').trim();
      if (!arg) return disp();
      const res = walkCanon(tree, resolve(arg), true);
      if (res.node === undefined) return 'The system cannot find the path specified.';
      if (!isDir(res.node)) return 'The directory name is invalid.';
      cwd.length = 0; cwd.push(...res.parts);
      return '';
    };
    C.type = a => {
      const files = a.filter(x => !x.startsWith('/'));
      if (!files.length) return 'The syntax of the command is incorrect.';
      return files.map(f => { const t = read(f); return t == null ? 'The system cannot find the file specified.' : t; }).join('\n');
    };
    C.more = (a, s) => a.length ? C.type(a) : (s || '');
    C.findstr = (a, s) => {
      const pos = a.filter(x => !x.startsWith('/'));
      const pat = pos[0], file = pos[1];
      const t = file ? read(file) : s;
      if (t == null) return 'FINDSTR: Cannot open ' + (file || '');
      const re = new RegExp(pat || '', 'i');
      return String(t).split('\n').map((l, i) => re.test(l) ? (i + 1) + ':' + l : null).filter(Boolean).join('\n');
    };
    C.find = (a, s) => {
      const pos = a.filter(x => !x.startsWith('/'));
      const pat = pos[0] || '', file = pos[1];
      const t = file ? read(file) : s;
      if (t == null) return 'File not found - ' + (file || '');
      return String(t).split('\n').filter(l => l.toLowerCase().includes(pat.toLowerCase())).join('\n');
    };
    C.sort = (a, s) => { const t = a[0] ? read(a[0]) : s; return t == null ? '' : String(t).split('\n').sort().join('\n'); };
    C.echo = a => a.join(' ');
    C.whoami = () => 'labyrinth\\explorer';
    C.hostname = () => 'LABYRINTH';
    C.ver = () => 'Microsoft Windows [Version 10.0.22631]';
    C.tree = a => {
      const target = a.find(x => !x.startsWith('/'));
      const n = walk(tree, resolve(target || ''));
      if (!isDir(n)) return 'Invalid path - ' + String(target || disp()).toUpperCase();
      return window.TerminalPlayground.winTreeListing(n, disp(), a);
    };
    C.help = a => {
      const TP = window.TerminalPlayground;
      if (TP && TP.formatHelp) return TP.formatHelp('cmd', a);
      return 'CMD room: dir [/a] [/s /b], cd, type, more, findstr, find, sort, tree, echo, whoami, hostname, ver';
    };
    /* ipconfig, tasklist, net, sc, reg, copy/del/move and the rest of a real cmd.exe, against this room's disk */
    if (window.TerminalWindowsCommands) {
      window.TerminalWindowsCommands.install(C, {
        shell: 'cmd', host: 'LABYRINTH', user: 'explorer',
        pwd: () => 'C:' + (cwd.length ? '\\' + cwd.join('\\') : '\\'),
        read: p => { const t = read(p); return t == null ? { err: p + ': not found' } : { text: t }; },
        write: (p, text, append) => {
          const parts = resolve(p);
          let n = tree;
          for (let i = 0; i < parts.length - 1; i++) { if (!isDir(n[parts[i]])) n[parts[i]] = {}; n = n[parts[i]]; }
          const key = parts[parts.length - 1], old = n[key];
          n[key] = append && old !== undefined && !isDir(old) ? textOf(old) + '\n' + text : String(text == null ? '' : text);
        },
        remove: p => { const parts = resolve(p); const parent = parts.length ? walk(tree, parts.slice(0, -1), true) : undefined; if (parent && typeof parent === 'object') delete parent[parts[parts.length - 1]]; },
        list: p => { const n = walk(tree, resolve(p), true); if (n === undefined || !isDir(n)) return { err: true }; return { names: Object.keys(n), dirs: Object.keys(n).filter(k => isDir(n[k])) }; },
        mkdir: p => { const parts = resolve(p); let n = tree; for (const part of parts) { if (!isDir(n[part])) n[part] = {}; n = n[part]; } return ''; },
        history: () => []
      });
    }
    return { C, resolve, read };
  }

  /* ---------------------------------------------------------------- the filesystem room */
  function filesRoom(shell, d, r) {
    const t = tier(d);
    const tree = {};
    const cwd = [];
    /* Windows rooms are a workstation you have broken into: the node's own files sit in the user's profile and the
       rest of the machine (Desktop, Documents, Downloads, AppData, Program Files, Windows) is there too */
    const win = shell === 'powershell' || shell === 'cmd';
    const winUser = 'explorer';
    const rootWord = pick(r, ['vault', 'depot', 'archive', 'relay', 'gallery']);
    put(tree, 'README.txt', 'Labyrinth node ' + d + '\nThis room holds one key. Read the objective above and use the shell.');
    put(tree, 'var/log/events.log', [
      '2026-02-12T06:01:02Z info  scheduler tick',
      '2026-02-12T06:03:18Z info  user login ' + pick(r, ['maya', 'dev', 'sam']),
      '2026-02-12T06:07:41Z warn  certificate expiring in 9 days',
      '2026-02-12T06:11:09Z info  backup complete'
    ].join('\n'));
    const kinds = shell === 'bash'
      ? ['hidden', 'grep', 'assemble', 'nested', 'encoded', 'count', 'nested', 'grep']
      : ['hidden', 'grep', 'assemble', 'nested', 'nested', 'grep'];
    const kind = pick(r, t < 2 ? ['hidden', 'grep', 'assemble'] : kinds);
    const ans = L.newToken(r);
    let brief, hint, walkthrough = [], answer = ans;

    if (kind === 'hidden') {
      const dir = '.' + pick(r, ['stash', 'keys', 'drop', 'cache']);
      const file = pick(r, ['rotation', 'staging', 'gateway']) + '.key';
      put(tree, dir + '/' + file, ans);
      put(tree, dir + '/notes.txt', 'nothing important');
      const readCmd = shell === 'bash' ? 'cat ' + dir + '/' + file : shell === 'powershell' ? 'Get-Content ' + dir + '\\' + file : 'type ' + dir + '\\' + file;
      walkthrough = shell === 'bash' ? ['ls -la', readCmd] : shell === 'powershell' ? ['Get-ChildItem -Force', readCmd] : ['dir /a', readCmd];
      brief = 'Something in this room was put where you were not meant to look. The plain listing walks straight past it, because the name it keeps begins with a full stop. Ask the shell to show what is normally hidden, and read what waits in there.';
      hint = 'bash: ls -la    PowerShell: Get-ChildItem -Force    cmd: dir /a';
    } else if (kind === 'grep') {
      const marker = pick(r, ['state=locked', 'result=denied', 'status=revoked']);
      const lines = [];
      const targetIdx = 4 + r(3);
      for (let i = 0; i < 8 + t; i++) {
        const tok = L.newToken(r);
        const state = i === targetIdx ? marker : pick(r, ['state=ok', 'state=queued']);
        lines.push('event=' + (100 + i) + ' ' + state + ' token=' + (i === targetIdx ? ans : tok));
      }
      put(tree, 'var/log/audit.log', lines.join('\n'));
      const file = shell === 'bash' ? 'var/log/audit.log' : shell === 'powershell' ? 'var\\log\\audit.log' : 'var\\log\\audit.log';
      const pat = marker.split('=')[1];
      walkthrough = shell === 'bash' ? ['grep ' + pat + ' ' + file]
        : shell === 'powershell' ? ['Select-String -Pattern ' + pat + ' -Path ' + file]
        : ['findstr ' + pat + ' ' + file];
      brief = 'The logs are full of quiet lines that claim everything was fine, and one that admits something went wrong. Only that line carries the key; the words beside it are bait. Let the shell do the reading rather than your eyes.';
      hint = shell === 'bash' ? 'grep ' + pat + ' ' + file : shell === 'powershell' ? 'Select-String -Pattern ' + pat + ' -Path ' + file : 'findstr ' + pat + ' ' + file;
    } else if (kind === 'assemble') {
      const parts = [ans.slice(0, 6), ans.slice(6, 13), ans.slice(13)];
      put(tree, 'fragments/part1.txt', parts[0]);
      put(tree, 'fragments/part2.txt', parts[1]);
      put(tree, 'fragments/part3.txt', parts[2]);
      put(tree, 'fragments/order.txt', 'part1 then part2 then part3');
      const rd = f => shell === 'bash' ? 'cat ' + f : shell === 'powershell' ? 'Get-Content ' + f.replace(/\//g, '\\') : 'type ' + f.replace(/\//g, '\\');
      walkthrough = [rd('fragments/part1.txt'), rd('fragments/part2.txt'), rd('fragments/part3.txt')];
      brief = 'The key did not survive whole. It was cut apart, the pieces left in more than one place, and a small note left with them that still remembers the order they went in. Gather the pieces, follow the note, and mend the key with nothing left between the joins.';
      hint = 'cat fragments/part1.txt fragments/part2.txt fragments/part3.txt';
    } else if (kind === 'nested') {
      const a = pick(r, ['srv', 'opt', 'data']) + '/' + rootWord + '-' + (10 + r(80));
      const b = pick(r, ['build', 'staging', 'cold', 'old']) + (1 + r(9));
      const file = pick(r, ['master', 'release', 'unsealed']) + '.key';
      put(tree, a + '/' + b + '/' + file, ans);
      put(tree, a + '/' + b + '/notes.txt', 'moved here during the migration');
      put(tree, 'tmp/' + pick(r, ['old', 'copy']) + '.key', L.newToken(r));
      walkthrough = shell === 'bash' ? ['find . -name "*.key"', 'cat ./' + a + '/' + b + '/' + file]
        : shell === 'powershell' ? ['Get-ChildItem -Recurse -Filter *.key', 'Get-Content ' + (a + '/' + b + '/' + file).replace(/\//g, '\\')]
        : ['dir /s /b', 'type ' + (a + '/' + b + '/' + file).replace(/\//g, '\\')];
      brief = 'Down here the folders are folded inside one another, and more than one file will claim to be the key. The true one is kept furthest from where you start. Hunt down every key the disk holds before you trust any of them.';
      hint = shell === 'bash' ? 'find . -name "*.key"' : shell === 'powershell' ? 'Get-ChildItem -Recurse -Filter *.key' : 'dir /s /b';
    } else if (kind === 'encoded') {
      const mode = t >= 5 && r(2) ? 'hex' : t >= 3 && r(2) ? 'base64' : 'rot13';
      const enc = mode === 'hex' ? hexOf(ans) : mode === 'base64' ? b64(ans) : rot(ans, 13);
      const file = 'sealed.' + (mode === 'hex' ? 'hex' : mode === 'base64' ? 'b64' : 'rot');
      put(tree, file, enc);
      walkthrough = ['cat ' + file, mode === 'hex' ? 'xxd -r ' + enc : mode === 'base64' ? 'base64 -d ' + enc : 'rot13 ' + enc];
      brief = 'One file in this room will not read as words. Its name ends the way a sealed thing does, and it wears a single wrapper to keep you out. Peel that wrapper once and the key is underneath.';
      hint = walkthrough[1];
    } else {
      const n = 3 + t + r(5);
      const marker = 'DENIED';
      const lines = [];
      for (let i = 0; i < n; i++) lines.push('10.0.0.' + (10 + r(200)) + ' ' + marker + ' /admin ' + (400 + r(500)));
      for (let i = 0; i < 6; i++) lines.push('10.0.0.' + (10 + r(200)) + ' ALLOW /health 200');
      put(tree, 'var/log/access.log', shuffle(lines, r).join('\n'));
      answer = String(n);
      walkthrough = ['grep -c ' + marker + ' var/log/access.log'];
      brief = 'This key is a number, not a word. The traffic log lists many visitors and only some of them were turned away at the door. Count the refused ones and answer with the number alone.';
      hint = 'grep -c DENIED var/log/access.log';
    }

    /* decoys at depth to make reading everything expensive */
    if (t >= 2) {
      put(tree, 'attic/old-' + (1 + r(9)) + '.key', L.newToken(r));
      put(tree, 'attic/readme.txt', 'superseded');
    }
    /* clutter: what a node is full of depends on the seed, not on the depth (more at deeper tiers) */
    {
      const clutter = [
        () => ['var/log/' + pick(r, ['app', 'sync', 'worker', 'cron', 'relay', 'index']) + '-' + (1 + r(12)) + '.log', Array.from({ length: 4 + r(6) }, () => '2026-02-' + String(10 + r(10)) + ' 0' + (1 + r(8)) + ':' + String(r(60)).padStart(2, '0') + ' ' + pick(r, ['info', 'warn', 'debug']) + ' ' + pick(r, ['flush ok', 'cache miss', 'retry scheduled', 'queue drained', 'tick', 'watcher restart', 'lock held', 'peer gone']) + ' pid=' + (100 + r(9000))).join('\n')],
        () => ['tmp/' + pick(r, ['cache', 'session', 'spool', 'work']) + '-' + r(16777215).toString(16) + '.tmp', 'temporary file\npid=' + (100 + r(9000)) + '\nopened=' + (1 + r(23)) + ':' + String(r(60)).padStart(2, '0') + '\nstale=' + pick(r, ['yes', 'no', 'unknown'])],
        () => ['docs/' + pick(r, ['runbook', 'handover', 'ticket', 'policy', 'faq', 'changelog']) + '-' + (1 + r(30)) + '.txt', [pick(r, ['Runbook', 'Handover', 'Ticket', 'Policy', 'FAQ', 'Changelog']) + ' ' + (1 + r(40)), 'Owner: ' + pick(r, ['ops', 'platform', 'security', 'a contractor']), '', pick(r, ['Steps are out of date.', 'Nobody has read this since the migration.', 'Follow this exactly; it almost works.', 'If this fails, escalate and hope.', 'Superseded, but still linked from the wiki.'])].join('\n')],
        () => ['backup/' + pick(r, ['snapshot', 'export', 'archive', 'copy']) + '-' + (100 + r(900)) + '.idx', 'entries: ' + (10 + r(5000)) + '\nbytes: ' + (1 + r(900)) + 'MB\nstatus: ' + pick(r, ['complete', 'interrupted', 'verified', 'never checked'])],
        () => ['etc/' + pick(r, ['agents', 'collector', 'routes', 'limits']) + '.conf', Array.from({ length: 3 + r(4) }, () => pick(r, ['interval=', 'retries=', 'mode=', 'timeout=', 'host=']) + pick(r, ['30s', '5', 'auto', 'strict', '10.0.0.' + (2 + r(200))])).join('\n')],
        () => ['notes/' + pick(r, ['todo', 'scratch', 'ideas', 'questions']) + '-' + (1 + r(9)) + '.txt', Array.from({ length: 3 + r(5) }, () => '- ' + pick(r, ['ask about the key rotation', 'this node keeps dropping', 'check who owns the box', 'do not restart on a Friday', 'the docs are wrong again', 'log rotation is off', 'replace the drive', 'find the missing shard'])).join('\n')]
      ];
      const n = 3 + t * 2 + r(4);
      for (let i = 0; i < n; i++) { const [rel, text] = pick(r, clutter)(); put(tree, rel, text); }
    }

    /* two quiet notes left on the machine: the trail starts in the files, not in the answer */
    if (window.TerminalHints) {
      const notes = TerminalHints.noteTexts({ hint, hints: [hint], walkthrough, answer });
      put(tree, 'Desktop/start-here.txt', notes.start);
      put(tree, 'Documents/trail.txt', notes.trail);
    }

    if (win) {
      const roomKeys = Object.keys(tree);
      const profile = window.TerminalPC
        ? TerminalPC.windows({ user: winUser, host: 'LABYRINTH', seed: ((d * 2654435761) ^ 0x1a2b) >>> 0, leaf: F }) : {};
      TerminalPC.merge(tree, profile);
      const home = {};
      for (const k of roomKeys) { home[k] = tree[k]; delete tree[k]; }
      tree.Users = tree.Users || {};
      tree.Users[winUser] = TerminalPC.merge(tree.Users[winUser] || {}, home);
      cwd.length = 0; cwd.push('Users', winUser);
    } else if (window.TerminalPC) {
      const profile = TerminalPC.linux({ user: 'explorer', host: 'labyrinth', seed: ((d * 2654435761) ^ 0x51d3) >>> 0, leaf: F });
      TerminalPC.merge(profile, tree);
      for (const k of Object.keys(tree)) delete tree[k];
      Object.assign(tree, profile);
    }

    const bash = bashCommands(tree, cwd);
    const ps = psCommands(tree, cwd);
    const cmd = cmdCommands(tree, cwd);
    const api = shell === 'bash' ? bash : shell === 'powershell' ? ps : cmd;
        const prompt = shell === 'bash' ? () => 'explorer@labyrinth:/' + cwd.join('/') + '$ '
      : shell === 'powershell' ? () => 'PS C:' + (cwd.length ? '\\' + cwd.join('\\') : '\\') + '> '
      : () => 'C:' + (cwd.length ? '\\' + cwd.join('\\') : '\\') + '> ';
    const palette = shell === 'bash'
      ? [['ls -la', 'list hidden entries'], ['cat <file>', 'read a file'], ['grep -rin <text> .', 'search recursively'], ['find . -name "*.key"', 'locate key files'], ['base64 -d <text>', 'decode Base64'], ['xxd -r <hex>', 'decode hex'], ['rot13 <text>', 'rotate letters']]
      : shell === 'powershell'
        ? [['Get-ChildItem -Force', 'list hidden entries'], ['Get-ChildItem -Recurse -Filter *.key', 'find keys'], ['Get-Content <file>', 'read a file'], ['Select-String -Pattern <text> -Path <file>', 'search a file'], ['Test-Path .stash', 'check a path']]
        : [['dir /a', 'list hidden entries'], ['dir /s /b', 'full recursive listing'], ['type <file>', 'read a file'], ['findstr <text> <file>', 'search a file'], ['tree', 'draw the tree']];

    const G = window.TerminalPlayground || {};
    const splitTop = G.splitTop || ((s, seps) => s.split(seps[0]).map(x => x.trim()).filter(Boolean));
    const listDir = dir => { const n = walk(tree, api.resolve(dir)); return isDir(n) ? Object.keys(n) : []; };
    const isWin = shell === 'powershell' || shell === 'cmd';
    const expandWords = seg => G.expandShellWords ? G.expandShellWords(seg, listDir, isWin) : seg.split(/\s+/).filter(Boolean);
    /* $HOME, ${HOME} and $((2+3)) are part of the shell, not of any one command */
    const roomVars = () => {
      const env = {};
      try {
        for (const entry of String(api.C.env ? api.C.env() : '').split('\n')) {
          const cut = entry.indexOf('=');
          if (cut > 0) env[entry.slice(0, cut)] = entry.slice(cut + 1);
        }
      } catch (e) { /* the Windows shells keep their own variables */ }
      return env;
    };
    const expandRoomVars = text => {
      const source = String(text);
      let out = '', quote = null;
      for (let i = 0; i < source.length; i++) {
        const ch = source[i];
        if (ch === "'" && quote !== '"') { quote = quote === "'" ? null : "'"; out += ch; continue; }
        if (ch === '"' && quote !== "'") { quote = quote === '"' ? null : '"'; out += ch; continue; }
        if (ch === '\\' && quote !== "'" && i + 1 < source.length) { out += ch + source[i + 1]; i++; continue; }
        if (ch === '$' && quote !== "'") {
          const sum = /^\$\(\(([^()]*)\)\)/.exec(source.slice(i));
          if (sum) {
            let value = '';
            try { value = String(new Function('return (' + sum[1].replace(/[^0-9+\-*/%().\s]/g, '') + ')')()); } catch (e) { value = ''; }
            out += value;
            i += sum[0].length - 1;
            continue;
          }
          const name = /^\$\{([A-Za-z_][A-Za-z0-9_]*)\}|^\$([A-Za-z_][A-Za-z0-9_]*)/.exec(source.slice(i));
          if (name) {
            const env = roomVars();
            const key = name[1] || name[2];
            out += Object.hasOwn(env, key) ? env[key] : '';
            i += name[0].length - 1;
            continue;
          }
        }
        out += ch;
      }
      return out;
    };
    const runRoom = (raw, subDepth) => {
      const line = String(raw == null ? '' : raw).trim();
      if (!line) return '';
      const outs = [];
      const chainSeps = shell === 'cmd' ? ['&&', '&'] : [';', '&&', '||'];
      for (let chain of splitTop(line, chainSeps)) {
        if (shell === 'bash') chain = expandRoomVars(chain);
        if (shell === 'bash' && G.expandSub) chain = G.expandSub(chain, (inner, d2) => runRoom(inner, d2), subDepth || 0);
        /* `2>/dev/null` and `2>&1` are diagnostics redirects, never output redirects */
        chain = chain.replace(/\s*(?:2|1)?>\s*\/dev\/null/g, ' ').replace(/\s*2>&1/g, ' ').trim();
        let redirect = null;
        if (shell === 'bash' && api.writeFile) {
          const rm = chain.match(/(?:^|\s)(>>?)\s*(\S+)\s*$/);
          if (rm) { redirect = { append: rm[1] === '>>', file: rm[2] }; chain = chain.slice(0, rm.index).trim(); }
        }
        let stdin = null, out = '';
        for (let seg of splitTop(chain, ['|'])) {
          if (shell === 'bash') {
            const inM = seg.match(/\s<\s*(\S+)/);
            if (inM) {
              const rf = api.read(inM[1]);
              if (rf.err) { out = 'bash: ' + rf.err; break; }
              stdin = rf.text;
              seg = seg.replace(inM[0], ' ').trim();
            }
          }
          const words = expandWords(seg);
          if (!words.length) continue;
          let head = words.shift();
          const low = head.toLowerCase();
          const key = (api.aliases && api.aliases[low]) || (api.C[head] ? head : api.C[low] ? low : null);
          const fn = key ? api.C[key] : null;
          if (!fn) { out = (shell === 'bash' ? 'bash: ' : 'labyrinth: ') + head + ': command not found (try help)'; break; }
          try { out = String(fn(words, stdin) ?? ''); } catch (e) { out = head + ': ' + (e && e.message || e); }
          stdin = out;
        }
        if (redirect && api.writeFile) { api.writeFile(redirect.file, out, redirect.append); out = ''; }
        if (out !== '') outs.push(out);
      }
      return outs.join('\n');
    };

    return {
      kind, answer, brief, hint, walkthrough, prompt, palette,
      files: Object.fromEntries(listTree(tree, '', []).filter(([, node]) => !isDir(node))
        .map(([path, node]) => [path.slice(1), textOf(node)])),
      title: 'Labyrinth ' + d + ' · ' + rootWord,
      run: runRoom, cmds: api.C, aliases: api.aliases || {}, resolve: api.resolve,
      rootPath: shell === 'bash' ? '/' : 'C:/Users/' + winUser,
      cwdPath: () => shell === 'bash' ? '/' + cwd.join('/') : ['C:', ...cwd].join('/'),
      snapshot: () => ({ tree, cwd, prevCwd: api.previousDirectory?.(), modes: TerminalUnix.saveModes(tree, isDir) }),
      restore: state => {
        G.replaceSavedObject(tree, state.tree);
        TerminalUnix.restoreModes(tree, state.modes);
        if (Array.isArray(state.cwd)) cwd.splice(0, cwd.length, ...state.cwd);
        api.restorePreviousDirectory?.(state.prevCwd);
      }
    };
  }

  L.filesRoom = filesRoom;

  /* ================================================================ CRYPTO ROOM */
  function cryptoRoom(d, r) {
    const t = tier(d);
    const ans = L.newToken(r);
    /* only encoders that round-trip arbitrary text (morse drops case and punctuation) */
    const methods = ['base64', 'hex', 'rot13', 'reverse', 'binary', 'caesar'];
    if (t >= 3) methods.push('url');
    const layers = Math.min(5, 1 + Math.floor((d - 1) / 2));
    const decOne = (m, s) => m === 'base64' ? un64(s) : m === 'hex' ? unhex(s) : m === 'rot13' ? rot(s, 13)
      : m === 'reverse' ? [...s].reverse().join('') : m === 'caesar' ? rot(s, -7)
        : m === 'binary' ? unbin(s) : m === 'url' ? decodeURIComponent(s) : s;
    const chain = [];
    let text = ans;
    for (let i = 0; i < layers; i++) {
      const m = pick(r, methods);
      chain.unshift(m);
      text = ENC[m](text);
    }
    /* guarantee every generated artifact peels back to the key */
    let check = text;
    for (const m of chain) { try { check = decOne(m, check); } catch (e) { check = null; break; } }
    if (check !== ans) { chain.length = 0; chain.push('base64'); text = b64(ans); }
    const files = { 'artifact.txt': text };
    const walkthrough = ['file artifact.txt'];
    let cur = text;
    for (const m of chain) {
      if (m === 'base64') walkthrough.push('base64 -d ' + cur);
      else if (m === 'hex') walkthrough.push('hex -d ' + cur);
      else if (m === 'rot13') walkthrough.push('rot13 ' + cur);
      else if (m === 'reverse') walkthrough.push('reverse ' + cur);
      else if (m === 'caesar') walkthrough.push('caesar ' + cur);
      else if (m === 'binary') walkthrough.push('binary -d ' + cur);
      else if (m === 'url') walkthrough.push('url -d ' + cur);
      cur = decOne(m, cur);
      walkthrough.push('type ' + cur);
    }
    const decoders = {
      base64: s => { try { return un64(s); } catch (e) { return 'invalid base64'; } },
      hex: unhex, rot13: s => rot(s, 13), reverse: s => [...s].reverse().join(''),
      caesar: s => rot(s, -7), binary: unbin, morse: unMorse, url: s => { try { return decodeURIComponent(s); } catch (e) { return s; } }
    };
    const names = { base64: 'base64', hex: 'hex', rot13: 'rot13', reverse: 'reverse', caesar: 'caesar 7', binary: 'binary', morse: 'morse', url: 'url' };
    const C = {};
    C.ls = () => Object.keys(files).join('  ');
    C.cat = a => files[a[0]] == null ? 'cat: ' + (a[0] || '') + ': No such file or directory' : files[a[0]];
    C.file = a => {
      const n = files[a[0]];
      if (n == null) return 'file: ' + (a[0] || '') + ': No such file';
      return a[0] + ': data — layer 1 of ' + chain.length + ' is ' + chain[0] + ' (then ' + chain.slice(1).join(' → ') + ')';
    };
    const G2 = window.TerminalPlayground || {};
    const splitTop2 = G2.splitTop || (s => s.split('|').map(x => x.trim()).filter(Boolean));
    const argv2 = G2.argv || (s => s.split(/\s+/).filter(Boolean));
    const grab = (a, stdin) => { const s = a.filter(x => x !== '-d' && x !== '--decode' && x !== '-r').join(' '); return s || (stdin == null ? '' : stdin); };
    C.base64 = (a, s) => { const t = grab(a, s); return (a.includes('-d') || a.includes('--decode')) ? decoders.base64(t.trim()) : b64(t); };
    C.hex = (a, s) => { const t = grab(a, s); return (a.includes('-d') || a.includes('-r')) ? unhex(t) : hexOf(t); };
    C.xxd = C.hex;
    C.rot13 = (a, s) => rot(grab(a, s), 13);
    C.reverse = (a, s) => [...grab(a, s)].reverse().join('');
    C.rev = C.reverse;
    C.caesar = (a, s) => { const n = /^-?\d+$/.test(a[0] || '') ? parseInt(a[0], 10) : -7; const t = (/^-?\d+$/.test(a[0] || '') ? a.slice(1).join(' ') : grab(a, s)); return rot(t, n); };
    C.binary = (a, s) => { const t = grab(a, s); return a.includes('-d') ? unbin(t) : binOf(t); };
    C.morse = (a, s) => { const t = grab(a, s); return a.includes('-d') ? unMorse(t) : morseOf(t); };
    C.url = (a, s) => { const t = grab(a, s); return a.includes('-d') ? decodeURIComponent(t) : encodeURIComponent(t); };
    C.atbash = (a, s) => [...grab(a, s)].map(c => /[a-z]/.test(c) ? String.fromCharCode(219 - c.charCodeAt(0)) : /[A-Z]/.test(c) ? String.fromCharCode(155 - c.charCodeAt(0)) : c).join('');
    C.upper = (a, s) => grab(a, s).toUpperCase();
    C.lower = (a, s) => grab(a, s).toLowerCase();
    C.len = (a, s) => String([...grab(a, s)].length);
    C.echo = (a, s) => grab(a, s);
    C.tr = (a, s) => a.includes('-d') ? [...(s || '')].filter(c => !(a.find(x => !x.startsWith('-')) || '').includes(c)).join('') : (s || '');
    C.help = a => {
      const TP = window.TerminalPlayground;
      const base = TP && TP.formatHelp ? TP.formatHelp('crypto', a) : 'Encoding vault: ls, cat, file, base64, hex, xxd, rot13, reverse, caesar, binary, morse, url, atbash';
      if (a && a.length) return base;
      return base + '\n\n── ROOM HELPERS ──\n  ls / cat <file>                       list room files or print artifact contents\n  file <file>                           identify the current outer encoding layer\n  cat artifact.txt | base64 -d | hex -d chain multiple decoders with pipes (|)';
    };
    C.type = (a, s) => grab(a, s);
    C.clear = () => '';
    const runCrypto = raw => {
      let stdin = null, out = '';
      for (const seg of splitTop2(String(raw || '').trim(), ['|'])) {
        const w = argv2(seg);
        if (!w.length) continue;
        const head = w.shift().toLowerCase();
        const fn = C[head];
        if (!fn) return 'vault: ' + head + ': unknown command (try help)';
        out = String(fn(w, stdin) ?? '');
        stdin = out;
      }
      return out;
    };

    return {
      kind: 'encoded artifact', answer: ans, walkthrough,
      title: 'Labyrinth ' + d + ' · encoding vault',
      brief: 'artifact.txt is wrapped in ' + chain.length + ' encoding layer' + (chain.length === 1 ? '' : 's') + '. `file artifact.txt` names the current outer layer. Peel them one at a time (or chain them with `|`).',
      hint: 'Layer 1 is ' + chain[0] + '. After that: ' + (chain.slice(1).join(' → ') || 'nothing more') + '. Pipes work too: cat artifact.txt | ...',
      prompt: () => 'vault:' + d + '$ ',
      palette: [['file artifact.txt', 'identify the outer layer'], ['cat artifact.txt', 'read the encoded text'], ['base64 -d <text>', 'decode Base64'], ['hex -d <text>', 'decode hex'], ['rot13 <text>', 'ROT13'], ['morse -d <text>', 'Morse'], ['binary -d <text>', 'binary'], ['reverse <text>', 'reverse'], ['caesar <text>', 'undo a Caesar shift']],
      run: runCrypto, cmds: C, aliases: {}, decoders
    };
  }
  L.cryptoRoom = cryptoRoom;
})();

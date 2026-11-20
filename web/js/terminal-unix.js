// Shared behavior for the browser terminals' virtual Unix filesystems.
const TerminalUnix = (() => {
  const modes = new WeakMap();
  const mode = (node, directory = false) => modes.get(node) ?? (directory ? 0o755 : parseInt(node?.mode || (node?.locked ? '000' : '644'), 8));
  const octal = bits => bits.toString(8).padStart(3, '0');
  const permissions = (node, directory = false) => {
    const bits = mode(node, directory);
    return (directory ? 'd' : '-') + [6, 3, 0].map((shift, index) => {
      const digit = (bits >> shift) & 7;
      const execute = digit & 1;
      const special = bits & (0o4000 >> index);
      return (digit & 4 ? 'r' : '-') + (digit & 2 ? 'w' : '-') +
        (special ? (index === 2 ? (execute ? 't' : 'T') : (execute ? 's' : 'S')) : (execute ? 'x' : '-'));
    }).join('');
  };

  function compileMode(spec) {
    if (/^(?:[0-7]{1,4}|0[0-7]{4})$/.test(spec)) {
      const bits = parseInt(spec, 8);
      return (old, directory) => bits | (directory && spec.length < 5 ? old & 0o6000 : 0);
    }
    const clauses = spec.split(',').map(clause => {
      const numeric = /^([-+=])([0-7]{1,4})$/.exec(clause);
      if (numeric) return { numeric: [numeric[1], parseInt(numeric[2], 8)] };
      const match = /^([ugoa]*)((?:[-+=](?:[rwxXst]*|[ugo]))+)$/.exec(clause);
      if (!match) return null;
      const [, who, operations] = match;
      const targets = [6, 3, 0].filter((shift, index) => !who || who.includes('a') || who.includes('ugo'[index]));
      return { who, targets, operations: [...operations.matchAll(/([-+=])([ugo]|[rwxXst]*)/g)] };
    });
    if (clauses.some(clause => !clause)) return null;

    return (bits, directory) => {
      for (const { who, targets, operations, numeric } of clauses) {
        if (numeric) {
          const [op, mask] = numeric;
          bits = op === '+' ? bits | mask : op === '-' ? bits & ~mask : mask;
          continue;
        }
        for (const [, op, letters] of operations) {
          const source = /^[ugo]$/.test(letters) ? { u: 6, g: 3, o: 0 }[letters] : null;
          const digit = source !== null ? (bits >> source) & 7 :
            (letters.includes('r') ? 4 : 0) | (letters.includes('w') ? 2 : 0) |
            (letters.includes('x') || (letters.includes('X') && (directory || bits & 0o111)) ? 1 : 0);
          let change = 0, clear = 0;
          for (const shift of targets) {
            change |= digit << shift;
            clear |= 7 << shift;
            const special = { 6: 0o4000, 3: 0o2000, 0: 0o1000 }[shift];
            const setSpecial = letters.includes(shift === 0 ? 't' : 's');
            if (setSpecial) change |= special;
            if (!directory || shift === 0 || setSpecial) clear |= special;
          }
          // The virtual shells create files with umask 022.
          if (!who) change &= ~0o022;
          bits = op === '+' ? bits | change : op === '-' ? bits & ~change : (bits & ~clear) | change;
        }
      }
      return bits;
    };
  }

  function chmod(args, resolve, walk, isDir, mayChange = () => true) {
    let recursive = false, verbose = false, changes = false, quiet = false, options = true, reference;
    const operands = [];
    for (const arg of args) {
      if (options && arg === '--') { options = false; continue; }
      if (options && arg.startsWith('--reference=')) { reference = arg.slice(12); continue; }
      if (options && /^(?:-[Rvcf]+|--(?:recursive|verbose|changes|quiet|silent))$/.test(arg)) {
        const flags = arg.startsWith('--') ? { '--recursive': 'R', '--verbose': 'v', '--changes': 'c', '--quiet': 'f', '--silent': 'f' }[arg] : arg.slice(1);
        recursive ||= flags.includes('R'); verbose ||= flags.includes('v'); changes ||= flags.includes('c'); quiet ||= flags.includes('f');
      } else {
        operands.push(arg);
      }
    }
    const spec = reference === undefined ? operands.shift() : null;
    if (!operands.length) return { out: 'chmod: missing operand' + (spec ? " after '" + spec + "'" : ''), err: true };
    let apply;
    if (reference === undefined) apply = compileMode(spec);
    else {
      const node = reference && walk(resolve(reference));
      if (!node && node !== '') return { out: "chmod: failed to get attributes of '" + reference + "': No such file or directory", err: true };
      const bits = mode(node, isDir(node));
      apply = () => bits;
    }
    if (!apply) return { out: "chmod: invalid mode: '" + spec + "'", err: true };

    const lines = [];
    let err = false;
    const visit = (node, parts, path) => {
      if (node === undefined || !mayChange(parts, node)) {
        err = true;
        if (!quiet) lines.push(node === undefined ? "chmod: cannot access '" + path + "': No such file or directory" :
          "chmod: changing permissions of '" + path + "': Operation not permitted");
        return;
      }
      const directory = isDir(node);
      const before = mode(node, directory), after = apply(before, directory);
      if (typeof node === 'string') {
        const parent = walk(parts.slice(0, -1));
        node = parent[parts.at(-1)] = { text: node };
      }
      modes.set(node, after);
      if (verbose || (changes && before !== after)) {
        lines.push("mode of '" + path + "' " + (before === after ? 'retained as ' : 'changed to ') + octal(after));
      }
      if (recursive && directory) {
        for (const name of Object.keys(node)) visit(node[name], [...parts, name], path.replace(/\/$/, '') + '/' + name);
      }
    };
    for (const path of operands) {
      const parts = resolve(path);
      visit(walk(parts), parts, path);
    }
    return { out: lines.join('\n'), err };
  }

  function permissionStat(args, at, isDir) {
    const flag = args.findIndex(arg => arg === '-c' || arg === '--format' || arg.startsWith('--format='));
    if (flag < 0) return null;
    const inline = args[flag].startsWith('--format=');
    const format = inline ? args[flag].slice(9) : args[flag + 1];
    const paths = args.filter((arg, index) => index !== flag && (inline || index !== flag + 1) && arg !== '--');
    if (format === undefined || !paths.length) return { out: 'stat: missing operand', err: true };
    let err = false;
    const rows = paths.map(path => {
      const node = at(path);
      if (node === undefined) { err = true; return "stat: cannot stat '" + path + "': No such file or directory"; }
      const directory = isDir(node);
      return format.replace(/%./g, key => ({ '%a': octal(mode(node, directory)).replace(/^0+(?=.)/, ''),
        '%A': permissions(node, directory), '%n': path, '%%': '%' })[key] ?? '?');
    });
    return { out: rows.join('\n'), err };
  }

  function saveModes(tree, isDir) {
    const entries = [];
    function visit(node, path) {
      if (modes.has(node)) entries.push([path, modes.get(node)]);
      if (isDir(node)) {
        for (const [name, child] of Object.entries(node)) visit(child, [...path, name]);
      }
    }
    visit(tree, []);
    return entries;
  }

  function restoreModes(tree, entries) {
    if (!Array.isArray(entries)) return;
    for (const entry of entries) {
      if (!Array.isArray(entry)) continue;
      const [path, bits] = entry;
      if (!Array.isArray(path) || !Number.isInteger(bits) || bits < 0 || bits > 0o7777) continue;
      const node = path.reduce((parent, name) => parent && Object.hasOwn(parent, name) ? parent[name] : undefined, tree);
      if (node && typeof node === 'object') modes.set(node, bits);
    }
  }

  function checksum(algorithm, read) {
    return (args, stdin) => {
      const out = [];
      let err = false, options = true, binary = false, check = false;
      const files = [];
      for (const arg of args) {
        if (options && arg === '--') { options = false; continue; }
        if (options && (arg === '-c' || arg === '--check')) { check = true; continue; }
        if (options && ['-b', '--binary', '-t', '--text'].includes(arg)) {
          binary = arg === '-b' || arg === '--binary';
          continue;
        }
        if (options && arg !== '-' && arg.startsWith('-')) return { out: algorithm + "sum: unsupported option '" + arg + "'", err: true };
        files.push(arg);
      }
      for (const file of files.length ? files : ['-']) {
        const result = file === '-' ? { text: stdin ?? '' } : read(file);
        if (result.err) { out.push(algorithm + 'sum: ' + result.err); err = true; }
        else if (check) {
          const length = { md5: 32, sha1: 40, sha256: 64 }[algorithm];
          const pattern = new RegExp('^([0-9a-f]{' + length + '}) [ *](.+)$', 'i');
          let records = 0;
          for (const line of result.text.split(/\r?\n/)) {
            const record = pattern.exec(line);
            if (!record) continue;
            records++;
            const [, digest, target] = record;
            const contents = read(target);
            const passed = !contents.err && hashes[algorithm](contents.text) === digest.toLowerCase();
            out.push(target + ': ' + (passed ? 'OK' : contents.err ? 'FAILED open or read' : 'FAILED'));
            err ||= !passed;
          }
          if (!records) { out.push(algorithm + 'sum: ' + file + ': no properly formatted checksum lines found'); err = true; }
        } else out.push(hashes[algorithm](result.text) + (binary ? ' *' : '  ') + file);
      }
      return { out: out.join('\n'), err };
    };
  }

  const hashes = typeof module !== 'undefined' && module.exports ? require('./cyber-crack.js') : globalThis.TerminalDigests;
  return { chmod, mode, octal, permissions, permissionStat, checksum, saveModes, restoreModes };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = TerminalUnix;

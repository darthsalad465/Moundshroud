// python3 / pip inside the Terminal playground's sandbox.
// A command typed at the sandbox prompt is read from the shell's own virtual disk and executed by the bundled Pyodide
// runtime (web/vendor/pyodide), so real Python runs while the PC is never touched and the sandbox stays offline.
// The library set is what ships with the app: numpy, pandas, matplotlib, pillow, plus the bundled chess package.
(() => {
  const TP = window.TerminalPlayground = window.TerminalPlayground || {};
  const VERSION = 'Python 3.12.2 (Pyodide, offline sandbox)';
  const PIP = 'pip 24.0 (offline sandbox)';
  const BUNDLED = ['numpy', 'pandas', 'matplotlib', 'pillow', 'chess'];
  const LIBS = [{ name: 'chess.zip', url: '/web/vendor/python-libs/chess.zip' }];
  const MAX_FILES = 40, MAX_BYTES = 2 * 1024 * 1024;

  /* ---- reading the shell's virtual disk ---- */
  const textOf = node => node == null ? null : typeof node === 'string' ? node
    : typeof node === 'object' && typeof node.text === 'string' ? node.text : null;
  const isDir = node => node && typeof node === 'object' && !('text' in node);

  function nodeAt(tree, parts) {
    let node = tree;
    for (const part of parts) {
      if (!node || typeof node !== 'object' || 'text' in node) return undefined;
      const key = Object.keys(node).find(name => name === part);
      if (key == null) return undefined;
      node = node[key];
    }
    return node;
  }

  function resolvePath(target, ctx) {
    const raw = String(target).replace(/\\/g, '/');
    let parts = raw.startsWith('/') ? [] : (ctx.cwd || []).slice();
    if (/^~(?:\/|$)/.test(raw) && Array.isArray(ctx.home)) parts = ctx.home.slice();
    for (const step of raw.replace(/^~(?=\/|$)/, '').split('/')) {
      if (!step || step === '.') continue;
      if (step === '..') parts.pop();
      else parts.push(step);
    }
    return parts;
  }

  /* the text files next to the script, handed to Python as /data/<name> */
  function filesOf(dir) {
    const out = [];
    if (!dir || typeof dir !== 'object') return out;
    let bytes = 0;
    for (const name of Object.keys(dir).sort()) {
      if (out.length >= MAX_FILES) break;
      const text = textOf(dir[name]);
      if (text == null || bytes + text.length > MAX_BYTES) continue;
      bytes += text.length;
      out.push({ name, text });
    }
    return out;
  }

  /* ---- the command line ---- */
  function words(text) {
    const out = [];
    let current = '', quote = null, escaped = false, started = false;
    for (const ch of text) {
      if (escaped) { current += ch; escaped = false; started = true; continue; }
      if (ch === '\\' && quote !== "'") { escaped = true; continue; }
      if (quote) { if (ch === quote) quote = null; else current += ch; continue; }
      if (ch === '"' || ch === "'") { quote = ch; started = true; continue; }
      if (/\s/.test(ch)) { if (started || current) { out.push(current); current = ''; started = false; } continue; }
      current += ch; started = true;
    }
    if (started || current) out.push(current);
    return out;
  }

  /* a line that pipes, redirects or chains is left to the shell's own pipeline engine */
  function shellSyntax(text) {
    let quote = null, escaped = false;
    for (const ch of text) {
      if (escaped) { escaped = false; continue; }
      if (ch === '\\' && quote !== "'") { escaped = true; continue; }
      if (quote) { if (ch === quote) quote = null; continue; }
      if (ch === '"' || ch === "'") { quote = ch; continue; }
      if ('|&;<>`'.includes(ch)) return true;
    }
    return false;
  }

  const spec = (code, args, files, name) => ({ code, argv: [name, ...args], files });

  function python(args, ctx) {
    if (!args.length) return { text: VERSION + '\nRun a file:  python3 script.py   ·   one line:  python3 -c "print(2**10)"' };
    const first = args[0];
    if (first === '-V' || first === '--version') return { text: VERSION };
    if (first === '-h' || first === '--help') {
      return { text: 'usage: python3 [-c code | file.py] [arguments…]\n\n' +
        '  -c code      run one line of Python\n' +
        '  -V           print the version\n' +
        '  file.py      run a file from this sandbox disk (its folder\'s files are copied to /data)\n\n' +
        'Bundled libraries: ' + BUNDLED.join(', ') + '.' };
    }
    if (first === '-c') {
      if (args[1] == null) return { text: 'python3: argument expected for -c' };
      return spec(args[1], args.slice(2), [], '-c');
    }
    if (first === '-m') return { text: 'python3: -m is not available in this sandbox — run a script file instead' };
    if (first === '-') return { text: 'python3: reading a script from stdin is not available in this sandbox' };
    if (first.startsWith('-') && !/^-/.test(first.slice(1))) {
      return { text: 'python3: unknown option: ' + first };
    }
    const parts = resolvePath(first, ctx);
    const node = nodeAt(ctx.tree, parts);
    if (node === undefined) return { text: "python3: can't open file '" + first + "': [Errno 2] No such file or directory" };
    if (isDir(node)) return { text: "python3: can't open file '" + first + "': [Errno 21] Is a directory" };
    const code = textOf(node);
    if (code == null) return { text: "python3: can't open file '" + first + "': [Errno 13] Permission denied" };
    const folder = nodeAt(ctx.tree, parts.slice(0, -1));
    return spec(code, args.slice(1), filesOf(folder), parts.at(-1));
  }

  function pip(args) {
    const sub = args[0] || '';
    if (!sub || sub === '-h' || sub === '--help') {
      return { text: 'usage: pip <list|show|install|freeze>\n\nThis sandbox is offline: the bundled packages are ' + BUNDLED.join(', ') + '.' };
    }
    if (sub === '--version' || sub === '-V') return { text: PIP };
    if (sub === 'list') {
      return { text: 'Package    Version   Location\n---------- --------- ----------------------------------------------\n' +
        'matplotlib 3.5.2     /web/vendor/pyodide\n' +
        'numpy      1.26.4    /web/vendor/pyodide\n' +
        'pandas     2.2.0     /web/vendor/pyodide\n' +
        'pillow     10.2.0    /web/vendor/pyodide\n' +
        'chess      1.11.1    /libs/chess.zip' };
    }
    if (sub === 'freeze') return { text: 'chess==1.11.1\nmatplotlib==3.5.2\nnumpy==1.26.4\npandas==2.2.0\npillow==10.2.0' };
    if (sub === 'show') {
      const name = String(args[1] || '').toLowerCase();
      if (!BUNDLED.includes(name)) return { text: 'WARNING: Package(s) not found: ' + (args[1] || '') };
      return { text: 'Name: ' + name + '\nVersion: bundled\nLocation: /web/vendor/pyodide' };
    }
    if (sub === 'install' || sub === 'download') {
      const wanted = args.slice(1).filter(arg => !arg.startsWith('-'));
      const known = wanted.filter(name => BUNDLED.includes(name.split(/[=<>~!]/)[0].toLowerCase()));
      const unknown = wanted.filter(name => !BUNDLED.includes(name.split(/[=<>~!]/)[0].toLowerCase()));
      const lines = [];
      for (const name of known) lines.push('Requirement already satisfied: ' + name + ' (bundled)');
      if (unknown.length) {
        lines.push('ERROR: this sandbox is offline, so nothing can be downloaded. Not installed: ' + unknown.join(', '));
        lines.push('Bundled here: ' + BUNDLED.join(', ') + '.');
      }
      if (!lines.length) lines.push('ERROR: You must give at least one requirement to install.');
      return { text: lines.join('\n') };
    }
    return { text: 'pip: unknown command "' + sub + '" (try pip list)' };
  }

  function parse(cmd, ctx) {
    const line = String(cmd == null ? '' : cmd).trim();
    const match = /^(python3?|py|pip3?)(?=$|\s)/.exec(line);
    if (!match) return null;
    if (ctx.shell !== 'bash') return null;
    const tail = line.slice(match[0].length).trim();
    if (shellSyntax(tail)) return null;
    const args = words(tail);
    return /^pip/.test(match[1]) ? pip(args) : python(args, ctx);
  }

  /* ---- running it ---- */
  let session = null, libsPromise = null;

  function close() {
    if (session) { try { session.close(); } catch (e) { } session = null; }
  }

  function libs() {
    if (!libsPromise) {
      libsPromise = Promise.all(LIBS.map(async lib => {
        const response = await fetch(A.interpreterAssets ? A.interpreterAssets + 'python-libs/' + lib.name : lib.url);
        if (!response.ok) throw new Error(lib.url + ' is missing');
        return { name: lib.name, data: await response.arrayBuffer() };
      })).catch(() => []);
    }
    return libsPromise;
  }

  /* Pyodide frames above the user's own line are noise in a terminal: keep the traceback from the script's frame. */
  function tidy(error) {
    const lines = String(error || '').split('\n');
    const at = lines.findIndex(line => /File "<exec>"/.test(line));
    if (at <= 0) return String(error || '');
    return ['Traceback (most recent call last):', ...lines.slice(at)].join('\n');
  }

  async function run(spec) {
    if (typeof A === 'undefined' || !A.interp || !A.interp.session) return { ok: false, text: 'python: the code interpreter is not loaded.' };
    if (!session) session = A.interp.session();
    try {
      const result = await session.run(spec.code, { files: spec.files, libs: await libs(), argv: spec.argv, collectFigures: false });
      const stdout = String(result.stdout || '').trim();
      const error = result.ok ? '' : tidy(result.error).trim();
      return { ok: !!result.ok, text: [stdout, error].filter(Boolean).join('\n') };
    } catch (e) {
      return { ok: false, text: 'python: ' + (e && e.message || e) };
    }
  }

  TP.python = { parse, run, reset: close, version: VERSION, bundled: BUNDLED.slice() };
})();

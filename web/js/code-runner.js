// The safe terminal: runs a file from Notes (or any file on this PC) in the same sandboxes as the Code Playground,
// then keeps a working command prompt under it. The prompt is the app's own simulated Bash over an in-memory folder
// (not a real Linux machine and not this PC); python3 / pip lines are executed by the bundled interpreter, so the
// window behaves like a terminal while the PC's files, network and programs are never touched.
// Python and JavaScript run in a sealed Web Worker with no network and no access to the page; SQLite and the small
// interpreters run in their own workers; HTML runs in an isolated frame with no network; native languages run in
// Windows Sandbox or Docker, and are refused when neither is ready.
// A.codeRunner.open({name, code, input}) · A.codeRunner.openFile() · A.codeRunner.run({name, code, input})
(() => {
  'use strict';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const EXT = {
    py: 'python', pyw: 'python', js: 'javascript', mjs: 'javascript', cjs: 'javascript', jsx: 'javascript', node: 'nodejs',
    html: 'html', htm: 'html', xhtml: 'html', sql: 'sql', css: null,
    sh: 'bash', bash: 'bash', ps1: 'powershell', bat: 'batch', cmd: 'batch', vbs: 'vbscript', jse: 'jscript',
    c: 'c', h: 'c', cpp: 'cpp', cc: 'cpp', cxx: 'cpp', hpp: 'cpp', asm: 'masm', s: 'masm',
    rs: 'rust', cs: 'csharp', fs: 'fsharp', vb: 'vbnet', ts: 'typescript',
    pl: 'perl', awk: 'awk', sed: 'sed', go: 'go', java: 'java', kt: 'kotlin', kts: 'kotlin', swift: 'swift',
    php: 'php', rb: 'ruby', lua: 'lua', hs: 'haskell', zig: 'zig', nim: 'nim', lisp: 'commonlisp', clj: 'clojure',
    erl: 'erlang', ex: 'elixir', exs: 'elixir', ml: 'ocaml', r: 'r', jl: 'julia', f90: 'fortran', pas: 'pascal',
    cob: 'cobol', d: 'd', cr: 'crystal', scala: 'scala', dart: 'dart', wat: 'wat', bf: 'bf', ook: 'ook',
    'f': 'forth', forth: 'forth', scm: 'scheme', scheme: 'scheme', pro: 'prolog', prolog: 'prolog', bas: 'basic',
  };
  const isCodeName = name => !!langFor(name);
  const PREVIEW_CSP = "default-src 'none'; script-src 'unsafe-inline' 'unsafe-eval' blob: data:; style-src 'unsafe-inline'; img-src data: blob:; font-src data: blob:; media-src data: blob:; connect-src 'none'; frame-src 'none'; form-action 'none'; base-uri 'none'";
  const previewDoc = code => window.PlayLangs && typeof window.PlayLangs.previewDoc === 'function'
    ? window.PlayLangs.previewDoc(code, true)
    : '<meta http-equiv="Content-Security-Policy" content="' + PREVIEW_CSP + '">' + String(code == null ? '' : code);
  function langFor(name) {
    const m = String(name || '').toLowerCase().match(/\.([a-z0-9]+)$/);
    if (!m) return null;
    const id = EXT[m[1]];
    if (!id) return null;
    const l = window.PlayLangs && window.PlayLangs.byId ? window.PlayLangs.byId(id) : null;
    return l || { id, n: id, run: 'local' };
  }

  /* ---------- running ---------- */
  function runWorker(url, msg, signal, ms, slow) {
    return new Promise(resolve => {
      const worker = new Worker(url);
      const timeout = setTimeout(() => finish({ ok: false, error: slow }), ms);
      const abort = () => finish({ ok: false, error: 'Run stopped.' });
      function finish(result) {
        clearTimeout(timeout);
        signal && signal.removeEventListener('abort', abort);
        worker.terminate();
        resolve(result);
      }
      signal && signal.addEventListener('abort', abort, { once: true });
      worker.onmessage = event => finish(event.data);
      worker.onerror = event => finish({ ok: false, error: event.message || 'The interpreter could not start.' });
      worker.postMessage(msg);
    });
  }

  async function runLang(l, code, input, signal) {
    const t0 = Date.now();
    let r;
    try {
      /* interp.js can still be loading when the very first window opens, so give it a moment instead of failing */
      if (l.run === 'py' || l.run === 'js') for (let i = 0; i < 30 && !(A.interp && A.interp.run); i++) await new Promise(done => setTimeout(done, 100));
      if (l.run === 'py') r = await A.interp.run('python', code, { isolated: true, signal });
      else if (l.run === 'js') r = await A.interp.run('js', code, { isolated: true, signal });
      else if (l.run === 'html') r = { ok: true, stdout: '', html: code };
      else if (l.run === 'sql') r = await runWorker('/web/js/code-playground-sql.js', code, signal, 10000, 'SQL stopped after 10 seconds.');
      else if (l.run === 'eso') r = await runWorker('/web/js/esolang-worker.js', { lang: l.id, code, input, ms: 10000 }, signal, 15000, 'Stopped after 15 seconds.');
      else if (l.run === 'binary') r = { ok: false, error: 'Binary & Hex is an exercise in the Playground, not a language that runs a file.' };
      else r = { ok: false, error: 'Native code is disabled: this build runs code only inside the browser sandbox, so nothing here reaches your PC. Python, JavaScript, HTML, SQL and the classic interpreters still run.' };
    } catch (error) {
      r = { ok: false, error: signal && signal.aborted ? 'Run stopped.' : (error.message || String(error)) };
    }
    r = r || { ok: false, error: 'The program did not run.' };
    r.ms = r.ms !== undefined ? r.ms : Date.now() - t0;
    r.lang = l.n || l.id;
    return r;
  }
  function run({ name, code, input }) {
    const l = langFor(name);
    if (!l) return Promise.resolve({ ok: false, error: 'This kind of file is not one of the languages the sandbox can run. Name it with an extension like .py, .js, .html, .sql, .sh or .c.' });
    return runLang(l, String(code || ''), String(input || ''), null);
  }

  /* ---------- the terminal window ---------- */
  const CSS = '<style id="trmcss">' +
    '.trm-back{position:fixed;inset:0;background:rgba(4,6,12,.62);backdrop-filter:blur(3px);z-index:280;display:flex;align-items:center;justify-content:center;padding:14px}' +
    '.trm-win{width:min(940px,100%);max-height:min(88vh,820px);display:flex;flex-direction:column;border-radius:14px;overflow:hidden;border:1px solid #26314a;background:#0b0f17;box-shadow:0 30px 90px rgba(0,0,0,.6);font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;color:#d7e0f5}' +
    '.trm-bar{display:flex;align-items:center;gap:8px;padding:9px 12px;background:#141b28;border-bottom:1px solid #26314a;font-size:12.5px}' +
    '.trm-dots{display:flex;gap:5px}.trm-dots i{width:10px;height:10px;border-radius:50%;display:block;background:#4a5568}.trm-dots i:first-child{background:#e05c5c}.trm-dots i:nth-child(2){background:#e0b44c}.trm-dots i:nth-child(3){background:#4caf7d}' +
    '.trm-name{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#9fb0cf}' +
    '.trm-bar button{border:1px solid #2c3852;background:#1b2434;color:#cfd9ee;border-radius:7px;padding:3px 9px;font:inherit;font-size:11.5px;cursor:pointer}.trm-bar button:hover{background:#243049}' +
    '.trm-body{flex:1;min-height:220px;overflow:auto;padding:12px 14px;font-size:13px;line-height:1.5;white-space:pre-wrap;word-break:break-word;background:radial-gradient(circle at 15% 0%,rgba(64,110,255,.10),transparent 60%)}' +
    '.trm-body .p{color:#5ee1a1}.trm-body .c{color:#8fa4c8}.trm-body .e{color:#ff9a9a}.trm-body .n{color:#ffd479}.trm-body .o{color:#dbe4f7}' +
    '.trm-src{margin:0;white-space:pre-wrap;color:#b9c7e4}.trm-frame{width:100%;height:340px;border:1px solid #26314a;border-radius:9px;background:#fff}' +
    '.trm-foot{border-top:1px solid #26314a;padding:8px 12px;display:flex;flex-wrap:wrap;gap:8px;align-items:center;background:#101725}' +
    '.trm-in{flex:1;display:flex;align-items:center;gap:6px;min-width:220px;background:#080c14;border:1px solid #2c3852;border-radius:7px;padding:4px 8px}' +
    '.trm-in .trm-ps1{color:#5ee1a1;white-space:nowrap;font-size:12.5px}' +
    '.trm-in input{flex:1;min-width:60px;background:transparent;border:0;outline:none;color:#d7e0f5;font:inherit;font-size:13px;padding:3px 0}' +
    '.trm-tools{display:flex;flex-wrap:wrap;gap:8px;align-items:center;width:100%}' +
    '.trm-cmd .p{color:#5ee1a1}.trm-cmd{white-space:pre-wrap}' +
    '.trm-hint{font-size:11px;color:#7d8dad;flex:1;min-width:120px}' +
    '</style>';

  let openWin = null;
  function close() { if (openWin) { const x = openWin; openWin = null; if (x._cleanup) x._cleanup(); x.remove(); } }

  function open(opts) {
    opts = opts || {};
    close();
    if (!document.getElementById('trmcss')) { const d = document.createElement('div'); d.innerHTML = CSS; document.head.appendChild(d.firstChild); }
    const back = document.createElement('div'); back.className = 'trm-back';
    back.innerHTML = '<div class="trm-win" role="dialog" aria-label="Sandbox terminal">' +
      '<div class="trm-bar"><span class="trm-dots"><i></i><i></i><i></i></span><span class="trm-name">🖥️ Safe terminal · ' + esc(opts.name || 'sandbox') + '</span>' +
      '<button data-trm="stop" hidden>■ Stop</button><button data-trm="close" title="Close (Esc)">✕</button></div>' +
      '<div class="trm-body" data-trm="body"></div>' +
      '<div class="trm-foot">' +
      '<div class="trm-in"><span class="trm-ps1" data-trm="ps1"></span>' +
      '<input data-trm="line" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" aria-label="Command" placeholder="Type a command and press Enter — help, ls, cat README.md, python3 hello.py"></div>' +
      '<div class="trm-tools">' +
      '<button data-trm="again" style="border:1px solid #3a4a68;background:#1d5f45;color:#dff7ec;border-radius:8px;padding:7px 13px;font:inherit;font-size:12px;cursor:pointer">▶ Run again</button>' +
      '<button data-trm="file" style="border:1px solid #3a4a68;background:#1b2434;color:#cfd9ee;border-radius:8px;padding:7px 13px;font:inherit;font-size:12px;cursor:pointer">📂 Open a file from this PC</button>' +
      '<button data-trm="input" style="border:1px solid #3a4a68;background:#1b2434;color:#cfd9ee;border-radius:8px;padding:7px 13px;font:inherit;font-size:12px;cursor:pointer">⌨ Program input…</button>' +
      '<span class="trm-hint" data-trm="hint"></span></div></div></div>';
    document.body.appendChild(back);
    openWin = back;
    const $ = s => back.querySelector('[data-trm="' + s + '"]');
    const body = $('body');
    let ctl = null, busy = false, last = { name: opts.name || 'sandbox', code: String(opts.code || '') };
    const line = (cls, text) => { const d = document.createElement('div'); if (cls) d.className = cls; d.textContent = text; body.appendChild(d); body.scrollTop = body.scrollHeight; return d; };
    const hint = t => { $('hint').textContent = t; };

    /* ---------- the prompt: this window is a terminal, not just a report ---------- */
    const TP = window.TerminalPlayground;
    const shell = TP && typeof TP.makeBash === 'function' ? TP.makeBash() : null;
    const HOME = ['home', 'dev'];
    let stdinText = '', cmdBusy = false;
    const promptText = () => (shell ? shell.prompt() : 'sandbox $ ');
    const paintPrompt = () => { const el = $('ps1'); if (el) el.textContent = promptText(); };
    /* the file the window was opened for is copied onto the sandbox disk, so its own folder works like a normal one */
    let imported = null;
    if (shell && last.code.trim()) { try { imported = shell.importFile(last.name, last.code); } catch (e) { imported = null; } }
    paintPrompt();

    async function command(text) {
      const cmd = String(text == null ? '' : text).trim();
      if (!cmd || cmdBusy) return;
      const echo = document.createElement('div');
      echo.className = 'trm-cmd';
      const ps1 = document.createElement('span'); ps1.className = 'p'; ps1.textContent = promptText();
      echo.appendChild(ps1); echo.appendChild(document.createTextNode(cmd));
      body.appendChild(echo); body.scrollTop = body.scrollHeight;
      if (/^(?:clear|cls)$/i.test(cmd)) { body.innerHTML = ''; paintPrompt(); return; }
      if (/^(?:exit|logout)$/i.test(cmd)) return close();
      const snap = shell ? (shell.snapshot() || {}) : {};
      const spec = shell && TP.python ? TP.python.parse(cmd, { shell: 'bash', tree: snap.fs, cwd: snap.cwd, home: HOME }) : null;
      if (spec) {
        if (spec.text != null) { if (spec.text) line('o', spec.text); }
        else {
          cmdBusy = true;
          const wait = line('c', 'python: starting the bundled interpreter (the first run takes a few seconds)…');
          try {
            const result = await TP.python.run(spec);
            if (!openWin) return;
            wait.className = 'o';
            wait.textContent = result.text || '(python finished with no output)';
          } catch (e) {
            wait.className = 'e';
            wait.textContent = 'python: ' + (e && e.message || e);
          } finally { cmdBusy = false; }
        }
      } else if (shell) {
        let out = '';
        try { out = shell.run(cmd); } catch (e) { out = 'sandbox: ' + (e && e.message || e); }
        if (out) line('o', String(out));
      } else {
        line('e', 'The sandbox did not load, so commands cannot run here.');
      }
      paintPrompt();
      body.scrollTop = body.scrollHeight;
    }

    const input = $('line'), hist = [];
    let hi = 0;
    const baseHint = () => imported
      ? 'Copied ' + imported + ' into the sandbox — try ls, cat ' + last.name + ', or python3 ' + last.name + '.'
      : (shell ? 'A simulated shell over an in-memory folder. Nothing on this PC is touched.' : '');
    hint(baseHint());
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const value = input.value;
        input.value = '';
        if (value.trim()) { hist.push(value); hi = hist.length; }
        command(value);
      } else if (e.key === 'ArrowUp') {
        if (!hist.length) return;
        e.preventDefault();
        hi = Math.max(0, Math.min(hi, hist.length) - 1);
        input.value = hist[hi];
      } else if (e.key === 'ArrowDown') {
        if (!hist.length) return;
        e.preventDefault();
        hi = Math.min(hist.length, hi + 1);
        input.value = hi >= hist.length ? '' : hist[hi];
      }
    });
    body.onclick = e => { if (!e.target.closest('iframe')) input.focus(); };

    async function go() {
      if (busy) return;
      const name = last.name, code = last.code;
      if (!code.trim()) { body.innerHTML = ''; line('e', 'This file is empty, so there is nothing to run.'); return; }
      const l = langFor(name);
      busy = true; ctl = new AbortController();
      $('stop').hidden = false;
      const out = document.createElement('div');
      out.className = 'trm-out';
      const browserLang = l && ['py', 'js', 'sql', 'eso', 'binary'].includes(l.run);
      const startNote = !l ? 'Checking this file type…'
        : l.run === 'html' ? 'Rendering in an isolated frame — scripts run, but the frame has no network and cannot see Moundshroud or your files.'
          : browserLang ? 'Running in a sealed browser worker — no network and no access to this page or this PC\'s files.'
            : 'Starting the sandbox — native code runs only in Windows Sandbox or Docker, never as your Windows user.';
      out.innerHTML = '<div class="p">moundshroud@sandbox <span class="c">~</span> % ' + esc('run ' + name) + '</div>' +
        '<div class="c">' + esc(startNote) + '</div>' +
        '<div class="c" data-trm="wait">Working...</div>';
      body.appendChild(out); body.scrollTop = body.scrollHeight;
      const wait = out.querySelector('[data-trm="wait"]');
      const t = setInterval(() => { if (wait) wait.textContent = 'Working' + '.'.repeat(1 + (Date.now() / 400 | 0) % 3); }, 400);
      let r, timedOut = false;
      /* a native run can wait for a VM to start, but it never hangs: after two minutes the window still reports an outcome */
      const guard = setTimeout(() => { timedOut = true; ctl.abort(); }, 150000);
      try { r = await runLang(l || { id: 'none', n: 'this file type', run: 'none' }, code, stdinText, ctl.signal); }
      finally { clearTimeout(guard); clearInterval(t); busy = false; if (ctl) ctl = null; $('stop').hidden = true; }
      if (!openWin) return;
      wait.remove();
      if (timedOut) r = { ok: false, error: 'The sandbox did not answer within 2 minutes — it may still be starting. Press Run again.' };
      r = r || { ok: false, error: 'The program did not run.' };
      if (!l) { line('e', '✗ This file type cannot run in the sandbox. Use an extension like .py, .js, .html, .sql, .sh or .c.'); return; }
      if (r.html !== undefined) {
        const holder = document.createElement('div');
        holder.style.margin = '6px 0';
        out.appendChild(holder);
        if (window.CodeStage) {
          const stage = window.CodeStage.mount(holder, {
            title: '🖥 ' + (last.name || 'Preview'), height: 340,
            hint: 'Click the screen, then use its keys',
            empty: 'Nothing to show.',
            onLog: (text, kind) => line(kind === 'error' ? 'e' : 'c', (kind === 'error' ? '⛔ ' : '') + text)
          });
          stage.show(r.html);
        } else {
          const fr = document.createElement('iframe');
          fr.className = 'trm-frame'; fr.setAttribute('sandbox', 'allow-scripts allow-modals');
          fr.setAttribute('referrerpolicy', 'no-referrer');
          fr.srcdoc = previewDoc(r.html);
          out.appendChild(fr);
        }
        line('c', 'Shown in an isolated screen: scripts run in an opaque origin with no network, so the page cannot see Moundshroud or your files. Use ⛶ Full screen to play.');
      } else {
        /* a program that drew something shows it here too, and it can be zoomed, panned and played */
        if (r.figures && r.figures.length && window.CodeStage) {
          const holder = document.createElement('div');
          holder.style.margin = '8px 0';
          out.appendChild(holder);
          const stage = window.CodeStage.mount(holder, {
            title: '🖼 What ' + (last.name || 'the program') + ' drew', height: 300,
            hint: 'Drag to move · wheel to zoom · ▶ to play the frames', empty: 'Nothing to show.'
          });
          stage.showDoc(window.CodeStage.pictures(r.figures));
        }
        const text = [r.stdout, r.stderr, r.value !== undefined && r.value !== '' ? '→ ' + r.value : ''].filter(x => x !== undefined && x !== '').map(x => String(x).replace(/\r?\n$/, '')).join('\n');
        if (text) { const pre = document.createElement('pre'); pre.className = 'trm-src'; pre.textContent = text; out.appendChild(pre); }
        const e = String(r.error || 'The program did not finish.').split('\n').filter(x => !/^\s+at\s/.test(x)).join('\n').trim() || 'The program did not finish.';
        if (r.unavailable) {
          line('e', '⛔ ' + e);
          line('c', 'Nothing was run. Native code needs Windows Sandbox or Docker; see the setup notes in the Code Playground.');
        } else {
          if (!r.ok) line('e', '✗ ' + e);
          else if (!text) line('c', 'Finished with no output.');
          const backend = r.backend === 'windows-sandbox' ? 'Windows Sandbox' : r.backend === 'docker' ? 'Docker sandbox'
            : l.run === 'html' ? 'isolated preview' : browserLang ? 'sealed browser worker' : 'sandbox';
          line('c', '— exit ' + (r.ok ? 0 : 1) + ' · ' + (r.ms || 0) + ' ms · ' + (r.lang || l.n) + ' · ' + backend + ' · nothing on this PC was touched');
        }
      }
      body.scrollTop = body.scrollHeight;
      if (r.unavailable) hint('Native code needs Windows Sandbox or Docker; the Code Playground page shows the one-time setup.');
      else if (!r.ok) hint('The error is above. You can edit the file and press Run again.');
      else hint(baseHint());
    }

    back.onclick = e => {
      const b = e.target.closest('[data-trm]');
      if (e.target === back) return close();
      if (!b) return;
      const a = b.dataset.trm;
      if (a === 'close') close();
      else if (a === 'stop') { if (ctl) ctl.abort(); }
      else if (a === 'again') { go(); input.focus(); }
      else if (a === 'file') pickFile(f => {
        last = { name: f.name, code: f.text };
        if (shell) { try { imported = shell.importFile(f.name, f.text); } catch (e) { imported = null; } }
        back.querySelector('.trm-name').textContent = '🖥️ Safe terminal · ' + f.name;
        body.innerHTML = '';
        line('c', f.name + (f.path ? ' · ' + f.path : ''));
        hint(baseHint());
        go(); input.focus();
      });
      else if (a === 'input') A.prompt('Input for the program (stdin)', stdinText, { title: 'Program input' }).then(value => {
        if (value == null) return;
        stdinText = String(value);
        hint(stdinText ? 'Input ready — Run again feeds it to the file.' : 'No input for the file.');
      }).catch(() => { });
    };
    const onKey = e => { if (e.key === 'Escape' && openWin === back) { e.stopPropagation(); close(); } };
    document.addEventListener('keydown', onKey, true);
    back._cleanup = () => document.removeEventListener('keydown', onKey, true);
    if (opts.auto !== false) go();
    input.focus();
    return back;
  }

  /* ---------- picking a file from this PC ---------- */
  const PICK = ['py', 'pyw', 'js', 'mjs', 'ts', 'html', 'htm', 'sql', 'sh', 'bash', 'ps1', 'bat', 'cmd', 'c', 'h', 'cpp', 'hpp', 'cs', 'rs', 'go', 'java', 'php', 'rb', 'lua', 'pl', 'awk', 'sed', 'kt', 'swift', 'txt'];
  function pickFile(done) {
    const inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = PICK.map(e => '.' + e).join(',');
    inp.style.display = 'none';
    document.body.appendChild(inp);
    inp.onchange = () => {
      const f = inp.files && inp.files[0];
      inp.remove();
      if (!f) return;
      if (f.size > 2 * 1024 * 1024) return A.toast('That file is larger than 2 MB.');
      const rd = new FileReader();
      rd.onload = () => done({ name: f.name, text: String(rd.result || '') });
      rd.onerror = () => A.toast('That file could not be read.');
      rd.readAsText(f);
    };
    inp.click();
  }
  function openFile() {
    pickFile(f => open({ name: f.name, code: f.text }));
  }

  A.codeRunner = { open, run, openFile, pickFile, langFor, isCodeName, close };
})();

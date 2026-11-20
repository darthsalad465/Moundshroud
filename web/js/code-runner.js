// The safe terminal: runs a file from Notes (or any file on this PC) in the same sealed sandboxes as the Code
// Playground, then shows what it printed in a terminal window of its own. Python and JavaScript run in a Web Worker
// with no network and no access to the page; SQLite and the small interpreters run in their own workers; compiled
// languages run through the Playground's server runner, which uses a fresh temporary folder and a time limit.
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
      if (l.run === 'py') r = await A.interp.run('python', code, { isolated: true, signal });
      else if (l.run === 'js') r = await A.interp.run('js', code, { isolated: true, signal });
      else if (l.run === 'html') r = { ok: true, stdout: '', html: code };
      else if (l.run === 'sql') r = await runWorker('/web/js/code-playground-sql.js', code, signal, 10000, 'SQL stopped after 10 seconds.');
      else if (l.run === 'eso') r = await runWorker('/web/js/esolang-worker.js', { lang: l.id, code, input, ms: 10000 }, signal, 15000, 'Stopped after 15 seconds.');
      else if (l.run === 'binary') r = { ok: false, error: 'Binary & Hex is an exercise in the Playground, not a language that runs a file.' };
      else {
        const res = await fetch('/api/code-playground/run', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lang: l.id, code, input: input || '' }), signal,
        });
        r = await res.json();
      }
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
    '.trm-foot textarea{flex:1;min-width:140px;height:34px;resize:vertical;background:#080c14;border:1px solid #2c3852;border-radius:7px;color:#d7e0f5;padding:6px 8px;font:inherit;font-size:12px}' +
    '.trm-hint{font-size:11px;color:#7d8dad;width:100%}' +
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
      '<div class="trm-foot"><textarea data-trm="stdin" placeholder="Input for the program (stdin), one line per read" spellcheck="false"></textarea>' +
      '<button data-trm="again" style="border:1px solid #3a4a68;background:#1d5f45;color:#dff7ec;border-radius:8px;padding:7px 13px;font:inherit;font-size:12px;cursor:pointer">▶ Run again</button>' +
      '<button data-trm="file" style="border:1px solid #3a4a68;background:#1b2434;color:#cfd9ee;border-radius:8px;padding:7px 13px;font:inherit;font-size:12px;cursor:pointer">📂 Open a file from this PC</button>' +
      '<span class="trm-hint" data-trm="hint"></span></div></div>';
    document.body.appendChild(back);
    openWin = back;
    const $ = s => back.querySelector('[data-trm="' + s + '"]');
    const body = $('body');
    let ctl = null, busy = false, last = { name: opts.name || 'sandbox', code: String(opts.code || '') };
    const line = (cls, text) => { const d = document.createElement('div'); if (cls) d.className = cls; d.textContent = text; body.appendChild(d); body.scrollTop = body.scrollHeight; return d; };
    const hint = t => { $('hint').textContent = t; };

    async function go() {
      if (busy) return;
      const name = last.name, code = last.code;
      if (!code.trim()) { body.innerHTML = ''; line('e', 'This file is empty, so there is nothing to run.'); return; }
      const l = langFor(name);
      busy = true; ctl = new AbortController();
      $('stop').hidden = false;
      const out = document.createElement('div');
      out.className = 'trm-out';
      out.innerHTML = '<div class="p">moundshroud@sandbox <span class="c">~</span> % ' + esc('run ' + name) + '</div>' +
        '<div class="c">Running in the sealed sandbox — no network, no access to this PC\'s files.</div>' +
        '<div class="c" data-trm="wait">Working...</div>';
      body.appendChild(out); body.scrollTop = body.scrollHeight;
      const wait = out.querySelector('[data-trm="wait"]');
      const t = setInterval(() => { if (wait) wait.textContent = 'Working' + '.'.repeat(1 + (Date.now() / 400 | 0) % 3); }, 400);
      let r;
      try { r = await runLang(l || { id: 'none', n: 'this file type', run: 'none' }, code, $('stdin').value, ctl.signal); }
      finally { clearInterval(t); busy = false; if (ctl) ctl = null; $('stop').hidden = true; }
      if (!openWin) return;
      wait.remove();
      if (!l) { line('e', '✗ This file type cannot run in the sandbox. Use an extension like .py, .js, .html, .sql, .sh or .c.'); return; }
      if (r.html !== undefined) {
        const fr = document.createElement('iframe');
        fr.className = 'trm-frame'; fr.setAttribute('sandbox', 'allow-scripts allow-forms allow-popups allow-modals');
        fr.srcdoc = r.html;
        out.appendChild(fr);
        line('c', 'Shown in a sealed frame: scripts run, but the page cannot see Moundshroud or your files.');
      } else {
        const text = [r.stdout, r.stderr, r.value !== undefined && r.value !== '' ? '→ ' + r.value : ''].filter(x => x !== undefined && x !== '').map(x => String(x).replace(/\r?\n$/, '')).join('\n');
        if (text) { const pre = document.createElement('pre'); pre.className = 'trm-src'; pre.textContent = text; out.appendChild(pre); }
        if (!r.ok) { const e = String(r.error || 'The program did not finish.').split('\n').filter(x => !/^\s+at\s/.test(x)).join('\n'); line('e', '✗ ' + e); }
        else if (!text) line('c', 'Finished with no output.');
        line('c', '— exit ' + (r.ok ? 0 : 1) + ' · ' + (r.ms || 0) + ' ms · ' + (r.lang || l.n) + ' · nothing on this PC was touched');
      }
      body.scrollTop = body.scrollHeight;
      if (!r.ok) hint('If the tools for this language are not installed, the Playground shows which ones it can run.');
      else hint('');
    }

    back.onclick = e => {
      const b = e.target.closest('[data-trm]');
      if (e.target === back) return close();
      if (!b) return;
      const a = b.dataset.trm;
      if (a === 'close') close();
      else if (a === 'stop') { if (ctl) ctl.abort(); }
      else if (a === 'again') go();
      else if (a === 'file') pickFile(f => { last = { name: f.name, code: f.text }; back.querySelector('.trm-name').textContent = '🖥️ Safe terminal · ' + f.name; body.innerHTML = ''; line('c', f.name + (f.path ? ' · ' + f.path : '')); go(); });
    };
    const onKey = e => { if (e.key === 'Escape' && openWin === back) { e.stopPropagation(); close(); } };
    document.addEventListener('keydown', onKey, true);
    back._cleanup = () => document.removeEventListener('keydown', onKey, true);
    if (opts.auto !== false) go();
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

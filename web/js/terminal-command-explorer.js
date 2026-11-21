// Command Explorer (Help / Guide): a safe terminal beside a searchable list of every command in every playground
// terminal. Each terminal is a private copy made by the playground's own shell factories, so exploring here never
// touches a puzzle, a job, the Labyrinth or the sandbox you are playing in — and nothing here reaches this PC.
(() => {
  'use strict';
  const TP = window.TerminalPlayground;
  const esc = value => String(value == null ? '' : value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  /* id, display name, icon, factory on TerminalPlayground */
  const MAKERS = [
    ['bash', 'Bash / Linux', '🐧', 'makeBash'],
    ['powershell', 'PowerShell', '🪟', 'makePowershell'],
    ['cmd', 'Command Prompt', '⌨️', 'makeCmd'],
    ['python', 'Python', '🐍', 'makePython'],
    ['node', 'Node.js', '🟩', 'makeNode'],
    ['sql', 'SQL', '🗄️', 'makeSql'],
    ['git', 'Git', '🌿', 'makeGit'],
    ['docker', 'Docker', '🐳', 'makeDocker'],
    ['network', 'Network', '🌐', 'makeNetwork'],
    ['crypto', 'Crypto', '🔐', 'makeCrypto'],
    ['pentest', 'Web pentest range', '🕸️', 'makePentest'],
    ['remote', 'Remote PC range', '🖥️', 'makeRemoteRange'],
  ];
  const MAX_ROWS = 500, MAX_OUTPUT = 260;

  function styles() {
    if (document.getElementById('tce-style')) return;
    const style = document.createElement('style');
    style.id = 'tce-style';
    style.textContent = [
      '.tce-wrap{border:1px solid var(--line);border-radius:14px;background:var(--panel);overflow:hidden;margin:12px 0;font-size:13px}',
      '.tce-head{display:flex;gap:8px;flex-wrap:wrap;align-items:center;padding:9px 12px;border-bottom:1px solid var(--line);background:var(--panel2)}',
      '.tce-head b{font-size:15px}.tce-head .tce-count{color:var(--mute);font-size:12px}',
      '.tce-tabs{display:flex;gap:5px;flex-wrap:wrap;padding:8px 10px;border-bottom:1px solid var(--line)}',
      '.tce-tab{border:1px solid var(--line);background:transparent;color:var(--mute);border-radius:999px;padding:3px 10px;font-size:12px;cursor:pointer;font-family:inherit}',
      '.tce-tab:hover{color:var(--text);border-color:var(--acc)}',
      '.tce-tab.on{background:var(--acc);color:#0b0d14;border-color:var(--acc);font-weight:700}',
      '.tce-body{display:grid;grid-template-columns:minmax(240px,1fr) minmax(280px,1.15fr)}',
      '@media(max-width:760px){.tce-body{grid-template-columns:1fr}}',
      '.tce-left{display:flex;flex-direction:column;min-width:0;border-right:1px solid var(--line)}',
      '@media(max-width:760px){.tce-left{border-right:0;border-bottom:1px solid var(--line)}}',
      '.tce-tools{display:flex;gap:6px;align-items:center;padding:7px 8px;flex-wrap:wrap;border-bottom:1px solid var(--line)}',
      '.tce-tools input[type=search]{flex:1 1 120px;min-width:0;font-size:12.5px}',
      '.tce-tools label{display:flex;gap:4px;align-items:center;color:var(--mute);font-size:11.5px;white-space:nowrap}',
      '.tce-list{max-height:430px;overflow:auto;padding:2px 0}',
      '.tce-chapter{position:sticky;top:0;background:var(--panel);color:var(--mute);font-size:10.5px;letter-spacing:.08em;text-transform:uppercase;padding:6px 10px 3px;border-bottom:1px solid var(--line)}',
      '.tce-row{display:flex;gap:4px;align-items:flex-start;padding:4px 6px 4px 10px;border-bottom:1px solid var(--line)}',
      '.tce-row:hover{background:color-mix(in srgb,var(--acc) 8%,transparent)}',
      '.tce-row-main{flex:1;min-width:0;text-align:left;background:none;border:0;color:inherit;cursor:pointer;font:inherit;padding:0;display:grid;gap:1px}',
      '.tce-row-main code{font-family:Consolas,"Cascadia Mono",monospace;font-size:12px;color:var(--acc);overflow-wrap:anywhere}',
      '.tce-row-main small{color:var(--mute);font-size:11.5px;line-height:1.35;overflow-wrap:anywhere}',
      '.tce-row-main .tce-which{color:var(--mute);font-size:10px;text-transform:uppercase;letter-spacing:.06em}',
      '.tce-run{flex-shrink:0;border:1px solid var(--line);background:var(--panel2);color:var(--text);border-radius:6px;font-size:11px;padding:2px 6px;cursor:pointer}',
      '.tce-run:hover{border-color:var(--acc);color:var(--acc)}',
      '.tce-none{color:var(--mute);padding:12px}',
      '.tce-right{display:flex;flex-direction:column;min-width:0;background:#080b12}',
      '.tce-termhead{display:flex;gap:6px;align-items:center;padding:6px 10px;border-bottom:1px solid var(--line);color:var(--mute);font-size:11.5px}',
      '.tce-out{flex:1;overflow:auto;padding:8px 10px;min-height:260px;max-height:430px;font-family:Consolas,"Cascadia Mono",monospace;font-size:12.5px;line-height:1.45;white-space:pre-wrap;overflow-wrap:anywhere}',
      '.tce-out .tce-line{white-space:pre-wrap}.tce-out .tce-mute{color:var(--mute)}.tce-out .tce-cmd{color:#9bd1ff}',
      '.tce-form{display:flex;gap:6px;align-items:center;padding:7px 8px;border-top:1px solid var(--line);background:var(--panel2)}',
      '.tce-form .tce-prompt{font-family:Consolas,"Cascadia Mono",monospace;font-size:12px;color:var(--ok,#5ee6a8);white-space:nowrap;max-width:45%;overflow:hidden;text-overflow:ellipsis}',
      '.tce-form input{flex:1;min-width:0;font-family:Consolas,"Cascadia Mono",monospace;font-size:12.5px}',
      '.tce-note{color:var(--mute);font-size:11.5px;padding:6px 10px;border-top:1px solid var(--line)}',
    ].join('');
    document.head.appendChild(style);
  }

  function mount(el) {
    if (!el) return null;
    styles();
    if (!TP) { el.innerHTML = '<p class="mute">The terminal simulations are not loaded in this window.</p>'; return null; }
    const available = MAKERS.filter(m => typeof TP[m[3]] === 'function');
    if (!available.length) { el.innerHTML = '<p class="mute">The terminal simulations are not loaded in this window.</p>'; return null; }
    const instances = new Map(), pages = new Map();
    const state = { id: available.some(m => m[0] === 'bash') ? 'bash' : available[0][0], query: '', all: false, rows: [], history: new Map(), secret: false };
    const make = id => { const meta = available.find(m => m[0] === id); try { const shell = TP[meta[3]](); return shell && typeof shell.run === 'function' ? shell : null; } catch (e) { return null; } };
    for (const [id] of available) { const shell = make(id); if (shell) instances.set(id, shell); }
    const shellOf = id => instances.get(id);

    el.innerHTML =
      '<div class="tce-wrap"><div class="tce-head"><b>🧭 Command Explorer</b><span class="tce-count" data-tce="count"></span>' +
      '<span style="flex:1"></span><button type="button" class="tce-run" data-tce="random" title="Put a random command in the terminal">🎲 Surprise me</button>' +
      '<button type="button" class="tce-run" data-tce="reset" title="Fresh copy of this terminal, with its files back as they started">↺ Reset this simulation</button></div>' +
      '<div class="tce-tabs" data-tce="tabs"></div><div class="tce-body">' +
      '<div class="tce-left"><div class="tce-tools"><input type="search" data-tce="search" placeholder="Search every command: find, grep -n, docker run…" autocomplete="off" spellcheck="false">' +
      '<label><input type="checkbox" data-tce="all"> every terminal</label></div><div class="tce-list" data-tce="list"></div></div>' +
      '<div class="tce-right"><div class="tce-termhead"><span data-tce="termname"></span><span style="flex:1"></span><span>safe simulation</span></div>' +
      '<div class="tce-out" data-tce="out" role="log" aria-live="polite"></div>' +
      '<form class="tce-form" data-tce="form"><span class="tce-prompt" data-tce="prompt">$</span><input type="text" data-tce="input" placeholder="Type any command and press Enter" autocomplete="off" autocapitalize="off" spellcheck="false" aria-label="Command"></form>' +
      '<div class="tce-note">A private, made-up computer. Nothing here opens a program, changes a real file or reaches the internet.</div></div></div></div>';
    const q = name => el.querySelector('[data-tce="' + name + '"]');
    const out = q('out'), input = q('input'), promptEl = q('prompt'), list = q('list');

    function total() { let n = 0; for (const [id] of available) if (instances.has(id)) n += pagesOf(id).length; return n; }
    function pagesOf(id) {
      if (!pages.has(id)) {
        const shell = shellOf(id); let rows = [];
        try { rows = TP.manual && TP.manual.buildIndex ? TP.manual.buildIndex(shell, 'sandbox', []).pages : []; } catch (e) { rows = []; }
        if (!rows.length && Array.isArray(shell && shell.commands)) {
          rows = shell.commands.map((entry, i) => {
            const example = Array.isArray(entry) ? entry[0] : entry && entry.ex;
            const text = Array.isArray(entry) ? entry[1] : entry && entry.d;
            return { key: 'example-' + i, name: String(example || '').split(/\s+/)[0], syntax: example || '', chapter: 'Examples',
              description: [text || ''], aliases: [], options: [], examples: example ? [[example, text || '']] : [] };
          }).filter(page => page.syntax);
        }
        pages.set(id, rows);
      }
      return pages.get(id);
    }
    const exampleOf = page => (page.examples && page.examples[0] && page.examples[0][0]) || page.syntax || page.name;
    const metaOf = id => available.find(m => m[0] === id) || ['', id, '⌨️'];
    const promptOf = () => { const shell = shellOf(state.id); try { return String((shell && shell.prompt && shell.prompt()) || '$ '); } catch (e) { return '$ '; } };
    const secretNow = () => { const shell = shellOf(state.id); try { return !!(shell && shell.secret && shell.secret()); } catch (e) { return false; } };

    function line(text, cls) {
      const div = document.createElement('div'); div.className = 'tce-line' + (cls ? ' ' + cls : ''); div.textContent = text == null ? '' : String(text);
      out.appendChild(div);
      while (out.children.length > MAX_OUTPUT) out.removeChild(out.firstChild);
      out.scrollTop = out.scrollHeight;
    }
    function refreshPrompt() { promptEl.textContent = promptOf(); input.type = secretNow() ? 'password' : 'text'; }
    function welcome() {
      out.textContent = '';
      const shell = shellOf(state.id);
      line('Command Explorer · ' + state.id, 'tce-mute');
      if (shell && shell.about) line(shell.about, 'tce-mute');
      line('Type any command and press Enter, or pick one from the list. This copy is your own: the playground keeps its state.', 'tce-mute');
      line('');
      refreshPrompt();
    }
    function run(lineText) {
      const shell = shellOf(state.id); if (!shell) return;
      const wasSecret = state.secret || secretNow();
      line((wasSecret ? promptOf() + '••••••' : promptOf() + lineText), 'tce-cmd');
      let text = '';
      try { text = shell.run(lineText); } catch (e) { text = 'Error: ' + ((e && e.message) || e); }
      text = text == null ? '' : String(text);
      if (text.trim()) line(text); else if (String(lineText).trim()) line('(no output)', 'tce-mute');
      state.secret = secretNow();
      if (!wasSecret && String(lineText).trim()) {
        const hist = state.history.get(state.id) || [];
        if (hist[hist.length - 1] !== lineText) { hist.push(lineText); if (hist.length > 80) hist.shift(); state.history.set(state.id, hist); }
      }
      refreshPrompt();
    }

    function tabs() {
      q('tabs').innerHTML = available.filter(m => instances.has(m[0])).map(([id, name, icon]) =>
        '<button type="button" class="tce-tab' + (id === state.id ? ' on' : '') + '" data-tce-tab="' + esc(id) + '" title="' + esc(name) + '">' + icon + ' ' + esc(name) + '</button>').join('');
    }
    function render() {
      const words = state.query.trim().toLowerCase().split(/\s+/).filter(Boolean);
      const ids = state.all || words.length ? available.filter(m => instances.has(m[0])).map(m => m[0]) : [state.id];
      const rows = [];
      for (const id of ids) {
        for (const page of pagesOf(id)) {
          if (words.length) {
            const haystack = [page.name, page.syntax, page.chapter, ...(page.aliases || []), ...(page.description || []), ...(page.options || []).flat()].join(' ').toLowerCase();
            if (!words.every(word => haystack.includes(word))) continue;
          }
          rows.push({ id, page });
          if (rows.length >= MAX_ROWS) break;
        }
        if (rows.length >= MAX_ROWS) break;
      }
      state.rows = rows;
      let html = '', chapter = '';
      rows.forEach((row, i) => {
        if (row.page.chapter !== chapter) { chapter = row.page.chapter; html += '<div class="tce-chapter">' + esc(chapter) + '</div>'; }
        const description = (row.page.description && row.page.description[0]) || '';
        const syntax = row.page.syntax || row.page.name || '';
        html += '<div class="tce-row"><button type="button" class="tce-row-main" data-tce-use="' + i + '" title="Put this in the terminal">' +
          '<code>' + esc(syntax) + '</code><small>' + esc(description) + '</small>' +
          (state.all || words.length ? '<span class="tce-which">' + esc(metaOf(row.id)[2]) + ' ' + esc(metaOf(row.id)[1]) + '</span>' : '') +
          '</button><button type="button" class="tce-run" data-tce-run="' + i + '" title="Run this example">▶</button></div>';
      });
      if (!rows.length) html += '<div class="tce-none">Nothing matches that. Try a shorter word, like <code>file</code>, <code>find</code> or <code>run</code>.</div>';
      if (rows.length >= MAX_ROWS) html += '<div class="tce-none">The first ' + MAX_ROWS + ' matches are shown. Narrow the search to see the rest.</div>';
      list.innerHTML = html;
      q('count').textContent = total() + ' commands in ' + available.filter(m => instances.has(m[0])).length + ' terminals';
      q('termname').textContent = metaOf(state.id)[2] + ' ' + metaOf(state.id)[1];
      q('search').placeholder = 'Search every command: find, grep -n, docker run…';
      tabs();
    }

    function select(id) {
      if (!instances.has(id) || id === state.id) return;
      state.id = id; state.secret = false; welcome(); render();
      input.focus();
    }
    function use(index, runIt) {
      const row = state.rows[index]; if (!row) return;
      const command = exampleOf(row.page);
      if (row.id !== state.id) { state.id = row.id; state.secret = false; welcome(); render(); }
      if (runIt) run(command);
      else { input.value = command; input.focus(); input.setSelectionRange(command.length, command.length); }
    }
    function reset() {
      const shell = make(state.id);
      if (!shell) return;
      instances.set(state.id, shell);
      pages.delete(state.id);
      state.secret = false;
      welcome(); render();
    }

    el.addEventListener('click', event => {
      const tab = event.target.closest('[data-tce-tab]');
      if (tab) { select(tab.dataset.tceTab); return; }
      const useButton = event.target.closest('[data-tce-use]');
      if (useButton) { use(+useButton.dataset.tceUse, false); return; }
      const runButton = event.target.closest('[data-tce-run]');
      if (runButton) { use(+runButton.dataset.tceRun, true); return; }
      const action = event.target.closest('[data-tce="random"],[data-tce="reset"]');
      if (action) {
        if (action.dataset.tce === 'reset') { reset(); return; }
        const rows = pagesOf(state.id);
        if (!rows.length) return;
        const pick = rows[Math.floor(Math.random() * rows.length)];
        const command = exampleOf(pick);
        input.value = command; input.focus(); input.setSelectionRange(command.length, command.length);
      }
    });
    q('search').addEventListener('input', event => { state.query = event.target.value; render(); });
    q('all').addEventListener('change', event => { state.all = event.target.checked; if (state.all) { for (const [id] of available) if (instances.has(id)) pagesOf(id); } render(); });
    q('form').addEventListener('submit', event => {
      event.preventDefault();
      const text = input.value; input.value = '';
      run(text);
    });
    input.addEventListener('keydown', event => {
      if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
      const hist = state.history.get(state.id) || [];
      if (!hist.length) return;
      event.preventDefault();
      const at = input.dataset.at === undefined ? hist.length : +input.dataset.at;
      const next = event.key === 'ArrowUp' ? Math.max(0, at - 1) : Math.min(hist.length, at + 1);
      input.dataset.at = String(next);
      input.value = next >= hist.length ? '' : hist[next];
    });
    input.addEventListener('input', () => { delete input.dataset.at; });

    welcome(); render();
    return { select, reset };
  }

  window.TerminalCommandExplorer = { mount };
})();

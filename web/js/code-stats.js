// 📊 Statistics for Edit the app (web/js/appedit.js) and Coding (web/js/coding.js): how many files and folders there are,
// and how many lines and characters of code, in the open file, in the folder being looked at (optionally counting
// everything inside it) and, in Edit the app, in the whole app. File numbers are counted here from the text in the
// editor, so unsaved edits are included; folder numbers come from /api/appedit/stats and /api/coding/stats, which walk
// only the folder asked for, stop at a time and item limit, and say so when they had to stop early.
(() => {
  /* core.js declares A at the top level of its script, which is a script-level binding rather than a window property */
  const API = (typeof A !== 'undefined' && A) || window.A; if (!API) return;
  if (window.CodeStats) return;
  const esc = API.esc || (s => String(s == null ? '' : s));
  const num = n => Number(n || 0).toLocaleString('en-US');
  const bytes = n => {
    n = Number(n || 0);
    return n >= 1073741824 ? (n / 1073741824).toFixed(2) + ' GB' : n >= 1048576 ? (n / 1048576).toFixed(1) + ' MB' : n >= 1024 ? Math.round(n / 1024) + ' KB' : n + ' B';
  };
  /* folder and app totals can be in the millions: keep the tile readable, the exact number is in its tooltip */
  const big = n => { n = Number(n || 0); return n >= 1e6 ? (n / 1e6).toFixed(n >= 1e7 ? 0 : 1) + 'M' : n >= 1e4 ? (n / 1e3).toFixed(0) + 'k' : num(n); };
  const LANG = { js: 'JavaScript', mjs: 'JavaScript', cjs: 'JavaScript', jsx: 'JavaScript (JSX)', ts: 'TypeScript', tsx: 'TypeScript (TSX)', py: 'Python', html: 'HTML', htm: 'HTML', css: 'CSS', scss: 'SCSS', less: 'Less', json: 'JSON', md: 'Markdown', txt: 'Text', xml: 'XML', svg: 'SVG', yml: 'YAML', yaml: 'YAML', toml: 'TOML', sql: 'SQL', sh: 'Shell', bash: 'Bash', ps1: 'PowerShell', bat: 'Batch', cmd: 'Batch', c: 'C', h: 'C header', cpp: 'C++', cc: 'C++', cs: 'C#', java: 'Java', go: 'Go', rs: 'Rust', php: 'PHP', rb: 'Ruby', lua: 'Lua', gd: 'GDScript', vue: 'Vue', svelte: 'Svelte', r: 'R', pl: 'Perl', swift: 'Swift', dart: 'Dart', asm: 'Assembly' };
  const extOf = p => ((String(p || '').match(/\.([A-Za-z0-9]+)$/) || [])[1] || '').toLowerCase();

  /* the same counting rules as lib/code-stats.js, applied to the text in the editor */
  function fileStats(text) {
    const src = String(text == null ? '' : text);
    const rows = src.split(/\r\n|\n|\r/);
    if (rows.length && rows[rows.length - 1] === '') rows.pop();
    let chars = 0, code = 0, comment = 0, blank = 0, longest = 0, inBlock = false;
    for (const row of rows) {
      chars += row.length;
      if (row.length > longest) longest = row.length;
      const t = row.trim();
      if (inBlock) { comment++; if (t.includes('*/')) inBlock = false; continue; }
      if (!t) { blank++; continue; }
      if (t.startsWith('/*')) { comment++; if (!t.includes('*/')) inBlock = true; continue; }
      if (/^(\/\/|#|--|;|\*|<!--|rem\s)/i.test(t)) { comment++; continue; }
      code++;
    }
    return {
      lines: rows.length, chars, code, comment, blank, longest,
      noSpace: src.replace(/\s/g, '').length,
      bytes: new Blob([src]).size,
      avg: rows.length ? Math.round((chars / rows.length) * 10) / 10 : 0
    };
  }

  const tile = (label, value, title) => '<div class="cs-c" title="' + esc(title == null ? label : title) + '"><b>' + esc(value) + '</b><span>' + esc(label) + '</span></div>';
  const fileTiles = m => [
    ['Lines', num(m.lines)], ['Code lines', num(m.code), 'Lines that hold code (not blank, not a comment)'], ['Comment lines', num(m.comment), 'Lines that start with a comment mark, plus /* … */ blocks'], ['Blank lines', num(m.blank)],
    ['Characters', num(m.chars), num(m.chars) + ' characters on the lines; line breaks are not counted'],
    ['No spaces', num(m.noSpace), 'Characters left when spaces, tabs and line breaks are removed'],
    ['Size', bytes(m.bytes), bytes(m.bytes) + ' as UTF-8, which is what saving writes'],
    ['Avg line', m.avg + ' ch', 'Average characters per line'],
    ['Longest line', num(m.longest) + ' ch', 'The longest line: ' + num(m.longest) + ' characters']
  ].map(t => tile(t[0], t[1], t[2])).join('');
  const folderTiles = r => [
    ['Files', big(r.files), num(r.files) + ' files'], ['Folders', big(r.folders), num(r.folders) + ' folders'],
    ['Lines', big(r.lines), num(r.lines) + ' lines'], ['Code lines', big(r.codeLines), num(r.codeLines) + ' code lines'],
    ['Comment lines', big(r.commentLines), num(r.commentLines) + ' comment lines'], ['Blank lines', big(r.blankLines), num(r.blankLines) + ' blank lines'],
    ['Characters', big(r.chars), num(r.chars) + ' characters (line breaks are not counted)'], ['Size', bytes(r.bytes), bytes(r.bytes) + ' on disk'],
    ['Avg line', (r.avgLine || 0) + ' ch', 'Average characters per line'],
    ['Longest line', num(r.longestLine) + ' ch', 'Longest line in ' + (r.longestLineFile || 'this scope')]
  ].map(t => tile(t[0], t[1], t[2])).join('');

  /* what the walk had to leave out, said plainly rather than quietly in a wrong total */
  function noteFor(r, where) {
    const bits = [];
    if (r.truncated) bits.push('Stopped early (' + (r.ms / 1000).toFixed(1) + ' s, ' + num(r.files + r.folders) + ' items) so the numbers are a floor, not the whole ' + where + '. Untick “subfolders” for a complete count of this folder alone.');
    else bits.push('Measured in ' + (r.ms / 1000).toFixed(1) + ' s.');
    if (r.otherFiles) bits.push(num(r.otherFiles) + ' non-text file' + (r.otherFiles === 1 ? '' : 's') + ' counted but not read (pictures, archives, binaries).');
    if (r.skippedBig) bits.push(num(r.skippedBig) + ' text file' + (r.skippedBig === 1 ? '' : 's') + ' over 1 MB not read.');
    if (r.unreadable) bits.push(num(r.unreadable) + ' item' + (r.unreadable === 1 ? '' : 's') + ' could not be read (permissions).');
    return bits.join(' ');
  }
  function typeTable(r) {
    const rows = (r.byExt || []).slice(0, 14);
    if (!rows.length) return '<div class="cs-note">No text or source files here.</div>';
    return '<table class="cs-tab"><thead><tr><th>Type</th><th>Files</th><th>Lines</th><th>Chars</th><th>Size</th></tr></thead><tbody>' +
      rows.map(x => '<tr><td>' + esc(x.ext === 'no extension' ? '—' : '.' + x.ext) + '</td><td>' + num(x.files) + '</td><td>' + num(x.lines) + '</td><td>' + num(x.chars) + '</td><td>' + bytes(x.bytes) + '</td></tr>').join('') +
      '</tbody></table>';
  }

  function mount(host, opts) {
    if (!host) return null;
    const kind = opts && opts.kind === 'coding' ? 'coding' : 'app';
    const st = {
      host, kind, folder: '', file: '', text: '', deep: ls.get('csDeep_' + kind, '1') !== '0',
      req: 0, timer: 0, last: null
    };
    const el = s => host.querySelector(s);
    const endpoint = kind === 'app' ? '/api/appedit/stats' : '/api/coding/stats';

    host.innerHTML = '<section class="cs">' +
      '<div class="cs-h"><b>📊 Statistics</b><span class="small mute cs-sub">file · folder' + (kind === 'app' ? ' · whole app' : '') + '</span><span class="sp"></span>' +
      '<label class="chk small" title="Count every file inside the folder, not only the ones directly in it"><input type="checkbox" class="cs-deep"' + (st.deep ? ' checked' : '') + '> subfolders</label>' +
      '<button class="ib cs-ref" title="Count everything again">↻ Refresh</button>' +
      '<button class="ib cs-hide" title="Hide or show the statistics">Hide</button></div>' +
      '<div class="cs-b">' +
      '<div class="cs-grp">This file <span class="cs-name cs-fn">no file open</span></div><div class="cs-grid cs-file"></div>' +
      '<div class="cs-grp cs-fg">This folder <span class="cs-name cs-fd"></span></div><div class="cs-grid cs-dir"></div><div class="cs-note cs-dirnote"></div>' +
      (kind === 'app' ? '<div class="cs-grp">Whole app <span class="cs-name">web, lib, tests, scripts</span></div><div class="cs-grid cs-app"></div><div class="cs-note cs-appnote"></div>' : '') +
      '<details class="cs-more"><summary>By file type</summary><div class="cs-type"></div></details>' +
      '</div></section>';

    el('.cs-deep').onchange = e => {
      st.deep = !!e.target.checked;
      ls.set('csDeep_' + kind, st.deep ? '1' : '0');
      load();
    };
    el('.cs-ref').onclick = () => { const b = el('.cs-ref'); b.textContent = '…'; Promise.resolve().then(() => load(true)).catch(() => { }).finally(() => { b.textContent = '↻ Refresh'; }); };
    el('.cs-hide').onclick = () => {
      const on = host.querySelector('.cs').classList.toggle('hide');
      el('.cs-hide').textContent = on ? 'Show' : 'Hide';
    };

    function drawFile() {
      const box = el('.cs-file'), name = el('.cs-fn'); if (!box) return;
      if (!st.file) {
        name.textContent = 'no file open';
        box.innerHTML = '<div class="cs-note">Open a file to see its lines and characters.</div>';
        return;
      }
      const ext = extOf(st.file), m = fileStats(st.text);
      name.textContent = st.file + (LANG[ext] ? ' · ' + LANG[ext] : '');
      box.innerHTML = fileTiles(m);
    }

    async function load(force) {
      const my = ++st.req;
      const fd = el('.cs-fd'); if (fd) fd.textContent = st.folder || (kind === 'app' ? 'app' : '');
      el('.cs-dir').innerHTML = '<div class="cs-note">Counting…</div>';
      if (kind === 'app') el('.cs-app').innerHTML = '<div class="cs-note">Counting…</div>';
      const body = kind === 'app' ? { dir: st.folder || '', deep: st.deep, force: !!force } : { path: st.folder, deep: st.deep, force: !!force };
      const jobs = [API.api(endpoint, body).catch(() => null)];
      if (kind === 'app') jobs.push(API.api('/api/appedit/stats', { dir: '', deep: true, force: !!force }).catch(() => null));
      const [cur, whole] = await Promise.all(jobs);
      if (my !== st.req) return;
      drawScope(cur);
      if (kind === 'app') drawWhole(whole);
    }
    function drawScope(r) {
      const grid = el('.cs-dir'), note = el('.cs-dirnote');
      el('.cs-fg').innerHTML = (r && r.deep ? 'This folder + everything inside' : 'This folder only') + ' <span class="cs-name cs-fd">' + esc(st.folder || (kind === 'app' ? 'app' : '')) + '</span>';
      if (!r) { grid.innerHTML = ''; note.className = 'cs-note cs-dirnote cs-bad'; note.textContent = 'The counts did not come back. Is the app still running?'; return; }
      if (r.error) {
        grid.innerHTML = ''; note.className = 'cs-note cs-dirnote cs-bad';
        note.textContent = /not found/i.test(r.error) ? 'The statistics need the newer Moundshroud server: close the app and open it again, then reload this page.' : r.error;
        return;
      }
      grid.innerHTML = folderTiles(r);
      note.className = 'cs-note cs-dirnote' + (r.truncated ? ' cs-bad' : '');
      note.textContent = noteFor(r, 'folder');
      el('.cs-type').innerHTML = typeTable(r);
    }
    function drawWhole(r) {
      const grid = el('.cs-app'), note = el('.cs-appnote'); if (!grid) return;
      if (!r || r.error) { grid.innerHTML = ''; note.className = 'cs-note cs-appnote cs-bad'; note.textContent = (r && r.error) || 'The app totals did not come back.'; return; }
      grid.innerHTML = folderTiles(r);
      note.className = 'cs-note cs-appnote' + (r.truncated ? ' cs-bad' : '');
      note.textContent = noteFor(r, 'app');
    }

    drawFile();
    return {
      /* the open file, from the editor itself: unsaved edits counted as they are typed */
      setFile(path, text) {
        st.file = String(path || ''); st.text = String(text == null ? '' : text);
        clearTimeout(st.timer);
        st.timer = setTimeout(() => { st.timer = 0; drawFile(); }, 120);
      },
      /* the folder being listed: new folder means new numbers */
      setFolder(dir) {
        const d = String(dir == null ? '' : dir);
        if (d === st.folder && el('.cs-dir').childElementCount) return;
        st.folder = d; load();
      },
      refresh() { return load(true); }
    };
  }

  window.CodeStats = { mount, fileStats };
})();

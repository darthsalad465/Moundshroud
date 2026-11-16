// Moundshroud's code editor, built to feel like VS Code and VSCodium. Any textarea marked data-code (Edit the app, the Godot
// file editor, the Game maker) or class cl-ed (the coding lessons) is upgraded in place: syntax colouring with a coloured
// overlay, a line-number gutter, the current line lit, a minimap, find & replace, a command palette (Ctrl+Shift+P), Go to
// line (Ctrl+G), bracket matching, auto-indent and auto-close, Alt+↑/↓ to move a line, Ctrl+/ to comment, word wrap, a
// breadcrumb and a status bar with line, column and selection.
// The textarea is never replaced - it keeps its id, its value and its input events - so every page keeps working as it was.
// Tabs are offered as CodeEd.tabbar(), a strip the pages with several open files (Edit the app, Game Studio) draw into.
(() => {
  if (window.CodeEd) return;
  const esc = s => String(s == null ? '' : s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

  /* ---------------------------------------------------------------- languages */
  const KW = {
    js: 'const let var function return if else for while do switch case break continue new class extends super this throw try catch finally typeof instanceof in of delete void yield async await import export from default null undefined true false static get set',
    gd: 'extends func signal var const enum if elif else for while match return break continue pass class_name static self null true false and or not preload load await is in as when',
    py: 'def class return if elif else for while import from as with try except finally raise pass break continue lambda global nonlocal assert del yield await async in is not and or None True False print self',
    css: '',
    sh: 'if then else fi for while do done case esac function return export echo cd ls rm set local echo',
    json: 'true false null',
    sql: 'select from where insert into values update set delete create table drop alter join on group by order limit and or not null as',
  };
  const EXT = { js: 'js', mjs: 'js', cjs: 'js', json: 'json', css: 'css', html: 'html', htm: 'html', gd: 'gd', py: 'py', sh: 'sh', bat: 'sh', ps1: 'sh', md: 'md', txt: 'txt', godot: 'sh', tscn: 'js', tres: 'js', cfg: 'sh', svg: 'html', xml: 'html' };
  const langOf = (ta, name) => {
    if (ta.dataset.lang) return ta.dataset.lang;
    const m = /\.([a-z0-9]+)$/i.exec(String(name || ta.dataset.name || ''));
    return (m && EXT[m[1].toLowerCase()]) || 'txt';
  };
  /* no name to go by (the coding lessons and the Game maker only have a bare textarea): read the first lines */
  function guess(text) {
    const s = String(text || '').slice(0, 4000);
    if (!s.trim()) return 'txt';
    if (/^\s*(def |class \w+.*:|from \w+ import|import \w+$)/m.test(s)) return 'py';
    if (/<(!doctype|html|head|body|div|p |span|script)/i.test(s)) return 'html';
    if (/^\s*[{[]/.test(s) && /"\s*:/.test(s)) return 'json';
    if (/(\bfunction\b|=>|\bconst\b|\blet\b|\bconsole\.[a-z]+\b)/.test(s)) return 'js';
    if (/(^|\n)\s*(\.[\w-]+|#[\w-]+|[a-z][\w-]*)\s*(,[^{]*)?\{[^}]*:/.test(s)) return 'css';
    if (/(^|\n)\s*(#!|\$ |echo\b|\w+=\S+\s*$)/.test(s)) return 'sh';
    return 'txt';
  }
  const LANGNAME = { js: 'JavaScript', json: 'JSON', css: 'CSS', html: 'HTML', gd: 'GDScript', py: 'Python', sh: 'Shell', md: 'Markdown', txt: 'Plain text', sql: 'SQL' };
  const COMMENT = { js: '//', gd: '##', py: '#', sh: '#', css: '/*', html: '<!--', json: '//', sql: '--', md: '<!--' };
  const PAIRS = { '(': ')', '[': ']', '{': '}', '"': '"', "'": "'", '`': '`' };

  /* ---------------------------------------------------------------- highlighter */
  function scanCLike(src, lang) {
    const out = [], kw = new Set((KW[lang] || '').split(' ').filter(Boolean)), hash = lang === 'py' || lang === 'sh';
    let i = 0;
    while (i < src.length) {
      const c = src[i], n = src[i + 1];
      if (!hash && c === '/' && n === '/') { let j = src.indexOf('\n', i); if (j < 0) j = src.length; out.push(['c', src.slice(i, j)]); i = j; continue; }
      if (hash && c === '#' && !(i === 0 && n === '!')) { let j = src.indexOf('\n', i); if (j < 0) j = src.length; out.push(['c', src.slice(i, j)]); i = j; continue; }
      if (!hash && c === '/' && n === '*') { let j = src.indexOf('*/', i + 2); j = j < 0 ? src.length : j + 2; out.push(['c', src.slice(i, j)]); i = j; continue; }
      if (c === '"' || c === "'" || (c === '`' && (lang === 'js'))) {
        const triple = lang === 'py' && (src.startsWith('"""', i) || src.startsWith("'''", i));
        const q = triple ? src.slice(i, i + 3) : c;
        let j = i + q.length;
        while (j < src.length) { if (src[j] === '\\') { j += 2; continue; } if (src.startsWith(q, j)) { j += q.length; break; } if (!triple && src[j] === '\n') break; j++; }
        out.push(['s', src.slice(i, j)]); i = j; continue;
      }
      if (c >= '0' && c <= '9' && !/[\w$]/.test(src[i - 1] || '')) { let j = i + 1; while (j < src.length && /[\w.]/.test(src[j])) j++; out.push(['n', src.slice(i, j)]); i = j; continue; }
      if (/[A-Za-z_@$]/.test(c)) {
        let j = i + 1; while (j < src.length && /[\w$]/.test(src[j])) j++;
        const w = src.slice(i, j); let k = j; while (k < src.length && src[k] === ' ') k++;
        let cls = kw.has(w) ? 'k' : src[k] === '(' ? 'f' : (/^[A-Z]/.test(w) && lang !== 'css') ? 't' : 'v';
        if (lang === 'css' && src[k] === ':') cls = 'p';
        out.push([cls, w]); i = j; continue;
      }
      out.push(['', c]); i++;
    }
    // a key in JSON or an object literal reads as a property
    if (lang === 'json') for (let k = 0; k < out.length; k++) if (out[k][0] === 's') { let m = k + 1; while (m < out.length && !out[m][1].trim()) m++; if (out[m] && out[m][1] === ':') out[k][0] = 'p'; }
    return html(out);
  }
  function htmlOf(toks) {
    let h = '';
    for (const [cls, text] of toks) h += cls ? '<span class="tk-' + cls + '">' + esc(text) + '</span>' : esc(text);
    return h;
  }
  const html = htmlOf;


  function scanHtml(src) {
    const out = []; let i = 0;
    while (i < src.length) {
      if (src.startsWith('<!--', i)) { let j = src.indexOf('-->', i); j = j < 0 ? src.length : j + 3; out.push(['c', src.slice(i, j)]); i = j; continue; }
      if (src[i] === '<') {
        let j = src.indexOf('>', i); j = j < 0 ? src.length : j + 1;
        const tag = src.slice(i, j);
        let k = 0, inner = [];
        while (k < tag.length) {
          if (/[A-Za-z]/.test(tag[k]) && k === 1) { let m = k; while (m < tag.length && /[\w:-]/.test(tag[m])) m++; inner.push(['t', tag.slice(k, m)]); k = m; continue; }
          if (/[A-Za-z_:@]/.test(tag[k])) { let m = k; while (m < tag.length && /[\w:.-]/.test(tag[m])) m++; inner.push(['p', tag.slice(k, m)]); k = m; continue; }
          if (tag[k] === '"' || tag[k] === "'") { const q = tag[k]; let m = k + 1; while (m < tag.length && tag[m] !== q) m++; inner.push(['s', tag.slice(k, Math.min(m + 1, tag.length))]); k = m + 1; continue; }
          inner.push(['', tag[k]]); k++;
        }
        out.push(['raw', html(inner)]); i = j; continue;
      }
      let j = src.indexOf('<', i); if (j < 0) j = src.length;
      out.push(['', src.slice(i, j)]); i = j;
    }
    let h = ''; for (const [cls, text] of out) h += cls === 'raw' ? text : cls ? '<span class="tk-' + cls + '">' + esc(text) + '</span>' : esc(text);
    return h;
  }

  function scanMd(src) {
    return src.split('\n').map(line => {
      if (/^\s*```/.test(line) || /^#{1,6}\s/.test(line)) return '<span class="tk-k">' + esc(line) + '</span>';
      let h = esc(line).replace(/(`[^`]+`)/g, '<span class="tk-s">$1</span>').replace(/(\*\*[^*]+\*\*)/g, '<span class="tk-t">$1</span>');
      if (/^\s*(?:[-*+]|\d+\.)\s/.test(line)) h = h.replace(/^(\s*(?:[-*+]|\d+\.)\s)/, '<span class="tk-f">$1</span>');
      return h;
    }).join('\n');
  }

  function highlight(text, lang) {
    try {
      if (lang === 'html') return scanHtml(text);
      if (lang === 'md') return scanMd(text);
      if (lang === 'txt') return esc(text);
      return scanCLike(text, lang);
    } catch (e) { return esc(text); }
  }

  /* ---------------------------------------------------------------- one editor */
  let seq = 0;
  function upgrade(ta) {
    if (!ta || ta.dataset.ce) return null;
    const id = 'ce' + (++seq);
    ta.dataset.ce = id;
    const host = ta.parentNode;
    let name = ta.dataset.name || '';
    const wrap = document.createElement('div');
    wrap.className = 'ce';
    wrap.dataset.ce = id;
    wrap.innerHTML =
      '<div class="ce-crumb" hidden></div>' +
      '<div class="ce-body"><div class="ce-gut" aria-hidden="true"><div class="ce-gi"></div></div>' +
      '<div class="ce-view"><pre class="ce-hl" aria-hidden="true"><code></code></pre><canvas class="ce-map" aria-hidden="true"></canvas></div></div>' +
      '<div class="ce-find" hidden><input class="ce-fq" type="search" placeholder="Find" autocomplete="off"><span class="ce-fc small mute"></span>' +
      '<button class="ce-fb" data-f="prev" title="Previous match (Shift+Enter)">↑</button><button class="ce-fb" data-f="next" title="Next match (Enter)">↓</button>' +
      '<button class="ce-fb ce-fword" data-f="word" title="Whole word">ab</button><button class="ce-fb ce-fcase" data-f="case" title="Match case">Aa</button>' +
      '<span class="ce-frep" hidden><input class="ce-fr" type="search" placeholder="Replace" autocomplete="off">' +
      '<button class="ce-fb" data-f="one" title="Replace this one">Replace</button><button class="ce-fb" data-f="all" title="Replace every match">All</button></span>' +
      '<button class="ce-fb ce-fx" data-f="close" title="Close (Esc)">✕</button></div>' +
      '<div class="ce-status"><span class="ce-s" data-s="pos">Ln 1, Col 1</span><span class="ce-s" data-s="sel" hidden></span><span class="ce-sp"></span>' +
      '<span class="ce-s" data-s="wrap" role="button" tabindex="0" title="Word wrap (Alt+Z)">no wrap</span><span class="ce-s" data-s="lang"></span><span class="ce-s" data-s="len"></span></div>';
    host.insertBefore(wrap, ta);
    const view = wrap.querySelector('.ce-view');
    view.appendChild(ta);
    const pre = wrap.querySelector('.ce-hl > code'), gutBox = wrap.querySelector('.ce-gut'), gut = wrap.querySelector('.ce-gi'), map = wrap.querySelector('.ce-map');
    const crumb = wrap.querySelector('.ce-crumb'), fin = wrap.querySelector('.ce-find');
    const fq = wrap.querySelector('.ce-fq'), fr = wrap.querySelector('.ce-fr'), fc = wrap.querySelector('.ce-fc');

    ta.classList.add('ce-ta');
    ta.setAttribute('wrap', 'off');
    ta.spellcheck = false;
    const api = { ta, wrap, get value() { return ta.value; }, set value(v) { ta.value = v; render(); }, lang: '', get dirty() { return ta.dataset.ceDirty === '1'; } };

    const state = { lang: 'txt', wrap: false, line: 1, mIdx: 0, case: false, word: false, query: '' };

    /* ---------- drawing ---------- */
    let pending = 0;
    function render() {
      state.lang = langOf(ta, name || ta.dataset.name || '');
      if (state.lang === 'txt' && !ta.dataset.lang && !(name || ta.dataset.name)) state.lang = guess(ta.value);
      api.lang = state.lang;
      const text = ta.value;
      const big = text.length > 400000;
      pre.innerHTML = big ? esc(text) : highlight(text, state.lang) + '\n';
      const n = text.endsWith('\n') ? text.split('\n').length - 1 : text.split('\n').length;
      if (gut.dataset.n !== String(n)) { gut.dataset.n = n; gut.innerHTML = Array.from({ length: n }, (_, i) => '<i>' + (i + 1) + '</i>').join(''); }
      wrap.querySelector('[data-s=lang]').textContent = LANGNAME[state.lang] || state.lang;
      wrap.querySelector('[data-s=len]').textContent = (text.length >= 1024 ? (text.length / 1024).toFixed(1) + ' KB' : text.length + ' B');
      sync(); caret(); mini();
      crumb.hidden = !name;
      if (name) crumb.innerHTML = String(name).split('/').map((p, i, a) => (i ? '<span class="ce-sep">›</span>' : '') + (i === a.length - 1 ? '<b>' + esc(p) + '</b>' : esc(p))).join('');
    }
    function schedule() { cancelAnimationFrame(pending); pending = requestAnimationFrame(render); }
    function sync() {
      pre.style.transform = 'translate(' + (-ta.scrollLeft) + 'px,' + (-ta.scrollTop) + 'px)';
      gut.style.transform = 'translateY(' + (-ta.scrollTop) + 'px)';
    }
    function caret() {
      const v = ta.value, a = ta.selectionStart, b = ta.selectionEnd;
      const upto = v.slice(0, a), line = upto.split('\n').length, col = a - (upto.lastIndexOf('\n') + 1) + 1;
      state.line = line;
      wrap.querySelector('[data-s=pos]').textContent = 'Ln ' + line + ', Col ' + col;
      const sel = wrap.querySelector('[data-s=sel]');
      const multi = v.slice(a, b).split('\n').length;
      sel.hidden = a === b;
      if (a !== b) sel.textContent = (b - a) + ' selected' + (multi > 1 ? ' (' + multi + ' lines)' : '');
      const prev = gut.querySelector('i.on'); if (prev) prev.classList.remove('on');
      const now = gut.children[line - 1]; if (now) now.classList.add('on');
      wrap.querySelector('.ce-view').style.setProperty('--ce-line', line);
      match(true);
    }
    /* the minimap: each line a thin bar, coloured by what it mostly is */
    function mini() {
      if (!map.offsetParent) return;
      const dpr = window.devicePixelRatio || 1, w = 68, h = map.clientHeight || 200;
      map.width = w * dpr; map.height = h * dpr;
      const g = map.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, w, h);
      const lines = ta.value.split('\n'), total = Math.max(1, lines.length);
      const step = h / total, y0 = ta.scrollTop / Math.max(1, ta.clientHeight) * h;
      g.fillStyle = 'rgba(127,127,160,.35)';
      for (let i = 0; i < total; i++) {
        const ln = lines[i]; if (!ln.trim()) continue;
        const yy = i * step;
        if (yy < -step || yy > h) continue;
        const ww = Math.min(w - 4, 2 + (ln.trim().length / 90) * (w - 8));
        g.fillStyle = /^\s*(\/\/|#|\/\*|\*)/.test(ln) ? 'rgba(120,170,120,.45)' : /[{}()[\];]/.test(ln) ? 'rgba(150,170,220,.55)' : 'rgba(160,160,190,.4)';
        g.fillRect(2, yy, ww, Math.max(1, step - .4));
      }
      if (total * step > h) { /* scrolled */ }
      g.fillStyle = 'rgba(255,255,255,.10)';
      g.fillRect(0, clamp(y0, 0, h - 4), w, Math.max(6, (ta.clientHeight / Math.max(1, ta.scrollHeight)) * h));
    }

    /* ---------- find & replace ---------- */
    const flags = () => (state.case ? 'g' : 'gi');
    const rx = () => {
      let q = fq.value; if (!q) return null;
      const src = (state.word ? '\\b' : '') + q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + (state.word ? '\\b' : '');
      try { return new RegExp(src, flags()); } catch (e) { return null; }
    };
    let marks = [];
    function match(move) {
      const r = rx(); marks = [];
      if (r) { const v = ta.value; let m; while ((m = r.exec(v))) { marks.push([m.index, m.index + m[0].length]); if (!m[0].length) r.lastIndex++; } }
      fc.textContent = fq.value ? (marks.length ? (Math.min(state.mIdx + 1, marks.length)) + ' of ' + marks.length : 'no match') : '';
    }
    function jump(dir) {
      if (!marks.length) return;
      state.mIdx = (state.mIdx + dir + marks.length) % marks.length;
      const [a, b] = marks[state.mIdx];
      ta.focus(); ta.setSelectionRange(a, b); revealLine(a); caret(); match();
    }
    function revealLine(idx) {
      const v = ta.value, before = v.slice(0, idx).split('\n').length;
      const lh = parseFloat(getComputedStyle(ta).lineHeight) || 18;
      if (before * lh < ta.scrollTop + lh) ta.scrollTop = Math.max(0, (before - 2) * lh);
      else if (before * lh > ta.scrollTop + ta.clientHeight - lh * 2) ta.scrollTop = (before - 2) * lh;
      sync();
    }
    function openFind(rep) {
      fin.hidden = false; wrap.querySelector('.ce-frep').hidden = !rep;
      const sel = ta.value.slice(ta.selectionStart, ta.selectionEnd);
      if (sel && sel.length < 80 && !sel.includes('\n') && !fq.value) fq.value = sel;
      fq.focus(); fq.select(); state.mIdx = 0; match();
    }
    fin.addEventListener('keydown', e => {
      e.stopPropagation();
      if (e.key === 'Escape') { fin.hidden = true; ta.focus(); return; }
      if (e.key === 'Enter') { e.preventDefault(); jump(e.shiftKey ? -1 : 1); return; }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'h') { e.preventDefault(); openFind(true); }
    });
    fin.addEventListener('input', () => { state.mIdx = 0; match(); });
    fin.addEventListener('click', e => {
      const b = e.target.closest('[data-f]'); if (!b) return;
      const f = b.dataset.f;
      if (f === 'next') return jump(1);
      if (f === 'prev') return jump(-1);
      if (f === 'close') { fin.hidden = true; ta.focus(); return; }
      if (f === 'case') { state.case = !state.case; b.classList.toggle('on', state.case); state.mIdx = 0; return match(); }
      if (f === 'word') { state.word = !state.word; b.classList.toggle('on', state.word); state.mIdx = 0; return match(); }
      if (f === 'one') {
        if (!marks.length) return;
        const [a, b2] = marks[state.mIdx] || marks[0];
        ta.setSelectionRange(a, b2); ta.setRangeText(fr.value, a, b2, 'select'); fire(); state.mIdx = Math.max(0, state.mIdx - 1); return;
      }
      if (f === 'all') {
        const r = rx(); if (!r || !fr.value) return;
        const v = ta.value; const out = v.replace(r, fr.value.replace(/\$/g, '$$$$'));
        if (out !== v) { ta.value = out; fire(); A.toast && A.toast('Replaced ' + marks.length + ' match' + (marks.length === 1 ? '' : 'es'), 2500); }
        state.mIdx = 0; return match();
      }
    });

    /* ---------- the command palette ---------- */
    function palette() {
      const actions = [
        ['Save', 'Ctrl+S', () => saveIt()],
        ['Find', 'Ctrl+F', () => openFind(false)],
        ['Find and replace', 'Ctrl+H', () => openFind(true)],
        ['Go to line…', 'Ctrl+G', () => goLine()],
        ['Toggle word wrap', 'Alt+Z', () => wrapToggle()],
        ['Toggle the minimap', '', () => { map.hidden = !map.hidden; mini(); }],
        ['Toggle the line numbers', '', () => { gut.hidden = !gut.hidden; sync(); }],
        ['Go to the top of the file', 'Ctrl+Home', () => { ta.setSelectionRange(0, 0); ta.scrollTop = 0; sync(); caret(); }],
        ['Go to the end of the file', 'Ctrl+End', () => { ta.setSelectionRange(ta.value.length, ta.value.length); ta.scrollTop = ta.scrollHeight; sync(); caret(); }],
        ['Duplicate this line', 'Shift+Alt+↓', () => dup()],
        ['Delete this line', 'Ctrl+Shift+K', () => killLine()],
        ['Comment or uncomment this line', 'Ctrl+/', () => comment()],
        ['Copy everything', '', () => { A.copy && A.copy(ta.value); }],
      ];
      if (api.onPalette) for (const a of api.onPalette()) actions.push(a);
      const d = document.createElement('div'); d.className = 'ce-pal';
      d.innerHTML = '<input class="ce-pq" placeholder="Type a command…" autocomplete="off"><div class="ce-plist"></div>';
      wrap.appendChild(d);
      const q = d.querySelector('.ce-pq'), list = d.querySelector('.ce-plist');
      let shown = actions, sel = 0;
      const draw = () => {
        list.innerHTML = shown.length ? shown.map((a, i) => '<button class="ce-pi' + (i === sel ? ' on' : '') + '" data-k="' + i + '"><span>' + esc(a[0]) + '</span><span class="small mute">' + esc(a[1] || '') + '</span></button>').join('') : '<div class="small mute" style="padding:8px">Nothing matches.</div>';
      };
      const close = () => d.remove();
      q.oninput = () => { const t = q.value.toLowerCase(); shown = actions.filter(a => a[0].toLowerCase().includes(t)); sel = 0; draw(); };
      q.onkeydown = e => {
        e.stopPropagation();
        if (e.key === 'Escape') { close(); ta.focus(); }
        else if (e.key === 'ArrowDown') { sel = Math.min(shown.length - 1, sel + 1); draw(); e.preventDefault(); }
        else if (e.key === 'ArrowUp') { sel = Math.max(0, sel - 1); draw(); e.preventDefault(); }
        else if (e.key === 'Enter') { const a = shown[sel]; close(); ta.focus(); if (a) a[2](); }
      };
      list.onclick = e => { const b = e.target.closest('[data-k]'); if (!b) return; const a = shown[+b.dataset.k]; close(); ta.focus(); if (a) a[2](); };
      d.onclick = e => { if (e.target === d) close(); };
      draw(); q.focus();
    }
    function goLine() {
      const n = prompt('Go to line (1 – ' + ta.value.split('\n').length + '):');
      if (!n) return;
      const line = clamp(parseInt(n, 10) || 1, 1, ta.value.split('\n').length);
      const idx = ta.value.split('\n').slice(0, line - 1).join('\n').length + (line > 1 ? 1 : 0);
      ta.focus(); ta.setSelectionRange(idx, idx); revealLine(idx); caret();
    }
    const wrapToggle = () => { state.wrap = !state.wrap; ta.wrap = state.wrap ? 'soft' : 'off'; ta.style.whiteSpace = state.wrap ? 'pre-wrap' : 'pre'; wrap.querySelector('[data-s=wrap]').textContent = state.wrap ? 'wrap' : 'no wrap'; wrap.querySelector('[data-s=wrap]').classList.toggle('on', state.wrap); sync(); mini(); };
    const dup = () => { const v = ta.value, a = ta.selectionStart; const ls = v.lastIndexOf('\n', a - 1) + 1; let le = v.indexOf('\n', a); if (le < 0) le = v.length; const line = v.slice(ls, le); ta.setRangeText('\n' + line, le, le, 'end'); fire(); };
    const killLine = () => { const v = ta.value, a = ta.selectionStart; const ls = v.lastIndexOf('\n', a - 1) + 1; let le = v.indexOf('\n', a + 1); if (le < 0) le = v.length; ta.setRangeText('', ls, Math.min(v.length, le + 1), 'end'); fire(); };
    function comment() {
      const v = ta.value, a = ta.selectionStart, b = ta.selectionEnd;
      const ls = v.lastIndexOf('\n', a - 1) + 1; let le = v.indexOf('\n', b); if (le < 0) le = v.length;
      const block = v.slice(ls, le), mark = COMMENT[state.lang] || '//';
      const lines = block.split('\n');
      const allMarked = lines.every(l => !l.trim() || l.trimStart().startsWith(mark));
      const out = lines.map(l => {
        if (!l.trim()) return l;
        if (allMarked) return l.replace(mark + ' ', '').replace(mark, '');
        return l.replace(/^(\s*)/, '$1' + mark + ' ');
      }).join('\n');
      ta.setRangeText(out, ls, le, 'select'); fire();
    }

    /* ---------- typing helpers ---------- */
    function fire() { ta.dispatchEvent(new Event('input', { bubbles: true })); schedule(); caret(); }
    const autoIndent = e => {
      if (e.key !== 'Enter' || e.shiftKey || e.ctrlKey || e.metaKey || e.altKey || ta.readOnly) return;
      const v = ta.value, a = ta.selectionStart, b = ta.selectionEnd;
      const ls = v.lastIndexOf('\n', a - 1) + 1;
      const lineText = v.slice(ls, a);
      const indent = (/^\s*/.exec(lineText) || [''])[0];
      const opens = /[{\[(]$/.test(lineText.trimEnd());
      const after = v[b];
      e.preventDefault();
      let insert = '\n' + indent + (opens ? '  ' : '');
      let back = 0;
      if (opens && (after === '}' || after === ']' || after === ')')) { insert += '\n' + indent; back = indent.length + 1; }
      ta.setRangeText(insert, a, b, 'end');
      if (back) { const p = a + insert.length - back; ta.setSelectionRange(p, p); }
      fire();
    };
    const autoPair = e => {
      if (e.ctrlKey || e.metaKey || e.altKey || ta.readOnly) return;
      const open = e.key;
      if (PAIRS[open]) {
        const a = ta.selectionStart, b = ta.selectionEnd;
        e.preventDefault();
        if (a !== b) { const sel = ta.value.slice(a, b); ta.setRangeText(open + sel + PAIRS[open], a, b, 'select'); ta.setSelectionRange(a + 1, a + 1 + sel.length); }
        else { ta.setRangeText(open + PAIRS[open], a, b, 'end'); ta.setSelectionRange(a + 1, a + 1); }
        fire(); return;
      }
      if (/[)\]}'`"]/.test(open)) {
        const a = ta.selectionStart;
        if (ta.value[a] === open) { e.preventDefault(); ta.setSelectionRange(a + 1, a + 1); caret(); }
      }
    };
    const tabKey = e => {
      if (e.key !== 'Tab' || e.ctrlKey || e.altKey || e.metaKey || ta.readOnly) return false;
      e.preventDefault();
      const v = ta.value, a = ta.selectionStart, b = ta.selectionEnd, ls = v.lastIndexOf('\n', a - 1) + 1;
      if (a === b && !e.shiftKey) { ta.setRangeText('  ', a, b, 'end'); fire(); return true; }
      let le = v.indexOf('\n', b > a && v[b - 1] === '\n' ? b - 1 : b); if (le < 0) le = v.length;
      const block = v.slice(ls, le);
      const out = e.shiftKey ? block.replace(/^( {1,2}|\t)/gm, '') : block.replace(/^/gm, '  ');
      ta.setRangeText(out, ls, le, 'select'); fire(); return true;
    };

    ta.addEventListener('input', () => { schedule(); caret(); });
    ta.addEventListener('scroll', () => { sync(); mini(); });
    ta.addEventListener('keyup', caret);
    ta.addEventListener('click', caret);
    ta.addEventListener('select', caret);
    document.addEventListener('selectionchange', () => { if (document.activeElement === ta) caret(); });
    ta.addEventListener('keydown', e => {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && !e.shiftKey && e.key.toLowerCase() === 'f') { e.preventDefault(); return openFind(false); }
      if (mod && e.key.toLowerCase() === 'h' && !e.shiftKey) { e.preventDefault(); return openFind(true); }
      if (mod && e.key.toLowerCase() === 'g') { e.preventDefault(); return goLine(); }
      if (mod && e.shiftKey && e.key.toLowerCase() === 'p') { e.preventDefault(); return palette(); }
      if (e.key === 'F1') { e.preventDefault(); return palette(); }
      if (mod && e.key.toLowerCase() === 's') { e.preventDefault(); return saveIt(); }
      if (mod && e.key === '/') { e.preventDefault(); return comment(); }
      if (mod && e.shiftKey && e.key.toLowerCase() === 'k') { e.preventDefault(); return killLine(); }
      if (mod && e.altKey && e.key === 'ArrowDown') { e.preventDefault(); return moveLine(1); }
      if (mod && e.altKey && e.key === 'ArrowUp') { e.preventDefault(); return moveLine(-1); }
      if (e.altKey && e.key.toLowerCase() === 'z') { e.preventDefault(); return wrapToggle(); }
      if (e.key === 'Tab' && tabKey(e)) return;
      if (e.key === 'Enter') return autoIndent(e);
      if (e.key.length === 1) return autoPair(e);
    });
    function moveLine(dir) {
      const v = ta.value, a = ta.selectionStart;
      const ls = v.lastIndexOf('\n', a - 1) + 1; let le = v.indexOf('\n', a); if (le < 0) le = v.length;
      if (dir < 0 && ls === 0) return;
      if (dir > 0 && le === v.length) return;
      const line = v.slice(ls, le);
      if (dir < 0) {
        const pls = v.lastIndexOf('\n', ls - 2) + 1, prev = v.slice(pls, ls - 1);
        ta.setRangeText(prev + '\n' + line, pls, le, 'end');
        const na = a - (ls - pls); ta.setSelectionRange(na, na);
      } else {
        const nle = v.indexOf('\n', le + 1); const next = v.slice(le + 1, nle < 0 ? v.length : nle);
        ta.setRangeText(next + '\n' + line, ls, nle < 0 ? v.length : nle, 'end');
        const na = a + next.length + 1; ta.setSelectionRange(na, na);
      }
      fire();
    }
    const SAVE = () => (ta.dataset.save ? document.getElementById(ta.dataset.save) : null);
    function saveIt() {
      const b = SAVE();
      ta.dispatchEvent(new CustomEvent('ce-save', { bubbles: true }));
      if (b && !b.disabled) b.click();
    }

    /* ---------- public bits the pages use ---------- */
    api.setName = n => { name = n || ''; ta.dataset.name = name; render(); };
    api.setLang = l => { ta.dataset.lang = l || ''; render(); };
    api.focus = () => ta.focus();
    api.reveal = (idx) => { ta.setSelectionRange(idx, idx); revealLine(idx); caret(); };
    api.actions = list => { api.onPalette = () => list; };
    api.refresh = () => render();
    ta.__ce = api;

    /* a value set from a script does not fire input, so the drawing is refreshed here */
    const d = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value');
    try {
      Object.defineProperty(ta, 'value', { configurable: true, get() { return d.get.call(this); }, set(v) { d.set.call(this, v); schedule(); } });
    } catch (e) { }
    render();
    new ResizeObserver(() => mini()).observe(view);
    return api;
  }

  /* ---------------------------------------------------------------- tab strips */
  function tabbar(el, opts) {
    if (!el) return null;
    const api = { onselect: opts.onselect || (() => { }), onclose: opts.onclose || (() => { }) };
    api.render = (list, activeId) => {
      el.innerHTML = !list.length ? '' : list.map(t => '<div class="ce-tab' + (t.id === activeId ? ' on' : '') + (t.dirty ? ' dirty' : '') + '" data-tab="' + esc(t.id) + '" title="' + esc(t.title || t.id) + '"><span class="ce-ti">' + esc(t.icon || '') + '</span><span class="ce-tn">' + esc(t.name) + '</span><span class="ce-td" data-close="' + esc(t.id) + '" title="Close (Ctrl+W)">' + (t.dirty ? '●' : '✕') + '</span></div>').join('');
    };
    el.onclick = e => {
      const x = e.target.closest('[data-close]');
      if (x) { e.stopPropagation(); return api.onclose(x.dataset.close); }
      const t = e.target.closest('[data-tab]'); if (t) api.onselect(t.dataset.tab);
    };
    el.onauxclick = e => { const t = e.target.closest('[data-tab]'); if (t && e.button === 1) { e.preventDefault(); api.onclose(t.dataset.tab); } };
    return api;
  }

  /* ---------------------------------------------------------------- boot */
  function scan(root) {
    if (!root || root.nodeType !== 1) return;
    if (root.matches && root.matches('textarea[data-code], textarea.cl-ed')) upgrade(root);
    root.querySelectorAll && root.querySelectorAll('textarea[data-code], textarea.cl-ed').forEach(upgrade);
  }
  const mo = new MutationObserver(ms => {
    for (const m of ms) for (const n of m.addedNodes) if (n.nodeType === 1 && !n.closest('.ce')) scan(n);
  });
  const boot = () => { scan(document.body); mo.observe(document.body, { childList: true, subtree: true }); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();

  window.CodeEd = { upgrade, of: ta => (ta && ta.__ce) || null, tabbar, highlight, langOf, version: 1 };
})();

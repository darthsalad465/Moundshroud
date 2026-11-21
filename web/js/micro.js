// Micro Tools & shared helpers powered by Moundshroud's 19 ultra-small open-source repos:
//   qrcodegen, nomnoml+graphre, jsdiff, fflate, CodeJar, DOMPurify, plus native jq, rg, fd, sqlite-vec.
(() => {
  const esc2 = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const kb = n => n >= 1048576 ? (n / 1048576).toFixed(2) + ' MB' : n >= 1024 ? (n / 1024).toFixed(1) + ' KB' : n + ' B';

  /* ---- shared helpers used across tabs ---- */
  function qrSvg(text, size = 160, ec = 'M') {
    if (typeof window.qrcode !== 'function' || !text) return '';
    try {
      const q = window.qrcode(0, ec);
      q.addData(String(text));
      q.make();
      const n = q.getModuleCount(), pad = 2, tot = n + pad * 2;
      let path = '';
      for (let r = 0; r < n; r++) {
        for (let c = 0; c < n; c++) {
          if (q.isDark(r, c)) path += 'M' + (c + pad) + ',' + (r + pad) + 'h1v1h-1z';
        }
      }
      return '<svg xmlns="http://www.w3.org/2000/svg" width="' + size + '" height="' + size + '" viewBox="0 0 ' + tot + ' ' + tot + '" shape-rendering="crispEdges" style="background:#fff;border-radius:8px;display:block"><rect width="' + tot + '" height="' + tot + '" fill="#fff"/><path d="' + path + '" fill="#0b0d14"/></svg>';
    } catch (e) { return ''; }
  }

  function sanitize(html) {
    if (window.DOMPurify && typeof window.DOMPurify.sanitize === 'function') {
      return window.DOMPurify.sanitize(String(html || ''), { USE_PROFILES: { html: true, svg: true, svgFilters: true } });
    }
    /* DOMPurify is not loaded: strip everything active instead of showing a note's HTML exactly as it is */
    return String(html || '')
      .replace(/<\s*(script|style|iframe|frame|frameset|object|embed|applet|link|meta|base|form|template|noscript|svg|math)\b[\s\S]*?<\s*\/\s*\1\s*>/gi, '')
      .replace(/<\s*(script|style|iframe|frame|frameset|object|embed|applet|link|meta|base|form|input|button|textarea|select|template|svg|math)\b[^>]*>/gi, '')
      .replace(/\son[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
      .replace(/\s(srcdoc|formaction|action)\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
      .replace(/\s(href|src|xlink:href)\s*=\s*(?:"|')?\s*(?:javascript|vbscript|data:text\/html)[^"'\s>]*/gi, ' $1="#"');
  }

  function diffHtml(a, b, mode = 'lines') {
    if (!window.Diff) return '<pre class="small">' + esc2(b) + '</pre>';
    const parts = mode === 'words' ? window.Diff.diffWords(String(a || ''), String(b || '')) : window.Diff.diffLines(String(a || ''), String(b || ''));
    if (mode === 'words') {
      return '<div style="font-family:Consolas,monospace;font-size:12.5px;line-height:1.55;white-space:pre-wrap;padding:10px;border-radius:8px;background:var(--panel2);border:1px solid var(--line)">' +
        parts.map(p => p.added ? '<span style="background:rgba(94,230,168,.24);color:#6f6">' + esc2(p.value) + '</span>' : p.removed ? '<span style="background:rgba(255,107,129,.22);color:#f77;text-decoration:line-through">' + esc2(p.value) + '</span>' : esc2(p.value)).join('') + '</div>';
    }
    let addN = 0, delN = 0;
    const rows = [];
    for (const p of parts) {
      const lines = p.value.replace(/\n$/, '').split('\n');
      for (const ln of lines) {
        if (p.added) { addN++; rows.push('<div style="background:rgba(94,230,168,.16);color:#8af5b5;padding:0 8px">+ ' + esc2(ln) + '</div>'); }
        else if (p.removed) { delN++; rows.push('<div style="background:rgba(255,107,129,.16);color:#ff9aa8;padding:0 8px">- ' + esc2(ln) + '</div>'); }
        else rows.push('<div style="color:var(--mute);padding:0 8px">  ' + esc2(ln) + '</div>');
      }
    }
    return '<div class="small mute" style="margin-bottom:6px"><span style="color:#6f6">+' + addN + ' added</span> · <span style="color:#f77">-' + delN + ' removed</span></div>' +
      '<div style="font-family:Consolas,monospace;font-size:12px;line-height:1.5;white-space:pre;overflow:auto;max-height:55vh;border-radius:8px;background:#080b12;border:1px solid var(--line);padding:6px 0">' + rows.join('') + '</div>';
  }

  function renderNomnoml(src) {
    if (!window.nomnoml || typeof window.nomnoml.renderSvg !== 'function') return '';
    const themed = '#stroke: #9bb4ff\n#fill: #151a28;#1d2438\n#background: transparent\n#fontSize: 13\n#padding: 10\n' + String(src || '');
    return window.nomnoml.renderSvg(themed);
  }

  function highlightCode(el) {
    const raw = el.textContent || '';
    const html = esc2(raw)
      .replace(/(\/\/[^\n]*|\/\*[\s\S]*?\*\/)/g, '<span style="color:#6c7d96">$1</span>')
      .replace(/(&quot;(?:\\.|[^&]|&(?!quot;))*?&quot;|&#39;[^']*?&#39;|`[^`]*?`)/g, '<span style="color:#a5e898">$1</span>')
      .replace(/\b(const|let|var|function|return|if|else|for|while|async|await|try|catch|class|new|true|false|null|undefined|import|export)\b/g, '<span style="color:#8cb4ff;font-weight:600">$1</span>')
      .replace(/\b(\d+(?:\.\d+)?)\b/g, '<span style="color:#f5c27b">$1</span>');
    el.innerHTML = html;
  }

  const LANG_NAMES = { eng: 'English', spa: 'Spanish', fra: 'French', deu: 'German', ita: 'Italian', por: 'Portuguese', nld: 'Dutch', rus: 'Russian', ukr: 'Ukrainian', pol: 'Polish', tur: 'Turkish', arb: 'Arabic', heb: 'Hebrew', hin: 'Hindi', ben: 'Bengali', urd: 'Urdu', cmn: 'Chinese (Mandarin)', jpn: 'Japanese', kor: 'Korean', vie: 'Vietnamese', tha: 'Thai', ind: 'Indonesian', swh: 'Swahili', ell: 'Greek', swe: 'Swedish', nob: 'Norwegian', dan: 'Danish', fin: 'Finnish', ces: 'Czech', ron: 'Romanian', hun: 'Hungarian', cat: 'Catalan', lat: 'Latin' };
  function detectLang(text) {
    const s = String(text || '').trim();
    if (s.length < 12 || typeof window.franc !== 'function') return null;
    try {
      const code = window.franc(s);
      if (!code || code === 'und') return null;
      return { code, name: LANG_NAMES[code] || code.toUpperCase() };
    } catch (e) { return null; }
  }

  function readArticle(html) {
    if (typeof window.Readability !== 'function') return null;
    try {
      const doc = new DOMParser().parseFromString(String(html || ''), 'text/html');
      return new window.Readability(doc).parse();
    } catch (e) { return null; }
  }

  /* ---- Tools > Micro Tools workbench ---- */
  const DIAG_PRESETS = {
    Flowchart: '[User Prompt] -> [Local Ollama]\n[Local Ollama] -> <Needs Files?>\n<Needs Files?> yes -> [SQLite + sqlite-vec]\n[SQLite + sqlite-vec] -> [Answer]\n<Needs Files?> no -> [Answer]',
    Architecture: '[Browser UI\n  | Today · Chat · Notes · Studio]\n[Node Server\n  | server.js · lib/]\n[Local Engines\n  | Ollama · Kiwix · rg · fd · jq · vec0]\n[Browser UI] <-> [Node Server]\n[Node Server] <-> [Local Engines]',
    State: '[<start> start] -> [Draft]\n[Draft] -> [Review]\n[Review] -> [Approved]\n[Review] -> [Draft]\n[Approved] -> [<end> done]',
  };

  function render(root) {
    let tab = 'qr', jar = null;
    const TABS = [
      ['qr', '📱 QR Maker'],
      ['bar', '🏷 Barcodes'],
      ['diag', '📐 Diagrams'],
      ['diff', '± Diff'],
      ['jq', '{} JSON / jq / YAML'],
      ['col', '🎨 Colors'],
      ['read', '📰 Reader Mode'],
      ['zip', '🗜 ZIP'],
      ['find', '⚡ rg / fd / sd'],
      ['pad', '💻 CodePad'],
    ];
    root.innerHTML = '<div class="scroll pad" style="flex:1"><div style="max-width:1040px;margin:0 auto">' +
      '<div class="row" style="gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:8px"><h2 style="margin:0">🧩 Micro Tools</h2><span class="small mute">Ultra-small offline utilities (QR, Barcodes, nomnoml, jsdiff, jq, YAML, colord, Readability, fflate, rg/fd/sd, CodeJar)</span></div>' +
      '<div class="row" id="mtabs" style="gap:6px;flex-wrap:wrap;margin-bottom:12px">' + TABS.map(t => '<button class="ib" data-t="' + t[0] + '">' + t[1] + '</button>').join('') + '</div>' +
      '<div id="mbody"></div></div></div>';
    const q = s => root.querySelector(s);

    function mark() { root.querySelectorAll('#mtabs [data-t]').forEach(b => b.classList.toggle('on', b.dataset.t === tab)); }

    function draw() {
      mark();
      if (jar) { try { jar.destroy(); } catch (e) { } jar = null; }
      const b = q('#mbody');
      if (tab === 'qr') drawQr(b);
      else if (tab === 'bar') drawBar(b);
      else if (tab === 'diag') drawDiag(b);
      else if (tab === 'diff') drawDiff(b);
      else if (tab === 'jq') drawJq(b);
      else if (tab === 'col') drawCol(b);
      else if (tab === 'read') drawRead(b);
      else if (tab === 'zip') drawZip(b);
      else if (tab === 'find') drawFind(b);
      else if (tab === 'pad') drawPad(b);
    }

    function drawBar(b) {
      b.innerHTML = '<div class="card"><b>Offline Barcode Generator (JsBarcode)</b><div class="small mute" style="margin:3px 0 8px">Make crisp barcodes for Prepare supplies, Kitchen pantry bins, or inventory labels.</div>' +
        '<div class="row" style="gap:8px;flex-wrap:wrap;margin-bottom:10px"><input id="mb-in" type="text" value="MOUNDSHROUD-01" style="flex:1;min-width:180px">' +
        '<select id="mb-fmt" class="ib"><option value="CODE128">CODE128 (any text)</option><option value="EAN13">EAN-13 (12-13 digits)</option><option value="UPC">UPC-A (11-12 digits)</option><option value="CODE39">CODE39</option></select>' +
        '<button class="pri" id="mb-svg">⬇ SVG</button></div>' +
        '<div style="background:#fff;border-radius:10px;padding:14px;display:inline-block;min-width:220px"><svg id="mb-out"></svg></div><div class="small mute" id="mb-err" style="margin-top:6px"></div></div>';
      const upd = () => {
        const err = b.querySelector('#mb-err'); err.textContent = '';
        if (typeof window.JsBarcode !== 'function') { err.textContent = 'JsBarcode unavailable.'; return; }
        try { window.JsBarcode(b.querySelector('#mb-out'), b.querySelector('#mb-in').value || '0', { format: b.querySelector('#mb-fmt').value, lineColor: '#111', background: '#fff', displayValue: true }); }
        catch (e) { err.style.color = 'var(--bad)'; err.textContent = 'Invalid value for ' + b.querySelector('#mb-fmt').value + ': ' + (e.message || e); }
      };
      b.querySelector('#mb-in').oninput = b.querySelector('#mb-fmt').onchange = upd; upd();
      b.querySelector('#mb-svg').onclick = () => {
        const s = b.querySelector('#mb-out').outerHTML;
        const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([s], { type: 'image/svg+xml' })); a.download = 'barcode.svg'; a.click();
      };
    }

    function drawCol(b) {
      b.innerHTML = '<div class="card"><b>Color &amp; Contrast Lab (colord)</b><div class="small mute" style="margin:3px 0 10px">Inspect Hex / RGB / HSL values, generate lighter/darker tints, and check WCAG text contrast ratios.</div>' +
        '<div class="row" style="gap:10px;flex-wrap:wrap;align-items:center;margin-bottom:10px"><label class="small">Foreground <input type="color" id="mc-fg" value="#f2c75c" style="vertical-align:middle"></label><input id="mc-fgt" value="#f2c75c" style="width:120px;font-family:monospace">' +
        '<label class="small">Background <input type="color" id="mc-bg" value="#170d3a" style="vertical-align:middle"></label><input id="mc-bgt" value="#170d3a" style="width:120px;font-family:monospace"></div>' +
        '<div id="mc-prev" style="padding:18px;border-radius:10px;border:1px solid var(--line);font-size:18px;font-weight:700;margin-bottom:10px">The quick brown fox jumps over the lazy dog — 123456</div>' +
        '<div id="mc-info" class="small" style="line-height:1.7"></div></div>';
      const fg = b.querySelector('#mc-fg'), fgt = b.querySelector('#mc-fgt'), bg = b.querySelector('#mc-bg'), bgt = b.querySelector('#mc-bgt');
      const lum = c => { const r = c.toRgb(), ch = [r.r, r.g, r.b].map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2]; };
      const upd = () => {
        if (typeof window.colord !== 'function') return;
        const c1 = window.colord(fgt.value), c2 = window.colord(bgt.value);
        if (!c1.isValid() || !c2.isValid()) return;
        fg.value = c1.toHex(); bg.value = c2.toHex();
        const pv = b.querySelector('#mc-prev'); pv.style.color = c1.toHex(); pv.style.background = c2.toHex();
        const l1 = lum(c1), l2 = lum(c2), ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
        const grade = ratio >= 7 ? 'AAA ✓' : ratio >= 4.5 ? 'AA ✓' : ratio >= 3 ? 'AA Large only' : 'Fail ✗';
        const shades = [-0.3, -0.15, 0, 0.15, 0.3].map(k => { const s = k < 0 ? c1.darken(-k) : c1.lighten(k); return '<span title="' + s.toHex() + '" data-cp="' + s.toHex() + '" style="display:inline-block;width:44px;height:28px;border-radius:6px;background:' + s.toHex() + ';border:1px solid var(--line);cursor:pointer;vertical-align:middle;margin-right:4px"></span>'; }).join('');
        b.querySelector('#mc-info').innerHTML = '<div><b>Contrast ratio:</b> ' + ratio.toFixed(2) + ':1 — <b style="color:' + (ratio >= 4.5 ? 'var(--ok)' : 'var(--warn)') + '">' + grade + '</b></div>' +
          '<div><b>Foreground:</b> <code>' + c1.toHex() + '</code> · <code>' + c1.toRgbString() + '</code> · <code>' + c1.toHslString() + '</code></div>' +
          '<div><b>Background:</b> <code>' + c2.toHex() + '</code> · <code>' + c2.toRgbString() + '</code> · <code>' + c2.toHslString() + '</code></div>' +
          '<div style="margin-top:8px"><b>Shades (click to copy):</b> ' + shades + '</div>';
        b.querySelectorAll('[data-cp]').forEach(s => s.onclick = () => A.copy(s.dataset.cp));
      };
      fg.oninput = () => { fgt.value = fg.value; upd(); }; bg.oninput = () => { bgt.value = bg.value; upd(); };
      fgt.oninput = bgt.oninput = upd; upd();
    }

    function drawRead(b) {
      b.innerHTML = '<div class="card"><b>Article Reader Mode (Mozilla Readability)</b><div class="small mute" style="margin:3px 0 8px">Paste raw HTML from any webpage to strip ads, menus, and clutter into clean readable text.</div>' +
        '<textarea id="mr-in" rows="6" placeholder="Paste webpage HTML here..."></textarea>' +
        '<div class="row" style="gap:8px;margin:8px 0"><button class="pri" id="mr-go">Extract article</button><button class="ib" id="mr-save" disabled>📝 Save to Notes</button><span class="small mute" id="mr-meta"></span></div>' +
        '<div id="mr-out" style="max-height:360px;overflow:auto;line-height:1.65"></div></div>';
      let last = null;
      b.querySelector('#mr-go').onclick = () => {
        last = readArticle(b.querySelector('#mr-in').value);
        if (!last || !last.textContent) { b.querySelector('#mr-meta').textContent = 'Could not find an article in that HTML.'; b.querySelector('#mr-save').disabled = true; return; }
        const words = last.textContent.trim().split(/\s+/).length;
        const lang = detectLang(last.textContent);
        b.querySelector('#mr-meta').textContent = words + ' words · ~' + Math.max(1, Math.round(words / 220)) + ' min read' + (lang ? ' · ' + lang.name : '');
        b.querySelector('#mr-out').innerHTML = (last.title ? '<h3 style="margin-top:0">' + esc2(last.title) + '</h3>' : '') + sanitize(last.content);
        b.querySelector('#mr-save').disabled = false;
      };
      b.querySelector('#mr-save').onclick = () => { if (last && A.notes) A.notes.create(last.title || 'Saved article', (last.title ? '# ' + last.title + '\n\n' : '') + last.textContent.trim()); };
    }

    function drawQr(b) {
      b.innerHTML = '<div class="card"><div class="row" style="gap:16px;align-items:flex-start;flex-wrap:wrap">' +
        '<div style="flex:1;min-width:260px"><b>Generate an offline QR code</b><div class="small mute" style="margin:3px 0 8px">Encode a URL, text, or Wi-Fi credentials. Nothing leaves this PC.</div>' +
        '<textarea id="mqr-in" rows="4" placeholder="https://example.com or any text...">http://127.0.0.1:47231</textarea>' +
        '<div class="row" style="gap:6px;margin-top:8px;flex-wrap:wrap"><button class="ib" id="mqr-wifi">📶 Wi-Fi template</button><button class="ib" id="mqr-svg">⬇ Download SVG</button><button class="pri" id="mqr-png">⬇ Download PNG</button></div></div>' +
        '<div id="mqr-out" style="padding:12px;background:var(--panel2);border:1px solid var(--line);border-radius:12px;min-width:200px;display:grid;place-items:center"></div></div></div>';
      const inp = b.querySelector('#mqr-in'), out = b.querySelector('#mqr-out');
      const upd = () => { out.innerHTML = qrSvg(inp.value.trim(), 200) || '<span class="small mute">Type text to generate QR</span>'; };
      inp.oninput = upd; upd();
      b.querySelector('#mqr-wifi').onclick = () => { inp.value = 'WIFI:T:WPA;S:MyNetworkName;P:MyPassword;;'; upd(); };
      b.querySelector('#mqr-svg').onclick = () => {
        const s = qrSvg(inp.value.trim(), 320); if (!s) return;
        const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([s], { type: 'image/svg+xml' })); a.download = 'moundshroud-qr.svg'; a.click();
      };
      b.querySelector('#mqr-png').onclick = () => {
        const s = qrSvg(inp.value.trim(), 480); if (!s) return;
        const img = new Image(), url = URL.createObjectURL(new Blob([s], { type: 'image/svg+xml' }));
        img.onload = () => { const c = document.createElement('canvas'); c.width = 480; c.height = 480; c.getContext('2d').drawImage(img, 0, 0); URL.revokeObjectURL(url); c.toBlob(bl => { const a = document.createElement('a'); a.href = URL.createObjectURL(bl); a.download = 'moundshroud-qr.png'; a.click(); }); };
        img.src = url;
      };
    }

    function drawDiag(b) {
      b.innerHTML = '<div class="card"><div class="row" style="gap:6px;flex-wrap:wrap;margin-bottom:8px"><b>Diagram Studio (nomnoml)</b><span class="sp"></span>' +
        Object.keys(DIAG_PRESETS).map(k => '<button class="ib" data-dp="' + k + '">' + k + '</button>').join('') +
        '<button class="pri" id="md-svg">⬇ SVG</button></div>' +
        '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:12px">' +
        '<textarea id="md-in" rows="12" style="font-family:Consolas,monospace;font-size:12.5px">' + esc2(DIAG_PRESETS.Flowchart) + '</textarea>' +
        '<div id="md-out" style="background:#0a0e17;border:1px solid var(--line);border-radius:10px;padding:12px;overflow:auto;min-height:240px;display:grid;place-items:center"></div></div>' +
        '<div class="small mute" style="margin-top:6px">Tip: you can also put <code>```nomnoml</code> code blocks inside <b>Notes</b> and hit Preview!</div></div>';
      const inp = b.querySelector('#md-in'), out = b.querySelector('#md-out');
      const upd = () => {
        try { out.innerHTML = sanitize(renderNomnoml(inp.value)); }
        catch (e) { out.innerHTML = '<span class="small" style="color:var(--bad)">' + esc2(e.message || e) + '</span>'; }
      };
      inp.oninput = upd; upd();
      b.querySelectorAll('[data-dp]').forEach(btn => btn.onclick = () => { inp.value = DIAG_PRESETS[btn.dataset.dp]; upd(); });
      b.querySelector('#md-svg').onclick = () => {
        try { const s = renderNomnoml(inp.value); const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([s], { type: 'image/svg+xml' })); a.download = 'diagram.svg'; a.click(); } catch (e) { A.toast('Fix diagram syntax first.'); }
      };
    }

    function drawDiff(b) {
      b.innerHTML = '<div class="card"><div class="row" style="gap:8px;flex-wrap:wrap;margin-bottom:8px"><b>Text &amp; Code Diff (jsdiff)</b><span class="sp"></span><button class="ib on" data-dm="lines">Line diff</button><button class="ib" data-dm="words">Word diff</button><button class="ib" id="mdf-patch">📋 Copy patch</button></div>' +
        '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:10px;margin-bottom:10px">' +
        '<textarea id="mdf-a" rows="7" style="font-family:Consolas,monospace;font-size:12px" placeholder="Original text..."></textarea>' +
        '<textarea id="mdf-b" rows="7" style="font-family:Consolas,monospace;font-size:12px" placeholder="Changed text..."></textarea></div>' +
        '<div id="mdf-out"></div></div>';
      let mode = 'lines';
      const ta = b.querySelector('#mdf-a'), tb = b.querySelector('#mdf-b'), out = b.querySelector('#mdf-out');
      const upd = () => { out.innerHTML = diffHtml(ta.value, tb.value, mode); };
      ta.oninput = tb.oninput = upd;
      b.querySelectorAll('[data-dm]').forEach(btn => btn.onclick = () => { mode = btn.dataset.dm; b.querySelectorAll('[data-dm]').forEach(x => x.classList.toggle('on', x === btn)); upd(); });
      b.querySelector('#mdf-patch').onclick = () => { if (window.Diff) A.copy(window.Diff.createTwoFilesPatch('original', 'modified', ta.value, tb.value)); };
      upd();
    }

    function drawJq(b) {
      b.innerHTML = '<div class="card"><div class="row" style="gap:8px;flex-wrap:wrap;margin-bottom:8px"><b>JSON / jq Lab</b><span class="small mute" id="mjq-st"></span><span class="sp"></span>' +
        '<label class="chk small"><input type="checkbox" id="mjq-r"> -r raw</label><label class="chk small"><input type="checkbox" id="mjq-c"> -c compact</label><label class="chk small"><input type="checkbox" id="mjq-s"> -S sort keys</label></div>' +
        '<div class="row" style="gap:8px;margin-bottom:8px;flex-wrap:wrap"><input id="mjq-f" type="text" value="." style="flex:1;min-width:180px;font-family:Consolas,monospace" placeholder="jq filter (e.g. .items[] | select(.ok))"><button class="pri" id="mjq-go">Run jq</button><button class="ib" id="mjq-y2j" title="Convert YAML input to JSON (js-yaml)">YAML → JSON</button><button class="ib" id="mjq-j2y" title="Convert JSON output to YAML (js-yaml)">JSON → YAML</button></div>' +
        '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:10px">' +
        '<textarea id="mjq-in" rows="12" style="font-family:Consolas,monospace;font-size:12px">{\n  "app": "Moundshroud",\n  "tools": [\n    {"name": "jq", "fast": true},\n    {"name": "rg", "fast": true},\n    {"name": "fd", "fast": true}\n  ]\n}</textarea>' +
        '<pre id="mjq-out" style="margin:0;padding:10px;background:#080b12;border:1px solid var(--line);border-radius:8px;font-family:Consolas,monospace;font-size:12px;overflow:auto;max-height:320px;white-space:pre-wrap"></pre></div></div>';
      const run = async () => {
        const out = b.querySelector('#mjq-out');
        out.textContent = 'Running…';
        const r = await A.api('/api/micro/jq', { input: b.querySelector('#mjq-in').value, filter: b.querySelector('#mjq-f').value, raw: b.querySelector('#mjq-r').checked, compact: b.querySelector('#mjq-c').checked, sortKeys: b.querySelector('#mjq-s').checked }).catch(() => ({ ok: false, error: 'Server unreachable' }));
        out.style.color = r && r.ok ? '#c9f5d4' : 'var(--bad)';
        out.textContent = r && r.ok ? r.output : (r && r.error) || 'Failed';
      };
      b.querySelector('#mjq-go').onclick = run;
      b.querySelector('#mjq-y2j').onclick = () => {
        if (!window.jsyaml) return A.toast('js-yaml unavailable.');
        try { const obj = window.jsyaml.load(b.querySelector('#mjq-in').value); b.querySelector('#mjq-in').value = JSON.stringify(obj, null, 2); run(); }
        catch (e) { b.querySelector('#mjq-out').style.color = 'var(--bad)'; b.querySelector('#mjq-out').textContent = 'YAML error: ' + e.message; }
      };
      b.querySelector('#mjq-j2y').onclick = () => {
        if (!window.jsyaml) return A.toast('js-yaml unavailable.');
        try { const src = b.querySelector('#mjq-out').textContent || b.querySelector('#mjq-in').value; b.querySelector('#mjq-out').style.color = '#c9f5d4'; b.querySelector('#mjq-out').textContent = window.jsyaml.dump(JSON.parse(src)); }
        catch (e) { b.querySelector('#mjq-out').style.color = 'var(--bad)'; b.querySelector('#mjq-out').textContent = 'JSON error: ' + e.message; }
      };
      b.querySelector('#mjq-f').onkeydown = e => { if (e.key === 'Enter') run(); };
      run();
    }

    function drawZip(b) {
      b.innerHTML = '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:12px">' +
        '<div class="card"><b>Inspect &amp; Extract ZIP (fflate)</b><div class="small mute" style="margin:4px 0 8px">Works on .zip, .docx, .xlsx, .pptx, .epub — 100% in browser.</div>' +
        '<input type="file" id="mz-in" accept=".zip,.docx,.xlsx,.pptx,.epub,.jar"><div id="mz-list" style="margin-top:10px;max-height:320px;overflow:auto"></div></div>' +
        '<div class="card"><b>Pack Files into a ZIP</b><div class="small mute" style="margin:4px 0 8px">Pick any files to bundle into a compressed .zip offline.</div>' +
        '<input type="file" id="mz-pack" multiple><div class="row" style="gap:8px;margin-top:10px"><input id="mz-name" type="text" value="archive.zip" style="flex:1"><button class="pri" id="mz-go" disabled>⬇ Create ZIP</button></div><div class="small mute" id="mz-pst" style="margin-top:6px"></div></div></div>';
      let unpacked = null, packFiles = [];
      b.querySelector('#mz-in').onchange = async e => {
        const f = e.target.files[0]; if (!f || !window.fflate) return;
        const buf = new Uint8Array(await f.arrayBuffer());
        try {
          unpacked = window.fflate.unzipSync(buf);
          const entries = Object.entries(unpacked);
          b.querySelector('#mz-list').innerHTML = '<div class="small mute" style="margin-bottom:6px">' + entries.length + ' entries in ' + esc2(f.name) + '</div>' +
            entries.map(([name, data], i) => '<div class="row small" style="padding:4px 0;border-bottom:1px dashed var(--line)"><span style="flex:1;word-break:break-all">' + esc2(name) + '</span><span class="mute">' + kb(data.length) + '</span>' + (data.length ? '<button class="ib" data-zx="' + i + '">Save</button>' : '') + '</div>').join('');
          b.querySelector('#mz-list').onclick = ev => {
            const btn = ev.target.closest('[data-zx]'); if (!btn) return;
            const [name, data] = entries[+btn.dataset.zx];
            const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([data])); a.download = name.split('/').pop() || 'file'; a.click();
          };
        } catch (err) { b.querySelector('#mz-list').innerHTML = '<span class="small" style="color:var(--bad)">Could not unzip: ' + esc2(err.message) + '</span>'; }
      };
      b.querySelector('#mz-pack').onchange = e => {
        packFiles = [...e.target.files];
        b.querySelector('#mz-go').disabled = !packFiles.length;
        b.querySelector('#mz-pst').textContent = packFiles.length ? packFiles.length + ' file(s) ready (' + kb(packFiles.reduce((s, f) => s + f.size, 0)) + ')' : '';
      };
      b.querySelector('#mz-go').onclick = async () => {
        if (!packFiles.length || !window.fflate) return;
        const obj = {};
        for (const f of packFiles) obj[f.name] = new Uint8Array(await f.arrayBuffer());
        const zipped = window.fflate.zipSync(obj, { level: 6 });
        const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([zipped], { type: 'application/zip' })); a.download = b.querySelector('#mz-name').value.trim() || 'archive.zip'; a.click();
        b.querySelector('#mz-pst').textContent = 'Created ' + kb(zipped.length) + ' ZIP.';
      };
    }

    function drawFind(b) {
      b.innerHTML = '<div class="card"><b>Native Fast Search (ripgrep &amp; fd)</b><div class="small mute" id="mf-st" style="margin:3px 0 8px">Checking engines\\micro…</div>' +
        '<div class="row" style="gap:8px;flex-wrap:wrap;margin-bottom:8px"><select id="mf-mode" class="ib"><option value="rg">ripgrep (text in files)</option><option value="fd">fd (file names)</option></select>' +
        '<input id="mf-q" type="text" style="flex:2;min-width:180px" placeholder="Search text or filename pattern...">' +
        '<input id="mf-dir" type="text" style="flex:1;min-width:140px" placeholder="Folder (blank = Moundshroud)">' +
        '<button class="pri" id="mf-go">Search</button></div><div id="mf-out" style="max-height:300px;overflow:auto;font-family:Consolas,monospace;font-size:12px"></div></div>' +
        '<div class="card" style="margin-top:12px"><b>Fast Find &amp; Replace (sd)</b><div class="small mute" style="margin:3px 0 8px">Test regex or literal replacements safely in memory via <code>sd.exe</code>.</div>' +
        '<div class="row" style="gap:8px;flex-wrap:wrap;margin-bottom:8px"><input id="msd-f" type="text" placeholder="Find pattern (regex or text)" style="flex:1;font-family:Consolas,monospace"><input id="msd-r" type="text" placeholder="Replace with ($1, $2...)" style="flex:1;font-family:Consolas,monospace"><label class="chk small"><input type="checkbox" id="msd-fix"> literal (-F)</label><button class="pri" id="msd-go">Replace</button></div>' +
        '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:10px"><textarea id="msd-in" rows="5" style="font-family:Consolas,monospace;font-size:12px" placeholder="Input text...">version = "1.2.0"\nbuild = "1.2.0"</textarea><pre id="msd-out" style="margin:0;padding:10px;background:#080b12;border:1px solid var(--line);border-radius:8px;font-family:Consolas,monospace;font-size:12px;white-space:pre-wrap"></pre></div></div>';
      A.api('/api/micro/status').then(r => {
        const t = (r && r.tools) || {};
        b.querySelector('#mf-st').textContent = ['rg', 'fd', 'jq', 'sd', 'vec'].map(k => k + ': ' + (t[k] && t[k].ok ? '✓ ' + kb(t[k].bytes) : 'not installed')).join('  ·  ');
      }).catch(() => { });
      b.querySelector('#msd-go').onclick = async () => {
        const out = b.querySelector('#msd-out');
        const r = await A.api('/api/micro/sd', { input: b.querySelector('#msd-in').value, find: b.querySelector('#msd-f').value, replace: b.querySelector('#msd-r').value, fixed: b.querySelector('#msd-fix').checked }).catch(() => ({ ok: false, error: 'Failed' }));
        out.style.color = r && r.ok ? '#c9f5d4' : 'var(--bad)';
        out.textContent = r && r.ok ? r.output : (r && r.error) || 'Failed';
      };
      const run = async () => {
        const mode = b.querySelector('#mf-mode').value, qv = b.querySelector('#mf-q').value.trim(), dir = b.querySelector('#mf-dir').value.trim(), out = b.querySelector('#mf-out');
        if (!qv) return A.toast('Type something to search for.');
        out.textContent = 'Searching…';
        if (mode === 'rg') {
          const r = await A.api('/api/micro/rg', { q: qv, dir }).catch(() => ({ ok: false, error: 'Failed' }));
          if (!r || !r.ok) { out.innerHTML = '<span style="color:var(--bad)">' + esc2((r && r.error) || 'Failed') + '</span>'; return; }
          out.innerHTML = r.hits.length ? '<div class="small mute" style="margin-bottom:6px">' + r.hits.length + ' match(es)' + (r.truncated ? ' (capped)' : '') + '</div>' +
            r.hits.map(h => '<div style="padding:3px 0;border-bottom:1px dashed var(--line)"><span style="color:var(--acc)">' + esc2(h.rel) + ':' + h.line + '</span>  ' + esc2(h.text.trim()) + '</div>').join('') : '<div class="mute">No matches.</div>';
        } else {
          const r = await A.api('/api/micro/fd', { pattern: qv, dir }).catch(() => ({ ok: false, error: 'Failed' }));
          if (!r || !r.ok) { out.innerHTML = '<span style="color:var(--bad)">' + esc2((r && r.error) || 'Failed') + '</span>'; return; }
          out.innerHTML = r.files.length ? '<div class="small mute" style="margin-bottom:6px">' + r.files.length + ' file(s)</div>' +
            r.files.map(f => '<div style="padding:2px 0">' + esc2(f.rel) + '</div>').join('') : '<div class="mute">No files found.</div>';
        }
      };
      b.querySelector('#mf-go').onclick = run;
      b.querySelector('#mf-q').onkeydown = e => { if (e.key === 'Enter') run(); };
    }

    function drawPad(b) {
      b.innerHTML = '<div class="card"><div class="row" style="gap:8px;flex-wrap:wrap;margin-bottom:8px"><b>Code Scratchpad (CodeJar)</b><span class="sp"></span><button class="pri" id="mp-run">▶ Run JS</button><button class="ib" id="mp-fmt">{ } Format JSON</button><button class="ib" id="mp-cp">📋 Copy</button></div>' +
        '<div id="mp-ed" style="min-height:220px;max-height:360px;overflow:auto;padding:12px;border-radius:10px;background:#080b12;color:#e4ecf7;border:1px solid var(--line);font-family:Consolas,monospace;font-size:13px;line-height:1.5;white-space:pre"></div>' +
        '<pre id="mp-out" style="margin:8px 0 0;padding:10px;background:var(--panel2);border:1px solid var(--line);border-radius:8px;font-family:Consolas,monospace;font-size:12px;min-height:48px;white-space:pre-wrap"></pre></div>';
      const ed = b.querySelector('#mp-ed'), out = b.querySelector('#mp-out');
      const init = ls.get('micro_codepad', '// Quick local JavaScript scratchpad (CodeJar)\nconst nums = [1, 2, 3, 4, 5];\nconsole.log("Sum:", nums.reduce((a, b) => a + b, 0));');
      ed.textContent = init;
      if (typeof window.CodeJar === 'function') {
        jar = window.CodeJar(ed, highlightCode, { tab: '  ' });
        jar.onUpdate(code => ls.set('micro_codepad', code));
        highlightCode(ed);
      } else { ed.contentEditable = 'true'; }
      b.querySelector('#mp-run').onclick = () => {
        const logs = [];
        const fakeConsole = { log: (...a) => logs.push(a.map(x => typeof x === 'object' ? JSON.stringify(x, null, 2) : String(x)).join(' ')), error: (...a) => logs.push('ERR: ' + a.join(' ')), warn: (...a) => logs.push('WARN: ' + a.join(' ')) };
        try { const res = new Function('console', ed.textContent)(fakeConsole); if (res !== undefined) logs.push('→ ' + (typeof res === 'object' ? JSON.stringify(res, null, 2) : String(res))); out.style.color = '#c9f5d4'; out.textContent = logs.join('\n') || '(ran with no output)'; }
        catch (err) { out.style.color = 'var(--bad)'; out.textContent = String(err); }
      };
      b.querySelector('#mp-fmt').onclick = () => {
        try { const f = JSON.stringify(JSON.parse(ed.textContent), null, 2); if (jar) jar.updateCode(f); else ed.textContent = f; out.textContent = 'Formatted JSON ✓'; }
        catch (err) { out.style.color = 'var(--bad)'; out.textContent = 'Not valid JSON: ' + err.message; }
      };
      b.querySelector('#mp-cp').onclick = () => A.copy(ed.textContent);
    }

    q('#mtabs').onclick = e => { const btn = e.target.closest('[data-t]'); if (btn) { tab = btn.dataset.t; draw(); } };
    draw();
  }

  A.micro = { qrSvg, sanitize, diffHtml, renderNomnoml, highlightCode, detectLang, readArticle, render };
})();

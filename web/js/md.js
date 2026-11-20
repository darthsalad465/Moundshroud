// Small, safe markdown renderer enhanced with Temml (native MathML LaTeX) and Prism (syntax highlighting).
function mdMath(src, display) {
  if (typeof window !== 'undefined' && window.temml && typeof window.temml.renderToString === 'function') {
    try { return window.temml.renderToString(src.trim(), { displayMode: !!display, throwOnError: false }); } catch (e) { }
  }
  return '<code>' + esc(src) + '</code>';
}
function mdInline(s) {
  const math = [];
  let work = String(s || '');
  if (typeof window !== 'undefined' && window.temml) {
    work = work.replace(/\$\$([^$\n]+?)\$\$/g, (_, m) => '@@MDM' + (math.push(mdMath(m, true)) - 1) + '@@');
    work = work.replace(/(^|[^\\$])\$([^\s$`][^$\n]*?[^\s$`]|[^\s$`])\$/g, (all, pre, m) => /\d/.test(m[0]) && !/[\\^_{}=+\-*/a-z]/i.test(m) ? all : pre + '@@MDM' + (math.push(mdMath(m, false)) - 1) + '@@');
  }
  let out = esc(work).replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>').replace(/(^|[\s(])\*([^*\n]+)\*(?=[\s).,!?]|$)/g, '$1<i>$2</i>');
  if (math.length) out = out.replace(/@@MDM(\d+)@@/g, (_, i) => math[+i]);
  return out;
}
function mdCodeHtml(src, lang) {
  if (typeof window !== 'undefined' && window.Prism && window.Prism.languages) {
    const map = { js: 'javascript', jsx: 'javascript', ts: 'javascript', json: 'javascript', html: 'markup', xml: 'markup', svg: 'markup', css: 'css', c: 'clike', cpp: 'clike', java: 'clike', cs: 'clike' };
    const key = map[lang] || lang;
    const gr = key && window.Prism.languages[key];
    if (gr) { try { return window.Prism.highlight(src, gr, key); } catch (e) { } }
  }
  return esc(src);
}
function md(t) {
  const parts = t.split(/```/); let out = '';
  parts.forEach((p, i) => {
    if (i % 2) { const nl = p.indexOf('\n'), hasLang = nl >= 0 && /^[\w+#.-]*$/.test(p.slice(0, nl).trim()), code = hasLang ? p.slice(nl + 1) : p, lang = hasLang ? p.slice(0, nl).trim().toLowerCase() : ''; const src = code.replace(/\n$/, ''), n = src.split('\n').length; let ns = ''; for (let k = 1; k <= n; k++) ns += k + (k < n ? '\n' : '');
      /* the line numbers are drawn with the code: added afterwards, the code jumped sideways on every repaint while a reply streamed in */
      out += '<pre class="cv-n"' + (lang ? ' data-lang="' + esc(lang) + '"' : '') + '><span class="cv-g" aria-hidden="true" data-n="' + n + '">' + ns + '</span><button class="cp">Copy</button><code>' + mdCodeHtml(src, lang) + '</code></pre>'; return; }      /* data-lang: the chat's code interpreter adds ▶ Run to Python and JavaScript blocks */
    const lines = p.split('\n'); let list = null, html = '';
    const close = () => { if (list) { html += '</' + list + '>'; list = null; } };
    for (let li = 0; li < lines.length; li++) {
      const ln = lines[li];
      let m;
      if (ln.trim() === '$$' && typeof window !== 'undefined' && window.temml) {
        let end = -1; for (let j = li + 1; j < lines.length; j++) if (lines[j].trim() === '$$') { end = j; break; }
        if (end > li) { close(); html += '<div class="md-math" style="margin:8px 0;overflow-x:auto">' + mdMath(lines.slice(li + 1, end).join('\n'), true) + '</div>'; li = end; continue; }
      }
      if (m = ln.match(/^\s*[-*]\s+(.*)/)) { if (list !== 'ul') { close(); html += '<ul>'; list = 'ul'; } html += '<li>' + mdInline(m[1]) + '</li>'; }
      else if (m = ln.match(/^\s*\d+[.)]\s+(.*)/)) { if (list !== 'ol') { close(); html += '<ol>'; list = 'ol'; } html += '<li>' + mdInline(m[1]) + '</li>'; }
      else if (m = ln.match(/^#{1,3}\s+(.*)/)) { close(); html += '<h3>' + mdInline(m[1]) + '</h3>'; }
      else if (ln.trim() === '') close();
      else { close(); html += '<p>' + mdInline(ln) + '</p>'; }
    }
    close(); out += html;
  });
  return out;
}

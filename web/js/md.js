// Small, safe markdown renderer (no outside libraries).
function mdInline(s) {
  return esc(s).replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>').replace(/(^|[\s(])\*([^*\n]+)\*(?=[\s).,!?]|$)/g, '$1<i>$2</i>');
}
function md(t) {
  const parts = t.split(/```/); let out = '';
  parts.forEach((p, i) => {
    if (i % 2) { const nl = p.indexOf('\n'), hasLang = nl >= 0 && /^[\w+#.-]*$/.test(p.slice(0, nl).trim()), code = hasLang ? p.slice(nl + 1) : p, lang = hasLang ? p.slice(0, nl).trim().toLowerCase() : ''; out += '<pre' + (lang ? ' data-lang="' + esc(lang) + '"' : '') + '><button class="cp">Copy</button><code>' + esc(code.replace(/\n$/, '')) + '</code></pre>'; return; }      /* data-lang: the chat's code interpreter adds ▶ Run to Python and JavaScript blocks */
    const lines = p.split('\n'); let list = null, html = '';
    const close = () => { if (list) { html += '</' + list + '>'; list = null; } };
    for (const ln of lines) {
      let m;
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

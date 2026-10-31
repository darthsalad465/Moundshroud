// Source viewer: opens a cited PDF right at the cited page (inside Moundshroud) with the passage shown above it.
(() => {
  const el = document.createElement('div'); el.id = 'sv';
  el.innerHTML = '<div class="svh"><b id="svt" style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"></b><button class="ib" id="svo">Open in default app</button><button class="ib" id="svx">Close (Esc)</button></div><div class="svp" id="svp"></div><iframe id="svf" title="Source"></iframe>';
  document.body.appendChild(el);
  let cur = null;
  const close = () => { el.classList.remove('on'); $('svf').src = 'about:blank'; cur = null; };
  $('svx').onclick = close; $('svo').onclick = () => { if (cur) A.api('/api/docs/open', { path: cur.path }); };
  const mark = (t, q) => { t = esc(t); (q || '').toLowerCase().match(/[\p{L}\p{N}]{4,}/gu)?.slice(0, 8).forEach(w => { t = t.replace(new RegExp('(' + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi'), '<mark>$1</mark>'); }); return t; };
  A.viewer = {
    get on() { return el.classList.contains('on'); }, close,
    open(src, question) {
      cur = src; const isPdf = /\.pdf$/i.test(src.path || ''), page = src.page || 1;
      $('svt').textContent = (src.title || 'Source') + (src.page ? '  -  page ' + src.page : '');
      $('svp').innerHTML = src.text ? '<div class="small mute" style="margin-bottom:3px">Passage Moundshroud used:</div>' + mark(src.text.slice(0, 900), question) : '';
      $('svf').style.display = isPdf || /\.(png|jpe?g|txt|md|html?)$/i.test(src.path || '') ? 'block' : 'none';
      $('svf').src = isPdf ? '/api/file?path=' + encodeURIComponent(src.path) + '#page=' + page : (/\.(png|jpe?g|txt|md|html?)$/i.test(src.path || '') ? '/api/file?path=' + encodeURIComponent(src.path) : 'about:blank');
      el.classList.add('on');
    }
  };
})();

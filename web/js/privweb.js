// Private web pane: sits beside the offline Browser. Searches DuckDuckGo and reads pages as clean text and pictures,
// all fetched by Moundshroud's server (no scripts, cookies, trackers or referrers reach the sites). Links open here too.
(() => {
  const esc = t => String(t == null ? '' : t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  if (!document.getElementById('pw-css')) { const s = document.createElement('style'); s.id = 'pw-css'; s.textContent = `
.pw{flex:1 1 50%;min-width:0;display:flex;flex-direction:column;border-left:1px solid var(--line);background:var(--panel)}
.pw-bar{display:flex;gap:6px;align-items:center;padding:8px 10px;border-bottom:1px solid var(--line);flex-wrap:wrap}
.pw-bar input{flex:1;min-width:140px;padding:7px 10px;border:1px solid var(--line);border-radius:9px;background:var(--panel2);color:var(--text)}
.pw .ib2{padding:5px 9px;border:1px solid var(--line);border-radius:8px;background:var(--panel2);color:var(--text);cursor:pointer;font-size:12.5px}.pw .ib2:hover{border-color:var(--acc)}.pw .ib2:disabled{opacity:.4}
.pw-shield{font-size:11.5px;color:var(--ok,#30a46c);padding:4px 10px;border-bottom:1px solid var(--line)}
.pw-body{flex:1;min-height:0;overflow:auto;padding:14px 18px}
.pw-res{padding:9px 0;border-bottom:1px solid var(--line);cursor:pointer}.pw-res b{color:var(--acc)}.pw-res:hover b{text-decoration:underline}.pw-res .u{font-size:11.5px;color:var(--ok,#30a46c);word-break:break-all}
.pw-art{font:15px/1.65 Georgia,serif;max-width:760px}.pw-art h1,.pw-art h2,.pw-art h3{font-family:inherit;line-height:1.25}.pw-art img{max-width:100%;border-radius:8px;margin:6px 0}
.pw-art a{color:var(--acc);cursor:pointer}.pw-art pre{background:var(--panel2);padding:10px;border-radius:8px;overflow:auto;font-size:12.5px}
.pw-art table{border-collapse:collapse;font-size:13px;margin:8px 0}.pw-art td{border:1px solid var(--line);padding:3px 6px}
.pw .mute{color:var(--mute);font-size:12.5px}`; document.head.appendChild(s); }

  /* small markdown renderer for reader pages: headings, lists, code, tables, links, pictures, bold, italics */
  function inline(t) {
    let s = esc(t);
    s = s.replace(/!\[([^\]]*)\]\((\/api\/privweb\/img\?u=[^)\s]+)\)/g, (m, a, u) => '<img src="' + u + '" alt="' + a + '" loading="lazy">');
    s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, (m, a, u) => '<a data-pw="' + u + '" title="' + u + '">' + a + '</a>');
    s = s.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>').replace(/(^|\s)_([^_]+)_(?=\s|[.,;:!?)]|$)/g, '$1<i>$2</i>').replace(/`([^`]+)`/g, '<code>$1</code>');
    return s;
  }
  function render(md) {
    const L = String(md || '').split('\n'), out = []; let i = 0;
    while (i < L.length) {
      const l = L[i];
      if (/^```/.test(l)) { const buf = []; i++; while (i < L.length && !/^```/.test(L[i])) buf.push(L[i++]); i++; out.push('<pre>' + esc(buf.join('\n')) + '</pre>'); continue; }
      const h = /^(#{1,6})\s+(.*)$/.exec(l); if (h) { const n = Math.min(4, h[1].length + 1); out.push('<h' + n + '>' + inline(h[2]) + '</h' + n + '>'); i++; continue; }
      if (/^\s*- /.test(l)) { const it = []; while (i < L.length && /^\s*- /.test(L[i])) it.push('<li>' + inline(L[i++].replace(/^\s*- /, '')) + '</li>'); out.push('<ul>' + it.join('') + '</ul>'); continue; }
      if (/^\|.*\|\s*$/.test(l)) { const rows = []; while (i < L.length && /^\|.*\|\s*$/.test(L[i])) rows.push('<tr>' + L[i++].slice(1, -1).split(' | ').map(c => '<td>' + inline(c.trim()) + '</td>').join('') + '</tr>'); out.push('<table>' + rows.join('') + '</table>'); continue; }
      if (!l.trim()) { i++; continue; }
      const p = [L[i++]];   // always take this line, so a stray line like "| text" cannot stop the loop moving on
      while (i < L.length && L[i].trim() && !/^(#{1,6}\s|```|\s*- |\|)/.test(L[i])) p.push(L[i++]);
      out.push('<p>' + inline(p.join(' ')) + '</p>');
    }
    return out.join('');
  }

  function pane(host) {
    host.innerHTML = '<div class="pw-bar"><button class="ib2" id="pwback" title="Back" disabled>←</button><input id="pwq" placeholder="Search privately or paste a web address…" spellcheck="false"><button class="ib2" id="pwgo">Go</button><button class="ib2" id="pwai" title="Send this page to the AI" disabled>💬 To AI</button><button class="ib2" id="pwx" title="Close the private web">✕</button></div><div class="pw-shield" id="pwshield">🛡 Private: pages are fetched by Moundshroud. No scripts, cookies or trackers reach the sites.</div><div class="pw-body" id="pwbody"><div class="mute">Search the web with DuckDuckGo, or paste a link. Results open here as clean pages.</div></div>';
    const q = s => host.querySelector(s), body = q('#pwbody'), hist = []; let page = null;
    const push = st => { hist.push(st); q('#pwback').disabled = hist.length < 2; };
    const show = st => {
      page = st.page || null; q('#pwai').disabled = !page;
      if (st.kind === 'results') {
        q('#pwq').value = st.q; q('#pwshield').textContent = '🛡 Private search with DuckDuckGo. Results come back through Moundshroud; tracking tags are removed from links.';
        body.innerHTML = st.results.length ? st.results.map((r, i) => '<div class="pw-res" data-i="' + i + '"><b>' + esc(r.title) + '</b><div class="u">' + esc(r.url) + '</div><div class="mute">' + esc(r.snippet || '') + '</div></div>').join('') : '<div class="mute">No results.</div>';
        body.querySelectorAll('.pw-res').forEach(d => d.onclick = () => open(st.results[+d.dataset.i].url));
      } else {
        const r = st.page; q('#pwq').value = r.url;
        const rm = r.removed || {}; q('#pwshield').textContent = '🛡 Blocked ' + (rm.scripts || 0) + ' script' + (rm.scripts === 1 ? '' : 's') + ', ' + (rm.trackers || 0) + ' tracker' + (rm.trackers === 1 ? '' : 's') + ', ' + (rm.frames || 0) + ' embedded frame' + (rm.frames === 1 ? '' : 's') + ' and ' + (rm.cookies || 0) + ' cookie' + (rm.cookies === 1 ? '' : 's') + ' on this page.';
        body.innerHTML = '<div class="pw-art"><div class="mute" style="word-break:break-all">' + esc(r.url) + '</div><h1>' + esc(r.title) + '</h1>' + render(r.markdown) + (r.more ? '<p class="mute">(The page was very long; the rest is not shown.)</p>' : '') + '</div>';
        body.querySelectorAll('a[data-pw]').forEach(a => a.onclick = e => { e.preventDefault(); open(a.dataset.pw); });
      }
      body.scrollTop = 0;
    };
    const go = async v => {
      v = String(v || '').trim(); if (!v) return;
      if (/^(https?:\/\/)?[\w-]+(\.[\w-]+)+(\/\S*)?$/i.test(v) && !/\s/.test(v)) return open(/^https?:/i.test(v) ? v : 'https://' + v);
      body.innerHTML = '<div class="mute">Searching privately…</div>';
      const r = await A.api('/api/privweb/search', { q: v }).catch(e => ({ error: e.message }));
      if (r.error) { body.innerHTML = '<div class="mute">' + esc(r.error) + '</div>'; return; }
      const st = { kind: 'results', q: v, results: r.results || [] }; push(st); show(st);
    };
    const open = async u => {
      body.innerHTML = '<div class="mute">Opening privately…</div>';
      const r = await A.api('/api/privweb/read', { url: u }).catch(e => ({ error: e.message }));
      if (r.error) { body.innerHTML = '<div class="mute">' + esc(r.error) + '</div>'; return; }
      const st = { kind: 'page', page: r }; push(st); show(st);
    };
    q('#pwgo').onclick = () => go(q('#pwq').value);
    q('#pwq').onkeydown = e => { if (e.key === 'Enter') go(q('#pwq').value); };
    q('#pwback').onclick = () => { if (hist.length < 2) return; hist.pop(); q('#pwback').disabled = hist.length < 2; show(hist[hist.length - 1]); };
    q('#pwai').onclick = () => { if (!page) return; const text = page.markdown.replace(/!\[[^\]]*\]\([^)]*\)/g, '').replace(/\]\([^)]*\)/g, ']').slice(0, 12000); if (A.chat && A.chat.showSel) A.chat.showSel(text, 'Web page: ' + page.title); };
    return { go, close: () => q('#pwx').click(), x: q('#pwx') };
  }

  /* adds the Private web button to the Browser's top bar and splits the Browser in two when it is on */
  function attach(P) {
    const top = P.querySelector('.ws-top'), wrap = P.querySelector('#wswrap'); if (!top || !wrap || P.querySelector('#pwtog')) return;
    const btn = document.createElement('button'); btn.className = 'ib'; btn.id = 'pwtog'; btn.title = 'Open a private web pane beside the offline browser'; btn.textContent = '🛡 Private web';
    top.appendChild(btn);
    let el = null;
    const setOn = on => {
      try { ls.set('pw_on', on ? '1' : '0'); } catch (e) { }
      btn.classList.toggle('on', on);
      if (on && !el) {
        P.style.display = 'flex'; P.style.flexDirection = 'row'; wrap.style.flex = '1 1 50%'; wrap.style.minWidth = '0';
        el = document.createElement('div'); el.className = 'pw'; P.appendChild(el);
        const pn = pane(el); pn.x.onclick = () => setOn(false); setTimeout(() => el && el.querySelector('#pwq').focus(), 50);
      } else if (!on && el) { el.remove(); el = null; P.style.flexDirection = ''; wrap.style.flex = ''; wrap.style.minWidth = ''; }
    };
    btn.onclick = () => setOn(!el);
    try { if (ls.get('pw_on', '0') === '1') setOn(true); } catch (e) { }
  }
  A.privweb = { attach, render };
})();

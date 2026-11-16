// Tools > API Explorer: browse the public-apis list (pulled from GitHub by Tools > Repositories), read each API's
// docs inside Moundshroud, and send test requests to see live data. Needs the internet switch for requests.
(() => {
  const esc = t => String(t == null ? '' : t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  if (!document.getElementById('apx-css')) { const s = document.createElement('style'); s.id = 'apx-css'; s.textContent = `
.apx{flex:1;min-height:0;overflow:auto;padding:16px}.apx-wrap{max-width:1000px;margin:0 auto}
.apx-card{border:1px solid var(--line);border-radius:14px;background:var(--panel);padding:14px;margin-bottom:12px}
.apx input,.apx select{box-sizing:border-box;padding:8px 10px;border:1px solid var(--line);border-radius:8px;background:var(--panel2);color:var(--text);font:13px/1.4 inherit}
.apx .btn{padding:8px 14px;border:0;border-radius:9px;font-weight:700;color:#fff;cursor:pointer;background:linear-gradient(135deg,var(--acc,#7c5cff),var(--acc2,#22d3ee))}.apx .btn:disabled{opacity:.5}
.apx .ib2{padding:5px 10px;border:1px solid var(--line);border-radius:7px;background:var(--panel2);color:var(--text);cursor:pointer;font-size:12px}.apx .ib2:hover{border-color:var(--acc)}
.apx .mute{color:var(--mute);font-size:12.5px;line-height:1.5}
.apx-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(270px,1fr));gap:8px}
.apx-api{border:1px solid var(--line);border-radius:11px;padding:10px;background:var(--panel2);display:flex;flex-direction:column;gap:5px}
.apx-tag{font-size:10.5px;padding:1px 7px;border-radius:99px;border:1px solid var(--line);color:var(--mute)}.apx-tag.free{color:var(--ok,#30a46c);border-color:color-mix(in srgb,var(--ok,#30a46c) 50%,var(--line))}
.apx pre{background:#0b0e14;color:#cdd3e0;border-radius:10px;padding:10px;font-size:12px;max-height:380px;overflow:auto;white-space:pre-wrap;word-break:break-word;margin:8px 0 0}`; document.head.appendChild(s); }

  let poll = 0;
  async function render(el) {
    clearInterval(poll);
    const L = await A.api('/api/apis/list').catch(() => null);
    if (!L) { el.innerHTML = '<div class="apx"><div class="apx-wrap mute">Could not reach Moundshroud’s server.</div></div>'; return; }
    el.innerHTML = '<div class="apx"><div class="apx-wrap"><div class="apx-card"><h2 style="margin:0 0 4px">🌐 API Explorer</h2><div class="mute">' +
      (L.installed ? L.count.toLocaleString() + ' free web APIs from the <b>public-apis</b> list on GitHub, in ' + L.categories.length + ' categories. Read the docs, then try one below.' : 'Free web APIs from the <b>public-apis</b> list on GitHub (about 1,400 of them).') +
      (L.internet ? '' : ' <span style="color:var(--warn,#f5a524)">Internet access is off, so pulling and trying need it switched on in Settings › AI & power.</span>') + '</div>' +
      '<div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap;align-items:center">' + (L.installed ? '<button class="ib2" id="apxupd">↻ Update the list</button>' : '<button class="btn" id="apxpull">⬇ Pull the list from GitHub</button>') + '<button class="ib2" id="apxrepos">📦 Open Repositories (pull any other repo)</button><span class="mute" id="apxst"></span></div></div>' +
      '<div class="apx-card"><b>Try an API</b><div class="mute">Paste an endpoint from an API’s docs, or start with one of these. Only GET requests to public addresses; your own network is never touched.</div>' +
      '<div style="display:flex;gap:6px;flex-wrap:wrap;margin:8px 0">' + L.examples.map((x, i) => '<button class="ib2 apxex" data-i="' + i + '">' + esc(x.name) + '</button>').join('') + '</div>' +
      '<div style="display:flex;gap:6px"><input id="apxurl" style="flex:1" placeholder="https://..." spellcheck="false"><button class="btn" id="apxgo">Send</button></div><div id="apxout"></div></div>' +
      (L.installed ? '<div class="apx-card"><div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center"><input id="apxq" placeholder="Search APIs…" style="flex:1;min-width:180px"><select id="apxcat"><option value="">All categories</option>' + L.categories.map(c => '<option>' + esc(c) + '</option>').join('') + '</select><label class="mute"><input type="checkbox" id="apxfree" checked> No key needed</label><label class="mute"><input type="checkbox" id="apxhttps" checked> HTTPS</label></div><div class="mute" id="apxn" style="margin:8px 0"></div><div class="apx-grid" id="apxlist"></div></div>' : '') +
      '</div></div>';
    const q = s => el.querySelector(s), st = q('#apxst');
    const watchJob = () => { clearInterval(poll); poll = setInterval(async () => { const r = await A.api('/api/refs').catch(() => null); const me = r && r.refs.find(x => x.slug === 'public-apis'); if (!me) return; st.textContent = me.job ? me.job.said || '' : ''; if (!me.job || me.job.state === 'done' || me.job.state === 'failed') { clearInterval(poll); if (me.job && me.job.state === 'failed') A.toast(me.job.said || 'Could not pull it.'); else render(el); } }, 1500); };
    if (q('#apxpull')) q('#apxpull').onclick = async () => { const r = await A.api('/api/refs/install', { slug: 'public-apis' }); if (r.error) return A.toast(r.error); st.textContent = 'Pulling from GitHub…'; watchJob(); };
    if (q('#apxupd')) q('#apxupd').onclick = async () => { const r = await A.api('/api/refs/update', { slug: 'public-apis' }); if (r.error) return A.toast(r.error); st.textContent = 'Checking for changes…'; watchJob(); };
    q('#apxrepos').onclick = () => A.tools.go('repos');
    const send = async () => {
      const u = q('#apxurl').value.trim(); if (!u) return; const out = q('#apxout'); out.innerHTML = '<div class="mute" style="margin-top:8px">Sending…</div>';
      const r = await A.api('/api/apis/call', { url: u }).catch(e => ({ error: e.message }));
      out.innerHTML = r.error ? '<div style="color:var(--bad,#e5484d);margin-top:8px">' + esc(r.error) + '</div>' : '<div class="mute" style="margin-top:8px">Status ' + r.status + ' · ' + esc(r.type.split(';')[0]) + ' · ' + r.ms + ' ms' + (r.cut ? ' · cut at 2 MB' : '') + '</div><pre>' + esc(r.body) + '</pre>';
    };
    q('#apxgo').onclick = send; q('#apxurl').onkeydown = e => { if (e.key === 'Enter') send(); };
    el.querySelectorAll('.apxex').forEach(b => b.onclick = () => { q('#apxurl').value = L.examples[+b.dataset.i].url; send(); });
    if (!L.installed) return;
    const draw = () => {
      const t = q('#apxq').value.trim().toLowerCase(), c = q('#apxcat').value, free = q('#apxfree').checked, hs = q('#apxhttps').checked;
      const hits = L.apis.filter(a => (!c || a.category === c) && (!free || !a.auth) && (!hs || a.https) && (!t || (a.name + ' ' + a.desc + ' ' + a.category).toLowerCase().includes(t)));
      q('#apxn').textContent = hits.length.toLocaleString() + ' match' + (hits.length === 1 ? '' : 'es') + (hits.length > 300 ? ', showing the first 300' : '');
      q('#apxlist').innerHTML = hits.slice(0, 300).map((a, i) => '<div class="apx-api"><b>' + esc(a.name) + '</b><div class="mute">' + esc(a.desc) + '</div><div style="display:flex;gap:5px;flex-wrap:wrap"><span class="apx-tag">' + esc(a.category) + '</span><span class="apx-tag' + (a.auth ? '' : ' free') + '">' + (a.auth ? 'needs ' + esc(a.auth) : 'no key') + '</span></div><div><button class="ib2 apxdoc" data-u="' + esc(a.url) + '" data-n="' + esc(a.name) + '">📖 Docs</button></div></div>').join('');
      q('#apxlist').querySelectorAll('.apxdoc').forEach(b => b.onclick = () => { if (A.lib && A.lib.openUrl) A.lib.openUrl(b.dataset.u, b.dataset.n); else A.toast('The in-app reader is not loaded.'); });
    };
    ['#apxq', '#apxcat', '#apxfree', '#apxhttps'].forEach(s => q(s).addEventListener('input', draw)); q('#apxcat').onchange = draw; draw();
  }
  A.apiExplorer = { render };
})();

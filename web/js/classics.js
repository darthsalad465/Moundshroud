// Classics shelf: browse, search and open every book in every installed Project Gutenberg collection (literature and the other subjects), with covers. Lives inside the Library tab.
(() => {
  const root = $('p-lib'); let data = null, loading = null, built = false, list = [], shown = 0, mode = 'books';
  const st = { q: '', sort: ls.get('clssort', 'pop'), shelf: '', author: '', fav: false, recent: false };
  const favs = () => { try { return new Set(JSON.parse(ls.get('clsfav', '[]'))); } catch (e) { return new Set(); } };
  const recents = () => { try { return JSON.parse(ls.get('clsrecent', '[]')); } catch (e) { return []; } };
  const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const enc = encodeURIComponent, PAGE = 60;
  const surname = a => { const w = String(a).replace(/\([^)]*\)/g, '').trim().split(/\s+/); return w[w.length - 1] || a; };
  const url = it => '/wiki/content/' + it.b + '/' + enc(it.t.replace('/', '-').substring(0, 230)) + '.' + it.id;
  const cover = it => '/wiki/content/' + it.b + '/covers/' + it.id + '_cover_image.jpg';

  function build() {
    if (built) return; built = true;
    const ov = document.createElement('div'); ov.id = 'cls'; ov.style.cssText = 'position:absolute;left:0;right:0;top:var(--lhh,92px);bottom:0;z-index:6;background:var(--bg);display:none;flex-direction:column';
    ov.innerHTML = '<style>#cls .cc{background:var(--panel);border:1px solid var(--line);border-radius:12px;overflow:hidden;cursor:pointer;position:relative;display:flex;flex-direction:column;transition:transform .12s,border-color .12s}#cls .cc:hover{transform:translateY(-3px);border-color:var(--acc)}#cls .cv{aspect-ratio:2/3;background:var(--panel2);display:flex;align-items:center;justify-content:center;overflow:hidden}#cls .cv img{width:100%;height:100%;object-fit:cover;display:block}#cls .ph{width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:10px;text-align:center;font:600 13px/1.3 Georgia,serif;color:#fff}#cls .ct{padding:7px 9px 9px}#cls .ct b{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;font-size:13px;line-height:1.3}#cls .ct span{display:block;font-size:12px;color:var(--mute);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}#cls .st{position:absolute;top:6px;right:6px;border:0;border-radius:50%;width:28px;height:28px;background:rgba(0,0,0,.55);color:#fff;font-size:15px;line-height:1;cursor:pointer}#cls .st.on{color:#ffd24a}#cls .az{display:flex;flex-wrap:wrap;gap:2px}#cls .az b{cursor:pointer;font-size:12px;padding:1px 6px;border-radius:6px;color:var(--mute)}#cls .az b:hover{background:var(--acc);color:var(--onacc)}#cls .rowitem{display:flex;gap:10px;padding:8px 10px;border-bottom:1px solid var(--line);cursor:pointer;align-items:center}#cls .rowitem:hover{background:var(--panel2)}</style>' +
      '<div style="padding:10px 14px;border-bottom:1px solid var(--line);flex:none"><div class="row" style="gap:8px;flex-wrap:wrap"><b style="font-size:16px">📖 Classics</b><span class="small mute" id="clsn"></span><span class="sp"></span><button class="ib" id="clsx">Close</button></div>' +
      '<div class="row" style="gap:8px;margin-top:8px;flex-wrap:wrap"><input id="clsq" type="text" placeholder="Search by title or author... (try Dostoevsky, Odyssey, ghost stories)" style="flex:1;min-width:220px"><select id="clss"><option value="pop">Most popular</option><option value="title">Title A-Z</option><option value="author">Author A-Z</option></select><select id="clsm"><option value="books">Books</option><option value="authors">Authors</option></select></div>' +
      '<div class="chips" id="clsc" style="margin-top:8px"></div><div class="az" id="clsaz" style="margin-top:6px"></div></div><div class="scroll" id="clsb" style="flex:1;padding:12px 14px"></div>';
    root.appendChild(ov);
    const q = $('clsq'); let t = null; q.value = st.q; $('clss').value = st.sort;
    q.oninput = () => { clearTimeout(t); t = setTimeout(() => { st.q = q.value; mode = 'books'; $('clsm').value = 'books'; refresh(); }, 120); };
    $('clss').onchange = () => { st.sort = $('clss').value; ls.set('clssort', st.sort); refresh(); };
    $('clsm').onchange = () => { mode = $('clsm').value; refresh(); };
    $('clsx').onclick = close;
    $('clsc').onclick = e => {
      const c = e.target.closest('[data-k]'); if (!c) return; const k = c.dataset.k, v = c.dataset.v || '';
      if (k === 'shelf') { st.shelf = st.shelf === v ? '' : v; } else if (k === 'fav') { st.fav = !st.fav; st.recent = false; } else if (k === 'recent') { st.recent = !st.recent; st.fav = false; } else if (k === 'author') { st.author = ''; } else if (k === 'all') { st.shelf = ''; st.fav = false; st.recent = false; st.author = ''; st.q = ''; q.value = ''; mode = 'books'; $('clsm').value = 'books'; }
      refresh();
    };
    $('clsaz').onclick = e => { const b = e.target.closest('b'); if (b) jump(b.textContent); };
    const body = $('clsb');
    body.addEventListener('scroll', () => { if (body.scrollTop + body.clientHeight > body.scrollHeight - 600) more(); });
    body.addEventListener('error', e => { const im = e.target; if (im.tagName !== 'IMG' || im.dataset.f) return; im.dataset.f = 1; const cv = im.parentNode, it = data.items[+im.closest('.cc').dataset.i]; cv.innerHTML = '<div class="ph" style="background:hsl(' + hue(it.t) + ',38%,32%)"><span style="font-size:22px">📕</span>' + esc(it.t.slice(0, 60)) + '</div>'; }, true);
    body.onclick = e => {
      const s = e.target.closest('.st'); if (s) { e.stopPropagation(); const id = +s.dataset.id, f = favs(); f.has(id) ? f.delete(id) : f.add(id); ls.set('clsfav', JSON.stringify([...f])); s.classList.toggle('on', f.has(id)); s.textContent = f.has(id) ? '★' : '☆'; if (st.fav) refresh(); else chips(); return; }
      const au = e.target.closest('[data-au]'); if (au) { st.author = au.dataset.au; mode = 'books'; $('clsm').value = 'books'; refresh(); return; }
      const c = e.target.closest('.cc, .rowitem'); if (c && c.dataset.i !== undefined) openBook(data.items[+c.dataset.i]);
    };
  }
  /* typo-tolerant match so "Dostoevsky", "Tolstoi" or "Shakespear" still find the right shelf (distance 1-2, stops early) */
  function lev(a, b) {
    if (Math.abs(a.length - b.length) > 2) return 9; let p = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) { const c = [i]; let min = i; for (let j = 1; j <= b.length; j++) { const v = Math.min(p[j] + 1, c[j - 1] + 1, p[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); c[j] = v; if (v < min) min = v; } if (min > 2) return 9; p = c; }
    return p[b.length];
  }
  const hue = s => { let h = 0; for (const ch of String(s)) h = (h * 31 + ch.charCodeAt(0)) % 360; return h; };

  async function load() {
    if (data) return data; if (loading) return loading;
    loading = (async () => { try { data = await A.api('/api/lib/classics'); } catch (e) { data = { items: [], shelves: [] }; } data.items = data.items || []; data.items.forEach((it, i) => { it._i = i; it.k = norm(it.t + ' ' + it.a); it.tk = norm(it.t).replace(/^(the|a|an)\s+/, ''); it.sn = norm(surname(it.a)); }); loading = null; return data; })();
    return loading;
  }
  function filter() {
    let a = data.items; const f = favs(), rc = recents();
    if (st.shelf) a = a.filter(x => x.s === st.shelf); if (st.author) a = a.filter(x => x.a === st.author); if (st.fav) a = a.filter(x => f.has(x.id)); if (st.recent) a = rc.map(id => data.items.find(x => x.id === id)).filter(Boolean);
    const words = norm(st.q).split(/\s+/).filter(Boolean);
    if (words.length) {
      const exact = a.filter(x => words.every(w => x.k.includes(w)));
      if (words.some(w => w.length >= 5)) { const have = new Set(exact), near = a.filter(x => !have.has(x) && words.every(w => x.k.includes(w) || (w.length >= 4 && (x.tok || (x.tok = x.k.split(/[^a-z0-9]+/))).some(t => lev(w, t) <= (w.length >= 7 ? 2 : 1))))); a = exact.concat(near); } else a = exact; var exs = new Set(exact); const nq = norm(st.q).trim(); a = a.map(x => [x, (exs.has(x) ? 0 : 10) + (x.tk === nq ? 0 : x.tk.startsWith(nq) ? 1 : x.k.startsWith(nq) ? 2 : x.sn === nq ? 2 : 3)]).sort((p, q) => p[1] - q[1] || p[0].r - q[0].r).map(p => p[0]); }
    else if (!st.recent) { a = a.slice(); if (st.sort === 'pop') a.sort((x, y) => x.r - y.r || x.tk.localeCompare(y.tk)); else if (st.sort === 'title') a.sort((x, y) => x.tk.localeCompare(y.tk)); else a.sort((x, y) => x.sn.localeCompare(y.sn) || x.tk.localeCompare(y.tk)); }
    return a;
  }
  function chips() {
    const sh = data.shelves || [], f = favs().size, rc = recents().length;
    $('clsc').innerHTML = '<span class="chip" data-k="all">All</span>' + sh.map(s => '<span class="chip' + (st.shelf === s.name ? ' on' : '') + '" data-k="shelf" data-v="' + esc(s.name) + '" style="' + (st.shelf === s.name ? 'background:var(--acc);color:var(--onacc);border-color:var(--acc)' : '') + '">' + esc(s.name) + ' <span class="mute">' + s.n + '</span></span>').join('') +
      '<span class="chip" data-k="fav" style="' + (st.fav ? 'background:var(--acc);color:var(--onacc)' : '') + '">★ My shelf ' + f + '</span><span class="chip" data-k="recent" style="' + (st.recent ? 'background:var(--acc);color:var(--onacc)' : '') + '">🕘 Recently opened ' + rc + '</span>' + (st.author ? '<span class="chip" data-k="author" style="background:var(--acc);color:var(--onacc)">Author: ' + esc(st.author) + ' ✕</span>' : '');
  }
  function azbar() {
    const sorted = mode === 'authors' || st.sort !== 'pop', show = sorted && !st.q && !st.recent;
    $('clsaz').style.display = show ? 'flex' : 'none'; if (show) $('clsaz').innerHTML = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map(l => '<b>' + l + '</b>').join('') + '<b>#</b>';
  }
  const keyOf = it => mode === 'authors' ? it.sn : st.sort === 'author' ? it.sn : it.tk;
  function card(it) {
    const f = favs().has(it.id);
    return '<div class="cc" data-i="' + it._i + '" title="' + esc(it.t + ' - ' + it.a) + '"><div class="cv"><img loading="lazy" src="' + cover(it) + '" alt=""></div><button class="st' + (f ? ' on' : '') + '" data-id="' + it.id + '" title="Add to My shelf">' + (f ? '★' : '☆') + '</button><div class="ct"><b>' + esc(it.t) + '</b><span>' + esc(it.a) + '</span></div></div>';
  }
  function row(a) { return '<div class="rowitem" data-au="' + esc(a[0]) + '"><b style="flex:1">' + esc(a[0]) + '</b><span class="small mute">' + a[1] + ' book' + (a[1] > 1 ? 's' : '') + '</span></div>'; }
  let authors = [];
  function refresh() {
    chips(); azbar(); const b = $('clsb'); b.scrollTop = 0;
    if (!data.items.length) { b.innerHTML = '<div style="max-width:520px;margin:40px auto;text-align:center"><div style="font-size:42px">📚</div><h3>No Gutenberg books here yet</h3><p class="mute">No Project Gutenberg collection is installed, or the library has not been restarted since they were added. Close and reopen Moundshroud, or get them from Prepare &rarr; Stock up &rarr; Classics.</p></div>'; $('clsn').textContent = ''; return; }
    if (mode === 'authors') {
      const m = {}; data.items.forEach(x => { if (!st.shelf || x.s === st.shelf) m[x.a] = (m[x.a] || 0) + 1; }); const w = norm(st.q);
      authors = Object.entries(m).filter(x => !w || norm(x[0]).includes(w)).sort((p, q) => norm(surname(p[0])).localeCompare(norm(surname(q[0]))));
      list = authors; $('clsn').textContent = authors.length.toLocaleString() + ' authors'; b.innerHTML = '<div id="clsg"></div>'; shown = 0; more(); return;
    }
    list = filter(); $('clsn').textContent = list.length.toLocaleString() + ' of ' + data.items.length.toLocaleString() + ' books';
    if (!list.length) { b.innerHTML = '<p class="mute" style="text-align:center;margin-top:40px">Nothing matches' + (st.q ? ' "' + esc(st.q) + '"' : '') + '. Try fewer words, or just an author\'s surname.</p>'; return; }
    b.innerHTML = '<div id="clsg" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(132px,1fr));gap:12px"></div>'; shown = 0; more();
  }
  function more(upto) {
    const g = $('clsg'); if (!g) return; const end = Math.min(list.length, upto || shown + PAGE); if (end <= shown) return;
    const part = list.slice(shown, end); g.insertAdjacentHTML('beforeend', part.map(x => mode === 'authors' ? row(x) : card(x)).join('')); shown = end;
  }
  function jump(letter) {
    const sorted = mode === 'authors' ? list.map(a => norm(surname(a[0]))) : list.map(keyOf); let idx = sorted.findIndex(k => letter === '#' ? !/^[a-z]/.test(k) : k.startsWith(letter.toLowerCase()));
    if (idx < 0) return A.toast('Nothing under ' + letter); more(idx + PAGE); const g = $('clsg'), el = g && g.children[idx]; if (el) el.scrollIntoView({ block: 'start' });
  }
  function openBook(it) {
    if (!it) return; const r = recents().filter(x => x !== it.id); r.unshift(it.id); ls.set('clsrecent', JSON.stringify(r.slice(0, 40)));
    close(); A.library.read(url(it), it.t);
  }
  async function open() {
    A.showTab('lib'); build(); try { A.wikibooks && A.wikibooks.close(); } catch (e) { } const ov = $('cls'); ov.style.display = 'flex'; $('clsb').innerHTML = '<p class="mute" style="text-align:center;margin-top:40px">Loading the shelves...</p>';
    await load(); refresh(); setTimeout(() => $('clsq').focus(), 50);
  }
  function close() { const ov = $('cls'); if (ov) ov.style.display = 'none'; }
  A.classics = { open, close, isOpen: () => !!$('cls') && $('cls').style.display !== 'none', count: async () => (await load()).items.length };
})();

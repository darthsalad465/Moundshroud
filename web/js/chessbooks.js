// Chess books shelf inside the Library tab: public-domain chess books stored on this PC (nomad/chessbooks), with covers, search and filters.
(() => {
  const root = $('p-lib'); let data = null, built = false, list = [];
  const BASE = () => window.CHESSBOOKS_BASE || '/chessbooks/';
  const st = { q: '', level: '', topic: '', fav: false };
  const favs = () => { try { return new Set(JSON.parse(ls.get('cbfav', '[]'))); } catch (e) { return new Set(); } };
  const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const hue = s => { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) % 360; return h; };
  const LEVELS = ['Beginner', 'Intermediate', 'Advanced', 'All levels'];

  function build() {
    if (built) return; built = true;
    const ov = document.createElement('div'); ov.id = 'cbk'; ov.style.cssText = 'position:absolute;left:0;right:0;top:var(--lhh,92px);bottom:0;z-index:7;background:var(--bg);display:none;flex-direction:column';
    ov.innerHTML = '<style>#cbk .bk{background:var(--panel);border:1px solid var(--line);border-radius:12px;overflow:hidden;cursor:pointer;position:relative;display:flex;flex-direction:column;transition:transform .15s,border-color .15s,box-shadow .15s}#cbk .bk:hover{transform:translateY(-4px);border-color:var(--acc);box-shadow:0 10px 24px rgba(0,0,0,.35)}#cbk .cv{aspect-ratio:2/3;background:var(--panel2);display:flex;align-items:center;justify-content:center;overflow:hidden}#cbk .cv img{width:100%;height:100%;object-fit:cover;display:block}#cbk .ph{width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:12px;text-align:center;font:600 14px/1.3 Georgia,serif;color:#fff}#cbk .ct{padding:7px 9px 9px}#cbk .ct b{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;font-size:13px;line-height:1.3}#cbk .ct span{display:block;font-size:12px;color:var(--mute);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}#cbk .st{position:absolute;top:6px;right:6px;border:0;border-radius:50%;width:28px;height:28px;background:rgba(0,0,0,.55);color:#fff;font-size:15px;cursor:pointer}#cbk .st.on{color:#ffd24a}#cbk .lv{position:absolute;left:6px;top:6px;border-radius:8px;padding:1px 7px;font:600 10px Segoe UI;background:rgba(0,0,0,.6);color:#fff}</style>' +
      '<div style="padding:10px 14px;border-bottom:1px solid var(--line);flex:none"><div class="row" style="gap:8px;flex-wrap:wrap"><b style="font-size:16px">♟ Chess books</b><span class="small mute" id="cbn"></span><span class="sp"></span><button class="ib" id="cbx">Close</button></div>' +
      '<div class="row" style="gap:8px;margin-top:8px;flex-wrap:wrap"><input id="cbq" type="text" placeholder="Search by title, author or topic... (try Capablanca, openings, endgame)" style="flex:1;min-width:220px"></div><div class="chips" id="cbc" style="margin-top:8px"></div></div><div class="scroll" id="cbb" style="flex:1;padding:12px 14px"></div>';
    root.appendChild(ov);
    const q = $('cbq'); let t = null; q.oninput = () => { clearTimeout(t); t = setTimeout(() => { st.q = q.value; refresh(); }, 120); };
    $('cbx').onclick = close;
    $('cbc').onclick = e => { const c = e.target.closest('[data-k]'); if (!c) return; const k = c.dataset.k, v = c.dataset.v || ''; if (k === 'level') st.level = st.level === v ? '' : v; else if (k === 'topic') st.topic = st.topic === v ? '' : v; else if (k === 'fav') st.fav = !st.fav; else if (k === 'all') { st.level = st.topic = ''; st.fav = false; st.q = ''; q.value = ''; } refresh(); };
    $('cbb').addEventListener('error', e => { const im = e.target; if (im.tagName !== 'IMG' || im.dataset.f) return; im.dataset.f = 1; const b = data.books[+im.closest('.bk').dataset.i]; im.parentNode.innerHTML = '<div class="ph" style="background:hsl(' + hue(b.title) + ',38%,30%)"><span style="font-size:26px">♟</span>' + esc(b.title.slice(0, 60)) + '</div>'; }, true);
    $('cbb').onclick = e => {
      const s = e.target.closest('.st'); if (s) { e.stopPropagation(); const id = s.dataset.id, f = favs(); f.has(id) ? f.delete(id) : f.add(id); ls.set('cbfav', JSON.stringify([...f])); s.classList.toggle('on', f.has(id)); s.textContent = f.has(id) ? '★' : '☆'; if (st.fav) refresh(); else chips(); return; }
      const c = e.target.closest('.bk'); if (c) openBook(data.books[+c.dataset.i]);
    };
  }
  async function load() { if (data) return data; try { const r = await fetch(BASE() + 'index.json'); data = { books: r.ok ? await r.json() : [] }; } catch (e) { data = { books: [] }; } data.books.forEach(b => { b.k = norm([b.title, b.author, b.topic, b.level, b.desc, b.year].join(' ')); }); return data; }
  function filter() { const f = favs(), w = norm(st.q).split(/\s+/).filter(Boolean); return data.books.filter(b => (!st.level || b.level === st.level) && (!st.topic || b.topic === st.topic) && (!st.fav || f.has(b.id)) && w.every(x => b.k.includes(x))); }
  function chips() {
    const lv = LEVELS.filter(l => data.books.some(b => b.level === l)), tp = [...new Set(data.books.map(b => b.topic))].sort(), f = favs().size, on = 'background:var(--acc);color:var(--onacc);border-color:var(--acc)';
    $('cbc').innerHTML = '<span class="chip" data-k="all">All</span>' + lv.map(l => '<span class="chip" data-k="level" data-v="' + l + '" style="' + (st.level === l ? on : '') + '">' + l + '</span>').join('') + '<span class="mute small" style="align-self:center">|</span>' + tp.map(t => '<span class="chip" data-k="topic" data-v="' + esc(t) + '" style="' + (st.topic === t ? on : '') + '">' + esc(t) + '</span>').join('') + '<span class="chip" data-k="fav" style="' + (st.fav ? on : '') + '">★ My shelf ' + f + '</span>';
  }
function refresh() {
    chips(); const b = $('cbb'); b.scrollTop = 0;
    if (!data.books.length) { b.innerHTML = '<div style="max-width:520px;margin:40px auto;text-align:center"><div style="font-size:42px">♟</div><h3>No chess books installed yet</h3><p class="mute">The books live in the <b>nomad\\chessbooks</b> folder inside Moundshroud. If you just added them, close and reopen Moundshroud.</p></div>'; $('cbn').textContent = ''; return; }
    list = filter(); $('cbn').textContent = list.length + ' of ' + data.books.length + ' books · free public-domain texts, stored on this PC';
    if (!list.length) { b.innerHTML = '<p class="mute" style="text-align:center;margin-top:40px">Nothing matches. Try fewer words.</p>'; return; }
    b.innerHTML = '<div id="cbg" class="virtual-list" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:14px"></div>';
    const f = favs();
    A.virtualList(b, list, x => { const i = data.books.indexOf(x), fv = f.has(x.id); return '<div class="bk" data-i="' + i + '" title="' + A.esc(x.desc) + '"><div class="cv">' + (x.cover ? '<img loading="lazy" src="' + BASE() + x.id + '/' + x.cover + '" alt="">' : '<div class="ph" style="background:hsl(' + hue(x.title) + ',38%,30%)"><span style="font-size:26px">♟</span>' + A.esc(x.title.slice(0, 60)) + '</div>') + '</div><span class="lv">' + A.esc(x.level) + '</span><button class="st' + (fv ? ' on' : '') + '" data-id="' + x.id + '" title="Add to My shelf">' + (fv ? '★' : '☆') + '</button><div class="ct"><b>' + A.esc(x.title) + '</b><span>' + A.esc(x.author) + ' · ' + x.year + '</span></div></div>'; }, { itemHeight: 280 });
  }
  function openBook(b) { if (!b) return; close(); try { window.ChessAch && ChessAch.event('book', { id: b.id }); } catch (e) { } A.library.read(BASE() + b.id + '/' + b.file, b.title); }
  async function open() { A.showTab('lib'); build(); const ov = $('cbk'); ov.style.display = 'flex'; $('cbb').innerHTML = '<p class="mute" style="text-align:center;margin-top:40px">Loading the shelf...</p>'; await load(); refresh(); setTimeout(() => $('cbq').focus(), 50); }
  function close() { const ov = $('cbk'); if (ov) ov.style.display = 'none'; }
  A.chessbooks = { open, close, isOpen: () => !!$('cbk') && $('cbk').style.display !== 'none', count: async () => (await load()).books.length };
})();

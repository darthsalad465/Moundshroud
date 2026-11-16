// Wikibooks shelf: search the installed Wikibooks collection, see matching books (grouped from chapter hits) and open one in the Library reader. Lives inside the Library tab.
(() => {
  const root = $('p-lib'); if (!root) return;
  let built = false, token = 0;
  const SUBJ = [['Programming', 'programming'], ['Python', 'python'], ['Web', 'html css javascript'], ['Computing', 'computer'], ['Math', 'mathematics'], ['Physics', 'physics'], ['Chemistry', 'chemistry'], ['Biology', 'biology'], ['Cooking', 'cookbook'], ['Languages', 'language learning'], ['History', 'history'], ['Electronics', 'electronics'], ['Medicine', 'medicine'], ['Music', 'music'], ['Law', 'law'], ['Business', 'business']];
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const recents = () => { try { return JSON.parse(ls.get('wbkrecent', '[]')); } catch (e) { return []; } };
  function build() {
    if (built) return; built = true;
    const ov = document.createElement('div'); ov.id = 'wbk'; ov.style.cssText = 'position:absolute;left:0;right:0;top:var(--lhh,92px);bottom:0;z-index:6;background:var(--bg);display:none;flex-direction:column';
    ov.innerHTML = '<style>#wbk .wr{padding:10px 12px;border-bottom:1px solid var(--line);cursor:pointer;border-radius:8px}#wbk .wr:hover{background:var(--panel2)}#wbk .wr b{font-size:15px}#wbk .wr .sn{font-size:12px;color:var(--mute);margin-top:3px;line-height:1.4}</style>' +
      '<div style="padding:10px 14px;border-bottom:1px solid var(--line);flex:none"><div class="row" style="gap:8px;flex-wrap:wrap"><b style="font-size:16px">📘 Wikibooks</b><span class="small mute" id="wbkn"></span><span class="sp"></span><button class="ib" id="wbkx">Close</button></div>' +
      '<div class="row" style="gap:8px;margin-top:8px"><input id="wbkq" type="text" placeholder="Search free textbooks... (try python, algebra, cooking, spanish)" style="flex:1;min-width:200px"><button class="ib" id="wbkgo">Search</button></div><div class="chips" id="wbkc" style="margin-top:8px"></div></div><div class="scroll" id="wbkb" style="flex:1;padding:12px 14px"></div>';
    root.appendChild(ov);
    $('wbkc').innerHTML = SUBJ.map(s => '<span class="chip" data-q="' + s[1] + '">' + s[0] + '</span>').join('');
    $('wbkc').onclick = e => { const c = e.target.closest('[data-q]'); if (c) { $('wbkq').value = c.dataset.q; go(c.dataset.q); } };
    $('wbkq').onkeydown = e => { if (e.key === 'Enter') go($('wbkq').value); };
    $('wbkgo').onclick = () => go($('wbkq').value); $('wbkx').onclick = close;
    $('wbkb').onclick = e => { const r = e.target.closest('[data-u]'); if (!r) return; openBook(r.dataset.u, r.dataset.t); };
  }
  const row = b => '<div class="wr" data-u="' + esc(b.link) + '" data-t="' + esc(b.book) + '"><b>📘 ' + esc(b.book) + '</b>' + (b.hits ? ' <span class="small mute">' + (b.hits > 1 ? b.hits + ' matching pages' : '1 matching page') + '</span>' : '') + (b.chapters && b.chapters.length ? '<div class="sn">' + b.chapters.map(esc).join(' · ') + '</div>' : '') + (b.snippet ? '<div class="sn">' + esc(b.snippet) + '</div>' : '') + '</div>';
  function home() {
    const r = recents();
    $('wbkn').textContent = ''; $('wbkb').innerHTML = '<div style="max-width:640px;margin:20px auto"><h3 style="margin:0 0 6px">Free open textbooks</h3><div class="mute" style="line-height:1.55">Wikibooks holds thousands of community-written textbooks and manuals. Search above or pick a subject. A book opens in the reader, where you can bookmark it and ask the assistant about a page.</div>' + (r.length ? '<div class="small mute" style="margin:16px 0 6px">Recently opened</div>' + r.map(b => row({ link: b.u, book: b.t })).join('') : '') + '</div>';
  }
  async function go(q) {
    q = String(q || '').trim(); if (!q) return home(); const my = ++token, b = $('wbkb');
    b.innerHTML = '<p class="mute" style="text-align:center;margin-top:40px">Searching Wikibooks...</p>';
    let d; try { d = await A.api('/api/lib/wikibooks?q=' + encodeURIComponent(q)); } catch (e) { d = { error: String(e.message || e) }; }
    if (my !== token) return;
    if (d.installed === false) { b.innerHTML = '<div style="max-width:520px;margin:40px auto;text-align:center"><div style="font-size:42px">📘</div><h3>Wikibooks is not installed</h3><p class="mute">Get it from Prepare &rarr; Stock up &rarr; Wikibooks, then close and reopen Moundshroud.</p></div>'; $('wbkn').textContent = ''; return; }
    if (d.up === false || d.error) { b.innerHTML = '<p class="mute" style="text-align:center;margin-top:40px">The offline library is not running yet. Try again in a moment.</p>'; return; }
    const l = d.books || []; $('wbkn').textContent = l.length + ' book' + (l.length === 1 ? '' : 's');
    b.innerHTML = l.length ? l.map(row).join('') : '<p class="mute" style="text-align:center;margin-top:40px">No book matches "' + esc(q) + '". Try one or two simpler words.</p>';
    b.scrollTop = 0;
  }
  function openBook(u, t) { const r = [{ u, t }].concat(recents().filter(x => x.u !== u)).slice(0, 12); ls.set('wbkrecent', JSON.stringify(r)); close(); A.library.read(u, t); }
  function open(q) { A.showTab('lib'); build(); try { A.classics && A.classics.close(); } catch (e) { } $('wbk').style.display = 'flex'; if (q) { $('wbkq').value = q; go(q); } else if (!$('wbkq').value) home(); setTimeout(() => $('wbkq').focus(), 50); }
  function close() { const ov = $('wbk'); if (ov) ov.style.display = 'none'; }
  A.wikibooks = { open, close, isOpen: () => !!$('wbk') && $('wbk').style.display !== 'none' };
})();

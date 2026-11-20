// Studio > Albums: keep the pictures you make (pixel art, sketches, generative art, AI art) or upload in albums, like playlists for pictures.
// window.ArtAlbums.add(blob, { name, source, prompt }) asks which album to put a picture in (or makes a new one); the art tools call it from their "Add to album" buttons.
// Everything is stored in this browser's database on this PC (IndexedDB "moundshroud_albums"): albums {id,name,at,cover} and pics {id,album,name,source,prompt,at,blob}.
(() => {
  if (typeof A === 'undefined' || !A.studio) return;
  const esc = A.studio.esc, uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const DB = () => new Promise((ok, no) => { try { const r = indexedDB.open('moundshroud_albums', 1); r.onupgradeneeded = () => { const d = r.result; d.createObjectStore('albums', { keyPath: 'id' }); d.createObjectStore('pics', { keyPath: 'id' }); }; r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error); } catch (e) { no(e); } });
  const req = (store, mode, fn) => DB().then(db => new Promise((ok, no) => { const tx = db.transaction(store, mode), r = fn(tx.objectStore(store)); tx.oncomplete = () => ok(r && r.result); tx.onerror = () => no(tx.error); tx.onabort = () => no(tx.error); }));
  const all = s => req(s, 'readonly', o => o.getAll()).then(l => l || []), put = (s, rec) => req(s, 'readwrite', o => o.put(rec)), del = (s, id) => req(s, 'readwrite', o => o.delete(id));
  const mb = n => n < 1048576 ? Math.max(1, Math.round(n / 1024)) + ' KB' : (n / 1048576).toFixed(1) + ' MB';
  const when = t => new Date(t).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
  const dl = (blob, name) => { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 5000); };
  const fname = p => (p.name || 'picture').replace(/[^\w\- ]+/g, '').trim().slice(0, 40).replace(/\s+/g, '-') + '.' + ((p.blob && p.blob.type || '').includes('jpeg') ? 'jpg' : 'png');
  const newAlbum = async name => { const a = { id: uid(), name: String(name || 'New album').trim().slice(0, 40) || 'New album', at: Date.now(), cover: '' }; await put('albums', a); return a; };

  /* a small dialog that asks which album (or makes a new one); resolves to the album, or null when cancelled */
  function pick(exclude, title) {
    return new Promise(async res => {
      const list = (await all('albums')).filter(a => a.id !== exclude).sort((a, b) => b.at - a.at), counts = {}; (await all('pics')).forEach(p => { counts[p.album] = (counts[p.album] || 0) + 1; });
      A.dlg('<div class="hd"><b>' + esc(title || 'Add to which album?') + '</b></div><div class="bd" style="max-height:62vh;overflow:auto">' + (list.length ? list.map(a => '<button class="alpick" data-a="' + a.id + '" style="display:block;width:100%;text-align:left;margin:0 0 6px;padding:10px 12px;border-radius:10px;border:2px solid var(--line);background:var(--panel2);color:var(--text);cursor:pointer">📚 <b>' + esc(a.name) + '</b> <span class="small mute">' + (counts[a.id] || 0) + ' pictures</span></button>').join('') : '<div class="small mute" style="margin-bottom:8px">You have no albums yet. Make your first one:</div>') + '<div class="row" style="gap:6px;margin-top:8px"><input id="alnn" type="text" placeholder="New album name" maxlength="40" style="flex:1"><button class="pri" id="alnc">＋ Create</button></div><div class="row" style="margin-top:10px"><span class="sp"></span><button class="ib" id="alnx">Cancel</button></div></div>', true);
      let done = false; const fin = v => { if (done) return; done = true; A.closeDlg(); res(v); };
      document.getElementById('alnx').onclick = () => fin(null);
      document.querySelectorAll('.alpick').forEach(b => { b.onclick = () => fin(list.find(a => a.id === b.dataset.a)); });
      const mk = async () => { const n = document.getElementById('alnn').value.trim(); if (!n) { document.getElementById('alnn').focus(); return; } fin(await newAlbum(n)); };
      document.getElementById('alnc').onclick = mk; document.getElementById('alnn').onkeydown = e => { e.stopPropagation(); if (e.key === 'Enter') mk(); };
    });
  }
  async function add(blob, meta) {
    if (!blob) return false; meta = meta || {}; const a = await pick(); if (!a) return false;
    await put('pics', { id: uid(), album: a.id, name: String(meta.name || 'Picture').slice(0, 80), source: meta.source || '', prompt: meta.prompt || '', at: Date.now(), blob }); a.at = Date.now(); await put('albums', a);
    A.toast('Saved to the album "' + a.name + '"'); try { document.dispatchEvent(new Event('albumchange')); } catch (e) { } return true;
  }
  window.ArtAlbums = { add, pick, list: () => all('albums'), pics: () => all('pics') };

  A.studio.reg('albums', '📚 Albums', body => {
    const root = document.createElement('div'); root.className = 'scroll pad'; root.style.flex = '1'; body.appendChild(root);
    let urls = [], view = null, alive = true; const url = b => { const u = URL.createObjectURL(b); urls.push(u); return u; }, free = () => { urls.forEach(u => URL.revokeObjectURL(u)); urls = []; };
    const collections = A.collectionSelect;
    const selection = collections.bind(root, { delete: deletePictures, move: movePictures, download: downloadPictures });
    async function selectedPictures(id, ids) {
      const wanted = new Set(ids);
      return (await all('pics')).filter(p => p.album === id && wanted.has(p.id));
    }
    async function changePictures(id, ids, change) {
      const found = await selectedPictures(id, ids), byId = new Map(found.map(p => [p.id, p]));
      const done = await collections.each(ids, async key => {
        const p = byId.get(key);
        if (!p) return null;
        await change(p);
        return { ok: true };
      });
      const a = await req('albums', 'readonly', o => o.get(id));
      if (a && done.includes(a.cover)) await put('albums', { ...a, cover: '' });
      if (view === id) await album(id);
      return done;
    }
    async function deletePictures(ids) {
      const id = view;
      if (!(await A.confirm('Delete ' + ids.length + ' selected pictures from this album?', { title: 'Delete pictures', okLabel: 'Delete', danger: true }))) return;
      return changePictures(id, ids, p => del('pics', p.id));
    }
    async function movePictures(ids) {
      const id = view, to = await pick(id, 'Move to which album?');
      if (!to || id !== view) return;
      return changePictures(id, ids, p => put('pics', { ...p, album: to.id }));
    }
    async function downloadPictures(ids) {
      const pics = await selectedPictures(view, ids);
      if (pics.length > 8 && !(await A.confirm('Download ' + pics.length + ' pictures one after another?'))) return;
      pics.forEach((p, i) => setTimeout(() => dl(p.blob, fname(p)), i * 350));
      return pics.map(p => p.id);
    }
    async function renamePicture(p) {
      const name = (await A.prompt('Picture name', p.name, { title: 'Rename picture' }))?.trim();
      if (!name || name === p.name) return false;
      await put('pics', { ...p, name: name.slice(0, 80) });
      return true;
    }
    const cover = (a, ps) => { const mine = ps.filter(p => p.album === a.id).sort((x, y) => y.at - x.at); return mine.find(p => p.id === a.cover) || mine[0] || null; };

    async function home() {
      selection.reset();
      view = null; free(); const albums = (await all('albums')).sort((a, b) => b.at - a.at), ps = await all('pics'); if (!alive) return;
      root.innerHTML = '<div class="row" style="gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:6px"><h2 style="margin:0">📚 Art albums</h2><span class="sp"></span><button class="pri" id="alnew">＋ New album</button></div><div class="small mute" style="margin-bottom:12px">Keep your pictures together, like playlists. Use <b>📁 Add to album</b> in Pixel art, Sketchpad, Generative art and AI art, or add pictures from your computer. Everything stays on this PC.</div>' +
        (albums.length ? '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(176px,1fr));gap:12px">' + albums.map(a => { const c = cover(a, ps), n = ps.filter(p => p.album === a.id), sz = n.reduce((s, p) => s + (p.blob ? p.blob.size : 0), 0); return '<div class="card" data-o="' + a.id + '" style="margin:0;padding:8px;cursor:pointer"><div style="height:130px;border-radius:8px;overflow:hidden;background:var(--panel2);display:flex;align-items:center;justify-content:center;font-size:44px">' + (c ? '<img src="' + url(c.blob) + '" style="width:100%;height:100%;object-fit:cover;' + (c.source === 'Pixel art' ? 'image-rendering:pixelated' : '') + '">' : '📚') + '</div><b style="display:block;margin-top:6px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(a.name) + '</b><span class="small mute">' + n.length + ' picture' + (n.length === 1 ? '' : 's') + (n.length ? ' · ' + mb(sz) : '') + '</span></div>'; }).join('') + '</div>' : '<div class="card" style="margin:0"><b>No albums yet.</b><div class="small mute" style="margin-top:4px">Press <b>＋ New album</b> to make one, or save a picture from any art tool and make an album on the spot.</div></div>');
      root.querySelector('#alnew').onclick = async () => { const n = (await A.prompt('Name your new album', 'My pictures')); if (n === null) return; const a = await newAlbum(n); album(a.id); };
      root.onclick = e => { const c = e.target.closest('[data-o]'); if (c) album(c.dataset.o); };
    }

    async function album(id) {
      if (view !== id) selection.reset();
      view = id; free(); const a = (await all('albums')).find(x => x.id === id); if (!a) return home(); const list = (await all('pics')).filter(p => p.album === id).sort((x, y) => y.at - x.at); if (!alive) return;
      root.onclick = null;
      root.innerHTML = '<div class="row" style="gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:8px"><button class="ib" id="alback">← All albums</button><h2 style="margin:0">📚 ' + esc(a.name) + '</h2><button class="ib" id="alren" title="Rename album">✎</button><span class="small mute">' + list.length + ' picture' + (list.length === 1 ? '' : 's') + ' · ' + mb(list.reduce((s, p) => s + (p.blob ? p.blob.size : 0), 0)) + '</span><span class="sp"></span><button class="ib" id="aladd">＋ Add from my computer</button><button class="ib" id="alshow"' + (list.length ? '' : ' disabled') + '>▶ Slideshow</button><button class="ib" id="aldla"' + (list.length ? '' : ' disabled') + '>⬇ Download all</button><button class="ib dang" id="aldel">🗑 Delete album</button><input id="alfile" type="file" accept="image/*" multiple style="display:none"></div>' +
        (list.length ? collections.toolbar('<button class="ib" data-selection="download">Download selected</button><button class="ib" data-selection="move">Move to album</button><button class="ib dang" data-selection="delete">Delete selected</button>') + '<div id="algrid" class="album-grid" data-selection-area style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px">' + list.map(p => '<div class="album-pic" data-p="' + p.id + '" data-select-id="' + p.id + '" style="cursor:pointer">' + collections.check('Select ' + p.name) + '<div style="aspect-ratio:1;border-radius:8px;overflow:hidden;background:var(--panel2);border:2px solid ' + (a.cover === p.id ? 'var(--acc)' : 'var(--line)') + '"><img src="' + url(p.blob) + '" style="width:100%;height:100%;object-fit:cover;' + (p.source === 'Pixel art' ? 'image-rendering:pixelated' : '') + '"></div><div class="small" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="' + esc(p.name) + '">' + esc(p.name) + '<button class="collection-icon" data-pic-rename title="Rename picture" aria-label="Rename picture">✎</button></div><div class="small mute" style="font-size:11px">' + esc(p.source || 'Picture') + ' · ' + when(p.at) + '</div></div>').join('') + '</div>' : '<div class="card" style="margin:0"><b>This album is empty.</b><div class="small mute" style="margin-top:4px">Add pictures from the art tools with <b>📁 Add to album</b>, or press <b>＋ Add from my computer</b>.</div></div>');
      const q = s => root.querySelector(s);
      q('#alback').onclick = home;
      q('#alren').onclick = async () => { const n = (await A.prompt('Rename this album', a.name)); if (n === null || !n.trim()) return; a.name = n.trim().slice(0, 40); await put('albums', a); album(id); };
      q('#aldel').onclick = async () => { if (!(await A.confirm('Delete the album "' + a.name + '" and its ' + list.length + ' picture' + (list.length === 1 ? '' : 's') + ' from this PC? This cannot be undone.'))) return; for (const p of list) await del('pics', p.id); await del('albums', id); A.toast('Album deleted'); home(); };
      q('#aladd').onclick = () => q('#alfile').click();
      q('#alfile').onchange = async e => { const fs = [...e.target.files]; for (const f of fs) await put('pics', { id: uid(), album: id, name: f.name.replace(/\.[^.]+$/, '').slice(0, 80), source: 'Uploaded', prompt: '', at: Date.now(), blob: f }); if (fs.length) { a.at = Date.now(); await put('albums', a); A.toast('Added ' + fs.length + ' picture' + (fs.length === 1 ? '' : 's')); } album(id); };
      q('#aldla').onclick = async () => { if (list.length > 8 && !(await A.confirm('Download ' + list.length + ' pictures one after another?'))) return; list.forEach((p, i) => setTimeout(() => dl(p.blob, fname(p)), i * 350)); };
      q('#alshow').onclick = () => slideshow(list, 0);
      const g = q('#algrid'); if (g) g.onclick = async e => {
        const c = e.target.closest('[data-p]');
        if (!c) return;
        const i = list.findIndex(p => p.id === c.dataset.p);
        if (i < 0) return;
        if (e.target.closest('[data-pic-rename]')) {
          if (await renamePicture(list[i])) album(id);
        } else viewer(a, list, i);
      };
      selection.sync();
    }

    function viewer(a, list, i) {
      const p = list[i]; if (!p) return; const u = url(p.blob);
      A.dlg('<div class="hd"><b>' + esc(p.name) + '</b></div><div class="bd"><div style="text-align:center;background:var(--panel2);border-radius:8px;padding:6px"><img src="' + u + '" style="max-width:100%;max-height:58vh;border-radius:6px;' + (p.source === 'Pixel art' ? 'image-rendering:pixelated;min-height:240px' : '') + '"></div><div class="small mute" style="margin:6px 0">' + esc(p.source || 'Picture') + ' · ' + when(p.at) + ' · ' + mb(p.blob.size) + (p.prompt ? '<br>“' + esc(p.prompt) + '”' : '') + '</div><div class="row" style="gap:6px;flex-wrap:wrap"><button class="ib" id="vlp"' + (i ? '' : ' disabled') + '>◀</button><button class="ib" id="vln"' + (i < list.length - 1 ? '' : ' disabled') + '>▶</button><button class="ib" id="vld">⬇ Download</button><button class="ib" id="vlm">📁 Move to…</button><button class="ib" id="vlc">⭐ Make cover</button><button class="ib" id="vlr">✎ Rename</button><button class="ib dang" id="vlx">🗑 Remove</button><span class="sp"></span><button class="ib" id="vlq">Close</button></div></div>', true);
      const $ = id => document.getElementById(id), reopen = async () => { A.closeDlg(); await album(a.id); };
      $('vlq').onclick = A.closeDlg; $('vlp').onclick = () => { A.closeDlg(); viewer(a, list, i - 1); }; $('vln').onclick = () => { A.closeDlg(); viewer(a, list, i + 1); };
      $('vld').onclick = () => dl(p.blob, fname(p));
      $('vlc').onclick = async () => { a.cover = p.id; await put('albums', a); A.toast('Cover set'); reopen(); };
      $('vlr').onclick = async () => { const n = (await A.prompt('Rename this picture', p.name)); if (n === null || !n.trim()) return; p.name = n.trim().slice(0, 80); await put('pics', p); reopen(); };
      $('vlx').onclick = async () => { if (!(await A.confirm('Remove "' + p.name + '" from this album? It will be deleted from this PC.'))) return; await del('pics', p.id); if (a.cover === p.id) { a.cover = ''; await put('albums', a); } reopen(); };
      $('vlm').onclick = async () => { A.closeDlg(); const t = await pick(a.id, 'Move to which album?'); if (!t) return viewer(a, list, i); p.album = t.id; await put('pics', p); if (a.cover === p.id) { a.cover = ''; await put('albums', a); } t.at = Date.now(); await put('albums', t); A.toast('Moved to "' + t.name + '"'); album(a.id); };
    }

    function slideshow(list, start) {
      let i = start, timer = 0; const ov = document.createElement('div'); ov.style.cssText = 'position:fixed;inset:0;z-index:99999;background:#000;display:flex;align-items:center;justify-content:center;cursor:pointer'; const im = document.createElement('img'); im.style.cssText = 'max-width:100%;max-height:100%;object-fit:contain'; ov.appendChild(im);
      const cap = document.createElement('div'); cap.style.cssText = 'position:absolute;left:0;right:0;bottom:0;padding:10px 16px;color:#fff;background:linear-gradient(transparent,rgba(0,0,0,.7));font-size:14px;text-align:center'; ov.appendChild(cap);
      const hint = document.createElement('div'); hint.textContent = 'Click or press Esc to close · arrow keys to move'; hint.style.cssText = 'position:absolute;top:8px;left:0;right:0;text-align:center;color:#fff8;font-size:12px'; ov.appendChild(hint);
      let cur = ''; const show = () => { const p = list[i]; if (cur) URL.revokeObjectURL(cur); cur = URL.createObjectURL(p.blob); im.src = cur; im.style.imageRendering = p.source === 'Pixel art' ? 'pixelated' : 'auto'; cap.textContent = p.name + '  (' + (i + 1) + ' / ' + list.length + ')'; };
      const next = d => { i = (i + d + list.length) % list.length; show(); clearInterval(timer); timer = setInterval(() => next(1), 4000); };
      const close = () => { clearInterval(timer); document.removeEventListener('keydown', key, true); if (cur) URL.revokeObjectURL(cur); ov.remove(); };
      const key = e => { if (e.key === 'Escape') { e.stopPropagation(); close(); } else if (e.key === 'ArrowRight') { e.stopPropagation(); next(1); } else if (e.key === 'ArrowLeft') { e.stopPropagation(); next(-1); } };
      document.addEventListener('keydown', key, true); ov.onclick = close; document.body.appendChild(ov); show(); timer = setInterval(() => next(1), 4000);
    }

    document.addEventListener('albumchange', () => { if (alive && root.isConnected) { view ? album(view) : home(); } });
    body._cleanup = () => { alive = false; selection.destroy(); free(); }; home();
  }, 2);
})();

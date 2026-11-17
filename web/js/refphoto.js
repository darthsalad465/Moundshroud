// Reference photos for the game tools (Studio > Game maker and Studio > Game Studio). The picture search lives on the
// server (Wikimedia Commons, through the same switch and safety checks as the rest of internet access): this finds a
// photo of what a game is about, shrinks it to a copy small enough to live inside a project, reads the colours it is
// made of, and shows the picker both tools use. The tools then hand it to the AI as part of what to build: Game maker
// puts it in the page (the __REF_IMAGE__ marker), Game Studio writes it as reference_photo.gd.
(() => {
  const MAX = 320;                       // longest side of the copy a game gets, in pixels: small enough to sit inside a project
  const MARK = '__REF_IMAGE__';          // what Game maker's page carries where the photo goes; the app swaps it when the game runs
  const CSS = `
.rfp{display:flex;flex-direction:column;gap:8px}
.rfp-row{display:flex;gap:6px;align-items:center;flex-wrap:wrap}
.rfp-in{flex:1;min-width:140px;font-size:12.5px;padding:5px 9px;border-radius:9px;border:1px solid var(--line);background:var(--panel);color:var(--text)}
.rfp-in:focus{outline:none;border-color:var(--acc,#7c5cff)}
.rfp-btn{padding:5px 11px;border-radius:9px;border:1px solid var(--line);background:var(--panel2);color:var(--text);cursor:pointer;font-size:12.5px}
.rfp-btn:hover:not(:disabled){border-color:var(--acc,#7c5cff)}
.rfp-btn:disabled{opacity:.5;cursor:default}
.rfp-list{display:flex;gap:6px;flex-wrap:wrap}
.rfp-th{width:74px;height:56px;object-fit:cover;border-radius:8px;border:1px solid var(--line);cursor:pointer;background:#000}
.rfp-th.on{border-color:var(--acc,#7c5cff);box-shadow:0 0 0 2px var(--acc,#7c5cff) inset}
.rfp-info{font-size:11.5px;color:var(--mute);line-height:1.45}
.rfp-pal{display:inline-flex;gap:3px;vertical-align:middle;margin-left:4px}
.rfp-pal i{width:10px;height:10px;border-radius:2px;display:inline-block;border:1px solid rgba(0,0,0,.3)}
`;
  const style = () => { if (document.getElementById('rfp-css')) return; const s = document.createElement('style'); s.id = 'rfp-css'; s.textContent = CSS; document.head.appendChild(s); };
  const clean = s => String(s == null ? '' : s).replace(/["\\\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();
  const credit = it => [it.source || 'Wikimedia Commons', clean(it.author), clean(it.license)].filter(Boolean).join(' · ');

  /* shrink to a small JPEG and read the colours it is made of, so the game can match the photo even where the picture itself is not used */
  async function prepare(blob, max) {
    const bm = await createImageBitmap(blob), k = Math.min(1, (max || MAX) / Math.max(bm.width, bm.height));
    const w = Math.max(48, Math.round(bm.width * k)), h = Math.max(48, Math.round(bm.height * k));
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d'); g.fillStyle = '#000'; g.fillRect(0, 0, w, h); g.drawImage(bm, 0, 0, w, h);
    const d = g.getImageData(0, 0, w, h).data, count = new Map();
    for (let i = 0; i < d.length; i += 4 * 7) {                        // every seventh pixel is plenty for a palette
      const key = (d[i] >> 4) << 8 | (d[i + 1] >> 4) << 4 | (d[i + 2] >> 4);
      count.set(key, (count.get(key) || 0) + 1);
    }
    const colors = [...count.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)
      .map(([k2]) => '#' + [((k2 >> 8) & 15) * 17, ((k2 >> 4) & 15) * 17, (k2 & 15) * 17].map(v => v.toString(16).padStart(2, '0')).join(''));
    const dataUrl = c.toDataURL('image/jpeg', .72);
    return { dataUrl, b64: dataUrl.slice(dataUrl.indexOf(',') + 1), w, h, colors };
  }

  /* search, and fetch the thumbnails through the server (so the app's own length limits and the internet switch apply) */
  async function find(q, n) {
    if (typeof A === 'undefined' || !A.net) throw new Error('Internet access is not available in this window.');
    if (!A.net.on()) await A.net.refresh();                    // the switch may not have been read yet in this window
    if (!A.net.on()) throw new Error('Internet access is switched off: turn it on in Settings, AI & power.');
    const r = await A.net.images(q, n || 4);
    if (!r || r.error) throw new Error((r && r.error) || 'The picture search did not work.');
    const out = [];
    for (const it of (r.images || []).slice(0, n || 4)) {
      try { const blob = await A.net.photo(it.thumb); out.push({ it, blob, url: URL.createObjectURL(blob) }); } catch (e) { }
    }
    return out;
  }

  /* the picker: a box saying what to look for (filled in from the game description, and changeable, so a picture of
     something else entirely can be used), a button that searches, the choices, and the one that was taken.
     onPick(item | null) receives { title, page, credit, dataUrl, b64, w, h, colors }. Returns { set, get, clear, setQuery }. */
  function panel(container, opts) {
    style();
    container.innerHTML = '<div class="rfp"><div class="rfp-row">' +
      '<input class="rfp-in" data-p="q" type="search" placeholder="a picture of…" title="What to look for: filled in from the game description, and free to change">' +
      '<button class="rfp-btn" data-p="go">📷 Find a photo</button></div>' +
      '<div class="rfp-info" data-p="msg">A picture to build towards. The box starts from your game description, and can be changed.</div>' +
      '<div class="rfp-list" data-p="list"></div><div class="rfp-info" data-p="info"></div></div>';
    const q = k => container.querySelector('[data-p=' + k + ']');
    /* the box starts on the description of the game; it is only filled again while it is still empty, so anything typed in it stays */
    const fromGame = () => String((opts.query && opts.query()) || '').replace(/\s+/g, ' ').trim().slice(0, 90);
    const fill = () => { const b = q('q'); if (b && !b.value.trim()) b.value = fromGame(); };
    setTimeout(fill, 0);
    let found = [], pick = null, busy = false;
    const say = t => { q('msg').textContent = t; };
    const info = it => {
      q('info').innerHTML = it ? '📷 “' + String(it.title || 'reference') + '” · ' + String(it.credit || '') +
        '<span class="rfp-pal">' + (it.colors || []).map(c => '<i style="background:' + c + '" title="' + c + '"></i>').join('') + '</span> ' +
        '<button class="rfp-btn" data-p="off" style="padding:1px 7px;font-size:11px">✕</button>' : '';
      const off = container.querySelector('[data-p=off]'); if (off) off.onclick = () => { clear(); };
    };
    function clear() { pick = null; [...q('list').children].forEach(el => el.classList.remove('on')); info(null); say('No reference photo: the game is built from your words alone.'); if (opts.onPick) opts.onPick(null); }
    async function choose(i) {
      const f = found[i]; if (!f || busy) return;
      busy = true; [...q('list').children].forEach((el, k) => el.classList.toggle('on', k === i));
      say('Getting the photo ready…');
      try {
        pick = Object.assign({ title: clean(f.it.title), page: f.it.page || '', credit: credit(f.it) }, await prepare(f.blob));
        say('The game will follow this photo.');
        info(pick);
        if (opts.onPick) opts.onPick(pick);
      } catch (e) { pick = null; say('That photo could not be read: ' + e.message); }
      busy = false;
    }
    q('go').onclick = async () => {
      if (busy) return;
      fill();
      const text = q('q').value.trim();
      if (!text) return say('Say what the picture should be of, or describe the game first.');
      busy = true; q('go').disabled = true; say('Looking for a photo of the subject…');
      try {
        found.forEach(f => URL.revokeObjectURL(f.url)); found = await find(text, 4);
        q('list').innerHTML = '';
        if (!found.length) return say('No photo came back for that. Try a simpler subject in the game description.');
        found.forEach((f, i) => { const im = document.createElement('img'); im.className = 'rfp-th'; im.src = f.url; im.alt = f.it.title || ''; im.title = f.it.title || ''; im.onclick = () => choose(i); q('list').appendChild(im); });
        say('Pick the photo the game should follow.');
      } catch (e) { say(e.message); }
      finally { busy = false; q('go').disabled = false; }
    };
    q('q').addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') { e.preventDefault(); q('go').click(); } });
    return {
      get: () => pick,
      clear,
      setQuery: t => { q('q').value = String(t || ''); },
      fill,
      set: it => { pick = it || null; info(it || null); say(it ? 'This game already follows a reference photo.' : 'No reference photo.'); }
    };
  }

  /* Game Studio keeps its photo inside the project as text, so it can be written with the rest of the files:
     load_jpg_from_buffer(Marshalls.base64_to_raw(JPG_B64)) turns it back into a Texture2D. */
  const godotFile = it => 'extends RefCounted\n' +
    '# The reference photo for this game, kept as text so it can be written with the rest of the project.\n' +
    '# Use it in GDScript:\n' +
    '#   var img := Image.new()\n' +
    '#   img.load_jpg_from_buffer(Marshalls.base64_to_raw(preload("res://reference_photo.gd").JPG_B64))\n' +
    '#   var tex := ImageTexture.create_from_image(img)\n' +
    '# Source: ' + clean(it.credit) + (it.page ? ' - ' + it.page : '') + '\n' +
    'const JPG_B64 := "' + it.b64 + '"\n';

  window.RefPhoto = { MARK, MAX, find, prepare, panel, godotFile, credit };
})();

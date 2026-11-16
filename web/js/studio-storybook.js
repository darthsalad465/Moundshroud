// Studio > 📖 Storybook & comic: make a real picture book or comic on this PC.
//   • Picture book: one illustration and one piece of story on each page.
//   • Comic: a page of panels, each with its own picture, caption and speech bubble.
//   • Pictures come from the local image model (AIArt); if it is not installed, Qwen draws a simple vector picture.
//   • Write with AI, read aloud with the offline voices, print, save as PDF through LibreOffice, or export HTML/JSON.
// Everything is kept in this window's own IndexedDB ('moundshroud_storybook'), so a book is still here tomorrow.
(() => {
  if (typeof A === 'undefined' || !A.studio) return;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const uid = () => 'sb_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const now = () => Date.now();
  const clone = o => JSON.parse(JSON.stringify(o));
  const slug = s => String(s || 'storybook').replace(/[^\w\- ]/g, '').trim().replace(/\s+/g, '-').slice(0, 60) || 'storybook';
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  const STYLES = [['watercolor', '💧 Watercolour'], ['cartoon', '🎈 Cartoon'], ['painting', '🖌️ Oil painting'], ['anime', '🌸 Anime'], ['sketch', '✏️ Pencil sketch'], ['fantasy', '🐉 Fantasy'], ['3d', '🧊 3D render'], ['photo', '📷 Photo']];
  const STYLE_NAME = Object.fromEntries(STYLES);
  const AGES = ['3-5', '6-9', '9-12', '12+'];
  const IDEAS = [
    { icon: '🦊', title: 'The Lantern Fox', sub: 'A small fox finds a fallen star and carries it home.', pages: [
      ['The star in the snow', 'One cold night, Fen the fox found a star lying in the snow. It was no bigger than an apple, and it was still warm.'],
      ['A long way home', 'The star whispered that it belonged in the sky. Fen wrapped it in his scarf and began to climb the hill.'],
      ['The wind and the river', 'The wind pulled at the scarf. The river was wide and dark. Fen held on and jumped from stone to stone.'],
      ['The tallest pine', 'At the top of the hill stood the tallest pine in the forest. Its branches made a ladder to the clouds.'],
      ['Goodnight, little star', 'Fen lifted the star as high as he could. It rose, brighter and brighter, and took its place beside the moon.']
    ], prompts: ['a small red fox finding a glowing star in snowy woods, warm lantern light', 'a fox carrying a glowing star up a snowy hill at dusk', 'a fox crossing a dark river on stepping stones, wind in the trees', 'a fox climbing a giant pine tree toward the clouds', 'a star rising into a deep blue night sky above a forest'] },
    { icon: '🌙', title: 'The Moon Garden', sub: 'A girl plants a moonbeam and grows a garden that only opens at night.', pages: [
      ['A seed of light', 'Mira found a silver seed on her windowsill. She planted it in the garden and watered it with dew.'],
      ['The first shoot', 'By morning a thin silver shoot had pushed through the soil. It hummed when the moon came out.'],
      ['Flowers of glass', 'The garden filled with flowers that looked like glass. Each one held a tiny picture of the sky.'],
      ['The night visitors', 'Moths, hedgehogs and one very sleepy cat came to sit among the flowers until dawn.'],
      ['A garden for everyone', 'Mira left the gate open. Now anyone who cannot sleep can come and sit in the moon garden.']
    ], prompts: ['a girl planting a glowing silver seed in a garden at night', 'a silver plant shoot glowing under the moon', 'glass-like flowers reflecting the night sky in a garden', 'moths and a hedgehog among luminous flowers, a sleepy cat', 'an open garden gate under a full moon, inviting and peaceful'] },
    { icon: '🤖', title: 'The Robot Who Lost the Rain', sub: 'A little robot goes looking for the rain and finds a friend.', pages: [
      ['A very dry Tuesday', 'The rain had not come for eleven days. Pip the robot checked every cloud and found nothing but blue.'],
      ['The cloud map', 'Pip unfolded a map of the sky. One small cloud was hiding behind the mountain, fast asleep.'],
      ['Wake up, cloud', 'Pip climbed the mountain and knocked politely. The cloud yawned, stretched, and began to rumble.'],
      ['A proper storm', 'Rain fell on the fields, the roofs and Pip’s shiny head. The flowers drank until they stood up straight.'],
      ['The best kind of weather', 'Pip did not mind getting wet. He stood in the garden and listened to the rain with his new friend.']
    ], prompts: ['a small round robot looking at a clear blue sky over a dry garden', 'a robot holding a map of clouds on a mountain path', 'a robot knocking on a sleepy grey cloud on a mountain', 'rain falling on fields and a shiny robot, joyful', 'a robot and a cloud in a green garden after rain, rainbow'] }
  ];

  /* ---------------- storage ---------------- */
  const DB = () => new Promise((ok, no) => {
    try {
      const r = indexedDB.open('moundshroud_storybook', 1);
      r.onupgradeneeded = () => { const db = r.result; if (!db.objectStoreNames.contains('projects')) db.createObjectStore('projects', { keyPath: 'id' }); };
      r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error);
    } catch (e) { no(e); }
  });
  const store = {
    async list() { try { const db = await DB(); return await new Promise(ok => { const q = db.transaction('projects').objectStore('projects').getAll(); q.onsuccess = () => ok((q.result || []).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))); q.onerror = () => ok([]); }); } catch (e) { return []; } },
    async get(id) { try { const db = await DB(); return await new Promise(ok => { const q = db.transaction('projects').objectStore('projects').get(id); q.onsuccess = () => ok(q.result || null); q.onerror = () => ok(null); }); } catch (e) { return null; } },
    async put(p) { try { const db = await DB(); await new Promise((ok, no) => { const tx = db.transaction('projects', 'readwrite'); tx.objectStore('projects').put(p); tx.oncomplete = ok; tx.onerror = tx.onabort = () => no(tx.error); }); return true; } catch (e) { return false; } },
    async del(id) { try { const db = await DB(); await new Promise(ok => { const tx = db.transaction('projects', 'readwrite'); tx.objectStore('projects').delete(id); tx.oncomplete = tx.onerror = tx.onabort = ok; }); return true; } catch (e) { return false; } }
  };

  /* ---------------- the project ---------------- */
  function blankPanel() { return { id: uid(), prompt: '', caption: '', dialogue: '', art: null }; }
  function blankPage(layout) { return { id: uid(), title: '', text: '', artPrompt: '', narration: '', art: null, grid: '2x2', panels: layout === 'comic' ? [blankPanel(), blankPanel(), blankPanel(), blankPanel()] : [] }; }
  function blankProject(layout, title, style) {
    return { id: uid(), title: title || (layout === 'comic' ? 'My comic' : 'My storybook'), subtitle: '', author: '', layout: layout === 'comic' ? 'comic' : 'book', style: style || 'watercolor', age: '6-9', pages: [blankPage(layout)], createdAt: now(), updatedAt: now() };
  }
  function normalize(p) {
    if (!p || typeof p !== 'object') return null;
    p.id = String(p.id || uid()); p.layout = p.layout === 'comic' ? 'comic' : 'book';
    p.title = String(p.title || 'Untitled story'); p.subtitle = String(p.subtitle || ''); p.author = String(p.author || '');
    p.style = STYLE_NAME[p.style] ? p.style : 'watercolor'; p.age = AGES.includes(p.age) ? p.age : '6-9';
    p.createdAt = +p.createdAt || now(); p.updatedAt = +p.updatedAt || p.createdAt;
    p.pages = Array.isArray(p.pages) ? p.pages : [];
    if (!p.pages.length) p.pages.push(blankPage(p.layout));
    p.pages = p.pages.slice(0, 40).map(pg => {
      pg = pg && typeof pg === 'object' ? pg : {};
      pg.id = String(pg.id || uid()); pg.title = String(pg.title || ''); pg.text = String(pg.text || '');
      pg.artPrompt = String(pg.artPrompt || ''); pg.narration = String(pg.narration || '');
      pg.grid = ['2x2', 'strip', 'feature'].includes(pg.grid) ? pg.grid : '2x2';
      pg.art = pg.art && pg.art.src ? pg.art : (typeof pg.art === 'string' ? { src: pg.art } : null);
      pg.panels = Array.isArray(pg.panels) ? pg.panels.slice(0, 12).map(x => ({ id: String((x && x.id) || uid()), prompt: String((x && x.prompt) || ''), caption: String((x && x.caption) || ''), dialogue: String((x && x.dialogue) || ''), art: x && x.art && x.art.src ? x.art : (x && typeof x.art === 'string' ? { src: x.art } : null) })) : [];
      if (p.layout === 'comic' && !pg.panels.length) pg.panels = [blankPanel()];
      return pg;
    });
    return p;
  }
  function panelsFromText(text) {
    const bits = String(text || '').match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [];
    const list = bits.map(s => s.trim()).filter(Boolean).slice(0, 4);
    return (list.length ? list : ['']).map((s, i) => Object.assign(blankPanel(), { caption: i === 0 ? s : '', dialogue: i > 0 ? s : '' }));
  }
  const artOf = p => (p && p.art && p.art.src) || (p && p.panels || []).map(x => x.art && x.art.src).find(Boolean) || '';
  const projectArt = p => (p.cover && p.cover.src) || (p.pages || []).map(artOf).find(Boolean) || '';
  const narrationText = p => (p && p.narration && p.narration.trim()) || (cur && cur.layout === 'comic' ? (p.panels || []).map(x => [x.caption, x.dialogue].filter(Boolean).join(' ')).filter(Boolean).join(' ') : (p && p.text) || '');

  /* ---------------- state ---------------- */
  let root = null, cur = null, pageIx = 0, pending = null, saveT = null, savedAt = 0, saveState = '', aiBusy = false, artJob = null, artBusy = false;
  let reader = null, readIx = 0, reading = false;

  function setSaved(t) { saveState = t; const el = root && root.querySelector('#sbSaved'); if (el) el.textContent = t; }
  function touch() { if (!cur) return; cur.updatedAt = now(); setSaved('Saving…'); clearTimeout(saveT); saveT = setTimeout(saveNow, 550); }
  async function saveNow() { clearTimeout(saveT); if (!cur) return; const ok = await store.put(cur); savedAt = now(); setSaved(ok ? 'Saved' : 'Not saved'); }
  function selectedPage() { return cur && cur.pages[Math.max(0, Math.min(pageIx, cur.pages.length - 1))]; }

  /* ---------------- the library ---------------- */
  function showLibrary() {
    cur = null;
    root.innerHTML = '<div class="sb-wrap"><div class="sb-top"><h2>📖 Storybook &amp; comic</h2><span class="sp"></span>' +
      '<button class="pri" data-sb="new-book">＋ Picture book</button><button class="pri" data-sb="new-comic">＋ Comic</button><button class="ib" data-sb="import">⬆ Import</button></div>' +
      '<div class="sb-lib"><div class="sb-hero"><h3>Make a book that feels like a book.</h3><p>Write a picture book or a comic, illustrate it on this PC, hear it read aloud, then print it or save it as a real PDF. Nothing leaves this computer.</p>' +
      '<div class="sb-acts"><button class="pri" data-sb="new-book">Start a picture book</button><button class="ib" data-sb="new-comic">Start a comic</button></div>' +
      '<div class="sb-ideas">' + IDEAS.map((x, i) => '<button class="sb-idea" data-idea="' + i + '"><b>' + x.icon + ' ' + esc(x.title) + '</b><span>' + esc(x.sub) + '</span></button>').join('') + '</div></div>' +
      '<div class="row" style="margin:4px 0 10px"><b style="font-size:14px">Your books</b><span class="small mute" id="sbCount"></span><span class="sp"></span><button class="ib" data-sb="import">⬆ Import a book file</button></div>' +
      '<div id="sbLib"><div class="sb-empty">Opening your shelf…</div></div></div>' +
      '<input type="file" id="sbImport" accept=".json,application/json" style="display:none"></div>';
    root.querySelector('#sbImport').onchange = e => importFile(e.target.files[0]);
    listLibrary();
  }
  async function listLibrary() {
    const box = root && root.querySelector('#sbLib'); if (!box) return;
    const list = await store.list();
    if (!box.isConnected) return;
    const count = root.querySelector('#sbCount'); if (count) count.textContent = list.length ? '· ' + list.length + (list.length === 1 ? ' book' : ' books') : '';
    if (!list.length) { box.innerHTML = '<div class="sb-empty">No books yet. Start one above, or tap an idea to see how a book is laid out.</div>'; return; }
    box.innerHTML = '<div class="sb-grid">' + list.map(p => {
      const a = projectArt(p);
      return '<div class="sb-card" data-open="' + esc(p.id) + '"><div class="sb-cover">' + (a ? '<img src="' + esc(a) + '" alt="">' : '') + '<span class="sb-cbadge">' + (p.layout === 'comic' ? 'Comic' : 'Picture book') + '</span><div class="sb-ct"><b>' + esc(p.title) + '</b><span>' + esc(p.subtitle || p.author || (p.pages.length + ' pages')) + '</span></div></div>' +
        '<div class="sb-cm"><b>' + esc(p.title) + '</b><span class="small mute">' + p.pages.length + 'p</span><button class="ib" data-act="dup" data-id="' + esc(p.id) + '" title="Make a copy">⧉</button><button class="ib" data-act="del" data-id="' + esc(p.id) + '" title="Delete">🗑</button></div></div>';
    }).join('') + '</div>';
  }

  function newDialog(layout) {
    const comic = layout === 'comic';
    A.dlg('<div class="hd"><b>' + (comic ? '💥 New comic' : '📖 New picture book') + '</b></div><div class="bd">' +
      '<label class="sb-field"><span>Title</span><input type="text" id="sbNewTitle" value="' + (comic ? 'My comic' : 'My storybook') + '"></label>' +
      '<div class="row" style="gap:10px;flex-wrap:wrap"><label class="sb-field" style="flex:1;min-width:150px"><span>Picture style</span><select id="sbNewStyle">' + STYLES.map(s => '<option value="' + s[0] + '">' + s[1] + '</option>').join('') + '</select></label>' +
      '<label class="sb-field" style="flex:1;min-width:120px"><span>For ages</span><select id="sbNewAge">' + AGES.map(a => '<option' + (a === '6-9' ? ' selected' : '') + '>' + a + '</option>').join('') + '</select></label></div>' +
      '<div class="row" style="margin-top:8px"><button class="ib" id="sbNewCancel">Cancel</button><span class="sp"></span><button class="pri" id="sbNewGo">Create</button></div></div>', true);
    const close = () => A.closeDlg();
    root.querySelector('#sbNewCancel');
    document.getElementById('sbNewCancel').onclick = close;
    document.getElementById('sbNewGo').onclick = async () => {
      const title = (document.getElementById('sbNewTitle').value || '').trim() || (comic ? 'My comic' : 'My storybook');
      const p = blankProject(layout, title, document.getElementById('sbNewStyle').value);
      p.age = document.getElementById('sbNewAge').value;
      await store.put(p); close(); openProject(p.id);
    };
    setTimeout(() => { const t = document.getElementById('sbNewTitle'); if (t) { t.focus(); t.select(); } }, 30);
  }

  async function makeIdea(i) {
    const idea = IDEAS[i]; if (!idea) return;
    const p = blankProject('book', idea.title);
    p.subtitle = idea.sub;
    p.pages = idea.pages.map((x, n) => Object.assign(blankPage('book'), { title: x[0], text: x[1], artPrompt: idea.prompts[n] || '' }));
    await store.put(p); openProject(p.id);
    A.toast('Your book is ready. Press 🎨 Illustrate on a page to draw it.');
  }

  async function importFile(file) {
    if (!file) return;
    try {
      const p = normalize(JSON.parse(await file.text()));
      if (!p) throw new Error('That file is not a storybook.');
      p.id = uid(); p.title = p.title || file.name.replace(/\.json$/i, ''); p.updatedAt = now();
      await store.put(p); showLibrary(); A.toast('Imported “' + p.title + '”');
    } catch (e) { A.toast('That file could not be opened: ' + (e.message || e), 5000); }
  }

  /* ---------------- the editor ---------------- */
  async function openProject(id) {
    const p = await store.get(id);
    if (!p) { A.toast('That book could not be found.'); showLibrary(); return; }
    cur = normalize(p); pageIx = 0; buildEditor();
  }

  function buildEditor() {
    if (!cur) return showLibrary();
    const comic = cur.layout === 'comic';
    root.innerHTML = '<div class="sb-wrap"><div class="sb-top">' +
      '<button class="ib" data-sb="library" title="Back to your shelf">← Library</button>' +
      '<input type="text" id="sbTitle" value="' + esc(cur.title) + '" style="width:min(280px,28vw);font-weight:650;background:transparent;border-color:transparent;padding:4px 7px" title="Book title">' +
      '<span class="badge">' + (comic ? '💥 Comic' : '📖 Picture book') + '</span>' +
      '<span class="sp"></span><span class="sb-saved" id="sbSaved">' + (saveState || 'Saved') + '</span>' +
      '<button class="ib" data-sb="ai">✨ Write with AI</button><button class="ib" data-sb="details">⚙ Details</button>' +
      '<button class="ib" data-sb="read">▶ Read</button><button class="ib" data-sb="print">🖨 Print</button><button class="pri" data-sb="pdf">📄 PDF</button><button class="ib" data-sb="export" title="Export this book as a file">⬇</button></div>' +
      '<div class="sb-ed"><aside class="sb-pages"><div class="sb-ph">Pages <span class="sp"></span><span id="sbPageCount"></span></div><div class="sb-pl" id="sbPageList"></div><div class="sb-pf"><button class="ib" data-sb="addpage">＋ Add page</button><button class="ib" data-sb="add3">＋ 3 pages</button></div></aside>' +
      '<section class="sb-stage"><div class="sb-stagebar"><button class="ib" data-sb="prevpage" title="Previous page">◀</button><span id="sbPageLabel"></span><button class="ib" data-sb="nextpage" title="Next page">▶</button><span class="sp"></span><span class="small mute" id="sbStageHint"></span></div><div id="sbStageBody"></div></section>' +
      '<aside class="sb-insp" id="sbInsp"></aside></div></div>';
    const title = root.querySelector('#sbTitle');
    title.oninput = () => { cur.title = title.value; touch(); refreshPreview(); };
    root.querySelector('#sbPageList').onclick = e => {
      const b = e.target.closest('[data-page]'); if (!b) return;
      if (b.dataset.act) { pageAction(b.dataset.act, +b.dataset.page); return; }
      selectPage(+b.dataset.page);
    };
    renderPages(); renderStage(); renderInspector();
  }

  function selectPage(i) { if (!cur) return; pageIx = Math.max(0, Math.min(i, cur.pages.length - 1)); renderPages(); renderStage(); renderInspector(); }

  function pageAction(act, i) {
    if (!cur || !cur.pages[i]) return;
    if (act === 'up' && i > 0) { const p = cur.pages.splice(i, 1)[0]; cur.pages.splice(i - 1, 0, p); pageIx = i - 1; }
    else if (act === 'down' && i < cur.pages.length - 1) { const p = cur.pages.splice(i, 1)[0]; cur.pages.splice(i + 1, 0, p); pageIx = i + 1; }
    else if (act === 'del') {
      if (cur.pages.length === 1) { if (!confirm('Delete this page? A book needs at least one page.')) return; cur.pages[0] = blankPage(cur.layout); pageIx = 0; }
      else { if (!confirm('Delete page ' + (i + 1) + '?')) return; cur.pages.splice(i, 1); pageIx = Math.min(pageIx, cur.pages.length - 1); }
    }
    touch(); renderPages(); renderStage(); renderInspector();
  }

  function addPage(n) {
    for (let i = 0; i < n; i++) cur.pages.push(blankPage(cur.layout));
    pageIx = cur.pages.length - 1; touch(); renderPages(); renderStage(); renderInspector();
  }

  function thumb(pg, i) {
    const comic = cur.layout === 'comic', a = artOf(pg);
    const text = comic ? (pg.panels || []).map(x => [x.caption, x.dialogue].filter(Boolean).join(' ')).filter(Boolean).join(' ') : (pg.text || '');
    return '<button class="sb-thumb' + (i === pageIx ? ' on' : '') + '" data-page="' + i + '"><span class="sb-tn">' + (i + 1) + '</span>' +
      '<div class="sb-tp">' + (a ? '<img src="' + esc(a) + '" alt="">' : '') + '<b>' + esc(pg.title || (comic ? 'Comic page ' + (i + 1) : 'Untitled page')) + '</b><div class="sb-tx">' + esc(text) + '</div></div>' +
      '<span class="sb-ta"><button data-act="up" data-page="' + i + '" title="Move up">↑</button><button data-act="down" data-page="' + i + '" title="Move down">↓</button><button data-act="del" data-page="' + i + '" title="Delete">✕</button></span></button>';
  }
  function renderPages() {
    const box = root && root.querySelector('#sbPageList'); if (!box || !cur) return;
    box.innerHTML = cur.pages.map(thumb).join('');
    const c = root.querySelector('#sbPageCount'); if (c) c.textContent = cur.pages.length + (cur.pages.length === 1 ? ' page' : ' pages');
    const l = root.querySelector('#sbPageLabel'); if (l) l.textContent = 'Page ' + (pageIx + 1) + ' of ' + cur.pages.length;
    const h = root.querySelector('#sbStageHint'); if (h) h.textContent = cur.layout === 'comic' ? 'Panels, captions and speech bubbles' : 'Illustration, story and a page number';
  }

  function paper(pg, i) {
    if (cur.layout === 'comic') {
      const panels = pg.panels && pg.panels.length ? pg.panels : [blankPanel()];
      return '<div class="sb-paper sb-comic"><div class="sb-ptitle">' + esc(cur.title) + '</div><div class="sb-comic ' + esc(pg.grid) + '">' + panels.map((x, n) => '<div class="sb-panel">' + (x.art && x.art.src ? '<img src="' + esc(x.art.src) + '" alt="">' : '<div class="sb-panelph">Panel ' + (n + 1) + '<br><span style="opacity:.7">Press 🎨 to draw it</span></div>') + (x.caption ? '<div class="sb-cap">' + esc(x.caption) + '</div>' : '') + (x.dialogue ? '<div class="sb-bub' + (n % 2 ? ' r' : '') + '">' + esc(x.dialogue) + '</div>' : '') + '<div class="sb-pn2">' + (n + 1) + '</div></div>').join('') + '</div><div class="sb-pn">' + (i + 1) + '</div></div>';
    }
    return '<div class="sb-paper"><div class="sb-ptitle">' + esc(cur.title) + '</div><div class="sb-art">' + (pg.art && pg.art.src ? '<img src="' + esc(pg.art.src) + '" alt="">' : '<div class="sb-artph">🎨<b>No illustration yet</b><span>Press “Illustrate” in the panel on the right.</span></div>') + '</div><div class="sb-body"><h3 class="sb-h">' + esc(pg.title || '') + '</h3><div class="sb-text">' + esc(pg.text || '') + '</div></div><div class="sb-pn">' + (i + 1) + '</div></div>';
  }
  function renderStage() {
    const box = root && root.querySelector('#sbStageBody'); if (!box || !cur) return;
    const pg = selectedPage(); if (!pg) return;
    box.innerHTML = paper(pg, pageIx); fitPaper();
    const l = root.querySelector('#sbPageLabel'); if (l) l.textContent = 'Page ' + (pageIx + 1) + ' of ' + cur.pages.length;
  }
  function fitPaper() {
    root.querySelectorAll('.sb-paper .sb-text').forEach(el => { const n = (el.textContent || '').length; el.style.fontSize = n > 900 ? '12.4px' : n > 680 ? '13.3px' : n > 460 ? '14.4px' : '15.5px'; el.style.lineHeight = n > 680 ? '1.48' : '1.55'; });
    root.querySelectorAll('.sb-paper .sb-h').forEach(el => { const n = (el.textContent || '').length; el.style.fontSize = n > 46 ? '17px' : n > 32 ? '19px' : '22px'; });
  }
  function refreshPreview() { renderStage(); const t = root && root.querySelector('[data-page="' + pageIx + '"] .sb-tx'); if (t) { const pg = selectedPage(); t.textContent = cur.layout === 'comic' ? (pg.panels || []).map(x => [x.caption, x.dialogue].filter(Boolean).join(' ')).filter(Boolean).join(' ') : (pg.text || ''); } }

  function field(label, bind, value, opts) {
    opts = opts || {};
    const id = 'sbF' + Math.random().toString(36).slice(2, 7);
    return '<label class="sb-field" for="' + id + '"><span>' + label + '</span>' + (opts.textarea ? '<textarea id="' + id + '" data-bind="' + bind + '"' + (opts.panel != null ? ' data-panel="' + opts.panel + '"' : '') + ' rows="' + (opts.rows || 3) + '" placeholder="' + esc(opts.ph || '') + '">' + esc(value || '') + '</textarea>' : '<input type="text" id="' + id + '" data-bind="' + bind + '"' + (opts.panel != null ? ' data-panel="' + opts.panel + '"' : '') + ' value="' + esc(value || '') + '" placeholder="' + esc(opts.ph || '') + '">') + (opts.hint ? '<div class="sb-hint">' + opts.hint + '</div>' : '') + '</label>';
  }
  function renderInspector() {
    const box = root && root.querySelector('#sbInsp'); if (!box || !cur) return;
    const pg = selectedPage(); if (!pg) return;
    const comic = cur.layout === 'comic';
    let h = '<details open><summary>Page ' + (pageIx + 1) + '</summary>' +
      field('Page title', 'page.title', pg.title, { ph: comic ? 'e.g. The chase' : 'e.g. The star in the snow' }) +
      field(comic ? 'Page narration (read aloud)' : 'Story text', comic ? 'page.narration' : 'page.text', comic ? pg.narration : pg.text, { textarea: true, rows: comic ? 3 : 7, ph: comic ? 'What happens on this page, in a sentence or two.' : 'Write the story for this page…' }) +
      '<div class="sb-actions"><button class="ib" data-sb="writepage">✨ Write this page</button><button class="ib" data-sb="listen">🔊 Listen</button></div></details>';
    if (comic) {
      h += '<details open><summary>Panels <span class="small mute">(' + (pg.panels || []).length + ')</span></summary>' +
        '<label class="sb-field"><span>Layout</span><select data-bind="page.grid">' + [['2x2', '2 × 2 grid'], ['strip', 'One strip'], ['feature', 'Big first panel']].map(x => '<option value="' + x[0] + '"' + (pg.grid === x[0] ? ' selected' : '') + '>' + x[1] + '</option>').join('') + '</select></label>' +
        (pg.panels || []).map((x, n) => '<div class="sb-panelbox"><div class="sb-pbh"><b>Panel ' + (n + 1) + '</b><button data-panel-act="up" data-panel="' + n + '" title="Move up">↑</button><button data-panel-act="down" data-panel="' + n + '" title="Move down">↓</button><button data-panel-act="del" data-panel="' + n + '" title="Remove">✕</button></div>' +
          '<div class="sb-pthumb">' + (x.art && x.art.src ? '<img src="' + esc(x.art.src) + '" alt="">' : 'No picture yet') + '</div>' +
          field('Picture idea', 'panel.prompt', x.prompt, { panel: n, ph: 'What should this panel show?' }) +
          field('Caption', 'panel.caption', x.caption, { panel: n, ph: 'Narration in the yellow box' }) +
          field('Speech bubble', 'panel.dialogue', x.dialogue, { panel: n, ph: 'What a character says' }) +
          '<div class="sb-actions"><button class="ib" data-art="panel" data-panel="' + n + '">🎨 Draw panel</button>' + (x.art ? '<button class="ib" data-artdel="panel" data-panel="' + n + '">✕ Picture</button>' : '') + '</div></div>').join('') +
        '<button class="ib" data-sb="addpanel" style="width:100%">＋ Add a panel</button></details>';
    }
    h += '<details' + (comic ? '' : ' open') + '><summary>Illustration</summary>' +
      field('What the picture shows', 'page.artPrompt', pg.artPrompt, { textarea: true, rows: 3, ph: 'e.g. a small fox carrying a glowing star through snowy woods, warm lantern light' }) +
      '<div class="sb-actions"><button class="pri" id="sbArtBtn" data-art="page">🎨 Illustrate this page</button>' + (pg.art ? '<button class="ib" data-artdel="page">✕ Picture</button>' : '') + '</div>' +
      '<div class="sb-mini" id="sbArtStat" style="margin-top:6px"></div><div class="sb-mini" id="sbArtHint"></div></details>' +
      '<details><summary>Reading aloud</summary>' + field('Narration', 'page.narration', pg.narration, { textarea: true, rows: 4, ph: 'Leave empty to read the page text. Add a pause with a full stop.' }) + '<div class="sb-mini">Uses the offline voice in Settings › Voice &amp; sound.</div></details>' +
      '<details><summary>Book details</summary>' + field('Title', 'book.title', cur.title) + field('Subtitle', 'book.subtitle', cur.subtitle, { ph: 'e.g. A story about being brave' }) + field('Author', 'book.author', cur.author, { ph: 'Your name' }) +
      '<label class="sb-field"><span>Picture style</span><select data-bind="book.style">' + STYLES.map(s => '<option value="' + s[0] + '"' + (cur.style === s[0] ? ' selected' : '') + '>' + s[1] + '</option>').join('') + '</select></label>' +
      '<label class="sb-field"><span>For ages</span><select data-bind="book.age">' + AGES.map(a => '<option' + (cur.age === a ? ' selected' : '') + '>' + a + '</option>').join('') + '</select></label>' +
      '<label class="sb-field"><span>Layout</span><select id="sbLayoutSel"><option value="book"' + (!comic ? ' selected' : '') + '>📖 Picture book</option><option value="comic"' + (comic ? ' selected' : '') + '>💥 Comic</option></select></label>' +
      '<div class="sb-actions"><button class="ib" data-sb="exportjson">⬇ Export a book file</button><button class="ib" data-sb="duplicate">⧉ Make a copy</button></div></details>' +
      '<div class="sb-sep"></div><div class="sb-actions"><button class="ib" data-sb="delpage" style="border-color:var(--bad);color:var(--bad)">🗑 Delete this page</button></div>';
    box.innerHTML = h;

    box.querySelectorAll('[data-bind]').forEach(el => {
      el.addEventListener('input', () => {
        const bind = el.dataset.bind, pi = el.dataset.panel;
        if (bind === 'book.title') { cur.title = el.value; const t = root.querySelector('#sbTitle'); if (t) t.value = el.value; }
        else if (bind === 'book.subtitle') cur.subtitle = el.value;
        else if (bind === 'book.author') cur.author = el.value;
        else if (bind === 'book.style') cur.style = el.value;
        else if (bind === 'book.age') cur.age = el.value;
        else if (bind === 'page.grid') { pg.grid = el.value; }
        else if (bind === 'page.title') pg.title = el.value;
        else if (bind === 'page.text') pg.text = el.value;
        else if (bind === 'page.artPrompt') pg.artPrompt = el.value;
        else if (bind === 'page.narration') pg.narration = el.value;
        else if (bind.indexOf('panel.') === 0) { const p = pg.panels[+pi]; if (p) p[bind.slice(6)] = el.value; }
        touch(); refreshPreview();
      });
    });
    const lay = box.querySelector('#sbLayoutSel'); if (lay) lay.onchange = () => switchLayout(lay.value);
    const artBtn = box.querySelector('#sbArtBtn'); if (artBtn) artBtn.disabled = artBusy;
    if (artBusy) setArtBusy(true);
    AIArt.status().then(st => {
      const hint = root && root.querySelector('#sbArtHint');
      if (!hint) return;
      hint.innerHTML = st && st.sd ? 'Drawn by the local image model. The first picture can take a little longer.' : '<b>The image model is not installed here.</b> Qwen will draw a simpler vector picture instead. Install it in Prepare › Stock up for full illustrations.';
    }).catch(() => { });
  }

  function setArtBusy(on, label) {
    artBusy = on;
    const b = root && root.querySelector('#sbArtBtn'); if (b) { b.disabled = on; b.textContent = on ? 'Drawing…' : '🎨 Illustrate this page'; }
    const stat = root && root.querySelector('#sbArtStat'); if (stat) stat.innerHTML = on ? '<span class="sb-busy">' + esc(label || 'Drawing on this PC…') + '</span>' : '';
    root && root.querySelectorAll('[data-art]').forEach(x => { x.disabled = on; });
  }

  function switchLayout(layout) {
    if (!cur || cur.layout === layout) return;
    if (layout === 'comic') {
      cur.pages.forEach(p => { if (!p.panels || !p.panels.length) p.panels = panelsFromText(p.text); });
    } else {
      cur.pages.forEach(p => { if (!p.text && p.panels && p.panels.length) p.text = p.panels.map(x => [x.caption, x.dialogue].filter(Boolean).join(' ')).filter(Boolean).join(' '); });
    }
    cur.layout = layout; touch(); buildEditor();
    A.toast(layout === 'comic' ? 'Now a comic: your pages are panels.' : 'Now a picture book: the panels became story text.');
  }

  /* ---------------- pictures ---------------- */
  const blobData = blob => new Promise((ok, no) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = () => no(r.error); r.readAsDataURL(blob); });
  const defaultPrompt = (pg, panel) => {
    const bit = panel ? (panel.prompt || panel.caption || panel.dialogue) : (pg.artPrompt || pg.text || pg.title);
    return [cur.title, pg.title, bit].filter(Boolean).join('. ').replace(/\s+/g, ' ').slice(0, 500) + ', children’s storybook illustration, ' + (STYLE_NAME[cur.style] || 'watercolor').replace(/^\S+\s/, '') + ', warm light, rich detail, no text';
  };

  async function illustrate(pg, panel) {
    if (artBusy) return A.toast('A picture is already being drawn.');
    if (!window.AIArt) return A.toast('The picture engine is not loaded.');
    const target = panel || pg;
    const prompt = (panel ? panel.prompt : pg.artPrompt) || defaultPrompt(pg, panel);
    if (!panel && !pg.artPrompt) { pg.artPrompt = prompt; }
    artJob = new AbortController(); setArtBusy(true, 'Checking the picture engine…');
    try {
      const st = await AIArt.status();
      let art;
      if (st && st.sd) {
        setArtBusy(true, 'Drawing on this PC… the first picture can take a little longer.');
        const r = await AIArt.image(prompt, { style: cur.style, w: panel ? 512 : 768, h: panel ? 512 : 512, steps: 4, signal: artJob.signal });
        art = { src: await blobData(r.blob), seed: r.seed, prompt, style: cur.style };
      } else {
        setArtBusy(true, 'Qwen is drawing a simpler picture…');
        const r = await AIArt.svg(prompt);
        art = { src: r.url, svg: r.svg, prompt, style: cur.style };
      }
      target.art = art; touch(); setArtBusy(false); renderStage(); renderInspector();
      A.toast('🎨 Picture ready');
    } catch (e) {
      setArtBusy(false);
      if (e && e.name === 'AbortError') A.toast('Stopped drawing.');
      else A.toast((e && e.message) || 'The picture could not be drawn. Try a simpler description.', 5000);
    } finally { artJob = null; setArtBusy(false); }
  }

  /* ---------------- writing with AI ---------------- */
  const STORY_SCHEMA = { type: 'object', properties: { title: { type: 'string' }, subtitle: { type: 'string' }, pages: { type: 'array', items: { type: 'object', properties: { title: { type: 'string' }, text: { type: 'string' }, art: { type: 'string' }, panels: { type: 'array', items: { type: 'object', properties: { caption: { type: 'string' }, dialogue: { type: 'string' }, art: { type: 'string' } } } } }, required: ['title', 'text'] } } }, required: ['title', 'pages'] };
  const modelName = () => { try { return document.getElementById('model').value; } catch (e) { return ''; } };

  function aiDialog() {
    A.dlg('<div class="hd"><b>✨ Write with AI</b></div><div class="bd"><div class="small mute" style="margin-bottom:8px">Describe the story in a sentence or two. The local AI will make the pages and an idea for each picture; you can change every word afterwards.</div>' +
      '<label class="sb-field"><span>The idea</span><textarea id="sbPremise" rows="3" placeholder="e.g. a shy dragon who is afraid of fire, and the friend who helps him">' + esc(cur.premise || '') + '</textarea></label>' +
      '<div class="row" style="gap:10px;flex-wrap:wrap"><label class="sb-field" style="flex:1;min-width:120px"><span>Pages</span><select id="sbAiPages"><option>4</option><option selected>5</option><option>6</option><option>8</option><option>10</option></select></label>' +
      '<label class="sb-field" style="flex:1;min-width:150px"><span>Reading age</span><select id="sbAiAge">' + AGES.map(a => '<option' + (cur.age === a ? ' selected' : '') + '>' + a + '</option>').join('') + '</select></label></div>' +
      '<label class="chk small"><input type="checkbox" id="sbAiReplace"> Replace the pages that are already here</label>' +
      '<div class="row" style="margin-top:10px"><button class="ib" id="sbAiCancel">Cancel</button><span class="sp"></span><button class="pri" id="sbAiGo">Write it</button></div><div class="small mute" id="sbAiStat" style="margin-top:6px"></div></div>', true);
    document.getElementById('sbAiCancel').onclick = () => A.closeDlg();
    document.getElementById('sbAiGo').onclick = async () => {
      const premise = (document.getElementById('sbPremise').value || '').trim();
      if (!premise) return A.toast('Say what the story is about first.');
      const n = +document.getElementById('sbAiPages').value || 5, age = document.getElementById('sbAiAge').value, replace = document.getElementById('sbAiReplace').checked;
      const stat = document.getElementById('sbAiStat'); stat.textContent = 'Writing the story on this PC…';
      try {
        const data = await writeStory(premise, n, age);
        const pages = (data.pages || []).slice(0, 24).map(x => {
          const pg = blankPage(cur.layout);
          pg.title = String(x.title || ''); pg.text = String(x.text || ''); pg.artPrompt = String(x.art || '');
          if (cur.layout === 'comic') pg.panels = Array.isArray(x.panels) && x.panels.length ? x.panels.slice(0, 8).map(y => Object.assign(blankPanel(), { caption: String(y.caption || ''), dialogue: String(y.dialogue || ''), prompt: String(y.art || '') })) : panelsFromText(pg.text);
          return pg;
        });
        if (!pages.length) throw new Error('The story came back empty. Try again.');
        if (data.title) cur.title = String(data.title).slice(0, 120);
        if (data.subtitle) cur.subtitle = String(data.subtitle).slice(0, 160);
        if (replace || (cur.pages.length === 1 && !cur.pages[0].text && !cur.pages[0].art && !cur.pages[0].panels.some(x => x.art))) cur.pages = pages;
        else cur.pages = cur.pages.concat(pages);
        pageIx = replace ? 0 : Math.max(0, cur.pages.length - pages.length);
        cur.premise = premise; cur.age = age; touch(); A.closeDlg(); buildEditor(); A.toast('✨ ' + pages.length + ' pages written. Change anything you like.');
      } catch (e) { stat.textContent = ''; A.toast((e && e.message) || 'The AI engine did not answer.', 5000); }
    };
    setTimeout(() => { const t = document.getElementById('sbPremise'); if (t) t.focus(); }, 30);
  }

  async function writeStory(premise, n, age) {
    const comic = cur.layout === 'comic';
    const ask = 'You are a warm, careful children’s author. Write a ' + n + '-page ' + (comic ? 'comic' : 'picture book') + ' for ages ' + age + ' about: ' + premise + '\n\n' +
      'Rules: a clear beginning, middle and end; short sentences; a gentle problem and a satisfying last page. Each page gets a short title, the words on the page (2 to 4 sentences, under 90 words), and a one-line idea for the picture. ' +
      (comic ? 'For each page, also give 3 or 4 panels with a short caption (the narration) and, where someone speaks, a short speech bubble. ' : '') +
      'Reply as JSON: {"title":"...","subtitle":"...","pages":[{"title":"...","text":"...","art":"a one-line picture idea"' + (comic ? ',"panels":[{"caption":"...","dialogue":"...","art":"a one-line picture idea"}]' : '') + '}]}. No text outside the JSON.';
    const r = await fetch('/api/chat', { method: 'POST', body: JSON.stringify({ model: modelName(), stream: false, think: false, keep_alive: '3m', format: STORY_SCHEMA, messages: [{ role: 'user', content: ask }] }) });
    const j = await r.json(); if (j.error) throw new Error(j.error);
    const txt = (j.message && j.message.content) || '';
    const m = /\{[\s\S]*\}/.exec(txt); if (!m) throw new Error('The story did not come back in the right shape. Try again.');
    return JSON.parse(m[0]);
  }

  async function writePage() {
    if (aiBusy) return A.toast('The AI is already writing.');
    const pg = selectedPage(); if (!pg) return;
    if (!A.ai || !A.ai.stream) return A.toast('The AI engine is not ready.');
    aiBusy = true; setSaved('Writing…');
    try {
      const before = cur.pages.slice(0, pageIx).map(x => x.text).filter(Boolean).join(' ');
      const comic = cur.layout === 'comic';
      const sys = comic ? 'You are a children’s comic writer. Reply with JSON only: {"panels":[{"caption":"...","dialogue":"...","art":"..."}]} with 3 or 4 panels. Keep each caption under 20 words and each speech bubble under 14 words.' : 'You are a warm children’s author. Write 2 to 4 short sentences that continue the story. Reply with the sentences only, no title, no notes.';
      const ask = 'Book: ' + cur.title + (cur.subtitle ? ' — ' + cur.subtitle : '') + '\nEarlier pages: ' + (before || '(this is the beginning)') + '\nThis page is called: ' + (pg.title || 'untitled') + '\nWrite the next part for ages ' + cur.age + '.';
      const out = await A.ai.stream([{ role: 'system', content: sys }, { role: 'user', content: ask.slice(0, 6000) }], () => { }, null, { temp: .8 });
      if (!out || !out.trim()) throw new Error('The AI wrote nothing. Try again.');
      if (comic) {
        const m = /\{[\s\S]*\}/.exec(out); if (!m) throw new Error('The panels came back in the wrong shape.');
        const data = JSON.parse(m[0]); if (!Array.isArray(data.panels) || !data.panels.length) throw new Error('No panels came back.');
        pg.panels = data.panels.slice(0, 8).map(x => Object.assign(blankPanel(), { caption: String(x.caption || ''), dialogue: String(x.dialogue || ''), prompt: String(x.art || '') }));
      } else pg.text = (pg.text ? pg.text.trim() + ' ' : '') + out.trim();
      touch(); renderStage(); renderInspector(); A.toast('✨ Page written');
    } catch (e) { A.toast((e && e.message) || 'The AI engine did not answer.', 5000); }
    finally { aiBusy = false; setSaved(saveState === 'Writing…' ? 'Saved' : saveState); }
  }

  /* ---------------- reading aloud ---------------- */
  function listen() {
    const pg = selectedPage(); if (!pg) return;
    if (!A.speech || !A.speech.speak) return A.toast('Read aloud is not available here.');
    const text = narrationText(pg);
    if (!text.trim()) return A.toast('Write something first.');
    A.speech.speak(text, null);
  }

  /* ---------------- print and PDF ---------------- */
  function paragraphs(t) { return esc(t).split(/\n{2,}/).map(p => '<p>' + p.replace(/\n/g, '<br>') + '</p>').join(''); }
  function printDoc(selfContained) {
    const assets = [], seen = new Map();
    const art = src => {
      if (!src) return '';
      if (selfContained) return src;
      if (seen.has(src)) return seen.get(src);
      const m = /^data:image\/(png|jpe?g|webp|gif)/i.exec(src), ext = m ? (m[1].toLowerCase() === 'jpeg' ? 'jpg' : m[1].toLowerCase()) : 'png';
      const name = 'art-' + assets.length + '.' + ext; assets.push({ name, data: src }); seen.set(src, name); return name;
    };
    const coverArt = projectArt(cur);
    let body = '<div class="pg cover">' + (coverArt ? '<img class="coverart" src="' + art(coverArt) + '" alt="">' : '') + '<div class="ci">' + (cur.layout === 'comic' ? '💥' : '📖') + '</div><h1>' + esc(cur.title) + '</h1>' + (cur.subtitle ? '<p class="sub">' + esc(cur.subtitle) + '</p>' : '') + (cur.author ? '<p class="by">by ' + esc(cur.author) + '</p>' : '') + '<p class="age">A ' + (cur.layout === 'comic' ? 'comic' : 'picture book') + ' for ages ' + esc(cur.age) + '</p></div>';
    cur.pages.forEach((pg, i) => {
      if (cur.layout === 'comic') {
        const panels = pg.panels && pg.panels.length ? pg.panels : [blankPanel()];
        const rows = [];
        for (let n = 0; n < panels.length; n += 2) rows.push(panels.slice(n, n + 2));
        body += '<div class="pg comic"><div class="kicker">' + esc(cur.title) + '</div><h2>' + esc(pg.title || 'Page ' + (i + 1)) + '</h2><table class="panels" width="100%" cellpadding="6" cellspacing="6">' + rows.map(row => '<tr>' + row.map(x => '<td class="panel" width="50%" valign="top">' + (x.art && x.art.src ? '<img src="' + art(x.art.src) + '" width="300" height="200" alt="">' : '<div class="nopic">picture ' + (panels.indexOf(x) + 1) + '</div>') + (x.caption ? '<div class="cap">' + esc(x.caption) + '</div>' : '') + (x.dialogue ? '<div class="bub">' + esc(x.dialogue) + '</div>' : '') + '</td>').join('') + (row.length === 1 ? '<td width="50%"></td>' : '') + '</tr>').join('') + '</table>' + (pg.narration ? '<div class="note">' + esc(pg.narration) + '</div>' : '') + '<div class="pnum">' + (i + 1) + '</div></div>';
      } else {
        body += '<div class="pg"><div class="kicker">' + esc(cur.title) + '</div>' + (pg.art && pg.art.src ? '<img class="art" src="' + art(pg.art.src) + '" width="600" height="360" alt="">' : '') + '<h2>' + esc(pg.title || '') + '</h2><div class="txt">' + paragraphs(pg.text || '') + '</div><div class="pnum">' + (i + 1) + '</div></div>';
      }
    });
    const css = '@page{size:letter;margin:0}*{box-sizing:border-box}body{margin:0;color:#241a38;background:#fff;font-family:Georgia,"Times New Roman",serif}' +
      '.pg{width:8.5in;height:11in;padding:.62in .72in;page-break-after:always;position:relative;overflow:hidden;background:#fffdf7}' +
      '.pg:last-child{page-break-after:auto}.cover{background:#1c1238;color:#f6efdf;text-align:center;padding-top:2.1in}' +
      '.cover .coverart{width:4.4in;height:3.3in;object-fit:cover;border:2px solid #d9b24c;margin-bottom:.35in}' +
      '.cover .ci{font-size:40pt;margin-bottom:.12in}.cover h1{font-size:34pt;margin:.06in 0 .1in;line-height:1.08;font-weight:bold}' +
      '.cover .sub{font-size:15pt;font-style:italic;color:#e7d9b4;margin:.04in 0}.cover .by{font-size:12pt;margin:.22in 0 .02in;color:#d9c79a}.cover .age{font-size:10pt;color:#b7a884;margin-top:.25in}' +
      '.kicker{font-family:Arial,sans-serif;font-size:8pt;letter-spacing:.16em;text-transform:uppercase;color:#9a7a38;margin-bottom:.1in}' +
      '.pg h2{font-size:21pt;line-height:1.12;margin:.06in 0 .12in;color:#241a38}.art{width:100%;height:4.15in;object-fit:cover;margin:.02in 0 .16in}' +
      '.txt{font-size:13.5pt;line-height:1.55;color:#3a3044}.txt p{margin:0 0 .1in}.pnum{position:absolute;left:0;right:0;bottom:.22in;text-align:center;font:9pt Arial,sans-serif;color:#a08a63}' +
      '.comic h2{font-size:18pt;margin-bottom:.08in}.panels{border-collapse:separate;border-spacing:6px}.panel{border:2px solid #1e1729;padding:5px;background:#fff}' +
      '.panel img{width:100%;height:2.05in;object-fit:cover}.panel .nopic{height:2.05in;background:#e9dfcb;color:#8b7b5d;font:9pt Arial;text-align:center;padding-top:.9in}' +
      '.panel .cap{background:#f7e7a8;border:1px solid #1e1729;padding:3px 6px;font:8.5pt Arial,sans-serif;color:#2a2130;margin-top:4px}' +
      '.panel .bub{border:1.4px solid #1e1729;border-radius:8px;padding:4px 7px;font:9.5pt "Comic Sans MS",Arial,sans-serif;color:#211a2c;margin-top:4px}' +
      '.note{font:10pt Arial,sans-serif;color:#5b4b66;margin-top:.12in;font-style:italic}';
    return { html: '<!doctype html><html><head><meta charset="utf-8"><title>' + esc(cur.title) + '</title><style>' + css + '</style></head><body>' + body + '</body></html>', assets };
  }
  function printBook() {
    const w = window.open('', '_blank'); if (!w) return A.toast('Allow pop-ups to print.');
    const html = printDoc(true).html.replace('</body>', '<script>setTimeout(function(){window.print()},450)<\/script></body>');
    w.document.write(html); w.document.close();
  }
  function download(name, text, type) {
    const b = new Blob([text], { type: type || 'text/plain' }), a = document.createElement('a');
    a.href = URL.createObjectURL(b); a.download = name; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1200);
  }
  async function makePdf() {
    if (!cur) return;
    const { html, assets } = printDoc(false);
    setSaved('Making PDF…');
    try {
      const o = await A.api('/api/storybook/pdf', { title: cur.title, html, assets });
      if (o && o.error) throw new Error(o.error);
      setSaved('Saved');
      A.dlg('<div class="hd"><b>📄 Your PDF is ready</b></div><div class="bd">' + (o.preview ? '<img src="/api/file?path=' + encodeURIComponent(o.preview) + '" style="width:160px;border:1px solid var(--line);border-radius:8px;background:#fff;float:left;margin:0 12px 8px 0">' : '') + '<b>' + esc(o.name || cur.title + '.pdf') + '</b><div class="small mute" style="overflow-wrap:anywhere;margin:2px 0 12px">' + esc(o.path || '') + '</div><div class="row" style="flex-wrap:wrap"><button class="pri" id="sbPdfOpen">Open</button><button class="ib" id="sbPdfFolder">Show in folder</button><button class="ib" id="sbPdfClose">Close</button></div></div>', true);
      document.getElementById('sbPdfOpen').onclick = () => A.api('/api/office/open', { path: o.path, app: 'default' });
      document.getElementById('sbPdfFolder').onclick = () => A.api('/api/office/open', { path: o.path, app: 'folder' });
      document.getElementById('sbPdfClose').onclick = () => A.closeDlg();
    } catch (e) { setSaved('Saved'); A.toast((e && e.message) || 'The PDF could not be made. Use Print / Save as PDF instead.', 6000); }
  }
  function exportJson() { download(slug(cur.title) + '.json', JSON.stringify(cur, null, 2), 'application/json'); A.toast('Book file saved'); }
  async function duplicate() { const p = clone(cur); p.id = uid(); p.title = cur.title + ' (copy)'; p.createdAt = now(); p.updatedAt = now(); await store.put(p); A.toast('Made a copy'); }
  function details() { A.dlg('<div class="hd"><b>⚙ Book details</b></div><div class="bd">' + field('Title', 'book.title', cur.title) + field('Subtitle', 'book.subtitle', cur.subtitle, { ph: 'A short line under the title' }) + field('Author', 'book.author', cur.author, { ph: 'Your name' }) + '<div class="small mute">You can also change these in the panel on the right.</div><div class="row" style="margin-top:10px"><span class="sp"></span><button class="pri" id="sbDetClose">Done</button></div></div>', true); const close = () => A.closeDlg(); document.getElementById('sbDetClose').onclick = close; }

  /* ---------------- the reader ---------------- */
  function ensureReader() {
    if (reader) return reader;
    reader = document.createElement('div'); reader.className = 'sb-reader';
    reader.innerHTML = '<div class="sb-r-top"><span class="sb-r-title" id="sbRTitle"></span><span class="sp"></span><button data-r="full" title="Full screen">⛶</button><button data-r="print" title="Print this book">🖨 Print</button><button data-r="close" title="Close the reader">✕ Close</button></div>' +
      '<div class="sb-r-stage"><div class="sb-rbook" id="sbRBook"></div></div>' +
      '<div class="sb-r-bottom"><button data-r="prev">← Back</button><div class="sb-rbar"><i id="sbRBar"></i></div><span id="sbRCount"></span><span class="sp"></span><button data-r="read" id="sbRRead">🔊 Read to me</button><button class="pri" data-r="next" id="sbRNext">Next →</button></div>';
    document.body.appendChild(reader);
    reader.addEventListener('click', e => { const b = e.target.closest('[data-r]'); if (b) readerAction(b.dataset.r); });
    window.addEventListener('keydown', readerKey, true);
    return reader;
  }
  function readerAction(a) {
    if (a === 'close') return closeReader();
    if (a === 'prev') return readerGo(-1);
    if (a === 'next') return readerGo(1);
    if (a === 'read') return toggleRead();
    if (a === 'print') return printBook();
    if (a === 'full') { if (document.fullscreenElement) document.exitFullscreen().catch(() => { }); else reader.requestFullscreen && reader.requestFullscreen().catch(() => { }); }
  }
  function openReader(ix) {
    if (!cur) return;
    ensureReader(); readIx = Math.max(0, Math.min(ix == null ? 0 : ix, cur.pages.length)); renderReader();
    reader.classList.add('on'); document.body.style.overflow = 'hidden';
  }
  function closeReader() {
    if (!reader) return; reading = false; try { A.speech && A.speech.stop && A.speech.stop(); } catch (e) { }
    reader.classList.remove('on'); document.body.style.overflow = '';
  }
  function readerGo(d) {
    if (reading) { reading = false; try { A.speech.stop(); } catch (e) { } }
    const next = Math.max(0, Math.min(readIx + d, cur.pages.length));
    if (next === readIx) { if (next === cur.pages.length) A.toast('The end. ✨'); return; }
    readIx = next; renderReader(); readerTurn(d);
  }
  /* the new spread arrives with a small turn of the right-hand page */
  function readerTurn(d) {
    if (!reader || !readIx) return;
    const pages = reader.querySelectorAll('.sb-rpage'), target = pages[pages.length - 1];
    if (target) target.classList.add(d > 0 ? 'turn-next' : 'turn-prev');
  }
  function readerKey(e) {
    if (!reader || !reader.classList.contains('on')) return;
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeReader(); }
    else if (e.key === 'ArrowRight' || e.key === 'PageDown' || (e.key === ' ' && !e.shiftKey)) { e.preventDefault(); e.stopPropagation(); readerGo(1); }
    else if (e.key === 'ArrowLeft' || e.key === 'PageUp' || (e.key === ' ' && e.shiftKey)) { e.preventDefault(); e.stopPropagation(); readerGo(-1); }
    else if (e.key === 'Home') { e.preventDefault(); e.stopPropagation(); readIx = 0; renderReader(); }
    else if (e.key === 'End') { e.preventDefault(); e.stopPropagation(); readIx = cur.pages.length; renderReader(); readerTurn(1); }
    else if (e.key === 'r' || e.key === 'R') { e.preventDefault(); e.stopPropagation(); toggleRead(); }
  }
  function renderReader() {
    if (!reader || !cur) return;
    const book = reader.querySelector('#sbRBook'), title = reader.querySelector('#sbRTitle');
    title.textContent = cur.title + (cur.author ? ' · ' + cur.author : '');
    if (readIx === 0) {
      const a = projectArt(cur);
      book.innerHTML = '<div class="sb-rpage left sb-rcover"><div class="sb-rinner"><div style="font-size:40px">' + (cur.layout === 'comic' ? '💥' : '📖') + '</div><h2>' + esc(cur.title) + '</h2>' + (cur.subtitle ? '<p class="sb-rsub">' + esc(cur.subtitle) + '</p>' : '') + (cur.author ? '<p class="sb-rsub">by ' + esc(cur.author) + '</p>' : '') + '<div class="sb-rpg">A ' + (cur.layout === 'comic' ? 'comic' : 'picture book') + ' for ages ' + esc(cur.age) + '</div></div></div>' +
        '<div class="sb-rpage right sb-rcover"><div class="sb-rinner">' + (a ? '<div class="sb-rcoverart"><img src="' + esc(a) + '" alt=""></div>' : '<div style="font-size:64px">✦</div>') + '<p class="sb-rsub">' + cur.pages.length + ' pages · ' + (cur.layout === 'comic' ? 'panels and speech bubbles' : 'pictures and story') + '</p></div><div class="sb-rpg">' + (cur.pages.length + 1) + '</div></div>';
    } else {
      const pg = cur.pages[readIx - 1];
      if (cur.layout === 'comic') {
        const panels = pg.panels && pg.panels.length ? pg.panels : [blankPanel()];
        book.innerHTML = '<div class="sb-rpage left"><div class="sb-rinner"><div class="sb-rsub">Page ' + readIx + '</div><h2 class="sb-rtitle">' + esc(pg.title || '') + '</h2><div class="sb-mini" style="font-size:13px;line-height:1.6;color:#5b4b66">' + esc(narrationText(pg)) + '</div></div><div class="sb-rpg">' + readIx + '</div></div>' +
          '<div class="sb-rpage right"><div class="sb-rcomic ' + esc(pg.grid) + '">' + panels.map((x, n) => '<div class="sb-panel">' + (x.art && x.art.src ? '<img src="' + esc(x.art.src) + '" alt="">' : '<div class="sb-panelph">Panel ' + (n + 1) + '</div>') + (x.caption ? '<div class="sb-cap">' + esc(x.caption) + '</div>' : '') + (x.dialogue ? '<div class="sb-bub' + (n % 2 ? ' r' : '') + '">' + esc(x.dialogue) + '</div>' : '') + '<div class="sb-pn2">' + (n + 1) + '</div></div>').join('') + '</div><div class="sb-rpg">' + readIx + '</div></div>';
      } else {
        book.innerHTML = '<div class="sb-rpage left">' + (pg.art && pg.art.src ? '<div class="sb-rart"><img src="' + esc(pg.art.src) + '" alt=""></div>' : '<div class="sb-rart"><div style="text-align:center;padding:20px;line-height:1.6">🎨<br><b>No illustration yet</b><br><span class="small">Draw one in the editor.</span></div></div>') + '<div class="sb-rpg">' + readIx + '</div></div>' +
          '<div class="sb-rpage right"><div class="sb-rinner"><h2 class="sb-rtitle">' + esc(pg.title || '') + '</h2><div class="sb-rtext">' + esc(pg.text || '') + '</div></div><div class="sb-rpg">' + readIx + '</div></div>';
      }
    }
    reader.querySelector('#sbRBar').style.width = Math.round(readIx / Math.max(1, cur.pages.length) * 100) + '%';
    reader.querySelector('#sbRCount').textContent = readIx === 0 ? 'Cover' : 'Page ' + readIx + ' of ' + cur.pages.length;
    reader.querySelector('#sbRNext').textContent = readIx >= cur.pages.length ? 'Finish' : 'Next →';
    reader.querySelector('#sbRRead').textContent = reading ? '❚❚ Stop' : '🔊 Read to me';
  }
  async function toggleRead() {
    if (reading) { reading = false; try { A.speech.stop(); } catch (e) { } renderReader(); return; }
    if (!A.speech || !A.speech.speakAsync) return A.toast('Read aloud is not available here.');
    if (!A.speech.available || !A.speech.available()) return A.toast('Read aloud is not available here.');
    reading = true; renderReader();
    while (reading && readIx <= cur.pages.length) {
      const text = readIx === 0 ? (cur.title + '. ' + (cur.subtitle || '') + '. ' + (cur.author ? 'By ' + cur.author + '.' : '')) : narrationText(cur.pages[readIx - 1]);
      if (text && text.trim()) await A.speech.speakAsync(text);
      if (!reading) break;
      if (readIx >= cur.pages.length) { reading = false; break; }
      readIx++; renderReader(); await sleep(450);
    }
    reading = false; renderReader();
  }

  /* ---------------- mount ---------------- */
  function mount(body) {
    root = body;
    body._cleanup = () => { clearTimeout(saveT); try { artJob && artJob.abort(); } catch (e) { } try { A.speech && A.speech.stop && A.speech.stop(); } catch (e) { } if (reader) { reader.classList.remove('on'); } };
    body._onShow = () => { if (pending) { const id = pending; pending = null; openProject(id); } };
    body.onclick = async e => {
      const a = e.target.closest('[data-sb]'), idea = e.target.closest('[data-idea]'), card = e.target.closest('[data-open]'), act = e.target.closest('[data-act]');
      if (idea) return makeIdea(+idea.dataset.idea);
      if (act) {
        e.stopPropagation(); const id = act.dataset.id;
        if (act.dataset.act === 'del') { if (!confirm('Delete this book? This cannot be undone.')) return; await store.del(id); listLibrary(); }
        else if (act.dataset.act === 'dup') { const p = await store.get(id); if (p) { p.id = uid(); p.title = p.title + ' (copy)'; p.createdAt = now(); p.updatedAt = now(); await store.put(p); listLibrary(); A.toast('Made a copy'); } }
        return;
      }
      if (card && !a) return openProject(card.dataset.open);
      if (!a) return;
      const what = a.dataset.sb;
      if (what === 'new-book' || what === 'new-comic') return newDialog(what === 'new-comic' ? 'comic' : 'book');
      if (what === 'import') { const f = root.querySelector('#sbImport'); if (f) f.click(); return; }
      if (what === 'library') { saveNow(); showLibrary(); return; }
      if (what === 'addpage') return addPage(1);
      if (what === 'add3') return addPage(3);
      if (what === 'prevpage') return selectPage(pageIx - 1);
      if (what === 'nextpage') return selectPage(pageIx + 1);
      if (what === 'delpage') return pageAction('del', pageIx);
      if (what === 'listen') return listen();
      if (what === 'writepage') return writePage();
      if (what === 'ai') return aiDialog();
      if (what === 'details') return details();
      if (what === 'read') return openReader(0);
      if (what === 'print') return printBook();
      if (what === 'pdf') return makePdf();
      if (what === 'export') return exportJson();
      if (what === 'exportjson') return exportJson();
      if (what === 'duplicate') return duplicate();
      if (what === 'addpanel') { const pg = selectedPage(); pg.panels = pg.panels || []; pg.panels.push(blankPanel()); touch(); renderStage(); renderInspector(); return; }
      if (what === 'cancelart') { try { artJob && artJob.abort(); } catch (e) { } return; }
    };
    body.addEventListener('click', async e => {
      const art = e.target.closest('[data-art]'); if (art) { const pg = selectedPage(); if (!pg) return; if (art.dataset.art === 'panel') return illustrate(pg, pg.panels[+art.dataset.panel]); return illustrate(pg); }
      const del = e.target.closest('[data-artdel]'); if (del) { const pg = selectedPage(); if (!pg) return; if (del.dataset.artdel === 'panel') { const p = pg.panels[+del.dataset.panel]; if (p) p.art = null; } else pg.art = null; touch(); renderStage(); renderInspector(); return; }
      const pa = e.target.closest('[data-panel-act]'); if (pa) { const pg = selectedPage(), i = +pa.dataset.panel; if (!pg || !pg.panels[i]) return; const act = pa.dataset.panelAct; if (act === 'del') pg.panels.splice(i, 1); else if (act === 'up' && i > 0) { const p = pg.panels.splice(i, 1)[0]; pg.panels.splice(i - 1, 0, p); } else if (act === 'down' && i < pg.panels.length - 1) { const p = pg.panels.splice(i, 1)[0]; pg.panels.splice(i + 1, 0, p); } touch(); renderStage(); renderInspector(); }
    });
    body.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target && e.target.id === 'sbTitle') { e.target.blur(); } });
    if (pending) { const id = pending; pending = null; openProject(id); } else showLibrary();
  }

  A.storybook = {
    open(id) { pending = id || null; A.studio.go('storybook'); },
    create(layout) { pending = null; A.studio.go('storybook'); setTimeout(() => newDialog(layout), 260); },
    list: () => store.list(),
    async get(id) { return store.get(id); }
  };
  A.studio.reg('storybook', '📖 Storybook & comic', mount, 4);
})();

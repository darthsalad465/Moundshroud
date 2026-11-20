// Photos tab: your pictures, by month, searchable in plain words.
// Files stay where they are. Previews are made here in the window and kept in data\photo-thumbs; "Describe my
// photos" has the local AI look at each one and write a sentence and keywords, so "beach", "birthday cake" or
// "dog in the snow" find them. Nothing leaves this PC. OneDrive files that are only in the cloud are not opened.
(() => {
  const root = document.getElementById('p-photos'); if (!root) return;
  let ALL = [], st = { q: '', view: 'all', folder: '' }, shown = [], limit = 240, built = false, viewerAt = -1, slide = 0, describing = null;
  const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
  const SYN = { puppy: 'dog', puppies: 'dog', dogs: 'dog', kitten: 'cat', cats: 'cat', kid: 'child', kids: 'child', children: 'child', baby: 'child', car: 'car', cars: 'car', sea: 'beach', ocean: 'beach', shore: 'beach', snowy: 'snow', mountains: 'mountain', hills: 'mountain', flowers: 'flower', trees: 'tree', people: 'person', friends: 'person', selfie: 'person', food: 'food', meal: 'food', dinner: 'food', lunch: 'food', screenshot: 'screenshot', screenshots: 'screenshot', sunset: 'sunset', sunrise: 'sunset' };
  const fmtDate = t => new Date(t).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
  const size = b => b > 1048576 ? (b / 1048576).toFixed(1) + ' MB' : Math.round(b / 1024) + ' KB';

  function build() {
    built = true;
    root.innerHTML = '<div class="ph-top"><h2 style="margin:0">🖼️ Photos</h2><input id="phq" placeholder="Search in plain words: beach, dog, birthday, 2023, June…" style="flex:1;min-width:200px"><span id="phv"></span><button class="ib" id="phai" title="Have your local AI look at each photo and describe it, so you can search by what is in it">✨ Describe my photos</button><button class="ib" id="phset" title="Which folders are shown">⚙ Folders</button></div><div id="phstat" class="small mute" style="padding:0 16px 6px"></div><div id="phgrid" class="ph-grid"></div>';
    const qi = root.querySelector('#phq'); qi.value = st.q; let t; qi.oninput = () => { clearTimeout(t); t = setTimeout(() => { st.q = qi.value; limit = 240; paint(); }, 180); };
    root.querySelector('#phset').onclick = settings;
    root.querySelector('#phai').onclick = () => describing ? stopDescribe() : describe();
    root.querySelector('#phgrid').onclick = e => {
      const tile = e.target.closest('[data-i]'); if (!tile) return;
      if (e.target.closest('[data-fav]')) { const x = shown[+tile.dataset.i]; toggleFav(x); e.target.closest('[data-fav]').textContent = x.fav ? '★' : '☆'; return; }
      openViewer(+tile.dataset.i);
    };
  }
  const views = () => '<span class="ph-chips">' + [['all', 'All'], ['fav', '★ Favourites'], ['new', 'Not described yet'], ['folders', '📁 By folder']].map(([k, l]) => '<button class="ib' + (st.view === k ? ' on' : '') + '" data-pv="' + k + '">' + l + '</button>').join('') + '</span>';

  async function load(rescan) {
    if (rescan) await A.api('/api/photos/scan', {}).catch(() => { });
    let r = await A.api('/api/photos').catch(() => null);
    if (r && !r.at && !r.scanning) { root.querySelector('#phstat').textContent = 'Looking for your photos for the first time…'; await A.api('/api/photos/scan', {}).catch(() => { }); r = await A.api('/api/photos'); }
    ALL = (r && r.items) || [];
    root.querySelector('#phstat').dataset.folders = JSON.stringify((r && r.folders) || []);
    paint();
  }

  /* plain-word search over what the AI saw, the file name, the folder and the date */
  function matches(x, toks) {
    const cap = x.cap ? (x.cap.c + ' ' + x.cap.k.join(' ')).toLowerCase() : '', hay = cap + ' ' + x.n.toLowerCase() + ' ' + x.d.toLowerCase(), d = new Date(x.t);
    return toks.every(tk => {
      if (/^(19|20)\d\d$/.test(tk)) return d.getFullYear() === +tk;
      const mi = MONTHS.findIndex(m => m === tk || (tk.length >= 3 && m.startsWith(tk))); if (mi >= 0 && tk.length >= 3) return d.getMonth() === mi;
      if (tk === 'today') return d.toDateString() === new Date().toDateString();
      const w = SYN[tk] || tk; return hay.includes(w) || hay.includes(tk.replace(/s$/, ''));
    });
  }
  function filtered() {
    const toks = st.q.toLowerCase().split(/[\s,]+/).filter(t => t && !/^(of|the|a|an|in|on|with|and|my|photos?|pictures?|from)$/.test(t));
    return ALL.filter(x => (st.view !== 'fav' || x.fav) && (st.view !== 'new' || (!x.cap && x.show && !x.cloud)) && (!st.folder || (x.root + '\\' + x.d) === st.folder) && (!toks.length || matches(x, toks)));
  }

  let io = null;
  function paint() {
    const g = root.querySelector('#phgrid'); if (!g) return;
    root.querySelector('#phv').innerHTML = views();
    root.querySelectorAll('[data-pv]').forEach(b => b.onclick = () => { st.view = b.dataset.pv; st.folder = ''; limit = 240; paint(); });
    const desc = ALL.filter(x => x.cap).length, cloud = ALL.filter(x => x.cloud).length;
    if (st.view === 'folders' && !st.folder) return paintFolders(g);
    shown = filtered();
    root.querySelector('#phstat').innerHTML = (ALL.length ? ALL.length + ' photos · ' + desc + ' described by the AI' + (cloud ? ' · ' + cloud + ' only in OneDrive (☁, opened only when you click)' : '') : 'No photos found. Press ⚙ Folders to choose where your pictures are.') + (st.q || st.view !== 'all' ? ' · <b>' + shown.length + ' shown</b>' : '') + (st.folder ? ' · <a href="#" id="phback">← all folders</a>' : '') + (st.q && !desc ? ' · <span style="color:var(--warn)">Search only knows file names and dates until the AI has described your photos.</span>' : '');
    const bk = root.querySelector('#phback'); if (bk) bk.onclick = e => { e.preventDefault(); st.folder = ''; paint(); };
    let html = '', last = '';
    shown.slice(0, limit).forEach((x, i) => {
      const d = new Date(x.t), mk = d.getFullYear() + '-' + d.getMonth();
      if (mk !== last) { last = mk; const n = shown.filter(y => { const e = new Date(y.t); return e.getFullYear() === d.getFullYear() && e.getMonth() === d.getMonth(); }).length; html += '<div class="ph-month">' + d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }) + ' <span class="mute small">' + n + '</span></div>'; }
      html += '<div class="ph-tile" data-i="' + i + '" tabindex="0" title="' + esc(x.n + (x.cap ? '\n' + x.cap.c : '')) + '">' + (x.th ? '<img loading="lazy" src="/api/photos/thumb?id=' + x.id + '" alt="">' : '<span class="ph-ph" data-need="' + x.id + '">' + (x.cloud ? '☁' : x.show ? '' : 'HEIC') + '</span>') + '<button class="ph-fav" data-fav title="Favourite">' + (x.fav ? '★' : '☆') + '</button></div>';
    });
    if (shown.length > limit) html += '<div id="phmore" class="mute" style="grid-column:1/-1;text-align:center;padding:20px">Loading more…</div>';
    g.innerHTML = html || (ALL.length ? '<div class="mute" style="padding:30px">Nothing matches.</div>' : '');
    if (io) io.disconnect();
    io = new IntersectionObserver(es => es.forEach(e => {
      if (!e.isIntersecting) return; io.unobserve(e.target);
      if (e.target.id === 'phmore') { limit += 240; paint(); return; }
      const id = e.target.dataset.need, x = ALL.find(y => y.id === id); if (x && x.show && !x.cloud) queueThumb(x, e.target);
    }), { root: g, rootMargin: '400px' });
    g.querySelectorAll('[data-need]').forEach(el => io.observe(el)); const more = g.querySelector('#phmore'); if (more) io.observe(more);
  }
  function paintFolders(g) {
    const by = {}; ALL.forEach(x => { const k = x.root + '\\' + x.d; (by[k] = by[k] || []).push(x); });
    const keys = Object.keys(by).sort((a, b) => by[b][0].t - by[a][0].t);
    root.querySelector('#phstat').textContent = keys.length + ' folders';
    g.innerHTML = keys.map(k => { const c = by[k].find(x => x.th) || by[k][0]; return '<div class="ph-tile ph-folder" data-f="' + esc(k) + '">' + (c.th ? '<img loading="lazy" src="/api/photos/thumb?id=' + c.id + '" alt="">' : '<span class="ph-ph">📁</span>') + '<div class="ph-fl"><b>' + esc(k.split('\\').filter(Boolean).slice(-1)[0] || k) + '</b><span>' + by[k].length + '</span></div></div>'; }).join('');
    g.querySelectorAll('[data-f]').forEach(t => t.onclick = e => { e.stopPropagation(); st.folder = t.dataset.f; paint(); });
  }

  /* previews: made from the photo here, once, then kept */
  const tq = []; let tbusy = 0;
  function queueThumb(x, el) { tq.push([x, el]); pump(); }
  async function pump() {
    while (tbusy < 2 && tq.length) {
      const [x, el] = tq.shift(); if (x.th) continue; tbusy++;
      makeThumb(x).then(ok => { if (ok && el.isConnected) el.outerHTML = '<img src="/api/photos/thumb?id=' + x.id + '" alt="">'; }).finally(() => { tbusy--; pump(); });
    }
  }
  async function shrink(id, max, q) {
    const b = await (await fetch('/api/photos/file?id=' + id)).blob();
    const bm = await createImageBitmap(b); const k = Math.min(1, max / Math.max(bm.width, bm.height)), w = Math.max(1, Math.round(bm.width * k)), h = Math.max(1, Math.round(bm.height * k));
    const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, w, h); g.drawImage(bm, 0, 0, w, h); bm.close && bm.close();
    return new Promise(r => c.toBlob(r, 'image/jpeg', q));
  }
  async function makeThumb(x) {
    try { const blob = await shrink(x.id, 360, .82); const r = await fetch('/api/photos/thumb/save?id=' + x.id, { method: 'POST', body: blob }).then(r => r.json()); if (r.ok) { x.th = true; return true; } } catch (e) { }
    return false;
  }

  function toggleFav(x) { x.fav = !x.fav; A.api('/api/photos/fav', { id: x.id, on: x.fav }); }

  /* ---------- the viewer ---------- */
  function openViewer(i) {
    viewerAt = i; let o = document.getElementById('phview');
    if (!o) { o = document.createElement('div'); o.id = 'phview'; o.className = 'ph-view'; o.setAttribute('role', 'dialog'); document.body.appendChild(o); }
    drawViewer();
  }
  function closeViewer() { const o = document.getElementById('phview'); if (o) o.remove(); viewerAt = -1; clearInterval(slide); slide = 0; document.removeEventListener('keydown', vkey, true); }
  function vkey(e) {
    if (viewerAt < 0) return;
    if (e.target && /^(TEXTAREA|INPUT)$/.test(e.target.tagName)) return;      // typing a question: arrows move the cursor
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeViewer(); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); step(1); } else if (e.key === 'ArrowLeft') { e.preventDefault(); step(-1); }
  }
  function step(d) { if (!shown.length) return; viewerAt = (viewerAt + d + shown.length) % shown.length; drawViewer(); }
  function drawViewer() {
    const o = document.getElementById('phview'), x = shown[viewerAt]; if (!o || !x) return closeViewer();
    document.removeEventListener('keydown', vkey, true); document.addEventListener('keydown', vkey, true);
    const pic = x.cloud && !x.load ? '<div class="ph-cloud">☁ This photo is only in OneDrive.<br><button class="pri" id="pvload">Download it and show it</button></div>' : x.show ? '<img src="/api/photos/file?id=' + x.id + '" alt="">' : '<div class="ph-cloud">Windows’ HEIC photos cannot be shown here. <button class="ib" id="pvrev">Show it in its folder</button></div>';
    o.innerHTML = '<div class="ph-stage">' + pic + '<button class="ph-nav l" id="pvp" title="Previous (←)">‹</button><button class="ph-nav r" id="pvn" title="Next (→)">›</button></div>' +
      '<aside class="ph-info"><div style="display:flex;gap:6px;justify-content:flex-end"><button class="ib" id="pvx" title="Close (Esc)">✕</button></div><h3 style="margin:6px 0 2px;word-break:break-word">' + esc(x.n) + '</h3><div class="small mute">' + fmtDate(x.t) + (x.ex ? ' · taken' : ' · file date') + ' · ' + size(x.s) + '</div><div class="small mute" style="margin:2px 0 10px;word-break:break-all">' + esc(x.root + (x.d ? '\\' + x.d : '')) + '</div>' +
      (x.cap ? '<div class="card small" style="line-height:1.5">' + esc(x.cap.c) + '<div style="margin-top:6px">' + x.cap.k.map(k => '<span class="ph-tag" data-tag="' + esc(k) + '">' + esc(k) + '</span>').join('') + '</div></div>' : '') +
      '<div class="ph-acts"><button class="ib" id="pvfav">' + (x.fav ? '★ Favourite' : '☆ Favourite') + '</button>' + (x.show && !x.cloud ? '<button class="ib" id="pvai">✨ ' + (x.cap ? 'Describe again' : 'Describe') + '</button><button class="ib" id="pvz0" title="Scroll wheel zooms, drag pans">🔍 Reset zoom</button>' : '') + '<button class="ib" id="pvrev2">📂 Show in folder</button><button class="ib" id="pvslide">' + (slide ? '⏸ Stop slideshow' : '▶ Slideshow') + '</button><button class="ib" id="pvhide" title="Take it out of this library. The file itself is not touched.">🙈 Hide from Photos</button></div>' +
      '<div id="pvexif" class="small mute" style="margin-top:8px"></div>' +
      (x.show && !x.cloud ? '<div class="ph-chat"><div style="font-weight:600;margin:14px 0 6px">💬 Ask about this photo</div><div id="pvmsgs" class="ph-msgs"></div><div style="display:flex;gap:6px;margin-top:6px"><textarea id="pvq" rows="2" style="flex:1;min-width:0" placeholder="What breed is the dog? Where could this be?  (Enter to send)"></textarea><button class="pri" id="pvsend">Ask</button></div><div class="small mute" style="margin-top:4px">Answered by an AI on this PC. The photo never leaves it.</div></div>' : '') +
      '<div class="small mute" style="margin-top:10px">' + (viewerAt + 1) + ' of ' + shown.length + ' · ← → to move · Esc to close</div></aside>';
    const on = (id, f) => { const b = o.querySelector(id); if (b) b.onclick = f; };
    on('#pvx', closeViewer); on('#pvp', () => step(-1)); on('#pvn', () => step(1));
    on('#pvfav', () => { toggleFav(x); drawViewer(); paintSoon(); });
    on('#pvload', () => { x.load = true; drawViewer(); });
    const rev = () => A.api('/api/photos/reveal', { id: x.id }); on('#pvrev', rev); on('#pvrev2', rev);
    on('#pvslide', () => { if (slide) { clearInterval(slide); slide = 0; } else slide = setInterval(() => step(1), 4000); drawViewer(); });
    on('#pvhide', async () => { if (!(await A.confirm('Hide “' + x.n + '” from Photos? The file stays exactly where it is.'))) return; await A.api('/api/photos/hide', { id: x.id }); ALL = ALL.filter(y => y !== x); shown = shown.filter(y => y !== x); if (viewerAt >= shown.length) viewerAt = shown.length - 1; drawViewer(); paintSoon(); });
    on('#pvai', async () => { const b = o.querySelector('#pvai'); b.disabled = true; b.textContent = '✨ Looking…'; const m = await visionModel(); if (!m) { b.textContent = 'No AI model that can see is installed'; return; } const ok = await describeOne(x, m); if (!ok) b.textContent = 'The AI could not describe it'; else drawViewer(); });
    o.querySelectorAll('[data-tag]').forEach(t => t.onclick = () => { closeViewer(); st.q = t.dataset.tag; root.querySelector('#phq').value = st.q; st.view = 'all'; paint(); });
    /* pan & zoom (Panzoom) + camera EXIF/GPS inspector (exifr) */
    const imgEl = o.querySelector('.ph-stage img');
    if (imgEl && typeof window.Panzoom === 'function') {
      try {
        const pz = window.Panzoom(imgEl, { maxScale: 6, minScale: 1, contain: 'outside' });
        const stg = o.querySelector('.ph-stage');
        stg.addEventListener('wheel', pz.zoomWithWheel, { passive: false });
        on('#pvz0', () => pz.reset());
      } catch (e) { }
    }
    if (x.show && !x.cloud && window.exifr && typeof window.exifr.parse === 'function') {
      window.exifr.parse('/api/photos/file?id=' + x.id).then(ex => {
        const box = o.querySelector('#pvexif'); if (!box || !box.isConnected || !ex) return;
        const bits = [];
        if (ex.Make || ex.Model) bits.push('📷 ' + [ex.Make, ex.Model].filter(Boolean).join(' '));
        if (ex.LensModel) bits.push(ex.LensModel);
        const exp = [ex.FocalLength && Math.round(ex.FocalLength) + 'mm', ex.FNumber && 'f/' + ex.FNumber, ex.ExposureTime && (ex.ExposureTime < 1 ? '1/' + Math.round(1 / ex.ExposureTime) + 's' : ex.ExposureTime + 's'), ex.ISO && 'ISO ' + ex.ISO].filter(Boolean);
        if (exp.length) bits.push(exp.join(' · '));
        if (ex.latitude != null && ex.longitude != null) bits.push('<span style="color:var(--warn)">📍 GPS embedded (' + ex.latitude.toFixed(4) + ', ' + ex.longitude.toFixed(4) + ')</span>');
        if (bits.length) box.innerHTML = '<div class="card small" style="padding:8px 10px;line-height:1.5">' + bits.map(b => b.startsWith('<span') ? b : esc(b)).join('<br>') + '</div>';
      }).catch(() => { });
    }
    o.onclick = e => { if (e.target === o || e.target.classList.contains('ph-stage')) closeViewer(); };
    if (o.querySelector('#pvq')) chatWire(o, x);
  }

  /* ---------- a conversation about one photo: the picture goes with the first question, later questions follow on ----------
     one conversation per photo, kept while Moundshroud is open; always a local model that can see, never Claude */
  const chats = new Map();
  const chatOf = x => { if (!chats.has(x.id)) chats.set(x.id, { msgs: [], busy: false, ctl: null }); return chats.get(x.id); };
  function chatPaint(o, x) {
    const box = o.querySelector('#pvmsgs'); if (!box) return; const c = chatOf(x);
    box.innerHTML = c.msgs.map(m => '<div class="ph-msg ' + (m.role === 'user' ? 'me' : 'ai') + '">' + (m.role === 'assistant' && m.content && typeof md === 'function' ? md(m.content) : esc(m.content || (m.role === 'assistant' && c.busy ? 'Looking…' : ''))) + '</div>').join('');
    box.style.display = c.msgs.length ? '' : 'none'; box.scrollTop = box.scrollHeight;
    const s = o.querySelector('#pvsend'); if (s) { s.textContent = c.busy ? '■ Stop' : 'Ask'; }
  }
  function chatWire(o, x) {
    const q = o.querySelector('#pvq'), c = chatOf(x); chatPaint(o, x);
    const live = () => shown[viewerAt] === x && document.getElementById('phview') === o;
    async function ask() {
      if (c.busy) { if (c.ctl) c.ctl.abort(); return; }
      const t = q.value.trim(); if (!t) return;
      const model = await visionModel();
      if (!model) { A.toast('No AI model that can see pictures is installed. Add one such as Qwen3.5 in Prepare › Stock up.'); return; }
      q.value = ''; c.busy = true; c.ctl = new AbortController();
      const user = { role: 'user', content: t };
      if (!c.msgs.length) { try { const blob = await shrink(x.id, 768, .8); user.images = [await new Promise(r => { const f = new FileReader(); f.onload = () => r(String(f.result).split(',')[1]); f.readAsDataURL(blob); })]; } catch (e) { c.busy = false; A.toast('Could not read this photo.'); return; } }
      const ans = { role: 'assistant', content: '' }; c.msgs.push(user, ans); if (live()) chatPaint(o, x);
      const sys = { role: 'system', content: 'You are looking at one photo with the user and answering questions about it. Answer from what you can see, in plain short sentences. Say so when you are unsure. Do not guess the names of people.' + ' File: ' + x.n + ', ' + fmtDate(x.t) + '.' + (x.cap ? ' An earlier look described it as: ' + x.cap.c : '') };
      try { await A.ai.stream([sys].concat(c.msgs.slice(0, -1).map(m => m.images ? { role: m.role, content: m.content, images: m.images } : { role: m.role, content: m.content })), txt => { ans.content = txt; if (live()) chatPaint(o, x); }, c.ctl.signal, { model, temp: .4 }); }
      catch (e) { if (!ans.content) ans.content = e.name === 'AbortError' ? '(stopped)' : 'The AI could not answer: ' + (e.message || e); }
      if (!ans.content) ans.content = 'The AI gave no answer. Try asking again.';
      c.busy = false; c.ctl = null; if (live()) chatPaint(o, x);
    }
    o.querySelector('#pvsend').onclick = ask;
    q.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); ask(); } else if (e.key === 'Escape') { e.preventDefault(); q.blur(); } });
  }
  let ps = 0; const paintSoon = () => { clearTimeout(ps); ps = setTimeout(paint, 300); };

  /* ---------- the AI describes what is in each photo ---------- */
  async function visionModel() {
    const saved = ls.get('ph_model', ''); let ms = [];
    try { ms = ((await A.api('/api/models')).models || []).filter(m => !m.cloud).map(m => m.name); } catch (e) { }
    if (saved && ms.includes(saved)) return saved;
    const cur = A.ai.model(), order = [cur].concat(ms.filter(m => m !== cur));
    for (const m of order) { if (!m || /cloud|claude/i.test(m)) continue; try { if ((await A.api('/api/modelcaps?name=' + encodeURIComponent(m))).vision) { ls.set('ph_model', m); return m; } } catch (e) { } }
    return '';
  }
  const PROMPT = 'Look at this photo. Reply with JSON only: {"caption": "one plain sentence saying what is in the photo, where it seems to be and what is happening", "tags": ["8 to 15 single lowercase words someone might search for: objects, animals, people (e.g. person, child, group), place, season, weather, colours, event, text if it is a screenshot or document"]}. Do not guess names of people.';
  async function describeOne(x, model) {
    try {
      const blob = await shrink(x.id, 768, .8), b64 = await new Promise(r => { const f = new FileReader(); f.onload = () => r(String(f.result).split(',')[1]); f.readAsDataURL(blob); });
      const t = await A.ai.once([{ role: 'user', content: PROMPT, images: [b64] }], { model, temp: .2 });
      const j = A.ai.json(t) || { caption: String(t || '').replace(/\s+/g, ' ').slice(0, 300), tags: [] };
      if (!j.caption) return false;
      const tags = (Array.isArray(j.tags) ? j.tags : String(j.tags || '').split(',')).map(s => String(s).trim().toLowerCase()).filter(Boolean);
      await A.api('/api/photos/caption', { id: x.id, text: j.caption, tags, model });
      x.cap = { c: j.caption, k: tags, m: model }; return true;
    } catch (e) { return false; }
  }
  async function describe() {
    const todo = ALL.filter(x => !x.cap && x.show && !x.cloud);
    if (!todo.length) return A.toast('Every photo here has been described already.');
    if (A.power && A.power.on && !(await A.confirm('Low-power mode is on. Describing photos keeps the AI busy and uses the battery. Go ahead?'))) return;
    const m = await visionModel(); if (!m) return A.dlg('<div class="hd"><b>No AI model that can see pictures</b></div><div class="bd"><p>Describing photos needs a model that understands images, such as Qwen3.5. Install one in Prepare › Stock up › AI models, then try again.</p><div class="row"><span class="sp"></span><button class="pri" onclick="A.closeDlg()">OK</button></div></div>');
    if (todo.length > 30 && !(await A.confirm('Your local AI will look at ' + todo.length + ' photos, one at a time (roughly ' + Math.max(1, Math.round(todo.length * 6 / 60)) + ' minutes or more on this PC). You can keep using Moundshroud and stop any time. Start?'))) return;
    describing = { stop: false }; const b = root.querySelector('#phai'), t0 = Date.now(); let n = 0, fail = 0;
    for (const x of todo) {
      if (describing.stop) break;
      b.textContent = '⏸ Stop (' + n + ' of ' + todo.length + (n ? ', about ' + Math.max(1, Math.round((Date.now() - t0) / n * (todo.length - n) / 60000)) + ' min left' : '') + ')';
      if (await describeOne(x, m)) n++; else if (++fail > 5 && !n) { A.toast('The AI is not answering. Try again later.'); break; }
      if (n % 10 === 0) paintSoon();
    }
    describing = null; b.textContent = '✨ Describe my photos'; paint();
    A.toast(n + ' photo' + (n === 1 ? '' : 's') + ' described. Search now finds what is in them.');
  }
  function stopDescribe() { if (describing) describing.stop = true; }

  /* ---------- folders ---------- */
  async function settings() {
    let folders = []; try { folders = JSON.parse(root.querySelector('#phstat').dataset.folders || '[]'); } catch (e) { }
    const s = await A.api('/api/photos/stats').catch(() => ({}));
    const draw = () => {
      A.dlg('<div class="hd"><b>📁 Photo folders</b></div><div class="bd"><div class="small mute" style="margin-bottom:8px;line-height:1.5">Photos shows the pictures in these folders and every folder inside them. Nothing is moved, copied or changed: Moundshroud only reads them.</div>' +
        (folders.length ? folders.map((f, i) => '<div class="row" style="padding:3px 0"><span style="flex:1;word-break:break-all">' + esc(f) + '</span><button class="ib" data-rm="' + i + '">Remove</button></div>').join('') : '<div class="mute">No folders yet.</div>') +
        '<div class="row" style="margin-top:8px"><button class="ib" id="phaddf">＋ Add a folder…</button><button class="ib" id="phrescan">↻ Look again for new photos</button></div>' +
        '<h3 style="margin-top:14px">Kept by Moundshroud</h3><div class="small mute">' + (s.photos || 0) + ' photos indexed · previews ' + (s.thumbsMB || 0) + ' MB · ' + (s.described || 0) + ' described by the AI</div><div class="row" style="margin-top:6px"><button class="ib" id="phfth">Delete the previews</button><button class="ib" id="phfcap">Forget the AI descriptions</button></div>' +
        '<div class="row" style="margin-top:12px"><span class="sp"></span><button class="pri" id="phok">Done</button></div></div>');
      const d = document.getElementById('dlg');
      d.querySelectorAll('[data-rm]').forEach(b => b.onclick = () => { folders.splice(+b.dataset.rm, 1); draw(); });
      d.querySelector('#phaddf').onclick = async () => { const r = await A.api('/api/pick-folder', {}); if (r && r.path) { folders.push(r.path); draw(); } };
      d.querySelector('#phrescan').onclick = async () => { A.closeDlg(); root.querySelector('#phstat').textContent = 'Looking for new photos…'; await load(true); };
      d.querySelector('#phfth').onclick = async () => { if (!(await A.confirm('Delete all the preview pictures? Your photos are not touched; previews are made again as you scroll.'))) return; await A.api('/api/photos/forget', { what: 'thumbs' }); ALL.forEach(x => x.th = false); A.closeDlg(); paint(); };
      d.querySelector('#phfcap').onclick = async () => { if (!(await A.confirm('Forget every description the AI wrote? Search will only know file names and dates again.'))) return; await A.api('/api/photos/forget', { what: 'captions' }); ALL.forEach(x => x.cap = null); A.closeDlg(); paint(); };
      d.querySelector('#phok').onclick = async () => { A.closeDlg(); root.querySelector('#phstat').textContent = 'Updating…'; await A.api('/api/photos/folders', { folders }); setTimeout(() => load(), 400); };
    };
    draw();
  }

  A.photos = { search: q => { st.q = q || ''; st.view = 'all'; st.folder = ''; A.showTab('photos'); const i = root.querySelector('#phq'); if (i) { i.value = st.q; paint(); } } };
  A.registerTab('photos', 'Photos', () => { if (!built) { build(); load(); } else if (!ALL.length) load(); });
  try { if (A.cmd && A.cmd.reg) A.cmd.reg([{ title: 'Photos', sub: 'Your pictures by month, searchable in plain words', icon: '🖼️', group: 'Go to', tags: 'photos pictures images gallery camera', run: () => A.showTab('photos') }, { title: 'Describe my photos', sub: 'The local AI looks at each photo so search finds what is in it', icon: '✨', group: 'Do', tags: 'photos describe ai caption tag', run: () => { A.showTab('photos'); setTimeout(() => root.querySelector('#phai') && root.querySelector('#phai').click(), 400); } }]); } catch (e) { }
})();

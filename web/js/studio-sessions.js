// Studio's AI tools as conversations, laid out like Chat › Agent (and the Claude Code app): sessions on the left (new,
// search, switch, forget), the conversation in the middle (what you asked, then each result as a card), and the message box
// at the bottom with the tool's own choices as chips. Used by 🖼️ AI art (draw, or attach a photo to edit it), 🎵 AI music
// and 🎬 AI video.
// Work never stops when you look away: every request is a job in one queue that lives outside the page (the graphics
// card does one thing at a time), and its result is saved into its session (IndexedDB 'moundshroud_studio') when it is
// ready, whether or not the page, the session or even the Studio tab is on screen.
(() => {
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const mdx = t => typeof md === 'function' ? md(String(t || '')) : esc(t);
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const ago = t => { const s = (Date.now() - t) / 1000; return s < 60 ? 'just now' : s < 3600 ? Math.round(s / 60) + ' min ago' : s < 86400 ? Math.round(s / 3600) + ' h ago' : new Date(t).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }); };

  /* ---------- sessions, kept in this PC's browser database ---------- */
  const DB = () => new Promise((ok, no) => { try { const r = indexedDB.open('moundshroud_studio', 1); r.onupgradeneeded = () => r.result.createObjectStore('s', { keyPath: 'id' }); r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error); } catch (e) { no(e); } });
  const S = {
    async all(tool) { try { const db = await DB(); return await new Promise(ok => { const q = db.transaction('s').objectStore('s').getAll(); q.onsuccess = () => ok((q.result || []).filter(x => !tool || x.tool === tool).sort((a, b) => b.at - a.at)); q.onerror = () => ok([]); }); } catch (e) { return []; } },
    async get(id) { try { const db = await DB(); return await new Promise(ok => { const q = db.transaction('s').objectStore('s').get(id); q.onsuccess = () => ok(q.result || null); q.onerror = () => ok(null); }); } catch (e) { return null; } },
    async put(s) { try { const db = await DB(); await new Promise(ok => { const tx = db.transaction('s', 'readwrite'); tx.objectStore('s').put(s); tx.oncomplete = tx.onerror = tx.onabort = () => ok(); }); } catch (e) { } },
    async del(id) { try { const db = await DB(); await new Promise(ok => { const tx = db.transaction('s', 'readwrite'); tx.objectStore('s').delete(id); tx.oncomplete = tx.onerror = () => ok(); }); } catch (e) { } },
  };
  /* one change at a time per session, so two jobs finishing together never overwrite each other */
  const locks = {};
  async function update(sid, fn) {
    const prev = locks[sid] || Promise.resolve(); let release; locks[sid] = new Promise(r => { release = r; });
    await prev; try { const s = await S.get(sid); if (!s) return null; fn(s); s.at = Date.now(); await S.put(s); return s; } finally { release(); }
  }

  /* ---------- the job queue: one at a time, outside any page ---------- */
  const Q = [], LIVE = {}, listeners = new Set();
  let running = null;
  const emit = (sid, what) => listeners.forEach(f => { try { f(sid, what); } catch (e) { } });
  function enqueue(job) { Q.push(job); LIVE[job.turn] = { t0: 0, note: 'Waiting for the job before it…', ctl: new AbortController() }; emit(job.sid, 'queued'); pump(); }
  async function pump() {
    if (running || !Q.length) return;
    const job = Q.shift(), L = LIVE[job.turn]; running = job; L.t0 = Date.now(); L.note = job.working || 'Working…'; emit(job.sid, 'start');
    let out = null, err = '';
    const ctx = { setJob: id => update(job.sid, s => { const t = s.turns.find(x => x.id === job.turn); if (t) t.job = id; }) };
    try { out = await job.run(job.opts, L.ctl.signal, n => { L.note = n; emit(job.sid, 'progress'); }, ctx); }
    catch (e) { err = L.ctl.signal.aborted ? 'Stopped.' : String(e && e.message || e || 'It did not work.'); }
    const secs = Math.round((Date.now() - L.t0) / 1000);
    await update(job.sid, s => { const t = s.turns.find(x => x.id === job.turn); if (!t) return; if (out) { t.status = 'done'; t.media = out.media || []; t.text = out.text || ''; t.meta = Object.assign({ secs }, out.meta || {}); } else { t.status = 'error'; t.err = err; t.meta = { secs }; } });
    delete LIVE[job.turn]; running = null; emit(job.sid, 'done');
    if (out && A.sshell.onDone) { try { A.sshell.onDone(job, out); } catch (e) { } }
    pump();
  }
  const busy = sid => (running && running.sid === sid) || Q.some(j => j.sid === sid);
  function stop(turn) { const L = LIVE[turn]; if (!L) return; const i = Q.findIndex(j => j.turn === turn); if (i >= 0) { const j = Q.splice(i, 1)[0]; update(j.sid, s => { const t = s.turns.find(x => x.id === turn); if (t) { t.status = 'error'; t.err = 'Stopped before it started.'; } }).then(() => { delete LIVE[turn]; emit(j.sid, 'done'); }); return; } L.ctl.abort(); }
  /* jobs that were running when the window closed cannot be finished: say so, with a button to try again */
  (async () => { await new Promise(r => setTimeout(r, 300)); for (const s of await S.all()) if (s.turns.some(t => t.status === 'working')) { for (const t of s.turns) { if (t.status !== 'working') continue; if (t.job && A.sshell.resumers[s.tool]) { enqueue({ tool: s.tool, sid: s.id, turn: t.id, opts: { job: t.job }, run: A.sshell.resumers[s.tool], working: 'Following the video being made…' }); continue; } t.status = 'error'; t.err = 'Moundshroud was closed while this was being made. Press ↻ to make it again.'; } await S.put(s); } })();

  /* ---------- the page ---------- */
  function mount(host, cfg) {
    let sid = '', sess = null, attach = null, alive = true;
    host.innerHTML = '<div class="agx">' +
      '<aside class="agside"><div class="agsidetop"><button class="agnew" data-k="new">✎ New ' + esc(cfg.noun || 'session') + '</button><input type="search" data-k="q" placeholder="Search"></div><div class="agslist" data-k="list"></div></aside>' +
      '<section class="agmain"><div class="aghead"><button class="ib agtog" data-k="tog" title="Show or hide the list">☰</button><div class="aghtitle"><b data-k="title">' + esc(cfg.title) + '</b><span class="small mute" data-k="sub">' + esc(cfg.sub || '') + '</span></div><span class="agstat" data-k="stat"></span></div>' +
      '<div class="scroll agconv" data-k="conv"><div class="agtx" data-k="msgs"></div></div>' +
      '<div class="agcomp"><div class="agbox"><div data-k="att" class="ssatt" hidden></div><textarea rows="2" data-k="in" placeholder="' + esc(cfg.placeholder) + '"></textarea>' +
      '<div class="agchips">' + (cfg.attach ? '<button class="agchip" data-k="clip" title="' + esc(cfg.attach.title) + '">📎 ' + esc(cfg.attach.label) + '</button><input type="file" data-k="file" accept="' + esc(cfg.attach.accept) + '" hidden>' : '') + '<span data-k="chips" class="sschips"></span><span style="flex:1"></span><button class="agsend" data-k="send" title="Make it (Enter)">↑</button></div></div></div></section></div>';
    const $ = k => host.querySelector('[data-k="' + k + '"]');
    const x = host.querySelector('.agx'), stat = $('stat');      /* kept: its data-k is changed below (the dot's colour), so $('stat') only finds it once */
    $('chips').innerHTML = cfg.chips();
    if (cfg.wire) cfg.wire($('chips'), host);
    /* the list */
    let dl = 0;
    async function drawList() {
      const my = ++dl, q = ($('q').value || '').toLowerCase(), got = await S.all(cfg.tool);
      if (my !== dl) return;      /* an older, slower read must not overwrite a newer list */
      const all = got.filter(s => !q || (s.title + ' ' + s.turns.map(t => t.prompt || '').join(' ')).toLowerCase().includes(q));
      const day0 = new Date(); day0.setHours(0, 0, 0, 0); const gOf = t => t >= +day0 ? 'Today' : t >= +day0 - 864e5 ? 'Yesterday' : t >= +day0 - 7 * 864e5 ? 'Previous 7 days' : 'Older';
      let h = '', last = '';
      for (const s of all) { const g = gOf(s.at); if (g !== last) { h += '<div class="aggrp">' + g + '</div>'; last = g; } h += '<div class="agrow' + (s.id === sid ? ' on' : '') + '" data-sid="' + s.id + '"><div class="agrt">' + (busy(s.id) ? '<span class="agdotlive"></span>' : '') + esc(s.title || 'Untitled') + '</div><div class="agrm">' + s.turns.filter(t => t.role === 'user').length + ' ' + esc(cfg.unit || 'items') + ' · ' + ago(s.at) + '</div><button class="agfx" data-del="' + s.id + '" title="Delete this session">✕</button></div>'; }
      $('list').innerHTML = h || '<div class="small mute" style="padding:10px">Nothing yet. Type below to start.</div>';
    }
    $('q').oninput = drawList;
    $('list').onclick = async e => {
      const d = e.target.closest('[data-del]'); if (d) { e.stopPropagation(); if (busy(d.dataset.del)) return A.toast('That session is still making something.'); if (!(await A.confirm('Delete this session and everything made in it? Pictures saved elsewhere are kept.'))) return; await S.del(d.dataset.del); if (d.dataset.del === sid) { sid = ''; sess = null; drawConv(); } drawList(); return; }
      const r = e.target.closest('[data-sid]'); if (r) { await open(r.dataset.sid); if (x.classList.contains('narrow')) x.classList.remove('sideopen'); }
    };
    $('new').onclick = () => { sid = ''; sess = null; drawConv(); drawList(); $('in').focus(); };
    $('tog').onclick = () => { if (x.classList.contains('narrow')) x.classList.toggle('sideopen'); else x.classList.toggle('sidehide'); };
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => x.classList.toggle('narrow', host.clientWidth < 760)) : null; if (ro) ro.observe(host);
    async function open(id) { sid = id; sess = await S.get(id); drawConv(); drawList(); }
    /* the conversation */
    const urls = new Map(); const urlOf = b => { if (!urls.has(b)) urls.set(b, URL.createObjectURL(b)); return urls.get(b); };
    function turnHtml(t) {
      if (t.role === 'user') return '<div class="aguser">' + esc(t.prompt) + (t.thumb ? '<div><img src="' + t.thumb + '" class="ssthumb"></div>' : '') + (t.label ? '<div class="small mute" style="margin-top:4px">' + esc(t.label) + '</div>' : '') + '</div>';
      const L = LIVE[t.id];
      if (t.status === 'working' || L) return '<div class="sscard"><div class="agspin">✻ ' + esc(L ? L.note : 'Working…') + (L && L.t0 ? ' ' + Math.round((Date.now() - L.t0) / 1000) + 's' : '') + ' <button class="ib" data-stop="' + t.id + '">■ Stop</button></div><div class="small mute">You can switch to anything else: it keeps going and lands here.</div></div>';
      if (t.status === 'error') return '<div class="sscard"><div class="agerr">' + esc(t.err || 'It did not work.') + '</div>' + (t.job && A.sshell.resumers[cfg.tool] ? '<button class="ib" data-resume="' + t.id + '">▶ Resume from where it stopped</button> ' : '') + '<button class="ib" data-redo="' + t.id + '">↻ Try again</button></div>';
      const m = (t.media || []).map((md, i) => md.type === 'image' ? '<img src="' + urlOf(md.blob) + '" class="ssimg" data-open="' + t.id + ':' + i + '">' : md.type === 'audio' ? '<audio controls src="' + urlOf(md.blob) + '" style="width:100%"></audio>' : md.type === 'video' ? '<video controls loop autoplay muted src="' + urlOf(md.blob) + '" class="ssimg"></video>' : '').join('');
      return '<div class="sscard"><div class="agth small"><span class="agdot" style="background:var(--ok)"></span><b>' + esc(cfg.short || cfg.title) + '</b><span class="agarg">' + esc([t.meta && t.meta.engine, t.meta && t.meta.size, t.meta && t.meta.secs != null ? t.meta.secs + ' s' : ''].filter(Boolean).join(' · ')) + '</span></div>' + m +
        (t.text ? '<div class="agtext small">' + mdx(t.text) + '</div>' : '') + '<div class="row ssacts">' + (cfg.actions || []).map(a => '<button class="ib" data-act="' + a[0] + '" data-t="' + t.id + '">' + a[1] + '</button>').join('') + '<button class="ib" data-redo="' + t.id + '" title="Make another version">🎲 Again</button></div></div>';
    }
    function welcome() { return '<div class="agwel"><div class="aglogo">' + cfg.icon + '</div><h2>' + esc(cfg.hello) + '</h2><div class="mute">' + esc(cfg.helloSub) + '</div><div class="agex">' + (cfg.examples || []).map(e => '<span class="chip" data-ex="' + esc(e) + '">' + esc(e) + '</span>').join('') + '</div></div>'; }
    function drawConv() {
      const box = $('msgs'), c = $('conv'), stick = c.scrollHeight - c.scrollTop - c.clientHeight < 160;
      box.innerHTML = sess && sess.turns.length ? sess.turns.map(turnHtml).join('') : welcome();
      $('title').textContent = sess ? sess.title : cfg.title; $('sub').textContent = sess ? new Date(sess.created).toLocaleString() : (cfg.sub || '');
      const b = sess && busy(sess.id); stat.textContent = b ? 'Working' : ''; stat.dataset.k = b ? 'busy' : '';
      if (stick || !sess) c.scrollTop = c.scrollHeight;
    }
    $('msgs').addEventListener('click', async e => {
      const ex = e.target.closest('[data-ex]'); if (ex) { $('in').value = ex.dataset.ex; $('in').focus(); return; }
      const st = e.target.closest('[data-stop]'); if (st) { stop(st.dataset.stop); return; }
      const rs = e.target.closest('[data-resume]'); if (rs && sess) { const t = sess.turns.find(z => z.id === rs.dataset.resume); if (t && t.job) { const r = await A.api('/api/video/long/resume', { id: t.job }).catch(() => null); if (r && !r.ok && !/not stopped/.test(r.error || '')) return A.toast(r.error || 'It could not be resumed.'); sess = await update(sess.id, s => { const x = s.turns.find(z => z.id === t.id); if (x) { x.status = 'working'; x.err = ''; } }); enqueue({ tool: cfg.tool, sid: sess.id, turn: t.id, opts: { job: t.job }, run: A.sshell.resumers[cfg.tool], working: 'Following the video being made…' }); drawConv(); } return; }
      const rd = e.target.closest('[data-redo]'); if (rd && sess) { const i = sess.turns.findIndex(t => t.id === rd.dataset.redo), u = sess.turns.slice(0, i).reverse().find(t => t.role === 'user'); if (u) submit(u.prompt, Object.assign({}, u.opts, { seed: -1 }), u.attach || null); return; }
      const op = e.target.closest('[data-open]'); if (op) { const [tid, i] = op.dataset.open.split(':'), t = sess.turns.find(z => z.id === tid); if (t) window.open(urlOf(t.media[+i].blob), '_blank'); return; }
      const ac = e.target.closest('[data-act]'); if (ac && sess) { const t = sess.turns.find(z => z.id === ac.dataset.t); if (t && cfg.act) cfg.act(ac.dataset.act, t, { attach: (blob, name) => setAttach(blob, name), input: $('in') }); }
    });
    /* attaching (a photo to edit) */
    async function setAttach(blob, name) { if (!blob) { attach = null; $('att').hidden = true; $('att').innerHTML = ''; return; } const thumb = await small(blob, 160); attach = { blob, name: name || 'photo', thumb }; $('att').hidden = false; $('att').innerHTML = '<img src="' + thumb + '"><span class="small">' + esc(attach.name) + '</span><button class="ib" data-k="unatt" title="Remove">✕</button>'; $('att').querySelector('[data-k=unatt]').onclick = () => setAttach(null); if (cfg.onAttach) cfg.onAttach(host, true); $('in').focus(); }
    if (cfg.attach) { $('clip').onclick = () => $('file').click(); $('file').onchange = () => { const f = $('file').files[0]; if (f) setAttach(f, f.name); $('file').value = ''; }; }
    host.addEventListener('dragover', e => { if (cfg.attach) e.preventDefault(); });
    host.addEventListener('drop', e => { if (!cfg.attach) return; e.preventDefault(); const f = [...(e.dataTransfer.files || [])].find(z => /^image\//.test(z.type)); if (f) setAttach(f, f.name); });
    host.addEventListener('paste', e => { if (!cfg.attach) return; const it = [...(e.clipboardData && e.clipboardData.items || [])].find(i => /^image\//.test(i.type)); if (it) { e.preventDefault(); setAttach(it.getAsFile(), 'pasted picture'); } });
    /* sending: a new session is made on the first request */
    async function submit(prompt, opts, att) {
      prompt = String(prompt || '').trim(); if (!prompt) { $('in').focus(); return; }
      if (cfg.check) { const m = await cfg.check(opts, att); if (m) return A.toast(m, 4500); }
      if (!sess) { sess = { id: uid(), tool: cfg.tool, title: prompt.slice(0, 60), created: Date.now(), at: Date.now(), turns: [] }; sid = sess.id; await S.put(sess); }
      const u = { id: uid(), role: 'user', prompt, opts, label: cfg.label ? cfg.label(opts, att) : '', thumb: att ? att.thumb : '', attach: att || null }, r = { id: uid(), role: 'result', status: 'working' };
      sess = await update(sess.id, s => { s.turns.push(u, r); });
      enqueue({ tool: cfg.tool, sid: sess.id, turn: r.id, opts: Object.assign({ prompt, attach: att }, opts), run: cfg.run, working: cfg.working });
      drawConv(); drawList();
    }
    const send = () => { const t = $('in').value; if (!t.trim()) return; const att = attach; submit(t, cfg.read($('chips'), host, att), att); $('in').value = ''; setAttach(null); if (cfg.onAttach) cfg.onAttach(host, false); };
    $('send').onclick = send;
    $('in').addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); send(); } });
    /* live updates from the queue, wherever you are */
    let dc = 0;
    const onJob = async (s, what) => { if (!alive) return; if (s === sid) { const my = ++dc, got = await S.get(sid); if (my === dc && s === sid) { sess = got; drawConv(); } } if (what !== 'progress') drawList(); };
    listeners.add(onJob);
    const tick = setInterval(() => { if (sid && Object.keys(LIVE).length && host.isConnected && !host.closest('[hidden]')) { const sp = host.querySelector('.agspin'); if (sp && sess) { const t = sess.turns.find(z => LIVE[z.id]); if (t) { const L = LIVE[t.id]; sp.firstChild.textContent = '✻ ' + L.note + (L.t0 ? ' ' + Math.round((Date.now() - L.t0) / 1000) + 's ' : ' '); } } } }, 1000);
    host._cleanup = () => { alive = false; listeners.delete(onJob); clearInterval(tick); if (ro) ro.disconnect(); };
    /* something sent here from elsewhere (the Prompt optimizer, a chat picture) */
    host._onShow = () => { if (cfg.takePending) cfg.takePending({ newSession: () => { sid = ''; sess = null; drawConv(); drawList(); }, input: $('in'), attach: setAttach, chips: $('chips') }); };
    (async () => { const all = await S.all(cfg.tool); if (all[0] && !cfg.startFresh) { sid = all[0].id; sess = all[0]; } drawConv(); drawList(); host._onShow(); })();
  }
  async function small(blob, max) { try { const bm = await createImageBitmap(blob), k = Math.min(1, max / Math.max(bm.width, bm.height)), c = document.createElement('canvas'); c.width = Math.round(bm.width * k); c.height = Math.round(bm.height * k); c.getContext('2d').drawImage(bm, 0, 0, c.width, c.height); return c.toDataURL('image/jpeg', .8); } catch (e) { return ''; } }
  A.sshell = { mount, store: S, enqueue, stop, busy, small, live: LIVE, resumers: {} };

  /* ================= the tools ================= */
  const sel = (k, label, opts, val) => '<label class="agchip sssel" title="' + esc(label) + '">' + esc(label) + ' <select data-c="' + k + '">' + opts.map(o => '<option value="' + esc(o[0]) + '"' + (o[0] === val ? ' selected' : '') + '>' + esc(o[1]) + '</option>').join('') + '</select></label>';
  const chk = (k, label, on, title) => '<label class="agchip" title="' + esc(title || '') + '"><input type="checkbox" data-c="' + k + '"' + (on ? ' checked' : '') + '> ' + esc(label) + '</label>';
  const val = (el, k) => { const e = el.querySelector('[data-c="' + k + '"]'); return !e ? undefined : e.type === 'checkbox' ? e.checked : e.value; };
  const remember = (el, key) => el.addEventListener('change', e => { const c = e.target.closest('[data-c]'); if (c) ls.set(key + '_' + c.dataset.c, c.type === 'checkbox' ? (c.checked ? '1' : '0') : c.value); });
  const saved = (key, k, d) => ls.get(key + '_' + k, d);
  /* the pages are read fresh from the disk, the server only when it starts: a server that was running before a part was added answers "not found" */
  const OLD = 'Moundshroud was updated while it was running, and the running copy does not have this part yet. Close Moundshroud, open it again, then press ↻ Try again.';
  const plain = m => /^not found$/i.test(String(m || '').trim()) ? OLD : m;
  const blobPost = async (url, body, signal, what) => { const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal }); if (!r.ok) { let m = what + ' could not be made.'; try { m = (await r.json()).error || m; } catch (e) { } throw new Error(plain(m)); } return r.blob(); };
  async function improve(target, text, progress, image) { if (!A.promptOpt) return { prompt: text, neg: '' }; progress('Writing a detailed prompt…'); return A.promptOpt.optimize(target, text, image ? { image } : {}); }

  /* ---------- 🖼️ AI art ---------- */
  const ART_STYLES = [['', 'No style'], ['photo', '📷 Photo'], ['painting', '🖌️ Oil painting'], ['anime', '🌸 Anime'], ['watercolor', '💧 Watercolour'], ['3d', '🧊 3D render'], ['sketch', '✏️ Sketch'], ['logo', '🔷 Logo'], ['fantasy', '🐉 Fantasy'], ['cartoon', '🎈 Cartoon'], ['pixel', '👾 Pixel art']];
  let artStatus = null; const astat = async () => artStatus || (artStatus = await AIArt.status(true).catch(() => ({ sd: false, edit: false })));
  const ART = {
    tool: 'art', title: '🖼️ AI art', short: 'AI art', icon: '🖼️', noun: 'picture session', unit: 'pictures', sub: 'Pictures made on this PC', hello: 'What should we draw?', helloSub: 'Describe a picture, or 📎 attach a photo and say how to change it. Everything is made on this PC.',
    placeholder: 'Describe a picture, or attach a photo and say what to change…  (Enter to make it)',
    examples: ['A lighthouse on a cliff in a storm at night', 'A cosy reading nook with a cat, warm evening light', 'A knight made of glass in a misty forest'],
    attach: { label: 'Photo', title: 'Attach a photo to edit (or drop or paste one here)', accept: 'image/*' },
    chips: () => sel('style', 'Style', ART_STYLES, saved('ss_art', 'style', '')) + sel('shape', 'Shape', [['512x512', 'Square'], ['512x768', 'Tall'], ['768x512', 'Wide']], saved('ss_art', 'shape', '512x512')) + sel('q', 'Quality', [['2', 'Fast'], ['4', 'Detailed']], saved('ss_art', 'q', '4')) + sel('eng', 'Made by', [['sd', 'Picture model (seconds)'], ['flux', 'FLUX (1 to 7 min)'], ['svg', 'Qwen vector drawing']], saved('ss_art', 'eng', 'sd')) + '<span data-c-edit hidden>' + sel('edit', 'Edit', [['kontext', '🪄 Precise (2 to 5 min)'], ['sd', '🎨 Quick redraw']], saved('ss_art', 'edit', 'kontext')) + sel('str', 'Change', [['0.35', 'A little'], ['0.55', 'Some'], ['0.75', 'A lot']], saved('ss_art', 'str', '0.55')) + '</span>' + chk('imp', '✨ Improve my prompt', saved('ss_art', 'imp', '1') === '1', 'The AI on this PC rewrites your words into the most detailed prompt the engine reads best'),
    wire: async (el, host) => {
      remember(el, 'ss_art');
      /* 📷 the same searchable reference picker the game tools use: a tick box, a subject box (filled from what you are
         asking for, and free to change) and a row of photos to choose from */
      const box = host && host.querySelector('.agbox');
      if (window.RefPhoto && box && !box.querySelector('.ssref')) {
        const holder = document.createElement('div');
        holder.className = 'ssref'; holder.style.cssText = 'padding:8px 10px 0';
        box.insertBefore(holder, box.querySelector('.agchips'));
        const inBox = () => { const t = host.querySelector('[data-k=in]'); return t ? t.value : ''; };
        const panel = RefPhoto.panel(holder, { query: inBox, onPick: it => { el._ref = it; } });
        const ta = host.querySelector('[data-k=in]');
        if (ta) ta.addEventListener('input', () => panel.fill());       // the subject box follows what is typed, until it is edited
      }
      const s = await astat(); const k = el.querySelector('[data-c=edit] option[value=kontext]'); if (!s.edit && k) { k.disabled = true; k.textContent = '🪄 Precise (edit model not installed)'; el.querySelector('[data-c=edit]').value = 'sd'; } const f = el.querySelector('[data-c=eng] option[value=flux]'); if (!s.edit && f) f.disabled = true; },
    onAttach: (host, on) => { const e = host.querySelector('[data-c-edit]'); if (e) e.hidden = !on; const r = host.querySelector('.ssref'); if (r) r.hidden = on; ['style', 'shape', 'eng', 'ref'].forEach(k => { const c = host.querySelector('[data-c=' + k + ']'); if (c) c.closest('label').hidden = on; }); },
    read: el => ({ style: val(el, 'style'), shape: val(el, 'shape'), steps: +val(el, 'q'), eng: val(el, 'eng'), edit: val(el, 'edit'), strength: +val(el, 'str'), improve: val(el, 'imp'), ref: el._ref || null }),
    label: (o, att) => att ? (o.edit === 'kontext' ? '🪄 Precise edit' : '🎨 Quick redraw, change: ' + o.strength) : [ART_STYLES.find(s => s[0] === o.style)[1], o.shape, o.eng === 'flux' ? 'FLUX' : o.eng === 'svg' ? 'Qwen vector' : o.steps === 4 ? 'detailed' : 'fast', o.ref ? '📷 from a web photo' : ''].filter(x => x && x !== 'No style').join(' · '),
    check: async (o, att) => { const s = await astat(); if (o.ref && !att) { if (o.eng !== 'sd') return 'Reference photos work with the picture model. Set Made by to “Picture model (seconds)”, or untick 📷 Reference photo.'; if (!s.sd) return 'The picture model is not installed, so a reference photo cannot be used.'; } if (att) { if (o.edit === 'kontext' && !s.edit) return 'The precise edit model is not installed. Pick Quick redraw.'; if (o.edit !== 'kontext' && !s.sd) return 'The picture model is not installed.'; } else if (o.eng === 'sd' && !s.sd) return 'The picture model is not installed: pick Qwen vector drawing, or run install-art-model.ps1.'; else if (o.eng === 'flux' && !s.edit) return 'FLUX is not installed.'; return ''; },
    working: 'Drawing…',
    run: async (o, signal, progress) => {
      let prompt = o.prompt, neg = '', used = '';
      if (o.attach) {
        if (o.improve) { const r = await improve(o.edit === 'kontext' ? 'photo' : 'redraw', o.prompt, progress, await A.sshell.small(o.attach.blob, 768).then(u => u.split(',')[1])); prompt = r.prompt; neg = r.neg || ''; used = r.prompt; }
        progress(o.edit === 'kontext' ? 'Editing your photo with the edit model…' : 'Redrawing your photo…');
        const r = await AIArt.edit(o.attach.blob, prompt, { engine: o.edit, strength: o.strength, neg, signal });
        return { media: [{ type: 'image', blob: r.blob }], text: used ? '*Instruction used:* ' + used : '', meta: { engine: o.edit === 'kontext' ? 'Precise edit (FLUX Kontext)' : 'Quick redraw (SDXL Turbo)', seed: r.seed } };
      }
      if (o.improve && o.eng !== 'svg') { const r = await improve('image', o.prompt, progress); prompt = r.prompt; neg = r.neg || ''; used = r.prompt; }
      const [w, h] = String(o.shape || '512x512').split('x').map(Number), styled = prompt + (o.style ? (AIArt.SUFFIX[o.style] || '') : '');
      /* 📷 reference photo: the picture model redraws the chosen photo at a low strength, so the result keeps its
         shapes, colours and light while following the words */
      if (o.ref && o.eng === 'sd') {
        try {
          progress('Drawing from the reference photo “' + String(o.ref.title || 'the photo').slice(0, 40) + '”…');
          const refBlob = await (await fetch(o.ref.dataUrl)).blob();
          const r = await AIArt.edit(refBlob, styled, { engine: 'sd', strength: 0.45, neg, signal });
          return { media: [{ type: 'image', blob: r.blob }, { type: 'image', blob: refBlob }],
            text: '📷 Reference photo: ' + (o.ref.page ? '[' + o.ref.title + '](' + o.ref.page + ')' : o.ref.title) + (o.ref.credit ? '\n\n' + o.ref.credit : '') + (used ? '\n\n*Prompt used:* ' + used : ''),
            meta: { engine: 'SDXL Turbo from a web photo', size: w + '×' + h, seed: r.seed } };
        } catch (e) { progress('The reference photo could not be used (' + e.message + '), drawing from your words…'); }
      }
      if (o.eng === 'svg') { progress('Qwen is drawing…'); const r = await AIArt.svg(o.prompt + (o.style ? ' (' + o.style + ' style)' : '')); const blob = await (await fetch(r.url)).blob(); return { media: [{ type: 'image', blob }], meta: { engine: 'Qwen vector drawing' } }; }
      if (o.eng === 'flux') { progress('FLUX is drawing (1 to 7 minutes; slowest when memory is nearly full)…'); const blob = await blobPost('/api/art/flux', { prompt: styled, w, h }, signal, 'The picture'); return { media: [{ type: 'image', blob }], text: used ? '*Prompt used:* ' + used : '', meta: { engine: 'FLUX', size: w + '×' + h } }; }
      progress('Drawing…'); const r = await AIArt.image(prompt, { style: o.style, neg, w, h, steps: o.steps || 4, signal });
      return { media: [{ type: 'image', blob: r.blob }], text: used ? '*Prompt used:* ' + used + (neg ? '\n\n*Avoiding:* ' + neg : '') : '', meta: { engine: 'SDXL Turbo', size: w + '×' + h, seed: r.seed } };
    },
    actions: [['save', '💾 Save'], ['edit', '🪄 Edit it'], ['album', '📁 Album'], ['pixel', '👾 Pixel art']],
    act: (a, t, ui) => {
      const b = t.media && t.media[0] && t.media[0].blob; if (!b) return;
      if (a === 'save') { const l = document.createElement('a'); l.href = URL.createObjectURL(b); l.download = 'moundshroud-' + t.id + '.png'; l.click(); }
      else if (a === 'edit') { ui.attach(b, 'this picture'); ui.input.value = ''; ui.input.placeholder = 'Say what to change, e.g. make it look like winter'; }
      else if (a === 'album' && window.ArtAlbums) ArtAlbums.add(b, { name: 'AI art', source: 'AI art', prompt: '' });
      else if (a === 'pixel') { AIArt.pending = { url: URL.createObjectURL(b), n: 32, prompt: 'AI art' }; A.studio.go('pixel'); }
    },
    takePending: ui => {
      const P = window.AIArt && AIArt.pending; if (!P || !P.mode) return; AIArt.pending = null; ui.newSession(); ui.input.value = P.prompt || '';
      if (P.mode === 'edit' && P.photo) fetch('data:image/jpeg;base64,' + P.photo).then(r => r.blob()).then(b => ui.attach(b, 'photo'));
    },
  };

  /* ---------- 🎵 AI music ---------- */
  const MUSIC = {
    tool: 'music', title: '🎵 AI music', short: 'AI music', icon: '🎵', noun: 'music session', unit: 'clips', sub: 'Instrumental music made on this PC (MusicGen)', hello: 'What should it sound like?', helloSub: 'Describe the music: genre, mood, instruments, tempo. Each clip is made on this PC.',
    placeholder: 'e.g. calm lo-fi piano with soft rain, 80 BPM…  (Enter to make it)',
    examples: ['Epic orchestral battle music with drums and brass', 'Chill lo-fi beat for studying, warm piano', 'Upbeat 8-bit video game theme'],
    chips: () => sel('sec', 'Length', [['10', '10 s'], ['15', '15 s'], ['20', '20 s'], ['30', '30 s']], saved('ss_mus', 'sec', '15')) + chk('imp', '✨ Improve my prompt', saved('ss_mus', 'imp', '1') === '1'),
    wire: el => remember(el, 'ss_mus'),
    read: el => ({ seconds: +val(el, 'sec'), improve: val(el, 'imp') }), label: o => o.seconds + ' seconds',
    check: async () => { try { const s = await (await fetch('/api/music/status')).json(); return s.model ? '' : 'The AI music model is not installed: run install-music-model.ps1. (Studio › Music studio can still write songs with Qwen.)'; } catch (e) { return ''; } },
    working: 'Composing…',
    run: async (o, signal, progress) => { let p = o.prompt, used = ''; if (o.improve) { const r = await improve('music', o.prompt, progress); p = r.prompt; used = r.prompt; } progress('Composing (about a minute)…'); const blob = await blobPost('/api/music/gen', { prompt: p, seconds: o.seconds || 15 }, signal, 'The music'); return { media: [{ type: 'audio', blob }], text: used ? '*Prompt used:* ' + used : '', meta: { engine: 'MusicGen', size: (o.seconds || 15) + ' s' } }; },
    actions: [['save', '💾 Save'], ['song', '🎧 Add to My songs']],
    act: async (a, t) => { const b = t.media && t.media[0] && t.media[0].blob; if (!b) return; if (a === 'save') { const l = document.createElement('a'); l.href = URL.createObjectURL(b); l.download = 'moundshroud-music-' + t.id + '.wav'; l.click(); } else if (a === 'song' && window.MLMine && MLMine.saveRecording) { try { await MLMine.saveRecording(b, { title: 'AI music ' + new Date().toLocaleDateString() }); A.toast('Added to Music › My songs'); } catch (e) { A.toast('Could not add it: ' + e.message); } } },
  };

  /* ---------- 🎬 AI video ---------- */
  const VSIZES = [['416x240x17', 'Quick (416×240, 1 s)'], ['624x352x17', 'Medium (624×352, 1 s)'], ['624x352x33', 'Medium (624×352, 2 s)'], ['832x480x33', 'Large (832×480, 2 s, slow)']];
  const VIDEO = {
    tool: 'video', title: '🎬 AI video', short: 'AI video', icon: '🎬', noun: 'video session', unit: 'clips', sub: 'Short silent clips made on this PC (Wan 2.1)', hello: 'What should happen in the clip?', helloSub: 'One subject, one simple motion, the camera and the light. Clips take several minutes on this PC.',
    placeholder: 'e.g. a red fox running through snow, camera following from the side…  (Enter to make it)',
    examples: ['Waves rolling onto a beach at sunset, slow pan', 'A paper boat drifting down a rainy street', 'A cat stretching on a sunny windowsill, close-up'],
    /* Length: one clip, or a long video made shot by shot on the server and joined (lib/longvideo.js); any number of seconds */
    chips: () => sel('sz', 'Size', VSIZES, saved('ss_vid', 'sz', '416x240x17')) + sel('len', 'Length', [['0', 'One clip'], ['10', '10 s'], ['30', '30 s'], ['60', '1 min'], ['120', '2 min'], ['300', '5 min'], ['600', '10 min'], ['custom', 'Other…']], saved('ss_vid', 'len', '0')) +
      '<label class="agchip" data-c-custom' + (saved('ss_vid', 'len', '0') === 'custom' ? '' : ' hidden') + '>Seconds <input type="number" data-c="secs" min="2" max="36000" value="' + esc(saved('ss_vid', 'secs', '45')) + '" style="width:64px;border:0;background:transparent;color:var(--text)"></label>' +
      chk('smooth', '🌊 Smooth (each shot continues the last)', saved('ss_vid', 'smooth', '1') === '1', 'Each shot starts from the last picture of the shot before (the continuation model)') + chk('imp', '✨ Improve my prompt', saved('ss_vid', 'imp', '1') === '1'),
    wire: async el => {
      remember(el, 'ss_vid');
      const sync = () => { const c = el.querySelector('[data-c-custom]'); if (c) c.hidden = val(el, 'len') !== 'custom'; };
      el.addEventListener('change', sync); sync();
      try { const r = await (await fetch('/api/video/long')).json(); if (!r.ready.smooth) { const s = el.querySelector('[data-c=smooth]'); if (s) { s.checked = false; s.disabled = true; s.closest('label').title = 'The continuation model is not installed, so long videos are separate shots joined together.'; } } } catch (e) { }
    },
    read: el => { const len = val(el, 'len'); return { size: val(el, 'sz'), seconds: len === 'custom' ? Math.max(2, Math.min(36000, Math.round(+val(el, 'secs') || 30))) : +len, smooth: !!val(el, 'smooth'), improve: val(el, 'imp') }; },
    label: o => [(VSIZES.find(s => s[0] === o.size) || [, o.size])[1], o.seconds ? (o.seconds >= 60 ? (o.seconds / 60).toFixed(o.seconds % 60 ? 1 : 0) + ' min' : o.seconds + ' s') + (o.smooth ? ', smooth' : ', shots') : ''].filter(Boolean).join(' · '),
    check: async () => { try { const s = await (await fetch('/api/video/status')).json(); return s.video ? '' : 'The video model is not installed: run install-video-model.ps1 (about 6.7 GB).'; } catch (e) { return ''; } },
    working: 'Filming…',
    run: async (o, signal, progress, ctx) => {
      let p = o.prompt, neg = '', used = ''; const [w, h, frames] = String(o.size || '416x240x17').split('x').map(Number), clip = (frames - 1) / 16;
      if (!o.seconds || o.seconds <= clip * 1.5) {
        if (o.improve) { const r = await improve('video', o.prompt, progress); p = r.prompt; neg = r.neg || ''; used = r.prompt; }
        progress('Making the clip (about a minute)…'); const blob = await blobPost('/api/video/make', { prompt: p, neg, w, h, frames, seed: -1 }, signal, 'The clip');
        return { media: [{ type: 'video', blob }], text: used ? '*Prompt used:* ' + used : '', meta: { engine: 'Wan 2.1', size: w + '×' + h } };
      }
      /* a long video: the AI writes the shot list, the server makes and joins the shots */
      const n = Math.ceil(o.seconds / clip), shots = await shotList(o.prompt, n, o.smooth, progress, signal);
      const st = await A.api('/api/video/long/start', { title: o.prompt, shots, size: o.size, smooth: o.smooth });
      if (!st.ok) throw new Error(plain(st.error) || 'The long video could not start.');
      if (ctx && ctx.setJob) await ctx.setJob(st.id);
      const out = await follow(st.id, signal, progress);
      out.text = '**' + shots.length + ' shots**' + (o.smooth ? ', each continuing the last' : ', joined') + '. First shots: ' + shots.slice(0, 3).map((s, i) => '(' + (i + 1) + ') ' + s).join(' ');
      return out;
    },
    actions: [['save', '💾 Save']],
    act: (a, t) => { const m0 = t.media && t.media[0], b = m0 && m0.blob; if (b && a === 'save') { const l = document.createElement('a'); l.href = URL.createObjectURL(b); l.download = 'moundshroud-video-' + t.id + (b.type === 'video/mp4' ? '.mp4' : '.webm'); l.click(); } },
  };
  /* the shot list: the local AI breaks the idea into one short shot per clip, in parts for long videos, keeping the same subject */
  async function shotList(idea, n, smooth, progress, signal) {
    const out = [], part = 20;
    const fallback = i => idea + (i ? ', continuing, moment ' + (i + 1) : '');
    for (let i = 0; i < n; i += part) {
      if (signal.aborted) throw Object.assign(new Error('stopped'), { name: 'AbortError' });
      const k = Math.min(part, n - i); progress('Writing the shot list (' + Math.min(n, i + k) + ' of ' + n + ')…');
      let got = [];
      try {
        const t = await A.ai.once([{ role: 'system', content: 'You plan short video shots for Wan 2.1, a small text-to-video model that makes ' + (smooth ? 'continuous footage where every shot flows straight on from the one before' : 'one 1 to 2 second shot at a time') + '. Reply with JSON only: {"shots":["...", ...]} with exactly ' + k + ' items. Each item is ONE sentence of 20 to 40 words: the same main subject described the same way every time (looks, colours, clothing), one simple motion, the camera, the setting, the light. Keep the style, the colours and the subject identical across shots; only the action and place move on gently. No numbers, no scene titles.' }, { role: 'user', content: 'The video: ' + idea + '\nShots ' + (i + 1) + ' to ' + (i + k) + ' of ' + n + '.' + (out.length ? '\nThe story so far ended with: ' + out.slice(-2).join(' / ') : '') }], { temp: .6, private: 'files' });
        const j = A.ai.json(t); got = (j && Array.isArray(j.shots) ? j.shots : Array.isArray(j) ? j : []).map(s => String(s || '').trim()).filter(s => s.length > 8);
      } catch (e) { if (signal.aborted) throw e; }
      for (let x = 0; x < k; x++) out.push(got[x] || fallback(i + x));
    }
    return out;
  }
  /* follows a long video on the server until it is ready, then fetches it */
  async function follow(id, signal, progress) {
    for (; ;) {
      if (signal.aborted) { await A.api('/api/video/long/stop', { id }).catch(() => { }); throw Object.assign(new Error('Stopped. Its finished shots are kept: press Resume to carry on.'), { name: 'AbortError' }); }
      let s; try { s = await A.api('/api/video/long/status?id=' + encodeURIComponent(id)); } catch (e) { s = null; }
      if (s && !s.state) throw new Error(/^not found$/i.test(s.error || '') ? OLD : 'The server no longer has this video on its list, so it cannot be followed. Press ↻ Try again to make it again.');
      if (s) {
        if (s.state === 'done') { progress('Fetching the finished video…'); const r = await fetch('/api/video/long/file?id=' + encodeURIComponent(id)); if (!r.ok) throw new Error('The finished video could not be read.'); const blob = await r.blob(); return { media: [{ type: 'video', blob }], meta: { engine: 'Wan 2.1' + (s.smooth ? ' + VACE (smooth)' : ' (shots)'), size: s.w + '×' + s.h + ' · ' + s.seconds + ' s' } }; }
        if (s.state === 'failed' || s.state === 'stopped' || s.state === 'interrupted') throw new Error(s.err || s.note || 'It stopped.');
        const left = s.left ? (s.left >= 3600 ? Math.floor(s.left / 3600) + ' h ' + Math.round(s.left % 3600 / 60) + ' min' : Math.max(1, Math.round(s.left / 60)) + ' min') + ' left' : '';
        progress('Shot ' + Math.min(s.total, s.done + 1) + ' of ' + s.total + (left ? ' · about ' + left : '') + ' · it keeps going while you do other things');
      }
      await new Promise(r => setTimeout(r, 5000));
    }
  }
  A.sshell.resumers.video = async (o, signal, progress) => { const r = await A.api('/api/video/long/resume', { id: o.job }).catch(() => null); void r; return follow(o.job, signal, progress); };

  if (A.studio) {
    A.studio.reg('art', '🖼️ AI art', body => mount(body, ART), 1);
    A.studio.reg('aimusic', '🎵 AI music', body => mount(body, MUSIC), 2);
    A.studio.reg('video', '🎬 AI video', body => mount(body, VIDEO), 3);
  }
})();

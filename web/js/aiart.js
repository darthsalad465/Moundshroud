// Offline picture making. Type what you want and Moundshroud draws it on this PC, no internet needed.
//  1. Image model: stable-diffusion.cpp with the free SD-Turbo model (files in the imggen folder, run by server.js at /api/art/sd).
//  2. Qwen drawing: the local Qwen model writes vector shapes (or a small grid of pixels) when the image model is not installed.
// window.AIArt.image(prompt, opts) -> { blob, url, seed }   .svg(prompt) -> { svg, url }   .pixelGrid(prompt) -> canvas   .status()
// Studio > AI art is the tool for ordinary pictures; Studio > Pixel art uses the same engine to make pixel pictures of any size.
(() => {
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const STYLES = [['', 'Plain'], ['photo', '📷 Photo'], ['painting', '🖌️ Oil painting'], ['anime', '🌸 Anime'], ['watercolor', '💧 Watercolour'], ['3d', '🧊 3D render'], ['sketch', '✏️ Pencil sketch'], ['logo', '🔷 Logo'], ['fantasy', '🐉 Fantasy'], ['cartoon', '🎈 Cartoon']];
  const SUFFIX = { photo: ', photograph, natural light, detailed, sharp focus', painting: ', oil painting, visible brush strokes, rich colours', anime: ', anime style, clean lines, vibrant colours', watercolor: ', watercolor painting, soft washes, paper texture', '3d': ', 3d render, soft studio lighting, smooth shapes', sketch: ', pencil sketch, hand drawn, monochrome, shading', logo: ', flat vector logo, simple shapes, white background', fantasy: ', fantasy concept art, dramatic lighting, highly detailed', cartoon: ', cartoon illustration, bold outlines, flat colours', pixel: ', pixel art, 16-bit video game sprite, flat colours, clean pixels, simple plain background' };
  const model = () => { try { return document.getElementById('model').value; } catch (e) { return ''; } };
  let stat = null; const status = async (force) => { if (stat && !force) return stat; try { stat = await (await fetch('/api/art/status')).json(); } catch (e) { stat = { sd: false }; } return stat; };

  /* the image model */
  async function image(prompt, o) {
    o = o || {}; const style = o.style ? (SUFFIX[o.style] || '') : '';
    const r = await fetch('/api/art/sd', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: String(prompt).trim() + style, w: o.w || 512, h: o.h || 512, steps: o.steps || 2, seed: o.seed == null ? -1 : o.seed }) });
    if (!r.ok) { let m = 'The picture could not be made.'; try { m = (await r.json()).error || m; } catch (e) { } throw new Error(m); }
    const blob = await r.blob(); return { blob, url: URL.createObjectURL(blob), seed: +r.headers.get('X-Seed') || 0 };
  }
  /* Qwen drawing: vector shapes */
  const clean = svg => svg.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<foreignObject[\s\S]*?<\/foreignObject>/gi, '').replace(/\son\w+\s*=\s*("[^"]*"|'[^']*')/gi, '').replace(/(xlink:)?href\s*=\s*("(?!#)[^"]*"|'(?!#)[^']*')/gi, '');
  async function chatJson(prompt, json) {
    const r = await fetch('/api/chat', { method: 'POST', body: JSON.stringify({ model: model(), stream: false, think: false, keep_alive: '3m', format: json ? 'json' : undefined, messages: [{ role: 'user', content: prompt }] }) }); const j = await r.json(); return (j.message && j.message.content) || '';
  }
  async function svg(prompt) {
    const txt = await chatJson('Draw this as ONE self-contained SVG picture: "' + prompt + '".\nRules: viewBox="0 0 400 400"; start with a full-size background rectangle; use many simple shapes (rect, circle, ellipse, path, polygon) with gradients and a pleasing colour palette; add shading and a few details; no text, no scripts, no external images. Reply with ONLY the SVG code.');
    const m = /<svg[\s\S]*<\/svg>/i.exec(txt); if (!m) throw new Error('Qwen did not draw anything this time. Try again or describe it differently.');
    let s = clean(m[0]); if (!/viewBox/i.test(s)) s = s.replace(/<svg/i, '<svg viewBox="0 0 400 400"'); if (!/xmlns=/i.test(s)) s = s.replace(/<svg/i, '<svg xmlns="http://www.w3.org/2000/svg"');
    return { svg: s, url: 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s) };
  }
  /* Qwen drawing for the pixel tool: Qwen draws bold simple vector shapes, which are drawn onto a canvas that the pixel tool then shrinks to your pixel count (small models draw shapes far better than they place individual pixels) */
  async function pixelGrid(prompt) {
    const r = await svg('pixel art style icon of ' + prompt + ', built from big simple bold shapes with a thick dark outline and flat colours, centred, plain background'); const im = await new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => no(new Error('Qwen drew something that could not be shown. Try again.')); i.src = r.url; });
    const c = document.createElement('canvas'); c.width = c.height = 512; c.getContext('2d').drawImage(im, 0, 0, 512, 512); return c;
  }  /* saved pictures (browser database, last 30) */
  const DB = () => new Promise((ok, no) => { try { const r = indexedDB.open('moundshroud_art', 1); r.onupgradeneeded = () => r.result.createObjectStore('p', { keyPath: 'id' }); r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error); } catch (e) { no(e); } });
  const gal = { async list() { try { const db = await DB(); return await new Promise(ok => { const q = db.transaction('p').objectStore('p').getAll(); q.onsuccess = () => ok((q.result || []).sort((a, b) => b.at - a.at)); q.onerror = () => ok([]); }); } catch (e) { return []; } },
    async add(rec) { try { const db = await DB(), all = await this.list(); const tx = db.transaction('p', 'readwrite'), st = tx.objectStore('p'); st.put(rec); all.slice(29).forEach(x => st.delete(x.id)); } catch (e) { } },
    async clear() { try { const db = await DB(); await new Promise(ok => { const tx = db.transaction('p', 'readwrite'); tx.objectStore('p').clear(); tx.oncomplete = tx.onerror = tx.onabort = () => ok(); }); } catch (e) { } },
    async del(id) { try { const db = await DB(); db.transaction('p', 'readwrite').objectStore('p').delete(id); } catch (e) { } } };
  window.AIArt = { STYLES, SUFFIX, status, image, svg, pixelGrid, gal, pending: null };

  /* Studio > AI art */
  if (typeof A === 'undefined' || !A.studio) return;
  A.studio.reg('art', '🖼️ AI art', body => {
    const root = document.createElement('div'); root.className = 'scroll pad'; root.style.flex = '1'; body.appendChild(root); const q = s => root.querySelector(s);
    const SHAPES = [['512x512', 'Square'], ['512x768', 'Portrait'], ['768x512', 'Landscape'], ['384x384', 'Small and quick']];
    root.innerHTML = '<h2 style="margin:0 0 4px">🖼️ AI art</h2><div class="small mute" style="margin-bottom:10px">Type anything and it is drawn right here on your PC, with no internet. Be specific: who or what, where, the mood, the colours.</div>' +
      '<div class="row" style="gap:14px;align-items:flex-start;flex-wrap:wrap"><div style="flex:1;min-width:280px;max-width:520px"><textarea id="aip" rows="3" placeholder="e.g. a lighthouse on a cliff in a storm, waves crashing, dramatic sky" style="width:100%"></textarea>' +
      '<div class="row" style="gap:6px;flex-wrap:wrap;margin:8px 0" id="ais">' + STYLES.map((s, i) => '<button class="chip' + (i === 0 ? ' on' : '') + '" data-s="' + s[0] + '">' + s[1] + '</button>').join('') + '</div>' +
      '<div class="row" style="gap:8px;flex-wrap:wrap;align-items:center"><label class="small mute">Shape <select id="aish">' + SHAPES.map(s => '<option value="' + s[0] + '">' + s[1] + ' ' + s[0] + '</option>').join('') + '</select></label><label class="small mute">Quality <select id="aiq"><option value="1">Fast</option><option value="2" selected>Better</option><option value="4">Best</option></select></label><label class="small mute">Seed <input id="aisd" type="number" placeholder="random" style="width:100px"></label><label class="small mute">Drawn by <select id="aie"><option value="sd">Image model</option><option value="svg">Qwen (vector drawing)</option></select></label><label class="chk small" title="Look the subject up on the web first (DuckDuckGo) and have the local AI turn what it reads into a more accurate description for the picture. Needs internet access switched on in Settings, AI &amp; power." style="margin:0"><input type="checkbox" id="aiweb"> &#127760; Look it up first</label></div>' +
      '<div class="row" style="gap:8px;margin-top:10px;align-items:center"><button class="pri" id="aigo">✨ Draw it</button><button class="ib" id="aivar" disabled>🎲 Another version</button><span class="small mute" id="aist"></span></div></div>' +
      '<div style="flex:1;min-width:280px"><div id="aiout" class="card" style="margin:0;min-height:260px;display:flex;align-items:center;justify-content:center;text-align:center"><span class="mute small">Your picture will appear here.</span></div><div class="small mute" id="aiwsrc" style="margin-top:6px"></div><div class="row" style="gap:6px;margin-top:8px;flex-wrap:wrap"><button class="ib" id="aisv" disabled>💾 Save PNG</button><button class="ib" id="aialb" disabled>📁 Add to album</button><button class="ib" id="aipx" disabled>🎨 Make it pixel art</button><input id="aipn" type="number" min="4" max="128" value="32" style="width:64px" title="How many pixels across"><span class="small mute">pixels across</span></div></div></div>' +
      '<div class="row" style="margin:16px 0 6px;align-items:center;gap:10px"><span class="small mute">Recent pictures (kept on this PC)</span><button class="ib dang" id="aiclr" style="padding:2px 10px">🗑 Delete all</button></div><div id="aigal" style="display:flex;gap:8px;flex-wrap:wrap"></div>';
    let style = '', cur = null, tick = 0, busy = false;
    const setStatus = (t, bad) => { q('#aist').innerHTML = bad ? '<span class="bad">' + esc(t) + '</span>' : esc(t); };
    status(true).then(s => { if (!s.sd) { q('#aie').value = 'svg'; setStatus('The image model is not installed here, so Qwen will draw simple vector pictures. Run install-art-model.ps1 to add the real image model (about 2 GB).'); } });
    q('#ais').onclick = e => { const b = e.target.closest('[data-s]'); if (!b) return; style = b.dataset.s; q('#ais').querySelectorAll('.chip').forEach(x => x.classList.toggle('on', x === b)); };
    const show = (url, blob, seed, prompt) => { cur = { url, blob, seed, prompt }; q('#aiout').innerHTML = '<img src="' + url + '" style="max-width:100%;max-height:560px;border-radius:8px">'; q('#aisv').disabled = q('#aipx').disabled = q('#aivar').disabled = q('#aialb').disabled = false; };
    const toBlob = url => new Promise((ok, no) => { const im = new Image(); im.onload = () => { const c = document.createElement('canvas'); c.width = im.naturalWidth || 800; c.height = im.naturalHeight || 800; c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); c.toBlob(b => b ? ok(b) : no(new Error('save failed')), 'image/png'); }; im.onerror = () => no(new Error('could not read the picture')); im.src = url; });
    const make = async (seed) => {
      if (busy) return; const asked = q('#aip').value.trim(); if (!asked) return setStatus('Type what you want to see first.', true); busy = true; q('#aigo').disabled = q('#aivar').disabled = true; const t0 = Date.now(); const src = q('#aiwsrc'); if (src) src.innerHTML = '';
      const eng = q('#aie').value; tick = setInterval(() => setStatus((eng === 'sd' ? 'Drawing... ' : 'Qwen is drawing... ') + Math.round((Date.now() - t0) / 1000) + 's' + (eng === 'sd' ? ' (the first picture takes longer while the model loads)' : '')), 500);
      let prompt = asked;
      try {
        /* optional: ask the web about the subject first, and let the local AI turn what it read into a visual description.
           The picture itself is still drawn on this PC; the internet only makes the description accurate. */
        if (q('#aiweb') && q('#aiweb').checked) {
          if (!window.A.net || !A.net.on()) setStatus('Internet access is switched off, so this is drawn from your words alone.', true);
          else {
            setStatus('Looking "' + asked.slice(0, 40) + '" up online…');
            const r = await A.net.research(asked).catch(() => null);
            if (r && r.notes) {
              const brief = await chatJson('You write prompts for an image model. Using only these facts, write ONE visual description of about 45 words for a picture of "' + asked + '": the subject, setting, materials, colours, light and mood. No website names, no lists, no preamble.\n\n' + r.notes.slice(0, 3000)).catch(() => '');
              const b = String(brief || '').replace(/```[\s\S]*?```/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 400);
              if (b.length > 25) prompt = b; else if (r.notes.length > 60) prompt = asked + ', ' + r.notes.replace(/\[[^\]]+\]/g, ' ').replace(/\s+/g, ' ').slice(0, 220);
              if (src) src.innerHTML = '&#127760; Read from the web (' + esc(r.engine || 'DuckDuckGo') + '): ' + r.sources.map((s, i) => '[' + (i + 1) + '] ' + esc(s.title)).join(' · ');
            } else if (src) src.textContent = 'Nothing useful came back from the web, so this is drawn from your words.';
          }
        }
        if (eng === 'sd') { const [w, h] = q('#aish').value.split('x').map(Number); const sd = q('#aisd').value === '' ? seed : +q('#aisd').value; const r = await image(prompt, { style, w, h, steps: +q('#aiq').value, seed: sd == null ? -1 : sd }); show(r.url, r.blob, r.seed, asked); }
        else { const r = await svg(prompt + (style ? ' (' + (STYLES.find(s => s[0] === style) || [0, ''])[1].replace(/^\S+\s/, '') + ' style)' : '')); show(r.url, null, 0, asked); }
        setStatus('Done in ' + Math.round((Date.now() - t0) / 1000) + 's.' + (cur.seed ? ' Seed ' + cur.seed + ' (type it in Seed to get the same picture again).' : '')); save();
      } catch (e) { setStatus(e.message || 'That did not work.', true); } finally { clearInterval(tick); busy = false; q('#aigo').disabled = false; q('#aivar').disabled = !cur; }
    };
    const save = async () => { if (!cur) return; try { const blob = cur.blob || await toBlob(cur.url); cur.blob = blob; await gal.add({ id: Date.now(), at: Date.now(), prompt: cur.prompt, seed: cur.seed, blob }); drawGal(); } catch (e) { } };
    const drawGal = async () => { const l = await gal.list(), g = q('#aigal'); if (!g) return; g.innerHTML = l.length ? '' : '<span class="small mute">Nothing yet.</span>'; l.forEach(r => { const u = URL.createObjectURL(r.blob), d = document.createElement('div'); d.className = 'card'; d.style.cssText = 'margin:0;padding:6px;width:132px;text-align:center'; d.innerHTML = '<img src="' + u + '" style="width:120px;height:120px;object-fit:cover;border-radius:6px;cursor:pointer" title="' + esc(r.prompt) + '"><div class="small" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(r.prompt) + '</div><span class="small mute" style="cursor:pointer">delete</span>'; d.querySelector('img').onclick = () => { show(u, r.blob, r.seed, r.prompt); q('#aip').value = r.prompt; }; d.querySelector('span').onclick = async () => { await gal.del(r.id); drawGal(); }; g.appendChild(d); }); };
    q('#aiclr').onclick = async () => { const n = (await gal.list()).length; if (!n) return A.toast('There are no saved pictures.'); if (!confirm('Delete all ' + n + ' saved pictures from this PC? This cannot be undone.')) return; await gal.clear(); drawGal(); A.toast('Deleted ' + n + ' pictures.'); };
    q('#aigo').onclick = () => make(-1); q('#aivar').onclick = () => { q('#aisd').value = ''; make(-1); }; q('#aip').onkeydown = e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) make(-1); };
    q('#aisv').onclick = async () => { if (!cur) return; const blob = cur.blob || await toBlob(cur.url); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = (cur.prompt || 'picture').replace(/[^\w ]+/g, '').trim().slice(0, 40).replace(/\s+/g, '-') + '.png'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); };
    q('#aialb').onclick = async () => { if (!cur || !window.ArtAlbums) return; try { const blob = cur.blob || await toBlob(cur.url); cur.blob = blob; ArtAlbums.add(blob, { name: cur.prompt, source: 'AI art', prompt: cur.prompt }); } catch (e) { A.toast('Could not read the picture'); } };
    q('#aipx').onclick = () => { if (!cur) return; AIArt.pending = { url: cur.url, n: Math.max(4, Math.min(128, Math.round(+q('#aipn').value) || 32)), prompt: cur.prompt }; A.studio.go('pixel'); };
    drawGal(); body._cleanup = () => { clearInterval(tick); };
  }, 1);
})();

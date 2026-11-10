// Studio > AI video: type what you want to see and a short silent clip is made on this PC, no internet needed.
// The Wan 2.1 text-to-video model is run by the picture engine (lib/media.js, /api/video/make); install-video-model.ps1 adds it.
(() => {
  if (typeof A === 'undefined' || !A.studio) return;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const SIZES = [['416x240x17', 'Quick (416x240, 1 second)'], ['624x352x17', 'Medium (624x352, 1 second)'], ['624x352x33', 'Medium (624x352, 2 seconds)'], ['832x480x33', 'Large (832x480, 2 seconds, slow)']];
  A.studio.reg('video', '🎬 AI video', body => {
    const root = document.createElement('div'); root.className = 'scroll pad'; root.style.flex = '1'; body.appendChild(root); const q = s => root.querySelector(s);
    root.innerHTML = '<h2 style="margin:0 0 4px">🎬 AI video</h2><div class="small mute" style="margin-bottom:10px">Type a scene and a short silent clip is made right here on your PC, with no internet. Say what is seen and how it moves. A quick clip takes about two minutes; larger ones take longer. Chat pauses while a clip is made, because the video model needs the graphics card.</div>' +
      '<div class="row" style="gap:14px;align-items:flex-start;flex-wrap:wrap"><div style="flex:1;min-width:280px;max-width:520px"><textarea id="vip" rows="3" placeholder="e.g. a red fox running through snow, camera following from the side" style="width:100%"></textarea>' +
      '<div class="row" style="gap:8px;flex-wrap:wrap;align-items:center;margin-top:8px"><label class="small mute">Size <select id="visz">' + SIZES.map(s => '<option value="' + s[0] + '">' + esc(s[1]) + '</option>').join('') + '</select></label><label class="small mute">Seed <input id="visd" type="number" placeholder="random" style="width:100px"></label></div>' +
      '<div class="row" style="gap:8px;margin-top:10px;align-items:center"><button class="pri" id="vigo">🎬 Make the clip</button><span class="small mute" id="vist"></span></div></div>' +
      '<div style="flex:1;min-width:280px"><div id="viout" class="card" style="margin:0;min-height:240px;display:flex;align-items:center;justify-content:center;text-align:center"><span class="mute small">Your clip will appear here.</span></div><div class="row" style="gap:6px;margin-top:8px"><button class="ib" id="visv" disabled>💾 Save the clip</button></div></div></div>';
    let cur = null, busy = false, timer = 0, alive = true;
    body._cleanup = () => { alive = false; clearInterval(timer); if (cur) { try { URL.revokeObjectURL(cur.url); } catch (e) { } } };
    const say = (t, bad) => { const el = q('#vist'); if (el) el.innerHTML = bad ? '<span class="bad">' + esc(t) + '</span>' : esc(t); };
    fetch('/api/video/status').then(r => r.json()).then(s => { if (!alive) return; if (!s.video) { q('#vigo').disabled = true; say('The video model is not installed here. Run install-video-model.ps1 in the Moundshroud folder (about 6.7 GB).'); } }).catch(() => { });
    q('#vigo').onclick = async () => {
      const prompt = q('#vip').value.trim(); if (busy) return; if (!prompt) { say('Describe the scene first.', true); return; }
      const [w, h, frames] = q('#visz').value.split('x').map(Number), sd = q('#visd').value.trim();
      busy = true; q('#vigo').disabled = true; const t0 = Date.now(); clearInterval(timer);
      timer = setInterval(() => say('Making the clip... ' + Math.round((Date.now() - t0) / 1000) + ' seconds so far'), 1000);
      try {
        const r = await fetch('/api/video/make', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt, w, h, frames, seed: sd === '' ? -1 : +sd }) });
        if (!r.ok) { let m = 'The clip could not be made.'; try { m = (await r.json()).error || m; } catch (e) { } throw new Error(m); }
        const blob = await r.blob(); if (!alive) return;
        if (cur) { try { URL.revokeObjectURL(cur.url); } catch (e) { } }
        cur = { blob, url: URL.createObjectURL(blob) };
        q('#viout').innerHTML = '<video src="' + cur.url + '" controls loop autoplay muted style="max-width:100%;max-height:520px;border-radius:8px"></video>';
        q('#visv').disabled = false; clearInterval(timer); say('Done in ' + Math.round((Date.now() - t0) / 1000) + ' seconds. Seed ' + (r.headers.get('X-Seed') || '?') + '.');
      } catch (e) { clearInterval(timer); if (alive) say(String(e.message || e), true); }
      finally { busy = false; if (alive && q('#vigo')) q('#vigo').disabled = false; }
    };
    q('#visv').onclick = () => { if (!cur) return; const a = document.createElement('a'); a.href = cur.url; a.download = 'moundshroud-clip-' + Date.now() + '.webm'; document.body.appendChild(a); a.click(); a.remove(); };
  });
})();

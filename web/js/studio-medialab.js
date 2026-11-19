// Studio > Media Lab: 3 lightweight offline AI media tools in one organized workspace:
//   - Background Remover (https://github.com/danielgatis/rembg)
//   - AI Image Upscaler  (https://github.com/xinntao/Real-ESRGAN)
//   - Music Stem Splitter (https://github.com/facebookresearch/demucs)
(() => {
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const kb = n => !n ? '' : n >= 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB';

  function readAsBase64(file) {
    return new Promise((res, rej) => {
      const fr = new FileReader();
      fr.onload = () => res(String(fr.result || ''));
      fr.onerror = () => rej(new Error('Could not read file.'));
      fr.readAsDataURL(file);
    });
  }

  function render(b) {
    let tab = 'rembg', st = null, timer = null, imgFile = null, upFile = null, audFile = null, watchId = '';
    const CHECKER = 'background-image:linear-gradient(45deg,#333 25%,transparent 25%),linear-gradient(-45deg,#333 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#333 75%),linear-gradient(-45deg,transparent 75%,#333 75%);background-size:16px 16px;background-position:0 0,0 8px,8px -8px,-8px 0;background-color:#222';

    b.innerHTML = '<div class="scroll pad" style="flex:1"><div style="max-width:1040px">' +
      '<div class="row" style="align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:10px">' +
        '<h2 style="margin:0">🪄 Media Lab</h2>' +
        '<div class="row" id="mlTabs" style="gap:6px;flex-wrap:wrap">' +
          '<button class="ib on" data-t="rembg">✂️ Background Remover</button>' +
          '<button class="ib" data-t="realesrgan">🔍 AI Upscaler</button>' +
          '<button class="ib" data-t="demucs">🎚️ Stem Splitter</button>' +
        '</div>' +
        '<span class="sp"></span>' +
        '<button class="ib" id="mlTutBtn" title="Interactive step-by-step guide with sample files">🎓 Guide</button>' +
        '<button class="ib" id="mlSetupBtn" style="display:none">⚙ Install / Verify</button>' +
        '<button class="ib dang" id="mlStopBtn" style="display:none">■ Stop job</button>' +
      '</div>' +
      '<div id="mlBanner"></div>' +
      /* ---- rembg pane ---- */
      '<div id="ml-rembg" class="card">' +
        '<b>✂️ Background Remover <span class="small mute">(danielgatis/rembg · offline ONNX)</span></b>' +
        '<div class="small mute" style="margin:4px 0 10px">Removes backgrounds to transparent PNGs. Great for photos, game sprites, and pixel art. Weights download once (~43–178 MB).</div>' +
        '<div id="rbDrop" style="border:2px dashed var(--line);border-radius:12px;padding:18px;text-align:center;cursor:pointer">' +
          '<div id="rbLabel"><b>Drop an image here, or click to choose</b><div class="small mute">PNG · JPG · WEBP</div></div>' +
          '<input id="rbFile" type="file" accept="image/*" style="display:none">' +
        '</div>' +
        '<div class="row" style="gap:10px;margin-top:10px;align-items:center;flex-wrap:wrap">' +
          '<label class="small">Model <select id="rbModel"></select></label>' +
          '<label class="chk small"><input type="checkbox" id="rbAlpha"> Alpha matting (finer hair/edges)</label>' +
          '<label class="chk small"><input type="checkbox" id="rbMask"> Output mask only</label>' +
          '<span class="sp"></span>' +
          '<button class="pri" id="rbGo">✂️ Remove Background</button>' +
        '</div>' +
      '</div>' +
      /* ---- Real-ESRGAN pane ---- */
      '<div id="ml-realesrgan" class="card" style="display:none">' +
        '<b>🔍 AI Image Upscaler <span class="small mute">(xinntao/Real-ESRGAN · CUDA FP16)</span></b>' +
        '<div class="small mute" style="margin:4px 0 10px">Sharpen &amp; upscale photos, illustrations, and sprites 2× or 4× offline. Uses tiled inference to stay safely within 8 GB VRAM.</div>' +
        '<div id="esDrop" style="border:2px dashed var(--line);border-radius:12px;padding:18px;text-align:center;cursor:pointer">' +
          '<div id="esLabel"><b>Drop an image here, or click to choose</b><div class="small mute">PNG · JPG · WEBP</div></div>' +
          '<input id="esFile" type="file" accept="image/*" style="display:none">' +
        '</div>' +
        '<div class="row" style="gap:10px;margin-top:10px;align-items:center;flex-wrap:wrap">' +
          '<label class="small">Model <select id="esModel"></select></label>' +
          '<label class="small">Scale <select id="esScale"><option value="4">4× (native)</option><option value="2">2×</option></select></label>' +
          '<label class="small">Tile <select id="esTile"><option value="256">256 px (8 GB safe)</option><option value="384">384 px</option><option value="192">192 px (low VRAM)</option></select></label>' +
          '<span class="sp"></span>' +
          '<button class="pri" id="esGo">🔍 Upscale Image</button>' +
        '</div>' +
      '</div>' +
      /* ---- Demucs pane ---- */
      '<div id="ml-demucs" class="card" style="display:none">' +
        '<b>🎚️ Music Stem Splitter <span class="small mute">(facebookresearch/demucs · CUDA)</span></b>' +
        '<div class="small mute" style="margin:4px 0 10px">Separate any song into clean Vocals, Drums, Bass, and Other stems offline.</div>' +
        '<div id="dmDrop" style="border:2px dashed var(--line);border-radius:12px;padding:18px;text-align:center;cursor:pointer">' +
          '<div id="dmLabel"><b>Drop an audio track here, or click to choose</b><div class="small mute">MP3 · WAV · FLAC · OGG · M4A</div></div>' +
          '<input id="dmFile" type="file" accept="audio/*" style="display:none">' +
        '</div>' +
        '<div class="row" style="gap:10px;margin-top:10px;align-items:center;flex-wrap:wrap">' +
          '<label class="small" style="flex:1;min-width:200px">Or pick from Moundshroud library <select id="dmTrack" style="max-width:100%"><option value="">(uploaded file above)</option></select></label>' +
          '<label class="small">Model <select id="dmModel"></select></label>' +
          '<label class="small">Mode <select id="dmMode"><option value="">All stems (Vocals / Drums / Bass / Other)</option><option value="vocals">2 stems (Vocals + Instrumental)</option></select></label>' +
          '<button class="pri" id="dmGo">🎚️ Split Stems</button>' +
        '</div>' +
      '</div>' +
      /* ---- active job log + results ---- */
      '<div id="mlActive" style="margin-top:12px"></div>' +
      '<div id="mlResults" style="margin-top:12px"></div>' +
    '</div></div>';

    const $ = id => b.querySelector('#' + id);

    function switchTab(t) {
      tab = t;
      ['rembg', 'realesrgan', 'demucs'].forEach(k => {
        $('ml-' + k).style.display = k === tab ? '' : 'none';
      });
      $('mlTabs').querySelectorAll('[data-t]').forEach(x => x.classList.toggle('on', x.dataset.t === tab));
      drawResults();
    }

    function fillSelect(sel, items) {
      if (!sel || !items || sel.options.length) return;
      sel.innerHTML = items.map(m => '<option value="' + esc(m.id) + '">' + esc(m.name) + '</option>').join('');
    }

    function drawResults() {
      if (!st) return;
      const list = (st.jobs || []).filter(j => j.tool === tab).slice(0, 12);
      if (!list.length) {
        $('mlResults').innerHTML = '<div class="small mute">No completed outputs here yet.</div>';
        return;
      }
      $('mlResults').innerHTML = list.map(j => {
        const badge = j.status === 'done' ? '✅' : j.status === 'running' ? '⏳' : j.status === 'stopped' ? '⏹' : '⚠️';
        let body = '';
        if (j.status === 'done' && (j.tool === 'rembg' || j.tool === 'realesrgan')) {
          const inUrl = '/api/toolkit/file?id=' + encodeURIComponent(j.id) + '&name=' + encodeURIComponent(j.inputFile || 'input.png');
          const outUrl = '/api/toolkit/file?id=' + encodeURIComponent(j.id) + '&name=' + encodeURIComponent(j.outputFile || 'output.png');
          const res = j.result || {};
          const dims = res.origWidth ? (res.origWidth + '×' + res.origHeight + ' → ' + res.width + '×' + res.height) : (res.width ? (res.width + '×' + res.height) : '');
          body = '<div class="row" style="gap:12px;margin-top:8px;flex-wrap:wrap">' +
            '<div style="flex:1;min-width:220px"><div class="small mute" style="margin-bottom:4px">Original</div><img src="' + inUrl + '" style="max-width:100%;max-height:280px;border-radius:8px;border:1px solid var(--line);display:block"></div>' +
            '<div style="flex:1;min-width:220px"><div class="small mute" style="margin-bottom:4px">Output ' + esc(dims) + '</div><div style="border-radius:8px;overflow:hidden;border:1px solid var(--line);display:inline-block;' + CHECKER + '"><img src="' + outUrl + '" style="max-width:100%;max-height:280px;display:block"></div></div>' +
          '</div>' +
          '<div class="row" style="gap:8px;margin-top:8px"><a class="pri" href="' + outUrl + '&dl=1">⬇ Download PNG</a></div>';
        } else if (j.status === 'done' && j.tool === 'demucs') {
          const stems = (j.result && j.result.stems) || [];
          body = '<div style="margin-top:8px">' + stems.map(s => {
            const u = '/api/toolkit/file?id=' + encodeURIComponent(j.id) + '&name=' + encodeURIComponent(s.file);
            return '<div class="row" style="gap:8px;align-items:center;padding:5px 0;border-top:1px solid var(--line);flex-wrap:wrap">' +
              '<b style="width:90px;text-transform:capitalize">' + esc(s.name) + '</b>' +
              '<audio controls preload="none" src="' + u + '" style="flex:1;min-width:220px;height:32px"></audio>' +
              '<a class="ib" href="' + u + '&dl=1">⬇ WAV (' + kb(s.bytes) + ')</a></div>';
          }).join('') + '</div>';
        } else if (j.status === 'failed') {
          body = '<div class="small warn" style="margin-top:6px">' + esc(j.error || 'Job failed.') + '</div>';
        }
        return '<div class="card" style="margin-bottom:10px">' +
          '<div class="row" style="gap:8px;align-items:center">' +
            '<b>' + badge + ' ' + esc(j.filename || j.id) + '</b>' +
            '<span class="small mute">' + esc(j.model || '') + (j.scale ? ' · ' + j.scale + '×' : '') + ' · ' + esc(j.status) + '</span>' +
            '<span class="sp"></span>' +
            '<button class="ib dang" data-del="' + esc(j.id) + '">✕</button>' +
          '</div>' + body + '</div>';
      }).join('');
    }

    async function poll() {
      const s = await A.api('/api/toolkit/status').catch(() => null);
      if (!s || !b.isConnected) return;
      st = s;
      if (s.catalog) {
        fillSelect($('rbModel'), s.catalog.rembgModels);
        fillSelect($('esModel'), s.catalog.esrganModels);
        fillSelect($('dmModel'), s.catalog.demucsModels);
      }
      const trSel = $('dmTrack');
      if (trSel && trSel.options.length <= 1 && (s.audioSources || []).length) {
        trSel.innerHTML = '<option value="">(uploaded file above)</option>' +
          s.audioSources.map(a => '<option value="' + esc(a.path) + '">' + esc(a.name) + ' (' + kb(a.size) + ')</option>').join('');
      }
      const ready = !!s.ready;
      $('mlSetupBtn').style.display = ready ? 'none' : '';
      $('mlStopBtn').style.display = s.activeJob ? '' : 'none';
      if (!ready || s.setupRunning) {
        $('mlBanner').innerHTML = '<div class="card" style="margin-bottom:10px"><b>' + (s.setupRunning ? '⏳ Installing Media Lab engines…' : '⚙️ One-time toolkit setup needed') + '</b>' +
          '<div class="small mute" style="margin-top:4px">Click Install / Verify to set up rembg, Real-ESRGAN, and Demucs in Moundshroud\'s CUDA Python environment.</div>' +
          (s.setupLog ? '<pre class="small" style="max-height:150px;overflow:auto;margin-top:6px;white-space:pre-wrap">' + esc(s.setupLog) + '</pre>' : '') + '</div>';
      } else {
        $('mlBanner').innerHTML = '';
      }
      if (s.activeJob && ['rembg', 'realesrgan', 'demucs'].includes(s.activeJob.tool)) {
        watchId = s.activeJob.id;
        $('mlActive').innerHTML = '<div class="card"><b>⏳ Running ' + esc(s.activeJob.tool) + ' · ' + esc(s.activeJob.filename || '') + '</b>' +
          '<pre class="small" style="max-height:180px;overflow:auto;margin-top:6px;white-space:pre-wrap">' + esc(s.activeJob.log || 'Starting…') + '</pre></div>';
      } else if (watchId) {
        const done = await A.api('/api/toolkit/job?id=' + encodeURIComponent(watchId)).catch(() => null);
        watchId = '';
        if (done && done.status === 'failed') {
          $('mlActive').innerHTML = '<div class="card"><b class="warn">⚠️ ' + esc(done.error || 'Job failed') + '</b>' +
            '<pre class="small" style="max-height:180px;overflow:auto;margin-top:6px;white-space:pre-wrap">' + esc(done.log || '') + '</pre></div>';
        } else {
          $('mlActive').innerHTML = '';
        }
      }
      drawResults();
      const busy = !!(s.setupRunning || s.activeJob);
      if (busy && !timer) timer = setInterval(poll, 1600);
      if (!busy && timer) { clearInterval(timer); timer = null; }
    }

    function wireDrop(dropId, inputId, labelId, setter) {
      const dz = $(dropId), inp = $(inputId), lbl = $(labelId);
      const take = f => { if (!f) return; setter(f); lbl.innerHTML = '<b>Selected: ' + esc(f.name) + '</b> <span class="small mute">(' + kb(f.size) + ')</span>'; };
      dz.onclick = () => inp.click();
      dz.ondragover = e => { e.preventDefault(); dz.style.borderColor = 'var(--clay)'; };
      dz.ondragleave = () => { dz.style.borderColor = 'var(--line)'; };
      dz.ondrop = e => { e.preventDefault(); dz.style.borderColor = 'var(--line)'; take(e.dataTransfer.files[0]); };
      inp.onchange = e => { take(e.target.files[0]); e.target.value = ''; };
    }
    wireDrop('rbDrop', 'rbFile', 'rbLabel', f => { imgFile = f; });
    wireDrop('esDrop', 'esFile', 'esLabel', f => { upFile = f; });
    wireDrop('dmDrop', 'dmFile', 'dmLabel', f => { audFile = f; });

    $('mlTabs').onclick = e => { const x = e.target.closest('[data-t]'); if (x) switchTab(x.dataset.t); };
    $('mlTutBtn').onclick = () => A.repoTutorial && A.repoTutorial.open(tab);
    $('mlSetupBtn').onclick = async () => { await A.api('/api/toolkit/setup', {}); A.toast('Toolkit setup started'); poll(); };
    $('mlStopBtn').onclick = async () => { await A.api('/api/toolkit/stop', {}); A.toast('Stopped'); poll(); };

    $('rbGo').onclick = async () => {
      if (!imgFile) return A.toast('Drop or choose an image first.');
      const dataBase64 = await readAsBase64(imgFile);
      const r = await A.api('/api/toolkit/rembg', { filename: imgFile.name, dataBase64, model: $('rbModel').value, alphaMatting: $('rbAlpha').checked, onlyMask: $('rbMask').checked });
      if (!r.ok) return A.toast(r.error || 'Could not start rembg.');
      watchId = r.id; poll();
    };
    $('esGo').onclick = async () => {
      if (!upFile) return A.toast('Drop or choose an image first.');
      const dataBase64 = await readAsBase64(upFile);
      const r = await A.api('/api/toolkit/upscale', { filename: upFile.name, dataBase64, model: $('esModel').value, scale: +$('esScale').value, tile: +$('esTile').value });
      if (!r.ok) return A.toast(r.error || 'Could not start Real-ESRGAN.');
      watchId = r.id; poll();
    };
    $('dmGo').onclick = async () => {
      const trackPath = $('dmTrack').value;
      if (!audFile && !trackPath) return A.toast('Drop an audio file or pick a track from your library.');
      const body = { model: $('dmModel').value, twoStems: $('dmMode').value };
      if (audFile) { body.filename = audFile.name; body.dataBase64 = await readAsBase64(audFile); }
      else { body.trackPath = trackPath; }
      const r = await A.api('/api/toolkit/demucs', body);
      if (!r.ok) return A.toast(r.error || 'Could not start Demucs.');
      watchId = r.id; poll();
    };
    $('mlResults').onclick = async e => {
      const d = e.target.closest('[data-del]');
      if (!d) return;
      await A.api('/api/toolkit/delete', { id: d.dataset.del });
      poll();
    };

    b._cleanup = () => { if (timer) clearInterval(timer); };
    poll();
  }

  A.mediaLab = { render };
  if (A.studio && A.studio.reg) A.studio.reg('medialab', '🪄 Media Lab', body => render(body), 5);
  if (A.cmd && A.cmd.reg) A.cmd.reg([
    { title: 'Media Lab — Background Remover, AI Upscaler & Stem Splitter', sub: 'Offline rembg, Real-ESRGAN 4x upscaling, and Demucs music stem separation', icon: '🪄', group: 'Studio', tags: 'rembg background remove realesrgan upscale demucs stems vocals drums bass audio image', run: () => A.studio && A.studio.go('medialab') },
  ]);
})();

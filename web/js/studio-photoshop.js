// Studio > Photo Editor: fuses viliusle/miniPaint (full layered Photoshop-style HTML5 editor)
// with offline GPU AI tools: LaMa Magic Eraser (Sanster/IOPaint big-lama), AI Background Removal (rembg),
// and 2x/4x AI Upscaling (Real-ESRGAN). Every AI pass grabs the live canvas and injects the result back as a layer.
(() => {
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  function readAsDataUrl(file) {
    return new Promise((res, rej) => {
      const fr = new FileReader();
      fr.onload = () => res(String(fr.result || ''));
      fr.onerror = () => rej(new Error('Could not read file.'));
      fr.readAsDataURL(file);
    });
  }

  async function urlToDataUrl(url) {
    const r = await fetch(url);
    if (!r.ok) throw new Error('Could not load AI output.');
    const blob = await r.blob();
    return readAsDataUrl(blob);
  }

  function render(b) {
    let busy = false, pollTimer = null, maskOpen = false;
    let srcDataUrl = '', resultDataUrl = '', showOrig = false;
    let imgW = 0, imgH = 0, drawing = false, lastPt = null, undoStack = [];

    b.innerHTML = '<div style="display:flex;flex-direction:column;flex:1;min-height:0;position:relative">' +
      /* ---- slim unified AI toolbar above miniPaint ---- */
      '<div class="row" style="padding:6px 12px;gap:6px;align-items:center;border-bottom:1px solid var(--line);flex-wrap:wrap;background:var(--panel)">' +
        '<b style="margin-right:4px">🖼️ Photo Editor</b>' +
        '<button class="ib" id="peOpen" title="Open an image file into the editor">📁 Open Photo</button>' +
        '<input id="peFile" type="file" accept="image/*" style="display:none">' +
        '<button class="pri" id="peErase" title="Paint over objects, people, text or watermarks to erase them with local LaMa AI">✨ AI Magic Eraser</button>' +
        '<button class="ib" id="peRembg" title="Remove background from the current canvas with rembg AI and add as a new layer">✂️ AI Remove BG</button>' +
        '<select id="peUpScale" class="ib" style="padding:4px 8px" title="Upscale factor"><option value="2">2× AI Upscale</option><option value="4">4× AI Upscale</option></select>' +
        '<button class="ib" id="peUpscale" title="Upscale current canvas with Real-ESRGAN on GPU">🔍 Run</button>' +
        '<button class="ib" id="peAlbum" title="Save current composite image into your Art Albums">💾 Save to Album</button>' +
        '<button class="ib" id="peTut" title="Interactive step-by-step guide with a practice photo">🎓 Guide</button>' +
        '<span class="sp"></span>' +
        '<span class="small mute" id="peStat">miniPaint + LaMa / rembg / Real-ESRGAN · 100% offline</span>' +
        '<button class="ib dang" id="peStop" style="display:none">■ Stop</button>' +
      '</div>' +

      /* ---- full miniPaint Photoshop editor ---- */
      '<div id="peMain" style="flex:1;min-height:0;display:flex;position:relative">' +
        '<iframe id="peFrame" src="/minipaint/" style="flex:1;border:0;width:100%;height:100%;background:#1e1e1e"></iframe>' +

        /* ---- interactive LaMa AI Magic Eraser overlay ---- */
        '<div id="peMaskWrap" style="display:none;position:absolute;inset:0;background:var(--bg);z-index:20;flex-direction:column">' +
          '<div class="row" style="padding:8px 12px;gap:8px;align-items:center;border-bottom:1px solid var(--line);flex-wrap:wrap;background:var(--panel)">' +
            '<b>✨ AI Magic Eraser <span class="small mute">(LaMa · paint red over what to remove)</span></b>' +
            '<label class="small mute">Brush <input id="peBrush" type="range" min="6" max="120" value="32" style="width:96px;vertical-align:middle"> <span id="peBrushVal">32</span>px</label>' +
            '<label class="small mute">Edge expand <select id="peDilate"><option value="3">3 px</option><option value="5" selected>5 px</option><option value="9">9 px</option></select></label>' +
            '<button class="ib" id="peUndo">↶ Undo</button>' +
            '<button class="ib" id="peClear">Clear mask</button>' +
            '<button class="pri" id="peRunErase">✨ Erase Masked Area</button>' +
            '<span class="sp"></span>' +
            '<button class="ib" id="peToggleOrig" style="display:none">👁 Hold/Toggle Original</button>' +
            '<button class="ib" id="peEraseMore" style="display:none">➕ Erase More</button>' +
            '<button class="pri" id="peApply" style="display:none">✓ Apply to Photo Editor</button>' +
            '<button class="ib" id="peCancel">✕ Close</button>' +
          '</div>' +
          '<div style="flex:1;min-height:0;display:flex;align-items:center;justify-content:center;overflow:auto;padding:14px;background:#14161d">' +
            '<div id="peStage" style="position:relative;display:inline-block;line-height:0;border:1px solid var(--line);border-radius:8px;overflow:hidden;box-shadow:0 8px 30px rgba(0,0,0,.45)">' +
              '<canvas id="peImgCv" style="display:block;max-width:88vw;max-height:74vh;width:auto;height:auto"></canvas>' +
              '<canvas id="peMskCv" style="position:absolute;inset:0;width:100%;height:100%;cursor:crosshair;touch-action:none"></canvas>' +
            '</div>' +
          '</div>' +
          '<div class="row" style="padding:6px 12px;border-top:1px solid var(--line);background:var(--panel);gap:10px;align-items:center">' +
            '<span class="small mute" id="peEraseMsg">Paint over unwanted objects, text, or blemishes, then click Erase Masked Area. First run downloads big-lama.pt (~196 MB) once.</span>' +
          '</div>' +
        '</div>' +
      '</div>' +
    '</div>';

    const $ = id => b.querySelector('#' + id);
    const frame = $('peFrame'), imgCv = $('peImgCv'), mskCv = $('peMskCv');
    const imgCtx = imgCv.getContext('2d'), mskCtx = mskCv.getContext('2d');

    function setStat(msg, isBusy) {
      busy = !!isBusy;
      $('peStat').textContent = msg;
      $('peStop').style.display = busy ? '' : 'none';
      ['peErase', 'peRembg', 'peUpscale'].forEach(id => { const el = $(id); if (el) el.disabled = busy; });
    }

    function grabMiniPaintDataUrl() {
      const w = frame.contentWindow;
      if (!w || !w.Layers || !w.AppConfig) return '';
      const W = w.AppConfig.WIDTH || 0, H = w.AppConfig.HEIGHT || 0;
      if (!W || !H) return '';
      const cv = document.createElement('canvas');
      cv.width = W; cv.height = H;
      const ctx = cv.getContext('2d');
      w.Layers.convert_layers_to_canvas(ctx, null, false);
      return cv.toDataURL('image/png');
    }

    function pushToMiniPaint(dataUrl) {
      const w = frame.contentWindow;
      if (!w || !w.FileOpen || !w.FileOpen.file_open_data_url_handler) {
        A.toast('Photo Editor is still loading — try again in a second.');
        return false;
      }
      w.FileOpen.file_open_data_url_handler(dataUrl);
      return true;
    }

    function waitForJob(jobId, label, onDone) {
      if (pollTimer) clearInterval(pollTimer);
      setStat('⏳ ' + label + '…', true);
      pollTimer = setInterval(async () => {
        if (!b.isConnected) { clearInterval(pollTimer); pollTimer = null; return; }
        const j = await A.api('/api/toolkit/job?id=' + encodeURIComponent(jobId)).catch(() => null);
        if (!j) return;
        if (j.status === 'running') {
          const last = String(j.log || '').trim().split('\n').filter(Boolean).pop() || '';
          if (last) {
            setStat('⏳ ' + last.slice(0, 90), true);
            if (maskOpen) $('peEraseMsg').textContent = '⏳ ' + last.slice(0, 140);
          }
          return;
        }
        clearInterval(pollTimer); pollTimer = null;
        if (j.status === 'done') {
          setStat('✅ ' + label + ' complete', false);
          onDone(j);
        } else {
          const msg = j.error || ('Stopped (' + j.status + ')');
          setStat('⚠️ ' + msg, false);
          if (maskOpen) $('peEraseMsg').textContent = '⚠️ ' + msg;
          A.toast(msg, 6000);
        }
      }, 900);
    }

    /* ---- open local file straight into miniPaint ---- */
    $('peTut').onclick = () => A.repoTutorial && A.repoTutorial.open('photoshop');
    $('peOpen').onclick = () => $('peFile').click();
    $('peFile').onchange = async e => {
      const f = e.target.files[0]; e.target.value = '';
      if (!f) return;
      try {
        const dataUrl = await readAsDataUrl(f);
        if (pushToMiniPaint(dataUrl)) A.toast('Opened ' + f.name + ' in Photo Editor');
      } catch (err) { A.toast(String(err.message || err)); }
    };

    /* ---- Save composite to Art Albums ---- */
    $('peAlbum').onclick = () => {
      const dataUrl = grabMiniPaintDataUrl();
      if (!dataUrl) return A.toast('Nothing on the canvas yet.');
      fetch(dataUrl).then(r => r.blob()).then(blob => {
        if (window.ArtAlbums && ArtAlbums.add) { ArtAlbums.add(blob, { name: 'Photo Edit', source: 'Photo Editor' }); A.toast('Saved to Art Albums'); }
        else {
          const a = document.createElement('a'); a.href = dataUrl; a.download = 'photo-edit.png'; a.click();
          A.toast('Downloaded PNG');
        }
      }).catch(() => A.toast('Could not export canvas.'));
    };

    /* ---- One-click AI Remove BG (rembg) -> new layer in miniPaint ---- */
    $('peRembg').onclick = async () => {
      if (busy) return;
      const dataUrl = grabMiniPaintDataUrl();
      if (!dataUrl) return A.toast('Open or draw an image first.');
      const r = await A.api('/api/toolkit/rembg', { filename: 'canvas.png', dataBase64: dataUrl, model: 'isnet-general-use' }).catch(e => ({ ok: false, error: e.message }));
      if (!r || !r.ok) return A.toast((r && r.error) || 'Could not start AI Remove BG.');
      waitForJob(r.id, 'AI Remove BG (rembg)', async j => {
        try {
          const outUrl = '/api/toolkit/file?id=' + encodeURIComponent(j.id) + '&name=output.png';
          const png = await urlToDataUrl(outUrl);
          pushToMiniPaint(png);
          A.toast('Background removed and added as a new layer!');
        } catch (err) { A.toast(String(err.message || err)); }
      });
    };

    /* ---- One-click AI Upscale (Real-ESRGAN) -> resized layer in miniPaint ---- */
    $('peUpscale').onclick = async () => {
      if (busy) return;
      const dataUrl = grabMiniPaintDataUrl();
      if (!dataUrl) return A.toast('Open or draw an image first.');
      const scale = +$('peUpScale').value || 2;
      const r = await A.api('/api/toolkit/upscale', { filename: 'canvas.png', dataBase64: dataUrl, model: 'RealESRGAN_x4plus', scale, tile: 256 }).catch(e => ({ ok: false, error: e.message }));
      if (!r || !r.ok) return A.toast((r && r.error) || 'Could not start AI Upscaler.');
      waitForJob(r.id, scale + '× AI Upscale (Real-ESRGAN)', async j => {
        try {
          const outUrl = '/api/toolkit/file?id=' + encodeURIComponent(j.id) + '&name=output.png';
          const png = await urlToDataUrl(outUrl);
          pushToMiniPaint(png);
          const res = j.result || {};
          A.toast('Upscaled to ' + (res.width || '?') + '×' + (res.height || '?') + ' and loaded into Photo Editor!');
        } catch (err) { A.toast(String(err.message || err)); }
      });
    };

    $('peStop').onclick = async () => {
      await A.api('/api/toolkit/stop', {}).catch(() => { });
      if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
      setStat('Stopped', false);
    };

    /* ---- Interactive LaMa AI Magic Eraser overlay ---- */
    function loadIntoMaskCanvas(dataUrl, keepMask) {
      return new Promise((res, rej) => {
        const im = new Image();
        im.onload = () => {
          imgW = im.naturalWidth; imgH = im.naturalHeight;
          imgCv.width = imgW; imgCv.height = imgH;
          imgCtx.clearRect(0, 0, imgW, imgH);
          imgCtx.drawImage(im, 0, 0);
          if (!keepMask) {
            mskCv.width = imgW; mskCv.height = imgH;
            mskCtx.clearRect(0, 0, imgW, imgH);
            undoStack = [];
          }
          res();
        };
        im.onerror = () => rej(new Error('Could not decode canvas image.'));
        im.src = dataUrl;
      });
    }

    function setResultMode(hasResult) {
      $('peToggleOrig').style.display = hasResult ? '' : 'none';
      $('peEraseMore').style.display = hasResult ? '' : 'none';
      $('peApply').style.display = hasResult ? '' : 'none';
      mskCv.style.pointerEvents = hasResult ? 'none' : 'auto';
      mskCv.style.opacity = hasResult ? '0' : '0.58';
    }

    $('peErase').onclick = async () => {
      if (busy) return;
      const dataUrl = grabMiniPaintDataUrl();
      if (!dataUrl) return A.toast('Open or draw an image in Photo Editor first.');
      srcDataUrl = dataUrl; resultDataUrl = ''; showOrig = false;
      try {
        await loadIntoMaskCanvas(srcDataUrl, false);
        maskOpen = true;
        $('peMaskWrap').style.display = 'flex';
        setResultMode(false);
        $('peEraseMsg').textContent = 'Paint red over anything you want to remove, then click Erase Masked Area.';
      } catch (err) { A.toast(String(err.message || err)); }
    };

    const brushPos = e => {
      const r = mskCv.getBoundingClientRect();
      return [(e.clientX - r.left) * mskCv.width / r.width, (e.clientY - r.top) * mskCv.height / r.height];
    };
    const drawSeg = (a, c) => {
      const sz = Math.max(4, +$('peBrush').value * Math.max(1, mskCv.width / Math.max(1, mskCv.getBoundingClientRect().width)));
      mskCtx.strokeStyle = '#ff2a55';
      mskCtx.fillStyle = '#ff2a55';
      mskCtx.lineWidth = sz;
      mskCtx.lineCap = 'round';
      mskCtx.lineJoin = 'round';
      mskCtx.beginPath();
      mskCtx.moveTo(a[0], a[1]);
      mskCtx.lineTo(c[0], c[1]);
      mskCtx.stroke();
    };
    mskCv.onpointerdown = e => {
      e.preventDefault();
      mskCv.setPointerCapture(e.pointerId);
      undoStack.push(mskCtx.getImageData(0, 0, mskCv.width, mskCv.height));
      if (undoStack.length > 25) undoStack.shift();
      drawing = true;
      lastPt = brushPos(e);
      drawSeg(lastPt, [lastPt[0] + 0.1, lastPt[1]]);
    };
    mskCv.onpointermove = e => {
      if (!drawing) return;
      const pt = brushPos(e);
      drawSeg(lastPt, pt);
      lastPt = pt;
    };
    mskCv.onpointerup = () => { drawing = false; lastPt = null; };
    $('peBrush').oninput = () => { $('peBrushVal').textContent = $('peBrush').value; };
    $('peUndo').onclick = () => { if (undoStack.length) mskCtx.putImageData(undoStack.pop(), 0, 0); };
    $('peClear').onclick = () => { undoStack.push(mskCtx.getImageData(0, 0, mskCv.width, mskCv.height)); mskCtx.clearRect(0, 0, mskCv.width, mskCv.height); };

    $('peRunErase').onclick = async () => {
      if (busy) return;
      const maskBase64 = mskCv.toDataURL('image/png');
      $('peEraseMsg').textContent = '⏳ Running LaMa AI Magic Eraser…';
      const r = await A.api('/api/toolkit/inpaint', {
        filename: 'canvas.png',
        imageBase64: srcDataUrl,
        maskBase64,
        dilate: +$('peDilate').value || 5,
      }).catch(e => ({ ok: false, error: e.message }));
      if (!r || !r.ok) { $('peEraseMsg').textContent = '⚠️ ' + ((r && r.error) || 'Could not start LaMa.'); return; }
      waitForJob(r.id, 'AI Magic Eraser (LaMa)', async j => {
        try {
          const outUrl = '/api/toolkit/file?id=' + encodeURIComponent(j.id) + '&name=output.png';
          resultDataUrl = await urlToDataUrl(outUrl);
          showOrig = false;
          await loadIntoMaskCanvas(resultDataUrl, true);
          setResultMode(true);
          $('peEraseMsg').textContent = '✅ Object erased! Click "Apply to Photo Editor" to keep it as a new layer, or "Erase More" to remove another spot.';
        } catch (err) { $('peEraseMsg').textContent = '⚠️ ' + String(err.message || err); }
      });
    };

    $('peToggleOrig').onclick = async () => {
      if (!resultDataUrl) return;
      showOrig = !showOrig;
      await loadIntoMaskCanvas(showOrig ? srcDataUrl : resultDataUrl, true);
      $('peToggleOrig').textContent = showOrig ? '👁 Showing Original (click for Result)' : '👁 Show Original';
    };

    $('peEraseMore').onclick = async () => {
      if (!resultDataUrl) return;
      srcDataUrl = resultDataUrl; resultDataUrl = ''; showOrig = false;
      await loadIntoMaskCanvas(srcDataUrl, false);
      setResultMode(false);
      $('peEraseMsg').textContent = 'Paint over the next area you want to erase.';
    };

    $('peApply').onclick = () => {
      if (!resultDataUrl) return;
      pushToMiniPaint(resultDataUrl);
      maskOpen = false;
      $('peMaskWrap').style.display = 'none';
      A.toast('Applied AI Magic Eraser result as a new layer!');
    };

    $('peCancel').onclick = () => {
      maskOpen = false;
      $('peMaskWrap').style.display = 'none';
    };

    b._cleanup = () => { if (pollTimer) clearInterval(pollTimer); };
  }

  A.photoEditor = { render };
  if (A.studio && A.studio.reg) A.studio.reg('photoed', '🖼️ Photo Editor', body => render(body), 1.5);
  if (A.cmd && A.cmd.reg) A.cmd.reg([
    { title: 'Photo Editor — Photoshop + AI Magic Eraser', sub: 'Full layered photo editor (miniPaint) with LaMa object removal, AI background cutout & 4x upscaling', icon: '🖼️', group: 'Studio', tags: 'photoshop photo editor minipaint iopaint lama magic eraser inpaint layers filters clone stamp', run: () => A.studio && A.studio.go('photoed') },
  ]);
})();

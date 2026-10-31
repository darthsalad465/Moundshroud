// Tools > Scanner: read the text in a photo, screenshot or scan with the OCR engine built into Windows. Nothing leaves this PC.
(() => {
  const toPng = (src) => new Promise((res, rej) => {
    const img = new Image(); img.onload = () => { const max = 3200, k = Math.min(1, max / Math.max(img.width, img.height)), c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k); const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0, c.width, c.height); c.toBlob(b => b ? res({ blob: b, url: c.toDataURL('image/jpeg', .6) }) : rej(new Error('no image')), 'image/png'); }; img.onerror = () => rej(new Error('That file is not an image Moundshroud can read.')); img.src = src;
  });
  A.scanner = {
    render(root) {
      let png = null, stream = null;
      root.innerHTML = '<div class="scroll pad" style="flex:1"><div style="max-width:820px;margin:0 auto"><h2 style="margin:0 0 4px">📷 Scanner</h2><div class="small mute" style="margin-bottom:10px">Turn a photo, screenshot or scanned page into text using the OCR engine built into Windows. Everything stays on this PC. Straight, well-lit, high-contrast pictures work best.</div>' +
        '<div id="scdrop" style="border:2px dashed var(--line);border-radius:12px;padding:22px;text-align:center;cursor:pointer">Drop an image here, paste one (Ctrl+V), or <b>choose a file</b><input type="file" id="scfile" accept="image/*" style="display:none"></div>' +
        '<div class="row" style="gap:8px;margin:8px 0;flex-wrap:wrap"><button class="ib" id="sccam">📷 Use the camera</button><button class="ib" id="scsnap" style="display:none">📸 Take photo</button><button class="pri" id="scread" disabled>🔍 Read the text</button></div>' +
        '<video id="scvid" autoplay playsinline muted style="display:none;max-width:100%;border-radius:10px"></video><img id="scimg" style="display:none;max-width:100%;max-height:300px;border-radius:10px;border:1px solid var(--line)">' +
        '<div class="small mute" id="scmsg" style="margin:6px 0"></div><textarea id="sctxt" rows="12" style="width:100%;display:none" placeholder="The text appears here"></textarea>' +
        '<div class="row" id="scact" style="gap:6px;margin-top:6px;flex-wrap:wrap;display:none"><button class="ib" id="sccopy">📋 Copy</button><button class="ib" id="scnote">📝 Save to Notes</button><button class="ib" id="sctidy">✨ Tidy with AI</button></div></div></div>';
      const q = s => root.querySelector(s), msg = t => { q('#scmsg').textContent = t || ''; };
      const load = async src => { try { const r = await toPng(src); png = r.blob; q('#scimg').src = r.url; q('#scimg').style.display = ''; q('#scread').disabled = false; msg('Ready. Press “Read the text”.'); } catch (e) { msg(e.message || 'Could not open that image.'); } };
      const fromFile = f => { if (!f) return; const fr = new FileReader(); fr.onload = () => load(fr.result); fr.readAsDataURL(f); };
      q('#scdrop').onclick = () => q('#scfile').click(); q('#scfile').onchange = e => fromFile(e.target.files[0]);
      q('#scdrop').ondragover = e => { e.preventDefault(); }; q('#scdrop').ondrop = e => { e.preventDefault(); fromFile(e.dataTransfer.files[0]); };
      const onPaste = e => { const it = [...(e.clipboardData && e.clipboardData.items || [])].find(i => /^image\//.test(i.type)); if (it) { fromFile(it.getAsFile()); e.preventDefault(); } }; document.addEventListener('paste', onPaste);
      q('#sccam').onclick = async () => { if (stream) return; try { stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } }); q('#scvid').srcObject = stream; q('#scvid').style.display = ''; q('#scsnap').style.display = ''; } catch (e) { msg('The camera is blocked or missing. You can still choose a file.'); } };
      const stopCam = () => { if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; } q('#scvid').style.display = 'none'; q('#scsnap').style.display = 'none'; };
      q('#scsnap').onclick = () => { const v = q('#scvid'), c = document.createElement('canvas'); c.width = v.videoWidth; c.height = v.videoHeight; c.getContext('2d').drawImage(v, 0, 0); load(c.toDataURL('image/png')); stopCam(); };
      q('#scread').onclick = async () => {
        if (!png) return; q('#scread').disabled = true; msg('Reading... (a few seconds)');
        try { const r = await fetch('/api/ocr', { method: 'POST', body: png, headers: { 'Content-Type': 'image/png' } }), j = await r.json(); if (j.error) msg('Could not read it: ' + j.error); else { q('#sctxt').value = j.text || ''; q('#sctxt').style.display = ''; q('#scact').style.display = 'flex'; msg(j.text ? j.text.split(/\s+/).length + ' words found. Check it for mistakes.' : 'No text found in that picture.'); } }
        catch (e) { msg('Reading failed. If Moundshroud was just updated, close and reopen it so the new reader loads.'); } q('#scread').disabled = false;
      };
      q('#sccopy').onclick = () => { navigator.clipboard.writeText(q('#sctxt').value).then(() => A.toast('Copied ✓')); };
      q('#scnote').onclick = async () => { const t = q('#sctxt').value.trim(); if (!t) return; const r = await A.api('/api/notes/save', { title: 'Scan ' + new Date().toLocaleString(), content: '# Scan ' + new Date().toLocaleString() + '\n\n' + t }); A.toast(r && r.id ? 'Saved to Notes ✓' : 'Could not save.'); };
      q('#sctidy').onclick = async () => { const t = q('#sctxt').value.trim(); if (!t || !A.ai || (A.power && A.power.on)) return A.toast(t ? 'The AI model is asleep (low power).' : 'Nothing to tidy.'); const b = q('#sctidy'); b.disabled = true; msg('Tidying...'); try { const o = await A.ai.once([{ role: 'system', content: 'You fix OCR mistakes. Return ONLY the corrected text, keeping the original wording, line breaks and meaning. Do not add commentary.' }, { role: 'user', content: t }], { temp: .1 }); const c = String(o || '').replace(/<think>[\s\S]*?<\/think>/g, '').trim(); if (c) q('#sctxt').value = c; msg('Tidied. Check it once more.'); } catch (e) { msg('Could not tidy it.'); } b.disabled = false; };
      root._cleanup = () => { stopCam(); document.removeEventListener('paste', onPaste); };
    }
  };
})();

// MarkItDown (https://github.com/microsoft/markitdown) inside Tools > MarkItDown:
// converts PDFs, Word docs, PowerPoints, Excel sheets, HTML, CSV, JSON, and more into clean Markdown offline.
(() => {
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  function readAsBase64(file) {
    return new Promise((res, rej) => {
      const fr = new FileReader();
      fr.onload = () => res(String(fr.result || ''));
      fr.onerror = () => rej(new Error('Could not read file.'));
      fr.readAsDataURL(file);
    });
  }

  function render(b) {
    let lastMd = '', lastTitle = '', viewRaw = true, setupTimer = null;
    b.innerHTML = '<div class="scroll pad" style="flex:1"><div style="max-width:960px">' +
      '<div class="row" style="align-items:center;gap:10px;flex-wrap:wrap">' +
        '<h2 style="margin:0">📝 MarkItDown</h2>' +
        '<span class="small mute" style="flex:1">Convert PDF, Word, PowerPoint, Excel, HTML, CSV &amp; more into clean Markdown — 100% local via <a href="https://github.com/microsoft/markitdown" target="_blank" rel="noreferrer">microsoft/markitdown</a>.</span>' +
        '<button class="ib" id="mkTutBtn" title="Interactive step-by-step guide with a sample document">🎓 Guide</button>' +
        '<button class="ib" id="mkSetupBtn" style="display:none">⚙ Install / Verify</button>' +
      '</div>' +
      '<div id="mkSetupBox" style="display:none;margin-top:10px"></div>' +
      '<div class="card" style="margin-top:12px">' +
        '<div id="mkDrop" style="border:2px dashed var(--line);border-radius:12px;padding:20px;text-align:center;cursor:pointer">' +
          '<div style="font-size:26px">📄</div>' +
          '<b>Drop any document here, or click to browse</b>' +
          '<div class="small mute" style="margin-top:4px">PDF · DOCX · PPTX · XLSX · XLS · HTML · CSV · JSON · XML · ZIP · TXT</div>' +
          '<input id="mkFile" type="file" style="display:none">' +
        '</div>' +
        '<div class="row" style="gap:8px;margin-top:10px;flex-wrap:wrap">' +
          '<input id="mkPath" type="text" placeholder="Or paste a local file path (e.g. C:\\Users\\you\\Documents\\report.pdf)" style="flex:1;min-width:240px">' +
          '<button class="pri" id="mkGo">Convert to Markdown</button>' +
        '</div>' +
        '<div class="small mute" id="mkStat" style="margin-top:8px"></div>' +
      '</div>' +
      '<div id="mkOutWrap" style="display:none;margin-top:12px" class="card">' +
        '<div class="row" style="gap:6px;align-items:center;flex-wrap:wrap;margin-bottom:8px">' +
          '<b id="mkTitle" style="flex:1">Output</b>' +
          '<button class="ib on" id="mkRaw">Raw Markdown</button>' +
          '<button class="ib" id="mkPrev">Preview</button>' +
          '<button class="ib" id="mkCopy">📋 Copy</button>' +
          '<button class="ib" id="mkDl">⬇ Download .md</button>' +
          '<button class="pri" id="mkNote">💾 Save to Notes</button>' +
        '</div>' +
        '<textarea id="mkText" rows="18" style="width:100%;font-family:Consolas,monospace;font-size:12.5px;line-height:1.5" readonly></textarea>' +
        '<div id="mkHtml" style="display:none;max-height:480px;overflow:auto;padding:8px;border:1px solid var(--line);border-radius:8px;line-height:1.6"></div>' +
      '</div>' +
      '<div id="mkHist" style="margin-top:12px"></div>' +
    '</div></div>';

    const $ = id => b.querySelector('#' + id);

    async function refreshStatus() {
      const s = await A.api('/api/toolkit/status?tool=markitdown').catch(() => null);
      if (!s || !b.isConnected) return;
      const ok = !!(s.tools && s.tools.markitdown && s.ready);
      $('mkSetupBtn').style.display = ok ? 'none' : '';
      if (!ok || s.setupRunning) {
        $('mkSetupBox').style.display = '';
        $('mkSetupBox').innerHTML = '<div class="card">' +
          '<b>' + (s.setupRunning ? '⏳ Installing toolkit packages…' : '⚙️ One-time toolkit setup needed') + '</b>' +
          '<div class="small mute" style="margin-top:4px">Installs MarkItDown (and the other 6 lightweight tools) into Moundshroud\'s shared Python environment without changing CUDA PyTorch.</div>' +
          (s.setupLog ? '<pre class="small" style="max-height:160px;overflow:auto;margin-top:8px;white-space:pre-wrap">' + esc(s.setupLog) + '</pre>' : '') +
          '</div>';
      } else {
        $('mkSetupBox').style.display = 'none';
      }
      if (s.setupRunning && !setupTimer) setupTimer = setInterval(refreshStatus, 2000);
      if (!s.setupRunning && setupTimer) { clearInterval(setupTimer); setupTimer = null; }
      const jobs = (s.jobs || []).filter(j => j.tool === 'markitdown').slice(0, 8);
      $('mkHist').innerHTML = jobs.length ? '<div class="card"><b>Recent conversions</b>' + jobs.map(j =>
        '<div class="row small" style="padding:5px 0;border-top:1px solid var(--line);gap:8px;align-items:center">' +
        '<span style="flex:1">' + esc(j.filename || j.id) + ' <span class="mute">· ' + (j.chars || 0).toLocaleString() + ' chars</span></span>' +
        '<a class="ib" href="/api/toolkit/file?id=' + encodeURIComponent(j.id) + '&name=output.md&dl=1">⬇ .md</a>' +
        '<button class="ib dang" data-del="' + esc(j.id) + '">✕</button></div>'
      ).join('') + '</div>' : '';
    }

    function showResult(title, markdown) {
      lastTitle = title || 'Converted document';
      lastMd = markdown || '';
      $('mkOutWrap').style.display = '';
      $('mkTitle').textContent = lastTitle + ' (' + lastMd.length.toLocaleString() + ' chars)';
      $('mkText').value = lastMd;
      $('mkHtml').innerHTML = typeof md === 'function' ? md(lastMd) : esc(lastMd).replace(/\n/g, '<br>');
      syncView();
    }

    function syncView() {
      $('mkText').style.display = viewRaw ? '' : 'none';
      $('mkHtml').style.display = viewRaw ? 'none' : '';
      $('mkRaw').classList.toggle('on', viewRaw);
      $('mkPrev').classList.toggle('on', !viewRaw);
    }

    async function convertFile(file) {
      if (!file) return;
      $('mkStat').textContent = '⏳ Converting ' + file.name + '…';
      try {
        const dataBase64 = await readAsBase64(file);
        const r = await A.api('/api/toolkit/markitdown', { filename: file.name, dataBase64 });
        if (!r || !r.ok) { $('mkStat').textContent = '⚠️ ' + ((r && r.error) || 'Conversion failed.'); return; }
        $('mkStat').textContent = '✅ Converted ' + r.filename + ' (' + r.lines + ' lines, ' + r.chars.toLocaleString() + ' chars).';
        showResult(r.title || r.filename, r.markdown);
        refreshStatus();
      } catch (e) {
        $('mkStat').textContent = '⚠️ ' + String(e.message || e);
      }
    }

    async function convertPath() {
      const p = $('mkPath').value.trim();
      if (!p) return A.toast('Drop a file or enter a local file path first.');
      $('mkStat').textContent = '⏳ Converting ' + p + '…';
      const r = await A.api('/api/toolkit/markitdown', { filePath: p }).catch(e => ({ ok: false, error: e.message }));
      if (!r || !r.ok) { $('mkStat').textContent = '⚠️ ' + ((r && r.error) || 'Conversion failed.'); return; }
      $('mkStat').textContent = '✅ Converted ' + r.filename + ' (' + r.lines + ' lines, ' + r.chars.toLocaleString() + ' chars).';
      showResult(r.title || r.filename, r.markdown);
      refreshStatus();
    }

    $('mkDrop').onclick = () => $('mkFile').click();
    $('mkDrop').ondragover = e => { e.preventDefault(); $('mkDrop').style.borderColor = 'var(--clay)'; };
    $('mkDrop').ondragleave = () => { $('mkDrop').style.borderColor = 'var(--line)'; };
    $('mkDrop').ondrop = e => { e.preventDefault(); $('mkDrop').style.borderColor = 'var(--line)'; if (e.dataTransfer.files[0]) convertFile(e.dataTransfer.files[0]); };
    $('mkFile').onchange = e => { if (e.target.files[0]) convertFile(e.target.files[0]); e.target.value = ''; };
    $('mkGo').onclick = convertPath;
    $('mkPath').addEventListener('keydown', e => { if (e.key === 'Enter') convertPath(); });
    $('mkRaw').onclick = () => { viewRaw = true; syncView(); };
    $('mkPrev').onclick = () => { viewRaw = false; syncView(); };
    $('mkCopy').onclick = () => { if (lastMd) { A.copy ? A.copy(lastMd) : navigator.clipboard.writeText(lastMd); A.toast('Copied Markdown'); } };
    $('mkDl').onclick = () => {
      if (!lastMd) return;
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([lastMd], { type: 'text/markdown;charset=utf-8' }));
      a.download = (lastTitle.replace(/\.[^.]+$/, '').replace(/[^a-z0-9._-]+/gi, '_') || 'document') + '.md';
      a.click();
    };
    $('mkNote').onclick = () => {
      if (!lastMd) return;
      if (A.notes && A.notes.create) { A.notes.create(lastTitle.replace(/\.[^.]+$/, ''), lastMd); A.toast('Saved to Notes'); }
      else A.toast('Open Notes tab once, then try saving again.');
    };
    $('mkTutBtn').onclick = () => A.repoTutorial && A.repoTutorial.open('markitdown');
    $('mkSetupBtn').onclick = async () => { await A.api('/api/toolkit/setup', {}); A.toast('Toolkit setup started'); refreshStatus(); };
    $('mkHist').onclick = async e => {
      const d = e.target.closest('[data-del]');
      if (!d) return;
      await A.api('/api/toolkit/delete', { id: d.dataset.del });
      refreshStatus();
    };
    b._cleanup = () => { if (setupTimer) clearInterval(setupTimer); };
    refreshStatus();
  }

  A.markitdown = { render };
  if (A.cmd && A.cmd.reg) A.cmd.reg([
    { title: 'MarkItDown — Convert files to Markdown', sub: 'Turn PDFs, Word, PowerPoint, Excel & HTML into clean Markdown offline', icon: '📝', group: 'Tools', tags: 'markitdown markdown pdf docx pptx xlsx convert document', run: () => { A.showTab('tools'); setTimeout(() => A.tools && A.tools.go && A.tools.go('md'), 120); } },
  ]);
})();

// Documents (LibreOffice): Moundshroud writes Word files, spreadsheets, presentations and PDFs; converts files between formats; opens them in LibreOffice.
(() => {
  const KINDS = [['word', 'Word document', '.docx'], ['sheet', 'Spreadsheet', '.xlsx'], ['slides', 'Presentation', '.pptx'], ['pdf', 'PDF', '.pdf']];
  const EXAMPLE = { word: 'e.g. A one-page cover letter for a barista job / meeting minutes template / a short report on solar power', sheet: 'e.g. A monthly household budget with categories, a total row and savings / a workout log for 4 weeks', slides: 'e.g. 8 slides introducing photosynthesis to 7th graders / a pitch for a school recycling program', pdf: 'e.g. A packing checklist for a 3-day camping trip / a one-page study sheet on the French Revolution' };
  let kind = 'word', busy = false;
  const llmStream = async (prompt, onText) => {
    const r = await fetch('/api/chat', { method: 'POST', body: JSON.stringify({ model: $('model').value, stream: true, think: false, keep_alive: '3m', messages: [{ role: 'user', content: prompt }] }) });
    if (!r.ok) throw new Error('The AI engine did not answer'); const rd = r.body.getReader(), dec = new TextDecoder(); let buf = '', text = '';
    for (;;) { const { value, done } = await rd.read(); if (done) break; buf += dec.decode(value, { stream: true }); let i; while ((i = buf.indexOf('\n')) >= 0) { const ln = buf.slice(0, i).trim(); buf = buf.slice(i + 1); if (!ln) continue; try { const j = JSON.parse(ln); if (j.error) throw new Error(j.error); if (j.message && j.message.content) { text += j.message.content; onText(text); } } catch (e) { if (e.message && !/JSON/.test(e.message)) throw e; } } }
    return text;
  };
  const SLIDE_SCHEMA = { type: 'object', properties: { title: { type: 'string' }, subtitle: { type: 'string' }, slides: { type: 'array', items: { type: 'object', properties: { title: { type: 'string' }, bullets: { type: 'array', items: { type: 'string' } }, notes: { type: 'string' } }, required: ['title', 'bullets'] } } }, required: ['title', 'slides'] };
  const SHEET_SCHEMA = { type: 'object', properties: { title: { type: 'string' }, columns: { type: 'array', items: { type: 'string' } }, rows: { type: 'array', items: { type: 'array', items: { type: ['string', 'number'] } } }, sum_columns: { type: 'array', items: { type: 'string' } } }, required: ['title', 'columns', 'rows'] };
  const tidy = r => { let w = String(r).replace(/^\s*(please\s+)?(can you\s+)?(make|create|build|generate|write|draft|i need|i want)( me)?\s+/i, '').replace(/^(an?|the|some)\s+/i, '').replace(/^((one|two|three)[- ]page|short|quick|simple|brief|small)\s+/i, '').replace(/^(an?|the)\s+/i, ''); w = w.split(/\s+(?:asking|requesting|about|that|which|for|to request|to ask|with|using|on|in|from)\b|[,.;:!?]/i)[0].split(/\s+/).slice(0, 6).join(' ').trim(); return w ? w.charAt(0).toUpperCase() + w.slice(1) : 'Document'; };
  const clean = t => t.replace(/^\s*```\w*\n?/, '').replace(/\n?```\s*$/, '').trim();

  async function make(k, request, base, say) {
    const ctx = base ? '\n\nUse this material as the basis:\n---\n' + base.slice(0, 9000) + '\n---' : '';
    let content, title;
    if (k === 'word' || k === 'pdf') {
      const t = await llmStream('Write a complete, well-structured ' + (k === 'pdf' ? 'document' : 'Word document') + ' for this request: ' + request + ctx + '\n\nIf the request is for a letter, email, memo, note or message, write it in that form (date and recipient lines, greeting, short paragraphs, sign-off) with NO section headings and keep it to the length asked. Otherwise output the document as Markdown: start with a single # title, use ## section headings, short paragraphs, bullet lists and | tables | where useful. Output ONLY the document, no commentary before or after.', x => say('Writing... ' + x.split(/\s+/).length + ' words'));
      content = clean(t); title = (content.match(/^#\s+(.+)$/m) || [])[1] || tidy(request);
    } else if (k === 'sheet') {
      say('Planning the spreadsheet...');
      const r = await fetch('/api/chat', { method: 'POST', body: JSON.stringify({ model: $('model').value, stream: false, think: false, keep_alive: '3m', format: SHEET_SCHEMA, messages: [{ role: 'user', content: 'Create a spreadsheet for this request: ' + request + ctx + '\n\nReply with JSON: {"title": short name, "columns": [column headers], "rows": [[one value per column], ...], "sum_columns": [names of numeric columns that should get a total row, or an empty list]}. Keep the layout simple: 3 to 6 columns, one row per item, labels in the first column and the numbers in the columns after it (for a budget use columns like Category, Item, Amount). Fill in realistic example values the user can edit. Numeric cells must be plain numbers with no currency symbols or words. Use between 5 and 30 rows. Do not add notes or explanations as rows.' }] }) });
      const j = await r.json(); if (j.error) throw new Error(j.error); content = JSON.parse((j.message && j.message.content) || '{}'); if (!content.columns || !content.columns.length || !content.rows || !content.rows.length) throw new Error('The spreadsheet did not come out - try again'); title = content.title || tidy(request);
    } else {
      say('Planning the slides...');
      const r = await fetch('/api/chat', { method: 'POST', body: JSON.stringify({ model: $('model').value, stream: false, think: false, keep_alive: '3m', format: SLIDE_SCHEMA, messages: [{ role: 'user', content: 'Create a presentation for this request: ' + request + ctx + '\n\nReply with JSON: {"title","subtitle","slides":[{"title","bullets":[3 to 5 short bullet points],"notes":"one or two sentences the presenter could say"}]}. Use 6 to 10 content slides unless a number was requested. Keep bullets under 12 words.' }] }) });
      const j = await r.json(); if (j.error) throw new Error(j.error); content = JSON.parse((j.message && j.message.content) || '{}'); if (!content.slides || !content.slides.length) throw new Error('The slides did not come out - try again'); title = content.title || request;
    }
    say('Saving with LibreOffice...');
    const o = await A.api('/api/office/create', { kind: k, title: String(title).slice(0, 60), content });
    if (o.error) throw new Error(o.error); return o;
  }
  const row = (o, extra) => '<div class="card" style="margin-top:10px"><div class="row" style="align-items:flex-start;gap:12px">' + (o.preview ? '<img src="/api/file?path=' + encodeURIComponent(o.preview) + '" style="width:150px;border:1px solid var(--line);border-radius:8px;background:#fff">' : '') + '<div style="flex:1;min-width:0"><b style="overflow-wrap:anywhere">' + esc(o.name) + '</b><div class="small mute" style="margin:2px 0 8px;overflow-wrap:anywhere">' + esc(o.path) + '</div><div class="row" style="flex-wrap:wrap;gap:6px">' + (/\.(docx|xlsx|pptx)$/i.test(o.path) ? '<button class="pri" data-e="' + esc(o.path) + '">✏️ Edit here in Moundshroud</button>' : '') + '<button class="ib" data-o="lo" data-p="' + esc(o.path) + '">Open in LibreOffice</button><button class="ib" data-o="default" data-p="' + esc(o.path) + '">Open</button><button class="ib" data-o="folder" data-p="' + esc(o.path) + '">Show in folder</button>' + (extra || '') + '</div></div></div></div>';
  const wire = box => { box.onclick = e => { const ed = e.target.closest('[data-e]'); if (ed && A.officeEdit) return A.officeEdit.open(ed.dataset.e); const b = e.target.closest('[data-o]'); if (b) A.api('/api/office/open', { path: b.dataset.p, app: b.dataset.o }); }; };

  async function render(b, my) {
    const st = await A.api('/api/office/status').catch(() => ({ available: false }));
    b.innerHTML = '<div class="scroll pad" style="flex:1"><h2>Documents</h2><div class="mute small">Moundshroud writes real Word, Excel, PowerPoint and PDF files using LibreOffice on this PC. Files are saved in <b>Documents\\Moundshroud Documents</b>.</div>' +
      (st.available ? '' : '<div class="disc" style="margin-top:10px"><b>LibreOffice was not found.</b> Install it from libreoffice.org, then reopen this page.</div>') +
      '<div class="card" style="margin-top:10px"><b>Create with AI</b><div class="chips" id="dck" style="margin:8px 0">' + KINDS.map(k => '<span class="chip" data-k="' + k[0] + '">' + k[1] + '</span>').join('') + '</div>' +
      '<textarea id="dcr" rows="3" placeholder=""></textarea><label class="chk small mute" style="margin-top:6px"><input type="checkbox" id="dcl"> Base it on the last answer in Chat</label>' +
      '<div class="row" style="margin-top:8px"><button class="pri" id="dcgo"' + (st.available ? '' : ' disabled') + '>Create</button><span class="small mute" id="dcs"></span></div><div id="dcres"></div></div>' +
      '<div class="card"><b>Convert a file</b><div class="small mute" style="margin:2px 0 8px">Word, Excel, PowerPoint, OpenDocument, RTF, CSV, text and web pages.</div><div class="row" style="flex-wrap:wrap;gap:8px"><input type="file" id="dvf" style="flex:1;min-width:200px"><select id="dvt" style="min-width:110px"><option>pdf</option></select><button class="pri" id="dvg"' + (st.available ? '' : ' disabled') + '>Convert</button></div><div class="small mute" id="dvs" style="margin-top:6px"></div><div id="dvres"></div></div>' +
      '<div class="card"><div class="row"><b style="flex:1">Recent documents</b><button class="ib" id="dfo">Open folder</button></div><div id="drec" class="small mute" style="margin-top:6px">Loading...</div></div></div>';
    const sel = () => { document.querySelectorAll('#dck .chip').forEach(c => { const on = c.dataset.k === kind; c.style.borderColor = on ? 'var(--acc)' : ''; c.style.background = on ? 'var(--panel2)' : ''; }); $('dcr').placeholder = EXAMPLE[kind]; };
    $('dck').onclick = e => { const c = e.target.closest('[data-k]'); if (c) { kind = c.dataset.k; sel(); } }; sel();
    $('dcgo').onclick = async () => {
      const req = $('dcr').value.trim(); if (!req) return A.toast('Describe what you want first'); if (busy) return; busy = true; $('dcgo').disabled = true; $('dcres').innerHTML = '';
      const say = t => { if ($('dcs')) $('dcs').textContent = t; };
      try { const o = await make(kind, req, $('dcl').checked ? A.chat.lastExplanation() : '', say); if ($('dcres')) { $('dcres').innerHTML = row(o); wire($('dcres')); } say('Done.'); recent(); }
      catch (e) { say(''); A.toast(e.message, 5000); }
      busy = false; if ($('dcgo')) $('dcgo').disabled = false;
    };
    const TO = { doc: ['pdf', 'docx', 'odt', 'txt', 'html', 'rtf'], sheet: ['pdf', 'xlsx', 'ods', 'csv', 'html'], slides: ['pdf', 'pptx', 'odp'], other: ['pdf'] };
    $('dvf').onchange = () => { const f = $('dvf').files[0]; if (!f) return; const x = (f.name.split('.').pop() || '').toLowerCase(); const g = /^(xls|xlsx|ods|csv|tsv)$/.test(x) ? 'sheet' : /^(ppt|pptx|pps|odp)$/.test(x) ? 'slides' : /^(doc|docx|dot|odt|rtf|txt|html?|wpd)$/.test(x) ? 'doc' : 'other'; $('dvt').innerHTML = TO[g].filter(t => t !== x).map(t => '<option>' + t + '</option>').join(''); };
    $('dvg').onclick = async () => {
      const f = $('dvf').files[0]; if (!f) return A.toast('Choose a file first'); $('dvg').disabled = true; $('dvs').textContent = 'Converting (the first conversion can take a while)...'; $('dvres').innerHTML = '';
      try { const o = await (await fetch('/api/office/convert?name=' + encodeURIComponent(f.name) + '&to=' + $('dvt').value, { method: 'POST', body: await f.arrayBuffer() })).json(); if (o.error) throw new Error(o.error); $('dvres').innerHTML = row(o); wire($('dvres')); $('dvs').textContent = 'Done.'; recent(); }
      catch (e) { $('dvs').textContent = ''; A.toast(e.message, 5000); }
      $('dvg').disabled = false;
    };
    $('dfo').onclick = () => A.api('/api/office/open', { path: st.outDir, app: 'default' });
    async function recent() { const r = await A.api('/api/office/list').catch(() => ({ files: [] })); if (my !== undefined && !$('drec')) return; $('drec').innerHTML = r.files.length ? r.files.slice(0, 12).map(f => '<div class="row" style="padding:5px 0;border-top:1px solid var(--line)"><span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="' + esc(f.path) + '">' + esc(f.name) + '</span><span class="mute small">' + A.fmtAgo(f.mtime) + '</span>' + (/\.(docx|xlsx|pptx|odt|ods|odp)$/i.test(f.name) ? '<button class="ib" data-e="' + esc(f.path) + '" title="Edit it here in Moundshroud, through LibreOffice">✏️ Edit here</button>' : '') + '<button class="ib" data-o="lo" data-p="' + esc(f.path) + '">Open</button></div>').join('') : 'Nothing yet.'; wire($('drec')); $('drec').querySelectorAll('[data-e]').forEach(b => { b.onclick = () => A.officeEdit.open(b.dataset.e); }); }
    recent();
  }

  A.docs = {
    render, make,
    /* used by the chat action: open the page, fill in the request and press Create */
    create(k, request, useLast) { kind = KINDS.some(x => x[0] === k) ? k : 'word'; A.tools.go('docs'); setTimeout(() => { if (!$('dcr')) return; $('dcr').value = request; $('dcl').checked = !!useLast; document.querySelectorAll('#dck .chip').forEach(c => { if (c.dataset.k === kind) c.click(); }); $('dcgo').click(); }, 600); }
  };
})();

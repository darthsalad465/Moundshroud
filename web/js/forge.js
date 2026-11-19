// Studio > Model Forge: make your own AI language model from nothing, trained on anything you give it.
// Four steps: name it, feed it text, pick a size, forge it. Watch it learn live, then chat with it.
(() => {
  const esc = t => String(t == null ? '' : t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const mb = b => b >= 1e6 ? (b / 1e6).toFixed(1) + ' MB' : Math.max(1, Math.round(b / 1e3)) + ' KB';
  const TEXT = '.txt,.md,.markdown,.csv,.tsv,.json,.jsonl,.html,.htm,.xml,.py,.js,.ts,.jsx,.tsx,.java,.c,.h,.cpp,.hpp,.cs,.go,.rs,.rb,.php,.sh,.ps1,.bat,.yml,.yaml,.ini,.toml,.log,.tex,.rst,.srt,.vtt,.sql,.lua,.swift,.kt,.css';
  if (!document.getElementById('fg-css')) { const s = document.createElement('style'); s.id = 'fg-css'; s.textContent = `
.fg{flex:1;min-height:0;overflow:auto;padding:16px}.fg-wrap{max-width:1060px;margin:0 auto}
.fg-hero{padding:18px 20px;border-radius:16px;border:1px solid var(--line);margin-bottom:14px;background:radial-gradient(120% 140% at 0% 0%,color-mix(in srgb,var(--acc,#7c5cff) 24%,transparent),transparent 60%),radial-gradient(120% 140% at 100% 100%,color-mix(in srgb,var(--acc2,#22d3ee) 16%,transparent),transparent 55%),var(--panel)}
.fg-hero h2{margin:0 0 4px;font-size:24px}.fg .mute{color:var(--mute);font-size:12.5px;line-height:1.5}
.fg-grid{display:grid;grid-template-columns:240px 1fr;gap:14px;align-items:start}@media(max-width:860px){.fg-grid{grid-template-columns:1fr}}
.fg-card{border:1px solid var(--line);border-radius:14px;background:var(--panel);padding:14px;margin-bottom:12px}
.fg-step{display:flex;gap:10px;align-items:center;margin-bottom:8px}.fg-n{flex:none;width:26px;height:26px;border-radius:50%;background:var(--acc,#7c5cff);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px}
.fg input,.fg textarea,.fg select{width:100%;box-sizing:border-box;padding:8px 10px;border:1px solid var(--line);border-radius:8px;background:var(--panel2);color:var(--text);font:13px/1.5 inherit}
.fg .btn{padding:9px 16px;border:0;border-radius:10px;font-weight:700;color:#fff;cursor:pointer;background:linear-gradient(135deg,var(--acc,#7c5cff),var(--acc2,#22d3ee))}.fg .btn:disabled{opacity:.5;cursor:default}
.fg .big{font-size:16px;padding:13px 22px;width:100%}
.fg .ib2{padding:6px 11px;border:1px solid var(--line);border-radius:8px;background:var(--panel2);color:var(--text);cursor:pointer;font-size:12.5px}.fg .ib2:hover{border-color:var(--acc)}
.fg-proj{padding:9px 10px;border:1px solid var(--line);border-radius:10px;margin-bottom:6px;cursor:pointer;background:var(--panel2)}.fg-proj.on{border-color:var(--acc);box-shadow:0 0 0 1px var(--acc) inset}
.fg-drop{border:2px dashed var(--line);border-radius:12px;padding:16px;text-align:center;color:var(--mute);margin:8px 0}.fg-drop.over{border-color:var(--acc);background:color-mix(in srgb,var(--acc) 8%,transparent)}
.fg-item{display:flex;gap:8px;align-items:center;padding:5px 8px;border-radius:8px;background:var(--panel2);margin-top:4px;font-size:12.5px}.fg-item span{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.fg-sizes{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}@media(max-width:700px){.fg-sizes{grid-template-columns:1fr}}
.fg-size{border:1px solid var(--line);border-radius:12px;padding:10px;cursor:pointer;background:var(--panel2)}.fg-size.on{border-color:var(--acc);box-shadow:0 0 0 1px var(--acc) inset}
.fg-bar{height:8px;border-radius:5px;background:var(--panel2);overflow:hidden}.fg-bar>div{height:100%;background:linear-gradient(90deg,var(--acc,#7c5cff),var(--acc2,#22d3ee));transition:width .5s}
.fg-sample{border-left:3px solid var(--acc);background:var(--panel2);border-radius:0 10px 10px 0;padding:10px 12px;margin-top:8px;white-space:pre-wrap;font:13px/1.5 Georgia,serif}
.fg-tut li{margin:6px 0;color:var(--mute)}.fg-tut li.on{color:var(--text);font-weight:600}
.fg canvas{width:100%;height:150px;border:1px solid var(--line);border-radius:10px;background:var(--panel2)}`; document.head.appendChild(s); }

  let cur = '', ptimer = 0;
  async function render(el) {
    el.innerHTML = '<div class="fg"><div class="fg-wrap"><div class="fg-hero"><h2>\uD83D\uDD28 Model Forge</h2><div class="mute">Make your own AI language model from nothing. Give it any text, press one button, and watch a brand-new model learn to write like it. When it is done, it appears in Chat.</div></div><div id="fgsetup"></div><div class="fg-grid"><div><div class="fg-card"><b>Your models</b><div id="fglist" style="margin-top:8px"></div><button class="btn" id="fgnew" style="width:100%;margin-top:6px">+ New model</button></div>' + tutorial() + '</div><div id="fgmain"></div></div></div></div>';
    el._cleanup = () => clearInterval(ptimer);
    el.querySelector('#fgnew').onclick = async () => { const p = await A.api('/api/forge/create', { name: 'My model ' + (new Date().toLocaleDateString()) }); cur = p.id; refresh(el); };
    refresh(el);
  }
  const tutorial = () => '<div class="fg-card fg-tut"><b>What happens inside?</b><ol style="padding-left:18px;margin:8px 0 0">' +
    '<li data-t="tokenizer">It reads your text and makes a <b>word list</b>: common words and word-pieces, each with a number.</li>' +
    '<li data-t="model">It builds a <b>brand-new brain</b> of millions of numbers, all random. At first it writes gibberish.</li>' +
    '<li data-t="train">It plays a <b>guessing game</b>: read a bit, guess the next word, check, nudge the numbers. Millions of times.</li>' +
    '<li data-t="loss">The <b>loss</b> is how wrong its guesses are. Watch it fall as it learns.</li>' +
    '<li data-t="save">It is <b>saved and added to Ollama</b>, so you can chat with it.</li></ol>' +
    '<div class="mute" style="margin-top:8px">More text and more time give a better model. It learns the style and words of what you feed it; it will not know facts it never read.</div></div>';

  async function refresh(el) {
    const L = await A.api('/api/forge/list').catch(() => ({ projects: [] }));
    const list = el.querySelector('#fglist'); if (!list) return;
    if (!cur && L.projects.length) cur = L.projects[0].id;
    list.innerHTML = L.projects.map(p => '<div class="fg-proj' + (p.id === cur ? ' on' : '') + '" data-id="' + p.id + '"><b>' + esc(p.name) + '</b><div class="mute">' + esc((L.sizes[p.size] || {}).label || '') + (p.model ? ' \u00b7 \u2705 ready' : '') + '</div></div>').join('') || '<div class="mute">None yet.</div>';
    list.querySelectorAll('.fg-proj').forEach(d => d.onclick = () => { cur = d.dataset.id; refresh(el); });
    const main = el.querySelector('#fgmain');
    if (!cur) { main.innerHTML = '<div class="fg-card" style="text-align:center;padding:40px"><div style="font-size:48px">\uD83D\uDD28</div><h3>Make your first model</h3><div class="mute" style="margin-bottom:14px">It takes about 10 minutes for a tiny one.</div><button class="btn big" id="fgfirst" style="max-width:280px">Start</button></div>'; main.querySelector('#fgfirst').onclick = () => el.querySelector('#fgnew').click(); return; }
    const I = await A.api('/api/forge/info', { id: cur }); if (!I || I.error) { cur = ''; return refresh(el); }
    setup(el, I.ready);
    drawProject(el, I);
  }

  function setup(el, ready) {
    const box = el.querySelector('#fgsetup'); if (ready) { box.innerHTML = ''; return; }
    box.innerHTML = '<div class="fg-card" style="border-color:var(--warn,#f5a524)"><b>One-time setup needed</b><div class="mute">Training uses your GPU and a Python toolkit (a few GB). It installs once in the background.</div><button class="btn" id="fgsetupgo" style="margin-top:8px">\u2699 Set up GPU training</button> <span class="mute" id="fgsetupst"></span></div>';
    box.querySelector('#fgsetupgo').onclick = async () => {
      await A.api('/api/finetune/install', {}); box.querySelector('#fgsetupst').textContent = 'Installing\u2026 10 to 20 minutes. You can leave this page.';
      const t = setInterval(async () => { const s = await A.api('/api/finetune/status').catch(() => ({})); if (s.installed) { clearInterval(t); refresh(el); } else if (!s.installing) { clearInterval(t); box.querySelector('#fgsetupst').textContent = 'Setup stopped. See Studio \u203a Model Lab for the log.'; } }, 5000);
    };
  }

  function drawProject(el, I) {
    const p = I.project, main = el.querySelector('#fgmain'), sz = I.sizes;
    const words = Math.round(I.total / 6), capB = (sz[p.size] || sz.tiny).cap, pct = Math.min(100, Math.round(100 * I.total / capB));
    main.innerHTML =
      '<div class="fg-card"><div class="fg-step"><div class="fg-n">1</div><b>Name it</b></div><input id="fgname" value="' + esc(p.name) + '" maxlength="60"></div>' +
      '<div class="fg-card"><div class="fg-step"><div class="fg-n">2</div><b>Feed it text</b></div><div class="mute">Anything works: books, notes, song lyrics, code, chat logs, a whole folder. It will learn to write like whatever you give it.</div>' +
        '<div class="fg-drop" id="fgdrop">Drop text files here, or <button class="ib2" id="fgpick">\uD83D\uDCC4 choose files</button><input type="file" id="fgfile" multiple accept="' + TEXT + '" hidden></div>' +
        '<div style="display:flex;gap:6px;flex-wrap:wrap"><button class="ib2" id="fgpaste">\u270D Paste text</button><button class="ib2" id="fgbible">\u271D Use my Bible library</button><button class="ib2" id="fgfolder">\uD83D\uDCC1 Add a folder from this PC</button></div>' +
        '<div id="fgpastebox" style="display:none;margin-top:8px"><textarea id="fgpastetext" rows="5" placeholder="Paste any text here"></textarea><button class="btn" id="fgpasteadd" style="margin-top:6px">Add this text</button></div>' +
        '<div id="fgfolderbox" style="display:none;margin-top:8px"><input id="fgfolderpath" placeholder="e.g. C:\\Users\\you\\Documents\\stories"><button class="btn" id="fgfolderadd" style="margin-top:6px">Add folder</button><div class="mute">Every text file inside (and in its subfolders) is used.</div></div>' +
        '<div id="fgitems" style="margin-top:8px">' +
          I.files.map(f => '<div class="fg-item">\uD83D\uDCC4<span>' + esc(f.name) + '</span><em class="mute">' + mb(f.bytes) + '</em><button class="ib2 fgrmf" data-f="' + esc(f.name) + '">\u2715</button></div>').join('') +
          I.sources.map((s, i) => '<div class="fg-item">' + (s.type === 'bible' ? '\u271D<span>Bible library' : '\uD83D\uDCC1<span>' + esc(s.path)) + ' (' + s.files + ' files)</span><em class="mute">' + mb(s.bytes) + '</em><button class="ib2 fgrms" data-i="' + i + '">\u2715</button></div>').join('') + '</div>' +
        '<div style="margin-top:10px" class="mute">Total: <b>' + mb(I.total) + '</b>, about ' + words.toLocaleString() + ' words. ' + (I.total < 20000 ? '<span style="color:var(--warn,#f5a524)">Give it at least a few pages.</span>' : I.total > capB ? 'The ' + sz[p.size].label + ' size reads the first ' + mb(capB) + '.' : '') + '</div><div class="fg-bar" style="margin-top:4px"><div style="width:' + pct + '%"></div></div></div>' +
      '<div class="fg-card"><div class="fg-step"><div class="fg-n">3</div><b>Pick a size</b></div><div class="fg-sizes">' +
        Object.keys(sz).map(k => '<div class="fg-size' + (p.size === k ? ' on' : '') + '" data-s="' + k + '"><b>' + sz[k].label + '</b><div class="mute">' + esc(sz[k].about) + '</div></div>').join('') + '</div>' +
        '<div style="margin-top:8px;display:flex;gap:8px;align-items:center"><span class="mute">Train for</span><input id="fgmin" type="number" min="1" max="600" style="max-width:90px" value="' + (p.minutes || '') + '" placeholder="' + (sz[p.size] || sz.tiny).minutes + '"><span class="mute">minutes (longer = smarter)</span></div></div>' +
      '<div class="fg-card"><div class="fg-step"><div class="fg-n">4</div><b>Forge it</b></div><button class="btn big" id="fggo"' + (!I.ready || I.busy ? ' disabled' : '') + '>\uD83D\uDD28 Forge my model</button>' + (I.busy ? '<div class="mute">Another model is training right now.</div>' : '') + '<div id="fglive"></div></div>' +
      '<div style="text-align:right"><button class="ib2" id="fgdel">\uD83D\uDDD1 Delete this model</button></div>';
    const q = s => main.querySelector(s), id = p.id;
    q('#fgname').onchange = async () => { await A.api('/api/forge/update', { id, name: q('#fgname').value }); refresh(el); };
    q('#fgmin').onchange = () => A.api('/api/forge/update', { id, minutes: +q('#fgmin').value || 0 });
    main.querySelectorAll('.fg-size').forEach(d => d.onclick = async () => { await A.api('/api/forge/update', { id, size: d.dataset.s }); refresh(el); });
    const addFiles = async files => {
      let n = 0;
      for (const f of files) {
        if (f.size > 6e7) { A.toast(f.name + ' is over 60 MB; split it first.'); continue; }
        const text = await f.text().catch(() => ''); if (!text.trim()) continue;
        const r = await A.api('/api/forge/addtext', { id, name: f.name, text }); if (r.ok) n++;
      }
      A.toast('Added ' + n + ' file' + (n === 1 ? '' : 's') + '.'); refresh(el);
    };
    q('#fgpick').onclick = () => q('#fgfile').click();
    q('#fgfile').onchange = e => addFiles([...e.target.files]);
    const drop = q('#fgdrop');
    drop.ondragover = e => { e.preventDefault(); drop.classList.add('over'); }; drop.ondragleave = () => drop.classList.remove('over');
    drop.ondrop = e => { e.preventDefault(); drop.classList.remove('over'); addFiles([...e.dataTransfer.files]); };
    q('#fgpaste').onclick = () => { q('#fgpastebox').style.display = ''; q('#fgpastetext').focus(); };
    q('#fgpasteadd').onclick = async () => { const t = q('#fgpastetext').value; if (!t.trim()) return; await A.api('/api/forge/addtext', { id, name: 'pasted ' + new Date().toLocaleTimeString().replace(/:/g, '-'), text: t }); refresh(el); };
    q('#fgbible').onclick = async () => { const r = await A.api('/api/forge/addsource', { id, type: 'bible' }); if (!r.ok) A.toast(r.error || 'Could not add it.'); refresh(el); };
    q('#fgfolder').onclick = () => { q('#fgfolderbox').style.display = ''; q('#fgfolderpath').focus(); };
    q('#fgfolderadd').onclick = async () => { const r = await A.api('/api/forge/addsource', { id, type: 'folder', path: q('#fgfolderpath').value }); if (!r.ok) A.toast(r.error || 'Could not add it.'); refresh(el); };
    main.querySelectorAll('.fgrmf').forEach(b => b.onclick = async () => { await A.api('/api/forge/removefile', { id, file: b.dataset.f }); refresh(el); });
    main.querySelectorAll('.fgrms').forEach(b => b.onclick = async () => { await A.api('/api/forge/removesource', { id, index: +b.dataset.i }); refresh(el); });
    q('#fggo').onclick = async () => { const r = await A.api('/api/forge/train', { id }); if (!r.ok) return A.toast(r.error || 'Could not start.'); q('#fggo').disabled = true; watch(el, id); };
    q('#fgdel').onclick = async () => { if (!(await A.confirm('Delete "' + p.name + '"? Its text copies and its Ollama model are removed.'))) return; const r = await A.api('/api/forge/remove', { id }); if (!r.ok) return A.toast(r.error || 'Could not delete.'); cur = ''; refresh(el); };
    watch(el, id, true);
  }

  function drawChart(cv, losses) {
    const r = cv.getBoundingClientRect(), W = cv.width = Math.max(300, r.width * devicePixelRatio), H = cv.height = 150 * devicePixelRatio, c = cv.getContext('2d');
    c.clearRect(0, 0, W, H); if (losses.length < 2) return;
    const ys = losses.map(l => l[1]), lo = Math.min(...ys), hi = Math.max(...ys), pad = 14 * devicePixelRatio;
    const X = i => pad + (W - 2 * pad) * i / (losses.length - 1), Y = v => pad + (H - 2 * pad) * (1 - (v - lo) / ((hi - lo) || 1));
    c.strokeStyle = getComputedStyle(cv).getPropertyValue('--acc') || '#7c5cff'; c.lineWidth = 2 * devicePixelRatio; c.beginPath();
    losses.forEach((l, i) => i ? c.lineTo(X(i), Y(l[1])) : c.moveTo(X(i), Y(l[1]))); c.stroke();
    c.fillStyle = '#8a8fa3'; c.font = (11 * devicePixelRatio) + 'px sans-serif'; c.fillText('loss ' + hi.toFixed(2), pad, pad); c.fillText(ys[ys.length - 1].toFixed(2), W - pad - 40 * devicePixelRatio, H - 4 * devicePixelRatio);
  }
  function watch(el, id, quiet) {
    clearInterval(ptimer); let lastKey = '';
    const tick = async () => {
      const live = el.querySelector('#fglive'); if (!live || cur !== id) return clearInterval(ptimer);
      const P = await A.api('/api/forge/progress', { id }).catch(() => null); if (!P) return;
      const key = JSON.stringify([P.last && P.last.step, P.samples.length, P.model, P.error, P.running, P.done, P.notes.length]);
      if (key === lastKey) { if (!P.running && P.model) clearInterval(ptimer); return; }   // nothing new: leave the screen (and the try box) alone
      lastKey = key;
      if (!P.running && !P.done && !P.error && !P.samples.length) { live.innerHTML = ''; return clearInterval(ptimer); }
      el.querySelectorAll('.fg-tut li').forEach(li => li.classList.toggle('on', li.dataset.t === (P.stage === 'step' || P.stage === 'val' || P.stage === 'sample' ? 'train' : P.stage === 'tokens' || P.stage === 'data' ? 'tokenizer' : P.stage)));
      const L = P.last, pct = L ? Math.min(100, Math.round(100 * L.elapsed / L.total)) : 0;
      live.innerHTML = '<div style="margin-top:12px">' + (P.error ? '<div style="color:var(--bad,#e5484d)"><b>It stopped:</b> ' + esc(P.error) + '</div>' : '') +
        '<div class="mute">' + esc(P.notes[P.notes.length - 1] || '') + '</div>' +
        (L ? '<div class="fg-bar" style="margin:8px 0"><div style="width:' + pct + '%"></div></div><div class="mute">Step ' + L.step.toLocaleString() + ' \u00b7 loss ' + L.loss + ' \u00b7 ' + Math.round(L.elapsed / 60) + ' of ' + Math.round(L.total / 60) + ' min' + (P.params ? ' \u00b7 ' + (P.params / 1e6).toFixed(1) + 'M numbers' : '') + '</div><canvas id="fgchart"></canvas>' : '') +
        (P.running ? '<div style="margin-top:8px"><button class="ib2" id="fgfin">\u23F9 Finish now (keeps what it learned)</button></div>' : '') +
        (P.samples[0] ? '<div class="mute" style="margin-top:12px">' + esc(P.samples[0].msg) + '</div><div class="fg-sample">' + esc(P.samples[0].text) + '</div>' : '') +
        (P.samples.length > 1 ? '<details style="margin-top:8px"><summary class="mute">Earlier writing (watch it improve)</summary>' + P.samples.slice(1).map(s => '<div class="mute" style="margin-top:8px">' + esc(s.msg) + '</div><div class="fg-sample">' + esc(s.text) + '</div>').join('') + '</details>' : '') +
        (P.model ? '<div class="fg-card" style="margin-top:12px;border-color:var(--ok,#30a46c)"><b>\u2705 ' + esc(P.model) + ' is ready.</b><div class="mute">Pick it in Chat\u2019s model menu, or try it here. It continues whatever you start.</div><div style="display:flex;gap:6px;margin-top:8px"><input id="fgtry" placeholder="Start a sentence\u2026"><button class="btn" id="fgtrygo">Write</button></div><div id="fgtryout"></div><button class="ib2" id="fgchat" style="margin-top:8px">\uD83D\uDCAC Open Chat</button></div>' : '') + '</div>';
      const cv = live.querySelector('#fgchart'); if (cv) drawChart(cv, P.losses.filter((_, i) => i % Math.max(1, Math.floor(P.losses.length / 300)) === 0));
      const fin = live.querySelector('#fgfin'); if (fin) fin.onclick = () => { A.api('/api/forge/finish', { id }); fin.disabled = true; fin.textContent = 'Finishing\u2026 saving the model'; };
      const tg = live.querySelector('#fgtrygo'); if (tg) tg.onclick = async () => { const o = live.querySelector('#fgtryout'); o.innerHTML = '<div class="mute">Writing\u2026</div>'; const prompt = live.querySelector('#fgtry').value || 'The'; const r = await A.api('/api/forge/try', { model: P.model, prompt }); o.innerHTML = '<div class="fg-sample">' + esc(r.ok ? prompt + r.text : r.error) + '</div>'; };
      const ch = live.querySelector('#fgchat'); if (ch) ch.onclick = () => { A.toast('Choose ' + P.model + ' in the model menu.'); A.showTab('chat'); };
      if (P.done && !P.model && !P.running) { live.insertAdjacentHTML('beforeend', '<div class="mute">Adding it to Ollama\u2026</div>'); const r = await A.api('/api/forge/import', { id }); if (!r.ok) A.toast(r.error || 'Could not add it to Ollama.'); else { A.toast(r.name + ' is ready in Chat.'); refreshList(el); } return; }
      if (!P.running) { clearInterval(ptimer); const go = el.querySelector('#fggo'); if (go) go.disabled = false; }
    };
    tick(); ptimer = setInterval(tick, 3000);
  }
  async function refreshList(el) { const L = await A.api('/api/forge/list').catch(() => ({ projects: [] })); const list = el.querySelector('#fglist'); if (!list) return; list.querySelectorAll('.fg-proj').forEach(d => { const p = L.projects.find(x => x.id === d.dataset.id); if (p && p.model) d.querySelector('.mute').textContent = (L.sizes[p.size] || {}).label + ' \u00b7 \u2705 ready'; }); }

  A.forge = { render };
  if (A.studio && A.studio.reg) A.studio.reg('forge', '\uD83D\uDD28 Model Forge', body => A.forge.render(body), 31);
})();

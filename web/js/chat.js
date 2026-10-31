// Chat: streaming answers from the local model, grounded in your files and the offline libraries.
(() => {
  let chats = [], cur = null, busy = false, ctl = null, saveT = null;
  const msgsEl = $('msgs'), inEl = $('in');
  const newChat = () => ({ id: Date.now().toString(36), title: 'New chat', msgs: [], updated: Date.now() });
  const persist = () => { clearTimeout(saveT); saveT = setTimeout(() => { fetch('/api/chats', { method: 'POST', body: JSON.stringify(chats.filter(c => c.msgs.length).map(c => ({ id: c.id, title: c.title, updated: c.updated, messages: c.msgs.map(m => ({ role: m.role, content: m.content, thinking: m.thinking, local: m.local, sources: (m.sources || []).map(s => ({ title: s.title, page: s.page, kind: s.kind, path: s.path, url: s.url, where: s.where, text: s.kind === 'attach' ? '' : (s.text || '').slice(0, 700) })) })) }))) }).catch(() => {}); }, 600); };
  const model = () => $('model').value;

  /* ---------- rendering ---------- */
  function srcChips(sources) {
    if (!sources || !sources.length) return '';
    return '<div class="chips">' + sources.map((s, i) => '<span class="src" data-i="' + i + '" title="' + esc(s.where || '') + '">[' + (i + 1) + '] ' + esc((s.title || '').slice(0, 42)) + (s.page ? ' p.' + s.page : '') + '</span>').join('') + '</div>';
  }
  function toolsHtml(role) {
    return '<div class="tools">' + (role === 'assistant'
      ? '<span data-t="copy">Copy</span><span data-t="listen">Listen</span><span data-t="redo">Redo</span><span data-t="note">Save to note</span><span data-t="cards">Make flashcards</span>'
      : '<span data-t="copy">Copy</span><span data-t="edit">Edit</span>') + '</div>';
  }
  function render(m, i) {
    const d = document.createElement('div'); d.className = 'm ' + (m.role === 'user' ? 'u' : 'a'); d.dataset.i = i;
    fill(d, m); return d;
  }
  function fill(d, m) {
    if (m.role === 'user') { d.innerHTML = '<div class="bd">' + esc(m.content) + '</div>' + toolsHtml('user'); return; }
    d.innerHTML = (m.thinking ? '<details><summary>Thinking</summary><div>' + esc(m.thinking) + '</div></details>' : '') + '<div class="bd">' + (m.content ? md(m.content) : '<span class="dots"></span>') + '</div>' + srcChips(m.sources) + (m.local ? '' : toolsHtml('assistant'));
  }
  function renderAll() {
    msgsEl.innerHTML = '';
    if (!cur.msgs.length) { empty(); return; }
    cur.msgs.forEach((m, i) => msgsEl.appendChild(render(m, i)));
    msgsEl.scrollTop = msgsEl.scrollHeight;
  }
  function empty() {
    const d = document.createElement('div'); d.id = 'empty';
    d.innerHTML = '<div class="reactor"><i></i><i></i><i></i><i></i></div><div class="big">Hey, I&rsquo;m Moundshroud.</div><div class="mute small" style="text-align:center">Private, offline, and all yours. What are we working on?</div><div id="brief"></div>' +
      '<div class="starters" id="starters"></div>';
    msgsEl.appendChild(d);
    const ex = ['💡 Explain how vaccines work', '🧮 What is 18% of 240?', '⏰ Remind me to stretch in 30 minutes', '📝 Summarize my latest notes', '🔧 How do I fix a leaking tap?', '📖 Define "ephemeral"'];
    $('starters').innerHTML = ex.map(e => '<span class="chip">' + esc(e) + '</span>').join('');
    $('starters').onclick = e => { const c = e.target.closest('.chip'); if (c) { inEl.value = c.textContent.replace(/^\S+\s/, ''); send(); } };
    A.api('/api/briefing').then(b => { if (b && $('brief')) $('brief').innerHTML = briefHtml(b); }).catch(() => {});
  }
  function briefHtml(b) {
    const h = b.health, parts = [];
    const greet = (() => { const hr = new Date().getHours(); return hr < 12 ? 'Good morning' : hr < 18 ? 'Good afternoon' : 'Good evening'; })();
    if (h) parts.push('<div><b>PC:</b> <span class="' + (/fine|good|healthy|ok/i.test(h.verdict) ? 'ok' : 'warn') + '">' + esc(h.verdict || 'checked') + '</span>' + (h.freeGB != null ? ' &middot; ' + h.freeGB + ' GB free (' + h.freePct + '%)' : '') + '</div>' +
      (h.issues || []).slice(0, 3).map(x => '<div class="mute small">&bull; ' + esc(x) + '</div>').join(''));
    const rs = b.reminders || [];
    parts.push('<div><b>Today:</b> ' + (rs.length ? rs.map(r => esc(r.text) + ' <span class="mute">(' + new Date(r.at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) + ')</span>').join('; ') : '<span class="mute">nothing scheduled</span>') + '</div>');
    parts.push('<div class="mute small">' + b.notes + ' notes' + (b.docs ? ' &middot; ' + b.docs.files + ' files searchable' : '') + ' &middot; ' + new Date().toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' }) + '</div>');
    return '<div class="card" style="margin-top:12px"><b>' + greet + '.</b>' + parts.join('') + '</div>';
  }
  function local(role, text) { const m = { role, content: text, local: true }; cur.msgs.push(m); if (cur.msgs.length === 1) msgsEl.innerHTML = ''; msgsEl.appendChild(render(m, cur.msgs.length - 1)); msgsEl.scrollTop = msgsEl.scrollHeight; return m; }

  /* a spoken-friendly daily briefing, built from the PC check, reminders and study cards */
  async function briefingText() {
    const [b, cards] = await Promise.all([A.api('/api/briefing'), A.api('/api/cards').catch(() => [])]);
    const hr = new Date().getHours(), parts = [(hr < 12 ? 'Good morning.' : hr < 18 ? 'Good afternoon.' : 'Good evening.') + ' It is ' + new Date().toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' }) + '.'];
    const rs = b.reminders || [];
    parts.push(rs.length ? 'You have ' + rs.length + (rs.length === 1 ? ' reminder' : ' reminders') + ' today: ' + rs.map(r => r.text + ' at ' + new Date(r.at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })).join(', ') + '.' : 'Nothing is scheduled today.');
    if (b.health) parts.push('Your last PC health check said ' + b.health.verdict.toLowerCase() + (b.health.issues && b.health.issues.length ? ': ' + b.health.issues[0].replace(/^[-\s]+/, '') : '') + '.');
    const due = (Array.isArray(cards) ? cards : []).filter(c => c.due <= Date.now()).length;
    if (due) parts.push('You have ' + due + ' flashcards due for review.');
    if (b.notes) parts.push('You have ' + b.notes + (b.notes === 1 ? ' note' : ' notes') + ' saved.');
    return parts.join(' ');
  }

  /* ---------- context from files + libraries ---------- */
  async function gather(q) {
    const sources = [];
    const tasks = [];
    const hasAtt = (cur.att || []).length > 0;       // a file is attached: answer from it, skip the wider searches
    const toClaude = A.ai && A.ai.isCloud(model());
    if (toClaude && $('usefiles').checked && !A.ai.allowed('files')) cur._kept = 'Your files and notes were not searched, because Claude is answering (Settings › Privacy to allow it).';
    if (!hasAtt && $('usefiles').checked && !(toClaude && !A.ai.allowed('files'))) tasks.push(A.api('/api/docs/search', { q, n: 5 }).then(r => (r.results || []).forEach(x => sources.push({ title: x.title, page: x.kind === 'doc' && x.page ? x.page : 0, text: x.text.slice(0, 1400), kind: x.kind, path: x.path, where: x.path }))).catch(() => {}));
    if (!hasAtt && $('usewiki').checked && A.caps.lib) tasks.push(A.api('/api/lib/context', { q, n: 4 }).then(r => (r.sources || []).forEach(x => sources.push({ title: x.title, text: x.text, kind: 'lib', url: x.url, where: x.book, category: x.category }))).catch(() => {}));
    /* the internet, when it is switched on and the 🌐 box is ticked: the top pages are read in full, the next few come in as snippets */
    if (!hasAtt && A.net && A.net.on() && $('useweb').checked) tasks.push(A.net.lookup(q).then(r => {
      const pages = r.pages || [], have = new Set(pages.map(p => p.url));
      pages.forEach(p => sources.push({ title: p.title, text: p.text, kind: 'web', url: p.url, where: 'the web (read just now)' }));
      (r.results || []).slice(0, 6).forEach(x => { if (!have.has(x.url)) sources.push({ title: x.title, text: x.snippet || '', kind: 'web', url: x.url, where: 'web result (' + (x.source || 'web') + ')' }); });
    }).catch(() => {}));
    /* a question about Moundshroud itself is answered from Moundshroud's own files, not from guesswork */
    if (!hasAtt && window.AppCtx && AppCtx.about(q)) tasks.push(AppCtx.context(q).then(t => { if (t) sources.push({ title: 'Moundshroud source code', text: t, kind: 'app', where: 'the app\'s own files (web/, lib/, server.js)' }); }).catch(() => {}));
    await Promise.all(tasks);
    (cur.att || []).filter(a => a.text).reverse().forEach(a => sources.unshift({ title: a.name, text: a.text.slice(0, 12000), kind: 'attach', where: 'attached file' }));
    const pg = (A.lib && A.lib.pending()) || (A.library && A.library.pending()); if (pg) sources.unshift({ title: 'Library page', text: pg.slice(0, 6000), kind: 'lib', url: '', where: 'the page you were reading' });
    return sources;
  }
  function systemPrompt(sources, voice) {
    let s = 'You are MOUNDSHROUD, a helpful, polished assistant running privately and offline on the user\'s own PC. Be clear, accurate and reasonably concise. Today is ' + new Date().toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) + '.';
    if (sources.length) {
      s += '\n\nUse the numbered sources below when they help answer the question, and cite them like [1] or [2]. If they do not help, answer from your own knowledge and say that the sources did not cover it. Never invent a citation.\n';
      sources.forEach((x, i) => { s += '\n[' + (i + 1) + '] ' + x.title + (x.page ? ' (page ' + x.page + ')' : '') + ' - ' + (x.where || '') + '\n' + x.text + '\n'; });
      if (sources.some(x => x.category === 'Medical')) s += '\nThis involves medical information. Give the facts from the sources, and remind the user briefly that this is reference information, not a diagnosis, and to call emergency services for emergencies.';
    }
    if (sources.some(x => x.kind === 'web')) s += '\n\nSome sources were fetched from the internet a moment ago. Prefer them for anything that could have changed since your training, name the site in the citation (for example [1] Wikipedia), and if they disagree with what you already know, trust them and say so.';
    if (sources.some(x => x.kind === 'app')) s += '\n\nSome sources are excerpts of Moundshroud\'s own source code, so you can answer questions about the app itself exactly: name the file (for example web/js/chat.js) when you explain where something lives. Never invent a file or a setting that is not in the excerpts - if it is not there, say you could not find it and offer to search again.';
    if (voice) s += '\n\nThe user is talking to you out loud and your answer will be read aloud. Reply in one to three short, natural spoken sentences. No lists, no markdown, no citations.';
    if (A.memory && !(A.ai && A.ai.isCloud(model()) && !A.ai.allowed('memory'))) s += A.memory.prompt();      // what the AI remembers stays off Claude unless allowed
    return s;
  }

  /* ---------- sending ---------- */
  function setBusy(b) { busy = b; $('go').textContent = b ? 'Stop' : 'Send'; $('go').classList.toggle('stop', b); }
  async function stream(body, onTok) {
    ctl = new AbortController();
    const r = await fetch('/api/chat', { method: 'POST', body: JSON.stringify(body), signal: ctl.signal });
    if (!r.ok) { let e = ''; try { e = (await r.json()).error || ''; } catch (x) {} throw new Error(e || ('HTTP ' + r.status)); }
    const rd = r.body.getReader(), dec = new TextDecoder(); let buf = '';
    for (;;) {
      const { value, done } = await rd.read(); if (done) break;
      buf += dec.decode(value, { stream: true }); let i;
      while ((i = buf.indexOf('\n')) >= 0) { const ln = buf.slice(0, i).trim(); buf = buf.slice(i + 1); if (!ln) continue; let j; try { j = JSON.parse(ln); } catch (e) { continue; } if (j.error) throw new Error(j.error); onTok(j); }
    }
  }
  async function send(textOverride, opts = {}) {
    if (busy) { if (ctl) ctl.abort(); return; }
    const text = (textOverride != null ? textOverride : inEl.value).trim(); if (!text) return;
    A.showTab('chat'); A.speech.stop();
    if (textOverride == null) { inEl.value = ''; autosize(); $('calcchip').style.display = 'none'; }
    if (!cur.msgs.length) { msgsEl.innerHTML = ''; cur.title = text.slice(0, 48); }
    /* instant, no-AI answers */
    if (!opts.noLocal) {
      if (A.remind.isRequest(text)) {
        const p = A.remind.parse(text); local('user', text);
        if (p) { await A.api('/api/reminders', { text: p.text, at: p.at, rule: p.rule }); local('assistant', 'Done. I will remind you **' + p.text + '** ' + (p.rule ? A.remind.describe(p.rule) : A.remind.when(p.at)) + '. You will get a Windows notification even if this window is closed.'); A.emit('reminders'); }
        else local('assistant', 'I could not work out when. Try: "remind me to call Sam tomorrow at 9am", "remind me in 20 minutes to check the oven" or "timer 10 min".');
        cur.updated = Date.now(); persist(); return;
      }
      if (/^\s*(please\s+)?(good (morning|afternoon|evening)|daily briefing|brief me|give me (my |the )?briefing|catch me up|what('?s| is) (on )?(today|my day))\W*$/i.test(text)) {
        local('user', text); local('assistant', await briefingText()); cur.updated = Date.now(); persist(); return;
      }
      const pcCmd = A.pc && A.pc.match(text);
      if (pcCmd) { local('user', text); if (A.vm && A.vm.on) local('assistant', 'I can do that from the normal chat, where you can confirm it first.'); else await A.pc.ask(pcCmd, local); cur.updated = Date.now(); persist(); return; }
      const rh = A.rhyme && A.rhyme.match(text);
      if (rh) { local('user', text); local('assistant', await A.rhyme.chatAnswer(rh.word)); cur.updated = Date.now(); persist(); return; }
      const th = A.thes && A.thes.match(text);
      if (th) { local('user', text); local('assistant', await A.thes.chatAnswer(th.kind, th.word)); cur.updated = Date.now(); persist(); return; }
      const c = A.calc.try(text);
      if (c) { local('user', text); local('assistant', '**' + c.label + '**'); cur.updated = Date.now(); persist(); return; }
    }
    const um = { role: 'user', content: text }; cur.msgs.push(um); msgsEl.appendChild(render(um, cur.msgs.length - 1));
    const am = { role: 'assistant', content: '', thinking: '', sources: [] }; cur.msgs.push(am);
    const el = render(am, cur.msgs.length - 1); msgsEl.appendChild(el); msgsEl.scrollTop = msgsEl.scrollHeight;
    setBusy(true); $('status').textContent = 'searching...';
    let ok = true;
    try {
      const sources = opts.sources || (!opts.noLocal && A.actions && A.actions.looksActionable(text) ? [] : await gather(text)); am.sources = sources;
      if (sources.length) { const ch = el.querySelector('.chips'); if (!ch) el.insertAdjacentHTML('beforeend', srcChips(sources)); }
      const hist = cur.msgs.slice(0, -2).filter(m => !m.local).slice(-12).map(m => ({ role: m.role, content: m.content }));
      const think = opts.voice ? false : $('think').checked;
      const body = { model: model(), stream: true, keep_alive: (A.power && A.power.on ? '1m' : '3m'), think, messages: [{ role: 'system', content: systemPrompt(sources, opts.voice) }, ...hist, Object.assign({ role: 'user', content: text }, (cur.att || []).some(a => a.image) ? { images: cur.att.filter(a => a.image).map(a => a.image) } : {})] };
      const hh = A.prep && A.prep.ctxFor ? A.prep.ctxFor(text) : ''; if (hh) body.messages[0].content += hh;       // household details, only for emergency-type questions
      const useTools = !opts.sources && !opts.noLocal && A.actions && A.actions.looksActionable(text);      // let the AI press buttons in the app
      if (useTools) {
        const prev = A.chat.lastExplanation().slice(0, 700);       // a clean slate for action requests, so old requests are not repeated; the last answer is kept for "quiz me on that"
        body.messages = [{ role: 'system', content: body.messages[0].content + A.actions.hint + (prev ? '\n\nFor context only - your previous answer in this chat was: "' + prev.replace(/"/g, "'") + '". Use it only if the user says "that" or "it".' : '') }, body.messages[body.messages.length - 1]];
        body.tools = A.actions.schema; if (!$('think').checked) body.think = false;
      }
      $('status').textContent = 'thinking...'; const calls = [];
      const onTok = j => {
        const mm = j.message || {};
        if (mm.tool_calls && mm.tool_calls.length) calls.push(...mm.tool_calls);
        if (mm.thinking) am.thinking += mm.thinking;
        if (mm.content) am.content += mm.content;
        $('status').textContent = am.content ? 'writing...' : 'thinking...';
        if (!paintT) paintT = setTimeout(paint, 60);      // repaint at most ~16 times a second: re-parsing the whole reply on every token made long answers lag and run hot
      };
      let paintT = 0;
      const paint = () => {
        paintT = 0;
        const bd = el.querySelector('.bd'); if (bd) bd.innerHTML = am.content ? md(am.content) : '<span class="dots"></span>';
        if (am.thinking && !el.querySelector('details')) el.insertAdjacentHTML('afterbegin', '<details open><summary>Thinking</summary><div></div></details>');
        const dv = el.querySelector('details div'); if (dv) dv.textContent = am.thinking;
        if (msgsEl.scrollHeight - msgsEl.scrollTop - msgsEl.clientHeight < 140) msgsEl.scrollTop = msgsEl.scrollHeight;
      };
      try { await stream(body, onTok); clearTimeout(paintT); paint(); }
      catch (e) {
        if (e.name === 'AbortError') throw e;
        for (let k = 0; k < 2 && e; k++) {      // a model may lack tools AND thinking: retry once per missing feature
          if (am.content) throw e;
          if (body.tools && /tool/i.test(e.message)) { delete body.tools; body.messages[0].content = body.messages[0].content.replace(A.actions.hint, ''); }     // this model cannot use tools
          else if ('think' in body && /think/i.test(e.message)) delete body.think;
          else throw e;
          try { await stream(body, onTok); e = null; } catch (e2) { if (e2.name === 'AbortError') throw e2; e = e2; }
        }
        if (e) throw e;
      }
      let didAct = false;
      if (calls.length) {
        const notes = [];
        for (const c of calls.slice(0, 3)) { const fnm = c.function && c.function.name; if (!A.actions.schema.some(s => s.function.name === fnm)) continue; try { notes.push('✅ ' + await A.actions.run(fnm, c.function.arguments || {})); didAct = true; } catch (e) { notes.push('⚠️ I could not do that: ' + e.message); } }
        if (notes.length) { am.content = (am.content ? am.content.trim() + '\n\n' : '') + notes.join('\n\n'); am.local = true; }
      }
      /* "remember that…" / "forget…" must really happen even when a small model answers in words, or garbles the tool,
         so its "got it" is never a promise nobody kept */
      if (!didAct && useTools && A.memory) {
        const rm = text.match(/^\s*(?:please\s+|hey\s+)?(?:remember|don'?t forget)\s+(?:that\s+)?(.{3,300}?)[.!]*\s*$/i), fg = text.match(/^\s*(?:please\s+|hey\s+)?(?:forget|stop remembering)\s+(?:that\s+|about\s+)?(.{2,200}?)[.!]*\s*$/i);
        if (rm && !/\?\s*$/.test(text)) { const f = A.memory.add(rm[1].replace(/^(i|i'm|i am|my)\b/i, m => ({ i: 'I', "i'm": "I'm", 'i am': 'I am', my: 'My' })[m.toLowerCase()] || m)); am.content = (am.content ? am.content.trim() + '\n\n' : '') + (f ? '✅ Saved to what I remember about you: “' + f.t + '”.' : '✅ I already remember that.'); }
        else if (fg) { const g = A.memory.forget(fg[1]); am.content = (am.content ? am.content.trim() + '\n\n' : '') + (g.length ? '✅ Forgotten: ' + g.map(f => '“' + f.t + '”').join(', ') + '.' : 'ℹ️ I had nothing remembered about that.'); }
      }
      if (calls.length && !didAct && !String(am.content || '').trim()) am.content = '⚠️ I tried to use a part of the app that does not exist. Please ask again in other words.';
    } catch (e) {
      ok = false;
      if (e.name === 'AbortError') { if (!am.content) am.content = '*(stopped)*'; }
      else am.content = (am.content ? am.content + '\n\n' : '') + '**Something went wrong:** ' + e.message + '\n\nIf the model is still loading, wait a few seconds and press Redo.';
    }
    if (cur._kept) { am.content = (am.content || '').trim() + '\n\n_🔒 ' + cur._kept + '_'; delete cur._kept; }
    setBusy(false); ctl = null; $('status').textContent = ok ? 'ready' : 'ready';
    fill(el, am); cur.updated = Date.now(); persist(); msgsEl.scrollTop = msgsEl.scrollHeight;
  }

  /* ---------- message actions ---------- */
  msgsEl.addEventListener('click', async e => {
    const cp = e.target.closest('.cp'); if (cp) { A.copy(cp.parentElement.querySelector('code').textContent); return; }
    const sc = e.target.closest('.src');
    const mEl = e.target.closest('.m'); if (!mEl) return;
    const i = +mEl.dataset.i, m = cur.msgs[i]; if (!m) return;
    if (sc) { const s = (m.sources || [])[+sc.dataset.i]; if (!s) return; if (s.kind === 'web') A.net.open(s); else if (s.kind === 'lib') A.lib.openUrl(s.url, s.title); else if (s.kind === 'note') { A.showTab('notes'); A.notes.openByPath(s.path); } else if (s.kind === 'attach') A.toast('Attached to this chat'); else A.viewer.open(s, ((cur.msgs[i - 1] || {}).content) || ''); return; }
    const t = e.target.closest('[data-t]'); if (!t) return;
    switch (t.dataset.t) {
      case 'copy': A.copy(m.content); break;
      case 'listen': A.speech.speak(m.content, t); break;
      case 'redo': { if (busy) return; const prev = cur.msgs[i - 1]; if (!prev) return; cur.msgs.splice(i - 1, 2); renderAll(); send(prev.content, { noLocal: true }); break; }
      case 'edit': { if (busy) return; inEl.value = m.content; cur.msgs.splice(i); renderAll(); inEl.focus(); autosize(); break; }
      case 'note': A.notes.create(((cur.msgs[i - 1] || {}).content || 'From chat').slice(0, 50), m.content); break;
      case 'cards': A.study.fromText(m.content); break;
    }
  });

  /* ---------- selection card (text from hotkeys) ---------- */
  A.chat = {
    ask(text, opts) { return send(text, opts); },
    newChat() { if (busy && ctl) ctl.abort(); cur = newChat(); chats.unshift(cur); renderAll(); A.showTab('chat'); inEl.focus(); },
    load(id) { const c = chats.find(x => x.id === id); if (!c) return; cur = c; renderAll(); A.showTab('chat'); },
    history() { return chats.filter(c => c.msgs.length); },
    remove(id) { chats = chats.filter(c => c.id !== id); if (cur.id === id) { cur = newChat(); chats.unshift(cur); renderAll(); } persist(); },
    lastAnswer() { for (let i = cur.msgs.length - 1; i >= 0; i--) if (cur.msgs[i].role === 'assistant' && cur.msgs[i].content) return cur.msgs[i].content; return ''; },
    lastExplanation() { for (let i = cur.msgs.length - 1; i >= 0; i--) if (cur.msgs[i].role === 'assistant' && cur.msgs[i].content && !/^✅/.test(cur.msgs[i].content.trim()) && !cur.msgs[i].local) return cur.msgs[i].content; return ''; },
    attachments: () => cur.att || [],
    attach: f => attachFile(f),
    setInput(t) { inEl.value = t; autosize(); inEl.focus(); },
    showSel(text, label, mode) {
      A.showTab('chat'); const s = $('sel'); const short = text.length > 400 ? text.slice(0, 400) + '...' : text;
      const calc = A.calc.try(text);
      s.style.display = 'block';
      s.innerHTML = '<div class="row"><b class="small">' + esc(label || 'Selected text') + '</b><span class="sp"></span><span class="ib" id="selx" style="cursor:pointer;padding:0 8px">&times;</span></div><div class="t">' + esc(short) + '</div>' +
        '<div class="chips" style="margin-top:2px">' +
        ['Explain', 'Summarize', 'Reply to this', 'Proofread', 'Translate to English', 'Look up', 'Define', 'Synonyms', 'Rhymes', 'Read aloud', 'Copy', 'Save to note'].map(x => '<span class="chip" data-a="' + x + '">' + x + '</span>').join('') +
        (calc ? '<span class="chip" data-a="calc">' + esc(calc.label) + '</span>' : '') + '</div>';
      $('selx').onclick = () => { s.style.display = 'none'; };
      s.onclick = e => {
        const c = e.target.closest('.chip'); if (!c) return; const a = c.dataset.a;
        const P = { Explain: 'Explain this clearly:\n\n', Summarize: 'Summarize this:\n\n', 'Reply to this': 'Write a friendly, natural reply to this message:\n\n', Proofread: 'Proofread this. Reply with only the corrected text:\n\n', 'Translate to English': 'Translate this into English:\n\n' };
        if (P[a]) { s.style.display = 'none'; send(P[a] + text, { noLocal: true }); }
        else if (a === 'Look up') { s.style.display = 'none'; A.lib.search(text.slice(0, 120)); }
        else if (a === 'Define') { s.style.display = 'none'; A.lib.define(text.trim().split(/\s+/)[0].replace(/[^\p{L}'-]/gu, '')); }
        else if (a === 'Synonyms') { s.style.display = 'none'; A.thes.open(text.trim().split(/\s+/)[0].replace(/[^\p{L}'-]/gu, '')); }
        else if (a === 'Rhymes') { s.style.display = 'none'; A.rhyme.open(text.trim().split(/\s+/)[0].replace(/[^\p{L}'-]/gu, '')); }
        else if (a === 'Read aloud') A.speech.speak(text, c);
        else if (a === 'Copy' || a === 'calc') A.copy(a === 'calc' ? calc.copy : text);
        else if (a === 'Save to note') A.notes.create(text.slice(0, 40).replace(/\n/g, ' '), text);
      };
    }
  };

  /* ---------- attached files (drag a file in, or use the paperclip) ---------- */
  const TEXTY = /\.(txt|md|markdown|csv|tsv|json|log|js|ts|py|html?|css|xml|ya?ml|ini|cs|java|c|cpp|h|sql|ps1|bat|sh)$/i;
  function drawAtt() {
    let box = $('attach'); if (!box) { box = document.createElement('div'); box.id = 'attach'; box.className = 'attach'; $('calcchip').parentNode.insertBefore(box, $('calcchip')); }
    box.innerHTML = (cur.att || []).map((a, i) => '<span>' + (a.thumb ? '<img src="data:image/jpeg;base64,' + a.thumb.split(',')[1] + '" style="height:22px;border-radius:4px;vertical-align:middle;margin-right:4px">' : '📎 ') + esc(a.name) + ' <i data-x="' + i + '" title="Remove">&times;</i></span>').join('');
    box.onclick = e => { const x = e.target.closest('[data-x]'); if (x) { cur.att.splice(+x.dataset.x, 1); drawAtt(); } };
  }
  async function attachFile(f) {
    if (!f) return; if (/\.(png|jpe?g|gif|webp|bmp)$/i.test(f.name) || /^image\//.test(f.type)) return attachImage(f);
    A.toast('Reading ' + f.name + '...', 2500); let text = '';
    try {
      if (TEXTY.test(f.name)) text = (await f.text()).slice(0, 40000);
      else { const r = await (await fetch('/api/extract?name=' + encodeURIComponent(f.name), { method: 'POST', body: await f.arrayBuffer() })).json(); if (r.error) return A.toast(r.error, 5000); text = r.text; }
    } catch (e) { return A.toast('Could not read that file'); }
    if (!text.trim()) return A.toast('That file has no readable text');
    (cur.att = cur.att || []).push({ name: f.name, text }); drawAtt(); A.showTab('chat'); A.toast('Attached ' + f.name + ' - ask me about it', 3000); inEl.focus();
  }
  /* pictures: shrunk to 1280px and sent to a vision-capable model (Qwen3.5 can see) */
  const capCache = {};
  async function sees(m) { if (!(m in capCache)) { try { capCache[m] = !!(await A.api('/api/modelcaps?name=' + encodeURIComponent(m))).vision; } catch (e) { capCache[m] = false; } } return capCache[m]; }
  async function ensureVision() {
    if (await sees(model())) return true;
    for (const o of [...$('model').options]) if (o.value && await sees(o.value)) { $('model').value = o.value; ls.set('model', o.value); A.toast('Switched to ' + o.textContent + ' - it can see pictures', 3500); return true; }
    return false;
  }
  function attachImage(f) {
    return new Promise(res => {
      const url = URL.createObjectURL(f), img = new Image();
      img.onload = async () => {
        const k = Math.min(1, 1280 / Math.max(img.width, img.height)), c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
        const b64 = c.toDataURL('image/jpeg', 0.85).split(',')[1];
        if (!(await ensureVision())) { A.toast('None of your models can see pictures. Qwen3.5 can.', 4500); return res(); }
        (cur.att = cur.att || []).push({ name: f.name && f.name !== 'image.png' ? f.name : 'picture', image: b64, thumb: c.toDataURL('image/jpeg', 0.4), text: '' });
        drawAtt(); A.showTab('chat'); A.toast('Picture attached - ask me about it', 3000); inEl.focus(); res();
      };
      img.onerror = () => { A.toast('Could not open that picture'); res(); }; img.src = url;
    });
  }
  inEl.addEventListener('paste', e => { const fs = [...(e.clipboardData ? e.clipboardData.files : [])].filter(x => /^image\//.test(x.type)); if (fs.length) { e.preventDefault(); fs.slice(0, 3).forEach(attachImage); } });
  const chatPanel = $('p-chat');
  ['dragenter', 'dragover'].forEach(ev => chatPanel.addEventListener(ev, e => { if (e.dataTransfer && [...e.dataTransfer.types].includes('Files')) { e.preventDefault(); chatPanel.classList.add('drop'); } }));
  ['dragleave', 'drop'].forEach(ev => chatPanel.addEventListener(ev, e => { if (ev === 'dragleave' && chatPanel.contains(e.relatedTarget)) return; chatPanel.classList.remove('drop'); }));
  chatPanel.addEventListener('drop', e => { if (e.dataTransfer && e.dataTransfer.files.length) { e.preventDefault(); [...e.dataTransfer.files].slice(0, 3).forEach(attachFile); } });
  addEventListener('dragover', e => e.preventDefault()); addEventListener('drop', e => { if (!chatPanel.contains(e.target)) e.preventDefault(); });
  const clip = document.createElement('button'); clip.className = 'ib'; clip.id = 'clip'; clip.title = 'Attach a file'; clip.style.cssText = 'height:40px;width:40px;padding:0'; clip.textContent = '📎';
  const fin = document.createElement('input'); fin.type = 'file'; fin.multiple = true; fin.style.display = 'none'; fin.onchange = () => { [...fin.files].slice(0, 3).forEach(attachFile); fin.value = ''; };
  clip.onclick = () => fin.click(); $('mic').parentNode.insertBefore(clip, $('in')); document.body.appendChild(fin);

  /* ---------- composer ---------- */
  function autosize() { inEl.style.height = 'auto'; inEl.style.height = Math.min(160, inEl.scrollHeight) + 'px'; }
  inEl.addEventListener('input', () => {
    autosize(); const c = A.calc.try(inEl.value), chip = $('calcchip');
    if (c && !A.remind.isRequest(inEl.value)) { chip.style.display = 'block'; chip.innerHTML = '<span class="chip">' + esc(c.label) + ' &nbsp;<span class="mute">(press Enter)</span></span>'; } else chip.style.display = 'none';
  });
  inEl.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); send(); } });
  $('go').onclick = () => send();
  $('prm').onclick = async function () {
    const list = await A.api('/api/prompts'); let html = '<div class="grp" style="margin-top:0">Saved prompts</div>' + list.map((p, i) => '<div class="hit" data-i="' + i + '"><b>' + esc(p.name) + '</b></div>').join('') + '<div class="hit" data-add="1"><b>+ Manage / add prompts</b></div>';
    const pp = A.pop(this, html); pp.dataset.kind = 'prompts';
    pp.onclick = e => {
      const h = e.target.closest('.hit'); if (!h) return; A.closePop();
      if (h.dataset.add) { A.tools.managePrompts(); return; }
      const p = list[+h.dataset.i]; const sel = ($('sel').querySelector('.t') || {}).textContent;
      const has = p.text.includes('{text}'); const typed = inEl.value.trim();
      if (has && typed) send(p.text.replace('{text}', typed), { noLocal: true });
      else { inEl.value = p.text.replace('{text}', typed || ''); autosize(); inEl.focus(); inEl.setSelectionRange(inEl.value.length, inEl.value.length); A.toast(has ? 'Paste or type your text after the prompt, then press Enter' : 'Prompt inserted'); }
    };
  };
  $('prm').dataset.pop = '1'; $('mic').dataset.pop = '1';
  $('mic').onclick = () => {
    if (A.voice.rec) { A.voice.stop(); return; }
    A.voice.start(t => { inEl.value = (inEl.value ? inEl.value + ' ' : '') + t; autosize(); inEl.focus(); }, (st, s) => {
      $('mic').classList.toggle('rec', st === 'rec'); $('status').textContent = st === 'rec' ? 'listening ' + Math.floor(s) + 's - click the mic to stop' : st === 'busy' ? 'transcribing...' : 'ready';
    });
  };

  /* ---------- models ---------- */
  async function loadModels(tries = 0) {
    $('status').textContent = tries ? 'starting the AI engine...' : 'connecting...';
    try {
      const r = await A.api('/api/models');
      if (!r.models.length) { if (tries < 8) { setTimeout(() => loadModels(tries + 1), 2500); return; } $('model').innerHTML = '<option>(no model)</option>'; $('status').textContent = 'AI engine not available'; return; }
      const saved = ls.get('model', '');      const pref = r.models.map(m => m.name), cloudOf = {}; r.models.forEach(m => { if (m.cloud) cloudOf[m.name] = m.label || ('☁ ' + m.name); });
      $('model').innerHTML = r.models.map(m => '<option value="' + esc(m.name) + '">' + esc(m.cloud ? (m.label || m.name) : m.name.replace(/:latest$/, '')) + '</option>').join('');
      /* the local model is still the default: Claude only when it was picked on purpose */
      const small = /qwen3\.5:(2|0\.8)b|:(0\.\d|[1-3](\.\d)?)b\b/i, local = r.models.filter(m => !m.cloud);
      const bigQwen = local.filter(m => /qwen/i.test(m.name) && !small.test(m.name)).sort((a, b) => b.size - a.size)[0];
      const pick = pref.includes(saved) ? saved : ((bigQwen && bigQwen.name) || local.filter(m => !small.test(m.name)).sort((a, b) => b.size - a.size)[0]?.name || pref[0]); $('model').value = pick;
      $('status').textContent = 'ready'; warm();
    } catch (e) { if (tries < 8) setTimeout(() => loadModels(tries + 1), 2500); }
  }
  const warm = () => { if (model() && model() !== '(no model)') A.api('/api/warm', { model: model() }); };
  $('model').onchange = () => { ls.set('model', model()); warm(); cloudBanner(); };
  /* while Claude answers, say so plainly, every time */
  function cloudBanner() {
    let b = document.getElementById('clban'); const on = A.ai && A.ai.isCloud(model());
    if (!on) { if (b) b.remove(); return; }
    if (!b) { b = document.createElement('div'); b.id = 'clban'; b.className = 'small'; b.style.cssText = 'margin:4px 12px;padding:6px 10px;border-radius:8px;border:1px solid var(--warn);line-height:1.45'; const box = inEl.closest('.row') || inEl.parentElement; box.parentElement.insertBefore(b, box); }
    const ok = ['screen', 'files', 'memory'].filter(k => A.ai.allowed(k)).map(k => ({ screen: 'the screen', files: 'your files and notes', memory: 'what the AI remembers' })[k]);
    b.innerHTML = '☁ <b>Claude (Anthropic) is answering.</b> What you type and anything you attach goes to Anthropic. ' + (ok.length ? 'You also allowed: ' + ok.join(', ') + '.' : 'Your files, notes, memories and the screen stay on this PC.') + ' <a href="#" data-pv>Privacy</a> · pick a local model above to stay offline.';
    b.querySelector('[data-pv]').onclick = e => { e.preventDefault(); A.settings && A.settings.open('privacy'); };
  }
  setTimeout(cloudBanner, 1500); A.on && A.on('privacy', cloudBanner);
  /* the internet box: only offered when Settings has internet access switched on (A.net hides it otherwise) */
  $('useweb').checked = ls.get('useweb', '0') === '1'; $('useweb').onchange = () => ls.set('useweb', $('useweb').checked ? '1' : '0');
  $('newc').onclick = () => A.chat.newChat();
  $('think').checked = ls.get('think', '0') === '1'; $('think').onchange = () => ls.set('think', $('think').checked ? '1' : '0');
  A.chat.warm = warm;

  A.registerTab('chat', 'Chat', () => inEl.focus());
  A.ready.push(async () => {
    try { chats = await A.api('/api/chats'); if (!Array.isArray(chats)) chats = []; } catch (e) { chats = []; }
    chats = chats.map(c => ({ id: c.id, title: c.title || 'Chat', updated: c.updated || 0, msgs: (c.messages || c.msgs || []).map(m => ({ role: m.role, content: m.content || m.display || '', thinking: m.thinking || '', local: m.local, sources: m.sources || [] })) }));
    cur = newChat(); chats.unshift(cur); renderAll(); loadModels();
  });
})();



